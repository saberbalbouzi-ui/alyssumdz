import { HttpError, ok, clampLimit } from "../core.js";
import { hmacHex, localPhone, safeHttpsUrl, sha256Hex } from "../util.js";

/**
 * الهَب المركزي للمصادر: يسحب طلبات متاجر متعددة (Shopify · WooCommerce · Google Sheets) بواجهاتها ويجمعها في جدول موحّد لكل مستأجر.
 * المسحوب للقراءة فقط (لا نكتب في متاجر المصدر). الأسرار مشفّرة بالخزنة، الهاتف والعنوان مشفّران، والمزامنة تزايدية عبر cron.
 * الدوال النقية (parse… وvalidateSource) مصدَّرة للاختبار؛ الشبكة عبر ctx.fetchFn فقط.
 */
export const KINDS = ["shopify", "woocommerce", "gsheet"];
const MAX_SOURCES = 10, PAGES_PER_RUN = 5, SHEET_MAX_ROWS = 5000, SHEET_MAX_BYTES = 3_000_000, DAY = 86400;
const DEAD = ["annulee", "echec"];       // لا تُحتسب في المبيعات
const txt = (s, n) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, n);

/* ───────── دوال نقية: تطبيع ───────── */
const AR_DIG = { "٠": 0, "١": 1, "٢": 2, "٣": 3, "٤": 4, "٥": 5, "٦": 6, "٧": 7, "٨": 8, "٩": 9, "۰": 0, "۱": 1, "۲": 2, "۳": 3, "۴": 4, "۵": 5, "۶": 6, "۷": 7, "۸": 8, "۹": 9 };
const latinDigits = (s) => String(s ?? "").replace(/[٠-٩۰-۹]/g, (c) => AR_DIG[c]);
/** مفتاح مقارنة للعناوين والكلمات: حروف صغيرة، بلا تشكيل/لكنات/رموز، توحيد الألف والتاء المربوطة */
export function fold(s) {
  return latinDigits(s).normalize("NFD").replace(/[̀-ًͯ-ٰٟـ]/g, "").toLowerCase().replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^a-z0-9؀-ۿ]+/g, "");
}
/** رقم من نص بصيغ مختلطة: «3 500 دج» «3.500,00» «3,500» «1500.50» (النقطة قبل ثلاث خانات = آلاف، كما يكتبها الجزائريون) */
export function parseNum(v) {
  let s = latinDigits(v).replace(/[^\d.,\-]/g, ""); if (!/\d/.test(s)) return 0;
  const neg = s.startsWith("-"); s = s.replace(/-/g, ""); const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
  if (lc >= 0 && ld >= 0) s = lc > ld ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (lc >= 0) s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(/,/g, ".");
  else if (ld >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = parseFloat(s); return Number.isFinite(n) ? (neg ? -n : n) : 0;
}
/** تاريخ → ثوانٍ يونكس. يقبل ISO وdd/mm/yyyy [hh:mm[:ss]] (توقيت المتجر tz بالدقائق) أو null */
export function parseDate(v, tzMin = 60) {
  const s = latinDigits(v).trim(); if (!s) return null;
  const m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (m) { let d = +m[1], mo = +m[2], y = +m[3]; if (y < 100) y += 2000; if (mo > 12 && d <= 12) [d, mo] = [mo, d]; if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return Math.floor(Date.UTC(y, mo - 1, d, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) / 1000) - tzMin * 60; }
  const iso = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.replace(" ", "T") : null; if (!iso) return null;
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso), t = Date.parse(hasTz || !/T/.test(iso) ? iso : iso + "Z"); return Number.isFinite(t) ? Math.floor(t / 1000) - (hasTz || !/T/.test(iso) ? 0 : tzMin * 60) : null;
}
/** حالة نصية حرّة (fr/ar/en) ← مفردات اللوحة nouvelle|confirmee|expediee|livree|annulee|echec */
export function statusFromText(t) {
  const s = fold(t); if (!s) return "nouvelle";
  if (/annul|cancel|ملغ|الغي|refus|رفض/.test(s)) return "annulee";
  if (/retour|return|مرتجع|راجع|echec|failed|فشل/.test(s)) return "echec";
  if (/livre|deliver|سلم|وصل|تسليم/.test(s) && !/non(livre|deliver)|لم/.test(s)) return "livree";
  if (/livraison|expedi|shipp|envoy|enroute|encours|شحن|ارسل|مرسل|طريق/.test(s)) return "expediee";
  if (/confirm|valid|accept|paid|payee|مؤكد|اكد|تاكيد|مدفوع/.test(s)) return "confirmee";
  return "nouvelle";
}
/** رقم الهاتف: الجزائري بصيغته المحلية، وغيره أرقاماً فقط (≤16) */
export function cleanPhone(p) { const l = localPhone(p); if (l) return l; const d = latinDigits(p).replace(/[^\d+]/g, "").slice(0, 16); return d.replace(/\D/g, "").length >= 6 ? d : ""; }

/* ───────── Shopify ───────── */
export function shopifyStatus(o) {
  if (o.cancelled_at) return "annulee";
  const f = o.financial_status, ful = o.fulfillment_status;
  if (f === "refunded" || f === "voided") return "echec";
  if (ful === "fulfilled") return "expediee";
  if (ful === "partial") return "confirmee";
  return ["paid", "authorized", "partially_paid"].includes(f) ? "confirmee" : "nouvelle";     // الدفع عند الاستلام يبقى pending = جديد
}
export function parseShopify(o) {
  const sh = o.shipping_address ?? {}, bl = o.billing_address ?? {}, cu = o.customer ?? {};
  const name = txt(sh.name || bl.name || [cu.first_name, cu.last_name].filter(Boolean).join(" "), 80);
  const at = parseDate(o.created_at) ?? null, items = (o.line_items ?? []).slice(0, 30).map((i) => ({ title: txt(i.title + (i.variant_title ? " — " + i.variant_title : ""), 140), qty: Math.max(1, Math.floor(+i.quantity) || 1), price: parseNum(i.price) }));
  return { ext_id: String(o.id), number: txt(o.name || o.order_number || o.id, 40), at, status: shopifyStatus(o), raw_status: txt([o.financial_status, o.fulfillment_status || "unfulfilled"].join("/"), 60), paid: o.financial_status === "paid",
    name, phone: cleanPhone(o.phone || sh.phone || bl.phone || cu.phone), city: txt(sh.city || bl.city, 60), wilaya: txt(sh.province || bl.province, 60), address: txt([sh.address1, sh.address2].filter(Boolean).join(" ") || [bl.address1, bl.address2].filter(Boolean).join(" "), 200),
    items, total: parseNum(o.total_price), currency: /^[A-Za-z]{3}$/.test(o.currency || "") ? o.currency.toUpperCase() : "DZD", updated: parseDate(o.updated_at) };
}
/** رأس Link: <url>; rel="next" ← الرابط التالي أو null */
export function linkNext(h) { const m = /<([^>]+)>\s*;\s*rel="?next"?/i.exec(String(h ?? "")); return m ? m[1] : null; }

/* ───────── WooCommerce ───────── */
export function wooStatus(s) { return ({ pending: "nouvelle", "on-hold": "nouvelle", processing: "confirmee", completed: "livree", cancelled: "annulee", failed: "annulee", refunded: "echec", trash: "annulee" })[s] ?? statusFromText(s); }
export function parseWoo(o) {
  const b = o.billing ?? {}, s = o.shipping ?? {}, pick = (k) => (s[k] && String(s[k]).trim()) || b[k] || "";
  const name = txt([pick("first_name"), pick("last_name")].filter(Boolean).join(" "), 80) || txt([b.first_name, b.last_name].filter(Boolean).join(" "), 80);
  const iso = o.date_created_gmt ? (/[zZ]|[+-]\d\d:?\d\d$/.test(o.date_created_gmt) ? o.date_created_gmt : o.date_created_gmt + "Z") : o.date_created;
  const items = (o.line_items ?? []).slice(0, 30).map((i) => { const q = Math.max(1, Math.floor(+i.quantity) || 1); return { title: txt(i.name, 140), qty: q, price: q ? parseNum(i.total) / q : parseNum(i.price) }; });
  return { ext_id: String(o.id), number: txt(o.number ?? o.id, 40), at: parseDate(iso), status: wooStatus(o.status), raw_status: txt(o.status, 60), paid: !!o.date_paid_gmt || o.status === "completed",
    name, phone: cleanPhone(b.phone || s.phone), city: txt(pick("city"), 60), wilaya: txt(pick("state"), 60), address: txt([pick("address_1"), pick("address_2")].filter(Boolean).join(" "), 200),
    items, total: parseNum(o.total), currency: /^[A-Za-z]{3}$/.test(o.currency || "") ? o.currency.toUpperCase() : "DZD", updated: parseDate((o.date_modified_gmt ? o.date_modified_gmt + "Z" : o.date_modified)) };
}

/* ───────── Google Sheets (CSV) ───────── */
export function parseCsv(text) {
  let s = String(text ?? "").replace(/^﻿/, ""); const head = s.split("\n", 1)[0] || "";
  const delim = [",", ";", "\t"].map((d) => [d, head.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((x) => x.trim() !== "")) rows.push(row); row = []; if (rows.length > SHEET_MAX_ROWS + 1) break; }
    else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); if (row.some((x) => x.trim() !== "")) rows.push(row); }
  return rows;
}
const SYN = {
  id: ["id", "ref", "reference", "ordernumber", "ncommande", "numerocommande", "numcommande", "commande", "رقمالطلب", "رقم"],
  date: ["date", "datecommande", "createdat", "horodateur", "timestamp", "jour", "التاريخ", "تاريخ", "تاريخالطلب"],
  name: ["nom", "nomcomplet", "nomprenom", "name", "fullname", "client", "customer", "clientname", "الاسم", "الاسمواللقب", "الاسماللقب", "اسمالزبون", "اسمالعميل"],
  phone: ["telephone", "tel", "phone", "mobile", "numerotelephone", "numtel", "ntel", "whatsapp", "contact", "هاتف", "الهاتف", "رقمالهاتف", "رقمهاتف"],
  wilaya: ["wilaya", "state", "province", "region", "ولاية", "الولاية"],
  city: ["commune", "ville", "city", "baladia", "البلدية", "بلدية", "المدينة", "مدينة"],
  address: ["adresse", "address", "adress", "العنوان", "عنوان"],
  product: ["produit", "produits", "product", "products", "article", "designation", "item", "offre", "المنتج", "المنتجات", "منتج"],
  qty: ["quantite", "qte", "qty", "quantity", "nombre", "الكمية", "كمية", "العدد"],
  total: ["total", "montant", "prixtotal", "totalprix", "amount", "price", "prix", "المبلغ", "الاجمالي", "المجموع", "السعر", "الثمن"],
  status: ["statut", "status", "etat", "situation", "etatcommande", "الحالة", "حالةالطلب"],
};
const SYN_F = Object.fromEntries(Object.entries(SYN).map(([k, v]) => [k, v.map(fold)]));
/** يطابق رؤوس الأعمدة بالحقول؛ map = {حقل: "اسم العمود"} يتغلّب على الكشف الآلي. يُرجع {حقل: فهرس} */
export function sheetColumns(header, map = {}) {
  const hf = header.map(fold), col = {};
  for (const [f, name] of Object.entries(map || {})) { const i = hf.indexOf(fold(name)); if (i >= 0 && SYN[f]) col[f] = i; }
  for (const f of Object.keys(SYN)) { if (col[f] !== undefined) continue; const i = hf.findIndex((h, ix) => h && !Object.values(col).includes(ix) && SYN_F[f].includes(h)); if (i >= 0) col[f] = i; }
  if (col.total === undefined) { const i = hf.findIndex((h, ix) => h && !Object.values(col).includes(ix) && /^(prix|montant|total|السعر|المبلغ)/.test(h)); if (i >= 0) col.total = i; }
  return col;
}
export function parseSheetRows(rows, cfg = {}) {
  if (rows.length < 2) return { orders: [], columns: {}, missing: ["phone", "name"] };
  const col = sheetColumns(rows[0], cfg.map), tz = Number.isFinite(+cfg.tz_offset_min) ? +cfg.tz_offset_min : 60, out = [];
  const missing = ["phone"].filter((f) => col[f] === undefined);
  for (let r = 1; r < rows.length && out.length < SHEET_MAX_ROWS; r++) {
    const row = rows[r], g = (f) => (col[f] === undefined ? "" : String(row[col[f]] ?? "").trim());
    const phone = cleanPhone(g("phone")), name = txt(g("name"), 80); if (!phone && !name) continue;
    const qty = Math.max(1, Math.floor(parseNum(g("qty"))) || 1), t = g("total") ? parseNum(g("total")) : 0, product = txt(g("product"), 140);
    out.push({ ext_id: g("id") ? "i" + txt(g("id"), 40) : "r" + r, number: g("id") ? txt(g("id"), 40) : "#" + r, at: parseDate(g("date"), tz), status: statusFromText(g("status")), raw_status: txt(g("status"), 60), paid: false,
      name, phone, city: txt(g("city"), 60), wilaya: txt(g("wilaya"), 60), address: txt(g("address"), 200), items: product ? [{ title: product, qty, price: qty ? t / qty : t }] : [], total: t, currency: txt(cfg.currency, 3).toUpperCase() || "DZD", updated: null });
  }
  return { orders: out, columns: col, missing };
}
/** معرّف الجدول و gid من رابط ملصوق */
export function sheetRef(input) {
  const s = String(input ?? "").trim(); if (!s) return null;
  const m = /docs\.google\.com\/spreadsheets\/d\/(e\/)?([A-Za-z0-9_-]{20,})/.exec(s), g = /[#?&]gid=(\d{1,12})/.exec(s);
  if (m && m[1]) return /output=csv/.test(s) ? { csv_url: s.split("#")[0] } : null;     // رابط «النشر على الويب» الكامل
  if (m) return { sheet_id: m[2], gid: g ? g[1] : "0" };
  return /^[A-Za-z0-9_-]{25,}$/.test(s) ? { sheet_id: s, gid: "0" } : null;
}

/* ───────── تحقق الإعداد (نقي) ───────── */
export function validateSource(kind, cfgIn = {}, secIn = {}, existing = null) {
  const cfg = {}, sec = {}, bad = (f, m) => { throw new HttpError(400, "validation_error", m, { [f]: m }); };
  if (!KINDS.includes(kind)) bad("kind", "kind: " + KINDS.join("|"));
  const iv = cfgIn.interval_min === undefined ? (existing?.interval_min ?? 5) : Math.floor(+cfgIn.interval_min); if (!(iv >= 5 && iv <= 120)) bad("interval_min", "بين 5 و120 دقيقة"); cfg.interval_min = iv;
  const bf = cfgIn.backfill_days === undefined ? (existing?.backfill_days ?? 30) : Math.floor(+cfgIn.backfill_days); if (!(bf >= 1 && bf <= 90)) bad("backfill_days", "بين 1 و90 يوماً"); cfg.backfill_days = bf;
  if (kind === "shopify") {
    const host = String(cfgIn.shop ?? existing?.shop ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/.test(host)) bad("shop", "نطاق المتجر بصيغة mystore.myshopify.com"); cfg.shop = host;
    cfg.api_version = /^20\d\d-(01|04|07|10)$/.test(cfgIn.api_version ?? existing?.api_version ?? "") ? (cfgIn.api_version ?? existing.api_version) : "2026-07";
    if (secIn.token !== undefined) { if (!/^[A-Za-z0-9_-]{16,120}$/.test(String(secIn.token))) bad("token", "رمز الوصول غير صالح (shpat_…)"); sec.token = String(secIn.token); }
  } else if (kind === "woocommerce") {
    let u = String(cfgIn.url ?? existing?.url ?? "").trim().replace(/\/wp-json.*$/i, "").replace(/\/+$/, ""); if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
    if (!safeHttpsUrl(u)) bad("url", "رابط الموقع https صالح (https://mysite.com)"); cfg.url = u;
    if (secIn.key !== undefined) { if (!/^ck_[0-9a-f]{20,64}$/i.test(String(secIn.key))) bad("key", "Consumer key يبدأ بـ ck_"); sec.key = String(secIn.key); }
    if (secIn.secret !== undefined) { if (!/^cs_[0-9a-f]{20,64}$/i.test(String(secIn.secret))) bad("secret", "Consumer secret يبدأ بـ cs_"); sec.secret = String(secIn.secret); }
  } else {
    const ref = sheetRef(cfgIn.url ?? cfgIn.sheet_url ?? "") ?? (cfgIn.sheet_id ? sheetRef(cfgIn.sheet_id) : null) ?? (existing?.sheet_id || existing?.csv_url ? { sheet_id: existing.sheet_id, gid: existing.gid, csv_url: existing.csv_url } : null);
    if (!ref) bad("url", "رابط جدول Google (مشاركة: أي شخص لديه الرابط يمكنه العرض) أو رابط CSV المنشور");
    if (ref.csv_url) { try { const p = new URL(ref.csv_url); if (p.protocol !== "https:" || p.hostname !== "docs.google.com") throw 0; } catch { bad("url", "رابط CSV يجب أن يكون من docs.google.com"); } cfg.csv_url = ref.csv_url; }
    else { cfg.sheet_id = ref.sheet_id; cfg.gid = ref.gid || "0"; }
    if (cfgIn.map && typeof cfgIn.map === "object") { cfg.map = {}; for (const [k, v] of Object.entries(cfgIn.map).slice(0, 12)) if (SYN[k] && String(v).trim()) cfg.map[k] = txt(v, 60); }
    else if (existing?.map) cfg.map = existing.map;
    const cur = String(cfgIn.currency ?? existing?.currency ?? "DZD").toUpperCase(); cfg.currency = /^[A-Z]{3}$/.test(cur) ? cur : "DZD";
    const tz = cfgIn.tz_offset_min === undefined ? (existing?.tz_offset_min ?? 60) : Math.floor(+cfgIn.tz_offset_min); if (!(tz >= -720 && tz <= 840)) bad("tz_offset_min", "فرق التوقيت بالدقائق"); cfg.tz_offset_min = tz;
  }
  return { cfg, sec };
}

/* ───────── الجلب (Adapter) ───────── */
const errMsg = { 401: "رمز الوصول/المفاتيح مرفوضة من المتجر", 403: "الصلاحية غير كافية (يلزم السماح بقراءة الطلبات)", 404: "الرابط غير موجود (تحقق من العنوان أو الروابط الدائمة في ووردبريس)", 429: "المتجر يطلب التمهّل (سنعيد المحاولة)" };
async function getText(ctx, url, init) {
  let r; try { r = await ctx.fetchFn(url, { ...init, signal: AbortSignal.timeout(20000) }); } catch (e) { throw new Error("تعذّر الاتصال بالمتجر: " + String(e?.message || e).slice(0, 80)); }
  const t = await r.text(); if (r.status < 200 || r.status >= 300) { const e = new Error(errMsg[r.status] || "ردّ غير متوقع من المتجر (" + r.status + ")"); e.status = r.status; throw e; }
  return { text: t, headers: r.headers, status: r.status };
}
const hdr = (h, k) => (h && typeof h.get === "function" ? h.get(k) : null);
const iso = (s) => new Date(s * 1000).toISOString().replace(/\.\d+Z$/, "Z");
/** صفحات متتالية من مصدر؛ تُرجع { orders, next (حالة الاستئناف) } */
export async function pull(ctx, kind, cfg, sec, st) {
  const out = []; let next = st.next ?? null;
  if (kind === "shopify") {
    for (let p = 0; p < PAGES_PER_RUN; p++) {
      const url = next || `https://${cfg.shop}/admin/api/${cfg.api_version}/orders.json?status=any&limit=250&${st.back ? "created_at_min" : "updated_at_min"}=${encodeURIComponent(iso(st.since))}`;
      let u; try { u = new URL(url); } catch { throw new Error("رابط التصفح غير صالح"); } if (u.protocol !== "https:" || u.hostname !== cfg.shop) throw new Error("رابط تصفح من نطاق غير متوقع");
      const r = await getText(ctx, url, { headers: { "X-Shopify-Access-Token": sec.token, Accept: "application/json" } });
      let j; try { j = JSON.parse(r.text); } catch { throw new Error("ردّ غير صالح من Shopify"); }
      for (const o of j.orders ?? []) out.push(parseShopify(o));
      next = linkNext(hdr(r.headers, "link")); if (!next) break;
    }
  } else if (kind === "woocommerce") {
    let page = +next || 1;
    for (let p = 0; p < PAGES_PER_RUN; p++) {
      const url = `${cfg.url}/wp-json/wc/v3/orders?per_page=100&page=${page}&orderby=date&order=asc&status=any&${st.back ? "after" : "modified_after"}=${encodeURIComponent(iso(st.since).replace("Z", ""))}`;
      const r = await getText(ctx, url, { headers: { Authorization: "Basic " + btoa(`${sec.key}:${sec.secret}`), Accept: "application/json" } });
      let j; try { j = JSON.parse(r.text); } catch { throw new Error("ردّ غير صالح من WooCommerce (تأكد أن الروابط الدائمة مفعّلة)"); }
      if (!Array.isArray(j)) throw new Error("ردّ غير متوقع من WooCommerce");
      for (const o of j) out.push(parseWoo(o));
      if (j.length < 100) { next = null; break; } page++; next = page;
    }
  } else {
    const url = cfg.csv_url || `https://docs.google.com/spreadsheets/d/${cfg.sheet_id}/export?format=csv&gid=${cfg.gid || "0"}`;
    const r = await getText(ctx, url, { headers: { Accept: "text/csv" } });
    if (r.text.length > SHEET_MAX_BYTES) throw new Error("الجدول كبير جداً (أكثر من 3MB)");
    if (/^\s*<(!doctype|html)/i.test(r.text)) throw new Error("الجدول غير عام: فعّل المشاركة «أي شخص لديه الرابط يمكنه العرض»");
    const pr = parseSheetRows(parseCsv(r.text), cfg); if (pr.missing.includes("phone")) throw new Error("لم أجد عمود الهاتف في الصف الأول — سمِّ العمود «الهاتف» أو «Téléphone» أو حدّده يدوياً");
    out.push(...pr.orders); next = null;
  }
  return { orders: out, next };
}

/* ───────── الخدمة: مزامنة مصدر ───────── */
async function upsert(ctx, src, orders) {
  const { db, vault } = ctx, tid = src.tenant_id; if (!orders.length) return { added: 0, changed: 0 };
  const have = new Map((await db.all("SELECT ext_id, sig FROM src_orders WHERE source_id=?", src.id)).map((r) => [r.ext_id, r.sig])), now = ctx.nowS(), stmts = []; let added = 0, changed = 0;
  for (const o of orders) {
    const sig = (await sha256Hex(JSON.stringify([o.status, o.raw_status, o.total, o.name, o.phone, o.address, o.city, o.wilaya, o.items]))).slice(0, 24), prev = have.get(o.ext_id);
    if (prev === sig) continue;
    const pii = vault ? await vault.encrypt({ phone: o.phone, address: o.address }, `src:${tid}`) : JSON.stringify({ phone: "", address: "" }), ph = o.phone ? await hmacHex(ctx.secret, "src:" + tid + ":" + (localPhone(o.phone) || o.phone)) : null;
    if (prev === undefined) { added++; stmts.push(["INSERT INTO src_orders (tenant_id,source_id,ext_id,number,created_at,status,raw_status,paid,name,pii_enc,phone_h,city,wilaya,items,total,currency,sig,imported,first_seen,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)",
      tid, src.id, o.ext_id, o.number, o.at ?? now, o.status, o.raw_status, o.paid ? 1 : 0, o.name, pii, ph, o.city, o.wilaya, JSON.stringify(o.items), o.total, o.currency, sig, now, now]); }
    else { changed++; stmts.push(["UPDATE src_orders SET number=?, status=?, raw_status=?, paid=?, name=?, pii_enc=?, phone_h=?, city=?, wilaya=?, items=?, total=?, currency=?, sig=?, updated_at=?" + (o.at ? ", created_at=?" : "") + " WHERE source_id=? AND ext_id=?",
      o.number, o.status, o.raw_status, o.paid ? 1 : 0, o.name, pii, ph, o.city, o.wilaya, JSON.stringify(o.items), o.total, o.currency, sig, now, ...(o.at ? [o.at] : []), src.id, o.ext_id]); }
  }
  await db.batch(stmts); return { added, changed };
}
/** يزامن مصدراً (حتى PAGES_PER_RUN صفحات). الحالة المستأنفة في src_sources.cursor. لا يرمي: يحفظ الخطأ في last_error */
export async function syncSource(ctx, src) {
  const { db, vault } = ctx, now = ctx.nowS(); let cfg, sec = {};
  try {
    cfg = JSON.parse(src.config || "{}"); if (src.secret_enc) { if (!vault) throw new Error("تخزين الأسرار غير مضبوط"); sec = await vault.decryptJson(src.secret_enc, `src:${src.tenant_id}:${src.id}`); }
    let st = {}; try { st = JSON.parse(src.cursor || "{}") || {}; } catch { st = {}; }
    if (!st.started) { st = { started: now, back: !src.last_ok_at, since: src.last_ok_at ? src.last_ok_at - 600 : now - (cfg.backfill_days ?? 30) * DAY, next: null }; }
    const r = await pull(ctx, src.kind, cfg, sec, st), u = await upsert(ctx, src, r.orders);
    const total = (await db.val("SELECT COUNT(*) FROM src_orders WHERE source_id=?", src.id)) ?? 0;
    if (r.next) await db.run("UPDATE src_sources SET cursor=?, last_sync_at=?, last_error=NULL, order_count=? WHERE id=?", JSON.stringify({ ...st, next: r.next }), now, total, src.id);
    else await db.run("UPDATE src_sources SET cursor=NULL, last_sync_at=?, last_ok_at=?, last_error=NULL, order_count=? WHERE id=?", now, st.started, total, src.id);
    return { ok: true, added: u.added, changed: u.changed, more: !!r.next };
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 200); await db.run("UPDATE src_sources SET last_sync_at=?, last_error=? WHERE id=?", now, msg, src.id);
    return { ok: false, error: msg, status: e?.status ?? null };
  }
}

/* ───────── المسارات ───────── */
const pub = (s) => { const c = JSON.parse(s.config || "{}"); return { id: s.id, kind: s.kind, name: s.name, status: s.status, config: c, has_secrets: !!s.secret_enc, last_sync_at: s.last_sync_at, last_ok_at: s.last_ok_at, last_error: s.last_error, order_count: s.order_count, syncing: !!s.cursor, created_at: s.created_at }; };
const likeEsc = (s) => s.replace(/[\\%_]/g, "\\$&");

export const sources = {
  id: "sources",
  routes(r, ctx) {
    const { db } = ctx;
    const own = async (tid, id) => { const s = await db.one("SELECT * FROM src_sources WHERE id=? AND tenant_id=?", +id, tid); if (!s) throw new HttpError(404, "not_found", "المصدر غير موجود"); return s; };
    r.get("/v1/sources", { scope: "sources:read", summary: "مصادر الطلبات المربوطة (Shopify/WooCommerce/Google Sheets) بحالة آخر مزامنة — بلا أسرار" }, async (req) =>
      ok({ kinds: KINDS, sources: (await db.all("SELECT * FROM src_sources WHERE tenant_id=? ORDER BY id", req.tenant.id)).map(pub) }));
    r.put("/v1/sources", { scope: "sources:write", limit: { key: "src", max: 30, win: 60 }, summary: "إضافة/تعديل مصدر: {id?, kind, name, config, secrets} — الأسرار مشفّرة ولا تُعرض بعد الحفظ" }, async (req) => {
      const b = req.json(), tid = req.tenant.id; let ex = null, exCfg = null;
      if (b.id !== undefined && b.id !== null) { ex = await own(tid, b.id); exCfg = JSON.parse(ex.config || "{}"); if (b.kind && b.kind !== ex.kind) throw new HttpError(400, "validation_error", "لا يمكن تغيير نوع المصدر"); }
      const kind = ex ? ex.kind : String(b.kind ?? ""), name = txt(b.name ?? ex?.name, 60);
      if (!name) throw new HttpError(400, "validation_error", "name مطلوب", { name: "اسم المتجر" });
      const { cfg, sec } = validateSource(kind, b.config && typeof b.config === "object" ? b.config : {}, b.secrets && typeof b.secrets === "object" ? b.secrets : {}, exCfg);
      if (!ex) {
        if (kind !== "gsheet" && !Object.keys(sec).length) throw new HttpError(400, "validation_error", "الأسرار مطلوبة", { secrets: kind === "shopify" ? "token" : "key,secret" });
        if (kind === "woocommerce" && !(sec.key && sec.secret)) throw new HttpError(400, "validation_error", "key و secret مطلوبان");
        if ((await db.val("SELECT COUNT(*) FROM src_sources WHERE tenant_id=?", tid)) >= MAX_SOURCES) throw new HttpError(409, "limit_reached", `الحد الأقصى ${MAX_SOURCES} مصادر`);
      }
      if (Object.keys(sec).length && !ctx.vault) throw new HttpError(503, "vault_unavailable", "تخزين الأسرار غير مضبوط في الخادم");
      if (req.mode !== "live") return ok({ ok: true, sandbox: true });
      let id;
      if (ex) {
        const merged = Object.keys(sec).length ? { ...(ex.secret_enc ? await ctx.vault.decryptJson(ex.secret_enc, `src:${tid}:${ex.id}`) : {}), ...sec } : null;
        const reset = JSON.stringify({ ...exCfg, ...{} }) !== JSON.stringify(cfg) || !!merged;       // تغيير الإعداد/الأسرار يعيد المزامنة من البداية
        await db.run("UPDATE src_sources SET name=?, config=?, " + (merged ? "secret_enc=?, " : "") + "status='active', last_error=NULL" + (reset ? ", cursor=NULL, last_ok_at=NULL" : "") + " WHERE id=?", name, JSON.stringify(cfg), ...(merged ? [await ctx.vault.encrypt(merged, `src:${tid}:${ex.id}`)] : []), ex.id); id = ex.id;
      } else {
        id = (await db.run("INSERT INTO src_sources (tenant_id,kind,name,config,status,created_at) VALUES (?,?,?,?,'active',?)", tid, kind, name, JSON.stringify(cfg), ctx.now())).id;
        if (Object.keys(sec).length) await db.run("UPDATE src_sources SET secret_enc=? WHERE id=?", await ctx.vault.encrypt(sec, `src:${tid}:${id}`), id);
      }
      await ctx.audit("tenant:" + tid, ex ? "source.update" : "source.add", id, { kind });
      return ok({ ok: true, id }, ex ? 200 : 201);
    });
    r.post("/v1/sources/:id/sync", { scope: "sources:write", limit: { key: "srcsync", max: 20, win: 60 }, summary: "مزامنة فورية لمصدر (حتى 5 صفحات؛ ويكمل cron الباقي)" }, async (req) => {
      const s = await own(req.tenant.id, req.params.id); if (req.mode !== "live") return ok({ ok: true, sandbox: true });
      const res = await syncSource(ctx, s); return ok({ ...res, source: pub(await db.one("SELECT * FROM src_sources WHERE id=?", s.id)) });
    });
    r.post("/v1/sources/:id/pause", { scope: "sources:write", summary: "إيقاف/استئناف المزامنة التلقائية {paused:boolean}" }, async (req) => {
      const s = await own(req.tenant.id, req.params.id); await db.run("UPDATE src_sources SET status=? WHERE id=?", req.json().paused === false ? "active" : "paused", s.id); return ok({ ok: true });
    });
    r.delete("/v1/sources/:id", { scope: "sources:write", summary: "فصل مصدر وحذف طلباته المخزَّنة هنا (متجر المصدر لا يتأثر)" }, async (req) => {
      const s = await own(req.tenant.id, req.params.id); await db.run("DELETE FROM src_orders WHERE source_id=?", s.id); await db.run("DELETE FROM src_sources WHERE id=?", s.id); await ctx.audit("tenant:" + req.tenant.id, "source.delete", s.id, { kind: s.kind }); return ok({ ok: true });
    });
    r.get("/v1/sources/orders", { scope: "sources:read", summary: "الطلبات الموحّدة من كل المصادر (الأحدث أولاً): source, status, q, since, until, limit, after=<ts.id>" }, async (req) => {
      const q = req.query, lim = clampLimit(q.limit, 50, 200), tid = req.tenant.id, a = [tid]; let sql = "FROM src_orders o JOIN src_sources s ON s.id=o.source_id WHERE o.tenant_id=?";
      if (q.source) { sql += " AND o.source_id=?"; a.push(+q.source || 0); }
      if (q.status) { sql += " AND o.status=?"; a.push(String(q.status)); }
      if (+q.since) { sql += " AND o.created_at>=?"; a.push(+q.since); } if (+q.until) { sql += " AND o.created_at<?"; a.push(+q.until); }
      if (q.q) {
        const t = String(q.q).trim().slice(0, 60), dig = latinDigits(t).replace(/\D/g, "");
        if (dig.length >= 8) { const p = localPhone(dig) || dig; sql += " AND o.phone_h=?"; a.push(await hmacHex(ctx.secret, "src:" + tid + ":" + p)); }
        else { sql += " AND (o.name LIKE ? ESCAPE '\\' OR o.number LIKE ? ESCAPE '\\' OR o.city LIKE ? ESCAPE '\\')"; const l = "%" + likeEsc(t) + "%"; a.push(l, l, l); }
      }
      const m = /^(\d{1,12})\.(\d{1,12})$/.exec(String(q.after ?? "")); if (m) { sql += " AND (o.created_at<? OR (o.created_at=? AND o.id<?))"; a.push(+m[1], +m[1], +m[2]); }
      const rows = await db.all("SELECT o.*, s.name AS source_name, s.kind AS source_kind " + sql + " ORDER BY o.created_at DESC, o.id DESC LIMIT ?", ...a, lim + 1), more = rows.length > lim, page = rows.slice(0, lim), out = [];
      for (const o of page) {
        let pii = { phone: "", address: "" }; try { if (ctx.vault) pii = await ctx.vault.decryptJson(o.pii_enc, `src:${tid}`); } catch { /* مفتاح تشفير قديم: يُعرض بلا بيانات شخصية */ }
        out.push({ id: o.id, source_id: o.source_id, source_name: o.source_name, kind: o.source_kind, ext_id: o.ext_id, number: o.number, created_at: o.created_at, status: o.status, raw_status: o.raw_status, paid: !!o.paid, name: o.name, phone: pii.phone, address: pii.address, city: o.city, wilaya: o.wilaya, items: JSON.parse(o.items || "[]"), total: o.total, currency: o.currency, imported: !!o.imported });
      }
      return ok({ orders: out, next: more ? `${page[page.length - 1].created_at}.${page[page.length - 1].id}` : null });
    });
    r.post("/v1/sources/orders/:id/imported", { scope: "sources:write", summary: "تعليم طلب موحّد بأنه نُقل إلى طلبات المتجر" }, async (req) => {
      const x = await db.run("UPDATE src_orders SET imported=? WHERE id=? AND tenant_id=?", req.json().imported === false ? 0 : 1, +req.params.id, req.tenant.id); if (!x.changes) throw new HttpError(404, "not_found", "الطلب غير موجود"); return ok({ ok: true });
    });
    r.get("/v1/sources/stats", { scope: "sources:read", summary: "أرقام اليوم/7 أيام/30 يوماً لكل مصدر + سلسلة يومية (tz بالدقائق، افتراضي 60)" }, async (req) => {
      const tid = req.tenant.id, off = (Number.isFinite(+req.query.tz) && req.query.tz !== "" ? +req.query.tz : 60) * 60, now = ctx.nowS(), today = Math.floor((now + off) / DAY) * DAY - off, w7 = today - 6 * DAY, w30 = today - 29 * DAY, dead = DEAD.map(() => "?").join(",");
      const per = await db.all(`SELECT source_id, currency, SUM(created_at>=?) n_today, SUM(CASE WHEN created_at>=? AND status NOT IN (${dead}) THEN total ELSE 0 END) t_today, SUM(created_at>=?) n_7, SUM(CASE WHEN created_at>=? AND status NOT IN (${dead}) THEN total ELSE 0 END) t_7, COUNT(*) n_30, SUM(CASE WHEN status NOT IN (${dead}) THEN total ELSE 0 END) t_30 FROM src_orders WHERE tenant_id=? AND created_at>=? GROUP BY source_id, currency`,
        today, today, ...DEAD, w7, w7, ...DEAD, ...DEAD, tid, w30);
      const st = await db.all("SELECT source_id, status, COUNT(*) n FROM src_orders WHERE tenant_id=? AND created_at>=? GROUP BY source_id, status", tid, w30);
      const series = await db.all(`SELECT date(created_at + ?, 'unixepoch') d, source_id, COUNT(*) n, SUM(CASE WHEN status NOT IN (${dead}) THEN total ELSE 0 END) t FROM src_orders WHERE tenant_id=? AND created_at>=? GROUP BY d, source_id ORDER BY d`, off, ...DEAD, tid, now - 14 * DAY - 86400);
      const srcs = await db.all("SELECT id,name,kind FROM src_sources WHERE tenant_id=?", tid), by = {};
      for (const s of srcs) by[s.id] = { id: s.id, name: s.name, kind: s.kind, windows: {}, statuses: {} };
      for (const p of per) if (by[p.source_id]) by[p.source_id].windows[p.currency] = { today: { n: p.n_today, total: p.t_today }, d7: { n: p.n_7, total: p.t_7 }, d30: { n: p.n_30, total: p.t_30 } };
      for (const x of st) if (by[x.source_id]) by[x.source_id].statuses[x.status] = x.n;
      return ok({ since_today: today, sources: Object.values(by), series });
    });
  },
  /** cron: يزامن المصادق النشطة المستحقة (3 كحد أقصى لكل نبضة) — ما فيه استئناف معلّق يُكمَل فوراً */
  async cron(ctx) {
    const now = ctx.nowS(), rows = await ctx.db.all("SELECT * FROM src_sources WHERE status='active' ORDER BY COALESCE(last_sync_at,0) ASC LIMIT 25"), due = [];
    for (const s of rows) { let iv = 5; try { iv = JSON.parse(s.config || "{}").interval_min ?? 5; } catch { /* افتراضي */ } if (s.cursor || !s.last_sync_at || now - s.last_sync_at >= iv * 60) due.push(s); if (due.length >= 3) break; }
    let synced = 0, failed = 0, added = 0; for (const s of due) { const r = await syncSource(ctx, s); synced++; if (!r.ok) failed++; else added += r.added; }
    return { synced, failed, added };
  },
};
