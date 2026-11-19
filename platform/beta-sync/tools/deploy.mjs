#!/usr/bin/env node
/* نشر Worker المزامنة إلى حساب Cloudflare **Beta** وحده (موارد جديدة بأسماء -beta من السجل). لا يلمس موارد Beta القائمة (api/gateway/web) سوى قراءة معرّف KV الواجهة وربطها كـservice binding.
   الخطوات: حواجز (حساب ≠ Production، أسماء من platform/env/environments.json) ← D1 (إنشاء إن غاب) + المخطط ← رفع الوحدات (worker.js كـindex.js + src/*.js) بالارتباطات ← workers.dev ← cron كل دقيقة.
   الرمز: CF_API_TOKEN (أو يحقنه الوكيل). SYNC_TOKEN يُولَّد مرة ويُحفظ في ملف أسرار محلي 0600 ولا يُطبع. البيئة: BETA_CF_ACCOUNT_ID, BETA_SUPABASE_URL, BETA_SUPABASE_ANON_KEY (عام), SOURCE_REF (افتراضي main), SOURCE_REPO.
   الاستعمال: node platform/beta-sync/tools/deploy.mjs [--dry-run] */
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA } from "../src/db.js";

const HERE = path.dirname(fileURLToPath(import.meta.url)), SRC = path.join(HERE, "../src"), ROOT = path.resolve(HERE, "../../..");
const REG = JSON.parse(readFileSync(path.join(ROOT, "platform/env/environments.json"), "utf8")), B = REG.environments.beta, NP = REG.never_outside_production, PROD_ACC = ["1dffae72b40ca6558da19b84eff8c864"];
const env = process.env, DRY = process.argv.includes("--dry-run"), API = "https://api.cloudflare.com/client/v4";
const die = (m) => { console.error("✖ " + m); process.exit(2); };
const acc = env.BETA_CF_ACCOUNT_ID ?? ""; if (!/^[0-9a-f]{32}$/.test(acc) || PROD_ACC.includes(acc)) die("BETA_CF_ACCOUNT_ID غير صالح أو هو حساب Production");
for (const k of ["sync_worker", "sync_d1", "sync_host", "static_worker", "static_kv", "app_host"]) if (!B[k] || !/beta/.test(B[k])) die("اسم مورد Beta غير صالح: " + k);
const surl = env.BETA_SUPABASE_URL ?? "", skey = env.BETA_SUPABASE_ANON_KEY ?? "";
if (!/^https:\/\/([a-z0-9]{10,30})\.supabase\.co$/.test(surl) || surl.includes(NP.supabase_refs[0]) || !surl.includes(B.supabase_ref)) die("BETA_SUPABASE_URL يجب أن يكون مشروع Beta");
if (!/^sb_publishable_|^eyJ/.test(skey) || NP.public_key_markers.some((k) => skey.includes(k)) || /service_role|sb_secret/.test(skey)) die("BETA_SUPABASE_ANON_KEY يجب أن يكون المفتاح العام لـBeta");
const repo = env.SOURCE_REPO ?? "saberbalbouzi-ui/alyssumdz", ref = env.SOURCE_REF ?? "main"; if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[\w./-]{1,80}$/.test(ref)) die("مصدر غير صالح");
const auth = env.CF_API_TOKEN ? { Authorization: "Bearer " + env.CF_API_TOKEN } : { Authorization: "Bearer placeholder" };   // الوكيل يستبدل الرمز
const cf = async (method, p, body, headers = {}) => {
  const form = body instanceof FormData; const r = await fetch(`${API}/accounts/${acc}${p}`, { method, headers: { ...auth, ...(body && !form ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? (form ? body : JSON.stringify(body)) : undefined });
  const j = await r.json().catch(() => ({})); if (!j.success) throw new Error(`${method} ${p} → ${r.status} ${JSON.stringify(j.errors ?? j).slice(0, 250)}`); return j.result;
};
const log = (m) => console.log(m);

/* حواجز الحساب */
const accounts = await (await fetch(`${API}/accounts`, { headers: auth })).json(); if (!accounts.success || !accounts.result.some((a) => a.id === acc)) die("الرمز لا يرى حساب Beta المعلن");
if (accounts.result.some((a) => PROD_ACC.includes(a.id))) die("الرمز يرى حساب Production — مرفوض");
const workers = (await cf("GET", "/workers/scripts")).map((w) => w.id); for (const n of [B.static_worker]) if (!workers.includes(n)) die("Worker الواجهة غير موجود: " + n);
const kvs = await cf("GET", "/storage/kv/namespaces?per_page=100"), ns = kvs.find((k) => k.title === B.static_kv)?.id; if (!ns) die("فضاء KV الواجهة غير موجود: " + B.static_kv);

/* D1 */
let d1 = (await cf("GET", `/d1/database?name=${encodeURIComponent(B.sync_d1)}`)).find((d) => d.name === B.sync_d1);
if (!d1) { if (DRY) log("(dry-run) سيُنشأ D1 " + B.sync_d1); else { d1 = await cf("POST", "/d1/database", { name: B.sync_d1 }); log("✓ أُنشئت قاعدة D1: " + B.sync_d1); } } else log("✓ D1 موجودة: " + B.sync_d1);
if (!DRY) { for (const s of SCHEMA) await cf("POST", `/d1/database/${d1.uuid}/query`, { sql: s }); log("✓ مخطط المزامنة مُطبَّق (CREATE IF NOT EXISTS)"); }

/* رمز المراقبة */
const secFile = env.BETA_SYNC_SECRETS ?? "/home/user/beta-secrets-new/sync.json"; let token;
if (existsSync(secFile)) token = JSON.parse(readFileSync(secFile, "utf8")).SYNC_TOKEN; if (!token) { token = randomBytes(24).toString("hex"); if (!DRY) { mkdirSync(path.dirname(secFile), { recursive: true }); writeFileSync(secFile, JSON.stringify({ SYNC_TOKEN: token }) + "\n"); chmodSync(secFile, 0o600); } log("✓ رمز المراقبة مُولَّد وحُفظ محلياً (لا يُطبع)"); }

/* رفع الوحدات */
const mods = { "index.js": "worker.js", "github.js": "github.js", "targets.js": "targets.js", "db.js": "db.js", "rules.js": "rules.js", "engine.js": "engine.js" }, fd = new FormData();
const bindings = [
  { type: "d1", name: "DB", id: d1?.uuid ?? "dry-run" }, { type: "kv_namespace", name: "FILES", namespace_id: ns }, { type: "service", name: "WEB", service: B.static_worker, environment: "production" },
  { type: "plain_text", name: "ENVIRONMENT", text: "beta" }, { type: "plain_text", name: "SOURCE_REPO", text: repo }, { type: "plain_text", name: "SOURCE_REF", text: ref }, { type: "plain_text", name: "SYNC_BUDGET_FILES", text: String(env.SYNC_BUDGET_FILES ?? "12") }, { type: "plain_text", name: "BETA_APP_HOST", text: B.app_host },
  { type: "plain_text", name: "BETA_SUPABASE_URL", text: surl }, { type: "plain_text", name: "BETA_SUPABASE_ANON_KEY", text: skey }, { type: "plain_text", name: "REGISTRY_JSON", text: JSON.stringify({ hosts: NP.hosts, supabase_refs: NP.supabase_refs, public_key_markers: NP.public_key_markers, identity_markers: NP.identity_markers }) },
  { type: "secret_text", name: "SYNC_TOKEN", text: token },
  ...(env.GITHUB_READ_TOKEN ? [{ type: "secret_text", name: "GITHUB_READ_TOKEN", text: env.GITHUB_READ_TOKEN }] : []),   // اختياري: رمز قراءة فقط لمستودع علني ← حدّ أعلى (5000/ساعة)
];
fd.append("metadata", new Blob([JSON.stringify({ main_module: "index.js", compatibility_date: "2026-01-01", bindings, keep_bindings: [] })], { type: "application/json" }));
for (const [name, file] of Object.entries(mods)) fd.append(name, new Blob([readFileSync(path.join(SRC, file), "utf8")], { type: "application/javascript+module" }), name);
if (DRY) { log("(dry-run) الوحدات: " + Object.keys(mods).join(", ") + " | ارتباطات: " + bindings.map((b) => b.name).join(",")); process.exit(0); }
await cf("PUT", `/workers/scripts/${B.sync_worker}`, fd); log("✓ رُفع Worker " + B.sync_worker);
await cf("POST", `/workers/scripts/${B.sync_worker}/subdomain`, { enabled: true, previews_enabled: false }); log("✓ workers.dev مفعّل: https://" + B.sync_host);
await cf("PUT", `/workers/scripts/${B.sync_worker}/schedules`, [{ cron: "* * * * *" }]); log("✓ cron كل دقيقة");
console.log(JSON.stringify({ worker: B.sync_worker, d1: B.sync_d1, host: B.sync_host, source: repo + "@" + ref, kv: B.static_kv }));
