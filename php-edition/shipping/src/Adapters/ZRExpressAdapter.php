<?php
declare(strict_types=1);
namespace Alyssum\Shipping\Adapters;

use Alyssum\Shipping\{AbstractAdapter, CarrierApiException, Parcel, ShipmentResult, TrackingResult};

/**
 * ZR Express — تعمل على منصة Procolis (https://procolis.com/api_v1، ترويستا token/key).
 * ⚠️ تجريبي: صيغة الإضافة مأخوذة من تكامل اللوحة الحالي؛ مسار القراءة /lire وصيغة ردّه غير مؤكَّدين مع حساب حقيقي.
 */
final class ZRExpressAdapter extends AbstractAdapter
{
    public const BASE = 'https://procolis.com/api_v1';

    public function code(): string { return 'zrexpress'; }

    public static function credentialFields(): array
    {
        return [['key' => 'token', 'label' => 'Token', 'secret' => true], ['key' => 'key', 'label' => 'Key', 'secret' => true]];
    }

    private function h(): array { return ['token' => $this->cred['token'], 'key' => $this->cred['key'], 'Content-Type' => 'application/json']; }

    public function createParcel(Parcel $p): ShipmentResult
    {
        $row = [
            'Tracking' => $p->orderRef, 'TypeLivraison' => $p->stopDesk ? '1' : '0', 'TypeColis' => '0', 'Confrimee' => '1',   // «Confrimee» تهجئة الشركة نفسها
            'Client' => $p->name, 'MobileA' => $p->localPhone(), 'MobileB' => $p->phone2 !== '' ? $p->localPhone($p->phone2) : '',
            'Adresse' => $p->address !== '' ? $p->address : $p->wilayaName(), 'IDWilaya' => (string)$p->legacyWilaya(), 'Commune' => $p->commune,
            'Total' => (string)(int)round($p->total), 'Note' => $p->note, 'TProduit' => $p->productsText(),
        ];
        $r = $this->send('POST', self::BASE . '/add_colis', $this->h(), ['Colis' => [$row]]);
        $j = $r->json() ?? [];
        $first = $j['Colis'][0] ?? $j[0] ?? $j;
        $trk = self::pick(is_array($first) ? $first : [], 'Tracking', 'tracking', 'tracking_code');
        $ok = $r->ok() && $trk !== '' && !preg_match('/erreur|error|fail/i', self::pick(is_array($first) ? $first : [], 'MessageRetour', 'message', 'status'));
        return $ok ? new ShipmentResult(true, $trk, null, '', $j) : new ShipmentResult(false, error: self::pick(is_array($first) ? $first : $j, 'MessageRetour', 'message', 'error') ?: ('HTTP ' . $r->status), raw: $j);
    }

    public function trackParcel(string $tracking): TrackingResult
    {
        $r = $this->send('POST', self::BASE . '/lire', $this->h(), ['Colis' => [['Tracking' => $tracking]]]);
        $j = $r->json() ?? [];
        $row = $j['Colis'][0] ?? $j[0] ?? $j;
        $raw = self::pick(is_array($row) ? $row : [], 'Situation', 'situation', 'Statut', 'status');
        if ($raw === '') { throw new CarrierApiException('حالة الطرد غير موجودة في ردّ الشركة'); }
        return new TrackingResult($tracking, $raw, $this->mapStatus($raw), $j);
    }
}
