---
name: alyssum-templates
description: إنشاء وتعديل قوالب المتجر والصفحات في أليسوم: مولّدات gen-templates، نصوص وبيانات القوالب، صفحات المنتج والفئات لكل قالب، المعاينات المصغّرة، التثبيت، وقواعد الصور. استعمله عند إضافة قالب أو تعديل شكله أو نسخ قالب.
---
# القوالب

**التوليد:** لا تعدّل JSON يدوياً. `python3 scripts/gen-templates.py` يقرأ `gen-templates-contact|order|store|niche|alyssum.py` + `tpl-parts.json` ويكتب `assets/pages/templates/<id>.json` + `index.json`. قالب جديد = `reg(...)` في أحد الملفات ثم أعد التوليد.

## قالب متجر كامل (cat:"store") يحتاج
1. `reg(...)` بعناصر المطوّر (`PIC/PH/IMG` للصور المحلية `assets/img/tpl/*.webp`، تأثيرات كدوال تنتج `set.fxs`).
2. `PACKS[id]` في `gen-templates-copy.py` (نصوص/منتجات/فئات تجريبية؛ بلا رقم واتساب حقيقي).
3. `PPAL` + `_HID/_FID` في `gen-template-products.py`/`copy.py` (ألوان صفحة المنتج والفئات، تنويع الهيدر/الفوتر).
4. معاينات: `NODE_PATH=/opt/node-tools/node_modules node scripts/gen-template-thumbs.js [id]` ثم ارفع `V` في admin-nav.js.
5. الملفات في `shared-files.json`.

## التثبيت والتطبيق
- `AdminNav.tplInstall/tplInstallHome/tplInstallProductsUi` + `ShopPages` (يعيد كتابة shop/account بهوية الرئيسية). صفحات المنتج: `tplSkinProduct` (CSS مقيّد `.pb-sec:not(:has(header.pb-hd,.pb-sf,.pb-tp))`). التفكيك من الأصل `*.orig.html` عبر `PBConvert.edit(...,{fresh:true})`.
- أقسام لها `slot` للصور و`grp` (top/main/bot) لتتعرف عليها `alyLocalize`.
- وضع التجريب `page.demo=true` يعرض بيانات القالب لا بيانات المتجر ويُصفَّر عند النشر.

## نسخ القوالب (PBClone)
تحليل التأثيرات في `pagebuilder-clone-fx.js` (`REGISTRY`)، وطلبات ما لا يدعمه المطوّر في `assets/data/fx-requests.json` — **اقرأه في بداية أي مهمة نسخ** ونفّذ الأكثر تكراراً. كل تأثير جديد يمرّ بـ`pushItem` باسم عربي وإعدادات. إضافة كروم في `extension/` (أعد بناءها بـ`build-extension.py` بعد أي تعديل).

## قواعد الصور والمحتوى
بلا علامات مائية/شعارات/علامات تجارية، ولا نساء بلا خمار، ولا جزء عارٍ غير الوجه واليدين (القوالب بصور رجال/منتجات). راجع كل صورة بصرياً بحجم كبير قبل إضافتها واذكر المصدر في `assets/img/tpl/CREDITS.md`.

## فخاخ
`::before/::after` للقسم محجوزان للتأثيرات (لا تجمع blobs مع wave). أسماء `@keyframes` بادئتها `k`. لا تضع `%` داخل نص يُنسَّق بـ`%` بلا `%%`. اللون الفاتح يأتي من `set.bg` لا CSS. لا هوامش سالبة جانبية على الجوال.

## تصميم بطبقات يخرجه الذكاء (PBSpec، v1.89.326)
`scripts/pagebuilder-spec.js`: JSON بصيغة `alyssum-design/1` (أقسام ← طبقات text/heading/image/shape/button/icon/price/offers بمواضع بالبكسل المرجعي + shadow + effects) ← `validate` (تنظيف غير موثوق: ألوان/أرقام/روابط/مصادر صور) ← `toSections` (قسم قماش `scaled` وعناصر حرة `fx/fy/fwd/fh`، الظلال والتأثيرات في `set.fxs`) ← المطوّر. `PBSpec.prompt()` يبني تعليمات لأي نموذج. أي طبقة/تأثير جديد = أضفه في `cleanLayer` و`layerToWidget`/`effectFx` ثم `DOC` ثم `node scripts/test-spec.js`. فخاخ: `al` لا يعمل للعنصر الحر (استعمل fx `text-align`)، ومغلّف `.pb-fit` يقصّ الظل (`overflow:visible!important` عبر fx).

**v1.89.328 — تطوير PBSpec:** (1) `generate` مرحلتان: `planPrompt` ← `cleanPlan` (ألوان/أقسام/أصول) ثم `prompt(o,plan)`؛ فشل الخطة يعود لخطوة واحدة؛ `o.type` landing|banner و`o.colors`. (2) `autofix(spec)` يعمل داخل `validate` (إيقافه `validate(raw,{fix:false})`): حدود الصفحة، أدنى خط `ceil(11*dw/390)`، إنزال النص المتداخل (تقدير ارتفاع `estH`)، تكبير ارتفاع القسم؛ نتائجه `spec.fixes`. (3) `fillImages`: كاش `alyssum_spec_assets` بمفتاح `assetKey(وصف،مقاس،cutout)` (يُتحقق بـHEAD، `o.exists` للاختبار)، سجلّ `alyssum_spec_costlog` (بلا مبالغ في الواجهة)، `PBSpec.cancel()` وزر إلغاء، مهلة 150ث، محاولتان لكل صورة، والفشل محصور في الصورة. الصورة تحمل `set.aiPrompt/aiCut` لإعادة توليدها بعد إعادة الفتح. (4) طبقة `video` (src https mp4/webm، poster، autoplay) ← عنصر `video` (حقلا `poster` و`vauto` أُضيفا؛ التشغيل التلقائي `data-lz` يُحمَّل عند الظهور بـIntersectionObserver في RUNTIME_JS). (5) `group` ← `set.grp` مشترك داخل القسم، `locked` ← `set.locked`، `hidden` ← `hd/ht/hm`. (6) `page.specMeta` {format,v,at,plan,assets,fixes}. **لم يُبنَ:** وسيط خادمي لمفتاح Gemini (المفتاح في المتصفح)، تخطيط جوال مستقل (تصغير متناسب فقط)، تحويل عكسي صفحة ← مخطط.
