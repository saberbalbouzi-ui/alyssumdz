<?php
declare(strict_types=1);
namespace Alyssum\Shipping\Adapters;

use Alyssum\Shipping\{AbstractAdapter, CarrierApiException, Parcel, ShipmentResult, Status, TrackingResult, WebhookEvent, WilayaCatalog};

/** Yalidine — واجهة v1/parcels الرسمية (مبنية على التوثيق وعلى تكامل اللوحة الحالي؛ لم تُجرَّب على حساب حقيقي من هذه الوحدة). */
final class YalidineAdapter extends AbstractAdapter
{
    public const BASE = 'https://api.yalidine.app';

    public function code(): string { return 'yalidine'; }

    public static function credentialFields(): array
    {
        return [
            ['key' => 'apiId', 'label' => 'API ID', 'secret' => false],
            ['key' => 'apiToken', 'label' => 'API Token', 'secret' => true],
            ['key' => 'fromWilaya', 'label' => 'ولاية الانطلاق (مثال: Alger)', 'secret' => false, 'required' => false],
        ];
    }

    private function h(bool $json = false): array
    {
        $h = ['X-API-ID' => $this->cred['apiId'], 'X-API-TOKEN' => $this->cred['apiToken']];
        return $json ? $h + ['Content-Type' => 'application/json'] : $h;
    }

    public function createParcel(Parcel $p): ShipmentResult
    {
        [$first, $family] = $p->nameParts();
        $price = $p->priceWithoutShipping();
        if ($p->stopDesk && !$p->deskId) { return new ShipmentResult(false, error: 'مكتب Stop Desk غير محدد'); }
        $body = [
            'order_id' => $p->orderRef, 'from_wilaya_name' => $this->cred['fromWilaya'] ?? 'Alger',
            'firstname' => $first, 'familyname' => $family, 'contact_phone' => $p->localPhone(),
            'address' => $p->address !== '' ? $p->address : $p->commune . '، ' . $p->wilayaName(),
            'to_commune_name' => $p->commune, 'to_wilaya_name' => WilayaCatalog::name($p->legacyWilaya()),   // الجديدة تُرسَل باسم الأم
            'product_list' => $p->productsText(), 'price' => $price, 'do_insurance' => true, 'declared_value' => $price,
            'freeshipping' => $p->shippingFee <= 0, 'is_stopdesk' => $p->stopDesk, 'has_exchange' => false, 'can_open' => $p->canOpen, 'weight' => 1,
        ];
        if ($p->stopDesk) { $body['stopdesk_id'] = $p->deskId; }
        $r = $this->send('POST', self::BASE . '/v1/parcels/', $this->h(true), [$body]);
        $j = $r->json() ?? [];
        $row = $j[$p->orderRef] ?? (is_array($j['data'] ?? null) ? ($j['data'][0] ?? null) : null) ?? [];
        $trk = (string)($row['tracking'] ?? '');
        if ($r->ok() && ($row['success'] ?? true) !== false && $trk !== '') { return new ShipmentResult(true, $trk, self::url($row['label'] ?? null), '', $j); }
        return new ShipmentResult(false, error: (string)($row['message'] ?? ('HTTP ' . $r->status)), raw: $j);
    }

    public function trackParcel(string $tracking): TrackingResult
    {
        $r = $this->send('GET', self::BASE . '/v1/parcels/' . rawurlencode($tracking), $this->h());
        $j = $r->json() ?? [];
        $d = isset($j['data'][0]) ? $j['data'][0] : $j;
        $raw = $this->statusText($d['last_status'] ?? '');
        if ($raw === '') { throw new CarrierApiException('حالة الطرد غير موجودة في ردّ الشركة'); }
        return new TrackingResult($tracking, $raw, $this->mapStatus($raw), $j);
    }

    public function cancelParcel(string $tracking): bool
    {
        $r = $this->send('DELETE', self::BASE . '/v1/parcels/' . rawurlencode($tracking), $this->h());
        return $r->ok();
    }

    public function labelUrl(string $tracking): ?string
    {
        $j = $this->send('GET', self::BASE . '/v1/parcels/' . rawurlencode($tracking), $this->h())->json() ?? [];
        $d = isset($j['data'][0]) ? $j['data'][0] : $j;
        return self::url($d['label'] ?? $d['labels'] ?? null);
    }

    public function ping(): array
    {
        return $this->probe(function (): array {
            $r = $this->send('GET', self::BASE . '/v1/wilayas/?page_size=1', $this->h());
            return $r->ok() ? [true, 'المفاتيح صالحة'] : [null, 'ردّ غير متوقع (HTTP ' . $r->status . ')'];
        });
    }

    public function wilayas(): array
    {
        $j = $this->send('GET', self::BASE . '/v1/wilayas/?page_size=100', $this->h())->json() ?? [];
        $out = [];
        foreach ((array)($j['data'] ?? []) as $w) { if (isset($w['id'])) { $out[] = ['code' => (int)$w['id'], 'name' => (string)($w['name'] ?? ''), 'parent' => null]; } }
        return $out ?: parent::wilayas();
    }

    /** Webhook ياليدين: {type: parcel_status_updated, data: [...]} أو كائن؛ الحالة في last_status. */
    public function parseWebhook(array $payload, array $headers): array
    {
        $type = (string)($payload['type'] ?? $payload['event'] ?? $payload['event_type'] ?? '');
        if ($type !== '' && !in_array($type, ['parcel_status_updated', 'parcel_payment_updated', 'parcel_edited'], true)) { return []; }
        $items = isset($payload['data']) ? (array_is_list((array)$payload['data']) ? $payload['data'] : [$payload['data']]) : (array_is_list($payload) ? $payload : [$payload]);
        $out = [];
        foreach ($items as $it) {
            if (!is_array($it)) { continue; }
            $trk = self::pick($it, 'tracking', 'tracking_number') ?: self::pick($it['parcel'] ?? [], 'tracking');
            $raw = $this->statusText($it['last_status'] ?? $it['status'] ?? $it['event_status'] ?? ($it['parcel']['last_status'] ?? ($payload['last_status'] ?? $payload['status'] ?? '')));
            if ($trk !== '' && $raw !== '') { $out[] = new WebhookEvent($trk, $raw, $this->mapStatus($raw), self::pick($it, 'order_id'), $it); }
        }
        return $out;
    }

    private function statusText(mixed $v): string
    {
        if (is_array($v)) { return trim((string)($v['name'] ?? $v['label'] ?? '')); }
        return trim((string)$v);
    }

    private static function url(mixed $u): ?string { return is_string($u) && str_starts_with($u, 'https://') ? $u : null; }
}
