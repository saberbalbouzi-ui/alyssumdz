/* نظام هجرات D1: ضمانات الهوية والـchecksum والاستئناف وعدم انجراف schema.sql عن الهجرات. ⚠ LOCAL ONLY (node:sqlite)؛ تشغيله على D1 المحلي (miniflare) في test/d1/idem-d1-local.mjs ثم البعيد في test/integration/d1-beta.integration.mjs. */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { loadMigrations, migrate, splitStatements, sha } from "../tools/migrate-lib.mjs";
import { Tally } from "./_harness.mjs";
const { ok, done } = Tally();
const MIG = new URL("../migrations/", import.meta.url), SCHEMA = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
const mkExec = (db) => async (sql, p = []) => { const st = db.prepare(sql); if (/^\s*(select|pragma|explain)/i.test(sql)) return { results: st.all(...p), changes: 0 }; const r = st.run(...p); return { results: [], changes: Number(r.changes) }; };
const objs = (db) => db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name<>'pf_migrations' ORDER BY type,name").all().map((o) => `${o.type}|${o.name}|${o.tbl_name}|${String(o.sql ?? "").replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim()}`);
const fresh = () => { const db = new DatabaseSync(":memory:"); return { db, exec: mkExec(db) }; };
const tr = async (f) => { try { await f(); return null; } catch (e) { return String(e.message); } };
const real = loadMigrations(MIG);
ok("[M1] مجلد الهجرات يحوي 0001_baseline وأسماؤها مرتبة", real.length >= 1 && real[0].name === "0001_baseline.sql" && real.every((m, i) => i === 0 || real[i - 1].name < m.name));
/* M2: تطابق schema.sql مع ناتج الهجرات (حارس الانجراف) */
{ const A = fresh(); await migrate({ exec: A.exec, env: "local", migrations: real }); const B = new DatabaseSync(":memory:"); B.exec(SCHEMA); const oa = objs(A.db), ob = objs(B).filter((x) => !/^table\|pf_meta\|/.test(x) || true);
  const sa = new Set(oa), sb = new Set(ob); const onlyMig = oa.filter((x) => !sb.has(x)), onlySchema = ob.filter((x) => !sa.has(x));
  ok("[M2] نتيجة تطبيق كل الهجرات على قاعدة فارغة ≡ schema.sql (جداول/فهارس/تعريفات) — لا انجراف", onlyMig.length === 0 && onlySchema.length === 0, { onlyMig: onlyMig.slice(0, 2), onlySchema: onlySchema.slice(0, 2) });
  ok("[M2] الفهرس الافتراضي ix_pf_idem_st وجدول pf_idem_review وpf_meta ضمن الناتج", ["index|ix_pf_idem_st|", "table|pf_idem_review|", "table|pf_meta|"].every((p) => oa.some((x) => x.startsWith(p)))); }
/* M3: إعادة التطبيق */
{ const { db, exec } = fresh(); const r1 = await migrate({ exec, env: "beta", migrations: real }), before = objs(db).join("\n"); const r2 = await migrate({ exec, env: "beta", migrations: real });
  ok("[M3] أول تشغيل يطبّق، والثاني idempotent (لا جديد، لا تغيير)", r1.applied.length === real.length && r2.applied.length === 0 && r2.skipped.length === real.length && objs(db).join("\n") === before);
  ok("[M3] هوية القاعدة تُكتب (beta) والتتبع يحوي الاسم وsha256", db.prepare("SELECT v FROM pf_meta WHERE k='environment'").get().v === "beta" && db.prepare("SELECT sha FROM pf_migrations WHERE name='0001_baseline.sql'").get().sha === real[0].sha); }
/* M4: checksum وغير المعروفة */
{ const { db, exec } = fresh(); await migrate({ exec, env: "beta", migrations: real }); const tampered = [{ ...real[0], sha: sha("tampered") }];
  ok("[M4] تعديل ملف هجرة مُطبَّقة ← migration_checksum_mismatch", /migration_checksum_mismatch:0001_baseline/.test(await tr(() => migrate({ exec, env: "beta", migrations: tampered }))));
  db.prepare("INSERT INTO pf_migrations (name,sha,applied_at) VALUES ('0099_ghost.sql','x','t')").run(); ok("[M4] هجرة مُطبَّقة غير موجودة على القرص ← unknown_applied_migration", /unknown_applied_migration:0099_ghost/.test(await tr(() => migrate({ exec, env: "beta", migrations: real })))); }
/* M5: الهوية والبيئة */
{ const { db, exec } = fresh(); db.exec("CREATE TABLE pf_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL, at TEXT NOT NULL)"); db.prepare("INSERT INTO pf_meta (k,v,at) VALUES ('environment','production','t')").run();
  const e = await tr(() => migrate({ exec, env: "beta", migrations: real })); ok("[M5] قاعدة موسومة production + --env beta ← رفض قبل أي كتابة (لا pf_migrations مطبَّقة ولا جداول المنصة)", /هوية القاعدة 'production'/.test(e) && db.prepare("SELECT COUNT(*) n FROM pf_migrations").get().n === 0 && !db.prepare("SELECT 1 FROM sqlite_master WHERE name='pf_tenants'").get(), e);
  ok("[M5] --env production محظور على الأداة كلياً (و'staging' غير معروفة)", /production/.test(await tr(() => migrate({ exec: fresh().exec, env: "production", migrations: real }))) && /migrate_guard/.test(await tr(() => migrate({ exec: fresh().exec, env: "staging", migrations: real })))); }
/* M6: dry-run لا يكتب */
{ const { db, exec } = fresh(); const logs = []; const r = await migrate({ exec, env: "beta", migrations: real, dryRun: true, log: (...a) => logs.push(a.join(" ")) });
  ok("[M6] dry-run يخطّط ولا يُنشئ جداول المنصة ولا يسجّل هجرات ولا هوية", r.applied.length === real.length && !db.prepare("SELECT 1 FROM sqlite_master WHERE name='pf_tenants'").get() && db.prepare("SELECT COUNT(*) n FROM pf_migrations").get().n === 0 && db.prepare("SELECT COUNT(*) n FROM pf_meta").get().n === 0 && logs.some((l) => /dry: ستُطبَّق 0001/.test(l)), logs); }
/* M7: هجرة جديدة + استئناف بعد فشل جزئي */
{ const dir = mkdtempSync(join(tmpdir(), "mig-")); try {
    writeFileSync(join(dir, "0001_baseline.sql"), readFileSync(new URL("0001_baseline.sql", MIG), "utf8")); writeFileSync(join(dir, "0002_add_test.sql"), "CREATE TABLE IF NOT EXISTS mg_a (x INTEGER);\nCREATE TABLE mg_b (x INTEGER);\nTHIS IS NOT SQL;\n");
    const L1 = loadMigrations(new URL("file://" + dir + "/")); const { db, exec } = fresh();
    const e = await tr(() => migrate({ exec, env: "beta", migrations: L1 })); ok("[M7] هجرة بجملة معطوبة في المنتصف ← تفشل ولا يُسجَّل صفّها (الأولى سُجِّلت)", !!e && db.prepare("SELECT COUNT(*) n FROM pf_migrations").get().n === 1 && !!db.prepare("SELECT 1 FROM sqlite_master WHERE name='mg_a'").get());
    db.exec("DROP TABLE mg_b"); writeFileSync(join(dir, "0002_add_test.sql"), "CREATE TABLE IF NOT EXISTS mg_a (x INTEGER);\nCREATE TABLE IF NOT EXISTS mg_b (x INTEGER);\n");
    const e2 = await tr(() => migrate({ exec, env: "beta", migrations: loadMigrations(new URL("file://" + dir + "/")) })); ok("[M7] بعد تعديل ملف لم يُسجَّل بعد: يُطبَّق (لم يُسجَّل ← لا checksum سابق)", e2 === null && db.prepare("SELECT COUNT(*) n FROM pf_migrations").get().n === 2);
    const e3 = await tr(() => { writeFileSync(join(dir, "0002_add_test.sql"), "CREATE TABLE IF NOT EXISTS mg_a (x INTEGER, y INTEGER);\n"); return migrate({ exec, env: "beta", migrations: loadMigrations(new URL("file://" + dir + "/")) }); }); ok("[M7] تعديل هجرة بعد تطبيقها ← checksum_mismatch", /migration_checksum_mismatch:0002/.test(e3), e3);
  } finally { rmSync(dir, { recursive: true, force: true }); } }
/* M8: splitStatements تتجاهل التعليقات وتفصل بدقة */
ok("[M8] splitStatements: تعليقات -- تُزال والفصل عند ;+سطر", JSON.stringify(splitStatements("-- c\nCREATE TABLE a (x);\nCREATE INDEX i ON a (x); -- tail\n")) === JSON.stringify(["CREATE TABLE a (x)", "CREATE INDEX i ON a (x)"]));
/* M9: الأداة CLI: رفض production وbeta بلا اعتماد، وlocal يعمل */
{ const run = (a, env = {}) => spawnSync(process.execPath, ["--no-warnings", "platform/api/tools/d1-migrate.mjs", ...a], { cwd: new URL("../../../", import.meta.url).pathname, encoding: "utf8", env: { PATH: process.env.PATH, ...env } });
  const p = run(["--env", "production"]), b = run(["--env", "beta"]), n = run([]); const f = join(tmpdir(), "mig-cli-" + process.pid + ".db"); const l1 = run(["--env", "local", "--local-db", f]), l2 = run(["--env", "local", "--local-db", f]); rmSync(f, { force: true });
  ok("[M9] CLI: production ← rc=2؛ بلا --env ← rc=2؛ beta بلا CF_ACCOUNT_ID/CF_ZONE_ID ← رفض", p.status === 2 && n.status === 2 && b.status === 2 && /CF_ACCOUNT_ID/.test(b.stdout + b.stderr), b.stderr);
  ok("[M9] CLI local: يطبّق ثم يعيد (idempotent)", l1.status === 0 && /جديدة: 1/.test(l1.stdout) && l2.status === 0 && /جديدة: 0/.test(l2.stdout), l1.stderr + l2.stderr); }
done();
