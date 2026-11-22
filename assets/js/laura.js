/* نواة LAURA المشتركة (ملف واحد لكل الواجهات): لوحة التحكم admin.html (زر + محادثة مدمجة مباشرة في الصفحة) وSpatial Core. نفس المحرك على الخادم ونفس الذاكرة (تُحمَّل من الخادم عند الفتح) ونفس الصلاحيات.
   تتحدث مع مسار الـWorker /v1/laura/* عبر الوسيط الموثوق platform-proxy بجلسة المستخدم (الصلاحيات تُفرض على الخادم؛ هنا عرض فقط).
   لا مفتاح نموذج ولا مفتاح منصة في المتصفح. أي تعديل (تأكيد/إلغاء طلب) يظهر كبطاقة موافقة صريحة، ولا يُنفَّذ إلا بنقرة «موافقة» ثم يُعرض ناتج التحقق من المنصة.
   حالة الكرة تتبع التنفيذ الحقيقي: thinking أثناء الطلب، executing أثناء تنفيذ موافقة، success/error بحسب نتيجة الخادم (لا محاكاة).
   النقل الافتراضي: إطار لوحة حقيقي جاهز (SpatialOS.spare أو أي لوح) يحمل كائن API وجلسة Supabase؛ Laura.setTransport(fn) لبيئات أخرى/الاختبار. */
(() => {
  "use strict";
  if (window.Laura) return;
  /* لوحات Spatial هي صفحات admin.html داخل إطارات: لا زر ولا نواة فيها (النواة في الصفحة الأم) */
  let framed = false; try { framed = window.parent !== window; } catch (_) { framed = true; }
  if (framed && !window.__LAURA_FORCE) return;
  const HOST = (typeof API !== "undefined" && API && API.sb && typeof API.sb.token === "function") ? "admin" : "spatial";
  const LABEL = { platform_stats: "إحصائيات لوحة التحكم", orders_list: "جلب الطلبات", orders_stats: "إحصاءات الطلبات", sales_summary: "ملخص المبيعات", customers_top: "أفضل الزبائن", products_list: "المنتجات والمخزون", carts_summary: "السلال المتروكة", carts_list: "قائمة السلال", payments_pending: "إثباتات الدفع", wallet_summary: "المحفظة", sms_balance: "رصيد الرسائل", ads_spend: "إنفاق الإعلانات", sources_stats: "المصادر الخارجية", digital_orders: "الطلبات الرقمية", apps_installed: "الإضافات المثبّتة", payment_approve: "اعتماد دفعة", payment_reject: "رفض دفعة", cart_set_status: "تغيير حالة سلة", settings_overview: "إعدادات المنصة", order_confirm: "تأكيد طلب", order_cancel: "إلغاء طلب" };
  const ERR = { llm_unconfigured: "نموذج LAURA غير مُهيّأ على الخادم بعد.", llm_timeout: "تأخّر النموذج في الرد؛ حاول مجدداً.", llm_rate_limited: "النموذج مشغول؛ حاول بعد لحظات.", llm_unavailable: "تعذّر الوصول للنموذج حالياً.", llm_auth: "تعذّر اعتماد النموذج على الخادم.", llm_bad_response: "ردّ غير صالح من النموذج.", llm_blocked: "لم يُنتج النموذج ردّاً.", actor_required: "جلسة المستخدم مطلوبة.", invalid_actor: "انتهت الجلسة؛ أعد المحاولة.", rate_limited: "طلبات كثيرة؛ انتظر قليلاً.", forbidden: "ليست لديك صلاحية لهذه العملية.", unauthorized: "سجّل الدخول أولاً.", module_disabled: "LAURA معطّلة لهذا المتجر.", laura_not_configured: "LAURA غير مفعّلة على الوسيط بعد.", no_session: "لا توجد جلسة جاهزة بعد؛ انتظر لحظة.", unavailable: "خدمة LAURA غير متاحة حالياً.", network: "تعذّر الاتصال." };
  /* اللغة: لوحة التحكم ← AdminI18n، وSpatial ← SpatialI18n (الحدث العام alyssum:lang يصل كليهما)؛ الأصل العربي والفرنسية بقاموس صغير هنا (واجهة LAURA مستثناة من مترجم الصفحة بـdata-i18n-skip) */
  const FR = {"إحصائيات لوحة التحكم": "Statistiques du tableau de bord", "جلب الطلبات": "Lecture des commandes", "إحصاءات الطلبات": "Statistiques des commandes", "ملخص المبيعات": "Résumé des ventes", "أفضل الزبائن": "Meilleurs clients", "المنتجات والمخزون": "Produits et stock", "السلال المتروكة": "Paniers abandonnés", "قائمة السلال": "Liste des paniers", "إثباتات الدفع": "Preuves de paiement", "المحفظة": "Portefeuille", "رصيد الرسائل": "Solde des SMS", "إنفاق الإعلانات": "Dépenses publicitaires", "المصادر الخارجية": "Sources externes", "الطلبات الرقمية": "Commandes numériques", "الإضافات المثبّتة": "Extensions installées", "اعتماد دفعة": "Approbation d’un paiement", "رفض دفعة": "Rejet d’un paiement", "تغيير حالة سلة": "Changement d’état d’un panier", "إعدادات المنصة": "Paramètres de la plateforme", "تأكيد طلب": "Confirmation d’une commande", "إلغاء طلب": "Annulation d’une commande", "نموذج LAURA غير مُهيّأ على الخادم بعد.": "Le modèle de LAURA n’est pas encore configuré sur le serveur.", "تأخّر النموذج في الرد؛ حاول مجدداً.": "Le modèle met trop de temps à répondre ; réessayez.", "النموذج مشغول؛ حاول بعد لحظات.": "Le modèle est occupé ; réessayez dans un instant.", "تعذّر الوصول للنموذج حالياً.": "Le modèle est injoignable pour le moment.", "تعذّر اعتماد النموذج على الخادم.": "Le serveur n’a pas pu valider l’accès au modèle.", "ردّ غير صالح من النموذج.": "Réponse invalide du modèle.", "لم يُنتج النموذج ردّاً.": "Le modèle n’a produit aucune réponse.", "جلسة المستخدم مطلوبة.": "Une session utilisateur est requise.", "انتهت الجلسة؛ أعد المحاولة.": "Session expirée ; réessayez.", "طلبات كثيرة؛ انتظر قليلاً.": "Trop de requêtes ; patientez un peu.", "ليست لديك صلاحية لهذه العملية.": "Vous n’avez pas la permission pour cette opération.", "سجّل الدخول أولاً.": "Connectez-vous d’abord.", "LAURA معطّلة لهذا المتجر.": "LAURA est désactivée pour cette boutique.", "LAURA غير مفعّلة على الوسيط بعد.": "LAURA n’est pas encore activée.", "لا توجد جلسة جاهزة بعد؛ انتظر لحظة.": "Aucune session prête pour le moment ; patientez un instant.", "خدمة LAURA غير متاحة حالياً.": "Le service LAURA est indisponible pour le moment.", "تعذّر الاتصال.": "Connexion impossible.", " — تعذّر": " — échec", "عملية حساسة تنتظر موافقتك": "Opération sensible en attente de votre accord", "إجراء ينتظر موافقتك": "Action en attente de votre accord", "موافقة وتنفيذ": "Approuver et exécuter", "إلغاء": "Annuler", "LAURA تفكّر…": "LAURA réfléchit…", "بانتظار موافقتك": "En attente de votre accord", "تعذّر تنفيذ الطلب.": "La demande n’a pas pu être exécutée.", "تنفيذ…": "Exécution…", "نُفّذ وتم التحقق منه": "Exécuté et vérifié", "لم يكتمل التحقق": "Vérification incomplète", "انتهت صلاحية طلب الموافقة.": "La demande d’approbation a expiré.", "هذا الإجراء حُسم من قبل.": "Cette action a déjà été tranchée.", "تعذّر التنفيذ.": "L’exécution a échoué.", "التعرّف على الصوت غير مدعوم في هذا المتصفح؛ اكتب سؤالك.": "La reconnaissance vocale n’est pas prise en charge par ce navigateur ; écrivez votre question.", "أستمع…": "J’écoute…", "إغلاق LAURA": "Fermer LAURA", "مسح": "Effacer", "مسح المحادثة": "Effacer la conversation", "صوت الردود": "Voix des réponses", "صوت": "Voix", "تحدّث": "Parler", "اسأل أو أمُر LAURA…": "Demandez ou ordonnez à LAURA…", "رسالة إلى LAURA": "Message à LAURA", "إرسال": "Envoyer", "أنا LAURA. اسألني عن الطلبات والمبيعات والمخزون والزبائن والدفعات والسلال، أو اطلب تنفيذ إجراء (أطلب موافقتك قبل أي تعديل).": "Je suis LAURA. Interrogez-moi sur les commandes, les ventes, le stock, les clients, les paiements et les paniers, ou demandez une action (je demande votre accord avant toute modification).", "تعذّر مسح المحادثة.": "Impossible d’effacer la conversation.", "فتح LAURA": "Ouvrir LAURA"};
  const LANG = () => { try { const A = HOST === "admin" ? window.AdminI18n : window.SpatialI18n; return A && A.lang === "fr" ? "fr" : "ar"; } catch (_) { return "ar"; } };
  const t = a => (LANG() === "fr" && FR[a] != null ? FR[a] : a);
  const SRC = (document.currentScript && document.currentScript.src) || "";
  function loadCss() { if (document.getElementById("laura-css")) return; const l = document.createElement("link"); l.id = "laura-css"; l.rel = "stylesheet"; l.href = SRC ? SRC.replace(/\/js\/laura\.js.*$/, "/css/laura.css") + (/\?.*$/.exec(SRC) || [""])[0] : "assets/css/laura.css"; document.head.appendChild(l); }
  loadCss();
  const S = { open: false, busy: false, ready: null, hist: [], pend: new Map(), speak: true, transport: null, lastErr: null, calls: 0, rec: null }, $ = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const core = m => { try { if (window.Core3D && Core3D.setAgent) Core3D.setAgent(m); } catch (_) { } }, voice = m => { try { if (window.Core3D) Core3D.setVoice(m); } catch (_) { } };
  /* ── النقل: الوسيط platform-proxy بجلسة المستخدم ── */
  function findAPI() {
    if (HOST === "admin") return API;
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
  let root, msgs, pendBox, input, stEl, dot, micBtn, storeEl, fab, xB, rsB, spB, goB;
  const say = (cls, text, steps) => { const m = $("div", "lm-" + cls); m.append($("p", "", text)); if (steps && steps.length) { const c = $("div", "lm-steps"); steps.forEach(s => c.append($("span", "lm-chip " + (s.ok ? "ok" : "no"), (t(LABEL[s.name]) || s.name) + (s.ok ? "" : t(" — تعذّر"))))); m.append(c); } msgs.append(m); msgs.scrollTop = msgs.scrollHeight; return m; };
  const status = (t, cls) => { stEl.textContent = t || ""; dot.className = "lm-dot " + (cls || ""); };
  function renderPending() {
    pendBox.textContent = ""; S.pend.forEach(p => {
      const c = $("div", "lm-pend" + (p.sensitive ? " sens" : "")); c.dataset.id = p.id; c.append($("b", "", p.sensitive ? t("عملية حساسة تنتظر موافقتك") : t("إجراء ينتظر موافقتك")), $("p", "", p.summary));
      const row = $("div", "lm-row"), ok = $("button", "lm-ok", t("موافقة وتنفيذ")), no = $("button", "lm-no", t("إلغاء")); ok.type = no.type = "button"; ok.onclick = () => decide(p.id, true); no.onclick = () => decide(p.id, false); row.append(ok, no); c.append(row); pendBox.append(c);
    }); pendBox.hidden = !S.pend.size;
  }
  function speakText(text, lang) {
    if (!S.speak || !window.speechSynthesis || !text) return; try {
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = lang === "fr" ? "fr-FR" : lang === "en" ? "en-US" : "ar-DZ"; let tm = 0, lv = 0; const tick = () => { lv *= .82; try { Core3D.setAudio(Math.max(lv, .15)); if (window.SphereAudio) SphereAudio.level(lv); } catch (_) { } };
      u.onstart = () => { voice("speaking"); tm = setInterval(tick, 60); }; u.onboundary = () => { lv = Math.min(1, lv + .5); }; const end = () => { clearInterval(tm); voice("none"); try { Core3D.setAudio(0); } catch (_) { } }; u.onend = end; u.onerror = end; speechSynthesis.speak(u);
    } catch (_) { }
  }
  /* ── إحصائيات الرئيسية: لقطة من إطار خفي (اللوح الاحتياطي) أو من لوح الرئيسية الظاهر؛ تُخزَّن 20ث ── */
  async function homeSource() {
    if (HOST === "admin") { const h = document.getElementById("ahome"); return h && h.children.length ? { doc: document, hidden: false } : null; }
    try {
      const S_ = window.SpatialOS, sp = S_ && S_.spare && S_.spare.ready && S_.spare.frame;
      if (sp) { const d = sp.contentDocument, w = sp.contentWindow; if (d && !(d.getElementById("ahome") && d.getElementById("ahome").children.length)) { try { w.eval("Admin.tab('home')"); } catch (_) { } for (let i = 0; i < 30 && !(d.getElementById("ahome") && d.getElementById("ahome").children.length); i++) await new Promise(r => setTimeout(r, 100)); } if (d && d.getElementById("ahome") && d.getElementById("ahome").children.length) return { doc: d, hidden: true }; }
      if (S_) for (const p of S_.panels.values()) { if (p.fr && p.frame && p.frame.tab === "home" && p.frDone) { const d = p.fr.contentDocument; if (d && d.getElementById("ahome") && d.getElementById("ahome").children.length) return { doc: d, hidden: false }; } }
    } catch (_) { }
    return null;
  }
  async function collectStats() {
    if (S.statsProvider) { try { return await S.statsProvider(); } catch (_) { return null; } }
    if (!window.LauraStats) return null; if (S.stats && Date.now() - S.statsAt < 20000) return S.stats;
    const src = await homeSource(); if (!src) return null; let st = null; try { st = await Promise.race([LauraStats.collect(src.doc, src.hidden), new Promise(r => setTimeout(() => r(null), 6000))]); } catch (_) { st = null; }
    if (st && JSON.stringify(st).length > 40000) st.snapshots = st.snapshots.slice(0, 1); if (st) { S.stats = st; S.statsAt = Date.now(); } return st;
  }
  async function send(text) {
    text = String(text || "").trim(); if (!text || S.busy) return; S.busy = true; input.value = ""; say("u", text); core("thinking"); status(t("LAURA تفكّر…"), "think");
    try {
      const stats = await collectStats(), d = await call("POST", "/v1/laura/chat", { message: text.slice(0, 2000), client: HOST, ...(LANG() === "fr" ? { lang: "fr" } : {}), ...(stats ? { stats } : {}) });
      say("a", d.reply, d.tools);
      (d.pending || []).forEach(p => S.pend.set(p.id, p)); renderPending();
      const bad = (d.tools || []).some(s => !s.ok); core(d.state === "awaiting_approval" ? "idle" : bad ? "error" : "success"); status(d.state === "awaiting_approval" ? t("بانتظار موافقتك") : "", d.state === "awaiting_approval" ? "wait" : "ok"); speakText(d.reply, d.lang);
      if (!bad && d.state !== "awaiting_approval") setTimeout(() => core("idle"), 1600);
    } catch (e) { const c = e && e.code || "network"; S.lastErr = c; say("e", t(ERR[c]) || (e && e.message) || t("تعذّر تنفيذ الطلب.")); core("error"); status("", "err"); setTimeout(() => core("idle"), 2200); }
    finally { S.busy = false; }
  }
  async function decide(id, approve) {
    const p = S.pend.get(id); if (!p || S.busy) return; S.busy = true; pendBox.querySelectorAll("button").forEach(b => { b.disabled = true; });
    if (approve) { core("executing"); status(t("تنفيذ…"), "exec"); }
    try {
      const d = await call("POST", "/v1/laura/confirm", { id, approve, client: HOST }); S.pend.delete(id); renderPending(); say(d.state === "done" ? "a ok" : d.state === "rejected" ? "a" : "e", d.reply);
      if (approve) { core(d.state === "done" ? "success" : "error"); status(d.state === "done" ? t("نُفّذ وتم التحقق منه") : t("لم يكتمل التحقق"), d.state === "done" ? "ok" : "err"); speakText(d.reply, p.lang); } else core("idle");
      setTimeout(() => core("idle"), 1800);
    } catch (e) { const c = e && e.code || "network"; if (["already_decided", "expired", "not_found"].includes(c)) { S.pend.delete(id); renderPending(); } renderPending(); say("e", c === "expired" ? t("انتهت صلاحية طلب الموافقة.") : c === "already_decided" ? t("هذا الإجراء حُسم من قبل.") : (t(ERR[c]) || (e && e.message) || t("تعذّر التنفيذ."))); core("error"); status("", "err"); setTimeout(() => core("idle"), 2200); }
    finally { S.busy = false; }
  }
  function listen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) { say("e", t("التعرّف على الصوت غير مدعوم في هذا المتصفح؛ اكتب سؤالك.")); return; }
    if (S.rec) { try { S.rec.stop(); } catch (_) { } return; } const r = new SR(); r.lang = LANG() === "fr" ? "fr-FR" : "ar-DZ"; r.interimResults = false; r.maxAlternatives = 1; S.rec = r; micBtn.classList.add("on"); voice("listening"); status(t("أستمع…"), "listen");
    r.onresult = e => { const t = e.results[0] && e.results[0][0] && e.results[0][0].transcript; if (t) send(t); }; r.onerror = () => { }; r.onend = () => { S.rec = null; micBtn.classList.remove("on"); voice("none"); if (!S.busy) status(""); }; try { r.start(); } catch (_) { S.rec = null; micBtn.classList.remove("on"); voice("none"); }
  }
  function build() {
    root = $("aside", "laura " + HOST); root.id = "laura"; root.hidden = true; root.setAttribute("aria-label", "LAURA"); root.setAttribute("data-i18n-skip", ""); root.dir = LANG() === "fr" ? "ltr" : "rtl";
    const head = $("header", "lm-h"); dot = $("i", "lm-dot"); stEl = $("span", "lm-st"); const x = $("button", "lm-x", "×"); x.type = "button"; x.setAttribute("aria-label", t("إغلاق LAURA")); x.onclick = () => api.close(); xB = x; const rs = $("button", "lm-sp lm-rs", t("مسح")); rs.type = "button"; rs.title = t("مسح المحادثة"); rs.onclick = resetConv; rsB = rs; const sp = $("button", "lm-sp"); sp.type = "button"; sp.title = t("صوت الردود"); sp.setAttribute("aria-pressed", "true"); sp.textContent = t("صوت"); spB = sp; sp.onclick = () => { S.speak = !S.speak; sp.setAttribute("aria-pressed", String(S.speak)); sp.classList.toggle("off", !S.speak); if (!S.speak) try { speechSynthesis.cancel(); } catch (_) { } };
    storeEl = $("small", "lm-store"); head.append($("b", "", "LAURA"), storeEl, dot, stEl, rs, sp, x); msgs = $("div", "lm-msgs"); msgs.setAttribute("aria-live", "polite"); pendBox = $("div", "lm-pends"); pendBox.hidden = true;
    const f = $("form", "lm-f"); micBtn = $("button", "lm-mic"); micBtn.type = "button"; micBtn.setAttribute("aria-label", t("تحدّث")); micBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>'; micBtn.onclick = listen;
    input = $("input"); input.type = "text"; input.maxLength = 2000; input.placeholder = t("اسأل أو أمُر LAURA…"); input.setAttribute("aria-label", t("رسالة إلى LAURA")); const go = $("button", "lm-go", t("إرسال")); go.type = "submit"; goB = go; f.append(micBtn, input, go); f.onsubmit = e => { e.preventDefault(); send(input.value); };
    root.append(head, msgs, pendBox, f); document.body.appendChild(root); welcome();
  }
  /* تبديل اللغة: النصوص الثابتة تُعاد تسميتها، والمحادثة والإجراءات المعلّقة تُعاد من الخادم (الرسائل القديمة تبقى بلغتها الأصلية) */
  function applyLang() {
    const fr = LANG() === "fr"; if (fab) { fab.setAttribute("aria-label", t("فتح LAURA")); }
    if (!root) return; root.dir = fr ? "ltr" : "rtl"; xB.setAttribute("aria-label", t("إغلاق LAURA")); rsB.textContent = t("مسح"); rsB.title = t("مسح المحادثة"); spB.title = t("صوت الردود"); spB.textContent = t("صوت"); micBtn.setAttribute("aria-label", t("تحدّث")); input.placeholder = t("اسأل أو أمُر LAURA…"); input.setAttribute("aria-label", t("رسالة إلى LAURA")); goB.textContent = t("إرسال"); status("");
    renderPending(); if (msgs.children.length <= 1) { msgs.textContent = ""; welcome(); }      /* لا محادثة بعد: الترحيب بالفرنسية فوراً دون انتظار الخادم */
    if (S.open && !S.busy) hydrate();
  }
  document.addEventListener("alyssum:lang", applyLang); document.addEventListener("store:lang", applyLang);      /* الاسم الثاني لحزم العملاء (alyssum ← store) */
  const welcome = () => say("a", t("أنا LAURA. اسألني عن الطلبات والمبيعات والمخزون والزبائن والدفعات والسلال، أو اطلب تنفيذ إجراء (أطلب موافقتك قبل أي تعديل)."));
  /* الذاكرة من الخادم: نفس المحادثة في لوحة التحكم وSpatial Core (والإجراءات المعلّقة تظهر في الاثنين) */
  async function hydrate() {
    try {
      const d = await call("GET", "/v1/laura/history"); if (!d || !root) return; if (d.store && d.store.name) { S.store = d.store.name; storeEl.textContent = S.store; }
      msgs.textContent = ""; if (!d.messages || !d.messages.length) welcome(); else d.messages.slice(-30).forEach(m => say(m.role === "user" ? "u" : "a", m.text));
      S.pend.clear(); (d.pending || []).forEach(p => S.pend.set(p.id, p)); renderPending(); S.hydrated = Date.now();
    } catch (_) { }
  }
  async function resetConv() { if (S.busy) return; try { await call("POST", "/v1/laura/reset", {}); msgs.textContent = ""; welcome(); await hydrate(); } catch (e) { say("e", t(ERR[e && e.code]) || t("تعذّر مسح المحادثة.")); } }
  async function probe() {
    try { const d = await call("GET", "/v1/laura/health"); S.reach = true; S.ready = !!(d && d.llm_configured); S.lastErr = S.ready ? null : "llm_unconfigured"; if (d && d.store && d.store.name) S.store = d.store.name; } catch (e) { S.ready = e && e.code === "no_session" ? null : false; S.lastErr = e && e.code || "unavailable"; }
    return S.ready;
  }
  const api = {
    get ready() { return S.ready === true; }, get open() { return S.open; }, state: () => ({ ready: S.ready, open: S.open, busy: S.busy, pending: [...S.pend.values()], err: S.lastErr, calls: S.calls, speak: S.speak }),
    probe, send, collectStats, setStatsProvider(fn) { S.statsProvider = fn || null; S.stats = null; }, setTransport(fn) { S.transport = fn || null; S.ready = null; },
    show() { if (!root) build(); root.hidden = false; S.open = true; document.body.classList.add("laura-on"); if (fab) fab.setAttribute("aria-expanded", "true"); if (!S.hydrated || Date.now() - S.hydrated > 4000) hydrate(); setTimeout(() => { try { input.focus(); } catch (_) { } }, 50); if (S.ready === null) probe().then(r => { if (r === false) say("e", t(ERR[S.lastErr]) || t(ERR.unavailable)); }); },
    close() { if (root) root.hidden = true; S.open = false; document.body.classList.remove("laura-on"); if (fab) fab.setAttribute("aria-expanded", "false"); try { speechSynthesis.cancel(); } catch (_) { } },
    toggle() { S.open ? api.close() : api.show(); },
    decide,
  };
  window.Laura = api;
  /* زر لوحة التحكم: يظهر فقط حين تكون LAURA قابلة للوصول لهذا المتجر (جلسة صالحة + الوحدة مفعّلة)؛ لا شيء ميت في الواجهة */
  function mountFab() {
    if (fab || HOST !== "admin") return; fab = $("button", "laura-fab", "LAURA"); fab.id = "laura-fab"; fab.setAttribute("data-i18n-skip", ""); fab.type = "button"; fab.setAttribute("aria-label", t("فتح LAURA")); fab.setAttribute("aria-expanded", "false"); fab.onclick = () => api.toggle(); document.body.appendChild(fab);
  }
  if (HOST === "admin") {
    let tries = 0; const tick = async () => {
      if (S.reach || tries++ > 40) return; let t = null; try { t = await API.sb.token(); } catch (_) { }
      if (t) { await probe(); if (S.reach) { mountFab(); return; } if (S.lastErr && !["no_session", "unauthorized", "network"].includes(S.lastErr)) return; }
      setTimeout(tick, tries < 6 ? 2500 : 7000);
    };
    const go = () => setTimeout(tick, 1500); if (document.readyState === "complete") go(); else window.addEventListener("load", go);
  }
  /* تجهيز الجاهزية عند توفر جلسة (لوح احتياطي/لوح مفتوح): كي تعرف النقرة على الكرة أي مسار تستعمل */
  document.addEventListener("sc-spare", () => { if (S.ready === null) probe(); });
})();
