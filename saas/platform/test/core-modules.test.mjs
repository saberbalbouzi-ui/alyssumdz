/* نواة الدمج: الأحداث، التكاملات، المفاتيح العامة/CORS، idempotency، OpenAPI، CAPI، webhooks الصادرة. */
import { createHmac } from "node:crypto";
import { createHash } from "node:crypto";
import { makeEnv, Tally } from "./_harness.mjs";
import { capi, buildMeta } from "../src/modules/capi.js";
import { hooks } from "../src/modules/hooks.js";
const { ok, done } = Tally(), sha = (s) => createHash("sha256").update(s).digest("hex");
const E = makeEnv([capi, hooks]); const { call, adm, tenant, fake, clock, sql, sqlAll, app } = E;
const A = await tenant("A", ["*"]), B = await tenant("B", ["events:write"]);

/* الأحداث */
let h; let [c, b] = await call("POST", "/v1/events", { type: "order.created", id: "1001", data: { order_id: "1001", total: 4500 } }, A.key); ok("حدث مقبول 202", c === 202 && b.accepted === true, b);
[c, b] = await call("POST", "/v1/events", { type: "order.created", id: "1001", data: { order_id: "1001" } }, A.key); ok("تكرار الحدث نفسه لا يُدرج", c === 200 && b.duplicate === true && sql("SELECT COUNT(*) n FROM pf_events").n === 1);
[c] = await call("POST", "/v1/events", { type: "BAD", data: {} }, A.key); ok("نوع حدث غير صالح 400", c === 400);
[c] = await call("POST", "/v1/events", { type: "order.created", data: [] }, A.key); ok("data مصفوفة 400", c === 400);
[c] = await call("POST", "/v1/events", { type: "order.created", data: { x: "y".repeat(70000) } }, A.key); ok("data كبير 413", c === 413);
[c] = await call("GET", "/v1/events", null, B.key); ok("نطاق events:read ناقص 403", c === 403);
for (let i = 2; i <= 5; i++) await call("POST", "/v1/events", { type: "order.confirmed", id: "10" + i, data: { order_id: "10" + i } }, A.key);
[c, b] = await call("GET", "/v1/events", null, A.key, { limit: "3" }); ok("ترقيم بمؤشر", c === 200 && b.events.length === 3 && b.next > 0, b);
{ const [, b2] = await call("GET", "/v1/events", null, A.key, { limit: "3", after: String(b.next) }); ok("الصفحة التالية", b2.events.length === 2 && b2.next === null && b2.events[0].id < b.next, b2); }
[c, b] = await call("GET", "/v1/events", null, A.key, { type: "order.created" }); ok("تصفية بالنوع", b.events.length === 1 && b.events[0].data.order_id === "1001");
/* idempotency */
{ const h = { "idempotency-key": "k-1" }; const body = { type: "order.created", id: "2001", data: { order_id: "2001" } };
  const [c1, b1] = await call("POST", "/v1/events", body, A.key, {}, h); const [c2, b2, h2] = await call("POST", "/v1/events", body, A.key, {}, h);
  ok("Idempotency-Key: إعادة = نفس الردّ", c1 === 202 && c2 === 202 && h2["Idempotent-Replayed"] === "true" && JSON.stringify(b1) === JSON.stringify(b2));
  const [c3] = await call("POST", "/v1/events", { ...body, data: { order_id: "other" } }, A.key, {}, h); ok("نفس المفتاح بمحتوى مختلف 409", c3 === 409);
  const [c4] = await call("POST", "/v1/events", body, A.key, {}, { "idempotency-key": "bad key!" }); ok("مفتاح idempotency غير صالح 400", c4 === 400); }
/* التكاملات */
[c, b] = await call("PUT", "/v1/integrations/nope", { config: {} }, A.key); ok("مزوّد مجهول 400", c === 400);
[c] = await call("PUT", "/v1/integrations/meta", { config: { pixel_id: "111" }, secrets: { access_token: "SECRET-TOKEN-XYZ" } }, A.key); ok("ضبط meta", c === 200);
ok("السرّ مشفّر في القاعدة", !JSON.stringify(sqlAll("SELECT * FROM pf_integrations")).includes("SECRET-TOKEN-XYZ"));
[c, b] = await call("GET", "/v1/integrations", null, A.key); ok("القائمة بلا أسرار", c === 200 && b.integrations[0].hasSecrets === true && b.integrations[0].config.pixel_id === "111" && !JSON.stringify(b).includes("SECRET"));
await call("PUT", "/v1/integrations/meta", { config: { pixel_id: "222" } }, A.key); { const i = await app.ctx.integration(A.id, "meta"); ok("تحديث config يُبقي الأسرار", i.config.pixel_id === "222" && i.secrets.access_token === "SECRET-TOKEN-XYZ"); }
{ const i = await app.ctx.integration(B.id, "meta"); ok("عزل: مستأجر آخر لا يرى إعداد A", i === null); }
{ const E2 = makeEnv([], { noVault: true }); const t2 = await E2.tenant("N"); const [c2] = await E2.call("PUT", "/v1/integrations/meta", { config: {}, secrets: { access_token: "x" } }, t2.key); ok("بلا خزنة: رفض حفظ الأسرار 503", c2 === 503); }
/* المفاتيح العامة + CORS */
{ const [, k] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["events:write"], mode: "pub" }); ok("مفتاح عام بنطاق خاص مرفوض عند الإصدار", true); }
[c] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["events:write"], mode: "pub" }); ok("نطاق غير عام لمفتاح pub 400", c === 400);
let [, pk] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["fraud:check", "ab:assign"], mode: "pub" }); const PUB = pk.key;
await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://shop.example"] } });
[c, b] = await call("GET", "/v1/events", null, PUB, {}, { origin: "https://shop.example" }); ok("مفتاح عام لا يصل لمسار غير عام 403", c === 403);
[c, b, h] = await call("OPTIONS", "/v1/fraud/check", null, null, {}, { origin: "https://shop.example" }); ok("preflight 204 برؤوس CORS", c === 204 && h["Access-Control-Allow-Origin"] === "https://shop.example" && /Idempotency-Key/.test(h["Access-Control-Allow-Headers"]));
{ const E3 = makeEnv([{ id: "t", routes(r) { r.get("/v1/ping", { scope: "ab:assign" }, () => ({ status: 200, headers: {}, body: '{"pong":true}' })); } }]); const t3 = await E3.tenant("P"); const [, k3] = await E3.adm("POST", `/admin/tenants/${t3.id}/keys`, { scopes: ["ab:assign"], mode: "pub" });
  await E3.adm("PATCH", `/admin/tenants/${t3.id}`, { settings: { origins: ["https://ok.example"] } });
  let [c1, , h1] = await E3.call("GET", "/v1/ping", null, k3.key, {}, { origin: "https://ok.example" }); ok("مفتاح عام + أصل مسموح: 200 مع ACAO", c1 === 200 && h1["Access-Control-Allow-Origin"] === "https://ok.example");
  [c1] = await E3.call("GET", "/v1/ping", null, k3.key, {}, { origin: "https://evil.example" }); ok("أصل غير مسموح 403", c1 === 403);
  [c1] = await E3.call("GET", "/v1/ping", null, k3.key); ok("بلا Origin 403 لمفتاح عام", c1 === 403); }
/* OpenAPI */
[c, b] = await call("GET", "/openapi.json"); ok("openapi تلقائي بلا مسارات الإدارة", c === 200 && b.paths["/v1/events"].post["x-idempotent"] === true && !Object.keys(b.paths).some((p) => p.startsWith("/admin")) && !!b.paths["/v1/hooks/endpoints/{id}/test"], Object.keys(b.paths));

/* CAPI */
const order = { order_id: "F5D05", total: 4900, items: [{ id: "cream-1", qty: 2, price: 2000 }, { id: "honey-9", qty: 1, price: 900 }], customer: { id: "c1", name: "Amine Bouzid", phone: "0551234567", email: "Amine@X.dz", city: "Bab Ezzouar" }, click: { ip: "41.1.2.3", user_agent: "UA/1", fbp: "fb.1.x", fbc: "fb.1.y", ttclid: "TT1", sc_click_id: "SC1", url: "https://shop.example/p/cream" } };
for (const [p, cfg] of [["meta", { pixel_id: "111", test_event_code: "TEST123" }], ["tiktok", { pixel_id: "TTPIX" }], ["snapchat", { pixel_id: "SNAPPIX" }]]) await call("PUT", "/v1/integrations/" + p, { config: cfg, secrets: { access_token: "TOK-" + p } }, A.key);
sqlAll("SELECT id FROM pf_events").forEach(() => { }); E.db.exec("UPDATE pf_events SET state='done'");   // نتجاهل أحداث الاختبارات السابقة
fake.calls.length = 0; fake.handler = () => [200, { ok: true }];
await call("POST", "/v1/events", { type: "order.confirmed", id: "F5D05", data: order }, A.key);
let r = await app.cron(); const byHost = (h) => fake.calls.find((x) => x.url.includes(h));
ok("CAPI: ثلاث منصات استُدعيت", fake.calls.length === 3 && !!byHost("graph.facebook.com/v21.0/222/events") === false && !!byHost("graph.facebook.com") && !!byHost("business-api.tiktok.com") && !!byHost("tr.snapchat.com/v3/SNAPPIX/events"), fake.calls.map((x) => x.url.replace(/access_token=.*/, "")));
{ const m = JSON.parse(byHost("graph.facebook.com").init.body).data[0], u = m.user_data;
  ok("Meta: الحدث والمعرّف والتجزئة", m.event_name === "Purchase" && m.event_id === "F5D05_Purchase" && u.ph[0] === sha("213551234567") && u.em[0] === sha("amine@x.dz") && u.fn[0] === sha("amine") && u.ln[0] === sha("bouzid") && u.ct[0] === sha("babezzouar") && u.country[0] === sha("dz"), m);
  ok("Meta: غير مجزّأ = IP/UA/fbp فقط، والقيمة والعملة", u.client_ip_address === "41.1.2.3" && u.fbp === "fb.1.x" && m.custom_data.currency === "DZD" && m.custom_data.value === 4900 && m.custom_data.num_items === 3 && m.custom_data.contents[0].quantity === 2);
  ok("Meta: لا بيانات شخصية صريحة", !byHost("graph.facebook.com").init.body.includes("0551234567") && !byHost("graph.facebook.com").init.body.includes("Amine"));
  ok("Meta: رمز الدخول في الرابط وtest_event_code", byHost("graph.facebook.com").url.includes("access_token=TOK-meta") && JSON.parse(byHost("graph.facebook.com").init.body).test_event_code === "TEST123"); }
{ const t = byHost("business-api.tiktok.com"), m = JSON.parse(t.init.body); ok("TikTok: الرمز في الترويسة والحدث", t.init.headers["Access-Token"] === "TOK-tiktok" && m.event_source_id === "TTPIX" && m.data[0].event === "CompletePayment" && m.data[0].user.phone_number === sha("+213551234567") && m.data[0].user.ttclid === "TT1" && m.data[0].properties.contents[0].content_id === "cream-1", m); }
{ const s = JSON.parse(byHost("tr.snapchat.com").init.body).data[0]; ok("Snapchat: الحدث وsc_click_id", s.event_name === "PURCHASE" && s.user_data.sc_click_id === "SC1" && s.user_data.ph[0] === sha("213551234567") && s.action_source === "WEB", s); }
ok("سجلّ CAPI ثلاث نجاحات", sql("SELECT COUNT(*) n FROM cp_log WHERE ok=1").n === 3);
[c, b] = await call("GET", "/v1/capi/log", null, A.key); ok("واجهة السجلّ", c === 200 && b.log.length === 3 && b.log.every((x) => x.ok));
/* الفشل الجزئي: يُعاد المزوّد الفاشل فقط */
fake.calls.length = 0; fake.handler = (u) => (u.includes("tiktok") ? [500, "{}"] : [200, "{}"]);
await call("POST", "/v1/events", { type: "order.confirmed", id: "F5D06", data: { ...order, order_id: "F5D06" } }, A.key); r = await app.cron();
ok("فشل TikTok: الحدث يبقى معلقاً بتباعد", r.failed === 1 && sql("SELECT state, attempts FROM pf_events WHERE ext_id='order.confirmed:F5D06'").state === "pending");
clock.t += 120e3; fake.calls.length = 0; fake.handler = () => [200, "{}"]; r = await app.cron();
ok("إعادة المحاولة: TikTok وحده", fake.calls.length === 1 && fake.calls[0].url.includes("tiktok") && sql("SELECT state FROM pf_events WHERE ext_id='order.confirmed:F5D06'").state === "done", fake.calls.map((x) => x.url.slice(0, 40)));
/* مزوّد بلا إعداد، وحدث بلا order_id */
{ const E4 = makeEnv([capi]); const t4 = await E4.tenant("Z"); await E4.call("POST", "/v1/events", { type: "order.confirmed", data: { order_id: "1" } }, t4.key); await E4.app.cron(); ok("بلا تكاملات: لا استدعاءات ولا خطأ", E4.fake.calls.length === 0); }
{ const m = await buildMeta({ order_id: "9", event_id: "e", customer: { phone: "123" } }, "Lead", {}); ok("هاتف غير صالح لا يُجزَّأ ولا يكسر", !m.data[0].user_data.ph); }
/* HTTP 400 من المنصة لا يُعاد */
fake.calls.length = 0; fake.handler = () => [400, "{}"]; await call("POST", "/v1/events", { type: "order.created", id: "F5D07", data: { ...order, order_id: "F5D07" } }, A.key); r = await app.cron();
ok("400 من المنصة: لا إعادة محاولة", r.failed === 0 && sql("SELECT state FROM pf_events WHERE ext_id='order.created:F5D07'").state === "done");

/* hooks الصادرة */
fake.handler = () => [200, "{}"]; E.db.exec("UPDATE pf_events SET state='done'"); fake.calls.length = 0;
[c, b] = await call("POST", "/v1/hooks/endpoints", { url: "http://insecure.example/h" }, A.key); ok("webhook http مرفوض", c === 400);
[c, b] = await call("POST", "/v1/hooks/endpoints", { url: "https://zap.example/hook", events: ["order.*"] }, A.key); ok("تسجيل نقطة + سرّ مرة واحدة", c === 201 && b.secret.startsWith("whsec_")); const sec = b.secret, epId = b.id;
[c, b] = await call("POST", "/v1/hooks/endpoints", { url: "https://all.example/hook" }, A.key); const ep2 = b.id;
ok("السرّ مشفّر", !JSON.stringify(sqlAll("SELECT * FROM hk_endpoints")).includes(sec));
[c, b] = await call("GET", "/v1/hooks/endpoints", null, A.key); ok("القائمة بلا أسرار", b.endpoints.length === 2 && !JSON.stringify(b).includes("whsec_"));
await call("POST", "/v1/events", { type: "order.delivered", id: "D1", data: { order_id: "D1" } }, A.key); await call("POST", "/v1/events", { type: "payment.confirmed", id: "P1", data: { order_id: "P1" } }, A.key);
fake.calls.length = 0; await app.cron(); // معالجة الأحداث ثم التسليم في نفس الدورة؟ التسليم في cron الوحدة بعد الأحداث
const hooksCalls = () => fake.calls.filter((x) => x.url.includes("zap.example") || x.url.includes("all.example"));
ok("التوزيع: order.* ← نقطة 1 للتسليم فقط، * ← نقطة 2 للحدثين", hooksCalls().filter((x) => x.url.includes("zap")).length === 1 && hooksCalls().filter((x) => x.url.includes("all.example")).length === 2, hooksCalls().map((x) => x.url));
{ const call1 = hooksCalls().find((x) => x.url.includes("zap")), mm = /t=(\d+),v1=([0-9a-f]{64})/.exec(call1.init.headers["X-Platform-Signature"]);
  ok("توقيع HMAC صحيح", createHmac("sha256", sec).update(mm[1] + "." + call1.init.body).digest("hex") === mm[2] && call1.init.headers["X-Platform-Event"] === "order.delivered" && JSON.parse(call1.init.body).data.order_id === "D1"); }
/* فشل وإعادة */
fake.handler = () => [500, "{}"]; await call("POST", "/v1/events", { type: "order.created", id: "D2", data: { order_id: "D2" } }, A.key); fake.calls.length = 0; await app.cron();
ok("فشل التسليم يُجدوَل", sql("SELECT COUNT(*) n FROM hk_deliveries WHERE state='pending' AND attempts=1").n >= 1);
clock.t += 400e3; fake.handler = () => [200, "{}"]; fake.calls.length = 0; await app.cron(); ok("إعادة التسليم تنجح", sql("SELECT COUNT(*) n FROM hk_deliveries WHERE state='pending'").n === 0);
[c] = await call("POST", `/v1/hooks/endpoints/${epId}/test`, null, A.key); fake.calls.length = 0; await app.cron(); ok("ping اختباري", c === 202 && fake.calls.some((x) => x.init.headers["X-Platform-Event"] === "platform.ping"));
const Cc = await tenant("C"); [c, b] = await call("DELETE", `/v1/hooks/endpoints/${ep2}`, null, Cc.key); ok("عزل: لا يحذف مستأجر آخر نقطتي", b.removed === 0);
for (let i = 0; i < 9; i++) await call("POST", "/v1/hooks/endpoints", { url: `https://n${i}.example/h` }, A.key); [c] = await call("POST", "/v1/hooks/endpoints", { url: "https://over.example/h" }, A.key); ok("حدّ 10 نقاط", c === 402);
done();
