#!/usr/bin/env node
/* لا رجوع احتياطياً إلى Production: أدوات Supabase Beta (التطبيق، الإعداد، الاختبار التكاملي) تُشغَّل في عمليات منفصلة بـ fetch مُسجِّل (platform/env/test/record-network.mjs).
   يثبت: (1) غياب أي متغير BETA_* ⇒ لا اتصال إطلاقاً ورمز خروج غير صفري مع --require (2) مرجع/مفتاح Production ⇒ رفض قبل أي اتصال
   (3) فشل الاتصال أو رد 500 ⇒ فشل صريح بلا إعادة توجيه، وكل مضيف يُطلَب ضمن {api.supabase.com, <مرجع Beta>.supabase.co} حصراً.
   لا شبكة حقيقية ولا أسرار: كل القيم وهمية. التشغيل: node platform/supabase/tests/beta/beta-no-fallback.test.mjs */
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.resolve(HERE, "../../../.."), REG = JSON.parse(readFileSync(path.join(ROOT, "platform/env/environments.json"), "utf8"));
const BETA = REG.environments.beta.supabase_ref, PROD = REG.environments.production.supabase_ref, PUBKEY = REG.never_outside_production.public_key_markers[0];
const PRELOAD = path.join(ROOT, "platform/env/test/record-network.mjs"), TMP = mkdtempSync(path.join(tmpdir(), "beta-nofb-"));
const GOOD = { BETA_SUPABASE_REF: BETA, BETA_SUPABASE_URL: `https://${BETA}.supabase.co`, BETA_SUPABASE_ANON_KEY: "sb_publishable_FAKEFAKEFAKEFAKEFAKE", BETA_SUPABASE_PAT: "fake-pat", BETA_ADMIN_EMAIL: "beta-admin@example.test", BETA_ADMIN_PASSWORD: "fake-password-123" };
let pass = 0, fail = 0, n = 0; const ok = (m, c, x) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  " + JSON.stringify(x).slice(0, 220))); };
function run(script, args, env, mode = "reject") {
  const log = path.join(TMP, `net-${++n}.log`);
  const r = spawnSync(process.execPath, ["--no-warnings", "--import", PRELOAD, path.join(ROOT, script), ...args], { env: { PATH: process.env.PATH, NET_LOG: log, NET_MODE: mode, ...env }, encoding: "utf8", cwd: ROOT, timeout: 60000 });
  const calls = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { code: r.status, out: (r.stdout || "") + (r.stderr || ""), calls, hosts: [...new Set(calls.map((c) => c.host))] };
}
const without = (k) => Object.fromEntries(Object.entries(GOOD).filter(([x]) => x !== k));
const IT = "platform/supabase/tests/beta/beta-supabase.integration.mjs", AP = "scripts/supabase-beta-apply.mjs", AU = "scripts/supabase-beta-auth.mjs";
const allowed = (r) => r.hosts.every((h) => h === "api.supabase.com" || h === `${BETA}.supabase.co`);
const noProd = (r) => !r.hosts.some((h) => h.includes(PROD) || (REG.never_outside_production.hosts ?? []).some((p) => h === p || h.endsWith("." + p)));

/* (1) غياب المتغيرات */
let r = run(IT, ["--require"], {}); ok("[F1] اختبار التكامل بلا أي متغير + --require ⇒ رمز 3 (ليس نجاحاً) وبلا اتصال", r.code === 3 && r.calls.length === 0 && /SKIPPED/.test(r.out), { code: r.code, calls: r.calls.length });
r = run(IT, [], {}); ok("[F2] بلا --require ⇒ SKIPPED صريح برمز 0 وبلا اتصال", r.code === 0 && r.calls.length === 0 && /SKIPPED/.test(r.out), { code: r.code, calls: r.calls.length });
for (const k of Object.keys(GOOD)) { r = run(IT, ["--require"], without(k)); ok(`[F3] غياب ${k} ⇒ رمز 3 وبلا أي اتصال`, r.code === 3 && r.calls.length === 0, { code: r.code, calls: r.calls.length }); }
for (const k of ["BETA_SUPABASE_REF", "BETA_SUPABASE_PAT", "BETA_ADMIN_EMAIL"]) { r = run(AP, ["--apply", "--confirm-ref", BETA], without(k)); ok(`[F4] أداة التطبيق: غياب ${k} ⇒ رفض (رمز ≠ 0) وبلا أي اتصال`, r.code >= 1 && r.calls.length === 0, { code: r.code, calls: r.calls.length }); }
r = run(AP, ["--apply"], GOOD); ok("[F5] أداة التطبيق بلا --confirm-ref ⇒ رفض وبلا اتصال", r.code === 2 && r.calls.length === 0, { code: r.code, calls: r.calls.length });
for (const k of ["BETA_SUPABASE_REF", "BETA_SUPABASE_PAT"]) { r = run(AU, ["--apply", "--confirm-ref", BETA], without(k)); ok(`[F6] أداة Auth: غياب ${k} ⇒ رفض وبلا أي اتصال`, r.code === 2 && r.calls.length === 0, { code: r.code, calls: r.calls.length }); }
/* (2) هوية Production */
const prodEnv = { ...GOOD, BETA_SUPABASE_REF: PROD, BETA_SUPABASE_URL: `https://${PROD}.supabase.co` };
r = run(IT, ["--require"], prodEnv); ok("[P1] اختبار التكامل بمرجع Production ⇒ رفض (رمز 2) وبلا اتصال", r.code === 2 && r.calls.length === 0, { code: r.code, calls: r.calls.length });
r = run(AP, ["--apply", "--confirm-ref", PROD], prodEnv); ok("[P2] أداة التطبيق بمرجع Production ⇒ رفض وبلا اتصال", r.code === 2 && r.calls.length === 0, { code: r.code, calls: r.calls.length });
r = run(AU, ["--apply", "--confirm-ref", PROD], prodEnv); ok("[P3] أداة Auth بمرجع Production ⇒ رفض وبلا اتصال", r.code === 2 && r.calls.length === 0, { code: r.code, calls: r.calls.length });
r = run(IT, ["--require"], { ...GOOD, BETA_SUPABASE_ANON_KEY: PUBKEY }); ok("[P4] المفتاح العام لـProduction مع رابط Beta ⇒ رفض وبلا اتصال", r.code === 2 && r.calls.length === 0, { code: r.code, calls: r.calls.length });
r = run(IT, ["--require"], { ...GOOD, BETA_ADMIN_EMAIL: "saber.balbouzi@gmail.com" }); ok("[P5] بريد مدير = هوية المالك ⇒ رفض وبلا اتصال", r.code === 2 && r.calls.length === 0, { code: r.code, calls: r.calls.length });
/* (3) فشل الاتصال / رد 500: فشل صريح، ومضيفون مسموحون فقط */
for (const mode of ["reject", "500"]) {
  r = run(IT, ["--require"], GOOD, mode); ok(`[N1/${mode}] الاختبار التكاملي عند ${mode === "reject" ? "فشل الاتصال" : "رد 500"} ⇒ لا نجاح (رمز ≠ 0)، ومضيفون ضمن المسموح`, r.code !== 0 && r.calls.length > 0 && allowed(r) && noProd(r), { code: r.code, hosts: r.hosts });
  r = run(AP, ["--apply", "--confirm-ref", BETA], GOOD, mode); ok(`[N2/${mode}] أداة التطبيق عند ${mode === "reject" ? "فشل الاتصال" : "رد 500"} ⇒ فشل صريح بلا كتابة، ومضيفون ضمن المسموح`, r.code !== 0 && allowed(r) && noProd(r) && !r.calls.some((c) => /database\/query/.test(c.path)), { code: r.code, hosts: r.hosts, paths: r.calls.map((c) => c.path) });
  r = run(AU, ["--apply", "--confirm-ref", BETA], GOOD, mode); ok(`[N3/${mode}] أداة Auth عند ${mode === "reject" ? "فشل الاتصال" : "رد 500"} ⇒ فشل صريح بلا PATCH، ومضيفون ضمن المسموح`, r.code !== 0 && allowed(r) && noProd(r) && !r.calls.some((c) => c.method === "PATCH"), { code: r.code, hosts: r.hosts });
}
rmSync(TMP, { recursive: true, force: true });
console.log(`RESULT: ${pass} pass / ${fail} fail`); process.exit(fail ? 1 : 0);
