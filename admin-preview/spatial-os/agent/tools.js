/* سجل أدوات الوكيل (المرحلة 10) — أدوات حقيقية فقط تستدعي واجهات المنصة الموجودة وتعيد بيانات الخادم كما هي.
   - القراءة: GET api/index.php?r=orders | r=file&path=assets/js/data.js | r=file&path=assets/data/inventory.json | r=kv&k=guard|stockcfg | r=me
   - الواجهة: لوحة الطلبات الفضائية عبر مدير الألواح (SpatialOS) وضوابطها الحقيقية (#order-filter-*, Admin.applyOrderFilters, Admin.openOrderPreview)
   - الكتابة (واحدة فقط): orders.confirm عبر منطق لوحة الطلبات نفسه (Admin.confirmOrder: حركة المخزون والإشعارات…) ثم تحقّق من الخادم؛ لا يُكرَّر أي منطق أعمال هنا.
   كل أداة لها مخطط مُتحقَّق منه (لا مفاتيح زائدة)، وصلاحية مطلوبة، ودرجة خطورة. الصلاحية الحقيقية يفرضها الخادم (الجلسة)؛ الفحص هنا لتجربة المستخدم ولعدم إرسال ما سيُرفض.
   لا مستأجر ولا رمز ولا هوية تأتي من النموذج أو الإطار: كل الطلبات same-origin بجلسة المستخدم. */
(() => {
  "use strict";
  const BASE = "../../api/index.php?r=", sleep = ms => new Promise(r => setTimeout(r, ms));
  class ToolError extends Error { constructor(code, message, extra) { super(message || code); this.code = code; this.extra = extra || {}; } }
  const until = async (fn, ms = 15000, step = 200) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch (_) { } await sleep(step); } return null; };

  /* ── عميل الخادم: نفس الأصل وجلسة المستخدم، مهلة، تصنيف أخطاء ── */
  async function call(route, o) {
    o = o || {}; const ac = new AbortController(), t = setTimeout(() => ac.abort(), o.timeout || 10000); let res;
    try { res = await fetch(BASE + route + (o.query || ""), { method: o.method || "GET", credentials: "same-origin", cache: "no-store", signal: ac.signal, headers: Object.assign({ "X-Requested-With": "XMLHttpRequest" }, o.body ? { "Content-Type": "application/json" } : {}), body: o.body ? JSON.stringify(o.body) : undefined }); }
    catch (e) { throw new ToolError(ac.signal.aborted ? "timeout" : "network", ac.signal.aborted ? "انتهت مهلة الخادم" : "تعذّر الاتصال بالخادم"); } finally { clearTimeout(t); }
    let j = null; try { j = await res.json(); } catch (_) { j = null; }
    if (res.status === 401) throw new ToolError("unauthorized", "الجلسة غير صالحة — سجّل الدخول");
    if (res.status === 403) throw new ToolError("forbidden", "ليست لديك صلاحية لهذه العملية");
    if (!res.ok) throw new ToolError("http_" + res.status, "رفض الخادم الطلب (" + res.status + ")");
    if (j === null || typeof j !== "object") throw new ToolError("bad_response", "ردّ الخادم غير صالح");
    return j;
  }
  async function getMe() { const j = await call("me"); const perms = Array.isArray(j.perms) ? j.perms.map(String) : []; return { admin: !!j.admin, role: String(j.role || ""), perms, authed: !!(j.admin || j.role), name: String(j.name || "") }; }
  /* مرحلة 12: الخادم يعيد آخر 2000 طلب كحد أقصى؛ نعلّم القائمة بذلك كي لا تُعرض أعداد ناقصة كأنها كاملة */
  const ORDERS_WINDOW = 2000;
  async function getOrders() { const j = await call("orders"); if (!j.ok || !Array.isArray(j.orders)) throw new ToolError("bad_response", "ردّ الطلبات غير صالح"); if (j.orders.length >= ORDERS_WINDOW) j.orders.truncated = true; return j.orders; }
  const winOf = all => all && all.truncated ? all.length : 0;
  async function getFile(path) { const j = await call("file", { query: "&path=" + encodeURIComponent(path) }); if (typeof j.content !== "string") throw new ToolError("bad_response", "ملف غير صالح"); try { return decodeURIComponent(escape(atob(j.content.replace(/\s/g, "")))); } catch (_) { throw new ToolError("bad_response", "ترميز الملف غير صالح"); } }
  async function getProducts() { const txt = await getFile("assets/js/data.js"), i = txt.indexOf("var PRODUCTS = "); if (i < 0) throw new ToolError("bad_response", "تنسيق المنتجات غير معروف"); try { const v = JSON.parse(txt.slice(i + 15, txt.lastIndexOf(";"))); if (!Array.isArray(v)) throw 0; return v; } catch (_) { throw new ToolError("bad_response", "تعذّرت قراءة المنتجات"); } }
  async function getKv(k) { const j = await call("kv", { query: "&k=" + encodeURIComponent(k) }); return j.v == null ? null : j.v; }

  /* ── مخططات: مدقّق مصغّر (type/enum/طول/نمط/حدود/required/لا مفاتيح زائدة) ── */
  function validate(schema, v) {
    if (!schema || schema.type !== "object") return { ok: false, error: "schema" };
    if (v == null) v = {}; if (typeof v !== "object" || Array.isArray(v)) return { ok: false, error: "args-not-object" };
    const props = schema.properties || {}, out = {};
    for (const k of Object.keys(v)) { if (!Object.prototype.hasOwnProperty.call(props, k)) return { ok: false, error: "unknown-arg:" + String(k).slice(0, 20) }; }
    for (const k of Object.keys(props)) {
      const p = props[k], x = v[k]; if (x === undefined) { if ((schema.required || []).includes(k)) return { ok: false, error: "missing:" + k }; continue; }
      if (p.type === "string") { if (typeof x !== "string") return { ok: false, error: "type:" + k }; if (p.maxLength != null && x.length > p.maxLength) return { ok: false, error: "too-long:" + k }; if (p.minLength != null && x.length < p.minLength) return { ok: false, error: "too-short:" + k }; if (p.pattern && !new RegExp(p.pattern, "u").test(x)) return { ok: false, error: "pattern:" + k }; if (p.enum && !p.enum.includes(x)) return { ok: false, error: "enum:" + k }; }
      else if (p.type === "integer") { if (!Number.isInteger(x)) return { ok: false, error: "type:" + k }; if (p.minimum != null && x < p.minimum) return { ok: false, error: "min:" + k }; if (p.maximum != null && x > p.maximum) return { ok: false, error: "max:" + k }; }
      else if (p.type === "boolean") { if (typeof x !== "boolean") return { ok: false, error: "type:" + k }; }
      else return { ok: false, error: "schema-type:" + k };
      out[k] = x;
    }
    return { ok: true, value: out };
  }
  const STATUSES = ["nouvelle", "confirmee", "expediee", "livree", "annulee", "echec"], PERIODS = ["today", "yesterday", "week", "month", "all"];
  const ID_RE = "^[A-Z]{1,3}\\d{4,8}-[A-Z0-9]{3,8}$|^[A-Za-z0-9_\\-]{4,40}$", SLUG_RE = "^[\\p{L}\\p{N}_.\\-]{1,80}$";
  const norm = s => String(s == null ? "" : s).toLowerCase().normalize("NFKD").replace(/[ً-ٰٟـ̀-ͯ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/\s+/g, " ").trim();

  /* ── مساعدات بيانات ── */
  const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  function inPeriod(iso, period, now) {
    if (period === "all" || !period) return true; const t = new Date(iso), n = now || new Date(); if (isNaN(t)) return false; const s = startOfDay(n);
    if (period === "today") return t >= s && t < new Date(+s + 864e5);
    if (period === "yesterday") return t >= new Date(+s - 864e5) && t < s;
    if (period === "week") return t >= new Date(+s - 6 * 864e5) && t < new Date(+s + 864e5);
    if (period === "month") return t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth();
    return true;
  }
  const VALID = o => o.status !== "annulee" && o.status !== "echec"; /* تعريف اللوحة للمبيعات غير الملغاة */
  const lines = o => String(o.items || "").split("\n").map(l => { const m = /^(.+?)\s*[×x]\s*(\d+)\s*=\s*(\d+)\s*DA/.exec(l.trim()); return m ? { title: m[1].trim(), qty: +m[2], rev: +m[3] } : null; });
  const brief = o => ({ id: o.id, status: o.status, total: Number(o.total) || 0, date: o.date, name: o.name, wilaya: o.wilaya, items: String(o.items || "").split("\n").slice(0, 2).join(" · ") });
  const maskPhone = p => { p = String(p || ""); return p.length > 4 ? p.slice(0, 2) + "*".repeat(Math.max(2, p.length - 4)) + p.slice(-2) : "****"; };
  function filterOrders(list, a, now) {
    let r = list.filter(o => (!a.status || o.status === a.status) && inPeriod(o.date, a.period, now));
    if (a.wilaya) { const w = norm(a.wilaya); r = r.filter(o => norm(o.wilaya) === w); }
    if (a.q) { const q = norm(a.q); r = r.filter(o => norm(o.name + " " + o.id + " " + o.items).includes(q)); }
    return r;
  }

  /* ── لوحات فضائية: مدير الألواح الموجود فقط ── */
  const Hub = () => (typeof SpatialHub !== "undefined" ? SpatialHub : null);
  async function ensurePanel(id, ms) {
    if (typeof SpatialOS === "undefined" || !SpatialOS.real) throw new ToolError("no_spatial", "الواجهة الحقيقية غير مفعّلة");
    const q0 = SpatialOS.panels.get(id); if (!q0 || q0.min) SpatialOS.open(id);
    const q = await until(() => { const x = SpatialOS.panels.get(id); return x && x.frDone && !x.min ? x : null; }, ms || 60000, 150);
    if (!q) throw new ToolError("panel_timeout", "تأخّر تحميل اللوح"); return q;
  }
  /* يُنفّذ دالة داخل نافذة إطار اللوحة (نفس الأصل) ويعيد نتيجتها؛ الدوال المحقونة ثابتة المصدر هنا لا من نص خارجي */
  const fx = (q, fn, arg) => q.fr.contentWindow.eval("(" + fn.toString() + ")")(arg);

  /* تحديث لوح الطلبات عبر المركز؛ جسر اللوح يتجاهل أحداث الكتابة لنحو 0.8ث بعد كل تحديث (منع الحلقات) فيُنتظَر قبل أي كتابة */
  let lastRef = 0; const refreshOrd = async () => { const H = Hub(); if (!H) return null; const r = await H.refreshNow("ord", ["orders"]).catch(() => null); lastRef = Date.now(); return r; };
  const REG = new Map(), def = (name, spec) => REG.set(name, Object.freeze(Object.assign({ name }, spec)));
  const O_STAT = { type: "string", enum: STATUSES }, O_PER = { type: "string", enum: PERIODS };
  const pb = p => ({ slug: p.slug, title: p.title, price: p.price, old: p.old || null, stock: p.stock == null ? null : p.stock, active: p.active !== false, cat: p.cat || "", offers: (p.offers || []).map(o => ({ qty: o.qty, price: o.price })), variations: Array.isArray(p.variations) ? p.variations.length : 0 });

  def("sales.summary", { risk: "read", perms: ["orders"], title: { ar: "ملخّص المبيعات", fr: "Résumé des ventes", en: "Sales summary" }, endpoint: "GET orders", desc: "يحسب من طلبات الخادم الفعلية: عدد الطلبات، المبيعات غير الملغاة (تعريف اللوحة)، التوزيع بالحالة.",
    schema: { type: "object", properties: { period: O_PER }, additionalProperties: false },
    async run(a) {
      const all = await getOrders(), now = new Date(), per = a.period || "today", sel = all.filter(o => inPeriod(o.date, per, now)), valid = sel.filter(VALID), by = {}; STATUSES.forEach(s => by[s] = 0); sel.forEach(o => { by[o.status] = (by[o.status] || 0) + 1; });
      const revenue = valid.reduce((s, o) => s + (Number(o.total) || 0), 0), delivered = sel.filter(o => o.status === "livree").reduce((s, o) => s + (Number(o.total) || 0), 0);
      /* تقدير (يُصنَّف «تقدير» في الواجهة): متوسط مبيعات الأيام السابقة التي فيها طلبات (حتى 7) */
      let est = null; if (per === "today") { const days = []; for (let i = 1; i <= 7; i++) { const d = new Date(+startOfDay(now) - i * 864e5), ds = all.filter(o => VALID(o) && startOfDay(o.date).getTime() === d.getTime()); if (ds.length) days.push(ds.reduce((s, o) => s + (Number(o.total) || 0), 0)); } if (days.length >= 2) est = { avgDailyRevenue: Math.round(days.reduce((x, y) => x + y, 0) / days.length), days: days.length }; }
      return { period: per, orders: sel.length, validOrders: valid.length, revenue, delivered, byStatus: by, pending: by.nouvelle, estimate: est, total: all.length, window: winOf(all) };
    } });
  def("sales.top_product", { risk: "read", perms: ["orders"], title: { ar: "المنتج الأكثر مبيعاً", fr: "Produit le plus vendu", en: "Best-selling product" }, endpoint: "GET orders", desc: "يجمع بنود الطلبات غير الملغاة من الخادم حسب المنتج (الكمية والإيراد).",
    schema: { type: "object", properties: { period: O_PER, by: { type: "string", enum: ["qty", "revenue"] } }, additionalProperties: false },
    async run(a) {
      const all = await getOrders(), now = new Date(), sel = all.filter(o => VALID(o) && inPeriod(o.date, a.period || "all", now)), m = new Map(); let unparsed = 0;
      sel.forEach(o => lines(o).forEach(l => { if (!l) { unparsed++; return; } const k = norm(l.title), e = m.get(k) || { title: l.title, qty: 0, revenue: 0, orders: new Set() }; e.qty += l.qty; e.revenue += l.rev; e.orders.add(o.id); m.set(k, e); }));
      const by = a.by || "qty", rows = [...m.values()].map(e => ({ title: e.title, qty: e.qty, revenue: e.revenue, orders: e.orders.size })).sort((x, y) => y[by] - x[by] || y.qty - x.qty);
      return { period: a.period || "all", by, top: rows.slice(0, 3), count: rows.length, ordersCounted: sel.length, unparsed, window: winOf(all) };
    } });
  def("orders.list", { risk: "read", perms: ["orders"], title: { ar: "عرض الطلبات", fr: "Afficher les commandes", en: "List orders" }, endpoint: "GET orders", desc: "يقرأ الطلبات من الخادم ويصفّيها (حالة/ولاية/بحث/فترة). لا هواتف في النتائج.",
    schema: { type: "object", properties: { status: O_STAT, wilaya: { type: "string", maxLength: 40 }, q: { type: "string", maxLength: 60 }, period: O_PER, limit: { type: "integer", minimum: 1, maximum: 50 } }, additionalProperties: false },
    async run(a) { const all = await getOrders(), r = filterOrders(all, a, new Date()), lim = a.limit || 20; return { count: r.length, shown: Math.min(lim, r.length), items: r.slice(0, lim).map(brief), filter: a, total: all.length, window: winOf(all) }; } });
  def("orders.get", { risk: "read", perms: ["orders"], title: { ar: "تفاصيل طلب", fr: "Détails d'une commande", en: "Order details" }, endpoint: "GET orders", desc: "تفاصيل طلب بمعرّفه؛ الهاتف مقنَّع ما لم تكن مخوَّلاً بـ«العملاء».",
    schema: { type: "object", properties: { id: { type: "string", pattern: ID_RE } }, required: ["id"], additionalProperties: false },
    async run(a, c) { const o = (await getOrders()).find(x => x.id === a.id); if (!o) throw new ToolError("not_found", "لا يوجد طلب بهذا المعرّف"); const full = c.can("customers"); return Object.assign(brief(o), { phone: full ? o.phone : maskPhone(o.phone), phoneMasked: !full, commune: o.commune, fee: o.fee, subtotal: o.subtotal }); } });
  def("products.search", { risk: "read", perms: [], owner: true, title: { ar: "البحث عن منتج", fr: "Chercher un produit", en: "Search products" }, endpoint: "GET file?path=assets/js/data.js", desc: "بحث في منتجات المتجر الفعلية (data.js).",
    schema: { type: "object", properties: { q: { type: "string", maxLength: 60 } }, additionalProperties: false },
    async run(a) { const P = await getProducts(), q = norm(a.q || ""), r = (q ? P.filter(p => norm(p.title + " " + p.slug + " " + (p.desc || "")).includes(q)) : P).slice(0, 8); return { count: r.length, total: P.length, items: r.map(pb) }; } });
  def("products.get", { risk: "read", perms: [], owner: true, title: { ar: "تفاصيل منتج", fr: "Détails d'un produit", en: "Product details" }, endpoint: "GET file?path=assets/js/data.js", desc: "تفاصيل منتج بمعرّفه من data.js الفعلي.",
    schema: { type: "object", properties: { slug: { type: "string", pattern: SLUG_RE } }, required: ["slug"], additionalProperties: false },
    async run(a) { const p = (await getProducts()).find(x => x.slug === a.slug); if (!p) throw new ToolError("not_found", "لا يوجد منتج بهذا المعرّف"); return pb(p); } });
  def("inventory.read", { risk: "read", perms: [], owner: true, title: { ar: "قراءة المخزون", fr: "Lire le stock", en: "Read stock" }, endpoint: "GET file?path=assets/js/data.js + assets/data/inventory.json", desc: "مخزون المنتجات (أو منتج واحد، أو المنخفض فقط) مع عتبة التنبيه من inventory.json إن وُجدت.",
    schema: { type: "object", properties: { slug: { type: "string", pattern: SLUG_RE }, low: { type: "boolean" } }, additionalProperties: false },
    async run(a) {
      const P = await getProducts(); let low = 5, lowKnown = false; try { const j = JSON.parse(await getFile("assets/data/inventory.json")); if (Number.isFinite(+j.low)) { low = +j.low; lowKnown = true; } } catch (_) { }
      const rows = []; P.forEach(p => { const vs = Array.isArray(p.variations) && p.variations.length ? p.variations : null; if (vs) vs.forEach(v => rows.push({ slug: p.slug, title: p.title + " — " + Object.values(v.attrs || {}).join(" / "), stock: v.stock == null ? null : v.stock })); else rows.push({ slug: p.slug, title: p.title, stock: p.stock == null ? null : p.stock }); });
      const state = r => r.stock == null ? "untracked" : r.stock <= 0 ? "out" : r.stock <= low ? "low" : "ok";
      let sel = rows; if (a.slug) { sel = rows.filter(r => r.slug === a.slug); if (!sel.length) throw new ToolError("not_found", "لا يوجد منتج بهذا المعرّف"); } else if (a.low) sel = rows.filter(r => ["low", "out"].includes(state(r)));
      return { threshold: low, thresholdConfigured: lowKnown, items: sel.map(r => Object.assign({}, r, { state: state(r) })).slice(0, 30), counts: { tracked: rows.filter(r => r.stock != null).length, low: rows.filter(r => state(r) === "low").length, out: rows.filter(r => state(r) === "out").length, untracked: rows.filter(r => r.stock == null).length }, filter: a };
    } });
  def("customers.find", { risk: "read", perms: ["customers"], title: { ar: "طلبات زبون", fr: "Commandes d'un client", en: "Customer orders" }, endpoint: "GET orders", desc: "طلبات زبون (اسم/هاتف) من الخادم؛ لا يعمل إلا لمن يملك صلاحية «العملاء».",
    schema: { type: "object", properties: { q: { type: "string", minLength: 2, maxLength: 60 } }, required: ["q"], additionalProperties: false },
    async run(a) { const q = norm(a.q), digits = a.q.replace(/\D/g, ""), r = (await getOrders()).filter(o => norm(o.name).includes(q) || (digits.length >= 6 && String(o.phone).replace(/\D/g, "").includes(digits))); return { count: r.length, spent: r.filter(VALID).reduce((s, o) => s + (Number(o.total) || 0), 0), items: r.slice(0, 20).map(brief) }; } });
  def("settings.read", { risk: "read", perms: [], owner: true, title: { ar: "قراءة إعداد", fr: "Lire un réglage", en: "Read a setting" }, endpoint: "GET kv?k=guard|stockcfg", desc: "إعدادات للقراءة فقط: حماية الطلبات (guard) وإعداد المخزون (stock).",
    schema: { type: "object", properties: { key: { type: "string", enum: ["guard", "stock"] } }, required: ["key"], additionalProperties: false },
    async run(a) { const v = await getKv(a.key === "guard" ? "guard" : "stockcfg"); return { key: a.key, value: a.key === "guard" ? { antibot: !!(v && v.antibot), dup: !!(v && v.dup), phoneDz: v ? v.phoneDz !== false : true } : { since: (v && v.since) || null }, configured: v != null }; } });

  /* ── أدوات الواجهة (مدير الألواح الفضائي الموجود) ── */
  def("ui.open_panel", { risk: "ui", perms: [], title: { ar: "فتح لوحة", fr: "Ouvrir un panneau", en: "Open a panel" }, endpoint: "SpatialOS.open", desc: "يفتح لوحاً حقيقياً عبر مدير الألواح.",
    schema: { type: "object", properties: { panel: { type: "string", enum: ["ord", "prod", "inv", "ana"] } }, required: ["panel"], additionalProperties: false },
    async run(a) { const q = await ensurePanel(a.panel); SpatialOS.open(a.panel); return { panel: a.panel, ready: !!q.frDone }; } });
  def("ui.filter_orders", { risk: "ui", perms: ["orders"], title: { ar: "تصفية لوح الطلبات", fr: "Filtrer le panneau des commandes", en: "Filter the Orders panel" }, endpoint: "SpatialOS.open + Admin.applyOrderFilters", desc: "يفتح لوح الطلبات ويطبّق مرشّحاته الحقيقية (الحالة/الولاية/البحث) ثم يقارن عدد الصفوف بالخادم.",
    schema: { type: "object", properties: { status: O_STAT, wilaya: { type: "string", maxLength: 40 }, q: { type: "string", maxLength: 60 } }, additionalProperties: false },
    async run(a) {
      const q = await ensurePanel("ord"); SpatialOS.open("ord"); await refreshOrd();
      const res = fx(q, f => { const A = Admin, g = id => document.getElementById(id); if (A.resetOrderFilters) A.resetOrderFilters(); if (f.status) g("order-filter-status").value = f.status; if (f.wilaya) { const w = g("order-filter-wilaya"); const o = [...w.options].find(x => x.value === f.wilaya || x.textContent.indexOf(f.wilaya) >= 0); if (o) w.value = o.value; } if (f.q) g("order-filter-q").value = f.q; A.applyOrderFilters(); const pv = g("ord-prev-bg"); if (pv) pv.classList.remove("open"); return { status: g("order-filter-status").value, q: g("order-filter-q").value, wilaya: g("order-filter-wilaya").value }; }, a);
      await sleep(250); const rows = fx(q, () => document.querySelectorAll("#orders-table tr").length - 1), expected = filterOrders(await getOrders(), a, null).length;
      return { applied: res, rows, expected, match: rows === expected, filter: a };
    } });
  def("ui.show_order", { risk: "ui", perms: ["orders"], title: { ar: "عرض طلب في اللوح", fr: "Montrer une commande", en: "Show an order" }, endpoint: "SpatialOS.open + Admin.openOrderPreview", desc: "يفتح معاينة الطلب الحقيقية داخل لوح الطلبات (فيصير «هذا الطلب» في السياق).",
    schema: { type: "object", properties: { id: { type: "string", pattern: ID_RE } }, required: ["id"], additionalProperties: false },
    async run(a) {
      const q = await ensurePanel("ord"); SpatialOS.open("ord"); await refreshOrd();
      const ok = fx(q, id => { const A = Admin, i = A.orders.findIndex(x => x.id === id); if (i < 0) return false; A.openOrderPreview(i); return true; }, a.id); if (!ok) throw new ToolError("not_in_panel", "الطلب غير موجود في لوح الطلبات الحالي");
      await sleep(300); const shown = fx(q, id => { const m = document.getElementById("ord-prev-bg"); return !!m && m.classList.contains("open") && m.innerText.indexOf(id) >= 0; }, a.id); return { id: a.id, shown };
    } });
  def("ui.current_order", { risk: "ui", perms: ["orders"], title: { ar: "الطلب المفتوح في اللوح", fr: "Commande ouverte dans le panneau", en: "Order open in the panel" }, endpoint: "قراءة معاينة لوح الطلبات (#ord-prev-bg)", desc: "يقرأ معرّف الطلب المفتوح في معاينة لوح الطلبات إن وُجد (لتفسير «هذا الطلب»)؛ لا يمنح أي صلاحية: المعرّف يُتحقَّق منه من الخادم ويُعرض للموافقة.",
    schema: { type: "object", properties: {}, additionalProperties: false },
    async run() { if (typeof SpatialOS === "undefined" || !SpatialOS.real) return { id: null }; const q = SpatialOS.panels.get("ord"); if (!q || !q.frDone || q.min) return { id: null }; const id = fx(q, () => { const m = document.getElementById("ord-prev-bg"); return m && m.classList.contains("open") && m.dataset.oid ? String(m.dataset.oid) : null; }); return { id: id && /^[A-Za-z0-9_\-]{4,40}$/.test(id) ? id : null }; } });
  def("analytics.refresh", { risk: "ui", perms: ["orders"], title: { ar: "تحديث التحليلات", fr: "Actualiser les analyses", en: "Refresh analytics" }, endpoint: "GET orders + Hub analytics.invalidate", desc: "يتحقق من أن الخادم يردّ بالطلبات ثم ينشر analytics.invalidate عبر مركز الأحداث.",
    schema: { type: "object", properties: {}, additionalProperties: false },
    async run(a, c) { const n = (await getOrders()).length; if (!c.publish) throw new ToolError("no_publish", "لا قدرة نشر"); const r = c.publish({ type: "analytics.invalidate", resource: { kind: "analytics", id: "all" } }); if (!r.ok) throw new ToolError("publish_failed", "رفض المركز الحدث: " + r.why); return { orders: n, eventId: r.id }; } });

  /* ── الكتابة الوحيدة: تأكيد طلب ── */
  def("orders.confirm", { risk: "write", perms: ["orders", "orders.write"], title: { ar: "تأكيد طلب", fr: "Confirmer une commande", en: "Confirm an order" }, endpoint: "POST order_update {id,status:confirmee} (عبر Admin.confirmOrder)",
    desc: "يؤكد طلباً في انتظار التأكيد عبر منطق لوح الطلبات الحقيقي بعد موافقة صريحة، ثم يتحقق من حالته في الخادم. يُحجَب إن كان الإرسال التلقائي لشركة التوصيل سيُطلَق أو المخزون لا يكفي.",
    schema: { type: "object", properties: { id: { type: "string", pattern: ID_RE } }, required: ["id"], additionalProperties: false },
    /* تحضير بلا أي كتابة: قراءة الخادم + فحص الخطر عبر اللوح */
    async prepare(a) {
      const o = (await getOrders()).find(x => x.id === a.id); if (!o) throw new ToolError("not_found", "لا يوجد طلب بهذا المعرّف");
      if (o.status !== "nouvelle") throw new ToolError("bad_state", "الطلب ليس في انتظار التأكيد (حالته الحالية: " + o.status + ")", { status: o.status });
      const q = await ensurePanel("ord"); await refreshOrd();
      const risk = fx(q, id => { const A = Admin, o = A.orders.find(x => x.id === id); if (!o) return { missing: true }; let ship = false, stock = null; try { ship = !!(A.autoOpt("send") && A.orderCompanyKey(o) && !A.isBlacklisted(o.phone)); } catch (e) { ship = null; } try { stock = window.StockCheck ? !!StockCheck.directOf(o) : false; } catch (e) { stock = null; } return { ship, stock }; }, a.id);
      if (risk.missing) throw new ToolError("not_in_panel", "الطلب غير ظاهر في لوح الطلبات؛ حدّث اللوح ثم أعد المحاولة");
      if (risk.ship === null || risk.stock === null) throw new ToolError("risk_unknown", "تعذّر فحص المخاطر (إرسال تلقائي/مخزون)؛ لن أؤكد");
      if (risk.ship) throw new ToolError("blocked_high_impact", "التأكيد سيُطلق إرسالاً تلقائياً إلى شركة التوصيل (أثر خارجي) — لا أنفّذه في هذه المرحلة؛ أكّده من اللوحة يدوياً", { reason: "auto_send" });
      if (risk.stock) throw new ToolError("blocked_stock", "المخزون الحالي لا يكفي لهذا الطلب — يتطلب قراراً بشرياً في اللوحة", { reason: "stock" });
      return { order: brief(o), summary: { id: o.id, name: o.name, total: o.total, items: brief(o).items, from: "nouvelle", to: "confirmee" } };
    },
    async run(a, c) {
      const q = await ensurePanel("ord"), H = Hub(), t0 = performance.now(); { const w = 1100 - (Date.now() - lastRef); if (w > 0) await sleep(w); }
      const exp = H ? H.expect({ types: ["order.confirmed"], resource: a.id, timeout: 20000 }) : null;
      const sent = fx(q, id => { const A = Admin, i = A.orders.findIndex(x => x.id === id); if (i < 0 || A.orders[i].status !== "nouvelle") return false; A.confirmOrder(i); return true; }, a.id);
      if (!sent) { if (exp) exp.cancel(); throw new ToolError("not_in_panel", "تعذّر تنفيذ الأمر داخل لوح الطلبات"); }
      /* التحقق: حالة الخادم الفعلية فقط */
      const srv = await until(async () => { const o = (await getOrders()).find(x => x.id === a.id); return o && o.status === "confirmee" ? o : null; }, 15000, 400);
      if (!srv) { if (exp) exp.cancel(); await refreshOrd(); /* يعيد اللوح إلى حقيقة الخادم إن غيّر نفسه محلياً قبل الرفض */ const cur = (await getOrders().catch(() => [])).find(x => x.id === a.id); throw new ToolError("not_confirmed", "لم يؤكد الخادم الطلب (الحالة الحالية: " + (cur ? cur.status : "؟") + ") — لم يتغيّر شيء", { status: cur && cur.status }); }
      /* الحدث يصدر من جسر اللوح بعد نجاح الخادم؛ إن لم يصل خلال 4ث والخادم مؤكِّد يُنشره الوكيل عبر نفس المركز */
      let ev = null, via = "panel-bridge";
      if (exp) { try { ev = await Promise.race([exp.promise, sleep(4000).then(() => { throw new Error("t"); })]); } catch (_) { exp.cancel(); if (c.publish) { const r = c.publish({ type: "order.confirmed", resource: { kind: "order", id: a.id }, meta: { status: "confirmee", change: "status" } }); if (r.ok) { ev = { id: r.id, type: "order.confirmed" }; via = "agent"; } } } }
      const settle = H ? await H.settle(15000) : { ok: false }, panels = {}; if (H) H.ids().forEach(id => { const s = H.state(id); panels[id] = s ? s.sync : null; });
      const shown = fx(q, id => { const o = Admin.orders.find(x => x.id === id); return o ? o.status : null; }, a.id);
      return { id: a.id, server: { status: srv.status }, event: ev ? { id: ev.id, type: ev.type, via } : null, settle, panels, orderPanelStatus: shown, ms: Math.round(performance.now() - t0) };
    } });

  window.AgentTools = Object.freeze({
    registry: () => [...REG.values()].map(t => ({ name: t.name, title: t.title, desc: t.desc, risk: t.risk, perms: t.perms, owner: !!t.owner, endpoint: t.endpoint, schema: t.schema })),
    get: n => REG.get(n) || null, validate, getMe, getOrders, getProducts, filterOrders, inPeriod, norm, ToolError, until, sleep, ensurePanel, fx, maskPhone, brief, version: 1,
  });
})();
