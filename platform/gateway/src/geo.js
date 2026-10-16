import DATA from "./geo-data.js";
import { levenshtein } from "./util.js";
const norm = (s) => String(s ?? "").toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/’/g, "'").replace(/[^a-z0-9؀-ۿ]+/g, "");
/** كتالوج الولايات (1..69) والبلديات والمكاتب + مطابقة تهجئة البلدية. */
export class Geo {
  constructor(data = DATA) {
    this.w = {}; this.idx = {};
    for (const w of data.wilayas) { this.w[w.code] = w; this.idx[w.code] = {}; for (const n of w.communes) this.idx[w.code][norm(n)] = n; }
    // الولايات 59–69: ما زالت الشركات تسجّل بلدياتها تحت الولاية الأم
    for (const w of data.wilayas) if (w.parent != null && this.idx[w.parent]) for (const n of w.communes) this.idx[w.parent][norm(n)] ??= n;
  }
  static norm = norm;
  wilayas(all = false) { return Object.values(this.w).filter((w) => all || w.parent == null).map((w) => ({ code: w.code, name: w.name, shipAs: w.parent ?? w.code, courierSupported: w.parent == null, communes: w.communes.length })); }
  wilaya(code) { return this.w[code] ?? null; }
  name(code) { return this.w[code]?.name ?? null; }
  legacyCode(code) { return this.w[code]?.parent ?? code; }
  communes(code) { return this.w[code]?.communes ?? []; }
  desks(code) { return this.w[code]?.desks ?? []; }
  searchCommunes(q, limit = 50) {
    const n = norm(q), out = []; if (!n) return out;
    for (const [c, m] of Object.entries(this.idx)) for (const [k, orig] of Object.entries(m)) if (k.includes(n)) { out.push({ wilaya: +c, commune: orig }); if (out.length >= limit) return out; }
    return out;
  }
  matchCommune(wilaya, name) {
    const m = this.idx[wilaya]; const n = norm(name);
    if (!m) return { status: "unknown_wilaya", commune: null, suggestions: [] };
    if (!n) return { status: "unknown", commune: null, suggestions: [] };
    if (m[n]) return { status: "exact", commune: m[n], suggestions: [] };
    const scored = [];
    for (const [k, orig] of Object.entries(m)) {
      const d = levenshtein(n, k), contain = k.includes(n) || n.includes(k), limit = Math.max(1, Math.floor(Math.max(n.length, k.length) / 5));
      if (d <= limit || (contain && Math.min(n.length, k.length) >= 4)) scored.push([orig, d]);
    }
    scored.sort((a, b) => a[1] - b[1]);
    const sug = scored.slice(0, 5).map((x) => x[0]);
    if (scored.length) { const best = scored[0][1]; if (scored.filter((x) => x[1] === best).length === 1 && best <= 1) return { status: "corrected", commune: sug[0], suggestions: sug }; }
    return { status: "unknown", commune: null, suggestions: sug };
  }
}
