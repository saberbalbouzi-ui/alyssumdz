---
name: alyssum-release
description: خطوات إصدار ونشر تعديلات منصة أليسوم (رفع VERSION، البناء، الاختبار، الدمج في main، التحقق من النسخة الحية). استعمله عند إنهاء أي مهمة تعدّل الموقع أو اللوحة أو قبل أي commit/push.
---
# إصدار ونشر أليسوم

الدمج في `main` مفوَّض دائماً من صاحب المتجر («لا تسألني عن الدمج أبداً») بشرط نجاح الاختبار.

## الخطوات
1. عدّل الكود، وإن مسّ واجهة اللوحة راجع `alyssum-testing`.
2. ارفع رقم `VERSION` (صيغة `1.89.N`؛ `release.py` يرفض رقماً أقل).
3. `python3 scripts/build-admin-pb.py` (يختم النسخة في admin.html ويكسر كاش السكربتات). إن غيّرت CSS اللوحة فارفع `?v=` لملف الـCSS في admin.html.
4. اختبر: `NODE_PATH=/opt/node-tools/node_modules node scripts/test-hand.js` و`node scripts/test-voice.js` (+ اختبارات المجال: test-stock/test-payments/test-shipsup).
5. حدّث `assets/data/admin-help.json` (مقال لكل أداة/إعداد جديد) و`CLAUDE.md` (ملاحظة بالإصدار) ؛ ملفات جديدة مشتركة تدخل `shared-files.json`.
6. commit بملحقات الإسناد المطلوبة (Co-Authored-By + Claude-Session)، ثم:
   `git fetch origin main && git merge origin/main` ثم `git push origin HEAD:<فرع الجلسة>` و`git push origin HEAD:main`.
7. تحقق: `curl -s https://alyssumdz.com/VERSION` يطابق الرقم (انتظر دقيقة).

## قواعد ثابتة
- لا تستعمل `pkill -f` (يقتل الصدفة). لا `sleep` متسلسل: استعمل حلقة for مع curl.
- لا `service_role` في المستودع، ولا تعدّل قاعدة الإنتاج من الجلسة.
- الأزرار الجديدة زجاج شفاف منتفخ بنص أبيض (أخضر أساسي، برتقالي تنبيه، أحمر حذف).
- نصوص واجهة اللوحة يقرؤها العميل: بلا أسماء ملفات/GitHub/Supabase/Gemini؛ الاسم الوحيد للخدمة الذكية «Alyssum API».
- الردود للمالك بالعربية قصيرة، مع اقتراحات تحسين، وحدّد صراحةً ما لم يُجرَّب على حساب/مفتاح حقيقي.
