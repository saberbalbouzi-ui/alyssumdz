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
console.log(fail ? "✗ فشل " + fail : "✓ نجح " + pass + " من " + pass); process.exit(fail ? 1 : 0);
