<?php
declare(strict_types=1);
require_once __DIR__ . '/../../src/autoload.php';
foreach (['Geo', 'SandboxAdapter', 'Tenants', 'Limiter', 'Dispatcher', 'GatewayApp'] as $f) { require_once __DIR__ . '/' . $f . '.php'; }
