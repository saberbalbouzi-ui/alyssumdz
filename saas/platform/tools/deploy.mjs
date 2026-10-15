// نشر منصة API على Cloudflare بلا wrangler:  node tools/deploy.mjs <خطوة> ...
// الخطوات: db (إنشاء D1 + المخطط) | worker (رفع الكود + الربط + cron) | secrets (APP_ENCRYPTION_KEY/ADMIN_TOKEN عند غيابهما) | route | all
// المصادقة: المتغير CF_API_TOKEN إن وُجد وإلا يمرّ الطلب عبر وكيل الجلسة الذي يحقن الرمز. لا تُطبع الأسرار أبداً (تُكتب في ملف خارجي إن طُلب --save-secrets <مسار>).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const ACCOUNT = process.env.CF_ACCOUNT_ID || "1dffae72b40ca6558da19b84eff8c864", ZONE = process.env.CF_ZONE_ID || "2c1b59d33ef58b35683c06bf4c6da40b";
const NAME = "alyssum-platform-api", DB_NAME = "alyssum-platform-api", HOST = "api.alyssumhub.fyi", API = "https://api.cloudflare.com/client/v4";
const here = (p) => new URL("../" + p, import.meta.url);
const hdr = process.env.CF_API_TOKEN ? { Authorization: "Bearer " + process.env.CF_API_TOKEN } : {};
async function cf(method, path, body, extra = {}) {
  const isForm = body instanceof FormData;
  const r = await fetch(API + path, { method, headers: { ...hdr, ...(body && !isForm ? { "Content-Type": "application/json" } : {}), ...extra }, body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  const j = await r.json().catch(() => ({})); if (!j.success) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j.errors || j).slice(0, 400)}`); return j.result;
}
async function dbId() { const l = await cf("GET", `/accounts/${ACCOUNT}/d1/database?name=${DB_NAME}`); return (l || []).find((d) => d.name === DB_NAME)?.uuid || null; }
async function stepDb() {
  let id = await dbId();
  if (!id) { id = (await cf("POST", `/accounts/${ACCOUNT}/d1/database`, { name: DB_NAME })).uuid; console.log("D1 أُنشئت:", id); } else console.log("D1 موجودة:", id);
  const schema = readFileSync(here("schema.sql"), "utf8").replace(/--[^\n]*/g, "");   // المخطط كله IF NOT EXISTS
  const stmts = schema.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
  for (const s of stmts) await cf("POST", `/accounts/${ACCOUNT}/d1/database/${id}/query`, { sql: s });
  console.log("المخطط طُبِّق (" + stmts.length + " جملة)"); return id;
}
function files(dir, base = "") { return readdirSync(new URL(dir, here("")), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(dir + e.name + "/", base + e.name + "/") : [base + e.name]); }
async function stepWorker() {
  const id = await dbId(); if (!id) throw new Error("نفّذ خطوة db أولاً");
  const fd = new FormData();
  const meta = { main_module: "index.js", compatibility_date: "2026-01-01", bindings: [{ type: "d1", name: "DB", id }, { type: "plain_text", name: "PUBLIC_URL", text: "https://" + HOST }], keep_bindings: ["secret_text"] };
  fd.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  for (const f of files("src/")) fd.append(f, new Blob([readFileSync(here("src/" + f))], { type: "application/javascript+module" }), f);
  await cf("PUT", `/accounts/${ACCOUNT}/workers/scripts/${NAME}`, fd); console.log("Worker رُفع");
  await cf("PUT", `/accounts/${ACCOUNT}/workers/scripts/${NAME}/schedules`, [{ cron: "* * * * *" }]); console.log("cron كل دقيقة مضبوط");
}
async function stepSecrets(save) {
  const have = new Set((await cf("GET", `/accounts/${ACCOUNT}/workers/scripts/${NAME}/secrets`).catch(() => [])).map((s) => s.name)); const out = {};
  for (const [k, gen] of [["APP_ENCRYPTION_KEY", () => randomBytes(32).toString("base64")], ["ADMIN_TOKEN", () => randomBytes(32).toString("hex")], ["PLATFORM_SECRET", () => randomBytes(32).toString("hex")]]) {
    if (have.has(k)) { console.log(k, "موجود — لم يُغيَّر"); continue; }
    const v = gen(); await cf("PUT", `/accounts/${ACCOUNT}/workers/scripts/${NAME}/secrets`, { name: k, text: v, type: "secret_text" }); out[k] = v; console.log(k, "ضُبط");
  }
  if (save && Object.keys(out).length) { writeFileSync(save, JSON.stringify(out), { mode: 0o600 }); console.log("حُفظت القيم الجديدة في", save, "(خارج المستودع)"); }
}
async function stepRoute() {
  const pattern = HOST + "/*", routes = await cf("GET", `/zones/${ZONE}/workers/routes`);
  if (routes.some((r) => r.pattern === pattern)) { console.log("المسار موجود"); return; }
  await cf("POST", `/zones/${ZONE}/workers/routes`, { pattern, script: NAME }); console.log("المسار أُضيف:", pattern);
}
/** يضبط سرّي تطبيق Meta (ربط Facebook بنقرة واحدة) من متغيّرات البيئة META_APP_ID وMETA_APP_SECRET — لا يطبعهما ولا يكتبهما في ملف */
async function stepMeta() {
  const id = (process.env.META_APP_ID || "").trim(), sec = (process.env.META_APP_SECRET || "").trim();
  if (!/^\d{8,20}$/.test(id) || sec.length < 16) { console.log("ضع META_APP_ID (أرقام) وMETA_APP_SECRET في بيئة التنفيذ ثم أعد: node saas/platform/tools/deploy.mjs meta"); process.exitCode = 2; return; }
  for (const [k, v] of [["META_APP_ID", id], ["META_APP_SECRET", sec]]) { await cf("PUT", `/accounts/${ACCOUNT}/workers/scripts/${NAME}/secrets`, { name: k, text: v, type: "secret_text" }); console.log(k, "ضُبط"); }
  console.log("Redirect URI الواجب تسجيله في تطبيق Meta (Facebook Login ← Valid OAuth Redirect URIs): https://" + HOST + "/v1/ads/oauth/meta/callback");
  console.log("Deauthorize Callback: https://" + HOST + "/v1/ads/oauth/meta/deauth  ·  Data Deletion Request URL: https://" + HOST + "/v1/ads/oauth/meta/deletion");
}
const args = process.argv.slice(2), save = args.includes("--save-secrets") ? args[args.indexOf("--save-secrets") + 1] : null, steps = args.filter((a) => ["db", "worker", "secrets", "route", "meta", "all"].includes(a));
const run = steps.includes("all") ? ["db", "worker", "secrets", "route"] : steps;
for (const s of run) { if (s === "db") await stepDb(); else if (s === "worker") await stepWorker(); else if (s === "secrets") await stepSecrets(save); else if (s === "route") await stepRoute(); else if (s === "meta") await stepMeta(); }
if (!run.length) console.log("الخطوات: db | worker | secrets [--save-secrets مسار] | route | meta | all");
