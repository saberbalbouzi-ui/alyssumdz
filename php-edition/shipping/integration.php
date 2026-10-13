<?php
declare(strict_types=1);
/**
 * ربط وحدة التجميع بنسخة PHP (api/index.php): قاعدة منفصلة `_data/shipping.sqlite`، مفتاح تشفير يُولَّد تلقائياً في `_data/ship.key`
 * (أو APP_ENCRYPTION_KEY من البيئة)، وربط حالة الطرد بحالة الطلب. التاجر هنا واحد (user_id = 1).
 * الدوال تُرجع [رمز HTTP، مصفوفة] ولا تطبع شيئاً — index.php هو من يخرج الردّ.
 */
require_once __DIR__ . '/src/autoload.php';

use Alyssum\Shipping\{CarrierRegistry, ConnectionRepository, CredentialVault, Parcel, ShippingService, ShippingException, Status, WebhookProcessor, WilayaCatalog};

const SHIPX_USER = 1;

function shipx_boot(string $dataDir, PDO $orders): array
{
    static $ctx = null;
    if ($ctx) { return $ctx; }
    if (!is_dir($dataDir)) { @mkdir($dataDir, 0750, true); }
    if (getenv('APP_ENCRYPTION_KEY') === false || getenv('APP_ENCRYPTION_KEY') === '') {
        $kf = $dataDir . '/ship.key';
        if (!is_file($kf)) { @file_put_contents($kf, base64_encode(random_bytes(32)), LOCK_EX); @chmod($kf, 0600); }
        putenv('APP_ENCRYPTION_KEY=' . trim((string)@file_get_contents($kf)));
    }
    $pdo = new PDO('sqlite:' . $dataDir . '/shipping.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    if (!$pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='user_carriers'")->fetchColumn()) { $pdo->exec((string)file_get_contents(__DIR__ . '/schema.sqlite.sql')); }
    $repo = new ConnectionRepository($pdo, CredentialVault::fromEnv());
    $svc = new ShippingService($pdo, $repo, $GLOBALS["SHIPX_HTTP"] ?? null);   // SHIPX_HTTP للاختبار فقط
    $svc->onStatus = static fn(string $ref, string $carrier, string $trk, string $status) => shipx_apply_to_order($orders, $ref, $status);
    return $ctx = ['pdo' => $pdo, 'repo' => $repo, 'svc' => $svc, 'hook' => new WebhookProcessor($repo, $svc)];
}

/** حالة موحَّدة ← حالة الطلب. قواعد الترتيب نفسها الموجودة في webhook ياليدين: لا رجوع للخلف، والمسلَّم/الملغى نهائيان، والفشل مسموح من أي حالة. */
function shipx_order_status(string $unified): ?string
{
    return match ($unified) {
        Status::SHIPPED, Status::OUT_FOR_DELIVERY => 'expediee',
        Status::DELIVERED => 'livree',
        Status::RETURNED => 'echec',
        default => null,                                                      // pending/failed_attempt/cancelled/unknown لا تغيّر الطلب
    };
}

function shipx_apply_to_order(PDO $orders, string $orderId, string $unified): bool
{
    $new = shipx_order_status($unified); if ($new === null) { return false; }
    $st = $orders->prepare('SELECT status FROM orders WHERE id = ?'); $st->execute([$orderId]); $cur = $st->fetchColumn();
    if ($cur === false) { return false; }
    $rank = ['nouvelle' => 0, 'confirmee' => 1, 'expediee' => 2, 'livree' => 3];
    $ok = in_array($cur, ['livree', 'annulee'], true) ? false : ($new === 'echec' ? $cur !== 'echec' : (($rank[$new] ?? 0) > ($rank[$cur] ?? 0)));
    if ($ok) { $orders->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute([$new, $orderId]); }
    return $ok;
}

/** اسم الولاية المخزَّن في الطلب ("16", "16 - Alger", "Alger", "الجزائر"…) ← رمز 1..69 */
function shipx_wilaya_code(string $w): int
{
    $w = trim($w);
    if (preg_match('/^\s*(\d{1,2})\b/', $w, $m) && WilayaCatalog::name((int)$m[1]) !== null) { return (int)$m[1]; }
    $fold = static fn(string $s): string => preg_replace('/[^a-z0-9]+/', '', strtr(mb_strtolower($s), ['é' => 'e', 'è' => 'e', 'ê' => 'e', 'à' => 'a', 'â' => 'a', 'î' => 'i', 'ï' => 'i', 'ô' => 'o', 'ù' => 'u', 'û' => 'u', 'ç' => 'c', 'ï' => 'i']));
    $f = $fold($w);
    foreach (WilayaCatalog::ALL as $code => [$name]) { if ($f !== '' && $fold($name) === $f) { return $code; } }
    foreach (WilayaCatalog::ALL as $code => [$name]) { if ($f !== '' && (str_contains($f, $fold($name)) || str_contains($fold($name), $f))) { return $code; } }
    return 0;
}

function shipx_origin(): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . rtrim(dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')), '/');
}

/** @return array{0:int,1:array<string,mixed>} */
function shipx_route(string $route, string $method, array $b, string $dataDir, PDO $orders): array
{
    try { $x = shipx_boot($dataDir, $orders); }
    catch (Throwable $e) { error_log('shipx boot: ' . $e->getMessage()); return [503, ['error' => 'ship_unavailable', 'hint' => 'تأكد من تفعيل openssl وpdo_sqlite وcurl في الاستضافة']]; }
    /** @var ConnectionRepository $repo */ $repo = $x['repo']; /** @var ShippingService $svc */ $svc = $x['svc'];
    try {
        switch ($route) {
            case 'ship_carriers':
                $rows = $x['pdo']->query('SELECT carrier_code, public_id, base_url, updated_at FROM user_carriers WHERE is_active=1 AND user_id=' . SHIPX_USER)->fetchAll();
                return [200, ['carriers' => CarrierRegistry::catalog(), 'connected' => $rows, 'webhook_base' => shipx_origin() . '/index.php?r=ship_webhook']];

            case 'ship_connect':
                if ($method !== 'POST') { return [405, ['error' => 'method']]; }
                $cred = []; foreach ((array)($b['credentials'] ?? []) as $k => $v) { if (is_string($k) && is_scalar($v)) { $cred[$k] = trim((string)$v); } }
                $base = isset($b['base_url']) && trim((string)$b['base_url']) !== '' ? trim((string)$b['base_url']) : null;
                if ($base !== null && !preg_match('#^https://[a-z0-9.-]+(/[^\s]*)?$#i', $base)) { return [400, ['error' => 'bad_base_url']]; }
                $r = $repo->connect(SHIPX_USER, (string)($b['carrier'] ?? ''), $cred, $base, true);   // يفحص المفاتيح عند الشركة قبل الحفظ
                return [200, ['ok' => true, 'verified' => $r['ping']['ok'] === true, 'verify_note' => $r['ping']['ok'] === true ? '' : (string)$r['ping']['message'], 'webhook_url' => shipx_origin() . '/index.php?r=ship_webhook&c=' . $r['public_id'] . '&t=' . $r['webhook_secret'], 'note' => 'الرابط يظهر مرة واحدة فقط — ضعه في حسابك عند الشركة']];

            case 'ship_ping':                                                  // اختبار اتصال شركة مفعّلة بمفاتيحها المحفوظة (قراءة فقط)
                $conn = $repo->find(SHIPX_USER, (string)($b['carrier'] ?? $_GET['carrier'] ?? '')) ?? null;
                if (!$conn || !(int)$conn['is_active']) { return [404, ['error' => 'not_connected']]; }
                return [200, $repo->adapterFor($conn)->ping()];

            case 'ship_unknown':                                               // حالات أرجعتها الشركات ولا يعرفها القاموس (للمراجعة بدل الصمت)
                return [200, ['unknown' => $svc->unknownStatuses(SHIPX_USER)]];

            case 'ship_disconnect':
                if ($method !== 'POST') { return [405, ['error' => 'method']]; }
                $repo->disconnect(SHIPX_USER, (string)($b['carrier'] ?? '')); return [200, ['ok' => true]];

            case 'ship_send':
                if ($method !== 'POST') { return [405, ['error' => 'method']]; }
                $carrier = (string)($b['carrier'] ?? ''); $id = (string)($b['order_id'] ?? '');
                $st = $orders->prepare('SELECT * FROM orders WHERE id = ?'); $st->execute([$id]); $o = $st->fetch();
                if (!$o) { return [404, ['error' => 'order_not_found']]; }
                if (in_array($o['status'], ['annulee', 'livree'], true)) { return [409, ['error' => 'order_closed']]; }
                if (preg_match('/🚚[a-z0-9_]+:([A-Za-z0-9._-]+)/u', (string)$o['note'], $m)) { return [409, ['error' => 'already_sent', 'tracking' => $m[1]]]; }
                $w = shipx_wilaya_code((string)$o['wilaya']);
                if ($w === 0) { return [422, ['error' => 'unknown_wilaya', 'wilaya' => (string)$o['wilaya']]]; }
                $extra = json_decode((string)$o['extra'], true) ?: [];
                $parcel = new Parcel(orderRef: (string)$o['id'], name: (string)$o['name'], phone: (string)$o['phone'], wilayaCode: $w, commune: (string)($o['commune'] ?? ''),
                    address: trim((string)($extra['address'] ?? $extra['العنوان'] ?? '') ?: (string)($o['commune'] ?? '')), total: (float)$o['total'], shippingFee: (float)$o['fee'],
                    products: str_replace("\n", ' + ', trim((string)$o['items_text'])), stopDesk: ($o['dtype'] ?? '') === 'stop', deskId: ctype_digit((string)($o['desk'] ?? '')) ? (int)$o['desk'] : null, deskCode: (string)($o['desk'] ?? ''));
                $r = $svc->ship(SHIPX_USER, $carrier, $parcel);
                if (!$r->ok) { return [502, ['error' => 'carrier_rejected', 'message' => $r->error]]; }
                $code = CarrierRegistry::resolve($carrier) ?? $carrier;
                if ($r->error !== 'duplicate') {
                    $tag = '🚚' . $code . ':' . $r->tracking;
                    $orders->prepare("UPDATE orders SET note = TRIM(note || ' ' || ?) WHERE id = ? AND note NOT LIKE '%🚚%'")->execute([$tag, $id]);
                }
                return [200, ['ok' => true, 'tracking' => $r->tracking, 'duplicate' => $r->error === 'duplicate']];

            case 'ship_track':
                $r = $svc->track(SHIPX_USER, (string)($b['carrier'] ?? $_GET['carrier'] ?? ''), (string)($b['tracking'] ?? $_GET['tracking'] ?? ''));
                return [200, ['tracking' => $r->tracking, 'raw_status' => $r->rawStatus, 'status' => $r->status]];

            case 'ship_cancel':
                if ($method !== 'POST') { return [405, ['error' => 'method']]; }
                $ok = $svc->cancel(SHIPX_USER, (string)($b['carrier'] ?? ''), (string)($b['tracking'] ?? ''));
                if ($ok && ($oid = (string)($b['order_id'] ?? '')) !== '') { $orders->prepare("UPDATE orders SET note = TRIM(REPLACE(note, ?, '')) WHERE id = ?")->execute(['🚚' . (CarrierRegistry::resolve((string)$b['carrier']) ?? '') . ':' . (string)$b['tracking'], $oid]); }
                return [$ok ? 200 : 409, ['ok' => $ok]];

            case 'ship_label':
                $conn = $repo->find(SHIPX_USER, (string)($b['carrier'] ?? $_GET['carrier'] ?? '')) ?? null;
                if (!$conn) { return [404, ['error' => 'not_connected']]; }
                return [200, ['url' => $repo->adapterFor($conn)->labelUrl((string)($b['tracking'] ?? $_GET['tracking'] ?? ''))]];

            case 'ship_webhook':
                $headers = []; foreach ($_SERVER as $k => $v) { if (str_starts_with($k, 'HTTP_')) { $headers[strtolower(str_replace('_', '-', substr($k, 5)))] = (string)$v; } }
                [$code, , $body] = $x['hook']->handle($method, array_map('strval', $_GET), $headers, (string)($GLOBALS['SHIPX_RAW'] ?? file_get_contents('php://input', false, null, 0, 1_000_001)));   // SHIPX_RAW للاختبار فقط
                return [$code, json_decode($body, true) ?? ['raw' => $body]];
        }
    } catch (ShippingException $e) {
        return [422, ['error' => 'ship_error', 'message' => $e->getMessage()]];
    } catch (InvalidArgumentException $e) {
        return [422, ['error' => 'bad_parcel', 'message' => $e->getMessage()]];
    } catch (Throwable $e) {
        error_log('shipx: ' . $e::class . ' ' . $e->getMessage());
        return [500, ['error' => 'server']];
    }
    return [404, ['error' => 'unknown_route']];
}
