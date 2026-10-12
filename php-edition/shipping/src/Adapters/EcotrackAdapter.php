<?php
declare(strict_types=1);
namespace Alyssum\Shipping\Adapters;

use Alyssum\Shipping\{AbstractAdapter, CarrierApiException, CredentialsException, Parcel, ShipmentResult, TrackingResult};

/**
 * محوّل Ecotrack العام: منصة مشتركة تؤجّرها شركات كثيرة (DHD وغيرها) — الفرق الوحيد هو الرابط الأساسي لكل شركة.
 * يُنشأ بواسطة ShippingFactory مع baseUrl الشركة (من السجلّ أو من إدخال التاجر).
 * ⚠️ تجريبي: صيغة /api/v1/create/order مبنية على تكامل اللوحة الحالي؛ لم تُجرَّب على حساب حقيقي.
 */
final class EcotrackAdapter extends AbstractAdapter
{
    private string $base = '';

    public function __construct(\Alyssum\Shipping\Http\HttpClient $http, private string $carrierCode = 'ecotrack', string $baseUrl = '')
    {
        parent::__construct($http);
        $this->base = $this->cleanBase($baseUrl);
    }

    public function code(): string { return $this->carrierCode; }

    public static function credentialFields(): array
    {
        return [
            ['key' => 'baseUrl', 'label' => 'رابط المنصة (مثال: https://dhd.ecotrack.dz)', 'secret' => false, 'required' => false],
            ['key' => 'token', 'label' => 'API Token (Bearer)', 'secret' => true],
            ['key' => 'boutique', 'label' => 'اسم المتجر عند الشركة (اختياري)', 'secret' => false, 'required' => false],
        ];
    }

    public function authenticate(array $credentials): static
    {
        parent::authenticate($credentials);
        if (($this->cred['baseUrl'] ?? '') !== '') { $this->base = $this->cleanBase($this->cred['baseUrl']); }
        if (!preg_match('#^https://[a-z0-9.-]+(:\d+)?(/.*)?$#i', $this->base)) { throw new CredentialsException('رابط المنصة مطلوب ويبدأ بـ https://'); }
        return $this;
    }

    private function h(bool $json = false): array
    {
        $h = ['Authorization' => 'Bearer ' . $this->cred['token'], 'Accept' => 'application/json'];
        return $json ? $h + ['Content-Type' => 'application/json'] : $h;
    }

    public function createParcel(Parcel $p): ShipmentResult
    {
        $r = $this->send('POST', $this->base . '/api/v1/create/order', $this->h(true), [
            'reference' => $p->orderRef, 'nom_client' => $p->name, 'telephone' => $p->localPhone(), 'telephone_2' => $p->phone2 !== '' ? $p->localPhone($p->phone2) : '',
            'adresse' => $p->address !== '' ? $p->address : $p->commune . '، ' . $p->wilayaName(), 'code_postal' => '', 'commune' => $p->commune,
            'code_wilaya' => $p->legacyWilaya(), 'montant' => (int)round($p->total), 'remarque' => $p->note, 'produit' => $p->productsText(),
            'boutique' => $this->cred['boutique'] ?? '', 'type' => 1, 'stop_desk' => $p->stopDesk ? 1 : 0, 'quantite' => 1,
        ]);
        $j = $r->json() ?? [];
        $trk = self::pick($j, 'tracking', 'tracking_number') ?: self::pick($j['data'] ?? [], 'tracking');
        if ($r->ok() && $trk !== '') { return new ShipmentResult(true, $trk, null, '', $j); }
        $msg = self::pick($j, 'message') . (isset($j['errors']) ? ' — ' . json_encode($j['errors'], JSON_UNESCAPED_UNICODE) : '');
        return new ShipmentResult(false, error: trim($msg) ?: ('HTTP ' . $r->status), raw: $j);
    }

    public function trackParcel(string $tracking): TrackingResult
    {
        $j = $this->send('GET', $this->base . '/api/v1/get/tracking/info?tracking=' . rawurlencode($tracking), $this->h())->json() ?? [];
        $d = isset($j['activity']) ? $j : ($j['data'] ?? $j);
        $a = $d['activity'] ?? $d['history'] ?? null;
        $last = is_array($a) && $a ? end($a) : null;
        $raw = self::pick(is_array($last) ? $last : [], 'status', 'event') ?: self::pick(is_array($d) ? $d : [], 'status', 'last_status');
        if ($raw === '') { throw new CarrierApiException('حالة الطرد غير موجودة في ردّ الشركة'); }
        return new TrackingResult($tracking, $raw, $this->mapStatus($raw), $j);
    }

    public function cancelParcel(string $tracking): bool
    {
        return $this->send('DELETE', $this->base . '/api/v1/delete/order?tracking=' . rawurlencode($tracking), $this->h())->ok();
    }

    /** رابط البوليصة عند Ecotrack يتطلب ترويسة Bearer فلا يصلح رابطاً مباشراً للمتصفح؛ يُترك null حتى يُبنى وسيط تنزيل. */
    public function labelUrl(string $tracking): ?string { return null; }
}
