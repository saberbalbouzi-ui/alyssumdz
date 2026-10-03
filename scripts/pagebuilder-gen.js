/* ══════════════════════════════════════════════════════════════════════════════
   PBGen — مولّد صفحة الهبوط الذكي:
   ١) يبني «البرومبت السحري المزدوج» (نصوص بيع + برومبت تصميم لـ Nano Banana) بـ 7 لغات، تنسخه إلى Gemini/ChatGPT.
   ٢) يستورد صورة الصفحة الطويلة الناتجة ويحوّلها إلى صفحة قابلة للتعديل في منشئ الصفحات:
      تقطيع إلى أقسام (حدود مقترحة تلقائياً وقابلة للضبط) + استخراج النصوص (OCR داخل المتصفح بلا مفاتيح API)
      إلى عناصر نصية حرة + محو النص المخبوز من الصورة حيث الخلفية بسيطة. الأقسام «متناسبة» فتتحجم مع الشاشة.
   ══════════════════════════════════════════════════════════════════════════════ */
const PBGen = (() => {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = id => document.getElementById(id);

  /* ───────────── 1) البرومبت ───────────── */
  const LANGS = {
    ar: { label: "العربية (الأسواق المحلية والخليج)", name: "Arabic", rtl: true, tess: "ara+eng", trust: "ثقة عملائنا", limited: "⚠️ الكمية المتاحة محدودة جداً، اطلب الآن!", cta: "اطلب الآن - الدفع عند الاستلام" },
    ma: { label: "الدارجة المغربية (السوق المغربي - COD)", name: "Moroccan Darija (written in Arabic script)", rtl: true, tess: "ara+eng", trust: "ثقة زبائننا", limited: "⚠️ الكمية محدودة بزاف، طلب دابا!", cta: "طلب دابا - الأداء عند التوصيل" },
    en: { label: "الإنجليزية (الأسواق العالمية والدروبشيبينغ)", name: "English", rtl: false, tess: "eng", trust: "Trusted by Our Customers", limited: "⚠️ Limited stock available, order now!", cta: "ORDER NOW - CASH ON DELIVERY" },
    fr: { label: "الفرنسية (إفريقيا وأوروبا الناطقة بالفرنسية)", name: "French", rtl: false, tess: "fra+eng", trust: "La confiance de nos clients", limited: "⚠️ Quantité très limitée, commandez maintenant !", cta: "COMMANDER - PAIEMENT À LA LIVRAISON" },
    es: { label: "الإسبانية (أمريكا اللاتينية وإسبانيا)", name: "Spanish", rtl: false, tess: "spa+eng", trust: "La confianza de nuestros clientes", limited: "⚠️ ¡Cantidad muy limitada, pide ahora!", cta: "PEDIR AHORA - PAGO CONTRA ENTREGA" },
    it: { label: "الإيطالية (السوق الإيطالي)", name: "Italian", rtl: false, tess: "ita+eng", trust: "La fiducia dei nostri clienti", limited: "⚠️ Quantità molto limitata, ordina ora!", cta: "ORDINA ORA - PAGAMENTO ALLA CONSEGNA" },
    de: { label: "الألمانية (السوق الألماني وأوروبا الوسطى)", name: "German", rtl: false, tess: "deu+eng", trust: "Das Vertrauen unserer Kunden", limited: "⚠️ Nur begrenzte Menge verfügbar, jetzt bestellen!", cta: "JETZT BESTELLEN - ZAHLUNG BEI LIEFERUNG" },
  };
  /* قالب «11 قسماً» — مبني على برومبت Anti Acne الذي أعطى نتيجة ممتازة بلا أخطاء (النص الكامل في assets/data/landing-template-anti-acne.txt) */
  const TPL11 = `=== MANDATORY 11-SECTION STRUCTURE (proven template — follow it exactly) ===
The design prompt in STEP 2 MUST contain EXACTLY these 11 numbered sections, in this order, each with its own visual description and its own quoted strings (each string on its own line, each appears ONE TIME ONLY, end every section with "No additional text."). Keep ONE continuous background (no cards/boxes/bands/dividers) and ONE typeface family everywhere. Adapt every section to THIS product and category; never copy another product's claims, never invent ingredients or medical claims.
SECTION 1 — HERO: the original product prominently on one side with themed natural elements and a soft glow; a small badge (best seller), a huge headline (the main promise), a large sub-line, and THREE separate benefit lines each starting with a check mark.
SECTION 2 — THE PROBLEM: realistic imagery of the problem the customer faces (no uncovered women; prefer macro/close-up or objects); a large red question headline, one medium line, and THREE separate problem lines starting with a bullet.
SECTION 3 — THE SOLUTION: the original product shown heroically with an elegant glow; a large headline "the natural/effective solution" and one large line summarising the formula; no ingredient names here.
SECTION 4 — BEFORE AND AFTER: two realistic circular close-up photographs (before on the left, after on the right; never an uncovered woman's face); headline "the difference before and after use", one red ✘ line (before) and one green ✔ line (after).
SECTION 5 — KEY FEATURE: a luxurious macro still-life of the product beside its key natural ingredients; a large headline about the power of the formula and one large line naming the 2–3 hero ingredients.
SECTION 6 — INGREDIENT ICONS: exactly FOUR circular glowing icons (exactly four, not three, not five), each with ONLY ONE short label underneath, plus a headline above them; labels not repeated anywhere else.
SECTION 7 — DAILY USE: exactly THREE large glowing numbered circles (1, 2, 3) connected by one organic vine/line; a headline "how to use" and ONE short instruction under each circle, starting with its number.
SECTION 8 — PRODUCT COMPARISON: the original product on one side and ONE completely generic gray container with NO readable label on the other; headline "why choose us"; TWO ✔ lines under our product and TWO ✘ lines under the generic one; no other text and no other brand.
SECTION 9 — LIFESTYLE: a natural lifestyle scene with a modest Muslim woman wearing an elegant hijab that fully covers her hair, covered shoulders and neckline (or hands only); a large headline about renewed confidence and one short line; never an uncovered woman.
SECTION 10 — TRUST: exactly THREE floating trust icons with short labels (100% natural / cash on delivery / fast delivery), exactly five golden stars, a headline "our customers' trust" and ONE short testimonial (no other reviews).
SECTION 11 — FINAL OFFER: the original product next to a bright yellow CTA button; the price line (new price instead of old price, only if provided), one urgency offer line, and the CTA text inside the button — the CTA appears EXACTLY ONCE.
Typography inside every section: large, extremely bold, razor-sharp, right-to-left (when Arabic), generous empty space around each text element, never two paragraphs in one block.
=======================================================================
`;
  function buildPrompt(o) {
    const L = LANGS[o.lang] || LANGS.ar, bundle = o.offer === "bundle", ar = L.rtl;
    const ph = (arText, enText) => "[" + (ar ? arText : enText + " in " + L.name) + "]";
    const out = [];
    out.push(bundle
      ? "=== CRITICAL INSTRUCTION: PRODUCT BUNDLE ===\nNote: This landing page is for a BUNDLE / PACK of multiple products. Emphasize the combined value, the savings and the complete solution the bundle offers.\n============================================\n"
      : "=== CRITICAL INSTRUCTION: SINGLE PRODUCT ===\nNote: This landing page is for a SINGLE product. Focus on its core individual benefits.\n============================================\n");
    const det = [];
    if (o.name) det.push("- Product Name: " + o.name);
    if (o.desc) det.push("- Product Description/Benefits: " + o.desc);
    if (o.price) det.push("- Price: " + o.price);
    if (o.ing) det.push("- Ingredients / Components (feature them prominently as selling points, spelled exactly): " + o.ing);
    if (o.aud) det.push("- Target audience: " + o.aud);
    if (o.colors) det.push("- Design Colors: " + o.colors);
    if (det.length) out.push("=== SPECIFIC PRODUCT DETAILS PROVIDED BY THE USER ===\nPlease strictly use the following details in your copywriting instead of guessing them:\n" + det.join("\n") + "\n=====================================================\n");
    if (o.colors) out.push("=== CRITICAL INSTRUCTION: DESIGN COLORS ===\nThe user specified the following color palette: \"" + o.colors + "\".\nIn Step 2 (Design Prompt), you MUST replace \"[insert dynamic colors matching product image]\" with these specific colors.\n===========================================\n");
    if (o.tpl === "11") out.push(TPL11);
    out.push(`Analyze the uploaded product image. Identify the product, its key features, target audience, and best color palette. Act as a world-class ${L.name} Direct Response Copywriter and AI Prompt Engineer specializing in image-based mobile-first landing pages generated by 'Nano Banana Pro'.

### YOUR MISSION HAS TWO CRITICAL STEPS:

### STEP 1: TEXT GENERATION (COPYWRITING)
First, write highly persuasive ${L.name} sales copy for this specific product based on the structure and instructions required below. Use proven direct-response marketing formulas to maximize the purchase rate: a strong emotional hook, benefit-led headlines with specific numbers where honest, the PAS (Problem-Agitate-Solve) and AIDA structures, vivid before/after contrast, social proof, urgency and scarcity, risk reversal (cash on delivery, fast delivery) and a clear irresistible call to action. Speak directly to the buyer ("طفلك"/"بشرتك"... as fits the product) and keep every line punchy. Avoid absolute medical or curative claims — prefer verbs like "يدعم", "يساعد على". Use every ingredient and detail provided in the product details above. Present this copy clearly in your response so I can read it, review it, and use it.

### STEP 2: NANO BANANA PRO DESIGN PROMPT
After presenting the copywriting, output a single, consolidated READY-TO-COPY design prompt for the "Nano Banana Pro" image generator.

---

### CRITICAL INSTRUCTIONS FOR STEP 2 OUTPUT:
1. Output Format: Provide the entire design prompt inside a single code block.
2. Product Context: In all sections, explicitly describe the product visually. Ensure the layout handles either a single floating item OR a product bundle/package as a group.
3. Visual Descriptions: Add strong, creative English visual descriptions for each section based on the uploaded image.
4. ${L.name} Typography (MANDATORY): ALL ${L.name} text MUST be rendered in massive, extremely bold fonts, with a minimum size of 20px equivalent. Render ONLY the generated ${L.name} text inside the quotation marks " ". ABSOLUTELY DO NOT render any English structural words or labels (like Headline, Body Text, Visual Flow)${ar ? "" : " unless the target language is English"}.
5. Brackets and Label Removal: Before providing the final code, fill all [bracketed placeholders] with the precise ${L.name} text you generated, and remove all structural labels from the output.
5b. MASTERY & UNIQUENESS (MANDATORY): build a UNIQUENESS TABLE in your head before writing the final prompt — every headline, sub-line and bullet must be unique; no sentence may appear twice; no content word (4+ letters) may repeat inside the same string; never start two consecutive lines with the same word; keep each string 2–8 words. The visual spec must demand pixel-perfect, razor-sharp, studio-grade, high-resolution typography with perfect letter shapes and connections, correct RTL ordering, consistent font weight, no ghost letters, no duplicated glyphs, no garbled or invented words, and no text outside the quoted strings.
6. PROOFREADING (MANDATORY, DO IT BEFORE OUTPUT): re-read every ${L.name} string you wrote, word by word, and fix any spelling mistake. NEVER repeat the same word twice in a row or the same phrase twice in one string; never write the same sentence in two sections; every headline must be unique. NEVER use letter elongation/kashida/tatweel (like "لمـاذا") or decorative stretching; no diacritics. Use only correct, common words — if unsure of a word, choose a simpler one.
6b. SPELLING (MANDATORY): spell every ${L.name} word perfectly with correct standard orthography. Keep every quoted text SHORT (max 8 words per line, simple everyday words, no diacritics, no mixed languages). The image generator must copy each quoted string letter by letter and add NO other text anywhere (no fake labels or extra captions). Copy the brand/product name EXACTLY as printed on the product packaging.
8. STRUCTURE (MANDATORY): number every section like "SECTION 1 — HERO", "SECTION 2 — THE PROBLEM"…; give every quoted string its own line and its own empty space; state exact counts ("exactly FOUR icons, not three, not five"); write "Each line appears ONE TIME ONLY" for repeated-risk blocks; end each section with "No additional text."; keep every section's content unique.
7. Text Direction: ${ar ? "All text and layout direction must respect right-to-left flow." : "All text and layout direction must respect left-to-right flow."}

--- USE THIS EXACT TEMPLATE FOR STEP 2 (DESIGN PROMPT) ---

Act as a world-class Mobile E-commerce Designer. Generate an ultra-long vertical infographic landing page IMAGE (aspect ratio 9:32 or longer) for the [identify product bundle OR single product] in the uploaded image.

CRITICAL FORMAT RULE: DO NOT write any HTML, CSS, UI code, or text-based code. You MUST generate a purely visual, single continuous graphical IMAGE.

AESTHETIC & FLOW INSTRUCTIONS:
BACKGROUND (MANDATORY): ONE single unified background for the ENTIRE image — a single smooth, harmonious vertical degradé (gradient) built from 2–3 tones taken from the product's own colours ([insert dynamic colors matching product image]) that flows seamlessly from the top to the bottom of the image. DO NOT split the image into visible parts: NO cards, NO boxes, NO panels, NO horizontal bands, NO colour blocks, NO frames, NO divider lines and NO change of background between topics. Everything must read as ONE cohesive, harmonious composition where the content floats directly on the same gradient and topics are separated only by generous empty space. Subtle soft glow and light particles matching the [insert product vibe] are allowed. Feature the product repeatedly.

COMPOSITION & ART DIRECTION (MANDATORY — premium editorial advertising look, NOT a template): do NOT place the image on one side and the text on the other in every section. Vary the composition from section to section and break the grid: let the product overlap and partly cover the headline area, let giant headline words sit behind or in front of the product, bleed images off the edges, use diagonal and curved flows, circular cut-out photos, and floating layered elements with depth, soft shadows and glows. Vary scale dramatically (a huge hero product, then medium, then a small detail close-up), alternate left / right / centre alignment, and highlight ONE KEY WORD of each headline in a contrasting accent colour at a larger size than the other words. Use a clear visual hierarchy (huge headline, medium sub-line, small details) with generous spacing, like a high-end advertising poster.

* Opening area: product prominent at the top with soft glow and particle effects. Small Yellow Text: "${ph("اكتب: الأكثر مبيعاً أو جديد", "write: Best Seller or New")}"
* HUGE WHITE BOLD TEXT: "${ph("عنوان رئيسي جذاب وقوي جداً", "very strong, catchy main headline")}"
* Large Text: "${ph("جملة تشرح الفائدة الكبرى للمنتج", "one sentence explaining the product's biggest benefit")}"
* Medium Text, 3 short benefit lines each starting with a check mark: "✔ ${ph("فائدة 1", "benefit 1")}\n✔ ${ph("فائدة 2", "benefit 2")}\n✔ ${ph("فائدة 3", "benefit 3")}"

* Same background, slightly calmer mood. Feature problem icons floating freely (no box). Large Bold Red Text: "${ph("سؤال يلمس مشكلة العميل", "a question touching the customer's problem")}"
* Medium Text: "${ph("اشرح المشكلة باختصار", "briefly explain the problem")}"
* Small Text, 3 short problem bullets: "• ${ph("معاناة 1", "pain 1")}\n• ${ph("معاناة 2", "pain 2")}\n• ${ph("معاناة 3", "pain 3")}"

* A soft burst of light behind the product, which appears triumphantly with glowing effects (same background). HUGE BOLD COLORED TEXT: "${ph("عنوان يقدم المنتج كحل نهائي", "headline presenting the product as the final solution")}"
* Large Black Text: "${ph("جملة تؤكد قوة الحل", "sentence confirming the power of the solution")}"

* Two free-floating rounded photos side by side (no frame, soft edges blending into the background) with a clear visual contrast: left shows [describe problem visually], right shows [describe happy state]. LARGE BOLD COLORED TEXT: "${ph("عنوان جذاب للفرق قبل وبعد", "catchy before/after headline")}"
* Medium Red Text: "❌ ${ph("قبل: وصف قصير للمعاناة", "Before: short description of the struggle")}"
* Medium Green Text: "✅ ${ph("بعد: وصف قصير للراحة", "After: short description of the relief")}"

* Extreme close-up on [describe feature visually]. Use glowing effects. LARGE BOLD COLORED TEXT: "${ph("عنوان الميزة الأولى", "first feature headline")}"
* Large Text: "${ph("شرح قوي للميزة", "strong explanation of the feature")}"

* A free-floating row of 4 round glowing icons each with a 2-word label under it (key benefits): "${ph("ميزة قصيرة 1", "short benefit 1")}" · "${ph("ميزة قصيرة 2", "short benefit 2")}" · "${ph("ميزة قصيرة 3", "short benefit 3")}" · "${ph("ميزة قصيرة 4", "short benefit 4")}". LARGE BOLD COLORED TEXT above it: "${ph("عنوان فوائد المنتج", "benefits headline")}"

* Three numbered glowing circles 1-2-3 connected by a thin curved line (how to use). LARGE BOLD COLORED TEXT: "${ph("عنوان طريقة الاستعمال", "how-to-use headline")}"
* Medium Text: "1 ${ph("الخطوة الأولى", "step 1")}\n2 ${ph("الخطوة الثانية", "step 2")}\n3 ${ph("الخطوة الثالثة", "step 3")}"

* Comparison without any dividing line or box: a glowing, larger OUR PRODUCT overlapping a smaller dull gray generic competitor product, with the lists curving around them. LARGE BOLD COLORED TEXT: "${ph("عنوان يقارن ويثبت التفوق", "headline comparing and proving superiority")}"
* Medium Green Text: "✔️ ${ph("ميزة 1", "advantage 1")}\\n✔️ ${ph("ميزة 2", "advantage 2")}"
* Medium Red Text: "❌ ${ph("عيب 1", "drawback 1")}\\n❌ ${ph("عيب 2", "drawback 2")}"

* Lifestyle visual of [describe a scene with the product in use]. LARGE BOLD COLORED TEXT: "${ph("عنوان عن فائدة المنتج يومياً", "headline about the daily benefit")}"
* Large Black Text: "${ph("كيف يحسن المنتج حياة الزبون", "how the product improves the customer's life")}"

* A row of 3 small glowing trust badges (icon + two words each): "${ph("طبيعي 100%", "100% natural")}" · "${ph("الدفع عند الاستلام", "cash on delivery")}" · "${ph("توصيل لكل الولايات", "nationwide delivery")}". Then 5 large glowing stars ★★★★★ centered. Customer icons. LARGE BOLD BLACK TEXT: "${L.trust}"
* Medium Black Text: "${ph("مراجعة إيجابية قصيرة بلسان زبون", "short positive review in a customer's voice")}"

* Closing area on the same background (no separate footer block). Product prominent next to the CTA button. LARGE BOLD TEXT: "${ph("اذكر السعر بوضوح", "state the price clearly")}"
* Large White Bold Text: "${L.limited}"
* HUGE BLACK TEXT on YELLOW Button: "${L.cta}"`);
    return out.join("\n");
  }

  /* ───────────── 2) تحليل الصورة ───────────── */
  const loadImage = file => new Promise((res, rej) => { const url = URL.createObjectURL(file), im = new Image(); im.onload = () => { const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d").drawImage(im, 0, 0); URL.revokeObjectURL(url); res(c); }; im.onerror = () => rej(new Error("تعذّرت قراءة الصورة")); im.src = url; });

  /* حدود مقترحة: n-1 خطاً قرب المواضع المتساوية، يُختار فيها أهدأ صف (أقل تغيّراً عمودياً وأفقياً) */
  function suggestCuts(canvas, n) {
    n = Math.max(1, Math.min(30, Math.round(n))); if (n === 1) return [];
    const W = canvas.width, H = canvas.height, sw = 72, sh = Math.max(n * 4, Math.round(H * sw / W)), sm = document.createElement("canvas"); sm.width = sw; sm.height = sh;
    const g = sm.getContext("2d", { willReadFrequently: true }); g.drawImage(canvas, 0, 0, sw, sh); const d = g.getImageData(0, 0, sw, sh).data, sc = [];
    const px = (x, y) => { const i = (y * sw + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    for (let y = 0; y < sh; y++) { let e = 0; for (let x = 0; x < sw; x++) { const a = px(x, y), b = px(x, Math.min(sh - 1, y + 1)), c = px(Math.min(sw - 1, x + 1), y); e += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) + 0.7 * (Math.abs(a[0] - c[0]) + Math.abs(a[1] - c[1]) + Math.abs(a[2] - c[2])); } sc.push(e / sw); }
    const sm3 = sc.map((_, y) => ((sc[y - 1] ?? sc[y]) + sc[y] + (sc[y + 1] ?? sc[y])) / 3), cuts = [], seg = sh / n; let last = 0;
    for (let i = 1; i < n; i++) { const t = Math.round(i * seg), lo = Math.max(last + Math.round(seg * .4), t - Math.round(seg * .35)), hi = Math.min(sh - 2, t + Math.round(seg * .35)); let best = Math.min(Math.max(t, lo), hi), bv = Infinity; for (let y = lo; y <= hi; y++) if (sm3[y] < bv) { bv = sm3[y]; best = y; } cuts.push(Math.round(best * H / sh)); last = best; }
    return cuts;
  }

  /* OCR داخل المتصفح (Tesseract.js من CDN، بلا مفتاح). يمكن استبداله (للاختبار) بتعيين PBGen.ocr */
  async function ensureTesseract() {
    if (window.Tesseract) return; await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"; s.onload = res; s.onerror = () => rej(new Error("تعذّر تحميل محرك OCR (تحقق من الإنترنت)")); document.head.appendChild(s); });
  }
  async function defaultOcr(canvas, lang, log) {
    await ensureTesseract(); const r = await Tesseract.recognize(canvas, lang || "ara+eng", { logger: m => log && log(m) });
    const lines = r.data.lines || ((r.data.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(p => p.lines || [])));
    return lines.map(l => ({ text: String(l.text || "").replace(/\s+/g, " ").trim(), conf: l.confidence, bbox: l.bbox })).filter(l => l.text.length >= 2 && l.conf >= 40);
  }

  /* ألوان الصندوق: لون الخلفية (وسيط الحلقة المحيطة) ولون الحبر + هل الخلفية بسيطة بما يكفي للمحو */
  function analyze(ctx, W, H, b) {
    const pad = Math.max(8, Math.round((b.y1 - b.y0) * .3)), x0 = Math.max(0, Math.floor(b.x0 - pad)), y0 = Math.max(0, Math.floor(b.y0 - pad)), x1 = Math.min(W, Math.ceil(b.x1 + pad)), y1 = Math.min(H, Math.ceil(b.y1 + pad));
    const bw = x1 - x0, bh = y1 - y0; if (bw < 4 || bh < 4) return null; const d = ctx.getImageData(x0, y0, bw, bh).data, at = (x, y) => { const i = (y * bw + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const ring = []; for (let x = 0; x < bw; x++) { ring.push(at(x, 0), at(x, bh - 1)); } for (let y = 0; y < bh; y++) { ring.push(at(0, y), at(bw - 1, y)); }
    const med = i => { const a = ring.map(p => p[i]).sort((p, q) => p - q); return a[a.length >> 1]; }, bg = [med(0), med(1), med(2)], dist = p => Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]);
    const inner = []; for (let y = pad; y < bh - pad; y++) for (let x = pad; x < bw - pad; x++) inner.push(at(x, y));
    inner.sort((p, q) => dist(q) - dist(p)); const top = inner.slice(0, Math.max(1, Math.round(inner.length * .06))), ink = [0, 1, 2].map(i => Math.round(top.reduce((a, p) => a + p[i], 0) / top.length));
    /* بساطة الخلفية: انحراف الحلقة عن الاستكمال الخطي بين الحافتين الأفقيتين */
    let err = 0, n = 0; for (let y = 0; y < bh; y++) { const L = at(0, y), R = at(bw - 1, y); for (const x of [0, bw - 1]) { /* حواف فقط */ } }
    for (const y of [0, bh - 1]) { const L = at(0, y), R = at(bw - 1, y); for (let x = 0; x < bw; x += 2) { const t = x / (bw - 1), p = at(x, y); err += Math.abs(p[0] - (L[0] + (R[0] - L[0]) * t)) + Math.abs(p[1] - (L[1] + (R[1] - L[1]) * t)) + Math.abs(p[2] - (L[2] + (R[2] - L[2]) * t)); n++; } }
    err /= (n * 3 || 1);
    const hex = c => "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
    return { bg: hex(bg), ink: hex(ink), contrast: dist(ink) / 3, err, rect: { x0, y0, x1, y1 } };
  }
  /* محو النص: استكمال خطي أفقي بين لوني الحافتين اليمنى واليسرى لكل صف */
  function erase(ctx, rect) {
    const { x0, y0, x1, y1 } = rect, w = x1 - x0, h = y1 - y0; if (x0 < 3 || w < 6) return; const img = ctx.getImageData(x0, y0, w, h), d = img.data, edge = (x, y) => ctx.getImageData(x, y, 3, 1).data;
    for (let y = 0; y < h; y++) { const l = edge(Math.max(0, x0 - 3), y0 + y), r = edge(Math.min(ctx.canvas.width - 3, x1), y0 + y), L = [0, 1, 2].map(i => (l[i] + l[4 + i] + l[8 + i]) / 3), R = [0, 1, 2].map(i => (r[i] + r[4 + i] + r[8 + i]) / 3);
      for (let x = 0; x < w; x++) { const t = x / Math.max(1, w - 1), i = (y * w + x) * 4; d[i] = L[0] + (R[0] - L[0]) * t; d[i + 1] = L[1] + (R[1] - L[1]) * t; d[i + 2] = L[2] + (R[2] - L[2]) * t; d[i + 3] = 255; } }
    ctx.putImageData(img, x0, y0);
  }

  /* تضييق الصندوق إلى حدود الحبر الفعلية (يصحّح انحراف OCR/Gemini): البكسل «حبر» إن بعُد عن استكمال الخلفية الخطي بين حافتي الصندوق */
  function refineBox(ctx, W, H, b) {
    const pad = Math.max(6, Math.round((b.y1 - b.y0) * .3)), x0 = Math.max(0, Math.floor(b.x0 - pad)), y0 = Math.max(0, Math.floor(b.y0 - pad)), x1 = Math.min(W, Math.ceil(b.x1 + pad)), y1 = Math.min(H, Math.ceil(b.y1 + pad)), w = x1 - x0, h = y1 - y0;
    if (w < 8 || h < 8) return b; const d = ctx.getImageData(x0, y0, w, h).data; let mnx = w, mxx = -1, mny = h, mxy = -1, n = 0;
    for (let y = 0; y < h; y++) { const li = (y * w) * 4, ri = (y * w + w - 1) * 4;
      for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, t = x / (w - 1), e = Math.abs(d[i] - (d[li] + (d[ri] - d[li]) * t)) + Math.abs(d[i + 1] - (d[li + 1] + (d[ri + 1] - d[li + 1]) * t)) + Math.abs(d[i + 2] - (d[li + 2] + (d[ri + 2] - d[li + 2]) * t));
        if (e > 110) { n++; if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; } } }
    if (n < 12 || mxx < 0) return b; return { x0: x0 + mnx, x1: x0 + mxx + 1, y0: y0 + mny, y1: y0 + mxy + 1 };
  }
  const { eraseRects, detectText, eraseBrush } = ImageTools;      // أدوات مشتركة: assets/js/image-tools.js
  /* إعادة رسم مناطق معقدة بـ Gemini (تحرير صورة): نرسل القصاصة، ونأخذ بكسلات الناتج داخل القناع فقط فيبقى الباقي مطابقاً للأصل */
  async function geminiEraseRegion(key, ctx, P, m2, v) {
    const c = document.createElement("canvas"); c.width = P.w; c.height = P.h; c.getContext("2d").putImageData(ctx.getImageData(P.x, P.y, P.w, P.h), 0, 0);
    const b64 = c.toDataURL("image/png").split(",")[1];
    const parts = [{ text: "Edit this image: remove ALL text, letters, numbers, symbols and watermarks. Reconstruct the background naturally where the text was (same colours, gradient, texture, lighting). Do NOT change, move, recolour or restyle anything else. Keep the exact same framing and size. Return only the edited image." }, { inline_data: { mime_type: "image/png", data: b64 } }];
    const j = await gemGenerate(key, "image", parts, {}, await imageModels(key)), pt = ((((j.candidates || [])[0] || {}).content || {}).parts || []).find(x => x.inlineData || x.inline_data), d = pt && (pt.inlineData || pt.inline_data);
    if (!d) return false; const bin = atob(d.data), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const im = await loadImage(new Blob([arr], { type: d.mimeType || d.mime_type || "image/png" })), t = document.createElement("canvas"); t.width = P.w; t.height = P.h; const tg = t.getContext("2d", { willReadFrequently: true }); tg.drawImage(im, 0, 0, P.w, P.h);
    const o = tg.getImageData(0, 0, P.w, P.h).data; for (let i = 0; i < P.w * P.h; i++) if (m2[i]) { v[i * 3] = o[i * 4]; v[i * 3 + 1] = o[i * 4 + 1]; v[i * 3 + 2] = o[i * 4 + 2]; }
    return true;
  }
  /* ───── Gemini: اختيار نموذج متاح تلقائياً + تفسير الأخطاء بالعربية ───── */
  const GEM_PREF = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  function gemErr(status, msg) {
    msg = String(msg || ""); const raw = " [" + (status || "?") + (msg ? ": " + msg.slice(0, 160) : "") + "]";
    if (/API key not valid|API_KEY_INVALID|invalid api key/i.test(msg)) return "المفتاح غير صحيح — انسخه كاملاً من aistudio.google.com/apikey بدون مسافات أو أحرف زائدة." + raw;
    if (/referer|referrer|HTTP_REFERRER/i.test(msg)) return "المفتاح مقيَّد بنطاقات معيّنة (HTTP referrers) وموقعك ليس بينها — في Google AI Studio/Cloud Console أضف نطاق موقعك أو اجعل المفتاح بلا قيود تطبيق." + raw;
    if (/not been used|disabled|SERVICE_DISABLED|accessNotConfigured/i.test(msg)) return "واجهة Generative Language API غير مفعّلة لمشروع هذا المفتاح — فعّلها من Google Cloud Console أو أنشئ مفتاحاً جديداً من AI Studio." + raw;
    if (status === 503 || status === 500 || /high demand|overloaded|unavailable/i.test(msg)) return "النموذج مشغول مؤقتاً عند Google (ضغط طلبات مرتفع) وليس خللاً في مفتاحك — أعدنا المحاولة تلقائياً دون جدوى؛ حاول بعد دقائق، أو اختر مستوى «اقتصادي» (Flash-Lite) فهو غالباً أقل ازدحاماً." + raw;
    if (status === 429 || /quota|RESOURCE_EXHAUSTED|rate/i.test(msg)) return "تجاوز المفتاح حصة الاستعمال (مجانية/دقيقة) — انتظر دقيقة ثم أعد المحاولة، أو استعمل مفتاحاً آخر." + raw;
    if (status === 403 || /PERMISSION_DENIED/i.test(msg)) return "المفتاح لا يملك صلاحية استعمال النموذج (قد يكون محظوراً في بلدك/مشروعك أو مقيّداً)." + raw;
    if (status === 400 && /location|region/i.test(msg)) return "الخدمة غير متاحة في منطقتك لهذا المفتاح." + raw;
    return (msg || ("Gemini " + status)) + raw;
  }
  /* مستويات التكلفة (سعر مليون رمز إدخال بالدولار حسب التسعير المعلن): Flash-Lite الأرخص للمهام البسيطة، Flash للمتوسطة */
  const GEM_PRICE = { "gemini-2.5-flash-lite": .10, "gemini-3.1-flash-lite": .25, "gemini-2.5-flash": .30, "gemini-3.7-flash": .75, "gemini-3.1-pro": 2.0 };
  const GEM_LITE = ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.0-flash-lite"], GEM_FLASH = ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-2.0-flash"], GEM_BEST = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.1-pro", "gemini-2.5-pro"];
  const gemTier = () => { try { return localStorage.getItem("alyssum_gem_tier") || "auto"; } catch (e) { return "auto"; } };
  /* ترتيب التفضيل حسب المهمة: auto = الكشف والتدقيق على Lite والقراءة والكتابة على Flash */
  function gemPrefs(task) {
    const t = gemTier(), simple = task === "detect" || task === "proof";
    if (t === "eco") return GEM_LITE.concat(GEM_FLASH); if (t === "best") return GEM_BEST.concat(GEM_FLASH, GEM_LITE);
    return simple ? GEM_LITE.concat(GEM_FLASH) : GEM_FLASH.concat(GEM_LITE, ["gemini-3.8-flash"]);
  }
  let _gemCache = null; const _usage = { tokens: 0, cost: 0, calls: 0 };
  async function gemModels(key, task) {
    const pref = gemPrefs(task || "copy"); let names = null;
    if (_gemCache && _gemCache.key === key) names = _gemCache.names;
    else { try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key } });
      if (r.ok) { const j = await r.json(); names = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes("generateContent")).map(m => String(m.name).replace(/^models\//, "")); _gemCache = { key, names }; }
    } catch (e) { } }
    if (!names) return pref.slice(0, 3).concat([pref[0]]);
    const pick = pref.filter(m => names.includes(m)), any = names.filter(n => /flash/i.test(n) && !/image|tts|live|embedding|thinking|preview-\d/i.test(n) && !pick.includes(n));
    const base = pick.concat(any).slice(0, 3); return base.length ? base.concat([base[0]]) : pref.slice(0, 2).concat([pref[0]]);
  }
  /* احتساب الاستهلاك والتكلفة التقريبية للمدخلات */
  function gemTrack(j, model) {
    const u = (j && j.usageMetadata) || {}, tk = Number(u.promptTokenCount) || 0; _usage.tokens += tk; _usage.calls++; const pr = GEM_PRICE[model]; if (pr) _usage.cost += tk / 1e6 * pr; showCost();
  }
  function showCost() { const el = typeof document !== "undefined" && document.getElementById("gen-cost"); if (el) el.textContent = _usage.calls ? "استهلاك Gemini: " + _usage.calls + " طلب · " + _usage.tokens.toLocaleString("en") + " رمز إدخال · ≈ $" + _usage.cost.toFixed(4) + " (مدخلات)" : ""; }
  /* اختبار المفتاح: يعرض النماذج المتاحة ويجرّب طلباً صغيراً ويفسّر الخطأ */
  async function testKey() {
    const msg = $("gen-automsg"), key = ($("gen-gkey1").value || "").trim() || (function () { try { return localStorage.getItem("alyssum_gp_gkey") || ""; } catch (e) { return ""; } })();
    if (!key) { msg.textContent = "❌ أدخل المفتاح أولاً"; return; } msg.textContent = "⏳ اختبار المفتاح…"; _gemCache = null;
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key } }), j = await r.json().catch(() => ({}));
      if (!r.ok) { msg.textContent = "❌ " + gemErr(r.status, (j.error && j.error.message) || ""); return; }
      const models = await gemModels(key, "proof"), t = await (PBGen.textFn || geminiText)(key, "Reply with exactly: OK", null, null, "proof");
      msg.textContent = "✅ المفتاح يعمل — النموذج المستعمل: " + models[0] + (t ? "" : " (ردّ فارغ)");
    } catch (err) { msg.textContent = "❌ " + err.message; }
  }
  /* Gemini رؤية: يقرأ النص بدقة أعلى للعربية ويعيد صناديقه (box_2d مُطبَّعة 0-1000)؛ المفتاح مفتاحك المخزَّن في المتصفح فقط */
  async function geminiOcr(canvas, key, langName) {
    const W = canvas.width, H = canvas.height, c2 = document.createElement("canvas"), k = Math.min(1, 1600 / W); c2.width = Math.round(W * k); c2.height = Math.round(H * k); c2.getContext("2d").drawImage(canvas, 0, 0, c2.width, c2.height);
    const b64 = c2.toDataURL("image/jpeg", .9).split(",")[1];
    const prompt = `You are a precise OCR engine. The image is ${W}x${H} pixels and its text language is ${langName}. Read EVERY visible line of text exactly as written (keep the original script, digits, emojis and punctuation; never translate, correct or add words). Return ONLY JSON: {"lines":[{"text":"...","box_2d":[ymin,xmin,ymax,xmax]}]} where box_2d is normalized to 0-1000 relative to the image and fits tightly around that single line's glyphs. One entry per visual line, ordered top to bottom. If there is no text return {"lines":[]}.`;
    const o = await geminiJson(key, b64, prompt);
    return (o.lines || []).filter(l => l && l.text && Array.isArray(l.box_2d) && l.box_2d.length === 4).map(l => { const [ymin, xmin, ymax, xmax] = l.box_2d.map(Number); return { text: String(l.text).replace(/\s+/g, " ").trim(), conf: 95, bbox: { x0: xmin / 1000 * W, y0: ymin / 1000 * H, x1: xmax / 1000 * W, y1: ymax / 1000 * H } }; }).filter(l => l.text.length >= 1 && l.bbox.x1 > l.bbox.x0 && l.bbox.y1 > l.bbox.y0);
  }
  /* استدعاء Gemini بصورة + تعليمات ويعيد JSON؛ يجرّب أكثر من نموذج عند الازدحام */
  /* طلب موحّد لـ Gemini: تدوير النماذج + إعادة محاولة بتأخير متزايد عند الازدحام (503) أو الحصة (429) */
  async function gemGenerate(key, task, parts, cfg, modelsOverride) {
    const models = [...new Set(modelsOverride || await gemModels(key, task))], waits = [0, 4000, 10000, 20000]; let last = "";
    const note = t => { for (const id of ["gen-automsg", "gen-msg"]) { const el = typeof document !== "undefined" && document.getElementById(id); if (el && (!el.textContent || /^⏳|Google/.test(el.textContent))) el.textContent = t; } };
    for (let round = 0; round < waits.length; round++) {
      if (waits[round]) { note("⏳ Google مشغول مؤقتاً — إعادة المحاولة بعد " + waits[round] / 1000 + " ث (" + round + "/" + (waits.length - 1) + ")…"); await new Promise(r => setTimeout(r, waits[round])); }
      let busy = false, imgQuota = false;
      for (const m of models) {
        const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ parts }], generationConfig: cfg || {} }) });
        const j = await r.json().catch(() => ({}));
        if (r.ok) { gemTrack(j, m); j._model = m; return j; }
        const gm = (j.error && j.error.message) || ""; last = gemErr(r.status, gm);
        if (r.status === 429 && task === "image") { imgQuota = true; continue; }                                  // نماذج الصور غالباً بلا طبقة مجانية: لا فائدة من إعادة المحاولة
        if ([500, 502, 503, 504, 429].includes(r.status) || /high demand|overloaded|unavailable|try again/i.test(gm)) { busy = true; continue; }
        if (r.status === 404 || /no longer available|not found|not supported/i.test(gm)) continue;
        throw new Error(last);
      }
      if (imgQuota) throw new Error("🖼️ نماذج توليد الصور في Gemini غير مشمولة عادةً بالطبقة المجانية، ومفتاحك تجاوز/لا يملك حصة لها. الحل: فعّل الفوترة (Billing) لمشروع المفتاح في Google AI Studio، أو ولّد الصورة يدوياً بزر «نسخ البرومبت» في تطبيق Gemini ثم ارفعها بزر «لدي صورة جاهزة». (نصوص التسويق تعمل بالمجان وقد اكتملت.) " + last);
      if (!busy) break;
    }
    throw new Error(last || "لا يوجد نموذج Gemini متاح لهذا المفتاح");
  }
  async function geminiJson(key, b64, prompt, task) {
    const j = await gemGenerate(key, task || "ocr", [{ inline_data: { mime_type: "image/jpeg", data: b64 } }, { text: prompt }], { responseMimeType: "application/json", temperature: 0 });
    const t = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(x => x.text || "").join(""), m = t.match(/\{[\s\S]*\}/); if (!m) throw new Error("ردّ غير مفهوم من Gemini"); return JSON.parse(m[0]);
  }
  async function geminiText(key, text, b64, mime, task) {
    const j = await gemGenerate(key, task || "copy", (b64 ? [{ inline_data: { mime_type: mime || "image/jpeg", data: b64 } }] : []).concat([{ text }]), { temperature: .7 });
    return ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(x => x.text || "").join("");
  }
  /* اكتشاف تلقائي لمناطق المنتج/الصور/الأيقونات (غير النصية) ليُقصّ كلٌّ منها كعنصر مستقل */
  async function geminiDetect(canvas, key) {
    const W = canvas.width, H = canvas.height, c2 = document.createElement("canvas"), k = Math.min(1, 1400 / W); c2.width = Math.round(W * k); c2.height = Math.round(H * k); c2.getContext("2d").drawImage(canvas, 0, 0, c2.width, c2.height);
    const prompt = `This is a marketing landing-page image. List the distinct VISUAL objects that should be separated as independent images: the product(s) / product packaging / jars / bottles, people, food or ingredient photos, badges, seals, and standalone illustrations or icons. Do NOT include plain text, headlines, buttons, or the background. Return ONLY JSON: {"objects":[{"label":"short name","box_2d":[ymin,xmin,ymax,xmax]}]} with box_2d normalized 0-1000, fitting tightly around each object. At most 12 objects. If none, {"objects":[]}.`;
    const o = await geminiJson(key, c2.toDataURL("image/jpeg", .85).split(",")[1], prompt, "detect");
    return (o.objects || []).filter(x => x && Array.isArray(x.box_2d) && x.box_2d.length === 4).map(x => { const [a, b, c, d] = x.box_2d.map(Number); return { x0: Math.max(0, b / 1000 * W), y0: Math.max(0, a / 1000 * H), x1: Math.min(W, d / 1000 * W), y1: Math.min(H, c / 1000 * H), label: x.label }; }).filter(r => r.x1 - r.x0 > W * .04 && r.y1 - r.y0 > W * .04 && (r.x1 - r.x0) * (r.y1 - r.y0) < W * H * .6);
  }
  /* remove.bg: قص خلفية الصورة (PNG شفاف). قد يمنع المتصفح الاتصال المباشر (CORS) — عندها استعمل «قص كصورة» أو ارفع صورة مقصوصة يدوياً */
  async function removeBgCall(blob, key) {
    const fd = new FormData(); fd.append("image_file", blob, "cut.png"); fd.append("size", "auto"); fd.append("format", "png");
    let r; try { r = await fetch("https://api.remove.bg/v1.0/removebg", { method: "POST", headers: { "X-Api-Key": key }, body: fd }); } catch (e) { throw new Error("تعذّر الاتصال بـ remove.bg من المتصفح (قد يكون CORS أو الإنترنت)"); }
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j.errors && j.errors[0] && (j.errors[0].title + (j.errors[0].detail ? ": " + j.errors[0].detail : ""))) || ("remove.bg " + r.status)); }
    return await r.blob();
  }
  const cropBlob = (canvas, r, type) => new Promise(res => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(r.x1 - r.x0)); c.height = Math.max(1, Math.round(r.y1 - r.y0)); c.getContext("2d").drawImage(canvas, Math.round(r.x0), Math.round(r.y0), c.width, c.height, 0, 0, c.width, c.height); c.toBlob(res, type || "image/png"); });

  /* تصحيح إملاء النص المقروء من الصورة بمطابقته مع النصوص المقصودة (المقتبسة في البرومبت النهائي) */
  const lev = (a, b) => { const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
  const normT = x => String(x).replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
  function extractIntended(txt) {
    const out = []; String(txt || "").replace(/"([^"]{2,300})"/g, (_, q) => { if (/^\s*\[/.test(q)) return; q.split(/\\n|\n/).forEach(l => { l = l.trim(); if (normT(l).length >= 3) out.push(l); }); return ""; });
    return [...new Set(out)];
  }
  function snapText(t, list) {
    const nt = normT(t); if (!list || !list.length || nt.length < 3) return t; let best = null, bs = 0;
    for (const c of list) { const nc = normT(c); if (!nc) continue; const sc = 1 - lev(nt, nc) / Math.max(nt.length, nc.length); if (sc > bs) { bs = sc; best = c; } }
    return bs >= .62 ? best : t;
  }
  /* دمج الأسطر المتجاورة المتشابهة (الارتفاع/المحاذاة) في كتل نصية */
  /* تنظيف قراءة OCR للعربية: حذف الرموز اللاتينية العشوائية والأسطر التي لا تحوي عربية كافية */
  function cleanArabic(lines) {
    return lines.map(l => { const toks = String(l.text).replace(/[\u200e\u200f]/g, "").split(/\s+/).filter(w => /[\u0600-\u06FF]/.test(w) || /\d{2,}|%/.test(w)); return Object.assign({}, l, { text: toks.join(" ").replace(/[|©®_~<>]+/g, "").replace(/\s+/g, " ").trim() }); })
      .filter(l => {
        const ar = (l.text.match(/[\u0600-\u06FF]/g) || []).length, dig = /\d{3,}/.test(l.text); if (ar < 3 && !dig) return false;
        const bb = l.bbox; if (!bb) return true; const lh = Math.max(1, bb.y1 - bb.y0), expect = (bb.x1 - bb.x0) / (lh * .45);      // عدد الحروف المتوقع لعرض السطر
        return (ar + (l.text.match(/\d/g) || []).length) >= expect * .4;                                                          // نص أقصر بكثير من عرض السطر = قراءة ناقصة/خاطئة فيُترك مرسوماً
      });
  }
  function groupLines(lines, W) {
    const ls = lines.slice().sort((a, b) => a.bbox.y0 - b.bbox.y0), blocks = [];
    ls.forEach(l => { const h = l.bbox.y1 - l.bbox.y0, cx = (l.bbox.x0 + l.bbox.x1) / 2, last = blocks[blocks.length - 1];
      if (last) { const lh = last.y1 - last.lastY0, near = l.bbox.y0 - last.y1 < lh * .9, sim = Math.abs(h - lh) < lh * .22, al = Math.abs(cx - last.cx) < W * .12 || Math.abs(l.bbox.x1 - last.x1) < W * .05; if (near && sim && al) { last.lines.push(l.text); last.x0 = Math.min(last.x0, l.bbox.x0); last.x1 = Math.max(last.x1, l.bbox.x1); last.y1 = l.bbox.y1; last.lastY0 = l.bbox.y0; last.cx = (last.x0 + last.x1) / 2; return; } }
      blocks.push({ lines: [l.text], x0: l.bbox.x0, x1: l.bbox.x1, y0: l.bbox.y0, y1: l.bbox.y1, lastY0: l.bbox.y0, cx, lineH: h }); });
    return blocks;
  }

  /* التحويل الكامل: صورة + حدود ⟵ صفحة (أقسام حرة متناسبة) */
  async function convert(o) {
    const C = o.canvas, W = C.width, dw = o.dw || 720, f = dw / W, bounds = [0].concat(o.cuts.slice().sort((a, b) => a - b), [C.height]);
    const sections = []; const log = o.onProgress || (() => { });
    for (let i = 0; i < bounds.length - 1; i++) {
      const y0 = bounds[i], y1 = bounds[i + 1], h = y1 - y0; if (h < 20) continue;
      log(`القسم ${i + 1} من ${bounds.length - 1}…`);
      const band = document.createElement("canvas"); band.width = W; band.height = h; const ctx = band.getContext("2d", { willReadFrequently: true }); ctx.drawImage(C, 0, y0, W, h, 0, 0, W, h);
      const widgets = [], cuts = [];
      /* مناطق القص (منتج/صور): تُقصّ من الصورة الأصلية قبل أي محو */
      for (const [ri, rg] of (o.regions || []).entries()) {
        const cy = (rg.y0 + rg.y1) / 2; if (cy < y0 || cy >= y1) continue;
        const r = { x0: Math.max(0, rg.x0), x1: Math.min(W, rg.x1), y0: Math.max(0, rg.y0 - y0), y1: Math.min(h, rg.y1 - y0) }; if (r.x1 - r.x0 < 16 || r.y1 - r.y0 < 16) continue;
        log(`قص منطقة ${ri + 1}…`); let blob = await cropBlob(band, r, "image/png"), cut = false;
        if (o.rbKey) { try { blob = await (PBGen.removeBg || removeBgCall)(blob, o.rbKey); cut = true; } catch (e) { log("⚠️ " + e.message + " — قُصّت كصورة عادية"); } }
        cuts.push({ r, blob, cut, a: o.eraseOrig !== false ? analyze(ctx, W, h, r) : null });
      }
      if (o.ocr) {
        let lines = []; try {
          const eng = PBGen.ocr || (o.engine === "gemini" && o.gkey ? (cv => geminiOcr(cv, o.gkey, o.langName || "Arabic")) : defaultOcr);
          lines = await eng(band, o.tess, m => { if (m && m.status && m.progress != null) log(`القسم ${i + 1}: ${m.status} ${Math.round(m.progress * 100)}%`); });
        } catch (e) { log("⚠️ " + e.message); }
        if (/arab|عرب/i.test(String(o.langName || "")) && !PBGen.ocr) lines = cleanArabic(lines);
        if (o.refine !== false) lines = lines.map(l => Object.assign({}, l, { bbox: refineBox(ctx, W, h, l.bbox) }));
        const blocks = groupLines(lines, W).map(b => Object.assign(b, { a: analyze(ctx, W, h, { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }) })).filter(b => b.a);
        const tol = o.inpaint ? 90 : (o.maxErr || (o.engine === "gemini" ? 52 : 38)); blocks.forEach(b => { b.ok = b.a.err < tol && b.a.contrast > (o.inpaint ? 55 : 70); }); o._st = o._st || { ok: 0, kept: 0 }; o._st.ok += blocks.filter(b => b.ok).length; o._st.kept += blocks.filter(b => !b.ok).length;
        // نحلل الألوان قبل المحو (analyze أعلاه)، ثم نمحو كل الكتل المقبولة
        if (o.inpaint) await eraseRects(ctx, blocks.filter(b => b.ok).map(b => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 })), o.gemOpt || {}); else blocks.filter(b => b.ok).forEach(b => erase(ctx, b.a.rect));
        blocks.filter(b => b.ok).forEach((b, k) => {
          if (o.intended && o.intended.length) b.lines = b.lines.map(l => snapText(l, o.intended));
          const bw = b.x1 - b.x0, padX = W * .04, n = b.lines.length, fsImg = Math.max(8, b.lineH * .72), centered = Math.abs(b.cx - W / 2) < W * .1, align = centered ? "center" : (b.cx > W / 2 ? "start" : "end");
          const x0 = Math.max(0, b.x0 - padX), x1 = Math.min(W, b.x1 + padX), type = n === 1 ? "heading" : "text";
          const wdg = PB.mkW(type, type === "heading" ? { text: b.lines[0], tag: "div" } : { html: "<p>" + b.lines.map(esc).join("<br>") + "</p>" });
          Object.assign(wdg.set, { color: b.a.ink, fs: { d: Math.round(fsImg * f) }, fw: "800", lh: { d: 1.3 }, ta: { d: align }, fx: { d: Math.round(x0 / W * 1000) / 10 }, fy: { d: Math.round(b.y0 * f) }, fwd: { d: Math.round((x1 - x0) / W * 1000) / 10 }, fh: { d: Math.max(10, Math.round((b.y1 - b.y0) * f)) }, zi: 2 + k });
          widgets.push(wdg);
        });
      }
      cuts.forEach((c, k) => { if (c.a && c.a.err < (o.maxErr || 34)) erase(ctx, { x0: Math.round(c.r.x0), y0: Math.round(c.r.y0), x1: Math.round(c.r.x1), y1: Math.round(c.r.y1) }); });       // مسح الأصل من الخلفية حيث تسمح بساطتها
      for (const [k, c] of cuts.entries()) {
        const path = await (o.upload ? o.upload(c.blob, "gen-cut-" + Date.now().toString(36) + "-" + i + "-" + k) : new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(c.blob); }));
        const im = PB.mkFree("image", 0, 0, 1); Object.assign(im.set, { src: path, fit: c.cut ? "contain" : "cover", fx: { d: Math.round(c.r.x0 / W * 1000) / 10 }, fy: { d: Math.round(c.r.y0 * f) }, fwd: { d: Math.round((c.r.x1 - c.r.x0) / W * 1000) / 10 }, fh: { d: Math.round((c.r.y1 - c.r.y0) * f) }, zi: 1, alt: "" }); widgets.push(im);
      }
      const blob = await new Promise(r => band.toBlob(r, "image/webp", .92));
      const path = await (o.upload ? o.upload(blob, "gen-" + Date.now().toString(36) + "-" + i) : Promise.resolve(band.toDataURL("image/webp", .9)));
      const bg = PB.mkFree("image", 0, 0, 0); Object.assign(bg.set, { src: path, fit: "fill", fx: { d: 0 }, fy: { d: 0 }, fwd: { d: 100 }, fh: { d: Math.round(h * f) }, zi: 0 });
      const sec = PB.mkCanvas(); Object.assign(sec.set, { scaled: true, dw, layout: "boxed", cw: { d: dw }, mh: { d: Math.round(h * f) } }); sec.free = [bg].concat(widgets); sections.push(sec);
    }
    const page = PB.newPage(o.title || "صفحة هبوط", o.slug || ""); page.sections = sections; page.header = false; page.footer = false; page.bg = "#ffffff";
    page._stats = o._st || { ok: 0, kept: 0 };
    return page;
  }

  /* ───────────── الواجهة داخل تبويب «بناء الصفحات المتقدم» ───────────── */
  const S = { canvas: null, cuts: [], regions: [], file: null, regionMode: false };
  function mount(host) {
    host.innerHTML = `
<div class="card" id="gen-card" style="margin-bottom:1rem">
  <b style="color:var(--green);font-size:1.15rem">✨ توليد صفحة جديدة</b>
  <div class="hint" style="margin:.4rem 0 .6rem">اضبط <b>إعدادات التوليد</b> (المفتاح والجودة) ← أدخل معلومات المنتج ← «توليد الصفحة». بعد النتيجة: <b>✏️ تحرير الصفحة</b> (تُقسَّم إلى أقسام وتُفتح في منشئ الصفحات حيث تجد «أدوات ذكية» لالتقاط النص والعناصر) · <b>⬇ تحميل للجهاز</b> · <b>🗂 حفظ في ملفات المنتج</b> · <b>🔄 إعادة التوليد</b> — مع خيار تقسيم الصفحة قبل التحميل/الحفظ أو أخذها كاملة.</div>
  <div class="gen-step" data-s="1">
  <details id="gen-adv" style="margin:.5rem 0 .8rem;padding:.6rem .8rem;background:#f7faf7;border:1.5px solid #cfe3d3;border-radius:10px"><summary style="cursor:pointer;font-weight:800">⚙️ إعدادات التوليد (المفتاح، الجودة، الهيكل)</summary>
    <div class="grid2" style="margin-top:.4rem">
      <label class="hint" style="margin:0">مفتاح Gemini API (يُحفظ في هذا المتصفح فقط)<input id="gen-gkey1" dir="ltr" placeholder="AIza..." autocomplete="off" spellcheck="false" style="-webkit-text-security:disc"></label>
      <label class="hint" style="margin:0">مستوى التكلفة/الجودة للنصوص<select id="gen-tier" onchange="try{localStorage.setItem('alyssum_gem_tier',this.value)}catch(e){}"><option value="auto">تلقائي (موصى)</option><option value="eco">اقتصادي: Flash-Lite</option><option value="best">أعلى جودة</option></select></label>
    </div>
    <div class="grid2" style="margin-top:.4rem">
      <label class="hint" style="margin:0">لغة السوق<select id="gen-lang">${Object.keys(LANGS).map(k => `<option value="${k}">${LANGS[k].label}</option>`).join("")}</select></label>
      <label class="hint" style="margin:0">نوع العرض<select id="gen-offer"><option value="single">منتج واحد</option><option value="bundle">باك / مجموعة منتجات</option></select></label>
      <label class="hint" style="margin:0">هيكل الصفحة<select id="gen-tpl"><option value="11">قالب 11 قسماً (Anti Acne الناجح — موصى)</option><option value="free">حر (يقرّر Gemini الأقسام)</option></select></label>
      <label class="hint" style="margin:0">نسبة الصورة<select id="gen-ar"><option value="1:4">1:4 — طويل (موصى للصورة الواحدة)</option><option value="1:8">1:8 — أطول جداً (ضيق)</option><option value="9:16">9:16 — طولي</option><option value="2:3">2:3</option><option value="3:4">3:4</option><option value="4:5">4:5</option><option value="1:1">1:1 — مربع</option></select></label>
      <label class="hint" style="margin:0">الدقة<select id="gen-res"><option value="4K">4K — أعلى وضوحاً (موصى للنصوص)</option><option value="2K">2K</option><option value="1K">1K — أسرع وأرخص</option></select></label>
      <label class="hint" style="margin:0">نموذج الصور<select id="gen-imgq"><option value="pro">أعلى جودة نص (Nano Banana Pro) — الأغلى</option><option value="fast">أسرع وأرخص (Flash)</option></select></label>
    </div>
    <label class="hint" style="margin:.4rem 0 0;display:flex;gap:.4rem;align-items:center"><input type="checkbox" id="gen-modest" checked style="width:auto"> مراعاة الحشمة: أي امرأة في الصورة محجّبة بالكامل (يُفضَّل تصوير البشرة عن قرب)</label>
    <button class="small gray" type="button" onclick="PBGen.testKey()" style="margin-top:.3rem">🔑 اختبار المفتاح</button>
  </details>
  <b>معلومات المنتج</b>
  <div class="grid2" style="margin-top:.4rem">
    <label class="hint" style="margin:0">صورة المنتج (إجباري)<input type="file" id="gen-pimg" accept="image/*"></label>
    <label class="hint" style="margin:0">اسم المنتج<input id="gen-name" placeholder="مثال: عسل التركيز وتنشيط الذاكرة"></label>
    <label class="hint" style="margin:0">السعر<input id="gen-price" placeholder="مثال: 2100 دج"></label>
    <label class="hint" style="margin:0">ألوان التصميم (اختياري)<input id="gen-colors" placeholder="مثال: أزرق، برتقالي (وإلا من ألوان المنتج)"></label>
  </div>
  <label class="hint" style="margin:.4rem 0 0">المكونات (تظهر كنقاط قوة في الصفحة)</label>
  <textarea id="gen-ing" rows="2" placeholder="مثال: عسل حر، زبيب، جنكة، ريحان، لوز…"></textarea>
  <label class="hint" style="margin:.4rem 0 0">الوصف والمميزات والفئة المستهدفة</label>
  <textarea id="gen-desc" rows="3" placeholder="الصق وصف منتجك ومميزاته: لمن هو، ما يميّزه، العروض…"></textarea>
  <input id="gen-aud" type="hidden">
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin:.8rem 0 .3rem">
    <button class="small gold" type="button" id="gen-make" onclick="PBGen.generateImage()">🎨 توليد الصفحة</button>
    <button class="small gray" type="button" onclick="PBGen.copyHidden()" title="يجهّز البرومبت ويُنسخ للحافظة دون عرضه، لاستعماله في تطبيق Gemini يدوياً">📋 نسخ البرومبت (دون عرضه)</button>
  </div>
  <label class="hint" style="margin:.4rem 0 0;display:flex;gap:.4rem;align-items:center"><input type="checkbox" id="gen-autoretry" style="width:auto"> إعادة توليد تلقائية مرة واحدة إن وُجدت أخطاء كثيرة في الصورة (تُحتسب كطلب صور إضافي)</label>
  <div id="gen-result" style="display:none;margin-top:.8rem;padding:.8rem;border:1.5px solid #cfe3d3;border-radius:12px;background:#fbfdfb">
    <div style="font-weight:900;color:var(--green)">✅ الصفحة المولّدة</div>
    <div style="max-height:62vh;overflow:auto;border:1.5px solid var(--line);border-radius:10px;margin:.5rem 0;background:#222;text-align:center"><img id="gen-rimg" alt="الصفحة المولّدة" style="max-width:100%;display:block;margin:0 auto"></div>
    <div id="gen-rcheck" class="hint" style="margin:.3rem 0"></div>
    <div style="background:#f7faf7;border:1.5px solid #cfe3d3;border-radius:10px;padding:.55rem .7rem;margin:.4rem 0">
      <div style="font-weight:800;margin-bottom:.3rem">التقسيم (للتحميل والحفظ)</div>
      <label style="display:inline-flex;gap:.3rem;align-items:center;margin-inline-end:1rem"><input type="radio" name="gen-split" value="full" checked style="width:auto"> الصفحة كاملة (صورة واحدة)</label>
      <label style="display:inline-flex;gap:.3rem;align-items:center"><input type="radio" name="gen-split" value="parts" style="width:auto"> مقسّمة إلى <input type="number" id="gen-nparts" min="2" max="30" value="9" style="width:62px" onchange="PBGen.setParts(this.value)"> قسماً</label>
      <small class="hint" style="display:block;margin-top:.25rem">«تحرير الصفحة» يقسّمها دائماً إلى أقسام ليسهل العمل عليها.</small>
    </div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
      <button class="small gold" type="button" id="gen-edit" onclick="PBGen.editPage()" title="يقسّم الصفحة إلى أقسام ويفتحها في منشئ الصفحات حيث الأدوات الذكية">✏️ تحرير الصفحة</button>
      <button class="small gray" type="button" onclick="PBGen.downloadPage()">⬇ تحميل للجهاز</button>
      <button class="small gray" type="button" onclick="PBGen.regen()" title="يُعيد التوليد مع تعليمات لتجنّب الأخطاء المكتشفة">🔄 إعادة التوليد</button>
    </div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-top:.5rem">
      <select id="gen-prod" style="min-width:200px"><option value="">— اختر المنتج لحفظ الصفحة في ملفاته —</option></select>
      <button class="small gray" type="button" id="gen-save" onclick="PBGen.savePage()" title="يرفع الصورة (أو الأقسام) إلى مجلد المنتج assets/img/&lt;المنتج&gt;/landing/">🗂 حفظ في ملفات المنتج</button>
    </div>
    <details style="margin-top:.6rem"><summary style="cursor:pointer;color:#6b7280;font-size:.85rem">خيارات متقدمة</summary>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.4rem"><button class="small gray" type="button" onclick="PBGen.step(2)">ضبط حدود الأقسام والمحرر القديم</button><button class="small gray" type="button" onclick="PBGen.editAdvanced()" title="يفتح محرر التصميم المستقل /editor/">فتح في محرر التصميم المستقل</button><button class="small gray" type="button" onclick="PBGen.downloadOrig()">⬇ تنزيل الأصل</button></div></details>
  </div>
  <div id="gen-automsg" style="font-weight:700;color:var(--green);min-height:1.3em"></div><div id="gen-last" style="margin-top:.4rem"></div><small id="gen-cost" style="color:#8a7a4d"></small>
  <textarea id="gen-out" style="display:none"></textarea><textarea id="gen-final" style="display:none"></textarea><pre id="gen-copy" style="display:none"></pre>
  </div>
  <div class="gen-step" data-s="2" style="display:none">
  <b>② التقسيم والتحرير بمنشئ الصفحات (متقدم)</b> <button class="small gray" type="button" onclick="PBGen.step(1)">→ رجوع للنتيجة</button> <button class="small gold" type="button" onclick="PBGen.downloadOrig()">⬇ تنزيل الصورة الأصلية</button>
  <div id="gen-cuts">
  <div class="card" style="margin:.5rem 0;background:#f7faf7;border:1.5px solid #cfe3d3">
    <b style="color:var(--green)">🧽 ممحاة النصوص (مثل Canva)</b>
    <div class="hint" style="margin:.2rem 0 .5rem">تكتشف النصوص بتحليل الصورة نفسها (بلا مفتاح ولا إنترنت) وتمسحها وتعيد رسم الخلفية بتدرّجها وظلالها. تعمل على كل قسم على حدة ثم تُعيد تركيب الصورة. للنصوص التي فاتتها استعمل الفرشاة أو المستطيل. الصورة الممسوحة تصبح الأصل للتفكيك.</div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
      <button class="small gold" type="button" id="gen-erase-all" onclick="PBGen.eraseAll()">🔎 اكتشف النصوص وامسحها</button>
      <button class="small gray" type="button" id="gen-brush-btn" onclick="PBGen.brushMode()">🖌 فرشاة المسح</button>
      <label class="hint" style="margin:0;display:flex;gap:.3rem;align-items:center">الحجم <input type="range" id="gen-brush" min="10" max="90" value="28" style="width:90px"></label>
      <button class="small gray" type="button" id="gen-erase-btn" onclick="PBGen.eraseMode()">✋ امسح منطقة بالسحب</button>
      <button class="small gray" type="button" id="gen-erase-undo" onclick="PBGen.eraseUndo()" disabled>↶ تراجع</button>
      <button class="small gray" type="button" onclick="PBGen.downloadClean()">⬇ تنزيل الصورة</button>
      <label class="hint" style="margin:0">الكشف <select id="gen-erase-det"><option value="pix">تلقائي بالصورة — بلا مفتاح</option><option value="ocr">بقراءة النص (OCR)</option></select></label>
      <label class="hint" style="margin:0;display:flex;gap:.3rem;align-items:center"><input type="checkbox" id="gen-erase-gem" style="width:auto"> Gemini للمناطق المعقدة (اختياري، يستهلك رصيداً)</label>
    </div>
    <div id="gen-erase-msg" class="hint" style="margin-top:.4rem;min-height:1.2em"></div>
  </div>
  <div class="grid2" style="margin-top:.4rem">
    <label class="hint" style="margin:0">أو ارفع صورة جاهزة بدل التوليد<input type="file" id="gen-file" accept="image/*" onchange="PBGen.onFile(this)"></label>
    <label class="hint" style="margin:0">عدد الأقسام المتوقع<input id="gen-n" type="number" min="1" max="30" value="9" onchange="PBGen.recut()"></label>
    <label class="hint" style="margin:0">عنوان الصفحة<input id="gen-title" placeholder="مثال: عسل التركيز"></label>
  </div>
  <div style="display:none">
  <div class="grid2" style="margin-top:.4rem">
    <label class="hint" style="margin:0">محرك استخراج النصوص<select id="gen-engine" onchange="PBGen.engineUI()"><option value="tess">Tesseract — مجاني داخل المتصفح</option><option value="gemini">Gemini رؤية — أدق للعربية (بمفتاحك)</option></select></label>
    <label class="hint" style="margin:0;display:none" id="gen-gk-wrap">مفتاح Gemini API (يُحفظ في هذا المتصفح فقط)<input id="gen-gkey" dir="ltr" placeholder="AIza..." autocomplete="off" spellcheck="false" style="-webkit-text-security:disc"></label>
    <label class="hint" style="margin:0">مفتاح remove.bg (اختياري — لقص خلفية المنتج/الصور)<input id="gen-rbkey" dir="ltr" placeholder="بدونه: «قص كصورة» مستطيلة" autocomplete="off" spellcheck="false" style="-webkit-text-security:disc"></label>
  </div>
  <div style="margin:.5rem 0;display:flex;gap:.5rem;flex-wrap:wrap;align-items:center"><button class="small gold" type="button" id="gen-detect-btn" onclick="PBGen.detect()" title="يستعمل مفتاح Gemini (طبقة مجانية)">🔍 اكتشاف المنتج والصور تلقائياً</button><button class="small gray" type="button" id="gen-region-btn" onclick="PBGen.regionMode()">✂️ رسم منطقة للقص (منتج/صورة)</button><small class="hint" style="margin:0">اضغط الزر ثم اسحب مستطيلاً حول المنتج أو أي صورة في المعاينة؛ كل منطقة تصير عنصر صورة مستقلاً قابلاً للتحريك. انقر × على المنطقة لحذفها.</small></div>
  </div>
  <div id="gen-prev" style="margin:.6rem 0"></div>
  </div>
  <label class="hint" style="margin:.6rem 0 0;display:flex;gap:.4rem;align-items:center"><input type="checkbox" id="gen-conv" checked style="width:auto"> فكّك النصوص إلى طبقات قابلة للتعديل (تُمسح من الصورة بالممحاة وتُعاد كنص حقيقي) — يلزم مفتاح Gemini للدقة بالعربية</label>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-top:.4rem"><button class="small gold" type="button" id="gen-go" onclick="PBGen.run()" disabled>🚀 إلى المحرر مباشرة</button><small id="gen-msg" style="color:var(--green);font-weight:700"></small></div>
  </div>
  <div class="gen-step" data-s="3" style="display:none">
  <b>③ التحويل إلى صفحة قابلة للتعديل</b>
  <div class="grid2" style="margin-top:.4rem">
    <label class="hint" style="margin:0;display:flex;gap:.4rem;align-items:center"><input type="checkbox" id="gen-ocr" checked style="width:auto"> استخراج النصوص القابلة للتعديل (OCR داخل المتصفح)</label>
    <label class="hint" style="margin:0;display:flex;gap:.4rem;align-items:center"><input type="checkbox" id="gen-erase-orig" checked style="width:auto"> امسح الأصل من الخلفية عند قص عنصر (حيث تكون الخلفية بسيطة)</label>
  </div>
  <textarea id="gen-intended" style="display:none"></textarea>
  <div id="gen-sum" class="hint" style="margin:.6rem 0"></div>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center"></div>
  <div style="display:flex;gap:.5rem;margin-top:.8rem;justify-content:space-between"><button class="small gray" type="button" onclick="PBGen.step(2)">→ السابق</button><span></span></div>
  </div>
</div>`;
    try { $("gen-gkey").value = localStorage.getItem("alyssum_gp_gkey") || ""; $("gen-rbkey").value = localStorage.getItem("alyssum_removebg_key") || ""; } catch (e) { }
    try { $("gen-tier").value = gemTier(); } catch (e) { }
    try { if (!localStorage.getItem("alyssum_gp_gkey")) $("gen-adv").open = true; } catch (e) { }
    try { const gk0 = localStorage.getItem("alyssum_gp_gkey") || ""; $("gen-gkey1").value = gk0; if (gk0) { $("gen-engine").value = "gemini"; engineUI(); } } catch (e) { }
    step(1); showLast();
  }
  /* المعالج: 1 البرومبت ← 2 الصورة والأقسام ← 3 التحويل */
  function step(n) {
    if (n === 3) n = 2;                                   // التحويل إلى نصوص قابلة للتعديل معطّل حالياً (CONV())
    if (n === 2 && !S.canvas) { const m = $("gen-msg"); if (m) m.textContent = "ولّد الصورة أو ارفع صورة جاهزة أولاً"; }
    document.querySelectorAll("#gen-card .gen-step").forEach(el => { el.style.display = Number(el.dataset.s) === n ? "" : "none"; });
    document.querySelectorAll("#gen-card [data-gs]").forEach(b => { b.className = "small " + (Number(b.dataset.gs) === n ? "gold" : "gray"); });
    S.step = n;
    if (n === 2 && S.canvas) drawPreview();
    if (n === 3) { const t = $("gen-title"); if (t && !t.value && S.file) t.value = (S.file.name || "").replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 60); $("gen-sum").innerHTML = S.canvas ? `سيتحول التصميم إلى <b>${S.cuts.length + 1}</b> قسماً${S.regions.length ? " مع <b>" + S.regions.length + "</b> عنصر مقصوص" : ""}. المحرك: <b>${$("gen-engine").value === "gemini" ? "Gemini رؤية" : "Tesseract"}</b>.` : "ارفع الصورة في الخطوة ②."; }
  }
  function engineUI() { $("gen-gk-wrap").style.display = $("gen-engine").value === "gemini" ? "" : "none"; }
  async function detect() {
    if (!S.canvas) return; const msg = $("gen-msg"), key = ($("gen-gkey").value || "").trim() || (function () { try { return localStorage.getItem("alyssum_gp_gkey") || ""; } catch (e) { return ""; } })();
    if (!key) { msg.textContent = "❌ أدخل مفتاح Gemini أولاً (اختر محرك Gemini ثم الصق المفتاح)"; return; }
    msg.textContent = "⏳ Gemini يبحث عن المنتج والصور…"; try { try { localStorage.setItem("alyssum_gp_gkey", key); } catch (e) { }
      const found = await (PBGen.detectFn || geminiDetect)(S.canvas, key), keep = found.filter(r => !S.regions.some(q => { const ix = Math.min(q.x1, r.x1) - Math.max(q.x0, r.x0), iy = Math.min(q.y1, r.y1) - Math.max(q.y0, r.y0); return ix > 0 && iy > 0 && ix * iy > .5 * Math.min((q.x1 - q.x0) * (q.y1 - q.y0), (r.x1 - r.x0) * (r.y1 - r.y0)); }));
      S.regions.push(...keep); drawPreview(); msg.textContent = "✅ أُضيفت " + keep.length + " منطقة — احذف (×) ما لا تريده ثم حوّل"; } catch (err) { msg.textContent = "❌ " + err.message; }
  }
  function regionMode() { S.regionMode = !S.regionMode; const b = $("gen-region-btn"); b.className = "small " + (S.regionMode ? "gold" : "gray"); b.textContent = S.regionMode ? "✂️ وضع القص مفعّل — اسحب على الصورة (انقر للإيقاف)" : "✂️ رسم منطقة للقص (منتج/صورة)"; drawPreview(); }
  function makePrompt() { $("gen-out").value = buildPrompt({ lang: $("gen-lang").value, offer: $("gen-offer").value, name: $("gen-name").value.trim(), desc: $("gen-desc").value.trim(), price: $("gen-price").value.trim(), colors: $("gen-colors").value.trim(), ing: ($("gen-ing") || {}).value ? $("gen-ing").value.trim() : "", aud: ($("gen-aud") || {}).value || "", tpl: ($("gen-tpl") || {}).value || "11" }); }
  /* فحص محلي مجاني لنصوص البرومبت المقتبسة: يحذف التطويل (ـ) والتكرار المتتالي للكلمة ويحذّر من النصوص الطويلة */
  function localFix(txt) {
    const issues = []; const out = String(txt).replace(/"([^"\n]{2,400})"/g, (m, q) => {
      if (/^\s*\[/.test(q)) return m; let r = q.replace(/\u0640/g, ""); if (r !== q) issues.push("تطويل: " + q.slice(0, 24));
      const r2 = r.replace(/(^|[\s،,.:؛!؟?\n])([^\s،,.:؛!؟?]{2,})(\s+)\2(?=$|[\s،,.:؛!؟?])/gu, (mm, pre, w) => { issues.push("تكرار: " + w); return pre + w; });
      r = r2.replace(/[\u064C-\u0652]/g, ""); if (r.split(/\s+/).length > 12) issues.push("نص طويل: " + r.slice(0, 24));
      return '"' + r + '"'; });
    return { text: out, issues };
  }
  /* تدقيق إملائي ولغوي بـ Gemini على النصوص المقتبسة فقط (يمسح التكرار والأخطاء) */
  async function proofread() {
    const msg = $("gen-automsg"), cur = $("gen-final").value; if (!cur.trim()) { msg.textContent = "❌ لا يوجد برومبت نهائي للتدقيق"; return; }
    const key = ($("gen-gkey1").value || "").trim() || (function () { try { return localStorage.getItem("alyssum_gp_gkey") || ""; } catch (e) { return ""; } })(); if (!key) { msg.textContent = "❌ أدخل مفتاح Gemini أولاً"; return; }
    const L = LANGS[$("gen-lang").value] || LANGS.ar; msg.textContent = "⏳ تدقيق إملائي ولغوي…";
    try {
      const ask = `You are a meticulous ${L.name} proofreader and copy editor. Below is an image-generation prompt. Every text inside double quotes " " will be rendered literally inside an image. Fix ONLY the quoted strings: (1) any spelling or grammar mistake, (2) any repeated word or phrase (consecutive repeats like "X X", the same content word appearing twice inside one string, and the same or near-identical sentence reused in different sections — rewrite so every string is unique), (3) letter elongation/kashida/tatweel, (4) diacritics, (5) strings longer than 8 words (shorten them), (6) wrong or unnatural words (use simple standard everyday ${L.name}). Keep the meaning and the persuasive tone. Do NOT touch anything outside the quotes and do NOT remove sections. Return the COMPLETE corrected prompt inside ONE code block, then after the block write a short Arabic bullet list of the corrections you made (or "لا توجد أخطاء").\n\n${cur}`;
      const t = await (PBGen.textFn || geminiText)(key, ask, null, null, "proof"), blocks = []; t.replace(/```[a-zA-Z]*\n([\s\S]*?)```/g, (_, c) => { blocks.push(c.trim()); return ""; });
      if (!blocks.length) throw new Error("لم يُرجع Gemini نصاً مصحّحاً"); const fx = localFix(blocks.join("\n\n"));
      $("gen-final").value = fx.text; $("gen-intended").value = fx.text; $("gen-copy").textContent = (($("gen-copy").textContent || "") + "\n\n— التدقيق —\n" + t.replace(/```[a-zA-Z]*\n[\s\S]*?```/g, "").trim()).trim();
      msg.textContent = "✅ تم التدقيق" + (fx.issues.length ? " (وإصلاح محلي لـ " + fx.issues.length + ")" : "");
    } catch (err) { msg.textContent = "❌ " + err.message; }
  }
  const keyNow = () => { const k = ($("gen-gkey1").value || "").trim() || (function () { try { return localStorage.getItem("alyssum_gp_gkey") || ""; } catch (e) { return ""; } })(); if (k) { try { localStorage.setItem("alyssum_gp_gkey", k); $("gen-gkey").value = k; } catch (e) { } } return k; };
  const small64 = async (file, max) => { const c = await loadImage(file), k = Math.min(1, max / Math.max(c.width, c.height)), c2 = document.createElement("canvas"); c2.width = Math.round(c.width * k); c2.height = Math.round(c.height * k); c2.getContext("2d").drawImage(c, 0, 0, c2.width, c2.height); return c2.toDataURL("image/jpeg", .9).split(",")[1]; };
  /* كتلة قواعد ثابتة تُضاف أول البرومبت النهائي دائماً (دقة النص، عدم تكرار، حشمة، حماية العبوة) */
  function rulesBlock() {
    const L = LANGS[$("gen-lang").value] || LANGS.ar, modest = !$("gen-modest") || $("gen-modest").checked;
    return `IMPORTANT: The uploaded product image is the ONLY packaging reference. Preserve the exact product container, cap, label, logo, proportions, colors and printed wording exactly as shown in the reference image. Do NOT redesign the packaging, do NOT invent another product, do NOT change the brand name, do NOT create additional products.

==================================================
ABSOLUTE ${L.name.toUpperCase()} TEXT ACCURACY RULES
==================================================
${L.name} typography accuracy is the highest priority. Every quoted ${L.name} string in this prompt must appear EXACTLY ONCE, copied LETTER BY LETTER. Do not rewrite, paraphrase, correct, duplicate, repeat or merge strings; do not split words incorrectly; do not add decorative letters, diacritics or extra words. Never create fake text, fake labels, fake ingredient names, fake reviews, fake logos or random characters. If there is not enough space for a line, make the font smaller while keeping it clearly readable — NEVER repeat a sentence to fill space. There must be ZERO random text anywhere; only the exact quoted strings may appear as overlay text. ${L.rtl ? "All text is RIGHT-TO-LEFT with no mirrored, reversed or duplicated letters; use a highly accurate modern Arabic display font, extremely bold, sharp, clean and professional." : "Use a clean, highly accurate, bold modern display font."} Every quoted string is a separate text element with its own dedicated empty space; leave generous negative space around it and never put several paragraphs into one block.

==================================================
TYPOGRAPHY CONSISTENCY
==================================================
Use ONE single consistent typeface family for ALL headlines and texts in the whole image (a modern geometric bold sans display font in the style of Cairo / Tajawal ExtraBold). Do NOT mix or change typefaces between sections; only the size and color may vary. The printed lettering on the product label must stay exactly as in the reference photo.
${modest ? `
==================================================
MODESTY AND HUMAN FIGURES
==================================================
ABSOLUTELY NO WOMAN WITHOUT HIJAB. If a woman appears she MUST be a modest Muslim woman wearing a clearly visible elegant hijab that completely covers her hair, with covered shoulders and neckline and modest clothing. No visible female hair, no revealing clothing. Prefer macro skin photography, hands, or product-only compositions; avoid uncovered faces.
` : ""}
==================================================
FINAL TEXT SAFETY CHECK
==================================================
Before rendering, internally verify every text element: no duplicated sentences, words or letters; no random characters; no invented captions; no repeated headlines or product names. Every sentence is rendered once, exactly as written. NO HTML, NO CSS, NO code, NO UI, NO browser interface, NO extra text, NO fake text.`;
  }
  /* مرحلة خفية: يكتب Gemini النصوص التسويقية والبرومبت النهائي، ثم يُدقَّق ويُخزَّن (لا يُعرض) */
  async function makeFinal(key) {
    const msg = $("gen-automsg"); makePrompt(); msg.textContent = "⏳ (1/5) Gemini يكتب نصوصاً تسويقية قوية…";
    const f = $("gen-pimg").files && $("gen-pimg").files[0], b64 = f ? await small64(f, 1400) : null;
    const t = await (PBGen.textFn || geminiText)(key, $("gen-out").value, b64, "image/jpeg", "copy"), blocks = []; t.replace(/```[a-zA-Z]*\n([\s\S]*?)```/g, (_, c) => { blocks.push(c.trim()); return ""; });
    if (!blocks.length) throw new Error("لم يُرجع Gemini تصميماً جاهزاً — أعد المحاولة");
    const fx = localFix(blocks.join("\n\n")); $("gen-final").value = fx.text; $("gen-copy").textContent = t.replace(/```[a-zA-Z]*\n[\s\S]*?```/g, "").trim(); $("gen-intended").value = fx.text;
    msg.textContent = "⏳ (2/5) تدقيق إملائي وتكرار…"; try { await proofread(); } catch (e) { }
    const full = rulesBlock() + "\n\n" + $("gen-final").value; $("gen-final").value = full; S.finalPrompt = full; return S.finalPrompt;
  }
  async function auto() { const msg = $("gen-automsg"), key = keyNow(); if (!key) { { msg.textContent = "❌ أدخل مفتاح Gemini أولاً (إعدادات متقدمة)"; const ad = $("gen-adv"); if (ad) ad.open = true; } return; } try { await makeFinal(key); msg.textContent = "✅ جاهز"; } catch (err) { msg.textContent = "❌ " + err.message; } }
  /* نسخ البرومبت للحافظة دون عرضه */
  async function copyHidden() {
    const msg = $("gen-automsg"); try {
      if (!S.finalPrompt) { const key = keyNow(); if (!key) { { msg.textContent = "❌ أدخل مفتاح Gemini أولاً (إعدادات متقدمة)"; const ad = $("gen-adv"); if (ad) ad.open = true; } return; } await makeFinal(key); }
      await navigator.clipboard.writeText(S.finalPrompt); msg.textContent = "✅ نُسخ البرومبت للحافظة — الصقه في Gemini مع صورة المنتج"; toast("✅ نُسخ البرومبت");
    } catch (e) { msg.innerHTML = '✅ البرومبت جاهز — <button class="small gold" type="button" onclick="PBGen.copyFinal()">اضغط هنا للنسخ</button>'; }
  }
  /* نماذج الصور المتاحة */
  async function imageModels(key) {
    const fast = ($("gen-imgq") || {}).value === "fast", pref = fast ? ["gemini-3.1-flash-image", "gemini-3.1-flash-lite-image", "gemini-2.5-flash-image", "gemini-3-pro-image-preview"] : ["gemini-3-pro-image-preview", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image", "gemini-2.5-flash-image"]; await gemModels(key, "copy"); const names = (_gemCache && _gemCache.key === key && _gemCache.names) || [];
    const pick = pref.filter(m => names.includes(m)), any = names.filter(n => /image/i.test(n) && !pick.includes(n)); const list = pick.concat(any).slice(0, 3); return list.length ? list : pref.slice(0, 3);
  }
  /* صورة واحدة طويلة: نجرّب النسب الأطول أولاً ثم نتراجع إن لم يدعمها النموذج */
  /* قياسات الصورة (مثل واجهة Pro): النسبة + الدقة + عدد الأجزاء */
  const imgCfg = () => ({ ar: ($("gen-ar") || {}).value || "9:16", size: ($("gen-res") || {}).value || "2K" });
  /* جودة عالية: ثلاثة أجزاء 9:16 (عرض أكبر ← نصوص أوضح بكثير من صورة 1:8 الضيقة) ثم لصقها */
  const RATIOS = ["1:8", "1:4", "9:16"];
  async function genLong(key, prompt, productB64) {
    const parts = [{ text: prompt }]; if (productB64) parts.push({ inline_data: { mime_type: "image/jpeg", data: productB64 } });
    const models = await imageModels(key); let lastErr = null;
    const ic = imgCfg(), tries = []; [ic.ar === "9:16" ? "1:4" : ic.ar].concat(["1:4", "1:8", "9:16"]).filter((v, i, a) => a.indexOf(v) === i).forEach(ar => { tries.push({ aspectRatio: ar, imageSize: ic.size }); if (ic.size !== "2K") tries.push({ aspectRatio: ar, imageSize: "2K" }); tries.push({ aspectRatio: ar }); });   // النسبة المختارة أولاً ثم التراجع
    for (const cfg of tries) {
      try {
        const j = await gemGenerate(key, "image", parts, { imageConfig: cfg }, models), pt = ((((j.candidates || [])[0] || {}).content || {}).parts || []).find(x => x.inlineData || x.inline_data), d = pt && (pt.inlineData || pt.inline_data);
        if (!d) throw new Error("لم يُرجع النموذج صورة");
        const bin = atob(d.data), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); S.ratio = cfg.aspectRatio; S.size = cfg.imageSize || ""; return new Blob([arr], { type: d.mimeType || d.mime_type || "image/png" });
      } catch (e) { lastErr = e; if (!/\[400|aspect|ratio|size|invalid.argument|لم يُرجع النموذج صورة/i.test(String(e.message))) throw e; }
    }
    throw lastErr || new Error("تعذّر توليد الصورة");
  }
  /* فحص الصورة المولّدة: Gemini يقرأ النصوص ← نقارنها بالنصوص المقصودة ونكشف التكرار */
  async function checkImage() {
    const box = $("gen-rcheck"), key = keyNow(); if (!box || !S.canvas) return; S.issues = [];
    if (!key) { box.textContent = "أدخل مفتاح Gemini لفحص النصوص تلقائياً."; return; }
    try {
      const L = LANGS[$("gen-lang").value] || LANGS.ar, lines = await (PBGen.ocrFn || geminiOcr)(S.canvas, key, L.name), want = extractIntended(S.finalPrompt || ""), seen = new Set(), issues = [];
      lines.forEach(l => {
        const t = l.text, nt = normT(t); if (nt.length < 3) return;
        const toks = t.split(/\s+/); for (let i = 1; i < toks.length; i++) if (toks[i] === toks[i - 1] && toks[i].length > 1) issues.push("كلمة مكرّرة: «" + t + "»");
        let best = null, bs = 0; for (const w of want) { const nw = normT(w); if (!nw) continue; const sc = 1 - lev(nt, nw) / Math.max(nt.length, nw.length); if (sc > bs) { bs = sc; best = w; } }
        if (best && bs >= .6 && bs < 1) issues.push("مكتوب: «" + t + "» ← المقصود: «" + best.replace(/^[^\p{L}\p{N}]+/u, "") + "»");
        if (seen.has(nt)) issues.push("سطر مكرّر في الصورة: «" + t + "»"); seen.add(nt);
      });
      S.issues = [...new Set(issues)].slice(0, 14);
      box.innerHTML = S.issues.length ? "⚠️ وجدت " + S.issues.length + " ملاحظة محتملة (قد تكون قراءة خاطئة من الفاحص):<ul style='margin:.3rem 1rem;line-height:1.9'>" + S.issues.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>إن كانت كثيرة اضغط «أعد التوليد»، وإلا اعتمد الصورة وصحّح النص في المحرر." : "✅ لم أجد أخطاء إملائية أو تكراراً واضحاً في النصوص المقروءة.";
    } catch (err) { box.textContent = "تعذّر الفحص التلقائي: " + err.message; }
  }
  async function autoRetry() { if ($("gen-autoretry") && $("gen-autoretry").checked && !S.retried && (S.issues || []).length >= 3) { S.retried = true; $("gen-rcheck").textContent += " — إعادة توليد تلقائية…"; await regen(); } }
  function approve() { S.reviewed = true; step(2); }
  function regen() { S.avoid = (S.issues || []).length ? S.issues.join(" | ") : ""; return generateImage(true); }
  /* الدالة الرئيسية: نصوص تسويقية ← أجزاء الصورة ← لصق ← معاينة الأقسام */
  async function generateImage(isRegen) {
    if (isRegen !== true) S.retried = false;
    const msg = $("gen-automsg"), btn = $("gen-make"), key = keyNow(), pf = $("gen-pimg").files && $("gen-pimg").files[0];
    if (!key) { { msg.textContent = "❌ أدخل مفتاح Gemini أولاً (إعدادات متقدمة)"; const ad = $("gen-adv"); if (ad) ad.open = true; } return; }
    if (!pf) { msg.textContent = "❌ ارفع صورة المنتج أولاً"; return; }
    if (!$("gen-name").value.trim() && !$("gen-desc").value.trim() && !($("gen-ing").value || "").trim()) { msg.textContent = "❌ اكتب اسم المنتج أو وصفه أو مكوناته"; return; }
    btn.disabled = true;
    try {
      const fp = await makeFinal(key), pb = await small64(pf, 1400);
            const full = fp + (S.avoid ? "\n\n=== CORRECTIONS REQUIRED ===\nThe previous attempt contained these text errors. Fix them: write every quoted string EXACTLY as given, never repeat words, no extra text: " + S.avoid : "");
      let blob, canvas;
      msg.textContent = "🎨 توليد الصورة…"; blob = await (PBGen.imgFn || genLong)(key, full, pb); canvas = await loadImage(blob);
      S.reviewed = false; S.generated = true; S.avoid = ""; S.savedPath = null; S.blob = blob; S.name = $("gen-name").value.trim() || "landing"; saveLast(blob, S.name); saveOriginalToSite(blob, S.name);
      await setCanvas(canvas, $("gen-name").value.trim() || "صفحة هبوط"); S.generated = true; showLast(); showResult(); checkImage().then(autoRetry); msg.textContent = "✅ تمّت الصفحة (محفوظة تلقائياً)" + (S.model ? " بنموذج " + S.model : "") + " (" + canvas.width + "×" + canvas.height + ")" + "";
    } catch (err) { msg.textContent = "❌ " + err.message; } finally { btn.disabled = false; }
  }
  function copyFinal() { const t = $("gen-final").value; if (!t) return toast("أنتج البرومبت النهائي أولاً"); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast("✅ نُسخ البرومبت النهائي"), () => { $("gen-final").select(); document.execCommand("copy"); toast("✅ نُسخ"); }); }
  function copyPrompt() { if (!$("gen-out").value) makePrompt(); const t = $("gen-out").value; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast("✅ نُسخ البرومبت"), () => { $("gen-out").select(); document.execCommand("copy"); toast("✅ نُسخ البرومبت"); }); }
  /* حفظ آخر صورة مولّدة في IndexedDB (لا تضيع إن أُغلقت الصفحة) + تنزيلها */
  const idb = (mode, fn) => new Promise((res, rej) => { try { const rq = indexedDB.open("pbgen", 1); rq.onupgradeneeded = () => rq.result.createObjectStore("kv"); rq.onerror = () => rej(rq.error); rq.onsuccess = () => { const db = rq.result, tx = db.transaction("kv", mode), r = fn(tx.objectStore("kv")); tx.oncomplete = () => { res(r && r.result); db.close(); }; tx.onerror = () => rej(tx.error); }; } catch (e) { rej(e); } });
  const saveLast = (blob, name) => idb("readwrite", st => st.put({ blob, name, t: Date.now() }, "last")).catch(() => { });
  const loadLast = () => idb("readonly", st => st.get("last")).catch(() => null);
  /* حفظ تلقائي للصورة المولّدة في مكتبة الموقع (assets/img/pages) فلا تضيع حتى لو تغيّر المتصفح */
  async function saveOriginalToSite(blob, name) {
    try {
      if (typeof PBApp === "undefined" || !PBApp.uploadBlob) return; const path = await PBApp.uploadBlob(blob, "orig-" + Date.now().toString(36), { max: 3200, q: .92 });
      S.savedPath = path; const el = $("gen-automsg"); if (el) el.dataset.saved = path; toast("💾 حُفظت الصورة تلقائياً في مكتبة الصور: " + path); const rec = await loadLast(); if (rec) idb("readwrite", st => st.put(Object.assign(rec, { path }), "last")).catch(() => { });
    } catch (e) { }
  }
  function downloadOrig() {
    const b = S.blob; if (!b) return toast("لا توجد صورة بعد");
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "landing-original-" + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "") + "." + (/jpe?g/.test(b.type) ? "jpg" : /webp/.test(b.type) ? "webp" : "png"); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  async function showLast() {
    const el = $("gen-last"); if (!el) return; const r = await loadLast();
    if (!r || !r.blob) { el.innerHTML = ""; return; }
    el.innerHTML = `<div style="background:#faf6ec;border:1.5px solid #eadfc4;border-radius:10px;padding:.5rem .7rem;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap"><span>🕘 آخر صورة مولّدة: <b>${PB.esc(r.name || "")}</b> · ${new Date(r.t).toLocaleString("ar-DZ")}</span><button class="small gold" type="button" onclick="PBGen.restoreLast()">استعادة</button><button class="small gray" type="button" onclick="PBGen.downloadLast()">⬇ تنزيل الأصل</button></div>`;
  }
  async function restoreLast() { const r = await loadLast(); if (!r || !r.blob) return; S.generated = false; S.reviewed = true; S.blob = r.blob; S.name = r.name; const cv = await loadImage(r.blob); await setCanvas(cv, r.name); showResult(); }
  async function downloadLast() { const r = await loadLast(); if (!r || !r.blob) return; S.blob = r.blob; S.name = r.name; downloadOrig(); }
  async function setCanvas(canvas, title) {
    S.canvas = canvas; S.regions = []; if (!S.generated || S.reviewed !== false) S.reviewed = true; $("gen-msg").textContent = ""; recut(); $("gen-go").disabled = false; if (!$("gen-title").value) $("gen-title").value = title || "";
  }
  async function onFile(inp) {
    const f = inp.files && inp.files[0]; if (!f) return; S.file = f; S.blob = f; S.generated = false; S.reviewed = true; S.name = f.name.replace(/\.[^.]+$/, ""); $("gen-msg").textContent = "⏳ جارِ قراءة الصورة…";
    let cv; try { cv = await loadImage(f); } catch (e) { $("gen-msg").textContent = "❌ " + e.message; return; }
    await setCanvas(cv, $("gen-name").value || f.name.replace(/\.[^.]+$/, "")); showResult();
  }

  function recut() { if (!S.canvas) return; S.cuts = suggestCuts(S.canvas, Number($("gen-n").value) || 9); drawPreview(); }
  function drawPreview() {
    const C = S.canvas, host = $("gen-prev"), pw = Math.min(520, Math.max(300, (host.parentNode.clientWidth || 600) - 40)), sc = pw / C.width, ph = C.height * sc, rm = S.regionMode;
    host.innerHTML = `<div class="hint" style="margin:0 0 .3rem">${rm ? "وضع القص: اسحب مستطيلاً حول المنتج/الصورة (" + S.regions.length + " منطقة)" : "اسحب الخطوط الحمراء لضبط حدود الأقسام · انقر على الصورة لإضافة حد · انقر مرتين على خط لحذفه (" + (S.cuts.length + 1) + " أقسام)"}</div><div style="max-height:78vh;overflow:auto;border:1.5px solid var(--line);border-radius:8px;width:${pw + 18}px;max-width:100%"><div id="gen-box" style="position:relative;width:${pw}px;height:${ph}px;cursor:crosshair;background:#eee"><img src="${C.toDataURL("image/jpeg", .6)}" style="width:100%;height:100%;display:block;pointer-events:none;user-select:none">${S.cuts.map((y, k) => `<div data-cut="${k}" title="اسحب · انقر مرتين للحذف" style="position:absolute;left:0;right:0;top:${y * sc - 4}px;height:9px;cursor:ns-resize;${rm ? "pointer-events:none;opacity:.5" : ""}"><i style="display:block;height:2px;margin-top:3.5px;background:#e91e3e"></i></div>`).join("")}${S.regions.map((r, k) => `<div style="position:absolute;left:${r.x0 * sc}px;top:${r.y0 * sc}px;width:${(r.x1 - r.x0) * sc}px;height:${(r.y1 - r.y0) * sc}px;border:2px dashed #16a34a;background:rgba(22,163,74,.12)"><b data-delreg="${k}" style="position:absolute;top:-1px;right:-1px;background:#16a34a;color:#fff;padding:0 .35rem;cursor:pointer;font-size:.8rem">×</b></div>`).join("")}</div></div>`;
    const box = $("gen-box");
    box.onclick = e => { const dr = e.target.closest("[data-delreg]"); if (dr) { S.regions.splice(Number(dr.dataset.delreg), 1); drawPreview(); return; } if (rm || e.target.closest("[data-cut]")) return; const y = Math.round((e.clientY - box.getBoundingClientRect().top) / sc); S.cuts.push(y); S.cuts.sort((a, b) => a - b); drawPreview(); };
    box.ondblclick = e => { const c = e.target.closest("[data-cut]"); if (c && !rm) { S.cuts.splice(Number(c.dataset.cut), 1); drawPreview(); } };
    box.onmousedown = e => {
      const r0 = box.getBoundingClientRect();
      if (S.brushMode) { e.preventDefault(); const rad = Math.max(2, (Number(($("gen-brush") || {}).value) || 24) / 2 / sc), pts = [], ov = document.createElement("canvas"); ov.width = box.clientWidth; ov.height = box.clientHeight; ov.style.cssText = "position:absolute;left:0;top:0;pointer-events:none"; box.appendChild(ov); const og = ov.getContext("2d"); og.fillStyle = "rgba(220,38,38,.4)";
        const add = ev => { const x = ev.clientX - r0.left, y = ev.clientY - r0.top; pts.push([x / sc, y / sc]); og.beginPath(); og.arc(x, y, rad * sc, 0, 7); og.fill(); };
        add(e); const mv = ev => add(ev), up = async () => { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); ov.remove(); pushUndo(); const n = eraseBrush(S.canvas.getContext("2d", { willReadFrequently: true }), pts, rad); drawPreview(); eMsg(n ? "✅ مُسحت المنطقة المرسومة" : "لم يتغير شيء"); };
        document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up); return; }
      if (S.eraseMode) { e.preventDefault(); const sx = e.clientX, sy = e.clientY, el = document.createElement("div"); el.style.cssText = "position:absolute;border:2px dashed #dc2626;background:rgba(220,38,38,.12);pointer-events:none"; box.appendChild(el);
        const mv = ev => { el.style.cssText += `;left:${Math.min(sx, ev.clientX) - r0.left}px;top:${Math.min(sy, ev.clientY) - r0.top}px;width:${Math.abs(ev.clientX - sx)}px;height:${Math.abs(ev.clientY - sy)}px`; };
        const up = ev => { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); el.remove(); const a = { x0: (Math.min(sx, ev.clientX) - r0.left) / sc, x1: (Math.max(sx, ev.clientX) - r0.left) / sc, y0: (Math.min(sy, ev.clientY) - r0.top) / sc, y1: (Math.max(sy, ev.clientY) - r0.top) / sc }; if ((a.x1 - a.x0) * sc > 8 && (a.y1 - a.y0) * sc > 8) eraseDrag(a); };
        document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up); return; }
      if (rm) { if (e.target.closest("[data-delreg]")) return; e.preventDefault(); const sx = e.clientX, sy = e.clientY, el = document.createElement("div"); el.style.cssText = "position:absolute;border:2px dashed #16a34a;background:rgba(22,163,74,.15);pointer-events:none"; box.appendChild(el);
        const mv = ev => { const x0 = Math.min(sx, ev.clientX) - r0.left, y0 = Math.min(sy, ev.clientY) - r0.top, w = Math.abs(ev.clientX - sx), h = Math.abs(ev.clientY - sy); el.style.cssText += `;left:${x0}px;top:${y0}px;width:${w}px;height:${h}px`; };
        const up = ev => { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); el.remove(); const a = { x0: (Math.min(sx, ev.clientX) - r0.left) / sc, x1: (Math.max(sx, ev.clientX) - r0.left) / sc, y0: (Math.min(sy, ev.clientY) - r0.top) / sc, y1: (Math.max(sy, ev.clientY) - r0.top) / sc };
          if ((a.x1 - a.x0) * sc > 12 && (a.y1 - a.y0) * sc > 12) S.regions.push({ x0: Math.max(0, a.x0), x1: Math.min(C.width, a.x1), y0: Math.max(0, a.y0), y1: Math.min(C.height, a.y1) }); drawPreview(); };
        document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up); return; }
      const c = e.target.closest("[data-cut]"); if (!c) return; e.preventDefault(); const i = Number(c.dataset.cut);
      const mv = ev => { const y = Math.max(10, Math.min(C.height - 10, Math.round((ev.clientY - r0.top) / sc))); S.cuts[i] = y; c.style.top = (y * sc - 4) + "px"; }, up = () => { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); S.cuts.sort((a, b) => a - b); drawPreview(); };
      document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up);
    };
  }
  /* تدرّج رأسي من لون حواف الصورة (يمين/يسار) ليكون خلفية الصفحة خلف الصورة العريضة */
  function edgeGradient(cv) {
    try { const n = 40, W = cv.width, H = cv.height, g = cv.getContext("2d", { willReadFrequently: true }), stops = [];
      for (let i = 0; i < n; i++) { const y = Math.min(H - 1, Math.round((i + .5) * H / n)), a = g.getImageData(0, y, 4, 1).data, b = g.getImageData(W - 4, y, 4, 1).data; let r = 0, gg = 0, bb = 0; for (let k = 0; k < 4; k++) { r += a[k * 4] + b[k * 4]; gg += a[k * 4 + 1] + b[k * 4 + 1]; bb += a[k * 4 + 2] + b[k * 4 + 2]; } stops.push(`rgb(${Math.round(r / 8)},${Math.round(gg / 8)},${Math.round(bb / 8)}) ${Math.round(i * 100 / (n - 1))}%`); }
      return `\n.pb-page{background:linear-gradient(180deg,${stops.join(",")})}`; } catch (e) { return ""; }
  }
  /* ───── أداة الممحاة في الواجهة ───── */
  const eMsg = t => { const e = $("gen-erase-msg"); if (e) e.textContent = t; };
  const gKey = () => { const a = $("gen-gkey") && $("gen-gkey").value.replace(/[\s"']/g, ""); if (a) return a; const b = $("gen-gkey1") && $("gen-gkey1").value.replace(/[\s"']/g, ""); if (b) return b; try { return localStorage.getItem("alyssum_gp_gkey") || ""; } catch (e) { return ""; } };
  function pushUndo() { const c = document.createElement("canvas"); c.width = S.canvas.width; c.height = S.canvas.height; c.getContext("2d").drawImage(S.canvas, 0, 0); (S.undo = S.undo || []).push(c); if (S.undo.length > 5) S.undo.shift(); const u = $("gen-erase-undo"); if (u) u.disabled = false; }
  function geminiOpt() { const k = gKey(); return $("gen-erase-gem") && $("gen-erase-gem").checked && k ? { gemini: (ctx, P, m2, v) => (PBGen.geminiErase || ((cx, Pp, m, vv) => geminiEraseRegion(k, cx, Pp, m, vv)))(ctx, P, m2, v) } : {}; }
  async function ocrLines(band, L, key, log) {
    const eng = PBGen.ocr || (key && ($("gen-engine").value === "gemini" || !$("gen-engine").value) ? (cv => geminiOcr(cv, key, L.name)) : defaultOcr);
    let lines = await eng(band, L.tess, log); if (/arab|عرب/i.test(L.name) && !PBGen.ocr) lines = cleanArabic(lines); return lines;
  }
  async function eraseAll() {
    if (!S.canvas) return eMsg("ولّد صورة أو ارفعها أولاً"); const btn = $("gen-erase-all"); btn.disabled = true;
    try {
      const L = LANGS[$("gen-lang").value] || LANGS.ar, key = gKey(), C = S.canvas, W = C.width, bounds = [0].concat(S.cuts.slice().sort((a, b) => a - b), [C.height]); pushUndo();
      let total = 0, cplx = 0; const opt = geminiOpt();
      for (let i = 0; i < bounds.length - 1; i++) {
        const y0 = bounds[i], h = bounds[i + 1] - y0; if (h < 20) continue; eMsg(`⏳ القسم ${i + 1} من ${bounds.length - 1}: قراءة النصوص…`);
        const band = document.createElement("canvas"); band.width = W; band.height = h; const g = band.getContext("2d", { willReadFrequently: true }); g.drawImage(C, 0, y0, W, h, 0, 0, W, h);
        const det = ($("gen-erase-det") || {}).value || "pix"; let rects = [];
        if (det === "pix") rects = detectText(band);                                   // بلا مفتاح ولا OCR: كشف بالصورة فقط
        else { let lines = []; try { lines = await ocrLines(band, L, key, null); } catch (e) { eMsg("⚠️ " + e.message); } rects = lines.map(l => refineBox(g, W, h, l.bbox)); }
        rects = rects.filter(r => !S.regions.some(q => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 + y0 < q.y1 && r.y1 + y0 > q.y0));      // لا نمسح داخل مناطق المنتج المقصوصة
        eMsg(`⏳ القسم ${i + 1}: مسح ${rects.length} سطراً…`); const st = await eraseRects(g, rects, Object.assign({ skipComplex: !opt.gemini }, opt)); total += st.filter(x => x.masked).length; cplx += st.filter(x => x.skipped || (x.complex && !x.gemini)).length;
        C.getContext("2d").drawImage(band, 0, y0);
      }
      drawPreview(); eMsg(`✅ مُسح ${total} سطراً` + (cplx ? ` — تُركت ${cplx} مناطق على صور/ملمس (مثل كتابة عبوة المنتج)؛ امسحها بالفرشاة إن أردت` : "") + " · يمكنك التراجع.");
    } catch (e) { console.error(e); eMsg("❌ " + e.message); }
    btn.disabled = false;
  }
  function brushMode() { S.brushMode = !S.brushMode; S.eraseMode = false; S.regionMode = false; const b = $("gen-brush-btn"); b.className = "small " + (S.brushMode ? "gold" : "gray"); b.textContent = S.brushMode ? "🖌 الفرشاة مفعّلة — ارسم فوق ما تريد مسحه (انقر للإيقاف)" : "🖌 فرشاة المسح"; const e = $("gen-erase-btn"); e.className = "small gray"; e.textContent = "✋ امسح منطقة بالسحب"; drawPreview(); }
  function eraseMode() { S.eraseMode = !S.eraseMode; S.brushMode = false; S.regionMode = false; const bb = $("gen-brush-btn"); if (bb) { bb.className = "small gray"; bb.textContent = "🖌 فرشاة المسح"; } const b = $("gen-erase-btn"); b.className = "small " + (S.eraseMode ? "gold" : "gray"); b.textContent = S.eraseMode ? "✋ وضع المسح مفعّل — اسحب مستطيلاً (انقر للإيقاف)" : "✋ امسح منطقة بالسحب"; drawPreview(); }
  function eraseUndo() { const c = (S.undo || []).pop(); if (!c) return; S.canvas.width = c.width; S.canvas.height = c.height; S.canvas.getContext("2d").drawImage(c, 0, 0); if (!S.undo.length) $("gen-erase-undo").disabled = true; drawPreview(); eMsg("↶ تم التراجع"); }
  async function eraseDrag(a) {
    pushUndo(); eMsg("⏳ جارِ المسح…"); const g = S.canvas.getContext("2d", { willReadFrequently: true }), st = await eraseRects(g, [a], geminiOpt()); drawPreview();
    eMsg(st[0] && st[0].masked ? "✅ مُسح — " + (st[0].complex && !st[0].gemini ? "الخلفية معقدة قد تبقى آثار (جرّب Gemini)" : "تم") : "لم أجد نصاً واضحاً داخل المنطقة (اجعل المستطيل أقرب للحروف)");
  }
  function downloadClean() { if (!S.canvas) return; S.canvas.toBlob(b => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "clean-" + (S.name || "landing") + ".png"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, "image/png"); }

  const CONV = () => S.noConv ? false : ($("gen-conv") ? $("gen-conv").checked : false);
  /* ───── النتيجة: حفظ / تحرير في المحرر / إعادة ───── */
  function showResult() {
    const r = $("gen-result"); if (!r || !S.blob) return; r.style.display = ""; const im = $("gen-rimg"); if (S.rurl) URL.revokeObjectURL(S.rurl); S.rurl = URL.createObjectURL(S.blob); im.src = S.rurl;
    const sel = $("gen-prod"); if (sel && typeof Admin !== "undefined") { const cur = sel.value; sel.innerHTML = '<option value="">— اختر المنتج لحفظ الصفحة في ملفاته —</option>' + (Admin.products || []).filter(p => p.slug && p.slug !== "test").map(p => '<option value="' + PB.esc(p.slug) + '">' + PB.esc(p.title) + ' (' + PB.esc(p.slug) + ')</option>').join(""); sel.value = cur; }
    const np = $("gen-nparts"); if (np && $("gen-n")) np.value = $("gen-n").value; const sv = $("gen-save"); if (sv) { sv.textContent = "🗂 حفظ في ملفات المنتج"; sv.disabled = false; } try { r.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) { }
  }
  const splitMode = () => { const r = document.querySelector('input[name="gen-split"]:checked'); return r ? r.value : "full"; };
  function setParts(v) { const n = Math.max(2, Math.min(30, Number(v) || 9)); $("gen-n").value = n; $("gen-nparts").value = n; recut(); const r = document.querySelector('input[name="gen-split"][value="parts"]'); if (r) r.checked = true; }
  const slugName = () => String(S.name || "landing").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "landing";
  /* أجزاء الصورة حسب حدود الأقسام الحالية */
  async function sectionBlobs(type) {
    const C = S.canvas, bounds = [0].concat(S.cuts.slice().sort((a, b) => a - b), [C.height]), out = [];
    for (let i = 0; i < bounds.length - 1; i++) { const y0 = bounds[i], y1 = bounds[i + 1]; if (y1 - y0 < 20) continue; const c = document.createElement("canvas"); c.width = C.width; c.height = y1 - y0; c.getContext("2d").drawImage(C, 0, y0, C.width, y1 - y0, 0, 0, C.width, y1 - y0); out.push({ blob: await new Promise(r => c.toBlob(r, type || "image/png")), y0, y1 }); }
    return out;
  }
  /* ZIP بسيط بدون ضغط (store) — لا مكتبات */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = t[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }; })();
  async function zipStore(files) {
    const enc = new TextEncoder(), parts = [], cen = []; let off = 0; const d = new Date(), dt = ((d.getFullYear() - 1980) << 9 | (d.getMonth() + 1) << 5 | d.getDate()) & 0xFFFF, tm = (d.getHours() << 11 | d.getMinutes() << 5 | (d.getSeconds() >> 1)) & 0xFFFF;
    for (const f of files) {
      const data = new Uint8Array(await f.blob.arrayBuffer()), name = enc.encode(f.name), crc = CRC(data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(h.buffer, name, data); const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      cen.push(c.buffer, name); off += 30 + name.length + data.length;
    }
    const cs = cen.reduce((a, b) => a + b.byteLength, 0), e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(cen, [e.buffer]), { type: "application/zip" });
  }
  function dlBlob(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
  async function downloadPage() {
    if (!S.blob || !S.canvas) return toast("لا توجد صفحة بعد");
    if (splitMode() === "full") return downloadOrig();
    const secs = await sectionBlobs("image/png"), nm = slugName(); const zip = await zipStore(secs.map((x, i) => ({ name: nm + "-" + String(i + 1).padStart(2, "0") + ".png", blob: x.blob })));
    dlBlob(zip, nm + "-sections.zip"); toast("⬇ نُزّل ملف ZIP يضم " + secs.length + " قسماً");
  }
  /* حفظ داخل ملفات المنتج: assets/img/<slug>/landing/ (كاملة أو أقساماً) */
  async function savePage() {
    if (!S.blob || !S.canvas) return toast("لا توجد صفحة بعد"); const slug = ($("gen-prod") || {}).value; if (!slug) return toast("اختر المنتج أولاً من القائمة");
    const cfg = typeof GH !== "undefined" && GH.cfg && GH.cfg(); if (!cfg || !cfg.token) return toast("⚠️ اضبط GitHub أولاً (زر ⚙️) لحفظ الملفات في المنتج");
    const sv = $("gen-save"); sv.disabled = true; const ts = Date.now().toString(36);
    try {
      const folder = "assets/img/" + slug + "/landing", items = splitMode() === "full" ? [{ blob: S.blob }] : await sectionBlobs("image/png"), paths = [];
      for (let i = 0; i < items.length; i++) { sv.textContent = "⏳ " + (i + 1) + "/" + items.length; const f = new File([items[i].blob], "p.png", { type: "image/png" }); paths.push(await Admin.uploadImageFile(f, folder, "page-" + ts + (items.length > 1 ? "-" + String(i + 1).padStart(2, "0") + "-" : "-"), { max: 4096, q: .95, noVariants: true, uniq: true })); }
      sv.textContent = "✓ حُفظت"; toast("🗂 حُفظت " + paths.length + " صورة في مجلد المنتج: " + folder + "/"); try { saveLast(S.blob, S.name || "landing"); } catch (e) { }
    } catch (e) { toast("⚠️ " + e.message); sv.textContent = "🗂 حفظ في ملفات المنتج"; }
    sv.disabled = false;
  }
  /* تحرير الصفحة: تُقسَّم إلى أقسام وتُفتح في منشئ الصفحات (فيه «أدوات ذكية») دون تحويل النصوص تلقائياً */
  async function editPage() {
    if (!S.canvas) return toast("ولّد الصفحة أولاً"); S.noConv = true;
    try { await run(); } finally { S.noConv = false; }
  }
  /* تحرير الصفحة: نسلّم الصورة مقسَّمة (حسب حدود الأقسام) إلى المحرر عبر IndexedDB المشترك ثم نفتحه */
  async function editAdvanced() {
    if (!S.canvas) return toast("ولّد الصفحة أولاً"); const C = S.canvas, bounds = [0].concat(S.cuts.slice().sort((a, b) => a - b), [C.height]), sections = [];
    for (let i = 0; i < bounds.length - 1; i++) { const y0 = bounds[i], y1 = bounds[i + 1]; if (y1 - y0 < 20) continue; const c = document.createElement("canvas"); c.width = C.width; c.height = y1 - y0; c.getContext("2d").drawImage(C, 0, y0, C.width, y1 - y0, 0, 0, C.width, y1 - y0); sections.push({ blob: await new Promise(r => c.toBlob(r, "image/png")), y0, y1 }); }
    await new Promise((res, rej) => { const rq = indexedDB.open("alyssum-editor", 1); rq.onupgradeneeded = () => rq.result.createObjectStore("kv"); rq.onerror = () => rej(rq.error); rq.onsuccess = () => { const db = rq.result, tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put({ name: S.name || "صفحة مولّدة", width: C.width, height: C.height, sections, t: Date.now() }, "handoff"); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error); }; });
    const w = window.open("editor/?import=1", "_blank"); if (!w) toast("اسمح بالنوافذ المنبثقة ثم اضغط «تحرير الصفحة» مجدداً");
  }
  async function run() {
    if (!S.canvas) return; const msg = $("gen-msg"), btn = $("gen-go"); btn.disabled = true;
    const upload = async (blob, name) => {
      try { if (typeof PBApp !== "undefined" && PBApp.uploadBlob) return await PBApp.uploadBlob(blob, name); const f = new File([blob], name + ".webp", { type: "image/webp" }); const p = await Admin.uploadImageFile(f, "assets/img/pages", "gen-", { max: 2000, q: .86, noVariants: true }); if (typeof PBApp !== "undefined" && PBApp.mediaAdd) PBApp.mediaAdd([p]); return p; }
      catch (e) { msg.textContent = "⚠️ تعذّر الرفع إلى GitHub (" + e.message + ") — حُفظت الصور مؤقتاً داخل الصفحة؛ اضبط GitHub ثم أعد التحويل للنشر."; return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); }
    };
    try {
      const gk = $("gen-gkey").value.replace(/[\s"']/g, ""), rb = $("gen-rbkey").value.trim(), L = LANGS[$("gen-lang").value] || LANGS.ar;
      if (CONV() && $("gen-engine").value === "gemini" && !gk) { msg.textContent = "أدخل مفتاح Gemini أو اختر Tesseract"; btn.disabled = false; return; }
      try { if (gk) localStorage.setItem("alyssum_gp_gkey", gk); if (rb) localStorage.setItem("alyssum_removebg_key", rb); } catch (e) { }
      const page = await convert({ dw: 1100, canvas: S.canvas, cuts: S.cuts, regions: CONV() ? S.regions : [], intended: extractIntended($("gen-intended").value), rbKey: rb, eraseOrig: !!CONV() && $("gen-erase-orig").checked, engine: $("gen-engine").value, gkey: gk, langName: L.name, ocr: !!CONV() && $("gen-ocr").checked, inpaint: true, gemOpt: geminiOpt(), tess: L.tess, title: $("gen-title").value.trim() || "صفحة هبوط", upload, onProgress: t => { msg.textContent = t; } });
      page.css = (page.css || "") + edgeGradient(S.canvas);        // خلفية الصفحة تمتد بنفس تدرّج حواف الصورة فلا تظهر هوامش بيضاء
      page.slug = ($("gen-title").value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) || "lp-" + Date.now().toString(36).slice(-4);
      const st = page._stats || { ok: 0, kept: 0 }; delete page._stats; msg.textContent = "✅ تم — " + (CONV() ? st.ok + " نصاً صار قابلاً للتعديل" : "الأقسام جاهزة") + (st.kept ? "، و" + st.kept + " نصاً بقي مرسوماً في الصورة (خلفيته معقدة — استعمل محرك Gemini أو أعد توليد الصورة بخلفية أبسط)" : "") + " — جارِ فتح المحرر"; PBApp.open(page, "", true);
    } catch (e) { console.error(e); msg.textContent = "❌ " + e.message; }
    btn.disabled = false;
  }
  return { showResult, savePage, editPage, editAdvanced, downloadPage, setParts, brushMode, detectText, eraseBrush, eraseAll, eraseMode, eraseUndo, downloadClean, geminiErase: null, eraseRects, geminiEraseRegion, LANGS, buildPrompt, extractIntended, snapText, auto, generateImage, approve, regen, checkImage, ocrFn: null, downloadOrig, restoreLast, downloadLast, showLast, copyHidden, makeFinal, setCanvas, imgFn: null, testKey, gemPrefs, gemTrack, proofread, localFix, copyFinal, textFn: null, loadImage, suggestCuts, groupLines, analyze, erase, refineBox, cleanArabic, geminiOcr, geminiDetect, detect, detectFn: null, removeBgCall, cropBlob, convert, mount, makePrompt, copyPrompt, onFile, recut, run, engineUI, regionMode, step, ocr: null, removeBg: null };
})();
