# دليل نقل الموقع إلى مالك جديد

يُباع كل موقع **بنسخة مستقلة**: مستودع GitHub ومشروع Supabase خاصان بالمشتري، حتى لا تختلط الطلبات وبيانات الزبائن.

## 1) ما يُنقل إلى المشتري
| العنصر | كيف |
|---|---|
| المستودع | GitHub ← Settings ← Transfer ownership (أو نسخة جديدة من القالب) |
| النطاق | نقل التسجيل أو الـ DNS، وتحديث ملف `CNAME` |
| مشروع Supabase | Project Settings ← General ← Transfer project إلى منظمة المشتري، أو مشروع جديد (الأنظف) |
| حساب المدير | يُنشئه المشتري في Authentication ← Users، ويُضاف بريده إلى `admins` |

## 2) الهوية في مكان واحد
عدّل `CONFIG.SITE` في `assets/js/config.js` (الاسم، النطاق، واتساب، انستغرام، مستودع GitHub). الصفحات الثابتة (`index.html` و`p/*`) تحمل النطاق ورقم واتساب نصّاً، فشغّل:

```bash
python3 scripts/rebrand.py --dry-run \
  --old-domain alyssumdz.com --domain NEW.com \
  --old-wa 213559237239 --wa NEWNUMBER \
  --old-owner saberbalbouzi-ui --owner NEWOWNER \
  --old-repo alyssumdz --repo NEWREPO
```
ثم أعد التشغيل دون `--dry-run`. بعده استبدل الشعار والصور في `assets/img` والمنتجات من لوحة التحكم، وحدّث `assets/data/` (`agent-training.json` و`coupons.json` و`pixels.json` و`theme.json`) ببيانات المشتري.

## 3) قاعدة البيانات (مشروع Supabase جديد للمشتري)
```bash
SUPABASE_PAT=sbp_... ./scripts/setup-supabase.sh <project_ref> <admin_email>
```
ينفّذ `schema.sql` ويضيف المدير ويطبع المفتاح العام لوضعه في `SUPABASE_ANON_KEY`. ثم أنشئ المستخدم من Authentication ← Users (Auto Confirm) وأوقف التسجيل العام. الطلبات على `ORDERS_BACKEND: "supabase"` فلا حاجة لـ Google Apps Script ولا `ADMIN_KEY`.

## 4) ما يجب أن تنهيه أنت (البائع)
- [ ] حذف أي Personal Access Token لـ Supabase وGitHub أنشأتَه.
- [ ] تدوير مفاتيح مشروع Supabase إن بقي مشروعك القديم مستعملاً.
- [ ] إزالة نفسك من المتعاونين في المستودع، وحذف مفاتيح Gemini/Claude المحفوظة في متصفحك (اللوحة تحفظها في المتصفح فقط).
- [ ] تصدير طلباتك القديمة وعدم تسليم بيانات زبائنك إن لم يُتفق على ذلك.
- [ ] تعطيل أي سكربت Google أو WooCommerce قديم وحذف مفاتيحه.

## 5) ما يجب أن يفعله المشتري
- [ ] إنشاء توكن GitHub خاص به (Contents: write) وإدخاله في اللوحة ← إعدادات GitHub.
- [ ] تفعيل GitHub Pages على النطاق الجديد (HTTPS).
- [ ] تجربة طلب حقيقي ومراجعته في اللوحة.
- [ ] عدم نشر `service_role` أبداً.
