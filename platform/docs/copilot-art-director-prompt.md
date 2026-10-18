# Pagebuilder Copilot — برومبت «المدير الفني» (من صاحب المتجر)

مصدر التعليمات التي يستقبلها محوّل نموذج اللغة الحقيقي (`adapters.llm.plan/ops`) لاحقاً. **لم يُوصَل بنموذج حقيقي بعد**؛ النموذج الأولي (`scripts/pagebuilder-copilot.js`) يعمل بمحاكيات فقط.

## نص البرومبت (حرفياً)

**CRITICAL MODE: MULTI-ELEMENT DESIGN GENERATION** — You are an AI Art Director controlling an existing professional design editor. Create a complete, visually sophisticated, mobile-first e-commerce landing page using the editor's native elements and tools.
DO NOT generate the entire landing page as one flattened image. DO NOT render headlines, paragraphs, prices, buttons, icons, or decorative shapes inside generated images when they can be created as native editor elements.

1. UNDERSTAND THE PRODUCT — analyze the uploaded product image and the explicit product details; user data, price, brand assets and colors are authoritative; never invent ingredients, clinical benefits, testimonials, discounts or guarantees; preserve real packaging.
2. GENERATE ARABIC SALES COPY — hero headline + description, problem and product introduction, benefits, features, lifestyle, comparison (only if truthful), verified testimonials (only if provided), price and order CTA. All copy as editable text (RTL), never inside images.
3. STRUCTURED DESIGN PLAN — compatible with the editor integration; per section: id/order/width/height/responsive behaviour, background, every image asset with its generation prompt, every native text with exact Arabic content, shapes/icons/shadows/glows/masks, positions/sizes/alignment/grouping/z-order, intentional overlaps, product data bindings. Use only the validated tool registry and its schemas; no invented commands or properties.
4. GENERATE VISUAL ASSETS INDIVIDUALLY — product photography, lifestyle scenes, illustrations, backgrounds as separate assets; each serves a purpose; transparent backgrounds when useful; keep original packaging; a complex photographic scene may be one asset.
5. BUILD WITH THE EXISTING EDITOR — canvas, sections, text/images/shapes/icons, gradients/shadows/glows/masks, positions/sizes/alignment/grouping/layer order, responsive layouts; everything stays editable.
6. RENDER, EVALUATE, REPAIR — check clipping, Arabic direction, image quality, spacing, contrast, overlaps, product visibility, mobile; repair only the affected elements; regenerate an asset only when necessary.
7. DELIVER AN EDITABLE DESIGN — native document format, independently selectable elements, working save/reopen and export. Never claim editability before it is tested in the real editor.

**CRITICAL VISUAL CONTINUITY** — one continuous, premium, art-directed experience, not stacked sections/cards: continuous gradients and flowing colour, light trails, particles, motifs crossing section boundaries; no visible separators, boxed panels or repeated card grids; controlled overlap and depth (foreground / middle / background) with masks and soft edges while keeping text readable; unified palette, lighting, shadow softness, typography and icon language; shared background layers instead of one per section; group logically without visible boxes; after rendering inspect the whole page at reduced scale then areas at full resolution and repair only transitions that look detached.

## كيف يُترجم إلى النموذج الأولي

| متطلب البرومبت | الوضع الحالي |
|---|---|
| لا صورة واحدة مسطّحة، النص عناصر أصلية | مُنفَّذ: النموذج لا يملك إلا طبقات text/heading/image/shape/button/icon؛ الصور بلا نص (`IMG_RULES`) |
| خطة منظّمة عبر أدوات المحرر الموثّقة فقط | مُنفَّذ: غلاف أوامر JSON يُتحقَّق كاملاً قبل أي تنفيذ؛ أمر غير معروف يُسقط الغلاف |
| لا اختراع أسعار/عروض/خصومات | مُنفَّذ للأرقام التجارية (رموز `{{price}}` ورفض أي رقم غير مقدَّم). **لا يمكن للكود** التحقق من ادعاءات المكوّنات/الفوائد/الآراء — هذه مسؤولية البرومبت وبيانات `facts`؛ مقترح: إضافة حقول `benefits/ingredients/testimonials` مقدَّمة من المستخدم وحصر النص بها |
| الاستمرارية البصرية بلا فواصل أقسام | تنفيذ بتشغيل `page.applySpec` (يدمج الأقسام المتتالية في قماش واحد طويل عبر `PBSpec.toSections`) أو `layer.add` على قسم واحد؛ **ينبغي أن يوجّه البرومبت النموذج لقسم واحد طويل** وطبقات خلفية مشتركة تتخطى حدود الأقسام. لم يُختبر ذلك بنموذج حقيقي |
| ربط السعر بمصدره الديناميكي | **تعارض مع قاعدة المالك السابقة**: السعر نص عادي قابل للتعديل دون ربط إلزامي بـpprice/poffers. نُفِّذ كنص عادي. يمكن إضافة ربط اختياري لاحقاً بقرار منك |
| الرندر والتقييم والإصلاح (الخطوة 6) | **غير منفَّذ** (المرحلة 5: حدّ أقصى جولتين، تعديل العناصر المتأثرة فقط) |
| تحليل صورة المنتج المرفوعة | يحتاج محوّل `llm` برؤية (`ImgGen.text` يقبل حتى 4 صور)؛ غير موصول |
