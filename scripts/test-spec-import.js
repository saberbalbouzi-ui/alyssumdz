/* اختبار «من رابط منتج» في «تصميم بطبقات»: تحليل HTML نقي + تدفق الواجهة (جلب الصفحة والصورة والنموذج مُحاكاة).
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-spec-import.js */
const { chromium } = require("playwright");
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } };
const PAGE = `<!doctype html><html><head><title>x</title>
<meta property="og:title" content="عنوان og"><meta property="og:image" content="/img/og.jpg">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","name":"عسل السدر الملكي","description":"<p>عسل  طبيعي&nbsp;خالص من جبال الأطلس.</p>","image":["/img/main.jpg","https://cdn.x.com/b.jpg"],"offers":{"@type":"Offer","price":"2500","priceCurrency":"DZD"}}]}</script></head>
<body><h1>h1</h1><img src="/img/logo.png"><img src="/img/gallery1.jpg" width="600"><img src="data:image/gif;base64,AAAA"><img data-src="/img/lazy.jpg" class="p"><img src="/img/tiny.jpg" width="40">
<ul><li>خالٍ من السكر المضاف تماماً</li><li>قصير</li></ul></body></html>`;
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const r = await p.evaluate(h => PBSpec.parseProduct(h, "https://shop.example.com/p/honey"), PAGE);
  t("عنوان من JSON-LD", r.title === "عسل السدر الملكي", r.title);
  t("وصف منظَّف من الوسوم", r.desc === "عسل طبيعي خالص من جبال الأطلس.", r.desc);
  t("سعر وعملة", r.price === "2500" && r.currency === "DZD", [r.price, r.currency]);
  t("صور مطلقة بلا تكرار", r.images[0] === "https://shop.example.com/img/main.jpg" && r.images.includes("https://cdn.x.com/b.jpg") && r.images.includes("https://shop.example.com/img/og.jpg"), r.images);
  t("يستبعد الشعار والصغيرة وdata:", !r.images.some(u => /logo|tiny|^data:/.test(u)) && r.images.includes("https://shop.example.com/img/lazy.jpg"), r.images);
  t("نقاط من القوائم", r.bullets.length === 1 && /السكر/.test(r.bullets[0]), r.bullets);
  const og = await p.evaluate(() => PBSpec.parseProduct('<html><head><meta property="og:title" content="T"><meta name="description" content="D"><meta property="product:price:amount" content="1,800 DA"></head><body></body></html>', "http://a.b/"));
  t("احتياط og/meta", og.title === "T" && og.desc === "D" && og.price === "1,800", og);
  t("رابط غير صالح يُرفض", await p.evaluate(async () => { try { await PBSpec.importProduct("foo"); return false; } catch (e) { return /رابطاً/.test(e.message); } }));

  /* الواجهة: جلب ← اختيار صورة ← توليد كامل (النموذج مُحاكى) */
  const res = await p.evaluate(async html => {
    const png = await (await fetch("assets/img/tpl/generic-honey.webp")).blob();
    const of = window.fetch; let prompts = [];
    window.fetch = async (u, o) => { u = String(u); if (/shop\.example\.com\/p\/honey/.test(u)) return new Response(html, { status: 200 }); if (/\.jpg(\?|$)/.test(u) && /example|cdn\.x/.test(u)) return new Response(png, { status: 200, headers: { "content-type": "image/webp" } }); return of(u, o); };
    ImgGen.text = async o => { prompts.push(o.prompt); if (/ألوان|palette/.test(o.prompt) && /"sections":\[\{"name":"hero"/.test(o.prompt) && !/assets":\[/.test("")) { /* خطة */ } return o.prompt.includes("خطة التصميم المعتمدة") || !/"palette"/.test(o.prompt.slice(0, 200)) ? { format: "alyssum-design/1", page: { title: "Honey", width: 1080 }, assets: { product_photo: { prompt: "x" } }, sections: [{ name: "hero", height: 700, bg: "#fff", layers: [{ type: "heading", text: "عسل السدر", x: 60, y: 100, w: 500, font: { size: 56, color: "#222" } }, { type: "image", src: "asset:product_photo", x: 600, y: 100, w: 400, h: 500 }] }] } : { concept: "c", palette: {}, sections: [], assets: [] }; };
    PBSpec.open();
    const g = id => document.querySelector("#pbx-spec #" + id);
    g("sp-url").value = "https://shop.example.com/p/honey"; document.querySelector('#pbx-spec [data-sp="imp"]').click();
    for (let i = 0; i < 60 && !g("sp-impres").querySelector("img"); i++) await new Promise(r => setTimeout(r, 100));
    const out = { imgs: g("sp-impres").querySelectorAll("img").length, desc: g("sp-desc").value, title: g("sp-impres").textContent };
    document.querySelector('#pbx-spec [data-sp="gen"]').click();
    for (let i = 0; i < 80 && !/"layers"/.test(g("sp-json").value); i++) await new Promise(r => setTimeout(r, 100));
    const j = JSON.parse(g("sp-json").value); out.asset = j.assets && j.assets.product_photo && String(j.assets.product_photo.src || "").slice(0, 23); out.hasExtra = prompts.some(x => /product_photo/.test(x) && /مستورد من رابط/.test(x)); out.price = prompts.some(x => /2500/.test(x)); out.blobs = true;
    window.fetch = of; return out;
  }, PAGE);
  t("الواجهة: 4 صور وعنوان", res.imgs >= 3 && /عسل السدر/.test(res.title), res);
  t("الوصف المجلوب يملأ الخانة", /عسل طبيعي/.test(res.desc), res.desc);
  t("صورة المنتج تُحقن data:image", res.asset === "data:image/jpeg;base64,", res.asset);
  t("البرومبت فيه تعليمة المنتج المستورد والسعر", res.hasExtra && res.price, res);
  const up = await p.evaluate(async () => {
    const ob = PBApp.uploadBlob; let n = 0; PBApp.uploadBlob = async () => "assets/img/pages/gen-x" + (++n) + ".webp";
    const d = "data:image/gif;base64,R0lGODlhAQABAAAAACw="; const pg = { sections: [{ free: [{ type: "image", set: { src: d } }, { type: "image", set: { src: d } }, { type: "image", set: { src: "assets/a.webp" } }] }] };
    const k = await PBSpec._t_upload(pg); PBApp.uploadBlob = ob; return { k, n, s: pg.sections[0].free.map(w => w.set.src), m: pg.media };
  });
  t("رفع data: مرة واحدة للصورة المكرّرة", up.n === 1 && up.k === 2 && up.s[0] === up.s[1] && /gen-x1/.test(up.s[0]) && up.s[2] === "assets/a.webp" && up.m && up.m.length === 1, up);
  t("بلا أخطاء صفحة", errs.length === 0, errs);
  console.log(ok + " ✓ / " + bad + " ✗"); await b.close(); process.exit(bad ? 1 : 0);
})();
