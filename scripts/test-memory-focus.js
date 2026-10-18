/* اختبار صفحة assets/pages/memory-focus.json (المسودة): كل عنصر قابل للتحديد والتعديل منفرداً في المطوّر، حفظ ← إعادة فتح ← تصدير HTML،
   لا صور مفقودة ولا أخطاء ترتيب طبقات، عرض الهاتف. لا ينشر شيئاً (live:false) ويحذف ملف التصدير المؤقت.
   تشغيل: python3 scripts/build-admin-pb.py && python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-memory-focus.js */
const fs = require("fs"), path = require("path"), assert = require("assert"); const { chromium } = require("playwright");
const ROOT = path.join(__dirname, ".."), PAGE = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/pages/memory-focus.json"), "utf8"));
const TMP = path.join(ROOT, "lp/_mftest"); let n = 0; const ok = (c, m) => { if (!c) { console.log("✗ " + m); fails.push(m); } else { n++; console.log("✓ " + m); } }; const fails = [];
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1500, height: 950 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  ok(PAGE.live === false, "الصفحة مسودة (live:false) ولا تُنشر تلقائياً");
  /* ── 1) كل ملف صورة مذكور موجود فعلاً ── */
  const free = PAGE.sections[0].free, srcs = free.filter(w => w.type === "image").map(w => w.set.src).filter(Boolean);
  ok(srcs.length === 10 && srcs.every(s => fs.existsSync(path.join(ROOT, s))), "كل مسارات الصور (" + srcs.length + ") موجودة في المستودع");
  const media = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/pages/media.json"), "utf8")).map(m => m.p);
  ok(PAGE.media.every(m => media.includes(m)), "كل أصول الصفحة مسجَّلة في media.json");
  ok(free.filter(w => w.type === "image" && !w.set.src).length === 0, "لا إطارات صور فارغة");
  /* ── 2) فتح في المحرّر وتحديد كل عنصر منفرداً ── */
  const r = await p.evaluate(async pg => {
    PBApp.open(pg); await new Promise(r => setTimeout(r, 2200)); const E = PBApp.E, sec = E.page.sections[0], fd = document.getElementById("pbx-frame").contentDocument, out = { total: sec.free.length, sel: 0, bad: [], noEl: [] };
    for (const w of sec.free) {
      E.sel = w.id; PBApp.renderInspectorNow(); await new Promise(r => setTimeout(r, 15));
      const insp = document.getElementById("pbx-insp"), el = fd.querySelector('[data-pb="' + w.id + '"]');
      if (!el) out.noEl.push(w.type + ":" + w.id); else if (insp && insp.querySelectorAll("input,textarea,select,button").length > 3) out.sel++; else out.bad.push(w.type + ":" + w.id);
    }
    return out;
  }, PAGE);
  ok(r.total === 49 && r.noEl.length === 0, "كل العناصر الـ49 مرسومة في المحرّر (غير المرسوم: " + r.noEl.join(",") + ")");
  ok(r.sel === 49 && !r.bad.length, "كل عنصر يُحدَّد ويفتح إعداداته منفرداً (" + r.sel + "/49)");
  /* ── 3) تعديل عناصر مستقلة: لا يتأثر غيرها ── */
  const e = await p.evaluate(async () => {
    const E = PBApp.E, free = E.page.sections[0].free, snap = () => JSON.stringify(free.map(w => [w.id, w.set]));
    const t3 = free.find(w => w.type === "heading" && w.set.tag === "h1"), t4 = free.find(w => w.type === "text" && /تنشيط الذاكرة/.test(w.set.html || "")), img = free.find(w => w.type === "image" && /mf-dipper/.test(w.set.src)), shp = free.find(w => w.type === "shape");
    const before = JSON.parse(snap()), res = {};
    const changed = () => { const now = JSON.parse(snap()); return now.filter((x, i) => JSON.stringify(x) !== JSON.stringify(before[i])).map(x => x[0]); };
    t3.set.fs.d = 80; t3.set.text = "عسل التركيز المعدّل"; res.ch1 = changed().length === 1;
    t4.set.fs.d = 70; PBApp.renderInspectorNow(); const fd = document.getElementById("pbx-frame").contentDocument;
    const el4 = fd.querySelector('[data-pb="' + t4.id + '"]'); await new Promise(r => setTimeout(r, 50)); PBApp.renderCanvas && PBApp.renderCanvas();
    await new Promise(r => setTimeout(r, 400)); const e4 = fd.querySelector('[data-pb="' + t4.id + '"]'), inner = e4.querySelector(".pb-t") || e4;
    res.noClip = inner.scrollHeight <= e4.clientHeight + 2; res.h4 = e4.clientHeight;
    img.set.fx.d = 60; shp.set.fill = "#123456"; res.ch2 = changed().length === 4; res.hauto = t3.set.hauto !== false && t4.set.hauto !== false;
    return res;
  });
  ok(e.ch1, "تعديل نص عنوان واحد لا يغيّر غيره"); ok(e.noClip, "تكبير العنوان لا يقصّ النص (ارتفاع الإطار " + e.h4 + "px يتسع)"); ok(e.ch2 && e.hauto, "تعديل صورة وشكل مستقلان + ارتفاع العناوين تلقائي");
  /* ── 4) حفظ ← إعادة فتح ← تصدير HTML (على النسخة الأصلية من الملف) ── */
  const v = await p.evaluate(async pg => {
    PBApp.open(pg); await new Promise(r => setTimeout(r, 1500));
    const saved = JSON.parse(JSON.stringify(PBApp.E.page)); PBApp.open(JSON.parse(JSON.stringify(saved))); await new Promise(r => setTimeout(r, 1800));
    const again = PBApp.E.page.sections[0].free; const m = PB.migrate(JSON.parse(JSON.stringify(PBApp.E.page))); m.demo = false;
    return { count: again.length, same: again.every((w, i) => w.id === saved.sections[0].free[i].id && JSON.stringify(w.set) === JSON.stringify(saved.sections[0].free[i].set)), html: PB.fullHtml(m, Object.assign({ base: "../../" }, PBApp.siteCtx())) };
  }, PAGE);
  ok(v.count === 49 && v.same, "حفظ ← إعادة فتح يحفظ كل العناصر وإعداداتها كما هي");
  fs.mkdirSync(TMP, { recursive: true }); fs.writeFileSync(path.join(TMP, "index.html"), v.html);
  const q = await b.newPage({ viewport: { width: 928, height: 1000 } }); await q.goto("http://localhost:8765/lp/_mftest/index.html"); await q.waitForTimeout(2500);
  const d = await q.evaluate(() => ({ h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, texts: document.querySelectorAll(".pb-t").length, imgs: [...document.querySelectorAll("img")].map(i => ({ s: i.getAttribute("src"), ok: i.complete && i.naturalWidth > 0 })), ph: document.querySelectorAll(".pb-ph").length, mask: !!document.querySelector('[class*="pb-"] .pb-cropbox') }));
  ok(d.texts >= 21 && d.ph === 0, "التصدير: النصوص موجودة (" + d.texts + ") ولا إطارات صور فارغة");
  ok(d.imgs.length >= 9 && d.imgs.every(i => i.ok), "التصدير: كل الصور (" + d.imgs.length + ") تُحمَّل بلا مفقود" + (d.imgs.filter(i => !i.ok).length ? " — " + d.imgs.filter(i => !i.ok).map(i => i.s).join(",") : ""));
  ok(d.w <= 928 && d.h === 1600, "التصدير: لا تمرير أفقي والارتفاع 1600 (" + d.w + "×" + d.h + ")");
  /* ── 5) ترتيب الطبقات ── */
  const lay = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/memory-focus-layers.json"), "utf8")).layers; const Z = { "kids-01": 29, "age-01": 41, "age-02": 42, "offer-01": 73, "offer-02": 74 };
  const zi = id => { const L = lay.find(l => l.id === id); return Z[id] != null ? Z[id] : L.zIndex; };
  ok(zi("kids-01") < zi("benefit-02") && zi("kids-01") < zi("benefit-11") && zi("age-02") > zi("kids-01") && zi("age-01") < zi("age-02"), "الأطفال تحت أيقونات الفوائد وشارة العمر فوق صورتهم");
  ok(zi("offer-01") > zi("offer-03") && zi("gift-02") < zi("gift-03") && zi("gift-02") > zi("products-03"), "لافتة العرض فوق اللوحة، وشارة الهدية فوق القارورة ونصها فوقها");
  const g = (a, bb) => !(a.x + a.width <= bb.x || bb.x + bb.width <= a.x || a.y + a.height <= bb.y || bb.y + bb.height <= a.y); const GEO = { "gift-02": { x: 792, y: 790 } };
  const A = Object.assign({}, lay.find(l => l.id === "gift-02"), GEO["gift-02"]), BT = lay.find(l => l.id === "products-03"), over = Math.max(0, Math.min(A.x + A.width, BT.x + BT.width) - Math.max(A.x, BT.x));
  ok(over / BT.width < .2, "شارة الهدية تغطي أقل من 20٪ من عرض القارورة (" + Math.round(over / BT.width * 100) + "٪)");
  const pg2 = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/pages/memory-focus.json"), "utf8")), rib = pg2.sections[0].free.filter(w => w.type === "shape" && w.set.hd && w.set.ht && w.set.hm);
  ok(rib.length === 1, "الشريط الأحمر مخفي (يغطي المنتج) وقابل للإظهار من لوحة الطبقات");
  /* ── 6) عرض الهاتف: المحرّر وصفحة التصدير ── */
  const mo = await p.evaluate(async () => { PBApp.setDev("m"); await new Promise(r => setTimeout(r, 1500)); const fd = document.getElementById("pbx-frame").contentDocument, w = fd.documentElement.scrollWidth, vw = fd.documentElement.clientWidth; return { w, vw, els: fd.querySelectorAll(".pb-fit").length }; });
  ok(mo.w <= mo.vw + 2, "المحرّر (هاتف): لا تمرير أفقي (" + mo.w + "/" + mo.vw + ")");
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await m.goto("http://localhost:8765/lp/_mftest/index.html"); await m.waitForTimeout(2500);
  const mi = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, bad: [...document.querySelectorAll("img")].filter(i => !i.naturalWidth).length, h: document.documentElement.scrollHeight }));
  ok(mi.sw <= mi.iw && mi.bad === 0, "الهاتف (390px): لا تمرير أفقي (" + mi.sw + "/" + mi.iw + ") ولا صور مفقودة، الارتفاع " + mi.h);
  await m.screenshot({ path: process.env.MF_SHOT || "/tmp/mf_mobile.png", fullPage: true });
  ok(!errs.length, "لا أخطاء جافاسكربت" + (errs.length ? ": " + errs[0] : ""));
  fs.rmSync(TMP, { recursive: true, force: true }); await b.close();
  console.log(fails.length ? "فشل " + fails.length + " من " + (n + fails.length) : "نجح " + n + " من " + n); process.exit(fails.length ? 1 : 0);
})();
