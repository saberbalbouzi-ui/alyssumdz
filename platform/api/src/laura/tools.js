/* محرك أدوات LAURA — كل أداة تستدعي **مسار المنصة الحقيقي** عبر ctx.invoke بمفتاح الطالب نفسه (فتُطبَّق نطاقات المفتاح وحدوده كاملة؛ لا رفع صلاحية)،
   وتعيد بيانات الخادم مضغوطة (بلا هواتف ولا أسرار: تقليل ما يُرسَل لمزوّد النموذج). tier: read = ينفَّذ فوراً · write = يتطلب موافقة صريحة من المستخدم قبل التنفيذ.
   perm = صلاحية لوحة التاجر (admin-roles) اللازمة؛ scope = نطاق مفتاح المنصة اللازم. كلاهما يُفحص على الخادم عند العرض وعند التنفيذ.
   توسيع «إدارة المنصة»: أضِف أداة هنا بمسار حقيقي ونطاق وperm وtier؛ أي كتابة = tier:"write" + verify() إلزامية. */
export class ToolError extends Error { constructor(code, message) { super(message || code); this.code = code; } }
const short = (n) => { const t = String(n ?? "").replace(/[\u0000-\u001f]/g, " ").trim(); if (!t) return ""; const w = t.split(/\s+/); return (w[0].slice(0, 14) + (w[1] ? " " + w[1][0] + "." : "")); };   // اسم مختصر: الاسم الأول + حرف
const clip = (s, n) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const tsOf = (v) => { if (typeof v === "number") return v > 1e12 ? Math.floor(v / 1000) : v; const t = Date.parse(String(v ?? "").replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(v)) ? "" : "Z")); return Number.isFinite(t) ? Math.floor(t / 1000) : 0; };
const LIVE = (st) => !["annulee", "echec"].includes(st);                                           // طلب يُحتسب في المبيعات
async function must(r, what) {
  if (r.status === 401) throw new ToolError("unauthorized", "الجلسة/المفتاح غير صالح"); if (r.status === 403) throw new ToolError("forbidden", "لا تملك صلاحية: " + what);
  if (r.status === 429) throw new ToolError("rate_limited", "حدّ الطلبات مؤقتاً"); if (r.status >= 500) throw new ToolError("platform_error", "تعذّر الوصول للمنصة"); if (r.status < 200 || r.status >= 300) throw new ToolError("http_" + r.status, "رفضت المنصة الطلب");
  return r.json;
}
async function allOrders(h, { max = 400, status } = {}) {                                            // حتى 400 طلب (4 صفحات) — يُصرَّح بالاقتطاع
  const out = []; let after = 0, truncated = false;
  for (let i = 0; i < 4; i++) { const j = await must(await h.get("/v1/orders", { limit: 100, ...(after ? { after } : {}), ...(status ? { status } : {}) }), "orders"); out.push(...(j.orders || [])); if (!j.next) break; after = j.next; if (out.length >= max) { truncated = true; break; } if (i === 3) truncated = true; }
  return { orders: out, truncated };
}
const sinceFor = (p, now) => ({ today: now - (now % 86400), "7d": now - 7 * 86400, "30d": now - 30 * 86400, all: 0 }[p] ?? 0);
const STATUS_AR = { nouvelle: "جديدة", confirmee: "مؤكَّدة", livree: "مسلَّمة", echec: "فاشلة", annulee: "ملغاة" };

export const TOOLS = [
  { name: "orders_list", tier: "read", perm: "orders", scope: "orders:read", description: "قائمة آخر الطلبات (المرجع، الحالة، الاسم المختصر، الولاية، المبلغ، التاريخ). status اختياري: nouvelle|confirmee|livree|echec|annulee.",
    parameters: { type: "object", properties: { status: { type: "string", enum: ["nouvelle", "confirmee", "livree", "echec", "annulee"] }, limit: { type: "integer", minimum: 1, maximum: 25 } } },
    async run(a, h) { const j = await must(await h.get("/v1/orders", { limit: a.limit ?? 10, ...(a.status ? { status: a.status } : {}) }), "orders");
      return { count: (j.orders || []).length, orders: (j.orders || []).map((o) => ({ ref: o.ref, status: o.status, name: short(o.name), wilaya: clip(o.wilaya, 30), total: o.total, flagged: (o.flags || []).length > 0, at: o.created_at })), more: !!j.next }; } },
  { name: "orders_stats", tier: "read", perm: "orders", scope: "orders:read", description: "إجمالي الطلبات وقيمتها وعدد المخالِفة ووضع التحقق وحجوزات المخزون.", parameters: { type: "object", properties: {} },
    async run(a, h) { const j = await must(await h.get("/v1/orders/stats"), "orders"); return { orders: j.orders, flagged: j.flagged, total_value_dzd: j.value, mode: j.mode, holds: j.holds }; } },
  { name: "sales_summary", tier: "read", perm: "analytics", scope: "orders:read", description: "ملخص المبيعات لفترة (today|7d|30d|all): عدد الطلبات حسب الحالة والإيراد (دون الملغاة/الفاشلة) ومتوسط الطلب.",
    parameters: { type: "object", properties: { period: { type: "string", enum: ["today", "7d", "30d", "all"] } } },
    async run(a, h) { const per = a.period ?? "7d", now = h.now(), since = sinceFor(per, now), { orders, truncated } = await allOrders(h), by = {}; let rev = 0, n = 0;
      for (const o of orders) { if (tsOf(o.created_at) < since) continue; by[o.status] = (by[o.status] ?? 0) + 1; if (LIVE(o.status)) { rev += +o.total || 0; n++; } }
      const total = Object.values(by).reduce((x, y) => x + y, 0); return { period: per, orders: total, by_status: by, revenue_dzd: rev, avg_order_dzd: n ? Math.round(rev / n) : 0, truncated, note: truncated ? "اقتُطع التحليل لآخر 400 طلب" : undefined }; } },
  { name: "customers_top", tier: "read", perm: "customers", scope: "orders:read", description: "أكثر الزبائن طلباً (الاسم المختصر والولاية وعدد الطلبات والإجمالي) من الطلبات — بلا أرقام هواتف.",
    parameters: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 10 } } },
    async run(a, h) { const { orders, truncated } = await allOrders(h), m = new Map();
      for (const o of orders) { if (!LIVE(o.status)) continue; const k = String(o.phone || o.name); const e = m.get(k) ?? { name: short(o.name), wilaya: clip(o.wilaya, 30), orders: 0, total_dzd: 0 }; e.orders++; e.total_dzd += +o.total || 0; m.set(k, e); }
      return { customers: [...m.values()].sort((x, y) => y.orders - x.orders || y.total_dzd - x.total_dzd).slice(0, a.limit ?? 5), distinct: m.size, truncated }; } },
  { name: "products_list", tier: "read", perm: "products", scope: "catalog:read", description: "المنتجات (العنوان، الحالة، أقل سعر، مجموع المخزون). q للبحث بالعنوان، max_stock لإظهار ما مخزونه أقل أو يساوي القيمة (نقص المخزون).",
    parameters: { type: "object", properties: { q: { type: "string", maxLength: 60 }, max_stock: { type: "integer", minimum: 0, maximum: 100000 }, limit: { type: "integer", minimum: 1, maximum: 40 } } },
    async run(a, h) { const j = await must(await h.get("/v1/catalog/products", { limit: 100 }), "catalog"); let L = (j.products || []).map((p) => { const sk = (p.skus || []).filter((s) => s.active); const tracked = sk.filter((s) => s.stock != null); return { slug: p.slug, title: clip(p.title, 60), active: p.active, min_price_dzd: sk.length ? Math.min(...sk.map((s) => s.price)) : null, stock: tracked.length ? tracked.reduce((x, s) => x + (+s.stock || 0), 0) : null, variants: sk.length }; });
      if (a.q) L = L.filter((p) => p.title.toLowerCase().includes(a.q.toLowerCase()) || p.slug.includes(a.q.toLowerCase())); if (a.max_stock != null) L = L.filter((p) => p.stock != null && p.stock <= a.max_stock);
      return { count: L.length, products: L.slice(0, a.limit ?? 15) }; } },
  { name: "carts_summary", tier: "read", perm: "orders", scope: "carts:read", description: "السلال المتروكة: العدد حسب الحالة ونسبة الاسترداد وقيمة المفتوح.", parameters: { type: "object", properties: {} },
    async run(a, h) { const j = await must(await h.get("/v1/carts/stats"), "carts"); return { by_status: j.by, total: j.total, recovery_rate: j.recovery_rate }; } },
  { name: "settings_overview", tier: "read", perm: "*", scope: "modules:read", description: "إعدادات المنصة: الوحدات المفعّلة/المعطّلة والمزوّدون المربوطون (أسماؤهم فقط) وجدول رسوم التوصيل (للمالك فقط).", parameters: { type: "object", properties: {} },
    async run(a, h) { const m = await must(await h.get("/v1/modules"), "modules"); let ints = null, ship = null; try { const r = await h.get("/v1/integrations"); if (r.status === 200) ints = (r.json.integrations || []).map((x) => ({ provider: x.provider, has_secrets: !!x.hasSecrets })); } catch { /* اختياري */ }
      try { const r = await h.get("/v1/catalog/shipping"); if (r.status === 200) ship = { rates: r.json.rates, wilayas: r.json.wilayas }; } catch { /* اختياري */ }
      return { modules: (m.modules || []).map((x) => ({ id: x.id, enabled: x.enabled })), integrations: ints, shipping_table: ship }; } },
  /* ───── كتابة: موافقة صريحة قبل التنفيذ + تحقق بعده ───── */
  { name: "order_confirm", tier: "write", perm: "orders.write", scope: "events:write", description: "تأكيد طلب جديد بمرجعه (تغيير حالته إلى مؤكَّدة). يتطلب موافقة المستخدم.",
    parameters: { type: "object", properties: { ref: { type: "string", pattern: "^[A-Za-z0-9._:-]{1,80}$", maxLength: 80 } }, required: ["ref"] },
    describe: (a) => `تأكيد الطلب ${a.ref}`,
    async precheck(a, h) { const o = await findOrder(h, a.ref); if (!o) throw new ToolError("not_found", "لا يوجد طلب بهذا المرجع"); if (o.status === "confirmee") throw new ToolError("already_done", "الطلب مؤكَّد أصلاً"); if (!["nouvelle"].includes(o.status)) throw new ToolError("bad_state", "لا يمكن تأكيد طلب حالته: " + (STATUS_AR[o.status] || o.status)); return { before: o.status }; },
    async run(a, h, x) { const r = await h.post("/v1/events", { type: "order.confirmed", id: x.idem, data: { order_id: a.ref } }); await must(r, "events"); await h.flush(`order.confirmed:${x.idem}`); return { event: "order.confirmed", accepted: r.json.accepted !== false }; },
    async verify(a, h) { const o = await findOrder(h, a.ref); return { ok: !!o && o.status === "confirmee", now: o?.status ?? null }; } },
  { name: "order_cancel", tier: "write", perm: "orders.write", scope: "events:write", sensitive: true, description: "إلغاء طلب بمرجعه (حالة ملغاة وإرجاع حجز المخزون). عملية حساسة تتطلب موافقة المستخدم.",
    parameters: { type: "object", properties: { ref: { type: "string", pattern: "^[A-Za-z0-9._:-]{1,80}$", maxLength: 80 } }, required: ["ref"] },
    describe: (a) => `إلغاء الطلب ${a.ref} (لا رجعة عنه)`,
    async precheck(a, h) { const o = await findOrder(h, a.ref); if (!o) throw new ToolError("not_found", "لا يوجد طلب بهذا المرجع"); if (o.status === "annulee") throw new ToolError("already_done", "الطلب ملغى أصلاً"); if (o.status === "livree") throw new ToolError("bad_state", "طلب مسلَّم لا يُلغى"); return { before: o.status }; },
    async run(a, h, x) { const r = await h.post("/v1/events", { type: "order.cancelled", id: x.idem, data: { order_id: a.ref } }); await must(r, "events"); await h.flush(`order.cancelled:${x.idem}`); return { event: "order.cancelled", accepted: r.json.accepted !== false }; },
    async verify(a, h) { const o = await findOrder(h, a.ref); return { ok: !!o && o.status === "annulee", now: o?.status ?? null }; } },
];
async function findOrder(h, ref) { let after = 0; for (let i = 0; i < 5; i++) { const j = await must(await h.get("/v1/orders", { limit: 100, ...(after ? { after } : {}) }), "orders"); const o = (j.orders || []).find((x) => x.ref === ref); if (o) return o; if (!j.next) return null; after = j.next; } return null; }
export const toolByName = (n) => TOOLS.find((t) => t.name === n) ?? null;
/** الأدوات المتاحة لهذا الطالب: نطاق المفتاح AND صلاحية لوحة المستخدم */
export function visibleTools(scopes, actor, hasPerm) { return TOOLS.filter((t) => (scopes.includes("*") || scopes.includes(t.scope)) && hasPerm(actor, t.perm)); }
