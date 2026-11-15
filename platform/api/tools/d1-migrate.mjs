// تطبيق هجرات platform/api/migrations على قاعدة **Beta** (D1 عبر REST) أو قاعدة محلية.  لا يعمل على production إطلاقاً.
//   node tools/d1-migrate.mjs --env beta [--status] [--dry-run]      (يتطلب CF_ACCOUNT_ID وCF_ZONE_ID وCF_API_TOKEN صراحةً؛ الاسم من platform/env/environments.json)
//   node tools/d1-migrate.mjs --env local --local-db /path/file.db   (node:sqlite)
import { readFileSync } from "node:fs";
import { deployPlan } from "../src/envguard.js";
import { loadMigrations, migrate } from "./migrate-lib.mjs";
const args = process.argv.slice(2), flag = (n) => args.includes(n), opt = (n) => (flag(n) ? args[args.indexOf(n) + 1] : null), env = opt("--env"), DRY = flag("--dry-run") || flag("--status");
if (!["beta", "local"].includes(env)) { console.error("✖ --env beta|local مطلوب (production محظور على هذه الأداة)"); process.exit(2); }
const REG = JSON.parse(readFileSync(new URL("../../env/environments.json", import.meta.url), "utf8")), migrations = loadMigrations(new URL("../migrations/", import.meta.url));
let exec, label;
if (env === "local") {
  const path = opt("--local-db"); if (!path) { console.error("✖ --local-db <ملف> مطلوب مع --env local"); process.exit(2); }
  const { DatabaseSync } = await import("node:sqlite"); const db = new DatabaseSync(path); label = "sqlite:" + path;
  exec = async (sql, p = []) => { const st = db.prepare(sql); if (/^\s*(select|pragma|explain)/i.test(sql)) return { results: st.all(...p), changes: 0 }; const r = st.run(...p); return { results: [], changes: Number(r.changes) }; };
} else {
  let plan; try { plan = deployPlan(REG, { kind: "api", env: "beta", vars: process.env }); } catch (e) { console.error("✖ " + e.message); process.exit(2); }
  const API = "https://api.cloudflare.com/client/v4", H = process.env.CF_API_TOKEN ? { Authorization: "Bearer " + process.env.CF_API_TOKEN, "Content-Type": "application/json" } : null; if (!H) { console.error("✖ CF_API_TOKEN مطلوب"); process.exit(2); }
  const cf = async (m, p, b) => { const r = await fetch(API + p, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }), j = await r.json().catch(() => ({})); if (!j.success) throw new Error(`${m} ${p} → ${r.status} ${JSON.stringify(j.errors || j).slice(0, 300)}`); return j.result; };
  const dbs = await cf("GET", `/accounts/${plan.account}/d1/database?name=${plan.d1}`), d = (dbs || []).find((x) => x.name === plan.d1); if (!d) { console.error("✖ قاعدة " + plan.d1 + " غير موجودة (شغّل deploy.mjs --env beta db أولاً)"); process.exit(2); }
  label = "d1:" + plan.d1; exec = async (sql, p) => { const r = await cf("POST", `/accounts/${plan.account}/d1/database/${d.uuid}/query`, p ? { sql, params: p } : { sql }); return { results: r?.[0]?.results ?? [], changes: r?.[0]?.meta?.changes ?? 0 }; };
}
try { const r = await migrate({ exec, env, migrations, dryRun: DRY, log: (...a) => console.log(...a) }); console.log(`[${label}] ${DRY ? "(dry) " : ""}مُطبَّقة سابقاً: ${r.skipped.length} · جديدة: ${r.applied.length} ${r.applied.join(",")} · الهوية: ${r.environment}`); }
catch (e) { console.error("✖ " + e.message); process.exit(1); }
