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
  function send(order, r, lines) {
    if (!on() || !r || !order) return;
    try {
      var body = { ref: r, customer: { name: order.name, phone: order.phone }, wilaya: order.wilaya, commune: order.commune, dtype: order.dtype, desk: order.desk || "",
        items: (lines || order.items || []).map(function (i) { return { slug: i.slug, vid: i.vid || "", qty: i.qty, price: i.price, title: i.title }; }),
        subtotal: order.subtotal, discount: order.discount || 0, fee: order.fee || 0, total: order.total, coupon: order.coupon || "" };
      fetch(C.PLATFORM_URL.replace(/\/$/, "") + "/v1/orders", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", Authorization: "Bearer " + C.PLATFORM_ORDER_KEY }, body: JSON.stringify(body) }).catch(function () { });
    } catch (e) { }
  }
  window.PFOrder = { prep: prep, send: send, on: on };
})();
