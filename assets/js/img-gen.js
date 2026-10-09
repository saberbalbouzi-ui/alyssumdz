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
    budget: () => Number(LS.get("alyssum_ig_budget", "3")) || 0, spent: () => Number(LS.get("alyssum_ig_spent", "0")) || 0, count: () => Number(LS.get("alyssum_ig_count", "0")) || 0,
    model: () => LS.get("alyssum_ig_model", "auto"), provider: () => LS.get("alyssum_ig_provider", "gemini") === "fal" ? "fal" : "gemini", falModel: () => (LS.get("alyssum_ig_falmodel", "") || "fal-ai/nano-banana/edit").trim(), falPrice: () => Number(LS.get("alyssum_ig_falprice", "0.04")) || 0.04, lang: () => LS.get("alyssum_ig_lang", "ar"), fmt: () => LS.get("alyssum_ig_fmt", "webp")
  };
  const money = n => "$" + (Math.round(n * 1000) / 1000).toFixed(3);
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
    const head = o.mode === "product"
      ? ["ROLE: you are a world-class commercial product photographer and retoucher.", "BRIEF: create a professional e-commerce PRODUCT PHOTO.",
        "PRODUCT: " + (o.name || "see attached photo") + (o.desc ? "\nDETAILS: " + o.desc : ""),
        "ART DIRECTION (" + art.id + "): " + art.text,
        "COMPOSITION: the product is the hero, filling about 55-70% of the frame, grounded on a surface with a believable contact shadow and subtle reflection; clear foreground / midground / background depth; the background supports the product without competing with it."]
      : ["ROLE: you are an award-winning advertising art director and photographer creating a social-media ad creative.", "BRIEF: create a scroll-stopping ADVERTISING IMAGE for the platform below.",
        "PRODUCT: " + (o.name || "see attached photo") + (o.desc ? "\nKEY BENEFIT / DETAILS: " + o.desc : "") + (o.goal ? "\nCAMPAIGN ANGLE / OFFER: " + o.goal : ""),
        "PLATFORM: " + (o.platform || "social") + ". Design for that placement" + (kind === "story" ? " (full-screen vertical: keep key content inside the safe zone, away from the top 12% and bottom 18% where app UI overlays appear)" : "") + ".",
        "ART DIRECTION (" + art.id + "): " + art.text + " Push it further for advertising: dramatic depth, dynamic composition with a strong focal point, rich lighting and a clear visual hierarchy; the product is large, sharp and unmistakably the star; add a few supporting elements that reinforce the benefit (ingredients, light effects, splashes) without clutter."];
    return [head.join("\n"), "CAMERA & LIGHT: " + CAMERA, "The attached photo shows the product on a plain (usually white) background — cleanly remove that background and place the product into the new scene.", "OUTPUT: exactly " + sz + ". Fill the whole frame edge to edge.", textPart, RULES, "FINAL CHECK before answering: product identical to the reference, nothing cropped, no extra text or logos, no people, clean photorealistic result."].join("\n\n");
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
  async function pickModels(key) {
    const m = cfg.model(); if (m !== "auto") return [m];
    let names = []; try { names = await listModels(key); } catch (e) { if (e.status) throw e; }
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
  async function callModel(key, parts, ar) {
    const models = await pickModels(key); let last = null;
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
      const em = (j.error && j.error.message) || "", reason = ((((j.error || {}).details || [])[0]) || {}).reason; last = new Error(gerr(r.status, em, reason)); last.status = r.status;
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
    const b = cfg.budget(), sp = cfg.spent(), left = Math.max(0, b - sp);
    return `<div class="ig-cost"><span>المصروف: <b>${money(sp)}</b> (${cfg.count()} صورة)</span><span>حدّ الإنفاق: <b>${b ? money(b) : "بلا حدّ"}</b></span><span>المتبقي: <b>${b ? money(left) : "—"}</b></span></div>`;
  }
  function render() {
    const box = $("ig-body"); if (!box) return; const t = S.tab, m = S.mode;
    const tabs = [["make", "إنشاء صورة"], ["set", "الإعدادات"]];
    const hd = `<div class="ap-h"><h3>مولّد الصور</h3></div><div class="ap-tabs">${tabs.map(x => `<button type="button" class="${x[0] === t ? "on" : ""}" onclick="ImgGen.tab('${x[0]}')">${x[1]}</button>`).join("")}</div>` + costBar();
    if (t === "set") { box.innerHTML = hd + settingsHtml(); return; }
    const sizeId = LS.get("alyssum_ig_size_" + m, m === "product" ? "shop" : "ig_sq"), sz = sizeOf(sizeId) || sizeOf("shop"), lang = cfg.lang(), tm = txtMode();
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
  <div class="field"><label>4) النص على الصورة (اختياري)</label>
   <select id="ig-txtm" onchange="ImgGen.txtm(this.value)"><option value="none"${tm === "none" ? " selected" : ""}>بلا نص — صورة نظيفة فقط</option><option value="builder"${tm === "builder" ? " selected" : ""}>نص في المطوّر (موصى به: عربي سليم وقابل للتعديل)</option><option value="gemini"${tm === "gemini" ? " selected" : ""}>نص مرسوم بـ Alyssum API (داخل الصورة، لا يُعدَّل)</option></select>
   <div id="ig-txtbox" style="display:${tm === "none" ? "none" : "block"}"><textarea id="ig-txt" rows="4" placeholder="كل سطر = عبارة. السطر الأول عنوان، الوسطى وصف، وآخر سطر قصير يصير زراً (عند 3 أسطر فأكثر)">${esc(LS.get("alyssum_ig_txt", ""))}</textarea>
   <select id="ig-lang" onchange="ImgGen.lang(this.value)">${Object.keys(LANGS).map(k => `<option value="${k}"${k === lang ? " selected" : ""}>لغة النص: ${LANGS[k][0]}</option>`).join("")}</select></div></div>
 </div>
</div>
<div class="action-bar"><button type="button" class="small" id="ig-go" onclick="ImgGen.generate()">توليد الصورة</button>${m === "ad" ? `<button type="button" class="small gray" onclick="ImgGen.blank()" title="يفتح المطوّر بصفحة فارغة بمقاس المنصة لتصمّم عليها بلا توليد">لوحة فارغة بهذا المقاس</button>` : ""}<span class="hint" id="ig-est"></span></div>
<div class="hint" id="ig-msg"></div>
<div id="ig-res" class="ig-res"></div>`;
    paintPrev(); estimate();
  }
  function settingsHtml() {
    const fal = cfg.provider() === "fal";
    return `<div class="ap-sec"><b>تفعيل Alyssum API</b><div class="tl-s"><label class="tl-r" style="cursor:pointer"><span>تفعيل توليد الصور الذكي</span><input type="checkbox" ${LS.get("alyssum_ai_img", "1") === "0" ? "" : "checked"} onchange="try{localStorage.setItem('alyssum_ai_img',this.checked?'1':'0')}catch(e){}"></label><div class="hint">عند التعطيل يتوقف توليد الصور من هنا ومن تبويب السوشيال. تفعيل/تعطيل توليد النص الذكي من «السوشيال ← الاتصال والإعدادات».</div></div></div>
<div class="ap-sec"><b>مزوّد التوليد</b><div class="hint">اختر مسار التوليد: «Alyssum API — المسار أ» أو «المسار ب» (نماذج تعديل بصورة مرجعية). لكل مسار مفتاحه الخاص المحفوظ في هذا المتصفح فقط.</div><div class="tl-s"><div class="tl-r"><span>المزوّد</span><select onchange="ImgGen.set('provider',this.value);ImgGen.tab('set')"><option value="gemini"${fal ? "" : " selected"}>Alyssum API — المسار أ</option><option value="fal"${fal ? " selected" : ""}>Alyssum API — المسار ب</option></select></div>
${fal ? `<div class="tl-r"><span>مفتاح Alyssum API (المسار ب)</span><input id="ig-fkey" type="password" autocomplete="off" placeholder="key_id:key_secret" value="${esc(LS.get(FALKEY, ""))}" onchange="ImgGen.saveFalKey()"></div><div class="tl-r"><span>معرّف النموذج</span><input dir="ltr" value="${esc(cfg.falModel())}" placeholder="fal-ai/nano-banana/edit" onchange="ImgGen.set('falmodel',this.value.trim())"></div><div class="tl-r"><span>تكلفة الصورة التقريبية (دولار)</span><input type="number" step="0.005" min="0" value="${cfg.falPrice()}" onchange="ImgGen.set('falprice',this.value)"></div><div class="hint">احصل على المفتاح من لوحة مزوّد هذا المسار. النماذج المقترحة: <code>fal-ai/nano-banana/edit</code> (افتراضي) أو <code>fal-ai/flux-pro/kontext</code>. السعر يدوي لأن التسعير يختلف حسب النموذج؛ راجع الرصيد الفعلي في لوحة المزوّد. إن حجب المتصفح الطلب فأخبرنا لنضيف وسيطاً.</div>` : ""}</div></div>
<div class="ap-sec"${fal ? ' style="display:none"' : ""}><b>مفتاح Alyssum API (المسار أ)</b><div class="hint">يُحفظ في هذا المتصفح فقط. احصل عليه من لوحة مزوّد الخدمة (مشروع جديد بلا قيود)، ونماذج الصور تتطلب تفعيل الفوترة بحدّ إنفاق صغير. المفتاح نفسه يعمل لتوليد النصوص في السوشيال.</div>
<div class="tl-s"><input id="ig-key" type="password" autocomplete="off" placeholder="AIza…" value="${esc(LS.get(KEY, ""))}" onchange="ImgGen.saveKey()"><div class="action-bar"><button type="button" class="small" onclick="ImgGen.test()">اختبار المفتاح</button></div><div class="hint" id="ig-tmsg"></div></div></div>
<div class="ap-sec"><b>التكلفة</b><div class="tl-s">
<div class="tl-r"><span>حدّ الإنفاق (دولار) — يتوقف التوليد عند بلوغه (0 = بلا حدّ)</span><input type="number" step="0.5" min="0" value="${cfg.budget()}" onchange="ImgGen.set('budget',this.value)"></div>
<div class="tl-r"><span>النموذج</span><select onchange="ImgGen.set('model',this.value)"><option value="auto"${cfg.model() === "auto" ? " selected" : ""}>تلقائي — الأرخص أولاً (≈ $0.039 للصورة)</option>${PREF.map(m => `<option value="${m}"${cfg.model() === m ? " selected" : ""}>${MLBL[m] || m} (≈ ${money(priceOf(m))})</option>`).join("")}</select></div>
<div class="tl-r"><span>صيغة الحفظ في المكتبة</span><select onchange="ImgGen.set('fmt',this.value)"><option value="webp"${cfg.fmt() === "webp" ? " selected" : ""}>WebP (أخف)</option><option value="png"${cfg.fmt() === "png" ? " selected" : ""}>PNG</option></select></div>
<div class="action-bar"><button type="button" class="small gray" onclick="ImgGen.resetSpent()">تصفير عدّاد المصروف</button></div>
<div class="hint">العدّاد تقديري من هذا المتصفح (سعر الصورة المعلن) وليس كشف حساب؛ راجع الرصيد الفعلي في لوحة المزوّد. لا إعادة محاولة تلقائية: كل ضغطة = صورة واحدة.</div></div></div>`;
  }
  function paintPrev() {
    const p = $("ig-prev"); if (!p) return; if (!S.srcBlob) return;
    const u = URL.createObjectURL(S.srcBlob); p.innerHTML = `<img src="${u}" alt=""><small>${esc(S.srcName || "")}</small>`;
  }
  function estimate() {
    const el = $("ig-est"); if (!el) return; const m = cfg.model(), pr = cfg.provider() === "fal" ? cfg.falPrice() : m === "auto" ? PRICE[PREF[0]] : priceOf(m), left = cfg.budget() ? cfg.budget() - cfg.spent() : Infinity;
    el.textContent = "التكلفة التقريبية: " + money(pr) + " للصورة" + (isFinite(left) ? " · المتبقي من حدّك " + money(Math.max(0, left)) : "");
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

  async function generate() {
    if (S.busy) return; const msg = $("ig-msg"), fal = cfg.provider() === "fal", key = fal ? LS.get(FALKEY, "") : (getKey() || LS.get(KEY, ""));
    const fs = formSize(), sz = fs, W = fs.W, H = fs.H;
    if (LS.get("alyssum_ai_img", "1") === "0") { if (msg) msg.textContent = "⛔ توليد الصور الذكي معطّل — فعّله من الإعدادات."; return; }
    if (!key) { S.tab = "set"; render(); toast("أدخل مفتاح Alyssum API أولاً"); return; }
    if (!S.srcBlob) { msg.textContent = "❌ اختر صورة المنتج أولاً (رفع أو من منتجاتك)"; return; }
    const name = $("ig-name").value.trim(), desc = $("ig-desc").value.trim(); if (!name && !desc) { msg.textContent = "❌ اكتب اسم المنتج أو وصفه"; return; }
    const tmode = $("ig-txtm").value, txt = tmode !== "none" ? ($("ig-txt").value || "").trim() : ""; if (tmode !== "none" && !txt) { msg.textContent = "❌ اكتب النص المطلوب أو اختر «بلا نص»"; return; }
    readForm();
    const models = cfg.model(), est = fal ? cfg.falPrice() : models === "auto" ? PRICE[PREF[0]] : priceOf(models), left = cfg.budget() ? cfg.budget() - cfg.spent() : Infinity;
    if (cfg.budget() && left < est) { msg.textContent = "⛔ بلغتَ حدّ الإنفاق (" + money(cfg.budget()) + ") — ارفعه من الإعدادات أو صفّر العدّاد."; return; }
    if (!confirm("توليد صورة واحدة بتكلفة تقريبية " + money(est) + "\nالمقاس: " + W + "×" + H + " — " + (S.mode === "product" ? "صورة منتج" : "صورة إشهارية") + "\nمتابعة؟")) return;
    S.busy = true; $("ig-go").disabled = true; msg.textContent = "⏳ جارِ التوليد (قد يستغرق 10–40 ثانية)…";
    try {
      const ar = nearAr(W, H), prompt = buildPrompt({ mode: S.mode, name, desc, goal: ($("ig-goal") || {}).value ? $("ig-goal").value.trim() : "", text: txt, textMode: tmode, lang: $("ig-lang") ? $("ig-lang").value : "ar", w: W, h: H, ar, platform: sz.label });
      S.lastPrompt = prompt; const small = await shrink(S.srcBlob, 1400);
      const out = fal ? await callFal(key, prompt, "data:image/jpeg;base64," + await b64(small), ar) : await callModel(key, [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: await b64(small) } }], ar);
      const cv = await fit(out.blob, W, H); S.res = cv; S.lastModel = out.model; S.resName = (name || "image").slice(0, 40); S.meta = { W, H, id: fs.id, label: fs.label, textMode: tmode, text: txt, lang: $("ig-lang") ? $("ig-lang").value : "ar", name };
      LS.set("alyssum_ig_spent", String(cfg.spent() + (out.cost || priceOf(out.model)))); LS.set("alyssum_ig_count", String(cfg.count() + 1));
      showRes(cv, W, H); msg.textContent = "✅ تمّ بنموذج " + out.model + " — " + W + "×" + H + "px"; const cb = document.querySelector(".ig-cost"); if (cb) cb.outerHTML = costBar(); estimate();
    } catch (e) { msg.textContent = "❌ " + e.message; } finally { S.busy = false; const g = $("ig-go"); if (g) g.disabled = false; }
  }
  function showRes(cv, W, H) {
    const r = $("ig-res"); if (!r) return; const u = cv.toDataURL("image/webp", .92);
    const ad = S.mode === "ad", tm = (S.meta || {}).textMode;
    r.innerHTML = `<div class="ig-out"><img src="${u}" alt=""></div><div class="action-bar">${ad ? `<button type="button" class="small" onclick="ImgGen.openAd()">فتح في المطوّر${tm === "builder" ? " (مع النص كطبقات قابلة للتعديل)" : " للتعديل والتصدير"}</button>` : `<button type="button" class="small" onclick="ImgGen.toEditor('current')">فتح في المطوّر (الصفحة المفتوحة)</button><button type="button" class="small" onclick="ImgGen.toEditor('new')">فتح في صفحة جديدة</button>`}<button type="button" class="small gold" onclick="ImgGen.toLibrary()">حفظ في المكتبة</button><button type="button" class="small gray" onclick="ImgGen.download()">تنزيل</button><button type="button" class="small gray" onclick="ImgGen.copyPrompt()">نسخ التعليمات</button></div>`;
  }
  const blobOf = (cv, fmt) => new Promise(res => cv.toBlob(res, fmt === "png" ? "image/png" : "image/webp", .92));
  /* توليد صورة واحدة دون واجهة المولّد (يستعمله تبويب السوشيال): o = {blob مرجع, name, desc, goal, W, H, label} ← {blob, model, cost} أو null إن ألغى المستخدم */
  async function quick(o) {
    const fal = cfg.provider() === "fal", key = (fal ? LS.get(FALKEY, "") : LS.get(KEY, "")).trim();
    if (LS.get("alyssum_ai_img", "1") === "0") { const e = new Error("OFF"); e.code = "OFF"; throw e; }
    if (!key) { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; }
    if (!o || !o.blob) throw new Error("اختر صورة المنتج المرجعية أولاً");
    const est = fal ? cfg.falPrice() : (cfg.model() === "auto" ? PRICE[PREF[0]] : priceOf(cfg.model())), left = cfg.budget() ? cfg.budget() - cfg.spent() : Infinity;
    if (cfg.budget() && left < est) throw new Error("بلغتَ حدّ الإنفاق (" + money(cfg.budget()) + ") — ارفعه من إعدادات مولّد الصور");
    if (o.confirm !== false && !confirm("توليد صورة واحدة بتكلفة تقريبية " + money(est) + "\nالمقاس: " + o.W + "×" + o.H + "\nمتابعة؟")) return null;
    const ar = nearAr(o.W, o.H), prompt = buildPrompt({ mode: "ad", name: o.name || "", desc: o.desc || "", goal: o.goal || "", text: "", textMode: "none", lang: "ar", w: o.W, h: o.H, ar, platform: o.label || "" });
    const small = await shrink(o.blob, 1400), d = await b64(small);
    const out = fal ? await callFal(key, prompt, "data:image/jpeg;base64," + d, ar) : await callModel(key, [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: d } }], ar);
    const cv = await fit(out.blob, o.W, o.H); LS.set("alyssum_ig_spent", String(cfg.spent() + (out.cost || priceOf(out.model)))); LS.set("alyssum_ig_count", String(cfg.count() + 1));
    return { blob: await blobOf(cv, "webp"), model: out.model, cost: est };
  }
  async function toLibrary(quiet) {
    if (!S.res) return null; const blob = await blobOf(S.res, cfg.fmt());
    try {
      let path;
      if (typeof PBApp !== "undefined" && PBApp.uploadBlob && PBApp.E && PBApp.E.page && $("pb-app") && $("pb-app").classList.contains("on")) path = await PBApp.uploadBlob(blob, "ig-" + Date.now().toString(36), { max: 4096, q: .92 });
      else { const f = new File([blob], "ig." + (cfg.fmt() === "png" ? "png" : "webp"), { type: blob.type }); path = await Admin.uploadImageFile(f, "assets/img/pages", "gen-", { max: 4096, q: .92, noVariants: true, uniq: true }); try { PBApp && PBApp.mediaAdd && PBApp.mediaAdd([path]); } catch (e) { } }
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
      const opt = { width: W, height: H, pixelRatio: 1, cacheBust: false, backgroundColor: P.bg || "#ffffff" };
      let cv; try { cv = await window.htmlToImage.toCanvas(node, opt); } catch (e) { cv = await window.htmlToImage.toCanvas(node, Object.assign({ skipFonts: true }, opt)); }
      if (cv.width !== W || cv.height !== H) { const c2 = document.createElement("canvas"); c2.width = W; c2.height = H; c2.getContext("2d").drawImage(cv, 0, 0, W, H); cv = c2; }
      return cv;
    } finally { fr.remove(); }
  }
  async function exportAd() {
    const P = PBApp.E && PBApp.E.page; if (!P || !P.ad) return toast("هذه ليست لوحة إشهارية");
    toast("⏳ جارِ تجهيز الصورة…");
    try {
      const cv = await renderAd(P); S.res = cv; S.resName = (P.title || "ad").slice(0, 40); const url = cv.toDataURL("image/png");
      let ov = $("ig-exp"); if (ov) ov.remove(); ov = document.createElement("div"); ov.id = "ig-exp";
      ov.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:rgba(6,14,12,.82);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:1rem";
      ov.innerHTML = `<div style="max-width:min(96vw,720px);max-height:94vh;overflow:auto;background:rgba(18,32,28,.96);border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:1rem;color:#fff;text-align:center;font-family:inherit"><b>الصورة جاهزة — ${P.ad.w}×${P.ad.h}px</b><div style="margin:.7rem 0"><img src="${url}" alt="" style="max-width:100%;max-height:62vh;border-radius:10px;background:#fff"></div><div class="action-bar" style="justify-content:center;flex-wrap:wrap"><button type="button" class="small" onclick="ImgGen.download('png')">تنزيل PNG</button><button type="button" class="small" onclick="ImgGen.download('webp')">تنزيل WebP</button><button type="button" class="small gold" onclick="ImgGen.toLibrary()">حفظ في المكتبة</button><button type="button" class="small gray" onclick="document.getElementById('ig-exp').remove()">إغلاق</button></div></div>`;
      document.body.appendChild(ov);
    } catch (e) { toast("❌ تعذّر التصدير: " + e.message); }
  }
  async function download(fmt) { if (!S.res) return; fmt = fmt === "png" || fmt === "webp" ? fmt : cfg.fmt(); const blob = await blobOf(S.res, fmt), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = (S.resName || "image") + "." + (fmt === "png" ? "png" : "webp"); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  function copyPrompt() { try { navigator.clipboard.writeText(S.lastPrompt || ""); toast("✅ نُسخت التعليمات المرسلة"); } catch (e) { toast("تعذّر النسخ"); } }
  async function test() {
    const el = $("ig-tmsg"), key = getKey(); if (!key) { el.textContent = "❌ أدخل المفتاح"; return; } LS.set(KEY, key); el.textContent = "⏳ اختبار…"; S.models = null;
    try { const n = await listModels(key); el.textContent = n.length ? "✅ المفتاح يعمل — " + n.length + " نموذج صور متاح" : "⚠️ المفتاح يعمل لكن لا يظهر نموذج صور — قد يلزم تفعيل الفوترة"; } catch (e) { el.textContent = "❌ " + e.message; }
  }
  const api = {
    open() { if (document.documentElement.classList.contains("app-off-imggen")) { const b = $("ig-body"); if (b) b.innerHTML = "<div class=\"hint\">مولّد الصور معطّل من إعدادات التطبيقات.</div>"; return; } render(); },
    tab(t) { S.tab = t; render(); }, mode(m) { S.mode = m; S.res = null; render(); },
    file(inp) { const f = inp.files && inp.files[0]; if (!f) return; S.srcBlob = f; S.srcName = f.name; S.prod = null; const g = $("ig-gal"); if (g) g.innerHTML = ""; paintPrev(); const n = $("ig-name"); if (n && !n.value) n.value = f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "); },
    pickProd: loadFrom, useImg, size(id) { LS.set("alyssum_ig_size_" + S.mode, id); const s = sizeOf(id); $("ig-cus").style.display = id === "custom" ? "flex" : "none"; const w = id === "custom" ? Number($("ig-w").value) : s.w, h = id === "custom" ? Number($("ig-h").value) : s.h; $("ig-sz").textContent = w + "×" + h + "px — النسبة المُرسلة للنموذج " + nearAr(w, h) + " ثم تُقصّ بدقة"; },
    cus() { LS.set("alyssum_ig_w", $("ig-w").value); LS.set("alyssum_ig_h", $("ig-h").value); api.size("custom"); },
    txtm(v) { LS.set("alyssum_ig_txtm", v); $("ig-txtbox").style.display = v === "none" ? "none" : "block"; }, lang(v) { LS.set("alyssum_ig_lang", v); },
    saveFalKey() { const k = ($("ig-fkey") || {}).value; if (k && k.trim()) LS.set(FALKEY, k.trim()); toast("حُفظ المفتاح في هذا المتصفح"); },
    saveKey() { const k = getKey(); if (k) LS.set(KEY, k); toast("حُفظ المفتاح في هذا المتصفح"); }, test,
    set(k, v) { LS.set("alyssum_ig_" + k, String(v)); estimate(); }, resetSpent() { LS.set("alyssum_ig_spent", "0"); LS.set("alyssum_ig_count", "0"); render(); },
    generate, quick, openSized: m => openAd(m), toEditor, toLibrary: () => toLibrary(false), download: f => download(f), openAd: () => openAd(), blank: () => openAd(true), exportAd, renderAd, copyPrompt,
    _t: { adPage, adLayout, buildPrompt, nearAr, fit, sizeOf, SIZES, S }
  };
  return api;
})();
