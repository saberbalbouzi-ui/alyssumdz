<?php
declare(strict_types=1);
namespace Alyssum\Gateway;

/** حدود الاستعمال: نوافذ زمنية في gw_rl وعدّادات يومية في gw_usage (هي أساس الفوترة لاحقاً). */
final class Limiter
{
    public function __construct(private \PDO $db) {}

    /** يستهلك وحدة من $kind (order|track). @return int|null ثواني الانتظار إن تجاوز الحدّ، وإلا null */
    public function consume(array $tenant, array $plan, string $mode, string $kind): ?int
    {
        $now = time(); $tid = (int)$tenant['id'];
        $win = $kind === 'track' ? 60 : 3600;
        $max = $mode === 'test' ? ($kind === 'track' ? 60 : 60) : (int)($kind === 'track' ? $plan['track_min'] : $plan['orders_hour']);
        $retry = $this->window("t$tid:$kind", $max, $win, $now); if ($retry !== null) { return $retry; }
        if ($kind === 'order' && $mode === 'live') {
            $day = gmdate('Y-m-d'); $st = $this->db->prepare("SELECT n FROM gw_usage WHERE tenant_id=? AND day=? AND kind='order'"); $st->execute([$tid, $day]);
            if ((int)$st->fetchColumn() >= (int)$plan['orders_day']) { return max(60, strtotime('tomorrow 00:00 UTC') - $now); }
        }
        return null;
    }

    /** حدّ لكل مفتاح اعتباطي (IP…): يعيد ثواني الانتظار أو null. */
    public function window(string $key, int $max, int $win, ?int $now = null): ?int
    {
        $now ??= time();
        $st = $this->db->prepare('SELECT COUNT(*), MIN(t) FROM gw_rl WHERE k=? AND t>?'); $st->execute([$key, $now - $win]); [$n, $oldest] = array_values($st->fetch(\PDO::FETCH_NUM));
        if ((int)$n >= $max) { return max(1, (int)$oldest + $win - $now); }
        $this->db->prepare('INSERT INTO gw_rl (k,t) VALUES (?,?)')->execute([$key, $now]);
        if (random_int(1, 100) === 1) { $this->db->prepare('DELETE FROM gw_rl WHERE t<?')->execute([$now - 7200]); }
        return null;
    }

    public function count(int $tenantId, string $kind): void
    {
        $this->db->prepare('INSERT INTO gw_usage (tenant_id,day,kind,n) VALUES (?,?,?,1) ON CONFLICT(tenant_id,day,kind) DO UPDATE SET n=n+1')->execute([$tenantId, gmdate('Y-m-d'), $kind]);
    }

    /** @return array<string,int> */
    public function today(int $tenantId): array
    {
        $st = $this->db->prepare('SELECT kind,n FROM gw_usage WHERE tenant_id=? AND day=?'); $st->execute([$tenantId, gmdate('Y-m-d')]);
        return array_map('intval', array_column($st->fetchAll(), 'n', 'kind'));
    }
}
