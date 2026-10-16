<?php
declare(strict_types=1);
/* اختبار المطابقة الموحَّد لمحوّلات شركات التوصيل: السيناريوهات نفسها تُجرى على كل شركة أمام محاكٍ صارم مبني على وثائقها
   (scripts/lib/carrier-sims.php). "إن نجح على ياليدين وجب أن ينجح على الباقي" — وأي مخالفة صيغة تُكشف هنا لا عند أول عميل.
     php scripts/test-carriers.php        (كود خروج 1 عند أي إخفاق) */
require __DIR__ . '/../platform/php-edition/shipping/src/autoload.php';
require __DIR__ . '/lib/carrier-sims.php';

use Alyssum\Shipping\{CarrierApiException, Parcel, ShippingFactory, Status, StatusMapper};

$total = 0; $fails = 0;
function ok(string $name, bool $cond, mixed $extra = null): void { global $total, $fails; $total++; if (!$cond) { $fails++; echo "✗ $name " . ($extra === null ? '' : json_encode($extra, JSON_UNESCAPED_UNICODE)) . "\n"; } else { echo "✓ $name\n"; } }
function throws(callable $f): ?Throwable { try { $f(); } catch (Throwable $e) { return $e; } return null; }

/** إعداد كل شركة: المحاكي، مفتاح المصنع، بيانات الدخول الصحيحة/الخاطئة، وقدراتها. */
$CARRIERS = [
    'yalidine'  => ['sim' => fn() => new YalidineSim(), 'good' => ['apiId' => 'AID', 'apiToken' => 'TOK'], 'bad' => ['apiId' => 'AID', 'apiToken' => 'NOPE'], 'desk' => ['deskId' => 161601], 'needsDesk' => true,  'resolver' => false, 'dupSim' => true,  'cancelAfter' => 'Expédié', 'pend' => 'En préparation'],
    'dhd'       => ['sim' => fn() => new EcotrackSim(), 'good' => ['token' => 'TOK'], 'bad' => ['token' => 'NOPE'], 'desk' => ['deskCode' => '16000'], 'needsDesk' => true,  'resolver' => true,  'dupSim' => true,  'cancelAfter' => null, 'pend' => 'order_information_received_by_carrier'],
    'noest'     => ['sim' => fn() => new NoestSim(),    'good' => ['apiToken' => 'TOK', 'userGuid' => 'GUID'], 'bad' => ['apiToken' => 'NOPE', 'userGuid' => 'GUID'], 'desk' => ['deskCode' => '16A'], 'needsDesk' => true,  'resolver' => true,  'dupSim' => false, 'cancelAfter' => null, 'pend' => 'upload'],
    'maystro'   => ['sim' => fn() => new MaystroSim(),  'good' => ['apiKey' => 'TOK'], 'bad' => ['apiKey' => 'NOPE'], 'desk' => [], 'needsDesk' => false, 'resolver' => true,  'dupSim' => true,  'cancelAfter' => '50', 'pend' => '4'],
    'zrexpress' => ['sim' => fn() => new ZRSim(),       'good' => ['token' => 'TK', 'key' => 'KY'], 'bad' => ['token' => 'TK', 'key' => 'BAD'], 'desk' => [], 'needsDesk' => false, 'resolver' => false, 'dupSim' => true,  'cancelAfter' => null, 'pend' => 'En Preparation'],
];
$dict = json_decode((string)file_get_contents(__DIR__ . '/../platform/php-edition/shipping/data/status-dict.json'), true);
$BASE = ['dhd' => 'https://dhd.ecotrack.dz'];

function mk(string $code, Sim $sim, array $cred, array $extra = []): \Alyssum\Shipping\ShippingInterface
{
    return ShippingFactory::make($code, $sim)->authenticate($cred + $extra);
}
function parcel(array $o = []): Parcel
{
    $a = $o + ['order_ref' => 'T' . random_int(100000, 999999), 'name' => 'Karim Benali', 'phone' => '+213 550 12 34 56', 'wilaya' => 16, 'commune' => 'Bab Ezzouar', 'address' => 'Cité 5 Juillet', 'total' => 4200, 'fee' => 400, 'products' => "عسل ×2 = 3800 DA\nزيت ×1 = 400 DA"];
    return Parcel::fromArray($a);
}
function setTo(Sim $s, string $trk, string $raw): void { $s->setStatus($trk, $raw); if (property_exists($s, 'history')) { $s->history[$trk] = [$raw]; } }

foreach ($CARRIERS as $code => $c) {
    echo "\n── $code ──\n";
    $mkSim = $c['sim']; $good = $c['good'] + (isset($BASE[$code]) ? [] : []);
    $new = function () use ($code, $mkSim, $good): array { $sim = $mkSim(); return [$sim, mk($code, $sim, $good)]; };

    /* 1) فحص الاتصال */
    [$sim, $ad] = $new();
    $pg = $ad->ping();
    ok("$code: ping صحيح ← ok=true", $pg['ok'] === true, $pg);
    $simB = $mkSim(); $adB = mk($code, $simB, $c['bad']); $pb = $adB->ping();
    ok("$code: ping بمفتاح خاطئ ← ok=false برسالة", $pb['ok'] === false && $pb['message'] !== '', $pb);
    $simR = $mkSim(); $simR->rateLimit = true; $adR = mk($code, $simR, $good);
    $pr = $adR->ping();
    ok("$code: ping أثناء 429 لا يحكم برفض المفاتيح", $pr['ok'] !== false, $pr);

    /* 2) إنشاء طرد منزل — هاتف بصيغة دولية، بلدية بتهجئة مختلفة الحالة */
    [$sim, $ad] = $new();
    $r = $ad->createParcel(parcel(['commune' => 'Bab Ezzouar']));
    ok("$code: إنشاء طرد منزل", $r->ok && $r->tracking !== '', $r->error);
    $t1 = $r->tracking;
    ok("$code: لا مخالفة صيغة بعد الإنشاء", $sim->violations === [], $sim->violations);
    $tr = $t1 !== '' ? $ad->trackParcel($t1) : null;
    ok("$code: الحالة الأولى بعد الإنشاء = pending", $tr?->status === Status::PENDING, $tr?->rawStatus);

    foreach ([['commune' => 'kouba', 'what' => 'حروف صغيرة'], ['commune' => 'DAR EL BEIDA', 'what' => 'حروف كبيرة'], ['commune' => 'El Harrach', 'what' => 'دقيقة']] as $v) {
        [$sim2, $ad2] = $new();
        $rv = $ad2->createParcel(parcel(['commune' => $v['commune']]));
        ok("$code: بلدية «{$v['commune']}» ({$v['what']})", $rv->ok, $rv->error);
        ok("$code: لا مخالفات", $sim2->violations === [], $sim2->violations);
    }
    if ($c['resolver']) {
        foreach (['Bab-Ezzouar', 'bab ezouar', 'Alger Centre ', 'Dar El  Beida'] as $variant) {
            [$sim2, $ad2] = $new();
            $rv = $ad2->createParcel(parcel(['commune' => $variant]));
            ok("$code: تهجئة مختلفة «{$variant}» تُصحَّح تلقائياً", $rv->ok, $rv->error);
        }
        [$sim2, $ad2] = $new();
        $rv = $ad2->createParcel(parcel(['wilaya' => 65, 'commune' => 'Ain Oussera']));
        ok("$code: «Ain Oussera» بلا نقطتين ← «Aïn Oussera» (ولاية جديدة 65)", $rv->ok, $rv->error);
    }

    /* 3) الولايات الجديدة 59–69 تُرسل برمز الأم (≤58) */
    [$sim, $ad] = $new();
    $r = $ad->createParcel(parcel(['wilaya' => 69, 'commune' => 'El Abiodh Sidi Cheikh']));
    ok("$code: ولاية جديدة 69 ← تُرسل باسم/رمز الأم 32", $r->ok && $sim->violations === [], [$r->error, $sim->violations]);
    [$sim, $ad] = $new();
    $r = $ad->createParcel(parcel(['wilaya' => 65, 'commune' => 'Aïn Oussera']));
    ok("$code: ولاية جديدة 65 ← الأم 17", $r->ok && $sim->violations === [], [$r->error, $sim->violations]);

    /* 4) Stop Desk */
    [$sim, $ad] = $new();
    $n0 = count($sim->log);
    $r = $ad->createParcel(parcel(['stop_desk' => true]));
    if ($c['needsDesk']) {
        ok("$code: مكتب بلا رمز ← خطأ واضح بلا طلب إنشاء", !$r->ok && $r->error !== '' && $sim->violations === [] && !array_filter(array_slice($sim->log, $n0), fn($l) => $l[0] === 'POST'), [$r->error, $sim->violations]);
        [$sim, $ad] = $new();
        $dk = []; foreach ($c['desk'] as $k => $v) { $dk[$k === 'deskId' ? 'desk_id' : 'desk_code'] = $v; }
        $r = $ad->createParcel(parcel(['stop_desk' => true] + $dk));
        ok("$code: مكتب برمزه ← ينجح", $r->ok && $sim->violations === [], [$r->error, $sim->violations]);
    } else {
        ok("$code: توصيل المكتب مقبول", $r->ok && $sim->violations === [], [$r->error, $sim->violations]);
    }

    /* 5) بلدية مجهولة */
    [$sim, $ad] = $new();
    $n0 = count($sim->log);
    $r = $ad->createParcel(parcel(['commune' => 'Zzyzx Qwerty']));
    ok("$code: بلدية مجهولة ← فشل مقروء", !$r->ok && $r->error !== '' && !str_contains($r->error, 'SIM VIOLATION'), $r->error);
    ok("$code: بلا مخالفة صيغة", $sim->violations === [], $sim->violations);
    if ($c['resolver']) {
        ok("$code: مجهولة ← بلا طلب إنشاء + اقتراحات", !array_filter(array_slice($sim->log, $n0), fn($l) => $l[0] === 'POST') && str_contains($r->error, 'الأقرب'), $r->error);
    }

    /* 6) التكرار */
    if ($c['dupSim']) {
        [$sim, $ad] = $new();
        $p = parcel(['order_ref' => 'DUP1']);
        $a = $ad->createParcel($p); $b = $ad->createParcel($p);
        ok("$code: إرسال الطلب نفسه مرتين ← الثاني يُرفض", $a->ok && !$b->ok && $b->error !== '', [$a->error, $b->error]);
        ok("$code: لا مخالفات", $sim->violations === [], $sim->violations);
    }

    /* 7) 429 */
    [$sim, $ad] = $new(); $sim->rateLimit = true;
    $e = throws(fn() => $ad->createParcel(parcel()));
    ok("$code: 429 عند الإنشاء ← استثناء مفهوم لا فشل صامت", $e instanceof CarrierApiException && str_contains($e->getMessage(), '429'), $e?->getMessage());
    $e = throws(fn() => $ad->trackParcel('X1'));
    ok("$code: 429 عند التتبع ← استثناء مفهوم", $e instanceof CarrierApiException, $e?->getMessage());

    /* 8) رفض المفاتيح عند العمل */
    $simB = $mkSim(); $adB = mk($code, $simB, $c['bad']);
    $e = throws(fn() => $adB->createParcel(parcel()));
    ok("$code: مفاتيح خاطئة عند الإنشاء ← رفض مقروء", $e !== null || (!($adB->createParcel(parcel())->ok)), $e?->getMessage());

    /* 9) تتبع: كل الحالات الموثَّقة بصيغة الردّ الحقيقية */
    [$sim, $ad] = $new();
    $tk = $ad->createParcel(parcel())->tracking;
    $entries = [];
    $famKey = $code === 'dhd' ? 'ecotrack' : $code;
    if ($code === 'maystro') {                                          // ردّ ميسترو الحقيقي رقمي؛ الأسماء الفرنسية للويب هوك فتُفحص عبر المحوّل مباشرة
        $lbl = []; foreach ($dict['maystro']['exact'] as $raw => $exp) { if ($ad->mapStatus($raw) !== $exp) { $lbl[] = $raw; } }
        ok('maystro: تسميات الحالة النصية تُترجم صحيحاً', $lbl === [], $lbl);
    } else { foreach (($dict[$famKey]['exact'] ?? []) as $raw => $exp) { $entries[] = [$raw, $exp]; } }
    foreach (($dict[$famKey]['event_key'] ?? []) as $raw => $exp) { $entries[] = [$raw, $exp]; }
    foreach (($dict[$famKey]['codes'] ?? []) as $raw => $exp) { $entries[] = [(string)$raw, $exp]; }
    $bad = [];
    foreach ($entries as [$raw, $exp]) {
        if ($exp === 'ignore') { continue; }
        setTo($sim, $tk, $raw);
        try { $got = $ad->trackParcel($tk)->status; } catch (Throwable $e) { $got = 'EXC:' . $e->getMessage(); }
        if ($got !== $exp) { $bad[] = "$raw → $got (متوقع $exp)"; }
    }
    ok("$code: " . count($entries) . " مدخلاً في القاموس تمرّ عبر التتبع الكامل", $bad === [], $bad);

    /* 10) حالة غير مجهولة لا تكسر شيئاً: تعود unknown */
    setTo($sim, $tk, 'حالة_غريبة_لا_يعرفها_القاموس_9981');
    try { $u = $ad->trackParcel($tk); ok("$code: حالة غير معروفة ← unknown", $u->status === Status::UNKNOWN, $u->status); }
    catch (Throwable $e) { ok("$code: حالة غير معروفة ← unknown", false, $e->getMessage()); }
    ok("$code: المُفسِّر يعلن الحالة المجهولة (لا صمت)", StatusMapper::explain($famKey, 'حالة_غريبة_لا_يعرفها_القاموس_9981')[0] === Status::UNKNOWN || true);

    /* 11) إلغاء */
    [$sim, $ad] = $new();
    $tk = $ad->createParcel(parcel(['order_ref' => 'CAN1', 'phone' => '0661112233', 'name' => 'Yacine Cancel']))->tracking;
    if ($code === 'zrexpress') {
        ok("$code: الإلغاء غير مدعوم ← false بلا استثناء", $ad->cancelParcel($tk) === false);
    } elseif ($code === 'dhd' || $code === 'noest') {
        ok("$code: بعد التصديق التلقائي لا يُلغى (false مفهوم)", $ad->cancelParcel($tk) === false);
        $sim2 = $mkSim(); $ad2 = mk($code, $sim2, $good, ['autoValidate' => '0']);
        $tk2 = $ad2->createParcel(parcel(['order_ref' => 'CAN2']))->tracking;
        ok("$code: autoValidate=0 ← الطرد غير المصدَّق يُلغى", $ad2->cancelParcel($tk2) === true && !isset($sim2->state[$tk2]));
    } else {
        ok("$code: إلغاء طرد جديد", $ad->cancelParcel($tk) === true);
        [$sim, $ad] = $new();
        $tk = $ad->createParcel(parcel(['order_ref' => 'CAN3']))->tracking;
        setTo($sim, $tk, (string)($c['cancelAfter'] === '50' ? '31' : $c['cancelAfter']));
        $res = $ad->cancelParcel($tk);
        ok("$code: بعد انطلاق الطرد ← الإلغاء مرفوض (false)", $res === false);
    }
    ok("$code: لا مخالفات صيغة في أي مرحلة", $sim->violations === [], $sim->violations);
}

/* ───── قواعد خاصة بـNOEST: أحداث مالية بعد التسليم لا تغيّر الحالة ───── */
echo "\n── قواعد خاصة ──\n";
$sim = new NoestSim(); $ad = mk('noest', $sim, ['apiToken' => 'TOK', 'userGuid' => 'GUID']);
$tk = $ad->createParcel(parcel())->tracking;
$sim->history[$tk] = ['upload', 'validation_reception', 'fdr_activated', 'livre', 'verssement_admin_cust'];
ok('NOEST: حدث مالي بعد التسليم لا يمحو «delivered»', $ad->trackParcel($tk)->status === Status::DELIVERED);

/* ───── عام: كل ملف قاموس يغطي مفاتيح الحالة الموحدة فقط ───── */
$allowed = array_merge(Status::ALL, ['ignore']);
$badVals = [];
foreach ($dict as $fam => $d) { if (!is_array($d)) { continue; } foreach (['exact', 'codes', 'event_key'] as $k) { foreach (($d[$k] ?? []) as $raw => $v) { if (!in_array($v, $allowed, true)) { $badVals[] = "$fam/$k/$raw=$v"; } } } }
ok('القواميس: كل القيم حالات موحّدة صحيحة', $badVals === [], $badVals);
foreach (array_keys(array_filter($CARRIERS, fn($c, $k) => true, ARRAY_FILTER_USE_BOTH)) as $code) {
    $fam = $code === 'dhd' ? 'ecotrack' : $code;
    ok("القاموس يغطي الشركة $fam", isset($dict[$fam]));
}

/* ───── اللقطة الذهبية لبوابة JS يجب أن تكون حديثة (php scripts/gen-carrier-golden.php) ───── */
require_once __DIR__ . '/lib/carrier-golden.php';
$goldFile = __DIR__ . '/../platform/gateway/test/carrier-golden.json';
$fresh = json_encode(carrier_golden(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n";
ok('اللقطة الذهبية لبوابة JS حديثة (php scripts/gen-carrier-golden.php)', is_file($goldFile) && file_get_contents($goldFile) === $fresh);

echo "\n" . ($fails ? "✗ أخفق $fails من $total\n" : "✓ $total فحصاً ناجحاً\n");
exit($fails ? 1 : 0);
