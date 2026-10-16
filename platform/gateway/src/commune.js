import { levenshtein } from "./util.js";
const ACC = { é: "e", è: "e", ê: "e", ë: "e", à: "a", â: "a", ä: "a", î: "i", ï: "i", ô: "o", ö: "o", û: "u", ù: "u", ü: "u", ç: "c", œ: "oe", ʿ: "'", "’": "'" };
/** مطابق لـCommuneMatcher::normalize في PHP: تطبيع ثم مقارنة بالصوامت فقط (تتحمل فروق التهجئة). */
export function normalize(s) {
  let t = String(s ?? "").trim().toLowerCase().replace(/[éèêëàâäîïôöûùüçœʿ’]/g, (c) => ACC[c]);
  t = t.replace(/[\-_'`.,()]+/gu, " ");
  t = t.replace(/\bouled\b/gu, "oulad");
  t = t.replace(/\b(el|el-|al|ben)\s+/gu, "$1");
  t = t.replaceAll("ou", "u").replaceAll("ee", "i");
  t = t.replace(/(?<=\p{L})[aeiouy](?=\p{L})/gu, "");
  return t.replace(/\s+/gu, "").trim();
}
/** @returns {{id,name,score:number}|null} */
export function best(candidates, name, min = 0.82) {
  const n = normalize(name); if (!n) return null;
  let exact = null, bestC = null, bestScore = 0;
  for (const c of candidates) {
    const cn = normalize(c.name);
    if (cn === n) { exact ??= { ...c, score: 1 }; continue; }
    const max = Math.max(n.length, cn.length); if (!max) continue;
    const score = 1 - levenshtein(n, cn) / max;
    if (score > bestScore) { bestScore = score; bestC = { ...c, score: Math.round(score * 1000) / 1000 }; }
  }
  if (exact) return exact;
  return bestC && bestScore >= min ? bestC : null;
}
/** أقرب n أسماء (للرسالة التشخيصية). */
export function suggest(candidates, name, n = 4) {
  const x = normalize(name), sc = new Map();
  for (const c of candidates) sc.set(String(c.name), levenshtein(x, normalize(c.name)));
  return [...sc.entries()].sort((a, b) => a[1] - b[1]).slice(0, n).map((e) => e[0]);
}
