<?php
declare(strict_types=1);
/* معايرة حساب شركة توصيل حقيقي بقراءة فقط (لا يُنشأ ولا يُعدَّل أي طرد) وطباعة تقرير بما التُقط وما يلزم تصحيحه.
   المفاتيح من البيئة فقط ولا تُطبع ولا تُحفظ:
     YD_ID=… YD_TOKEN=… php scripts/calibrate-live.php                    (ياليدين)
     CAL_CARRIER=dhd CAL_CRED='{"token":"…"}' php scripts/calibrate-live.php   (أي شركة أخرى)
   اختياري: CAL_SAVE=/مسار/خارج/المستودع/profile.json لحفظ الملف الكامل (يحوي بلديات الشركة لا مفاتيحك).
   الزمن: ≈ 2–4 دقائق (احتراماً لحدود المعدّل). */
require __DIR__ . '/../php-edition/shipping/src/autoload.php';

use Alyssum\Shipping\{Calibrator, OurGeo, ShippingFactory};

$code = getenv('CAL_CARRIER') ?: 'yalidine';
$cred = getenv('CAL_CRED') ? (array)json_decode((string)getenv('CAL_CRED'), true) : (getenv('YD_ID') ? ['apiId' => (string)getenv('YD_ID'), 'apiToken' => (string)getenv('YD_TOKEN')] : []);
if (!$cred) { fwrite(STDERR, "ضع المفاتيح في YD_ID/YD_TOKEN أو CAL_CRED (JSON).\n"); exit(2); }

$ad = ShippingFactory::make($code)->authenticate($cred);
$ad->pause = static function (int $ms): void { usleep($ms * 1000); };
$geo = OurGeo::load();
$cal = new Calibrator($geo, 4);
$t0 = microtime(true);
$p = $cal->start($ad);
echo "ping: ", json_encode($p['ping'], JSON_UNESCAPED_UNICODE), "\n";
$last = '';
for ($i = 0; $i < 400 && !$p['done']; $i++) {
    $p = $cal->step($ad, $p);
    $line = $p['phase'] . ' — متبقٍ ' . count($p['pending']) . ' ولاية';
    if ($line !== $last && $i % 3 === 0) { echo "  $line\n"; $last = $line; }
}
$s = Calibrator::summary($p);
printf("\n══ تقرير المعايرة (%s) — %.0f ثانية ══\n", $code, microtime(true) - $t0);
echo "المفاتيح: ", ($s['ping']['ok'] ?? null) === true ? 'صالحة' : (($s['ping']['ok'] ?? null) === false ? 'مرفوضة — ' . $s['ping']['message'] : 'غير محسومة — ' . ($s['ping']['message'] ?? '')), "\n";
$c = $s['communes'];
echo "البلديات: قُرئت ولايات {$c['wilayas']} | تصحيح تهجئة {$c['mapped']} (منها مقاربة {$c['fuzzy']}) | عندنا وليست عندهم {$c['unmatched']} | لا توصّل إليها {$c['undeliverable']} | عندهم وليست عندنا {$c['carrierOnly']}\n";
$shown = 0;
foreach ($p['communes'] as $w => $x) {
    foreach ($x['unmatched'] as $u) { if ($shown++ < 40) { echo "  ✗ غير موجودة عند الشركة: ولاية $w — $u\n"; } }
    foreach ($x['fuzzy'] as [$o, $t, $sc]) { if ($shown++ < 40) { echo "  ≈ مقاربة ($sc): ولاية $w — $o ← $t\n"; } }
}
echo "مكاتب Stop Desk: {$s['desks']} | تعريفة ولايات: {$s['fees']}\n";
echo "حالات طرودك الحالية: {$s['statuses']['seen']} نوعاً، المجهول منها {$s['statuses']['unknown']}\n";
foreach ($p['statuses'] as $raw => $x) { echo sprintf("  %-34s → %-16s [%s] ×%d\n", $raw, $x['u'], $x['src'], $x['n']); }
echo "تحقّق التتبع: ", json_encode($s['verify'], JSON_UNESCAPED_UNICODE), "\n";
foreach ($s['warnings'] as $w) { echo "⚠ $w\n"; }
foreach ($s['notes'] as $n) { echo "ℹ $n\n"; }
if (($f = getenv('CAL_SAVE')) !== false && $f !== '') { file_put_contents($f, json_encode($p, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)); @chmod($f, 0600); echo "حُفظ الملف الكامل في $f\n"; }
