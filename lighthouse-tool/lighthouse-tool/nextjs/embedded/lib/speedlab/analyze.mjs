// يحوّل تقرير Lighthouse الخام إلى ملخص صغير: درجات، مقاييس، وقائمة بنود راسبة
// مرتبة بعدد النقاط التي ستستردّها عند إصلاح كل بند ("معالج الأخطاء").


import RECIPES from './recipes.json';
const LANGS = ['ar', 'fr', 'en'];
const CATS = ['performance', 'accessibility', 'best-practices', 'seo', 'agentic-browsing'];
const NOT_SCORED = new Set(['manual', 'notApplicable', 'informative', 'error']);

export const pct = s => (s == null ? null : Math.round(s * 100));

function itemLabel(it) {
  if (it == null) return '';
  if (typeof it === 'string') return it.slice(0, 200);
  const pick = (it.node && (it.node.snippet || it.node.selector)) || it.url || (it.source && (it.source.url || it.source.value)) || it.entity || it.label || it.description || it.text || it.name || it.type;
  if (pick && typeof pick === 'string') {
    const kb = it.wastedBytes ? ` (${Math.round(it.wastedBytes / 1024)} KiB)` : it.totalBytes ? ` (${Math.round(it.totalBytes / 1024)} KiB)` : '';
    return pick.replace(/\s+/g, ' ').slice(0, 200) + kb;
  }
  if (Array.isArray(it.items) && it.items.length) return itemLabel(it.items[0]);
  try { const j = JSON.stringify(it); return j.length > 200 ? j.slice(0, 197) + '…' : j; } catch { return ''; }
}

export function recipeFor(id, lang = 'en') {
  const r = RECIPES[id];
  return r ? r[Math.max(0, LANGS.indexOf(lang))] : null;
}

export function summarize(lhr, {lang = 'en', maxItems = 6} = {}) {
  const A = lhr.audits;
  const scores = {};
  const categories = [];
  const issues = new Map();
  const metricGain = {};
  const metrics = [];

  const add = (cid, id, gain, extra = {}) => {
    let it = issues.get(id);
    if (!it) { it = {id, categories: {}, gain: 0, approx: false, ...extra}; issues.set(id, it); }
    it.categories[cid] = +(((it.categories[cid]) || 0) + gain).toFixed(2);
    it.gain += gain;
    if (extra.approx) it.approx = true;
  };

  for (const [cid, c] of Object.entries(lhr.categories)) {
    scores[cid] = pct(c.score);
    const refs = c.auditRefs.filter(r => r.weight > 0 && A[r.id] && A[r.id].score != null && !NOT_SCORED.has(A[r.id].scoreDisplayMode));
    const total = refs.reduce((s, r) => s + r.weight, 0);
    for (const r of refs) {
      const a = A[r.id];
      if (a.score >= 1) continue;
      const g = total ? (r.weight / total) * (1 - a.score) * 100 : 0;
      if (cid === 'performance' && r.group === 'metrics') {
        metricGain[r.acronym] = g;
        metrics.push({id: r.id, acronym: r.acronym, title: a.title, value: a.displayValue || null, numericValue: a.numericValue ?? null, score: pct(a.score), pointsLost: +g.toFixed(2)});
        continue;
      }
      add(cid, r.id, g);
    }
    categories.push({id: cid, title: c.title, score: pct(c.score), pointsToHundred: c.score == null ? null : 100 - pct(c.score)});
  }
  // مقاييس الأداء التي نجحت أيضاً (لعرض كامل)
  for (const r of (lhr.categories.performance?.auditRefs ?? [])) {
    if (r.group === 'metrics' && r.weight > 0 && !metrics.some(m => m.id === r.id)) {
      const a = A[r.id];
      metrics.push({id: r.id, acronym: r.acronym, title: a.title, value: a.displayValue || null, numericValue: a.numericValue ?? null, score: pct(a.score), pointsLost: 0});
    }
  }
  // فرص وتشخيصات الأداء: تُنسب لمقاييس تؤثر عليها
  for (const r of (lhr.categories.performance?.auditRefs ?? [])) {
    if (r.weight > 0 || r.group === 'metrics' || r.group === 'hidden') continue;
    const a = A[r.id];
    if (!a || a.scoreDisplayMode === 'notApplicable') continue;
    const saves = Object.entries(a.metricSavings || {}).filter(([, v]) => v > 0);
    const failing = a.score != null && a.score < 1;
    if (!failing && !saves.length) continue;
    const gain = saves.reduce((s, [m]) => s + (metricGain[m] || 0), 0);
    add('performance', r.id, gain, {approx: true, savings: Object.fromEntries(saves)});
  }

  const list = [...issues.values()].map(it => {
    const a = A[it.id];
    const items = ((a.details && a.details.items) || []).map(itemLabel).filter(Boolean);
    return {
      id: it.id,
      title: a.title,
      description: a.description,
      displayValue: a.displayValue || null,
      score: a.score,
      pointsGain: +it.gain.toFixed(2),
      approximate: it.approx,
      diagnostic: it.gain === 0,
      categories: it.categories,
      savings: it.savings || null,
      fix: recipeFor(it.id, lang),
      itemCount: items.length,
      items: items.slice(0, maxItems),
    };
  }).sort((x, y) => y.pointsGain - x.pointsGain || Math.max(0, ...Object.values(y.savings || {})) - Math.max(0, ...Object.values(x.savings || {})));

  return {
    scores, categories, metrics, issues: list,
    meta: {
      url: lhr.finalDisplayedUrl || lhr.finalUrl || lhr.requestedUrl,
      fetchTime: lhr.fetchTime,
      formFactor: lhr.configSettings?.formFactor,
      locale: lhr.configSettings?.locale,
      lighthouseVersion: lhr.lighthouseVersion,
      warnings: lhr.runWarnings || [],
    },
  };
}
