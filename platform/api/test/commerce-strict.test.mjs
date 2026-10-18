/* التحقق الصارم من الأسعار (المرحلتان 0 و1): حساب خادمي، وضع الظل (بلا رفض)، الرفض المحصور بالنطاق، مهلة السعر القديم، وبوابة الدفع اليدوي. */
import { makeEnv, Tally } from "./_harness.mjs";
import { commerce, priceOrder, strictScope } from "../src/modules/commerce.js";
import { payments } from "../src/modules/payments.js";
import { strictCfg, hmacHex } from "../src/util.js";
const { ok, done } = Tally();
const E = makeEnv([commerce, payments]); const { call, adm, tenant, app, sql, sqlAll, clock } = E;

/* ───── نقي: strictCfg / strictScope ───── */
ok("strictCfg: الافتراضي مطفأ", strictCfg(undefined).on === false && strictCfg({}).on === false && strictCfg({ strict: { on: "yes" } }).on === false);
ok("strictCfg: on بلا shadow صريح = ظل بلا رفض", strictCfg({ strict: { on: true } }).shadow === true && strictCfg({ strict: { on: true } }).reject === false);
ok("strictCfg: الرفض لا يُفعَّل إلا بـshadow:false صريحة", strictCfg({ strict: { on: true, shadow: false } }).reject === true && strictCfg({ strict: { on: true, shadow: 0 } }).reject === false);
ok("strictCfg: slugs وgrace_min منظّفة ومحصورة", JSON.stringify(strictCfg({ strict: { on: true, slugs: ["a", 5, "", "b"], grace_min: 999 } }).slugs) === '["a","b"]' && strictCfg({ strict: { on: true, grace_min: 999 } }).grace_min === 60 && strictCfg({ strict: { on: true, grace_min: -5 } }).grace_min === 1 && strictCfg({ strict: { on: true } }).grace_min === 10);
const SC = strictCfg({ strict: { on: true } }), L1 = [{ slug: "ebook" }], L2 = [{ slug: "honey" }];
ok("نطاق: رقمي", strictScope(SC, { pay: "", lines: L1, digital: { ebook: true } }) === "digital");
ok("نطاق: دفع مسبق", strictScope(SC, { pay: "ccp", lines: L2, digital: {} }) === "prepaid");
ok("نطاق: الدفع عند الاستلام خارج النطاق", strictScope(SC, { pay: "cod", lines: L2, digital: {} }) === "out" && strictScope(SC, { pay: "", lines: L2, digital: {} }) === "out");
ok("نطاق: slugs فارغة افتراضياً ولا تضيف tarkiz", strictScope(SC, { pay: "cod", lines: [{ slug: "tarkiz" }], digital: {} }) === "out");
ok("نطاق: slugs صريحة", strictScope(strictCfg({ strict: { on: true, slugs: ["x"] } }), { pay: "cod", lines: [{ slug: "x" }], digital: {} }) === "slugs");
ok("نطاق: pay:false يُخرج الدفع المسبق", strictScope(strictCfg({ strict: { on: true, pay: false } }), { pay: "ccp", lines: L2, digital: {} }) === "out");

/* ───── نقي: priceOrder ───── */
const sku = (slug, price, o = {}) => ({ slug, vkey: "", price, stock: 5, active: true, pActive: 1, freeShip: false, ...o });
const SK = { "honey\0": sku("honey", 2400), "ebook\0": sku("ebook", 1500), "free\0": sku("free", 1000, { freeShip: true }), "cream\0": sku("cream", 1500), "cream\0l": sku("cream", 2500, { vkey: "l" }), "off\0": sku("off", 900, { active: false }), "zero\0": sku("zero", 0), "bad\0": sku("bad", 500) };
const OF = { honey: [{ qty: 2, price: 4550, free: 0 }, { qty: 3, price: 4800, free: 1 }], ebook: [], free: [], cream: [{ qty: 2, price: 2800, free: 0 }], off: [], zero: [], bad: null };
const DIG = { ebook: true };
const P = (lines, o = {}) => { const ls = lines.map(([slug, qty, unit, vkey = "", rawQty]) => ({ slug, vkey, qty: Math.round(qty), rawQty: rawQty ?? qty, unit })); const sub = o.subtotal ?? ls.reduce((a, l) => a + Math.round(l.unit * l.qty), 0); return priceOrder({ lines: ls, skus: SK, offers: OF, digital: DIG, subtotal: sub, discount: 0, fee: 0, total: sub - (o.discount ?? 0) + (o.fee ?? 0), coupon: "", couponRow: null, now: 1000, ...o }); };
const R = (r, x) => r.reasons.some((y) => y.split(":")[0] === x);
ok("رقمي سليم: بلا أسباب والمجموع من الخادم", P([["ebook", 1, 1500]]).ok && P([["ebook", 1, 1500]]).total === 1500);
ok("سعر معدَّل", R(P([["ebook", 1, 100]]), "price_mismatch"));
ok("كمية 2 بعرض الاثنين تقبل", P([["honey", 2, 2275]], { fee: 600, total: 5150 }).reasons.length === 1 && R(P([["honey", 2, 2275]], { fee: 600 }), "fee_unverifiable"));
ok("وحدة عرض لكمية أخرى (5 × سعر عرض الاثنين) ترفض — كانت تُقبل في القاعدة المخفَّفة", R(P([["honey", 5, 2275]]), "price_mismatch"));
ok("كمية 3 بسعر عرض الثلاثة (يشمل الهدية)", !R(P([["honey", 3, 4800 / 3]]), "price_mismatch"));
ok("كمية 3 بسعر عرض الاثنين مرفوضة", R(P([["honey", 3, 2275]]), "price_mismatch"));
ok("كمية كسرية", R(P([["ebook", 2, 750, "", 1.5]]), "qty_fractional") && R(P([["ebook", 1, 1500, "", NaN]]), "qty_fractional") && R(P([["ebook", 1, 1500, "", "1"]]), "qty_fractional"));
ok("كمية صفر أو سالبة أو ضخمة", R(P([["ebook", 0, 1500]]), "qty_invalid") && R(P([["ebook", -2, 1500]]), "qty_invalid") && R(P([["ebook", 1000, 1500]]), "qty_invalid"));
ok("منتج مجهول ومعطّل", R(P([["nope", 1, 1]]), "unknown_product") && R(P([["off", 1, 900]]), "inactive"));
ok("بيانات منتج غير صالحة: عروض تالفة أو سعر صفر", R(P([["bad", 1, 500]]), "catalog_invalid") && R(P([["zero", 1, 0]]), "catalog_invalid"));
ok("تنويع: عرضه يُضرب بنسبة سعره", !R(P([["cream", 2, 2800 * (2500 / 1500) / 2, "l"]]), "price_mismatch") && R(P([["cream", 2, 1400, "l"]]), "price_mismatch"));
ok("مجموع فرعي لا يطابق", R(P([["ebook", 1, 1500]], { subtotal: 900, total: 900 }), "subtotal_mismatch"));
ok("إجمالي لا يطابق", R(P([["ebook", 1, 1500]], { total: 1000 }), "total_mismatch"));
const CP = { type: "percent", value: 10, min: 1000, active: 1, from_at: null, to_at: null };
ok("خصم بلا كود", R(P([["ebook", 1, 1500]], { discount: 100 }), "discount_unverified") && P([["ebook", 1, 1500]], { discount: 100 }).discount === 0);
ok("خصم بكود غير معروف (شخصي/مقيّد) غير قابل للإثبات", R(P([["ebook", 1, 1500]], { discount: 150, coupon: "VIP", couponRow: null }), "discount_unverified"));
ok("كود نسبة صحيح", P([["ebook", 1, 1500]], { discount: 150, coupon: "RAM", couponRow: CP }).ok && P([["ebook", 1, 1500]], { discount: 150, coupon: "RAM", couponRow: CP }).total === 1350);
ok("خصم أكبر من الكود", R(P([["ebook", 1, 1500]], { discount: 900, coupon: "RAM", couponRow: CP }), "discount_mismatch"));
ok("كود تحت الحدّ الأدنى أو منتهٍ أو معطّل", R(P([["ebook", 1, 1500]], { discount: 150, coupon: "RAM", couponRow: { ...CP, min: 5000 } }), "coupon_invalid") && R(P([["ebook", 1, 1500]], { discount: 150, coupon: "RAM", couponRow: { ...CP, to_at: 10 } }), "coupon_invalid") && R(P([["ebook", 1, 1500]], { discount: 150, coupon: "RAM", couponRow: { ...CP, active: 0 } }), "coupon_invalid"));
ok("كود ثابت يُقصّ بالمجموع", P([["ebook", 1, 1500]], { discount: 300, coupon: "F", couponRow: { ...CP, type: "fixed", value: 300 } }).ok);
ok("رقمي برسم توصيل", R(P([["ebook", 1, 1500]], { fee: 400 }), "fee_mismatch"));
ok("مادي: الرسم غير قابل للإثبات", R(P([["honey", 1, 2400]], { fee: 600 }), "fee_unverifiable") && R(P([["honey", 1, 2400]], { fee: 0 }), "fee_unverifiable"));
ok("رسم خارج النطاق", R(P([["honey", 1, 2400]], { fee: 9000 }), "fee_out_of_range"));
ok("شحن مجاني للمنتج: الرسم صفر قابل للإثبات", P([["free", 1, 1000]]).ok && R(P([["free", 1, 1000]], { fee: 500 }), "fee_mismatch"));
ok("كود توصيل مجاني صالح يثبت الرسم صفراً", P([["honey", 1, 2400]], { coupon: "SHIP", couponRow: { ...CP, type: "freeship", min: 0 } }).ok);
ok("خلط رقمي ومادي: الرسم غير قابل للإثبات", R(P([["ebook", 1, 1500], ["honey", 1, 2400]], { fee: 0 }), "fee_unverifiable"));
const H = { "ebook\0": { old: 1200, new: 1500, at: 900 } };
const G = (o) => P([["ebook", o.q ?? 1, o.u ?? 1200]], { hist: o.hist ?? H, graceS: 600, now: o.now ?? 1000 });
ok("مهلة: سعر قديم ضمن المهلة يُقبل بملاحظة", G({}).ok && G({}).notes[0] === "grace_old_price:ebook" && G({}).total === 1200);
ok("مهلة: منتهية", R(G({ now: 1600 }), "price_mismatch") && R(G({ now: 1500 }), "price_mismatch") === false);
ok("مهلة: لا تُقبل إن لم يعد الجديد هو سعر الـSKU الحالي", R(G({ hist: { "ebook\0": { old: 1200, new: 1400, at: 900 } } }), "price_mismatch"));
ok("مهلة: سجلّ من المستقبل مرفوض", R(G({ hist: { "ebook\0": { old: 1200, new: 1500, at: 5000 } } }), "price_mismatch"));
ok("مهلة: سعر ثالث لا هو القديم ولا الحالي", R(G({ u: 1000 }), "price_mismatch"));
ok("مهلة: لا تتجاوز تحقق الكمية", R(G({ q: 0 }), "qty_invalid") && R(P([["ebook", 1, 1200, "", 1.2]], { hist: H, graceS: 600, now: 1000 }), "qty_fractional"));
ok("مهلة: لا تمسّ العروض (سعر عرض قديم لا يُقبل)", R(P([["honey", 2, 2100]], { hist: { "honey\0": { old: 2100, new: 2400, at: 900 } }, graceS: 600, now: 1000, fee: 0 }), "price_mismatch") === false /* السعر الأساسي القديم × الكمية مقبول */ && R(P([["honey", 2, 2000]], { hist: { "honey\0": { old: 2100, new: 2400, at: 900 } }, graceS: 600, now: 1000 }), "price_mismatch"));
ok("مهلة: غياب سجلّ التنويع لا يستعير سجلّ الأساسي", R(P([["cream", 1, 1000, "l"]], { hist: { "cream\0": { old: 1000, new: 1500, at: 900 } }, graceS: 600, now: 1000 }), "price_mismatch"));

/* ───── تكامل ───── */
const A = await tenant("A-shadow"), B = await tenant("B-default"), C = await tenant("C-reject"), D = await tenant("D-reject-other");
const prods = (extra = {}) => ({ products: [
  { slug: "honey", title: "عسل", price: 2400, stock: 5, offers: [{ qty: 1, price: 2400, free: 0 }, { qty: 2, price: 4550, free: 0 }, { qty: 3, price: 4800, free: 1 }], digital: false },
  { slug: "ebook", title: "كتاب", price: 1500, stock: null, digital: true, ...extra },
  { slug: "tarkiz", title: "تركيز", price: 1800, stock: 9, offers: [{ qty: 1, price: 1800, free: 0 }, { qty: 3, price: 3200, free: 1 }], digital: false },
  { slug: "free", title: "مجاني الشحن", price: 1000, stock: 9, freeShip: true },
] });
const cps = { coupons: [{ code: "ramadan", type: "percent", value: 10, min: 1000 }, { code: "SHIP", type: "freeship" }] };
const origins = ["https://shop.example"];
const setStrict = (T, strict) => adm("PATCH", `/admin/tenants/${T.id}`, { settings: { origins, ...(strict ? { strict } : {}) } });
for (const T of [A, B, C, D]) { await call("PUT", "/v1/catalog/products", prods(T === D ? { price: 1600 } : {}), T.key); await call("PUT", "/v1/catalog/coupons", cps, T.key); }
await setStrict(A, { on: true }); await setStrict(C, { on: true, shadow: false }); await setStrict(D, { on: true, shadow: false });
let n = 0; const ref = () => "S-" + (++n) + "-" + Math.random().toString(36).slice(2, 8);
const ord = (o = {}) => ({ ref: ref(), customer: { name: "أمين", phone: "0551234567" }, wilaya: "Alger", commune: "Kouba", dtype: "home", items: [{ slug: "ebook", qty: 1, price: 1500 }], subtotal: 1500, discount: 0, fee: 0, total: 1500, pay: "baridimob", customer_email: "", ...o });
const send = (T, o) => call("POST", "/v1/orders", o, T.key);
const calc = (T, r) => sql("SELECT * FROM cm_calc WHERE tenant_id=? AND ref=?", T.id, r);
const tampered = () => ord({ items: [{ slug: "ebook", qty: 1, price: 10 }], subtotal: 10, total: 10 });
let c, b, o;

/* افتراضي (B): لا حساب ولا سجلّ، والمُعدَّل يُقبل كما كان */
o = tampered(); [c, b] = await send(B, o); ok("افتراضي: طلب معدَّل السعر يُقبل في observe بعلامة كما كان", c === 201 && b.verified === false && b.mode === "observe", b);
ok("افتراضي: لا cm_calc ولا تأثير", sqlAll("SELECT * FROM cm_calc WHERE tenant_id=?", B.id).length === 0);
o = ord(); [c, b] = await send(B, o); ok("افتراضي: الطلب السليم كما كان", c === 201 && b.verified === true);

/* وضع الظل (A): يسجّل فقط */
o = tampered(); [c, b] = await send(A, o); ok("ظل: الطلب المعدَّل يُقبل ولا يُرفض أبداً", c === 201 && b.mode === "observe", b);
let k = calc(A, o.ref); ok("ظل: القرار المتوقع would_reject بالأسباب والمجموع الخادمي", k && k.decision === "would_reject" && k.scope === "digital" && JSON.parse(k.reasons)[0] === "price_mismatch:ebook" && k.expected === 1500 && k.client === 10 && k.trusted === 0, k);
ok("ظل: القيم المخزَّنة هي قيم العميل (لا تغيير سلوك)", sql("SELECT total t, subtotal s FROM cm_orders WHERE ref=?", o.ref).t === 10);
ok("ظل: الحدث لا يحمل توقيع الثقة", !JSON.parse(sql("SELECT payload d FROM pf_events WHERE ext_id=?", "order.created:" + o.ref).d).ts);
o = ord(); [c, b] = await send(A, o); k = calc(A, o.ref); ok("ظل: الطلب السليم accept", c === 201 && k.decision === "accept" && k.reasons === "[]" && k.trusted === 0, k);
o = ord({ items: [{ slug: "honey", qty: 1.5, price: 2400 }], subtotal: 3600, total: 4200, fee: 600, pay: "cod" }); [c] = await send(A, o); k = calc(A, o.ref); ok("ظل: كمية كسرية تُسجَّل ولا تُرفض", c === 201 && k.scope === "out" && JSON.parse(k.reasons).some((r) => r.startsWith("qty_fractional")), k);
o = ord({ items: [{ slug: "tarkiz", qty: 3, price: 3200 / 3 }], subtotal: 3200, fee: 600, total: 3800, pay: "cod" }); [c] = await send(A, o); k = calc(A, o.ref); ok("ظل: tarkiz بالدفع عند الاستلام خارج النطاق (لا يُرفض ولا يُحتسب ضمنه)", c === 201 && k.scope === "out" && k.decision === "would_reject" && JSON.parse(k.reasons).join() === "fee_unverifiable", k);
o = ord({ items: [{ slug: "honey", qty: 1, price: 2400 }], subtotal: 2400, fee: 600, total: 3000, pay: "ccp" }); [c] = await send(A, o); k = calc(A, o.ref); ok("ظل: مادي بدفع مسبق ضمن النطاق: رسم غير قابل للإثبات", c === 201 && k.scope === "prepaid" && JSON.parse(k.reasons).join() === "fee_unverifiable");
const pii = JSON.stringify(sqlAll("SELECT * FROM cm_calc WHERE tenant_id=?", A.id));
ok("ظل: لا بيانات شخصية ولا أكواد في cm_calc", !/0551234567|أمين|Kouba|Alger|@/.test(pii));
ok("ظل: لا حجز للمخزون ولا قيمة سالبة", sql("SELECT stock s FROM cm_skus WHERE tenant_id=? AND slug='honey' AND vkey=''", A.id).s === 5);
[c, b] = await send(A, ord({ ref: o.ref })); ok("ظل: ref مكرر لا يضيف سجلاً", b.duplicate === true && sqlAll("SELECT * FROM cm_calc WHERE tenant_id=? AND ref=?", A.id, o.ref).length === 1);
[c, b] = await call("GET", "/v1/orders/strict-report", null, A.key, { days: "7" });
ok("تقرير الظل: أعداد ومعدلات وأسباب بلا بيانات شخصية", c === 200 && b.total === 5 && b.would_reject === 4 && b.in_scope === 3 && b.by_reason.price_mismatch === 1 && b.by_reason.fee_unverifiable === 3 && b.by_reason.qty_fractional === 1 && b.tamper_like === 1 && b.likely_legit === 3 && b.strict.reject === false && !/0551234567|أمين/.test(JSON.stringify(b)), b);
[c, b] = await call("GET", "/v1/orders/strict-report", null, B.key); ok("تقرير مستأجر افتراضي فارغ", c === 200 && b.total === 0 && b.strict.on === false);
[c, b] = await call("GET", "/v1/orders/strict-report", null, C.key); ok("عزل: تقرير C لا يرى سجلات A", b.total === 0);

/* الرفض (C): في النطاق فقط */
o = tampered(); [c, b] = await send(C, o); ok("رفض: رقمي بسعر معدَّل 422 برسالة عربية واضحة", c === 422 && b.error.code === "order_rejected" && /السعر/.test(b.error.message) && b.error.fields.flags[0] === "price_mismatch:ebook", b);
ok("رفض: لا طلب ولا حدث ولا حجز", sqlAll("SELECT * FROM cm_orders WHERE tenant_id=? AND ref=?", C.id, o.ref).length === 0 && sqlAll("SELECT * FROM pf_events WHERE ext_id=?", "order.created:" + o.ref).length === 0);
ok("رفض: مسجَّل في cm_calc كـreject", calc(C, o.ref).decision === "reject");
o = ord({ items: [{ slug: "ebook", qty: 1.5, price: 1000 }], subtotal: 1500, total: 1500 }); [c, b] = await send(C, o); ok("رفض: كمية كسرية", c === 422 && /الكمية/.test(b.error.message), b);
o = ord({ items: [{ slug: "ebook", qty: 1, price: 1500 }], discount: 200, total: 1300 }); [c, b] = await send(C, o); ok("رفض: خصم غير قابل للإثبات برسالة واضحة", c === 422 && /الخصم/.test(b.error.message) && b.error.fields.flags.includes("discount_unverified"), b);
o = ord({ items: [{ slug: "ebook", qty: 1, price: 1500 }], discount: 150, total: 1350, coupon: "RAMADAN" }); [c, b] = await send(C, o); ok("قبول: كود معروف بخصمه الصحيح", c === 201, b);
o = ord({ items: [{ slug: "ebook", qty: 1, price: 1500 }], discount: 900, total: 600, coupon: "RAMADAN" }); [c, b] = await send(C, o); ok("رفض: خصم أكبر من الكود", c === 422 && b.error.fields.flags.includes("discount_mismatch"), b);
o = ord({ items: [{ slug: "ebook", qty: 1, price: 1500 }], fee: 400, total: 1900 }); [c, b] = await send(C, o); ok("رفض: رسم توصيل على منتج رقمي", c === 422 && b.error.fields.flags.includes("fee_mismatch"), b);
o = ord({ items: [{ slug: "ebook", qty: 1, price: 1500 }], total: 900 }); [c, b] = await send(C, o); ok("رفض: إجمالي لا يطابق", c === 422 && b.error.fields.flags.includes("total_mismatch"), b);
o = ord({ items: [{ slug: "honey", qty: 1, price: 2400 }], subtotal: 2400, fee: 600, total: 3000, pay: "ccp" }); [c, b] = await send(C, o); ok("رفض: مادي بدفع مسبق ورسم غير قابل للإثبات", c === 422 && /رسوم التوصيل/.test(b.error.message), b);
o = ord({ items: [{ slug: "free", qty: 1, price: 1000 }], subtotal: 1000, fee: 0, total: 1000, pay: "ccp" }); [c, b] = await send(C, o); ok("قبول: مادي بشحن مجاني قابل للإثبات", c === 201, b);
o = ord({ items: [{ slug: "tarkiz", qty: 3, price: 3200 / 3 }], subtotal: 3200, fee: 600, total: 3800, pay: "cod" }); [c, b] = await send(C, o); ok("خارج النطاق (دفع عند الاستلام) يبقى كالسابق حتى بوضع الرفض", c === 201 && b.verified === true, b);
o = ord({ items: [{ slug: "tarkiz", qty: 1, price: 5 }], subtotal: 5, fee: 600, total: 605, pay: "cod" }); [c, b] = await send(C, o); ok("خارج النطاق: السعر المعدَّل يبقى observe (لا رفض) — لا مساس بمسار tarkiz", c === 201 && b.verified === false, b);
/* الطلب السليم: القيم من الخادم + توقيع الثقة */
o = ord({ items: [{ slug: "ebook", qty: 1, price: 1500.4 }], subtotal: 1500, total: 1500 }); [c, b] = await send(C, o);
const stored = sql("SELECT total t, subtotal s, discount d, fee f FROM cm_orders WHERE ref=?", o.ref); k = calc(C, o.ref);
ok("قبول: القيم المخزَّنة هي حساب الخادم والسجلّ trusted", c === 201 && stored.t === 1500 && stored.f === 0 && k.trusted === 1 && k.decision === "accept", { stored, k });
const evd = JSON.parse(sql("SELECT payload d FROM pf_events WHERE ext_id=?", "order.created:" + o.ref).d); ok("الحدث يحمل توقيع HMAC للمجموع الخادمي", evd.ts === await hmacHex("unit-test-secret-0123456789", `trust:${C.id}:${o.ref}:1500`), evd);
await app.cron(); ok("pay_expect بمستوى 2 (مجموع خادمي موثوق)", sql("SELECT verified v, amount a FROM pay_expect WHERE tenant_id=? AND order_id=?", C.id, o.ref)?.v === 2);

/* بوابة الدفع اليدوي */
const JPG = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(40).fill(1)]).toString("base64");
const proof = (T, oid) => call("POST", "/v1/payments/proof", { order_id: oid, method: "ccp", proof: JPG }, T.key);
[c, b] = await proof(C, o.ref); ok("إثبات دفع لطلب مجموعه خادمي موثوق يُقبل", c === 201, b);
/* طلب مزوَّر عبر /v1/events بمبلغ تافه */
const forge = async (T, oid, extra = {}) => { await call("POST", "/v1/events", { type: "order.created", id: oid, data: { order_id: oid, total: 1, pay: "ccp", verified: true, ...extra } }, T.key); await app.cron(); };
await forge(C, "FORGED-001"); ok("حدث مزوَّر verified:true يصير مستوى 1 فقط", sql("SELECT verified v FROM pay_expect WHERE tenant_id=? AND order_id=?", C.id, "FORGED-001")?.v === 1);
[c, b] = await proof(C, "FORGED-001"); ok("الصارم: إثبات لمبلغ غير موثوق مرفوض 409", c === 409 && b.error.code === "amount_unverified", b);
await forge(C, "FORGED-002", { ts: "00".repeat(32) }); [c, b] = await proof(C, "FORGED-002"); ok("الصارم: توقيع ثقة مزوَّر لا يرفع المستوى", c === 409 && sql("SELECT verified v FROM pay_expect WHERE tenant_id=? AND order_id=?", C.id, "FORGED-002").v === 1, b);
await forge(C, "FORGED-003", { ts: await hmacHex("unit-test-secret-0123456789", `trust:${C.id}:FORGED-003:999`) }); [c] = await proof(C, "FORGED-003"); ok("توقيع لمجموع آخر لا يصلح", c === 409 && sql("SELECT verified v FROM pay_expect WHERE tenant_id=? AND order_id=?", C.id, "FORGED-003").v === 1);
await forge(A, "FORGED-004"); [c] = await proof(A, "FORGED-004"); ok("مستأجر الظل: سلوك الدفع كما كان (الإثبات مقبول)", c === 201);
await forge(B, "FORGED-005"); [c] = await proof(B, "FORGED-005"); ok("مستأجر افتراضي: سلوك الدفع كما كان (الإثبات مقبول)", c === 201);
const pubK = (await adm("POST", `/admin/tenants/${C.id}/keys`, { scopes: ["payment:init"], mode: "pub" }))[1].key;
[c] = await call("POST", "/v1/payments/pay", { order_id: "FORGED-001", method: "edahabia", return_url: "https://shop.example/x" }, pubK, {}, { origin: "https://shop.example" }); ok("الصارم: الدفع الإلكتروني لمبلغ غير موثوق 404", c === 404);

/* الطلب المدفوع مسبقاً من مستأجر C لا يُفلت عبر حلّ ثانٍ: ref قديم */
/* مهلة السعر القديم عبر المزامنة */
await call("PUT", "/v1/catalog/products", prods({ price: 1700 }), C.key);
ok("مزامنة تغيير السعر تكتب سجلاً موقَّعاً", sqlAll("SELECT * FROM cm_price_hist WHERE tenant_id=? AND slug='ebook'", C.id).length === 1);
await call("PUT", "/v1/catalog/products", prods({ price: 1700 }), C.key); ok("مزامنة بلا تغيير لا تضيف سجلاً", sqlAll("SELECT * FROM cm_price_hist WHERE tenant_id=? AND slug='ebook'", C.id).length === 1);
o = ord({ items: [{ slug: "ebook", qty: 1, price: 1500 }] }); [c, b] = await send(C, o); k = calc(C, o.ref);
ok("مهلة: السعر القديم ضمن 10 دقائق يُقبل بحسابه القديم وملاحظة", c === 201 && sql("SELECT total t FROM cm_orders WHERE ref=?", o.ref).t === 1500 && JSON.parse(k.notes)[0] === "grace_old_price:ebook", { c, k });
o = ord({ items: [{ slug: "ebook", qty: 2, price: 1500 }], subtotal: 3000, total: 3000 }); [c] = await send(C, o); ok("مهلة: كمية 2 بالسعر القديم (أساسي × الكمية) تُقبل", c === 201);
o = ord({ items: [{ slug: "ebook", qty: 1.5, price: 1500 }], subtotal: 2250, total: 2250 }); [c, b] = await send(C, o); ok("مهلة: لا تتجاوز تحقق الكمية الكسرية", c === 422 && b.error.fields.flags[0].startsWith("qty_fractional"), b);
o = ord({ items: [{ slug: "ebook", qty: 1, price: 1500 }] }); [c, b] = await send(D, o); ok("عزل: سجلّ مستأجر آخر لا يمنح مهلة (D سعرها 1600 وبلا سجلّ)", c === 422, b);
E.db.prepare("UPDATE cm_price_hist SET old_price=1 WHERE tenant_id=?").run(C.id);
o = ord({ items: [{ slug: "ebook", qty: 1, price: 1 }], subtotal: 1, total: 1 }); [c] = await send(C, o); ok("سجلّ عُبث به (توقيع لا يطابق) لا يمنح مهلة", c === 422);
E.db.prepare("UPDATE cm_price_hist SET old_price=1500 WHERE tenant_id=?").run(C.id);
o = ord({ items: [{ slug: "ebook", qty: 1, price: 1500 }] }); [c] = await send(C, o); ok("وبعد إعادة القيمة الأصلية يعود التوقيع صحيحاً", c === 201);
clock.t += 11 * 60 * 1000; o = ord({ items: [{ slug: "ebook", qty: 1, price: 1500 }] }); [c] = await send(C, o); ok("بعد انقضاء المهلة يُرفض السعر القديم", c === 422);
clock.t -= 11 * 60 * 1000;

/* بيانات منتج غير صالحة في القاعدة */
E.db.prepare("UPDATE cm_products SET offers='{bad json' WHERE tenant_id=? AND slug='honey'").run(B.id);
o = ord({ items: [{ slug: "honey", qty: 1, price: 2400 }], subtotal: 2400, fee: 600, total: 3000, pay: "cod" }); [c, b] = await send(B, o); ok("افتراضي: عروض تالفة لا تسبب 500 (كانت JSON.parse يرمي)", c === 201, b);
E.db.prepare("UPDATE cm_products SET offers='{bad json' WHERE tenant_id=? AND slug='honey'").run(C.id);
o = ord({ items: [{ slug: "honey", qty: 1, price: 2400 }], subtotal: 2400, fee: 600, total: 3000, pay: "ccp" }); [c, b] = await send(C, o); ok("صارم: بيانات منتج تالفة ترفض بسبب catalog_invalid", c === 422 && b.error.fields.flags.some((f) => f.startsWith("catalog_invalid")), b);
E.db.prepare("UPDATE cm_skus SET price=0 WHERE tenant_id=? AND slug='ebook'").run(C.id);
o = ord({ items: [{ slug: "ebook", qty: 1, price: 0 }], subtotal: 0, total: 0 }); [c, b] = await send(C, o); ok("صارم: سعر صفر في الكتالوج لا يُقبل", c === 422, b);

/* بدون كتالوج متزامن */
const F = await tenant("F-empty"); await setStrict(F, { on: true, shadow: false });
o = ord(); [c, b] = await send(F, o); ok("صارم بلا كتالوج: منتج مجهول بدفع مسبق يُرفض (داخل النطاق) ولا يُقبل بصمت", c === 422 && b.error.fields.flags[0].startsWith("unknown_product"), b);

/* المتصفح القديم لا يرسل digital: لا يتغيّر شيء */
const Gt = await tenant("G-old-sync"); await setStrict(Gt, { on: true, shadow: false });
await call("PUT", "/v1/catalog/products", { products: [{ slug: "ebook", title: "كتاب", price: 1500 }] }, Gt.key);
[c, b] = await send(Gt, { ...tampered(), pay: "cod" }); ok("مزامنة بلا علم digital + دفع عند الاستلام: خارج النطاق ⇒ سلوك observe كما كان", c === 201 && b.verified === false, b);
[c, b] = await send(Gt, ord()); ok("مزامنة بلا علم digital + دفع مسبق: داخل النطاق والرسم غير قابل للإثبات ⇒ يُرفض (لذا يلزم علم digital قبل تفعيل الرفض)", c === 422 && b.error.fields.flags.includes("fee_unverifiable"), b);
/* وضع الظل يُحوَّل إلى رفض فقط بقرار صريح */
await setStrict(A, { on: true, shadow: false }); [c] = await send(A, tampered()); ok("تحويل shadow:false هو وحده ما يفعّل الرفض", c === 422);
await setStrict(A, { on: true, shadow: true }); [c] = await send(A, tampered()); ok("وإعادته إلى الظل يوقف الرفض فوراً", c === 201);
await setStrict(A, null); [c] = await send(A, tampered()); ok("وإزالة strict تعيد السلوك الافتراضي", c === 201);
done();
