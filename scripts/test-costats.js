/* اختبار فصل المدفوعات والإحصائيات حسب شركة التوصيل: ياليدين وWeCan وأي شركة، وخلاصة عامة تساوي مجموع الأجزاء
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-costats.js */
const fs = require("fs"), vm = require("vm");
let pass = 0, fail = 0; const ok = (n, c, d) => { if (c) { pass++; console.log("✓ " + n); } else { fail++; console.log("✗ " + n, d === undefined ? "" : JSON.stringify(d).slice(0, 300)); } };
const now = Date.now(), day = 864e5, iso = n => new Date(now - n * day).toISOString();
const O = (id, st, total, fee, co, trk, ago) => ({ id, status: st, total, fee, date: iso(ago), note: co ? "🚚" + co + ":" + trk : "" });
const orders = [
  O("y1", "livree", 3000, 600, "yalidine", "YA1", 2), O("y2", "livree", 2000, 500, "yalidine", "YA2", 3), O("y3", "echec", 1500, 400, "yalidine", "YA3", 4), O("y4", "expediee", 2500, 600, "yalidine", "YA4", 1),
  O("w1", "livree", 4000, 700, "wecan", "WE1", 2), O("w2", "expediee", 1800, 500, "wecan", "WE2", 1), O("w3", "echec", 900, 450, "wecan", "WE3", 5),
  O("z1", "livree", 1200, 300, "noest", "NO1", 6),
  O("n1", "nouvelle", 700, 0, "", "", 1), O("n2", "confirmee", 800, 0, "", "", 2), O("n3", "annulee", 600, 0, "", "", 3),
  O("old", "livree", 5000, 600, "yalidine", "YA9", 80)];
const Admin = { orders, fin: { costs: {}, set: { packaging: 0 } }, ST_AR: {}, ydActual: {}, shipRaw: {},
  trackingOf(o) { const m = String(o.note || "").match(/🚚([a-z0-9_]+):([A-Za-z0-9._-]+)/); return m ? { company: m[1], tracking: m[2] } : null; },
  allDeliveryCompanies: () => ({ yalidine: { name: "ياليدين" }, wecan: { name: "WeCan" }, noest: { name: "Noest" } }), enabledCompanyKeys: () => ["yalidine", "wecan"],
  actualFees: () => null, realFees: () => null, orderLines: () => [], carrierCost: o => o.fee, retCost: () => 250, deliveredOf: () => "", listCompanyKey: () => "" };
const sb = { Admin, document: { addEventListener() {}, getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} }, console, btoa, atob, escape, unescape, URL, Blob: function () {}, Date };
sb.window = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync("assets/js/admin-costats.js", "utf8") + ";this.CS=AdminCoStats;", sb);
vm.runInContext(fs.readFileSync("assets/js/admin-payments.js", "utf8") + ";this.AP=AdminPayments;", sb);
const CS = sb.CS, AP = sb.AP;

// الإحصائيات
const g = CS.aggregate(orders, 30), by = g.by;
ok("مفاتيح الشركات: المفعّلة أولاً ثم Noest ثم «غير مرسلة»", JSON.stringify(g.keys) === JSON.stringify(["yalidine", "wecan", "noest", "none"]), g.keys);
ok("ياليدين: 4 طلبات (آخر 30 يوماً بلا الطلب القديم)", by.yalidine.n === 4 && by.yalidine.delivered === 2 && by.yalidine.returned === 1 && by.yalidine.transit === 1, by.yalidine);
ok("ياليدين: مبيعات المسلَّم 5000 ورسوم التوصيل 1100", by.yalidine.revenue === 5000 && by.yalidine.fees === 1100, by.yalidine);
ok("WeCan: 3 طلبات (مسلَّم 1، في الطريق 1، مرتجع 1) ومبيعات 4000", by.wecan.n === 3 && by.wecan.delivered === 1 && by.wecan.transit === 1 && by.wecan.returned === 1 && by.wecan.revenue === 4000, by.wecan);
ok("شركة أخرى (Noest) تظهر بإحصائياتها", by.noest.n === 1 && by.noest.revenue === 1200, by.noest);
ok("غير المرسلة: جديدة 1، مؤكَّدة 1، ملغاة 1", by.none.fresh === 1 && by.none.confirmed === 1 && by.none.cancelled === 1 && by.none.n === 3, by.none);
const sum = f => g.keys.reduce((n, k) => n + by[k][f], 0);
ok("الخلاصة العامة = مجموع الشركات في كل الحقول", ["n", "delivered", "returned", "transit", "revenue", "fees", "transitAmt", "returnedAmt"].every(f => sum(f) === g.total[f]), g.total);
ok("«كل الفترات» يضم الطلب القديم", CS.aggregate(orders, 0).by.yalidine.n === 5);
ok("جدول الإحصائيات يحوي أسماء الشركات والخلاصة", /ياليدين/.test(CS.tableHtml(g)) && /WeCan/.test(CS.tableHtml(g)) && /الخلاصة العامة/.test(CS.tableHtml(g)));

// المدفوعات
const items = AP.items(), cos = {}; items.forEach(it => { cos[it.co] = (cos[it.co] || 0) + 1; });
ok("المدفوعات تضم طلبات ياليدين وWeCan وNoest المرسلة (بلا الجديد والملغى)", cos.yalidine === 5 && cos.wecan === 3 && cos.noest === 1 && !cos.none, cos);
const tY = AP.totals("yalidine"), tW = AP.totals("wecan"), tA = AP.totals("all");
ok("المستلَم: ياليدين 10000 (3000+2000+5000)، WeCan 4000، الكل = المجموع", tY.received === 10000 && tW.received === 4000 && tA.received === tY.received + tW.received + AP.totals("noest").received, [tY, tW, tA]);
ok("قيد التوصيل: ياليدين 2500 وWeCan 1800", tY.pending === 2500 && tW.pending === 1800, [tY, tW]);
AP.S.co = "wecan"; const fw = AP.items().filter(it => true), listW = AP.S && AP.items().filter(it => it.co === "wecan");
ok("عناصر WeCan 3", listW.length === 3);
ok("تسوية ياليدين لا تحسب طرود WeCan", AP.sumSettle(items).n === AP.sumSettle(items.filter(it => it.co === "yalidine")).n, AP.sumSettle(items).n);
const sW = AP.sumSettle(items.filter(it => it.co === "wecan"));
ok("sumSettle لطرود WeCan = لا شيء (التسوية خاصة بياليدين)", sW.n === 0, sW);
console.log(fail ? "✗ فشل " + fail + " من " + (pass + fail) : "✓ نجح " + pass + " من " + pass);
process.exit(fail ? 1 : 0);
