/* اختبار المنطق النقي للربح الحقيقي: node scripts/test-profit.js */
const P = require("../assets/js/admin-profit.js");
let n = 0, bad = 0; const ok = (name, c, x) => { n++; if (!c) { bad++; console.log("✗", name, x === undefined ? "" : JSON.stringify(x)); } };
// K كما يعيدها computeFinance: K.real يحمل الإعلان المُقدَّر (adTotal)؛ الربح قبل الإعلان = real + adTotal
const K = { real: 3000, adTotal: 2000, refunds: 500, delivered: 10, failed: 5, open: 2, exp: 900, parts: { rev: 20000, cogs: 8000, del: 3000, pack: 500, retLoss: 3500 } };
const c = P.calc(K, { days: 30, adsApi: null, fixedMonthly: 0 });
ok("قبل الإعلان = real + adTotal",c.preAds === 5000,c.preAds);
ok("بلا ربط: الإعلان تقدير K.adTotal والصافي يطابق K.real", c.ads === 2000 && !c.hasApi && c.net === 3000, c);
const d = P.calc(K, { days: 30, adsApi: 6500, fixedMonthly: 3000 });
ok("بعد الربط: الإعلان الفعلي يحل محل التقدير والثابت يُطرح", d.hasApi && d.ads === 6500 && d.fixed === 3000 && d.net === 5000 - 6500 - 3000, d);
ok("الثابت يتناسب مع الفترة (7 أيام)", P.calc(K, { days: 7, fixedMonthly: 3000 }).fixed === 700);
ok("نسبة التسليم والـROAS وCPA والصافي لكل طلب", d.rate === 66.7 && d.roas === 3.08 && d.cpa === 650 && d.perOrder === Math.round(d.net / 10), d);
ok("الشلال: 8 خطوات والإعلان فيه سالب بالقيمة الفعلية",d.steps.length === 8 && d.steps[6][1] === -6500 && d.steps[7][1] === -3000 && d.steps[0][1] === 20000, d.steps.map(s => s[1]));
const z = P.calc({ real: 0, adTotal: 0, parts: {} }, {});
ok("بلا بيانات: أصفار بلا NaN", z.net === 0 && z.rate === 0 && z.roas === 0 && z.cpa === 0 && z.perOrder === 0 && z.margin === 0, z);
const sp = P.spendBy([{ day: "2026-10-01", campaign_name: "Summer-A", spend_dzd: 1000, clicks: 10, impressions: 100, provider: "meta" }, { day: "2026-10-01", campaign_name: "Summer-A", spend_dzd: 500, provider: "meta" }, { day: "2026-10-02", campaign_name: "Other", spend_dzd: 300, provider: "tiktok" }]);
ok("spendBy: مجاميع اليوم والحملة مرتبة", sp.day["2026-10-01"] === 1500 && sp.camp[0].name === "Summer-A" && sp.camp[0].spend === 1500 && sp.camp[0].clicks === 10 && sp.camp.length === 2, sp);
const cm = P.campaigns({ "summer a": { n: 4, ok: 3, ko: 1, rev: 9000, pre: 4000 }, "—": { n: 2, ok: 2, ko: 0, rev: 3000, pre: 1500 }, zzz: { n: 1, ok: 0, ko: 1, rev: 0, pre: -400 } }, sp.camp);
ok("campaigns: مطابقة بالاسم المطبَّع وطرح الإنفاق من الصافي", cm.rows.find(r => r.name === "summer a").spend === 1500 && cm.rows.find(r => r.name === "summer a").net === 2500 && cm.rows.find(r => r.name === "summer a").matched, cm.rows);
ok("campaigns: إنفاق بلا طلبات منسوبة يظهر يتيماً، والحملة غير المطابقة لا تأخذ إنفاقاً", cm.orphanSpend === 300 && cm.rows.find(r => r.name === "zzz").spend === 0 && cm.rows.find(r => r.raw).name === "بلا حملة محدّدة", cm);
ok("ترتيب الحملات بالصافي تنازلياً", cm.rows[0].net >= cm.rows[1].net && cm.rows[1].net >= cm.rows[2].net, cm.rows.map(r => r.net));
console.log(bad ? "✗ فشل " + bad + " من " + n : "✓ " + n + " فحصاً ناجحاً"); process.exit(bad ? 1 : 0);
