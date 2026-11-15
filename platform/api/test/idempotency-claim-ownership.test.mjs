/* رقعة التدقيق (12C-post): ملكية مطالبة Idempotency (claim token) وغياب الاستيلاء التلقائي وسياسة العالق. ⚠ LOCAL ONLY: D1 محاكاة بـnode:sqlite؛ لا D1 حقيقي (BLOCKED).
   وحدة اختبارية بمسار يمكن حجز معالجه ببوابات (gates) لمحاكاة مالك بطيء/منهار دون ساعات حقيقية.
   السياسة المُختبَرة: لا يُنفَّذ المعالج مرتين لمفتاح واحد أبداً بسبب المهلة؛ المطالبة الأقدم من 60ث = «عالقة» (409 idempotency_claim_stuck + حدث idempotency.stuck)؛
   المالك الأصلي إن أنهى لاحقاً يُحلّ السطر بردّه الحقيقي؛ كل UPDATE/DELETE مشروط برمز الملكية؛ الاسترداد إداري فقط (release بتأكيد صريح / resolve بردّ). */
import { makeEnv, Tally } from "./_harness.mjs";
import { HttpError, ok as okRes } from "../src/core.js";
const { ok, done } = Tally(); let execs = 0; const gates = new Map(); const gate = (n) => { let rel; const p = new Promise((r) => { rel = r; }); gates.set(n, { p, rel }); return gates.get(n); };
const probe = { id: "probe", routes(r) { r.post("/v1/probe/op", { scope: "probe:write", idem: true, summary: "مسار اختبار" }, async (req) => { const b = req.json(); const n = ++execs; if (b.gate) await gates.get(b.gate).p; if (b.fail) throw new HttpError(422, "probe_failed", "فشل مقصود"); return okRes({ ok: true, n, tag: b.tag ?? null }, 201); }); } };
const E = makeEnv([probe]); const { call, adm, tenant, sql, sqlAll, db, clock } = E; const A = await tenant("A"), B = await tenant("B");
const go = (T, k, body, extra = {}) => call("POST", "/v1/probe/op", body, T.key, {}, { "idempotency-key": k, ...extra });
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms)); const row = (T, k) => sql("SELECT status s, body b, hash h FROM pf_idem WHERE tenant_id=? AND k=?", T.id, k), evs = (t) => sqlAll("SELECT payload p FROM pf_events WHERE type=?", t).map((x) => JSON.parse(x.p));
const K = (n) => "claim-own-" + n + "-" + Date.now();
/* S1: مالك يعمل + 10 متزامنة: معالج واحد فقط */
{ const k = K(1), g = gate("g1"), e0 = execs; const pA = go(A, k, { gate: "g1", tag: "A" }); await wait(); const rs = await Promise.all(Array.from({ length: 10 }, () => go(A, k, { gate: "g1", tag: "A" })));
  ok("[S1] مالك قيد التنفيذ + 10 متزامنة بالمحتوى نفسه ← 409 idempotency_in_progress (+Retry-After) ولا تنفيذ إضافي", rs.every((r) => r[0] === 409 && r[1].error?.code === "idempotency_in_progress" && !!r[2]["Retry-After"]) && execs === e0 + 1, { execs: execs - e0, codes: rs.map((r) => r[0]) });
  g.rel(); const [c, b] = await pA; ok("[S1] المالك يُنهي 201 والسطر يُغلق بردّه", c === 201 && row(A, k).s === 201, { c }); const [c2, b2, h2] = await go(A, k, { gate: "g1", tag: "A" }); ok("[S1] إعادة بعد الإنجاز ← الردّ نفسه (Replayed) بلا تنفيذ", c2 === 201 && b2.n === b.n && h2["Idempotent-Replayed"] === "true" && execs === e0 + 1); }
/* S2: مالك بطيء تجاوز المهلة: لا استيلاء؛ يُوسَم عالقاً؛ ثم يُنهي المالك الأصلي فيُحلّ */
{ const k = K(2), g = gate("g2"), e0 = execs; const pA = go(A, k, { gate: "g2", tag: "SLOW" }); await wait(); clock.t += 61000;
  const [c1, b1, h1] = await go(A, k, { gate: "g2", tag: "SLOW" }); ok("[S2] مطالبة أقدم من 60ث: لا استيلاء ← 409 idempotency_claim_stuck ولا تنفيذ ثانٍ", c1 === 409 && b1.error?.code === "idempotency_claim_stuck" && execs === e0 + 1 && row(A, k).s === -1, { c1, execs: execs - e0, st: row(A, k).s });
  const [c2] = await go(A, k, { gate: "g2", tag: "SLOW" }); ok("[S2] طلب ثانٍ ← عالق أيضاً بلا تنفيذ، وحدث idempotency.stuck صدر مرة واحدة فقط", c2 === 409 && execs === e0 + 1 && evs("idempotency.stuck").filter((x) => x.key === k).length === 1);
  g.rel(); const [cA, bA] = await pA; ok("[S2] المالك الأصلي يُنهي فعلاً (201) فيُحلّ السطر العالق بردّه الحقيقي بلا إعادة تنفيذ", cA === 201 && row(A, k).s === 201 && execs === e0 + 1, { cA, st: row(A, k).s });
  const [c3, b3, h3] = await go(A, k, { gate: "g2", tag: "SLOW" }); ok("[S2] إعادة لاحقة ← الردّ الحقيقي للمالك الأول (Replayed)", c3 === 201 && b3.n === bA.n && h3["Idempotent-Replayed"] === "true"); }
/* S3: مالك منهار حقاً: يبقى عالقاً؛ الاسترداد إداري فقط */
{ const k = K(3), body = { tag: "CRASH" }, raw = JSON.stringify(body), { createHash } = await import("node:crypto"), h = createHash("sha256").update("POST" + "/v1/probe/op" + raw).digest("hex"), e0 = execs;
  db.prepare("INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) VALUES (?,?,?,0,'dead-owner-token',?)").run(A.id, k, h, Math.floor(clock.t / 1000) - 3600);
  const [c1, b1] = await go(A, k, raw); ok("[S3] مالك منهار (سطر قديم): 409 claim_stuck بلا تنفيذ — لا إعادة تنفيذ تلقائية", c1 === 409 && b1.error?.code === "idempotency_claim_stuck" && execs === e0, { c1 });
  const rs = await Promise.all(Array.from({ length: 10 }, () => go(A, k, raw))); ok("[S3] 10 متزامنة على عالقة: كلها 409 stuck ولا تنفيذ (لا توقف بل رفض صريح قابل للتتبّع)", rs.every((r) => r[0] === 409 && r[1].error?.code === "idempotency_claim_stuck") && execs === e0);
  const [l, lb] = await call("GET", "/admin/idempotency/stuck", null, "adm-tok", { tenant_id: String(A.id) }, { "x-actor": "owner@x.dz" }); ok("[S3] قائمة العالقة الإدارية تُظهرها (state=stuck)", l === 200 && lb.stuck.some((x) => x.key === k && x.state === "stuck"), lb);
  const [r0] = await adm("POST", "/admin/idempotency/release", { tenant_id: A.id, key: k }); ok("[S3] التحرير بلا confirm ← 400 (قرار مشغّل صريح)", r0 === 400);
  const [r1] = await adm("POST", "/admin/idempotency/release", { tenant_id: A.id, key: k, confirm: "no-side-effect" }); ok("[S3] التحرير بـconfirm ← 200 ويُسجَّل في التدقيق", r1 === 200 && sqlAll("SELECT action FROM pf_audit WHERE action='idempotency.release'").length >= 1);
  const [c2, b2] = await go(A, k, raw); ok("[S3] بعد التحرير: ينفَّذ المعالج مرة واحدة (201)", c2 === 201 && execs === e0 + 1, { c2 });
  const k2 = K("3b"), raw2 = JSON.stringify({ tag: "DONE-BUT-DEAD" }), h2 = createHash("sha256").update("POST" + "/v1/probe/op" + raw2).digest("hex"); db.prepare("INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) VALUES (?,?,?,-1,'dead',?)").run(A.id, k2, h2, Math.floor(clock.t / 1000) - 3600);
  const [s1] = await adm("POST", "/admin/idempotency/resolve", { tenant_id: A.id, key: k2, status: 201, body: { ok: true, n: 777, tag: "DONE-BUT-DEAD" } }); const [c3, b3, hh3] = await go(A, k2, raw2);
  ok("[S3] الحسم بردّ (حدث الأثر فعلاً): الطلب التالي يُعاد له ذلك الردّ (Replayed) بلا تنفيذ", s1 === 200 && c3 === 201 && b3.n === 777 && hh3["Idempotent-Replayed"] === "true" && execs === e0 + 1); }
/* S4: مالك قديم لا يؤثر في مطالبة المالك الجديد (نجاح وفشل) */
{ const k = K(4), gA = gate("g4a"), gB = gate("g4b"), e0 = execs; const pA = go(A, k, { gate: "g4a", tag: "OLD" }); await wait();
  const [rl] = await adm("POST", "/admin/idempotency/release", { tenant_id: A.id, key: k, confirm: "no-side-effect" }); const pB = go(A, k, { gate: "g4b", tag: "NEW" }); await wait(); const mid = row(A, k);
  ok("[S4] بعد التحرير الإداري: مالك جديد يحجز المطالبة (ينفَّذ المعالج مرتين عمداً بقرار المشغّل)", rl === 200 && mid.s === 0 && execs === e0 + 2, { rl, execs: execs - e0 });
  gA.rel(); const [cA] = await pA; await wait(); const after = row(A, k);
  ok("[S4] المالك القديم يعود وينتهي (201) لكنه لا يكتب ولا يغيّر مطالبة المالك الجديد (نفس الحالة ورمز الملكية)", cA === 201 && after.s === 0 && after.b === mid.b, { cA, mid, after });
  gB.rel(); const [cB, bB] = await pB; const fin = row(A, k); ok("[S4] المالك الجديد يُغلق مطالبته بردّه هو", cB === 201 && fin.s === 201 && JSON.parse(fin.b).tag === "NEW" && JSON.parse(fin.b).n === bB.n, { fin: fin.s }); }
{ const k = K("4f"), gA = gate("g4fa"), gB = gate("g4fb"); const pA = go(A, k, { gate: "g4fa", fail: true }); await wait(); await adm("POST", "/admin/idempotency/release", { tenant_id: A.id, key: k, confirm: "no-side-effect" }); const pB = go(A, k, { gate: "g4fb", tag: "NEW2" }); await wait(); const mid = row(A, k);
  gA.rel(); const [cA, bA] = await pA; await wait(); const after = row(A, k); ok("[S4] المالك القديم يفشل (422) ويحاول التحرير: لا يحذف مطالبة المالك الجديد", cA === 422 && !!after && after.s === 0 && after.b === mid.b, { cA, after });
  gB.rel(); const [cB] = await pB; ok("[S4] المالك الجديد يُنهي سليماً", cB === 201 && row(A, k).s === 201); }
/* S5: عزل المستأجرين في العالق والإدارة */
{ const k = K(5), raw = JSON.stringify({ tag: "ISO" }), { createHash } = await import("node:crypto"), h = createHash("sha256").update("POST" + "/v1/probe/op" + raw).digest("hex");
  db.prepare("INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) VALUES (?,?,?,-1,'x',?)").run(A.id, k, h, Math.floor(clock.t / 1000) - 3600); const e0 = execs;
  const [cb] = await go(B, k, raw); ok("[S5] مفتاح عالق عند A لا يؤثر في B (ينفَّذ 201 عند B)", cb === 201 && execs === e0 + 1);
  await adm("POST", "/admin/idempotency/release", { tenant_id: B.id, key: k, confirm: "no-side-effect" }); ok("[S5] تحرير مفتاح B لا يمسّ سطر A العالق", row(A, k)?.s === -1);
  const [rc] = await adm("POST", "/admin/idempotency/release", { tenant_id: A.id, key: "no-such-key", confirm: "no-side-effect" }); ok("[S5] تحرير مفتاح غير موجود ← 404", rc === 404); }
/* S6: الإدارة محمية */
{ const [c1] = await call("GET", "/admin/idempotency/stuck", null, A.key); const [c2] = await call("POST", "/admin/idempotency/release", { tenant_id: A.id, key: "x", confirm: "no-side-effect" }, A.key); const [c3] = await call("GET", "/admin/idempotency/stuck", null, null);
  ok("[S6] مسارات الاسترداد بمفتاح مستأجر/بلا مصادقة مرفوضة (401/403)", [c1, c2, c3].every((c) => c === 401 || c === 403), [c1, c2, c3]); }
/* S7: توافق: بلا مفتاح لا مطالبات */
{ const n0 = sql("SELECT COUNT(*) n FROM pf_idem").n; const [c] = await call("POST", "/v1/probe/op", { tag: "nokey" }, A.key); ok("[S7] بلا Idempotency-Key: يعمل كالسابق ولا يُنشأ سطر مطالبة", c === 201 && sql("SELECT COUNT(*) n FROM pf_idem").n === n0); }
done();
