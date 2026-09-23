/* أليسوم — محرك الطلبات والسلة */
const WA_NUMBER = "213559237239";
const SITE_NAME = "أليسوم ALYSSUM";
const fmt = n => n.toLocaleString("fr-DZ") + " دج";

/* ── السلة ── */
const Cart = {
  key: "alyssum_cart_v1",
  all(){ try{ return JSON.parse(localStorage.getItem(this.key))||[] }catch(e){ return [] } },
  save(items){ localStorage.setItem(this.key, JSON.stringify(items)); Cart.render() },
  add(slug, qty, offerPrice){
    const items = Cart.all();
    const ex = items.find(i => i.slug===slug && i.price===offerPrice);
    if(ex) ex.qty += qty; else items.push({slug, qty, price: offerPrice});
    Cart.save(items);
    const p = PRODUCTS.find(p=>p.slug===slug);
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
      const img = (p.images&&p.images[0])||"";
      return `<div class="citem">
        <img src="${REL}${img}" alt="">
        <div class="t">${p.title}<br><small style="color:var(--muted)">${fmt(it.price)} / وحدة</small></div>
        <div class="qty"><button onclick="Cart.setQty(${idx},-1)">−</button><b>${it.qty}</b><button onclick="Cart.setQty(${idx},1)">+</button></div>
      </div>`;
    }).join("") : `<p style="text-align:center;color:var(--muted);padding:2rem 0">السلة فارغة 🛒</p>`;
    const sub = Cart.subtotal();
    const fee = Cart.fee();
    const totEl = document.getElementById("cart-total");
    if(totEl) totEl.textContent = fmt(sub + (items.length?fee:0));
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
    const name = document.getElementById("cname")?.value.trim();
    const phone = document.getElementById("cphone")?.value.trim();
    const wId = document.getElementById("cwilaya")?.value;
    const commune = document.getElementById("ccommune")?.value.trim();
    const dtype = document.querySelector('input[name="cdtype"]:checked')?.value || "home";
    if(!name || !phone || !wId){ toast("يرجى ملء الاسم، الهاتف والولاية"); return }
    const wl = WILAYAS.find(x=>x.id==wId);
    const sub = Cart.subtotal();
    const fee = Cart.fee();
    // Enregistrement dans Google Sheets
    API.submitOrder({
      name, phone, wilaya: wl.name, commune, dtype,
      items: items.map(it => { const p = PRODUCTS.find(p=>p.slug===it.slug)||it;
        return { slug: it.slug, title: p.title, qty: it.qty, price: it.price }; }),
      subtotal: sub, fee, total: sub+fee,
    });
    let msg = `السلام عليكم ${SITE_NAME}، أريد تأكيد طلبي:\n`;
    items.forEach(it=>{
      const p = PRODUCTS.find(p=>p.slug===it.slug)||it;
      msg += `\n• ${p.title} ×${it.qty} = ${fmt(it.price*it.qty)}`;
    });
    msg += `\n\nالمجموع: ${fmt(sub)}`;
    msg += `\nالتوصيل (${dtype==="stop"?"مكتب":"للمنزل"} - ${wl.name}${commune?" / "+commune:""}): ${fmt(fee)}`;
    msg += `\n*الإجمالي: ${fmt(sub+fee)}*`;
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

/* ── صفحة المنتج ── */
function initProduct(slug){
  const p = PRODUCTS.find(p=>p.slug===slug);
  if(!p) return;
  const state = { offer: p.offers[0], wilaya:null, dtype:"home" };

  // معرض الصور
  const main = document.getElementById("gmain");
  p.images.forEach((src,i)=>{
    const th = document.createElement("img");
    th.src = REL+src; th.alt = p.title;
    if(i===0) th.classList.add("on");
    th.onclick = ()=>{ main.src=REL+src; document.querySelectorAll(".gthumbs img").forEach(x=>x.classList.remove("on")); th.classList.add("on"); };
    document.querySelector(".gthumbs").appendChild(th);
  });

  // العروض
  const bestIdx = 2;
  const offersBox = document.getElementById("offers");
  p.offers.forEach((o,i)=>{
    const unit = Math.round(o.price/o.qty);
    const disc = Math.round((1 - o.price/(p.price*o.qty))*100);
    const d = document.createElement("div");
    d.className = "offer"+(i===0?" on":"");
    d.innerHTML = `${i===bestIdx?'<span class="best">الأكثر طلباً 🔥</span>':""}
      <div class="q">${o.qty===1?"قطعة واحدة":o.qty===2?"قطعتان":o.qty+" قطع"}</div>
      <div class="p">${fmt(o.price)}</div>
      <div class="u">${fmt(unit)} للقطعة ${disc>0?`· وفر ${disc}%`:""}</div>`;
    d.onclick = ()=>{
      state.offer = o;
      document.querySelectorAll(".offer").forEach(x=>x.classList.remove("on"));
      d.classList.add("on");
      update();
    };
    offersBox.appendChild(d);
  });

  // الولايات
  const sel = document.getElementById("wilaya");
  const communeInput = document.getElementById("commune");
  let communeDL = null;
  if (communeInput){
    communeDL = document.createElement("datalist");
    communeDL.id = "communes-list";
    document.body.appendChild(communeDL);
    communeInput.setAttribute("list", communeDL.id);
    communeInput.placeholder = "اختر البلدية";
  }
  function setCommunes(w){
    if(!communeDL) return;
    communeDL.innerHTML = "";
    (w && w.communes ? w.communes : []).forEach(c=>{
      const o = document.createElement("option"); o.value = c; communeDL.appendChild(o);
    });
  }
  WILAYAS.forEach(w=>{
    const o = document.createElement("option");
    o.value = w.id; o.textContent = `${String(w.id).padStart(2,"0")} - ${w.name}`;
    sel.appendChild(o);
  });
  sel.onchange = ()=>{ state.wilaya = WILAYAS.find(w=>w.id==sel.value); setCommunes(state.wilaya); if(communeInput) communeInput.value=""; update() };
  document.querySelectorAll('input[name="dtype"]').forEach(r=>r.onchange=()=>{ state.dtype=r.value; update() });

  const feeEl = document.getElementById("fee"), totEl = document.getElementById("grand");
  function update(){
    const fee = state.wilaya ? (state.dtype==="stop"?state.wilaya.stop:state.wilaya.home) : null;
    feeEl.textContent = fee!=null ? fmt(fee) : "اختر الولاية";
    const total = state.offer.price + (fee||0);
    totEl.textContent = fmt(total);
    const st = document.getElementById("sticky-price");
    if(st) st.textContent = fmt(total);
  }
  update();

  // تأكيد الطلب — واتساب
  document.getElementById("order-form").addEventListener("submit", e=>{
    e.preventDefault();
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const commune = document.getElementById("commune").value.trim();
    const addr = document.getElementById("address").value.trim();
    if(!state.wilaya){ toast("يرجى اختيار الولاية"); sel.focus(); return }
    const fee = state.dtype==="stop"?state.wilaya.stop:state.wilaya.home;
    const total = state.offer.price + fee;
    // Enregistrement dans Google Sheets
    API.submitOrder({
      name, phone, wilaya: state.wilaya.name, commune,
      dtype: state.dtype, address: addr,
      items: [{ slug: p.slug, title: p.title, qty: state.offer.qty, price: Math.round(state.offer.price/state.offer.qty) }],
      subtotal: state.offer.price, fee, total,
    });
    let msg = `السلام عليكم ${SITE_NAME}،\nأريد طلب:\n\n• ${p.title}\n  الكمية: ${state.offer.qty} × ${fmt(Math.round(state.offer.price/state.offer.qty))} = ${fmt(state.offer.price)}`;
    if(p.old) msg += `\n  (السعر الأصلي: ${fmt(p.old)} ✂️)`;
    msg += `\n\nالتوصيل (${state.dtype==="stop"?"مكتب Stop Desk":"إلى المنزل"} — ${state.wilaya.name}${commune?"، "+commune:""}): ${fmt(fee)}`;
    msg += `\n*الإجمالي: ${fmt(total)}*`;
    msg += `\n\nالاسم: ${name}\nالهاتف: ${phone}`;
    if(addr) msg += `\nالعنوان: ${addr}`;
    msg += `\n\n💵 الدفع عند الاستلام`;
    open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`,"_blank");
  });

  // أضف إلى السلة
  document.getElementById("add-cart").onclick = ()=>{
    Cart.add(p.slug, state.offer.qty, state.offer.price);
  };

  // عدد الزوار العشوائي (إلحاح خفيف)
  const vn = document.getElementById("viewers");
  if(vn){ let v = 8 + Math.floor(Math.random()*10); vn.textContent = v;
    setInterval(()=>{ v = Math.max(5, v + (Math.random()>.5?1:-1)); vn.textContent = v; }, 7000); }
}

/* ── الرئيسية ── */
function initHome(){
  const grid = document.getElementById("grid");
  const chips = document.getElementById("chips");
  let filter = "all";
  function render(){
    grid.innerHTML = "";
    PRODUCTS.filter(p=>filter==="all"||p.cat===filter).forEach(p=>{
      const disc = p.old ? Math.round((1-p.price/p.old)*100) : 0;
      const a = document.createElement("a");
      a.className = "card"; a.href = REL + "p/" + p.slug + "/";
      a.innerHTML = `
        <div class="thumb">${disc?`<span class="badge-off">-${disc}%</span>`:""}<img loading="lazy" src="${REL}${p.images[0]}" alt="${p.title}"></div>
        <div class="body">
          <h3>${p.title}</h3>
          <div class="stars">★★★★★ <small>(${20+Math.floor(Math.random()*60)} تقييم)</small></div>
          <div class="price-row"><span class="price">${fmt(p.price)}</span>${p.old?`<span class="old">${fmt(p.old)}</span>`:""}</div>
          <div class="cta">اطلب الآن — الدفع عند الاستلام</div>
        </div>`;
      grid.appendChild(a);
    });
  }
  const all = document.createElement("button");
  all.className = "chip active"; all.textContent = "الكل";
  all.onclick = ()=>{ filter="all"; setActive(all); render() };
  chips.appendChild(all);
  Object.entries(CATEGORIES).forEach(([k,label])=>{
    if(!PRODUCTS.some(p=>p.cat===k)) return;
    const c = document.createElement("button");
    c.className = "chip"; c.textContent = label;
    c.onclick = ()=>{ filter=k; setActive(c); render() };
    chips.appendChild(c);
  });
  function setActive(btn){ chips.querySelectorAll(".chip").forEach(x=>x.classList.remove("active")); btn.classList.add("active") }
  render();
}

/* ── السلة (درج) ── */
function fillCartWilayas(){
  const sel = document.getElementById("cwilaya");
  if(!sel || sel.options.length > 1) return;
  const cInp = document.getElementById("ccommune");
  let dl = null;
  if(cInp){
    dl = document.createElement("datalist");
    dl.id = "cart-communes-list";
    document.body.appendChild(dl);
    cInp.setAttribute("list", dl.id);
    cInp.placeholder = "اختر البلدية";
  }
  WILAYAS.forEach(w=>{
    const o = document.createElement("option");
    o.value = w.id; o.textContent = `${String(w.id).padStart(2,"0")} - ${w.name}`;
    sel.appendChild(o);
  });
  sel.onchange = ()=>{
    if(dl){ dl.innerHTML=""; const w=WILAYAS.find(x=>x.id==sel.value);
      (w&&w.communes?w.communes:[]).forEach(c=>{ const o=document.createElement("option"); o.value=c; dl.appendChild(o); });
      if(cInp) cInp.value=""; }
    Cart.render();
  };
  document.querySelectorAll('input[name="cdtype"]').forEach(r=>r.onchange=()=>Cart.render());
}

function initCartDrawer(){
  const bg = document.getElementById("drawer-bg"), dr = document.getElementById("drawer");
  document.querySelectorAll(".cart-btn").forEach(b=>b.onclick=()=>{ dr.classList.add("open"); bg.classList.add("open"); Cart.render() });
  bg.onclick = ()=>{ dr.classList.remove("open"); bg.classList.remove("open") };
}
