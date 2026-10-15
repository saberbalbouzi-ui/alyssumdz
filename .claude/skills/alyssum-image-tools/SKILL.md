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

## أدوات المرحلة 3 (v1.89.161)
- `scripts/pagebuilder-retouch.js` (`PBRetouch`، محلي بلا مفتاح: تحسين تلقائي/ضوضاء/منظور/تغيير لون بالنقر/قص/تعتيم/حبيبات؛ دوال نقية في `_t`) و`scripts/pagebuilder-ai.js` (`PBAI`: توسيع الخلفية + تعديل بالوصف عبر `ImgGen.edit`؛ التوسيع يلصق الأصل فوق الناتج بحافة مُنعَّمة فلا يمسّ المنتج). الأدوات الجديدة = أضفها لـ`EP_TABS`/`IMG_TOOLS`/`IMG_SM` في المحرّر + `epBody/epDraw` + صورة بطاقة في `gen-tool-thumbs.py`. الممحاة بالفرشاة (`PBSmart.eraser`) مفعَّلة (`ERASER_ON=true`) وتعمل محلياً. اختبار: `node scripts/test-imgtools.js` + حالات «الأدوات الذكية» في test-hand.

- توسيع الصورة بالذكاء: إطار `.pbx-box.xp` يُسحب للخارج فقط (`E.xp` في المحرّر؛ `drawXp/startXp/xpApply`، و`PBAI.xpChanged/frameFromRatio`)، يولّد **خيارين** بطلبين وتأكيد تكلفة واحد (`ImgGen.estimate`)، والتطبيق يكبّر إطار العنصر الحر بقدر الإطار. أداة جديدة تعتمد إطاراً تفاعلياً: اتبع النمط نفسه (حالة في `E`، رسم في `positionOverlay` قبل المقابض العادية، تصفير عند `epClose`/تغيير الأداة).
- أدوات v1.89.161 الإضافية: `PBFade/PBFrame/PBCollage/PBVideo` (`pagebuilder-more.js` + آخر `pagebuilder-retouch.js`) و`AdminImgQA` (جودة الأغلفة وتوحيد النمط، `assets/js/admin-imgqa.js`)؛ كل أداة جديدة: لوحة + دالة نقية في `_t` + بطاقة نصف/نصف + حالات في `test-imgtools.js` وtest-hand (وعدّل أعداد الأدوات في حالة «تبويب تعديل الصورة»).

## قواعد
- غير مدمّر: كل تعديل يمرّ بـ`afterEdit()`/`commitAfter` (يدخل سجلّ التراجع) والمعاينة لا تكتب في البيانات حتى «تطبيق».
- حقول الصورة: `fx/fwd` نسب %، `fy/fh/fs` بكسل تصميم؛ لا هوامش سالبة جانبية.
- لا تُظهر أسماء مزوّدي الذكاء في الواجهة.
- صور جديدة للأدوات/القوالب: بلا علامات مائية أو شعارات؛ لا نساء بلا خمار ولا أجزاء عارية.
- الاختبار: حالات «الاستوديو/تبويب تعديل الصورة/شريط الصورة» في test-hand.js (أوقف `AIVision` فيها).
- **المعاينة المباشرة الموحَّدة (v1.89.205):** كل أداة في «تعديل الصورة» تعرض نتيجتها على صورة الصفحة نفسها بـ`PBApp.liveCanvas(id, canvas, {tab, apply, cancel})` (أو `liveShow(id,url,h)`)، وتحتها زرّا «تنفيذ/إلغاء» (`#pbx-epf`، النوع `lv`)؛ `apply` يرفع ويثبّت ثم يستدعي `PBApp.liveClear(false)` قبل `commitAfter`، و`cancel` يصفّر حالة الأداة (الاستعادة تلقائية)؛ تُلغى تلقائياً عند تحديد عنصر آخر أو تبديل الأداة أو إغلاق اللوحة. **أداة جديدة = لا لوحة معاينة ولا زر «تطبيق» داخلها.** لمسات وتصحيح = خط معالجة من الأصل بمعاملات (لا تراكم). نزع الخلفية `PBBgRemove.live`.
- **أيقونات الأدوات (v1.89.253):** بطاقات تبويب «تعديل الصورة» صارت SVG من `assets/imgicons-new/` منسوخة إلى `assets/img/tools/<الاسم>.svg` (`IMG_TOOLS`/`IMG_SM` تحمل الاسم بامتداده، و`tile()` يضيف `.webp` فقط لما بلا امتداد كبطاقات `st_*`)؛ لا تعد مصغّرات «قبل/بعد».
