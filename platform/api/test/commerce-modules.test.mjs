/* المنتجات الرقمية، WhatsApp، Google Sheets. */
import { createHmac } from "node:crypto";
import { makeEnv, Tally } from "./_harness.mjs";
import { digital, emailHtml } from "../src/modules/digital.js";
import { whatsapp, classifyReply, templateParams } from "../src/modules/whatsapp.js";
import { sheets, toRow } from "../src/modules/sheets.js";
const { ok, done } = Tally();
const files = { store: { "books/guide.pdf": new Blob(["PDFDATA"]).stream() }, async get(k) { return this.store[k] ? { body: this.store[k] } : null; } };
const E = makeEnv([digital, whatsapp, sheets], { files }); const { call, adm, tenant, fake, clock, sql, sqlAll, app } = E;
const A = await tenant("A"), B = await tenant("B"); const text = async (r) => { const out = []; if (r.stream) { const rd = r.stream.getReader(); for (;;) { const { done: d, value } = await rd.read(); if (d) break; out.push(Buffer.from(value)); } } return Buffer.concat(out).toString(); };

/* ───── المنتجات الرقمية ───── */
let [c, b] = await call("POST", "/v1/digital/assets", { sku: "ebook-1", name: "دليل <b>العناية</b>", location: "http://x.example/f.pdf" }, A.key); ok("موقع http مرفوض", c === 400);
[c] = await call("POST", "/v1/digital/assets", { sku: "bad sku", location: "https://f.example/a.pdf" }, A.key); ok("sku غير صالح 400", c === 400);
[c, b] = await call("POST", "/v1/digital/assets", { sku: "ebook-1", name: "دليل <b>العناية</b>", location: "https://files.example/secret-123/guide.pdf?sig=SECRETSIG", file_name: "../../etc/pass wd.pdf", content_type: "application/pdf" }, A.key); ok("تسجيل ملف", c === 201); const aid = b.id;
ok("الموقع مشفّر في القاعدة", !JSON.stringify(sqlAll("SELECT * FROM dg_assets")).includes("SECRETSIG"));
[c] = await call("POST", "/v1/digital/assets", { sku: "ebook-1", location: "https://f.example/x" }, A.key); ok("sku مكرر 409", c === 409);
[c] = await call("POST", "/v1/digital/assets", { sku: "r2-1", location: "r2:books/guide.pdf", name: "R2" }, A.key); ok("موقع r2 مقبول حين R2 مفعّل", c === 201);
[c, b] = await call("GET", "/v1/digital/assets", null, A.key); ok("القائمة بلا مواقع", b.assets.length === 2 && !JSON.stringify(b).includes("files.example"));
await call("PUT", "/v1/integrations/email", { config: { from: "متجر <shop@x.dz>" }, secrets: { api_key: "re_KEY" } }, A.key);
[c, b] = await call("POST", "/v1/digital/grants", { sku: "ebook-1", order_ref: "O1", email: "buyer@x.dz", name: "<script>alert(1)</script>" }, A.key);
ok("منحة يدوية + بريد", c === 201 && /^https:\/\/api\.example\/d\/[0-9a-f]{64}$/.test(b.url) && b.emailed === true && b.expires_hours === 72 && b.max_downloads === 3, b); const link = b.url, tok = link.split("/").pop();
{ const em = fake.calls.at(-1); const body = JSON.parse(em.init.body); ok("بريد Resend: الترويسة والمستلم", em.url === "https://api.resend.com/emails" && em.init.headers.Authorization === "Bearer re_KEY" && body.to[0] === "buyer@x.dz");
  ok("البريد: هروب HTML للاسم", !body.html.includes("<script>") && body.html.includes("&lt;script&gt;") && body.html.includes(link) && body.html.includes("dir=\"rtl\"")); }
ok("الرمز والبريد لا يُخزَّنان صريحين", !JSON.stringify(sqlAll("SELECT * FROM dg_grants")).includes(tok) && !JSON.stringify(sqlAll("SELECT * FROM dg_grants")).includes("buyer@x.dz"));
[c] = await call("POST", "/v1/digital/grants", { sku: "ebook-1", order_ref: "O1" }, A.key); ok("منحة الطلب نفسه مكررة 409", c === 409);
/* التنزيل */
fake.handler = (u) => (u.startsWith("https://files.example") ? [200, "FILEBYTES", {}, new Blob(["FILEBYTES"]).stream()] : [200, "{}"]);
let [, , h, rr] = await call("GET", "/d/" + tok); ok("تنزيل ناجح: رؤوس آمنة", rr.status === 200 && h["Content-Disposition"].includes("attachment") && !h["Content-Disposition"].includes("..") && !h["Content-Disposition"].includes("/") && h["Cache-Control"].includes("no-store") && h["X-Robots-Tag"] === "noindex", h);
ok("محتوى الملف يصل", (await text(rr)) === "FILEBYTES");
ok("الطلب لم يتبع التحويلات", fake.calls.at(-1).init.redirect === "manual");
await call("GET", "/d/" + tok); await call("GET", "/d/" + tok); [c, b] = await call("GET", "/d/" + tok); ok("بعد 3 مرات: 410 limit_reached", c === 410 && b.error.code === "limit_reached" && sql("SELECT downloads d FROM dg_grants").d === 3);
[c] = await call("GET", "/d/" + "0".repeat(64)); ok("رمز مجهول 404", c === 404); [c] = await call("GET", "/d/short"); ok("رمز مشوّه 404", c === 404);
/* انتهاء المدة والإلغاء واسترداد العدّ */
[, b] = await call("POST", "/v1/digital/grants", { sku: "ebook-1", order_ref: "O2", expires_hours: 1, max_downloads: 5 }, A.key); const t2 = b.url.split("/").pop(), g2 = b.id;
clock.t += 2 * 3600e3; [c, b] = await call("GET", "/d/" + t2); ok("بعد انتهاء المدة 410 expired", c === 410 && b.error.code === "expired");
clock.t = Date.parse("2026-10-12T10:00:00Z"); [, b] = await call("POST", "/v1/digital/grants", { sku: "ebook-1", order_ref: "O3" }, A.key); const t3 = b.url.split("/").pop(), g3 = b.id;
fake.handler = () => [503, "down", {}, null]; [c, b] = await call("GET", "/d/" + t3); ok("المصدر معطّل: 502 ولا يُحتسب التنزيل", c === 502 && sql("SELECT downloads d FROM dg_grants WHERE id=?", g3).d === 0, b);
[c, b] = await call("DELETE", "/v1/digital/grants/" + g3, null, B.key); ok("عزل: B لا يلغي منح A", b.revoked === 0);
await call("DELETE", "/v1/digital/grants/" + g3, null, A.key); fake.handler = () => [200, "X", {}, new Blob(["X"]).stream()]; [c, b] = await call("GET", "/d/" + t3); ok("منحة ملغاة 410", c === 410 && b.error.code === "revoked");
[, b] = await call("POST", "/v1/digital/grants", { sku: "r2-1", order_ref: "O4" }, A.key); [, , , rr] = await call("GET", "/d/" + b.url.split("/").pop()); ok("تنزيل من R2", rr.status === 200 && (await text(rr)) === "PDFDATA");
[c, b] = await call("GET", "/v1/digital/grants", null, A.key, { order_ref: "O1" }); ok("قائمة المنح بـorder_ref بلا روابط", b.grants.length === 1 && b.grants[0].downloads === 3 && !JSON.stringify(b).includes("/d/"));
/* حدث الدفع التلقائي */
E.db.exec("UPDATE pf_events SET state='done'"); fake.calls.length = 0; fake.handler = () => [200, "{}"];
await call("POST", "/v1/events", { type: "payment.confirmed", id: "P100", data: { order_id: "P100", customer: { email: "c@x.dz", name: "علي" }, items: [{ id: "ebook-1" }, { id: "physical-1" }] } }, A.key); let r = await app.cron();
ok("الدفع المؤكَّد: منحة واحدة (للرقمي فقط) + بريد + حدث digital.delivered", sql("SELECT COUNT(*) n FROM dg_grants WHERE order_ref='P100'").n === 1 && fake.calls.filter((x) => x.url.includes("resend")).length === 1 && sql("SELECT COUNT(*) n FROM pf_events WHERE type='digital.delivered'").n === 1, r);
await call("POST", "/v1/events", { type: "payment.confirmed", id: "P100b", data: { order_id: "P100", customer: { email: "c@x.dz" }, items: [{ id: "ebook-1" }] } }, A.key); fake.calls.length = 0; await app.cron(); ok("الطلب نفسه لا يُمنح مرتين ولا يُرسل بريد ثانٍ", sql("SELECT COUNT(*) n FROM dg_grants WHERE order_ref='P100'").n === 1 && fake.calls.length === 0);
fake.handler = (u) => (u.includes("resend") ? [500, "{}"] : [200, "{}"]);
await call("POST", "/v1/events", { type: "payment.confirmed", id: "P101", data: { order_id: "P101", customer: { email: "d@x.dz" }, items: [{ id: "ebook-1" }] } }, A.key); r = await app.cron();
ok("فشل البريد: تُلغى المنحة ويُعاد الحدث (لا منحة بلا رابط واصل)", r.failed === 1 && sql("SELECT COUNT(*) n FROM dg_grants WHERE order_ref='P101'").n === 0);
clock.t += 120e3; fake.handler = () => [200, "{}"]; await app.cron(); ok("إعادة المحاولة تنجح", sql("SELECT COUNT(*) n FROM dg_grants WHERE order_ref='P101'").n === 1);
ok("قالب البريد بالفرنسية ltr", emailHtml("fr", "Yassine", [{ url: "https://a/d/x", name: "Guide" }], 72, 3).includes('dir="ltr"') && emailHtml("fr", "Y", [], 1, 1).includes("Bonjour"));

/* ───── WhatsApp ───── */
ok("تصنيف الردود", classifyReply("نعم") === "confirm" && classifyReply(" 1 ") === "confirm" && classifyReply("Oui!") === "confirm" && classifyReply("لا") === "cancel" && classifyReply("annuler") === "cancel" && classifyReply("ممكن غدا") === null && classifyReply("") === null);
ok("متغيّرات القالب", JSON.stringify(templateParams({ order_id: "9", total: 4500, customer: { name: "Ali" } })) === JSON.stringify([{ type: "text", text: "Ali" }, { type: "text", text: "9" }, { type: "text", text: "4500" }]) && templateParams({ order_id: "9" }, ["city"])[0].text === "-");
await call("PUT", "/v1/integrations/whatsapp", { config: { phone_number_id: "PN1", template: "order_confirm", lang: "ar" }, secrets: { access_token: "WA-TOK", app_secret: "APPSEC", verify_token: "VT123" } }, A.key);
[c, b] = await call("POST", "/v1/wa/setup", null, A.key); ok("setup: رابط الاستقبال", c === 200 && /^https:\/\/api\.example\/v1\/wa\/[0-9a-f]{24}$/.test(b.webhook_url)); const hook = b.webhook_url.split("/").pop();
{ const [, b2] = await call("POST", "/v1/wa/setup", null, A.key); ok("setup ثابت", b2.webhook_url === b.webhook_url); }
[c, , , rr] = await call("GET", "/v1/wa/" + hook, null, null, { "hub.mode": "subscribe", "hub.verify_token": "VT123", "hub.challenge": "CH42" }); ok("تحقق Meta يعيد challenge", rr.status === 200 && rr.body === "CH42");
[c] = await call("GET", "/v1/wa/" + hook, null, null, { "hub.mode": "subscribe", "hub.verify_token": "WRONG", "hub.challenge": "x" }); ok("رمز تحقق خاطئ 403", c === 403);
E.db.exec("UPDATE pf_events SET state='done'"); fake.calls.length = 0; fake.handler = () => [200, { messages: [{ id: "wamid" }] }];
await call("POST", "/v1/events", { type: "order.created", id: "W1", data: { order_id: "W1", total: 4500, customer: { name: "Amine", phone: "0551234567" } } }, A.key); await app.cron();
{ const w = fake.calls.find((x) => x.url.includes("/PN1/messages")), body = JSON.parse(w.init.body); ok("إرسال قالب WhatsApp", w.init.headers.Authorization === "Bearer WA-TOK" && body.to === "213551234567" && body.template.name === "order_confirm" && body.template.components[0].parameters[0].text === "Amine" && body.template.language.code === "ar", body); }
ok("ربط المستلم بالطلب مجزّأً", sql("SELECT COUNT(*) n FROM wa_sent WHERE order_id='W1'").n === 1 && !JSON.stringify(sqlAll("SELECT * FROM wa_sent")).includes("213551234567"));
fake.calls.length = 0; await call("POST", "/v1/events", { type: "order.created", id: "W1b", data: { order_id: "W1", customer: { phone: "0551234567" } } }, A.key); await app.cron(); ok("لا رسالة ثانية لنفس الطلب", fake.calls.filter((x) => x.url.includes("/messages")).length === 0);
const inbound = (text, id = "wamid.IN1", from = "213551234567", secret = "APPSEC") => { const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from, id, type: "text", text: { body: text } }] } }] }] }); return call("POST", "/v1/wa/" + hook, raw, null, {}, { "x-hub-signature-256": "sha256=" + createHmac("sha256", secret).update(raw).digest("hex") }); };
[c] = await inbound("نعم", "m0", "213551234567", "WRONG"); ok("توقيع خاطئ 401", c === 401);
[c, b] = await inbound("نعم"); ok("ردّ «نعم» يُنتج order.customer_confirmed", c === 200 && b.events === 1 && sql("SELECT payload FROM pf_events WHERE type='order.customer_confirmed'").payload.includes("W1"), b);
[c, b] = await inbound("نعم"); ok("ردّ مكرر (نفس wamid) لا يتكرر", b.events === 0);
[c, b] = await inbound("لا", "wamid.IN2"); ok("ردّ «لا» ← order.customer_cancelled", b.events === 1 && sql("SELECT COUNT(*) n FROM pf_events WHERE type='order.customer_cancelled'").n === 1);
[c, b] = await inbound("نعم", "wamid.IN3", "213661999999"); ok("رقم لم نراسله لا يُطابَق", b.events === 0);
[c, b] = await inbound("ربما", "wamid.IN4"); ok("ردّ غير مفهوم يُتجاهل", b.events === 0);
fake.handler = () => [500, "{}"]; await call("POST", "/v1/events", { type: "order.created", id: "W2", data: { order_id: "W2", customer: { phone: "0661111111" } } }, A.key); r = await app.cron(); ok("خطأ 500 من Meta يُعاد", r.failed === 1);
fake.handler = () => [400, "{}"]; clock.t += 120e3; r = await app.cron(); ok("400 (قالب/رقم) لا يُعاد", r.failed === 0 && sql("SELECT COUNT(*) n FROM wa_sent WHERE order_id='W2'").n === 0);

/* ───── Sheets ───── */
ok("تحويل الصف", toRow("order.confirmed", { order_id: "5", total: 100, customer: { name: "A", phone: "05", wilaya: "Alger" }, items: [{ title: "كريم", qty: 2 }] }).items === "كريم ×2" && toRow("order.delivered", { order_id: "5" }).status === "livree");
await call("PUT", "/v1/integrations/sheets", { config: { script_url: "https://evil.example/exec" }, secrets: { shared_secret: "SS" } }, A.key);
E.db.exec("UPDATE pf_events SET state='done'"); fake.calls.length = 0; fake.handler = () => [200, "{}"];
await call("POST", "/v1/events", { type: "order.created", id: "S0", data: { order_id: "S0" } }, A.key); await app.cron(); ok("رابط غير Google مرفوض", fake.calls.filter((x) => x.url.includes("evil")).length === 0);
await call("PUT", "/v1/integrations/sheets", { config: { script_url: "https://script.google.com/macros/s/AKfy/exec" } }, A.key);
await call("POST", "/v1/events", { type: "order.confirmed", id: "S1", data: { order_id: "S1", total: 4500, customer: { name: "Amine", phone: "0551234567" } } }, A.key); await app.cron();
{ const s = fake.calls.find((x) => x.url.includes("script.google.com")), body = JSON.parse(s.init.body); ok("إرسال الصف إلى Apps Script", body.secret === "SS" && body.action === "upsert" && body.row.order_id === "S1" && body.row.status === "confirmee" && s.init.redirect === "follow", body); }
[c] = await call("POST", "/v1/sheets/inbound", { updates: "x" }, A.key); ok("updates غير مصفوفة 400", c === 400);
[c, b] = await call("POST", "/v1/sheets/inbound", { updates: [{ order_id: "S1", status: "confirmee", note: "تم الاتصال", v: "1" }, { order_id: "bad id!", status: "x" }, { order_id: "S2", status: "annulee", attempt: 9, v: "1" }] }, A.key); ok("استقبال تحديثات: 2 مقبولة و1 مرفوضة", c === 200 && b.accepted === 2 && b.rejected === 1, b);
[c, b] = await call("POST", "/v1/sheets/inbound", { updates: [{ order_id: "S1", status: "confirmee", note: "تم الاتصال", v: "1" }] }, A.key); ok("تحديث مكرر (نفس v) لا يتكرر", b.accepted === 0);
[c, b] = await call("GET", "/v1/events", null, A.key, { type: "order.sheet_update" }); ok("المتجر يقرأ التحديثات عبر /v1/events (attempt محصور 0..3)", b.events.length === 2 && b.events.some((e) => e.data.order_id === "S2" && e.data.attempt === 3 && e.data.source === "sheets"));
done();
