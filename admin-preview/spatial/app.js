/* ALYSSUM 2030 — واجهة المعاينة: بيانات وهمية حتمية + ربط النواة والتضاريس والأسطح العائمة */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var nf = new Intl.NumberFormat("fr-FR");
  function fmt(n) { return nf.format(Math.round(n)).replace(/[  ]/g, " "); }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s + 0x6d2b79f5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var toastT; function toast(m) { var t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2600); }

  /* أيقونات */
  var P = {
    bell: '<path d="M6 17V11a6 6 0 1112 0v6l1.5 2h-15zM10 21h4"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>', box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    store: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9c0 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 4 2 4 0M9 20v-6h6v6"/>', palette: '<path d="M12 3a9 9 0 100 18c1.6 0 2-1 1.4-2-.8-1.5.2-3 2-3H18a3 3 0 003-3c0-5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>'
  };
  function icon(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || "") + "</svg>"; }
  $$("[data-i]").forEach(function (e) { e.innerHTML = icon(e.getAttribute("data-i")); });

  /* ───────── بيانات تجريبية حتمية ───────── */
  var PER = {
    today: { n: 8, sub: "اليوم", cap: "طلبات اليوم", lab: ["00", "03", "06", "09", "12", "15", "18", "21"], seed: 11, scale: .16 },
    week: { n: 7, sub: "آخر 7 أيام", cap: "طلبات الأسبوع", lab: ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"], seed: 7, scale: 1 },
    month: { n: 15, sub: "آخر 30 يوماً", cap: "طلبات الشهر", lab: ["1", "3", "5", "7", "9", "11", "13", "15", "17", "19", "21", "23", "25", "27", "29"], seed: 23, scale: 4.2 }
  };
  var STAT = [["pending", "في انتظار التأكيد", "59,139,255", "#3b8bff"], ["prep", "قيد التجهيز", "255,138,60", "#ff8a3c"], ["road", "في الطريق", "25,224,138", "#19e08a"], ["done", "تم التسليم", "255,194,60", "#ffc23c"], ["fail", "فشل / ملغاة", "255,95,179", "#ff5fb3"]];
  function build(key) {
    var c = PER[key], r = rng(c.seed), sales = [], orders = [], i, x, wave;
    for (i = 0; i < c.n; i++) { x = c.n > 1 ? i / (c.n - 1) : .5; wave = .07 + .78 * Math.exp(-Math.pow((x - .33) / .13, 2)) + .98 * Math.exp(-Math.pow((x - .72) / .1, 2)) + r() * .07; var s = wave * 24000 * c.scale / (key === "month" ? 2 : 1) * (key === "today" ? 2.2 : 1); sales.push(Math.round(s / 100) * 100); orders.push(Math.max(1, Math.round(s / 3400))); }
    var tS = sales.reduce(function (a, b) { return a + b; }, 0), tO = orders.reduce(function (a, b) { return a + b; }, 0), v = [Math.round(tO * .0), Math.round(tO * .2), Math.round(tO * .17), 0, Math.max(1, Math.round(tO * .04))];
    v[3] = Math.max(0, tO - v[1] - v[2] - v[4]);
    return { sales: sales, orders: orders, tS: tS, tO: tO, avg: tO ? tS / tO : 0, c: c, key: key, st: STAT.map(function (s, k) { return { id: s[0], label: s[1], rgb: s[2], color: s[3], v: v[k] }; }) };
  }
  var state = { p: "week", t: "sales", d: null };

  /* ───────── النواة والتضاريس ───────── */
  var tip = $("#tip");
  var core = new AlyCore($("#core"), { reduced: REDUCED, onPick: function (i) { var s = state.d.st[i]; toast(s.label + ": " + s.v + " طلب (بيانات تجريبية)"); } });
  core.onHover = function (i) { $$("#legend li").forEach(function (l) { l.classList.toggle("hot", Number(l.dataset.i) === i); }); if (i < 0) tip.hidden = true; };
  core.onHover.move = function (i, pos) { if (i < 0 || !pos) { tip.hidden = true; return; } var s = state.d.st[i]; tip.innerHTML = s.label + "<b>" + s.v + " طلب · " + Math.round(s.v / (state.d.tO || 1) * 100) + "%</b>"; tip.style.left = pos.x + "px"; tip.style.top = pos.y + "px"; tip.style.position = "fixed"; tip.hidden = false; };
  var terr = new AlyTerrain($("#terrain"), { reduced: REDUCED, onHover: function (i, pos) {
    if (i < 0 || !pos) { tip.hidden = true; return; } var d = state.d, v = state.t === "orders" ? d.orders[i] : d.sales[i];
    tip.innerHTML = d.c.lab[i] + '<b><span class="ltr">' + fmt(v) + "</span>" + (state.t === "orders" ? " طلب" : " دج") + "</b>"; tip.style.left = pos.x + "px"; tip.style.top = pos.y + "px"; tip.style.position = "fixed"; tip.hidden = false;
  } });

  /* ───────── الأسطح العائمة ───────── */
  function countUp(el, to, suf) { var t0 = performance.now(), dur = REDUCED ? 1 : 900; (function step(t) { var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e) + (suf || ""); if (k < 1) requestAnimationFrame(step); })(t0); }
  function spark(vals) {
    var w = 220, h = 56, mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals), pts = vals.map(function (v, i) { return [w - i / (vals.length - 1) * w, h - 5 - (v - mn) / ((mx - mn) || 1) * (h - 12)]; }), d = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
    $("#spk").innerHTML = '<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#27e6ff" stop-opacity=".5"/><stop offset="1" stop-color="#27e6ff" stop-opacity="0"/></linearGradient></defs><path d="' + d + " L0 " + h + " L" + w + " " + h + 'Z" fill="url(#sg)" stroke="none"/><path d="' + d + '" stroke="#27e6ff" stroke-width="2" style="filter:drop-shadow(0 0 5px #27e6ff)"/>' + pts.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.4" fill="#fff"/>'; }).join("");
  }
  function bars3d(vals) {
    var last = vals.slice(-6), mx = Math.max.apply(null, last), box = $("#bars3d");
    box.innerHTML = '<div class="b3-scene">' + last.map(function (v, i) { var h = Math.max(16, v / mx * 80); return '<div class="bx" style="--h:' + h.toFixed(0) + "px;--dl:" + (i * 70) + "ms;--i:" + i + ";--n:" + last.length + '"><i class="bs"></i><i class="r"></i><i class="f"></i><i class="t"></i><span>' + fmt(v / 1000) + "k</span></div>"; }).join("") + "</div>";
  }
  function orb(id, frac) { var c = $(id); if (c) c.style.strokeDashoffset = String(201 * (1 - Math.max(0, Math.min(1, frac)))); }
  function legend() {
    var d = state.d; $("#legend").innerHTML = d.st.map(function (s, i) { return '<li data-i="' + i + '" style="--c:' + s.color + '"><i></i>' + s.label + "<b>" + s.v + "</b></li>"; }).join("");
    $$("#legend li").forEach(function (li) { li.addEventListener("pointerenter", function () { core.setHover(Number(li.dataset.i)); }); li.addEventListener("pointerleave", function () { core.setHover(-1); }); });
  }
  function render(pulse) {
    var d = state.d = build(state.p);
    core.setStatuses(d.st); if (pulse) core.pulse(); if (REDUCED) core.frame(0);
    $("#core-n").textContent = fmt(d.tO); $("#core-cap").textContent = d.c.cap;
    countUp($("#s-val"), d.tS); $("#s-delta").className = d.c.seed % 2 ? "up" : "dn"; $("#s-delta").textContent = d.c.seed % 2 ? "▲ 25%" : "▼ 8%";
    $("#rev-avg").innerHTML = 'متوسط الطلب <span class="ltr">' + fmt(d.avg) + "</span> دج";
    spark(d.sales); bars3d(d.sales); legend();
    $("#o1-n").textContent = fmt(d.tO); orb("#o1", Math.min(1, d.tO / (d.c.n * 12))); orb("#o2", .34); orb("#o3", .22);
    var pe = $("#pending"), pn = d.st[0].v; $("#pend-n").textContent = String(pn); pe.classList.toggle("calm", pn === 0); pe.classList.toggle("hot", pn > 5); $("#pend-t").textContent = pn === 0 ? "لا طلبات معلّقة" : "في انتظار التأكيد";
    applyTerrain();
  }
  function applyTerrain() {
    var d = state.d, sales = state.t === "sales"; terr.setData(sales ? d.sales : d.orders, d.c.lab, null);
    $("#t-title").textContent = sales ? "مشهد المبيعات — " + d.c.sub : "مشهد الطلبات — " + d.c.sub;
    var ax = $("#t-axis"); ax.innerHTML = d.c.lab.filter(function (l, i) { return d.c.n < 10 || i % 2 === 0; }).reverse().map(function (l) { return "<span>" + l + "</span>"; }).join("");
  }
  $(".periods").addEventListener("click", function (e) { var b = e.target.closest("button[data-p]"); if (!b) return; state.p = b.dataset.p; $$(".periods button").forEach(function (x) { var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); }); render(true); });
  $(".tabs").addEventListener("click", function (e) { var b = e.target.closest("button[data-t]"); if (!b) return; state.t = b.dataset.t; $$(".tabs button").forEach(function (x) { var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); }); applyTerrain(); });

  /* ───────── السكّة الجانبية ───────── */
  var NAV = [
    { id: "home", t: "الرئيسية", i: "home", ch: [] }, { id: "products", t: "المنتجات", i: "box", ch: ["قائمة المنتجات", "التصنيفات", "المخزون والتكلفة", "العروض والكوبونات"] },
    { id: "store", t: "المتجر", i: "store", ch: ["الطلبات", "الزبائن", "التوصيل", "السلات المتروكة", "المدفوعات"] }, { id: "look", t: "المظهر", i: "palette", ch: ["القوالب", "مطوّر الصفحات", "الألوان والخطوط", "الصور والوسائط"] },
    { id: "addons", t: "إضافات", i: "grid", ch: ["الدفع والشحن", "التسويق والتتبع", "التقارير", "أدوات الصور"] }, { id: "settings", t: "الإعدادات العامة", i: "gear", ch: ["معلومات المتجر", "الفريق والصلاحيات", "الإشعارات", "النسخ الاحتياطي"] },
    { id: "site", t: "إعدادات الموقع", i: "globe", ch: ["النطاق", "محركات البحث", "الصفحات القانونية"] }
  ];
  var nav = { act: "home", open: "" }, fly = $("#fly");
  function renderRail() {
    $("#rail").innerHTML = '<button type="button" class="rb' + (nav.open === "search" ? " act" : "") + '" data-g="search" aria-label="بحث">' + icon("search") + '<span class="lb">بحث سريع</span></button><hr>' +
      NAV.map(function (g) { return '<button type="button" class="rb' + (nav.act === g.id ? " act" : "") + '" data-g="' + g.id + '" aria-label="' + g.t + '" aria-expanded="' + (nav.open === g.id) + '">' + icon(g.i) + '<span class="lb">' + g.t + "</span></button>"; }).join("");
  }
  function renderFly() {
    if (!nav.open) { fly.hidden = true; return; } fly.hidden = false;
    if (nav.open === "search") { fly.innerHTML = '<input id="fq" type="search" placeholder="بحث سريع عن أي إعداد..." aria-label="بحث"><div id="fres"></div>'; var q = $("#fq"); q.focus(); q.addEventListener("input", function () { var v = q.value.trim(), out = ""; if (v) NAV.forEach(function (g) { g.ch.concat(g.t).forEach(function (k) { if (k.indexOf(v) > -1) out += '<a href="#" data-k="' + k + '" data-g="' + g.id + '">' + k + "</a>"; }); }); $("#fres").innerHTML = out || (v ? '<a>لا نتائج</a>' : ""); }); return; }
    var g = NAV.filter(function (x) { return x.id === nav.open; })[0]; fly.innerHTML = "<h3>" + g.t + "</h3>" + g.ch.map(function (k) { return '<a href="#" data-k="' + k + '" data-g="' + g.id + '">' + k + "</a>"; }).join("");
  }
  $("#rail").addEventListener("click", function (e) { var b = e.target.closest(".rb"); if (!b) return; var g = b.dataset.g; if (g === "search") nav.open = nav.open === "search" ? "" : "search"; else { var d = NAV.filter(function (x) { return x.id === g; })[0]; nav.act = g; nav.open = d.ch.length ? (nav.open === g ? "" : g) : ""; } renderRail(); renderFly(); });
  fly.addEventListener("click", function (e) { var a = e.target.closest("a[data-k]"); if (!a) return; e.preventDefault(); toast("معاينة تجريبية — «" + a.dataset.k + "» لا ينقلك لأي صفحة فعلية"); nav.open = ""; if (a.dataset.g) nav.act = a.dataset.g; renderRail(); renderFly(); });
  document.addEventListener("keydown", function (e) { var k = String(e.key || ""); if (k === "Escape") { nav.open = ""; renderRail(); renderFly(); } else if (!/input/i.test((e.target || {}).tagName || "")) { if (k === "/") { e.preventDefault(); nav.open = "search"; renderRail(); renderFly(); } else if (k === "1") $('[data-p="today"]').click(); else if (k === "2") $('[data-p="week"]').click(); else if (k === "3") $('[data-p="month"]').click(); } });
  [["#b-bell", "٣ إشعارات تجريبية"], ["#b-visit", "معاينة تجريبية — لا يفتح الموقع"], ["#b-ask", "معاينة تجريبية — المساعد غير متصل هنا"]].forEach(function (a) { $(a[0]).addEventListener("click", function () { toast(a[1]); }); });

  /* ───────── بارالاكس: تتحرك الطبقات بنسب عمق مختلفة ───────── */
  var stage = $("#stage");
  if (!REDUCED) window.addEventListener("pointermove", function (e) { stage.style.setProperty("--mx", ((e.clientX / innerWidth - .5) * 2).toFixed(3)); stage.style.setProperty("--my", ((e.clientY / innerHeight - .5) * 2).toFixed(3)); });

  /* ───────── غبار رقمي في الخلفية ───────── */
  (function dust() {
    var cv = $("#dust"), cx = cv.getContext("2d"), w, h, ps = [], raf = 0, last = 0, dpr = Math.min(2, devicePixelRatio || 1);
    function size() { w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); var n = Math.round(Math.min(90, w * h / 18000)), r = rng(3); ps = []; for (var i = 0; i < n; i++) ps.push({ x: r() * w, y: r() * h, vy: -.08 - r() * .25, r: .5 + r() * 1.4, a: .15 + r() * .5, c: r() > .5 ? "220,255,31" : "39,230,255" }); }
    function draw(t) { raf = requestAnimationFrame(draw); if (t - last < 33) return; last = t; cx.clearRect(0, 0, w, h); for (var i = 0; i < ps.length; i++) { var p = ps[i]; p.y += p.vy; if (p.y < -3) { p.y = h + 3; p.x = Math.random() * w; } cx.fillStyle = "rgba(" + p.c + "," + p.a + ")"; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill(); } }
    size(); addEventListener("resize", size);
    if (!REDUCED) { raf = requestAnimationFrame(draw); document.addEventListener("visibilitychange", function () { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) raf = requestAnimationFrame(draw); }); }
  })();

  /* خطوط طاقة متحرّكة تربط النواة بالأسطح (بيئة متصلة لا عناصر منفصلة) */
  function links() {
    var svg = $("#links"), cw = $("#coreWrap").getBoundingClientRect(), sr = stage.getBoundingClientRect(), cx = cw.left + cw.width / 2 - sr.left, cy = cw.top + cw.height / 2 * 1.02 - sr.top;
    function pt(sel, side) { var e = $(sel); if (!e) return null; var r = e.getBoundingClientRect(); return [(side === "r" ? r.right : side === "l" ? r.left : r.left + r.width / 2) - sr.left, r.top + r.height / 2 - sr.top]; }
    var T = [[pt(".sales", "r"), "39,230,255"], [pt("#pending", "c"), "165,139,255"], [pt(".o-stock", "c"), "220,255,31"], [pt(".o-orders", "c"), "39,230,255"], [pt(".legend", "c"), "220,255,31"]];
    svg.setAttribute("viewBox", "0 0 " + sr.width + " " + sr.height);
    svg.innerHTML = T.filter(function (x) { return x[0]; }).map(function (x) { var p = x[0], mx = (cx + p[0]) / 2, my = Math.min(cy, p[1]) - Math.abs(cx - p[0]) * .12; return '<path d="M' + cx.toFixed(0) + " " + cy.toFixed(0) + " Q" + mx.toFixed(0) + " " + my.toFixed(0) + " " + p[0].toFixed(0) + " " + p[1].toFixed(0) + '" stroke="rgba(' + x[1] + ',.8)"/>'; }).join("");
  }
  addEventListener("resize", links); setTimeout(links, 400); setTimeout(links, 1500);

  (function clock() { var e = $("#clock"); function tick() { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; e.textContent = p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()); } tick(); if (!REDUCED) setInterval(tick, 1000); })();

  /* ───────── تشغيل ───────── */
  renderRail(); render(false); core.start(); terr.start();
  $$(".bar,.core,.greet,.sales,.orb,.pending,.legend,.terrain,.rail").forEach(function (e, i) { e.classList.add("reveal"); e.style.setProperty("--rd", (i * .07) + "s"); });
})();
