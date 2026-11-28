// منطق مقارنة «المنشور مقابل المحلي» ودمج الربط الآمن — نقي (بلا شبكة) ليُختبر دون حساب Cloudflare.
// يستعمله tools/deploy.mjs في خطوة diff (قراءة فقط) وفي worker مع --keep-existing.
import { createHash } from "node:crypto";
export const sha8 = (t) => createHash("sha256").update(t).digest("hex").slice(0, 12);

/** يفكّ جواب multipart/form-data (محتوى الـWorker) إلى {اسم ملف: نص}. */
export function parseMultipart(body, boundary) {
  const out = {}; if (!boundary) return out;
  for (const part of String(body).split("--" + boundary)) {
    const m = /^\r?\n?([\s\S]*?)\r?\n\r?\n([\s\S]*?)\r?\n?$/.exec(part.replace(/^\r?\n/, "")); if (!m || /^--/.test(part.trim())) continue;
    const fn = /filename="([^"]+)"/.exec(m[1]) || /name="([^"]+)"/.exec(m[1]); if (fn) out[fn[1]] = m[2].replace(/\r?\n$/, "");
  }
  return out;
}
const norm = (b) => { const { name, type } = b; const r = { name, type }; for (const k of Object.keys(b).sort()) if (!["name", "type"].includes(k) && !(k === "database_id" && b.id) && !/^(text|secret|value)$/.test(k) || (k === "text" && type === "plain_text")) r[k] = b[k]; return r; };
const brief = (b) => b.type === "plain_text" ? `${b.name}=${/KEY|SECRET|TOKEN|PASS/i.test(b.name) ? "<مخفي>" : String(b.text).slice(0, 60)}` : b.type === "secret_text" ? `${b.name}(سر)` : `${b.name}:${b.type}`;

/** يقارن الحالة المنشورة بالمحلية؛ يعيد {lines, risks, same}. لا يطبع قيم أسرار (plain_text بأسماء حساسة تُخفى). */
export function compare(local, remote) {
  const lines = [], risks = [];
  const rb = new Map((remote.bindings || []).map((b) => [b.name, b])), lb = new Map((local.bindings || []).map((b) => [b.name, b]));
  const dropped = [...rb.keys()].filter((n) => !lb.has(n) && rb.get(n).type !== "secret_text");
  const added = [...lb.keys()].filter((n) => !rb.has(n));
  const changed = [...lb.keys()].filter((n) => rb.has(n) && JSON.stringify(norm(rb.get(n))) !== JSON.stringify(norm(lb.get(n))));
  if (added.length) lines.push("ربط يُضاف: " + added.map((n) => brief(lb.get(n))).join("، "));
  if (changed.length) lines.push("ربط يتغيّر: " + changed.map((n) => `${brief(rb.get(n))} ← ${brief(lb.get(n))}`).join("، "));
  if (dropped.length) { lines.push("ربط يُحذف (غير مذكور محلياً): " + dropped.map((n) => brief(rb.get(n))).join("، ")); risks.push("الرفع الافتراضي يحذف ربطاً موجوداً: " + dropped.join("، ") + " — استعمل --keep-existing"); }
  if (remote.compatibility_date && remote.compatibility_date !== local.compatibility_date) { lines.push(`compatibility_date: ${remote.compatibility_date} ← ${local.compatibility_date}`); risks.push("تاريخ التوافق يتغيّر (قد يغيّر سلوك وقت التشغيل) — --keep-existing يبقيه"); }
  const rs = (remote.schedules || []).map((s) => s.cron || s).sort().join("|"), ls = (local.schedules || []).sort().join("|");
  if (rs !== ls) { lines.push(`cron: [${rs || "لا شيء"}] ← [${ls}]`); if (rs) risks.push("الجدولة المنشورة ستُستبدل — --keep-existing لا يمسّها"); }
  const rf = remote.files || {}, lf = local.files || {}, fl = [];
  for (const f of Object.keys(lf)) { if (!(f in rf)) fl.push("+ " + f); else if (sha8(rf[f].trimEnd()) !== sha8(lf[f].trimEnd())) fl.push("~ " + f); }
  for (const f of Object.keys(rf)) if (!(f in lf)) fl.push("− " + f);
  if (remote.files) { lines.push(fl.length ? `ملفات الكود (${fl.length} فرق):\n   ` + fl.join("\n   ") : "ملفات الكود: مطابقة تماماً"); if (fl.some((x) => x[0] !== "+" || !/laura/i.test(x))) risks.push("فروق كود خارج LAURA: النشر يرسل الـWorker كاملاً — راجعها قبل الرفع"); }
  else lines.push("ملفات الكود: لم يمكن جلبها (قارنها يدوياً)");
  return { lines, risks, same: !lines.length || (!added.length && !changed.length && !dropped.length && !fl.length && rs === ls) };
}

/** الدمج الآمن: يبقي كل ربط منشور (عدا ما نضبطه نحن)، يبقي تاريخ التوافق وأعلامه. الأسرار تُبقى بـkeep_bindings. */
export function mergeMeta(meta, remote) {
  if (!remote) return meta;
  const ours = new Set(meta.bindings.map((b) => b.name));
  const keep = (remote.bindings || []).filter((b) => b.type !== "secret_text" && !ours.has(b.name));
  const out = { ...meta, bindings: [...keep, ...meta.bindings], keep_bindings: ["secret_text"] };
  if (remote.compatibility_date) out.compatibility_date = remote.compatibility_date;
  if (remote.compatibility_flags?.length) out.compatibility_flags = remote.compatibility_flags;
  return out;
}

/** بيانات الإصدار في pf_meta: لا إنشاء للجدول ولا هجرة. q(sql, params) مُحقَن. يعيد {written, warning?}. غياب الجدول ليس فشلاً (الإنتاج قد لا يملكه). */
async function hasPfMeta(q, id) { const r = await q(id, "SELECT name FROM sqlite_master WHERE type='table' AND name='pf_meta'"); return !!r?.[0]?.results?.length; }
export async function writeReleaseSha(q, id, sha, now) {
  if (!(await hasPfMeta(q, id))) return { written: false, warning: "جدول pf_meta غير موجود في D1 — تخطّيتُ تسجيل release_sha (لم يُنشأ الجدول ولا هجرة؛ الـWorker نفسه نُشر)" };
  await q(id, "INSERT INTO pf_meta (k,v,at) VALUES ('release_sha',?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, at=excluded.at", [sha, now]); return { written: true };
}
export async function readReleaseMeta(q, id) {
  if (!(await hasPfMeta(q, id))) return { available: false, rows: [] };
  const r = await q(id, "SELECT k,v FROM pf_meta WHERE k IN ('environment','schema_hash','release_sha','rollback_to')"); return { available: true, rows: r?.[0]?.results ?? [] };
}
