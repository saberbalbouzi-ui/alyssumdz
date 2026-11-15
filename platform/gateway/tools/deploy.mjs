// نشر بوابة الشحن على Cloudflare بلا wrangler:  node tools/deploy.mjs --env <production|beta> [--dry-run] <خطوة> ...
// الخطوات: db | worker | secrets | route | status | rollback | all (= db worker secrets route). ربط الخدمة PLATFORM يشير إلى منصة نفس البيئة حصراً (Beta←Beta). PLATFORM_ADMIN_TOKEN سرّ يُضبط يدوياً بقيمة رمز إدارة منصة **نفس البيئة** (لا يُولَّد هنا).
// --env إلزامي (لا افتراضي): أسماء الموارد والمضيف من platform/env/environments.json؛ Beta لا يُنشَر فوق Production ولا العكس (src/envguard.js:deployPlan).
// production يتطلب --production و ALLOW_PRODUCTION_DEPLOY=yes معاً (موافقة صريحة منفصلة). غير الإنتاج يتطلب CF_ACCOUNT_ID وCF_ZONE_ID صريحين (لا افتراضات إنتاجية).
// --dry-run: لا اتصال بالشبكة إطلاقاً؛ يطبع الطلبات المخطَّطة (بلا أسرار) — وهكذا تُختبر الأداة في CI.
// المصادقة: CF_API_TOKEN إن وُجد وإلا الوكيل الذي يحقن الرمز. لا تُطبع الأسرار أبداً (--save-secrets <مسار> يكتبها في ملف خارجي).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { deployPlan } from "../src/envguard.js";
const REG = JSON.parse(readFileSync(new URL("../../env/environments.json", import.meta.url), "utf8"));
const PLATFORM_HOST = (REG.environments)[opt0("--env") || ""]?.api_host;
function opt0(n) { const a = process.argv.slice(2); return a.includes(n) ? a[a.indexOf(n) + 1] : null; }
const args = process.argv.slice(2), flag = (n) => args.includes(n), opt = (n) => (flag(n) ? args[args.indexOf(n) + 1] : null), DRY = flag("--dry-run");
let plan; try { plan = deployPlan(REG, { kind: "gateway", env: opt("--env"), flags: { production: flag("--production") }, vars: process.env }); } catch (e) { console.error("✖ " + e.message); process.exit(2); }
const PROD_DEFAULT = { account: "1dffae72b40ca6558da19b84eff8c864", zone: "2c1b59d33ef58b35683c06bf4c6da40b" };       // افتراضات Production وحدها (تاريخياً)؛ غير الإنتاج يشترط صراحةً
const ACCOUNT = plan.account || (plan.env === "production" ? PROD_DEFAULT.account : null), ZONE = plan.zone || (plan.env === "production" ? PROD_DEFAULT.zone : null);
const NAME = plan.worker, DB_NAME = plan.d1, HOST = plan.host, API = "https://api.cloudflare.com/client/v4";
const here = (p) => new URL("../" + p, import.meta.url);
const hdr = process.env.CF_API_TOKEN ? { Authorization: "Bearer " + process.env.CF_API_TOKEN } : {};
const SCHEMA_TEXT = readFileSync(here("schema.sql"), "utf8"), SCHEMA_HASH = createHash("sha256").update(SCHEMA_TEXT).digest("hex").slice(0, 16);
const sha = () => process.env.GIT_SHA || (() => { try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: new URL("../../../", import.meta.url), encoding: "utf8" }).trim(); } catch { return "unknown"; } })();
const version = () => { try { return readFileSync(new URL("../../../VERSION", import.meta.url), "utf8").trim(); } catch { return "unknown"; } };
async function cf(method, path, body, extra = {}) {
  const isForm = body instanceof FormData;
  if (DRY) {                                                                       // لا شبكة: يطبع الطلب (الأجسام النصية بلا أسرار؛ الـFormData يُختصر)
    console.log(`DRY ${method} ${path}` + (body && !isForm ? " " + JSON.stringify(body).slice(0, 150) : isForm ? " <multipart: metadata=" + JSON.stringify(JSON.parse(body.__meta ?? "{}")).slice(0, 700) + ">" : ""));
    return method === "GET" ? (/\/d1\/database\?name=/.test(path) ? [{ name: DB_NAME, uuid: "dry-run-d1-id" }] : /deployments/.test(path) ? { deployments: [{ id: "dep-new", versions: [{ version_id: "v-new", percentage: 100 }] }, { id: "dep-prev", versions: [{ version_id: "v-prev", percentage: 100 }] }] } : []) : { uuid: "dry-run-d1-id", result: [{ results: [] }] };
  }
  const r = await fetch(API + path, { method, headers: { ...hdr, ...(body && !isForm ? { "Content-Type": "application/json" } : {}), ...extra }, body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  const j = await r.json().catch(() => ({})); if (!j.success) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j.errors || j).slice(0, 400)}`); return j.result;
}
async function dbId() { const l = await cf("GET", `/accounts/${ACCOUNT}/d1/database?name=${DB_NAME}`); return (l || []).find((d) => d.name === DB_NAME)?.uuid || null; }
const q = (id, sql, params) => cf("POST", `/accounts/${ACCOUNT}/d1/database/${id}/query`, params ? { sql, params } : { sql });
async function stepDb() {
  let id = await dbId();
  if (!id) { id = (await cf("POST", `/accounts/${ACCOUNT}/d1/database`, { name: DB_NAME })).uuid; console.log("D1 أُنشئت:", id); } else console.log("D1 موجودة:", id);
  const schema = SCHEMA_TEXT.replace(/--[^\n]*/g, "");   // المخطط كله IF NOT EXISTS
  const stmts = schema.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
  for (const s of stmts) await q(id, s);
  console.log("المخطط طُبِّق (" + stmts.length + " جملة)");
  /* هوية القاعدة: تُسجَّل مرة، ولا تُستبدل بقيمة مخالفة (قاعدة Production لا تتحول إلى Beta ولا العكس). يرفض Worker الإقلاع على قاعدة بهوية مخالفة */
  await q(id, "INSERT OR IGNORE INTO pf_meta (k,v,at) VALUES ('environment',?,?)", [plan.env, new Date().toISOString()]);
  if (!DRY) { const r = await q(id, "SELECT v FROM pf_meta WHERE k='environment'"); const v = r?.[0]?.results?.[0]?.v; if (v !== plan.env) throw new Error(`هوية القاعدة '${v}' ≠ البيئة المطلوبة '${plan.env}' — أُوقف النشر (قاعدة مشتركة/مخطئة)`); }
  await q(id, "INSERT INTO pf_meta (k,v,at) VALUES ('schema_hash',?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, at=excluded.at", [SCHEMA_HASH, new Date().toISOString()]);
  console.log("هوية القاعدة =", plan.env, "· schema_hash =", SCHEMA_HASH); return id;
}
function files(dir, base = "") { return readdirSync(new URL(dir, here("")), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(dir + e.name + "/", base + e.name + "/") : [base + e.name]); }
async function stepWorker() {
  const id = await dbId(); if (!id) throw new Error("نفّذ خطوة db أولاً");
  const fd = new FormData(), S = sha(), V = version();
  const meta = { main_module: "index.js", compatibility_date: "2026-01-01", bindings: [{ type: "d1", name: "DB", id }, { type: "plain_text", name: "PUBLIC_URL", text: plan.publicUrl }, { type: "plain_text", name: "ENVIRONMENT", text: plan.env }, { type: "plain_text", name: "GIT_SHA", text: S }, { type: "plain_text", name: "APP_VERSION", text: V }, { type: "plain_text", name: "SCHEMA_HASH", text: SCHEMA_HASH }, { type: "plain_text", name: "PLATFORM_URL", text: "https://" + PLATFORM_HOST }, { type: "service", name: "PLATFORM", service: plan.platformService }], keep_bindings: ["secret_text"] };
  fd.__meta = JSON.stringify(meta); fd.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  for (const f of files("src/")) fd.append(f, new Blob([readFileSync(here("src/" + f))], { type: "application/javascript+module" }), f);
  await cf("PUT", `/accounts/${ACCOUNT}/workers/scripts/${NAME}`, fd); console.log("Worker رُفع:", NAME, "· sha", S.slice(0, 12), "· version", V);
  await cf("PUT", `/accounts/${ACCOUNT}/workers/scripts/${NAME}/schedules`, [{ cron: "* * * * *" }]); console.log("cron كل دقيقة مضبوط (لهذا الـWorker وحده)");
  await q(id, "INSERT INTO pf_meta (k,v,at) VALUES ('release_sha',?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, at=excluded.at", [S, new Date().toISOString()]);
}
async function stepSecrets(save) {
  const have = new Set(((await cf("GET", `/accounts/${ACCOUNT}/workers/scripts/${NAME}/secrets`).catch(() => [])) || []).map((s) => s.name)); const out = {};
  for (const [k, gen] of [["APP_ENCRYPTION_KEY", () => randomBytes(32).toString("base64")], ["ADMIN_TOKEN", () => randomBytes(32).toString("hex")]]) {
    if (have.has(k)) { console.log(k, "موجود — لم يُغيَّر"); continue; }
    const v = gen(); await cf("PUT", `/accounts/${ACCOUNT}/workers/scripts/${NAME}/secrets`, { name: k, text: DRY ? "<dry-run-redacted>" : v, type: "secret_text" }); out[k] = v; console.log(k, "ضُبط (قيمة جديدة مستقلة لهذه البيئة)");
  }
  if (save && Object.keys(out).length && !DRY) { writeFileSync(save, JSON.stringify(out), { mode: 0o600 }); console.log("حُفظت القيم الجديدة في", save, "(خارج المستودع)"); }
}
async function stepRoute() {
  const pattern = plan.route, routes = await cf("GET", `/zones/${ZONE}/workers/routes`);
  if (pattern.startsWith("*") || pattern === "/*") throw new Error("مسار شامل مرفوض");
  if ((routes || []).some((r) => r.pattern === pattern)) { console.log("المسار موجود"); return; }
  await cf("POST", `/zones/${ZONE}/workers/routes`, { pattern, script: NAME }); console.log("المسار أُضيف:", pattern);
}
/** يعرض الإصدار المنشور: آخر نشرات الـWorker + هوية/SHA/مخطط القاعدة (للتحقق قبل/بعد الترقية) */
async function stepStatus() {
  const dep = await cf("GET", `/accounts/${ACCOUNT}/workers/scripts/${NAME}/deployments`), list = dep?.deployments ?? dep ?? []; console.log("آخر النشرات:", JSON.stringify(list.slice(0, 3).map((d) => ({ id: d.id, at: d.created_on, versions: (d.versions || []).map((v) => v.version_id) }))));
  const id = await dbId(); if (id) { const r = await q(id, "SELECT k,v FROM pf_meta WHERE k IN ('environment','schema_hash','release_sha','rollback_to')"); console.log("pf_meta:", JSON.stringify(r?.[0]?.results ?? [])); }
  console.log("المتوقع من هذا المستودع: sha", sha().slice(0, 12), "· version", version(), "· schema_hash", SCHEMA_HASH);
}
/** تراجع إلى النشرة السابقة لهذا الـWorker فقط (Cloudflare Versions). لا يمسّ قاعدة D1 ولا أي Worker آخر؛ استعادة البيانات إجراء منفصل (D1 Time Travel) على قاعدة هذه البيئة وحدها */
async function stepRollback() {
  const dep = await cf("GET", `/accounts/${ACCOUNT}/workers/scripts/${NAME}/deployments`), list = dep?.deployments ?? dep ?? [];
  const prev = list[1]; if (!prev?.versions?.length) throw new Error("لا نشرة سابقة للتراجع إليها");
  await cf("POST", `/accounts/${ACCOUNT}/workers/scripts/${NAME}/deployments`, { strategy: "percentage", versions: prev.versions.map((v) => ({ version_id: v.version_id, percentage: 100 })), annotations: { "workers/message": "rollback by deploy.mjs" } });
  console.log("تم التراجع إلى النشرة", prev.id, "للـWorker", NAME, "(الكود فقط؛ قاعدة البيانات لم تُمسّ)");
}
const save = opt("--save-secrets"), STEPS = ["db", "worker", "secrets", "route", "status", "rollback", "all"], steps = args.filter((a) => STEPS.includes(a));
const run = steps.includes("all") ? ["db", "worker", "secrets", "route"] : steps;
console.log(`[${plan.label}] worker=${NAME} d1=${DB_NAME} host=${HOST}${DRY ? "  (DRY-RUN: بلا شبكة)" : ""}`);
for (const s of run) { if (s === "db") await stepDb(); else if (s === "worker") await stepWorker(); else if (s === "secrets") await stepSecrets(save); else if (s === "route") await stepRoute(); else if (s === "status") await stepStatus(); else if (s === "rollback") await stepRollback(); }
if (!run.length) console.log("الخطوات: db | worker | secrets [--save-secrets مسار] | route | status | rollback | all   (مع --env <production|beta> [--dry-run])");
