// ملاحظة (v1.89.41): الرصيد والرموز صارا في جدول saas_sites (platform/sql/schema.sql) وتديرهما لوحة المزوّد (saas/index.html ← API)؛ ai-credits.sql القديم لم يعد مطلوباً.
// وسيط الذكاء الاصطناعي لمواقع SaaS: يستقبل طلب موقع (بتوكنه)، يخصم من رصيده، يستدعي Gemini بمفتاحك أنت، ويعيد النتيجة.
// يُنشر في مشروع Supabase الخاص بك (مزوّد الخدمة): Edge Functions ← Deploy a new function ← الاسم: ai ← الصق هذا الكود ← أطفئ Verify JWT ← Deploy.
// الأسرار (Edge Functions ← Secrets): GEMINI_API_KEY (إلزامي)، AI_TEXT_MODELS و AI_IMAGE_MODELS (اختياريان: قوائم مفصولة بفواصل).
// الأمان: التوكن سرّي لكل موقع؛ لا يُخصم رصيد طلب فشل عند Google؛ تُمرَّر مفاتيح إعداد محدّدة فقط.
const URL_ = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GKEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const list = (v: string | undefined, d: string) => (v ?? d).split(",").map((s) => s.trim()).filter(Boolean);
const MODELS: Record<string, string[]> = {
  text: list(Deno.env.get("AI_TEXT_MODELS"), "gemini-2.5-flash,gemini-2.5-flash-lite"),
  image: list(Deno.env.get("AI_IMAGE_MODELS"), "gemini-2.5-flash-image"),
};
const CFG_KEYS = ["temperature", "responseMimeType", "responseModalities", "imageConfig", "maxOutputTokens", "topP"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const rpc = async (fn: string, args: Record<string, unknown>) => {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  return r.ok ? await r.json().catch(() => null) : null;
};
// تشديد (v1.89.330): قائمة سماح لأجزاء الطلب، سقف للصور والمخرجات، وحدّ معدّل لكل توكن (في ذاكرة النسخة الحيّة؛ الحدّ الدائم هو رصيد الموقع).
const RATE_PER_MIN: Record<string, number> = { text: 40, image: 12 };
const hits = new Map<string, number[]>();
function limited(token: string, kind: string): boolean {
  const k = token + ":" + kind, now = Date.now(), a = (hits.get(k) ?? []).filter((t) => now - t < 60_000);
  if (a.length >= RATE_PER_MIN[kind]) { hits.set(k, a); return true; }
  a.push(now); hits.set(k, a);
  if (hits.size > 2000) hits.delete(hits.keys().next().value as string);
  return false;
}
// جزء مسموح = نص، أو صورة مضمّنة بنوع image/* فقط (لا file_data ولا روابط ولا أي حقل آخر).
function cleanParts(parts: unknown[]): unknown[] | null {
  const out: unknown[] = []; let imgs = 0;
  for (const p of parts as any[]) {
    if (!p || typeof p !== "object") return null;
    if (typeof p.text === "string") { out.push({ text: p.text.slice(0, 60_000) }); continue; }
    const d = p.inline_data ?? p.inlineData;
    if (d && typeof d.data === "string" && /^image\/(png|jpe?g|webp)$/i.test(String(d.mime_type ?? d.mimeType ?? ""))) { if (++imgs > 6) return null; out.push({ inline_data: { mime_type: String(d.mime_type ?? d.mimeType).toLowerCase(), data: d.data } }); continue; }
    return null;
  }
  return out.length ? out : null;
}
const MSG: Record<string, string> = {
  rate_limited: "طلبات كثيرة في وقت قصير — انتظر قليلاً ثم أعد المحاولة",
  unknown_token: "توكن الموقع غير صالح", suspended: "الخدمة موقوفة لهذا الموقع — تواصل مع المزوّد",
  expired: "انتهت صلاحية اشتراك الذكاء الاصطناعي — فعّل اشتراكك لمتابعة الاستعمال", no_credits: "انتهى رصيدك من هذه الخدمة — فعّل اشتراكك لمتابعة الاستعمال", bad_kind: "نوع الطلب غير صحيح",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!GKEY) return json({ error: "not_configured" }, 500);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const token = String(b.token ?? ""), kind = String(b.kind ?? "");
  if (!/^[a-f0-9]{32,80}$/.test(token) || !MODELS[kind] || !Array.isArray(b.parts) || !b.parts.length) return json({ error: "bad_request" }, 400);
  if (JSON.stringify(b.parts).length > 8_000_000) return json({ error: "too_large" }, 413);
  const parts = cleanParts(b.parts); if (!parts) return json({ error: "bad_parts", message: "محتوى الطلب غير مقبول" }, 400);
  const cfg: Record<string, unknown> = {};
  for (const k of CFG_KEYS) if (b.cfg && k in b.cfg) cfg[k] = b.cfg[k];
  if (typeof cfg.maxOutputTokens === "number") cfg.maxOutputTokens = Math.max(1, Math.min(16384, cfg.maxOutputTokens));
  if (limited(token, kind)) return json({ error: "rate_limited", message: MSG.rate_limited }, 429);

  const ch = await rpc("saas_ai_charge", { p_token: token, p_kind: kind });
  if (!ch) return json({ error: "billing_unavailable" }, 502);
  if (!ch.ok) return json({ error: ch.reason, message: MSG[ch.reason] ?? "مرفوض" }, ch.reason === "unknown_token" ? 401 : 402);

  let last = 0;
  for (const m of MODELS[kind]) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GKEY },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: cfg }), signal: AbortSignal.timeout(110_000),
      });
      if (r.ok) return json({ ok: true, left: ch.left, model: m, data: await r.json() });
      last = r.status;
    } catch { last = 504; }
  }
  await rpc("saas_ai_refund", { p_token: token, p_kind: kind });            // لا يُحاسَب الموقع على طلب لم ينجح
  return json({ error: "upstream_failed", status: last, message: "تعذّر الذكاء الاصطناعي مؤقتاً — لم يُخصم من رصيدك" }, 502);
});
