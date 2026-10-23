/* مولّد الصور (ImgGen): صور منتجات + صور إشهارية بمقاسات مواقع التواصل، عبر Alyssum API (مفتاحك يبقى في متصفحك فقط).
   كل نوع له تعليمات (instruction) خاصة تُرسل مع صورة المنتج؛ النتيجة تُقصّ/تُكبَّر إلى المقاس المطلوب بالبكسل ثم تُفتح في المطوّر أو تُحفظ في المكتبة.
   التكلفة: نموذج واحد رخيص افتراضياً، صورة واحدة لكل ضغطة، حدّ إنفاق تضبطه (يتوقف التوليد عند بلوغه) وعدّاد ظاهر. */
const ImgGen = (() => {
  const $ = id => document.getElementById(id), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = m => { try { (typeof toast2 === "function" ? toast2 : window.toast)(m); } catch (e) { } };
  const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
  const KEY = "alyssum_gp_gkey", FALKEY = "alyssum_fal_key";
  /* ── المقاسات: [المعرّف، التسمية، العرض، الارتفاع] مجمّعة بالمنصة ── */
  const SIZES = [
    ["المتجر", [["shop", "صورة منتج للمتجر (مربّعة)", 1000, 1000], ["shop43", "صورة منتج 4:5", 1000, 1250]]],
    ["Facebook", [["fb_post", "Facebook — منشور (1200×630)", 1200, 630], ["fb_sq", "Facebook — مربّع (1080×1080)", 1080, 1080], ["fb_story", "Facebook — قصة (1080×1920)", 1080, 1920], ["fb_cover", "Facebook — غلاف صفحة (1640×624)", 1640, 624]]],
    ["Instagram", [["ig_sq", "Instagram — مربّع (1080×1080)", 1080, 1080], ["ig_port", "Instagram — بورتريه (1080×1350)", 1080, 1350], ["ig_story", "Instagram — ستوري / Reels (1080×1920)", 1080, 1920]]],
    ["فيديو قصير", [["tt", "TikTok (1080×1920)", 1080, 1920], ["shorts", "YouTube Shorts (1080×1920)", 1080, 1920], ["wa_status", "حالة واتساب (1080×1920)", 1080, 1920]]],
    ["YouTube", [["yt_thumb", "YouTube — صورة مصغّرة (1280×720)", 1280, 720], ["yt_banner", "YouTube — غلاف القناة (2560×1440)", 2560, 1440]]],
    ["Google Ads", [["ga_land", "Google Ads — أفقي (1200×628)", 1200, 628], ["ga_sq", "Google Ads — مربّع (1200×1200)", 1200, 1200], ["ga_port", "Google Ads — عمودي (960×1200)", 960, 1200], ["ga_mr", "Google Ads — مستطيل متوسط (300×250)", 300, 250], ["ga_lb", "Google Ads — لوحة صغيرة (728×90)", 728, 90]]],
    ["أخرى", [["pin", "Pinterest (1000×1500)", 1000, 1500], ["x_post", "X / Twitter (1600×900)", 1600, 900], ["custom", "مخصّص…", 1080, 1080]]]
  ];
  const sizeOf = id => { for (const g of SIZES) for (const s of g[1]) if (s[0] === id) return { id: s[0], label: s[1], w: s[2], h: s[3] }; return null; };
  /* النسب التي يدعمها Alyssum API (aspectRatio) — نختار الأقرب ثم نقصّ بدقة */
  const ARS = [["1:1", 1], ["2:3", 2 / 3], ["3:2", 3 / 2], ["3:4", 3 / 4], ["4:3", 4 / 3], ["4:5", 4 / 5], ["5:4", 5 / 4], ["9:16", 9 / 16], ["16:9", 16 / 9], ["21:9", 21 / 9]];
  const nearAr = (w, h) => { const r = w / h; return ARS.slice().sort((a, b) => Math.abs(Math.log(a[1] / r)) - Math.abs(Math.log(b[1] / r)))[0][0]; };
  /* تكلفة الصورة التقريبية بالدولار (تسعير معلن، للتحذير فقط) */
  const PRICE = { "gemini-2.5-flash-image": .039, "gemini-2.5-flash-image-preview": .039, "gemini-3.1-flash-image": .067, "gemini-3-pro-image-preview": .134 };
  const PREF = ["gemini-2.5-flash-image", "gemini-2.5-flash-image-preview", "gemini-3.1-flash-image", "gemini-3-pro-image-preview"];
  const MLBL = { "gemini-2.5-flash-image": "قياسي", "gemini-2.5-flash-image-preview": "قياسي (تجريبي)", "gemini-3.1-flash-image": "سريع محسّن", "gemini-3-pro-image-preview": "احترافي" };
  const priceOf = m => PRICE[m] || .07;
  const S = { mode: "product", tab: "make", prod: null, srcBlob: null, srcName: "", res: null, resBlob: null, busy: false, models: null, lastModel: "" };
  const cfg = {
    budget: () => 0, /* بلا سقف محلي: المزوّد وحده يفرض الحدّ الفعلي */ spent: () => Number(LS.get("alyssum_ig_spent", "0")) || 0, count: () => Number(LS.get("alyssum_ig_count", "0")) || 0,
    model: () => LS.get("alyssum_ig_model", "auto"), provider: () => LS.get("alyssum_ig_provider", "gemini") === "fal" ? "fal" : "gemini", falModel: () => (LS.get("alyssum_ig_falmodel", "") || "fal-ai/nano-banana/edit").trim(), falPrice: () => Number(LS.get("alyssum_ig_falprice", "0.04")) || 0.04, lang: () => LS.get("alyssum_ig_lang", "ar"), fmt: () => LS.get("alyssum_ig_fmt", "webp")
  };
  const money = n => "$" + (Math.round(n * 1000) / 1000).toFixed(3);          // داخلي فقط: لا تُعرض قيم الاستهلاك للمستخدم
  /* رصيد Alyssum API: لا تُعرض قيم الاستهلاك ولا التكلفة؛ تُعرض حالة الرصيد فقط (كافٍ / على وشك النفاد / نفد) ونسبة المتبقي،
     ويصل إشعار تلقائي (تنبيه في اللوحة + إشعار المتصفح إن أُذن) مرة عند الاقتراب من النفاد (≤20%) ومرة عند النفاد، ويُمسح بتجديد الرصيد أو رفع السقف. */
  const AIA = "alyssum_ai_alert", AIOUT = "alyssum_ai_out", LOWFRAC = 0.2;
  const unitCost = () => cfg.provider() === "fal" ? cfg.falPrice() : (cfg.model() === "auto" ? PRICE[PREF[0]] : priceOf(cfg.model()));
  const credit = {
    state() { if (LS.get(AIOUT, "0") === "1") return "out"; const b = cfg.budget(); if (!b) return "ok"; const left = b - cfg.spent(); if (left < unitCost()) return "out"; return left <= b * LOWFRAC ? "low" : "ok"; },
    pct() { const b = cfg.budget(); return b ? Math.max(0, Math.min(100, Math.round((b - cfg.spent()) / b * 100))) : null; },
    last() { try { return JSON.parse(LS.get(AIA, "null")) || null; } catch (e) { return null; } },
    msg(s, p) { return s === "out" ? "⛔ نفد رصيد Alyssum API — تتوقف الأدوات حتى تجديد الرصيد" : "⚠️ رصيد Alyssum API على وشك النفاد" + (p != null ? " (متبقٍ نحو " + p + "٪)" : ""); },
    note() {
      const s = credit.state(), prev = (credit.last() || {}).state || "";
      if (s === "ok") { if (prev) LS.set(AIA, "null"); return s; }
      if (prev === s) return s;
      LS.set(AIA, JSON.stringify({ state: s, at: Date.now() })); const p = credit.pct(), m = credit.msg(s, p);
      toast(m); try { window.dispatchEvent(new CustomEvent("alyssum:ai-credit", { detail: { state: s, pct: p } })); } catch (e) { }
      try { if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Alyssum API", { body: m }); } catch (e) { }
      return s;
    },
    flagOut() { LS.set(AIOUT, "1"); credit.note(); },
    renew() { LS.set(AIOUT, "0"); credit.note(); },
  };
  /* رفض الخدمة بسبب الرصيد/الحصة عند المزوّد (لا قيمة تُعرض): يعلَّم الرصيد منتهياً فيصل الإشعار */
  /* يطلب إذن إشعارات المتصفح مرة بعد حفظ المفتاح كي يصل التنبيه حتى والتبويب في الخلفية */
  const askNotify = () => { try { if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission(); } catch (e) { } };
  const billingHit = (status, text) => status === 402 || ((status === 403 || status === 429) && /quota|exhaust|insufficient|balance|billing|credit|limit exceeded|locked/i.test(String(text || "")));
  const useMsg = (title, detail) => title + " — سيستهلك من رصيد Alyssum API." + (detail ? "\n" + detail : "") + "\nمتابعة؟";
  const lowMsg = "رصيد Alyssum API لا يكفي لهذه العملية — جدّد الرصيد";
  const LANGS = { ar: ["العربية", "Arabic (right-to-left, perfectly shaped connected letters)"], fr: ["الفرنسية", "French"], en: ["الإنجليزية", "English"] };

  /* ───────── التعليمات (instruction) لكل نوع ─────────
     جودة الصورة تعتمد على هذه التعليمات: دور + موجز + اتجاه فني خاص بنوع المنتج + مواصفات كاميرا وإضاءة + تركيب حسب المقاس
     + قواعد أمانة المنتج + (نص أو مساحة فارغة للنص) + منع الأخطاء الشائعة. */
  const ART = [
    ["honey", /عسل|نحل|شهد|مربى|honey|miel|dattes?|تمر/i, "Warm artisanal food-photography look: raw wood or dark slate surface, golden honey drips and a wooden dipper, honeycomb pieces, a few wildflowers or herbs; amber backlight with soft glow through the honey, warm color grade (golds, ambers, deep browns), shallow depth of field with creamy bokeh."],
    ["herbal", /أعشاب|عشب|زيت|زيوت|حبة البركة|سدر|أرغان|اركان|herb|huile|oil|plantes?|tisane|شاي/i, "Natural apothecary mood: rustic wood or stone surface, fresh and dried herbs, seeds and leaves arranged around the product, glass dropper bottles and small bowls as props; soft window daylight from the side, earthy greens and warm browns, gentle mist or sunlight rays, organic and trustworthy."],
    ["skin", /كريم|بشرة|وجه|سيروم|مرطب|عناية|تجميل|شعر|شامبو|صابون|cream|skin|serum|cosmetic|beauty|soin|visage|cheveux|lotion/i, "Clean premium skincare editorial: soft pastel or neutral seamless backdrop with a gentle gradient, a clean acrylic/stone/marble pedestal or podium, subtle botanical elements and water drops or cream swatch textures; large soft-box key light with delicate shadows and a soft rim light, airy and elegant, high-end beauty-brand feel."],
    ["supp", /مكمل|فيتامين|بروتين|كبسول|أوميغا|مغنيسيوم|protein|vitamin|supplement|capsule|creatine|complément/i, "Energetic wellness/sports look: dynamic gradient backdrop (deep teal to lime or navy to electric blue), glossy reflective surface, floating ingredient elements (fruits, leaves, powder splashes) around the product, dramatic rim lighting, crisp and powerful, clinical-trust cleanliness."],
    ["perfume", /عطر|عود|مسك|بخور|perfume|parfum|fragrance|oud/i, "Luxury fragrance campaign: dark moody or silk-draped backdrop, polished reflective surface, rim light with sparkle, floating petals or mist, gold accents; cinematic contrast, sophisticated and sensual (no people)."],
    ["jewel", /مجوهر|خاتم|سوار|قلادة|عقد|ذهب|فضة|ألماس|jewel|ring|bracelet|necklace|gold|silver|bijou/i, "High-jewelry macro look: velvet, satin or dark acrylic base with soft reflections, tiny bokeh sparkles, precise specular highlights on metal and stones, 100mm macro lens feel, shallow depth of field, elegant and rich."],
    ["watch", /ساعة|ساعات|watch|montre/i, "Premium watch campaign: dark textured surface (leather, carbon, stone) with controlled reflections, dramatic side lighting revealing dial details, subtle smoke or light streaks, macro sharpness on the dial, masculine and precise."],
    ["fashion", /ملابس|قميص|فستان|حذاء|حقيبة|نظارة|حزام|أزياء|إكسسوار|shirt|dress|shoe|bag|sunglass|fashion|vêtement|chaussure|sac/i, "Editorial fashion still-life: colored paper or textured wall backdrop with sculptural props (geometric blocks, fabric folds), hard-and-soft mixed lighting with crisp shadows, bold color story, stylish magazine composition."],
    ["tech", /هاتف|حاسوب|لابتوب|سماعة|شاحن|كاميرا|laptop|phone|headphone|charger|gadget|tech|ordinateur|électronique/i, "Sleek tech showcase: dark gradient studio with neon rim lights (cool cyan/violet), glossy reflective floor, subtle light streaks and particles, crisp edges, futuristic premium product-launch look."],
    ["food", /طعام|وجبة|حلويات|قهوة|عصير|شوكولا|food|coffee|chocolate|juice|snack|gâteau|café/i, "Appetizing food photography: styled table with natural textures, steam or condensation where relevant, fresh ingredients around, warm directional daylight, rich saturated colors, mouth-watering and fresh."],
    ["home", /منزل|مطبخ|أثاث|ديكور|تنظيف|home|kitchen|furniture|decor|maison|cuisine/i, "Lifestyle home setting: bright modern interior corner with natural light, tasteful props (plants, linen, wood), soft shadows, calm and aspirational, product naturally placed in context."]
  ];
  const artOf = (name, desc) => { const t = (name || "") + " " + (desc || ""); for (const a of ART) if (a[1].test(t)) return { id: a[0], text: a[2] }; return { id: "general", text: "Premium commercial studio look: a seamless backdrop in a color that complements the product's packaging, a simple elegant pedestal or surface, a few restrained props that hint at the product's use, soft-box key light with gentle fill and a subtle rim light, clean and contemporary." }; };
  const CAMERA = "Shot like a high-end commercial photograph: 85mm lens, f/5.6 for a crisp product with softly blurred background, key softbox + fill + rim light, physically plausible reflections and contact shadows, color-graded, 4K detail, no noise.";
  const RULES = "PRODUCT FIDELITY (highest priority): the attached photo is the exact product. Reproduce it faithfully — same shape, proportions, cap/closure, materials, label artwork, colors and any text printed on the packaging. Do not redesign, rename, recolor, mirror, duplicate or crop it; show it completely, upright, sharp and well lit. Exactly ONE product unless the photo itself shows a set.\nCLEAN OUTPUT: no watermarks, no stock marks, no website names, no extra logos or brand names, no UI elements, no borders or frames, no collage. Do NOT include any people, faces, hands or body parts. No distorted objects, no melted or garbled details, no floating random shapes.";
  const layoutKind = (w, h) => { const r = h / w; return r > 1.45 ? "story" : r > 1.1 ? "portrait" : r > .9 ? "square" : r > .45 ? "landscape" : "banner"; };
  /* مساحة فارغة تُترك للنص حسب شكل المقاس (RTL: عمود النص على اليمين) */
  function textArea(kind, lang) {
    const side = lang === "ar" ? "RIGHT" : "LEFT";
    return { story: "Compose the product in the middle band of the frame. Keep the TOP 22% and the BOTTOM 24% as clean, calm, low-detail areas (soft gradient or blurred backdrop) reserved for overlay text.",
      portrait: "Compose the product in the lower-middle of the frame. Keep the TOP 26% as a clean, calm, low-detail area reserved for a headline, and the BOTTOM 14% calm for a button.",
      square: "Compose the product slightly below center. Keep the TOP 24% as a clean low-detail area reserved for a headline, and the BOTTOM 14% calm for a button.",
      landscape: "Place the product on the " + (side === "RIGHT" ? "LEFT" : "RIGHT") + " 50% of the frame. Keep the " + side + " 42% as a clean, calm, low-detail area (soft gradient / blurred backdrop) reserved for overlay text.",
      banner: "Place the product at one end; keep the opposite half clean and calm for overlay text." }[kind];
  }
  function textBlock(txt, lang) {
    const L = LANGS[lang] || LANGS.ar, lines = txt.split("\n").map(x => x.trim()).filter(Boolean);
    return "TEXT ON IMAGE: render ONLY the following " + L[1] + " copy, as a clear typographic hierarchy (first line = large bold headline, then smaller supporting line(s), a last short line may be a call-to-action pill/button). Each quoted line EXACTLY ONCE, character by character as written, correctly spelled" + (lang === "ar" ? " with proper Arabic letter shaping, connected letters, correct diacritics and right-to-left order" : "") + ". Use a clean modern typeface, strong contrast against the background (add a soft shadow or a subtle translucent panel if needed), generous margins inside the safe area, never overlapping or hiding the product.\n" + lines.map(x => '"' + x + '"').join("\n") + "\nDo not add, translate, repeat, abbreviate or alter any word. No other text, numbers, prices or logos anywhere.";
  }
  function buildPrompt(o) {
    const kind = layoutKind(o.w, o.h), art = artOf(o.name, o.desc), sz = o.w + "x" + o.h + " px (aspect ratio " + o.ar + ", " + kind + " format)";
    const tm = o.textMode || (o.text ? "gemini" : "none");
    const textPart = tm === "gemini" && o.text ? textBlock(o.text, o.lang) : (tm === "builder" ? "NO TEXT: render absolutely no text, letters, numbers, logos or captions — text will be added later by the designer.\n" + textArea(kind, o.lang) : "NO TEXT: render absolutely no text, letters, numbers, logos or captions anywhere in the image.");
    const flat = o.bgMode === "solid" || o.bgMode === "transp", hex = (o.bgColor || "#FFFFFF").toUpperCase();
    const flatTxt = "BACKGROUND (highest priority): a perfectly flat, uniform, solid " + hex + " background (exact color " + hex + ") filling the ENTIRE frame edge to edge — no gradient, no vignette, no texture, no floor or horizon line, no props, no scenery, no reflections on the backdrop" + (o.bgMode === "transp" ? "; absolutely no cast shadow, glow or contact shadow, and keep every edge of the product crisp and sharply separated from the background so the background can be removed cleanly; the product itself must not contain the color " + hex : "; only a very soft contact shadow directly under the product is allowed") + ". The product is the only subject, centered, upright, completely visible, filling about 60-70% of the frame.";
    const head = flat ? (o.mode === "product"
      ? ["ROLE: you are a world-class commercial product photographer and retoucher.", "BRIEF: create a clean e-commerce PRODUCT PACKSHOT.", "PRODUCT: " + (o.name || "see attached photo") + (o.desc ? "\nDETAILS: " + o.desc : ""), flatTxt]
      : ["ROLE: you are an award-winning advertising art director creating a clean ad-ready packshot.", "BRIEF: create an ADVERTISING PRODUCT IMAGE for the platform below on a plain background.", "PRODUCT: " + (o.name || "see attached photo") + (o.desc ? "\nKEY BENEFIT / DETAILS: " + o.desc : "") + (o.goal ? "\nCAMPAIGN ANGLE / OFFER: " + o.goal : ""), "PLATFORM: " + (o.platform || "social") + ".", flatTxt])
      : o.mode === "product"
      ? ["ROLE: you are a world-class commercial product photographer and retoucher.", "BRIEF: create a professional e-commerce PRODUCT PHOTO.",
        "PRODUCT: " + (o.name || "see attached photo") + (o.desc ? "\nDETAILS: " + o.desc : ""),
        "ART DIRECTION (" + art.id + "): " + art.text,
        "COMPOSITION: the product is the hero, filling about 55-70% of the frame, grounded on a surface with a believable contact shadow and subtle reflection; clear foreground / midground / background depth; the background supports the product without competing with it."]
      : ["ROLE: you are an award-winning advertising art director and photographer creating a social-media ad creative.", "BRIEF: create a scroll-stopping ADVERTISING IMAGE for the platform below.",
        "PRODUCT: " + (o.name || "see attached photo") + (o.desc ? "\nKEY BENEFIT / DETAILS: " + o.desc : "") + (o.goal ? "\nCAMPAIGN ANGLE / OFFER: " + o.goal : ""),
        "PLATFORM: " + (o.platform || "social") + ". Design for that placement" + (kind === "story" ? " (full-screen vertical: keep key content inside the safe zone, away from the top 12% and bottom 18% where app UI overlays appear)" : "") + ".",
        "ART DIRECTION (" + art.id + "): " + art.text + " Push it further for advertising: dramatic depth, dynamic composition with a strong focal point, rich lighting and a clear visual hierarchy; the product is large, sharp and unmistakably the star; add a few supporting elements that reinforce the benefit (ingredients, light effects, splashes) without clutter."];
    return [head.join("\n"), "CAMERA & LIGHT: " + (flat ? "Evenly lit studio packshot: soft diffused light from the front, no harsh shadows, true colors, razor-sharp edges, 4K detail, no noise." : CAMERA), (flat ? "The attached photo shows the product on a plain background — keep only the product and place it on the flat background described above." : "The attached photo shows the product on a plain (usually white) background — cleanly remove that background and place the product into the new scene."), "OUTPUT: exactly " + sz + ". Fill the whole frame edge to edge.", textPart, RULES, "FINAL CHECK before answering: product identical to the reference, nothing cropped, no extra text or logos, no people, clean photorealistic result."].join("\n\n");
  }

  /* ───────── الاتصال بـ Alyssum API ───────── */
  const getKey = () => (($("ig-key") && $("ig-key").value.replace(/[\s"']/g, "")) || LS.get(KEY, "")).trim();
  function gerr(status, msg, reason) {
    const raw = msg ? " (" + msg.slice(0, 160) + ")" : "";
    if (/API_KEY_SERVICE_BLOCKED/.test(reason || "") || /API_KEY_SERVICE_BLOCKED/.test(msg)) return "المفتاح مقيَّد ولا يسمح بواجهة Generative Language API — أنشئ مفتاحاً جديداً من لوحة المزوّد بمشروع بلا قيود.";
    if (/API key not valid|API_KEY_INVALID/i.test(msg)) return "المفتاح غير صالح — تأكد من نسخه كاملاً.";
    if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) return "تجاوزت الحصة أو أن نماذج الصور تتطلب تفعيل الفوترة (Billing) في مشروع المفتاح — فعّلها بحدّ إنفاق صغير (مثلاً 5$) من لوحة المزوّد." + raw;
    if (status === 403) return "المفتاح لا يملك صلاحية هذا النموذج أو الخدمة غير متاحة في منطقتك." + raw;
    if ([500, 502, 503, 504].includes(status)) return "النموذج مشغول مؤقتاً — أعد المحاولة بعد دقائق." + raw;
    if (status === 400 && /SAFETY|blocked|prohibited/i.test(msg)) return "رفض النموذج الطلب لأسباب أمان — غيّر الوصف أو النص." + raw;
    return (msg || "Alyssum API " + status) + raw;
  }
  async function listModels(key) {
    if (S.models && S.models.key === key) return S.models.names;
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key } }), j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(gerr(r.status, (j.error && j.error.message) || "", ((((j.error || {}).details || [])[0]) || {}).reason)); e.status = r.status; throw e; }
    const names = (j.models || []).map(m => String(m.name).replace(/^models\//, "")).filter(n => /image/i.test(n) && !/embedding|tts/i.test(n));
    S.models = { key, names }; return names;
  }
  const PRO_FIRST = ["gemini-3-pro-image-preview", "gemini-3.1-flash-image", "gemini-2.5-flash-image"];
  async function pickModels(key, pro) {
    const m = cfg.model(); if (m !== "auto") return [m];
    let names = []; try { names = await listModels(key); } catch (e) { if (e.status) throw e; }
    if (pro) { const pl = PRO_FIRST.filter(x => names.includes(x)); if (pl.length) return pl.slice(0, 2); }   // نصوص عربية دقيقة تحتاج النموذج الاحترافي (القياسي يشوّه الحروف)
    const pick = PREF.filter(x => names.includes(x)), rest = names.filter(n => !pick.includes(n)).sort((a, b) => priceOf(a) - priceOf(b));
    const list = pick.concat(rest).slice(0, 2); return list.length ? list : [PREF[0]];
  }
  const b64 = blob => new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(",")[1]); f.onerror = rej; f.readAsDataURL(blob); });
  async function shrink(blob, max) {
    const u = URL.createObjectURL(blob), im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; }); URL.revokeObjectURL(u);
    const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(res, "image/jpeg", .9));
  }
  /* طلب واحد (لا إعادة محاولة تلقائية متكررة حفاظاً على الرصيد): نموذج أول، ثم بديل واحد فقط عند 404/503 */
  async function callModel(key, parts, ar, pro) {
    const models = await pickModels(key, pro); let last = null;
    for (const m of models) {
      const body = { contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageConfig: { aspectRatio: ar } } };
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        const pt = (((((j.candidates || [])[0] || {}).content || {}).parts) || []).find(x => x.inlineData || x.inline_data), d = pt && (pt.inlineData || pt.inline_data);
        if (!d) { last = new Error("لم يُرجع النموذج صورة" + ((j.promptFeedback && j.promptFeedback.blockReason) ? " (محجوب: " + j.promptFeedback.blockReason + ")" : "") + " — لم تُحتسب تكلفة غالباً."); continue; }
        const bin = atob(d.data), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return { blob: new Blob([arr], { type: d.mimeType || d.mime_type || "image/png" }), model: m };
      }
      const em = (j.error && j.error.message) || "", reason = ((((j.error || {}).details || [])[0]) || {}).reason; last = new Error(gerr(r.status, em, reason)); last.status = r.status; if (billingHit(r.status, em + " " + reason)) credit.flagOut();
      if (r.status === 404 || [500, 502, 503, 504].includes(r.status)) continue; throw last;
    }
    throw last || new Error("تعذّر توليد الصورة");
  }
  /* fal.ai: تعديل صورة بمرجع (REST مباشر بمفتاح المتصفح). نموذج قابل للضبط؛ kontext يقبل aspect_ratio */
  async function callFal(key, prompt, dataUrl, ar) {
    const m = cfg.falModel().replace(/^\/+|\/+$/g, ""), body = { prompt, image_urls: [dataUrl], num_images: 1, output_format: "png" };
    if (/kontext/i.test(m)) { body.image_url = dataUrl; body.aspect_ratio = ar; delete body.num_images; }
    const r = await fetch("https://fal.run/" + m, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Key " + key }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && billingHit(r.status, JSON.stringify(j))) credit.flagOut();
    if (!r.ok) { const d = j.detail; const e = new Error("Alyssum API (ب) " + r.status + ": " + (typeof d === "string" ? d : Array.isArray(d) && d[0] ? (d[0].msg || JSON.stringify(d[0])) : (j.message || "خطأ")) + (r.status === 401 || r.status === 403 ? " — تحقق من المفتاح" : "")); e.status = r.status; throw e; }
    const u = (((j.images || [])[0]) || j.image || {}).url; if (!u) throw new Error("لم يُرجع fal صورة — لم تُحتسب تكلفة غالباً.");
    const img = await fetch(u); if (!img.ok) throw new Error("تعذّر تنزيل الصورة الناتجة من fal");
    return { blob: await img.blob(), model: "fal:" + m, cost: cfg.falPrice() };
  }
  /* قصّ/تكبير إلى المقاس بالبكسل (cover) */
  async function fit(blob, W, H) {
    const u = URL.createObjectURL(blob), im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); x.imageSmoothingQuality = "high";
    const k = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k; x.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); URL.revokeObjectURL(u); return c;
  }

  /* ───────── الواجهة ───────── */
  const prods = () => ((typeof Admin !== "undefined" && Admin.products) || []).filter(p => p && p.active !== false);
  const coverOf = p => p && (p.cover || (p.images && p.images[0])) || "";
  function sizeOptions(sel) { return SIZES.map(g => `<optgroup label="${esc(g[0])}">${g[1].map(s => `<option value="${s[0]}"${s[0] === sel ? " selected" : ""}>${esc(s[1])}</option>`).join("")}</optgroup>`).join(""); }
  function costBar() {
    const st = credit.state(), p = credit.pct(), lbl = st === "out" ? "نفد" : st === "low" ? "على وشك النفاد" : "كافٍ";
    return `<div class="ig-cost"><span>رصيد Alyssum API: <b style="color:${st === "out" ? "#fca5a5" : st === "low" ? "#fcd34d" : "#86efac"}">${lbl}</b>${p != null ? ` (${p}٪)` : ""}</span><span>${cfg.count()} عملية</span></div>`;
  }
  function render() {
    const box = $("ig-body"); if (!box) return; const t = S.tab, m = S.mode;
    const tabs = [["make", "إنشاء صورة"], ["set", "الإعدادات"]];
    const hd = `<div class="ap-h"><h3>مولّد الصور</h3></div><div class="ap-tabs">${tabs.map(x => `<button type="button" class="${x[0] === t ? "on" : ""}" onclick="ImgGen.tab('${x[0]}')">${x[1]}</button>`).join("")}</div>` + costBar();
    if (t === "set") { box.innerHTML = hd + settingsHtml(); return; }
    const sizeId = LS.get("alyssum_ig_size_" + m, m === "product" ? "shop" : "ig_sq"), sz = sizeOf(sizeId) || sizeOf("shop"), lang = cfg.lang(), tm = txtMode(), bgm = LS.get("alyssum_ig_bgm", "scene");
    box.innerHTML = hd + `
<div class="ig-modes"><button type="button" class="${m === "product" ? "on" : ""}" onclick="ImgGen.mode('product')"><b>صورة منتج</b><small>خلفية مناسبة لنوع المنتج بالمقاس المحدّد</small></button><button type="button" class="${m === "ad" ? "on" : ""}" onclick="ImgGen.mode('ad')"><b>صورة إشهارية</b><small>تصميم إعلاني لمنصات التواصل والإعلانات</small></button></div>
<div class="ig-grid">
 <div class="ig-col">
  <div class="field"><label>1) صورة المنتج (PNG بخلفية بيضاء)</label>
   <div class="ig-src"><label class="small gold" style="cursor:pointer">رفع صورة<input type="file" accept="image/*" style="display:none" onchange="ImgGen.file(this)"></label>
   <select id="ig-prod" onchange="ImgGen.pickProd(this.value)"><option value="">— أو اختر من منتجاتك —</option>${prods().map(p => `<option value="${esc(p.slug)}"${S.prod === p.slug ? " selected" : ""}>${esc(p.title)}</option>`).join("")}</select></div>
   <div id="ig-prev" class="ig-prev">${S.srcBlob ? "" : "لم تُحدَّد صورة بعد"}</div>
   <div id="ig-gal" class="ig-gal"></div></div>
  <div class="field"><label>2) المقاس</label><select id="ig-size" onchange="ImgGen.size(this.value)">${sizeOptions(sizeId)}</select>
   <div class="ig-cus" id="ig-cus" style="display:${sizeId === "custom" ? "flex" : "none"}"><input id="ig-w" type="number" min="64" max="4096" value="${LS.get("alyssum_ig_w", 1080)}" onchange="ImgGen.cus()"> × <input id="ig-h" type="number" min="64" max="4096" value="${LS.get("alyssum_ig_h", 1080)}" onchange="ImgGen.cus()"> px</div>
   <div class="hint" id="ig-sz">${sz.w}×${sz.h}px — النسبة المُرسلة للنموذج ${nearAr(sz.w, sz.h)} ثم تُقصّ بدقة</div></div>
 </div>
 <div class="ig-col">
  <div class="field"><label>3) اسم المنتج</label><input id="ig-name" type="text" value="${esc(LS.get("alyssum_ig_name", ""))}" placeholder="مثال: عسل السدر الجبلي"></div>
  <div class="field"><label>الوصف</label><textarea id="ig-desc" rows="3" placeholder="مكوّنات، فائدة، نوع المنتج…">${esc(LS.get("alyssum_ig_desc", ""))}</textarea></div>
  ${m === "ad" ? `<div class="field"><label>فكرة الحملة / العرض (اختياري)</label><input id="ig-goal" type="text" placeholder="مثال: خصم 30% لفترة محدودة — الدفع عند الاستلام"></div>` : ""}
  <div class="field"><label>4) نوع الصورة وخلفيتها</label>
   <select id="ig-bgm" onchange="ImgGen.bgm(this.value)"><option value="scene"${bgm === "scene" ? " selected" : ""}>مشهد مناسب للمنتج (خلفية فنية)</option><option value="solid"${bgm === "solid" ? " selected" : ""}>PNG بخلفية بلون موحّد</option><option value="transp"${bgm === "transp" ? " selected" : ""}>PNG بخلفية شفافة</option></select>
   <div id="ig-bgcbox" style="display:${bgm === "solid" ? "flex" : "none"};align-items:center;gap:.5rem;margin-top:.4rem"><span class="hint" style="margin:0">لون الخلفية</span><input id="ig-bgc" type="color" value="${esc(LS.get("alyssum_ig_bgc", "#ffffff"))}" onchange="ImgGen.bgc(this.value)" style="width:56px;height:36px;padding:2px"></div>
   <div class="hint">الخلفية الموحّدة والشفافة تُحفظان بصيغة PNG. الشفافة تُزال خلفيتها تلقائياً بعد التوليد.</div></div>
  <div class="field"><label>5) ما يُضاف إلى الصورة</label>
   <label class="tl-r" style="cursor:pointer"><span>إضافة اسم المنتج إلى الصورة</span><input type="checkbox" id="ig-t-name"${LS.get("alyssum_ig_t_name", "0") === "1" ? " checked" : ""} onchange="ImgGen.tog()"></label>
   <label class="tl-r" style="cursor:pointer"><span>إضافة الوصف إلى الصورة</span><input type="checkbox" id="ig-t-desc"${LS.get("alyssum_ig_t_desc", "0") === "1" ? " checked" : ""} onchange="ImgGen.tog()"></label>
   ${m === "ad" ? `<label class="tl-r" style="cursor:pointer"><span>إضافة فكرة الحملة إلى الصورة</span><input type="checkbox" id="ig-t-goal"${LS.get("alyssum_ig_t_goal", "0") === "1" ? " checked" : ""} onchange="ImgGen.tog()"></label>` : ""}
   <div id="ig-txtbox" style="display:${tm === "none" ? "none" : "block"}">
    <select id="ig-txtm" onchange="ImgGen.txtm(this.value)"><option value="builder"${tm !== "gemini" ? " selected" : ""}>النص في المطوّر (عربي سليم وقابل للتعديل)</option><option value="gemini"${tm === "gemini" ? " selected" : ""}>النص مرسوم داخل الصورة بـ Alyssum API (لا يُعدَّل)</option></select>
    <textarea id="ig-txt" rows="4" oninput="ImgGen.txtEdited()" placeholder="كل سطر = عبارة. السطر الأول عنوان، الوسطى وصف، وآخر سطر قصير يصير زراً (عند 3 أسطر فأكثر)">${esc(LS.get("alyssum_ig_txt", ""))}</textarea>
    <select id="ig-lang" onchange="ImgGen.lang(this.value)">${Object.keys(LANGS).map(k => `<option value="${k}"${k === lang ? " selected" : ""}>لغة النص: ${LANGS[k][0]}</option>`).join("")}</select></div></div>
 </div>
</div>
<div class="action-bar"><button type="button" class="small" id="ig-go" onclick="ImgGen.generate()">✨ توليد صورة</button><button type="button" class="small gold" id="ig-go2" onclick="ImgGen.generate('editor')">🧩 إنشاء الصورة في المطوّر</button>${m === "ad" ? `<button type="button" class="small gray" onclick="ImgGen.blank()" title="يفتح المطوّر بصفحة فارغة بمقاس المنصة لتصمّم عليها بلا توليد">لوحة فارغة بهذا المقاس</button>` : ""}<span class="hint" id="ig-est"></span></div>
<div class="hint" id="ig-msg"></div>
<div id="ig-res" class="ig-res"></div>`;
    paintPrev(); paintEst();
  }
  function settingsHtml() {
    const fal = cfg.provider() === "fal";
    return `<div class="ap-sec"><b>تفعيل Alyssum API</b><div class="tl-s"><label class="tl-r" style="cursor:pointer"><span>تفعيل توليد الصور</span><input type="checkbox" ${LS.get("alyssum_ai_img", "1") === "0" ? "" : "checked"} onchange="try{localStorage.setItem('alyssum_ai_img',this.checked?'1':'0')}catch(e){}"></label><div class="hint">عند التعطيل يتوقف توليد الصور من هنا ومن تبويب السوشيال. تفعيل/تعطيل توليد النص من «السوشيال ← الاتصال والإعدادات».</div></div></div>
<div class="ap-sec"><b>مزوّد التوليد</b><div class="hint">اختر مسار التوليد: «Alyssum API — المسار أ» أو «المسار ب» (نماذج تعديل بصورة مرجعية). لكل مسار مفتاحه الخاص المحفوظ في هذا المتصفح فقط.</div><div class="tl-s"><div class="tl-r"><span>المزوّد</span><select onchange="ImgGen.set('provider',this.value);ImgGen.tab('set')"><option value="gemini"${fal ? "" : " selected"}>Alyssum API — المسار أ</option><option value="fal"${fal ? " selected" : ""}>Alyssum API — المسار ب</option></select></div>
${fal ? `<div class="tl-r"><span>مفتاح Alyssum API (المسار ب)</span><input id="ig-fkey" type="password" autocomplete="off" placeholder="key_id:key_secret" value="${esc(LS.get(FALKEY, ""))}" onchange="ImgGen.saveFalKey()"></div><div class="tl-r"><span>معرّف النموذج</span><input dir="ltr" value="${esc(cfg.falModel())}" placeholder="fal-ai/nano-banana/edit" onchange="ImgGen.set('falmodel',this.value.trim())"></div><div class="tl-r"><span>تكلفة الصورة التقريبية (دولار)</span><input type="number" step="0.005" min="0" value="${cfg.falPrice()}" onchange="ImgGen.set('falprice',this.value)"></div><div class="hint">احصل على المفتاح من لوحة مزوّد هذا المسار. النماذج المقترحة: <code>fal-ai/nano-banana/edit</code> (افتراضي) أو <code>fal-ai/flux-pro/kontext</code>. السعر يدوي لأن التسعير يختلف حسب النموذج؛ راجع الرصيد الفعلي في لوحة المزوّد. إن حجب المتصفح الطلب فأخبرنا لنضيف وسيطاً.</div>` : ""}</div></div>
${typeof AiProxy !== "undefined" && !fal ? AiProxy.html() : ""}
<div class="ap-sec"${fal ? ' style="display:none"' : ""}><b>مفتاح Alyssum API (المسار أ)</b><div class="hint">يُحفظ في هذا المتصفح فقط. احصل عليه من لوحة مزوّد الخدمة (مشروع جديد بلا قيود)، ونماذج الصور تتطلب تفعيل الفوترة بحدّ إنفاق صغير. المفتاح نفسه يعمل لتوليد النصوص في السوشيال.</div>
<div class="tl-s"><input id="ig-key" type="password" autocomplete="off" placeholder="AIza…" value="${esc(LS.get(KEY, ""))}" onchange="ImgGen.saveKey()"><div class="action-bar"><button type="button" class="small" onclick="ImgGen.test()">اختبار المفتاح</button></div><div class="hint" id="ig-tmsg"></div></div></div>
<div class="ap-sec"><b>رصيد الاستعمال</b><div class="tl-s">
<div class="tl-r"><span>النموذج</span><select onchange="ImgGen.set('model',this.value)"><option value="auto"${cfg.model() === "auto" ? " selected" : ""}>تلقائي — الأرخص أولاً (≈ $0.039 للصورة)</option>${PREF.map(m => `<option value="${m}"${cfg.model() === m ? " selected" : ""}>${MLBL[m] || m} (≈ ${money(priceOf(m))})</option>`).join("")}</select></div>
<div class="tl-r"><span>صيغة الحفظ في المكتبة</span><select onchange="ImgGen.set('fmt',this.value)"><option value="webp"${cfg.fmt() === "webp" ? " selected" : ""}>WebP (أخف)</option><option value="png"${cfg.fmt() === "png" ? " selected" : ""}>PNG</option></select></div>
<div class="hint">لا يوجد سقف محلي: الحدّ الفعلي هو رصيد المزوّد وحده. لا إعادة محاولة تلقائية: كل ضغطة = صورة واحدة.</div></div></div>`;
  }
  function paintPrev() {
    const p = $("ig-prev"); if (!p) return; if (!S.srcBlob) return;
    const u = URL.createObjectURL(S.srcBlob); p.innerHTML = `<img src="${u}" alt=""><small>${esc(S.srcName || "")}</small>`;
  }
  function paintEst() {
    const el = $("ig-est"); if (!el) return; const st = credit.state(), p = credit.pct();
    el.textContent = st === "out" ? "⛔ نفد رصيد Alyssum API" : st === "low" ? "⚠️ رصيد Alyssum API على وشك النفاد" + (p != null ? " (متبقٍ " + p + "٪)" : "") : "يستهلك من رصيد Alyssum API" + (p != null ? " · المتبقي " + p + "٪" : "");
  }
  async function loadFrom(slug) {
    const p = prods().find(x => x.slug === slug); S.prod = slug || null; if (!p) { S.srcBlob = null; render(); return; }
    const imgs = (p.images && p.images.length ? p.images : [coverOf(p)]).filter(Boolean).slice(0, 8);
    try { S.srcBlob = await (await fetch((typeof REL !== "undefined" ? REL : "") + coverOf(p), { cache: "force-cache" })).blob(); S.srcName = p.title; } catch (e) { toast("تعذّر تحميل صورة المنتج"); }
    { const n = $("ig-name"), d = $("ig-desc"), dd = (p.desc || "").slice(0, 300); if (!n.value || n.value === S.autoN) n.value = p.title; if (!d.value || d.value === S.autoD) d.value = dd; S.autoN = p.title; S.autoD = dd; }
    paintPrev(); const g = $("ig-gal");
    if (g) g.innerHTML = imgs.length > 1 ? imgs.map(i => `<img src="${esc((typeof REL !== "undefined" ? REL : "") + i)}" onclick="ImgGen.useImg('${esc(i)}')" title="استعمل هذه الصورة">`).join("") : "";
  }
  async function useImg(path) { try { S.srcBlob = await (await fetch((typeof REL !== "undefined" ? REL : "") + path)).blob(); paintPrev(); } catch (e) { toast("تعذّر تحميل الصورة"); } }
  function txtMode() { const v = LS.get("alyssum_ig_txtm", "none"); return v === "text" ? "gemini" : v; }
  function formSize() {
    const id = $("ig-size").value, sz = sizeOf(id); let W = sz.w, H = sz.h;
    if (id === "custom") { W = Math.max(64, Math.min(4096, Number($("ig-w").value) || 1080)); H = Math.max(64, Math.min(4096, Number($("ig-h").value) || 1080)); }
    return { id, label: sz.label, W, H };
  }
  function readForm() { ["name", "desc", "txt"].forEach(k => { const e = $("ig-" + k); if (e) LS.set("alyssum_ig_" + k, e.value); }); }

  /* لون خلفية مفتاحي للخلفية الشفافة: الأبعد عن ألوان المنتج (أبيض مفضَّل ما لم يكن المنتج فاتحاً) ليسهل نزع الخلفية بدقة */
  async function pickKey(blob) {
    try {
      const bm = await createImageBitmap(blob), c = document.createElement("canvas"); c.width = c.height = 48; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(bm, 0, 0, 48, 48);
      const d = g.getImageData(0, 0, 48, 48).data; let r = 0, gg = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128 || (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235)) continue; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
      if (n < 20) return "#FFFFFF"; r /= n; gg /= n; b /= n;
      const cand = [["#FFFFFF", [255, 255, 255], 70], ["#00D26A", [0, 210, 106], 0], ["#FF2BD6", [255, 43, 214], 0], ["#1E88FF", [30, 136, 255], 0]];
      return cand.map(k => [k[0], Math.hypot(r - k[1][0], gg - k[1][1], b - k[1][2]) + k[2]]).sort((x, y) => y[1] - x[1])[0][0];
    } catch (e) { return "#FFFFFF"; }
  }
  const autoLines = () => {
    const L = [], on = k => { const e = $("ig-t-" + k); return !!(e && e.checked); }, v = id => (($(id) || {}).value || "").trim();
    if (on("name") && v("ig-name")) L.push(v("ig-name"));
    if (on("desc") && v("ig-desc")) L.push(v("ig-desc").replace(/\s+/g, " ").slice(0, 110));
    if (on("goal") && v("ig-goal")) L.push(v("ig-goal"));
    return L;
  };
  function tog() {
    ["name", "desc", "goal"].forEach(k => { const e = $("ig-t-" + k); if (e) LS.set("alyssum_ig_t_" + k, e.checked ? "1" : "0"); });
    const any = ["name", "desc", "goal"].some(k => { const e = $("ig-t-" + k); return e && e.checked; }), t = $("ig-txt"), box = $("ig-txtbox");
    S.txtDirty = false; if (any) { if (txtMode() === "none") LS.set("alyssum_ig_txtm", "builder"); t.value = autoLines().join("\n"); } else { LS.set("alyssum_ig_txtm", "none"); t.value = ""; }
    LS.set("alyssum_ig_txt", t.value); const tm = txtMode(); box.style.display = tm === "none" ? "none" : "block"; const sel = $("ig-txtm"); if (sel && tm !== "none") sel.value = tm;
  }
  const fmtNow = () => (S.meta && S.meta.bgMode && S.meta.bgMode !== "scene") ? "png" : cfg.fmt();
  async function generate(after) {
    if (S.busy) return; const msg = $("ig-msg"), fal = cfg.provider() === "fal", key = fal ? LS.get(FALKEY, "") : (getKey() || LS.get(KEY, ""));
    const fs = formSize(), sz = fs, W = fs.W, H = fs.H;
    if (LS.get("alyssum_ai_img", "1") === "0") { if (msg) msg.textContent = "⛔ توليد الصور معطّل — فعّله من الإعدادات."; return; }
    if (!key) { S.tab = "set"; render(); toast("أدخل مفتاح Alyssum API أولاً"); return; }
    if (!S.srcBlob) { msg.textContent = "❌ اختر صورة المنتج أولاً (رفع أو من منتجاتك)"; return; }
    const name = $("ig-name").value.trim(), desc = $("ig-desc").value.trim(); if (!name && !desc) { msg.textContent = "❌ اكتب اسم المنتج أو وصفه"; return; }
    const bgMode = ($("ig-bgm") || {}).value || "scene"; let bgColor = bgMode === "solid" ? (($("ig-bgc") || {}).value || "#ffffff") : "#FFFFFF";
    const anyT = ["name", "desc", "goal"].some(k => { const e = $("ig-t-" + k); return e && e.checked; }); if (anyT && !S.txtDirty) { const t0 = $("ig-txt"); if (t0) t0.value = autoLines().join("\n"); if (txtMode() === "none") LS.set("alyssum_ig_txtm", "builder"); }
    let tmode = anyT ? (($("ig-txtm") || {}).value || "builder") : "none";
    if (bgMode === "transp" && tmode === "gemini") { tmode = "builder"; msg.textContent = "ℹ️ مع الخلفية الشفافة يُضاف النص في المطوّر (لا داخل الصورة)."; }
    const txt = tmode !== "none" ? ($("ig-txt").value || "").trim() : ""; if (tmode !== "none" && !txt) { msg.textContent = "❌ اكتب النص المطلوب أو ألغِ خيارات الإضافة"; return; }
    readForm();
    const models = cfg.model(), est = fal ? cfg.falPrice() : models === "auto" ? PRICE[PREF[0]] : priceOf(models), left = cfg.budget() ? cfg.budget() - cfg.spent() : Infinity;
    if (cfg.budget() && left < est) { msg.textContent = "⛔ " + lowMsg; credit.note(); return; }
    if (!confirm(useMsg("توليد صورة واحدة", "المقاس: " + W + "×" + H + " — " + (S.mode === "product" ? "صورة منتج" : "صورة إشهارية")))) return;
    S.busy = true; $("ig-go").disabled = true; if ($("ig-go2")) $("ig-go2").disabled = true; msg.textContent = "⏳ جارِ التوليد (قد يستغرق 10–40 ثانية)…";
    try {
      if (bgMode === "transp") bgColor = await pickKey(S.srcBlob);
      const ar = nearAr(W, H), prompt = buildPrompt({ mode: S.mode, name, desc, goal: ($("ig-goal") || {}).value ? $("ig-goal").value.trim() : "", text: txt, textMode: tmode, lang: $("ig-lang") ? $("ig-lang").value : "ar", w: W, h: H, ar, platform: sz.label, bgMode, bgColor });
      S.lastPrompt = prompt; const small = await shrink(S.srcBlob, 1400);
      const out = fal ? await callFal(key, prompt, "data:image/jpeg;base64," + await b64(small), ar) : await callModel(key, [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: await b64(small) } }], ar);
      let cv = await fit(out.blob, W, H), note = "";
      if (bgMode === "transp") {
        msg.textContent = "⏳ إزالة الخلفية…";
        try { if (typeof PBBgRemove === "undefined") throw new Error("أداة نزع الخلفية غير متاحة"); const r = await PBBgRemove.autoCut(cv, { methods: ["classic"], onStep: m => { msg.textContent = m; } }); cv = r.canvas; }
        catch (e) { note = " — ⚠️ تعذّرت إزالة الخلفية تلقائياً (" + (e.message || e) + ") فاستعمل «نزع الخلفية» من الأدوات"; }
      }
      S.res = cv; S.lastModel = out.model; S.resName = (name || "image").slice(0, 40); S.meta = { W, H, id: fs.id, label: fs.label, bgMode, bgColor, textMode: tmode, text: txt, lang: $("ig-lang") ? $("ig-lang").value : "ar", name };
      LS.set("alyssum_ig_spent", String(cfg.spent() + (out.cost || priceOf(out.model)))); LS.set("alyssum_ig_count", String(cfg.count() + 1)); LS.set(AIOUT, "0"); credit.note();
      showRes(cv, W, H); msg.textContent = "✅ تمّ بنموذج " + out.model + " — " + W + "×" + H + "px" + (bgMode !== "scene" ? " · PNG" : "") + note; const cb = document.querySelector(".ig-cost"); if (cb) cb.outerHTML = costBar(); paintEst();
      if (after === "editor") { S.busy = false; await ((S.mode === "ad" || (tmode === "builder" && txt)) ? openAd() : toEditor("current")); }
    } catch (e) { msg.textContent = "❌ " + e.message; } finally { S.busy = false; ["ig-go", "ig-go2"].forEach(i => { const g = $(i); if (g) g.disabled = false; }); }
  }
  function showRes(cv, W, H) {
    const r = $("ig-res"); if (!r) return; const u = cv.toDataURL((S.meta || {}).bgMode && S.meta.bgMode !== "scene" ? "image/png" : "image/webp", .92);
    const ad = S.mode === "ad", tm = (S.meta || {}).textMode;
    r.innerHTML = `<div class="ig-out"${(S.meta || {}).bgMode === "transp" ? ' style="background:repeating-conic-gradient(#d8d4c8 0 25%,#fff 0 50%) 50%/18px 18px"' : ""}><img src="${u}" alt=""></div><div class="action-bar">${ad ? `<button type="button" class="small" onclick="ImgGen.openAd()">فتح في المطوّر${tm === "builder" ? " (مع النص كطبقات قابلة للتعديل)" : " للتعديل والتصدير"}</button>` : `<button type="button" class="small" onclick="ImgGen.toEditor('current')">فتح في المطوّر (الصفحة المفتوحة)</button><button type="button" class="small" onclick="ImgGen.toEditor('new')">فتح في صفحة جديدة</button>`}<button type="button" class="small gold" onclick="ImgGen.toLibrary()">حفظ في المكتبة</button><button type="button" class="small gray" onclick="ImgGen.download()">تنزيل</button><button type="button" class="small gray" onclick="ImgGen.copyPrompt()">نسخ التعليمات</button></div>`;
  }
  const blobOf = (cv, fmt) => new Promise(res => cv.toBlob(res, fmt === "png" ? "image/png" : "image/webp", .92));
  /* توليد صورة واحدة دون واجهة المولّد (يستعمله تبويب السوشيال): o = {blob مرجع, name, desc, goal, W, H, label} ← {blob, model, cost} أو null إن ألغى المستخدم */
  async function quick(o) {
    const fal = cfg.provider() === "fal", key = (fal ? LS.get(FALKEY, "") : LS.get(KEY, "")).trim();
    if (LS.get("alyssum_ai_img", "1") === "0") { const e = new Error("OFF"); e.code = "OFF"; throw e; }
    if (!key) { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; }
    if (!o || !o.blob) throw new Error("اختر صورة المنتج المرجعية أولاً");
    const est = fal ? cfg.falPrice() : (cfg.model() === "auto" ? PRICE[PREF[0]] : priceOf(cfg.model())), left = cfg.budget() ? cfg.budget() - cfg.spent() : Infinity;
    if (cfg.budget() && left < est) { credit.note(); throw new Error(lowMsg); }
    if (o.confirm !== false && !confirm(useMsg("توليد صورة واحدة", "المقاس: " + o.W + "×" + o.H))) return null;
    const ar = nearAr(o.W, o.H), prompt = buildPrompt({ mode: "ad", name: o.name || "", desc: o.desc || "", goal: o.goal || "", text: "", textMode: "none", lang: "ar", w: o.W, h: o.H, ar, platform: o.label || "" });
    const small = await shrink(o.blob, 1400), d = await b64(small);
    const out = fal ? await callFal(key, prompt, "data:image/jpeg;base64," + d, ar) : await callModel(key, [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: d } }], ar);
    const cv = await fit(out.blob, o.W, o.H); LS.set("alyssum_ig_spent", String(cfg.spent() + (out.cost || priceOf(out.model)))); LS.set("alyssum_ig_count", String(cfg.count() + 1)); LS.set(AIOUT, "0"); credit.note();
    return { blob: await blobOf(cv, "webp"), model: out.model, cost: est };
  }
  /* هل الخدمة جاهزة؟ يستعملها محرّر الصور لإظهار الحالة بلا استدعاء: {ok, off, nokey} */
  function ready() {
    const fal = cfg.provider() === "fal", key = (fal ? LS.get(FALKEY, "") : LS.get(KEY, "")).trim(), off = LS.get("alyssum_ai_img", "1") === "0";
    return { ok: !!key && !off, off, nokey: !key };
  }
  /* تعديل صورة بتعليمات حرّة (توسيع الخلفية، تعديل بالوصف…) بنفس خدمة التوليد وضوابط التكلفة: o = {blob, prompt, W, H, confirm, extra: [blob…]} ← {blob, model, cost} أو null إن ألغى المستخدم.
     المقاس الناتج W×H (قصّ cover)؛ يرمي بالرمز OFF/NOKEY كما quick. */
  /* تقدير تكلفة طلب واحد والمتبقي من الحدّ (لأدوات تُرسل أكثر من طلب بموافقة واحدة) */
  function estimate() { const fal = cfg.provider() === "fal"; return { cost: fal ? cfg.falPrice() : (cfg.model() === "auto" ? PRICE[PREF[0]] : priceOf(cfg.model())), left: cfg.budget() ? cfg.budget() - cfg.spent() : Infinity, fmt: () => "", can: n => !cfg.budget() || (cfg.budget() - cfg.spent()) >= (n || 1) * unitCost() }; }
  async function edit(o) {
    const fal = cfg.provider() === "fal", key = (fal ? LS.get(FALKEY, "") : LS.get(KEY, "")).trim();
    if (LS.get("alyssum_ai_img", "1") === "0") { const e = new Error("OFF"); e.code = "OFF"; throw e; }
    if (!key) { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; }
    if (!o || (!o.blob && !o.textOnly) || !o.prompt) throw new Error("الصورة والتعليمات مطلوبتان");
    if (o.textOnly && fal) throw new Error("التوليد من وصف نصي فقط متاح مع الاتصال الأول (أ) — بدّل الاتصال من إعدادات مولّد الصور");
    const W = Math.max(64, Math.round(o.W)), H = Math.max(64, Math.round(o.H)), est = fal ? cfg.falPrice() : (cfg.model() === "auto" ? PRICE[PREF[0]] : priceOf(cfg.model())), left = cfg.budget() ? cfg.budget() - cfg.spent() : Infinity;
    if (cfg.budget() && left < est) { credit.note(); throw new Error(lowMsg); }
    if (o.confirm !== false && !confirm(useMsg(o.title || "تعديل للصورة", "المقاس الناتج: " + W + "×" + H))) return null;
    const ar = nearAr(W, H), small = o.blob ? await shrink(o.blob, 1600) : null, d = small ? await b64(small) : "", parts = o.blob ? [{ text: o.prompt }, { inline_data: { mime_type: "image/jpeg", data: d } }] : [{ text: o.prompt }];
    for (const x of (o.extra || []).slice(0, 2)) parts.push({ inline_data: { mime_type: "image/jpeg", data: await b64(await shrink(x, 1200)) } });
    let out;
    if (o.ar && !fal) { try { out = await callModel(key, parts, o.ar, o.pro); } catch (e) { if (e.status !== 400 && !/\[400|aspect|ratio|size|invalid.argument/i.test(String(e.message))) throw e; out = await callModel(key, parts, ar, o.pro); } }   // نسبة مخصصة (مثل 1:4 للصفحات الطويلة) ثم تراجع للأقرب المدعومة
    else out = fal ? await callFal(key, o.prompt, "data:image/jpeg;base64," + d, ar) : await callModel(key, parts, ar, o.pro);
    let cv; if (o.noFit) { const bm = await createImageBitmap(out.blob); cv = document.createElement("canvas"); cv.width = bm.width; cv.height = bm.height; cv.getContext("2d").drawImage(bm, 0, 0); } else cv = await fit(out.blob, W, H); LS.set("alyssum_ig_spent", String(cfg.spent() + (out.cost || priceOf(out.model)))); LS.set("alyssum_ig_count", String(cfg.count() + 1)); LS.set(AIOUT, "0"); credit.note();
    return { blob: await blobOf(cv, o.fmt === "png" ? "png" : "webp"), canvas: cv, model: out.model, cost: est };
  }
  /* ───────── توليد فيديو من صورة (1–4) ووصف أو قالب — عبر خدمة فيديو خارجية بمفتاح الاتصال الثاني (fal) ─────────
     نفس ضوابط التكلفة: تأكيد قبل التنفيذ، حدّ إنفاق، لا إعادة محاولة تلقائية. النموذج والسعر قابلان للضبط (alyssum_vg_model / alyssum_vg_price)
     لأن مواصفات الخدمة لم تُثبَّت بعد؛ الطلب يمرّ بطابور الخدمة: إرسال ← استعلام الحالة ← جلب الفيديو. o = {images:[blob], prompt, ratio:"9:16|1:1|16:9|4:5", dur, confirm} ← {blob, type, cost} أو null */
  const vcfg = { model: () => (LS.get("alyssum_vg_model", "") || "fal-ai/kling-video/v2.1/standard/image-to-video").trim().replace(/^\/+|\/+$/g, ""), price: () => Number(LS.get("alyssum_vg_price", "0.5")) || 0.5, dur: () => Math.max(3, Math.min(10, Number(LS.get("alyssum_vg_dur", "5")) || 5)) };
  const videoReady = () => { const off = LS.get("alyssum_ai_vid", "1") === "0", key = (LS.get(FALKEY, "") || "").trim(); return { ok: !!key && !off, off, nokey: !key, price: vcfg.price(), model: vcfg.model() }; };
  function videoBody(o, urls) {
    const body = { prompt: String(o.prompt || "").trim(), aspect_ratio: o.ratio || "9:16", duration: String(o.dur || vcfg.dur()) };
    if (o.audio) { body.generate_audio = true; if (o.script) body.audio_script = String(o.script).slice(0, 1500); if (o.lang) body.audio_language = o.lang; if (o.voice) body.voice = o.voice; if (o.seed) body.seed = o.seed; }
    if (urls.length === 1) body.image_url = urls[0]; else if (urls.length > 1) { body.image_url = urls[0]; body.image_urls = urls; }
    return body;
  }
  async function video(o) {
    const st = videoReady();
    if (st.off) { const e = new Error("OFF"); e.code = "OFF"; throw e; }
    if (st.nokey) { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; }
    if (!o || !o.prompt || !String(o.prompt).trim()) throw new Error("اكتب وصف الفيديو أو اختر قالباً");
    const imgs = (o.images || []).filter(Boolean).slice(0, 4); if (!imgs.length) throw new Error("حدّد صورة منتج واحدة على الأقل");
    const est = vcfg.price(), left = cfg.budget() ? cfg.budget() - cfg.spent() : Infinity;
    if (cfg.budget() && left < est) { credit.note(); throw new Error(lowMsg); }
    if (o.confirm !== false && !confirm(useMsg(o.title || "توليد فيديو", "النسبة: " + (o.ratio || "9:16") + " · المدة: " + (o.dur || vcfg.dur()) + " ث · صور: " + imgs.length + "\nقد يستغرق التوليد دقائق."))) return null;
    const key = LS.get(FALKEY, "").trim(), m = vcfg.model(), urls = []; for (const b of imgs) urls.push("data:image/jpeg;base64," + await b64(await shrink(b, 1280)));
    const H = { "Content-Type": "application/json", "Authorization": "Key " + key }, say = o.onStatus || (() => { });
    say("إرسال الطلب إلى خدمة الفيديو…");
    const r = await fetch("https://queue.fal.run/" + m, { method: "POST", headers: H, body: JSON.stringify(videoBody(o, urls)) }), j = await r.json().catch(() => ({}));
    if (!r.ok && billingHit(r.status, JSON.stringify(j))) credit.flagOut();
    if (!r.ok) { const d = j.detail; throw new Error("Alyssum API (فيديو) " + r.status + ": " + (typeof d === "string" ? d : Array.isArray(d) && d[0] ? (d[0].msg || JSON.stringify(d[0])) : (j.message || "خطأ")) + (r.status === 401 || r.status === 403 ? " — تحقق من المفتاح" : "")); }
    const sUrl = j.status_url || ("https://queue.fal.run/" + m + "/requests/" + j.request_id + "/status"), rUrl = j.response_url || ("https://queue.fal.run/" + m + "/requests/" + j.request_id);
    if (!j.request_id && !j.status_url && !j.video) throw new Error("لم تُرجع الخدمة رقم طلب — لم تُحتسب تكلفة غالباً.");
    let res = j.video ? j : null; const t0 = Date.now(), gap = o.pollMs == null ? 4000 : o.pollMs, max = o.maxMs || 8 * 60 * 1000;
    while (!res) {
      if (Date.now() - t0 > max) throw new Error("استغرق التوليد أكثر من المتوقع — راجع حسابك لاحقاً قبل إعادة المحاولة كي لا تتكرر التكلفة.");
      if (gap) await new Promise(x => setTimeout(x, gap));
      const sr = await fetch(sUrl, { headers: H }), sj = await sr.json().catch(() => ({}));
      if (!sr.ok) throw new Error("تعذّر قراءة حالة الفيديو (" + sr.status + ")");
      const stt = String(sj.status || "").toUpperCase(); say(stt === "IN_QUEUE" ? "في الطابور" + (sj.queue_position != null ? " (" + sj.queue_position + ")" : "") + "…" : "جارٍ التوليد…");
      if (stt === "COMPLETED") { const rr = await fetch(rUrl, { headers: H }), rj = await rr.json().catch(() => ({})); if (!rr.ok) throw new Error("تعذّر جلب نتيجة الفيديو (" + rr.status + ")"); res = rj; }
      else if (stt === "FAILED" || stt === "ERROR" || sj.error) throw new Error("فشل التوليد: " + (sj.error || sj.detail || "رفضت الخدمة الطلب") + " — لم تُحتسب تكلفة غالباً.");
    }
    const u = ((res.video || (res.data && res.data.video) || {}).url); if (!u) throw new Error("لم تُرجع الخدمة فيديو — لم تُحتسب تكلفة غالباً.");
    const vr = await fetch(u); if (!vr.ok) throw new Error("تعذّر تنزيل الفيديو الناتج"); const blob = await vr.blob();
    LS.set("alyssum_ig_spent", String(cfg.spent() + est)); LS.set("alyssum_ig_count", String(cfg.count() + 1)); LS.set(AIOUT, "0"); credit.note();
    return { blob, type: blob.type || "video/mp4", cost: est, model: "fal:" + m };
  }
  /* ───────── تحويل صور 2D (1–3) إلى مجسّم 3D (GLB) عبر الخدمة الخارجية — بديل حين لا يكفي التجميع المحلي (img3d.js)
     نفس ضوابط التكلفة: تأكيد، حدّ إنفاق، لا إعادة محاولة. النموذج والسعر قابلان للضبط (alyssum_i3d_model / alyssum_i3d_price) لأن مواصفات الخدمة غير مثبَّتة.
     o = {front, side, back, onStatus, confirm} (Blobs) ← {blob (GLB), cost} أو null */
  const icfg = { model: () => (LS.get("alyssum_i3d_model", "") || "fal-ai/hunyuan3d/v2/multi-view").trim().replace(/^\/+|\/+$/g, ""), price: () => Number(LS.get("alyssum_i3d_price", "0.4")) || 0.4 };
  const model3dReady = () => { const off = LS.get("alyssum_ai_3d", "1") === "0", key = (LS.get(FALKEY, "") || "").trim(); return { ok: !!key && !off, off, nokey: !key, price: icfg.price(), model: icfg.model() }; };
  function glbUrl(j) {
    const seen = []; (function walk(v) { if (!v || seen.length > 40) return; if (typeof v === "string") { if (/^https?:\/\/.+\.(glb|gltf)(\?|$)/i.test(v)) seen.push(v); return; } if (typeof v === "object") for (const k in v) walk(v[k]); })(j);
    const o = (j.model_mesh || j.model_glb || j.glb || j.mesh || (j.data && (j.data.model_mesh || j.data.glb)) || {}); return (o && o.url) || seen[0] || "";
  }
  async function model3d(o) {
    const st = model3dReady();
    if (st.off) { const e = new Error("OFF"); e.code = "OFF"; throw e; }
    if (st.nokey) { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; }
    const views = [["front", o && o.front], ["side", o && o.side], ["back", o && o.back]].filter(v => v[1]); if (!views.length) throw new Error("حدّد صورة واحدة على الأقل");
    const est = icfg.price(), left = cfg.budget() ? cfg.budget() - cfg.spent() : Infinity;
    if (cfg.budget() && left < est) { credit.note(); throw new Error(lowMsg); }
    if (o.confirm !== false && !confirm(useMsg(o.title || "تحويل الصور إلى مجسّم 3D", "صور: " + views.length + "\nقد يستغرق التوليد دقائق."))) return null;
    const key = LS.get(FALKEY, "").trim(), m = icfg.model(), urls = {}; for (const [k, b] of views) urls[k] = "data:image/jpeg;base64," + await b64(await shrink(b, 1536));
    const body = { image_url: urls.front || urls.side || urls.back, input_image_url: urls.front || urls.side || urls.back, image_urls: Object.values(urls) };
    if (urls.front) body.front_image_url = urls.front; if (urls.side) { body.left_image_url = urls.side; body.side_image_url = urls.side; } if (urls.back) body.back_image_url = urls.back;
    const H = { "Content-Type": "application/json", "Authorization": "Key " + key }, say = o.onStatus || (() => { });
    say("إرسال الصور إلى خدمة المجسّمات…");
    const r = await fetch("https://queue.fal.run/" + m, { method: "POST", headers: H, body: JSON.stringify(body) }), j = await r.json().catch(() => ({}));
    if (!r.ok && billingHit(r.status, JSON.stringify(j))) credit.flagOut();
    if (!r.ok) { const d = j.detail; throw new Error("Alyssum API (3D) " + r.status + ": " + (typeof d === "string" ? d : Array.isArray(d) && d[0] ? (d[0].msg || JSON.stringify(d[0])) : (j.message || "خطأ")) + (r.status === 401 || r.status === 403 ? " — تحقق من المفتاح" : "")); }
    const sUrl = j.status_url || ("https://queue.fal.run/" + m + "/requests/" + j.request_id + "/status"), rUrl = j.response_url || ("https://queue.fal.run/" + m + "/requests/" + j.request_id);
    if (!j.request_id && !j.status_url && !glbUrl(j)) throw new Error("لم تُرجع الخدمة رقم طلب — لم تُحتسب تكلفة غالباً.");
    let res = glbUrl(j) ? j : null; const t0 = Date.now(), gap = o.pollMs == null ? 4000 : o.pollMs, max = o.maxMs || 8 * 60 * 1000;
    while (!res) {
      if (Date.now() - t0 > max) throw new Error("استغرق التوليد أكثر من المتوقع — راجع حسابك لاحقاً قبل إعادة المحاولة كي لا تتكرر التكلفة.");
      if (gap) await new Promise(x => setTimeout(x, gap));
      const sr = await fetch(sUrl, { headers: H }), sj = await sr.json().catch(() => ({}));
      if (!sr.ok) throw new Error("تعذّر قراءة حالة المجسّم (" + sr.status + ")");
      const stt = String(sj.status || "").toUpperCase(); say(stt === "IN_QUEUE" ? "في الطابور" + (sj.queue_position != null ? " (" + sj.queue_position + ")" : "") + "…" : "جارٍ بناء المجسّم…");
      if (stt === "COMPLETED") { const rr = await fetch(rUrl, { headers: H }), rj = await rr.json().catch(() => ({})); if (!rr.ok) throw new Error("تعذّر جلب نتيجة المجسّم (" + rr.status + ")"); res = rj; }
      else if (stt === "FAILED" || stt === "ERROR" || sj.error) throw new Error("فشل التوليد: " + (sj.error || sj.detail || "رفضت الخدمة الطلب") + " — لم تُحتسب تكلفة غالباً.");
    }
    const u = glbUrl(res); if (!u) throw new Error("لم تُرجع الخدمة ملف مجسّم — لم تُحتسب تكلفة غالباً.");
    const gr = await fetch(u); if (!gr.ok) throw new Error("تعذّر تنزيل المجسّم الناتج"); const blob = await gr.blob();
    LS.set("alyssum_ig_spent", String(cfg.spent() + est)); LS.set("alyssum_ig_count", String(cfg.count() + 1)); LS.set(AIOUT, "0"); credit.note();
    return { blob, cost: est, model: "fal:" + m };
  }
  /* نص/رؤية (Alyssum API): تعليمات نصية + صور اختيارية ← نص (أو JSON مُحلَّل عند o.json). يُحتسب في الرصيد بوحدة صغيرة وتسري عليه تنبيهات الرصيد. o = {prompt, blobs:[], json:boolean} */
  const TEXT_UNIT = 0.003;
  /* نماذج النص المتاحة لهذا المفتاح: آخر نموذج نجح ثم الأحدث من قائمة الحساب (flash قبل lite) ثم احتياطي؛ الأسماء الثابتة تتقادم فلا نعتمد عليها وحدها */
  async function textModels(key) {
    const out = [], add = n => { if (n && !out.includes(n)) out.push(n); }; add(LS.get("alyssum_ig_tmodel", "")); textModels.seen = "";
    ["gemini-flash-latest", "gemini-flash-lite-latest"].forEach(add);
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key } }), j = await r.json().catch(() => ({}));
      if (r.ok) {
        const ver = n => { const m = /gemini-(\d+(?:\.\d+)?)/.exec(n); return m ? parseFloat(m[1]) : 0; }, rank = n => (/pro/.test(n) ? 20 : /lite/.test(n) ? 10 : /flash/.test(n) ? 0 : 30);
        const all = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes("generateContent")).map(m => String(m.name).replace(/^models\//, ""));
        all.filter(n => /^gemini-/.test(n) && !/image|tts|embed|live|audio|vision|robot|computer|learnlm|imagen|veo|thinking/.test(n))
          .sort((x, y) => rank(x) - rank(y) || ver(y) - ver(x)).forEach(add);
        textModels.seen = all.join(", ");
      }
    } catch (e) { }
    ["gemini-3.8-flash", "gemini-2.5-flash"].forEach(add); return out;
  }
  async function text(o) {
    if (LS.get("alyssum_ai_text", "1") === "0") { const e = new Error("OFF"); e.code = "OFF"; throw e; }
    const key = (LS.get(KEY, "") || "").trim(); if (!key) { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; }
    if (!o || !String(o.prompt || "").trim()) throw new Error("التعليمات مطلوبة");
    /* النص زهيد: لا يُحجب بسقف الصور المحلي (المزوّد يفرض الحدّ الفعلي ويُعلَّم النفاد عند رفضه) */
    const parts = [{ text: String(o.prompt) }]; for (const b of (o.blobs || []).slice(0, 4)) parts.push({ inline_data: { mime_type: "image/jpeg", data: await b64(await shrink(b, Math.max(512, Math.min(2048, Number(o.edge) || 1024)))) } });
    let last = null; const tried = new Set(), errs = [], queue = await textModels(key);
    for (let qi = 0; qi < queue.length && tried.size < 14; qi++) {
      const m = queue[qi]; if (tried.has(m)) continue; tried.add(m);
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ parts }], generationConfig: Object.assign({ temperature: o.temp == null ? .7 : o.temp, maxOutputTokens: Math.max(256, Math.min(16384, Number(o.maxTokens) || 3072)) }, o.json || o.mime ? { responseMimeType: "application/json" } : {}) }), signal: o.signal });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        const t = (((((j.candidates || [])[0] || {}).content || {}).parts) || []).map(x => x.text || "").join("").trim(); if (!t) { last = new Error("ردّ فارغ"); continue; }
        LS.set("alyssum_ig_spent", String(cfg.spent() + TEXT_UNIT)); LS.set(AIOUT, "0"); LS.set("alyssum_ig_tmodel", m); credit.note();
        if (!o.json) return t.replace(/^```[a-z]*\n?|```$/g, "").trim();
        try { return JSON.parse(t.replace(/^```[a-z]*\n?|```$/g, "").trim()); } catch (e) { last = new Error("ناتج غير صالح"); continue; }
      }
      const em = (j.error && j.error.message) || ""; if (billingHit(r.status, em)) credit.flagOut(); last = new Error("Alyssum API (نص) [" + m + "] " + r.status + (em ? ": " + em.slice(0, 200) : "")); errs.push(m + "=" + r.status);
      if (r.status === 404) { const sg = /models\/(gemini-[a-z0-9.\-]*[a-z0-9])/g; let mm; while ((mm = sg.exec(em))) if (!tried.has(mm[1])) queue.splice(qi + 1, 0, mm[1]); }
      if ([401, 402].includes(r.status)) break;
    }
    if (last && tried.size > 1) last = new Error(last.message + " — نتائج: " + errs.join(", ") + (textModels.seen ? " | المتاحة لمفتاحك: " + textModels.seen : ""));
    throw last || new Error("تعذّر الحصول على ردّ");
  }
  async function toLibrary(quiet) {
    if (!S.res) return null; const blob = await blobOf(S.res, fmtNow());
    try {
      let path;
      if (typeof PBApp !== "undefined" && PBApp.uploadBlob && PBApp.E && PBApp.E.page && $("pb-app") && $("pb-app").classList.contains("on")) path = await PBApp.uploadBlob(blob, "ig-" + Date.now().toString(36), { max: 4096, q: .92 });
      else { const f = new File([blob], "ig." + (fmtNow() === "png" ? "png" : "webp"), { type: blob.type }); path = await Admin.uploadImageFile(f, "assets/img/pages", "gen-", { max: 4096, q: .92, noVariants: true, uniq: true }); try { PBApp && PBApp.mediaAdd && PBApp.mediaAdd([path]); } catch (e) { } }
      if (!quiet) { toast("✅ حُفظت في مكتبة الصور: " + path); try { if (typeof AdminSocial !== "undefined" && AdminSocial.onLibraryImage) AdminSocial.onLibraryImage(path); } catch (e) { } } return path;
    } catch (e) { toast("❌ تعذّر الحفظ: " + e.message); return null; }
  }
  async function toEditor(where) {
    if (!S.res) return; const open = typeof PBApp !== "undefined" && PBApp.E && PBApp.E.page && $("pb-app") && $("pb-app").classList.contains("on");
    try {
      if (typeof PBApp === "undefined" || typeof PB === "undefined") return toast("المطوّر غير متاح");
      const mk = path => PB.mkS([PB.mkC([PB.mkW("image", { src: path, alt: S.resName || "", hauto: true, fit: "cover" })])], { pad: { d: [20, 20, 20, 20], m: [14, 12, 14, 12] } });
      if (where === "current" && open) { const path = await toLibrary(true); if (!path) return; PBApp.insertSections([mk(path)], "صورة مولَّدة"); toast("✅ أُضيفت الصورة إلى الصفحة المفتوحة"); return; }
      if (where === "current") toast("لا توجد صفحة مفتوحة — سأفتحها في صفحة جديدة");
      const pg = PB.newPage(S.resName || "صورة مولَّدة", ""); pg.sections = []; PBApp.open(pg, "", true);
      const path = await toLibrary(true); if (!path) return; PBApp.insertSections([mk(path)], "صورة مولَّدة"); toast("✅ فُتحت الصورة في صفحة جديدة بالمطوّر");
    } catch (e) { toast("❌ " + e.message); }
  }

  /* ───────── صور إشهارية داخل المطوّر: صفحة قماش بمقاس المنصة (+ نص كطبقات) ثم تصدير بالمقاس بالبكسل ───────── */
  const lum = (cv, x, y, w, h) => {
    try { const t = document.createElement("canvas"); t.width = t.height = 20; const c = t.getContext("2d"); c.drawImage(cv, Math.max(0, x), Math.max(0, y), Math.max(1, w), Math.max(1, h), 0, 0, 20, 20); const d = c.getImageData(0, 0, 20, 20).data; let a = 0; for (let i = 0; i < d.length; i += 4) a += .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]; return a / (d.length / 4) / 255; } catch (e) { return .5; }
  };
  /* مواضع الطبقات حسب شكل المقاس (تطابق المساحة الفارغة التي طُلبت من النموذج في textArea): x و w نسب %، y و f بكسل تصميم */
  function adLayout(kind, W, H, lang) {
    const rtl = lang === "ar", col = rtl ? 55 : 5;
    if (kind === "story") return { al: "center", h: { x: 8, y: H * .075, w: 84, f: W * .082 }, s: { x: 10, y: H * .075 + W * .082 * 2.9, w: 80, f: W * .042 }, c: { x: 18, y: H * .83, w: 64, f: W * .046 } };
    if (kind === "portrait") return { al: "center", h: { x: 8, y: H * .04, w: 84, f: W * .068 }, s: { x: 10, y: H * .04 + W * .068 * 2.6, w: 80, f: W * .036 }, c: { x: 22, y: H * .865, w: 56, f: W * .04 } };
    if (kind === "square") return { al: "center", h: { x: 8, y: H * .04, w: 84, f: W * .07 }, s: { x: 10, y: H * .04 + W * .07 * 2.6, w: 80, f: W * .036 }, c: { x: 22, y: H * .865, w: 56, f: W * .038 } };
    if (kind === "landscape") return { al: "start", h: { x: col, y: H * .12, w: 40, f: W * .038 }, s: { x: col, y: H * .12 + W * .038 * 3.3, w: 40, f: W * .02 }, c: { x: col, y: H * .76, w: 30, f: W * .022 } };
    return { al: "start", h: { x: col, y: H * .12, w: 44, f: H * .3 }, s: null, c: { x: rtl ? 8 : 62, y: H * .26, w: 28, f: H * .26 } };
  }
  function adPage(meta, cv, bgPath) {
    const W = meta.W, H = meta.H, kind = layoutKind(W, H), L = adLayout(kind, W, H, meta.lang || "ar");
    const sec = PB.mkS([PB.mkC([])], { kind: "canvas", layout: "full", scaled: true, dw: W, mh: { d: H }, pad: { d: [0, 0, 0, 0] }, bg: "#f4f1ea" });
    const put = (type, x, y, w, h, z, set) => { const o = PB.mkFree(type, x, y, z); Object.assign(o.set, set || {}); o.set.fx = { d: Math.round(x * 2) / 2 }; o.set.fy = { d: Math.round(y) }; o.set.fwd = { d: Math.round(w * 2) / 2 }; o.set.fh = { d: Math.round(h) }; return o; };
    sec.free = [];
    if (bgPath) sec.free.push(put("image", 0, 0, 100, H, 0, { src: bgPath, alt: meta.name || "", fit: "cover", hauto: false }));
    const lines = meta.textMode === "builder" ? (meta.text || "").split("\n").map(x => x.trim()).filter(Boolean) : [];
    if (lines.length && cv) {
      const dark = lum(cv, W * L.h.x / 100, L.h.y, W * L.h.w / 100, L.h.f * 3) < .5, tc = dark ? "#ffffff" : "#1b1b1b", sh = dark ? "soft" : "";
      const hasC = lines.length >= 3, mids = lines.slice(1, hasC ? -1 : undefined);
      sec.free.push(put("heading", L.h.x, L.h.y, L.h.w, L.h.f * 2.6, 3, { text: lines[0], tag: "h2", fs: { d: Math.round(L.h.f) }, fw: "900", lh: { d: 1.25 }, ta: { d: L.al }, color: tc, tsh: sh }));
      if (mids.length && L.s) sec.free.push(put("text", L.s.x, L.s.y, L.s.w, L.s.f * 2.6, 3, { html: "<p>" + mids.map(esc).join("<br>") + "</p>", fs: { d: Math.round(L.s.f) }, lh: { d: 1.6 }, ta: { d: L.al }, color: tc, tsh: sh, fw: "600" }));
      if (hasC) { const cd = lum(cv, W * L.c.x / 100, L.c.y, W * L.c.w / 100, L.c.f * 3) < .5; sec.free.push(put("button", L.c.x, L.c.y, L.c.w, L.c.f * 2.6, 4, { text: lines[lines.length - 1], link: "#", bgc: cd ? "#ffffff" : "#173f35", color: cd ? "#173f35" : "#ffffff", fs: { d: Math.round(L.c.f) }, fw: "800", brad: { d: 999 }, bpad: { d: [Math.round(L.c.f * .45), Math.round(L.c.f * 1.2), Math.round(L.c.f * .45), Math.round(L.c.f * 1.2)] }, full: true })); }
    }
    const pg = PB.newPage(meta.name || "صورة إشهارية", ""); pg.sections = [sec]; pg.header = false; pg.footer = false; pg.bg = "#f4f1ea";
    pg.ad = { w: W, h: H, id: meta.id, platform: meta.label }; return pg;
  }
  async function openAd(blank) {
    if (typeof PBApp === "undefined" || typeof PB === "undefined") return toast("المطوّر غير متاح");
    let meta, cv = null, path = null;
    if (blank === true) { const f = formSize(); meta = { W: f.W, H: f.H, id: f.id, label: f.label, textMode: "none", name: ($("ig-name") || {}).value || "", lang: "ar" }; }
    else if (blank && blank.W) { meta = Object.assign({ textMode: "none", lang: "ar", name: "" }, blank); }
    else { if (!S.res || !S.meta) return; meta = S.meta; cv = S.res; }
    try {
      if (PBApp.E && PBApp.E.page && $("pb-app") && $("pb-app").classList.contains("on") && PBApp.E.dirty && !confirm("المطوّر مفتوح بتعديلات غير محفوظة — ستُستبدل بهذه اللوحة. متابعة؟")) return;
      if (cv) { const blob = await blobOf(cv, "webp"); path = "assets/img/pages/ad-bg-" + Date.now().toString(36) + ".webp"; Admin.localImg = Admin.localImg || {}; Admin.localImg[path] = URL.createObjectURL(blob); }
      PBApp.open(adPage(meta, cv, path), "", true); toast("✅ فُتحت لوحة " + meta.W + "×" + meta.H + " في المطوّر — عدّل ثم اضغط «تصدير الصورة»");
    } catch (e) { toast("❌ " + e.message); }
  }

  /* ═══ نشر متعدد المنصات: من تصميم واحد ← صور بمقاس كل منصة (تُعرض مصغّرة في الشريط الجانبي، تحميل المحدد، وتُحفظ في المكتبة) ═══ */
  const PUB = { sel: null, fmt: "webp", items: [], busy: false, msg: "" };
  const pubSel = () => { if (!PUB.sel) { try { PUB.sel = JSON.parse(LS.get("alyssum_pub_sel", "null")) || null; } catch (e) { } if (!Array.isArray(PUB.sel)) PUB.sel = ["fb_post", "ig_sq", "ig_story"]; } return PUB.sel; };
  const pubSizes = () => SIZES.map(g => [g[0], g[1].filter(z => z[0] !== "custom")]).filter(g => g[1].length);
  /* نسخة من التصميم بمقاس آخر: تحجيم منتظم (لا تشوّه) وتوسيط المحتوى، والخلفية الكاملة (صورة تملأ الصفحة) تُمدَّد لتملأ المقاس الجديد */
  function scaledPage(P, W, H) {
    const Q = JSON.parse(JSON.stringify(P)), oW = P.ad.w, oH = P.ad.h, sc = Math.min(W / oW, H / oH), offX = (W - oW * sc) / 2, offY = (H - oH * sc) / 2, num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
    const dv = (set, k) => num(PB.eff(set, k, "d"), 0), put = (set, k, v) => PB.setR(set, k, "d", v);
    (Q.sections || []).forEach(sec => {
      if (sec.set.kind !== "canvas") return; sec.set.dw = W; PB.setR(sec.set, "mh", "d", H); { const r0 = dv(sec.set, "rad"); if (r0) PB.setR(sec.set, "rad", "d", Math.round(r0 * sc)); }
      (sec.free || []).forEach(w => {
        const fx = dv(w.set, "fx"), fy = dv(w.set, "fy"), fw = dv(w.set, "fwd"), fh = dv(w.set, "fh"), bgFull = w.type === "image" && fx <= .5 && fy <= 2 && fw >= 99 && fh >= oH * .97;
        if (bgFull) { put(w.set, "fx", 0); put(w.set, "fy", 0); put(w.set, "fwd", 100); put(w.set, "fh", H); w.set.fit = "cover"; w.set.hauto = false; return; }
        put(w.set, "fx", +((offX + fx / 100 * oW * sc) / W * 100).toFixed(3)); put(w.set, "fwd", +(fw / 100 * oW * sc / W * 100).toFixed(3)); put(w.set, "fy", Math.round(offY + fy * sc)); if (fh) put(w.set, "fh", Math.round(fh * sc));
        const fs = dv(w.set, "fs"); if (fs) put(w.set, "fs", Math.round(fs * sc * 10) / 10);
      });
    });
    Q.ad = Object.assign({}, P.ad, { w: W, h: H }); return Q;
  }
  const pubDraw = () => { const b = $("pub-root"); if (b) b.innerHTML = pubHtml(); };
  function pubHtml() {
    const sel = new Set(pubSel()), card = z => `<label class="pub-pl"><input type="checkbox" data-pub-p="${z[0]}" ${sel.has(z[0]) ? "checked" : ""}><span>${esc(z[1])}</span></label>`;
    const grid = PUB.items.map((it, i) => `<div class="pub-it ${it.checked ? "on" : ""}" data-pub-i="${i}"><label class="pub-ck"><input type="checkbox" data-pub-c="${i}" ${it.checked ? "checked" : ""}></label><div class="pub-th" style="aspect-ratio:${it.W} / ${it.H}"><img src="${it.url}" alt="${esc(it.label)}"></div><b>${esc(it.label)}</b><small>${it.W}×${it.H}${it.path ? " · ✓ في المكتبة" : ""}</small></div>`).join("");
    const nSel = PUB.items.filter(i => i.checked).length;
    return `<style id="pbpub-css">#pub-root .pub-g{font-weight:900;margin:.5rem 0 .2rem;font-size:.8rem}#pub-root .pub-pl{display:flex;gap:.4rem;align-items:center;padding:.2rem 0;font-size:.78rem;cursor:pointer}#pub-root .pub-b{display:flex;gap:.4rem;flex-wrap:wrap;margin:.5rem 0}#pub-root button{padding:.5rem .7rem;border-radius:10px;border:1px solid rgba(128,128,128,.45);background:rgba(128,128,128,.14);font-weight:800;cursor:pointer;font-family:inherit;color:inherit}#pub-root button.go{background:rgba(34,197,94,.3);border-color:rgba(74,222,128,.7);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -2px 4px rgba(0,0,0,.2),0 2px 8px rgba(0,0,0,.2)}#pub-root button:disabled{opacity:.5;cursor:default}#pub-root button:not(:disabled):hover{transform:translateY(-2px)}
#pub-root .pub-grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}#pub-root .pub-it{border:1.5px solid rgba(128,128,128,.4);border-radius:12px;padding:.4rem;position:relative;display:flex;flex-direction:column;gap:.15rem}#pub-root .pub-it.on{border-color:#4ade80;background:rgba(74,222,128,.1)}#pub-root .pub-th{background:repeating-conic-gradient(#cfcfcf 0 25%,#fff 0 50%) 50%/12px 12px;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;max-height:150px;margin:0 auto;width:100%}#pub-root .pub-th img{width:100%;height:100%;object-fit:contain;display:block}#pub-root .pub-ck{position:absolute;top:6px;inset-inline-start:6px;z-index:2;background:rgba(0,0,0,.55);border-radius:6px;padding:2px 4px;display:flex}#pub-root .pub-it b{font-size:.72rem;line-height:1.3}#pub-root .pub-it small{opacity:.8;font-size:.66rem}#pub-root .pub-m{font-size:.74rem;line-height:1.6;opacity:.9;min-height:1.2em}</style>
<div style="font-weight:900;color:inherit">📣 النشر على عدّة منصات</div>
<div style="font-size:.74rem;line-height:1.7;opacity:.85;margin:.2rem 0 .3rem">اختر المنصات ثم «انشر»: تُنشأ صورة لكل منصة من هذا التصميم بمقاسها، وتظهر هنا مصغّرة لتختار منها وتحمّلها، وتُحفظ كلها في مكتبة الصور.</div>
${pubSizes().map(g => `<div class="pub-g">${esc(g[0])}</div>${g[1].map(card).join("")}`).join("")}
<div class="pub-b"><button type="button" data-pub="all">تحديد الكل</button><button type="button" data-pub="none">مسح</button><select data-pub-fmt style="padding:.4rem;border-radius:10px">${[["webp", "WebP"], ["png", "PNG"], ["jpeg", "JPEG"]].map(([k, n]) => `<option value="${k}" ${PUB.fmt === k ? "selected" : ""}>${n}</option>`).join("")}</select></div>
<div class="pub-b"><button type="button" class="go" data-pub="run" ${PUB.busy ? "disabled" : ""} style="flex:1">${PUB.busy ? "⏳ جارٍ النشر…" : "🚀 انشر (" + pubSel().length + " منصة)"}</button></div>
<div class="pub-m" id="pub-msg">${esc(PUB.msg)}</div>
${PUB.items.length ? `<div class="pub-g">النتائج (${PUB.items.length}) — المحدد ${nSel}</div><div class="pub-b"><button type="button" data-pub="rall">تحديد الكل</button><button type="button" data-pub="rnone">إلغاء التحديد</button><button type="button" class="go" data-pub="dl" ${nSel ? "" : "disabled"}>⬇ تحميل المحدد (${nSel})</button><button type="button" data-pub="clear">🗑 مسح النتائج</button></div><div class="pub-grid">${grid}</div>` : ""}`;
  }
  const pubMsg = t => { PUB.msg = t; const m = $("pub-msg"); if (m) m.textContent = t; };
  async function pubRun() {
    const P = typeof PBApp !== "undefined" && PBApp.E && PBApp.E.page; if (!P || !P.ad) return toast("افتح تصميماً بمقاس أولاً");
    const ids = pubSel(); if (!ids.length) return pubMsg("اختر منصة واحدة على الأقل"); if (PUB.busy) return;
    PUB.busy = true; PUB.items.forEach(i => { try { URL.revokeObjectURL(i.url); } catch (e) { } }); PUB.items = []; pubDraw();
    const fmt = PUB.fmt, mime = fmt === "png" ? "image/png" : fmt === "jpeg" ? "image/jpeg" : "image/webp", name = (P.title || "design").replace(/[^\w؀-ۿ-]+/g, "-").slice(0, 30) || "design";
    let ok = 0;
    for (let k = 0; k < ids.length; k++) {
      const z = sizeOf(ids[k]); if (!z) continue; pubMsg("⏳ " + (k + 1) + "/" + ids.length + " — " + z.label);
      try {
        const cv = await renderAd(scaledPage(P, z.w, z.h)), blob = await new Promise(r => cv.toBlob(r, mime, .92)); if (!blob) throw new Error("تعذّر إنشاء الصورة");
        const it = { id: z.id, label: z.label, W: z.w, H: z.h, blob, url: URL.createObjectURL(blob), checked: true, path: "", file: name + "-" + z.id + "-" + z.w + "x" + z.h + "." + (fmt === "jpeg" ? "jpg" : fmt) };
        PUB.items.push(it); ok++; pubDraw();
        try { it.path = await PBApp.uploadBlob(blob, "pub-" + z.id + "-" + Date.now().toString(36), { max: 4096, q: .92 }); pubDraw(); } catch (e) { console.warn("pub lib", e); }
      } catch (e) { console.warn("pub", z.id, e); }
    }
    PUB.busy = false; pubMsg(ok ? "✅ تم إنشاء " + ok + " صورة" + (PUB.items.every(i => i.path) ? " وحُفظت في مكتبة الصور" : " (بعضها لم يُحفظ في المكتبة)") : "❌ تعذّر إنشاء الصور"); pubDraw();
  }
  async function pubDownload() {
    const list = PUB.items.filter(i => i.checked); if (!list.length) return;
    if (list.length === 1) { const a = document.createElement("a"); a.href = list[0].url; a.download = list[0].file; document.body.appendChild(a); a.click(); a.remove(); return; }
    if (typeof AdminImgBatch !== "undefined" && AdminImgBatch.zip) { const b = await AdminImgBatch.zip(list.map(i => ({ name: i.file, blob: i.blob }))), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "publish-" + Date.now().toString(36) + ".zip"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); return; }
    for (const it of list) { const a = document.createElement("a"); a.href = it.url; a.download = it.file; document.body.appendChild(a); a.click(); a.remove(); await new Promise(r => setTimeout(r, 300)); }
  }
  function pubBind(root) {
    if (!root || root.__pub) { pubDraw(); return; } root.__pub = 1;
    root.addEventListener("click", e => {
      const b = e.target.closest("[data-pub]"); if (!b) return; const a = b.dataset.pub;
      if (a === "all") { PUB.sel = pubSizes().flatMap(g => g[1].map(z => z[0])); LS.set("alyssum_pub_sel", JSON.stringify(PUB.sel)); pubDraw(); }
      else if (a === "none") { PUB.sel = []; LS.set("alyssum_pub_sel", "[]"); pubDraw(); }
      else if (a === "run") pubRun();
      else if (a === "rall" || a === "rnone") { PUB.items.forEach(i => { i.checked = a === "rall"; }); pubDraw(); }
      else if (a === "dl") pubDownload();
      else if (a === "clear") { PUB.items.forEach(i => { try { URL.revokeObjectURL(i.url); } catch (x) { } }); PUB.items = []; pubMsg(""); pubDraw(); }
    });
    root.addEventListener("change", e => {
      const t = e.target; if (t.dataset.pubP) { const s = new Set(pubSel()); t.checked ? s.add(t.dataset.pubP) : s.delete(t.dataset.pubP); PUB.sel = [...s]; LS.set("alyssum_pub_sel", JSON.stringify(PUB.sel)); const go = root.querySelector('[data-pub="run"]'); if (go && !PUB.busy) go.textContent = "🚀 انشر (" + PUB.sel.length + " منصة)"; }
      else if (t.dataset.pubC != null) { const it = PUB.items[+t.dataset.pubC]; if (it) { it.checked = t.checked; pubDraw(); } }
      else if (t.hasAttribute && t.hasAttribute("data-pub-fmt")) PUB.fmt = t.value;
    });
    pubDraw();
  }
  const H2I = "assets/js/vendor/html-to-image.min.js";
  function loadH2I() { if (window.htmlToImage) return Promise.resolve(); return new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = (typeof REL !== "undefined" ? REL : "") + H2I + "?v=1.11.11"; sc.onload = res; sc.onerror = () => rej(new Error("تعذّر تحميل مكتبة التصدير")); document.head.appendChild(sc); }); }
  /* يرسم صفحة الإعلان في إطار مخفي بعرض المقاس تماماً ثم يحوّلها إلى لوحة بكسلات */
  async function renderAd(P) {
    await loadH2I(); const W = P.ad.w, H = P.ad.h, dir = location.href.replace(/[^/]*$/, "");
    let html = PB.fullHtml(P, Object.assign({ base: "", baseHref: dir }, PBApp.siteCtx())); const L = Admin.localImg || {}; for (const k in L) if (html.indexOf(k) >= 0) html = html.split(k).join(L[k]);
    html = html.replace("</head>", "<style>html,body{margin:0!important;padding:0!important;overflow:hidden!important;background:" + (P.bg || "#fff") + "}*{animation:none!important;transition:none!important}[data-anim],[data-ia]{opacity:1!important;transform:none!important;translate:none!important}.pb-sec{min-height:0!important}</style></head>");
    const fr = document.createElement("iframe"); fr.style.cssText = "position:fixed;left:-30000px;top:0;border:0;width:" + W + "px;height:" + H + "px"; document.body.appendChild(fr);
    try {
      await new Promise((res, rej) => { fr.onload = res; fr.onerror = rej; fr.srcdoc = html; });
      const d = fr.contentDocument; try { await d.fonts.ready; } catch (e) { }
      await Promise.all([...d.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))); await new Promise(r => setTimeout(r, 400));
      const node = d.querySelector(".pb-sec") || d.body; node.style.width = W + "px"; node.style.height = H + "px"; node.style.overflow = "hidden";
      const rad = Math.max(0, Number(PB.eff(((P.sections || [])[0] || { set: {} }).set, "rad", "d")) || 0); if (rad) { node.style.borderRadius = rad + "px"; d.documentElement.style.background = d.body.style.background = "transparent"; }      // زوايا مدوّرة: ما خارجها شفاف (PNG/WebP)
      const opt = { width: W, height: H, pixelRatio: 1, cacheBust: false, backgroundColor: rad ? undefined : (P.bg || "#ffffff") };
      let cv; try { cv = await window.htmlToImage.toCanvas(node, opt); } catch (e) { cv = await window.htmlToImage.toCanvas(node, Object.assign({ skipFonts: true }, opt)); }
      if (cv.width !== W || cv.height !== H) { const c2 = document.createElement("canvas"); c2.width = W; c2.height = H; c2.getContext("2d").drawImage(cv, 0, 0, W, H); cv = c2; }
      return cv;
    } finally { fr.remove(); }
  }
  async function exportAd(o) {
    const P = PBApp.E && PBApp.E.page; if (!P || !P.ad) return toast("هذه ليست لوحة إشهارية");
    toast("⏳ جارِ تجهيز الصورة…");
    try {
      const cv = await renderAd(P); S.res = cv; S.resName = (P.title || "ad").slice(0, 40);
      if (o && o.act === "download") { await download(o.fmt === "webp" ? "webp" : "png"); toast("✅ نُزّلت الصورة"); return; }      // وضع نافذة الأداة: بلا نافذة وسيطة
      if (o && o.act === "library") { return await toLibrary(false); }
      const url = cv.toDataURL("image/png");
      let ov = $("ig-exp"); if (ov) ov.remove(); ov = document.createElement("div"); ov.id = "ig-exp";
      ov.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:rgba(6,14,12,.82);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:1rem";
      ov.innerHTML = `<div style="max-width:min(96vw,720px);max-height:94vh;overflow:auto;background:rgba(18,32,28,.96);border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:1rem;color:#fff;text-align:center;font-family:inherit"><b>الصورة جاهزة — ${P.ad.w}×${P.ad.h}px</b><div style="margin:.7rem 0"><img src="${url}" alt="" style="max-width:100%;max-height:62vh;border-radius:10px;background:#fff"></div><div class="action-bar" style="justify-content:center;flex-wrap:wrap"><button type="button" class="small" onclick="ImgGen.download('png')">تنزيل PNG</button><button type="button" class="small" onclick="ImgGen.download('webp')">تنزيل WebP</button><button type="button" class="small gold" onclick="ImgGen.toLibrary()">حفظ في المكتبة</button><button type="button" class="small gray" onclick="document.getElementById('ig-exp').remove()">إغلاق</button></div></div>`;
      document.body.appendChild(ov);
    } catch (e) { toast("❌ تعذّر التصدير: " + e.message); }
  }
  async function download(fmt) { if (!S.res) return; fmt = fmt === "png" || fmt === "webp" ? fmt : fmtNow(); const blob = await blobOf(S.res, fmt), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = (S.resName || "image") + "." + (fmt === "png" ? "png" : "webp"); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  function copyPrompt() { try { navigator.clipboard.writeText(S.lastPrompt || ""); toast("✅ نُسخت التعليمات المرسلة"); } catch (e) { toast("تعذّر النسخ"); } }
  async function test() {
    const el = $("ig-tmsg"), key = getKey(); if (!key) { el.textContent = "❌ أدخل المفتاح"; return; } LS.set(KEY, key); el.textContent = "⏳ اختبار…"; S.models = null;
    try { const n = await listModels(key); el.textContent = n.length ? "✅ المفتاح يعمل — " + n.length + " نموذج صور متاح" : "⚠️ المفتاح يعمل لكن لا يظهر نموذج صور — قد يلزم تفعيل الفوترة"; } catch (e) { el.textContent = "❌ " + e.message; }
  }
  const api = {
    open() { if (document.documentElement.classList.contains("app-off-imggen")) { const b = $("ig-body"); if (b) b.innerHTML = "<div class=\"hint\">مولّد الصور معطّل من إعدادات الإضافات.</div>"; return; } render(); },
    tab(t) { S.tab = t; render(); }, mode(m) { S.mode = m; S.res = null; render(); },
    file(inp) { const f = inp.files && inp.files[0]; if (!f) return; S.srcBlob = f; S.srcName = f.name; S.prod = null; const g = $("ig-gal"); if (g) g.innerHTML = ""; paintPrev(); const n = $("ig-name"); if (n && !n.value) n.value = f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "); },
    pickProd: loadFrom, useImg, size(id) { LS.set("alyssum_ig_size_" + S.mode, id); const s = sizeOf(id); $("ig-cus").style.display = id === "custom" ? "flex" : "none"; const w = id === "custom" ? Number($("ig-w").value) : s.w, h = id === "custom" ? Number($("ig-h").value) : s.h; $("ig-sz").textContent = w + "×" + h + "px — النسبة المُرسلة للنموذج " + nearAr(w, h) + " ثم تُقصّ بدقة"; },
    cus() { LS.set("alyssum_ig_w", $("ig-w").value); LS.set("alyssum_ig_h", $("ig-h").value); api.size("custom"); },
    txtm(v) { LS.set("alyssum_ig_txtm", v); $("ig-txtbox").style.display = v === "none" ? "none" : "block"; }, tog, txtEdited() { S.txtDirty = true; },
    bgm(v) { LS.set("alyssum_ig_bgm", v); const b = $("ig-bgcbox"); if (b) b.style.display = v === "solid" ? "flex" : "none"; }, bgc(v) { LS.set("alyssum_ig_bgc", v); }, lang(v) { LS.set("alyssum_ig_lang", v); },
    saveFalKey() { const k = ($("ig-fkey") || {}).value; if (k && k.trim()) { LS.set(FALKEY, k.trim()); credit.renew(); askNotify(); } toast("حُفظ المفتاح في هذا المتصفح"); },
    saveKey() { const k = getKey(); if (k) { LS.set(KEY, k); credit.renew(); askNotify(); } toast("حُفظ المفتاح في هذا المتصفح"); }, test,
    set(k, v) { LS.set("alyssum_ig_" + k, String(v)); if (k === "budget") credit.renew(); paintEst(); }, resetSpent() { LS.set("alyssum_ig_spent", "0"); LS.set("alyssum_ig_count", "0"); credit.renew(); render(); },
    sizes: () => SIZES, pickKey, pubPane: () => '<div id="pub-root"></div>', pubBind: r => pubBind(r.querySelector ? (r.querySelector("#pub-root") || r) : r), pubState: PUB, scaledPage, generate, quick, edit, ready, estimate, video, videoReady, model3d, model3dReady, credit, renewLocal: () => { LS.set("alyssum_ig_spent", "0"); LS.set("alyssum_ig_count", "0"); credit.renew(); }, text, textModels, canVideo: n => !cfg.budget() || (cfg.budget() - cfg.spent()) >= (n || 1) * vcfg.price(), openSized: m => openAd(m), toEditor, toLibrary: () => toLibrary(false), download: f => download(f), openAd: () => openAd(), blank: () => openAd(true), exportAd, renderAd, copyPrompt,
    _t: { adPage, adLayout, buildPrompt, nearAr, fit, sizeOf, SIZES, S }
  };
  return api;
})();
