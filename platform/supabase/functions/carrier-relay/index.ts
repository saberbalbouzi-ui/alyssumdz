// مُرحِّل طلبات الشركات لبوابة الشحن: بعض الشركات (ياليدين) ترفض (403) الطلبات الصادرة من Cloudflare Workers،
// فتمرّر البوابة طلباتها عبر هذه الدالة (خارج Cloudflare). مصادقة بسرّ مشترك RELAY_SECRET فقط، https ومضيفون مسموحون فقط.
// النشر: functions/deploy?slug=carrier-relay مع إطفاء Verify JWT. الأسرار: RELAY_SECRET و(اختياري) COURIER_HOSTS.
const SECRET = Deno.env.get("RELAY_SECRET") ?? "";
const HOSTS = (Deno.env.get("COURIER_HOSTS") ?? "api.yalidine.app,yalidine.app,ecotrack.dz,procolis.com,zrexpress.dz,maystro-delivery.com,noest-dz.com,dhd-dz.com,conexlog-dz.com,zimou.express,hhd.dz,anderson-ecommerce.com,ecom-delivery.com,elogistia.com,48hexpress.com").split(",").map((s) => s.trim()).filter(Boolean);
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
function eq(a: string, b: string) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!SECRET || !eq(req.headers.get("x-relay-secret") ?? "", SECRET)) return json({ error: "unauthorized" }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  let u: URL; try { u = new URL(String(b.url ?? "")); } catch { return json({ error: "bad_url" }, 400); }
  // المضيف مطابق تماماً لقائمة مسموحة (أو نطاق فرعي لها)؛ شركات Ecotrack ببادئات مختلفة تُضاف عبر COURIER_HOSTS
  if (u.protocol !== "https:" || u.username || u.password || !HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h))) return json({ error: "host_not_allowed", host: u.hostname }, 400);
  const method = String(b.method ?? "GET").toUpperCase(); if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) return json({ error: "method" }, 400);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries((b.headers ?? {}) as Record<string, unknown>)) if (/^[A-Za-z0-9-]{1,40}$/.test(k) && !/[\r\n]/.test(String(v))) headers[k] = String(v);
  try {
    const r = await fetch(u.toString(), { method, headers, body: method === "GET" || method === "DELETE" || b.body == null ? undefined : String(b.body), redirect: "manual", signal: AbortSignal.timeout(25000) });
    return json({ status: r.status, body: (await r.text()).slice(0, 2000000) });
  } catch (e) { return json({ error: "upstream_failed", detail: String(e).slice(0, 120) }, 502); }
});
