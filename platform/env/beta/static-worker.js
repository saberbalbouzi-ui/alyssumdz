/* مضيف ساكن لواجهة Beta: Worker يقرأ الملفات من KV (مفتاح = المسار بلا / أولية) ويطبّق ترويسات Beta (noindex + nosniff + no-store للصفحات).
   يُنشر بـplatform/env/beta/deploy-static.mjs إلى Worker `alyssum-beta-web` فقط؛ لا يقرأ أي شيء من Production ولا يعرف أي سرّ. */
const TYPES = { html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", json: "application/json; charset=utf-8", webmanifest: "application/manifest+json", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif", ico: "image/x-icon", woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", txt: "text/plain; charset=utf-8", xml: "application/xml", mp4: "video/mp4", webm: "video/webm", pdf: "application/pdf", wasm: "application/wasm", glb: "model/gltf-binary", map: "application/json" };
const BASE = { "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "SAMEORIGIN" };
const ext = (k) => (k.split(".").pop() || "").toLowerCase();
async function load(env, key) { const v = await env.FILES.get(key, { type: "arrayBuffer" }); return v ? { key, v } : null; }
export default {
  async fetch(req, env) {
    if (req.method !== "GET" && req.method !== "HEAD") return new Response("method not allowed", { status: 405, headers: BASE });
    const u = new URL(req.url); let p = decodeURIComponent(u.pathname).replace(/^\/+/, "");
    if (p.includes("..") || p.startsWith("__")) return new Response("not found", { status: 404, headers: BASE });
    let hit = null;
    if (p === "" || p.endsWith("/")) hit = await load(env, p + "index.html");
    else { hit = await load(env, p); if (!hit) { const d = await load(env, p + "/index.html"); if (d) return Response.redirect(u.origin + "/" + p + "/" + u.search, 301); } }
    if (!hit) { const nf = await load(env, "404.html"); return new Response(req.method === "HEAD" ? null : nf ? nf.v : "not found", { status: 404, headers: { ...BASE, "Content-Type": TYPES.html, "Cache-Control": "no-store" } }); }
    const e = ext(hit.key), html = e === "html";
    const h = { ...BASE, "Content-Type": TYPES[e] || "application/octet-stream", "Cache-Control": html || e === "js" || e === "json" || hit.key === "sw.js" ? "no-cache" : "public, max-age=3600" };
    return new Response(req.method === "HEAD" ? null : hit.v, { status: 200, headers: h });
  },
};
