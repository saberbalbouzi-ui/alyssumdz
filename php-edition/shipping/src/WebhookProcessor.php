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
        try { $events = ShippingFactory::forWebhook((string)$conn['carrier_code'])->parseWebhook($payload, $headers); }
        catch (UnsupportedCarrierException) { return self::json(200, ['ok' => true, 'ignored' => 'unsupported']); }
        $updated = 0;
        foreach ($events as $e) { if ($this->service->applyStatus((int)$conn['id'], $e->tracking, $e->rawStatus, $e->status, $e->orderRef)) { $updated++; } }
        return self::json(200, ['ok' => true, 'received' => count($events), 'updated' => $updated]);
    }

    /** @param array<string,mixed> $b @return array{0:int,1:string,2:string} */
    private static function json(int $code, array $b): array { return [$code, 'application/json; charset=utf-8', json_encode($b, JSON_UNESCAPED_UNICODE)]; }
}
