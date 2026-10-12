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
const RULES = [
  [/annul|cancel|supprim/, S.CANCELLED],
  [/tentative.*(echou|echec|fail)|echec (de )?livraison|injoignable|ne repond pas|no answer|client absent|reporte|failed/, S.FAILED_ATTEMPT],
  [/retour|retourne|returned|return |^return|refus|rejet/, S.RETURNED],
  [/en livraison|sorti en livraison|out for delivery|livraison en cours|en cours de livraison|en cours de distribution|pret pour livreur/, S.OUT_FOR_DELIVERY],
  [/^livre|livree|delivered|encaisse|paye|paid/, S.DELIVERED],
  [/pas encore|en attente de ramassage|a ramasser|a verifier|pret a expedier|en preparation|preparation|prepar|nouveau|nouvelle|^new|created|cree|pending|en attente|validee?|confirmee?/, S.PENDING],
  [/expedie|transfert|transit|centre|localisation|vers wilaya|recu a|ramasse|prise en charge|arrive|dispatch|en route|shipped|picked|hub|sortie|en cours/, S.SHIPPED],
];
export function normText(raw) {
  return String(raw ?? "").toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/’/g, "'").replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
}
export function mapStatus(raw) {
  const t = normText(raw); if (!t) return S.UNKNOWN;
  for (const [re, st] of RULES) if (re.test(t)) return st;
  return S.UNKNOWN;
}
