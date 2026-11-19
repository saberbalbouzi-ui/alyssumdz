/* Worker المزامنة المستمرة (Beta فقط): cron كل دقيقة ⇒ runSync (لا يعتمد على تشغيل يدوي). مسارات HTTP (كلها بـBearer SYNC_TOKEN عدا /health):
     GET /health · GET /status (JSON) · GET / (لوحة مراقبة) · POST /run?kind=incremental|reconcile · POST /restore {path}
   الارتباطات: DB (D1: alyssum-beta-sync) · FILES (KV: alyssum-beta-web-files) · WEB (service binding على alyssum-beta-web للتحقق الحيّ)
   المتغيرات (plain_text): SOURCE_REPO, SOURCE_REF, BETA_APP_HOST, BETA_SUPABASE_URL, BETA_SUPABASE_ANON_KEY, REGISTRY_JSON (never_outside_production فقط), ENVIRONMENT=beta. السرّ: SYNC_TOKEN.
   لا رمز كتابة لأي مستودع ولا مفتاح Production: المصدر علني للقراءة فقط. يرفض العمل إن لم تكن ENVIRONMENT=beta. */
import { GitHubSource } from "./github.js";
import { KVTarget } from "./targets.js";
import { D1BindingDb, meta } from "./db.js";
import { makeSanitizer } from "./rules.js";
import { runSync, syncStatus, restoreDeleted } from "./engine.js";

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff" } });
const tokEq = (a, b) => { if (!a || !b || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const authed = (req, env) => tokEq((req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, ""), env.SYNC_TOKEN ?? "");

function ctxOf(env) {
  if (env.ENVIRONMENT !== "beta") throw new Error("guard: هذا Worker لـBeta فقط (ENVIRONMENT!=beta)");
  const reg = JSON.parse(env.REGISTRY_JSON); const host = env.BETA_APP_HOST; if (!host || /alyssumdz\.com|alyssumhub\.fyi/.test(host)) throw new Error("guard: BETA_APP_HOST غير صالح");
  const san = makeSanitizer({ registry: { never_outside_production: reg }, beta: { appHost: host, supabaseUrl: env.BETA_SUPABASE_URL, anonKey: env.BETA_SUPABASE_ANON_KEY, waPlaceholder: "213000000000" } });
  return { source: new GitHubSource({ repo: env.SOURCE_REPO, ref: env.SOURCE_REF || "main" }), target: new KVTarget({ kv: env.FILES, web: env.WEB, base: "https://" + host }), db: new D1BindingDb(env.DB), san };
}
export async function tick(env, kind) {
  const c = ctxOf(env); const n = Number(await meta.get(c.db, "ticks", 0)) + 1; await meta.set(c.db, "ticks", n);
  const k = kind ?? (n % 10 === 0 ? "reconcile" : "incremental");     // كل عاشر تشغيل تسوية دورية بفحص حيّ
  return runSync({ ...c, kind: k });
}
const PAGE = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مزامنة Beta</title><meta name="robots" content="noindex">
<style>body{font:14px/1.6 system-ui,Tahoma;margin:16px;background:#0b1410;color:#e7efe9}h1{font-size:18px}table{border-collapse:collapse;width:100%;margin:8px 0 18px}td,th{border:1px solid #2a3a31;padding:4px 8px;text-align:right;font-size:12px}th{background:#14221b}.ok{color:#6ee7a0}.bad{color:#ff8a8a}.k{display:inline-block;margin:0 0 6px 12px;padding:4px 10px;background:#14221b;border-radius:8px}button{padding:6px 12px}code{direction:ltr;unicode-bidi:embed}</style>
<h1>لوحة مراقبة المزامنة: اللوحة التقليدية ← Beta</h1><p id=st>…</p><p><button id=run>تشغيل تسوية الآن</button> <span id=msg></span></p><div id=out></div>
<script>let T=sessionStorage.getItem("t")||prompt("رمز المراقبة");sessionStorage.setItem("t",T||"");const H={Authorization:"Bearer "+T};
const E=v=>String(v??"").replace(/[<>&"']/g,m=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[m]));
const tb=(rows,cols)=>"<table><tr>"+cols.map(c=>"<th>"+c+"</th>").join("")+"</tr>"+(rows.length?rows.map(r=>"<tr>"+cols.map(c=>"<td>"+E(r[c])+"</td>").join("")+"</tr>").join(""):"<tr><td colspan="+cols.length+">—</td></tr>")+"</table>";
async function load(){const r=await fetch("/status",{headers:H});if(r.status!=200){st.textContent="غير مصرّح";return}const s=await r.json();
st.innerHTML='<span class="k '+(s.in_sync?"ok":"bad")+'">'+(s.in_sync?"متزامن":"غير متزامن")+'</span><span class=k>رأس المصدر: <code>'+(s.head_seen||"").slice(0,8)+'</code></span><span class=k>آخر تطبيق: '+(s.synced_at||"—")+'</span><span class=k>آخر تشغيل: '+(s.last_run||"—")+'</span><span class=k>عناصر: '+s.items_total+'</span><span class=k>revision: '+s.rev+'</span><span class=k>وسائط: '+s.media.synced+' (غير متزامنة '+s.media.not_synced+')</span><span class=k>إعادة محاولات: '+s.retries+'</span><span class=k>محذوفات قابلة للاستعادة: '+s.trash+'</span>'+(s.last_error?'<div class=bad>آخر خطأ: '+E(s.last_error)+'</div>':"");
out.innerHTML="<h3>حالات العناصر</h3>"+tb(Object.entries(s.items).map(([state,n])=>({state,n})),["state","n"])+"<h3>عمليات فاشلة</h3>"+tb(s.failed_events,["path","op","attempts","error","ts"])+"<h3>محجورة (سرّ/هوية)</h3>"+tb(s.quarantined,["path","reason","updated_at"])+"<h3>فروقات مكتشفة</h3>"+tb(s.drift_failed,["path","reason"])+"<h3>آخر التشغيلات</h3>"+tb(s.runs,["id","ts","kind","head","planned","applied","failed","quarantined","diffs","ms","error"])+"<h3>آخر الأحداث</h3>"+tb(s.recent_events,["seq","ts","path","op","status","attempts","rev"])}
run.onclick=async()=>{msg.textContent="…";const r=await fetch("/run?kind=reconcile",{method:"POST",headers:H});msg.textContent=r.status+" "+(await r.text()).slice(0,140);load()};load();setInterval(load,15000)</script></html>`;

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(tick(env).catch((e) => console.error("sync:", e?.stack || e))); },
  async fetch(req, env) {
    const u = new URL(req.url);
    try {
      if (u.pathname === "/health") return J({ ok: true, service: "beta-sync", environment: env.ENVIRONMENT });
      if (u.pathname === "/" && req.method === "GET") return new Response(PAGE, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
      if (!authed(req, env)) return J({ error: "unauthorized" }, 401);
      const c = ctxOf(env);
      if (u.pathname === "/status" && req.method === "GET") return J(await syncStatus(c.db));
      if (u.pathname === "/run" && req.method === "POST") { const kind = u.searchParams.get("kind") ?? "incremental"; if (!["incremental", "reconcile", "full"].includes(kind)) return J({ error: "kind" }, 400); return J(await tick(env, kind)); }
      if (u.pathname === "/restore" && req.method === "POST") { const b = await req.json().catch(() => ({})); return J(await restoreDeleted({ target: c.target, db: c.db, path: String(b.path ?? "") })); }
      return J({ error: "not_found" }, 404);
    } catch (e) { return J({ error: "server_error", detail: String(e.message ?? e).slice(0, 160) }, 500); }
  },
};
