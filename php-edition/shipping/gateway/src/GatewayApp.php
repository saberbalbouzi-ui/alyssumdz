<?php
declare(strict_types=1);
namespace Alyssum\Gateway;

use Alyssum\Shipping\{CarrierApiException, CarrierRegistry, ConnectionRepository, CredentialsException, CredentialVault, Parcel, ShippingException, ShippingFactory, ShippingInterface, Status, UnsupportedCarrierException};
use Alyssum\Shipping\Http\{CurlHttpClient, HttpClient};

/**
 * بوابة الشحن كخدمة: طلب واحد بصيغة واحدة لكل شركات التوصيل الجزائرية (صيغة الطلب متوافقة مع dzship فيسهل الانتقال إليها).
 * وضعان: (1) inline: مفاتيح الشركة مع كل طلب ولا تُخزَّن؛ (2) vault: تُحفظ مشفّرة مرة واحدة فيكفي مفتاح البوابة، ويُفعَّل الدفع الصادر webhook والتزامن التلقائي.
 * handle() نقية: لا تقرأ $_SERVER ولا تطبع، فتُختبر بلا خادم.
 */
final class GatewayApp
{
    private const MAX_BODY = 262144;
    public Tenants $tenants; public Limiter $limiter; public Dispatcher $dispatcher; public ConnectionRepository $repo; public Geo $geo;
    private HttpClient $http;

    public function __construct(private \PDO $db, CredentialVault $vault, ?HttpClient $http = null, ?Geo $geo = null, private string $baseUrl = '')
    {
        $this->http = $http ?? new CurlHttpClient();
        $this->geo = $geo ?? new Geo();
        $this->tenants = new Tenants($db, $vault);
        $this->limiter = new Limiter($db);
        $this->repo = new ConnectionRepository($db, $vault);
        $this->dispatcher = new Dispatcher($db, $this->tenants, $this->http);
    }

    /** @param array<string,string> $query @param array<string,string> $headers أسماء صغيرة @return array{0:int,1:array<string,string>,2:string} */
    public function handle(string $method, string $path, array $query, array $headers, string $raw, string $ip = '0'): array
    {
        $rid = 'req_' . bin2hex(random_bytes(6));
        try {
            [$code, $h, $body] = $this->route(strtoupper($method), '/' . trim($path, '/'), $query, $headers, $raw, $ip);
        } catch (HttpError $e) {
            $code = $e->status; $h = $e->headers; $body = json_encode(['error' => ['code' => $e->errorCode, 'message' => $e->getMessage()] + ($e->fields ? ['fields' => $e->fields] : [])], JSON_UNESCAPED_UNICODE);
        } catch (\Throwable $e) {
            error_log('gateway: ' . $e::class . ' ' . $e->getMessage()); $code = 500; $h = []; $body = '{"error":{"code":"server_error","message":"خطأ داخلي"}}';
        }
        return [$code, $h + ['Content-Type' => 'application/json; charset=utf-8', 'X-Request-Id' => $rid, 'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'no-store'], $body];
    }

    /** @return array{0:int,1:array<string,string>,2:string} */
    private function route(string $m, string $p, array $q, array $hd, string $raw, string $ip): array
    {
        if (strlen($raw) > self::MAX_BODY) { throw new HttpError(413, 'payload_too_large', 'الطلب أكبر من 256KB'); }
        // حدّ عام لكل IP (الأخطاء 401 تُحسب مضاعفاً أدناه)
        if (($w = $this->limiter->window('ip:' . $ip, 300, 60)) !== null) { throw new HttpError(429, 'rate_limited', 'طلبات كثيرة', headers: ['Retry-After' => (string)$w]); }

        /* ── عامّة (بلا مفتاح، قابلة للتخزين المؤقت) ── */
        if ($m === 'GET' && $p === '/health') { return $this->ok(['ok' => true, 'version' => '1']); }
        if ($m === 'GET' && $p === '/openapi.json') { return [200, ['Cache-Control' => 'public, max-age=3600'], json_encode($this->openapi(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]; }
        if ($m === 'GET' && $p === '/v1/couriers') { return $this->cached($this->couriers()); }
        if ($m === 'GET' && $p === '/v1/wilayas') {
            if (isset($q['q'])) { $n = Geo::norm($q['q']); $o = array_values(array_filter($this->geo->wilayas(true), fn($w) => str_contains(Geo::norm($w['name']), $n) || (string)$w['code'] === trim($q['q']))); return $this->cached($o); }
            return $this->cached($this->geo->wilayas(isset($q['all'])));
        }
        if ($m === 'GET' && $p === '/v1/communes') {
            if (isset($q['q'])) { return $this->cached($this->geo->searchCommunes((string)$q['q'])); }
            $w = (int)($q['wilaya'] ?? 0); if (!$this->geo->wilaya($w)) { throw new HttpError(400, 'validation_error', 'wilaya مطلوب (1..69) أو q للبحث'); }
            return $this->cached(['wilaya' => $w, 'communes' => $this->geo->communes($w)]);
        }
        // webhook وارد من شركة (يُصادَق عليه بسرّ الرابط لا بمفتاح)
        if (preg_match('#^/v1/hooks/([a-f0-9]{24})$#', $p, $mm)) { return $this->inbound($m, $mm[1], $q, $hd, $raw); }

        /* ── تتطلب مفتاحاً ── */
        $auth = $this->auth($hd, $ip);
        $t = $auth['tenant']; $tid = (int)$t['id']; $mode = (string)$auth['key']['mode']; $plan = $auth['plan'];

        if ($m === 'POST' && $p === '/v1/orders') { return $this->createOrder($auth, $hd, $this->json($raw)); }
        if ($m === 'POST' && $p === '/v1/validate') { return $this->validate($this->json($raw)); }
        if ($m === 'POST' && $p === '/v1/track') { return $this->track($auth, $this->json($raw)); }
        if ($m === 'POST' && $p === '/v1/desks') { return $this->desks($this->json($raw)); }
        if ($m === 'GET' && $p === '/v1/orders') { return $this->listOrders($tid, $q); }
        if ($m === 'GET' && preg_match('#^/v1/orders/([A-Za-z0-9._-]{1,64})$#', $p, $mm)) {
            $st = $this->db->prepare('SELECT * FROM gw_orders WHERE tenant_id=? AND reference=? ORDER BY id DESC LIMIT 1'); $st->execute([$tid, $mm[1]]); $r = $st->fetch();
            if (!$r) { throw new HttpError(404, 'not_found', 'الطلب غير موجود'); }
            return $this->ok($this->pubOrder($r));
        }
        if ($p === '/v1/connections') {
            if ($m === 'GET') { $st = $this->db->prepare('SELECT carrier_code, public_id, updated_at FROM user_carriers WHERE user_id=? AND is_active=1'); $st->execute([$tid]); return $this->ok(['connections' => $st->fetchAll()]); }
            if ($m === 'POST') { return $this->connect($auth, $this->json($raw)); }
        }
        if ($m === 'DELETE' && preg_match('#^/v1/connections/([a-z0-9_]{2,30})$#', $p, $mm)) { $this->repo->disconnect($tid, $mm[1]); return $this->ok(['ok' => true]); }
        if ($p === '/v1/webhook') {
            if ($m === 'GET') { $w = $this->tenants->webhook($tid); return $this->ok(['enabled' => (bool)$w, 'url' => $w['url'] ?? null]); }
            if ($m === 'PUT') { return $this->setWebhook($auth, $this->json($raw)); }
            if ($m === 'DELETE') { $this->tenants->clearWebhook($tid); return $this->ok(['ok' => true]); }
        }
        if ($m === 'GET' && $p === '/v1/usage') { return $this->ok(['plan' => ['id' => $plan['id'], 'name' => $plan['name'], 'orders_hour' => (int)$plan['orders_hour'], 'orders_day' => (int)$plan['orders_day'], 'track_min' => (int)$plan['track_min'], 'vault_max' => (int)$plan['vault_max'], 'webhooks' => (bool)$plan['webhooks']], 'today' => (object)$this->limiter->today($tid), 'mode' => $mode]); }
        throw new HttpError(404, 'not_found', 'مسار غير موجود: ' . $m . ' ' . $p);
    }

    /* ───────── المصادقة والمساعدات ───────── */

    /** @return array{tenant:array,key:array,plan:array} */
    private function auth(array $hd, string $ip): array
    {
        $b = (string)($hd['authorization'] ?? ''); $tok = stripos($b, 'Bearer ') === 0 ? trim(substr($b, 7)) : ($hd['x-api-key'] ?? '');
        $a = $tok !== '' ? $this->tenants->authenticate($tok) : null;
        if (!$a) {
            if (($w = $this->limiter->window('bad:' . $ip, 30, 60)) !== null) { throw new HttpError(429, 'rate_limited', 'محاولات مصادقة فاشلة كثيرة', headers: ['Retry-After' => (string)$w]); }   // تحدّ من تخمين المفاتيح
            throw new HttpError(401, 'unauthorized', 'مفتاح API مفقود أو غير صالح', headers: ['WWW-Authenticate' => 'Bearer']);
        }
        return $a;
    }

    private function json(string $raw): array
    {
        $j = json_decode($raw, true);
        if (!is_array($j)) { throw new HttpError(400, 'validation_error', 'جسم الطلب يجب أن يكون JSON'); }
        return $j;
    }

    /** @param array<string,mixed> $b */
    private function ok(array $b, int $code = 200, array $h = []): array { return [$code, $h, json_encode($b, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR)]; }
    private function cached(array $b): array { return [200, ['Cache-Control' => 'public, max-age=86400'], json_encode($b, JSON_UNESCAPED_UNICODE)]; }

    private function couriers(): array
    {
        $o = [['courier' => 'sandbox', 'label' => 'Sandbox (تجربة بلا حساب)', 'maturity' => 'sandbox', 'credentials' => [], 'capabilities' => ['create' => true, 'track' => true, 'cancel' => false, 'label' => false]]];
        foreach (CarrierRegistry::catalog() as $c) {
            if (!$c['activatable']) { continue; }
            $o[] = ['courier' => $c['code'], 'label' => $c['label'], 'maturity' => $c['maturity'], 'credentials' => array_map(fn($f) => ['key' => $f['key'], 'label' => $f['label'], 'required' => $f['required'] ?? true], $c['fields']), 'needsBaseUrl' => $c['needs_base_url'], 'capabilities' => ['create' => true, 'track' => true, 'webhook' => true]];
        }
        return ['couriers' => $o];
    }

    /** يبني المحوّل: sandbox | inline (credentials) | vault. @return array{0:ShippingInterface,1:string,2:string} [محوّل، رمز الشركة، via] */
    private function adapter(array $auth, array $b): array
    {
        $courier = strtolower(trim((string)($b['courier'] ?? '')));
        if ($courier === '') { throw new HttpError(400, 'validation_error', 'courier مطلوب', ['courier' => 'مطلوب']); }
        if ($courier === 'sandbox') { return [new SandboxAdapter($this->http, $this->geo), 'sandbox', 'inline']; }
        $code = CarrierRegistry::resolve($courier) ?? throw new HttpError(400, 'unknown_courier', "شركة غير معروفة: $courier");
        if ($auth['key']['mode'] === 'test') { throw new HttpError(403, 'test_key_sandbox_only', 'مفتاح الاختبار يعمل مع courier=sandbox فقط'); }
        $opts = is_array($b['options'] ?? null) ? $b['options'] : [];
        $base = isset($opts['baseUrl']) ? (string)$opts['baseUrl'] : null;
        try {
            if (is_array($b['credentials'] ?? null) && $b['credentials']) {
                $cred = array_map(fn($v) => is_scalar($v) ? trim((string)$v) : '', $b['credentials']);
                if (isset($opts['fromWilaya']) && !isset($cred['fromWilaya'])) { $cred['fromWilaya'] = (string)$opts['fromWilaya']; }
                return [ShippingFactory::make($code, $this->http, $base)->authenticate($cred), $code, 'inline'];
            }
            $conn = $this->repo->find((int)$auth['tenant']['id'], $code);
            if (!$conn || !(int)$conn['is_active']) { throw new HttpError(422, 'credentials_required', 'أرسل credentials أو فعّل الشركة عبر POST /v1/connections'); }
            return [$this->repo->adapterFor($conn, $this->http), $code, 'vault'];
        } catch (UnsupportedCarrierException $e) { throw new HttpError(422, 'not_supported', $e->getMessage()); }
        catch (CredentialsException $e) { throw new HttpError(422, 'invalid_credentials', $e->getMessage()); }
    }

    /** يطبّع الهاتف الجزائري ← 0XXXXXXXXX أو null */
    public static function phone(string $p): ?string
    {
        $d = preg_replace('/\D/', '', $p) ?? '';
        if (str_starts_with($d, '00213')) { $d = substr($d, 5); } elseif (str_starts_with($d, '213')) { $d = substr($d, 3); }
        if (strlen($d) === 9) { $d = '0' . $d; }
        return preg_match('/^0[567]\d{8}$/', $d) ? $d : null;
    }

    /** يتحقق من العنوان والمستلم ويصحّح تهجئة البلدية. @return array{0:array<string,mixed>,1:list<array<string,string>>} [الطلب المطبَّع، التصحيحات] */
    private function normalizeOrder(array $b): array
    {
        $o = $b['order'] ?? null; $f = [];
        if (!is_array($o)) { throw new HttpError(400, 'validation_error', 'order مطلوب', ['order' => 'مطلوب']); }
        $r = is_array($o['recipient'] ?? null) ? $o['recipient'] : [];
        $name = trim((string)($r['fullName'] ?? '')); if (mb_strlen($name) < 2 || mb_strlen($name) > 120) { $f['order.recipient.fullName'] = '2–120 حرفاً'; }
        $w = (int)($r['wilayaCode'] ?? 0); if (!$this->geo->wilaya($w)) { $f['order.recipient.wilayaCode'] = '1..69'; }
        $commune = trim((string)($r['communeName'] ?? '')); if ($commune === '') { $f['order.recipient.communeName'] = 'مطلوب'; }
        $type = (string)($o['deliveryType'] ?? 'home'); if (!in_array($type, ['home', 'stopdesk'], true)) { $f['order.deliveryType'] = 'home أو stopdesk'; }
        $prod = trim((string)($o['productList'] ?? '')); if ($prod === '') { $f['order.productList'] = 'مطلوب'; }
        $cod = $o['codAmount'] ?? null; if (!is_numeric($cod) || $cod < 0 || $cod > 1000000) { $f['order.codAmount'] = 'عدد صحيح بالدينار (0 = مدفوع مسبقاً)'; }
        $ref = (string)($o['reference'] ?? ''); if ($ref !== '' && !preg_match('/^[A-Za-z0-9._-]{1,64}$/', $ref)) { $f['order.reference'] = 'أحرف وأرقام و . _ - (حتى 64)'; }
        if ($f) { throw new HttpError(400, 'validation_error', 'حقول غير صالحة', $f); }
        $phone = self::phone((string)($r['phone'] ?? '')); if ($phone === null) { throw new HttpError(422, 'invalid_phone', 'رقم هاتف جزائري محمول غير صالح (05/06/07…)', ['order.recipient.phone' => 'غير صالح']); }
        $alt = isset($r['phoneAlt']) && $r['phoneAlt'] !== '' ? self::phone((string)$r['phoneAlt']) : null;
        $corr = [];
        $mc = $this->geo->matchCommune($w, $commune);
        if ($mc['status'] === 'unknown') { throw new HttpError(422, 'unknown_commune', 'بلدية غير معروفة في هذه الولاية' . ($mc['suggestions'] ? ' — هل تقصد: ' . implode('، ', $mc['suggestions']) : ''), ['order.recipient.communeName' => $mc['suggestions']]); }
        if ($mc['commune'] !== $commune) { $corr[] = ['field' => 'order.recipient.communeName', 'from' => $commune, 'to' => (string)$mc['commune']]; }
        $deskId = isset($o['stopDeskId']) && $o['stopDeskId'] !== '' ? (string)$o['stopDeskId'] : null;
        if ($type === 'stopdesk' && $deskId === null) { throw new HttpError(422, 'validation_error', 'stopDeskId مطلوب مع stopdesk', ['order.stopDeskId' => 'مطلوب']); }
        return [[
            'reference' => $ref, 'name' => $name, 'phone' => $phone, 'phoneAlt' => $alt ?? '', 'wilaya' => $w, 'commune' => (string)$mc['commune'], 'address' => trim((string)($r['addressLine'] ?? '')),
            'type' => $type, 'desk' => $deskId, 'products' => $prod, 'cod' => (int)round((float)$cod), 'notes' => mb_substr(trim((string)($o['notes'] ?? '')), 0, 200), 'canOpen' => !array_key_exists('hasOpenPackage', $o) || (bool)$o['hasOpenPackage'],
        ], $corr];
    }

    private function createOrder(array $auth, array $hd, array $b): array
    {
        [$n, $corr] = $this->normalizeOrder($b);
        $tid = (int)$auth['tenant']['id']; $mode = (string)$auth['key']['mode'];
        [$ad, $courier, $via] = $this->adapter($auth, $b);
        $ref = $n['reference'] !== '' ? $n['reference'] : (string)($hd['idempotency-key'] ?? '');
        if ($ref !== '' && !preg_match('/^[A-Za-z0-9._-]{1,64}$/', $ref)) { throw new HttpError(400, 'validation_error', 'Idempotency-Key غير صالح'); }
        if ($ref === '') { $ref = 'GW-' . strtoupper(bin2hex(random_bytes(5))); }
        $n['reference'] = $ref;
        $hash = hash('sha256', json_encode([$courier, $n], JSON_UNESCAPED_UNICODE));

        if (($w = $this->limiter->consume($auth['tenant'], $auth['plan'], $mode, 'order')) !== null) { throw new HttpError(429, 'rate_limited', 'تجاوزت حدّ خطتك للطلبات', headers: ['Retry-After' => (string)$w]); }

        // حجز المرجع أولاً: التكرار/التزامن يصطدم بالقيد الفريد بدل إنشاء طرد ثانٍ
        $now = gmdate('Y-m-d H:i:s');
        try {
            $this->db->prepare('INSERT INTO gw_orders (tenant_id,courier,reference,tracking,status,via,request_hash,created_at,updated_at) VALUES (?,?,?,NULL,?,?,?,?,?)')->execute([$tid, $courier, $ref, Status::PENDING, $via, $hash, $now, $now]);
        } catch (\PDOException) {
            $st = $this->db->prepare('SELECT * FROM gw_orders WHERE tenant_id=? AND courier=? AND reference=?'); $st->execute([$tid, $courier, $ref]); $e = $st->fetch();
            if (!$e || $e['request_hash'] !== $hash) { throw new HttpError(409, 'reference_conflict', 'المرجع مستعمل لطلب مختلف'); }
            if ($e['tracking'] === null) { throw new HttpError(409, 'in_progress', 'الإرسال جارٍ لهذا المرجع، أعد المحاولة بعد قليل', headers: ['Retry-After' => '3']); }
            return $this->ok(json_decode((string)$e['response_json'], true) ?: $this->pubOrder($e), 200, ['Idempotent-Replayed' => 'true']);
        }
        $id = (int)$this->db->lastInsertId();
        $release = fn() => $this->db->prepare('DELETE FROM gw_orders WHERE id=?')->execute([$id]);
        try {
            $parcel = new Parcel($ref, $n['name'], $n['phone'], $n['wilaya'], $n['commune'], $n['address'], (float)$n['cod'], 0.0, $n['products'], $n['phoneAlt'], $n['type'] === 'stopdesk',
                $n['desk'] !== null && ctype_digit($n['desk']) ? (int)$n['desk'] : null, $n['notes'], $n['canOpen']);
            if ($n['type'] === 'stopdesk' && $parcel->deskId === null) { $release(); throw new HttpError(422, 'not_supported', 'معرّف المكتب غير رقمي: هذه الشركة لا تدعمه بعد في البوابة'); }
            $res = $ad->createParcel($parcel);
        } catch (HttpError $e) { throw $e;
        } catch (\InvalidArgumentException $e) { $release(); throw new HttpError(400, 'validation_error', $e->getMessage());
        } catch (CredentialsException $e) { $release(); throw new HttpError(422, 'invalid_credentials', $e->getMessage());
        } catch (ShippingException $e) { $release(); throw new HttpError(502, 'courier_error', $e->getMessage());
        } catch (\Throwable $e) { $release(); throw $e; }
        if (!$res->ok) { $release(); throw new HttpError(502, 'courier_error', $res->error !== '' ? $res->error : 'رفضت الشركة الطلب'); }
        $out = ['reference' => $ref, 'courier' => $courier, 'trackingNumber' => $res->tracking, 'status' => Status::PENDING, 'labelUrl' => $res->labelUrl, 'sandbox' => $courier === 'sandbox'] + ($corr ? ['corrections' => $corr] : []);
        $this->db->prepare('UPDATE gw_orders SET tracking=?, response_json=?, updated_at=? WHERE id=?')->execute([$res->tracking, json_encode($out, JSON_UNESCAPED_UNICODE), gmdate('Y-m-d H:i:s'), $id]);
        if ($mode === 'live') { $this->limiter->count($tid, 'order'); }
        return $this->ok($out, 201);
    }

    /** تحقق جاف: يطبّع ويصحّح العنوان دون إرسال ولا استهلاك حصة. */
    private function validate(array $b): array
    {
        [$n, $corr] = $this->normalizeOrder($b);
        return $this->ok(['valid' => true, 'normalized' => ['phone' => $n['phone'], 'wilayaCode' => $n['wilaya'], 'shipAs' => $this->geo->wilaya($n['wilaya'])['parent'] ?? $n['wilaya'], 'communeName' => $n['commune'], 'codAmount' => $n['cod']], 'corrections' => $corr]);
    }

    private function track(array $auth, array $b): array
    {
        $trk = trim((string)($b['trackingNumber'] ?? '')); if (!preg_match('/^[A-Za-z0-9._-]{3,64}$/', $trk)) { throw new HttpError(400, 'validation_error', 'trackingNumber غير صالح', ['trackingNumber' => 'مطلوب']); }
        [$ad, $courier] = $this->adapter($auth, $b);
        $tid = (int)$auth['tenant']['id'];
        if (($w = $this->limiter->consume($auth['tenant'], $auth['plan'], (string)$auth['key']['mode'], 'track')) !== null) { throw new HttpError(429, 'rate_limited', 'تجاوزت حدّ التتبع', headers: ['Retry-After' => (string)$w]); }
        try { $r = $ad->trackParcel($trk); }
        catch (CredentialsException $e) { throw new HttpError(422, 'invalid_credentials', $e->getMessage()); }
        catch (ShippingException $e) { throw new HttpError(502, 'courier_error', $e->getMessage()); }
        $st = $this->db->prepare('SELECT * FROM gw_orders WHERE tenant_id=? AND courier=? AND tracking=?'); $st->execute([$tid, $courier, $trk]); $row = $st->fetch();
        if ($row) { $this->advance($row, $r->status, $r->rawStatus, $auth['plan']); }
        return $this->ok(['trackingNumber' => $trk, 'courier' => $courier, 'status' => $r->status, 'rawStatus' => $r->rawStatus]);
    }

    private function desks(array $b): array
    {
        $w = (int)($b['wilayaCode'] ?? 0); $g = $this->geo->wilaya($w); if (!$g) { throw new HttpError(400, 'validation_error', 'wilayaCode (1..69) مطلوب', ['wilayaCode' => 'مطلوب']); }
        return $this->ok(['wilayaCode' => $w, 'desks' => $this->geo->desks($w), 'source' => 'catalog', 'note' => 'كتالوج شبكة ياليدين وشبيهاتها؛ استعمل id المكتب مع deliveryType=stopdesk']);
    }

    private function listOrders(int $tid, array $q): array
    {
        $lim = max(1, min(100, (int)($q['limit'] ?? 50))); $after = (int)($q['after'] ?? 0);
        $sql = 'SELECT * FROM gw_orders WHERE tenant_id=? AND tracking IS NOT NULL' . ($after > 0 ? ' AND id<?' : '') . (isset($q['status']) && in_array($q['status'], Status::ALL, true) ? ' AND status=?' : '') . ' ORDER BY id DESC LIMIT ' . ($lim + 1);
        $args = [$tid]; if ($after > 0) { $args[] = $after; } if (isset($q['status']) && in_array($q['status'], Status::ALL, true)) { $args[] = $q['status']; }
        $st = $this->db->prepare($sql); $st->execute($args); $rows = $st->fetchAll(); $more = count($rows) > $lim; $rows = array_slice($rows, 0, $lim);
        return $this->ok(['orders' => array_map(fn($r) => $this->pubOrder($r), $rows), 'next' => $more ? (int)end($rows)['id'] : null]);
    }

    private function pubOrder(array $r): array { return ['reference' => $r['reference'], 'courier' => $r['courier'], 'trackingNumber' => $r['tracking'], 'status' => $r['status'], 'rawStatus' => $r['raw_status'], 'via' => $r['via'], 'createdAt' => $r['created_at'], 'updatedAt' => $r['updated_at']]; }

    /* ───────── الخزنة والـwebhook ───────── */

    private function connect(array $auth, array $b): array
    {
        if ($auth['key']['mode'] === 'test') { throw new HttpError(403, 'test_key_sandbox_only', 'غير متاح بمفتاح الاختبار'); }
        $tid = (int)$auth['tenant']['id']; $courier = strtolower(trim((string)($b['courier'] ?? '')));
        $code = CarrierRegistry::resolve($courier) ?? throw new HttpError(400, 'unknown_courier', "شركة غير معروفة: $courier");
        $had = $this->repo->find($tid, $code);
        $st = $this->db->prepare('SELECT COUNT(*) FROM user_carriers WHERE user_id=? AND is_active=1'); $st->execute([$tid]);
        if ((!$had || !(int)$had['is_active']) && (int)$st->fetchColumn() >= (int)$auth['plan']['vault_max']) { throw new HttpError(402, 'plan_limit', 'خطتك لا تسمح بمزيد من الشركات المحفوظة', headers: []); }
        $cred = array_map(fn($v) => is_scalar($v) ? trim((string)$v) : '', (array)($b['credentials'] ?? []));
        $base = isset($b['baseUrl']) && $b['baseUrl'] !== '' ? (string)$b['baseUrl'] : null;
        if ($base !== null && !preg_match('#^https://[a-z0-9.-]+(/\S*)?$#i', $base)) { throw new HttpError(400, 'validation_error', 'baseUrl يجب أن يبدأ بـ https://'); }
        try { $r = $this->repo->connect($tid, $code, $cred, $base); }
        catch (UnsupportedCarrierException $e) { throw new HttpError(422, 'not_supported', $e->getMessage()); }
        catch (CredentialsException $e) { throw new HttpError(422, 'invalid_credentials', $e->getMessage()); }
        return $this->ok(['ok' => true, 'courier' => $code, 'carrierWebhookUrl' => rtrim($this->baseUrl, '/') . '/v1/hooks/' . $r['public_id'] . '?t=' . $r['webhook_secret'], 'note' => 'ضع هذا الرابط في حسابك لدى الشركة لتصلك حالات الطرود لحظياً — يظهر هذه المرة فقط'], 201);
    }

    private function setWebhook(array $auth, array $b): array
    {
        if (!(int)$auth['plan']['webhooks']) { throw new HttpError(402, 'plan_limit', 'الـwebhook غير متاح في خطتك'); }
        $url = (string)($b['url'] ?? ''); if (!preg_match('#^https://[a-z0-9.-]+(:\d+)?(/\S*)?$#i', $url) || strlen($url) > 300) { throw new HttpError(400, 'validation_error', 'url يجب أن يكون https صالحاً', ['url' => 'https://…']); }
        $secret = $this->tenants->setWebhook((int)$auth['tenant']['id'], $url);
        return $this->ok(['ok' => true, 'url' => $url, 'secret' => $secret, 'note' => 'السرّ يوقّع كل حدث (X-Gateway-Signature: t=…,v1=hmac_sha256(secret, t.body)) — يظهر هذه المرة فقط'], 200);
    }

    /** يطبّق حالة جديدة على طلب البوابة ويصدر حدثاً للعميل. */
    private function advance(array $row, string $status, string $raw, array $plan): bool
    {
        if (!Status::canTransition((string)$row['status'], $status)) { return false; }
        $this->db->prepare('UPDATE gw_orders SET status=?, raw_status=?, updated_at=? WHERE id=?')->execute([$status, mb_substr($raw, 0, 190), gmdate('Y-m-d H:i:s'), $row['id']]);
        $this->dispatcher->enqueue((int)$row['tenant_id'], (int)$row['id'], 'shipment.status_changed', ['reference' => $row['reference'], 'courier' => $row['courier'], 'trackingNumber' => $row['tracking'], 'status' => $status, 'previousStatus' => $row['status'], 'rawStatus' => $raw], $plan);
        return true;
    }

    private function inbound(string $m, string $publicId, array $q, array $hd, string $raw): array
    {
        if ($m === 'GET') { return isset($q['subscribe'], $q['crc_token']) ? [200, ['Content-Type' => 'text/plain; charset=utf-8'], (string)$q['crc_token']] : $this->ok(['ok' => true, 'webhook' => 'ready']); }
        if ($m !== 'POST') { throw new HttpError(405, 'method_not_allowed', 'POST فقط'); }
        $conn = $this->repo->findByPublicId($publicId);
        if (!$conn || !$this->repo->checkWebhookToken($conn, (string)($q['t'] ?? ''))) { throw new HttpError(401, 'unauthorized', 'رابط غير صالح'); }
        $p = json_decode($raw, true); if (!is_array($p)) { throw new HttpError(400, 'validation_error', 'JSON غير صالح'); }
        $tid = (int)$conn['user_id']; $plan = $this->tenants->plan((string)($this->db->query('SELECT plan FROM gw_tenants WHERE id=' . $tid)->fetchColumn() ?: 'free')) ?? [];
        $n = 0;
        try { $events = ShippingFactory::forWebhook((string)$conn['carrier_code'])->parseWebhook($p, $hd); } catch (UnsupportedCarrierException) { $events = []; }
        foreach ($events as $e) {
            $st = $this->db->prepare('SELECT * FROM gw_orders WHERE tenant_id=? AND courier=? AND tracking=?'); $st->execute([$tid, $conn['carrier_code'], $e->tracking]); $row = $st->fetch();
            if ($row && $this->advance($row, $e->status, $e->rawStatus, $plan)) { $n++; }
        }
        return $this->ok(['ok' => true, 'received' => count($events), 'updated' => $n]);
    }

    /** للـcron: يستعلم عن الطرود غير النهائية لمفاتيح الخزنة (المفاتيح غير المحفوظة لا يمكن استعمالها هنا) ثم يرسل الأحداث المستحقة. */
    public function cron(int $syncLimit = 50): array
    {
        $st = $this->db->prepare("SELECT * FROM gw_orders WHERE via='vault' AND tracking IS NOT NULL AND status NOT IN ('delivered','returned','cancelled') ORDER BY updated_at ASC LIMIT $syncLimit"); $st->execute();
        $checked = 0; $changed = 0; $errs = 0;
        foreach ($st->fetchAll() as $row) {
            $checked++;
            try {
                $conn = $this->repo->find((int)$row['tenant_id'], (string)$row['courier']); if (!$conn || !(int)$conn['is_active']) { continue; }
                $r = $this->repo->adapterFor($conn, $this->http)->trackParcel((string)$row['tracking']);
                $plan = $this->tenants->plan((string)$this->db->query('SELECT plan FROM gw_tenants WHERE id=' . (int)$row['tenant_id'])->fetchColumn()) ?? [];
                if ($this->advance($row, $r->status, $r->rawStatus, $plan)) { $changed++; } else { $this->db->prepare('UPDATE gw_orders SET updated_at=? WHERE id=?')->execute([gmdate('Y-m-d H:i:s'), $row['id']]); }
            } catch (\Throwable) { $errs++; }
        }
        return ['checked' => $checked, 'changed' => $changed, 'errors' => $errs] + $this->dispatcher->deliverDue();
    }

    /** وصف OpenAPI مبسّط للنقاط العامة. */
    public function openapi(): array
    {
        $sec = [['bearer' => []]];
        $p = static fn(string $s) => ['summary' => $s];
        return ['openapi' => '3.0.3', 'info' => ['title' => 'Shipping Gateway', 'version' => '1', 'description' => 'طلب واحد لكل شركات التوصيل الجزائرية. المصادقة: Authorization: Bearer gk_live_… (أو gk_test_… للتجربة مع courier=sandbox).'],
            'components' => ['securitySchemes' => ['bearer' => ['type' => 'http', 'scheme' => 'bearer']]],
            'paths' => [
                '/v1/orders' => ['post' => $p('إنشاء طرد (idempotent بالمرجع)') + ['security' => $sec], 'get' => $p('قائمة طلباتك') + ['security' => $sec]],
                '/v1/orders/{reference}' => ['get' => $p('طلب بمرجعه') + ['security' => $sec]],
                '/v1/validate' => ['post' => $p('تحقق جاف وتصحيح العنوان بلا إرسال') + ['security' => $sec]],
                '/v1/track' => ['post' => $p('حالة طرد') + ['security' => $sec]],
                '/v1/desks' => ['post' => $p('مكاتب Stop Desk لولاية') + ['security' => $sec]],
                '/v1/connections' => ['get' => $p('الشركات المحفوظة') + ['security' => $sec], 'post' => $p('حفظ مفاتيح شركة مشفّرة') + ['security' => $sec]],
                '/v1/webhook' => ['get' => $p('إعداد webhook الصادر') + ['security' => $sec], 'put' => $p('ضبط رابط webhook الصادر') + ['security' => $sec], 'delete' => $p('حذفه') + ['security' => $sec]],
                '/v1/usage' => ['get' => $p('الاستعمال والحدود') + ['security' => $sec]],
                '/v1/couriers' => ['get' => $p('الشركات المدعومة')], '/v1/wilayas' => ['get' => $p('الولايات')], '/v1/communes' => ['get' => $p('البلديات')], '/health' => ['get' => $p('الحالة')],
            ]];
    }
}

final class HttpError extends \RuntimeException
{
    /** @param array<string,mixed> $fields @param array<string,string> $headers */
    public function __construct(public readonly int $status, public readonly string $errorCode, string $message, public readonly array $fields = [], public readonly array $headers = []) { parent::__construct($message); }
}
