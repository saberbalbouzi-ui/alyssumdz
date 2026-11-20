#!/usr/bin/env node
// تجهيز قاعدة Supabase الخاصة بـBeta: يبني حزمة SQL بالترتيب المُتحقَّق منه محلياً (platform/env/beta-resources.json → supabase.sql_apply_order)، يستبدل بيانات المالك الإنتاجية، يرفض أي أثر هوية إنتاجية،
// ثم (فقط مع --apply) يطبّقها على **مشروع Beta** عبر Management API.   لا ينشئ المشروع (إنشاؤه قرار/موافقة منفصلة).
//   node scripts/supabase-beta-apply.mjs --dry-run                       (افتراضي: يبني ويفحص ويطبع الخطة والبصمات؛ بلا شبكة)
//   BETA_SUPABASE_REF=<ref> BETA_SUPABASE_PAT=<pat> BETA_ADMIN_EMAIL=<بريد-beta> node scripts/supabase-beta-apply.mjs --apply --confirm-ref <ref> [--with-optional]
// حراسات --apply: ref ≠ مرجع/اسم Production ولا مشروع آخر معروف؛ --confirm-ref يطابق؛ اسم المشروع المُسترجَع من API = اسم Beta في السجل؛ البريد ≠ بريد المالك؛ لا قيم تُطبع (PAT/كلمات مرور).
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const sha = (t) => createHash("sha256").update(t).digest("hex").slice(0, 16);

export function loadConfig(root = ROOT) {
  const R = JSON.parse(readFileSync(path.join(root, "platform/env/environments.json"), "utf8")), M = JSON.parse(readFileSync(path.join(root, "platform/env/beta-resources.json"), "utf8"));
  return { R, M, B: R.environments.beta, N: R.never_outside_production };
}
/** يجرّد كتلة -- NAME:start … -- NAME:end (مع السطر الأخير) من نص SQL. يعيد { sql, n } — n = عدد الكتل المجرَّدة. بقية الملف (الحماية الأخرى) تبقى حرفياً. */
export function stripBlock(sql, name) {
  const rx = new RegExp("-- " + name + ":start[\\s\\S]*?-- " + name + ":end[^\\n]*\\n?", "g");
  let n = 0; const out = sql.replace(rx, () => { n++; return ""; });
  return { sql: out, n };
}
/** يبني الحزمة: [{ path, sql, sha }] + problems[] — يفشل (problems غير فارغة) إن بقي أي أثر هوية إنتاجية بعد الاستبدال */
export function buildBundle({ root = ROOT, adminEmail, withOptional = false } = {}) {
  const { M, N } = loadConfig(root), problems = [], files = [], order = M.supabase.sql_apply_order;
  if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) problems.push("BETA_ADMIN_EMAIL غير صالح/مفقود");
  if (adminEmail && (N.identity_markers ?? []).some((m) => adminEmail.toLowerCase().includes(m.toLowerCase()))) problems.push("BETA_ADMIN_EMAIL يطابق هوية المالك الإنتاجية — استعمل بريداً مخصصاً لـBeta");
  const email = String(adminEmail ?? "").replace(/'/g, "''");
  for (const rel of [...order.required, ...(withOptional ? order.optional : [])]) {
    if (order.excluded.includes(rel)) { problems.push("ملف مستبعَد في القائمة المطلوبة: " + rel); continue; }
    let sql; try { sql = readFileSync(path.join(root, rel), "utf8"); } catch { problems.push("ملف مفقود: " + rel); continue; }
    const sb = order.strip_blocks?.[rel];
    if (sb) { const r = stripBlock(sql, sb); if (r.n !== 1) { problems.push(`${rel}: كتلة ${sb} يجب أن توجد مرة واحدة بعلامتيها (وُجدت ${r.n})`); continue; } sql = r.sql; }
    if (rel === "platform/sql/schema.sql") {
      const before = sql;
      sql = sql.replace(/do \$\$ declare cid uuid; begin\s*if not exists \(select 1 from public\.saas_sites where origin = 'https:\/\/alyssumdz\.com'\) then[\s\S]*?end \$\$;/, "-- (حُذف: عميل/موقع Production الأول لا يُزرَع في Beta)")
        .replace("values ('saber.balbouzi@gmail.com', 'صابر', 'owner')", `values ('${email}', 'Beta Admin', 'owner')`);
      if (sql === before) problems.push("لم تُطبَّق استبدالات البذور على " + rel);
    }
    if (rel === "platform/supabase/hub.sql") {
      const before = sql; sql = sql.replace(/insert into public\.hub_sites[\s\S]*$/, "-- (حُذفت: بذرة مستودع Production لا تُزرع في Beta)\n");
      if (sql === before || /alyssumdz|saberbalbouzi/i.test(sql)) problems.push("لم تُحذف بذرة Production من " + rel);
    }
    files.push({ path: rel, sql, sha: sha(sql) });
  }
  for (const f of files) if (/ruqya|رقية/i.test(f.sql)) problems.push(`${f.path}: بقي أثر للرقية (وظيفة موقع ALYSSUM فقط) في حزمة Beta`);
  const markers = [...(N.identity_markers ?? []), ...(N.hosts ?? []), ...(N.supabase_refs ?? []), ...(N.public_key_markers ?? [])];
  for (const f of files) for (const m of markers) if (f.sql.toLowerCase().includes(m.toLowerCase())) problems.push(`${f.path}: أثر هوية إنتاجية «${m.slice(0, 12)}…»`);
  /* بصمة التسجيل في المدير: صف public.admins لبريد Beta (اختياري لكن لازم لدخول لوحة المتجر) */
  files.push({ path: "(generated) admins", sql: `insert into public.admins (email) values ('${email}') on conflict do nothing;`, sha: sha(email) });
  return { files, problems };
}
export function guards({ ref, confirmRef, pat, adminEmail }, cfg = loadConfig()) {
  const { N, B } = cfg, bad = [], prodRefs = new Set([...(N.supabase_refs ?? []), cfg.R.environments.production.supabase_ref].filter(Boolean));
  if (!/^[a-z0-9]{20}$/.test(String(ref ?? ""))) bad.push("BETA_SUPABASE_REF غير صالح (20 حرفاً)"); if (prodRefs.has(ref)) bad.push("المرجع هو مشروع Production — مرفوض");
  if (confirmRef !== ref) bad.push("--confirm-ref يجب أن يطابق BETA_SUPABASE_REF"); if (!pat) bad.push("BETA_SUPABASE_PAT مفقود"); if (!adminEmail) bad.push("BETA_ADMIN_EMAIL مفقود");
  if (B.supabase_ref && B.supabase_ref !== ref) bad.push("المرجع لا يطابق supabase_ref المسجَّل لـBeta في السجل");
  return bad;
}
export async function run({ argv = process.argv.slice(2), env = process.env, fetchFn = fetch, log = console.log } = {}) {
  const has = (f) => argv.includes(f), opt = (f) => (has(f) ? argv[argv.indexOf(f) + 1] : null), cfg = loadConfig(), apply = has("--apply");
  const { files, problems } = buildBundle({ adminEmail: env.BETA_ADMIN_EMAIL || (apply ? "" : "beta-admin@example.test"), withOptional: has("--with-optional") });
  log(`حزمة SQL لـBeta: ${files.length} ملفاً —`, files.map((f) => `${path_(f.path)}[${f.sha}]`).join(" ، "));
  if (problems.length) { for (const p of problems) log("✖ " + p); return { code: 1, problems }; }
  if (!apply) { log("(dry-run) لا اتصال ولا تطبيق. للتطبيق: --apply --confirm-ref <ref> مع BETA_SUPABASE_REF/BETA_SUPABASE_PAT/BETA_ADMIN_EMAIL"); return { code: 0, files }; }
  const bad = guards({ ref: env.BETA_SUPABASE_REF, confirmRef: opt("--confirm-ref"), pat: env.BETA_SUPABASE_PAT, adminEmail: env.BETA_ADMIN_EMAIL }, cfg); if (bad.length) { for (const b of bad) log("✖ " + b); return { code: 2, problems: bad }; }
  const api = "https://api.supabase.com/v1/projects/" + env.BETA_SUPABASE_REF, H = { Authorization: "Bearer " + env.BETA_SUPABASE_PAT, "Content-Type": "application/json" };
  const info = await fetchFn(api, { headers: H }); if (info.status !== 200) { log("✖ تعذّر قراءة المشروع (HTTP " + info.status + ")"); return { code: 2 }; }
  const pj = await info.json(), expected = cfg.B.supabase_project_name, others = cfg.N.other_project_names ?? [];
  if (pj.name !== expected || others.includes(pj.name)) { log(`✖ اسم المشروع '${pj.name}' ≠ '${expected}' (أو اسم مشروع محمي) — أُوقف التطبيق`); return { code: 2 }; }
  for (const f of files) { const r = await fetchFn(api + "/database/query", { method: "POST", headers: H, body: JSON.stringify({ query: f.sql }) }); if (r.status >= 300) { log(`✖ فشل ${path_(f.path)} (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}`); return { code: 1 }; } log("✓", path_(f.path)); }
  return { code: 0, files };
}
const path_ = (p) => p.replace(/^platform\//, "");
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) { const r = await run(); process.exit(r.code); }
