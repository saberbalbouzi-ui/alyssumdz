/* «منشئ الصفحات بالذكاء» (PagePilot) — أداة مستقلة في ستوديو ديزاين.
   رابط/وصف/منتج المتجر + صورة ← الذكاء يكتب النصوص فقط بمخطط JSON صارم (AIDA) ← تُسقط في مكوّنات جاهزة بعناصر المطوّر الحقيقية
   (هيرو، شارات، مشكلة، فوائد، حل، خطوات، عروض، أسئلة، خاتمة، طلب) ← تُفتح في المطوّر للتعديل والنشر.
   التخطيط ثابت ومضمون (لا يرسم الذكاء إحداثيات)، وبلا مفتاح تعمل «نسخة بدون ذكاء» من بيانات المنتج نفسها.
   دوال copyPrompt/cleanCopy/fallbackCopy/buildPage نقية وقابلة للاختبار. */
const PagePilot = (() => {
  const esc = t => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const strip = (s, n) => String(s == null ? "" : s).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
  const R = Math.random, uid = () => Array.from({ length: 7 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(R() * 36)]).join("");
  const dm = (d, m) => { const o = { d }; if (m != null) o.m = m; return o; };
  const W = (type, set) => ({ id: uid(), type, set: set || {} });

  const THEMES = {
    green: { n: "أخضر وبرتقالي", main: "#187a3b", acc: "#f39a18", ink: "#16324c", mut: "#5c6b78", bg: "#fbfcf7", soft: "#e9f5e4" },
    navy: { n: "كحلي وذهبي", main: "#123e72", acc: "#e9a82b", ink: "#14263b", mut: "#5a6a7c", bg: "#f8fafc", soft: "#e3edf8" },
    teal: { n: "تركوازي ومرجاني", main: "#0d7a6f", acc: "#f2784b", ink: "#133a37", mut: "#587270", bg: "#f7fbfa", soft: "#dff3ef" },
    rose: { n: "وردي وذهبي", main: "#b83a6b", acc: "#e8a33a", ink: "#3a1d2b", mut: "#7a5d6b", bg: "#fff9fb", soft: "#fbe6ee" },
    dark: { n: "أسود وذهبي", main: "#1b1b1b", acc: "#c8a24b", ink: "#1f1f1f", mut: "#666", bg: "#faf8f3", soft: "#efe9da" }
  };
  const L10 = {
    ar: { benefits: "لماذا ستحبه", steps: "كيف تطلبه", faq: "أسئلة شائعة", offers: "العروض", order: "اطلب الآن", cod: "الدفع عند الاستلام", orderBtn: "اطلب الآن ←", note: "الصور توضيحية. راجع بيانات المنتج قبل الطلب.", wa: "اطلب عبر واتساب" },
    fr: { benefits: "Pourquoi l'adopter", steps: "Comment commander", faq: "Questions fréquentes", offers: "Offres", order: "Commander", cod: "Paiement à la livraison", orderBtn: "Commander →", note: "Images à titre indicatif.", wa: "Commander sur WhatsApp" },
    en: { benefits: "Why you'll love it", steps: "How to order", faq: "FAQ", offers: "Offers", order: "Order now", cod: "Cash on delivery", orderBtn: "Order now →", note: "Images are illustrative.", wa: "Order on WhatsApp" }
  };
  const RISKY = /يعالج|يشفي|علاج نهائي|يقضي على|يمنع السرطان|معتمد من وزارة|مضمون 100|100% مضمون|cure[sd]?\b|guaranteed|clinically proven|guéri|garanti à 100/i;

  /* ───────────── النصوص: برومبت بمخطط صارم + تنظيف المخرجات ───────────── */
  function copyPrompt(info, o) {
    o = o || {}; const lang = { ar: "العربية (فصحى مبسّطة قريبة من القارئ الجزائري)", fr: "الفرنسية", en: "الإنجليزية" }[o.lang] || "العربية";
    return `أنت كاتب إعلانات محترف لصفحات الهبوط. اكتب نص صفحة هبوط للمنتج التالي بأسلوب AIDA (انتباه ← اهتمام ← رغبة ← إجراء).
اللغة: ${lang}
المنتج: ${info.title || "—"}
الوصف/المعلومات المتاحة: ${info.desc || "—"}
${info.bullets && info.bullets.length ? "نقاط من المصدر: " + info.bullets.join(" | ") + "\n" : ""}${info.price ? "السعر (للمعلومة فقط، لا تكتبه في النصوص): " + info.price + "\n" : ""}${o.audience ? "الجمهور: " + o.audience + "\n" : ""}${o.tone ? "النبرة: " + o.tone + "\n" : ""}
قواعد صارمة:
- استعمل المعلومات المقدّمة فقط؛ لا تخترع أرقاماً أو نسباً أو شهادات أو آراء زبائن أو جوائز أو اعتمادات.
- لا ادّعاءات علاجية أو طبية (يعالج/يشفي/مضمون/معتمد من…)؛ استعمل صياغة «يساعد على»/«يدعم»/«جزء من روتينك».
- لا تكتب سعراً أو تخفيضاً في النصوص (الأسعار تأتي من المتجر).
- جمل قصيرة واضحة، وعناوين ≤ 8 كلمات.
أخرج JSON واحداً فقط بلا أي شرح وبهذا الشكل بالضبط:
{"headline":"عنوان رئيسي جاذب ≤60 حرفاً","subheadline":"جملتان ≤150 حرفاً","cta":"نص زر ≤24 حرفاً",
"badges":["شارة ثقة قصيرة","شارة","شارة"],
"problem":{"title":"عنوان المشكلة/الحاجة","text":"فقرة ≤240 حرفاً"},
"benefitsTitle":"عنوان قسم الفوائد","benefits":[{"title":"≤30 حرفاً","text":"≤110 حرفاً"}] ,
"solution":{"title":"كيف يحلّها المنتج","text":"فقرة ≤260 حرفاً"},
"stepsTitle":"عنوان قسم الخطوات","steps":[{"title":"خطوة","text":"≤90 حرفاً"}],
"faq":[{"q":"سؤال","a":"جواب ≤180 حرفاً"}],
"closing":{"title":"عنوان خاتمة","text":"جملة دعوة للإجراء"}}
الأعداد: benefits ستة، steps ثلاث، faq أربعة، badges ثلاث.`;
  }
  const titled = x => { x = x && typeof x === "object" ? x : {}; const t = strip(x.title || x.t || x.name, 80), b = strip(x.text || x.body || x.d || x.desc, 320); return t || b ? { title: t, text: b } : null; };
  function cleanCopy(r) {
    r = r && typeof r === "object" ? r : {}; const arr = (a, n, f) => (Array.isArray(a) ? a : []).slice(0, n).map(f).filter(Boolean);
    const c = {
      headline: strip(r.headline || r.title, 100), sub: strip(r.subheadline || r.sub || r.subtitle, 240), cta: strip(r.cta, 30),
      badges: arr(r.badges, 4, x => strip(typeof x === "string" ? x : x && (x.text || x.title), 40)),
      problem: titled(r.problem), benefitsTitle: strip(r.benefitsTitle, 80), benefits: arr(r.benefits, 6, titled).filter(b => b.title),
      solution: titled(r.solution), stepsTitle: strip(r.stepsTitle, 80), steps: arr(r.steps, 4, titled).filter(b => b.title),
      faq: arr(r.faq, 6, x => { x = x && typeof x === "object" ? x : {}; const q = strip(x.q || x.question, 160), a = strip(x.a || x.answer, 320); return q && a ? { q, a } : null; }),
      closing: titled(r.closing)
    };
    c.warn = []; const m = JSON.stringify(c).match(new RegExp(RISKY.source, "gi")); if (m) c.warn.push("عبارات قد تُعدّ ادّعاءً: «" + Array.from(new Set(m)).join("» «") + "» — راجعها قبل النشر");
    return c;
  }
  /* نسخة بلا ذكاء: من بيانات المنتج نفسها (اسم، وصف، نقاط) */
  function fallbackCopy(info, lang) {
    const t = strip(info.title, 100), sents = strip(info.desc, 1200).split(/(?<=[.!؟?])\s+/).filter(s => s.length > 12), bl = (info.bullets || []).slice(0, 6);
    const l = L10[lang] || L10.ar;
    return cleanCopy({
      headline: t, subheadline: sents.slice(0, 2).join(" ").slice(0, 150), cta: l.orderBtn.replace(/\s*[←→]/, ""),
      badges: [l.cod], problem: null, benefits: bl.map((b, i) => ({ title: strip(b, 30) || "—", text: strip(b, 110) })).concat(sents.slice(2, 8).map(s => ({ title: strip(s, 28), text: strip(s, 110) }))).slice(0, 6),
      solution: sents.length > 2 ? { title: t, text: sents.slice(0, 3).join(" ") } : null, steps: [], faq: [], closing: { title: t, text: "" }
    });
  }

  /* ───────────── التجميع: مكوّنات ثابتة بعناصر المطوّر الحقيقية ───────────── */
  function themeCss(th, rtl) {
    return `:root{--pp-main:${th.main};--pp-acc:${th.acc};--pp-ink:${th.ink};--pp-mut:${th.mut};--pp-soft:${th.soft};--pp-bg:${th.bg}}
body.pb-page{background:var(--pp-bg);color:var(--pp-ink);font-family:'Cairo',sans-serif;overflow-x:hidden;${rtl ? "" : "direction:ltr;"}}
html{scroll-behavior:smooth}
.pp-hero{background:radial-gradient(ellipse at 78% 42%,var(--pp-soft) 0,transparent 62%),linear-gradient(180deg,#fff,var(--pp-bg))}
.pp-kick .pb-t{display:inline-block;padding:6px 14px;border-radius:999px;background:var(--pp-soft);color:var(--pp-main);font-weight:900;font-size:13px}
.pp-kick .pb-t p{margin:0}.pp-kick{display:inline-block;width:auto!important}
.pp-img img{width:100%;height:auto;max-height:560px;object-fit:contain;filter:drop-shadow(0 26px 30px rgba(0,0,0,.18));animation:ppFloat 6s ease-in-out infinite}
@keyframes ppFloat{50%{transform:translateY(-12px)}}
.pp-btn .pb-btn{background:var(--pp-acc)!important;color:#fff!important;box-shadow:0 12px 26px rgba(0,0,0,.18);transition:transform .25s}
.pp-btn .pb-btn:hover{transform:translateY(-3px) scale(1.02)}
.pp-badge{background:#fff;border:1px solid rgba(0,0,0,.07);border-radius:16px;padding:12px 10px;box-shadow:0 8px 22px rgba(0,0,0,.05)}
.pp-badge .pb-t{text-align:center;font-weight:900;color:var(--pp-main)}.pp-badge .pb-t p{margin:0}
.pp-title .pb-t h2,.pp-title .pb-t p{margin:0;line-height:1.3}
.pp-soft{background:linear-gradient(180deg,var(--pp-soft),var(--pp-bg))}
.pp-card{background:#fff;border:1px solid rgba(0,0,0,.07);border-radius:20px;padding:20px;box-shadow:0 12px 30px rgba(0,0,0,.06);margin-bottom:18px!important;transition:transform .3s,box-shadow .3s}
.pp-card:hover{transform:translateY(-6px);box-shadow:0 20px 44px rgba(0,0,0,.1)}
.pp-card h3{margin:0 0 6px;font-size:17px;color:var(--pp-main)}.pp-card p{margin:0;color:var(--pp-mut);line-height:1.85;font-size:14px}
.pp-n{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:12px;background:var(--pp-main);color:#fff;font-weight:900;margin-bottom:10px}
.pp-dark{background:linear-gradient(135deg,var(--pp-main),color-mix(in srgb,var(--pp-main) 65%,#000))}
.pp-dark .pb-t,.pp-dark .pb-t *{color:#fff!important}.pp-dark .pb-t p{margin:0}
.pp-sub .pb-t{max-width:720px;margin-inline:auto}
.pp-note .pb-t{font-size:12px;color:var(--pp-mut);text-align:center}
@media(max-width:767px){.pp-img img{max-height:380px}}`;
  }
  const SEC = (cols, cls, pad, padm, extra) => ({ id: uid(), set: Object.assign({ layout: "boxed", cw: dm(1180), pad: dm(pad, padm || pad), gap: dm(28), va: dm("center"), cls }, extra || {}), cols });
  const COL = (ws, w, wm, cls) => ({ id: uid(), set: Object.assign({ w: dm(w, wm == null ? 100 : wm) }, cls ? { cls } : {}), widgets: ws });
  const TXT = (html, fs, fsm, color, ta, extra) => W("text", Object.assign({ html, fs: dm(fs, fsm), lh: dm(1.9), ta: dm(ta || "start"), color: color || "", fw: "600" }, extra || {}));
  const HEAD = (text, fs, fsm, color, ta, tag) => W("heading", { text, tag: tag || "h2", fs: dm(fs, fsm), fw: "900", ta: dm(ta || "start"), color: color || "", lh: dm(1.25) });
  const BTN = (text, link, cls, ta) => W("button", { text, kind: "link", link, bgc: "#f39a18", color: "#fff", hbg: "#f39a18", fs: dm(17, 15), fw: "900", brad: dm(999), bpad: dm([15, 28, 15, 28]), al: dm(ta || "start"), cls: cls || "pp-btn" });
  const IMG = (src, alt, cls) => W("image", { src, alt: alt || "", fit: "contain", hauto: true, rad: dm(0), cls: cls || "pp-img" });
  const title = (t, ta, ink) => W("text", { html: "<h2>" + esc(t) + "</h2>", fs: dm(40, 26), lh: dm(1.3), ta: dm(ta || "center"), color: ink, fw: "900", cls: "pp-title" });

  function buildPage(copy, ctx) {
    ctx = ctx || {}; const th = THEMES[ctx.theme] || THEMES.green, lang = ctx.lang || "ar", rtl = lang === "ar", l = L10[lang] || L10.ar, ink = th.ink, secs = [];
    const cta = copy.cta || l.orderBtn, hasImg = !!ctx.hero, A = rtl ? "start" : "start";
    /* هيرو */
    const left = [];
    if (copy.badges && copy.badges[0]) left.push(W("text", { html: "<p>" + esc(copy.badges[0]) + "</p>", fs: dm(13, 13), color: th.main, fw: "900", cls: "pp-kick" }));
    left.push(HEAD(copy.headline || ctx.title || "", 52, 30, ink, A, "h1"));
    if (copy.sub) left.push(TXT("<p>" + esc(copy.sub) + "</p>", 18, 15, th.mut, A));
    if (ctx.product) left.push(W("pprice", { fs: dm(34, 28) }));
    left.push(BTN(cta, "#order", "pp-btn", A));
    secs.push(SEC(hasImg ? [COL(left, 56, 100), COL([IMG(ctx.hero, ctx.title, "pp-img")], 44, 100)] : [COL(left, 100)], "pp-hero", [70, 0, 60, 0], [40, 0, 36, 0], { cw: dm(1180) }));
    /* شارات الثقة */
    const bs = (copy.badges || []).slice(0, 3);
    if (bs.length > 1) secs.push(SEC(bs.map(b => COL([W("text", { html: "<p>" + esc(b) + "</p>", fs: dm(14, 13), ta: dm("center"), color: th.main, fw: "900", cls: "pp-badge" })], Math.floor(100 / bs.length), 100)), "pp-badges", [18, 0, 18, 0]));
    /* المشكلة */
    if (copy.problem && (copy.problem.title || copy.problem.text)) secs.push(SEC([COL([title(copy.problem.title || "", "center", ink), TXT("<p>" + esc(copy.problem.text) + "</p>", 17, 15, th.mut, "center", { cls: "pp-sub" })], 100)], "pp-problem", [60, 0, 30, 0], [36, 0, 16, 0], { cw: dm(860) }));
    /* الفوائد: بطاقات بثلاثة أعمدة */
    const ben = (copy.benefits || []).slice(0, 6);
    if (ben.length) {
      const card = (b, i) => W("text", { html: `<span class="pp-n">${i + 1}</span><h3>${esc(b.title)}</h3><p>${esc(b.text)}</p>`, fs: dm(15, 14), ta: dm("start"), color: ink, fw: "600", cls: "pp-card" });
      const n = ben.length <= 3 ? ben.length : 3, cols = Array.from({ length: n }, () => []); ben.forEach((b, i) => cols[i % n].push(card(b, i)));
      secs.push(SEC([COL([title(copy.benefitsTitle || l.benefits, "center", ink)], 100)], "pp-ben-h", [60, 0, 6, 0], [36, 0, 4, 0], { cw: dm(980) }));
      secs.push(SEC(cols.map(c => COL(c, Math.floor(100 / n), 100)), "pp-ben", [10, 0, 50, 0], [6, 0, 30, 0], { va: dm("start") }));
    }
    /* الحل (مع صورة المشهد إن وُجدت) */
    if (copy.solution && (copy.solution.title || copy.solution.text)) {
      const tx = [title(copy.solution.title || "", hasImg && ctx.scene ? "start" : "center", ink), TXT("<p>" + esc(copy.solution.text) + "</p>", 17, 15, th.mut, ctx.scene ? A : "center")];
      secs.push(ctx.scene ? SEC([COL([IMG(ctx.scene, ctx.title, "pp-img")], 45, 100), COL(tx, 55, 100)], "pp-soft", [60, 0, 60, 0], [36, 0, 36, 0]) : SEC([COL(tx, 100)], "pp-soft", [60, 0, 60, 0], [36, 0, 36, 0], { cw: dm(860) }));
    }
    /* الخطوات */
    const st = (copy.steps || []).slice(0, 4);
    if (st.length) {
      secs.push(SEC([COL([title(copy.stepsTitle || l.steps, "center", ink)], 100)], "pp-steps-h", [60, 0, 6, 0], [36, 0, 4, 0], { cw: dm(900) }));
      secs.push(SEC(st.map((s, i) => COL([W("text", { html: `<span class="pp-n">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>`, fs: dm(15, 14), ta: dm("start"), color: ink, fw: "600", cls: "pp-card" })], Math.floor(100 / st.length), 100)), "pp-steps", [10, 0, 50, 0], [6, 0, 30, 0], { va: dm("start") }));
    }
    /* العروض (منتج المتجر فقط) */
    if (ctx.product) secs.push(SEC([COL([title(l.offers, "center", ink), W("poffers", {}), BTN(cta, "#order", "pp-btn", "center")], 100)], "pp-offers", [50, 0, 50, 0], [30, 0, 30, 0], { cw: dm(860) }));
    /* الأسئلة */
    const fq = (copy.faq || []).slice(0, 6);
    if (fq.length) {
      const half = Math.ceil(fq.length / 2), mk = a => a.map(f => W("text", { html: `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`, fs: dm(15, 14), ta: dm("start"), color: ink, fw: "600", cls: "pp-card" }));
      secs.push(SEC([COL([title(l.faq, "center", ink)], 100)], "pp-faq-h", [60, 0, 6, 0], [36, 0, 4, 0], { cw: dm(900) }));
      secs.push(SEC([COL(mk(fq.slice(0, half)), 50, 100), COL(mk(fq.slice(half)), 50, 100)], "pp-faq", [10, 0, 50, 0], [6, 0, 30, 0], { va: dm("start"), cw: dm(1000) }));
    }
    /* الخاتمة */
    if (copy.closing && (copy.closing.title || copy.closing.text)) secs.push(SEC([COL([W("text", { html: "<h2>" + esc(copy.closing.title || ctx.title || "") + "</h2>", fs: dm(38, 26), ta: dm("center"), color: "#fff", fw: "900", lh: dm(1.3) }), copy.closing.text ? TXT("<p>" + esc(copy.closing.text) + "</p>", 17, 15, "#fff", "center") : null, BTN(cta, "#order", "pp-btn", "center")].filter(Boolean), 100)], "pp-dark", [70, 0, 70, 0], [44, 0, 44, 0], { cw: dm(820) }));
    /* الطلب */
    const wa = String(ctx.wa || "").replace(/\D/g, ""), ord = ctx.product ? [W("orderorig", { prod: ctx.product, auto: true })] : [BTN(l.wa, wa ? "https://wa.me/" + wa + "?text=" + encodeURIComponent((ctx.title || "") + "") : "#", "pp-btn", "center")];
    secs.push(SEC([COL([W("text", { html: "<h2>" + esc(l.order) + " · " + esc(l.cod) + "</h2>", fs: dm(34, 24), ta: dm("center"), color: ink, fw: "900", cls: "pp-title" })].concat(ord), 100)], "pp-order", [60, 0, 50, 0], [36, 0, 30, 0], { cw: dm(780), cid: "order" }));
    secs.push(SEC([COL([W("text", { html: "<p>" + esc(l.note) + "</p>", fs: dm(12, 12), ta: dm("center"), color: th.mut, cls: "pp-note" })], 100)], "pp-foot", [10, 0, 30, 0]));
    /* حركات الظهور */
    secs.forEach((s, si) => s.cols.forEach((c, ci) => c.widgets.forEach(w => { if (si === 0 || ["orderorig", "pprice", "poffers"].includes(w.type)) return; w.set.anim = "fadeUp"; w.set.animDur = .7; w.set.animDelay = Math.min(ci, 5) * .1; })));
    const slug = (String(ctx.slug || ctx.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) || "page-" + Date.now().toString(36).slice(-4);
    return { v: 1, title: copy.headline || ctx.title || "صفحة هبوط", slug, desc: copy.sub || "", bg: "transparent", ff: "Cairo", header: false, footer: false, css: themeCss(th, rtl), sections: secs, seoTitle: "", kw: "", cover: ctx.cover || "", product: ctx.product || "" };
  }

  /* ───────────── وضع «صور تسويقية كاملة»: بوستر لكل قسم (النص داخل الصورة) تُرصّ في الصفحة ───────────── */
  const POSTER_ORDER = { 2: ["hero", "benefits"], 3: ["hero", "benefits", "closing"], 4: ["hero", "benefits", "solution", "closing"] };
  function posterKinds(n) { return (POSTER_ORDER[n] || POSTER_ORDER[3]).slice(); }
  /* برومبت بوستر: يُرسل مع صورة المنتج؛ النصوص العربية تُعطى حرفياً بين علامتي اقتباس */
  function posterPrompt(kind, copy, info, th, lang) {
    copy = copy || {}; th = th || THEMES.green; const rtl = lang === "ar", L = { ar: "Arabic", fr: "French", en: "English" }[lang] || "Arabic";
    const q = s => '"' + String(s || "").replace(/"/g, "'") + '"', bs = (copy.badges || []).slice(0, 3);
    const ben = (copy.benefits || []).slice(0, 4).map(b => b.title).filter(Boolean);
    const head = "Create ONE vertical 3:4 marketing poster for a mobile e-commerce landing page, premium advertising-photography quality. "
      + "The attached photo is the EXACT product: keep its shape, packaging, label, colors and proportions unchanged — never redraw, rename or invent a different product or logo. "
      + "Product name (context only, do not print unless given below): " + (info && info.title || "the product") + ". "
      + "Color palette to harmonize with: main " + th.main + ", accent " + th.acc + ". ";
    const txt = "TEXT RULES: render ONLY the " + L + " texts listed below, exactly letter-for-letter as written" + (rtl ? ", correctly connected Arabic letters, right-to-left" : "") + ", in large, bold, high-contrast, clean typography with a readable background behind the text. "
      + "Do NOT add any other text, prices, phone numbers, URLs, watermarks, stars/ratings, medical claims or extra logos. ";
    let body = "";
    if (kind === "hero") body = "POSTER: HERO. Place the product large and sharp in the center-bottom inside a cinematic lifestyle scene that matches what the product is used for (dramatic lighting, depth, attractive atmosphere). "
      + "Top: giant bold headline " + q(copy.headline) + (copy.sub ? "; below it a smaller subtitle in warm yellow " + q(copy.sub) : "") + ". "
      + (bs.length ? "Bottom: " + bs.length + " short badge rows, each with a small icon, with the texts " + bs.map(q).join(", ") + ". " : "");
    else if (kind === "benefits") body = "POSTER: BENEFITS. A clean bright layout with the product on one side and a vertical list of " + ben.length + " benefit rows, each with a simple round icon and these texts: " + ben.map(q).join(", ") + ". "
      + (copy.benefitsTitle ? "Heading on top: " + q(copy.benefitsTitle) + ". " : "");
    else if (kind === "solution") body = "POSTER: SOLUTION / USAGE. A realistic lifestyle scene showing the product being used or placed naturally in its environment (no faces needed; if people appear keep them modest and fully dressed). "
      + "Texts: heading " + q(copy.solution && copy.solution.title || copy.headline) + (copy.solution && copy.solution.text ? "; short line " + q(String(copy.solution.text).slice(0, 110)) : "") + ". ";
    else body = "POSTER: CLOSING OFFER. Product presented proudly on a rich background with a glow, strong call-to-action feel. "
      + "Texts: heading " + q(copy.closing && copy.closing.title || copy.cta || copy.headline) + (bs.length ? "; trust line " + q(bs.join(" • ")) : "") + "; and a large rounded button-shaped label " + q(copy.cta || (L10[lang] || L10.ar).order) + ". ";
    return head + body + txt;
  }
  function posterAlt(kind, copy) {
    copy = copy || {}; const j = a => a.filter(Boolean).join(" — ");
    if (kind === "hero") return j([copy.headline, copy.sub, (copy.badges || []).join(" • ")]);
    if (kind === "benefits") return j([copy.benefitsTitle].concat((copy.benefits || []).map(b => b.title)));
    if (kind === "solution") return j([copy.solution && copy.solution.title, copy.solution && copy.solution.text]);
    return j([copy.closing && copy.closing.title, copy.cta]);
  }
  /* ctx.posters = [{kind,src,alt}] (المسارات بعد الرفع) */
  function buildPosterPage(copy, ctx) {
    ctx = ctx || {}; const th = THEMES[ctx.theme] || THEMES.green, lang = ctx.lang || "ar", rtl = lang === "ar", l = L10[lang] || L10.ar, ink = th.ink, secs = [];
    const cta = copy.cta || l.orderBtn.replace(/\s*[←→]/, ""), ps = (ctx.posters || []).filter(p => p && p.src);
    const tick = (copy.badges || []).concat([l.cod]).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
    const ticker = W("marquee", { mqt: tick.join("\n"), mqs: 26, mqd: rtl ? "rtl" : "ltr", mqg: dm(40), mqbg: th.main, mqc: "#ffffff", fs: dm(15, 14), fw: "800", mh: dm(46) });
    secs.push(SEC([COL([ticker], 100)], "pp-tick", [0, 0, 0, 0], [0, 0, 0, 0], { layout: "full", gap: dm(0) }));
    const ctaBtn = sticky => W("addcart", { t: cta, dest: "custom", cust: "#order", abg: th.acc, atc: "#fff", afs: dm(20, 18), apad: dm([16, 28, 16, 28]), arad: dm(16), ashine: true, asticky: !!sticky });
    const POST = (p, i) => W("image", { src: p.src, alt: p.alt || ctx.title || "", fit: "cover", hauto: true, rad: dm(0), cls: "pp-poster" });
    ps.forEach((p, i) => {
      secs.push(SEC([COL([POST(p, i)], 100)], "pp-pst", [0, 0, 0, 0], [0, 0, 0, 0], { cw: dm(640), gap: dm(0) }));
      if (i < ps.length - 1 || !ps.length) secs.push(SEC([COL([ctaBtn(false)], 100)], "pp-cta", [14, 0, 14, 0], [10, 0, 10, 0], { cw: dm(640) }));
    });
    if (ctx.product) secs.push(SEC([COL([W("pprice", { fs: dm(34, 28) }), W("poffers", {})], 100)], "pp-offers", [26, 0, 10, 0], [18, 0, 8, 0], { cw: dm(640) }));
    const wa = String(ctx.wa || "").replace(/\D/g, ""), ord = ctx.product ? [W("orderorig", { prod: ctx.product, auto: true })] : [BTN(l.wa, wa ? "https://wa.me/" + wa + "?text=" + encodeURIComponent((ctx.title || "") + "") : "#", "pp-btn", "center")];
    secs.push(SEC([COL([W("text", { html: "<h2>" + esc(l.order) + " · " + esc(l.cod) + "</h2>", fs: dm(30, 22), ta: dm("center"), color: ink, fw: "900", cls: "pp-title" })].concat(ord), 100)], "pp-order", [30, 0, 30, 0], [20, 0, 20, 0], { cw: dm(640), cid: "order" }));
    secs.push(SEC([COL([W("text", { html: "<p>" + esc(l.note) + "</p>", fs: dm(12, 12), ta: dm("center"), color: th.mut, cls: "pp-note" }), ctaBtn(true)], 100)], "pp-foot", [6, 0, 70, 0], [4, 0, 70, 0]));
    const css = themeCss(th, rtl) + "\n.pp-poster img{width:100%;height:auto;display:block;border-radius:0}.pp-pst,.pp-tick{padding-top:0!important;padding-bottom:0!important}.pp-cta{background:var(--pp-bg)}";
    const slug = (String(ctx.slug || ctx.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) || "page-" + Date.now().toString(36).slice(-4);
    return { v: 1, title: copy.headline || ctx.title || "صفحة هبوط", slug, desc: copy.sub || "", bg: "transparent", ff: "Cairo", header: false, footer: false, css, sections: secs, seoTitle: "", kw: "", cover: (ps[0] && ps[0].src) || ctx.cover || "", product: ctx.product || "" };
  }

  /* ───────────── الواجهة ───────────── */
  const S ={ info: null, imgBlob: null, imgPath: "", imp: null };
  const BTN_CSS = "border:1px solid rgba(255,255,255,.28);color:#fff;border-radius:12px;padding:.6rem 1rem;font-weight:800;cursor:pointer;font-family:inherit;backdrop-filter:blur(8px);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -3px 6px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.25)";
  const FLD = "width:100%;padding:.5rem;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.2);font-family:inherit";
  const prods = () => { const a = typeof Admin !== "undefined" && Admin.products; return a && a.length ? a : (typeof PRODUCTS !== "undefined" && PRODUCTS) || []; };
  const race = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(Object.assign(new Error("انتهت مهلة الطلب"), { code: "TIMEOUT" })), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
  const urlBlob = async u => { const r = await fetch(/^(https?:|data:|blob:)/.test(u) ? u : String(u).replace(/^\/+/, ""), { cache: "force-cache" }); if (!r.ok) throw new Error("تعذّر تحميل الصورة"); return r.blob(); };
  async function toCanvas(blob) { const url = URL.createObjectURL(blob); try { const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("صورة غير صالحة")); i.src = url; }); const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); return c; } finally { URL.revokeObjectURL(url); } }
  const canvasBlob = (c, type, q) => new Promise(r => c.toBlob(r, type || "image/webp", q || .9));
  async function upload(blob, tag) { if (typeof PBApp === "undefined" || !PBApp.uploadBlob) throw new Error("المطوّر غير متاح"); return PBApp.uploadBlob(blob, "pp-" + tag + "-" + Date.now().toString(36)); }

  function open() {
    const old = document.getElementById("pp-bg"); if (old) old.remove(); S.info = null; S.imgBlob = null; S.imgPath = ""; S.imp = null;
    const ps = prods(), bg = document.createElement("div"); bg.id = "pp-bg";
    bg.style.cssText = "position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:14px;backdrop-filter:blur(3px)";
    bg.innerHTML = `<div style="width:min(860px,100%);max-height:94vh;overflow:auto;background:rgba(9,24,18,.985);color:#fff;border:1px solid rgba(198,254,23,.3);border-radius:18px;padding:18px;direction:rtl;font-family:inherit">
<div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">🚀 منشئ الصفحات بالذكاء</h3><button data-pp="x" style="${BTN_CSS};background:rgba(255,255,255,.1)">✕</button></div>
<p style="margin:.3rem 0 .8rem;opacity:.85;line-height:1.8;font-size:.88rem">أعطني منتجاً (من متجرك أو رابط أو وصفك) فيكتب الذكاء النصوص بأسلوب AIDA وتُركَّب تلقائياً في مكوّنات جاهزة قابلة للتعديل في المطوّر. التخطيط ثابت ومضمون، والذكاء يكتب النص فقط.</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
<label style="font-size:.8rem;grid-column:1/-1">① منتج من متجرك (اختياري)<select id="pp-prod" style="${FLD}"><option value="">— بلا (رابط أو وصف يدوي) —</option>${ps.map(p => `<option value="${esc(p.slug)}">${esc(p.title)}</option>`).join("")}</select></label>
<label style="font-size:.8rem;grid-column:1/-1">أو رابط صفحة منتج<span style="display:flex;gap:6px"><input id="pp-url" dir="ltr" placeholder="https://… " style="${FLD};flex:1"><button data-pp="imp" style="${BTN_CSS};background:rgba(198,254,23,.22)">جلب</button></span></label>
<details style="grid-column:1/-1;font-size:.8rem"><summary style="cursor:pointer;opacity:.85">الموقع يمنع الجلب؟ الصق كود الصفحة بدلاً من الرابط</summary><textarea id="pp-html" dir="ltr" rows="3" placeholder="افتح صفحة المنتج ← Ctrl+U ← Ctrl+A ← Ctrl+C ← الصقه هنا ثم اضغط «جلب»" style="${FLD};width:100%;margin-top:6px"></textarea></details>
<div id="pp-impres" style="grid-column:1/-1;font-size:.82rem;line-height:1.7"></div>
<label style="font-size:.8rem">اسم المنتج<input id="pp-name" style="${FLD}"></label>
<label style="font-size:.8rem">صورة المنتج<input id="pp-file" type="file" accept="image/*" style="${FLD}"></label>
<label style="font-size:.8rem;grid-column:1/-1">وصف المنتج / ما يميّزه<textarea id="pp-desc" rows="3" style="${FLD}" placeholder="مكوّناته، فوائده، لمن؟…"></textarea></label>
<label style="font-size:.8rem">اللغة<select id="pp-lang" style="${FLD}"><option value="ar">العربية</option><option value="fr">الفرنسية</option><option value="en">الإنجليزية</option></select></label>
<label style="font-size:.8rem">الجمهور/النبرة (اختياري)<input id="pp-aud" style="${FLD}" placeholder="مثال: أمهات — نبرة دافئة"></label>
<div style="grid-column:1/-1"><div style="font-size:.8rem;margin-bottom:4px">② الألوان</div><div id="pp-themes" style="display:flex;gap:8px;flex-wrap:wrap">${Object.entries(THEMES).map(([k, t], i) => `<button data-pp="th" data-k="${k}" style="${BTN_CSS};background:linear-gradient(120deg,${t.main} 50%,${t.acc} 50%);${i ? "" : "outline:2px solid #c6fe17;"}min-width:120px">${t.n}</button>`).join("")}</div></div>
<label style="font-size:.8rem">③ نوع الصفحة<select id="pp-mode" style="${FLD}"><option value="hybrid">صفحة مصوّرة هجينة (خلفيات بالذكاء + المنتج الحقيقي + نص عربي حيّ قابل للتعديل)</option><option value="poster">بوستر كامل (النص داخل الصورة — قد تتشوه الحروف)</option><option value="layout">أقسام نصية قابلة للتعديل (هيرو، فوائد، أسئلة…)</option></select></label>
<label style="font-size:.8rem">عدد الأقسام (الهجين)<select id="pp-hn" style="${FLD}"><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8" selected>8</option></select></label>
<label style="font-size:.8rem">اللهجة<select id="pp-dia" style="${FLD}"><option value="dz">دارجة جزائرية</option><option value="msa">فصحى مبسّطة</option></select></label>
<label style="font-size:.8rem">دمج المنتج<select id="pp-strat" style="${FLD}"><option value="edit">يدمج الذكاء المنتج داخل المشهد — صورة مختلفة لكل قسم (الافتراضي)</option><option value="composite">قصّ المنتج فوق خلفية (قابل للتحريك)</option></select></label>
<label style="font-size:.85rem"><input id="pp-people" type="checkbox" checked> صور أشخاص في المشاهد (هيرو، المشكلة، الاستعمال، الخاتمة — النساء بحجاب ولباس ساتر)</label>
<label style="font-size:.85rem"><input id="pp-ticker" type="checkbox" checked> شريط علوي (دفع عند الاستلام • توصيل • تأكيد بالهاتف)</label>
<label style="font-size:.85rem"><input id="pp-gate" type="checkbox" checked> فحص جودة تلقائي للخلفيات (حتى محاولتين إضافيتين)</label>
<label style="font-size:.8rem">عدد الصور (للبوستر)<select id="pp-n" style="${FLD}"><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option></select></label>
<div style="grid-column:1/-1;font-size:.78rem;opacity:.8;line-height:1.7">تُصنع الصور من صورة المنتج المختارة: من رابط المنتج (اضغط صورة من الصور المجلوبة) أو الصورة التي ترفعها أو غلاف منتج متجرك. المنتج يبقى كما هو والذكاء يرسم المشهد والنصوص حوله.</div>
<label style="font-size:.85rem;grid-column:1/-1"><input id="pp-cut" type="checkbox"> عزل المنتج عن خلفية صورته (محلي مجاني)</label>
<label id="pp-scene-l" style="font-size:.85rem;grid-column:1/-1"><input id="pp-scene" type="checkbox"> مشهد توليدي للمنتج في قسم «الحل» (للنوع النصي فقط، يستهلك رصيد Alyssum API)</label></div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin:.9rem 0"><button data-pp="go" style="${BTN_CSS};background:rgba(198,254,23,.28)">✨ أنشئ الصفحة بالذكاء</button><button data-pp="plain" style="${BTN_CSS};background:rgba(255,255,255,.12)" title="بلا ذكاء ولا رصيد: من بيانات المنتج نفسها">نسخة بدون ذكاء</button></div>
<div id="pp-rep" style="font-size:.86rem;line-height:1.8"></div></div>`;
    document.body.appendChild(bg);
    const $ = id => bg.querySelector("#" + id), say = (h, bad) => { $("pp-rep").innerHTML = `<div style="padding:.6rem .8rem;border-radius:10px;border:1px solid ${bad ? "rgba(255,120,120,.5)" : "rgba(198,254,23,.35)"};background:${bad ? "rgba(255,80,80,.1)" : "rgba(198,254,23,.07)"}">${h}</div>`; };
    let theme = "green";
    $("pp-prod").addEventListener("change", () => { const p = ps.find(x => x.slug === $("pp-prod").value); if (!p) return; $("pp-name").value = p.title || ""; $("pp-desc").value = String(p.desc || p.description || "").slice(0, 900); });
    async function gather() {
      const p = ps.find(x => x.slug === $("pp-prod").value) || null, f = $("pp-file").files[0], imp = S.imp;
      const info = { title: $("pp-name").value.trim() || (p && p.title) || (imp && imp.title) || "", desc: $("pp-desc").value.trim() || (p && String(p.desc || p.description || "")) || (imp && imp.desc) || "", bullets: (imp && imp.bullets) || [], price: p ? String(p.price || "") : imp ? imp.price : "", product: p ? p.slug : "" };
      if (!info.title) throw new Error("اكتب اسم المنتج أو اختر منتجاً أو اجلب رابطاً");
      let blob = null, path = "";
      if (f) blob = f; else if (imp && imp.blob) blob = imp.blob; else if (p && (p.cover || (p.images || [])[0])) { path = p.cover || p.images[0]; }
      return { info, blob, path, p, imp };
    }
    async function run(useAI) {
      const g = await gather(), o = { lang: $("pp-lang").value, audience: $("pp-aud").value.trim() };
      let copy, note = "";
      if (useAI) {
        say("⏳ ١/٣ يكتب الذكاء النصوص…");
        try { const raw = await race(ImgGen.text({ prompt: copyPrompt(g.info, o), json: true, temp: .75, blobs: g.blob ? [g.blob] : undefined }), 150000); copy = cleanCopy(raw); if (!copy.headline || copy.benefits.length < 2) throw new Error("ردّ الذكاء ناقص"); }
        catch (e) { { copy = fallbackCopy(g.info, o.lang); note = "⚠ تعذّر توليد النص (" + esc(e.code === "NOKEY" ? "لم يُضبط مفتاح Alyssum API" : e.code === "OFF" ? "التوليد الذكي معطّل" : e.message) + ") فاستُعملت نسخة من بيانات المنتج. يمكنك تعديل النص في المطوّر."; } }
      } else copy = fallbackCopy(g.info, o.lang);
      say("⏳ ٢/٣ تجهيز الصور…"); const ctx = { theme, lang: o.lang, title: g.info.title, product: g.info.product, wa: (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.waNumber) || "" };
      let heroBlob = g.blob;
      if (!heroBlob && g.path) { try { heroBlob = await urlBlob(g.path); } catch (_) { } }
      /* كل صور المنتج المتاحة (رابط المنتج + صور المتجر) مراجعَ لأقسام مختلفة */
      const refs = []; if (heroBlob) refs.push(heroBlob);
      if ($("pp-mode").value === "hybrid" && $("pp-strat").value === "edit") {
        const cnt0 = +$("pp-hn").value || 8, want = Math.min(6, cnt0);
        if (g.imp && g.imp.images && g.imp.images.length > 1 && typeof PBSpec !== "undefined" && PBSpec.pickImage) {
          say("⏳ تحميل صور المنتج من الرابط…");
          for (let k = 0; k < g.imp.images.length && refs.length < want; k++) { if (k === g.imp.pick) continue; const t = { images: g.imp.images }; try { await PBSpec.pickImage(t, k); if (t.blob) refs.push(t.blob); } catch (_) { } }
        }
        if (g.p && refs.length < want) { for (const u of [g.p.cover].concat(g.p.images || [])) { if (!u || refs.length >= want || (g.path && u === g.path)) continue; try { refs.push(await urlBlob(u)); } catch (_) { } } }
      }
      if ($("pp-mode").value === "hybrid" && typeof PagePilotHybrid !== "undefined" && typeof PBSpec !== "undefined") {
        const th0 = THEMES[theme] || THEMES.green, real = (() => { try { return typeof ImgGen !== "undefined" && ImgGen.ready && ImgGen.ready().ok; } catch (_) { return false; } })(), cnt = +$("pp-hn").value || 8;
        if (!heroBlob) throw new Error("ارفع صورة المنتج أو اجلب رابطاً أو اختر منتجاً له غلاف — الصفحة المصوّرة تحتاج صورة المنتج الحقيقية");
        if (useAI && real && ImgGen.credit && ImgGen.credit.state && ImgGen.credit.state() === "out" && ImgGen.renewLocal) { if (confirm("عدّاد الرصيد في هذا المتصفح يرى أن الرصيد انتهى (قد يكون قديماً بعد تجديدك). هل جدّدتَ الرصيد فعلاً؟ سأصفّر العدّاد وأتابع.")) ImgGen.renewLocal(); else throw new Error("جدّد الرصيد ثم أعد المحاولة"); }
        if (useAI && real && !confirm("سيرسم الذكاء " + cnt + " صورة للصفحة (صورة لكل قسم، بلا نصوص) ويستهلك من رصيد Alyssum API" + ($("pp-gate").checked ? " — وفحص الجودة قد يعيد رسم بعضها" : "") + ". المتابعة؟")) throw new Error("أُلغي التوليد");
        const thumbs = []; const prog = (i, R) => { thumbs.push(R.bgCanvas.toDataURL("image/jpeg", .5)); say("⏳ ظهر القسم " + (thumbs.length) + " من " + cnt + `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">${thumbs.map(u => `<img src="${u}" style="width:52px;height:65px;object-fit:cover;border-radius:6px">`).join("")}</div>`); };
        const over = useAI ? {} : { llm: { json: async () => { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; } }, real: false, image: { bg: async (pr, i, sec) => ({ canvas: PagePilotHybrid.mockBg(PagePilotHybrid.styleBible({}, th0), sec, i), mock: true }), edit: async () => null }, vision: { check: async () => null } };
        say("⏳ ١/٣ تحليل المنتج وتخطيط الأقسام…");
        const out = await PagePilotHybrid.run({ info: g.info, blob: heroBlob, refs, theme: th0, lang: o.lang, dialect: $("pp-dia").value, count: cnt, strategy: $("pp-strat").value, gate: $("pp-gate").checked, noFaces: true, people: $("pp-people").checked, audience: o.audience }, { section: prog }, over);
        say("⏳ ٢/٣ رفع الصور وتجميع الصفحة…");
        const asm = await PagePilotHybrid.assemble(out, { title: g.info.title, product: g.info.product, lang: o.lang, wa: ctx.wa, productAlt: out.an.name || g.info.title, ticker: $("pp-ticker").checked }, (b, tag) => upload(b, tag));
        bg.remove(); PBApp.open(asm.page, "", true);
        const wn = out.note.concat(asm.warn.slice(0, 3)); if (!out.real && useAI) wn.unshift("خلفيات تجريبية محلية: فعّل مفتاح Alyssum API ليرسم الذكاء مشاهد حقيقية."); if (wn.length && PBApp.toast) setTimeout(() => PBApp.toast(wn.join(" — ")), 600);
        return;
      }
      if (useAI && $("pp-mode").value === "poster") {
        const n = +$("pp-n").value || 3, kinds = posterKinds(n), th = THEMES[theme] || THEMES.green, posters = [];
        let ready = true; try { if (typeof ImgGen === "undefined" || (ImgGen.ready && !ImgGen.ready().ok)) ready = false; } catch (_) { ready = false; }
        if (!ready) note += " توليد الصور غير مفعّل (مفتاح Alyssum API) فصُنعت الصفحة بالأقسام النصية.";
        if (ready && !heroBlob && !confirm("لم تختر صورة للمنتج: ستُرسم الصور من الوصف فقط وقد لا تشبه منتجك. للأفضل أَلغِ ثم ارفع صورة أو اجلب رابط المنتج. المتابعة؟")) throw new Error("أُلغي — اختر صورة المنتج ثم أعد المحاولة");
        if (ready && !confirm("سيرسم الذكاء " + n + " صور تسويقية ويستهلك من رصيد Alyssum API. المتابعة؟")) throw new Error("أُلغي التوليد");
        if (ready) {
          for (let i = 0; i < kinds.length; i++) {
            say("⏳ يرسم الذكاء الصورة " + (i + 1) + " من " + kinds.length + "… (قد تستغرق نحو دقيقة)");
            try { const r = await race(ImgGen.edit({ blob: heroBlob || undefined, textOnly: !heroBlob, prompt: posterPrompt(kinds[i], copy, g.info, th, o.lang), W: 1080, H: 1440, pro: true, confirm: false, title: "صورة تسويقية " + (i + 1) }), 300000); if (r && r.blob) posters.push({ kind: kinds[i], blob: r.blob, alt: posterAlt(kinds[i], copy) }); }
            catch (e) { note += " تعذّرت الصورة " + (i + 1) + " (" + esc(e.code === "NOKEY" ? "لا مفتاح" : e.code === "OFF" ? "التوليد معطّل" : e.message) + ")."; if (e.code === "NOKEY" || e.code === "OFF" || /quota|limit|402|429|credit|رصيد/i.test(e.message || "")) break; }
          }
        }
        if (posters.length) {
          say("⏳ ٣/٣ رفع الصور وفتح المطوّر…");
          for (const p of posters) { p.src = await upload(p.blob, p.kind); }
          if (g.path && !g.blob) ctx.cover = g.path;
          const pg = buildPosterPage(copy, Object.assign(ctx, { posters })); pg.media = posters.map(p => p.src);
          if (posters.length < kinds.length) note += " ظهر " + posters.length + " من " + kinds.length + " صور؛ أعد التوليد للبقية من «الصور الفارغة»/أداة مولّد الصور.";
          bg.remove(); PBApp.open(pg, "", true);
          const w2 = (copy.warn || []).concat(note ? [note] : []); if (w2.length && PBApp.toast) setTimeout(() => PBApp.toast(w2.join(" — ")), 600);
          return;
        }
        if (ready) note += " لم تنجح أي صورة فصُنعت الصفحة بالأقسام النصية.";
      }
      if (heroBlob && $("pp-cut").checked && typeof PBBgRemove !== "undefined") { try { const r = await PBBgRemove.autoCut(await toCanvas(heroBlob), { onStep: m => say("⏳ " + esc(m)) }); heroBlob = await canvasBlob(r.canvas, "image/png"); } catch (e) { note += " تعذّر عزل الخلفية فبقيت الصورة الأصلية."; } }
      let sceneBlob = null;
      if (heroBlob && $("pp-scene").checked && useAI) { try { say("⏳ يرسم الذكاء مشهد المنتج…"); const sr = await ImgGen.edit({ blob: heroBlob, prompt: "Place this exact product, unchanged (same shape, label and colors), in a clean realistic lifestyle scene that suits it, soft natural light, shallow depth of field. Absolutely no text, letters, logos, watermarks or people.", W: 1200, H: 1000, pro: true, title: "مشهد المنتج للصفحة" }); if (sr && sr.blob) sceneBlob = sr.blob; } catch (e) { note += " تعذّر المشهد التوليدي (" + esc(e.message) + ")."; } }
      say("⏳ ٣/٣ رفع الصور وفتح المطوّر…");
      if (heroBlob) ctx.hero = g.path && !g.blob && heroBlob && !$("pp-cut").checked ? g.path : await upload(heroBlob, "hero");
      if (sceneBlob) ctx.scene = await upload(sceneBlob, "scene");
      ctx.cover = ctx.hero || "";
      const pg = buildPage(copy, ctx); if (ctx.hero) pg.media = [ctx.hero].concat(ctx.scene ? [ctx.scene] : []);
      bg.remove(); PBApp.open(pg, "", true);
      const w = (copy.warn || []).concat(note ? [note] : []); if (w.length && PBApp.toast) setTimeout(() => PBApp.toast(w.join(" — ")), 600);
    }
    bg.addEventListener("click", async e => {
      const b = e.target.closest("[data-pp]"); if (!b) { if (e.target === bg) bg.remove(); return; } const a = b.dataset.pp;
      if (a === "x") bg.remove();
      else if (a === "th") { theme = b.dataset.k; bg.querySelectorAll('[data-pp="th"]').forEach(x => x.style.outline = x === b ? "2px solid #c6fe17" : ""); }
      else if (a === "imp") {
        if (typeof PBSpec === "undefined" || !PBSpec.importProduct) { say("أداة الجلب غير متاحة.", true); return; } b.disabled = true;
        try {
          const p = await PBSpec.importProduct($("pp-url").value, m => say(m), $("pp-html") && $("pp-html").value); S.imp = p; if (p.images.length && PBSpec.pickImage) { try { await PBSpec.pickImage(p, 0); } catch (_) { } }
          if (!$("pp-name").value.trim()) $("pp-name").value = p.title; if (!$("pp-desc").value.trim()) $("pp-desc").value = p.desc;
          $("pp-impres").innerHTML = p.images.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${p.images.map((u, i) => `<img data-ppi="${i}" src="${esc(u)}" referrerpolicy="no-referrer" style="width:60px;height:60px;object-fit:cover;border-radius:10px;cursor:pointer;border:2px solid ${i === p.pick ? "#c6fe17" : "rgba(255,255,255,.2)"}">`).join("")}</div><div style="opacity:.7;font-size:.75rem">اضغط صورة لاختيارها صورةً رئيسية.</div>` : "لم أجد صوراً — ارفع صورة بنفسك.";
          say("✅ جُلب: <b>" + esc(p.title || "بلا عنوان") + "</b>");
        } catch (er) { S.imp = null; say("❌ " + esc(er.message) + " — الصق كود الصفحة في الخانة أدناه، أو اكتب الاسم والوصف وارفع الصورة يدوياً.", true); const dt = $("pp-html") && $("pp-html").closest("details"); if (dt) dt.open = true; } b.disabled = false;
      }
      else if (a === "go" || a === "plain") { b.disabled = true; try { await run(a === "go"); } catch (er) { say("❌ " + esc(er.message), true); b.disabled = false; } }
    });
    bg.addEventListener("click", async e => { const im = e.target.closest("[data-ppi]"); if (!im || !S.imp || !PBSpec.pickImage) return; try { await PBSpec.pickImage(S.imp, +im.dataset.ppi); bg.querySelectorAll("[data-ppi]").forEach(x => x.style.borderColor = x === im ? "#c6fe17" : "rgba(255,255,255,.2)"); } catch (er) { say("❌ " + esc(er.message), true); } });
  }
  return { open, THEMES, copyPrompt, cleanCopy, fallbackCopy, buildPage, buildPosterPage, posterPrompt, posterKinds, posterAlt, themeCss };
})();
