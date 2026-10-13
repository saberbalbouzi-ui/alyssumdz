/* دبوس الموقع على الخريطة (اختياري) في نموذج الطلب وسلة الشراء: خريطة OpenStreetMap عبر Leaflet تُحمَّل فقط عند الضغط على الزر.
   يُحفظ الموقع في extra["📍 الموقع"] كرابط خريطة فيصل الموزّع أسرع. الموقع بيانات شخصية: لا يُطلب إلا بنقرة الزبون ومع إشعار موافقة. */
(function () {
  "use strict";
  var LEAFLET = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/";
  var S = { lat: null, lng: null, map: null, mk: null, loading: null };
  function link() { return S.lat == null ? "" : "https://maps.google.com/?q=" + S.lat.toFixed(6) + "," + S.lng.toFixed(6); }
  function load() {
    if (window.L && window.L.map) return Promise.resolve();
    if (S.loading) return S.loading;
    S.loading = new Promise(function (ok, bad) {
      var c = document.createElement("link"); c.rel = "stylesheet"; c.href = LEAFLET + "leaflet.min.css"; document.head.appendChild(c);
      var s = document.createElement("script"); s.src = LEAFLET + "leaflet.min.js"; s.onload = ok; s.onerror = function () { S.loading = null; bad(new Error("map")); }; document.head.appendChild(s);
    });
    return S.loading;
  }
  function set(ui, lat, lng, zoom) {
    S.lat = lat; S.lng = lng; var L = window.L;
    if (!S.mk) { S.mk = L.marker([lat, lng], { draggable: true }).addTo(S.map); S.mk.on("dragend", function () { var p = S.mk.getLatLng(); set(ui, p.lat, p.lng); }); } else S.mk.setLatLng([lat, lng]);
    if (zoom) S.map.setView([lat, lng], zoom);
    ui.st.textContent = "✓ تم تحديد الموقع"; ui.rm.hidden = false;
  }
  function build(host) {
    var w = document.createElement("div"); w.className = "gp"; w.style.cssText = "margin:.6rem 0";
    w.innerHTML = '<button type="button" class="gp-open" style="width:100%;padding:.7rem;border-radius:12px;font:inherit;font-weight:800;cursor:pointer;color:inherit;background:rgba(127,127,127,.12);border:1px dashed rgba(127,127,127,.5)">📍 حدّد موقعك على الخريطة (اختياري — يسهّل وصول الموزّع)</button>' +
      '<div class="gp-box" hidden style="margin-top:.5rem"><div class="gp-map" style="height:240px;border-radius:12px;overflow:hidden;border:1px solid rgba(127,127,127,.4)"></div>' +
      '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.4rem;align-items:center"><button type="button" class="gp-me" style="padding:.45rem .8rem;border-radius:10px;font:inherit;font-weight:700;cursor:pointer">📡 حدّد موقعي</button><button type="button" class="gp-rm" hidden style="padding:.45rem .8rem;border-radius:10px;font:inherit;cursor:pointer">إزالة</button><span class="gp-st" style="font-size:.85rem"></span></div>' +
      '<small style="display:block;opacity:.7;margin-top:.3rem;line-height:1.5">اضغط على الخريطة أو اسحب الدبوس. بتحديد موقعك توافق على مشاركته مع المتجر وشركة التوصيل لهذا الطلب فقط.</small></div>';
    host.appendChild(w);
    var ui = { st: w.querySelector(".gp-st"), rm: w.querySelector(".gp-rm") }, box = w.querySelector(".gp-box");
    w.querySelector(".gp-open").onclick = function () {
      box.hidden = false; this.hidden = true; ui.st.textContent = "جارٍ تحميل الخريطة…";
      load().then(function () {
        var L = window.L; S.map = L.map(w.querySelector(".gp-map"), { scrollWheelZoom: false }).setView([28.03, 1.66], 5);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(S.map);
        S.map.on("click", function (e) { set(ui, e.latlng.lat, e.latlng.lng); }); ui.st.textContent = "اضغط على الخريطة لوضع الدبوس";
      }).catch(function () { ui.st.textContent = "تعذّر تحميل الخريطة — يمكنك المتابعة بدونها"; });
    };
    w.querySelector(".gp-me").onclick = function () {
      if (!navigator.geolocation) { ui.st.textContent = "متصفحك لا يدعم تحديد الموقع"; return; }
      if (!S.map) { ui.st.textContent = "افتح الخريطة أولاً"; return; }
      ui.st.textContent = "جارٍ تحديد موقعك…";
      navigator.geolocation.getCurrentPosition(function (p) { set(ui, p.coords.latitude, p.coords.longitude, 16); }, function () { ui.st.textContent = "لم نتمكن من تحديد موقعك — ضع الدبوس يدوياً"; }, { enableHighAccuracy: true, timeout: 12000 });
    };
    ui.rm.onclick = function () { S.lat = S.lng = null; if (S.mk) { S.map.removeLayer(S.mk); S.mk = null; } ui.st.textContent = "أُزيل الموقع"; ui.rm.hidden = true; };
  }
  function bind() {
    if (/admin(\.html)?$/.test(location.pathname)) return;
    var el = document.getElementById("commune") || document.getElementById("ccommune"); if (!el || document.querySelector(".gp")) return;
    var host = el.closest(".field") || el.closest("label") || el.parentNode; host.parentNode.insertBefore(document.createElement("div"), host.nextSibling); build(host.nextSibling);
  }
  window.GeoPin = { link: link, _s: S, bind: bind };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
  setTimeout(bind, 2500);
})();
