/* بكسلات صفحات الهبوط (فيسبوك/تيك توك/GA4/إعلانات قوقل): تُحمَّل من «لوحة التحكم ← البكسلات» (assets/data/pixels.json) وتُطبَّق على الصفحة حسب النطاق:
   «كل الصفحات» أو المنتج الذي تبيعه الصفحة (data-prod) أو الصفحة نفسها (lp/<slug>). تُطلق PageView وViewContent، وتستقبل أحداث نموذج الطلب المضمَّن (Lead/InitiateCheckout/Purchase) من الإطار
   عبر postMessage فلا يُحصى الحدث مرتين (نموذج الإطار لا يحمّل البكسل نفسه إذا كانت الصفحة الأم تتولاه). تحتاج صفحات الهبوط القديمة إلى إعادة نشر لتحمل هذا السكربت. */
(function () {
  const me = document.currentScript, prod = (me && me.getAttribute("data-prod")) || "", page = (me && me.getAttribute("data-page")) || "";
  const base = me && me.src ? me.src.replace(/assets\/js\/lp-pixels\.js.*$/, "") : "";
  let pixels = [], ready = false; const q = [];
  window.__pbPx = true;
  function gtagBase(id) { if (window.__gtagBaseLoaded) return; window.__gtagBaseLoaded = true; const s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id); document.head.appendChild(s); window.dataLayer = window.dataLayer || []; window.gtag = window.gtag || function () { dataLayer.push(arguments); }; gtag("js", new Date()); }
  function inject(px) {
    if (px.platform === "facebook") {
      if (!window.fbq) { (function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js"); }
      fbq("init", px.pixelId); fbq("track", "PageView");
    } else if (px.platform === "tiktok") {
      if (!window.ttq) { (function (w, d, t) { w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || []; ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"]; ttq.setAndDefer = function (tq, e) { tq[e] = function () { tq.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; }; for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]); ttq.instance = function (t2) { for (var e = ttq._i[t2] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e; }; ttq.load = function (e, n) { var i = "https://analytics.tiktok.com/i18n/pixel/events.js"; ttq._i = ttq._i || {}, ttq._i[e] = [], ttq._i[e]._u = i, ttq._t = ttq._t || {}, ttq._t[e] = +new Date, ttq._o = ttq._o || {}, ttq._o[e] = n || {}; var o = d.createElement("script"); o.type = "text/javascript", o.async = !0, o.src = i + "?sdkid=" + e + "&lib=" + t; var a = d.getElementsByTagName("script")[0]; a.parentNode.insertBefore(o, a); }; })(window, document, "ttq"); }
      ttq.load(px.pixelId); ttq.page();
    } else if (px.platform === "ga4" || px.platform === "google_ads") { gtagBase(px.pixelId); gtag("config", px.pixelId); }
  }
  const EV = { ViewContent: { facebook: "ViewContent", tiktok: "ViewContent", ga4: "view_item" }, AddToCart: { facebook: "AddToCart", tiktok: "AddToCart", ga4: "add_to_cart" }, InitiateCheckout: { facebook: "InitiateCheckout", tiktok: "InitiateCheckout", ga4: "begin_checkout" }, Lead: { facebook: "Lead", tiktok: "SubmitForm", ga4: "generate_lead" } };
  function track(name, d) {
    if (!ready) { q.push([name, d]); return; } d = d || {}; const m = EV[name]; if (!m) return;
    pixels.forEach(px => { try { const cur = px.currency || "DZD", val = Number(d.value) || 0, qty = Number(d.qty) || 1;
      if (px.platform === "facebook" && window.fbq) fbq("track", m.facebook, { value: val, currency: cur, content_ids: d.slug ? [d.slug] : [], content_type: "product", contents: d.slug ? [{ id: d.slug, quantity: qty }] : [] });
      else if (px.platform === "tiktok" && window.ttq) ttq.track(m.tiktok, { value: val, currency: cur, content_id: d.slug || "", content_type: "product", quantity: qty });
      else if (px.platform === "ga4" && window.gtag) gtag("event", m.ga4, { value: val, currency: cur, items: d.slug ? [{ item_id: d.slug, item_name: d.title || d.slug, quantity: qty, price: val }] : [] }); } catch (e) { } });
  }
  function purchase(d) {
    if (!ready) { q.push(["Purchase", d]); return; } d = d || {};
    pixels.forEach(px => { try { const cur = px.currency || "DZD", total = Number(d.value) || 0, qty = Number(d.qty) || 1, slug = d.slug || prod;
      if (px.platform === "facebook" && window.fbq) fbq("track", "Purchase", { value: total, currency: cur, content_ids: [slug], content_type: "product", contents: [{ id: slug, quantity: qty }] });
      else if (px.platform === "tiktok" && window.ttq) ttq.track("CompletePayment", { value: total, currency: cur, content_id: slug, content_type: "product", quantity: qty });
      else if (px.platform === "google_ads" && window.gtag) gtag("event", "conversion", { send_to: px.pixelId + (px.conversionLabel ? "/" + px.conversionLabel : ""), value: total, currency: cur, transaction_id: String(d.orderId || Date.now()) });
      else if (px.platform === "ga4" && window.gtag) gtag("event", "purchase", { value: total, currency: cur, transaction_id: String(d.orderId || Date.now()), items: [{ item_id: slug, item_name: d.title || slug, quantity: qty, price: total }] }); } catch (e) { } });
  }
  const applies = px => px && px.active !== false && px.pixelId && (!px.scope || px.scope === "all" || (Array.isArray(px.scope) && ((prod && px.scope.includes(prod)) || (page && px.scope.includes("lp/" + page)))));
  window.addEventListener("message", e => { if (e.origin !== location.origin) return; const m = e.data && e.data.pbPx; if (!m || !m.name) return; if (m.name === "Purchase") purchase(m.d); else track(m.name, m.d); });
  fetch(base + "assets/data/pixels.json", { cache: "no-store" }).then(r => r.ok ? r.json() : []).catch(() => []).then(list => {
    pixels = (Array.isArray(list) ? list : []).filter(applies); pixels.forEach(px => { try { inject(px); } catch (e) { } }); ready = true;
    let pr = null; try { pr = (window.PRODUCTS || []).find(p => p.slug === prod) || null; } catch (e) { }
    const first = q.splice(0); if (!document.querySelector('iframe[src*="order-embed"]')) track("ViewContent", { slug: prod, title: pr && pr.title, value: pr ? Number(pr.price) || 0 : 0 });      /* مع نموذج مضمَّن يُمرّر الإطار ViewContent بنفسه (لا تكرار) */ first.forEach(x => x[0] === "Purchase" ? purchase(x[1]) : track(x[0], x[1]));
  });
})();
