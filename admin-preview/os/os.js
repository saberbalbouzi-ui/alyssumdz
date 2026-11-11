/* ALYSSUM OS — حالة واجهة حقيقية + بيانات تجريبية حتمية. لا اتصال بالمتجر ولا بأي API. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var nf = new Intl.NumberFormat("fr-FR");
  function fmt(n) { return nf.format(Math.round(n)).replace(/[  ]/g, " "); }
  function pct(n, d) { return d ? Math.round(n / d * 1000) / 10 : 0; }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s + 0x6d2b79f5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var toastT; function toast(m) { var t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2800); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ───────── أيقونات ───────── */
  var P = {
    home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>', box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>', cart: '<path d="M3 4h2.5l2 11h10l2-8H7"/><circle cx="9" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/>',
    store: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9c0 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 4 2 4 0M9 20v-6h6v6"/>', palette: '<path d="M12 3a9 9 0 100 18c1.6 0 2-1 1.4-2-.8-1.5.2-3 2-3H18a3 3 0 003-3c0-5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    puzzle: '<path d="M10 4a2 2 0 114 0v2h4v4h-2a2 2 0 100 4h2v4h-4v-2a2 2 0 10-4 0v2H6v-4h2a2 2 0 100-4H6V6h4z"/>', mega: '<path d="M4 10v4h3l7 4V6L7 10zM17 9a4 4 0 010 6"/>', users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6M16 5a3 3 0 010 6M18 14c2 .6 3 2.4 3 5"/>',
    chart: '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    chev: '<path d="M6 9l6 6 6-6"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>', bell: '<path d="M6 17V11a6 6 0 1112 0v6l1.5 2h-15zM10 21h4"/>', expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>', money: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1 1-1.8 2.5-1.8s2.5.8 2.5 1.8-1 1.6-2.5 1.8-2.5.8-2.5 1.8 1 1.8 2.5 1.8 2.5-.8 2.5-1.8"/>', funnel: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>', receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>', trend: '<path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>', alert: '<path d="M12 4l9 16H3zM12 10v4M12 17h.01"/>', check: '<path d="M5 12.5l4.5 4.5L19 7"/>'
  };
  function icon(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || "") + "</svg>"; }
  function paintIcons(r) { $$("[data-i]", r).forEach(function (e) { e.innerHTML = icon(e.getAttribute("data-i")); e.style.display = "inline-flex"; e.style.width = e.style.width || "100%"; }); }
  paintIcons(document);

  /* ───────── بيانات تجريبية حتمية ───────── */
  var ST = { pending: { l: "بانتظار التأكيد", c: "#4d9bff" }, prep: { l: "قيد التجهيز", c: "#ff9a4d" }, road: { l: "في الطريق", c: "#2cf0a0" }, done: { l: "تم التسليم", c: "#ffc93c" }, fail: { l: "فشل / ملغاة", c: "#ff6bb5" } };
  var ST_KEYS = ["pending", "prep", "road", "done", "fail"], NEXT = { pending: ["prep", "تأكيد"], prep: ["road", "شحن"], road: ["done", "تسليم"] };
  var CUST = ["أمينة ب.", "يوسف ك.", "سلمى ح.", "كريم م.", "ليلى ع.", "رضا ز.", "نور الدين ق.", "هدى س.", "إلياس ط.", "ريم ف."], WIL = ["الجزائر", "وهران", "قسنطينة", "سطيف", "عنابة", "البليدة", "باتنة", "تيزي وزو"], TOT = [1800, 1800, 3200, 3200, 4500];
  var DAY = 864e5, NOW = Date.now(), sod = new Date(); sod.setHours(0, 0, 0, 0);
  var R = rng(77), seq = 1000, orders = [];
  function pick(a) { return a[Math.floor(R() * a.length)]; }
  function status(d) { var r = R(), w = d === 0 ? [.3, .35, .25, 0, .1] : d === 1 ? [.08, .2, .42, .25, .05] : d === 2 ? [0, .07, .25, .6, .08] : d < 5 ? [0, 0, .04, .85, .11] : [0, 0, 0, .89, .11], a = 0, k; for (k = 0; k < 5; k++) { a += w[k]; if (r < a) return ST_KEYS[k]; } return "done"; }
  (function gen() {
    for (var d = 59; d >= 0; d--) {
      var x = d < 30 ? (29 - d) / 29 : (59 - d) / 29, c = d === 0 ? 6 : d < 30 ? Math.round(1 + 4.5 * (Math.exp(-Math.pow((x - .33) / .13, 2)) * .8 + Math.exp(-Math.pow((x - .86) / .1, 2))) + R() * 1.2) : Math.round(1 + 3.2 * Math.exp(-Math.pow((x - .5) / .2, 2)) + R() * 1.5), i;
      for (i = 0; i < c; i++) { var h = d === 0 ? 8 + Math.floor(R() * Math.max(1, new Date().getHours() - 8)) : 8 + Math.floor(R() * 14), ts = sod.getTime() - d * DAY + h * 36e5 + Math.floor(R() * 59) * 6e4; if (ts > NOW) ts = NOW - Math.floor(R() * 5) * 6e4; orders.push({ id: "A" + (++seq), cu: pick(CUST), wl: pick(WIL), tt: pick(TOT), ts: ts, st: status(d), d: d }); }
    }
    orders.sort(function (a, b) { return b.ts - a.ts; });
  })();
  var stock = [{ id: "p1", n: "عسل التركيز 500غ", q: 4, max: 60, min: 10 }, { id: "p2", n: "عسل الذاكرة 500غ", q: 18, max: 60, min: 10 }, { id: "p3", n: "خلطة الأعشاب", q: 42, max: 80, min: 15 }, { id: "p4", n: "زيت الحبة السوداء", q: 7, max: 40, min: 10 }, { id: "p5", n: "كريم العناية", q: 26, max: 50, min: 10 }];
  var feed = [{ id: 1, t: "طلب جديد #A" + seq + " بانتظار التأكيد", c: "#4d9bff", ts: NOW - 6 * 6e4, un: true }, { id: 2, t: "مخزون «عسل التركيز» منخفض (4 فقط)", c: "#ff6b8b", ts: NOW - 22 * 6e4, un: true }, { id: 3, t: "اكتمل تسليم 3 طلبات إلى وهران", c: "#ffc93c", ts: NOW - 70 * 6e4, un: true }, { id: 4, t: "نسخة احتياطية تجريبية مكتملة", c: "#2cf0a0", ts: NOW - 5 * 36e5, un: false }, { id: 5, t: "تحديث تجريبي للنظام جاهز", c: "#a58bff", ts: NOW - 9 * 36e5, un: false }];
  var fid = 10;
  var S = { p: "week", m: "sales", st: null, focus: -1, nav: "home", open: "", sub: "", storeOpen: true, kp: "", ai: [], view: "" };

  /* ───────── استعلامات على الحالة ───────── */
  var LEN = { today: 1, week: 7, month: 30 };
  function inWin(o, p, prev) { var L = LEN[p], lo = prev ? L : 0, hi = prev ? 2 * L - 1 : L - 1; return o.d >= lo && o.d <= hi; }
  function win(p, prev) { return orders.filter(function (o) { return inWin(o, p, prev); }); }
  function ok(o) { return o.st !== "fail"; }
  function sum(a) { return a.filter(ok).reduce(function (s, o) { return s + o.tt; }, 0); }
  function visits(a, prev) { return Math.round(a.length * (prev ? 30 : 27.5) + (a.length ? 40 : 0)); }
  function bucketOf(o, p) { if (p === "today") return Math.floor(new Date(o.ts).getHours() / 3); if (p === "week") return 6 - o.d; if (p === "month") return 14 - Math.floor(o.d / 2); return 0; }
  function nB(p) { return p === "today" ? 8 : p === "week" ? 7 : 15; }
  function labels(p) {
    if (p === "today") return ["00", "03", "06", "09", "12", "15", "18", "21"];
    var out = [], i; for (i = 0; i < nB(p); i++) { var d = p === "week" ? 6 - i : (14 - i) * 2 + 1, dt = new Date(sod.getTime() - d * DAY); out.push(p === "week" ? dt.toLocaleDateString("ar-DZ", { weekday: "long" }) : String(dt.getDate())); } return out;
  }
  function series(p, prev, metric) {
    var n = nB(p), s = [], i, a = win(p, prev); for (i = 0; i < n; i++) s.push(0);
    a.forEach(function (o) { var b = prev ? bucketOf({ d: o.d - LEN[p], ts: o.ts - LEN[p] * DAY }, p) : bucketOf(o, p); if (b < 0 || b >= n) return; if (metric === "orders") s[b] += 1; else if (ok(o)) s[b] += o.tt; });
    return s;
  }
  function metrics(p) {
    var a = win(p), b = win(p, true), r = sum(a), rp = sum(b), na = a.filter(ok).length, nb = b.filter(ok).length, va = visits(a), vb = visits(b), cv = pct(na, va), cp = pct(nb, vb), aov = na ? r / na : 0, ap = nb ? rp / nb : 0;
    function dl(x, y) { return y ? Math.round((x - y) / y * 100) : 0; }
    return { rev: r, revD: dl(r, rp), orders: a.length, na: na, conv: cv, convD: Math.round((cv - cp) * 10) / 10, aov: aov, aovD: dl(aov, ap), visits: va };
  }
  function counts(a) { var c = { pending: 0, prep: 0, road: 0, done: 0, fail: 0 }; a.forEach(function (o) { c[o.st]++; }); return c; }
  function focusOrders(a) { if (S.focus < 0) return a; return a.filter(function (o) { return bucketOf(o, S.p) === S.focus; }); }
  function ago(ts) { var m = Math.max(0, Math.round((NOW - ts) / 6e4)); if (m < 1) return "الآن"; if (m < 60) return "منذ " + m + " د"; var h = Math.round(m / 60); if (h < 24) return "منذ " + h + " س"; return "منذ " + Math.round(h / 24) + " يوماً"; }
  function stockC(s) { return s.q <= s.min * .5 ? "#ff6b8b" : s.q <= s.min ? "#ffb340" : "#2cf0a0"; }
  function lowStock() { return stock.filter(function (s) { return s.q <= s.min; }); }
  function addFeed(t, c) { feed.unshift({ id: ++fid, t: t, c: c || "#2be4ff", ts: Date.now(), un: true, fresh: true }); }
  function funnelData(m) { var V = m.visits, st = [["الزيارات", V], ["مشاهدة المنتج", Math.round(V * .58)], ["إضافة للسلة", Math.round(V * .16)], ["بدء الدفع", Math.round(V * .075)], ["طلبات مؤكدة", m.na]]; return st; }

  /* ───────── الملاحة ───────── */
  var NAV = [
    { id: "home", t: "الرئيسية", i: "home" }, { id: "products", t: "المنتجات", i: "box", ch: [["قائمة المنتجات"], ["التصنيفات"], ["المخزون والتكلفة", "inventory"]] },
    { id: "orders", t: "الطلبات", i: "cart", ch: [["كل الطلبات", "orders"], ["بانتظار التأكيد", "orders:pending"], ["قيد التجهيز", "orders:prep"], ["في الطريق", "orders:road"]] },
    { id: "store", t: "المتجر", i: "store", ch: [["التوصيل"], ["الدفع"], ["الصفحات"]] }, { id: "look", t: "المظهر", i: "palette", ch: [["القوالب"], ["مطوّر الصفحات"], ["الألوان والخطوط"]] },
    { id: "addons", t: "الإضافات", i: "puzzle", ch: [["المتجر الإضافي"], ["إضافاتي"]] }, { id: "mkt", t: "التسويق", i: "mega", ch: [["الكوبونات"], ["الحملات الإعلانية"], ["البريد والرسائل"]] },
    { id: "cust", t: "العملاء", i: "users", ch: [["قائمة العملاء"], ["المجموعات"]] }, { id: "an", t: "التحليلات", i: "chart", ch: [["نظرة عامة", "analytics"], ["المبيعات", "analytics"], ["التحويل", "analytics"]] },
    { id: "set", t: "الإعدادات", i: "gear", ch: [["معلومات المتجر"], ["الفريق والصلاحيات"], ["النسخ الاحتياطي"]] }
  ];
  function renderNav() {
    var pend = counts(win("month")).pending, low = lowStock().length;
    $("#nav").innerHTML = '<div class="nv-h">ALYSSUM · القائمة</div>' + NAV.map(function (g) {
      var bd = g.id === "orders" && pend ? '<i class="bd">' + pend + "</i>" : g.id === "products" && low ? '<i class="bd">' + low + "</i>" : "";
      return '<div class="nv' + (S.nav === g.id ? " act" : "") + (S.open === g.id ? " open" : "") + '" data-g="' + g.id + '"><button type="button" aria-expanded="' + (S.open === g.id) + '">' + icon(g.i) + "<span>" + g.t + "</span>" + bd + (g.ch ? '<span class="ch">' + icon("chev") + "</span>" : "") + "</button>" +
        (g.ch ? '<div class="nv-sub"><div>' + g.ch.map(function (c) { return '<a href="#" data-k="' + c[0] + '" data-w="' + (c[1] || "") + '"' + (S.sub === c[0] ? ' class="on"' : "") + ">" + c[0] + "</a>"; }).join("") + "</div></div>" : "") + "</div>";
    }).join("") + '<div class="nv-qa"><div class="nv-h">إجراءات سريعة</div><button type="button" data-qa="confirm"><span>تأكيد المعلّقة' + (pend ? " (" + pend + ")" : "") + '</span></button><button type="button" data-qa="order"><span>+ طلب يدوي</span></button><button type="button" data-qa="product"><span>+ منتج جديد</span></button></div>' + '<div class="nv-foot"><b>OS · نسخة المعاينة</b>كل الأرقام تجريبية ولا اتصال بالمتجر.</div>';
  }
  $("#nav").addEventListener("click", function (e) {
    var q = e.target.closest("[data-qa]"); if (q) { if (q.dataset.qa === "confirm") { if (!confirmAll()) toast("لا طلبات بانتظار التأكيد"); } else toast("معاينة تجريبية — «" + q.textContent.replace("+ ", "") + "» غير مفعّل"); return; }
    var a = e.target.closest("a[data-k]"), b = e.target.closest(".nv > button");
    if (a) { e.preventDefault(); var g = a.closest(".nv").dataset.g; S.nav = g; S.sub = a.dataset.k; crumb(g, a.dataset.k); renderNav(); var w = a.dataset.w; if (w) openWs(w.split(":")[0], w.split(":")[1]); else toast("معاينة تجريبية — «" + a.dataset.k + "» لا ينقلك لصفحة فعلية"); return; }
    if (b) { var id = b.parentNode.dataset.g, d = NAV.filter(function (x) { return x.id === id; })[0]; S.nav = id; S.sub = ""; if (!d.ch) { S.open = ""; crumb(id); closeWs(); } else S.open = S.open === id ? "" : id; renderNav(); }
  });
  function crumb(g, sub) { var d = NAV.filter(function (x) { return x.id === g; })[0]; $("#crumb").innerHTML = g === "home" ? "<b>الرئيسية</b>" : "<i>الرئيسية ›</i> " + (sub ? d.t + " <i>›</i> <b>" + sub + "</b>" : "<b>" + d.t + "</b>"); }

  /* ───────── الرسوم ───────── */
  var chart = new OSCharts.SalesChart($("#sales-cv"), { reduced: REDUCED, fmtAxis: function (v) { return S.m === "orders" ? String(Math.round(v)) : v >= 1000 ? Math.round(v / 1000) + " ألف" : String(Math.round(v)); }, onHover: function (i, pos) {
    var tip = $("#cv-tip"); if (i < 0 || !pos) { tip.hidden = true; return; } var cur = series(S.p, false, S.m), prv = series(S.p, true, S.m), v = cur[i], pv = prv[i] || 0, d = pv ? Math.round((v - pv) / pv * 100) : 0, wr = $("#cv-wrap").getBoundingClientRect();
    tip.innerHTML = labels(S.p)[i] + "<b>" + fmt(v) + (S.m === "orders" ? " طلب" : " دج") + '</b><em class="' + (d >= 0 ? "up" : "dn") + '">' + (d >= 0 ? "▲" : "▼") + " " + Math.abs(d) + "% عن السابقة</em>"; tip.style.left = (pos.x - wr.left) + "px"; tip.style.top = (pos.y - wr.top) + "px"; tip.hidden = false;
  }, onPick: function (i) { S.focus = S.focus === i ? -1 : i; renderFocus(); renderCenter(); renderDeck(); } });
  var core = new OSCharts.AICore($("#aicore"), { reduced: REDUCED, size: 158 });

  function renderIns() { var cur = series(S.p, false, S.m), lb = labels(S.p), mx = Math.max.apply(null, cur), bi = cur.indexOf(mx), av = cur.reduce(function (a, b) { return a + b; }, 0) / (cur.length || 1), u = S.m === "orders" ? " طلب" : " دج"; $("#chart-ins").innerHTML = '<span>الذروة: ' + lb[bi] + ' <b class="ltr">' + fmt(mx) + "</b>" + u + '</span><span>المتوسط: <b class="ltr">' + fmt(av) + "</b>" + u + "</span>"; }
  function renderChart() {
    renderIns();
    var cur = series(S.p, false, S.m), prv = series(S.p, true, S.m), n = cur.length, avg = (cur[n - 1] + cur[n - 2] + cur[n - 3]) / 3 || 0;
    chart.setData({ cur: cur, prev: prv, fc: [Math.round(avg * 1.05), Math.round(avg * 1.09)], labels: labels(S.p), focus: S.focus });
  }
  function renderRadial() {
    var a = focusOrders(win(S.p)), c = counts(a), tot = a.length || 1, svg = $("#radial"), Rr = 94, C = 2 * Math.PI * Rr, off = 0, gap = 5, html = '<circle class="ring-t" cx="130" cy="130" r="' + (Rr + 14) + '"/><circle class="ring-t" cx="130" cy="130" r="' + (Rr - 14) + '"/>';
    ST_KEYS.forEach(function (k) { var len = Math.max(0, c[k] / tot * C - gap); html += '<circle class="seg-p' + (S.st && S.st !== k ? " dim" : "") + (S.st === k ? " hot" : "") + '" data-k="' + k + '" cx="130" cy="130" r="' + Rr + '" stroke="' + ST[k].c + '" style="color:' + ST[k].c + '" stroke-dasharray="' + len + " " + C + '" stroke-dashoffset="' + (-off - gap / 2) + '" transform="rotate(-90 130 130)"/>'; off += c[k] / tot * C; });
    var ang = -Math.PI / 2, i2; for (i2 = 0; i2 < 60; i2++) { var aa = i2 / 60 * Math.PI * 2, r0 = 118, r1 = i2 % 5 ? 121 : 125; html += '<line class="tick" x1="' + (130 + Math.cos(aa) * r0).toFixed(1) + '" y1="' + (130 + Math.sin(aa) * r0).toFixed(1) + '" x2="' + (130 + Math.cos(aa) * r1).toFixed(1) + '" y2="' + (130 + Math.sin(aa) * r1).toFixed(1) + '"/>'; }
    html += '<path class="scan" d="M130 8 A122 122 0 0 1 216 44"/>';
    ang = -Math.PI / 2; ST_KEYS.forEach(function (k) { if (!c[k]) return; var span = c[k] / tot * Math.PI * 2, mid = ang + span / 2; ang += span; var bx = 130 + Math.cos(mid) * 71, by = 130 + Math.sin(mid) * 71; html += '<g class="badge"><circle cx="' + bx.toFixed(1) + '" cy="' + by.toFixed(1) + '" r="10" stroke="' + ST[k].c + '"/><text x="' + bx.toFixed(1) + '" y="' + (by + 4).toFixed(1) + '">' + c[k] + "</text></g>"; });
    html += '<text x="130" y="128" font-size="40" font-weight="900">' + a.length + '</text><text x="130" y="152" font-size="14" font-weight="700" style="fill:var(--mut)">طلب' + (S.focus >= 0 ? " · مُصفّى" : "") + "</text>";
    svg.innerHTML = html;
    $("#rad-leg").innerHTML = ST_KEYS.map(function (k) { return '<li data-k="' + k + '" class="' + (S.st === k ? "on" : "") + '" style="--c:' + ST[k].c + '"><i></i>' + ST[k].l + "<b>" + c[k] + "</b></li>"; }).join("");
  }
  function renderFunnel() {
    var m = metrics(S.p), f = funnelData(m), mx = f[0][1] || 1;
    $("#conv-sub").textContent = "التحويل " + m.conv + "% · تقدير تجريبي";
    var html = ""; f.forEach(function (s, i) { var prev = i ? f[i - 1][1] : s[1], drop = i ? Math.round((1 - s[1] / (prev || 1)) * 100) : 0; html += '<div class="fl"><div class="tx"><b>' + s[0] + "</b><span>" + pct(s[1], mx) + '% من الزيارات</span></div><div class="bar" style="width:' + Math.max(6, s[1] / mx * 52) + '%"></div><div class="nm">' + fmt(s[1]) + '</div><div class="dp">' + (i ? '<span class="ltr">−' + drop + "%</span>" : "") + "</div></div>"; });
    $("#fn").innerHTML = html;
  }
  function renderIntel() {
    var m = metrics(S.p), rev = series(S.p, false, "sales"), cnt = series(S.p, false, "orders"), aovS = rev.map(function (v, i) { return cnt[i] ? v / cnt[i] : 0; }), n = rev.length, first = (rev[0] + rev[1] + rev[2]) / 3 || 1, last = (rev[n - 1] + rev[n - 2] + rev[n - 3]) / 3, tr = Math.round((last - first) / first * 100);
    function spark(v, col, bars) {
      var w = 200, h = 40, mx = Math.max.apply(null, v) || 1, mn = Math.min.apply(null, v), pts = v.map(function (x, i) { return [w - i / (v.length - 1) * w, h - 4 - (x - mn) / ((mx - mn) || 1) * (h - 8)]; });
      if (bars) return '<svg viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none">' + v.map(function (x, i) { var bh = Math.max(3, x / mx * (h - 4)); return '<rect x="' + (w - (i + 1) * (w / v.length) + 2) + '" y="' + (h - bh) + '" width="' + (w / v.length - 4) + '" height="' + bh + '" rx="2" fill="' + col + '" opacity="' + (.35 + x / mx * .6).toFixed(2) + '"/>'; }).join("") + "</svg>";
      var d = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
      return '<svg viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none"><defs><linearGradient id="sg' + col.slice(1) + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".4"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs><path d="' + d + " L0 " + h + " L" + w + " " + h + 'Z" fill="url(#sg' + col.slice(1) + ')" stroke="none"/><path d="' + d + '" stroke="' + col + '" stroke-width="2" style="filter:drop-shadow(0 0 4px ' + col + ')"/></svg>';
    }
    function dl(v, suf) { return '<span class="dl ' + (v >= 0 ? "up" : "dn") + '">' + (v >= 0 ? "▲ " : "▼ ") + Math.abs(v) + (suf || "%") + "</span>"; }
    var K = [
      { id: "rev", i: "money", t: "الإيراد", v: fmt(m.rev), u: "دج", d: dl(m.revD), s: spark(rev, "#dcff1f"), f: "مقارنة بالفترة السابقة" },
      { id: "conv", i: "funnel", t: "معدّل التحويل", v: m.conv + "%", u: "", d: dl(m.convD, " نقطة"), s: spark(cnt, "#2be4ff"), f: fmt(m.visits) + " زيارة · تقدير تجريبي" },
      { id: "aov", i: "receipt", t: "متوسط قيمة الطلب", v: fmt(m.aov), u: "دج", d: dl(m.aovD), s: spark(aovS, "#a58bff"), f: m.na + " طلب مُحتسب" },
      { id: "trend", i: "trend", t: "اتجاه المبيعات", v: (tr >= 0 ? "+" : "") + tr + "%", u: "", d: '<span class="dl ' + (tr >= 0 ? "up" : "dn") + '">' + (tr >= 0 ? "يميل للصعود" : "يميل للهبوط") + "</span>", s: spark(rev, "#2cf0a0", true), f: "آخر 3 فترات مقابل أول 3" }
    ];
    $("#intel").innerHTML = K.map(function (k) { return '<article class="kp' + (S.kp === k.id ? " sel" : "") + '" data-k="' + k.id + '" tabindex="0" role="button" aria-label="' + k.t + '"><div class="kp-h">' + icon(k.i) + "<span>" + k.t + "</span>" + k.d + '</div><div class="kp-v"><span class="ltr">' + k.v + "</span><small>" + k.u + '</small></div><div class="kp-sp">' + k.s + '</div><div class="kp-f">' + k.f + "</div></article>"; }).join("");
  }
  $("#intel").addEventListener("click", function (e) { var k = e.target.closest(".kp"); if (!k) return; S.kp = k.dataset.k; S.m = k.dataset.k === "rev" || k.dataset.k === "trend" ? "sales" : "orders"; $$("#seg-metric button").forEach(function (b) { b.classList.toggle("on", b.dataset.m === S.m); }); openWs("analytics"); });
  $("#intel").addEventListener("keydown", function (e) { if (String(e.key || "") === "Enter") { var k = e.target.closest(".kp"); if (k) k.click(); } });
  function relHl(key) { $("#pn-chart").classList.toggle("hl", key === "rev" || key === "trend"); $("#pn-radial").classList.toggle("hl", key === "aov"); $$(".fl").forEach(function (f) { f.classList.toggle("hl", key === "conv"); }); }
  $("#intel").addEventListener("pointerover", function (e) { var k = e.target.closest(".kp"); relHl(k ? k.dataset.k : ""); });
  $("#intel").addEventListener("pointerleave", function () { relHl(""); });

  /* وحدة الذكاء: اقتراحات سياقية قابلة للتنفيذ */
  function suggestions() {
    var out = [], pend = win("month").filter(function (o) { return o.st === "pending"; }).length, ls = lowStock(), m = metrics(S.p), f = funnelData(m), worst = 0, wd = 0, i;
    if (pend) out.push({ i: "check", t: pend + " طلبات بانتظار التأكيد", b: "تأكيد الكل", fn: function () { confirmAll(); } });
    if (ls.length) out.push({ i: "alert", t: "مخزون «" + ls[0].n.split(" ")[0] + " " + (ls[0].n.split(" ")[1] || "") + "» منخفض (" + ls[0].q + ")", b: "إعادة طلب", fn: function () { restock(ls[0].id); } });
    for (i = 1; i < f.length; i++) { var d = 1 - f[i][1] / (f[i - 1][1] || 1); if (d > wd) { wd = d; worst = i; } }
    out.push({ i: "funnel", t: "أكبر تسرّب عند «" + f[worst][0] + "» (" + Math.round(wd * 100) + "%)", b: "حلّل", fn: function () { openAI("حلّل التحويل"); } });
    out.push({ i: "trend", t: "الإيراد " + (m.revD >= 0 ? "أعلى" : "أقل") + " بـ" + Math.abs(m.revD) + "% عن الفترة السابقة", b: "عرض", fn: function () { S.kp = "rev"; openWs("analytics"); } });
    return out.slice(0, 4);
  }
  var SUG = [];
  function renderAIM() {
    SUG = suggestions(); var pend = win("month").filter(function (o) { return o.st === "pending"; }).length, m = metrics(S.p);
    $("#sugg").innerHTML = SUG.map(function (s, i) { return '<li data-ix="' + i + '" tabindex="0" role="button">' + icon(s.i) + "<span>" + s.t + "</span><em>" + s.b + "</em></li>"; }).join("");
    $("#orbit").innerHTML = '<li>طلبات <b>' + m.orders + "</b></li><li>تنبيه مخزون <b>" + lowStock().length + "</b></li><li>تحويل <b>" + m.conv + "%</b></li><li>معلّقة <b>" + pend + "</b></li>";
    core.setLoad(.3 + Math.min(.7, pend / 10));
  }
  $("#sugg").addEventListener("click", function (e) { var li = e.target.closest("li"); if (li) SUG[Number(li.dataset.ix)].fn(); });
  $("#sugg").addEventListener("keydown", function (e) { if (String(e.key || "") === "Enter") { var li = e.target.closest("li"); if (li) li.click(); } });
  $("#ask-open").addEventListener("click", function () { openAI(); });

  /* ───────── إجراءات تغيّر الحالة (حقيقية في الواجهة) ───────── */
  function advance(id) { var o = orders.filter(function (x) { return x.id === id; })[0]; if (!o || !NEXT[o.st]) return; var nx = NEXT[o.st]; o.st = nx[0]; addFeed("#" + o.id + " ← " + ST[nx[0]].l, ST[nx[0]].c); toast(nx[1] + " #" + o.id + " (تجريبي)"); refresh(); }
  function confirmAll() { var n = 0; orders.forEach(function (o) { if (o.st === "pending") { o.st = "prep"; n++; } }); if (n) { addFeed("تم تأكيد " + n + " طلبات دفعة واحدة", "#2cf0a0"); toast("تم تأكيد " + n + " طلبات (تجريبي)"); refresh(); } return n; }
  function restock(id) { var s = stock.filter(function (x) { return x.id === id; })[0]; if (!s) return; s.q = Math.min(s.max, s.q + 30); addFeed("إعادة طلب «" + s.n + "» — المخزون " + s.q, "#2cf0a0"); toast("أُعيد طلب " + s.n + " (تجريبي)"); refresh(); }

  /* ───────── الطبقة السفلية ───────── */
  function odRow(o, th) {
    var act = NEXT[o.st] ? '<button type="button" class="act-b" data-adv="' + o.id + '">' + NEXT[o.st][1] + "</button>" : '<span class="act-b done">' + (o.st === "done" ? "مكتمل" : "—") + "</span>";
    return '<div class="od' + (o.fresh ? " fresh" : "") + '"><b>#' + o.id + '</b><span class="cu">' + esc(o.cu) + '</span><span class="wl">' + o.wl + '</span><span class="tt"><span class="ltr">' + fmt(o.tt) + "</span> دج</span>" + '<span class="stt" style="--c:' + ST[o.st].c + '">' + ST[o.st].l + "</span>" + act + "</div>";
  }
  function renderDeck() {
    var list = focusOrders(win(S.p)).filter(function (o) { return !S.st || o.st === S.st; }), tags = (S.st ? " · " + ST[S.st].l : "");
    $("#dk-orders").innerHTML = '<header class="ph"><h2>آخر الطلبات' + tags + '</h2><span class="sub">' + list.length + ' طلب</span><button type="button" class="xp" data-xp="orders" aria-label="توسيع"><span data-i="expand"></span></button></header><div class="dk-b">' + (list.length ? list.slice(0, 40).map(function (o) { return odRow(o); }).join("") : '<p style="padding:1rem;color:var(--dim)">لا طلبات مطابقة للتصفية.</p>') + "</div>";
    $("#dk-feed").innerHTML = '<header class="ph"><h2>التنبيهات والنشاط</h2><span class="sub">' + feed.filter(function (f) { return f.un; }).length + ' جديد</span></header><div class="dk-b">' + feed.slice(0, 14).map(function (f) { return '<div class="fd' + (f.un ? "" : " rd") + (f.fresh ? " fresh" : "") + '" data-f="' + f.id + '" style="--c:' + f.c + '"><i></i><div>' + esc(f.t) + "<small>" + ago(f.ts) + "</small></div></div>"; }).join("") + "</div>";
    $("#dk-stock").innerHTML = '<header class="ph"><h2>حالة المخزون</h2><span class="sub">' + lowStock().length + ' تنبيه</span><button type="button" class="xp" data-xp="inventory" aria-label="توسيع"><span data-i="expand"></span></button></header><div class="dk-b">' + stock.map(function (s) { var c = stockC(s); return '<div class="sk" style="--c:' + c + '"><b>' + s.n + '</b><span class="qt">' + s.q + "</span>" + (s.q <= s.min ? '<button type="button" class="act-b sm" data-rs="' + s.id + '">إعادة طلب</button>' : '<span class="act-b sm done">كافٍ</span>') + '<div class="mt"><i style="width:' + Math.max(4, s.q / s.max * 100) + '%"></i></div></div>'; }).join("") + "</div>";
    paintIcons($("#deck")); feed.forEach(function (f) { f.fresh = false; }); orders.forEach(function (o) { o.fresh = false; });
  }
  $("#deck").addEventListener("click", function (e) {
    var a = e.target.closest("[data-adv]"), r = e.target.closest("[data-rs]"), x = e.target.closest("[data-xp]"), f = e.target.closest(".fd");
    if (a) advance(a.dataset.adv); else if (r) restock(r.dataset.rs); else if (x) openWs(x.dataset.xp); else if (f) { var it = feed.filter(function (q) { return q.id === Number(f.dataset.f); })[0]; if (it) { it.un = false; refresh(); } }
  });
  document.addEventListener("click", function (e) { var x = e.target.closest("[data-xp]"); if (x && !x.closest("#deck")) openWs(x.dataset.xp); });

  /* الرادار + المحاور */
  $("#rad-leg").addEventListener("click", function (e) { var li = e.target.closest("li"); if (li) { S.st = S.st === li.dataset.k ? null : li.dataset.k; renderRadial(); renderDeck(); } });
  $("#radial").addEventListener("click", function (e) { var c = e.target.closest(".seg-p"); if (c) { S.st = S.st === c.dataset.k ? null : c.dataset.k; renderRadial(); renderDeck(); } });
  function hotSeg(k) { $$("#radial .seg-p").forEach(function (c) { c.classList.toggle("hot", !!k && c.dataset.k === k || S.st === c.dataset.k); c.classList.toggle("dim", !!(k || S.st) && c.dataset.k !== (k || S.st)); }); $$("#rad-leg li").forEach(function (l) { l.classList.toggle("hot", l.dataset.k === k); }); }
  $("#pn-radial").addEventListener("pointerover", function (e) { var t = e.target.closest("[data-k]"); if (t && t.closest("#radial,#rad-leg")) hotSeg(t.dataset.k); });
  $("#pn-radial").addEventListener("pointerleave", function () { hotSeg(null); });

  function renderFocus() { var c = $("#focus-chip"); if (S.focus < 0) { c.hidden = true; return; } c.hidden = false; c.innerHTML = "تصفية: " + labels(S.p)[S.focus] + ' <button type="button" aria-label="إلغاء التصفية">✕</button>'; }
  $("#focus-chip").addEventListener("click", function () { S.focus = -1; renderFocus(); renderCenter(); renderDeck(); });
  function renderCenter() { renderChart(); renderRadial(); renderFunnel(); renderAIM(); chart.setFocus(S.focus); }
  function refresh() { renderNav(); renderIntel(); renderCenter(); renderDeck(); renderBell(); if (S.view) renderWs(); }
  $("#per").addEventListener("click", function (e) { var b = e.target.closest("button[data-p]"); if (!b) return; S.p = b.dataset.p; S.focus = -1; $$("#per button").forEach(function (x) { var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); }); renderFocus(); refresh(); });
  $("#seg-metric").addEventListener("click", function (e) { var b = e.target.closest("button[data-m]"); if (!b) return; S.m = b.dataset.m; $$("#seg-metric button").forEach(function (x) { x.classList.toggle("on", x === b); }); renderChart(); });

  /* ───────── شريط النظام ───────── */
  var lat = []; for (var li = 0; li < 14; li++) lat.push(36 + Math.round(R() * 14));
  function renderHealth() {
    var w = 56, h = 18, mx = Math.max.apply(null, lat), mn = Math.min.apply(null, lat), d = lat.map(function (v, i) { return (i ? "L" : "M") + (i / (lat.length - 1) * w).toFixed(1) + " " + (h - 2 - (v - mn) / ((mx - mn) || 1) * (h - 4)).toFixed(1); }).join(" ");
    $("#health").innerHTML = '<i></i>الخدمة متّصلة <svg viewBox="0 0 ' + w + " " + h + '"><path d="' + d + '" fill="none" stroke="#2cf0a0" stroke-width="1.6"/></svg><span class="ltr">' + lat[lat.length - 1] + "ms</span>";
  }
  $("#store-tog").addEventListener("click", function () { S.storeOpen = !S.storeOpen; this.classList.toggle("on", S.storeOpen); this.setAttribute("aria-pressed", S.storeOpen); $("#store-lb").textContent = S.storeOpen ? "المتجر مفتوح" : "المتجر مغلق"; addFeed(S.storeOpen ? "أُعيد فتح المتجر" : "أُغلق المتجر مؤقتاً", S.storeOpen ? "#2cf0a0" : "#ff6b8b"); refresh(); toast(S.storeOpen ? "المتجر مفتوح (تجريبي)" : "المتجر مغلق (تجريبي)"); });
  function renderBell() { var n = feed.filter(function (f) { return f.un; }).length, b = $("#bell-n"); b.textContent = n; b.hidden = !n; if (!$("#dd-bell").hidden) bellList(); }
  function bellList() { $("#dd-bell").innerHTML = '<h3>الإشعارات <button type="button" id="mark-all">تعليم الكل كمقروء</button></h3><ul>' + feed.slice(0, 7).map(function (f) { return '<li class="' + (f.un ? "unread" : "rd") + '" data-f="' + f.id + '" style="--c:' + f.c + '"><i></i><div>' + esc(f.t) + "<small>" + ago(f.ts) + "</small></div></li>"; }).join("") + "</ul>"; }
  function closeMenus() { $("#dd-bell").hidden = true; $("#dd-acct").hidden = true; }
  $("#b-bell").addEventListener("click", function (e) { e.stopPropagation(); var h = $("#dd-bell").hidden; closeMenus(); if (h) { bellList(); $("#dd-bell").hidden = false; } });
  $("#dd-bell").addEventListener("click", function (e) { e.stopPropagation(); if (e.target.id === "mark-all") { feed.forEach(function (f) { f.un = false; }); refresh(); return; } var li = e.target.closest("li[data-f]"); if (li) { var it = feed.filter(function (q) { return q.id === Number(li.dataset.f); })[0]; if (it) it.un = false; refresh(); } });
  $("#b-acct").addEventListener("click", function (e) { e.stopPropagation(); var h = $("#dd-acct").hidden; closeMenus(); if (h) { $("#dd-acct").innerHTML = '<button class="itm" type="button">الملف الشخصي</button><button class="itm" type="button">تبديل المتجر</button><button class="itm" type="button">مركز المساعدة</button><button class="itm" type="button">تسجيل الخروج</button>'; $("#dd-acct").hidden = false; } });
  $("#dd-acct").addEventListener("click", function (e) { var b = e.target.closest(".itm"); if (b) { toast("معاينة تجريبية — «" + b.textContent + "» غير مفعّل"); closeMenus(); } });
  document.addEventListener("click", closeMenus);

  /* ───────── الطبقات: مساحات العمل ───────── */
  var layer = $("#layer"), wsChart = null, wsCore = null;
  function closeWs() { layer.hidden = true; layer.innerHTML = ""; S.view = ""; if (wsChart) { wsChart.stop(); wsChart = null; } if (wsCore) { wsCore.stop(); wsCore = null; } }
  layer.addEventListener("click", function (e) { if (e.target === layer || e.target.closest(".cl")) closeWs(); });
  function openWs(v, filter) { closeMenus(); S.view = v; S.wsf = filter || null; S.wq = ""; layer.hidden = false; renderWs(); }
  function renderWs() {
    if (S.view === "orders") return wsOrders(); if (S.view === "analytics") return wsAnalytics(); if (S.view === "inventory") return wsInventory(); if (S.view === "ai") return;
  }
  function wsShell(title, sub, body) { layer.innerHTML = '<section class="wsp" role="dialog" aria-label="' + title + '"><header><h2>' + title + '</h2><span class="sub">' + sub + '</span><button type="button" class="cl" aria-label="إغلاق">✕</button></header><div class="wsp-b">' + body + "</div></section>"; }
  function wsOrders() {
    var a = win(S.p === "today" ? "week" : S.p).filter(function (o) { return (!S.wsf || o.st === S.wsf) && (!S.wq || (o.id + o.cu + o.wl).indexOf(S.wq) > -1); });
    wsShell("الطلبات", a.length + " طلب · " + ({ today: "اليوم", week: "7 أيام", month: "30 يوماً" })[S.p === "today" ? "week" : S.p], '<div style="flex:1;display:flex;flex-direction:column;min-width:0"><div class="tbar"><input id="wq" type="search" placeholder="ابحث برقم الطلب أو الاسم أو الولاية…" value="' + esc(S.wq || "") + '" aria-label="بحث"><div class="chips"><button class="chp' + (!S.wsf ? " on" : "") + '" data-f="">الكل</button>' + ST_KEYS.map(function (k) { return '<button class="chp' + (S.wsf === k ? " on" : "") + '" data-f="' + k + '">' + ST[k].l + "</button>"; }).join("") + '</div></div><div class="tbl"><div class="od th"><span>الرقم</span><span>العميل</span><span>الولاية</span><span>المبلغ</span><span>الحالة</span><span>إجراء</span><span></span></div>' + a.slice(0, 80).map(function (o) { return odRow(o); }).join("") + "</div></div>");
    var q = $("#wq"); if (q) { q.addEventListener("input", function () { S.wq = q.value.trim(); var pos = q.selectionStart; wsOrders(); var q2 = $("#wq"); q2.focus(); q2.setSelectionRange(pos, pos); }); }
    $$(".chp", layer).forEach(function (c) { c.addEventListener("click", function () { S.wsf = c.dataset.f || null; wsOrders(); }); });
    $$("[data-adv]", layer).forEach(function (b) { b.addEventListener("click", function () { advance(b.dataset.adv); }); });
  }
  function wsInventory() {
    wsShell("المخزون", lowStock().length + " تنبيه نشط", '<div class="tbl" style="flex:1">' + stock.map(function (s) { var c = stockC(s); return '<div class="inv-row" style="--c:' + c + '"><b>' + s.n + '</b><div class="mt"><i style="width:' + Math.max(4, s.q / s.max * 100) + '%"></i></div><span style="font-weight:900;color:' + c + '">' + s.q + " / " + s.max + '</span>' + (s.q <= s.min ? '<button class="act-b" data-rs="' + s.id + '">إعادة طلب</button>' : '<span class="act-b done">كافٍ</span>') + "</div>"; }).join("") + "</div>");
    $$("[data-rs]", layer).forEach(function (b) { b.addEventListener("click", function () { restock(b.dataset.rs); }); });
  }
  function wsAnalytics() {
    var m = metrics(S.p), rows = labels(S.p).map(function (l, i) { var c = series(S.p, false, "orders")[i], r = series(S.p, false, "sales")[i], pr = series(S.p, true, "sales")[i], d = pr ? Math.round((r - pr) / pr * 100) : 0; return "<tr><td>" + l + "</td><td>" + c + '</td><td><span class="ltr">' + fmt(r) + '</span> دج</td><td class="' + (d >= 0 ? "up" : "dn") + '">' + (d >= 0 ? "▲" : "▼") + " " + Math.abs(d) + "%</td></tr>"; }).join("");
    wsShell("التحليلات", "الإيراد " + fmt(m.rev) + " دج · التحويل " + m.conv + "% (تقدير تجريبي)", '<div class="big-an"><section class="pn cx"><header class="ph"><h2>' + (S.m === "orders" ? "الطلبات" : "الإيراد") + ' عبر الزمن</h2><div class="seg" id="ws-seg"><button class="' + (S.m === "sales" ? "on" : "") + '" data-m="sales">الإيراد</button><button class="' + (S.m === "orders" ? "on" : "") + '" data-m="orders">الطلبات</button></div></header><div class="cv-wrap" style="min-height:300px"><canvas id="ws-cv" style="width:100%;height:100%"></canvas></div></section><section class="pn"><header class="ph"><h2>تفصيل الفترات</h2></header><div class="tbl" style="margin:0 12px 12px;max-height:100%"><table style="width:100%;border-collapse:collapse;font-size:.9rem"><thead><tr style="color:var(--li)"><th style="text-align:start;padding:.5rem .8rem">الفترة</th><th style="text-align:start">الطلبات</th><th style="text-align:start">الإيراد</th><th style="text-align:start">التغيّر</th></tr></thead><tbody>' + rows + "</tbody></table></div></section><section class=\"pn\"><header class=\"ph\"><h2>قمع التحويل</h2></header><div class=\"fn\" id=\"ws-fn\"></div></section></div>");
    var f = funnelData(m), mx = f[0][1] || 1; $("#ws-fn").innerHTML = f.map(function (s, i) { var drop = i ? Math.round((1 - s[1] / (f[i - 1][1] || 1)) * 100) : 0; return '<div class="fl"><div class="tx"><b>' + s[0] + "</b><span>" + pct(s[1], mx) + '%</span></div><div class="bar" style="width:' + Math.max(6, s[1] / mx * 52) + '%"></div><div class="nm">' + fmt(s[1]) + '</div><div class="dp">' + (i ? '<span class="ltr">−' + drop + "%</span>" : "") + "</div></div>"; }).join("");
    if (wsChart) wsChart.stop(); wsChart = new OSCharts.SalesChart($("#ws-cv"), { reduced: REDUCED, fmtAxis: chart.fmtAxis, onHover: function () { } });
    var cur = series(S.p, false, S.m), n = cur.length, avg = (cur[n - 1] + cur[n - 2] + cur[n - 3]) / 3 || 0; wsChart.setData({ cur: cur, prev: series(S.p, true, S.m), fc: [Math.round(avg * 1.05), Math.round(avg * 1.09)], labels: labels(S.p), focus: -1 }); wsChart.start();
    $$("#ws-seg button").forEach(function (b) { b.addEventListener("click", function () { S.m = b.dataset.m; $$("#seg-metric button").forEach(function (x) { x.classList.toggle("on", x.dataset.m === S.m); }); renderChart(); wsAnalytics(); }); });
  }

  /* ───────── مساعد ALYSSUM ───────── */
  function reply(q) {
    var m = metrics(S.p), pend = win("month").filter(function (o) { return o.st === "pending"; }).length, ls = lowStock(), per = ({ today: "اليوم", week: "آخر 7 أيام", month: "آخر 30 يوماً" })[S.p], r = { text: "", acts: [] }, t = q.replace(/\s+/g, " ");
    if (/مبيعات|إيراد|ايراد|ربح/.test(t)) { var cur = series(S.p, false, "sales"), bi = cur.indexOf(Math.max.apply(null, cur)); r.text = "إيراد " + per + ": " + fmt(m.rev) + " دج (" + (m.revD >= 0 ? "أعلى" : "أقل") + " بـ" + Math.abs(m.revD) + "% عن الفترة السابقة). أفضل فترة: «" + labels(S.p)[bi] + "» بـ" + fmt(cur[bi]) + " دج. (بيانات تجريبية)"; r.acts.push({ l: "افتح التحليلات", fn: function () { S.kp = "rev"; closeWs(); openWs("analytics"); } }); }
    else if (/معلق|انتظار|تأكيد|اكد|أكد/.test(t)) { r.text = pend ? "لديك " + pend + " طلبات بانتظار التأكيد. هل أؤكدها جميعاً؟" : "لا توجد طلبات بانتظار التأكيد حالياً."; if (pend) r.acts.push({ l: "أكّد الكل (" + pend + ")", fn: function () { var n = confirmAll(); aiPush("ai", "تم تأكيد " + n + " طلبات (تجريبي) وانتقلت إلى «قيد التجهيز»."); } }); }
    else if (/مخزون|نفاد|نفد/.test(t)) { r.text = ls.length ? "تنبيهات المخزون: " + ls.map(function (s) { return s.n + " (" + s.q + ")"; }).join("، ") + "." : "كل المنتجات فوق حدّ التنبيه."; ls.forEach(function (s) { r.acts.push({ l: "إعادة طلب " + s.n.split(" ")[0] + " " + (s.n.split(" ")[1] || ""), fn: function () { restock(s.id); aiPush("ai", "أُعيد طلب «" + s.n + "» (تجريبي)."); } }); }); }
    else if (/تحويل|قمع|زيارات/.test(t)) { var f = funnelData(m), wd = 0, wi = 1, i; for (i = 1; i < f.length; i++) { var d = 1 - f[i][1] / (f[i - 1][1] || 1); if (d > wd) { wd = d; wi = i; } } r.text = "معدّل التحويل " + m.conv + "% من " + fmt(m.visits) + " زيارة (تقدير تجريبي). أكبر تسرّب عند «" + f[wi][0] + "» بنسبة " + Math.round(wd * 100) + "%. يُنصح بتحسين هذه الخطوة أولاً."; }
    else if (/نصيح|اقتراح|ماذا|افعل|أولوي/.test(t)) { r.text = "أولوياتك الآن: " + (pend ? "1) تأكيد " + pend + " طلبات معلّقة. " : "") + (ls.length ? "2) إعادة طلب «" + ls[0].n + "». " : "") + "3) مراجعة خطوة التسرّب الأكبر في القمع."; if (pend) r.acts.push({ l: "نفّذ: تأكيد الكل", fn: function () { var n = confirmAll(); aiPush("ai", "تم تأكيد " + n + " طلبات (تجريبي)."); } }); }
    else r.text = "أستطيع الإجابة عن: المبيعات، الطلبات المعلّقة، المخزون، التحويل، أو أن أقترح أولوياتك. جرّب أحد الأسئلة السريعة أدناه.";
    return r;
  }
  function aiPush(who, text, acts) { S.ai.push({ who: who, text: text, acts: acts || [] }); if (S.view === "ai") aiRender(); }
  function aiRender() {
    var box = $(".msgs", layer); if (!box) return;
    box.innerHTML = S.ai.map(function (m, i) { return '<div class="msg ' + (m.who === "me" ? "me" : "ai") + '">' + (m.think ? '<span class="th"><i></i><i></i><i></i></span>' : esc(m.text)) + (m.acts && m.acts.length ? '<div class="acts">' + m.acts.map(function (a, j) { return '<button type="button" class="act-b" data-m="' + i + '" data-a="' + j + '">' + a.l + "</button>"; }).join("") + "</div>" : "") + "</div>"; }).join(""); box.scrollTop = box.scrollHeight;
    $$("[data-a]", box).forEach(function (b) { b.addEventListener("click", function () { S.ai[Number(b.dataset.m)].acts[Number(b.dataset.a)].fn(); }); });
  }
  function aiAsk(q) {
    if (!q) return; aiPush("me", q); var th = { who: "ai", think: true, text: "", acts: [] }; S.ai.push(th); aiRender(); if (wsCore) wsCore.setMode("think"); core.setMode("think");
    setTimeout(function () { var r = reply(q); S.ai.splice(S.ai.indexOf(th), 1); aiPush("ai", r.text, r.acts); if (wsCore) wsCore.setMode("idle"); core.setMode("idle"); }, REDUCED ? 50 : 800);
  }
  function openAI(q) {
    closeMenus(); S.view = "ai"; layer.hidden = false;
    layer.innerHTML = '<section class="wsp ai-ws" role="dialog" aria-label="مساعد ALYSSUM"><header><div class="ai-h"><canvas id="ai-big" width="52" height="52"></canvas><div><h2>مساعد ALYSSUM</h2><span class="sub">يعمل على بيانات المعاينة التجريبية فقط</span></div></div><button type="button" class="cl" aria-label="إغلاق">✕</button></header><div class="wsp-b"><div class="msgs"></div><div class="qs">' + ["ما مبيعات الفترة؟", "هل لدي طلبات معلّقة؟", "ما حالة المخزون؟", "حلّل التحويل", "ماذا أفعل الآن؟"].map(function (x) { return "<button type=\"button\">" + x + "</button>"; }).join("") + '</div><form class="inp" id="ai-form"><input id="ai-in" type="text" placeholder="اسأل عن متجرك…" autocomplete="off" aria-label="اسأل المساعد"><button type="submit">إرسال</button></form></div></section>';
    wsCore = new OSCharts.AICore($("#ai-big"), { reduced: REDUCED, size: 52 }); wsCore.start();
    if (!S.ai.length) aiPush("ai", "مرحباً. أنا مساعد ALYSSUM. أجيب من بيانات المعاينة التجريبية وأستطيع تنفيذ إجراءات بسيطة بموافقتك."); aiRender();
    $$(".qs button", layer).forEach(function (b) { b.addEventListener("click", function () { aiAsk(b.textContent); }); });
    $("#ai-form").addEventListener("submit", function (e) { e.preventDefault(); var i = $("#ai-in"); var v = i.value.trim(); i.value = ""; aiAsk(v); }); $("#ai-in").focus(); if (q) aiAsk(q);
  }
  $("#b-ai").addEventListener("click", function () { openAI(); });

  /* ───────── بحث سريع ───────── */
  function openSearch() {
    closeMenus(); S.view = "search"; layer.hidden = false; layer.innerHTML = '<section class="wsp" style="height:auto;max-height:560px;width:min(640px,100%)" role="dialog" aria-label="بحث"><header><h2>بحث سريع</h2><button type="button" class="cl" aria-label="إغلاق">✕</button></header><div class="wsp-b" style="flex-direction:column"><div class="tbar"><input id="qs-in" type="search" placeholder="اكتب اسم قسم أو رقم طلب أو اسم عميل…" autocomplete="off"></div><div id="qs-res" class="tbl" style="max-height:340px"></div></div></section>';
    var inp = $("#qs-in"); function go() { var v = inp.value.trim(), h = ""; if (v) { NAV.forEach(function (g) { (g.ch || []).concat([[g.t]]).forEach(function (c) { if (c[0].indexOf(v) > -1) h += '<div class="od" style="grid-template-columns:1fr auto;cursor:pointer" data-nv="' + g.id + '|' + c[0] + '|' + (c[1] || "") + '"><span>' + g.t + " › <b style=\"color:#fff\">" + c[0] + '</b></span><span class="stt" style="--c:#2be4ff">قسم</span></div>'; }); }); orders.filter(function (o) { return (o.id + o.cu + o.wl).indexOf(v) > -1; }).slice(0, 6).forEach(function (o) { h += '<div class="od" style="grid-template-columns:62px 1fr auto;cursor:pointer" data-od="' + o.id + '"><b>#' + o.id + "</b><span>" + esc(o.cu) + " · " + o.wl + '</span><span class="stt" style="--c:' + ST[o.st].c + '">' + ST[o.st].l + "</span></div>"; }); } $("#qs-res").innerHTML = h || '<p style="padding:1rem;color:var(--dim)">' + (v ? "لا نتائج" : "ابدأ الكتابة…") + "</p>"; }
    inp.addEventListener("input", go); go(); inp.focus();
    $("#qs-res").addEventListener("click", function (e) { var n = e.target.closest("[data-nv]"), od = e.target.closest("[data-od]"); if (n) { var p = n.dataset.nv.split("|"); S.nav = p[0]; S.open = p[0]; S.sub = p[1]; crumb(p[0], p[1]); renderNav(); closeWs(); if (p[2]) openWs(p[2].split(":")[0], p[2].split(":")[1]); else toast("معاينة تجريبية — لا ينقلك لصفحة فعلية"); } else if (od) { closeWs(); S.wq = od.dataset.od; openWs("orders"); } });
  }
  $("#b-search").addEventListener("click", openSearch);
  document.addEventListener("keydown", function (e) {
    var k = String(e.key || ""), tg = e.target, typing = tg && /input|textarea/i.test(tg.tagName);
    if (k === "Escape") { if (!layer.hidden) closeWs(); closeMenus(); } else if (!typing) { if (k === "/") { e.preventDefault(); openSearch(); } else if (k === "1") $('[data-p="today"]').click(); else if (k === "2") $('[data-p="week"]').click(); else if (k === "3") $('[data-p="month"]').click(); }
  });

  /* ───────── محاكاة نشاط حيّ (تجريبي) ───────── */
  function liveTick() {
    var o = { id: "A" + (++seq), cu: pick(CUST), wl: pick(WIL), tt: pick(TOT), ts: Date.now(), st: "pending", d: 0, fresh: true }; orders.unshift(o); NOW = Date.now(); addFeed("طلب جديد #" + o.id + " من " + o.wl, "#4d9bff"); refresh(); core.setLoad(.9);
  }
  if (!REDUCED) { setInterval(liveTick, 20000); setInterval(function () { lat.shift(); lat.push(34 + Math.round(Math.random() * 18)); renderHealth(); }, 3000); }

  /* بارالاكس خفيف لخلفية البيئة */
  if (!REDUCED) window.addEventListener("pointermove", function (e) { document.documentElement.style.setProperty("--mx", ((e.clientX / innerWidth - .5) * 2).toFixed(3)); document.documentElement.style.setProperty("--my", ((e.clientY / innerHeight - .5) * 2).toFixed(3)); });
  (function dust() { var cv = $("#dust"), cx = cv.getContext("2d"), w, h, ps = [], raf = 0, last = 0, dpr = Math.min(2, devicePixelRatio || 1); function size() { w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); var n = Math.round(Math.min(60, w * h / 30000)), r = rng(3), i; ps = []; for (i = 0; i < n; i++) ps.push({ x: r() * w, y: r() * h, vy: -.06 - r() * .18, r: .5 + r() * 1.2, a: .12 + r() * .35, c: r() > .5 ? "220,255,31" : "43,228,255" }); } function draw(t) { raf = requestAnimationFrame(draw); if (t - last < 40) return; last = t; cx.clearRect(0, 0, w, h); ps.forEach(function (p) { p.y += p.vy; if (p.y < -3) { p.y = h + 3; p.x = Math.random() * w; } cx.fillStyle = "rgba(" + p.c + "," + p.a + ")"; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill(); }); } size(); addEventListener("resize", size); if (!REDUCED) { raf = requestAnimationFrame(draw); document.addEventListener("visibilitychange", function () { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) raf = requestAnimationFrame(draw); }); } })();

  /* ───────── تشغيل ───────── */
  renderHealth(); renderNav(); renderIntel(); renderCenter(); renderDeck(); renderBell(); core.start(); chart.start(); paintIcons(document);
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { chart.draw(); });
  $$(".sysbar,.nav,.kp,.pn,.dk").forEach(function (e, i) { e.classList.add("reveal"); e.style.setProperty("--rd", (Math.min(i, 14) * .05) + "s"); });
})();
