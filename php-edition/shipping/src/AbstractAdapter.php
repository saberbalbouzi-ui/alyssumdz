<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

use Alyssum\Shipping\Http\HttpClient;
use Alyssum\Shipping\Http\HttpResponse;

/** قاعدة مشتركة للمحوّلات: حقن المفاتيح، طلبات HTTP، أدوات تطبيع. */
abstract class AbstractAdapter implements ShippingInterface
{
    /** @var array<string,string> */
    protected array $cred = [];

    public function __construct(protected HttpClient $http) {}

    /** يتحقق من الحقول المطلوبة في credentialFields() (secret/required افتراضياً مطلوب). */
    public function authenticate(array $credentials): static
    {
        foreach (static::credentialFields() as $f) {
            if (($f['required'] ?? true) && trim((string)($credentials[$f['key']] ?? '')) === '') { throw new CredentialsException('الحقل مطلوب: ' . $f['label']); }
        }
        $this->cred = array_map(static fn($v) => trim((string)$v), $credentials);
        return $this;
    }

    public function wilayas(): array { return WilayaCatalog::list(); }

    public function mapStatus(string $rawStatus): string { return StatusMapper::map($this->code(), $rawStatus); }

    public function labelUrl(string $tracking): ?string { return null; }

    public function cancelParcel(string $tracking): bool { return false; }

    public function parseWebhook(array $payload, array $headers): array
    {
        // الصيغة العامة: كائن واحد أو مصفوفة {tracking, status}. المحوّلات الأخرى تتجاوزها.
        $items = array_is_list($payload) ? $payload : (isset($payload['data']) && is_array($payload['data']) ? (array_is_list($payload['data']) ? $payload['data'] : [$payload['data']]) : [$payload]);
        $out = [];
        foreach ($items as $it) {
            if (!is_array($it)) { continue; }
            $trk = (string)($it['tracking'] ?? $it['tracking_number'] ?? $it['tracking_code'] ?? '');
            $raw = (string)($it['status'] ?? $it['last_status'] ?? $it['state'] ?? '');
            if ($trk !== '' && $raw !== '') { $out[] = new WebhookEvent($trk, $raw, $this->mapStatus($raw), (string)($it['order_id'] ?? $it['reference'] ?? ''), $it); }
        }
        return $out;
    }

    /** @param array<string,string> $headers */
    protected function send(string $method, string $url, array $headers = [], array|string|null $body = null): HttpResponse
    {
        $payload = is_array($body) ? json_encode($body, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) : $body;
        $r = $this->http->request($method, $url, $headers, $payload);
        if ($r->status === 0) { throw new CarrierApiException('تعذّر الاتصال بالشركة: ' . ($r->error ?: 'خطأ شبكة')); }
        if ($r->status === 401 || $r->status === 403) { throw new CredentialsException('رفضت الشركة المفاتيح (HTTP ' . $r->status . ')'); }
        return $r;
    }

    protected function cleanBase(string $url): string { return rtrim(trim($url), '/'); }

    protected static function pick(?array $a, string ...$keys): string
    {
        foreach ($keys as $k) { if (isset($a[$k]) && is_scalar($a[$k]) && (string)$a[$k] !== '') { return (string)$a[$k]; } }
        return '';
    }
}
