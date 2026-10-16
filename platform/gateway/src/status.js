import DICT from "./status-dict.js";
export const S = { PENDING: "pending", SHIPPED: "shipped", OUT_FOR_DELIVERY: "out_for_delivery", DELIVERED: "delivered", FAILED_ATTEMPT: "failed_attempt", RETURNED: "returned", CANCELLED: "cancelled", UNKNOWN: "unknown" };
export const ALL = Object.values(S);
export const FINAL = [S.DELIVERED, S.RETURNED, S.CANCELLED];
const RANK = { [S.PENDING]: 0, [S.SHIPPED]: 1, [S.OUT_FOR_DELIVERY]: 2, [S.FAILED_ATTEMPT]: 2 };
/** لا رجوع للخلف، النهائي لا يتغيّر، المجهول لا يُطبَّق. */
export function canTransition(from, to) {
  if (to === S.UNKNOWN || from === to || FINAL.includes(from)) return false;
  if (FINAL.includes(to)) return true;
  return (RANK[to] ?? -1) > (RANK[from] ?? -1) || (from === S.FAILED_ATTEMPT && to === S.OUT_FOR_DELIVERY);
}
/* احتياط عند غياب النص من القاموس الصريح (مطابق لـStatusMapper::RULES في نسخة PHP) */
const RULES = [
  [/annul|cancel|supprim/, S.CANCELLED],
  [/tentative.*(echou|echec|fail)|echec (de )?livraison|injoignable|ne repond pas|no answer|client absent|reporte|failed/, S.FAILED_ATTEMPT],
  [/retour|retourne|returned|return |^return|refus|rejet/, S.RETURNED],
  [/en livraison|sorti en livraison|out for delivery|livraison en cours|en cours de livraison|en cours de distribution|pret pour livreur/, S.OUT_FOR_DELIVERY],
  [/^livre|livree|delivered|encaisse|paye|paid/, S.DELIVERED],
  [/pas encore|en attente de ramassage|a ramasser|a verifier|pret a expedier|en preparation|preparation|prepar|nouveau|nouvelle|^new|created|cree|pending|en attente|validee?|confirmee?/, S.PENDING],
  [/expedie|transfert|transit|centre|localisation|vers wilaya|recu a|ramasse|prise en charge|arrive|dispatch|en route|shipped|picked|hub|sortie|en cours/, S.SHIPPED],
];
const ACC = { é: "e", è: "e", ê: "e", ë: "e", à: "a", â: "a", ä: "a", î: "i", ï: "i", ô: "o", ö: "o", û: "u", ù: "u", ü: "u", ç: "c", œ: "oe" };
/** تطبيع موحّد مطابق لـStatusMapper::normalize في PHP: حروف صغيرة، بلا تشكيل، فراغ بدل _ و-، حذف «( رقم )» والأقواس. */
export function normText(raw) {
  let t = String(raw ?? "").trim().toLowerCase().replace(/[éèêëàâäîïôöûùüçœ]/g, (c) => ACC[c]);
  t = t.replace(/\(\s*\d+\s*\)/g, " ").replace(/[_\-\[\]()]/g, " ");
  return t.replace(/\s+/g, " ").trim();
}
const D = {};
for (const [fam, d] of Object.entries(DICT)) {
  if (fam.startsWith("_") || !d || typeof d !== "object") continue;
  const e = { exact: new Map(), codes: new Map(), event_key: new Map() };
  for (const [k, v] of Object.entries(d.exact ?? {})) e.exact.set(normText(k), v);
  for (const [k, v] of Object.entries(d.codes ?? {})) e.codes.set(String(k), v);
  for (const [k, v] of Object.entries(d.event_key ?? {})) e.event_key.set(normText(k), v);
  D[fam] = e;
}
export const families = () => Object.keys(D);
/** [الحالة، المصدر] — 'ignore' حدث مالي/إداري لا يمثل حالة الطرد. */
export function explain(family, raw) {
  const t = normText(raw); if (!t) return [S.UNKNOWN, "empty"];
  const d = D[family];
  if (d) {
    if (d.exact.has(t)) return [d.exact.get(t), "exact"];
    if (d.event_key.has(t)) return [d.event_key.get(t), "event_key"];
    const c = String(raw ?? "").trim(); if (d.codes.has(c)) return [d.codes.get(c), "code"];
  }
  for (const [re, st] of RULES) if (re.test(t)) return [st, "fallback"];
  return [S.UNKNOWN, "unknown"];
}
export function mapStatus(raw, family = "") { const [st] = explain(family, raw); return st === "ignore" ? S.UNKNOWN : st; }
