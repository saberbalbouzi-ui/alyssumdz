// Webhook ZR Express (المنصة الجديدة api.zrexpress.app) ⟵ يحدّث حالة الطلب في Supabase لحظياً.
// الأحداث: parcel.state.updated | parcel.state.situation.created | parcel.isReturn.updated
// الرابط الذي يوضع في لوحة ZR:  https://<project>.supabase.co/functions/v1/zr-webhook?s=<ZR_WEBHOOK_SECRET>
// النشر: supabase secrets set ZR_WEBHOOK_SECRET=<سر عشوائي طويل>   [اختياري: ZR_SIGNING_SECRET=whsec_… لتوقيع Svix]
//        supabase functions deploy zr-webhook --no-verify-jwt
// SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY يحقنهما Supabase تلقائياً (لا تضعهما في المستودع أبداً).
const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("ZR_WEBHOOK_SECRET") ?? "";
const SIGNING = Deno.env.get("ZR_SIGNING_SECRET") ?? "";
const RANK: Record<string, number> = { nouvelle: 0, confirmee: 1, expediee: 2, livree: 3 };
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();

function map(raw: string): string | null {
  const t = norm(raw);
  if (!t) return null;
  if (/annul|cancel/.test(t)) return null;                                    // الإلغاء يقرّره صاحب المتجر
  if (/^livre|livree|delivered|encaisse/.test(t)) return "livree";
  if (/retour|return|echec|refus/.test(t)) return "echec";
  if (/ready to dispatch|pret a expedier|pret|order received|commande recue|en preparation/.test(t)) return "confirmee";
  if (/sortie en livraison|en livraison|out for delivery|dispatch|transit|hub|centre|expedi|ramass|arriv|en cours|au bureau/.test(t)) return "expediee";
  return null;
}
// مرحلة رجوع الطرد (تطابق AdminWh.returnPhase في اللوحة)
function retPhase(raw: string): string {
  const t = norm(raw);
  if (!t) return "";
  if (/retourne\w*\s+(au|chez)\s+(le\s+)?(vendeur|expediteur|fournisseur)|retour\s+(recu|termine|livre|remis)|returned to (the )?(sender|seller|supplier)/.test(t)) return "received";
  if (/retour\s+a\s+retirer|retour.*(disponible|en attente de retrait|a recuperer)|return.*(ready|available)/.test(t)) return "ready";
  if (/retour|retourn|return|echec/.test(t)) return "transit";
  return "";
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const rest = (path: string, init: RequestInit = {}) => fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
const b64d = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** توقيع Svix: HMAC-SHA256(مفتاح whsec مفكوك base64، `${id}.${ts}.${body}`) → "v1,<base64>" */
async function svixOk(raw: string, h: Headers) {
  const id = h.get("svix-id"), ts = h.get("svix-timestamp"), sigs = h.get("svix-signature");
  if (!SIGNING || !id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 600) return false;          // حماية من إعادة الإرسال
  const k = await crypto.subtle.importKey("raw", b64d(SIGNING.replace(/^whsec_/, "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${id}.${ts}.${raw}`)))));
  return sigs.split(" ").some((p) => p.replace(/^v1,/, "") === mac);
}

Deno.serve(async (req) => {
  const q = new URL(req.url).searchParams;
  if (req.method === "GET") return new Response(JSON.stringify({ ok: true, webhook: "ready" }), { headers: { "Content-Type": "application/json" } });
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const raw = (await req.text()).slice(0, 1_000_000);
  const ok = (SECRET !== "" && q.get("s") === SECRET) || await svixOk(raw, req.headers);
  if (!ok) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  let j: any; try { j = JSON.parse(raw); } catch { return new Response(JSON.stringify({ error: "bad_json" }), { status: 400 }); }
  const evt = String(j?.eventType ?? "");
  if (evt && !["parcel.state.updated", "parcel.state.situation.created", "parcel.isReturn.updated"].includes(evt)) return new Response(JSON.stringify({ ok: true, ignored: evt }), { headers: { "Content-Type": "application/json" } });
  const d = j?.data && typeof j.data === "object" ? j.data : j;
  const trk = String(d?.trackingNumber ?? "");
  const rawSt = String(d?.state?.description || d?.state?.name || "") + (d?.isReturn === true ? " retour" : "");
  const oid = String(d?.externalId ?? "");
  let row: any = null;
  if (/^[A-Za-z0-9._-]{4,40}$/.test(trk)) {
    const r = await rest(`orders?note=ilike.*${encodeURIComponent(trk)}*&select=id,status,note&limit=5`);
    for (const x of (await r.json()) as any[]) { const m = /🚚[a-z0-9_]+:([A-Za-z0-9._-]+)/.exec(x.note ?? ""); if (m && m[1] === trk) { row = x; break; } }
  }
  if (!row && /^[A-Za-z0-9._-]{1,40}$/.test(oid)) { const r = await rest(`orders?id=eq.${encodeURIComponent(oid)}&select=id,status,note`); row = ((await r.json()) as any[])[0] ?? null; }
  const nw = evt === "parcel.state.situation.created" ? null : map(rawSt);       // الحالات الفرعية (محاولة فاشلة…) لا تغيّر الحالة
  if (!row || !nw || ["livree", "annulee"].includes(row.status)) return new Response(JSON.stringify({ ok: true, updated: 0 }), { headers: { "Content-Type": "application/json" } });
  const allowed = nw === "echec" || (RANK[nw] ?? 0) > (RANK[row.status] ?? 0);
  let note: string | undefined;
  if (nw === "echec") {
    const ph = retPhase(rawSt), cur = /🔁(transit|ready|received)/.exec(row.note ?? "")?.[1] ?? "", rk: Record<string, number> = { "": 0, transit: 1, ready: 2, received: 3 };
    if (ph && (rk[ph] ?? 0) > (rk[cur] ?? 0)) note = ((row.note ?? "").replace(/🔁\w+\s*/g, "").replace(/\s+/g, " ").trim() + " 🔁" + ph).trim();
  }
  let updated = 0;
  if ((allowed && nw !== row.status) || note) {
    const body: Record<string, unknown> = {}; if (allowed && nw !== row.status) body.status = nw; if (note) body.note = note;
    await rest(`orders?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", body: JSON.stringify(body), headers: { Prefer: "return=minimal" } });
    updated++;
  }
  return new Response(JSON.stringify({ ok: true, updated }), { headers: { "Content-Type": "application/json" } });
});
