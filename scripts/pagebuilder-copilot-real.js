/* ════════════════════════════════════════════════════════════════════════════════
   PBCopilotReal — المحوّلات الحقيقية لـ PBCopilot عبر AiProxy الخادمي (بيئة التطوير فقط؛ لا تُضمَّن في admin.html بعد).
   • لا مفتاح Gemini في الواجهة أبداً: كل نداء يمرّ بـ AiProxy.call إلى دالة `ai` التي تحمل المفتاح، وتفرض الحدود الدائمة في قاعدة البيانات
     (مكالمات النموذج/الصور/المحاولات لكل تشغيل + سقف يومي) وتستردّ الخصم مرة واحدة عند الفشل/المهلة/الإلغاء/المخرجات غير الصالحة.
   • المحاكيات تبقى للاختبارات: يكفي تمرير محوّلات mock:true إلى PBCopilot.run بدل ما يُنشئه create().
   • المخرجات: غلاف أوامر JSON فقط؛ الخادم يتحقق من شكله (بدل افتراض responseSchema) ثم يعيد PBCopilot التحقق الكامل (أنواع، أرقام تجارية، روابط) قبل أي تطبيق.
   • هذا الملف لا يعدّل المحرر ولا PBSpec.
   ════════════════════════════════════════════════════════════════════════════════ */
const PBCopilotReal = (() => {
  "use strict";
  const err = (code, msg, o) => Object.assign(new Error(msg || code), { code }, o || {});
  const clamp = (s, n) => String(s == null ? "" : s).slice(0, n);
  const safeId = (s, n) => String(s).replace(/[^\w.:-]/g, "_").slice(0, n || 80);
  const ASPECTS = [["1:1", 1], ["3:4", 3 / 4], ["4:3", 4 / 3], ["2:3", 2 / 3], ["3:2", 3 / 2], ["9:16", 9 / 16], ["16:9", 16 / 9]];
  const aspectOf = (W, H) => { const r = W / Math.max(1, H); return ASPECTS.slice().sort((a, b) => Math.abs(Math.log(a[1] / r)) - Math.abs(Math.log(b[1] / r)))[0][0]; };

  /* ───────────── التعليمات (من برومبت المدير الفني المعتمد: platform/docs/copilot-art-director-prompt.md) ───────────── */
  const SYSTEM = `You are an AI Art Director controlling an existing professional landing-page editor. You NEVER write HTML, CSS or JavaScript. You output ONE JSON object only: {"v":1,"ops":[{"id":"o1","op":"<name>","args":{...}}]}.
REFERENCES: every section.add and layer.add may carry "as":"name" (letters/digits/underscore only, e.g. "hero"); later ops refer to it as "$name" (e.g. layer.add{section:"$hero",...}, layer.update{ref:"$title",...}). Existing page items are referred to by their real id from the outline. Always give "as" to every section and every layer you will touch again; never invent other id formats.\nALLOWED OPS (nothing else exists): section.add{name,height<=8000,as,after:"@first|@last|<id>"} · page.background{stops:[{c:"#rrggbb",p:0..100}] (2-6),sections:["$key"...]} · layer.add{section:"$key",as,layer} · layer.update{ref,patch} · layer.delete{ref} · layer.reorder{ref,how:front|back|up|down} · layer.group{refs[]} · layer.ungroup{refs[]} · effect.set{ref,entrance:fadeIn|fadeUp|fadeDown|zoomIn|slideStart,continuous:[float|pulse|sweep|glow|kenburns|spin|sway|hoverLift|hoverZoom|hoverTilt|shine],delay,duration,shadow{x,y,blur,spread,color}} · image.removeBg{ref}.
LAYER TYPES (only): EVERY layer object MUST contain "type" set to exactly one of text|heading|image|shape|button|icon (e.g. {"type":"heading","text":"...","x":..}). text{text,x,y,w,h,z,font{size,weight,color,align}} · heading{tag,text,...same} · image{prompt (describe a scene WITHOUT any text/letters/numbers),cutout:boolean,fit,x,y,w,h,z,opacity,fade{t,b,l,r}} · shape{shape:rect|ellipse|...,fill,gradient,opacity,blur,radius,x,y,w,h,z} · button{text,link:"#pb-order",bg,x,y,w,h,z} · icon{icon,color,size,x,y,z}. Coordinates are pixels in a 928px-wide canvas.
HARD RULES
1. DO NOT flatten the page into one image; every headline, paragraph, price, button, icon and decorative shape is its own native layer. Images are only photography/lifestyle/product/background art with NO text inside.
2. ONE continuous visual journey on ONE long canvas: use a single section.add (height up to 8000) rather than many sections; set the whole backdrop with page.background (a smooth gradient whose first stop equals the colour of the section above and last stop equals the colour of the section below — see outline.sections[].edge). No boxed panels, no card grids, no hard section edges, no horizontal divider lines. Use soft ellipses with blur, translucent gradients, overlapping product art and light shapes that cross the whole canvas.
3. Arabic copy, RTL, right-aligned or centred, readable contrast (>=4.5:1 against the local background), minimum font 22px.
4. PRICES AND OFFERS: NEVER type a price, discount, percentage, saving or any number tied to money. Use ONLY these tokens, which the system replaces with the user's approved figures as plain editable text: {{price}} {{old_price}} {{save}} {{save_pct}} {{offerN.price}} {{offerN.label}} {{offerN.qty}} {{offerN.unit}} {{offerN.free}} {{product}} {{currency}}. Use only tokens listed in TOKENS; if a fact is missing, write copy without it. Never invent testimonials, ingredients, clinical claims, guarantees or discounts.
5. Keep the product's real identity; reference real product art only through image layers with a prompt.
6. Never touch protected layers (order form, html, header, footer) and never publish, save or modify products.
7. Reply with JSON only. No markdown, no commentary.`;

  const NOREF = /ingredient|texture|pattern|background|backdrop|leaf|leaves|flower|pollen|honeycomb|herb|abstract|gradient|spice|seed|مكوّن|مكون|خلفية|ملمس|نمط|عشب|أوراق/i;
  const J = o => JSON.stringify(o);
  const factsText = f => J({ product: f.product, description: f.desc || undefined, currency: f.currency, hasPrice: f.price != null, hasOldPrice: f.oldPrice != null, offers: (f.offers || []).map(o => ({ n: o.n, label: o.label, qty: o.qty, free: o.free })) });
  const planPrompt = x => `${SYSTEM}\n\nTASK: create a DESIGN PLAN (JSON object, no ops yet) for: ${clamp(x.goal, 400)}\nFACTS (numbers are available only through tokens): ${factsText(x.facts)}\nTOKENS: ${J(x.tokens)}\nPAGE OUTLINE: ${J(x.outline)}\nReturn {"palette":{"bg":"#...","accent":"#...","text":"#..."},"flow":["hero","problem","benefits","product","offer","cta"],"copy":{"headline":"...","sub":"...","benefits":["..."],"cta":"..."},"assets":[{"key":"jar","prompt":"...","cutout":true}],"edges":{"top":"#rrggbb","bottom":"#rrggbb"}}`;
  const opsPrompt = x => `${SYSTEM}\n\nTASK: build the page now from the approved plan. GOAL: ${clamp(x.goal, 400)}\nPLAN: ${J(x.plan || {})}\nFACTS: ${factsText(x.facts)}\nTOKENS: ${J(x.tokens)}\nPAGE OUTLINE (use the edge colours so your background joins its neighbours without a visible seam): ${J(x.outline)}\nReturn the ops JSON.`;
  const editPrompt = x => `${SYSTEM}\n\nTASK: INCREMENTAL EDIT — change ONLY what the instruction needs, touching the fewest layers; reference existing layers by their real ids from the outline; do not add sections.\nINSTRUCTION: ${clamp(x.instruction, 600)}\nFACTS: ${factsText(x.facts)}\nTOKENS: ${J(x.tokens)}\nPAGE OUTLINE: ${J(x.outline)}\nReturn the ops JSON.`;

  /* ───────────── الصور ───────────── */
  const b64ToBlob = (b64, mime) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime || "image/png" }); };
  function imageOf(data) { const ps = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts; const d = Array.isArray(ps) && ps.map(p => p && (p.inlineData || p.inline_data)).find(x => x && typeof x.data === "string"); if (!d) return null; return b64ToBlob(d.data, d.mimeType || d.mime_type); }

  /* نزع الخلفية الحقيقي: PBBgRemove.autoCut بالطريقة الكلاسيكية المحلية (بلا ذكاء ولا شبكة) على لوحة ≤1400px ثم PNG شفاف */
  async function removeBgLocal(src) {
    if (typeof PBBgRemove === "undefined" || !PBBgRemove.autoCut) throw err("adapter_missing", "PBBgRemove غير متاح");
    const blob = src instanceof Blob ? src : await (await fetch(src)).blob(), bmp = await createImageBitmap(blob), k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height)), cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(bmp.width * k)); cv.height = Math.max(1, Math.round(bmp.height * k)); cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    const r = await PBBgRemove.autoCut(cv, { methods: ["classic"] }); const out = r.canvas || r;
    return await new Promise((res, rej) => out.toBlob(b => (b ? res(b) : rej(err("removebg_failed", "تعذّر ترميز الصورة"))), "image/png"));
  }

  /* ───────────── المحوّلات ───────────── */
  function create(opts) {
    opts = opts || {};
    const AP = () => opts.proxy || (typeof AiProxy !== "undefined" ? AiProxy : null);
    const call = async o => { const p = AP(); if (!p || !p.call) throw err("adapter_missing", "AiProxy غير متاح"); return p.call(Object.assign({ timeoutMs: opts.timeoutMs, signal: opts.signal }, o)); };
    const text = async (stage, prompt, validate, x) => {
      const r = await call({ kind: "text", parts: [{ text: prompt }], cfg: { responseMimeType: "application/json", temperature: stage === "plan" ? 0.6 : 0.35, maxOutputTokens: stage === "plan" ? 4096 : 12288 }, run: x.runId, req: safeId(x.runId + "-llm-" + stage), validate });
      if (!r.parsed || typeof r.parsed !== "object") throw err("invalid_output", "مخرجات غير مفهومة"); return r.parsed;
    };
    return {
      llm: { plan: x => text("plan", planPrompt(x), "copilot_plan", x), ops: x => text("ops", opsPrompt(x), "copilot_envelope", x), edit: x => text("edit", editPrompt(x), "copilot_envelope", x) },
      img: { async generate(g) {
        const r = await call({ kind: "image", parts: [{ text: g.prompt }], cfg: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspectOf(g.W, g.H) } }, run: g.runId, req: safeId(g.runId + "-i-" + g.key + "-" + (g.attempt || 1)), key: safeId(g.key, 80) });
        const blob = imageOf(r.data); if (!blob) throw err("invalid_output", "لا صورة في الردّ"); return { blob };
      } },
      removeBg: opts.removeBg || removeBgLocal,
      upload: opts.upload || undefined,
      guard: { server: true, charge: async () => ({ ok: true }) },       // التحقق والخصم والحدود كلها داخل نداء الخادم نفسه (ذرّياً)؛ هذا الاسم يلبّي شرط وجود حارس خادمي فقط
      store: opts.store || undefined, hooks: opts.hooks || {}, limits: opts.limits
    };
  }

  /* ───────────── وضع التجريب: المفتاح في المتصفح (ImgGen) — للتجارب فقط ─────────────
     يستعمل آلية ImgGen القائمة كما هي (المفتاح في localStorage alyssum_gp_gkey، سقف الإنفاق alyssum_ig_budget، اختيار النموذج، قصّ الصورة للمقاس).
     الحدود هنا على جهاز المستخدم فقط (سقوف التشغيل داخل PBCopilot + ميزانية ImgGen) — ليست حماية خادمية، ولا تُستعمل خارج التجارب.
     عند ضبط رمز AiProxy يمرّ نفس النداء تلقائياً عبر الخادم (AiProxy يلفّ fetch). */
  function createBrowser(opts) {
    opts = opts || {}; const IG = () => { if (typeof ImgGen === "undefined") throw err("adapter_missing", "ImgGen غير محمّل"); return ImgGen; };
    const toErr = (e, ctl) => { if (e && e.code && /^(cancelled|timeout)$/.test(e.code)) return e; if (ctl.user) return err("cancelled", "أُلغي الطلب", { cancelled: true }); if (ctl.timedOut) return err("timeout", "انتهت مهلة النموذج", { retryable: true });
      const m = String(e && e.message || e), c = e && e.code; if (c === "NOKEY") return err("nokey", "لا يوجد مفتاح — الصقه في إعدادات مولّد الصور", { limit: true }); if (c === "OFF") return err("off", "التوليد الذكي معطّل في الإعدادات", { limit: true });
      if (/سقف|رصيد|budget|نفد|انتهى/i.test(m)) return err("budget", m, { limit: true }); if (/\b(401|402|403)\b/.test(m)) return err("auth", m, { limit: true }); return err(c || "model_error", m, { retryable: true }); };
    const guarded = async (fn, ms) => { const ctl = { user: false, timedOut: false }, ac = new AbortController(); let tm, off;
      const stop = new Promise((_, rej) => { tm = setTimeout(() => { ctl.timedOut = true; ac.abort(); rej(err("timeout", "انتهت مهلة النموذج", { retryable: true })); }, ms || opts.timeoutMs || 90000);
        if (opts.signal) { const f = () => { ctl.user = true; ac.abort(); rej(err("cancelled", "أُلغي الطلب", { cancelled: true })); }; if (opts.signal.aborted) f(); else { opts.signal.addEventListener("abort", f, { once: true }); off = () => opts.signal.removeEventListener("abort", f); } } });
      try { return await Promise.race([fn(ac.signal), stop]); } catch (e) { throw toErr(e, ctl); } finally { clearTimeout(tm); if (off) off(); stop.catch(() => { }); } };
    const text = (stage, prompt, needOps) => guarded(async signal => {
      const j = await IG().text({ prompt, json: true, temp: stage === "plan" ? 0.6 : 0.35, maxTokens: stage === "plan" ? 4096 : 14000, signal });
      if (!j || typeof j !== "object" || Array.isArray(j)) throw err("invalid_output", "مخرجات غير مفهومة"); if (needOps && !Array.isArray(j.ops)) throw err("invalid_output", "الغلاف بلا ops"); return j; });
    return {
      llm: { plan: x => text("plan", planPrompt(x), false), ops: x => text("ops", opsPrompt(x), true), edit: x => text("edit", editPrompt(x), true) },
      img: { generate: g => guarded(async () => {
        /* صورة المنتج المرجعية (من القائمة أو المرفوعة): تُرسل مع الطلب لكل صورة تخص المنتج نفسه (عبوة/جرة/قارورة)، لا للخلفيات والمكوّنات */
        const ref = typeof opts.ref === "function" && !NOREF.test(g.prompt || "") ? await Promise.resolve(opts.ref()).catch(() => null) : null;
        const r = await IG().edit(ref ? { blob: ref, confirm: false, prompt: "Use the attached photo as the exact product reference (keep its shape, colours and label unchanged). " + g.prompt, W: g.W, H: g.H, fmt: "png", title: "Copilot" } : { textOnly: true, confirm: false, prompt: g.prompt, W: g.W, H: g.H, fmt: "png", title: "Copilot" }); if (!r || !r.blob) throw err("invalid_output", "لا صورة في الردّ"); return { blob: r.blob }; }, 150000) },
      removeBg: opts.removeBg || removeBgLocal, upload: opts.upload || undefined,
      guard: { trial: true, charge: async () => { const rd = IG().ready(); if (!rd.ok) return { ok: false, reason: rd.nokey ? "nokey" : "off" }; if (!IG().estimate().can(1)) return { ok: false, reason: "budget" }; return { ok: true }; } },
      store: opts.store || undefined, hooks: opts.hooks || {}, limits: opts.limits
    };
  }
  return { create, createBrowser, removeBgLocal, imageOf, aspectOf, planPrompt, opsPrompt, editPrompt, SYSTEM, safeId };
})();
if (typeof window !== "undefined") window.PBCopilotReal = PBCopilotReal;
