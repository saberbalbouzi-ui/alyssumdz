/* نواة «سرعة الموقع»: تحوّل تقرير Lighthouse الخام إلى ملخص (درجات، مقاييس، بنود راسبة مرتبة بعدد النقاط التي ستستردّها)
   مع طريقة الإصلاح بالعربية والفرنسية والإنجليزية من assets/data/speed-recipes.json. نقيّة (بلا DOM) فتعمل في المتصفح وفي اختبارات Node.
   مأخوذة من أداة lighthouse-tool (Apache-2.0) بعد تكييفها لمنصتنا. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.SpeedCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  const LANGS = ["ar", "fr", "en"];
  const CATS = ["performance", "accessibility", "best-practices", "seo"];
  const NOT_SCORED = new Set(["manual", "notApplicable", "informative", "error"]);
  let RECIPES = {};
  const setRecipes = r => { RECIPES = r && typeof r === "object" ? r : {}; };
  const pct = s => (s == null ? null : Math.round(s * 100));
  const recipeFor = (id, lang) => { const r = RECIPES[id]; return r ? r[Math.max(0, LANGS.indexOf(lang))] || null : null; };

  function itemLabel(it) {
    if (it == null) return "";
    if (typeof it === "string") return it.slice(0, 200);
    const pick = (it.node && (it.node.snippet || it.node.selector)) || it.url || (it.source && (it.source.url || it.source.value)) || it.entity || it.label || it.description || it.text || it.name || it.type;
    if (pick && typeof pick === "string") {
      const kb = it.wastedBytes ? " (" + Math.round(it.wastedBytes / 1024) + " KiB)" : it.totalBytes ? " (" + Math.round(it.totalBytes / 1024) + " KiB)" : "";
      return pick.replace(/\s+/g, " ").slice(0, 200) + kb;
    }
    if (Array.isArray(it.items) && it.items.length) return itemLabel(it.items[0]);
    try { const j = JSON.stringify(it); return j.length > 200 ? j.slice(0, 197) + "…" : j; } catch (e) { return ""; }
  }

  /** lhr ← {scores, categories, metrics, issues[], meta} ؛ issues مرتبة بالنقاط المستردّة (معالج الأخطاء) */
  function summarize(lhr, opt) {
    opt = opt || {}; const lang = opt.lang || "ar", maxItems = opt.maxItems || 6;
    const A = lhr.audits, scores = {}, categories = [], issues = new Map(), metricGain = {}, metrics = [];
    const add = (cid, id, gain, extra) => {
      extra = extra || {}; let it = issues.get(id);
      if (!it) { it = Object.assign({ id, categories: {}, gain: 0, approx: false }, extra); issues.set(id, it); }
      it.categories[cid] = +(((it.categories[cid]) || 0) + gain).toFixed(2); it.gain += gain; if (extra.approx) it.approx = true;
    };
    for (const cid of Object.keys(lhr.categories || {})) {
      const c = lhr.categories[cid]; scores[cid] = pct(c.score);
      const refs = c.auditRefs.filter(r => r.weight > 0 && A[r.id] && A[r.id].score != null && !NOT_SCORED.has(A[r.id].scoreDisplayMode));
      const total = refs.reduce((s, r) => s + r.weight, 0);
      for (const r of refs) {
        const a = A[r.id]; if (a.score >= 1) continue;
        const g = total ? (r.weight / total) * (1 - a.score) * 100 : 0;
        if (cid === "performance" && r.group === "metrics") {
          metricGain[r.acronym] = g;
          metrics.push({ id: r.id, acronym: r.acronym, title: a.title, value: a.displayValue || null, numericValue: a.numericValue == null ? null : a.numericValue, score: pct(a.score), pointsLost: +g.toFixed(2) });
          continue;
        }
        add(cid, r.id, g);
      }
      categories.push({ id: cid, title: c.title, score: pct(c.score), pointsToHundred: c.score == null ? null : 100 - pct(c.score) });
    }
    const perf = lhr.categories && lhr.categories.performance;
    for (const r of (perf ? perf.auditRefs : [])) {
      if (r.group === "metrics" && r.weight > 0 && !metrics.some(m => m.id === r.id)) {
        const a = A[r.id]; metrics.push({ id: r.id, acronym: r.acronym, title: a.title, value: a.displayValue || null, numericValue: a.numericValue == null ? null : a.numericValue, score: pct(a.score), pointsLost: 0 });
      }
    }
    for (const r of (perf ? perf.auditRefs : [])) {
      if (r.weight > 0 || r.group === "metrics" || r.group === "hidden") continue;
      const a = A[r.id]; if (!a || a.scoreDisplayMode === "notApplicable") continue;
      const saves = Object.entries(a.metricSavings || {}).filter(e => e[1] > 0), failing = a.score != null && a.score < 1;
      if (!failing && !saves.length) continue;
      add("performance", r.id, saves.reduce((s, e) => s + (metricGain[e[0]] || 0), 0), { approx: true, savings: Object.fromEntries(saves) });
    }
    const list = [...issues.values()].map(it => {
      const a = A[it.id], items = (a.details && Array.isArray(a.details.items) ? a.details.items : []).map(itemLabel).filter(Boolean);
      return { id: it.id, title: a.title, description: a.description, displayValue: a.displayValue || null, score: a.score, pointsGain: +it.gain.toFixed(2), approximate: it.approx, diagnostic: it.gain === 0, categories: it.categories, savings: it.savings || null, fix: recipeFor(it.id, lang), itemCount: items.length, items: items.slice(0, maxItems) };
    }).sort((x, y) => y.pointsGain - x.pointsGain || Math.max(0, ...Object.values(y.savings || {})) - Math.max(0, ...Object.values(x.savings || {})));
    return { scores, categories, metrics, issues: list, meta: { url: lhr.finalDisplayedUrl || lhr.finalUrl || lhr.requestedUrl, fetchTime: lhr.fetchTime, formFactor: lhr.configSettings && lhr.configSettings.formFactor, locale: lhr.configSettings && lhr.configSettings.locale, lighthouseVersion: lhr.lighthouseVersion, warnings: lhr.runWarnings || [] } };
  }

  /** ردّ PageSpeed Insights (v5) ← نفس شكل نتيجة الخادم {devices:{mobile:{lhr}|{error}}} */
  function fromPsi(device, json) {
    if (json && json.error) return { error: { code: "PSI_" + (json.error.code || "ERR"), message: json.error.message || "فشل الطلب" } };
    const l = json && json.lighthouseResult; if (!l) return { error: { code: "PSI_EMPTY", message: "ردّ غير متوقع من PageSpeed" } };
    if (l.runtimeError) return { error: { code: l.runtimeError.code, message: runtimeMsg(l.runtimeError.code, l.runtimeError.message) } };
    return { lhr: l };
  }
  const RUNTIME = {
    NO_FCP: "لم تُرسم أي عناصر على الشاشة. الصفحة فارغة أو تتأخر في العرض.",
    NO_LCP: "لم يُسجَّل أكبر عنصر مرئي (LCP). الأرجح أن العنصر الرئيسي مخفي بشفافية 0 أو يظهر بعد تأخر طويل.",
    FAILED_DOCUMENT_REQUEST: "فشل طلب الصفحة (DNS أو انقطاع الاتصال).", ERRORED_DOCUMENT_REQUEST: "تعذّر طلب الصفحة. تحقق من العنوان وحالة الاستجابة.",
    PAGE_HUNG: "الصفحة علقت أثناء التحميل.", PROTOCOL_TIMEOUT: "انتهت مهلة الاتصال بالمتصفح.", NOT_HTML: "العنوان لا يعيد صفحة HTML.", INSECURE_DOCUMENT_REQUEST: "الصفحة لا تُخدَّم عبر HTTPS.",
  };
  const runtimeMsg = (code, fallback) => RUNTIME[code] || fallback || code;

  /** رمز النتيجة: ≥90 جيد، ≥50 متوسط، غير ذلك ضعيف */
  const grade = s => (s == null ? "na" : s >= 90 ? "good" : s >= 50 ? "mid" : "bad");
  const normUrl = raw => { let s = String(raw || "").trim(); if (!s) return ""; if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s; try { const u = new URL(s); if (!/^https?:$/.test(u.protocol) || u.username || u.password) return ""; return u.href; } catch (e) { return ""; } };
  const gunzipJson = async buf => { const ds = new DecompressionStream("gzip"), r = new Response(new Blob([buf]).stream().pipeThrough(ds)); return JSON.parse(await r.text()); };

  return { CATS, LANGS, setRecipes, recipeFor, summarize, fromPsi, runtimeMsg, grade, normUrl, gunzipJson, pct };
});
