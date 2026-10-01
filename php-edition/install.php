<?php
/* مثبّت الموقع (مرة واحدة): يحدد كلمة مرور المدير ويكتب الإعدادات ثم يحذف نفسه.
   رمز التثبيت يسلّمه البائع للمشتري حتى لا يستطيع غيره تثبيت الموقع قبله. */
declare(strict_types=1);
const INSTALL_CODE_HASH = '__INSTALL_CODE_HASH__';
const DEFAULT_NAME = '__DEFAULT_NAME__';
const DEFAULT_WA = '__DEFAULT_WA__';

$root = __DIR__;
$cfgFile = "$root/api/config.php";
$msg = ''; $done = false;
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

if (is_file($cfgFile)) { http_response_code(403); exit('<meta charset="utf-8"><body dir="rtl" style="font-family:sans-serif;padding:2rem">الموقع مثبَّت بالفعل. احذف الملف install.php من الاستضافة.</body>'); }
if (INSTALL_CODE_HASH === '__INSTALL_' . 'CODE_HASH__') { http_response_code(500); exit('هذا الملف غير مهيّأ (لم يُولَّد برمز تثبيت).'); }

$need = [];
foreach (['pdo_sqlite', 'fileinfo', 'mbstring'] as $e) if (!extension_loaded($e)) $need[] = $e;
if (PHP_VERSION_ID < 80100) $need[] = 'PHP 8.1+';
if (!is_writable("$root/api") || !is_writable("$root/assets/js")) $need[] = 'صلاحية الكتابة على المجلدات';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$need) {
    $code = (string)($_POST['code'] ?? ''); $pw = (string)($_POST['pw'] ?? ''); $pw2 = (string)($_POST['pw2'] ?? '');
    $name = trim((string)($_POST['name'] ?? '')); $wa = preg_replace('/\D+/', '', (string)($_POST['wa'] ?? ''));
    $domain = strtolower(trim((string)($_POST['domain'] ?? ''))); $domain = preg_replace('#^https?://|/.*$#', '', $domain);
    usleep(500000);
    if (!password_verify($code, INSTALL_CODE_HASH)) $msg = 'رمز التثبيت غير صحيح.';
    elseif (mb_strlen($pw) < 10) $msg = 'كلمة المرور قصيرة: 10 أحرف على الأقل.';
    elseif ($pw !== $pw2) $msg = 'كلمتا المرور غير متطابقتين.';
    elseif ($name === '' || mb_strlen($name) > 60 || !preg_match('/^[\\p{L}\\p{N} .&-]+$/u', $name)) $msg = 'اسم المتجر: حروف وأرقام ومسافات فقط (60 حرفاً كحد أقصى).';
    elseif (strlen($wa) < 8 || strlen($wa) > 15) $msg = 'رقم واتساب غير صالح (بالصيغة الدولية، أرقام فقط).';
    elseif ($domain !== '' && !preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/', $domain)) $msg = 'النطاق غير صالح.';
    else {
        /* 1) استبدال نصوص القالب الافتراضية (الاسم آمن: حروف وأرقام ومسافات فقط، فلا يكسر HTML أو JS) */
        $files = array_merge(["$root/index.html", "$root/admin.html"], glob("$root/p/*/index.html") ?: [], glob("$root/assets/js/*.js") ?: []);
        foreach (array_unique($files) as $f) {
            if (!is_file($f) || basename($f) === 'config.js') continue;
            $t = (string)file_get_contents($f); $n = str_replace([DEFAULT_NAME, DEFAULT_WA], [$name, $wa], $t);
            if ($n !== $t) file_put_contents($f, $n, LOCK_EX);
        }
        $cf = "$root/assets/js/config.js"; $t = (string)file_get_contents($cf);
        $n = str_replace(['name: ' . json_encode(DEFAULT_NAME, JSON_UNESCAPED_UNICODE), 'waNumber: ' . json_encode(DEFAULT_WA)], ['name: ' . json_encode($name, JSON_UNESCAPED_UNICODE), 'waNumber: ' . json_encode($wa)], $t);
        if ($domain !== '') $n = str_replace('domain: "example.com"', 'domain: ' . json_encode($domain), $n);
        file_put_contents($cf, $n, LOCK_EX);
        /* 2) حماية المجلدات */
        @mkdir("$root/assets/img", 0755, true);
        file_put_contents("$root/assets/img/.htaccess", "<FilesMatch \"\\.(php|phtml|phar|php[0-9])$\">\n  Require all denied\n</FilesMatch>\nOptions -Indexes\n");
        file_put_contents("$root/.htaccess", "Options -Indexes\n<FilesMatch \"^(install\\.php\\.bak)$\">\n  Require all denied\n</FilesMatch>\n");
        /* 3) كلمة مرور المدير — يُكتب أخيراً: وجوده يعني اكتمال التثبيت */
        $cfg = "<?php\nreturn " . var_export(['admin_hash' => password_hash($pw, PASSWORD_DEFAULT), 'max_upload_mb' => 8], true) . ";\n";
        file_put_contents($cfgFile, $cfg, LOCK_EX); @chmod($cfgFile, 0640);
        $done = true;
        @unlink(__FILE__);
    }
}
?><!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>تثبيت الموقع</title>
<style>body{font-family:Tahoma,Arial,sans-serif;background:#f6f3ec;color:#1c2420;margin:0;padding:1.2rem}.c{max-width:520px;margin:2rem auto;background:#fff;border-radius:16px;padding:1.6rem;box-shadow:0 8px 30px rgba(0,0,0,.08)}h1{margin-top:0;color:#173f35;font-size:1.3rem}label{display:block;margin:.9rem 0 .3rem;font-weight:700;font-size:.9rem}input{width:100%;box-sizing:border-box;padding:.7rem;border:1.5px solid #ddd5c4;border-radius:10px;font-size:1rem}button{margin-top:1.2rem;width:100%;padding:.85rem;border:0;border-radius:10px;background:#173f35;color:#fff;font-size:1rem;font-weight:700;cursor:pointer}.e{background:#fde8e8;color:#9b2c2c;padding:.7rem;border-radius:10px;margin-top:1rem}.ok{background:#e6f4ea;color:#1e6b3a;padding:1rem;border-radius:10px}small{color:#6b7672}</style></head><body><div class="c">
<h1>🌿 تثبيت الموقع</h1>
<?php if ($done): ?>
  <div class="ok">✅ تم التثبيت بنجاح. حُذف ملف التثبيت تلقائياً.<br><br><a href="admin.html">افتح لوحة التحكم ←</a><br><small>سجّل الدخول بكلمة المرور التي اخترتَها.</small></div>
<?php elseif ($need): ?>
  <div class="e">الاستضافة لا تستوفي المتطلبات: <?= h(implode('، ', $need)) ?></div>
<?php else: ?>
  <form method="post" autocomplete="off">
    <label>رمز التثبيت (سلّمه لك البائع)</label><input name="code" required>
    <label>اسم المتجر</label><input name="name" value="<?= h($_POST['name'] ?? '') ?>" required maxlength="60">
    <label>رقم واتساب (بالصيغة الدولية، مثال 2135XXXXXXXX)</label><input name="wa" value="<?= h($_POST['wa'] ?? '') ?>" inputmode="numeric" required>
    <label>النطاق (اختياري، مثال shop.com)</label><input name="domain" value="<?= h($_POST['domain'] ?? '') ?>" dir="ltr">
    <label>كلمة مرور المدير (10 أحرف على الأقل)</label><input type="password" name="pw" required minlength="10">
    <label>أعد كتابة كلمة المرور</label><input type="password" name="pw2" required minlength="10">
    <?php if ($msg): ?><div class="e"><?= h($msg) ?></div><?php endif; ?>
    <button type="submit">تثبيت</button>
  </form>
<?php endif; ?>
</div></body></html>
