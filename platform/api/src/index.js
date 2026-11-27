import { createPlatform, adminModule } from "./core.js";
import { antifraud } from "./modules/antifraud.js";
import { platformModule } from "./modules/platform.js";
import { capi, CAPI_PROVIDERS } from "./modules/capi.js";
import { hooks } from "./modules/hooks.js";
import { digital } from "./modules/digital.js";
import { whatsapp } from "./modules/whatsapp.js";
import { sheets } from "./modules/sheets.js";
import { ab } from "./modules/ab.js";
import { ai } from "./modules/ai.js";
import { carts } from "./modules/carts.js";
import { tryon } from "./modules/tryon.js";
import { payments } from "./modules/payments.js";
import { sms } from "./modules/sms.js";
import { commerce } from "./modules/commerce.js";
import { sources } from "./modules/sources.js";
import { ads } from "./modules/ads.js";
import { adsOauth } from "./modules/adsoauth.js";
import { wallet } from "./modules/wallet.js";
import { agency } from "./modules/agency.js";
import { appstore } from "./modules/appstore.js";
import { marketplace } from "./modules/marketplace.js";
import { laura } from "./modules/laura.js";
import { Vault } from "./crypto.js";
import REGISTRY from "./env-registry.js";
import { validateEnvironment, egressPolicy, guardFetch } from "./envguard.js";
import { beta } from "./modules/beta.js";

const MODULES = [adminModule, antifraud, capi, hooks, digital, whatsapp, sheets, ab, ai, carts, tryon, payments, sms, commerce, sources, ads, adsOauth, wallet, agency, appstore, marketplace, laura];
const build0 = (env, extra) => createPlatform({ environment: extra.environment, d1: env.DB, secret: env.PLATFORM_SECRET, adminToken: env.ADMIN_TOKEN || "", vault: env.APP_ENCRYPTION_KEY || env.APP_ENCRYPTION_KEYS ? Vault.fromEnv(env) : null, files: env.FILES || null, baseUrl: env.PUBLIC_URL || "", config: { dohFetch: extra.environment?.egress ? guardFetch((...a) => fetch(...a), extra.environment.egress) : (...a) => fetch(...a), LAURA_LLM_KEY: env.LAURA_LLM_KEY || "", LAURA_LLM_ENDPOINT: env.LAURA_LLM_ENDPOINT || "", LAURA_MODEL: env.LAURA_MODEL || "", LAURA_TIMEOUT_MS: env.LAURA_TIMEOUT_MS || "", LAURA_ACTOR_SECRET: env.LAURA_ACTOR_SECRET || "", META_APP_ID: env.META_APP_ID || "", META_APP_SECRET: env.META_APP_SECRET || "", META_SCOPES: env.META_SCOPES || "", META_API_VERSION: env.META_API_VERSION || "", CHARGILY_SECRET_KEY: env.CHARGILY_SECRET_KEY || "", CHARGILY_WEBHOOK_SECRET: env.CHARGILY_WEBHOOK_SECRET || "", CHARGILY_MODE: env.CHARGILY_MODE || "test" },
  modules: [platformModule([...new Set(extra.modules.flatMap((m) => m.providers ?? []))]), ...extra.modules] });

/* إقلاع محروس: (1) تحقق إعدادات البيئة (فشل مُغلَق، بلا قيم في الرسائل) (2) بيئة غير الإنتاج: حارس الخروج + وحدة Beta + بيانات الإصدار (3) هوية القاعدة: pf_meta.environment يجب أن تطابق ENVIRONMENT
   (Beta تشترطها؛ الإنتاج يتسامح مع غيابها توافقاً ويرفض عند وجودها بقيمة مخالفة). الإنتاج بلا ENVIRONMENT = سلوكه القائم تماماً. */
const egressStats = { blocked: 0, last: null };                                                                  // عدّاد الحجب على مستوى الـisolate
const identityOk = new WeakMap();                                                                             // مفتاح الذاكرة = ربط القاعدة نفسه (ربط جديد/مختلف ← فحص جديد)
async function checkIdentity(db, name, required) {
  let row = null; try { row = await db.one("SELECT v FROM pf_meta WHERE k='environment'"); } catch { if (required) throw new Error("env_identity_unreadable"); return; }
  if (!row) { if (required) throw new Error("env_identity_missing:" + name); return; }
  if (row.v !== name) throw new Error("env_identity_mismatch:" + name + "!=" + row.v);
}
async function boot(env) {
  const vars = {}; for (const [k, v] of Object.entries(env ?? {})) if (typeof v === "string") vars[k] = v;
  const g = validateEnvironment(REGISTRY, vars); if (g.errors.length) throw new Error("env_guard:" + g.errors.map((x) => x.code + (x.var ? "@" + x.var : "")).join(","));
  const nonProd = g.name !== "production";
  const environment = nonProd ? { name: g.name, egressStats, egress: egressPolicy(REGISTRY, vars), livePrefixes: REGISTRY.never_outside_production?.live_credential_prefixes ?? [], publicOrigins: REGISTRY.environments?.[g.name]?.app_host ? ["https://" + REGISTRY.environments[g.name].app_host] : [], allowProviders: ["chargily", ...String(vars.BETA_ALLOW_PROVIDERS ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)], version: vars.APP_VERSION || null, sha: vars.GIT_SHA || null, schemaHash: vars.SCHEMA_HASH || null } : null;
  const app = build0(env, { environment, modules: nonProd ? [...MODULES, beta] : MODULES });
  const dbKey = env?.DB && typeof env.DB === "object" ? env.DB : null;
  if (!dbKey || identityOk.get(dbKey) !== g.name) { await checkIdentity(app.db, g.name, nonProd); if (dbKey) identityOk.set(dbKey, g.name); }
  return app;
}
export default {
  async fetch(request, env) {
    const u = new URL(request.url), headers = {}; request.headers.forEach((v, k) => (headers[k] = v));
    const raw = ["GET", "HEAD", "DELETE"].includes(request.method) ? "" : (await request.text()).slice(0, 262145);
    let res;
    try { res = await (await boot(env)).handle(request.method, u.pathname, Object.fromEntries(u.searchParams), headers, raw, request.headers.get("cf-connecting-ip") || "0"); }
    catch (e) { console.error("boot:", e?.message); res = { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" }, body: '{"error":{"code":"unavailable","message":"الخدمة غير جاهزة"}}' }; }
    return new Response(res.status === 204 ? null : (res.stream ?? res.body), { status: res.status, headers: res.headers });
  },
  async scheduled(_e, env, ctx) { ctx.waitUntil(boot(env).then((a) => a.cron()).then((r) => console.log("cron", JSON.stringify(r))).catch((e) => console.error("boot:", e?.message))); },
};
