/* اختبار كود CloudflareAdapter الحقيقي على محاكي بروتوكول Cloudflare/Supabase (بلا شبكة): الحواجز، المسارات، تخطّي المحتوى المتطابق، الرجوع بمؤشر، استعادة Time Travel، لقطات Supabase.
   ⚠ هذا اختبار بروتوكول محاكى، ليس Cloudflare الحقيقي: مسارات Time Travel/Versions والترويسات لم تُجرَّب على الخدمة الحقيقية. */
import path from "node:path";
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CloudflareAdapter, KNOWN_PRODUCTION_ACCOUNTS } from "../adapters/cloudflare.mjs";
import { runRelease, runRollback } from "../release-run.mjs";
import { renderReport } from "../release-lib.mjs";
import { MockCloudflare } from "./_mockcf.mjs";
import { makeRepo, writeState, artifacts, manifestOf, worker, BASELINE, SHA } from "./_fixture.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."), REG = JSON.parse(readFileSync(path.join(ROOT, "platform/env/environments.json"), "utf8")), CON = JSON.parse(readFileSync(path.join(ROOT, "platform/release/contracts.json"), "utf8"));
let n = 0, bad = 0; const ok = (m, c, x) => { n++; if (!c) { bad++; console.log("✗ " + m + (x !== undefined ? "  → " + JSON.stringify(x).slice(0, 500) : "")); } };
const ACC = "0123456789abcdef0123456789abcdef", B = REG.environments.beta, P = REG.environments.production;
const threw = (f) => { try { f(); return null; } catch (e) { return String(e.message); } };

/* حواجز الإنشاء */
ok("[1] حساب Production المعروف مرفوض", /Production/.test(threw(() => new CloudflareAdapter({ accountId: KNOWN_PRODUCTION_ACCOUNTS[0], registry: REG, contracts: CON })) ?? ""));
ok("[2] معرّف حساب غير صالح مرفوض", /غير صالح/.test(threw(() => new CloudflareAdapter({ accountId: "xyz", registry: REG, contracts: CON })) ?? ""));
{ const R2 = structuredClone(REG); R2.environments.beta.cf_worker = P.cf_worker; ok("[3] اسم Worker لـBeta يطابق Production ⇒ مرفوض", /يطابق Production|غير صالح/.test(threw(() => new CloudflareAdapter({ accountId: ACC, registry: R2, contracts: CON })) ?? "")); }
{ const R2 = structuredClone(REG); R2.environments.beta.static_worker = "alyssum-tenant-router"; ok("[4] اسم الـWorker الساكن = alyssum-tenant-router ⇒ مرفوض", threw(() => new CloudflareAdapter({ accountId: ACC, registry: R2, contracts: CON })) !== null); }

const repo = makeRepo(), mock = new MockCloudflare({ accountId: ACC, registry: REG, repoRoot: repo.root }), mkAdapter = (o = {}) => new CloudflareAdapter({ accountId: ACC, token: "tok", fetchFn: mock.fetch, runTool: mock.runTool, registry: REG, contracts: CON, supabase: { ref: B.supabase_ref, pat: "pat" }, ...o });
const ad = mkAdapter();
ok("[5] حارس الحساب: حساب نظيف يمرّ", (await ad.assertAccountClean()).workers === 0);
{ const dirty = new MockCloudflare({ accountId: ACC, registry: REG, repoRoot: repo.root, extraWorkers: ["alyssum-platform-api"] }); const e = await new CloudflareAdapter({ accountId: ACC, fetchFn: dirty.fetch, registry: REG, contracts: CON }).assertAccountClean().catch((x) => x.message); ok("[6] حساب فيه Worker باسم Production ⇒ مرفوض", /موارد Production/.test(String(e)), e); dirty.close(); }
{ const dirty = new MockCloudflare({ accountId: ACC, registry: REG, repoRoot: repo.root, extraD1: ["alyssum-shipping-gateway"] }); const e = await new CloudflareAdapter({ accountId: ACC, fetchFn: dirty.fetch, registry: REG, contracts: CON }).assertAccountClean().catch((x) => x.message); ok("[7] حساب فيه D1 باسم Production ⇒ مرفوض", /موارد Production/.test(String(e)), e); dirty.close(); }

/* إصدار 1 */
const PROT = CON.protected_tables.d1_api, UI1 = { "index.html": "<h1>متجر</h1>", "assets/app.js": "console.log('v1')", "admin.html": "A", "beta-start.html": "S" }, TPL1 = { "assets/pages/home.json": '{"title":"الرئيسية"}' };
writeState(repo, { version: "2.0.1", api: worker("b.subtotal"), schema: BASELINE, migrations: { "0001_baseline.sql": BASELINE }, ui: UI1, templates: TPL1 });
const go = async (sha, extra = {}, adapter = ad) => { const { manifest, migrations } = manifestOf(repo.root, { sha, contracts: CON, prev: (await adapter.getDeployed())?.id ?? null }); return { r: await runRelease({ adapter, manifest, migrations, artifacts: artifacts(repo.root), snapshotTables: PROT, ...extra }), manifest }; };
const { r: r1, manifest: m1 } = await go(SHA("1"));
ok("[8] الإصدار الأول عبر المحوّل الحقيقي ينشر كل المكوّنات", r1.ok && r1.status === "deployed", r1.steps.filter((s) => !s.ok));
ok("[9] هوية القاعدة beta، والمخطط في pf_meta = بصمة المخطط، وrelease_sha مسجَّل", mock.meta().environment === "beta" && mock.meta().schema_hash === m1.components.api.schema_hash && mock.meta().release_sha === SHA("1"), mock.meta());
ok("[10] الواجهة تُخدَم بالمؤشر وترويسات الإصدار، وbeta-release.json منشور ويطابق الإصدار", (await (await mock.fetch(`https://${B.app_host}/beta-release.json`)).json()).id === m1.id && (await mock.fetch(`https://${B.app_host}/`, { method: "HEAD" })).headers.get("x-beta-ui") === m1.id);
ok("[11] سجل الإصدارات في KV (فهرس + حالي + بيان) والإصدار الحالي = الأول", (await ad.getDeployed()).id === m1.id && (await ad.listReleases()).length === 1 && !!(await ad.getDeployed()).handles.api.version);
/* بيانات متجر/طلبات في Beta (D1 وSupabase) */
mock.db.exec("INSERT INTO pf_tenants VALUES ('t1','متجر'),('t2','آخر')"); mock.sb.exec("INSERT INTO orders VALUES ('S1','x'),('S2','y'); INSERT INTO admins VALUES ('beta-admin@example.test')");
const o1 = JSON.parse((await mock.callApi("/v1/orders", { method: "POST", body: JSON.stringify({ tenant: "t1", subtotal: 1000, fee: 400 }) })).body); ok("[12] الخطأ قبل الإصلاح: 1000 بدل 1400", o1.total === 1000);
const before = JSON.stringify(await ad.snapshot(PROT));
ok("[13] لقطة البيانات تشمل D1 وSupabase (sb:orders، sb:admins)", JSON.parse(before)["sb:orders"].count === 2 && JSON.parse(before)["sb:admins"].count === 1);
/* إصدار 2: إصلاح + ترحيل إضافي + تغيير ui جزئي */
const M2 = "ALTER TABLE cm_orders ADD COLUMN note TEXT;\nCREATE INDEX IF NOT EXISTS ix_o ON cm_orders (tenant_id);\n";
writeState(repo, { version: "2.0.2", api: worker("b.subtotal + b.fee"), schema: BASELINE + M2, migrations: { "0001_baseline.sql": BASELINE, "0002_note.sql": M2 }, ui: { ...UI1, "assets/app.js": "console.log('v2')" }, templates: TPL1 });
mock.requests.length = 0; mock.kvWrites.length = 0;
const { r: r2, manifest: m2 } = await go(SHA("2"));
ok("[14] إصدار الإصلاح ينشر ويطبّق الترحيل", r2.ok && r2.migrationsApplied.join() === "0002_note.sql", r2.steps.filter((s) => !s.ok));
ok("[15] بيانات D1 وSupabase باقية كما هي (المعرّفات نفسها)", JSON.stringify(await ad.snapshot(PROT)) === before);
const o2 = JSON.parse((await mock.callApi("/v1/orders", { method: "POST", body: JSON.stringify({ tenant: "t1", subtotal: 1000, fee: 400 }) })).body); ok("[16] الخطأ مُصلَح في Beta: 1400، والطلب القديم سليم", o2.total === 1400 && JSON.parse((await mock.callApi("/v1/orders")).body)[0].total === 1000);
const objWrites = mock.kvWrites.filter((k) => k.startsWith("o/")).length; ok("[17] النشر الساكن يكتب الملفات المتغيرة فقط (app.js + beta-release.json) لا كل الملفات", objWrites <= 3 && objWrites >= 1, { objWrites, totalFiles: Object.keys(UI1).length + 1 });
ok("[18] القوالب لم تُنشَر (لم تتغيّر): لا كتابة لمؤشرها", !mock.kvWrites.includes("__ptr/templates") && mock.kvWrites.includes("__ptr/ui"));
ok("[19] كل الطلبات الصادرة إلى api.cloudflare.com ومضيفَي Beta وapi.supabase.com فقط، ولا أثر لاسم Production", [...mock.hostsSeen].every((h) => ["api.cloudflare.com", "api.supabase.com", B.api_host, B.app_host].includes(h)) && !mock.requests.some((q) => [P.cf_worker, P.cf_d1, P.gateway_worker, P.gateway_d1, P.api_host, P.app_host, P.supabase_ref].some((x) => x && new RegExp("(?<![\\w.-])" + x.replace(/\./g, "\\.") + "(?!-beta)(?![\\w])").test(q.url))), [...mock.hostsSeen]);
ok("[20] التقرير يذكر الـcommit والترحيل المطبَّق والمكوّنات", (() => { const t = renderReport(m2, r2); return t.includes(SHA("2")) && t.includes("0002_note.sql") && t.includes("2.0.2"); })());
/* رجوع بمؤشر واحد */
mock.kvWrites.length = 0; const rb = await runRollback({ adapter: ad, to: m1.id });
ok("[21] الرجوع إلى الإصدار 1 ينجح (Worker بنشرة نسخة سابقة + مؤشر الواجهة)", rb.ok, rb.steps.filter((s) => !s.ok));
ok("[22] الرجوع كتب مؤشرات فقط (لا كائنات محتوى جديدة)", !mock.kvWrites.some((k) => k.startsWith("o/")) && mock.kvWrites.includes("__ptr/ui") && mock.kvWrites.includes("__registry/current"), mock.kvWrites);
const o3 = JSON.parse((await mock.callApi("/v1/orders", { method: "POST", body: JSON.stringify({ tenant: "t2", subtotal: 100, fee: 50 }) })).body); ok("[23] بعد الرجوع: كود الإصدار 1 يعمل والبيانات باقية (3 طلبات)", o3.total === 100 && mock.db.prepare("SELECT COUNT(*) n FROM cm_orders").get().n === 3);
/* أعطال */
mock.faults.failWorkerDeploy = "api"; writeState(repo, { version: "2.0.3", api: worker("b.subtotal + b.fee + 0"), schema: BASELINE + M2, migrations: { "0001_baseline.sql": BASELINE, "0002_note.sql": M2 }, ui: { ...UI1, "assets/app.js": "console.log('v3')" }, templates: TPL1 });
{ const { r } = await go(SHA("3")); ok("[24] فشل نشر Worker ⇒ فشل بلا تغيير للواجهة، والإصدار الحالي لم يتغيّر", !r.ok && (await ad.getDeployed()).id === m1.id && (await mock.fetch(`https://${B.app_host}/`, { method: "HEAD" })).headers.get("x-beta-ui") === m1.id, r.status); }
mock.faults = {};
{ writeState(repo, { version: "2.0.4", api: worker("b.subtotal + b.fee"), schema: BASELINE + M2 + "\nCREATE TABLE IF NOT EXISTS z (a INT);", migrations: { "0001_baseline.sql": BASELINE, "0002_note.sql": M2, "0003_bad.sql": "CREATE TABLE IF NOT EXISTS z (a INT);\nINSERT INTO no_such_table VALUES (1);" }, ui: UI1, templates: TPL1 });
  const rowsBefore = mock.db.prepare("SELECT COUNT(*) n FROM cm_orders").get().n; const { r } = await go(SHA("4"));
  ok("[25] فشل ترحيل (جملة ثانية خاطئة) ⇒ استعادة Time Travel", r.status === "failed_restored" && r.restored, r);
  ok("[26] بعد الاستعادة: لا جدول z ولا ترحيل مسجَّل 0003، والطلبات كما كانت", !mock.db.prepare("SELECT name FROM sqlite_master WHERE name='z'").get() && !mock.db.prepare("SELECT name FROM pf_migrations WHERE name='0003_bad.sql'").get() && mock.db.prepare("SELECT COUNT(*) n FROM cm_orders").get().n === rowsBefore); }
{ rmSync(path.join(repo.root, "platform/api/migrations/0003_bad.sql"), { force: true }); writeState(repo, { version: "2.0.5", api: worker("b.subtotal"), schema: BASELINE + M2, migrations: { "0001_baseline.sql": BASELINE, "0002_note.sql": M2 }, ui: { ...UI1, "assets/app.js": "console.log('v5')" }, templates: TPL1 });
  const orig = mock.runTool; mock.runTool = async (c, a, e) => { const r = await orig(c, a, e); if (a.some((x) => /api\/tools/.test(x))) mock.sb.exec("DELETE FROM orders WHERE id='S1'"); return r; }; ad.runTool = mock.runTool;
  const { r } = await go(SHA("5")); ok("[27] فقدان بيانات في Supabase أثناء النشر ⇒ رجوع الكود وتنبيه صريح بعدم الاستعادة التلقائية", !r.ok && r.warnings.some((w) => /Supabase/.test(w)) && !r.restored, r);
  ok("[28] التقرير يعرض التنبيه الذي يتطلب تدخلاً", renderReport({ ...m2, id: "x" }, r).includes("تنبيهات تتطلب تدخلاً")); }
mock.close(); repo.rm();
console.log(bad ? `\n✗ ${bad} فاشل من ${n}` : `✓ ${n} فحصاً ناجحاً (بروتوكول محاكى؛ ليس Cloudflare الحقيقي)`); process.exit(bad ? 1 : 0);
