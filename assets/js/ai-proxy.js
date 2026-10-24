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
  /* الرمز: المحفوظ يدوياً (قديم) ثم المضمَّن في حزمة الموقع CONFIG.AI_TOKEN (يضعه المزوّد عند إنشاء الحزمة فلا يُدخل العميل شيئاً) */
  const token = () => { const t = (ls.get(TK) || String(cfg().AI_TOKEN || "")).replace(/[\s"']/g, ""); return /^[a-f0-9]{32,80}$/.test(t) ? t : ""; };
  const url = () => String(cfg().AI_URL || (String(cfg().SAAS_URL || DEF).replace(/\/+$/, "") + "/functions/v1/ai"));
  /* جلسة المدير: تعمل فقط حين تكون لوحة الموقع على مشروع الخادم نفسه (جلسته صالحة عند دالة ai)؛ لا رمز ولا مفتاح */
  const host = u => { try { return new URL(u).host; } catch (e) { return ""; } };
  const sess = () => { try { if (typeof API === "undefined" || !API.sb || !API.sb.session || !API.sb.session()) return false; const su = cfg().SUPABASE_URL; return !!su && host(su) === host(url()); } catch (e) { return false; } };
  const on = () => !!token() || sess();
  /* علامة «التوليد مُهيّأ» لبقية الواجهة؛ لا تستبدل مفتاحاً حقيقياً موجوداً */
  function mark() { if (!on()) return false; if (!ls.get(KEY)) ls.set(KEY, PH); return true; }
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
    const tk = token(), au = {}; if (tk) au.token = tk; else { try { au.jwt = await API.sb.token(); } catch (e) { } if (!au.jwt) return res(401, { error: { message: "انتهت جلسة الدخول — أعد تسجيل الدخول", status: "UNAUTHENTICATED", code: 401 } }); }
    let r; try { r = await orig(url(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ kind, parts, cfg: cfgG }, au)) }); }
    catch (e) { return res(503, { error: { message: "تعذّر الاتصال بخدمة الذكاء — تحقق من الشبكة وأعد المحاولة", status: "UNAVAILABLE" } }); }
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok && j.data) { S.left = j.left == null ? null : j.left; S.last = kind; try { document.dispatchEvent(new CustomEvent("alyssum:ai-left", { detail: { left: S.left, kind } })); } catch (e) { } return res(200, j.data); }
    /* الخادم غير مُهيّأ بعد: إن وُجد مفتاح حقيقي محفوظ في هذا المتصفح (مالك الموقع) يُستعمل مباشرة كاحتياط */
    if (j.error === "not_configured" && ls.get(KEY) && ls.get(KEY) !== PH) return orig("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": ls.get(KEY) }, body });
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
  mark(); setInterval(mark, 4000);
  return { on, token, set, html, saveFromUi, state: S, url, mark };
})();
