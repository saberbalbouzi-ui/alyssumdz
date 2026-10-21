/* اختبار «منشئ الصفحات بالذكاء» (PagePilot): تنظيف النص، تجميع المكوّنات، تدفق الواجهة الكامل (النموذج مُحاكى)، فتح المطوّر وتحديد كل عنصر، وتصدير HTML.
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-pagepilot.js */
const { chromium } = require("playwright");
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } };
const COPY = { headline: "عسل السدر الملكي <b>الأصيل</b>", subheadline: "عسل طبيعي خالص من جبال الأطلس.", cta: "اطلب الآن", badges: ["طبيعي", "توصيل لكل الولايات", "الدفع عند الاستلام"],
  problem: { title: "تبحث عن عسل موثوق؟", text: "كثرة المنتجات تُربك الاختيار." }, benefitsTitle: "لماذا تحبه", benefits: Array.from({ length: 6 }, (_, i) => ({ title: "فائدة " + (i + 1), text: "نص الفائدة رقم " + (i + 1) })),
  solution: { title: "كيف يساعدك", text: "جزء من روتينك اليومي." }, stepsTitle: "كيف تطلب", steps: [{ title: "اختر", text: "اختر العرض" }, { title: "أدخل بياناتك", text: "الاسم والولاية" }, { title: "استلم", text: "ادفع عند الاستلام" }],
  faq: [{ q: "هل التوصيل متاح؟", a: "نعم لكل الولايات." }, { q: "كيف أدفع؟", a: "عند الاستلام." }, { q: "هل يعالج المرض؟", a: "هو يشفي تماماً" }, { q: "المدة؟", a: "2-5 أيام" }], closing: { title: "جرّبه اليوم", text: "اطلب الآن." } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  t("الوحدة محمّلة", await p.evaluate(() => typeof PagePilot === "object" && typeof PagePilot.buildPage === "function"));
  const c = await p.evaluate(x => PagePilot.cleanCopy(x), COPY);
  t("تنظيف: وسوم HTML تُزال", c.headline === "عسل السدر الملكي الأصيل", c.headline);
  t("تنظيف: أعداد المحتوى", c.benefits.length === 6 && c.steps.length === 3 && c.faq.length === 4 && c.badges.length === 3);
  t("تحذير الادعاء العلاجي", c.warn.length === 1 && /يشفي/.test(c.warn[0]) && /يعالج/.test(c.warn[0]), c.warn);
  t("مدخل عدائي لا يكسر", await p.evaluate(() => { const r = PagePilot.cleanCopy("x"); const r2 = PagePilot.cleanCopy({ benefits: "no", faq: [null, 5, { q: "a" }], steps: [{}] }); return r.benefits.length === 0 && r2.faq.length === 0 && r2.steps.length === 0; }));
  const fb = await p.evaluate(() => PagePilot.fallbackCopy({ title: "منتج", desc: "جملة أولى طويلة بما يكفي. جملة ثانية طويلة بما يكفي. جملة ثالثة طويلة بما يكفي. رابعة طويلة بما يكفي هنا.", bullets: ["خالٍ من السكر المضاف تماماً"] }, "ar"));
  t("نسخة بلا ذكاء: عنوان وفوائد", fb.headline === "منتج" && fb.benefits.length >= 2, fb);
  /* تجميع الصفحة */
  const pg = await p.evaluate(x => { const c = PagePilot.cleanCopy(x); return PagePilot.buildPage(c, { theme: "navy", lang: "ar", title: "عسل", product: "tarkiz", hero: "assets/img/tpl/generic-honey.webp", scene: "assets/img/tpl/generic-honey.webp", wa: "213555" }); }, COPY);
  const ws = pg.sections.flatMap(s => s.cols.flatMap(c => c.widgets));
  t("كل عنصر له id/type/set", ws.every(w => w.id && w.type && w.set), ws.length);
  t("معرّفات فريدة", new Set(ws.map(w => w.id)).size === ws.length);
  t("عناصر المنتج الحقيقية (سعر، عروض، طلب)", ["pprice", "poffers", "orderorig"].every(ty => ws.some(w => w.type === ty)) && ws.find(w => w.type === "orderorig").set.prod === "tarkiz");
  t("قسم الطلب cid=order", pg.sections.some(s => s.set.cid === "order"));
  t("أزرار CTA تشير إلى #order", ws.filter(w => w.type === "button").every(w => w.set.link === "#order"));
  t("ألوان القالب في css", /--pp-main:#123e72/.test(pg.css));
  const noP = await p.evaluate(x => PagePilot.buildPage(PagePilot.cleanCopy(x), { theme: "green", title: "t", wa: "213555", lang: "ar" }), COPY);
  const ws2 = noP.sections.flatMap(s => s.cols.flatMap(c => c.widgets));
  t("بلا منتج: زر واتساب بدل نموذج الطلب", !ws2.some(w => ["orderorig", "pprice", "poffers"].includes(w.type)) && ws2.some(w => w.type === "button" && /wa\.me\/213555/.test(w.set.link)));
  const hx = await p.evaluate(g => { const page = JSON.parse(JSON.stringify(g)); return PB.fullHtml(page, Object.assign({ base: "/" }, PBApp.siteCtx())); }, pg);
  t("الصفحة المنشورة فيها العنوان والأسئلة", /عسل السدر الملكي الأصيل/.test(hx) && /هل التوصيل متاح/.test(hx));
  t("لا وسوم خطرة", !/<script>alert/.test(hx));

  /* الواجهة: منتج من المتجر ← توليد (النموذج مُحاكى) ← فتح المطوّر */
  const res = await p.evaluate(async copy => {
    let prompt = ""; ImgGen.text = async o => { prompt = o.prompt; return copy; };
    PagePilot.open(); const g = id => document.querySelector("#pp-bg #" + id);
    const slug = ((Admin.products && Admin.products.length ? Admin.products : PRODUCTS).find(x => x.cover) || {}).slug; g("pp-prod").value = slug; g("pp-prod").dispatchEvent(new Event("change"));
    const out = { slug, name: g("pp-name").value, hasThemes: document.querySelectorAll('#pp-bg [data-pp="th"]').length };
    document.querySelector('#pp-bg [data-pp="go"]').click();
    for (let i = 0; i < 100 && document.getElementById("pp-bg"); i++) await new Promise(r => setTimeout(r, 100));
    for (let i = 0; i < 50 && !(PBApp.E && PBApp.E.page && PBApp.E.page.sections && PBApp.E.page.sections.length); i++) await new Promise(r => setTimeout(r, 100));
    out.prompt = /AIDA/.test(prompt) && prompt.includes(out.name.slice(0, 5)); const P = PBApp.E.page; out.secs = P && P.sections.length; out.prod = P && P.product === slug; out.hero = P && P.sections[0].cols[1] && P.sections[0].cols[1].widgets[0].set.src;
    return out;
  }, COPY);
  t("الواجهة: ثمانية ألوان/قوالب وتعبئة الاسم", res.hasThemes === 5 && res.name, res);
  t("البرومبت AIDA يصل مع اسم المنتج", res.prompt, res);
  t("فُتح المطوّر بالصفحة مرتبطة بالمنتج", res.secs >= 8 && res.prod, res);
  t("صورة الهيرو من صورة المنتج", res.hero && /\.(webp|png|jpe?g)/.test(res.hero), res.hero);
  /* كل عنصر قابل للتحديد في المطوّر */
  await p.waitForTimeout(1500);
  const sel = await p.evaluate(async () => { const E = PBApp.E, fd = document.getElementById("pbx-frame").contentDocument, ids = []; E.page.sections.forEach(s => s.cols.forEach(c => c.widgets.forEach(w => ids.push(w.id)))); let okN = 0; const bad = []; for (const id of ids) { E.sel = id; PBApp.renderInspectorNow(); await new Promise(r => setTimeout(r, 10)); const el = fd.querySelector('[data-pb="' + id + '"]'), i = document.getElementById("pbx-insp"); if (el && i && i.querySelectorAll("input,textarea,select,button").length > 3) okN++; else bad.push(id); } return { n: ids.length, ok: okN, bad: bad.slice(0, 5) }; });
  t("كل العناصر تُحدَّد", sel.ok === sel.n, sel);
  /* النسخة بدون ذكاء + فشل النموذج لا يضيّع شيئاً */
  const fail = await p.evaluate(async () => {
    ImgGen.text = async () => { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; };
    PagePilot.open(); const g = id => document.querySelector("#pp-bg #" + id); g("pp-name").value = "منتج تجريبي"; g("pp-desc").value = "جملة أولى طويلة بما يكفي. جملة ثانية طويلة بما يكفي. جملة ثالثة طويلة بما يكفي.";
    document.querySelector('#pp-bg [data-pp="go"]').click(); for (let i = 0; i < 80 && document.getElementById("pp-bg"); i++) await new Promise(r => setTimeout(r, 100));
    return { open: !!document.getElementById("pp-bg"), title: PBApp.E.page && PBApp.E.page.title };
  });
  t("فشل المفتاح ← تُنشأ الصفحة من النسخة الاحتياطية", !fail.open && fail.title === "منتج تجريبي", fail);
  t("بلا أخطاء صفحة", errs.length === 0, errs);
  console.log(ok + " ✓ / " + bad + " ✗"); await b.close(); process.exit(bad ? 1 : 0);
})();
