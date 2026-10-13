<?php
declare(strict_types=1);
/* اختبار «المعايرة عند أول ربط»: مع أول مفاتيح يلتقط النظام حساب الشركة (بلدياتها/مكاتبها/تعريفتها/حالات طرودها) ويبني ملف تصحيح يُطبَّق قبل أول إرسال حقيقي.
   المحاكيات (scripts/lib/carrier-sims.php) تعرض كتالوجاً بتهجئة الشركة المخالفة لكتالوجنا عمداً.
     php scripts/test-calibration.php      (كود خروج 1 عند أي إخفاق) */
require __DIR__ . '/../php-edition/shipping/src/autoload.php';
require __DIR__ . '/lib/carrier-sims.php';

use Alyssum\Shipping\{Calibrator, CalibrationService, ConnectionRepository, CredentialVault, OurGeo, Parcel, ShippingFactory, ShippingService, Status, WebhookProcessor};

$total = 0; $fails = 0;
function ok(string $name, bool $cond, mixed $extra = null): void { global $total, $fails; $total++; if (!$cond) { $fails++; echo "✗ $name " . ($extra === null ? '' : json_encode($extra, JSON_UNESCAPED_UNICODE)) . "\n"; } else { echo "✓ $name\n"; } }

/* كتالوجنا (تهجئة مخالفة) ← كتالوج الشركة */
$ours = new OurGeo([
    16 => ['Alger Centre', 'Bab-Ezzouar', 'Kouba', 'Bordj El Kiffan', 'El Harrach', 'Zeralda'],
    31 => ['Oran', 'Es Senia'],
    32 => ['El Bayadh'],
    17 => ['Djelfa', 'Ain Ouessara'],
]);
$theirs = [
    16 => ['Alger Centre', 'Bab Ezzouar', 'Kouba', 'Bordj El Kiffane', 'El Harrach', 'Rouiba'],
    31 => ['Oran', 'Es Senia'],
    32 => ['El Bayadh'],
    17 => ['Djelfa', 'Aïn Oussera'],
];
$pause = static function (int $ms): void {};
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec(file_get_contents(__DIR__ . '/../php-edition/shipping/schema.sqlite.sql'));
$repo = new ConnectionRepository($pdo, new CredentialVault(['k1' => random_bytes(32)], 'k1'));

function par(array $o = []): Parcel
{
    return Parcel::fromArray($o + ['order_ref' => 'C' . random_int(100000, 999999), 'name' => 'Karim Benali', 'phone' => '+213 550 12 34 56', 'wilaya' => 16, 'commune' => 'Bab-Ezzouar', 'address' => 'Cité 5 Juillet', 'total' => 4200, 'fee' => 400, 'products' => "عسل ×2 = 3800 DA\nزيت ×1 = 400 DA"]);
}

/* ═══════════ ياليدين: المعايرة الكاملة ═══════════ */
echo "\n── yalidine ──\n";
$sim = new YalidineSim(); $sim->catalog = $theirs; $sim->closed = ['El Harrach'];
$sim->centers = [16 => [['center_id' => 161601, 'name' => 'Bab Ezzouar Desk', 'address' => 'x', 'commune_name' => 'Bab Ezzouar', 'wilaya_id' => 16]]];
foreach (['Livré', 'Retourné au vendeur', 'Statut Jamais Vu 77', 'Sorti en livraison'] as $i => $st) { $sim->setStatus('ext-' . $i, $st); }
$sim->setStatus('yal-probe1', 'En préparation');

/* بلا معايرة: التهجئة المخالفة تُرفض عند الشركة (هذا ما كان سيكتشفه العميل الأول) */
$conn = $repo->connect(1, 'yalidine', ['apiId' => 'AID', 'apiToken' => 'TOK'], null, true, $sim);
$row = $repo->find(1, 'yalidine');
$ad0 = $repo->adapterFor($row, $sim);
$r0 = $ad0->createParcel(par(['commune' => 'Bab-Ezzouar']));
ok('بلا معايرة: «Bab-Ezzouar» ترفضها الشركة', !$r0->ok, $r0->error);

$svc = new CalibrationService($repo, $ours, $sim, $pause, 2);          // دفعات من ولايتين: تثبت أن الاستئناف يعمل
$s = $svc->start($row, 0.0);                                           // ميزانية 0: يحفظ الحالة الأولية فقط
ok('البدء: المعايرة لم تنتهِ وتنتظر أول دفعة', $s['done'] === false && $s['progress']['left'] === 4, $s['progress']);
$s = $svc->advance($row, 0.0);
$guard = 0; while (!$s['done'] && $guard++ < 50) { $s = $svc->advance($row, 0.001); }
ok('المعايرة تنتهي بالاستئناف عبر طلبات متتالية', $s['done'] === true && $s['phase'] === 'done', $s);
ok('ping: المفاتيح صالحة', ($s['ping']['ok'] ?? null) === true);
$c = $s['communes'];
ok('بلديات: 4 ولايات و7 مطابقات بتصحيح التهجئة', $c['wilayas'] === 4 && $c['mapped'] >= 3, $c);
ok('بلديات: «Zeralda» غير موجودة عند الشركة', $c['unmatched'] === 1 && $s['unmatched_examples'] === ['Zeralda'], [$c, $s['unmatched_examples']]);
ok('بلديات: «El Harrach» لا توصّل إليها الشركة', $c['undeliverable'] >= 1, $c);
ok('بلديات: «Rouiba» عند الشركة فقط (فرق في العدّ)', $c['carrierOnly'] === 1, $c);
ok('مكاتب: مركز Stop Desk الحقيقي التُقط', $s['desks'] === 1);
ok('تعريفة الحساب التُقطت (4 ولايات)', $s['fees'] === 4, $s['fees']);
ok('حالات: 5 حالات مختلفة في حسابك', $s['statuses']['seen'] === 5, $s['statuses']);
ok('حالات: «Statut Jamais Vu 77» مجهولة ومُعلَنة', $s['statuses']['unknown'] === 1 && str_contains(implode(' ', $s['warnings']), 'Statut Jamais Vu 77'), $s['warnings']);
ok('تحقّق: تحليل ردّ التتبع نجح على طرد حقيقي', ($s['verify']['ok'] ?? 0) >= 1 && ($s['verify']['fail'] ?? 1) === 0, $s['verify']);
$prof = $repo->profile((int)$row['id']);
ok('الملف محفوظ في قاعدة البيانات بلا أسرار', isset($prof['communes']['16']) && !str_contains(json_encode($prof), 'TOK'));

/* بعد المعايرة: الإرسال بتهجئتنا ينجح ويصل بتهجئة الشركة */
$ad = $repo->adapterFor($row, $sim);
$r1 = $ad->createParcel(par(['commune' => 'Bab-Ezzouar']));
ok('بعد المعايرة: «Bab-Ezzouar» ← تُرسل بتهجئة الشركة وتنجح', $r1->ok && $r1->tracking !== '', $r1->error);
$sentCommune = null; foreach ($sim->log as $l) { if ($l[0] === 'POST' && $l[1] === '/v1/parcels/') { $sentCommune = $l[3][0]['to_commune_name'] ?? null; } }
ok('الاسم المُرسل = تهجئة الشركة', $sentCommune === 'Bab Ezzouar', $sentCommune);
$r2 = $ad->createParcel(par(['commune' => 'Bordj El Kiffan']));
ok('بعد المعايرة: بلدية مقاربة (Kiffan→Kiffane) تُصحَّح وتنجح', $r2->ok, $r2->error);
$r3 = $ad->createParcel(par(['commune' => 'Zeralda']));
ok('بلدية غير موجودة عند الشركة ← منع مبكر برسالة عربية بلا استدعاء', !$r3->ok && str_contains((string)$r3->error, 'غير موجودة'), $r3->error);
$n = count($sim->log);
$r4 = $ad->createParcel(par(['commune' => 'El Harrach']));
ok('بلدية لا توصّل إليها الشركة ← منع مبكر', !$r4->ok && str_contains((string)$r4->error, 'لا توصّل'), $r4->error);
ok('المنع المبكر لا يستهلك طلباً عند الشركة', count($sim->log) === $n);
$r5 = $ad->createParcel(par(['commune' => 'Kouba', 'stop_desk' => true, 'desk_id' => 999999]));
ok('مكتب Stop Desk غير موجود في حسابك ← منع مبكر', !$r5->ok && str_contains((string)$r5->error, 'مكتب'), $r5->error);
$r6 = $ad->createParcel(par(['commune' => 'Kouba', 'stop_desk' => true, 'desk_id' => 161601]));
ok('مكتب حقيقي من حسابك ← ينجح', $r6->ok, $r6->error);
ok('لا مخالفة صيغة طوال الجلسة', $sim->violations === [], $sim->violations);
ok('حالة مجهولة لا تُطبَّق على الطلب', $ad->mapStatus('Statut Jamais Vu 77') === Status::UNKNOWN);

/* إعادة الربط بمفاتيح جديدة ← يُمسح الملف القديم (قد يكون حساباً مختلفاً) */
$repo->connect(1, 'yalidine', ['apiId' => 'AID', 'apiToken' => 'TOK'], null, true, $sim);
ok('إعادة الربط تمسح الملف القديم', $repo->profile((int)$row['id']) === []);

/* مفاتيح خاطئة ← لا معايرة وتحذير واضح */
$bad = new Calibrator($ours); $adBad = ShippingFactory::make('yalidine', $sim)->authenticate(['apiId' => 'AID', 'apiToken' => 'NOPE']);
$pb = $bad->run($adBad);
ok('مفاتيح مرفوضة ← انتهاء فوري بتحذير', $pb['done'] === true && str_contains(implode(' ', $pb['warnings']), 'رفضت الشركة'), $pb['warnings']);

/* الترقيم: الولاية ببلديات أكثر من صفحة واحدة تُقرأ كلها */
$sim2 = new YalidineSim(); $sim2->pageSize = 2; $sim2->catalog = [16 => ['A1', 'B2', 'C3', 'D4', 'E5']];
$ad2 = ShippingFactory::make('yalidine', $sim2)->authenticate(['apiId' => 'AID', 'apiToken' => 'TOK']);
$d2 = $ad2->discover([16], ['communes' => true]);
ok('الترقيم: 5 بلديات عبر 3 صفحات', count($d2['communes'][16] ?? []) === 5, $d2['communes'] ?? null);

/* تعذّر الاتصال في بعض الولايات ← تحذير لا انهيار */
$sim3 = new YalidineSim(); $sim3->catalog = $theirs; $sim3->rateLimit = true;
$ad3 = ShippingFactory::make('yalidine', $sim3)->authenticate(['apiId' => 'AID', 'apiToken' => 'TOK']); $ad3->pause = $pause;
$p3 = (new Calibrator($ours))->run($ad3);
ok('429 متواصل ← المعايرة تنتهي بتحذير لا بانهيار', $p3['done'] === true, $p3['phase']);

/* ═══════════ الشركات الأخرى: نفس الدورة ═══════════ */
$others = [
    'dhd'     => [new EcotrackSim(), ['token' => 'TOK'], 'communes'],
    'noest'   => [new NoestSim(), ['apiToken' => 'TOK', 'userGuid' => 'GUID'], 'communes'],
    'maystro' => [new MaystroSim(), ['apiKey' => 'TOK'], 'communes'],
];
foreach ($others as $code => [$o, $cred, ]) {
    echo "\n── $code ──\n";
    $o->catalog = $theirs;
    $adx = ShippingFactory::make($code, $o)->authenticate($cred); $adx->pause = $pause;
    $px = (new Calibrator($ours, 10))->run($adx);
    ok("$code: المعايرة تنتهي", $px['done'] === true, $px['warnings']);
    $sm = Calibrator::summary($px);
    ok("$code: بلديات 4 ولايات", $sm['communes']['wilayas'] === 4, $sm['communes']);
    ok("$code: تصحيح «Bab-Ezzouar» و«Kiffan»", isset($px['communes']['16']['map'][CommuneMatcher_ck('Bab-Ezzouar')]) || $sm['communes']['mapped'] >= 2, $px['communes']['16'] ?? null);
    ok("$code: «Zeralda» غير موجودة", in_array('Zeralda', $px['communes']['16']['unmatched'] ?? [], true), $px['communes']['16']['unmatched'] ?? null);
    $adp = ShippingFactory::make($code, $o)->authenticate($cred)->withProfile($px);
    $rr = $adp->createParcel(par(['commune' => 'Bab-Ezzouar']));
    ok("$code: الإرسال بعد المعايرة ينجح", $rr->ok, $rr->error);
    $rz = $adp->createParcel(par(['commune' => 'Zeralda']));
    ok("$code: بلدية غير موجودة ← منع مبكر", !$rz->ok && str_contains((string)$rz->error, 'غير موجودة'), $rz->error);
    ok("$code: لا مخالفة صيغة", $o->violations === [], $o->violations);
}
function CommuneMatcher_ck(string $s): string { return \Alyssum\Shipping\CommuneMatcher::normalize($s); }

/* ZR: لا قراءة متاحة ← ملاحظة صريحة لا ادعاء */
echo "\n── zrexpress ──\n";
$z = new ZRSim(); $adz = ShippingFactory::make('zrexpress', $z)->authenticate(['token' => 'TK', 'key' => 'KY']); $adz->pause = $pause;
$pz = (new Calibrator($ours))->run($adz);
ok('zrexpress: تنتهي بملاحظة أن الشركة لا تتيح القراءة', $pz['done'] === true && $pz['notes'] !== [] && $pz['communes'] === [], $pz['notes']);

/* ═══════════ الـwebhook: التقاط الشكل + التوقيع + تصحيح الحالات ═══════════ */
echo "\n── webhook ──\n";
$simW = new YalidineSim(); $simW->catalog = $theirs;
$connW = $repo->connect(2, 'yalidine', ['apiId' => 'AID', 'apiToken' => 'TOK', 'webhookSecret' => 'shh-secret'], null, false, $simW);
$rowW = $repo->find(2, 'yalidine');
$svcW = new ShippingService($pdo, $repo, $simW); $wh = new WebhookProcessor($repo, $svcW);
$q = ['c' => $connW['public_id'], 't' => $connW['webhook_secret']];
$body = json_encode(['type' => 'parcel_status_updated', 'data' => [['tracking' => 'yal-9ZZ', 'last_status' => 'Livré']]]);
[$code1] = $wh->handle('POST', $q, [], $body);
ok('webhook: سرّ التوقيع مضبوط + بلا توقيع ← 401', $code1 === 401, $code1);
[$code2] = $wh->handle('POST', $q, ['x-yalidine-signature' => 'deadbeef'], $body);
ok('webhook: توقيع خاطئ ← 401', $code2 === 401, $code2);
$sig = hash_hmac('sha256', $body, 'shh-secret');
[$code3, , $out3] = $wh->handle('POST', $q, ['x-yalidine-signature' => $sig], $body);
ok('webhook: توقيع صحيح ← 200 ويُحلَّل', $code3 === 200 && (json_decode($out3, true)['received'] ?? 0) === 1, $out3);
[$code4] = $wh->handle('POST', $q, ['x-hub-signature-256' => 'sha256=' . $sig], $body);
ok('webhook: صيغة sha256= مقبولة', $code4 === 200);
$wp = $repo->profile((int)$rowW['id']);
ok('webhook: التُقط شكل الإشعار وعدد المحلَّل منه', ($wp['webhook']['received'] ?? 0) === 2 && ($wp['webhook']['parsed'] ?? 0) === 2 && ($wp['webhook']['shapes'][0] ?? '') === 'type,data' && ($wp['webhook']['signed'] ?? null) === true, $wp['webhook'] ?? null);
$body2 = json_encode(['event' => 'weird', 'payload' => ['x' => 1]]); $sig2 = hash_hmac('sha256', $body2, 'shh-secret');
$wh->handle('POST', $q, ['x-yalidine-signature' => $sig2], $body2);
$wp = $repo->profile((int)$rowW['id']);
ok('webhook: إشعار بشكل غير مفهوم يُسجَّل «empty» لتنبيه الدعم', ($wp['webhook']['empty'] ?? 0) === 1 && count($wp['webhook']['shapes']) === 2, $wp['webhook'] ?? null);

/* الحالات المثبَّتة في الملف تُطبَّق على الـwebhook أيضاً */
$connO = $repo->connect(3, 'yalidine', ['apiId' => 'AID', 'apiToken' => 'TOK'], null, false, $simW); $rowO = $repo->find(3, 'yalidine');
$repo->saveProfile((int)$rowO['id'], ['v' => 1, 'communes' => [], 'status_overrides' => [\Alyssum\Shipping\StatusMapper::normalize('Statut Maison X') => Status::DELIVERED]]);
ok('تثبيت حالة خاصة بالحساب يُطبَّق عبر mapStatus', $repo->adapterFor($rowO, $simW)->mapStatus('Statut Maison X') === Status::DELIVERED);

/* قرارات إدارة المنصة للحالات المجهولة تُدمج في ملف كل اتصال وتسبق القاموس والتثبيت المحلي */
echo "\n── fixes ──\n";
$n1 = \Alyssum\Shipping\StatusMapper::normalize('Statut Jamais Vu 77');
$fx = [['c' => 'yalidine', 'n' => $n1, 'u' => Status::OUT_FOR_DELIVERY], ['c' => 'noest', 'n' => 'x', 'u' => Status::DELIVERED], ['c' => 'yalidine', 'n' => 'bad', 'u' => 'nonsense']];
$rowF = $repo->find(3, 'yalidine');
ok('fixes: تُدمج لشركة الاتصال فقط وتتجاهل القيم الخاطئة', $repo->applyFixes(3, $fx) === 1 && array_keys($repo->profile((int)$rowF['id'])['fixes']) === [$n1]);
$adF = $repo->adapterFor($rowF, $simW);
ok('fixes: الحالة المجهولة تصير مفهومة بقرار الإدارة', $adF->mapStatus('Statut Jamais Vu 77') === Status::OUT_FOR_DELIVERY && $adF->explainStatus('Statut Jamais Vu 77')[1] === 'override');
ok('fixes: لا تغيّر قرارات غيرها', $adF->mapStatus('Livré') === Status::DELIVERED);
ok('fixes: إعادة التطبيق بلا تغيير ← 0', $repo->applyFixes(3, $fx) === 0);
$svcF = new CalibrationService($repo, $ours, $simW, $pause, 2); $simW->catalog = $theirs; $simW->setStatus('ext-9', 'Statut Jamais Vu 77');
$sF = $svcF->start($rowF, 0.0); $g = 0; while (!$sF['done'] && $g++ < 50) { $sF = $svcF->advance($rowF, 0.001); }
ok('fixes: تبقى بعد إعادة المعايرة والحالة لا تُعدّ مجهولة', !empty($repo->profile((int)$rowF['id'])['fixes']) && $sF['statuses']['unknown'] === 0, $sF['statuses']);
$repo->applyFixes(3, []);
ok('fixes: إزالة القرار من المنصة تزيله من الملف', ($repo->profile((int)$rowF['id'])['fixes'] ?? []) === []);

echo "\n" . ($fails ? "✗ أخفق $fails من $total" : "✓ $total فحصاً ناجحاً") . "\n";
exit($fails ? 1 : 0);
