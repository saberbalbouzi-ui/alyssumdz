/* منسّق نشر Beta: يشغّل الخطوات بترتيب آمن عبر «محوّل سحابة» (adapter) قابل للاستبدال (محاكي للاختبار | Cloudflare للحقيقي).
   الضمانات: (1) لا أثر جانبي قبل اجتياز فحص التوافق والترحيلات؛ (2) لقطة بيانات + علامة استعادة قبل أي ترحيل؛ (3) الواجهة/القوالب تُنشَر آخراً بتبديل مؤشر ذرّي؛
   (4) أي فشل ⇒ رجوع تلقائي للمكوّنات المنشورة (بالترتيب العكسي) واستعادة القاعدة إن فشل الترحيل أو نقصت البيانات؛ (5) نشر الإصدار نفسه مرتين = لا شيء (noop) مع تحقق. */
import { planOrder, classifyMigration, compareSnapshots, COMPONENTS, stateViolations } from "./release-lib.mjs";

const FIRST_ORDER = ["api", "gateway", "ui", "templates"];
/** هل الحالة الحيّة تطابق سجل إصدار؟ (كل مكوّن يُقارَن بالإصدار الذي نشره فعلاً، لا بإصدار الـcommit الحالي) */
export function liveMatches(h, rec) { const di = rec.deployed_in ?? {}, hd = rec.handles ?? {}; return h.api?.sha === di.api && h.gateway?.sha === di.gateway && h.ui?.release === (hd.ui?.release ?? null) && h.templates?.release === (hd.templates?.release ?? null); }
export async function runRelease({ adapter, manifest, migrations = [], artifacts = {}, snapshotTables = [], allowBreaking = false, log = () => { } }) {
  const R = { ok: false, status: "failed", steps: [], rolledBack: [], restored: false, migrationsApplied: [], handles: {}, warnings: [] };
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

  /* 3) حماية البيانات: لقطة + علامة استعادة (قبل أي كتابة) */
  const before = await adapter.snapshot(snapshotTables); const bookmark = pm.pending.length ? await adapter.bookmark() : null;
  step("لقطة البيانات" + (bookmark ? " وعلامة الاستعادة" : ""), true, `${Object.values(before).filter(Boolean).length} جدول محميّ`);

  const deployedNow = []; let migrated = false, h2;
  const rollback = async (reason, { restoreDb }) => {
    for (const c of [...deployedNow].reverse()) { try { await adapter.activateComponent(c.comp, c.previous); R.rolledBack.push(`${c.comp} ← ${typeof c.previous === "object" ? JSON.stringify(c.previous) : c.previous}`); } catch (e) { R.rolledBack.push(`${c.comp}: فشل الرجوع (${e.message})`); } }
    if (restoreDb && bookmark) { try { await adapter.restore(bookmark); R.restored = true; R.rolledBack.push("قاعدة البيانات ← علامة ما قبل الترحيل"); } catch (e) { R.rolledBack.push("فشل استعادة القاعدة: " + e.message); } }
    R.status = R.restored ? "failed_restored" : "failed_rolled_back"; step("الرجوع التلقائي", true, reason); return R;
  };

  /* 4) تطبيق الترحيلات */
  if (pm.pending.length) { try { R.migrationsApplied = await adapter.applyMigrations(pm.pending, { schemaHash: manifest.components.api.schema_hash, sha: manifest.source.sha }); migrated = true; step("تطبيق الترحيلات", true, R.migrationsApplied.join("، ")); } catch (e) { step("تطبيق الترحيلات", false, e.message); return rollback("فشل الترحيل", { restoreDb: true }); } }

  /* 5) نشر المكوّنات بالترتيب الآمن، مع تحقق صحة بعد كل مكوّن */
  for (const comp of order) {
    try { const r = await adapter.deployComponent(comp, manifest, artifacts[comp]); deployedNow.push({ comp, previous: r.previous }); R.handles[comp] = r.handle; const h = await adapter.health(); const exp = comp === "ui" || comp === "templates" ? h[comp]?.release === manifest.id : h[comp]?.sha === manifest.source.sha; if (!exp) throw new Error("فحص الصحة بعد النشر لم يطابق: " + JSON.stringify(h[comp])); step(`نشر ${comp}`, true, r.note ?? ""); }
    catch (e) { step(`نشر ${comp}`, false, e.message); return rollback(`فشل نشر ${comp}`, { restoreDb: false }); }
  }

  /* 6) تحقق نهائي: هوية/مخطط، سلامة البيانات، دخان */
  const h = await adapter.health();
  const idOk = h.api?.environment === "beta" && h.api?.db_environment === "beta" && (!manifest.components.api.schema_hash || h.api?.schema_hash === manifest.components.api.schema_hash);
  if (!step("هوية البيئة والمخطط", idOk, idOk ? "" : JSON.stringify(h.api))) return rollback("هوية/مخطط غير مطابقين", { restoreDb: migrated });
  const cmp = compareSnapshots(before, await adapter.snapshot(snapshotTables));
  if (!step("سلامة بيانات المتاجر والطلبات", cmp.ok, cmp.ok ? "لا نقص ولا استبدال" : cmp.violations.join("؛ "))) {
    const sbLoss = cmp.violations.filter((v) => v.startsWith("sb:")), d1Loss = cmp.violations.filter((v) => !v.startsWith("sb:"));
    if (sbLoss.length) R.warnings.push("فُقدت بيانات في Supabase ولا تُستعاد تلقائياً (لا علامة استعادة): " + sbLoss.join("؛ ") + " — استعدها يدوياً من النسخة الاحتياطية");
    return rollback("نقصت/تغيّرت البيانات", { restoreDb: d1Loss.length > 0 });
  }
  const sm = await adapter.smoke(); const badSm = sm.filter((x) => !x.ok);
  if (!step("اختبار الدخان", badSm.length === 0, badSm.length ? badSm.map((x) => x.name).join("، ") : `${sm.length} فحصاً`)) return rollback("فشل الدخان", { restoreDb: false });

  const rec = { ...manifest, handles: { ...(deployed?.handles ?? {}), ...R.handles }, deployed_in: { ...(deployed?.deployed_in ?? {}), ...Object.fromEntries(order.map((c) => [c, manifest.source.sha])) } };
  if (!step("مطابقة الحالة الحيّة للسجل", liveMatches(h2 = await adapter.health(), rec), "")) return rollback("الحالة الحيّة لا تطابق السجل", { restoreDb: false });
  await adapter.recordRelease(rec, { ...R, ok: true, status: "deployed" });
  R.ok = true; R.status = "deployed"; step("تسجيل الإصدار", true, manifest.id); return R;
}

/** رجوع إلى إصدار مسجَّل (الكود/الواجهة/القوالب فقط؛ الترحيلات الإضافية لا تُعكَس عمداً فيبقى الكود القديم يعمل عليها) */
export async function runRollback({ adapter, to, log = () => { } }) {
  const R = { ok: false, status: "failed", steps: [], rolledBack: [] }, step = (n, ok, d) => { R.steps.push({ name: n, ok, ...(d ? { detail: d } : {}) }); log((ok ? "✓ " : "✗ ") + n + (d ? " — " + d : "")); return ok; };
  const releases = await adapter.listReleases(), cur = await adapter.getDeployed();
  const target = to ? releases.find((r) => r.id === to) : releases.find((r) => r.id !== cur?.id);
  if (!target) { step("اختيار الإصدار الهدف", false, "لا إصدار سابق مسجَّل"); return R; }
  const dep = Object.fromEntries(COMPONENTS.map((k) => [k, cur.components[k]])), cand = Object.fromEntries(COMPONENTS.map((k) => [k, target.components[k]]));
  const changed = COMPONENTS.filter((k) => cur.components[k].hash !== target.components[k].hash), p = planOrder(dep, cand, changed);
  if (!p.ok) { step("فحص التوافق", false, p.violations.join("؛ ")); return R; }
  step("فحص التوافق", true, `${cur.id} → ${target.id}`);
  const before = await adapter.snapshot(adapter.protectedTables ?? []);
  for (const c of p.order) { try { await adapter.activateComponent(c, target.handles?.[c]); R.rolledBack.push(c); step(`تفعيل ${c}`, true, target.id); } catch (e) { step(`تفعيل ${c}`, false, e.message); return R; } }
  const h = await adapter.health(), ok = liveMatches(h, target); step("تحقق الصحة", ok, ok ? "" : JSON.stringify(h));
  const cmp = compareSnapshots(before, await adapter.snapshot(adapter.protectedTables ?? [])); step("سلامة البيانات", cmp.ok, cmp.violations.join("؛ "));
  if (ok && cmp.ok) { await adapter.setCurrent(target); R.ok = true; R.status = "rolled_back_to"; }
  return R;
}
