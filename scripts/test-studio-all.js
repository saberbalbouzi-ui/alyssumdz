/* استوديو المنتج: عناوين عريضة بأسماء المنتجات + ملصقات إضافية + «تطبيق على كل المنتجات». الخدمة والرفع مُحاكاة.
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-studio-all.js */
const { chromium } = require("playwright"); let n = 0; const fails = []; const ok = (c, m, x) => { if (!c) { console.log("✗ " + m + (x ? " " + JSON.stringify(x) : "")); fails.push(m); } else { n++; console.log("✓ " + m); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => {
    window.confirm = () => true; window.alert = () => { }; const out = {};
    out.titles = PBStudio.TITLES.length >= 5; out.badges = PBStudio.BADGES.length >= 14;
    const cut = document.createElement("canvas"); cut.width = 200; cut.height = 200; const g = cut.getContext("2d"); g.fillStyle = "#c00"; g.fillRect(60, 60, 80, 80);
    const o = Object.assign({}, PBStudio.opts(), { bg: { type: "color", c1: "#ffffff" }, size: [400, 400], scene: null, vars: { name: "عسل", price: "1800 دج" }, ov: [{ t: "{name}", bg: "#0000ff", fg: "#ffffff", st: "title", pos: 2, s: 5 }], logo: null });
    const c = PBStudio.compose(cut, PBStudio.bbox(cut), o), d = c.getContext("2d").getImageData(10, 6, 1, 1).data; out.band = [d[0], d[1], d[2]];      /* عنوان عريض أزرق أعلى الصورة بعرضها كله */
    const d2 = c.getContext("2d").getImageData(390, 6, 1, 1).data; out.bandW = d2[2] > 200 && d2[0] < 60;
    /* تطبيق على كل المنتجات */
    const saved = []; Admin.products = [{ slug: "a1", title: "منتج 1", price: 100, cover: "assets/img/tpl/generic-honey.webp" }, { slug: "a2", title: "منتج 2", price: 200, cover: "assets/img/tpl/generic-cream.webp" }];
    Admin.uploadImageFile = async (f, dir) => { saved.push(dir); return dir + "/cover-x.webp"; }; Admin.publishDataJs = async () => true; Admin.renderProducts = () => { };
    PBBgRemove.autoCut = async s => ({ canvas: s }); const steps = [];
    await AdminImgQA.applyAll({ onStep: m => steps.push(m) });
    out.saved = saved.slice(); out.covers = Admin.products.map(q => q.cover); out.kept = Admin.products.every(q => (q.images || []).length === 1); out.last = steps[steps.length - 1];
    /* اختيار منتجات محدّدة فقط */
    saved.length = 0; Admin.products.forEach(q => { q.cover = "assets/img/tpl/generic-honey.webp"; q.images = []; }); const st2 = []; await AdminImgQA.applyAll({ slugs: ["a2"], onStep: m => st2.push(m) }); out.only = saved.slice(); out.last2 = st2[st2.length - 1];
    /* الواجهة */
    await PBApp.toolSession([await new Promise(z => cut.toBlob(z, "image/png"))], "st", "t"); await new Promise(z => setTimeout(z, 500)); const tb = document.querySelector('[data-stsub="txt"]'); out.hasTab = !!tb; if (tb) tb.click();
    await new Promise(z => setTimeout(z, 600)); out.ui = { hasTab: out.hasTab, ept: PBApp.E.ept, sc: PBApp.E.stScene, tabs: [...document.querySelectorAll("[data-imgs]")].length, all: !!document.querySelector('[data-st="applyall"]') };
    out.noList = !document.querySelector("[data-allp]") && !document.querySelector('[data-st="allsel"]');
    return out;
  }).catch(e => ({ err: String(e && e.stack || e) }));
  console.log(JSON.stringify(r));
  ok(!r.err, "لا أخطاء تنفيذ", r.err); if (r.err) { await b.close(); process.exit(1); }
  ok(r.titles && r.badges, "ملصقات وعناوين جاهزة أكثر", r);
  ok(r.bandW && r.band[2] > 200, "العنوان العريض يغطي عرض الصورة بلون الخلفية المختار", r.band);
  ok(r.saved.length === 2 && r.covers.every(c => /cover-x/.test(c)) && r.kept, "التطبيق على كل المنتجات: كل غلاف استُبدل والقديم محفوظ ضمن الصور", r);
  ok(/طُبّق النمط على 2/.test(r.last || ""), "ملخص النتيجة", r.last);
  ok(r.only && r.only.length === 1 && r.only[0] === "assets/img/a2" && /على 1 /.test(r.last2), "اختيار منتجات محدّدة: يُطبَّق على المختار فقط", [r.only, r.last2]);
  ok(r.ui && r.ui.all && r.noList, "زر التطبيق على المنتجات بلا قائمة اختيار", [r.ui]);
  ok(!errs.length, "لا أخطاء صفحة", errs); console.log(fails.length ? "\n✗ " + fails.length + " فشل" : "\n✓ " + n + " فحصاً ناجحاً"); await b.close(); process.exit(fails.length ? 1 : 0);
})();
