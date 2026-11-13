<?php /* بذر طلبات اصطناعية بالجملة في قاعدة المتجر المؤقتة (اختبارات فقط): php seed_orders.php <db> <N> [offsetStartId] — توزيع حالات/أيام/منتجات ثابت، وتكرار ثواني عمداً لاختبار ترتيب التعادل */
$d = new PDO('sqlite:' . $argv[1]); $d->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION); $d->exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL');
$n = (int)$argv[2]; $off = (int)($argv[3] ?? 0); $now = time(); $W = ['الجزائر', 'وهران', 'قسنطينة', 'عنابة', 'سطيف', 'باتنة']; $P = [['miel-sidr', 'عسل السدر الجبلي 500غ', 3200], ['tarkiz', 'قطرات التركيز', 1800], ['huile-a-barbe', 'زيت اللحية الفاخر', 2100], ['pack4', 'باقة العناية الأربعة', 5200]];
$S = ['nouvelle', 'nouvelle', 'nouvelle', 'confirmee', 'confirmee', 'expediee', 'livree', 'livree', 'annulee', 'echec'];
$st = $d->prepare('INSERT INTO orders (id, created_at, name, phone, wilaya, commune, dtype, desk, items_text, items, subtotal, fee, total, coupon, discount, extra, status, note, ip_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
$d->exec('BEGIN');
for ($i = 0; $i < $n; $i++) { $k = $off + $i; $p = $P[$k % 4]; $q = 1 + ($k % 3); $line = $p[1] . " ×$q = " . ($p[2] * $q) . ' DA'; $sub = $p[2] * $q; $tot = $sub + 400;
    $t = $now - 86400 * 120 + intdiv($k * (86400 * 120), max(1, $off + $n)) - ($k % 7 === 0 ? 0 : 0); $t -= $t % 3;      // تعادلات ثوانٍ كثيرة (مضاعفات 3 ثوانٍ)
    $st->execute([sprintf('S%s-%08X', gmdate('ymd', $t), $k + 1), $t, 'زبون اختبار ' . ($k + 1), '0550' . substr((string)(100000 + $k), -6), $W[$k % 6], 'مركز', 'home', '', $line, json_encode([['slug' => $p[0], 'title' => $p[1], 'qty' => $q, 'price' => $p[2]]], JSON_UNESCAPED_UNICODE), $sub, 400, $tot, '', 0, '{}', $S[$k % 10], '', 'x']); }
$d->exec('COMMIT'); echo json_encode(['ok' => true, 'n' => $n]), "\n";
