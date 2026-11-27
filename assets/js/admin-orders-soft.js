/* صفحة الطلبات: بطاقات الإحصاء العلوية . تقرأ Admin.orders فقط ولا تعدّل الطلبات. */
(function () {
  const $ = id => document.getElementById(id), ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const list = () => (typeof Admin !== "undefined" && Array.isArray(Admin.orders)) ? Admin.orders : [];
  function stats() {
    const tab = $("tab-orders"); if (!tab || !tab.offsetParent) return;
    const L = list(), today = ymd(new Date());
    const set = (id, v) => { const e = $(id); if (e && e.textContent !== String(v)) e.textContent = v; };
    set("os-total", L.length);
    set("os-today", L.filter(o => { const d = new Date(o.date); return !isNaN(d) && ymd(d) === today; }).length);
    set("os-wait", L.filter(o => o.status === "nouvelle").length);
    set("os-way", L.filter(o => o.status === "expediee").length);
    }
  /* ترتيب صفحة الطلبات حسب التصميم: «تأكيد الطلبات» + «التحقق من زبون»، صف «شركات التوصيل» قابل للطيّ، البحث، ثم شرائح العروض مع «فلاتر»؛ والباقي (الحالة، السلال، الأرشيف، السلة) داخل «فلاتر» */
  const T = s => (window.AdminI18n && AdminI18n.t) ? AdminI18n.t(s) : s;
  function layout() {
    const card = document.querySelector("#tab-orders .card:has(#mo-btn)"); if (!card) return;
    const more = $("of-more"), sb = card.querySelector(".search-bar"); if (!more || !sb) return;
    /* ١) زر «تأكيد الطلبات» بدل «أرشيف الطلبات» في الصف الثاني */
    if (!$("cc-btn") && $("presend-btn") && document.getElementById("tab-callcenter")) {
      const b = document.createElement("button"); b.type = "button"; b.id = "cc-btn"; b.className = "small";
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg> <span>' + T("تأكيد الطلبات") + "</span>";
      b.onclick = () => { try { Admin.tab("callcenter"); } catch (e) { } };
      $("presend-btn").before(b);
    }
    /* ٢) الأدوات الثانوية داخل «فلاتر» */
    ["presend-btn", "acr-btn", "trash-btn", "arch-btn", "order-filter-status"].forEach(id => { const e = $(id); if (e && e.parentNode !== more) more.prepend(e); });
    /* ٣) صف «شركات التوصيل» القابل للطيّ */
    const co = $("order-co-chips");
    if (co && !$("co-fold")) {
      const f = document.createElement("button"); f.type = "button"; f.id = "co-fold"; f.innerHTML = '<span class="cf-t">🚚 <b>' + T("شركات التوصيل") + '</b> <i id="cf-n"></i></span><span class="cf-c">⌄</span>';
      f.onclick = () => { co.classList.toggle("co-open"); f.classList.toggle("open", co.classList.contains("co-open")); }; co.before(f);
    }
    if (co && $("co-fold")) { const n = Math.max(0, co.querySelectorAll("button").length - 1), vis = n > 0 && !co.hasAttribute("hidden") && co.style.display !== "none" || (n > 0 && co.dataset.noco === undefined); $("co-fold").style.display = n > 0 ? "" : "none"; const c = $("cf-n"); if (c && c.textContent !== String(n)) c.textContent = n; }
    /* ٤) صف الشرائح: العروض السريعة + «فلاتر» تحت البحث */
    let row = $("ord-chiprow");
    if (!row) { row = document.createElement("div"); row.id = "ord-chiprow"; sb.after(row); }
    const ob = $("op-bar"); if (ob && ob.parentNode !== row) row.prepend(ob);
    const tg = $("of-tg"); if (tg && tg.parentNode !== row) { row.append(tg); }
    if (tg) { const want = T("فلاتر"); if (tg.textContent !== want) tg.textContent = want; }
  }
  const go = () => { stats(); try { layout(); } catch (e) { } };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go();
  setInterval(go, 1200);
})();
