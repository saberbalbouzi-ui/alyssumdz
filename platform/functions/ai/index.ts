// ملاحظة (v1.89.41): الرصيد والرموز صارا في جدول saas_sites (platform/sql/schema.sql) وتديرهما لوحة المزوّد (saas/index.html ← API)؛ ai-credits.sql القديم لم يعد مطلوباً.
// وسيط الذكاء الاصطناعي لمواقع SaaS: يستقبل طلب موقع (بتوكنه)، يخصم من رصيده، يستدعي Gemini بمفتاحك أنت، ويعيد النتيجة.
// يُنشر في مشروع Supabase الخاص بك (مزوّد الخدمة): Edge Functions ← Deploy a new function ← الاسم: ai ← الصق هذا الكود ← أطفئ Verify JWT ← Deploy.
// الأسرار (Edge Functions ← Secrets): GEMINI_API_KEY (إلزامي)، AI_TEXT_MODELS و AI_IMAGE_MODELS (اختياريان: قوائم مفصولة بفواصل).
// الأمان: التوكن سرّي لكل موقع؛ لا يُخصم رصيد طلب فشل عند Google؛ تُمرَّر مفاتيح إعداد محدّدة فقط.
// وضع Pagebuilder Copilot (يُفعَّل بوجود run+req في الطلب؛ يتطلب platform/sql/copilot-ai-limits.sql — بيئة التطوير فقط): الحدود دائمة في قاعدة البيانات
// (مكالمات النموذج/الصور/المحاولات لكل تشغيل + سقف تكلفة يومي)، نفس req لا يُخصم مرتين، استرداد مرة واحدة عند الفشل/المهلة/الإلغاء/مخرجات غير صالحة،
// وتحقق خادمي من مخرجات النموذج (validate) بدل افتراض دعم responseSchema. الوضع القديم بلا run لا يتغير.
const URL_ = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GKEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const list = (v: string | undefined, d: string) => (v ?? d).split(",").map((s) => s.trim()).filter(Boolean);
const MODELS: Record<string, string[]> = {
  text: list(Deno.env.get("AI_TEXT_MODELS"), "gemini-flash-latest,gemini-3.8-flash,gemini-2.5-flash"),
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

// ───────── وضع Copilot: تحقق خادمي من المخرجات (بديل لافتراض responseSchema) ─────────
const COPILOT_OPS = ["section.add", "layer.add", "layer.update", "layer.delete", "layer.reorder", "layer.group", "layer.ungroup", "effect.set", "image.generate", "image.removeBg", "page.applySpec", "page.background"];
const FORBIDDEN_OP = /^(publish|page\.save|page\.publish|product\.|price\.|html\.|code\.|script\.|eval|page\.close|page\.delete)/i;
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const BAD_STR = /<\s*script|javascript\s*:|onerror\s*=|onload\s*=/i;
function deepScan(v: unknown, d = 0): string | null {
  if (d > 12) return "too_deep";
  if (typeof v === "string") return v.length > 6000 ? "string_too_long" : BAD_STR.test(v) ? "script_content" : null;
  if (Array.isArray(v)) { for (const x of v) { const e = deepScan(x, d + 1); if (e) return e; } return null; }
  if (v && typeof v === "object") { for (const k of Object.keys(v)) { if (BAD_KEYS.has(k)) return "forbidden_key"; const e = deepScan((v as any)[k], d + 1); if (e) return e; } }
  return null;
}
function textOf(data: any): string { const ps = data?.candidates?.[0]?.content?.parts; return Array.isArray(ps) ? ps.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("") : ""; }
function parseJson(t: string): unknown { t = t.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""); return JSON.parse(t); }
// يعيد { ok, parsed } أو { ok:false, why }
function validateOutput(mode: string, data: any): { ok: boolean; parsed?: unknown; why?: string } {
  if (mode === "image") {
    const ps = data?.candidates?.[0]?.content?.parts; const im = Array.isArray(ps) ? ps.map((p: any) => p?.inlineData ?? p?.inline_data).find((d: any) => d && typeof d.data === "string") : null;
    if (!im || !/^image\/(png|jpe?g|webp)$/i.test(String(im.mimeType ?? im.mime_type ?? "")) || im.data.length < 100 || im.data.length > 16_000_000) return { ok: false, why: "no_image" };
    return { ok: true };
  }
  let j: any; try { j = parseJson(textOf(data)); } catch { return { ok: false, why: "not_json" }; }
  if (JSON.stringify(j).length > 250_000) return { ok: false, why: "too_big" };
  const bad = deepScan(j); if (bad) return { ok: false, why: bad };
  if (mode === "copilot_plan") return j && typeof j === "object" && !Array.isArray(j) ? { ok: true, parsed: j } : { ok: false, why: "not_object" };
  if (mode === "copilot_envelope") {
    if (!j || typeof j !== "object" || !Array.isArray(j.ops) || !j.ops.length || j.ops.length > 120) return { ok: false, why: "bad_envelope" };
    for (const o of j.ops) {
      if (!o || typeof o !== "object" || typeof o.op !== "string") return { ok: false, why: "bad_op" };
      if (FORBIDDEN_OP.test(o.op)) return { ok: false, why: "forbidden_op" };
      if (!COPILOT_OPS.includes(o.op)) return { ok: false, why: "unknown_op" };
      if (o.args != null && (typeof o.args !== "object" || Array.isArray(o.args))) return { ok: false, why: "bad_args" };
    }
    return { ok: true, parsed: j };
  }
  return { ok: false, why: "bad_validate" };
}
const ID = /^[A-Za-z0-9_.-]{6,80}$/, KEYID = /^[A-Za-z0-9_.:-]{1,80}$/;
const LIMIT_STATUS: Record<string, number> = { duplicate_request: 409, run_llm_limit: 429, run_img_limit: 429, run_tries_limit: 429, daily_cap: 429, bad_request: 400, bad_kind: 400 };
Object.assign(MSG, {
  duplicate_request: "هذا الطلب نُفِّذ من قبل (معرّف مكرر)", run_llm_limit: "بلغ هذا التشغيل سقف مكالمات النموذج", run_img_limit: "بلغ هذا التشغيل سقف الصور",
  run_tries_limit: "بلغ سقف المحاولات لهذه الصورة", daily_cap: "بلغ موقعك السقف اليومي للتكلفة — يتجدد غداً", bad_request: "معرّفات التشغيل/الطلب غير صالحة",
});

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
  if (b.run != null || b.req != null) return await copilot(req, b, token, kind, parts, cfg);

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

// ───────── وضع Copilot ─────────
async function copilot(req: Request, b: any, token: string, kind: string, parts: unknown[], cfg: Record<string, unknown>) {
  const run = String(b.run ?? ""), rq = String(b.req ?? ""), key = b.key == null ? null : String(b.key), val = b.validate == null ? "" : String(b.validate);
  const badVal = kind === "text" ? !["copilot_plan", "copilot_envelope"].includes(val) : false;       // نص Copilot يجب أن يعلن نوع التحقق؛ الصور تُتحقَّق دائماً
  if (!ID.test(run) || !ID.test(rq) || (key !== null && !KEYID.test(key)) || badVal) return json({ error: "bad_request", message: MSG.bad_request }, 400);
  const vmode = kind === "image" ? "image" : val;
  const tmo = Math.max(1, Math.min(100, Number(b.timeout_s) || 60)) * 1000;
  const ch = await rpc("saas_ai_charge2", { p_token: token, p_kind: kind, p_run: run, p_req: rq, p_key: key });
  if (!ch) return json({ error: "billing_unavailable" }, 502);
  if (!ch.ok) return json({ error: ch.reason, message: MSG[ch.reason] ?? "مرفوض" }, ch.reason === "unknown_token" ? 401 : (LIMIT_STATUS[ch.reason] ?? 402));
  const refund = async () => { for (let i = 0; i < 2; i++) { const r = await rpc("saas_ai_refund2", { p_token: token, p_req: rq }); if (r) return; } };
  const sig = AbortSignal.any([req.signal, AbortSignal.timeout(tmo)]);
  let last = 0, data: any = null, model = "";
  for (const m of MODELS[kind]) {
    if (sig.aborted) break;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GKEY },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: cfg }), signal: sig,
      });
      if (r.ok) { data = await r.json(); model = m; break; }
      last = r.status;
    } catch { last = sig.aborted ? (req.signal.aborted ? 499 : 504) : 504; }
  }
  if (req.signal.aborted) { await refund(); return json({ error: "cancelled", message: "أُلغي الطلب — لم يُخصم من رصيدك" }, 499); }
  if (!data) { await refund(); return json({ error: last === 504 ? "timeout" : "upstream_failed", status: last, message: "تعذّر الذكاء الاصطناعي مؤقتاً — لم يُخصم من رصيدك" }, last === 504 ? 504 : 502); }
  const v = validateOutput(vmode, data);
  if (!v.ok) { await refund(); return json({ error: "invalid_output", why: v.why, message: "مخرجات النموذج غير صالحة — لم يُخصم من رصيدك" }, 422); }
  return json({ ok: true, left: ch.left, spent: ch.spent, cap: ch.cap, model, data, parsed: v.parsed ?? null });
}
