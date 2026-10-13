<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

/**
 * معالج الـwebhook الموحَّد (منفصل عن webhook.php ليُختبر بلا خادم).
 * الرابط الذي يُسلَّم للشركة: https://المنصة/shipping/webhook.php?c=<public_id>&t=<السرّ الظاهر مرة واحدة>
 * 200 دائماً بعد التحقق (ليتوقف تكرار الإرسال)؛ 401 لرابط/سرّ خاطئ؛ 400 لجسم غير صالح.
 */
final class WebhookProcessor
{
    private const MAX_BODY = 1_000_000;

    public function __construct(private ConnectionRepository $repo, private ShippingService $service) {}

    /**
     * @param array<string,string> $query @param array<string,string> $headers أسماء صغيرة
     * @return array{0:int,1:string,2:string} [HTTP، النوع، الجسم]
     */
    public function handle(string $method, array $query, array $headers, string $raw): array
    {
        if ($method === 'GET') {
            // التحقق CRC (ياليدين وأمثالها): نُرجع crc_token كما هو
            if (isset($query['subscribe'], $query['crc_token'])) { return [200, 'text/plain; charset=utf-8', (string)$query['crc_token']]; }
            return self::json(200, ['ok' => true, 'webhook' => 'ready']);
        }
        if ($method !== 'POST') { return self::json(405, ['error' => 'method']); }
        $conn = $this->repo->findByPublicId((string)($query['c'] ?? ''));
        if (!$conn || !$this->repo->checkWebhookToken($conn, (string)($query['t'] ?? ''))) { return self::json(401, ['error' => 'unauthorized']); }
        if (strlen($raw) > self::MAX_BODY) { return self::json(413, ['error' => 'too_large']); }
        $payload = json_decode($raw, true);
        if (!is_array($payload)) { return self::json(400, ['error' => 'bad_json']); }
        try { $ad = $this->repo->adapterFor($conn); }                    // بمفاتيح التاجر وملف معايرته (التوقيع + تصحيح الحالات)
        catch (UnsupportedCarrierException) { return self::json(200, ['ok' => true, 'ignored' => 'unsupported']); }
        catch (ShippingException) { $ad = ShippingFactory::forWebhook((string)$conn['carrier_code']); }
        if ($ad->verifyWebhook($raw, $headers) === false) { return self::json(401, ['error' => 'bad_signature']); }
        $events = $ad->parseWebhook($payload, $headers);
        $updated = 0;
        foreach ($events as $e) { if ($this->service->applyStatus((int)$conn['id'], $e->tracking, $e->rawStatus, $e->status, $e->orderRef)) { $updated++; } }
        $this->capture((int)$conn['id'], $payload, count($events), $ad->verifyWebhook($raw, $headers));
        return self::json(200, ['ok' => true, 'received' => count($events), 'updated' => $updated]);
    }

    /** يلتقط شكل أول إشعارات حقيقية من الشركة في ملف المعايرة (مفاتيح الجسم، وهل حلّلها المحوّل، وهل التوقيع صحيح) كي يظهر للعميل والدعم أن ربط الـwebhook يعمل فعلاً. @param array<string,mixed> $payload */
    private function capture(int $connId, array $payload, int $parsed, ?bool $signed): void
    {
        try {
            $p = $this->repo->profile($connId); if (!$p) { $p = ['v' => Calibrator::V, 'communes' => [], 'statuses' => [], 'warnings' => [], 'notes' => []]; }
            $w = (array)($p['webhook'] ?? ['received' => 0, 'parsed' => 0, 'empty' => 0, 'shapes' => []]);
            $w['received'] = (int)($w['received'] ?? 0) + 1; $w['parsed'] = (int)($w['parsed'] ?? 0) + ($parsed > 0 ? 1 : 0); $w['empty'] = (int)($w['empty'] ?? 0) + ($parsed > 0 ? 0 : 1);
            $w['last_at'] = gmdate('c'); $w['signed'] = $signed;
            $shape = implode(',', array_slice(array_keys($payload), 0, 12));
            if (!in_array($shape, (array)$w['shapes'], true) && count((array)$w['shapes']) < 5) { $w['shapes'][] = $shape; }
            $p['webhook'] = $w; $this->repo->saveProfile($connId, $p);
        } catch (\Throwable) { /* الالتقاط اختياري ولا يُفشل الإشعار */ }
    }

    /** @param array<string,mixed> $b @return array{0:int,1:string,2:string} */
    private static function json(int $code, array $b): array { return [$code, 'application/json; charset=utf-8', json_encode($b, JSON_UNESCAPED_UNICODE)]; }
}
