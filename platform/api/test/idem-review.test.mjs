/* مراجعة pf_idem الآلية كل 15 دقيقة + التقرير اليومي + التنبيهات (القرار 2). ⚠ LOCAL ONLY: D1 محاكاة بـnode:sqlite؛ ليس D1 حقيقياً (انظر platform/api/test/d1/ لمحرك D1 المحلي).
   السياسة المُختبَرة: المراجعة **لا تحذف** أي مطالبة (0 / -1 / مكتملة)؛ تُوسَم المتجاوزة 0→-1 شرطياً برمز الملكية وat المرصود (فلا تمسّ مطالبة أنهاها مالكها أو أُعيد ادّعاؤها)؛
   كل دورة شريحة ذرّية واحدة ولو تزامنت cron؛ نتيجة كل دورة تُسجَّل؛ تقرير يومي مرة واحدة؛ تنبيهات بعتبات (تحذير/حرج) بتفرّد يومي؛ مسارات إدارية للقراءة فقط. */
import { makeEnv, Tally } from "./_harness.mjs";
import { HttpError, ok as okRes } from "../src/core.js";
const { ok, done } = Tally(); let execs = 0; const gates = new Map(); const gate = (n) => { let rel; const p = new Promise((r) => { rel = r; }); gates.set(n, { p, rel }); return gates.get(n); };
const probe = { id: "probe", routes(r) { r.post("/v1/probe/op", { scope: "probe:write", idem: true, summary: "مسار اختبار" }, async (req) => { const b = req.json(); const n = ++execs; if (b.gate) await gates.get(b.gate).p; if (b.fail) throw new HttpError(422, "probe_failed", "x"); return okRes({ ok: true, n, tag: b.tag ?? null }, 201); }); } };
const E = makeEnv([probe]); const { app, call, adm, tenant, sql, sqlAll, db, clock } = E; const A = await tenant("A"), B = await tenant("B");
const nowS = () => Math.floor(clock.t / 1000), Q = 900000;
const toQuarter = (add = 0) => { clock.t = Math.ceil(clock.t / Q) * Q + add * Q; };                       // أول لحظة من شريحة 15 دقيقة (والإزاحة بعدد الشرائح)
const ins = (T, k, st, ageS, body = "tok-" + k) => db.prepare("INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) VALUES (?,?,?,?,?,?)").run(T.id, k, "h-" + k, st, body, nowS() - ageS);
const row = (T, k) => sql("SELECT status s, body b, at FROM pf_idem WHERE tenant_id=? AND k=?", T.id, k);
const evs = (t) => sqlAll("SELECT tenant_id t, payload p, ext_id x FROM pf_events WHERE type=?", t);
const lastCycle = () => { const r = sql("SELECT data FROM pf_idem_review WHERE kind='cycle' ORDER BY at DESC, rowid DESC LIMIT 1"); return r ? JSON.parse(r.data) : null; };
const cyc = () => sql("SELECT COUNT(*) n FROM pf_idem_review WHERE kind='cycle'").n, dly = () => sql("SELECT COUNT(*) n FROM pf_idem_review WHERE kind='daily'").n;
const total = () => sql("SELECT COUNT(*) n FROM pf_idem").n;
const wipe = () => db.exec("DELETE FROM pf_idem; DELETE FROM pf_events WHERE type LIKE 'idempotency.%'; DELETE FROM pf_audit WHERE action='idem.alert'");

/* R1: خارج مواعيد الدورة لا شيء يُكتب */
{ toQuarter(); clock.t += 7 * 60000; const c0 = cyc(), out = await app.cron(); ok("[R1] الدقيقة 7 (ليست 0/15/30/45): لا دورة ولا سجل", !out.idem_review && cyc() === c0, out.idem_review); }
/* R2: دورة عند ربع الساعة تسجّل عدّاً دقيقاً */
{ wipe(); toQuarter(1); ins(A, "r2-fresh", 0, 5); ins(A, "r2-over", 0, 300, "own-r2"); ins(B, "r2-stuck", -1, 7200, "own-s"); ins(A, "r2-done", 201, 86400 * 2, "{}");
  const c0 = cyc(), out = await app.cron(), c = lastCycle(); ok("[R2] دورة واحدة سُجِّلت بشريحتها", cyc() === c0 + 1 && !!out.idem_review?.slot, out.idem_review);
  ok("[R2] العدّ: قيد تنفيذ حديث=1، متجاوز=1 (وُسم)، عالق=2 بعد الوسم، مكتمل لا يُعدّ", c.fresh === 1 && c.overdue === 1 && c.promoted === 1 && c.stuck === 2, c); }
/* R3: لا حذف إطلاقاً — حتى لأقدم المكتمل (الحذف من اختصاص pruneIdem فقط) */
{ wipe(); toQuarter(1); ins(A, "r3-a", 0, 40 * 86400, "tok"); ins(A, "r3-b", -1, 40 * 86400); ins(A, "r3-c", 201, 40 * 86400, "{}"); ins(B, "r3-d", 0, 3), ins(B, "r3-e", 200, 1);
  const n0 = total(); await app.cron(); ok("[R3] عدد الصفوف قبل/بعد المراجعة متساوٍ (0 حذف) رغم قِدم 40 يوماً", total() === n0, { n0, n: total() });
  ok("[R3] المطالبة قيد التنفيذ القديمة وُسمت عالقة فقط (لم تُحذف)، والحديثة (3ث) لم تُمسّ، والمكتمل لم يُمسّ", row(A, "r3-a").s === -1 && row(B, "r3-d").s === 0 && row(A, "r3-c").s === 201 && row(B, "r3-e").s === 200); }
/* R4: الوسم يحفظ رمز الملكية ويصدر حدثاً واحداً (تفرّد) ولا يتكرر في الدورات التالية */
{ wipe(); toQuarter(1); ins(A, "r4", 0, 400, "owner-token-r4"); await app.cron(); const r1 = row(A, "r4"); const e1 = evs("idempotency.stuck").filter((e) => e.x === "idem:stuck:" + A.id + ":r4").length;
  ok("[R4] 0→-1 مع بقاء رمز الملكية في body كما هو", r1.s === -1 && r1.b === "owner-token-r4", r1); ok("[R4] حدث idempotency.stuck صدر مرة واحدة", e1 === 1, e1);
  toQuarter(1); await app.cron(); const e2 = evs("idempotency.stuck").filter((e) => e.x === "idem:stuck:" + A.id + ":r4").length; ok("[R4] دورة تالية: لا حدث مكرر ولا تغيير", e2 === 1 && row(A, "r4").s === -1); }
/* R5: مالك بطيء حقيقي: تُوسَم عالقة ثم يُنهي المالك فيُغلق السطر بردّه الحقيقي ولا إعادة تنفيذ */
{ wipe(); const k = "r5-" + Date.now(), g = gate("r5"), e0 = execs; const pA = call("POST", "/v1/probe/op", { gate: "r5", tag: "SLOW" }, A.key, {}, { "idempotency-key": k });
  await new Promise((r) => setTimeout(r, 40)); toQuarter(1); await app.cron(); const mid = row(A, k); ok("[R5] مالك لم ينتهِ بعد 15 دقيقة ← وُسم عالقاً (بلا حذف ولا إعادة تنفيذ)", mid && mid.s === -1 && execs === e0 + 1, mid);
  g.rel(); const [c] = await pA; const fin = row(A, k); ok("[R5] المالك يُنهي لاحقاً: السطر يُغلق بردّه (201) ورمزه صحيح", c === 201 && fin.s === 201 && execs === e0 + 1, { c, fin });
  const [c2, , h2] = await call("POST", "/v1/probe/op", { gate: "r5", tag: "SLOW" }, A.key, {}, { "idempotency-key": k }); ok("[R5] إعادة لاحقة ← الردّ المخزَّن (Replayed) بلا تنفيذ جديد", c2 === 201 && h2["Idempotent-Replayed"] === "true" && execs === e0 + 1); }
/* R6: سباق: المالك يُنهي بين رصد المراجعة ووسمها ← لا يُقلب المكتمل إلى عالق (الشرط status=0 AND body=token AND at) */
{ wipe(); toQuarter(1); ins(A, "r6", 0, 500, "tok-r6"); let fired = false; const orig = app.db.all.bind(app.db);
  app.db.all = async (q, ...a) => { const r = await orig(q, ...a); if (!fired && /FROM pf_idem WHERE status=0 AND at<=\? ORDER BY at LIMIT/.test(q)) { fired = true; db.prepare("UPDATE pf_idem SET status=201, body='{\"done\":1}', at=? WHERE tenant_id=? AND k='r6' AND status IN (0,-1) AND body='tok-r6'").run(nowS(), A.id); } return r; };
  const out = await app.cron(); app.db.all = orig; ok("[R6] المالك أنهى بعد الرصد ← المراجعة لم تُقلب المكتمل (status يبقى 201) ولم تُحصَ كمُوسومة", fired && row(A, "r6").s === 201 && lastCycle().promoted === 0, { fired, s: row(A, "r6").s, c: lastCycle() }); }
/* R7: رمز ملكية مختلف (أُعيد الادّعاء) لا يُمسّ */
{ wipe(); toQuarter(1); ins(A, "r7", 0, 500, "old-token"); let fired = false; const orig = app.db.all.bind(app.db);
  app.db.all = async (q, ...a) => { const r = await orig(q, ...a); if (!fired && /FROM pf_idem WHERE status=0 AND at<=\? ORDER BY at LIMIT/.test(q)) { fired = true; db.prepare("UPDATE pf_idem SET body='new-owner-token', at=? WHERE tenant_id=? AND k='r7'").run(nowS(), A.id); } return r; };
  await app.cron(); app.db.all = orig; ok("[R7] مطالبة أُعيد ادّعاؤها برمز مالك جديد بعد الرصد ← لا تُوسَم (تبقى 0 ورمزها الجديد)", fired && row(A, "r7").s === 0 && row(A, "r7").b === "new-owner-token", row(A, "r7")); }
/* R8: عمل محدود: 500 متجاوزة ← 200 فقط في الدورة، والباقي في التالية */
{ wipe(); toQuarter(1); db.exec("BEGIN"); const st = db.prepare("INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) VALUES (?,?,?,0,?,?)"); for (let i = 0; i < 500; i++) st.run(A.id, "r8-" + i, "h", "tk" + i, nowS() - 600 - i); db.exec("COMMIT");
  await app.cron(); const n1 = sql("SELECT COUNT(*) n FROM pf_idem WHERE status=-1").n; ok("[R8] الدورة الأولى توسم 200 كحدّ أقصى (لا عمل غير محدود)", n1 === 200, n1);
  toQuarter(1); await app.cron(); toQuarter(1); await app.cron(); ok("[R8] الدورات التالية تستكمل الباقي (500) وكل الصفوف باقية", sql("SELECT COUNT(*) n FROM pf_idem WHERE status=-1").n === 500 && total() === 500); }
/* R9: تزامن: ثلاث cron متوازية ← دورة واحدة فقط لكل شريحة وتقرير يومي واحد */
{ wipe(); db.exec("DELETE FROM pf_idem_review"); clock.t = Date.parse("2026-10-20T00:15:00Z"); ins(A, "r9-s", -1, 100); const rs = await Promise.all([app.cron(), app.cron(), app.cron()]);
  ok("[R9] ثلاث نبضات متوازية ← سطر دورة واحد لهذه الشريحة", sql("SELECT COUNT(*) n FROM pf_idem_review WHERE kind='cycle' AND slot=?", "c:" + Math.floor(nowS() / 900)).n === 1 && rs.filter((r) => r.idem_review?.skipped === "slot_taken").length === 2, rs.map((r) => r.idem_review?.skipped ?? "ran"));
  ok("[R9] وتقرير يومي واحد (d:2026-10-20) فقط", dly() === 1 && !!sql("SELECT 1 x FROM pf_idem_review WHERE slot='d:2026-10-20'")); }
/* R10: تنبيهات: عتبات تحذير ثم حرج بتفرّد يومي + تدقيق + مخرجات cron */
{ wipe(); db.exec("DELETE FROM pf_idem_review"); clock.t = Date.parse("2026-10-21T10:00:00Z"); for (let i = 0; i < 5; i++) ins(A, "r10-" + i, -1, 100);
  const o1 = await app.cron(); const a1 = evs("idempotency.alert"); ok("[R10] 5 عالقة ← تنبيه stuck:warn (حدث tenant 0 + تدقيق + في مخرجات cron)", a1.length === 1 && a1[0].t === 0 && JSON.parse(a1[0].p).code === "stuck" && JSON.parse(a1[0].p).level === "warn" && o1.idem_review.alerts.includes("stuck:warn") && sql("SELECT COUNT(*) n FROM pf_audit WHERE action='idem.alert'").n === 1, { a1: a1.length, al: o1.idem_review?.alerts });
  toQuarter(1); await app.cron(); ok("[R10] دورة تالية بالحالة نفسها ← لا تنبيه مكرر (تفرّد يومي)", evs("idempotency.alert").length === 1);
  for (let i = 5; i < 20; i++) ins(A, "r10-" + i, -1, 100); toQuarter(1); const o3 = await app.cron(); ok("[R10] 20 عالقة ← تصعيد إلى stuck:crit بتنبيه جديد", o3.idem_review.alerts.includes("stuck:crit") && evs("idempotency.alert").filter((e) => JSON.parse(e.p).level === "crit").length === 1, o3.idem_review?.alerts);
  clock.t += 86400000; toQuarter(0); await app.cron(); ok("[R10] يوم جديد ← يُعاد التنبيه (مفتاح التفرّد يتضمن اليوم)", evs("idempotency.alert").filter((e) => /2026-10-22/.test(e.x)).length >= 1); }
/* R11: شواذ: عمر العالق وبلا رمز في الدورة؛ والمستقبلي في التقرير اليومي (مسح كامل مرة يومياً) */
{ wipe(); db.exec("DELETE FROM pf_idem_review; DELETE FROM pf_events"); clock.t = Date.parse("2026-10-23T00:00:00Z"); ins(A, "r11-old", -1, 80 * 3600); ins(A, "r11-fut", 201, -3600); ins(A, "r11-nt", 0, 5, "");
  const o = await app.cron(), c = lastCycle(), codes = c.alerts.map((a) => a.code + ":" + a.level); ok("[R11] عالق عمره 80 ساعة ← stuck_age_h:crit؛ بلا رمز ← token_missing:warn (في الدورة)", codes.includes("stuck_age_h:crit") && codes.includes("token_missing:warn") && !("future" in c), codes);
  const rep = JSON.parse(sql("SELECT data FROM pf_idem_review WHERE kind='daily' ORDER BY at DESC LIMIT 1").data); ok("[R11] المستقبلي يظهر في لقطة التقرير اليومي مع تنبيه future:warn (لا مسح كامل كل 15 دقيقة)", rep.snapshot.future === 1 && rep.alerts_snapshot.some((a) => a.code === "future" && a.level === "warn"), rep.snapshot); }
/* R12: سجل الدورات: كل دورة (حتى الفاشلة) تُسجَّل؛ وخطأ لا يوقف cron */
{ wipe(); db.exec("DELETE FROM pf_idem_review"); toQuarter(1); const orig = app.db.val.bind(app.db); app.db.val = async (q, ...a) => { if (/status=0 AND body=''/.test(q)) throw new Error("boom-d1"); return orig(q, ...a); };
  const out = await app.cron(); app.db.val = orig; const c = lastCycle(); ok("[R12] خطأ أثناء الفحص ← يُسجَّل في سطر الدورة ولا يُسقط cron", !!c?.error && /boom-d1/.test(c.error) && out.idem_review?.error != null && typeof out.ms === "number", c); }
/* R13: احتفاظ سجل الدورات 30 يوماً (محدود) */
{ db.exec("DELETE FROM pf_idem_review"); clock.t = Date.parse("2026-11-20T09:00:00Z"); for (let i = 0; i < 5; i++) db.prepare("INSERT INTO pf_idem_review (slot,kind,at,data) VALUES (?,?,?,?)").run("c:old" + i, "cycle", nowS() - 31 * 86400 - i, "{}"); db.prepare("INSERT INTO pf_idem_review (slot,kind,at,data) VALUES (?,?,?,?)").run("c:keep", "cycle", nowS() - 29 * 86400, "{}");
  await app.cron(); ok("[R13] أقدم من 30 يوماً يُحذف، وعمره 29 يوماً يبقى", sql("SELECT COUNT(*) n FROM pf_idem_review WHERE slot LIKE 'c:old%'").n === 0 && !!sql("SELECT 1 x FROM pf_idem_review WHERE slot='c:keep'")); }
/* R14: التقرير اليومي: تجميع اليوم السابق + لقطة استثنائية بلا كشف كامل للمفتاح */
{ wipe(); db.exec("DELETE FROM pf_idem_review; DELETE FROM pf_events"); const d0 = Date.parse("2026-10-25T00:00:00Z"); for (let i = 0; i < 4; i++) db.prepare("INSERT INTO pf_idem_review (slot,kind,at,data) VALUES (?,?,?,?)").run("c:p" + i, "cycle", d0 / 1000 - 3600 * (i + 1), JSON.stringify({ stuck: i + 1, overdue: i, promoted: 1, alerts: i === 3 ? [{ code: "stuck", level: "warn" }] : [] }));
  clock.t = d0 - 600000; ins(A, "r14-long-key-abcdefghijklmnop", -1, 7200); clock.t = d0 + 15 * 60000; await app.cron(); const rep = JSON.parse(sql("SELECT data FROM pf_idem_review WHERE slot='d:2026-10-25'").data);
  ok("[R14] تقرير 24 أكتوبر: 4 دورات، أقصى عالق 4، مجموع الوسم 4، تنبيه stuck:warn مرة", rep.for_day === "2026-10-24" && rep.cycles === 4 && rep.max_stuck === 4 && rep.promoted_total === 4 && rep.alerts["stuck:warn"] === 1, rep);
  ok("[R14] اللقطة: الحالات الاستثنائية بمفتاح مقتطع (12 حرفاً…) وبعمر، وعدد الصفوف الكلي", rep.snapshot.exceptional.length === 1 && rep.snapshot.exceptional[0].key === "r14-long-key…" && rep.snapshot.exceptional[0].age_s > 7000 && rep.snapshot.exceptional[0].state === "stuck" && rep.snapshot.total_rows === 1, rep.snapshot);
  clock.t += 15 * 60000; const o2 = await app.cron(); ok("[R14] دورة لاحقة في اليوم نفسه ← لا تقرير ثانٍ", dly() === 1 && o2.idem_review?.daily?.skipped === "already_today"); }
/* R15: مسارات الإدارة (قراءة فقط) وحمايتها */
{ const [c0] = await call("GET", "/admin/idempotency/review"); ok("[R15] بلا مصادقة ← مرفوض", c0 === 401 || c0 === 403, c0);
  const A_ = (p, q) => call("GET", p, null, "adm-tok", q, { "x-actor": "owner@x.dz" }); const [c1, b1] = await A_("/admin/idempotency/review", { limit: "5" }); ok("[R15] GET review ← آخر الدورات وقائمة التنبيهات النشطة", c1 === 200 && Array.isArray(b1.cycles) && b1.cycles.length >= 1 && Array.isArray(b1.active_alerts), { c1, n: b1.cycles?.length });
  const [c2, b2] = await A_("/admin/idempotency/report", {}); ok("[R15] GET report ← أحدث تقرير يومي", c2 === 200 && b2.slot?.startsWith("d:") && b2.snapshot, { c2, slot: b2.slot });
  const [c3] = await A_("/admin/idempotency/report", { day: "1999-01-01" }); const [c4] = await A_("/admin/idempotency/report", { day: "bad" }); ok("[R15] يوم بلا تقرير ← 404؛ صيغة خاطئة ← 400", c3 === 404 && c4 === 400, { c3, c4 }); }
/* R16: pruneIdem (الحذف الوحيد) ما زال لا يمسّ 0/-1 بعد إضافة المراجعة */
{ wipe(); db.exec("DELETE FROM pf_idem_review"); clock.t = Date.parse("2026-12-01T00:00:00Z"); ins(A, "r16-run", 0, 30 * 86400, "t1"); ins(A, "r16-stuck", -1, 30 * 86400, "t2"); ins(A, "r16-old", 201, 30 * 86400, "{}"); await app.cron();
  ok("[R16] دورة مراجعة + تنظيف معاً: المكتمل القديم فقط حُذف؛ قيد التنفيذ وُسم عالقاً ولم يُحذف؛ العالق باقٍ", !row(A, "r16-old") && row(A, "r16-run").s === -1 && row(A, "r16-stuck").s === -1, { run: row(A, "r16-run"), st: row(A, "r16-stuck"), old: row(A, "r16-old") }); }
/* R17: المخطط: الفهرسان والجدول موجودة */
{ const ix = sqlAll("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name IN ('pf_idem','pf_idem_review')").map((x) => x.name); ok("[R17] ix_pf_idem_st وix_pf_idem_review_at موجودان وix_pf_idem_at غير مفعّل", ["ix_pf_idem_st", "ix_pf_idem_review_at"].every((n) => ix.includes(n)) && !ix.includes("ix_pf_idem_at"), ix); }
done();
