// Webhook «par état» لشركة DHD Livraison (منصة Ecotrack: platform.dhd-dz.com) ⟵ يحدّث حالة الطلب في Supabase لحظياً.
// الرابط الذي يوضع في لوحة DHD ← Webhooks par état:  https://<project>.supabase.co/functions/v1/dhd-webhook?s=<السرّ>
//   السرّ = قيمة «webhook_secret_dhd» المحفوظة في إعدادات اللوحة (زر «إنشاء / عرض الرابط» لشركة DHD)؛ لا حاجة لمتغيّر سري جديد.
// (اختياري) DHD_SIGNING_SECRET: إن ضُبط وجاء الترويسة Signature: sha256=<HMAC-SHA256 للجسم> تُتحقَّق ويُرفض غير المطابق.
// النشر: supabase functions deploy dhd-webhook --no-verify-jwt     (SUPABASE_URL وSUPABASE_SERVICE_ROLE_KEY يحقنهما Supabase تلقائياً)
// الحمولة (وثيقة DHD): {event:"order.delivering", timestamp, data:{tracking, reference, state:{id,code,title,title_en}, driver:{name,phone}, changed_at}}
const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENV_SECRET = Deno.env.get("DHD_WEBHOOK_SECRET") ?? "";
const SIGNING = Deno.env.get("DHD_SIGNING_SECRET") ?? "";
const RANK: Record<string, number> = { nouvelle: 0, confirmee: 1, expediee: 2, livree: 3 };
const JSONH = { "Content-Type": "application/json" };
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const rest = (path: string, init: RequestInit = {}) => fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
const reply = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: JSONH });

/** معرّفات حالات DHD (وثيقتهم §4) ← حالة الطلب في اللوحة + مرحلة المرتجع */
const BY_ID: Record<number, [string, string]> = {
  1: ["confirmee", ""], 2: ["confirmee", ""], 3: ["confirmee", ""], 4: ["confirmee", ""],           // جاهز للشحن / للتحضير / En ramassage / مخزون قيد التحضير
  5: ["expediee", ""], 6: ["expediee", ""], 7: ["expediee", ""], 8: ["expediee", ""], 9: ["expediee", ""], 10: ["expediee", ""],   // Vers hub / En hub / Vers wilaya / En préparation / En livraison / Suspendus
  11: ["echec", "transit"], 12: ["echec", "transit"], 13: ["echec", "ready"], 14: ["echec", "received"], 15: ["echec", "transit"], 22: ["echec", "transit"], 16: ["echec", "received"], 20: ["echec", "received"],   // المرتجعات
  17: ["livree", ""], 18: ["livree", ""], 19: ["livree", ""], 21: ["livree", ""],                    // Livré non encaissé / encaissé non payé / paiement prêt / مؤرشف
};
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
/** احتياط إن لم يصل المعرّف: من الكود أو العنوان */
function byText(t0: string): [string, string] | null {
  const t = norm(t0);
  if (!t) return null;
  if (/annul|cancel/.test(t)) return null;
  if (/retours? (recu|archive|en stock)|returned (to sender|to warehouse|archived)|returned archived/.test(t)) return ["echec", "received"];
  if (/retours? prets?|returning to sender/.test(t)) return ["echec", "ready"];
  if (/retour|return/.test(t)) return ["echec", "transit"];
  if (/livre|delivered|paiement|payment|encaisse/.test(t) && !/en livraison/.test(t)) return ["livree", ""];
  if (/pret a expedier|pret a preparer|en ramassage|ready to|collecting|stock en preparation|preparing in stock/.test(t)) return ["confirmee", ""];
  if (/vers hub|en hub|vers wilaya|en preparation|en livraison|suspend|shipping to|in hub|preparing for delivery|delivering/.test(t)) return ["expediee", ""];
  return null;
}
const eqSafe = (a: string, b: string) => { if (a.length !== b.length || !a) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
async function storedSecret(): Promise<string> {
  try {
    const r = await rest("admin_kv?key=eq.webhook_secret_dhd&select=value&limit=1"), j = await r.json() as any[];
    const v = j?.[0]?.value; return typeof v === "string" ? v : "";
  } catch { return ""; }
}
async function hmacHex(secret: string, body: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body)))).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  if (req.method === "GET" || req.method === "HEAD") return reply({ ok: true, webhook: "ready", carrier: "dhd" });
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const raw = (await req.text()).slice(0, 1_000_000), tok = q.get("s") ?? "";
  const known = await storedSecret();
  if (!(eqSafe(tok, known) || eqSafe(tok, ENV_SECRET))) return reply({ error: "unauthorized" }, 401);
  const sig = req.headers.get("signature") ?? req.headers.get("x-signature") ?? "";
  if (SIGNING && sig && !eqSafe(sig.replace(/^sha256=/, ""), await hmacHex(SIGNING, raw))) return reply({ error: "bad_signature" }, 401);
  let j: any; try { j = JSON.parse(raw); } catch { return reply({ error: "bad_json" }, 400); }
  const d = j?.data && typeof j.data === "object" ? j.data : {};
  const trk = String(d?.tracking ?? ""), ref = String(d?.reference ?? "").replace(/^ALY-/, "");
  const sid = Number(d?.state?.id), m = BY_ID[sid] ?? byText(String(d?.state?.code ?? "") + " " + String(d?.state?.title ?? "") + " " + String(j?.event ?? ""));
  if (!m) return reply({ ok: true, ignored: String(j?.event ?? "") });
  const [nw, ph] = m;
  let row: any = null;
  if (/^[A-Za-z0-9._-]{4,40}$/.test(trk)) {
    const r = await rest(`orders?note=ilike.*${encodeURIComponent(trk)}*&select=id,status,note&limit=5`);
    for (const x of (await r.json()) as any[]) { const mm = /🚚[a-z0-9_]+:([A-Za-z0-9._-]+)/.exec(x.note ?? ""); if (mm && mm[1] === trk) { row = x; break; } }
  }
  if (!row && /^[A-Za-z0-9._-]{1,40}$/.test(ref)) { const r = await rest(`orders?id=eq.${encodeURIComponent(ref)}&select=id,status,note`); row = ((await r.json()) as any[])[0] ?? null; }
  if (!row || ["livree", "annulee"].includes(row.status)) return reply({ ok: true, updated: 0 });
  const allowed = nw === "echec" || (RANK[nw] ?? 0) > (RANK[row.status] ?? 0);
  let note: string | undefined;
  if (nw === "echec" && ph) {
    const cur = /🔁(transit|ready|received)/.exec(row.note ?? "")?.[1] ?? "", rk: Record<string, number> = { "": 0, transit: 1, ready: 2, received: 3 };
    if ((rk[ph] ?? 0) > (rk[cur] ?? 0)) note = ((row.note ?? "").replace(/🔁\w+\s*/g, "").replace(/\s+/g, " ").trim() + " 🔁" + ph).trim();
  }
  let updated = 0;
  if ((allowed && nw !== row.status) || note) {
    const body: Record<string, unknown> = {}; if (allowed && nw !== row.status) body.status = nw; if (note) body.note = note;
    await rest(`orders?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", body: JSON.stringify(body), headers: { Prefer: "return=minimal" } });
    updated++;
  }
  return reply({ ok: true, updated });
});
