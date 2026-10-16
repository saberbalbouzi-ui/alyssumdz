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
            ['key' => 'webhookSecret', 'label' => 'المفتاح السرّي للـwebhook (من حسابك لدى الشركة، اختياري — للتحقق من توقيع الإشعارات)', 'secret' => true, 'required' => false],
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
        $pc = $this->profileCommune($p->legacyWilaya(), $p->commune, $p->wilayaName());                // تصحيح حسابك من المعايرة (إن وُجدت)
        if ($pc['block'] !== null) { return new ShipmentResult(false, error: $pc['block']); }
        $communeName = $pc['name'] ?? $p->commune;
        $known = $this->profile['desks'][(string)$p->legacyWilaya()] ?? null;
        if ($p->stopDesk && is_array($known) && $known && !in_array((string)$p->deskId, array_map(static fn($d) => (string)$d['id'], $known), true)) {
            return new ShipmentResult(false, error: 'مكتب Stop Desk رقم ' . $p->deskId . ' غير موجود عند الشركة في ' . $p->wilayaName() . ' (حسب معايرة حسابك)');
        }
        $body = [
            'order_id' => $p->orderRef, 'from_wilaya_name' => $this->cred['fromWilaya'] ?? 'Alger',
            'firstname' => $first, 'familyname' => $family, 'contact_phone' => $p->localPhone(),
            'address' => $p->address !== '' ? $p->address : $p->commune . '، ' . $p->wilayaName(),
            'to_commune_name' => $communeName, 'to_wilaya_name' => WilayaCatalog::name($p->legacyWilaya()),   // الجديدة تُرسَل باسم الأم
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

    /** @return list<array<string,mixed>> صفوف data عبر الصفحات (حدّ أقصى 6 صفحات) */
    private function pages(string $path, string $sep = '?'): array
    {
        $rows = [];
        for ($page = 1; $page <= 6; $page++) {
            $j = $this->getJson(self::BASE . $path . $sep . 'page_size=100&page=' . $page, $this->h());
            foreach ((array)($j['data'] ?? []) as $r) { if (is_array($r)) { $rows[] = $r; } }
            if (!($j['has_more'] ?? false)) { break; }
            $this->breath();
        }
        return $rows;
    }

    public function discover(array $wilayas, array $want = []): array
    {
        $d = self::emptyDiscovery();
        try {
            if ($want['communes'] ?? false) {
                foreach ($wilayas as $w) {
                    $this->breath();
                    $list = [];
                    foreach ($this->pages('/v1/communes/?wilaya_id=' . (int)$w, '&') as $r) {
                        $nm = trim((string)($r['name'] ?? '')); if ($nm === '') { continue; }
                        $dv = $r['is_deliverable'] ?? 1;
                        $list[] = ['name' => $nm, 'deliverable' => !($dv === 0 || $dv === false || $dv === '0')];
                    }
                    $d['communes'][(int)$w] = $list;
                }
            }
            if ($want['desks'] ?? false) {
                foreach ($wilayas as $w) {
                    $this->breath();
                    $list = [];
                    foreach ($this->pages('/v1/centers/?wilaya_id=' . (int)$w, '&') as $r) {
                        if (!isset($r['center_id'])) { continue; }
                        $list[] = ['id' => (string)$r['center_id'], 'name' => (string)($r['name'] ?? ''), 'commune' => (string)($r['commune_name'] ?? '')];
                    }
                    $d['desks'][(int)$w] = $list;
                }
            }
            if ($want['fees'] ?? false) {
                foreach ($this->pages('/v1/deliveryfees/') as $r) {
                    $id = (int)($r['wilaya_id'] ?? 0); if ($id < 1) { continue; }
                    $d['fees'][$id] = ['home' => (int)($r['home_fee'] ?? 0), 'stop' => (int)($r['desk_fee'] ?? $r['stop_fee'] ?? 0)];
                }
            }
            if ($want['statuses'] ?? false) {
                $j = $this->getJson(self::BASE . '/v1/parcels/?page_size=100&order_by=date_creation&order=desc', $this->h());
                foreach ((array)($j['data'] ?? []) as $r) {
                    if (!is_array($r)) { continue; }
                    $st = $this->statusText($r['last_status'] ?? '');
                    if ($st !== '') { $d['statuses'][$st] = ($d['statuses'][$st] ?? 0) + 1; }
                    $t = (string)($r['tracking'] ?? ''); if ($t !== '' && count($d['trackings']) < 3 && !in_array($t, $d['trackings'], true)) { $d['trackings'][] = $t; }
                }
            }
        } catch (CarrierApiException $e) { $d['notes'][] = $e->getMessage(); }
        return $d;
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
