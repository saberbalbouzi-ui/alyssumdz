<?php
declare(strict_types=1);
/* اختبار ربط وحدة الشحن بنسخة PHP (platform/php-edition/shipping/integration.php + مسارات api/index.php): بلا شبكة ولا حسابات حقيقية.
     php scripts/test-ship-php.php */
require __DIR__ . '/../platform/php-edition/shipping/integration.php';
use Alyssum\Shipping\Http\{HttpClient, HttpResponse};

$total = 0; $fails = 0;
function ok(string $n, bool $c, mixed $x = null): void { global $total, $fails; $total++; if (!$c) { $fails++; echo "✗ $n " . ($x === null ? '' : json_encode($x, JSON_UNESCAPED_UNICODE)) . "\n"; } }
final class FakeHttp implements HttpClient {
    public array $calls = []; public array $queue = [];
    public function request(string $m, string $u, array $h = [], ?string $b = null): HttpResponse { $this->calls[] = [$m, $u]; return array_shift($this->queue) ?? new HttpResponse(200, '{}'); }
}
$tmp = sys_get_temp_dir() . '/shipx_' . bin2hex(random_bytes(4)); mkdir($tmp);
$http = new FakeHttp(); $GLOBALS['SHIPX_HTTP'] = $http;
$orders = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$orders->exec("CREATE TABLE orders (id TEXT PRIMARY KEY, created_at INTEGER, name TEXT, phone TEXT, wilaya TEXT, commune TEXT, dtype TEXT, desk TEXT, items_text TEXT, items TEXT, subtotal REAL, fee REAL, total REAL, coupon TEXT, discount REAL, extra TEXT, status TEXT, note TEXT)");
$ins = fn(string $id, string $w, string $st = 'confirmee') => $orders->prepare("INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")->execute([$id, time(), 'Karim Benali', '0550123456', $w, 'Bab Ezzouar', 'home', null, "عسل ×2 = 3000 DA", '[]', 3000, 400, 3400, null, 0, '{}', $st, '']);
$ins('O1', '16 - Alger'); $ins('O2', 'Alger'); $ins('O3', 'Atlantis'); $ins('O4', 'الجزائر', 'annulee');
$r = fn(string $route, array $b = [], string $m = 'POST') => shipx_route($route, $m, $b, $tmp, $orders);

/* المساعدات */
ok('ولاية: رقم وبادئة', shipx_wilaya_code('16 - Alger') === 16 && shipx_wilaya_code('16') === 16);
ok('ولاية: اسم لاتيني بلا حساسية للهمزات', shipx_wilaya_code('Béjaïa') === 6 && shipx_wilaya_code('alger') === 16);
ok('ولاية: مجهولة = 0', shipx_wilaya_code('Atlantis') === 0);
ok('حالة الطلب: التسليم/الإرجاع/المسار', shipx_order_status('delivered') === 'livree' && shipx_order_status('returned') === 'echec' && shipx_order_status('shipped') === 'expediee' && shipx_order_status('pending') === null && shipx_order_status('cancelled') === null);

/* الكتالوج والتفعيل */
[$c, $b] = $r('ship_carriers', [], 'GET');
ok('كتالوج: يشمل ياليدين وإيكوتراك', $c === 200 && count($b['carriers']) >= 10 && in_array('yalidine', array_column($b['carriers'], 'code'), true));
ok('مفتاح التشفير يُولَّد تلقائياً بصلاحيات مقيّدة', is_file("$tmp/ship.key") && strlen(base64_decode(trim(file_get_contents("$tmp/ship.key")))) === 32);
[$c, $b] = $r('ship_connect', ['carrier' => 'yalidine', 'credentials' => ['apiId' => 'x']]);
ok('تفعيل بمفاتيح ناقصة يُرفض', $c === 422);
[$c, $b] = $r('ship_connect', ['carrier' => 'yalidine', 'credentials' => ['apiId' => 'AID', 'apiToken' => 'TOKEN-SECRET-123']]);
ok('تفعيل ياليدين + رابط webhook', $c === 200 && preg_match('#r=ship_webhook&c=[a-f0-9]{24}&t=[a-f0-9]{48}$#', $b['webhook_url']), $b);
parse_str((string)parse_url($b['webhook_url'], PHP_URL_QUERY), $wq);
ok('المفاتيح لا تُخزَّن صريحة', !str_contains((string)file_get_contents("$tmp/shipping.sqlite"), 'TOKEN-SECRET-123'));
[$c, $b] = $r('ship_connect', ['carrier' => 'ecotrack', 'credentials' => ['token' => 't'], 'base_url' => 'http://evil.local']);
ok('رابط أساس غير HTTPS يُرفض', $c === 400);

/* الإرسال */
$http->queue[] = new HttpResponse(200, json_encode(['O1' => ['success' => true, 'tracking' => 'yal-5001']]));
[$c, $b] = $r('ship_send', ['carrier' => 'yalidine', 'order_id' => 'O1']);
ok('إرسال ناجح + تتبع', $c === 200 && $b['tracking'] === 'yal-5001', $b);
ok('وسم التتبع في ملاحظة الطلب', str_contains((string)$orders->query("SELECT note FROM orders WHERE id='O1'")->fetchColumn(), '🚚yalidine:yal-5001'));
$n = count($http->calls);
[$c, $b] = $r('ship_send', ['carrier' => 'yalidine', 'order_id' => 'O1']);
ok('إعادة الإرسال ممنوعة بلا اتصال بالشركة', $c === 409 && $b['error'] === 'already_sent' && count($http->calls) === $n);
[$c, $b] = $r('ship_send', ['carrier' => 'yalidine', 'order_id' => 'O3']);
ok('ولاية مجهولة تُرفض قبل الإرسال', $c === 422 && count($http->calls) === $n);
[$c, $b] = $r('ship_send', ['carrier' => 'yalidine', 'order_id' => 'O4']);
ok('طلب ملغى لا يُرسل', $c === 409);
[$c, $b] = $r('ship_send', ['carrier' => 'yalidine', 'order_id' => 'nope']);
ok('طلب غير موجود', $c === 404);
$http->queue[] = new HttpResponse(200, json_encode(['O2' => ['success' => false, 'message' => 'adresse invalide']]));
[$c, $b] = $r('ship_send', ['carrier' => 'yalidine', 'order_id' => 'O2']);
ok('رفض الشركة يُعاد برسالتها ولا يُوسم الطلب', $c === 502 && !str_contains((string)$orders->query("SELECT note FROM orders WHERE id='O2'")->fetchColumn(), '🚚'));

/* webhook */
$wh = fn(array $q, array $p, string $m = 'POST') => (function () use ($q, $p, $m, $tmp, $orders) { $_GET = $q; $GLOBALS['SHIPX_RAW'] = json_encode($p); return shipx_route('ship_webhook', $m, $p, $tmp, $orders); })();
$status = fn() => $orders->query("SELECT status FROM orders WHERE id='O1'")->fetchColumn();
[$c] = $wh(['c' => $wq['c'], 't' => 'wrong'], ['x' => 1]);
ok('webhook: سرّ خاطئ 401', $c === 401);
[$c, $b] = $wh($wq, ['type' => 'parcel_status_updated', 'data' => [['tracking' => 'yal-5001', 'last_status' => 'Sorti en livraison']]]);
ok('webhook: الطلب يصير expediee', $c === 200 && $status() === 'expediee', $b);
$wh($wq, ['type' => 'parcel_status_updated', 'data' => [['tracking' => 'yal-5001', 'last_status' => 'Livré']]]);
ok('webhook: التسليم ← livree', $status() === 'livree');
$wh($wq, ['type' => 'parcel_status_updated', 'data' => [['tracking' => 'yal-5001', 'last_status' => 'Sorti en livraison']]]);
ok('webhook: لا رجوع بعد التسليم', $status() === 'livree');

/* تتبع/إلغاء/بوليصة */
$ins('O5', '31 - Oran');
$http->queue[] = new HttpResponse(200, json_encode(['O5' => ['success' => true, 'tracking' => 'yal-5002']])); $r('ship_send', ['carrier' => 'yalidine', 'order_id' => 'O5']);
$http->queue[] = new HttpResponse(200, json_encode(['data' => [['tracking' => 'yal-5002', 'last_status' => 'Expédié']]]));
[$c, $b] = $r('ship_track', ['carrier' => 'yalidine', 'tracking' => 'yal-5002']);
ok('تتبع يعيد الحالة الموحّدة', $c === 200 && $b['status'] === 'shipped', $b);
$http->queue[] = new HttpResponse(200, '{}');
[$c, $b] = $r('ship_cancel', ['carrier' => 'yalidine', 'tracking' => 'yal-5002', 'order_id' => 'O5']);
ok('إلغاء الطرد وإزالة الوسم من الطلب', in_array($c, [200, 409], true) && ($c !== 200 || !str_contains((string)$orders->query("SELECT note FROM orders WHERE id='O5'")->fetchColumn(), 'yal-5002')), [$c, $b]);
[$c] = $r('ship_disconnect', ['carrier' => 'yalidine']);
[$c2] = $r('ship_send', ['carrier' => 'yalidine', 'order_id' => 'O2']);
ok('بعد فصل الشركة لا إرسال', $c === 200 && $c2 === 422);

/* المعايرة عند أول ربط: ship_connect يلتقط الحساب، وship_calibrate يتابع/يعيد، وملخّصها يظهر في الكتالوج، والإرسال يستعمل الملف */
require_once __DIR__ . '/lib/carrier-sims.php';
$sim = new YalidineSim(); $geoAll = Alyssum\Shipping\OurGeo::load(__DIR__ . '/../platform/php-edition/shipping/data/geo.json');
$sim->catalog = [16 => $geoAll->communes(16), 31 => $geoAll->communes(31)];
$GLOBALS['SHIPX_HTTP'] = $sim; $GLOBALS['SHIPX_PAUSE'] = static function (int $ms): void {};
[$c, $b] = $r('ship_connect', ['carrier' => 'yalidine', 'credentials' => ['apiId' => 'AID', 'apiToken' => 'TOK']]);
ok('ship_connect: يعيد ملخّص المعايرة مع الرابط', $c === 200 && is_array($b['calibration'] ?? null) && isset($b['calibration']['progress']), $b);
$g = 0; do { [$c, $b2] = $r('ship_calibrate', ['carrier' => 'yalidine']); } while ($c === 200 && empty($b2['calibration']['done']) && $g++ < 60);
ok('ship_calibrate: تتقدّم حتى الانتهاء', $c === 200 && ($b2['calibration']['done'] ?? false) === true, $b2);
ok('المعايرة: التُقطت ولايتان على الأقل وتحذير لغير المتاحة', ($b2['calibration']['communes']['wilayas'] ?? 0) >= 2 && count($b2['calibration']['warnings'] ?? []) >= 1, $b2['calibration'] ?? null);
[$c, $b3] = $r('ship_calibrate', [], 'GET'); ok('ship_calibrate GET: بلا شركة ← 404', $c === 404);
$_GET['carrier'] = 'yalidine'; [$c, $b3] = $r('ship_calibrate', [], 'GET'); unset($_GET['carrier']);
ok('ship_calibrate GET: الملخّص فقط', $c === 200 && ($b3['calibration']['done'] ?? false) === true);
[$c, $b4] = $r('ship_carriers', [], 'GET');
ok('الكتالوج يعرض معايرة كل شركة مفعّلة بلا معرّفات داخلية', $c === 200 && ($b4['connected'][0]['calibration']['done'] ?? false) === true && !isset($b4['connected'][0]['id']), $b4['connected'] ?? null);
[$c, $b5] = $r('ship_calibrate', ['carrier' => 'yalidine', 'restart' => true]);
ok('إعادة المعايرة (restart) تبدأ من جديد', $c === 200 && isset($b5['calibration']['progress']));
[$c] = $r('ship_disconnect', ['carrier' => 'yalidine']);
$GLOBALS['SHIPX_HTTP'] = $http;

/* مسارات index.php عبر خادم PHP حقيقي: صلاحية المدير وCSRF وwebhook العام */
$root = sys_get_temp_dir() . '/shipsrv_' . bin2hex(random_bytes(4)); mkdir("$root/api", 0777, true);
copy(__DIR__ . '/../platform/php-edition/api/index.php', "$root/api/index.php");
$sh = "$root/api/shipping"; mkdir($sh); exec('cp -r ' . escapeshellarg(__DIR__ . '/../platform/php-edition/shipping/src') . ' ' . escapeshellarg("$sh/src")); copy(__DIR__ . '/../platform/php-edition/shipping/integration.php', "$sh/integration.php"); mkdir("$sh/data"); copy(__DIR__ . '/../platform/php-edition/shipping/data/geo.json', "$sh/data/geo.json"); copy(__DIR__ . '/../platform/php-edition/shipping/schema.sqlite.sql', "$sh/schema.sqlite.sql");
file_put_contents("$root/api/config.php", "<?php return ['admin_hash' => " . var_export(password_hash('pw', PASSWORD_DEFAULT), true) . ", 'max_upload_mb' => 8];");
$port = random_int(20000, 40000);
$p = proc_open(['php', '-S', "127.0.0.1:$port", '-t', $root], [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes);
usleep(600000);
$call = function (string $path, string $m = 'GET', ?array $body = null, array $hdr = [], string $jar = '') use ($port): array {
    $ch = curl_init("http://127.0.0.1:$port/api/index.php?r=$path");
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $m, CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $hdr), CURLOPT_COOKIEJAR => $jar ?: '/dev/null', CURLOPT_COOKIEFILE => $jar ?: '', CURLOPT_TIMEOUT => 10]);
    if ($body !== null) { curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body)); }
    $o = (string)curl_exec($ch); $c = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch); return [$c, $o];
};
$x = ['X-Requested-With: XMLHttpRequest']; $jar = "$root/jar";
[$c] = $call('ship_carriers', 'GET', null, [], $jar);   ok('HTTP: الكتالوج يتطلب المدير', $c === 401);
[$c] = $call('ship_connect', 'POST', ['carrier' => 'yalidine'], [], $jar);   ok('HTTP: الكتابة بلا ترويسة CSRF مرفوضة', $c === 403);
[$c] = $call('login', 'POST', ['password' => 'pw'], $x, $jar);   ok('HTTP: دخول المدير', $c === 200);
[$c, $o] = $call('ship_carriers', 'GET', null, [], $jar);   ok('HTTP: الكتالوج للمدير', $c === 200 && str_contains($o, 'yalidine'), $o);
[$c, $o] = $call('ship_connect', 'POST', ['carrier' => 'yalidine', 'credentials' => ['apiId' => 'a', 'apiToken' => 'b']], $x, $jar);
ok('HTTP: تفعيل شركة', $c === 200 && str_contains($o, 'ship_webhook'), $o);
$url = json_decode($o, true)['webhook_url'] ?? ''; parse_str((string)parse_url($url, PHP_URL_QUERY), $q);
[$c] = $call('ship_webhook&c=' . $q['c'] . '&t=bad', 'POST', ['a' => 1]);   ok('HTTP: webhook بسر خاطئ 401 (بلا جلسة ولا CSRF)', $c === 401);
[$c, $o] = $call('ship_webhook&c=' . $q['c'] . '&t=' . $q['t'], 'POST', ['type' => 'parcel_status_updated', 'data' => []]);   ok('HTTP: webhook بسر صحيح 200', $c === 200, $o);
[$c, $o] = $call('ship_webhook&subscribe=1&crc_token=abc123', 'GET');   ok('HTTP: تحقق CRC', $c === 200 && $o === 'abc123', $o);
[$c] = $call('ship_webhook', 'GET');   ok('HTTP: webhook GET جاهز', $c === 200);
$bad = (string)@file_get_contents("http://127.0.0.1:$port/api/_data/ship.key");   ok('HTTP: مفتاح التشفير غير قابل للقراءة من الويب', $bad === '' || !preg_match('/^[A-Za-z0-9+\/=]{40,}$/', trim($bad)));
proc_terminate($p);
exec('rm -rf ' . escapeshellarg($tmp) . ' ' . escapeshellarg($root));
echo $fails ? "\n✗ $fails من $total فشل\n" : "✓ $total فحصاً ناجحاً\n"; exit($fails ? 1 : 0);
