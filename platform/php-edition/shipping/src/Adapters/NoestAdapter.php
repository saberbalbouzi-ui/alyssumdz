<?php
declare(strict_types=1);
namespace Alyssum\Shipping\Adapters;

use Alyssum\Shipping\{AbstractAdapter, CarrierApiException, CommuneMatcher, Parcel, ShipmentResult, StatusMapper, TrackingResult};

/**
 * NOEST Express — من نص وثيقة الشركة (apidoc): create/order بحقول client/phone/adresse/wilaya_id/commune/montant/produit/type_id/poids/stop_desk،
 * المصادقة Bearer + api_token + user_guid في الجسم، الطرد مسوّدة حتى valid/order (يُستدعى تلقائياً ما لم يُعطَّل)، والحالة من آخر event_key
 * غير الإداري في activity (قاموس data/status-dict.json). البلدية نصّ يجب أن يطابق تهجئة الشركة (يُصحَّح من get/communes).
 * ⚠️ لم يُجرَّب على حساب حقيقي؛ المطابقة تُختبر بمحاكٍ صارم مبنيّ على الوثيقة.
 */
final class NoestAdapter extends AbstractAdapter
{
    public const BASE = 'https://app.noest-dz.com/api/public';

    /** @var array<string,list<array{id:int|string,name:string}>> */
    private array $communes = [];

    public function code(): string { return 'noest'; }

    public static function credentialFields(): array
    {
        return [
            ['key' => 'apiToken', 'label' => 'api_token', 'secret' => true], ['key' => 'userGuid', 'label' => 'user_guid', 'secret' => true],
            ['key' => 'autoValidate', 'label' => 'تصديق الطرد تلقائياً بعد الإنشاء (1 افتراضي، 0 يبقى مسوّدة)', 'secret' => false, 'required' => false],
        ];
    }

    private function auth(array $extra = []): array { return ['api_token' => $this->cred['apiToken'], 'user_guid' => $this->cred['userGuid']] + $extra; }
    private function h(): array { return ['Authorization' => 'Bearer ' . $this->cred['apiToken'], 'Content-Type' => 'application/json', 'Accept' => 'application/json']; }

    public function ping(): array
    {
        return $this->probe(function (): array {
            $r = $this->send('GET', self::BASE . '/get/wilayas', $this->h());
            $j = $r->json();
            return $r->ok() && is_array($j) ? [true, 'المفتاح صالح'] : [null, 'ردّ غير متوقع (HTTP ' . $r->status . ')'];
        });
    }

    /** @return list<array{id:int|string,name:string}> */
    public function communes(int $wilaya): array
    {
        $key = substr(sha1($this->cred['apiToken']), 0, 10) . ':' . $wilaya;
        if (isset($this->communes[$key])) { return $this->communes[$key]; }
        try { $j = $this->send('GET', self::BASE . '/get/communes/' . $wilaya, $this->h())->json() ?? []; } catch (CarrierApiException) { return []; }
        $out = [];
        foreach ((array_is_list($j) ? $j : []) as $c) { if (is_array($c) && isset($c['nom'])) { $out[] = ['id' => (string)$c['nom'], 'name' => (string)$c['nom']]; } }
        return $this->communes[$key] = $out;
    }

    public function discover(array $wilayas, array $want = []): array
    {
        $d = self::emptyDiscovery(['NOEST لا تعرض مكاتبها ولا تعريفتها ولا قائمة طرودها عبر الواجهة العامة']);
        try {
            if ($want['communes'] ?? false) {
                foreach ($wilayas as $w) {
                    $this->breath();
                    $j = $this->getJson(self::BASE . '/get/communes/' . (int)$w, $this->h());
                    $list = [];
                    foreach ((array_is_list($j) ? $j : []) as $c) {
                        if (!is_array($c) || !isset($c['nom'])) { continue; }
                        $on = $c['is_active'] ?? 1;
                        $list[] = ['name' => (string)$c['nom'], 'deliverable' => !($on === 0 || $on === false || $on === '0')];
                    }
                    $d['communes'][(int)$w] = $list;
                }
            }
        } catch (CarrierApiException $e) { $d['notes'][] = $e->getMessage(); }
        return $d;
    }

    public function createParcel(Parcel $p): ShipmentResult
    {
        if ($p->stopDesk && $p->deskCode === '') { return new ShipmentResult(false, error: 'NOEST يحتاج رمز مكتب Stop Desk (station_code مثل 16A) — اختر المكتب أو أرسل للمنزل'); }
        $pc = $this->profileCommune($p->legacyWilaya(), $p->commune, $p->wilayaName());
        if ($pc['block'] !== null) { return new ShipmentResult(false, error: $pc['block']); }
        $commune = $p->commune;
        if ($pc['name'] !== null) { $commune = (string)$pc['name']; }
        else {
            $list = $this->communes($p->legacyWilaya());
            if ($list) {                                                          // القائمة متاحة: التهجئة تُصحَّح أو يُرفض الطلب بوضوح (الاسم حساس لدى الشركة)
                $m = CommuneMatcher::best($list, $p->commune);
                if (!$m) { return new ShipmentResult(false, error: 'بلدية «' . $p->commune . '» غير موجودة عند NOEST في ' . $p->wilayaName() . ' — الأقرب: ' . implode('، ', CommuneMatcher::suggest($list, $p->commune))); }
                $commune = (string)$m['name'];
            }
        }
        $body = $this->auth([
            'reference' => $p->orderRef, 'client' => $p->name, 'phone' => $p->localPhone(), 'adresse' => $p->address !== '' ? mb_substr($p->address, 0, 255) : $p->commune,
            'wilaya_id' => $p->legacyWilaya(), 'commune' => $commune, 'montant' => (int)round($p->total), 'produit' => mb_substr($p->productsText() ?: 'Produit', 0, 255),
            'type_id' => 1, 'poids' => 1, 'stop_desk' => $p->stopDesk ? 1 : 0, 'can_open' => $p->canOpen ? 1 : 0, 'stock' => 0,
        ]);
        if ($p->phone2 !== '') { $body['phone_2'] = $p->localPhone($p->phone2); }
        if ($p->note !== '') { $body['remarque'] = mb_substr($p->note, 0, 255); }
        if ($p->stopDesk) { $body['station_code'] = $p->deskCode; }
        $r = $this->send('POST', self::BASE . '/create/order', $this->h(), $body);
        $j = $r->json() ?? [];
        $trk = self::pick($j, 'tracking', 'tracking_number');
        if ($r->ok() && $trk !== '' && ($j['success'] ?? true) !== false) {
            $warn = '';
            if (($this->cred['autoValidate'] ?? '1') !== '0') {
                $v = $this->send('POST', self::BASE . '/valid/order', $this->h(), $this->auth(['tracking' => $trk]));
                $vj = $v->json() ?? [];
                if (!$v->ok() || ($vj['success'] ?? true) === false) { $warn = 'أُنشئ الطرد لكن لم يُصدَّق عند الشركة: ' . (self::pick($vj, 'message') ?: 'HTTP ' . $v->status); }
            }
            return new ShipmentResult(true, $trk, null, $warn, $j);
        }
        $msg = self::pick($j, 'message', 'error') . (isset($j['errors']) ? ' — ' . json_encode($j['errors'], JSON_UNESCAPED_UNICODE) : '');
        return new ShipmentResult(false, error: trim($msg) ?: ('HTTP ' . $r->status), raw: $j);
    }

    public function trackParcel(string $tracking): TrackingResult
    {
        $j = $this->send('POST', self::BASE . '/get/trackings/info', $this->h(), $this->auth(['trackings' => [$tracking]]))->json() ?? [];
        if (isset($j['message']) && !isset($j[$tracking])) { throw new CarrierApiException('لم تجد الشركة الطرد: ' . self::pick($j, 'message')); }
        $row = $j[$tracking] ?? $j['data'][0] ?? $j[0] ?? $j;
        $a = is_array($row) ? ($row['activity'] ?? null) : null;
        $raw = '';
        if (is_array($a)) {
            foreach (array_reverse(array_values($a)) as $ev) {                          // آخر حدث يمثل حالة الطرد (لا حدث مالي/إداري)
                $k = self::pick(is_array($ev) ? $ev : [], 'event_key', 'status', 'event');
                if ($k !== '' && StatusMapper::explain('noest', $k)[0] !== 'ignore') { $raw = $k; break; }
            }
        }
        if ($raw === '') { throw new CarrierApiException('حالة الطرد غير موجودة في ردّ الشركة'); }
        return new TrackingResult($tracking, $raw, $this->mapStatus($raw), $j);
    }

    /** يحذف الطرد؛ مسموح قبل التصديق فقط (بعده ترفضه الشركة فيعود false). */
    public function cancelParcel(string $tracking): bool
    {
        $r = $this->send('POST', self::BASE . '/delete/order', $this->h(), $this->auth(['tracking' => $tracking]));
        $j = $r->json() ?? [];
        return $r->ok() && ($j['success'] ?? true) !== false;
    }
}
