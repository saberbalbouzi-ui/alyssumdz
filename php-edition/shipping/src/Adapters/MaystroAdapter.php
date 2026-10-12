<?php
declare(strict_types=1);
namespace Alyssum\Shipping\Adapters;

use Alyssum\Shipping\{AbstractAdapter, CarrierApiException, Parcel, ShipmentResult, TrackingResult};

/**
 * Maystro Delivery — Authorization: Token <key>.
 * ⚠️ تجريبي: الحقول مأخوذة من تكامل اللوحة الحالي؛ الشركة تطلب غالباً معرّفات ولاية/بلدية رقمية خاصة بها
 * (تُمرَّر عبر Parcel::note أو تُترجم لاحقاً من جدول تطابق) فتحقّق منها مع دعم Maystro قبل الاعتماد.
 */
final class MaystroAdapter extends AbstractAdapter
{
    public const BASE = 'https://backend.maystro-delivery.com/api';

    public function code(): string { return 'maystro'; }

    public static function credentialFields(): array { return [['key' => 'apiKey', 'label' => 'API Key', 'secret' => true]]; }

    private function h(): array { return ['Authorization' => 'Token ' . $this->cred['apiKey'], 'Content-Type' => 'application/json']; }

    public function createParcel(Parcel $p): ShipmentResult
    {
        $r = $this->send('POST', self::BASE . '/stores/orders/', $this->h(), [
            'external_order_id' => $p->orderRef, 'customer_name' => $p->name, 'customer_phone' => $p->localPhone(),
            'wilaya' => $p->wilayaCode, 'commune' => $p->commune, 'destination_text' => $p->address !== '' ? $p->address : $p->wilayaName(),
            'product_price' => (int)round($p->total), 'delivery_type' => $p->stopDesk ? 1 : 0, 'note_to_driver' => $p->note, 'product_name' => $p->productsText(),
        ]);
        $j = $r->json() ?? [];
        $trk = self::pick($j, 'display_id', 'tracking', 'id', 'order_id');
        return $r->ok() && $trk !== '' ? new ShipmentResult(true, $trk, null, '', $j) : new ShipmentResult(false, error: self::pick($j, 'detail', 'message', 'error') ?: ('HTTP ' . $r->status), raw: $j);
    }

    public function trackParcel(string $tracking): TrackingResult
    {
        $j = $this->send('GET', self::BASE . '/stores/orders/' . rawurlencode($tracking) . '/', $this->h())->json() ?? [];
        $raw = self::pick($j, 'status_name', 'status', 'state');
        if ($raw === '') { throw new CarrierApiException('حالة الطرد غير موجودة في ردّ الشركة'); }
        return new TrackingResult($tracking, $raw, $this->mapStatus($raw), $j);
    }
}
