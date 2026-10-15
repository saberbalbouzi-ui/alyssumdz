/* SMS: شرائح، قوالب، رصيد ذرّي، عدم التكرار، استرداد عند الفشل، نافذة الإرسال. */
import { makeEnv, Tally } from "./_harness.mjs";
import { sms, segments, render, inWindow } from "../src/modules/sms.js";
const { ok, done } = Tally();
ok("شرائح: لاتيني قصير 1", segments("Bonjour Amine") === 1);
ok("شرائح: لاتيني 161 حرفاً = 2", segments("a".repeat(161)) === 2 && segments("a".repeat(160)) === 1);
ok("شرائح: عربي 70 = 1 و71 = 2", segments("ب".repeat(70)) === 1 && segments("ب".repeat(71)) === 2);
ok("شرائح: فارغ 0", segments("") === 0);
ok("قالب: متغيرات وتنظيف مسافات", render("مرحباً {name}، طلبك {order_id} ({total} دج)  {x}", { order_id: "A1", total: 4500, customer: { name: "أمين" } }) === "مرحباً أمين، طلبك A1 (4500 دج) {x}");
ok("نافذة 08–21 بتوقيت الجزائر", inWindow(Date.parse("2026-10-12T10:00:00Z")) && !inWindow(Date.parse("2026-10-12T21:00:00Z")) && !inWindow(Date.parse("2026-10-12T05:00:00Z")) && inWindow(Date.parse("2026-10-12T07:00:00Z")));
const E = makeEnv([sms], { providers: ["sms"] }); const { call, adm, tenant, fake, clock, app, sql, sqlAll } = E;
const A = await tenant("A"), B = await tenant("B");
const cfg = { url: "https://sms.example/api/send", auth: "bearer", sender: "ALYSSUM", fields: { to: "recipient", message: "text" }, templates: { "order.created": "مرحباً {name}، تم استلام طلبك {order_id}", "order.confirmed": "Commande {order_id} confirmee" } };
let [c, b] = await call("PUT", "/v1/integrations/sms", { config: cfg, secrets: { api_key: "k-123" } }, A.key); ok("ضبط التكامل", c === 200);
const ev = (id, type = "order.created", phone = "0551234567") => call("POST", "/v1/events", { type, id, data: { order_id: id, total: 4500, customer: { name: "أمين", phone } } }, A.key);
[c, b] = await call("GET", "/v1/sms/balance", null, A.key); ok("الرصيد صفر", b.balance === 0);
await ev("O1"); await app.cron(); ok("بلا رصيد: لا إرسال ويُسجَّل no_credit", fake.calls.length === 0 && sql("SELECT status s FROM sms_log").s === "no_credit");
[c] = await call("POST", "/admin/tenants/" + A.id + "/sms-credits", { credits: 10 }, "adm-tok"); ok("شحن الرصيد (admin)", c === 200);
[c] = await call("POST", "/admin/tenants/" + A.id + "/sms-credits", { credits: 10 }, A.key); ok("المستأجر لا يشحن بنفسه", c === 401 || c === 403, c);
fake.handler = (url, init) => { fake.last = { url, init }; return [200, { ok: true }]; };
await ev("O2"); await app.cron();
const sent = JSON.parse(fake.last.init.body); ok("إرسال: رابط المزوّد وBearer وأسماء الحقول المخصّصة", fake.last.url === cfg.url && fake.last.init.headers.Authorization === "Bearer k-123" && sent.recipient === "213551234567" && sent.sender === "ALYSSUM" && sent.text === "مرحباً أمين، تم استلام طلبك O2", sent);
[, b] = await call("GET", "/v1/sms/balance", null, A.key); ok("خُصمت شريحة واحدة (9) وسُجّلت في الدفتر", b.balance === 9 && b.ledger[0].delta === -1 && b.ledger[0].reason === "send", b);
fake.calls.length = 0; await ev("O2", "order.created"); await app.cron(); ok("نفس الحدث لا يُرسل ثانية", fake.calls.length === 0);
await ev("O3", "order.delivered"); await app.cron(); ok("حدث بلا قالب: لا إرسال", fake.calls.length === 0);
await ev("O4", "order.created", "123"); await app.cron(); ok("رقم غير صالح: لا إرسال ولا خصم", fake.calls.length === 0 && (await call("GET", "/v1/sms/balance", null, A.key))[1].balance === 9);
/* فشل نهائي 4xx: استرداد */
fake.handler = () => [400, "bad"]; await ev("O5"); await app.cron();
[, b] = await call("GET", "/v1/sms/balance", null, A.key); ok("فشل 400: الرصيد يعود (9) والحالة failed", b.balance === 9 && sql("SELECT status s FROM sms_log ORDER BY id DESC").s === "failed" && b.ledger[0].reason === "refund", b);
/* فشل مؤقت 500: يُعاد الحدث ثم ينجح بلا خصم مزدوج */
fake.handler = () => [500, "x"]; await ev("O6"); let r = await app.cron(); ok("500: الحدث يُعاد", r.failed >= 1);
fake.handler = (u, i) => [200, "{}"]; clock.t += 120_000; await app.cron(); [, b] = await call("GET", "/v1/sms/balance", null, A.key);
ok("بعد النجاح خُصمت شريحة واحدة فقط (8)", b.balance === 8, b);
/* خارج النافذة */
clock.t = Date.parse("2026-10-12T22:30:00Z"); fake.calls.length = 0; await ev("O7"); r = await app.cron(); ok("خارج النافذة: يؤجَّل بلا إرسال", fake.calls.length === 0 && r.failed >= 1);
clock.t = Date.parse("2026-10-13T08:30:00Z"); await app.cron(); ok("داخل النافذة لاحقاً: يُرسل", fake.calls.length === 1);
/* عزل + معاينة + سجل */
[, b] = await call("GET", "/v1/sms/balance", null, B.key); ok("عزل المستأجرين", b.balance === 0);
[, b] = await call("POST", "/v1/sms/preview", { template: "{name} {order_id}", data: { order_id: "Z", customer: { name: "س" } } }, A.key); ok("معاينة", b.text === "س Z" && b.segments === 1);
[, b] = await call("GET", "/v1/sms/log", null, A.key); ok("السجل بلا أرقام", b.log.length >= 3 && !JSON.stringify(b).includes("0551"));
/* خصم يتجاوز الرصيد مرفوض */
[c] = await call("POST", "/admin/tenants/" + A.id + "/sms-credits", { credits: -1000 }, "adm-tok"); ok("خصم أكبر من الرصيد 409", c === 409);
/* تعطيل */
await call("PUT", "/v1/integrations/sms", { config: { ...cfg, enabled: false } }, A.key); fake.calls.length = 0; await ev("O8"); await app.cron(); ok("enabled=false يوقف الإرسال", fake.calls.length === 0);
/* مصدران لنفس (النوع، الطلب) — معرّفا حدث مختلفان: رسالة واحدة فقط */
await call("PUT", "/v1/integrations/sms", { config: cfg }, A.key); await call("POST", "/admin/tenants/" + A.id + "/sms-credits", { credits: 5 }, "adm-tok");
fake.handler = (url, init) => { fake.last = { url, init }; return [200, { ok: true }]; }; fake.calls.length = 0;
const evo = (eid, oid) => call("POST", "/v1/events", { type: "order.confirmed", id: eid, data: { order_id: oid, total: 1, customer: { name: "س", phone: "0551234567" } } }, A.key);
const nb = (await call("GET", "/v1/sms/balance", null, A.key))[1].balance;
await evo("src-a", "ORD-X"); await evo("src-b", "ORD-X"); await app.cron();
ok("حدثان مختلفان لنفس الطلب والنوع ← رسالة واحدة وخصم واحد", fake.calls.length === 1 && (await call("GET", "/v1/sms/balance", null, A.key))[1].balance === nb - 1, fake.calls.length);
done();
