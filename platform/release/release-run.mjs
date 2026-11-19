/* منسّق نشر Beta: يشغّل الخطوات بترتيب آمن عبر «محوّل سحابة» (adapter) قابل للاستبدال (محاكي للاختبار | Cloudflare للحقيقي).
   الضمانات: (1) لا أثر جانبي قبل اجتياز فحص التوافق والترحيلات؛ (2) لقطة بيانات + نسخة صفوف احتياطية قبل أي ترحيل؛ (3) الواجهة/القوالب تُنشَر آخراً بتبديل مؤشر ذرّي؛
   (4) أي فشل ⇒ رجوع تلقائي **للكود فقط** (بالترتيب العكسي)؛ (5) **لا استعادة تلقائية لقاعدة البيانات أبداً**: Beta حيّ والبيانات الجديدة تصل أثناء النشر، واستعادة علامة زمنية تمحوها.
   فقدان بيانات مؤكَّد ⇒ تنبيه + «استعادة جراحية» يدوية (recoverMissing) تعيد الصفوف المفقودة وحدها بلا مساس بالجديدة؛ Supabase استعادته يدوية بتنبيه؛ (6) نشر الإصدار نفسه مرتين = noop مع تحقق. */
import { planOrder, classifyMigration, compareSnapshots, recoveryPlan, COMPONENTS, stateViolations } from "./release-lib.mjs";

const FIRST_ORDER = ["api", "gateway", "ui", "templates"];
/** هل الحالة الحيّة تطابق سجل إصدار؟ (كل مكوّن يُقارَن بالإصدار الذي نشره فعلاً، لا بإصدار الـcommit الحالي) */
export function liveMatches(h, rec) { const di = rec.deployed_in ?? {}, hd = rec.handles ?? {}; return h.api?.sha === di.api && h.gateway?.sha === di.gateway && h.ui?.release === (hd.ui?.release ?? null) && h.templates?.release === (hd.templates?.release ?? null); }

/** انتظار ظهور النسخة المنشورة في فحص الصحة: على Cloudflare الحقيقي قد تتأخر النسخة الجديدة بضع ثوانٍ بعد الرفع (أول نشر حقيقي قرأ /health بعد ثانيتين فرأى النسخة القديمة ففشل ورجع تلقائياً).
    يعيد قراءة الصحة حتى يتحقق الشرط أو ينتهي الأجل؛ الأجل صفر ⇒ قراءة واحدة (سلوك الاختبارات والمحاكي). لا يُخفي فشلاً حقيقياً: عند انتهاء الأجل يُرجَع آخر قراءة فيفشل الفحص كالسابق. */
export async function awaitHealth(adapter, ok, { timeoutMs = 0, intervalMs = 5000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const t0 = Date.now(); let h = await adapter.health();
  while (!ok(h) && Date.now() - t0 < timeoutMs) { await sleep(intervalMs); h = await adapter.health(); }
  return h;
}
export async function runRelease({ adapter, manifest, migrations = [], artifacts = {}, snapshotTables = [], allowBreaking = false, log = () => { }, healthWaitMs = 0, healthIntervalMs = 5000, sleep }) {
  const hw = { timeoutMs: healthWaitMs, intervalMs: healthIntervalMs, ...(sleep ? { sleep } : {}) };
  const R = { ok: false, status: "failed", steps: [], rolledBack: [], migrationsApplied: [], handles: {}, warnings: [], bookmark: null, recovery: null };
  const step = (name, ok, detail) => { R.steps.push({ name, ok, ...(detail ? { detail } : {}) }); log((ok ? "✓ " : "✗ ") + name + (detail ? " — " + detail : "")); return ok; };
  const fail = (name, detail, status = "failed") => { step(name, false, detail); R.status = status; return R; };
  const deployed = await adapter.getDeployed();

  /* 0) تكرار الإصدار نفسه: تحقق فقط */
  if (deployed?.id === manifest.id) { const h = await adapter.health(); const okh = liveMatches(h, deployed); step("الإصدار منشور بالفعل — تحقق صحة فقط", okh, okh ? "" : JSON.stringify(h)); R.ok = okh; R.status = okh ? "noop" : "failed"; return R; }

  /* 1) توافق المكوّنات وترتيب النشر (بلا أثر جانبي) */
  const cand = Object.fromEntries(COMPONENTS.map((k) => [k, manifest.components[k]]));
  let order;
  if (!deployed) { const v = stateViolations(cand); if (v.length) return fail("فحص العقود", v.join("؛ ")); order = FIRST_ORDER; step("فحص العقود (أول إصدار)", true, "الترتيب: " + order.join(" → ")); }
  else {
    const dep = Object.fromEntries(COMPONENTS.map((k) => [k, deployed.components[k]])), changed = COMPONENTS.filter((k) => deployed.components[k].hash !== manifest.components[k].hash);
    const p = planOrder(dep, cand, changed); if (!p.ok) return fail("فحص العقود", `${p.error}: ${p.violations.join("؛ ")}`);
    order = p.order; step("فحص العقود والترتيب", true, order.length ? "المتغيّر: " + order.join(" → ") : "لا مكوّن متغيّر");
  }

  /* 2) الترحيلات: توافق + تطابق مع المسجَّل (قبل أي تطبيق) */
  const pm = await adapter.pendingMigrations(migrations);
  if (pm.mismatched?.length) return fail("تطابق الترحيلات المطبَّقة", "تغيّر محتوى ترحيل مُطبَّق: " + pm.mismatched.join("، "));
  if (pm.unknown?.length) return fail("تطابق الترحيلات المطبَّقة", "ترحيل مُطبَّق غير موجود في الإصدار: " + pm.unknown.join("، "));
  const breaking = [];
  for (const m of pm.pending) { const c = classifyMigration(m.sql); if (!c.ok) return fail("فحص توافق الترحيلات", `${m.name}: ${c.violations.join("؛ ")} — الترحيلات إضافية فقط`); if (c.breaking) breaking.push(m.name); }
  if (breaking.length && !allowBreaking) return fail("فحص توافق الترحيلات", `ترحيل كاسر يتطلب --allow-breaking يدوياً: ${breaking.join("، ")}`);
  step("فحص توافق الترحيلات", true, pm.pending.length ? `${pm.pending.length} جديد (إضافي${breaking.length ? "، وفيها كاسر معتمَد" : ""})` : "لا جديد");

  /* 3) حماية البيانات: لقطة + نسخة صفوف احتياطية (قبل أي كتابة). العلامة الزمنية تُسجَّل للاستعمال اليدوي فقط ولا تُستعمل تلقائياً */
  const before = await adapter.snapshot(snapshotTables, { rows: true });
  if (adapter.saveBackup) await adapter.saveBackup(manifest.id, before);
  if (pm.pending.length && adapter.bookmark) { try { R.bookmark = await adapter.bookmark(); } catch { R.bookmark = null; } }
  step("لقطة البيانات ونسخة الصفوف الاحتياطية", true, `${Object.values(before).filter(Boolean).length} جدول محميّ${R.bookmark ? "، علامة زمنية للاستعمال اليدوي فقط" : ""}`);

  const deployedNow = [];
  /** رجوع الكود فقط. قاعدة البيانات لا تُستعاد أبداً هنا (بيانات جديدة قد تكون وصلت) */
  const rollback = async (reason) => {
    for (const c of [...deployedNow].reverse()) { try { await adapter.activateComponent(c.comp, c.previous); R.rolledBack.push(`${c.comp} ← ${typeof c.previous === "object" ? JSON.stringify(c.previous) : c.previous}`); } catch (e) { R.rolledBack.push(`${c.comp}: فشل الرجوع (${e.message})`); } }
    R.rolledBack.push("قاعدة البيانات: لم تُمسّ (لا استعادة تلقائية)");
    R.status = R.status === "failed_data_loss" ? R.status : "failed_rolled_back"; step("الرجوع التلقائي (الكود فقط)", true, reason); return R;
  };

  /* 4) تطبيق الترحيلات (إضافية وقابلة لإعادة التطبيق: فشل في المنتصف يُترك كما هو ويُكمَل بإعادة المحاولة) */
  if (pm.pending.length) { try { R.migrationsApplied = await adapter.applyMigrations(pm.pending, { schemaHash: manifest.components.api.schema_hash, sha: manifest.source.sha }); step("تطبيق الترحيلات", true, R.migrationsApplied.join("، ")); } catch (e) { step("تطبيق الترحيلات", false, e.message); R.warnings.push("فشل الترحيل في المنتصف: لا استعادة للقاعدة (قد وصلت بيانات جديدة). التغييرات المطبَّقة إضافية، والكود القديم يعمل عليها، وإعادة المحاولة تكمل بأمان."); return rollback("فشل الترحيل"); } }

  /* 5) نشر المكوّنات بالترتيب الآمن، مع تحقق صحة بعد كل مكوّن */
  for (const comp of order) {
    try { const r = await adapter.deployComponent(comp, manifest, artifacts[comp]); deployedNow.push({ comp, previous: r.previous }); R.handles[comp] = r.handle; const isOk = (x) => comp === "ui" || comp === "templates" ? x[comp]?.release === manifest.id : x[comp]?.sha === manifest.source.sha; const h = await awaitHealth(adapter, isOk, hw); const exp = isOk(h); if (!exp) throw new Error("فحص الصحة بعد النشر لم يطابق: " + JSON.stringify(h[comp])); step(`نشر ${comp}`, true, r.note ?? ""); }
    catch (e) { if (e.uploaded && !deployedNow.some((d) => d.comp === comp)) deployedNow.push({ comp, previous: e.previous ?? null });   /* رُفعت نسخة ثم فشل التحقق: تُتتبَّع ليشملها الرجوع */
      step(`نشر ${comp}`, false, e.message); return rollback(`فشل نشر ${comp}`); }
  }

  /* 6) تحقق نهائي: هوية/مخطط، سلامة البيانات، دخان */
  const idChk = (x) => x.api?.environment === "beta" && x.api?.db_environment === "beta" && (!manifest.components.api.schema_hash || x.api?.schema_hash === manifest.components.api.schema_hash);
  const h = await awaitHealth(adapter, idChk, hw);
  const idOk = h.api?.environment === "beta" && h.api?.db_environment === "beta" && (!manifest.components.api.schema_hash || h.api?.schema_hash === manifest.components.api.schema_hash);
  if (!step("هوية البيئة والمخطط", idOk, idOk ? "" : JSON.stringify(h.api))) return rollback("هوية/مخطط غير مطابقين");
  const after = await adapter.snapshot(snapshotTables, {}), cmp = compareSnapshots(before, after);
  if (!step("سلامة بيانات المتاجر والطلبات", cmp.ok, cmp.ok ? "لا نقص ولا استبدال" : cmp.violations.join("؛ "))) {
    R.status = "failed_data_loss";
    const sbLoss = Object.entries(cmp.missing).filter(([t]) => t.startsWith("sb:")), d1Loss = Object.entries(cmp.missing).filter(([t]) => !t.startsWith("sb:"));
    if (d1Loss.length) { R.recovery = { release: manifest.id, tables: Object.fromEntries(d1Loss.map(([t, ids]) => [t, ids.length])), command: `node platform/release/beta-release.mjs recover-missing --release ${manifest.id}` }; R.warnings.push(`فُقدت صفوف في D1 (${d1Loss.map(([t, ids]) => `${t}: ${ids.length}`).join("، ")}). لم تُستعد القاعدة تلقائياً لئلا تُمحى بيانات جديدة. الاستعادة الجراحية (تعيد المفقود وحده دون المساس بالجديد؛ معاينة افتراضياً): ${R.recovery.command} [--apply]`); }
    if (sbLoss.length) R.warnings.push(`فُقدت بيانات في Supabase ولا تُستعاد تلقائياً (لا علامة استعادة). استعدها يدوياً من النسخة الاحتياطية للمشروع. المفقود: ` + sbLoss.map(([t, ids]) => `${t.slice(3)} (${ids.length}): ${ids.slice(0, 10).join("،")}${ids.length > 10 ? "…" : ""}`).join("؛ "));
    if (!d1Loss.length && !sbLoss.length) R.warnings.push("نقص عدد صفوف جدول كبير بلا قائمة مفاتيح: لا يمكن تحديد المفقود تلقائياً؛ افحص يدوياً.");
    return rollback("نقصت/تغيّرت البيانات");
  }
  const sm = await adapter.smoke(); const badSm = sm.filter((x) => !x.ok);
  if (!step("اختبار الدخان", badSm.length === 0, badSm.length ? badSm.map((x) => x.name).join("، ") : `${sm.length} فحصاً`)) return rollback("فشل الدخان");

  const rec = { ...manifest, handles: { ...(deployed?.handles ?? {}), ...R.handles }, deployed_in: { ...(deployed?.deployed_in ?? {}), ...Object.fromEntries(order.map((c) => [c, manifest.source.sha])) } };
  if (!step("مطابقة الحالة الحيّة للسجل", liveMatches(await adapter.health(), rec), "")) return rollback("الحالة الحيّة لا تطابق السجل");
  await adapter.recordRelease(rec, { ...R, ok: true, status: "deployed" });
  R.ok = true; R.status = "deployed"; step("تسجيل الإصدار", true, manifest.id); return R;
}

/** استعادة جراحية يدوية: تعيد الصفوف التي كانت في النسخة الاحتياطية واختفت الآن، بـINSERT OR IGNORE (لا تحذف ولا تعدّل أي صف موجود ولا الجديد). apply=false ⇒ معاينة فقط */
export async function recoverMissing({ adapter, releaseId, apply = false, log = () => { } }) {
  const R = { ok: false, applied: apply, tables: {}, manual: [] }, backup = await adapter.loadBackup?.(releaseId);
  if (!backup) { log("✖ لا نسخة احتياطية للإصدار " + releaseId); return R; }
  const tables = Object.keys(backup).filter((t) => backup[t]), cur = await adapter.snapshot(tables, {}), { plan, manual } = recoveryPlan(backup, cur); R.manual = manual;
  for (const [t, rows] of Object.entries(plan)) { R.tables[t] = rows.length; log(`${apply ? "تُعاد" : "معاينة"}: ${t} ← ${rows.length} صف مفقود`); if (apply) await adapter.insertRows(t, rows); }
  for (const m of manual) log("⚠ يدوي: " + m);
  if (apply) { const after = await adapter.snapshot(tables, {}), c = compareSnapshots({ ...Object.fromEntries(Object.entries(backup).map(([t, b]) => [t, b && { count: b.count, ids: b.ids }])) }, after); R.ok = c.ok; log(c.ok ? "✓ كل صفوف النسخة الاحتياطية موجودة الآن (والصفوف الجديدة لم تُمسّ)" : "✗ ما زال ناقصاً: " + c.violations.join("؛ ")); }
  else R.ok = true; return R;
}

/** رجوع إلى إصدار مسجَّل (الكود/الواجهة/القوالب فقط؛ الترحيلات الإضافية لا تُعكَس عمداً فيبقى الكود القديم يعمل عليها). البيانات الجديدة لا تُمسّ */
export async function runRollback({ adapter, to, log = () => { } }) {
  const R = { ok: false, status: "failed", steps: [], rolledBack: [] }, step = (n, ok, d) => { R.steps.push({ name: n, ok, ...(d ? { detail: d } : {}) }); log((ok ? "✓ " : "✗ ") + n + (d ? " — " + d : "")); return ok; };
  const releases = await adapter.listReleases(), cur = await adapter.getDeployed();
  const target = to ? releases.find((r) => r.id === to) : releases.find((r) => r.id !== cur?.id);
  if (!target) { step("اختيار الإصدار الهدف", false, "لا إصدار سابق مسجَّل"); return R; }
  const dep = Object.fromEntries(COMPONENTS.map((k) => [k, cur.components[k]])), cand = Object.fromEntries(COMPONENTS.map((k) => [k, target.components[k]]));
  const changed = COMPONENTS.filter((k) => cur.components[k].hash !== target.components[k].hash), p = planOrder(dep, cand, changed);
  if (!p.ok) { step("فحص التوافق", false, p.violations.join("؛ ")); return R; }
  step("فحص التوافق", true, `${cur.id} → ${target.id}`);
  const before = await adapter.snapshot(adapter.protectedTables ?? [], {});
  for (const c of p.order) { try { await adapter.activateComponent(c, target.handles?.[c]); R.rolledBack.push(c); step(`تفعيل ${c}`, true, target.id); } catch (e) { step(`تفعيل ${c}`, false, e.message); return R; } }
  const h = await adapter.health(), ok = liveMatches(h, target); step("تحقق الصحة", ok, ok ? "" : JSON.stringify(h));
  const cmp = compareSnapshots(before, await adapter.snapshot(adapter.protectedTables ?? [], {})); step("سلامة البيانات (لا نقص؛ الجديد محفوظ)", cmp.ok, cmp.violations.join("؛ "));
  if (ok && cmp.ok) { await adapter.setCurrent(target); R.ok = true; R.status = "rolled_back_to"; }
  return R;
}
