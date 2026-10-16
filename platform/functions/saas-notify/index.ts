// إرسال الإشعارات الصادرة (بريد + واتساب) المعلّقة في saas_outbox. يُنشر في مشروع Supabase الخاص بك:
//   supabase functions deploy saas-notify --project-ref <ref>   (اترك Verify JWT مفعّلاً)
// الأسرار: RESEND_API_KEY + MAIL_FROM (مثال: "أليسوم <noreply@alyssumdz.com>" — نطاق موثَّق في Resend) للبريد؛
//          WA_TOKEN + WA_PHONE_ID (واتساب Cloud API من Meta) للواتساب، و WA_TEMPLATE + WA_LANG اختياريان:
//          الرسالة التي تبدأها المنصة خارج نافذة 24 ساعة تتطلب قالباً معتمداً من Meta بمتغيّر واحد {{1}} (نص الرسالة).
// الاستدعاء: زرّ «إرسال تلقائي» في لوحة المزوّد (بجلسة المدير)، أو مجدولاً بمفتاح الخدمة. ما لم يُضبط مزوّد تبقى رسائله «معلّقة» لترسلها يدوياً.
const URL_ = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "", FROM = Deno.env.get("MAIL_FROM") ?? "";
const WA_TOKEN = Deno.env.get("WA_TOKEN") ?? "", WA_PHONE = Deno.env.get("WA_PHONE_ID") ?? "";
const WA_TEMPLATE = Deno.env.get("WA_TEMPLATE") ?? "", WA_LANG = Deno.env.get("WA_LANG") ?? "ar";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const H = { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" };

async function isAdmin(bearer: string): Promise<boolean> {
  if (bearer === SRK) return true;
  const r = await fetch(`${URL_}/rest/v1/rpc/is_saas_admin`, { method: "POST", headers: { apikey: ANON || SRK, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true;
}
async function sendEmail(to: string, subject: string, text: string): Promise<string | null> {
  if (!RESEND || !FROM) return "not_configured";
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM, to: [to], subject, text }) });
  return r.ok ? null : `resend ${r.status}`;
}
async function sendWa(to: string, text: string): Promise<string | null> {
  if (!WA_TOKEN || !WA_PHONE) return "not_configured";
  const body = WA_TEMPLATE
    ? { messaging_product: "whatsapp", to, type: "template", template: { name: WA_TEMPLATE, language: { code: WA_LANG }, components: [{ type: "body", parameters: [{ type: "text", text: text.replace(/\s*\n\s*/g, " | ").slice(0, 900) }] }] } }
    : { messaging_product: "whatsapp", to, type: "text", text: { body: text } };
  const r = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE}/messages`, { method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.ok ? null : `wa ${r.status}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer || !(await isAdmin(bearer))) return json({ error: "unauthorized" }, 401);
  const q = await fetch(`${URL_}/rest/v1/saas_outbox?status=eq.pending&order=id.asc&limit=50`, { headers: H });
  const rows: any[] = q.ok ? await q.json() : [];
  let sent = 0, failed = 0, skipped = 0;
  for (const m of rows) {
    const err = m.channel === "email" ? await sendEmail(m.to_addr, m.subject, m.body) : await sendWa(m.to_addr, m.body);
    if (err === "not_configured") { skipped++; continue; }
    const patch = err ? { status: "failed", error: err, attempts: m.attempts + 1 } : { status: "sent", error: null, attempts: m.attempts + 1, sent_at: new Date().toISOString() };
    await fetch(`${URL_}/rest/v1/saas_outbox?id=eq.${m.id}`, { method: "PATCH", headers: H, body: JSON.stringify(patch) });
    err ? failed++ : sent++;
  }
  return json({ ok: true, sent, failed, skipped, total: rows.length, email_ready: !!(RESEND && FROM), wa_ready: !!(WA_TOKEN && WA_PHONE) });
});
