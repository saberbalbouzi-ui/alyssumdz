<?php /* مساعد اختبار: يشغّل SQL على قاعدة المتجر المؤقتة ويطبع صفوف JSON (قراءة/كتابة اختبارية على قاعدة معزولة فقط) */
$d = new PDO('sqlite:' . $argv[1]); $d->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION); $d->exec('PRAGMA busy_timeout=5000');
$q = $argv[2]; if (preg_match('/^\s*select/i', $q)) { foreach ($d->query($q) as $r) echo json_encode($r, JSON_UNESCAPED_UNICODE), "\n"; } else { $d->exec($q); echo json_encode(['ok' => true]), "\n"; }
