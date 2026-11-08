<?php
declare(strict_types=1);
namespace Alyssum\Shipping\Adapters;

use Alyssum\Shipping\{AbstractAdapter, CarrierApiException, CommuneMatcher, Parcel, ShipmentResult, StatusMapper, TrackingResult, WebhookEvent};

/**
 * ZR Express — المنصة الجديدة (api.zrexpress.app): ترويستا X-Api-Key وX-Tenant. الولاية والبلدية معرّفات UUID من territories/search،
 * الإنشاء POST /parcels (201 يعيد id فقط ← نجلب trackingNumber)، والطرد يُنشأ «استلام الطلب» حتى يُمرَّر stateId الجاهز للإرسال من workflows/search.
 * نقاط الاستلام (Stop Desk): deliveryType=pickup-point مع hubId من hubs/search. التعريفة من delivery-pricing/rates، والبوليصة من parcels/labels/individual.
 * مُتحقَّق منها من لوحة التحكم على حساب حقيقي (القراءة والبحث والبوليصة)؛ هذه النسخة تطابق سلوك بوابة JS (اختبار المطابقة).
 */
final class ZRExpressAppAdapter extends AbstractAdapter
{
    public const BASE = 'https://api.zrexpress.app/api/v1';

    /** @var list<array{id:string,code:mixed,name:string,level:string,parentId:?string}>|null */
    private ?array $terr = null;
    private string|false|null $ready = null;

    public function code(): string { return 'zrexpress_app'; }
    protected function statusFamily(): string { return 'zrexpress'; }

    public static function credentialFields(): array
    {
        return [
            ['key' => 'apiKey', 'label' => 'X-Api-Key (اللوحة ← API Rest ← Token API)', 'secret' => true],
            ['key' => 'tenant', 'label' => 'X-Tenant (معرّف الحساب)', 'secret' => false],
            ['key' => 'autoDispatch', 'label' => 'جعل الطرد «جاهز للإرسال» تلقائياً بعد إنشائه (1 افتراضي، 0 يبقى «استلام الطلب»)', 'secret' => false, 'required' => false],
            ['key' => 'webhookSecret', 'label' => 'سرّ توقيع الـwebhook (whsec_… من لوحة ZR، اختياري — للتحقق من توقيع الإشعارات)', 'secret' => true, 'required' => false],
        ];
    }

    /** توقيع Svix: HMAC-SHA256(مفتاح whsec مفكوك base64، "{id}.{ts}.{body}") ← "v1,<base64>"؛ المهلة 10 دقائق ضد إعادة الإرسال. null = لا سرّ مضبوط. */
    public function verifyWebhook(string $rawBody, array $headers): ?bool
    {
        $secret = (string)($this->cred['webhookSecret'] ?? ''); if ($secret === '') { return null; }
        $id = (string)($headers['svix-id'] ?? ''); $ts = (string)($headers['svix-timestamp'] ?? ''); $sigs = (string)($headers['svix-signature'] ?? '');
        if ($id === '' || $ts === '' || $sigs === '' || abs(time() - (float)$ts) > 600) { return false; }
        $key = base64_decode(preg_replace('/^whsec_/', '', $secret), true); if ($key === false) { return false; }
        $mac = base64_encode(hash_hmac('sha256', "$id.$ts.$rawBody", $key, true));
        foreach (explode(' ', $sigs) as $x) { if (hash_equals($mac, preg_replace('/^v1,/', '', $x))) { return true; } }
        return false;
    }

    private function h(): array { return ['X-Api-Key' => $this->cred['apiKey'], 'X-Tenant' => $this->cred['tenant'], 'Content-Type' => 'application/json', 'Accept' => 'application/json']; }

    /** «Commande reçue» (OrderReceived) هي حالة ZR الأولى قبل الجاهزية: قيد الانتظار. */
    public function mapStatus(string $rawStatus): string
    {
        if (preg_match('/^(commande recue|order ?received)$/', StatusMapper::normalize($rawStatus))) { return 'pending'; }
        return parent::mapStatus($rawStatus);
    }

    public function ping(): array
    {
        return $this->probe(function (): array {
            $r = $this->send('POST', self::BASE . '/territories/search', $this->h(), ['pageNumber' => 1, 'pageSize' => 1]);
            return $r->ok() ? [true, 'المفتاح صالح'] : [null, 'ردّ غير متوقع (HTTP ' . $r->status . ')'];
        });
    }

    /** كل الأقاليم (ولايات وبلديات) بصفحات 250 حتى hasNext=false (الواجهة تقصّ الصفحة عند 1000). */
    private function territories(): array
    {
        if ($this->terr !== null) { return $this->terr; }
        $rows = [];
        for ($page = 1; $page <= 15; $page++) {
            $j = $this->send('POST', self::BASE . '/territories/search', $this->h(), ['pageNumber' => $page, 'pageSize' => 250, 'orderBy' => ['code asc']])->json() ?? [];
            if (is_array($j['items'] ?? null)) { array_push($rows, ...$j['items']); }
            if (empty($j['hasNext']) || !is_array($j['items'] ?? null) || !$j['items']) { break; }
            $this->breath(150);
        }
        $list = [];
        foreach ($rows as $t) {
            if (!is_array($t) || empty($t['id'])) { continue; }
            $list[] = ['id' => (string)$t['id'], 'code' => $t['code'] ?? null, 'name' => (string)($t['name'] ?? ''), 'level' => strtolower((string)($t['level'] ?? '')), 'parentId' => !empty($t['parentId']) ? (string)$t['parentId'] : null];
        }
        return $this->terr = $list;
    }

    private static function isWilaya(array $t): bool { return (bool)preg_match('/wilaya|city|province/', $t['level']) || ($t['parentId'] === null && !preg_match('/commun|district/', $t['level'])); }

    private function wilayaOf(array $ts, Parcel $p): ?array
    {
        $ws = array_values(array_filter($ts, fn($t) => self::isWilaya($t)));
        foreach ($ws as $t) { if ((int)$t['code'] === $p->wilayaCode) { return $t; } }
        foreach ($ws as $t) { if ((int)$t['code'] === $p->legacyWilaya()) { return $t; } }
        foreach ($ws as $t) { if (self::ck($t['name']) === self::ck($p->wilayaName())) { return $t; } }
        return null;
    }

    public function discover(array $wilayas, array $want = []): array
    {
        $d = self::emptyDiscovery(['ZR Express الجديدة: الأقاليم تُجلب بطلب واحد؛ الطرود غير مقروءة بعد (تجريبي)']);
        try {
            $ts = ($want['communes'] ?? false) || ($want['desks'] ?? false) ? $this->territories() : [];
            if ($want['communes'] ?? false) {
                foreach ($wilayas as $w) {
                    $wt = null; foreach ($ts as $t) { if (self::isWilaya($t) && (int)$t['code'] === (int)$w) { $wt = $t; break; } }
                    if ($wt) { $d['communes'][(int)$w] = array_values(array_map(fn($t) => ['name' => $t['name'], 'id' => $t['id']], array_filter($ts, fn($t) => $t['parentId'] === $wt['id']))); }
                }
            }
            if ($want['desks'] ?? false) {                                                      // نقاط الاستلام: POST /hubs/search (id من نوع UUID يُرسل hubId)
                $ws = array_values(array_filter($ts, fn($t) => self::isWilaya($t)));
                $only = array_map('intval', $wilayas);
                foreach ($this->hubs() as $h) {
                    $a = (array)($h['address'] ?? []); $w = null;
                    foreach ($ts as $x) { if ($x['id'] === (string)($a['cityTerritoryId'] ?? '')) { $w = $x; break; } }
                    if (!($w && (int)$w['code'] >= 1 && (int)$w['code'] <= 58)) { $w = null; foreach ($ws as $x) { if (self::ck($x['name']) === self::ck((string)($a['city'] ?? ''))) { $w = $x; break; } } }
                    $wid = $w ? (int)$w['code'] : 0;
                    if ($wid < 1 || $wid > 58 || ($only && !in_array($wid, $only, true))) { continue; }
                    $d['desks'][$wid][] = ['id' => (string)$h['id'], 'name' => (string)($h['name'] ?? ''), 'commune' => (string)($a['district'] ?? $a['city'] ?? '')];
                }
            }
            if ($want['fees'] ?? false) {                                                       // تعريفة الحساب (مستوى الولاية؛ الجزائر 16 تُسعَّر ببلدياتها)
                $j = $this->send('GET', self::BASE . '/delivery-pricing/rates', $this->h())->json() ?? [];
                $communes = [];
                $px = function (array $r, string $t): int { foreach ((array)($r['deliveryPrices'] ?? []) as $x) { if (is_array($x) && ($x['deliveryType'] ?? null) === $t) { $v = (float)($x['discountedPrice'] ?? $x['price'] ?? 0); return $v > 0 ? (int)$v : 0; } } return 0; };
                foreach ((array)($j['rates'] ?? []) as $r) {
                    if (!is_array($r)) { continue; }
                    $lv = strtolower((string)($r['toTerritoryLevel'] ?? ''));
                    if ($lv === 'commune') { $communes[$px($r, 'home') . '/' . $px($r, 'pickup-point')] = true; continue; }
                    if ($lv !== 'wilaya') { continue; }
                    $id = (int)($r['toTerritoryCode'] ?? 0); if ($id < 1 || $id > 58) { continue; }
                    $home = $px($r, 'home'); $stop = $px($r, 'pickup-point');
                    if ($home || $stop) { $d['fees'][$id] = ['home' => $home ?: $stop, 'stop' => $stop ?: 0]; }
                }
                if (!isset($d['fees'][16]) && count($communes) === 1) { [$h, $s] = array_map('intval', explode('/', (string)array_key_first($communes))); if ($h || $s) { $d['fees'][16] = ['home' => $h ?: $s, 'stop' => $s ?: 0]; } }
            }
        } catch (CarrierApiException $e) { $d['notes'][] = $e->getMessage(); }
        return $d;
    }

    /** نقاط الاستلام المرئية: POST /hubs/search بصفحات 100. @return list<array<string,mixed>> */
    private function hubs(): array
    {
        $rows = [];
        for ($page = 1; $page <= 10; $page++) {
            $j = $this->send('POST', self::BASE . '/hubs/search', $this->h(), ['pageNumber' => $page, 'pageSize' => 100])->json() ?? [];
            foreach ((array)($j['items'] ?? []) as $h) { if (is_array($h) && !empty($h['id']) && ($h['isPickupPoint'] ?? true) !== false && ($h['isVisible'] ?? true) !== false && !empty($h['address'])) { $rows[] = $h; } }
            if (empty($j['hasNext']) || !is_array($j['items'] ?? null) || !$j['items']) { break; }
            $this->breath(150);
        }
        return $rows;
    }

    /** معرّف الحالة «جاهز للإرسال» من سير العمل الافتراضي، أو null إن لم يُعثر عليه (يُنشأ الطرد «استلام الطلب» مع تنبيه). */
    private function readyStateId(): ?string
    {
        if ($this->ready !== null) { return $this->ready ?: null; }
        $this->ready = false;
        try {
            $j = $this->send('POST', self::BASE . '/workflows/search', $this->h(), ['pageNumber' => 1, 'pageSize' => 20, 'onlyDefault' => true])->json() ?? [];
            foreach ((array)($j['items'] ?? []) as $w) {
                foreach ((array)($w['states'] ?? []) as $st) {
                    $t = preg_replace('/[^a-z0-9]+/', ' ', StatusMapper::normalize(($st['name'] ?? '') . ' ' . ($st['description'] ?? '')));
                    if (preg_match('/ready ?to ?dispatch|pret a (expedier|dispatch|etre)/', (string)$t)) { $this->ready = (string)$st['id']; return $this->ready; }
                }
            }
        } catch (CarrierApiException) {}
        return $this->ready ?: null;
    }

    private static function uuid(): string
    {
        $b = random_bytes(16); $b[6] = chr((ord($b[6]) & 0x0f) | 0x40); $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
    }

    private static function clip(string $s, int $n): string { return function_exists('mb_substr') ? mb_substr($s, 0, $n) : substr($s, 0, $n); }

    public function createParcel(Parcel $p): ShipmentResult
    {
        if ($p->stopDesk && $p->deskCode === '') { return new ShipmentResult(false, error: 'لم يُحدَّد مكتب Stop Desk لـZR Express — اختر نقطة استلام من قائمتها أو حوّل التوصيل إلى المنزل'); }
        if ((int)round($p->total) > 150000) { return new ShipmentResult(false, error: 'ZR Express تقبل 150,000 دج كحدّ أقصى للطرد (شاملاً التوصيل)'); }
        $ts = $this->territories();
        if (!$ts) { return new ShipmentResult(false, error: 'تعذّر جلب أقاليم ZR Express (راجع المفتاح ومعرّف الحساب أو أعد المحاولة)'); }
        $w = $this->wilayaOf($ts, $p);
        if (!$w) { return new ShipmentResult(false, error: 'ولاية ' . $p->wilayaName() . ' غير موجودة في قائمة ZR Express'); }
        $list = array_values(array_map(fn($t) => ['name' => $t['name'], 'id' => $t['id']], array_filter($ts, fn($t) => $t['parentId'] === $w['id'])));
        if ($list) {
            $m = CommuneMatcher::best($list, $p->commune);
            if (!$m) { return new ShipmentResult(false, error: 'بلدية «' . $p->commune . '» غير موجودة عند ZR Express في ' . $p->wilayaName() . ' — الأقرب: ' . implode('، ', CommuneMatcher::suggest($list, $p->commune))); }
        } else { $m = ['name' => $p->commune, 'id' => $w['id']]; }
        $items = $p->productsText(250) ?: 'Produit';
        $price = $p->priceWithoutShipping() ?: (int)round($p->total);
        $desc = self::clip($items . ($p->note !== '' ? ' — ' . $p->note : ''), 250); if (mb_strlen($desc) < 2) { $desc = str_pad($desc, 2, '.'); }
        $body = [
            'customer' => ['customerId' => self::uuid(), 'name' => $p->name, 'phone' => ['number1' => '+213' . substr($p->localPhone(), 1)] + ($p->phone2 !== '' ? ['number2' => '+213' . substr($p->localPhone($p->phone2), 1)] : [])],
            'deliveryAddress' => ['cityTerritoryId' => $w['id'], 'districtTerritoryId' => $m['id'], 'street' => self::clip($p->address !== '' ? $p->address : $p->commune, 250)],
            'orderedProducts' => [['productName' => self::clip($items, 100), 'unitPrice' => $price, 'quantity' => 1, 'stockType' => 'none']],
            'deliveryType' => $p->stopDesk ? 'pickup-point' : 'home',
            'description' => $desc, 'amount' => (int)round($p->total), 'ExternalId' => self::clip($p->orderRef, 100),
        ];
        if ($p->stopDesk) { $body['hubId'] = $p->deskCode; }                                   // نقطة الاستلام (UUID من hubs/search)
        $warn = '';
        if (($this->cred['autoDispatch'] ?? '1') !== '0') {
            $sid = $this->readyStateId();
            if ($sid) { $body['stateId'] = $sid; } else { $warn = 'أُنشئ الطرد بحالة «استلام الطلب» — حوّله إلى «جاهز للإرسال» من لوحة ZR ليقبله المركز'; }
        }
        $r = $this->send('POST', self::BASE . '/parcels', $this->h(), $body);
        $j = $r->json() ?? [];
        if (in_array($r->status, [400, 404, 409], true)) {
            $errs = []; foreach ((array)($j['errors'] ?? []) as $e) { if (is_array($e) && !empty($e['description'])) { $errs[] = $e['description']; } }
            return new ShipmentResult(false, error: ($errs ? implode(' — ', $errs) : self::pick($j, 'detail', 'title')) ?: ('HTTP ' . $r->status), raw: $j);
        }
        $id = self::pick($j, 'id');
        if (!($r->ok() && $id !== '')) { return new ShipmentResult(false, error: self::pick($j, 'detail', 'title', 'message') ?: ('HTTP ' . $r->status), raw: $j); }
        $trk = '';
        try { $trk = self::pick($this->send('GET', self::BASE . '/parcels/' . rawurlencode($id), $this->h())->json() ?? [], 'trackingNumber'); } catch (CarrierApiException) {}
        return new ShipmentResult(true, $trk ?: $id, null, $trk ? $warn : (($warn ? $warn . ' — ' : '') . 'لم يصل رقم التتبع بعد: يُستعمل معرّف الطرد مؤقتاً'), $j);
    }

    public function trackParcel(string $tracking): TrackingResult
    {
        $r = $this->send('GET', self::BASE . '/parcels/' . rawurlencode($tracking), $this->h());
        if ($r->status === 404) { throw new CarrierApiException('لم تجد الشركة هذا الطرد'); }
        $j = $r->json() ?? [];
        $st = is_array($j['state'] ?? null) ? $j['state'] : [];
        $raw = trim((string)($st['description'] ?? '') ?: (string)($st['name'] ?? ''));
        if ($raw === '') { throw new CarrierApiException('حالة الطرد غير موجودة في ردّ الشركة'); }
        return new TrackingResult(self::pick($j, 'trackingNumber') ?: $tracking, $raw, $this->mapStatus($raw), $j);
    }

    public function cancelParcel(string $tracking): bool
    {
        $g = $this->send('GET', self::BASE . '/parcels/' . rawurlencode($tracking), $this->h());
        $id = self::pick($g->json() ?? [], 'id');
        if (!$g->ok() || $id === '') { return false; }
        return $this->send('DELETE', self::BASE . '/parcels/' . rawurlencode($id), $this->h())->ok();
    }

    /** بوردرو ZR الأصلي: POST /parcels/labels/individual ← {parcelLabelFiles:[{fileUrl}]}. */
    public function labelUrl(string $tracking): ?string
    {
        $j = $this->send('POST', self::BASE . '/parcels/labels/individual', $this->h(), ['trackingNumbers' => [$tracking]])->json() ?? [];
        $u = $j['parcelLabelFiles'][0]['fileUrl'] ?? null;
        return is_string($u) && str_starts_with($u, 'https://') ? $u : null;
    }

    public function parseWebhook(array $payload, array $headers): array
    {
        $evt = (string)($payload['eventType'] ?? '');
        if ($evt !== '' && !in_array($evt, ['parcel.state.updated', 'parcel.isReturn.updated'], true)) { return []; }   // الحالات الفرعية (parcel.state.situation.created) لا تغيّر الحالة
        $d = isset($payload['data']) && is_array($payload['data']) ? $payload['data'] : $payload;
        $st = is_array($d['state'] ?? null) ? $d['state'] : [];
        $raw = trim(trim((string)($st['description'] ?? '') ?: (string)($st['name'] ?? '')) . (($d['isReturn'] ?? false) === true ? ' retour' : '')); $trk = self::pick($d, 'trackingNumber');
        return $trk !== '' && $raw !== '' ? [new WebhookEvent($trk, $raw, $this->mapStatus($raw), self::pick($d, 'externalId'), $d)] : [];
    }
}
