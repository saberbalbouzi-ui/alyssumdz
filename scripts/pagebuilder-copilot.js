/* ════════════════════════════════════════════════════════════════════════════════
   PBCopilot — طبقة ذكاء اصطناعي فوق المحرر و PBSpec (النموذج الأولي، بمحاكيات؛ بلا واجهة ولا ربط بالمحرر).
   الفكرة: نموذج اللغة لا يلمس المحرر؛ يُخرج «أوامر JSON» تُتحقَّق ثم تُنفَّذ على نسخة عمل من الصفحة، وبعد النجاح تُعتمد في المحرر دفعة واحدة:
     • تراجع ذري: كل التشغيل = مدخل واحد في تاريخ المحرر (E.hist)، والتراجع يعيد الصفحة كما كانت بايتاً ببايت (بما فيها الصور والطبقات).
     • استئناف آمن: حالة التشغيل (الأوامر المنفَّذة، نسخة العمل، معرّفات العناصر، مسارات الصور المرفوعة، العدّادات) تُحفظ بعد كل أمر؛
       لا يُعاد أمر منجَز ولا تُكرَّر إضافة عنصر ولا رفع صورة.
     • تعديل تدريجي: kind="edit" لا يغيّر إلا العناصر المذكورة في الأوامر (فحص لاحق: الفرق بين الصفحتين ⊆ ما لُمس وإلا يُلغى التشغيل).
     • أمان: لا HTML ولا JavaScript من النموذج؛ أنواع أوامر مسموحة فقط؛ لا نشر ولا تعديل منتج؛ الروابط https/#/tel/mailto فقط.
     • البيانات التجارية: يقدّم المستخدم السعر والعروض قبل الإنشاء (facts)؛ يكتب النموذج رموزاً مثل {{price}} يستبدلها الكود بنص عادي،
       وأي رقم سعر/عرض/خصم غير مقدَّم يُرفض؛ والناتج نص عادي قابل للتعديل (لا ربط بـ pprice/poffers) ولا يمنع النظام المستخدم من تغييره لاحقاً.
     • التكلفة: الحدود الحقيقية مسؤولية الخادم (adapters.guard)؛ بلا guard لا تعمل إلا المحوّلات الوهمية (mock:true). وسقوف التشغيل (صور/نموذج/إعادات)
       تُحفظ مع الحالة فلا تُصفَّر بالاستئناف — حماية إضافية لا بديلاً عن الخادم.
   يعتمد على: PB (بناء العناصر)، PBSpec (validate/toSections/assetKey)، PBApp (E, commitAfter, uploadBlob). لا يعدّل أياً منها.
   ════════════════════════════════════════════════════════════════════════════════ */
const PBCopilot = (() => {
  "use strict";
  const V = 1, MAX_JSON = 250000, MAX_OPS = 120;
  const DEF_LIMITS = { llm: 6, img: 8, retries: 1, ops: MAX_OPS };
  class CmdError extends Error { constructor(code, msg, extra) { super(msg || code); this.code = code; if (extra) Object.assign(this, extra); } }
  const isStop = e => !!(e && (e.interrupt || e.cancelled));      // انقطاع/إلغاء من المستخدم: يُحفظ التشغيل ويمكن استئنافه ولا يُعدّ فشلاً
  class Interrupt extends Error { constructor(msg) { super(msg || "interrupt"); this.interrupt = true; } }

  /* ───────────── أدوات ───────────── */
  const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
  const clone = o => JSON.parse(JSON.stringify(o));
  /* بصمة الصفحة بلا قائمة الوسائط: رفع الصور أثناء التشغيل (PBApp.uploadBlob) يضيف إلى page.media في الصفحة الحيّة وهذا ليس تغييراً من المستخدم */
  const baseJson = p => { const c = Object.assign({}, p); delete c.media; return JSON.stringify(c); };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36) + ":" + s.length; };
  const str = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n || 400);
  const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[0-9.\s,%\/]+\)|transparent)$/i;
  const LINK = /^(#[\w-]*|https:\/\/[^\s"'<>]+|tel:\+?[0-9]+|mailto:[^\s"'<>]+)$/i;
  const IMGSRC = /^(assets\/[\w\-./%]+|https:\/\/[^\s"'<>]+)$/;
  const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const S = () => { if (typeof PBSpec === "undefined") throw new CmdError("no_spec", "PBSpec غير محمّلة"); return PBSpec; };
  const ED = () => (typeof PBApp !== "undefined" && PBApp.E) || null;
  const livePage = () => { const e = ED(); if (!e || !e.page) throw new CmdError("no_page", "افتح صفحة في المطوّر أولاً"); return e.page; };
  const scan = (v, d) => { d = d || 0; if (d > 12) throw new CmdError("too_deep", "بنية عميقة جداً"); if (Array.isArray(v)) v.forEach(x => scan(x, d + 1)); else if (isObj(v)) for (const k of Object.keys(v)) { if (FORBIDDEN_KEYS.has(k)) throw new CmdError("forbidden_key", "مفتاح ممنوع: " + k); scan(v[k], d + 1); } };

  /* ───────────── البيانات التجارية التي يقدّمها المستخدم ───────────── */
  const money = v => { if (v == null || v === "") return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= 10000000 ? n : null; };
  function normFacts(f) {
    if (!isObj(f)) throw new CmdError("facts_required", "يلزم أن يقدّم المستخدم السعر والعروض قبل إنشاء الصفحة");
    const out = { currency: str(f.currency, 12).trim() || "دج", product: str(f.product || f.productName, 120).trim(), desc: str(f.desc || f.description, 700).replace(/\s+/g, " ").trim(), price: money(f.price), oldPrice: money(f.oldPrice != null ? f.oldPrice : f.old), offers: [] };
    (Array.isArray(f.offers) ? f.offers : []).slice(0, 8).forEach((o, i) => { if (!isObj(o)) return; const price = money(o.price); if (price == null) return; out.offers.push({ n: out.offers.length + 1, label: str(o.label, 80).trim(), qty: money(o.qty), price, free: money(o.free) || 0 }); });
    if (out.price == null && !out.offers.length) throw new CmdError("facts_required", "يلزم سعر واحد أو عرض واحد على الأقل في بيانات المنتج");
    return out;
  }
  /* الرموز المتاحة = ما قدّمه المستخدم فقط؛ الناقص لا يُخترع (رمز غير متاح ← خطأ fact_missing) */
  function factTable(F) {
    const t = {}, m = n => n + " " + F.currency;
    if (F.product) t.product = F.product; t.currency = F.currency;
    if (F.price != null) t.price = m(F.price); if (F.oldPrice != null) t.old_price = m(F.oldPrice);
    if (F.price != null && F.oldPrice != null && F.oldPrice > F.price) { t.save = m(F.oldPrice - F.price); t.save_pct = Math.round((F.oldPrice - F.price) / F.oldPrice * 100) + "%"; }
    F.offers.forEach(o => { const k = "offer" + o.n; t[k + ".price"] = m(o.price); if (o.label) t[k + ".label"] = o.label; if (o.qty != null) { t[k + ".qty"] = String(o.qty); if (o.qty > 0) t[k + ".unit"] = m(Math.round(o.price / o.qty)); } if (o.free) t[k + ".free"] = String(o.free); });
    return t;
  }
  const digits = s => String(s).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776));
  const approvedNums = F => { const set = new Set(); Object.values(factTable(F)).forEach(v => { String(digits(v)).replace(/\d+/g, x => { set.add(String(Number(x))); return x; }); }); return set; };
  function fillTokens(text, F) {
    const T = factTable(F);
    return String(text).replace(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g, (m, k) => { const key = k.toLowerCase(); if (!(key in T)) throw new CmdError("fact_missing", "الرمز {{" + k + "}} غير متاح: لم يقدّم المستخدم هذه المعلومة (لا تُخترع)", { token: k }); return T[key]; });
  }
  /* لا رقم سعر/خصم غير مقدَّم: أرقام قبل/بعد رمز العملة، ونسب الخصم، وأرقام بعد كلمات الخصم */
  const RE_MONEY = /(\d[\d\s.,]*)\s*(?:دج|دينار|د\.ج|DA|DZD|da|€|\$)/g, RE_MONEY2 = /(?:\bDA|\bDZD|€|\$)\s*(\d[\d\s.,]*)/gi, RE_DISC = /(?:خصم|تخفيض|promo|remise|off|وفّر|وفر|save)\s*[:\-]?\s*(\d[\d\s.,]*)/gi, RE_PCT = [/(?:خصم|تخفيض|promo|remise|off|وفّر|وفر)\s*[-−–]?\s*(\d+(?:[.,]\d+)?)\s*%/gi, /[-−–]\s*(\d+(?:[.,]\d+)?)\s*%/g, /(\d+(?:[.,]\d+)?)\s*%\s*(?:خصم|تخفيض|off|remise)/gi];
  function checkCommercial(text, F) {
    const ok = approvedNums(F), t = digits(text); const bad = [];
    const chk = raw => { const n = String(raw).replace(/[^\d]/g, ""); if (n && !ok.has(String(Number(n)))) bad.push(n); };
    for (const re of [RE_MONEY, RE_MONEY2, RE_DISC]) { re.lastIndex = 0; let m; while ((m = re.exec(t))) chk(m[1]); }
    for (const re of RE_PCT) { re.lastIndex = 0; let m; while ((m = re.exec(t))) { const n = String(Math.round(parseFloat(String(m[1]).replace(",", ".")))); if (!ok.has(n)) bad.push(n + "%"); } }
    if (bad.length) throw new CmdError("price_unapproved", "رقم تجاري غير موجود في بيانات المنتج التي قدّمها المستخدم: " + [...new Set(bad)].join("، "), { numbers: bad });
  }
  /* نص يكتبه النموذج: لا HTML، الرموز تُستبدل بنص عادي، ثم فحص الأرقام التجارية */
  function cleanText(v, F, max) {
    let s = str(v, max || 3000); if (/<\s*[a-zA-Z!\/?]/.test(s) || /javascript\s*:/i.test(s)) throw new CmdError("html_forbidden", "HTML أو JavaScript غير مسموح في نصوص النموذج");
    s = fillTokens(s, F); checkCommercial(s, F); return s;
  }

  /* ───────────── مراجع العناصر والأقسام ───────────── */
  const OPID = /^[\w.~-]{1,48}$/, WID = /^[\w-]{1,40}$/, SYM = /^\$[\w-]{1,30}$/;
  const keyOf = r => String(r).replace(/^\$/, "").replace(/[^\w]/g, "");        // نفس تنظيف as: الشرطة وغيرها تُحذف
  const wref = r => { if (typeof r !== "string" || !(WID.test(r) || SYM.test(r))) throw new CmdError("bad_ref", "مرجع عنصر غير صالح: " + JSON.stringify(r === undefined ? null : r).slice(0, 60) + " (المطلوب معرّف العنصر أو $الاسم المعطى في as)"); return r; };
  const sref = r => { if (r === "@first" || r === "@last") return r; return wref(r); };
  const PROTECTED = new Set(["orderorig", "shdr", "sbar", "sfoot", "html", "code", "herow", "shopcats", "products", "slider", "gallery", "pgal"]);
  const LAYER_TYPES = ["text", "heading", "image", "shape", "button", "icon"];
  const ENTR = ["fadeIn", "fadeUp", "fadeDown", "zoomIn", "slideStart"], CONT = ["float", "pulse", "sweep", "glow", "kenburns", "spin", "sway", "hoverLift", "hoverZoom", "hoverTilt", "shine"];

  function allWidgets(page) {
    const out = [];
    (page.sections || []).forEach(sec => { (sec.free || []).forEach(w => out.push({ w, sec, free: true })); (sec.cols || []).forEach(c => (c.widgets || []).forEach(w => out.push({ w, sec, free: false }))); });
    return out;
  }
  const secDw = sec => Number(sec && sec.set && sec.set.dw) || 0, secMh = sec => Number((sec.set.mh && sec.set.mh.d) || 0);
  function findSec(page, ref, run) {
    const L = page.sections || []; if (!L.length) throw new CmdError("no_section", "لا أقسام");
    if (ref === "@first") return L[0]; if (ref === "@last") return L[L.length - 1];
    const byKey = () => { const k = keyOf(ref), id = run && run.ids && run.ids["s:" + k]; return L.find(s => s.id === id || (s.set && s.set.aiKey === k)); };
    if (SYM.test(ref)) { const hit = byKey(); if (hit) return hit; throw new CmdError("ref_not_found", "قسم غير موجود: " + ref); }
    const hit = L.find(s => s.id === ref) || byKey(); if (!hit) throw new CmdError("ref_not_found", "قسم غير موجود: " + ref); return hit;
  }
  function findW(page, ref, run) {
    const all = allWidgets(page);
    const byKey = () => { const k = keyOf(ref), id = run && run.ids && run.ids["w:" + k]; return all.find(x => x.w.id === id || (x.w.set && x.w.set.aiKey === k)); };
    if (SYM.test(ref)) { const hit = byKey(); if (hit) return hit; throw new CmdError("ref_not_found", "عنصر غير موجود: " + ref); }
    const hit = all.find(x => x.w.id === ref) || byKey(); if (!hit) throw new CmdError("ref_not_found", "عنصر غير موجود: " + ref); return hit;
  }

  /* ───────────── بناء عناصر عبر PBSpec (لا منطق رسم ثانٍ) ───────────── */
  function viaSpec(layers, dw, H, F, opts) {
    const sp = S(), mini = { format: "alyssum-design/1", page: { title: "x", width: dw, bg: "#ffffff", lang: "ar", product: "" }, assets: {}, sections: [{ name: "x", height: Math.max(60, Math.round(H)), bg: opts && opts.bg || "", gradient: opts && opts.gradient || null, layers }] };
    const r = sp.validate(mini); if (!r.ok) throw new CmdError("layer_invalid", r.error);
    if (r.sections[0].layers.length !== layers.length) throw new CmdError("layer_rejected", "رُفضت الطبقة بعد التنظيف: " + (r.warn || []).slice(0, 2).join("؛"));
    const secs = sp.toSections(r, { merge: false, product: "", products: [] }); return { sec: secs[0], pending: secs.pending || [], height: r.sections[0].height };
  }
  const tagFx = w => { (w.set.fxs || []).forEach(f => { f.ai = 1; }); };
  /* ───────────── الاستمرارية البصرية: ألوان حواف الأقسام وتدرّج الصفحة الموحّد ───────────── */
  const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const rgbOf = c => { const m = HEX.exec(String(c || "").trim()); if (!m) return null; let h = m[1]; if (h.length === 3) h = h.replace(/./g, "$&$&"); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const hexOf = r => "#" + r.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  function colorAt(stops, p) { const L = stops.slice().sort((a, b) => a.p - b.p); if (p <= L[0].p) return rgbOf(L[0].c); if (p >= L[L.length - 1].p) return rgbOf(L[L.length - 1].c); for (let i = 1; i < L.length; i++) if (p <= L[i].p) { const a = L[i - 1], b = L[i], t = (p - a.p) / Math.max(1e-6, b.p - a.p), A = rgbOf(a.c), B = rgbOf(b.c); return A.map((v, k) => v + (B[k] - v) * t); } }
  /* لون أعلى/أسفل القسم كما يراه الزائر (null = غير معروف: صورة خلفية أو لون غير سداسي) */
  function edgeOf(sec, page) { const s = sec.set || {}; if (s.bgImg) return null;
    if (s.gr && Array.isArray(s.gr.s) && s.gr.s.length >= 2 && s.gr.s.every(x => rgbOf(x.c))) { const a = Number(s.gr.a), rev = a === 0 || a === 360; if ((s.gr.t || "linear") === "linear" && (a === 180 || rev)) { const t = colorAt(s.gr.s, 0), b = colorAt(s.gr.s, 100); return rev ? { top: b, bottom: t } : { top: t, bottom: b }; } const t = colorAt(s.gr.s, 0), b = colorAt(s.gr.s, 100); return { top: t, bottom: b }; }
    const c = rgbOf(s.bg) || (!s.bg && rgbOf(page && page.bg)); return c ? { top: c, bottom: c } : null; }
  const cdist = (a, b) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3;
  const CONT_MAX = 16;      // أكبر فرق لوني مقبول عند حدّ قسمين (متوسط القنوات 0..255)
  function contBreaks(page, secIds) { const L = page.sections || [], out = [];
    for (let i = 0; i + 1 < L.length; i++) { const A = L[i], B = L[i + 1]; if (!(secIds.includes(A.id) || secIds.includes(B.id))) continue; const ea = edgeOf(A, page), eb = edgeOf(B, page); if (!ea || !eb) continue; const d = cdist(ea.bottom, eb.top); if (d > CONT_MAX) out.push({ above: A.id, below: B.id, from: hexOf(ea.bottom), to: hexOf(eb.top), delta: Math.round(d) }); } return out; }
  /* لوحات صندوقية: مستطيل معتم كبير بزوايا أو حدّ يعطي مظهر بطاقة مفصولة (تحذير فقط) */
  function panelWarns(page, secIds) { const out = []; (page.sections || []).forEach(sec => { if (!secIds.includes(sec.id)) return; const dw = secDw(sec), mh = secMh(sec); if (!dw || !mh) return; (sec.free || []).forEach(w => { if (w.type !== "shape") return; const s = w.set || {}, d = k => Number(s[k] && s[k].d) || 0, ww = d("fwd"), hh = d("fh"), op = s.op == null ? 1 : Number(s.op); if (ww >= 60 && hh >= mh * .4 && op >= .85 && rgbOf(s.fill) && (Number(s.rx) > 0 || d("rad") > 0 || (s.stroke && Number(s.sw) > 0))) out.push({ code: "boxed_panel", msg: "لوحة صندوقية معتمة قد تبدو كقسم منفصل: " + w.id }); }); }); return out; }

  const growTo = (sec, y, h) => { const need = Math.round(y + h + 40); if (secMh(sec) < need && sec.set.mh) { sec.set.mh = Object.assign({}, sec.set.mh, { d: need }); return true; } return false; };

  /* ───────────── مخططات الأوامر: check نقي (بلا صفحة) + run (على نسخة العمل) ───────────── */
  const PATCH_KEYS = { text: "s", color: "c", size: "n", weight: "w", align: "a", fill: "c", bg: "c", link: "l", src: "i", alt: "s", fit: "f", prompt: "s", x: "n", y: "n", w: "n", h: "n", z: "n", rot: "n", opacity: "n", radius: "n", hidden: "b", locked: "b", title: "s", icon: "s" };
  /* النموذج قد ينسى حقل type أو يسمّيه kind/layer_type: نستنتجه من الحقول بدل رفض الأمر */
  function inferType(L) {
    if (!isObj(L)) return L; if (LAYER_TYPES.includes(L.type)) return L;
    const alias = String(L.type || L.kind || L.layer_type || L.layerType || L.element || L.widget || L.t || "").toLowerCase().trim(), m = { title: "heading", headline: "heading", h1: "heading", h2: "heading", h3: "heading", paragraph: "text", p: "text", label: "text", img: "image", picture: "image", photo: "image", rect: "shape", ellipse: "shape", circle: "shape", btn: "button", cta: "button" };
    let t = LAYER_TYPES.includes(alias) ? alias : m[alias] || "";
    if (!t && alias) return L;                                  // نوع صريح غير مسموح (html/price/iframe…) يبقى مرفوضاً
    if (!t) { const fs = Number(L.font && L.font.size) || Number(L.size) || 0;
      if (L.src != null || L.prompt != null || L.cutout != null) t = "image"; else if (L.icon != null && L.text == null) t = "icon"; else if (L.link != null && L.text != null) t = "button"; else if (L.text != null) t = (L.tag || fs >= 40) ? "heading" : "text"; else if (L.shape != null || L.fill != null || L.gradient != null) t = "shape"; }
    return t ? Object.assign({}, L, { type: t }) : L;
  }
  function checkLayer(L, F) {
    L = inferType(L);
    if (!isObj(L) || !LAYER_TYPES.includes(L.type)) throw new CmdError("type_not_allowed", "نوع طبقة غير مسموح: " + str(L && L.type, 20) + " (المسموح: " + LAYER_TYPES.join("، ") + ")");
    const o = clone(L);
    ["text", "title", "alt"].forEach(k => { if (o[k] != null) o[k] = cleanText(o[k], F, k === "text" ? 3000 : 200); });
    if (o.type === "image") { if (o.prompt != null) o.prompt = cleanText(o.prompt, F, 500); if (o.src != null && o.src !== "" && !/^asset:[\w-]+$/.test(o.src) && !IMGSRC.test(o.src)) throw new CmdError("bad_src", "مصدر صورة غير مسموح (assets/… أو https فقط)"); }
    if (o.type === "button") { if (o.link != null && !LINK.test(String(o.link))) throw new CmdError("bad_link", "رابط غير مسموح"); }
    ["fill", "bg", "color"].forEach(k => { if (o[k] != null && !COLOR.test(String(o[k]).trim())) throw new CmdError("bad_color", "لون غير صالح: " + k); });
    if (o.font && o.font.color != null && !COLOR.test(String(o.font.color).trim())) throw new CmdError("bad_color", "لون الخط غير صالح");
    delete o.id; delete o.locked_by; return o;
  }
  const effArgs = a => { const o = {}; if (a.entrance != null) { if (!ENTR.includes(a.entrance)) throw new CmdError("bad_effect", "حركة دخول غير مسموحة"); o.entrance = a.entrance; } if (a.continuous != null) { if (!Array.isArray(a.continuous) || a.continuous.length > 2 || a.continuous.some(x => !CONT.includes(x))) throw new CmdError("bad_effect", "حركة مستمرة غير مسموحة"); o.continuous = a.continuous.slice(); }
    o.delay = num(a.delay, 0, 5, 0); o.duration = num(a.duration, .1, 20, 0.8); if (a.shadow != null) { if (!isObj(a.shadow)) throw new CmdError("bad_effect", "ظل غير صالح"); const s = a.shadow; o.shadow = { x: num(s.x, -200, 200, 0), y: num(s.y, -200, 200, 8), blur: num(s.blur, 0, 200, 16), spread: num(s.spread, -100, 100, 0), color: COLOR.test(String(s.color || "")) ? s.color : "rgba(0,0,0,.25)", follow: !!s.follow }; } return o; };

  const OPS = {
    "section.add": {
      structural: true,
      check(a, F) { const o = { name: str(a.name, 60), height: num(a.height, 60, 8000, 700), after: a.after == null ? "@last" : sref(a.after), as: a.as == null ? "" : String(a.as).replace(/[^\w]/g, "").slice(0, 30) };
        if (a.bg != null) { if (!COLOR.test(String(a.bg))) throw new CmdError("bad_color", "لون الخلفية غير صالح"); o.bg = a.bg; } if (a.gradient != null) { if (!isObj(a.gradient)) throw new CmdError("bad_gradient", "تدرّج غير صالح"); o.gradient = a.gradient; } return o; },
      async run(C, a) { const dw = C.dw(), r = viaSpec([], dw, a.height, C.F, { bg: a.bg, gradient: a.gradient }); const sec = r.sec; sec.set.aiKey = a.as || undefined; if (!sec.set.aiKey) delete sec.set.aiKey; if (a.name) sec.set.cid = a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || undefined; if (!sec.set.cid) delete sec.set.cid;
        const L = C.work.sections, ref = a.after, i = ref === "@first" ? 1 : ref === "@last" ? L.length : L.indexOf(findSec(C.work, ref, C.run)) + 1; L.splice(i, 0, sec); C.touchSec(sec.id); if (a.as) C.run.ids["s:" + a.as] = sec.id; return { id: sec.id }; } },
    "layer.add": {
      check(a, F) { const o = { section: a.section == null ? "@last" : sref(a.section), layer: checkLayer(a.layer, F), as: a.as == null ? "" : String(a.as).replace(/[^\w]/g, "").slice(0, 30) }; return o; },
      async run(C, a, op) { const sec = findSec(C.work, a.section, C.run); if (!(sec.set && sec.set.kind === "canvas" && secDw(sec))) throw new CmdError("section_unsupported", "القسم ليس قسم قماش متناسباً (scaled)");
        if (a.as && C.run.ids["w:" + a.as] && findWOpt(C.work, C.run.ids["w:" + a.as])) throw new CmdError("duplicate_as", "الاسم $" + a.as + " مستعمل");
        const dw = secDw(sec), r = viaSpec([a.layer], dw, Math.max(secMh(sec), (a.layer.y || 0) + (a.layer.h || 400) + 40), C.F), w = r.sec.free[0]; tagFx(w); if (a.as) w.set.aiKey = a.as;
        (sec.free = sec.free || []).push(w); const fy = Number(w.set.fy && w.set.fy.d) || 0, fh = Number(w.set.fh && w.set.fh.d) || 0; if (growTo(sec, fy, fh)) C.touchSec(sec.id); C.touchSec(sec.id); C.touch(w.id); if (a.as) C.run.ids["w:" + a.as] = w.id;
        const gen = []; if (w.type === "image" && !w.set.src && w.set.aiPrompt) gen.push({ id: op.id + "~img", op: "image.generate", args: { ref: w.id, cutout: !!w.set.aiCut }, auto: true }); return { id: w.id, gen }; } },
    "layer.update": {
      check(a, F) { const ref = wref(a.ref); if (!isObj(a.patch) || !Object.keys(a.patch).length) throw new CmdError("bad_patch", "patch مطلوب");
        const p = {}; for (const k of Object.keys(a.patch)) { const t = PATCH_KEYS[k]; if (!t) throw new CmdError("bad_patch_key", "حقل غير مسموح في التعديل: " + k); const v = a.patch[k];
          if (t === "s") p[k] = cleanText(v, F, k === "text" ? 3000 : 400); else if (t === "c") { if (!COLOR.test(String(v).trim())) throw new CmdError("bad_color", "لون غير صالح: " + k); p[k] = String(v).trim(); } else if (t === "n") { if (!Number.isFinite(Number(v))) throw new CmdError("bad_number", "رقم غير صالح: " + k); p[k] = Number(v); }
          else if (t === "b") p[k] = !!v; else if (t === "l") { if (!LINK.test(String(v))) throw new CmdError("bad_link", "رابط غير مسموح"); p[k] = String(v); } else if (t === "i") { if (!IMGSRC.test(String(v))) throw new CmdError("bad_src", "مصدر صورة غير مسموح"); p[k] = String(v); } else if (t === "f") { if (!["cover", "contain", "fill"].includes(v)) throw new CmdError("bad_patch", "fit غير صالح"); p[k] = v; } else if (t === "a") { if (!["right", "left", "center", "justify"].includes(v)) throw new CmdError("bad_patch", "align غير صالح"); p[k] = v; } else if (t === "w") { if (!["300", "400", "500", "600", "700", "800", "900"].includes(String(v))) throw new CmdError("bad_patch", "weight غير صالح"); p[k] = String(v); } }
        return { ref, patch: p }; },
      async run(C, a) { const x = findW(C.work, a.ref, C.run), w = x.w, s = w.set, dw = secDw(x.sec); C.guardWidget(w); const p = a.patch, ty = w.type, geo = ["x", "y", "w", "h"].some(k => k in p);
        if (geo && !(x.free && dw)) throw new CmdError("geometry_unsupported", "العنصر ليس عنصراً حراً في قسم متناسب");
        const textual = ty === "text" || ty === "heading", clean = { text: textual || ty === "button", color: textual || ty === "button", size: textual || ty === "button", weight: textual || ty === "button", align: textual, fill: ty === "shape", bg: ty === "button", link: ty === "button", src: ty === "image", alt: ty === "image", fit: ty === "image", prompt: ty === "image", title: ty === "iconbox", icon: ty === "iconbox" };
        for (const k of Object.keys(p)) { if (k in clean && !clean[k]) throw new CmdError("patch_not_applicable", "الحقل «" + k + "» لا ينطبق على عنصر من نوع " + ty); }
        if ("text" in p) { if (ty === "heading") s.text = p.text; else if (ty === "text") s.html = "<p>" + esc(p.text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>") + "</p>"; else if (ty === "button") s.text = p.text; }
        if ("color" in p) s.color = p.color; if ("size" in p) { s.fs = Object.assign({}, s.fs, { d: Math.round(num(p.size, 8, 300, 22)) }); } if ("weight" in p) s.fw = p.weight; if ("align" in p) s.ta = Object.assign({}, s.ta, { d: p.align });
        if ("fill" in p) s.fill = p.fill; if ("bg" in p) s.bgc = p.bg; if ("link" in p) s.link = p.link; if ("radius" in p && ty === "button") s.brad = Object.assign({}, s.brad, { d: Math.round(num(p.radius, 0, 200, 0)) });
        if ("src" in p) { s.src = p.src; delete s.aiPrompt; } if ("alt" in p) s.alt = p.alt; if ("fit" in p) s.fit = p.fit; if ("prompt" in p) { s.aiPrompt = p.prompt; s.alt = s.alt || p.prompt; delete s.src; }
        if ("title" in p) s.title = p.title; if ("icon" in p) s.icon = /^img:/.test(p.icon) ? p.icon : "ic:" + String(p.icon).replace(/[^\w-]/g, "");
        if ("x" in p) s.fx = Object.assign({}, s.fx, { d: Math.round(p.x / dw * 1000) / 10 }); if ("y" in p) s.fy = Object.assign({}, s.fy, { d: Math.round(p.y) }); if ("w" in p) s.fwd = Object.assign({}, s.fwd, { d: Math.round(num(p.w, 1, dw * 2, 200) / dw * 1000) / 10 }); if ("h" in p) { s.fh = Object.assign({}, s.fh, { d: Math.round(num(p.h, 1, 6000, 100)) }); s.hauto = false; }
        if ("z" in p) s.zi = Math.round(num(p.z, -20, 200, 1)); if ("rot" in p) s.rot = Object.assign({}, s.rot, { d: num(p.rot, -360, 360, 0) }); if ("opacity" in p) { const o = num(p.opacity, 0, 1, 1); if (o < 1) s.op = o; else delete s.op; }
        if ("radius" in p && ty !== "button") s.rad = Object.assign({}, s.rad, { d: Math.round(num(p.radius, 0, 2000, 0)) });
        if ("hidden" in p) { if (p.hidden) s.hd = s.ht = s.hm = true; else { delete s.hd; delete s.ht; delete s.hm; } } if ("locked" in p) { if (p.locked) s.locked = true; else delete s.locked; }
        if (geo && x.free) { if (growTo(x.sec, Number(s.fy && s.fy.d) || 0, Number(s.fh && s.fh.d) || 0)) C.touchSec(x.sec.id); }
        C.touch(w.id); const gen = []; if ("prompt" in p && ty === "image") gen.push({ id: C.op.id + "~img", op: "image.generate", args: { ref: w.id }, auto: true }); return { id: w.id, gen }; } },
    "layer.delete": {
      check(a) { return { ref: wref(a.ref) }; },
      async run(C, a) { const x = findW(C.work, a.ref, C.run); C.guardWidget(x.w); if (x.w.set && x.w.set.locked) throw new CmdError("layer_locked", "العنصر مقفل"); const list = x.free ? x.sec.free : x.sec.cols.find(c => c.widgets.includes(x.w)).widgets; list.splice(list.indexOf(x.w), 1); C.touch(x.w.id); C.touchSec(x.sec.id); return { id: x.w.id }; } },
    "layer.reorder": {
      check(a) { if (!["front", "back", "up", "down"].includes(a.how)) throw new CmdError("bad_args", "how غير صالح"); return { ref: wref(a.ref), how: a.how }; },
      async run(C, a) { const x = findW(C.work, a.ref, C.run); C.guardWidget(x.w); if (!x.free) throw new CmdError("geometry_unsupported", "ترتيب الطبقات للعناصر الحرة فقط"); const L = x.sec.free.slice().sort((p, q) => (Number(p.set.zi) || 0) - (Number(q.set.zi) || 0)), i = L.indexOf(x.w), z = w => Number(w.set.zi) || 0;
        if (a.how === "front") { x.w.set.zi = z(L[L.length - 1]) + (L.length - 1 === i ? 0 : 1); C.touch(x.w.id); } else if (a.how === "back") { x.w.set.zi = Math.max(-20, z(L[0]) - (i === 0 ? 0 : 1)); C.touch(x.w.id); }
        else { const j = a.how === "up" ? i + 1 : i - 1; if (j < 0 || j >= L.length) return { id: x.w.id, noop: true }; const o = L[j]; if (z(o) === z(x.w)) { x.w.set.zi = z(x.w) + (a.how === "up" ? 1 : -1); C.touch(x.w.id); } else { const t = z(o); o.set.zi = z(x.w); x.w.set.zi = t; C.touch(o.id); C.touch(x.w.id); } }
        return { id: x.w.id }; } },
    "layer.group": {
      check(a) { if (!Array.isArray(a.refs) || a.refs.length < 2 || a.refs.length > 30) throw new CmdError("bad_args", "refs: من 2 إلى 30 عنصراً"); return { refs: a.refs.map(wref) }; },
      async run(C, a) { const g = "g" + Math.random().toString(36).slice(2, 9); const xs = a.refs.map(r => findW(C.work, r, C.run)); const sec = xs[0].sec; if (xs.some(x => x.sec !== sec || !x.free)) throw new CmdError("bad_args", "التجميع داخل قسم واحد وعناصر حرة"); xs.forEach(x => { C.guardWidget(x.w); x.w.set.grp = g; C.touch(x.w.id); }); return { group: g }; } },
    "layer.ungroup": {
      check(a) { if (!Array.isArray(a.refs) || !a.refs.length || a.refs.length > 30) throw new CmdError("bad_args", "refs مطلوبة"); return { refs: a.refs.map(wref) }; },
      async run(C, a) { a.refs.forEach(r => { const x = findW(C.work, r, C.run); C.guardWidget(x.w); if (x.w.set.grp) { delete x.w.set.grp; C.touch(x.w.id); } }); return {}; } },
    "effect.set": {
      check(a) { return Object.assign({ ref: wref(a.ref) }, effArgs(a)); },
      async run(C, a) { const x = findW(C.work, a.ref, C.run), w = x.w; C.guardWidget(w); if (!LAYER_TYPES.includes(w.type === "iconbox" ? "icon" : w.type)) throw new CmdError("patch_not_applicable", "لا تأثيرات لهذا النوع"); const dw = secDw(x.sec) || 1080;
        const eff = []; if (a.entrance) eff.push({ type: a.entrance, delay: a.delay, duration: a.duration }); (a.continuous || []).forEach(t => eff.push({ type: t, duration: 5 }));
        const t = w.type === "iconbox" ? "icon" : w.type, probe = { type: t, x: 0, y: 0, w: 200, h: 100, text: "x", src: "", prompt: "x", icon: "sparkle", effects: eff, shadow: a.shadow || undefined };
        const fr = viaSpec([probe], dw, 400, C.F).sec.free[0];
        ["anim", "animDur", "animDelay", "ianim", "ianimDur", "ianimAmt"].forEach(k => { delete w.set[k]; }); ["anim", "animDur", "animDelay", "ianim", "ianimDur", "ianimAmt"].forEach(k => { if (fr.set[k] != null) w.set[k] = fr.set[k]; });
        const keep = (w.set.fxs || []).filter(f => !f.ai), add = (fr.set.fxs || []).filter(f => /ظل|مستمر|حركة|توهج|طفو|نبض|لمعة|دوران|اهتزاز|تحويم|تكبير|ميل|Ken|sweep|float|pulse|glow|shadow/i.test(f.n || "") || f.tpl && /@keyframes|box-shadow|drop-shadow|text-shadow|:hover/.test(f.tpl)); add.forEach(f => { f.ai = 1; });
        const all = keep.concat(add); if (all.length) w.set.fxs = all; else delete w.set.fxs; C.touch(w.id); return { id: w.id, fx: add.length }; } },
    "page.background": {
      check(a) { const st = Array.isArray(a.stops) ? a.stops : []; if (st.length < 2 || st.length > 6) throw new CmdError("bad_args", "stops: من 2 إلى 6 ألوان"); const stops = st.map(x => { if (!isObj(x) || !HEX.test(String(x.c || "").trim())) throw new CmdError("bad_color", "لون التدرّج يجب أن يكون #rgb أو #rrggbb"); return { c: String(x.c).trim().toLowerCase(), p: num(x.p, 0, 100, 0) }; });
        const secs = a.sections == null ? null : (Array.isArray(a.sections) && a.sections.length && a.sections.length <= 12 ? a.sections.map(sref) : (() => { throw new CmdError("bad_args", "sections: قائمة أقسام متتالية"); })()); return { stops, sections: secs }; },
      async run(C, a) { const L = C.work.sections, ids = a.sections ? a.sections.map(r => findSec(C.work, r, C.run).id) : C.run.touchedSec.filter(id => L.some(s => s.id === id)); const sel = L.filter(s => ids.includes(s.id)); if (!sel.length) throw new CmdError("no_section", "لا أقسام لتطبيق الخلفية");
        const idx = sel.map(s => L.indexOf(s)).sort((x, y) => x - y); if (idx.some((v, i) => i && v !== idx[i - 1] + 1)) throw new CmdError("bad_args", "الأقسام يجب أن تكون متتالية");
        sel.sort((x, y) => L.indexOf(x) - L.indexOf(y)); sel.forEach(sec => { if ((sec.cols || []).some(c => (c.widgets || []).some(w => PROTECTED.has(w.type)))) throw new CmdError("protected_layer", "قسم فيه عنصر محمي لا تُعدَّل خلفيته"); });
        const hs = sel.map(sec => secMh(sec) || 700), H = hs.reduce((p, q) => p + q, 0); let y = 0;
        sel.forEach((sec, i) => { const y0 = y / H * 100, y1 = (y + hs[i]) / H * 100; y += hs[i]; const inner = a.stops.filter(x => x.p > y0 + .5 && x.p < y1 - .5); const pts = [y0].concat(inner.map(x => x.p), [y1]);
          const s = pts.map(pp => ({ c: hexOf(colorAt(a.stops, pp)), p: Math.round((pp - y0) / Math.max(1e-6, y1 - y0) * 1000) / 10 })); sec.set.gr = { t: "linear", a: 180, s }; sec.set.bg = s[0].c; delete sec.set.bgImg; C.touchSec(sec.id); });
        return { sections: sel.length }; } },
    "image.generate": {
      internalOk: true,
      check(a) { const o = { ref: wref(a.ref), cutout: !!a.cutout }; if (a.prompt != null) o.prompt = str(a.prompt, 400); return o; },
      async run(C, a) { return C.generateImage(a); } },
    "image.removeBg": {
      check(a) { return { ref: wref(a.ref) }; },
      async run(C, a) { const x = findW(C.work, a.ref, C.run), w = x.w; C.guardWidget(w); if (w.type !== "image" || !w.set.src) throw new CmdError("patch_not_applicable", "لا صورة لنزع خلفيتها"); const A = C.A; if (!A.removeBg) throw new CmdError("adapter_missing", "محوّل نزع الخلفية غير متاح");
        const key = "rb:" + hash(w.set.src); if (C.run.assets[key]) { w.set.src = C.run.assets[key]; C.touch(w.id); return { id: w.id, cached: true }; }
        const blob = await A.removeBg(w.set.src); const path = await A.upload(blob, "copilot-rb-" + hash(w.set.src).replace(/\W/g, "")); C.run.assets[key] = path; C.persist(); w.set.src = path; C.touch(w.id); return { id: w.id }; } },
    "page.applySpec": {
      structural: true, critical: true,
      check(a, F) { if (!isObj(a.spec)) throw new CmdError("bad_args", "spec مطلوب"); const spec = clone(a.spec); scan(spec);
        (Array.isArray(spec.sections) ? spec.sections : []).forEach(sec => { if (!isObj(sec)) return; ["title", "note"].forEach(k => { if (sec[k] != null) sec[k] = cleanText(sec[k], F, 500); }); (Array.isArray(sec.layers) ? sec.layers : []).forEach((L, li) => { if (isObj(L) && !LAYER_TYPES.includes(L.type)) { L = sec.layers[li] = inferType(L); } if (isObj(L) && !LAYER_TYPES.includes(L.type)) throw new CmdError("type_not_allowed", "نوع طبقة غير مسموح في spec: " + str(L.type, 20)); if (isObj(L)) Object.assign(L, checkLayer(L, F)); }); });
        if (isObj(spec.page)) { spec.page.product = ""; } const mode = a.mode === "append" ? "append" : "replace"; return { spec, mode }; },
      async run(C, a) { const sp = S(), r = sp.validate(a.spec); if (!r.ok) throw new CmdError("spec_invalid", r.error); const secs = sp.toSections(r, { products: [], product: "" }); const gen = [];
        const old = C.work.sections.filter(s => !(s.cols || []).some(c => (c.widgets || []).some(w => PROTECTED.has(w.type)))); if (a.mode === "replace" && C.work.sections.length !== old.length) throw new CmdError("protected_layer", "الصفحة فيها عناصر محمية؛ استعمل mode=append");
        if (a.mode === "replace") { C.work.sections.forEach(s => C.touchSec(s.id)); (C.work.sections || []).forEach(s => (s.free || []).concat([].concat(...(s.cols || []).map(c => c.widgets || []))).forEach(w => C.touch(w.id))); C.work.sections.length = 0; }
        secs.forEach(s => { C.work.sections.push(s); C.touchSec(s.id); (s.free || []).forEach(w => { tagFx(w); C.touch(w.id); if (w.type === "image" && !w.set.src && w.set.aiPrompt) gen.push({ id: C.op.id + "~img" + w.id, op: "image.generate", args: { ref: w.id, cutout: !!w.set.aiCut }, auto: true }); }); });
        if (r.page && r.page.title && !C.work.title) C.work.title = r.page.title; C.work.specMeta = Object.assign({}, C.work.specMeta, { copilot: { v: V, at: Date.now() } }); return { sections: secs.length, gen }; } },
  };
  const FORBIDDEN_OPS = /^(publish|page\.save|page\.publish|product\.|price\.|html\.|code\.|script\.|eval|page\.close|page\.delete)/i;
  const findWOpt = (page, id) => allWidgets(page).find(x => x.w.id === id);

  /* ───────────── التحقق من الغلاف كاملاً قبل تنفيذ أي أمر ───────────── */
  function validateEnvelope(env, F, opts) {
    opts = opts || {}; const errors = [], ops = [];
    try { if (!isObj(env)) throw new CmdError("bad_envelope", "الغلاف ليس كائناً"); const js = JSON.stringify(env); if (js.length > MAX_JSON) throw new CmdError("too_big", "الغلاف كبير جداً"); scan(env); if (!Array.isArray(env.ops) || !env.ops.length) throw new CmdError("bad_envelope", "ops مطلوبة"); if (env.ops.length > (opts.maxOps || MAX_OPS)) throw new CmdError("too_many_ops", "عدد الأوامر أكبر من الحد"); }
    catch (e) { return { ok: false, errors: [{ code: e.code || "bad_envelope", msg: e.message }], ops: [] }; }
    const seen = new Set();
    env.ops.forEach((o, i) => {
      const at = "الأمر " + (i + 1);
      try {
        if (!isObj(o)) throw new CmdError("bad_op", "أمر غير صالح"); const id = String(o.id == null ? "o" + (i + 1) : o.id), name = String(o.op || "");
        if (!OPID.test(id) || seen.has(id)) throw new CmdError("bad_op_id", "معرّف أمر غير صالح أو مكرر"); seen.add(id);
        if (FORBIDDEN_OPS.test(name)) throw new CmdError("forbidden_op", "أمر ممنوع على الذكاء الاصطناعي: " + name.slice(0, 40));
        const def = OPS[name]; if (!def || (def.internalOk && !opts.internal && name === "image.generate" && false)) throw new CmdError("unknown_op", "أمر غير معروف: " + name.slice(0, 40));
        if (def.structural && opts.kind === "edit" && !opts.allowStructure) throw new CmdError("structural_in_edit", "التعديل التدريجي لا يسمح بأوامر بنيوية (" + name + ")");
        const args = def.check(isObj(o.args) ? o.args : {}, F); ops.push({ id, op: name, args });
      } catch (e) { errors.push({ code: e.code || "invalid", msg: at + ": " + e.message, op: i + 1 }); }
    });
    if (opts.kind === "edit" && ops.filter(o => o.op === "layer.delete").length > (opts.maxDeletes == null ? 3 : opts.maxDeletes)) errors.push({ code: "too_many_deletes", msg: "حذف عناصر كثيرة في تعديل تدريجي" });
    return { ok: !errors.length, errors, ops };
  }

  /* ───────────── مخزن الحالة (يُحقَن في الاختبار؛ الافتراضي localStorage) ───────────── */
  const IDX = "alyssum_copilot_idx", PFX = "alyssum_copilot_run_";
  const lsStore = {
    load(id) { try { const t = localStorage.getItem(PFX + id); return t ? JSON.parse(t) : null; } catch (e) { return null; } },
    save(run) { try { localStorage.setItem(PFX + run.id, JSON.stringify(run)); const ix = JSON.parse(localStorage.getItem(IDX) || "[]"); if (!ix.includes(run.id)) { ix.push(run.id); while (ix.length > 5) { const d = ix.shift(); localStorage.removeItem(PFX + d); } localStorage.setItem(IDX, JSON.stringify(ix)); } } catch (e) { throw new CmdError("store_failed", "تعذّر حفظ حالة التشغيل (الاستئناف يتطلب ذلك)"); } },
    list() { try { return JSON.parse(localStorage.getItem(IDX) || "[]"); } catch (e) { return []; } },
    del(id) { try { localStorage.removeItem(PFX + id); const ix = JSON.parse(localStorage.getItem(IDX) || "[]").filter(x => x !== id); localStorage.setItem(IDX, JSON.stringify(ix)); } catch (e) { } }
  };
  const memStore = () => { const m = new Map(); return { load: id => (m.has(id) ? JSON.parse(m.get(id)) : null), save: r => { m.set(r.id, JSON.stringify(r)); }, list: () => [...m.keys()], del: id => { m.delete(id); }, _m: m }; };

  /* ───────────── محوّلات ───────────── */
  const IMG_RULES = "Photorealistic professional e-commerce marketing image. ABSOLUTELY no text, letters, numbers, logos, watermarks, labels or UI elements anywhere. No people; if hands are needed show only hands; never an uncovered woman. Clean composition, soft studio lighting. Subject: ";
  function normAdapters(a) {
    a = a || {}; if (!a.guard && !a.mock) throw new CmdError("guard_required", "لا يعمل المحوّل الحقيقي بلا guard خادمي (حدود التكلفة مسؤولية الخادم)");
    return { llm: a.llm || null, img: a.img || null, removeBg: a.removeBg || null, upload: a.upload || ((b, n) => { if (typeof PBApp === "undefined") throw new CmdError("adapter_missing", "uploadBlob غير متاح"); return PBApp.uploadBlob(b, n); }), guard: a.guard || { charge: async () => ({ ok: true }) }, hooks: a.hooks || {}, store: a.store || lsStore, mock: !!a.mock, limits: Object.assign({}, DEF_LIMITS, a.limits || {}) };
  }

  /* ───────────── الفرق بين صفحتين (فحص التعديل التدريجي) ───────────── */
  function snapIndex(page) {
    const m = {}; (page.sections || []).forEach(sec => { m["s:" + sec.id] = JSON.stringify({ set: sec.set, free: (sec.free || []).map(w => w.id), cols: (sec.cols || []).map(c => ({ id: c.id, set: c.set, w: (c.widgets || []).map(w => w.id) })) });
      (sec.free || []).forEach(w => { m["w:" + w.id] = JSON.stringify(w); }); (sec.cols || []).forEach(c => (c.widgets || []).forEach(w => { m["w:" + w.id] = JSON.stringify(w); })); });
    m["p:meta"] = JSON.stringify({ title: page.title, bg: page.bg, product: page.product, order: (page.sections || []).map(s => s.id) }); return m;
  }
  function diff(a, b) { const A = snapIndex(a), B = snapIndex(b), ch = []; for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) if (A[k] !== B[k]) ch.push(k); return ch; }

  /* ───────────── ملخص الصفحة لنموذج اللغة (لا يتضمن بيانات حسّاسة) ───────────── */
  function outline(page) {
    return { title: page.title || "", sections: (page.sections || []).map(sec => { const dw = secDw(sec) || 1; return { id: sec.id, key: (sec.set && sec.set.aiKey) || "", name: (sec.set && sec.set.cid) || "", height: secMh(sec), edge: (() => { const e = edgeOf(sec, page); return e ? { top: hexOf(e.top), bottom: hexOf(e.bottom) } : null; })(), layers: (sec.free || []).map(w => { const s = w.set || {}, d = k => (s[k] && s[k].d); return { id: w.id, key: s.aiKey || "", type: w.type, protected: PROTECTED.has(w.type), text: str((s.text || String(s.html || "").replace(/<[^>]*>/g, " ")), 80).trim(), x: Math.round((d("fx") || 0) / 100 * dw), y: Math.round(d("fy") || 0), w: Math.round((d("fwd") || 0) / 100 * dw), h: Math.round(d("fh") || 0), z: s.zi || 0, src: s.src ? "set" : (s.aiPrompt ? "pending" : "") }; }) }; }) };
  }

  /* ───────────── سجل التشغيل والتنفيذ ───────────── */
  const rid = () => "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const newRun = (o, F, base) => ({ v: V, id: rid(), kind: o.kind || "design", goal: str(o.goal || o.instruction, 200), status: "planning", t0: Date.now(), baseHash: base, facts: F, ops: [], done: {}, ids: {}, assets: {}, counts: { llm: 0, img: 0, tries: {} }, touched: [], touchedSec: [], errors: [], warnings: [], work: "", label: "AI: " + str(o.goal || o.instruction, 40) });
  const bump = (run, kind, limits) => { if (kind === "llm") { if (run.counts.llm >= limits.llm) throw new CmdError("limit_llm", "تجاوز سقف مكالمات النموذج في هذا التشغيل"); run.counts.llm++; } };

  function makeCtx(run, work, A, op) {
    const C = { run, work, A, F: run.facts, op, dw: () => { const s = work.sections.find(x => secDw(x)); return s ? secDw(s) : 1080; },
      touch: id => { if (!run.touched.includes(id)) run.touched.push(id); }, touchSec: id => { if (!run.touchedSec.includes(id)) run.touchedSec.push(id); },
      guardWidget: w => { if (PROTECTED.has(w.type)) throw new CmdError("protected_layer", "عنصر محمي لا يعدّله الذكاء الاصطناعي: " + w.type); }, persist: () => { run.work = JSON.stringify(work); A.store.save(run); } };
    C.generateImage = async a => {
      const x = findW(work, a.ref, run), w = x.w; if (w.type !== "image") throw new CmdError("patch_not_applicable", "ليس عنصر صورة"); const s = w.set, dw = secDw(x.sec) || 1080, fw = Number(s.fwd && s.fwd.d) || 40, fh = Number(s.fh && s.fh.d) || 300;
      const desc = str(a.prompt || s.aiPrompt || s.alt, 400); if (desc.trim().length < 8) throw new CmdError("prompt_missing", "وصف الصورة مطلوب (8 أحرف على الأقل)");
      const W0 = Math.max(200, fw / 100 * dw), H0 = Math.max(200, fh), k = Math.min(1, 1400 / Math.max(W0, H0)), W = Math.round(W0 * k), H = Math.round(H0 * k), cut = !!(a.cutout || s.aiCut);
      const key = S().assetKey(desc + "|" + (run.facts.product || ""), W, H, cut);
      if (run.assets[key]) { s.src = run.assets[key]; C.touch(w.id); return { id: w.id, cached: true }; }
      if (!A.img) throw new CmdError("adapter_missing", "محوّل توليد الصور غير متاح");
      let lastErr = null;
      while ((run.counts.tries[key] || 0) < 1 + A.limits.retries) {
        if (run.counts.img >= A.limits.img) throw new CmdError("limit_images", "تجاوز سقف الصور في هذا التشغيل");
        const g = await A.guard.charge("image", { runId: run.id }); if (!g || g.ok === false) throw new CmdError("guard_denied", "رفض الخادم التوليد: " + str(g && g.reason, 80));
        run.counts.img++; run.counts.tries[key] = (run.counts.tries[key] || 0) + 1; C.persist();      // يُحتسب قبل الاستدعاء: الانقطاع لا يمنح محاولات مجانية
        try {
          const r = await A.img.generate({ prompt: IMG_RULES + desc, W, H, cutout: cut, runId: run.id, key, attempt: run.counts.tries[key] }); if (!r || !r.blob || (r.blob.size != null && r.blob.size < 100)) throw new Error("صورة غير صالحة");
          let blob = r.blob; if (cut && A.removeBg) blob = await A.removeBg(blob);
          const path = await A.upload(blob, "copilot-" + key); if (!path || typeof path !== "string") throw new Error("تعذّر الرفع"); run.assets[key] = path; C.persist(); s.src = path; C.touch(w.id); return { id: w.id, path };
        } catch (e) { if (isStop(e)) throw e; if (e && e.limit) throw new CmdError("guard_denied", "رفض الخادم التوليد (" + str(e.code, 40) + "): " + str(e.message, 100)); lastErr = e; }
      }
      throw new CmdError("image_failed", "فشل توليد الصورة: " + str(lastErr && lastErr.message, 120));
    };
    return C;
  }

  async function execute(run, work, A) {
    const queue = run.ops; let i = 0;
    while (i < queue.length) {
      const op = queue[i++]; if (run.done[op.id]) { continue; }
      if (A.hooks.beforeOp) await A.hooks.beforeOp(op, run);
      const def = OPS[op.op], C = makeCtx(run, work, A, op); let res;
      try { res = await def.run(C, op.args, op); if (A.hooks.afterOp) await A.hooks.afterOp(op, work, run); run.done[op.id] = Object.assign({ ok: true }, res && { id: res.id, cached: res.cached, noop: res.noop }); (res && res.gen || []).forEach(g => { if (!queue.some(q => q.id === g.id)) queue.push(g); }); }
      catch (e) { if (isStop(e)) { C.persist(); throw e; } const code = e.code || "error"; run.done[op.id] = { ok: false, code, msg: str(e.message, 200) }; run.errors.push({ op: op.id, code, msg: str(e.message, 200) }); if (def.critical || run.strict || code === "protected_layer") {      /* المساس بعنصر محمي يُسقط التشغيل كله لا هذا الأمر وحده */ run.status = "failed"; C.persist(); throw new CmdError("run_aborted", "توقف التشغيل عند الأمر " + op.id + ": " + e.message, { op: op.id, cause: code }); } }
      C.persist();
    }
  }

  function commit(run, work) {
    const e = ED(); const live = e.page;
    if (hash(baseJson(live)) !== run.baseHash) throw new CmdError("base_changed", "تغيّرت الصفحة أثناء التشغيل — لم يُعتمد شيء");
    /* فحص ما بعد التنفيذ */
    const changed = diff(live, work), allowed = new Set(run.touched.map(x => "w:" + x).concat(run.touchedSec.map(x => "s:" + x), ["p:meta"]));
    const out = changed.filter(k => !allowed.has(k)); if (out.length) throw new CmdError("scope_violation", "تغيّر ما لم تذكره الأوامر: " + out.slice(0, 4).join("، "), { keys: out });
    const bad = allWidgets(work).filter(x => x.free && ["fx", "fy", "fwd", "fh"].some(k => !x.w.set[k] || !Number.isFinite(Number(x.w.set[k].d)))); if (bad.length) throw new CmdError("layer_geometry", "عناصر بإحداثيات غير صالحة", { ids: bad.slice(0, 4).map(x => x.w.id) });
    const brk = run.allowBreaks ? [] : contBreaks(work, run.touchedSec); if (brk.length) throw new CmdError("continuity_break", "حدّ لوني ظاهر بين أقسام متجاورة (يجب لون واحد أو تدرّج متصل): " + brk.slice(0, 3).map(b => b.from + "→" + b.to).join("، "), { breaks: brk });
    run.warnings = (run.warnings || []).concat(panelWarns(work, run.touchedSec).map(w => w.msg));
    if (!changed.length) return { changed: 0 };
    /* الوسائط: ما رُفع أثناء التشغيل يبقى في قائمة الصفحة بعد الاعتماد، لكن حالة التراجع تعود بقائمة البداية بالضبط */
    const curMedia = Array.isArray(live.media) ? live.media.slice() : [], baseMedia = run.baseMedia ? JSON.parse(run.baseMedia) : curMedia; if (curMedia.length || baseMedia.length || "media" in live) live.media = baseMedia;
    if (e.hist && e.hist[e.hi] !== JSON.stringify(live)) PBApp.commitAfter();      // نثبّت الحالة السابقة كي يعيدها التراجع بالضبط
    const merged = baseMedia.slice(); curMedia.concat(Array.isArray(work.media) ? work.media : []).forEach(m => { if (!merged.some(x => JSON.stringify(x) === JSON.stringify(m))) merged.push(m); }); if (merged.length || "media" in work) work.media = merged;
    e.page = work; e.nextLabel = run.label; PBApp.commitAfter(); return { changed: changed.length };
  }

  async function drive(run, A) {
    const e = ED(), live = livePage(); if (hash(baseJson(live)) !== run.baseHash && !run.force) throw new CmdError("base_changed", "الصفحة المفتوحة تغيّرت منذ بدء هذا التشغيل");
    const work = run.work ? JSON.parse(run.work) : clone(live); run.status = "running"; A.store.save(run);
    try { await execute(run, work, A); } catch (err) { if (isStop(err)) throw err; run.status = "failed"; run.error = { code: err.code || "error", msg: str(err.message, 200) }; A.store.save(run); throw err; }
    let res; try { res = commit(run, work); } catch (err) { run.status = "rolled_back"; run.error = { code: err.code || "error", msg: str(err.message, 200), breaks: err.breaks }; A.store.save(run); return summary(run, false, err); }
    run.status = run.errors.length ? "done_with_errors" : "done"; run.work = ""; A.store.save(run); return summary(run, true, null, res);
  }
  const summary = (run, ok, err, res) => ({ ok, runId: run.id, status: run.status, changed: res ? res.changed : 0, errors: run.errors.slice(), error: err ? { code: err.code, msg: err.message, breaks: err.breaks } : null, counts: { llm: run.counts.llm, img: run.counts.img }, warnings: (run.warnings || []).slice(), touched: run.touched.slice(), assets: Object.assign({}, run.assets) });

  /* ───────────── الواجهة ───────────── */
  async function plan(o, kind) {
    const A = normAdapters(o.adapters), F = normFacts(o.facts), live = livePage(), run = newRun(Object.assign({}, o, { kind }), F, hash(baseJson(live))); run.baseMedia = JSON.stringify(live.media || []);
    run.limits = A.limits; A.store.save(run);
    try {
      if (!A.llm) throw new CmdError("adapter_missing", "محوّل نموذج اللغة غير متاح");
      const out = outline(live); let env;
      if (kind === "design") { bump(run, "llm", A.limits); const g1 = await A.guard.charge("llm", { runId: run.id }); if (g1 && g1.ok === false) throw new CmdError("guard_denied", "رفض الخادم"); const pl = await A.llm.plan({ runId: run.id, goal: o.goal, facts: F, tokens: Object.keys(factTable(F)), outline: out }); run.plan = isObj(pl) ? pl : null; A.store.save(run);
        bump(run, "llm", A.limits); const g2 = await A.guard.charge("llm", { runId: run.id }); if (g2 && g2.ok === false) throw new CmdError("guard_denied", "رفض الخادم"); env = await A.llm.ops({ runId: run.id, goal: o.goal, plan: run.plan, facts: F, tokens: Object.keys(factTable(F)), outline: out }); }
      else { bump(run, "llm", A.limits); const g = await A.guard.charge("llm", { runId: run.id }); if (g && g.ok === false) throw new CmdError("guard_denied", "رفض الخادم"); env = await A.llm.edit({ runId: run.id, instruction: o.instruction, facts: F, tokens: Object.keys(factTable(F)), outline: out }); }
      const v = validateEnvelope(env, F, { kind, maxOps: A.limits.ops, allowStructure: !!o.allowStructure });
      if (!v.ok) { run.status = "rejected"; run.errors = v.errors; A.store.save(run); return { ok: false, runId: run.id, status: "rejected", errors: v.errors, changed: 0 }; }
      run.ops = v.ops; run.strict = !!o.strict; run.allowBreaks = !!o.allowBreaks; A.store.save(run);
    } catch (e) { if (isStop(e)) throw e; run.status = "failed"; run.error = { code: e.code || "error", msg: str(e.message, 200) }; A.store.save(run); return { ok: false, runId: run.id, status: "failed", errors: [], error: run.error, changed: 0 }; }
    try { return await drive(run, A); } catch (e) { if (isStop(e)) throw e; return { ok: false, runId: run.id, status: run.status, errors: run.errors.slice(), error: { code: e.code || "error", msg: e.message }, changed: 0 }; }
  }
  const run = o => plan(o, "design"), edit = o => plan(o, "edit");
  async function resume(id, o) {
    const A = normAdapters(o && o.adapters), r = A.store.load(id); if (!r) throw new CmdError("run_not_found", "تشغيل غير موجود");
    if (["done", "done_with_errors", "rolled_back", "rejected"].includes(r.status)) return { ok: r.status.startsWith("done"), runId: r.id, status: r.status, already: true, errors: r.errors || [] };
    if (!r.ops.length) throw new CmdError("run_not_ready", "لا أوامر محفوظة لهذا التشغيل (انقطع قبل التخطيط)");
    if (o && o.force) r.force = true; try { return await drive(r, A); } catch (e) { if (isStop(e)) throw e; return { ok: false, runId: r.id, status: r.status, errors: r.errors.slice(), error: { code: e.code || "error", msg: e.message }, changed: 0 }; }
  }
  return { V, run, edit, resume, validateEnvelope, normFacts, factTable, fillTokens, checkCommercial, outline, diff, CmdError, Interrupt, stores: { ls: lsStore, mem: memStore }, OPS: Object.keys(OPS), PROTECTED: [...PROTECTED], LAYER_TYPES, DEF_LIMITS, _t: { edgeOf, contBreaks, hexOf, hash, viaSpec, findW, findSec, snapIndex } };
})();
if (typeof window !== "undefined") window.PBCopilot = PBCopilot;
