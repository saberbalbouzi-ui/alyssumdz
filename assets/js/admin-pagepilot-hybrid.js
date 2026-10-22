/* «منشئ الصفحات بالذكاء» — الوضع الهجين (PagePilotHybrid).
   صورة منتج واحدة (أو صور من رابط) ← صفحة موبايل من ~8–10 أقسام بصرية، لكل قسم: خلفية مصمَّمة + المنتج الحقيقي (طبقة مقصوصة قابلة للتحريك) + نص عربي حيّ.
   القرار المعماري: الذكاء يرسم المشاهد/الخلفيات فقط **بلا أي كتابة** (النماذج تكسر وصل الحروف العربية)، والنص طبقات HTML حقيقية
   (RTL، تعديل فوري بلا ذكاء، SEO) فوق «منطقة نص آمنة» محجوزة في الصورة، بلون يضمن التباين WCAG AA.
   خط أنابيب حتمي بخطوات: ١ تحليل المنتج ← ٢ قصّ المنتج ← ٣ دليل الأسلوب ← ٤ النصوص وخطة الأقسام ← ٥ الخلفيات ← ٦ بوابة الجودة ← ٧ التباين والتخطيط ← ٨ تجميع الصفحة.
   الواجهات: llm / image / remover / vision؛ ولكلٍّ منها نسخة MOCK محلية فتعمل الدورة كاملة بلا مفاتيح.
   الدوال النقية (relLum/contrast/pickText/styleBible/cleanPlan/geometry/buildSpec…) قابلة للاختبار. */
const PagePilotHybrid = (() => {
  const esc = t => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const strip = (s, n) => String(s == null ? "" : s).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
  const W = 1080, H = 1350;
  const RISKY = /يعالج|يشفي|علاج نهائي|يقضي على|يمنع السرطان|معتمد من وزارة|مضمون 100|100% مضمون|cure[sd]?\b|guaranteed|clinically proven/i;
  /* ادّعاءات اجتماعية مختلقة ممنوعة: آراء، عدّادات مخزون، «يشاهد الآن» */
  const FAKE = /يشاهد(ه|ها|ون)?[^.]{0,24}(الآن|حاليا|حالياً)|(متبقي|بقي|باقي)\s*\d+|آخر\s*\d+\s*(قطع|علب|حبات)|\d+\s*(زبون|عميل|شخص)\s*(اشترى|طلب|راضي)|⭐|★|تقييم\s*\d/i;

  /* ───────────── ألوان وتباين (WCAG) ───────────── */
  const hex2rgb = h => { h = String(h || "").replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); const n = parseInt(h, 16); return isNaN(n) || h.length !== 6 ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgb2hex = (r, g, b) => "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const lin = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
  const relLum = (r, g, b) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
  const contrast = (l1, l2) => (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
  const hexLum = h => { const c = hex2rgb(h); return c ? relLum(c[0], c[1], c[2]) : 0; };
  const mix = (a, b, t) => { const x = hex2rgb(a) || [0, 0, 0], y = hex2rgb(b) || [0, 0, 0]; return rgb2hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
  /* يختار أفضل لون نص فوق خلفية بسطوع bgLum؛ إن لم يبلغ 4.5 يطلب طبقة تعتيم (scrim) ويحسب النسبة بعدها */
  function pickText(bgLum, cands) {
    cands = (cands && cands.length ? cands : ["#ffffff", "#111111"]).filter(c => hex2rgb(c));
    let best = null; cands.forEach(c => { const r = contrast(bgLum, hexLum(c)); if (!best || r > best.ratio) best = { color: c, ratio: r }; });
    if (best.ratio >= 4.5) return { color: best.color, ratio: best.ratio, scrim: null };
    const dark = bgLum > .35, scrim = dark ? { color: "#000000", opacity: .55 } : { color: "#ffffff", opacity: .6 };
    const sl = bgLum * (1 - scrim.opacity) + hexLum(scrim.color) * scrim.opacity, txt = dark ? "#ffffff" : "#111111";
    return { color: txt, ratio: contrast(sl, hexLum(txt)), scrim };
  }
  function lumAt(canvas, r) {
    if (!canvas || !canvas.getContext) return .5;
    const kx = canvas.width / W, ky = canvas.height / H, sx = Math.max(0, Math.round(r.x * kx)), sy = Math.max(0, Math.round(r.y * ky)), sw = Math.max(1, Math.round(r.w * kx)), sh = Math.max(1, Math.round(r.h * ky));
    try { const g = document.createElement("canvas"); g.width = 24; g.height = 24; const c = g.getContext("2d"); c.drawImage(canvas, sx, sy, Math.min(sw, canvas.width - sx), Math.min(sh, canvas.height - sy), 0, 0, 24, 24); const d = c.getImageData(0, 0, 24, 24).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += relLum(d[i], d[i + 1], d[i + 2]); return s / (d.length / 4); } catch (_) { return .5; }
  }
  /* ألوان سائدة (بدون الأبيض/الرمادي المحايد) من ImageData مصغّرة */
  function dominantColors(data, n) {
    const b = {}; for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue; const r = data[i], g = data[i + 1], bl = data[i + 2], mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
      if (mx - mn < 28) continue;   /* رمادي/أبيض/أسود */
      const k = (r >> 5) + "," + (g >> 5) + "," + (bl >> 5), o = b[k] || (b[k] = { n: 0, r: 0, g: 0, b: 0 }); o.n++; o.r += r; o.g += g; o.b += bl;
    }
    return Object.values(b).sort((a, c) => c.n - a.n).slice(0, n || 3).map(o => rgb2hex(o.r / o.n, o.g / o.n, o.b / o.n));
  }

  /* ───────────── ١) تحليل المنتج ───────────── */
  function analysisPrompt(info) {
    return `حلّل صورة المنتج المرفقة (والمعلومات أدناه إن وُجدت) وأخرج JSON واحداً فقط بلا شرح:
{"category":"فئة المنتج بكلمتين","product_name_ar":"اسمه بالعربية","key_features":["≤5 مزايا ظاهرة أو مذكورة فقط"],"target_audience":"","use_cases":["≤3"],"problems_solved":["≤3"],"dominant_colors":["#hex","#hex","#hex"],"mood":"clean|premium|energetic|natural","risk_flags":["medical_claim|cosmetic_claim|brand|minors|none"]}
لا تخترع مزايا غير ظاهرة أو غير مذكورة.
المنتج: ${info.title || "—"}
الوصف: ${info.desc || "—"}`;
  }
  function cleanAnalysis(r) {
    r = r && typeof r === "object" ? r : {}; const arr = (a, n, f) => (Array.isArray(a) ? a : []).slice(0, n).map(f || (x => strip(x, 80))).filter(Boolean);
    const mood = ["clean", "premium", "energetic", "natural"].includes(r.mood) ? r.mood : "clean";
    return { category: strip(r.category, 40), name: strip(r.product_name_ar || r.name, 80), features: arr(r.key_features, 5), audience: strip(r.target_audience, 80), uses: arr(r.use_cases, 3), problems: arr(r.problems_solved, 3), colors: arr(r.dominant_colors, 3, x => (hex2rgb(x) ? String(x).toLowerCase() : "")), mood, risks: arr(r.risk_flags, 5, x => strip(x, 30)).filter(x => x !== "none") };
  }

  /* ───────────── ٣) دليل الأسلوب (مشترك بين كل الأقسام ← اتّساق بصري) ───────────── */
  const FAMILY = { clean: "soft gradient studio background", premium: "dark luxurious studio with soft rim light", energetic: "bold vibrant background with clean geometric shapes", natural: "natural lifestyle scene with soft daylight" };
  const LIGHT = { clean: "soft diffused studio light", premium: "dramatic low-key lighting with subtle highlights", energetic: "bright punchy light", natural: "warm natural window light" };
  function styleBible(an, theme) {
    an = an || {}; theme = theme || { main: "#187a3b", acc: "#f39a18", ink: "#16324c", soft: "#e9f5e4" };
    const dom = (an.colors && an.colors[0]) || theme.main, primary = hexLum(dom) > .6 ? mix(dom, "#000000", .45) : dom;
    const accent = (an.colors && an.colors[1]) || theme.acc, mood = an.mood || "clean";
    const pal = { primary, secondary: mix(primary, "#ffffff", .35), accent, text: hexLum(primary) < .25 ? "#ffffff" : "#16212b", surface: mix(primary, "#ffffff", .9) };
    const radius = mood === "premium" ? 14 : mood === "energetic" ? 26 : 20, shadow = "soft realistic contact shadow";
    const prefix = `Commercial e-commerce advertising photography, ${mood} mood, ${LIGHT[mood]}, ${FAMILY[mood]}, color palette ${pal.primary} / ${pal.accent} / ${pal.surface}${an.category ? ", product category: " + an.category : ""}`;
    return { palette: pal, mood, lighting: LIGHT[mood], family: FAMILY[mood], radius, shadow, prefix };
  }

  /* ───────────── ٤) خطة الأقسام والنصوص ───────────── */
  /* لكل نوع: مكان النص (zone: top|bottom|full) ومكان المنتج (يعاكسه) ومشهد افتراضي */
  const TYPES = {
    hero: { zone: "top", cta: true, scene: "an attractive hero scene that fits the product's use, depth and atmosphere, a clean empty surface in the lower half for the product" },
    problem: { zone: "full", product: false, scene: "an emotive but tasteful abstract scene representing the everyday problem, muted colors, no people" },
    benefits: { zone: "top", scene: "a bright clean scene with soft shapes and a surface for the product in the lower half" },
    how_to_use: { zone: "bottom", scene: "a tidy everyday setting suggesting usage, product area in the upper half" },
    why_choose: { zone: "top", scene: "a premium confident backdrop with subtle light rays and a pedestal for the product" },
    comparison: { zone: "full", product: false, scene: "a simple split-tone clean background suggesting a comparison, no objects" },
    offer_price: { zone: "top", cta: true, price: true, scene: "a celebratory offer backdrop with soft glow and confetti-like shapes, a pedestal for the product" },
    faq: { zone: "full", product: false, scene: "a calm light background with very subtle pattern, no objects" },
    delivery_guarantee: { zone: "bottom", scene: "a trustworthy clean backdrop suggesting delivery and care, product area in the upper half" },
    final_cta: { zone: "top", cta: true, scene: "an inviting finale backdrop with warm glow and a pedestal for the product" }
  };
  /* وضع «الدمج»: يرسم الذكاء المنتج داخل المشهد نفسه (صورة مختلفة لكل قسم) — النص يبقى طبقات حيّة في المنطقة المقابلة */
  const EDIT_ZONE = { problem: "top", comparison: "top", faq: "bottom" };
  const EDIT_SCENE = {
    hero: "a dramatic hero shot, product at a low three-quarter angle on an elegant surface, shallow depth of field, depth and atmosphere that fit the product's use",
    problem: "a muted, slightly desaturated everyday setting that hints at the daily problem, cooler tones, the product sits calmly in the foreground as the solution",
    benefits: "a bright fresh macro-style composition, product slightly angled, natural elements related to the product's key ingredient or benefit around it",
    how_to_use: "a tidy lifestyle setting seen from above (flat-lay), product with a few simple related props that suggest everyday use",
    why_choose: "a premium confident podium scene with subtle light rays, product centered at eye level",
    comparison: "a clean studio background with a soft two-tone split, product on one side with calm studio lighting",
    offer_price: "a festive offer backdrop with warm glow and soft sparkles, product large and proud on a pedestal",
    faq: "a calm, soft-focus home interior, product small on a shelf or table, bokeh background",
    delivery_guarantee: "a warm trustworthy scene with a kraft-paper gift package and ribbon beside the product, soft daylight",
    final_cta: "an inviting golden-hour scene, close and warm hero view of the product with gentle glow"
  };
  const zoneOf = (type, edit) => { const T = TYPES[type] || TYPES.hero; return edit && EDIT_ZONE[type] ? EDIT_ZONE[type] : T.zone; };
  const ORDER = { 6: ["hero", "problem", "benefits", "offer_price", "delivery_guarantee", "final_cta"], 8: ["hero", "problem", "benefits", "how_to_use", "why_choose", "offer_price", "delivery_guarantee", "final_cta"], 10: ["hero", "problem", "benefits", "how_to_use", "why_choose", "comparison", "offer_price", "faq", "delivery_guarantee", "final_cta"] };
  const typesFor = n => (ORDER[n] || ORDER[8]).slice();
  function planPrompt(info, an, style, o) {
    o = o || {}; const types = typesFor(o.count), dia = o.dialect === "msa" ? "العربية الفصحى المبسّطة" : "الدارجة الجزائرية المكتوبة بحروف عربية (قريبة من الناس، بلا مبالغة)";
    return `أنت كاتب إعلانات لصفحة هبوط موبايل مصوّرة. اكتب نصوص أقسام الصفحة للمنتج التالي بـ${dia}.
المنتج: ${info.title || "—"}${an && an.name ? " (" + an.name + ")" : ""}
الوصف: ${info.desc || "—"}
${an && an.features && an.features.length ? "مزايا مؤكدة: " + an.features.join(" | ") + "\n" : ""}${an && an.audience ? "الجمهور: " + an.audience + "\n" : ""}${o.audience ? "نبرة/جمهور مطلوب: " + o.audience + "\n" : ""}
الأقسام بهذا الترتيب بالضبط: ${types.join(", ")}.
قواعد صارمة: جمل قصيرة تبدأ بالفائدة؛ لا ادّعاءات علاجية أو مبالغة؛ لا آراء زبائن ولا عدّادات مخزون ولا «يشاهده X الآن» ولا أرقام مختلقة؛ لا أسعار ولا نسب خصم في النصوص (تأتي من المتجر).
حقل scene: وصف إنجليزي للمشهد/الخلفية فقط، بلا منتج ولا نصوص ولا وجوه أشخاص.
أخرج JSON واحداً فقط: {"sections":[{"type":"hero","headline":"≤45 حرفاً","sub":"≤110 حرفاً","bullets":["≤45 حرفاً"],"cta":"≤22 حرفاً","scene":"…"}]}
عدد bullets: hero 0، problem 0، benefits 4، how_to_use 3 (خطوات)، why_choose 3، comparison 3، offer_price 0، faq 3 (سؤال وجوابه في سطر واحد «س: … ج: …»)، delivery_guarantee 3، final_cta 0.`;
  }
  function cleanPlan(raw, o) {
    o = o || {}; const types = typesFor(o.count), src = raw && Array.isArray(raw.sections) ? raw.sections : [], by = {}; src.forEach(s => { const t = s && String(s.type || "").trim(); if (t && TYPES[t] && !by[t]) by[t] = s; });
    const warn = [];
    const out = types.map((t, i) => {
      const s = by[t] || src[i] || {}, bl = (Array.isArray(s.bullets) ? s.bullets : []).map(b => strip(typeof b === "string" ? b : b && (b.text || b.title), 60)).filter(Boolean);
      const keep = bl.filter(b => !FAKE.test(b)); if (keep.length < bl.length) warn.push("حُذفت عبارات تبدو ادّعاءً اجتماعياً مختلقاً من قسم " + t);
      const head = strip(s.headline || s.title, 60), sub = strip(s.sub || s.subheadline, 140);
      const sec = { id: "s" + (i + 1) + "-" + t, type: t, headline: FAKE.test(head) ? "" : head, sub: FAKE.test(sub) ? "" : sub, bullets: keep.slice(0, 5), cta: strip(s.cta, 26), scene: strip(s.scene, 240) };
      if (RISKY.test([sec.headline, sec.sub].concat(sec.bullets).join(" "))) warn.push("قسم " + t + " فيه عبارة قد تُعدّ ادّعاءً — راجعها");
      return sec;
    });
    return { sections: out, warn };
  }
  /* خطة بلا ذكاء (MOCK/احتياط): من بيانات المنتج نفسها */
  function fallbackPlan(info, lang, o) {
    o = o || {}; const t = strip(info.title, 60) || "المنتج", ss = strip(info.desc, 900).split(/(?<=[.!؟?])\s+/).filter(x => x.length > 12), cta = lang === "fr" ? "Commander" : lang === "en" ? "Order now" : "اطلب الآن";
    const pick = (a, b) => ss[a] ? strip(ss[a], b) : "";
    const copy = {
      hero: [t, pick(0, 120), []], problem: ["هل تبحث عن الأفضل؟", pick(1, 120), []], benefits: ["لماذا تحبّه", "", ss.slice(0, 4).map(x => strip(x, 45))],
      how_to_use: ["كيف تستعمله", "", ["اطلب من الصفحة", "استلمه في بيتك", "استمتع بنتيجته"]], why_choose: ["لماذا نحن", "", ["جودة واضحة", "خدمة بعد الطلب", "دفع مريح"]],
      comparison: ["قارن بنفسك", "", ["مكوّنات واضحة", "سعر عادل", "توصيل لولايتك"]], offer_price: ["عرض اليوم", "", []], faq: ["أسئلة سريعة", "", ["س: كيف أدفع؟ ج: عند الاستلام.", "س: هل التوصيل متاح؟ ج: لكل الولايات.", "س: كيف أطلب؟ ج: بنموذج الطلب أدناه."]],
      delivery_guarantee: ["توصيل ودفع مريح", "", ["توصيل لكل الولايات", "الدفع عند الاستلام", "تأكيد الطلب بالهاتف"]], final_cta: ["جاهز للطلب؟", pick(0, 100), []]
    };
    return cleanPlan({ sections: typesFor(o.count).map(ty => { const c = copy[ty] || [t, "", []]; return { type: ty, headline: c[0], sub: c[1], bullets: c[2], cta: TYPES[ty].cta ? cta : "" }; }) }, o);
  }

  /* ───────────── ٥) البرومبتات ───────────── */
  const NEG = "text, letters, words, numbers, watermark, logo, distorted product, extra parts, blurry, low resolution, malformed hands";
  function bgPrompt(style, sec, o) {
    o = o || {}; const T = TYPES[sec.type] || TYPES.hero, zn = zoneOf(sec.type, !!o.withProduct), zoneTxt = zn === "top" ? "the top 40% of the frame" : zn === "bottom" ? "the bottom 40% of the frame" : "the central 70% of the frame";
    const noProduct = !o.withProduct && T.product === false;
    const where = zn === "top" ? "in the lower half" : zn === "bottom" ? "in the upper half" : "small and centered";
    const ref = o.withProduct ? "Use the reference photo: this exact same product (shape, color, label, logo and any printed text on the pack untouched) is naturally integrated INTO the scene — correct perspective, matching light, realistic contact shadow and reflections, as if it was photographed there; placed " + where + ". This image must look clearly different (camera angle, setting, props) from the other sections of the same page. " : (noProduct ? "" : "Leave a clean, empty surface area in the " + (zn === "top" ? "lower" : "upper") + " half where a product will be placed later; do not draw any product. ");
    const scene = o.withProduct ? (EDIT_SCENE[sec.type] || EDIT_SCENE.hero) + (sec.scene ? ". Setting inspiration: " + sec.scene : "") : (sec.scene || T.scene);
    return `${style.prefix}. ${scene}. ${ref}Leave clean, calm, low-detail empty space across ${zoneTxt} for a headline. No text, no letters, no numbers, no watermark, no extra logos. ${o.noFaces === false ? "" : "No human faces or people. "}Vertical 4:5 composition. AVOID: ${NEG}${o.noFaces === false ? "" : ", human faces, people's faces"}. ${o.extra || ""}`.trim();
  }
  function gatePrompt(o) {
    const z = o.zone === "bottom" ? "الجزء السفلي" : o.zone === "full" ? "الجزء الأوسط" : "الجزء العلوي";
    if (o.ref) return `الصورة الأولى هي المنتج المرجعي، والثانية مشهد إعلاني يُفترض أن المنتج مدمج فيه. أخرج JSON واحداً فقط بلا شرح:
{"has_text":true|false,"has_face":true|false,"zone_empty":true|false,"artifacts":true|false,"product_matches":true|false}
has_text: هل في المشهد (الثانية) كتابة جديدة أو أحرف أو أرقام أو علامة مائية غير الموجودة على عبوة المنتج نفسها؟ has_face: هل فيها وجه إنسان؟ zone_empty: هل ${z} من المشهد هادئ وفارغ بما يكفي لعنوان؟ artifacts: هل فيها تشوّهات واضحة؟ product_matches: هل المنتج الظاهر في المشهد هو نفسه المنتج المرجعي (الشكل واللون والملصق) وظاهر بوضوح وغير مشوَّه؟`;
    return `افحص الصورة المرفقة (خلفية/مشهد إعلاني) وأخرج JSON واحداً فقط بلا شرح:
{"has_text":true|false,"has_face":true|false,"zone_empty":true|false,"artifacts":true|false}
has_text: هل في الصورة أي كتابة أو أحرف أو أرقام أو علامة مائية؟ has_face: هل فيها وجه إنسان؟ zone_empty: هل ${z} من الصورة هادئ وفارغ بما يكفي لعنوان؟ artifacts: هل فيها تشوّهات واضحة أو أجزاء غريبة؟`;
  }
  function gateOk(r, noFaces, needProduct) { r = r || {}; const why = []; if (r.has_text) why.push("text"); if (noFaces !== false && r.has_face) why.push("face"); if (r.zone_empty === false) why.push("zone"); if (r.artifacts) why.push("artifacts"); if (needProduct && r.product_matches === false) why.push("product"); return { ok: !why.length, why }; }
  const retryNote = why => (why.includes("text") ? "STRICTLY NO text, letters or numbers anywhere. " : "") + (why.includes("face") ? "STRICTLY no human faces. " : "") + (why.includes("zone") ? "Keep the requested empty area completely calm and plain. " : "") + (why.includes("artifacts") ? "Clean, undistorted, simple composition. " : "") + (why.includes("product") ? "Reproduce the reference product EXACTLY and fully visible, unchanged shape, color and label. " : "");

  /* ───────────── ٧) هندسة التخطيط (أبعاد الصفحة 1080×1350) ───────────── */
  function geometry(type, ar, edit) {
    const T = TYPES[type] || TYPES.hero, zn = zoneOf(type, edit), zone = zn === "top" ? { x: 70, y: 90, w: 940, h: 560 } : zn === "bottom" ? { x: 70, y: H - 650, w: 940, h: 560 } : { x: 70, y: 150, w: 940, h: H - 300 };
    let prod = null;
    if (!edit && T.product !== false) {
      const box = zn === "top" ? { x: 120, y: 700, w: 840, h: 560 } : { x: 120, y: 60, w: 840, h: 560 }; ar = ar > 0 ? ar : 1;
      const w = Math.round(Math.min(box.w, box.h * ar)), h = Math.round(w / ar);
      prod = { x: Math.round(box.x + (box.w - w) / 2), y: Math.round(zn === "top" ? box.y + box.h - h : box.y + (box.h - h) / 2), w, h };
    }
    return { zone, prod, zname: zn };
  }
  /* تقدير ارتفاع نص (للتكديس قبل القياس الحقيقي في المحرّر) */
  const estH = (txt, size, w, lh) => Math.ceil(Math.max(1, Math.ceil(String(txt).length * size * .52 / w)) * size * (lh || 1.4)) + 6;

  /* ───────────── ٩) تجميع الصفحة (مخطط alyssum-design/1 ← PBSpec) ───────────── */
  /* results[i] = {sec, bgSrc, lum, prodSrc, prodAr, flags[], attempts}. ctx: {title, product, wa, lang, style, productAlt} */
  function buildSpec(plan, results, ctx) {
    ctx = ctx || {}; const st = ctx.style || styleBible({}, null), assets = {}, sections = [], rtl = (ctx.lang || "ar") === "ar", al = rtl ? "right" : "left";
    results.forEach((R, i) => {
      const s = R.sec, T = TYPES[s.type] || TYPES.hero, g = geometry(s.type, R.prodAr, ctx.strategy === "edit"), layers = [], an = "bg" + (i + 1), pn = "pr" + (i + 1);
      assets[an] = { src: R.bgSrc, prompt: "" }; if (R.prodSrc && g.prod) assets[pn] = { src: R.prodSrc, prompt: "" };
      layers.push({ type: "image", src: "asset:" + an, x: 0, y: 0, w: W, h: H, z: 1, fit: "cover", alt: strip([s.headline, s.sub].filter(Boolean).join(" — "), 160), locked: true });
      const pk = pickText(R.lum != null ? R.lum : .5, [st.palette.text, "#ffffff", "#111111"]), z = g.zone;
      if (pk.scrim) layers.push({ type: "shape", shape: "rect", x: z.x - 30, y: z.y - 24, w: z.w + 60, h: z.h + 24, z: 2, fill: pk.scrim.color, opacity: pk.scrim.opacity, radius: st.radius });
      if (R.prodSrc && g.prod) layers.push({ type: "image", src: "asset:" + pn, x: g.prod.x, y: g.prod.y, w: g.prod.w, h: g.prod.h, z: 3, fit: "contain", alt: strip(ctx.productAlt || ctx.title, 120), shadow: { x: 0, y: 26, blur: 40, color: "rgba(0,0,0,.35)", follow: true }, effects: [{ type: "float", amount: 10, duration: 6 }] });
      let y = z.y; const fs1 = (s.headline || "").length > 34 ? 60 : 72;
      if (s.headline) { const h = estH(s.headline, fs1, z.w, 1.25); layers.push({ type: "heading", tag: i === 0 ? "h1" : "h2", text: s.headline, x: z.x, y, w: z.w, z: 5, font: { size: fs1, weight: 900, color: pk.color, align: g.zname === "full" ? "center" : al, lineHeight: 1.25 }, effects: [{ type: "fadeUp" }] }); y += h + 14; }
      if (s.sub) { const h = estH(s.sub, 36, z.w, 1.6); layers.push({ type: "text", text: s.sub, x: z.x, y, w: z.w, z: 5, font: { size: 36, weight: 600, color: pk.color, align: g.zname === "full" ? "center" : al, lineHeight: 1.6 }, effects: [{ type: "fadeUp", delay: .1 }] }); y += h + 12; }
      (s.bullets || []).forEach((b, bi) => { const txt = "• " + b, h = estH(txt, 38, z.w, 1.5); if (y + h > z.y + z.h + 40) return; layers.push({ type: "text", text: txt, x: z.x, y, w: z.w, z: 5, font: { size: 38, weight: 700, color: pk.color, align: al, lineHeight: 1.5 }, effects: [{ type: "fadeUp", delay: .15 + bi * .08 }] }); y += h + 6; });
      if (T.price && ctx.product) { layers.push({ type: "price", x: z.x, y: Math.min(y + 10, z.y + z.h - 90), w: z.w, z: 5 }); }
      if (T.cta) {
        const wa = String(ctx.wa || "").replace(/\D/g, ""), link = ctx.product ? "#order" : (wa ? "https://wa.me/" + wa + "?text=" + encodeURIComponent(ctx.title || "") : "#order");
        const by = Math.max(y + 16, z.y + z.h - 90); layers.push({ type: "button", text: s.cta || "اطلب الآن", link, x: z.x + (z.w - 520) / 2, y: Math.min(by, z.y + z.h + 40), w: 520, h: 92, z: 6, bg: st.palette.accent, color: hexLum(st.palette.accent) > .45 ? "#111111" : "#ffffff", radius: 46, font: { size: 34, weight: 900 }, effects: [{ type: "fadeUp", delay: .3 }, { type: "pulse" }, { type: "shine" }] });
      }
      sections.push({ name: s.id, height: H, bg: st.palette.surface, layers });
    });
    if (ctx.product) sections.push({ kind: "order", title: (ctx.lang === "fr" ? "Commander" : ctx.lang === "en" ? "Order now" : "اطلب الآن") + (rtl ? " · الدفع عند الاستلام" : ""), note: "" });
    return { format: "alyssum-design/1", page: { title: ctx.title || "صفحة هبوط", width: W, bg: st.palette.surface, lang: ctx.lang || "ar", product: ctx.product || "" }, assets, sections };
  }

  /* ───────────── مزوّدات: حقيقية ومحاكاة (MOCK) ───────────── */
  const canvasBlob = (c, type, q) => new Promise(r => c.toBlob(r, type || "image/webp", q || .9));
  async function toCanvas(blob, max) { const url = URL.createObjectURL(blob); try { const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("صورة غير صالحة")); i.src = url; }); const k = Math.min(1, (max || 1600) / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); return c; } finally { URL.revokeObjectURL(url); } }
  function trimAlpha(c) {
    const x = c.getContext("2d"), d = x.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1, op = 0;
    for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (d[(y * c.width + xx) * 4 + 3] > 16) { op++; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return { canvas: c, coverage: 0, bbox: 0 };
    const w = x1 - x0 + 1, h = y1 - y0 + 1, o = document.createElement("canvas"); o.width = w; o.height = h; o.getContext("2d").drawImage(c, x0, y0, w, h, 0, 0, w, h);
    return { canvas: o, coverage: op / (c.width * c.height), bbox: (w * h) / (c.width * c.height) };
  }
  /* خلفية محلية (MOCK ImageProvider): تدرّج بألوان الأسلوب + بقع ناعمة، منطقة الشرح هادئة */
  function mockBg(style, sec, seed) {
    const c = document.createElement("canvas"); c.width = 540; c.height = 675; const x = c.getContext("2d"), p = style.palette, dark = hexLum(p.primary) < .2, T = TYPES[sec.type] || TYPES.hero;
    const g = x.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, dark ? mix(p.primary, "#000000", .25) : mix(p.primary, "#ffffff", .86)); g.addColorStop(1, dark ? p.primary : mix(p.secondary, "#ffffff", .7)); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    let s = (seed + 1) * 9301; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 6; i++) { const cx = rnd() * c.width, cy = (T.zone === "top" ? .45 + rnd() * .55 : T.zone === "bottom" ? rnd() * .55 : rnd()) * c.height, r = 60 + rnd() * 120, rg = x.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, (i % 2 ? p.accent : p.secondary) + "55"); rg.addColorStop(1, (i % 2 ? p.accent : p.secondary) + "00"); x.fillStyle = rg; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
    if (T.product !== false) { const py = T.zone === "top" ? c.height * .78 : c.height * .3, eg = x.createRadialGradient(c.width / 2, py, 0, c.width / 2, py, 190); eg.addColorStop(0, dark ? "#ffffff22" : "#ffffffaa"); eg.addColorStop(1, "#ffffff00"); x.fillStyle = eg; x.fillRect(0, 0, c.width, c.height); }
    return c;
  }
  const realImage = () => { try { return typeof ImgGen !== "undefined" && ImgGen.edit && (!ImgGen.ready || ImgGen.ready().ok); } catch (_) { return false; } };
  function providers(over) {
    const real = realImage(), P = {
      real,
      llm: { json: async (prompt, blobs) => { if (!real || typeof ImgGen === "undefined" || !ImgGen.text) { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; } return ImgGen.text({ prompt, json: true, temp: .7, blobs: blobs && blobs.length ? blobs : undefined, edge: 1600 }); } },
      image: {
        bg: async (prompt, i, sec) => { if (!real) return { canvas: mockBg(P.style, sec, i), mock: true }; const r = await ImgGen.edit({ textOnly: true, prompt, W, H, confirm: false, title: "خلفية قسم " + (i + 1) }); return { canvas: r.canvas || await toCanvas(r.blob, 1400), blob: r.blob }; },
        edit: async (blob, prompt, i) => { if (!real) return null; const r = await ImgGen.edit({ blob, prompt, W, H, pro: true, confirm: false, title: "مشهد قسم " + (i + 1) }); return { canvas: r.canvas || await toCanvas(r.blob, 1400), blob: r.blob }; }
      },
      remover: { cut: async (canvas, onStep) => { if (typeof PBBgRemove === "undefined" || !PBBgRemove.autoCut) return null; const r = await PBBgRemove.autoCut(canvas, { onStep }); return r && r.canvas ? r.canvas : null; } },
      vision: { check: async (blob, prompt, ref) => { if (!real || typeof ImgGen === "undefined" || !ImgGen.text) return null; return ImgGen.text({ prompt, json: true, temp: .1, blobs: ref ? [ref, blob] : [blob] }); } }
    };
    return Object.assign(P, over || {});
  }

  /* ───────────── خط الأنابيب ───────────── */
  const pool = async (items, limit, fn) => { const out = new Array(items.length); let k = 0; await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (k < items.length) { const i = k++; out[i] = await fn(items[i], i); } })); return out; };
  const withTimeout = (p, ms, label) => new Promise((res, rej) => { const t = setTimeout(() => rej(Object.assign(new Error((label || "الخطوة") + ": انتهت المهلة"), { code: "TIMEOUT" })), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
  /* in: {info, blob (صورة المنتج), theme, lang, dialect, count, strategy:"composite"|"edit", gate:bool, noFaces:bool, audience, product, wa}
     cb: {step(name,state,extra), section(i,result)} */
  async function run(inp, cb, over) {
    cb = cb || {}; const P = providers(over), log = [], t0 = () => Date.now(); const note = [];
    const step = async (name, fn, sec) => { const e = { step: name, section: sec || "", status: "running", attempts: 1, ms: 0, error: "" }; log.push(e); const s = t0(); cb.step && cb.step(name, "running", e); try { const v = await fn(); e.status = "done"; e.ms = t0() - s; cb.step && cb.step(name, "done", e); return v; } catch (er) { e.status = "failed"; e.error = er && er.message || String(er); e.ms = t0() - s; cb.step && cb.step(name, "failed", e); throw er; } };
    /* صور مرجعية متعددة (من رابط المنتج/المتجر): كل قسم يأخذ مرجعاً مختلفاً ليخرج مشهده مختلفاً */
    const refs = (Array.isArray(inp.refs) ? inp.refs : []).filter(Boolean); if (inp.blob && !refs.includes(inp.blob)) refs.unshift(inp.blob);
    const photo = refs[0] ? await toCanvas(refs[0], 1600) : null;
    const wantEdit = inp.strategy !== "composite" && P.real && !!photo;
    const strategy = wantEdit ? "edit" : "composite", edit = wantEdit;
    /* ١ تحليل المنتج */
    let an = cleanAnalysis({});
    try { an = cleanAnalysis(await step("analysis", () => withTimeout(P.llm.json(analysisPrompt(inp.info), refs.slice(0, 3)), 90000, "تحليل المنتج"))); } catch (e) { an = cleanAnalysis({}); if (photo) { const g = document.createElement("canvas"); g.width = g.height = 32; g.getContext("2d").drawImage(photo, 0, 0, 32, 32); an.colors = dominantColors(g.getContext("2d").getImageData(0, 0, 32, 32).data, 3); } }
    if (an.risks.some(r => /medical|cosmetic/.test(r))) note.push("المنتج يحمل مخاطر ادّعاء (" + an.risks.join("، ") + "): راجع النصوص قبل النشر.");
    /* ٢ قصّ المنتج */
    let prod = null, prodOk = false;
    if (photo && !edit) {
      try {
        prod = await step("cutout", async () => {
          /* صورة شفافة أصلاً (زوايا شفافة) تُستعمل كما هي؛ وإلا يُقصّ المنتج. لا يُعدَّل المنتج الأصلي أبداً */
          const hasA = (() => { try { const x = photo.getContext("2d"), s = 6, pts = [[0, 0], [photo.width - s, 0], [0, photo.height - s], [photo.width - s, photo.height - s]]; return pts.every(q => { const d = x.getImageData(q[0], q[1], s, s).data; let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i]; return a / (d.length / 4) < 40; }); } catch (_) { return false; } })();
          let src = hasA ? photo : null; if (!src) { try { src = await withTimeout(P.remover.cut(photo), 120000, "قصّ المنتج"); } catch (_) { src = null; } }
          if (!src) throw new Error("تعذّر قصّ المنتج"); const tr = trimAlpha(src); if (tr.coverage < .02 || tr.bbox < .02) throw new Error("القصّ غير صالح"); tr.original = !!hasA; return tr;
        });
        prodOk = true;
      } catch (e) { note.push("تعذّر قصّ المنتج من الخلفية فاستُعملت الصورة كما هي — قد تظهر بخلفيتها."); const tr = trimAlpha(photo); tr.fallback = true; prod = tr; }
    }
    /* ٣ دليل الأسلوب */
    const style = styleBible(an, inp.theme); P.style = style; log.push({ step: "style", section: "", status: "done", attempts: 1, ms: 0, error: "" }); cb.step && cb.step("style", "done", {});
    /* ٤ خطة الأقسام والنصوص */
    let plan;
    try { plan = cleanPlan(await step("plan", () => withTimeout(P.llm.json(planPrompt(inp.info, an, style, { count: inp.count, dialect: inp.dialect, audience: inp.audience }), refs.slice(0, 1)), 150000, "خطة الأقسام")), { count: inp.count }); if (plan.sections.filter(s => s.headline).length < 3) throw new Error("خطة ناقصة"); }
    catch (e) { plan = fallbackPlan(inp.info, inp.lang, { count: inp.count }); note.push("استُعملت نصوص من بيانات المنتج" + (e && e.code === "NOKEY" ? " (لا مفتاح Alyssum API)" : "") + " — عدّلها في المطوّر."); }
    plan.warn.forEach(w => note.push(w));
    /* ٥+٦ الخلفيات وبوابة الجودة (بالتوازي بحدّ) */
    if (inp.strategy !== "composite" && !wantEdit && photo) note.push("دمج المنتج في المشهد يحتاج مفتاح Alyssum API: استُعمل قصّ المنتج فوق خلفية محلية.");
    const noFaces = inp.noFaces !== false, results = [];
    await pool(plan.sections, 3, async (sec, i) => {
      const T = TYPES[sec.type] || TYPES.hero, R = { sec, bgBlob: null, bgCanvas: null, flags: [], attempts: 0, mock: false, prompt: "" }, refBlob = refs.length ? refs[i % refs.length] : null; R.ref = refs.length ? i % refs.length : -1;
      let extra = "", why = [];
      for (let a = 1; a <= 3; a++) {
        R.attempts = a;
        try {
          const pr = bgPrompt(style, sec, { withProduct: edit, noFaces, extra }); R.prompt = pr;
          const got = await step("background", () => withTimeout(edit ? P.image.edit(refBlob, pr, i) : P.image.bg(pr, i, sec), 240000, "الخلفية"), sec.id);
          if (!got || !got.canvas) throw new Error("لم تُرجَع صورة"); R.bgCanvas = got.canvas; R.bgBlob = got.blob || null; R.mock = !!got.mock;
          if (inp.gate !== false && P.real && !got.mock && R.bgBlob) {
            const v = await step("quality", () => withTimeout(P.vision.check(R.bgBlob, gatePrompt({ zone: zoneOf(sec.type, edit), ref: edit }), edit ? refBlob : null), 90000, "فحص الجودة"), sec.id).catch(() => null);
            const gk = v ? gateOk(v, noFaces, edit) : { ok: true, why: [] };
            if (!gk.ok && a < 3) { why = gk.why; extra = retryNote(why); continue; }
            if (!gk.ok) R.flags.push("needs_review:" + gk.why.join("+"));
          }
          break;
        } catch (e) {
          if (e && (e.code === "NOKEY" || e.code === "OFF")) { R.bgCanvas = mockBg(style, sec, i); R.mock = true; break; }
          if (a >= 3) { R.bgCanvas = mockBg(style, sec, i); R.mock = true; R.flags.push("needs_review:bg_failed"); R.error = e && e.message; break; }
          extra = ""; await new Promise(r => setTimeout(r, 600));
        }
      }
      if (R.mock && P.real) note.push("القسم " + (i + 1) + ": استُعملت خلفية محلية بدل الذكاء (فشلت المحاولات).");
      /* ٧ التباين: متوسط سطوع منطقة النص من الخلفية نفسها */
      const g = geometry(sec.type, prod ? prod.canvas.width / prod.canvas.height : 1, edit); R.lum = lumAt(R.bgCanvas, g.zone); R.prodAr = prod ? prod.canvas.width / prod.canvas.height : 0;
      results[i] = R; cb.section && cb.section(i, R);
    });
    return { an, style, plan, results, prod, prodOk, strategy, log, note, real: P.real };
  }

  /* ───────────── ٨) الرفع والتجميع النهائي (يحتاج PBApp/PBSpec) ───────────── */
  async function assemble(out, ctx, upload) {
    const spec0 = [];
    const prodSrc = out.prod ? await upload(await canvasBlob(out.prod.canvas, "image/png"), "product") : "";
    for (let i = 0; i < out.results.length; i++) { const R = out.results[i], blob = R.bgBlob || await canvasBlob(R.bgCanvas, "image/webp", .88); R.bgSrc = await upload(blob, "bg" + (i + 1)); R.prodSrc = prodSrc; spec0.push(R); }
    const spec = buildSpec(out.plan, spec0, Object.assign({ style: out.style, strategy: out.strategy }, ctx));
    const v = PBSpec.validate(spec, { product: ctx.product });
    if (!v.ok) throw new Error(v.error || "مخطط غير صالح");
    const pg = PBSpec.toPage(v, { product: ctx.product, title: ctx.title, merge: false });
    pg.cover = out.results[0] && out.results[0].bgSrc || ""; pg.media = [prodSrc].concat(out.results.map(r => r.bgSrc)).filter(Boolean);
    pg.specMeta = Object.assign(pg.specMeta || {}, { hybrid: { v: 1, strategy: out.strategy, theme: out.style, sections: out.results.map(r => ({ id: r.sec.id, type: r.sec.type, prompt: r.prompt, ref: r.ref, attempts: r.attempts, flags: r.flags, contrast: pickText(r.lum != null ? r.lum : .5, [out.style.palette.text, "#ffffff", "#111111"]).ratio })), steps: out.log.slice(0, 200) } });
    return { page: pg, warn: (v.warn || []) };
  }

  return { W, H, TYPES, EDIT_SCENE, zoneOf, typesFor, relLum, contrast, hexLum, mix, pickText, lumAt, dominantColors, analysisPrompt, cleanAnalysis, styleBible, planPrompt, cleanPlan, fallbackPlan, bgPrompt, gatePrompt, gateOk, geometry, buildSpec, mockBg, providers, run, assemble, trimAlpha, toCanvas, canvasBlob, FAKE };
})();
