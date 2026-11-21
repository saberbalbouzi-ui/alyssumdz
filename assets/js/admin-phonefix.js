/* تنظيف لصق الهاتف في كل حقول الهاتف والبحث (كحقل الهاتف في «إضافة طلب»): يستخرج الرقم من أي نص منسوخ (+213 · مسافات وشرطات · أرقام عربية · رموز اتجاه خفية من واتساب)
   حقل هاتف خالص (type=tel أو data-phone أو عنوانه «الهاتف»): يلصق الرقم نظيفاً ويقبل أرقاماً فقط. حقل بحث (اسم/هاتف…): يستبدل المنسوخ برقمه فقط إن كان هاتفاً جزائرياً صالحاً، وإلا يبقى لصقاً عادياً.
   لا يمسّ حقول «إضافة طلب» (لها معالجها). مشترك بين كل العملاء. */
const AdminPhoneFix = (() => {
  const AR = "٠١٢٣٤٥٦٧٨٩", FA = "۰۱۲۳۴۵۶۷۸۹", INV = /[​-‏‪-‮⁦-⁩ ﻿]/g;
  const latin = t => String(t == null ? "" : t).replace(/[٠-٩]/g, d => AR.indexOf(d)).replace(/[۰-۹]/g, d => FA.indexOf(d));
  const valid = d => /^0[567]\d{8}$/.test(d) || /^0[2-4]\d{7}$/.test(d);
  function clean(raw) {
    const t = latin(raw).replace(INV, " ");
    const seqs = (t.match(/\+?\d(?:[\d\s.\-_()·•]*\d)?/g) || []).map(x => ({ d: x.replace(/\D/g, ""), plus: x.charAt(0) === "+" })).filter(x => x.d.length >= 9);
    const norm = x => { let d = x.d; if (/^00213/.test(d)) d = d.slice(5); else if (/^213/.test(d) && d.length >= 12) d = d.slice(3); else if (x.plus && /^213/.test(d)) d = d.slice(3); if (d.length === 9 && /^[567]/.test(d)) d = "0" + d; return d; };
    const good = seqs.map(norm).filter(valid); if (good.length) return good[0];
    if (seqs.length) return norm(seqs[0]);
    return t.replace(/(\d)[\s.\-_/()·•](?=\d)/g, "$1").replace(/[^0-9+]/g, "");
  }
  const isText = el => !!el && el.tagName === "INPUT" && /^(text|search|tel|)$/i.test(el.getAttribute("type") || "") && !el.readOnly && !el.disabled;
  const hint = el => [el.placeholder, el.id, el.name, el.getAttribute("aria-label"), el.title].join(" ");
  const strict = el => !!el.dataset.phone || el.type === "tel" || /^\s*(رقم\s+)?(ال)?هاتف\s*[*:]?\s*$/i.test(el.placeholder || "") || /(^|[-_])phone$/i.test(el.id || "");
  const searchy = el => el.type === "search" || /بحث|🔍|search|هاتف|phone|filter|(^|[-_])q$/i.test(hint(el)) || !!el.closest(".search-bar");
  const skip = el => /^mo-/.test(el.id || "") || el.dataset.nophonefix !== undefined;
  const fire = el => el.dispatchEvent(new Event("input", { bubbles: true }));
  document.addEventListener("paste", e => {
    const el = e.target; if (!isText(el) || skip(el)) return; const isS = strict(el); if (!isS && !searchy(el)) return;
    const t = (e.clipboardData || window.clipboardData || { getData() { return ""; } }).getData("text"); if (!t) return;
    const p = clean(t);
    if (isS) { e.preventDefault(); el.value = p; fire(el); return; }
    if (valid(p) && latin(t).replace(/\D/g, "").length <= 16) { e.preventDefault(); el.value = p; fire(el); }
  }, true);
  document.addEventListener("change", e => { const el = e.target; if (!isText(el) || skip(el) || !strict(el)) return; const c = clean(el.value); if (c !== el.value) { el.value = c; fire(el); } }, true);
  document.addEventListener("input", e => {
    const el = e.target; if (!isText(el) || skip(el) || (!strict(el) && !searchy(el))) return; if (e.__pf) return;
    let v = el.value, c = latin(v).replace(INV, ""); if (strict(el)) c = c.replace(/[^0-9+]/g, ""); if (c !== v) { const pos = el.selectionStart; el.value = c; try { if (pos != null) el.setSelectionRange(Math.min(pos, c.length), Math.min(pos, c.length)); } catch (x) { } }
  }, true);
  return { clean, valid, latin };
})();
window.AdminPhoneFix = AdminPhoneFix;
