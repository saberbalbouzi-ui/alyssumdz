/** الكائن الموحَّد للطرد. يُنشأ بـmakeParcel (يرمي ValidationError عند خطأ). */
export class ValidationError extends Error {}
export function makeParcel(geo, o) {
  const p = {
    orderRef: String(o.orderRef ?? ""), name: String(o.name ?? "").trim(), phone: String(o.phone ?? ""), wilayaCode: +o.wilayaCode, commune: String(o.commune ?? "").trim(),
    address: String(o.address ?? "").trim(), total: +o.total, shippingFee: +(o.shippingFee ?? 0), products: String(o.products ?? ""), phone2: String(o.phone2 ?? ""),
    stopDesk: !!o.stopDesk, deskId: o.deskId ?? null, note: String(o.note ?? ""), canOpen: o.canOpen !== false,
  };
  if (!p.orderRef.trim()) throw new ValidationError("orderRef مطلوب");
  if (!geo.name(p.wilayaCode)) throw new ValidationError("ولاية غير معروفة: " + o.wilayaCode);
  if (!(p.total >= 0) || p.total > 10_000_000) throw new ValidationError("المبلغ خارج الحدود");
  const digits = (s) => String(s).replace(/\D/g, "");
  const local = (s) => { let d = digits(s); if (d.startsWith("213")) d = "0" + d.slice(3); else if (d.length === 9) d = "0" + d; return d; };
  return Object.freeze({
    ...p,
    wilayaName: geo.name(p.wilayaCode), legacyWilaya: geo.legacyCode(p.wilayaCode), legacyName: geo.name(geo.legacyCode(p.wilayaCode)),
    localPhone: (s) => local(s ?? p.phone),
    nameParts: () => { const w = p.name.split(/\s+/).filter(Boolean); return [w[0] ?? ".", w.slice(1).join(" ") || "."]; },
    productsText: (max = 250) => p.products.replace(/\n/g, "، ").replace(/\s*=\s*\d+\s*DA\s*/gi, "").trim().slice(0, max),
    priceWithoutShipping: () => Math.max(0, Math.round(p.total - p.shippingFee)),
  });
}
