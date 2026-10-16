<?php
declare(strict_types=1);
/**
 * نقطة webhook واحدة لكل شركات التوصيل.
 * الرابط الذي تضعه الشركة (أو يضعه التاجر في حسابه): https://منصتك/shipping/webhook.php?c=<public_id>&t=<secret>
 * (يُنشأ الرابط عند تفعيل الشركة؛ السرّ يظهر مرة واحدة ويُحفظ مجزَّأً). المعرّف c يحدّد التاجر والشركة فلا حاجة إلى ترويسة خاصة.
 */
require_once __DIR__ . '/bootstrap.php';

/**
 * دالة الترجمة: حالة الشركة النصية ← حالة موحَّدة (pending, shipped, out_for_delivery, delivered, failed_attempt, returned, cancelled, unknown).
 * القواعد في Alyssum\Shipping\StatusMapper (مرتَّبة من الأخصّ إلى الأعم) وكل محوّل يستعملها في parseWebhook().
 */
function mapCarrierStatus(string $carrier, string $rawStatus): string
{
    return \Alyssum\Shipping\StatusMapper::map($carrier, $rawStatus);
}

if (PHP_SAPI !== 'cli' || getenv('SHIPPING_WEBHOOK_FORCE')) {
    try {
        $headers = [];
        foreach ($_SERVER as $k => $v) { if (str_starts_with($k, 'HTTP_')) { $headers[strtolower(str_replace('_', '-', substr($k, 5)))] = (string)$v; } }
        [$code, $type, $body] = shipping_services()['webhook']->handle($_SERVER['REQUEST_METHOD'] ?? 'GET', array_map('strval', $_GET), $headers, (string)file_get_contents('php://input', false, null, 0, 1_000_001));
    } catch (Throwable $e) {
        error_log('shipping webhook: ' . $e::class . ' ' . $e->getMessage());     // لا تسريب لتفاصيل داخلية في الردّ
        [$code, $type, $body] = [500, 'application/json; charset=utf-8', '{"error":"server"}'];
    }
    http_response_code($code); header('Content-Type: ' . $type); header('Cache-Control: no-store'); echo $body;
}
