<?php
declare(strict_types=1);
require __DIR__ . '/lib/carrier-golden.php';
$g = carrier_golden();
$f = __DIR__ . '/../saas/gateway/test/carrier-golden.json';
file_put_contents($f, json_encode($g, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n");
echo "كُتبت اللقطة: ", $f, " (", array_sum(array_map('count', $g)), " خطوة)\n";
