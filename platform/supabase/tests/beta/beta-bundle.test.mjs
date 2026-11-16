#!/usr/bin/env node
/* حزمة SQL لـBeta خالية من الرقية (وظيفة موقع ALYSSUM فقط) مع حفظ بقية الحماية. بلا شبكة ولا أسرار.
   يثبت: (1) ruqya.sql مستبعَد وغائب عن الحزمة (2) كتلة RUQYA مجرَّدة من hardening-v01b والـSQL التنفيذي المتبقي = الأصل منقوصاً الكتلة فقط
   (3) حماية v01b الأخرى باقية (rate_hits + RLS + revoke + _rl_hit + customer_register + track_order) (4) غياب العلامتين أو بقاء أثر للرقية في أي ملف ⇒ رفض
   node platform/supabase/tests/beta/beta-bundle.test.mjs */
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildBundle, stripBlock, loadConfig } from "../../../../scripts/supabase-beta-apply.mjs";
const ROOT = path.resolve(new URL(import.meta.url).pathname, "../../../../..");
let pass = 0, fail = 0; const ok = (m, c, x) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  " + JSON.stringify(x).slice(0, 220))); };
const norm = (t) => t.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim();
const count = (t, rx) => (t.match(rx) || []).length;
const V1B = "platform/supabase/hardening-v01b.sql", orig = readFileSync(path.join(ROOT, V1B), "utf8");
const EMAIL = "beta-admin@example.test";

const { M } = loadConfig(), ord = M.supabase.sql_apply_order;
ok("[R1] ruqya.sql ضمن المستبعَد وليس ضمن المطلوب", ord.excluded.includes("platform/supabase/ruqya.sql") && !ord.required.includes("platform/supabase/ruqya.sql"), ord.required);
ok("[R2] strip_blocks يعلن RUQYA لـhardening-v01b", ord.strip_blocks?.[V1B] === "RUQYA");

const b = buildBundle({ adminEmail: EMAIL }), v1b = b.files.find((f) => f.path === V1B);
ok("[R3] الحزمة تُبنى بلا مشاكل", b.problems.length === 0, b.problems);
ok("[R4] لا ملف ruqya.sql في الحزمة ولا أثر لكلمة ruqya/رقية في أي ملف", !b.files.some((f) => /ruqya/i.test(f.path)) && !b.files.some((f) => /ruqya|رقية/i.test(f.sql)), b.files.filter((f) => /ruqya|رقية/i.test(f.sql)).map((f) => f.path));
ok("[R5] hardening-v01 قبل v01b، والحزمة 9 ملفات + صف admins المولَّد", b.files.length === 10 && b.files.findIndex((f) => f.path.endsWith("hardening-v01.sql")) < b.files.findIndex((f) => f.path === V1B), b.files.map((f) => f.path.replace("platform/", "")));

/* الأصل يحوي كتلة RUQYA فعلاً (وإلا فالاختبار أجوف) */
const blk = stripBlock(orig, "RUQYA");
const indep = orig.replace(/-- RUQYA:start[\s\S]*?-- RUQYA:end\n?/, "");                                   // تعبير مستقل عن دالة الأداة (لا اختبار دائري)
ok("[R6] الأصل فيه كتلة RUQYA واحدة بعلامتيها وفيها ruqya_lookup وruqya_book", blk.n === 1 && /ruqya_lookup/.test(orig) && /ruqya_book/.test(orig) && !/ruqya/i.test(blk.sql), { n: blk.n });
ok("[R7] ما بقي من v01b = الأصل منقوصاً الكتلة فقط (الـSQL التنفيذي متطابق حرفياً)", v1b && norm(v1b.sql) === norm(indep) && v1b.sql === indep);

/* بقية الحماية باقية بالعدد نفسه */
const keep = [["create table if not exists public.rate_hits", /create table if not exists public\.rate_hits/i], ["RLS على rate_hits", /alter table public\.rate_hits enable row level security/i], ["revoke على rate_hits", /revoke all on public\.rate_hits from anon, authenticated/i], ["تعريف _rl_hit", /create or replace function public\._rl_hit/i], ["revoke على _rl_hit", /revoke all on function public\._rl_hit/i], ["customer_register", /create or replace function public\.customer_register/i], ["track_order", /create or replace function public\.track_order/i]];
for (const [n, rx] of keep) ok(`[R8] باقٍ بعد التجريد: ${n}`, rx.test(v1b?.sql ?? ""));
ok("[R9] عدد عبارات revoke/security definer/search_path في v01b بعد التجريد = الأصل بعد إسقاط ما داخل الكتلة", ["revoke", "security definer", "set search_path"].every((k) => count(v1b?.sql ?? "", new RegExp(k, "gi")) === count(indep, new RegExp(k, "gi"))));

/* حالات الرفض (على نسخة مؤقتة من الملفات المطلوبة فقط) */
function sandbox(mutate) {
  const T = mkdtempSync(path.join(tmpdir(), "beta-bundle-"));
  mkdirSync(path.join(T, "platform/env"), { recursive: true }); mkdirSync(path.join(T, "platform/supabase"), { recursive: true }); mkdirSync(path.join(T, "platform/sql"), { recursive: true });
  for (const f of readdirSync(path.join(ROOT, "platform/env")).filter((x) => x.endsWith(".json"))) copyFileSync(path.join(ROOT, "platform/env", f), path.join(T, "platform/env", f));
  for (const f of [...ord.required, ord.excluded[1]]) copyFileSync(path.join(ROOT, f), path.join(T, f));
  mutate(T); const r = buildBundle({ root: T, adminEmail: EMAIL }); rmSync(T, { recursive: true, force: true }); return r;
}
const w = (T, f, fn) => { const p = path.join(T, f); writeFileSync(p, fn(readFileSync(p, "utf8"))); };
let r = sandbox((T) => w(T, V1B, (t) => t.replace(/-- RUQYA:start[^\n]*\n/, "")));
ok("[R10] غياب علامة RUQYA:start ⇒ رفض (لا تجريد صامت)", r.problems.some((p) => /RUQYA/.test(p) && /وُجدت 0/.test(p)), r.problems);
r = sandbox((T) => w(T, "platform/supabase/roles.sql", (t) => t + "\n-- ruqya leftover\n"));
ok("[R11] أثر للرقية في أي ملف آخر ⇒ رفض", r.problems.some((p) => /roles\.sql: بقي أثر للرقية/.test(p)), r.problems);
r = sandbox((T) => w(T, V1B, (t) => t + "\n-- RUQYA:start\nselect 1;\n-- RUQYA:end\n"));
ok("[R12] كتلتان بدل واحدة ⇒ رفض", r.problems.some((p) => /وُجدت 2/.test(p)), r.problems);
r = sandbox(() => { });
ok("[R13] النسخة المؤقتة السليمة تمرّ (الاختبارات السلبية ليست إيجابية كاذبة)", r.problems.length === 0, r.problems);
console.log(`\nRESULT: ${pass} pass / ${fail} fail`); process.exit(fail ? 1 : 0);
