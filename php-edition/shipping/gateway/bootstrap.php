<?php
declare(strict_types=1);
/** تهيئة البوابة: البيئة (SHIPGW_ENV_FILE اختياري)، قاعدة البيانات، مفتاح التشفير. على الإنتاج ضع APP_ENCRYPTION_KEY في البيئة لا في الملفات. */
require_once __DIR__ . '/src/autoload.php';

use Alyssum\Gateway\GatewayApp;
use Alyssum\Shipping\CredentialVault;

(function (): void {
    $f = getenv('SHIPGW_ENV_FILE') ?: '';
    if ($f !== '' && is_readable($f)) {
        foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) { if ($line[0] !== '#' && str_contains($line, '=')) { [$k, $v] = explode('=', $line, 2); putenv(trim($k) . '=' . trim($v, " \t\"'")); } }
    }
})();

function gw_pdo(): PDO
{
    static $pdo = null; if ($pdo) { return $pdo; }
    $dir = getenv('SHIPGW_DATA_DIR') ?: __DIR__ . '/data';
    if (!is_dir($dir)) { @mkdir($dir, 0750, true); }
    $pdo = new PDO(getenv('SHIPGW_DB_DSN') ?: 'sqlite:' . $dir . '/gateway.sqlite', getenv('SHIPGW_DB_USER') ?: null, getenv('SHIPGW_DB_PASS') ?: null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $pdo->exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000');
        if (!$pdo->query("SELECT name FROM sqlite_master WHERE name='gw_tenants'")->fetchColumn()) { $pdo->exec((string)file_get_contents(__DIR__ . '/../schema.sqlite.sql')); $pdo->exec((string)file_get_contents(__DIR__ . '/schema.sqlite.sql')); }
    }
    return $pdo;
}

function gw_app(): GatewayApp { return new GatewayApp(gw_pdo(), CredentialVault::fromEnv(), null, null, rtrim((string)(getenv('SHIPGW_PUBLIC_URL') ?: ''), '/')); }
