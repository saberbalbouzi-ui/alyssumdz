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
if ($method !== 'GET' && $route !== 'webhook' && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'XMLHttpRequest') out(403, ['error' => 'bad_request']);   // webhook ياليدين خادم-لخادم: يُصادَق عليه بالسر لا بالترويسة

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
      CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY, phone TEXT NOT NULL UNIQUE, name TEXT NOT NULL, wilaya TEXT, commune TEXT, pass_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS customer_sessions (token_hash TEXT PRIMARY KEY, customer_id INTEGER NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS customer_fails (phone TEXT NOT NULL, at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS customer_fails_k ON customer_fails(phone, at);
      CREATE TABLE IF NOT EXISTS admin_kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS webhook_log (id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, tracking TEXT, raw TEXT, result TEXT, payload TEXT);
      CREATE TABLE IF NOT EXISTS promo_codes (code TEXT PRIMARY KEY, phone TEXT NOT NULL, type TEXT NOT NULL, value REAL NOT NULL DEFAULT 0, min_order REAL NOT NULL DEFAULT 0, expires INTEGER NOT NULL, used_order TEXT, used_at INTEGER, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS rl (k TEXT NOT NULL, t INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS rl_k ON rl(k, t);
    ");
    $ocols = array_column($pdo->query('PRAGMA table_info(orders)')->fetchAll(), 'name');
    if (!in_array('customer_id', $ocols, true)) $pdo->exec('ALTER TABLE orders ADD COLUMN customer_id INTEGER');   // ربط الطلب بحساب زبون
    $pcols = array_column($pdo->query('PRAGMA table_info(promo_codes)')->fetchAll(), 'name');
    if (!in_array('kind', $pcols, true)) { $pdo->exec('ALTER TABLE promo_codes ADD COLUMN kind TEXT'); $pdo->exec('ALTER TABLE promo_codes ADD COLUMN product TEXT'); $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS promo_kind_uq ON promo_codes(phone, kind) WHERE kind IS NOT NULL'); }   // هدايا الترحيب الشخصية
    if (!in_array('ip_hash', $ocols, true)) { $pdo->exec('ALTER TABLE orders ADD COLUMN ip_hash TEXT'); $pdo->exec('CREATE INDEX IF NOT EXISTS orders_ip ON orders(ip_hash, created_at)'); }   // بصمة IP مجزّأة
    return $pdo;
}
/* ── حسابات الزبائن: هاتف + كلمة سر؛ رمز جلسة عشوائي لا يُخزَّن منه إلا الـ sha256 ── */
function custPhone(string $x): string {
    $d = preg_replace('/\D/', '', $x);
    if (str_starts_with($d, '00213')) return '0' . substr($d, 5);
    if (str_starts_with($d, '213') && strlen($d) >= 12) return '0' . substr($d, 3);
    if (strlen($d) === 9 && in_array($d[0], ['5', '6', '7'], true)) return '0' . $d;
    return $d;
}
function custFromToken(string $t): ?int {
    if (!preg_match('/^[0-9a-f]{48}$/', $t)) return null;
    $st = db()->prepare('SELECT customer_id FROM customer_sessions WHERE token_hash = ? AND created_at > ?'); $st->execute([hash('sha256', $t), time() - 180 * 86400]);
    $v = $st->fetchColumn(); return $v === false ? null : (int)$v;
}
function custNewSession(int $cid): string {
    $t = bin2hex(random_bytes(24)); $d = db();
    $d->prepare('INSERT INTO customer_sessions (token_hash, customer_id, created_at) VALUES (?,?,?)')->execute([hash('sha256', $t), $cid, time()]);
    $d->prepare('DELETE FROM customer_sessions WHERE customer_id = ? AND created_at < ?')->execute([$cid, time() - 180 * 86400]);
    return $t;
}
function custProfile(int $cid): array {
    $st = db()->prepare('SELECT name, phone, wilaya, commune FROM customers WHERE id = ?'); $st->execute([$cid]); $r = $st->fetch() ?: [];
    return ['name' => $r['name'] ?? '', 'phone' => $r['phone'] ?? '', 'wilaya' => $r['wilaya'] ?? '', 'commune' => $r['commune'] ?? ''];
}
/* تحويل حالة ياليدين إلى حالتنا (نفس منطق admin.html): livree | echec | expediee | confirmee | null */
function ydMap(string $raw): ?string {
    $t = trim(strtr(mb_strtolower($raw), ['é' => 'e', 'è' => 'e', 'ê' => 'e', 'à' => 'a', 'â' => 'a', 'î' => 'i', 'ï' => 'i', 'ô' => 'o', 'ù' => 'u', 'û' => 'u', 'ç' => 'c']));
    if ($t === '') return null;
    if (preg_match('/^livre/', $t)) return 'livree';
    if (preg_match('/tentative.*(echou|echec)/', $t)) return null;
    if (preg_match('/echec livraison|^retour|retourne|echange.*(echou|echec)/', $t)) return 'echec';
    if (preg_match('/pas encore|pret a expedier|preparation|a verifier/', $t)) return 'confirmee';
    if (preg_match('/expedie|transfert|centre|localisation|vers wilaya|recu a wilaya|sorti en livraison|en attente du client|pret pour livreur|ramasse|en livraison/', $t)) return 'expediee';
    return null;
}
/* ── حماية الطلبات (إعداداتها في admin_kv: guard / guard_secret) ── */
function kvGet(string $k) { $st = db()->prepare('SELECT v FROM admin_kv WHERE k = ?'); $st->execute([$k]); $v = $st->fetchColumn(); return $v === false ? null : json_decode((string)$v, true); }
function guardSecret(): string {
    $s = kvGet('guard_secret'); if (is_string($s) && $s !== '') return $s;
    $s = bin2hex(random_bytes(24)); db()->prepare('INSERT OR IGNORE INTO admin_kv (k, v, updated) VALUES (?,?,?)')->execute(['guard_secret', json_encode($s), time()]);
    $s2 = kvGet('guard_secret'); return is_string($s2) ? $s2 : $s;
}
function guardSig(string $t): string { return hash_hmac('sha256', $t, guardSecret()); }
function ipHash(): string { return substr(hash_hmac('sha256', clientIp(), guardSecret()), 0, 24); }
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
    if (preg_match('#^lp/[a-z0-9][a-z0-9-]{0,60}/index\.html$#', $p)) return true;            // صفحات الهبوط (منشئ الصفحات)
    if (preg_match('#^assets/pages/([a-z0-9][a-z0-9-]{0,60}|index)\.json$#', $p)) return true;
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
        /* حماية الطلبات: روبوتات وتكرار حسب IP — تُفعَّل من لوحة الإدارة ← نموذج الطلب */
        $g = kvGet('guard') ?: []; $iph = ipHash();
        if (!empty($g['antibot'])) {
            if (trim((string)($o['hp'] ?? '')) !== '') out(422, ['error' => 'bot']);
            $tk = explode('.', (string)($o['ftok'] ?? '')); $age = time() - (int)($tk[0] ?? 0);
            if (count($tk) !== 2 || !hash_equals(guardSig($tk[0]), $tk[1]) || $age < 3 || $age > 7200) out(422, ['error' => 'bot']);
            $pn = custPhone($phone);
            if (!preg_match(($g['phoneDz'] ?? true) ? '/^0[567]\d{8}$/' : '/^0[1-9]\d{7,8}$/', $pn) || preg_match('/^0?(\d)\1{7,}$/', $pn) || !preg_match('/\pL/u', $name)) out(422, ['error' => 'invalid_phone']);
            $c = $d->prepare('SELECT COUNT(*) FROM orders WHERE ip_hash = ? AND created_at > ?'); $c->execute([$iph, time() - 3600]);
            if ((int)$c->fetchColumn() >= 8) out(429, ['error' => 'rate_limited']);
        }
        if (!empty($g['dup'])) {
            $slugs = array_values(array_filter(array_map(fn($i) => is_array($i) ? cut($i['slug'] ?? '', 80) : '', $items)));
            if ($slugs) {
                $hrs = max(1, (int)($g['hours'] ?? 24));
                $c = $d->prepare("SELECT items FROM orders WHERE ip_hash = ? AND status <> 'annulee' AND created_at > ?"); $c->execute([$iph, time() - $hrs * 3600]);
                foreach ($c->fetchAll() as $r) foreach ((json_decode((string)$r['items'], true) ?: []) as $it) if (in_array($it['slug'] ?? '', $slugs, true)) out(409, ['error' => 'duplicate_order']);
            }
        }
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
        $cust = custFromToken((string)($o['ctoken'] ?? ''));
        /* كود تخفيض شخصي: يُستهلك مرة واحدة ولصاحب الهاتف؛ إن لم يصلح لا يُرفض الطلب بل يُعلَّم ليراه المدير */
        $promo = strtoupper(trim((string)($o['promo'] ?? '')));
        if ($promo !== '') {
            $u = $d->prepare('UPDATE promo_codes SET used_order = ?, used_at = ? WHERE code = ? AND used_order IS NULL AND expires > ? AND phone = ?');
            $u->execute([$id, time(), $promo, time(), custPhone($phone)]);
            if ($u->rowCount() < 1) { $ex = is_array($o['extra'] ?? null) ? $o['extra'] : []; $ex['promo_invalid'] = $promo; $o['extra'] = $ex; }
        }
        $extra = is_array($o['extra'] ?? null) ? json_encode($o['extra'], JSON_UNESCAPED_UNICODE) : '{}';
        if (strlen($extra) > 4000) $extra = '{}';
        $d->prepare('INSERT INTO orders (id, created_at, name, phone, wilaya, commune, dtype, desk, items_text, items, subtotal, fee, total, coupon, discount, extra, customer_id, ip_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          ->execute([$id, time(), $name, $phone, cut($o['wilaya'] ?? '', 80), cut($o['commune'] ?? '', 120), cut($o['dtype'] ?? '', 10), cut($o['desk'] ?? '', 160),
            implode("\n", $lines), json_encode($clean, JSON_UNESCAPED_UNICODE), (float)($o['subtotal'] ?? 0), (float)($o['fee'] ?? 0), $total, cut($o['coupon'] ?? '', 40), (float)($o['discount'] ?? 0), $extra, $cust, $iph]);
        out(200, ['ok' => true, 'id' => $id]);

    /* ── حسابات الزبائن («حسابي») ── */
    case 'customer_register':
        if ($method !== 'POST') out(405, ['error' => 'method']);
        rateLimit('creg' . clientIp(), 10, 3600);
        $b = body(); $phone = custPhone((string)($b['phone'] ?? '')); $name = cut($b['name'] ?? '', 120); $pw = (string)($b['password'] ?? '');
        if (mb_strlen($name) < 2) out(422, ['error' => 'invalid_name']);
        if (!preg_match('/^0\d{8,9}$/', $phone)) out(422, ['error' => 'invalid_phone']);
        if (strlen($pw) < 6 || strlen($pw) > 72) out(422, ['error' => 'invalid_password']);
        $d = db(); $st = $d->prepare('SELECT 1 FROM customers WHERE phone = ?'); $st->execute([$phone]);
        if ($st->fetchColumn()) out(409, ['error' => 'phone_taken']);
        $d->prepare('INSERT INTO customers (phone, name, wilaya, commune, pass_hash, created_at) VALUES (?,?,?,?,?,?)')
          ->execute([$phone, $name, cut($b['wilaya'] ?? '', 80), cut($b['commune'] ?? '', 120), password_hash($pw, PASSWORD_DEFAULT), time()]);
        $cid = (int)$d->lastInsertId();
        out(200, ['ok' => true, 'token' => custNewSession($cid), 'profile' => custProfile($cid)]);

    case 'customer_login':
        if ($method !== 'POST') out(405, ['error' => 'method']);
        $b = body(); $phone = custPhone((string)($b['phone'] ?? '')); $d = db();
        $d->prepare('DELETE FROM customer_fails WHERE at < ?')->execute([time() - 86400]);
        $st = $d->prepare('SELECT COUNT(*) FROM customer_fails WHERE phone = ? AND at > ?'); $st->execute([$phone, time() - 600]);
        if ((int)$st->fetchColumn() >= 5) out(429, ['error' => 'too_many_attempts']);
        $st = $d->prepare('SELECT id, pass_hash FROM customers WHERE phone = ?'); $st->execute([$phone]); $c = $st->fetch();
        if (!$c || !password_verify((string)($b['password'] ?? ''), $c['pass_hash'])) {
            $d->prepare('INSERT INTO customer_fails (phone, at) VALUES (?,?)')->execute([$phone, time()]);
            usleep(300000); out(401, ['error' => 'invalid_credentials']);
        }
        out(200, ['ok' => true, 'token' => custNewSession((int)$c['id']), 'profile' => custProfile((int)$c['id'])]);

    case 'customer_me':
        if ($method !== 'POST') out(405, ['error' => 'method']);
        $cid = custFromToken((string)(body()['token'] ?? '')); if (!$cid) out(401, ['error' => 'unauthorized']);
        $st = db()->prepare('SELECT id, created_at, items_text, total, status, note FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50'); $st->execute([$cid]);
        out(200, ['ok' => true, 'profile' => custProfile($cid), 'orders' => array_map(fn($r) => [
            'id' => $r['id'], 'date' => iso((int)$r['created_at']), 'items' => $r['items_text'], 'total' => (float)$r['total'], 'status' => $r['status'],
            'tracking' => preg_match('/🚚[a-z0-9_]+:([A-Za-z0-9._-]+)/u', (string)$r['note'], $m) ? $m[1] : ''], $st->fetchAll())]);

    case 'customer_update':
        if ($method !== 'POST') out(405, ['error' => 'method']);
        $b = body(); $cid = custFromToken((string)($b['token'] ?? '')); if (!$cid) out(401, ['error' => 'unauthorized']);
        $name = cut($b['name'] ?? '', 120); if (mb_strlen($name) < 2) out(422, ['error' => 'invalid_name']);
        $d = db(); $np = (string)($b['new_password'] ?? '');
        if ($np !== '') {
            if (strlen($np) < 6 || strlen($np) > 72) out(422, ['error' => 'invalid_password']);
            $st = $d->prepare('SELECT pass_hash FROM customers WHERE id = ?'); $st->execute([$cid]);
            if (!password_verify((string)($b['old_password'] ?? ''), (string)$st->fetchColumn())) out(401, ['error' => 'invalid_credentials']);
            $d->prepare('UPDATE customers SET pass_hash = ? WHERE id = ?')->execute([password_hash($np, PASSWORD_DEFAULT), $cid]);
        }
        $d->prepare('UPDATE customers SET name = ?, wilaya = ?, commune = ? WHERE id = ?')->execute([$name, cut($b['wilaya'] ?? '', 80), cut($b['commune'] ?? '', 120), $cid]);
        out(200, ['ok' => true, 'profile' => custProfile($cid)]);

    case 'customer_logout':
        if ($method !== 'POST') out(405, ['error' => 'method']);
        db()->prepare('DELETE FROM customer_sessions WHERE token_hash = ?')->execute([hash('sha256', (string)(body()['token'] ?? ''))]);
        out(200, ['ok' => true]);

    /* ربط طلب سابق بالحساب: رقم الطلب أو رقم التتبع + نفس هاتف الحساب */
    case 'customer_link_order':
        if ($method !== 'POST') out(405, ['error' => 'method']);
        rateLimit('clink' . clientIp(), 30, 3600);
        $b = body(); $cid = custFromToken((string)($b['token'] ?? '')); if (!$cid) out(401, ['error' => 'unauthorized']);
        $ph = custProfile($cid)['phone']; $d = db(); $k = trim((string)($b['order_id'] ?? ''));
        if (!preg_match('/^[A-Za-z0-9._-]{4,40}$/', $k)) out(200, ['ok' => true, 'linked' => false]);
        $st = $d->prepare('SELECT id, phone, note, customer_id FROM orders WHERE (customer_id IS NULL OR customer_id = ?) AND (id = ? OR note LIKE ?) LIMIT 5'); $st->execute([$cid, strtoupper($k), '%' . $k . '%']);
        foreach ($st->fetchAll() as $o) {
            $tr = preg_match('/🚚[a-z0-9_]+:([A-Za-z0-9._-]+)/u', (string)$o['note'], $m) ? $m[1] : '';
            if (($o['id'] === strtoupper($k) || $tr === $k) && custPhone((string)$o['phone']) === $ph) {
                $d->prepare('UPDATE orders SET customer_id = ? WHERE id = ?')->execute([$cid, $o['id']]);
                out(200, ['ok' => true, 'linked' => true]);
            }
        }
        out(200, ['ok' => true, 'linked' => false]);

    /* فحص كود تخفيض شخصي قبل تطبيقه: يخص هذا الهاتف، غير مستعمل، وصالح */
    case 'promo_check':
        if ($method !== 'POST') out(405, ['error' => 'method']);
        rateLimit('pchk' . clientIp(), 40, 600);
        $b = body(); $code = strtoupper(trim((string)($b['code'] ?? ''))); $ph = custPhone((string)($b['phone'] ?? ''));
        $st = db()->prepare('SELECT * FROM promo_codes WHERE code = ? AND phone = ?'); $st->execute([$code, $ph]); $c = $st->fetch();
        if (!$c) out(200, ['ok' => false, 'error' => 'invalid']);
        if ($c['used_order'] !== null) out(200, ['ok' => false, 'error' => 'used']);
        if ((int)$c['expires'] <= time()) out(200, ['ok' => false, 'error' => 'expired']);
        out(200, ['ok' => true, 'type' => $c['type'], 'value' => (float)$c['value'], 'minOrder' => (float)$c['min_order'], 'expiresAt' => iso((int)$c['expires']), 'product' => (string)($c['product'] ?? '')]);

    /* هدايا الترحيب الشخصية: كود واحد لكل زبون ونوع (reg عند التسجيل، install عند أول فتح للتطبيق المثبّت)، إعداداتها من admin_kv('welcome') */
    case 'customer_claim_gift':
        if ($method !== 'POST') out(405, ['error' => 'method']);
        $b = body(); $cid = custFromToken((string)($b['token'] ?? '')); if (!$cid) out(401, ['error' => 'unauthorized']);
        $k = (string)($b['kind'] ?? ''); if (!in_array($k, ['reg', 'install'], true)) out(422, ['error' => 'invalid_kind']);
        $w = kvGet('welcome'); $gg = is_array($w) ? ($w[$k === 'reg' ? 'register' : 'install'] ?? null) : null;
        if (!is_array($w) || (($w['enabled'] ?? true) === false) || !is_array($gg) || (($gg['enabled'] ?? true) === false)) out(200, ['ok' => false, 'error' => 'disabled']);
        $ph = custProfile($cid)['phone']; $d = db();
        $st = $d->prepare('SELECT * FROM promo_codes WHERE phone = ? AND kind = ?'); $st->execute([$ph, $k]); $c = $st->fetch();
        if (!$c) {
            $code = ($k === 'reg' ? 'WEL-' : 'APP-') . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
            $d->prepare('INSERT OR IGNORE INTO promo_codes (code, phone, type, value, min_order, expires, created, kind, product) VALUES (?,?,?,?,?,?,?,?,?)')
              ->execute([$code, $ph, in_array(($gg['type'] ?? ''), ['percent', 'fixed', 'freeship', 'gift'], true) ? $gg['type'] : 'percent', (float)($gg['value'] ?? 0), (float)($gg['minOrder'] ?? 0), time() + max(1, (int)($gg['days'] ?? 14)) * 86400, time(), $k, ($gg['product'] ?? '') ?: null]);
            $st->execute([$ph, $k]); $c = $st->fetch();
        }
        out(200, ['ok' => true, 'code' => $c['code'], 'type' => $c['type'], 'value' => (float)$c['value'], 'minOrder' => (float)$c['min_order'], 'product' => (string)($c['product'] ?? ''), 'expiresAt' => iso((int)$c['expires']), 'used' => $c['used_order'] !== null]);

    case 'customer_my_gifts':
        if ($method !== 'POST') out(405, ['error' => 'method']);
        $cid = custFromToken((string)(body()['token'] ?? '')); if (!$cid) out(401, ['error' => 'unauthorized']);
        $st = db()->prepare('SELECT * FROM promo_codes WHERE phone = ? AND kind IS NOT NULL'); $st->execute([custProfile($cid)['phone']]); $res = [];
        foreach ($st->fetchAll() as $c) $res[$c['kind']] = ['code' => $c['code'], 'type' => $c['type'], 'value' => (float)$c['value'], 'minOrder' => (float)$c['min_order'], 'product' => (string)($c['product'] ?? ''), 'expiresAt' => iso((int)$c['expires']), 'used' => $c['used_order'] !== null];
        out(200, ['ok' => true, 'gifts' => $res ?: new stdClass]);

    /* المدير ينشئ كوداً شخصياً لهاتف */
    case 'promo_create':
        if (!$isAdmin) out(401, ['error' => 'unauthorized']);
        if ($method !== 'POST') out(405, ['error' => 'method']);
        $b = body(); $ph = custPhone((string)($b['phone'] ?? '')); $type = (string)($b['type'] ?? 'percent');
        if (!preg_match('/^0\d{8,9}$/', $ph) || !in_array($type, ['percent', 'fixed', 'freeship'], true)) out(422, ['error' => 'invalid']);
        $code = 'BACK-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
        db()->prepare('INSERT INTO promo_codes (code, phone, type, value, min_order, expires, created) VALUES (?,?,?,?,?,?,?)')
          ->execute([$code, $ph, $type, (float)($b['value'] ?? 0), (float)($b['min_order'] ?? 0), time() + max(1, (int)($b['days'] ?? 14)) * 86400, time()]);
        out(200, ['ok' => true, 'code' => $code]);

    /* رمز نموذج موقَّع: يطلبه الموقع عند فتح الصفحة، ولا يُقبل الطلب (عند تفعيل الحماية) إلا برمز عمره بين 3 ثوانٍ وساعتين */
    case 'form_token':
        $t = (string)time(); out(200, ['token' => $t . '.' . guardSig($t)]);

    /* تتبّع عام برقم التتبع: الحالة والوجهة فقط (لا اسم ولا هاتف ولا عنوان) */
    case 'track':
        if ($method !== 'POST') out(405, ['error' => 'method']);
        rateLimit('trk' . clientIp(), 40, 60);
        $t = trim((string)(body()['tracking'] ?? ''));
        if (!preg_match('/^[A-Za-z0-9._-]{4,40}$/', $t)) out(200, ['found' => false]);
        $st = db()->prepare('SELECT status, created_at, wilaya, commune, dtype, note FROM orders WHERE note LIKE ? LIMIT 5'); $st->execute(['%' . $t . '%']);
        foreach ($st->fetchAll() as $o) {
            if (preg_match('/🚚[a-z0-9_]+:([A-Za-z0-9._-]+)/u', (string)$o['note'], $m) && $m[1] === $t)
                out(200, ['found' => true, 'status' => $o['status'], 'date' => iso((int)$o['created_at']), 'wilaya' => $o['wilaya'] ?? '', 'commune' => $o['commune'] ?? '', 'dtype' => $o['dtype'] ?? '']);
        }
        out(200, ['found' => false]);

    /* Webhook ياليدين: يحدّث حالة الطلب لحظياً. السر في الرابط (?s=) وهو محفوظ في admin_kv؛ ويُقبل أيضاً توقيع HMAC في ترويسة إن أرسلته الشركة */
    case 'webhook':
        if ($method === 'GET') {                                                      // التحقق CRC من ياليدين: نُرجع crc_token كما هو (2xx خلال 10 ثوانٍ) — يجب أن يبقى دائماً وإلا عُطّل الـ webhook
            if (isset($_GET['subscribe'], $_GET['crc_token'])) { http_response_code(200); header('Content-Type: text/plain; charset=utf-8'); echo (string)$_GET['crc_token']; exit; }
            out(200, ['ok' => true, 'webhook' => 'ready']);
        }
        if ($method !== 'POST') out(405, ['error' => 'method']);
        rateLimit('wh' . clientIp(), 600, 60);
        $d = db(); $st = $d->prepare("SELECT v FROM admin_kv WHERE k = 'webhook_secret'"); $st->execute(); $sec = json_decode((string)$st->fetchColumn(), true);
        $raw = (string)file_get_contents('php://input', false, null, 0, 1048576);
        $given = (string)($_GET['s'] ?? ''); $okAuth = is_string($sec) && $sec !== '' && hash_equals($sec, $given);
        if (!$okAuth && is_string($sec) && $sec !== '') {
            foreach (['HTTP_X_YALIDINE_SIGNATURE', 'HTTP_X_SIGNATURE', 'HTTP_X_HUB_SIGNATURE_256'] as $h) {
                $sig = (string)($_SERVER[$h] ?? ''); $sig = preg_replace('/^sha256=/i', '', $sig);
                if ($sig !== '' && hash_equals(hash_hmac('sha256', $raw, $sec), strtolower($sig))) { $okAuth = true; break; }
            }
        }
        if (!$okAuth) out(401, ['error' => 'unauthorized']);
        $j = json_decode($raw, true); if (!is_array($j)) out(400, ['error' => 'bad_json']);
        $evt = (string)($j['type'] ?? $j['event'] ?? $j['event_type'] ?? '');
        if ($evt !== '' && !in_array($evt, ['parcel_status_updated', 'parcel_payment_updated', 'parcel_edited'], true)) out(200, ['ok' => true, 'ignored' => $evt]);   // parcel_created / parcel_deleted لا تغيّر الحالة
        $items = isset($j['data']) && is_array($j['data']) ? (array_is_list($j['data']) ? $j['data'] : [$j['data']]) : (array_is_list($j) ? $j : [$j]);
        $rank = ['nouvelle' => 0, 'confirmee' => 1, 'expediee' => 2, 'livree' => 3]; $upd = 0; $res = [];
        foreach ($items as $it) {
            if (!is_array($it)) continue;
            $trk = (string)($it['tracking'] ?? $it['tracking_number'] ?? ($it['parcel']['tracking'] ?? ''));
            $rawSt = (string)($it['last_status'] ?? $it['status'] ?? $it['event_status'] ?? ($it['parcel']['last_status'] ?? $j['last_status'] ?? $j['status'] ?? ''));
            $oid = (string)($it['order_id'] ?? '');
            $row = null;
            if ($trk !== '' && preg_match('/^[A-Za-z0-9._-]{4,40}$/', $trk)) {
                $q = $d->prepare('SELECT id, status, note FROM orders WHERE note LIKE ? LIMIT 5'); $q->execute(['%' . $trk . '%']);
                foreach ($q->fetchAll() as $r) if (preg_match('/🚚[a-z0-9_]+:([A-Za-z0-9._-]+)/u', (string)$r['note'], $m) && $m[1] === $trk) { $row = $r; break; }
            }
            if (!$row && $oid !== '') { $q = $d->prepare('SELECT id, status, note FROM orders WHERE id = ?'); $q->execute([$oid]); $row = $q->fetch() ?: null; }
            $new = ydMap($rawSt); $result = 'ignored';
            if ($row && $new) {
                $cur = $row['status'];
                $allowed = in_array($cur, ['livree', 'annulee'], true) ? false : (($new === 'echec') ? true : (($rank[$new] ?? 0) > ($rank[$cur] ?? 0)));
                if ($allowed && $cur !== $new) { $d->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute([$new, $row['id']]); $upd++; $result = "{$cur}→{$new}"; } else $result = 'no_change';
            } elseif (!$row) $result = 'order_not_found';
            $d->prepare('INSERT INTO webhook_log (ts, tracking, raw, result, payload) VALUES (?,?,?,?,?)')->execute([time(), $trk, $rawSt, $result, substr($raw, 0, 4000)]);
            $res[] = $result;
        }
        $d->exec('DELETE FROM webhook_log WHERE id NOT IN (SELECT id FROM webhook_log ORDER BY id DESC LIMIT 100)');
        out(200, ['ok' => true, 'updated' => $upd]);

    /* تخزين خاص بالمدير (أسعار التكلفة، إعدادات الأرباح، سجل المخزون) — لا يصل إليه الزوار */
    case 'kv':
        if (!$isAdmin) out(401, ['error' => 'unauthorized']);
        if ($method === 'GET') {
            $k = (string)($_GET['k'] ?? ''); if (!preg_match('/^[a-z0-9_]{1,40}$/', $k)) out(400, ['error' => 'bad_key']);
            $st = db()->prepare('SELECT v FROM admin_kv WHERE k = ?'); $st->execute([$k]); $v = $st->fetchColumn();
            out(200, ['ok' => true, 'v' => $v === false ? null : json_decode((string)$v, true)]);
        }
        if ($method !== 'POST') out(405, ['error' => 'method']);
        $b = body(); $k = (string)($b['k'] ?? ''); if (!preg_match('/^[a-z0-9_]{1,40}$/', $k)) out(400, ['error' => 'bad_key']);
        $j = json_encode($b['v'] ?? null, JSON_UNESCAPED_UNICODE); if (strlen($j) > 300000) out(413, ['error' => 'too_large']);
        db()->prepare('INSERT INTO admin_kv (k, v, updated) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated = excluded.updated')->execute([$k, $j, time()]);
        out(200, ['ok' => true]);

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

    case 'order_delete':
        if (!$isAdmin) out(401, ['error' => 'unauthorized']);
        if ($method !== 'POST') out(405, ['error' => 'method']);
        $b = body(); $id = (string)($b['id'] ?? '');
        if ($id === '') out(422, ['error' => 'nothing_to_delete']);
        db()->prepare('DELETE FROM orders WHERE id = ?')->execute([$id]);
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
        if (!in_array($m, ['GET', 'POST', 'PUT', 'DELETE'], true)) out(400, ['error' => 'method']);
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
