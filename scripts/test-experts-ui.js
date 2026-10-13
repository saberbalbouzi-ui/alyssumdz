/* اختبار واجهات «شبكة الخبراء» على متصفح حقيقي بخادم مُحاكى (الخادم الحقيقي مختبَر في test-experts.sh):
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-experts-ui.js
   (1) مساحة المستقل saas/experts.html: تسجيل بضغط صورة حقيقية، المفتاح السرّي، الدخول، التعديل، الإيقاف.
   (2) تبويب التاجر assets/js/admin-experts.js: بحث ومرشّحات وبطاقات وواتساب والتقييم. (3) تبويب المزوّد saas/experts-admin.js. */
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0, total = 0;
const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = http.createServer((q, r) => { let f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });

/* خادم مُحاكى: يطابق عقد الدوالّ (هيئة الجسم {p:{…}} ورموز الأخطاء) */
const CATS = [{ id: 1, slug: "branding", ar: "هوية وتغليف", fr: "Branding", en: "Branding", icon: "🎨", n: 2 }, { id: 2, slug: "media_buyers", ar: "مشترو إعلانات", fr: "Media Buyers", en: "Media Buyers", icon: "📣", n: 1 }];
const DB = { experts: [
  { id: "11111111-1111-1111-1111-111111111111", name: "Sara Design <b>x</b>", headline: "مصممة تغليف", cat: "branding", cat_ar: "هوية وتغليف", wilaya: 16, city: "Alger", remote: true, rate_type: "per_task", rate_from: 5000, rate_to: 12000, cur: "DZD", rating: 4.5, count: 2, thumb: "", langs: ["ar", "fr"], bio: "خبرة 5 سنوات", socials: { instagram: "https://instagram.com/sara", facebook: "javascript:alert(1)" }, portfolio: [{ t: "link", u: "https://behance.net/sara", title: "Behance" }], whatsapp: "213555123456", reviews: [{ stars: 5, comment: "ممتازة", at: "2026-10-01", by: "متجر س" }] },
  { id: "22222222-2222-2222-2222-222222222222", name: "Karim Ads", headline: "مشتري إعلانات فيسبوك", cat: "media_buyers", cat_ar: "مشترو إعلانات", wilaya: 31, city: "Oran", remote: false, rate_type: "monthly", rate_from: 40000, rate_to: null, cur: "DZD", rating: 0, count: 0, thumb: "", langs: ["ar"], bio: "", socials: {}, portfolio: [], whatsapp: "213666000111", reviews: [] }],
  me: null, calls: [], contacts: 0 };
const ERRS = { unknown: null };
function handle(fn, p) {
  DB.calls.push([fn, p]);
  const E = (m, c) => { const e = new Error(m); e.status = 400; e.body = { message: m, code: c || "P0001" }; throw e; };
  switch (fn) {
    case "experts_categories": return CATS;
    case "experts_search": { let L = DB.experts.filter(x => (!p.p.cat || x.cat === p.p.cat) && (!p.p.q || (x.name + x.headline).toLowerCase().includes(String(p.p.q).toLowerCase())) && (!p.p.remote || x.remote) && (!p.p.min_rating || x.rating >= +p.p.min_rating)); return { total: L.length, page: 1, per: 12, items: L.map(x => Object.assign({}, x, { whatsapp: undefined, bio: undefined, reviews: undefined })) }; }
    case "expert_get": { const x = DB.experts.find(e => e.id === p.p.id); if (!x) E("not_found"); return Object.assign({}, x, { whatsapp: undefined }); }
    case "expert_contact": { if (p.p.origin.indexOf("unknown") >= 0) E("unknown_site"); DB.contacts++; const x = DB.experts.find(e => e.id === p.p.id); return { wa: x.whatsapp, name: x.name }; }
    case "expert_review": { if (p.p.stars < 1) E("bad_stars"); return { rating: 4.7, count: 3 }; }
    case "expert_report": return { ok: true };
    case "expert_register": { if (p.p.consent !== "true") E("consent_required"); DB.me = Object.assign({ id: "33333333-3333-3333-3333-333333333333", key: "k".repeat(64), status: "pending" }, { reg: p.p }); return { id: DB.me.id, key: DB.me.key, status: "pending" }; }
    case "expert_me": { if (!DB.me || p.p.key !== DB.me.key) E("bad_key", "42501"); const r = DB.me.reg; return { id: DB.me.id, name: r.name, headline: r.headline, cat: r.cat, bio: r.bio, wilaya: r.wilaya, city: r.city, remote: r.remote, rate_type: r.rate_type, rate_from: r.rate_from, rate_to: r.rate_to, langs: r.langs, socials: r.socials, portfolio: r.portfolio, thumb: r.thumb, whatsapp: r.whatsapp, status: DB.me.status, note: "", contacts: 3, rating: 0, count: 0 }; }
    case "expert_update": { if (p.p.key !== DB.me.key) E("bad_key"); DB.me.reg = p.p; const re = DB.me.status === "approved"; if (re) DB.me.status = "pending"; return { status: DB.me.status, reviewed_again: re }; }
    case "expert_pause": { DB.me.status = p.p.paused === "true" ? "paused" : "approved"; return { status: DB.me.status }; }
    case "expert_delete": DB.me = null; return { ok: true };
  }
  E("unknown fn " + fn);
}
async function mockRoutes(ctx) {
  await ctx.route("**/rest/v1/rpc/**", async route => {
    const fn = route.request().url().split("/rpc/")[1], body = JSON.parse(route.request().postData() || "{}");
    try { const r = handle(fn, body); await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(r) }); }
    catch (e) { await route.fulfill({ status: e.status || 500, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(e.body || { message: String(e.message) }) }); }
  });
}
(async () => {
  await new Promise(r => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await mockRoutes(ctx);
  /* ───── (1) مساحة المستقل ───── */
  const p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  await p.goto(base + "/saas/experts.html"); await p.waitForSelector("[data-go=reg]");
  ok("الصفحة الرئيسية: عنوان وزرّا تسجيل/دخول", await p.evaluate(() => /الجزائرية/.test(document.body.textContent) && !!document.querySelector("[data-go=login]")));
  await p.click("[data-lang=fr]"); ok("تبديل إلى الفرنسية", await p.evaluate(() => /Rejoignez/.test(document.body.textContent) && document.documentElement.dir === "ltr")); await p.click("[data-lang=ar]");
  await p.click("[data-go=reg]"); await p.waitForSelector("[data-f=name]");
  ok("قائمة التخصصات من الخادم + الولايات", await p.evaluate(() => document.querySelectorAll("[data-f=cat] option").length === 3 && document.querySelectorAll("[data-f=wilaya] option").length > 50));
  // إرسال فارغ ← خطأ محلي بلا اتصال
  await p.click("[data-a=register]"); ok("نموذج فارغ يُرفض محلياً بلا اتصال", (await p.evaluate(() => !!document.querySelector(".msg.e"))) && !DB.calls.some(c => c[0] === "expert_register"));
  const before = DB.calls.length;
  // ملء الحقول
  await p.fill("[data-f=name]", "Yacine Studio"); await p.fill("[data-f=headline]", "صانع محتوى UGC للمنتجات"); await p.selectOption("[data-f=cat]", "branding"); await p.fill("[data-f=bio]", "أنجزت 40 مشروعاً"); await p.selectOption("[data-f=wilaya]", "16"); await p.fill("[data-f=city]", "Bab Ezzouar");
  await p.fill("[data-f=wa]", "0555 12 34 56"); await p.selectOption("[data-f=rate_type]", "per_task"); await p.fill("[data-f=rate_from]", "3000"); await p.fill("[data-f=rate_to]", "9000"); await p.fill("[data-soc=instagram]", "https://instagram.com/yacine");
  // صورة حقيقية كبيرة (ضوضاء 3000×2000 ← يجب أن تُضغط تحت الحد)
  const png = await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 3000; c.height = 2000; const x = c.getContext("2d"); const id = x.createImageData(3000, 2000); for (let i = 0; i < id.data.length; i += 4) { id.data[i] = Math.random() * 255; id.data[i + 1] = (i / 4 % 3000) / 12; id.data[i + 2] = 120; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); return c.toDataURL("image/png").split(",")[1]; });
  const tmp = path.join(require("os").tmpdir(), "ex-big.png"); fs.writeFileSync(tmp, Buffer.from(png, "base64"));
  ok("الصورة الأصلية كبيرة فعلاً (>1MB)", fs.statSync(tmp).size > 1e6, fs.statSync(tmp).size);
  await p.setInputFiles("#pf-file", tmp); await p.waitForSelector(".pf img", { timeout: 20000 });
  const sizes = await p.evaluate(() => ({ img: ExpertsPage.S.form.portfolio[0].d.length, th: ExpertsPage.S.form.thumb.length, fmt: ExpertsPage.S.form.portfolio[0].d.slice(0, 20) }));
  ok("الصورة ضُغطت تحت حد الخادم (≤150000) والمصغّرة (≤40000)", sizes.img <= 150000 && sizes.th > 0 && sizes.th <= 40000 && /^data:image\/(webp|jpeg)/.test(sizes.fmt), sizes);
  await p.click("[data-a=addlink]"); await p.fill("[data-pu]", "https://behance.net/yacine"); await p.fill("[data-pt='1']", "Behance");
  await p.click("[data-a=register]"); ok("بلا موافقة ← رسالة وعدم إرسال", await p.evaluate(() => /الموافقة/.test((document.querySelector(".msg.e") || {}).textContent || "")) && !DB.calls.some(c => c[0] === "expert_register"));
  await p.check("[data-f=consent]"); await p.click("[data-a=register]"); await p.waitForSelector("#k-val", { timeout: 8000 });
  const reg = DB.calls.find(c => c[0] === "expert_register")[1].p;
  ok("الحمولة صحيحة (واتساب/تسعير/معرض/موافقة)", reg.name === "Yacine Studio" && reg.cat === "branding" && reg.whatsapp === "0555 12 34 56" && reg.rate_from === 3000 && reg.rate_to === 9000 && reg.wilaya === 16 && reg.consent === "true" && reg.portfolio.length === 2 && reg.portfolio[0].t === "img" && reg.portfolio[1].u === "https://behance.net/yacine" && reg.socials.instagram === "https://instagram.com/yacine" && !("cur" in reg && reg.cur !== "DZD"), Object.assign({}, reg, { portfolio: "…", thumb: "…" }));
  ok("المفتاح السرّي يظهر مرة واحدة مع تحذير", await p.evaluate(() => document.getElementById("k-val").textContent.length === 64 && /مرة واحدة/.test(document.body.textContent)));
  await p.click("[data-a=keydone]"); await p.waitForSelector(".st.pending");
  ok("بعد المتابعة: ملفي بحالة «بانتظار الموافقة» ومفتاحي محفوظ", await p.evaluate(() => /بانتظار الموافقة/.test(document.body.textContent) && !!localStorage.getItem("alyssum_expert_me")));
  // تعديل
  await p.fill("[data-f=headline]", "عنوان جديد للملف"); await p.click("[data-a=update]"); await p.waitForFunction(() => /تم الحفظ/.test(document.body.textContent));
  ok("التعديل يرسل المعرّف والمفتاح", DB.calls.filter(c => c[0] === "expert_update").length === 1 && DB.calls.find(c => c[0] === "expert_update")[1].p.headline === "عنوان جديد للملف");
  // اعتماد ثم إيقاف/استئناف
  DB.me.status = "approved"; await p.reload(); await p.waitForSelector(".st.approved");
  ok("إعادة التحميل تدخل تلقائياً بالمفتاح المحفوظ", await p.evaluate(() => /معتمد/.test(document.body.textContent)));
  await p.click("[data-a=pause]"); await p.waitForSelector(".st.paused"); await p.click("[data-a=resume]"); await p.waitForSelector(".st.approved");
  ok("إيقاف الظهور ثم استئنافه", true);
  await p.fill("[data-f=name]", "Yacine Studio 2"); await p.click("[data-a=update]"); await p.waitForFunction(() => /عاد للمراجعة|عاد|المراجعة/.test(document.body.textContent) || !!document.querySelector(".st.pending"));
  ok("تعديل الاسم لملف معتمد ← يعود للمراجعة ويُخبَر", await p.evaluate(() => !!document.querySelector(".st.pending") && /للمراجعة/.test(document.body.textContent)));
  // مفتاح خاطئ
  await p.evaluate(() => { localStorage.removeItem("alyssum_expert_me"); }); await p.reload(); await p.click("[data-go=login]"); await p.fill("#lg-id", "33333333-3333-3333-3333-333333333333"); await p.fill("#lg-key", "wrong"); await p.click("[data-a=login]"); await p.waitForSelector(".msg.e");
  ok("مفتاح خاطئ ← رسالة واضحة", await p.evaluate(() => /غير صحيح/.test(document.querySelector(".msg.e").textContent)));
  await p.fill("#lg-key", "k".repeat(64)); await p.click("[data-a=login]"); await p.waitForSelector(".st");
  await p.click("[data-a=del]"); await p.waitForSelector("[data-go=reg]"); ok("حذف الملف نهائياً يعيد للرئيسية", DB.me === null && await p.evaluate(() => !localStorage.getItem("alyssum_expert_me")));
  ok("لا أخطاء جافاسكربت (مساحة المستقل)", errs.length === 0, errs);
  // XSS: نص خبيث لا يُنفَّذ
  ok("لا حقن HTML من الحقول", await p.evaluate(() => { ExpertsPage.S.view = "reg"; ExpertsPage.S.form = ExpertsPage._t.blank(); ExpertsPage.S.form.name = '"><img src=x onerror=window.__x=1>'; ExpertsPage.view(); return !window.__x && !document.querySelector("img[src=x]"); }));
  await p.setViewportSize({ width: 390, height: 800 }); ok("جوال: بلا تمرير أفقي", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

  /* ───── (2) تبويب التاجر ───── */
  const m = await ctx.newPage(), merrs = []; m.on("pageerror", e => merrs.push(e.message)); m.on("dialog", d => d.accept());
  await ctx.route("**/__blank", r => r.fulfill({ contentType: "text/html", body: "<!doctype html><meta charset=utf-8><body></body>" })); await m.goto(base + "/__blank");
  await m.evaluate(async () => {
    document.body.innerHTML = '<div id="tab-experts" class="hidden"><div id="experts-content"></div></div>'; window.CONFIG = { SITE: { name: "Mystore" } };
    window.Admin = { tab() { } }; window.__opened = []; window.open = u => { const w = { location: { set href(v) { window.__opened.push(v); } }, close() { } }; return w; };
    for (const s of ["../assets/js/saas-client.js", "../assets/js/admin-experts.js"]) await new Promise(r => { const e = document.createElement("script"); e.src = s; e.onload = r; document.body.appendChild(e); });
    Admin.tab("experts");
  });
  await m.waitForSelector(".ex-card", { timeout: 8000 });
  ok("بطاقتان وفئات بعدّادها", await m.evaluate(() => document.querySelectorAll(".ex-card").length === 2 && document.querySelectorAll(".ex-cat").length >= 3));
  ok("اسم خبيث يُهرَّب (لا وسم b)", await m.evaluate(() => !document.querySelector("#ex-app .ex-card b") || !/Sara Design/.test(document.querySelector("#ex-app .ex-card b").textContent) || document.querySelector(".ex-card").innerHTML.indexOf("&lt;b&gt;") >= 0));
  await m.click('.ex-cat[data-v="media_buyers"]'); await m.waitForFunction(() => document.querySelectorAll(".ex-card").length === 1);
  ok("مرشّح التصنيف", await m.evaluate(() => /Karim/.test(document.querySelector(".ex-card").textContent)));
  await m.click('.ex-cat[data-v=""]'); await m.waitForFunction(() => document.querySelectorAll(".ex-card").length === 2);
  await m.fill("#ex-q", "تغليف"); await m.waitForFunction(() => document.querySelectorAll(".ex-card").length === 1, null, { timeout: 5000 });
  ok("البحث النصّي", await m.evaluate(() => /Sara/.test(document.querySelector(".ex-card").textContent)));
  await m.click('.ex-card [data-ex="wa"]'); await m.waitForFunction(() => window.__opened.length > 0);
  ok("زر واتساب: يسجّل التواصل ويفتح wa.me برقم الخبير ورسالة", await m.evaluate(() => /^https:\/\/wa\.me\/213555123456\?text=/.test(window.__opened[0]) && decodeURIComponent(window.__opened[0]).indexOf("Mystore") > 0) && DB.contacts === 1);
  await m.click('.ex-card [data-ex="view"]'); await m.waitForSelector("#ex-modal");
  ok("الملف: روابط https فقط (javascript: يُهمَل) + التقييمات", await m.evaluate(() => { const h = document.getElementById("ex-modal").innerHTML; return h.indexOf("javascript:") < 0 && h.indexOf("behance.net/sara") >= 0 && /ممتازة/.test(h); }));
  await m.click('#ex-modal [data-ex="star"][data-n="4"]'); await m.fill("#ex-cm", "عمل جيد"); await m.click('#ex-modal [data-ex="rate"]'); await m.waitForFunction(() => /شكراً/.test(document.getElementById("ex-modal").textContent));
  const rv = DB.calls.find(c => c[0] === "expert_review")[1].p; ok("التقييم يُرسل 4 نجوم وأصل الموقع", rv.stars === 4 && rv.comment === "عمل جيد" && /^http/.test(rv.origin), rv);
  ok("لا أخطاء جافاسكربت (تبويب التاجر)", merrs.length === 0, merrs);
  // موقع غير مسجَّل
  ok("التقييم يحدّث الملف من الخادم", await m.evaluate(() => /ممتازة/.test(document.getElementById("ex-modal").textContent)) && DB.calls.filter(c => c[0] === "expert_get").length >= 2);
  // موقع غير مسجَّل ← رسالة إرشادية بدل واتساب
  await m.evaluate(() => { window.__opened.length = 0; document.getElementById("ex-modal").remove(); }); DB.calls.length = 0;
  ok("(احتياط) لا واتساب بلا رقم", await m.evaluate(() => window.__opened.length === 0));
  // تبويب المزوّد: عرض الملفات وحقن آمن
  const a = await ctx.newPage(), aerrs = []; a.on("pageerror", e => aerrs.push(e.message)); a.on("dialog", d => d.accept());
  await a.goto(base + "/__blank");
  await a.evaluate(async () => {
    document.body.innerHTML = '<div id="toasts"></div><div id="exroot"></div>'; const rows = { expert_categories: [{ id: 1, name_ar: "هوية" }], experts_profiles: [{ id: "a1", display_name: '<img src=x onerror=window.__pwn=1>', headline: "h", bio: "<script>window.__pwn=2<\/script>", category_id: 1, wilaya: 16, city: "x", whatsapp: "213555", socials: { instagram: "javascript:alert(1)" }, portfolio: [{ t: "img", d: "javascript:alert(1)", title: "t" }], thumb: "", status: "pending", admin_note: "", rating_avg: 0, rating_count: 0, contacts_count: 0 }], expert_reports: [], expert_reviews: [] };
    window.__rpc = [];
    const q = t => { const o = { select: () => o, order: () => o, limit: () => o, eq: () => o, then: (f) => f({ data: rows[t], error: null }) }; return o; };
    window.__sb = { from: q, rpc: async (fn, a) => { window.__rpc.push([fn, a]); return { data: { ok: true, key: "newkey" }, error: null }; } };
    await new Promise(r => { const e = document.createElement("script"); e.src = "../saas/experts-admin.js"; e.onload = r; document.body.appendChild(e); });
    SaasExperts.mount(document.getElementById("exroot"), window.__sb);
  });
  await a.waitForSelector("[data-ex=open]"); ok("المزوّد: يعرض الملف المعلَّق", await a.evaluate(() => /بانتظار المراجعة \(1\)/.test(document.body.textContent)));
  await a.click("[data-ex=open]"); await a.waitForSelector("[data-ex=st]");
  ok("المزوّد: لا تنفيذ لمحتوى المستقل", await a.evaluate(() => !window.__pwn && !document.querySelector("img[src=x]") && document.body.innerHTML.indexOf("javascript:alert") < 0));
  await a.fill("#ex-note", "ناقص"); await a.click('[data-ex=st][data-v="approved"]'); await a.waitForTimeout(300);
  ok("المزوّد: الاعتماد يستدعي الدالة بالمعرّف والملاحظة", await a.evaluate(() => { const c = window.__rpc.find(x => x[0] === "experts_admin_status"); return c && c[1].p.id === "a1" && c[1].p.status === "approved" && c[1].p.note === "ناقص"; }));
  ok("لا أخطاء جافاسكربت (تبويب المزوّد)", aerrs.length === 0, aerrs);
  await browser.close(); srv.close();
  console.log(fails ? `\nفشل ${fails} من ${total}` : `\nنجح ${total}/${total}`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
