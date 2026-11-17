/* وحدة Beta عبر نقطة دخول Worker الفعلية (src/index.js، ENVIRONMENT=beta): افتراضات آمنة، دعوات، مراحل، إيقاف تسجيل، تعطيل حساب، حدود استخدام ذرّية، وتغذية راجعة. ⚠ LOCAL ONLY (D1 = node:sqlite). */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";
import { Tally } from "./_harness.mjs";
const { ok, done } = Tally(); const SCHEMA = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
function mkD1() { const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys = ON"); db.exec(SCHEMA); const nz = (a) => a.map((v) => (v === undefined ? null : v));
  return { db, d1: { prepare: (sql) => ({ bind: (...a) => ({ __sql: sql, __a: a, first: async () => db.prepare(sql).get(...nz(a)) ?? null, all: async () => ({ results: db.prepare(sql).all(...nz(a)) }), run: async () => { const r = db.prepare(sql).run(...nz(a)); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; } }) }), batch: async () => [] } }; }
const OUT = []; const realFetch = globalThis.fetch; globalThis.fetch = async (u) => { OUT.push(String(u)); return new Response("{}", { status: 200 }); };
const B = mkD1(), P = mkD1(); B.db.prepare("INSERT INTO pf_meta (k,v,at) VALUES ('environment','beta','t')").run();
const ADM = "beta-admin-token-fedcba9876543210", KEY = Buffer.from(new Uint8Array(32).fill(9)).toString("base64");
const benv = { DB: B.d1, PLATFORM_SECRET: "beta-platform-secret-9876543210abc", ADMIN_TOKEN: ADM, APP_ENCRYPTION_KEY: KEY, ENVIRONMENT: "beta", PUBLIC_URL: "https://alyssum-platform-api-beta.saber-balbouzi.workers.dev", GIT_SHA: "sha-beta-1" };
const penv = { DB: P.d1, PLATFORM_SECRET: "prod-platform-secret-0123456789", ADMIN_TOKEN: "prod-admin-token-0123456789abcdef" };
const call = async (env, m, path, body, tok, h = {}) => { const r = await worker.fetch(new Request("https://x.test" + path, { method: m, headers: { ...(tok ? { authorization: "Bearer " + tok } : {}), "content-type": "application/json", ...h }, body: body == null ? undefined : JSON.stringify(body) }), env); let j = {}; try { j = await r.json(); } catch { } return [r.status, j]; };
const adm = (m, p, b) => call(benv, m, p, b, ADM, { "x-actor": "owner@x.dz" });
let ipn = 0; const signup = (body, ip = "5.5." + Math.floor(++ipn / 250) + "." + (ipn % 250)) => call(benv, "POST", "/v1/beta/signup", body, null, { "cf-connecting-ip": ip });          // IP مختلف لكل محاولة (حدّ التسجيل 5/ساعة لكل IP يُختبَر منفصلاً M11)
const invite = async (o = {}) => (await adm("POST", "/admin/beta/invites", o))[1];
/* M1 */
{ const [c, j] = await call(benv, "GET", "/v1/beta/status"); ok("[M1] افتراضياً: المرحلة internal والتسجيل مغلق ونص تنبيه Beta ظاهر (بلا مصادقة)", c === 200 && j.phase === "internal" && j.signups_open === false && /Beta/.test(j.banner) && j.environment === "beta", j);
  const [c2, j2] = await signup({ name: "تاجر" }); ok("[M1] التسجيل مغلق افتراضياً ← 403 signups_paused", c2 === 403 && j2.error.code === "signups_paused"); }
/* M2: الدعوات */
{ const inv = await invite({ note: "اختبار", email: "someone@example.com", internal: true, max_uses: 1 }); ok("[M2] الدعوة: كود يظهر مرة واحدة ولا يُرسَل أي شيء (لا اتصال صادر)", /^BETA-[0-9A-F]{16}-[0-9A-F]{8}$/.test(inv.code) && OUT.length === 0, { code: !!inv.code, OUT });
  ok("[M2] لا يُخزَّن الكود ولا البريد نصاً في القاعدة (هاش/HMAC فقط)", !JSON.stringify(B.db.prepare("SELECT * FROM beta_invites").all()).includes(inv.code) && !JSON.stringify(B.db.prepare("SELECT * FROM beta_invites").all()).includes("someone@example.com"));
  globalThis.INV1 = inv; }
/* M3: المراحل + فتح/إغلاق التسجيل */
{ const inv = globalThis.INV1; await adm("POST", "/admin/beta/signups", { open: true });
  ok("[M3] التسجيل مفتوح لكن بلا دعوة في internal ← 403 invite_required", (await signup({ name: "x1" }))[1].error?.code === "invite_required");
  const non = await invite({ note: "عادية" }); ok("[M3] دعوة غير داخلية في مرحلة internal ← 403 beta_internal_only (ولا تُستهلك)", (await signup({ name: "x2", invite: non.code }))[1].error?.code === "beta_internal_only" && B.db.prepare("SELECT uses FROM beta_invites WHERE id=?").get(non.id).uses === 0);
  const [c, j] = await signup({ name: "فريق داخلي", invite: inv.code }); ok("[M3] دعوة داخلية صالحة ← 201: مستأجر + مفتاح **تجريبي** pk_test_ + حدود افتراضية", c === 201 && /^pk_test_[0-9a-f]{40}$/.test(j.key) && j.mode === "test" && j.limits.requests_per_day > 0, { c, mode: j.mode });
  const t = B.db.prepare("SELECT settings FROM pf_tenants WHERE id=?").get(j.tenant_id); ok("[M3] إعدادات المستأجر: beta=true وبصمة الدعوة والحدود", JSON.parse(t.settings).beta === true && JSON.parse(t.settings).beta_invite === inv.id);
  ok("[M3] إعادة استعمال دعوة (max_uses=1) ← مرفوضة", (await signup({ name: "x3", invite: inv.code }))[1].error?.code === "invite_required");
  globalThis.T1 = j; }
/* M4: ذرّية الاستهلاك */
{ const inv = await invite({ internal: true, max_uses: 2 }); const rs = await Promise.all(Array.from({ length: 6 }, (_, i) => signup({ name: "سباق " + i, invite: inv.code }, "7.7.7." + i)));
  ok("[M4] 6 تسجيلات متزامنة بدعوة max_uses=2 ← نجح 2 فقط", rs.filter((r) => r[0] === 201).length === 2 && B.db.prepare("SELECT uses FROM beta_invites WHERE id=?").get(inv.id).uses === 2, rs.map((r) => r[0])); }
/* M5: إيقاف التسجيل مؤقتاً + سحب دعوة + انتهاء */
{ const inv = await invite({ internal: true }); await adm("POST", "/admin/beta/signups", { open: false });
  ok("[M5] إيقاف التسجيل ← دعوة صالحة لا تكفي (signups_paused) ولا تُستهلك", (await signup({ name: "p1", invite: inv.code }))[1].error?.code === "signups_paused" && B.db.prepare("SELECT uses FROM beta_invites WHERE id=?").get(inv.id).uses === 0);
  await adm("POST", "/admin/beta/signups", { open: true }); await adm("POST", `/admin/beta/invites/${inv.id}/revoke`); ok("[M5] دعوة مسحوبة ← مرفوضة", (await signup({ name: "p2", invite: inv.code }))[1].error?.code === "invite_required");
  const inv2 = await invite({ internal: true }); B.db.prepare("UPDATE beta_invites SET expires_at=1 WHERE id=?").run(inv2.id); ok("[M5] دعوة منتهية ← مرفوضة", (await signup({ name: "p3", invite: inv2.code }))[1].error?.code === "invite_required");
  ok("[M5] أكواد مشوّهة/قصيرة/حقن ← مرفوضة بلا خطأ خادم", (await Promise.all(["", "x", "' OR 1=1 --", "A".repeat(200), null].map((c) => signup({ name: "bad", invite: c })))).every((r) => r[0] === 403)); }
/* M6: المراحل closed/public */
{ await adm("POST", "/admin/beta/phase", { phase: "closed" }); const inv = await invite({ note: "تاجر مختار" }); const [c] = await signup({ name: "تاجر مختار", invite: inv.code }); ok("[M6] مرحلة closed: دعوة عادية تعمل", c === 201);
  ok("[M6] closed بلا دعوة ← 403", (await signup({ name: "بلا دعوة" }))[0] === 403);
  await adm("POST", "/admin/beta/phase", { phase: "public" }); const [c2, j2] = await signup({ name: "عام" }); ok("[M6] مرحلة public + التسجيل مفتوح: بلا دعوة ← 201 بمفتاح تجريبي", c2 === 201 && /^pk_test_/.test(j2.key));
  await adm("POST", "/admin/beta/signups", { open: false }); ok("[M6] public + مُوقَف ← 403 signups_paused", (await signup({ name: "عام2" }))[1].error?.code === "signups_paused");
  ok("[M6] مرحلة غير صالحة ← 400", (await adm("POST", "/admin/beta/phase", { phase: "ga" }))[0] === 400); await adm("POST", "/admin/beta/phase", { phase: "internal" }); }
/* M7: تعطيل حساب */
{ const T = globalThis.T1, probe = () => call(benv, "GET", "/v1/orders?limit=1", null, T.key); const before = (await probe())[0];
  const [c] = await adm("POST", `/admin/beta/tenants/${T.tenant_id}/disable`); const after = (await probe())[0]; ok("[M7] تعطيل الحساب: مفتاحه يتوقف فوراً (401) بعد أن كان يعمل", before !== 401 && c === 200 && after === 401, { before, after });
  await adm("POST", `/admin/beta/tenants/${T.tenant_id}/enable`); ok("[M7] إعادة التفعيل تُعيده", (await probe())[0] !== 401); ok("[M7] تعطيل مستأجر غير موجود ← 404", (await adm("POST", "/admin/beta/tenants/99999/disable"))[0] === 404); }
/* M8: حدود الاستخدام ذرّية */
{ const [, s] = await adm("POST", "/admin/beta/signups", { open: true }); await adm("POST", "/admin/beta/phase", { phase: "public" }); const [, j] = await signup({ name: "حدود" }, "8.8.8.8"); const T = j;
  const [cl, jl] = await adm("POST", `/admin/beta/tenants/${T.tenant_id}/limits`, { requests_per_day: 5, orders_per_day: 1 }); ok("[M8] ضبط الحدود", cl === 200 && jl.limits.requests_per_day === 5);
  const rs = await Promise.all(Array.from({ length: 10 }, () => call(benv, "GET", "/v1/orders?limit=1", null, T.key))); const allowed = rs.filter((r) => r[0] !== 429).length, limited = rs.filter((r) => r[1].error?.code === "beta_limit_reached").length;
  ok("[M8] 10 طلبات متزامنة بحدّ 5/يوم ← 5 تمرّ و5 تُحجب (ذرّي، 429 beta_limit_reached)", allowed === 5 && limited === 5, { allowed, limited });
  ok("[M8] العدّاد اليومي مسجَّل ولا يتجاوز الحدّ", B.db.prepare("SELECT requests FROM beta_usage WHERE tenant_id=?").get(T.tenant_id).requests === 5);
  const [, j2] = await signup({ name: "حدود2" }, "8.8.8.9"); await adm("POST", `/admin/beta/tenants/${j2.tenant_id}/limits`, { orders_per_day: 1 }); const o1 = await call(benv, "POST", "/v1/orders", { ref: "L1", lines: [] }, j2.key), o2 = await call(benv, "POST", "/v1/orders", { ref: "L2", lines: [] }, j2.key);
  ok("[M8] حدّ الطلبات اليومي: الطلب الثاني ← 429 (الأول مرّ للمعالج)", o1[0] !== 429 && o2[0] === 429 && o2[1].error.code === "beta_limit_reached", { o1: o1[0], o2: o2[0] });
  ok("[M8] قيم حدود غير صالحة ← 400", (await adm("POST", `/admin/beta/tenants/${T.tenant_id}/limits`, { requests_per_day: -3 }))[0] === 400 && (await adm("POST", `/admin/beta/tenants/${T.tenant_id}/limits`, { orders_per_day: "abc" }))[0] === 400);
  const [, j3] = await signup({ name: "بلا حدود صريحة" }, "8.8.8.1"); ok("[M8] حساب جديد يحمل حدوداً افتراضية (ليس بلا سقف)", JSON.parse(B.db.prepare("SELECT settings FROM pf_tenants WHERE id=?").get(j3.tenant_id).settings).beta_limits.requests_per_day > 0); }
/* M9: التغذية الراجعة */
{ const fb = (b, ip = "9.9.9.9") => call(benv, "POST", "/v1/beta/feedback", b, null, { "cf-connecting-ip": ip }); const [c, j] = await fb({ kind: "bug", message: "زر الإرسال لا يعمل", page: "/admin.html", contact: "me@x.dz" });
  ok("[M9] ملاحظة عامة (بلا مصادقة) ← 201 ومُختومة بـSHA الإصدار", c === 201 && B.db.prepare("SELECT version FROM beta_feedback WHERE id=?").get(j.id).version === "sha-beta-1");
  ok("[M9] رسالة قصيرة ← 400؛ نوع غير معروف ← feedback؛ نص طويل يُقتطع 2000", (await fb({ message: "x" }))[0] === 400 && (await fb({ kind: "weird", message: "رسالة صالحة" })).at(0) === 201 && (await fb({ message: "ي".repeat(5000) }))[0] === 201 && B.db.prepare("SELECT MAX(LENGTH(message)) m FROM beta_feedback").get().m === 2000);
  let last = 0; for (let i = 0; i < 12; i++) last = (await fb({ message: "تكرار " + i }, "3.3.3.3"))[0]; ok("[M9] حدّ 10/ساعة لكل IP ← 429 بعد ذلك", last === 429);
  const [cl, jl] = await adm("GET", "/admin/beta/feedback?limit=3"); ok("[M9] الإدارة تقرأ آخر الملاحظات", cl === 200 && jl.feedback.length === 3); }
/* M11: حدّ التسجيل لكل IP (5/ساعة) */
{ await adm("POST", "/admin/beta/signups", { open: true }); await adm("POST", "/admin/beta/phase", { phase: "public" }); let last = 0; for (let i = 0; i < 7; i++) last = (await signup({ name: "سريع " + i }, "4.4.4.4"))[0]; ok("[M11] 7 محاولات تسجيل من IP واحد ← 429 بعد الخامسة", last === 429); await adm("POST", "/admin/beta/signups", { open: false }); await adm("POST", "/admin/beta/phase", { phase: "internal" }); }
/* M10: الحماية + الغياب في الإنتاج */
{ ok("[M10] مسارات /admin/beta بلا رمز الإدارة ← 401", (await call(benv, "GET", "/admin/beta"))[0] === 401 && (await call(benv, "POST", "/admin/beta/phase", { phase: "public" }))[0] === 401 && (await call(benv, "POST", "/admin/beta/tenants/1/disable"))[0] === 401);
  const [cs, js] = await adm("GET", "/admin/beta"); ok("[M10] ملخص الإدارة: المرحلة والدعوات والملاحظات", cs === 200 && js.invites.total >= 5 && js.feedback_total >= 1);
  { const op = (await call(penv, "GET", "/openapi.json"))[1], ob = (await call(benv, "GET", "/openapi.json"))[1], s = await call(penv, "POST", "/v1/beta/signup", { name: "x" }), nz = await call(penv, "POST", "/v1/zzz-nonexistent", { name: "x" });
  ok("[M10] الإنتاج: وحدة Beta غير محمّلة — لا مسارات /v1/beta في OpenAPI الإنتاج (وهي في Beta)، ومسارها يُعامَل كمسار غير موجود، ولا تسجيل ممكن", !Object.keys(op.paths).some((p) => p.startsWith("/v1/beta")) && Object.keys(ob.paths).some((p) => p === "/v1/beta/signup") && s[0] === nz[0] && P.db.prepare("SELECT COUNT(*) n FROM pf_tenants").get().n === 0, { prod: Object.keys(op.paths).filter((p) => /beta/.test(p)), s: s[0], nz: nz[0] }); }
  ok("[M10] لم يخرج أي اتصال صادر طوال الاختبار (لا بريد/رسائل حقيقية)", OUT.length === 0, OUT); }
globalThis.fetch = realFetch; done();
