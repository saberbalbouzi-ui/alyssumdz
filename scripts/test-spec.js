/* اختبار «تصميم بطبقات» (PBSpec): تنظيف مخرجات غير موثوقة، تحويل لعناصر حرة، رسم الصفحة المنشورة ومطابقة المواضع.
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-spec.js */
const { chromium } = require("playwright");
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  t("الوحدة محمّلة", await p.evaluate(() => typeof PBSpec === "object" && typeof PBSpec.validate === "function"));

  /* ١) عدائي: وسوم، javascript:، أرقام ضخمة، أنواع مجهولة */
  const H = await p.evaluate(() => {
    const r = PBSpec.validate({ format: "alyssum-design/1", page: { title: "<script>alert(1)</script>", width: 99999, bg: "red;background:url(x)" }, sections: [{ height: 1e9, layers: [
      { type: "text", text: "<img src=x onerror=alert(1)> مرحبا", x: 1e12, y: -1e9, w: 1e9, font: { size: 1e6, color: "url(javascript:1)" } },
      { type: "button", text: "x", link: "javascript:alert(1)", bg: "expression(1)" },
      { type: "image", src: "javascript:alert(1)", x: 0, y: 0, w: 100, h: 100 },
      { type: "evil", x: 1 }, { type: "shape", shape: "<b>", fill: "#fff;}body{display:none" },
      { type: "text", text: "ظل", shadow: { x: 1e9, color: "red;x:y" }, effects: [{ type: "hack" }, "float", { type: "fadeUp", delay: 1e9 }] }] }] });
    const L = r.sections[0].layers; return { ok: r.ok, title: r.page.title, w: r.page.width, bg: r.page.bg, H: r.sections[0].height, n: L.length, t0: L[0], btn: L[1], img: L[2], sh: L[3], tx: L[4] };
  });
  t("عدائي: مقبول بعد تنظيف", H.ok && H.n === 5, H);
  t("عدائي: حدود الصفحة", H.w === 1920 && H.bg === "#ffffff" && H.H === 8000, H);
  t("عدائي: خط وإحداثيات مقصوصة", H.t0.font.size === 300 && H.t0.font.color === "#1a1a1a" && H.t0.w <= 3840, H.t0);
  t("عدائي: رابط خطر ← #order", H.btn.link === "#order" && H.btn.bg === "#2e7d32", H.btn);
  t("عدائي: مصدر صورة خطر يُمسح", H.img.src === "", H.img.src);
  t("عدائي: شكل ولون", H.sh.shape === "rect" && H.sh.fill === "#c8a24b", H.sh);
  t("عدائي: ظل وتأثيرات", H.tx.shadow.x === 200 && H.tx.shadow.color === "rgba(0,0,0,.25)" && H.tx.effects.length === 2 && H.tx.effects[1].delay === 5, H.tx);
  t("JSON غير صالح", await p.evaluate(() => PBSpec.validate("{nope").ok === false));
  t("JSON داخل نص/Markdown", await p.evaluate(() => PBSpec.validate("هنا:\n```json\n" + JSON.stringify(PBSpec.SAMPLE) + "\n```").ok));

  /* ٢) النموذج الجاهز: تحويل وعرض ومطابقة المواضع */
  const info = await p.evaluate(() => {
    const spec = PBSpec.validate(PBSpec.SAMPLE); spec.page.product = "tarkiz"; const pg = PBSpec.toPage(spec, {});
    const html = PB.fullHtml(pg, Object.assign({ base: "/" }, PBApp.siteCtx()));
    return { warn: spec.warn, n: pg.sections.length, free: pg.sections.map(s => (s.free || []).length), html, types: pg.sections[0].free.map(w => w.type), fxs: pg.sections[0].free.map(w => (w.set.fxs || []).length) };
  });
  t("ثلاثة أقسام (هيرو/مزايا/نموذج)", info.n === 3, info.n);
  t("عدد الطبقات", info.free[0] === 5 && info.free[1] === 3, info.free);
  t("ظلال/تأثيرات في fxs", info.fxs.some(n => n >= 2), info.fxs);
  t("لا نص خطر في HTML", !/<script>alert|onerror=/.test(info.html));
  const q = await b.newPage({ viewport: { width: 1080, height: 900 } }); await q.setContent(info.html.replace("<head>", '<head><base href="http://localhost:8765/">'), { waitUntil: "load" }); await q.waitForTimeout(1800);
  const geo = await q.evaluate(() => {
    const out = {}; const sec = document.querySelector(".pb-sec"); const sr = sec.getBoundingClientRect(); out.secW = Math.round(sr.width); out.secH = Math.round(sr.height);
    const find = txt => { const el = [...document.querySelectorAll(".pb-btn,.pb-t")].find(e => e.textContent.includes(txt)); if (!el) return null; let w = el.closest(".pb-w,[class*=pbw]") || el; const r = w.getBoundingClientRect(); return { x: Math.round(r.left - sr.left), y: Math.round(r.top - sr.top), w: Math.round(r.width), h: Math.round(r.height) }; };
    out.h1 = find("عسل طبيعي"); out.btn = find("اطلب الآن").constructor===Object?(()=>{const e=document.querySelector(".pb-btn");const w=e.closest(".pb-w")||e;const r=w.getBoundingClientRect();return{x:Math.round(r.left-sr.left),y:Math.round(r.top-sr.top),w:Math.round(r.width),h:Math.round(r.height)}})():null; out.p = find("مصدر طبيعي");
    out.img = (() => { const i = sec.querySelector("img"); if (!i) return null; const r = i.closest("[class*=pbw],.pb-w,div").getBoundingClientRect(); return { x: Math.round(r.left - sr.left), y: Math.round(r.top - sr.top), w: Math.round(r.width), h: Math.round(r.height), src: i.getAttribute("src") }; })();
    out.sections = document.querySelectorAll(".pb-sec").length; out.order = !!document.querySelector("iframe,.pb-ofraw,#order-form"); return out;
  });
  console.log("geo", JSON.stringify(geo));
  t("عرض القسم = عرض التصميم", Math.abs(geo.secW - 1080) <= 2 && Math.abs(geo.secH - 760) <= 4, geo);
  t("موضع العنوان x=60 y=160", geo.h1 && Math.abs(geo.h1.x - 60) <= 6 && Math.abs(geo.h1.y - 160) <= 10 && Math.abs(geo.h1.w - 500) <= 8, geo.h1);
  t("موضع الزر 60,560 بعرض 320 وارتفاع 78", geo.btn && Math.abs(geo.btn.x - 60) <= 6 && Math.abs(geo.btn.y - 560) <= 6 && Math.abs(geo.btn.w - 320) <= 6 && Math.abs(geo.btn.h - 78) <= 6, geo.btn);
  t("موضع الصورة 600,120 بعرض 420", geo.img && Math.abs(geo.img.x - 600) <= 6 && Math.abs(geo.img.y - 120) <= 6 && Math.abs(geo.img.w - 420) <= 6, geo.img);
  t("حلّ asset:hero إلى مسار", geo.img && /generic-honey/.test(geo.img.src || ""), geo.img);
  t("قسم الطلب موجود", geo.order, geo);
  /* على الجوال: تناسب بلا فيض أفقي */
  await q.setViewportSize({ width: 390, height: 800 }); await q.waitForTimeout(600);
  const mob = await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  t("جوال: بلا فيض أفقي", mob.sw <= mob.iw + 2, mob);

  /* ٣) الواجهة: فتح النافذة، فحص النموذج، فتح كصفحة جديدة في المطوّر */
  await p.evaluate(() => PBSpec.open()); await p.waitForSelector("#pbx-spec");
  await p.click('[data-sp="sample"]'); await p.waitForTimeout(300);
  t("واجهة: فحص ناجح", /صالح/.test(await p.textContent("#sp-rep")), await p.textContent("#sp-rep"));
  t("واجهة: زر الفتح مفعّل", !(await p.$eval("#sp-new", e => e.disabled)));
  await p.click('[data-sp="new"]'); await p.waitForTimeout(1800);
  const ed = await p.evaluate(() => ({ on: document.getElementById("pb-app").classList.contains("on"), n: PBApp.E.page && PBApp.E.page.sections.length, fr: !!document.getElementById("pbx-frame") }));
  t("المطوّر يفتح الصفحة بالأقسام", ed.on && ed.n === 3, ed);
  const sel = await p.evaluate(async () => { const fr = document.getElementById("pbx-frame"), d = fr.contentDocument; return { w: d.querySelectorAll("[data-pb]").length }; });
  t("عناصر منفصلة قابلة للتحديد في الإطار", sel.w >= 8, sel);
  /* تحريك عنصر وحفظ إعدادات */
  const moved = await p.evaluate(() => { const P = PBApp.E.page, w = P.sections[0].free[2]; w.set.fx.d = 10; PBApp.renderCanvas(); return w.set.fx.d; });
  t("تعديل موضع عنصر ممكن", moved === 10);
  /* ٤) توليد صور الطبقات الفارغة (ImgGen مُحاكى) */
  const gi = await p.evaluate(async () => {
    const spec = PBSpec.validate({ page: { title: "t", width: 1080 }, sections: [{ height: 600, layers: [
      { type: "image", prompt: "a glass jar of golden honey on a wooden table with honeycomb", x: 100, y: 50, w: 500, h: 500, cutout: false },
      { type: "image", prompt: "x", x: 0, y: 0, w: 100, h: 100 }, { type: "image", src: "assets/img/tpl/generic-honey.webp", x: 0, y: 0, w: 100, h: 100 }] }] });
    try { localStorage.removeItem("alyssum_spec_assets"); } catch (_) { }
    const pg = PBSpec.toPage(spec, {}); PBApp.open(pg, "", true); await new Promise(r => setTimeout(r, 800));
    const calls = []; const oe = ImgGen.edit, orr = ImgGen.ready, ou = PBApp.uploadBlob;
    ImgGen.ready = () => ({ ok: true }); ImgGen.edit = async o => { calls.push(o); const c = document.createElement("canvas"); c.width = o.W; c.height = o.H; const g = c.getContext("2d"); for (let i = 0; i < 400; i++) { g.fillStyle = "rgb(" + (i * 7 % 255) + "," + (i * 13 % 255) + "," + (i * 29 % 255) + ")"; g.fillRect(i % 20 * 25, Math.floor(i / 20) * 25, 25, 25); } return { blob: await new Promise(r => c.toBlob(r, "image/png")), canvas: c }; };
    PBApp.uploadBlob = async (b, n) => "assets/img/pages/" + n + ".webp";
    const before = PBSpec.emptyImages().length; const r = await PBSpec.fillImages({ confirm: false });
    const widgets = PBApp.E.page.sections[0].free.filter(w => w.type === "image");
    ImgGen.edit = oe; ImgGen.ready = orr; PBApp.uploadBlob = ou;
    return { before, r, n: calls.length, noText: /no text/i.test(calls[0].prompt), textOnly: calls[0].textOnly, W: calls[0].W, H: calls[0].H, srcs: widgets.map(w => w.set.src), after: PBSpec.emptyImages().length };
  });
  t("صور فارغة بوصف كافٍ فقط (1 من 3)", gi.before === 1, gi);
  t("توليد صورة واحدة بتعليمات بلا كتابة ومن وصف نصي", gi.r.done === 1 && gi.n === 1 && gi.noText && gi.textOnly === true, gi);
  t("المقاس يتبع الطبقة", gi.W === 500 && gi.H === 500, gi);
  t("المسار يُوضع في عنصر الصورة", /^assets\/img\/pages\/spec-/.test(gi.srcs[0]) && gi.after === 0, gi);

  /* ٥) مرحلتان: خطة ثم مخطط (ImgGen.text مُحاكى) */
  const tp = await p.evaluate(async () => {
    const ot = ImgGen.text, calls = [];
    ImgGen.text = async o => { calls.push(o.prompt); if (calls.length === 1) return { concept: "فاخر", tone: "دافئ", palette: { primary: "#1e5e20", accent: "javascript:1", bg: "#fff" }, sections: [{ name: "hero", goal: "جذب", layout: "صورة يمين" }], assets: [{ name: "jar", prompt: "honey jar", cutout: true }] }; return JSON.parse(JSON.stringify(PBSpec.SAMPLE)); };
    const r = await PBSpec.generate({ name: "عسل", colors: "#1e5e20" }); const two = { n: calls.length, hasPlan: calls[1].includes("خطة التصميم المعتمدة") && calls[1].includes("#1e5e20"), colors: calls[0].includes("ألوان العلامة"), plan: r.plan };
    const v = PBSpec.validate(r);
    let n2 = 0; ImgGen.text = async o => { n2++; if (n2 === 1) throw new Error("boom"); return JSON.parse(JSON.stringify(PBSpec.SAMPLE)); };
    const r2 = await PBSpec.generate({ name: "x" });
    let nk = ""; ImgGen.text = async () => { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; }; try { await PBSpec.generate({}); } catch (e) { nk = e.code; }
    ImgGen.text = ot; return { two, keepPlan: !!(v.plan && v.plan.palette.primary === "#1e5e20" && !v.plan.palette.accent), fallback: n2 === 2 && !r2.plan, nk };
  });
  t("مرحلتان: خطة ثم مخطط يحمل الخطة", tp.two.n === 2 && tp.two.hasPlan && tp.two.colors, tp.two);
  t("الخطة تُنظَّف (لون خطر يسقط) وتُحفظ في المخطط", tp.keepPlan, tp);
  t("فشل الخطة لا يوقف التوليد (احتياط خطوة واحدة)", tp.fallback, tp);
  t("غياب المفتاح يُبلَّغ بوضوح", tp.nk === "NOKEY", tp);

  /* ٦) إصلاح آلي هندسي */
  const af = await p.evaluate(() => {
    const r = PBSpec.validate({ page: { title: "t", width: 1080 }, sections: [{ name: "s", height: 300, layers: [
      { type: "heading", text: "عنوان طويل جداً للاختبار", x: 900, y: 20, w: 400, font: { size: 40 } },
      { type: "text", text: "نص صغير جداً", x: 60, y: 140, w: 500, font: { size: 14 } },
      { type: "text", text: "نص يتداخل مع الذي قبله تماماً", x: 60, y: 150, w: 500, font: { size: 40 } },
      { type: "button", text: "اطلب", x: 60, y: 500, w: 300, h: 70, font: { size: 20 } }] }] });
    const L = r.sections[0].layers; return { fixes: r.fixes, L: L.map(l => ({ x: l.x, y: l.y, w: l.w, fs: l.font ? l.font.size : l.size })), H: r.sections[0].height, warnSmall: r.warn.filter(x => /صغيراً|تداخل/.test(x)).length };
  });
  t("إصلاح: ضمن الحدود (x+w ≤ 1080)", af.L[0].x + af.L[0].w <= 1080 && af.L[0].x >= 0, af);
  t("إصلاح: خط صغير يُرفع لما يُقرأ على الجوال", af.L[1].fs >= 31 && af.L[3].fs >= 31, af);
  t("إصلاح: التداخل يُزال (النص الثاني نزل)", af.L[2].y > 150 + 20, af);
  t("إصلاح: ارتفاع القسم يتّسع للمحتوى", af.H >= af.L[3].y + 70, af);
  t("إصلاح: سجلّ الإصلاحات ولا ملاحظات متبقية", af.fixes.length >= 4 && af.warnSmall === 0, af);
  t("إصلاح معطَّل بخيار fix:false", await p.evaluate(() => PBSpec.validate({ page: { width: 1080 }, sections: [{ height: 100, layers: [{ type: "text", text: "ab", x: 900, y: 0, w: 400 }] }] }, { fix: false }).fixes.length === 0));

  /* ٧) فيديو + تجميع + قفل/إخفاء + specMeta */
  const vg = await p.evaluate(async () => {
    const r = PBSpec.validate({ page: { title: "v", width: 1080, product: "tarkiz" }, assets: { a: { src: "assets/img/tpl/generic-honey.webp" } }, sections: [{ height: 800, layers: [
      { type: "video", src: "https://example.com/a.mp4", poster: "asset:a", autoplay: true, x: 60, y: 40, w: 640, h: 360 },
      { type: "video", src: "javascript:alert(1)", x: 0, y: 0, w: 100 },
      { type: "video", src: "https://example.com/b.webm", x: 60, y: 420, w: 640, h: 360 },
      { type: "shape", x: 800, y: 40, w: 200, h: 200, group: "card<b>1" }, { type: "text", text: "داخل المجموعة", x: 800, y: 260, w: 220, group: "card<b>1", locked: true },
      { type: "text", text: "مخفي على الأجهزة", x: 800, y: 400, w: 220, hidden: true }] }, { height: 300, layers: [{ type: "shape", x: 0, y: 0, w: 100, h: 100, group: "card<b>1" }] }] });
    const pg = PBSpec.toPage(r, {}); const f0 = pg.sections[0].free, f1 = pg.sections[1].free;
    const html = PB.fullHtml(pg, Object.assign({ base: "/" }, PBApp.siteCtx()));
    return { n: f0.length, types: f0.map(w => w.type), v0: f0[0].set, v2: f0[1].set, g: [f0[2].set.grp, f0[3].set.grp, f1[0].set.grp], gid: r.sections[0].layers[3].group, lock: f0[3].set.locked, hid: [f0[4].set.hd, f0[4].set.ht, f0[4].set.hm], meta: pg.specMeta && pg.specMeta.format, rt: JSON.parse(JSON.stringify(pg)).specMeta.assets.a.src, lz: /<video[^>]*data-lz="https:\/\/example\.com\/a\.mp4"[^>]*preload="none"/.test(html) && !/<video[^>]*data-lz[^>]*\ssrc=/.test(html), plain: /<video[^>]*src="https:\/\/example\.com\/b\.webm"[^>]*controls[^>]*preload="none"/.test(html) || /<video[^>]*controls[^>]*src="https:\/\/example\.com\/b\.webm"/.test(html), poster: /poster="\/?assets\/img\/tpl\/generic-honey\.webp"/.test(html), js: /video\[data-lz\]/.test(html) };
  });
  t("فيديو: رابط خطر يسقط وطبقتان صالحتان", vg.n === 5 && vg.types[0] === "video" && vg.types[1] === "video", vg);
  t("فيديو: مصدر وغلاف وتشغيل تلقائي", vg.v0.url === "https://example.com/a.mp4" && /generic-honey/.test(vg.v0.poster) && vg.v0.vauto === true && vg.v2.vauto === false, vg);
  t("فيديو: تحميل كسول (بلا src قبل الظهور) وpreload=none", vg.lz && vg.poster && vg.js, vg);
  t("فيديو: غير الآلي مع أدوات تحكم وpreload=none", vg.plain, vg);
  t("تجميع: نفس المجموعة نفس set.grp ومعرّف نظيف", vg.g[0] && vg.g[0] === vg.g[1] && vg.g[2] !== vg.g[0] && vg.gid === "card" + "b1", vg);
  t("قفل وإخفاء الأجهزة", vg.lock === true && vg.hid.every(x => x === true), vg);
  t("specMeta محفوظة وتبقى بعد JSON", vg.meta === "alyssum-design/1" && /generic-honey/.test(vg.rt), vg);

  /* ٨) حفظ وإعادة فتح: العناصر تبقى منفصلة وقابلة للتعديل */
  const rt = await p.evaluate(async () => {
    const spec = PBSpec.validate(PBSpec.SAMPLE); spec.page.product = "tarkiz"; const pg = PBSpec.toPage(spec, {}); PBApp.open(pg, "", true); await new Promise(r => setTimeout(r, 1000));
    const saved = JSON.parse(JSON.stringify(PBApp.E.page)); PBApp.close && PBApp.close(true); await new Promise(r => setTimeout(r, 400));
    PBApp.open(saved, "", true); await new Promise(r => setTimeout(r, 1000));
    const P = PBApp.E.page, free = P.sections[0].free, h1 = free.find(w => w.type === "heading"), img = free.find(w => w.type === "image"), shp = free.find(w => w.type === "shape"), btn = free.find(w => w.type === "button");
    h1.set.text = "عنوان معدّل"; img.set.fx.d = 5; img.set.fwd.d = 30; shp.set.fill = "#ff0000"; const z0 = btn.set.zi; btn.set.zi = 99; PBApp.renderCanvas(); await new Promise(r => setTimeout(r, 500));
    const d = document.getElementById("pbx-frame").contentDocument, txt = d.body.innerText;
    const rd = P.sections[0].free.map(w => w.type);
    return { flat: P.sections[0].free.length, rd, txt: txt.includes("عنوان معدّل") && !txt.includes("عسل طبيعي\nبنكهة"), meta: !!P.specMeta, red: !!d.querySelector('[fill="#ff0000"],[style*="rgb(255, 0, 0)"],[style*="#ff0000"]') || /ff0000/i.test(d.documentElement.innerHTML), z: btn.set.zi, secs: P.sections.length, otherText: txt.includes("اطلب الآن") };
  });
  t("إعادة الفتح: كل الطبقات عناصر منفصلة (5)", rt.flat === 5 && rt.secs === 3, rt);
  t("تعديل العنوان وحده يتحدّث والباقي كما هو", rt.txt && rt.otherText, rt);
  t("تغيير لون شكل وترتيب الطبقة وتحريك الصورة", rt.red && rt.z === 99, rt);
  t("specMeta تبقى بعد الحفظ/الفتح", rt.meta, rt);

  /* ٩) كاش الأصول، إلغاء، إعادة محاولة محدودة، فشل صورة لا يضيّع الباقي */
  const ck = await p.evaluate(async () => {
    const mkPage = async prompts => { const spec = PBSpec.validate({ page: { title: "t", width: 1080 }, sections: [{ height: 900, layers: prompts.map((pr, i) => ({ type: "image", prompt: pr, x: 50, y: 50 + i * 420, w: 400, h: 400 })) }] }); PBApp.open(PBSpec.toPage(spec, {}), "", true); await new Promise(r => setTimeout(r, 700)); };
    const oe = ImgGen.edit, orr = ImgGen.ready, ou = PBApp.uploadBlob; ImgGen.ready = () => ({ ok: true }); PBApp.uploadBlob = async (b, n) => "assets/img/pages/" + n + ".png";
    const noisy = async o => { const c = document.createElement("canvas"); c.width = o.W; c.height = o.H; const g = c.getContext("2d"); for (let i = 0; i < 400; i++) { g.fillStyle = "rgb(" + (i * 7 % 255) + "," + (i * 13 % 255) + "," + (i * 29 % 255) + ")"; g.fillRect(i % 20 * 25, Math.floor(i / 20) * 25, 25, 25); } return { blob: await new Promise(r => c.toBlob(r, "image/png")), canvas: c }; };
    localStorage.removeItem("alyssum_spec_assets"); localStorage.removeItem("alyssum_spec_costlog"); const out = {};
    let calls = 0; ImgGen.edit = async o => { calls++; return noisy(o); };
    await mkPage(["golden honey jar on wooden table", "fresh green herbs and leaves"]); out.r1 = await PBSpec.fillImages({ confirm: false, exists: () => true }); out.c1 = calls;
    await mkPage(["golden honey jar on wooden table", "fresh green herbs and leaves"]); calls = 0; out.r2 = await PBSpec.fillImages({ confirm: false, exists: () => true }); out.c2 = calls;
    out.stale = (await (async () => { await mkPage(["golden honey jar on wooden table"]); calls = 0; const r = await PBSpec.fillImages({ confirm: false, exists: () => false }); return { calls, done: r.done }; })());
    /* إعادة محاولة: يفشل أول طلب ثم ينجح */
    localStorage.removeItem("alyssum_spec_assets"); await mkPage(["a brand new product shot on marble"]); let n = 0; ImgGen.edit = async o => { n++; if (n === 1) throw new Error("خطأ شبكة"); return noisy(o); }; out.r3 = await PBSpec.fillImages({ confirm: false, exists: () => true }); out.n3 = n;
    /* فشل صورة واحدة (مرّتان) لا يضيّع الأخرى */
    localStorage.removeItem("alyssum_spec_assets"); await mkPage(["first image that always fails", "second image that works fine"]); n = 0; ImgGen.edit = async o => { n++; if (/always fails/.test(o.prompt)) throw new Error("فشل دائم"); return noisy(o); }; out.r4 = await PBSpec.fillImages({ confirm: false, exists: () => true }); out.n4 = n; out.srcs4 = PBApp.E.page.sections[0].free.map(w => !!w.set.src);
    /* إلغاء أثناء التوليد */
    localStorage.removeItem("alyssum_spec_assets"); await mkPage(["cancel test one image here", "cancel test two image here"]); n = 0; ImgGen.edit = async o => { n++; if (n === 1) setTimeout(() => PBSpec.cancel(), 20); await new Promise(r => setTimeout(r, 120)); return noisy(o); }; out.r5 = await PBSpec.fillImages({ confirm: false, exists: () => true }); out.n5 = n;
    out.log = PBSpec.costLog().length; ImgGen.edit = oe; ImgGen.ready = orr; PBApp.uploadBlob = ou; return out;
  });
  t("كاش: المرة الأولى تولّد صورتين", ck.r1.done === 2 && ck.c1 === 2 && ck.r1.cached === 0, ck);
  t("كاش: نفس الوصف لا يُولَّد ثانية (0 استدعاء)", ck.r2.done === 2 && ck.c2 === 0 && ck.r2.cached === 2, ck);
  t("كاش: ملف محذوف يُعاد توليده", ck.stale.calls === 1 && ck.stale.done === 1, ck.stale);
  t("إعادة محاولة واحدة بعد فشل مؤقت", ck.r3.done === 1 && ck.n3 === 2, ck);
  t("فشل صورة بعد محاولتين لا يضيّع الأخرى", ck.r4.done === 1 && ck.r4.failed === 1 && ck.n4 === 3 && ck.srcs4[0] === false && ck.srcs4[1] === true, ck);
  t("إلغاء أثناء التوليد يوقف الباقي", ck.r5.cancelled === true && ck.n5 === 1, ck);
  t("سجلّ التوليد يُسجَّل لكل أصل", ck.log >= 5, ck.log);


  /* ١٠) فحص بيانات مخترعة وجودة التصميم */
  const ln = await p.evaluate(() => {
    const L = (txt, extra) => Object.assign({ type: "text", text: txt, x: 60, y: 60, w: 600, font: { size: 40 } }, extra || {});
    const r = PBSpec.validate({ page: { title: "t", width: 1080 }, sections: [
      { height: 1200, layers: [L("عسل بسعر 2500 دج فقط"), L("خصم 50% اليوم", { y: 200 }), L("يعالج السكري نهائياً", { y: 340 }), { type: "price", x: 60, y: 460, w: 400 },
        { type: "heading", text: "عنوان", x: 60, y: 900, w: 600, font: { size: 30, family: "Cairo" } }, L("نص أكبر من العنوان", { y: 980, font: { size: 44, family: "Tajawal" } }), L("خط ثالث", { y: 1060, font: { size: 40, family: "Almarai" } })] }] });
    const ok = PBSpec.validate(PBSpec.SAMPLE);
    return { w: r.warn, okPrice: ok.warn.filter(x => /سعراً|علاجي/.test(x)).length };
  });
  t("يكشف سعراً مكتوباً يدوياً", ln.w.some(x => /سعراً\/خصماً/.test(x) && x.includes("2500")), ln.w);
  t("يكشف خصماً بنسبة مكتوباً يدوياً", ln.w.filter(x => /سعراً\/خصماً/.test(x)).length >= 2, ln.w);
  t("يكشف ادّعاءً علاجياً", ln.w.some(x => /علاجي/.test(x)), ln.w);
  t("طبقة سعر بلا منتج مرتبط تُنبَّه", ln.w.some(x => /بلا منتج مرتبط/.test(x)), ln.w);
  t("العنوان الأصغر من النص يُنبَّه", ln.w.some(x => /التسلسل البصري/.test(x)), ln.w);
  t("فراغ رأسي كبير يُنبَّه", ln.w.some(x => /فراغ رأسي|مساحة فارغة/.test(x)), ln.w);
  t("أكثر من خطّين يُنبَّه", ln.w.some(x => /أكثر من خطّين/.test(x)), ln.w);
  t("النموذج الجاهز لا يثير تنبيهات الأسعار والادّعاءات", ln.okPrice === 0, ln);

  /* ١١) الصفحة المنشورة: السعر والعرض من بيانات المنتج لا من النموذج، ونموذج الطلب حيّ */
  const pubInfo = await p.evaluate(() => {
    const r = PBSpec.validate({ page: { title: "p", width: 1080, product: "tarkiz" }, sections: [{ name: "offers", height: 420, layers: [{ type: "price", x: 60, y: 40, w: 600, h: 90 }, { type: "offers", x: 60, y: 160, w: 900, h: 220 }] }, { kind: "order", title: "اطلب" }] });
    const pg = PBSpec.toPage(r, {}); const prod = (typeof PRODUCTS !== "undefined" ? PRODUCTS : Admin.products).find(x => x.slug === "tarkiz");
    return { html: PB.fullHtml(pg, Object.assign({ base: "/" }, PBApp.siteCtx(), { products: typeof PRODUCTS !== "undefined" ? PRODUCTS : [] })), price: prod && prod.price, offers: prod && prod.offers };
  });
  const q2 = await b.newPage({ viewport: { width: 1080, height: 900 } }); await q2.setContent(pubInfo.html.replace("<head>", '<head><base href="http://localhost:8765/">'), { waitUntil: "load" }); await q2.waitForTimeout(2500);
  const pub = await q2.evaluate(() => ({ txt: document.body.innerText, form: !!document.querySelector("iframe[src*='embed'],iframe[src*='p/tarkiz'],.pb-ofraw iframe"), ifr: [...document.querySelectorAll("iframe")].map(f => f.src) }));
  t("المنشورة: السعر الحقيقي من بيانات المنتج", pubInfo.price && pub.txt.replace(/\s|,/g, "").includes(String(pubInfo.price)), { price: pubInfo.price, txt: pub.txt.slice(0, 200) });
  t("المنشورة: نموذج الطلب الحقيقي للمنتج (iframe المنتج)", pub.ifr.some(u => /p\/tarkiz\//.test(u)), pub.ifr);
  await q2.close();
  /* ١٢) تحويل عكسي: صفحة المطوّر ← JSON بطبقات (يُرجع نفس المواضع ولا يعدّل الصفحة) */
  const revRes = await p.evaluate(() => {
    const o = PBSpec.validate(PBSpec.SAMPLE), secs = PBSpec.toSections(o, {}), arr = secs.sections || secs, before = JSON.stringify(arr), r = PBSpec.fromPage({ title: "t", sections: arr });
    const a = o.sections[0].layers.find(l => l.type === "heading"), b = r.spec.sections[0].layers.find(l => l.type === "heading");
    return { ok: r.ok, same: JSON.stringify(arr) === before, a: [a.x, a.y, a.w, a.text, a.font.size], b: b && [b.x, b.y, b.w, b.text, b.font.size], order: r.spec.sections.some(s => s.kind === "order"), skipped: r.skipped };
  });
  t("عكسي: JSON صالح", revRes.ok, revRes);
  t("عكسي: الصفحة لم تتغيّر", revRes.same);
  t("عكسي: موضع العنوان ونصه وحجمه محفوظة", JSON.stringify(revRes.a) === JSON.stringify(revRes.b), revRes);
  t("عكسي: قسم الطلب يُعرَف", revRes.order, revRes);
  console.log(errs.length ? "أخطاء صفحة: " + errs.join(" | ") : "");
  t("بلا أخطاء JS", errs.length === 0, errs);
  console.log(bad ? "فشل " + bad + " / " + (ok + bad) : "كل الفحوص نجحت (" + ok + ")"); await b.close(); process.exit(bad ? 1 : 0);
})();
