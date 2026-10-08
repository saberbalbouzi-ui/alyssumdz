/* Customers tab: derived from existing orders; only notes/tags are persisted. */
const AdminCustomers = (() => {
  const FILE = "assets/data/customers.json", LS = "alyssum_customers_notes", THRESHOLD = "alyssum_customers_vip_threshold";
  const $ = id => document.getElementById(id), esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const clone = x => JSON.parse(JSON.stringify(x));
  let notes = { notes:{} }, sha, segment = "all", query = "", sort = "spend", selected = null, threshold = 20000, initialized = false;
  const A = () => typeof Admin === "undefined" ? null : Admin;
  function phone(value) { const a = A(); return a && a.normalizePhone ? a.normalizePhone(value) : String(value || "").replace(/\D/g, "").replace(/^213/, "0").replace(/^(?!0)/, "0"); }
  function parseItems(order) { const a = A(); try { return a && a.parseOrderItems ? a.parseOrderItems(order.items) : []; } catch (_) { return []; } }
  function aggregate(orders, products, blacklist, vipLimit, now) {
    const groups = new Map(), current = now == null ? Date.now() : now;
    (orders || []).forEach(o => {
      const key = phone(o.phone); if (!key) return;
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(o);
    });
    return [...groups.entries()].map(([key, list]) => {
      list.sort((x,y) => (new Date(y.date).getTime() || 0) - (new Date(x.date).getTime() || 0));
      const latest = list.find(o => o.name) || list[0], delivered = list.filter(o => o.status === "livree"), failed = list.filter(o => ["annulee","echec"].includes(o.status));
      const spends = delivered.reduce((n,o) => n + (Number(o.total) || 0), 0), wilayas = new Map(), fav = new Map();
      list.forEach(o => {
        const w = String(o.wilaya || "").trim(); if (w) wilayas.set(w, (wilayas.get(w) || 0) + 1);
        parseItems(o).forEach(it => {
          const p = (products || []).find(x => x.title === it.title || String(it.title || "").startsWith(String(x.title || "") + " "));
          const title = p ? p.title : it.title; if (title) fav.set(title, (fav.get(title) || 0) + (Number(it.qty) || 0));
        });
      });
      const wilaya = [...wilayas].sort((x,y) => y[1]-x[1] || x[0].localeCompare(y[0]))[0]?.[0] || "";
      const last = new Date(latest.date).getTime(), days = Number.isFinite(last) ? Math.max(0, (current-last)/86400000) : Infinity;
      const blocked = (blacklist || []).some(x => phone(x.phone) === key), segments = [];
      if (list.length === 1 && days <= 30) segments.push("new");
      if (delivered.length >= 2) segments.push("repeat");
      if (spends >= vipLimit || delivered.length >= 4) segments.push("vip");
      if (days > 60) segments.push("inactive");
      if (failed.length >= 2 || blocked) segments.push("risk");
      return { key, name:latest.name || "—", phone:latest.phone || key, wilaya, orders:list.length, delivered:delivered.length, failed:failed.length, spend:spends, average:delivered.length ? spends/delivered.length : 0, first:list[list.length-1].date, last:latest.date, days, segments, blocked, favorites:[...fav].sort((x,y)=>y[1]-x[1]).slice(0,5), history:list };
    });
  }
  function currentRows() {
    const a = A(); if (!a) return [];
    const all = aggregate(a.orders || [], a.products || [], a.blacklist || [], threshold);
    const q = query.toLowerCase().trim();
    return all.filter(c => (segment === "all" || c.segments.includes(segment)) && (!q || (c.name + " " + c.phone + " " + c.wilaya + " " + c.favorites.map(x=>x[0]).join(" ")).toLowerCase().includes(q)))
      .sort((x,y) => sort === "orders" ? y.orders-x.orders || y.spend-x.spend : sort === "last" ? (new Date(y.last)-new Date(x.last)) : y.spend-x.spend);
  }
  function segmentName(s) { return ({new:"جديد",repeat:"متكرر",vip:"VIP",inactive:"خامل",risk:"مخاطرة"})[s] || "الكل"; }
  function counts() { const a=A(); return aggregate(a?.orders || [], a?.products || [], a?.blacklist || [], threshold); }
  function render() {
    const host = $("customers-app"); if (!host) return;
    const all = counts(), rows = currentRows(), names = [["all","الكل"],["new","جديد"],["repeat","متكرر"],["vip","VIP"],["inactive","خامل"],["risk","مخاطرة"]];
    host.innerHTML = `<style>
      #customers-app{color:var(--text,#f5f7f4)}#customers-app .cc-toolbar,#customers-app .cc-filters{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin:.7rem 0}
      #customers-app .cc-toolbar input,#customers-app .cc-toolbar select,#customers-app .cc-detail input,#customers-app .cc-detail textarea{min-height:40px;padding:.55rem .7rem;border:1px solid rgba(255,255,255,.17);border-radius:11px;background:rgba(255,255,255,.07);color:inherit}
      #customers-app .cc-toolbar input[type=number]{width:130px}#customers-app .cc-btn{cursor:pointer;padding:.55rem .85rem;border-radius:12px;color:#fff;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.17);box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 5px 14px rgba(0,0,0,.14);transition:.16s}
      #customers-app .cc-btn:hover{transform:translateY(-2px);background:rgba(93,180,114,.25)}#customers-app .cc-btn.on{background:rgba(99,190,118,.29);border-color:rgba(117,218,142,.55)}#customers-app .cc-wrap{overflow:auto}
      #customers-app table{width:100%;min-width:760px;border-collapse:collapse}#customers-app th,#customers-app td{padding:.65rem .5rem;text-align:right;border-bottom:1px solid rgba(255,255,255,.1);white-space:nowrap}#customers-app th{color:#cce8ce;font-size:.86rem}
      #customers-app tr[data-customer]{cursor:pointer}#customers-app tr[data-customer]:hover{background:rgba(255,255,255,.06)}#customers-app .cc-tag{display:inline-block;padding:.15rem .45rem;margin:.1rem;border-radius:999px;background:rgba(117,218,142,.16);font-size:.78rem}
      #customers-app .cc-overlay{position:fixed;inset:0;z-index:100020;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(2,8,5,.78);backdrop-filter:blur(7px)}#customers-app .cc-detail{width:min(760px,100%);max-height:88vh;overflow:auto;background:rgba(9,24,18,.985);border:1px solid rgba(255,255,255,.18);border-radius:20px;padding:1rem;box-shadow:0 30px 80px #0009}
      #customers-app .cc-detail textarea{width:100%;min-height:90px;box-sizing:border-box}#customers-app .cc-detail input{box-sizing:border-box}#customers-app .cc-detail table{min-width:0}#customers-app .cc-muted{color:rgba(255,255,255,.64)}@media(max-width:640px){#customers-app th,#customers-app td{padding:.5rem .35rem}}
    </style>
    <div class="card"><div style="display:flex;align-items:center;gap:.7rem;flex-wrap:wrap"><b style="color:var(--green)">العملاء</b><span class="cc-muted">${all.length} عميل حسب رقم الهاتف</span><span style="margin-inline-start:auto" class="cc-muted">حد VIP: ${threshold.toLocaleString("fr-DZ")} دج أو 4 طلبات مسلّمة</span></div>
      <div class="cc-toolbar"><input id="cc-search" type="search" value="${esc(query)}" placeholder="بحث بالاسم أو الهاتف أو المنتج"><label class="cc-muted">حد VIP <input id="cc-threshold" type="number" min="0" step="1000" value="${threshold}" aria-label="حد الإنفاق لشريحة VIP"></label>
      <select id="cc-sort" aria-label="ترتيب العملاء"><option value="spend" ${sort==="spend"?"selected":""}>الأعلى إنفاقاً</option><option value="orders" ${sort==="orders"?"selected":""}>الأكثر طلباً</option><option value="last" ${sort==="last"?"selected":""}>الأحدث طلباً</option></select>
      <button type="button" class="cc-btn" data-act="csv">تصدير CSV</button><button type="button" class="cc-btn" data-act="copy">نسخ أرقام الشريحة</button></div>
      <div class="cc-filters">${names.map(([id,label])=>`<button type="button" class="cc-btn ${segment===id?"on":""}" data-seg="${id}">${label} <b>${id==="all"?all.length:all.filter(c=>c.segments.includes(id)).length}</b></button>`).join("")}</div>
      <div class="cc-wrap"><table><thead><tr><th>العميل</th><th>الهاتف</th><th>الولاية</th><th>الطلبات</th><th>مسلّمة</th><th>الإنفاق</th><th>آخر طلب</th><th>الشريحة</th></tr></thead><tbody>${rows.length?rows.map(c=>`<tr data-customer="${esc(c.key)}"><td><b>${esc(c.name)}</b></td><td dir="ltr">${esc(c.phone)}</td><td>${esc(c.wilaya||"—")}</td><td>${c.orders}</td><td>${c.delivered}</td><td>${c.spend.toLocaleString("fr-DZ")} دج</td><td>${esc(c.last?new Date(c.last).toLocaleDateString("fr-DZ"):"—")}</td><td>${c.segments.length?c.segments.map(s=>`<span class="cc-tag">${segmentName(s)}</span>`).join(""):"—"}</td></tr>`).join(""):`<tr><td colspan="8" class="cc-muted" style="text-align:center;padding:1.5rem">لا توجد نتائج</td></tr>`}</tbody></table></div>
    </div>`;
    host.oninput = e => { if(e.target.id==="cc-search"){query=e.target.value;const p=e.target.selectionStart;render();const x=$("cc-search");x.focus();x.setSelectionRange(p,p);} };
    host.onchange = e => { if(e.target.id==="cc-sort"){sort=e.target.value;render();} if(e.target.id==="cc-threshold"){threshold=Math.max(0,Number(e.target.value)||0);try{localStorage.setItem(THRESHOLD,String(threshold));}catch(_){}render();} };
    host.onclick = e => { const b=e.target.closest("[data-act],[data-seg],[data-customer]"); if(!b)return;
      if(b.dataset.seg){segment=b.dataset.seg;render();} else if(b.dataset.act==="csv") exportCsv(rows); else if(b.dataset.act==="copy") copyPhones(rows); else if(b.dataset.customer) detail(b.dataset.customer);
    };
  }
  function csvCell(v) { return '"' + String(v == null ? "" : v).replace(/"/g,'""') + '"'; }
  function exportCsv(rows) {
    const data=[["phone","name","wilaya","orders","delivered","failed","spend","average","first_order","last_order","segments","favorite_products"],...rows.map(c=>[c.phone,c.name,c.wilaya,c.orders,c.delivered,c.failed,c.spend,Math.round(c.average),c.first,c.last,c.segments.join("|"),c.favorites.map(x=>x[0]+" x"+x[1]).join("; ")])];
    const blob=new Blob(["\uFEFF"+data.map(r=>r.map(csvCell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="customers-"+new Date().toISOString().slice(0,10)+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  }
  async function copyPhones(rows) { const text=[...new Set(rows.map(c=>c.phone))].join("\n"); try{await navigator.clipboard.writeText(text);toast("✅ نُسخت "+rows.length+" أرقام");}catch(_){prompt("انسخ الأرقام:",text);} }
  function detail(key) {
    const c=aggregate(A().orders||[],A().products||[],A().blacklist||[],threshold).find(x=>x.key===key); if(!c)return;
    selected=key; const saved=notes.notes[key]||{tags:[],note:""}, tags=Array.isArray(saved.tags)?saved.tags:[];
    const modal=document.createElement("div");modal.className="cc-overlay";modal.innerHTML=`<section class="cc-detail" role="dialog" aria-modal="true" aria-label="تفاصيل العميل"><div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap"><h3 style="margin:.2rem 0;color:#cce8ce">${esc(c.name)}</h3><span dir="ltr">${esc(c.phone)}</span><span style="margin-inline-start:auto"><button class="cc-btn" data-modal="wa">واتساب</button> <button class="cc-btn" data-modal="orders">فتح الطلبات</button> <button class="cc-btn" data-modal="close" aria-label="إغلاق">إغلاق</button></span></div>
      <p class="cc-muted">${esc(c.wilaya||"—")} · ${c.orders} طلب · ${c.delivered} مسلّمة · إنفاق ${c.spend.toLocaleString("fr-DZ")} دج · متوسط ${Math.round(c.average).toLocaleString("fr-DZ")} دج</p>
      <div class="grid2"><label>الوسوم (مفصولة بفاصلة)<input id="cc-tags" style="display:block;width:100%;margin-top:.35rem" value="${esc(tags.join(", "))}"></label><label>ملاحظة<textarea id="cc-note">${esc(saved.note||"")}</textarea></label></div>
      <div style="margin:.7rem 0"><button class="cc-btn" data-modal="save">حفظ الوسوم والملاحظة</button> <span id="cc-save-msg" class="cc-muted"></span></div>
      <h4>المنتجات المفضلة</h4><p>${c.favorites.length?c.favorites.map(([n,q])=>`${esc(n)} × ${q}`).join(" · "):"—"}</p><h4>سجل الطلبات</h4><div class="cc-wrap"><table><thead><tr><th>رقم</th><th>التاريخ</th><th>الحالة</th><th>المبلغ</th><th>المنتجات</th></tr></thead><tbody>${c.history.map(o=>`<tr><td>${esc(o.id||"—")}</td><td>${esc(o.date?new Date(o.date).toLocaleDateString("fr-DZ"):"—")}</td><td>${esc(o.status||"—")}</td><td>${(Number(o.total)||0).toLocaleString("fr-DZ")} دج</td><td>${parseItems(o).map(i=>`${esc(i.title)} × ${i.qty}`).join("، ")}</td></tr>`).join("")}</tbody></table></div></section>`;
    $("customers-app").appendChild(modal); modal.onclick=async e=>{if(e.target===modal||e.target.closest('[data-modal="close"]')){modal.remove();return;}const b=e.target.closest("[data-modal]");if(!b)return;
      if(b.dataset.modal==="wa"){const d=c.phone.replace(/\D/g,"");window.open("https://wa.me/"+(d.startsWith("0")?"213"+d.slice(1):d.startsWith("213")?d:"213"+d),"_blank","noopener");}
      if(b.dataset.modal==="orders"){const nav=[...document.querySelectorAll(".nav-btn")].find(x=>(x.getAttribute("onclick")||"").includes("'orders'"));if(nav)nav.click();const q=$("order-filter-q");if(q){q.value=c.phone;try{A().applyOrderFilters();}catch(_){}}modal.remove();}
      if(b.dataset.modal==="save"){
        try{await saveNote(key,$("cc-tags").value.split(",").map(x=>x.trim()).filter(Boolean),$("cc-note").value);const m=$("cc-save-msg");if(m)m.textContent="تم الحفظ";render();setTimeout(()=>detail(key),0);}catch(err){const m=$("cc-save-msg");if(m)m.textContent="تعذّر الحفظ: "+err.message;}
      }
    };
  }
  async function load() {
    try{threshold=Math.max(0,Number(localStorage.getItem(THRESHOLD))||20000);}catch(_){}
    let hasLocal=false;try{const raw=localStorage.getItem(LS);if(raw){notes=JSON.parse(raw)||{notes:{}};hasLocal=true;}}catch(_){}
    const a=A(), configured=typeof PHPAPI!=="undefined"&&PHPAPI.on()||(a&&typeof GH!=="undefined"&&GH.cfg&&GH.cfg()?.token);
    if(configured){try{const f=await GH.getFile(FILE);sha=f.sha;const remote=JSON.parse(decodeURIComponent(escape(atob((f.content||"").replace(/\n/g,"")))));if(remote&&remote.notes)notes=remote;}catch(_){sha=undefined;}}
    else if(!hasLocal){try{const r=await fetch(FILE+"?t="+Date.now(),{cache:"no-store"});if(r.ok){const j=await r.json();if(j&&j.notes)notes=j;}}catch(_){} }
    try{localStorage.setItem(LS,JSON.stringify(notes));}catch(_){}
  }
  async function persist(next) {
    const a=A(), configured=typeof PHPAPI!=="undefined"&&PHPAPI.on()||(a&&typeof GH!=="undefined"&&GH.cfg&&GH.cfg()?.token), json=JSON.stringify(next,null,2);
    if(configured){const b64=btoa(unescape(encodeURIComponent(json))),res=await GH.putFile(FILE,b64,sha,"حفظ ملاحظات العملاء والوسوم");sha=res&&res.content?res.content.sha:sha;}
    else localStorage.setItem(LS,json);
  }
  async function saveNote(key,tags,note){const next={...notes,notes:{...(notes.notes||{}),[key]:{tags:[...new Set((tags||[]).map(x=>String(x).trim()).filter(Boolean))],note:String(note||"").trim()}}};await persist(next);notes=next;return clone(next.notes[key]);}
  function init() {
    if(initialized)return; const a=A(); if(!a||!Array.isArray(a.orders))return setTimeout(init,250);
    initialized=true; try{threshold=Math.max(0,Number(localStorage.getItem(THRESHOLD))||20000);}catch(_){}
    const oldTab=a.tab; a.tab=function(t,btn){if(t!=="customers")$("tab-customers")?.classList.add("hidden");const r=oldTab.apply(this,arguments);if(t==="customers"){$("tab-customers")?.classList.remove("hidden");render();}return r;};
    const oldAll=a.renderAll; if(oldAll)a.renderAll=function(){const r=oldAll.apply(this,arguments);render();return r;};
    load().then(render); window.addEventListener("storage",e=>{if(e.key===LS){try{notes=JSON.parse(e.newValue)||{notes:{}};render();}catch(_){}}});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
  return { aggregate, render, open:detail, reload:load, saveNote, get notes(){return clone(notes);}, get threshold(){return threshold;} };
})();
window.AdminCustomers = AdminCustomers;
