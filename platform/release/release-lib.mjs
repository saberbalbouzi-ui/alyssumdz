/* نواة آلية مزامنة Beta (نقية بلا شبكة): بصمات المكوّنات، عقود التوافق وترتيب النشر، تصنيف الترحيلات (إضافية فقط)، لقطات حماية البيانات،
   بوابتا CI والاعتماد، بيان الإصدار والتقرير. كل ما فيها قابل للاختبار دون Cloudflare/Supabase. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { splitStatements, sha as fileSha } from "../api/tools/migrate-lib.mjs";

export const sha256 = (b) => createHash("sha256").update(b).digest("hex");
export function walk(dir, base = dir) { if (!existsSync(dir)) return []; return readdirSync(dir, { withFileTypes: true }).flatMap((e) => { const p = path.join(dir, e.name); return e.isDirectory() ? walk(p, base) : [path.relative(base, p).split(path.sep).join("/")]; }).sort(); }
/** بصمة مجموعة ملفات: sha256 لسطور «مسار\0بصمة-المحتوى» مرتبة؛ تتغير بتغيّر أي بايت أو إضافة/حذف ملف */
export function hashDir(dir, { include = () => true } = {}) { const files = walk(dir).filter(include); const lines = files.map((f) => f + "\0" + sha256(readFileSync(path.join(dir, f)))); return { hash: sha256(lines.join("\n")), files: files.length }; }
export function hashPaths(root, rels) { const lines = []; for (const r of rels) { const p = path.join(root, r); if (!existsSync(p)) continue; if (statSync(p).isDirectory()) for (const f of walk(p)) lines.push(r + "/" + f + "\0" + sha256(readFileSync(path.join(p, f)))); else lines.push(r + "\0" + sha256(readFileSync(p))); } return { hash: sha256(lines.sort().join("\n")), files: lines.length }; }

export let TPL_PREFIXES = ["assets/pages/", "assets/img/tpl/", "p/_template/", "lp/"];   // المصدر المعتمد: contracts.json → template_prefixes (يستدعي configureTemplates)
export const configureTemplates = (prefixes) => { if (Array.isArray(prefixes) && prefixes.length) TPL_PREFIXES = prefixes.slice(); };
export const isTpl = (f) => TPL_PREFIXES.some((p) => f.startsWith(p));
const RELEASE_FILES = new Set(["beta-release.json", "version.json", "beta-build.json"]);
/** بصمات المكوّنات الأربعة: api/gateway من المصدر، وui/templates من مجلد الواجهة المبنية (ما يُنشر فعلاً؛ القوالب = أصول assets/pages وassets/img/tpl منفصلة الإصدار عن بقية الواجهة) */
export function fingerprints(root, { distDir } = {}) {
  const api = hashPaths(root, ["platform/api/src", "platform/api/schema.sql", "platform/api/migrations"]);
  const gateway = hashPaths(root, ["platform/gateway/src", "platform/gateway/schema.sql"]);
  const ui = distDir ? hashDir(distDir, { include: (f) => !RELEASE_FILES.has(f) && !isTpl(f) }) : { hash: null, files: 0 };
  const templates = distDir ? hashDir(distDir, { include: (f) => isTpl(f) }) : { hash: null, files: 0 };
  const schemaHash = (p) => { try { return sha256(readFileSync(path.join(root, p), "utf8")).slice(0, 16); } catch { return null; } };
  return { api: { ...api, schema_hash: schemaHash("platform/api/schema.sql") }, gateway: { ...gateway, schema_hash: schemaHash("platform/gateway/schema.sql") }, ui, templates };
}

/** تخطيط نشر ساكن معنوَن بالبصمة: map = {مسار: بصمة} (بيان الإصدار)، objects = Map(بصمة → بايتات). الملفات المتطابقة المحتوى تُخزَّن مرة واحدة وتُتخطّى عند الإعادة */
export function staticPlan(files) { const map = {}, objects = new Map(); for (const f of files) { const h = sha256(f.buf); map[f.path] = h; objects.set(h, f.buf); } return { map, objects }; }

/** يقرأ ملفات الترحيل بنفس بصمة d1-migrate (pf_migrations.sha) فيتطابق المسجَّل في القاعدة مع ما يُنشر */
export function readMigrations(dir) { if (!existsSync(dir)) return []; return readdirSync(dir).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort().map((f) => { const sql = readFileSync(path.join(dir, f), "utf8"); return { name: f, sha: fileSha(sql), sql, statements: splitStatements(sql) }; }); }

/* ───────── عقود التوافق ───────── */
export const COMPONENTS = ["api", "gateway", "ui", "templates"];
/** state = { api:{contract,min_ui,min_gateway}, gateway:{contract,requires:{api}}, ui:{contract,requires:{api}}, templates:{contract,requires:{ui}} } — يُعيد قائمة مخالفات (فارغة = حالة صالحة) */
export function stateViolations(s) {
  const v = [], need = (a, b, min) => { if ((s[a]?.contract ?? 0) < min) v.push(`${b} يتطلب ${a}.contract ≥ ${min} (الحالي ${s[a]?.contract ?? "غائب"})`); };
  for (const [c, def] of Object.entries(s)) for (const [dep, min] of Object.entries(def.requires ?? {})) need(dep, c, min);
  if (s.api && s.ui && s.ui.contract < (s.api.min_ui ?? 0)) v.push(`api لم يعد يخدم ui.contract ${s.ui.contract} (الأدنى ${s.api.min_ui})`);
  if (s.api && s.gateway && s.gateway.contract < (s.api.min_gateway ?? 0)) v.push(`api لم يعد يخدم gateway.contract ${s.gateway.contract} (الأدنى ${s.api.min_gateway})`);
  return v;
}
export const stateFromContracts = (c) => Object.fromEntries(Object.entries(c.components).map(([k, d]) => [k, { ...d }]));
function perms(a) { if (a.length <= 1) return [a]; return a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])); }
/** يختار ترتيب نشر المكوّنات المتغيرة بحيث تبقى **كل حالة وسيطة** صالحة. null (مع سبب) إن لم يوجد ترتيب = كسر متزامن مرفوض */
export function planOrder(deployed, candidate, changed) {
  const fin = stateViolations(candidate); if (fin.length) return { ok: false, error: "الحالة النهائية غير متوافقة", violations: fin };
  if (!changed.length) return { ok: true, order: [] };
  let lastErr = null;
  for (const order of perms([...changed])) { let cur = { ...deployed }; let bad = null; for (const c of order) { cur = { ...cur, [c]: candidate[c] }; const vv = stateViolations(cur); if (vv.length) { bad = vv; break; } } if (!bad) return { ok: true, order }; lastErr = bad; }
  return { ok: false, error: "لا ترتيب نشر يُبقي الحالات الوسيطة متوافقة (كسر متزامن): قسّم التغيير إلى إصدارين (توسيع ثم تقليص)", violations: lastErr };
}

/* ───────── الترحيلات: إضافية فقط ───────── */
const strip = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
/** يصنّف SQL ترحيل: مدمّر ⇒ violations. العلامة `-- release:breaking-approved:<سبب>` تحوّله إلى breaking (يتطلب --allow-breaking يدوياً ولقطة استعادة) */
export function classifyMigration(sql) {
  const marker = /--\s*release:breaking-approved:(\S.*)/i.exec(sql)?.[1]?.trim() ?? null, body = strip(sql), v = [];
  const rules = [
    [/\bDROP\s+(TABLE|INDEX|VIEW|TRIGGER)\b/i, "DROP"], [/\bALTER\s+TABLE\s+\S+\s+(DROP|RENAME)\b/i, "ALTER ... DROP/RENAME"], [/\bTRUNCATE\b/i, "TRUNCATE"],
    [/\bDELETE\s+FROM\b/i, "DELETE FROM"], [/\bUPDATE\s+[^;]*?\bSET\b(?![^;]*\bWHERE\b)/i, "UPDATE بلا WHERE"], [/\bINSERT\s+OR\s+REPLACE\b/i, "INSERT OR REPLACE (يستبدل صفوفاً)"], [/\bREPLACE\s+INTO\b/i, "REPLACE INTO"],
    [/\bPRAGMA\s+writable_schema\b/i, "writable_schema"],
  ];
  for (const [rx, name] of rules) if (rx.test(body)) v.push(name);
  for (const m of body.matchAll(/\bCREATE\s+(TABLE|INDEX|UNIQUE\s+INDEX)\s+(?!IF\s+NOT\s+EXISTS)(\S+)/gi)) v.push(`CREATE ${m[1].toUpperCase()} ${m[2]} بلا IF NOT EXISTS (غير قابل لإعادة التطبيق)`);
  for (const m of body.matchAll(/\bALTER\s+TABLE\s+\S+\s+ADD\s+COLUMN\s+(\S+)([^;]*)/gi)) { const rest = m[2]; if (/\bNOT\s+NULL\b/i.test(rest) && !/\bDEFAULT\b/i.test(rest)) v.push(`ADD COLUMN ${m[1]} NOT NULL بلا DEFAULT (يكسر الصفوف القديمة)`); }
  return { violations: v, breaking: v.length > 0 && !!marker, marker, ok: v.length === 0 || !!marker };
}

/* ───────── حماية البيانات: لقطة وقارن ───────── */
export const IDS_CAP = 5000;
/** exec(sql) → rows[]؛ لكل جدول: عدد الصفوف وقائمة المفاتيح (حتى IDS_CAP صفاً؛ وإلا العدد وحده). idCols: عمود المفتاح لكل جدول (الافتراضي rowid لـD1/SQLite). الجدول غير الموجود ⇒ null */
export async function snapshot(exec, tables, { idCols = {} } = {}) {
  const out = {};
  for (const t of tables) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(t)) throw new Error("اسم جدول غير صالح: " + t);
    const col = idCols[t] ?? "rowid"; if (!/^[a-z_][a-z0-9_]*$/i.test(col)) throw new Error("اسم عمود غير صالح: " + col);
    try { const c = Number((await exec(`SELECT COUNT(*) AS n FROM ${t}`))[0]?.n ?? 0); const ids = c <= IDS_CAP ? (await exec(`SELECT ${col} AS r FROM ${t} ORDER BY ${col}`)).map((x) => String(x.r)) : null; out[t] = { count: c, ids }; }
    catch { out[t] = null; }
  }
  return out;
}
/** قبل/بعد: ينقص العدد ⇒ فشل؛ الجدول اختفى ⇒ فشل؛ **اختفاء أي مفتاح كان موجوداً** ⇒ فشل (استبدال/حذف حتى لو بقي العدد). الزيادة (كتابات مستخدمين أثناء النشر) مسموحة ولا تُنذر */
export function compareSnapshots(before, after) {
  const bad = [];
  for (const [t, b] of Object.entries(before)) {
    if (!b) continue; const a = after[t]; if (!a) { bad.push(`${t}: الجدول اختفى`); continue; }
    if (b.ids && a.ids) { const have = new Set(a.ids), miss = b.ids.filter((x) => !have.has(x)); if (miss.length) bad.push(`${t}: اختفت ${miss.length} صفوف (مثلاً ${miss.slice(0, 3).join("،")})`); }
    else if (a.count < b.count) bad.push(`${t}: نقص من ${b.count} إلى ${a.count}`);
  }
  return { ok: bad.length === 0, violations: bad };
}

/* ───────── بوابات: CI والاعتماد ───────── */
/** runs = مصفوفة تشغيلات workflow من واجهة GitHub (head_sha/name/status/conclusion). لا تجاوز: لا نشر إلا بنجاح كل وظائف tests لهذا الـSHA بالذات */
export function ciGate({ sha, runs, workflow = "tests" }) {
  const mine = (runs ?? []).filter((r) => r.head_sha === sha && (r.name === workflow || r.path?.endsWith(workflow + ".yml")));
  if (!mine.length) return { ok: false, reason: `لا تشغيل لـ${workflow} على ${sha.slice(0, 8)}` };
  const latest = mine.sort((a, b) => new Date(b.run_started_at ?? b.created_at ?? 0) - new Date(a.run_started_at ?? a.created_at ?? 0))[0];
  if (latest.status !== "completed") return { ok: false, reason: `${workflow} لم ينتهِ بعد (${latest.status})`, run: latest.id };
  if (latest.conclusion !== "success") return { ok: false, reason: `${workflow} انتهى بـ${latest.conclusion}`, run: latest.id };
  return { ok: true, run: latest.id, url: latest.html_url ?? null };
}
/** معتمَد = SHA على main، أو موسوم بـ`beta-approved/<sha8>` (وسم يضعه إنسان). لا ينشر كل commit */
export function approvalGate({ sha, onMain, tags }) {
  if (onMain) return { ok: true, via: "main" };
  const t = (tags ?? []).find((x) => x === `beta-approved/${sha.slice(0, 8)}` || x === `beta-approved/${sha}`);
  return t ? { ok: true, via: "tag:" + t } : { ok: false, reason: "الـcommit ليس على main ولا يحمل وسم beta-approved/<sha8>" };
}

/* ───────── بيان الإصدار والتقرير ───────── */
export const releaseId = (sha, uiHash) => `r-${sha.slice(0, 8)}-${(uiHash ?? "0").slice(0, 6)}`;
export function buildManifest({ sha, version, contracts, fp, migrations, ci, approval, builtAt = new Date().toISOString(), prev = null }) {
  const comp = (k) => ({ ...contracts.components[k], hash: fp[k].hash, files: fp[k].files, ...(fp[k].schema_hash ? { schema_hash: fp[k].schema_hash } : {}) });
  return { schema: 1, id: releaseId(sha, fp.ui.hash), source: { sha, version, built_at: builtAt }, components: Object.fromEntries(COMPONENTS.map((k) => [k, comp(k)])), migrations: migrations.map((m) => ({ name: m.name, sha: m.sha })), gates: { ci: ci ?? null, approval: approval ?? null }, previous: prev };
}
export function renderReport(manifest, result) {
  const m = manifest, L = [];
  L.push(`# تقرير إصدار Beta — ${m.id}`, "", `- **commit:** \`${m.source.sha}\``, `- **إصدار الشيفرة (VERSION):** ${m.source.version}`, `- **بُني في:** ${m.source.built_at}`, `- **الحالة:** ${result.status}${result.restored ? " (استُعيدت قاعدة البيانات)" : ""}`, `- **الإصدار السابق:** ${m.previous ?? "—"}`, `- **بوابة CI:** ${m.gates.ci?.ok ? "نجحت (تشغيل " + m.gates.ci.run + ")" : "غير مسجّلة"}`, `- **بوابة الاعتماد:** ${m.gates.approval?.via ?? "—"}`, "", "## المكوّنات (منفصلة الإصدار)", "", "| المكوّن | contract | بصمة | ملفات |", "|---|---|---|---|");
  for (const k of COMPONENTS) L.push(`| ${k} | ${m.components[k].contract} | \`${(m.components[k].hash ?? "—").slice(0, 12)}\` | ${m.components[k].files} |`);
  L.push("", "## الترحيلات", "", m.migrations.length ? m.migrations.map((x) => `- ${x.name} (\`${x.sha.slice(0, 12)}\`)`).join("\n") : "- لا ترحيلات", "", `- **المُطبَّق في هذا النشر:** ${result.migrationsApplied?.length ? result.migrationsApplied.join("، ") : "لا شيء"}`, "", "## خطوات التنفيذ", "", ...result.steps.map((s) => `- ${s.ok ? "✓" : "✗"} ${s.name}${s.detail ? " — " + s.detail : ""}`));
  if (result.rolledBack?.length) L.push("", "## الرجوع", "", ...result.rolledBack.map((x) => `- ${x}`));
  if (result.warnings?.length) L.push("", "## تنبيهات تتطلب تدخلاً", "", ...result.warnings.map((x) => `- ⚠ ${x}`));
  L.push("", "> هذا التقرير يصف ما نُفِّذ فعلاً. ما لم يُجرَّب مذكور في docs/BETA-SYNC.md.");
  return L.join("\n") + "\n";
}

/* ───────── beta-content: محتوى متاجر Beta فقط (بيانات)، لا مصدر شيفرة ───────── */
const CONTENT_OK_EXT = new Set([".json", ".md", ".txt", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);
const CODE_RX = /<script|javascript:|\beval\(|\bnew\s+Function\(|\bimport\s*\(|\brequire\(|\bdocument\.write/i;
/** يتحقق أن مجلد المحتوى بيانات فقط: امتدادات مسموحة، لا شيفرة، لا مسارات خارجه، manifest.json صالح. يُعيد {ok, problems} */
export function validateBetaContent(dir) {
  const problems = [], files = walk(dir); if (!files.length) return { ok: true, problems: [], files: 0 };
  if (!files.includes("manifest.json")) problems.push("manifest.json مفقود");
  for (const f of files) {
    const ext = path.extname(f).toLowerCase(); if (f.includes("..") || path.isAbsolute(f)) problems.push("مسار غير مسموح: " + f);
    if (!CONTENT_OK_EXT.has(ext)) { problems.push(`امتداد غير مسموح (محتوى بيانات فقط): ${f}`); continue; }
    const st = statSync(path.join(dir, f)); if (st.size > 5 * 1024 * 1024) problems.push("ملف أكبر من 5MB: " + f);
    if ([".json", ".md", ".txt"].includes(ext)) { const t = readFileSync(path.join(dir, f), "utf8"); if (CODE_RX.test(t)) problems.push("شيفرة داخل ملف المحتوى: " + f); if (ext === ".json") { try { JSON.parse(t); } catch { problems.push("JSON غير صالح: " + f); } } }
  }
  if (files.includes("manifest.json")) { try { const m = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")); if (m.kind !== "beta-content" || m.schema !== 1) problems.push("manifest.json: kind/schema غير صحيحين"); if (m.stores && !Array.isArray(m.stores)) problems.push("manifest.json: stores يجب أن تكون مصفوفة"); } catch { /* سُجّل أعلاه */ } }
  return { ok: problems.length === 0, problems, files: files.length };
}
/** لا ملف شيفرة في المنصة يقرأ من beta-content أو يستورده (المسموح: أدوات الإصدار والتوثيق والاختبارات وworkflow الإصدار) */
export function checkContentIsolation(root) {
  const allow = [/^platform\/release\//, /^docs\//, /^\.github\/workflows\/beta-[a-z-]+\.yml$/, /^\.claude\//, /^beta-content\//, /^platform\/docs\//, /^scripts\/test-workflow-policy\.py$/], hits = [];
  const scan = (dir) => { if (!existsSync(dir)) return; for (const f of walk(dir)) { const rel = path.relative(root, path.join(dir, f)).split(path.sep).join("/"); if (!/\.(m?js|cjs|py|ts|html|ya?ml|sh)$/.test(rel) || allow.some((a) => a.test(rel))) continue; try { if (/beta-content/.test(readFileSync(path.join(dir, f), "utf8"))) hits.push(rel); } catch { } } };
  for (const d of ["platform", "scripts", "assets/js", ".github/workflows"]) scan(path.join(root, d));
  return { ok: hits.length === 0, hits };
}
