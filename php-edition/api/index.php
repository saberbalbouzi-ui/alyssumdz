<?php
/* واجهة الاستضافة (PHP) للوحة التحكم — بديل GitHub: تقرأ/تكتب ملفات الموقع نفسها بعد تسجيل دخول المدير.
   المرحلة 1: الدخول + الملفات. (الطلبات والإحصاءات تأتي في المرحلة التالية.) */
declare(strict_types=1);

const ROOT_REL = '..';                        // مجلد الموقع = أب مجلد api
$root = realpath(__DIR__ . '/' . ROOT_REL);
$dataDir = __DIR__ . '/_data';
$cfgFile = __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function out(int $code, array $body): never { http_response_code($code); echo json_encode($body, JSON_UNESCAPED_UNICODE); exit; }

if (!is_file($cfgFile)) out(503, ['error' => 'not_installed']);
$cfg = require $cfgFile;                      // ['admin_hash' => ..., 'max_upload_mb' => 8]

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('store_admin');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_start();

$route = $_GET['r'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$isAdmin = !empty($_SESSION['admin']);

/* الكتابة والدخول تتطلب ترويسة مخصصة (تمنع الطلبات العابرة للمواقع CSRF) */
if ($method !== 'GET' && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'XMLHttpRequest') out(403, ['error' => 'bad_request']);

function body(): array {
    $max = 12 * 1024 * 1024;
    $raw = file_get_contents('php://input', false, null, 0, $max + 1);
    if ($raw === false || strlen($raw) > $max) out(413, ['error' => 'too_large']);
    $j = json_decode($raw, true);
    return is_array($j) ? $j : [];
}

/* ── قاعدة البيانات (SQLite داخل api/_data) ── */
function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    global $dataDir;
    ensureData($dataDir);
    $pdo = new PDO('sqlite:' . $dataDir . '/store.db', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $pdo->exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
    $pdo->exec("
      CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY, page TEXT NOT NULL, vid TEXT, is_new INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS visits_created ON visits(created_at);
      CREATE TABLE IF NOT EXISTS presence (vid TEXT PRIMARY KEY, page TEXT NOT NULL, seen_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY, question TEXT NOT NULL, norm TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1, pages TEXT NOT NULL DEFAULT '[]', lang TEXT, status TEXT NOT NULL DEFAULT 'new', last_at INTEGER NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS questions_open ON questions(norm) WHERE status = 'new';
      CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, wilaya TEXT, commune TEXT, dtype TEXT, desk TEXT,
        items_text TEXT NOT NULL DEFAULT '', items TEXT NOT NULL DEFAULT '[]', subtotal REAL NOT NULL DEFAULT 0, fee REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
        coupon TEXT, discount REAL NOT NULL DEFAULT 0, extra TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'nouvelle', note TEXT NOT NULL DEFAULT '');
      CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at);
      CREATE INDEX IF NOT EXISTS orders_phone ON orders(phone, created_at);
      CREATE TABLE IF NOT EXISTS rl (k TEXT NOT NULL, t INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS rl_k ON rl(k, t);
    ");
    return $pdo;
}
/* حدّ معدّل بسيط لكل مفتاح (IP+نوع العملية) */
function rateLimit(string $key, int $max, int $win): void {
    $d = db(); $now = time();
    $st = $d->prepare('SELECT COUNT(*) FROM rl WHERE k = ? AND t > ?'); $st->execute([$key, $now - $win]);
    if ((int)$st->fetchColumn() >= $max) out(429, ['error' => 'rate_limited']);
    $d->prepare('INSERT INTO rl (k, t) VALUES (?, ?)')->execute([$key, $now]);
    if (random_int(1, 200) === 1) {                                  // تنظيف دوري
        $d->prepare('DELETE FROM rl WHERE t < ?')->execute([$now - 7200]);
        $d->prepare('DELETE FROM presence WHERE seen_at < ?')->execute([$now - 86400]);
        $d->prepare('DELETE FROM visits WHERE created_at < ?')->execute([$now - 400 * 86400]);
    }
}
function clientIp(): string { return preg_replace('/[^0-9a-f:.]/i', '', $_SERVER['REMOTE_ADDR'] ?? 'x'); }
function cut(mixed $v, int $n): string { return mb_substr(trim((string)$v), 0, $n); }
function iso(int $t): string { return gmdate('Y-m-d\\TH:i:s\\Z', $t); }
function normQ(string $q): string { $q = mb_strtolower($q); $q = preg_replace('/[^a-z0-9\x{0621}-\x{064A}\x{066E}-\x{06D3}\x{0660}-\x{0669}]+/u', ' ', $q); return trim((string)$q); }

/* قائمة بيضاء لمسارات الكتابة — لا شيء خارجها */
function allowedPath(string $p): bool {
    if ($p === '' || strlen($p) > 200 || strpbrk($p, "\0\\") !== false || str_contains($p, '..') || $p[0] === '/') return false;
    if (in_array($p, ['assets/js/data.js', 'assets/js/wilayas.js', 'index.html'], true)) return true;
    if (preg_match('#^assets/data/[a-z0-9_-]+\.json$#i', $p)) return true;
    if (preg_match('#^p/[a-z0-9][a-z0-9-]{0,80}/index(\.[a-z0-9]+)?\.html$#', $p)) return true;
    if (preg_match('#^assets/img/[a-z0-9_-]+(/[a-z0-9_ ()-]+)*/[a-zA-Z0-9_ ()-]+\.(webp|png|jpe?g|gif)$#', $p)) return true;
    return false;
}
function ensureData(string $d): void { if (!is_dir($d)) @mkdir($d, 0750, true); if (!is_file("$d/.htaccess")) @file_put_contents("$d/.htaccess", "Require all denied\n"); }

/* ══════════ التحديث عن بُعد من قناة موقَّعة (GitHub) ══════════
   الأمان: لا يُقبل إلا بيان (manifest) موقَّع بمفتاح البائع الخاص (ECDSA P-256)، وحزمة يطابق sha256 فيه،
   ولا يُكتب إلا ملفات القائمة البيضاء أدناه، وبنسخة احتياطية قبل الاستبدال. */
const UPD_PLACEHOLDER_NAME = 'اسم متجرك';
const UPD_PLACEHOLDER_WA = '213000000000';
function updAllowed(string $p): bool {
    if ($p === '' || strlen($p) > 120 || str_contains($p, '..') || $p[0] === '/' || strpbrk($p, "\\\0") !== false) return false;
    if (in_array($p, ['admin.html', 'assets/css/style.css', 'api/index.php', 'p/_template/index.html'], true)) return true;
    return (bool)preg_match('#^assets/js/(app|api|agent|agent-brain)\.js$#', $p);
}
function updConfig(): ?array {
    $f = __DIR__ . '/update-config.php'; $k = __DIR__ . '/update-key.pem';
    if (!is_file($f) || !is_file($k)) return null;
    $c = require $f;
    if (!is_array($c) || empty($c['channel'])) return null;
    $c['key'] = (string)file_get_contents($k);
    return $c;
}
function updSecureUrl(string $u): bool {
    $h = parse_url($u, PHP_URL_HOST); $sc = parse_url($u, PHP_URL_SCHEME);
    if (!$h) return false;
    return $sc === 'https' || (in_array($h, ['127.0.0.1', 'localhost'], true) && $sc === 'http');   // http محلي للاختبار فقط
}
function updHttpGet(string $url, int $maxBytes = 25 * 1048576): string {
    if (!updSecureUrl($url)) throw new RuntimeException('insecure_url');
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3, CURLOPT_TIMEOUT => 40, CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_MAXFILESIZE => $maxBytes, CURLOPT_USERAGENT => 'store-updater', CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS | CURLPROTO_HTTP, CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS]);
        $b = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
        if ($b === false || $code !== 200) throw new RuntimeException('download_failed');
    } else {
        $b = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 40, 'user_agent' => 'store-updater', 'follow_location' => 1], 'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]));
        if ($b === false) throw new RuntimeException('download_failed');
    }
    if (strlen($b) > $maxBytes) throw new RuntimeException('too_large');
    return $b;
}
function updRawToDer(string $raw): ?string {        // WebCrypto يُعطي r||s (64 بايت)؛ OpenSSL يريد DER
    if (strlen($raw) !== 64) return null;
    $int = function (string $x): string { $x = ltrim($x, "\0"); if ($x === '') $x = "\0"; if (ord($x[0]) & 0x80) $x = "\0" . $x; return "\x02" . chr(strlen($x)) . $x; };
    $body = $int(substr($raw, 0, 32)) . $int(substr($raw, 32));
    return "\x30" . chr(strlen($body)) . $body;
}
/** يجلب latest.json، يتحقق من التوقيع، ويُرجع البيان (manifest) كمصفوفة */
function updFetchManifest(array $c): array {
    $j = json_decode(updHttpGet(rtrim($c['channel'], '/') . '/latest.json', 1048576), true);
    if (!is_array($j) || !isset($j['manifest'], $j['sig']) || !is_string($j['manifest']) || !is_string($j['sig'])) throw new RuntimeException('bad_latest');
    $der = updRawToDer((string)base64_decode($j['sig'], true));
    $pub = openssl_pkey_get_public($c['key']);
    if (!$der || !$pub || openssl_verify($j['manifest'], $der, $pub, OPENSSL_ALGO_SHA256) !== 1) throw new RuntimeException('bad_signature');
    $m = json_decode($j['manifest'], true);
    if (!is_array($m) || !preg_match('/^\d+\.\d+\.\d+$/', (string)($m['version'] ?? '')) || !preg_match('/^[a-f0-9]{64}$/', (string)($m['sha256'] ?? ''))
        || !preg_match('#^[0-9.]+/update\.zip$#', (string)($m['url'] ?? '')) || (int)($m['size'] ?? 0) < 100) throw new RuntimeException('bad_manifest');
    return $m;
}
function updCurrentVersion(string $root): string { $v = json_decode((string)@file_get_contents("$root/version.json"), true)['version'] ?? '0.0.0'; return preg_match('/^\d+\.\d+\.\d+$/', (string)$v) ? $v : '0.0.0'; }
function updSiteIdentity(string $root): array {
    $cfg = (string)@file_get_contents("$root/assets/js/config.js");
    $name = preg_match('/name:\s*("(?:[^"\\\\]|\\\\.)*")/u', $cfg, $m) ? json_decode($m[1]) : null;
    $wa = preg_match('/waNumber:\s*"(\d{6,15})"/', $cfg, $m2) ? $m2[1] : null;
    return [$name, $wa];
}
function updSyntaxOk(string $php): bool { try { token_get_all($php, TOKEN_PARSE); return true; } catch (ParseError $e) { return false; } }
function updReplaceFile(string $full, string $data): void {
    @mkdir(dirname($full), 0755, true);
    $tmp = $full . '.upd' . bin2hex(random_bytes(3));
    if (file_put_contents($tmp, $data, LOCK_EX) === false || !rename($tmp, $full)) { @unlink($tmp); throw new RuntimeException('write_failed'); }
}

function isImagePath(string $p): bool { return (bool)preg_match('#\.(webp|png|jpe?g|gif)$#i', $p); }

switch ($route) {
    case 'login':
        if ($method !== 'POST') out(405, ['error' => 'method']);
        ensureData($dataDir);
        $ip = preg_replace('/[^0-9a-f:.]/i', '', $_SERVER['REMOTE_ADDR'] ?? 'x');
        $f = "$dataDir/rl_" . md5($ip) . '.json';
        $st = is_file($f) ? (json_decode((string)file_get_contents($f), true) ?: []) : [];
        $st = array_values(array_filter($st, fn($t) => $t > time() - 600));
        if (count($st) >= 5) out(429, ['error' => 'too_many_attempts']);
        $pw = (string)(body()['password'] ?? '');
        if (!password_verify($pw, (string)$cfg['admin_hash'])) {
            $st[] = time(); file_put_contents($f, json_encode($st));
            usleep(400000);
            out(401, ['error' => 'invalid_credentials']);
        }
        @unlink($f);
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
        out(200, ['ok' => true]);

    case 'logout':
        $_SESSION = []; session_destroy();
        out(200, ['ok' => true]);

    case 'me':
        out(200, ['admin' => $isAdmin]);

    /* ── عمليات الزوار (بلا تسجيل دخول) ── */
    case 'hit':
        if ($method !== 'POST') out(405, ['error' => 'method']);
        rateLimit('hit' . clientIp(), 300, 3600);
        $b = body(); $page = cut($b['page'] ?? '', 60);
        if ($page === '') out(200, ['ok' => true]);
        db()->prepare('INSERT INTO visits (page, vid, is_new, created_at) VALUES (?, ?, ?, ?)')->execute([$page, cut($b['vid'] ?? '', 40), !empty($b['isNew']) ? 1 : 0, time()]);
        out(200, ['ok' => true]);

    case 'ping':
        if ($method !== 'POST') out(405, ['error' => 'method']);
        rateLimit('ping' . clientIp(), 600, 3600);
        $b = body(); $vid = cut($b['vid'] ?? '', 40); $page = cut($b['page'] ?? '', 60);
        if ($vid !== '' && $page !== '') db()->prepare('INSERT INTO presence (vid, page, seen_at) VALUES (?, ?, ?) ON CONFLICT(vid) DO UPDATE SET page = excluded.page, seen_at = excluded.seen_at')->execute([$vid, $page, time()]);
        out(200, ['ok' => true]);

    case 'question':
        if ($method !== 'POST') out(405, ['error' => 'method']);
        rateLimit('q' . clientIp(), 40, 3600);
        $b = body(); $q = cut($b['q'] ?? '', 300);
        if (mb_strlen($q) < 3) out(200, ['ok' => true]);
        $n = normQ($q); $page = cut($b['page'] ?? '', 60); $lang = cut($b['lang'] ?? 'ar', 5);
        $d = db(); $st = $d->prepare("SELECT id, pages FROM questions WHERE norm = ? AND status = 'new'"); $st->execute([$n]); $row = $st->fetch();
        if ($row) {
            $pages = json_decode($row['pages'], true) ?: [];
            if ($page !== '' && !in_array($page, $pages, true)) $pages[] = $page;
            $d->prepare('UPDATE questions SET count = count + 1, pages = ?, last_at = ? WHERE id = ?')->execute([json_encode(array_slice($pages, 0, 20)), time(), $row['id']]);
        } else {
            $d->prepare('INSERT INTO questions (question, norm, pages, lang, last_at) VALUES (?, ?, ?, ?, ?)')->execute([$q, $n, json_encode($page !== '' ? [$page] : []), $lang, time()]);
        }
        out(200, ['ok' => true]);

    case 'order':
        if ($method !== 'POST') out(405, ['error' => 'method']);
        $ip = clientIp(); rateLimit('ord' . $ip, 20, 3600);
        $o = body()['order'] ?? [];
        $name = cut($o['name'] ?? '', 120); $phone = preg_replace('/[^0-9+]/', '', (string)($o['phone'] ?? ''));
        $items = is_array($o['items'] ?? null) ? array_slice($o['items'], 0, 50) : [];
        $total = is_numeric($o['total'] ?? null) ? (float)$o['total'] : -1;
        if (mb_strlen($name) < 2) out(422, ['error' => 'invalid_name']);
        if (strlen($phone) < 6 || strlen($phone) > 20) out(422, ['error' => 'invalid_phone']);
        if (count($items) < 1) out(422, ['error' => 'invalid_items']);
        if ($total < 0 || $total > 10000000) out(422, ['error' => 'invalid_total']);
        $d = db();
        $st = $d->prepare('SELECT COUNT(*) FROM orders WHERE phone = ? AND created_at > ?'); $st->execute([$phone, time() - 600]);
        if ((int)$st->fetchColumn() >= 5) out(429, ['error' => 'rate_limited']);
        $lines = []; $clean = [];
        foreach ($items as $i) {
            if (!is_array($i)) continue;
            $qty = max(1, (int)($i['qty'] ?? 1)); $price = (float)($i['price'] ?? 0); $title = cut($i['title'] ?? '', 160);
            $lines[] = "$title ×$qty = " . round($price * $qty) . ' DA';
            $clean[] = ['slug' => cut($i['slug'] ?? '', 80), 'title' => $title, 'qty' => $qty, 'price' => $price];
        }
        $id = 'S' . date('ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 5));
        $extra = is_array($o['extra'] ?? null) ? json_encode($o['extra'], JSON_UNESCAPED_UNICODE) : '{}';
        if (strlen($extra) > 4000) $extra = '{}';
        $d->prepare('INSERT INTO orders (id, created_at, name, phone, wilaya, commune, dtype, desk, items_text, items, subtotal, fee, total, coupon, discount, extra) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          ->execute([$id, time(), $name, $phone, cut($o['wilaya'] ?? '', 80), cut($o['commune'] ?? '', 120), cut($o['dtype'] ?? '', 10), cut($o['desk'] ?? '', 160),
            implode("\n", $lines), json_encode($clean, JSON_UNESCAPED_UNICODE), (float)($o['subtotal'] ?? 0), (float)($o['fee'] ?? 0), $total, cut($o['coupon'] ?? '', 40), (float)($o['discount'] ?? 0), $extra]);
        out(200, ['ok' => true, 'id' => $id]);

    /* ── قراءات وتعديلات المدير ── */
    case 'orders':
        if (!$isAdmin) out(401, ['error' => 'unauthorized']);
        $rows = db()->query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 2000')->fetchAll();
        out(200, ['ok' => true, 'orders' => array_map(fn($r) => [
            'id' => $r['id'], 'date' => iso((int)$r['created_at']), 'name' => $r['name'], 'phone' => $r['phone'], 'wilaya' => $r['wilaya'], 'commune' => $r['commune'],
            'dtype' => $r['dtype'], 'desk' => $r['desk'], 'items' => $r['items_text'], 'subtotal' => (float)$r['subtotal'], 'fee' => (float)$r['fee'], 'total' => (float)$r['total'],
            'coupon' => $r['coupon'], 'discount' => (float)$r['discount'], 'extra' => json_decode($r['extra'], true) ?: new stdClass, 'status' => $r['status'], 'note' => $r['note']], $rows)]);

    case 'order_update':
        if (!$isAdmin) out(401, ['error' => 'unauthorized']);
        if ($method !== 'POST') out(405, ['error' => 'method']);
        $b = body(); $id = (string)($b['id'] ?? ''); $set = []; $args = [];
        if (isset($b['status'])) { if (!in_array($b['status'], ['nouvelle', 'confirmee', 'expediee', 'livree', 'annulee', 'echec'], true)) out(422, ['error' => 'invalid_status']); $set[] = 'status = ?'; $args[] = $b['status']; }
        if (isset($b['note'])) { $set[] = 'note = ?'; $args[] = cut($b['note'], 500); }
        if (!$set || $id === '') out(422, ['error' => 'nothing_to_update']);
        $args[] = $id;
        db()->prepare('UPDATE orders SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
        out(200, ['ok' => true]);

    case 'presence':
        if (!$isAdmin) out(401, ['error' => 'unauthorized']);
        $st = db()->prepare('SELECT page, COUNT(*) c FROM presence WHERE seen_at > ? GROUP BY page'); $st->execute([time() - 75]);
        $by = []; $now = 0; foreach ($st->fetchAll() as $r) { $by[$r['page']] = (int)$r['c']; $now += (int)$r['c']; }
        out(200, ['ok' => true, 'now' => $now, 'byPage' => $by ?: new stdClass]);

    case 'analytics':
        if (!$isAdmin) out(401, ['error' => 'unauthorized']);
        $d = db(); $day0 = strtotime('today');
        $map = function (string $sql, array $a = []) use ($d) { $st = $d->prepare($sql); $st->execute($a); $o = []; foreach ($st->fetchAll() as $r) $o[$r['k']] = (int)$r['c']; return $o ?: new stdClass; };
        out(200, ['ok' => true,
            'total' => (int)$d->query('SELECT COUNT(*) FROM visits')->fetchColumn(),
            'unique' => (int)$d->query('SELECT COUNT(*) FROM visits WHERE is_new = 1')->fetchColumn(),
            'today' => (int)$d->query('SELECT COUNT(*) FROM visits WHERE created_at >= ' . $day0)->fetchColumn(),
            'pages' => $map('SELECT page k, COUNT(*) c FROM visits GROUP BY page'),
            'todayPages' => $map('SELECT page k, COUNT(*) c FROM visits WHERE created_at >= ? GROUP BY page', [$day0]),
            'days' => $map("SELECT strftime('%Y-%m-%d', created_at, 'unixepoch') k, COUNT(*) c FROM visits WHERE created_at > ? GROUP BY 1", [time() - 30 * 86400])]);

    case 'questions':
        if (!$isAdmin) out(401, ['error' => 'unauthorized']);
        $rows = db()->query("SELECT * FROM questions WHERE status = 'new' ORDER BY count DESC, last_at DESC LIMIT 500")->fetchAll();
        out(200, ['ok' => true, 'questions' => array_map(fn($r) => ['id' => (int)$r['id'], 'q' => $r['question'], 'count' => (int)$r['count'], 'pages' => json_decode($r['pages'], true) ?: [], 'lang' => $r['lang'], 'last' => iso((int)$r['last_at'])], $rows)]);

    case 'question_resolve':
        if (!$isAdmin) out(401, ['error' => 'unauthorized']);
        if ($method !== 'POST') out(405, ['error' => 'method']);
        db()->prepare("UPDATE questions SET status = 'done' WHERE id = ?")->execute([(int)(body()['id'] ?? 0)]);
        out(200, ['ok' => true]);

    case 'update_check':
        if (!$isAdmin) out(401, ['error' => 'unauthorized']);
        $c = updConfig();
        $cur = updCurrentVersion($root);
        if (!$c) out(200, ['ok' => true, 'enabled' => false, 'current' => $cur]);
        try { $m = updFetchManifest($c); }
        catch (Throwable $e) { out(200, ['ok' => true, 'enabled' => true, 'current' => $cur, 'error' => $e->getMessage()]); }
        ensureData($dataDir);
        $hasBackup = (glob("$dataDir/backups/code-*.zip") ?: []) !== [];
        out(200, ['ok' => true, 'enabled' => true, 'current' => $cur, 'latest' => $m['version'], 'available' => version_compare($m['version'], $cur, '>'),
                  'notes' => cut($m['notes'] ?? '', 2000), 'released' => cut($m['released'] ?? '', 40), 'canRollback' => $hasBackup]);

    case 'update_apply':
        if (!$isAdmin) out(401, ['error' => 'unauthorized']);
        if ($method !== 'POST') out(405, ['error' => 'method']);
        $c = updConfig(); if (!$c) out(400, ['error' => 'updates_disabled']);
        if (!class_exists('ZipArchive')) out(500, ['error' => 'zip_missing']);
        ensureData($dataDir);
        $lock = fopen("$dataDir/update.lock", 'c'); if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) out(409, ['error' => 'busy']);
        try {
            $cur = updCurrentVersion($root);
            $m = updFetchManifest($c);                                            // التوقيع يُتحقق منه من جديد؛ لا نثق بشيء من المتصفح
            if (!version_compare($m['version'], $cur, '>')) throw new RuntimeException('not_newer');
            $zipData = updHttpGet(rtrim($c['channel'], '/') . '/' . $m['url']);
            if (strlen($zipData) !== (int)$m['size'] || !hash_equals($m['sha256'], hash('sha256', $zipData))) throw new RuntimeException('hash_mismatch');
            $tmpZip = "$dataDir/incoming.zip"; file_put_contents($tmpZip, $zipData, LOCK_EX);
            $z = new ZipArchive(); if ($z->open($tmpZip) !== true) throw new RuntimeException('bad_zip');
            $files = [];
            for ($i = 0; $i < $z->numFiles; $i++) {
                $n = $z->getNameIndex($i);
                if (str_ends_with($n, '/')) continue;
                if ($n === 'version.json') continue;                              // يُكتب من البيان الموقَّع لا من الحزمة
                if (!updAllowed($n)) throw new RuntimeException('forbidden_path');
                $d = $z->getFromIndex($i); if ($d === false || strlen($d) > 3 * 1048576) throw new RuntimeException('bad_entry');
                $files[$n] = $d;
            }
            $z->close(); @unlink($tmpZip);
            if (!$files) throw new RuntimeException('empty_update');
            [$name, $wa] = updSiteIdentity($root);
            if (!$name || !$wa || !preg_match('/^[\p{L}\p{N} .&-]+$/u', (string)$name)) throw new RuntimeException('identity_unreadable');
            foreach ($files as $n => $d) {                                         // أعد اسم المتجر ورقم واتساب الحقيقيين مكان القيم الافتراضية
                if (preg_match('/\.(html|js)$/', $n)) $files[$n] = str_replace([UPD_PLACEHOLDER_NAME, UPD_PLACEHOLDER_WA], [$name, $wa], $d);
                if (str_ends_with($n, '.php') && !updSyntaxOk($files[$n])) throw new RuntimeException('php_syntax');
            }
            /* نسخة احتياطية للملفات التي ستُستبدل */
            $bk = new ZipArchive(); $bkPath = "$dataDir/backups/code-" . date('Ymd-His') . '-v' . $cur . '.zip'; @mkdir(dirname($bkPath), 0750, true);
            if ($bk->open($bkPath, ZipArchive::CREATE) !== true) throw new RuntimeException('backup_failed');
            foreach (array_keys($files) as $n) if (is_file("$root/$n")) $bk->addFile("$root/$n", $n);
            $bk->addFromString('meta.json', json_encode(['version' => $cur])); $bk->close();
            $olds = glob("$dataDir/backups/code-*.zip") ?: []; sort($olds); foreach (array_slice($olds, 0, max(0, count($olds) - 3)) as $o) @unlink($o);
            /* الكتابة: api/index.php أخيراً حتى لا ينقطع التحديث لو فشل شيء قبله */
            $last = $files['api/index.php'] ?? null; unset($files['api/index.php']);
            foreach ($files as $n => $d) updReplaceFile("$root/$n", $d);
            if ($last !== null) updReplaceFile("$root/api/index.php", $last);
            updReplaceFile("$root/version.json", json_encode(['version' => $m['version']]) . "\n");
            @unlink("$dataDir/update-cache.json");
            flock($lock, LOCK_UN);
            out(200, ['ok' => true, 'version' => $m['version'], 'files' => count($files) + ($last !== null ? 1 : 0)]);
        } catch (Throwable $e) {
            @unlink("$dataDir/incoming.zip"); flock($lock, LOCK_UN);
            out(422, ['error' => $e->getMessage()]);
        }

    case 'update_rollback':
        if (!$isAdmin) out(401, ['error' => 'unauthorized']);
        if ($method !== 'POST') out(405, ['error' => 'method']);
        if (!class_exists('ZipArchive')) out(500, ['error' => 'zip_missing']);
        $baks = glob("$dataDir/backups/code-*.zip") ?: []; sort($baks);
        if (!$baks) out(404, ['error' => 'no_backup']);
        $path = end($baks); $z = new ZipArchive();
        if ($z->open($path) !== true) out(500, ['error' => 'bad_backup']);
        $meta = json_decode((string)$z->getFromName('meta.json'), true); $ver = $meta['version'] ?? null;
        if (!$ver || !preg_match('/^\d+\.\d+\.\d+$/', (string)$ver)) out(500, ['error' => 'bad_backup']);
        $files = [];
        for ($i = 0; $i < $z->numFiles; $i++) { $n = $z->getNameIndex($i); if ($n === 'meta.json') continue; if (!updAllowed($n)) out(500, ['error' => 'forbidden_path']); $files[$n] = (string)$z->getFromIndex($i); }
        $z->close();
        $last = $files['api/index.php'] ?? null; unset($files['api/index.php']);
        foreach ($files as $n => $d) updReplaceFile("$root/$n", $d);
        if ($last !== null) updReplaceFile("$root/api/index.php", $last);
        updReplaceFile("$root/version.json", json_encode(['version' => $ver]) . "\n");
        @rename($path, $path . '.used');
        out(200, ['ok' => true, 'version' => $ver]);

    /* وسيط شركات التوصيل (إرسال الطرود وتتبع الحالات) — للمدير فقط. يمنع الوصول إلى عناوين داخلية (SSRF). */
    case 'courier':
        if (!$isAdmin) out(401, ['error' => 'unauthorized']);
        if ($method !== 'POST') out(405, ['error' => 'method']);
        $b = body(); $url = (string)($b['url'] ?? ''); $m = strtoupper((string)($b['method'] ?? 'GET'));
        if (!in_array($m, ['GET', 'POST', 'PUT'], true)) out(400, ['error' => 'method']);
        $pu = parse_url($url); $host = (string)($pu['host'] ?? ''); $sc = (string)($pu['scheme'] ?? '');
        $localOk = !empty($cfg['allow_local_courier']) && in_array($host, ['127.0.0.1', 'localhost'], true) && $sc === 'http';
        if ($host === '' || ($sc !== 'https' && !$localOk)) out(400, ['error' => 'insecure_url']);
        $ip = filter_var($host, FILTER_VALIDATE_IP) ? $host : gethostbyname($host);
        if (!filter_var($ip, FILTER_VALIDATE_IP)) out(400, ['error' => 'dns_failed']);
        if (!$localOk && !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) out(400, ['error' => 'private_address']);
        $hdr = [];
        foreach ((array)($b['headers'] ?? []) as $k => $v) { if (is_string($k) && preg_match('/^[A-Za-z0-9-]{1,40}$/', $k) && !preg_match("/[\r\n]/", (string)$v)) $hdr[] = "$k: $v"; }
        if (!function_exists('curl_init')) out(500, ['error' => 'curl_missing']);
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => false, CURLOPT_TIMEOUT => 25, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_MAXFILESIZE => 2097152,
            CURLOPT_USERAGENT => 'store-courier', CURLOPT_CUSTOMREQUEST => $m, CURLOPT_HTTPHEADER => $hdr, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2]);
        if ($m !== 'GET' && isset($b['body'])) curl_setopt($ch, CURLOPT_POSTFIELDS, (string)$b['body']);
        $resp = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
        if ($resp === false) out(502, ['error' => 'upstream_failed']);
        out(200, ['ok' => true, 'status' => $code, 'body' => substr((string)$resp, 0, 200000)]);

    case 'file':
        if (!$isAdmin) out(401, ['error' => 'unauthorized']);
        if ($method === 'GET') {
            $p = (string)($_GET['path'] ?? '');
            if (!allowedPath($p)) out(400, ['error' => 'path_not_allowed']);
            $full = "$root/$p";
            if (!is_file($full)) out(404, ['error' => 'not_found']);
            $c = (string)file_get_contents($full);
            out(200, ['sha' => sha1($c), 'content' => base64_encode($c)]);
        }
        if ($method === 'PUT') {
            $b = body();
            $p = (string)($b['path'] ?? '');
            if (!allowedPath($p)) out(400, ['error' => 'path_not_allowed']);
            $data = base64_decode((string)($b['content'] ?? ''), true);
            if ($data === false) out(400, ['error' => 'bad_content']);
            if (isImagePath($p)) {
                if (strlen($data) > ((int)($cfg['max_upload_mb'] ?? 8)) * 1048576) out(413, ['error' => 'too_large']);
                $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($data);
                if (!in_array($mime, ['image/webp', 'image/png', 'image/jpeg', 'image/gif'], true)) out(415, ['error' => 'not_an_image']);
            }
            $full = "$root/$p";
            $exists = is_file($full);
            if ($exists) {
                $cur = (string)file_get_contents($full);
                if (!empty($b['sha']) && !hash_equals(sha1($cur), (string)$b['sha'])) out(409, ['error' => 'conflict']);
                /* نسخة احتياطية قبل الاستبدال (آخر 10 لكل ملف) */
                $bd = "$dataDir/backups/" . md5($p);
                ensureData($dataDir); @mkdir($bd, 0750, true);
                file_put_contents("$bd/" . date('Ymd-His') . '.bak', $cur);
                $olds = glob("$bd/*.bak") ?: []; sort($olds);
                foreach (array_slice($olds, 0, max(0, count($olds) - 10)) as $o) @unlink($o);
            } elseif (!empty($b['sha'])) {
                out(409, ['error' => 'conflict']);
            }
            @mkdir(dirname($full), 0755, true);
            $tmp = $full . '.tmp' . bin2hex(random_bytes(4));
            if (file_put_contents($tmp, $data, LOCK_EX) === false || !rename($tmp, $full)) { @unlink($tmp); out(500, ['error' => 'write_failed']); }
            out(200, ['content' => ['path' => $p, 'sha' => sha1($data)]]);
        }
        out(405, ['error' => 'method']);

    default:
        out(404, ['error' => 'unknown_route']);
}
