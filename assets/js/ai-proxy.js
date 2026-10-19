/* وسيط الذكاء الاصطناعي (AiProxy) — v1.89.330. مفتاح واحد للمنصة محفوظ في الخادم فقط، ولكل موقع «رمز» ورصيد يديرهما المزوّد.
   عند وجود الرمز (localStorage alyssum_ai_token) يُحوَّل كل استدعاء لخدمة التوليد الذكي (نص/صورة) إلى دالة `ai` على الخادم بدل الاتصال المباشر بالمفتاح؛
   فلا يظهر أي مفتاح في المتصفح، ويُخصم الرصيد من الخادم ويُردّ عند الفشل. بلا رمز: السلوك القديم (مفتاح المتصفح) كما هو.
   الخادم: platform/functions/ai/index.ts (+ platform/sql/schema.sql: saas_ai_charge/refund). الاختبار: scripts/test-ai-proxy.js */
window.AiProxy = (() => {
  const TK = "alyssum_ai_token", KEY = "alyssum_gp_gkey", PH = "via-proxy";
  const RX = /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/([^:\/?]+):generateContent/, RXL = /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\?/;
  const cfg = () => (typeof CONFIG !== "undefined" && CONFIG) || {};
  const DEF = "https://qvdaiundlkfbmjlummni.supabase.co";
  const ls = { get: k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } }, del: k => { try { localStorage.removeItem(k); } catch (e) { } } };
  const token = () => { const t = ls.get(TK).replace(/[\s"']/g, ""); return /^[a-f0-9]{32,80}$/.test(t) ? t : ""; };
  const url = () => String(cfg().AI_URL || (String(cfg().SAAS_URL || DEF).replace(/\/+$/, "") + "/functions/v1/ai"));
  const on = () => !!token();
  const S = { left: null, last: "" };
  const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash-image"];

  function set(v) {
    v = String(v || "").replace(/[\s"']/g, "");
    if (!v) { ls.del(TK); if (ls.get(KEY) === PH) ls.del(KEY); return { ok: true, cleared: true }; }
    if (!/^[a-f0-9]{32,80}$/.test(v)) return { ok: false, error: "الرمز غير صالح — انسخه كاملاً من لوحة المزوّد" };
    ls.set(TK, v); if (!ls.get(KEY)) ls.set(KEY, PH);      // علامة تجعل بقية الواجهة تعدّ التوليد مُهيّأً (لا مفتاح حقيقي هنا)
    return { ok: true };
  }
  const res = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  async function viaProxy(model, body) {
    let b; try { b = JSON.parse(body || "{}"); } catch (e) { return res(400, { error: { message: "طلب غير صالح", status: "INVALID_ARGUMENT" } }); }
    const cfgG = b.generationConfig || {}, mod = cfgG.responseModalities, kind = (Array.isArray(mod) && mod.some(x => /image/i.test(x))) || /image/i.test(model) ? "image" : "text";
    const parts = [].concat.apply([], (b.contents || []).map(c => c.parts || []));
    let r; try { r = await orig(url(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token(), kind, parts, cfg: cfgG }) }); }
    catch (e) { return res(503, { error: { message: "تعذّر الاتصال بخدمة الذكاء — تحقق من الشبكة وأعد المحاولة", status: "UNAVAILABLE" } }); }
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok && j.data) { S.left = j.left == null ? null : j.left; S.last = kind; try { document.dispatchEvent(new CustomEvent("alyssum:ai-left", { detail: { left: S.left, kind } })); } catch (e) { } return res(200, j.data); }
    const msg = j.message || (j.error === "not_configured" ? "خدمة الذكاء غير مُفعَّلة بعد في الخادم — تواصل مع المزوّد" : "تعذّر الذكاء الاصطناعي (" + r.status + ")");
    return res(r.status === 200 ? 502 : r.status, { error: { message: msg, status: j.error || "ERROR", code: r.status } });
  }
  const orig = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      if (on()) {
        const u = typeof input === "string" ? input : (input && input.url) || "", m = RX.exec(u);
        if (m && ((init && init.method) || "GET").toUpperCase() === "POST") return viaProxy(m[1], init && init.body);
        if (RXL.test(u)) return Promise.resolve(res(200, { models: MODELS.map(n => ({ name: "models/" + n, supportedGenerationMethods: ["generateContent"] })) }));
      }
    } catch (e) { }
    return orig(input, init);
  };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /* بطاقة الإعدادات: حقل الرمز + الحالة */
  const html = () => `<div class="ap-sec"><b>رمز الموقع (Alyssum API)</b><div class="hint">إن وفّر لك المزوّد رمزاً لموقعك فألصقه هنا ولا تحتاج مفتاحاً: يمرّ التوليد عبر خادم المنصة ويُخصم من رصيد موقعك.</div><div class="tl-s"><input id="ig-tok" dir="ltr" type="password" autocomplete="off" placeholder="رمز الموقع" value="${esc(token())}" onchange="AiProxy.saveFromUi()"><div class="hint" id="ig-tokmsg">${on() ? "✅ مُفعَّل — التوليد عبر خادم المنصة" + (S.left != null ? " (المتبقي: " + S.left + ")" : "") : "غير مُفعَّل"}</div></div></div>`;
  function saveFromUi() { const el = document.getElementById("ig-tok"), r = set(el ? el.value : ""), m = document.getElementById("ig-tokmsg"); if (m) m.textContent = r.ok ? (r.cleared ? "أُلغي الرمز — يعود التوليد لمفتاح المتصفح" : "✅ حُفظ الرمز") : r.error; return r; }

  /* نداء مباشر بوضع Copilot (حدود دائمة على الخادم): { kind, parts, cfg, run, req, key, validate, timeoutMs, signal } ← { ok, data, parsed, left, spent, cap } أو يرمي AiError.
     المهلة والإلغاء يقطعان الاتصال فيلغي الخادم الطلب لدى Google ويستردّ الخصم (مرة واحدة). لا يظهر أي مفتاح Gemini هنا أبداً؛ الرمز هو رمز الموقع فقط. */
  class AiError extends Error { constructor(code, msg, o) { super(msg || code); this.code = code; Object.assign(this, o || {}); } }
  const LIMITS = ["run_llm_limit", "run_img_limit", "run_tries_limit", "daily_cap", "no_credits", "expired", "suspended", "duplicate_request", "unknown_token", "rate_limited"];
  async function call(o) {
    o = o || {}; if (!on()) throw new AiError("no_token", "رمز الموقع غير مضبوط — ألصقه في إعدادات الذكاء الاصطناعي", { limit: true });
    const ctl = new AbortController(), ms = Math.max(2000, Math.min(110000, Number(o.timeoutMs) || 70000)); let timedOut = false, userCancel = false;
    const tm = setTimeout(() => { timedOut = true; ctl.abort(); }, ms), onAbort = () => { userCancel = true; ctl.abort(); };
    if (o.signal) { if (o.signal.aborted) { clearTimeout(tm); throw new AiError("cancelled", "أُلغي الطلب", { cancelled: true }); } o.signal.addEventListener("abort", onAbort, { once: true }); }
    try {
      let r; try { r = await orig(url(), { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.signal, body: JSON.stringify({ token: token(), kind: o.kind, parts: o.parts, cfg: o.cfg || {}, run: o.run, req: o.req, key: o.key == null ? undefined : o.key, validate: o.validate, timeout_s: Math.max(1, Math.floor(ms / 1000) - 3) }) }); }
      catch (e) { if (userCancel) throw new AiError("cancelled", "أُلغي الطلب", { cancelled: true }); if (timedOut) throw new AiError("timeout", "انتهت مهلة الذكاء الاصطناعي", { retryable: true }); throw new AiError("network", "تعذّر الاتصال بخدمة الذكاء", { retryable: true }); }
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { S.left = j.left == null ? null : j.left; return j; }
      const code = j.error || ("http_" + r.status); throw new AiError(code, j.message || "تعذّر الذكاء الاصطناعي (" + r.status + ")", { status: r.status, limit: LIMITS.includes(code), retryable: r.status >= 500 || code === "invalid_output", why: j.why });
    } finally { clearTimeout(tm); if (o.signal) o.signal.removeEventListener("abort", onAbort); }
  }
  return { on, token, set, html, saveFromUi, state: S, url, call, AiError };
})();
