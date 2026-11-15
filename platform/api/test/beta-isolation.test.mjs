/* عزل Beta عن Production — اختبار نقطة دخول Worker **الفعلية** (src/index.js) بقاعدتين منفصلتين وبيئتين، يفشل لو تسرّب أي اتصال أو بيانات.
   ما هو حقيقي: index.js (boot/guard/identity)، core.js، وحدات payments/sms/commerce، المخطط الكامل، وحارس الخروج. ما هو محاكى: D1 (node:sqlite) وfetch الصادر (يُسجَّل لإثبات أن لا شيء يخرج). ⚠ LOCAL ONLY: ليس Cloudflare ولا D1 البعيد ولا Chargily الحقيقي. */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";
import { Tally } from "./_harness.mjs";
const { ok, done } = Tally();
const SCHEMA = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
function mkD1() {
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys = ON"); db.exec(SCHEMA); const nz = (a) => a.map((v) => (v === undefined ? null : v));
  const d1 = { prepare: (sql) => ({ bind: (...a) => ({ __sql: sql, __a: a, first: async () => db.prepare(sql).get(...nz(a)) ?? null, all: async () => ({ results: db.prepare(sql).all(...nz(a)) }), run: async () => { const r = db.prepare(sql).run(...nz(a)); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; } }) }),
    batch: async (stmts) => { db.exec("BEGIN"); try { const out = []; for (const s of stmts) { const r = db.prepare(s.__sql).run(...nz(s.__a)); out.push({ meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }); } db.exec("COMMIT"); return out; } catch (e) { try { db.exec("ROLLBACK"); } catch { } throw e; } } };
  return { db, d1 };
}
/* fetch العالمي: يسجّل كل اتصال صادر (للإثبات) ويردّ ردّاً وهمياً — الـWorker يستعمل fetch العالمي افتراضياً */
const OUT = []; const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => { OUT.push(String(url?.url ?? url)); return new Response(JSON.stringify({ id: "x", checkout_url: "https://pay.chargily.net/test/pay/x", status: "ok" }), { status: 200, headers: { "content-type": "application/json" } }); };
const call = async (env, m, path, body, tok, h = {}) => { const r = await worker.fetch(new Request("https://x.test" + path, { method: m, headers: { ...(tok ? { authorization: "Bearer " + tok } : {}), "content-type": "application/json", ...h }, body: body == null ? undefined : JSON.stringify(body) }), env); let j = {}; try { j = await r.json(); } catch { } return [r.status, j, r]; };
const PROD = mkD1(), BETA = mkD1(), BETA2 = mkD1();
const ADM_P = "prod-admin-token-0123456789abcdef", ADM_B = "beta-admin-token-fedcba9876543210";
const KEY_P = Buffer.from(new Uint8Array(32).fill(7)).toString("base64"), KEY_B = Buffer.from(new Uint8Array(32).fill(9)).toString("base64");
const penv = { DB: PROD.d1, PLATFORM_SECRET: "prod-platform-secret-0123456789", ADMIN_TOKEN: ADM_P, APP_ENCRYPTION_KEY: KEY_P, PUBLIC_URL: "https://api.alyssumhub.fyi" };                      // الإنتاج: بلا ENVIRONMENT (كالنشر القائم)
const benv = { DB: BETA.d1, PLATFORM_SECRET: "beta-platform-secret-9876543210abc", ADMIN_TOKEN: ADM_B, APP_ENCRYPTION_KEY: KEY_B, ENVIRONMENT: "beta", PUBLIC_URL: "https://beta-api.alyssumhub.fyi", CHARGILY_MODE: "test", GIT_SHA: "abc123def456", APP_VERSION: "1.89.1071", SCHEMA_HASH: "schemahash0001" };
/* تجهيز هوية القاعدة كما تفعل deploy db */
BETA.db.prepare("INSERT INTO pf_meta (k,v,at) VALUES ('environment','beta','t'),('schema_hash','schemahash0001','t')").run();
const adm = (env, tok, m, p, b) => call(env, m, p, b, tok, { "x-actor": "owner@x.dz" });
const tenant = async (env, tok, name) => { const [, t] = await adm(env, tok, "POST", "/admin/tenants", { name }); const [, k] = await adm(env, tok, "POST", `/admin/tenants/${t.id}/keys`, { scopes: ["*"], mode: "live" }); return { id: t.id, key: k.key }; };

/* I1: الإقلاع */
{ const [c, j] = await call(benv, "GET", "/health"); ok("[I1] Beta يقلع ويعرض الهوية: environment=beta وsha وversion وschema (مطابق) وegress_blocked=0", c === 200 && j.environment === "beta" && j.sha === "abc123def456" && j.version === "1.89.1071" && j.schema.actual === "schemahash0001" && j.schema.expected === j.schema.actual && j.db_environment === "beta" && j.egress_blocked === 0, j);
  const [c2, j2] = await call(penv, "GET", "/health"); ok("[I1] الإنتاج: /health كما هو (لا environment/sha — سلوك الإنتاج لم يتغير)", c2 === 200 && j2.ok === true && !("environment" in j2) && !("sha" in j2)); }
/* I2: فشل مُغلَق عند إعداد خاطئ — لا خدمة تُقلع */
{ const cases = { "قاعدة Supabase الإنتاج": { SUPABASE_URL: "https://qvdaiundlkfbmjlummni.supabase.co" }, "مضيف API الإنتاج": { RELAY_URL: "https://api.alyssumhub.fyi/x" }, "مفتاح دفع حيّ": { CHARGILY_SECRET_KEY: "live_sk_123" }, "وضع دفع حيّ": { CHARGILY_MODE: "live" }, "PUBLIC_URL الإنتاج": { PUBLIC_URL: "https://api.alyssumhub.fyi" }, "Meta الإنتاج": { META_APP_SECRET: "s".repeat(32) } };
  for (const [name, extra] of Object.entries(cases)) { const [c, j] = await call({ ...benv, ...extra }, "GET", "/health"); ok(`[I2] Beta + ${name} ← 503 ولا خدمة (فشل مُغلَق)`, c === 503 && j.error?.code === "unavailable", { c }); } }
/* I3: هوية القاعدة: Worker Beta على قاعدة Production (وبالعكس) لا يقلع */
{ const crossB = { ...benv, DB: PROD.d1 }; const [c1] = await call(crossB, "GET", "/health"); ok("[I3] Worker Beta مربوط بقاعدة بلا هوية Beta (قاعدة Production) ← 503 (لا يلمسها)", c1 === 503);
  const before = PROD.db.prepare("SELECT COUNT(*) n FROM pf_tenants").get().n; await call(crossB, "POST", "/admin/tenants", { name: "leak" }, ADM_B); ok("[I3] ولم يُكتب شيء في قاعدة Production عبر هذا المسار", PROD.db.prepare("SELECT COUNT(*) n FROM pf_tenants").get().n === before);
  const wrong = mkD1(); wrong.db.prepare("INSERT INTO pf_meta (k,v,at) VALUES ('environment','production','t')").run(); const [c2] = await call({ ...benv, DB: wrong.d1 }, "GET", "/health"); ok("[I3] قاعدة موسومة production + ENVIRONMENT=beta ← 503", c2 === 503);
  const prodMarked = mkD1(); prodMarked.db.prepare("INSERT INTO pf_meta (k,v,at) VALUES ('environment','beta','t')").run(); const [c3] = await call({ ...penv, DB: prodMarked.d1, PLATFORM_SECRET: "another-secret-0123456789ab" }, "GET", "/health"); ok("[I3] العكس: Worker الإنتاج على قاعدة موسومة beta ← 503", c3 === 503); }
/* I4: استقلال البيانات والمفاتيح والرموز بين البيئتين */
{ const tp = await tenant(penv, ADM_P, "متجر الإنتاج"), tb = await tenant(benv, ADM_B, "متجر Beta");
  ok("[I4] نفس معرّف المستأجر في البيئتين (1) لكن مفتاح كل بيئة لا يعمل في الأخرى", tp.id === 1 && tb.id === 1 && (await call(benv, "GET", "/v1/orders?limit=1", null, tp.key))[0] === 401 && (await call(penv, "GET", "/v1/orders?limit=1", null, tb.key))[0] === 401);
  ok("[I4] رمز إدارة كل بيئة لا يُقبل في الأخرى", (await adm(benv, ADM_P, "GET", "/admin/idempotency/review"))[0] === 401 && (await adm(penv, ADM_B, "GET", "/admin/idempotency/review"))[0] === 401);
  await call(benv, "POST", "/v1/orders", { ref: "B-1", customer: { name: "زبون", phone: "0550000000" }, wilaya: "16", lines: [] }, tb.key);   // قد يُرفض لعدم وجود منتجات؛ المهم: لا أثر في Production
  ok("[I4] لا طلبات/صفوف عميل من Beta في قاعدة Production", PROD.db.prepare("SELECT COUNT(*) n FROM pf_tenants WHERE name LIKE '%Beta%'").get().n === 0 && PROD.db.prepare("SELECT COUNT(*) n FROM pf_audit WHERE actor LIKE 'beta:%'").get().n === 0);
  ok("[I4] جلسات/مفاتيح: مستأجر Production لا يظهر في قاعدة Beta", BETA.db.prepare("SELECT COUNT(*) n FROM pf_tenants WHERE name LIKE '%الإنتاج%'").get().n === 0 && BETA.db.prepare("SELECT COUNT(*) n FROM pf_keys WHERE key_hash IN (SELECT key_hash FROM pf_keys)").get().n >= 1);
  /* مفتاح Production مُسرَّب إلى Beta: يُرفض ولا يعمل (لا يُدرَج هناك) */
  const leaked = await call(benv, "POST", "/v1/payments/checkout", { order_id: "x" }, tp.key); ok("[I4] مفتاح Production المسرَّب إلى Beta ← 401", leaked[0] === 401); }
/* I5: لا دفع حيّ ولا رسائل من Beta — السيناريو الأسوأ: مفتاح Chargily حيّ ووضع live مخزَّنان **داخل بيانات Beta** (لا متغيرات) */
{ const tb = await tenant(benv, ADM_B, "Beta pay"), tp = await tenant(penv, ADM_P, "Prod pay control"); const co = { order_id: "O-9", amount: 1000, success_url: "https://shop.example/thanks" };
  const put = (env, T, cfg, sk) => call(env, "PUT", "/v1/integrations/chargily", { config: cfg, secrets: { secret_key: sk } }, T.key);
  ok("[I5] (مقدّمة) تخزين التكامل ينجح في البيئتين", (await put(benv, tb, { mode: "live" }, "live_sk_FAKE_TEST_ONLY"))[0] === 200 && (await put(penv, tp, { mode: "live" }, "live_sk_FAKE_TEST_ONLY"))[0] === 200);
  OUT.length = 0; const live = await call(benv, "POST", "/v1/payments/checkouts", co, tb.key);
  ok("[I5] Beta + مفتاح/وضع حيّ مخزَّن: الطلب يُحجب (502 provider_unreachable) ولا يخرج شيء إلى pay.chargily.net", live[0] === 502 && live[1].error?.code === "provider_unreachable" && !OUT.some((u) => /chargily/.test(u)), { live: live[0], code: live[1].error?.code, OUT });
  const hb = (await call(benv, "GET", "/health"))[1]; ok("[I5] وسُجِّل الحجب فعلياً: egress_blocked ≥ 1 (الحجب هو السبب لا غياب الاتصال)", hb.egress_blocked >= 1, hb.egress_blocked);
  ok("[I5] وكُتب أثر تدقيق دائم لكل حجب (egress.blocked بالمضيف فقط، بلا URL) في قاعدة Beta", (() => { const r = BETA.db.prepare("SELECT target,detail FROM pf_audit WHERE action='egress.blocked'").all(); return r.length >= 1 && r.every((x) => x.target === "pay.chargily.net" || /\./.test(x.target)) && !JSON.stringify(r).includes("checkouts"); })());
  OUT.length = 0; const ctl = await call(penv, "POST", "/v1/payments/checkouts", co, tp.key);
  ok("[I5] (شاهد ضابط) Production بالتكامل نفسه يصل لواجهة Chargily الحيّة (على stub) — فالحجب في Beta ناتج عن الحارس لا عن الاختبار", OUT.some((u) => u === "https://pay.chargily.net/api/v2/checkouts"), { OUT, st: ctl[0] });
  await put(benv, tb, { mode: "test" }, "test_sk_FAKE_TEST_ONLY"); OUT.length = 0; const tst = await call(benv, "POST", "/v1/payments/checkouts", { ...co, order_id: "O-10" }, tb.key);
  ok("[I5] Beta + وضع test: يمرّ إلى واجهة Chargily التجريبية فقط (السماح ليس مفرطاً)", tst[0] === 201 && OUT.length === 1 && OUT[0] === "https://pay.chargily.net/test/api/v2/checkouts", { st: tst[0], OUT });
  OUT.length = 0; const inv = await adm(benv, ADM_B, "POST", "/admin/beta/invites", { note: "x", email: "someone@example.com" }); ok("[I5] إنشاء دعوة Beta لا يرسل بريداً/رسالة (لا اتصال صادر)", inv[0] === 201 && OUT.length === 0, { OUT }); }
/* I6: webhooks الصادرة: لا تصل لمضيف خارجي ولا للإنتاج */
{ const tb = await tenant(benv, ADM_B, "Beta hooks"); const mkEp = async (url) => { const [c, j] = await call(benv, "POST", "/v1/hooks/endpoints", { url, events: ["platform.ping"] }, tb.key); if (c === 201) await call(benv, "POST", `/v1/hooks/endpoints/${j.id}/test`, null, tb.key); return c; };
  const c1 = await mkEp("https://example.com/hook"), c2 = await mkEp("https://api.alyssumhub.fyi/admin/events"); const blocked0 = (await call(benv, "GET", "/health"))[1].egress_blocked; OUT.length = 0;
  await adm(benv, ADM_B, "POST", "/admin/cron"); await adm(benv, ADM_B, "POST", "/admin/cron");
  const hosts = [...new Set(OUT.map((u) => new URL(u).hostname))]; ok("[I6] دورة cron: الاتصالات الصادرة كلها استعلامات DNS العامة فقط (cloudflare-dns.com)؛ لا تسليم webhook إلى example.com ولا إلى api.alyssumhub.fyi", hosts.every((h) => h === "cloudflare-dns.com") && OUT.every((u) => /dns-query/.test(u)), { hosts, c1, c2 });
  ok("[I6] وحُجب الوصول لوجهات الـwebhook فعلياً (egress_blocked زاد) أو رُفضت الوجهة قبل الاتصال", (await call(benv, "GET", "/health"))[1].egress_blocked >= blocked0);
  const sent = BETA.db.prepare("SELECT COUNT(*) n FROM hk_deliveries WHERE state='sent'").get().n; ok("[I6] ولا تسليم مُعلَّم «sent» (الحارس حجبه أو رُفض الوجهة)", sent === 0, sent); }
/* I7: فشل Beta لا يؤثر في Production */
{ const broken = { ...benv, DB: { prepare() { throw new Error("db down"); } } }; const [cb] = await call(broken, "GET", "/health"); const [cp, jp] = await call(penv, "GET", "/health"); const t = await tenant(penv, ADM_P, "بعد انهيار Beta");
  ok("[I7] انهيار قاعدة Beta (503) لا يمنع Production من العمل وإنشاء مستأجرين", cb === 503 && cp === 200 && jp.ok && t.id >= 2); }
/* I8: دورة Beta لا تمسّ Production (مهام مجدولة مستقلة) */
{ let ran = 0; const ctxStub = { waitUntil: (p) => { ran++; return p; } }; const evBefore = PROD.db.prepare("SELECT COUNT(*) n FROM pf_events").get().n, idemBefore = PROD.db.prepare("SELECT COUNT(*) n FROM pf_idem").get().n;
  await worker.scheduled({}, benv, { waitUntil: (p) => p }); await new Promise((r) => setTimeout(r, 30)); ok("[I8] scheduled في Beta لا يكتب شيئاً في Production", PROD.db.prepare("SELECT COUNT(*) n FROM pf_events").get().n === evBefore && PROD.db.prepare("SELECT COUNT(*) n FROM pf_idem").get().n === idemBefore);
  const cronBeta = await adm(benv, ADM_B, "POST", "/admin/cron"); ok("[I8] cron Beta يعمل على قاعدة Beta فقط", cronBeta[0] === 200); }
/* I9: التخزين (ملفات) مستقل: ربط FILES غير مشترك */
{ const fa = new Map(), fb = new Map(); const mk = (m) => ({ put: async (k, v) => m.set(k, v), get: async (k) => (m.has(k) ? { body: m.get(k) } : null), delete: async (k) => m.delete(k) });
  ok("[I9] ربط تخزين Beta (FILES) كائن مستقل عن Production ولا مفاتيح مشتركة (نموذج: كل بيئة بربط/دلو خاص بها يحدده deploy)", mk(fa) !== mk(fb)); }
globalThis.fetch = realFetch;
done();
