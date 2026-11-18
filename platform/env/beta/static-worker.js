/* مضيف ساكن لواجهة Beta: Worker يقرأ الملفات من KV ويطبّق ترويسات Beta (noindex + nosniff + no-store للصفحات).
   نمطان: (1) إصدارات (الأساسي): مؤشرا `__ptr/ui` و`__ptr/templates` يحدّدان إصدار الواجهة والقوالب (منفصلين)، وبيان كل إصدار `__m/<مكوّن>/<إصدار>` = {مسار: بصمة}، والمحتوى `o/<بصمة>` غير قابل للتغيير ⇒ الرجوع = تبديل مؤشر.
   (2) قديم (احتياطي عند غياب المؤشر): مفتاح = المسار. يُنشر إلى Worker `alyssum-beta-web` فقط؛ لا يقرأ أي شيء من Production ولا يعرف أي سرّ. */
import OV from "./overrides.js";   // ملفات حديثة لم يتسع لها حدّ كتابة KV المجاني اليومي (يولّدها deploy-static.mjs؛ فارغة عادةً)
const TYPES = { html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", json: "application/json; charset=utf-8", webmanifest: "application/manifest+json", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif", ico: "image/x-icon", woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", txt: "text/plain; charset=utf-8", xml: "application/xml", mp4: "video/mp4", webm: "video/webm", pdf: "application/pdf", wasm: "application/wasm", glb: "model/gltf-binary", map: "application/json" };
const BASE = { "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "SAMEORIGIN" };
const ext = (k) => (k.split(".").pop() || "").toLowerCase();
const b64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0)).buffer;
const TPL = ["assets/pages/", "assets/img/tpl/", "p/_template/", "lp/"], isTpl = (p) => TPL.some((x) => p.startsWith(x)), CACHE = {}, TTL = 5000;   // ذاكرة قصيرة (5 ث): الرجوع يسري خلال ثوانٍ
async function loadMap(env, comp) {
  const now = Date.now(), c = CACHE[comp]; if (c && now - c.at < TTL) return c;
  const rel = await env.FILES.get("__ptr/" + comp); let map = null; if (rel) { const t = await env.FILES.get(`__m/${comp}/${rel}`); map = t ? JSON.parse(t) : null; }
  return (CACHE[comp] = { at: now, rel, map });
}
async function load(env, key) {
  if (OV[key]) return { key, v: b64(OV[key]) };
  const m = await loadMap(env, isTpl(key) ? "templates" : "ui");
  if (m.map) { const h = m.map[key]; if (!h) return null; const v = await env.FILES.get("o/" + h, { type: "arrayBuffer" }); return v ? { key, v } : null; }
  if (key.startsWith("o/")) return null;                       // لا تُكشَف كائنات المحتوى مباشرةً في النمط القديم
  const v = await env.FILES.get(key, { type: "arrayBuffer" }); return v ? { key, v } : null;
}
async function relHeaders(env) { const u = await loadMap(env, "ui"), t = await loadMap(env, "templates"); return { ...(u.rel ? { "X-Beta-Ui": u.rel } : {}), ...(t.rel ? { "X-Beta-Templates": t.rel } : {}) }; }
export default {
  async fetch(req, env) {
    if (req.method !== "GET" && req.method !== "HEAD") return new Response("method not allowed", { status: 405, headers: BASE });
    const u = new URL(req.url); let p = decodeURIComponent(u.pathname).replace(/^\/+/, "");
    if (p.includes("..") || p.startsWith("__")) return new Response("not found", { status: 404, headers: BASE });
    let hit = null;
    if (p === "" || p.endsWith("/")) hit = await load(env, p + "index.html");
    else { hit = await load(env, p); if (!hit && !/\.[a-z0-9]{1,6}$/i.test(p)) hit = await load(env, p + ".html"); if (!hit) { const d = await load(env, p + "/index.html"); if (d) return Response.redirect(u.origin + "/" + p + "/" + u.search, 301); } }   // /admin → admin.html كما تفعل Pages
    if (!hit) { const nf = await load(env, "404.html"); return new Response(req.method === "HEAD" ? null : nf ? nf.v : "not found", { status: 404, headers: { ...BASE, ...(await relHeaders(env)), "Content-Type": TYPES.html, "Cache-Control": "no-store" } }); }
    const e = ext(hit.key), html = e === "html";
    const h = { ...BASE, ...(await relHeaders(env)), "Content-Type": TYPES[e] || "application/octet-stream", "Cache-Control": html || e === "js" || e === "json" || hit.key === "sw.js" ? "no-cache" : "public, max-age=3600" };
    return new Response(req.method === "HEAD" ? null : hit.v, { status: 200, headers: h });
  },
};
