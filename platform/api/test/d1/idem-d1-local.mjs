/* اختبار pf_idem على **محرك D1 المحلي (workerd عبر miniflare)** — أقرب من node:sqlite لواجهة D1 الحقيقية (prepare/bind/batch/meta.rows_read/rows_written)
   لكنه **ليس خدمة Cloudflare D1 البعيدة** (تحقّقها على D1 تجريبي بعيد: BLOCKED ما لم تتوفر بيانات اعتماد صالحة). لا يلمس أي شبكة ولا قاعدة إنتاج.
   التشغيل (miniflare أداة تطوير غير مُدرَجة في المستودع):  cd /tmp/mf && npm i miniflare@4 && MF_DIR=/tmp/mf node <repo>/platform/api/test/d1/idem-d1-local.mjs
   يقيس: (1) الهجرة من المخطط القديم وإعادة تطبيقها (idempotent)، (2) خطط الاستعلام EXPLAIN QUERY PLAN بلا فهرس / (at) / (at)+(status,at)، (3) rows_read لاستعلامات التنظيف والمراجعة عند N صفاً،
   (4) تضخيم الكتابة rows_written للمطالبة والإنهاء بحسب الفهارس، (5) تشغيل شيفرة المنصة الحقيقية (claim/replay/prune/review/daily) فوق ربط D1 هذا. */
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { readFileSync } from "node:fs"; import path from "node:path";
const req = createRequire(path.join(process.env.MF_DIR || process.cwd(), "x.js"));
const { Miniflare } = await import(pathToFileURL(req.resolve("miniflare")).href);
const HERE = path.dirname(new URL(import.meta.url).pathname), API = path.resolve(HERE, "..", ".."), N = +process.env.N || 100000;
const { createPlatform, adminModule, HttpError, ok: okRes } = await import(pathToFileURL(path.join(API, "src/core.js")).href);
let pass = 0, fail = 0; const ok = (m, c, x) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  " + JSON.stringify(x))); };
const split = (sql) => sql.replace(/--[^\n]*/g, "").split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);               // نفس تقسيم tools/deploy.mjs
const NEW = readFileSync(path.join(API, "schema.sql"), "utf8");
const OLD = readFileSync(path.join(HERE, "schema-prod-ac88e69d.sql"), "utf8");                 // لقطة مخطط الإنتاج الحالي (الالتزام ac88e69d): بلا أي فهرس إضافي على pf_idem ولا جدول مراجعة
const mf = new Miniflare({ modules: true, script: "export default { fetch(){ return new Response('ok') } }", d1Databases: { MIG: "mig", A: "va", B: "vb", D: "vd", E: "ve", F: "func" } });
const d1 = async (n) => mf.getD1Database(n);
const apply = async (db, sql) => { for (const s of split(sql)) await db.prepare(s).run(); };
const idx = async (db) => (await db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name IN ('pf_idem','pf_idem_review') AND name NOT LIKE 'sqlite_autoindex%' ORDER BY name").all()).results.map((r) => r.name);
const tbl = async (db) => (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pf_idem_review'").all()).results.length;

/* (1) الهجرة */
{ const db = await d1("MIG"); await apply(db, OLD); const before = { idx: await idx(db), rev: await tbl(db) };
  await db.prepare("INSERT INTO pf_tenants (name,status,settings,created_at) VALUES ('t','active','{}','x')").run(); await db.prepare("INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) VALUES (1,'keep','h',201,'{}',1)").run();
  await apply(db, NEW); const a1 = { idx: await idx(db), rev: await tbl(db) }; await apply(db, NEW); const a2 = { idx: await idx(db), rev: await tbl(db) };
  ok("[MIG] المخطط الحالي (إنتاج): بلا فهارس إضافية وبلا جدول المراجعة", before.idx.length === 0 && before.rev === 0, before);
  ok("[MIG] بعد المخطط الجديد: ix_pf_idem_st + ix_pf_idem_review_at وجدول pf_idem_review (وix_pf_idem_at غير مفعّل)", ["ix_pf_idem_st", "ix_pf_idem_review_at"].every((n) => a1.idx.includes(n)) && !a1.idx.includes("ix_pf_idem_at") && a1.rev === 1, a1);
  ok("[MIG] إعادة التطبيق idempotent (لا تغيّر) والبيانات القائمة سليمة", JSON.stringify(a1) === JSON.stringify(a2) && (await db.prepare("SELECT status FROM pf_idem WHERE k='keep'").first()).status === 201); }

/* (2)+(3) خطط وقياسات: A بلا فهرس، B بفهرس at، D بـat وstatus,at */
const NOW = 1790000000, DAY = 86400;
const seed = async (db) => {
  await db.prepare("INSERT INTO pf_tenants (name,status,settings,created_at) VALUES ('t','active','{}','x')").run();
  await db.prepare(`WITH RECURSIVE c(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM c WHERE i<${N}) INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) SELECT 1 + (i % 20), 'k' || i, 'h', 201, '{}', ${NOW} - (i * 14 * ${DAY} / ${N}) FROM c`).run();
  await db.prepare(`WITH RECURSIVE c(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM c WHERE i<30) INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) SELECT 1 + (i % 20), 's' || i, 'h', -1, 'tok', ${NOW} - 40000 - i FROM c`).run();
  await db.prepare(`WITH RECURSIVE c(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM c WHERE i<20) INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) SELECT 1 + (i % 20), 'o' || i, 'h', 0, 'tok', ${NOW} - 600 - i FROM c`).run();
  await db.prepare(`WITH RECURSIVE c(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM c WHERE i<15) INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) SELECT 1 + (i % 20), 'f' || i, 'h', 0, 'tok', ${NOW} - 5 FROM c`).run(); };
const QS = {
  prune_select: ["SELECT rowid FROM pf_idem WHERE status>0 AND at<? ORDER BY at LIMIT 500", [NOW - 7 * DAY]],
  rev_stuck: ["SELECT COUNT(*) AS n, MIN(at) AS o FROM pf_idem WHERE status=-1", []],
  rev_overdue: ["SELECT COUNT(*) AS n, MIN(at) AS o FROM pf_idem WHERE status=0 AND at<=?", [NOW - 60]],
  rev_fresh: ["SELECT COUNT(*) FROM pf_idem WHERE status=0 AND at>?", [NOW - 60]],
  rev_future: ["SELECT COUNT(*) FROM pf_idem WHERE at>?", [NOW + 300]],
  rev_no_token: ["SELECT COUNT(*) FROM pf_idem WHERE status=0 AND body=''", []],
  rev_top_tenants: ["SELECT tenant_id, COUNT(*) AS n FROM (SELECT tenant_id FROM pf_idem WHERE status=-1 UNION ALL SELECT tenant_id FROM pf_idem WHERE status=0 AND at<=?) GROUP BY tenant_id ORDER BY n DESC LIMIT 5", [NOW - 60]],
  count_all_daily: ["SELECT COUNT(*) FROM pf_idem", []],
};
const stats = {}; const plans = {};
for (const [v, name] of [["A", "A"], ["B", "B"], ["D", "D"], ["E", "E"]]) {
  const db = await d1(name); for (const s of split(OLD)) await db.prepare(s).run();   // قاعدة الأساس = مخطط الإنتاج الحالي بلا أي فهرس على pf_idem
  if (v === "B" || v === "D") await db.prepare("CREATE INDEX ix_pf_idem_at ON pf_idem (at)").run(); if (v === "D" || v === "E") await db.prepare("CREATE INDEX ix_pf_idem_st ON pf_idem (status, at)").run();   // E = (status,at) وحده
  await seed(db); stats[v] = {}; plans[v] = {};
  for (const [q, [sql, bind]] of Object.entries(QS)) { const r = await db.prepare(sql).bind(...bind).all(); stats[v][q] = { rows_read: r.meta.rows_read, ms: +r.meta.duration.toFixed(2) };
    const p = await db.prepare("EXPLAIN QUERY PLAN " + sql).bind(...bind).all(); plans[v][q] = p.results.map((x) => x.detail).join(" | "); }
  /* تضخيم الكتابة: ادّعاء (INSERT) ثم إنهاء (UPDATE status,body,at) */
  const ins = await db.prepare("INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) VALUES (1,'wa-1','h',0,'tok',?)").bind(NOW).run(), upd = await db.prepare("UPDATE pf_idem SET status=201, body='{}', at=? WHERE tenant_id=1 AND k='wa-1' AND status IN (0,-1) AND body='tok'").bind(NOW).run();
  stats[v].write = { claim_rows_written: ins.meta.rows_written, finalize_rows_written: upd.meta.rows_written, finalize_rows_read: upd.meta.rows_read };
}
console.log("\n=== rows_read عند N=" + N + " (D1 يفوتر بالصفوف المقروءة) ===\nالاستعلام".padEnd(22) + "A(بلا)".padStart(10) + "B(at)".padStart(10) + "D(at+st)".padStart(10) + "E(st فقط)".padStart(11));
for (const q of Object.keys(QS)) console.log(q.padEnd(22) + String(stats.A[q].rows_read).padStart(10) + String(stats.B[q].rows_read).padStart(10) + String(stats.D[q].rows_read).padStart(10) + String(stats.E[q].rows_read).padStart(11));
console.log("claim rows_written".padEnd(22) + [stats.A, stats.B, stats.D, stats.E].map((s) => String(s.write.claim_rows_written).padStart(10)).join("")); console.log("finalize rows_written".padEnd(22) + [stats.A, stats.B, stats.D, stats.E].map((s) => String(s.write.finalize_rows_written).padStart(10)).join(""));
console.log("\n=== خطط الاستعلام (D) ==="); for (const [q, p] of Object.entries(plans.D)) console.log("  " + q.padEnd(18) + p); console.log("=== خطط E (st فقط): prune/future ==="); for (const q of ["prune_select", "rev_future"]) console.log("  " + q.padEnd(18) + plans.E[q]);
const E = plans.E, SE = stats.E, SD = stats.D, SA = stats.A;
ok("[PLAN] (الافتراضي E) استعلامات الدورة (عالق/متجاوز/حديث/بلا رمز/أعلى مستأجرين) تستعمل ix_pf_idem_st", ["rev_stuck", "rev_overdue", "rev_fresh", "rev_no_token", "rev_top_tenants"].every((q) => /ix_pf_idem_st/.test(E[q])), E);
ok("[PERF] (E) صفوف الدورة المقروءة ≤ 200 لكل استعلام مقابل ≥ N بلا فهرس", ["rev_stuck", "rev_overdue", "rev_fresh", "rev_no_token"].every((q) => SE[q].rows_read <= 200 && SA[q].rows_read >= N) && SE.rev_top_tenants.rows_read <= 500, { E: SE, A_stuck: SA.rev_stuck });
ok("[PERF] (E) التنظيف الساعي يقرأ فهرس status>0 (≈1.5N) — مقبول مرة/ساعة؛ مع (at) يقرأ 500 فقط (خيار للأحجام الكبيرة)", SE.prune_select.rows_read <= 2 * N && SD.prune_select.rows_read <= 500, { E: SE.prune_select, D: SD.prune_select });
ok("[PERF] فحص «المستقبلي» يحتاج (at): مع E يمسح N، لذلك نُقل للتقرير اليومي (مرة/يوم) لا الدورة", SE.rev_future.rows_read >= N && SD.rev_future.rows_read <= 5, { E: SE.rev_future, D: SD.rev_future });
ok("[WRITE] الكتابة لكل طلب (claim+finalize): A<E<D (تكلفة الفهارس)", SA.write.claim_rows_written + SA.write.finalize_rows_written < SE.write.claim_rows_written + SE.write.finalize_rows_written && SE.write.claim_rows_written + SE.write.finalize_rows_written < SD.write.claim_rows_written + SD.write.finalize_rows_written, { A: SA.write, E: SE.write, D: SD.write });
/* نموذج كلفة يومي مبني على القياس: قراءات = 96×(مراجعة) + 24×(تنظيف) + مسح يومي؛ كتابات = طلبات×(ادّعاء+إنهاء) */
const revQ = ["rev_stuck", "rev_overdue", "rev_fresh", "rev_no_token", "rev_top_tenants"], day = (s, withFuture) => 96 * revQ.reduce((n, q) => n + s[q].rows_read, 0) + (withFuture ? 96 * s.rev_future.rows_read : 0) + 24 * s.prune_select.rows_read + s.count_all_daily.rows_read + s.rev_future.rows_read;
const wr = (s, orders) => orders * (s.write.claim_rows_written + s.write.finalize_rows_written);
console.log("\n=== نموذج كلفة يومية (N=" + N + " ≈ طلبات/يوم " + Math.round(N / 7) + "): قراءات/يوم | كتابات/يوم ===");
for (const [name, s] of [["A بلا فهرس (مع مراجعتنا)", SA], ["B (at)", stats.B], ["D (at)+(status,at)", SD], ["E (status,at) ← الافتراضي", SE]]) console.log("  " + name.padEnd(30) + String(day(s, false)).padStart(12) + " |" + String(wr(s, Math.round(N / 7))).padStart(8));
ok("[COST] E أرخص كتابةً من D وقراءاتها اليومية دون حدّ D1 المجاني (5M/يوم) عند N=" + N, wr(SE, Math.round(N / 7)) < wr(SD, Math.round(N / 7)) && day(SE, false) < 5e6, { E_reads: day(SE, false), E_writes: wr(SE, Math.round(N / 7)), D_writes: wr(SD, Math.round(N / 7)) }); 

/* (5) شيفرة المنصة الحقيقية فوق ربط D1 المحلي */
{ const db = await d1("F"); await apply(db, NEW); let t = Date.parse("2026-10-12T10:00:00Z"); const clock = () => t; let execs = 0;
  const probe = { id: "probe", routes(r) { r.post("/v1/probe/op", { scope: "probe:write", idem: true, summary: "x" }, async (req) => { const n = ++execs; return okRes({ n }, 201); }); } };
  const app = createPlatform({ d1: db, modules: [adminModule, probe], secret: "d1-local-secret-0123456789", adminToken: "adm", baseUrl: "https://api.example", files: null, config: {}, clock, fetchFn: async () => ({ status: 200, text: async () => "{}" }) });
  const call = async (m, p, b, tok, h = {}) => { const r = await app.handle(m, p, {}, { ...(tok ? { authorization: "Bearer " + tok } : {}), ...h }, b == null ? "" : JSON.stringify(b), "9.9.9.9"); let j = {}; try { j = JSON.parse(r.body); } catch { } return [r.status, j, r.headers]; };
  const [, tn] = await call("POST", "/admin/tenants", { name: "T" }, "adm", { "x-actor": "o@x" }), [, kk] = await call("POST", `/admin/tenants/${tn.id}/keys`, { scopes: ["*"], mode: "live" }, "adm", { "x-actor": "o@x" });
  const go = (k) => call("POST", "/v1/probe/op", { a: 1 }, kk.key, { "idempotency-key": k });
  const rs = await Promise.all(Array.from({ length: 8 }, () => go("d1-same"))); ok("[FUNC] 8 طلبات متزامنة بمفتاح واحد على ربط D1 ← معالج واحد فقط", execs === 1 && rs.filter((r) => r[0] === 201).length >= 1, { execs, codes: rs.map((r) => r[0]) });
  const [c2, , h2] = await go("d1-same"); ok("[FUNC] إعادة ← الردّ المخزَّن (Replayed)", c2 === 201 && h2["Idempotent-Replayed"] === "true");
  const now = Math.floor(t / 1000); const row = (k, st, age, b) => db.prepare("INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) VALUES (?,?,?,?,?,?)").bind(tn.id, k, "h" + k, st, b, now - age).run();
  await row("old-done", 201, 9 * DAY, "{}"); await row("run-old", 0, 500, "tokX"); await row("stuck-old", -1, 3 * DAY, "tokY");
  t = Math.ceil(t / 3600000) * 3600000 + 60000; const out = await app.cron();    // ساعة كاملة + دقيقة (الدقيقة 1 ليست ربع ساعة)... نعيد الضبط لبداية الساعة
  t = Math.ceil((t - 60000) / 3600000) * 3600000; const out2 = await app.cron();
  const left = (await db.prepare("SELECT k,status FROM pf_idem WHERE k IN ('old-done','run-old','stuck-old')").all()).results; const m = Object.fromEntries(left.map((r) => [r.k, r.status]));
  ok("[FUNC] على D1: المكتمل القديم حُذف، قيد التنفيذ القديم وُسم -1 ولم يُحذف، العالق باقٍ", m["old-done"] === undefined && m["run-old"] === -1 && m["stuck-old"] === -1, { m, review: out2.idem_review, prune: out2.idem });
  const rev = await db.prepare("SELECT kind,slot FROM pf_idem_review").all(); ok("[FUNC] سُجِّلت دورة مراجعة وتقرير يومي على D1", rev.results.some((r) => r.kind === "cycle") && rev.results.some((r) => r.kind === "daily"), rev.results);
  const ev = (await db.prepare("SELECT COUNT(*) n FROM pf_events WHERE type='idempotency.stuck'").first()).n; ok("[FUNC] حدث idempotency.stuck صدر (تفرّد ext_id يعمل على D1)", ev >= 1, ev); }
await mf.dispose(); console.log(`\nالنتيجة: ${pass} ناجح، ${fail} فاشل`); process.exit(fail ? 1 : 0);
