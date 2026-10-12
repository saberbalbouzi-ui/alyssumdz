import { createPlatform, adminModule } from "./core.js";
import { antifraud } from "./modules/antifraud.js";

const build = (env) => createPlatform({ d1: env.DB, secret: env.PLATFORM_SECRET, adminToken: env.ADMIN_TOKEN || "", modules: [adminModule, antifraud] });
export default {
  async fetch(request, env) {
    const u = new URL(request.url), headers = {}; request.headers.forEach((v, k) => (headers[k] = v));
    const raw = ["GET", "HEAD", "DELETE"].includes(request.method) ? "" : (await request.text()).slice(0, 262145);
    let res;
    try { res = await build(env).handle(request.method, u.pathname, Object.fromEntries(u.searchParams), headers, raw, request.headers.get("cf-connecting-ip") || "0"); }
    catch (e) { console.error("boot:", e?.message); res = { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" }, body: '{"error":{"code":"unavailable","message":"الخدمة غير جاهزة"}}' }; }
    return new Response(res.body, { status: res.status, headers: res.headers });
  },
  async scheduled(_e, env, ctx) { ctx.waitUntil(build(env).cron().then((r) => console.log("cron", JSON.stringify(r)))); },
};
