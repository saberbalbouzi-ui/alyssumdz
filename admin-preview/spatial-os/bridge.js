/* جسر المزامنة داخل إطار اللوحة الحقيقية (المرحلة 9). يُحقن من المعاينة الفضائية في كل إطار؛ لا يُعدَّل أي ملف إنتاج.
   وظيفتان فقط:
   1) رصد كتابات اللوحة الناجحة على الـAPI (fetch إلى api/index.php) وإرسال حدث مُنمَّط صغير إلى الأب بعد نجاح الخادم فقط؛
   2) تنفيذ أوامر تحديث موجَّهة من الأب (طلبات/منتجات/تحليلات) باستعمال دوال اللوحة نفسها (API.orders، Admin.freshData، renderXxx) دون تكرار أي منطق أعمال.
   لا بيانات زبائن في الأحداث (معرّفات وحالات وأسماء حقول فقط). كل رسالة تُرسَل إلى أصل الأب الصريح، وكل أمر يُقبل فقط من نافذة الأب وبنفس الأصل والمستأجر. */
(function () {
  "use strict";
  if (window.__spBridgeOn || window.parent === window) return; window.__spBridgeOn = 1;
  const W = window, ORIGIN = location.origin, V = 1, PARENT = W.parent;
  const hex = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.prototype.map.call(a, b => b.toString(16).padStart(2, "0")).join(""); };
  const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
  const ev = c => { try { return W.eval(c); } catch (_) { return null; } };
  const FIELDS = ["note", "name", "phone", "wilaya", "commune", "desk", "dtype", "items_text", "items", "fee", "total", "subtotal", "discount"];
  /* سياق المستأجر من إعداد التطبيق نفسه (HUB_SITE للمنصة المتعددة المستأجرين وإلا SITE) مربوطاً بالأصل؛ لا أسرار فيه */
  const tenant = () => { const c = ev('typeof CONFIG!=="undefined"?CONFIG:null'); return "t_" + fnv(ORIGIN + "|" + String((c && (c.HUB_SITE || c.SITE)) || "")); };
  const A = () => ev('typeof Admin!=="undefined"?Admin:null');
  const post = m => { try { PARENT.postMessage(m, ORIGIN); } catch (err) { console.error("spBridge post", String(err)); } };
  let quiet = 0, dirty = false, prev = {}, busy = false;
  const emit = (type, kind, id, rev, meta) => { if (Date.now() < quiet) return; post({ spatialHub: V, kind: "event", id: "ev_" + hex(10), type, resource: { kind, id: String(id).slice(0, 120) }, ts: Date.now(), rev: rev == null ? null : String(rev).slice(0, 64), tenant: tenant(), meta: meta || {} }); };
  const fail = (route, why) => post({ spatialHub: V, kind: "fail", id: "ev_" + hex(10), route: String(route || "").slice(0, 30), why: String(why).slice(0, 30), tenant: tenant(), ts: Date.now() });

  /* ───── مراقبة الكتابات الناجحة ───── */
  function describe(input, init) {
    const url = typeof input === "string" ? input : (input && input.url); if (!url) return null; const u = new URL(url, location.href);
    if (u.origin !== ORIGIN || !/\/api\/(index\.php)?$/.test(u.pathname)) return null;
    const m = String((init && init.method) || (input && input.method) || "GET").toUpperCase(); if (m === "GET" || m === "HEAD") return null;
    let body = null; try { if (init && typeof init.body === "string") body = JSON.parse(init.body); } catch (_) { }
    return { route: u.searchParams.get("r") || "", method: m, body };
  }
  function snap(list) { const m = {}; (list || []).forEach(p => { if (!p || !p.slug) return; const b = Object.assign({}, p); delete b.stock; if (Array.isArray(b.variations)) b.variations = b.variations.map(v => { const x = Object.assign({}, v); delete x.stock; return x; }); m[p.slug] = { b: fnv(JSON.stringify(b)), s: fnv(JSON.stringify([p.stock].concat((p.variations || []).map(v => v.stock)))) }; }); return m; }
  /* data.js تنسيقه ثابت من اللوحة: «var PRODUCTS = [json];» — يُقرأ كـJSON دون تنفيذ أي شيفرة */
  function productsOf(b64) { try { const txt = decodeURIComponent(escape(atob(String(b64).replace(/\s/g, "")))), i = txt.indexOf("var PRODUCTS = "); if (i < 0) return null; const j = txt.lastIndexOf(";"); const v = JSON.parse(txt.slice(i + 15, j)); return Array.isArray(v) ? v : null; } catch (_) { return null; } }
  function onWrite(d, j) {
    const b = d.body || {};
    if (d.route === "order_update") {
      if (!j || j.ok !== true || !b.id) return fail(d.route, "rejected");
      if (b.status === "confirmee") emit("order.confirmed", "order", b.id, null, { status: "confirmee", change: "status" });
      else if (b.status === "annulee") emit("order.cancelled", "order", b.id, null, { status: "annulee", change: "status" });
      else if (b.status) emit("order.updated", "order", b.id, null, { status: String(b.status), change: "status" });
      const f = Object.keys(b).filter(k => FIELDS.indexOf(k) >= 0); if (f.length) emit("order.updated", "order", b.id, null, { change: "fields", fields: f });
    } else if (d.route === "order_delete") {
      if (!j || j.ok !== true) return fail(d.route, "rejected"); emit("order.updated", "order", b.id || "?", null, { change: "deleted" });
    } else if (d.route === "order" && b.order && b.order.manual) {
      if (!j || j.ok !== true || !j.id) return fail(d.route, "rejected"); emit("order.created", "order", j.id, null, {});
    } else if (d.route === "file" && d.method === "PUT" && b.path === "assets/js/data.js") {
      const sha = j && j.content && j.content.sha; if (!sha) return fail(d.route, "rejected");
      const next = snap(productsOf(b.content)); dirty = false;
      Object.keys(next).forEach(s => { if (!prev[s]) emit("product.created", "product", s, sha, {}); else { if (prev[s].b !== next[s].b) emit("product.updated", "product", s, sha, {}); if (prev[s].s !== next[s].s) emit("inventory.updated", "product", s, sha, { stock: true }); } });
      Object.keys(prev).forEach(s => { if (!next[s]) emit("product.deleted", "product", s, sha, {}); });
      prev = next;
    }
  }
  const of = W.fetch.bind(W);
  W.fetch = function (input, init) {
    let d = null; try { d = describe(input, init); } catch (_) { }
    const pr = of(input, init); if (!d) return pr;
    pr.then(res => { if (!res.ok) return fail(d.route, "http" + res.status); res.clone().json().then(j => onWrite(d, j), () => onWrite(d, null)); }, () => fail(d.route, "network"));
    return pr;
  };
  document.addEventListener("input", e => { try { if (e.isTrusted && e.target.closest && e.target.closest("#tab-products,#tab-inventory")) dirty = true; } catch (_) { } }, true);

  /* ───── تنفيذ الأوامر (تحديث موجَّه بدوال اللوحة نفسها) ───── */
  const dg = (list, f) => fnv(JSON.stringify((list || []).map(f)));
  const dgO = l => dg(l, o => [o.id, o.status, o.note, o.total, o.name, o.wilaya, o.commune, o.items]);
  const vis = id => { const e = document.getElementById(id); return !!e && !e.classList.contains("hidden"); };
  async function refreshOrders(a) {
    const r = await ev("API").orders(a.key); if (!r || !r.ok) throw new Error("orders");
    const next = a.liveOrders(r.orders); if (dgO(next) === dgO(a.orders)) return { applied: false, n: next.length };
    a.orders = next; a.renderOrders(); try { a.renderStats(); } catch (_) { } try { if (vis("tab-inventory")) ev('typeof AdminInventory!=="undefined"?AdminInventory:null').render(); } catch (_) { } return { applied: true, n: next.length };
  }
  async function refreshProducts(a) {
    if (dirty) return { applied: false, deferred: true };
    const f = await a.freshData(); if (!f || !Array.isArray(f.p)) throw new Error("products");
    if (JSON.stringify(f.p) === JSON.stringify(a.products)) { prev = snap(a.products); return { applied: false, n: f.p.length }; }
    a.products = JSON.parse(JSON.stringify(f.p)); if (f.c) a.categories = JSON.parse(JSON.stringify(f.c)); prev = snap(a.products);
    try { a.renderProducts(); } catch (_) { } try { if (vis("tab-inventory")) ev('typeof AdminInventory!=="undefined"?AdminInventory:null').render(); } catch (_) { } try { a.renderStats(); } catch (_) { }
    return { applied: true, n: f.p.length };
  }
  async function run(cmd) {
    const a = A(); if (!a || !a.orders) throw new Error("not-ready"); const out = {}; const t0 = performance.now();
    for (const r of cmd.resources) {
      const t = performance.now();
      if (r === "orders") out.orders = await refreshOrders(a);
      else if (r === "products") out.products = await refreshProducts(a);
      else if (r === "analytics") { if (vis("tab-analytics")) { a.renderAnalytics(); out.analytics = { applied: true }; } else out.analytics = { applied: false }; }
      out[r].ms = Math.round(performance.now() - t);
    }
    out.ms = Math.round(performance.now() - t0); return out;
  }
  const RES = ["orders", "products", "analytics"];
  W.addEventListener("message", e => {
    if (e.source !== PARENT || e.origin !== ORIGIN) return; const d = e.data;
    if (!d || typeof d !== "object" || d.spatialHub !== V || d.kind !== "cmd" || typeof d.reqId !== "string" || d.reqId.length > 40) return;
    if (d.tenant !== tenant()) return post({ spatialHub: V, kind: "ack", reqId: d.reqId, ok: false, error: "tenant", tenant: tenant() });
    if (d.cmd === "ping") return post({ spatialHub: V, kind: "ack", reqId: d.reqId, ok: true, tenant: tenant(), results: {} });
    if (d.cmd !== "refresh" || !Array.isArray(d.resources) || d.resources.length > 3 || !d.resources.every(r => RES.indexOf(r) >= 0)) return post({ spatialHub: V, kind: "ack", reqId: d.reqId, ok: false, error: "bad-cmd", tenant: tenant() });
    if (busy) return post({ spatialHub: V, kind: "ack", reqId: d.reqId, ok: false, error: "busy", tenant: tenant() });
    busy = true; quiet = Date.now() + 6000; /* أحداث الكتابة أثناء التحديث لا تُصدَّر (يمنع الحلقات) */
    run(d).then(results => post({ spatialHub: V, kind: "ack", reqId: d.reqId, ok: true, tenant: tenant(), results }), err => post({ spatialHub: V, kind: "ack", reqId: d.reqId, ok: false, error: String(err && err.message || err).slice(0, 40), tenant: tenant() })).finally(() => { busy = false; quiet = Date.now() + 800; });
  });
  const a0 = A(); if (a0 && a0.products) prev = snap(a0.products);
  post({ spatialHub: V, kind: "hello", tenant: tenant(), ts: Date.now() });
})();
