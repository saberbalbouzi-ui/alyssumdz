/* اختبار بوابة الشحن (نسخة Cloudflare Worker): بلا شبكة ولا حسابات حقيقية. D1 تُحاكى بـnode:sqlite.   node saas/gateway/test/gateway.test.mjs */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHmac, webcrypto } from "node:crypto";
import { createApp } from "../src/app.js";
import { Vault } from "../src/crypto.js";
import { Geo } from "../src/geo.js";
import { Dispatcher } from "../src/dispatcher.js";

let total = 0, fails = 0;
function ok(n, c, x) { total++; if (!c) { fails++; console.log("✗ " + n + (x === undefined ? "" : " " + (typeof x === "string" ? x : JSON.stringify(x)))); } }

/* ───── D1 shim فوق node:sqlite ───── */
function makeD1() {
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys = ON"); db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const norm = (a) => a.map((v) => (v === undefined ? null : v));
  const d1 = { raw: db, prepare(sql) { return { bind: (...args) => ({
    first: async () => db.prepare(sql).get(...norm(args)) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...norm(args)) }),
    run: async () => { const r = db.prepare(sql).run(...norm(args)); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; },
  }) }; } };
  return d1;
}
const d1 = makeD1(), sql = (q, ...a) => d1.raw.prepare(q).get(...a), sqlAll = (q, ...a) => d1.raw.prepare(q).all(...a), exec = (q) => d1.raw.exec(q);

/* ───── fetch وهمي ───── */
const fake = { calls: [], queue: [] };
const fetchFn = async (url, init = {}) => {
  fake.calls.push({ url, init }); const r = (fake.handler && fake.handler(url, init)) ?? fake.queue.shift() ?? [200, "{}"];
  return { status: r[0], text: async () => (typeof r[1] === "string" ? r[1] : JSON.stringify(r[1])) };
};
const reply = (s, b) => { fake.queue.push([s, b]); };

const vault = new Vault({ k1: webcrypto.getRandomValues(new Uint8Array(32)) }, "k1");
const app = createApp({ d1, vault, fetchFn, pause: async () => {}, baseUrl: "https://gw.example", adminToken: "adm-secret-token", docsHtml: "<html>docs</html>" });
const T = app.tenants;
const tA = await T.createTenant("Boutique A", "a@x.dz", "pro"), kA = await T.issueKey(tA, "live", "prod"), kAt = await T.issueKey(tA, "test");
const tB = await T.createTenant("Boutique B", "b@x.dz", "free"), kB = await T.issueKey(tB, "live");

async function call(m, p, body = null, key = null, q = {}, h = {}) {
  const hd = { ...(key ? { authorization: "Bearer " + key } : {}), ...h };
  const r = await app.handle(m, p, q, hd, body === null ? "" : JSON.stringify(body), "1.1.1.1");
  let j = {}; try { j = JSON.parse(r.body) ?? {}; } catch { }
  return [r.status, j, r.headers];
}
const order = (o = {}, r = {}) => ({ courier: "sandbox", order: { reference: "R1", recipient: { fullName: "Amine Bouzid", phone: "+213 551 23 45 67", wilayaCode: 16, communeName: "Bab Ezzouar", ...r }, deliveryType: "home", productList: "Sneakers x1", codAmount: 4500, ...o } });

/* الجغرافيا */
const g = new Geo();
ok("جغرافيا: 69 ولاية و58 للشركات", g.wilayas(true).length === 69 && g.wilayas().length === 58);
ok("جغرافيا: مطابقة تامة بلا حساسية للحروف", g.matchCommune(16, "bab ezzouar").commune === "Bab Ezzouar");
{ const m = g.matchCommune(16, "Bab Ezzouarr"); ok("جغرافيا: تصحيح خطأ إملائي واحد", m.status === "corrected" && m.commune === "Bab Ezzouar", m); }
ok("جغرافيا: بلدية ولاية جديدة (Aflou ← 59) تُقبل تحت الأم (3 لغواط)", g.matchCommune(3, "Aflou").status === "exact" && g.matchCommune(59, "Aflou").status === "exact");
ok("جغرافيا: اسم غريب = unknown", g.matchCommune(16, "Zzzzzz").status === "unknown");

/* عامّة */
let c2; let [c, b, h] = await call("GET", "/health"); ok("health", c === 200 && b.ok === true);
[c, b, h] = await call("GET", "/v1/couriers"); ok("couriers: sandbox + ياليدين + كاش", c === 200 && b.couriers[0].courier === "sandbox" && b.couriers.some((x) => x.courier === "yalidine") && /max-age/.test(h["Cache-Control"]));
[c, b] = await call("GET", "/v1/wilayas", null, null, { q: "oran" }); ok("wilayas: بحث", c === 200 && b[0].code === 31);
[c, b] = await call("GET", "/v1/wilayas", null, null, { all: "1" }); { const w60 = b.find((w) => w.code === 60); ok("wilayas: 60 تُشحن كأمها (5)", w60 && w60.shipAs === 5 && w60.courierSupported === false, w60); }
[c, b] = await call("GET", "/v1/communes", null, null, { wilaya: "16" }); ok("communes: ولاية", c === 200 && b.communes.length > 40);
[c, b] = await call("GET", "/openapi.json"); ok("openapi", c === 200 && !!b.paths["/v1/orders"]);
{ const r = await app.handle("GET", "/", {}, {}, "", "1.1.1.1"); ok("الصفحة الرئيسية = التوثيق HTML", r.status === 200 && /text\/html/.test(r.headers["Content-Type"]) && r.body.includes("docs")); }

/* المصادقة */
[c, b] = await call("POST", "/v1/orders", order()); ok("بلا مفتاح 401", c === 401 && b.error.code === "unauthorized");
[c] = await call("POST", "/v1/orders", order(), "gk_live_" + "0".repeat(40)); ok("مفتاح خاطئ 401", c === 401);
[c] = await call("POST", "/v1/orders", null, kA); ok("جسم غير JSON 400", c === 400);

/* sandbox */
[c, b] = await call("POST", "/v1/orders", order(), kA);
ok("sandbox: إنشاء 201", c === 201 && /^SBX-[0-9A-F]{8}$/.test(b.trackingNumber) && b.status === "pending" && b.sandbox === true, b);
const trk = b.trackingNumber;
[c, b, h] = await call("POST", "/v1/orders", order(), kA); ok("idempotency: إعادة نفس الطلب = نفس الردّ", c === 200 && b.trackingNumber === trk && h["Idempotent-Replayed"] === "true");
[c, b] = await call("POST", "/v1/orders", order({ codAmount: 9999 }), kA); ok("idempotency: نفس المرجع بمحتوى مختلف 409", c === 409 && b.error.code === "reference_conflict");
[c, b] = await call("POST", "/v1/orders", order({ reference: "R2" }, { phone: "123" }), kA); ok("هاتف خاطئ 422", c === 422 && b.error.code === "invalid_phone");
[c, b] = await call("POST", "/v1/orders", order({ reference: "R3" }, { communeName: "Bab Ezzouarr" }), kA); ok("تصحيح البلدية تلقائياً مع تقرير", c === 201 && b.corrections[0].to === "Bab Ezzouar", b);
[c, b] = await call("POST", "/v1/orders", order({ reference: "R4" }, { communeName: "Zzzzzz" }), kA); ok("بلدية مجهولة 422", c === 422 && b.error.code === "unknown_commune");
[c, b] = await call("POST", "/v1/orders", order({ reference: "R5", productList: "", codAmount: -5 }), kA); ok("حقول ناقصة 400 بقائمة الحقول", c === 400 && b.error.fields["order.productList"] && b.error.fields["order.codAmount"], b);
[c, b] = await call("POST", "/v1/orders", order({ reference: "R6", deliveryType: "stopdesk" }), kA); ok("stopdesk بلا مكتب 422", c === 422);
[c] = await call("POST", "/v1/orders", order(), kA, {}, { "idempotency-key": "zzz" }); ok("تجاهل Idempotency-Key حين يوجد reference", c === 200);
{ const o2 = order(); delete o2.order.reference; [c, b] = await call("POST", "/v1/orders", o2, kA, {}, { "idempotency-key": "KEY-1" }); ok("Idempotency-Key كمرجع", c === 201 && b.reference === "KEY-1"); }
[c, b] = await call("POST", "/v1/validate", order({ reference: "V1" }, { communeName: "bab ezzouarr" }), kA);
ok("validate: جاف ولا ينشئ", c === 200 && b.valid && b.normalized.phone === "0551234567" && sql("SELECT COUNT(*) n FROM gw_orders WHERE reference='V1'").n === 0, b);

/* مفتاح الاختبار */
[c, b] = await call("POST", "/v1/orders", { ...order({ reference: "T1" }), courier: "yalidine", credentials: { apiId: "a", apiToken: "b" } }, kAt); ok("مفتاح الاختبار لا يصل لشركة حقيقية", c === 403 && b.error.code === "test_key_sandbox_only");
[c] = await call("POST", "/v1/orders", order({ reference: "T2" }), kAt); ok("مفتاح الاختبار مع sandbox", c === 201);

/* ياليدين inline */
const yal = { courier: "yalidine", credentials: { apiId: "AID", apiToken: "SECRET-TOK-777" }, options: { fromWilaya: 16 } };
reply(200, { Y1: { success: true, tracking: "yal-ABC123" } });
[c, b] = await call("POST", "/v1/orders", { ...order({ reference: "Y1" }), ...yal }, kA);
ok("ياليدين inline: 201 وتتبع", c === 201 && b.trackingNumber === "yal-ABC123" && b.courier === "yalidine", b);
{ const last = fake.calls[fake.calls.length - 1]; const body = JSON.parse(last.init.body)[0];
  ok("ياليدين: المفاتيح وصلت الترويسات ولم تُخزَّن", last.init.headers["X-API-TOKEN"] === "SECRET-TOK-777" && !JSON.stringify(sqlAll("SELECT * FROM gw_orders")).includes("SECRET-TOK-777"));
  ok("ياليدين: ولاية الانطلاق رقم 16 ← اسم، والهاتف محلي", body.from_wilaya_name === "Alger" && body.contact_phone === "0551234567" && body.price === 4500, body); }
reply(200, { YF: { success: true, tracking: "yal-FEE1" } });
[c, b] = await call("POST", "/v1/orders", { ...order({ reference: "YF", codAmount: 4900, shippingFee: 400 }), ...yal }, kA);
{ const body = JSON.parse(fake.calls[fake.calls.length - 1].init.body)[0]; ok("shippingFee: السعر بلا التوصيل وfreeshipping=false", c === 201 && body.price === 4500 && body.freeshipping === false, body); }
[c, b] = await call("POST", "/v1/orders", order({ reference: "YF2", shippingFee: -1 }), kA); ok("shippingFee سالب 400", c === 400 && !!b.error.fields["order.shippingFee"]);
reply(200, { Y2: { success: false, message: "Commune invalide" } });
[c, b] = await call("POST", "/v1/orders", { ...order({ reference: "Y2" }), ...yal }, kA); ok("رفض الشركة 502 ويحرّر المرجع", c === 502 && b.error.code === "courier_error" && sql("SELECT COUNT(*) n FROM gw_orders WHERE reference='Y2'").n === 0, b);
reply(200, { Y2: { success: true, tracking: "yal-RETRY" } });
[c, b] = await call("POST", "/v1/orders", { ...order({ reference: "Y2" }), ...yal }, kA); ok("إعادة المحاولة بعد الرفض تنجح", c === 201 && b.trackingNumber === "yal-RETRY");
[c, b] = await call("POST", "/v1/orders", { ...order({ reference: "Y3" }), courier: "yalidine", credentials: { apiId: "x" } }, kA); ok("مفاتيح ناقصة 422", c === 422 && b.error.code === "invalid_credentials");
[c, b] = await call("POST", "/v1/orders", { ...order({ reference: "Y4" }), courier: "yalidine" }, kA); ok("بلا مفاتيح ولا خزنة 422", c === 422 && b.error.code === "credentials_required");
[c, b] = await call("POST", "/v1/orders", { ...order({ reference: "Y5" }), courier: "nope" }, kA); ok("شركة مجهولة 400", c === 400 && b.error.code === "unknown_courier");
[c, b] = await call("POST", "/v1/orders", { ...order({ reference: "Y6", deliveryType: "stopdesk", stopDeskId: "16A" }), ...yal }, kA); ok("ياليدين: مكتب برمز غير رقمي يُرفض برسالة واضحة ويحرّر المرجع", c === 502 && /Stop Desk/.test(b.error.message) && sql("SELECT COUNT(*) n FROM gw_orders WHERE reference='Y6'").n === 0, b);

/* التتبع */
[c, b] = await call("POST", "/v1/track", { courier: "sandbox", trackingNumber: trk }, kA); ok("تتبع sandbox", c === 200 && ["pending", "shipped", "out_for_delivery", "delivered"].includes(b.status), b);
reply(200, { data: [{ tracking: "yal-ABC123", last_status: "Sorti en livraison" }] });
[c, b] = await call("POST", "/v1/track", { ...yal, trackingNumber: "yal-ABC123" }, kA); ok("تتبع ياليدين ← موحَّد", c === 200 && b.status === "out_for_delivery", b);
[c, b] = await call("GET", "/v1/orders/Y1", null, kA); ok("الطلب يتحدّث بالتتبع", c === 200 && b.status === "out_for_delivery");
[c] = await call("POST", "/v1/track", { courier: "sandbox", trackingNumber: "bad" }, kA); ok("تتبع مجهول 502", c === 502);

/* الإلغاء والبوليصة */
reply(200, {}); [c, b] = await call("POST", "/v1/cancel", { ...yal, trackingNumber: "yal-RETRY" }, kA);
ok("إلغاء ياليدين → cancelled", c === 200 && b.status === "cancelled" && sql("SELECT status FROM gw_orders WHERE reference='Y2'").status === "cancelled", b);
reply(404, {}); [c, b] = await call("POST", "/v1/cancel", { ...yal, trackingNumber: "yal-ZZZ" }, kA); ok("إلغاء مرفوض 409", c === 409 && b.error.code === "cancel_refused");
[c, b] = await call("POST", "/v1/cancel", { courier: "sandbox", trackingNumber: trk }, kA); ok("إلغاء sandbox غير مدعوم 409", c === 409);
reply(200, { data: [{ tracking: "yal-ABC123", label: "https://yalidine.app/label/abc.pdf" }] });
[c, b] = await call("POST", "/v1/label", { ...yal, trackingNumber: "yal-ABC123" }, kA); ok("بوليصة ياليدين", c === 200 && b.labelUrl === "https://yalidine.app/label/abc.pdf", b);
[c, b] = await call("POST", "/v1/label", { courier: "sandbox", trackingNumber: trk }, kA); ok("بوليصة sandbox 404", c === 404);

/* العزل */
[c] = await call("GET", "/v1/orders/Y1", null, kB); ok("عزل: B لا يرى طلب A", c === 404);
[c, b] = await call("GET", "/v1/orders", null, kB); ok("عزل: قائمة B فارغة", c === 200 && b.orders.length === 0);
[c, b] = await call("GET", "/v1/orders", null, kA); ok("قائمة A", c === 200 && b.orders.length >= 4);
[c] = await call("POST", "/v1/orders", order({ reference: "R1" }), kB); ok("عزل: المرجع نفسه عند B طلب مستقل", c === 201);

/* الحدود */
const tC = await T.createTenant("C", "c@x.dz", "free"), kC = await T.issueKey(tC, "live"); exec("UPDATE gw_plans SET orders_hour=3, orders_day=100 WHERE id='free'");
{ const cs = []; for (let i = 1; i <= 4; i++) cs.push((await call("POST", "/v1/orders", order({ reference: "L" + i }), kC))[0]); ok("حدّ الساعة: الرابع 429", JSON.stringify(cs) === "[201,201,201,429]", cs); }
[c, b, h] = await call("POST", "/v1/orders", order({ reference: "L9" }), kC); ok("429 يحمل Retry-After", c === 429 && +h["Retry-After"] > 0);
[c, b] = await call("GET", "/v1/usage", null, kC); ok("usage: عدّاد اليوم والخطة", c === 200 && b.today.order === 3 && b.plan.id === "free", b);
exec("UPDATE gw_plans SET orders_hour=20, orders_day=2 WHERE id='free'");
const tD = await T.createTenant("D", "d@x.dz", "free"), kD = await T.issueKey(tD, "live");
{ const ds = []; for (let i = 1; i <= 3; i++) ds.push((await call("POST", "/v1/orders", order({ reference: "D" + i }), kD))[0]); ok("حدّ اليوم", JSON.stringify(ds) === "[201,201,429]", ds); }
await T.setStatus(tD, "suspended"); [c] = await call("GET", "/v1/usage", null, kD); ok("مستأجر موقوف = 401", c === 401);
await T.revokeKey(sql("SELECT id FROM gw_keys WHERE tenant_id=?", tC).id); [c] = await call("GET", "/v1/usage", null, kC); ok("مفتاح مُلغى = 401", c === 401);
ok("المفتاح لا يُخزَّن صريحاً", !JSON.stringify(sqlAll("SELECT * FROM gw_keys")).includes(kA));

/* الخزنة + hooks */
[c, b] = await call("POST", "/v1/connections", { courier: "yalidine", credentials: { apiId: "AID2", apiToken: "VAULT-TOK-888" } }, kB); ok("الخطة المجانية لا تحفظ مفاتيح", c === 402 && b.error.code === "plan_limit");
[c] = await call("POST", "/v1/connections", { courier: "yalidine", credentials: { apiId: "x" } }, kA); ok("خزنة: مفاتيح ناقصة 422", c === 422);
[c, b] = await call("POST", "/v1/connections", { courier: "yalidine", credentials: { apiId: "AID2", apiToken: "VAULT-TOK-888" } }, kA);
ok("خزنة: تفعيل + رابط الشركة", c === 201 && /^https:\/\/gw\.example\/v1\/hooks\/[a-f0-9]{24}\?t=[a-f0-9]{48}$/.test(b.carrierWebhookUrl), b);
ok("خزنة: لا نص صريح في القاعدة", !JSON.stringify(sqlAll("SELECT * FROM gw_connections")).includes("VAULT-TOK-888"));
const hook = new URL(b.carrierWebhookUrl), hid = hook.pathname.split("/").pop(), hq = Object.fromEntries(hook.searchParams);
[c, b] = await call("GET", "/v1/connections", null, kA); ok("خزنة: القائمة بلا أسرار", c === 200 && b.connections.length === 1 && !JSON.stringify(b).includes("VAULT"));
reply(200, { V1X: { success: true, tracking: "yal-VAULT1" } });
[c, b] = await call("POST", "/v1/orders", { ...order({ reference: "V1X" }), courier: "yalidine" }, kA); ok("إنشاء بالخزنة بلا مفاتيح في الطلب", c === 201 && b.trackingNumber === "yal-VAULT1", b);
ok("via = vault", sql("SELECT via FROM gw_orders WHERE reference='V1X'").via === "vault");
{ const last = fake.calls[fake.calls.length - 1]; ok("الخزنة تفكّ المفاتيح عند الإرسال", last.init.headers["X-API-TOKEN"] === "VAULT-TOK-888"); }
[c] = await call("PUT", "/v1/webhook", { url: "http://insecure.example/hook" }, kA); ok("webhook صادر: http مرفوض", c === 400);
[c] = await call("PUT", "/v1/webhook", { url: "https://127.0.0.1/hook" }, kA); ok("webhook صادر: IP مباشر مرفوض", c === 400);
[c, b] = await call("PUT", "/v1/webhook", { url: "https://client.example/hook" }, kA); ok("webhook صادر: ضبط + سرّ", c === 200 && b.secret.startsWith("whsec_")); const sec = b.secret;
[c] = await call("PUT", "/v1/webhook", { url: "https://client.example/hook" }, kB); ok("webhook صادر: الخطة المجانية ممنوعة", c === 402);
[c] = await call("POST", "/v1/hooks/" + hid, { x: 1 }, null, { t: "wrong" }); ok("hook وارد: سرّ خاطئ 401", c === 401);
const wb = { type: "parcel_status_updated", data: [{ tracking: "yal-VAULT1", last_status: "Sorti en livraison" }] };
[c, b] = await call("POST", "/v1/hooks/" + hid, wb, null, hq); ok("hook وارد: يحدّث الطلب", c === 200 && b.updated === 1, b);
ok("حالة الطلب out_for_delivery", sql("SELECT status FROM gw_orders WHERE reference='V1X'").status === "out_for_delivery");
[c, b] = await call("POST", "/v1/hooks/" + hid, wb, null, hq); ok("hook وارد: التكرار لا يغيّر", c === 200 && b.updated === 0);
{ const r = await app.handle("GET", "/v1/hooks/" + hid, { subscribe: "1", crc_token: "abc" }, {}, "", "1.1.1.1"); ok("hook وارد: CRC", r.status === 200 && r.body === "abc"); }
ok("حدث صادر في الطابور", sql("SELECT COUNT(*) n FROM gw_events WHERE state='pending'").n === 1);
fake.calls = []; reply(500, {});
let r = await app.dispatcher.deliverDue(); const sent = fake.calls[0];
ok("تسليم صادر: فشل 500 يُجدوَل", r.failed === 1 && sql("SELECT attempts FROM gw_events").attempts === 1 && sql("SELECT next_at FROM gw_events").next_at > Math.floor(Date.now() / 1000));
{ const mm = /t=(\d+),v1=([0-9a-f]{64})/.exec(sent.init.headers["X-Gateway-Signature"]); const body = sent.init.body;
  ok("تسليم صادر: توقيع HMAC صحيح", sent.url === "https://client.example/hook" && createHmac("sha256", sec).update(mm[1] + "." + body).digest("hex") === mm[2] && JSON.parse(body).data.status === "out_for_delivery"); }
exec("UPDATE gw_events SET next_at=0"); reply(200, {}); r = await app.dispatcher.deliverDue();
ok("تسليم صادر: إعادة المحاولة تنجح", r.sent === 1 && sql("SELECT state FROM gw_events").state === "sent");
// cron
exec("UPDATE gw_orders SET status='pending' WHERE reference='V1X'"); fake.calls = [];
reply(200, { data: [{ tracking: "yal-VAULT1", last_status: "Livré" }] }); reply(200, {});
r = await app.cron(); ok("cron: يزامن ويرسل الحدث", r.checked >= 1 && r.changed === 1 && r.sent === 1, r);
ok("cron: الحالة النهائية", sql("SELECT status FROM gw_orders WHERE reference='V1X'").status === "delivered");
/* المعايرة عند أول ربط: دفعات عبر /calibrate ثم يُطبَّق الملف على الإرسال */
{
  const CAT = { 16: ["Bab Ezzouar", "Kouba", "Bordj El Kiffane", "Rouiba"], 31: ["Oran"] }, pg = (rows, u) => { const q = new URL(u).searchParams, size = +q.get("page_size") || 100, pgn = +q.get("page") || 1; return [200, { has_more: pgn * size < rows.length, data: rows.slice((pgn - 1) * size, pgn * size) }]; };
  const made = {};
  fake.handler = (u, init) => {
    const x = new URL(u), q = x.searchParams;
    if (x.pathname === "/v1/wilayas/") return [200, { data: [] }];
    if (x.pathname === "/v1/communes/") return pg((CAT[q.get("wilaya_id")] ?? []).map((n) => ({ name: n, is_deliverable: n === "Rouiba" ? 0 : 1 })), u);
    if (x.pathname === "/v1/centers/") return pg(q.get("wilaya_id") === "16" ? [{ center_id: 161601, name: "Desk", commune_name: "Bab Ezzouar" }] : [], u);
    if (x.pathname === "/v1/deliveryfees/") return pg([{ wilaya_id: 16, home_fee: 500, desk_fee: 300 }], u);
    if (x.pathname === "/v1/parcels/" && init.method === "GET") return pg([{ tracking: "yal-1", last_status: "Livré" }, { tracking: "yal-2", last_status: "Statut Inconnu 5" }], u);
    if (x.pathname.startsWith("/v1/parcels/") && init.method === "GET") return [200, { data: [{ tracking: x.pathname.split("/")[3], last_status: "En préparation" }] }];
    if (x.pathname === "/v1/parcels/" && init.method === "POST") { const b = JSON.parse(init.body)[0]; made.last = b; return [200, { [b.order_id]: { success: true, tracking: "yal-CAL1" } }]; }
    return [404, "{}"];
  };
  [c, b] = await call("POST", "/v1/connections", { courier: "yalidine", credentials: { apiId: "AID2", apiToken: "VAULT-TOK-888" } }, kA);
  const hk2 = new URL(b.carrierWebhookUrl), hid2 = hk2.pathname.split("/").pop(), hq2 = Object.fromEntries(hk2.searchParams);
  ok("معايرة: التفعيل يبدأها (مرحلة geo)", c === 201 && b.calibration && b.calibration.done === false && b.calibration.progress.phase === "geo", b.calibration);
  let n = 0; do { [c, b] = await call("POST", "/v1/connections/yalidine/calibrate", {}, kA); } while (c === 200 && !b.calibration.done && ++n < 40);
  const cal = b.calibration;
  ok("معايرة: تنتهي بدفعات", c === 200 && cal.done === true && n >= 2, { c, n, cal });
  ok("معايرة: التُقطت بلديات ولايتين ومكتب وتعريفة", cal.communes.wilayas >= 2 && cal.desks === 1 && cal.fees === 1, cal);
  ok("معايرة: حالة مجهولة معلنة وتحقّق التتبع نجح", cal.statuses.unknown === 1 && cal.verify && cal.verify.ok === 2 && cal.warnings.some((w) => /Statut Inconnu 5/.test(w)), cal);
  [c, b] = await call("GET", "/v1/connections/yalidine/calibrate", null, kA); ok("معايرة: GET ملخّص محفوظ", c === 200 && b.calibration.done === true);
  fake.calls = [];
  [c, b] = await call("POST", "/v1/orders", { ...order({ reference: "CAL1" }, { communeName: "Rouiba" }), courier: "yalidine" }, kA);
  ok("بعد المعايرة: بلدية لا توصّل إليها الشركة ← منع مبكر بلا طلب", c >= 400 && /لا توصّل/.test(JSON.stringify(b)) && !fake.calls.some((x) => x.init.method === "POST"), b);
  [c, b] = await call("POST", "/v1/orders", { ...order({ reference: "CAL2" }, { communeName: "Bordj El Kiffan" }), courier: "yalidine" }, kA);
  ok("بعد المعايرة: تهجئة مقاربة تُصحَّح عند الإرسال", c === 201 && made.last && made.last.to_commune_name === "Bordj El Kiffane", { c, last: made.last, b });
  /* webhook: التقاط الشكل */
  fake.handler = null;
  const whb = { type: "parcel_status_updated", data: [{ tracking: "yal-CAL1", last_status: "Livré" }] };
  [c, b] = await call("POST", "/v1/hooks/" + hid2, whb, null, hq2); [c, b] = await call("POST", "/v1/hooks/" + hid2, { weird: 1 }, null, hq2);
  [c, b] = await call("GET", "/v1/connections/yalidine/calibrate", null, kA);
  ok("webhook: التُقط شكل الإشعارات وعدد المحلَّل", b.calibration.webhook && b.calibration.webhook.received >= 2 && b.calibration.webhook.empty >= 1 && b.calibration.webhook.parsed >= 1, b.calibration.webhook);
  [c, b] = await call("POST", "/v1/connections/zzz/calibrate", {}, kA); ok("معايرة: شركة غير مفعّلة 404", c === 404);
  [c, b] = await call("POST", "/v1/connections", { courier: "yalidine", credentials: { apiId: "AID2", apiToken: "VAULT-TOK-888" } }, kA);
  [c, b] = await call("GET", "/v1/connections/yalidine/calibrate", null, kA); ok("إعادة الربط تمسح الملف القديم وتبدأ جديداً", b.calibration && b.calibration.done === false && !b.calibration.webhook, b.calibration);
}
[c] = await call("DELETE", "/v1/connections/yalidine", null, kA); { const [c2] = await call("POST", "/v1/orders", { ...order({ reference: "V2X" }), courier: "yalidine" }, kA); ok("فصل الشركة من الخزنة", c === 200 && c2 === 422); }

/* أخرى */
[c, b] = await call("POST", "/v1/desks", { wilayaCode: 16 }, kA); ok("desks: كتالوج الولاية", c === 200 && b.desks.length > 5);
{ const x = await app.handle("POST", "/v1/orders", {}, { authorization: "Bearer " + kA }, "x".repeat(300000), "1.1.1.1"); ok("جسم كبير 413", x.status === 413); }
{ const x = await app.handle("GET", "/nope", {}, {}, "", "1.1.1.1"); ok("مسار مجهول يتطلب مفتاحاً (لا تسريب)", x.status === 401); }
[c] = await call("GET", "/nope", null, kA); ok("مسار مجهول 404", c === 404);
ok("رؤوس الأمان", (await app.handle("GET", "/health", {}, {}, "", "1.1.1.1")).headers["X-Content-Type-Options"] === "nosniff");

/* إدارة الخدمة */
const adm = (m, p, body = null, tok = "adm-secret-token") => call(m, p, body, null, {}, { authorization: "Bearer " + tok });
[c] = await adm("GET", "/admin/tenants", null, "wrong"); ok("إدارة: رمز خاطئ 401", c === 401);
[c] = await call("GET", "/admin/tenants"); ok("إدارة: بلا رمز 401", c === 401);
[c, b] = await adm("POST", "/admin/tenants", { name: "Site X", email: "x@x.dz", plan: "pro", site_ref: "site-123" }); ok("إدارة: إنشاء مستأجر مرتبط بموقع", c === 201 && b.id > 0, b); const idX = b.id;
[c] = await adm("POST", "/admin/tenants", { name: "Site Y", plan: "free", site_ref: "site-123" }); ok("إدارة: الموقع نفسه مرتين 409", c === 409);
[c] = await adm("POST", "/admin/tenants", { name: "Z", plan: "nope" }); ok("إدارة: خطة مجهولة 400", c === 400);
[c, b] = await adm("POST", `/admin/tenants/${idX}/keys`, { mode: "live", label: "panel" }); ok("إدارة: إصدار مفتاح", c === 201 && /^gk_live_[0-9a-f]{40}$/.test(b.key)); const kX = b.key;
[c, b] = await call("GET", "/v1/usage", null, kX); ok("المفتاح الصادر يعمل والخطة pro", c === 200 && b.plan.id === "pro");
[c] = await adm("PATCH", `/admin/tenants/${idX}`, { plan: "business" }); [c2, b] = await call("GET", "/v1/usage", null, kX); ok("إدارة: تغيير الخطة", c === 200 && b.plan.id === "business");
[c] = await adm("PATCH", `/admin/tenants/${idX}`, { status: "suspended" }); [c2] = await call("GET", "/v1/usage", null, kX); ok("إدارة: إيقاف مستأجر", c === 200 && c2 === 401);
[c, b] = await adm("PUT", "/admin/plans/pro", { orders_day: 5000, price_dzd: 4900 }); [c2, b] = await adm("GET", "/admin/plans"); ok("إدارة: تعديل خطة", c === 200 && b.plans.find((p) => p.id === "pro").orders_day === 5000 && b.plans.find((p) => p.id === "pro").price_dzd === 4900);
[c, b] = await adm("GET", "/admin/tenants"); ok("إدارة: قائمة المستأجرين بالعدادات", c === 200 && b.tenants.find((t) => t.id === tA).orders >= 4 && b.tenants.find((t) => t.id === idX).site_ref === "site-123");
[c, b] = await adm("GET", "/admin/usage"); ok("إدارة: الاستعمال", c === 200 && b.usage.some((u) => u.tenant_id === tA && u.kind === "order"));
[c, b] = await adm("GET", "/admin/summary"); { const t = b.tenants.find((x) => x.id === tA); ok("إدارة: الملخص بحدود الخطة والاستعمال", c === 200 && t && t.orders_day === 5000 && t.today >= 1 && t.last30 >= t.today && t.connections === 0 && t.plan_name, t); }
[c] = await adm("POST", "/admin/tenants/9999/keys", { mode: "live" }); ok("إدارة: مفتاح لمستأجر مجهول 404", c === 404);
[c] = await adm("POST", `/admin/tenants/${idX}/keys`, { mode: "bad" }); ok("إدارة: وضع مفتاح خاطئ 400", c === 400);
[c] = await adm("PATCH", "/admin/tenants/9999", { plan: "pro" }); ok("إدارة: تعديل مستأجر مجهول 404", c === 404);
[c, b] = await call("GET", "/admin/audit", null, null, {}, { authorization: "Bearer adm-secret-token", "x-actor": "owner@x.dz" }); ok("إدارة: سجلّ التدقيق بلا أسرار", c === 200 && b.audit.some((a) => a.action === "tenant.create") && !JSON.stringify(b).includes("gk_live_"), b.audit.slice(0, 2));
[c] = await call("PATCH", `/admin/tenants/${idX}`, { status: "active" }, null, {}, { authorization: "Bearer adm-secret-token", "x-actor": "owner@x.dz" }); [c2, b] = await adm("GET", "/admin/audit"); ok("التدقيق يسجّل الفاعل", b.audit.some((a) => a.action === "tenant.active" && a.actor === "owner@x.dz"));
ok("التوقيع مطابق للصيغة", (await Dispatcher.sign("s", 1, "{}")).startsWith("t=1,v1="));

console.log(fails ? `\n✗ ${fails} من ${total} فشل` : `✓ ${total} فحصاً ناجحاً`); process.exit(fails ? 1 : 0);
