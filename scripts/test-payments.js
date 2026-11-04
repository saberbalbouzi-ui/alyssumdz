/* اختبار تسوية ياليدين في المدفوعات: يطابق صافي كشف exportation_paiement (13 صفاً) بالتقدير وبالأرقام الفعلية */
const fs = require("fs"), vm = require("vm");
let pass = 0, fail = 0; const ok = (n, c, d) => { if (c) { pass++; console.log("✓ " + n); } else { fail++; console.log("✗ " + n, d || ""); } };
// صفوف الكشف: [trk, status, price M, delivery T, X, COD W, net Y, ret U, free]
const R = [
  ["PY30XZ","echec",0,0,0,0,-250,250,false,0],
  ["RM75ZE","livree",7250,750,8000,-54.375,7195.625,0,false,750],
  ["WF56ND","livree",1500,700,2200,-11.25,1488.75,0,false,700],
  ["VL16MD","livree",15700,700,16400,-117.75,15582.25,0,false,700],
  ["WX13VZ","livree",50,850,900,-0.375,49.625,0,false,850],
  ["XZ17BU","livree",0,750,0,0,-750,0,true,0],
  ["ZA25YK","livree",2350,750,3100,-17.625,2332.375,0,false,750],
  ["MR23XE","livree",5100,500,5600,-38.25,5061.75,0,false,500],
  ["MT67SU","livree",2300,800,3100,-17.25,2282.75,0,false,800],
  ["TC79BX","livree",4100,800,4900,-30.75,4069.25,0,false,800],
  ["AV83VP","livree",0,750,0,0,-750,0,true,0],
  ["FV93KN","livree",500,500,1000,-3.75,496.25,0,false,500],
];
function build(withFile) {
  const orders = R.map((r, i) => ({ id: "o" + i, status: r[1], total: r[4], fee: r[9], _del: r[3], _trk: r[0], date: "2026-09-10" }));
  const act = {};
  if (withFile) R.forEach(r => { act[r[0]] = { st: r[1] === "echec" ? "Retourné au vendeur" : "Livré", price: r[2], del: r[1] === "echec" ? 0 : r[3], ret: r[7], ins: 0, cod: Math.abs(r[5]), net: r[6] }; });
  const Admin = { orders, fin: { costs: {}, set: { packaging: 0 } }, ST_AR: {}, ydActual: act,
    trackingOf: o => ({ company: "yalidine", tracking: o._trk }), actualFees(o) { return this.ydActual[o._trk] || null; },
    realFees: o => ({ delivery: o._del, retour: 250, cod: 0.75, ins: 0 }), orderLines: () => [], carrierCost: o => o._del, retCost: () => 250, deliveredOf: () => "" };
  const sb = { window: {}, Admin, document: { addEventListener() {}, getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} }, console, btoa, atob, escape, unescape, URL, Blob: function () {} };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(fs.readFileSync("assets/js/admin-payments.js", "utf8") + ";this.AP=AdminPayments;", sb);
  return sb.AP;
}
for (const withFile of [true, false]) {
  const AP = build(withFile), items = AP.items(); let bad = [];
  items.forEach((it, i) => { const x = AP.settle(it), want = R[i][6]; if (!x || Math.abs(x.net - want) > 0.001) bad.push([R[i][0], x && x.net, want]); });
  ok((withFile ? "من الكشف" : "تقدير من التعريفة") + ": صافي كل الطرود الـ12 يطابق net client", !bad.length, JSON.stringify(bad));
  const T = AP.sumSettle(items);
  ok((withFile ? "الكشف" : "التقدير") + ": مجموع الصافي = 36808.625 (TOTAUX الكشف، المرتجع -250 داخله)", Math.abs(T.net - 36808.625) < 0.001, T.net);
  ok("المرتجعات 1 والخسارة 250", T.nRet === 1 && T.retLoss === 250, T);
}
const AP = build(false), it = AP.items()[1], x = AP.settle(it);
ok("تفصيل طرد مسلَّم: محصَّل 8000، توصيل 750، COD 54.375", x.got === 8000 && x.del === 750 && Math.abs(x.cod - 54.375) < 1e-9, x);
const free = AP.settle(AP.items()[5]);
ok("طرد مجاني يخسر رسم التوصيل (−750) ويُوسَم free", free.net === -750 && free.free === true, free);

// كشف pmt-LE18VD (12 طرداً: 9 مسلَّمة و3 مرتجعة برسوم فعلية 260/250/250): TOTAUX الكشف = 52586.875
{
  const K = [ // [trk, status, price, del, cod, ret, net]
    ["ZB88SL","echec",0,0,0,260,-260],["BZ72YV","echec",0,0,0,250,-250],["KX46VC","echec",0,0,0,250,-250],
    ["DT96HM","livree",4400,500,33,0,4367],["RR40PU","livree",11900,800,89.25,0,11810.75],["BT74YR","livree",2400,800,18,0,2382],
    ["ZD41FU","livree",2800,700,21,0,2779],["DL95RB","livree",4100,800,30.75,0,4069.25],["MR90EF","livree",4100,800,30.75,0,4069.25],
    ["TF63LE","livree",5450,850,40.875,0,5409.125],["MU48VB","livree",12500,800,93.75,0,12406.25],["YH82YC","livree",6100,800,45.75,0,6054.25] ];
  const orders = K.map((r, i) => ({ id: "k" + i, status: r[1], total: r[2] + r[3], fee: r[3], _trk: r[0], date: "2026-10-20" }));
  const act = {}; K.forEach(r => { act[r[0]] = { st: r[1] === "echec" ? "Retourné au vendeur" : "Livré", price: r[2], del: r[3], ret: r[5], ins: 0, cod: r[4], net: r[6] }; });
  const Admin = { orders, fin: { costs: {}, set: { packaging: 0 } }, ST_AR: {}, ydActual: act,
    trackingOf: o => ({ company: "yalidine", tracking: o._trk }), actualFees(o) { return this.ydActual[o._trk] || null; },
    realFees: () => null, orderLines: () => [], carrierCost: o => o.fee, retCost: () => 250, deliveredOf: () => "" };
  const sb = { Admin, document: { addEventListener() {}, getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} }, console, btoa, atob, escape, unescape, URL, Blob: function () {} };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(fs.readFileSync("assets/js/admin-payments.js", "utf8") + ";this.AP=AdminPayments;", sb);
  const items = sb.AP.items(), bad = [];
  items.forEach((it, i) => { const x = sb.AP.settle(it); if (!x || Math.abs(x.net - K[i][6]) > 0.001) bad.push([K[i][0], x && x.net, K[i][6]]); });
  ok("كشف LE18VD: صافي كل طرد من الـ12 يطابق net client", !bad.length, JSON.stringify(bad));
  const T = sb.AP.sumSettle(items);
  ok("كشف LE18VD: مجموع الصافي = 52586.875، التوصيل 6850، COD 403.125، الإرجاع 760", Math.abs(T.net - 52586.875) < 1e-6 && Math.abs(T.del - 6850) < 1e-6 && Math.abs(T.cod - 403.125) < 1e-6 && T.retLoss === 760 && T.nRet === 3 && T.nDone === 9, T);
}

// كشف «قادم/غير جاهز» مستورد: يبقى في المستحق بأرقام الشركة الحقيقية ويُجمَّع حسب الحالة؛ والمدفوع يُستثنى
{
  const orders = [{ id: "p1", status: "livree", total: 4000, fee: 700, _trk: "T1", date: "2026-10-20" }, { id: "p2", status: "livree", total: 3000, fee: 500, _trk: "T2", date: "2026-10-20" }, { id: "p3", status: "livree", total: 2000, fee: 500, _trk: "T3", date: "2026-10-20" }];
  const act = { T1: { pend: "nr", st: "Livré", price: 3300, del: 700, ret: 0, ins: 0, cod: 24.75, net: 2575.25 }, T2: { pend: "next", st: "Livré", price: 2500, del: 500, ret: 0, ins: 0, cod: 18.75, net: 1981.25 }, T3: { st: "Livré", price: 1500, del: 500, ret: 0, ins: 0, cod: 11.25, net: 988.75 } };
  const Admin = { orders, fin: { costs: {}, set: { packaging: 0 } }, ST_AR: {}, ydActual: act, trackingOf: o => ({ company: "yalidine", tracking: o._trk }), actualFees(o) { return this.ydActual[o._trk] || null; }, realFees: () => null, orderLines: () => [], carrierCost: o => o.fee, retCost: () => 250, deliveredOf: () => "" };
  const sb = { Admin, document: { addEventListener() {}, getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} }, console, btoa, atob, escape, unescape, URL, Blob: function () {} };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(fs.readFileSync("assets/js/admin-payments.js", "utf8") + ";this.AP=AdminPayments;", sb);
  const items = sb.AP.items(), rest = items.filter(it => sb.AP.settle(it) && !(sb.AP.settle(it).src === "file" && !sb.AP.settle(it).pend)), T = sb.AP.sumSettle(rest);
  ok("كشف قادم/غير جاهز: طردان يبقيان بأرقام الكشف (2575.25 + 1981.25) والمدفوع مستثنى", rest.length === 2 && Math.abs(T.net - 4556.5) < 1e-6 && T.grp.nr.n === 1 && Math.abs(T.grp.next.net - 1981.25) < 1e-6, T);
}

// جدول «المنصة مقابل الشركة»: مجموع الكشفين، الفروق، واقتراح الطردين اللذين يفسّران فرق العدد والمبلغ
{
  const orders = [{ id: "c1", status: "livree", total: 4000, fee: 700, _trk: "U1", date: "2026-10-20" }, { id: "c2", status: "livree", total: 3000, fee: 500, _trk: "U2", date: "2026-10-20" }, { id: "c3", status: "expediee", total: 5000, fee: 700, _trk: "U3", date: "2026-10-20", name: "أحمد", wilaya: "وهران" }, { id: "c4", status: "expediee", total: 3700, fee: 750, _trk: "U4", date: "2026-10-20", name: "سعاد", wilaya: "سطيف" }, { id: "c5", status: "expediee", total: 1111, fee: 500, _trk: "U5", date: "2026-10-20" }];
  const Admin = { orders, fin: { costs: {}, set: { packaging: 0 } }, ST_AR: {}, ydActual: {}, trackingOf: o => ({ company: "yalidine", tracking: o._trk }), actualFees() { return null; }, realFees: () => null, orderLines: () => [], carrierCost: o => o.fee, retCost: () => 250, deliveredOf: () => "" };
  const sb = { Admin, document: { addEventListener() {}, getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} }, console, btoa, atob, escape, unescape, URL, Blob: function () {} };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(fs.readFileSync("assets/js/admin-payments.js", "utf8") + ";this.AP=AdminPayments;", sb);
  sb.AP.YP.list.push({ state: "notready", livre: 3, retour: 0, got: 12000, cod: 90, del: 2000, ret: 0, ins: 0, net: 9910 }, { state: "ready", livre: 1, retour: 0, got: 3700, cod: 27.75, del: 750, ret: 0, ins: 0, net: 2922.25 });
  const h = sb.AP.cmpCard();
  ok("جدول المقارنة: مجموع الشركة 15 700,00 وفرق Livré +2 colis", /15[\s\u202f\u00a0]700,00 DA/.test(h) && /\+2 colis/.test(h), h.slice(0, 200));
  ok("جدول المقارنة: يقترح طردَي 5000 + 3700 (مجموعهما فرق المحصَّل 8700)", /#c3/.test(h) && /#c4/.test(h) && !/#c5/.test(h), h.replace(/<[^>]+>/g, " ").slice(-400));
}

// تلقائي من حالة الدفع عند الشركة: not-ready/ready تتجمّع بأرقام الطرد الفعلية (توصيل، رسم إرجاع)، و«paid» يخرج من المتبقي
{
  const orders = [{ id: "a1", status: "livree", total: 3800, fee: 700, _trk: "V1", date: "2026-10-20" }, { id: "a2", status: "livree", total: 5300, fee: 900, _trk: "V2", date: "2026-10-20" }, { id: "a3", status: "echec", total: 3000, fee: 600, _trk: "V3", date: "2026-10-20" }, { id: "a4", status: "livree", total: 2000, fee: 500, _trk: "V4", date: "2026-10-20" }];
  const raw = { a1: { raw: "Livré", pay: "not-ready", fin: { fee: 650, tp: 0.75, tr: 250 } }, a2: { raw: "Livré", pay: "ready", fin: { fee: 1000, tp: 0.75, tr: 250 } }, a3: { raw: "Retourné au vendeur", pay: "ready", fin: { fee: 600, tp: 0.75, tr: 260 } }, a4: { raw: "Livré", pay: "paid", fin: { fee: 500, tp: 0.75, tr: 250 } } };
  const ps = r => { const t = String(r || "").toLowerCase().replace(/[_-]+/g, " "); if (!t) return ""; if (/not\s*ready/.test(t)) return "notready"; if (/ready/.test(t)) return "ready"; if (/paid/.test(t)) return "paid"; return ""; };
  const Admin = { orders, fin: { costs: {}, set: { packaging: 0 } }, ST_AR: {}, ydActual: {}, shipRaw: raw, payState: ps, trackingOf: o => ({ company: "yalidine", tracking: o._trk }), actualFees() { return null; }, realFees: () => null, orderLines: () => [], carrierCost: o => o.fee, retCost: () => 250, deliveredOf: () => "" };
  const sb = { Admin, document: { addEventListener() {}, getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} }, console, btoa, atob, escape, unescape, URL, Blob: function () {} };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(fs.readFileSync("assets/js/admin-payments.js", "utf8") + ";this.AP=AdminPayments;", sb);
  const it = id => sb.AP.items().find(x => x.id === id), x1 = sb.AP.settle(it("a1")), x3 = sb.AP.settle(it("a3"));
  ok("أرقام الطرد الفعلية: توصيل a1 = 650 (لا 700) ورسم إرجاع a3 = 260", x1.del === 650 && x3.ret === 260, [x1.del, x3.ret]);
  const h = sb.AP.cmpCard();
  ok("تلقائي: عمودا Pas prêt وPrêt à payer بلا الطرد المدفوع a4", /Pas pr/.test(h) && /Pr.t . payer/.test(h) && /تلقائياً من حالة الدفع/.test(h), h.replace(/<[^>]+>/g, " ").slice(0, 300));
}

// الجدول يضم الطلبات المسجَّلة عند الشركة فقط (F5D05 و2FB29 مثلاً)
{
  const orders = [
    { id: "F5D05", status: "expediee", total: 4000, fee: 700, _trk: "yal-A" },
    { id: "2FB29", status: "expediee", total: 3000, fee: 700, _trk: "yal-B" },
    { id: "F851C", status: "confirmee", total: 3000, fee: 700, _trk: "yal-ORPHAN" },   // وسم تتبع غير موجود عند الشركة
    { id: "NEW1", status: "nouvelle", total: 3000, fee: 700 },                          // لم يُرسل
    { id: "CAN1", status: "annulee", total: 3000, fee: 700, _trk: "yal-C" },            // ملغى
  ];
  const Admin = { orders, fin: { costs: {}, set: {} }, ST_AR: {}, ydActual: {},
    trackingOf: o => o._trk ? { company: "yalidine", tracking: o._trk } : null, actualFees() { return null; },
    realFees: o => ({ delivery: 700, retour: 250, cod: 0.75, ins: 0 }), orderLines: () => [], carrierCost: () => 700, retCost: () => 250, deliveredOf: () => "" };
  const sb = { Admin, AdminYd: { S: { rows: [{ tracking: "yal-A" }, { tracking: "yal-B" }, { tracking: "yal-C" }] } }, document: { addEventListener() {}, getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} }, console, btoa, atob, escape, unescape, URL, Blob: function () {} };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(fs.readFileSync("assets/js/admin-payments.js", "utf8") + ";this.AP=AdminPayments;", sb);
  const ids = sb.AP.items().map(i => i.id).sort().join(",");
  ok("الجدول: طلبان فقط (F5D05 و2FB29)؛ يُستبعد اليتيم والجديد والملغى", ids === "2FB29,F5D05", ids);
  sb.AdminYd.S.rows = [];   // قائمة الشركة لم تُحمَّل بعد: يكفي التتبع والحالة
  const ids2 = sb.AP.items().map(i => i.id).sort().join(",");
  ok("بلا قائمة شركة محمّلة وبلا شركة قراءة مفعّلة: الطلبات المتتبَّعة المؤكَّدة/المرسَلة فقط (بلا الجديد والملغى)", ids2 === "2FB29,F5D05,F851C", ids2);
  sb.Admin.listCompanyKey = () => "yalidine";   // شركة قراءة الطرود مفعّلة ولم تُحمَّل قائمتها ← لا تخمين
  const ids3 = sb.AP.items().map(i => i.id).join(",");
  ok("شركة الطرود مفعّلة وقائمتها غير محمّلة: لا يظهر شيء حتى تُجلب (لا يظهر الطلب اليتيم)", ids3 === "", ids3);
}
console.log(fail ? "✗ فشل " + fail : "✓ نجح " + pass + " من " + pass); process.exit(fail ? 1 : 0);
