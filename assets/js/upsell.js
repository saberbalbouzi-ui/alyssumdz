/* عروض إضافية في الطلب: «Order Bump» (خانة اختيار قبل زر التأكيد تضيف منتجاً مكمّلاً بسعر خاص) و«Upsell بعد الشراء»
   (بطاقة في صفحة الشكر تضيف منتجاً ثانياً بنقرة واحدة دون إعادة إدخال بيانات الزبون).
   القواعد من assets/data/upsell.json = {rules:[{id,on,type:"bump"|"post",title,text,offer:slug,mode:"pct"|"price",value,trigger:{slugs[],cats[],min},from,to}]}
   الدوال النقية (pick/priceOf/matches) قابلة للاختبار بلا متصفح. بلا قواعد = لا يظهر شيء. */
(function (root) {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var S = { rules: [], loaded: false, posted: {} };

  function isActive(r, now) {
    if (!r || r.on === false || !r.offer) return false;
    now = now || new Date();
    if (r.from && new Date(r.from + "T00:00:00").getTime() > now.getTime()) return false;
    if (r.to && new Date(r.to + "T23:59:59").getTime() < now.getTime()) return false;
    return r.type === "bump" || r.type === "post";
  }
  /** هل تنطبق القاعدة على هذا السياق؟ ctx = {slugs[], cats[], total} */
  function matches(r, ctx) {
    var t = r.trigger || {}, sl = t.slugs || [], ct = t.cats || [];
    if (Number(t.min) > 0 && (Number(ctx.total) || 0) < Number(t.min)) return false;
    if (!sl.length && !ct.length) return true;
    return (ctx.slugs || []).some(function (s) { return sl.indexOf(s) >= 0; }) || (ctx.cats || []).some(function (c) { return ct.indexOf(c) >= 0; });
  }
  /** السعر الخاص للمنتج حسب القاعدة (لا يقل عن 0 ولا يزيد على سعره العادي). */
  function priceOf(r, p) {
    var base = Number(p && p.price) || 0, v = Number(r.value) || 0, out;
    if (r.mode === "price") out = v; else out = base * (1 - Math.min(100, Math.max(0, v)) / 100);
    return Math.max(0, Math.min(base, Math.round(out)));
  }
  function offerOk(r, p, ctx) {
    if (!p || p.active === false) return false;
    if ((p.type === "variable" || p.type === "grouped")) return false;            // المنتج المتغيّر/المجمّع يحتاج اختيار تنويع: غير مدعوم هنا
    if ((ctx.slugs || []).indexOf(r.offer) >= 0) return false;                    // موجود في الطلب أصلاً
    var st = Number(p.stock); if (p.stock !== undefined && p.stock !== null && p.stock !== "" && Number.isFinite(st) && st <= 0) return false;
    return true;
  }
  /** أول قاعدة صالحة من النوع المطلوب: {rule, product, price, old} أو null */
  function pick(type, ctx, prods, rules, now) {
    var list = rules || S.rules;
    for (var i = 0; i < list.length; i++) {
      var r = list[i]; if (r.type !== type || !isActive(r, now) || !matches(r, ctx)) continue;
      var p = (prods || []).filter(function (x) { return x.slug === r.offer; })[0];
      if (!offerOk(r, p, ctx)) continue;
      var price = priceOf(r, p); return { rule: r, product: p, price: price, old: Number(p.price) || 0 };
    }
    return null;
  }
  function fill(text, o) {
    var pct = o.old > 0 ? Math.round((1 - o.price / o.old) * 100) : 0;
    return String(text || "").replace(/\{title\}/g, o.product.title).replace(/\{price\}/g, fmtP(o.price)).replace(/\{old\}/g, fmtP(o.old)).replace(/\{pct\}/g, pct + "%");
  }
  function fmtP(n) { try { return typeof fmt === "function" ? fmt(n) : n + " دج"; } catch (e) { return n + " دج"; } }
  function img(p) { var s = p.cover || (p.images && p.images[0]) || ""; return s ? ((typeof REL !== "undefined" ? REL : "") + s) : ""; }
  function prods() { try { return typeof PRODUCTS !== "undefined" ? PRODUCTS : []; } catch (e) { return []; } }
  function gid() { return "G" + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5); }
  function hasType(type) { return S.rules.some(function (r) { return r.type === type && isActive(r); }); }

  function css() {
    if (document.getElementById("ups-css")) return;
    var st = document.createElement("style"); st.id = "ups-css";
    st.textContent = ".ups-bump[hidden]{display:none!important}.ups-bump{display:flex;gap:.7rem;align-items:center;border:2px dashed #e8a33d;background:rgba(232,163,61,.1);border-radius:14px;padding:.7rem .8rem;margin:.8rem 0;cursor:pointer;text-align:right}" +
      ".ups-bump.on{border-style:solid;background:rgba(34,197,94,.12);border-color:#22c55e}.ups-bump input{width:22px;height:22px;flex:none;accent-color:#16a34a}" +
      ".ups-bump img{width:54px;height:54px;object-fit:cover;border-radius:10px;flex:none;background:#fff}.ups-bump b{display:block;font-size:.95rem}.ups-bump small{display:block;opacity:.85;margin-top:.15rem}" +
      ".ups-bump s{opacity:.6}.ups-post{margin:1rem 0;border:2px solid #22c55e;border-radius:16px;padding:.9rem;background:rgba(34,197,94,.1);text-align:center}" +
      ".ups-post h3{margin:0 0 .4rem;font-size:1.05rem}.ups-post img{width:96px;height:96px;object-fit:cover;border-radius:12px;background:#fff}.ups-post .pr{font-size:1.1rem;font-weight:900;margin:.3rem 0}.ups-post .pr s{opacity:.6;font-weight:600;font-size:.9rem}" +
      ".ups-post button{cursor:pointer;border:1px solid rgba(255,255,255,.4);color:#fff;font-weight:800;padding:.6rem 1rem;border-radius:12px;margin:.2rem;background:linear-gradient(180deg,rgba(34,197,94,.75),rgba(21,128,61,.6));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -6px 10px rgba(0,0,0,.2),0 4px 12px rgba(0,0,0,.25);transition:transform .15s}" +
      ".ups-post button:hover{transform:translateY(-2px)}.ups-post button.no{background:transparent;box-shadow:none;border-color:transparent;color:inherit;opacity:.7;font-weight:600}.ups-post .ok{font-weight:800;color:#16a34a}";
    document.head.appendChild(st);
  }

  /* ── Order Bump ── host: العنصر الذي تُدرج الخانة قبله. getCtx(): {slugs,cats,total}. onChange(sel|null) حيث sel={slug,title,qty,price,rule} */
  function mountBump(host, getCtx, onChange) {
    if (!host || !host.parentNode) return null;
    css(); var box = document.createElement("label"), cur = null, shown = null;
    box.className = "ups-bump"; box.hidden = true; host.parentNode.insertBefore(box, host);
    function render() {
      var c = pick("bump", getCtx(), prods());
      if (!c) { box.hidden = true; if (cur) { cur = null; onChange(null); } shown = null; return; }
      if (shown !== c.rule.id + ":" + c.price) {
        shown = c.rule.id + ":" + c.price; var on = !!cur;
        box.innerHTML = '<input type="checkbox"' + (on ? " checked" : "") + '>' + (img(c.product) ? '<img src="' + esc(img(c.product)) + '" alt="">' : "") +
          '<span><b>' + esc(c.rule.title || ("أضف " + c.product.title)) + '</b><small>' + esc(fill(c.rule.text || "أضف «{title}» إلى طلبك بـ {price} بدل {old}", c)) + '</small></span>';
        box.querySelector("input").onchange = function () {
          box.classList.toggle("on", this.checked);
          cur = this.checked ? { slug: c.product.slug, title: c.product.title, qty: 1, price: c.price, rule: c.rule } : null; onChange(cur);
        };
        box.classList.toggle("on", on);
      }
      box.hidden = false;
    }
    render(); return { refresh: render, current: function () { return cur; } };
  }

  /* ── Order Bump داخل السلة: يضيف المنتج كبند عادي (فتشمله الأسعار والمخزون والتوصيل) ويحمل الوسم up=<معرّف القاعدة> ── */
  function cartSync(host) {
    if (typeof Cart === "undefined" || !host) return;
    css(); var items = Cart.all(), box = document.getElementById("ups-cartbump");
    var real = items.filter(function (i) { return !i.up; }), ctx = ctxOf(real);
    var upIt = items.filter(function (i) { return i.up; })[0];
    var c = pick("bump", ctx, prods());
    if (upIt && (!c || c.rule.id !== upIt.up)) {                                   // القاعدة لم تعد صالحة (سلة تغيّرت) ← أزل البند
      Cart.save(items.filter(function (i) { return !i.up; })); return;
    }
    if (!c && !upIt) { if (box) box.hidden = true; return; }
    if (!box) { box = document.createElement("label"); box.id = "ups-cartbump"; box.className = "ups-bump"; host.parentNode.insertBefore(box, host); }
    var key = c ? c.rule.id + ":" + c.price + ":" + (upIt ? 1 : 0) : "";
    if (c && box.dataset.k !== key) {
      box.dataset.k = key;
      box.innerHTML = '<input type="checkbox"' + (upIt ? " checked" : "") + '>' + (img(c.product) ? '<img src="' + esc(img(c.product)) + '" alt="">' : "") +
        '<span><b>' + esc(c.rule.title || ("أضف " + c.product.title)) + '</b><small>' + esc(fill(c.rule.text || "أضف «{title}» إلى طلبك بـ {price} بدل {old}", c)) + '</small></span>';
      box.querySelector("input").onchange = function () {
        var its = Cart.all().filter(function (i) { return !i.up; });
        if (this.checked) its.push({ slug: c.product.slug, qty: 1, price: c.price, up: c.rule.id, upt: c.rule.title || c.product.title });
        Cart.save(its);
      };
    }
    box.classList.toggle("on", !!upIt); box.hidden = false;
  }
  function ctxOf(items) {
    var P = prods();
    return { slugs: items.map(function (i) { return i.slug; }), cats: items.map(function (i) { var p = P.filter(function (x) { return x.slug === i.slug; })[0]; return p && p.cat || ""; }),
      total: items.reduce(function (s, i) { return s + (Number(i.price) || 0) * (Number(i.qty) || 1); }, 0) };
  }

  /* ── Upsell بعد الشراء: يُدرج بطاقة داخل صفحة الشكر؛ o = {customer:{name,phone,wilaya,commune,dtype,desk}, slugs, cats, total, grp, page} ── */
  function mountPost(thx, o) {
    try {
      if (!thx || !o || !o.customer) return;
      var c = pick("post", { slugs: o.slugs || [], cats: o.cats || [], total: o.total || 0 }, prods());
      if (!c || S.posted[c.rule.id + ":" + (o.customer.phone || "")]) return;
      css(); var card = document.createElement("div"); card.className = "ups-post";
      card.innerHTML = '<h3>' + esc(c.rule.title || "عرض خاص لك فقط") + '</h3>' + (img(c.product) ? '<img src="' + esc(img(c.product)) + '" alt="">' : "") +
        '<div>' + esc(c.product.title) + '</div><div class="pr">' + esc(fmtP(c.price)) + (c.old > c.price ? ' <s>' + esc(fmtP(c.old)) + '</s>' : "") + '</div>' +
        '<div style="font-size:.88rem;opacity:.9;margin-bottom:.4rem">' + esc(fill(c.rule.text || "أضفه إلى طلبك بنقرة واحدة — بنفس الشحنة وبلا إعادة إدخال بياناتك.", c)) + '</div>' +
        '<button type="button" class="yes">نعم، أضفه إلى طلبي</button><button type="button" class="no">لا شكراً</button>';
      var act = thx.querySelector(".thx-act"); if (act && act.parentNode) act.parentNode.insertBefore(card, act); else (thx.querySelector(".thx-box") || thx).appendChild(card);
      card.querySelector(".no").onclick = function () { card.remove(); };
      card.querySelector(".yes").onclick = function () {
        var b = this; b.disabled = true; b.textContent = "جارٍ الإضافة…";
        accept(c, o).then(function (r) {
          if (r.ok) { S.posted[c.rule.id + ":" + (o.customer.phone || "")] = 1; card.innerHTML = '<div class="ok">✓ أُضيف «' + esc(c.product.title) + '» إلى طلبك — سنؤكّد الطلبين معاً في اتصال واحد.</div>'; }
          else { b.disabled = false; b.textContent = "نعم، أضفه إلى طلبي"; if (typeof toast === "function") toast(r.msg || "تعذّرت الإضافة، حاول مجدداً"); }
        });
      };
    } catch (e) { console.warn("Upsell.post", e); }
  }
  /** يُسجَّل كطلب ثانٍ بنفس بيانات الزبون وبلا رسم توصيل، موسوماً بمجموعة الطلب الأول ليدمجه المدير في شحنة واحدة. */
  async function accept(c, o) {
    var cu = o.customer, extra = {};
    extra["🔼 عرض بعد الشراء"] = c.rule.title || c.product.title;
    extra["🆔 قاعدة العرض"] = c.rule.id;
    if (o.grp) extra["🧺 مجموعة"] = o.grp;
    if (o.page) extra["📄 الصفحة"] = o.page;
    try { if (typeof Attrib !== "undefined") Object.assign(extra, Attrib); } catch (e) { }
    var order = { name: cu.name, phone: cu.phone, wilaya: cu.wilaya, commune: cu.commune || "", dtype: cu.dtype || "home", desk: cu.desk || "",
      items: [{ slug: c.product.slug, title: c.product.title, qty: 1, price: c.price }], subtotal: c.price, fee: 0, total: c.price, coupon: "", discount: 0, extra: extra };
    try {
      if (typeof Guard !== "undefined" && Guard.active()) { var g = await Guard.submit(order); if (!g.ok) return { ok: false, msg: g.msg }; }
      else API.submitOrder(order);
      try { if (typeof trackEvent === "function") trackEvent("Lead", { slug: c.product.slug, title: c.product.title, qty: 1, value: c.price }); } catch (e) { }
      return { ok: true };
    } catch (e) { return { ok: false, msg: "تعذّر إرسال الطلب" }; }
  }

  function load() {
    var rel = (typeof REL !== "undefined" ? REL : "");
    return fetch(rel + "assets/data/upsell.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : { rules: [] }; }).catch(function () { return { rules: [] }; })
      .then(function (j) { S.rules = (j && Array.isArray(j.rules)) ? j.rules : (Array.isArray(j) ? j : []); S.loaded = true; try { document.dispatchEvent(new Event("upsell:ready")); } catch (e) { } return S.rules; });
  }
  root.Upsell = { load: load, pick: pick, priceOf: priceOf, matches: matches, isActive: isActive, offerOk: offerOk, fill: fill, mountBump: mountBump, cartSync: cartSync, mountPost: mountPost, hasType: hasType, gid: gid, ctxOf: ctxOf,
    set: function (r) { S.rules = r || []; S.loaded = true; }, rules: function () { return S.rules; }, ready: function () { return S.loaded; } };
  if (typeof document !== "undefined" && !/admin\.html|\/admin/.test(location.pathname)) load();
})(typeof window !== "undefined" ? window : globalThis);
