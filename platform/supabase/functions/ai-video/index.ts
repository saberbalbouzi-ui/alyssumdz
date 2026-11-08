// وسيط الفيديو/المجسّمات (v1.89.901): المزوّد يوفّر المفتاح والزبون يشتري الرصيد (kind=video في saas_ai_charge، platform/sql/ai-video.sql).
// الفيديو يستعمل **نفس مفتاح الصور** (سرّ GEMINI_API_KEY الموجود لدالة ai) عبر نماذج Veo (طويلة الأمد: إرسال ← استعلام ← تنزيل)؛
// والمجسّمات 3D تحتاج سرّاً اختيارياً FAL_KEY (خدمة مستقلة). اختياري: AI_VIDEO_MODELS قائمة نماذج Veo مفصولة بفواصل.
// الطلب: POST {token | jwt, action:"submit", model:"veo"|"fal-ai/…", body} ← يُنشئ المهمة ويخصم وحدة رصيد (تُردّ عند الفشل)
//        POST {token | jwt, action:"get", url}  ← حالة/نتيجة (veo-s:/veo-r:/طابور fal) بلا خصم     POST {action:"dl", uri} ← تنزيل ملف الفيديو الناتج
// المدير بجلسته (jwt) لا يُخصم منه. النشر: supabase functions deploy ai-video --no-verify-jwt
const URL_ = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FKEY = (Deno.env.get("FAL_KEY") ?? "").replace(/\s+/g, "");
// قد يُسمّى السرّ GEMINI_API_KEY أو «Gemini API Key» أو GEMINI_KEY: تُجرَّب كلها ويُعتمد أول مفتاح يرى نماذج Veo فعلاً (مشاريع Google تختلف في ما تتيحه)
const GKEYS = [...new Set([Deno.env.get("GEMINI_API_KEY"), Deno.env.get("Gemini API Key"), Deno.env.get("GEMINI_KEY")].map((x) => String(x ?? "").trim()).filter(Boolean))];
let GKEY = GKEYS[0] ?? "";
const VEO = (Deno.env.get("AI_VIDEO_MODELS") ?? "veo-3.1-fast-generate-preview,veo-3.0-fast-generate-001,veo-2.0-generate-001").split(",").map((x) => x.trim()).filter(Boolean);
const VEO_PINNED = !!Deno.env.get("AI_VIDEO_MODELS");
const GAPI = "https://generativelanguage.googleapis.com/v1beta";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const rpc = async (fn: string, args: Record<string, unknown>) => {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  return r.ok ? await r.json().catch(() => null) : null;
};
async function adminOf(jwt: string): Promise<string> {
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(jwt) || jwt.length > 4000) return "";
  try {
    const u = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: SRK, Authorization: `Bearer ${jwt}` } });
    if (!u.ok) return "";
    const me = await u.json(), em = String(me?.email ?? "").toLowerCase(); if (!em || !me?.email_confirmed_at) return "";
    const a = await fetch(`${URL_}/rest/v1/admins?select=email`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } });
    const rows = a.ok ? await a.json() : [];
    return Array.isArray(rows) && rows.some((r: any) => String(r.email ?? "").toLowerCase() === em) ? em : "";
  } catch { return ""; }
}
const MSG: Record<string, string> = {
  rate_limited: "طلبات كثيرة في وقت قصير — انتظر قليلاً", unknown_token: "توكن الموقع غير صالح", suspended: "الخدمة موقوفة لهذا الموقع — تواصل مع المزوّد",
  expired: "انتهت صلاحية اشتراكك — فعّله لمتابعة الاستعمال", no_credits: "انتهى رصيد الفيديو — اشترِ رصيداً إضافياً لمتابعة الاستعمال",
};
const hits = new Map<string, number[]>();
function limited(k: string): boolean {
  const now = Date.now(), a = (hits.get(k) ?? []).filter((t) => now - t < 60_000);
  if (a.length >= 6) { hits.set(k, a); return true; }
  a.push(now); hits.set(k, a); if (hits.size > 2000) hits.delete(hits.keys().next().value as string); return false;
}
// نماذج fal مسموحة فقط (مجسّمات) وروابط الطابور فقط: لا تحويل لأي خدمة أخرى
const MODEL_OK = /^fal-ai\/[a-z0-9][a-z0-9._\-\/]{2,120}$/;
const QUEUE_OK = /^https:\/\/queue\.fal\.run\/fal-ai\/[a-z0-9._\-\/]+$/;
const OP_OK = /^models\/[a-z0-9._\-]+\/operations\/[a-z0-9_\-]+$/i;
const DL_OK = /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/files\/[a-z0-9_\-]+:download(\?[\w=&%.\-]*)?$/i;
const refunded = new Set<string>();
const oBody = (t: string, st: number) => new Response(t, { status: st, headers: { ...CORS, "Content-Type": "application/json" } });

// طلب Veo من جسم الواجهة (صيغة الفيديو العامة): صورة بدء اختيارية + وصف + نسبة + مدة
function veoInstance(b: any, model: string) {
  const inst: Record<string, unknown> = { prompt: String(b?.prompt ?? "").slice(0, 3000) };
  const m = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b?.image_url ?? ""));
  if (m) inst.image = { bytesBase64Encoded: m[2], mimeType: m[1] };
  const ar = String(b?.aspect_ratio ?? "9:16"), [w, h] = ar.split(":").map(Number), portrait = (h || 1) >= (w || 1);
  const d = Math.max(3, Math.min(10, Number(b?.duration) || 5)), params: Record<string, unknown> = { aspectRatio: portrait ? "9:16" : "16:9" };
  params.durationSeconds = /veo-2/.test(model) ? Math.max(5, Math.min(8, Math.round(d))) : [4, 6, 8].reduce((a, c) => (Math.abs(c - d) < Math.abs(a - d) ? c : a), 6);
  return { instances: [inst], parameters: params };
}

// اكتشاف نماذج Veo المتاحة لمفتاحك فعلاً (ListModels: ما يدعم predictLongRunning): الأحدث أولاً، والسريع قبل العادي؛ تُخزَّن ساعة. سرّ AI_VIDEO_MODELS يثبّت القائمة يدوياً.
let vcache: { at: number; list: string[] } | null = null;
let vdiag = "";
let vOmni: string[] = [];          // نماذج Gemini Omni (فيديو عبر Interactions API) المتاحة للمفتاح المعتمد
let vHasVeo = false;               // هل وُجد Veo فعلاً (وإلا يُستعمل Omni)
async function veoModels(): Promise<string[]> {
  if (VEO_PINNED) { vHasVeo = true; return VEO; }
  if (vcache && Date.now() - vcache.at < 3_600_000) return vcache.list;
  vdiag = ""; const notes: string[] = []; let omniKey = ""; let omniList: string[] = [];
  for (const key of GKEYS) {
    const found: string[] = []; const seen: string[] = []; const all: string[] = []; const omni: string[] = []; let lst = 0;
    try {
      let tok = "";
      for (let i = 0; i < 6; i++) {
        const r = await fetch(`${GAPI}/models?pageSize=100${tok ? "&pageToken=" + encodeURIComponent(tok) : ""}`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(20_000) });
        lst = r.status; if (!r.ok) break; const j: any = await r.json().catch(() => ({}));
        for (const m of Array.isArray(j.models) ? j.models : []) {
          const n = String(m?.name ?? "").replace(/^models\//, ""); all.push(n); if (/veo|video|imagen|omni/i.test(n)) seen.push(n + ":" + (m?.supportedGenerationMethods ?? []).join("+"));
          if (/veo/i.test(n) && Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes("predictLongRunning")) found.push(n);
          if (/^gemini-omni-[\d.]*-?flash/i.test(n) || /^gemini-omni-flash/i.test(n)) omni.push(n);
        }
        tok = String(j.nextPageToken ?? ""); if (!tok) break;
      }
    } catch { /* الاحتياطي */ }
    const ver = (n: string) => Number((/(?:veo|omni)-(\d+(?:\.\d+)?)/i.exec(n) ?? [])[1] ?? 0);
    found.sort((a, b) => (/fast/i.test(a) ? 0 : 1) - (/fast/i.test(b) ? 0 : 1) || ver(b) - ver(a) || a.localeCompare(b));
    omni.sort((a, b) => ver(b) - ver(a) || a.localeCompare(b));
    if (found.length) { GKEY = key; vHasVeo = true; vOmni = omni; vcache = { at: Date.now(), list: found }; return found; }
    if (omni.length && !omniKey) { omniKey = key; omniList = omni; }
    notes.push("المفتاح …" + key.slice(-4) + ": " + (lst && lst !== 200 ? "ListModels=" + lst : all.length + " نموذجاً بلا Veo" + (seen.length ? " (المرئي: " + seen.slice(0, 4).join("، ") + ")" : "")));
  }
  if (omniKey) { GKEY = omniKey; vHasVeo = false; vOmni = omniList; vcache = { at: Date.now(), list: VEO }; return VEO; }
  vHasVeo = false; vOmni = [];
  vdiag = "لا نموذج فيديو (Veo أو Omni) متاح — " + (notes.join(" | ") || "لا مفتاح مضبوط");
  vcache = { at: Date.now(), list: VEO }; return VEO;
}

// فيديو Gemini Omni عبر Interactions API (POST /v1beta/interactions): متزامن؛ نطلب التسليم برابط ملف (delivery:"uri") لتفادي base64 الضخم، وإلا نقبل data المضمّن
async function omniGenerate(b: any, model: string): Promise<{ ok: boolean; url?: string; status: number; msg: string }> {
  const im = /^data:(image\/(?:png|jpe?g));base64,([A-Za-z0-9+/=]+)$/.exec(String(b?.image_url ?? ""));
  const input: unknown[] = [];
  if (im) input.push({ type: "image", data: im[2], mime_type: im[1].replace("jpg", "jpeg") });
  input.push({ type: "text", text: String(b?.prompt ?? "").trim().slice(0, 3000) || "Animate this product image with a smooth cinematic camera move." });
  const [w, h] = String(b?.aspect_ratio ?? "9:16").split(":").map(Number), portrait = (h || 1) >= (w || 1);
  const d = Math.max(3, Math.min(15, Math.round(Number(b?.duration) || 5)));
  const attempts = [
    { model, input, response_format: { type: "video", aspect_ratio: portrait ? "9:16" : "16:9", duration: d + "s", delivery: "uri" } },
    { model, input, generation_config: { video_config: { task: im ? "image_to_video" : "text_to_video" } } },
  ];
  let last = 502, msg = "";
  for (const a of attempts) {
    let r: Response; try { r = await fetch(`${GAPI}/interactions`, { method: "POST", headers: { "x-goog-api-key": GKEY, "Content-Type": "application/json" }, body: JSON.stringify(a), signal: AbortSignal.timeout(140_000) }); } catch { return { ok: false, status: 504, msg: "انتهت مهلة الخدمة" }; }
    const j: any = await r.json().catch(() => ({}));
    if (r.ok) {
      for (const st of Array.isArray(j?.steps) ? j.steps : []) if (st?.type === "model_output") for (const c of Array.isArray(st.content) ? st.content : []) if (c?.type === "video") {
        if (typeof c.uri === "string" && DL_OK.test(c.uri)) return { ok: true, url: "plat:" + c.uri, status: 200, msg: "" };
        if (typeof c.data === "string" && c.data.length > 100) return { ok: true, url: "data:" + String(c.mime_type || "video/mp4") + ";base64," + c.data, status: 200, msg: "" };
      }
      last = 502; msg = "لم يعد النموذج فيديو"; continue;
    }
    last = r.status; msg = String(j?.error?.message ?? "").slice(0, 200);
    if (r.status !== 400) break;                       // 400 فقط يستحق المحاولة التالية (صيغة أبسط)
  }
  return { ok: false, status: last, msg };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  let token = String(b.token ?? ""); const jwt = String(b.jwt ?? ""), action = String(b.action ?? "");
  let admin = "";
  if (!token && jwt) { admin = await adminOf(jwt); if (!admin) return json({ error: "unauthorized", message: "انتهت جلسة الدخول — أعد تسجيل الدخول" }, 401); token = "admin:" + admin; }
  if (!admin && !/^[a-f0-9]{32,80}$/.test(token)) return json({ error: "bad_request" }, 400);
  const NOCFG = () => json({ error: "not_configured", message: "خدمة الفيديو غير مفعّلة بعد في الخادم — تواصل مع المزوّد" }, 503);
  const FH = { Authorization: "Key " + FKEY, "Content-Type": "application/json", Accept: "application/json" };
  const GH = () => ({ "x-goog-api-key": GKEY, "Content-Type": "application/json" });

  if ((action === "dl" || action === "get") && !vcache) await veoModels();       // يحسم أي مفتاح يملك Veo قبل القراءة/التنزيل (الذاكرة تضيع بين النسخ)
  if (action === "dl") {                       // تنزيل فيديو Veo الناتج (يحتاج المفتاح فلا يُعطى للمتصفح)
    if (!GKEY) return NOCFG(); const u = String(b.uri ?? ""); if (!DL_OK.test(u)) return json({ error: "bad_url" }, 400);
    try { const r = await fetch(u, { headers: { "x-goog-api-key": GKEY }, signal: AbortSignal.timeout(100_000) }); if (!r.ok) return json({ error: "download_failed", status: r.status }, 502);
      return new Response(r.body, { status: 200, headers: { ...CORS, "Content-Type": r.headers.get("content-type") ?? "video/mp4" } }); }
    catch { return json({ error: "upstream_unreachable" }, 504); }
  }
  if (action === "get") {
    const u = String(b.url ?? "");
    if (/^veo-[sr]:/.test(u)) {
      if (!GKEY) return NOCFG(); const name = u.slice(6); if (!OP_OK.test(name)) return json({ error: "bad_url" }, 400);
      try {
        const r = await fetch(`${GAPI}/${name}`, { headers: GH(), signal: AbortSignal.timeout(60_000) }), j: any = await r.json().catch(() => ({}));
        if (!r.ok) return oBody(JSON.stringify({ error: j?.error?.message ?? "status_failed" }), r.status === 401 || r.status === 403 ? 502 : r.status);
        const gv = j?.response?.generateVideoResponse, samples = gv?.generatedSamples, uri = samples?.[0]?.video?.uri;
        const fail = j?.error?.message || (j?.done && !uri ? (Array.isArray(gv?.raiMediaFilteredReasons) && gv.raiMediaFilteredReasons[0] ? "حجبت الخدمة المحتوى: " + gv.raiMediaFilteredReasons[0] : "لم تُنتج الخدمة فيديو") : "");
        if (fail && !admin && !refunded.has(name)) { refunded.add(name); if (refunded.size > 2000) refunded.clear(); await rpc("saas_ai_refund", { p_token: token, p_kind: "video" }); }
        if (u.startsWith("veo-s:")) return json(fail ? { status: "FAILED", error: fail + " — لم يُخصم من رصيدك" } : { status: j?.done ? "COMPLETED" : "IN_PROGRESS" });
        return json(uri ? { video: { url: "plat:" + uri } } : { error: fail || "no_video" }, uri ? 200 : 502);
      } catch { return json({ error: "upstream_unreachable" }, 504); }
    }
    if (!FKEY) return NOCFG(); if (!QUEUE_OK.test(u)) return json({ error: "bad_url" }, 400);
    try { const r = await fetch(u, { headers: FH, signal: AbortSignal.timeout(60_000) }); return oBody(await r.text(), r.status); } catch { return json({ error: "upstream_unreachable" }, 504); }
  }
  if (action !== "submit") return json({ error: "bad_action" }, 400);
  const model = String(b.model ?? "veo"), isFal = model !== "veo" && model !== "auto";
  if (isFal ? !MODEL_OK.test(model) : false) return json({ error: "bad_model" }, 400);
  if (isFal ? !FKEY : !GKEY) return NOCFG();
  const body = b.body ?? {}; if (JSON.stringify(body).length > 12_000_000) return json({ error: "too_large" }, 413);
  if (limited(token)) return json({ error: "rate_limited", message: MSG.rate_limited }, 429);
  const ch = admin ? { ok: true, left: null } : await rpc("saas_ai_charge", { p_token: token, p_kind: "video" });
  if (!ch) return json({ error: "billing_unavailable", message: "تعذّر التحقق من الرصيد — حاول لاحقاً" }, 502);
  if (!ch.ok) return json({ error: ch.reason, message: MSG[ch.reason] ?? "مرفوض" }, ch.reason === "unknown_token" ? 401 : 402);
  const refund = async () => { if (!admin) await rpc("saas_ai_refund", { p_token: token, p_kind: "video" }); };      // لا يُحاسَب الموقع على طلب لم يصل
  try {
    if (isFal) {
      const r = await fetch("https://queue.fal.run/" + model, { method: "POST", headers: FH, body: JSON.stringify(body), signal: AbortSignal.timeout(110_000) }), text = await r.text();
      if (!r.ok) { await refund(); return oBody(text, r.status === 401 || r.status === 403 ? 502 : r.status); }
      let j: any = {}; try { j = JSON.parse(text); } catch { /* */ }
      return json({ ...j, left: ch.left });
    }
    let last = 502, msg = ""; const tried: string[] = [];
    const vm = await veoModels();
    if (!vHasVeo && vOmni.length) {                          // لا Veo لهذا المفتاح: Gemini Omni (متزامن)
      for (const m of vOmni.slice(0, 3)) {
        const o = await omniGenerate(body, m);
        if (o.ok) return json({ video: { url: o.url }, left: ch.left, model: m });
        last = o.status; msg = o.msg; tried.push(m + "=" + o.status + (o.msg ? " " + o.msg.slice(0, 80) : ""));
        if (o.status === 401 || o.status === 403 || o.status === 429) break;
      }
    }
    for (const m of (vHasVeo ? vm : []).slice(0, 4)) {
      const r = await fetch(`${GAPI}/models/${m}:predictLongRunning`, { method: "POST", headers: GH(), body: JSON.stringify(veoInstance(body, m)), signal: AbortSignal.timeout(110_000) }), j: any = await r.json().catch(() => ({}));
      if (r.ok && j?.name && OP_OK.test(j.name)) return json({ request_id: j.name, status_url: "veo-s:" + j.name, response_url: "veo-r:" + j.name, left: ch.left, model: m });
      last = r.status; msg = String(j?.error?.message ?? "").slice(0, 200); tried.push(m + "=" + r.status + (msg ? " " + msg.slice(0, 80) : ""));
      if (r.status === 429 || r.status === 401 || r.status === 403) break;           // لا فائدة من تجربة نموذج آخر
    }
    if (FKEY) {                                  // Veo غير متاح لهذا المفتاح: بديل تلقائي بخدمة الفيديو المستقلة إن وُجد سرّ FAL_KEY (جسم الواجهة بصيغتها أصلاً)
      const fm = (Deno.env.get("FAL_VIDEO_MODEL") ?? "fal-ai/kling-video/v2.1/standard/image-to-video").trim();
      if (MODEL_OK.test(fm)) {
        const r = await fetch("https://queue.fal.run/" + fm, { method: "POST", headers: FH, body: JSON.stringify(body), signal: AbortSignal.timeout(110_000) }), text = await r.text();
        if (r.ok) { let j: any = {}; try { j = JSON.parse(text); } catch { /* */ } return json({ ...j, left: ch.left, model: fm }); }
        tried.push(fm + "=" + r.status);
      }
    }
    await refund(); return json({ error: "upstream_failed", status: last, tried, message: "تعذّر إنشاء الفيديو" + (vdiag ? " — " + (admin ? vdiag : "الخدمة غير متاحة حالياً") : "") + (msg && admin ? " — " + msg : "") + " — لم يُخصم من رصيدك" }, 502);
  } catch {
    await refund(); return json({ error: "upstream_failed", message: "تعذّرت خدمة الفيديو مؤقتاً — لم يُخصم من رصيدك" }, 502);
  }
});
