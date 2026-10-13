<?php
declare(strict_types=1);
namespace Alyssum\Shipping\Adapters;

use Alyssum\Shipping\{AbstractAdapter, CarrierApiException, CommuneMatcher, Parcel, ShipmentResult, TrackingResult};

/**
 * Maystro Delivery — Authorization: Token <key> (ليس Bearer).
 * الصيغة من مستودعات عامة متعددة (CourierDZ وuften وdzcouriers وVargo) لأن الشركة لا تنشر وثائق: الطلب يحتاج **معرّف بلدية رقمي**
 * من base/communes/?wilaya=ID (يُحلّ هنا باسم البلدية بمطابقة مرنة)، و`products[]` و`source`=4، وrقم الطرد `id` (UUID) للروابط.
 * delivery_type: v2 (1 منزل، 2 مكتب) هو الأحدث؛ v1 (0/1) للقديم — يُضبط بالحقل scheme. product_price = السعر بلا التوصيل (priceMode=total لتغييره).
 * ⚠️ لم يُجرَّب على حساب حقيقي؛ تحقّق من delivery_type ومسار الإلغاء مع دعم Maystro.
 */
final class MaystroAdapter extends AbstractAdapter
{
    public const BASE = 'https://backend.maystro-delivery.com/api';

    /** @var array<string,list<array{id:int|string,name:string}>> */
    private array $communes = [];

    public function code(): string { return 'maystro'; }

    public static function credentialFields(): array
    {
        return [
            ['key' => 'apiKey', 'label' => 'API Key (Token)', 'secret' => true],
            ['key' => 'scheme', 'label' => 'نمط نوع التوصيل: v2 (1 منزل، 2 مكتب — الافتراضي) أو v1 (0/1)', 'secret' => false, 'required' => false],
            ['key' => 'priceMode', 'label' => 'سعر المنتج المرسل: items (بلا التوصيل — الافتراضي) أو total (شاملاً التوصيل)', 'secret' => false, 'required' => false],
        ];
    }

    private function h(): array { return ['Authorization' => 'Token ' . $this->cred['apiKey'], 'Content-Type' => 'application/json', 'Accept' => 'application/json']; }

    public function ping(): array
    {
        return $this->probe(function (): array {
            $r = $this->send('GET', self::BASE . '/base/wilayas/?country=1&language=fr', $this->h());
            return $r->ok() ? [true, 'المفتاح صالح'] : [null, 'ردّ غير متوقع (HTTP ' . $r->status . ')'];
        });
    }

    /** @return list<array{id:int|string,name:string}> بلديات ولاية Maystro (تُحمَّل مرة وتُخزَّن في الذاكرة). */
    public function communes(int $wilaya): array
    {
        $key = substr(sha1($this->cred['apiKey']), 0, 10) . ':' . $wilaya;
        if (isset($this->communes[$key])) { return $this->communes[$key]; }
        $j = $this->send('GET', self::BASE . '/base/communes/?wilaya=' . $wilaya, $this->h())->json() ?? [];
        $rows = isset($j['results']) && is_array($j['results']) ? $j['results'] : (array_is_list($j) ? $j : []);
        $out = [];
        foreach ($rows as $c) { if (is_array($c) && isset($c['id'], $c['name'])) { $out[] = ['id' => $c['id'], 'name' => (string)$c['name']]; } }
        return $this->communes[$key] = $out;
    }

    public function discover(array $wilayas, array $want = []): array
    {
        $d = self::emptyDiscovery(['Maystro لا تعرض مكاتبها ولا تعريفتها عبر الواجهة العامة']);
        try {
            if ($want['communes'] ?? false) {
                foreach ($wilayas as $w) {
                    $this->breath();
                    $list = [];
                    foreach ($this->communes((int)$w) as $c) { $list[] = ['name' => $c['name'], 'id' => $c['id']]; }
                    $d['communes'][(int)$w] = $list;
                }
            }
        } catch (CarrierApiException $e) { $d['notes'][] = $e->getMessage(); }
        return $d;
    }

    public function createParcel(Parcel $p): ShipmentResult
    {
        $w = $p->legacyWilaya();
        $pc = $this->profileCommune($w, $p->commune, $p->wilayaName());
        if ($pc['block'] !== null) { return new ShipmentResult(false, error: $pc['block']); }
        if ($pc['id'] !== null) { $m = ['id' => $pc['id'], 'name' => (string)$pc['name']]; }          // معرّف البلدية جاهز من ملف المعايرة
        else {
            $list = $this->communes($w);
            if (!$list) { return new ShipmentResult(false, error: 'تعذّر جلب بلديات ولاية ' . $w . ' من Maystro (راجع المفتاح أو أعد المحاولة)'); }
            $m = CommuneMatcher::best($list, $p->commune);
            if (!$m) { return new ShipmentResult(false, error: 'بلدية «' . $p->commune . '» غير موجودة عند Maystro في ' . $p->wilayaName() . ' — الأقرب: ' . implode('، ', CommuneMatcher::suggest($list, $p->commune))); }
        }
        $v1 = ($this->cred['scheme'] ?? 'v2') === 'v1';
        $price = (($this->cred['priceMode'] ?? 'items') === 'total') ? (int)round($p->total) : $p->priceWithoutShipping();
        $r = $this->send('POST', self::BASE . '/stores/orders/', $this->h(), [
            'wilaya' => $w, 'commune' => (int)$m['id'], 'destination_text' => $p->address !== '' ? mb_substr($p->address, 0, 255) : $p->commune,
            'customer_name' => $p->name, 'customer_phone' => $p->localPhone(), 'product_price' => $price,
            'delivery_type' => $v1 ? ($p->stopDesk ? 1 : 0) : ($p->stopDesk ? 2 : 1), 'express' => false, 'note_to_driver' => mb_substr($p->note, 0, 250),
            'products' => [['logistical_description' => $p->productsText() ?: 'Produit', 'quantity' => 1]], 'source' => 4, 'external_order_id' => $p->orderRef,
        ]);
        $j = $r->json() ?? [];
        if (array_is_list($j) && isset($j[0]) && is_array($j[0])) { $j = $j[0]; }
        $id = self::pick($j, 'id', 'order_id');
        if ($r->ok() && $id !== '') { return new ShipmentResult(true, $id, null, '', $j); }
        $code = (int)($j['code'] ?? $j['error_code'] ?? 0);
        $known = [40 => 'الولاية أو البلدية غير موجودة عند Maystro', 45 => 'هذا النوع من التوصيل غير متاح في هذه البلدية', 50 => 'منتجات الطلب غير صالحة'];
        return new ShipmentResult(false, error: trim(($known[$code] ?? '') . ' ' . self::pick($j, 'detail', 'message', 'error')) ?: ('HTTP ' . $r->status), raw: $j);
    }

    public function trackParcel(string $tracking): TrackingResult
    {
        $j = $this->send('GET', self::BASE . '/stores/orders/' . rawurlencode($tracking) . '/', $this->h())->json() ?? [];
        $raw = self::pick($j, 'status', 'status_name', 'state');
        if ($raw === '') { throw new CarrierApiException('حالة الطرد غير موجودة في ردّ الشركة'); }
        return new TrackingResult($tracking, $raw, $this->mapStatus($raw), $j);
    }

    /** إلغاء بتغيير الحالة إلى 50 (مصدر واحد: dzcouriers) — يُعدّ ناجحاً بردّ 2xx فقط. */
    public function cancelParcel(string $tracking): bool
    {
        return $this->send('PATCH', self::BASE . '/orders/' . rawurlencode($tracking) . '/status/', $this->h(), ['status' => 50])->ok();
    }
}
