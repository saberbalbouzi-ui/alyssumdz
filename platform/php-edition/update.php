<?php
/* تطبيق تحديث الكود (مرة واحدة): يُرفع ملف التحديث فوق الموقع ثم تُفتح هذه الصفحة وأنت مسجّل دخول المدير.
   لا يمسّ بيانات الزبون: كلمة المرور، الطلبات، المنتجات، الصور، الإعدادات. */
declare(strict_types=1);
const DEFAULT_NAME = '__DEFAULT_NAME__';
const DEFAULT_WA = '__DEFAULT_WA__';

$root = __DIR__;
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
session_name('store_admin');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict']);
session_start();
function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
function page(string $body): never { echo '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>تحديث الموقع</title><style>body{font-family:Tahoma,Arial,sans-serif;background:#f6f3ec;padding:1.2rem}.c{max-width:520px;margin:2rem auto;background:#fff;border-radius:16px;padding:1.6rem;box-shadow:0 8px 30px rgba(0,0,0,.08)}.e{background:#fde8e8;color:#9b2c2c;padding:.8rem;border-radius:10px}.ok{background:#e6f4ea;color:#1e6b3a;padding:1rem;border-radius:10px}</style></head><body><div class="c">' . $body . '</div></body></html>'; exit; }

if (!is_file("$root/api/config.php")) page('<div class="e">الموقع غير مثبَّت بعد. استعمل install.php.</div>');
if (empty($_SESSION['admin'])) { http_response_code(401); page('<div class="e">سجّل الدخول أولاً من <a href="admin.html">لوحة التحكم</a> ثم أعد فتح هذه الصفحة.</div>'); }

/* اسم المتجر ورقم واتساب الحاليان من إعدادات الزبون */
$cfg = (string)@file_get_contents("$root/assets/js/config.js");
$name = preg_match('/name:\s*("(?:[^"\\\\]|\\\\.)*")/u', $cfg, $m) ? json_decode($m[1]) : null;
$wa = preg_match('/waNumber:\s*"(\d{6,15})"/', $cfg, $m2) ? $m2[1] : null;
if (!$name || !$wa || !preg_match('/^[\p{L}\p{N} .&-]+$/u', (string)$name)) page('<div class="e">تعذّر قراءة اسم المتجر من config.js — لم يُغيَّر شيء.</div>');

/* الملفات التي حُدِّثت: يعاد فيها اسم المتجر ورقم واتساب الحقيقيين مكان القيم الافتراضية */
$files = array_merge(["$root/admin.html", "$root/p/_template/index.html"], glob("$root/assets/js/*.js") ?: []);
$n = 0;
foreach ($files as $f) {
    if (!is_file($f) || basename($f) === 'config.js' || basename($f) === 'data.js' || basename($f) === 'wilayas.js') continue;
    $t = (string)file_get_contents($f); $r = str_replace([DEFAULT_NAME, DEFAULT_WA], [$name, $wa], $t);
    if ($r !== $t) { file_put_contents($f, $r, LOCK_EX); $n++; }
}
$v = json_decode((string)@file_get_contents("$root/version.json"), true)['version'] ?? '?';
@unlink(__FILE__);
page('<div class="ok">✅ تم تحديث الموقع إلى الإصدار <b>' . h((string)$v) . '</b> (' . $n . ' ملفاً). حُذفت هذه الصفحة تلقائياً.<br><br><a href="admin.html">العودة إلى لوحة التحكم ←</a></div>');
