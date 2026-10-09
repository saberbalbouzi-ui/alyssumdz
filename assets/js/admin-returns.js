/* سجلّ المرتجعات بعد التسليم — مستقل عن حالات الطلبات وفشل التوصيل. */
const AdminReturns = (() => {
  const PATH = "assets/data/returns.json", LOCAL = "admin_returns_local_v1";
  const $ = id => document.getElementById(id), A = () => typeof Admin !== "undefined" ? Admin : {};
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const money = n => Math.round(Number(n) || 0).toLocaleString("fr-DZ") + " دج";
  const S = { items: [], sha: null, loaded: false, loading: false, saving: false, localOnly: false, adding: false, query: "", matches: [], order: null, deliveryDate:"", qty: {}, restock: {}, amount: null, amountManual: false, replacementAmount: 0, refundShipping: false, windowDays:14, err: "" };
  const kindText = { return:"إرجاع", exchange:"استبدال", refund:"استرداد" }, statusText = { requested:"مطلوب", approved:"موافق عليه", rejected:"مرفوض", received:"مستلم", refunded:"مستردّ المبلغ", exchanged:"تم الاستبدال", closed:"مغلق" };
  const transitions = { requested:["approved","rejected"], approved:["received"], received:["refunded","exchanged","closed"], rejected:[], refunded:[], exchanged:[], closed:[] };
  function base64Json(raw) { return JSON.parse(decodeURIComponent(escape(atob(String(raw || "").replace(/\n/g, ""))))); }
  function b64Json(obj) { return btoa(unescape(encodeURIComponent(JSON.stringify(obj, null, 2)))); }
  function localData() { try { return JSON.parse(localStorage.getItem(LOCAL) || "null"); } catch (_) { return null; } }
  function backup() { try { localStorage.setItem(LOCAL, JSON.stringify({ items:S.items, windowDays:S.windowDays, updatedAt:S.updatedAt || "" })); return true; } catch (_) { return false; } }
  async function load() {
    if (S.loaded || S.loading) return;
    S.loading = true; let remote = false;
    try {
      if (typeof PHPAPI !== "undefined" && PHPAPI.on()) {
        const r = await PHPAPI.call("file", { method:"GET" }, "&path=" + encodeURIComponent(PATH) + "&t=" + Date.now());
        if (r.ok && r.j && r.j.content) { const d=base64Json(r.j.content); S.items=Array.isArray(d.items)?d.items:[]; S.windowDays=Math.max(1,Number(d.windowDays)||14); S.sha=r.j.sha; S.updatedAt=d.updatedAt || ""; remote=true; }
      } else if (typeof GH !== "undefined" && GH.cfg && GH.cfg() && GH.cfg().token) {
        const f=await GH.getFile(PATH), d=base64Json(f.content); S.items=Array.isArray(d.items)?d.items:[]; S.windowDays=Math.max(1,Number(d.windowDays)||14); S.sha=f.sha; S.updatedAt=d.updatedAt || ""; remote=true;
      }
    } catch (_) { }
    const local=localData();
    if (local && Array.isArray(local.items) && (!remote || String(local.updatedAt || "") > String(S.updatedAt || ""))) { S.items=local.items; S.windowDays=Math.max(1,Number(local.windowDays)||14); S.updatedAt=local.updatedAt || ""; }
    if (!remote && !local) S.items=[];
    S.loaded=true; S.loading=false;
  }
  async function save() {
    if (S.saving) return false;
    S.saving=true; S.updatedAt=new Date().toISOString(); const hasBackup=backup();
    const payload={ items:S.items, windowDays:S.windowDays, updatedAt:S.updatedAt }, body=b64Json(payload);
    try {
      if (typeof PHPAPI !== "undefined" && PHPAPI.on()) {
        const r=await PHPAPI.call("file", { method:"PUT", body:JSON.stringify({ path:PATH, content:body, sha:S.sha, message:"حفظ سجل المرتجعات" }) });
        if (!r.ok) throw new Error(r.j && (r.j.error || r.j.message) || "تعذّر حفظ ملف المرتجعات"); S.sha=r.j.content && r.j.content.sha || S.sha;
      } else if (typeof GH !== "undefined" && GH.cfg && GH.cfg() && GH.cfg().token) {
        const r=await GH.putFile(PATH,body,S.sha,"حفظ سجل المرتجعات"); S.sha=r && r.content && r.content.sha || S.sha;
      } else { localStorage.setItem(LOCAL,JSON.stringify(payload)); }
      S.localOnly=false; S.saving=false; return true;
    } catch (e) { S.saving=false; S.localOnly=hasBackup; S.err="تعذّر حفظ المرتجعات على الخادم"+(hasBackup?"؛ حُفظت محلياً في هذا المتصفح":"، ولم تتوفر نسخة محلية")+": " + (e.message || ""); return hasBackup; }
  }
  function deliveredAt(o) { return o && ((A().deliveredOf && A().deliveredOf(o)) || o.deliveredAt || o.deliveryDate || o.delivered_at || o.dateLivraison || o.date_livraison || o.date); }
  function withinReturnWindow(o) { const raw=S.order&&orderId(S.order)===orderId(o)&&S.deliveryDate?S.deliveryDate:deliveredAt(o), stamp=/^\d{4}-\d{2}-\d{2}$/.test(String(raw||""))?String(raw)+"T00:00:00":raw, t=new Date(stamp).getTime(), days=Math.max(1,Number(S.windowDays)||14); return Number.isFinite(t) && Date.now()>=t && Date.now()-t<days*86400000; }
  function orders() { return (A().orders || []).filter(o=>o && String(o.status || "").toLowerCase()==="livree"); }
  function orderLines(o) {
    try { return typeof A().orderLines === "function" ? A().orderLines(o).filter(l=>l && l.p && l.p.slug && Number(l.qty)>0) : []; } catch (_) { return []; }
  }
  function orderId(o) { return String(o && (o.id || o.orderId || o.number) || ""); }
  function phone(o) { return String(o && (o.phone || o.tel || o.telephone) || ""); }
  function digits(s) { return String(s || "").replace(/\D/g, ""); }
  function variantKey(v) { return v ? String(v.sku || v.barcode || v.id || JSON.stringify(v.attrs || {})) : ""; }
  function returnedQty(id, slug, vkey, omitId) {
    return S.items.filter(r=>String(r.orderId)===String(id) && r.id!==omitId && r.status!=="rejected")
      .reduce((n,r)=>n+(r.items || []).filter(i=>i.slug===slug && (!i.variantKey || i.variantKey===vkey)).reduce((q,i)=>q+(Number(i.qty)||0),0),0);
  }
  function groupedLines(o) {
    const map=new Map();
    orderLines(o).forEach(l=>{ const slug=String(l.p.slug), vkey=variantKey(l.v), key=slug+"|"+vkey, row=map.get(key)||{key,slug,variantKey:vkey,title:(l.p.title||slug)+(l.v?" — "+Object.values(l.v.attrs||{}).join(" / "):""),qty:0,total:0}; row.qty+=Number(l.qty)||0; row.total+=Number(l.total)||((Number(l.p.price)||0)*(Number(l.qty)||0)); map.set(key,row); });
    return [...map.values()].map(x=>({...x,available:Math.max(0,x.qty-returnedQty(orderId(o),x.slug,x.variantKey)),unit:x.qty?x.total/x.qty:0}));
  }
  function selectedItems() { return groupedLines(S.order || {}).map(l=>({ ...l, qty:Math.max(0,Math.floor(Number(S.qty[l.key])||0)) })).filter(l=>l.qty>0); }
  function computedAmount() { const goods=selectedItems().reduce((n,x)=>n+x.unit*x.qty,0); const shipping=S.refundShipping?Math.max(0,(Number(S.order&&S.order.total)||0)-groupedLines(S.order||{}).reduce((sum,x)=>sum+x.total,0)):0; return goods+shipping; }
  function amountAlreadyCommitted(id) { return S.items.filter(r=>String(r.orderId)===String(id)&&r.status!=="rejected").reduce((n,r)=>n+Math.max(0,Number(r.amount)||0),0); }
  function remainingOrderAmount(o) { return Math.max(0,(Number(o&&o.total)||0)-amountAlreadyCommitted(orderId(o))); }
  function summary() {
    const valid=S.items.filter(r=>r.status!=="rejected"), reasons=new Map(), products=new Map();
    valid.forEach(r=>{ const reason=String(r.reason||"غير محدد").trim()||"غير محدد"; reasons.set(reason,(reasons.get(reason)||0)+1); (r.items||[]).forEach(i=>products.set(i.slug,(products.get(i.slug)||0)+(Number(i.qty)||0))); });
    const topReason=[...reasons].sort((a,b)=>b[1]-a[1])[0], topProduct=[...products].sort((a,b)=>b[1]-a[1])[0], delivered=orders().length, returnedOrders=new Set(valid.map(r=>String(r.orderId))).size;
    const topTitle=topProduct&&((A().products||[]).find(p=>p.slug===topProduct[0])||{}).title;
    return { count:S.items.length, refunded:S.items.reduce((n,r)=>n+(r.status==="refunded"?Math.max(0,Number(r.amount)||0):r.status==="exchanged"?Math.max(0,-(Number(r.amount)||0)):0),0), reason:topReason?topReason[0]+" ("+topReason[1]+")":"—", rate:delivered?(returnedOrders/delivered*100).toFixed(1):"0.0", product:topProduct?(topTitle||topProduct[0])+" ×"+topProduct[1]:"—" };
  }
  function filteredOrders() {
    const q=String(S.query||"").trim().toLowerCase(), qd=digits(q);
    return orders().filter(o=>groupedLines(o).some(l=>l.available>0)).filter(o=>!q||orderId(o).toLowerCase().includes(q)||String(o.name||"").toLowerCase().includes(q)||String(o.phone||"").toLowerCase().includes(q)||!!(qd&&digits(phone(o)).includes(qd))).slice(0,30);
  }
  function resetForm() { S.adding=false; S.query="";S.matches=[];S.order=null;S.deliveryDate="";S.qty={};S.restock={};S.amount=null;S.amountManual=false;S.replacementAmount=0;S.refundShipping=false;S.err=""; }
  function orderResults() {
    S.matches=filteredOrders();
    return S.matches.length?`<div class="rt-results">${S.matches.map((o,i)=>`<button type="button" class="rt-result" data-order="${i}"><b>#${esc(orderId(o)||"—")} · ${esc(o.name||"—")}</b><small>${esc(phone(o))} · ${esc(o.wilaya||"")} · ${money(o.total)}</small></button>`).join("")}</div>`:'<div class="rt-note">لا توجد طلبات مسلَّمة تطابق البحث.</div>';
  }
  function formHtml() {
    if (!S.adding) return "";
    if (!S.order) return `<section class="rt-card"><div class="rt-head"><h3>تسجيل مرتجع أو استبدال</h3><button type="button" class="rt-btn rt-quiet" id="rt-cancel">إلغاء</button></div><label>ابحث برقم الطلب أو الهاتف<input id="rt-order-search" type="search" placeholder="رقم الطلب أو رقم الهاتف" value="${esc(S.query)}"></label>${orderResults()}</section>`;
    const lines=groupedLines(S.order);
    const itemRows=lines.map(l=>`<tr><td>${esc(l.title)}</td><td>${l.available}</td><td>${money(l.unit)}</td><td><input class="rt-qty" type="number" min="0" max="${l.available}" step="1" data-key="${esc(l.key)}" value="${Math.min(l.available,Math.max(0,Number(S.qty[l.key]??l.available)||0))}" ${l.available?"":"disabled"}></td><td><label class="rt-check"><input class="rt-restock-line" type="checkbox" data-key="${esc(l.key)}" ${S.restock[l.key]===false?"":"checked"}> سليم (أزل العلامة إن كان تالفاً)</label></td></tr>`).join("");
    const amount=S.amountManual?S.amount:Math.round(computedAmount());
    return `<section class="rt-card"><div class="rt-head"><div><h3>مرتجع الطلب #${esc(orderId(S.order))}</h3><div class="rt-note">${esc(S.order.name||"")} · ${esc(phone(S.order))} · ${esc(S.order.wilaya||"")}</div></div><button type="button" class="rt-btn rt-quiet" id="rt-back">اختيار طلب آخر</button></div><label>تاريخ التسليم الفعلي<input id="rt-delivered-date" type="date" value="${esc(S.deliveryDate)}"></label>
      <div class="rt-table"><table><thead><tr><th>المنتج</th><th>المتبقي</th><th>السعر التقريبي</th><th>الكمية</th><th>حالة القطعة</th></tr></thead><tbody>${itemRows||'<tr><td colspan="5">تعذّر قراءة منتجات الطلب.</td></tr>'}</tbody></table></div>
      <div class="rt-form-grid"><label>نوع العملية<select id="rt-kind"><option value="return">إرجاع</option><option value="exchange">استبدال</option><option value="refund">استرداد</option></select></label><label>السبب<input id="rt-reason" maxlength="180" placeholder="مثال: عيب في المنتج"></label><label>مبلغ الاسترداد (دج)<input id="rt-amount" type="number" min="0" max="${remainingOrderAmount(S.order)}" step="1" value="${amount}"></label><label>قيمة المنتج البديل (للاستبدال)<input id="rt-replacement" type="number" min="0" step="1" value="${Number(S.replacementAmount)||0}"></label><label class="rt-check"><input id="rt-refund-shipping" type="checkbox" ${S.refundShipping?"checked":""}> إعادة الشحن عند خطأ المتجر</label><label class="rt-wide">ملاحظة<textarea id="rt-note" rows="2" maxlength="1000" placeholder="ملاحظات داخلية اختيارية"></textarea></label></div>
      <div class="rt-head"><span class="rt-note">المبلغ محسوب بعد حصة الخصم. فرق الاستبدال = قيمة البديل − قيمة المرتجع؛ الموجب يُحصَّل والسالب يُسترد. المهلة: ${S.windowDays} يوماً.</span><button type="button" class="rt-btn rt-primary" id="rt-save-new" ${S.saving?"disabled":""}>حفظ طلب المرتجع</button></div>${S.err?`<div class="rt-error">${esc(S.err)}</div>`:""}</section>`;
  }
  function draw() {
    const host=$("returns-content"); if(!host)return;
    const st=summary(), list=[...S.items].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
    host.innerHTML=`<style>#rt{display:grid;gap:14px;color:#fff}#rt *{box-sizing:border-box}#rt .rt-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}#rt .rt-card{padding:16px;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025));box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 12px 28px rgba(0,0,0,.24)}#rt .rt-stat small{display:block;color:#b4c9be}#rt .rt-stat b{display:block;font-size:1.18rem;margin-top:5px}#rt .rt-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}#rt h2,#rt h3{margin:0}#rt h3{font-size:1.08rem}#rt .rt-note{font-size:.88rem;color:#b4c9be;margin-top:4px}#rt label{display:grid;gap:5px;color:#d7e5dd;font-size:.9rem;font-weight:700}#rt input:not([type=checkbox]),#rt select,#rt textarea{width:100%;padding:9px 10px;border:1px solid rgba(255,255,255,.17);border-radius:10px;color:#fff;background:rgba(255,255,255,.07);font:inherit}#rt select option{background:#10231b;color:#fff}#rt textarea{resize:vertical}#rt .rt-btn{padding:9px 14px;border-radius:12px;font:inherit;font-weight:800;color:#fff;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),inset 0 -5px 9px rgba(0,0,0,.2),0 5px 13px rgba(0,0,0,.22);backdrop-filter:blur(8px);cursor:pointer;transition:transform .18s,background .18s}#rt .rt-btn:hover{transform:translateY(-2px);background:rgba(255,255,255,.13)}#rt .rt-btn:disabled{opacity:.55;cursor:wait}#rt .rt-primary{background:rgba(74,222,128,.18);border-color:rgba(134,239,172,.42)}#rt .rt-primary:hover{background:rgba(74,222,128,.28)}#rt .rt-quiet{background:rgba(255,255,255,.05)}#rt .rt-table{overflow:auto}#rt table{width:100%;min-width:680px;border-collapse:collapse}#rt th,#rt td{text-align:start;padding:9px;border-bottom:1px solid rgba(255,255,255,.1);vertical-align:middle}#rt th{color:#b4c9be;font-size:.85rem}#rt .rt-results{display:grid;gap:6px;margin-top:10px;max-height:280px;overflow:auto}#rt .rt-result{display:grid;gap:3px;text-align:start;padding:10px 12px;color:#fff;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.16);border-radius:12px;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 -4px 7px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.18);backdrop-filter:blur(8px);cursor:pointer;transition:transform .18s,background .18s}#rt .rt-result:hover{transform:translateY(-2px);background:rgba(74,222,128,.18)}#rt .rt-result small{color:#b4c9be}#rt .rt-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}#rt .rt-check{display:flex!important;align-items:center;gap:8px}#rt .rt-check input{width:18px;height:18px}#rt .rt-wide{grid-column:1/-1}#rt .rt-error{color:#ff9aa2;margin-top:8px}#rt .rt-status{font-weight:800;color:#d7e5dd}#rt .rt-received{color:#86efac}#rt .rt-requested{color:#fdba74}#rt .rt-rejected{color:#ff9aa2}#rt .rt-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap}@media(max-width:900px){#rt .rt-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){#rt .rt-grid,#rt .rt-form-grid{grid-template-columns:1fr}#rt .rt-wide{grid-column:auto}}</style>
      <div id="rt"><div class="rt-head"><div><h2>المرتجعات بعد التسليم</h2><div class="rt-note">سجل الإرجاع والاستبدال والاسترداد للطلبات المسلَّمة فقط</div></div><label>مهلة الإرجاع بالأيام<input id="rt-window" type="number" min="1" max="365" value="${S.windowDays}" style="width:90px"></label><button type="button" class="rt-btn rt-primary" id="rt-new">تسجيل مرتجع</button></div>
      <div class="rt-grid"><div class="rt-card rt-stat"><small>السجلات</small><b>${st.count}</b></div><div class="rt-card rt-stat"><small>المبالغ المستردة</small><b>${money(st.refunded)}</b></div><div class="rt-card rt-stat"><small>أكثر الأسباب</small><b>${esc(st.reason)}</b></div><div class="rt-card rt-stat"><small>نسبة الطلبات المرتجعة</small><b>${st.rate}%</b></div><div class="rt-card rt-stat"><small>أكثر المنتجات إرجاعاً</small><b>${esc(st.product)}</b></div></div>
      ${formHtml()}${S.err&&!S.adding?`<div class="rt-error">${esc(S.err)}</div>`:""}
      <section class="rt-card"><div class="rt-head"><h3>سجلّ العمليات</h3><span class="rt-note">يُستثنى فشل التوصيل المسجّل في الطلبات</span></div><div class="rt-table"><table><thead><tr><th>الطلب</th><th>الهاتف</th><th>المنتجات</th><th>النوع / السبب</th><th>المبلغ / الفرق</th><th>الحالة</th><th>إعادة المخزون</th><th>التاريخ</th></tr></thead><tbody>${list.length?list.map(r=>`<tr><td>#${esc(r.orderId)}</td><td>${esc(r.phone)}</td><td>${(r.items||[]).map(i=>{const p=(A().products||[]).find(x=>x.slug===i.slug);return esc((p&&p.title)||i.slug)+" ×"+(Number(i.qty)||0);}).join("، ")}</td><td>${esc(kindText[r.kind]||r.kind)}<br><small>${esc(r.reason)}</small></td><td>${money(r.amount)}</td><td><select class="rt-status-select" data-id="${esc(r.id)}" aria-label="حالة المرتجع #${esc(r.orderId)}">${[r.status,...(transitions[r.status]||[])].map(k=>`<option value="${k}"${k===r.status?" selected":""}>${statusText[k]||k}</option>`).join("")}</select></td><td><span class="rt-status ${r.status==="received"?"rt-received":""}">${(r.items||[]).map(i=>!i.restock?"تالفة":"restocked"===i.restocked?"أُعيد للمخزون":(i.restocked?"أُعيد للمخزون":"سليم؛ عند الاستلام")).join("، ")||"—"}</span></td><td>${esc(new Date(r.date||r.createdAt).toLocaleDateString("ar-DZ"))}</td></tr>`).join(""):'<tr><td colspan="8" class="rt-note">لا توجد مرتجعات مسجّلة بعد.</td></tr>'}</tbody></table></div></section></div>`;
    $("rt-new").onclick=()=>{S.adding=true;S.err="";draw();};
    const cancel=$("rt-cancel");if(cancel)cancel.onclick=()=>{resetForm();draw();};
    const back=$("rt-back");if(back)back.onclick=()=>{S.order=null;S.qty={};S.query="";draw();};
    const search=$("rt-order-search");if(search)search.oninput=()=>{const pos=search.selectionStart;S.query=search.value;draw();const next=$("rt-order-search");if(next){next.focus();next.setSelectionRange(pos,pos);}};
    host.querySelectorAll("[data-order]").forEach(b=>b.onclick=()=>{S.order=S.matches[Number(b.dataset.order)]||null;S.deliveryDate=String(deliveredAt(S.order)||"").slice(0,10);S.qty={};S.restock={};S.amount=null;S.amountManual=false;S.err="";if(S.order)groupedLines(S.order).forEach(l=>{S.qty[l.key]=l.available;S.restock[l.key]=true;});draw();});
    const deliveredInput=$("rt-delivered-date");if(deliveredInput)deliveredInput.onchange=()=>{S.deliveryDate=deliveredInput.value;};
    host.querySelectorAll(".rt-qty").forEach(inp=>inp.oninput=()=>{S.qty[inp.dataset.key]=Math.min(Number(inp.max)||0,Math.max(0,Math.floor(Number(inp.value)||0)));if(!S.amountManual){const a=$("rt-amount");if(a)a.value=Math.round(computedAmount());}});
    const amt=$("rt-amount");if(amt)amt.oninput=()=>{S.amount=Number(amt.value)||0;S.amountManual=true;};
    const repl=$("rt-replacement");if(repl)repl.oninput=()=>{S.replacementAmount=Math.max(0,Number(repl.value)||0);};
    const ship=$("rt-refund-shipping");if(ship)ship.onchange=()=>{S.refundShipping=ship.checked;if(!S.amountManual){const a=$("rt-amount");if(a)a.value=Math.round(computedAmount());}};
    host.querySelectorAll(".rt-restock-line").forEach(input=>input.onchange=()=>{S.restock[input.dataset.key]=input.checked;});
    const win=$("rt-window");if(win)win.onchange=async()=>{S.windowDays=Math.min(365,Math.max(1,Math.floor(Number(win.value)||14)));if(!await save())S.err="تعذّر حفظ مهلة الإرجاع.";draw();};
    const saveNew=$("rt-save-new");if(saveNew)saveNew.onclick=createReturn;
    host.querySelectorAll(".rt-status-select").forEach(sel=>sel.onchange=()=>changeStatus(sel.dataset.id,sel.value));
  }
  async function createReturn() {
    if(!S.order)return;
    const items=selectedItems(), reason=$("rt-reason").value.trim(), kind=$("rt-kind").value, note=$("rt-note").value.trim(), id=orderId(S.order), requestedAmount=Math.round(Number($("rt-amount").value)||0), replacement=Math.round(Number($("rt-replacement").value)||0), itemValue=Math.round(items.reduce((n,x)=>n+x.unit*x.qty,0)), amount=kind==="exchange"?replacement-itemValue:requestedAmount;
    if(!S.deliveryDate){S.err="أدخل تاريخ التسليم الفعلي للتحقق من المهلة.";draw();return;}
    if(!withinReturnWindow(S.order)){S.err="انتهت مهلة الإرجاع لهذا الطلب.";draw();return;}
    if(!reason){S.err="اكتب سبب الإرجاع أو الاستبدال.";draw();return;}
    if(!items.length){S.err="اختر كمية واحدة على الأقل للإرجاع.";draw();return;}
    for(const item of items){const line=groupedLines(S.order).find(x=>x.key===item.key);if(!line||item.qty>line.available){S.err="تجاوزت الكمية المتاحة لهذا الطلب؛ راجع المرتجعات المسجّلة.";draw();return;}}
    if(Math.abs(amount)>remainingOrderAmount(S.order)){S.err="المبلغ أو فرق الاستبدال يتجاوز المبلغ المتبقي من الطلب.";draw();return;}
    const rec={id:"ret-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),orderId:id,phone:phone(S.order),deliveredAt:S.deliveryDate,items:items.map(x=>({slug:x.slug,variantKey:x.variantKey,qty:x.qty,restock:S.restock[x.key]!==false,restocked:false})),reason,kind,amount,refundShipping:S.refundShipping,status:"requested",date:new Date().toISOString(),createdAt:new Date().toISOString(),note};
    S.items.unshift(rec);if(!await save()){S.items=S.items.filter(x=>x.id!==rec.id);S.err="تعذّر حفظ سجل المرتجع. " + S.err;draw();return;}
    const localOnly=S.localOnly;resetForm();S.err=localOnly?"حُفظ سجل المرتجع محلياً فقط؛ أعد الحفظ عند عودة الاتصال.":"";draw();toast(localOnly?"حُفظ طلب المرتجع محلياً":"تم حفظ طلب المرتجع");
  }
  async function changeStatus(id,next) {
    const rec=S.items.find(x=>x.id===id);if(!rec||!statusText[next])return;
    if(!(transitions[rec.status]||[]).includes(next)){S.err="انتقال الحالة غير مسموح؛ اتبع التسلسل المعروض.";draw();return;}
    const old=rec.status;
    if(next==="received"){
      if(!window.confirm("هل استلمت المنتجات المرتجعة؟ سيُضاف المخزون مرة واحدة للمنتجات التي تتبّع مخزونها.")){draw();return;}
      const updates=[];
      (rec.items||[]).forEach(it=>{const shouldRestock=it.restock!==undefined?it.restock:rec.restock!==false;if(shouldRestock&&!it.restocked){const p=(A().products||[]).find(x=>x.slug===it.slug), v=p&&it.variantKey?(p.variations||[]).find(x=>variantKey(x)===it.variantKey):null, target=v&&Object.prototype.hasOwnProperty.call(v,"stock")?v:p;if(target&&Object.prototype.hasOwnProperty.call(target,"stock")&&target.stock!=null){const before=Number(target.stock);if(Number.isFinite(before)){updates.push({p:target,before,it});target.stock=before+(Number(it.qty)||0);}}}});
      rec.status="received";
      if(updates.length){
        let published=false;try{published=typeof A().publishDataJs==="function"&&!!(await A().publishDataJs());}catch(_){published=false;}
        if(!published){updates.forEach(x=>{x.p.stock=x.before;});rec.status=old;S.err="تعذّر نشر المخزون؛ لم يُسجَّل الاستلام. تحقق من GitHub ثم أعد المحاولة.";draw();return;}
        updates.forEach(x=>{x.it.restocked=true;});
      }
      rec.receivedAt=new Date().toISOString();
      if(!await save()){S.err="نُشر المخزون، لكن تعذّر حفظ سجل المرتجع على الخادم. النسخة المحلية محفوظة؛ لا تُعد نشر المخزون.";draw();return;}
      S.err=S.localOnly?"تم نشر المخزون؛ حُفظ سجل المرتجع محلياً فقط. لا تُعد نشر المخزون.":"";draw();toast(updates.length?"تم استلام المرتجع وتحديث المخزون مرة واحدة":"تم تسجيل الاستلام؛ لم توجد منتجات ذات مخزون متتبَّع");return;
    }
    rec.status=next;if(!await save()){rec.status=old;S.err="تعذّر حفظ تغيير الحالة: "+S.err;draw();return;}
    S.err=S.localOnly?"حُفظ التغيير محلياً فقط؛ أعد الحفظ عند عودة الاتصال.":"";draw();if(S.localOnly)toast("حُفظ تغيير الحالة محلياً");
  }
  async function render() { const host=$("returns-content");if(!host)return;host.innerHTML='<div class="rt-note">جارٍ تحميل سجلّ المرتجعات…</div>';await load();draw(); }
  document.addEventListener("DOMContentLoaded",()=>{
    if(typeof Admin==="undefined"||Admin._returnsTabWrapped)return;
    const original=Admin.tab;
    Admin.tab=function(t,btn){const result=original.call(this,t,btn);const el=$("tab-returns");if(el)el.classList.toggle("hidden",t!=="returns");if(t==="returns")AdminReturns.render();return result;};
    Admin._returnsTabWrapped=true;
  });
  /* واجهة للمالية/التقارير (v1.78): المبالغ المستردة المؤكَّدة (حالة «مستردّ المبلغ» + فرق الاستبدال السالب) منذ تاريخ، وتحميل السجل عند الحاجة */
  function refundsSince(since, until) { return S.items.filter(r => { const t = new Date(r.receivedAt || r.date).getTime(); return (!since || t >= since) && (!until || t < until); }).reduce((n, r) => n + (r.status === "refunded" ? Math.max(0, Number(r.amount) || 0) : r.status === "exchanged" ? Math.max(0, -(Number(r.amount) || 0)) : 0), 0); }
  return { render, ensure: load, refunds: refundsSince, items: () => S.items, loaded: () => S.loaded };
})();

