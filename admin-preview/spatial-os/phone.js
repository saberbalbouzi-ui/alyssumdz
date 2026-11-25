/* واجهة الهاتف المخصصة (Mobile-first) — Spatial Core V2 ثم V5.
   ليست الواجهة المكتبية مصغَّرة. المبدأ: أكبر مساحة ممكنة للمحتوى وتنقّل بإبهام واحد.
   • شريط علوي من **صف واحد** (≈56px بدل ≈224px): ☰ القائمة · شرائح عناصر المجموعة الحالية (تنقّل آني) · ▣ النوافذ المفتوحة (مع عدّاد).
   • «القائمة» (ورقة كاملة): المجموعات الست كأزرار كبيرة ثم عناصر المجموعة المختارة كبطاقات لمس، واللغة والعودة للمظهر العادي.
   • «النوافذ المفتوحة» (صينية): بطاقة لكل نافذة مفتوحة للتبديل الفوري أو الإغلاق (مثل التطبيقات الأخيرة).
   • «ورقة» نافذة حقيقية كاملة العرض بين الشريطين (بلا ميلان ولا سحب)؛ شريط سفلي: الرئيسية · الطلبات · LAURA · المنتجات · العالم.
   • لوحة المفاتيح: حين تظهر (visualViewport) يختفي الشريط السفلي وتتقلّص الورقة إلى المنظور المرئي فلا يُحجَب حقل الإدخال.
   العالم ثلاثي الأبعاد يبقى خلف الأوراق ويظهر كاملاً في «العالم»؛ LAURA كما في الحاسوب (ورقة سفلية). تُفعَّل فقط في الوضع الحقيقي وعرض ≤ 820px؛ لا تمسّ منطق الحاسوب.
   التنقل بين العناصر آني (Admin.tab داخل الإطار نفسه: SpatialOS.navTo). */
(() => {
  "use strict";
  const mq = () => innerWidth <= 820, SO = () => window.SpatialOS;
  let host = null, top = null, bot = null, subsEl = null, grpEl = null, titleEl = null, menu = null, tray = null, itemsEl = null, winsBtn = null, badge = null, on = false, grp = "dash", lastSig = "", kb = 0, R = { w: 0, h: 0, cy: 0 };
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  const ico = p => '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + "</svg>";
  const IC_WORLD = '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v11c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/>', IC_LAURA = '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>';
  const IC_MENU = '<path d="M4 7h16M4 12h16M4 17h16"/>', IC_WINS = '<rect x="4" y="5" width="12" height="10" rx="2"/><path d="M8 19h12V9"/>';
  const entries = g => ((SO() && SO().groups()[g]) || []).map(e => { const p = String(e).split("|"); return { id: p[0], label: p[1] || SO().secName(p[0]) }; });
  /* المنطقة المتاحة للورقة: بين الشريط العلوي والسفلي، أو حتى حدّ المنظور المرئي حين تظهر لوحة المفاتيح */
  function measure() {
    if (!top || !bot) return; const a = top.getBoundingClientRect().bottom, vv = window.visualViewport, z = kb > 0 && vv ? vv.height + vv.offsetTop : bot.getBoundingClientRect().top;
    R = { w: innerWidth, h: Math.max(160, Math.round(z - a)), cy: Math.round(a + (z - a) / 2) };
  }
  function chip(label, on_, fn) { const b = el("button", "ps-chip" + (on_ ? " on" : ""), label); b.type = "button"; b.addEventListener("click", fn); return b; }
  function renderGroups() {
    grpEl.textContent = ""; const s = SO(); if (!s) return; s.ring().forEach(g => { const b = chip(s.secName(g), g === grp, () => pickGroup(g)); b.dataset.g = g; grpEl.appendChild(b); });
  }
  function renderSubs() {
    subsEl.textContent = ""; const act = SO() && SO().activeId(); entries(grp).forEach(e => { const b = chip(e.label, e.id === act, () => go(e.id)); b.dataset.id = e.id; subsEl.appendChild(b); });
  }
  /* عناصر المجموعة المختارة كبطاقات لمس كبيرة داخل «القائمة» */
  function renderItems() {
    itemsEl.textContent = ""; const act = SO() && SO().activeId(), L = entries(grp);
    L.forEach(e => { const b = el("button", "ps-tile" + (e.id === act ? " on" : ""), e.label); b.type = "button"; b.dataset.id = e.id; b.addEventListener("click", () => { go(e.id); closeMenu(); }); itemsEl.appendChild(b); });
    if (!L.length) itemsEl.appendChild(el("p", "ps-empty", "—"));
  }
  function go(id) { const s = SO(); if (!s) return; if (!s.navTo(id)) s.open(id); closeTray(); setTimeout(sync, 80); }
  function pickGroup(g) {
    grp = g; renderGroups(); renderSubs(); renderItems();   /* المجموعة تُظهر عناصرها فقط؛ الانتقال إلى عنصر بنقرة عليه (القائمة) أو من شرائح الشريط */
    const gb = grpEl.querySelector(".on"); if (gb) gb.scrollIntoView({ inline: "center", block: "nearest" });
  }
  /* الصينية: النوافذ المفتوحة */
  function openList() { const s = SO(); return s ? [...s.panels.values()].filter(q => q && q.el && q.el.isConnected && !q.dismissed) : []; }
  function renderTray() {
    const s = SO(); tray.querySelector(".ps-tlist").textContent = ""; if (!s) return; const act = s.activeId(), L = openList(), box = tray.querySelector(".ps-tlist");
    L.forEach(q => {
      const row = el("div", "ps-trow" + (q.id === act ? " on" : "")), b = el("button", "ps-tcard", s.secName(q.id) || q.id), x = el("button", "ps-tx", "×"); b.type = "button"; x.type = "button"; row.dataset.id = q.id;
      x.setAttribute("aria-label", "إغلاق"); b.addEventListener("click", () => { s.open(q.id); [...s.panels.values()].forEach(o => { if (o.id !== q.id && o.frame && !o.min) s.dismiss(o.id, "min"); }); /* ورقة مرئية واحدة */ closeTray(); setTimeout(sync, 120); }); x.addEventListener("click", () => { s.dismiss(q.id, "close"); setTimeout(() => { renderTray(); sync(); }, 120); });
      row.append(b, x); box.appendChild(row);
    });
    if (!L.length) box.appendChild(el("p", "ps-empty", "لا نوافذ مفتوحة"));
  }
  function updBadge() { if (!badge) return; const n = openList().length; badge.textContent = String(n); badge.hidden = !n; }
  function openMenu() { closeTray(); menu.hidden = false; document.body.classList.add("ps-menu-on"); renderGroups(); renderItems(); }
  function closeMenu() { if (menu) menu.hidden = true; document.body.classList.remove("ps-menu-on"); }
  function openTray() { closeMenu(); renderTray(); tray.hidden = false; document.body.classList.add("ps-tray-on"); }
  function closeTray() { if (tray) tray.hidden = true; document.body.classList.remove("ps-tray-on"); }
  function sync() {
    if (!on || document.hidden) return; const s = SO(); if (!s) return; const act = s.activeId(), tab = s.tab || grp, n = openList().length, sig = act + "|" + tab + "|" + s.lang + "|" + n;
    if (sig === lastSig) return; lastSig = sig;
    if (tab && tab !== grp && s.ring().indexOf(tab) >= 0) { grp = tab; if (!menu.hidden) { renderGroups(); renderItems(); } }
    renderSubs(); titleEl.textContent = act ? s.secName(act) : "ALYSSUM"; updBadge(); if (!tray.hidden) renderTray();
    subsEl.querySelectorAll(".ps-chip").forEach(b => { if (b.classList.contains("on")) b.scrollIntoView({ inline: "center", block: "nearest" }); });
    bot.querySelectorAll("[data-nav]").forEach(b => b.classList.toggle("on", !!act && b.dataset.nav === act));
    document.body.classList.toggle("ps-hero", !act);
  }
  /* لوحة المفاتيح: المنظور المرئي أصغر من النافذة بفارق كبير ← يُخفى الشريط السفلي وتتقلّص الورقة */
  function onVV() {
    if (!on) return; const vv = window.visualViewport; if (!vv) return; const k = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)), open_ = k > 120;
    if ((open_ ? k : 0) === kb) return; kb = open_ ? k : 0; document.body.classList.toggle("ps-kb", open_); document.documentElement.style.setProperty("--ps-kb", kb + "px"); measure(); if (SO() && SO().relayout) SO().relayout();
  }
  function build() {
    host = el("div"); host.id = "ps";
    top = el("header"); top.id = "ps-top";
    const bar = el("div", "ps-bar"); titleEl = el("b", "ps-title", "ALYSSUM");
    const mb = el("button", "ps-ib"); mb.type = "button"; mb.id = "ps-menu-btn"; mb.setAttribute("aria-label", "القائمة"); mb.innerHTML = ico(IC_MENU); mb.addEventListener("click", () => (menu.hidden ? openMenu() : closeMenu()));
    winsBtn = el("button", "ps-ib"); winsBtn.type = "button"; winsBtn.id = "ps-wins"; winsBtn.setAttribute("aria-label", "النوافذ المفتوحة"); winsBtn.innerHTML = ico(IC_WINS); badge = el("i", "ps-badge", "0"); badge.hidden = true; winsBtn.appendChild(badge); winsBtn.addEventListener("click", () => (tray.hidden ? openTray() : closeTray()));
    subsEl = el("nav", "ps-row ps-subs"); subsEl.setAttribute("aria-label", "العناصر");
    bar.append(mb, subsEl, winsBtn, titleEl); top.append(bar);
    bot = el("nav"); bot.id = "ps-bot"; bot.setAttribute("aria-label", "التنقل السفلي");
    const nb = (nav, label, path, fn, cls) => { const b = el("button", "ps-nb" + (cls ? " " + cls : "")); b.type = "button"; if (nav) b.dataset.nav = nav; b.innerHTML = ico(path) + "<span>" + label + "</span>"; b.addEventListener("click", () => { closeMenu(); closeTray(); fn(); }); return b; };
    const IC_ = window.IC || {};
    bot.append(nb("dash", "الرئيسية", IC_.dash || "", () => { grp = "dash"; SO().selectTab("dash"); renderGroups(); renderSubs(); const f = entries("dash")[0]; if (f) go(f.id); }), nb("ord", "الطلبات", IC_.ord || "", () => { grp = "store"; SO().selectTab("store"); renderGroups(); renderSubs(); go("ord"); }), nb("", "LAURA", IC_LAURA, () => SO().laura(), "ps-laura"), nb("prod", "المنتجات", IC_.prod || "", () => { grp = "prod"; SO().selectTab("prod"); renderGroups(); renderSubs(); const f = entries("prod")[0]; if (f) go(f.id); }), nb("", "العالم", IC_WORLD, () => { SO().minimizeAll(); setTimeout(sync, 120); }));
    /* القائمة: ورقة كاملة تحت الشريط العلوي */
    menu = el("section"); menu.id = "ps-menu"; menu.hidden = true; menu.setAttribute("role", "dialog"); menu.setAttribute("aria-label", "القائمة");
    const mh = el("div", "ps-sh"); mh.append(el("b", null, "القائمة")); const mx = el("button", "ps-ib", "×"); mx.type = "button"; mx.setAttribute("aria-label", "إغلاق"); mx.addEventListener("click", closeMenu); mh.append(mx);
    grpEl = el("nav", "ps-groups"); grpEl.setAttribute("aria-label", "المجموعات"); itemsEl = el("div", "ps-items");
    const foot = el("div", "ps-foot");
    const lang = el("button", "ps-ib ps-wide", "FR"); lang.type = "button"; lang.id = "ps-lang"; lang.setAttribute("aria-label", "اللغة"); lang.addEventListener("click", () => { const b = document.getElementById("hud-lang"); if (b) b.click(); setTimeout(() => { lang.textContent = (document.getElementById("hud-lang") || {}).textContent || "FR"; lastSig = ""; sync(); renderGroups(); renderItems(); }, 250); });
    const exit = el("button", "ps-ib ps-wide", "← المظهر العادي"); exit.type = "button"; exit.id = "ps-exit"; exit.setAttribute("aria-label", "العودة للمظهر العادي"); exit.addEventListener("click", () => { const b = document.getElementById("hud-exit"); if (b) b.click(); });
    foot.append(lang, exit); menu.append(mh, grpEl, itemsEl, foot);
    /* الصينية: النوافذ المفتوحة */
    tray = el("section"); tray.id = "ps-tray"; tray.hidden = true; tray.setAttribute("role", "dialog"); tray.setAttribute("aria-label", "النوافذ المفتوحة");
    const th = el("div", "ps-sh"); th.append(el("b", null, "النوافذ المفتوحة")); const tx = el("button", "ps-ib", "×"); tx.type = "button"; tx.setAttribute("aria-label", "إغلاق"); tx.addEventListener("click", closeTray); th.append(tx);
    tray.append(th, el("div", "ps-tlist")); host.append(top, bot, menu, tray); document.body.appendChild(host);
    document.addEventListener("keydown", e => { if (String(e.key || "") === "Escape") { closeMenu(); closeTray(); } });
  }
  function enable() {
    if (on || !mq() || !SO() || !document.body.classList.contains("real") || /[?&]noshell=1/.test(location.search)) return;   /* ?noshell=1: الواجهة الهاتفية القديمة (اختبارات وصول/مقارنة) */ if (!host) build(); on = true; document.body.classList.add("ps"); host.hidden = false;
    const s = SO(); grp = s.tab && s.ring().indexOf(s.tab) >= 0 ? s.tab : "dash"; renderGroups(); renderSubs(); renderItems(); lastSig = ""; measure(); sync(); const l = document.getElementById("ps-lang"), hl = document.getElementById("hud-lang"); if (l && hl) l.textContent = hl.textContent || "FR";
    if (SO().relayout) SO().relayout(); onVV();
  }
  function disable() { if (!on) return; on = false; closeMenu(); closeTray(); document.body.classList.remove("ps", "ps-hero", "ps-kb"); if (host) host.hidden = true; if (SO() && SO().relayout) SO().relayout(); }
  function onResize() { if (mq()) { if (!on) enable(); else { measure(); if (SO().relayout) SO().relayout(); onVV(); } } else disable(); }
  /* ‎_kb(px)‎ للاختبار: يحاكي ظهور لوحة المفاتيح بهذا الارتفاع (Chromium بلا لوحة حقيقية) */
  window.SpatialPhone = { get on() { return on; }, get kb() { return kb; }, rect: () => R, refresh: onResize, enable, disable, openMenu, closeMenu, openTray, closeTray, _kb: px => { kb = px > 120 ? px : 0; document.body.classList.toggle("ps-kb", kb > 0); document.documentElement.style.setProperty("--ps-kb", kb + "px"); measure(); if (SO() && SO().relayout) SO().relayout(); } };
  addEventListener("resize", onResize); addEventListener("orientationchange", () => setTimeout(onResize, 250));
  try { if (window.visualViewport) { visualViewport.addEventListener("resize", onVV); visualViewport.addEventListener("scroll", onVV); } } catch (_) { }
  document.addEventListener("sc-real", () => setTimeout(enable, 60)); setInterval(sync, 400);
  if (document.body && document.body.classList.contains("real")) setTimeout(enable, 60);
})();
