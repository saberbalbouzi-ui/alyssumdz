<?php
declare(strict_types=1);
namespace Alyssum\Gateway;

use Alyssum\Shipping\Http\HttpClient;

/** إرسال أحداث الحالة إلى webhook العميل: توقيع HMAC مع طابع زمني، وإعادة محاولة بتباعد، عبر عميل HTTP آمن (HTTPS فقط، لا عناوين داخلية). */
final class Dispatcher
{
    private const BACKOFF = [60, 300, 1800, 7200, 43200];       // بعد أول فشل: دقيقة، 5 د، 30 د، ساعتان، 12 ساعة ثم يُهمَل

    public function __construct(private \PDO $db, private Tenants $tenants, private HttpClient $http) {}

    /** @param array<string,mixed> $data */
    public function enqueue(int $tenantId, int $orderId, string $type, array $data, array $plan): void
    {
        if (!(int)$plan['webhooks'] || !$this->tenants->webhook($tenantId)) { return; }
        $now = time();
        $this->db->prepare('INSERT INTO gw_events (tenant_id,order_id,type,payload,state,attempts,next_at,created_at) VALUES (?,?,?,?,?,0,?,?)')
            ->execute([$tenantId, $orderId, $type, json_encode($data, JSON_UNESCAPED_UNICODE), 'pending', $now, gmdate('Y-m-d H:i:s', $now)]);
    }

    public static function sign(string $secret, int $ts, string $body): string { return 't=' . $ts . ',v1=' . hash_hmac('sha256', $ts . '.' . $body, $secret); }

    /** @return array{sent:int,failed:int} */
    public function deliverDue(int $limit = 25): array
    {
        $st = $this->db->prepare("SELECT * FROM gw_events WHERE state='pending' AND next_at<=? ORDER BY id LIMIT $limit"); $st->execute([time()]);
        $sent = 0; $failed = 0;
        foreach ($st->fetchAll() as $e) {
            $wh = $this->tenants->webhook((int)$e['tenant_id']);
            if (!$wh) { $this->db->prepare("UPDATE gw_events SET state='failed', last_error='no_webhook' WHERE id=?")->execute([$e['id']]); continue; }
            $body = json_encode(['id' => 'evt_' . $e['id'], 'type' => $e['type'], 'created' => strtotime((string)$e['created_at'] . ' UTC'), 'data' => json_decode((string)$e['payload'], true)], JSON_UNESCAPED_UNICODE);
            $ts = time();
            $r = $this->http->request('POST', $wh['url'], ['Content-Type' => 'application/json', 'X-Gateway-Signature' => self::sign($wh['secret'], $ts, $body), 'X-Gateway-Event' => (string)$e['type'], 'User-Agent' => 'shipgw-webhook/1'], $body);
            $n = (int)$e['attempts'] + 1;
            if ($r->ok()) { $this->db->prepare("UPDATE gw_events SET state='sent', attempts=?, last_error=NULL WHERE id=?")->execute([$n, $e['id']]); $sent++; continue; }
            $failed++; $err = $r->status ? 'HTTP ' . $r->status : ($r->error ?: 'network');
            if ($n > count(self::BACKOFF)) { $this->db->prepare("UPDATE gw_events SET state='failed', attempts=?, last_error=? WHERE id=?")->execute([$n, $err, $e['id']]); }
            else { $this->db->prepare('UPDATE gw_events SET attempts=?, next_at=?, last_error=? WHERE id=?')->execute([$n, time() + self::BACKOFF[$n - 1], $err, $e['id']]); }
        }
        return ['sent' => $sent, 'failed' => $failed];
    }
}
