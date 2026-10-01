/* أليسوم — محرك الطلبات والسلة */
let WA_NUMBER = "213559237239"; // يمكن استبداله ديناميكياً عبر assets/data/checkout.json (راجع initCheckout أدناه)
const SITE_NAME = "أليسوم ALYSSUM";
const fmt = n => n.toLocaleString("fr-DZ") + " دج";

/* ── السلة ── */
const Cart = {
  key: "alyssum_cart_v1",
  all(){ try{ return JSON.parse(localStorage.getItem(this.key))||[] }catch(e){ return [] } },
  save(items){ localStorage.setItem(this.key, JSON.stringify(items)); Cart.render() },
  add(slug, qty, offerPrice){
    const p = PRODUCTS.find(p=>p.slug===slug);
    if(p && isOutOfStock(p)){ toast("⚠️ نفدت كمية هذا المنتج حالياً"); return }
    const items = Cart.all();
    const ex = items.find(i => i.slug===slug && i.price===offerPrice);
    if(ex) ex.qty += qty; else items.push({slug, qty, price: offerPrice});
    Cart.save(items);
    toast(`تمت إضافة «${p?p.title:slug}» إلى السلة ✓`);
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
  subtotal(){ return Cart.all().reduce((s,i)=>s+i.qty*i.price,0) },
  render(){
    document.querySelectorAll(".cart-count").forEach(el=>el.textContent = Cart.count());
    const box = document.getElementById("cart-items");
    if(!box) return;
    const items = Cart.all();
    box.innerHTML = items.length ? items.map((it,idx)=>{
      const p = PRODUCTS.find(p=>p.slug===it.slug) || it;
      const img = p.cover || (p.images&&p.images[0]) || "";
      const oos = isOutOfStock(p);
      return `<div class="citem">
        <img src="${REL}${img}" alt="">
        <div class="t">${p.title}${oos?' <b style="color:var(--red)">— نفدت الكمية 🚫</b>':""}<br><small style="color:var(--muted)">${fmt(it.price)} / وحدة</small></div>
        <div class="qty"><button onclick="Cart.setQty(${idx},-1)">−</button><b>${it.qty}</b><button onclick="Cart.setQty(${idx},1)" ${oos?"disabled":""}>+</button></div>
      </div>`;
    }).join("") : `<p style="text-align:center;color:var(--muted);padding:2rem 0">السلة فارغة 🛒</p>`;
    const sub = Cart.subtotal();
    const fee = Cart.fee();
    const discount = currentCouponDiscount(sub);
    const totEl = document.getElementById("cart-total");
    if(totEl) totEl.textContent = fmt(Math.max(0, sub - discount) + (items.length?fee:0));
    const feeEl = document.getElementById("cart-fee");
    if(feeEl) feeEl.textContent = items.length ? fmt(fee) : "—";
  },
  fee(){
    const w = document.getElementById("cwilaya");
    const t = document.querySelector('input[name="cdtype"]:checked');
    if(!w || !w.value) return 0;
    const wl = WILAYAS.find(x=>x.id==w.value);
    if(!wl) return 0;
    return t && t.value==="stop" ? wl.stop : wl.home;
  },
  checkout(){
    const items = Cart.all();
    if(!items.length){ toast("السلة فارغة"); return }
    const oosItem = items.map(it=>PRODUCTS.find(p=>p.slug===it.slug)).find(p=>p && isOutOfStock(p));
    if(oosItem){ toast(`⚠️ «${oosItem.title}» نفدت كميته — يرجى إزالته من السلة`); return }
    const name = document.getElementById("cname")?.value.trim();
    const phone = document.getElementById("cphone")?.value.trim();
    const wId = document.getElementById("cwilaya")?.value;
    const commune = document.getElementById("ccommune")?.value.trim();
    const dtype = document.querySelector('input[name="cdtype"]:checked')?.value || "home";
    if(!name || !phone || !wId){ toast("يرجى ملء الاسم، الهاتف والولاية"); return }
    const wl = WILAYAS.find(x=>x.id==wId);
    const sub = Cart.subtotal();
    const fee = Cart.fee();
    const discount = currentCouponDiscount(sub);
    const total = Math.max(0, sub - discount) + fee;
    // Enregistrement dans Google Sheets
    API.submitOrder({
      name, phone, wilaya: wl.name, commune, dtype,
      items: items.map(it => { const p = PRODUCTS.find(p=>p.slug===it.slug)||it;
        return { slug: it.slug, title: p.title, qty: it.qty, price: it.price }; }),
      subtotal: sub, fee, total,
      coupon: discount>0 ? AppliedCoupon.code : "", discount,
    });
    let msg = `السلام عليكم ${SITE_NAME}، أريد تأكيد طلبي:\n`;
    items.forEach(it=>{
      const p = PRODUCTS.find(p=>p.slug===it.slug)||it;
      msg += `\n• ${p.title} ×${it.qty} = ${fmt(it.price*it.qty)}`;
    });
    msg += `\n\nالمجموع: ${fmt(sub)}`;
    if(discount>0) msg += `\n🎟️ خصم الكود (${AppliedCoupon.code}): -${fmt(discount)}`;
    msg += `\nالتوصيل (${dtype==="stop"?"مكتب":"للمنزل"} - ${wl.name}${commune?" / "+commune:""}): ${fmt(fee)}`;
    msg += `\n*الإجمالي: ${fmt(total)}*`;
    msg += `\n\nالاسم: ${name}\nالهاتف: ${phone}`;
    open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`,"_blank");
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
    if(theme.fontUrl){
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
function findValidCoupon(list, code, subtotal){
  const c = (list||[]).find(x=>x.code && x.code.toUpperCase()===String(code||"").trim().toUpperCase());
  if(!c) return { ok:false, msg:"⚠️ الكود غير صحيح" };
  if(c.active===false) return { ok:false, msg:"⚠️ هذا الكود غير مفعّل حالياً" };
  if(c.expiresAt && new Date(c.expiresAt) < new Date()) return { ok:false, msg:"⚠️ انتهت صلاحية هذا الكود" };
  if(c.minOrder && subtotal < Number(c.minOrder)) return { ok:false, msg:"⚠️ الحد الأدنى لهذا الكود: " + fmt(Number(c.minOrder)) };
  const discount = c.type==="percent" ? Math.round(subtotal * Number(c.value)/100) : Math.min(Number(c.value)||0, subtotal);
  if(discount<=0) return { ok:false, msg:"⚠️ الكود غير صالح لهذا الطلب" };
  return { ok:true, coupon:c, discount };
}
/* حالة الكود المُطبَّق — مشتركة بين صفحة المنتج ودرج السلة (سياق واحد نشط في كل مرة عملياً) */
const AppliedCoupon = { code:"", record:null };
function currentCouponDiscount(subtotal){
  if(!AppliedCoupon.record || !subtotal) return 0;
  const res = findValidCoupon([AppliedCoupon.record], AppliedCoupon.code, subtotal);
  return res.ok ? res.discount : 0;
}
function buildCouponBoxHTML(idPrefix){
  return '<div class="coupon-box" style="display:flex;gap:.4rem;margin:.6rem 0;align-items:center;flex-wrap:wrap">' +
    '<input id="' + idPrefix + '-coupon-input" placeholder="🎟️ كود الخصم (إن وُجد)" style="flex:1;min-width:120px;padding:.55rem .7rem;border:1.5px solid var(--line);border-radius:8px;font-family:inherit">' +
    '<button type="button" id="' + idPrefix + '-coupon-btn" class="btn-cart2" style="padding:.5rem .9rem;white-space:nowrap">تطبيق</button>' +
    '</div><div id="' + idPrefix + '-coupon-msg" style="font-size:.82rem;margin:-.3rem 0 .6rem;min-height:1.1em"></div>';
}
/* يُدرج صندوق كود الخصم قبل عنصر مرجعي (مربع الإجمالي)، ويربط منطق التطبيق بدالة إعادة الحساب rerender */
function injectCouponBox(idPrefix, beforeEl, getSubtotal, rerender){
  if(!beforeEl || document.getElementById(idPrefix + "-coupon-input")) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = buildCouponBoxHTML(idPrefix);
  while(wrap.firstChild) beforeEl.parentNode.insertBefore(wrap.firstChild, beforeEl);
  const input = document.getElementById(idPrefix + "-coupon-input");
  const msg = document.getElementById(idPrefix + "-coupon-msg");
  async function apply(){
    const code = (input.value||"").trim();
    if(!code){ AppliedCoupon.code=""; AppliedCoupon.record=null; msg.textContent=""; rerender(); return; }
    const list = await loadCoupons();
    const res = findValidCoupon(list, code, getSubtotal());
    if(!res.ok){
      AppliedCoupon.code=""; AppliedCoupon.record=null;
      msg.textContent = res.msg; msg.style.color = "var(--red)";
    }else{
      AppliedCoupon.code = res.coupon.code; AppliedCoupon.record = res.coupon;
      msg.textContent = "✅ تم تطبيق الكود — خصم " + fmt(res.discount);
      msg.style.color = "var(--ok)";
    }
    rerender();
  }
  input.addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); apply(); } });
  document.getElementById(idPrefix + "-coupon-btn").onclick = apply;
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

  // حقول SEO المخصصة لهذا المنتج (تُضبط من لوحة التحكم ⟵ تعديل منتج ⟵ SEO) — راجع applySeoTags في القسم أعلاه
  applySeoTags({
    title: p.seoTitle || "",
    description: p.seoDesc || "",
    image: p.cover || (p.images && p.images[0]) || "",
    type: "product",
  });

  // معرض الصور — تُقرأ دائماً من data.js (p.images) عند كل تحميل للصفحة، ولا تُترك
  // لتجمّد داخل HTML الثابت للصفحة، حتى تبقى متطابقة مع ما يُعدَّل من لوحة التحكم
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

  // العروض — العرض المُحدَّد بصرياً (on) هو نفسه bestIdx المُفعَّل افتراضياً في state.offer أعلاه
  const offersBox = document.getElementById("offers");
  offersBox.innerHTML = ""; // تفريغ أي بطاقات عروض ثابتة مضمّنة في HTML (تفادي التكرار)
  p.offers.forEach((o,i)=>{
    const paid = o.qty - (o.free||0);
    const unit = Math.round(o.price/paid);
    const disc = Math.round((1 - o.price/(p.price*paid))*100);
    const d = document.createElement("div");
    d.className = "offer"+(i===bestIdx?" on":"");
    const label = o.free ? "قطعتان + الثالثة 🎁" : (o.qty===1?"قطعة واحدة":o.qty===2?"قطعتان":o.qty+" قطع");
    d.innerHTML = `${i===bestIdx?'<span class="best">الأكثر طلباً 🔥</span>':""}
      <div class="q">${label}</div>
      <div class="p">${fmt(o.price)}</div>
      <div class="u">${fmt(unit)} للقطعة ${disc>0?`· وفر ${disc}%`:""}${o.free?'<br><b style="color:var(--ok)">مجاناً داخل العرض</b>':""}</div>`;
    d.onclick = ()=>{
      state.offer = o;
      document.querySelectorAll(".offer").forEach(x=>x.classList.remove("on"));
      d.classList.add("on");
      update();
    };
    offersBox.appendChild(d);
  });
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
    communeSel.id = "commune";
    communeSel.innerHTML = '<option value="">— اختر البلدية —</option>';
    communeInput.replaceWith(communeSel);
  }
  function setCommunes(w){
    if(!communeSel) return;
    communeSel.innerHTML = '<option value="">— اختر البلدية —</option>';
    (w && w.communes ? w.communes : []).forEach(c=>{
      const o = document.createElement("option"); o.value = c; o.textContent = c; communeSel.appendChild(o);
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
      }
    });
  }
  WILAYAS.forEach(w=>{
    const o = document.createElement("option");
    o.value = w.id; o.textContent = `${String(w.id).padStart(2,"0")} - ${w.name}`;
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
    const fee = state.wilaya ? (state.dtype==="stop"?state.wilaya.stop:state.wilaya.home) : null;
    feeEl.textContent = fee!=null ? fmt(fee) : "اختر الولاية";
    const discount = currentCouponDiscount(state.offer.price);
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
  // حقل كود الخصم — يُحقن ديناميكياً قبل مربع الإجمالي (لا حاجة لتعديل كل صفحة منتج يدوياً)
  const totalBoxEl = feeEl.closest(".total-box");
  if(totalBoxEl) injectCouponBox("prod", totalBoxEl, ()=>state.offer.price, update);

  // تأكيد الطلب — واتساب
  document.getElementById("order-form").addEventListener("submit", e=>{
    e.preventDefault();
    if(outOfStock){ toast("⚠️ نفدت كمية هذا المنتج حالياً"); return }
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const commune = document.getElementById("commune").value.trim();
    if(!state.wilaya){ toast("يرجى اختيار الولاية"); sel.focus(); return }
    if(state.dtype==="stop" && deskSel && !deskSel.value){ toast("يرجى اختيار المكتب"); deskSel.focus(); return }
    // جمع قيم الحقول الإضافية المخصّصة (لوحة التحكم ⟵ نموذج الطلب) — تُرفق في رسالة واتساب وفي الطلب المُسجَّل
    const extraValues = {};
    for(const f of extraFields){
      const el = document.getElementById("extra-"+f.id);
      const v = el ? el.value.trim() : "";
      if(f.required && !v){ toast(`يرجى ملء حقل «${f.label||f.id}»`); if(el) el.focus(); return }
      if(v) extraValues[f.label||f.id] = v;
    }
    const fee = state.dtype==="stop"?state.wilaya.stop:state.wilaya.home;
    const discount = currentCouponDiscount(state.offer.price);
    const total = Math.max(0, state.offer.price - discount) + fee;
    const desk = (state.dtype==="stop" && deskSel) ? deskSel.value : "";
    // Enregistrement dans Google Sheets
    API.submitOrder({
      name, phone, wilaya: state.wilaya.name, commune,
      dtype: state.dtype, desk,
      items: [{ slug: p.slug, title: p.title, qty: state.offer.qty, price: Math.round(state.offer.price/(state.offer.qty-(state.offer.free||0))) }],
      subtotal: state.offer.price, fee, total,
      coupon: discount>0 ? AppliedCoupon.code : "", discount,
      extra: extraValues,
    });
    // حدث «شراء» لكل بكسل تتبع مفعّل على هذا المنتج (فيسبوك/تيك توك/جوجل) — لوحة التحكم ⟵ البكسلات
    firePixelPurchase(p, total, state.offer.qty);
    let msg = `السلام عليكم ${SITE_NAME}،\nأريد طلب:\n\n• ${p.title}\n  الكمية: ${state.offer.qty} × ${fmt(Math.round(state.offer.price/(state.offer.qty-(state.offer.free||0))))} = ${fmt(state.offer.price)}`;
    if(state.offer.free) msg += `\n  🎁 العرض: اشترِ 2 واحصل على الثالثة مجاناً`;
    if(p.old) msg += `\n  (السعر الأصلي: ${fmt(p.old)} ✂️)`;
    if(discount>0) msg += `\n  🎟️ خصم الكود (${AppliedCoupon.code}): -${fmt(discount)}`;
    msg += `\n\nالتوصيل (${state.dtype==="stop"?"مكتب Stop Desk":"إلى المنزل"} — ${state.wilaya.name}${commune?"، "+commune:""}${desk?" — المكتب: "+desk:""}): ${fmt(fee)}`;
    msg += `\n*الإجمالي: ${fmt(total)}*`;
    msg += `\n\nالاسم: ${name}\nالهاتف: ${phone}`;
    Object.entries(extraValues).forEach(([label,val])=>{ msg += `\n${label}: ${val}`; });
    msg += `\n\n💵 الدفع عند الاستلام`;
    open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`,"_blank");
  });

  // أضف إلى السلة
  document.getElementById("add-cart").onclick = ()=>{
    if(outOfStock){ toast("⚠️ نفدت كمية هذا المنتج حالياً"); return }
    Cart.add(p.slug, state.offer.qty, state.offer.price);
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
  return p.stock!==undefined && p.stock!==null && Number(p.stock)<=0;
}
function productCardHTML(p, opts){
  opts = opts || {};
  const disc = p.old ? Math.round((1-p.price/p.old)*100) : 0;
  const oos = isOutOfStock(p);
  return `
    <div class="thumb">${oos?`<div class="ribbon-oos">نفدت الكمية 🚫</div>`:""}${(!oos && opts.ribbon)?`<span class="ribbon-best">${opts.ribbon}</span>`:""}${(!oos && disc)?`<span class="badge-off">-${disc}%</span>`:""}<img loading="lazy" src="${REL}${p.cover||p.images[0]}" alt="${p.title}"></div>
    <div class="body">
      <h3>${p.title}</h3>
      <div class="stars">★★★★★ <small>(${20+Math.floor(Math.random()*60)} تقييم)</small></div>
      <div class="price-row"><span class="price">${fmt(p.price)}</span>${p.old?`<span class="old">${fmt(p.old)}</span>`:""}</div>
      <div class="cta">${oos?"نفدت الكمية":"اطلب الآن — الدفع عند الاستلام"}</div>
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
      a.className = "card" + (isOutOfStock(p)?" oos":""); a.href = REL + "p/" + p.slug + "/";
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

/* ── الأكثر مبيعاً (شريط مختار من المنتجات فوق الشبكة الكاملة) ── */
function renderBestsellers(slugs){
  const wrap = document.getElementById("bestsellers-grid");
  if(!wrap) return;
  wrap.innerHTML = "";
  slugs.forEach(slug=>{
    const p = PRODUCTS.find(x=>x.slug===slug);
    if(!p) return;
    const a = document.createElement("a");
    a.className = "card" + (isOutOfStock(p)?" oos":""); a.href = REL + "p/" + p.slug + "/";
    a.innerHTML = productCardHTML(p, {ribbon:"🔥 الأكثر مبيعاً"});
    wrap.appendChild(a);
  });
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
    cSel.id = "ccommune";
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
      }
    });
  }
  WILAYAS.forEach(w=>{
    const o = document.createElement("option");
    o.value = w.id; o.textContent = `${String(w.id).padStart(2,"0")} - ${w.name}`;
    sel.appendChild(o);
  });
  sel.onchange = ()=>{
    if(cSel){
      cSel.innerHTML = '<option value="">— اختر البلدية —</option>';
      const w = WILAYAS.find(x=>x.id==sel.value);
      (w&&w.communes?w.communes:[]).forEach(c=>{ const o=document.createElement("option"); o.value=c; o.textContent=c; cSel.appendChild(o); });
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
  if(totBox) injectCouponBox("cart", totBox, ()=>Cart.subtotal(), Cart.render);
}


/* ── تتبّع الزيارات + «يشاهدون الآن» الحقيقي (يُقرأ في لوحة الإدارة) ──
   زيارة واحدة لكل جلسة وصفحة، ونبض كل 45 ثانية فقط والصفحة ظاهرة (وبحد أقصى 20 دقيقة) لتوفير حصة Apps Script.
   لا يعمل داخل معاينة لوحة الإدارة (iframe) ولا بدون API_URL. */
(function(){
  try{
    if(window.parent !== window || typeof CONFIG === "undefined" || typeof API === "undefined" || !API.hit || (!CONFIG.API_URL && !(API.sb && API.sb.enabled()))) return;
    const m = location.pathname.match(/\/p\/([a-z0-9-]+)\/?/i);
    const page = m ? m[1] : (/\/(index\.html)?$/.test(location.pathname) ? "home" : "other");
    const k = "alyssum_hit_" + page;
    if(!sessionStorage.getItem(k)){ sessionStorage.setItem(k, "1"); API.hit(page); }
    let beats = 0;
    API.ping(page);
    const iv = setInterval(()=>{ if(document.hidden) return; if(++beats > 26){ clearInterval(iv); return; } API.ping(page); }, 45000);
  }catch(e){ /* التتبّع لا يجب أن يعطّل الموقع أبداً */ }
})();
