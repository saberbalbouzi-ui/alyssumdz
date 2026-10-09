/* أليسوم — محرك الطلبات والسلة */
let WA_NUMBER = (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.waNumber) || "213559237239"; // يمكن استبداله ديناميكياً عبر assets/data/checkout.json (راجع initCheckout أدناه)
/* الشحن المجاني: خاصية المنتج freeShip، ويمكن حصره في عروض بعينها (offer.ship)؛ بلا عروض محددة يشمل كل العروض */
function offerFreeShip(p, o){ if(!p || !p.freeShip) return false; if(productType(p)==="grouped") return true; const flagged = (p.offers||[]).some(x=>x.ship); return flagged ? !!(o && o.ship) : true; }
function cartItemFreeShip(it){ const p = (typeof PRODUCTS !== "undefined") ? PRODUCTS.find(x=>x.slug===it.slug) : null; if(!p || !p.freeShip) return false; const fl = (p.offers||[]).filter(x=>x.ship); return fl.length ? it.qty >= Math.min(...fl.map(x=>x.qty)) : true; }
const SITE_NAME = (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.name) || "أليسوم ALYSSUM";
const fmt = n => n.toLocaleString("fr-DZ") + " " + (window.__STORE_CUR || "دج");
/* مناطق التوصيل (Zones): الأسعار والشحن المجاني والاستثناءات مشتقة في WILAYAS من لوحة التحكم ⟵ رسوم التوصيل:
   w.fh/w.fs = توصيل مجاني للمنزل/المكتب، w.fo = مجاني عند بلوغ مجموع الطلب هذا المبلغ، w.xw = الولاية مستثناة كلياً،
   w.xc = {بلدية:"all"|"home"} (all = لا توصيل نهائياً، home = لا توصيل للمنزل فقط ويبقى المكتب) */
function shipBlocked(w, commune, type){
  if(!w) return "";
  if(w.xw) return "عذراً، لا يتوفر التوصيل إلى ولاية " + w.name + " حالياً";
  const m = w.xc && commune ? w.xc[commune] : "";
  if(m === "all") return "عذراً، لا يتوفر التوصيل إلى بلدية " + commune + " حالياً";
  if(m === "home" && type !== "stop") return "التوصيل للمنزل غير متاح في بلدية " + commune + ((w.desks||[]).some(d=>d.commune===commune) ? " — اختر التوصيل إلى مكتب Stop Desk" : "");
  return "";
}
/* تسعير التوصيل: الافتراضي أسعار المناطق (WILAYAS)؛ إن فُعّلت شركة تجلب أسعارها فـ ship-co.json (`def` + `companies`) يعتمد أسعارها تلقائياً.
   وللمنتج اختيار خاص: shipCo = مفتاح شركة | "zones" (أسعار المناطق) | "free" (سعر حر ثابت shipFreeHome/shipFreeStop) */
let __SHIPCO = null, __SHIPDEF = "";
function loadShipCo(){
  if(__SHIPCO !== null) return;
  __SHIPCO = {};
  fetch((typeof REL!=="undefined"?REL:"") + "assets/data/ship-co.json", {cache:"no-store"}).then(r=>r.ok?r.json():null).then(j=>{ if(j && j.companies){ __SHIPCO = j.companies; __SHIPDEF = j.def || ""; if(__SHIPDEF || Object.keys(__SHIPCO).length) document.dispatchEvent(new Event("shipco:ready")); } }).catch(()=>{});
}
document.addEventListener("DOMContentLoaded", ()=>{ try{ loadShipCo(); }catch(e){} });
document.addEventListener("shipco:ready", ()=>{ try{ if(typeof Cart !== "undefined" && document.getElementById("cwilaya")) Cart.render(); }catch(e){} });
/* سعر المنتج الحر: يُرجع {home,stop} (قيمة فارغة = null) أو null */
function prodShipPf(p){ if(!p || p.shipCo !== "free") return null; const n = v=>(v === undefined || v === null || v === "" || isNaN(Number(v))) ? null : Number(v); const pf = { home:n(p.shipFreeHome), stop:n(p.shipFreeStop) }; return (pf.home === null && pf.stop === null) ? null : pf; }
/* مصدر تسعير بنود السلة: إن اتفقت كلها على مصدر واحد فهو، وإلا (مختلطة) التسعير الافتراضي */
function cartShipCo(items){
  const set = new Set((items||[]).map(it=>{ const p = (typeof PRODUCTS !== "undefined") ? PRODUCTS.find(x=>x.slug===it.slug) : null; return (p && p.shipCo) || ""; }));
  return set.size === 1 ? [...set][0] : "";
}
function cartShipPf(items){
  const slugs = new Set((items||[]).map(it=>it.slug)); if(slugs.size !== 1) return null;
  const p = (typeof PRODUCTS !== "undefined") ? PRODUCTS.find(x=>x.slug===[...slugs][0]) : null; return prodShipPf(p);
}
function shipQuote(w, commune, type, sub, co, pf){
  if(!w) return { fee:null, free:false, blocked:false, msg:"" };
  const msg = shipBlocked(w, commune, type); if(msg) return { fee:0, free:false, blocked:true, msg };
  let base = type === "stop" ? w.stop : w.home, flatFree = false;
  let src = co || ""; if(src === "free" && !pf) src = "";
  if(src === "free"){
    const v = type === "stop" ? (pf.stop !== null ? pf.stop : pf.home) : (pf.home !== null ? pf.home : pf.stop);
    if(v !== null && v >= 0){ base = v; flatFree = v === 0; }
  } else if(src !== "zones"){
    const key = src || __SHIPDEF;
    if(key && __SHIPCO && __SHIPCO[key] && __SHIPCO[key].prices){ const t = __SHIPCO[key].prices[w.id], v = t ? Number(type === "stop" ? t.stop : t.home) : 0; if(v > 0) base = v; }
  }
  const free = flatFree || !!(type === "stop" ? w.fs : w.fh) || !!(w.fo && sub >= w.fo);
  return { fee: free ? 0 : base, free, blocked:false, msg:"" };
}
/* تعطيل خيار المنزل/المكتب المحجوب في بلدية مستثناة وتحويل الاختيار إلى الآخر إن أمكن */
function shipRadios(name, w, commune){
  const rs = [...document.querySelectorAll('input[name="'+name+'"]')]; if(!rs.length) return;
  rs.forEach(r=>{ const b = shipBlocked(w, commune, r.value); if(!b) return; r.disabled = true; const l = r.closest("label"); if(l){ l.style.opacity = .45; l.title = b; } });
  const cur = rs.find(r=>r.checked);
  if(cur && cur.disabled){ const alt = rs.find(r=>!r.disabled); if(alt){ alt.checked = true; alt.dispatchEvent(new Event("change")); } }
}
function shipOptLabel(w, c){ return (w && w.xc && w.xc[c] === "all") ? c + " (غير متاح)" : c; }
function lowStockNote(p){ const stock = Number(p && p.stock); return Number.isFinite(stock) && stock > 0 && stock <= 5 ? "بقي " + stock + " فقط" : ""; }

/* ── أنواع المنتجات: فردي (simple) | متغيّر (variable: سمات + تنويعات بسعر/مخزون/صورة لكل تنويع) | مجمّع (grouped: عدة منتجات فردية في صفحة واحدة) ── */
function productType(p){ return (p && (p.type === "variable" || p.type === "grouped")) ? p.type : "simple"; }
function activeVariations(p){ return ((p && p.variations) || []).filter(v=>v && v.active !== false); }
function varOut(v){ return v.stock !== undefined && v.stock !== null && Number(v.stock) <= 0; }
function variationLabel(p, v){ return ((p && p.attributes) || []).filter(a=>a.variation && v && v.attrs && v.attrs[a.name] != null).map(a=>a.name + ": " + v.attrs[a.name]).join(" / "); }
function groupChildren(p){ return ((p && p.children) || []).map(sl=>PRODUCTS.find(x=>x.slug===sl)).filter(x=>x && productType(x)==="simple"); }
function minPrice(p){
  const t = productType(p);
  if(t==="variable"){ const vs = activeVariations(p); if(vs.length) return Math.min(...vs.map(v=>Number(v.price)||0)); }
  if(t==="grouped"){ const cs = groupChildren(p); if(cs.length) return Math.min(...cs.map(c=>Number(c.price)||0)); }
  return Number(p && p.price) || 0;
}
function hasPriceRange(p){
  const t = productType(p), mn = minPrice(p);
  if(t==="variable") return activeVariations(p).some(v=>(Number(v.price)||0) !== mn);
  if(t==="grouped") return groupChildren(p).some(c=>(Number(c.price)||0) !== mn);
  return false;
}
function itemOut(it){
  const p = PRODUCTS.find(x=>x.slug===it.slug); if(!p) return false;
  if(it.vid){ const v = (p.variations||[]).find(x=>x.id===it.vid); return !v || v.active===false || varOut(v); }
  return isOutOfStock(p);
}

/* ── السلة ── */
const Cart = {
  key: "alyssum_cart_v1",
  all(){ try{ return JSON.parse(localStorage.getItem(this.key))||[] }catch(e){ return [] } },
  save(items){ localStorage.setItem(this.key, JSON.stringify(items)); Cart.render() },
  /* unitPrice = السعر الفعلي للقطعة (إجمالي العرض ÷ عدد القطع) — كان يُمرَّر إجمالي العرض فيُضرب في الكمية ويظهر مجموع السلة مضاعفاً */
  add(slug, qty, unitPrice, vid, vlabel){
    const p = PRODUCTS.find(p=>p.slug===slug);
    if(p && itemOut({slug, vid})){ toast("⚠️ نفدت كمية هذا المنتج حالياً"); return }
    const items = Cart.all();
    const ex = items.find(i => i.slug===slug && Math.abs(i.price-unitPrice) < 1e-6 && (i.vid||"")===(vid||""));
    if(ex) ex.qty += qty; else { const it = {slug, qty, price: unitPrice}; if(vid){ it.vid = vid; it.vlabel = vlabel||""; } items.push(it); }
    Cart.save(items);
    toast(`تمت إضافة «${p?p.title:slug}${vlabel?" — "+vlabel:""}» إلى السلة ✓`);
  },
  setQty(idx, delta){
    const items = Cart.all();
    if(!items[idx]) return;
    items[idx].qty += delta;
    if(items[idx].qty<=0) items.splice(idx,1);
    Cart.save(items);
  },
  remove(idx){ const items=Cart.all(); items.splice(idx,1); Cart.save(items) },
  clear(){ Cart.save([]) },
  count(){ return Cart.all().reduce((s,i)=>s+i.qty,0) },
  subtotal(){ return Cart.all().reduce((s,i)=>s+Math.round(i.qty*i.price),0) },
  render(){
    document.querySelectorAll(".cart-count").forEach(el=>el.textContent = Cart.count());
    const box = document.getElementById("cart-items");
    if(!box) return;
    const items = Cart.all();
    box.innerHTML = items.length ? items.map((it,idx)=>{
      const p = PRODUCTS.find(p=>p.slug===it.slug) || it;
      const img = p.cover || (p.images&&p.images[0]) || "";
      const oos = itemOut(it);
      return `<div class="citem">
        <img src="${REL}${img}" alt="">
        <div class="t">${p.title}${it.vlabel?' — <small>'+it.vlabel+'</small>':""}${oos?' <b style="color:var(--red)">— نفدت الكمية 🚫</b>':""}<br><small style="color:var(--muted)">${fmt(Math.round(it.price))} / وحدة</small></div>
        <div class="qty"><button onclick="Cart.setQty(${idx},-1)">−</button><b>${it.qty}</b><button onclick="Cart.setQty(${idx},1)" ${oos?"disabled":""}>+</button></div>
      </div>`;
    }).join("") : `<p style="text-align:center;color:var(--muted);padding:2rem 0">السلة فارغة 🛒</p>`;
    const sub = Cart.subtotal();
    const fee = Cart.fee();
    const disc = currentCartDiscount(sub, couponCartItems());
    const discount = disc.discount;
    const totEl = document.getElementById("cart-total");
    if(totEl) totEl.textContent = fmt(Math.max(0, sub - discount) + (items.length?fee:0));
    let autoMsg = document.getElementById("cart-auto-disc-msg");
    if(!autoMsg && totEl){ autoMsg = document.createElement("div"); autoMsg.id = "cart-auto-disc-msg"; autoMsg.style.cssText = "font-size:.82rem;color:var(--green,#16834a);margin:.25rem 0"; totEl.insertAdjacentElement("afterend", autoMsg); }
    if(autoMsg) autoMsg.textContent = disc.autoDiscount > 0 ? "🎉 " + disc.message + " — خصم " + fmt(disc.autoDiscount) : "";
    const feeEl = document.getElementById("cart-fee");
    const sq = Cart.quote();
    if(feeEl){ feeEl.title = sq.msg || ""; feeEl.textContent = items.length ? (sq.blocked ? "غير متاح ⛔" : ((fee===0 && (items.every(cartItemFreeShip) || couponFreeShip() || sq.free)) ? "مجاني 🚚" : fmt(fee))) : "—"; }
    let sm = document.getElementById("cart-ship-msg");
    if(!sm && feeEl){ sm = document.createElement("div"); sm.id = "cart-ship-msg"; sm.style.cssText = "color:var(--red,#c0392b);font-size:.85rem;margin:.3rem 0;font-weight:700"; (feeEl.closest("div")||feeEl.parentNode).appendChild(sm); }
    if(sm) sm.textContent = items.length ? sq.msg : "";
  },
  fee(){
    const _all = Cart.all(); if(_all.length && (_all.every(cartItemFreeShip) || couponFreeShip())) return 0;   // كل منتجات السلة بشحن مجاني
    const w = document.getElementById("cwilaya");
    const t = document.querySelector('input[name="cdtype"]:checked');
    if(!w || !w.value) return 0;
    const wl = WILAYAS.find(x=>x.id==w.value);
    if(!wl) return 0;
    return Cart.quote().fee || 0;
  },
  quote(){
    const w = document.getElementById("cwilaya"), t = document.querySelector('input[name="cdtype"]:checked'), c = document.getElementById("ccommune");
    const wl = w && w.value ? WILAYAS.find(x=>x.id==w.value) : null;
    return shipQuote(wl, c ? c.value : "", t ? t.value : "home", Cart.subtotal(), cartShipCo(Cart.all()), cartShipPf(Cart.all()));
  },
  async checkout(){
    const items = Cart.all();
    if(!items.length){ toast("السلة فارغة"); return }
    const oosItem = items.filter(itemOut).map(it=>PRODUCTS.find(p=>p.slug===it.slug))[0];
    if(oosItem){ toast(`⚠️ «${oosItem.title}» نفدت كميته — يرجى إزالته من السلة`); return }
    const name = document.getElementById("cname")?.value.trim();
    const phone = document.getElementById("cphone")?.value.trim();
    const wId = document.getElementById("cwilaya")?.value;
    const commune = document.getElementById("ccommune")?.value.trim();
    const dtype = document.querySelector('input[name="cdtype"]:checked')?.value || "home";
    if(!name || !phone || !wId){ toast("يرجى ملء الاسم، الهاتف والولاية"); return }
    if(PhoneDZ.on && !PhoneDZ.ok(PhoneDZ.norm(phone))){ toast(PhoneDZ.MSG); document.getElementById("cphone")?.focus(); return }
    const wl = WILAYAS.find(x=>x.id==wId);
    const __sq = Cart.quote(); if(__sq.blocked){ toast(__sq.msg); return }
    const sub = Cart.subtotal();
    const fee = Cart.fee();
    const disc = currentCartDiscount(sub, couponCartItems());
    const discount = disc.discount;
    const total = Math.max(0, sub - discount) + fee;
    // Enregistrement dans Google Sheets
    const __pre = Guard.active() ? window.open("", "_blank") : null;      // يُفتح فوراً (ضمن نقرة الزبون) قبل انتظار فحص الخادم
    const __order = {
      name, phone, wilaya: wl.name, commune, dtype,
      items: items.map(it => { const p = PRODUCTS.find(p=>p.slug===it.slug)||it;
        return { slug: it.slug, title: p.title + (it.vlabel ? " — " + it.vlabel : ""), qty: it.qty, price: Math.round(it.price) }; }),
      subtotal: sub, fee, total,
      coupon: AppliedCoupon.record && (disc.couponDiscount > 0 || couponFreeShip() || couponGiftTitle()) ? AppliedCoupon.code : "", discount, promo: (AppliedCoupon.record && disc.couponDiscount > 0 && AppliedCoupon.record.__promo) ? AppliedCoupon.code : undefined,
      extra: Object.assign({}, couponGiftTitle() ? { "🎁 هدية": couponGiftTitle() } : {}, disc.autoDiscount > 0 ? { "🤖 خصم تلقائي": disc.message } : {}, PageSrc ? { "📄 الصفحة": PageSrc } : {}, Attrib),
    };
    if(Guard.active()){ const gr = await Guard.submit(__order); if(!gr.ok){ if(__pre) __pre.close(); toast(gr.msg); return } } else API.submitOrder(__order);
    Gifts.markUsed(AppliedCoupon.record); markCouponPhoneUsed(AppliedCoupon.record, phone);
    let msg = `السلام عليكم ${SITE_NAME}، أريد تأكيد طلبي:\n`;
    items.forEach(it=>{
      const p = PRODUCTS.find(p=>p.slug===it.slug)||it;
      msg += `\n• ${p.title}${it.vlabel?" — "+it.vlabel:""} ×${it.qty} = ${fmt(Math.round(it.price*it.qty))}`;
    });
    msg += `\n\nالمجموع: ${fmt(sub)}`;
    if(discount>0) msg += disc.autoDiscount > 0 ? `\n🎉 ${disc.message}: -${fmt(discount)}` : `\n🎟️ خصم الكود (${AppliedCoupon.code}): -${fmt(discount)}`;
    else if(couponFreeShip()) msg += `\n🎟️ كود التوصيل المجاني (${AppliedCoupon.code})`;
    if(couponGiftTitle()) msg += `\n🎁 هدية الكود (${AppliedCoupon.code}): ${couponGiftTitle()}`;
    msg += `\nالتوصيل (${dtype==="stop"?"مكتب":"للمنزل"} - ${wl.name}${commune?" / "+commune:""}): ${fmt(fee)}`;
    msg += `\n*الإجمالي: ${fmt(total)}*`;
    msg += `\n\nالاسم: ${name}\nالهاتف: ${phone}`;
    Guard.openWa(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, __pre);
    Thanks.show({ name, total, lines: items.map(it=>{ const q = PRODUCTS.find(x=>x.slug===it.slug)||it; return q.title + (it.qty>1?" ×"+it.qty:""); }), wa: `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}` });
  }
};

function toast(t){
  let el = document.getElementById("toast");
  if(!el){ el=document.createElement("div"); el.id="toast";
    el.style.cssText="position:fixed;bottom:100px;right:50%;transform:translateX(50%);background:var(--green);color:#fff;padding:.7rem 1.4rem;border-radius:999px;font-weight:800;z-index:99;box-shadow:var(--shadow-lg);transition:.3s";
    document.body.appendChild(el); }
  el.textContent=t; el.style.opacity=1; el.style.bottom="110px";
  clearTimeout(el._t);
  el._t=setTimeout(()=>{el.style.opacity=0;el.style.bottom="100px"},2400);
}

/* ════════ بكسلات التتبع (فيسبوك / تيك توك / جوجل) — تُدار من لوحة التحكم admin.html ════════
   تُقرأ من assets/data/pixels.json عند كل تحميل صفحة (رئيسية أو منتج)، ثم تُثبَّت أكواد
   التتبع الأساسية (PageView) لكل بكسل مفعّل ومُتاح على هذه الصفحة، ويُسجَّل حدث «شراء»
   تلقائياً عند نجاح تأكيد الطلب في صفحة أي منتج مفعّل عليه البكسل. */
let __pixelsCache = null;
async function loadPixels(){
  if(__pixelsCache) return __pixelsCache;
  try{
    const r = await fetch((typeof REL!=="undefined"?REL:"") + "assets/data/pixels.json", {cache:"no-store"});
    __pixelsCache = r.ok ? await r.json() : [];
  }catch(e){ __pixelsCache = []; }
  return __pixelsCache;
}
function currentProductSlugFromUrl(){
  const m = location.pathname.match(/\/p\/([a-z0-9-]+)\/?/i);
  return m ? m[1] : null;
}
function pixelApplies(px, slug){
  if(!px || px.active===false) return false;
  if(!px.scope || px.scope === "all") return true;
  return Array.isArray(px.scope) && !!slug && px.scope.includes(slug);
}
function injectGtagBase(id){
  if(window.__gtagBaseLoaded) return;
  window.__gtagBaseLoaded = true;
  const s = document.createElement("script");
  s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ dataLayer.push(arguments); };
  gtag("js", new Date());
}
function injectPixelBase(px){
  if(px.platform === "facebook"){
    if(!window.fbq){
      /* كود فيسبوك بكسل الرسمي (Meta Events Manager) */
      (function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)})(window,
      document,"script","https://connect.facebook.net/en_US/fbevents.js");
    }
    fbq("init", px.pixelId);
    fbq("track", "PageView");
  } else if(px.platform === "tiktok"){
    if(!window.ttq){
      /* كود تيك توك بكسل الرسمي (TikTok Events Manager) */
      (function (w, d, t) {
        w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
        ttq.setAndDefer=function(tq,e){tq[e]=function(){tq.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
        for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
        ttq.instance=function(t2){for(var e=ttq._i[t2]||[],n=0;n<e.length;n++)ttq.setAndDefer(e,e.methods[n]);return e};
        ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
          var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;
          var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
      })(window, document, "ttq");
    }
    ttq.load(px.pixelId);
    ttq.page();
  } else if(px.platform === "ga4" || px.platform === "google_ads"){
    injectGtagBase(px.pixelId);
    gtag("config", px.pixelId);
  }
}
async function initPixels(){
  try{
    const pixels = await loadPixels();
    const slug = currentProductSlugFromUrl();
    window.__activePixels = pixels.filter(px=>pixelApplies(px, slug));
    window.__activePixels.forEach(px=>{
      try{ injectPixelBase(px); }catch(e){ console.error("pixel init error", px.id, e); }
    });
  }catch(e){ /* تجاهل — البكسلات ليست حرجة لعمل الموقع */ }
}
/* يُستدعى عند نجاح تأكيد الطلب (زر «تأكيد الطلب») في initProduct أدناه */
function firePixelPurchase(p, total, qty){
  (window.__activePixels||[]).forEach(px=>{
    try{
      const currency = px.currency || "DZD";
      if(px.platform === "facebook" && window.fbq){
        fbq("track", "Purchase", { value: total, currency, content_ids:[p.slug], content_type:"product", contents:[{id:p.slug, quantity: qty}] });
      } else if(px.platform === "tiktok" && window.ttq){
        ttq.track("CompletePayment", { value: total, currency, content_id: p.slug, content_type:"product", quantity: qty });
      } else if(px.platform === "google_ads" && window.gtag){
        gtag("event", "conversion", { send_to: px.pixelId + (px.conversionLabel ? ("/" + px.conversionLabel) : ""), value: total, currency, transaction_id: String(Date.now()) });
      } else if(px.platform === "ga4" && window.gtag){
        gtag("event", "purchase", { value: total, currency, transaction_id: String(Date.now()), items:[{item_id:p.slug, item_name:p.title, quantity: qty, price: total}] });
      }
    }catch(e){ console.error("pixel purchase error", px.id, e); }
  });
}

/* ════════ مظهر الموقع (الخطوط/الألوان/الشعار) — تُدار من لوحة التحكم admin.html ⟵ المظهر ════════ */
let __themeCache = null;
async function loadTheme(){
  if(__themeCache) return __themeCache;
  try{
    const r = await fetch((typeof REL!=="undefined"?REL:"") + "assets/data/theme.json", {cache:"no-store"});
    __themeCache = r.ok ? await r.json() : null;
  }catch(e){ __themeCache = null; }
  return __themeCache;
}
function applyTheme(theme){
  if(!theme || typeof theme !== "object") return;
  try{
    if(theme.fontUrl && ![...document.querySelectorAll('link[rel="stylesheet"]')].some(l=>l.href === theme.fontUrl)){   // لا تكرار إن كان الخط محمّلاً في <head>
      const link = document.createElement("link");
      link.rel = "stylesheet"; link.href = theme.fontUrl;
      document.head.appendChild(link);
    }
    const c = theme.colors || {};
    const map = { bg:"--bg", card:"--card", ink:"--ink", muted:"--muted", green:"--green", green2:"--green-2", gold:"--gold", gold2:"--gold-2", red:"--red", ok:"--ok", line:"--line" };
    const rootVars = Object.entries(map).filter(([k])=>c[k]).map(([k,v])=>v+":"+c[k]).join(";");
    let css = "";
    if(rootVars) css += ":root{" + rootVars + "}";
    if(theme.fontFamily) css += "body{font-family:" + theme.fontFamily + "!important}";
    if(theme.fontSize) css += "body{font-size:" + theme.fontSize + "}";
    if(theme.fontWeight) css += "body{font-weight:" + theme.fontWeight + "}";
    if(theme.logo && theme.logo.url){
      const w = theme.logo.width || "150px", h = theme.logo.height || "46px";
      css += ".logo{font-size:0!important;line-height:0;background:url('" + (typeof REL!=="undefined"?REL:"") + theme.logo.url + "') no-repeat center/contain;display:inline-block;width:" + w + ";height:" + h + "}";
    }
    if(!css) return;
    const st = document.createElement("style");
    st.id = "__alyssum_theme_override";
    st.textContent = css;
    document.head.appendChild(st);
  }catch(e){ /* تجاهل — المظهر ليس حرجاً لعمل الموقع */ }
}
async function initTheme(){
  try{
    const theme = await loadTheme();
    applyTheme(theme);
    // إعدادات SEO الخاصة بالصفحة الرئيسية فقط (تُضبط من لوحة التحكم ⟵ المظهر) — تُطبَّق هنا لأن
    // initTheme() يُستدعى من كل الصفحات، ونتحقق من وجود #grid (خاص بالرئيسية فقط) قبل التطبيق
    if(theme && document.getElementById("grid")){
      applySeoTags({
        title: theme.seoTitle || "",
        description: theme.seoDesc || "",
        image: (theme.logo && theme.logo.url) ? theme.logo.url : "",
        type: "website",
      });
    }
  }catch(e){ /* تجاهل */ }
}

/* ════════ نموذج الطلب (واتساب/الأزرار/الحقول الإضافية/الألوان/العروض) — تُدار من لوحة التحكم ⟵ نموذج الطلب ════════
   تُقرأ من assets/data/checkout.json وتُطبَّق على كل صفحة (رقم واتساب، إظهار/إخفاء الأزرار، النصوص، الألوان)؛
   حقول «العروض» و«الحقول الإضافية» و«تسميات الحقول» تُطبَّق داخل initProduct() لأنها خاصة بصفحة المنتج فقط. */
let __checkoutCache = null;
async function loadCheckout(){
  if(__checkoutCache) return __checkoutCache;
  try{
    const r = await fetch((typeof REL!=="undefined"?REL:"") + "assets/data/checkout.json", {cache:"no-store"});
    __checkoutCache = r.ok ? await r.json() : null;
  }catch(e){ __checkoutCache = null; }
  return __checkoutCache;
}
function applyCheckoutColors(colors){
  if(!colors || typeof colors !== "object") return;
  try{
    let css = "";
    if(colors.orderBg || colors.orderText){
      css += ".btn-order{" + (colors.orderBg?("background:"+colors.orderBg+"!important;border-color:"+colors.orderBg+"!important;"):"") + (colors.orderText?("color:"+colors.orderText+"!important;"):"") + "}";
    }
    if(colors.waBg || colors.waText){
      css += ".btn-wa{" + (colors.waBg?("background:"+colors.waBg+"!important;border-color:"+colors.waBg+"!important;"):"") + (colors.waText?("color:"+colors.waText+"!important;"):"") + "}";
    }
    if(colors.cartBg || colors.cartText){
      css += ".btn-cart2{" + (colors.cartBg?("background:"+colors.cartBg+"!important;border-color:"+colors.cartBg+"!important;"):"") + (colors.cartText?("color:"+colors.cartText+"!important;"):"") + "}";
    }
    if(!css) return;
    const st = document.createElement("style");
    st.id = "__alyssum_checkout_colors";
    st.textContent = css;
    document.head.appendChild(st);
  }catch(e){ /* تجاهل */ }
}
function applyCheckout(cfg){
  if(!cfg || typeof cfg !== "object") return;
  try{
    if(cfg.waNumber){
      const digits = String(cfg.waNumber).replace(/[^\d]/g,"");
      if(digits) WA_NUMBER = digits;
    }
    // إعادة كتابة كل روابط واتساب الثابتة في الصفحة بنفس الرقم الجديد (مع الحفاظ على نص الرسالة بعد الرقم)
    document.querySelectorAll('a[href*="wa.me/"]').forEach(a=>{
      const href = a.getAttribute("href") || "";
      const m = href.match(/wa\.me\/\d*(.*)$/);
      if(m) a.setAttribute("href", "https://wa.me/" + WA_NUMBER + (m[1]||""));
    });
    // إظهار/إخفاء زر «الطلب مباشرة عبر واتساب» (الاختصار المباشر + زر CTA الثانوي)
    if(cfg.showWhatsappBtn === false){
      document.querySelectorAll(".btn-wa, .lp-btn-green").forEach(a=>{ a.style.display = "none"; });
    }
    // إظهار/إخفاء زر «أضف إلى السلة»
    if(cfg.showAddToCart === false){
      document.querySelectorAll("#add-cart").forEach(b=>{ b.style.display = "none"; });
    }
    // نصوص الأزرار المخصصة
    const orderBtn = document.querySelector(".btn-order");
    if(orderBtn && cfg.orderBtnText){
      const span = orderBtn.querySelector("#btn-total");
      orderBtn.innerHTML = cfg.orderBtnText + ' — <span id="btn-total">' + (span?span.textContent:"") + '</span>';
    }
    if(cfg.whatsappBtnText){
      document.querySelectorAll(".btn-wa").forEach(a=>{ a.textContent = cfg.whatsappBtnText; });
    }
    const cartBtn = document.getElementById("add-cart");
    if(cartBtn && cfg.cartBtnText) cartBtn.textContent = cfg.cartBtnText;
    // تسميات الحقول (الاسم/الهاتف/البلدية) — تُطبَّق هنا أيضاً لأنها ثابتة في HTML قبل استبدال initProduct لحقل البلدية
    if(cfg.fieldLabels){
      Object.entries(cfg.fieldLabels).forEach(([id,label])=>{
        if(!label) return;
        const input = document.getElementById(id);
        const field = input ? input.closest(".field") : null;
        const lbl = field ? field.querySelector("label") : null;
        if(lbl){
          const req = /\*\s*$/.test(lbl.textContent) ? " *" : "";
          lbl.textContent = label + req;
        }
      });
    }
    applyCheckoutColors(cfg.colors);
  }catch(e){ /* تجاهل — إعدادات نموذج الطلب ليست حرجة لعمل الموقع */ }
}
async function initCheckout(){
  try{
    const cfg = await loadCheckout();
    applyCheckout(cfg);
    Guard.init(cfg && cfg.guard);
    PhoneDZ.setup(cfg);
  }catch(e){ /* تجاهل */ }
  try{ applyStore(await loadStore()); }catch(e){ /* تجاهل */ }
}
/* إعدادات المتجر (assets/data/store.json، من لوحة التحكم ← إعدادات الموقع): الاسم، واتساب، انستغرام، اللغة، العملة، وضع الصيانة */
async function loadStore(){
  try{ const r = await fetch((typeof REL!=="undefined"?REL:"") + "assets/data/store.json", {cache:"no-store"}); return r.ok ? await r.json() : null; }catch(e){ return null; }
}
function applyStore(c){
  if(!c || typeof c !== "object") return;
  window.STORE = c;
  try{
    if(typeof CONFIG !== "undefined" && CONFIG.SITE){
      if(c.name) CONFIG.SITE.name = c.name;
      if(c.instagram) CONFIG.SITE.instagram = String(c.instagram).replace(/^@/,"");
    }
    if(c.currency) window.__STORE_CUR = c.currency;
    if(c.lang && /^(ar|fr|en)$/.test(c.lang)) document.documentElement.lang = c.lang;
    const wa = String(c.wa || "").replace(/[^\d]/g,"");
    if(wa){
      WA_NUMBER = wa;
      document.querySelectorAll('a[href*="wa.me/"]').forEach(a=>{ const m = (a.getAttribute("href")||"").match(/wa\.me\/\d*(.*)$/); if(m) a.setAttribute("href", "https://wa.me/" + WA_NUMBER + (m[1]||"")); });
    }
    if(c.maintenance && !/admin\.html/.test(location.pathname) && localStorage.getItem("alyssum_admin_on") !== "1" && !document.getElementById("store-maint")){
      const d = document.createElement("div"); d.id = "store-maint";
      d.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#0b1511;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;font-family:inherit";
      const h = document.createElement("h1"); h.style.cssText = "font-size:1.6rem;margin:0"; h.textContent = c.name || "الموقع";
      const p = document.createElement("p"); p.style.cssText = "max-width:480px;line-height:1.9;margin:0;opacity:.9"; p.textContent = c.maintMsg || "الموقع تحت الصيانة حالياً، نعود إليكم قريباً.";
      d.append(h, p); document.body.appendChild(d);
    }
  }catch(e){ /* تجاهل */ }
}

/* ════════ حقول SEO (عنوان/وصف/صورة meta لكل صفحة) — تُحقن ديناميكياً عبر وسوم og و twitter ════════
   العنوان والوصف الأساسيان (title/meta description) مكتوبان مسبقاً في كل صفحة HTML يدوياً؛ هذه
   الدالة تُضيف فوقهما وسوم og/twitter (غير موجودة حالياً) لتحسين المشاركة على فيسبوك/واتساب/تويتر،
   وتستبدل العنوان/الوصف الافتراضيين فقط إذا ضُبط حقل SEO مخصص من لوحة التحكم */
function setMetaTag(attr, key, content){
  if(!content) return;
  let el = document.querySelector('meta[' + attr + '="' + key + '"]');
  if(!el){ el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute("content", content);
}
function applySeoTags(opts){
  opts = opts || {};
  if(opts.title) document.title = opts.title;
  if(opts.description) setMetaTag("name", "description", opts.description);
  const finalTitle = document.title || "";
  const descEl = document.querySelector('meta[name="description"]');
  const finalDesc = opts.description || (descEl ? descEl.getAttribute("content") : "") || "";
  let finalImage = "";
  if(opts.image){
    try{ finalImage = new URL((typeof REL!=="undefined"?REL:"") + opts.image, location.href).href; }catch(e){ finalImage = ""; }
  }
  setMetaTag("property", "og:title", finalTitle);
  setMetaTag("property", "og:description", finalDesc);
  if(finalImage) setMetaTag("property", "og:image", finalImage);
  setMetaTag("property", "og:type", opts.type || "website");
  setMetaTag("property", "og:url", location.href);
  setMetaTag("name", "twitter:card", finalImage ? "summary_large_image" : "summary");
  setMetaTag("name", "twitter:title", finalTitle);
  setMetaTag("name", "twitter:description", finalDesc);
  if(finalImage) setMetaTag("name", "twitter:image", finalImage);
}


/* Merchant managed SEO metadata; applied on product pages only. */
const Seo = (() => {
  let configPromise = null;
  async function config(){
    if(!configPromise) configPromise=fetch((typeof REL!=="undefined"?REL:"")+"assets/data/seo.json",{cache:"no-store"}).then(r=>r.ok?r.json():{}).catch(()=>({}));
    return configPromise;
  }
  function absolute(src){try{return src?new URL((src.startsWith("http://")||src.startsWith("https://")||src.startsWith("data:"))?src:(typeof REL!=="undefined"?REL:"")+src,location.href).href:"";}catch(e){return "";}}
  function setRobotsNoindex(){let tag=document.querySelector('meta[name="robots"]');if(!tag){tag=document.createElement("meta");tag.name="robots";document.head.appendChild(tag);}tag.content="noindex";}
  async function apply(p){
    if(!p||!p.slug)return;
    const cfg=await config(),record=(cfg.products&&cfg.products[p.slug])||{};
    const site=(typeof CONFIG!=="undefined"&&CONFIG.SITE)||{},brand=cfg.siteTitle||site.name||"";
    const title=p.seoTitle||record.title||[p.title,brand].filter(Boolean).join(" | ");
    const description=p.seoDesc||record.desc||p.desc||cfg.siteDesc||"";
    const image=p.seoImg||record.ogImage||p.cover||(p.images&&p.images[0])||cfg.ogImage||"";
    applySeoTags({title,description,image,type:"product"});
    const kws=[p.seoFocus,p.seoKw].map(x=>String(x||"").trim()).filter(Boolean).join(", ");
    if(kws)setMetaTag("name","keywords",kws);
    if(image.startsWith("http://")||image.startsWith("https://")){setMetaTag("property","og:image",image);setMetaTag("name","twitter:image",image);}
    const skipped=!!p.noindex||(Array.isArray(cfg.noindex)?cfg.noindex:[]).map(x=>String(x).replace(/^https?:\/\/[^/]+/i,"").replace(/^\/+|\/+$/g,"")).some(x=>x===p.slug||x==="p/"+p.slug);
    if(skipped)setRobotsNoindex();else{const managed=document.querySelector('meta[name="robots"][data-seo-managed="1"]');if(managed)managed.remove();}
    const images=(p.images&&p.images.length?p.images:[image]).map(absolute).filter(Boolean);
    const out=typeof isOutOfStock==="function"&&isOutOfStock(p);
    const schema={"@context":"https://schema.org","@type":"Product",name:p.title||title,description,image:images,url:location.href,sku:p.slug,offers:{"@type":"Offer",price:Number(p.price)||0,priceCurrency:"DZD",availability:out?"https://schema.org/OutOfStock":"https://schema.org/InStock",url:location.href}};
    let ld=document.querySelector('script[type="application/ld+json"][data-seo-product]');if(!ld){ld=document.createElement("script");ld.type="application/ld+json";ld.dataset.seoProduct="1";document.head.appendChild(ld);}ld.textContent=JSON.stringify(schema);
  }
  return {apply};
})();

/* ════════ أكواد الخصم (Coupons) — تُدار من لوحة التحكم admin.html ⟵ أكواد الخصم ════════
   تُقرأ من assets/data/coupons.json (ملف عام — راجع الملاحظة في admin.html)، ويُحقن حقل إدخال
   الكود ديناميكياً في صفحة المنتج ودرج السلة عبر الدالتين أدناه، دون الحاجة لتعديل كل صفحة HTML. */
let __couponsCache = null;
async function loadCoupons(){
  if(__couponsCache) return __couponsCache;
  try{
    const r = await fetch((typeof REL!=="undefined"?REL:"") + "assets/data/coupons.json", {cache:"no-store"});
    __couponsCache = r.ok ? await r.json() : [];
  }catch(e){ __couponsCache = []; }
  return __couponsCache;
}
function findValidCoupon(list, code, subtotal, items){
  const c = (list||[]).find(x=>x.code && x.code.toUpperCase()===String(code||"").trim().toUpperCase());
  if(!c) return { ok:false, msg:"⚠️ الكود غير صحيح" };
  if(c.active===false) return { ok:false, msg:"⚠️ هذا الكود غير مفعّل حالياً" };
  const now = Date.now(), from = c.from ? new Date(c.from + "T00:00:00").getTime() : 0, to = c.to ? new Date(c.to + "T23:59:59").getTime() : c.expiresAt ? new Date(c.expiresAt).getTime() : 0;
  if(from && now < from) return { ok:false, msg:"⚠️ يبدأ هذا الكود في " + c.from };
  if(to && now > to) return { ok:false, msg:"⚠️ انتهت صلاحية هذا الكود" };
  const min = Number(c.min != null ? c.min : c.minOrder) || 0;
  if(min && subtotal < min) return { ok:false, msg:"⚠️ الحدّ الأدنى للطلب " + fmt(min) };
  const lines = Array.isArray(items) ? items : [];
  if(c.cats && c.cats.length && !lines.some(it=>(c.cats||[]).includes(it.cat))) return { ok:false, msg:"⚠️ لا ينطبق هذا الكود على فئات سلتك" };
  if(c.slugs && c.slugs.length && !lines.some(it=>(c.slugs||[]).includes(it.slug))) return { ok:false, msg:"⚠️ لا ينطبق هذا الكود على منتجات سلتك" };
  if(c.stack === false && lines.some(it=>Number(it.qty)>1 || Number(it.free)>0)) return { ok:false, msg:"⚠️ لا يمكن جمع هذا الكود مع عرض الكمية" };
  const eligible = lines.length && (c.cats && c.cats.length || c.slugs && c.slugs.length)
    ? lines.filter(it=>(!c.cats || !c.cats.length || c.cats.includes(it.cat)) && (!c.slugs || !c.slugs.length || c.slugs.includes(it.slug))).reduce((s,it)=>s+(Number(it.amount)||0),0)
    : subtotal;
  if(c.type==="freeship" || c.type==="gift") return { ok:true, coupon:c, discount:0 };      // توصيل مجاني / هدية منتج: بلا مبلغ خصم
  let discount = c.type==="percent" ? Math.round(eligible * Number(c.value)/100) : Math.min(Number(c.value)||0, eligible);
  if(c.type==="percent" && Number(c.max)>0) discount = Math.min(discount, Number(c.max));
  if(discount<=0) return { ok:false, msg:"⚠️ الكود غير صالح لهذا الطلب" };
  return { ok:true, coupon:c, discount };
}
/* حالة الكود المُطبَّق — مشتركة بين صفحة المنتج ودرج السلة (سياق واحد نشط في كل مرة عملياً) */
const AppliedCoupon = { code:"", record:null };
function couponCartItems(){ return (typeof Cart !== "undefined" ? Cart.all() : []).map(it=>{const p=PRODUCTS.find(x=>x.slug===it.slug)||{};return {slug:it.slug,cat:p.cat,qty:it.qty,amount:Number(it.qty)*Number(it.price)};}); }
function markCouponPhoneUsed(c, phone){ if(!c || !c.perPhone || !phone) return; try{ const k="alyssum_coupon_phone_"+c.code.toUpperCase(), a=JSON.parse(localStorage.getItem(k)||"[]"), d=String(phone).replace(/\D/g,""); if(d&&!a.includes(d)){a.push(d);localStorage.setItem(k,JSON.stringify(a));} }catch(e){} }
function couponHasPreviousOrders(){ let prior=false; try{const recent=JSON.parse(localStorage.getItem("alyssum_recent_orders")||"{}");prior=Object.keys(recent||{}).length>0;}catch(e){} try{const profile=typeof Account!=="undefined"&&Account.profile?Account.profile():null;prior=prior||!!(profile&&(Number(profile.ordersCount)>0||Number(profile.order_count)>0||(Array.isArray(profile.orders)&&profile.orders.length)));}catch(e){} return prior; }
function couponPhoneAlreadyUsed(c,phone){ if(!c||!c.perPhone||!phone)return false; try{const used=JSON.parse(localStorage.getItem("alyssum_coupon_phone_"+c.code.toUpperCase())||"[]"),digits=String(phone).replace(/\D/g,"");return digits.length>=9&&used.includes(digits);}catch(e){return false;} }
function couponFreeShip(){ return !!(AppliedCoupon.record && AppliedCoupon.record.type==="freeship"); }
function couponGiftTitle(){
  const r = AppliedCoupon.record; if(!r || r.type!=="gift") return "";
  if(r.giftTitle) return r.giftTitle;
  const pr = (typeof PRODUCTS !== "undefined") ? PRODUCTS.find(x=>x.slug===r.product) : null; return pr ? pr.title : (r.product||"");
}
function couponMsg(res){
  const c = res.coupon;
  return c.type==="freeship" ? "✅ تم تطبيق الكود — توصيل مجاني 🚚" : c.type==="gift" ? "✅ تم تطبيق الكود — هديتك: " + (c.giftTitle || (PRODUCTS.find(x=>x.slug===c.product)||{}).title || c.product) + " 🎁" : "✅ تم تطبيق الكود — خصم " + fmt(res.discount);
}
function currentCouponDiscount(subtotal, items){
  if(!AppliedCoupon.record || !subtotal) return 0;
  const res = findValidCoupon([AppliedCoupon.record], AppliedCoupon.code, subtotal, items);
  return res.ok ? res.discount : 0;
}

/* Automatic discounts (FR-DSC-3). Pure calculation is kept independent of the DOM. */
const AutoDisc = {
  rules: [],
  compute(cart, rules, coupon) {
    const now = new Date();
    const items = (Array.isArray(cart) ? cart : []).map(it => ({
      slug: String(it.slug || ""), cat: String(it.cat || ""),
      qty: Math.max(0, Math.floor(Number(it.qty) || 0)),
      price: Math.max(0, Number(it.price) || (Number(it.qty) ? Number(it.amount || 0) / Number(it.qty) : 0))
    })).filter(it => it.qty > 0);
    const subtotal = items.reduce((sum, it) => sum + it.qty * it.price, 0);
    const eligible = (it, selector) => {
      if (!selector || (!selector.slugs && !selector.cats)) return true;
      const slugs = Array.isArray(selector.slugs) ? selector.slugs : selector.slug ? [selector.slug] : [];
      const cats = Array.isArray(selector.cats) ? selector.cats : selector.cat ? [selector.cat] : [];
      return (!slugs.length && !cats.length) || slugs.includes(it.slug) || cats.includes(it.cat);
    };
    const active = (rule) => rule && rule.active !== false &&
      (!rule.from || new Date(rule.from + "T00:00:00").getTime() <= now.getTime()) &&
      (!rule.to || new Date(rule.to + "T23:59:59").getTime() >= now.getTime()) &&
      (!Number(rule.min) || subtotal >= Number(rule.min));
    const candidates = (Array.isArray(rules) ? rules : []).filter(active).map(rule => {
      let amount = 0;
      if (rule.kind === "bxgy") {
        const buyItems = items.filter(it => eligible(it, rule.buy));
        const buyQty = Math.max(1, Math.floor(Number(rule.buy && rule.buy.qty) || 1));
        const getQty = Math.max(1, Math.floor(Number(rule.get && rule.get.qty) || 1));
        const times = Math.floor(buyItems.reduce((n, it) => n + it.qty, 0) / (buyQty + getQty));
        const getSelector = rule.get && rule.get.same ? rule.buy : { slugs: rule.get && rule.get.slug ? [rule.get.slug] : [] };
        const getItems = items.filter(it => eligible(it, getSelector));
        let free = Math.min(times * getQty, getItems.reduce((n, it) => n + it.qty, 0));
        getItems.sort((a, b) => a.price - b.price);
        for (const it of getItems) {
          const n = Math.min(free, it.qty);
          amount += n * it.price * (Math.min(100, Math.max(0, rule.get && rule.get.percent != null ? Number(rule.get.percent) : 100)) / 100);
          free -= n;
          if (!free) break;
        }
      } else {
        const base = items.filter(it => eligible(it, rule)).reduce((n, it) => n + it.qty * it.price, 0);
        amount = rule.kind === "auto_percent"
          ? Math.round(base * Math.max(0, Number(rule.value) || 0) / 100)
          : rule.kind === "auto_fixed" ? Math.min(base, Math.max(0, Number(rule.value) || 0)) : 0;
      }
      return { rule, discount: Math.max(0, Math.min(subtotal, Math.round(amount))) };
    }).filter(x => x.discount > 0).sort((a, b) => b.discount - a.discount);
    const best = candidates[0] || null;
    const codeDiscount = Math.max(0, Math.min(subtotal, Math.round(Number(coupon && coupon.discount) || 0)));
    if (!best) return { discount: codeDiscount, autoDiscount: 0, couponDiscount: codeDiscount, rule: null, message: "" };
    const stack = best.rule.stack === true;
    if (stack) {
      const total = Math.min(subtotal, best.discount + codeDiscount);
      return { discount: total, autoDiscount: total - codeDiscount, couponDiscount: codeDiscount, rule: best.rule,
        message: String(best.rule.name || (best.rule.kind === "bxgy" ? "اشترِ واحصل على هدية" : "خصم تلقائي")) };
    }
    if (best.discount > codeDiscount) return { discount: best.discount, autoDiscount: best.discount, couponDiscount: 0, rule: best.rule,
      message: String(best.rule.name || (best.rule.kind === "bxgy" ? "اشترِ واحصل على هدية" : "خصم تلقائي")) };
    return { discount: codeDiscount, autoDiscount: 0, couponDiscount: codeDiscount, rule: null, message: "" };
  },
  load() {
    fetch((typeof REL!=="undefined"?REL:"") + "assets/data/autodisc.json", { cache: "no-store" }).then(r => r.ok ? r.json() : [])
      .then(data => { this.rules = Array.isArray(data) ? data : []; if (typeof Cart !== "undefined") Cart.render(); })
      .catch(() => { this.rules = []; });
  }
};
AutoDisc.load();
function currentCartDiscount(subtotal, items) {
  const codeDiscount = currentCouponDiscount(subtotal, items);
  const cart = (items || []).map(it => ({ ...it, price: Number(it.qty) ? Number(it.amount || 0) / Number(it.qty) : 0 }));
  return AutoDisc.compute(cart, AutoDisc.rules, { discount: codeDiscount });
}

function buildCouponBoxHTML(idPrefix){
  return '<div class="coupon-box" style="display:flex;gap:.4rem;margin:.6rem 0;align-items:center;flex-wrap:wrap">' +
    '<input id="' + idPrefix + '-coupon-input" placeholder="🎟️ كود الخصم (إن وُجد)" style="flex:1;min-width:120px;padding:.55rem .7rem;border:1.5px solid var(--line);border-radius:8px;font-family:inherit">' +
    '<button type="button" id="' + idPrefix + '-coupon-btn" class="btn-cart2" style="padding:.5rem .9rem;white-space:nowrap">تطبيق</button>' +
    '</div><div id="' + idPrefix + '-coupon-msg" style="font-size:.82rem;margin:-.3rem 0 .6rem;min-height:1.1em"></div>';
}
/* يُدرج صندوق كود الخصم قبل عنصر مرجعي (مربع الإجمالي)، ويربط منطق التطبيق بدالة إعادة الحساب rerender */
function injectCouponBox(idPrefix, beforeEl, getSubtotal, rerender, getItems){
  if(!beforeEl && !document.getElementById(idPrefix + "-coupon-input")) return;
  /* صفحات المنتجات الثابتة تحمل صندوق الكود جاهزاً في HTML (بلا أي معالج) — نربط المعالج به بدل الخروج، وإلا لا يعمل الكود إطلاقاً */
  if(!document.getElementById(idPrefix + "-coupon-input")){
    const wrap = document.createElement("div");
    wrap.innerHTML = buildCouponBoxHTML(idPrefix);
    while(wrap.firstChild) beforeEl.parentNode.insertBefore(wrap.firstChild, beforeEl);
  }
  const input = document.getElementById(idPrefix + "-coupon-input");
  if(input.dataset.bound) return; input.dataset.bound = "1";
  const msg = document.getElementById(idPrefix + "-coupon-msg");
  async function apply(){
    const code = (input.value||"").trim();
    if(!code){ AppliedCoupon.code=""; AppliedCoupon.record=null; msg.textContent=""; rerender(); return; }
    let list = (await loadCoupons()).concat(await Gifts.records());      // + هدايا الحساب (ترحيب/تثبيت) غير المستعملة
    /* كود شخصي (إعادة الشراء): ليس في الملف العام، يُفحص على الخادم مع رقم هاتف الطلب */
    if(!list.some(c=>String(c.code||"").toUpperCase() === code.toUpperCase())){
      const ph = (document.getElementById("phone") || document.getElementById("cphone") || {}).value || "";
      if(/^(BACK|PR|WEL|APP)-/i.test(code)){
        if(ph.replace(/\D/g, "").length < 9){ AppliedCoupon.code=""; AppliedCoupon.record=null; msg.textContent="📱 أدخل رقم هاتفك في النموذج أولاً — هذا الكود شخصي"; msg.style.color="var(--red)"; rerender(); return; }
        let pr = null; try{ pr = await API.promoCheck(code, ph); }catch(e){}
        if(pr && pr.ok) list = list.concat([{ code: code.toUpperCase(), type: pr.type, value: pr.value, minOrder: pr.minOrder, expiresAt: pr.expiresAt, active: true, __promo: true }]);
        else if(pr && pr.error){ AppliedCoupon.code=""; AppliedCoupon.record=null; msg.textContent = pr.error === "used" ? "⚠️ هذا الكود استُعمل من قبل" : pr.error === "expired" ? "⚠️ انتهت صلاحية هذا الكود" : "⚠️ هذا الكود غير صالح لهذا الرقم"; msg.style.color="var(--red)"; rerender(); return; }
      }
    }
    const lines = getItems ? getItems() : [];
    const candidate = list.find(c=>String(c.code||"").toUpperCase()===code.toUpperCase());
    if(candidate && candidate.firstOrder){
      if(couponHasPreviousOrders()){ AppliedCoupon.code=""; AppliedCoupon.record=null; msg.textContent="⚠️ هذا الكود مخصّص لأول طلب فقط"; msg.style.color="var(--red)"; rerender(); return; }
    }
    if(candidate && candidate.perPhone){
      const ph=(document.getElementById("phone")||document.getElementById("cphone")||{}).value||"", digits=ph.replace(/\D/g,"");
      if(digits.length<9){AppliedCoupon.code="";AppliedCoupon.record=null;msg.textContent="📱 أدخل رقم هاتفك للتحقق من هذا الكود";msg.style.color="var(--red)";rerender();return;}
      if(couponPhoneAlreadyUsed(candidate,ph)){AppliedCoupon.code="";AppliedCoupon.record=null;msg.textContent="⚠️ استُعمل هذا الكود من قبل لهذا الرقم";msg.style.color="var(--red)";rerender();return;}
    }
    const res = findValidCoupon(list, code, getSubtotal(), lines);
    if(!res.ok){
      AppliedCoupon.code=""; AppliedCoupon.record=null;
      msg.textContent = res.msg; msg.style.color = "var(--red)";
    }else{
      AppliedCoupon.code = res.coupon.code; AppliedCoupon.record = res.coupon;
      msg.textContent = couponMsg(res);
      msg.style.color = "var(--ok)";
    }
    rerender();
  }
  input.addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); apply(); } });
  document.getElementById(idPrefix + "-coupon-btn").onclick = apply;
  /* رابط يحمل ?code=XXXX (رسائل إعادة الشراء): يملأ الكود تلقائياً؛ الكود الشخصي BACK-/WEL-... يُطبَّق بعد إدخال الهاتف */
  try{
    const qc = (new URLSearchParams(location.search).get("code") || "").trim();
    if(qc && /^[A-Za-z0-9_-]{3,30}$/.test(qc) && !input.value){
      input.value = qc.toUpperCase();
      if(/^(BACK|PR|WEL|APP)-/i.test(qc)){
        const ph = document.getElementById("phone") || document.getElementById("cphone");
        if(ph){ const go = ()=>{ if(!AppliedCoupon.code && ph.value.replace(/\D/g, "").length >= 10){ ph.removeEventListener("input", go); apply(); } }; ph.addEventListener("input", go); go(); }
        msg.textContent = "🎟️ كودك الشخصي جاهز — أدخل رقم هاتفك ليُطبَّق تلقائياً"; msg.style.color = "var(--ok)";
      } else setTimeout(apply, 400);
    }
  }catch(e){}
}

/* ── صفحة المنتج ── */
function initProduct(slug){
  const p = PRODUCTS.find(p=>p.slug===slug);
  if(!p) return;
  // العرض الافتراضي المُحدَّد مسبقاً هو نفسه العرض "الأكثر طلباً" (bestIdx) — قبل هذا التصحيح
  // كان يُحدَّد افتراضياً «قطعة واحدة» بينما شارة «الأكثر طلباً 🔥» تظهر على عرض آخر، ما يُشتّت الزبون
  const bestIdx = 2;
  const state = { offer: p.offers[bestIdx] || p.offers[0], wilaya:null, dtype:"home" };
  const outOfStock = isOutOfStock(p);

  function updateLowStockNote(variation){
    const pp = document.getElementById("pprice"); if(!pp || !pp.parentElement) return;
    let note = pp.parentElement.querySelector(".stk-note");
    const stockProduct = variation && variation.stock != null ? Object.assign({}, p, { stock:variation.stock }) : p;
    const text = lowStockNote(stockProduct);
    if(text){ if(!note){ note = document.createElement("small"); note.className = "stk-note"; pp.parentElement.appendChild(note); } note.textContent = text; }
    else if(note) note.remove();
  }
  updateLowStockNote();

  Seo.apply(p);

  // معرض الصور — تُقرأ دائماً من data.js (p.images) عند كل تحميل للصفحة، ولا تُترك
  // لتجمّد داخل HTML الثابت للصفحة، حتى تبقى متطابقة مع ما يُعدَّل من لوحة التحكم
  const staticGallery = !!document.querySelector(".gthumbs[data-static]");   // صفحات القالب الجديد: معرض مكتوب في الصفحة نفسها (يُعدَّل من اللوحة) ولا يتبع صور المنتج
  if(!staticGallery){
    const main = document.getElementById("gmain");
    const gthumbsEl = document.querySelector(".gthumbs");
    if(gthumbsEl) gthumbsEl.innerHTML = ""; // تفريغ أي صور مصغّرة ثابتة مضمّنة في HTML (تفادي التكرار)
    if(main && p.images && p.images[0]) main.src = REL + p.images[0]; // مزامنة الصورة الرئيسية مع أول صورة في المعرض (تفادي بقائها قديمة)
    p.images.forEach((src,i)=>{
      const th = document.createElement("img");
      th.src = REL+src; th.alt = p.title;
      if(i===0) th.classList.add("on");
      th.onclick = ()=>{ main.src=REL+src; document.querySelectorAll(".gthumbs img").forEach(x=>x.classList.remove("on")); th.classList.add("on"); };
      document.querySelector(".gthumbs").appendChild(th);
    });
  }

  // العروض — العرض المُحدَّد بصرياً (on) هو نفسه bestIdx المُفعَّل افتراضياً في state.offer أعلاه
  // للمنتج المتغيّر تُعاد أسعار العروض بنسبة سعر التنويع المختار إلى السعر الأساسي (p.price)
  const offersBox = document.getElementById("offers");
  const type = productType(p);
  let offerIdx = bestIdx;
  function buildOffers(){
    offersBox.innerHTML = ""; // تفريغ أي بطاقات عروض ثابتة مضمّنة في HTML (تفادي التكرار)
    const sc = (type==="variable" && state.variation && Number(p.price)>0) ? state.variation.price / p.price : 1;
    (p.offers || []).forEach((o0,i)=>{
      const o = sc===1 ? o0 : Object.assign({}, o0, { price: Math.round(o0.price*sc) });
      const paid = o.qty - (o.free||0);
      const unit = Math.round(o.price/paid);
      const disc = Math.round((1 - o.price/(p.price*sc*paid))*100);
      const d = document.createElement("div");
      d.className = "offer"+(i===offerIdx?" on":"");
      const label = o.free ? "قطعتان + الثالثة 🎁" : (o.qty===1?"قطعة واحدة":o.qty===2?"قطعتان":o.qty+" قطع");
      d.innerHTML = `${i===bestIdx?'<span class="best">الأكثر طلباً 🔥</span>':""}
        <div class="q">${label}</div>
        <div class="p">${fmt(o.price)}</div>
        <div class="u">${fmt(unit)} للقطعة ${disc>0?`· وفر ${disc}%`:""}${o.free?'<br><b style="color:var(--ok)">مجاناً داخل العرض</b>':""}${offerFreeShip(p,o)?'<br><b style="color:var(--ok)">🚚 شحن مجاني</b>':""}</div>`;
      d.onclick = ()=>{
        offerIdx = i; state.offer = o;
        document.querySelectorAll(".offer").forEach(x=>x.classList.remove("on"));
        d.classList.add("on");
        update();
      };
      offersBox.appendChild(d);
      if(i===offerIdx) state.offer = o;
    });
  }
  buildOffers();

  /* ── منتج متغيّر: اختيار السمات (لون/مقاس...) ثم يتحدد التنويع بسعره ومخزونه وصورته ── */
  const attrEsc = t => String(t).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
  function heroPrice(priceTxt, old){
    const pp = document.getElementById("pprice"), po = document.getElementById("pold"), ps = document.getElementById("psave");
    if(!pp) return;
    pp.textContent = priceTxt;
    const has = old && old.value > old.price;
    if(po){ po.textContent = has ? fmt(old.value) : ""; po.style.display = has ? "" : "none"; }
    if(ps){ ps.textContent = has ? "وفّر " + Math.round((1-old.price/old.value)*100) + "%" : ""; ps.style.display = has ? "" : "none"; }
    updateLowStockNote(type === "variable" ? state.variation : null);
  }
  function refreshHeroPrice(){
    if(type==="variable"){
      if(state.variation) heroPrice(fmt(state.variation.price), state.variation.old ? { value:Number(state.variation.old), price:state.variation.price } : null);
      else heroPrice((hasPriceRange(p) ? "من " : "") + fmt(minPrice(p)), null);
    }else if(type==="grouped"){
      const tp = state.offer ? state.offer.price : 0;
      heroPrice(tp>0 ? fmt(tp) : (hasPriceRange(p) ? "من " : "") + fmt(minPrice(p)), null);
    }
  }
  const variantAttrs = (type==="variable") ? (p.attributes||[]).filter(a=>a.variation && (a.values||[]).length) : [];
  const varSel = {};
  function missingAttrs(){ return variantAttrs.filter(a=>!varSel[a.name]).map(a=>a.name); }
  if(type==="variable"){
    const vs = activeVariations(p);
    const box = document.createElement("div"); box.id = "variants"; box.className = "variant-box";
    offersBox.parentNode.insertBefore(box, offersBox);
    const compatible = (name, val)=>vs.some(v=>!varOut(v) && v.attrs[name]===val && variantAttrs.every(a=>a.name===name || !varSel[a.name] || v.attrs[a.name]===varSel[a.name]));
    function pickVariation(){
      const done = variantAttrs.length && variantAttrs.every(a=>varSel[a.name]);
      state.variation = done ? (vs.find(v=>variantAttrs.every(a=>v.attrs[a.name]===varSel[a.name])) || null) : null;
      if(state.variation && state.variation.image){ const m = document.getElementById("gmain"); if(m) m.src = REL + state.variation.image; }
      buildOffers(); refreshHeroPrice(); update(); renderVariants();
    }
    function renderVariants(){
      box.innerHTML = variantAttrs.map(a=>`<div class="v-attr"><div class="v-name">${attrEsc(a.name)}${varSel[a.name]?`: <b>${attrEsc(varSel[a.name])}</b>`:""}</div><div class="v-vals">${a.values.map(val=>{
          const ok = compatible(a.name, val);
          return `<button type="button" class="v-chip${varSel[a.name]===val?" on":""}${ok?"":" off"}" data-a="${attrEsc(a.name)}" data-v="${attrEsc(val)}" ${ok?"":"disabled"}>${attrEsc(val)}</button>`; }).join("")}</div></div>`).join("") +
        `<div class="v-hint">${state.variation ? "✅ متوفر" : (missingAttrs().length ? "اختر: " + missingAttrs().map(attrEsc).join(" و ") : "هذا الاختيار غير متوفر")}</div>`;
    }
    box.addEventListener("click", e=>{
      const btn = e.target.closest(".v-chip"); if(!btn || btn.disabled) return;
      const name = btn.dataset.a, val = btn.dataset.v;
      varSel[name] = (varSel[name]===val) ? "" : val;
      variantAttrs.forEach(a=>{ if(a.name!==name && varSel[a.name] && !compatible(a.name, varSel[a.name])) varSel[a.name] = ""; });
      pickVariation();
    });
    if(vs.length===1) variantAttrs.forEach(a=>varSel[a.name] = vs[0].attrs[a.name]);
    renderVariants();
    if(vs.length===1) setTimeout(pickVariation, 0);   // بعد تعريف update()
  }

  /* ── منتج مجمّع: عدة منتجات فردية بكمية لكل منها ── */
  if(type==="grouped"){
    const kids = groupChildren(p), qty = kids.map(()=>0);
    const box = document.createElement("div"); box.id = "group-box"; box.className = "group-box";
    box.innerHTML = kids.map((c,i)=>{
      const oos = isOutOfStock(c), img = c.cover || (c.images && c.images[0]) || "";
      return `<div class="g-row" data-i="${i}"><img src="${REL}${img}" alt=""><div class="g-t"><b>${attrEsc(c.title)}</b><small>${fmt(c.price)}${c.old?` <s>${fmt(c.old)}</s>`:""}${oos?' · <b style="color:var(--red)">نفدت</b>':""}</small></div>
        <div class="g-q"><button type="button" data-d="-1" ${oos?"disabled":""}>−</button><b>0</b><button type="button" data-d="1" ${oos?"disabled":""}>+</button></div></div>`;
    }).join("");
    offersBox.parentNode.insertBefore(box, offersBox); offersBox.style.display = "none";
    state.group = { kids, qty };
    const recalc = ()=>{
      const tq = qty.reduce((a,b)=>a+b,0), tp = qty.reduce((s2,q,i)=>s2+q*(Number(kids[i].price)||0),0);
      state.offer = { qty: tq, price: tp };
      box.querySelectorAll(".g-row").forEach((row,i)=>row.querySelector(".g-q b").textContent = qty[i]);
      refreshHeroPrice(); update();
    };
    box.addEventListener("click", e=>{
      const btn = e.target.closest("button[data-d]"); if(!btn || btn.disabled) return;
      const i = +btn.closest(".g-row").dataset.i; qty[i] = Math.max(0, Math.min(99, qty[i] + (+btn.dataset.d))); recalc();
    });
    state.offer = { qty:0, price:0 };
  }
  if(type!=="simple") setTimeout(refreshHeroPrice, 0);   // بعد سكربت الصفحة الذي يكتب سعر المنتج الأساسي
  // إخفاء بطاقات العروض إن عُطِّلت من لوحة التحكم ⟵ نموذج الطلب — يبقى العرض «الأكثر طلباً» (bestIdx)
  // محتسَباً داخلياً في state.offer لأغراض التسعير رغم إخفاء واجهة الاختيار
  if(__checkoutCache && __checkoutCache.showOffers === false) offersBox.style.display = "none";

  // نفاد الكمية — تعطيل الطلب وإظهار تنبيه (يُضبط من لوحة التحكم، حقل المخزون في تبويب المنتجات)
  if(outOfStock){
    const form = document.getElementById("order-form");
    if(form){
      const warn = document.createElement("div");
      warn.className = "oos-warning";
      warn.textContent = "⚠️ نفدت كمية هذا المنتج حالياً — سيتوفر قريباً";
      form.parentNode.insertBefore(warn, form);
      form.querySelectorAll("input,select,textarea,button").forEach(el=>el.disabled = true);
    }
    const addCartBtn = document.getElementById("add-cart");
    if(addCartBtn) addCartBtn.disabled = true;
    document.querySelectorAll(".btn-wa").forEach(a=>{
      a.style.pointerEvents = "none"; a.style.opacity = ".5";
    });
    document.querySelectorAll('a[href="#order-form"]').forEach(a=>{
      a.style.pointerEvents = "none"; a.style.opacity = ".5";
    });
  }

  // العد التنازلي 48 ساعة — عرض «اشترِ 2 والثالثة مجاناً»
  (function dealCountdown(){
    const boxes = document.querySelectorAll(".deal-timer");
    if(!boxes.length) return;
    const KEY = "alyssum_deal_"+slug;
    let end = parseInt(localStorage.getItem(KEY)||"0",10);
    if(!end || end < Date.now()){
      end = Date.now() + 48*3600*1000;
      localStorage.setItem(KEY, String(end));
    }
    function tick(){
      let left = end - Date.now();
      if(left <= 0){
        end = Date.now() + 48*3600*1000;
        localStorage.setItem(KEY, String(end));
        left = 48*3600*1000;
      }
      const h = Math.floor(left/3600000), m = Math.floor(left%3600000/60000), s = Math.floor(left%60000/1000);
      const txt = `${String(h).padStart(2,"0")} : ${String(m).padStart(2,"0")} : ${String(s).padStart(2,"0")}`;
      boxes.forEach(b=>b.textContent = txt);
    }
    tick();
    setInterval(tick, 1000);
  })();

  // الولايات والبلديات — قوائم منسدلة متوافقة مع الهاتف
  const sel = document.getElementById("wilaya");
  const deskWrap = document.getElementById("desk-wrap");
  const deskSel = document.getElementById("desk");

  // حذف حقل العنوان (غير ضروري)
  const addrInput = document.getElementById("address");
  if (addrInput){ const f = addrInput.closest(".field"); if(f) f.remove(); else addrInput.remove(); }

  // استبدال حقل البلدية بقائمة منسدلة (الداتاليست لا يعمل جيداً على الهاتف)
  let communeSel = null;
  const communeInput = document.getElementById("commune");
  if (communeInput){
    communeSel = document.createElement("select");
    communeSel.id = "commune"; communeSel.setAttribute("aria-label", "البلدية");
    communeSel.innerHTML = '<option value="">— اختر البلدية —</option>';
    communeInput.replaceWith(communeSel);
  }
  function setCommunes(w){
    if(!communeSel) return;
    communeSel.innerHTML = '<option value="">— اختر البلدية —</option>';
    (w && w.communes ? w.communes : []).forEach(c=>{
      const o = document.createElement("option"); o.value = c; o.textContent = shipOptLabel(w, c); if(w && w.xc && w.xc[c] === "all") o.disabled = true; communeSel.appendChild(o);
    });
  }
  // مكاتب Stop Desk الحقيقية من Yalidine — تُرشَّح حسب البلدية المختارة
  function setDesks(w){
    if(!deskSel) return;
    const commune = communeSel ? communeSel.value : "";
    const allDesks = (w && w.desks) ? w.desks : [];
    const desks = commune ? allDesks.filter(d=>d.commune===commune) : allDesks;
    deskSel.innerHTML = '<option value="">— اختر أقرب مكتب —</option>';
    desks.forEach(d=>{
      const o = document.createElement("option");
      o.value = d.name;
      o.textContent = `${d.name}${d.commune ? " — " + d.commune : ""}`;
      deskSel.appendChild(o);
    });
    const hasDesk = desks.length > 0;
    // إخفاء/إظهار حسب نوع التوصيل
    if(deskWrap) deskWrap.style.display = (state.dtype==="stop" && hasDesk) ? "" : "none";
    // تعطيل خيار المكتب إذا لا يوجد مكتب في البلدية المختارة
    document.querySelectorAll('input[name="dtype"]').forEach(r=>{
      if(r.value === "stop"){
        r.disabled = !hasDesk;
        const lbl = r.closest("label");
        if(lbl){
          lbl.style.opacity = hasDesk ? 1 : .45;
          lbl.title = hasDesk ? "" : "لا يوجد مكتب Stop Desk في هذه البلدية";
        }
        if(!hasDesk && r.checked){
          const home = document.querySelector('input[name="dtype"][value="home"]');
          if(home){ home.checked = true; state.dtype = "home"; }
        }
      } else { r.disabled = false; const l = r.closest("label"); if(l){ l.style.opacity = 1; l.title = ""; } }
    });
    shipRadios("dtype", w, commune);
    const cur = document.querySelector('input[name="dtype"]:checked'); if(cur) state.dtype = cur.value;
  }
  WILAYAS.forEach(w=>{
    const o = document.createElement("option");
    o.value = w.id; o.textContent = `${String(w.id).padStart(2,"0")} - ${w.name}` + (w.xw ? " (غير متاح)" : ""); if(w.xw) o.disabled = true;
    sel.appendChild(o);
  });
  sel.onchange = ()=>{ state.wilaya = WILAYAS.find(w=>w.id==sel.value); setCommunes(state.wilaya); setDesks(state.wilaya); update() };
  if(communeSel) communeSel.onchange = ()=>{ setDesks(state.wilaya); update() };
  document.querySelectorAll('input[name="dtype"]').forEach(r=>r.onchange=()=>{ state.dtype=r.value; setDesks(state.wilaya); update() });
  if(deskSel) deskSel.onchange = ()=>{ state.desk = deskSel.value; };

  // حقول إضافية مخصصة (تُضاف من لوحة التحكم ⟵ نموذج الطلب) — تُدرج قبل مربع الإجمالي وتُرفَق
  // قيمتها في رسالة واتساب عند تأكيد الطلب (راجع معالج submit أدناه)
  const extraFields = (__checkoutCache && Array.isArray(__checkoutCache.extraFields)) ? __checkoutCache.extraFields : [];
  if(extraFields.length){
    const form = document.getElementById("order-form");
    const totalBoxRef = document.getElementById("fee") ? document.getElementById("fee").closest(".total-box") : null;
    extraFields.forEach(f=>{
      if(!f || !f.id) return;
      const field = document.createElement("div");
      field.className = "field";
      field.innerHTML = `<label>${f.label||""}${f.required?" *":""}</label><input id="extra-${f.id}" ${f.required?"required":""} placeholder="${f.placeholder||""}">`;
      if(totalBoxRef) totalBoxRef.parentNode.insertBefore(field, totalBoxRef);
      else if(form) form.appendChild(field);
    });
  }

  const feeEl = document.getElementById("fee"), totEl = document.getElementById("grand");
  function update(){
    const freeShip = offerFreeShip(p, state.offer) || couponFreeShip();
    const sq = state.wilaya ? shipQuote(state.wilaya, communeSel ? communeSel.value : "", state.dtype, state.offer.price, p.shipCo, prodShipPf(p)) : null;
    const fee = freeShip ? 0 : (sq ? sq.fee : null);
    feeEl.textContent = freeShip ? "مجاني 🚚" : (sq && sq.blocked ? "غير متاح ⛔" : (sq && sq.free ? "مجاني 🚚" : (fee!=null ? fmt(fee) : "اختر الولاية")));
    let sm = document.getElementById("ship-msg");
    if(!sm){ sm = document.createElement("div"); sm.id = "ship-msg"; sm.style.cssText = "color:var(--red,#c0392b);font-size:.88rem;margin:.4rem 0;font-weight:700"; const tb = feeEl.closest(".total-box"); if(tb) tb.parentNode.insertBefore(sm, tb); }
    sm.textContent = (!freeShip && sq) ? sq.msg : "";
    const discount = currentCouponDiscount(state.offer.price, [{slug:p.slug,cat:p.cat,qty:state.offer.qty,free:state.offer.free,amount:state.offer.price}]);
    const total = Math.max(0, state.offer.price - discount) + (fee||0);
    totEl.textContent = fmt(total);
    const st = document.getElementById("sticky-price");
    if(st) st.textContent = fmt(total);
    // زر «تأكيد الطلب» كان يعرض دائماً سعر القطعة الواحدة الثابت (p.price) ولا يتحدّث أبداً
    // مع تغيير العرض أو إضافة رسوم التوصيل — أصبح الآن يعكس نفس الإجمالي الحقيقي دوماً (يشمل خصم الكوبون إن وُجد)
    const bt = document.getElementById("btn-total");
    if(bt) bt.textContent = fmt(total);
  }
  update();
  document.addEventListener("shipco:ready", ()=>{ try{ update(); }catch(e){} });
  // حقل كود الخصم — يُحقن ديناميكياً قبل مربع الإجمالي (لا حاجة لتعديل كل صفحة منتج يدوياً)
  const totalBoxEl = feeEl.closest(".total-box");
  if(totalBoxEl) injectCouponBox("prod", totalBoxEl, ()=>state.offer.price, update, ()=>[{slug:p.slug,cat:p.cat,qty:state.offer.qty,free:state.offer.free,amount:state.offer.price}]);

  // بنود الطلب حسب نوع المنتج (المتغيّر: عنوان التنويع داخل الاسم؛ المجمّع: بند لكل منتج بكمية)
  function orderItems(){
    if(type==="grouped") return state.group.kids.map((c,i)=>({ slug:c.slug, title:c.title, qty:state.group.qty[i], price:Number(c.price)||0 })).filter(x=>x.qty>0);
    const title = p.title + (state.variation ? " — " + variationLabel(p, state.variation) : "");
    /* سعر القطعة = سعر العرض ÷ عدد القطع الكلي (بما فيها المجانية) ليكون مجموع السطر = سعر العرض تماماً (كان 3 قطع بعرض «2+1» تُسجَّل 3×سعر القطعة الكاملة فيظهر مجموع أكبر من الحقيقي) */
    return [{ slug: p.slug, title, qty: state.offer.qty, price: Math.round(state.offer.price / state.offer.qty * 100) / 100 }];
  }

  // تأكيد الطلب — واتساب
  document.getElementById("order-form").addEventListener("submit", async e=>{
    e.preventDefault();
    if(outOfStock){ toast("⚠️ نفدت كمية هذا المنتج حالياً"); return }
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const commune = document.getElementById("commune").value.trim();
    if(PhoneDZ.on && !PhoneDZ.ok(PhoneDZ.norm(phone))){ toast(PhoneDZ.MSG); document.getElementById("phone").focus(); return }
    if(type==="variable" && !state.variation){ toast("اختر " + (missingAttrs().join(" و ") || "خياراً متوفراً")); const vb = document.getElementById("variants"); if(vb) vb.scrollIntoView({behavior:"smooth", block:"center"}); return }
    if(type==="grouped" && !(state.offer && state.offer.qty>0)){ toast("اختر كمية منتج واحد على الأقل"); const gb = document.getElementById("group-box"); if(gb) gb.scrollIntoView({behavior:"smooth", block:"center"}); return }
    if(!state.wilaya){ toast("يرجى اختيار الولاية"); sel.focus(); return }
    const __sq = shipQuote(state.wilaya, communeSel ? communeSel.value : "", state.dtype, state.offer.price, p.shipCo, prodShipPf(p)); if(__sq.blocked && !offerFreeShip(p, state.offer)){ toast(__sq.msg); return }
    if(state.dtype==="stop" && deskSel && !deskSel.value){ toast("يرجى اختيار المكتب"); deskSel.focus(); return }
    // جمع قيم الحقول الإضافية المخصّصة (لوحة التحكم ⟵ نموذج الطلب) — تُرفق في رسالة واتساب وفي الطلب المُسجَّل
    const extraValues = {};
    for(const f of extraFields){
      const el = document.getElementById("extra-"+f.id);
      const v = el ? el.value.trim() : "";
      if(f.required && !v){ toast(`يرجى ملء حقل «${f.label||f.id}»`); if(el) el.focus(); return }
      if(v) extraValues[f.label||f.id] = v;
    }
    const fee = (offerFreeShip(p, state.offer) || couponFreeShip()) ? 0 : __sq.fee;
    const discount = currentCouponDiscount(state.offer.price, [{slug:p.slug,cat:p.cat,qty:state.offer.qty,free:state.offer.free,amount:state.offer.price}]);
    const total = Math.max(0, state.offer.price - discount) + fee;
    const desk = (state.dtype==="stop" && deskSel) ? deskSel.value : "";
    // Enregistrement dans Google Sheets
    const __pre = Guard.active() ? window.open("", "_blank") : null;      // يُفتح فوراً (ضمن نقرة الزبون) قبل انتظار فحص الخادم
    const __order = {
      name, phone, wilaya: state.wilaya.name, commune,
      dtype: state.dtype, desk,
      items: orderItems(),
      subtotal: state.offer.price, fee, total,
      coupon: AppliedCoupon.record ? AppliedCoupon.code : "", discount, promo: (AppliedCoupon.record && AppliedCoupon.record.__promo) ? AppliedCoupon.code : undefined,
      extra: Object.assign({}, couponGiftTitle() ? { "🎁 هدية": couponGiftTitle() } : {}, extraValues, { "📄 الصفحة": PageSrc || ("p/" + slug) }, Attrib),
    };
    if(Guard.active()){ const gr = await Guard.submit(__order); if(!gr.ok){ if(__pre) __pre.close(); toast(gr.msg); return } } else API.submitOrder(__order);
    Gifts.markUsed(AppliedCoupon.record); markCouponPhoneUsed(AppliedCoupon.record, phone);
    // حدث «شراء» لكل بكسل تتبع مفعّل على هذا المنتج (فيسبوك/تيك توك/جوجل) — لوحة التحكم ⟵ البكسلات
    firePixelPurchase(p, total, state.offer.qty);
    let msg = `السلام عليكم ${SITE_NAME}،\nأريد طلب:\n` + (type==="grouped"
      ? state.group.kids.map((c,i)=> state.group.qty[i] ? `\n• ${c.title}\n  الكمية: ${state.group.qty[i]} × ${fmt(c.price)} = ${fmt(state.group.qty[i]*c.price)}` : "").join("")
      : `\n• ${p.title}${state.variation?" — "+variationLabel(p,state.variation):""}\n  الكمية: ${state.offer.qty} × ${fmt(Math.round(state.offer.price/(state.offer.qty-(state.offer.free||0))))} = ${fmt(state.offer.price)}`);
    if(state.offer.free) msg += `\n  🎁 العرض: اشترِ 2 واحصل على الثالثة مجاناً`;
    if(p.old) msg += `\n  (السعر الأصلي: ${fmt(p.old)} ✂️)`;
    if(discount>0) msg += `\n  🎟️ خصم الكود (${AppliedCoupon.code}): -${fmt(discount)}`;
    else if(couponFreeShip()) msg += `\n  🎟️ كود التوصيل المجاني (${AppliedCoupon.code})`;
    if(couponGiftTitle()) msg += `\n  🎁 هدية الكود (${AppliedCoupon.code}): ${couponGiftTitle()}`;
    msg += `\n\nالتوصيل (${state.dtype==="stop"?"مكتب Stop Desk":"إلى المنزل"} — ${state.wilaya.name}${commune?"، "+commune:""}${desk?" — المكتب: "+desk:""}): ${fmt(fee)}`;
    msg += `\n*الإجمالي: ${fmt(total)}*`;
    msg += `\n\nالاسم: ${name}\nالهاتف: ${phone}`;
    Object.entries(extraValues).forEach(([label,val])=>{ msg += `\n${label}: ${val}`; });
    msg += `\n\n💵 الدفع عند الاستلام`;
    Guard.openWa(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, __pre);
    Thanks.show({ name, total, lines: type==="grouped" ? state.group.kids.filter((c,i)=>state.group.qty[i]).map(c=>c.title) : [p.title + (state.offer.qty>1?" ×"+state.offer.qty:"")], wa: `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}` });
  });

  // أضف إلى السلة
  document.getElementById("add-cart").onclick = ()=>{
    if(outOfStock){ toast("⚠️ نفدت كمية هذا المنتج حالياً"); return }
    if(type==="variable"){
      if(!state.variation){ toast("اختر " + (missingAttrs().join(" و ") || "خياراً متوفراً")); const vb = document.getElementById("variants"); if(vb) vb.scrollIntoView({behavior:"smooth", block:"center"}); return }
      Cart.add(p.slug, state.offer.qty, state.offer.price / state.offer.qty, state.variation.id, variationLabel(p, state.variation)); return;
    }
    if(type==="grouped"){
      if(!(state.offer && state.offer.qty>0)){ toast("اختر كمية منتج واحد على الأقل"); return }
      state.group.kids.forEach((c,i)=>{ if(state.group.qty[i]>0) Cart.add(c.slug, state.group.qty[i], Number(c.price)||0); }); return;
    }
    Cart.add(p.slug, state.offer.qty, state.offer.price / state.offer.qty);
  };

  // عدد الزوار العشوائي (إلحاح خفيف)
  // (عدّاد ترويجي غير حقيقي عمداً في صفحة المنتج — العدّاد الحقيقي يظهر في لوحة الإدارة فقط)
  const vn = document.getElementById("viewers");
  if(vn){ let v = 8 + Math.floor(Math.random()*10); vn.textContent = v;
    const tag = vn.closest(".tag"); if(tag){ tag.classList.add("live-badge"); tag.innerHTML = '<i class="live-dot"></i> <b id="viewers">' + v + '</b> يشاهدون هذا المنتج الآن'; }
    const vn2 = document.getElementById("viewers");
    setInterval(()=>{ v = Math.max(5, v + (Math.random()>.5?1:-1)); if(vn2) vn2.textContent = v; }, 7000); }
}

/* ── بطاقة منتج (مشتركة بين الشبكة الرئيسية والأكثر مبيعاً) ── */
function isOutOfStock(p){
  const t = productType(p);
  if(t==="variable"){ const vs = activeVariations(p); return !vs.length || vs.every(varOut); }
  if(t==="grouped"){ const cs = groupChildren(p); return !cs.length || cs.every(isOutOfStock); }
  return p.stock!==undefined && p.stock!==null && Number(p.stock)<=0;
}
/* مصدر الطلب (أي صفحة جاء منها): من ?src= أو ?utm_content= ويُحفظ للجلسة؛ يُسجَّل في حقل «📄 الصفحة» داخل extra لمقارنة صفحات المنتج في الإحصاءات */
/* مصدر الحملة: utm_source/utm_campaign من رابط الإعلان أو المنشور يُحفظان 14 يوماً ويُسجَّلان في extra الطلب («📣 الحملة») ليحسب تبويب «السوشيال ← الحملات» الطلبات والإيراد لكل حملة */
const Attrib = (function(){ try{ const q = new URLSearchParams(location.search), s = q.get("utm_source"), c = q.get("utm_campaign"); if(s || c){ localStorage.setItem("alyssum_utm", JSON.stringify({ s: s || "", m: q.get("utm_medium") || "", c: c || "", t: Date.now() })); } const o = JSON.parse(localStorage.getItem("alyssum_utm") || "null"); if(o && Date.now() - o.t < 14*864e5 && o.s !== "home" && o.c) return { "📣 الحملة": (o.s ? o.s + "/" : "") + o.c }; }catch(e){} return {}; })();
const PageSrc = (function(){ try{ const q = new URLSearchParams(location.search), s = q.get("src") || q.get("utm_content"); if(s) sessionStorage.setItem("alyssum_src", s); return sessionStorage.getItem("alyssum_src") || ""; }catch(e){ return ""; } })();
/* رابط المنتج في البطاقات: صفحة «المسار» المختارة (صفحة هبوط) إن وُجدت وإلا صفحته الرسمية؛ ومع اختبار A/B (p.ab = {b, pct}) يُوزَّع الزوار على النسختين بنسبة pct% للثانية ويثبت اختيار كل زائر؛ ويُضاف رمز تتبع UTM */
function productHref(p){
  let page = p.route || "", v = "";
  if(p.ab && p.ab.b){
    const k = "alyssum_ab_" + p.slug; let g = "";
    try{ g = localStorage.getItem(k) || ""; }catch(e){}
    if(g !== "A" && g !== "B"){ g = Math.random()*100 < (Number(p.ab.pct)||50) ? "B" : "A"; try{ localStorage.setItem(k, g); }catch(e){} }
    if(g === "B") page = p.ab.b;
    v = g;
  }
  const src = page ? "lp/" + page : "p/" + p.slug;
  return REL + src + "/?utm_source=home&utm_medium=product-card&utm_campaign=" + encodeURIComponent(p.slug) + "&utm_content=" + encodeURIComponent(src) + (v ? "&ab=" + v : "");
}
function productCardHTML(p, opts){
  opts = opts || {};
  const ptype = productType(p), disc = (ptype==="simple" && p.old) ? Math.round((1-p.price/p.old)*100) : 0;
  const oos = isOutOfStock(p);
  return `
    <div class="thumb">${oos?`<div class="ribbon-oos">نفدت الكمية 🚫</div>`:""}${(!oos && opts.ribbon)?`<span class="ribbon-best">${opts.ribbon}</span>`:""}${(!oos && disc)?`<span class="badge-off">-${disc}%</span>`:""}<img loading="lazy" decoding="async" width="500" height="500" src="${REL}${p.cover||p.images[0]}" srcset="${encodeURI(REL+(p.cover||p.images[0]).replace(/\.webp$/,".w480.webp"))} 480w, ${encodeURI(REL+(p.cover||p.images[0]).replace(/\.webp$/,".w720.webp"))} 720w, ${encodeURI(REL+(p.cover||p.images[0]))} 1100w" sizes="(max-width:700px) 92vw, 330px" onerror="if(this.srcset){this.removeAttribute('srcset');this.src=this.src}" alt="${p.title}"></div>
    <div class="body">
      <h3>${p.title}</h3>
      <div class="stars">★★★★★ <small>(${20+Math.floor(Math.random()*60)} تقييم)</small></div>
      <div class="price-row"><span class="price">${ptype!=="simple" && hasPriceRange(p) ? "من " : ""}${fmt(ptype==="simple" ? p.price : minPrice(p))}</span>${(ptype==="simple" && p.old)?`<span class="old">${fmt(p.old)}</span>`:""}</div>
      <div class="cta">${oos?"نفدت الكمية":(document.querySelector(".aly-grid")?"عرض المنتج":"اطلب الآن — الدفع عند الاستلام")}</div>
    </div>`;
}

/* ── الرئيسية ── */
function initHome(){
  const grid = document.getElementById("grid");
  const chips = document.getElementById("chips");
  let filter = "all";
  const chipBtns = {};
  function render(){
    grid.innerHTML = "";
    PRODUCTS.filter(p=>filter==="all"||p.cat===filter).forEach(p=>{
      const a = document.createElement("a");
      a.className = "card" + (isOutOfStock(p)?" oos":""); a.href = productHref(p);
      a.innerHTML = productCardHTML(p);
      grid.appendChild(a);
    });
  }
  const all = document.createElement("button");
  all.className = "chip active"; all.textContent = "الكل";
  all.onclick = ()=>{ filter="all"; setActive(all); render() };
  chips.appendChild(all);
  chipBtns.all = all;
  Object.entries(CATEGORIES).forEach(([k,label])=>{
    if(!PRODUCTS.some(p=>p.cat===k)) return;
    const c = document.createElement("button");
    c.className = "chip"; c.textContent = label;
    c.onclick = ()=>{ filter=k; setActive(c); render() };
    chips.appendChild(c);
    chipBtns[k] = c;
  });
  function setActive(btn){ chips.querySelectorAll(".chip").forEach(x=>x.classList.remove("active")); btn.classList.add("active") }
  render();

  /* تفعيل تصفية فئة معيّنة من خارج initHome (بطاقات «تسوّق حسب الفئة») */
  window.goToCategory = function(key){
    const btn = chipBtns[key] || chipBtns.all;
    if(btn) btn.click();
    const el = document.getElementById("products");
    if(el) el.scrollIntoView({behavior:"smooth", block:"start"});
  };
}

/* ── صفحة المتجر shop.html: كل المنتجات، أو تصنيف ?cat=مفتاح، أو فئة ?c=best|hot|sale|new، أو منتجات مختارة ?p=slug1,slug2 ── */
async function initShop(){
  const grid = document.getElementById("shop-grid"); if(!grid) return;
  const q = new URLSearchParams(location.search), cat = q.get("cat") || "", col = q.get("c") || "", ps = (q.get("p") || "").split(",").map(x=>x.trim()).filter(Boolean);
  const cols = (await loadCollections()).filter(c=>c.enabled!==false);
  const cur = col ? cols.find(c=>c.key===col) : null;
  let list = PRODUCTS.filter(p=>p.active!==false), title = "المتجر", sub = "كل منتجاتنا — والدفع دائماً عند الاستلام";
  if(cat){ list = list.filter(p=>p.cat===cat); title = CATEGORIES[cat] || cat; sub = "كل منتجات هذا التصنيف"; }
  else if(col){ list = list.filter(p=>(p.tags||[]).includes(col)); title = cur ? (cur.title || cur.label) : col; sub = cur ? (cur.sub || "") : ""; }
  else if(ps.length){ list = ps.map(sl=>list.find(p=>p.slug===sl)).filter(Boolean); title = "منتجات مختارة"; sub = ""; }
  const T = document.getElementById("shop-title"), S = document.getElementById("shop-sub"), C = document.getElementById("shop-chips");
  if(T) T.textContent = title; if(S) S.textContent = sub;
  if(cat && document.querySelector(".aly-grid")){      // لافتة الفئة بصورتها (قالب أليسوم)
    const hi = REL + "assets/img/tpl/alyssum-cat-" + cat + ".webp", im = new Image(), box = document.querySelector(".shop-page .sec-title");
    im.onload = ()=>{ if(box) box.style.setProperty("--shop-hero", "url('" + hi + "')"); }; im.src = hi;
  }
  try{ document.title = title + " | " + ((typeof CONFIG!=="undefined" && CONFIG.SITE && CONFIG.SITE.name) || document.title.split("|")[0].trim()); }catch(e){}
  if(C){
    const a = (href, label, on)=>`<a class="chip${on?" active":""}" href="${href}">${label}</a>`;
    C.innerHTML = a("shop.html", "الكل", !cat && !col && !ps.length) + Object.entries(CATEGORIES).filter(([k])=>PRODUCTS.some(p=>p.active!==false && p.cat===k)).map(([k,l])=>a("shop.html?cat="+encodeURIComponent(k), l, k===cat)).join("") +
      cols.filter(c=>collectionProducts(c.key).length).map(c=>a("shop.html?c="+encodeURIComponent(c.key), c.label, c.key===col)).join("");
  }
  grid.innerHTML = "";
  if(!list.length){ grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--muted);padding:2rem 0">لا توجد منتجات هنا حالياً.</p>'; return; }
  list.forEach(p=>{ const a = document.createElement("a"); a.className = "card" + (isOutOfStock(p)?" oos":""); a.href = productHref(p); a.innerHTML = productCardHTML(p, cur && cur.ribbon ? {ribbon:cur.ribbon} : undefined); grid.appendChild(a); });
}
/* ── صفحة حسابي account.html: تفتح نافذة الدخول/التسجيل مباشرة ── */
function initAccountPage(){
  const box = document.getElementById("acct-box"); if(!box) return;
  const draw = ()=>{ const p = Account.profile(); box.innerHTML = p
    ? `<p>أهلاً <b>${Account.esc(p.name || "")}</b> 👋</p><button class="btn btn-gold" type="button" id="acct-open">👤 فتح حسابي وطلباتي</button>`
    : `<p>أنشئ حسابك مرة واحدة لتتبّع طلباتك وإعادة الطلب ببياناتك المحفوظة.</p><div style="display:flex;gap:.7rem;justify-content:center;flex-wrap:wrap"><button class="btn btn-gold" type="button" data-t="reg">✨ حساب جديد</button><button class="btn btn-ghost" type="button" data-t="login" style="color:var(--green);border-color:var(--line)">🔑 تسجيل الدخول</button></div>`;
    box.querySelectorAll("button").forEach(b=>b.onclick = ()=>{ Account.tab = b.dataset.t || Account.tab; Account.open(); if(b.dataset.t && !Account.profile()) Account.guest(b.dataset.t); }); };
  draw(); setTimeout(()=>{ try{ Account.open(); }catch(e){} }, 400);
}

/* ── تبويبات الرئيسية: الأكثر مبيعاً / الأكثر طلباً / التخفيضات / المنتجات الجديدة ──
   عضوية المنتج في تبويب = p.tags (تُعدَّل من لوحة الإدارة ← تعديل المنتج). التبويب الفارغ يُخفى. */
const COLLECTIONS_DEFAULT = [{"key": "best", "label": "🔥 الأكثر مبيعاً", "title": "الأكثر مبيعاً", "sub": "المنتجات المفضّلة لدى عملائنا", "ribbon": "🔥 الأكثر مبيعاً", "bg": "#F4EFE6", "accent": "#8a6a1a", "enabled": true}, {"key": "hot", "label": "⚡ الأكثر طلباً", "title": "الأكثر طلباً", "sub": "الأكثر طلباً هذه الأيام", "ribbon": "⚡ الأكثر طلباً", "bg": "#FBEBDD", "accent": "#b4531a", "enabled": true}, {"key": "sale", "label": "🏷️ التخفيضات", "title": "التخفيضات", "sub": "أسعار مخفّضة لفترة محدودة", "ribbon": "🏷️ تخفيض", "bg": "#FBE4E4", "accent": "#b83232", "enabled": true}, {"key": "new", "label": "✨ المنتجات الجديدة", "title": "المنتجات الجديدة", "sub": "وصل حديثاً إلى المتجر", "ribbon": "✨ جديد", "bg": "#E4F1EA", "accent": "#157a55", "enabled": true}];
let __collCache = null;
async function loadCollections(){      // assets/data/collections.json (تُعدَّل من لوحة الإدارة ← المنتجات ← تبويبات الرئيسية)
  if(__collCache) return __collCache;
  try{
    const r = await fetch((typeof REL!=="undefined"?REL:"") + "assets/data/collections.json", {cache:"no-store"});
    const j = r.ok ? await r.json() : null;
    __collCache = (j && Array.isArray(j.tabs) && j.tabs.length) ? j.tabs : COLLECTIONS_DEFAULT;
  }catch(e){ __collCache = COLLECTIONS_DEFAULT; }
  return __collCache;
}
function inkOn(hex){ const m = /^#?([0-9a-f]{6})$/i.exec(hex||""); if(!m) return "#fff"; const n = parseInt(m[1],16), f = c=>{ c/=255; return c<=.03928 ? c/12.92 : Math.pow((c+.055)/1.055,2.4); }; const L = .2126*f(n>>16&255)+.7152*f(n>>8&255)+.0722*f(n&255); return L > .4 ? "#1C2420" : "#fff"; }
function collectionProducts(key){ return PRODUCTS.filter(p=>p.active!==false && (p.tags||[]).includes(key)); }
async function renderBestsellers(slugs){
  const COLLECTIONS = (await loadCollections()).filter(c=>c.enabled!==false);
  const wrap = document.getElementById("bestsellers-grid");
  if(!wrap) return;
  const sec = document.getElementById("bestsellers");
  const cols = PRODUCTS.some(p=>(p.tags||[]).length) ? COLLECTIONS.filter(c=>collectionProducts(c.key).length) : [];
  const draw = (c, list)=>{
    wrap.innerHTML = "";
    list.forEach(p=>{
      const a = document.createElement("a");
      a.className = "card" + (isOutOfStock(p)?" oos":""); a.href = productHref(p);
      a.innerHTML = productCardHTML(p, {ribbon:c.ribbon});
      wrap.appendChild(a);
    });
  };
  if(!cols.length){   // لا وسوم بعد: السلوك القديم (قائمة ثابتة)
    draw(COLLECTIONS[0] || COLLECTIONS_DEFAULT[0], (slugs||[]).map(s=>PRODUCTS.find(x=>x.slug===s)).filter(Boolean));
    return;
  }
  let bar = document.getElementById("coll-tabs");
  if(!bar){
    bar = document.createElement("div"); bar.id = "coll-tabs"; bar.className = "coll-tabs"; bar.setAttribute("role", "tablist");
    const head = sec && sec.querySelector(".sec-title"); head ? head.insertAdjacentElement("afterend", bar) : wrap.parentNode.insertBefore(bar, wrap);
  }
  const show = key=>{
    const c = cols.find(x=>x.key===key) || cols[0];
    bar.querySelectorAll("button").forEach(b=>{ const on = b.dataset.k === c.key; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); b.style.background = on ? c.accent : ""; b.style.borderColor = on ? c.accent : ""; b.style.color = on ? inkOn(c.accent) : ""; });
    if(sec){ sec.style.background = c.bg; sec.style.setProperty("--coll", c.accent); const h = sec.querySelector(".sec-title h2"), sp = sec.querySelector(".sec-title p"), k = sec.querySelector(".sec-title .kicker"); if(h) h.textContent = c.title; if(sp) sp.textContent = c.sub; if(k) k.style.color = c.accent; }
    draw(c, collectionProducts(c.key));
  };
  bar.innerHTML = cols.map(c=>`<button type="button" role="tab" data-k="${c.key}">${c.label}</button>`).join("");
  bar.onclick = e=>{ const b = e.target.closest("button[data-k]"); if(b){ show(b.dataset.k); b.scrollIntoView({inline:"center", block:"nearest", behavior:"smooth"}); } };
  show(cols[0].key);
}

/* ── حركات الظهور عند التمرير (الصفحة الرئيسية فقط) ── */
function initReveal(){
  const els = document.querySelectorAll(".reveal");
  if(!els.length) return;
  if(!("IntersectionObserver" in window)){ els.forEach(el=>el.classList.add("show")); return; }
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add("show"); io.unobserve(en.target); } });
  }, {threshold:.14, rootMargin:"0px 0px -40px 0px"});
  els.forEach(el=>io.observe(el));
}

/* ── السلة (درج) ── */
function fillCartWilayas(){
  const sel = document.getElementById("cwilaya");
  if(!sel || sel.options.length > 1) return;
  // استبدال حقل البلدية بقائمة منسدلة (متوافقة مع الهاتف)
  let cSel = null;
  const cInp = document.getElementById("ccommune");
  if(cInp){
    cSel = document.createElement("select");
    cSel.id = "ccommune"; cSel.setAttribute("aria-label", "البلدية");
    cSel.innerHTML = '<option value="">— اختر البلدية —</option>';
    cInp.replaceWith(cSel);
    cSel.onchange = ()=>{ updateCartStop(); Cart.render(); };
  }
  // تعطيل خيار Stop Desk إذا لا يوجد مكتب في البلدية المختارة
  function updateCartStop(){
    const w = WILAYAS.find(x=>x.id==sel.value);
    const commune = cSel ? cSel.value : "";
    const allDesks = (w && w.desks) ? w.desks : [];
    const hasDesk = (commune ? allDesks.filter(d=>d.commune===commune) : allDesks).length > 0;
    document.querySelectorAll('input[name="cdtype"]').forEach(r=>{
      if(r.value === "stop"){
        r.disabled = !hasDesk;
        const lbl = r.closest("label");
        if(lbl){
          lbl.style.opacity = hasDesk ? 1 : .45;
          lbl.title = hasDesk ? "" : "لا يوجد مكتب Stop Desk في هذه البلدية";
        }
        if(!hasDesk && r.checked){
          const home = document.querySelector('input[name="cdtype"][value="home"]');
          if(home) home.checked = true;
        }
      } else { r.disabled = false; const l = r.closest("label"); if(l){ l.style.opacity = 1; l.title = ""; } }
    });
    shipRadios("cdtype", w, commune);
  }
  WILAYAS.forEach(w=>{
    const o = document.createElement("option");
    o.value = w.id; o.textContent = `${String(w.id).padStart(2,"0")} - ${w.name}` + (w.xw ? " (غير متاح)" : ""); if(w.xw) o.disabled = true;
    sel.appendChild(o);
  });
  sel.onchange = ()=>{
    if(cSel){
      cSel.innerHTML = '<option value="">— اختر البلدية —</option>';
      const w = WILAYAS.find(x=>x.id==sel.value);
      (w&&w.communes?w.communes:[]).forEach(c=>{ const o=document.createElement("option"); o.value=c; o.textContent=shipOptLabel(w,c); if(w.xc && w.xc[c]==="all") o.disabled = true; cSel.appendChild(o); });
    }
    updateCartStop();
    Cart.render();
  };
  document.querySelectorAll('input[name="cdtype"]').forEach(r=>r.onchange=()=>Cart.render());
}

function initCartDrawer(){
  const bg = document.getElementById("drawer-bg"), dr = document.getElementById("drawer");
  document.querySelectorAll(".cart-btn").forEach(b=>b.onclick=()=>{ dr.classList.add("open"); bg.classList.add("open"); Cart.render() });
  bg.onclick = ()=>{ dr.classList.remove("open"); bg.classList.remove("open") };
  // حقل كود الخصم — يُحقن قبل مربع إجمالي السلة (drawer موجود في كل صفحات الموقع)
  const totBox = document.querySelector("#drawer .tot");
  if(totBox) injectCouponBox("cart", totBox, ()=>Cart.subtotal(), Cart.render, couponCartItems);
}


/* ── تتبّع الزيارات + «يشاهدون الآن» الحقيقي (يُقرأ في لوحة الإدارة) ──
   زيارة واحدة لكل جلسة وصفحة، ونبض كل 45 ثانية فقط والصفحة ظاهرة (وبحد أقصى 20 دقيقة) لتوفير حصة Apps Script.
   لا يعمل داخل معاينة لوحة الإدارة (iframe) ولا بدون API_URL. */
(function(){
  try{
    if(window.parent !== window || typeof CONFIG === "undefined" || typeof API === "undefined" || !API.hit || (!CONFIG.API_URL && !(API.sb && API.sb.enabled()) && !(API.php && API.php.on()))) return;
    const m = location.pathname.match(/\/p\/([a-z0-9-]+)\/?/i);
    const page = m ? m[1] : (/\/(index\.html)?$/.test(location.pathname) ? "home" : "other");
    const k = "alyssum_hit_" + page;
    if(!sessionStorage.getItem(k)){ sessionStorage.setItem(k, "1"); API.hit(page); }
    let beats = 0;
    API.ping(page);
    const iv = setInterval(()=>{ if(document.hidden) return; if(++beats > 26){ clearInterval(iv); return; } API.ping(page); }, 45000);
  }catch(e){ /* التتبّع لا يجب أن يعطّل الموقع أبداً */ }
})();


/* ══════════════════════════════════════════════════════════════════════
   حسابي (تسجيل الزبون) + تثبيت الموقع على الهاتف (PWA)
   الخلفية حسب النسخة: Supabase | PHP | على الجهاز فقط (انظر API.cust في api.js). الطلب يُربط بالحساب تلقائياً عند الإرسال.
   ══════════════════════════════════════════════════════════════════════ */
const PWA = {
  ev: null,
  base(){ return typeof REL !== "undefined" ? REL : ""; },
  standalone(){ try{ return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }catch(e){ return false; } },
  ios(){ return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); },
  inApp(){ return /FBAN|FBAV|Instagram|TikTok|musical_ly|Line\//i.test(navigator.userAgent); },   // متصفحات داخل التطبيقات لا تدعم التثبيت
  init(){
    if(window.parent !== window) return;                                  // ليس داخل معاينة الإدارة
    try{
      const h = document.head, add = (tag, attrs)=>{ const e = document.createElement(tag); Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v)); h.appendChild(e); };
      if(!document.querySelector('link[rel="manifest"]')) add("link", { rel:"manifest", href: this.base() + "manifest.webmanifest" });
      if(!document.querySelector('meta[name="theme-color"]')) add("meta", { name:"theme-color", content:"#173F35" });
      if(!document.querySelector('link[rel="apple-touch-icon"]')) add("link", { rel:"apple-touch-icon", href: this.base() + "assets/img/apple-touch-icon.png" });
      add("meta", { name:"apple-mobile-web-app-capable", content:"yes" });
      add("meta", { name:"apple-mobile-web-app-title", content: SITE_NAME.split(" ")[0] });
      if("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register(this.base() + "sw.js").catch(()=>{});
    }catch(e){}
    addEventListener("beforeinstallprompt", e=>{ e.preventDefault(); PWA.ev = e; });
    addEventListener("appinstalled", ()=>{ PWA.ev = null; try{ toast("✅ تم تثبيت الموقع على هاتفك"); }catch(e){} });
  },
  async install(){
    if(!this.ev) return "manual";
    this.ev.prompt();
    const c = await this.ev.userChoice.catch(()=>({ outcome:"dismissed" }));
    this.ev = null; return c.outcome;
  },
  /* خطوات التثبيت اليدوي بحسب الجهاز */
  steps(){
    if(this.inApp()) return "أنت تتصفّح من داخل تطبيق (فيسبوك/إنستغرام…): اضغط <b>⋮</b> أو <b>…</b> ثم <b>«فتح في المتصفح»</b>، وبعدها ثبّت الموقع.";
    if(this.ios()) return "في آيفون: افتح الموقع في <b>Safari</b>، اضغط زر المشاركة <b>⬆️</b> ثم <b>«إضافة إلى الشاشة الرئيسية»</b>.";
    return "اضغط <b>⋮</b> أعلى المتصفح ثم <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.";
  },
};

const Account = {
  tab: "reg",
  mode(){ return API.cust.mode(); },
  profile(){ return API.cust.profile(); },
  esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, c=>({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); },
  ERR: {
    phone_taken: "هذا الرقم مسجّل من قبل — سجّل الدخول بدلاً من إنشاء حساب جديد.",
    invalid_credentials: "الهاتف أو كلمة السر غير صحيحة.",
    too_many_attempts: "محاولات كثيرة خاطئة — انتظر 10 دقائق ثم أعد المحاولة.",
    invalid_phone: "رقم الهاتف غير صالح (مثال: 0555123456).",
    invalid_name: "الاسم قصير جداً.",
    invalid_password: "كلمة السر يجب ألا تقل عن 6 أحرف.",
    rate_limited: "طلبات كثيرة — حاول لاحقاً.",
    network: "تعذّر الاتصال — تحقق من الإنترنت وأعد المحاولة.",
  },
  err(e){ const m = (e && e.message) || ""; return this.ERR[m] || "حدث خطأ غير متوقع — أعد المحاولة."; },
  STATUS: { nouvelle:["قيد المراجعة","#8a6d1d"], confirmee:["مؤكَّد","#1c6b8f"], expediee:["في الطريق إليك 🚚","#6a3fb0"], livree:["تم التسليم ✅","#157a55"], annulee:["ملغى","#999"], echec:["تعذّر التوصيل","#D64545"] },

  init(){
    if(window.parent !== window) return;
    const hd = document.querySelector("header.site .container"); if(!hd || hd.querySelector(".acc-btn")) return;
    if(!hd.hasAttribute("data-noacc")){      // الهيدر قد يُخفي زر الحساب (إعدادات الهيدر)
      const b = document.createElement("button");
      b.className = "acc-btn"; b.type = "button"; b.setAttribute("aria-label", "حسابي"); b.innerHTML = "👤";
      b.onclick = ()=>this.open();
      const cart = hd.querySelector(".cart-btn"); cart ? hd.insertBefore(b, cart) : hd.appendChild(b);
    }
    this.mark();
    const fl = document.querySelector("footer.site .fgrid > div:nth-child(2) p");      // روابط سريعة في ذيل الصفحة
    if(fl && !fl.querySelector(".ft-trk")) fl.insertAdjacentHTML("beforeend", '<br><a href="#" class="ft-trk">📦 تتبّع طلبك</a><br><a href="#" class="ft-acc">👤 حسابي</a>');
    else if(!fl){ const fc = document.querySelector("footer.site .container"); if(fc && !fc.querySelector(".ft-trk")) fc.insertAdjacentHTML("beforeend", '<div style="margin-top:.5rem;font-size:.85rem"><a href="#" class="ft-trk" style="color:#C7D3CD">📦 تتبّع طلبك</a> · <a href="#" class="ft-acc" style="color:#C7D3CD">👤 حسابي</a></div>'); }
    const ft = document.querySelector(".ft-trk"), fa = document.querySelector(".ft-acc");
    if(ft) ft.onclick = e=>{ e.preventDefault(); Track.open(); };
    if(fa) fa.onclick = e=>{ e.preventDefault(); this.open(); };
    [900, 2600].forEach(t=>setTimeout(()=>this.prefill(), t));
  },
  mark(){ const b = document.querySelector(".acc-btn"); if(b) b.classList.toggle("on", !!this.profile()); },

  /* تعبئة نموذج الطلب ببيانات الحساب (للحقول الفارغة فقط) */
  prefill(){
    const p = this.profile(); if(!p) return;
    const setv = (ids, v)=>{ if(!v) return; for(const id of ids){ const el = document.getElementById(id); if(el && !el.value){ el.value = v; el.dispatchEvent(new Event("input", { bubbles:true })); } } };
    setv(["name","cname"], p.name); setv(["phone","cphone"], p.phone);
    try{
      const w = p.wilaya && WILAYAS.find(x=>x.name === p.wilaya);
      if(w) ["wilaya","cwilaya"].forEach(id=>{ const el = document.getElementById(id); if(el && !el.value && el.options && el.options.length > 1){ el.value = w.id; el.onchange && el.onchange(); el.dispatchEvent(new Event("change", { bubbles:true })); } });
    }catch(e){}
    if(p.commune) ["commune","ccommune"].forEach(id=>{ const el = document.getElementById(id); if(el && !el.value){ if(el.tagName === "SELECT"){ if([...el.options].some(o=>o.value === p.commune)) el.value = p.commune; } else el.value = p.commune; } });
  },

  ensure(){
    let bg = document.getElementById("acc-bg"); if(bg) return bg;
    bg = document.createElement("div"); bg.id = "acc-bg"; bg.className = "acc-bg";
    bg.innerHTML = '<div class="acc-box" role="dialog" aria-modal="true" aria-label="حسابي"><button class="acc-x" type="button" aria-label="إغلاق">✕</button><div id="acc-body"></div></div>';
    document.body.appendChild(bg);
    bg.addEventListener("click", e=>{ if(e.target === bg) this.close(); });
    bg.querySelector(".acc-x").onclick = ()=>this.close();
    addEventListener("keydown", e=>{ if(e.key === "Escape") this.close(); });
    return bg;
  },
  open(){ this.ensure().classList.add("open"); document.documentElement.style.overflow = "hidden"; this.profile() ? this.home() : this.guest(); },
  close(){ const bg = document.getElementById("acc-bg"); if(bg) bg.classList.remove("open"); document.documentElement.style.overflow = ""; },
  body(html){ const b = document.getElementById("acc-body"); b.innerHTML = html; return b; },

  /* ── زائر: تسجيل جديد / دخول ── */
  guest(tab){
    if(tab) this.tab = tab;
    const local = this.mode() === "local", reg = local || this.tab === "reg";
    const wOpts = '<option value="">— الولاية (اختياري) —</option>' + (typeof WILAYAS !== "undefined" ? WILAYAS.map(w=>`<option value="${this.esc(w.name)}">${String(w.id).padStart(2,"0")} - ${this.esc(w.name)}</option>`).join("") : "");
    const b = this.body(`
      <h3>👤 حسابي</h3>
      <p class="acc-sub">${reg ? "أنشئ حسابك مرة واحدة: تتبّع طلباتك وأعد الطلب ببياناتك المحفوظة، وثبّت الموقع على هاتفك." : "سجّل الدخول لمتابعة طلباتك."}</p>
      ${local ? "" : `<div class="acc-tabs"><button type="button" data-t="reg" class="${reg ? "on" : ""}">تسجيل جديد</button><button type="button" data-t="login" class="${reg ? "" : "on"}">لدي حساب</button></div>`}
      <form id="acc-form" novalidate>
        ${reg ? '<label>الاسم الكامل<input name="name" autocomplete="name" required></label>' : ""}
        <label>رقم الهاتف<input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="05XXXXXXXX" required dir="ltr"></label>
        ${local ? "" : `<label>كلمة السر${reg ? " (6 أحرف على الأقل)" : ""}<input name="password" type="password" autocomplete="${reg ? "new-password" : "current-password"}" minlength="6" required dir="ltr"></label>`}
        ${reg ? `<div class="acc-row"><label>الولاية<select name="wilaya">${wOpts}</select></label><label>البلدية<input name="commune" autocomplete="address-level2"></label></div>` : ""}
        <div class="acc-msg" id="acc-msg"></div>
        <button class="btn btn-gold acc-go" type="submit">${reg ? "✨ إنشاء الحساب" : "دخول"}</button>
        <button class="acc-trk-link" type="button" id="acc-trk-link">📦 تتبّع طلب بدون حساب</button>
        ${local ? '<p class="acc-note">🔒 بياناتك محفوظة على هذا الجهاز فقط لتسريع طلباتك القادمة.</p>' : '<p class="acc-note">🔒 كلمة سرك مشفّرة ولا يراها أحد. نستعمل رقمك لتأكيد الطلبات وتتبّعها فقط.</p>'}
      </form>`);
    b.querySelectorAll(".acc-tabs button").forEach(x=>x.onclick = ()=>this.guest(x.dataset.t));
    b.querySelector("#acc-form").onsubmit = ev=>{ ev.preventDefault(); this.submit(reg, ev.target); };
    b.querySelector("#acc-trk-link").onclick = ()=>{ this.close(); Track.open(); };
  },
  async submit(reg, f){
    const v = Object.fromEntries(new FormData(f).entries()), msg = document.getElementById("acc-msg"), btn = f.querySelector(".acc-go");
    const phone = PhoneDZ.on ? PhoneDZ.norm(v.phone) : String(v.phone || "").replace(/[^\d+]/g, "");
    const fail = t=>{ msg.textContent = t; msg.className = "acc-msg bad"; };
    if(reg && String(v.name || "").trim().length < 2) return fail(this.ERR.invalid_name);
    if(phone.replace(/\D/g, "").length < 9) return fail(this.ERR.invalid_phone);
    if(PhoneDZ.on && !PhoneDZ.ok(PhoneDZ.norm(phone))) return fail(PhoneDZ.MSG);
    if(this.mode() !== "local" && String(v.password || "").length < 6) return fail(this.ERR.invalid_password);
    btn.disabled = true; msg.textContent = "⏳ لحظة…"; msg.className = "acc-msg";
    try{
      if(this.mode() === "local"){
        API.cust.save({ profile: { name: v.name.trim(), phone, wilaya: v.wilaya || "", commune: (v.commune || "").trim() } });
      }else{
        const r = await API.cust.call(reg ? "register" : "login", reg ? { name: v.name.trim(), phone, password: v.password, wilaya: v.wilaya || "", commune: (v.commune || "").trim() } : { phone, password: v.password });
        API.cust.save({ token: r.token, profile: r.profile });
      }
      this.mark(); this.prefill(); if(reg) await Gifts.claim("reg"); Track.linkPending(); this.done(reg);
    }catch(e){ fail(this.err(e)); btn.disabled = false; }
  },

  /* ── بعد النجاح: دعوة تثبيت الموقع على الهاتف ── */
  installBox(){
    if(PWA.standalone()) return "";
    return `<div class="acc-install"><div class="ai-t">📲 ثبّت الموقع على هاتفك</div><p>أيقونة على شاشتك الرئيسية: تفتح المتجر مباشرة، وتبقى مرتبطاً بحسابك وطلباتك.</p>
      <button class="btn btn-gold" type="button" id="acc-inst">تثبيت الآن</button><div class="ai-steps" id="acc-steps"></div></div>`;
  },
  bindInstall(root){
    const b = root.querySelector("#acc-inst"); if(!b) return;
    b.onclick = async ()=>{
      const o = await PWA.install();
      if(o === "accepted"){ b.closest(".acc-install").innerHTML = '<div class="ai-t">✅ جارٍ التثبيت…</div>'; }
      else if(o === "manual"){ const s = root.querySelector("#acc-steps"); s.innerHTML = PWA.steps(); s.style.display = "block"; }
    };
  },
  async done(isNew){
    const p = this.profile(), gifts = await Gifts.cardsHtml();
    const b = this.body(`<div class="acc-done"><div class="acc-ok">✅</div><h3>${isNew ? "أهلاً بك" : "مرحباً بعودتك"} ${this.esc((p.name || "").split(" ")[0])}!</h3>
      <p class="acc-sub">${isNew ? "تم إنشاء حسابك، وستُملأ بياناتك تلقائياً في طلباتك القادمة." : "تم تسجيل دخولك."}</p>
      ${gifts}${this.installBox()}<button class="btn btn-ghost acc-cont" type="button">متابعة إلى حسابي ←</button></div>`);
    this.bindInstall(b); Gifts.bind(b); b.querySelector(".acc-cont").onclick = ()=>this.home();
  },

  /* ── حسابي: الطلبات + البيانات ── */
  async home(){
    const p = this.profile(); if(!p) return this.guest();
    const local = this.mode() === "local";
    this.body('<h3>👤 حسابي</h3><p class="acc-sub">⏳ جارِ التحميل…</p>');
    let orders = [], offline = false;
    if(!local && API.cust.token()){
      try{ const r = await API.cust.call("me", { token: API.cust.token() }); orders = r.orders || []; API.cust.save({ token: API.cust.token(), profile: r.profile }); this.mark(); }
      catch(e){
        if(e.message === "unauthorized"){ API.cust.save(null); this.mark(); return this.guest("login"); }
        offline = true;
      }
    }
    const pr = this.profile() || p;
    const rows = orders.map(o=>{ const s = this.STATUS[o.status] || [o.status, "#666"];
      return `<div class="acc-ord"><div class="ao-h"><b dir="ltr">${this.esc(o.id)}</b><span style="color:${s[1]}">${s[0]}</span></div>
        <div class="ao-i">${this.esc(o.items).replace(/\n/g, "<br>")}</div>
        <div class="ao-f"><span>${new Date(o.date).toLocaleDateString("ar-DZ")}</span><b>${fmt(Number(o.total) || 0)}</b></div>
        ${o.tracking ? `<div class="ao-t">رقم التتبع: <b dir="ltr">${this.esc(o.tracking)}</b></div>` : ""}</div>`; }).join("");
    const wOpts = '<option value="">—</option>' + (typeof WILAYAS !== "undefined" ? WILAYAS.map(w=>`<option value="${this.esc(w.name)}"${w.name === pr.wilaya ? " selected" : ""}>${this.esc(w.name)}</option>`).join("") : "");
    const gifts = await Gifts.cardsHtml();
    const b = this.body(`
      <h3>👤 ${this.esc(pr.name)}</h3><p class="acc-sub" dir="ltr" style="text-align:right">${this.esc(pr.phone)}</p>
      ${gifts}${this.installBox()}
      <button class="btn btn-ghost acc-trk" type="button" style="width:100%;margin-bottom:.4rem">📦 تتبّع طلب برقم التتبع</button>
      ${local ? "" : `<h4>🧾 طلباتي</h4>${offline ? '<p class="acc-sub">تعذّر تحميل الطلبات الآن — تحقق من الإنترنت.</p>' : (rows || '<p class="acc-sub">لا توجد طلبات مربوطة بحسابك بعد. كل طلب تُرسله وأنت مسجّل يظهر هنا مع حالته.</p>')}
      <form id="acc-link" class="acc-link"><input name="oid" placeholder="رقم الطلب أو رقم التتبع (من رسالة واتساب)" dir="ltr"><button class="btn btn-ghost" type="submit">ربط</button></form><div class="acc-msg" id="acc-lmsg"></div>`}
      <details class="acc-prof"><summary>⚙️ بياناتي</summary>
        <form id="acc-edit" novalidate>
          <label>الاسم<input name="name" value="${this.esc(pr.name)}"></label>
          <div class="acc-row"><label>الولاية<select name="wilaya">${wOpts}</select></label><label>البلدية<input name="commune" value="${this.esc(pr.commune)}"></label></div>
          ${local ? "" : '<label>كلمة سر جديدة (اختياري)<input name="new_password" type="password" autocomplete="new-password" dir="ltr"></label><label>كلمة السر الحالية (لتغييرها)<input name="old_password" type="password" autocomplete="current-password" dir="ltr"></label>'}
          <div class="acc-msg" id="acc-emsg"></div><button class="btn btn-gold" type="submit">حفظ</button>
        </form></details>
      <button class="acc-out" type="button">تسجيل الخروج</button>`);
    this.bindInstall(b); Gifts.bind(b);
    b.querySelector(".acc-trk").onclick = ()=>{ this.close(); Track.open(); };
    b.querySelector("#acc-edit").onsubmit = async ev=>{
      ev.preventDefault(); const v = Object.fromEntries(new FormData(ev.target).entries()), m = b.querySelector("#acc-emsg");
      try{
        if(local) API.cust.save({ profile: Object.assign({}, pr, { name: v.name.trim(), wilaya: v.wilaya, commune: v.commune.trim() }) });
        else { const r = await API.cust.call("update", { token: API.cust.token(), name: v.name.trim(), wilaya: v.wilaya, commune: v.commune.trim(), new_password: v.new_password || "", old_password: v.old_password || "" }); API.cust.save({ token: API.cust.token(), profile: r.profile || r }); }
        m.textContent = "✅ تم الحفظ"; m.className = "acc-msg ok"; this.mark();
      }catch(e){ m.textContent = this.err(e); m.className = "acc-msg bad"; }
    };
    const lf = b.querySelector("#acc-link");
    if(lf) lf.onsubmit = async ev=>{
      ev.preventDefault(); const oid = lf.oid.value.trim(), m = b.querySelector("#acc-lmsg"); if(!oid) return;
      try{ const r = await API.cust.call("link_order", { token: API.cust.token(), order_id: oid }); const ok = r === true || (r && r.linked);
        if(ok) return this.home(); m.textContent = "لم نجد هذا الطلب برقم هاتف حسابك."; m.className = "acc-msg bad";
      }catch(e){ m.textContent = this.err(e); m.className = "acc-msg bad"; }
    };
    b.querySelector(".acc-out").onclick = async ()=>{
      const t = API.cust.token(); API.cust.save(null); this.mark();
      if(t) { try{ await API.cust.call("logout", { token: t }); }catch(e){} }
      this.guest("login");
    };
  },
};



/* ══════════════ هدايا الزبائن الجدد (ترحيب عند التسجيل + تثبيت التطبيق) ══════════════
   الإعدادات في assets/data/welcome.json (تُعدَّل من لوحة الإدارة ← أكواد الخصم). تعمل كأكواد خصم من نوع:
   percent | fixed | freeship (توصيل مجاني) | gift (منتج هدية). لا تُحتسب إلا لمن يملك حساباً، وتُستعمل مرة واحدة. */
const Gifts = {
  _cfg: null,
  async cfg(){
    if(this._cfg) return this._cfg;
    try{ const r = await fetch(PWA.base() + "assets/data/welcome.json", { cache:"no-store" }); this._cfg = r.ok ? await r.json() : { enabled:false }; }
    catch(e){ this._cfg = { enabled:false }; }
    return this._cfg;
  },
  KINDS: { reg:"register", install:"install" },
  all(){ try{ return JSON.parse(localStorage.getItem("alyssum_gifts") || "{}") || {}; }catch(e){ return {}; } },
  mine(){ const p = API.cust.profile(); return p ? (this.all()[p.phone] || {}) : {}; },
  save(v){ const p = API.cust.profile(); if(!p) return; const a = this.all(); a[p.phone] = v; try{ localStorage.setItem("alyssum_gifts", JSON.stringify(a)); }catch(e){} },
  conf(c, kind){ const g = c && c[this.KINDS[kind]]; return (c && c.enabled !== false && g && g.enabled !== false) ? g : null; },
  record(kind, g, st){
    const exp = new Date(st.ts + (Number(g.days) || 14) * 86400000).toISOString();
    const rec = { code: String(g.code || (kind === "reg" ? "WELCOME" : "APPGIFT")).toUpperCase(), type: g.type || "percent", value: Number(g.value) || 0, minOrder: Number(g.minOrder) || 0, expiresAt: exp, active: true, product: g.product || "", __gift: kind };
    if(rec.type === "gift"){ const pr = (typeof PRODUCTS !== "undefined") ? PRODUCTS.find(x=>x.slug === g.product) : null; rec.giftTitle = pr ? pr.title : (g.product || "هدية"); }
    return rec;
  },
  status(kind, g){
    const st = this.mine()[kind];
    if(!st) return kind === "install" && !PWA.standalone() ? "locked" : "none";
    if(st.used) return "used";
    return Date.now() > st.ts + (Number(g.days) || 14) * 86400000 ? "expired" : "active";
  },
  /* خلفية Supabase/PHP: كل زبون يحصل من الخادم على كود شخصي (لهاتفه فقط، مرة واحدة)؛ وإلا يبقى الكود العام المحلي */
  serverMode(){ return API.cust.mode() !== "local" && !!API.cust.token(); },
  async serverGifts(){ try{ const r = await API.cust.call("my_gifts", { token: API.cust.token() }); return (r && r.gifts) ? r.gifts : (r && !r.ok && typeof r === "object" ? r : {}); }catch(e){ return {}; } },
  async claim(kind){
    if(this.serverMode()){
      try{ const r = await API.cust.call("claim_gift", { token: API.cust.token(), kind }); return !!(r && r.ok && !r.used); }catch(e){ return false; }
    }
    const c = await this.cfg(), g = this.conf(c, kind); if(!g || !API.cust.profile()) return false;
    const m = this.mine(); if(m[kind]) return false;
    m[kind] = { ts: Date.now() }; this.save(m); return true;
  },
  /* تستعملها نافذة الكوبون: هدايا المستخدم الفعّالة فقط كسجلات كوبون */
  async records(){
    const c = await this.cfg(), out = [], m = this.mine();
    for(const k of ["reg", "install"]){ const g = this.conf(c, k); if(g && m[k] && this.status(k, g) === "active") out.push(this.record(k, g, m[k])); }
    return out;
  },
  markUsed(rec){
    if(!rec || !rec.__gift) return;
    const m = this.mine(); if(m[rec.__gift]){ m[rec.__gift].used = Date.now(); this.save(m); }
  },
  text(g){
    const pr = (typeof PRODUCTS !== "undefined") ? PRODUCTS.find(x=>x.slug === g.product) : null;
    const what = g.type === "percent" ? "خصم " + (Number(g.value) || 0) + "% على طلبك" : g.type === "fixed" ? "خصم " + fmt(Number(g.value) || 0) + " على طلبك" : g.type === "freeship" ? "توصيل مجاني 🚚" : "منتج هدية: " + (pr ? pr.title : (g.product || ""));
    return what + (Number(g.minOrder) ? " (لطلبات من " + fmt(Number(g.minOrder)) + ")" : "");
  },
  async cardsHtml(){
    if(!API.cust.profile()) return "";
    if(this.serverMode()){
      const sg = await this.serverGifts(), esc = Account.esc.bind(Account), c = await this.cfg(); let h = "";
      for(const k of ["reg", "install"]){
        const g = sg[k], gc = this.conf(c, k);
        const title = esc((gc && gc.title) || (k === "reg" ? "🎁 هدية التسجيل" : "🎁 هدية تثبيت التطبيق"));
        let st, body;
        if(!g){ if(k === "install" && gc && !PWA.standalone()){ st = "locked"; body = "🔒 تُفعَّل هديتك عندما تفتح الموقع من <b>أيقونة التطبيق</b> على هاتفك بعد التثبيت."; } else continue; }
        else if(g.used){ st = "used"; body = "✔ استعملتَ هذه الهدية. شكراً لك!"; }
        else if(new Date(g.expiresAt) <= new Date()){ st = "expired"; body = "انتهت صلاحية هذه الهدية."; }
        else{ st = "active"; body = esc(this.text(g)) + '<br><span class="g-code">كودك الشخصي: <b dir="ltr">' + esc(g.code) + '</b></span> · صالح حتى ' + new Date(g.expiresAt).toLocaleDateString("ar-DZ") + ' · لك وحدك ويُستعمل مرة واحدة' +
          '<br><button class="btn btn-gold g-apply" type="button" data-code="' + esc(g.code) + '">تطبيق على طلبي</button>'; }
        h += '<div class="acc-gift ' + st + '"><div class="g-t">' + title + '</div><div class="g-b">' + body + '</div></div>';
      }
      return h;
    }
    const c = await this.cfg(), esc = Account.esc.bind(Account); let h = "";
    for(const k of ["reg", "install"]){
      const g = this.conf(c, k); if(!g) continue;
      const st = this.status(k, g); if(st === "none") continue;
      const title = esc(g.title || (k === "reg" ? "🎁 هدية التسجيل" : "🎁 هدية تثبيت التطبيق")), m = this.mine()[k];
      let body;
      if(st === "locked") body = "🔒 تُفعَّل هديتك عندما تفتح الموقع من <b>أيقونة التطبيق</b> على هاتفك بعد التثبيت.";
      else if(st === "used") body = "✔ استعملتَ هذه الهدية. شكراً لك!";
      else if(st === "expired") body = "انتهت صلاحية هذه الهدية.";
      else body = esc(this.text(g)) + '<br><span class="g-code">الكود: <b dir="ltr">' + esc(String(g.code || "").toUpperCase()) + '</b></span> · صالح حتى ' + new Date(m.ts + (Number(g.days) || 14) * 86400000).toLocaleDateString("ar-DZ") +
        '<br><button class="btn btn-gold g-apply" type="button" data-k="' + k + '">تطبيق على طلبي</button>';
      h += '<div class="acc-gift ' + st + '"><div class="g-t">' + title + '</div><div class="g-b">' + body + '</div></div>';
    }
    return h;
  },
  bind(root){
    root.querySelectorAll(".g-apply").forEach(b=>b.onclick = async ()=>{
      let code;
      if(b.dataset.code) code = b.dataset.code;
      else { const c = await this.cfg(), g = this.conf(c, b.dataset.k); if(!g) return; code = String(g.code || "").toUpperCase(); }
      const input = document.getElementById("prod-coupon-input") || document.getElementById("cart-coupon-input");
      if(!input){ toast("🎁 أضف منتجاً إلى السلة ثم أدخل الكود " + code); return; }
      input.value = code; input.closest(".coupon-box").querySelector("button").click();
      Account.close();
      if(input.id === "cart-coupon-input") document.querySelector(".cart-btn")?.click();
    });
  },
  /* أول فتح للتطبيق المثبّت (أو حدث التثبيت) ⟵ تُمنح هدية التثبيت */
  async checkInstall(){
    const go = async ()=>{
      if(!PWA.standalone()) return;
      const p = API.cust.profile(), c = await this.cfg(), g = this.conf(c, "install"); if(!g) return;
      if(!p){ if(!sessionStorage.getItem("alyssum_gift_hint")){ sessionStorage.setItem("alyssum_gift_hint", "1"); setTimeout(()=>toast("🎁 سجّل حسابك لتحصل على هدية تثبيت التطبيق"), 1500); } return; }
      if(await this.claim("install")) setTimeout(()=>toast("🎁 شكراً لتثبيتك التطبيق! هديتك في «حسابي»"), 1200);
    };
    go(); addEventListener("appinstalled", ()=>setTimeout(go, 800));
  },
};

/* ══════════════ تتبّع الطلب برقم التتبع (عام بلا تسجيل) ══════════════
   الرابط ?t=TRACKING يفتح النافذة مباشرة (يرسله لك مركز إشعارات واتساب). يتطلب Supabase أو نسخة PHP. */
const Track = {
  STEPS: [["confirmee", "تم تسجيل الطلب ✅"], ["expediee", "في الطريق إليك 🚚"], ["livree", "تم التسليم 🎉"]],
  cur: "",
  fromUrl(){
    try{ const t = new URLSearchParams(location.search).get("t"); if(t && /^[A-Za-z0-9._-]{4,40}$/.test(t)){ try{ localStorage.setItem("alyssum_pending_track", t); }catch(e){} this.open(t); } }catch(e){}
  },
  ensure(){
    let bg = document.getElementById("trk-bg"); if(bg) return bg;
    bg = document.createElement("div"); bg.id = "trk-bg"; bg.className = "acc-bg";
    bg.innerHTML = '<div class="acc-box" role="dialog" aria-modal="true" aria-label="تتبّع الطلب"><button class="acc-x" type="button" aria-label="إغلاق">✕</button><div id="trk-body"></div></div>';
    document.body.appendChild(bg);
    bg.addEventListener("click", e=>{ if(e.target === bg) bg.classList.remove("open"); });
    bg.querySelector(".acc-x").onclick = ()=>bg.classList.remove("open");
    return bg;
  },
  open(t){
    const bg = this.ensure(); bg.classList.add("open");
    const b = document.getElementById("trk-body");
    b.innerHTML = '<h3>📦 تتبّع طلبك</h3><p class="acc-sub">أدخل رقم التتبع الذي وصلك على واتساب.</p>' +
      '<form id="trk-form" class="acc-link"><input name="t" placeholder="مثال: yal-123456" dir="ltr" value="' + Account.esc(t || "") + '" required><button class="btn btn-gold" type="submit">تتبّع</button></form><div id="trk-res"></div>';
    b.querySelector("#trk-form").onsubmit = ev=>{ ev.preventDefault(); this.lookup(ev.target.t.value.trim()); };
    if(t) this.lookup(t);
  },
  async lookup(t){
    const box = document.getElementById("trk-res"); this.cur = t;
    if(!/^[A-Za-z0-9._-]{4,40}$/.test(t)){ box.innerHTML = '<div class="acc-msg bad">رقم التتبع غير صالح.</div>'; return; }
    box.innerHTML = '<p class="acc-sub">⏳ جارِ البحث…</p>';
    let r = null;
    try{ r = await API.track(t); }catch(e){ box.innerHTML = '<div class="acc-msg bad">' + (e.message === "rate_limited" ? "محاولات كثيرة — انتظر دقيقة." : "تعذّر الاتصال — أعد المحاولة.") + '</div>'; return; }
    if(r === null){ box.innerHTML = '<div class="acc-msg bad">خدمة التتبع غير متاحة في هذا الموقع حالياً.</div>'; return; }
    if(!r.found){ box.innerHTML = '<div class="acc-msg bad">لم نجد طلباً بهذا الرقم. تأكد منه أو تواصل معنا على واتساب.</div>'; return; }
    const idx = this.STEPS.findIndex(x=>x[0] === r.status), bad = r.status === "annulee" || r.status === "echec";
    const steps = bad ? '<div class="trk-bad">' + (r.status === "annulee" ? "تم إلغاء هذا الطلب." : "تعذّر توصيل الطلب — سنتواصل معك.") + '</div>'
      : '<ol class="trk-steps">' + this.STEPS.map((x, i)=>'<li class="' + (i <= idx ? "done" : "") + (i === idx ? " now" : "") + '">' + x[1] + '</li>').join("") + '</ol>';
    box.innerHTML = steps + '<div class="trk-meta">رقم التتبع: <b dir="ltr">' + Account.esc(t) + '</b><br>الوجهة: ' + Account.esc((r.wilaya || "") + (r.commune ? " — " + r.commune : "")) +
      (r.dtype === "stop" ? " (مكتب)" : "") + '<br>التاريخ: ' + new Date(r.date).toLocaleDateString("ar-DZ") + '</div>' +
      (API.cust.profile() && API.cust.mode() !== "local" ? '<button class="btn btn-ghost trk-link" type="button" style="width:100%;margin-top:.6rem">🔗 أضف هذا الطلب إلى حسابي</button>'
        : '<button class="btn btn-gold trk-reg" type="button" style="width:100%;margin-top:.6rem">👤 سجّل حسابك لتتابع كل طلباتك</button>');
    const lk = box.querySelector(".trk-link"); if(lk) lk.onclick = async ()=>{ lk.disabled = true; const ok = await this.link(t); lk.textContent = ok ? "✅ أُضيف إلى حسابي" : "لم نستطع ربطه (يلزم تطابق هاتف الحساب مع هاتف الطلب)"; };
    const rg = box.querySelector(".trk-reg"); if(rg) rg.onclick = ()=>{ document.getElementById("trk-bg").classList.remove("open"); Account.open(); };
  },
  async link(t){
    try{ const r = await API.cust.call("link_order", { token: API.cust.token(), order_id: t }); localStorage.removeItem("alyssum_pending_track"); return r === true || !!(r && r.linked); }catch(e){ return false; }
  },
  /* بعد تسجيل الدخول: ربط رقم التتبع القادم من الرابط تلقائياً */
  async linkPending(){
    let t = ""; try{ t = localStorage.getItem("alyssum_pending_track") || ""; }catch(e){}
    if(t && API.cust.token()) await this.link(t);
  },
};

PWA.init();
(function(){ const go = ()=>{ try{ Account.init(); Gifts.checkInstall(); Track.fromUrl(); }catch(e){} }; document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go(); })();


/* ══════════════ حماية الطلبات (تُفعَّل من لوحة الإدارة ← نموذج الطلب) ══════════════
   antibot: حقل مخفي + رمز نموذج موقَّع من الخادم + تحقق من الهاتف والاسم + حدّ للطلبات من نفس الـ IP.
   dup: منع طلب المنتج نفسه مرتين من نفس الـ IP خلال ساعات محددة. الفحص الحقيقي على الخادم (Supabase/PHP)،
   وبلا خلفية يُكتفى بفحص على هذا الجهاز. لا يُخزَّن عنوان الـ IP نفسه بل بصمة مجزّأة. */

/* ── صفحة الشكر بعد إتمام الطلب: لوحة فوق الصفحة بملخص الطلب وخطوات ما بعده (تُفتح بعد إرسال الطلب وفتح واتساب) ── */
const Thanks = {
  esc: s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  css(){
    if(document.getElementById("thx-css")) return;
    const st = document.createElement("style"); st.id = "thx-css";
    st.textContent = "#thx{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,8,5,.8);backdrop-filter:blur(7px);animation:thxIn .35s ease}@keyframes thxIn{from{opacity:0}to{opacity:1}}#thx .thx-box{width:min(480px,100%);max-height:92vh;overflow:auto;text-align:center;color:#ecfdf5;background:linear-gradient(145deg,rgba(12,54,29,.99),rgba(3,16,9,.99));border:1px solid rgba(134,239,172,.32);border-radius:26px;padding:28px 22px 22px;box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.14);animation:thxUp .45s cubic-bezier(.2,.8,.2,1)}@keyframes thxUp{from{transform:translateY(24px) scale(.97);opacity:0}to{transform:none;opacity:1}}#thx .thx-ic{width:74px;height:74px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;background:rgba(74,222,128,.18);border:1px solid rgba(134,239,172,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}#thx .thx-ic svg{width:38px;height:38px;stroke:#bef264;fill:none;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:40;stroke-dashoffset:40;animation:thxCk .6s .25s ease forwards}@keyframes thxCk{to{stroke-dashoffset:0}}#thx h2{margin:.2rem 0 .3rem;font-size:1.5rem;color:#fff}#thx p{margin:.2rem 0;color:#c5dccd;font-size:.97rem;line-height:1.7}#thx .thx-sum{margin:14px 0;padding:12px 14px;text-align:start;background:rgba(255,255,255,.06);border:1px solid rgba(134,239,172,.22);border-radius:16px}#thx .thx-sum li{list-style:none;padding:3px 0;color:#ecfdf5;font-weight:700}#thx .thx-sum b{color:#bef264}#thx .thx-tot{display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px dashed rgba(134,239,172,.3);font-weight:900}#thx .thx-st{display:grid;gap:6px;margin:10px 0 16px;text-align:start;font-size:.9rem;color:#c5dccd}#thx .thx-st span{display:flex;gap:8px;align-items:flex-start}#thx .thx-st i{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:900;font-size:.8rem;background:rgba(74,222,128,.2);border:1px solid rgba(134,239,172,.4);color:#d9f99d}#thx .thx-act{display:flex;gap:10px;flex-wrap:wrap}#thx .thx-act a,#thx .thx-act button{flex:1 1 140px;display:flex;align-items:center;justify-content:center;text-align:center;padding:13px 14px;border-radius:14px;font:inherit;font-weight:900;text-decoration:none;cursor:pointer;color:#fff;background:rgba(255,255,255,.07);border:1px solid rgba(134,239,172,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -6px 12px rgba(0,0,0,.2),0 6px 16px rgba(0,0,0,.25);backdrop-filter:blur(8px);transition:transform .2s,background .2s}#thx .thx-act a:hover,#thx .thx-act button:hover{transform:translateY(-2px);background:rgba(74,222,128,.22)}#thx .thx-act .pri{background:rgba(74,222,128,.24);border-color:#86efac}";
    document.head.appendChild(st);
  },
  show(o){
    try{
      this.css(); const old = document.getElementById("thx"); if(old) old.remove();
      const e = this.esc, el = document.createElement("div"); el.id = "thx"; el.setAttribute("role","dialog"); el.setAttribute("aria-label","شكراً لطلبك");
      const L = (o.lines || []).slice(0, 6).map(x=>"<li>• " + e(x) + "</li>").join(""), tot = (typeof fmt === "function" && o.total != null) ? fmt(o.total) : "";
      el.innerHTML = '<div class="thx-box"><div class="thx-ic"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h2>شكراً لك' + (o.name ? " " + e(String(o.name).split(" ")[0]) : "") + '، تم استلام طلبك</h2><p>طلبك مسجَّل لدينا، وسنتصل بك لتأكيده خلال ساعات قليلة.</p>' +
        (L ? '<ul class="thx-sum" style="margin-inline:0;padding-inline:14px">' + L + (tot ? '<div class="thx-tot"><span>الإجمالي (الدفع عند الاستلام)</span><b>' + e(tot) + '</b></div>' : "") + "</ul>" : "") +
        '<div class="thx-st"><span><i>1</i>سنؤكّد معك الطلب هاتفياً أو عبر واتساب.</span><span><i>2</i>نجهّز طلبك ونشحنه إلى ولايتك.</span><span><i>3</i>تعاين وتدفع عند الاستلام فقط.</span></div>' +
        '<div class="thx-act"><a class="pri" href="' + (typeof REL !== "undefined" ? REL : "") + 'index.html">متابعة التسوق</a>' + (o.wa ? '<a href="' + e(o.wa) + '" target="_blank" rel="noopener">إرسال الطلب على واتساب</a>' : "") + '<button type="button" id="thx-x">إغلاق</button></div></div>';
      document.body.appendChild(el);
      const close = ()=>{ el.remove(); document.removeEventListener("keydown", kd); }, kd = ev=>{ if(ev.key === "Escape") close(); };
      document.addEventListener("keydown", kd); el.querySelector("#thx-x").onclick = close; el.addEventListener("mousedown", ev=>{ if(ev.target === el) close(); });
      try{ if(navigator.vibrate) navigator.vibrate(30); }catch(_){}
    }catch(err){ console.warn("Thanks", err); }
  }
};
const Guard = {
  cfg: null, tok: "",
  active(){ return !!(this.cfg && (this.cfg.antibot || this.cfg.dup)); },
  MSG: { duplicate_order:"لقد أرسلتَ طلباً لهذا المنتج مؤخراً ✅ سنتواصل معك قريباً. إن أردت تعديله راسلنا على واتساب.", bot:"تعذّر إرسال الطلب. أعد تحميل الصفحة وحاول مرة أخرى.", rate_limited:"طلبات كثيرة من نفس الجهاز — حاول لاحقاً أو راسلنا على واتساب.", invalid_phone:"رقم الهاتف أو الاسم غير صالح — تأكد منهما." },
  async init(g){
    this.cfg = g || null; if(!this.active()) return;
    if(this.cfg.antibot){
      document.querySelectorAll("#order-form, #drawer").forEach(host=>{
        if(host.querySelector(".hp-field")) return;
        const d = document.createElement("div"); d.className = "hp-field"; d.setAttribute("aria-hidden", "true");
        d.style.cssText = "position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden";
        d.innerHTML = '<label>Website<input type="text" name="website_url" tabindex="-1" autocomplete="off"></label>';
        host.appendChild(d);
      });
      this.refreshToken();
    }
  },
  async refreshToken(){ try{ this.tok = (await API.formToken()) || ""; }catch(e){ this.tok = ""; } },
  hp(){ const el = document.querySelector(".hp-field input"); return el ? el.value : ""; },
  recent(){ try{ return JSON.parse(localStorage.getItem("alyssum_recent_orders") || "{}") || {}; }catch(e){ return {}; } },
  async submit(order){
    const slugs = (order.items || []).map(i=>i.slug).filter(Boolean), hrs = Math.max(1, Number(this.cfg.hours) || 24);
    if(this.cfg.dup){                                              // فحص محلي (يغطي من لا خلفية له)
      const r = this.recent(), now = Date.now();
      if(slugs.some(sl=>r[sl] && now - r[sl] < hrs * 3600000)) return { ok:false, msg: this.MSG.duplicate_order };
    }
    if(this.cfg.antibot && !this.tok) await this.refreshToken();
    const res = await API.submitOrderChecked(Object.assign({}, order, this.cfg.antibot ? { hp: this.hp(), ftok: this.tok } : {}));
    if(res && res.error && this.MSG[res.error]) { if(res.error === "bot") this.refreshToken(); return { ok:false, msg: this.MSG[res.error] }; }
    const r = this.recent(), now = Date.now(); slugs.forEach(sl=>{ r[sl] = now; }); try{ localStorage.setItem("alyssum_recent_orders", JSON.stringify(r)); }catch(e){}
    if(this.cfg.antibot) this.refreshToken();
    return { ok:true };
  },
  openWa(url, pre){ if(pre){ try{ pre.location.href = url; return; }catch(e){} } open(url, "_blank"); },
};


/* ══════════════ رقم الهاتف الجزائري: 10 أرقام تبدأ بـ 05 أو 06 أو 07، أرقام فقط ══════════════
   يعمل افتراضياً (CONFIG.SITE.country = "DZ" افتراضياً) ويُعطَّل من لوحة الإدارة ← نموذج الطلب أو لبلد آخر. تُحوَّل +213/00213 تلقائياً إلى 0. */
const PhoneDZ = {
  on: ((typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.country) || "DZ") === "DZ",
  MSG: "رقم الهاتف يجب أن يتكون من 10 أرقام ويبدأ بـ 05 أو 06 أو 07 (أرقام فقط، بلا حروف أو رموز)",
  norm(v){ let d = String(v || "").replace(/\D/g, ""); if(d.startsWith("00213")) d = "0" + d.slice(5); else if(d.startsWith("213") && d.length > 10) d = "0" + d.slice(3); return d.slice(0, 10); },
  ok(v){ return /^0[567]\d{8}$/.test(String(v || "")); },
  hint(el){
    let h = el.parentNode.querySelector(".phone-hint"); if(!h){ h = document.createElement("div"); h.className = "phone-hint"; h.style.cssText = "font-size:.78rem;min-height:1.1em;margin-top:.2rem;font-weight:700"; el.insertAdjacentElement("afterend", h); }
    return h;
  },
  check(el){
    const v = el.value, h = this.hint(el);
    if(!v){ h.textContent = ""; return; }
    if(v.length >= 2 && !/^0[567]/.test(v)){ h.textContent = "⚠️ يجب أن يبدأ الرقم بـ 05 أو 06 أو 07"; h.style.color = "var(--red)"; }
    else if(v.length < 10){ h.textContent = v.length + " / 10 أرقام"; h.style.color = "var(--muted)"; }
    else if(this.ok(v)){ h.textContent = "✓ رقم صالح"; h.style.color = "var(--ok)"; }
  },
  bind(){
    ["phone", "cphone"].forEach(id=>{
      const el = document.getElementById(id); if(!el || el.dataset.dz) return; el.dataset.dz = "1";
      el.setAttribute("inputmode", "numeric"); el.setAttribute("autocomplete", "tel-national"); el.setAttribute("placeholder", el.getAttribute("placeholder") || "05XXXXXXXX");
      el.addEventListener("input", ()=>{ if(!this.on) return; const n = this.norm(el.value); if(el.value !== n) el.value = n; this.check(el); });
      el.addEventListener("blur", ()=>{ if(this.on && el.value && !this.ok(el.value)){ const h = this.hint(el); h.textContent = "⚠️ " + this.MSG; h.style.color = "var(--red)"; } });
    });
  },
  setup(cfg){ this.on = ((typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.country) || "DZ") === "DZ" && !(cfg && cfg.phoneDz === false); this.bind(); },
};
(function(){ const go = ()=>{ try{ PhoneDZ.bind(); }catch(e){} }; document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go(); setTimeout(go, 1500); })();

/* رابط الدعوة ?register=1 (رسائل واتساب): يفتح نافذة إنشاء الحساب تلقائياً لمن لم يسجّل بعد */
(function(){ try{
  if(!/[?&]register=1/.test(location.search)) return;
  const go = ()=>{ try{ if(typeof Account !== "undefined" && !Account.profile()) Account.open(); }catch(e){} };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", ()=>setTimeout(go, 1200)) : setTimeout(go, 1200);
}catch(e){} })();

/* وضع التضمين ?embed=1 (يستعمله منشئ الصفحات): يُظهر عروض المنتج ونموذج الطلب الأصلي فقط، ويبلغ الصفحة الأم بارتفاعه */
(function(){ try{
  if(!/[?&]embed=1/.test(location.search)) return;
  document.documentElement.classList.add("pb-embed");
  const st = document.createElement("style");
  st.textContent = "html.pb-embed body>*:not(#pb-embed-wrap):not(script):not(style){display:none!important}html.pb-embed body{background:transparent!important;padding:0!important;margin:0!important}#pb-embed-wrap{padding:6px}#pb-embed-wrap .order-wide{margin-top:.6rem}#pb-embed-wrap #add-cart,#pb-embed-wrap .cart-btn{display:none!important}";
  document.head.appendChild(st);
  const go = ()=>{
    const form = document.querySelector(".order-wide"); if(!form) return;
    const wrap = document.createElement("div"); wrap.id = "pb-embed-wrap";
    const off = document.getElementById("offers"); if(off) wrap.appendChild(off);
    wrap.appendChild(form); document.body.appendChild(wrap);
    const send = ()=>{ try{ parent.postMessage({ pbEmbedH: Math.ceil(wrap.getBoundingClientRect().height) + 12 }, location.origin); }catch(e){} };
    try{ new ResizeObserver(send).observe(wrap); }catch(e){}
    send(); setTimeout(send, 600); setTimeout(send, 2000);
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go();
}catch(e){} })();

/* زر «تعديل» لصاحب المتجر عند معاينة صفحة منتج (يظهر فقط إن كان مسجّلاً الدخول في هذا المتصفح) */
(function(){ try{
  if(localStorage.getItem("alyssum_admin_on")!=="1" || self!==top || /[?&](preview|embed)=/.test(location.search)) return;
  var m = /^(.*\/)p\/([^\/]+)\/?/.exec(location.pathname); if(!m) return;
  var go=function(){ var a=document.createElement("a"); a.href=m[1]+"admin.html#product="+encodeURIComponent(m[2]); a.textContent="✏️ تعديل المنتج"; a.style.cssText="position:fixed;bottom:16px;left:16px;z-index:99999;background:#173f35;color:#fff;padding:.65rem 1.1rem;border-radius:999px;font:800 14px Cairo,system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.3);text-decoration:none"; document.body.appendChild(a); };
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",go):go();
}catch(e){} })();

/* ════════ الهيدر/الفوتر وزر المشاركة — assets/js/chrome.js (+ social-icons.js)؛ تُدار من لوحة التحكم ← الهيدر / الفوتر ════════ */
(function(){
  if(window.parent !== window) return;       // لا شيء داخل الإطارات (معاينة اللوحة)
  const go = ()=>{
    try{
      const rel = typeof REL!=="undefined" ? REL : "";
      const ld = (f, cb)=>{ const s = document.createElement("script"); s.src = rel + "assets/js/" + f + "?v=9"; s.onload = cb; document.head.appendChild(s); };
      ld("social-icons.js", ()=>ld("chrome.js", ()=>{ try{ Chrome.init(); }catch(e){} }));
    }catch(e){}
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", ()=>setTimeout(go, 50)) : setTimeout(go, 50);
})();

/* ════════ أيقونات عصرية فقط: تُحوَّل الإيموجي والرموز القديمة في واجهة الموقع إلى SVG (assets/js/modern-icons.js)؛ محتوى الزبون (وصف المنتج وأقسام المطوّر) لا يُمسّ ════════ */
(function(){
  try{
    const rel = typeof REL!=="undefined" ? REL : "", s = document.createElement("script");
    s.src = rel + "assets/js/modern-icons.js?v=1"; s.async = true;
    s.onload = ()=>{ try{ ModernIcons.style(); const go = ()=>ModernIcons.watch({ skip: ".lp-desc,.pb-sec,.pb-w,[data-keep-emoji]" }); document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go(); }catch(e){} };
    document.head.appendChild(s);
  }catch(e){}
})();

/* بطاقات المنتجات (قالب أليسوم): الصورة الشفافة (المنتج وحده) تقف على مشهد القالب، أما الصورة المعتمة (منتج بخلفية/مشهد جاهز) فتُعرض كاملة بتكبير عند التمرير — يُوسَم الثاني بـ img-full ويقرأ القالب الصنف */
(function () {
  const seen = new WeakSet();
  function check(img) {
    if (seen.has(img)) return; seen.add(img);
    const run = () => {
      try {
        const N = 32, c = document.createElement("canvas"); c.width = c.height = N; const x = c.getContext("2d"); x.drawImage(img, 0, 0, N, N);
        const d = x.getImageData(0, 0, N, N).data; let op = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) op++;
        if (op / (N * N) > .8) { const h = img.closest(".pb-pci,.thumb"); if (h) h.classList.add("img-full"); }
      } catch (e) { }
    };
    if (img.complete && img.naturalWidth) run(); else img.addEventListener("load", run, { once: true });
  }
  const scan = () => document.querySelectorAll(".pb-pci img,.aly-grid .card .thumb img").forEach(check);
  let t = 0; const later = () => { clearTimeout(t); t = setTimeout(scan, 150); };
  const boot = () => { scan(); try { new MutationObserver(later).observe(document.body, { childList: true, subtree: true }); } catch (e) { } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();