/* اختبار آلية مزامنة Beta: نواة نقية + سيناريو إصلاح خطأ كامل (بناء ← نشر ← بيانات المتجر ← رجوع) + حقن أعطال. المحاكي ليس Cloudflare (انظر docs/BETA-SYNC.md). */
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as L from "../release-lib.mjs";
import { runRelease, runRollback } from "../release-run.mjs";
import { SimCloud } from "../adapters/sim.mjs";
import { makeRepo, writeState, artifacts, manifestOf, worker, BASELINE, SHA } from "./_fixture.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."), real = JSON.parse(readFileSync(path.join(ROOT, "platform/release/contracts.json"), "utf8"));
let n = 0, bad = 0; const ok = (m, c, x) => { n++; if (!c) { bad++; console.log("✗ " + m + (x !== undefined ? "  → " + JSON.stringify(x).slice(0, 400) : "")); } };
const sec = (t) => console.log("— " + t);
const PROT = ["pf_tenants", "cm_orders"];
const mk = (c) => structuredClone(c);

sec("A) عقود التوافق وترتيب النشر");
ok("[A1] عقود المستودع الحقيقية صالحة (حالة نهائية بلا مخالفات)", L.stateViolations(L.stateFromContracts(real)).length === 0);
{ const base = L.stateFromContracts(real), dep = mk(base), cand = mk(base);
  cand.ui.contract = 2; cand.ui.requires = { api: 2 }; cand.api.contract = 2;
  const p = L.planOrder(dep, cand, ["ui", "api"]); ok("[A2] ui يتطلب api أحدث ⇒ يُنشر api أولاً", p.ok && p.order.join() === "api,ui", p);
  const c2 = mk(base); c2.api.contract = 2; c2.api.min_ui = 2; c2.ui.contract = 2; const p2 = L.planOrder(dep, c2, ["api", "ui"]); ok("[A3] api يسقط دعم ui القديم ⇒ يُنشر ui أولاً", p2.ok && p2.order.join() === "ui,api", p2);
  const c3 = mk(base); c3.api.contract = 2; c3.api.min_ui = 2; c3.ui.contract = 2; c3.ui.requires = { api: 2 }; const p3 = L.planOrder(dep, c3, ["api", "ui"]); ok("[A4] كسر متزامن في الاتجاهين ⇒ مرفوض مع نصيحة التقسيم", !p3.ok && /قسّم/.test(p3.error), p3);
  const c4 = mk(base); c4.ui.requires = { api: 5 }; ok("[A5] ui يتطلب api غير متوفر ⇒ مخالفة نهائية", L.planOrder(dep, c4, ["ui"]).ok === false);
  const c5 = mk(base); c5.templates.requires = { ui: 3 }; ok("[A6] القوالب تتطلب ui أحدث من المتوفر ⇒ مرفوض", L.planOrder(dep, c5, ["templates"]).ok === false);
  ok("[A7] لا مكوّن متغير ⇒ لا خطوات", L.planOrder(dep, cand, []).order.length === 0); }

sec("B) تصنيف الترحيلات (إضافية فقط)");
const cls = (s) => L.classifyMigration(s);
ok("[B1] CREATE TABLE/INDEX IF NOT EXISTS + ADD COLUMN ⇒ مقبول", cls("CREATE TABLE IF NOT EXISTS t (a INT);\nCREATE INDEX IF NOT EXISTS i ON t(a);\nALTER TABLE t ADD COLUMN b TEXT;").ok);
ok("[B2] DROP TABLE ⇒ مرفوض", !cls("DROP TABLE t;").ok);
ok("[B3] ALTER ... DROP COLUMN / RENAME ⇒ مرفوض", !cls("ALTER TABLE t DROP COLUMN a;").ok && !cls("ALTER TABLE t RENAME TO u;").ok);
ok("[B4] DELETE FROM / TRUNCATE ⇒ مرفوض", !cls("DELETE FROM t;").ok && !cls("TRUNCATE t;").ok);
ok("[B5] UPDATE بلا WHERE ⇒ مرفوض، ومع WHERE ⇒ مقبول", !cls("UPDATE t SET a=1;").ok && cls("UPDATE t SET a=1 WHERE b=2;").ok);
ok("[B6] CREATE TABLE بلا IF NOT EXISTS ⇒ مرفوض (غير قابل لإعادة التطبيق)", !cls("CREATE TABLE t (a INT);").ok);
ok("[B7] ADD COLUMN NOT NULL بلا DEFAULT ⇒ مرفوض، ومع DEFAULT ⇒ مقبول", !cls("ALTER TABLE t ADD COLUMN c TEXT NOT NULL;").ok && cls("ALTER TABLE t ADD COLUMN c TEXT NOT NULL DEFAULT '';").ok);
ok("[B8] INSERT OR REPLACE ⇒ مرفوض", !cls("INSERT OR REPLACE INTO t VALUES (1);").ok);
ok("[B9] التعليق لا يخدع الفاحص (DROP داخل تعليق مقبول)", cls("-- DROP TABLE t;\n/* DELETE FROM t */\nCREATE TABLE IF NOT EXISTS t (a INT);").ok);
{ const c = cls("-- release:breaking-approved:تحويل رقم 123\nDROP TABLE t;"); ok("[B10] علامة breaking-approved تجعله كاسراً معتمداً (لا صامتاً)", c.ok && c.breaking && c.marker === "تحويل رقم 123"); }
ok("[B11] ترحيل D1 الحقيقي في المستودع (0001_baseline) يجتاز الفاحص", L.readMigrations(path.join(ROOT, "platform/api/migrations")).every((m) => cls(m.sql).ok), L.readMigrations(path.join(ROOT, "platform/api/migrations")).map((m) => [m.name, cls(m.sql).violations]));

sec("B2) لقطات حماية البيانات");
{ const S = (c, ids) => ({ count: c, ids }); const cmp = (b, a) => L.compareSnapshots({ t: b }, { t: a });
  ok("[B2.1] لا تغيير ⇒ مقبول", cmp(S(2, ["1", "2"]), S(2, ["1", "2"])).ok);
  ok("[B2.2] كتابات جديدة أثناء النشر (زيادة) ⇒ مقبولة، لا إنذار كاذب يسبّب استعادة تُضيّعها", cmp(S(2, ["1", "2"]), S(4, ["1", "2", "3", "4"])).ok);
  ok("[B2.3] اختفاء صف مع بقاء العدد (حذف + إضافة) ⇒ مرفوض", !cmp(S(2, ["1", "2"]), S(2, ["1", "9"])).ok);
  ok("[B2.4] نقص العدد ⇒ مرفوض", !cmp(S(2, ["1", "2"]), S(1, ["1"])).ok);
  ok("[B2.5] جدول كبير بلا قائمة مفاتيح ⇒ يُقارَن العدد فقط", !cmp(S(9000, null), S(8999, null)).ok && cmp(S(9000, null), S(9005, null)).ok);
  ok("[B2.6] جدول اختفى ⇒ مرفوض، وجدول لم يكن موجوداً قبلاً (null) ⇒ لا يُفحَص", !cmp(S(1, ["1"]), null).ok && cmp(null, S(1, ["1"])).ok); }

sec("C) بوابتا CI والاعتماد");
const run = (o) => ({ id: 1, name: "tests", head_sha: SHA("a"), status: "completed", conclusion: "success", run_started_at: "2026-11-18T10:00:00Z", ...o });
ok("[C1] نجاح tests على الـSHA نفسه ⇒ يمرّ", L.ciGate({ sha: SHA("a"), runs: [run()] }).ok);
ok("[C2] فشل ⇒ مرفوض بلا تجاوز", !L.ciGate({ sha: SHA("a"), runs: [run({ conclusion: "failure" })] }).ok);
ok("[C3] لم ينتهِ ⇒ مرفوض", !L.ciGate({ sha: SHA("a"), runs: [run({ status: "in_progress", conclusion: null })] }).ok);
ok("[C4] تشغيل ناجح لـSHA آخر لا يكفي", !L.ciGate({ sha: SHA("b"), runs: [run()] }).ok);
ok("[C5] لا تشغيل أصلاً ⇒ مرفوض", !L.ciGate({ sha: SHA("a"), runs: [] }).ok);
ok("[C6] أحدث تشغيل هو المعتبَر (فشل بعد نجاح قديم ⇒ مرفوض)", !L.ciGate({ sha: SHA("a"), runs: [run({ id: 1 }), run({ id: 2, conclusion: "failure", run_started_at: "2026-11-18T11:00:00Z" })] }).ok);
ok("[C7] اعتماد: على main ⇒ نعم؛ بوسم beta-approved/<sha8> ⇒ نعم؛ غير ذلك ⇒ لا", L.approvalGate({ sha: SHA("a"), onMain: true }).ok && L.approvalGate({ sha: SHA("a"), onMain: false, tags: ["beta-approved/aaaaaaaa"] }).ok && !L.approvalGate({ sha: SHA("a"), onMain: false, tags: ["beta-approved/bbbbbbbb"] }).ok);

sec("D) بصمات المستودع الحقيقي");
{ const f1 = L.fingerprints(ROOT, {}), f2 = L.fingerprints(ROOT, {});
  ok("[D1] البصمات حتمية (مرتان = نفسها)", f1.api.hash === f2.api.hash && f1.gateway.hash === f2.gateway.hash);
  ok("[D2] بصمة api ≠ gateway، ومخطط api له بصمة 16 خانة", f1.api.hash !== f1.gateway.hash && /^[0-9a-f]{16}$/.test(f1.api.schema_hash), f1.api.schema_hash);
  ok("[D3] ملفات api حقيقية مُحصاة (>5)", f1.api.files > 5, f1.api.files);
  const m = L.readMigrations(path.join(ROOT, "platform/api/migrations")); ok("[D4] بصمة الترحيل = sha256 الكامل كما في d1-migrate (يتطابق مع pf_migrations)", m.length >= 1 && /^[0-9a-f]{64}$/.test(m[0].sha)); }

{ const sw = readFileSync(path.join(ROOT, "platform/env/beta/static-worker.js"), "utf8"), m = /const TPL = (\[[^\]]*\])/.exec(sw), inWorker = m ? JSON.parse(m[1]) : null;
  ok("[D5] بادئات القوالب في الـWorker الساكن = contracts.json (مصدر واحد، لا انحراف)", JSON.stringify(inWorker) === JSON.stringify(real.template_prefixes), { inWorker, contracts: real.template_prefixes });
  ok("[D6] قيمة lib الافتراضية = العقود أيضاً", JSON.stringify(L.TPL_PREFIXES) === JSON.stringify(real.template_prefixes)); }

sec("E) سيناريو إصلاح خطأ كامل (بناء ← نشر ← بيانات ← قالب منفصل ← رجوع)");
const repo = makeRepo(), sim = new SimCloud({ protectedTables: PROT });
const UI1 = { "index.html": "<h1>متجر</h1>", "assets/app.js": "console.log('v1')" }, TPL1 = { "assets/pages/home.json": '{"title":"الرئيسية"}' };
const S1 = { version: "1.0.1", api: worker("b.subtotal"), schema: BASELINE, migrations: { "0001_baseline.sql": BASELINE }, ui: UI1, templates: TPL1 };
writeState(repo, S1);
const go = (sha, extra = {}) => { const { manifest, migrations } = manifestOf(repo.root, { sha, contracts: real, prev: sim.currentId }); return runRelease({ adapter: sim, manifest, migrations, artifacts: artifacts(repo.root), snapshotTables: PROT, ...extra }).then((r) => ({ r, manifest })); };
let { r: r1, manifest: m1 } = await go(SHA("1"));
ok("[E1] الإصدار الأول (فيه الخطأ) ينشر بنجاح", r1.ok && r1.status === "deployed", r1.steps.filter((s) => !s.ok));
ok("[E2] الصحة: api وgateway على sha الإصدار، والواجهة والقوالب على مؤشره", (await sim.health()).api.sha === SHA("1") && (await sim.health()).ui.release === m1.id);
ok("[E3] الواجهة والقوالب تُخدَم من المؤشر (محتوى مطابق)", sim.serveStatic("index.html").toString() === UI1["index.html"] && sim.serveStatic("assets/pages/home.json").toString() === TPL1["assets/pages/home.json"]);
/* بيانات متجر وطلبات في Beta */
sim.db.exec("INSERT INTO pf_tenants (id,name) VALUES ('t1','متجر تجريبي'),('t2','متجر آخر')");
const o1 = JSON.parse((await sim.callApi("/v1/orders", { method: "POST", body: JSON.stringify({ tenant: "t1", subtotal: 1000, fee: 400 }) })).body);
ok("[E4] الخطأ موجود في الإصدار 1: الإجمالي 1000 بدل 1400", o1.total === 1000, o1);
const o2 = JSON.parse((await sim.callApi("/v1/orders", { method: "POST", body: JSON.stringify({ tenant: "t2", subtotal: 500, fee: 0 }) })).body);
const dataBefore = await sim.snapshot(PROT), ordersBefore = JSON.parse((await sim.callApi("/v1/orders")).body);
ok("[E5] بيانات Beta قبل الإصلاح: متجران وطلبان", dataBefore.pf_tenants.count === 2 && dataBefore.cm_orders.count === 2);
{ sim.calls.length = 0; const again = await go(SHA("1")); ok("[E5b] إعادة نشر الإصدار المنشور نفسه (المستودع لم يتغيّر) ⇒ noop مع تحقق صحة، بلا أي نشر", again.r.status === "noop" && again.r.ok && sim.calls.length === 0 && sim.registry.length === 1, again.r); }
/* الإصلاح: كود api + ترحيل إضافي + مخطط + واجهة + قالب */
const M2 = `ALTER TABLE cm_orders ADD COLUMN note TEXT;\nCREATE INDEX IF NOT EXISTS ix_cm_orders_tenant ON cm_orders (tenant_id);\n`;
const S2 = { version: "1.0.2", api: worker("b.subtotal + b.fee"), schema: BASELINE + M2, migrations: { "0001_baseline.sql": BASELINE, "0002_orders_note.sql": M2 }, ui: { ...UI1, "assets/app.js": "console.log('v2 fixed')" }, templates: { "assets/pages/home.json": '{"title":"الرئيسية الجديدة"}' } };
writeState(repo, S2);
let { r: r2, manifest: m2 } = await go(SHA("2"));
ok("[E6] إصدار الإصلاح ينشر ويطبّق الترحيل الإضافي", r2.ok && r2.migrationsApplied.join() === "0002_orders_note.sql", r2.steps.filter((s) => !s.ok));
ok("[E7] بيانات المتاجر والطلبات باقية بعد التحديث (نفس المعرّفات والصفوف)", JSON.stringify(JSON.parse((await sim.callApi("/v1/orders")).body)) === JSON.stringify(ordersBefore) && JSON.stringify((await sim.snapshot(PROT)).pf_tenants.ids) === JSON.stringify(dataBefore.pf_tenants.ids) && JSON.stringify((await sim.snapshot(PROT)).cm_orders.ids) === JSON.stringify(dataBefore.cm_orders.ids));
ok("[E8] المخطط حُدّث دون مسح (عمود note موجود، والطلب القديم سليم)", (await sim.exec("PRAGMA table_info(cm_orders)")).some((c) => c.name === "note") && (await sim.exec("SELECT total FROM cm_orders WHERE id=?", [o1.id]))[0].total === 1000);
const o3 = JSON.parse((await sim.callApi("/v1/orders", { method: "POST", body: JSON.stringify({ tenant: "t1", subtotal: 1000, fee: 400 }) })).body);
ok("[E9] الخطأ مُصلَح في Beta بعد النشر: الإجمالي الآن 1400", o3.total === 1400, o3);
ok("[E10] الواجهة والقوالب الجديدة تُخدَم", sim.serveStatic("assets/app.js").toString().includes("v2 fixed") && sim.serveStatic("assets/pages/home.json").toString().includes("الجديدة"));
ok("[E11] تقرير الإصدار: يذكر commit والإصدار والترحيل المطبَّق وبصمات المكوّنات", (() => { const t = L.renderReport(m2, { ...r2, status: "deployed" }); return t.includes(SHA("2")) && t.includes("1.0.2") && t.includes("0002_orders_note.sql") && t.includes("| templates |") && t.includes(m2.previous); })());
ok("[E12] سجل الإصدارات: اثنان، والحالي الأحدث، ولكل واحد مقابض رجوع", sim.registry.length === 2 && sim.currentId === m2.id && m2.previous === m1.id && !!sim.registry[1].handles.api.version);
/* إصدار قوالب فقط: تُنشر القوالب وحدها (فصل الإصدارات) */
const S3 = { ...S2, version: "1.0.3", templates: { "assets/pages/home.json": '{"title":"قالب v3"}' } }; writeState(repo, S3);
sim.calls.length = 0; let { r: r3, manifest: m3 } = await go(SHA("3"));
ok("[E13] تغيير قالب وحده ⇒ تُنشر القوالب فقط (api/gateway/ui لم تُمسّ)", r3.ok && sim.calls.join() === "deploy:templates", sim.calls);
ok("[E14] مؤشر الواجهة بقي على إصدارها والقوالب انتقلت، وsha الـapi باقٍ للإصدار 2", (await sim.health()).ui.release === m2.id && (await sim.health()).templates.release === m3.id && (await sim.health()).api.sha === SHA("2"));
/* رجوع */
const rb = await runRollback({ adapter: sim, to: m1.id });
ok("[E15] الرجوع إلى الإصدار 1 ينجح ويتحقق من الصحة وسلامة البيانات", rb.ok, rb.steps.filter((s) => !s.ok));
const o4 = JSON.parse((await sim.callApi("/v1/orders", { method: "POST", body: JSON.stringify({ tenant: "t1", subtotal: 100, fee: 50 }) })).body);
ok("[E16] بعد الرجوع: كود الإصدار 1 يعمل (الخطأ القديم)، والبيانات كلها باقية بما فيها طلب الإصدار 2", o4.total === 100 && (await sim.snapshot(PROT)).cm_orders.count === 4 && sim.serveStatic("index.html").toString() === UI1["index.html"]);
ok("[E17] الرجوع لا يعكس الترحيل الإضافي عمداً (العمود موجود ويعمل مع الكود القديم)", (await sim.exec("PRAGMA table_info(cm_orders)")).some((c) => c.name === "note"));
sim.close();

sec("F) حقن الأعطال: لا أثر جانبي أو رجوع كامل");
const fresh = async () => { const s = new SimCloud({ protectedTables: PROT }); const r = makeRepo(); writeState(r, S1); const g = async (sha, st, extra = {}, rr = r) => { if (st) writeState(rr, st); const { manifest, migrations } = manifestOf(rr.root, { sha, contracts: real, prev: s.currentId }); return { out: await runRelease({ adapter: s, manifest, migrations, artifacts: artifacts(rr.root), snapshotTables: PROT, ...extra }), manifest }; }; await g(SHA("1")); s.db.exec("INSERT INTO pf_tenants VALUES ('t1','x')"); await s.callApi("/v1/orders", { method: "POST", body: JSON.stringify({ tenant: "t1", subtotal: 1, fee: 1 }) }); return { s, r, g }; };
{ const { s, r, g } = await fresh(); const before = JSON.stringify(await s.snapshot(PROT)), reg = s.registry.length; s.calls.length = 0;
  const { out } = await g(SHA("4"), { ...S2, migrations: { "0001_baseline.sql": BASELINE, "0002_drop.sql": "DROP TABLE cm_orders;" } });
  ok("[F1] ترحيل مدمّر ⇒ مرفوض قبل أي أثر (لا نشر، لا تعديل بيانات، السجل كما هو)", !out.ok && s.calls.length === 0 && JSON.stringify(await s.snapshot(PROT)) === before && s.registry.length === reg && /DROP/.test(out.steps.at(-1).detail), out.steps.at(-1));
  s.close(); r.rm(); }
{ const { s, r, g } = await fresh(); const before = await s.snapshot(PROT); s.faults.failMigration = "0002_orders_note.sql"; s.calls.length = 0;
  const { out } = await g(SHA("5"), S2);
  ok("[F2] فشل ترحيل في المنتصف ⇒ استعادة القاعدة من علامة ما قبل الترحيل", out.status === "failed_restored" && out.restored, out);
  ok("[F3] بعد الاستعادة: لا ترحيل مسجَّل، لا عمود جديد، البيانات كما كانت، ولا نشر حدث", (await s.exec("SELECT COUNT(*) n FROM pf_migrations"))[0].n === 1 && !(await s.exec("PRAGMA table_info(cm_orders)")).some((c) => c.name === "note") && JSON.stringify(await s.snapshot(PROT)) === JSON.stringify(before) && s.calls.length === 0);
  s.faults = {}; const retry = await g(SHA("5"), null); ok("[F4] إعادة المحاولة بعد زوال العطل تنجح (الترحيل قابل لإعادة التطبيق)", retry.out.ok, retry.out.steps.filter((x) => !x.ok)); s.close(); r.rm(); }
{ const { s, r, g } = await fresh(); const before = await s.snapshot(PROT); s.faults.failDeploy = "ui";
  const { out } = await g(SHA("6"), S2); const h = await s.health();
  ok("[F5] فشل نشر الواجهة بعد api ⇒ رجوع api إلى نسخته السابقة", out.status === "failed_rolled_back" && h.api.sha === SHA("1") && out.rolledBack.some((x) => x.startsWith("api")), out);
  ok("[F6] الواجهة ما زالت على إصدارها السابق، والبيانات سليمة (الترحيل الإضافي يبقى والكود القديم يعمل عليه)", h.ui.release === s.registry[0].id && (await s.snapshot(PROT)).cm_orders.count === before.cm_orders.count && JSON.parse((await s.callApi("/v1/orders")).body).length === 1);
  ok("[F7] الإصدار الفاشل لم يُسجَّل", s.registry.length === 1); s.close(); r.rm(); }
{ const { s, r, g } = await fresh(); const before = await s.snapshot(PROT); s.faults.corruptData = true;
  const { out } = await g(SHA("7"), S2);
  ok("[F8] كود جديد يمسح بيانات ⇒ تكشفه لقطة البيانات فيُرجَع الكود وتُستعاد القاعدة", out.status === "failed_restored" && out.steps.some((x) => /سلامة بيانات/.test(x.name) && !x.ok), out);
  ok("[F9] البيانات عادت كما قبل النشر، والـapi على نسخته السابقة", JSON.stringify(await s.snapshot(PROT)) === JSON.stringify(before) && (await s.health()).api.sha === SHA("1")); s.close(); r.rm(); }
{ const { s, r, g } = await fresh(); const { out } = await g(SHA("8"), { ...S2, migrations: { "0001_baseline.sql": BASELINE + "-- تعديل مُطبَّق\n", "0002_orders_note.sql": M2 } });
  ok("[F10] تعديل ملف ترحيل مُطبَّق سابقاً ⇒ مرفوض (checksum)", !out.ok && /تغيّر محتوى ترحيل مُطبَّق/.test(out.steps.at(-1).detail), out.steps.at(-1)); s.close(); r.rm(); }
{ const { s, r, g } = await fresh(); s.faults.failHealth = true; const { out } = await g(SHA("9"), S2);
  ok("[F11] فحص صحة فاشل بعد نشر مكوّن ⇒ رجوع تلقائي", out.status.startsWith("failed"), out); s.close(); r.rm(); }
{ const { s, r, g } = await fresh(); const bad = mk(real); bad.components.ui.requires = { api: 9 }; const { manifest, migrations } = manifestOf(r.root, { sha: SHA("a"), contracts: bad, prev: s.currentId }); s.calls.length = 0;
  const out = await runRelease({ adapter: s, manifest, migrations, artifacts: artifacts(r.root), snapshotTables: PROT }); ok("[F12] عقد غير متوافق ⇒ مرفوض قبل أي أثر", !out.ok && s.calls.length === 0 && /فحص العقود/.test(out.steps.at(-1).name), out.steps.at(-1)); s.close(); r.rm(); }
{ const { s, r, g } = await fresh(); const M = "-- release:breaking-approved:دمج جدولين\nDELETE FROM pf_tenants WHERE id='zzz';\n"; const S = { ...S2, migrations: { "0001_baseline.sql": BASELINE, "0002_orders_note.sql": M2, "0003_cleanup.sql": M } };
  const a = await g(SHA("b"), S); ok("[F13] ترحيل كاسر معتمَد بعلامة يتطلب --allow-breaking صراحةً", !a.out.ok && /allow-breaking/.test(a.out.steps.at(-1).detail), a.out.steps.at(-1));
  const b = await g(SHA("b"), null, { allowBreaking: true }); ok("[F14] ومع --allow-breaking يمرّ بلقطة استعادة (البيانات المحمية ثابتة هنا)", b.out.ok, b.out.steps.filter((x) => !x.ok)); s.close(); r.rm(); }
repo.rm();

console.log(bad ? `\n✗ ${bad} فاشل من ${n}` : `✓ ${n} فحصاً ناجحاً`); process.exit(bad ? 1 : 0);
