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
        if (isset($b['status'])) { if (!in_array($b['status'], ['nouvelle', 'confirmee', 'expediee', 'livree', 'annulee'], true)) out(422, ['error' => 'invalid_status']); $set[] = 'status = ?'; $args[] = $b['status']; }
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
