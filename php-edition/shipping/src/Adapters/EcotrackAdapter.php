<?php
declare(strict_types=1);
namespace Alyssum\Shipping\Adapters;

use Alyssum\Shipping\{AbstractAdapter, CarrierApiException, CommuneMatcher, CredentialsException, Parcel, ShipmentResult, StatusMapper, TrackingResult};

/**
 * محوّل Ecotrack العام: منصة مشتركة تؤجّرها شركات كثيرة (DHD وغيرها) — الفرق الوحيد هو الرابط الأساسي لكل شركة.
 * الصيغة من وثيقة الشركة نفسها (نص ecotrack_api): create/order **بمعاملات في سلسلة الاستعلام وبلا جسم**، المصادقة Bearer،
 * الحالات من قاموس data/status-dict.json (عائلة ecotrack)، والطرد يبقى مسوّدة حتى valid/order (يُستدعى تلقائياً ما لم يُعطَّل).
 * ⚠️ لم يُجرَّب على حساب حقيقي؛ المطابقة تُختبر بمحاكٍ صارم مبنيّ على الوثيقة (scripts/test-carriers.php).
 */
final class EcotrackAdapter extends AbstractAdapter
{
    private string $base = '';
    /** @var array<string,list<array{id:int|string,name:string,desk:string}>> */
    private array $communes = [];

    public function __construct(\Alyssum\Shipping\Http\HttpClient $http, private string $carrierCode = 'ecotrack', string $baseUrl = '')
    {
        parent::__construct($http);
        $this->base = $this->cleanBase($baseUrl);
    }

    public function code(): string { return $this->carrierCode; }
    protected function statusFamily(): string { return 'ecotrack'; }

    public static function credentialFields(): array
    {
        return [
            ['key' => 'baseUrl', 'label' => 'رابط المنصة (مثال: https://dhd.ecotrack.dz)', 'secret' => false, 'required' => false],
            ['key' => 'token', 'label' => 'API Token (Bearer)', 'secret' => true],
            ['key' => 'boutique', 'label' => 'اسم المتجر عند الشركة (اختياري)', 'secret' => false, 'required' => false],
            ['key' => 'autoValidate', 'label' => 'تصديق الطرد تلقائياً بعد الإنشاء (1 افتراضي، 0 يبقى مسوّدة)', 'secret' => false, 'required' => false],
        ];
    }

    public function authenticate(array $credentials): static
    {
        parent::authenticate($credentials);
        if (($this->cred['baseUrl'] ?? '') !== '') { $this->base = $this->cleanBase($this->cred['baseUrl']); }
        if (!preg_match('#^https://[a-z0-9.-]+(:\d+)?(/.*)?$#i', $this->base)) { throw new CredentialsException('رابط المنصة مطلوب ويبدأ بـ https://'); }
        return $this;
    }

    private function h(): array { return ['Authorization' => 'Bearer ' . $this->cred['token'], 'Accept' => 'application/json']; }

    public function ping(): array
    {
        return $this->probe(function (): array {
            $j = $this->send('GET', $this->base . '/api/v1/validate/token?api_token=' . rawurlencode($this->cred['token']), $this->h())->json() ?? [];
            $m = self::pick($j, 'message');
            if ($m === 'VALID_TOKEN') { return [true, 'المفتاح صالح']; }
            if ($m === 'TOKEN_NOT_ALLOWED') { return [false, 'الواجهة البرمجية غير مفعّلة لحسابك عند الشركة (TOKEN_NOT_ALLOWED)']; }
            if ($m === 'INVALID_TOKEN') { return [false, 'المفتاح غير صالح (INVALID_TOKEN)']; }
            return [null, 'ردّ غير متوقع من الشركة: ' . ($m ?: 'فارغ')];
        });
    }

    /** بلديات ولاية عند منصة التاجر بتهجئتها الدقيقة (قائمة فارغة إن تعذّر الجلب فيُرسل الاسم كما هو). @return list<array{id:int|string,name:string,desk:string}> */
    public function communes(int $wilaya): array
    {
        $key = substr(sha1($this->base . $this->cred['token']), 0, 10) . ':' . $wilaya;
        if (isset($this->communes[$key])) { return $this->communes[$key]; }
        try { $j = $this->send('GET', $this->base . '/api/v1/get/communes?wilaya_id=' . $wilaya, $this->h())->json() ?? []; } catch (CarrierApiException) { return []; }
        $out = [];
        foreach ($j as $c) { if (is_array($c) && isset($c['nom'])) { $out[] = ['id' => (string)$c['nom'], 'name' => (string)$c['nom'], 'desk' => (string)($c['code_postal'] ?? '')]; } }
        return $this->communes[$key] = $out;
    }

    public function createParcel(Parcel $p): ShipmentResult
    {
        $commune = $p->commune;
        $list = $this->communes($p->legacyWilaya());
        if ($list) {
            $m = CommuneMatcher::best($list, $p->commune);
            if (!$m) { return new ShipmentResult(false, error: 'بلدية «' . $p->commune . '» غير موجودة عند الشركة في ' . $p->wilayaName() . ' — الأقرب: ' . implode('، ', CommuneMatcher::suggest($list, $p->commune))); }
            $commune = (string)$m['name'];
        }
        $q = array_filter([
            'reference' => $p->orderRef, 'nom_client' => $p->name, 'telephone' => $p->localPhone(), 'telephone_2' => $p->phone2 !== '' ? $p->localPhone($p->phone2) : '',
            'adresse' => $p->address !== '' ? $p->address : $p->commune . '، ' . $p->wilayaName(), 'commune' => $commune,
            'code_wilaya' => $p->legacyWilaya(), 'montant' => (int)round($p->total), 'type' => 1, 'stop_desk' => $p->stopDesk ? 1 : 0,
            'code_postal' => $p->stopDesk ? $p->deskCode : '', 'remarque' => mb_substr($p->note, 0, 255), 'produit' => mb_substr($p->productsText(), 0, 255),
            'boutique' => $this->cred['boutique'] ?? '',
        ], static fn($v) => $v !== '' && $v !== null);
        if ($p->stopDesk && $p->deskCode === '') { return new ShipmentResult(false, error: 'Ecotrack يحتاج رمز مكتب Stop Desk (code_postal) — اختر المكتب أو أرسل للمنزل'); }
        $r = $this->send('POST', $this->base . '/api/v1/create/order?' . http_build_query($q), $this->h());
        $j = $r->json() ?? [];
        $trk = self::pick($j, 'tracking', 'tracking_number') ?: self::pick(is_array($j['data'] ?? null) ? $j['data'] : [], 'tracking');
        if ($r->ok() && $trk !== '' && ($j['success'] ?? true) !== false) {
            $warn = '';
            if (($this->cred['autoValidate'] ?? '1') !== '0') {
                $v = $this->send('POST', $this->base . '/api/v1/valid/order?tracking=' . rawurlencode($trk), $this->h());
                $vj = $v->json() ?? [];
                if (!$v->ok() || ($vj['success'] ?? true) === false) { $warn = 'أُنشئ الطرد لكن لم يُصدَّق عند الشركة: ' . (self::pick($vj, 'message') ?: 'HTTP ' . $v->status); }
            }
            return new ShipmentResult(true, $trk, null, $warn, $j);
        }
        return new ShipmentResult(false, error: $this->errorText($j, $r->status), raw: $j);
    }

    private function errorText(array $j, int $status): string
    {
        $code = (int)($j['code'] ?? $j['error_code'] ?? 0);
        $known = [10001 => 'الطلب مُصدَّق ولا يقبل التعديل', 10002 => 'الشركة لا توصّل إلى هذه الولاية', 10003 => 'لا يمكن طلب الإرجاع الآن'];
        $msg = self::pick($j, 'message') . (isset($j['errors']) ? ' — ' . json_encode($j['errors'], JSON_UNESCAPED_UNICODE) : '');
        return trim(($known[$code] ?? '') . ' ' . $msg) ?: ('HTTP ' . $status);
    }

    public function trackParcel(string $tracking): TrackingResult
    {
        $j = $this->send('GET', $this->base . '/api/v1/get/tracking/info?tracking=' . rawurlencode($tracking), $this->h())->json() ?? [];
        $d = isset($j['activity']) ? $j : (is_array($j['data'] ?? null) ? $j['data'] : $j);
        $rows = $d['activity'] ?? $d['history'] ?? null;
        $raw = '';
        if (is_array($rows)) {
            foreach (array_reverse(array_values($rows)) as $row) {                       // أحدث حدث غير إداري
                $cand = self::pick(is_array($row) ? $row : [], 'status', 'event');
                if ($cand !== '' && StatusMapper::explain('ecotrack', $cand)[0] !== 'ignore') { $raw = $cand; break; }
            }
        }
        if ($raw === '') { $raw = self::pick(is_array($d) ? $d : [], 'status', 'last_status'); }
        if ($raw === '') { throw new CarrierApiException('حالة الطرد غير موجودة في ردّ الشركة'); }
        return new TrackingResult($tracking, $raw, $this->mapStatus($raw), $j);
    }

    public function cancelParcel(string $tracking): bool
    {
        $r = $this->send('DELETE', $this->base . '/api/v1/delete/order?tracking=' . rawurlencode($tracking), $this->h());
        $j = $r->json() ?? [];
        return $r->ok() && (!isset($j['delete']) || $j['delete'] === 'success');
    }

    /** رابط البوليصة عند Ecotrack يتطلب ترويسة Bearer فلا يصلح رابطاً مباشراً للمتصفح؛ يُترك null حتى يُبنى وسيط تنزيل. */
    public function labelUrl(string $tracking): ?string { return null; }
}
