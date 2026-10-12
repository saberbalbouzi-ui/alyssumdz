<?php
declare(strict_types=1);
/** نقطة دخول HTTP للبوابة. وجّه إليها كل المسارات (Nginx: try_files $uri /index.php; Apache: .htaccess). المسار من REQUEST_URI بعد حذف مجلد السكربت. */
require_once __DIR__ . '/bootstrap.php';

$uri = (string)parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$base = rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? ''))), '/');
$path = $base !== '' && str_starts_with($uri, $base) ? substr($uri, strlen($base)) : $uri;
if (str_starts_with($path, '/index.php')) { $path = substr($path, 10); }
$path = $path === '' ? '/' : $path;

if ($path === '/' && is_file(__DIR__ . '/docs.html') && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: public, max-age=300'); readfile(__DIR__ . '/docs.html'); exit;
}
$headers = [];
foreach ($_SERVER as $k => $v) { if (str_starts_with($k, 'HTTP_')) { $headers[strtolower(str_replace('_', '-', substr($k, 5)))] = (string)$v; } }
if (isset($_SERVER['CONTENT_TYPE'])) { $headers['content-type'] = (string)$_SERVER['CONTENT_TYPE']; }
try {
    $app = gw_app();
    [$code, $h, $body] = $app->handle($_SERVER['REQUEST_METHOD'] ?? 'GET', $path, array_map('strval', array_filter($_GET, 'is_scalar')), $headers, (string)file_get_contents('php://input', false, null, 0, 262145), preg_replace('/[^0-9a-f:.]/i', '', $_SERVER['REMOTE_ADDR'] ?? 'x'));
} catch (Throwable $e) {
    error_log('gateway boot: ' . $e::class . ' ' . $e->getMessage());
    [$code, $h, $body] = [503, ['Content-Type' => 'application/json; charset=utf-8'], '{"error":{"code":"unavailable","message":"الخدمة غير جاهزة"}}'];
}
http_response_code($code); foreach ($h as $k => $v) { header("$k: $v"); } echo $body;
