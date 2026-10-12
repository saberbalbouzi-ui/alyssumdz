<?php
declare(strict_types=1);
/* اختبار بوابة الشحن كخدمة (php-edition/shipping/gateway): بلا شبكة ولا حسابات حقيقية.   php scripts/test-gateway.php */
require __DIR__ . '/../php-edition/shipping/gateway/src/autoload.php';
use Alyssum\Gateway\{Dispatcher, GatewayApp, Geo};
use Alyssum\Shipping\CredentialVault;
use Alyssum\Shipping\Http\{HttpClient, HttpResponse};

$total = 0; $fails = 0;
function ok(string $n, bool $c, mixed $x = null): void { global $total, $fails; $total++; if (!$c) { $fails++; echo "✗ $n " . ($x === null ? '' : (is_string($x) ? $x : json_encode($x, JSON_UNESCAPED_UNICODE))) . "\n"; } }
final class FakeHttp implements HttpClient {
    public array $calls = []; public array $queue = [];
    public function request(string $m, string $u, array $h = [], ?string $b = null): HttpResponse { $this->calls[] = [$m, $u, $h, $b]; return array_shift($this->queue) ?? new HttpResponse(200, '{}'); }
    public function reply(int $s, array|string $b): static { $this->queue[] = new HttpResponse($s, is_array($b) ? json_encode($b) : $b); return $this; }
}
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec('PRAGMA foreign_keys = ON'); $pdo->exec((string)file_get_contents(__DIR__ . '/../php-edition/shipping/schema.sqlite.sql')); $pdo->exec((string)file_get_contents(__DIR__ . '/../php-edition/shipping/gateway/schema.sqlite.sql'));
$http = new FakeHttp(); $app = new GatewayApp($pdo, new CredentialVault(['k1' => random_bytes(32)], 'k1'), $http, null, 'https://gw.example');
$T = $app->tenants;
$tA = $T->createTenant('Boutique A', 'a@x.dz', 'pro'); $kA = $T->issueKey($tA, 'live', 'prod'); $kAt = $T->issueKey($tA, 'test');
$tB = $T->createTenant('Boutique B', 'b@x.dz', 'free'); $kB = $T->issueKey($tB, 'live');
function call(GatewayApp $app, string $m, string $p, ?array $body = null, ?string $key = null, array $q = [], array $h = []): array {
    $hd = $h + ($key ? ['authorization' => "Bearer $key"] : []);
    [$c, $rh, $b] = $app->handle($m, $p, $q, $hd, $body === null ? '' : json_encode($body, JSON_UNESCAPED_UNICODE), '1.1.1.1');
    return [$c, json_decode($b, true) ?? [], $rh];
}
$order = fn(array $o = [], array $r = []) => ['courier' => 'sandbox', 'order' => $o + ['reference' => 'R1', 'recipient' => $r + ['fullName' => 'Amine Bouzid', 'phone' => '+213 551 23 45 67', 'wilayaCode' => 16, 'communeName' => 'Bab Ezzouar'], 'deliveryType' => 'home', 'productList' => 'Sneakers x1', 'codAmount' => 4500]];

/* الجغرافيا */
$g = new Geo();
ok('جغرافيا: 69 ولاية و58 للشركات', count($g->wilayas(true)) === 69 && count($g->wilayas()) === 58);
ok('جغرافيا: مطابقة تامة بلا حساسية للحروف', $g->matchCommune(16, 'bab ezzouar')['commune'] === 'Bab Ezzouar');
ok('جغرافيا: تصحيح خطأ إملائي واحد', ($m = $g->matchCommune(16, 'Bab Ezzouarr'))['status'] === 'corrected' && $m['commune'] === 'Bab Ezzouar', $m);
ok('جغرافيا: اسم غريب = unknown', $g->matchCommune(16, 'Zzzzzz')['status'] === 'unknown');

/* عامّة */
[$c, $b] = call($app, 'GET', '/health'); ok('health', $c === 200 && $b['ok'] === true);
[$c, $b, $h] = call($app, 'GET', '/v1/couriers'); ok('couriers: sandbox + ياليدين + كاش', $c === 200 && $b['couriers'][0]['courier'] === 'sandbox' && in_array('yalidine', array_column($b['couriers'], 'courier'), true) && str_contains($h['Cache-Control'], 'max-age'));
[$c, $b] = call($app, 'GET', '/v1/wilayas', null, null, ['q' => 'oran']); ok('wilayas: بحث', $c === 200 && $b[0]['code'] === 31);
[$c, $b] = call($app, 'GET', '/v1/wilayas', null, null, ['all' => '1']); $w60 = array_values(array_filter($b, fn($w) => $w['code'] === 60))[0] ?? null; ok('wilayas: 60 تُشحن كأمها (5)', $w60 && $w60['shipAs'] === 5 && $w60['courierSupported'] === false, $w60);
[$c, $b] = call($app, 'GET', '/v1/communes', null, null, ['wilaya' => '16']); ok('communes: ولاية', $c === 200 && count($b['communes']) > 40);
[$c, $b] = call($app, 'GET', '/openapi.json'); ok('openapi', $c === 200 && isset($b['paths']['/v1/orders']));

/* المصادقة */
[$c, $b] = call($app, 'POST', '/v1/orders', $order()); ok('بلا مفتاح 401', $c === 401 && $b['error']['code'] === 'unauthorized');
[$c] = call($app, 'POST', '/v1/orders', $order(), 'gk_live_' . str_repeat('0', 40)); ok('مفتاح خاطئ 401', $c === 401);
[$c, $b] = call($app, 'POST', '/v1/orders', null, $kA); ok('جسم غير JSON 400', $c === 400);

/* sandbox: إنشاء وتحقق */
[$c, $b] = call($app, 'POST', '/v1/orders', $order(), $kA);
ok('sandbox: إنشاء 201', $c === 201 && preg_match('/^SBX-[0-9A-F]{8}$/', $b['trackingNumber']) && $b['status'] === 'pending' && $b['sandbox'] === true, $b);
$trk = $b['trackingNumber'];
[$c, $b, $h] = call($app, 'POST', '/v1/orders', $order(), $kA); ok('idempotency: إعادة نفس الطلب = نفس الردّ', $c === 200 && $b['trackingNumber'] === $trk && ($h['Idempotent-Replayed'] ?? '') === 'true');
[$c, $b] = call($app, 'POST', '/v1/orders', $order(['codAmount' => 9999]), $kA); ok('idempotency: نفس المرجع بمحتوى مختلف 409', $c === 409 && $b['error']['code'] === 'reference_conflict');
[$c, $b] = call($app, 'POST', '/v1/orders', $order(['reference' => 'R2'], ['phone' => '123']), $kA); ok('هاتف خاطئ 422', $c === 422 && $b['error']['code'] === 'invalid_phone');
[$c, $b] = call($app, 'POST', '/v1/orders', $order(['reference' => 'R3'], ['communeName' => 'Bab Ezzouarr']), $kA); ok('تصحيح البلدية تلقائياً مع تقرير', $c === 201 && $b['corrections'][0]['to'] === 'Bab Ezzouar', $b);
[$c, $b] = call($app, 'POST', '/v1/orders', $order(['reference' => 'R4'], ['communeName' => 'Zzzzzz']), $kA); ok('بلدية مجهولة 422 باقتراحات', $c === 422 && $b['error']['code'] === 'unknown_commune');
[$c, $b] = call($app, 'POST', '/v1/orders', $order(['reference' => 'R5', 'productList' => '', 'codAmount' => -5]), $kA); ok('حقول ناقصة 400 بقائمة الحقول', $c === 400 && isset($b['error']['fields']['order.productList']) && isset($b['error']['fields']['order.codAmount']), $b);
[$c, $b] = call($app, 'POST', '/v1/orders', $order(['reference' => 'R6', 'deliveryType' => 'stopdesk']), $kA); ok('stopdesk بلا مكتب 422', $c === 422);
[$c, $b] = call($app, 'POST', '/v1/orders', ['courier' => 'sandbox', 'order' => $order()['order'] + []], $kA, [], ['idempotency-key' => 'zzz']); ok('تجاهل Idempotency-Key حين يوجد reference', $c === 200);
$o2 = $order(); unset($o2['order']['reference']);
[$c, $b] = call($app, 'POST', '/v1/orders', $o2, $kA, [], ['idempotency-key' => 'KEY-1']); ok('Idempotency-Key كمرجع', $c === 201 && $b['reference'] === 'KEY-1');
[$c, $b] = call($app, 'POST', '/v1/validate', $order(['reference' => 'V1'], ['communeName' => 'bab ezzouarr']), $kA); ok('validate: جاف ولا ينشئ', $c === 200 && $b['valid'] && $b['normalized']['phone'] === '0551234567' && (int)$pdo->query("SELECT COUNT(*) FROM gw_orders WHERE reference='V1'")->fetchColumn() === 0, $b);

/* مفتاح الاختبار */
[$c, $b] = call($app, 'POST', '/v1/orders', ['courier' => 'yalidine', 'credentials' => ['apiId' => 'a', 'apiToken' => 'b']] + $order(['reference' => 'T1']), $kAt); ok('مفتاح الاختبار لا يصل لشركة حقيقية', $c === 403 && $b['error']['code'] === 'test_key_sandbox_only');
[$c] = call($app, 'POST', '/v1/orders', $order(['reference' => 'T2']), $kAt); ok('مفتاح الاختبار مع sandbox', $c === 201);

/* شركة حقيقية (محاكاة): inline لا تُخزَّن المفاتيح */
$yal = ['courier' => 'yalidine', 'credentials' => ['apiId' => 'AID', 'apiToken' => 'SECRET-TOK-777'], 'options' => ['fromWilaya' => 16]];
$http->reply(200, ['Y1' => ['success' => true, 'tracking' => 'yal-ABC123']]);
[$c, $b] = call($app, 'POST', '/v1/orders', $yal + $order(['reference' => 'Y1']), $kA);
ok('ياليدين inline: 201 وتتبع', $c === 201 && $b['trackingNumber'] === 'yal-ABC123' && $b['courier'] === 'yalidine', $b);
$lastReq = end($http->calls); ok('ياليدين: المفاتيح وصلت الترويسات ولم تُخزَّن', ($lastReq[2]['X-API-TOKEN'] ?? '') === 'SECRET-TOK-777' && !str_contains(json_encode($pdo->query('SELECT * FROM gw_orders')->fetchAll()), 'SECRET-TOK-777'));
$http->reply(200, ['Y2' => ['success' => false, 'message' => 'Commune invalide']]);
[$c, $b] = call($app, 'POST', '/v1/orders', $yal + $order(['reference' => 'Y2']), $kA); ok('رفض الشركة 502 ويحرّر المرجع', $c === 502 && $b['error']['code'] === 'courier_error' && (int)$pdo->query("SELECT COUNT(*) FROM gw_orders WHERE reference='Y2'")->fetchColumn() === 0, $b);
$http->reply(200, ['Y2' => ['success' => true, 'tracking' => 'yal-RETRY']]);
[$c, $b] = call($app, 'POST', '/v1/orders', $yal + $order(['reference' => 'Y2']), $kA); ok('إعادة المحاولة بعد الرفض تنجح', $c === 201 && $b['trackingNumber'] === 'yal-RETRY');
[$c, $b] = call($app, 'POST', '/v1/orders', ['courier' => 'yalidine', 'credentials' => ['apiId' => 'x']] + $order(['reference' => 'Y3']), $kA); ok('مفاتيح ناقصة 422', $c === 422 && $b['error']['code'] === 'invalid_credentials');
[$c, $b] = call($app, 'POST', '/v1/orders', ['courier' => 'yalidine'] + $order(['reference' => 'Y4']), $kA); ok('بلا مفاتيح ولا خزنة 422', $c === 422 && $b['error']['code'] === 'credentials_required');
[$c, $b] = call($app, 'POST', '/v1/orders', ['courier' => 'nope'] + $order(['reference' => 'Y5']), $kA); ok('شركة مجهولة 400', $c === 400 && $b['error']['code'] === 'unknown_courier');
[$c, $b] = call($app, 'POST', '/v1/orders', $yal + $order(['reference' => 'Y6', 'deliveryType' => 'stopdesk', 'stopDeskId' => '16A']), $kA); ok('مكتب غير رقمي يُرفض ويحرّر المرجع', $c === 422 && (int)$pdo->query("SELECT COUNT(*) FROM gw_orders WHERE reference='Y6'")->fetchColumn() === 0, $b);

/* التتبع */
[$c, $b] = call($app, 'POST', '/v1/track', ['courier' => 'sandbox', 'trackingNumber' => $trk], $kA); ok('تتبع sandbox', $c === 200 && in_array($b['status'], ['pending', 'shipped', 'out_for_delivery', 'delivered'], true), $b);
$http->reply(200, ['data' => [['tracking' => 'yal-ABC123', 'last_status' => 'Sorti en livraison']]]);
[$c, $b] = call($app, 'POST', '/v1/track', $yal + ['trackingNumber' => 'yal-ABC123'], $kA); ok('تتبع ياليدين ← موحَّد', $c === 200 && $b['status'] === 'out_for_delivery', $b);
[$c, $b] = call($app, 'GET', '/v1/orders/Y1', null, $kA); ok('الطلب يتحدّث بالتتبع', $c === 200 && $b['status'] === 'out_for_delivery');
[$c, $b] = call($app, 'POST', '/v1/track', ['courier' => 'sandbox', 'trackingNumber' => 'bad'], $kA); ok('تتبع مجهول 502', $c === 502);

/* العزل بين المستأجرين */
[$c] = call($app, 'GET', '/v1/orders/Y1', null, $kB); ok('عزل: B لا يرى طلب A', $c === 404);
[$c, $b] = call($app, 'GET', '/v1/orders', null, $kB); ok('عزل: قائمة B فارغة', $c === 200 && $b['orders'] === []);
[$c, $b] = call($app, 'GET', '/v1/orders', null, $kA); ok('قائمة A', $c === 200 && count($b['orders']) >= 4);
[$c, $b] = call($app, 'POST', '/v1/orders', $order(['reference' => 'R1']), $kB); ok('عزل: المرجع نفسه عند B طلب مستقل', $c === 201);

/* الحدود والخطط */
$tC = $T->createTenant('C', 'c@x.dz', 'free'); $kC = $T->issueKey($tC, 'live'); $pdo->exec("UPDATE gw_plans SET orders_hour=3, orders_day=100 WHERE id='free'");
$cs = []; for ($i = 1; $i <= 4; $i++) { $cs[] = call($app, 'POST', '/v1/orders', $order(['reference' => "L$i"]), $kC)[0]; }
ok('حدّ الساعة: الرابع 429 مع Retry-After', $cs === [201, 201, 201, 429], $cs);
[$c, $b, $h] = call($app, 'POST', '/v1/orders', $order(['reference' => 'L9']), $kC); ok('429 يحمل Retry-After', $c === 429 && (int)($h['Retry-After'] ?? 0) > 0);
[$c, $b] = call($app, 'GET', '/v1/usage', null, $kC); ok('usage: عدّاد اليوم والخطة', $c === 200 && $b['today']['order'] === 3 && $b['plan']['id'] === 'free', $b);
$pdo->exec("UPDATE gw_plans SET orders_hour=20, orders_day=2 WHERE id='free'"); $tD = $T->createTenant('D', 'd@x.dz', 'free'); $kD = $T->issueKey($tD, 'live');
$ds = []; for ($i = 1; $i <= 3; $i++) { $ds[] = call($app, 'POST', '/v1/orders', $order(['reference' => "D$i"]), $kD)[0]; }
ok('حدّ اليوم', $ds === [201, 201, 429], $ds);
$T->setStatus($tD, 'suspended'); [$c] = call($app, 'GET', '/v1/usage', null, $kD); ok('مستأجر موقوف = 401', $c === 401);
$kid = (int)$pdo->query("SELECT id FROM gw_keys WHERE tenant_id=$tC")->fetchColumn(); $T->revokeKey($kid); [$c] = call($app, 'GET', '/v1/usage', null, $kC); ok('مفتاح مُلغى = 401', $c === 401);
ok('المفتاح لا يُخزَّن صريحاً', !str_contains(json_encode($pdo->query('SELECT * FROM gw_keys')->fetchAll()), $kA));

/* الخزنة + hooks الواردة + webhook الصادر */
[$c, $b] = call($app, 'POST', '/v1/connections', ['courier' => 'yalidine', 'credentials' => ['apiId' => 'AID2', 'apiToken' => 'VAULT-TOK-888']], $kB); ok('الخطة المجانية لا تحفظ مفاتيح', $c === 402 && $b['error']['code'] === 'plan_limit');
[$c, $b] = call($app, 'POST', '/v1/connections', ['courier' => 'yalidine', 'credentials' => ['apiId' => 'x']], $kA); ok('خزنة: مفاتيح ناقصة 422', $c === 422);
[$c, $b] = call($app, 'POST', '/v1/connections', ['courier' => 'yalidine', 'credentials' => ['apiId' => 'AID2', 'apiToken' => 'VAULT-TOK-888']], $kA);
ok('خزنة: تفعيل + رابط الشركة', $c === 201 && preg_match('#^https://gw\.example/v1/hooks/[a-f0-9]{24}\?t=[a-f0-9]{48}$#', $b['carrierWebhookUrl']), $b);
ok('خزنة: لا نص صريح في القاعدة', !str_contains(json_encode($pdo->query('SELECT * FROM user_carriers')->fetchAll()), 'VAULT-TOK-888'));
$hook = $b['carrierWebhookUrl']; $hid = substr(parse_url($hook, PHP_URL_PATH), strlen('/v1/hooks/')); parse_str((string)parse_url($hook, PHP_URL_QUERY), $hq);
[$c, $b] = call($app, 'GET', '/v1/connections', null, $kA); ok('خزنة: القائمة بلا أسرار', $c === 200 && count($b['connections']) === 1 && !str_contains(json_encode($b), 'VAULT'));
$http->reply(200, ['V1X' => ['success' => true, 'tracking' => 'yal-VAULT1']]);
[$c, $b] = call($app, 'POST', '/v1/orders', ['courier' => 'yalidine'] + $order(['reference' => 'V1X']), $kA); ok('إنشاء بالخزنة بلا مفاتيح في الطلب', $c === 201 && $b['trackingNumber'] === 'yal-VAULT1', $b);
ok('via = vault', $pdo->query("SELECT via FROM gw_orders WHERE reference='V1X'")->fetchColumn() === 'vault');
[$c, $b] = call($app, 'PUT', '/v1/webhook', ['url' => 'http://insecure.example/hook'], $kA); ok('webhook صادر: http مرفوض', $c === 400);
[$c, $b] = call($app, 'PUT', '/v1/webhook', ['url' => 'https://client.example/hook'], $kA); ok('webhook صادر: ضبط + سرّ', $c === 200 && str_starts_with($b['secret'], 'whsec_')); $sec = $b['secret'];
[$c, $b] = call($app, 'PUT', '/v1/webhook', ['url' => 'https://client.example/hook'], $kB); ok('webhook صادر: الخطة المجانية ممنوعة', $c === 402);
[$c, $b] = call($app, 'POST', "/v1/hooks/$hid", ['x' => 1], null, ['t' => 'wrong']); ok('hook وارد: سرّ خاطئ 401', $c === 401);
$wb = ['type' => 'parcel_status_updated', 'data' => [['tracking' => 'yal-VAULT1', 'last_status' => 'Sorti en livraison']]];
[$c, $b] = call($app, 'POST', "/v1/hooks/$hid", $wb, null, $hq); ok('hook وارد: يحدّث الطلب', $c === 200 && $b['updated'] === 1, $b);
ok('حالة الطلب out_for_delivery', $pdo->query("SELECT status FROM gw_orders WHERE reference='V1X'")->fetchColumn() === 'out_for_delivery');
[$c, $b] = call($app, 'POST', "/v1/hooks/$hid", $wb, null, $hq); ok('hook وارد: التكرار لا يغيّر', $c === 200 && $b['updated'] === 0);
[$c, $b] = call($app, 'GET', "/v1/hooks/$hid", null, null, ['subscribe' => '1', 'crc_token' => 'abc']); ok('hook وارد: CRC', $c === 200);
ok('حدث صادر في الطابور', (int)$pdo->query("SELECT COUNT(*) FROM gw_events WHERE state='pending'")->fetchColumn() === 1);
$http->calls = []; $http->reply(500, '{}');
$r = $app->dispatcher->deliverDue(); [$m, $u, $hd, $body] = $http->calls[0];
ok('تسليم صادر: فشل 500 يُجدوَل', $r['failed'] === 1 && $pdo->query('SELECT attempts FROM gw_events')->fetchColumn() == 1 && (int)$pdo->query('SELECT next_at FROM gw_events')->fetchColumn() > time());
preg_match('/t=(\d+),v1=([0-9a-f]{64})/', $hd['X-Gateway-Signature'], $sm);
ok('تسليم صادر: توقيع HMAC صحيح', $u === 'https://client.example/hook' && hash_equals(hash_hmac('sha256', $sm[1] . '.' . $body, $sec), $sm[2]) && json_decode($body, true)['data']['status'] === 'out_for_delivery');
$pdo->exec('UPDATE gw_events SET next_at=0'); $http->reply(200, '{}'); $r = $app->dispatcher->deliverDue();
ok('تسليم صادر: إعادة المحاولة تنجح', $r['sent'] === 1 && $pdo->query('SELECT state FROM gw_events')->fetchColumn() === 'sent');
// cron: يزامن طرود الخزنة
$pdo->exec("UPDATE gw_orders SET status='pending' WHERE reference='V1X'"); $http->calls = [];
$http->reply(200, ['data' => [['tracking' => 'yal-VAULT1', 'last_status' => 'Livré']]]); $http->reply(200, '{}');
$r = $app->cron(); ok('cron: يزامن ويرسل الحدث', $r['checked'] >= 1 && $r['changed'] === 1 && $r['sent'] === 1, $r);
ok('cron: الحالة النهائية', $pdo->query("SELECT status FROM gw_orders WHERE reference='V1X'")->fetchColumn() === 'delivered');
[$c] = call($app, 'DELETE', '/v1/connections/yalidine', null, $kA); [$c2, $b2] = call($app, 'POST', '/v1/orders', ['courier' => 'yalidine'] + $order(['reference' => 'V2X']), $kA); ok('فصل الشركة من الخزنة', $c === 200 && $c2 === 422);

/* مسائل أخرى */
[$c, $b] = call($app, 'POST', '/v1/desks', ['wilayaCode' => 16], $kA); ok('desks: كتالوج الولاية', $c === 200 && count($b['desks']) > 5);
[$c] = $app->handle('POST', '/v1/orders', [], ['authorization' => "Bearer $kA"], str_repeat('x', 300000)); ok('جسم كبير 413', $c === 413);
[$c, , $raw] = $app->handle('GET', '/nope', [], [], ''); ok('مسار مجهول يتطلب مفتاحاً (لا تسريب)', $c === 401);
[$c] = call($app, 'GET', '/nope', null, $kA); ok('مسار مجهول 404', $c === 404);
ok('رؤوس الأمان', ($app->handle('GET', '/health', [], [], '')[1]['X-Content-Type-Options'] ?? '') === 'nosniff');
echo $fails ? "\n✗ $fails من $total فشل\n" : "✓ $total فحصاً ناجحاً\n"; exit($fails ? 1 : 0);
