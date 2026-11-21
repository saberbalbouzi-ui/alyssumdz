/* واجهة LAURA في Spatial Core — تتحدث مع مسار الـWorker /v1/laura/* عبر الوسيط الموثوق platform-proxy بجلسة المستخدم (الصلاحيات تُفرض على الخادم؛ هنا عرض فقط).
   لا مفتاح نموذج ولا مفتاح منصة في المتصفح. أي تعديل (تأكيد/إلغاء طلب) يظهر كبطاقة موافقة صريحة، ولا يُنفَّذ إلا بنقرة «موافقة» ثم يُعرض ناتج التحقق من المنصة.
   حالة الكرة تتبع التنفيذ الحقيقي: thinking أثناء الطلب، executing أثناء تنفيذ موافقة، success/error بحسب نتيجة الخادم (لا محاكاة).
   النقل الافتراضي: إطار لوحة حقيقي جاهز (SpatialOS.spare أو أي لوح) يحمل كائن API وجلسة Supabase؛ Laura.setTransport(fn) لبيئات أخرى/الاختبار. */
(() => {
  "use strict";
  if (window.Laura) return;
  const LABEL = { orders_list: "جلب الطلبات", orders_stats: "إحصاءات الطلبات", sales_summary: "ملخص المبيعات", customers_top: "أفضل الزبائن", products_list: "المنتجات والمخزون", carts_summary: "السلال المتروكة", settings_overview: "إعدادات المنصة", order_confirm: "تأكيد طلب", order_cancel: "إلغاء طلب" };
  const ERR = { llm_unconfigured: "نموذج LAURA غير مُهيّأ على الخادم بعد.", llm_timeout: "تأخّر النموذج في الرد؛ حاول مجدداً.", llm_rate_limited: "النموذج مشغول؛ حاول بعد لحظات.", llm_unavailable: "تعذّر الوصول للنموذج حالياً.", llm_auth: "تعذّر اعتماد النموذج على الخادم.", llm_bad_response: "ردّ غير صالح من النموذج.", llm_blocked: "لم يُنتج النموذج ردّاً.", actor_required: "جلسة المستخدم مطلوبة.", invalid_actor: "انتهت الجلسة؛ أعد المحاولة.", rate_limited: "طلبات كثيرة؛ انتظر قليلاً.", forbidden: "ليست لديك صلاحية لهذه العملية.", unauthorized: "سجّل الدخول أولاً.", module_disabled: "LAURA معطّلة لهذا المتجر.", laura_not_configured: "LAURA غير مفعّلة على الوسيط بعد.", no_session: "لا توجد جلسة جاهزة بعد؛ انتظر لحظة.", unavailable: "خدمة LAURA غير متاحة حالياً.", network: "تعذّر الاتصال." };
  const S = { open: false, busy: false, ready: null, hist: [], pend: new Map(), speak: true, transport: null, lastErr: null, calls: 0, rec: null }, $ = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const core = m => { try { if (window.Core3D && Core3D.setAgent) Core3D.setAgent(m); } catch (_) { } }, voice = m => { try { if (window.Core3D) Core3D.setVoice(m); } catch (_) { } };
  /* ── النقل: الوسيط platform-proxy بجلسة المستخدم ── */
  function findAPI() {
    const frames = []; try { const sp = window.SpatialOS && SpatialOS.spare && SpatialOS.spare.frame; if (sp) frames.push(sp); if (window.SpatialOS) SpatialOS.panels.forEach(p => { if (p.fr) frames.push(p.fr); }); } catch (_) { }
    for (const f of frames) { try { const w = f.contentWindow, A = w.eval('typeof API !== "undefined" ? API : null'); if (A && A.sb && typeof A.sb.token === "function") return A; } catch (_) { } }
    return null;
  }
  async function defaultTransport(method, path, body) {
    const A = findAPI(); if (!A) throw { code: "no_session" };
    const t = await A.sb.token(); if (!t) throw { code: "unauthorized" };
    let r; try { r = await fetch(A.sb.url("/functions/v1/platform-proxy"), { method: "POST", headers: A.sb.headers(t), body: JSON.stringify({ method, path, body }) }); } catch (_) { throw { code: "network" }; }
    if (r.status === 404) throw { code: "unavailable" }; const j = await r.json().catch(() => ({}));
    if (r.status === 503 && j.error) throw { code: j.error }; if (r.status === 401) throw { code: "unauthorized" }; if (!r.ok || !j.ok) throw { code: j.error || "unavailable" };
    return { status: j.status, data: j.data };
  }
  async function call(method, path, body) {
    S.calls++; const tr = S.transport || defaultTransport, r = await tr(method, path, body);
    if (r.status >= 400) { const e = r.data && r.data.error || {}; throw { code: e.code || "http_" + r.status, message: e.message, status: r.status }; }
    return r.data;
  }
  /* ── الواجهة ── */
  let root, msgs, pendBox, input, stEl, dot, micBtn;
  const say = (cls, text, steps) => { const m = $("div", "lm-" + cls); m.append($("p", "", text)); if (steps && steps.length) { const c = $("div", "lm-steps"); steps.forEach(s => c.append($("span", "lm-chip " + (s.ok ? "ok" : "no"), (LABEL[s.name] || s.name) + (s.ok ? "" : " — تعذّر")))); m.append(c); } msgs.append(m); msgs.scrollTop = msgs.scrollHeight; return m; };
  const status = (t, cls) => { stEl.textContent = t || ""; dot.className = "lm-dot " + (cls || ""); };
  function renderPending() {
    pendBox.textContent = ""; S.pend.forEach(p => {
      const c = $("div", "lm-pend" + (p.sensitive ? " sens" : "")); c.dataset.id = p.id; c.append($("b", "", p.sensitive ? "عملية حساسة تنتظر موافقتك" : "إجراء ينتظر موافقتك"), $("p", "", p.summary));
      const row = $("div", "lm-row"), ok = $("button", "lm-ok", "موافقة وتنفيذ"), no = $("button", "lm-no", "إلغاء"); ok.type = no.type = "button"; ok.onclick = () => decide(p.id, true); no.onclick = () => decide(p.id, false); row.append(ok, no); c.append(row); pendBox.append(c);
    }); pendBox.hidden = !S.pend.size;
  }
  function speakText(text, lang) {
    if (!S.speak || !window.speechSynthesis || !text) return; try {
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = lang === "fr" ? "fr-FR" : lang === "en" ? "en-US" : "ar-DZ"; let tm = 0, lv = 0; const tick = () => { lv *= .82; try { Core3D.setAudio(Math.max(lv, .15)); if (window.SphereAudio) SphereAudio.level(lv); } catch (_) { } };
      u.onstart = () => { voice("speaking"); tm = setInterval(tick, 60); }; u.onboundary = () => { lv = Math.min(1, lv + .5); }; const end = () => { clearInterval(tm); voice("none"); try { Core3D.setAudio(0); } catch (_) { } }; u.onend = end; u.onerror = end; speechSynthesis.speak(u);
    } catch (_) { }
  }
  async function send(text) {
    text = String(text || "").trim(); if (!text || S.busy) return; S.busy = true; input.value = ""; say("u", text); core("thinking"); status("LAURA تفكّر…", "think");
    try {
      const d = await call("POST", "/v1/laura/chat", { message: text.slice(0, 2000), history: S.hist.slice(-10) });
      S.hist.push({ role: "user", text: text.slice(0, 2000) }, { role: "assistant", text: String(d.reply || "").slice(0, 2000) }); say("a", d.reply, d.tools);
      (d.pending || []).forEach(p => S.pend.set(p.id, p)); renderPending();
      const bad = (d.tools || []).some(s => !s.ok); core(d.state === "awaiting_approval" ? "idle" : bad ? "error" : "success"); status(d.state === "awaiting_approval" ? "بانتظار موافقتك" : "", d.state === "awaiting_approval" ? "wait" : "ok"); speakText(d.reply, d.lang);
      if (!bad && d.state !== "awaiting_approval") setTimeout(() => core("idle"), 1600);
    } catch (e) { const c = e && e.code || "network"; S.lastErr = c; say("e", ERR[c] || (e && e.message) || "تعذّر تنفيذ الطلب."); core("error"); status("", "err"); setTimeout(() => core("idle"), 2200); }
    finally { S.busy = false; }
  }
  async function decide(id, approve) {
    const p = S.pend.get(id); if (!p || S.busy) return; S.busy = true; pendBox.querySelectorAll("button").forEach(b => { b.disabled = true; });
    if (approve) { core("executing"); status("تنفيذ…", "exec"); }
    try {
      const d = await call("POST", "/v1/laura/confirm", { id, approve }); S.pend.delete(id); renderPending(); say(d.state === "done" ? "a ok" : d.state === "rejected" ? "a" : "e", d.reply);
      if (approve) { core(d.state === "done" ? "success" : "error"); status(d.state === "done" ? "نُفّذ وتم التحقق منه" : "لم يكتمل التحقق", d.state === "done" ? "ok" : "err"); speakText(d.reply, p.lang); } else core("idle");
      setTimeout(() => core("idle"), 1800);
    } catch (e) { const c = e && e.code || "network"; if (["already_decided", "expired", "not_found"].includes(c)) { S.pend.delete(id); renderPending(); } renderPending(); say("e", c === "expired" ? "انتهت صلاحية طلب الموافقة." : c === "already_decided" ? "هذا الإجراء حُسم من قبل." : (ERR[c] || (e && e.message) || "تعذّر التنفيذ.")); core("error"); status("", "err"); setTimeout(() => core("idle"), 2200); }
    finally { S.busy = false; }
  }
  function listen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) { say("e", "التعرّف على الصوت غير مدعوم في هذا المتصفح؛ اكتب سؤالك."); return; }
    if (S.rec) { try { S.rec.stop(); } catch (_) { } return; } const r = new SR(); r.lang = "ar-DZ"; r.interimResults = false; r.maxAlternatives = 1; S.rec = r; micBtn.classList.add("on"); voice("listening"); status("أستمع…", "listen");
    r.onresult = e => { const t = e.results[0] && e.results[0][0] && e.results[0][0].transcript; if (t) send(t); }; r.onerror = () => { }; r.onend = () => { S.rec = null; micBtn.classList.remove("on"); voice("none"); if (!S.busy) status(""); }; try { r.start(); } catch (_) { S.rec = null; micBtn.classList.remove("on"); voice("none"); }
  }
  function build() {
    root = $("aside", "laura"); root.id = "laura"; root.hidden = true; root.setAttribute("aria-label", "LAURA"); root.dir = "rtl";
    const head = $("header", "lm-h"); dot = $("i", "lm-dot"); stEl = $("span", "lm-st"); const x = $("button", "lm-x", "×"); x.type = "button"; x.setAttribute("aria-label", "إغلاق LAURA"); x.onclick = () => api.close(); const sp = $("button", "lm-sp"); sp.type = "button"; sp.title = "صوت الردود"; sp.setAttribute("aria-pressed", "true"); sp.textContent = "صوت"; sp.onclick = () => { S.speak = !S.speak; sp.setAttribute("aria-pressed", String(S.speak)); sp.classList.toggle("off", !S.speak); if (!S.speak) try { speechSynthesis.cancel(); } catch (_) { } };
    head.append($("b", "", "LAURA"), dot, stEl, sp, x); msgs = $("div", "lm-msgs"); msgs.setAttribute("aria-live", "polite"); pendBox = $("div", "lm-pends"); pendBox.hidden = true;
    const f = $("form", "lm-f"); micBtn = $("button", "lm-mic"); micBtn.type = "button"; micBtn.setAttribute("aria-label", "تحدّث"); micBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>'; micBtn.onclick = listen;
    input = $("input"); input.type = "text"; input.maxLength = 2000; input.placeholder = "اسأل أو أمُر LAURA…"; input.setAttribute("aria-label", "رسالة إلى LAURA"); const go = $("button", "lm-go", "إرسال"); go.type = "submit"; f.append(micBtn, input, go); f.onsubmit = e => { e.preventDefault(); send(input.value); };
    root.append(head, msgs, pendBox, f); document.body.appendChild(root); say("a", "أنا LAURA. اسألني عن الطلبات والمبيعات والمخزون والزبائن، أو اطلب تأكيد/إلغاء طلب (أطلب موافقتك قبل أي تعديل).");
  }
  async function probe() {
    try { const d = await call("GET", "/v1/laura/health"); S.ready = !!(d && d.llm_configured); S.lastErr = S.ready ? null : "llm_unconfigured"; } catch (e) { S.ready = e && e.code === "no_session" ? null : false; S.lastErr = e && e.code || "unavailable"; }
    return S.ready;
  }
  const api = {
    get ready() { return S.ready === true; }, get open() { return S.open; }, state: () => ({ ready: S.ready, open: S.open, busy: S.busy, pending: [...S.pend.values()], err: S.lastErr, calls: S.calls, speak: S.speak }),
    probe, send, setTransport(fn) { S.transport = fn || null; S.ready = null; },
    show() { if (!root) build(); root.hidden = false; S.open = true; document.body.classList.add("laura-on"); setTimeout(() => { try { input.focus(); } catch (_) { } }, 50); if (S.ready === null) probe().then(r => { if (r === false) say("e", ERR[S.lastErr] || ERR.unavailable); }); },
    close() { if (root) root.hidden = true; S.open = false; document.body.classList.remove("laura-on"); try { speechSynthesis.cancel(); } catch (_) { } },
    toggle() { S.open ? api.close() : api.show(); },
    decide,
  };
  window.Laura = api;
  /* تجهيز الجاهزية عند توفر جلسة (لوح احتياطي/لوح مفتوح): كي تعرف النقرة على الكرة أي مسار تستعمل */
  document.addEventListener("sc-spare", () => { if (S.ready === null) probe(); });
})();
