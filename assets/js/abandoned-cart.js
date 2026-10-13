/* التقاط السلة المتروكة: بعد أن يكتب الزبون رقمه ويغادر الخانة، نرسل الرقم والمنتجات (بإشعار موافقة ظاهر) كي يتصل به المتجر.
   يعمل فقط إن ضُبط CONFIG.PLATFORM_URL و CONFIG.PLATFORM_CART_KEY (مفتاح عام بنطاق الالتقاط وحده). */
(function () {
  "use strict";
  var C = (typeof CONFIG !== "undefined" && CONFIG) || {};
  if (!C.PLATFORM_URL || !C.PLATFORM_CART_KEY) return;
  if (/admin(\.html)?$/.test(location.pathname)) return;
  var NOTICE = "بإدخال رقمك توافق على أن نتصل بك لإكمال طلبك. لن نشاركه مع أحد.";
  var last = "";
  function norm(v) { v = String(v || "").replace(/[\s\-.]/g, "").replace(/^\+?213/, "0"); return /^0[567]\d{8}$/.test(v) ? v : ""; }
  function esc(s) { return String(s == null ? "" : s); }
  function items(cartMode) {
    try {
      var out = [], P = (typeof PRODUCTS !== "undefined" && PRODUCTS) || [];
      if (cartMode && typeof Cart !== "undefined") {
        Cart.all().forEach(function (i) { var p = P.find(function (x) { return x.slug === i.slug; }) || {}; out.push({ id: i.slug, title: esc(p.title || i.slug), qty: i.qty, price: i.price }); });
      } else if (typeof currentProductSlugFromUrl === "function") {
        var s = currentProductSlugFromUrl(), p = P.find(function (x) { return x.slug === s; });
        if (p) { var q = document.getElementById("qty"); out.push({ id: p.slug, title: p.title, qty: q && +q.value > 0 ? +q.value : 1, price: p.price }); }
      }
      return out;
    } catch (e) { return []; }
  }
  function send(input) {
    var ph = norm(input.value); if (!ph) return;
    var it = items(input.id === "cphone"); if (!it.length) return;
    var name = (document.getElementById(input.id === "cphone" ? "cname" : "name") || {}).value || "";
    var body = { phone: ph, name: name, consent: true, items: it, page: location.pathname };
    var sig = JSON.stringify([ph, it]); if (sig === last) return; last = sig;
    try { fetch(C.PLATFORM_URL.replace(/\/$/, "") + "/v1/carts/capture", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", Authorization: "Bearer " + C.PLATFORM_CART_KEY }, body: JSON.stringify(body) }).catch(function () { }); } catch (e) { }
  }
  function bind() {
    ["phone", "cphone"].forEach(function (id) {
      var el = document.getElementById(id); if (!el || el.__ac) return; el.__ac = 1;
      var n = document.createElement("small"); n.textContent = NOTICE; n.style.cssText = "display:block;margin-top:4px;font-size:12px;opacity:.75;line-height:1.5";
      var host = el.closest("label") || el.parentNode; host.appendChild(n);
      el.addEventListener("blur", function () { send(el); });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
  setTimeout(bind, 2500);
})();
