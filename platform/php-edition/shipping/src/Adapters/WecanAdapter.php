<?php
declare(strict_types=1);
namespace Alyssum\Shipping\Adapters;

use Alyssum\Shipping\{AbstractAdapter, CarrierApiException, Parcel, ShipmentResult, TrackingResult, WebhookEvent, WilayaCatalog};

/**
 * WeCan Service — واجهة الطرود POST /api/v1/parcels (مصفوفة طرود بصيغة ياليدين) فتدخل الطلب «Commandes» عندهم.
 * (POST /orders ينشئ «Commandes d'entrepôt» لحسابات المخزن فلا يُستعمل.) مُتحقَّق منها بقراءة حساب حقيقي وبمواصفاتهم الرسمية
 * https://wecanservices.com/docs/api.json ؛ إنشاء الطرد الفعلي جُرّب من لوحة التحكم. الحالات من قاموس ياليدين (last_status بالفرنسية).
 */
final class WecanAdapter extends AbstractAdapter
{
    public const BASE = 'https://wecanservices.com/api/v1';

    public function code(): string { return 'wecan'; }
    protected function statusFamily(): string { return 'yalidine'; }

    public static function credentialFields(): array
    {
        return [
            ['key' => 'apiKey', 'label' => 'X-API-Key', 'secret' => false],
            ['key' => 'apiSecret', 'label' => 'X-API-Secret', 'secret' => true],
            ['key' => 'fromWilaya', 'label' => 'ولاية الانطلاق (مثال: Alger)', 'secret' => false, 'required' => false],
            ['key' => 'webhookSecret', 'label' => 'سرّ توقيع الـwebhook (اختياري)', 'secret' => true, 'required' => false],
        ];
    }

    private function h(bool $json = false): array
    {
        $h = ['X-API-Key' => $this->cred['apiKey'], 'X-API-Secret' => $this->cred['apiSecret'], 'Accept' => 'application/json'];
        return $json ? $h + ['Content-Type' => 'application/json'] : $h;
    }

    public function createParcel(Parcel $p): ShipmentResult
    {
        [$first, $family] = $p->nameParts();
        $price = $p->priceWithoutShipping();                                     // WeCan: Sous-total = price ثم تضيف «Frais de livraison» من تعريفتها فيطابق المجموع ما دفعه الزبون
        if ($p->stopDesk && !$p->deskId) { return new ShipmentResult(false, error: 'مكتب Stop Desk غير محدد'); }
        $pc = $this->profileCommune($p->legacyWilaya(), $p->commune, $p->wilayaName());
        if ($pc['block'] !== null) { return new ShipmentResult(false, error: $pc['block']); }
        $body = [
            'order_id' => $p->orderRef, 'firstname' => $first, 'familyname' => $family, 'contact_phone' => $p->localPhone(),
            'address' => $p->address !== '' ? $p->address : $p->commune . '، ' . $p->wilayaName(),
            'to_commune_name' => $pc['name'] ?? $p->commune, 'to_wilaya_name' => WilayaCatalog::name($p->legacyWilaya()),
            'product_list' => $p->productsText(), 'price' => $price, 'do_insurance' => false, 'declared_value' => $price,
            'freeshipping' => $p->shippingFee <= 0, 'delivery_fee' => max(0, (int)$p->shippingFee), 'shipping_type' => $p->stopDesk ? 'express_desk' : 'express_home',
            'is_stopdesk' => $p->stopDesk, 'has_exchange' => false, 'length' => 10, 'width' => 10, 'height' => 10, 'weight' => 1,
            'from_wilaya_name' => $this->cred['fromWilaya'] ?? 'Alger',
        ];
        if ($p->stopDesk) { $body['stopdesk_id'] = (int)$p->deskId; }
        $r = $this->send('POST', self::BASE . '/parcels', $this->h(true), [$body]);
        $j = $r->json() ?? [];
        $row = $j[$p->orderRef] ?? (is_array($j['data'] ?? null) ? ($j['data'][0] ?? null) : null) ?? [];
        $trk = (string)($row['tracking'] ?? '');
        if ($trk === '' && ($row['success'] ?? false) === true) { $trk = (string)($row['order_id'] ?? $p->orderRef); }   // «A vérifier»: بلا تتبع بعد ← نحفظ رقم الطلب
        if ($r->ok() && ($row['success'] ?? true) !== false && $trk !== '') { return new ShipmentResult(true, $trk, self::url($row['label'] ?? null), '', $j); }
        return new ShipmentResult(false, error: (string)($row['message'] ?? $j['message'] ?? ('HTTP ' . $r->status)), raw: $j);
    }

    public function trackParcel(string $tracking): TrackingResult
    {
        $r = $this->send('GET', self::BASE . '/parcels/' . rawurlencode($tracking), $this->h());
        $j = $r->json() ?? [];
        $d = isset($j['data'][0]) ? $j['data'][0] : $j;
        $raw = trim((string)($d['last_status'] ?? ''));
        if ($raw === '') { throw new CarrierApiException('حالة الطرد غير موجودة في ردّ الشركة'); }
        return new TrackingResult($tracking, $raw, $this->mapStatus($raw), $j);
    }

    public function cancelParcel(string $tracking): bool
    {
        return $this->send('DELETE', self::BASE . '/parcels/' . rawurlencode($tracking), $this->h())->ok();
    }

    public function labelUrl(string $tracking): ?string
    {
        $j = $this->send('GET', self::BASE . '/parcels/' . rawurlencode($tracking), $this->h())->json() ?? [];
        $d = isset($j['data'][0]) ? $j['data'][0] : $j;
        return self::url($d['label'] ?? null);
    }

    public function ping(): array
    {
        return $this->probe(function (): array {
            $r = $this->send('GET', self::BASE . '/locations/states', $this->h());
            return $r->ok() ? [true, 'المفاتيح صالحة'] : [null, 'ردّ غير متوقع (HTTP ' . $r->status . ')'];
        });
    }

    /** إشعار WeCan: JSON:API {data:{attributes:{tracking_number,status…}}} أو بصيغة ياليدين {tracking,last_status}. */
    public function parseWebhook(array $payload, array $headers): array
    {
        $items = isset($payload['data']) ? (array_is_list((array)$payload['data']) ? $payload['data'] : [$payload['data']]) : (array_is_list($payload) ? $payload : [$payload]);
        $out = [];
        foreach ($items as $it) {
            if (!is_array($it)) { continue; }
            $a = is_array($it['attributes'] ?? null) ? $it['attributes'] : $it;
            $trk = self::pick($a, 'tracking', 'tracking_number') ?: self::pick($it, 'tracking', 'tracking_number');
            $raw = trim((string)($a['last_status'] ?? $a['status'] ?? $it['last_status'] ?? ''));
            if ($trk !== '' && $raw !== '') { $out[] = new WebhookEvent($trk, $raw, $this->mapStatus($raw), self::pick($a, 'order_id', 'external_id'), $it); }
        }
        return $out;
    }

    private static function url(mixed $u): ?string { return is_string($u) && str_starts_with($u, 'https://') ? $u : null; }
}
