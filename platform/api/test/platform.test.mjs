/* اختبار منصة API (النواة + وحدة مكافحة الاحتيال): D1 تُحاكى بـnode:sqlite.   node --no-warnings platform/api/test/platform.test.mjs */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createPlatform, adminModule } from "../src/core.js";
import { antifraud, scoreOrder } from "../src/modules/antifraud.js";

let total = 0, fails = 0;
const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗ " + n + (x === undefined ? "" : " " + (typeof x === "string" ? x : JSON.stringify(x)))); } };
const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys = ON"); db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
const nz = (a) => a.map((v) => (v === undefined ? null : v));
const d1 = { prepare: (sql) => ({ bind: (...a) => ({ first: async () => db.prepare(sql).get(...nz(a)) ?? null, all: async () => ({ results: db.prepare(sql).all(...nz(a)) }), run: async () => { const r = db.prepare(sql).run(...nz(a)); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; } }) }) };
let T = Date.parse("2026-10-12T10:00:00Z");
const app = createPlatform({ d1, modules: [adminModule, antifraud], secret: "unit-test-secret-0123456789", adminToken: "adm-tok", clock: () => T });
const sql = (q, ...a) => db.prepare(q).get(...a), sqlAll = (q, ...a) => db.prepare(q).all(...a);
async function call(m, p, body = null, tok = null, q = {}, h = {}, ip = "9.9.9.9") {
  const r = await app.handle(m, p, q, { ...(tok ? { authorization: "Bearer " + tok } : {}), ...h }, body === null ? "" : JSON.stringify(body), ip);
  let j = {}; try { j = JSON.parse(r.body) ?? {}; } catch { } return [r.status, j, r.headers];
}
const adm = (m, p, b) => call(m, p, b, "adm-tok", {}, { "x-actor": "owner@x.dz" });

/* النواة */
let [c, b] = await call("GET", "/health"); ok("health يعدّد الوحدات", c === 200 && b.modules.includes("antifraud"));
[c] = await call("POST", "/admin/tenants", { name: "A" }); ok("إدارة بلا رمز 401", c === 401);
[c, b] = await adm("POST", "/admin/tenants", { name: "Shop A", site_ref: "alyssumdz" }); ok("إنشاء مستأجر", c === 201); const tA = b.id;
[c] = await adm("POST", "/admin/tenants", { name: "dup", site_ref: "alyssumdz" }); ok("الموقع نفسه مرتين 409", c === 409);
[c, b] = await adm("POST", `/admin/tenants/${tA}/keys`, { scopes: ["fraud:check", "fraud:report"] }); ok("مفتاح بنطاقات", c === 201 && /^pk_live_[0-9a-f]{40}$/.test(b.key)); const kA = b.key;
[c, b] = await adm("POST", `/admin/tenants/${tA}/keys`, { scopes: ["fraud:check"], mode: "test" }); const kAt = b.key;
[c, b] = await adm("POST", `/admin/tenants/${tA}/keys`, { scopes: ["bad scope"] }); ok("نطاق غير صالح 400", c === 400);
[c] = await adm("POST", "/admin/tenants/999/keys", {}); ok("مفتاح لمستأجر مجهول 404", c === 404);
[c, b] = await adm("POST", "/admin/tenants", { name: "Shop B" }); const tB = b.id; [c, b] = await adm("POST", `/admin/tenants/${tB}/keys`, { scopes: ["*"] }); const kB = b.key;
[c, b] = await adm("POST", "/admin/tenants", { name: "Shop C" }); const tC = b.id; [c, b] = await adm("POST", `/admin/tenants/${tC}/keys`, { scopes: ["fraud:check"] }); const kC = b.key;
[c] = await call("POST", "/v1/fraud/check", { phone: "0551234567" }); ok("بلا مفتاح 401", c === 401);
[c] = await call("POST", "/v1/fraud/report", { phone: "0551234567", reason: "fake" }, kC); ok("نطاق ناقص 403", c === 403);
[c] = await call("GET", "/nope", null, kA); ok("مسار مجهول 404", c === 404);
[c] = await call("GET", "/nope"); ok("مسار مجهول بلا مفتاح 401 (لا تسريب)", c === 401);
ok("المفتاح لا يُخزَّن صريحاً", !JSON.stringify(sqlAll("SELECT * FROM pf_keys")).includes(kA));
[c] = await call("POST", "/v1/fraud/check", "x".repeat(300000) && null, kA); ok("جسم غير JSON 400", c === 400);

/* التقييم النقي */
const base = { phoneValid: true, phone: "0551234567", name: "Amine Bouzid", deviceKnown: true, repeatPhone24h: 0, devicePhones24h: 0, ipPhones1h: 0, reportTenants: 0, ownReports: 0, total: 4500, avgTotal: 0, sampleSize: 0 };
ok("تقييم: طلب سليم = 0", scoreOrder(base).score === 0 && scoreOrder(base).action === "allow");
ok("تقييم: رقم غير صالح يتجاوز المراجعة", scoreOrder({ ...base, phoneValid: false }).action === "review" && scoreOrder({ ...base, phoneValid: false }).score >= 60);
ok("تقييم: رقم وهمي 0555555555", scoreOrder({ ...base, phone: "0555555555" }).reasons.some((r) => r.code === "fake_pattern"));
ok("تقييم: اسم بأرقام", scoreOrder({ ...base, name: "ahmed123" }).reasons.some((r) => r.code === "bad_name") && scoreOrder({ ...base, name: "aaaaa" }).reasons.some((r) => r.code === "bad_name") && !scoreOrder({ ...base, name: "علي بن محمد" }).reasons.some((r) => r.code === "bad_name"));
ok("تقييم: بلاغات 3 تجار = عالٍ", scoreOrder({ ...base, reportTenants: 3 }).level === "high");
ok("تقييم: الحد قابل للضبط", scoreOrder({ ...base, reportTenants: 1 }, { review: 15 }).action === "review" && scoreOrder({ ...base, reportTenants: 1 }).action === "allow");
ok("تقييم: block عند الحد", scoreOrder({ ...base, phoneValid: false, repeatPhone24h: 5, devicePhones24h: 7 }, { block: 80 }).action === "block");
ok("تقييم: سقف 100", scoreOrder({ ...base, phoneValid: false, repeatPhone24h: 9, devicePhones24h: 9, ipPhones1h: 9, reportTenants: 9, ownReports: 2 }).score === 100);
ok("تقييم: مبلغ شاذ يحتاج عينة", scoreOrder({ ...base, total: 90000, avgTotal: 4000, sampleSize: 10 }).reasons.some((r) => r.code === "amount_outlier") && !scoreOrder({ ...base, total: 90000, avgTotal: 4000, sampleSize: 2 }).reasons.length);

/* الفحص عبر الواجهة */
const chk = (k, o, ip) => call("POST", "/v1/fraud/check", o, k, {}, {}, ip);
[c, b] = await chk(kA, { phone: "+213 551 23 45 67", name: "Amine Bouzid", total: 4500, device: { fingerprint: "fp-AAA" } }); ok("فحص سليم: low/allow وهاتف مطبَّع", c === 200 && b.level === "low" && b.action === "allow" && b.normalizedPhone === "0551234567", b);
[c, b] = await chk(kA, { phone: "123", name: "X", total: 100 }); ok("هاتف غير صالح عالي الخطر", c === 200 && b.phoneValid === false && b.score >= 60);
ok("لا هاتف ولا IP صريح في القاعدة", !JSON.stringify(sqlAll("SELECT * FROM fr_checks")).includes("0551234567") && !JSON.stringify(sqlAll("SELECT * FROM fr_checks")).includes("9.9.9.9"));
for (let i = 0; i < 3; i++) await chk(kA, { phone: "0551234567", name: "Amine Bouzid", total: 4500, device: { fingerprint: "fp-AAA" } });
[c, b] = await chk(kA, { phone: "0551234567", name: "Amine Bouzid", total: 4500, device: { fingerprint: "fp-AAA" } }); ok("تكرار الرقم 24س يرفع الدرجة", b.reasons.some((r) => r.code === "repeat_phone"), b);
for (const ph of ["0661000001", "0661000002", "0661000003"]) await chk(kA, { phone: ph, name: "Karim Ali", total: 3000, device: { fingerprint: "fp-SHARED" } }, "5.5.5." + ph.slice(-1));
[c, b] = await chk(kB, { phone: "0771000008", name: "Samir Ben", total: 3000, device: { fingerprint: "fp-SHARED" } }); ok("V01-05: الافتراضي معزول — جهاز A لا يؤثر في B", c === 200 && !b.reasons.some((r) => r.code === "device_many_phones"), b);
await adm("PATCH", `/admin/tenants/${tB}`, { settings: { fraud: { network: true } } });
[c, b] = await chk(kB, { phone: "0771000009", name: "Samir Ben", total: 3000, device: { fingerprint: "fp-SHARED" } }); ok("جهاز واحد بأرقام كثيرة (عبر المستأجرين، باشتراك network)", b.reasons.some((r) => r.code === "device_many_phones"), b);
[c, b] = await chk(kA, { phone: "0771000010", name: "Samir Ben", total: 3000 }); ok("بلا بصمة جهاز +5", b.reasons.some((r) => r.code === "no_device"));
for (const ph of ["0770000001", "0770000002", "0770000003", "0770000004"]) await chk(kA, { phone: ph, name: "Lina Kaci", total: 2000, device: { fingerprint: "fp-" + ph } }, "7.7.7.7");
[c, b] = await chk(kA, { phone: "0770000005", name: "Lina Kaci", total: 2000, device: { fingerprint: "fp-x" } }, "7.7.7.7"); ok("IP واحد بأرقام كثيرة في ساعة", b.reasons.some((r) => r.code === "ip_many_phones"), b);
T += 3 * 3600e3; [c, b] = await chk(kA, { phone: "0770000006", name: "Lina Kaci", total: 2000, device: { fingerprint: "fp-y" } }, "7.7.7.7"); ok("نافذة الساعة تنقضي", !b.reasons.some((r) => r.code === "ip_many_phones"));

/* وضع الاختبار لا يكتب */
const before = sql("SELECT COUNT(*) n FROM fr_checks").n; await call("POST", "/v1/fraud/check", { phone: "0551111111", name: "Test Name", total: 1 }, kAt); ok("مفتاح الاختبار لا يسجّل", sql("SELECT COUNT(*) n FROM fr_checks").n === before);

/* البلاغات المشتركة */
[c] = await call("POST", "/v1/fraud/report", { phone: "0699999999", reason: "bad" }, kA); ok("سبب غير صالح 400", c === 400);
[c] = await call("POST", "/v1/fraud/report", { phone: "12", reason: "fake" }, kA); ok("هاتف غير صالح 422", c === 422);
[c] = await call("POST", "/v1/fraud/report", { phone: "0699999999", reason: "fake" }, kA); ok("بلاغ 201", c === 201);
[c, b] = await call("POST", "/v1/fraud/report", { phone: "0699999999", reason: "fake" }, kA); ok("بلاغ مكرر في اليوم لا يتضاعف", c === 200 && b.duplicate === true && sql("SELECT COUNT(*) n FROM fr_reports").n === 1);
ok("لا هاتف صريح في البلاغات", !JSON.stringify(sqlAll("SELECT * FROM fr_reports")).includes("0699999999"));
[c, b] = await chk(kB, { phone: "0699999999", name: "Nadir Hamidi", total: 5000, device: { fingerprint: "fp-n" } }); ok("تاجر آخر يرى الأثر (درجة ↑ بلا هوية المبلِّغ)", b.reasons.some((r) => r.code === "reported_others") && !JSON.stringify(b).includes("Shop A"), b);
[c, b] = await call("POST", "/v1/fraud/check", { phone: "0699999999", name: "Nadir Hamidi", total: 5000, device: { fingerprint: "fp-n" } }, kC); ok("V01-05: مستأجر بلا network لا يتأثر ببلاغات الآخرين", c === 200 && !b.reasons.some((r) => r.code === "reported_others"), b);
[c, b] = await call("GET", "/v1/fraud/phone/0699999999", null, kC); ok("V01-05: الاستعلام المجمَّع بلا network = 0", c === 200 && b.network === false && b.otherTenants === 0, b);
[c, b] = await chk(kA, { phone: "0699999999", name: "Nadir Hamidi", total: 5000, device: { fingerprint: "fp-n" } }); ok("المبلِّغ نفسه: reported_own وليس others", b.reasons.some((r) => r.code === "reported_own") && !b.reasons.some((r) => r.code === "reported_others"));
await call("POST", "/v1/fraud/report", { phone: "0699999999", reason: "returned" }, kB);
await adm("PATCH", `/admin/tenants/${tA}`, { settings: { fraud: { network: true } } });
[c, b] = await call("GET", "/v1/fraud/phone/0699999999", null, kA); ok("استعلام مجمَّع: عدد التجار الآخرين فقط (باشتراك network)", c === 200 && b.otherTenants === 1 && b.own[0].reason === "fake" && !JSON.stringify(b).includes("returned"), b);
[c, b] = await call("GET", "/v1/fraud/phone/abc", null, kA); ok("استعلام برقم خاطئ 422", c === 422);
[c, b] = await call("DELETE", "/v1/fraud/report/0699999999", null, kA); ok("المستأجر يسحب بلاغاته فقط", c === 200 && b.removed === 1 && sql("SELECT COUNT(*) n FROM fr_reports").n === 1);
{ let last = 0; for (let i = 0; i < 205; i++) { [c] = await call("POST", "/v1/fraud/report", { phone: "0660" + String(100000 + i), reason: "fake" }, kB); last = c; if (c === 429) break; }
  ok("V01-05: سقف البلاغات اليومي لكل مستأجر (429)", last === 429); }

/* أحداث عالية الخطر + cron */
ok("حدث fraud.high_risk في الصندوق", sql("SELECT COUNT(*) n FROM pf_events WHERE type='fraud.high_risk'").n >= 1);
let seen = []; const app2 = createPlatform({ d1, modules: [adminModule, antifraud, { id: "probe", routes() { }, on: { "fraud.high_risk": async (e) => { seen.push(e.tenantId); } } }], secret: "unit-test-secret-0123456789", clock: () => T });
let r = await app2.cron(); ok("cron يوزّع الأحداث على الوحدات", r.events >= 1 && seen.length >= 1 && sql("SELECT COUNT(*) n FROM pf_events WHERE state='pending'").n === 0, r);
const app3 = createPlatform({ d1, modules: [{ id: "bad", routes() { }, on: { "x.y": async () => { throw new Error("boom"); } } }], secret: "unit-test-secret-0123456789", clock: () => T });
await app3.ctx.emit(tA, "x.y", {}); r = await app3.cron(); ok("فشل المعالج يُجدوَل بتباعد", r.failed === 1 && sql("SELECT attempts, state FROM pf_events WHERE type='x.y'").attempts === 1 && sql("SELECT next_at FROM pf_events WHERE type='x.y'").next_at > Math.floor(T / 1000));

/* الاحتفاظ والمحو */
T += 100 * 86400e3; r = await app.cron(); ok("cron: حذف الفحوص الأقدم من 90 يوماً", r.antifraud.purgedChecks > 0 && sql("SELECT COUNT(*) n FROM fr_checks").n === 0, r);
await call("POST", "/v1/fraud/report", { phone: "0688888888", reason: "fraud" }, kA); await chk(kA, { phone: "0688888888", name: "Foo Bar", total: 10 });
[c] = await call("POST", "/admin/fraud/erase", { phone: "0688888888" }, kA); ok("المحو للمدير فقط 401", c === 401);
[c, b] = await adm("POST", "/admin/fraud/erase", { phone: "0688888888" }); ok("حق المحو يمحو كل أثر", c === 200 && b.reports === 1 && b.checks === 1 && sqlAll("SELECT * FROM fr_reports").every((x) => x.reason !== "fraud"));
[c, b] = await adm("GET", "/admin/audit"); ok("سجلّ التدقيق بلا أسرار ويسجّل الفاعل", b.audit.some((a) => a.action === "fraud.erase" && /^admin#[0-9a-f]{8}\/owner@x\.dz$/.test(a.actor)) && !JSON.stringify(b).includes("pk_live_"));
await adm("PATCH", `/admin/tenants/${tA}`, { status: "suspended" }); [c] = await chk(kA, { phone: "0551234567", name: "Amine Bouzid", total: 1 }); ok("مستأجر موقوف 401", c === 401);
await adm("PATCH", `/admin/tenants/${tA}`, { status: "active", settings: { fraud: { review: 5 } } }); [c, b] = await chk(kA, { phone: "0551234567", name: "Amine Bouzid", total: 1 }); ok("إعداد الحدّ لكل مستأجر", c === 200 && b.action === "review", b);
[c] = await call("POST", "/admin/cron"); ok("cron يدوي يتطلب رمز الإدارة", c === 401);
[c, b] = await adm("POST", "/admin/cron"); ok("cron يدوي للمدير", c === 200 && b.ok === true && "events" in b, b);
console.log(fails ? `\n✗ ${fails} من ${total} فشل` : `✓ ${total} فحصاً ناجحاً`); process.exit(fails ? 1 : 0);
