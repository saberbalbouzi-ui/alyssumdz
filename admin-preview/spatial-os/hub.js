/* مركز أحداث الفضاء (Spatial OS Event Hub) — المرحلة 9. يعيش في الصفحة الأم فقط ويُنسّق ألواح الطلبات/المنتجات/المخزون/التحليلات/المساعد.
   المبادئ: (1) الـAPI الحالي هو المرجع الوحيد؛ الحدث «إشارة» لا «حقيقة» فيطلق تحديثاً موجَّهاً يقرأ من الخادم، لا تطبيقاً تفاؤلياً عبر الألواح.
   (2) لا يُقبل أي حدث إلا إن اجتاز: أصل مطابق، نافذة مصدر مسجَّلة، غلاف/نوع/مخطط صارم بلا مفاتيح زائدة، سياق مستأجر مطابق، عدم التكرار، حدّ المعدّل.
   (3) لا يُحدَّث إلا اللوح المعنيّ والمرئي؛ المصغَّر/المغلق يُعلَّم «قديماً» ويُحدَّث عند التنشيط. (4) لا حلقات: لا يُقبل حدث من لوح أثناء تحديثه، وحدّ معدّل لكل مصدر. */
(() => {
  "use strict";
  const V = 1, ORIGIN = location.origin, now = () => Date.now();
  const DEBOUNCE = 250, ACK_TIMEOUT = 8000, STALE_MS = 120000, SEEN_MAX = 500, RATE_N = 30, RATE_MS = 10000, MAX_RETRY = 2;
  /* ── العقود ── */
  const TYPE_RES = { /* نوع الحدث → المورد الذي يتغيّر */
    "order.created": "orders", "order.updated": "orders", "order.confirmed": "orders", "order.cancelled": "orders",
    "product.created": "products", "product.updated": "products", "product.deleted": "products", "inventory.updated": "products",
    "analytics.invalidate": "analytics",
  };
  const STATUS = ["nouvelle", "confirmee", "expediee", "livree", "annulee", "echec"], CHANGE = ["status", "fields", "deleted"];
  const FIELDS = ["note", "name", "phone", "wilaya", "commune", "desk", "dtype", "items_text", "items", "fee", "total", "subtotal", "discount"];
    /* اشتراكات الألواح: ما تعرضه كل لوحة (لا تُحدَّث لوحة بمورد لا تعرضه) */
  const SUBS = { ord: ["orders"], prod: ["products"], inv: ["products", "orders"], ana: ["orders", "products", "analytics"], ai: [] }; /* المخزون يعرض «في طلبات غير مسلَّمة» المشتقّ من الطلبات فيشترك فيها أيضاً */
  const ID_RE = /^[\p{L}\p{N}_.:\-]{1,120}$/u, EID_RE = /^ev_[a-f0-9]{8,40}$/, REQ_RE = /^rq_[a-f0-9]{8,30}$/, REV_RE = /^[\w.\-]{1,64}$/;
  const panels = new Map(), ver = { orders: 0, products: 0, analytics: 0 }, seen = new Map(), trace = [];
  const stats = { accepted: 0, dup: 0, rejected: {}, echoDropped: 0, rateLimited: 0, refreshes: 0, refreshOk: 0, refreshFail: 0, noop: 0, skippedHidden: 0, deferred: 0, reconciles: 0, bytes: 0 };
  let tenant = null, authAt = 0, authOk = false;
  const log = (k, o) => { trace.push(Object.assign({ t: now(), k }, o || {})); if (trace.length > 400) trace.shift(); };
  const reject = (why, o) => { stats.rejected[why] = (stats.rejected[why] || 0) + 1; log("reject", Object.assign({ why }, o || {})); };
  const plain = v => v && typeof v === "object" && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
  const keysOnly = (o, ok) => Object.keys(o).every(k => ok.indexOf(k) >= 0) && !Object.prototype.hasOwnProperty.call(o, "__proto__");
  const hex = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.prototype.map.call(a, b => b.toString(16).padStart(2, "0")).join(""); };

  /* ── التحقق من حدث ── */
  function validEvent(d) {
    if (!plain(d) || !keysOnly(d, ["spatialHub", "kind", "id", "type", "resource", "ts", "rev", "tenant", "meta"])) return "shape";
    if (d.spatialHub !== V || d.kind !== "event") return "envelope";
    if (typeof d.id !== "string" || !EID_RE.test(d.id)) return "id";
    if (typeof d.type !== "string" || !Object.prototype.hasOwnProperty.call(TYPE_RES, d.type)) return "type";
    if (!plain(d.resource) || !keysOnly(d.resource, ["kind", "id"]) || ["order", "product", "analytics"].indexOf(d.resource.kind) < 0 || typeof d.resource.id !== "string" || !ID_RE.test(d.resource.id)) return "resource";
    if ((d.type.indexOf("order.") === 0) !== (d.resource.kind === "order") || (/^(product|inventory)\./.test(d.type)) !== (d.resource.kind === "product")) return "resource-type";
    if (typeof d.ts !== "number" || !isFinite(d.ts) || Math.abs(now() - d.ts) > 10 * 60 * 1000) return "ts";
    if (d.rev !== null && (typeof d.rev !== "string" || !REV_RE.test(d.rev))) return "rev";
    if (typeof d.tenant !== "string" || !/^t_[a-z0-9]{1,16}$/.test(d.tenant)) return "tenant-format";
    if (!plain(d.meta) || !keysOnly(d.meta, ["status", "change", "fields", "stock"])) return "meta";
    const m = d.meta;
    if ("status" in m && STATUS.indexOf(m.status) < 0) return "meta-status";
    if ("change" in m && CHANGE.indexOf(m.change) < 0) return "meta-change";
    if ("fields" in m && (!Array.isArray(m.fields) || m.fields.length > 13 || !m.fields.every(f => FIELDS.indexOf(f) >= 0))) return "meta-fields";
    if ("stock" in m && m.stock !== true) return "meta-stock";
    return null;
  }

  /* ── إدارة الألواح ── */
  const get = id => panels.get(id);
  const byWindow = w => { for (const p of panels.values()) if (p.win && p.win === w && p.el && p.el.isConnected) return p; return null; };
  function attach(id, win, el) {
    let p = panels.get(id); if (!p) { p = { id, synced: { orders: ver.orders, products: ver.products, analytics: ver.analytics }, pending: new Set(), timer: 0, refreshing: false, again: false, retry: 0, ready: false, vis: true, lastSync: now(), seq: 0, rate: [], events: 0, degraded: false, req: null, followTimer: 0 }; panels.set(id, p); }
    p.win = win; p.el = el; p.ready = false; p.mountVer = Object.assign({}, ver); p.refreshing = false; p.req = null; paint(p); log("attach", { id }); return p;
  }
  /* إعادة تحميل الإطار (تحديث/استرداد): يُعلَّم غير جاهز حتى يعود «hello»، وما فاته أثناء التحميل يُعلَّم قديماً فيُفحص مرة واحدة */
  function reload(id) { const p = get(id); if (!p) return; clearTimeout(p.ackT); p.ready = false; p.refreshing = false; p.req = null; p.mountVer = Object.assign({}, p.synced); log("reload", { id }); paint(p); }
  function detach(id) { const p = panels.get(id); if (!p) return; clearTimeout(p.timer); clearTimeout(p.followTimer); panels.delete(id); log("detach", { id }); }
  function setVisible(id, v) { const p = get(id); if (!p) return; p.vis = !!v; paint(p); if (v) activate(id); }
  const stale = p => (SUBS[p.id] || []).filter(r => ver[r] > p.synced[r]);
  function paint(p) { if (!p.el) return; const s = stale(p).length ? "stale" : p.degraded ? "degraded" : p.refreshing ? "refreshing" : p.ready ? "synced" : "loading"; if (p.el.dataset.sync !== s) p.el.dataset.sync = s; p.el.dataset.syncAt = String(p.lastSync); }

  /* ── تحقق الجلسة (يُخزَّن 60ث): لا أحداث من جلسة غير مصادَق عليها ── */
  async function authed() {
    if (now() - authAt < 60000) return authOk; authAt = now();
    try { const r = await fetch("../../api/index.php?r=me", { credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest" }, cache: "no-store" }); const j = await r.json(); authOk = !!(j && (j.admin || j.role)); } catch (_) { authOk = false; }
    return authOk;
  }

  /* ── استقبال الرسائل ── */
  addEventListener("message", e => {
    if (e.origin !== ORIGIN) return reject("origin", { origin: String(e.origin).slice(0, 60) });
    const p = byWindow(e.source); if (!p) return reject("source");
    const d = e.data; if (!plain(d) || d.spatialHub !== V || typeof d.kind !== "string") return reject("envelope", { id: p.id });
    stats.bytes += (() => { try { return JSON.stringify(d).length; } catch (_) { return 0; } })();
    try { if (JSON.stringify(d).length > 1200) return reject("size", { id: p.id }); } catch (_) { return reject("unserializable", { id: p.id }); }
    if (d.kind === "hello") return onHello(p, d);
    if (d.kind === "ack") return onAck(p, d);
    if (d.kind === "fail") return onFail(p, d);
    if (d.kind === "event") return onEvent(p, d);
    reject("kind", { id: p.id });
  });
  async function onHello(p, d) {
    if (typeof d.tenant !== "string" || !/^t_[a-z0-9]{1,16}$/.test(d.tenant)) return reject("tenant-format", { id: p.id });
    if (!(await authed())) return reject("unauthenticated", { id: p.id });
    if (tenant === null) { tenant = d.tenant; log("tenant.pin", { tenant }); } /* يُثبَّت من أول لوح مصادَق عليه بالتطبيق الحالي؛ كل ما بعده يجب أن يطابقه */
    if (d.tenant !== tenant) return reject("tenant", { id: p.id });
    p.ready = true; p.degraded = false; p.lastSync = now();
    /* عودة بعد إعادة تحميل: ما فاتها أثناء التحميل يُعلَّم قديماً */
    ["orders", "products", "analytics"].forEach(r => { p.synced[r] = Math.min(p.synced[r], (p.mountVer || ver)[r]); });
    log("hello", { id: p.id, stale: stale(p) }); paint(p); if (stale(p).length) schedule(p, "recover");
  }
  function onFail(p, d) {
    if (!p.ready || d.tenant !== tenant) return reject("tenant", { id: p.id });
    log("write.failed", { id: p.id, route: d.route, why: d.why });
    /* فشل كتابة: لا حدث لبقية الألواح؛ يُعاد اللوح المصدر إلى حقيقة الخادم (قد تكون حالته المحلية تفاؤلية) */
    if (/^order/.test(String(d.route))) { stats.reconciles++; p.synced.orders = -1; schedule(p, "reconcile", ["orders"]); }
    else if (d.route === "file") { stats.reconciles++; p.synced.products = -1; schedule(p, "reconcile", ["products"]); }
  }
  function onEvent(p, d) {
    const why = validEvent(d); if (why) return reject(why, { id: p.id });
    if (!p.ready) return reject("not-ready", { id: p.id });
    if (d.tenant !== tenant) return reject("tenant", { id: p.id, got: d.tenant });
    if (seen.has(d.id)) { stats.dup++; return log("dup", { id: d.id }); }
    seen.set(d.id, now()); if (seen.size > SEEN_MAX) seen.delete(seen.keys().next().value);
    if (p.refreshing) { stats.echoDropped++; return log("echo", { id: d.id, src: p.id }); }
    const t = now(); p.rate = p.rate.filter(x => t - x < RATE_MS); if (p.rate.length >= RATE_N) { stats.rateLimited++; return log("rate", { src: p.id }); } p.rate.push(t);
    p.events++; stats.accepted++; apply(p, d);
  }

  /* ── سياسة المزامنة ── */
  function apply(src, d) {
    const res = TYPE_RES[d.type]; ver[res]++; /* كل نوع يرفع نسخة موردِه فقط؛ التحليلات تتبع الطلبات والمنتجات باشتراك لا بإعادة جلب إضافية */
    if (res !== "analytics") { /* اللوح المصدر نفّذ الكتابة فبياناته الأساسية حديثة */ src.synced[res] = ver[res]; src.lastSync = now(); }
    log("accept", { type: d.type, res: d.resource.id, src: src.id, ver: Object.assign({}, ver) });
    panels.forEach(p => { if (p !== src || res === "analytics") if (stale(p).length) schedule(p, "event"); });
    /* لا «فحص متأخر» تخميني للمخزون: حركة المخزون تُنفَّذ بمنطق اللوحة نفسه وتُكتب في data.js فتصدر كحدث inventory.updated من اللوح المصدر بعد نجاح الخادم */
    paintAll();
  }
  const paintAll = () => panels.forEach(paint);
  function schedule(p, why, only) {
    const want = only ? only.slice() : stale(p);
    want.forEach(r => p.pending.add(r)); if (!p.pending.size) return;
    clearTimeout(p.timer); p.timer = setTimeout(() => run(p, why), why === "activate" || why === "recover" ? 20 : DEBOUNCE); paint(p);
  }
  function live(p) { return p.ready && p.vis && p.win && p.el && p.el.isConnected && p.el.style.display !== "none"; }
  function run(p, why) {
    if (!p.pending.size) return;
    if (!live(p)) { stats.skippedHidden++; log("skip.hidden", { id: p.id, why }); return; } /* المصغَّر/المغلق: يبقى قديماً ويُحدَّث عند التنشيط */
    if (p.refreshing) { p.again = true; return; }
    /* ترجمة الموارد إلى أوامر الجسر: ana تعرض التحليلات المبنية على الطلبات/المنتجات */
    let res = [...p.pending]; p.pending.clear();
    if (p.id === "ana") { const need = res.slice(); res = []; if (need.indexOf("orders") >= 0 || need.indexOf("analytics") >= 0) res.push("orders"); /* «analytics» الصريح (إبطال) = فحص بصمة الطلبات ثم إعادة العرض */ if (need.indexOf("products") >= 0) res.push("products"); res.push("analytics"); }
    const at = Object.assign({}, ver), reqId = "rq_" + hex(8); p.refreshing = true; p.req = { reqId, at, res, why, t0: performance.now(), t: now() }; stats.refreshes++; paint(p);
    log("refresh.start", { id: p.id, res, why }); p.win.postMessage({ spatialHub: V, kind: "cmd", cmd: "refresh", reqId, resources: res, tenant, reason: why }, ORIGIN);
    p.ackT = setTimeout(() => ackFail(p, reqId, "timeout"), ACK_TIMEOUT);
  }
  function ackFail(p, reqId, error) {
    if (!p.req || p.req.reqId !== reqId) return; clearTimeout(p.ackT); const rq = p.req; p.req = null; p.refreshing = false; stats.refreshFail++; log("refresh.fail", { id: p.id, error });
    rq.res.forEach(r => p.pending.add(r));
    if (error === "busy") { p.timer = setTimeout(() => run(p, "retry"), 600); return; }
    if (p.retry++ < MAX_RETRY) p.timer = setTimeout(() => run(p, "retry"), 1000 * Math.pow(3, p.retry - 1)); else { p.degraded = true; p.retry = 0; log("degraded", { id: p.id }); }
    paint(p);
  }
  function onAck(p, d) {
    if (!p.req || typeof d.reqId !== "string" || !REQ_RE.test(d.reqId) || p.req.reqId !== d.reqId) return reject("ack-unknown", { id: p.id });
    if (d.tenant !== tenant) return reject("tenant", { id: p.id });
    const rq = p.req; clearTimeout(p.ackT);
    if (!d.ok) return ackFail(p, d.reqId, String(d.error || "error"));
    p.req = null; p.refreshing = false; p.retry = 0; p.degraded = false; p.lastSync = now(); stats.refreshOk++;
    const r = d.results || {}; let applied = 0, deferred = false;
    ["orders", "products", "analytics"].forEach(k => { if (r[k] && r[k].applied) applied++; if (r[k] && r[k].deferred) deferred = true; });
    if (!applied) stats.noop++; if (deferred) stats.deferred++;
    if (!deferred) { ["orders", "products", "analytics"].forEach(k => { if ((rq.at[k] || 0) > p.synced[k] || p.synced[k] < 0) p.synced[k] = rq.at[k] || 0; }); }
    log("refresh.done", { id: p.id, ms: Math.round(performance.now() - rq.t0), bridgeMs: r.ms, applied, deferred, res: rq.res });
    paint(p); if (p.again || stale(p).length || p.pending.size) { p.again = false; schedule(p, "event"); }
  }
  /* تنشيط لوح (استعادة من تصغير/تركيز/بعد إعادة تحميل): يُحدَّث فقط إن كان قديماً أو مضى عليه زمن طويل (فحص موجَّه بمقارنة بصمة الخادم) */
  function activate(id) {
    const p = get(id); if (!p || !p.ready || !live(p)) return;
    let want = stale(p); if (!want.length && now() - p.lastSync > STALE_MS) want = (SUBS[p.id] || []).filter(r => r !== "analytics"), p.ageCheck = true;
    if (want.length) { log("activate", { id, want }); schedule(p, "activate", want); }
  }
  addEventListener("pageshow", () => panels.forEach(p => { if (p.vis) activate(p.id); }));
  const api = {
    attach, detach, reload, setVisible, activate, version: V,
    stats: () => JSON.parse(JSON.stringify(stats)), versions: () => Object.assign({}, ver), trace: () => trace.slice(),
    state: id => { const p = get(id); return p ? { ready: p.ready, vis: p.vis, refreshing: p.refreshing, stale: stale(p), synced: Object.assign({}, p.synced), degraded: p.degraded, events: p.events, lastSync: p.lastSync, sync: p.el && p.el.dataset.sync } : null; },
    tenant: () => tenant, ids: () => [...panels.keys()], SUBS,
    /* للاختبار: يُرسل أمراً مباشراً (يمرّ عبر نفس المسار) */
    _reset() { stats.accepted = stats.dup = stats.echoDropped = stats.rateLimited = stats.refreshes = stats.refreshOk = stats.refreshFail = stats.noop = stats.skippedHidden = stats.deferred = stats.reconciles = stats.bytes = 0; stats.rejected = {}; trace.length = 0; },
  };
  Object.freeze(api); window.SpatialHub = api;
})();
