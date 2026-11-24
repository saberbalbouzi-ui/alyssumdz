/* WhatsApp Quick Sender — خاص بمالك المنصة فقط (لا يدخل حزم العملاء: owner_only في shared-files.json ويُحمَّل فقط حين CONFIG.SELLER).
   إرسال يدوي بلا Meta API ولا أي خدمة آلية: كل رسالة تُفتح في WhatsApp برابط https://wa.me/<رقم>?text=<نص مشفَّر>
   وأنت تراجعها وتضغط «إرسال» بنفسك داخل التطبيق. لا يُسجَّل «تم الإرسال» تلقائياً أبداً: حالة التواصل تُسجَّلها أنت بعد الإرسال.
   التخزين: مستند واحد في الإعدادات الخاصة (Priv مفتاح waqs) = { v, tpl, contacts:[{id,name,company,phone,country,notes,at,opened,draft,log:[{at,st,msg,note}]}] }. */
const AdminWaqs = (() => {
  if (typeof CONFIG === "undefined" || !CONFIG.SELLER) return { off: true };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KEY = "waqs", DAY = 864e5, GUARD = 3 * DAY;
  const ST = { sent: "تم الإرسال", wait: "بانتظار الرد", pos: "ردّ إيجابي", neg: "ردّ سلبي", none: "لا يوجد رد", out: "إلغاء التواصل", reopen: "أُعيد تفعيل التواصل" };
  const TONE = { sent: "#3b82f6", wait: "#d97706", pos: "#16a34a", neg: "#dc2626", none: "#6b7280", out: "#7c3aed", reopen: "#6b7280" };
  const PICK = ["sent", "wait", "pos", "neg", "none", "out"];
  const DIAL = { "الجزائر": "213", "dz": "213", "algeria": "213", "algerie": "213", "algérie": "213", "المغرب": "212", "ma": "212", "morocco": "212", "maroc": "212", "تونس": "216", "tn": "216", "tunisia": "216", "tunisie": "216", "ليبيا": "218", "ly": "218", "مصر": "20", "eg": "20", "egypt": "20", "السعودية": "966", "sa": "966", "saudi arabia": "966", "الإمارات": "971", "ae": "971", "uae": "971", "قطر": "974", "qa": "974", "الكويت": "965", "kw": "965", "فرنسا": "33", "fr": "33", "france": "33", "بلجيكا": "32", "be": "32", "إسبانيا": "34", "es": "34", "إيطاليا": "39", "it": "39", "ألمانيا": "49", "de": "49", "بريطانيا": "44", "uk": "44", "gb": "44", "كندا": "1", "ca": "1", "أمريكا": "1", "us": "1", "usa": "1", "تركيا": "90", "tr": "90", "turkey": "90" };
  /* ── الفرنسية: قاموس الوحدة نفسها (ملف للمالك فقط) يُطبَّق على النصوص الثابتة بعد كل رسم، والنصوص الديناميكية تمرّ عبر fr() ── */
  const fr = () => typeof AdminI18n !== "undefined" && AdminI18n.lang === "fr";
  const FR = {
    "مراسلة يدوية عبر WhatsApp وتسجيل نتيجة كل تواصل": "Messages WhatsApp manuels et suivi de chaque contact",
    "+ جهة اتصال": "+ Contact", "استيراد CSV": "Importer un CSV",
    "إرسال يدوي فقط: يُفتح WhatsApp برسالة مكتوبة مسبقاً وأنت تضغط «إرسال» بنفسك. لا يُسجَّل «تم الإرسال» إلا بتسجيلك.": "Envoi manuel uniquement : WhatsApp s'ouvre avec un message pré-rédigé et c'est vous qui appuyez sur « Envoyer ». « Envoyé » n'est enregistré que par vous.",
    "كل الحالات": "Tous les statuts", "بلا تواصل بعد": "Aucun contact pour l'instant", "كل الشركات": "Toutes les sociétés",
    "تم الإرسال": "Envoyé", "بانتظار الرد": "En attente de réponse", "ردّ إيجابي": "Réponse positive", "ردّ سلبي": "Réponse négative", "لا يوجد رد": "Aucune réponse", "إلغاء التواصل": "Ne plus contacter", "أُعيد تفعيل التواصل": "Contact réactivé", "بلا تواصل": "Sans contact",
    "لا نتائج مطابقة.": "Aucun résultat.", "لا جهات اتصال بعد. أضف جهة أو استورد ملف CSV.": "Aucun contact pour l'instant. Ajoutez-en un ou importez un fichier CSV.",
    "لم يُتواصل بعد": "Pas encore contacté", "← القائمة": "← Liste", "تعديل": "Modifier", "حذف": "Supprimer",
    "رفع إلغاء التواصل": "Lever le blocage de contact", "نص الرسالة": "Texte du message", "اكتب رسالتك هنا…": "Écrivez votre message ici…",
    "الاسم": "Nom", "الاسم الأول": "Prénom", "الشركة": "Société", "الهاتف": "Téléphone", "الدولة": "Pays",
    "حفظ كنص افتراضي لكل الجهات": "Enregistrer comme texte par défaut pour tous les contacts",
    "المعاينة (كما ستظهر في WhatsApp)": "Aperçu (tel qu'il apparaîtra dans WhatsApp)", "(رسالة فارغة)": "(message vide)",
    "فتح WhatsApp": "Ouvrir WhatsApp",
    "يفتح المحادثة مع الرقم والرسالة مكتوبة مسبقاً.": "Ouvre la conversation avec le numéro et le message pré-rédigé.", "لا يُسجَّل الإرسال تلقائياً": "L'envoi n'est pas enregistré automatiquement",
    ": راجع الرسالة واضغط «إرسال» داخل WhatsApp Business ثم عُد وسجّل النتيجة أدناه.": " : relisez le message, appuyez sur « Envoyer » dans WhatsApp Business, puis revenez enregistrer le résultat ci-dessous.",
    "تسجيل حالة التواصل": "Enregistrer le statut du contact", "ملاحظة (اختياري)": "Note (facultatif)", "تسجيل": "Enregistrer", "تاريخ التواصل": "Historique des contacts", "لا تواصل مسجَّل.": "Aucun contact enregistré.",
    "جهة اتصال جديدة": "Nouveau contact", "تعديل جهة اتصال": "Modifier le contact", "رقم الهاتف (دولي: +213…)": "Téléphone (international : +213…)", "ملاحظات": "Notes", "حفظ": "Enregistrer", "إلغاء": "Annuler", "إغلاق": "Fermer", "استيراد": "Importer",
    "استيراد جهات اتصال من CSV": "Importer des contacts depuis un CSV",
    "الأعمدة: الاسم، الشركة، الهاتف، الدولة، ملاحظات (بأي ترتيب إن كان في الصف الأول عناوين؛ وإلا بهذا الترتيب). ترميز UTF-8، والفاصل , أو ; أو Tab.": "Colonnes : nom, société, téléphone, pays, notes (dans n'importe quel ordre si la première ligne contient des en-têtes ; sinon dans cet ordre). Encodage UTF-8, séparateur , ou ; ou tabulation.",
    "الدولة الافتراضية للأرقام المحلية (تبدأ بصفر)": "Pays par défaut pour les numéros locaux (commençant par zéro)",
    "جارٍ التحميل…": "Chargement…", "الجزائر": "Algérie", "المغرب": "Maroc", "تونس": "Tunisie", "ليبيا": "Libye", "مصر": "Égypte", "السعودية": "Arabie saoudite", "الإمارات": "Émirats arabes unis", "فرنسا": "France",
    "بحث بالاسم أو الشركة أو الرقم": "Rechercher par nom, société ou numéro", "لا صفوف في الملف.": "Aucune ligne dans le fichier."
  };
  const FRP = [
    [/^\(متغيرات: (.*)\)$/, "(variables : $1)"],
    [/^(\d+) من (\d+) جهة اتصال$/, "$1 sur $2 contact(s)"], [/^آخر تواصل: (.+)$/, "Dernier contact : $1"], [/^رقم غير صالح: (.*)$/, "Numéro invalide : $1"],
    [/^فُتحت المحادثة (.+) — لم تُسجَّل نتيجتها بعد\.$/, "Conversation ouverte $1 — résultat pas encore enregistré."],
    [/^الصفوف: (\d+)\nجديدة صالحة: (\d+)\nمكرَّرة \(موجودة\): (\d+)\nرقم غير صالح: (\d+)$/, "Lignes : $1\nNouvelles valides : $2\nDoublons (existants) : $3\nNuméro invalide : $4"]
  ];
  const trTxt = v => { if (v == null) return v; const k = String(v).trim(); if (!k) return v; if (FR[k]) return String(v).replace(k, FR[k]); for (const [re, to] of FRP) if (re.test(k)) return String(v).replace(k, k.replace(re, to)); return v; };
  function frWalk(root) {
    if (!fr() || !root) return; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { const t = trTxt(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; }
      else for (const a of ["placeholder", "title"]) { const v = n.getAttribute && n.getAttribute(a); if (v) { const t = trTxt(v); if (t !== v) n.setAttribute(a, t); } }
    }
  }
  const S = { doc: { v: 1, tpl: "", contacts: [] }, loaded: false, busy: false, err: "", sel: null, q: "", f: "", co: "", pick: "", tmr: null };
  const uid = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const stl = k => fr() ? (FR[ST[k]] || ST[k]) : (ST[k] || k);
  const fmtD = t => { try { return new Date(t).toLocaleString(fr() ? "fr-FR" : "ar-DZ", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (_) { return ""; } };
  const ago = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)), f = fr(); return m < 60 ? (f ? "il y a " + m + " min" : "قبل " + m + " دقيقة") : m < 1440 ? (f ? "il y a " + Math.round(m / 60) + " h" : "قبل " + Math.round(m / 60) + " ساعة") : (f ? "il y a " + Math.round(m / 1440) + " j" : "قبل " + Math.round(m / 1440) + " يوماً"); };
  const toast = m => { try { if (typeof window.toast === "function") window.toast(m); } catch (_) { } };
  const msgs = { saved: ["✅ حُفظ كنص افتراضي", "✅ Enregistré comme texte par défaut"], logged: ["✅ سُجّلت الحالة", "✅ Statut enregistré"], none: ["اكتب الاسم أو الشركة.", "Saisissez le nom ou la société."], badph: ["رقم الهاتف غير صالح: اكتبه بصيغة دولية (مثل +213550123456) أو محلياً مع تحديد الدولة.", "Numéro invalide : saisissez-le au format international (ex. +213550123456) ou local avec le pays."], dup: ["هذا الرقم مسجَّل لـ«", "Ce numéro est déjà enregistré pour « "], again: ["\n\nهل تريد فتح WhatsApp مرة أخرى؟", "\n\nVoulez-vous rouvrir WhatsApp ?"], dellog: ["حذف هذا السجل؟", "Supprimer cet enregistrement ?"], reopenNote: ["رفع إلغاء التواصل", "Blocage de contact levé"] };
  const M = k => msgs[k][fr() ? 1 : 0];

  /* ── الهاتف الدولي: أرقام عربية/فارسية ← لاتينية، إزالة الرموز، 00/+ ← صيغة دولية، 0 محلي + معروف الدولة ← مفتاحها ── */
  function normPhone(raw, country) {
    let t = String(raw == null ? "" : raw).replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776)).trim();
    const plus = /^\s*\+/.test(t); let d = t.replace(/\D/g, "");
    if (!d) return { num: "", ok: false };
    if (!plus && d.slice(0, 2) === "00") d = d.slice(2);
    else if (!plus && d[0] === "0") { const cc = DIAL[String(country || "").trim().toLowerCase()]; if (cc) d = cc + d.slice(1); }
    return { num: d, ok: /^[1-9]\d{7,14}$/.test(d) };
  }
  /* ── متغيرات الرسالة: {name} {first} {company} {phone} {country} (أو بقوسين مزدوجين) ── */
  const VARS = [["name", "الاسم"], ["first", "الاسم الأول"], ["company", "الشركة"], ["phone", "الهاتف"], ["country", "الدولة"]];
  function render(tpl, c) {
    const v = { name: c.name || "", first: String(c.name || "").trim().split(/\s+/)[0] || "", company: c.company || "", phone: c.phone || "", country: c.country || "" };
    return String(tpl || "").replace(/\{\{?\s*(name|first|company|phone|country)\s*\}?\}/gi, (_, k) => v[k.toLowerCase()]);
  }
  const waUrl = (num, text) => "https://wa.me/" + num + (text ? "?text=" + encodeURIComponent(text) : "");

  /* ── التخزين ── */
  async function load() {
    if (S.loaded) return; S.busy = true; draw();
    try { const d = typeof Priv !== "undefined" ? await Priv.get(KEY, null) : null; if (d && Array.isArray(d.contacts)) S.doc = Object.assign({ v: 1, tpl: "" }, d); S.loaded = true; S.err = ""; }
    catch (e) { S.err = (fr() ? "Impossible de charger les contacts : " : "تعذّر تحميل جهات الاتصال: ") + (e.message || e); }
    S.busy = false; draw();
  }
  async function save() {
    try { await Priv.set(KEY, S.doc); S.err = ""; } catch (e) { S.err = (fr() ? "Échec de l'enregistrement : " : "تعذّر الحفظ: ") + (e.message || e); toast("⚠️ " + S.err); }
  }
  const by = id => S.doc.contacts.find(c => c.id === id);
  const lastLog = c => (c.log || []).slice(-1)[0] || null;
  const lastContact = c => { const L = (c.log || []).filter(x => x.st !== "reopen"); return L[L.length - 1] || null; };
  const stOf = c => { const l = lastLog(c); return l ? l.st : ""; };

  /* ── حارس التكرار غير المقصود ── */
  function guard(c) {
    const last = lastLog(c), lc = lastContact(c), warn = [];
    if (last && last.st === "out") return { block: true, warn: [(fr() ? "« Ne plus contacter » est enregistré (" : "إلغاء التواصل مسجَّل (") + fmtD(last.at) + ")" + (last.note ? " — " + last.note : "")] };
    if (lc && Date.now() - lc.at < GUARD) warn.push(fr() ? "Dernier contact enregistré " + ago(lc.at) + " — statut : " + stl(lc.st) + (lc.msg ? "\nDernier message : " + String(lc.msg).slice(0, 160) : "") : "آخر تواصل مسجَّل " + ago(lc.at) + " — الحالة: " + ST[lc.st] + (lc.msg ? "\nآخر رسالة: " + String(lc.msg).slice(0, 160) : ""));
    if (c.opened && Date.now() - c.opened.at < DAY && (!lc || c.opened.at > lc.at)) warn.push(fr() ? "Une conversation WhatsApp a été ouverte avec ce contact " + ago(c.opened.at) + " et son résultat n'est pas encore enregistré (on ne sait pas si le message a été envoyé)." : "فُتحت محادثة WhatsApp مع هذه الجهة " + ago(c.opened.at) + " ولم تسجّل نتيجتها بعد (لا نعرف إن أُرسلت الرسالة).");
    return { block: false, warn };
  }

  /* ── CSV ── */
  function parseCsv(text) {
    text = String(text || "").replace(/^﻿/, ""); const head = text.split(/\r?\n/).slice(0, 10).join("\n");
    const cnt = ch => (head.match(new RegExp(ch === "\t" ? "\t" : "\\" + ch, "g")) || []).length, sep = [";", "\t", ","].reduce((b, c) => cnt(c) > cnt(b) ? c : b, ",");
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) { const ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === sep) { row.push(cur); cur = ""; } else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; } else if (ch !== "\r") cur += ch; }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim()));
  }
  const nz = t => String(t || "").toLowerCase().replace(/[\s_\-.]+/g, "");
  const HDR = { name: ["name", "fullname", "nom", "الاسم", "اسم", "الاسمالكامل"], company: ["company", "societe", "société", "entreprise", "الشركة", "شركة", "المؤسسة"], phone: ["phone", "mobile", "tel", "telephone", "whatsapp", "number", "الهاتف", "رقمالهاتف", "الرقم", "رقم", "واتساب", "الجوال"], country: ["country", "pays", "الدولة", "دولة", "البلد"], notes: ["notes", "note", "remarks", "ملاحظات", "ملاحظة"] };
  function mapRows(rows) {
    if (!rows.length) return [];
    const h = rows[0].map(nz), idx = {}; Object.keys(HDR).forEach(k => { const j = h.findIndex(x => HDR[k].map(nz).includes(x)); if (j >= 0) idx[k] = j; });
    let body = rows; if (idx.name != null || idx.phone != null) body = rows.slice(1); else { idx.name = 0; idx.company = 1; idx.phone = 2; idx.country = 3; idx.notes = 4; }
    return body.map(r => ({ name: String(r[idx.name] == null ? "" : r[idx.name]).trim(), company: String(r[idx.company] == null ? "" : r[idx.company]).trim(), phone: String(r[idx.phone] == null ? "" : r[idx.phone]).trim(), country: String(r[idx.country] == null ? "" : r[idx.country]).trim(), notes: String(r[idx.notes] == null ? "" : r[idx.notes]).trim() }));
  }

  /* ── الواجهة ── */
  const css = () => {
    if ($("waqs-css")) return; const st = document.createElement("style"); st.id = "waqs-css";
    st.textContent = "#waqs .wq-row{display:flex;gap:.6rem;align-items:center;justify-content:space-between;padding:.7rem .8rem;border:1px solid rgba(128,128,128,.28);border-radius:14px;margin:.45rem 0;cursor:pointer}#waqs .wq-row:hover{border-color:rgba(37,211,102,.7)}#waqs .wq-nm{font-weight:800}#waqs .wq-sub{font-size:.8rem;opacity:.75}#waqs .wq-pill{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.74rem;font-weight:800;color:#fff;white-space:nowrap}#waqs .wq-go{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;min-height:52px;border-radius:14px;background:#25d366;color:#07310f;font-weight:900;font-size:1.05rem;text-decoration:none;border:0;box-shadow:inset 0 -3px 0 rgba(0,0,0,.22)}#waqs .wq-go.off{background:#9ca3af;color:#1f2937;pointer-events:none;box-shadow:none}#waqs textarea,#waqs input[type=text],#waqs input[type=search],#waqs select{width:100%;box-sizing:border-box;background:rgba(128,128,128,.12);color:inherit;border:1px solid rgba(128,128,128,.35);border-radius:10px;padding:.55rem .65rem;font:inherit}#waqs textarea{min-height:130px;resize:vertical;line-height:1.7}#waqs .wq-warn{border:1px solid #d97706;background:rgba(217,119,6,.14);border-radius:12px;padding:.6rem .75rem;margin:.6rem 0;white-space:pre-line;line-height:1.7}#waqs .wq-bad{border-color:#dc2626;background:rgba(220,38,38,.14)}#waqs .wq-chip{display:inline-flex;align-items:center;padding:.3rem .7rem;border-radius:999px;border:1px solid rgba(128,128,128,.4);cursor:pointer;margin:.15rem;font-size:.84rem;font-weight:700}#waqs .wq-chip.on{outline:2px solid currentColor;font-weight:900}#waqs .wq-prev{white-space:pre-wrap;border-radius:14px;padding:.7rem .85rem;background:rgba(37,211,102,.14);border:1px solid rgba(37,211,102,.4);line-height:1.7;min-height:2.4rem}#waqs .wq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem;margin:.5rem 0}#waqs .wq-h{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}#waqs .wq-h h2{margin:0;flex:1 1 100%}@media(max-width:700px){#waqs .wq-row{flex-direction:column;align-items:flex-start}}";
    document.head.appendChild(st);
  };
  const pill = st => st ? '<span class="wq-pill" style="background:' + TONE[st] + '">' + esc(ST[st]) + "</span>" : '<span class="wq-pill" style="background:#6b7280">بلا تواصل</span>';
  function list() {
    const q = S.q.trim().toLowerCase(), qd = q.replace(/\D/g, "");
    let L = S.doc.contacts.filter(c => {
      if (S.co && (c.company || "") !== S.co) return false;
      const lc = lastContact(c), last = lastLog(c), st = last ? (last.st === "reopen" ? "" : last.st) : "";
      if (S.f === "none" && lc) return false; if (S.f && S.f !== "none" && (st !== S.f)) return false;
      if (q && ![c.name, c.company, c.phone, c.country, c.notes].some(x => String(x || "").toLowerCase().includes(q)) && !(qd && String(c.phone || "").replace(/\D/g, "").includes(qd))) return false; return true; });
    L = L.slice().sort((a, b) => ((lastContact(b) || { at: b.at }).at || 0) - ((lastContact(a) || { at: a.at }).at || 0));
    return L;
  }
  function draw() {
    const h = $("waqs-content"); if (!h) return; css();
    const c = S.sel && by(S.sel); if (S.sel && !c) S.sel = null;
    h.innerHTML = '<div id="waqs" class="card">' + (S.err ? '<div class="wq-warn wq-bad">' + esc(S.err) + "</div>" : "") + (S.busy && !S.loaded ? '<p class="hint">جارٍ التحميل…</p>' : (c ? detail(c) : home())) + "</div>";
    frWalk($("waqs")); bind();
  }
  function home() {
    const L = list(), cos = [...new Set(S.doc.contacts.map(c => c.company).filter(Boolean))].sort();
    return '<div class="wq-h"><h2>WhatsApp Quick Sender</h2><button class="small gold" type="button" data-wq="add">+ جهة اتصال</button><button class="small gray" type="button" data-wq="imp">استيراد CSV</button></div>' +
      '<p class="hint">إرسال يدوي فقط: يُفتح WhatsApp برسالة مكتوبة مسبقاً وأنت تضغط «إرسال» بنفسك. لا يُسجَّل «تم الإرسال» إلا بتسجيلك.</p>' +
      '<div class="wq-grid"><input type="search" id="wq-q" placeholder="بحث بالاسم أو الشركة أو الرقم" value="' + esc(S.q) + '"><select id="wq-f"><option value="">كل الحالات</option><option value="none"' + (S.f === "none" ? " selected" : "") + ">بلا تواصل بعد</option>" + PICK.map(k => '<option value="' + k + '"' + (S.f === k ? " selected" : "") + ">" + ST[k] + "</option>").join("") + '</select><select id="wq-co"><option value="">كل الشركات</option>' + cos.map(x => '<option value="' + esc(x) + '"' + (S.co === x ? " selected" : "") + ">" + esc(x) + "</option>").join("") + "</select></div>" +
      '<div class="hint">' + L.length + " من " + S.doc.contacts.length + " جهة اتصال</div>" +
      (L.length ? L.map(c => { const lc = lastContact(c), l = lastLog(c); return '<div class="wq-row" data-wq="open" data-id="' + esc(c.id) + '"><div><div class="wq-nm">' + esc(c.name || "—") + (c.company ? " · " + esc(c.company) : "") + '</div><div class="wq-sub" dir="ltr" style="text-align:start">+' + esc(normPhone(c.phone, c.country).num || c.phone) + (c.country ? " · " + esc(c.country) : "") + '</div></div><div style="text-align:end">' + pill(l ? (l.st === "reopen" ? "" : l.st) : "") + '<div class="wq-sub">' + (lc ? "آخر تواصل: " + esc(fmtD(lc.at)) : "لم يُتواصل بعد") + "</div></div></div>"; }).join("") : '<div class="em">' + (S.doc.contacts.length ? "لا نتائج مطابقة." : "لا جهات اتصال بعد. أضف جهة أو استورد ملف CSV.") + "</div>");
  }
  function detail(c) {
    const ph = normPhone(c.phone, c.country), g = guard(c), msg = c.draft != null ? c.draft : (S.doc.tpl || ""), log = (c.log || []).slice().reverse();
    const out = g.block;
    return '<div class="wq-h"><button class="small gray" type="button" data-wq="back">← القائمة</button><h2>' + esc(c.name || "—") + (c.company ? " · " + esc(c.company) : "") + '</h2><button class="small gray" type="button" data-wq="edit">تعديل</button><button class="small danger" type="button" data-wq="del">حذف</button></div>' +
      '<div class="wq-sub" dir="ltr" style="text-align:start;margin:.3rem 0">' + (ph.ok ? "+" + esc(ph.num) : '<span style="color:#dc2626">رقم غير صالح: ' + esc(c.phone) + "</span>") + (c.country ? " · " + esc(c.country) : "") + "</div>" +
      (c.notes ? '<div class="wq-sub">' + esc(c.notes) + "</div>" : "") +
      '<div style="margin:.5rem 0">' + pill(lastLog(c) ? (lastLog(c).st === "reopen" ? "" : lastLog(c).st) : "") + ' <span class="wq-sub">' + (lastContact(c) ? "آخر تواصل: " + esc(fmtD(lastContact(c).at)) : "لم يُتواصل بعد") + "</span></div>" +
      (g.warn.length ? '<div class="wq-warn' + (out ? " wq-bad" : "") + '">' + g.warn.map(esc).join("\n\n") + (out ? '</div><button class="small" type="button" data-wq="reopen">رفع إلغاء التواصل</button><div>' : "") + "</div>" : "") +
      '<label class="hint">نص الرسالة <small>(متغيرات: ' + VARS.map(v => "{" + v[0] + "}").join(" ") + ")</small></label>" +
      '<div>' + VARS.map(v => '<span class="wq-chip" data-wq="var" data-v="' + v[0] + '">' + esc(v[1]) + "</span>").join("") + "</div>" +
      '<textarea id="wq-msg" dir="auto" placeholder="اكتب رسالتك هنا…">' + esc(msg) + "</textarea>" +
      '<div class="wq-h" style="margin:.4rem 0"><button class="small gray" type="button" data-wq="tpl">حفظ كنص افتراضي لكل الجهات</button></div>' +
      '<div class="hint">المعاينة (كما ستظهر في WhatsApp)</div><div class="wq-prev" id="wq-prev" dir="auto"></div>' +
      '<div style="margin:.7rem 0"><a id="wq-go" class="wq-go' + (ph.ok && !out ? "" : " off") + '" href="' + (ph.ok && !out ? esc(waUrl(ph.num, render(msg, c))) : "#") + '" target="_blank" rel="noopener noreferrer" data-wq="go">فتح WhatsApp</a>' +
      '<div class="hint" style="margin-top:.35rem">يفتح المحادثة مع الرقم والرسالة مكتوبة مسبقاً. <b>لا يُسجَّل الإرسال تلقائياً</b>: راجع الرسالة واضغط «إرسال» داخل WhatsApp Business ثم عُد وسجّل النتيجة أدناه.</div></div>' +
      (c.opened && (!lastContact(c) || c.opened.at > lastContact(c).at) ? '<div class="wq-warn">فُتحت المحادثة ' + ago(c.opened.at) + " — لم تُسجَّل نتيجتها بعد.</div>" : "") +
      '<h3 style="margin:.8rem 0 .3rem">تسجيل حالة التواصل</h3><div>' + PICK.map(k => '<span class="wq-chip' + (S.pick === k ? " on" : "") + '" data-wq="pick" data-k="' + k + '" style="color:' + TONE[k] + '">' + ST[k] + "</span>").join("") + "</div>" +
      '<input type="text" id="wq-note" placeholder="ملاحظة (اختياري)" style="margin:.4rem 0"><button class="small gold" type="button" data-wq="log"' + (S.pick ? "" : " disabled") + ">تسجيل</button>" +
      '<h3 style="margin:.9rem 0 .3rem">تاريخ التواصل</h3>' + (log.length ? log.map((x, i) => '<div class="wq-row" style="cursor:default"><div><span class="wq-pill" style="background:' + TONE[x.st] + '">' + esc(ST[x.st] || x.st) + '</span> <span class="wq-sub">' + esc(fmtD(x.at)) + "</span>" + (x.note ? '<div class="wq-sub">' + esc(x.note) + "</div>" : "") + (x.msg ? '<div class="wq-sub" dir="auto">' + esc(String(x.msg).slice(0, 220)) + "</div>" : "") + '</div><button class="small gray" type="button" data-wq="dellog" data-at="' + x.at + '">حذف</button></div>').join("") : '<div class="em">لا تواصل مسجَّل.</div>');
  }
  /* ── النوافذ: جهة اتصال / استيراد ── */
  function modal(html) {
    const old = $("wq-modal"); if (old) old.remove(); const bg = document.createElement("div"); bg.id = "wq-modal"; bg.className = "modal-bg open"; bg.innerHTML = '<div class="modal" style="max-width:560px" id="waqs-m">' + html + "</div>"; document.body.appendChild(bg); frWalk(bg);
    bg.addEventListener("click", e => { if (e.target === bg) bg.remove(); }); return bg;
  }
  function contactForm(c) {
    const bg = modal('<h3>' + (c ? "تعديل جهة اتصال" : "جهة اتصال جديدة") + '</h3><div class="field"><label>الاسم</label><input type="text" id="wf-n" value="' + esc(c ? c.name : "") + '"></div><div class="field"><label>الشركة</label><input type="text" id="wf-c" value="' + esc(c ? c.company : "") + '"></div><div class="field"><label>رقم الهاتف (دولي: +213…)</label><input type="text" id="wf-p" dir="ltr" inputmode="tel" value="' + esc(c ? c.phone : "") + '"></div><div class="field"><label>الدولة</label><input type="text" id="wf-k" list="wf-kl" value="' + esc(c ? c.country : "الجزائر") + '"><datalist id="wf-kl">' + ["الجزائر", "المغرب", "تونس", "ليبيا", "مصر", "السعودية", "الإمارات", "فرنسا"].map(x => '<option value="' + x + '">').join("") + '</datalist></div><div class="field"><label>ملاحظات</label><textarea id="wf-t" style="min-height:70px">' + esc(c ? c.notes : "") + '</textarea></div><div id="wf-e" style="color:#dc2626;min-height:1.3rem"></div><div class="action-bar"><button class="small gold" type="button" id="wf-ok">حفظ</button><button class="small gray" type="button" id="wf-no">إلغاء</button></div>');
    bg.querySelector("#wf-no").onclick = () => bg.remove();
    bg.querySelector("#wf-ok").onclick = async () => {
      const v = id => bg.querySelector(id).value.trim(), ph = normPhone(v("#wf-p"), v("#wf-k")), err = bg.querySelector("#wf-e");
      if (!v("#wf-n") && !v("#wf-c")) { err.textContent = M("none"); return; }
      if (!ph.ok) { err.textContent = M("badph"); return; }
      const dup = S.doc.contacts.find(x => x.id !== (c && c.id) && normPhone(x.phone, x.country).num === ph.num); if (dup) { err.textContent = M("dup") + (dup.name || dup.company) + (fr() ? " »." : "»."); return; }
      if (c) Object.assign(c, { name: v("#wf-n"), company: v("#wf-c"), phone: v("#wf-p"), country: v("#wf-k"), notes: v("#wf-t") });
      else { const n = { id: uid(), name: v("#wf-n"), company: v("#wf-c"), phone: v("#wf-p"), country: v("#wf-k"), notes: v("#wf-t"), at: Date.now(), log: [] }; S.doc.contacts.push(n); S.sel = n.id; }
      bg.remove(); draw(); await save();
    };
  }
  function importForm() {
    const bg = modal('<h3>استيراد جهات اتصال من CSV</h3><p class="hint">الأعمدة: الاسم، الشركة، الهاتف، الدولة، ملاحظات (بأي ترتيب إن كان في الصف الأول عناوين؛ وإلا بهذا الترتيب). ترميز UTF-8، والفاصل , أو ; أو Tab.</p><input type="file" id="wi-f" accept=".csv,.txt,text/csv"><div class="field"><label>الدولة الافتراضية للأرقام المحلية (تبدأ بصفر)</label><input type="text" id="wi-k" list="wf-kl" value="الجزائر"></div><div id="wi-r" class="hint" style="white-space:pre-line;margin:.5rem 0"></div><div class="action-bar"><button class="small gold" type="button" id="wi-ok" disabled>استيراد</button><button class="small gray" type="button" id="wi-no">إغلاق</button></div>');
    let ready = [], file = "";
    const plan = () => {
      const rows = mapRows(parseCsv(file)), dk = bg.querySelector("#wi-k").value.trim(), seen = new Set(S.doc.contacts.map(x => normPhone(x.phone, x.country).num)); ready = []; let bad = 0, dup = 0;
      rows.forEach(r => { const p = normPhone(r.phone, r.country || dk); if (!p.ok) { bad++; return; } if (seen.has(p.num)) { dup++; return; } seen.add(p.num); ready.push(Object.assign({}, r, { country: r.country || dk })); });
      bg.querySelector("#wi-r").textContent = rows.length ? "الصفوف: " + rows.length + "\nجديدة صالحة: " + ready.length + "\nمكرَّرة (موجودة): " + dup + "\nرقم غير صالح: " + bad : "لا صفوف في الملف."; bg.querySelector("#wi-ok").disabled = !ready.length; frWalk(bg.querySelector("#wi-r"));
    };
    bg.querySelector("#wi-f").onchange = async e => { const f = e.target.files && e.target.files[0]; if (!f) return; file = await f.text(); plan(); };
    bg.querySelector("#wi-k").oninput = () => { if (file) plan(); };
    bg.querySelector("#wi-no").onclick = () => bg.remove();
    bg.querySelector("#wi-ok").onclick = async () => { ready.forEach(r => S.doc.contacts.push({ id: uid(), name: r.name, company: r.company, phone: r.phone, country: r.country, notes: r.notes, at: Date.now(), log: [] })); const n = ready.length; bg.remove(); draw(); await save(); toast(fr() ? "✅ " + n + " contact(s) importé(s)" : "✅ استُوردت " + n + " جهة اتصال"); };
  }
  /* ── الأحداث ── */
  function curMsg(c) { const t = $("wq-msg"); return t ? t.value : ""; }
  function refreshGo(c) {
    const ph = normPhone(c.phone, c.country), t = curMsg(c), a = $("wq-go"), pv = $("wq-prev"), text = render(t, c);
    if (pv) { pv.textContent = text || "(رسالة فارغة)"; if (!text) frWalk(pv); }
    if (a && ph.ok && !guard(c).block) a.href = waUrl(ph.num, text);
    c.draft = t; clearTimeout(S.tmr); S.tmr = setTimeout(save, 700);
  }
  function bind() {
    const h = $("waqs"); if (!h) return; const c = S.sel && by(S.sel);
    const q = $("wq-q"); if (q) q.oninput = () => { S.q = q.value; const pos = q.selectionStart; draw(); const n = $("wq-q"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) { } } };
    const f = $("wq-f"); if (f) f.onchange = () => { S.f = f.value; draw(); }; const co = $("wq-co"); if (co) co.onchange = () => { S.co = co.value; draw(); };
    if (c) { const t = $("wq-msg"); if (t) { t.oninput = () => refreshGo(c); refreshGo(c); } }
    h.onclick = async e => {
      const b = e.target.closest && e.target.closest("[data-wq]"); if (!b) return; const a = b.dataset.wq;
      if (a === "add") return contactForm(null); if (a === "imp") return importForm();
      if (a === "open") { S.sel = b.dataset.id; S.pick = ""; return draw(); } if (a === "back") { S.sel = null; return draw(); }
      if (!c) return;
      if (a === "edit") return contactForm(c);
      if (a === "del") { if (confirm(fr() ? "Supprimer « " + (c.name || c.company) + " » et tout son historique ?" : "حذف «" + (c.name || c.company) + "» وكل تاريخ تواصله؟")) { S.doc.contacts = S.doc.contacts.filter(x => x.id !== c.id); S.sel = null; draw(); await save(); } return; }
      if (a === "var") { const t = $("wq-msg"); if (!t) return; const s = t.selectionStart == null ? t.value.length : t.selectionStart, ins = "{" + b.dataset.v + "}"; t.value = t.value.slice(0, s) + ins + t.value.slice(t.selectionEnd == null ? s : t.selectionEnd); t.focus(); t.setSelectionRange(s + ins.length, s + ins.length); return refreshGo(c); }
      if (a === "tpl") { S.doc.tpl = curMsg(c); await save(); return toast(M("saved")); }
      if (a === "reopen") { c.log = (c.log || []).concat([{ at: Date.now(), st: "reopen", note: M("reopenNote"), msg: "" }]); draw(); return save(); }
      if (a === "pick") { S.pick = S.pick === b.dataset.k ? "" : b.dataset.k; const n = $("wq-note"), v = n ? n.value : ""; draw(); const n2 = $("wq-note"); if (n2) n2.value = v; return; }
      if (a === "log") {
        if (!S.pick) return; const note = ($("wq-note") || {}).value || "", text = render(curMsg(c), c), msg = c.opened && (!lastContact(c) || c.opened.at > lastContact(c).at) ? c.opened.msg : text;
        c.log = (c.log || []).concat([{ at: Date.now(), st: S.pick, msg: S.pick === "out" ? "" : msg, note: note.trim() }]); S.pick = ""; draw(); await save(); return toast(M("logged")); }
      if (a === "dellog") { if (confirm(M("dellog"))) { c.log = (c.log || []).filter(x => String(x.at) !== b.dataset.at); draw(); await save(); } return; }
      if (a === "go") {
        const ph = normPhone(c.phone, c.country), g = guard(c);
        if (!ph.ok || g.block) { e.preventDefault(); return; }
        if (g.warn.length && !confirm(g.warn.join("\n\n") + M("again"))) { e.preventDefault(); return; }
        const text = render(curMsg(c), c); c.opened = { at: Date.now(), msg: text }; clearTimeout(S.tmr); save(); setTimeout(draw, 400);
      }
    };
  }
  try { new MutationObserver(() => { const el = $("tab-waqs"); if (S.loaded && el && !el.classList.contains("hidden")) draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] }); } catch (_) { }
  const open = () => { css(); if (!S.loaded) load(); else draw(); };
  const wrap = () => { if (typeof Admin === "undefined" || Admin._waqsWrapped) return; const orig = Admin.tab; Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-waqs"); if (el) el.classList.toggle("hidden", t !== "waqs"); if (t === "waqs") open(); return r; }; Admin._waqsWrapped = true; };
  if (typeof Admin !== "undefined") wrap(); else document.addEventListener("DOMContentLoaded", wrap);
  return { normPhone, render, waUrl, parseCsv, mapRows, guard, S, open, ST };
})();
