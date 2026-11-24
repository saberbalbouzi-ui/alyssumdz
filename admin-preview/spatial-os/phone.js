/* واجهة الهاتف المخصصة (Mobile-first) — Spatial Core Performance V2.
   ليست الواجهة المكتبية مصغَّرة: شريط علوي (العنوان + اللغة + العودة)، صفّا تنقّل بأهداف لمس ≥ 44px (المجموعات الست ثم عناصر المجموعة كما في قائمة اللوحة)،
   «ورقة» نافذة حقيقية كاملة العرض تملأ المساحة بين الشريطين (بلا ميلان ولا سحب)، وشريط سفلي: الرئيسية · الطلبات · LAURA · المنتجات · العالم.
   العالم ثلاثي الأبعاد (الاسطوانة/الكرة/القاعدة) يبقى خلف الأوراق ويظهر كاملاً حين تُصغَّر الورقة («العالم»)؛ LAURA تعمل كما في الحاسوب (نقر الكرة/زر LAURA).
   تُفعَّل فقط في الوضع الحقيقي وعرض ≤ 820px؛ لا تمسّ منطق الحاسوب. التنقل بين العناصر آني (Admin.tab داخل الإطار نفسه: SpatialOS.navTo). */
(() => {
  "use strict";
  const mq = () => innerWidth <= 820, SO = () => window.SpatialOS;
  let host = null, top = null, bot = null, subsEl = null, grpEl = null, titleEl = null, on = false, grp = "dash", lastSig = "", R = { w: 0, h: 0, cy: 0 };
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  const ico = p => '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + "</svg>";
  const IC_WORLD = '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v11c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/>', IC_LAURA = '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>';
  const entries = g => ((SO() && SO().groups()[g]) || []).map(e => { const p = String(e).split("|"); return { id: p[0], label: p[1] || SO().secName(p[0]) }; });
  function measure() { if (!top || !bot) return; const a = top.getBoundingClientRect().bottom, z = bot.getBoundingClientRect().top; R = { w: innerWidth, h: Math.max(160, Math.round(z - a)), cy: Math.round(a + (z - a) / 2) }; }
  function chip(label, on_, fn) { const b = el("button", "ps-chip" + (on_ ? " on" : ""), label); b.type = "button"; b.addEventListener("click", fn); return b; }
  function renderGroups() {
    grpEl.textContent = ""; const s = SO(); if (!s) return; s.ring().forEach(g => { const b = chip(s.secName(g), g === grp, () => pickGroup(g)); b.dataset.g = g; grpEl.appendChild(b); });
  }
  function renderSubs() {
    subsEl.textContent = ""; const act = SO() && SO().activeId(); entries(grp).forEach(e => { const b = chip(e.label, e.id === act, () => go(e.id)); b.dataset.id = e.id; subsEl.appendChild(b); });
  }
  function go(id) { const s = SO(); if (!s) return; if (!s.navTo(id)) s.open(id); setTimeout(sync, 80); }
  function pickGroup(g) {
    grp = g; const s = SO(); s.selectTab(g); renderGroups(); renderSubs(); const first = entries(g)[0]; if (first) go(first.id);
    const gb = grpEl.querySelector(".on"); if (gb) gb.scrollIntoView({ inline: "center", block: "nearest" });
  }
  function sync() {
    if (!on || document.hidden) return; const s = SO(); if (!s) return; const act = s.activeId(), tab = s.tab || grp, sig = act + "|" + tab + "|" + s.lang;
    if (sig === lastSig) return; lastSig = sig;
    if (tab && tab !== grp && s.ring().indexOf(tab) >= 0) { grp = tab; renderGroups(); }
    renderSubs(); titleEl.textContent = act ? s.secName(act) : "ALYSSUM";
    subsEl.querySelectorAll(".ps-chip").forEach(b => { if (b.classList.contains("on")) b.scrollIntoView({ inline: "center", block: "nearest" }); });
    bot.querySelectorAll("[data-nav]").forEach(b => b.classList.toggle("on", !!act && b.dataset.nav === act));
    document.body.classList.toggle("ps-hero", !act);
  }
  function build() {
    host = el("div"); host.id = "ps";
    top = el("header"); top.id = "ps-top";
    const bar = el("div", "ps-bar"); titleEl = el("b", "ps-title", "ALYSSUM");
    const exit = el("button", "ps-ib", "←"); exit.type = "button"; exit.setAttribute("aria-label", "العودة للمظهر العادي"); exit.addEventListener("click", () => { const b = document.getElementById("hud-exit"); if (b) b.click(); });
    const lang = el("button", "ps-ib", "FR"); lang.type = "button"; lang.id = "ps-lang"; lang.setAttribute("aria-label", "اللغة"); lang.addEventListener("click", () => { const b = document.getElementById("hud-lang"); if (b) b.click(); setTimeout(() => { lang.textContent = (document.getElementById("hud-lang") || {}).textContent || "FR"; lastSig = ""; sync(); }, 250); });
    bar.append(exit, titleEl, lang); grpEl = el("nav", "ps-row ps-groups"); grpEl.setAttribute("aria-label", "المجموعات"); subsEl = el("nav", "ps-row ps-subs"); subsEl.setAttribute("aria-label", "العناصر");
    top.append(bar, grpEl, subsEl);
    bot = el("nav"); bot.id = "ps-bot"; bot.setAttribute("aria-label", "التنقل السفلي");
    const nb = (nav, label, path, fn, cls) => { const b = el("button", "ps-nb" + (cls ? " " + cls : "")); b.type = "button"; if (nav) b.dataset.nav = nav; b.innerHTML = ico(path) + "<span>" + label + "</span>"; b.addEventListener("click", fn); return b; };
    const IC_ = window.IC || {};
    bot.append(nb("dash", "الرئيسية", IC_.dash || "", () => { pickGroup("dash"); }), nb("ord", "الطلبات", IC_.ord || "", () => { grp = "store"; SO().selectTab("store"); renderGroups(); renderSubs(); go("ord"); }), nb("", "LAURA", IC_LAURA, () => SO().laura(), "ps-laura"), nb("prod", "المنتجات", IC_.prod || "", () => pickGroup("prod")), nb("", "العالم", IC_WORLD, () => { SO().minimizeAll(); setTimeout(sync, 120); }));
    host.append(top, bot); document.body.appendChild(host);
  }
  function enable() {
    if (on || !mq() || !SO() || !document.body.classList.contains("real") || /[?&]noshell=1/.test(location.search)) return;   /* ?noshell=1: الواجهة الهاتفية القديمة (اختبارات وصول/مقارنة) */ if (!host) build(); on = true; document.body.classList.add("ps"); host.hidden = false;
    const s = SO(); grp = s.tab && s.ring().indexOf(s.tab) >= 0 ? s.tab : "dash"; renderGroups(); renderSubs(); lastSig = ""; measure(); sync(); const l = document.getElementById("ps-lang"), hl = document.getElementById("hud-lang"); if (l && hl) l.textContent = hl.textContent || "FR";
    if (SO().relayout) SO().relayout();
  }
  function disable() { if (!on) return; on = false; document.body.classList.remove("ps", "ps-hero"); if (host) host.hidden = true; if (SO() && SO().relayout) SO().relayout(); }
  function onResize() { if (mq()) { if (!on) enable(); else { measure(); if (SO().relayout) SO().relayout(); } } else disable(); }
  window.SpatialPhone = { get on() { return on; }, rect: () => R, refresh: onResize, enable, disable };
  addEventListener("resize", onResize); addEventListener("orientationchange", () => setTimeout(onResize, 250));
  document.addEventListener("sc-real", () => setTimeout(enable, 60)); setInterval(sync, 400);
  if (document.body && document.body.classList.contains("real")) setTimeout(enable, 60);
})();
