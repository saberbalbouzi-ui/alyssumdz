/* WhatsApp Quick Sender — خاص بمالك المنصة فقط (لا يدخل حزم العملاء: owner_only في shared-files.json ويُحمَّل فقط حين CONFIG.SELLER).
   المفهوم: الرسائل تُعدّ وتُخصَّص مسبقاً خارج المنصة (لكل شركة وشخص ولغة)، والمنصة تستقبلها (استيراد JSON/CSV أو إضافة يدوية) وتعرضها في قائمة «جاهزة للإرسال»،
   وعند فتح جهة يُفتح WhatsApp بالنص النهائي عبر https://wa.me/<رقم>?text=<نص مشفَّر> وأنت تضغط «إرسال» بنفسك. بلا Meta API ولا إرسال آلي.
   لا يُسجَّل «تم الإرسال» تلقائياً أبداً: تسجّله أنت بعد الإرسال فتُحفظ نسخة النص المُرسَل فعلاً. القوالب الجاهزة (admin-waqs-lib.js) أداة مساعدة اختيارية فقط عند إضافة رسالة.
   التخزين: مستند واحد في الإعدادات الخاصة (Priv مفتاح waqs) = { v, me:{name,company,offer:{en,fr,ar}},
     contacts:[{id,name,company,phone,country,notes,at,opened,log:[{at,st,msg,note,mid,type,lang,campaign,custom}]}],
     msgs:[{id,cid,campaign,lang,type,text,parent,ref,status:ready|sent|skipped,at,sentAt,sentText,note}] }. */
const AdminWaqs = (() => {
  if (typeof CONFIG === "undefined" || !CONFIG.SELLER) return { off: true };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KEY = "waqs", DAY = 864e5, GUARD = 3 * DAY;
  const fr = () => typeof AdminI18n !== "undefined" && AdminI18n.lang === "fr";
  const X = (a, f) => fr() ? f : a;                       /* نص ديناميكي بلغتين (العربية/الفرنسية) */
  const ST = { sent: "تم الإرسال", wait: "بانتظار الرد", pos: "ردّ إيجابي", neg: "ردّ سلبي", none: "لا يوجد رد", out: "إلغاء التواصل", reopen: "أُعيد تفعيل التواصل" };
  const STF = { sent: "Envoyé", wait: "En attente de réponse", pos: "Réponse positive", neg: "Réponse négative", none: "Aucune réponse", out: "Ne plus contacter", reopen: "Contact réactivé" };
  const stl = k => fr() ? (STF[k] || k) : (ST[k] || k);
  const TONE = { sent: "#3b82f6", wait: "#d97706", pos: "#16a34a", neg: "#dc2626", none: "#6b7280", out: "#7c3aed", reopen: "#6b7280" };
  const PICK = ["sent", "wait", "pos", "neg", "none", "out"];
  const MT = { first: ["First Contact", "Premier contact"], followup: ["Follow-up", "Relance"], reply: ["Reply", "Réponse"], other: ["Other", "Autre"] };
  const MS = { ready: ["Ready to Send", "Prêt à envoyer", "#16a34a"], sent: ["Sent", "Envoyé", "#3b82f6"], skipped: ["Skipped", "Ignoré", "#6b7280"] };
  const mtl = t => MT[t] ? MT[t][fr() ? 1 : 0] : String(t || "");
  const msl = t => MS[t] ? MS[t][fr() ? 1 : 0] : String(t || "");
  const DIAL = { "الجزائر": "213", "dz": "213", "algeria": "213", "algerie": "213", "algérie": "213", "المغرب": "212", "ma": "212", "morocco": "212", "maroc": "212", "تونس": "216", "tn": "216", "tunisia": "216", "tunisie": "216", "ليبيا": "218", "ly": "218", "مصر": "20", "eg": "20", "egypt": "20", "السعودية": "966", "sa": "966", "saudi arabia": "966", "الإمارات": "971", "ae": "971", "uae": "971", "قطر": "974", "qa": "974", "الكويت": "965", "kw": "965", "فرنسا": "33", "fr": "33", "france": "33", "بلجيكا": "32", "be": "32", "إسبانيا": "34", "es": "34", "إيطاليا": "39", "it": "39", "ألمانيا": "49", "de": "49", "بريطانيا": "44", "uk": "44", "gb": "44", "كندا": "1", "ca": "1", "أمريكا": "1", "us": "1", "usa": "1", "تركيا": "90", "tr": "90", "turkey": "90" };
  /* ── الفرنسية للنصوص الثابتة القديمة (جهات الاتصال والحالات)؛ النصوص الجديدة تمرّ عبر X() ── */
  const FR = {
    "مراسلة يدوية عبر WhatsApp وتسجيل نتيجة كل تواصل": "Messages WhatsApp manuels et suivi de chaque contact",
    "+ جهة اتصال": "+ Contact", "كل الحالات": "Tous les statuts", "بلا تواصل بعد": "Aucun contact pour l'instant", "كل الشركات": "Toutes les sociétés",
    "تم الإرسال": "Envoyé", "بانتظار الرد": "En attente de réponse", "ردّ إيجابي": "Réponse positive", "ردّ سلبي": "Réponse négative", "لا يوجد رد": "Aucune réponse", "إلغاء التواصل": "Ne plus contacter", "أُعيد تفعيل التواصل": "Contact réactivé", "بلا تواصل": "Sans contact",
    "لا نتائج مطابقة.": "Aucun résultat.", "لم يُتواصل بعد": "Pas encore contacté", "← القائمة": "← Liste", "تعديل": "Modifier", "حذف": "Supprimer",
    "رفع إلغاء التواصل": "Lever le blocage de contact", "الاسم": "Nom", "الشركة": "Société", "الهاتف": "Téléphone", "الدولة": "Pays",
    "فتح WhatsApp": "Ouvrir WhatsApp",
    "يفتح المحادثة مع الرقم والنص النهائي مكتوباً مسبقاً.": "Ouvre la conversation avec le numéro et le texte final pré-rempli.", "لا يُسجَّل الإرسال تلقائياً": "L'envoi n'est pas enregistré automatiquement",
    ": راجع الرسالة واضغط «إرسال» داخل WhatsApp Business ثم عُد وسجّل النتيجة أدناه.": " : relisez le message, appuyez sur « Envoyer » dans WhatsApp Business, puis revenez enregistrer le résultat ci-dessous.",
    "تسجيل حالة التواصل": "Enregistrer le statut du contact", "ملاحظة (اختياري)": "Note (facultatif)", "تسجيل": "Enregistrer", "تاريخ التواصل": "Historique des contacts", "لا تواصل مسجَّل.": "Aucun contact enregistré.",
    "جهة اتصال جديدة": "Nouveau contact", "تعديل جهة اتصال": "Modifier le contact", "رقم الهاتف (دولي: +213…)": "Téléphone (international : +213…)", "ملاحظات": "Notes", "حفظ": "Enregistrer", "إلغاء": "Annuler", "إغلاق": "Fermer", "استيراد": "Importer",
    "استيراد جهات اتصال من CSV": "Importer des contacts depuis un CSV",
    "الأعمدة: الاسم، الشركة، الهاتف، الدولة، ملاحظات (بأي ترتيب إن كان في الصف الأول عناوين؛ وإلا بهذا الترتيب). ترميز UTF-8، والفاصل , أو ; أو Tab.": "Colonnes : nom, société, téléphone, pays, notes (dans n'importe quel ordre si la première ligne contient des en-têtes ; sinon dans cet ordre). Encodage UTF-8, séparateur , ou ; ou tabulation.",
    "الدولة الافتراضية للأرقام المحلية (تبدأ بصفر)": "Pays par défaut pour les numéros locaux (commençant par zéro)",
    "جارٍ التحميل…": "Chargement…", "الجزائر": "Algérie", "المغرب": "Maroc", "تونس": "Tunisie", "ليبيا": "Libye", "مصر": "Égypte", "السعودية": "Arabie saoudite", "الإمارات": "Émirats arabes unis", "فرنسا": "France",
    "لا صفوف في الملف.": "Aucune ligne dans le fichier."
  };
  const FRP = [
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
  const newDoc = () => ({ v: 3, me: { name: "", company: "", offer: { en: "", fr: "", ar: "" } }, contacts: [], msgs: [] });
  const normDoc = d => { const n = Object.assign(newDoc(), d || {}); n.me = Object.assign({ name: "", company: "" }, n.me || {}); n.me.offer = Object.assign({ en: "", fr: "", ar: "" }, n.me.offer || {}); ["contacts", "msgs"].forEach(k => { if (!Array.isArray(n[k])) n[k] = []; }); return n; };
  const S = { doc: newDoc(), loaded: false, busy: false, err: "", sel: null, selFor: null, mid: null, custom: null, edit: false, tab: "queue", q: "", f: "", co: "", cp: "", lg: "", pick: "", tmr: null };
  const uid = p => (p || "c") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const fmtD = t => { try { return new Date(t).toLocaleString(fr() ? "fr-FR" : "ar-DZ", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (_) { return ""; } };
  const ago = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)), f = fr(); return m < 60 ? (f ? "il y a " + m + " min" : "قبل " + m + " دقيقة") : m < 1440 ? (f ? "il y a " + Math.round(m / 60) + " h" : "قبل " + Math.round(m / 60) + " ساعة") : (f ? "il y a " + Math.round(m / 1440) + " j" : "قبل " + Math.round(m / 1440) + " يوماً"); };
  const toast = m => { try { if (typeof window.toast === "function") window.toast(m); } catch (_) { } };
  const msgs = { logged: ["✅ سُجّلت الحالة", "✅ Statut enregistré"], none: ["اكتب الاسم أو الشركة.", "Saisissez le nom ou la société."], badph: ["رقم الهاتف غير صالح: اكتبه بصيغة دولية (مثل +213550123456) أو محلياً مع تحديد الدولة.", "Numéro invalide : saisissez-le au format international (ex. +213550123456) ou local avec le pays."], dup: ["هذا الرقم مسجَّل لـ«", "Ce numéro est déjà enregistré pour « "], again: ["\n\nهل تريد فتح WhatsApp مرة أخرى؟", "\n\nVoulez-vous rouvrir WhatsApp ?"], dellog: ["حذف هذا السجل؟", "Supprimer cet enregistrement ?"], reopenNote: ["رفع إلغاء التواصل", "Blocage de contact levé"] };
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
  /* ── القوالب المساعدة الاختيارية (admin-waqs-lib.js): تُستعمل فقط لملء نص رسالة جديدة بمتغيرات الجهة ── */
  const Lib = typeof AdminWaqsLib !== "undefined" ? AdminWaqsLib : { types: [], langs: [], tpls: [], countries: [], country: () => null, fallback: { en: {}, fr: {}, ar: {} } };
  const IDV = ["sender", "my_company", "offer"], LC = { en: "En", fr: "Fr", ar: "Ar" };
  const RE_VAR = /\{\{?\s*(name|first|company|phone|country|in_country|sender|my_company|offer)\s*\}?\}/gi;
  /* lang اختياري: معه تُترجَم الدولة وتُستعمل صياغة محايدة عند غياب الاسم/الشركة/الدولة؛ وهوية المرسل الناقصة تبقى كما هي لتُكتشف */
  function render(tpl, c, lang, me) {
    c = c || {}; me = me || S.doc.me || {}; const L = Lib.fallback[lang] ? lang : "", fb = L ? Lib.fallback[L] : null, co = L ? Lib.country(c.country) : null;
    const name = String(c.name || "").trim(), company = String(c.company || "").trim(), cn = String(c.country || "").trim();
    const v = { name: name || company, first: name.split(/\s+/)[0] || "", company: company || (fb ? fb.company : ""), phone: c.phone || "", country: co ? co[L] : (cn || (fb ? fb.country : "")),
      in_country: co ? co["in" + LC[L]] : (cn && L === "en" ? "in " + cn : cn && L === "ar" ? "في " + cn : fb ? fb.in_country : cn),
      sender: String(me.name || "").trim(), my_company: String(me.company || "").trim(), offer: String((me.offer || {})[L || "en"] || "").trim() };
    return String(tpl || "").replace(RE_VAR, (m, k) => { k = k.toLowerCase(); return IDV.includes(k) && !v[k] ? m : v[k]; }).replace(/[ \t]+([,،])/g, "$1");
  }
  const missingVars = t => [...new Set((String(t || "").match(/\{\{?\s*(?:sender|my_company|offer)\s*\}?\}/g) || []))];
  const waUrl = (num, text) => "https://wa.me/" + num + (text ? "?text=" + encodeURIComponent(text) : "");

  /* ── التخزين ── */
  async function load() {
    if (S.loaded) return; S.busy = true; draw();
    try { const d = typeof Priv !== "undefined" ? await Priv.get(KEY, null) : null; if (d && Array.isArray(d.contacts)) S.doc = normDoc(d); S.loaded = true; S.err = ""; }
    catch (e) { S.err = X("تعذّر تحميل جهات الاتصال: ", "Impossible de charger les contacts : ") + (e.message || e); }
    S.busy = false; draw();
  }
  async function save() {
    try { await Priv.set(KEY, S.doc); S.err = ""; } catch (e) { S.err = X("تعذّر الحفظ: ", "Échec de l'enregistrement : ") + (e.message || e); toast("⚠️ " + S.err); }
  }
  const by = id => S.doc.contacts.find(c => c.id === id);
  const mby = id => S.doc.msgs.find(m => m.id === id);
  const msgsOf = c => S.doc.msgs.filter(m => m.cid === c.id).sort((a, b) => a.at - b.at);
  const lastLog = c => (c.log || []).slice(-1)[0] || null;
  const lastContact = c => { const L = (c.log || []).filter(x => x.st !== "reopen"); return L[L.length - 1] || null; };

  /* ── حارس التكرار غير المقصود ── */
  function guard(c) {
    const last = lastLog(c), lc = lastContact(c), warn = [];
    if (last && last.st === "out") return { block: true, warn: [X("إلغاء التواصل مسجَّل (", "« Ne plus contacter » est enregistré (") + fmtD(last.at) + ")" + (last.note ? " — " + last.note : "")] };
    if (lc && Date.now() - lc.at < GUARD) warn.push(X("آخر تواصل مسجَّل " + ago(lc.at) + " — الحالة: " + ST[lc.st] + (lc.msg ? "\nآخر رسالة: " + String(lc.msg).slice(0, 160) : ""), "Dernier contact enregistré " + ago(lc.at) + " — statut : " + stl(lc.st) + (lc.msg ? "\nDernier message : " + String(lc.msg).slice(0, 160) : "")));
    if (c.opened && Date.now() - c.opened.at < DAY && (!lc || c.opened.at > lc.at)) warn.push(X("فُتحت محادثة WhatsApp مع هذه الجهة " + ago(c.opened.at) + " ولم تسجّل نتيجتها بعد (لا نعرف إن أُرسلت الرسالة).", "Une conversation WhatsApp a été ouverte avec ce contact " + ago(c.opened.at) + " et son résultat n'est pas encore enregistré (on ne sait pas si le message a été envoyé)."));
    return { block: false, warn };
  }
  /* تحذيرات خاصة بالرسالة المحدَّدة: مُرسَلة سابقاً، أو أول تواصل أُرسل فعلاً لهذه الجهة */
  function msgGuard(c, m) {
    const w = []; if (!m) return w;
    if (m.status === "sent") w.push(X("هذه الرسالة سُجّلت مُرسَلة بتاريخ " + fmtD(m.sentAt) + ".", "Ce message est enregistré comme envoyé le " + fmtD(m.sentAt) + "."));
    if (m.type === "first" && msgsOf(c).some(x => x.id !== m.id && x.type === "first" && x.status === "sent")) w.push(X("سبق إرسال رسالة «أول تواصل» لهذه الجهة.", "Un message « Premier contact » a déjà été envoyé à ce contact."));
    return w;
  }

  /* ── CSV / JSON ── */
  function parseCsv(text) {
    text = String(text || "").replace(/^﻿/, ""); const head = text.split(/\r?\n/)[0] || "";
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
  /* رسائل جاهزة: كل صف = رسالة (شركة، جهة الاتصال، هاتف، لغة، نوع، حملة، نص، ref اختياري، parent اختياري) */
  const MH = { company: ["company", "societe", "société", "entreprise", "الشركة", "شركة"], contact: ["contact", "contactname", "name", "person", "recipient", "fullname", "nom", "الاسم", "جهةالاتصال", "المستلم"], phone: HDR.phone, country: HDR.country, lang: ["lang", "language", "langue", "اللغة", "لغة"], type: ["type", "messagetype", "نوعالرسالة", "النوع"], campaign: ["campaign", "campagne", "الحملة", "حملة"], message: ["message", "text", "body", "messagetext", "finalmessage", "النص", "الرسالة", "نصالرسالة"], ref: ["ref", "id", "messageid", "reference", "المرجع"], parent: ["parent", "followupof", "replyto", "parentref", "parentid", "متابعةل"], notes: HDR.notes };
  function pick(o, k) { const al = MH[k].map(nz); for (const key of Object.keys(o)) if (al.includes(nz(key))) return String(o[key] == null ? "" : o[key]).trim(); return ""; }
  function rowsFromText(text) {
    const t = String(text || "").replace(/^﻿/, "").trim(); if (!t) return { rows: [], err: "" };
    let objs;
    if (t[0] === "[" || t[0] === "{") { try { const j = JSON.parse(t); objs = Array.isArray(j) ? j : (j.messages || j.items || j.data || (typeof j === "object" ? [j] : [])); } catch (e) { return { rows: [], err: X("ملف JSON غير صالح.", "JSON invalide.") }; } }
    else { const r = parseCsv(t); if (r.length < 2) return { rows: [], err: X("لا صفوف: ضع عناوين الأعمدة في الصف الأول.", "Aucune ligne : mettez les en-têtes de colonnes en première ligne.") }; const h = r[0]; objs = r.slice(1).map(a => { const o = {}; h.forEach((k, i) => { o[k] = a[i]; }); return o; }); }
    return { rows: objs.filter(o => o && typeof o === "object").map(o => { const x = {}; Object.keys(MH).forEach(k => { x[k] = pick(o, k); }); return x; }), err: "" };
  }
  const normLang = s => { const k = nz(s); if (!k) return ""; if (/^(en|eng|english|anglais|الإنجليزية|الانجليزية|انجليزي|إنجليزي)$/.test(k)) return "EN"; if (/^(fr|fra|french|francais|français|الفرنسية|فرنسي)$/.test(k)) return "FR"; if (/^(ar|ara|arabic|arabe|العربية|عربي)$/.test(k)) return "AR"; return String(s).trim().toUpperCase().slice(0, 4); };
  const normType = s => { const k = nz(s); if (!k) return "first"; if (/follow|relance|متابعة|rappel|noresp/.test(k)) return "followup"; if (/first|premier|أول|intro|1st/.test(k)) return "first"; if (/repl|réponse|reponse|رد/.test(k)) return "reply"; return "other"; };
  const normTxt = s => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

  /* ── الواجهة ── */
  const css = () => {
    if ($("waqs-css")) return; const st = document.createElement("style"); st.id = "waqs-css"; const P = ":is(#waqs,#waqs-m) ";
    st.textContent = [".wq-row{display:flex;gap:.6rem;align-items:center;justify-content:space-between;padding:.7rem .8rem;border:1px solid rgba(128,128,128,.28);border-radius:14px;margin:.45rem 0;cursor:pointer}.wq-row:hover{border-color:rgba(37,211,102,.7)}.wq-row.sel{border-color:#25d366;background:rgba(37,211,102,.1)}.wq-nm{font-weight:800}.wq-sub{font-size:.8rem;opacity:.75}.wq-pill{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.74rem;font-weight:800;color:#fff;white-space:nowrap}",
      ".wq-go{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;min-height:52px;border-radius:14px;background:#25d366;color:#07310f;font-weight:900;font-size:1.05rem;text-decoration:none;border:0;box-shadow:inset 0 -3px 0 rgba(0,0,0,.22)}.wq-go.off{background:#9ca3af;color:#1f2937;pointer-events:none;box-shadow:none}",
      "textarea,input[type=text],input[type=search],select{width:100%;box-sizing:border-box;background:rgba(128,128,128,.12);color:inherit;border:1px solid rgba(128,128,128,.35);border-radius:10px;padding:.55rem .65rem;font:inherit}textarea{min-height:130px;resize:vertical;line-height:1.7}",
      ".wq-warn{border:1px solid #d97706;background:rgba(217,119,6,.14);border-radius:12px;padding:.6rem .75rem;margin:.6rem 0;white-space:pre-line;line-height:1.7}.wq-bad{border-color:#dc2626;background:rgba(220,38,38,.14)}",
      ".wq-chip{display:inline-flex;align-items:center;gap:.35rem;padding:.3rem .7rem;border-radius:999px;border:1px solid rgba(128,128,128,.4);cursor:pointer;margin:.15rem;font-size:.84rem;font-weight:700}.wq-chip.on{outline:2px solid currentColor;font-weight:900}",
      ".wq-prev{white-space:pre-wrap;border-radius:14px;padding:.7rem .85rem;background:rgba(37,211,102,.14);border:1px solid rgba(37,211,102,.4);line-height:1.7;min-height:2.4rem}.wq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem;margin:.5rem 0}",
      ".wq-h{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}.wq-h h2{margin:0;flex:1 1 100%}",
      ".wq-q{display:grid;grid-template-columns:1.2fr 1.2fr .5fr 1fr 1.1fr;gap:.5rem;align-items:center}.wq-qh{font-size:.78rem;opacity:.7;font-weight:800;padding:0 .8rem;cursor:default;border:0}"
      ].map(r => r.replace(/(^|\})([^@}{][^{]*)\{/g, (m, a, sel) => a + sel.split(",").map(x => P + x).join(",") + "{")).join("") + "@media(max-width:700px){" + P + ".wq-row{flex-direction:column;align-items:flex-start}" + P + ".wq-q{grid-template-columns:1fr 1fr;width:100%}" + P + ".wq-qh{display:none}}";
    document.head.appendChild(st);
  };
  const pill = st => st ? '<span class="wq-pill" style="background:' + TONE[st] + '">' + esc(stl(st)) + "</span>" : '<span class="wq-pill" style="background:#6b7280">بلا تواصل</span>';
  const mpill = m => '<span class="wq-pill" style="background:' + MS[m.status][2] + '">' + esc(msl(m.status)) + "</span>";
  function list() {
    const q = S.q.trim().toLowerCase(), qd = q.replace(/\D/g, "");
    let L = S.doc.contacts.filter(c => {
      if (S.co && (c.company || "") !== S.co) return false;
      const lc = lastContact(c), last = lastLog(c), st = last ? (last.st === "reopen" ? "" : last.st) : "";
      if (S.f === "none" && lc) return false; if (S.f && S.f !== "none" && (st !== S.f)) return false;
      if (q && ![c.name, c.company, c.phone, c.country, c.notes].some(x => String(x || "").toLowerCase().includes(q)) && !(qd && String(c.phone || "").replace(/\D/g, "").includes(qd))) return false; return true; });
    return L.slice().sort((a, b) => ((lastContact(b) || { at: b.at }).at || 0) - ((lastContact(a) || { at: a.at }).at || 0));
  }
  const matchQ = (c, m) => { const q = S.q.trim().toLowerCase(), qd = q.replace(/\D/g, ""); if (!q) return true; return [c.name, c.company, c.phone, c.country, m && m.text, m && m.campaign].some(x => String(x || "").toLowerCase().includes(q)) || !!(qd && String(c.phone || "").replace(/\D/g, "").includes(qd)); };
  /* قائمة الإرسال: الرسائل الجاهزة (مرتَّبة بالحملة ثم الشركة) */
  function queueRows() { return S.doc.msgs.filter(m => m.status === "ready").map(m => ({ m, c: by(m.cid) })).filter(x => x.c && matchQ(x.c, x.m) && (!S.cp || x.m.campaign === S.cp) && (!S.lg || x.m.lang === S.lg)).sort((a, b) => String(a.m.campaign || "").localeCompare(String(b.m.campaign || "")) || String(a.c.company || a.c.name).localeCompare(String(b.c.company || b.c.name)) || a.m.at - b.m.at); }
  /* بانتظار المتابعة: أُرسلت لهم رسالة ولم يُسجَّل ردّ ولا إلغاء، الأقدم أولاً */
  function waitRows() { return S.doc.contacts.filter(c => { const lc = lastContact(c), l = lastLog(c); return lc && ["sent", "wait", "none"].includes(lc.st) && l.st !== "out"; }).map(c => ({ c, lc: lastContact(c), fu: msgsOf(c).filter(m => m.status === "ready" && m.type === "followup").length })).filter(x => matchQ(x.c, null) && (!S.cp || msgsOf(x.c).some(m => m.campaign === S.cp))).sort((a, b) => a.lc.at - b.lc.at); }
  function draw() {
    const h = $("waqs-content"); if (!h) return; css();
    const c = S.sel && by(S.sel); if (S.sel && !c) S.sel = null;
    h.innerHTML = '<div id="waqs" class="card">' + (S.err ? '<div class="wq-warn wq-bad">' + esc(S.err) + "</div>" : "") + (S.busy && !S.loaded ? '<p class="hint">جارٍ التحميل…</p>' : (c ? detail(c) : home())) + "</div>";
    frWalk($("waqs")); bind();
  }
  function home() {
    const R = queueRows(), W = waitRows(), cps = [...new Set(S.doc.msgs.map(m => m.campaign).filter(Boolean))].sort(), lgs = [...new Set(S.doc.msgs.map(m => m.lang).filter(Boolean))].sort(), cos = [...new Set(S.doc.contacts.map(c => c.company).filter(Boolean))].sort();
    const nR = S.doc.msgs.filter(m => m.status === "ready" && by(m.cid)).length;
    const tab = (k, ar, f, n) => '<span class="wq-chip' + (S.tab === k ? " on" : "") + '" data-wq="tab" data-k="' + k + '"><span>' + X(ar, f) + "</span><b>" + n + "</b></span>";
    let h = '<div class="wq-h"><h2>WhatsApp Quick Sender</h2><button class="small gold" type="button" data-wq="impm">' + X("استيراد رسائل جاهزة", "Importer des messages prêts") + '</button><button class="small gray" type="button" data-wq="addm">' + X("+ رسالة", "+ Message") + '</button><button class="small gray" type="button" data-wq="add">+ جهة اتصال</button><button class="small gray" type="button" data-wq="imp">' + X("استيراد جهات (CSV)", "Importer des contacts (CSV)") + "</button></div>" +
      '<p class="hint">' + X("الرسائل تُعدّ وتُخصَّص مسبقاً خارج المنصة، وهنا تُعرض وتُجهَّز للإرسال: تفتح الجهة فيُفتح WhatsApp بالنص النهائي وأنت تضغط «إرسال» بنفسك ثم تسجّل النتيجة. لا يُسجَّل «تم الإرسال» إلا بتسجيلك.", "Les messages sont rédigés et personnalisés à l'avance en dehors de la plateforme ; ici ils sont affichés et préparés pour l'envoi : ouvrez le contact, WhatsApp s'ouvre avec le texte final, vous appuyez vous-même sur « Envoyer », puis vous enregistrez le résultat. « Envoyé » n'est enregistré que par vous.") + "</p>" +
      "<div>" + tab("queue", "جاهزة للإرسال", "Prêts à envoyer", nR) + tab("wait", "بانتظار المتابعة", "En attente de relance", W.length) + tab("all", "كل جهات الاتصال", "Tous les contacts", S.doc.contacts.length) + "</div>" +
      '<div class="wq-grid"><input type="search" id="wq-q" placeholder="' + X("بحث بالاسم أو الشركة أو الرقم أو النص", "Rechercher par nom, société, numéro ou texte") + '" value="' + esc(S.q) + '">';
    if (S.tab === "all") h += '<select id="wq-f"><option value="">كل الحالات</option><option value="none"' + (S.f === "none" ? " selected" : "") + ">بلا تواصل بعد</option>" + PICK.map(k => '<option value="' + k + '"' + (S.f === k ? " selected" : "") + ">" + esc(stl(k)) + "</option>").join("") + '</select><select id="wq-co"><option value="">كل الشركات</option>' + cos.map(x => '<option value="' + esc(x) + '"' + (S.co === x ? " selected" : "") + ">" + esc(x) + "</option>").join("") + "</select>";
    else h += '<select id="wq-cp"><option value="">' + X("كل الحملات", "Toutes les campagnes") + "</option>" + cps.map(x => '<option value="' + esc(x) + '"' + (S.cp === x ? " selected" : "") + ">" + esc(x) + "</option>").join("") + "</select>" + (S.tab === "queue" ? '<select id="wq-lg"><option value="">' + X("كل اللغات", "Toutes les langues") + "</option>" + lgs.map(x => '<option value="' + esc(x) + '"' + (S.lg === x ? " selected" : "") + ">" + esc(x) + "</option>").join("") + "</select>" : "");
    h += "</div>";
    if (S.tab === "queue") {
      h += R.length ? '<div class="wq-row wq-qh wq-q"><span>الشركة</span><span>' + X("جهة الاتصال", "Contact") + "</span><span>" + X("اللغة", "Langue") + "</span><span>" + X("نوع الرسالة", "Type de message") + "</span><span>" + X("الحالة", "Statut") + "</span></div>" + R.map(x => '<div class="wq-row" data-wq="open" data-id="' + esc(x.c.id) + '" data-mid="' + esc(x.m.id) + '"><div class="wq-q" style="width:100%"><span class="wq-nm">' + esc(x.c.company || "—") + "</span><span>" + esc(x.c.name || "—") + '</span><span><span class="wq-pill" style="background:#0ea5e9">' + esc(x.m.lang || "—") + "</span></span><span>" + esc(mtl(x.m.type)) + (x.m.campaign ? '<div class="wq-sub">' + esc(x.m.campaign) + "</div>" : "") + "</span><span>" + mpill(x.m) + "</span></div></div>").join("")
        : '<div class="em">' + X("لا رسائل جاهزة للإرسال. استورد رسائل مُعدّة مسبقاً أو أضف رسالة.", "Aucun message prêt à envoyer. Importez des messages préparés ou ajoutez-en un.") + "</div>";
    } else if (S.tab === "wait") {
      h += W.length ? W.map(x => '<div class="wq-row" data-wq="open" data-id="' + esc(x.c.id) + '"><div><div class="wq-nm">' + esc(x.c.company || "—") + " · " + esc(x.c.name || "—") + '</div><div class="wq-sub">' + esc(X("آخر إرسال/تواصل: ", "Dernier envoi/contact : ") + ago(x.lc.at)) + (x.lc.type ? " · " + esc(mtl(x.lc.type)) : "") + '</div></div><div style="text-align:end">' + pill(lastLog(x.c).st === "reopen" ? "" : lastLog(x.c).st) + '<div><span class="wq-pill" style="background:' + (x.fu ? "#16a34a" : "#6b7280") + '">' + esc(x.fu ? X("متابعة جاهزة", "Relance prête") : X("لا متابعة مُعدّة", "Aucune relance préparée")) + "</span></div></div></div>").join("") : '<div class="em">' + X("لا جهات بانتظار المتابعة.", "Aucun contact en attente de relance.") + "</div>";
    } else {
      const L = list(); h += '<div class="hint">' + L.length + " من " + S.doc.contacts.length + " جهة اتصال</div>" +
        (L.length ? L.map(c => { const lc = lastContact(c), l = lastLog(c); return '<div class="wq-row" data-wq="open" data-id="' + esc(c.id) + '"><div><div class="wq-nm">' + esc(c.name || "—") + (c.company ? " · " + esc(c.company) : "") + '</div><div class="wq-sub" dir="ltr" style="text-align:start">+' + esc(normPhone(c.phone, c.country).num || c.phone) + (c.country ? " · " + esc(c.country) : "") + '</div></div><div style="text-align:end">' + pill(l ? (l.st === "reopen" ? "" : l.st) : "") + '<div class="wq-sub">' + (lc ? "آخر تواصل: " + esc(fmtD(lc.at)) : "لم يُتواصل بعد") + "</div></div></div>"; }).join("") : '<div class="em">' + (S.doc.contacts.length ? "لا نتائج مطابقة." : X("لا جهات اتصال بعد. أضف جهة أو استورد رسائل جاهزة أو ملف CSV.", "Aucun contact pour l'instant. Ajoutez-en un ou importez des messages prêts ou un fichier CSV.")) + "</div>");
    }
    return h;
  }
  function initSel(c, mid) { S.selFor = c.id; const r = msgsOf(c).filter(m => m.status === "ready"); S.mid = mid && mby(mid) ? mid : (r[0] ? r[0].id : null); S.custom = null; S.edit = false; }
  function compose(c) { const m = S.mid ? mby(S.mid) : null; const text = S.custom != null ? S.custom : (m ? m.text : ""); return { m, text, miss: missingVars(text) }; }
  function msgRow(m) {
    const par = m.parent && mby(m.parent);
    return '<div class="wq-row' + (S.mid === m.id ? " sel" : "") + '" data-wq="msel" data-id="' + esc(m.id) + '"><div><div class="wq-nm">' + esc(mtl(m.type)) + ' <span class="wq-pill" style="background:#0ea5e9">' + esc(m.lang || "—") + "</span></div>" +
      '<div class="wq-sub">' + esc([m.campaign, par ? X("متابعة للرسالة: ", "Relance du message : ") + mtl(par.type) + " (" + (par.status === "sent" ? fmtD(par.sentAt) : msl(par.status)) + ")" : ""].filter(Boolean).join(" · ")) + "</div></div><div>" + mpill(m) + "</div></div>";
  }
  function detail(c) {
    if (S.selFor !== c.id) initSel(c);
    const ph = normPhone(c.phone, c.country), g = guard(c), log = (c.log || []).slice().reverse(), out = g.block, ms = msgsOf(c), cp = compose(c), m = cp.m;
    const ok = ph.ok && !out && cp.text && !cp.miss.length;
    let h = '<div class="wq-h"><button class="small gray" type="button" data-wq="back">← القائمة</button><h2>' + esc(c.name || "—") + (c.company ? " · " + esc(c.company) : "") + '</h2><button class="small gray" type="button" data-wq="edit">تعديل</button><button class="small danger" type="button" data-wq="del">حذف</button></div>' +
      '<div class="wq-sub" dir="ltr" style="text-align:start;margin:.3rem 0">' + (ph.ok ? "+" + esc(ph.num) : '<span style="color:#dc2626">رقم غير صالح: ' + esc(c.phone) + "</span>") + (c.country ? " · " + esc(c.country) : "") + "</div>" +
      (c.notes ? '<div class="wq-sub">' + esc(c.notes) + "</div>" : "") +
      '<div style="margin:.5rem 0">' + pill(lastLog(c) ? (lastLog(c).st === "reopen" ? "" : lastLog(c).st) : "") + ' <span class="wq-sub">' + (lastContact(c) ? "آخر تواصل: " + esc(fmtD(lastContact(c).at)) : "لم يُتواصل بعد") + "</span></div>" +
      (g.warn.length ? '<div class="wq-warn' + (out ? " wq-bad" : "") + '">' + g.warn.map(esc).join("\n\n") + (out ? '</div><button class="small" type="button" data-wq="reopen">رفع إلغاء التواصل</button><div>' : "") + "</div>" : "") +
      '<div class="wq-h" style="margin-top:.6rem"><h3 style="margin:0;flex:1">' + X("الرسائل", "Messages") + '</h3><button class="small gold" type="button" data-wq="addm">' + X("+ رسالة", "+ Message") + "</button></div>" +
      (ms.length ? ms.map(msgRow).join("") : '<div class="em">' + X("لا رسائل لهذه الجهة. استورد رسائل جاهزة أو أضف رسالة.", "Aucun message pour ce contact. Importez des messages prêts ou ajoutez-en un.") + "</div>");
    if (m) {
      h += '<div class="hint" style="margin-top:.5rem">' + X("الرسالة النهائية (كما ستظهر في WhatsApp)", "Message final (tel qu'il apparaîtra dans WhatsApp)") + '</div><div class="wq-prev" id="wq-prev" dir="auto"></div>' +
        (cp.miss.length ? '<div class="wq-warn">' + X("في النص متغيرات هوية غير مكتملة (" + cp.miss.join(" ") + "). أكمل «هويتي» أو احذفها من النص.", "Le texte contient des variables d'identité incomplètes (" + cp.miss.join(" ") + "). Complétez « Mon identité » ou supprimez-les du texte.") + '</div><button class="small gold" type="button" data-wq="me">' + X("هويتي", "Mon identité") + "</button>" : "") +
        (m.status === "sent" && m.sentText ? '<div class="wq-warn">' + X("نسخة الرسالة المُرسَلة فعلياً (", "Copie du message réellement envoyé (") + esc(fmtD(m.sentAt)) + "):\n" + esc(m.sentText) + "</div>" : "") +
        '<div class="wq-h" style="margin:.4rem 0"><button class="small gray" type="button" data-wq="custom">' + (S.edit ? X("إخفاء المحرر", "Masquer l'éditeur") : X("تخصيص الرسالة قبل الفتح (اختياري)", "Personnaliser le message avant l'ouverture (facultatif)")) + "</button>" + (S.custom != null ? '<button class="small gray" type="button" data-wq="resetmsg">' + X("إعادة الرسالة الأصلية", "Rétablir le message d'origine") + "</button>" : "") +
        '<button class="small gray" type="button" data-wq="medit">' + X("تعديل الرسالة", "Modifier le message") + "</button>" + (m.status === "ready" ? '<button class="small gray" type="button" data-wq="mskip">' + X("تخطّي", "Ignorer") + "</button>" : m.status === "skipped" ? '<button class="small gray" type="button" data-wq="munskip">' + X("إعادة إلى جاهزة", "Remettre en prêt") + "</button>" : "") + '<button class="small danger" type="button" data-wq="mdel">' + X("حذف الرسالة", "Supprimer le message") + "</button></div>" +
        (S.edit ? '<textarea id="wq-msg" dir="auto">' + esc(S.custom == null ? m.text : S.custom) + "</textarea>" : "");
    } else if (ms.length) h += '<div class="hint" style="margin-top:.5rem">' + X("اختر رسالة من القائمة أعلاه.", "Choisissez un message dans la liste ci-dessus.") + "</div>";
    h += '<div style="margin:.7rem 0"><a id="wq-go" class="wq-go' + (ok ? "" : " off") + '" href="' + (ok ? esc(waUrl(ph.num, cp.text)) : "#") + '" target="_blank" rel="noopener noreferrer" data-wq="go">فتح WhatsApp</a>' +
      '<div class="hint" style="margin-top:.35rem">يفتح المحادثة مع الرقم والنص النهائي مكتوباً مسبقاً. <b>لا يُسجَّل الإرسال تلقائياً</b>: راجع الرسالة واضغط «إرسال» داخل WhatsApp Business ثم عُد وسجّل النتيجة أدناه.</div></div>' +
      (c.opened && (!lastContact(c) || c.opened.at > lastContact(c).at) ? '<div class="wq-warn">فُتحت المحادثة ' + ago(c.opened.at) + " — لم تُسجَّل نتيجتها بعد.</div>" : "") +
      '<h3 style="margin:.8rem 0 .3rem">تسجيل حالة التواصل</h3><div>' + PICK.map(k => '<span class="wq-chip' + (S.pick === k ? " on" : "") + '" data-wq="pick" data-k="' + k + '" style="color:' + TONE[k] + '">' + esc(stl(k)) + "</span>").join("") + "</div>" +
      '<input type="text" id="wq-note" placeholder="ملاحظة (اختياري)" style="margin:.4rem 0"><button class="small gold" type="button" data-wq="log"' + (S.pick ? "" : " disabled") + ">تسجيل</button>" +
      '<h3 style="margin:.9rem 0 .3rem">تاريخ التواصل</h3>' + (log.length ? log.map(x => '<div class="wq-row" style="cursor:default"><div><span class="wq-pill" style="background:' + TONE[x.st] + '">' + esc(stl(x.st)) + '</span> <span class="wq-sub">' + esc(fmtD(x.at)) + "</span>" + (x.type ? '<div class="wq-sub">' + esc([mtl(x.type), x.lang, x.campaign, x.custom ? X("مخصَّصة", "personnalisé") : ""].filter(Boolean).join(" · ")) + "</div>" : "") + (x.note ? '<div class="wq-sub">' + esc(x.note) + "</div>" : "") + (x.msg ? '<div class="wq-sub" dir="auto">' + esc(String(x.msg).slice(0, 220)) + "</div>" : "") + '</div><button class="small gray" type="button" data-wq="dellog" data-at="' + x.at + '">حذف</button></div>').join("") : '<div class="em">لا تواصل مسجَّل.</div>');
    return h;
  }
  /* ── النوافذ ── */
  function modal(html) {
    const old = $("wq-modal"); if (old) old.remove(); const bg = document.createElement("div"); bg.id = "wq-modal"; bg.className = "modal-bg open"; bg.innerHTML = '<div class="modal" style="max-width:600px" id="waqs-m">' + html + "</div>"; document.body.appendChild(bg); frWalk(bg);
    bg.addEventListener("click", e => { if (e.target === bg) bg.remove(); }); return bg;
  }
  function contactForm(c) {
    const bg = modal('<h3>' + (c ? "تعديل جهة اتصال" : "جهة اتصال جديدة") + '</h3><div class="field"><label>الاسم</label><input type="text" id="wf-n" value="' + esc(c ? c.name : "") + '"></div><div class="field"><label>الشركة</label><input type="text" id="wf-c" value="' + esc(c ? c.company : "") + '"></div><div class="field"><label>رقم الهاتف (دولي: +213…)</label><input type="text" id="wf-p" dir="ltr" inputmode="tel" value="' + esc(c ? c.phone : "") + '"></div><div class="field"><label>الدولة</label><input type="text" id="wf-k" list="wf-kl" value="' + esc(c ? c.country : "الجزائر") + '"><datalist id="wf-kl">' + ["الجزائر", "المغرب", "تونس", "ليبيا", "مصر", "السعودية", "الإمارات", "فرنسا"].map(x => '<option value="' + x + '">').join("") + '</datalist></div><div class="field"><label>ملاحظات</label><textarea id="wf-t" style="min-height:70px">' + esc(c ? c.notes : "") + '</textarea></div><div id="wf-e" style="color:#dc2626;min-height:1.3rem"></div><div class="action-bar"><button class="small gold" type="button" id="wf-ok">حفظ</button><button class="small gray" type="button" id="wf-no">إلغاء</button></div>');
    bg.querySelector("#wf-no").onclick = () => bg.remove();
    bg.querySelector("#wf-ok").onclick = async () => {
      const v = id => bg.querySelector(id).value.trim(), ph = normPhone(v("#wf-p"), v("#wf-k")), err = bg.querySelector("#wf-e");
      if (!v("#wf-n") && !v("#wf-c")) { err.textContent = M("none"); return; }
      if (!ph.ok) { err.textContent = M("badph"); return; }
      const dup = S.doc.contacts.find(x => x.id !== (c && c.id) && normPhone(x.phone, x.country).num === ph.num); if (dup) { err.textContent = M("dup") + (dup.name || dup.company) + X("».", " »."); return; }
      if (c) Object.assign(c, { name: v("#wf-n"), company: v("#wf-c"), phone: v("#wf-p"), country: v("#wf-k"), notes: v("#wf-t") });
      else { const n = { id: uid(), name: v("#wf-n"), company: v("#wf-c"), phone: v("#wf-p"), country: v("#wf-k"), notes: v("#wf-t"), at: Date.now(), log: [] }; S.doc.contacts.push(n); S.sel = n.id; S.tab = "all"; }
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
    bg.querySelector("#wi-ok").onclick = async () => { ready.forEach(r => S.doc.contacts.push({ id: uid(), name: r.name, company: r.company, phone: r.phone, country: r.country, notes: r.notes, at: Date.now(), log: [] })); const n = ready.length; bg.remove(); S.tab = "all"; draw(); await save(); toast(X("✅ استُوردت " + n + " جهة اتصال", "✅ " + n + " contact(s) importé(s)")); };
  }
  /* ── استيراد الرسائل الجاهزة: يربط كل رسالة بجهتها (ويُنشئ الجهة إن لم تكن موجودة)، يتخطّى المكرَّر، ويربط المتابعات بأول تواصل ── */
  function planMessages(text, dk, dcp) {
    const parsed = rowsFromText(text), plan = { err: parsed.err, rows: parsed.rows.length, msgs: [], contacts: [], dup: 0, bad: 0, newC: 0, oldC: 0 };
    const byPhone = new Map(S.doc.contacts.map(c => [normPhone(c.phone, c.country).num, c])), refMap = new Map(S.doc.msgs.filter(m => m.ref).map(m => [m.ref, m.id])), seenTxt = new Set(S.doc.msgs.flatMap(m => [m.cid + "|" + normTxt(m.text)].concat(m.sentText ? [m.cid + "|" + normTxt(m.sentText)] : []))), newRef = new Map(), usedC = new Set();
    parsed.rows.forEach(r => {
      const p = normPhone(r.phone, r.country || dk); if (!r.message.trim() || !p.ok) { plan.bad++; return; }
      let c = byPhone.get(p.num); if (!c) { c = { id: uid(), name: r.contact, company: r.company, phone: r.phone, country: r.country || dk, notes: r.notes, at: Date.now(), log: [], _new: true }; byPhone.set(p.num, c); plan.contacts.push(c); plan.newC++; }
      if (!usedC.has(c.id) && !c._new) { usedC.add(c.id); plan.oldC++; }
      const key = c.id + "|" + normTxt(r.message); if (seenTxt.has(key) || (r.ref && refMap.has(r.ref))) { plan.dup++; return; } seenTxt.add(key);
      const m = { id: uid("m"), cid: c.id, campaign: r.campaign || dcp || "", lang: normLang(r.lang), type: normType(r.type), text: r.message.trim(), parent: "", ref: r.ref, status: "ready", at: Date.now() + plan.msgs.length, _pref: r.parent };
      if (r.ref) newRef.set(r.ref, m.id); plan.msgs.push(m);
    });
    plan.msgs.forEach(m => {
      if (m._pref) m.parent = newRef.get(m._pref) || refMap.get(m._pref) || "";
      if (!m.parent && (m.type === "followup" || m.type === "reply")) { const firsts = S.doc.msgs.concat(plan.msgs).filter(x => x.cid === m.cid && x.type === "first" && x.id !== m.id).sort((a, b) => b.at - a.at); if (firsts[0]) m.parent = firsts[0].id; }
    });
    return plan;
  }
  function importMsgsForm() {
    const bg = modal('<h3>' + X("استيراد رسائل جاهزة", "Importer des messages prêts") + '</h3><p class="hint">' + X("كل صف رسالة مُعدّة مسبقاً. الأعمدة (بعناوين في الصف الأول، أو مفاتيح في JSON): الشركة، جهة الاتصال، الهاتف، اللغة (EN/FR)، نوع الرسالة (First Contact / Follow-up)، الحملة، الرسالة، وبشكل اختياري ref ومرجع الرسالة الأم parent. تُنشأ الجهات غير الموجودة، وتُتخطّى الرسائل المكرَّرة، وتُربط المتابعات بالرسالة الأولى.", "Chaque ligne est un message préparé. Colonnes (en-têtes en première ligne, ou clés en JSON) : société, contact, téléphone, langue (EN/FR), type de message (First Contact / Follow-up), campagne, message, et facultativement ref et parent (message d'origine). Les contacts absents sont créés, les doublons ignorés et les relances rattachées au premier message.") + '</p><textarea id="wm-t" dir="auto" style="min-height:120px" placeholder="' + X("الصق الرسائل هنا (JSON أو CSV) أو اختر ملفاً", "Collez les messages ici (JSON ou CSV) ou choisissez un fichier") + '"></textarea><input type="file" id="wm-f" accept=".csv,.txt,.json,text/csv,application/json" style="margin:.4rem 0"><div class="wq-grid"><div class="field"><label>' + X("الحملة الافتراضية", "Campagne par défaut") + '</label><input type="text" id="wm-c"></div><div class="field"><label>الدولة الافتراضية للأرقام المحلية (تبدأ بصفر)</label><input type="text" id="wm-k" list="wf-kl" value="الجزائر"></div></div><div id="wm-r" class="hint" style="white-space:pre-line;margin:.5rem 0"></div><div class="action-bar"><button class="small gold" type="button" id="wm-ok" disabled>استيراد</button><button class="small gray" type="button" id="wm-no">إغلاق</button></div>');
    let plan = null; const q = s => bg.querySelector(s);
    const run = () => { plan = planMessages(q("#wm-t").value, q("#wm-k").value.trim(), q("#wm-c").value.trim()); q("#wm-r").textContent = plan.err || (plan.rows ? X("الصفوف: ", "Lignes : ") + plan.rows + X("\nرسائل جديدة: ", "\nNouveaux messages : ") + plan.msgs.length + X("\nجهات جديدة: ", "\nNouveaux contacts : ") + plan.newC + X("\nمكرَّرة (متخطّاة): ", "\nDoublons (ignorés) : ") + plan.dup + X("\nغير صالحة (بلا رقم صالح أو نص): ", "\nInvalides (sans numéro valide ou texte) : ") + plan.bad : ""); q("#wm-ok").disabled = !plan.msgs.length; };
    q("#wm-t").oninput = run; q("#wm-k").oninput = run; q("#wm-c").oninput = run;
    q("#wm-f").onchange = async e => { const f = e.target.files && e.target.files[0]; if (!f) return; q("#wm-t").value = await f.text(); run(); };
    q("#wm-no").onclick = () => bg.remove();
    q("#wm-ok").onclick = async () => { if (!plan || !plan.msgs.length) return; plan.contacts.forEach(c => { delete c._new; S.doc.contacts.push(c); }); plan.msgs.forEach(m => { delete m._pref; S.doc.msgs.push(m); }); const n = plan.msgs.length; bg.remove(); S.tab = "queue"; draw(); await save(); toast(X("✅ استُوردت " + n + " رسالة", "✅ " + n + " message(s) importé(s)")); };
  }
  /* إضافة/تعديل رسالة يدوياً (ما أعدّه ChatGPT يُلصَق هنا)؛ القوالب المساعدة اختيارية */
  function msgForm(c, m) {
    const cs = S.doc.contacts.slice().sort((a, b) => String(a.company || a.name).localeCompare(String(b.company || b.name))), cps = [...new Set(S.doc.msgs.map(x => x.campaign).filter(Boolean))];
    if (!cs.length) { toast(X("أضف جهة اتصال أولاً.", "Ajoutez d'abord un contact.")); return; }
    const cur = m ? by(m.cid) : c || cs[0], co0 = Lib.country(cur.country), lang0 = co0 ? co0.lang.toUpperCase() : "EN", hasFirst = !m && msgsOf(cur).some(x => x.type === "first");
    const bg = modal('<h3>' + (m ? X("تعديل الرسالة", "Modifier le message") : X("رسالة جديدة", "Nouveau message")) + '</h3><div class="wq-grid"><div class="field"><label>' + X("جهة الاتصال", "Contact") + '</label><select id="mf-c"' + (m ? " disabled" : "") + ">" + cs.map(x => '<option value="' + esc(x.id) + '"' + (x.id === cur.id ? " selected" : "") + ">" + esc((x.company ? x.company + " — " : "") + (x.name || x.phone)) + "</option>").join("") + '</select></div><div class="field"><label>' + X("الحملة", "Campagne") + '</label><input type="text" id="mf-cp" list="mf-cpl" value="' + esc(m ? m.campaign : (S.cp || "")) + '"><datalist id="mf-cpl">' + cps.map(x => '<option value="' + esc(x) + '">').join("") + '</datalist></div></div><div class="wq-grid"><div class="field"><label>' + X("اللغة", "Langue") + '</label><select id="mf-l">' + ["EN", "FR", "AR"].map(x => '<option value="' + x + '"' + (x === (m ? m.lang : lang0) ? " selected" : "") + ">" + x + "</option>").join("") + '</select></div><div class="field"><label>' + X("نوع الرسالة", "Type de message") + '</label><select id="mf-t">' + Object.keys(MT).map(k => '<option value="' + k + '"' + ((m ? m.type === k : (hasFirst ? k === "followup" : k === "first")) ? " selected" : "") + ">" + esc(mtl(k)) + "</option>").join("") + '</select></div></div><div class="field"><label>' + X("متابعة/رد على الرسالة", "Relance / réponse au message") + '</label><select id="mf-p"></select></div><div class="field"><label>' + X("نص الرسالة النهائي", "Texte final du message") + '</label><textarea id="mf-x" dir="auto" style="min-height:170px">' + esc(m ? m.text : "") + '</textarea></div><div class="wq-grid"><div class="field"><label>' + X("قالب مساعد (اختياري)", "Modèle d'aide (facultatif)") + '</label><select id="mf-tp"><option value="">—</option>' + Lib.types.map(t => '<option value="' + t.k + '">' + esc(t.en + " · " + (fr() ? t.fr : t.ar)) + "</option>").join("") + '</select></div><div class="field" style="align-self:end"><button class="small gray" type="button" id="mf-fill">' + X("ملء من قالب", "Remplir depuis le modèle") + '</button> <button class="small gray" type="button" id="mf-me">' + X("هويتي", "Mon identité") + '</button></div></div><div id="mf-e" style="color:#dc2626;min-height:1.3rem;white-space:pre-line"></div><div class="action-bar"><button class="small gold" type="button" id="mf-ok">حفظ</button><button class="small gray" type="button" id="mf-no">إلغاء</button></div>');
    const q = s => bg.querySelector(s), contact = () => by(q("#mf-c").value);
    const parents = () => { const k = contact(), sel = q("#mf-p"), cp0 = m ? m.parent : ""; sel.innerHTML = '<option value="">' + X("— بدون —", "— Aucun —") + "</option>" + msgsOf(k).filter(x => !m || x.id !== m.id).map(x => '<option value="' + esc(x.id) + '"' + (x.id === cp0 ? " selected" : "") + ">" + esc(mtl(x.type) + " · " + (x.lang || "") + " · " + msl(x.status)) + "</option>").join(""); };
    parents(); q("#mf-c").onchange = parents; q("#mf-no").onclick = () => bg.remove(); q("#mf-me").onclick = () => meForm();
    q("#mf-fill").onclick = () => { const k = q("#mf-tp").value, L = q("#mf-l").value.toLowerCase(), t = Lib.tpls.find(x => x.type === k && x.lang === L); if (!t) { q("#mf-e").textContent = X("لا قالب بهذه اللغة لهذا النوع.", "Aucun modèle dans cette langue pour ce type."); return; } q("#mf-x").value = render(t.text, contact(), L); const miss = missingVars(q("#mf-x").value); q("#mf-e").textContent = miss.length ? X("أكمل «هويتي» (الاسم والشركة وما تقدّمه بهذه اللغة) ثم أعد الملء، أو عدّل النص يدوياً.", "Complétez « Mon identité » (nom, société et ce que vous proposez dans cette langue) puis remplissez à nouveau, ou modifiez le texte à la main.") : ""; };
    q("#mf-ok").onclick = async () => {
      const text = q("#mf-x").value.trim(), k = contact(); if (!text) { q("#mf-e").textContent = X("اكتب نص الرسالة.", "Saisissez le texte du message."); return; }
      if (missingVars(text).length) { q("#mf-e").textContent = X("النص يحوي متغيرات هوية غير مكتملة: " + missingVars(text).join(" "), "Le texte contient des variables d'identité incomplètes : " + missingVars(text).join(" ")); return; }
      if (!m && S.doc.msgs.some(x => x.cid === k.id && (normTxt(x.text) === normTxt(text) || (x.sentText && normTxt(x.sentText) === normTxt(text))))) { q("#mf-e").textContent = X("هذه الرسالة موجودة مسبقاً لهذه الجهة.", "Ce message existe déjà pour ce contact."); return; }
      const f = { campaign: q("#mf-cp").value.trim(), lang: q("#mf-l").value, type: q("#mf-t").value, text, parent: q("#mf-p").value };
      if (m) Object.assign(m, f); else { const n = Object.assign({ id: uid("m"), cid: k.id, ref: "", status: "ready", at: Date.now() }, f); S.doc.msgs.push(n); S.sel = k.id; S.selFor = k.id; S.mid = n.id; S.custom = null; S.edit = false; }
      bg.remove(); draw(); await save();
    };
  }
  /* هويتي: تُستعمل فقط لملء متغيرات القوالب المساعدة */
  function meForm() {
    const me = S.doc.me, dc = (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.name) || "";
    const bg = modal('<h3>' + X("هويتي (للقوالب المساعدة)", "Mon identité (pour les modèles d'aide)") + '</h3><p class="hint">' + X("تُستعمل فقط حين تملأ رسالة من قالب مساعد ({sender} و{my_company} و{offer}). الرسائل الجاهزة المستوردة لا تحتاجها.", "Utilisée uniquement quand vous remplissez un message depuis un modèle d'aide ({sender}, {my_company} et {offer}). Les messages prêts importés n'en ont pas besoin.") + '</p><div class="field"><label>' + X("اسمك (المرسِل)", "Votre nom (expéditeur)") + '</label><input type="text" id="me-n" value="' + esc(me.name) + '"></div><div class="field"><label>' + X("اسم شركتك", "Nom de votre société") + '</label><input type="text" id="me-c" value="' + esc(me.company || dc) + '"></div>' + ["en", "fr", "ar"].map(l => '<div class="field"><label>' + X("ما تقدّمه — ", "Ce que vous proposez — ") + l.toUpperCase() + '</label><input type="text" id="me-' + l + '" dir="auto" value="' + esc(me.offer[l]) + '"></div>').join("") + '<div class="action-bar"><button class="small gold" type="button" id="me-ok">حفظ</button><button class="small gray" type="button" id="me-no">إلغاء</button></div>');
    bg.querySelector("#me-no").onclick = () => bg.remove();
    bg.querySelector("#me-ok").onclick = async () => { const v = s => bg.querySelector(s).value.trim(); S.doc.me = { name: v("#me-n"), company: v("#me-c"), offer: { en: v("#me-en"), fr: v("#me-fr"), ar: v("#me-ar") } }; bg.remove(); draw(); await save(); };
  }
  /* ── الأحداث ── */
  function refreshGo(c) {
    const ph = normPhone(c.phone, c.country), cp = compose(c), a = $("wq-go"), pv = $("wq-prev"), ok = ph.ok && !guard(c).block && cp.text && !cp.miss.length;
    if (pv) pv.textContent = cp.text || X("(رسالة فارغة)", "(message vide)");
    if (a) { a.classList.toggle("off", !ok); a.href = ok ? waUrl(ph.num, cp.text) : "#"; }
  }
  function bind() {
    const h = $("waqs"); if (!h) return; const c = S.sel && by(S.sel);
    const q = $("wq-q"); if (q) q.oninput = () => { S.q = q.value; const pos = q.selectionStart; draw(); const n = $("wq-q"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) { } } };
    [["wq-f", "f"], ["wq-co", "co"], ["wq-cp", "cp"], ["wq-lg", "lg"]].forEach(([id, k]) => { const e = $(id); if (e) e.onchange = () => { S[k] = e.value; draw(); }; });
    if (c) { const t = $("wq-msg"); if (t) t.oninput = () => { S.custom = t.value; refreshGo(c); }; refreshGo(c); }
    h.onclick = async e => {
      const b = e.target.closest && e.target.closest("[data-wq]"); if (!b) return; const a = b.dataset.wq;
      if (a === "add") return contactForm(null); if (a === "imp") return importForm(); if (a === "impm") return importMsgsForm(); if (a === "me") return meForm();
      if (a === "addm") return msgForm(c, null);
      if (a === "tab") { S.tab = b.dataset.k; return draw(); }
      if (a === "open") { S.sel = b.dataset.id; S.pick = ""; S.selFor = null; if (b.dataset.mid) { const k = by(S.sel); if (k) initSel(k, b.dataset.mid); } return draw(); } if (a === "back") { S.sel = null; S.selFor = null; return draw(); }
      if (!c) return;
      if (a === "edit") return contactForm(c);
      if (a === "del") { if (confirm(X("حذف «" + (c.name || c.company) + "» وكل رسائله وتاريخ تواصله؟", "Supprimer « " + (c.name || c.company) + " », ses messages et tout son historique ?"))) { S.doc.contacts = S.doc.contacts.filter(x => x.id !== c.id); S.doc.msgs = S.doc.msgs.filter(x => x.cid !== c.id); S.sel = null; draw(); await save(); } return; }
      if (a === "msel") { S.mid = b.dataset.id; S.custom = null; S.edit = false; return draw(); }
      if (a === "custom") { S.edit = !S.edit; const m = S.mid && mby(S.mid); if (S.edit && S.custom == null && m) S.custom = m.text; return draw(); }
      if (a === "resetmsg") { S.custom = null; S.edit = false; return draw(); }
      if (a === "medit") { const m = S.mid && mby(S.mid); return m && msgForm(c, m); }
      if (a === "mskip" || a === "munskip") { const m = S.mid && mby(S.mid); if (m) { m.status = a === "mskip" ? "skipped" : "ready"; draw(); await save(); } return; }
      if (a === "mdel") { const m = S.mid && mby(S.mid); if (m && confirm(X("حذف هذه الرسالة؟", "Supprimer ce message ?"))) { S.doc.msgs = S.doc.msgs.filter(x => x.id !== m.id); S.doc.msgs.forEach(x => { if (x.parent === m.id) x.parent = ""; }); S.mid = null; S.selFor = null; draw(); await save(); } return; }
      if (a === "reopen") { c.log = (c.log || []).concat([{ at: Date.now(), st: "reopen", note: M("reopenNote"), msg: "" }]); draw(); return save(); }
      if (a === "pick") { S.pick = S.pick === b.dataset.k ? "" : b.dataset.k; const n = $("wq-note"), v = n ? n.value : ""; draw(); const n2 = $("wq-note"); if (n2) n2.value = v; return; }
      if (a === "log") {
        if (!S.pick) return; const note = ($("wq-note") || {}).value || "", cp = compose(c), op = c.opened && (!lastContact(c) || c.opened.at > lastContact(c).at) ? c.opened : null;
        const src = op || { msg: cp.text, mid: cp.m ? cp.m.id : "", type: cp.m ? cp.m.type : "", lang: cp.m ? cp.m.lang : "", campaign: cp.m ? cp.m.campaign : "", custom: S.custom != null };
        const out = S.pick === "out", e2 = { at: Date.now(), st: S.pick, msg: out ? "" : src.msg, note: note.trim() };
        if (!out && src.type) Object.assign(e2, { mid: src.mid, type: src.type, lang: src.lang, campaign: src.campaign, custom: !!src.custom });
        c.log = (c.log || []).concat([e2]);
        if (S.pick === "sent" && src.mid) { const m = mby(src.mid); if (m && m.status !== "sent") { m.status = "sent"; m.sentAt = e2.at; m.sentText = src.msg; } }
        S.pick = ""; draw(); await save(); return toast(M("logged")); }
      if (a === "dellog") { if (confirm(M("dellog"))) { c.log = (c.log || []).filter(x => String(x.at) !== b.dataset.at); draw(); await save(); } return; }
      if (a === "go") {
        const ph = normPhone(c.phone, c.country), g = guard(c), cp = compose(c);
        if (!ph.ok || g.block || !cp.text || cp.miss.length) { e.preventDefault(); return; }
        const warn = g.warn.concat(msgGuard(c, cp.m));
        if (warn.length && !confirm(warn.join("\n\n") + M("again"))) { e.preventDefault(); return; }
        c.opened = { at: Date.now(), msg: cp.text, mid: cp.m ? cp.m.id : "", type: cp.m ? cp.m.type : "", lang: cp.m ? cp.m.lang : "", campaign: cp.m ? cp.m.campaign : "", custom: S.custom != null }; clearTimeout(S.tmr); save(); setTimeout(draw, 400);
      }
    };
  }
  try { new MutationObserver(() => { const el = $("tab-waqs"); if (S.loaded && el && !el.classList.contains("hidden")) draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] }); } catch (_) { }
  const open = () => { css(); if (!S.loaded) load(); else draw(); };
  const wrap = () => { if (typeof Admin === "undefined" || Admin._waqsWrapped) return; const orig = Admin.tab; Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-waqs"); if (el) el.classList.toggle("hidden", t !== "waqs"); if (t === "waqs") open(); return r; }; Admin._waqsWrapped = true; };
  if (typeof Admin !== "undefined") wrap(); else document.addEventListener("DOMContentLoaded", wrap);
  return { normPhone, render, waUrl, parseCsv, mapRows, rowsFromText, planMessages, guard, msgGuard, compose, S, open, ST };
})();
