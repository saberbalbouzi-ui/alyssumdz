/* حالة الدفع اليدوية لطلبات الدفع عند الاستلام. لا تغيّر حالات الشحن أو المخزون. */
const AdminPayments = (() => {
  const PATH = "assets/data/payments.json", LOCAL = "admin_payments_local_v1";
  const $ = id => document.getElementById(id), A = () => typeof Admin !== "undefined" ? Admin : {};
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const money = n => Math.round(Number(n) || 0).toLocaleString("fr-DZ") + " دج";
  const today = () => new Date().toISOString().slice(0, 10);
  const labels = { unpaid:"غير مدفوع", paid:"مدفوع", refunded:"مستردّ" };
  const methods = { cod:"الدفع عند الاستلام", ccp:"CCP", baridimob:"بريدي موب", cash:"نقداً" };
  const S = { byOrder:{}, sha:null, loaded:false, loading:false, saving:false, localOnly:false, filter:"all", query:"", selected:new Set(), drafts:{}, err:"" };

  function decode(raw) { return JSON.parse(decodeURIComponent(escape(atob(String(raw || "").replace(/\s/g, ""))))); }
  function encode(value) { return btoa(unescape(encodeURIComponent(JSON.stringify(value, null, 2)))); }
  function local() { try { return JSON.parse(localStorage.getItem(LOCAL) || "null"); } catch (_) { return null; } }
  function backup() { try { localStorage.setItem(LOCAL, JSON.stringify({ byOrder:S.byOrder, updatedAt:S.updatedAt || "" })); return true; } catch (_) { return false; } }
  async function load() {
    if (S.loaded || S.loading) return;
    S.loading=true; let remote=false;
    try {
      if (typeof PHPAPI !== "undefined" && PHPAPI.on()) {
        const r=await PHPAPI.call("file", { method:"GET" }, "&path="+encodeURIComponent(PATH)+"&t="+Date.now());
        if (r.ok && r.j && r.j.content) { const d=decode(r.j.content); S.byOrder=d.byOrder&&typeof d.byOrder==="object"?d.byOrder:{}; S.sha=r.j.sha; S.updatedAt=d.updatedAt||""; remote=true; }
      } else if (typeof GH !== "undefined" && GH.cfg && GH.cfg() && GH.cfg().token) {
        const f=await GH.getFile(PATH), d=decode(f.content); S.byOrder=d.byOrder&&typeof d.byOrder==="object"?d.byOrder:{}; S.sha=f.sha; S.updatedAt=d.updatedAt||""; remote=true;
      }
    } catch (_) { }
    const l=local();
    if (l && l.byOrder && (!remote || String(l.updatedAt||"")>String(S.updatedAt||""))) { S.byOrder=l.byOrder; S.updatedAt=l.updatedAt||""; }
    if (!remote && !l) S.byOrder={};
    S.localOnly=!remote; S.loaded=true; S.loading=false;
  }
  async function save() {
    if (S.saving) return false;
    S.saving=true; S.updatedAt=new Date().toISOString(); let persistedRemote=false; const hadBackup=backup(), body=encode({ byOrder:S.byOrder, updatedAt:S.updatedAt });
    try {
      if (typeof PHPAPI !== "undefined" && PHPAPI.on()) {
        const r=await PHPAPI.call("file", { method:"PUT", body:JSON.stringify({ path:PATH, content:body, sha:S.sha, message:"حفظ حالات الدفع" }) });
        if (!r.ok) throw new Error(r.j&&(r.j.error||r.j.message)||"تعذّر حفظ البيانات");
        S.sha=r.j.content&&r.j.content.sha||S.sha;
        persistedRemote=true;
      } else if (typeof GH !== "undefined" && GH.cfg && GH.cfg() && GH.cfg().token) {
        const r=await GH.putFile(PATH,body,S.sha,"حفظ حالات الدفع"); S.sha=r&&r.content&&r.content.sha||S.sha;
        persistedRemote=true;
      } else { localStorage.setItem(LOCAL,JSON.stringify({ byOrder:S.byOrder, updatedAt:S.updatedAt })); S.localOnly=true; }
      if (persistedRemote) S.localOnly=false; S.saving=false; return true;
    } catch (e) {
      S.saving=false; S.localOnly=hadBackup; S.err="تعذّر حفظ حالات الدفع"+(hadBackup?"؛ حُفظت محلياً في هذا المتصفح":"")+": "+(e.message||""); return hadBackup;
    }
  }
  function id(o) { return String(o&&(o.id||o.orderId||o.number)||""); }
  function orders() { return (A().orders||[]).filter(o=>o&&id(o)); }
  function status(o) { return String(o&&o.status||"").toLowerCase(); }
  function record(o) { return S.byOrder[id(o)] || { status:"unpaid", amount:0, date:"", method:"cod", note:"" }; }
  function amount(o, r) { return Number(r.amount)>0?Number(r.amount):Number(o&&o.total)||0; }
  function filtered() {
    const q=S.query.trim().toLowerCase(), qd=q.replace(/\D/g, "");
    return orders().filter(o=>{ const r=record(o), matches=S.filter==="all"||r.status===S.filter; return matches&&(!q||id(o).toLowerCase().includes(q)||String(o.name||"").toLowerCase().includes(q)||String(o.phone||"").toLowerCase().includes(q)||(qd&&String(o.phone||"").replace(/\D/g, "").includes(qd))); });
  }
  function totals() {
    const os=orders();
    return { received:os.filter(o=>record(o).status==="paid").reduce((n,o)=>n+amount(o,record(o)),0), pending:os.filter(o=>status(o)==="livree"&&record(o).status==="unpaid").reduce((n,o)=>n+(Number(o.total)||0),0), refunded:os.filter(o=>record(o).status==="refunded").reduce((n,o)=>n+amount(o,record(o)),0) };
  }
  function draftFor(o) { return S.drafts[id(o)] || Object.assign({},record(o)); }
  function csv() {
    const rows=[["orderId","date","name","phone","orderStatus","paymentStatus","amount","method","note"],...filtered().map(o=>{const r=draftFor(o);return[id(o),o.date||"",o.name||"",o.phone||"",status(o),r.status,r.amount,r.method,r.note||""];})];
    const body="\uFEFF"+rows.map(row=>row.map(v=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"').join(",")).join("\r\n");
    const a=document.createElement("a"), u=URL.createObjectURL(new Blob([body],{type:"text/csv;charset=utf-8"})); a.href=u; a.download="payments.csv"; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1000);
  }
  function draw() {
    const host=$("payments-content"); if(!host)return;
    const t=totals(), list=filtered();
    host.innerHTML=`<style>#pm{display:grid;gap:14px;color:#fff}#pm *{box-sizing:border-box}#pm .pm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}#pm .pm-card{padding:15px;border:1px solid rgba(255,255,255,.14);border-radius:17px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025));box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 10px 24px rgba(0,0,0,.22)}#pm .pm-stat small{display:block;color:#b4c9be}#pm .pm-stat b{display:block;margin-top:5px;font-size:1.2rem}#pm .pm-head,#pm .pm-tools{display:flex;align-items:center;justify-content:space-between;gap:9px;flex-wrap:wrap}#pm input,#pm select,#pm textarea{padding:8px 10px;border:1px solid rgba(255,255,255,.17);border-radius:10px;color:#fff;background:rgba(255,255,255,.07);font:inherit}#pm select option{background:#10231b;color:#fff}#pm input[type=checkbox]{width:18px;height:18px}#pm .pm-tools input[type=search]{min-width:200px;flex:1}#pm .pm-btn{padding:9px 13px;border-radius:12px;color:#fff;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),inset 0 -5px 9px rgba(0,0,0,.2),0 5px 13px rgba(0,0,0,.22);backdrop-filter:blur(8px);font:inherit;font-weight:800;cursor:pointer;transition:transform .18s,background .18s}#pm .pm-btn:hover{transform:translateY(-2px);background:rgba(255,255,255,.13)}#pm .pm-primary{background:rgba(74,222,128,.18);border-color:rgba(134,239,172,.42)}#pm .pm-table{overflow:auto}#pm table{width:100%;min-width:1160px;border-collapse:collapse}#pm th,#pm td{text-align:start;padding:8px;border-bottom:1px solid rgba(255,255,255,.1);vertical-align:middle}#pm th{color:#b4c9be;font-size:.84rem}#pm td input[type=number]{width:105px}#pm td input[type=date]{width:145px}#pm td input[type=text]{width:145px}#pm .pm-badge{display:inline-block;padding:4px 9px;border-radius:99px;font-weight:800;background:rgba(255,255,255,.1)}#pm .pm-paid{color:#86efac}#pm .pm-refunded{color:#fda4af}#pm .pm-error{color:#ff9aa2}#pm .pm-note{color:#b4c9be;font-size:.88rem}@media(max-width:700px){#pm .pm-grid{grid-template-columns:1fr}}</style>
      <div id="pm"><div class="pm-head"><div><h2>المدفوعات</h2><div class="pm-note">تتبّع يدوي للتحصيل والاسترداد لطلبات الدفع عند الاستلام</div></div><button id="pm-export" type="button" class="pm-btn">تصدير CSV</button></div>
      <div class="pm-grid"><div class="pm-card pm-stat"><small>المبالغ المستلمة</small><b>${money(t.received)}</b></div><div class="pm-card pm-stat"><small>مبالغ معلّقة لدى شركة التوصيل</small><b>${money(t.pending)}</b></div><div class="pm-card pm-stat"><small>المبالغ المستردّة</small><b>${money(t.refunded)}</b></div></div>
      <section class="pm-card"><div class="pm-tools"><input id="pm-search" type="search" placeholder="بحث برقم الطلب أو الاسم أو الهاتف" value="${esc(S.query)}"><select id="pm-filter"><option value="all"${S.filter==="all"?" selected":""}>كل الحالات</option><option value="unpaid"${S.filter==="unpaid"?" selected":""}>غير مدفوع</option><option value="paid"${S.filter==="paid"?" selected":""}>مدفوع</option><option value="refunded"${S.filter==="refunded"?" selected":""}>مسترد</option></select><button id="pm-bulk-paid" type="button" class="pm-btn pm-primary" ${S.selected.size?"":"disabled"}>تعليم المحدّد كمدفوع (${S.selected.size})</button><button id="pm-export2" type="button" class="pm-btn">تصدير CSV</button></div>${S.err?`<p class="pm-error">${esc(S.err)}</p>`:""}<div class="pm-table"><table><thead><tr><th><input id="pm-all" type="checkbox" aria-label="تحديد الكل"></th><th>رقم الطلب / التاريخ</th><th>الزبون</th><th>حالة الشحن</th><th>المبلغ</th><th>حالة الدفع</th><th>المبلغ المسجّل</th><th>الطريقة</th><th>تاريخ الدفع</th><th>ملاحظة</th><th>حفظ</th></tr></thead><tbody>${list.length?list.map(o=>{const oid=id(o),r=draftFor(o),st=status(o);return `<tr data-id="${esc(oid)}"><td><input class="pm-check" type="checkbox" data-id="${esc(oid)}"${S.selected.has(oid)?" checked":""}></td><td dir="ltr">#${esc(oid)}<br><small>${esc(o.date||"")}</small></td><td>${esc(o.name||"—")}<br><small dir="ltr">${esc(o.phone||"")}</small></td><td>${esc(st||"—")}</td><td>${money(o.total)}</td><td><select class="pm-status" data-id="${esc(oid)}">${Object.keys(labels).map(k=>`<option value="${k}"${k===r.status?" selected":""}>${labels[k]}</option>`).join("")}</select></td><td><input class="pm-amount" data-id="${esc(oid)}" type="number" min="0" max="${Math.max(0,Number(o.total)||0)}" step="1" value="${Math.max(0,Number(r.amount)||0)}"></td><td><select class="pm-method" data-id="${esc(oid)}">${Object.keys(methods).map(k=>`<option value="${k}"${k===(r.method||"cod")?" selected":""}>${methods[k]}</option>`).join("")}</select></td><td><input class="pm-date" data-id="${esc(oid)}" type="date" value="${esc(r.date||"")}"></td><td><input class="pm-note-input" data-id="${esc(oid)}" type="text" maxlength="300" value="${esc(r.note||"")}"></td><td><button class="pm-btn pm-save" type="button" data-id="${esc(oid)}" ${S.saving?"disabled":""}>حفظ</button></td></tr>`;}).join(""):`<tr><td colspan="11" class="pm-note">لا توجد طلبات تطابق البحث.</td></tr>`}</tbody></table></div><p class="pm-note">تغيير حالة الدفع لا يغيّر حالة الشحن أو المخزون. يمكن تسجيل الاسترداد فقط إذا كان الطلب مدفوعاً أو مسلَّماً.</p></section></div>`;
    const search=$("pm-search"); if(search)search.oninput=()=>{const pos=search.selectionStart;S.query=search.value;draw();const n=$("pm-search");if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(_){}}};
    const filter=$("pm-filter"); if(filter)filter.onchange=()=>{S.filter=filter.value;S.selected.clear();draw();};
    const all=$("pm-all"); if(all)all.onchange=()=>{list.forEach(o=>all.checked?S.selected.add(id(o)):S.selected.delete(id(o)));draw();};
    host.querySelectorAll(".pm-check").forEach(el=>el.onchange=()=>{el.checked?S.selected.add(el.dataset.id):S.selected.delete(el.dataset.id);draw();});
    host.querySelectorAll(".pm-status,.pm-amount,.pm-method,.pm-date,.pm-note-input").forEach(el=>el.onchange=()=>{const d=draftFor(orders().find(o=>id(o)===el.dataset.id)||{});if(el.classList.contains("pm-status"))d.status=el.value;else if(el.classList.contains("pm-amount"))d.amount=Math.round(Number(el.value)||0);else if(el.classList.contains("pm-method"))d.method=el.value;else if(el.classList.contains("pm-date"))d.date=el.value;else d.note=el.value;S.drafts[el.dataset.id]=d;});
    host.querySelectorAll(".pm-save").forEach(el=>el.onclick=()=>commit(el.dataset.id));
    const bulk=$("pm-bulk-paid");if(bulk)bulk.onclick=bulkPaid;
    [$("pm-export"),$("pm-export2")].filter(Boolean).forEach(el=>el.onclick=csv);
  }
  async function commit(oid) {
    const o=orders().find(x=>id(x)===oid); if(!o)return;
    const current=record(o), d=Object.assign({},current,S.drafts[oid]||{}), total=Math.max(0,Number(o.total)||0);
    d.amount=Math.round(Number(d.amount)||0);
    if(d.amount<0||d.amount>total){S.err="المبلغ المسجّل يجب أن يكون بين صفر ومجموع الطلب.";draw();return;}
    if(d.status==="refunded"&&current.status!=="paid"&&status(o)!=="livree"){S.err="لا يمكن تسجيل استرداد لطلب غير مدفوع وغير مسلَّم.";draw();return;}
    if(d.status!==current.status&&!d.date&&(d.status==="paid"||d.status==="refunded"))d.date=today();
    if(d.status==="paid"&&d.amount===0)d.amount=total;
    if(d.status==="refunded"&&d.amount===0)d.amount=current.amount>0?current.amount:total;
    d.method=methods[d.method]?d.method:"cod";d.note=String(d.note||"").slice(0,300);
    S.byOrder[oid]=d;delete S.drafts[oid];S.err="";
    const ok=await save();S.err=ok?(S.localOnly?"حُفظ محلياً فقط؛ لم يصل إلى الخادم.":""):S.err;draw();
  }
  async function bulkPaid() {
    const chosen=[...S.selected], os=orders().filter(o=>chosen.includes(id(o)));
    if(!os.length)return;
    os.forEach(o=>{const oid=id(o),r=Object.assign({},record(o),S.drafts[oid]||{});r.status="paid";if(!(Number(r.amount)>0))r.amount=Number(o.total)||0;if(!r.date)r.date=today();r.method=methods[r.method]?r.method:"cod";S.byOrder[oid]=r;delete S.drafts[oid];});
    S.selected.clear();S.err="";const ok=await save();S.err=ok?(S.localOnly?"حُفظت التغييرات محلياً فقط؛ لم تصل إلى الخادم.":""):S.err;draw();
  }
  async function render() { const host=$("payments-content");if(!host)return;host.innerHTML='<p class="pm-note">جارٍ تحميل سجلات الدفع…</p>';await load();draw(); }
  document.addEventListener("DOMContentLoaded",()=>{
    if(typeof Admin==="undefined"||Admin._paymentsTabWrapped)return;
    const original=Admin.tab;Admin.tab=function(t,btn){const result=original.call(this,t,btn),el=$("tab-payments");if(el)el.classList.toggle("hidden",t!=="payments");if(t==="payments")AdminPayments.render();return result;};Admin._paymentsTabWrapped=true;
  });
  return { render };
})();

