/* ترجمة الفرنسية التلقائية لنصوص التاجر (SiteTrans) — تعمل في لوحة التحكم فقط (مشتركة لكل المواقع).
   كل ما يحفظه التاجر من صفحات/منتجات/إعدادات يُفحص في الخلفية: النصوص العربية التي ليس لها ترجمة في قاموس القوالب (assets/data/site-i18n-fr.json)
   ولا في قاموس موقعه الخاص تُترجَم دفعةً واحدة بخدمة الذكاء (Alyssum API) وتُحفظ في assets/data/site-i18n-custom.json فيقرؤها site-i18n.js عند عرض الصفحة بالفرنسية.
   بلا نقرات: تُشغَّل عند الحفظ (تعترض GH.putFile وcommitMany) ومرة يومياً كاستدراك لما حُفظ قبلها؛ تُعطَّل إن لم تكن اللغة الفرنسية مفعّلة ولا زر اللغة (إعدادات الموقع).
   فشل الخدمة/الرصيد لا يُظهر خطأً للتاجر: تبقى النصوص في قائمة انتظار محلية وتُعاد المحاولة لاحقاً. الاختبار: tests/site-trans.js */
window.SiteTrans = (() => {
  const T = {};   /* واجهة عامة (translate يُستبدل في الاختبار) */
  const CUSTOM = "assets/data/site-i18n-custom.json", DICT = "assets/data/site-i18n-fr.json", AR = /[؀-ۿ]/, PQ = "site_trans_pending", DK = "site_trans_scan";
  const SEP = /(\s*[✦|]\s*|\s+·\s+|,|\s+—\s+)/, SKIPK = new Set(["tpl", "css", "fxs", "src", "img", "link", "id", "type", "href", "url", "icon", "font", "fx", "class", "anim", "cover", "thumb", "slug", "product", "ids"]);
  const S = { dict: null, rx: null, custom: null, sha: undefined, busy: false, timer: 0, added: 0 };
  const ls = { get: k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
  const norm = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  const b64 = s => btoa(unescape(encodeURIComponent(s))), unb64 = s => decodeURIComponent(escape(atob(String(s || "").replace(/\n/g, ""))));
  const toast = t => { try { if (typeof globalThis.toast === "function") globalThis.toast(t); } catch (e) { } };
  /* طباعة فرنسية موحَّدة (مطابقة لـscripts/gen-site-i18n-fr.py) */
  const NB = " ", NN = " ";
  function typo(s) {
    s = s.replace(/'/g, "’").replace(/[   ]+(?=[;!?%])/g, NN).replace(/[   ]+(?=:)/g, NB).replace(/«[   ]*/g, "«" + NB).replace(/[   ]*»/g, NB + "»");
    return s.replace(/(\d) (?=\d{3}(?!\d))/g, "$1" + NN).replace(/(\d) (?=(?:DA|h|min|s|jours?|pièces?|g|Go|To|kg|ml|cl|mois|ans|wilayas?|produits?|%)\b)/g, "$1" + NB);
  }
  /* هل الميزة مطلوبة؟ (الفرنسية مفعّلة للموقع أو زر اللغة ظاهر للزائر) */
  function enabled() { try { const d = (typeof AdminStores !== "undefined" && AdminStores.data && AdminStores.data()) || {}; return d.lang === "fr" || d.langSwitch !== false; } catch (e) { return true; } }
  const keyOf = () => ls.get("alyssum_gp_gkey") || ls.get("store_gp_gkey");
  function aiOn() { try { return !!keyOf() || (typeof AiProxy !== "undefined" && AiProxy.on && AiProxy.on()); } catch (e) { return false; } }
  async function loadDict() {
    if (S.dict) return;
    const f = u => fetch(u + "?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
    S.dict = (await f(DICT)) || { exact: {}, patterns: [] }; S.rx = (S.dict.patterns || []).map(p => { try { return new RegExp(p[0]); } catch (e) { return null; } }).filter(Boolean);
    S.custom = { exact: {} }; S.sha = undefined;
    try { const g = await GH.getFile(CUSTOM); S.sha = g.sha; const j = JSON.parse(unb64(g.content)); if (j && j.exact) S.custom = j; } catch (e) { }
  }
  /* هل النص (مطبَّعاً) يحتاج ترجمة؟ — يطابق منطق tr0 في site-i18n.js */
  function needs(k) {
    if (!k || k.length > 900 || !AR.test(k)) return false;
    const E = S.dict.exact, C = S.custom.exact; if (E[k] != null || C[k] != null) return false;
    for (const r of S.rx) if (r.test(k)) return false;
    if (!AR.test(k.replace(/دج/g, ""))) return false;
    const m = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}.!؟?)»]*)$/u.exec(k); if (m && m[2] && (m[1] || m[3]) && (E[m[2]] != null || C[m[2]] != null)) return false;
    const q = /^(.*?)(\s*[×x]\s*\d+)$/.exec(k); if (q && !needs(q[1])) return false;
    return true;
  }
  /* نص عربي ← عبارات تُترجَم (الأسطر المركّبة بفواصل ✦ | · تُترجَم أجزاؤها كما يفعل المترجم عند العرض) */
  function cands(raw, out) {
    const k = norm(String(raw).replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")); if (!AR.test(k)) return;
    if (!needs(k)) return;      /* الجملة كاملة معروفة (قاموس/نمط): لا تُفكَّك ولا تُرسَل */
    if (SEP.test(k)) { const ps = k.split(SEP).map(norm).filter(p => AR.test(p)); if (ps.length) { ps.forEach(p => needs(p) && out.add(p)); return; } }
    if (needs(k)) out.add(k);
  }
  function fromHtml(html, out) {
    if (!/[<]/.test(html)) { String(html).split(/\n/).forEach(l => cands(l, out)); return; }
    let doc; try { doc = new DOMParser().parseFromString("<body>" + html + "</body>", "text/html"); } catch (e) { return; }
    const tw = doc.createTreeWalker(doc.body, 5, { acceptNode: n => n.nodeType === 1 ? (n.matches("script,style,textarea,code,pre,noscript,[data-i18n-skip],.notranslate") ? 2 : 3) : 1 }); let n;
    while ((n = tw.nextNode())) { if (n.nodeType === 3) cands(n.nodeValue, out); else for (const a of ["placeholder", "title", "aria-label", "alt"]) { const v = n.getAttribute(a); if (v) cands(v, out); } }
  }
  function walk(o, out, key) {
    if (typeof o === "string") { if (AR.test(o) && !SKIPK.has(key)) (/[<]/.test(o) ? fromHtml(o, out) : o.split(/\n/).forEach(l => cands(l, out))); return; }
    if (Array.isArray(o)) { o.forEach(x => walk(x, out, key)); return; }
    if (o && typeof o === "object") for (const k of Object.keys(o)) if (!SKIPK.has(k)) walk(o[k], out, k);
  }
  const fromPage = (pg, out) => walk(pg && pg.sections, out, "");
  function fromProducts(out) {
    try { (Admin.products || []).forEach(p => { cands(p.title, out); if (p.desc) cands(p.desc, out); }); } catch (e) { }
    try { if (typeof CATEGORIES !== "undefined") Object.values(CATEGORIES).forEach(v => cands(v, out)); } catch (e) { }
  }
  /* ترجمة دفعة عبر الخدمة الذكية؛ تُرجع {عربي: فرنسي} لما نجح فقط */
  async function translate(list) {
    const prompt = "You are a professional French localizer for Algerian e-commerce storefronts. Translate each Arabic string below into natural, concise French (vouvoiement, sentence case, French typography with a non-breaking space before : ; ! ?). Keep emojis, digits, symbols (✔ ✦ · — % ×), brand names, product names, URLs and HTML tags unchanged. Use the usual Algerian-market wording (« paiement à la livraison », « wilaya », « livraison à domicile »). Never add explanations and never leave Arabic letters in the output.\n" +
      "INPUT: a JSON array of " + list.length + " strings.\nOUTPUT: ONLY a JSON array of exactly " + list.length + " French strings, in the same order.\n\n" + JSON.stringify(list);
    const key = keyOf() || "via-proxy"; let models = ["gemini-2.5-flash", "gemini-flash-latest"]; try { if (typeof ImgGen !== "undefined" && ImgGen.textModels) models = await ImgGen.textModels(key); } catch (e) { }
    let last = null;
    for (const m of models) {
      let r; try { r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }) }); } catch (e) { last = e; continue; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { last = new Error((j.error && j.error.message) || "HTTP " + r.status); if (r.status === 404 || r.status === 503 || r.status === 429) continue; break; }
      const t = (((((j.candidates || [])[0] || {}).content || {}).parts) || []).map(x => x.text || "").join("").replace(/^```[a-z]*\s*|\s*```$/g, "").trim();
      let arr; try { arr = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1)); } catch (e) { last = new Error("ردّ غير صالح"); continue; }
      if (!Array.isArray(arr) || arr.length !== list.length) { last = new Error("عدد الردود لا يطابق"); continue; }
      const out = {}; list.forEach((ar, i) => { let fr = typeof arr[i] === "string" ? typo(norm(arr[i])) : ""; if (fr && !AR.test(fr) && (/[<]/.test(ar) || !/<[a-z]/i.test(fr))) out[ar] = fr; }); return out;
    }
    throw last || new Error("تعذّرت الترجمة");
  }
  async function saveCustom(map) {
    const keys = Object.keys(map); if (!keys.length) return;
    for (let t = 0; t < 3; t++) {
      let cur = { exact: {} }, sha; try { const g = await GH.getFile(CUSTOM); sha = g.sha; const j = JSON.parse(unb64(g.content)); if (j && j.exact) cur = j; } catch (e) { }
      Object.assign(cur.exact, map); const all = Object.keys(cur.exact); if (all.length > 4000) all.slice(0, all.length - 4000).forEach(k => delete cur.exact[k]); cur.updated = new Date().toISOString();
      try { S.busy = "w"; const r = await GH.putFile(CUSTOM, b64(JSON.stringify(cur)), sha, "ترجمة تلقائية للفرنسية (" + keys.length + " عبارة)"); S.sha = r && r.content && r.content.sha || sha; S.custom = cur; return; }
      catch (e) { if (t === 2) throw e; await new Promise(r => setTimeout(r, 700)); }
    }
  }
  const pend = () => { try { return JSON.parse(ls.get(PQ) || "[]"); } catch (e) { return []; } };
  /* المعالجة: تفحص القائمة وتترجم وتحفظ (دفعات ≤ 40 نصاً و≤ 6 دفعات للمرّة) */
  async function run(extra) {
    if (S.busy || !enabled()) return { skipped: true };
    S.busy = true; let done = 0;
    try {
      await loadDict(); const set = new Set(pend()); (extra || []).forEach(x => set.add(x));
      const todo = [...set].filter(needs); ls.set(PQ, JSON.stringify(todo.slice(0, 600)));
      if (!todo.length || !aiOn()) return { pending: todo.length };
      let all = {};
      for (let i = 0; i < todo.length && i < 240; i += 40) {
        let chunk = todo.slice(i, i + 40), size = 0; chunk = chunk.filter(x => (size += x.length) < 7000);
        try { Object.assign(all, await T.translate(chunk)); } catch (e) { console.warn("SiteTrans", e && e.message); break; }
      }
      done = Object.keys(all).length; if (done) { await saveCustom(all); S.added += done; toast("🌐 تُرجمت " + done + " عبارة إلى الفرنسية تلقائياً"); }
      ls.set(PQ, JSON.stringify(todo.filter(x => all[x] == null).slice(0, 600)));
      return { translated: done, pending: todo.length - done };
    } catch (e) { console.warn("SiteTrans", e); return { error: String(e && e.message || e) }; }
    finally { S.busy = false; }
  }
  function later(texts, ms) { if (!enabled()) return; try { const p = pend(); texts.forEach(t => p.push(t)); ls.set(PQ, JSON.stringify([...new Set(p)].slice(0, 600))); } catch (e) { } clearTimeout(S.timer); S.timer = setTimeout(() => run(), ms == null ? 4000 : ms); }
  /* ما يُحفظ: نص الملف (utf-8) أو base64 */
  async function onText(path, text) {
    if (S.busy === "w" || path === CUSTOM || !enabled()) return;
    try {
      await loadDict(); const out = new Set(); let p = String(path || "");
      if (/^assets\/pages\/(?!index\.json|media\.json)[^/]+\.json$/.test(p)) fromPage(JSON.parse(text), out);
      else if (/^(lp|p)\/[^/]+\/index\.html$/.test(p) || p === "index.html") fromHtml(String(text).replace(/^[\s\S]*?<body[^>]*>/i, "").replace(/<\/body>[\s\S]*$/i, ""), out);
      else if (p === "assets/js/data.js") fromProducts(out);
      else if (p === "assets/data/store.json") { const d = JSON.parse(text); [d.tagline, d.maintMsg, d.address].forEach(v => v && cands(v, out)); }
      else return;
      if (out.size) later([...out]);
    } catch (e) { }
  }
  const onWrite = (path, b) => { try { return onText(path, typeof b === "string" && /^[A-Za-z0-9+/=\s]+$/.test(b) && !/^[\[{<]/.test(b.trim()) ? unb64(b) : b); } catch (e) { } };
  /* استدراك: مرة يومياً يفحص صفحات الموقع والمنتجات والإعدادات المحفوظة قبل تفعيل الميزة */
  async function scan(force) {
    if (!enabled() || S.busy) return;
    if (!force && Date.now() - (+ls.get(DK) || 0) < 20 * 3600 * 1000) return;
    try {
      await loadDict(); const out = new Set(); fromProducts(out);
      let idx = []; try { idx = JSON.parse(unb64((await GH.getFile("assets/pages/index.json")).content)); } catch (e) { }
      for (const x of (Array.isArray(idx) ? idx : []).slice(0, 80)) { if (!x || !x.slug) continue; try { fromPage(JSON.parse(unb64((await GH.getFile("assets/pages/" + x.slug + ".json")).content)), out); } catch (e) { } }
      try { const d = await (await fetch("assets/data/store.json?t=" + Date.now(), { cache: "no-store" })).json(); [d.tagline, d.maintMsg, d.address].forEach(v => v && cands(v, out)); } catch (e) { }
      ls.set(DK, String(Date.now())); if (out.size) later([...out], 500); else if (pend().length) later([], 500);
    } catch (e) { }
  }
  function install() {
    try {
      if (typeof GH !== "undefined" && GH.putFile && !GH.__st) { const o = GH.putFile.bind(GH); GH.putFile = function (path, c, sha, msg) { const r = o(path, c, sha, msg); try { Promise.resolve(r).then(() => onWrite(path, c)).catch(() => { }); } catch (e) { } return r; }; GH.__st = 1; }
    } catch (e) { }
  }
  function boot() { install(); setTimeout(() => { scan(false); if (pend().length) later([], 3000); }, 9000); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  return Object.assign(T, { run, scan, onText, onWrite, needs: k => (S.dict ? needs(norm(k)) : null), state: S, norm, typo, translate, fromHtml, fromPage, cands, loadDict, enabled });
})();
