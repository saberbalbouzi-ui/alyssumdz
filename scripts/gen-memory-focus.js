/* يحوّل alyssum_memory_focus_editable_layers.json (ChatGPT) إلى صفحة المطوّر الأصلية assets/pages/memory-focus.json
   بالمحوّل PBLayers + PBSpec (نص/صورة/شكل/أيقونة منفصلة قابلة للتحريك)، ويربط الصور بأصول المكتبة، ثم يختبر الحفظ وإعادة الفتح والتصدير إلى HTML.
   تشغيل: python3 scripts/build-admin-pb.py && python3 -m http.server 8765 & ثم
          NODE_PATH=/opt/node-tools/node_modules node scripts/gen-memory-focus.js [layers.json] [out-slug=memory-focus] */
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), src = process.argv[2] || path.join(__dirname, "fixtures/memory-focus-layers.json"), slug = process.argv[3] || "memory-focus";
/* أصول المكتبة الفعلية المرتبطة (الباقي يبقى بوصفه ليُولَّد/يُستبدل).
   mf-garden/dipper/honeycomb مشتقة من صور المكتبة الموجودة (قص/تمويه/غسل بلون الصفحة بلا ذكاء اصطناعي)؛
   mf-jar-250g وmf-bottle-160g صورتا المنتج الحقيقيتان (ALYSSUM MEMORY FOCUS(2).png / مشروب-التركيز(1).png) بعد قصّ الهوامش الشفافة فقط (دون مساس بألوانهما أو ملصقهما) */
const ASSETS = {
  bg_garden: { src: "assets/img/pages/mf-garden.webp" },
  jar_250g: { src: "assets/img/pages/mf-jar-250g.webp" },
  jar_160g: { src: "assets/img/pages/mf-bottle-160g.webp" },
  children_studying: { src: "assets/img/pages/mf-kids.webp" },
  alyssum_flower_logo: { src: "assets/img/pages/mf-flower.webp" },
  honey_dipper: { src: "assets/img/pages/mf-dipper.webp" },
  honeycomb: { src: "assets/img/pages/mf-honeycomb.webp" },
  messenger_icon: { src: "assets/img/icons/mf-messenger.svg" }
};
/* ترتيب طبقات صُحّح يدوياً: صورة الأطفال تحت الفوائد، ولافتة «عرض التوفير» فوق اللوحة الحمراء */
const Z = { "kids-01": 29, "age-01": 41, "age-02": 42, "offer-01": 73, "offer-02": 74, "honey-02": 48 };
/* مواضع صُحّحت: الملعقة والشمع بنسبة صورتيهما الفعليتين، وشارة الهدية لا تغطي القارورة */
const GEO = { "honey-01": { x: 690, y: 0, w: 238, h: 202 }, "honey-02": { x: 0, y: 950, w: 150, h: 211 },
  /* صف العبوات: جرتا 250 غ (نسبة الصورة المقصوصة .776) وقارورة 160 غ بجانبهما بقاعدة واحدة عند y≈1161؛ شارة الهدية تغطي أقل من 10٪ من عرض القارورة */
  "products-01": { x: 80, y: 800, w: 280, h: 361 }, "products-02": { x: 365, y: 800, w: 280, h: 361 }, "products-03": { x: 665, y: 770, w: 148, h: 391 },
  "gift-02": { x: 802, y: 800 }, "gift-03": { x: 815, y: 819 } };
/* أحجام العناوين الثلاثة (أقصى ما يتسع عرضاً وارتفاعاً دون قصّ، وبارتفاع تلقائي فتبقى قابلة للتعديل) */
const FS = { "title-01": 45, "title-03": 63, "title-04": 59 };
/* تلاشي حواف صورة الأطفال (بديل «قناع lower-middle»: أعلى 12٪ وأسفل 22٪؛ تأثير قابل للتعديل من لوحة التأثيرات) */
/* قصّ صورة الأطفال (إطار المحرّر): يُظهر الوجهين والكتف ويُخفي الجرّة المطبوعة داخل الصورة نفسها (تتعارض مع صفّ العبوات) */
const CROP = { "kids-01": { x: 0, y: -30, w: 100, h: 254 } };
const FADE = { "kids-01": { t: 12, b: 22 } };
/* بيانات المنتج الحقيقية (assets/js/data.js) — منها السعر والعرض؛ النصوص الثابتة في التصميم لا تُستعمل */
const PROD_SLUG = "tarkiz";
const PROD = (() => { const sb = {}; require("vm").runInNewContext(fs.readFileSync(path.join(ROOT, "assets/js/data.js"), "utf8") + ";this.PRODUCTS=PRODUCTS", sb); return sb.PRODUCTS.find(x => x.slug === PROD_SLUG); })();
if (!PROD) throw new Error("المنتج " + PROD_SLUG + " غير موجود في data.js");
/* رابط Messenger الافتراضي: عام وقابل للاستبدال من خصائص عنصر «منطقة ضغط Messenger» في المحرر (لا حساب ثابت) */
const MSGR_LINK = "https://m.me/";
(async () => {
  const doc = JSON.parse(fs.readFileSync(src, "utf8"));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const r = await p.evaluate(({ doc, ASSETS, slug, Z, GEO, FS, FADE, CROP, PROD, PROD_SLUG, MSGR_LINK }) => {
    const v = PBSpec.validate(doc, { fix: false, layerAssets: ASSETS, layerZ: Z, layerGeo: GEO, layerFs: FS, layerFade: FADE, layerCrop: CROP });
    if (!v.ok) return { err: v.error };
    const pg = PBSpec.toPage(v, {}); pg.slug = slug; pg.live = false;
    pg.product = PROD_SLUG;
    const free = pg.sections[0].free, txt = w => String(w.set.html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), byHtml = t => free.find(w => w.type === "text" && txt(w) === t), POS = ["fx", "fy", "fwd", "fh", "zi", "grp", "cls", "hd", "ht", "hm"], keep = (o, n) => { POS.forEach(k => { if (o.set[k] != null) n.set[k] = o.set[k]; }); return n; }, swap = (o, n) => { free[free.indexOf(o)] = n; };
    /* السعر الفردي: عنصر «سعر المنتج» المرتبط (يتحدّث من بيانات المنتج وقت التحميل) بدل نص ثابت */
    const single = byHtml("1800 دج"); if (!single) return { err: "عنصر السعر الفردي غير موجود" };
    const pp = keep(single, PB.mkW("pprice", { psrc: "", prod: PROD_SLUG, shold: false, shsave: false, pc: single.set.color, fs: single.set.fs, pjc: "center", pgp: 0 }));
    swap(single, pp);
    /* سعر العرض (القارورة الهدية): عنصر HTML يقرأ العرض ذا الهدية من بيانات المنتج وقت التحميل (النص الابتدائي منها أيضاً) */
    const offer = byHtml("3200 دج"); if (!offer) return { err: "عنصر سعر العرض غير موجود" };
    const offO = (PROD.offers || []).filter(o => o.free > 0)[0]; if (!offO) return { err: "لا عرض بهدية في بيانات المنتج" };
    const fmt = n => Number(n || 0).toLocaleString("fr-DZ") + " دج";
    const code = '<div class="mf-offer" style="font-weight:900;line-height:1.15;text-align:center;color:' + offer.set.color + ';font-size:calc(var(--u,1px)*' + offer.set.fs.d + ')"><span id="mf-offer-price" data-slug="' + PROD_SLUG + '">' + fmt(offO.price) + '</span></div>'
      + '<script>(function(){function go(){var P=window.PRODUCTS;if(!P){if(window.__mfd)return;window.__mfd=1;var s=document.createElement("script");s.src="/assets/js/data.js";s.onload=go;document.head.appendChild(s);return}var p=P.filter(function(x){return x.slug==="' + PROD_SLUG + '"})[0];if(!p)return;var f=function(n){return Number(n).toLocaleString("fr-DZ")+" دج"},a=document.getElementById("pprice"),e=document.getElementById("mf-offer-price"),o=(p.offers||[]).filter(function(x){return x.free>0})[0];if(a)a.textContent=f(p.price);if(e&&o)e.textContent=f(o.price)}document.readyState==="complete"?go():addEventListener("load",go)})()<\/script>';
    swap(offer, keep(offer, PB.mkW("html", { code })));
    /* نصوص صغيرة جداً على الهاتف (الصفحة ملصق 928px يُصغَّر ≈0.42): رُفعت أحجامها قليلاً لتبقى مقروءة دون تغيير التخطيط */
    [["راسلنا الآن على", 27], ["قارورة واحدة", 24], ["التوصيل متوفر", 22]].forEach(([k, n]) => free.filter(w => w.type === "text" && txt(w).indexOf(k) === 0).forEach(w => { w.set.fs = { d: n }; }));
    /* Messenger: منطقة ضغط واحدة تغطي الأيقونة والنص (زر شفاف بكامل مساحتهما) — الرابط الافتراضي قابل للاستبدال من خصائص العنصر */
    const mi = free.find(w => w.type === "image" && /mf-messenger/.test(w.set.src)), mt = free.find(w => w.type === "text" && /Messenger/.test(txt(w)) && /راسلنا/.test(txt(w)));
    if (!mi || !mt) return { err: "عناصر Messenger غير موجودة" };
    const x0 = Math.min(mi.set.fx.d, mt.set.fx.d) - 1.2, x1 = Math.max(mi.set.fx.d + mi.set.fwd.d, mt.set.fx.d + mt.set.fwd.d) + 1.2, y0 = Math.min(mi.set.fy.d, mt.set.fy.d) - 10, y1 = Math.max(mi.set.fy.d + mi.set.fh.d, mt.set.fy.d + mt.set.fh.d) + 14;
    const btn = PB.mkW("button", { text: "", kind: "link", link: MSGR_LINK, newTab: true, bgHide: true, bdw: 0, bpad: { d: [0, 0, 0, 0] }, full: true, brad: { d: 14 }, hbg: "transparent", fx: { d: Math.round(x0 * 10) / 10 }, fy: { d: Math.round(y0) }, fwd: { d: Math.round((x1 - x0) * 10) / 10 }, fh: { d: Math.round(y1 - y0) }, zi: (mt.set.zi || 87) + 3, grp: mi.set.grp, cls: "", hauto: false, fxs: [{ id: PB.uid(), n: "منطقة الضغط تملأ العنصر", on: true, tpl: "selector .pb-btn{display:block;width:100%;height:100%;min-height:44px;padding:0!important;border-radius:14px}", p: {} }] });
    btn.set.alt = "فتح محادثة Messenger"; free.push(btn);
    /* قسم الطلب: مكوّن «نموذج الطلب الأصلي» الموجود في المنصة (iframe لنموذج المنتج الحقيقي: عروض، ولاية، بلدية، توصيل، كوبون) */
    const cols = [PB.mkW("heading", { text: "اطلب الآن", tag: "h2", fs: { d: 38, m: 28 }, fw: "900", ta: { d: "center" }, color: "#ffffff" }), PB.mkW("text", { html: "<p>مكمّل غذائي — ليس دواءً ولا يغني عن استشارة الطبيب.</p>", fs: { d: 16, m: 15 }, ta: { d: "center" }, color: "#DCE8F5" }), PB.mkW("orderorig", { prod: PROD_SLUG })];
    const osec = PB.mkS([PB.mkC(cols)], { layout: "boxed", cw: { d: 1000 }, pad: { d: [50, 20, 50, 20], m: [30, 12, 30, 12] }, bg: "#102B4C" }); osec.set.cid = "order"; pg.sections.push(osec);
    pg.media = Object.keys(ASSETS).map(k => ASSETS[k].src).filter((x, i, a) => x.startsWith("assets/img/pages/") && a.indexOf(x) === i);
    delete pg.pending;
    return { page: pg, warn: v.warn, count: v.count };
  }, { doc, ASSETS, slug, Z, GEO, FS, FADE, CROP, PROD, PROD_SLUG, MSGR_LINK });
  if (r.err) { console.error("فشل:", r.err); process.exit(1); }
  fs.writeFileSync(path.join(ROOT, "assets/pages/" + slug + ".json"), JSON.stringify(r.page, null, 1));
  console.log("حُفظت assets/pages/" + slug + ".json", JSON.stringify(r.count)); (r.warn || []).forEach(w => console.log(" ⚠", w));
  if (errs.length) console.log("أخطاء صفحة:", errs); await b.close();
})();
