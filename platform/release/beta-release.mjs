#!/usr/bin/env node
/* واجهة تشغيل مزامنة Beta: verify | plan | deploy | rollback | status.
   لا تنشر إلا إصداراً **معتمداً** (على main أو بوسم beta-approved/<sha8>) **اجتاز CI** على الـSHA نفسه، ومن شجرة نظيفة تطابق الـSHA، بعقود متوافقة وترحيلات إضافية.
   النشر على حساب Cloudflare المستقل ومشروع Supabase alyssum-beta فقط (حواجز في المحوّل). لا تلمس Production ولا تنقل بيانات إليها منه أو إليه.
   متغيرات: BETA_CF_ACCOUNT_ID (إلزامي للنشر)، BETA_CF_DEPLOY_TOKEN (أو رمز يحقنه الوكيل)، BETA_SUPABASE_REF (+BETA_SUPABASE_PAT أو الوكيل)، GITHUB_TOKEN/GITHUB_REPOSITORY (بوابة CI) أو --ci-runs-file، BETA_SUPABASE_URL/BETA_SUPABASE_ANON_KEY (للبناء). */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as L from "./release-lib.mjs";
import { runRelease, runRollback, recoverMissing } from "./release-run.mjs";

const SELF = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
export async function runCli({ argv = process.argv.slice(2), env = process.env, adapterFactory = null, log = console.log } = {}) {
  const cmd = argv[0], flag = (n) => argv.includes(n), opt = (n, d = null) => (flag(n) ? argv[argv.indexOf(n) + 1] : d);
  const ROOT = path.resolve(opt("--root", SELF)), out = path.resolve(ROOT, opt("--out", "beta-release")), distDir = path.resolve(ROOT, opt("--dist-dir", "dist/beta"));
  const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(), tryGit = (...a) => { try { return git(...a); } catch { return null; } };
  const fail = (m) => { log("✖ " + m); return 2; };
  if (!["verify", "plan", "deploy", "rollback", "status", "sync-status", "recover-missing"].includes(cmd)) { log("الاستعمال: beta-release.mjs <verify|plan|deploy|rollback|status|sync-status|recover-missing> [--sha <sha>] [--root <dir>] [--ci-runs-file f.json] [--dist-dir d] [--allow-breaking] [--no-supabase] [--rehearsal-sim] [--actor <login> --approvers a,b | --approved-by <اسم>] [--release <id> --apply]"); return 1; }
  const contracts = JSON.parse(readFileSync(path.join(ROOT, "platform/release/contracts.json"), "utf8")), registry = JSON.parse(readFileSync(path.join(ROOT, "platform/env/environments.json"), "utf8"));
  L.configureTemplates(contracts.template_prefixes);
  const mkAdapter = async () => {
    if (adapterFactory) return adapterFactory({ contracts, registry, env });
    if (flag("--rehearsal-sim")) { const { SimCloud } = await import("./adapters/sim.mjs"); return new SimCloud({ protectedTables: contracts.protected_tables.d1_api }); }
    const { buildRealAdapter } = await import("./adapters/factory.mjs"); return buildRealAdapter({ env, registry, contracts, noSupabase: flag("--no-supabase") });
  };

  if (cmd === "sync-status") {                                                    // فجوة خط Beta عن main (قراءة git فقط، بلا شبكة)
    const base = opt("--main", "origin/main"), behind = tryGit("rev-list", "--count", `HEAD..${base}`), ahead = tryGit("rev-list", "--count", `${base}..HEAD`), mv = tryGit("show", `${base}:VERSION`), hv = existsSync(path.join(ROOT, "VERSION")) ? readFileSync(path.join(ROOT, "VERSION"), "utf8").trim() : null;
    if (behind === null) return fail(`المرجع ${base} غير متاح (git fetch origin main أولاً)`);
    const mt = spawnSync("git", ["merge-tree", "--write-tree", "--name-only", "HEAD", base], { cwd: ROOT, encoding: "utf8" }), conflicts = mt.status === 1 ? mt.stdout.split("\n").slice(1).filter((l) => l && !/^(Auto-merging|CONFLICT)/.test(l)).slice(0, 30) : [];
    log(`HEAD (VERSION ${hv}) ← ${base} (VERSION ${mv}): متأخر ${behind} التزاماً، متقدّم ${ahead}`);
    log(mt.status === 0 ? "الدمج: بلا تعارض (يمكن دمج main في خط Beta ثم CI ثم وسم beta-approved)" : mt.status === 1 ? `الدمج: تعارض في ${conflicts.length}+ ملف (مثلاً ${conflicts.slice(0, 5).join("، ")}) — يُحلّ يدوياً قبل أي إصدار` : "تعذّر فحص الدمج: " + String(mt.stderr).slice(0, 120));
    return Number(behind) === 0 ? 0 : 3;                                          // 3 = Beta متأخر عن main (ليس خطأ تشغيل)
  }
  if (cmd === "status") { const ad = await mkAdapter(), cur = await ad.getDeployed(), rel = await ad.listReleases(); log(cur ? `الإصدار الحالي: ${cur.id} (commit ${cur.source.sha.slice(0, 8)}، VERSION ${cur.source.version})` : "لا إصدار مسجَّل"); for (const r of rel) log(`  ${r.id === cur?.id ? "▶" : " "} ${r.id}  ${r.source.sha.slice(0, 8)}  ${r.source.version}  ${r.source.built_at}`); log("الصحة:", JSON.stringify(await ad.health())); return 0; }
  /** الرجوع والاستعادة الجراحية يغيّران حالة Beta: يتطلبان معتمِداً مُسمّى (داخل Actions: فاعل ضمن BETA_APPROVERS) */
  const approverProblem = () => { const actor = opt("--actor"), list = String(opt("--approvers") ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (env.GITHUB_ACTIONS === "true") { if (!actor || !list.length) return "داخل GitHub Actions يلزم --actor وقائمة المعتمِدين --approvers (BETA_APPROVERS)"; return list.includes(actor.toLowerCase()) ? null : `الفاعل '${actor}' ليس ضمن المعتمِدين`; }
    return opt("--approved-by") ? null : "يتطلب اعتماداً صريحاً مُسمّى: --approved-by <اسم المعتمِد>"; };
  if (cmd === "recover-missing") {                                              // استعادة جراحية يدوية: معاينة افتراضياً، --apply للتنفيذ
    if (flag("--apply")) { const pr = approverProblem(); if (pr) return fail(pr); }
    const ad = await mkAdapter(), id = opt("--release") ?? (await ad.getDeployed())?.id; if (!id) return fail("حدّد --release <id>");
    const r = await recoverMissing({ adapter: ad, releaseId: id, apply: flag("--apply"), log }); return r.ok ? 0 : 1;
  }
  if (cmd === "rollback") { const pr = approverProblem(); if (pr) return fail(pr); const ad = await mkAdapter(), r = await runRollback({ adapter: ad, to: opt("--to"), log }); mkdirSync(out, { recursive: true }); writeFileSync(path.join(out, "rollback-result.json"), JSON.stringify(r, null, 2)); return r.ok ? 0 : 1; }

  /* ── verify / plan / deploy ── */
  const head = tryGit("rev-parse", "HEAD"); if (!head) return fail("المجلد ليس مستودع git");
  const sha = opt("--sha", head); if (sha !== head) return fail(`الشجرة على ${head.slice(0, 8)} لا ${sha.slice(0, 8)} — اسحب الـcommit المطلوب (checkout) ثم أعد التشغيل (لا نبني من شجرة لا تطابق الإصدار)`);
  if (flag("--allow-dirty") && cmd === "deploy" && !flag("--rehearsal-sim") && !adapterFactory) return fail("--allow-dirty لا يُسمح به مع نشر حقيقي (نبني من commit نظيف فقط)");
  const dirty = (tryGit("status", "--porcelain") ?? "").split("\n").filter((l) => l && !/^\?\? (dist\/|beta-release\/)/.test(l)); if (dirty.length && !flag("--allow-dirty")) return fail("الشجرة غير نظيفة: " + dirty.slice(0, 3).join(" | "));
  const gates = { ci: null, approval: null };
  const needGates = cmd === "deploy" || flag("--gates");
  if (needGates || cmd === "verify") {
    let runs = []; const rf = opt("--ci-runs-file");
    if (rf) { const j = JSON.parse(readFileSync(rf, "utf8")); runs = Array.isArray(j) ? j : j.workflow_runs ?? []; }
    else if (env.GITHUB_TOKEN && env.GITHUB_REPOSITORY) { const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/runs?head_sha=${sha}&per_page=50`, { headers: { Authorization: "Bearer " + env.GITHUB_TOKEN, Accept: "application/vnd.github+json" } }); if (r.status !== 200) return fail("تعذّر قراءة تشغيلات CI من GitHub (HTTP " + r.status + ")"); runs = (await r.json()).workflow_runs ?? []; }
    else if (!flag("--skip-gates")) return fail("لا مصدر لحالة CI: مرّر --ci-runs-file أو GITHUB_TOKEN+GITHUB_REPOSITORY (لا نشر بلا بوابة CI)");
    if (!flag("--skip-gates")) {
      const per = contracts.ci_required_workflows.map((w) => ({ w, g: L.ciGate({ sha, runs, workflow: w }) })), badCi = per.filter((x) => !x.g.ok);
      if (badCi.length) { for (const x of badCi) log(`✖ بوابة CI (${x.w}): ${x.g.reason}`); return 2; } gates.ci = { ok: true, run: per[0].g.run, url: per[0].g.url, workflows: contracts.ci_required_workflows };
      const onMain = tryGit("merge-base", "--is-ancestor", sha, "origin/main") !== null, tags = (tryGit("tag", "--points-at", sha) ?? "").split("\n").filter(Boolean);
      const actor = opt("--actor") ?? opt("--approved-by"), approvers = opt("--approvers"), inActions = env.GITHUB_ACTIONS === "true";
      if (cmd === "deploy" && inActions && (!opt("--actor") || !approvers)) return fail("داخل GitHub Actions يلزم --actor وقائمة المعتمِدين --approvers (BETA_APPROVERS)");
      if (cmd === "deploy" && !inActions && !actor) return fail("النشر يتطلب اعتماداً صريحاً مسمّى: --approved-by <اسم المعتمِد> (يُسجَّل في البيان والتقرير)");
      gates.approval = L.approvalGate({ sha, onMain, tags, actor, approvers: approvers ?? null }); if (!gates.approval.ok) { log("✖ بوابة الاعتماد: " + gates.approval.reason); return 2; }
      log(`✓ بوابات: CI نجح (تشغيل ${gates.ci.run}) · اعتماد عبر ${gates.approval.via}${gates.approval.by ? " بواسطة " + gates.approval.by : ""}`);
    } else log("⚠ --skip-gates: البوابات مُتخطّاة (للتجريب المحلي فقط؛ لا يُسمح مع deploy)");
    if (flag("--skip-gates") && cmd === "deploy") return fail("--skip-gates غير مسموح مع deploy");
  }
  /* عقود + ترحيلات + محتوى */
  const cv = L.stateViolations(L.stateFromContracts(contracts)); if (cv.length) return fail("عقود المكوّنات غير متوافقة: " + cv.join("؛ "));
  const migrations = L.readMigrations(path.join(ROOT, "platform/api/migrations")), badM = migrations.map((m) => ({ m, c: L.classifyMigration(m.sql) })).filter((x) => !x.c.ok);
  if (badM.length) { for (const x of badM) log(`✖ ترحيل ${x.m.name}: ${x.c.violations.join("؛ ")}`); return 2; }
  const cd = path.join(ROOT, "beta-content"), cval = L.validateBetaContent(cd), iso = L.checkContentIsolation(ROOT);
  if (!cval.ok) { for (const p of cval.problems) log("✖ beta-content: " + p); return 2; } if (!iso.ok) return fail("شيفرة تقرأ من beta-content (ممنوع): " + iso.hits.join("، "));
  log(`✓ عقود متوافقة · ${migrations.length} ترحيل إضافي · beta-content بيانات فقط (${cval.files} ملف) ومعزول عن الشيفرة`);
  if (cmd === "verify") return 0;
  /* بناء الواجهة */
  if (!flag("--dist-dir") && !flag("--skip-build")) { const r = spawnSync("python3", ["scripts/build-beta.py", "--out", path.relative(ROOT, distDir)], { cwd: ROOT, env, encoding: "utf8" }); if (r.status !== 0) return fail("فشل بناء الواجهة: " + (r.stdout + r.stderr).slice(-400)); log("✓ بُنيت الواجهة → " + path.relative(ROOT, distDir)); }
  if (!existsSync(distDir)) return fail("مجلد الواجهة المبنية غير موجود: " + distDir);
  const fp = L.fingerprints(ROOT, { distDir }), version = readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();
  /* بصمة الواجهة تشمل مصدر الـWorker الساكن (تغييره = إصدار واجهة جديد) */
  const swp = path.join(ROOT, "platform/env/beta/static-worker.js"); if (existsSync(swp)) fp.ui = { ...fp.ui, hash: L.sha256(fp.ui.hash + L.sha256(readFileSync(swp))) };
  let adapter = null, prev = null; try { adapter = await mkAdapter(); prev = (await adapter.getDeployed())?.id ?? null; } catch (e) { if (cmd === "deploy") return fail(e.message); log("⚠ لا اتصال بالمحوّل: " + e.message + " — الخطة بلا حالة منشورة"); }
  const manifest = L.buildManifest({ sha, version, contracts, fp, migrations, ci: gates.ci, approval: gates.approval, prev });
  mkdirSync(out, { recursive: true });
  if (cmd === "plan") { log(JSON.stringify({ id: manifest.id, sha, version, previous: prev, components: Object.fromEntries(Object.entries(manifest.components).map(([k, v]) => [k, { contract: v.contract, hash: v.hash.slice(0, 12), files: v.files }])), migrations: manifest.migrations.map((m) => m.name) }, null, 2)); writeFileSync(path.join(out, `manifest-${manifest.id}.json`), JSON.stringify(manifest, null, 2)); return 0; }
  /* deploy */
  const { readdirSync } = await import("node:fs"), distFiles = L.walk(distDir).map((p) => ({ path: p, buf: readFileSync(path.join(distDir, p)) }));
  const artifacts = { api: { code: "" }, gateway: { code: "" }, ui: { files: distFiles.filter((f) => !L.isTpl(f.path)) }, templates: { files: distFiles.filter((f) => L.isTpl(f.path)) } };
  for (const [k, f] of [["api", "platform/api/src/index.js"], ["gateway", "platform/gateway/src/index.js"]]) if (existsSync(path.join(ROOT, f))) artifacts[k].code = readFileSync(path.join(ROOT, f), "utf8");   // المحوّل الحقيقي يرفع بأدوات النشر؛ المحاكي يستعمل الكود لاختبار السلوك
  const result = await runRelease({ adapter, manifest, migrations, artifacts, snapshotTables: contracts.protected_tables.d1_api, allowBreaking: flag("--allow-breaking"), log });
  const report = L.renderReport(manifest, result); writeFileSync(path.join(out, `report-${manifest.id}.md`), report); writeFileSync(path.join(out, "latest.md"), report); writeFileSync(path.join(out, `result-${manifest.id}.json`), JSON.stringify({ manifest, result: { ...result, steps: result.steps } }, null, 2));
  for (const w of result.warnings ?? []) log("⚠ " + w);
  log(`\nالحالة: ${result.status} — التقرير: ${path.relative(process.cwd(), path.join(out, "latest.md"))}`); return result.ok ? 0 : 1;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exit(await runCli().catch((e) => { console.error("✖ " + e.message); return 2; }));
