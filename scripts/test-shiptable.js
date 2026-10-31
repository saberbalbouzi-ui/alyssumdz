/* A-01: جدول الرسوم الموثوق (admin-shiptable.js) يطابق shipQuote الحقيقي في app.js على كل ولاية وبلدية ونوع توصيل، بعدة إعدادات */
const fs = require("fs"), vm = require("vm"), path = require("path");
let ok = 0, bad = 0; const t = (n, c, d) => { if (c) ok++; else { bad++; console.log("✗", n, d || ""); } if (c) console.log("✓", n); };
const app = fs.readFileSync(path.join(__dirname, "../assets/js/app.js"), "utf8");
const fn = (name) => { const a = app.indexOf("function " + name + "("); if (a < 0) throw new Error("no " + name); const b = app.indexOf("\nfunction ", a + 5); return app.slice(a, b < 0 ? undefined : b); };
const code = ["shipBlocked", "__adjSkip", "shipQuote", "applyShipNd"].map(fn).join("\n");
const ST = require("../assets/js/admin-shiptable.js");
const wsrc = fs.readFileSync(path.join(__dirname, "../assets/js/wilayas.js"), "utf8");
const loadW = () => { const c = vm.createContext({}); vm.runInContext(wsrc.replace(/^var /m, "var "), c); return JSON.parse(JSON.stringify(c.WILAYAS)); };
const nz = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
function check(label, co) {
  const W = loadW();
  /* المتجر: نفس تهيئة loadShipCo (nd يعلّم xc) ثم shipQuote */
  const ctx = vm.createContext({ WILAYAS: W, __SHIPCO: co.companies, __SHIPDEF: co.def, __SHIPSUP: co.sup, __SHIPCP: co.cp });
  vm.runInContext(code, ctx); Object.assign(ctx, { __S1: co.companies, __S2: co.def, __S3: co.sup || {}, __S4: co.cp || {} });
  vm.runInContext("__SHIPCO = __S1; __SHIPDEF = __S2; __SHIPSUP = __S3; __SHIPCP = __S4;", ctx); vm.runInContext("applyShipNd(" + JSON.stringify(co.nd || null) + ", " + JSON.stringify(co.def) + ");", ctx);
  const tbl = ST.build(loadW(), co), by = {}; tbl.rates.forEach((r) => { by[nz(r.wilaya) + "|" + nz(r.commune)] = r; });
  let n = 0, miss = [];
  for (const w of W) {
    if (w.hide) continue;
    for (const c of ["", ...(w.communes || [])]) for (const type of ["home", "stop"]) {
      const q = vm.runInContext("shipQuote(W_, C_, T_, 0, '', null)", Object.assign(ctx, { W_: w, C_: c, T_: type }));
      if (q.blocked) continue;
      const r = by[nz(w.name) + "|" + nz(c)] || by[nz(w.name) + "|"]; const want = type === "stop" ? r.stop : r.home; n++;
      if (want !== q.fee) miss.push(w.name + "/" + c + "/" + type + " جدول=" + want + " متجر=" + q.fee);
    }
  }
  t(label + ": " + n + " حالة مطابقة للمتجر", miss.length === 0 && n > 1000, miss.slice(0, 4).join(" | "));
  return tbl;
}
const W0 = loadW(), yal = {}; W0.filter((w) => !w.par).forEach((w) => { yal[w.id] = { home: w.home + 100, stop: w.stop + 50 }; });
check("المناطق الافتراضية", { def: "", companies: {} });
const t1 = check("ياليدين + خصم 200 على الولاية والبلديات", { def: "yalidine", companies: { yalidine: { prices: yal, adj: 200 } }, sup: { 16: { kouba: [50, 0], bachdjerrah: [100, 20] } }, cp: { 25: { ainsmara: [900, 500] } }, nd: { 52: ["tabelbala"] } });
check("ياليدين + adjMode=wilaya (النقص على الولاية فقط)", { def: "yalidine", companies: { yalidine: { prices: yal, adj: 200, adjMode: "wilaya" } }, sup: {}, cp: { 25: { ainsmara: [900, 500] } } });
check("شركة بلا إضافات + adj سالب (زيادة)", { def: "zr", companies: { zr: { prices: yal, adj: -100 } } });
t("صفوف البلديات قليلة (لا انفجار): " + t1.rates.length, t1.rates.length < 400 && t1.rates.length >= 69);
t("بلدية محجوبة (تبلبالة) لا صف لها", !t1.rates.some((r) => r.commune === "Tabelbala"));
t("special: منتجات برسم خاص", JSON.stringify(ST.special([{ slug: "a" }, { slug: "b", shipCo: "free" }, { slug: "c", shipAdj: 0 }, { slug: "d", shipCo: "x", active: false }])) === '["b","c"]');

/* PlatformSync.syncShipping: يرسل الجدول مرة واحدة ولا يعيد إرساله بلا تغيير، ويعيده عند تغيّر الأسعار */
(async () => {
  const store = {}, calls = [], co = { def: "yalidine", companies: { yalidine: { prices: yal, adj: 200 } }, sup: {}, cp: {}, nd: {} };
  const g = { WILAYAS: loadW(), document: { readyState: "complete", hidden: false, addEventListener() {} }, window: {}, localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
    setTimeout() {}, setInterval() {}, AdminCarts: { _s: {}, call: async (m, p, b) => { calls.push([m, p, b]); return { ok: true, st: 200 }; } }, ShipTable: ST, Date, JSON, Math,
    Admin: { products: [{ slug: "a" }, { slug: "b", shipCo: "free" }], shipCoData: () => co, orders: [] } };
  const ctx = vm.createContext(g); vm.runInContext(fs.readFileSync(path.join(__dirname, "../assets/js/admin-platform-sync.js"), "utf8") + "\n;globalThis.PS = PlatformSync;", ctx);
  await ctx.PS.syncShipping(); t("المزامنة الأولى ترسل PUT /v1/catalog/shipping بجدول مستبدِل", calls.length === 1 && calls[0][0] === "PUT" && calls[0][1] === "/v1/catalog/shipping" && calls[0][2].replace === true && calls[0][2].rates.length >= 69);
  await ctx.PS.syncShipping(); t("بلا تغيّر لا يُعاد الإرسال", calls.length === 1);
  co.companies.yalidine.adj = 300; await ctx.PS.syncShipping(); t("تغيّر الخصم يعيد الإرسال", calls.length === 2);
  t("المنتجات برسم خاص تُحصى", JSON.stringify(ctx.PS._s.ship.special) === '["b"]');
  console.log(bad ? "✗ فشل " + bad : "✓ نجح " + ok + " من " + ok); process.exit(bad ? 1 : 0);
})();
