/* قارئ تعريفة Ecotrack (GET /api/v1/get/fees) على الشكل الرسمي من وثيقة الشركة: node scripts/test-ecotrack-fees.js */
const fs = require("fs"), vm = require("vm");
const src = fs.readFileSync(__dirname + "/../admin.html", "utf8"), i = src.indexOf("function parseTarifRows"), j = src.indexOf("function ecotrackCompany");
if (i < 0 || j < 0) { console.log("✗ لم تُوجد الدالة"); process.exit(1); }
const ctx = {}; vm.createContext(ctx); vm.runInContext(src.slice(i, j) + "\nthis.parse = parseTarifRows;", ctx);
let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
const row = (id, t, s) => ({ wilaya_id: id, tarif: String(t), tarif_stopdesk: String(s) });
/* ترتيب مفاتيح يضع «retours» و«pickup» قبل «livraison» لاختبار أن القراءة لا تتأثر بالترتيب */
const doc = { retours: [row(1, 200, 200), row(12, 150, 150)], pickup: [row(1, 999, 999), row(12, 888, 0)], echnage: [row(1, 777, 777)], livraison: [row(1, 1300, 900), row(2, 850, 450), row(12, 900, 0), row(16, 450, 300), row(58, 1000, 0)], recouvrement: [row(1, 666, 666)] };
const r = ctx.parse(doc);
ok("تُقرأ «livraison» وحدها: الولاية 1 = 1300 منزل / 900 مكتب", r[1] && r[1].home === 1300 && r[1].stop === 900, r[1]);
ok("tarif_stopdesk = 0 ⇒ لا مكتب (stop = 0): الولاية 12", r[12] && r[12].home === 900 && r[12].stop === 0, r[12]);
ok("لا تتسرّب أسعار pickup/retours/echnage/recouvrement", r[1].home !== 999 && r[1].home !== 200 && r[1].home !== 777 && r[1].home !== 666);
ok("ولايات الجدول كلها مقروءة (5)", Object.keys(r).length === 5, Object.keys(r));
ok("شكل قديم/مختلف (مصفوفة مباشرة) ما زال يُقرأ", ctx.parse([row(5, 900, 500)])[5].stop === 500);
console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); process.exit(fail ? 1 : 0);
