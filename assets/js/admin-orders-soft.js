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
    if (!$("cc-btn") && $("verify-btn") && document.getElementById("tab-callcenter")) {
      const b = document.createElement("button"); b.type = "button"; b.id = "cc-btn"; b.className = "small";
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg> <span>' + T("تأكيد الطلبات") + "</span>";
      b.onclick = () => { try { Admin.tab("callcenter"); } catch (e) { } };
      $("verify-btn").before(b);
    }
    /* ٢) الأدوات الثانوية داخل «فلاتر» */
    if (!more.dataset.fl) ["presend-btn", "acr-btn", "trash-btn", "arch-btn", "order-filter-status"].forEach(id => { const e = $(id); if (e && e.parentNode !== more) more.prepend(e); });
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
    if (tg && !tg.dataset.own) { tg.dataset.own = "1"; tg.removeAttribute("onclick"); tg.onclick = e => { e.preventDefault(); const m = $("of-more"); if (m) m.classList.toggle("open"); tg.classList.toggle("on", !!(m && m.classList.contains("open"))); }; }
    if (tg) { const want = T("فلاتر"); if (tg.dataset.lbl !== want || !tg.querySelector("svg")) { tg.dataset.lbl = want; tg.innerHTML = "<span>" + want + '</span><svg viewBox="0 0 24 24" aria-hidden="true" style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>'; } else if (tg.querySelector("span") && tg.querySelector("span").textContent !== want) tg.querySelector("span").textContent = want; }
    const all = row.querySelector('.opv[data-v="all"]'); if (all) { const want = T("الكل") + " (" + list().length + ")"; if (all.textContent !== want) all.textContent = want; }
  }
  /* لوحة «فلاتر الطلبات» داخل الصفحة نفسها (لا نافذة): رأس، بطاقات الحالة والسلال، صف الأدوات، المصادر والولايات، الفترة، الخيارات، الأزرار، ثم «تطبيق/إلغاء» */
  const IC = {
    flt: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
    box: '<svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></svg>',
    cart: '<svg viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11L21 7H6"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    lay: '<svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    cog: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>'
  };
  function panel() {
    const more = $("of-more"); if (!more || more.dataset.fl) return;
    const need = ["order-filter-status", "acr-btn", "trash-btn", "arch-btn", "presend-btn", "order-filter-wilaya", "order-filter-src", "order-filter-from", "order-filter-to", "order-show-shipped"];
    if (need.some(id => !$(id))) return;
    more.dataset.fl = "1";
    const mk = (cls, html) => { const d = document.createElement("div"); d.className = cls; if (html) d.innerHTML = html; return d; };
    const sec = (ic, title, el, cls) => { const d = mk("fl-sec " + (cls || ""), '<div class="fl-l">' + IC[ic] + "<span>" + T(title) + "</span></div>"); [].concat(el).forEach(x => x && d.appendChild(x)); return d; };
    const dateF = id => $(id).closest("label");
    const kids = [].slice.call(more.children), keepBtns = {};
    ["import-orders-btn", "sync-btn", "notify-btn"].forEach(id => { keepBtns[id] = $(id); });
    const resetB = kids.find(k => k.tagName === "BUTTON" && /Admin\.resetOrderFilters/.test(k.getAttribute("onclick") || "")), csvB = kids.find(k => /exportOrdersCsv/.test(k.getAttribute("onclick") || "")), shB = kids.find(k => /exportOrdersToSheets/.test(k.getAttribute("onclick") || ""));
    const head = mk("fl-head", '<span class="ord-ic">' + IC.flt + "</span><div><h3>" + T("فلاتر الطلبات") + "</h3><p>" + T("تصفية وبحث متقدم في الطلبات") + '</p></div><button type="button" class="fl-x" aria-label="×">×</button>');
    const tools = mk("fl-tools"); ["trash-btn", "arch-btn", "presend-btn"].forEach(id => tools.appendChild(mk("fl-c")).appendChild($(id)));
    const dates = sec("cal", "الفترة الزمنية", [dateF("order-filter-from"), dateF("order-filter-to")], "fl-wide fl-dates");
    const exL = $("order-show-shipped").closest("label"); if (exL) { exL.style.display = "none"; more.appendChild(exL); try { $("order-show-shipped").checked = false; localStorage.setItem("alyssum_show_shipped", "0"); if (Admin.orderFilters) Admin.orderFilters.showShipped = false; } catch (x) { } }      /* «إظهار المسجلة» محذوف من الواجهة (فلاتر المسجلة في الحالة)؛ يبقى الحقل مخفياً لمنطق الفلترة */
    const acts = mk("fl-acts"); [resetB, csvB, shB, keepBtns["sync-btn"], keepBtns["notify-btn"]].forEach(b => b && acts.appendChild(b));
    if (resetB) resetB.classList.add("fl-reset");
    const foot = mk("fl-foot", '<button type="button" class="fl-apply">' + IC.flt + "<span>" + T("تطبيق الفلاتر") + '</span></button><button type="button" class="fl-cancel"><span>' + T("إلغاء") + "</span> ×</button>");
    const imp = keepBtns["import-orders-btn"]; if (imp) imp.classList.add("fl-imp");
    more.append(head, sec("box", "حالة الطلب", $("order-filter-status")), sec("cart", "السلال المتروكة", $("acr-btn")), tools, imp || "", sec("pin", "الولايات", $("order-filter-wilaya")), sec("lay", "المصادر", $("order-filter-src")), dates, acts, foot);
    const close = () => { more.classList.remove("open"); };
    more.addEventListener("click", e => { if (e.target.closest(".fl-x,.fl-cancel")) close(); else if (e.target.closest(".fl-apply")) { try { Admin.applyOrderFilters(); } catch (x) { } close(); } });
  }
  const go = () => { stats(); try { panel(); } catch (e) { console.warn(e); } try { layout(); } catch (e) { } };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go();
  setInterval(go, 1200);
})();
