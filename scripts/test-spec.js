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
    const pg = PBSpec.toPage(spec, {}); PBApp.open(pg, "", true); await new Promise(r => setTimeout(r, 800));
    const calls = []; const oe = ImgGen.edit, orr = ImgGen.ready, ou = PBApp.uploadBlob;
    ImgGen.ready = () => ({ ok: true }); ImgGen.edit = async o => { calls.push(o); const c = document.createElement("canvas"); c.width = o.W; c.height = o.H; return { blob: await new Promise(r => c.toBlob(r, "image/webp")), canvas: c }; };
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
  console.log(errs.length ? "أخطاء صفحة: " + errs.join(" | ") : "");
  t("بلا أخطاء JS", errs.length === 0, errs);
  console.log(bad ? "فشل " + bad + " / " + (ok + bad) : "كل الفحوص نجحت (" + ok + ")"); await b.close(); process.exit(bad ? 1 : 0);
})();
