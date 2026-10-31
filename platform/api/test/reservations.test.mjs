/* دفتر حجز المخزون (A-05): pending ← committed | released، انتهاء المهلة، إعادة الحجز عند التأكيد المتأخر، idempotency. */
import { makeEnv, Tally } from "./_harness.mjs";
import { commerce } from "../src/modules/commerce.js";
const { ok, done } = Tally();
const E = makeEnv([commerce]); const { call, adm, tenant, app, sql, sqlAll, clock } = E;
const A = await tenant("A"); const B = await tenant("B");
const setup = async (T, stock) => { await call("PUT", "/v1/catalog/products", { products: [{ slug: "a", title: "أ", price: 1000, stock, offers: [] }, { slug: "b", title: "ب", price: 500, stock: 3, offers: [] }, { slug: "free", title: "ح", price: 100, stock: null, offers: [] }] }, T.key);
  await adm("PATCH", `/admin/tenants/${T.id}`, { settings: { origins: ["https://shop.example"], order_mode: "enforce" } });
  const [, pk] = await adm("POST", `/admin/tenants/${T.id}/keys`, { scopes: ["order:create"], mode: "pub" }); return pk.key; };
const pkA = await setup(A, 10), pkB = await setup(B, 10);
let n = 0;
const send = (pk, items, sub, ref = "RSV-" + String(++n).padStart(4, "0")) => call("POST", "/v1/orders", { ref, customer: { name: "أمين", phone: "0551234567" }, wilaya: "Alger", commune: "Kouba", dtype: "home", items, subtotal: sub, discount: 0, fee: 0, total: sub }, pk, {}, { origin: "https://shop.example" }).then(([c, b]) => ({ c, b, ref }));
const stock = (T, s) => sql("SELECT stock s FROM cm_skus WHERE tenant_id=? AND slug=? AND vkey=''", T.id, s).s;
const rows = (T, ref) => sqlAll("SELECT slug,qty,state,expires_at FROM cm_resv WHERE tenant_id=? AND ref=? ORDER BY slug", T.id, ref);
const ev = async (T, type, ref, id = type + ref + Math.random()) => { await call("POST", "/v1/events", { type, id, data: { order_id: ref } }, T.key); await app.cron(); };
const flags = (ref) => JSON.parse(sql("SELECT flags f FROM cm_orders WHERE ref=?", ref).f);
const NOW = () => Math.floor(clock.t / 1000);

/* 1) الحجز يكتب الدفتر: سطر لكل صنف متتبَّع، pending، بمهلة افتراضية 72 ساعة، وغير المتتبَّع لا سطر له */
let r1 = await send(pkA, [{ slug: "a", qty: 2, price: 1000 }, { slug: "b", qty: 1, price: 500 }, { slug: "free", qty: 3, price: 100 }], 2800);
ok("حجز: 201 وخصم المخزون", r1.c === 201 && stock(A, "a") === 8 && stock(A, "b") === 2, r1);
let R = rows(A, r1.ref); ok("الدفتر: سطران pending بكميتيهما (الصنف غير المتتبَّع بلا سطر)", R.length === 2 && R.every((x) => x.state === "pending") && R.find((x) => x.slug === "a").qty === 2 && R.find((x) => x.slug === "b").qty === 1, R);
ok("المهلة الافتراضية 72 ساعة", R.every((x) => x.expires_at === NOW() + 72 * 3600), R);
let [, st] = await call("GET", "/v1/orders/stats", null, A.key); ok("الإحصاء يعرض الحجوزات والمهلة", st.holds.pending === 2 && st.hold_hours === 72 && st.next_expiry === NOW() + 72 * 3600, st);

/* 2) الطلب المرفوض (نفاد) لا يترك أي سطر */
const bad = await send(pkA, [{ slug: "a", qty: 99, price: 1000 }], 99000);
ok("نفاد ← 409 بلا أسطر دفتر ولا خصم", bad.c === 409 && rows(A, bad.ref).length === 0 && stock(A, "a") === 8);

/* 3) إعادة إرسال المرجع نفسه: duplicate بلا خصم ثانٍ ولا أسطر مكررة */
const dup = await send(pkA, [{ slug: "a", qty: 2, price: 1000 }, { slug: "b", qty: 1, price: 500 }, { slug: "free", qty: 3, price: 100 }], 2800, r1.ref);
ok("إعادة الإرسال: duplicate والمخزون والدفتر كما هما", dup.b.duplicate === true && stock(A, "a") === 8 && stock(A, "b") === 2 && rows(A, r1.ref).length === 2, dup);

/* 4) التأكيد ← committed؛ التسليم بعده لا يغيّر شيئاً؛ التكرار آمن */
await ev(A, "order.confirmed", r1.ref);
ok("التأكيد: كل السطور committed", rows(A, r1.ref).every((x) => x.state === "committed"), rows(A, r1.ref));
await ev(A, "order.confirmed", r1.ref); await ev(A, "order.delivered", r1.ref);
ok("تأكيد مكرر وتسليم: لا تغيير في المخزون", stock(A, "a") === 8 && stock(A, "b") === 2);
/* مهلة الدفتر لا تمسّ committed */
clock.t += 100 * 3600_000; await app.cron();
ok("انتهاء الزمن لا يحرّر committed", rows(A, r1.ref).every((x) => x.state === "committed") && stock(A, "a") === 8);

/* 5) إلغاء طلب committed: يعيد المخزون مرة واحدة لكل سطر */
await ev(A, "order.cancelled", r1.ref); await ev(A, "order.cancelled", r1.ref);
ok("إلغاء (مرتين) ← الإعادة مرة واحدة: 10 و3", stock(A, "a") === 10 && stock(A, "b") === 3 && rows(A, r1.ref).every((x) => x.state === "released") && sql("SELECT reserved r FROM cm_orders WHERE ref=?", r1.ref).r === 0, { a: stock(A, "a"), b: stock(A, "b") });

/* 6) انتهاء مهلة pending: cron يحرّر ويعيد المخزون ويوسم الطلب */
let r2 = await send(pkA, [{ slug: "a", qty: 4, price: 1000 }], 4000);
ok("حجز جديد 4", r2.c === 201 && stock(A, "a") === 6);
clock.t += 71 * 3600_000; await app.cron(); ok("قبل المهلة: يبقى محجوزاً", stock(A, "a") === 6 && rows(A, r2.ref)[0].state === "pending");
clock.t += 2 * 3600_000; let cr = await app.cron();
ok("بعد المهلة: الإعادة تلقائياً مرة واحدة + وسم الطلب", stock(A, "a") === 10 && rows(A, r2.ref)[0].state === "released" && flags(r2.ref).includes("reservation_expired") && sql("SELECT reserved r FROM cm_orders WHERE ref=?", r2.ref).r === 0, { a: stock(A, "a"), cr: cr.commerce });
ok("cron يعيد عدد المحرَّر", cr.commerce?.expired === 1, cr.commerce);
await app.cron(); ok("cron ثانٍ لا يعيد ثانية", stock(A, "a") === 10);

/* 7) تأكيد متأخر بعد انتهاء المهلة: يُعاد الحجز ذرّياً إن كفى المخزون */
await ev(A, "order.confirmed", r2.ref);
ok("تأكيد متأخر ← إعادة حجز (6) وcommitted وreserved=1", stock(A, "a") === 6 && rows(A, r2.ref)[0].state === "committed" && sql("SELECT reserved r FROM cm_orders WHERE ref=?", r2.ref).r === 1, { a: stock(A, "a"), r: rows(A, r2.ref) });
await ev(A, "order.confirmed", r2.ref); ok("تأكيد متأخر مكرر لا يخصم ثانية", stock(A, "a") === 6);

/* 8) تأكيد متأخر والمخزون لا يكفي: يبقى released، يُوسَم reservation_lost، لا خصم سالب */
let r3 = await send(pkA, [{ slug: "a", qty: 3, price: 1000 }], 3000); ok("حجز 3 (المتبقي 3)", r3.c === 201 && stock(A, "a") === 3);
clock.t += 80 * 3600_000; await app.cron(); ok("انتهت مهلته فعاد 6", stock(A, "a") === 6);
let r4 = await send(pkA, [{ slug: "a", qty: 5, price: 1000 }], 5000); ok("طلب آخر يأخذ 5 (يبقى 1)", r4.c === 201 && stock(A, "a") === 1);
await ev(A, "order.confirmed", r3.ref);
ok("التأكيد المتأخر لا يكفيه 1 < 3 ← released + reservation_lost والمخزون 1", rows(A, r3.ref)[0].state === "released" && flags(r3.ref).includes("reservation_lost") && stock(A, "a") === 1, { a: stock(A, "a"), f: flags(r3.ref), r: rows(A, r3.ref) });

/* 9) تعدد الأسطر: إعادة الحجز كلها أو لا شيء */
await setup(B, 10);
let r5 = await send(pkB, [{ slug: "a", qty: 5, price: 1000 }, { slug: "b", qty: 3, price: 500 }], 6500);
ok("B: حجز سطرين (a=5,b=3 ← 5 و0)", r5.c === 201 && stock(B, "a") === 5 && stock(B, "b") === 0);
clock.t += 80 * 3600_000; await app.cron(); ok("B: انتهت المهلة فعاد الكل (10 و3)", stock(B, "a") === 10 && stock(B, "b") === 3);
let r6 = await send(pkB, [{ slug: "b", qty: 2, price: 500 }], 1000); ok("B: طلب آخر يأخذ 2 من b (يبقى 1)", r6.c === 201 && stock(B, "b") === 1);
await ev(B, "order.confirmed", r5.ref);
ok("B: إعادة حجز r5 تفشل في b فيُتراجع عن a أيضاً (لا حجز جزئي)", stock(B, "a") === 10 && stock(B, "b") === 1 && rows(B, r5.ref).every((x) => x.state === "released") && flags(r5.ref).includes("reservation_lost"), { a: stock(B, "a"), b: stock(B, "b"), r: rows(B, r5.ref) });

/* 10) التزامن: تأكيدان متزامنان لطلب منتهي المهلة لا يخصمان مرتين */
let r7 = await send(pkB, [{ slug: "a", qty: 2, price: 1000 }], 2000); ok("B: حجز a=2", r7.c === 201 && stock(B, "a") === 8);
clock.t += 80 * 3600_000; await app.cron(); ok("B: عاد a=10", stock(B, "a") === 10);
await Promise.all([call("POST", "/v1/events", { type: "order.confirmed", id: "c1" + r7.ref, data: { order_id: r7.ref } }, B.key), call("POST", "/v1/events", { type: "order.confirmed", id: "c2" + r7.ref, data: { order_id: r7.ref } }, B.key)]);
await Promise.all([app.cron(), app.cron()]);
ok("تأكيدان متزامنان ← خصم واحد فقط (8)", stock(B, "a") === 8 && rows(B, r7.ref)[0].state === "committed", { a: stock(B, "a"), r: rows(B, r7.ref) });

/* 11) المهلة قابلة للضبط، وعزل المستأجرين */
await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://shop.example"], order_mode: "enforce", hold_hours: 6 } });
const A0 = stock(A, "b"); let r8 = await send(pkA, [{ slug: "b", qty: 1, price: 500 }], 500);
ok("hold_hours=6 يُحترم", r8.c === 201 && rows(A, r8.ref)[0].expires_at === NOW() + 6 * 3600, rows(A, r8.ref));
await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://shop.example"], order_mode: "enforce", hold_hours: 99999 } });
let r9 = await send(pkA, [{ slug: "b", qty: 1, price: 500 }], 500); ok("قيمة خارج النطاق ← الافتراضي 72", rows(A, r9.ref)[0].expires_at === NOW() + 72 * 3600);
ok("عزل المستأجرين: دفتر A لا يظهر في إحصاء B", (await call("GET", "/v1/orders/stats", null, B.key))[1].holds.pending <= 1);

/* 12) طلب قديم بلا سطور دفتر (reserved=1): الإلغاء يعيد من بنود الطلب كما كان (توافق رجعي) */
{ const E2 = makeEnv([commerce]); const T = await E2.tenant("L"); await E2.call("PUT", "/v1/catalog/products", { products: [{ slug: "z", title: "ز", price: 100, stock: 5, offers: [] }] }, T.key);
  E2.db.prepare("UPDATE cm_skus SET stock=3 WHERE slug='z'").run();
  E2.db.prepare("INSERT INTO cm_orders (tenant_id,ref,status,name,phone_h,phone_enc,items,subtotal,total,reserved,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,1,1)").run(T.id, "OLD-001", "nouvelle", "x", "h", "e", JSON.stringify([{ id: "z", vkey: "", qty: 2, price: 100 }]), 200, 200);
  await E2.call("POST", "/v1/events", { type: "order.cancelled", id: "o1", data: { order_id: "OLD-001" } }, T.key); await E2.app.cron();
  await E2.call("POST", "/v1/events", { type: "order.cancelled", id: "o2", data: { order_id: "OLD-001" } }, T.key); await E2.app.cron();
  ok("توافق رجعي: إلغاء طلب بلا دفتر يعيد 2 مرة واحدة (3 ← 5)", E2.sql("SELECT stock s FROM cm_skus WHERE slug='z'").s === 5); }

/* 13) وضع observe لا يكتب دفتراً */
{ const E3 = makeEnv([commerce]); const T = await E3.tenant("O"); await E3.call("PUT", "/v1/catalog/products", { products: [{ slug: "z", title: "ز", price: 100, stock: 5, offers: [] }] }, T.key);
  await E3.adm("PATCH", `/admin/tenants/${T.id}`, { settings: { origins: ["https://shop.example"] } }); const [, pk] = await E3.adm("POST", `/admin/tenants/${T.id}/keys`, { scopes: ["order:create"], mode: "pub" });
  const [c] = await E3.call("POST", "/v1/orders", { ref: "OBS-001", customer: { name: "أ", phone: "0551234567" }, wilaya: "Alger", commune: "K", dtype: "home", items: [{ slug: "z", qty: 1, price: 100 }], subtotal: 100, discount: 0, fee: 0, total: 100 }, pk.key, {}, { origin: "https://shop.example" });
  ok("observe: يُقبل بلا حجز ولا دفتر", c === 201 && E3.sqlAll("SELECT id FROM cm_resv").length === 0 && E3.sql("SELECT stock s FROM cm_skus WHERE slug='z'").s === 5); }
done();
