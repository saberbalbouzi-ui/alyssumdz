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
// تجميع «من كشف ياليدين إلى الربح الحقيقي» لكل المنتجات: يطابق الحساب العام للتبويب
{
  const per = { A: { p: { title: "أ" }, units: 3, retUnits: 1, revenue: 9000, delivery: 1500, cogs: 3000, pack: 300, ad: 600, adL: 200, retC: 250 }, B: { p: { title: "ب" }, units: 2, retUnits: 0, revenue: 4000, delivery: 800, cogs: 1000, pack: 200, ad: 400, adL: 0, retC: 0 }, Z: { units: 0, retUnits: 0, revenue: 0, delivery: 0, cogs: 0, pack: 0, ad: 0, adL: 0, retC: 0 } };
  const Kf = { real: 4500, adTotal: 1300, adIdle: 100, adIdleBy: { A: 100 }, refunds: 150, actN: 4, realN: 1, estN: 0, parts: { rev: 13000 } };
  const f = P.flow(per, Kf, { fixed: 0 }), c2 = P.calc(Kf, { days: 30 });
  ok("flow: مجاميع الكشف والتكلفة والمرتجعات", f.units === 5 && f.revenue === 13000 && f.delivery === 2300 && f.net === 10700 && f.cogs === 4000 && f.retC === 250, f);
  ok("flow: الربح بلا إعلان = real+adTotal في الحساب العام والإعلان يشمل الأيام الخاملة", f.pre === 5800 && f.pre === c2.preAds && f.ads === 1300 && f.idle === 100, f);
  ok("flow: الربح الحقيقي يطابق صافي التبويب", f.real === 4500 && f.real === c2.net, [f.real, c2.net]);
  ok("flow: الإنفاق الفعلي والثابت يحلّان محل التقدير", P.flow(per, Kf, { adsApi: 2000, fixed: 300 }).real === 5800 - 2000 - 300, P.flow(per, Kf, { adsApi: 2000, fixed: 300 }));
  ok("flow: قائمة المنتجات مرتبة بالحقيقي وصف بلا نشاط يُستبعد", f.list.length === 2 && f.list[0].slug === "A" && f.list[0].real === 3950 - 900 && f.list[1].real === 1600, f.list);
  ok("flowHtml: بلا بيانات لا شيء، ومعها بطاقة بالنص", P.flowHtml(P.flow({}, {}, {})) === "" && /الربح الحقيقي/.test(P.flowHtml(f)) && /4 طلب/.test(P.flowHtml(f)));
}
console.log(bad ? "✗ فشل " + bad + " من " + n : "✓ " + n + " فحصاً ناجحاً"); process.exit(bad ? 1 : 0);
