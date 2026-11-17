#!/usr/bin/env node
/* أداة تنظيف الرقية (scripts/supabase-beta-ruqya-cleanup.mjs): حراسات بلا شبكة، وسلامة الخطة (6 جداول و12 دالة بلا CASCADE ولا كائن مشترك)، وبناء ملف الاستعادة. بلا أسرار.
   node platform/supabase/tests/beta/beta-ruqya-cleanup.test.mjs */
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PLAN, TABLES, FUNCS, SHARED_FUNCS, SHARED_TABLES, buildRestore, diffSnapshots } from "../../../../scripts/supabase-beta-ruqya-cleanup.mjs";
const ROOT = path.resolve(new URL(import.meta.url).pathname, "../../../../..");
const REG = JSON.parse(readFileSync(path.join(ROOT, "platform/env/environments.json"), "utf8")), BETA = REG.environments.beta.supabase_ref, PROD = REG.environments.production.supabase_ref;
let pass = 0, fail = 0; const ok = (m, c, x) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  " + JSON.stringify(x).slice(0, 200))); };
const TMP = mkdtempSync(path.join(tmpdir(), "ruq-")); let n = 0;
function cli(args, env, mode = "reject") {
  const log = path.join(TMP, `n${++n}.log`);
  const r = spawnSync(process.execPath, ["--no-warnings", "--import", path.join(ROOT, "platform/env/test/record-network.mjs"), path.join(ROOT, "scripts/supabase-beta-ruqya-cleanup.mjs"), ...args], { env: { PATH: process.env.PATH, NET_LOG: log, NET_MODE: mode, ...env }, encoding: "utf8", cwd: ROOT, timeout: 60000 });
  const calls = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []; return { code: r.status, calls, out: r.stdout + r.stderr };
}
const GOOD = { BETA_SUPABASE_REF: BETA, BETA_SUPABASE_PAT: "fake-pat" };
/* الحراسات: لا اتصال إطلاقاً */
let r = cli([], GOOD); ok("[G1] بلا وضع ⇒ رمز 2 وبلا اتصال", r.code === 2 && r.calls.length === 0, r);
r = cli(["--apply", "--confirm-ref", PROD, "--backup-dir", TMP], { BETA_SUPABASE_REF: PROD, BETA_SUPABASE_PAT: "x" }); ok("[G2] مرجع Production ⇒ رفض بلا اتصال", r.code === 2 && r.calls.length === 0, r.out);
r = cli(["--apply", "--backup-dir", TMP], GOOD); ok("[G3] --apply بلا --confirm-ref ⇒ رفض بلا اتصال", r.code === 2 && r.calls.length === 0, r.out);
r = cli(["--apply", "--confirm-ref", BETA, "--backup-dir", TMP], { BETA_SUPABASE_REF: BETA }); ok("[G4] بلا PAT ⇒ رفض بلا اتصال", r.code === 2 && r.calls.length === 0, r.out);
r = cli(["--dry-run"], GOOD); ok("[G5] بلا --backup-dir ⇒ رفض (قبل أي استعلام SQL)", r.code === 2 && !r.calls.some((c) => /database\/query/.test(c.path)), { code: r.code, paths: r.calls.map((c) => c.path) });
for (const mode of ["reject", "500"]) { r = cli(["--apply", "--confirm-ref", BETA, "--backup-dir", TMP], GOOD, mode); ok(`[N/${mode}] فشل الاتصال/500 ⇒ لا تنفيذ، ولا استعلام SQL، والمضيف api.supabase.com فقط`, r.code !== 0 && !r.calls.some((c) => /database\/query/.test(c.path)) && r.calls.every((c) => c.host === "api.supabase.com"), { code: r.code, calls: r.calls.length }); }
/* سلامة الخطة */
ok("[P1] الخطة بلا CASCADE", !/cascade/i.test(PLAN));
ok("[P2] تحذف 12 دالة بالضبط وبالتواقيع المسجَّلة", (PLAN.match(/drop function if exists/g) || []).length === 12 && FUNCS.every((s) => PLAN.includes(`public.${s.replace(/\(.*$/, "")}(`)));
ok("[P3] تحذف الجداول الستة بالضبط", TABLES.every((t) => PLAN.includes("public." + t)) && (PLAN.match(/public\.ruqya_/g) || []).length >= 6 && !/drop table public\.(?!ruqya_)/.test(PLAN));
ok("[P4] لا كائن مشترك في الخطة", ![...SHARED_FUNCS, ...SHARED_TABLES].some((s) => new RegExp("public\\." + s + "\\b").test(PLAN)), PLAN.match(/public\.\w+/g));
ok("[P5] الدوال تُحذف قبل الجداول (دوال plpgsql لا تُتتبَّع كتبعيات)", PLAN.indexOf("drop table") > PLAN.lastIndexOf("drop function"));
/* ملف الاستعادة */
const fp = { tables: [{ name: "ruqya_a", rls: true, rls_forced: false, columns: [{ n: "id", t: "bigint", nn: true, d: null, id: "a" }, { n: "x", t: "text", nn: false, d: "''::text", id: "" }], constraints: [{ n: "ruqya_a_pkey", type: "p", def: "PRIMARY KEY (id)" }], indexes: [{ n: "ruqya_a_pkey", def: "CREATE UNIQUE INDEX ruqya_a_pkey ON public.ruqya_a USING btree (id)" }, { n: "ruqya_x_idx", def: "CREATE INDEX ruqya_x_idx ON public.ruqya_a USING btree (x)" }], policies: [{ n: "admin", cmd: "ALL", perm: "PERMISSIVE", roles: "{authenticated}", q: "is_admin()", wc: "is_admin()" }], grants: [{ g: "authenticated", p: "SELECT" }, { g: "authenticated", p: "INSERT" }] },
  { name: "ruqya_b", rls: true, rls_forced: false, columns: [{ n: "a_id", t: "bigint", nn: false, d: null, id: "" }], constraints: [{ n: "ruqya_b_fk", type: "f", def: "FOREIGN KEY (a_id) REFERENCES ruqya_a(id)" }], indexes: [], policies: [], grants: [] }],
  functions: [{ sig: "ruqya_z(p jsonb)", def: "CREATE OR REPLACE FUNCTION public.ruqya_z(p jsonb) RETURNS jsonb LANGUAGE sql AS $f$ select p $f$", secdef: false, anon: true, auth: true, svc: false }, { sig: "_ruqya_h()", def: "CREATE OR REPLACE FUNCTION public._ruqya_h() RETURNS int LANGUAGE sql AS $f$ select 1 $f$", secdef: false, anon: false, auth: true, svc: true }] };
const s = buildRestore(fp, { ruqya_a: [{ id: 1, x: "q" }] });
ok("[R1] جدول بعمود identity وافتراضي وقيد أساسي", /create table public\.ruqya_a/.test(s) && /generated always as identity/.test(s) && /default ''::text/.test(s) && /add constraint ruqya_a_pkey PRIMARY KEY/.test(s));
ok("[R2] المفتاح الأجنبي بعد إنشاء كل الجداول، والفهرس المرتبط بقيد لا يُكرَّر", s.indexOf("create table public.ruqya_b") < s.indexOf("ruqya_b_fk") && !/CREATE UNIQUE INDEX ruqya_a_pkey/.test(s) && /CREATE INDEX ruqya_x_idx/.test(s));
ok("[R3] RLS وسياسة بدورها وصلاحيات الجدول", /enable row level security/.test(s) && /create policy "admin" on public\.ruqya_a as permissive for all to authenticated using \(is_admin\(\)\) with check \(is_admin\(\)\)/.test(s) && /grant (SELECT, INSERT|INSERT, SELECT) on table public\.ruqya_a to authenticated/.test(s));
ok("[R4] الدالة المساعدة (تبدأ بـ_) تُنشأ أولاً، وصلاحيات التنفيذ تُعاد بالأدوار الصحيحة", s.indexOf("_ruqya_h()") < s.indexOf("ruqya_z(p jsonb)") && /grant execute on function public\._ruqya_h\(\) to authenticated, service_role/.test(s) && /grant execute on function public\.ruqya_z\(p jsonb\) to anon, authenticated;/.test(s));
ok("[R5] البيانات تُدرَج مع تجاوز identity وإعادة ضبط التسلسل", /insert into public\.ruqya_a overriding system value/.test(s) && /setval\(pg_get_serial_sequence/.test(s) && /^begin;/m.test(s) && /commit;\s*$/.test(s));
/* مقارنة اللقطات */
const d = diffSnapshots({ tables: ["a", "ruqya_x"], functions: ["f()", "ruqya_f()"], policies: ["a:p", "ruqya_x:q"], rls_off: 0 }, { tables: ["a"], functions: ["f()"], policies: ["a:p"], rls_off: 0 });
ok("[D1] diffSnapshots: المحذوف فقط، لا مضاف", d.tablesRemoved[0] === "ruqya_x" && d.functionsRemoved[0] === "ruqya_f()" && d.policiesRemoved[0] === "ruqya_x:q" && !d.tablesAdded.length && !d.functionsAdded.length);
rmSync(TMP, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} pass / ${fail} fail`); process.exit(fail ? 1 : 0);
