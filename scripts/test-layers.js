/* اختبار محوّل alyssum-design-layers ← صيغة المطوّر: تحويل نقي (Node) + لصق في PBSpec بمتصفح حقيقي + حفظ/إعادة فتح/تصدير HTML.
   تشغيل: python3 scripts/build-admin-pb.py && python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-layers.js */
const fs = require("fs"), path = require("path"), assert = require("assert"); const { chromium } = require("playwright");
const ROOT = path.join(__dirname, ".."), doc = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/memory-focus-layers.json"), "utf8"));
const PBLayers = require("./pagebuilder-layers.js"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const spec = PBLayers.convert(doc, { assets: { jar_250g: { src: "assets/img/pages/mf-jar.webp" } }, z: { "kids-01": 29 } });
ok(PBLayers.is(doc) && !PBLayers.is({}), "كشف الصيغة");
ok(spec.format === "alyssum-design/1" && spec.page.width === 928 && spec.sections[0].height === 1600, "الأبعاد");
ok(spec.sections[0].layers.length === 49, "49 طبقة");
const by = id => spec.sections[0].layers.find(l => l.id === id);
ok(by("title-03").type === "heading" && by("title-03").tag === "h1", "عنوان رئيسي");
ok(by("brand-02").font.family === "Playfair Display", "خط بديل متاح");
ok(by("benefit-05").icon === "award", "أيقونة بديلة");
ok(by("gift-01").hidden === true, "الشريط المرفوض مخفي");
ok(by("kids-01").z === 29, "تجاوز الترتيب");
ok(by("products-01").src === "asset:jar_250g" && spec.assets.jar_250g.src === "assets/img/pages/mf-jar.webp", "ربط أصل فعلي");
ok(!spec.assets.bg_garden.src && /garden/i.test(spec.assets.bg_garden.prompt), "أصل بلا ملف يحمل وصفه");
ok(by("benefit-02").group === "benefit1" && by("benefit-12").group === "benefit4" && by("offer-02").group === "offerhead", "المجموعات");
ok(spec.notes.length > 5, "ملاحظات الاستيراد");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const r = await p.evaluate(async raw => {
    const v = PBSpec.validate(JSON.stringify(raw), { fix: false }); if (!v.ok) return { err: v.error };     // لصق النص كما في نافذة «تصميم بطبقات»
    const pg = PBSpec.toPage(v, {}); const sec = pg.sections[0], types = {}; sec.free.forEach(w => types[w.type] = (types[w.type] || 0) + 1);
    const back = PB.migrate(JSON.parse(JSON.stringify(pg))); back.demo = false;     // حفظ ← إعادة فتح
    const html = PB.fullHtml(back, Object.assign({ base: "../../" }, PBApp.siteCtx()));
    const texts = raw.layers.filter(l => l.type === "text").map(l => l.text.split("\n")[0]);
    return { types, free: back.sections[0].free.length, moved: back.sections[0].free.every(w => w.set.fx && w.set.fy), htmlHas: texts.filter(t => html.includes(t.replace(/&/g, "&amp;"))).length, texts: texts.length, mh: back.sections[0].set.mh.d };
  }, doc);
  ok(!r.err, "تحقق PBSpec: " + r.err); ok(r.free === 49 && r.types.iconbox === 5 && r.types.shape === 13, "عناصر حرة مستقلة " + JSON.stringify(r.types)); ok(r.moved, "كل عنصر حر بمواضع fx/fy");
  ok(r.htmlHas === r.texts, "كل النصوص في HTML المصدَّر " + r.htmlHas + "/" + r.texts); ok(r.mh === 1600, "ارتفاع الصفحة");
  ok(errs.length === 0, "لا أخطاء صفحة: " + errs.join("|")); await b.close(); console.log("كل الفحوص نجحت (" + n + ")");
})().catch(e => { console.error("فشل:", e.message); process.exit(1); });
