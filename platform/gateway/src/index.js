import { createApp } from "./app.js";
import { Vault } from "./crypto.js";
import DOCS from "./docs.js";
import REGISTRY from "./env-registry.js";
import { validateEnvironment, egressPolicy, guardFetch } from "./envguard.js";

/** مُرحِّل خارج Cloudflare لطلبات الشركات (ياليدين ترفض عناوين Workers بـ403). يُفعَّل بوجود RELAY_URL وRELAY_SECRET. */
function relayFetch(env) {
  if (!env.RELAY_URL || !env.RELAY_SECRET) return null;
  return async (url, init = {}) => {
    const r = await fetch(env.RELAY_URL, { method: "POST", signal: init.signal, headers: { "Content-Type": "application/json", "x-relay-secret": env.RELAY_SECRET }, body: JSON.stringify({ url, method: init.method, headers: init.headers, body: init.body }) });
    const j = await r.json().catch(() => ({}));
    if (r.status !== 200 || typeof j.status !== "number") throw new Error("relay_" + r.status + (j.error ? ":" + j.error : ""));
    return { status: j.status, text: async () => j.body ?? "" };
  };
}
/** إصدار حدث شحن إلى ناقل المنصة عبر Service Binding (الرمز الإداري) — يرجع رمز HTTP (0 = تعذّر الاتصال) */
function platformEmit(env) {
  if (!env.PLATFORM || !env.PLATFORM_ADMIN_TOKEN) return null;
  return async (body) => (await env.PLATFORM.fetch((env.PLATFORM_URL || "https://api.alyssumhub.fyi") + "/admin/events", { method: "POST", headers: { Authorization: "Bearer " + env.PLATFORM_ADMIN_TOKEN, "Content-Type": "application/json", "X-Actor": "gateway" }, body: JSON.stringify(body) })).status;
}
function build(env, policy) {
  /* بيئة غير الإنتاج: كل اتصال صادر (شركات التوصيل/المُرحِّل/DoH) عبر قائمة سماح صارمة — Beta لا تصل لأي شركة توصيل حقيقية؛ الإنتاج: policy=null بلا تغيير */
  const doh = policy ? guardFetch((...a) => fetch(...a), policy) : (...a) => fetch(...a), carrier = policy ? guardFetch(relayFetch(env) ?? ((...a) => fetch(...a)), policy) : relayFetch(env);
  return createApp({ dohFetch: doh, carrierFetch: carrier, platformEmit: platformEmit(env), d1: env.DB, vault: Vault.fromEnv(env), baseUrl: env.PUBLIC_URL || "", adminToken: env.ADMIN_TOKEN || "", docsHtml: DOCS });
}

/* إقلاع محروس (انظر platform/api/src/index.js): تحقق إعدادات البيئة + هوية القاعدة pf_meta('environment') (Beta تشترطها؛ الإنتاج يتسامح مع غيابها ويرفض المخالفة) */
const identityOk = new WeakMap();
async function boot(env) {
  const vars = {}; for (const [k, v] of Object.entries(env ?? {})) if (typeof v === "string") vars[k] = v;
  const g = validateEnvironment(REGISTRY, vars); if (g.errors.length) throw new Error("env_guard:" + g.errors.map((x) => x.code + (x.var ? "@" + x.var : "")).join(","));
  const nonProd = g.name !== "production", key = env?.DB && typeof env.DB === "object" ? env.DB : null;
  if (!key || identityOk.get(key) !== g.name) {
    let row = null; try { row = await env.DB.prepare("SELECT v FROM pf_meta WHERE k='environment'").first(); } catch { if (nonProd) throw new Error("env_identity_unreadable"); }
    if (!row && nonProd) throw new Error("env_identity_missing:" + g.name); if (row && row.v !== g.name) throw new Error("env_identity_mismatch:" + g.name + "!=" + row.v);
    if (key) identityOk.set(key, g.name);
  }
  return build(env, nonProd ? egressPolicy(REGISTRY, vars) : null);
}
export default {
  async fetch(request, env) {
    const u = new URL(request.url); const headers = {}; request.headers.forEach((v, k) => (headers[k] = v));
    const query = Object.fromEntries(u.searchParams);
    const raw = ["GET", "HEAD", "DELETE"].includes(request.method) ? "" : (await request.text()).slice(0, 262145);
    let res;
    try { res = await (await boot(env)).handle(request.method, u.pathname, query, headers, raw, request.headers.get("cf-connecting-ip") || "0"); }
    catch (e) { console.error("boot:", e?.message); res = { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" }, body: '{"error":{"code":"unavailable","message":"الخدمة غير جاهزة"}}' }; }
    return new Response(res.body, { status: res.status, headers: res.headers });
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(boot(env).then((a) => a.cron()).then((r) => console.log("cron", JSON.stringify(r))).catch((e) => console.error("boot:", e?.message)));
    // نبضة منصة API: cron هذا الـWorker يعمل كل دقيقة على الحساب بينما لم يُطلَق cron الـWorker الجديد؛ الربط بخدمة داخلية (Service Binding) بلا إنترنت
    if (env.PLATFORM && env.PLATFORM_ADMIN_TOKEN) ctx.waitUntil(env.PLATFORM.fetch((env.PLATFORM_URL || "https://api.alyssumhub.fyi") + "/admin/cron", { method: "POST", headers: { Authorization: "Bearer " + env.PLATFORM_ADMIN_TOKEN, "X-Actor": "gateway-tick" } }).then(async (r) => console.log("platform-cron", r.status)).catch((e) => console.error("platform-cron", e?.message)));
  },
};
