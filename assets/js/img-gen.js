/* مولّد الصور (ImgGen): صور منتجات + صور إشهارية بمقاسات مواقع التواصل، عبر Gemini (مفتاحك يبقى في متصفحك فقط).
   كل نوع له تعليمات (instruction) خاصة تُرسل مع صورة المنتج؛ النتيجة تُقصّ/تُكبَّر إلى المقاس المطلوب بالبكسل ثم تُفتح في المطوّر أو تُحفظ في المكتبة.
   التكلفة: نموذج واحد رخيص افتراضياً، صورة واحدة لكل ضغطة، حدّ إنفاق تضبطه (يتوقف التوليد عند بلوغه) وعدّاد ظاهر. */
const ImgGen = (() => {
  const $ = id => document.getElementById(id), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = m => { try { (typeof toast2 === "function" ? toast2 : window.toast)(m); } catch (e) { } };
  const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
  const KEY = "alyssum_gp_gkey";
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
  /* النسب التي يدعمها Gemini (aspectRatio) — نختار الأقرب ثم نقصّ بدقة */
  const ARS = [["1:1", 1], ["2:3", 2 / 3], ["3:2", 3 / 2], ["3:4", 3 / 4], ["4:3", 4 / 3], ["4:5", 4 / 5], ["5:4", 5 / 4], ["9:16", 9 / 16], ["16:9", 16 / 9], ["21:9", 21 / 9]];
  const nearAr = (w, h) => { const r = w / h; return ARS.slice().sort((a, b) => Math.abs(Math.log(a[1] / r)) - Math.abs(Math.log(b[1] / r)))[0][0]; };
  /* تكلفة الصورة التقريبية بالدولار (تسعير معلن، للتحذير فقط) */
  const PRICE = { "gemini-2.5-flash-image": .039, "gemini-2.5-flash-image-preview": .039, "gemini-3.1-flash-image": .067, "gemini-3-pro-image-preview": .134 };
  const PREF = ["gemini-2.5-flash-image", "gemini-2.5-flash-image-preview", "gemini-3.1-flash-image", "gemini-3-pro-image-preview"];
  const priceOf = m => PRICE[m] || .07;
  const S = { mode: "product", tab: "make", prod: null, srcBlob: null, srcName: "", res: null, resBlob: null, busy: false, models: null, lastModel: "" };
  const cfg = {
    budget: () => Number(LS.get("alyssum_ig_budget", "3")) || 0, spent: () => Number(LS.get("alyssum_ig_spent", "0")) || 0, count: () => Number(LS.get("alyssum_ig_count", "0")) || 0,
    model: () => LS.get("alyssum_ig_model", "auto"), lang: () => LS.get("alyssum_ig_lang", "ar"), fmt: () => LS.get("alyssum_ig_fmt", "webp")
  };
  const money = n => "$" + (Math.round(n * 1000) / 1000).toFixed(3);
  const LANGS = { ar: ["العربية", "Arabic (right-to-left, perfectly shaped connected letters)"], fr: ["الفرنسية", "French"], en: ["الإنجليزية", "English"] };

  /* ───────── التعليمات (instruction) لكل نوع ───────── */
  function typeHint(name, desc) {
    return "Infer the product category from the name and description and choose the background, props, colors and lighting that suit that kind of product (e.g. honey & herbs: warm natural wood, honeycomb, green leaves, soft sunlight; skincare/cosmetics: clean pastel studio with soft shadows and botanical touches; supplements: fresh energetic gradient with ingredients; electronics: sleek dark studio with rim light; fashion/accessories: elegant editorial backdrop; food: appetizing table scene).";
  }
  const RULES = "STRICT RULES: use the attached product photo as the exact reference — keep the real product, its shape, label and colors faithful and unaltered, fully visible and never cropped. No watermarks, no stock-photo marks, no website names, no extra brand logos. Do NOT include any people or body parts. Photorealistic, high-end commercial quality, sharp focus, natural contact shadows, correct perspective.";
  function textBlock(txt, lang, kind) {
    if (!txt) return "TEXT: render NO text, letters, numbers, logos or captions anywhere in the image.";
    const L = LANGS[lang] || LANGS.ar;
    return "TEXT: render ONLY the following " + L[1] + " " + (kind === "ad" ? "advertising copy" : "caption") + ", each quoted line EXACTLY ONCE, letter by letter, spelled correctly, with clean legible typography and strong contrast, placed so it never covers the product:\n" + txt.split("\n").map(x => x.trim()).filter(Boolean).map(x => '"' + x + '"').join("\n") + "\nDo not add, translate, repeat or alter any other words.";
  }
  function buildPrompt(o) {
    const sz = o.w + "x" + o.h + " pixels (aspect ratio " + o.ar + ")";
    if (o.mode === "product") {
      return ["TASK: create a professional PRODUCT PHOTO for an online store.",
        "Product name: " + (o.name || "(see photo)") + (o.desc ? "\nProduct description: " + o.desc : ""),
        "Composition: the product is the hero, centered or on a rule-of-thirds, filling about 60-70% of the frame, placed on a surface with a believable reflection/contact shadow. " + typeHint(o.name, o.desc),
        "The attached photo shows the product on a plain (usually white) background — remove that background and place the product in the scene described above while preserving the product exactly.",
        "Output format: " + sz + ".", textBlock(o.text, o.lang, "cap"), RULES].join("\n\n");
    }
    return ["TASK: create an eye-catching ADVERTISING CREATIVE for social media / ads.",
      "Product name: " + (o.name || "(see photo)") + (o.desc ? "\nProduct description / key benefit: " + o.desc : "") + (o.goal ? "\nCampaign angle / offer: " + o.goal : ""),
      "Platform format: " + o.platform + ". Output size: " + sz + ". Design for that placement: keep important elements inside the safe area (for tall story/reels/shorts formats leave the top 12% and bottom 18% free of key content).",
      "Style: bold, scroll-stopping, premium ad composition with depth, dramatic lighting, dynamic background and subtle supporting elements that match the product category. " + typeHint(o.name, o.desc) + " The product is the focal point, large and sharp.",
      "The attached photo shows the product on a plain (usually white) background — extract the product from it and place it in the new scene faithfully.",
      textBlock(o.text, o.lang, "ad"), RULES].join("\n\n");
  }

  /* ───────── الاتصال بـ Gemini ───────── */
  const getKey = () => (($("ig-key") && $("ig-key").value.replace(/[\s"']/g, "")) || LS.get(KEY, "")).trim();
  function gerr(status, msg, reason) {
    const raw = msg ? " (" + msg.slice(0, 160) + ")" : "";
    if (/API_KEY_SERVICE_BLOCKED/.test(reason || "") || /API_KEY_SERVICE_BLOCKED/.test(msg)) return "المفتاح مقيَّد ولا يسمح بواجهة Generative Language API — أنشئ مفتاحاً جديداً من aistudio.google.com/apikey بمشروع بلا قيود.";
    if (/API key not valid|API_KEY_INVALID/i.test(msg)) return "المفتاح غير صالح — تأكد من نسخه كاملاً.";
    if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) return "تجاوزت الحصة أو أن نماذج الصور تتطلب تفعيل الفوترة (Billing) في مشروع المفتاح — فعّلها بحدّ إنفاق صغير (مثلاً 5$) من Google AI Studio." + raw;
    if (status === 403) return "المفتاح لا يملك صلاحية هذا النموذج أو الخدمة غير متاحة في منطقتك." + raw;
    if ([500, 502, 503, 504].includes(status)) return "النموذج مشغول مؤقتاً عند Google — أعد المحاولة بعد دقائق." + raw;
    if (status === 400 && /SAFETY|blocked|prohibited/i.test(msg)) return "رفض النموذج الطلب لأسباب أمان — غيّر الوصف أو النص." + raw;
    return (msg || "Gemini " + status) + raw;
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
    const sizeId = LS.get("alyssum_ig_size_" + m, m === "product" ? "shop" : "ig_sq"), sz = sizeOf(sizeId) || sizeOf("shop"), lang = cfg.lang();
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
  <div class="field"><label>4) النص على الصورة</label>
   <select id="ig-txtm" onchange="ImgGen.txtm(this.value)"><option value="none">بلا نص</option><option value="text"${LS.get("alyssum_ig_txtm", "none") === "text" ? " selected" : ""}>بنص</option></select>
   <div id="ig-txtbox" style="display:${LS.get("alyssum_ig_txtm", "none") === "text" ? "block" : "none"}"><textarea id="ig-txt" rows="3" placeholder="كل سطر = عبارة تُكتب على الصورة مرة واحدة">${esc(LS.get("alyssum_ig_txt", ""))}</textarea>
   <select id="ig-lang" onchange="ImgGen.lang(this.value)">${Object.keys(LANGS).map(k => `<option value="${k}"${k === lang ? " selected" : ""}>لغة النص: ${LANGS[k][0]}</option>`).join("")}</select></div></div>
 </div>
</div>
<div class="action-bar"><button type="button" class="small" id="ig-go" onclick="ImgGen.generate()">توليد الصورة</button><span class="hint" id="ig-est"></span></div>
<div class="hint" id="ig-msg"></div>
<div id="ig-res" class="ig-res"></div>`;
    paintPrev(); estimate();
  }
  function settingsHtml() {
    return `<div class="ap-sec"><b>مفتاح Gemini</b><div class="hint">يُحفظ في هذا المتصفح فقط ولا يُرسل إلا إلى Google. أنشئه من aistudio.google.com/apikey (مشروع جديد بلا قيود). نماذج الصور تتطلب تفعيل الفوترة بحدّ إنفاق صغير.</div>
<div class="tl-s"><input id="ig-key" type="password" autocomplete="off" placeholder="AIza…" value="${esc(LS.get(KEY, ""))}" onchange="ImgGen.saveKey()"><div class="action-bar"><button type="button" class="small" onclick="ImgGen.test()">اختبار المفتاح</button></div><div class="hint" id="ig-tmsg"></div></div></div>
<div class="ap-sec"><b>التكلفة</b><div class="tl-s">
<div class="tl-r"><span>حدّ الإنفاق (دولار) — يتوقف التوليد عند بلوغه (0 = بلا حدّ)</span><input type="number" step="0.5" min="0" value="${cfg.budget()}" onchange="ImgGen.set('budget',this.value)"></div>
<div class="tl-r"><span>النموذج</span><select onchange="ImgGen.set('model',this.value)"><option value="auto"${cfg.model() === "auto" ? " selected" : ""}>تلقائي — الأرخص أولاً (≈ $0.039 للصورة)</option>${PREF.map(m => `<option value="${m}"${cfg.model() === m ? " selected" : ""}>${m} (≈ ${money(priceOf(m))})</option>`).join("")}</select></div>
<div class="tl-r"><span>صيغة الحفظ في المكتبة</span><select onchange="ImgGen.set('fmt',this.value)"><option value="webp"${cfg.fmt() === "webp" ? " selected" : ""}>WebP (أخف)</option><option value="png"${cfg.fmt() === "png" ? " selected" : ""}>PNG</option></select></div>
<div class="action-bar"><button type="button" class="small gray" onclick="ImgGen.resetSpent()">تصفير عدّاد المصروف</button></div>
<div class="hint">العدّاد تقديري من هذا المتصفح (سعر الصورة المعلن) وليس كشف حساب Google؛ راجع الرصيد الفعلي في AI Studio. لا إعادة محاولة تلقائية: كل ضغطة = صورة واحدة.</div></div></div>`;
  }
  function paintPrev() {
    const p = $("ig-prev"); if (!p) return; if (!S.srcBlob) return;
    const u = URL.createObjectURL(S.srcBlob); p.innerHTML = `<img src="${u}" alt=""><small>${esc(S.srcName || "")}</small>`;
  }
  function estimate() {
    const el = $("ig-est"); if (!el) return; const m = cfg.model(), pr = m === "auto" ? PRICE[PREF[0]] : priceOf(m), left = cfg.budget() ? cfg.budget() - cfg.spent() : Infinity;
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
  function readForm() { ["name", "desc", "txt"].forEach(k => { const e = $("ig-" + k); if (e) LS.set("alyssum_ig_" + k, e.value); }); }

  async function generate() {
    if (S.busy) return; const msg = $("ig-msg"), key = getKey() || LS.get(KEY, "");
    const sizeId = $("ig-size").value, sz = sizeOf(sizeId); let W = sz.w, H = sz.h;
    if (sizeId === "custom") { W = Math.max(64, Math.min(4096, Number($("ig-w").value) || 1080)); H = Math.max(64, Math.min(4096, Number($("ig-h").value) || 1080)); }
    if (!key) { S.tab = "set"; render(); toast("أدخل مفتاح Gemini أولاً"); return; }
    if (!S.srcBlob) { msg.textContent = "❌ اختر صورة المنتج أولاً (رفع أو من منتجاتك)"; return; }
    const name = $("ig-name").value.trim(), desc = $("ig-desc").value.trim(); if (!name && !desc) { msg.textContent = "❌ اكتب اسم المنتج أو وصفه"; return; }
    const txtOn = $("ig-txtm").value === "text", txt = txtOn ? ($("ig-txt").value || "").trim() : ""; if (txtOn && !txt) { msg.textContent = "❌ اكتب النص المطلوب أو اختر «بلا نص»"; return; }
    readForm();
    const models = cfg.model(), est = models === "auto" ? PRICE[PREF[0]] : priceOf(models), left = cfg.budget() ? cfg.budget() - cfg.spent() : Infinity;
    if (cfg.budget() && left < est) { msg.textContent = "⛔ بلغتَ حدّ الإنفاق (" + money(cfg.budget()) + ") — ارفعه من الإعدادات أو صفّر العدّاد."; return; }
    if (!confirm("توليد صورة واحدة بتكلفة تقريبية " + money(est) + "\nالمقاس: " + W + "×" + H + " — " + (S.mode === "product" ? "صورة منتج" : "صورة إشهارية") + "\nمتابعة؟")) return;
    S.busy = true; $("ig-go").disabled = true; msg.textContent = "⏳ جارِ التوليد (قد يستغرق 10–40 ثانية)…";
    try {
      const ar = nearAr(W, H), prompt = buildPrompt({ mode: S.mode, name, desc, goal: ($("ig-goal") || {}).value ? $("ig-goal").value.trim() : "", text: txt, lang: $("ig-lang") ? $("ig-lang").value : "ar", w: W, h: H, ar, platform: sz.label });
      S.lastPrompt = prompt; const small = await shrink(S.srcBlob, 1400);
      const out = await callModel(key, [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: await b64(small) } }], ar);
      const cv = await fit(out.blob, W, H); S.res = cv; S.lastModel = out.model; S.resName = (name || "image").slice(0, 40);
      LS.set("alyssum_ig_spent", String(cfg.spent() + priceOf(out.model))); LS.set("alyssum_ig_count", String(cfg.count() + 1));
      showRes(cv, W, H); msg.textContent = "✅ تمّ بنموذج " + out.model + " — " + W + "×" + H + "px"; const cb = document.querySelector(".ig-cost"); if (cb) cb.outerHTML = costBar(); estimate();
    } catch (e) { msg.textContent = "❌ " + e.message; } finally { S.busy = false; const g = $("ig-go"); if (g) g.disabled = false; }
  }
  function showRes(cv, W, H) {
    const r = $("ig-res"); if (!r) return; const u = cv.toDataURL("image/webp", .92);
    r.innerHTML = `<div class="ig-out"><img src="${u}" alt=""></div><div class="action-bar"><button type="button" class="small" onclick="ImgGen.toEditor('current')">فتح في المطوّر (الصفحة المفتوحة)</button><button type="button" class="small" onclick="ImgGen.toEditor('new')">فتح في صفحة جديدة</button><button type="button" class="small gold" onclick="ImgGen.toLibrary()">حفظ في المكتبة</button><button type="button" class="small gray" onclick="ImgGen.download()">تنزيل</button><button type="button" class="small gray" onclick="ImgGen.copyPrompt()">نسخ التعليمات</button></div>`;
  }
  const blobOf = (cv, fmt) => new Promise(res => cv.toBlob(res, fmt === "png" ? "image/png" : "image/webp", .92));
  async function toLibrary(quiet) {
    if (!S.res) return null; const blob = await blobOf(S.res, cfg.fmt());
    try {
      let path;
      if (typeof PBApp !== "undefined" && PBApp.uploadBlob && PBApp.E && PBApp.E.page && $("pb-app") && $("pb-app").classList.contains("on")) path = await PBApp.uploadBlob(blob, "ig-" + Date.now().toString(36), { max: 4096, q: .92 });
      else { const f = new File([blob], "ig." + (cfg.fmt() === "png" ? "png" : "webp"), { type: blob.type }); path = await Admin.uploadImageFile(f, "assets/img/pages", "gen-", { max: 4096, q: .92, noVariants: true, uniq: true }); try { PBApp && PBApp.mediaAdd && PBApp.mediaAdd([path]); } catch (e) { } }
      if (!quiet) toast("✅ حُفظت في مكتبة الصور: " + path); return path;
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
  async function download() { if (!S.res) return; const blob = await blobOf(S.res, cfg.fmt()), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = (S.resName || "image") + "." + (cfg.fmt() === "png" ? "png" : "webp"); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  function copyPrompt() { try { navigator.clipboard.writeText(S.lastPrompt || ""); toast("✅ نُسخت التعليمات المرسلة"); } catch (e) { toast("تعذّر النسخ"); } }
  async function test() {
    const el = $("ig-tmsg"), key = getKey(); if (!key) { el.textContent = "❌ أدخل المفتاح"; return; } LS.set(KEY, key); el.textContent = "⏳ اختبار…"; S.models = null;
    try { const n = await listModels(key); el.textContent = n.length ? "✅ المفتاح يعمل — نماذج الصور المتاحة: " + n.slice(0, 5).join("، ") : "⚠️ المفتاح يعمل لكن لا يظهر نموذج صور — قد يلزم تفعيل الفوترة"; } catch (e) { el.textContent = "❌ " + e.message; }
  }
  const api = {
    open() { if (document.documentElement.classList.contains("app-off-imggen")) { const b = $("ig-body"); if (b) b.innerHTML = "<div class=\"hint\">مولّد الصور معطّل من إعدادات التطبيقات.</div>"; return; } render(); },
    tab(t) { S.tab = t; render(); }, mode(m) { S.mode = m; S.res = null; render(); },
    file(inp) { const f = inp.files && inp.files[0]; if (!f) return; S.srcBlob = f; S.srcName = f.name; S.prod = null; const g = $("ig-gal"); if (g) g.innerHTML = ""; paintPrev(); const n = $("ig-name"); if (n && !n.value) n.value = f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "); },
    pickProd: loadFrom, useImg, size(id) { LS.set("alyssum_ig_size_" + S.mode, id); const s = sizeOf(id); $("ig-cus").style.display = id === "custom" ? "flex" : "none"; const w = id === "custom" ? Number($("ig-w").value) : s.w, h = id === "custom" ? Number($("ig-h").value) : s.h; $("ig-sz").textContent = w + "×" + h + "px — النسبة المُرسلة للنموذج " + nearAr(w, h) + " ثم تُقصّ بدقة"; },
    cus() { LS.set("alyssum_ig_w", $("ig-w").value); LS.set("alyssum_ig_h", $("ig-h").value); api.size("custom"); },
    txtm(v) { LS.set("alyssum_ig_txtm", v); $("ig-txtbox").style.display = v === "text" ? "block" : "none"; }, lang(v) { LS.set("alyssum_ig_lang", v); },
    saveKey() { const k = getKey(); if (k) LS.set(KEY, k); toast("حُفظ المفتاح في هذا المتصفح"); }, test,
    set(k, v) { LS.set("alyssum_ig_" + k, String(v)); estimate(); }, resetSpent() { LS.set("alyssum_ig_spent", "0"); LS.set("alyssum_ig_count", "0"); render(); },
    generate, toEditor, toLibrary: () => toLibrary(false), download, copyPrompt,
    _t: { buildPrompt, nearAr, fit, sizeOf, SIZES, S }
  };
  return api;
})();
