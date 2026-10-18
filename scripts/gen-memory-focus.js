/* يحوّل alyssum_memory_focus_editable_layers.json (ChatGPT) إلى صفحة المطوّر الأصلية assets/pages/memory-focus.json
   بالمحوّل PBLayers + PBSpec (نص/صورة/شكل/أيقونة منفصلة قابلة للتحريك)، ويربط الصور بأصول المكتبة، ثم يختبر الحفظ وإعادة الفتح والتصدير إلى HTML.
   تشغيل: python3 scripts/build-admin-pb.py && python3 -m http.server 8765 & ثم
          NODE_PATH=/opt/node-tools/node_modules node scripts/gen-memory-focus.js [layers.json] [out-slug=memory-focus] */
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), src = process.argv[2] || path.join(__dirname, "fixtures/memory-focus-layers.json"), slug = process.argv[3] || "memory-focus";
/* أصول المكتبة الفعلية المرتبطة (الباقي يبقى بوصفه ليُولَّد/يُستبدل) */
const ASSETS = {
  jar_250g: { src: "assets/img/pages/mf-jar.webp" },
  jar_160g: { src: "assets/img/pages/mf-jar.webp" },
  children_studying: { src: "assets/img/pages/mf-kids.webp" },
  alyssum_flower_logo: { src: "assets/img/pages/mf-flower.webp" },
  messenger_icon: { src: "assets/img/icons/mf-messenger.svg" }
};
/* ترتيب طبقات صُحّح يدوياً: صورة الأطفال (قناعها lower-middle لا يُنقل) تحت الفوائد، ولافتة «عرض التوفير» فوق اللوحة الحمراء */
const Z = { "kids-01": 29, "offer-01": 73, "offer-02": 74 };
(async () => {
  const doc = JSON.parse(fs.readFileSync(src, "utf8"));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const r = await p.evaluate(({ doc, ASSETS, slug, Z }) => {
    const v = PBSpec.validate(doc, { fix: false, layerAssets: ASSETS, layerZ: Z });
    if (!v.ok) return { err: v.error };
    const pg = PBSpec.toPage(v, {}); pg.slug = slug; pg.live = false;
    pg.media = Object.keys(ASSETS).map(k => ASSETS[k].src).filter((x, i, a) => x.startsWith("assets/img/pages/") && a.indexOf(x) === i);
    delete pg.pending;
    return { page: pg, warn: v.warn, count: v.count };
  }, { doc, ASSETS, slug, Z });
  if (r.err) { console.error("فشل:", r.err); process.exit(1); }
  fs.writeFileSync(path.join(ROOT, "assets/pages/" + slug + ".json"), JSON.stringify(r.page, null, 1));
  console.log("حُفظت assets/pages/" + slug + ".json", JSON.stringify(r.count)); (r.warn || []).forEach(w => console.log(" ⚠", w));
  if (errs.length) console.log("أخطاء صفحة:", errs); await b.close();
})();
