import { createApp } from "./app.js";
import { Vault } from "./crypto.js";
import DOCS from "./docs.js";

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
function build(env) {
  return createApp({ carrierFetch: relayFetch(env), d1: env.DB, vault: Vault.fromEnv(env), baseUrl: env.PUBLIC_URL || "", adminToken: env.ADMIN_TOKEN || "", docsHtml: DOCS });
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
