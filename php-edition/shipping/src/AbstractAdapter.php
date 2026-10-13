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

    /** عائلة قاموس الحالات (شركات تتشارك المنصة نفسها تتشارك القاموس). */
    protected function statusFamily(): string { return $this->code(); }

    public function mapStatus(string $rawStatus): string
    {
        $ov = $this->profile['status_overrides'][StatusMapper::normalize($rawStatus)] ?? null;          // تصحيح خاص بحساب هذه الشركة (يُضاف عند المعايرة أو من اللوحة)
        if (is_string($ov) && in_array($ov, Status::ALL, true)) { return $ov; }
        return StatusMapper::map($this->statusFamily(), $rawStatus);
    }

    public function explainStatus(string $rawStatus): array
    {
        $ov = $this->profile['status_overrides'][StatusMapper::normalize($rawStatus)] ?? null;
        if (is_string($ov) && in_array($ov, Status::ALL, true)) { return [$ov, 'override']; }
        return StatusMapper::explain($this->statusFamily(), $rawStatus);
    }

    /** @var array<string,mixed> */
    protected array $profile = [];
    /** نداء يُستدعى بين طلبات الاكتشاف الكثيرة لاحترام حدود المعدّل (يُعطَّل في الاختبارات). */
    public ?\Closure $pause = null;

    public function withProfile(array $profile): static { $this->profile = $profile; return $this; }

    public function discover(array $wilayas, array $want = []): array { return self::emptyDiscovery(['الشركة لا توفّر واجهة قراءة للمعايرة']); }

    /** @param list<string> $notes */
    protected static function emptyDiscovery(array $notes = []): array { return ['communes' => [], 'desks' => [], 'fees' => [], 'statuses' => [], 'trackings' => [], 'notes' => $notes]; }

    protected function breath(int $ms = 250): void { if ($this->pause) { ($this->pause)($ms); } }

    /** GET يعيد JSON مع إعادة محاولة (حتى 3) عند 429 (حدود المعدّل أثناء الاكتشاف). @return array<mixed> */
    protected function getJson(string $url, array $headers): array
    {
        for ($i = 0; ; $i++) {
            try { return $this->send('GET', $url, $headers)->json() ?? []; }
            catch (CarrierApiException $e) { if ($i >= 3 || !str_contains($e->getMessage(), '429')) { throw $e; } $this->breath([2500, 6000, 15000][$i]); }   // تمهّل متصاعد عند حدّ المعدّل
        }
    }

    /** مفتاح مقارنة موحَّد لاسم البلدية. */
    public static function ck(string $name): string { return CommuneMatcher::normalize($name); }

    /**
     * قرار البلدية من ملف المعايرة: ['name'=>الاسم الصحيح عند الشركة أو null (لا قرار)، 'id'=>معرّفها إن عُرف، 'block'=>رسالة منع إن كانت مرفوضة سلفاً].
     * @return array{name:?string,id:int|string|null,block:?string}
     */
    protected function profileCommune(int $legacyWilaya, string $commune, string $wilayaName): array
    {
        $w = $this->profile['communes'][(string)$legacyWilaya] ?? null;
        if (!is_array($w)) { return ['name' => null, 'id' => null, 'block' => null]; }
        $k = self::ck($commune);
        $name = $w['map'][$k] ?? null;
        if ($name === null && (int)($w['n'] ?? 0) > 0) { $name = $commune; }            // المعايَرة تغطّي هذه الولاية وهذا الاسم مطابق تماماً عند الشركة
        $id = $name !== null ? ($w['ids'][self::ck((string)$name)] ?? null) : null;
        if (in_array($k, array_map([self::class, 'ck'], (array)($w['undeliverable'] ?? [])), true)) {
            return ['name' => $name, 'id' => $id, 'block' => "الشركة لا توصّل حالياً إلى بلدية «{$commune}» في {$wilayaName} (حسب معايرة حسابك)"];
        }
        if (in_array($k, array_map([self::class, 'ck'], (array)($w['unmatched'] ?? [])), true)) {
            return ['name' => null, 'id' => null, 'block' => "بلدية «{$commune}» غير موجودة في قائمة الشركة لولاية {$wilayaName} (حسب معايرة حسابك) — اختر بلدية أخرى أو راجع الشركة"];
        }
        return ['name' => $name, 'id' => $id, 'block' => null];
    }

    public function verifyWebhook(string $rawBody, array $headers): ?bool
    {
        $secret = (string)($this->cred['webhookSecret'] ?? ''); if ($secret === '') { return null; }
        $want = hash_hmac('sha256', $rawBody, $secret);
        foreach (['x-yalidine-signature', 'x-signature', 'x-hub-signature-256', 'x-webhook-signature'] as $h) {
            $v = strtolower(trim((string)($headers[$h] ?? ''))); if ($v === '') { continue; }
            if (str_starts_with($v, 'sha256=')) { $v = substr($v, 7); }
            if (hash_equals($want, $v)) { return true; }
        }
        return false;
    }

    public function ping(): array { return ['ok' => null, 'message' => 'الفحص غير مدعوم لهذه الشركة']; }

    /** @param \Closure():array{0:bool,1:string} $probe يُرجع [صالحة؟، رسالة]؛ رفض المفاتيح = false، وتعذّر الاتصال = null (لا يُحكم). @return array{ok:?bool,message:string} */
    protected function probe(\Closure $probe): array
    {
        try { [$ok, $msg] = $probe(); return ['ok' => $ok, 'message' => $msg]; }
        catch (CredentialsException $e) { return ['ok' => false, 'message' => $e->getMessage()]; }
        catch (\Throwable $e) { return ['ok' => null, 'message' => $e->getMessage()]; }
    }

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
        if ($r->status === 429) { throw new CarrierApiException('الشركة تطلب التمهل (429): أعد المحاولة بعد قليل'); }
        return $r;
    }

    protected function cleanBase(string $url): string { return rtrim(trim($url), '/'); }

    protected static function pick(?array $a, string ...$keys): string
    {
        foreach ($keys as $k) { if (isset($a[$k]) && is_scalar($a[$k]) && (string)$a[$k] !== '') { return (string)$a[$k]; } }
        return '';
    }
}
