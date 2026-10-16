/* اختبار «تقييم صفحة المنتج» (PageRater): دوال نقية + واجهة بمحاكاة المنتجات والجلب — NODE_PATH=/opt/node-tools/node_modules node scripts/test-pagerater.js */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
let total = 0, fails = 0; const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } else console.log("✓", n); };
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.route("https://t.test/**", r => r.fulfill({ contentType: "text/html", body: "<!doctype html><html><body><div id=tab-imgtools></div></body></html>" }));
  await p.goto("https://t.test/");
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "../assets/js/admin-pagerater.js"), "utf8") });
  const T = fn => p.evaluate(fn);
  const good = await T(() => PageRater.score({ title: "كريمة نباتية للوجه بزيت شجرة الشاي 50 مل", desc: "تحتوي على زيت شجرة الشاي والإكليل. حجم العبوة 50 مل. طريقة الاستعمال: ضعي كمية صغيرة مرتين يومياً. تساعد على تحسين مظهر البشرة. احفظيها في مكان بارد. ".repeat(4), images: [1, 2, 3, 4, 5, 6].map(i => ({ url: "u" + i })), video: true, own: false }, [1, 2, 3, 4].map(() => ({ w: 1400, h: 1400 })), null));
  ok("صفحة جيدة: تنوّع وجودة ومعلومات ≥ 8", good.cats.find(c => c.id === "variety").score >= 8 && good.cats.find(c => c.id === "quality").score >= 8 && good.cats.find(c => c.id === "info").score >= 8, good.cats.map(c => [c.id, c.score]));
  ok("اتساق العلامة لصفحة خارجية: غير متاح (na)", good.cats.find(c => c.id === "brand").na === true);
  ok("الإجمالي يتجاهل الفئة غير المتاحة", good.total >= 80 && good.first === null, [good.total, good.first]);
  const bad = await T(() => PageRater.score({ title: "منتج", desc: "جديد", images: [{ url: "a" }], video: false, own: false }, [{ w: 400, h: 300 }], null));
  ok("صفحة ضعيفة: كل فئة < 5", bad.cats.filter(c => c.score != null).every(c => c.score < 5), bad.cats.map(c => [c.id, c.score]));
  ok("الضعيفة: يُقترح أول إصلاح والأداة المناسبة", bad.first && bad.cats.find(c => c.id === "variety").fix.tool === "pshoot" && bad.cats.find(c => c.id === "quality").fix.tool === "up", [bad.first]);
  ok("المعلومات الناقصة: يذكر ما ينقص أولاً", /ينقص أولاً/.test(bad.cats.find(c => c.id === "info").findings.join(" ")));
  ok("بلا فيديو وبصور كافية: يقترح مولّد الفيديو", await T(() => { const r = PageRater.score({ title: "عنوان طويل بما يكفي للمنتج الجيد", desc: "مكونات قطن. مقاس 50 سم. استعمال يومي. العناية بالغسل البارد وهو مفيد جداً ".repeat(3), images: [1, 2, 3, 4, 5].map(i => ({ url: "u" + i })), video: false, own: false }, [1, 2, 3].map(() => ({ w: 1200, h: 1200 })), null); return r.cats.find(c => c.id === "variety").fix && r.cats.find(c => c.id === "variety").fix.tool === "vgen"; }));
  ok("قياس الأبعاد تعذّر: جودة جزئية بلا حكم", await T(() => { const r = PageRater.score({ title: "x", desc: "", images: [{ url: "a" }, { url: "b" }], video: false, own: false }, [null, null], null); const q = r.cats.find(c => c.id === "quality"); return q.partial && /تعذّر/.test(q.findings[0]); }));
  /* اتساق العلامة لمنتجات المتجر */
  ok("اتساق: غلاف شفاف بين أغلفة شفافة = جيد", await T(() => { const r = PageRater.score({ title: "x", desc: "", images: [{ url: "a" }], own: true }, [{ w: 1000, h: 1000 }], { mine: { l: .5, transparent: true }, others: [{ l: .5, transparent: true }, { l: .52, transparent: true }, { l: .48, transparent: true }] }); return r.cats.find(c => c.id === "brand").score >= 8; }));
  ok("اتساق: غلاف بخلفية داكنة بين أغلفة فاتحة = ضعيف ومعه حلّ الكتالوج", await T(() => { const r = PageRater.score({ title: "x", desc: "", images: [{ url: "a" }], own: true }, [{ w: 1000, h: 1000 }], { mine: { l: .1, transparent: false }, others: [{ l: .95, transparent: false }, { l: .9, transparent: false }, { l: .92, transparent: false }] }); const k = r.cats.find(c => c.id === "brand"); return k.score <= 5 && k.fix && k.fix.tool === "catalog"; }));
  /* تحليل HTML خارجي */
  const h = await T(() => { const pg = PageRater.fromHtml('<html><head><title>T</title><meta property="og:image" content="/og.jpg"><meta name="description" content="وصف قصير"></head><body><h1> حقيبة جلد  فاخرة </h1><img src="/a.jpg" width="500"><img src="/logo.png"><img src="data:image/gif;base64,AAA"><img data-src="/b.webp"><img src="/tiny.jpg" width="20"><img srcset="/c-1.jpg 1x, /c-2.jpg 2x"><video src="x.mp4"></video><script>var a="/s.jpg"</script><p>حقيبة مصنوعة من الجلد مقاس 30 سم</p></body></html>', "https://shop.test/products/bag"); return { title: pg.title, urls: pg.images.map(i => i.url), video: pg.video, has: /الجلد/.test(pg.desc) }; });
  ok("fromHtml: العنوان من h1 منظّفاً", h.title === "حقيبة جلد فاخرة", h.title);
  ok("fromHtml: يستبعد الشعار والصور الصغيرة وdata ويقرأ og وlazy وsrcset", JSON.stringify(h.urls.sort()) === JSON.stringify(["https://shop.test/a.jpg", "https://shop.test/b.webp", "https://shop.test/c-2.jpg", "https://shop.test/og.jpg"]), h.urls);
  ok("fromHtml: كشف الفيديو ونص الصفحة بلا سكربت", h.video && h.has);
  /* واجهة: منتج من المتجر بصور data URI حقيقية */
  const ui = await T(async () => {
    const mk = (c, a) => { const cv = document.createElement("canvas"); cv.width = 900; cv.height = 900; const g = cv.getContext("2d"); if (c) { g.fillStyle = c; g.fillRect(0, 0, 900, 900); } return cv.toDataURL("image/png"); };
    const light = mk("#f3f3f3"), dark = mk("#101010");
    window.Admin = { products: [{ slug: "a", title: "منتج أ", cover: dark, images: [light, light], desc: "وصف قصير", active: true }, { slug: "b", title: "منتج ب", cover: light, images: [light], desc: "x", active: true }, { slug: "c", title: "منتج ج", cover: light, images: [], active: true }, { slug: "d", title: "منتج د", cover: light, images: [], active: true }], tab: () => { }, editProduct: s => { window.__ed = s; } };
    window.AdminNav = { deepTool: t => { window.__tool = t; } };
    PageRater.S.slug = "a"; PageRater.draw(); document.getElementById("pr-go").click();
    for (let i = 0; i < 60 && !document.querySelector("#pr-card [data-cat]"); i++) await new Promise(r => setTimeout(r, 200));
    const cats = [...document.querySelectorAll("#pr-card [data-cat]")].map(d => d.dataset.cat), fixes = [...document.querySelectorAll("#pr-card [data-fix]")].map(b => b.dataset.fix);
    const brand = document.querySelector('[data-cat="brand"]').textContent;
    const fx = document.querySelector('[data-fix="catalog"]'); const seo = document.querySelector('[data-fix="seo"]'); if (seo) seo.click();
    const qf = document.querySelector('[data-fix="pshoot"]'); if (qf) qf.click();
    return { cats, fixes, brand, ed: window.__ed, tool: window.__tool, total: /\/100/.test(document.getElementById("pr-card").textContent) };
  });
  ok("الواجهة: الفئات الأربع وإجمالي /100", ui.cats.join() === "variety,quality,info,brand" && ui.total, ui);
  ok("الواجهة: غلاف داكن بين أغلفة فاتحة ← حلّ الكتالوج", ui.fixes.includes("catalog") && /داكن|سطوع|ملوّنة|شفافة/.test(ui.brand), ui.brand);
  ok("الواجهة: زر الإصلاح يفتح تعديل المنتج للـSEO وأداة التصوير", ui.ed === "a" && ui.tool === "pshoot", [ui.ed, ui.tool]);
  ok("رابط غير صالح يرفض", await T(async () => { try { await PageRater.rateUrl("http://"); return false; } catch (e) { return /غير صالح|الرابط/.test(e.message); } }));
  ok("بلا أخطاء JS", errs.length === 0, errs);
  console.log(fails ? "فشل " + fails + " من " + total : "نجح " + total + " من " + total);
  await b.close(); process.exit(fails ? 1 : 0);
})();
