<?php
declare(strict_types=1);
/* اختبار وحدة تجميع شركات التوصيل (php-edition/shipping): بلا شبكة ولا مفاتيح حقيقية.
     php scripts/test-shipping.php            (يخرج بكود 1 عند أي إخفاق) */
require __DIR__ . '/../php-edition/shipping/src/autoload.php';

use Alyssum\Shipping\{CarrierRegistry, ConnectionRepository, CredentialVault, CredentialsException, Parcel, ShippingFactory, ShippingService, Status, StatusMapper, UnsupportedCarrierException, WebhookProcessor};
use Alyssum\Shipping\Adapters\{EcotrackAdapter, MaystroAdapter, NoestAdapter, YalidineAdapter, ZRExpressAdapter};
use Alyssum\Shipping\Http\{CurlHttpClient, HttpClient, HttpResponse};

$total = 0; $fails = 0;
function ok(string $name, bool $cond, mixed $extra = null): void { global $total, $fails; $total++; if (!$cond) { $fails++; echo "✗ $name " . ($extra === null ? '' : json_encode($extra, JSON_UNESCAPED_UNICODE)) . "\n"; } else { echo "✓ $name\n"; } }
function throwsA(string $cls, callable $f): bool { try { $f(); } catch (Throwable $e) { return $e instanceof $cls; } return false; }

final class FakeHttp implements HttpClient
{
    /** @var list<array{0:string,1:string,2:array<string,string>,3:?string}> */ public array $calls = [];
    /** @var list<HttpResponse> */ public array $queue = [];
    public function request(string $method, string $url, array $headers = [], ?string $body = null): HttpResponse
    {
        $this->calls[] = [$method, $url, $headers, $body];
        return array_shift($this->queue) ?? new HttpResponse(200, '{}');
    }
    public function reply(int $status, array|string $b): static { $this->queue[] = new HttpResponse($status, is_array($b) ? json_encode($b) : $b); return $this; }
    public function last(): array { return $this->calls[array_key_last($this->calls)]; }
    public function body(): array { return json_decode((string)$this->last()[3], true) ?? []; }
}

$parcel = new Parcel(orderRef: 'A1001', name: 'Karim Benali', phone: '+213 550 12 34 56', wilayaCode: 16, commune: 'Bab Ezzouar', address: 'Cité 5 Juillet', total: 4200, shippingFee: 400, products: "عسل ×2 = 3800 DA\nزيت ×1 = 400 DA");

/* ───── الخزنة AES-256-GCM ───── */
$k1 = random_bytes(32); $k2 = random_bytes(32);
$v = new CredentialVault(['k1' => $k1], 'k1');
$secret = ['apiId' => 'ID-123', 'apiToken' => 'SUPER-SECRET-TOKEN-XYZ'];
$env = $v->encrypt($secret, 'user:7|carrier:yalidine');
ok('الخزنة: لا نص صريح في الظرف', !str_contains($env, 'SUPER-SECRET') && !str_contains($env, 'ID-123'));
ok('الخزنة: ذهاب وإياب', $v->decryptArray($env, 'user:7|carrier:yalidine') === $secret);
ok('الخزنة: nonce مختلف لكل تشفير', $v->encrypt($secret) !== $v->encrypt($secret));
ok('الخزنة: سياق (AAD) خاطئ يُرفض', throwsA(CredentialsException::class, fn() => $v->decrypt($env, 'user:8|carrier:yalidine')));
$tam = json_decode($env, true); $tam['ct'] = base64_encode(str_repeat('x', 20)); 
ok('الخزنة: التلاعب يُكشف', throwsA(CredentialsException::class, fn() => $v->decrypt(json_encode($tam), 'user:7|carrier:yalidine')));
ok('الخزنة: مفتاح آخر يُرفض', throwsA(CredentialsException::class, fn() => (new CredentialVault(['k1' => $k2], 'k1'))->decrypt($env, 'user:7|carrier:yalidine')));
ok('الخزنة: مفتاح بطول خاطئ يُرفض', throwsA(CredentialsException::class, fn() => new CredentialVault(['k1' => 'short'], 'k1')));
$v2 = new CredentialVault(['k1' => $k1, 'k2' => $k2], 'k2');
ok('الخزنة: التدوير يفكّ القديم ويشفّر بالجديد', $v2->decryptArray($env, 'user:7|carrier:yalidine') === $secret && json_decode($v2->reencrypt($env, 'user:7|carrier:yalidine'), true)['kid'] === 'k2');

/* ───── الحالات الموحَّدة ───── */
$map = [
    ['Livré', 'delivered'], ['livree', 'delivered'], ['Delivered', 'delivered'], ['Encaissé', 'delivered'],
    ['En livraison', 'out_for_delivery'], ['Sorti en livraison', 'out_for_delivery'], ['out_for_delivery', 'out_for_delivery'], ['Prêt pour livreur', 'out_for_delivery'],
    ['Tentative de livraison échouée', 'failed_attempt'], ['Echec livraison', 'failed_attempt'], ['Client absent', 'failed_attempt'],
    ['Retourné', 'returned'], ['Retour en transit', 'returned'], ['Retour à retirer', 'returned'], ['Refusé', 'returned'], ['Returned to sender', 'returned'],
    ['Annulé', 'cancelled'], ['Cancelled', 'cancelled'],
    ['Pas encore expédié', 'pending'], ['Prêt à expédier', 'pending'], ['En préparation', 'pending'], ['En attente de ramassage', 'pending'], ['Nouveau', 'pending'], ['Pending', 'pending'],
    ['Expédié', 'shipped'], ['Transfert vers hub', 'shipped'], ['En transit', 'shipped'], ['Reçu à Wilaya: Oran', 'shipped'], ['Ramassé', 'shipped'], ['Centre', 'shipped'], ['Picked up', 'shipped'],
    ['', 'unknown'], ['???', 'unknown'],
];
foreach ($map as [$raw, $exp]) { ok("الحالة «{$raw}» ← {$exp}", StatusMapper::map('x', $raw) === $exp, StatusMapper::map('x', $raw)); }
ok('الانتقال: لا رجوع للخلف', !Status::canTransition('shipped', 'pending') && Status::canTransition('pending', 'shipped'));
ok('الانتقال: النهائي لا يتغيّر', !Status::canTransition('delivered', 'shipped') && !Status::canTransition('returned', 'delivered') && !Status::canTransition('cancelled', 'shipped'));
ok('الانتقال: المرتجع/الملغى يُقبل من أي غير نهائي', Status::canTransition('out_for_delivery', 'returned') && Status::canTransition('pending', 'cancelled'));
ok('الانتقال: المجهول لا يُطبَّق', !Status::canTransition('pending', 'unknown'));

/* ───── السجلّ والمصنع ───── */
foreach (['yalidine' => YalidineAdapter::class, 'zrexpress' => ZRExpressAdapter::class, 'zr' => ZRExpressAdapter::class, 'procolis' => ZRExpressAdapter::class, 'maystro' => MaystroAdapter::class, 'noest' => NoestAdapter::class] as $c => $cls) {
    ok("المصنع: $c ← " . basename(str_replace('\\', '/', $cls)), ShippingFactory::make($c, new FakeHttp()) instanceof $cls);
}
foreach (['ecotrack', 'dhd', 'conexlog', 'zimou', 'hhd', 'anderson', 'ecom_delivery', 'elogistia', '48h'] as $c) {
    $a = ShippingFactory::make($c, new FakeHttp());
    ok("المصنع: $c ← EcotrackAdapter بالرمز نفسه", $a instanceof EcotrackAdapter && $a->code() === $c);
}
ok('المصنع: Mylers مخطَّط له فقط', throwsA(UnsupportedCarrierException::class, fn() => ShippingFactory::make('mylers')));
ok('المصنع: شركة مجهولة', throwsA(UnsupportedCarrierException::class, fn() => ShippingFactory::make('nope')));
ok('الكتالوج: كل عناصره لها حقول أو planned', count(array_filter(CarrierRegistry::catalog(), fn($c) => $c['activatable'] && !$c['fields'])) === 0);

/* ───── المحوّلات ───── */
$h = new FakeHttp();
$y = (new YalidineAdapter($h))->authenticate(['apiId' => 'AID', 'apiToken' => 'ATK']);
$h->reply(200, ['A1001' => ['success' => true, 'tracking' => 'yal-7788', 'label' => 'https://yalidine.app/label/yal-7788']]);
$r = $y->createParcel($parcel); [$m, $u, $hd] = $h->last(); $b = $h->body()[0];
ok('ياليدين: الإرسال والتتبع والبوليصة', $r->ok && $r->tracking === 'yal-7788' && $r->labelUrl === 'https://yalidine.app/label/yal-7788');
ok('ياليدين: الرابط والترويسات', $m === 'POST' && $u === 'https://api.yalidine.app/v1/parcels/' && $hd['X-API-ID'] === 'AID' && $hd['X-API-TOKEN'] === 'ATK');
ok('ياليدين: السعر بلا التوصيل والهاتف المحلي والاسم', $b['price'] === 3800 && $b['contact_phone'] === '0550123456' && $b['firstname'] === 'Karim' && $b['familyname'] === 'Benali' && $b['to_wilaya_name'] === 'Alger');
ok('ياليدين: التوصيل المدفوع ليس freeshipping', $b['freeshipping'] === false && $b['can_open'] === true);
$new = new Parcel('N1', 'A B', '0770000000', 59, 'Aflou', 'x', 1000);   // ولاية جديدة (59 Aflou ← الأم 3 Laghouat)
$h->reply(200, ['N1' => ['success' => true, 'tracking' => 'yal-1']]); $y->createParcel($new);
ok('ياليدين: الولاية الجديدة تُرسَل باسم الأم', $h->body()[0]['to_wilaya_name'] === 'Laghouat');
$sd = new Parcel('S1', 'A B', '0770000000', 16, 'Alger', 'x', 1000, 0, '', '', true, null);
ok('ياليدين: Stop Desk بلا مكتب يُرفض قبل الإرسال', !$y->createParcel($sd)->ok && count($h->calls) === 2);
$h->reply(200, ['A2' => ['success' => false, 'message' => 'Commune invalide']]); $bad = $y->createParcel(new Parcel('A2', 'A B', '0770000000', 16, 'Zzz', 'x', 1000));
ok('ياليدين: رسالة الرفض تصل', !$bad->ok && $bad->error === 'Commune invalide');
$h->reply(200, ['data' => [['tracking' => 'yal-7788', 'last_status' => 'En livraison']]]); $t = $y->trackParcel('yal-7788');
ok('ياليدين: التتبع ← موحَّد', $t->status === 'out_for_delivery' && str_ends_with($h->last()[1], '/v1/parcels/yal-7788'));
$h->reply(200, '{}'); ok('ياليدين: الإلغاء DELETE', $y->cancelParcel('yal-7788') && $h->last()[0] === 'DELETE');
$h->reply(401, '{}'); ok('ياليدين: 401 ← CredentialsException', throwsA(CredentialsException::class, fn() => $y->trackParcel('x')));
ok('ياليدين: مفاتيح ناقصة', throwsA(CredentialsException::class, fn() => (new YalidineAdapter($h))->authenticate(['apiId' => 'x'])));
$ev = $y->parseWebhook(['type' => 'parcel_status_updated', 'data' => [['tracking' => 'yal-7788', 'last_status' => 'Livré', 'order_id' => 'A1001']]], []);
ok('ياليدين: webhook', count($ev) === 1 && $ev[0]->status === 'delivered' && $ev[0]->orderRef === 'A1001');
ok('ياليدين: أحداث غير الحالة تُتجاهل', $y->parseWebhook(['type' => 'something_else', 'data' => []], []) === []);

$z = (new ZRExpressAdapter($h))->authenticate(['token' => 'TK', 'key' => 'KY']);
$h->reply(200, ['Colis' => [['Tracking' => 'ZR-9', 'MessageRetour' => 'Good']]]); $r = $z->createParcel($parcel); $hd = $h->last()[2]; $b = $h->body()['Colis'][0];
ok('ZR: الإرسال وترويستا token/key', $r->ok && $r->tracking === 'ZR-9' && $hd['token'] === 'TK' && $hd['key'] === 'KY' && str_starts_with($h->last()[1], 'https://procolis.com/api_v1/'));
ok('ZR: IDWilaya والإجمالي والهاتف', $b['IDWilaya'] === '16' && $b['Total'] === '4200' && $b['MobileA'] === '0550123456' && $b['TypeLivraison'] === '0');
$h->reply(200, ['Colis' => [['Tracking' => 'ZR-9', 'Situation' => 'En transit']]]); ok('ZR: التتبع', $z->trackParcel('ZR-9')->status === 'shipped');

$m = (new MaystroAdapter($h))->authenticate(['apiKey' => 'MK']);
$h->reply(201, ['display_id' => 'MY-5']); $r = $m->createParcel($parcel);
ok('Maystro: Authorization Token', $r->ok && $r->tracking === 'MY-5' && $h->last()[2]['Authorization'] === 'Token MK');

$n = (new NoestAdapter($h))->authenticate(['apiToken' => 'NT', 'userGuid' => 'GUID']);
$h->reply(200, ['success' => true, 'tracking' => 'NO-3']); $r = $n->createParcel($parcel); $b = $h->body();
ok('NOEST: المفاتيح داخل الجسم والمبلغ', $r->ok && $r->tracking === 'NO-3' && $b['api_token'] === 'NT' && $b['user_guid'] === 'GUID' && $b['montant'] === 4200 && $b['wilaya_id'] === 16);

$d = ShippingFactory::make('dhd', $h)->authenticate(['token' => 'EK']);
$h->reply(200, ['tracking' => 'DH-1']); $r = $d->createParcel($parcel);
ok('DHD: رابط Ecotrack وBearer', $r->ok && $h->last()[1] === 'https://dhd.ecotrack.dz/api/v1/create/order' && $h->last()[2]['Authorization'] === 'Bearer EK' && $h->body()['code_wilaya'] === 16);
$c = ShippingFactory::make('conexlog', $h);
ok('Conexlog: رابط مجهول يتطلب إدخال التاجر', throwsA(CredentialsException::class, fn() => $c->authenticate(['token' => 'x'])));
$c = ShippingFactory::make('conexlog', $h)->authenticate(['token' => 'x', 'baseUrl' => 'https://conexlog.ecotrack.dz/']);
$h->reply(200, ['data' => ['tracking' => 'CX-2']]); $c->createParcel($parcel);
ok('Conexlog: يعمل برابط التاجر', $h->last()[1] === 'https://conexlog.ecotrack.dz/api/v1/create/order');
ok('Ecotrack: رابط http مرفوض', throwsA(CredentialsException::class, fn() => ShippingFactory::make('ecotrack', $h)->authenticate(['token' => 'x', 'baseUrl' => 'http://x.dz'])));
$h->reply(200, ['activity' => [['status' => 'Expédié'], ['status' => 'Livré']]]); ok('Ecotrack: آخر نشاط يحدّد الحالة', $d->trackParcel('DH-1')->status === 'delivered');

/* ───── العميل الآمن ───── */
$cu = new CurlHttpClient();
ok('HTTP: http مرفوض', $cu->request('GET', 'http://example.com/')->error === 'insecure_url');
ok('HTTP: عنوان داخلي مرفوض', $cu->request('GET', 'https://127.0.0.1/')->error === 'private_address' && $cu->request('GET', 'https://192.168.1.1/')->error === 'private_address');

/* ───── قاعدة البيانات والخدمة والـwebhook ───── */
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec(file_get_contents(__DIR__ . '/../php-edition/shipping/schema.sqlite.sql'));
$vault = new CredentialVault(['k1' => $k1], 'k1');
$repo = new ConnectionRepository($pdo, $vault);
$http = new FakeHttp(); $svc = new ShippingService($pdo, $repo, $http); $wh = new WebhookProcessor($repo, $svc);
$conn = $repo->connect(7, 'yalidine', ['apiId' => 'AID', 'apiToken' => 'SUPER-SECRET-TOKEN-XYZ']);
$row = $pdo->query('SELECT * FROM user_carriers')->fetch();
ok('DB: المفاتيح مشفَّرة (لا نص صريح)', !str_contains(json_encode($row), 'SUPER-SECRET') && str_contains((string)$row['credentials_enc'], '"kid":"k1"'));
ok('DB: سرّ الـwebhook مجزَّأ لا صريح', !str_contains(json_encode($row), $conn['webhook_secret']) && $row['webhook_token_hash'] === hash('sha256', $conn['webhook_secret']));
ok('DB: التفعيل الناقص يُرفض', throwsA(CredentialsException::class, fn() => $repo->connect(8, 'yalidine', ['apiId' => 'x'])));
ok('DB: Mylers لا يُفعَّل', throwsA(UnsupportedCarrierException::class, fn() => $repo->connect(8, 'mylers', ['a' => 'b'])));
// صف منسوخ إلى مستخدم آخر لا يُفكّ (ربط AAD)
$pdo->prepare("UPDATE user_carriers SET user_id = 99 WHERE id = ?")->execute([$row['id']]);
ok('DB: نقل الصف لمستخدم آخر يفشل فكّه', throwsA(CredentialsException::class, fn() => $repo->adapterFor($repo->find(99, 'yalidine'))));
$pdo->prepare("UPDATE user_carriers SET user_id = 7 WHERE id = ?")->execute([$row['id']]);

$http->reply(200, ['A1001' => ['success' => true, 'tracking' => 'yal-7788']]);
$r1 = $svc->ship(7, 'yalidine', $parcel);
$r2 = $svc->ship(7, 'yalidine', $parcel);
ok('الخدمة: إرسال أول ناجح', $r1->ok && $r1->tracking === 'yal-7788');
ok('الخدمة: التكرار لا يُرسل ثانية (طلب HTTP واحد)', $r2->ok && $r2->error === 'duplicate' && $r2->tracking === 'yal-7788' && count($http->calls) === 1);
$pdo->exec("INSERT INTO shipments (connection_id,user_id,order_ref,carrier_code,tracking,status,cod_amount,created_at) VALUES ({$row['id']},7,'A-RACE','yalidine',NULL,'pending',0,'2026-01-01 00:00:00')");
$race = $svc->ship(7, 'yalidine', new Parcel('A-RACE', 'A B', '0770000000', 16, 'Alger', 'x', 1000));
ok('الخدمة: إرسال متزامن قيد التنفيذ لا يكرّر', !$race->ok && count($http->calls) === 1);
$http->reply(200, ['A-FAIL' => ['success' => false, 'message' => 'bad']]); $f = $svc->ship(7, 'yalidine', new Parcel('A-FAIL', 'A B', '0770000000', 16, 'Alger', 'x', 1000));
$http->reply(200, ['A-FAIL' => ['success' => true, 'tracking' => 'yal-9']]); $f2 = $svc->ship(7, 'yalidine', new Parcel('A-FAIL', 'A B', '0770000000', 16, 'Alger', 'x', 1000));
ok('الخدمة: الفشل يحرّر الحجز فتنجح إعادة المحاولة', !$f->ok && $f2->ok && $f2->tracking === 'yal-9');

$q = ['c' => $conn['public_id'], 't' => $conn['webhook_secret']];
$post = fn(array $p, array $query = null) => $wh->handle('POST', $query ?? $q, [], json_encode($p));
$status = fn() => $pdo->query("SELECT status FROM shipments WHERE tracking='yal-7788'")->fetchColumn();
[$code, , $body] = $post(['type' => 'parcel_status_updated', 'data' => [['tracking' => 'yal-7788', 'last_status' => 'Sorti en livraison']]]);
ok('webhook: تحديث الحالة', $code === 200 && json_decode($body, true)['updated'] === 1 && $status() === 'out_for_delivery', $body);
[, , $body] = $post(['type' => 'parcel_status_updated', 'data' => [['tracking' => 'yal-7788', 'last_status' => 'Sorti en livraison']]]);
ok('webhook: إعادة الإرسال المتطابقة تُتجاهل', json_decode($body, true)['updated'] === 0 && (int)$pdo->query('SELECT COUNT(*) FROM shipment_events')->fetchColumn() === 1);
$post(['type' => 'parcel_status_updated', 'data' => [['tracking' => 'yal-7788', 'last_status' => 'Livré']]]);
ok('webhook: التسليم', $status() === 'delivered');
$post(['type' => 'parcel_status_updated', 'data' => [['tracking' => 'yal-7788', 'last_status' => 'Expédié']]]);
ok('webhook: رسالة متأخرة لا تُرجع حالة نهائية', $status() === 'delivered');
[$code] = $post(['type' => 'parcel_status_updated', 'data' => [['tracking' => 'unknown-1', 'last_status' => 'Livré']]]);
ok('webhook: طرد مجهول = 200 (يتوقف التكرار)', $code === 200);
ok('webhook: سرّ خاطئ = 401', $post(['a' => 1], ['c' => $conn['public_id'], 't' => 'wrong'])[0] === 401);
ok('webhook: بلا معرّف = 401', $post(['a' => 1], [])[0] === 401 && $post(['a' => 1], ['c' => 'zz', 't' => 'x'])[0] === 401);
ok('webhook: JSON تالف = 400', $wh->handle('POST', $q, [], '{bad')[0] === 400);
ok('webhook: CRC GET', $wh->handle('GET', ['subscribe' => '1', 'crc_token' => 'abc123'], [], '') === [200, 'text/plain; charset=utf-8', 'abc123']);
ok('webhook: GET عادي = ready', json_decode($wh->handle('GET', [], [], '')[2], true)['webhook'] === 'ready');
ok('webhook: طريقة غير مسموحة', $wh->handle('DELETE', $q, [], '')[0] === 405);
ok('webhook: جسم ضخم يُرفض', $wh->handle('POST', $q, [], str_repeat('x', 1_000_001))[0] === 413);
// شركة من عائلة Ecotrack عبر الـwebhook نفسه (صيغة عامة)
$ec = $repo->connect(7, 'dhd', ['token' => 'EK']);
$http->reply(200, ['tracking' => 'DH-55']); $svc->ship(7, 'dhd', new Parcel('E1', 'A B', '0770000000', 31, 'Oran', 'x', 2000));
[, , $body] = $wh->handle('POST', ['c' => $ec['public_id'], 't' => $ec['webhook_secret']], [], json_encode(['tracking' => 'DH-55', 'status' => 'Expédié']));
ok('webhook: عائلة Ecotrack بالرابط نفسه', json_decode($body, true)['updated'] === 1 && $pdo->query("SELECT status FROM shipments WHERE tracking='DH-55'")->fetchColumn() === 'shipped', $body);
// تدوير المفاتيح
$vaultB = new CredentialVault(['k1' => $k1, 'k2' => $k2], 'k2'); $repoB = new ConnectionRepository($pdo, $vaultB);
ok('التدوير: يعيد تشفير كل الصفوف ويبقى الفكّ سليماً', $repoB->rotate() === 2 && $repoB->adapterFor($repoB->find(7, 'yalidine')) instanceof YalidineAdapter && $pdo->query("SELECT key_id FROM user_carriers WHERE carrier_code='dhd'")->fetchColumn() === 'k2');

echo "\n" . ($fails ? "✗ أخفق $fails من $total\n" : "✓ نجح $total من $total\n");
exit($fails ? 1 : 0);
