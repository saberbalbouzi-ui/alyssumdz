/* اختبار إضافة البلدية في سعر التوصيل بالمتجر (shipQuote) */
const fs = require("fs"); const src = fs.readFileSync(__dirname + "/../assets/js/app.js", "utf8");
const i = src.indexOf("function shipQuote("); let d = 0, j = src.indexOf("{", i); const st = j; for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}") { d--; if (!d) break; } }
const fn = src.slice(i, j + 1);
const make = (SUP, CO, CP, DEF) => new Function("__SHIPSUP", "__SHIPCO", "__SHIPDEF", "__SHIPCP", "shipBlocked", fn + "; return shipQuote;")(SUP, CO || {}, DEF || "", CP || {}, () => "");
let ok = 0, bad = 0; const t = (n, c) => { console.log((c ? "✓ " : "✗ ") + n); c ? ok++ : bad++; };
const w = { id: 16, name: "Alger", home: 750, stop: 500, fh: false, fs: false };
const q = make({ 16: { kouba: [50, 0] } });
t("بلدية بإضافة: 750 + 50 = 800", q(w, "Kouba", "home", 2400, "", null).fee === 800);
t("بلدية بلا إضافة: 750", q(w, "Bab Ezzouar", "home", 2400, "", null).fee === 750);
t("مكتب Stop Desk: بلا إضافة", q(w, "Kouba", "stop", 2400, "", null).fee === 500);
t("اسم البلدية بحروف/تشكيل مختلفة يطابق", q(w, "KOUBA ", "home", 2400, "", null).fee === 800);
t("سعر حر لمنتج: لا إضافة", q(w, "Kouba", "home", 2400, "free", { home: 600, stop: null }).fee === 600);
t("شحن مجاني للولاية يبقى 0", q(Object.assign({}, w, { fh: true }), "Kouba", "home", 2400, "", null).fee === 0);
t("ولاية جديدة (par) تأخذ إضافات أمها", make({ 16: { x: [30, 0] } })({ id: 59, par: 16, name: "N", home: 700, stop: 400 }, "X", "home", 1, "", null).fee === 730);
t("الإضافة تُعاد في sup (50) ولا تُحسب مجاناً", q(w, "Kouba", "home", 2400, "", null).sup === 50 && q(w, "Bab Ezzouar", "home", 2400, "", null).sup === 0 && q(Object.assign({}, w, { fh: true }), "Kouba", "home", 2400, "", null).sup === 0);

/* سعر البلدية مستقل عن سعر الولاية (بلاغ بني عباس: الولاية 1200 والبلدية 1400 كما عند ياليدين) */
{ const ba = { id: 52, name: "Béni Abbès", home: 1250, stop: 700 }, CO = { yalidine: { name: "Y", prices: { 52: { home: 1200, stop: 700 } }, adj: 0 } }, CP = { 52: { beniabbes: [1400, 700], eltest: [1250, 700] } };
  const qq = make({}, CO, CP, "yalidine");
  t("بلا بلدية: سعر الولاية 1200", qq(ba, "", "home", 1, "", null).fee === 1200);
  t("بني عباس: سعر البلدية 1400 مستقل", qq(ba, "Béni Abbès", "home", 1, "", null).fee === 1400);
  t("بلدية بسعر أقل من الولاية تأخذ سعرها (1250)", qq(ba, "El Test", "home", 1, "", null).fee === 1250);
  t("مكتب: 700", qq(ba, "Béni Abbès", "stop", 1, "", null).fee === 700);
  t("بلدية بلا بيانات: سعر الولاية", qq(ba, "Unknown", "home", 1, "", null).fee === 1200);
  const q2 = make({}, { yalidine: { name: "Y", prices: { 52: { home: 1200, stop: 700 } }, adj: 200 } }, CP, "yalidine");
  t("تعديل السعر المعروض (200) يُطرح من سعر البلدية: 1200", q2(ba, "Béni Abbès", "home", 1, "", null).fee === 1200 && q2(ba, "", "home", 1, "", null).fee === 1000);
  t("مبلغ منقوص خاص بالمنتج (300) يتجاوز إعداد الشركة (200)", q2(ba, "", "home", 1, "", null, 300).fee === 900 && q2(ba, "Béni Abbès", "home", 1, "", null, 300).fee === 1100);
  t("منتج بلا نقص (0) رغم نقص الشركة 200", q2(ba, "", "home", 1, "", null, 0).fee === 1200 && q2(ba, "Béni Abbès", "home", 1, "", null, 0).fee === 1400);
  t("منتج بلا إعداد (null) يتبع الشركة", q2(ba, "", "home", 1, "", null, null).fee === 1000);
  t("أسعار المناطق: سعر المنطقة بلا سعر ياليدين", qq(ba, "Béni Abbès", "home", 1, "zones", null).fee === 1250);
}

/* بلديات لا توصّل إليها ياليدين (تبلبالة) تُحجب في المتجر */
{ const a = src.indexOf("function applyShipNd("), b = src.indexOf("function loadShipCo("), code = src.slice(a, b);
  const W = [{ id: 52, name: "Béni Abbès", communes: ["Igli", "Tabelbala", "Béni Abbès"] }, { id: 8, name: "Béchar", communes: ["Béchar"] }];
  new Function("WILAYAS", "nd", "def", code + "; applyShipNd(nd, def);")(W, { 52: ["tabelbala"] }, "yalidine");
  t("تبلبالة تُعلَّم غير متاحة (xc=all)", W[0].xc && W[0].xc.Tabelbala === "all" && !W[0].xc.Igli && !W[1].xc);
  const W2 = [{ id: 52, communes: ["Tabelbala"] }]; new Function("WILAYAS", "nd", "def", code + "; applyShipNd(nd, def);")(W2, { 52: ["tabelbala"] }, "zr");
  t("لا حجب لشركة افتراضية غير ياليدين", !W2[0].xc);
}

/* اتساق تعريفة ياليدين: base (أرخص بلدية) + sup = سعر ياليدين لكل بلدية (بلاغ قسنطينة 750 + عين السمار 50) */
const adm = fs.readFileSync(__dirname + "/../admin.html", "utf8");
const meth = (name) => { const a = adm.indexOf("\n  " + name + "("); const b = adm.indexOf("\n  },", a); return adm.slice(a + 1, b + 4).replace(/^\s*(async\s+)?/, ""); };
const A = new Function("WILAYAS", "return {fromWilayaId(){return 16}, saveDeliveryCfgToStorage(){}, publishShipCo(){}, renderDelivery(){}, renderDeliveryPriceSourceCard(){}, deliveryCfg:{yalidine:{enabled:true}}, ydFees:null, " + meth("derivePricesFromFees") + "," + meth("communeSup") + "}");
const WIL = [{ id: 25, name: "Constantine", home: 800, stop: 500 }, { id: 15, name: "Tizi Ouzou", home: 750, stop: 450 }];
const mk = (Y) => { const o = A(WIL); o.ydFees = Y; return o; };
const Y = { "16-25": { pc: { constantine: { h: 750, d: 500 }, elkhroub: { h: 750, d: 500 }, ainsmara: { h: 800, d: 500 }, zighoud: { h: 800, d: 500 }, hamma: { h: 800, d: 500 } } }, "16-15": { pc: { tiziouzou: { h: 750, d: 450 }, mkira: { h: 800, d: 450 }, akbil: { h: 800, d: 450 } } } };
const o = mk(Y); o.derivePricesFromFees("yalidine");
const P = o.deliveryCfg.yalidine.prices;
t("تعريفة قسنطينة = أرخص بلدية 750 (لا المنوال 800)", P[25].home === 750 && P[25].stop === 500);
t("تعريفة تيزي وزو 750", P[15].home === 750);
const S = o.communeSup();
t("عين السمار: 750 + 50 = 800", P[25].home + ((S[25] || {}).ainsmara || [0])[0] === 800);
t("بلدية قسنطينة: 750 + 0", ((S[25] || {}).constantine || [0])[0] === 0);
t("كل بلدية: base + sup = سعر ياليدين", Object.keys(Y).every(k => { const id = Number(k.split("-")[1]); return Object.keys(Y[k].pc).every(c => P[id].home + (((S[id] || {})[c] || [0])[0]) === Y[k].pc[c].h); }));
console.log(bad ? "✗ فشل " + bad : "✓ نجح " + ok + " من " + ok); process.exit(bad ? 1 : 0);
