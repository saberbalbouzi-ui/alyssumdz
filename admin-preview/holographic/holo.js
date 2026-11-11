/* ALYSSUM — لوحة هولوغرافية (معاينة تجريبية معزولة): بيانات وهمية، بلا شبكة ولا تخزين خارجي. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ───────── أيقونات (خط واحد، تتبع currentColor) ───────── */
  var P = {
    home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
    box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    store: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9c0 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 4 2 4 0M9 20v-6h6v6"/>',
    palette: '<path d="M12 3a9 9 0 100 18c1.6 0 2-1 1.4-2-.8-1.5.2-3 2-3H18a3 3 0 003-3c0-5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
    chev: '<path d="M6 9l6 6 6-6"/>',
    bell: '<path d="M6 17V11a6 6 0 1112 0v6l1.5 2h-15zM10 21h4"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
    refresh: '<path d="M20 11a8 8 0 00-14-4L4 9M4 4v5h5M4 13a8 8 0 0014 4l2-2M20 20v-5h-5"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 11-12 0c0-4.5 6-11 6-11z"/>',
    book: '<path d="M3 5.5C5.5 4 9 4 12 6c3-2 6.5-2 9-.5V19c-2.5-1.5-6-1.5-9 .5-3-2-6.5-2-9-.5z"/><path d="M12 6v13.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5M3 17.5l9 5 9-5" opacity=".7"/>',
    cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    trend: '<path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 15h18M9 4v16M15 4v16"/>'
  };
  function icon(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || "") + "</svg>"; }
  function paintIcons(root) { $$("[data-i]", root).forEach(function (e) { e.innerHTML = icon(e.getAttribute("data-i")); e.style.display = "inline-flex"; }); }

  /* ───────── أدوات ───────── */
  var nf = new Intl.NumberFormat("fr-FR");
  function fmt(n) { return nf.format(Math.round(n)).replace(/ | /g, " "); }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s + 0x6d2b79f5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var toastT;
  function toast(m) { var t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2600); }

  /* ───────── بيانات تجريبية (حتمية) ───────── */
  var PERIODS = {
    today: { n: 8, sub: "اليوم", geo: "طلباً اليوم", lab: ["00", "03", "06", "09", "12", "15", "18", "21"], seed: 11, scale: 0.16 },
    week: { n: 7, sub: "آخر 7 أيام", geo: "طلباً هذا الأسبوع", lab: ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"], seed: 7, scale: 1 },
    month: { n: 15, sub: "آخر 30 يوماً", geo: "طلباً هذا الشهر", lab: ["1", "3", "5", "7", "9", "11", "13", "15", "17", "19", "21", "23", "25", "27", "29"], seed: 23, scale: 4.2 }
  };
  function build(key) {
    var c = PERIODS[key], r = rng(c.seed), sales = [], orders = [], i;
    for (i = 0; i < c.n; i++) {
      var x = c.n > 1 ? i / (c.n - 1) : 0.5, wave = 0.07 + 0.78 * Math.exp(-Math.pow((x - 0.33) / 0.13, 2)) + 0.98 * Math.exp(-Math.pow((x - 0.72) / 0.1, 2)) + r() * 0.07;
      var s = Math.max(0.12, wave) * 24000 * c.scale / (key === "month" ? 2 : 1) * (key === "today" ? 2.2 : 1);
      sales.push(Math.round(s / 100) * 100); orders.push(Math.max(1, Math.round(s / 3400)));
    }
    var tS = sales.reduce(function (a, b) { return a + b; }, 0), tO = orders.reduce(function (a, b) { return a + b; }, 0);
    var st = [["pending", "في انتظار التأكيد", "#3b8bff", 0], ["prep", "قيد التجهيز", "#ff8a3c", Math.round(tO * 0.2)], ["road", "في الطريق", "#19e08a", Math.round(tO * 0.17)], ["done", "تم التسليم", "#ffc23c", 0], ["fail", "فشل / ملغاة", "#ff5fb3", Math.max(1, Math.round(tO * 0.04))]];
    st[3][3] = Math.max(0, tO - st[1][3] - st[2][3] - st[4][3]);
    return { sales: sales, orders: orders, tS: tS, tO: tO, avg: tO ? tS / tO : 0, st: st, c: c, pend: st[0][3] };
  }
  var state = { p: "week", t: "sales", data: null };

  /* ───────── القائمة الجانبية ───────── */
  var NAV = [
    { id: "home", t: "الرئيسية", i: "home", ch: [] },
    { id: "products", t: "المنتجات", i: "box", ch: ["قائمة المنتجات", "التصنيفات", "المخزون والتكلفة", "العروض والكوبونات"] },
    { id: "store", t: "المتجر", i: "store", ch: ["الطلبات", "الزبائن", "التوصيل", "السلات المتروكة", "المدفوعات"] },
    { id: "look", t: "المظهر", i: "palette", ch: ["القوالب", "مطوّر الصفحات", "الألوان والخطوط", "الصور والوسائط"] },
    { id: "addons", t: "إضافات", i: "grid", ch: ["الدفع والشحن", "التسويق والتتبع", "التقارير", "أدوات الصور"] },
    { id: "settings", t: "الإعدادات العامة", i: "gear", ch: ["معلومات المتجر", "الفريق والصلاحيات", "الإشعارات", "النسخ الاحتياطي"] },
    { id: "site", t: "إعدادات الموقع", i: "globe", ch: ["النطاق", "محركات البحث", "الصفحات القانونية"] }
  ];
  var navState = { open: "", act: "home", sub: "" };
  function renderNav(filter) {
    var q = (filter || "").trim(), html = "", shown = 0;
    NAV.forEach(function (g) {
      var kids = g.ch.filter(function (k) { return !q || k.indexOf(q) > -1 || g.t.indexOf(q) > -1; });
      var match = !q || g.t.indexOf(q) > -1 || kids.length;
      if (!match) return; shown++;
      var open = q ? kids.length > 0 && g.ch.length : navState.open === g.id;
      html += '<div class="nav-g' + (open ? " open" : "") + (navState.act === g.id ? " act" : "") + '" data-g="' + g.id + '"><button type="button" aria-expanded="' + !!open + '"><span class="ic">' + icon(g.i) + '</span><span class="tx">' + g.t + "</span>" + (g.ch.length ? '<span class="ch">' + icon("chev") + "</span>" : "") + "</button>";
      if (g.ch.length) html += '<div class="sub-l"><div>' + (q ? kids : g.ch).map(function (k) { return '<a href="#" data-k="' + k + '"' + (navState.sub === k ? ' class="on"' : "") + ">" + k + "</a>"; }).join("") + "</div></div>";
      html += "</div>";
    });
    $("#nav").innerHTML = html; $("#nav-empty").hidden = shown > 0;
  }
  $("#nav").addEventListener("click", function (e) {
    var a = e.target.closest("a[data-k]"), b = e.target.closest(".nav-g > button"); if (!a && !b) return;
    if (a) { e.preventDefault(); navState.act = a.closest(".nav-g").dataset.g; navState.sub = a.dataset.k; renderNav($("#q").value); toast("معاينة تجريبية — «" + a.dataset.k + "» لا ينقلك لأي صفحة فعلية"); return; }
    var g = b.parentNode.dataset.g, d = NAV.filter(function (x) { return x.id === g; })[0];
    if (!d.ch.length) { navState.act = g; navState.open = ""; navState.sub = ""; } else { navState.open = navState.open === g ? "" : g; }
    renderNav($("#q").value);
  });
  $("#q").addEventListener("input", function () { renderNav(this.value); });

  /* ───────── المؤشرات ───────── */
  function kpiHtml(k, i) {
    var vis = k.vis;
    return '<article class="card kpi reveal" style="--d:' + (i + 3) + '" tabindex="0"><div class="kpi-h"><span>' + k.t + "</span>" + icon(k.i) + "</div>" + vis + '<div><div class="kpi-v" data-v="' + k.v + '" data-s="' + (k.s || "") + '">0</div>' + (k.d != null ? '<div class="kpi-d"><span>عن الفترة السابقة</span><span class="' + (k.d < 0 ? "dn" : "up") + '">' + Math.abs(k.d) + "% " + (k.d < 0 ? "▼" : "▲") + "</span></div>" : '<div class="kpi-d"><span>تحتاج إلى إجراء</span></div>') + "</div></article>";
  }
  function sparkSvg(vals, col, id) {
    var w = 120, h = 44, mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals), pts = vals.map(function (v, i) { return [i / (vals.length - 1) * w, h - 4 - (v - mn) / ((mx - mn) || 1) * (h - 10)]; });
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
    return '<svg class="spark" viewBox="0 0 ' + w + " " + h + '" style="--c:' + col + ';--len:' + Math.round(w * 1.6) + '" aria-hidden="true"><defs><linearGradient id="sg' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".5"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs><path class="ar" d="' + d + " L" + w + " " + h + " L0 " + h + 'Z" style="fill:url(#sg' + id + ')"/><path class="ln" d="' + d + '"/>' + pts.map(function (q) { return '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="2.6" fill="#7fc4ff" style="filter:drop-shadow(0 0 4px #2f9bff)"/>'; }).join("") + '</svg>';
  }
  function countUp(el) {
    var to = Number(el.dataset.v), suf = el.dataset.s, t0 = performance.now(), dur = REDUCED ? 1 : 900;
    function put(v) { el.innerHTML = '<span class="ltr">' + fmt(v) + "</span>" + (suf ? "<small>" + suf + "</small>" : ""); }
    (function step(t) { var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); put(to * e); if (k < 1) requestAnimationFrame(step); else put(to); })(t0);
  }
  function renderKpis() {
    var d = state.data, base = $("#kpis"), bars = d.sales.slice(-7).map(function (v, i, a) { var m = Math.max.apply(null, a); return '<i style="height:' + Math.max(18, v / m * 100) + '%;animation-delay:' + i * 60 + 'ms"></i>'; }).join("");
    var k = [
      { t: "المبيعات", i: "trend", v: Math.round(d.tS), s: "دج", d: d.c.seed % 2 ? 25 : -8, vis: '<img class="kpi-art bars" src="img/bars.webp" width="140" height="84" alt="" aria-hidden="true">' },
      { t: "الطلبات", i: "cube", v: d.tO, d: -6, vis: sparkSvg(d.orders, "#22e7ff", "o") },
      { t: "في انتظار التأكيد", i: "clock", v: d.pend, d: null, vis: '<img class="kpi-art clip" src="img/clip.webp" width="128" height="92" alt="" aria-hidden="true">' },
      { t: "متوسط قيمة الطلب", i: "layers", v: Math.round(d.avg), s: "دج", d: -30, vis: '<img class="kpi-art coins" src="img/coins.webp" width="144" height="94" alt="" aria-hidden="true">' }
    ];
    base.innerHTML = k.map(kpiHtml).join(""); paintIcons(base); $$(".kpi-v", base).forEach(countUp);
    $("#geo-count").textContent = fmt(d.tO) + " " + d.c.geo;
  }

  /* ───────── الحلقة ───────── */
  function renderDonut() {
    var d = state.data, R = 76, C = 2 * Math.PI * R, tot = d.tO || 1, off = 0, svg = $("#donut"), gap = 3;
    svg.innerHTML = '<circle cx="100" cy="100" r="' + R + '" stroke="rgba(120,255,220,.1)" style="stroke-width:22"/>' + d.st.map(function (s, i) {
      var len = Math.max(0, s[3] / tot * C - gap), c = '<circle data-i="' + i + '" cx="100" cy="100" r="' + R + '" stroke="' + s[2] + '" style="color:' + s[2] + '" stroke-dasharray="' + (REDUCED ? len : 0) + " " + C + '" stroke-dashoffset="' + -off + '" stroke-linecap="butt"/>';
      off += s[3] / tot * C; return c;
    }).join("");
    if (!REDUCED) requestAnimationFrame(function () { requestAnimationFrame(function () { var o = 0; $$("circle[data-i]", svg).forEach(function (c, i) { var len = Math.max(0, d.st[i][3] / tot * C - gap); c.setAttribute("stroke-dasharray", len + " " + C); }); }); });
    $("#donut-n").textContent = fmt(d.tO); $("#status-sub").textContent = d.c.sub;
    $("#legend").innerHTML = d.st.map(function (s, i) { return '<li data-i="' + i + '"><span class="d" style="background:' + s[2] + ";color:" + s[2] + '"></span><span class="l">' + s[1] + '</span><b class="n">' + s[3] + "</b></li>"; }).join("");
  }
  function hot(i) { $$("#donut circle[data-i]").forEach(function (c) { c.classList.toggle("hot", i !== null && c.dataset.i === String(i)); c.classList.toggle("dim", i !== null && c.dataset.i !== String(i)); }); $$("#legend li").forEach(function (l) { l.classList.toggle("hot", i !== null && l.dataset.i === String(i)); }); }
  $("#status").addEventListener("pointerover", function (e) { var t = e.target.closest("[data-i]"); if (t && t.closest("#donut,#legend")) hot(t.dataset.i); });
  $("#status").addEventListener("pointerleave", function () { hot(null); });

  /* ───────── المخطط ───────── */
  var W = 800, H = 300, PADT = 16, PADB = 10;
  function smooth(pts) {
    var d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 0.18;
      d += "C" + (p1[0] + (p2[0] - p0[0]) * t).toFixed(1) + " " + (p1[1] + (p2[1] - p0[1]) * t).toFixed(1) + "," + (p2[0] - (p3[0] - p1[0]) * t).toFixed(1) + " " + (p2[1] - (p3[1] - p1[1]) * t).toFixed(1) + "," + p2[0].toFixed(1) + " " + p2[1].toFixed(1);
    }
    return d;
  }
  var geom = null;
  function renderChart() {
    var d = state.data, vals = state.t === "orders" ? d.orders : d.sales, n = vals.length, mx = Math.max.apply(null, vals) * 1.15, step = niceStep(mx / 4), top = step * 4;
    var xs = function (i) { return n === 1 ? W / 2 : W - 30 - i / (n - 1) * (W - 60); }, ys = function (v) { return PADT + (1 - v / top) * (H - PADT - PADB); };
    // اتجاه RTL: أقدم قيمة على اليمين
    var pts = vals.map(function (v, i) { return [xs(i), ys(v)]; }), line = smooth(pts);
    var area = line + " L" + pts[n - 1][0].toFixed(1) + " " + (H - PADB) + " L" + pts[0][0].toFixed(1) + " " + (H - PADB) + "Z";
    var grid = ""; for (var g = 0; g <= 4; g++) { var y = ys(step * g); grid += '<line class="gl" x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '"/>'; }
    var base = H - PADB, wires = "", hatch = "", k, hx;
    for (k = 1; k <= 11; k++) { var f = 1 - k / 12, wp = pts.map(function (q) { return [q[0], base - (base - q[1]) * f]; }); wires += '<path class="wire" d="' + smooth(wp) + '" stroke="url(#wg)" stroke-width="1" opacity="' + (0.62 - k * 0.04).toFixed(2) + '"/>'; }
    for (hx = 4; hx < W; hx += 6) hatch += '<line class="vh" x1="' + hx + '" x2="' + hx + '" y1="0" y2="' + H + '"/>';
    $("#chart").innerHTML = '<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4ff1a" stop-opacity=".62"/><stop offset=".55" stop-color="#19e08a" stop-opacity=".26"/><stop offset="1" stop-color="#22e7ff" stop-opacity=".04"/></linearGradient><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2fe17"/><stop offset="1" stop-color="#22e7ff"/></linearGradient><clipPath id="clipA"><path d="' + area + '"/></clipPath></defs>' + grid + '<path class="ar" d="' + area + '" fill="url(#ag)"/><g clip-path="url(#clipA)" opacity=".75">' + hatch + '</g>' + wires + '<path class="ln" d="' + line + '"/><line class="cur" id="cur" x1="0" x2="0" y1="0" y2="' + H + '" style="display:none"/>';
    var wrap = $("#plot"); $$(".ylab,.xlab,.dot,.pn", wrap).forEach(function (e) { e.parentNode.removeChild(e); });
    pts.forEach(function (q) { var nd = document.createElement("i"); nd.className = "pn"; nd.style.left = (q[0] / W * 100) + "%"; nd.style.top = (q[1] / H * 100) + "%"; wrap.appendChild(nd); });
    for (g = 0; g <= 4; g++) { var l = document.createElement("span"); l.className = "ylab"; l.style.top = (ys(step * g) / H * 100) + "%"; l.textContent = step * g >= 1000 ? Math.round(step * g / 1000) + " ألف" : step * g; wrap.appendChild(l); }
    var every = n > 9 ? 2 : 1; pts.forEach(function (p, i) { if (i % every) return; var x = document.createElement("span"); x.className = "xlab"; x.style.left = (p[0] / W * 100) + "%"; x.style.transform = "translateX(-50%)"; x.textContent = d.c.lab[i]; wrap.appendChild(x); });
    var dot = document.createElement("i"); dot.className = "dot"; dot.hidden = true; dot.style.transform = "translate(-50%,-50%)"; wrap.appendChild(dot);
    geom = { pts: pts, vals: vals, n: n, dot: dot };
    var ch = $("#chart"); ch.classList.remove("rv"); void ch.getBoundingClientRect(); ch.classList.add("rv");
  }
  function niceStep(x) { var p = Math.pow(10, Math.floor(Math.log10(x || 1))), m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  function onMove(e) {
    if (!geom) return; var box = $("#plot").getBoundingClientRect(), x = (e.clientX - box.left) / box.width * W, bi = 0, bd = 1e9;
    geom.pts.forEach(function (p, i) { var dd = Math.abs(p[0] - x); if (dd < bd) { bd = dd; bi = i; } });
    var p = geom.pts[bi], tip = $("#tip"), v = geom.vals[bi], cur = $("#cur");
    cur.style.display = ""; cur.setAttribute("x1", p[0]); cur.setAttribute("x2", p[0]);
    geom.dot.hidden = false; geom.dot.style.left = (p[0] / W * 100) + "%"; geom.dot.style.top = (p[1] / H * 100) + "%";
    tip.hidden = false; tip.style.left = (p[0] / W * 100) + "%"; tip.style.top = (p[1] / H * 100) + "%"; tip.style.transform = "translate(-50%,-125%)";
    tip.innerHTML = state.data.c.lab[bi] + '<b><span class="ltr">' + fmt(v) + "</span>" + (state.t === "orders" ? " طلب" : " دج") + "</b>";
  }
  function onLeave() { $("#tip").hidden = true; if (geom) geom.dot.hidden = true; var c = $("#cur"); if (c) c.style.display = "none"; }
  var cw = $("#plot"); cw.addEventListener("pointermove", onMove); cw.addEventListener("pointerleave", onLeave); cw.addEventListener("pointerdown", onMove);

  function renderTable() {
    var d = state.data, rows = d.c.lab.map(function (l, i) { return "<tr><td>" + l + "</td><td>" + d.orders[i] + "</td><td>" + fmt(d.sales[i]) + " دج</td><td>" + fmt(d.sales[i] / d.orders[i]) + " دج</td></tr>"; }).join("");
    $("#table-w").innerHTML = "<table><thead><tr><th>الفترة</th><th>الطلبات</th><th>المبيعات</th><th>متوسط الطلب</th></tr></thead><tbody>" + rows + "</tbody></table>";
  }
  function renderPanel() {
    var tb = state.t === "table"; $("#chart-w").hidden = tb; $("#table-w").hidden = !tb;
    if (tb) renderTable(); else renderChart();
  }

  /* ───────── تحديث كل شيء ───────── */
  function refresh() { state.data = build(state.p); renderKpis(); renderDonut(); renderPanel(); }
  $(".periods").addEventListener("click", function (e) { var b = e.target.closest("button[data-p]"); if (!b) return; state.p = b.dataset.p; $$(".periods button").forEach(function (x) { var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); }); refresh(); });
  $(".tabs").addEventListener("click", function (e) { var b = e.target.closest("button[data-t]"); if (!b) return; state.t = b.dataset.t; $$(".tabs button").forEach(function (x) { var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); }); renderPanel(); });
  document.addEventListener("keydown", function (e) {
    var k = String(e.key || ""), tgt = e.target; if (tgt && /input|textarea/i.test(tgt.tagName) && k !== "Escape") return;
    if (k === "/") { e.preventDefault(); $("#q").focus(); } else if (k === "Escape") { $("#q").value = ""; renderNav(""); document.activeElement && document.activeElement.blur && document.activeElement.blur(); }
    else if (k === "1") $('[data-p="today"]').click(); else if (k === "2") $('[data-p="week"]').click(); else if (k === "3") $('[data-p="month"]').click();
  });

  /* ───────── أزرار الشريط ───────── */
  function setTheme(t) { document.documentElement.setAttribute("data-theme", t); $$("[data-theme-set]").forEach(function (b) { var on = b.dataset.themeSet === t; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); }); try { sessionStorage.setItem("holo_theme", t); } catch (e) { } }
  $$("[data-theme-set]").forEach(function (b) { b.addEventListener("click", function () { setTheme(b.dataset.themeSet); }); });
  try { var th = sessionStorage.getItem("holo_theme"); if (th === "light" || th === "dark") setTheme(th); } catch (e) { }
  [["#btn-ask", "معاينة تجريبية — المساعد غير متصل هنا"], ["#btn-upd", "لا تحديثات: هذه نسخة معاينة معزولة"], ["#btn-ver", "لا يحدّث المعاينة: النسخة الحقيقية لم تُمسّ"], ["#btn-cache", "معاينة تجريبية — لا مسح فعلي للكاش"], ["#btn-out", "معاينة تجريبية — لا جلسة لإنهائها"], ["#btn-newp", "معاينة تجريبية — لا إنشاء فعلي لمنتج"], ["#btn-all", "معاينة تجريبية — لا يفتح الطلبات"]].forEach(function (a) { $(a[0]).addEventListener("click", function () { toast(a[1]); }); });

  /* ───────── جسيمات الخلفية (خفيفة، تتوقف مع الإخفاء) ───────── */
  (function particles() {
    var cv = $("#fx"), cx = cv.getContext("2d"), w = 0, h = 0, dpr = Math.min(2, window.devicePixelRatio || 1), ps = [], raf = 0, last = 0;
    function size() { w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); var n = Math.round(Math.min(70, w * h / 22000)); ps = []; var r = rng(5); for (var i = 0; i < n; i++) ps.push({ x: r() * w, y: r() * h, vx: (r() - .5) * .12, vy: -.05 - r() * .16, r: .6 + r() * 1.6, c: r() > .5 ? "226,254,23" : "34,231,255", a: .25 + r() * .5 }); }
    function draw(t) {
      raf = requestAnimationFrame(draw); if (t - last < 33) return; last = t; cx.clearRect(0, 0, w, h);
      for (var i = 0; i < ps.length; i++) { var p = ps[i]; p.x += p.vx; p.y += p.vy; if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; } if (p.x < -4) p.x = w + 4; if (p.x > w + 4) p.x = -4; cx.beginPath(); cx.fillStyle = "rgba(" + p.c + "," + p.a + ")"; cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill(); }
    }
    function start() { if (!raf && !REDUCED) raf = requestAnimationFrame(draw); }
    function stop() { cancelAnimationFrame(raf); raf = 0; }
    size(); addEventListener("resize", function () { size(); }); document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); }); start();
  })();

  /* ───────── تشغيل ───────── */
  paintIcons(document); renderNav(""); refresh();
  $$(".hero-txt,.hero-vis,.hero-geo,.toolbar,.status,.chart,.side").forEach(function (e, i) { e.classList.add("reveal"); e.style.setProperty("--d", i); });
})();
