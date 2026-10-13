<?php
declare(strict_types=1);
namespace Alyssum\Shipping\Adapters;

use Alyssum\Shipping\{AbstractAdapter, CarrierApiException, Parcel, ShipmentResult, TrackingResult};

/**
 * ZR Express (واجهة Procolis القديمة https://procolis.com/api_v1، ترويستا token/key): add_colis / lire / token.
 * الصيغة من مستودعات عامة متفقة (لا وثيقة رسمية): Tracking فارغ لتولّد الشركة رقمه، id_Externe = رقم طلبنا، الرفض يعود HTTP 200 مع
 * MessageRetour (Good نجاح، Double Tracking مكرّر)، والحالة في Situation. لا إلغاء ولا بوليصة في هذه الواجهة (من لوحة الشركة).
 * ملاحظة: ZR أطلقت منصة جديدة (api.zrexpress.app بترويستي X-Api-Key وX-Tenant ومعرّفات UUID للأقاليم) لم يُبنَ لها محوّل بعد.
 * ⚠️ لم يُجرَّب على حساب حقيقي؛ المطابقة تُختبر بمحاكٍ صارم مبنيّ على المستودعات العامة.
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

    public function ping(): array
    {
        return $this->probe(function (): array {
            $r = $this->send('GET', self::BASE . '/token', $this->h());
            $j = $r->json() ?? [];
            $s = self::pick($j, 'Statut', 'statut', 'status');
            if ($r->ok() && preg_match('/acc[eè]s activ/iu', $s)) { return [true, 'المفاتيح صالحة']; }
            return $r->ok() ? [false, 'الحساب غير مفعّل للواجهة البرمجية: ' . ($s ?: 'ردّ فارغ')] : [null, 'ردّ غير متوقع (HTTP ' . $r->status . ')'];
        });
    }

    public function discover(array $wilayas, array $want = []): array
    {
        return self::emptyDiscovery(['ZR Express (Procolis) لا توفّر واجهة قراءة للبلديات أو الطرود: تُتحقَّق الحساب بفحص المفاتيح فقط']);
    }

    public function createParcel(Parcel $p): ShipmentResult
    {
        $row = [
            'Tracking' => '', 'TypeLivraison' => $p->stopDesk ? '1' : '0', 'TypeColis' => '0', 'Confrimee' => '1',   // «Confrimee» تهجئة الشركة نفسها
            'Client' => $p->name, 'MobileA' => $p->localPhone(), 'MobileB' => $p->phone2 !== '' ? $p->localPhone($p->phone2) : '',
            'Adresse' => $p->address !== '' ? $p->address : $p->commune, 'IDWilaya' => (string)$p->legacyWilaya(), 'Commune' => $p->commune,
            'Total' => (string)(int)round($p->total), 'Note' => mb_substr($p->note, 0, 250), 'TProduit' => $p->productsText(250),
            'id_Externe' => $p->orderRef, 'Source' => 'Alyssum',
        ];
        $r = $this->send('POST', self::BASE . '/add_colis', $this->h(), ['Colis' => [$row]]);
        $j = $r->json() ?? [];
        $first = is_array($j['Colis'][0] ?? null) ? $j['Colis'][0] : (is_array($j[0] ?? null) ? $j[0] : $j);
        $trk = self::pick($first, 'Tracking', 'tracking', 'tracking_code');
        $msg = self::pick($first, 'MessageRetour', 'message', 'status');
        if ($msg === 'Double Tracking') { return new ShipmentResult(false, error: 'طرد مكرّر عند ZR (Double Tracking) — لا يُرسل ثانية', raw: $j); }
        $ok = $r->ok() && $trk !== '' && ($msg === '' || strcasecmp($msg, 'Good') === 0);
        return $ok ? new ShipmentResult(true, $trk, null, '', $j) : new ShipmentResult(false, error: $msg ?: ('HTTP ' . $r->status), raw: $j);
    }

    public function trackParcel(string $tracking): TrackingResult
    {
        $r = $this->send('POST', self::BASE . '/lire', $this->h(), ['Colis' => [['Tracking' => $tracking]]]);
        $body = trim($r->body ?? '');
        if ($body === 'null' || $body === '') { throw new CarrierApiException('لم تجد الشركة هذا الطرد'); }
        $j = $r->json() ?? [];
        $row = $j['Colis'][0] ?? $j[0] ?? $j;
        $raw = self::pick(is_array($row) ? $row : [], 'Situation', 'situation', 'Statut', 'status');
        if ($raw === '') { throw new CarrierApiException('حالة الطرد غير موجودة في ردّ الشركة'); }
        return new TrackingResult($tracking, $raw, $this->mapStatus($raw), $j);
    }
}
