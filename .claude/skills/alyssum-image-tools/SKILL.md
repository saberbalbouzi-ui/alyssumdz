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
- **مكتبة الأصول (v1.89.254):** تبويب `ast` في المطوّر (`scripts/pagebuilder-assets.js`): Pixabay (صور/فيديو، مفتاح المستخدم محلياً) + Iconify (SVG، ترخيص المجموعة ظاهر وفلتر «تراخيص حرة»)؛ ينزّل ولا يربط؛ Unsplash ممنوع (ترخيص). اختبار `scripts/test-assets.js`.
- **بطاقات الأدوات (v1.89.255):** من `assets/econes` إلى `assets/img/tools/*.webp` (280×325 شفاف)؛ الأدوات المحلية والذكية في شبكة واحدة (`.pbx-tt.card`)، لا قسم ذكي منفصل.
- **ثلاث قوائم (v1.89.256):** `imgPane` = إنشاء / تعديل / أتمتة وتوسّع؛ صفوف `data-imgx` (`rowBtn`/`imgRow`/`goAdmin`) وأداة `up` للتكبير (`ImgUpscale`). أداة جديدة تُدرج في `grp(...)` أو صفاً.
- **تحسين الجودة (`up`) واستوديو الأزياء (`fa`، v1.89.257):** `upPanel/upGo` في pagebuilder-editor.js (تكبير + `UP.dn/auto` عبر `PBRetouch._t.run`)؛ الأزياء في `PBAI` (`fashionPrompt` نقية، `FA_MODES`، `S.fa`)؛ أي وضع أزياء جديد = أضفه لـ`FA_MODES` وفرعاً في `fashionPrompt`، والتزم بقاعدة الاحتشام (بلا جلد مكشوف إلا الوجه واليدين، امرأة بخمار).
- **الهوية البصرية (`br`، `PBBrand`، v1.89.257):** `render` نقية؛ مفتاحا التخزين `pbx_brand_kit` و`pbx_brand_logo`؛ لون جديد في المجموعة = أضف اسمه في `SLOTS` ولوناً في `DEF.colors`.
- **أيقونات بلا كتابة + عناوين مترجمة (v1.89.263):** `assets/realistic_tool_icons_svg/` (مصدر، بلا نص داخل الصورة) ← webp في `assets/img/tools/ic/` ← `TT_ICON` في pagebuilder-editor.js؛ العناوين/الأوصاف في `assets/data/tool-titles.json` (ar/fr/en، لغة اللوحة `alyssum_ui_lang`). أداة جديدة: أيقونة بلا كتابة + مدخل JSON + `TT_ICON`؛ لا تضع نصاً داخل الصور.
- **كل الأدوات + صفحة تعريف المنصة (v1.89.264):** `assets/data/tools-catalog.json` (يولّده gen-tool-pages.py) يغذّي «التطبيقات ← كل الأدوات» (بحث، صفحة التعريف، الدليل، افتح في المحرّر)؛ صفحات التعريف في `saas/landing/<أداة>/` وتُربط بحقل `landing` في `saas/guide/tools.json`؛ اسم المنصة من `saas/brand.json`؛ لا اسم أليسوم ولا أسماء مزوّدين فيها.
- **صفحات التعريف المولَّدة (v1.89.265):** `scripts/gen-landing.py` ← `saas/landing/<slug>/` (مولّد الصور، الأزياء، تصوير المنتج)؛ صور من حزم `assets/alyssum_*_webp` بعد قصّ الشرائط المطبوعة، لا قصاصات واجهة فرنسية ولا نساء بلا خمار؛ لا تضع `data-brand` على `<html>`.

## عرض 360° وتحسين الجودة (v1.89.266)
- عنصر `view360` (إطارات `imgs` + سكربت `.pb-v360`) وأداة `PBAI` kind `v3` (ذكاء بالتتابع بموافقة واحدة، أو رفع صور قرص دوّار). أداة جديدة تنتج صوراً: مرّرها بـ`PBAI._t.polish` قبل الرفع، ولا تحسّن ألوان كل إطار على حدة في تسلسل دوران.
- `python3 scripts/enhance-images.py <مجلد> --min-w 700` لتحسين صور صفحات التعريف؛ لا يخترع تفاصيل فاطلب الأصل عالي الدقة.
- صور النساء بلا حجاب في `saas/landing/virtual-model` مؤقتة بأمر صاحب المتجر؛ لا تُستعمل في مخرجات الأدوات.

## ستوديو ديزاين (v1.89.267)
تبويب `studio` (`assets/js/admin-studio.js`) يعرض كل الأدوات من `assets/data/tools-catalog.json` وصفحة مستقلة لكل أداة (`#studio=<id>`). أداة جديدة = مدخل في `saas/guide/tools.json` ثم `python3 scripts/gen-tool-pages.py` (يملأ what/steps/tips/rel في الكتالوج) فتظهر تلقائياً.

## صفحات التعريف (v1.89.268)
تسع صفحات: نزع الخلفية (يدوية) + ثماني مولَّدة من `scripts/gen-landing.py` (image-generator، virtual-model، product-photography، virtual-tryon، video-maker، product-scenes، quality-resize، object-eraser). حزمة صور جديدة = انسخ المنتقى إلى `saas/landing/<slug>/img/` (بلا نص مطبوع، بلا نساء بلا خمار)، شغّل `enhance-images.py`، أضف قاموساً لـPAGES وحقل `landing` في tools.json ثم `gen-tool-pages.py`.
(v1.89.269) لا صفحات دليل ولا تطبيق «كل الأدوات»: صفحة كل أداة هي صفحة التعريف وتعرض كل صور حزمتها (`PACKS` في gen-landing.py)، و«ستوديو ديزاين» يضمّنها بإطار `?embed=1`.

