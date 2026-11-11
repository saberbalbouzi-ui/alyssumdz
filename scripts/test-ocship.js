/* اختبار «أسعار التوصيل لهذه الصفحة فقط» في نموذج الطلب المضمَّن (fsc → oc.sc):
   (1) المطوّر يكتب sc/sh/ss في رابط الإطار، (2) المتجر يطبّقها على سعر التوصيل بتجاوز المنتج.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-ocship.js   (يحتاج: python3 -m http.server 8765 من جذر المشروع) */
const path = require("path"), fs = require("fs"), { chromium } = require("playwright"); const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const code = fs.readFileSync(path.join(root, "scripts/pagebuilder.js"), "utf8");
const page = fsc => ({ v: 1, title: "t", slug: "oc", bg: "#fff", ff: "Cairo", header: false, footer: false, css: "", sections: [{ id: "s1", set: { cls: "t-sec", layout: "boxed" }, cols: [{ id: "c1", set: {}, widgets: [{ id: "o1", type: "orderorig", set: Object.assign({ prod: "pack4" }, fsc) }] }] }] });
(async () => {
  const br = await chromium.launch(), p0 = await br.newPage(); await p0.goto("about:blank");
  const iframeOc = async set => { const html = await p0.evaluate(([c, pg]) => { const PB = new Function(c + ";return PB;")(); return PB.fullHtml(pg, { base: "../../", site: { name: "x", domain: "x.com", wa: "1" }, products: [{ slug: "pack4", title: "ب", price: 4200, offers: [] }], meta: { tabs: [], cats: {} } }); }, [code, page(set)]); const m = html.match(/order-embed\.html\?[^"]*oc=([^"&]+)/); return m ? JSON.parse(decodeURIComponent(m[1])) : null; };
  let o = await iframeOc({ fsc: "zones" }); ok("المطوّر: fsc=zones → oc.sc=zones", o && o.sc === "zones", o);
  o = await iframeOc({ fsc: "yalidine" }); ok("المطوّر: شركة محدّدة → oc.sc=مفتاحها", o && o.sc === "yalidine", o);
  o = await iframeOc({ fsc: "free", fsh: 900, fss: 450 }); ok("المطوّر: سعر حر → sc=free وsh/ss", o && o.sc === "free" && o.sh === 900 && o.ss === 450, o);
  o = await iframeOc({}); ok("المطوّر: بلا اختيار لا يكتب sc (يتبع المنتج)", !o || o.sc === undefined, o);
  const fee = async oc => { const q = await br.newPage({ viewport: { width: 420, height: 900 } }); await q.goto("http://localhost:8765/order-embed.html?p=pack4&embed=1&oc=" + encodeURIComponent(JSON.stringify(oc))); await q.waitForTimeout(3500); const r = await q.evaluate(() => { const pr = PRODUCTS.find(x => x.slug === "pack4"), w = WILAYAS.find(x => x.id == 16); return { home: shipQuote(w, "", "home", 4200, pshipCo(pr), prodShipPf(pr), prodShipAdj(pr)).fee, stop: shipQuote(w, "", "stop", 4200, pshipCo(pr), prodShipPf(pr), prodShipAdj(pr)).fee, zone: [w.home, w.stop], co: typeof __SHIPCO !== "undefined" && __SHIPCO ? Object.fromEntries(Object.keys(__SHIPCO).map(k => [k, __SHIPCO[k].prices && __SHIPCO[k].prices[16] && { home: __SHIPCO[k].prices[16].home, stop: __SHIPCO[k].prices[16].stop, adj: Number(__SHIPCO[k].adj) || 0 }])) : null, def: __SHIPDEF, prodCo: pr.shipCo }; }); await q.close(); return r; };
  const base = await fee({}), z = await fee({ sc: "zones" }), d = await fee({ sc: "def" }), y = await fee({ sc: "yalidine" }), f = await fee({ sc: "free", sh: 777, ss: 333 }), f2 = await fee({ sc: "free" });
  ok("بلا oc.sc: يتبع المنتج (" + base.prodCo + ")", base.home === (base.prodCo === "zones" ? base.zone[0] : base.home), base);
  ok("oc.sc=zones: سعر المنطقة بغضّ النظر عن المنتج", z.home === z.zone[0] && z.stop === z.zone[1], z);
  const net = (c, k) => Math.max(0, c[k] - c.adj);   /* التعريفة بعد «تعديل السعر المعروض» (adj) الذي تضبطه الشركة */
  ok("oc.sc=def: تعريفة الشركة الافتراضية (" + d.def + ") بعد تعديل السعر المعروض", d.co && d.co[d.def] && d.home === net(d.co[d.def], "home") && d.stop === net(d.co[d.def], "stop"), d);
  ok("oc.sc=yalidine: تعريفة ياليدين (مختلفة عن الافتراضية) بعد تعديل السعر المعروض", y.co && y.co.yalidine && y.home === net(y.co.yalidine, "home") && y.stop === net(y.co.yalidine, "stop"), y);
  ok("oc.sc=free: السعر الحر للمنزل والمكتب", f.home === 777 && f.stop === 333, f);
  ok("oc.sc=free بلا أسعار: يرجع للتسعير الافتراضي لا صفراً", f2.home > 0, f2);
  await br.close(); console.log(fails ? "✗ فشل " + fails : "✓ نجح الكل"); process.exit(fails ? 1 : 0);
})();
