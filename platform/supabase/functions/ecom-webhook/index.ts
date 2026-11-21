// Webhook شركة E-com Delivery (ecom-dz.com API v2) ⟵ يحدّث حالة الطلب في Supabase لحظياً عند تغيّر وضعية الطرد.
// الرابط الذي يُسجَّل عندهم (PUT /webhook): https://<project>.supabase.co/functions/v1/ecom-webhook?s=<السرّ>
//   السرّ = قيمة «webhook_secret_ecomdelivery» المحفوظة في إعدادات اللوحة؛ ويُرسَل أيضاً كـ«secret» في PUT /webhook فيوقّع به E-com كل إشعار:
//   x-webhook-signature: sha256=<HMAC-SHA256(الجسم الخام، السرّ)> فنتحقق منها حين تصل.
// الحمولة: {id, date, tracking, ville, situation, id_situation, etat_logistique, id_etat_logistique, commentaire, colis:{id_externe, nom_complet, mobile_1, …}}
// النشر: supabase functions deploy ecom-webhook --no-verify-jwt   (SUPABASE_URL وSUPABASE_SERVICE_ROLE_KEY يحقنهما Supabase تلقائياً)
const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENV_SECRET = Deno.env.get("ECOM_WEBHOOK_SECRET") ?? "";
const RANK: Record<string, number> = { nouvelle: 0, confirmee: 1, expediee: 2, livree: 3 };
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const rest = (path: string, init: RequestInit = {}) => fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
const reply = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
const eqSafe = (a: string, b: string) => { if (a.length !== b.length || !a) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

/** وضعية E-com (Situation) وحالتها اللوجستية ← [حالة الطلب في اللوحة، مرحلة المرتجع] أو null للتجاهل (تنبيهات/تأكيد لا تغيّر الحالة) */
function mapText(sit: string, etat: string): [string, string] | null {
  const t = norm(sit + " " + etat);
  if (!t) return null;
  if (/commande annul|commande reporte|commande a relance|attend confirmation|ne reponde pas|attente du client|reporte|relance|erron|supprim/.test(t)) return null;
  if (/livree|encaisse|recouvert/.test(t) && !/annul/.test(t)) return ["livree", ""];
  if (/retour .*(recup|pret|disponible)/.test(t)) return ["echec", "ready"];
  if (/retourne au vendeur|retour (recu|termine|remis)|returned/.test(t)) return ["echec", "received"];
  if (/annul|retour|biz|echange/.test(t)) return ["echec", "transit"];
  if (/livraison|dispatch|au bureau|recuper|navette|sortir/.test(t)) return ["expediee", ""];
  if (/preparation|traitement|encours|confirm|pret a expedier/.test(t)) return ["confirmee", ""];
  return null;
}
async function storedSecret(): Promise<string> {
  try { const r = await rest("admin_kv?key=eq.webhook_secret_ecomdelivery&select=value&limit=1"), j = await r.json() as any[]; const v = j?.[0]?.value; return typeof v === "string" ? v : ""; } catch { return ""; }
}
async function hmacHex(secret: string, body: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body)))).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  if (req.method === "GET" || req.method === "HEAD") return reply({ ok: true, webhook: "ready", carrier: "ecomdelivery" });
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const raw = (await req.text()).slice(0, 1_000_000), tok = q.get("s") ?? "";
  const known = await storedSecret();
  const shortTok = known.length > 24 ? known.slice(0, 24) : "";
  if (!(eqSafe(tok, known) || (shortTok !== "" && eqSafe(tok, shortTok)) || eqSafe(tok, ENV_SECRET))) return reply({ error: "unauthorized" }, 401);
  const sig = (req.headers.get("x-webhook-signature") ?? "").replace(/^sha256=/, "");
  if (sig && known && !eqSafe(sig, await hmacHex(known, raw))) return reply({ error: "bad_signature" }, 401);
  let j: any; try { j = JSON.parse(raw); } catch { return reply({ error: "bad_json" }, 400); }
  const trk = String(j?.tracking ?? ""), ref = String(j?.colis?.id_externe ?? "").replace(/^ALY-/, "");
  const m = mapText(String(j?.situation ?? ""), String(j?.etat_logistique ?? ""));
  if (!m) return reply({ ok: true, ignored: String(j?.situation ?? "") });
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
