/* «المنتج الرقمي» في المتجر: يحوّل صفحة الطلب إلى مسار بلا توصيل (لا ولاية ولا عنوان ولا شركة شحن)، يطلب البريد، ويقدّم طرق الدفع المسبق:
   BaridiMob / CCP (تحويل ثم رفع صورة الإثبات ليوافق البائع) أو البطاقة (Chargily). التسليم تلقائي بعد تأكيد الدفع، بالبريد أو واتساب.
   طرق الدفع من assets/data/pay-methods.json (يضبطها التاجر من تبويب «المنتجات الرقمية»). يعمل مع منصة API (PLATFORM_URL + PLATFORM_ORDER_KEY بنطاقات order:create وpayment:proof وpayment:init). */
(function () {
  "use strict";
  var C = (typeof CONFIG !== "undefined" && CONFIG) || {}, PEND = "alyssum_dg_pending", PAY = null;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var money = function (n) { try { return typeof fmt === "function" ? fmt(n) : String(Math.round(n)) + " دج"; } catch (e) { return String(n); } };
  var say = function (t) { try { if (typeof toast === "function") toast(t); else alert(t); } catch (e) { alert(t); } };
  var rel = function () { return (typeof REL !== "undefined" ? REL : ""); };
  var base = function () { return String(C.PLATFORM_URL || "").replace(/\/$/, ""); };
  var okEmail = function (v) { v = String(v || "").trim().toLowerCase(); return v.length <= 120 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(v) ? v : ""; };
  var LBL = { baridimob: "BaridiMob", ccp: "CCP (بريد الجزائر)", chargily: "بطاقة الذهبية / CIB" };

  function loadPay() {
    if (PAY) return Promise.resolve(PAY);
    return fetch(rel() + "assets/data/pay-methods.json?_=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (j) { PAY = j && typeof j === "object" ? j : {}; return PAY; });
  }
  function methods(p) { var m = []; if (p.baridimob && p.baridimob.on && p.baridimob.rip) m.push("baridimob"); if (p.ccp && p.ccp.on && p.ccp.account) m.push("ccp"); if (p.chargily && p.chargily.on) m.push("chargily"); return m; }

  /* ───── تحويل نموذج الطلب إلى وضع رقمي ───── */
  function mount(prod) {
    var form = document.getElementById("order-form"); if (!form || form.dataset.dg) return; form.dataset.dg = "1";
    var hide = function (el) { if (el) el.style.display = "none"; };
    var w = document.getElementById("wilaya"), cm = document.getElementById("commune"); if (w) w.required = false; if (cm) cm.required = false;
    if (w) hide(w.closest(".frow") || w.closest(".field")); hide(document.getElementById("desk-wrap")); hide(form.querySelector(".dtype")); hide(document.getElementById("add-cart"));
    var feeEl = document.getElementById("fee"); if (feeEl) { var cell = feeEl.parentNode; if (cell) cell.style.display = "none"; }
    var sm = document.getElementById("ship-msg"); if (sm) sm.style.display = "none";
    var h3 = form.querySelector("h3"); if (h3) h3.textContent = "📝 معلوماتك — منتج رقمي، يصلك بعد تأكيد الدفع";
    var cod = form.querySelector(".cod-note"); if (cod) cod.textContent = "💾 لا شحن ولا توصيل — يصلك المنتج على بريدك أو واتساب بعد تأكيد الدفع";
    var bt = form.querySelector(".btn-order"); if (bt) { var t = bt.querySelector("#btn-total"); bt.innerHTML = "✅ إتمام الشراء — "; var sp = document.createElement("span"); sp.id = "btn-total"; if (t) sp.textContent = t.textContent; bt.appendChild(sp); }
    var phoneRow = (document.getElementById("phone") || {}).closest ? document.getElementById("phone").closest(".frow") : null;
    var box = document.createElement("div"); box.id = "dg-box";
    box.innerHTML = '<div class="field"><label for="dg-email">البريد الإلكتروني (يصلك عليه المنتج)</label><input id="dg-email" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" dir="ltr" style="text-align:left"></div>' +
      '<div class="field" id="dg-pay"><label>طريقة الدفع *</label><div id="dg-pm" style="display:grid;gap:.4rem"></div></div>';
    var anchor = phoneRow || form.querySelector(".frow"); if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling); else form.insertBefore(box, form.firstChild.nextSibling);
    loadPay().then(function (p) {
      var ms = methods(p), pm = document.getElementById("dg-pm"); if (!pm) return;
      if (!ms.length) { pm.innerHTML = '<div style="color:#b45309;font-size:.9rem">الدفع الإلكتروني غير مفعّل بعد في هذا المتجر — اطلب عبر واتساب.</div>'; return; }
      pm.innerHTML = ms.map(function (k, i) { return '<label style="display:flex;gap:.5rem;align-items:center;padding:.55rem .7rem;border:1px solid rgba(128,128,128,.4);border-radius:12px;cursor:pointer"><input type="radio" name="dg-method" value="' + k + '"' + (i === 0 ? " checked" : "") + '> <span>' + esc(LBL[k]) + '</span></label>'; }).join("");
    });
  }

  /* ───── تعليمات الدفع ورفع الإثبات ───── */
  function css() {
    if (document.getElementById("dg-css")) return; var s = document.createElement("style"); s.id = "dg-css";
    s.textContent = "#dg-modal{position:fixed;inset:0;z-index:100002;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,8,5,.82);backdrop-filter:blur(7px)}#dg-modal .dgb{width:min(440px,100%);max-height:92vh;overflow:auto;border-radius:20px;padding:20px;background:#0b1f17;color:#fff;border:1px solid rgba(255,255,255,.18);box-shadow:0 20px 60px rgba(0,0,0,.5);font-family:inherit}#dg-modal h2{margin:0 0 .5rem;font-size:1.25rem}#dg-modal .dgi{padding:.7rem .8rem;border-radius:12px;background:rgba(255,255,255,.07);margin:.5rem 0;font-size:.92rem}#dg-modal code{direction:ltr;display:block;text-align:left;font-size:1.05rem;font-weight:800;padding:.35rem .5rem;border-radius:8px;background:rgba(0,0,0,.35);user-select:all;word-break:break-all}#dg-modal .dgbtn{width:100%;margin-top:.6rem;padding:.8rem;border-radius:14px;font:inherit;font-weight:900;color:#fff;cursor:pointer;border:1px solid rgba(134,239,172,.6);background:linear-gradient(180deg,rgba(34,197,94,.5),rgba(34,197,94,.18));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -6px 12px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.25)}#dg-modal .dgbtn.g{border-color:rgba(255,255,255,.3);background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.06))}#dg-modal .dgbtn[disabled]{opacity:.55;pointer-events:none}#dg-modal input[type=file]{width:100%;margin-top:.4rem}#dg-modal .dgm{font-size:.88rem;margin-top:.5rem;min-height:1.2em}#dg-bn{position:fixed;left:12px;right:12px;bottom:12px;z-index:100000;padding:.8rem 1rem;border-radius:14px;background:#0b1f17;color:#fff;border:1px solid rgba(255,255,255,.2);display:flex;gap:.6rem;align-items:center;justify-content:space-between;flex-wrap:wrap;font-weight:700}#dg-bn button{padding:.5rem 1rem;border-radius:10px;font:inherit;font-weight:800;color:#fff;cursor:pointer;border:1px solid rgba(134,239,172,.6);background:linear-gradient(180deg,rgba(34,197,94,.5),rgba(34,197,94,.18))}";
    document.head.appendChild(s);
  }
  function close() { var m = document.getElementById("dg-modal"); if (m) m.remove(); }
  function open(html) { css(); close(); var m = document.createElement("div"); m.id = "dg-modal"; m.setAttribute("role", "dialog"); m.innerHTML = '<div class="dgb">' + html + '</div>'; document.body.appendChild(m); return m; }
  function keep(o) { try { localStorage.setItem(PEND, JSON.stringify(o)); } catch (e) { } }
  function drop() { try { localStorage.removeItem(PEND); } catch (e) { } }

  /** يضغط الصورة إلى JPEG أقل من ~170KB (الخادم يرفض الأكبر) */
  function compress(file) {
    return new Promise(function (res, rej) {
      if (!file || !/^image\//.test(file.type)) return rej(new Error("اختر صورة (لقطة شاشة التحويل)"));
      var fr = new FileReader(); fr.onerror = function () { rej(new Error("تعذّرت قراءة الصورة")); };
      fr.onload = function () { var im = new Image(); im.onerror = function () { rej(new Error("تعذّرت قراءة الصورة")); };
        im.onload = function () {
          var mx = 1100, k = Math.min(1, mx / Math.max(im.width, im.height)), cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k));
          var cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height);
          for (var q = 0.8; q >= 0.3; q -= 0.1) { var d = cv.toDataURL("image/jpeg", q); if (d.length < 230000) return res(d); }
          var c2 = document.createElement("canvas"); c2.width = Math.round(cv.width / 2); c2.height = Math.round(cv.height / 2); c2.getContext("2d").drawImage(cv, 0, 0, c2.width, c2.height); var d2 = c2.toDataURL("image/jpeg", 0.6); d2.length < 230000 ? res(d2) : rej(new Error("الصورة كبيرة جداً"));
        }; im.src = fr.result; };
      fr.readAsDataURL(file);
    });
  }
  function call(path, body) {
    return fetch(base() + path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + C.PLATFORM_ORDER_KEY }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); });
  }
  var ERR = { order_not_found: "لم يُسجَّل طلبك بعد، حاول بعد لحظات", already_paid: "هذا الطلب مدفوع سابقاً", too_many_proofs: "تجاوزت عدد المحاولات، تواصل مع المتجر", rate_limited: "طلبات كثيرة، حاول بعد قليل", validation_error: "تحقق من الصورة (JPEG/PNG وأقل من حجم محدد)" };
  var errOf = function (r) { return (r && r.j && r.j.error && (ERR[r.j.error.code] || r.j.error.message)) || "تعذّر الإرسال، حاول لاحقاً"; };

  function instructions(o, pay) {
    var m = o.method, d = pay[m] || {}, who = d.name ? '<div>باسم: <b>' + esc(d.name) + '</b></div>' : "";
    if (m === "baridimob") return '<div class="dgi"><div>1) افتح تطبيق <b>BaridiMob</b> ← تحويل (Virement)</div><div>2) أدخل الـRIP التالي:</div><code>' + esc(d.rip) + '</code>' + who + '<div>3) المبلغ: <b>' + esc(money(o.total)) + '</b></div></div>';
    return '<div class="dgi"><div>حوّل إلى حساب <b>CCP</b>:</div><code>' + esc(d.account) + (d.key ? " clé " + esc(d.key) : "") + '</code>' + who + '<div>المبلغ: <b>' + esc(money(o.total)) + '</b></div></div>';
  }
  function proofModal(o, pay) {
    var m = open('<h2>💳 أكمل الدفع</h2><div>رقم طلبك: <b dir="ltr">' + esc(o.ref) + '</b></div>' + instructions(o, pay) +
      '<div class="dgi">بعد التحويل ارفع <b>لقطة شاشة</b> تثبت العملية. يراجعها البائع ويصلك المنتج ' + (o.email ? 'على <b dir="ltr">' + esc(o.email) + '</b>' : 'على واتساب') + ' بمجرد التأكد.</div>' +
      '<input id="dg-file" type="file" accept="image/*"><div class="dgm" id="dg-msg"></div><button class="dgbtn" id="dg-send">إرسال إثبات الدفع</button><button class="dgbtn g" id="dg-later">سأرسله لاحقاً</button>');
    var msg = function (t, bad) { var e = document.getElementById("dg-msg"); if (e) { e.textContent = t; e.style.color = bad ? "#fca5a5" : "#86efac"; } };
    document.getElementById("dg-later").onclick = function () { close(); say("يمكنك إكمال الدفع لاحقاً من الشريط أسفل الصفحة"); showBanner(); };
    document.getElementById("dg-send").onclick = function () {
      var b = this, f = document.getElementById("dg-file").files[0]; if (!f) return msg("اختر صورة الإثبات أولاً", true);
      b.disabled = true; msg("جارٍ الإرسال…");
      compress(f).then(function (data) { return call("/v1/payments/proof", { order_id: o.ref, method: o.method, proof: data, payer: o.name || "" }); }).then(function (r) {
        if (!r.ok) { b.disabled = false; return msg(errOf(r), true); }
        drop(); open('<h2>✅ استلمنا إثبات الدفع</h2><div class="dgi">سيراجعه البائع خلال وقت قصير، ثم يصلك المنتج ' + (o.email ? 'على <b dir="ltr">' + esc(o.email) + '</b>' : 'على واتساب') + '.</div><button class="dgbtn g" id="dg-x">إغلاق</button>'); document.getElementById("dg-x").onclick = close; var bn = document.getElementById("dg-bn"); if (bn) bn.remove();
      }).catch(function (e) { b.disabled = false; msg(e && e.message ? e.message : "تعذّر الإرسال", true); });
    };
  }
  function showBanner() {
    var o; try { o = JSON.parse(localStorage.getItem(PEND) || "null"); } catch (e) { o = null; } if (!o || Date.now() - o.at > 2 * 86400000 || o.method === "chargily") return;
    if (document.getElementById("dg-bn")) return; css(); var b = document.createElement("div"); b.id = "dg-bn"; b.innerHTML = '<span>طلبك <b dir="ltr">' + esc(o.ref) + '</b> بانتظار إثبات الدفع</span><button type="button">إرسال الإثبات</button>';
    b.querySelector("button").onclick = function () { loadPay().then(function (p) { b.remove(); proofModal(o, p); }); }; document.body.appendChild(b);
  }
  /** العودة من صفحة الدفع الإلكتروني: ?pay=ok|fail&order=… */
  function onReturn() {
    var q; try { q = new URLSearchParams(location.search); } catch (e) { return; } var st = q.get("pay"), ord = q.get("order"); if (!st || !ord) return;
    css(); if (st === "ok") { drop(); open('<h2>✅ تم الدفع</h2><div class="dgi">شكراً! سيصلك المنتج خلال لحظات على بريدك أو واتساب.<br>رقم الطلب: <b dir="ltr">' + esc(ord) + '</b></div><button class="dgbtn g" id="dg-x">إغلاق</button>'); }
    else open('<h2>لم يكتمل الدفع</h2><div class="dgi">لم تُخصم أي مبالغ. يمكنك إعادة المحاولة من صفحة المنتج.</div><button class="dgbtn g" id="dg-x">إغلاق</button>');
    var x = document.getElementById("dg-x"); if (x) x.onclick = close;
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { }
  }

  /** إرسال الطلب الرقمي: o = { order, total, name, email? } — يُستدعى من معالج submit في app.js */
  function submit(o) {
    var order = o.order, method = (document.querySelector('input[name="dg-method"]:checked') || {}).value || "", email = okEmail((document.getElementById("dg-email") || {}).value);
    return loadPay().then(function (pay) {
      var ms = methods(pay);
      if (!ms.length) { say("الدفع الإلكتروني غير مفعّل بعد — اطلب عبر واتساب"); return; }
      if (ms.indexOf(method) < 0) { say("اختر طريقة الدفع"); return; }
      var rawEmail = (document.getElementById("dg-email") || {}).value; if (rawEmail && rawEmail.trim() && !email) { say("البريد الإلكتروني غير صالح"); return; }
      if (method === "chargily" && !email) { say("البريد الإلكتروني مطلوب ليصلك المنتج بعد الدفع بالبطاقة"); return; }
      if (!(window.PFOrder && PFOrder.on())) { say("الدفع المسبق غير مهيّأ في هذا المتجر — اطلب عبر واتساب"); return; }
      order.extra = Object.assign({}, order.extra, { "💾 منتج رقمي": "نعم", "💳 طريقة الدفع": LBL[method], "📧 البريد": email || "—" });
      var ref = PFOrder.prep(order), btn = document.querySelector("#order-form .btn-order"); if (btn) btn.disabled = true;
      var fail = function (m) { if (btn) btn.disabled = false; say(m); };
      var pre = (typeof Guard !== "undefined" && Guard.active()) ? Guard.submit(order) : (function () { try { API.submitOrder(order); } catch (e) { } return Promise.resolve({ ok: true }); })();
      return pre.then(function (gr) {
        if (gr && gr.ok === false) return fail(gr.msg || "تعذّر إرسال الطلب");
        var lines = order.items.map(function (x) { return Object.assign({}, x); });
        return PFOrder.send(order, ref, lines, { email: email, pay: method }).then(function (r) {
          if (btn) btn.disabled = false;
          if (!r || !r.ok) return say("تعذّر ربط الدفع بطلبك، تواصل مع المتجر عبر واتساب (رقم طلبك: " + ref + ")");
          var rec = { ref: ref, method: method, total: o.total, email: email, name: order.name, at: Date.now() };
          if (method === "chargily") {
            keep(rec); return call("/v1/payments/pay", { order_id: ref, method: "edahabia", locale: "ar", return_url: location.origin + location.pathname }).then(function (p) {
              if (p.ok && p.j.checkout_url) { location.href = p.j.checkout_url; return; } say(errOf(p)); });
          }
          keep(rec); proofModal(rec, pay);
        });
      });
    });
  }

  window.DigitalCheckout = { mount: mount, submit: submit, onReturn: onReturn, banner: showBanner, _t: { compress: compress, methods: methods, okEmail: okEmail } };
  document.dispatchEvent(new Event("digital:ready"));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { onReturn(); showBanner(); }); else { onReturn(); showBanner(); }
})();
