/* مقاييس التقييم الصوتي (مرحلة 12 / WS2) — دوال خالصة قابلة للاختبار بلا صوت ولا شبكة.
   WER/CER بعد تطبيع محافظ (لا يخفي أخطاء حقيقية): تشكيل/تطويل/توحيد ألف وياء وتاء مربوطة، أرقام عربية ← لاتينية، علامات ترقيم، حالة الحروف اللاتينية.
   دقة الأمر = الأداة التي يستخرجها محلّل الوكيل (agent/nlu.js الحقيقي) من النص المتعرَّف عليه تطابق المقصودة. دقة المعرّف = تطابق تام للمعرّف المقصود بعد توحيد الأرقام المفصولة. */
const path = require("path");
global.window = global.window || {}; if (!window.AgentNLU) require(path.join(__dirname, "..", "agent", "nlu.js")); const NLU = window.AgentNLU;
const AD = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
const norm = s => String(s == null ? "" : s).replace(/[٠-٩]/g, d => AD[d]).toLowerCase().normalize("NFKD").replace(/[ً-ٰٟـ̀-ͯ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
function lev(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
const wer = (ref, hyp) => { const r = norm(ref).split(" ").filter(Boolean), h = norm(hyp).split(" ").filter(Boolean); return r.length ? lev(r, h) / r.length : (h.length ? 1 : 0); };
const cer = (ref, hyp) => { const r = [...norm(ref).replace(/ /g, "")], h = [...norm(hyp).replace(/ /g, "")]; return r.length ? lev(r, h) / r.length : (h.length ? 1 : 0); };
/* المعرّفات: يضمّ الأرقام المفصولة بمسافات ("8 0 5 6 2 1" ← 805621)، ويلتقط رمزاً حرفياً رقمياً مثل A1182 أو أرقاماً ≥4 */
function ids(text) { let t = String(text || "").replace(/[٠-٩]/g, d => AD[d]); t = t.replace(/(?<![\w])(\d)(?:\s+(\d)){2,}(?![\w])/g, m => m.replace(/\s+/g, "")); const o = new Set(); (t.match(/\b[A-Za-z]\s?\d{3,}\b/g) || []).forEach(x => o.add(x.replace(/\s+/g, "").toUpperCase())); (t.match(/(?<![A-Za-z\d])\d{4,}(?![\d])/g) || []).forEach(x => o.add(x)); return [...o]; }
const idExact = (refIds, hypText) => { if (!refIds || !refIds.length) return null; const h = ids(hypText); return refIds.every(r => h.includes(String(r).toUpperCase())); };
/* اللغة (تقريبية بالنسبة الحرفية؛ تُوسَم heuristic في التقرير) */
function lang(text) { const t = String(text || ""), ar = (t.match(/[؀-ۿ]/g) || []).length, la = (t.match(/[A-Za-zÀ-ÿ]/g) || []).length; if (!ar && !la) return "none"; if (ar && la && Math.min(ar, la) / (ar + la) > .12) return "mixed"; if (ar >= la) return "ar"; return /\b(le|la|les|des|commande|montre|donne|quel|est|combien|stock|ventes?|ouvre)\b/i.test(t) ? "fr" : /\b(the|show|what|open|order|sales|stock)\b/i.test(t) ? "en" : "latin"; }
/* الأداة التي يفهمها المحلّل الحتمي من النص (null إن لم يفهم) */
function tool(text, ctx) { try { const p = NLU.parse(text, ctx || {}); return p && p.intent && p.intent !== "unknown" ? p.intent : null; } catch (_) { return null; } }
const pct = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };
const mean = a => a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(4) : null;
module.exports = { norm, wer, cer, lev, ids, idExact, lang, tool, pct, mean, NLU };
