import { createApp } from "./app.js";
import { Vault } from "./crypto.js";
import DOCS from "./docs.js";

function build(env) {
  return createApp({ d1: env.DB, vault: Vault.fromEnv(env), baseUrl: env.PUBLIC_URL || "", adminToken: env.ADMIN_TOKEN || "", docsHtml: DOCS });
}
export default {
  async fetch(request, env) {
    const u = new URL(request.url); const headers = {}; request.headers.forEach((v, k) => (headers[k] = v));
    const query = Object.fromEntries(u.searchParams);
    const raw = ["GET", "HEAD", "DELETE"].includes(request.method) ? "" : (await request.text()).slice(0, 262145);
    let res;
    try { res = await build(env).handle(request.method, u.pathname, query, headers, raw, request.headers.get("cf-connecting-ip") || "0"); }
    catch (e) { console.error("boot:", e?.message); res = { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" }, body: '{"error":{"code":"unavailable","message":"الخدمة غير جاهزة"}}' }; }
    return new Response(res.body, { status: res.status, headers: res.headers });
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(build(env).cron().then((r) => console.log("cron", JSON.stringify(r)))); },
};
