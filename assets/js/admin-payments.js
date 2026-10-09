/* المدفوعات: تلقائية من حالة شحن شركة التوصيل (تسليم = مدفوع)، مع تعديل يدوي للصف (الاسم/الهاتف/المنتج/المبلغ/الحالة) وإضافة مدفوعات يدوية بلا طلب. كل صف في سطر واحد. لا تغيّر حالات الشحن أو المخزون. */
const AdminPayments = (() => {
  const PATH = "assets/data/payments.json", LOCAL = "admin_payments_local_v1";
  const $ = id => document.getElementById(id), A = () => typeof Admin !== "undefined" ? Admin : {};
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const money = n => Math.round(Number(n) || 0).toLocaleString("fr-DZ") + " دج";
  const today = () => new Date().toISOString().slice(0, 10);
  const labels = { unpaid:"غير مدفوع", paid:"مدفوع", refunded:"مستردّ" };
  const methods = { cod:"الدفع عند الاستلام", ccp:"CCP", baridimob:"بريدي موب", cash:"نقداً" };
  const S = { byOrder:{}, manual:[], sha:null, loaded:false, loading:false, saving:false, localOnly:false, filter:"all", query:"", selected:new Set(), drafts:{}, err:"", add:null, addOpen:false };

  function decode(raw) { return JSON.parse(decodeURIComponent(escape(atob(String(raw || "").replace(/\s/g, ""))))); }
  function encode(value) { return btoa(unescape(encodeURIComponent(JSON.stringify(value, null, 2)))); }
  function local() { try { return JSON.parse(localStorage.getItem(LOCAL) || "null"); } catch (_) { return null; } }
  function pack() { return { byOrder:S.byOrder, manual:S.manual, updatedAt:S.updatedAt || "" }; }
  function backup() { try { localStorage.setItem(LOCAL, JSON.stringify(pack())); return true; } catch (_) { return false; } }
  function take(d) { S.byOrder=d.byOrder&&typeof d.byOrder==="object"?d.byOrder:{}; S.manual=Array.isArray(d.manual)?d.manual:[]; S.updatedAt=d.updatedAt||""; }
  async function load() {
    if (S.loaded || S.loading) return;
    S.loading=true; let remote=false;
    try {
      if (typeof PHPAPI !== "undefined" && PHPAPI.on()) {
        const r=await PHPAPI.call("file", { method:"GET" }, "&path="+encodeURIComponent(PATH)+"&t="+Date.now());
        if (r.ok && r.j && r.j.content) { take(decode(r.j.content)); S.sha=r.j.sha; remote=true; }
      } else if (typeof GH !== "undefined" && GH.cfg && GH.cfg() && GH.cfg().token) {
        const f=await GH.getFile(PATH); take(decode(f.content)); S.sha=f.sha; remote=true;
      }
    } catch (_) { }
    const l=local();
    if (l && l.byOrder && (!remote || String(l.updatedAt||"")>String(S.updatedAt||""))) take(l);
    S.localOnly=!remote; S.loaded=true; S.loading=false;
  }
  async function save() {
    if (S.saving) return false;
    S.saving=true; S.updatedAt=new Date().toISOString(); let persistedRemote=false; const hadBackup=backup(), body=encode(pack());
    try {
      if (typeof PHPAPI !== "undefined" && PHPAPI.on()) {
        const r=await PHPAPI.call("file", { method:"PUT", body:JSON.stringify({ path:PATH, content:body, sha:S.sha, message:"حفظ حالات الدفع" }) });
        if (!r.ok) throw new Error(r.j&&(r.j.error||r.j.message)||"تعذّر حفظ البيانات");
        S.sha=r.j.content&&r.j.content.sha||S.sha;
        persistedRemote=true;
      } else if (typeof GH !== "undefined" && GH.cfg && GH.cfg() && GH.cfg().token) {
        const r=await GH.putFile(PATH,body,S.sha,"حفظ حالات الدفع"); S.sha=r&&r.content&&r.content.sha||S.sha;
        persistedRemote=true;
      } else { localStorage.setItem(LOCAL,JSON.stringify(pack())); S.localOnly=true; }
      if (persistedRemote) S.localOnly=false; S.saving=false; return true;
    } catch (e) {
      S.saving=false; S.localOnly=hadBackup; S.err="تعذّر حفظ حالات الدفع"+(hadBackup?"؛ حُفظت محلياً في هذا المتصفح":"")+": "+(e.message||""); return hadBackup;
    }
  }
  function id(o) { return String(o&&(o.id||o.orderId||o.number)||""); }
  function status(o) { return String(o&&o.status||"").toLowerCase(); }
  function productOf(o) { try { const L=A().orderLines&&A().orderLines(o)||[]; if(L.length) return L.map(l=>(l.p&&l.p.title||"")+(l.qty>1?" ×"+l.qty:"")).join("، "); } catch (_) { } return String(o.product||o.items||""); }
  /* عناصر الجدول: طلبات الموقع + المدفوعات اليدوية (m…) بنفس الشكل */
  function items() {
    const os=(A().orders||[]).filter(o=>o&&id(o)).map(o=>({ o, id:id(o), date:o.date||"", name:o.name||"", phone:o.phone||"", product:productOf(o), total:Number(o.total)||0, ship:status(o), manual:false }));
    const ms=(S.manual||[]).map(m=>({ o:m, id:String(m.id), date:m.date||"", name:m.name||"", phone:m.phone||"", product:m.product||"", total:Number(m.total)||0, ship:"", manual:true }));
    return os.concat(ms);
  }
  /* السجلّ الفعّال: يدوي إن وُجد (status محفوظ) وإلا تلقائي من شركة التوصيل: تسليم = مدفوع */
  function autoRec(it) {
    if (it.ship==="livree") { const dv=A().deliveredOf?A().deliveredOf(it.o):""; return { status:"paid", amount:it.total, date:dv||String(it.date||"").slice(0,10), method:"cod", note:"", auto:true }; }
    return { status:"unpaid", amount:0, date:"", method:"cod", note:"", auto:true };
  }
  function rawRec(it) { return S.byOrder[it.id]; }
  function isMan(it) { const r=rawRec(it); return !!(r && r.status); }
  function record(it) {
    const r=rawRec(it), base=r&&r.status?Object.assign({},r):autoRec(it);
    if (it.manual && !(r&&r.status)) Object.assign(base,{status:"paid",amount:it.total,method:"cash",date:it.date,auto:false});
    return base;
  }
  function view(it) { const r=rawRec(it)||{}, ov=r.ov||{}; return { name:ov.name!=null?ov.name:it.name, phone:ov.phone!=null?ov.phone:it.phone, product:ov.product!=null?ov.product:it.product, total:ov.total!=null?Number(ov.total):it.total }; }
  function amount(it, r) { return Number(r.amount)>0?Number(r.amount):view(it).total; }
  function filtered() {
    const q=S.query.trim().toLowerCase(), qd=q.replace(/\D/g, "");
    return items().filter(it=>{ const r=record(it), v=view(it), m=S.filter==="all"||r.status===S.filter; return m&&(!q||it.id.toLowerCase().includes(q)||String(v.name).toLowerCase().includes(q)||String(v.product).toLowerCase().includes(q)||String(v.phone).toLowerCase().includes(q)||(qd&&String(v.phone).replace(/\D/g, "").includes(qd))); });
  }
  function totals() {
    const is=items();
    return { received:is.filter(it=>record(it).status==="paid").reduce((n,it)=>n+amount(it,record(it)),0), pending:is.filter(it=>it.ship==="expediee"&&record(it).status==="unpaid").reduce((n,it)=>n+view(it).total,0), refunded:is.filter(it=>record(it).status==="refunded").reduce((n,it)=>n+amount(it,record(it)),0) };
  }
  function draftFor(it) { return S.drafts[it.id] || Object.assign({},record(it),{ name:view(it).name, phone:view(it).phone, product:view(it).product, total:view(it).total }); }
  function csv() {
    const rows=[["id","date","name","phone","product","shipStatus","paymentStatus","amount","method","source","note"],...filtered().map(it=>{const r=draftFor(it);return[it.id,it.date||"",r.name,r.phone,r.product,it.manual?"manual":it.ship,r.status,r.amount,r.method,it.manual?"manual":(isMan(it)?"edited":"auto"),r.note||""];})];
    const body="﻿"+rows.map(row=>row.map(v=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"').join(",")).join("\r\n");
    const a=document.createElement("a"), u=URL.createObjectURL(new Blob([body],{type:"text/csv;charset=utf-8"})); a.href=u; a.download="payments.csv"; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1000);
  }
  function addForm() {
    const a=S.add||(S.add={ name:"", phone:"", product:"", total:"", method:"cash", date:today(), note:"" });
    return `<div class="pm-add"><b>＋ دفعة يدوية</b><input class="pm-n" id="pm-a-name" placeholder="الاسم" value="${esc(a.name)}"><input class="pm-p" id="pm-a-phone" dir="ltr" placeholder="الهاتف" value="${esc(a.phone)}"><input class="pm-pr" id="pm-a-prod" placeholder="المنتج (يدوي)" value="${esc(a.product)}"><input class="pm-a" id="pm-a-total" type="number" min="1" placeholder="المبلغ" value="${esc(a.total)}"><select id="pm-a-method">${Object.keys(methods).map(k=>`<option value="${k}"${k===a.method?" selected":""}>${methods[k]}</option>`).join("")}</select><input class="pm-d" id="pm-a-date" type="date" value="${esc(a.date)}"><input class="pm-nt" id="pm-a-note" placeholder="ملاحظة" value="${esc(a.note)}"><button id="pm-a-ok" type="button" class="pm-btn pm-primary">إضافة</button><button id="pm-a-no" type="button" class="pm-btn">إلغاء</button></div>`;
  }
  function row(it) {
    const r=draftFor(it), oid=esc(it.id), src=it.manual?'<span class="pm-src pm-man">يدوي</span>':(isMan(it)?'<span class="pm-src pm-man" title="عُدّل يدوياً؛ زر ↺ يعيده للتلقائي">معدَّل</span>':'<span class="pm-src pm-auto" title="من حالة شحن شركة التوصيل">⚡ تلقائي</span>');
    return `<tr data-id="${oid}"><td><input class="pm-check" type="checkbox" data-id="${oid}"${S.selected.has(it.id)?" checked":""}></td><td dir="ltr">#${oid.replace(/^m/,"M")} · ${esc(String(it.date||"").slice(0,10))}</td><td><input class="pm-name" data-id="${oid}" type="text" value="${esc(r.name)}"></td><td><input class="pm-phone" data-id="${oid}" dir="ltr" type="text" value="${esc(r.phone)}"></td><td><input class="pm-prod" data-id="${oid}" type="text" value="${esc(r.product)}"></td><td>${it.manual?"—":esc((A().ST_AR&&A().ST_AR[it.ship])||it.ship||"—")}</td><td>${it.manual?`<input class="pm-total" data-id="${oid}" type="number" min="1" value="${Math.max(0,Number(r.total)||0)}" style="width:95px">`:money(r.total)}</td><td>${src}</td><td><select class="pm-status" data-id="${oid}">${Object.keys(labels).map(k=>`<option value="${k}"${k===r.status?" selected":""}>${labels[k]}</option>`).join("")}</select></td><td><input class="pm-amount" data-id="${oid}" type="number" min="0" step="1" value="${Math.max(0,Number(r.amount)||0)}"></td><td><select class="pm-method" data-id="${oid}">${Object.keys(methods).map(k=>`<option value="${k}"${k===(r.method||"cod")?" selected":""}>${methods[k]}</option>`).join("")}</select></td><td><input class="pm-date" data-id="${oid}" type="date" value="${esc(String(r.date||"").slice(0,10))}"></td><td><input class="pm-note-input" data-id="${oid}" type="text" maxlength="300" value="${esc(r.note||"")}"></td><td><button class="pm-btn pm-mini pm-save" type="button" data-id="${oid}" ${S.saving?"disabled":""}>حفظ</button>${it.manual?` <button class="pm-btn pm-mini pm-del" type="button" data-id="${oid}" title="حذف">🗑</button>`:(isMan(it)?` <button class="pm-btn pm-mini pm-reset" type="button" data-id="${oid}" title="إعادة للتلقائي">↺</button>`:"")}</td></tr>`;
  }
  function draw() {
    const host=$("payments-content"); if(!host)return;
    const t=totals(), list=filtered();
    host.innerHTML=`<style>#pm{display:grid;gap:14px;color:#fff}#pm *{box-sizing:border-box}#pm .pm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}#pm .pm-card{padding:15px;border:1px solid rgba(255,255,255,.14);border-radius:17px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025));box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 10px 24px rgba(0,0,0,.22)}#pm .pm-stat small{display:block;color:#b4c9be}#pm .pm-stat b{display:block;margin-top:5px;font-size:1.2rem}#pm .pm-head,#pm .pm-tools{display:flex;align-items:center;justify-content:space-between;gap:9px;flex-wrap:wrap}#pm input,#pm select,#pm textarea{padding:8px 10px;border:1px solid rgba(255,255,255,.17);border-radius:10px;color:#fff;background:rgba(255,255,255,.07);font:inherit}#pm select option{background:#10231b;color:#fff}#pm input[type=checkbox]{width:18px;height:18px}#pm .pm-tools input[type=search]{min-width:200px;flex:1}#pm .pm-btn{padding:9px 13px;border-radius:12px;color:#fff;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),inset 0 -5px 9px rgba(0,0,0,.2),0 5px 13px rgba(0,0,0,.22);backdrop-filter:blur(8px);font:inherit;font-weight:800;cursor:pointer;transition:transform .18s,background .18s}#pm .pm-btn:hover{transform:translateY(-2px);background:rgba(255,255,255,.13)}#pm .pm-primary{background:rgba(74,222,128,.18);border-color:rgba(134,239,172,.42)}#pm .pm-table{overflow:auto}#pm table{width:100%;min-width:1500px;border-collapse:collapse}#pm td,#pm th{white-space:nowrap}#pm th,#pm td{text-align:start;padding:8px;border-bottom:1px solid rgba(255,255,255,.1);vertical-align:middle}#pm th{color:#b4c9be;font-size:.84rem}#pm td input[type=number]{width:105px}#pm td input[type=date]{width:145px}#pm td input[type=text]{width:130px}#pm td input.pm-name{width:140px}#pm td input.pm-phone{width:112px}#pm td input.pm-prod{width:170px}#pm td input.pm-note-input{width:150px}#pm td select{max-width:130px}#pm .pm-src{font-size:.78rem;font-weight:800;padding:3px 8px;border-radius:99px;border:1px solid rgba(255,255,255,.2)}#pm .pm-auto{color:#86efac;border-color:rgba(134,239,172,.45)}#pm .pm-man{color:#fcd34d;border-color:rgba(252,211,77,.45)}#pm .pm-add{display:flex;gap:8px;align-items:center;flex-wrap:nowrap;overflow:auto;padding:10px;border:1px dashed rgba(134,239,172,.4);border-radius:14px;margin-top:10px}#pm .pm-add input,#pm .pm-add select{flex:none}#pm .pm-add .pm-n{width:150px}#pm .pm-add .pm-p{width:115px}#pm .pm-add .pm-pr{width:180px}#pm .pm-add .pm-a{width:105px}#pm .pm-add .pm-d{width:145px}#pm .pm-add .pm-nt{width:150px}#pm .pm-del{background:rgba(244,63,94,.16);border-color:rgba(253,164,175,.45)}#pm .pm-mini{padding:6px 10px}#pm td input,#pm td select{height:36px;padding:4px 8px}#pm td select.pm-status{width:125px;max-width:none}#pm td select.pm-method{width:150px;max-width:none}#pm td input[type=checkbox]{height:18px;padding:0}#pm .pm-badge{display:inline-block;padding:4px 9px;border-radius:99px;font-weight:800;background:rgba(255,255,255,.1)}#pm .pm-paid{color:#86efac}#pm .pm-refunded{color:#fda4af}#pm .pm-error{color:#ff9aa2}#pm .pm-note{color:#b4c9be;font-size:.88rem}@media(max-width:700px){#pm .pm-grid{grid-template-columns:1fr}}</style>
      <div id="pm"><div class="pm-head"><div><h2>المدفوعات</h2><div class="pm-note">⚡ تلقائية من شركة التوصيل: الطلب المسلَّم = مدفوع. عدّل أي صف يدوياً أو أضف دفعة يدوية.</div></div><div><button id="pm-add-btn" type="button" class="pm-btn pm-primary">＋ دفعة يدوية</button> <button id="pm-export" type="button" class="pm-btn">تصدير CSV</button></div></div>
      <div class="pm-grid"><div class="pm-card pm-stat"><small>المبالغ المستلمة</small><b>${money(t.received)}</b></div><div class="pm-card pm-stat"><small>مبالغ لدى شركة التوصيل (قيد التوصيل)</small><b>${money(t.pending)}</b></div><div class="pm-card pm-stat"><small>المبالغ المستردّة</small><b>${money(t.refunded)}</b></div></div>
      <section class="pm-card"><div class="pm-tools"><input id="pm-search" type="search" placeholder="بحث برقم الطلب أو الاسم أو الهاتف أو المنتج" value="${esc(S.query)}"><select id="pm-filter"><option value="all"${S.filter==="all"?" selected":""}>كل الحالات</option><option value="unpaid"${S.filter==="unpaid"?" selected":""}>غير مدفوع</option><option value="paid"${S.filter==="paid"?" selected":""}>مدفوع</option><option value="refunded"${S.filter==="refunded"?" selected":""}>مسترد</option></select><button id="pm-bulk-paid" type="button" class="pm-btn pm-primary" ${S.selected.size?"":"disabled"}>تعليم المحدّد كمدفوع (${S.selected.size})</button><button id="pm-export2" type="button" class="pm-btn">تصدير CSV</button></div>${S.addOpen?addForm():""}${S.err?`<p class="pm-error">${esc(S.err)}</p>`:""}<div class="pm-table"><table><thead><tr><th><input id="pm-all" type="checkbox" aria-label="تحديد الكل"></th><th>رقم / تاريخ</th><th>الاسم</th><th>الهاتف</th><th>المنتج</th><th>الشحن</th><th>المبلغ</th><th>المصدر</th><th>حالة الدفع</th><th>المسجّل</th><th>الطريقة</th><th>تاريخ الدفع</th><th>ملاحظة</th><th></th></tr></thead><tbody>${list.length?list.map(row).join(""):`<tr><td colspan="14" class="pm-note">لا توجد مدفوعات تطابق البحث.</td></tr>`}</tbody></table></div><p class="pm-note">تغيير حالة الدفع لا يغيّر حالة الشحن أو المخزون. الاسترداد يُسجَّل يدوياً لطلب مدفوع أو مسلَّم.</p></section></div>`;
    const search=$("pm-search"); if(search)search.oninput=()=>{const pos=search.selectionStart;S.query=search.value;draw();const n=$("pm-search");if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(_){}}};
    const filter=$("pm-filter"); if(filter)filter.onchange=()=>{S.filter=filter.value;S.selected.clear();draw();};
    const all=$("pm-all"); if(all)all.onchange=()=>{list.forEach(it=>all.checked?S.selected.add(it.id):S.selected.delete(it.id));draw();};
    host.querySelectorAll(".pm-check").forEach(el=>el.onchange=()=>{el.checked?S.selected.add(el.dataset.id):S.selected.delete(el.dataset.id);draw();});
    host.querySelectorAll(".pm-status,.pm-amount,.pm-method,.pm-date,.pm-note-input,.pm-name,.pm-phone,.pm-prod,.pm-total").forEach(el=>el.onchange=()=>{const it=items().find(x=>x.id===el.dataset.id);if(!it)return;const d=draftFor(it),c=el.classList;if(c.contains("pm-status"))d.status=el.value;else if(c.contains("pm-amount"))d.amount=Math.round(Number(el.value)||0);else if(c.contains("pm-method"))d.method=el.value;else if(c.contains("pm-date"))d.date=el.value;else if(c.contains("pm-name"))d.name=el.value;else if(c.contains("pm-phone"))d.phone=el.value;else if(c.contains("pm-prod"))d.product=el.value;else if(c.contains("pm-total"))d.total=Math.round(Number(el.value)||0);else d.note=el.value;S.drafts[it.id]=d;});
    host.querySelectorAll(".pm-save").forEach(el=>el.onclick=()=>commit(el.dataset.id));
    host.querySelectorAll(".pm-del").forEach(el=>el.onclick=()=>delManual(el.dataset.id));
    host.querySelectorAll(".pm-reset").forEach(el=>el.onclick=()=>resetAuto(el.dataset.id));
    const bulk=$("pm-bulk-paid");if(bulk)bulk.onclick=bulkPaid;
    [$("pm-export"),$("pm-export2")].filter(Boolean).forEach(el=>el.onclick=csv);
    const ab=$("pm-add-btn");if(ab)ab.onclick=()=>{S.addOpen=!S.addOpen;draw();};
    if(S.addOpen){
      const rd=()=>{const a=S.add||(S.add={});a.name=$("pm-a-name").value;a.phone=$("pm-a-phone").value;a.product=$("pm-a-prod").value;a.total=$("pm-a-total").value;a.method=$("pm-a-method").value;a.date=$("pm-a-date").value;a.note=$("pm-a-note").value;return a;};
      ["pm-a-name","pm-a-phone","pm-a-prod","pm-a-total","pm-a-method","pm-a-date","pm-a-note"].forEach(k=>{const e=$(k);if(e)e.onchange=rd;});
      $("pm-a-no").onclick=()=>{S.addOpen=false;S.add=null;draw();};
      $("pm-a-ok").onclick=async()=>{const a=rd(),tot=Math.round(Number(a.total)||0);if(!(tot>0)||!String(a.name).trim()&&!String(a.product).trim()){S.err="أدخل الاسم أو المنتج ومبلغاً أكبر من صفر.";draw();return;}
        const mid="m"+Date.now().toString(36);S.manual.push({id:mid,date:a.date||today(),name:String(a.name).trim().slice(0,80),phone:String(a.phone).trim().slice(0,30),product:String(a.product).trim().slice(0,160),total:tot});
        S.byOrder[mid]={status:"paid",amount:tot,date:a.date||today(),method:methods[a.method]?a.method:"cash",note:String(a.note||"").slice(0,300),manual:true};
        S.add=null;S.addOpen=false;S.err="";const ok=await save();S.err=ok?(S.localOnly?"حُفظ محلياً فقط؛ لم يصل إلى الخادم.":""):S.err;draw();};
    }
  }
  async function commit(oid) {
    const it=items().find(x=>x.id===oid); if(!it)return;
    const cur=record(it), auto=autoRec(it), d=Object.assign({},cur,S.drafts[oid]||{}), V=view(it);
    const ov={ name:String(d.name==null?V.name:d.name).slice(0,80), phone:String(d.phone==null?V.phone:d.phone).slice(0,30), product:String(d.product==null?V.product:d.product).slice(0,160) };
    let total=it.manual?Math.round(Number(d.total)||0):V.total;
    if(it.manual&&!(total>0)){S.err="مبلغ الدفعة اليدوية يجب أن يكون أكبر من صفر.";draw();return;}
    d.amount=Math.round(Number(d.amount)||0);
    if(d.amount<0||d.amount>total){S.err="المبلغ المسجّل يجب أن يكون بين صفر ومجموع الطلب.";draw();return;}
    if(d.status==="refunded"&&cur.status!=="paid"&&it.ship!=="livree"&&!it.manual){S.err="لا يمكن تسجيل استرداد لطلب غير مدفوع وغير مسلَّم.";draw();return;}
    if(d.status!==cur.status&&!d.date&&(d.status==="paid"||d.status==="refunded"))d.date=today();
    if(d.status==="paid"&&d.amount===0)d.amount=total;
    if(d.status==="refunded"&&d.amount===0)d.amount=cur.amount>0?cur.amount:total;
    d.method=methods[d.method]?d.method:"cod";d.note=String(d.note||"").slice(0,300);
    const prev=S.byOrder[oid]||{}, changedPay=!(d.status===auto.status&&d.amount===(auto.amount||0)&&(d.method||"cod")===auto.method&&String(d.note||"")===""&&(d.date||"")===(auto.date||""));
    const rec={ ov };
    if(it.manual){ const m=S.manual.find(x=>String(x.id)===oid); if(m){m.name=ov.name;m.phone=ov.phone;m.product=ov.product;m.total=total;} delete rec.ov; }
    if(it.manual||changedPay||isMan(it)){ Object.assign(rec,{status:d.status,amount:d.amount,date:d.date||"",method:d.method,note:d.note,manual:true}); }
    if(!it.manual&&!rec.status&&ov.name===it.name&&ov.phone===it.phone&&ov.product===it.product)delete S.byOrder[oid];
    else S.byOrder[oid]=Object.assign({},prev,rec);
    delete S.drafts[oid];S.err="";
    const ok=await save();S.err=ok?(S.localOnly?"حُفظ محلياً فقط؛ لم يصل إلى الخادم.":""):S.err;draw();
  }
  async function resetAuto(oid) { if(!confirm("إعادة هذا الصف للحالة التلقائية من شركة التوصيل (يُمسح التعديل اليدوي)؟"))return; delete S.byOrder[oid];delete S.drafts[oid];const ok=await save();S.err=ok?"":S.err;draw(); }
  async function delManual(oid) { if(!confirm("حذف هذه الدفعة اليدوية؟"))return; S.manual=S.manual.filter(x=>String(x.id)!==oid);delete S.byOrder[oid];delete S.drafts[oid];S.selected.delete(oid);const ok=await save();S.err=ok?"":S.err;draw(); }
  async function bulkPaid() {
    const chosen=[...S.selected], is=items().filter(it=>chosen.includes(it.id));
    if(!is.length)return;
    is.forEach(it=>{const r=Object.assign({},record(it),S.drafts[it.id]||{}),V=view(it),prev=S.byOrder[it.id]||{};r.status="paid";if(!(Number(r.amount)>0))r.amount=V.total;if(!r.date)r.date=today();r.method=methods[r.method]?r.method:"cod";S.byOrder[it.id]=Object.assign({},prev,{status:r.status,amount:r.amount,date:r.date,method:r.method,note:r.note||"",manual:true});delete S.drafts[it.id];});
    S.selected.clear();S.err="";const ok=await save();S.err=ok?(S.localOnly?"حُفظت التغييرات محلياً فقط؛ لم تصل إلى الخادم.":""):S.err;draw();
  }
  async function render() { const host=$("payments-content");if(!host)return;host.innerHTML='<p class="pm-note">جارٍ تحميل سجلات الدفع…</p>';await load();draw(); }
  document.addEventListener("DOMContentLoaded",()=>{
    if(typeof Admin==="undefined"||Admin._paymentsTabWrapped)return;
    const original=Admin.tab;Admin.tab=function(t,btn){const result=original.call(this,t,btn),el=$("tab-payments");if(el)el.classList.toggle("hidden",t!=="payments");if(t==="payments")AdminPayments.render();return result;};Admin._paymentsTabWrapped=true;
  });
  return { render, items, record, view, autoRec, S };
})();
