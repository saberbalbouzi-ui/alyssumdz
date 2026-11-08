<?php
declare(strict_types=1);
/* محاكيات صارمة لواجهات شركات التوصيل مبنية على ما توثّقه الشركات (أو المستودعات العامة المتفقة عند غياب وثيقة رسمية).
   كل محاكٍ يتحقق من الطلب كما ستفعل الشركة: أسماء الترويسات، موضع المعاملات (استعلام/جسم)، الحقول المطلوبة وأنواعها، تهجئة البلدية، قيم الولاية…
   وأي مخالفة تُسجَّل في $violations وتُرجِع HTTP 400 فيفشل المحوّل علناً. الغرض: كشف أخطاء الصيغة قبل أول عميل حقيقي. */
use Alyssum\Shipping\Http\{HttpClient, HttpResponse};

abstract class Sim implements HttpClient
{
    /** @var list<string> */ public array $violations = [];
    /** @var list<array{0:string,1:string,2:array,3:mixed}> */ public array $log = [];
    /** @var array<string,string> tracking → آخر حالة خام */ public array $state = [];
    public bool $rateLimit = false;
    /** كتالوج بلديات بديل (للمعايرة: تهجئة الشركة تختلف عن كتالوجنا). null = COMMUNES */
    public ?array $catalog = null;
    protected function cat(): array { return $this->catalog ?? self::COMMUNES; }

    /** البلديات المعروفة: ولاية قديمة (1–58) ← [اسم بالتهجئة الدقيقة عند الشركة]. */
    public const COMMUNES = [16 => ['Alger Centre', 'Bab Ezzouar', 'Kouba', 'Dar El Beida', 'El Harrach'], 31 => ['Oran', 'Es Senia'], 32 => ['El Bayadh', 'El Abiodh Sidi Cheikh'], 17 => ['Djelfa', 'Aïn Oussera']];

    final public function request(string $method, string $url, array $headers = [], ?string $body = null): HttpResponse
    {
        $u = parse_url($url); $path = (string)($u['path'] ?? ''); parse_str((string)($u['query'] ?? ''), $q);
        $h = array_change_key_case($headers, CASE_LOWER);
        $data = $body !== null && $body !== '' ? json_decode($body, true) : null;
        $this->log[] = [$method, $path, $q, $data];
        if ($this->rateLimit) { return new HttpResponse(429, json_encode(['message' => 'Too Many Attempts.'])); }
        return $this->handle($method, $path, $q, $h, $data, $body);
    }

    abstract protected function handle(string $m, string $path, array $q, array $h, mixed $d, ?string $raw): HttpResponse;

    protected function bad(string $why, int $status = 400): HttpResponse { $this->violations[] = $why; return $this->js($status, ['message' => 'SIM VIOLATION: ' . $why]); }
    protected function js(int $s, mixed $d): HttpResponse { return new HttpResponse($s, json_encode($d, JSON_UNESCAPED_UNICODE)); }
    protected function raw(int $s, string $b): HttpResponse { return new HttpResponse($s, $b); }

    /** يتحقق من الحقول المطلوبة وأنواعها؛ يُرجع وصف المخالفة أو null. @param array<string,string> $rules حقل ← int|str|num|phone|nonempty */
    protected function check(array $d, array $rules): ?string
    {
        foreach ($rules as $f => $t) {
            if (!array_key_exists($f, $d) || $d[$f] === '' || $d[$f] === null) { return "الحقل المطلوب غائب: $f"; }
            $v = $d[$f];
            $okType = match ($t) { 'int' => is_int($v), 'num' => is_int($v) || is_float($v), 'str' => is_string($v), 'phone' => is_string($v) && (bool)preg_match('/^0\d{8,9}$/', $v), 'intstr' => is_string($v) && ctype_digit($v), default => true };
            if (!$okType) { return "نوع/صيغة الحقل $f غير صحيح: " . json_encode($v, JSON_UNESCAPED_UNICODE); }
        }
        return null;
    }

    protected function communeKnown(int $w, string $name, bool $exact = true): bool
    {
        foreach ($this->cat()[$w] ?? [] as $c) { if ($exact ? $c === $name : strcasecmp($c, $name) === 0) { return true; } }
        return false;
    }
    public function setStatus(string $tracking, string $raw): void { $this->state[$tracking] = $raw; }
    /** @return list<string> */ public function created(): array { return array_keys($this->state); }
}

/** WeCan Service: X-API-Key/X-API-Secret، POST /api/v1/parcels مصفوفة بصيغة ياليدين (تدخل «Commandes»)، الردّ مفتاحه order_id؛ حقول الأبعاد/الوزن وولاية الانطلاق إلزامية (اكتُشفت من أخطاء تحقق حسابهم). */
final class WeCanSim extends Sim
{
    private int $n = 0; public array $orders = [];
    protected function handle(string $m, string $path, array $q, array $h, mixed $d, ?string $raw): HttpResponse
    {
        if (($h['x-api-key'] ?? '') !== 'KEY' || ($h['x-api-secret'] ?? '') !== 'SEC') { return $this->js(401, ['message' => 'Unauthenticated.']); }
        if ($m === 'GET' && $path === '/api/v1/locations/states') { return $this->js(200, ['data' => [['id' => 16, 'name' => 'Alger']]]); }
        if ($m === 'POST' && $path === '/api/v1/parcels') {
            if (!is_array($d) || !array_is_list($d) || !$d) { return $this->bad('WeCan: الجسم يجب أن يكون مصفوفة طرود'); }
            $out = [];
            foreach ($d as $p) {
                if ($e = $this->check($p, ['order_id' => 'str', 'from_wilaya_name' => 'str', 'firstname' => 'str', 'familyname' => 'str', 'contact_phone' => 'phone', 'address' => 'str', 'to_commune_name' => 'str', 'to_wilaya_name' => 'str', 'product_list' => 'str', 'price' => 'num', 'length' => 'num', 'width' => 'num', 'height' => 'num', 'weight' => 'num'])) { return $this->bad('WeCan: ' . $e); }
                if (!is_bool($p['is_stopdesk'] ?? null)) { return $this->bad('WeCan: is_stopdesk يجب أن يكون منطقياً'); }
                if ($p['is_stopdesk'] && !isset($p['stopdesk_id'])) { return $this->bad('WeCan: stopdesk_id مطلوب مع is_stopdesk'); }
                if (!in_array($p['shipping_type'] ?? '', ['express_home', 'express_desk'], true)) { return $this->bad('WeCan: shipping_type غير صالح'); }
                $wilCode = ['Alger' => 16, 'Oran' => 31, 'El Bayadh' => 32, 'Djelfa' => 17][$p['to_wilaya_name']] ?? 0;
                if (!$wilCode) { return $this->bad('WeCan: to_wilaya_name غير معروف: ' . $p['to_wilaya_name']); }
                if (!$this->communeKnown($wilCode, $p['to_commune_name'], false)) { $out[$p['order_id']] = ['success' => false, 'message' => 'Commune introuvable']; continue; }
                if (isset($this->orders[$p['order_id']])) { $out[$p['order_id']] = ['success' => false, 'message' => 'Duplicate order_id']; continue; }
                $trk = 'wc-' . (++$this->n . 'AB'); $this->orders[$p['order_id']] = $trk; $this->state[$trk] = 'En préparation';
                $out[$p['order_id']] = ['success' => true, 'order_id' => $p['order_id'], 'tracking' => $trk, 'label' => 'https://wecanservices.com/label/' . $trk];
            }
            return $this->js(200, $out);
        }
        if ($m === 'GET' && preg_match('#^/api/v1/parcels/([^/]+)$#', $path, $mm)) {
            return isset($this->state[$mm[1]]) ? $this->js(200, ['data' => [['tracking' => $mm[1], 'last_status' => $this->state[$mm[1]], 'label' => 'https://wecanservices.com/label/' . $mm[1]]]]) : $this->js(404, ['message' => 'not found']);
        }
        if ($m === 'DELETE' && preg_match('#^/api/v1/parcels/([^/]+)$#', $path, $mm)) {
            if (!isset($this->state[$mm[1]])) { return $this->js(404, ['message' => 'not found']); }
            if (!in_array($this->state[$mm[1]], ['En préparation', 'A vérifier'], true)) { return $this->js(422, ['message' => 'cannot delete']); }
            unset($this->state[$mm[1]]); return $this->js(200, ['success' => true]);
        }
        return $this->bad("WeCan: مسار غير موثّق $m $path", 404);
    }
}

/** ZR Express (المنصة الجديدة): X-Api-Key/X-Tenant، territories/search بصفحات (UUID)، parcels بعناوين UUID وhubId لنقاط الاستلام، 201 يعيد id فقط، workflows/hubs/rates/labels. */
final class ZRAppSim extends Sim
{
    private int $n = 0; public array $ids = []; public array $ext = []; public int $pageSize = 250;
    private function wid(int $w): string { return sprintf('00000000-0000-4000-8000-%012d', $w); }
    private function cid(int $w, string $c): string { return sprintf('00000000-0000-4000-9000-%012d', $w * 1000 + (int)array_search($c, $this->cat()[$w], true) + 1); }
    private function terr(): array
    {
        $all = [];
        foreach ($this->cat() as $w => $cs) {
            $all[] = ['id' => $this->wid($w), 'code' => $w, 'name' => [16 => 'Alger', 31 => 'Oran', 32 => 'El Bayadh', 17 => 'Djelfa'][$w] ?? 'W' . $w, 'level' => 'wilaya', 'parentId' => null, 'delivery' => ['hasHomeDelivery' => true]];
            foreach ($cs as $c) { $all[] = ['id' => $this->cid($w, $c), 'code' => null, 'name' => $c, 'level' => 'commune', 'parentId' => $this->wid($w), 'delivery' => ['hasHomeDelivery' => true]]; }
        }
        return $all;
    }
    private function hubList(): array { return [['id' => '00000000-0000-4000-a000-000000000001', 'name' => 'Bab Ezzouar Desk', 'isPickupPoint' => true, 'isVisible' => true, 'address' => ['street' => 'x', 'city' => 'Alger', 'district' => 'Bab Ezzouar', 'cityTerritoryId' => $this->wid(16)]], ['id' => '00000000-0000-4000-a000-000000000002', 'name' => 'Hidden', 'isPickupPoint' => true, 'isVisible' => false, 'address' => ['city' => 'Oran', 'cityTerritoryId' => $this->wid(31)]]]; }
    private function page(array $rows, mixed $d): HttpResponse
    {
        $size = min($this->pageSize, (int)($d['pageSize'] ?? 100)); $pg = max(1, (int)($d['pageNumber'] ?? 1));
        return $this->js(200, ['items' => array_slice($rows, ($pg - 1) * $size, $size), 'hasNext' => $pg * $size < count($rows), 'pageNumber' => $pg]);
    }
    protected function handle(string $m, string $path, array $q, array $h, mixed $d, ?string $raw): HttpResponse
    {
        if (($h['x-api-key'] ?? '') !== 'ZKEY' || ($h['x-tenant'] ?? '') !== 'TEN') { return $this->js(401, ['title' => 'Unauthorized']); }
        $p = preg_replace('#^/api/v1#', '', $path);
        if ($m === 'POST' && $p === '/territories/search') { return $this->page($this->terr(), $d); }
        if ($m === 'POST' && $p === '/hubs/search') { return $this->page($this->hubList(), $d); }
        if ($m === 'POST' && $p === '/workflows/search') { return $this->js(200, ['items' => [['id' => 'wf1', 'states' => [['id' => 'st-recv', 'name' => 'OrderReceived', 'description' => 'Commande reçue'], ['id' => 'st-ready', 'name' => 'ReadyToDispatch', 'description' => 'Prêt à expédier']]]]]); }
        if ($m === 'GET' && $p === '/delivery-pricing/rates') {
            return $this->js(200, ['rates' => [['toTerritoryCode' => 31, 'toTerritoryLevel' => 'wilaya', 'deliveryPrices' => [['deliveryType' => 'home', 'price' => 700], ['deliveryType' => 'pickup-point', 'price' => 450], ['deliveryType' => 'return', 'price' => 300]]],
                ['toTerritoryCode' => 'x', 'toTerritoryLevel' => 'commune', 'deliveryPrices' => [['deliveryType' => 'home', 'price' => 500], ['deliveryType' => 'pickup-point', 'price' => 350]]]]]);
        }
        if ($m === 'POST' && $p === '/parcels/labels/individual') {
            $t = (string)(($d['trackingNumbers'] ?? [])[0] ?? ''); if (!isset($this->state[$t])) { return $this->js(404, ['title' => 'not found']); }
            return $this->js(200, ['parcelLabelFiles' => [['trackingNumber' => $t, 'fileUrl' => 'https://zr-files.example.com/labels/' . $t . '.html']]]);
        }
        if ($m === 'POST' && $p === '/parcels') {
            if (!is_array($d)) { return $this->bad('ZR: الجسم مطلوب'); }
            $c = $d['customer'] ?? null;
            if (!is_array($c) || !preg_match('/^[0-9a-f-]{36}$/', (string)($c['customerId'] ?? '')) || !is_string($c['name'] ?? null) || !preg_match('/^\+213[567]\d{8}$/', (string)($c['phone']['number1'] ?? ''))) { return $this->bad('ZR: customer{customerId(uuid),name,phone.number1(+213…)} غير صالح'); }
            $a = $d['deliveryAddress'] ?? null;
            if (!is_array($a) || !preg_match('/^[0-9a-f-]{36}$/', (string)($a['cityTerritoryId'] ?? '')) || !preg_match('/^[0-9a-f-]{36}$/', (string)($a['districtTerritoryId'] ?? '')) || !is_string($a['street'] ?? null)) { return $this->bad('ZR: deliveryAddress غير صالح'); }
            if (!is_array($d['orderedProducts'] ?? null) || !$d['orderedProducts'] || !isset($d['orderedProducts'][0]['productName'], $d['orderedProducts'][0]['unitPrice'], $d['orderedProducts'][0]['quantity'], $d['orderedProducts'][0]['stockType'])) { return $this->bad('ZR: orderedProducts غير صالح'); }
            if (!in_array($d['deliveryType'] ?? '', ['home', 'pickup-point'], true)) { return $this->bad('ZR: deliveryType يجب home|pickup-point'); }
            if ($d['deliveryType'] === 'pickup-point' && !preg_match('/^[0-9a-f-]{36}$/', (string)($d['hubId'] ?? ''))) { return $this->bad('ZR: hubId (uuid) مطلوب مع pickup-point'); }
            if ($d['deliveryType'] === 'home' && isset($d['hubId'])) { return $this->bad('ZR: hubId مع home'); }
            if (!is_int($d['amount'] ?? null) || strlen((string)($d['description'] ?? '')) < 2 || !is_string($d['ExternalId'] ?? null)) { return $this->bad('ZR: amount(int)/description/ExternalId غير صالح'); }
            $okc = false; foreach ($this->cat() as $w => $cs) { foreach ($cs as $cm) { if ($this->cid($w, $cm) === $a['districtTerritoryId'] && $this->wid($w) === $a['cityTerritoryId']) { $okc = true; } } }
            if (!$okc) { return $this->js(400, ['errors' => [['description' => 'Territory mismatch']]]); }
            if (isset($this->ext[$d['ExternalId']])) { return $this->js(409, ['errors' => [['description' => 'ExternalId already exists']]]); }
            $id = 'zid-' . (++$this->n); $trk = 'ZR' . $this->n . 'AB'; $this->ids[$id] = $trk; $this->ext[$d['ExternalId']] = $id;
            $this->state[$trk] = ($d['stateId'] ?? '') === 'st-ready' ? 'Prêt à expédier' : 'Commande reçue';
            return $this->js(201, ['id' => $id]);
        }
        if ($m === 'GET' && preg_match('#^/parcels/([^/]+)$#', $p, $mm)) {
            $trk = $this->ids[$mm[1]] ?? $mm[1]; if (!isset($this->state[$trk])) { return $this->js(404, ['title' => 'not found']); }
            $id = array_search($trk, $this->ids, true);
            return $this->js(200, ['id' => $id, 'trackingNumber' => $trk, 'state' => ['name' => 'S', 'description' => $this->state[$trk]], 'situation' => ['name' => 'Normal']]);
        }
        if ($m === 'DELETE' && preg_match('#^/parcels/([^/]+)$#', $p, $mm)) {
            $trk = $this->ids[$mm[1]] ?? null; if ($trk === null || !isset($this->state[$trk])) { return $this->js(404, ['title' => 'not found']); }
            if (!in_array($this->state[$trk], ['Commande reçue', 'Prêt à expédier'], true)) { return $this->js(409, ['errors' => [['description' => 'cannot delete']]]); }
            unset($this->state[$trk], $this->ids[$mm[1]]); return $this->js(204, []);
        }
        return $this->bad("ZR: مسار غير موثّق $m $p", 404);
    }
}

/** ياليدين: X-API-ID/X-API-TOKEN، POST /v1/parcels/ مصفوفة طرود، الردّ مفتاحه order_id (مُتحقَّق على حساب حقيقي). */
final class YalidineSim extends Sim
{
    private int $n = 0; public array $orders = [];
    /** @var list<string> بلديات لا توصّل إليها الشركة (is_deliverable=0) */ public array $closed = [];
    /** @var array<int,list<array{center_id:int,name:string,address:string,commune_name:string,wilaya_id:int}>> */ public array $centers = [];
    public int $pageSize = 100;
    protected function handle(string $m, string $path, array $q, array $h, mixed $d, ?string $raw): HttpResponse
    {
        if (($h['x-api-id'] ?? '') !== 'AID' || ($h['x-api-token'] ?? '') !== 'TOK') { return $this->js(401, ['message' => 'Unauthorized']); }
        if ($m === 'GET' && $path === '/v1/wilayas/') { return $this->js(200, ['data' => [['id' => 16, 'name' => 'Alger']]]); }
        if ($m === 'GET' && $path === '/v1/communes/') {
            $w = (int)($q['wilaya_id'] ?? 0); if (!$w) { return $this->bad('Yalidine: communes يحتاج wilaya_id'); }
            $rows = array_map(fn($c) => ['id' => crc32($c) % 99999, 'name' => $c, 'wilaya_id' => $w, 'is_deliverable' => in_array($c, $this->closed, true) ? 0 : 1], $this->cat()[$w] ?? []);
            return $this->page($rows, $q);
        }
        if ($m === 'GET' && $path === '/v1/centers/') { return $this->page($this->centers[(int)($q['wilaya_id'] ?? 0)] ?? [], $q); }
        if ($m === 'GET' && $path === '/v1/deliveryfees/') {
            $rows = []; foreach ([16 => [500, 300], 31 => [700, 450], 32 => [900, 600], 17 => [800, 500]] as $w => [$hf, $df]) { $rows[] = ['wilaya_id' => $w, 'wilaya_name' => 'W' . $w, 'home_fee' => $hf, 'desk_fee' => $df]; }
            return $this->page($rows, $q);
        }
        if ($m === 'GET' && $path === '/v1/parcels/') {
            $rows = []; foreach ($this->state as $trk => $st) { $rows[] = ['tracking' => $trk, 'last_status' => $st, 'order_id' => 'x']; }
            return $this->page($rows, $q);
        }
        if ($m === 'POST' && $path === '/v1/parcels/') {
            if (!is_array($d) || !array_is_list($d) || !$d) { return $this->bad('Yalidine: الجسم يجب أن يكون مصفوفة طرود'); }
            $out = [];
            foreach ($d as $p) {
                if ($e = $this->check($p, ['order_id' => 'str', 'from_wilaya_name' => 'str', 'firstname' => 'str', 'familyname' => 'str', 'contact_phone' => 'phone', 'address' => 'str', 'to_commune_name' => 'str', 'to_wilaya_name' => 'str', 'product_list' => 'str', 'price' => 'num'])) { return $this->bad('Yalidine: ' . $e); }
                if (!is_bool($p['is_stopdesk'] ?? null)) { return $this->bad('Yalidine: is_stopdesk يجب أن يكون منطقياً'); }
                if ($p['is_stopdesk'] && !isset($p['stopdesk_id'])) { return $this->bad('Yalidine: stopdesk_id مطلوب مع is_stopdesk'); }
                $wil = array_search($p['to_wilaya_name'], ['Alger' => 16, 'Oran' => 31, 'El Bayadh' => 32, 'Djelfa' => 17], true);
                $wilCode = ['Alger' => 16, 'Oran' => 31, 'El Bayadh' => 32, 'Djelfa' => 17][$p['to_wilaya_name']] ?? 0;
                if (!$wilCode) { return $this->bad('Yalidine: to_wilaya_name غير معروف (الولايات الجديدة تُرسل باسم الأم): ' . $p['to_wilaya_name']); }
                if (!$this->communeKnown($wilCode, $p['to_commune_name'], false)) { $out[$p['order_id']] = ['success' => false, 'message' => 'Commune introuvable']; continue; }
                if (in_array($p['to_commune_name'], $this->closed, true)) { $out[$p['order_id']] = ['success' => false, 'message' => 'Commune non desservie']; continue; }
                if (!empty($p['stopdesk_id']) && $this->centers && !$this->centerExists((int)$p['stopdesk_id'])) { $out[$p['order_id']] = ['success' => false, 'message' => 'stopdesk_id invalide']; continue; }
                if (isset($this->orders[$p['order_id']])) { $out[$p['order_id']] = ['success' => false, 'message' => 'Duplicate order_id']; continue; }
                $trk = 'yal-' . (++$this->n . 'AB'); $this->orders[$p['order_id']] = $trk; $this->state[$trk] = 'En préparation';
                $out[$p['order_id']] = ['success' => true, 'order_id' => $p['order_id'], 'tracking' => $trk, 'label' => 'https://yalidine.app/app/bordereau.php?tracking=' . $trk];
            }
            return $this->js(200, $out);
        }
        if ($m === 'GET' && preg_match('#^/v1/parcels/([^/]+)$#', $path, $mm)) {
            return isset($this->state[$mm[1]]) ? $this->js(200, ['total_data' => 1, 'data' => [['tracking' => $mm[1], 'last_status' => $this->state[$mm[1]]]]]) : $this->js(404, ['message' => 'not found']);
        }
        if ($m === 'DELETE' && preg_match('#^/v1/parcels/([^/]+)$#', $path, $mm)) {
            if (!isset($this->state[$mm[1]])) { return $this->js(404, ['message' => 'not found']); }
            if (!in_array($this->state[$mm[1]], ['En préparation', 'Pas encore expédié'], true)) { return $this->js(422, ['message' => 'cannot delete']); }
            unset($this->state[$mm[1]]); return $this->js(200, ['success' => true]);
        }
        return $this->bad("Yalidine: مسار غير موثّق $m $path", 404);
    }

    private function centerExists(int $id): bool { foreach ($this->centers as $l) { foreach ($l as $c) { if ($c['center_id'] === $id) { return true; } } } return false; }
    /** ترقيم صفحات ياليدين: {has_more,total_data,data} */
    private function page(array $rows, array $q): HttpResponse
    {
        $size = min($this->pageSize, (int)($q['page_size'] ?? 100)); $pg = max(1, (int)($q['page'] ?? 1));
        return $this->js(200, ['has_more' => $pg * $size < count($rows), 'total_data' => count($rows), 'data' => array_slice($rows, ($pg - 1) * $size, $size)]);
    }
}

/** Ecotrack (وثيقة الشركة): Bearer، create/order بمعاملات استعلام وبلا جسم، valid/order، delete قبل التصديق، get/tracking/info، validate/token. */
final class EcotrackSim extends Sim
{
    private int $n = 0; public array $orders = []; public array $validated = [];
    protected function handle(string $m, string $path, array $q, array $h, mixed $d, ?string $raw): HttpResponse
    {
        $tok = str_starts_with($h['authorization'] ?? '', 'Bearer ') ? substr($h['authorization'], 7) : ($q['api_token'] ?? '');
        $auth = $tok === 'TOK';
        if ($path === '/api/v1/validate/token') { return $this->js(200, ['success' => $auth, 'message' => $auth ? 'VALID_TOKEN' : 'INVALID_TOKEN']); }
        if (!$auth) { return $this->js(401, ['message' => 'Unauthenticated.']); }
        if ($m === 'GET' && $path === '/api/v1/get/communes') {
            $w = (int)($q['wilaya_id'] ?? 0); $out = [];
            foreach ($this->cat()[$w] ?? [] as $i => $c) { $out[(string)$i] = ['nom' => $c, 'wilaya_id' => $w, 'code_postal' => $w . 'A', 'has_stop_desk' => 1]; }
            return $this->js(200, $out);
        }
        if ($m === 'POST' && $path === '/api/v1/create/order') {
            if ($raw !== null && $raw !== '') { return $this->bad('Ecotrack: create/order يأخذ معاملات استعلام ولا جسماً'); }
            if ($e = $this->check($q, ['nom_client' => 'str', 'telephone' => 'str', 'adresse' => 'str', 'commune' => 'str', 'code_wilaya' => 'intstr', 'montant' => 'str', 'type' => 'intstr'])) { return $this->bad('Ecotrack: ' . $e); }
            if (!preg_match('/^\d{9,10}$/', $q['telephone'])) { return $this->bad('Ecotrack: telephone يجب أن يكون 9–10 أرقام: ' . $q['telephone']); }
            $w = (int)$q['code_wilaya'];
            if ($w < 1 || $w > 58) { return $this->bad("Ecotrack: code_wilaya خارج 1–58: $w"); }
            if (!$this->communeKnown($w, $q['commune'])) { return $this->js(422, ['message' => 'The commune field is invalid.', 'errors' => ['commune' => ['invalid']]]); }
            if (($q['stop_desk'] ?? '0') === '1' && ($q['code_postal'] ?? '') === '') { return $this->bad('Ecotrack: stop_desk=1 يحتاج code_postal (رمز المحطة)'); }
            if (isset($q['reference']) && isset($this->orders[$q['reference']])) { return $this->js(200, ['success' => false, 'code' => 10001, 'message' => 'duplicate reference']); }
            $trk = 'ECO' . (++$this->n) . 'Z'; $this->orders[$q['reference'] ?? $trk] = $trk; $this->state[$trk] = 'order_information_received_by_carrier';
            return $this->js(200, ['success' => true, 'tracking' => $trk]);
        }
        if ($m === 'POST' && $path === '/api/v1/valid/order') {
            $t = $q['tracking'] ?? ''; if (!isset($this->state[$t])) { return $this->js(200, ['success' => false, 'message' => 'not found']); }
            $this->validated[$t] = true; $this->state[$t] = 'prete_a_expedier'; return $this->js(200, ['success' => true]);
        }
        if ($m === 'DELETE' && $path === '/api/v1/delete/order') {
            $t = $q['tracking'] ?? ''; if (isset($this->validated[$t])) { return $this->js(200, ['delete' => 'fail', 'code' => 10001]); }
            unset($this->state[$t]); return $this->js(200, ['delete' => 'success']);
        }
        if ($m === 'GET' && $path === '/api/v1/get/tracking/info') {
            $t = $q['tracking'] ?? ''; if (!isset($this->state[$t])) { return $this->js(200, ['success' => false, 'message' => 'not found']); }
            $act = array_map(fn($s) => ['date' => '2026-10-13', 'time' => '10:00', 'status' => $s, 'station' => 'Alger'], (array)($this->history[$t] ?? [$this->state[$t]]));
            return $this->js(200, ['recipientName' => 'x', 'activity' => $act]);
        }
        return $this->bad("Ecotrack: مسار غير موثّق $m $path", 404);
    }
    /** @var array<string,list<string>> */ public array $history = [];
}

/** NOEST (نص وثيقة الشركة): Bearer + api_token/user_guid في الجسم، create/order بالحقول المطلوبة، valid/order، delete قبل التصديق، get/trackings/info. */
final class NoestSim extends Sim
{
    private int $n = 0; public array $validated = []; public array $history = [];
    protected function handle(string $m, string $path, array $q, array $h, mixed $d, ?string $raw): HttpResponse
    {
        if (($h['authorization'] ?? '') !== 'Bearer TOK') { return $this->js(401, ['message' => 'Unauthenticated.']); }
        $p = preg_replace('#^/api/public#', '', $path);
        if ($m === 'GET' && $p === '/get/wilayas') { return $this->js(200, [['code' => 16, 'nom' => 'Alger', 'is_active' => 1]]); }
        if ($m === 'GET' && preg_match('#^/get/communes/(\d+)$#', $p, $mm)) {
            $out = []; foreach ($this->cat()[(int)$mm[1]] ?? [] as $c) { $out[] = ['nom' => $c, 'wilaya_id' => (int)$mm[1], 'code_postal' => '16000', 'is_active' => 1]; }
            return $this->js(200, $out);
        }
        if ($m === 'GET' && $p === '/fees') { return $this->js(200, ['tarifs' => ['delivery' => ['16' => ['wilaya_id' => 16, 'tarif' => 400, 'tarif_stopdesk' => 250], '31' => ['tarif' => 600, 'tarif_stopdesk' => 0]], 'return' => ['16' => ['tarif' => 100]]]]); }
        if ($m === 'GET' && $p === '/get/order/label') {
            if (($q['api_token'] ?? '') !== 'TOK' || ($q['user_guid'] ?? '') !== 'GUID') { return $this->js(422, ['success' => false, 'message' => 'user guid']); }
            $t = (string)($q['tracking'] ?? ''); if (!isset($this->state[$t])) { return $this->js(404, ['message' => 'not found']); }
            return new HttpResponse(302, '', '', ['location' => 'https://noest-dz.s3.eu-west-3.amazonaws.com/labels/' . $t . '.pdf?X-Amz-Signature=abc']);
        }
        if ($m !== 'POST') { return $this->bad("NOEST: $m $p غير موثّق", 404); }
        if (!is_array($d) || ($d['api_token'] ?? '') !== 'TOK' || ($d['user_guid'] ?? '') !== 'GUID') { return $this->js(422, ['success' => false, 'message' => 'Le champ user guid est obligatoire.']); }
        if ($p === '/create/order') {
            if ($e = $this->check($d, ['client' => 'str', 'phone' => 'phone', 'adresse' => 'str', 'wilaya_id' => 'int', 'commune' => 'str', 'montant' => 'num', 'produit' => 'str', 'type_id' => 'int', 'poids' => 'int', 'stop_desk' => 'int'])) { return $this->bad('NOEST: ' . $e); }
            if ($d['wilaya_id'] < 1 || $d['wilaya_id'] > 58) { return $this->bad('NOEST: wilaya_id خارج 1–58'); }
            if (!$this->communeKnown($d['wilaya_id'], $d['commune'])) { return $this->js(422, ['success' => false, 'message' => 'Commune invalide', 'errors' => ['commune' => ['invalid']]]); }
            if ($d['stop_desk'] === 1 && !preg_match('/^\d{1,2}[A-Z]$/', (string)($d['station_code'] ?? ''))) { return $this->bad('NOEST: station_code مطلوب مع stop_desk=1'); }
            $trk = 'NOE' . (++$this->n) . 'X'; $this->state[$trk] = 'upload'; return $this->js(200, ['success' => true, 'tracking' => $trk]);
        }
        if ($p === '/valid/order') { $t = (string)($d['tracking'] ?? ''); if (!isset($this->state[$t])) { return $this->js(422, ['success' => false, 'message' => 'not found']); } $this->validated[$t] = true; $this->state[$t] = 'customer_validation'; return $this->js(200, ['success' => true]); }
        if ($p === '/delete/order') { $t = (string)($d['tracking'] ?? ''); if (isset($this->validated[$t])) { return $this->js(200, ['success' => false, 'message' => 'Commande déjà validée']); } unset($this->state[$t]); return $this->js(200, ['success' => true]); }
        if ($p === '/get/trackings/info') {
            $out = [];
            foreach ((array)($d['trackings'] ?? []) as $t) {
                if (!isset($this->state[$t])) { return $this->js(200, ['message' => 'Trackings non trouvés']); }
                $evs = $this->history[$t] ?? [$this->state[$t]];
                $out[$t] = ['OrderInfo' => ['tracking' => $t], 'recipientName' => 'x', 'activity' => array_map(fn($k) => ['event_key' => $k, 'event' => $k, 'date' => '2026-10-13 10:00'], $evs), 'deliveryAttempts' => []];
            }
            return $this->js(200, $out);
        }
        return $this->bad("NOEST: مسار غير موثّق $p", 404);
    }
}

/** Maystro (مستودعات عامة متفقة): Authorization: Token، base/communes بمعرّفات رقمية، stores/orders/ بمعرّف بلدية رقمي وproducts وsource. */
final class MaystroSim extends Sim
{
    private int $n = 0; public array $seen = [];
    private function idOf(int $w, string $c): int { return $w * 1000 + array_search($c, $this->cat()[$w], true) + 1; }
    protected function handle(string $m, string $path, array $q, array $h, mixed $d, ?string $raw): HttpResponse
    {
        $a = $h['authorization'] ?? '';
        if (str_starts_with($a, 'Bearer ')) { return $this->bad('Maystro: المصادقة Token وليست Bearer'); }
        if ($a !== 'Token TOK') { return $this->js(401, ['detail' => 'Invalid token.']); }
        $p = preg_replace('#^/api#', '', $path);
        if ($m === 'GET' && $p === '/base/wilayas/') { return $this->js(200, [[16, 'Alger'], [31, 'Oran']]); }
        if ($m === 'GET' && $p === '/base/communes/') {
            $w = (int)($q['wilaya'] ?? 0); $out = []; foreach ($this->cat()[$w] ?? [] as $c) { $out[] = ['id' => $this->idOf($w, $c), 'wilaya' => $w, 'name' => $c, 'postcode' => $w * 1000, 'zone' => 1]; }
            return $this->js(200, $out);
        }
        if ($m === 'POST' && $p === '/stores/orders/') {
            if ($e = $this->check((array)$d, ['wilaya' => 'int', 'commune' => 'int', 'destination_text' => 'str', 'customer_name' => 'str', 'customer_phone' => 'phone', 'product_price' => 'int', 'delivery_type' => 'int', 'source' => 'int'])) { return $this->bad('Maystro: ' . $e); }
            if (!is_array($d['products'] ?? null) || !$d['products'] || !isset($d['products'][0]['logistical_description'], $d['products'][0]['quantity'])) { return $this->bad('Maystro: products[] مع logistical_description وquantity مطلوبة'); }
            if ($d['wilaya'] < 1 || $d['wilaya'] > 58) { return $this->bad('Maystro: wilaya خارج 1–58'); }
            if (!in_array($d['delivery_type'], [1, 2, 3], true)) { return $this->bad('Maystro: delivery_type يجب 1|2|3 في النمط الحالي'); }
            $ok = false; foreach ($this->cat()[$d['wilaya']] ?? [] as $c) { if ($this->idOf($d['wilaya'], $c) === $d['commune']) { $ok = true; } }
            if (!$ok) { return $this->js(400, ['code' => 40, 'detail' => 'wilaya or commune does not exist']); }
            $k = date('Ymd') . '|' . mb_strtolower($d['customer_name']) . '|' . $d['customer_phone'];
            if (isset($this->seen[$k])) { return $this->js(400, ['detail' => 'Duplicate order for this customer today']); }
            $this->seen[$k] = 1; $id = 'uuid-' . (++$this->n); $this->state[$id] = '4';
            return $this->js(201, ['id' => $id, 'display_id' => str_pad((string)$this->n, 9, '0', STR_PAD_LEFT), 'status' => 4]);
        }
        if ($m === 'GET' && preg_match('#^/stores/orders/([^/]+)/$#', $p, $mm)) {
            return isset($this->state[$mm[1]]) ? $this->js(200, ['id' => $mm[1], 'display_id' => '000000001', 'status' => (int)$this->state[$mm[1]]]) : $this->js(404, ['detail' => 'Not found.']);
        }
        if ($m === 'PATCH' && preg_match('#^/orders/([^/]+)/status/$#', $p, $mm)) {
            if (($d['status'] ?? null) !== 50) { return $this->bad('Maystro: الإلغاء يتطلب status=50'); }
            if (!isset($this->state[$mm[1]]) || (int)$this->state[$mm[1]] > 15) { return $this->js(400, ['detail' => 'cannot cancel']); }
            $this->state[$mm[1]] = '50'; return $this->js(200, ['id' => $mm[1], 'status' => 50]);
        }
        return $this->bad("Maystro: مسار غير موثّق $m $p", 404);
    }
}

/** ZR Express (Procolis القديمة، مستودعات عامة متفقة): ترويستا token/key، add_colis {Colis:[…]} بأسماء حقول دقيقة (Confrimee)، الرفض 200 + MessageRetour. */
final class ZRSim extends Sim
{
    private int $n = 0; public array $ext = [];
    protected function handle(string $m, string $path, array $q, array $h, mixed $d, ?string $raw): HttpResponse
    {
        if (($h['token'] ?? '') !== 'TK' || ($h['key'] ?? '') !== 'KY') { return $this->js(401, ['message' => 'Unauthorized']); }
        $p = preg_replace('#^/api_v1#', '', $path);
        if ($m === 'GET' && $p === '/token') { return $this->js(200, ['Statut' => 'Accès activé']); }
        if ($m !== 'POST') { return $this->bad("ZR: $m $p غير موثّق", 404); }
        if ($p === '/add_colis') {
            $rows = $d['Colis'] ?? null; if (!is_array($rows) || !$rows) { return $this->bad('ZR: الجسم {"Colis":[…]}'); }
            $out = [];
            foreach ($rows as $r) {
                foreach (['Tracking', 'TypeLivraison', 'TypeColis', 'Confrimee', 'Client', 'MobileA', 'MobileB', 'Adresse', 'IDWilaya', 'Commune', 'Total', 'Note', 'TProduit', 'id_Externe', 'Source'] as $f) { if (!array_key_exists($f, $r)) { return $this->bad("ZR: الحقل غائب: $f"); } }
                if (isset($r['Confirmee'])) { return $this->bad('ZR: التهجئة الصحيحة Confrimee'); }
                if ($e = $this->check($r, ['Client' => 'str', 'MobileA' => 'phone', 'Adresse' => 'str', 'IDWilaya' => 'intstr', 'Commune' => 'str', 'Total' => 'intstr', 'TProduit' => 'str', 'id_Externe' => 'str'])) { return $this->bad('ZR: ' . $e); }
                if (!in_array($r['TypeLivraison'], ['0', '1'], true) || !in_array($r['TypeColis'], ['0', '1'], true)) { return $this->bad('ZR: TypeLivraison/TypeColis 0|1 نصّيان'); }
                if ((int)$r['IDWilaya'] < 1 || (int)$r['IDWilaya'] > 58) { return $this->bad('ZR: IDWilaya خارج 1–58'); }
                if (isset($this->ext[$r['id_Externe']])) { $out[] = ['Tracking' => $this->ext[$r['id_Externe']], 'MessageRetour' => 'Double Tracking']; continue; }
                if (!$this->communeKnown((int)$r['IDWilaya'], $r['Commune'], false)) { $out[] = ['Tracking' => '', 'MessageRetour' => 'Commune introuvable']; continue; }
                $trk = 'ZR' . str_pad((string)(++$this->n), 6, '0', STR_PAD_LEFT); $this->ext[$r['id_Externe']] = $trk; $this->state[$trk] = 'En Preparation';
                $out[] = ['Tracking' => $trk, 'MessageRetour' => 'Good'];
            }
            return $this->js(200, ['Colis' => $out]);                       // الرفض أيضاً HTTP 200
        }
        if ($p === '/lire') {
            $t = (string)($d['Colis'][0]['Tracking'] ?? ''); if (!isset($this->state[$t])) { return $this->raw(200, 'null'); }
            return $this->js(200, ['Colis' => [['Tracking' => $t, 'Situation' => $this->state[$t], 'DateH_Action' => '2026-10-13 10:00']]]);
        }
        return $this->bad("ZR: مسار غير موثّق $p", 404);
    }
}
