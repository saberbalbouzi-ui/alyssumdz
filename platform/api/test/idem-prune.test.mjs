/* تنظيف pf_idem الدوري (المرحلة التالية، المهمة 2). ⚠ LOCAL ONLY: D1 محاكاة بـnode:sqlite؛ لا D1 حقيقي (BLOCKED) ولا أي قاعدة إنتاج.
   السياسة المُختبَرة: يُحذف **فقط** سطر مكتمل (status>0) أقدم من 7 أيام؛ لا يُمَسّ status=0 (قيد التنفيذ) ولا status=-1 (عالق: قد يكون أثره المالي وقع)؛
   الحذف ذرّي بجملة واحدة، محدود بدفعة (500) وبعدد جولات (4) لكل نبضة، ويجري مرة كل ساعة (الدقيقة 0)؛ تكراره آمن؛ لا يمسّ المطالبة الحية ولا مالكها. */
import { makeEnv, Tally } from "./_harness.mjs";
import { HttpError, ok as okRes } from "../src/core.js";
const { ok, done } = Tally(); let execs = 0;
const probe = { id: "probe", routes(r) { r.post("/v1/probe/op", { scope: "probe:write", idem: true, summary: "مسار اختبار" }, async (req) => { const b = req.json(); ++execs; if (b.fail) throw new HttpError(422, "probe_fail", "x"); return okRes({ n: execs, tag: b.tag }, 201); }); } };
const E = makeEnv([probe]); const { app, call, tenant, sql, sqlAll, db, clock } = E; const A = await tenant("A"), B = await tenant("B");
const DAY = 86400, nowS = () => Math.floor(clock.t / 1000);
const go = (T, k, body) => call("POST", "/v1/probe/op", body, T.key, {}, { "idempotency-key": k });
const ins = (T, k, st, ageS, body = "x") => db.prepare("INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) VALUES (?,?,?,?,?,?)").run(T.id, k, "h-" + k, st, body, nowS() - ageS);
const has = (T, k) => !!sql("SELECT 1 x FROM pf_idem WHERE tenant_id=? AND k=?", T.id, k);
const cnt = () => sql("SELECT COUNT(*) n FROM pf_idem").n;
const toHourStart = () => { clock.t = Math.ceil(clock.t / 3600000) * 3600000; };       // الدقيقة 0 من الساعة: موعد التنظيف
const toMidHour = () => { toHourStart(); clock.t += 17 * 60000; };

/* P1: لا حذف خارج موعد التنظيف (يحمي كلفة الاستعلام كل دقيقة) */
{ toMidHour(); ins(A, "p1-old", 201, 30 * DAY); const out = await app.cron(); ok("[P1] خارج الدقيقة 0: لا تنظيف ولا مسح للجدول", has(A, "p1-old") && !out.idem, { idem: out.idem }); }
/* P2: مكتمل أقدم من الاحتفاظ يُحذف؛ مكتمل حديث لا يُحذف */
{ toHourStart(); ins(A, "p2-old", 201, 8 * DAY); ins(A, "p2-recent", 201, 6 * DAY); ins(A, "p2-fresh", 201, 60);
  const out = await app.cron(); ok("[P2] مكتمل أقدم من 7 أيام ← يُحذف", !has(A, "p2-old"), { idem: out.idem });
  ok("[P2] مكتمل عمره 6 أيام وطازج ← يبقيان (الحدّ 7 أيام)", has(A, "p2-recent") && has(A, "p2-fresh"));
  ok("[P2] نتيجة cron تُبلِغ بعدد المحذوف", out.idem && out.idem.pruned >= 1, out.idem); }
/* P3: قيد التنفيذ (0) لا يُحذف مهما قَدُم */
{ toHourStart(); ins(A, "p3-run-old", 0, 30 * DAY, "owner-token-live"); ins(A, "p3-run-new", 0, 5, "owner-token-new"); await app.cron();
  ok("[P3] status=0 قديماً جداً أو حديثاً ← لا يُحذف أبداً (قد يكون المالك يعمل أو انهار بعد أثر مالي)", has(A, "p3-run-old") && has(A, "p3-run-new")); }
/* P4: العالق (-1) لا يُحذف تلقائياً */
{ toHourStart(); ins(B, "p4-stuck", -1, 40 * DAY, "tok"); await app.cron(); ok("[P4] status=-1 قديماً ← يبقى للمشغّل (لا حذف تلقائي لأثر محتمل)", has(B, "p4-stuck"));
  const [c, b] = await call("GET", "/admin/idempotency/stuck", null, "adm-tok", {}, { "x-actor": "owner@x.dz" }); ok("[P4] ويبقى ظاهراً في قائمة العالقة الإدارية", c === 200 && JSON.stringify(b).includes("p4-stuck"), { c }); }
/* P5: مطالبة حية يحجزها مالك الآن لا تتأثر، ومالكها يُنهيها بردّه رغم تنظيف متزامن */
{ toHourStart(); const k = "p5-live-" + Date.now(); const p = go(A, k, { tag: "LIVE" }); const [rc] = await Promise.all([p, app.cron()]); ok("[P5] طلب حي + تنظيف متزامن ← الطلب ينجح 201", rc[0] === 201, { rc: rc[0] });
  const [c2, b2, h2] = await go(A, k, { tag: "LIVE" }); ok("[P5] إعادة بعد الإنجاز ← الردّ المخزَّن (Replayed) رغم التنظيف", c2 === 201 && h2["Idempotent-Replayed"] === "true", { c2 }); }
/* P6: مالك قديم لا يستعيد مطالبة بعد التنظيف؛ التنظيف لا يمسّ مطالبات الإنجاز الحديثة (مشروط بـstatus>0 وat) */
{ toHourStart(); const k = "p6-" + Date.now(); const [c1] = await go(A, k, { tag: "ONCE" }); const e0 = execs; ok("[P6] تنفيذ أول 201", c1 === 201);
  await app.cron(); const [c2, , h2] = await go(A, k, { tag: "ONCE" }); ok("[P6] مفتاح حديث بعد تنظيف ← يُعاد ولا يُنفَّذ المعالج ثانية", c2 === 201 && h2["Idempotent-Replayed"] === "true" && execs === e0);
  /* بعد مرور الاحتفاظ: السطر يُحذف فيُعامل المفتاح كجديد (انتهاء صلاحية مقصود، أكبر بكثير من مهلة العميل 30 دقيقة) */
  clock.t += 8 * DAY * 1000; toHourStart(); await app.cron(); ok("[P6] بعد 8 أيام السطر المكتمل يُحذف", !has(A, k));
  const [c3] = await go(A, k, { tag: "ONCE" }); ok("[P6] المفتاح المنتهي يُعامل كطلب جديد بمطالبة جديدة (انتهاء الاحتفاظ لا اختراق ملكية)", c3 === 201 && execs === e0 + 1 && has(A, k)); }
/* P7: التكرار آمن (idempotent): تشغيلان متتاليان ومتوازيان */
{ toHourStart(); for (let i = 0; i < 30; i++) ins(A, "p7-" + i, 201, 20 * DAY); ins(A, "p7-keep", 201, 3600);
  const rs = await Promise.all([app.cron(), app.cron(), app.cron()]); const left = sqlAll("SELECT k FROM pf_idem WHERE k LIKE 'p7-%'").map((x) => x.k);
  ok("[P7] ثلاث نبضات متوازية ← كل القديم حُذف مرة واحدة والحديث باقٍ بلا أخطاء", left.length === 1 && left[0] === "p7-keep" && rs.every((r) => !r.idem?.error), { left: left.length, errs: rs.map((r) => r.idem?.error) });
  const out = await app.cron(); ok("[P7] تكرار بعدها ← pruned=0 بلا ضرر", (out.idem?.pruned ?? 0) === 0 && has(A, "p7-keep"), out.idem); }
/* P8: حدّ الدفعة: عدد ضخم لا يُحذف دفعة واحدة غير محدودة؛ يُستكمل عبر النبضات التالية */
{ toHourStart(); db.exec("BEGIN"); const st = db.prepare("INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) VALUES (?,?,?,?,?,?)"); for (let i = 0; i < 2600; i++) st.run(A.id, "p8-" + i, "h", 200, "x", nowS() - 30 * DAY - i); db.exec("COMMIT");
  const out1 = await app.cron(); const left1 = sql("SELECT COUNT(*) n FROM pf_idem WHERE k LIKE 'p8-%'").n;
  ok("[P8] أول نبضة تحذف حتى 2000 كحدّ أقصى (4 دفعات × 500) لا الكل", out1.idem?.pruned === 2000 && left1 === 600, { pruned: out1.idem?.pruned, left1 });
  toHourStart(); clock.t += 3600000; const out2 = await app.cron(); ok("[P8] النبضة التالية (الساعة التالية) تستكمل الباقي ويستقر الجدول", out2.idem?.pruned === 600 && sql("SELECT COUNT(*) n FROM pf_idem WHERE k LIKE 'p8-%'").n === 0, out2.idem); }
/* P9: عزل المستأجرين: التنظيف لا يغيّر شيئاً عبر المستأجرين إلا بالسياسة نفسها */
{ toHourStart(); ins(A, "p9-same", 201, 9 * DAY); ins(B, "p9-same", 201, 9 * DAY); ins(B, "p9-b-live", 0, 9 * DAY, "tok"); await app.cron();
  ok("[P9] المكتمل القديم يُحذف لدى المستأجرين كليهما والحي (0) لدى B يبقى", !has(A, "p9-same") && !has(B, "p9-same") && has(B, "p9-b-live")); }
/* P10: فهرس (status,at) موجود (قراءة الشاذ بلا مسح كامل)؛ فهرس (at) اختياري غير مفعّل افتراضياً */
{ const ix = sqlAll("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='pf_idem'").map((x) => x.name); ok("[P10] ix_pf_idem_st موجود وix_pf_idem_at غير مفعّل افتراضياً (تكلفة كتابة)", ix.includes("ix_pf_idem_st") && !ix.includes("ix_pf_idem_at"), ix); }
done();
