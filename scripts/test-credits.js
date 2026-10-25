/* اختبار رصيد الأدوات (Credits): نقي بلا متصفح — دفتر، خصم/استرداد، bundle، استرداد جزئي، تعطيل خارج موقع المالك. تشغيل: node scripts/test-credits.js */
const fs = require("fs"), vm = require("vm"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "assets/js/admin-credits.js"), "utf8");
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("✗", m); } };
function make(cfg, ls) {
  const store = Object.assign({}, ls || {}), toasts = [];
  const ctx = { CONFIG: cfg, console, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, window: { addEventListener() { }, dispatchEvent() { } }, CustomEvent: function () { }, Admin: { toast: m => toasts.push(m) }, setTimeout: () => 0 };
  ctx.window.CustomEvent = ctx.CustomEvent; vm.createContext(ctx);
  vm.runInContext(src + "\nthis.Credits = Credits;", ctx); return { C: ctx.Credits, store, toasts };
}
(async () => {
  // موقع المالك: يبدأ بـ110 (10$)
  let { C, store, toasts } = make({ HUB_SITE: "alyssum" });
  ok(C.on() && C.left() === 110 && C.total() === 110, "بداية 110/110");
  // صورة = 2
  let t = C.take("img"); ok(t.n === 2 && C.left() === 108, "صورة = 2"); t.refund(); ok(C.left() === 110, "استرداد كامل");
  t.refund(); ok(C.left() === 110, "لا استرداد مزدوج");
  // فيديو 5ث = 20، 10ث = 40
  ok(C.cost("video", { dur: 5 }) === 20 && C.cost("video", { dur: 10 }) === 40, "تسعير الفيديو بالثانية");
  ok(C.cost("model3d") === 15 && C.cost("text") === 0, "مجسّم 15 والنص مجاني");
  // نفاد: يرمي NOCREDIT ولا يخصم
  C.set(1, 110); let e = null; try { C.take("img"); } catch (x) { e = x; }
  ok(e && e.code === "NOCREDIT" && C.left() === 1, "رفض عند عدم الكفاية بلا خصم");
  C.set(110, 110);
  // bundle: صفحة 40 مرة واحدة، الاستدعاءات الداخلية لا تخصم
  const r = await C.bundle("صفحة", { n: 40 }, async () => { C.take("img"); C.take("img"); return "x"; });
  ok(r === "x" && C.left() === 70, "bundle يخصم 40 مرة واحدة فقط");
  // فشل bundle → استرداد كامل
  let f = null; try { await C.bundle("صفحة", { n: 40 }, async () => { throw new Error("boom"); }); } catch (x) { f = x; }
  ok(f && C.left() === 70, "فشل bundle يستردّ كامل المبلغ");
  // فشل جزئي: يستردّ 2 أقسام × 4
  try { await C.bundle("صفحة", { n: 40, refundOf: er => er.failed.length * 4 }, async () => { const er = new Error("p"); er.failed = [2, 4]; throw er; }); } catch (x) { }
  ok(C.left() === 38, "استرداد جزئي تناسبي (استُردّ 8 من 40): " + C.left());
  // bundle يُرجع null → استرداد
  C.set(110, 110); await C.bundle("x", { n: 6 }, async () => null); ok(C.left() === 110, "إلغاء المستخدم (null) يستردّ");
  // شحن
  C.set(10, 110); C.topup(110, "10$"); ok(C.left() === 120 && C.total() === 220, "الشحن يزيد المتبقي والإجمالي");
  // chip
  ok(/cr-rem/.test(C.chip("bg")) && !/التكلفة/.test(C.chip("bg")) && /120/.test(C.chip("bg")) && C.chip("studio3d") === "" && C.chip("zz") === "", "سطر «الرصيد المتبقي» بعملة فقط للأدوات المدفوعة وبلا نص التكلفة");
  ok(/4 رصيد لكل ثانية/.test(C.TOOLS.vgen.t) && /40 رصيد للصفحة/.test(C.TOOLS.pagepilot.t) && C.EP.bgn === "st" && C.EP.er === "erase", "نصوص الأسعار ومفاتيح لوحة المحرر");
  // تحذير الاقتراب من النفاد
  ({ C, toasts } = make({ HUB_SITE: "alyssum" })); C.set(21, 100); C.take("img"); ok(toasts.some(m => /على وشك النفاد/.test(m)), "تنبيه ≤20%");
  // موقع عميل: خامل بلا رصيد ولا خصم
  ({ C } = make({})); ok(!C.on(), "خامل خارج موقع المالك"); const n0 = C.take("img"); ok(n0.n === 0, "لا خصم عند التعطيل"); ok(C.chip("bg") === "", "لا شريحة عند التعطيل");
  // تفعيل صريح بوجود المفتاح
  ({ C } = make({}, { alyssum_credits: JSON.stringify({ total: 50, left: 30, log: [] }) })); ok(C.on() && C.left() === 30, "يعمل إن وُجد الدفتر");
  console.log(fail ? "فشل " + fail : "نجح", "—", pass, "فحصاً"); process.exit(fail ? 1 : 0);
})();
