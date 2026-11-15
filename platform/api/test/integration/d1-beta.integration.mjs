/* اختبار تكامل D1 لـBeta: يتحقق من عقد D1 الحقيقي (تزامن الادّعاء الذرّي، ملكية الرمز، الفهارس/الخطط، حدّ الصفوف المقروءة، التفرّد، الهجرات) على قاعدة Beta.
   الأوضاع:  --local  (محرك D1 المحلي miniflare — تدريب على المنطق، ليس الخدمة)    |   بلا علم: D1 **البعيد** (REST) — يتطلب BETA_CF_ACCOUNT_ID وBETA_CF_API_TOKEN وBETA_D1_NAME.
   حراسات (البعيد): الاسم يجب = قاعدة Beta في السجل وليس أي قاعدة إنتاج؛ pf_meta.environment يجب = beta قبل أي كتابة؛ يكتب فقط صفوفاً بمعرّف تشغيل itest-<id> (tenant_id ≥ 900000000) ويحذفها.
   لا يشغّل التنظيف غير المحصور (يختبر شكل العبارة نفسها بقيد tenant_id) فلا يمسّ بيانات Beta الأخرى.   الخرج الأخير: RESULT: PASS|FAIL|SKIPPED (SKIPPED=لم يُشغَّل لنقص بيانات الاعتماد وليس نجاحاً). */
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { readFileSync } from "node:fs"; import path from "node:path"; import { randomBytes } from "node:crypto";
const HERE = path.dirname(new URL(import.meta.url).pathname), API = path.resolve(HERE, "..", ".."), LOCAL = process.argv.includes("--local"), REG = JSON.parse(readFileSync(path.join(API, "../env/environments.json"), "utf8")).environments;
const { loadMigrations, migrate } = await import(pathToFileURL(path.join(API, "tools/migrate-lib.mjs")).href);
let pass = 0, fail = 0; const ok = (m, c, x) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  " + JSON.stringify(x).slice(0, 260))); };
const end = (r, code) => { console.log("RESULT: " + r); process.exit(code); };
let q, cleanupTransport = async () => { };
if (LOCAL) {
  const req = createRequire(path.join(process.env.MF_DIR || process.cwd(), "x.js")); const { Miniflare } = await import(pathToFileURL(req.resolve("miniflare")).href);
  const mf = new Miniflare({ modules: true, script: "export default { fetch(){ return new Response('ok') } }", d1Databases: { DB: "beta-local" } }), db = await mf.getD1Database("DB");
  q = async (sql, p = []) => { const r = await db.prepare(sql).bind(...p).all(); return { results: r.results ?? [], meta: r.meta ?? {} }; }; cleanupTransport = () => mf.dispose();
  const r = await migrate({ exec: async (s, p) => { const x = await q(s, p); return { results: x.results, changes: x.meta.changes ?? 0 }; }, env: "beta", migrations: loadMigrations(new URL("../../migrations/", import.meta.url)) }); console.log("(محلي) هجرات:", r.applied.length, "جديدة");
} else {
  const need = ["BETA_CF_ACCOUNT_ID", "BETA_CF_API_TOKEN", "BETA_D1_NAME"].filter((k) => !process.env[k]);
  if (need.length) end("SKIPPED (missing: " + need.join(",") + ") — لم يُشغَّل؛ ليس نجاحاً", process.argv.includes("--require") ? 3 : 0);
  const name = process.env.BETA_D1_NAME, bad = [REG.production.cf_d1, REG.production.gateway_d1, REG.beta.gateway_d1];
  if (name !== REG.beta.cf_d1 || bad.includes(name)) end(`FAIL: BETA_D1_NAME='${name}' يجب أن = '${REG.beta.cf_d1}' (قاعدة Beta) — رُفض`, 2);
  const A = "https://api.cloudflare.com/client/v4", H = { Authorization: "Bearer " + process.env.BETA_CF_API_TOKEN, "Content-Type": "application/json" }, acct = process.env.BETA_CF_ACCOUNT_ID;
  const cf = async (m, p, b) => { const r = await fetch(A + p, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }), j = await r.json().catch(() => ({})); if (!j.success) throw new Error(`${m} ${p.replace(/\/[0-9a-f-]{30,}/g, "/<id>")} → ${r.status} ${JSON.stringify(j.errors || j).slice(0, 200)}`); return j.result; };
  const list = (await cf("GET", `/accounts/${acct}/d1/database?name=${name}`)).filter((d) => d.name === name); if (list.length !== 1) end(`FAIL: وُجدت ${list.length} قاعدة باسم ${name} (المتوقع 1)`, 2);
  const uuid = list[0].uuid; q = async (sql, p = []) => { const r = await cf("POST", `/accounts/${acct}/d1/database/${uuid}/query`, { sql, params: p }); return { results: r?.[0]?.results ?? [], meta: r?.[0]?.meta ?? {} }; };
}
try {
  /* S0: الهوية قبل أي كتابة */
  const id = (await q("SELECT v FROM pf_meta WHERE k='environment'").catch(() => ({ results: [] }))).results[0]?.v; ok("[S0] pf_meta.environment = beta (هوية قاعدة Beta)", id === "beta", id); if (id !== "beta") end("FAIL: هوية القاعدة ليست beta — أُوقف قبل أي كتابة", 2);
  /* S1: الهجرات مطبَّقة بنفس الـchecksum */
  const migs = loadMigrations(new URL("../../migrations/", import.meta.url)), rows = (await q("SELECT name, sha FROM pf_migrations")).results; ok("[S1] كل ملفات الهجرات مسجَّلة بنفس sha256 (" + migs.length + ")", migs.every((m) => rows.find((r) => r.name === m.name)?.sha === m.sha), rows.map((r) => r.name));
  /* S2: تطابق الأجسام مع schema.sql */
  const want = [...readFileSync(path.join(API, "schema.sql"), "utf8").replace(/--[^\n]*/g, "").matchAll(/CREATE (?:UNIQUE )?(TABLE|INDEX) IF NOT EXISTS\s+([a-z0-9_]+)/gi)].map((m) => m[2].toLowerCase()), have = new Set((await q("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")).results.map((r) => r.name.toLowerCase()));
  ok("[S2] كل جداول وفهارس schema.sql موجودة في القاعدة (" + want.length + ")", want.every((n) => have.has(n)), want.filter((n) => !have.has(n)));
  /* S3: خطة الاستعلام تستعمل الفهرس */
  const plan = (await q("EXPLAIN QUERY PLAN SELECT COUNT(*) AS n, MIN(at) AS o FROM pf_idem WHERE status=-1")).results.map((r) => r.detail).join(" | "); ok("[S3] عدّ العالق يستعمل ix_pf_idem_st (لا مسح كامل)", /ix_pf_idem_st/.test(plan), plan);
  const run = "itest-" + randomBytes(4).toString("hex"), T = 900000000 + Math.floor(Math.random() * 90000000), now = Math.floor(Date.now() / 1000);
  try {
    /* S4: ادّعاء ذرّي متزامن */
    const k = run + "-claim", rs = await Promise.all(Array.from({ length: 12 }, (_, i) => q("INSERT OR IGNORE INTO pf_idem (tenant_id,k,hash,status,body,at) VALUES (?,?,?,0,?,?)", [T, k, "h", "tok" + i, now])));
    const winners = rs.filter((r) => r.meta.changes === 1); ok("[S4] 12 ادّعاءً متزامناً لنفس (tenant,k) ← واحد فقط يفوز (INSERT OR IGNORE + meta.changes على D1)", winners.length === 1, rs.map((r) => r.meta.changes));
    const row = (await q("SELECT body FROM pf_idem WHERE tenant_id=? AND k=?", [T, k])).results[0]; ok("[S4] رمز المالك المخزَّن = رمز الفائز الواحد", !!row && rs.findIndex((r) => r.meta.changes === 1) === +row.body.replace("tok", ""));
    /* S5: ملكية الرمز */
    const own = row.body; const bad = await q("UPDATE pf_idem SET status=201, body='{}', at=? WHERE tenant_id=? AND k=? AND status IN (0,-1) AND body=?", [now, T, k, "not-the-owner"]); const good = await q("UPDATE pf_idem SET status=201, body='{\"ok\":1}', at=? WHERE tenant_id=? AND k=? AND status IN (0,-1) AND body=?", [now, T, k, own]);
    ok("[S5] إنهاء بمالك خاطئ ← 0 صفوف؛ بالمالك ← 1", bad.meta.changes === 0 && good.meta.changes === 1, { bad: bad.meta.changes, good: good.meta.changes });
    const rel = await q("DELETE FROM pf_idem WHERE tenant_id=? AND k=? AND status IN (0,-1) AND body=?", [T, k, own]); ok("[S5] تحرير مطالبة مكتملة (status>0) ← 0 صفوف (لا يحرَّر المكتمل)", rel.meta.changes === 0);
    /* S6: قراءة الشاذ بالفهرس + حدّ الصفوف المقروءة */
    await q(`WITH RECURSIVE c(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM c WHERE i<2000) INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) SELECT ${T}, '${run}-bulk-' || i, 'h', 201, '{}', ${now - 30 * 86400} - i FROM c`);
    await q("INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) VALUES (?,?,?,-1,'t1',?),(?,?,?,0,'t2',?),(?,?,?,0,'t3',?)", [T, run + "-stuck", "h", now - 7200, T, run + "-over", "h", now - 600, T, run + "-fresh", "h", now - 5]);
    const st = await q("SELECT COUNT(*) AS n FROM pf_idem WHERE status=-1 AND tenant_id=?", [T]), od = await q("SELECT COUNT(*) AS n FROM pf_idem WHERE status=0 AND at<=? AND tenant_id=?", [now - 60, T]), fr = await q("SELECT COUNT(*) AS n FROM pf_idem WHERE status=0 AND at>? AND tenant_id=?", [now - 60, T]);
    ok("[S6] عدّ العالق=1، المتجاوز=1، الحديث=1 على بيانات اختبار", st.results[0].n === 1 && od.results[0].n === 1 && fr.results[0].n === 1, [st.results[0].n, od.results[0].n, fr.results[0].n]);
    const rr = (await q("SELECT COUNT(*) AS n FROM pf_idem WHERE status=-1")).meta.rows_read; ok("[S6] صفوف مقروءة لعدّ العالق على كل الجدول (الفهرس): أقل بكثير من حجم الجدول (≥2000 صفاً اختبارياً)", typeof rr === "number" && rr < 500, { rows_read: rr });
    /* S7: شكل عبارة التنظيف على D1 (محصورة باختبارنا) */
    const pr = await q("DELETE FROM pf_idem WHERE rowid IN (SELECT rowid FROM pf_idem WHERE status>0 AND at<? AND tenant_id=? ORDER BY at LIMIT ?)", [now - 7 * 86400, T, 500]); ok("[S7] عبارة التنظيف (rowid IN … LIMIT) مدعومة على D1: حذفت 500 بالضبط من 2000 قديم", pr.meta.changes === 500, pr.meta);
    const keep = (await q("SELECT COUNT(*) AS n FROM pf_idem WHERE tenant_id=? AND status<=0", [T])).results[0].n; ok("[S7] التنظيف لم يلمس الصفوف 0/-1 (3 صفوف اختبار باقية)", keep === 3, keep);
    /* S8: شريحة المراجعة الذرّية */
    const slot = run + "-slot", sl = await Promise.all(Array.from({ length: 8 }, () => q("INSERT OR IGNORE INTO pf_idem_review (slot,kind,at,data) VALUES (?,?,?,?)", [slot, "cycle", now, "{}"]))); ok("[S8] 8 شرائح متزامنة بالمفتاح نفسه ← واحدة فقط تفوز (pf_idem_review)", sl.filter((r) => r.meta.changes === 1).length === 1);
    /* S9: تفرّد الأحداث */
    const ev = (ext) => q("INSERT INTO pf_events (tenant_id,type,payload,ext_id,state,attempts,next_at,created_at) VALUES (?,?,?,?,?,0,?,?)", [T, "itest.ping", "{}", ext, "done", now, new Date().toISOString()]); await ev(run + "-ext"); const dup = await ev(run + "-ext").then(() => null, (e) => String(e.message));
    ok("[S9] تكرار (tenant_id, ext_id) في pf_events يُرفض بخطأ تفرّد (يطابق DB.isUnique)", !!dup && /UNIQUE|constraint/i.test(dup), dup);
    /* قياس معلوماتي */
    const c1 = await q("INSERT OR IGNORE INTO pf_idem (tenant_id,k,hash,status,body,at) VALUES (?,?,?,0,'m',?)", [T, run + "-m", "h", now]), c2 = await q("UPDATE pf_idem SET status=201, body='{}', at=? WHERE tenant_id=? AND k=? AND body='m'", [now, T, run + "-m"]);
    console.log(`  (معلومة) rows_written للادّعاء=${c1.meta.rows_written ?? "?"}، للإنهاء=${c2.meta.rows_written ?? "?"} (الفهرس ix_pf_idem_st مفعّل)`);
  } finally {
    await q("DELETE FROM pf_idem WHERE tenant_id=?", [T]); await q("DELETE FROM pf_events WHERE tenant_id=?", [T]); await q("DELETE FROM pf_idem_review WHERE slot LIKE ?", [run + "%"]);
    const left = (await q("SELECT (SELECT COUNT(*) FROM pf_idem WHERE tenant_id=?) + (SELECT COUNT(*) FROM pf_events WHERE tenant_id=?) + (SELECT COUNT(*) FROM pf_idem_review WHERE slot LIKE ?) AS n", [T, T, run + "%"])).results[0].n; ok("[S10] التنظيف: لا بقايا من صفوف الاختبار (tenant_id اختباري/slot)", left === 0, left);
  }
} catch (e) { ok("[خطأ] " + String(e.message).slice(0, 200), false); } finally { await cleanupTransport(); }
end(fail ? `FAIL ${fail} من ${pass + fail}` : `PASS ${pass}/${pass}${LOCAL ? " (محرك D1 المحلي — ليس D1 البعيد)" : " (D1 البعيد — Beta)"}`, fail ? 1 : 0);
