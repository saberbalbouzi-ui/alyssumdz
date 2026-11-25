/* صندوق الرسائل الخاص بالمالك (Owner Private Message Inbox) — خاص بمالك المنصة فقط (owner_only، يُحمَّل بشرط CONFIG.SELLER ولا يدخل حزم العملاء).
   يستقبل دفعات رسائل مُعدّة مسبقاً (CSV/JSON) ويخزّنها في جدول owner_inbox بقاعدة البيانات (RLS: المالك وحده، والاستيراد دالة خادمية owner_inbox_import)،
   ويعرضها قائمةً جاهزة للإرسال اليدوي عبر WhatsApp (wa.me). لا Meta API ولا إرسال آلي: فتح WhatsApp يضع الحالة Opened فقط، و«Sent» لا تُسجَّل إلا بتأكيد المالك
   مع نسخة النص المُرسَل فعلاً (والخادم يرفضها بلا نسخة). صيغة الدفعة: platform/docs/owner-inbox-format.md. */
const AdminWaqsInbox = (() => {
  if (typeof CONFIG === "undefined" || !CONFIG.SELLER || typeof AdminWaqs === "undefined" || AdminWaqs.off) return { off: true };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fr = () => typeof AdminI18n !== "undefined" && AdminI18n.lang === "fr";
  const X = (a, f) => fr() ? f : a;
  const DAY = 864e5, GUARD = 3 * DAY, PAGE = 150;
  /* الحالات: الاسم الإنجليزي كما حدّده المالك في الواجهة العربية، والفرنسية في الفرنسية */
  const ST = { ready: ["Ready to Send", "Prêt à envoyer", "#16a34a"], opened: ["Opened in WhatsApp", "Ouvert dans WhatsApp", "#0ea5e9"], sent: ["Sent", "Envoyé", "#3b82f6"], waiting: ["Waiting for Reply", "En attente de réponse", "#d97706"], positive: ["Positive Reply", "Réponse positive", "#15803d"], negative: ["Negative Reply", "Réponse négative", "#dc2626"], followup: ["Follow-up Required", "Relance à faire", "#7c3aed"], cancelled: ["Cancelled", "Annulé", "#6b7280"] };
  const ORDER = ["ready", "opened", "sent", "waiting", "positive", "negative", "followup", "cancelled"];
  const KD = { first_contact: ["First Contact", "Premier contact"], follow_up: ["Follow-up", "Relance"], reply: ["Reply", "Réponse"], meeting: ["Meeting Request", "Demande de rendez-vous"], offer: ["Commercial Offer", "Offre commerciale"], thank_you: ["Thank You", "Remerciements"], closing: ["Closing", "Clôture"], other: ["Other", "Autre"] };
  const LG = { en: "English", fr: "Français", ar: "العربية" };
  const stl = k => ST[k] ? ST[k][fr() ? 1 : 0] : String(k || "");
  const kdl = k => KD[k] ? KD[k][fr() ? 1 : 0] : String(k || "");
  const S = { rows: [], logs: {}, loaded: false, busy: false, err: "", sel: null, q: "", co: "", lg: "", st: "ready", cp: "", sort: "prio", more: PAGE, custom: null, edit: false };
  const fmtD = t => { try { return new Date(t).toLocaleString(fr() ? "fr-FR" : "ar-DZ", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (_) { return ""; } };
  const ago = t => { const m = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000)), f = fr(); return m < 60 ? (f ? "il y a " + m + " min" : "قبل " + m + " دقيقة") : m < 1440 ? (f ? "il y a " + Math.round(m / 60) + " h" : "قبل " + Math.round(m / 60) + " ساعة") : (f ? "il y a " + Math.round(m / 1440) + " j" : "قبل " + Math.round(m / 1440) + " يوماً"); };
  const toast = m => { try { if (typeof window.toast === "function") window.toast(m); } catch (_) { } };

  /* ── الطلب إلى قاعدة البيانات بجلسة المالك (RLS تتحقق منه على الخادم) ── */
  async function rq(path, opts) {
    if (typeof API === "undefined" || !API.sb || !API.sb.enabled()) throw new Error(X("غير متاح: صندوق الرسائل يتطلب قاعدة بيانات المتجر.", "Indisponible : la boîte de messages nécessite la base de données de la boutique."));
    const t = await API.sb.token(); if (!t) throw new Error(X("سجّل الدخول كمالك أولاً.", "Connectez-vous d'abord en tant que propriétaire."));
    const o = opts || {}, r = await fetch(API.sb.url(path), Object.assign({}, o, { headers: Object.assign({}, API.sb.headers(t), { "Content-Type": "application/json" }, o.headers || {}) }));
    const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (_) { }
    if (!r.ok) { const e = new Error((j && (j.message || j.hint || j.code)) || txt.slice(0, 160) || ("HTTP " + r.status)); e.status = r.status; e.code = j && j.code; throw e; }
    return j;
  }
  const nice = e => (e && (e.status === 404 || /PGRST20[0-9]|does not exist|schema cache/i.test(e.message || ""))) ? X("صندوق الرسائل غير مفعَّل بعد على قاعدة البيانات؛ يلزم تفعيله أولاً (يطلبه المالك).", "La boîte de messages n'est pas encore activée sur la base de données ; il faut d'abord l'activer (à la demande du propriétaire).") : (e && e.message) || String(e);
  const logQ = ids => "/rest/v1/owner_inbox_log?select=message_id,at,from_status,to_status&message_id=in.(" + ids.join(",") + ")&order=at.asc&limit=1000";
  async function load() {
    S.busy = true; S.err = ""; draw();
    try { S.rows = await rq("/rest/v1/owner_inbox?select=*&order=created_at.desc&limit=2000") || []; S.loaded = true; }
    catch (e) { S.err = nice(e); S.loaded = true; }
    S.busy = false; draw();
  }
  async function loadLogs(phone) {
    const ids = S.rows.filter(r => r.phone === phone).map(r => r.id); if (!ids.length) return;
    try { const L = await rq(logQ(ids)) || []; ids.forEach(i => { S.logs[i] = []; }); L.forEach(l => { (S.logs[l.message_id] = S.logs[l.message_id] || []).push(l); }); draw(); } catch (_) { }
  }
  async function patch(id, body) {
    const r = await rq("/rest/v1/owner_inbox?id=eq." + encodeURIComponent(id), { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
    if (!r || !r.length) throw new Error(X("لم يُحدَّث السجل (لا صلاحية أو لم يعد موجوداً).", "Enregistrement non mis à jour (accès refusé ou introuvable)."));
    const i = S.rows.findIndex(x => x.id === id); if (i >= 0) S.rows[i] = r[0]; return r[0];
  }
  const by = id => S.rows.find(r => r.id === id);
  const who = r => (r.contact_name || r.company || "—");

  /* ── ترتيب وتصفية ── */
  function list() {
    const q = S.q.trim().toLowerCase(), qd = q.replace(/\D/g, "");
    let L = S.rows.filter(r => (!S.st || r.status === S.st) && (!S.co || r.company === S.co) && (!S.lg || r.language === S.lg) && (!S.cp || r.campaign === S.cp) &&
      (!q || [r.company, r.contact_name, r.phone, r.country, r.subject, r.body, r.campaign].some(x => String(x || "").toLowerCase().includes(q)) || !!(qd && r.phone.includes(qd))));
    return L.sort((a, b) => S.sort === "new" ? String(b.prepared_at).localeCompare(String(a.prepared_at)) : (b.priority - a.priority) || String(a.prepared_at).localeCompare(String(b.prepared_at)));
  }
  /* ── حارس التكرار ── */
  function guard(r) {
    const w = [], same = S.rows.filter(x => x.phone === r.phone && x.id !== r.id);
    if (r.status === "cancelled") return { block: true, warn: [X("هذه الرسالة ملغاة.", "Ce message est annulé.")] };
    if (["sent", "waiting", "positive", "negative"].includes(r.status)) w.push(X("هذه الرسالة سُجّلت مُرسَلة بتاريخ " + fmtD(r.sent_at) + ".", "Ce message est enregistré comme envoyé le " + fmtD(r.sent_at) + "."));
    const rec = same.filter(x => x.sent_at && Date.now() - new Date(x.sent_at).getTime() < GUARD).sort((a, b) => String(b.sent_at).localeCompare(String(a.sent_at)))[0];
    if (rec) w.push(X("أُرسلت رسالة لهذه الجهة " + ago(rec.sent_at) + " (" + stl(rec.status) + ").\nآخر نص مُرسَل: " + String(rec.sent_body || rec.body).slice(0, 160), "Un message a été envoyé à ce contact " + ago(rec.sent_at) + " (" + stl(rec.status) + ").\nDernier texte envoyé : " + String(rec.sent_body || rec.body).slice(0, 160)));
    if (r.kind === "first_contact" && same.some(x => x.kind === "first_contact" && x.sent_at)) w.push(X("سبق إرسال رسالة «أول تواصل» لهذه الجهة.", "Un message « Premier contact » a déjà été envoyé à ce contact."));
    const op = same.find(x => x.status === "opened" && x.opened_at && Date.now() - new Date(x.opened_at).getTime() < DAY);
    if (op) w.push(X("فُتحت محادثة WhatsApp لرسالة أخرى لهذه الجهة " + ago(op.opened_at) + " ولم تؤكَّد نتيجتها.", "Une conversation WhatsApp a été ouverte pour un autre message de ce contact " + ago(op.opened_at) + " sans confirmation du résultat."));
    if (r.status === "opened" && r.opened_at && Date.now() - new Date(r.opened_at).getTime() < DAY) w.push(X("فُتحت هذه الرسالة " + ago(r.opened_at) + " ولم تؤكَّد بعد (لا نعرف إن أُرسلت).", "Ce message a été ouvert " + ago(r.opened_at) + " sans confirmation (on ne sait pas s'il a été envoyé)."));
    return { block: false, warn: w };
  }
  const curText = r => S.custom != null ? S.custom : r.body;

  /* ── الواجهة ── */
  const css = () => {
    if ($("waqsin-css")) return; const st = document.createElement("style"); st.id = "waqsin-css"; const P = ":is(#waqsin,#wqi-m) ";
    st.textContent = [".wi-row{display:flex;gap:.6rem;align-items:center;justify-content:space-between;padding:.7rem .8rem;border:1px solid rgba(128,128,128,.28);border-radius:14px;margin:.45rem 0;cursor:pointer}.wi-row:hover{border-color:rgba(37,211,102,.7)}.wi-nm{font-weight:800}.wi-sub{font-size:.8rem;opacity:.75}.wi-pill{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.74rem;font-weight:800;color:#fff;white-space:nowrap}",
      ".wi-go{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;min-height:52px;border-radius:14px;background:#25d366;color:#07310f;font-weight:900;font-size:1.05rem;text-decoration:none;border:0;box-shadow:inset 0 -3px 0 rgba(0,0,0,.22)}.wi-go.off{background:#9ca3af;color:#1f2937;pointer-events:none;box-shadow:none}",
      "textarea,input[type=text],input[type=search],select{width:100%;box-sizing:border-box;background:rgba(128,128,128,.12);color:inherit;border:1px solid rgba(128,128,128,.35);border-radius:10px;padding:.55rem .65rem;font:inherit}textarea{min-height:130px;resize:vertical;line-height:1.7}",
      ".wi-warn{border:1px solid #d97706;background:rgba(217,119,6,.14);border-radius:12px;padding:.6rem .75rem;margin:.6rem 0;white-space:pre-line;line-height:1.7}.wi-bad{border-color:#dc2626;background:rgba(220,38,38,.14)}",
      ".wi-chip{display:inline-flex;align-items:center;gap:.35rem;padding:.3rem .7rem;border-radius:999px;border:1px solid rgba(128,128,128,.4);cursor:pointer;margin:.15rem;font-size:.82rem;font-weight:700}.wi-chip.on{outline:2px solid currentColor;font-weight:900}",
      ".wi-prev{white-space:pre-wrap;border-radius:14px;padding:.7rem .85rem;background:rgba(37,211,102,.14);border:1px solid rgba(37,211,102,.4);line-height:1.7;min-height:2.4rem}.wi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.5rem;margin:.5rem 0}",
      ".wi-h{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}.wi-h h2{margin:0;flex:1 1 100%}",
      ".wi-q{display:grid;grid-template-columns:1.2fr 1.2fr .6fr 1fr 1.1fr;gap:.5rem;align-items:center}.wi-qh{font-size:.78rem;opacity:.7;font-weight:800;padding:0 .8rem;cursor:default;border:0}"
    ].map(r => r.replace(/(^|\})([^@}{][^{]*)\{/g, (m, a, sel) => a + sel.split(",").map(x => P + x).join(",") + "{")).join("") + "@media(max-width:700px){" + P + ".wi-row{flex-direction:column;align-items:flex-start}" + P + ".wi-q{grid-template-columns:1fr 1fr;width:100%}" + P + ".wi-qh{display:none}}";
    document.head.appendChild(st);
  };
  const pill = k => '<span class="wi-pill" style="background:' + (ST[k] ? ST[k][2] : "#6b7280") + '">' + esc(stl(k)) + "</span>";
  function draw() {
    const h = $("waqsin-content"); if (!h) return; css();
    const r = S.sel && by(S.sel); if (S.sel && !r) S.sel = null;
    h.innerHTML = '<div id="waqsin" class="card">' + (S.err ? '<div class="wi-warn wi-bad">' + esc(S.err) + "</div>" : "") + (S.busy && !S.loaded ? '<p class="hint">' + X("جارٍ التحميل…", "Chargement…") + "</p>" : (r ? detail(r) : home())) + "</div>"; bind();
  }
  function home() {
    const cnt = {}; S.rows.forEach(r => { cnt[r.status] = (cnt[r.status] || 0) + 1; });
    const cos = [...new Set(S.rows.map(r => r.company).filter(Boolean))].sort(), cps = [...new Set(S.rows.map(r => r.campaign).filter(Boolean))].sort(), lgs = [...new Set(S.rows.map(r => r.language))].sort();
    const L = list(), shown = L.slice(0, S.more);
    const chip = (k, lab, n) => '<span class="wi-chip' + (S.st === k ? " on" : "") + '" data-wi="st" data-k="' + k + '"><span>' + esc(lab) + "</span><b>" + n + "</b></span>";
    let h = '<div class="wi-h"><h2>' + X("صندوق الرسائل الخاص", "Boîte de messages privée") + '</h2><button class="small gold" type="button" data-wi="imp">' + X("استيراد دفعة (CSV / JSON)", "Importer un lot (CSV / JSON)") + '</button><button class="small gray" type="button" data-wi="api">' + X("الاستيراد المباشر (API)", "Import direct (API)") + '</button><button class="small gray" type="button" data-wi="refresh">' + X("تحديث", "Actualiser") + "</button></div>" +
      '<p class="hint">' + X("يستقبل الرسائل المُعدّة مسبقاً ويحفظها في قاعدة البيانات (للمالك وحده). فتح WhatsApp لا يعني الإرسال: تؤكّد أنت «Sent» بعد الإرسال اليدوي.", "Reçoit les messages préparés à l'avance et les enregistre dans la base de données (propriétaire uniquement). Ouvrir WhatsApp ne signifie pas l'envoi : vous confirmez « Sent » après l'envoi manuel.") + "</p><div>" +
      chip("", X("الكل", "Tous"), S.rows.length) + ORDER.map(k => chip(k, stl(k), cnt[k] || 0)).join("") + "</div>" +
      '<div class="wi-grid"><input type="search" id="wi-q" placeholder="' + X("بحث بالاسم أو الشركة أو الرقم أو النص", "Rechercher par nom, société, numéro ou texte") + '" value="' + esc(S.q) + '">' +
      '<select id="wi-co"><option value="">' + X("كل الشركات", "Toutes les sociétés") + "</option>" + cos.map(x => '<option value="' + esc(x) + '"' + (S.co === x ? " selected" : "") + ">" + esc(x) + "</option>").join("") + "</select>" +
      '<select id="wi-lg"><option value="">' + X("كل اللغات", "Toutes les langues") + "</option>" + lgs.map(x => '<option value="' + x + '"' + (S.lg === x ? " selected" : "") + ">" + esc(LG[x] || x) + "</option>").join("") + "</select>" +
      '<select id="wi-cp"><option value="">' + X("كل الحملات", "Toutes les campagnes") + "</option>" + cps.map(x => '<option value="' + esc(x) + '"' + (S.cp === x ? " selected" : "") + ">" + esc(x) + "</option>").join("") + "</select>" +
      '<select id="wi-so"><option value="prio"' + (S.sort === "prio" ? " selected" : "") + ">" + X("الأولوية ثم تاريخ الإعداد", "Priorité puis date de préparation") + '</option><option value="new"' + (S.sort === "new" ? " selected" : "") + ">" + X("الأحدث إعداداً أولاً", "Plus récents d'abord") + "</option></select></div>" +
      '<div class="hint">' + shown.length + X(" من ", " sur ") + L.length + X(" رسالة", " message(s)") + "</div>";
    h += L.length ? '<div class="wi-row wi-qh wi-q"><span>' + X("الشركة", "Société") + "</span><span>" + X("جهة الاتصال", "Contact") + "</span><span>" + X("اللغة", "Langue") + "</span><span>" + X("نوع التواصل", "Type") + "</span><span>" + X("الحالة", "Statut") + "</span></div>" +
      shown.map(r => '<div class="wi-row" data-wi="open" data-id="' + esc(r.id) + '"><div class="wi-q" style="width:100%"><span class="wi-nm">' + esc(r.company || "—") + (r.priority > 0 ? ' <span class="wi-pill" style="background:#f59e0b">P' + r.priority + "</span>" : "") + "</span><span>" + esc(r.contact_name || "—") + '</span><span><span class="wi-pill" style="background:#0ea5e9">' + esc(r.language.toUpperCase()) + "</span></span><span>" + esc(kdl(r.kind)) + (r.subject ? '<div class="wi-sub">' + esc(r.subject) + "</div>" : "") + "</span><span>" + pill(r.status) + '<div class="wi-sub">' + esc(fmtD(r.prepared_at)) + "</div></span></div></div>").join("") + (L.length > shown.length ? '<button class="small gray" type="button" data-wi="more">' + X("عرض المزيد", "Afficher plus") + "</button>" : "")
      : '<div class="em">' + (S.rows.length ? X("لا رسائل مطابقة.", "Aucun message correspondant.") : X("الصندوق فارغ. استورد دفعة رسائل مُعدّة مسبقاً.", "La boîte est vide. Importez un lot de messages préparés.")) + "</div>";
    return h;
  }
  function detail(r) {
    const g = guard(r), txt = curText(r), same = S.rows.filter(x => x.phone === r.phone && x.id !== r.id).sort((a, b) => String(a.prepared_at).localeCompare(String(b.prepared_at)));
    const parent = r.parent_id && by(r.parent_id), locked = ["sent", "waiting", "positive", "negative", "followup"].includes(r.status);
    const can = { sent: ["ready", "opened"].includes(r.status), next: ["sent", "waiting", "positive", "negative", "followup"].includes(r.status), cancel: r.status !== "cancelled" };
    const lg = (S.logs[r.id] || []).map(l => esc(fmtD(l.at)) + " — " + esc(l.from_status ? stl(l.from_status) + " → " : "") + esc(stl(l.to_status))).join("<br>");
    return '<div class="wi-h"><button class="small gray" type="button" data-wi="back">' + X("← القائمة", "← Liste") + "</button><h2>" + esc(who(r)) + (r.company && r.contact_name ? " · " + esc(r.company) : "") + '</h2><button class="small gray" type="button" data-wi="edit"' + (locked ? " disabled" : "") + ">" + X("تعديل", "Modifier") + '</button><button class="small danger" type="button" data-wi="del">' + X("حذف", "Supprimer") + "</button></div>" +
      '<div class="wi-sub" dir="ltr" style="text-align:start;margin:.3rem 0">+' + esc(r.phone) + (r.country ? " · " + esc(r.country) : "") + ' · <span dir="auto">' + esc(LG[r.language] || r.language) + "</span> · " + esc(kdl(r.kind)) + (r.campaign ? " · " + esc(r.campaign) : "") + "</div>" +
      '<div style="margin:.4rem 0">' + pill(r.status) + ' <span class="wi-sub">' + X("أُعدّت ", "Préparé ") + esc(fmtD(r.prepared_at)) + (r.priority > 0 ? " · P" + r.priority : "") + (parent ? " · " + X("متابعة للرسالة: ", "Relance du message : ") + esc(kdl(parent.kind)) + " (" + esc(stl(parent.status)) + ")" : "") + "</span></div>" +
      (r.subject ? '<div class="wi-nm" dir="auto" style="margin:.3rem 0">' + esc(r.subject) + "</div>" : "") + (/^api:/.test(r.source || "") ? '<div class="wi-sub">' + X("المصدر: استيراد مباشر (", "Source : import direct (") + esc(String(r.source).slice(4)) + ")</div>" : "") +
      (g.warn.length ? '<div class="wi-warn' + (g.block ? " wi-bad" : "") + '">' + g.warn.map(esc).join("\n\n") + "</div>" : "") +
      '<div class="hint">' + X("الرسالة النهائية (كما ستظهر في WhatsApp)", "Message final (tel qu'il apparaîtra dans WhatsApp)") + '</div><div class="wi-prev" id="wi-prev" dir="auto">' + esc(txt) + "</div>" +
      '<div class="wi-h" style="margin:.4rem 0"><button class="small gray" type="button" data-wi="custom">' + (S.edit ? X("إخفاء المحرر", "Masquer l'éditeur") : X("تخصيص النص قبل الفتح (اختياري)", "Personnaliser le texte avant l'ouverture (facultatif)")) + "</button>" + (S.custom != null ? '<button class="small gray" type="button" data-wi="resetmsg">' + X("إعادة الرسالة الأصلية", "Rétablir le message d'origine") + "</button>" : "") + "</div>" +
      (S.edit ? '<textarea id="wi-msg" dir="auto">' + esc(txt) + "</textarea>" : "") +
      '<div style="margin:.7rem 0"><a id="wi-go" class="wi-go' + (g.block || !txt.trim() ? " off" : "") + '" href="' + (g.block || !txt.trim() ? "#" : esc(AdminWaqs.waUrl(r.phone, txt))) + '" target="_blank" rel="noopener noreferrer" data-wi="go">Open WhatsApp</a>' +
      '<div class="hint" style="margin-top:.35rem">' + X("يفتح المحادثة بالنص النهائي. فتحها لا يُسجَّل إرسالاً (تصير الحالة Opened فقط): راجع الرسالة وأرسلها بنفسك من WhatsApp Business، ثم عُد وأكّد.", "Ouvre la conversation avec le texte final. L'ouvrir n'enregistre pas un envoi (le statut devient seulement Opened) : relisez le message, envoyez-le vous-même depuis WhatsApp Business, puis revenez confirmer.") + "</div></div>" +
      (can.sent ? '<button class="small gold" type="button" data-wi="sent">' + X("تأكيد: أرسلتُ هذه الرسالة (Sent)", "Confirmer : j'ai envoyé ce message (Sent)") + "</button>" : "") +
      '<h3 style="margin:.8rem 0 .3rem">' + X("تحديث الحالة", "Mettre à jour le statut") + "</h3><div>" + (can.next ? ["waiting", "positive", "negative", "followup"].map(k => '<span class="wi-chip' + (r.status === k ? " on" : "") + '" data-wi="to" data-k="' + k + '" style="color:' + ST[k][2] + '">' + esc(stl(k)) + "</span>").join("") : "") + (can.cancel ? '<span class="wi-chip" data-wi="to" data-k="cancelled" style="color:' + ST.cancelled[2] + '">' + esc(stl("cancelled")) + "</span>" : "") + "</div>" +
      (r.status === "sent" || r.sent_body ? '<div class="wi-warn">' + X("نسخة الرسالة المُرسَلة فعلياً (", "Copie du message réellement envoyé (") + esc(fmtD(r.sent_at)) + "):\n" + esc(r.sent_body || "") + "</div>" : "") +
      '<h3 style="margin:.9rem 0 .3rem">' + X("سجل التواصل والمتابعات لهذه الجهة", "Historique des contacts et relances de ce contact") + "</h3>" +
      (same.length ? same.map(x => '<div class="wi-row" data-wi="open" data-id="' + esc(x.id) + '"><div><span class="wi-nm">' + esc(kdl(x.kind)) + '</span> <span class="wi-sub">' + esc(fmtD(x.prepared_at)) + '</span><div class="wi-sub" dir="auto">' + esc(String(x.body).slice(0, 120)) + "</div></div><div>" + pill(x.status) + "</div></div>").join("") : '<div class="em">' + X("لا رسائل أخرى لهذه الجهة.", "Aucun autre message pour ce contact.") + "</div>") +
      '<h3 style="margin:.9rem 0 .3rem">' + X("تغيّر حالات هذه الرسالة", "Changements de statut de ce message") + "</h3>" + (lg ? '<div class="wi-sub" style="line-height:1.9">' + lg + "</div>" : '<div class="em">' + X("لا تغييرات مسجَّلة.", "Aucun changement enregistré.") + "</div>");
  }
  /* ── النوافذ ── */
  function modal(html) { const old = $("wqi-modal"); if (old) old.remove(); const bg = document.createElement("div"); bg.id = "wqi-modal"; bg.className = "modal-bg open"; bg.innerHTML = '<div class="modal" style="max-width:620px" id="wqi-m">' + html + "</div>"; document.body.appendChild(bg); bg.addEventListener("click", e => { if (e.target === bg) bg.remove(); }); return bg; }
  function editForm(r) {
    const bg = modal("<h3>" + X("تعديل الرسالة", "Modifier le message") + '</h3><div class="field"><label>' + X("الموضوع", "Objet") + '</label><input type="text" id="ef-s" value="' + esc(r.subject) + '"></div><div class="field"><label>' + X("النص", "Texte") + '</label><textarea id="ef-b" dir="auto" style="min-height:190px">' + esc(r.body) + '</textarea></div><div class="wi-grid"><div class="field"><label>' + X("الأولوية (0-9)", "Priorité (0-9)") + '</label><input type="text" id="ef-p" inputmode="numeric" value="' + r.priority + '"></div></div><div id="ef-e" style="color:#dc2626;min-height:1.3rem"></div><div class="action-bar"><button class="small gold" type="button" id="ef-ok">' + X("حفظ", "Enregistrer") + '</button><button class="small gray" type="button" id="ef-no">' + X("إلغاء", "Annuler") + "</button></div>");
    bg.querySelector("#ef-no").onclick = () => bg.remove();
    bg.querySelector("#ef-ok").onclick = async () => { const b = bg.querySelector("#ef-b").value.trim(), p = parseInt(bg.querySelector("#ef-p").value, 10); if (!b) { bg.querySelector("#ef-e").textContent = X("اكتب نص الرسالة.", "Saisissez le texte du message."); return; } try { await patch(r.id, { subject: bg.querySelector("#ef-s").value.trim(), body: b, priority: isNaN(p) ? 0 : Math.max(0, Math.min(9, p)) }); S.custom = null; S.edit = false; bg.remove(); draw(); } catch (e) { bg.querySelector("#ef-e").textContent = nice(e); } };
  }
  /* ── الاستيراد: يقرأ JSON/CSV، يطبّع الهاتف، يتحقق محلياً، ثم يرسل الدفعة لدالة الخادم ويعرض تقريرها ── */
  const nz = t => String(t || "").toLowerCase().replace(/[\s_\-.]+/g, "");
  const AL = { company: ["company", "societe", "société", "entreprise", "الشركة", "شركة"], contact: ["contact", "contactname", "name", "person", "recipient", "nom", "الاسم", "جهةالاتصال", "المستلم"], phone: ["phone", "mobile", "tel", "telephone", "whatsapp", "number", "الهاتف", "رقمالهاتف", "الرقم", "واتساب"], country: ["country", "pays", "الدولة", "البلد"], language: ["language", "lang", "langue", "اللغة"], kind: ["kind", "type", "messagetype", "contacttype", "نوعالتواصل", "نوعالرسالة", "النوع"], subject: ["subject", "title", "objet", "الموضوع", "العنوان"], body: ["body", "message", "text", "messagetext", "finalmessage", "النص", "الرسالة", "نصالرسالة"], priority: ["priority", "prio", "الأولوية"], prepared_at: ["preparedat", "prepared", "date", "createdat", "تاريخالإعداد"], campaign: ["campaign", "campagne", "الحملة"], ref: ["ref", "id", "messageid", "reference", "المرجع"], parent_ref: ["parentref", "parent", "followupof", "replyto", "parentid", "متابعةل"], notes: ["notes", "note", "ملاحظات"] };
  function normRows(text, dk, defCampaign) {
    const t = String(text || "").replace(/^﻿/, "").trim(); if (!t) return { rows: [], err: "", batch: "" };
    let objs, batch = "", dcp = defCampaign || "", dcountry = "";
    if (t[0] === "[" || t[0] === "{") { let j; try { j = JSON.parse(t); } catch (_) { return { rows: [], err: X("ملف JSON غير صالح.", "JSON invalide."), batch: "" }; } if (Array.isArray(j)) objs = j; else { objs = j.messages || j.items || j.data || []; batch = String(j.batch || ""); dcp = dcp || String(j.campaign || ""); dcountry = String(j.country || ""); } }
    else { const r = AdminWaqs.parseCsv(t); if (r.length < 2) return { rows: [], err: X("لا صفوف: ضع عناوين الأعمدة في الصف الأول.", "Aucune ligne : mettez les en-têtes de colonnes en première ligne."), batch: "" }; const h = r[0]; objs = r.slice(1).map(a => { const o = {}; h.forEach((k, i) => { o[k] = a[i]; }); return o; }); }
    const rows = objs.filter(o => o && typeof o === "object").map(o => { const x = {}; Object.keys(AL).forEach(k => { const al = AL[k].map(nz), key = Object.keys(o).find(z => al.includes(nz(z))); x[k] = key == null || o[key] == null ? "" : String(o[key]).trim(); }); if (!x.campaign) x.campaign = dcp; if (!x.country) x.country = dcountry; const p = AdminWaqs.normPhone(x.phone, x.country || dk); x.phone = p.num || x.phone; return x; });
    return { rows, err: "", batch };
  }
  function localCheck(x) { const bad = []; if (!/^[1-9][0-9]{7,14}$/.test(String(x.phone).replace(/\D/g, ""))) bad.push("phone"); if (!x.body) bad.push("body"); if (!x.language) bad.push("language"); if (!x.company && !x.contact) bad.push("company/contact"); return bad; }
  function importForm() {
    const bg = modal("<h3>" + X("استيراد دفعة رسائل", "Importer un lot de messages") + '</h3><p class="hint">' + X("الصق JSON أو CSV أو اختر ملفاً. الحقول: company، contact، phone (دولي)، country، language (en/fr/ar)، kind، subject، body، priority، prepared_at، campaign، ref، parent_ref. يُتحقَّق من كل صف على الخادم، وتُتخطّى المكرَّرة.", "Collez du JSON ou du CSV, ou choisissez un fichier. Champs : company, contact, phone (international), country, language (en/fr/ar), kind, subject, body, priority, prepared_at, campaign, ref, parent_ref. Chaque ligne est vérifiée côté serveur et les doublons sont ignorés.") + '</p><textarea id="im-t" dir="auto" style="min-height:130px" placeholder="' + X("الصق الدفعة هنا", "Collez le lot ici") + '"></textarea><input type="file" id="im-f" accept=".csv,.txt,.json,text/csv,application/json" style="margin:.4rem 0"><div class="wi-grid"><div class="field"><label>' + X("اسم الدفعة", "Nom du lot") + '</label><input type="text" id="im-b"></div><div class="field"><label>' + X("الحملة الافتراضية", "Campagne par défaut") + '</label><input type="text" id="im-c"></div><div class="field"><label>' + X("الدولة الافتراضية للأرقام المحلية", "Pays par défaut des numéros locaux") + '</label><input type="text" id="im-k" value="الجزائر"></div></div><div id="im-r" class="hint" style="white-space:pre-line;margin:.5rem 0"></div><div class="action-bar"><button class="small gold" type="button" id="im-ok" disabled>' + X("استيراد", "Importer") + '</button><button class="small gray" type="button" id="im-no">' + X("إغلاق", "Fermer") + "</button></div>");
    const q = s => bg.querySelector(s); let P = null;
    const run = () => { P = normRows(q("#im-t").value, q("#im-k").value.trim(), q("#im-c").value.trim()); if (P.err) { q("#im-r").textContent = P.err; q("#im-ok").disabled = true; return; } if (!P.rows.length) { q("#im-r").textContent = ""; q("#im-ok").disabled = true; return; } if (P.rows.length > 5000) { q("#im-r").textContent = X("الحد 5000 رسالة للدفعة.", "Maximum 5000 messages par lot."); q("#im-ok").disabled = true; return; }
      const bad = P.rows.map((x, i) => ({ i: i + 1, w: localCheck(x) })).filter(x => x.w.length); q("#im-r").textContent = X("الصفوف: ", "Lignes : ") + P.rows.length + X("\nصالحة مبدئياً: ", "\nValides a priori : ") + (P.rows.length - bad.length) + X("\nتحتاج تصحيحاً (تُرفض): ", "\nÀ corriger (rejetées) : ") + bad.length + (bad.length ? "\n" + bad.slice(0, 5).map(x => "#" + x.i + ": " + x.w.join(", ")).join("\n") : ""); q("#im-ok").disabled = false; };
    ["#im-t", "#im-k", "#im-c"].forEach(s => { q(s).oninput = run; });
    q("#im-f").onchange = async e => { const f = e.target.files && e.target.files[0]; if (!f) return; q("#im-t").value = await f.text(); if (!q("#im-b").value) q("#im-b").value = f.name.replace(/\.[a-z0-9]+$/i, ""); run(); };
    q("#im-no").onclick = () => bg.remove();
    q("#im-ok").onclick = async () => {
      if (!P || !P.rows.length) return; q("#im-ok").disabled = true; q("#im-r").textContent = X("جارٍ الاستيراد…", "Importation…");
      const batch = q("#im-b").value.trim() || P.batch || ("batch-" + new Date().toISOString().slice(0, 16)); const tot = { total: 0, inserted: 0, duplicates: 0, invalid: 0, new_contacts: 0, existing_contacts: 0, errors: [] };
      try {
        for (let o = 0; o < P.rows.length; o += 500) {
          const rep = await rq("/rest/v1/rpc/owner_inbox_import", { method: "POST", body: JSON.stringify({ p_batch: batch, p_rows: P.rows.slice(o, o + 500) }) });
          ["total", "inserted", "duplicates", "invalid", "new_contacts", "existing_contacts"].forEach(k => { tot[k] += Number(rep[k] || 0); }); (rep.errors || []).forEach(e => { if (tot.errors.length < 50) tot.errors.push({ row: Number(e.row) + o, reason: e.reason }); });
        }
      } catch (e) { q("#im-r").textContent = (e.status === 403 || /unauthorized/.test(e.message)) ? X("مرفوض: هذه الدالة للمالك وحده.", "Refusé : cette fonction est réservée au propriétaire.") : nice(e); q("#im-ok").disabled = false; return; }
      q("#im-r").textContent = X("تقرير الاستيراد", "Rapport d'importation") + "\n" + X("الصفوف: ", "Lignes : ") + tot.total + X("\nرسائل جديدة: ", "\nNouveaux messages : ") + tot.inserted + X("\nمكرَّرة (متخطّاة): ", "\nDoublons (ignorés) : ") + tot.duplicates + X("\nمرفوضة: ", "\nRejetés : ") + tot.invalid + X("\nجهات جديدة: ", "\nNouveaux contacts : ") + tot.new_contacts + X("\nجهات موجودة: ", "\nContacts existants : ") + tot.existing_contacts + (tot.errors.length ? "\n" + tot.errors.slice(0, 20).map(e => "#" + e.row + ": " + e.reason).join("\n") : "");
      q("#im-no").textContent = X("إغلاق", "Fermer"); S.st = "ready"; S.sel = null; await load();
    };
  }
  /* ── الاستيراد المباشر برمز: يُنشئ المالك رمزاً (يُعرَض مرة واحدة وتُخزَّن تجزئته فقط) تستعمله أداة خارجية لإضافة رسائل جاهزة بلا نسخ ولصق ── */
  const ingestUrl = () => (typeof API !== "undefined" && API.sb ? API.sb.url("/rest/v1/rpc/owner_inbox_ingest") : "");
  function openapi() {
    const base = (typeof CONFIG !== "undefined" && CONFIG.SUPABASE_URL || "").replace(/\/$/, ""), key = typeof CONFIG !== "undefined" ? (CONFIG.SUPABASE_ANON_KEY || "") : "";
    const row = { type: "object", required: ["phone", "language", "body"], properties: { ref: { type: "string", description: "Unique id of this message inside the inbox (prevents duplicates on re-import)." }, parent_ref: { type: "string", description: "ref of the first message this one follows up." }, company: { type: "string" }, contact: { type: "string", description: "Target person name." }, phone: { type: "string", description: "International phone, e.g. +213550123456." }, country: { type: "string" }, language: { type: "string", enum: ["en", "fr", "ar"] }, kind: { type: "string", enum: ["first_contact", "follow_up", "reply", "meeting", "offer", "thank_you", "closing", "other"] }, subject: { type: "string" }, body: { type: "string", description: "Final personalized message text." }, priority: { type: "integer", minimum: 0, maximum: 9 }, prepared_at: { type: "string", format: "date-time" }, campaign: { type: "string" }, notes: { type: "string" } } };
    return { openapi: "3.1.0", info: { title: "ALYSSUM Owner Inbox — add prepared messages", version: "1.0.0", description: "Write-only: adds messages with status Ready to Send. It cannot read, edit, delete or send anything; sending stays manual." },
      servers: [{ url: base }], security: [{ IngestToken: [] }],
      paths: { "/rest/v1/rpc/owner_inbox_ingest": { post: { operationId: "addInboxMessages", summary: "Add a batch of prepared messages (max 500) to the owner inbox", parameters: [{ name: "apikey", in: "header", required: true, schema: { type: "string", enum: [key] } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["p_batch", "p_rows"], properties: { p_batch: { type: "string", description: "Batch name, e.g. 2026-11-25-spring-eu" }, p_rows: { type: "array", maxItems: 500, items: row } } } } } }, responses: { "200": { description: "Import report: total, inserted, duplicates, invalid, new_contacts, existing_contacts, errors[]" } } } } },
      components: { securitySchemes: { IngestToken: { type: "apiKey", in: "header", name: "x-ingest-token" } } } };
  }
  const copy = async txt => { try { await navigator.clipboard.writeText(txt); return true; } catch (_) { try { const t = document.createElement("textarea"); t.value = txt; document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok; } catch (e) { return false; } } };
  function apiForm() {
    const bg = modal("<h3>" + X("الاستيراد المباشر (API)", "Import direct (API)") + '</h3><p class="hint">' + X("يتيح لأداة خارجية (مثل إجراء Custom GPT أو سكربت) إضافة رسائل مُعدّة مسبقاً إلى «جاهزة للإرسال» دون نسخ ولصق. الرمز «للكتابة فقط»: يضيف رسائل بحالة Ready ولا يقرأ ولا يعدّل ولا يحذف ولا يرسل شيئاً. يُعرَض عند إنشائه مرة واحدة فقط، ويمكن إلغاؤه فوراً.", "Permet à un outil externe (par ex. une action Custom GPT ou un script) d'ajouter des messages préparés dans « Prêts à envoyer » sans copier-coller. Le jeton est en écriture seule : il ajoute des messages au statut Ready, sans rien lire, modifier, supprimer ni envoyer. Il n'est affiché qu'une seule fois à sa création et peut être révoqué immédiatement.") + '</p><div class="field"><label>' + X("عنوان الاستيراد (POST)", "Adresse d'import (POST)") + '</label><input type="text" id="ap-u" readonly dir="ltr" value="' + esc(ingestUrl()) + '"></div><p class="hint" dir="ltr" style="text-align:start">headers: apikey: &lt;public key&gt; · x-ingest-token: &lt;token&gt; · body: {"p_batch":"…","p_rows":[…]}</p><div class="wi-h" style="margin:.4rem 0"><button class="small gray" type="button" id="ap-oa">' + X("نسخ مخطط OpenAPI لإجراء Custom GPT", "Copier le schéma OpenAPI pour une action Custom GPT") + '</button></div><h3 style="margin:.8rem 0 .3rem">' + X("رموز الاستيراد", "Jetons d'import") + '</h3><div id="ap-l"></div><div class="wi-grid"><div class="field"><label>' + X("اسم الرمز الجديد", "Nom du nouveau jeton") + '</label><input type="text" id="ap-n" placeholder="chatgpt"></div><div class="field" style="align-self:end"><button class="small gold" type="button" id="ap-c">' + X("إنشاء رمز", "Créer un jeton") + '</button></div></div><div id="ap-t"></div><div id="ap-e" style="color:#dc2626;min-height:1.3rem"></div><div class="action-bar"><button class="small gray" type="button" id="ap-x">' + X("إغلاق", "Fermer") + "</button></div>");
    const q = s => bg.querySelector(s);
    const list = async () => { try { const L = await rq("/rest/v1/owner_inbox_tokens?select=id,label,created_at,last_used_at,revoked_at&order=created_at.desc") || []; q("#ap-l").innerHTML = L.length ? L.map(t => '<div class="wi-row" style="cursor:default"><div><span class="wi-nm">' + esc(t.label) + '</span> <span class="wi-pill" style="background:' + (t.revoked_at ? "#6b7280" : "#16a34a") + '">' + esc(t.revoked_at ? X("ملغى", "Révoqué") : X("نشط", "Actif")) + '</span><div class="wi-sub">' + esc(X("أُنشئ ", "Créé ") + fmtD(t.created_at) + " · " + (t.last_used_at ? X("آخر استعمال ", "Dernier usage ") + ago(t.last_used_at) : X("لم يُستعمل بعد", "Jamais utilisé"))) + "</div></div>" + (t.revoked_at ? "" : '<button class="small danger" type="button" data-rv="' + esc(t.id) + '">' + X("إلغاء", "Révoquer") + "</button>") + "</div>").join("") : '<div class="em">' + X("لا رموز بعد.", "Aucun jeton pour l'instant.") + "</div>"; } catch (e) { q("#ap-e").textContent = nice(e); } };
    list();
    q("#ap-x").onclick = () => bg.remove();
    q("#ap-oa").onclick = async () => { const ok = await copy(JSON.stringify(openapi(), null, 2)); q("#ap-e").style.color = ok ? "#16a34a" : "#dc2626"; q("#ap-e").textContent = ok ? X("نُسخ المخطط. الصقه في إعداد الإجراء (Actions) واختر المصادقة: API Key، ترويسة مخصّصة باسم x-ingest-token، وضع الرمز.", "Schéma copié. Collez-le dans la configuration de l'action et choisissez l'authentification : API Key, en-tête personnalisé x-ingest-token, avec votre jeton.") : X("تعذّر النسخ.", "Copie impossible."); };
    q("#ap-c").onclick = async () => { const lb = q("#ap-n").value.trim(); q("#ap-e").style.color = "#dc2626"; if (!lb) { q("#ap-e").textContent = X("اكتب اسماً للرمز.", "Saisissez un nom pour le jeton."); return; } try { const r = await rq("/rest/v1/rpc/owner_inbox_token_create", { method: "POST", body: JSON.stringify({ p_label: lb }) }); q("#ap-e").textContent = ""; q("#ap-n").value = ""; q("#ap-t").innerHTML = '<div class="wi-warn"><b>' + X("الرمز (يُعرَض الآن مرة واحدة فقط — انسخه واحفظه في مكان آمن):", "Jeton (affiché une seule fois maintenant — copiez-le et gardez-le en lieu sûr) :") + '</b><input type="text" id="ap-tk" readonly dir="ltr" value="' + esc(r.token) + '" style="margin:.4rem 0"><button class="small gold" type="button" id="ap-cp">' + X("نسخ الرمز", "Copier le jeton") + "</button></div>"; q("#ap-tk").onclick = () => q("#ap-tk").select(); q("#ap-cp").onclick = async () => { await copy(r.token); toast(X("✅ نُسخ الرمز", "✅ Jeton copié")); }; list(); } catch (e) { q("#ap-e").textContent = /too_many_tokens/.test(e.message) ? X("بلغتَ حدّ 10 رموز نشطة؛ ألغِ رمزاً أولاً.", "Limite de 10 jetons actifs atteinte ; révoquez-en un d'abord.") : /duplicate|unique|label_u/i.test(e.message) ? X("اسم الرمز مستعمل لرمز نشط.", "Ce nom est déjà utilisé par un jeton actif.") : nice(e); } };
    bg.addEventListener("click", async e => { const b = e.target.closest && e.target.closest("[data-rv]"); if (!b) return; if (!confirm(X("إلغاء هذا الرمز؟ ستتوقف عنه أي أداة تستعمله فوراً.", "Révoquer ce jeton ? Tout outil qui l'utilise sera immédiatement bloqué."))) return; try { await rq("/rest/v1/rpc/owner_inbox_token_revoke", { method: "POST", body: JSON.stringify({ p_id: b.dataset.rv }) }); list(); } catch (er) { q("#ap-e").textContent = nice(er); } });
  }
  /* ── الأحداث ── */
  function refreshGo(r) { const a = $("wi-go"), pv = $("wi-prev"), g = guard(r), t = curText(r), ok = !g.block && t.trim(); if (pv) pv.textContent = t; if (a) { a.classList.toggle("off", !ok); a.href = ok ? AdminWaqs.waUrl(r.phone, t) : "#"; } }
  async function act(fn) { try { await fn(); } catch (e) { S.err = nice(e); draw(); } }
  function bind() {
    const h = $("waqsin"); if (!h) return; const r = S.sel && by(S.sel);
    const q = $("wi-q"); if (q) q.oninput = () => { S.q = q.value; S.more = PAGE; const pos = q.selectionStart; draw(); const n = $("wi-q"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) { } } };
    [["wi-co", "co"], ["wi-lg", "lg"], ["wi-cp", "cp"], ["wi-so", "sort"]].forEach(([id, k]) => { const e = $(id); if (e) e.onchange = () => { S[k] = e.value; S.more = PAGE; draw(); }; });
    if (r) { const t = $("wi-msg"); if (t) t.oninput = () => { S.custom = t.value; refreshGo(r); }; }
    h.onclick = async e => {
      const b = e.target.closest && e.target.closest("[data-wi]"); if (!b) return; const a = b.dataset.wi;
      if (a === "imp") return importForm(); if (a === "api") return apiForm(); if (a === "refresh") return load(); if (a === "more") { S.more += PAGE; return draw(); }
      if (a === "st") { S.st = b.dataset.k; S.more = PAGE; return draw(); }
      if (a === "open") { S.sel = b.dataset.id; S.custom = null; S.edit = false; draw(); const x = by(S.sel); if (x) loadLogs(x.phone); return; }
      if (a === "back") { S.sel = null; S.custom = null; S.edit = false; return draw(); }
      if (!r) return;
      if (a === "edit") return editForm(r);
      if (a === "custom") { S.edit = !S.edit; if (S.edit && S.custom == null) S.custom = r.body; return draw(); }
      if (a === "resetmsg") { S.custom = null; S.edit = false; return draw(); }
      if (a === "del") { if (confirm(X("حذف هذه الرسالة وسجلّها نهائياً؟", "Supprimer définitivement ce message et son historique ?"))) await act(async () => { await rq("/rest/v1/owner_inbox?id=eq." + encodeURIComponent(r.id), { method: "DELETE" }); S.rows = S.rows.filter(x => x.id !== r.id); S.sel = null; draw(); }); return; }
      if (a === "to") { const k = b.dataset.k; if (k === "cancelled" && !confirm(X("إلغاء هذه الرسالة؟", "Annuler ce message ?"))) return; await act(async () => { await patch(r.id, { status: k }); draw(); loadLogs(r.phone); }); return; }
      if (a === "sent") { const t = curText(r).trim(); if (!t) return; if (!confirm(X("هل أرسلتَ هذه الرسالة فعلاً من WhatsApp؟\nسيُسجَّل «Sent» ونسخة النص المُرسَل.", "Avez-vous réellement envoyé ce message depuis WhatsApp ?\n« Sent » et la copie du texte envoyé seront enregistrés."))) return; await act(async () => { await patch(r.id, { status: "sent", sent_body: t }); S.custom = null; S.edit = false; draw(); loadLogs(r.phone); toast(X("✅ سُجّل الإرسال", "✅ Envoi enregistré")); }); return; }
      if (a === "go") {
        const g = guard(r), t = curText(r).trim(); if (g.block || !t) { e.preventDefault(); return; }
        if (g.warn.length && !confirm(g.warn.join("\n\n") + X("\n\nهل تريد فتح WhatsApp؟", "\n\nVoulez-vous ouvrir WhatsApp ?"))) { e.preventDefault(); return; }
        if (r.status === "ready") act(async () => { await patch(r.id, { status: "opened" }); setTimeout(draw, 400); loadLogs(r.phone); });
      }
    };
  }
  const open = () => { css(); if (!S.loaded) load(); else draw(); };
  try { new MutationObserver(() => { const el = $("tab-waqsin"); if (S.loaded && el && !el.classList.contains("hidden")) draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] }); } catch (_) { }
  const wrap = () => { if (typeof Admin === "undefined" || Admin._waqsinWrapped) return; const orig = Admin.tab; Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-waqsin"); if (el) el.classList.toggle("hidden", t !== "waqsin"); if (t === "waqsin") open(); return r; }; Admin._waqsinWrapped = true; };
  if (typeof Admin !== "undefined") wrap(); else document.addEventListener("DOMContentLoaded", wrap);
  return { normRows, guard, localCheck, openapi, S, open, ST };
})();
