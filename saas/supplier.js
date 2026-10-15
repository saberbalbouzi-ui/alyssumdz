/* بوابة المورّد الخارجي (جملة/تجزئة): تقديم طلب انضمام ← يراجعه المزوّد يدوياً ويرسل المفتاح ← لوحة صغيرة: ملخص المبيعات، منتجاتي (مع رفع صور)، طلبات للشحن، شحن الرصيد.
   كل الطلبات عبر دالة supplier-proxy (المنصة تتحقق من المفتاح). كل نص قادم من الخادم يُهرَّب. المفتاح يُحفظ في هذا المتصفح فقط. */
(function () {
  "use strict";
  var C = window.SAAS_CFG || {}, ROOT = document.getElementById("exw"), KEYK = "alyssum_sup_key";
  var S = { key: "", view: "home", prof: null, stats: null, wal: null, prods: [], ord: [], deps: [], dmin: 500, chg: false, form: false, msg: null, busy: false, days: 30 };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var nf = function (n) { return Math.round(+n || 0).toLocaleString("fr-DZ"); };
  var $ = function (id) { return document.getElementById(id); };
  var uid = function () { return Math.random().toString(36).slice(2) + Date.now().toString(36); };
  var dt = function (s) { try { return new Date(s * 1000).toLocaleString("fr-DZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
  var ERR = { unauthorized: "المفتاح غير صالح أو الحساب موقوف", validation_error: "تحقق من الحقول", already_applied: "هذا الرقم لديه طلب قائم أو حساب", rate_limited: "طلبات كثيرة، حاول بعد قليل", plan_limit: "بلغت الحد المسموح", insufficient_funds: "الرصيد المتاح غير كافٍ", bad_state: "الحالة الحالية لا تسمح بهذا الإجراء", busy: "طلبات كثيرة قيد المراجعة، حاول لاحقاً" };
  var OST = { pending: "معلّق", available: "سُلِّم", returned: "مرتجع", return_claimed: "مرتجع بانتظار الإدارة", rejected: "رُفض" };
  var PST = { pending: "بانتظار موافقة الإدارة", active: "معروض", paused: "موقوف منك", rejected: "مرفوض", suspended: "أوقفته الإدارة" };
  function key() { try { return localStorage.getItem(KEYK) || ""; } catch (e) { return ""; } }
  function setKey(k) { try { if (k) localStorage.setItem(KEYK, k); else localStorage.removeItem(KEYK); } catch (e) { } S.key = k; }
  function call(method, path, body, query, idem) {
    var h = { "Content-Type": "application/json", apikey: C.KEY || "" }; if (S.key) h["X-Supplier-Key"] = S.key;
    return fetch((C.URL || "") + "/functions/v1/supplier-proxy", { method: "POST", headers: h, body: JSON.stringify({ method: method, path: path, body: body, query: query, idempotencyKey: idem }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (r.status === 404) return { ok: false, off: true }; if (!r.ok || !j.ok) return { ok: false, st: r.status, j: j }; return { ok: j.status >= 200 && j.status < 300, st: j.status, j: j.data || {} }; }); })
      .catch(function () { return { ok: false, st: 0 }; });
  }
  function errOf(r) { var e = r && r.j && r.j.error; if (r && r.off) return "البوابة غير مفعّلة بعد — تواصل مع الدعم"; if (r && (r.st === 401 || (r.j && r.j.error === "unauthorized"))) return ERR.unauthorized; if (e && typeof e === "object") return (e.fields && Object.values(e.fields)[0]) || ERR[e.code] || e.message || "تعذّر التنفيذ"; return "تعذّر الاتصال، حاول لاحقاً"; }
  function flash(t, bad) { S.msg = { t: t, bad: !!bad }; draw(); window.scrollTo(0, 0); }
  /* ضغط صورة في المتصفح ≤ ~230KB */
  function shrink(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader(); fr.onerror = function () { rej(new Error("read")); };
      fr.onload = function () { var im = new Image(); im.onerror = function () { rej(new Error("img")); }; im.onload = function () {
        var sc = Math.min(1, 1200 / Math.max(im.width, im.height)), q = .82;
        for (var i = 0; i < 8; i++) { var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(im.width * sc)); c.height = Math.max(1, Math.round(im.height * sc)); var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); var u = c.toDataURL("image/jpeg", q); if (u.length <= 230000) return res(u); q = Math.max(.4, q - .1); sc *= .8; }
        rej(new Error("big")); }; im.src = fr.result; };
      fr.readAsDataURL(file);
    });
  }
  function head(sub) { return '<div class="top"><div><h1>🤝 بوابة المورّدين</h1><p class="mut">' + esc(sub || "سوق التوريد — بِع منتجاتك عبر مئات المتاجر بعمولة، واشحن واحصد المبيعات") + '</p></div>' + (S.key ? '<button class="btn g" data-a="out">خروج</button>' : "") + "</div>" + (S.msg ? '<div class="msg ' + (S.msg.bad ? "e" : "k") + '">' + esc(S.msg.t) + "</div>" : ""); }

  /* ───── الزائر: تقديم + دخول ───── */
  function guest() {
    var ws = (typeof WILAYAS !== "undefined" ? WILAYAS : []).filter(function (w) { return !w.par; });
    ROOT.innerHTML = head() + '<div class="card hero"><h2>كيف تعمل؟</h2><div class="perks"><span class="pill">1) تقدّم بطلبك</span><span class="pill">2) نراجعه ونتواصل بك واتساب</span><span class="pill">3) تدرج منتجاتك وتحدد عمولة الأفلييت</span><span class="pill">4) تشحن وتتابع مبيعاتك ورصيدك</span></div></div>'
      + '<div class="card"><h2>طلب انضمام</h2><div class="g2"><div><label for="a-kind">نوع النشاط</label><select id="a-kind"><option value="wholesale">🏭 جملة (مورّد/مصنّع/مستورد)</option><option value="retail">🛍️ تجزئة (صاحب متجر)</option></select></div><div><label for="a-name">اسم النشاط التجاري</label><input id="a-name" maxlength="80"></div></div>'
      + '<div class="g2"><div><label for="a-contact">اسم المسؤول</label><input id="a-contact" maxlength="60"></div><div><label for="a-phone">رقم الهاتف (واتساب)</label><input id="a-phone" dir="ltr" inputmode="tel" placeholder="05xxxxxxxx"></div></div>'
      + '<div class="g2"><div><label for="a-wil">الولاية</label><select id="a-wil">' + ws.map(function (w) { return "<option>" + esc(w.name) + "</option>"; }).join("") + '</select></div><div id="a-regw"><label for="a-reg">رقم السجل التجاري (للجملة)</label><input id="a-reg" dir="ltr" maxlength="40"></div></div>'
      + '<label for="a-about">ماذا تبيع؟ (اختياري)</label><textarea id="a-about" maxlength="500" style="min-height:80px"></textarea><input id="a-web" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px" aria-hidden="true">'
      + '<label class="chk"><input type="checkbox" id="a-ok"><span>أوافق أن تتواصل معي الإدارة لمراجعة طلبي، وأتعهد بشحن الطلبات في وقتها وتحصيل ثمنها من الزبون عند الاستلام.</span></label><button class="btn" data-a="apply"' + (S.busy ? " disabled" : "") + '>إرسال الطلب</button></div>'
      + '<div class="card"><h2>لديّ حساب</h2><label for="k-in">مفتاح الدخول (أرسلته لك الإدارة)</label><input id="k-in" dir="ltr" autocomplete="off" placeholder="pk_live_…"><div class="row" style="margin-top:.6rem"><button class="btn" data-a="login">دخول</button></div></div>';
    kindToggle();
  }
  function kindToggle() { var k = $("a-kind"), w = $("a-regw"); if (k && w) w.style.display = k.value === "wholesale" ? "" : "none"; }
  function apply() {
    var g = function (id) { return ($(id) || {}).value || ""; };
    if (!$("a-ok").checked) return flash("يلزم الموافقة على الشروط", true);
    var body = { kind: g("a-kind"), name: g("a-name").trim(), contact: g("a-contact").trim(), phone: g("a-phone").trim(), wilaya: g("a-wil"), reg_no: g("a-reg").trim(), about: g("a-about").trim(), website: g("a-web") };
    S.busy = true; draw();
    call("POST", "/v1/marketplace/apply", body).then(function (r) {
      S.busy = false; if (!r.ok) { flash(errOf(r), true); return; } DRAFT = {}; done();
    });
  }
  function done() { ROOT.innerHTML = head() + '<div class="card hero"><h2>✅ استلمنا طلبك</h2><p>سنراجع بياناتك ونتواصل معك عبر واتساب خلال أيام قليلة، ونرسل لك <b>مفتاح الدخول</b> عند الاعتماد.</p><p class="mut">احتفظ برقم هاتفك مفتوحاً.</p><button class="btn g" data-a="back">رجوع</button></div>'; }
  function login() {
    var k = (($("k-in") || {}).value || "").trim(); if (!/^pk_live_[0-9a-f]{40}$/.test(k)) return flash("المفتاح غير صالح", true);
    setKey(k); S.msg = null; load(true);
  }

  /* ───── لوحة المورّد ───── */
  function load(first) {
    return Promise.all([call("GET", "/v1/marketplace/profile"), call("GET", "/v1/marketplace/stats", null, { days: S.days }), call("GET", "/v1/marketplace/wallet"), call("GET", "/v1/marketplace/products"), call("GET", "/v1/marketplace/orders", null, { role: "supplier", limit: 50 }), call("GET", "/v1/wallet/deposits")]).then(function (a) {
      if (!a[0].ok) { if (first) { setKey(""); S.msg = { t: errOf(a[0]), bad: true }; } else flash(errOf(a[0]), true); guest(); return; }
      S.prof = a[0].j; S.stats = a[1].ok ? a[1].j : null; S.wal = a[2].ok ? a[2].j : null; S.prods = a[3].ok ? a[3].j.products || [] : []; S.ord = a[4].ok ? a[4].j.orders || [] : [];
      if (a[5].ok) { S.deps = a[5].j.deposits || []; S.dmin = a[5].j.min || 500; S.chg = !!a[5].j.chargily; } draw();
    });
  }
  function tabs() { var T = [["home", "الملخص"], ["prods", "منتجاتي"], ["ord", "طلبات للشحن" + (S.wal && S.wal.supplier && S.wal.supplier.to_ship ? " (" + S.wal.supplier.to_ship + ")" : "")], ["pay", "الرصيد"]]; return '<div class="tabs" style="flex-wrap:wrap;margin:.6rem 0">' + T.map(function (t) { return '<button class="' + (S.view === t[0] ? "on" : "") + '" data-a="v" data-v="' + t[0] + '">' + esc(t[1]) + "</button>"; }).join("") + "</div>"; }
  function stat(l, v) { return '<div class="card" style="margin:0;text-align:center"><div class="mut">' + esc(l) + '</div><b style="font-size:1.35rem">' + v + "</b></div>"; }
  function vHome() {
    var s = S.stats || {}, w = S.wal || {};
    return '<div class="row" style="margin:.4rem 0"><label style="margin:0">الفترة</label><select id="d-sel" style="width:auto">' + [7, 30, 90].map(function (d) { return '<option value="' + d + '"' + (S.days === d ? " selected" : "") + ">آخر " + d + " يوماً</option>"; }).join("") + "</select></div>"
      + '<div class="g3">' + stat("الطلبات", nf(s.orders)) + stat("سُلِّمت", nf(s.delivered)) + stat("مرتجعة", nf(s.returned)) + stat("نسبة التسليم", s.delivery_rate == null ? "—" : s.delivery_rate + "%") + stat("قيمة المبيعات", nf(s.sales) + " دج") + stat("عمولات دفعتها", nf(s.commissions_paid) + " دج") + "</div>"
      + '<div class="g3" style="margin-top:.6rem">' + stat("رصيدك المتاح", nf(w.available) + " دج") + stat("عمولات محجوزة (ضمان)", nf(w.supplier_escrow) + " دج") + stat("طلبات تنتظر شحنك", nf(w.supplier && w.supplier.to_ship)) + "</div>"
      + (w.supplier && w.supplier.rejected_for_funds ? '<div class="msg e">رُفض ' + nf(w.supplier.rejected_for_funds) + " طلب خلال 7 أيام لأن رصيدك لا يغطي عمولة الأفلييت — اشحن رصيدك من تبويب «الرصيد».</div>" : "")
      + (s.top && s.top.length ? '<div class="card"><h2>أفضل منتجاتك</h2>' + s.top.map(function (t) { return '<div class="row" style="justify-content:space-between"><span>' + esc(t.title) + "</span><span class=\"mut\">" + nf(t.orders) + " طلب · " + nf(t.delivered) + " مُسلَّم</span></div>"; }).join("") + "</div>" : "");
  }
  function vProds() {
    var f = S.form ? '<div class="card"><h2>منتج جديد</h2><div class="g2"><div><label for="p-title">اسم المنتج</label><input id="p-title" maxlength="160"></div><div><label for="p-cat">التصنيف</label><input id="p-cat" maxlength="60"></div></div>'
      + '<div class="g3"><div><label for="p-sp">سعرك للأفلييت (دج)</label><input id="p-sp" type="number" min="1"></div><div><label for="p-cm">عمولة الأفلييت للقطعة (دج)</label><input id="p-cm" type="number" min="1"></div><div><label for="p-rrp">السعر العام المقترح (دج)</label><input id="p-rrp" type="number" min="1"></div></div>'
      + '<div class="g2"><div><label for="p-st">المخزون (فارغ = غير محدود)</label><input id="p-st" type="number" min="0"></div><div><label for="p-img">صور المنتج (حتى 4)</label><input id="p-img" type="file" accept="image/*" multiple></div></div><label for="p-desc">الوصف</label><textarea id="p-desc" maxlength="2000"></textarea>'
      + '<p class="mut">تُحجز العمولة من رصيدك عند كل طلب. المنتج الجديد يمرّ بموافقة الإدارة.</p><button class="btn" data-a="padd"' + (S.busy ? " disabled" : "") + ">أدرج المنتج</button></div>" : "";
    return '<div class="row" style="margin:.4rem 0"><button class="btn" data-a="pform">' + (S.form ? "إغلاق" : "＋ منتج جديد") + "</button></div>" + f + (S.prods.length ? S.prods.map(function (p) {
      return '<div class="card"><div class="row" style="justify-content:space-between"><b>' + esc(p.title) + '</b><span class="st ' + (p.status === "active" ? "approved" : "pending") + '">' + esc(PST[p.status] || p.status) + "</span></div><p class=\"mut\">سعرك " + nf(p.supplier_price) + " · عمولة " + nf(p.commission) + " · مقترح " + nf(p.rrp) + " · أفلييت " + nf(p.importers) + " · طلبات معلّقة " + nf(p.pending_orders) + (p.note ? " · " + esc(p.note) : "") + "</p>"
        + '<div class="row"><label style="margin:0">المخزون</label><input id="s-' + p.id + '" type="number" min="0" value="' + (p.stock == null ? "" : p.stock) + '" placeholder="∞" style="width:110px"><button class="btn g" data-a="pstk" data-id="' + p.id + '">حفظ</button>' + (p.status === "active" ? '<button class="btn r" data-a="ppause" data-id="' + p.id + '" data-s="paused">إيقاف</button>' : p.status === "paused" ? '<button class="btn" data-a="ppause" data-id="' + p.id + '" data-s="active">استئناف</button>' : "") + "</div></div>";
    }).join("") : '<p class="mut">لم تُدرج منتجاً بعد.</p>');
  }
  function vOrd() {
    var rows = S.ord.filter(function (o) { return o.state !== "rejected"; });
    return '<p class="mut">اشحن الطلب للزبون وحصّل <b>المبلغ الإجمالي</b> منه عند الاستلام. تُحرَّر العمولة للأفلييت عند «سُلِّم» ولا رجوع.</p>' + (rows.length ? rows.map(function (o) {
      var c = o.customer || {}, ph = String(c.phone || "").replace(/[^0-9]/g, ""), open = o.state === "pending";
      return '<div class="card"><div class="row" style="justify-content:space-between"><b>' + esc(o.mko) + " — " + esc(o.title) + " ×" + nf(o.qty) + '</b><span class="st ' + (o.state === "available" ? "approved" : "pending") + '">' + esc(OST[o.state] || o.state) + "</span></div>"
        + "<p>" + esc(c.name) + (ph ? ' · <a href="tel:' + esc(ph) + '">' + esc(ph) + '</a> · <a target="_blank" rel="noopener" href="https://wa.me/' + esc(ph.replace(/^0/, "213")) + '">واتساب</a>' : "") + "</p><p class=\"mut\">" + esc(c.wilaya) + " · " + esc(c.commune) + " · " + (c.dtype === "stop" ? "مكتب: " + esc(c.desk) : "منزل") + "</p><p>التحصيل: <b>" + nf(o.collect) + " دج</b> · عمولة الأفلييت " + nf(o.commission) + " دج · " + dt(o.created_at) + "</p>"
        + (open ? '<div class="row">' + (o.ship === "new" ? '<button class="btn g" data-a="ost" data-id="' + o.id + '" data-s="shipped">شُحن</button>' : "") + '<button class="btn" data-a="ost" data-id="' + o.id + '" data-s="delivered">سُلِّم</button><button class="btn r" data-a="ost" data-id="' + o.id + '" data-s="' + (o.ship === "new" ? "cancelled" : "returned") + '">' + (o.ship === "new" ? "إلغاء" : "مرتجع") + "</button></div>" : "") + "</div>";
    }).join("") : '<p class="mut">لا طلبات بعد.</p>');
  }
  function vPay() {
    var w = S.wal || {}, DST = { pending: "قيد المراجعة/الدفع", approved: "أُضيف لرصيدك", rejected: "مرفوض", failed: "لم يكتمل" };
    return '<div class="g3">' + stat("رصيدك المتاح", nf(w.available) + " دج") + stat("عمولات محجوزة", nf(w.supplier_escrow) + " دج") + stat("عمولاتي كأفلييت", nf(w.affiliate && w.affiliate.available) + " دج") + "</div>"
      + '<div class="card"><h2>شحن الرصيد</h2><p class="mut">الرصيد يغطي عمولات الأفلييت التي تُحجز عند كل طلب على منتجاتك. إن لم يكفِ يُرفض الطلب.</p><div class="g3"><div><label for="d-am">المبلغ (دج)</label><input id="d-am" type="number" min="' + S.dmin + '"></div><div><label for="d-me">الطريقة</label><select id="d-me"><option value="ccp">حوالة CCP/بريدي موب (وصل)</option>' + (S.chg ? '<option value="edahabia">بطاقة الذهبية</option><option value="cib">بطاقة CIB</option>' : "") + '</select></div><div id="d-pfw"><label for="d-pf">صورة الوصل</label><input id="d-pf" type="file" accept="image/*"></div></div>'
      + '<p class="mut">لتفاصيل حساب الحوالة تواصل مع الإدارة. يُضاف الرصيد بعد تحقق الإدارة من الوصل.</p><button class="btn" data-a="dep"' + (S.busy ? " disabled" : "") + ">اشحن</button></div>"
      + (S.deps.length ? '<div class="card"><h2>آخر عمليات الشحن</h2>' + S.deps.slice(0, 8).map(function (d) { return '<div class="row" style="justify-content:space-between"><span>' + nf(d.amount) + " دج — " + (d.method === "ccp" ? "حوالة" : "بطاقة") + '</span><span class="mut">' + esc(DST[d.status] || d.status) + (d.note ? " · " + esc(d.note) : "") + " · " + dt(d.created_at) + (d.status === "pending" && d.checkout_url ? ' · <a target="_blank" rel="noopener" href="' + esc(d.checkout_url) + '">أكمل الدفع</a>' : "") + "</span></div>"; }).join("") + "</div>" : "");
  }
  function board() {
    var p = S.prof || {};
    ROOT.innerHTML = head("أهلاً " + (p.name || "")) + '<div class="row"><span class="pill">' + (p.kind === "wholesale" ? "🏭 مورّد جملة" : "🛍️ مورّد تجزئة") + "</span></div>" + tabs() + ({ home: vHome, prods: vProds, ord: vOrd, pay: vPay }[S.view] || vHome)();
    var me = $("d-me"); if (me) me.onchange = function () { $("d-pfw").style.display = me.value === "ccp" ? "" : "none"; };
  }
  /* يحفظ ما كتبه المستخدم في الحقول قبل كل إعادة رسم (الرسالة/الانتظار) كي لا يضيع */
  var DRAFT = {};
  function snap() { if (!ROOT) return; Array.prototype.forEach.call(ROOT.querySelectorAll("input[id],textarea[id],select[id]"), function (el) { if (el.type === "file" || /^(s-|d-sel|k-in)/.test(el.id)) return; DRAFT[el.id] = el.type === "checkbox" ? el.checked : el.value; }); }
  function restore() { Object.keys(DRAFT).forEach(function (id) { var el = $(id); if (!el) return; if (el.type === "checkbox") el.checked = !!DRAFT[id]; else el.value = DRAFT[id]; }); kindToggle(); var me = $("d-me"); if (me && $("d-pfw")) $("d-pfw").style.display = me.value === "ccp" ? "" : "none"; }
  function draw() { snap(); if (S.key && S.prof) board(); else guest(); restore(); }

  /* ───── إجراءات ───── */
  function addProduct() {
    var g = function (id) { return ($(id) || {}).value || ""; }, sp = Math.round(+g("p-sp")), cm = Math.round(+g("p-cm")), rrp = Math.round(+g("p-rrp")) || sp + cm, title = g("p-title").trim(), files = ($("p-img") || {}).files ? Array.prototype.slice.call($("p-img").files, 0, 4) : [];
    if (title.length < 3) return flash("اكتب اسم المنتج", true); if (!(sp >= 1 && cm >= 1)) return flash("اكتب سعرك وعمولة الأفلييت", true); if (rrp < sp + cm) return flash("السعر العام المقترح لا يقل عن سعرك + العمولة (" + nf(sp + cm) + ")", true); if (!files.length) return flash("أضف صورة واحدة على الأقل", true);
    var v = { descr: g("p-desc").trim(), cat: g("p-cat").trim(), st: g("p-st") };
    S.busy = true; draw();
    var urls = []; files.reduce(function (p, f) { return p.then(function () { return shrink(f).then(function (u) { return call("POST", "/v1/marketplace/images", { image: u }).then(function (r) { if (!r.ok) throw new Error(errOf(r)); urls.push(r.j.url); }); }); }); }, Promise.resolve())
      .then(function () { var st = v.st; return call("POST", "/v1/marketplace/products", { slug: "p" + Date.now().toString(36), title: title, descr: v.descr, image: urls[0], images: urls, category: v.cat, supplier_price: sp, commission: cm, rrp: rrp, stock: st === "" ? null : Math.round(+st) }); })
      .then(function (r) { S.busy = false; if (!r.ok) { flash(errOf(r), true); return; } S.form = false; ["p-title","p-cat","p-sp","p-cm","p-rrp","p-st","p-desc"].forEach(function (i) { delete DRAFT[i]; }); flash(r.j.status === "pending" ? "✅ أُرسل للمراجعة — يظهر للأفلييت بعد موافقة الإدارة" : "✅ المنتج معروض"); return load(); })
      .catch(function (e) { S.busy = false; flash(e && e.message && e.message !== "img" && e.message !== "big" ? e.message : "تعذّر قراءة الصورة، جرّب صورة أخرى", true); });
  }
  function deposit() {
    var amount = Math.round(+($("d-am") || {}).value), me = ($("d-me") || {}).value, f = $("d-pf") && $("d-pf").files[0];
    if (!(amount >= S.dmin)) return flash("الحد الأدنى للشحن " + nf(S.dmin) + " دج", true);
    var go = function (body) { S.busy = true; draw(); call("POST", "/v1/wallet/deposits", body, null, uid()).then(function (r) { S.busy = false; if (!r.ok) { flash(errOf(r), true); return; } if (r.j.checkout_url) { location.href = r.j.checkout_url; return; } flash("✅ أُرسل الوصل — يُضاف الرصيد بعد تحقق الإدارة"); load(); }); };
    if (me === "ccp") { if (!f) return flash("ارفع صورة الوصل", true); shrink(f).then(function (u) { go({ amount: amount, method: "ccp", proof: u }); }).catch(function () { flash("تعذّر قراءة الصورة", true); }); }
    else go({ amount: amount, method: "chargily", payment_method: me, return_url: location.origin + location.pathname });
  }
  function act(e) {
    var el = e.target.closest("[data-a]"); if (!el) return; var a = el.dataset.a, id = el.dataset.id;
    if (a === "apply") apply(); else if (a === "login") login(); else if (a === "back") { S.msg = null; guest(); }
    else if (a === "out") { setKey(""); S.prof = null; S.msg = null; guest(); }
    else if (a === "v") { S.view = el.dataset.v; draw(); } else if (a === "pform") { S.form = !S.form; draw(); } else if (a === "padd") addProduct(); else if (a === "dep") deposit();
    else if (a === "pstk") { var v = ($("s-" + id) || {}).value; call("PATCH", "/v1/marketplace/products/" + id, { stock: v === "" ? null : Math.round(+v) }).then(function (r) { r.ok ? (flash("✅ حُدّث المخزون ويصل لمتاجر الأفلييت"), load()) : flash(errOf(r), true); }); }
    else if (a === "ppause") call("PATCH", "/v1/marketplace/products/" + id, { status: el.dataset.s }).then(function (r) { r.ok ? (S.msg = null, load()) : flash(errOf(r), true); });
    else if (a === "ost") {
      var s = el.dataset.s, m = { shipped: "تأكيد أنك شحنت الطلب؟", delivered: "تأكيد تسليم الطلب للزبون؟ ستُحرَّر العمولة للأفلييت ولا رجوع.", cancelled: "إلغاء الطلب قبل الشحن؟ تعود العمولة والمخزون لك.", returned: "الطرد رجع إليك؟ تبقى العمولة محجوزة حتى تأكيد الناقل أو قرار الإدارة." }[s];
      if (!confirm(m)) return; call("POST", "/v1/marketplace/orders/" + id + "/status", { status: s }).then(function (r) { r.ok ? (S.msg = null, load()) : flash(errOf(r), true); });
    }
  }
  ROOT.addEventListener("click", act);
  ROOT.addEventListener("change", function (e) { if (e.target.id === "a-kind") kindToggle(); if (e.target.id === "d-sel") { S.days = +e.target.value; load(); } });
  S.key = key(); if (S.key) { ROOT.innerHTML = head() + '<p class="mut">جارِ التحميل…</p>'; load(true); } else guest();
  window.SupplierPortal = { S: S, _t: { shrink: shrink } };
})();
