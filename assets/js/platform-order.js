/* مرآة الطلب إلى منصة API (وضع المراقبة): بعد نجاح الطلب المعتاد يُرسَل نسخة منه ليتحقق الخادم من الأسعار والمخزون ويسجّل أي مخالفة.
   لا يغيّر مسار الطلب الحالي ولا يمنعه؛ يعمل فقط إن ضُبط CONFIG.PLATFORM_URL و CONFIG.PLATFORM_ORDER_KEY (مفتاح عام بنطاق order:create). */
(function () {
  "use strict";
  var C = (typeof CONFIG !== "undefined" && CONFIG) || {};
  function on() { return !!(C.PLATFORM_URL && C.PLATFORM_ORDER_KEY); }
  function ref() { return "W" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  /** قبل إرسال الطلب: يضع المرجع في extra فيصل الطلب إلى اللوحة بالمرجع نفسه. */
  function prep(order) { if (!on() || !order) return ""; var r = ref(); order.extra = order.extra || {}; order.extra["🔗 مرجع"] = r; return r; }
  /** بعد نجاح الطلب: lines = [{slug,vid,qty,price,title}] */
  function send(order, r, lines, meta) {
    if (!on() || !r || !order) return Promise.resolve(null);
    meta = meta || {};
    try {
      var body = { ref: r, customer: { name: order.name, phone: order.phone, email: meta.email || "" }, pay: meta.pay || "", wilaya: order.wilaya, commune: order.commune, dtype: order.dtype, desk: order.desk || "",
        items: (lines || order.items || []).map(function (i) { return { slug: i.slug, vid: i.vid || "", qty: i.qty, price: i.price, title: i.title }; }),
        subtotal: order.subtotal, discount: order.discount || 0, fee: order.fee || 0, total: order.total, coupon: order.coupon || "" };
      return fetch(C.PLATFORM_URL.replace(/\/$/, "") + "/v1/orders", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", Authorization: "Bearer " + C.PLATFORM_ORDER_KEY }, body: JSON.stringify(body) }).then(function (res) { return res.json().then(function (j) { var e = j && j.error; return { ok: res.status >= 200 && res.status < 300, status: res.status, verified: !!j.verified, ref: r, code: e && e.code, msg: e && e.code === "order_rejected" ? e.message : undefined }; }, function () { return { ok: res.ok, status: res.status, ref: r }; }); }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  var MSG = { supplier_unavailable: "هذا المنتج غير متاح حالياً لدى المورّد — جرّب لاحقاً", out_of_stock: "نفدت كمية هذا المنتج حالياً", price_too_low: "تعذّر إتمام الطلب بهذا السعر، حدّث الصفحة وأعد المحاولة", product_unavailable: "هذا المنتج لم يعد متاحاً", variant_unsupported: "هذا الخيار غير متاح لهذا المنتج", invalid_quantity: "الكمية غير صالحة" };
  /** منتج السوق (توريد عبر مورّد): فحص متزامن قبل قبول الطلب — تُحجز عمولته من رصيد المورّد وتُخصم كميته؛ يرفض بـ409 إن لم يتوفر. يعيد {ok, msg}. */
  function hold(order, r, lines, meta) {
    if (!on()) return Promise.resolve({ ok: false, msg: "الخدمة غير جاهزة، حاول لاحقاً" });
    meta = meta || {};
    var body = { ref: r, customer: { name: order.name, phone: order.phone, email: meta.email || "" }, wilaya: order.wilaya, commune: order.commune, dtype: order.dtype, desk: order.desk || "",
      items: (lines || order.items || []).map(function (i) { return { slug: i.slug, vid: i.vid || "", qty: i.qty, price: i.price, title: i.title }; }),
      subtotal: order.subtotal, discount: order.discount || 0, fee: order.fee || 0, total: order.total, coupon: order.coupon || "" };
    return fetch(C.PLATFORM_URL.replace(/\/$/, "") + "/v1/orders", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + C.PLATFORM_ORDER_KEY }, body: JSON.stringify(body) }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (res.status >= 200 && res.status < 300) return { ok: true };
        var code = j && j.error && j.error.code; return { ok: false, msg: MSG[code] || (j && j.error && j.error.message) || "تعذّر قبول الطلب الآن، حاول لاحقاً" };
      });
    }).catch(function () { return { ok: false, msg: "تعذّر الاتصال، حاول لاحقاً" }; });
  }
  window.PFOrder = { prep: prep, send: send, on: on, hold: hold };
})();
