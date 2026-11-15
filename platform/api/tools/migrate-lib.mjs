// منطق الهجرات (لا يعرف نوع التنفيذ): exec(sql, params) → { results, changes }. يعمل على node:sqlite محلياً وعلى D1 (REST/miniflare) بالواجهة نفسها.
// الضمانات: هوية القاعدة تُتحقَّق قبل أي كتابة؛ تتبّع بـpf_migrations (الاسم + sha256)؛ تغيير ملف مُطبَّق = checksum_mismatch؛ هجرة مُطبَّقة غير موجودة على القرص = unknown_applied_migration؛
// كل هجرة يجب أن تكون قابلة لإعادة التطبيق (IF NOT EXISTS) لأن D1 REST لا يعطي معاملة واحدة عبر عدة جمل: فشل في المنتصف يُستأنف بإعادة التشغيل ولا يُسجَّل الصف إلا بعد نجاح كل الجمل.
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
export const sha = (t) => createHash("sha256").update(t).digest("hex");
export const splitStatements = (sql) => sql.replace(/--[^\n]*/g, "").split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
export function loadMigrations(dir) {
  return readdirSync(dir).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort().map((f) => { const text = readFileSync(new URL(f, dir), "utf8"); return { name: f, sha: sha(text), statements: splitStatements(text) }; });
}
export async function migrate({ exec, env, migrations, dryRun = false, log = () => { } }) {
  if (!["beta", "local"].includes(env)) throw new Error("migrate_guard:هذه الأداة لا تعمل على " + env + " (beta|local فقط)");
  await exec("CREATE TABLE IF NOT EXISTS pf_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL, at TEXT NOT NULL)"); await exec("CREATE TABLE IF NOT EXISTS pf_migrations (name TEXT PRIMARY KEY, sha TEXT NOT NULL, applied_at TEXT NOT NULL)");
  const id = (await exec("SELECT v FROM pf_meta WHERE k='environment'")).results[0]?.v;
  if (id == null) { if (dryRun) log("dry: ستُكتب هوية القاعدة =", env); else await exec("INSERT OR IGNORE INTO pf_meta (k,v,at) VALUES ('environment',?,?)", [env, new Date().toISOString()]); }
  else if (id !== env) throw new Error(`migrate_guard:هوية القاعدة '${id}' ≠ '${env}' — أُوقفت الهجرة`);
  const applied = new Map((await exec("SELECT name, sha FROM pf_migrations")).results.map((r) => [r.name, r.sha])), disk = new Set(migrations.map((m) => m.name));
  for (const n of applied.keys()) if (!disk.has(n)) throw new Error("unknown_applied_migration:" + n);
  const done = [], skipped = [];
  for (const m of migrations) {
    if (applied.has(m.name)) { if (applied.get(m.name) !== m.sha) throw new Error("migration_checksum_mismatch:" + m.name); skipped.push(m.name); continue; }
    log(dryRun ? "dry: ستُطبَّق" : "تُطبَّق", m.name, `(${m.statements.length} جملة)`);
    if (!dryRun) { for (const s of m.statements) await exec(s); await exec("INSERT INTO pf_migrations (name,sha,applied_at) VALUES (?,?,?)", [m.name, m.sha, new Date().toISOString()]); }
    done.push(m.name);
  }
  return { applied: done, skipped, environment: id ?? env };
}
