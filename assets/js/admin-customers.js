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
    const all = enrich(aggregate(a.orders || [], a.products || [], a.blacklist || [], threshold));
    const q = query.toLowerCase().trim();
    return all.filter(c => (segment === "all" || c.segments.includes(segment)) && (!q || (c.name + " " + c.phone + " " + c.wilaya + " " + c.favorites.map(x=>x[0]).join(" ")).toLowerCase().includes(q)))
      .sort((x,y) => sort === "orders" ? y.orders-x.orders || y.spend-x.spend : sort === "last" ? (new Date(y.last)-new Date(x.last)) : y.spend-x.spend);
  }
  function segmentName(s) { if (String(s).startsWith("c:")) { const g = (notes.segments || []).find(x => "c:" + x.id === s); return g ? g.name : s; } return ({new:"جديد",repeat:"متكرر",vip:"VIP",inactive:"خامل",risk:"مخاطرة"})[s] || "الكل"; }
  const num = v => { const n = Number(v); return v !== "" && v != null && Number.isFinite(n) && n >= 0 ? n : null; };
  function matchSeg(c, cond, tags) {
    const k = cond || {}, sp = num(k.spendMin), oc = num(k.ordersMin), dy = num(k.inactiveDays), fr = num(k.failRateMin), w = String(k.wilaya || "").trim().toLowerCase(), t = String(k.tag || "").trim().toLowerCase();
    if (sp == null && oc == null && dy == null && fr == null && !w && !t) return false;
    if (sp != null && c.spend < sp) return false;
    if (oc != null && c.orders < oc) return false;
    if (dy != null && !(c.orders > 0 && c.days >= dy)) return false;
    if (fr != null && !(c.orders > 0 && c.failed / c.orders * 100 >= fr)) return false;
    if (w && !String(c.wilaya || "").toLowerCase().includes(w)) return false;
    if (t && !tags.some(x => String(x).toLowerCase() === t)) return false;
    return true;
  }
  function enrich(list) {
    const segs = Array.isArray(notes.segments) ? notes.segments : [], imp = notes.imported || {}, have = new Set(list.map(c => c.key)), out = list.slice();
    Object.keys(imp).forEach(k => { if (have.has(k)) return; const i = imp[k] || {}; out.push({ key:k, name:i.name || "—", phone:i.phone || k, wilaya:i.wilaya || "", orders:0, delivered:0, failed:0, spend:0, average:0, first:"", last:"", days:Infinity, segments:[], blocked:false, favorites:[], history:[], imported:true }); });
    out.forEach(c => { c.segments = c.segments.slice(); const tags = ((notes.notes || {})[c.key] || {}).tags || []; segs.forEach(g => { if (matchSeg(c, g.cond, Array.isArray(tags) ? tags : [])) c.segments.push("c:" + g.id); }); });
    return out;
  }
  function counts() { const a=A(); return enrich(aggregate(a?.orders || [], a?.products || [], a?.blacklist || [], threshold)); }
  function render() {
    const host = $("customers-app"); if (!host) return;
    const all = counts(), rows = currentRows(), names = [["all","الكل"],["new","جديد"],["repeat","متكرر"],["vip","VIP"],["inactive","خامل"],["risk","مخاطرة"],...(notes.segments || []).map(g => ["c:" + g.id, g.name])];
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
      <button type="button" class="cc-btn" data-act="csv">تصدير CSV</button><button type="button" class="cc-btn" data-act="copy">نسخ أرقام الشريحة</button><button type="button" class="cc-btn" data-act="segs">⚙ الشرائح المخصّصة</button><button type="button" class="cc-btn" data-act="import">⬆ استيراد CSV</button><input id="cc-file" type="file" accept=".csv,text/csv" hidden></div>
      <div class="cc-filters">${names.map(([id,label])=>`<button type="button" class="cc-btn ${segment===id?"on":""}" data-seg="${id}">${label} <b>${id==="all"?all.length:all.filter(c=>c.segments.includes(id)).length}</b></button>`).join("")}</div>
      <div class="cc-wrap"><table><thead><tr><th>العميل</th><th>الهاتف</th><th>الولاية</th><th>الطلبات</th><th>مسلّمة</th><th>الإنفاق</th><th>آخر طلب</th><th>الشريحة</th></tr></thead><tbody>${rows.length?rows.map(c=>`<tr data-customer="${esc(c.key)}"><td><b>${esc(c.name)}</b></td><td dir="ltr">${esc(c.phone)}</td><td>${esc(c.wilaya||"—")}</td><td>${c.orders}</td><td>${c.delivered}</td><td>${c.spend.toLocaleString("fr-DZ")} دج</td><td>${esc(c.last?new Date(c.last).toLocaleDateString("fr-DZ"):"—")}</td><td>${c.segments.length?c.segments.map(s=>`<span class="cc-tag">${segmentName(s)}</span>`).join(""):"—"}</td></tr>`).join(""):`<tr><td colspan="8" class="cc-muted" style="text-align:center;padding:1.5rem">لا توجد نتائج</td></tr>`}</tbody></table></div>
    </div>`;
    host.oninput = e => { if(e.target.id==="cc-search"){query=e.target.value;const p=e.target.selectionStart;render();const x=$("cc-search");x.focus();x.setSelectionRange(p,p);} };
    host.onchange = e => { if(e.target.id==="cc-file"){const f=e.target.files[0];e.target.value="";if(f){const r=new FileReader();r.onload=()=>importPreview(String(r.result||""));r.readAsText(f);}return;} if(e.target.id==="cc-sort"){sort=e.target.value;render();} if(e.target.id==="cc-threshold"){threshold=Math.max(0,Number(e.target.value)||0);try{localStorage.setItem(THRESHOLD,String(threshold));}catch(_){}render();} };
    host.onclick = e => { const b=e.target.closest("[data-act],[data-seg],[data-customer]"); if(!b)return;
      if(b.dataset.seg){segment=b.dataset.seg;render();} else if(b.dataset.act==="csv") exportCsv(rows); else if(b.dataset.act==="copy") copyPhones(rows); else if(b.dataset.act==="segs") segEditor(); else if(b.dataset.act==="import") { const f=$("cc-file"); if(f) f.click(); } else if(b.dataset.customer) detail(b.dataset.customer);
    };
  }
  function csvCell(v) { return '"' + String(v == null ? "" : v).replace(/"/g,'""') + '"'; }
  function exportCsv(rows) {
    const data=[["phone","name","wilaya","orders","delivered","failed","spend","average","first_order","last_order","segments","favorite_products"],...rows.map(c=>[c.phone,c.name,c.wilaya,c.orders,c.delivered,c.failed,c.spend,Math.round(c.average),c.first,c.last,c.segments.join("|"),c.favorites.map(x=>x[0]+" x"+x[1]).join("; ")])];
    const blob=new Blob(["\uFEFF"+data.map(r=>r.map(csvCell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="customers-"+new Date().toISOString().slice(0,10)+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  }
  async function copyPhones(rows) { const text=[...new Set(rows.map(c=>c.phone))].join("\n"); try{await navigator.clipboard.writeText(text);toast("✅ نُسخت "+rows.length+" أرقام");}catch(_){prompt("انسخ الأرقام:",text);} }
  function detail(key) {
    const c=counts().find(x=>x.key===key); if(!c)return;
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
  async function persist(next, msg) {
    const a=A(), configured=typeof PHPAPI!=="undefined"&&PHPAPI.on()||(a&&typeof GH!=="undefined"&&GH.cfg&&GH.cfg()?.token), json=JSON.stringify(next,null,2);
    if(configured){const b64=btoa(unescape(encodeURIComponent(json))),res=await GH.putFile(FILE,b64,sha,msg || "حفظ ملاحظات العملاء والوسوم");sha=res&&res.content?res.content.sha:sha;}
    else localStorage.setItem(LS,json);
  }
  async function saveNote(key,tags,note){const next={...notes,notes:{...(notes.notes||{}),[key]:{tags:[...new Set((tags||[]).map(x=>String(x).trim()).filter(Boolean))],note:String(note||"").trim()}}};await persist(next);notes=next;return clone(next.notes[key]);}
  function overlay(html) {
    const m = document.createElement("div"); m.className = "cc-overlay"; m.innerHTML = '<section class="cc-detail" role="dialog" aria-modal="true">' + html + '</section>';
    $("customers-app").appendChild(m); m.addEventListener("click", e => { if (e.target === m || e.target.closest("[data-x]")) m.remove(); }); return m;
  }
  function condText(k) { const o = []; if (num(k.spendMin) != null) o.push("إنفاق ≥ " + k.spendMin); if (num(k.ordersMin) != null) o.push("طلبات ≥ " + k.ordersMin); if (num(k.inactiveDays) != null) o.push("آخر طلب منذ ≥ " + k.inactiveDays + " يوم"); if (num(k.failRateMin) != null) o.push("فشل ≥ " + k.failRateMin + "%"); if (k.wilaya) o.push("ولاية: " + k.wilaya); if (k.tag) o.push("وسم: " + k.tag); return o.join(" + ") || "—"; }
  function segEditor(editId) {
    const segs = notes.segments || [], cur = segs.find(g => g.id === editId) || { cond:{} }, k = cur.cond || {};
    const m = overlay('<div style="display:flex;gap:.6rem;align-items:center"><h3 style="margin:0;flex:1">⚙ الشرائح المخصّصة</h3><button class="cc-btn" data-x>إغلاق</button></div><p class="cc-muted">كل الشروط المملوءة يجب أن تتحقق معاً. اتركها فارغة لتجاهلها.</p>'
      + (segs.length ? '<div>' + segs.map(g => '<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin:.3rem 0"><b>' + esc(g.name) + '</b><span class="cc-muted">' + esc(condText(g.cond)) + '</span><button class="cc-btn" data-edit="' + esc(g.id) + '">تعديل</button><button class="cc-btn" data-del="' + esc(g.id) + '">حذف</button></div>').join("") + '</div>' : '')
      + '<h4>' + (editId ? "تعديل الشريحة" : "شريحة جديدة") + '</h4><div class="grid2"><label>الاسم<input id="sg-name" value="' + esc(cur.name || "") + '"></label><label>إجمالي الإنفاق ≥ (دج)<input id="sg-sp" type="number" min="0" value="' + esc(k.spendMin ?? "") + '"></label><label>عدد الطلبات ≥<input id="sg-oc" type="number" min="0" value="' + esc(k.ordersMin ?? "") + '"></label><label>آخر طلب منذ ≥ (يوم)<input id="sg-dy" type="number" min="0" value="' + esc(k.inactiveDays ?? "") + '"></label><label>نسبة الفشل ≥ (%)<input id="sg-fr" type="number" min="0" max="100" value="' + esc(k.failRateMin ?? "") + '"></label><label>الولاية<input id="sg-w" value="' + esc(k.wilaya || "") + '"></label><label>الوسم<input id="sg-t" value="' + esc(k.tag || "") + '"></label></div><div style="margin-top:.7rem"><button class="cc-btn" id="sg-save">' + (editId ? "حفظ التعديل" : "إضافة الشريحة") + '</button> <span id="sg-msg" class="cc-muted"></span></div>');
    m.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => { m.remove(); segEditor(b.dataset.edit); });
    m.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { if (!confirm("حذف الشريحة؟")) return; try { const next = { ...notes, segments:(notes.segments || []).filter(g => g.id !== b.dataset.del) }; await persist(next, "حذف شريحة عملاء"); notes = next; if (segment === "c:" + b.dataset.del) segment = "all"; m.remove(); render(); segEditor(); } catch (e) { toast("تعذّر الحذف: " + (e.message || "")); } });
    m.querySelector("#sg-save").onclick = async () => {
      const g = x => m.querySelector(x).value.trim(), name = g("#sg-name"), cond = { spendMin:g("#sg-sp"), ordersMin:g("#sg-oc"), inactiveDays:g("#sg-dy"), failRateMin:g("#sg-fr"), wilaya:g("#sg-w"), tag:g("#sg-t") };
      Object.keys(cond).forEach(x => { if (cond[x] === "") delete cond[x]; });
      if (!name) { toast("أدخل اسم الشريحة"); return; }
      if (!Object.keys(cond).length) { toast("أضف شرطاً واحداً على الأقل"); return; }
      const list = (notes.segments || []).slice(), id = editId || "s" + Date.now().toString(36), item = { id, name, cond };
      const i = list.findIndex(x => x.id === id); if (i >= 0) list[i] = item; else list.push(item);
      try { const next = { ...notes, segments:list }; await persist(next, "حفظ شريحة عملاء"); notes = next; m.remove(); render(); toast("تم حفظ الشريحة"); } catch (e) { toast("تعذّر الحفظ: " + (e.message || "")); }
    };
  }
  function parseCsv(text) {
    const out = []; let row = [], f = "", q = false;
    for (let i = 0; i < text.length; i++) { const c = text[i]; if (q && c === '"' && text[i+1] === '"') { f += '"'; i++; } else if (c === '"') q = !q; else if ((c === "," || c === ";") && !q) { row.push(f); f = ""; } else if ((c === "\n" || c === "\r") && !q) { if (c === "\r" && text[i+1] === "\n") i++; row.push(f); f = ""; if (row.some(x => x.trim())) out.push(row); row = []; } else f += c; }
    row.push(f); if (row.some(x => x.trim())) out.push(row); return out;
  }
  let importRows = [];
  function importPreview(text) {
    const rows = parseCsv(text.replace(/^\uFEFF/, "")); if (!rows.length) { toast("الملف فارغ"); return; }
    const head = rows[0].map(x => x.trim().toLowerCase()), find = (...ns) => head.findIndex(h => ns.includes(h)), hasHead = find("phone","هاتف","tel","mobile","téléphone","telephone") >= 0;
    const ip = hasHead ? find("phone","هاتف","tel","mobile","téléphone","telephone") : 1, inm = hasHead ? find("name","اسم","الاسم","nom") : 0, it = hasHead ? find("tags","وسوم","tag","الوسوم") : 2, iw = hasHead ? find("wilaya","ولاية","الولاية") : -1;
    const existing = new Set(enrich(aggregate((A() || {}).orders || [], (A() || {}).products || [], (A() || {}).blacklist || [], threshold)).filter(c => !c.imported).map(c => c.key)), seen = new Set(), res = { add:[], merge:[], invalid:0, dup:0 };
    rows.slice(hasHead ? 1 : 0).forEach(r => {
      const key = phone(r[ip] || ""); if (!/^0\d{8,9}$/.test(key)) { res.invalid++; return; }
      if (seen.has(key)) { res.dup++; return; } seen.add(key);
      const item = { key, name:(r[inm] || "").trim(), wilaya:iw >= 0 ? (r[iw] || "").trim() : "", tags:(r[it] || "").split(/[|،]/).map(x => x.trim()).filter(Boolean) };
      (existing.has(key) || (notes.imported || {})[key] ? res.merge : res.add).push(item);
    });
    importRows = res.add.concat(res.merge);
    const m = overlay('<div style="display:flex;gap:.6rem;align-items:center"><h3 style="margin:0;flex:1">⬆ معاينة الاستيراد</h3><button class="cc-btn" data-x>إلغاء</button></div><p>' + res.add.length + ' عميل جديد · ' + res.merge.length + ' موجود (تُدمج وسومه فقط) · ' + res.invalid + ' رقم غير صالح · ' + res.dup + ' مكرّر في الملف</p><p class="cc-muted">الأعمدة: اسم، هاتف، وسوم (مفصولة بـ | )، ولاية اختيارية. لا تُعدَّل الطلبات.</p><div class="cc-wrap" style="max-height:40vh;overflow:auto"><table><thead><tr><th>الهاتف</th><th>الاسم</th><th>الوسوم</th><th></th></tr></thead><tbody>' + importRows.slice(0, 50).map(x => '<tr><td dir="ltr">' + esc(x.key) + '</td><td>' + esc(x.name || "—") + '</td><td>' + esc(x.tags.join(", ") || "—") + '</td><td>' + (res.merge.includes(x) ? "دمج" : "جديد") + '</td></tr>').join("") + '</tbody></table></div><div style="margin-top:.7rem"><button class="cc-btn" id="im-ok" ' + (importRows.length ? "" : "disabled") + '>تطبيق الاستيراد (' + importRows.length + ')</button></div>');
    m.querySelector("#im-ok").onclick = async () => {
      const imp = { ...(notes.imported || {}) }, nn = { ...(notes.notes || {}) };
      importRows.forEach(x => {
        if (res.add.includes(x)) imp[x.key] = { name:x.name, phone:x.key, wilaya:x.wilaya };
        else if (imp[x.key]) { if (!imp[x.key].name && x.name) imp[x.key].name = x.name; }
        if (x.tags.length) { const old = nn[x.key] || { tags:[], note:"" }; nn[x.key] = { ...old, tags:[...new Set([...(old.tags || []), ...x.tags])] }; }
      });
      try { const next = { ...notes, imported:imp, notes:nn }; await persist(next, "استيراد عملاء CSV"); notes = next; m.remove(); render(); toast("تم استيراد " + importRows.length + " عميل"); } catch (e) { toast("تعذّر الاستيراد: " + (e.message || "")); }
    };
  }
  function init() {
    if(initialized)return; const a=A(); if(!a||!Array.isArray(a.orders))return setTimeout(init,250);
    initialized=true; try{threshold=Math.max(0,Number(localStorage.getItem(THRESHOLD))||20000);}catch(_){}
    const oldTab=a.tab; a.tab=function(t,btn){if(t!=="customers")$("tab-customers")?.classList.add("hidden");const r=oldTab.apply(this,arguments);if(t==="customers"){$("tab-customers")?.classList.remove("hidden");render();}return r;};
    const oldAll=a.renderAll; if(oldAll)a.renderAll=function(){const r=oldAll.apply(this,arguments);render();return r;};
    load().then(render); window.addEventListener("storage",e=>{if(e.key===LS){try{notes=JSON.parse(e.newValue)||{notes:{}};render();}catch(_){}}});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
  return { aggregate, enrich, matchSeg, render, open:detail, reload:load, saveNote, get notes(){return clone(notes);}, get threshold(){return threshold;} };
})();
window.AdminCustomers = AdminCustomers;
