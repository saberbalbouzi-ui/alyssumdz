#!/usr/bin/env node
// ضبط إعدادات Auth الخاصة بمشروع Supabase Beta فقط (Site URL وقائمة إعادة التوجيه وإيقاف التسجيل العام وحدّ كلمة المرور).
//   node scripts/supabase-beta-auth.mjs                                      (افتراضي: قراءة فقط — يطبع الفرق بين الحالي والمطلوب)
//   BETA_SUPABASE_REF=<ref> BETA_SUPABASE_PAT=<pat> node scripts/supabase-beta-auth.mjs --apply --confirm-ref <ref>
// الحراسات (قبل أي كتابة): المرجع ≠ Production ولا مشروع آخر محمي؛ يطابق المسجَّل لـBeta و--confirm-ref؛ اسم المشروع المُسترجَع من API = alyssum-beta.
// المطلوب مشتق من platform/env/environments.json (app_host) — لا قيم ثابتة لمضيف Production، ولا أسرار تُطبع.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig, guards } from "./supabase-beta-apply.mjs";

export function desiredAuth(cfg = loadConfig()) {
  const host = cfg.B.app_host;
  if (!host || (cfg.N.hosts ?? []).includes(host)) throw new Error("app_host لـBeta غير صالح أو يطابق مضيف Production");
  return { disable_signup: true, external_anonymous_users_enabled: false, site_url: "https://" + host, uri_allow_list: "https://" + host + "/**", password_min_length: 10 };
}
export async function run({ argv = process.argv.slice(2), env = process.env, fetchFn = fetch, log = console.log } = {}) {
  const has = (f) => argv.includes(f), opt = (f) => (has(f) ? argv[argv.indexOf(f) + 1] : null), cfg = loadConfig(), apply = has("--apply");
  let want; try { want = desiredAuth(cfg); } catch (e) { log("✖ " + e.message); return { code: 1 }; }
  const bad = guards({ ref: env.BETA_SUPABASE_REF, confirmRef: apply ? opt("--confirm-ref") : env.BETA_SUPABASE_REF, pat: env.BETA_SUPABASE_PAT, adminEmail: "n/a" }, cfg);
  if (bad.length) { for (const b of bad) log("✖ " + b); return { code: 2, problems: bad }; }
  const api = "https://api.supabase.com/v1/projects/" + env.BETA_SUPABASE_REF, H = { Authorization: "Bearer " + env.BETA_SUPABASE_PAT, "Content-Type": "application/json" };
  const info = await fetchFn(api, { headers: H }); if (info.status !== 200) { log("✖ تعذّر قراءة المشروع (HTTP " + info.status + ")"); return { code: 2 }; }
  const pj = await info.json(), expected = cfg.B.supabase_project_name;
  if (pj.name !== expected || (cfg.N.other_project_names ?? []).includes(pj.name)) { log(`✖ اسم المشروع '${pj.name}' ≠ '${expected}' — أُوقف قبل أي كتابة`); return { code: 2 }; }
  const get = async () => { const r = await fetchFn(api + "/config/auth", { headers: H }); if (r.status !== 200) throw new Error("قراءة config/auth: HTTP " + r.status); return r.json(); };
  const cur = await get(), diff = Object.entries(want).filter(([k, v]) => cur[k] !== v);
  for (const [k, v] of Object.entries(want)) log((cur[k] === v ? "= " : "≠ ") + k + ": " + JSON.stringify(cur[k]) + (cur[k] === v ? "" : " → " + JSON.stringify(v)));
  if (!apply) { log(diff.length ? "(قراءة فقط) فروق: " + diff.length + " — للتطبيق: --apply --confirm-ref <ref>" : "(قراءة فقط) مطابق للمطلوب"); return { code: 0, diff: diff.map(([k]) => k) }; }
  if (!diff.length) { log("لا تغيير مطلوب"); return { code: 0 }; }
  const r = await fetchFn(api + "/config/auth", { method: "PATCH", headers: H, body: JSON.stringify(Object.fromEntries(diff)) });
  if (r.status >= 300) { log("✖ فشل التطبيق (HTTP " + r.status + ")"); return { code: 1 }; }
  const after = await get(), still = Object.entries(want).filter(([k, v]) => after[k] !== v);
  if (still.length) { log("✖ بعد التطبيق لم تتطابق: " + still.map(([k]) => k).join(",")); return { code: 1 }; }
  log("✓ طُبِّقت وتحقق منها بإعادة القراءة: " + diff.map(([k]) => k).join(", ")); return { code: 0 };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) { const r = await run(); process.exit(r.code); }
