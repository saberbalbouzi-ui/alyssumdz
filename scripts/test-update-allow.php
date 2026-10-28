<?php
/* بوابة التحديث عن بُعد: كل ملفات shared-files.json (ما عدا scripts/) مقبولة، وأي مسار حسّاس مرفوض */
$src = file_get_contents(__DIR__ . '/../platform/php-edition/api/index.php');
preg_match('/function updAllowed.*?\n}\n/s', $src, $m); eval($m[0]);
$sh = json_decode(file_get_contents(__DIR__ . '/../shared-files.json'), true)['shared'];
$n = 0; $f = 0;
function chk($ok, $msg) { global $n, $f; $n++; if (!$ok) { $f++; echo "✗ $msg\n"; } }
foreach ($sh as $p) {
    if (str_starts_with($p, 'scripts/')) continue;
    if (str_ends_with($p, '/**')) { $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(__DIR__ . '/../' . substr($p, 0, -3), FilesystemIterator::SKIP_DOTS)); foreach ($it as $x) chk(updAllowed(substr($x->getPathname(), strlen(__DIR__) + 4)), $x->getPathname()); }
    else chk(updAllowed($p), $p);
}
foreach (['.github/workflows/speed-test.yml', 'assets/data/store.json', 'assets/data/orders.json', 'assets/data/payments.json', 'api/_data/db.sqlite', 'api/config.php', 'api/update-key.pem', '../etc/passwd', 'assets/js/x.php', 'assets/img/x.php', 'CNAME', 'index.html', 'scripts/x.py', 'assets/js/../../x.js'] as $b) chk(!updAllowed($b), "يجب رفض $b");
echo "$n فحصاً، $f إخفاقاً\n"; exit($f ? 1 : 0);
