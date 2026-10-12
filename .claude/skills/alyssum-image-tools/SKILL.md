---
name: alyssum-image-tools
description: تطوير أدوات الصور في مطوّر الصفحات: تبويب «تعديل الصورة»، بازل/ماسك/نزع الخلفية/الالتقاط/استوديو المنتج، مولّد الصور والنشر متعدد المنصات، وصور الأدوات قبل/بعد. استعمله عند أي عمل على الصور أو الإعلانات أو الدفعات (مرجعه docs/photoroom-tools-report.md).
---
# أدوات الصور

**الملفات:** `scripts/pagebuilder-editor.js` (المحرّر `PBApp`)، `pagebuilder-studio.js` (`PBStudio`)، `pagebuilder-bgremove.js`، `-mask.js`، `-puzzle.js`، `-smart.js`، `assets/js/img-gen.js` (`ImgGen`)، `admin-imgbatch.js`، `img-upscale.js`. تُجمَّع في admin.html بـ`python3 scripts/build-admin-pb.py` (لا تعدّل admin.html مباشرة لهذه الأجزاء).

## البنية
- **تبويب «تعديل الصورة» اليساري** (`data-lt="img"`): `imgPane()` بطاقات `.pbx-tt` بصور `assets/img/tools/<id>.webp` (قبل/بعد) تُولَّد بـ`python3 scripts/gen-tool-thumbs.py`. النقر ← `imgPick(k)` يفتح اللوحة اليمنى `#pbx-ep` ويضبط `E.ept` (pz|mk|bg|cap|st). أداة جديدة: `IMG_TOOLS` + `EP_TABS` + `epBody` + صورة في المولّد + لون في admin-glass.css.
- **استوديو المنتج:** `compose(cut,bb,o)` نقية على Canvas؛ المعاينة الحية تبدّل `img.src` في الإطار فقط (`PBApp.stPreview`) وشريط `#pbx-epf` «تطبيق/إلغاء»؛ تعمل حتى قبل نزع الخلفية. أدواته الخمس من القائمة اليسرى (`PBStudio.setTab`).
- **نزع الخلفية:** `autoCut` — خلفية متجانسة ← `classic` أولاً (`uniformBg/floodBg`) وإلا `ai` (لا يُجرَّب في بيئة Claude).
- **شريط الصورة العلوي** `qbarHtml`: «تعديل» (أخضر بلون المظهر، أبيض عند الفتح) + رجوع/عودة عند فتح اللوحة.
- **لوحات الإعلان:** `page.ad={w,h,id,platform}`؛ `adResize` لتغيير المقاس؛ النشر على المنصات `ImgGen.pubPane/pubRun`.
- **الذكاء:** Gemini/fal عبر `ImgGen.quick` فقط (بمفتاح المستخدم، تأكيد تكلفة، سقف إنفاق)؛ باقي الأدوات بلا AI. المرحلة التالية من الخارطة في `docs/photoroom-tools-report.md`.

## قواعد
- غير مدمّر: كل تعديل يمرّ بـ`afterEdit()`/`commitAfter` (يدخل سجلّ التراجع) والمعاينة لا تكتب في البيانات حتى «تطبيق».
- حقول الصورة: `fx/fwd` نسب %، `fy/fh/fs` بكسل تصميم؛ لا هوامش سالبة جانبية.
- لا تُظهر أسماء مزوّدي الذكاء في الواجهة.
- صور جديدة للأدوات/القوالب: بلا علامات مائية أو شعارات؛ لا نساء بلا خمار ولا أجزاء عارية.
- الاختبار: حالات «الاستوديو/تبويب تعديل الصورة/شريط الصورة» في test-hand.js (أوقف `AIVision` فيها).
