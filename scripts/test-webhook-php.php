<?php
declare(strict_types=1);
/* اختبار webhook ياليدين في نسخة الاستضافة بخادم PHP حقيقي: الحالة + وسم مرحلة رجوع الطرد 🔁 (يقرؤه المخزون في اللوحة)
     php scripts/test-webhook-php.php */
$total = 0; $fails = 0;
function ok(string $n, bool $c, mixed $x = null): void { global $total, $fails; $total++; if (!$c) { $fails++; echo "✗ $n " . ($x === null ? '' : json_encode($x, JSON_UNESCAPED_UNICODE)) . "\n"; } }
$src = (string)file_get_contents(__DIR__ . '/../platform/php-edition/api/index.php');
$a = strpos($src, 'function ydRetPhase('); $b = strpos($src, '/* ── حماية الطلبات');
eval(substr($src, $a, $b - $a));
ok('مراحل: retour vers centre = transit', ydRetPhase('Retour vers centre') === 'transit' && ydRetPhase('Retourné au centre') === 'transit' && ydRetPhase('Echec livraison') === 'transit');
ok('مراحل: Retour à retirer = ready', ydRetPhase('Retour à retirer') === 'ready');
ok('مراحل: Retourné au vendeur = received', ydRetPhase('Retourné au vendeur') === 'received' && ydRetPhase('RETOURNÉ AU VENDEUR') === 'received');
ok('مراحل: Livré/فارغ = لا شيء', ydRetPhase('Livré') === '' && ydRetPhase('') === '' && ydRetPhase('En livraison') === '');
ok('وسم: يضيف ولا يتراجع', ydNoteWithPhase('x', 'transit') === 'x 🔁transit' && ydNoteWithPhase('x 🔁ready', 'transit') === null && ydNoteWithPhase('x 🔁transit', 'received') === 'x 🔁received' && ydNoteWithPhase('x', '') === null);

$root = sys_get_temp_dir() . '/whsrv_' . bin2hex(random_bytes(4)); mkdir("$root/api", 0777, true);
copy(__DIR__ . '/../platform/php-edition/api/index.php', "$root/api/index.php");
file_put_contents("$root/api/config.php", "<?php return ['admin_hash' => " . var_export(password_hash('pw', PASSWORD_DEFAULT), true) . ", 'max_upload_mb' => 8];");
$port = random_int(20000, 40000);
$p = proc_open(['php', '-S', "127.0.0.1:$port", '-t', $root], [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes); usleep(700000);
$hit = function (string $q, ?string $body = null) use ($port): array { $ch = curl_init("http://127.0.0.1:$port/api/index.php?$q"); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]); if ($body !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, $body); curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']); } $o = (string)curl_exec($ch); $c = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch); return [$c, json_decode($o, true) ?? $o]; };
$hit('r=webhook&s=x', '{}'); // ينشئ القاعدة
$db = new PDO('sqlite:' . glob("$root/api/_data/store.db")[0]); $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->prepare("INSERT INTO admin_kv (k,v,updated) VALUES ('webhook_secret', ?, 0)")->execute([json_encode('SEC123')]);
$ins = $db->prepare("INSERT INTO orders (id,created_at,name,phone,total,status,note) VALUES (?,?,?,?,?,?,?)");
$ins->execute(['O1', time(), 'a', '0550000001', 1000, 'expediee', '📦 🚚yalidine:yal-AAAA11']);
$ins->execute(['O2', time(), 'b', '0550000002', 1000, 'echec', '📦@w1 🚚yalidine:yal-BBBB22 🔁transit']);
$ins->execute(['O4', time(), 'd', '0550000004', 1000, 'expediee', '🚚yalidine:yal-DDDD44']);
$ins->execute(['O3', time(), 'c', '0550000003', 1000, 'livree', '🚚yalidine:yal-CCCC33']);
$ev = fn(string $trk, string $st) => json_encode(['type' => 'parcel_status_updated', 'data' => [['tracking' => $trk, 'last_status' => $st]]]);
$row = fn(string $id) => $db->query("SELECT status, note FROM orders WHERE id='$id'")->fetch(PDO::FETCH_ASSOC);
[$c] = $hit('r=webhook', $ev('yal-AAAA11', 'Retour vers centre')); ok('بلا سرّ 401', $c === 401);
[$c, $j] = $hit('r=webhook&s=SEC123', $ev('yal-AAAA11', 'Retour vers centre'));
ok('الطرد يرجع: الحالة echec + 🔁transit', $c === 200 && $row('O1')['status'] === 'echec' && $row('O1')['note'] === '📦 🚚yalidine:yal-AAAA11 🔁transit', [$j, $row('O1')]);
$hit('r=webhook&s=SEC123', $ev('yal-AAAA11', 'Retour à retirer')); ok('ready يرتقي', str_ends_with($row('O1')['note'], '🔁ready') && substr_count($row('O1')['note'], '🔁') === 1, $row('O1'));
$hit('r=webhook&s=SEC123', $ev('yal-AAAA11', 'Retour vers wilaya')); ok('لا تراجع من ready إلى transit', str_ends_with($row('O1')['note'], '🔁ready'), $row('O1'));
[$c, $j] = $hit('r=webhook&s=SEC123', $ev('yal-BBBB22', 'Retourné au vendeur'));
ok('echec أصلاً: الحالة لا تتغير والمرحلة received + وسم المستودع باقٍ', $row('O2')['status'] === 'echec' && str_ends_with($row('O2')['note'], '🔁received') && str_contains($row('O2')['note'], '📦@w1') && ($j['updated'] ?? 0) === 1, [$j, $row('O2')]);
$hit('r=webhook&s=SEC123', $ev('yal-CCCC33', 'Retourné au vendeur')); ok('المسلَّم نهائي: لا وسم ولا حالة', $row('O3')['status'] === 'livree' && !str_contains($row('O3')['note'], '🔁'), $row('O3'));
[$c, $j] = $hit('r=webhook&s=SEC123', $ev('yal-DDDD44', 'En livraison')); ok('حالة لا تخصّ الإرجاع لا تمسّ الملاحظة', ($j['updated'] ?? 1) === 0 && $row('O4')['note'] === '🚚yalidine:yal-DDDD44', [$j, $row('O4')]);
proc_terminate($p); exec('rm -rf ' . escapeshellarg($root));
echo $fails ? "✗ فشل $fails من $total\n" : "✓ $total فحصاً ناجحاً\n"; exit($fails ? 1 : 0);
