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
