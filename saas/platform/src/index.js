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
import { payments } from "./modules/payments.js";
import { sms } from "./modules/sms.js";
import { Vault } from "./crypto.js";

const MODULES = [adminModule, antifraud, capi, hooks, digital, whatsapp, sheets, ab, ai, carts, payments, sms];
const build = (env) => createPlatform({ d1: env.DB, secret: env.PLATFORM_SECRET, adminToken: env.ADMIN_TOKEN || "", vault: env.APP_ENCRYPTION_KEY || env.APP_ENCRYPTION_KEYS ? Vault.fromEnv(env) : null, files: env.FILES || null, baseUrl: env.PUBLIC_URL || "",
  modules: [platformModule([...new Set(MODULES.flatMap((m) => m.providers ?? []))]), ...MODULES] });
export default {
  async fetch(request, env) {
    const u = new URL(request.url), headers = {}; request.headers.forEach((v, k) => (headers[k] = v));
    const raw = ["GET", "HEAD", "DELETE"].includes(request.method) ? "" : (await request.text()).slice(0, 262145);
    let res;
    try { res = await build(env).handle(request.method, u.pathname, Object.fromEntries(u.searchParams), headers, raw, request.headers.get("cf-connecting-ip") || "0"); }
    catch (e) { console.error("boot:", e?.message); res = { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" }, body: '{"error":{"code":"unavailable","message":"الخدمة غير جاهزة"}}' }; }
    return new Response(res.status === 204 ? null : (res.stream ?? res.body), { status: res.status, headers: res.headers });
  },
  async scheduled(_e, env, ctx) { ctx.waitUntil(build(env).cron().then((r) => console.log("cron", JSON.stringify(r)))); },
};
