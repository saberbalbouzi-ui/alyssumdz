/* اختبار واجهة التشغيل على مستودع git تجريبي بالتزامات حقيقية: البوابات (CI، الاعتماد، شجرة نظيفة، الـSHA)، فحوص العقود/الترحيلات/beta-content، ثم نشر ورجوع كاملان بمحاكي السحابة. */
import path from "node:path";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { runCli } from "../beta-release.mjs";
import { SimCloud } from "../adapters/sim.mjs";
import { makeRepo, writeState, worker, BASELINE } from "./_fixture.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
let n = 0, bad = 0; const ok = (m, c, x) => { n++; if (!c) { bad++; console.log("✗ " + m + (x !== undefined ? "  → " + JSON.stringify(x).slice(0, 400) : "")); } };
const repo = makeRepo(), R = repo.root, g = (...a) => execFileSync("git", a, { cwd: R, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
for (const f of ["platform/release/contracts.json", "platform/env/environments.json"]) { mkdirSync(path.dirname(path.join(R, f)), { recursive: true }); copyFileSync(path.join(ROOT, f), path.join(R, f)); }
repo.w(".gitignore", "dist/\nbeta-release/\n"); repo.w("beta-content/manifest.json", JSON.stringify({ schema: 1, kind: "beta-content", stores: [{ slug: "demo", name: "متجر تجريبي" }] })); repo.w("beta-content/stores/demo.json", JSON.stringify({ title: "متجر Beta" }));
g("init", "-q"); g("config", "user.email", "t@example.test"); g("config", "user.name", "t"); g("checkout", "-q", "-b", "work");
const UI1 = { "index.html": "<h1>v1</h1>", "assets/app.js": "1", "admin.html": "A" }, TPL1 = { "assets/pages/home.json": '{"t":1}' };
const S1 = { version: "3.0.1", api: worker("b.subtotal"), schema: BASELINE, migrations: { "0001_baseline.sql": BASELINE }, ui: UI1, templates: TPL1 };
const commit = (msg, st) => { if (st) writeState(R2, st); g("add", "-A"); g("commit", "-q", "-m", msg); return g("rev-parse", "HEAD"); };
const R2 = { root: R, w: repo.w }; writeState(R2, S1); const sha1 = commit("v1", null);
const runsFile = (sha, o = {}) => { const f = path.join(tmpdir(), "relruns-" + process.pid + ".json"); writeFileSync(f, JSON.stringify({ workflow_runs: [{ id: 7, name: "tests", head_sha: sha, status: "completed", conclusion: "success", run_started_at: "2026-11-18T10:00:00Z", ...o }] })); return f; };
const logs = []; const cli = (argv, adapterFactory = null) => runCli({ argv: [...argv, "--root", R, "--dist-dir", "dist"], env: {}, adapterFactory, log: (...a) => logs.push(a.join(" ")) });
const lastLog = () => logs.slice(-4).join(" | ");

ok("[1] بلا مصدر لحالة CI ⇒ مرفوض (لا نشر بلا بوابة)", (await cli(["verify"])) === 2 && /لا مصدر لحالة CI/.test(lastLog()), lastLog());
ok("[2] CI فاشل على الـSHA ⇒ مرفوض", (await cli(["verify", "--ci-runs-file", runsFile(sha1, { conclusion: "failure" })])) === 2 && /انتهى بـfailure/.test(logs.join("\n")));
ok("[3] CI لم ينتهِ ⇒ مرفوض", (await cli(["verify", "--ci-runs-file", runsFile(sha1, { status: "in_progress", conclusion: null })])) === 2);
ok("[4] CI ناجح لكن الـcommit غير معتمَد (ليس على main ولا موسوم) ⇒ مرفوض", (await cli(["verify", "--ci-runs-file", runsFile(sha1)])) === 2 && /ليس على main/.test(logs.join("\n")));
g("tag", "beta-approved/" + sha1.slice(0, 8));
ok("[5] بوسم beta-approved/<sha8> + CI ناجح ⇒ verify ينجح", (await cli(["verify", "--ci-runs-file", runsFile(sha1)])) === 0, lastLog());
g("tag", "-d", "beta-approved/" + sha1.slice(0, 8)); g("update-ref", "refs/remotes/origin/main", sha1);
ok("[6] الاعتماد عبر main (الـcommit سلف origin/main) ⇒ ينجح", (await cli(["verify", "--ci-runs-file", runsFile(sha1)])) === 0, lastLog());
ok("[7] --sha لا يطابق HEAD ⇒ مرفوض (لا نبني من شجرة لا تطابق الإصدار)", (await cli(["verify", "--sha", "0".repeat(40), "--ci-runs-file", runsFile(sha1)])) === 2 && /لا /.test(lastLog()));
repo.w("platform/api/src/dirty.js", "x"); ok("[8] شجرة غير نظيفة ⇒ مرفوض", (await cli(["verify", "--ci-runs-file", runsFile(sha1)])) === 2 && /غير نظيفة/.test(lastLog())); rmSync(path.join(R, "platform/api/src/dirty.js"));
ok("[9] --skip-gates مع deploy ⇒ مرفوض صراحةً (للتجريب المحلي مع verify/plan فقط)", (await cli(["deploy", "--skip-gates", "--ci-runs-file", runsFile(sha1)], () => new SimCloud())) === 2);
/* فحوص المحتوى والشيفرة */
repo.w("beta-content/evil.js", "alert(1)"); g("add", "-A"); g("commit", "-q", "-m", "evil"); const shaE = g("rev-parse", "HEAD"); g("update-ref", "refs/remotes/origin/main", shaE);
ok("[10] beta-content فيه ملف شيفرة (.js) ⇒ مرفوض (بيانات فقط)", (await cli(["verify", "--ci-runs-file", runsFile(shaE)])) === 2 && /امتداد غير مسموح/.test(logs.join("\n")));
rmSync(path.join(R, "beta-content/evil.js")); repo.w("beta-content/stores/x.json", '{"a":"<script>alert(1)</script>"}'); g("add", "-A"); g("commit", "-q", "-m", "xss"); const shaX = g("rev-parse", "HEAD"); g("update-ref", "refs/remotes/origin/main", shaX);
ok("[11] ملف JSON في beta-content يحمل <script> ⇒ مرفوض", (await cli(["verify", "--ci-runs-file", runsFile(shaX)])) === 2 && /شيفرة داخل ملف المحتوى/.test(logs.join("\n")));
rmSync(path.join(R, "beta-content/stores/x.json")); repo.w("platform/api/src/uses.js", "import x from '../../../beta-content/stores/demo.json'"); g("add", "-A"); g("commit", "-q", "-m", "uses"); const shaU = g("rev-parse", "HEAD"); g("update-ref", "refs/remotes/origin/main", shaU);
ok("[12] شيفرة منصة تقرأ من beta-content ⇒ مرفوض (المحتوى ليس مصدر شيفرة)", (await cli(["verify", "--ci-runs-file", runsFile(shaU)])) === 2 && /beta-content \(ممنوع\)/.test(logs.join("\n")), lastLog());
rmSync(path.join(R, "platform/api/src/uses.js")); repo.w("platform/api/migrations/0002_drop.sql", "DROP TABLE cm_orders;"); g("add", "-A"); g("commit", "-q", "-m", "drop"); const shaD = g("rev-parse", "HEAD"); g("update-ref", "refs/remotes/origin/main", shaD);
ok("[13] ترحيل مدمّر في الإصدار ⇒ verify يرفضه قبل أي بناء", (await cli(["verify", "--ci-runs-file", runsFile(shaD)])) === 2 && /DROP/.test(logs.join("\n")));
rmSync(path.join(R, "platform/api/migrations/0002_drop.sql")); g("add", "-A"); g("commit", "-q", "-m", "clean");
/* نشر ورجوع كاملان */
const sim = new SimCloud({ protectedTables: JSON.parse(readFileSync(path.join(R, "platform/release/contracts.json"), "utf8")).protected_tables.d1_api }), fac = () => sim;
g("update-ref", "refs/remotes/origin/main", g("rev-parse", "HEAD")); writeState(R2, S1); const shaA = g("rev-parse", "HEAD");
let code = await cli(["deploy", "--ci-runs-file", runsFile(shaA)], fac);
ok("[14] نشر الإصدار الأول (بوابات CI والاعتماد ثم بناء مُتخطّى بمجلد جاهز) ينجح ويكتب تقريراً", code === 0 && existsSync(path.join(R, "beta-release/latest.md")), lastLog());
const rep = readFileSync(path.join(R, "beta-release/latest.md"), "utf8"); ok("[15] التقرير يذكر الـcommit والـVERSION وبوابة CI والاعتماد والترحيل", rep.includes(shaA) && rep.includes("3.0.1") && /بوابة CI:\*\* نجحت/.test(rep) && /main/.test(rep) && rep.includes("0001_baseline.sql"), rep.slice(0, 400));
ok("[16] result JSON يحوي البيان والنتيجة", (() => { const j = JSON.parse(readFileSync(path.join(R, `beta-release/result-${sim.currentId}.json`), "utf8")); return j.manifest.source.sha === shaA && j.result.status === "deployed"; })());
sim.db.exec("INSERT INTO pf_tenants VALUES ('t1','متجر')"); const o1 = JSON.parse((await sim.callApi("/v1/orders", { method: "POST", body: JSON.stringify({ tenant: "t1", subtotal: 1000, fee: 400 }) })).body); ok("[17] الخطأ موجود في الإصدار 1", o1.total === 1000);
/* إصلاح */
const M2 = "ALTER TABLE cm_orders ADD COLUMN note TEXT;\n"; const S2 = { version: "3.0.2", api: worker("b.subtotal + b.fee"), schema: BASELINE + M2, migrations: { "0001_baseline.sql": BASELINE, "0002_note.sql": M2 }, ui: { ...UI1, "assets/app.js": "2" }, templates: TPL1 };
writeState(R2, S2); g("add", "-A"); g("commit", "-q", "-m", "fix"); const shaB = g("rev-parse", "HEAD");
logs.length = 0; ok("[18] إصلاح غير معتمَد (ليس على main) ⇒ لا ينشر، وBeta لم يتغيّر", (await cli(["deploy", "--ci-runs-file", runsFile(shaB)], fac)) === 2 && sim.registry.length === 1 && (await sim.health()).api.sha === shaA, lastLog());
g("update-ref", "refs/remotes/origin/main", shaB); ok("[19] معتمَد لكن CI فاشل ⇒ لا ينشر", (await cli(["deploy", "--ci-runs-file", runsFile(shaB, { conclusion: "failure" })], fac)) === 2 && sim.registry.length === 1);
code = await cli(["deploy", "--ci-runs-file", runsFile(shaB)], fac); ok("[20] الإصلاح المعتمَد واجتاز CI ينشر", code === 0 && sim.registry.length === 2, lastLog());
const o2 = JSON.parse((await sim.callApi("/v1/orders", { method: "POST", body: JSON.stringify({ tenant: "t1", subtotal: 1000, fee: 400 }) })).body);
ok("[21] الخطأ مُصلَح (1400)، وبيانات المتجر والطلب القديم باقية", o2.total === 1400 && JSON.parse((await sim.callApi("/v1/orders")).body)[0].id === o1.id && sim.db.prepare("SELECT COUNT(*) n FROM pf_tenants").get().n === 1);
ok("[22] إعادة تشغيل النشر نفسه ⇒ noop", (await cli(["deploy", "--ci-runs-file", runsFile(shaB)], fac)) === 0 && /noop/.test(logs.slice(-3).join(" ")) && sim.registry.length === 2, lastLog());
ok("[23] status يعرض الإصدار الحالي والسجل", (await cli(["status"], fac)) === 0 && logs.join("\n").includes(shaB.slice(0, 8)));
ok("[24] rollback عبر الواجهة إلى الإصدار السابق ينجح والبيانات باقية", (await cli(["rollback"], fac)) === 0 && (await sim.getDeployed()).source.sha === shaA && sim.db.prepare("SELECT COUNT(*) n FROM cm_orders").get().n === 2);
sim.close(); repo.rm();
console.log(bad ? `\n✗ ${bad} فاشل من ${n}` : `✓ ${n} فحصاً ناجحاً`); process.exit(bad ? 1 : 0);
