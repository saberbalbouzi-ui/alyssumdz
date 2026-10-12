<?php
declare(strict_types=1);
namespace Alyssum\Shipping\Adapters;

use Alyssum\Shipping\{AbstractAdapter, CarrierApiException, Parcel, ShipmentResult, TrackingResult};

/**
 * NOEST Express — api_token + user_guid داخل جسم JSON.
 * ⚠️ تجريبي: مسار الإنشاء من تكامل اللوحة الحالي؛ مسارات التتبع/الإلغاء/البوليصة مبنية على النمط المعتاد للشركة وغير مؤكَّدة.
 */
final class NoestAdapter extends AbstractAdapter
{
    public const BASE = 'https://app.noest-dz.com/api/public';

    public function code(): string { return 'noest'; }

    public static function credentialFields(): array
    {
        return [['key' => 'apiToken', 'label' => 'api_token', 'secret' => true], ['key' => 'userGuid', 'label' => 'user_guid', 'secret' => true]];
    }

    private function auth(array $extra = []): array { return ['api_token' => $this->cred['apiToken'], 'user_guid' => $this->cred['userGuid']] + $extra; }

    public function createParcel(Parcel $p): ShipmentResult
    {
        $r = $this->send('POST', self::BASE . '/create/order', ['Content-Type' => 'application/json'], $this->auth([
            'reference' => $p->orderRef, 'client' => $p->name, 'phone' => $p->localPhone(), 'phone_2' => $p->phone2 !== '' ? $p->localPhone($p->phone2) : '',
            'adresse' => $p->address !== '' ? $p->address : $p->wilayaName(), 'wilaya_id' => $p->legacyWilaya(), 'commune' => $p->commune,
            'montant' => (int)round($p->total), 'produit' => $p->productsText(), 'remarque' => $p->note, 'stop_desk' => $p->stopDesk ? 1 : 0, 'stock' => 0,
        ]));
        $j = $r->json() ?? [];
        $trk = self::pick($j, 'tracking', 'tracking_number');
        return $r->ok() && $trk !== '' && ($j['success'] ?? true) !== false ? new ShipmentResult(true, $trk, null, '', $j) : new ShipmentResult(false, error: self::pick($j, 'message', 'error') ?: ('HTTP ' . $r->status), raw: $j);
    }

    public function trackParcel(string $tracking): TrackingResult
    {
        $j = $this->send('POST', self::BASE . '/get/trackings/info', ['Content-Type' => 'application/json'], $this->auth(['trackings' => [$tracking]]))->json() ?? [];
        $row = $j[$tracking] ?? $j['data'][0] ?? $j[0] ?? $j;
        $a = is_array($row) ? ($row['activity'] ?? null) : null;
        $last = is_array($a) && $a ? end($a) : null;
        $raw = self::pick(is_array($last) ? $last : [], 'status', 'event') ?: self::pick(is_array($row) ? $row : [], 'status', 'last_status');
        if ($raw === '') { throw new CarrierApiException('حالة الطرد غير موجودة في ردّ الشركة'); }
        return new TrackingResult($tracking, $raw, $this->mapStatus($raw), $j);
    }

    public function cancelParcel(string $tracking): bool
    {
        return $this->send('POST', self::BASE . '/delete/order', ['Content-Type' => 'application/json'], $this->auth(['tracking' => $tracking]))->ok();
    }
}
