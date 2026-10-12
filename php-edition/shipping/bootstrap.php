<?php
declare(strict_types=1);
/** تهيئة مشتركة: التحميل، قراءة الإعداد من البيئة (أو ملف .env خارج الجذر العام)، الاتصال بقاعدة البيانات، الخزنة. */
require_once __DIR__ . '/src/autoload.php';

use Alyssum\Shipping\{ConnectionRepository, CredentialVault, ShippingService, WebhookProcessor};

(function (): void {
    $f = getenv('SHIPPING_ENV_FILE') ?: '';
    if ($f !== '' && is_readable($f)) {
        foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            if ($line[0] !== '#' && str_contains($line, '=')) { [$k, $v] = explode('=', $line, 2); putenv(trim($k) . '=' . trim($v, " \t\"'")); }
        }
    }
})();

function shipping_pdo(): PDO
{
    $dsn = getenv('SHIPPING_DB_DSN') ?: 'sqlite:' . __DIR__ . '/data/shipping.sqlite';      // MySQL: mysql:host=127.0.0.1;dbname=app;charset=utf8mb4
    $pdo = new PDO($dsn, getenv('SHIPPING_DB_USER') ?: null, getenv('SHIPPING_DB_PASS') ?: null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    if (str_starts_with($dsn, 'sqlite:')) { $pdo->exec('PRAGMA foreign_keys = ON'); }
    return $pdo;
}

function shipping_services(?PDO $pdo = null, ?CredentialVault $vault = null): array
{
    $pdo ??= shipping_pdo(); $vault ??= CredentialVault::fromEnv();
    $repo = new ConnectionRepository($pdo, $vault);
    $svc = new ShippingService($pdo, $repo);
    return ['pdo' => $pdo, 'repo' => $repo, 'service' => $svc, 'webhook' => new WebhookProcessor($repo, $svc)];
}
