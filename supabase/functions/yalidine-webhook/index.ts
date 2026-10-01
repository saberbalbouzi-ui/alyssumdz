// Webhook ياليدين ⟵ يحدّث حالة الطلب في Supabase لحظياً.
// النشر: supabase secrets set YALIDINE_WEBHOOK_SECRET=<السر الذي تعرضه لوحة الإدارة>
//        supabase functions deploy yalidine-webhook --no-verify-jwt
// SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY يحقنهما Supabase تلقائياً داخل الدالة (لا تضعهما في المستودع أبداً).
const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("YALIDINE_WEBHOOK_SECRET") ?? "";
const RANK: Record<string, number> = { nouvelle: 0, confirmee: 1, expediee: 2, livree: 3 };

function map(raw: string): string | null {
  const t = raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  if (!t) return null;
  if (/^livre/.test(t)) return "livree";
  if (/tentative.*(echou|echec)/.test(t)) return null;
  if (/echec livraison|^retour|retourne|echange.*(echou|echec)/.test(t)) return "echec";
  if (/pas encore|pret a expedier|preparation|a verifier/.test(t)) return "confirmee";
  if (/expedie|transfert|centre|localisation|vers wilaya|recu a wilaya|sorti en livraison|en attente du client|pret pour livreur|ramasse|en livraison/.test(t)) return "expediee";
  return null;
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const rest = (path: string, init: RequestInit = {}) => fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });

async function hmacOk(raw: string, sig: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(raw))), (b) => b.toString(16).padStart(2, "0")).join("");
  return mac === sig.replace(/^sha256=/i, "").toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "GET") return new Response(JSON.stringify({ ok: true, webhook: "ready" }), { headers: { "Content-Type": "application/json" } });
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const raw = (await req.text()).slice(0, 1_000_000);
  const given = new URL(req.url).searchParams.get("s") ?? "";
  let ok = SECRET !== "" && given === SECRET;
  if (!ok && SECRET) {
    for (const h of ["x-yalidine-signature", "x-signature", "x-hub-signature-256"]) {
      const sig = req.headers.get(h); if (sig && await hmacOk(raw, sig)) { ok = true; break; }
    }
  }
  if (!ok) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  let j: any; try { j = JSON.parse(raw); } catch { return new Response(JSON.stringify({ error: "bad_json" }), { status: 400 }); }
  const evt = String(j?.type ?? j?.event ?? j?.event_type ?? "");
  if (evt && !["parcel_status_updated", "parcel_payment_updated", "parcel_edited"].includes(evt)) return new Response(JSON.stringify({ ok: true, ignored: evt }), { headers: { "Content-Type": "application/json" } });
  const items: any[] = Array.isArray(j?.data) ? j.data : (j?.data && typeof j.data === "object" ? [j.data] : (Array.isArray(j) ? j : [j]));
  let updated = 0;
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const trk = String(it.tracking ?? it.tracking_number ?? it.parcel?.tracking ?? "");
    const rawSt = String(it.last_status ?? it.status ?? it.event_status ?? it.parcel?.last_status ?? j.last_status ?? j.status ?? "");
    const oid = String(it.order_id ?? "");
    let row: any = null;
    if (/^[A-Za-z0-9._-]{4,40}$/.test(trk)) {
      const r = await rest(`orders?note=ilike.*${encodeURIComponent(trk)}*&select=id,status,note&limit=5`);
      for (const x of (await r.json()) as any[]) { const m = /🚚[a-z0-9_]+:([A-Za-z0-9._-]+)/.exec(x.note ?? ""); if (m && m[1] === trk) { row = x; break; } }
    }
    if (!row && oid) { const r = await rest(`orders?id=eq.${encodeURIComponent(oid)}&select=id,status,note`); row = ((await r.json()) as any[])[0] ?? null; }
    const nw = map(rawSt);
    if (!row || !nw || ["livree", "annulee"].includes(row.status)) continue;
    const allowed = nw === "echec" || (RANK[nw] ?? 0) > (RANK[row.status] ?? 0);
    if (allowed && nw !== row.status) {
      await rest(`orders?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", body: JSON.stringify({ status: nw }), headers: { Prefer: "return=minimal" } });
      updated++;
    }
  }
  return new Response(JSON.stringify({ ok: true, updated }), { headers: { "Content-Type": "application/json" } });
});
