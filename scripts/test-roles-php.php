<?php
declare(strict_types=1);
/* اختبار الأدوار والمصادقة الثنائية وسجلّ النشاط في نسخة الاستضافة (php-edition/api/index.php) بخادم PHP حقيقي — بلا شبكة خارجية.
     php scripts/test-roles-php.php */
$total = 0; $fails = 0;
function ok(string $n, bool $c, mixed $x = null): void { global $total, $fails; $total++; if (!$c) { $fails++; echo "✗ $n " . ($x === null ? '' : json_encode($x, JSON_UNESCAPED_UNICODE)) . "\n"; } }

/* ── الدوال النقية (TOTP/Base32/رموز الطوارئ) تُستخرج من المصدر نفسه وتُختبر بمتجهات RFC 6238 ── */
$src = (string)file_get_contents(__DIR__ . '/../php-edition/api/index.php');
$a = strpos($src, 'function b32enc('); $b = strpos($src, 'function ownerMfa(');
if ($a === false || $b === false) { echo "✗ تعذّر استخراج دوال TOTP\n"; exit(1); }
eval(substr($src, $a, $b - $a));
$sec = b32enc('12345678901234567890');
ok('base32: رمز RFC معروف', $sec === 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', $sec);
ok('base32: ذهاب وإياب', b32dec(b32enc("\x00\xff\x10abc")) === "\x00\xff\x10abc");
foreach ([[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037']] as [$t, $exp]) ok("TOTP RFC 6238 عند $t", totp_code($sec, intdiv($t, 30)) === $exp, totp_code($sec, intdiv($t, 30)));
ok('totp_match: نافذة ±1', totp_match($sec, '287082', 59) === 1 && totp_match($sec, '287082', 59 + 30) === 1 && totp_match($sec, '287082', 59 + 90) === null);
ok('totp_match: يرفض غير 6 أرقام', totp_match($sec, '28708', 59) === null && totp_match($sec, 'abcdef', 59) === null);
$rc = rec_codes(); ok('رموز الطوارئ: 8 فريدة بالشكل xxxxx-xxxxx', count($rc) === 8 && count(array_unique($rc)) === 8 && preg_match('/^[a-z2-7]{5}-[a-z2-7]{5}$/', $rc[0]) === 1, $rc[0]);
$acct = ['secret' => $sec, 'tstep' => 0, 'rec' => array_map('rec_hash', $rc)];
$u1 = mfa_check($acct, $rc[0]); ok('طوارئ: رمز صالح يُستهلك', $u1 !== null && count($u1['rec']) === 7);
ok('طوارئ: لا يُعاد استعماله', mfa_check($u1, $rc[0]) === null);
ok('طوارئ: يقبل بلا شرطة وبحروف كبيرة', mfa_check($acct, strtoupper(str_replace('-', '', $rc[1]))) !== null);
$cur = intdiv(time(), 30); $u2 = mfa_check($acct, totp_code($sec, $cur)); ok('mfa_check: رمز التطبيق يسجّل الخطوة', $u2 !== null && $u2['tstep'] === $cur);
ok('mfa_check: منع إعادة الاستعمال لنفس الخطوة', mfa_check($u2, totp_code($sec, $cur)) === null);

/* ── خادم PHP حقيقي ── */
$root = sys_get_temp_dir() . '/rolesrv_' . bin2hex(random_bytes(4)); mkdir("$root/api", 0777, true);
copy(__DIR__ . '/../php-edition/api/index.php', "$root/api/index.php");
file_put_contents("$root/api/config.php", "<?php return ['admin_hash' => " . var_export(password_hash('ownerpw', PASSWORD_DEFAULT), true) . ", 'max_upload_mb' => 8];");
$port = random_int(20000, 40000);
$p = proc_open(['php', '-S', "127.0.0.1:$port", '-t', $root], [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes);
usleep(700000);
$X = ['X-Requested-With: XMLHttpRequest'];
$call = function (string $path, string $m = 'GET', ?array $body = null, string $jar = '', bool $csrf = true) use ($port, $X): array {
    $ch = curl_init("http://127.0.0.1:$port/api/index.php?r=$path");
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $m, CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $csrf ? $X : []), CURLOPT_COOKIEJAR => $jar ?: '/dev/null', CURLOPT_COOKIEFILE => $jar ?: '', CURLOPT_TIMEOUT => 10]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $o = (string)curl_exec($ch); $c = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch); return [$c, json_decode($o, true) ?? $o];
};
$own = "$root/own"; $stf = "$root/stf"; $stf2 = "$root/stf2";
[$c, $j] = $call('login', 'POST', ['password' => 'wrong'], $own); ok('مالك: كلمة مرور خاطئة 401', $c === 401, $j);
[$c, $j] = $call('login', 'POST', ['password' => 'ownerpw'], $own); ok('مالك: دخول', $c === 200, $j);
[$c, $j] = $call('me', 'GET', null, $own); ok('me: مالك', $c === 200 && $j['admin'] === true && $j['role'] === 'owner' && $j['mfa'] === false, $j);

/* طلب زائر ليكون هناك ما يُدار */
[$c, $j] = $call('order', 'POST', ['order' => ['name' => 'Zayd Test', 'phone' => '0550123456', 'items' => [['title' => 'x', 'qty' => 1, 'price' => 1000]], 'total' => 1000, 'subtotal' => 1000, 'items_text' => 'x ×1 = 1000 DA']], '');
ok('زائر: طلب جديد', $c === 200 || $c === 201, $j); $oid = $j['id'] ?? ($j['order']['id'] ?? '');
if ($oid === '') { [$c, $l] = $call('orders', 'GET', null, $own); $oid = $l['orders'][0]['id'] ?? ''; }
ok('معرّف الطلب معروف', $oid !== '', $j);

/* إنشاء موظف */
[$c, $j] = $call('team', 'POST', ['action' => 'create', 'email' => 'amel', 'role' => 'agent', 'password' => 'short'], $own); ok('موظف: كلمة مرور ضعيفة 422', $c === 422, $j);
[$c, $j] = $call('team', 'POST', ['action' => 'create', 'email' => 'owner', 'role' => 'agent', 'password' => 'longenoughpw1'], $own); ok('موظف: اسم محجوز 422', $c === 422, $j);
[$c, $j] = $call('team', 'POST', ['action' => 'create', 'email' => 'amel', 'name' => 'Amel', 'role' => 'agent', 'password' => 'agentpass-123'], $own); ok('موظف: إنشاء', $c === 200, $j);
[$c, $j] = $call('team', 'POST', ['action' => 'create', 'email' => 'amel', 'role' => 'agent', 'password' => 'agentpass-123'], $own); ok('موظف: تكرار 409', $c === 409, $j);
[$c, $j] = $call('team', 'POST', ['action' => 'list'], $own); ok('فريق: القائمة', $c === 200 && count($j['staff']) === 1 && in_array('orders.write', $j['staff'][0]['perms'], true) && !in_array('finance', $j['staff'][0]['perms'], true), $j);

/* دخول الموظف */
[$c] = $call('login', 'POST', ['user' => 'amel', 'password' => 'bad'], $stf); ok('موظف: كلمة مرور خاطئة 401', $c === 401);
[$c] = $call('login', 'POST', ['user' => 'ghost', 'password' => 'agentpass-123'], $stf); ok('موظف: مستخدم مجهول 401', $c === 401);
[$c, $j] = $call('login', 'POST', ['user' => 'amel', 'password' => 'agentpass-123'], $stf); ok('موظف: دخول', $c === 200, $j);
[$c, $j] = $call('me', 'GET', null, $stf); ok('me: موظف', $j['admin'] === false && $j['role'] === 'agent' && in_array('callcenter', $j['perms'], true), $j);
[$c, $j] = $call('orders', 'GET', null, $stf); ok('موظف: يقرأ الطلبات', $c === 200 && count($j['orders']) >= 1, $c);
[$c] = $call('order_update', 'POST', ['id' => $oid, 'status' => 'confirmee'], $stf); ok('موظف: يؤكد الطلب', $c === 200);
[$c] = $call('order_update', 'POST', ['id' => $oid, 'note' => '📞1'], $stf); ok('موظف: يسجّل مكالمة', $c === 200);
[$c] = $call('order_update', 'POST', ['id' => $oid, 'name' => 'Hacker'], $stf); ok('موظف بلا orders.edit: تعديل الاسم 403', $c === 403);
[$c] = $call('order_update', 'POST', ['id' => $oid, 'total' => 1], $stf); ok('موظف بلا orders.edit: تعديل المبلغ 403', $c === 403);
[$c] = $call('order_delete', 'POST', ['id' => $oid], $stf); ok('موظف بلا orders.delete: الحذف 403', $c === 403);
[$c] = $call('order', 'POST', ['order' => ['manual' => true, 'name' => 'Man Ual', 'phone' => '0550999999', 'items' => [['title' => 'x', 'qty' => 1, 'price' => 1]], 'total' => 1]], $stf);
ok('موظف بلا orders.create: طلب يدوي لا يتجاوز حمايات الزوار (يُعامل زائراً)', $c === 200 || $c === 422 || $c === 429);
foreach (['kv&k=costs', 'file&path=index.html', 'update_check', 'questions', 'presence', 'analytics'] as $rt) { [$c] = $call($rt, 'GET', null, $stf); ok("موظف: $rt ممنوع", $c === 401 || $c === 403, [$rt, $c]); }
[$c] = $call('courier', 'POST', ['url' => 'https://example.com'], $stf); ok('موظف: وسيط الشركات ممنوع', $c === 401 || $c === 403);
[$c] = $call('team', 'POST', ['action' => 'list'], $stf); ok('موظف: إدارة الفريق 403', $c === 403);
[$c] = $call('team', 'POST', ['action' => 'create', 'email' => 'evil', 'role' => 'manager', 'password' => 'longenoughpw1'], $stf); ok('موظف: لا يُنشئ موظفين', $c === 403);
[$c, $j] = $call('team', 'POST', ['action' => 'stats', 'days' => 7], $stf); ok('موظف: إحصاؤه فقط', $c === 200 && count($j['rows']) >= 2 && !array_filter($j['rows'], fn($r) => $r['actor'] !== 'amel'), $j);
[$c, $j] = $call('team', 'POST', ['action' => 'audit'], $stf); ok('موظف: لا يقرأ السجلّ كاملاً', $c === 403);

/* المالك يرى النشاط */
[$c, $j] = $call('team', 'POST', ['action' => 'audit'], $own);
$acts = array_map(fn($r) => $r['action'] . ':' . ($r['detail']['to'] ?? ''), $j['rows'] ?? []);
ok('سجلّ: تغيير الحالة بالفاعل', $c === 200 && in_array('order.status:confirmee', $acts, true) && in_array('order.call:📞1', $acts, true) && in_array('login:', $acts, true), $acts);
ok('سجلّ: محاولة التعديل الممنوعة لم تُنفَّذ ولم تُسجَّل', !in_array('order.edit:', $acts, true));
[$c, $j] = $call('orders', 'GET', null, $own); $o1 = array_values(array_filter($j['orders'], fn($o) => $o['id'] === $oid))[0] ?? [];
ok('الطلب: الحالة والاسم كما يجب', ($o1['status'] ?? '') === 'confirmee' && ($o1['name'] ?? '') === 'Zayd Test', $o1);
[$c, $j] = $call('team', 'POST', ['action' => 'stats', 'days' => 7], $own);
$ag = array_values(array_filter($j['rows'], fn($r) => $r['actor'] === 'amel' && $r['action'] === 'order.status'))[0] ?? [];
$cl = array_values(array_filter($j['rows'], fn($r) => $r['actor'] === 'amel' && $r['action'] === 'order.call'));
ok('إحصاء المالك: نتيجة الاتصال تحمل وسومها (to_status) لتفصيل غير متاح/لاحقاً/غداً', count($cl) >= 1 && ($cl[0]['to_status'] ?? '') !== '' && str_contains($cl[0]['to_status'], '📞'), $cl);
ok('إحصاء المالك: تأكيد واحد للموظف', ($ag['n'] ?? 0) === 1 && ($ag['to_status'] ?? '') === 'confirmee', $j);

/* منح صلاحية التعديل ثم الإيقاف */
[$c] = $call('team', 'POST', ['action' => 'update', 'email' => 'amel', 'role' => 'support'], $own); ok('تعديل الدور', $c === 200);
[$c] = $call('order_update', 'POST', ['id' => $oid, 'name' => 'Zayd Edited'], $stf); ok('بعد منح التعديل: الاسم 200 فوراً (الصلاحيات تُقرأ كل طلب)', $c === 200);
[$c] = $call('team', 'POST', ['action' => 'update', 'email' => 'amel', 'active' => false], $own); ok('إيقاف الموظف', $c === 200);
[$c] = $call('orders', 'GET', null, $stf); ok('الموظف الموقوف: جلسته القائمة تتوقف فوراً', $c === 401);
[$c] = $call('login', 'POST', ['user' => 'amel', 'password' => 'agentpass-123'], $stf2); ok('الموقوف لا يدخل', $c === 401);
[$c] = $call('team', 'POST', ['action' => 'update', 'email' => 'amel', 'active' => true], $own);


/* المحاسب: قراءة المالية فقط */
[$c] = $call('team', 'POST', ['action' => 'create', 'email' => 'acct', 'name' => 'Acc', 'role' => 'accountant', 'password' => 'acctpass-12345'], $own); ok('محاسب: إنشاء', $c === 200);
$acj = "$root/acj";
[$c] = $call('login', 'POST', ['user' => 'acct', 'password' => 'acctpass-12345'], $acj); ok('محاسب: دخول', $c === 200);
[$c] = $call('kv', 'POST', ['k' => 'costs', 'v' => ['p1' => 500]], $own); ok('مالك: يكتب مفتاح مالية', $c === 200);
[$c, $j] = $call('kv&k=costs', 'GET', null, $acj); ok('محاسب: يقرأ مفتاح المالية', $c === 200 && ($j['v']['p1'] ?? 0) === 500, $j);
[$c] = $call('kv&k=guard_secret', 'GET', null, $acj); ok('محاسب: لا يقرأ مفاتيح غير مالية', $c === 403);
[$c] = $call('kv', 'POST', ['k' => 'costs', 'v' => ['p1' => 1]], $acj); ok('محاسب: لا يكتب في المالية', $c === 403);
[$c, $j] = $call('kv&k=costs', 'GET', null, $own); ok('القيمة لم تتغيّر', ($j['v']['p1'] ?? 0) === 500);
[$c] = $call('file&path=' . rawurlencode('assets/data/payments.json'), 'GET', null, $acj); ok('محاسب: ملف المدفوعات (404 إن لم يوجد لا 403)', $c === 200 || $c === 404, $c);
[$c] = $call('file&path=' . rawurlencode('assets/js/data.js'), 'GET', null, $acj); ok('محاسب: لا يقرأ ملفاً آخر', $c === 403);
[$c] = $call('file&path=' . rawurlencode('assets/data/customers.json'), 'GET', null, $acj); ok('محاسب: ملاحظات العملاء (بصلاحية العملاء)', $c === 200 || $c === 404, $c);
[$c] = $call('file', 'PUT', ['path' => 'assets/data/payments.json', 'content' => base64_encode('{}')], $acj); ok('محاسب: لا يكتب ملفاً', $c === 403);
[$c] = $call('orders', 'GET', null, $acj); ok('محاسب: يقرأ الطلبات', $c === 200);
[$c] = $call('order_update', 'POST', ['id' => $oid, 'status' => 'livree'], $acj); ok('محاسب: لا يغيّر حالة طلب', $c === 403);
[$c] = $call('kv&k=costs', 'GET', null, $stf); ok('موظف اتصال: لا يقرأ المالية', $c === 401 || $c === 403);

/* المصادقة الثنائية للمالك */
[$c, $j] = $call('mfa', 'POST', ['action' => 'setup'], $own); $secret = $j['secret'] ?? ''; ok('2FA: إعداد يعطي مفتاحاً وuri', $c === 200 && strlen($secret) === 32 && str_starts_with($j['uri'], 'otpauth://totp/'), $j);
[$c] = $call('mfa', 'POST', ['action' => 'enable', 'code' => '000000'], $own); ok('2FA: رمز خاطئ يُرفض', $c === 422);
$c0 = intdiv(time(), 30);
[$c, $j] = $call('mfa', 'POST', ['action' => 'enable', 'code' => totp_code($secret, $c0)], $own); $rec = $j['recovery'] ?? []; ok('2FA: تفعيل + 8 رموز طوارئ', $c === 200 && count($rec) === 8, $j);
[$c, $j] = $call('mfa', 'POST', ['action' => 'status'], $own); ok('2FA: الحالة مفعّلة', $j['enabled'] === true && $j['recovery_left'] === 8, $j);
$call('logout', 'POST', [], $own);
[$c, $j] = $call('login', 'POST', ['password' => 'ownerpw'], $own); ok('دخول بلا رمز: otp_required', $c === 401 && ($j['error'] ?? '') === 'otp_required', $j);
[$c, $j] = $call('me', 'GET', null, $own); ok('لا جلسة بعد كلمة المرور وحدها', ($j['admin'] ?? true) === false, $j);
[$c, $j] = $call('login', 'POST', ['password' => 'ownerpw', 'code' => '123456'], $own); ok('رمز خاطئ يُرفض', $c === 401 && ($j['error'] ?? '') === 'otp_required');
[$c, $j] = $call('login', 'POST', ['password' => 'ownerpw', 'code' => totp_code($secret, $c0)], $own); ok('نفس خطوة التفعيل = إعادة استعمال مرفوضة', $c === 401, $j);
$nx = totp_code($secret, $c0 + 1);
[$c, $j] = $call('login', 'POST', ['password' => 'ownerpw', 'code' => $nx], $own); ok('الخطوة التالية مقبولة (نافذة ±1)', $c === 200, $j);
$call('logout', 'POST', [], $own);
[$c] = $call('login', 'POST', ['password' => 'ownerpw', 'code' => $nx], $own); ok('إعادة استعمال الرمز نفسه مرفوضة', $c === 401);
[$c] = $call('login', 'POST', ['password' => 'ownerpw', 'code' => $rec[0]], $own); ok('رمز طوارئ يدخل', $c === 200);
$call('logout', 'POST', [], $own);
[$c] = $call('login', 'POST', ['password' => 'ownerpw', 'code' => $rec[0]], $own); ok('رمز الطوارئ مرة واحدة', $c === 401);
[$c] = $call('login', 'POST', ['password' => 'ownerpw', 'code' => $rec[1]], $own); ok('رمز طوارئ آخر يدخل', $c === 200);
[$c, $j] = $call('mfa', 'POST', ['action' => 'status'], $own); ok('المتبقي 6 رموز', $j['recovery_left'] === 6, $j);
[$c] = $call('mfa', 'POST', ['action' => 'disable', 'code' => '111111'], $own); ok('إيقاف 2FA برمز خاطئ مرفوض', $c === 422);
[$c] = $call('mfa', 'POST', ['action' => 'disable', 'code' => $rec[2]], $own); ok('إيقاف 2FA برمز طوارئ', $c === 200);
$call('logout', 'POST', [], $own);
[$c] = $call('login', 'POST', ['password' => 'ownerpw'], $own); ok('بعد الإيقاف: دخول بكلمة المرور', $c === 200);

/* المصادقة الثنائية لموظف + إعادة ضبط المالك */
[$c] = $call('login', 'POST', ['user' => 'amel', 'password' => 'agentpass-123'], $stf2); ok('الموظف المفعَّل يدخل', $c === 200);
[$c, $j] = $call('mfa', 'POST', ['action' => 'setup'], $stf2); $s2 = $j['secret'] ?? '';
[$c, $j] = $call('mfa', 'POST', ['action' => 'enable', 'code' => totp_code($s2, intdiv(time(), 30))], $stf2); ok('موظف: تفعيل 2FA', $c === 200 && count($j['recovery'] ?? []) === 8, $j);
$call('logout', 'POST', [], $stf2);
[$c, $j] = $call('login', 'POST', ['user' => 'amel', 'password' => 'agentpass-123'], $stf2); ok('موظف: يطلب الرمز', $c === 401 && $j['error'] === 'otp_required');
[$c, $j] = $call('team', 'POST', ['action' => 'list'], $own); ok('المالك يرى حالة 2FA للموظف', ($j['staff'][0]['mfa'] ?? false) === true, $j);
[$c] = $call('team', 'POST', ['action' => 'reset_mfa', 'email' => 'amel'], $own); ok('المالك يعيد ضبط 2FA', $c === 200);
[$c] = $call('login', 'POST', ['user' => 'amel', 'password' => 'agentpass-123'], $stf2); ok('بعد إعادة الضبط: دخول بكلمة المرور', $c === 200);
[$c] = $call('team', 'POST', ['action' => 'password', 'email' => 'amel', 'password' => 'new-agent-pass-9'], $own); ok('تغيير كلمة مرور الموظف', $c === 200);
[$c] = $call('login', 'POST', ['user' => 'amel', 'password' => 'agentpass-123'], "$root/s3"); ok('كلمة المرور القديمة لا تعمل', $c === 401);
[$c] = $call('team', 'POST', ['action' => 'delete', 'email' => 'amel'], $own); ok('حذف الموظف', $c === 200);
[$c] = $call('orders', 'GET', null, $stf2); ok('بعد الحذف: جلسته ميتة', $c === 401);
[$c] = $call('team', 'POST', ['action' => 'list'], $own, false); ok('CSRF: team بلا ترويسة مرفوض', $c === 403);
proc_terminate($p);
exec('rm -rf ' . escapeshellarg($root));
echo $fails ? "\n✗ $fails من $total فشل\n" : "✓ $total فحصاً ناجحاً\n"; exit($fails ? 1 : 0);
