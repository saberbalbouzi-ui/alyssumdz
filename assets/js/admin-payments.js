/* المدفوعات: تلقائية من حالة شحن شركة التوصيل (تسليم = مدفوع)، مع تعديل يدوي للصف (الاسم/الهاتف/المنتج/المبلغ/الحالة) وإضافة مدفوعات يدوية بلا طلب. كل صف في سطر واحد. لا تغيّر حالات الشحن أو المخزون. */
const AdminPayments = (() => {
  const PATH = "assets/data/payments.json", LOCAL = "admin_payments_local_v1";
  const $ = id => document.getElementById(id), A = () => typeof Admin !== "undefined" ? Admin : {};
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const money = n => Math.round(Number(n) || 0).toLocaleString("fr-DZ") + " دج";
  const today = () => new Date().toISOString().slice(0, 10);
  const labels = { unpaid:"غير مدفوع", paid:"مدفوع", refunded:"مستردّ" };
  const methods = { cod:"الدفع عند الاستلام", ccp:"CCP", baridimob:"بريدي موب", cash:"نقداً" };
  const S = { fetchedCo:false, byOrder:{}, manual:[], sha:null, loaded:false, loading:false, saving:false, localOnly:false, filter:"all", co:"all", query:"", selected:new Set(), drafts:{}, err:"", add:null, addOpen:false };

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
      } else if (window.AdminRoles && AdminRoles.isReadOnly()) {
        const r=await fetch(PATH+"?t="+Date.now(), { cache:"no-store" }); if (r.ok) { take(await r.json()); remote=true; }      // حساب موظف بلا ربط نشر: قراءة النسخة المنشورة
      }
    } catch (_) { }
    const l=local();
    if (l && l.byOrder && (!remote || String(l.updatedAt||"")>String(S.updatedAt||""))) take(l);
    S.localOnly=!remote; S.loaded=true; S.loading=false;
  }
  async function save() {
    if (S.saving) return false;
    if (window.AdminRoles && AdminRoles.denyWrite()) return false;
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
  const coOf = o => (typeof AdminCoStats!=="undefined"?AdminCoStats.keyOf(o):((A().trackingOf&&A().trackingOf(o)||{}).company||"none"));
  const coName = k => (typeof AdminCoStats!=="undefined"?AdminCoStats.nameOf(k):k);
  function status(o) { return String(o&&o.status||"").toLowerCase(); }
  function productOf(o) { try { const L=A().orderLines&&A().orderLines(o)||[]; if(L.length) return L.map(l=>(l.p&&l.p.title||"")+(l.qty>1?" ×"+l.qty:"")).join("، "); } catch (_) { } return String(o.product||o.items||""); }
  /* الجدول يضم الطلبات المسجَّلة عند شركة التوصيل فقط: لها رقم تتبع وحالتها مؤكَّد/في الطريق/مسلَّم/مرتجع،
     وطرفها موجود فعلاً في قائمة طرود الشركة أو في كشف الدفع المستورد (طلب بتتبع غير موجود عندها لا يظهر) */
  function inCo(o) {
    const A_=A(), st=status(o); if(!["confirmee","expediee","livree","echec"].includes(st)) return false;
    const t=A_.trackingOf?A_.trackingOf(o):null; if(!t) return false;
    if(t.company&&t.company!=="yalidine") return true;   /* شركة أخرى (WeCan وغيرها): يكفي رقم التتبع؛ قائمة طرود ياليدين لا تخصها */
    if(A_.ydActual&&A_.ydActual[t.tracking]) return true;
    const rows=(typeof AdminYd!=="undefined"&&AdminYd.S&&AdminYd.S.rows)||[];
    if(!rows.length) return A_.listCompanyKey&&A_.listCompanyKey() ? false : true;   /* شركة قراءة الطرود مفعّلة ولم تُحمَّل قائمتها: لا نخمّن، نخفي حتى تُجلب */
    return rows.some(r=>String(r.tracking)===String(t.tracking));
  }
  /* عناصر الجدول: طلبات الموقع + المدفوعات اليدوية (m…) بنفس الشكل */
  function items() {
    const os=(A().orders||[]).filter(o=>o&&id(o)&&inCo(o)).map(o=>({ o, id:id(o), date:o.date||"", name:o.name||"", phone:o.phone||"", product:productOf(o), total:Number(o.total)||0, ship:status(o), manual:false, co:coOf(o) }));
    const cutA=(typeof AdminArchive!=="undefined"&&AdminArchive.cut())||0,ms=(S.manual||[]).filter(m=>{if(!cutA)return true;const t=new Date(String(m.date||"").replace(" ","T")).getTime();return !(t&&t<cutA);}).map(m=>({ o:m, id:String(m.id), date:m.date||"", name:m.name||"", phone:m.phone||"", product:m.product||"", total:Number(m.total)||0, ship:"", manual:true, co:"manual" }));
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

  /* تسوية ياليدين كما في كشف exportation_paiement بالضبط:
     prix à ramasser (المحصَّل) = ما يدفعه الزبون (سعر + توصيل) — 0 للإرجاع وللتوصيل المجاني
     Taxe COD = نسبة COD × سعر المنتج (بلا التوصيل) · Taxe d'assurance = نسبة التأمين × القيمة المصرَّحة
     Taxe retour للإرجاع فقط (ولا يُحتسب frais livraison معه)
     net client = prix à ramasser − frais livraison − Taxe COD − Taxe assurance − Taxe retour
     الأرقام الفعلية من الكشف المستورد (ydactual) تسبق التقدير من تعريفة الشركة */
  const DEF_COD = 0.75, DEF_RET = 250; /* ثابتان بقرار صاحب المتجر: عمولة COD 0.75% من سعر المنتج، ورسم الإرجاع 250 دج */
  /* معاملة كل شركة: عمولة COD ٪ ورسم الإرجاع من «شركات التوصيل ← إعداد» (codPct/retFee)؛ بلا إعداد: ياليدين بالثابتين أعلاه وغيرها صفر (لا عمولة ولا رسم إرجاع) */
  function rates(co) { const k=co||"yalidine", cfg=((A().deliveryCfg||{})[k])||{}, n=v=>(v===undefined||v===null||v===""||!isFinite(Number(v))||Number(v)<0)?null:Number(v); const c=n(cfg.codPct), r=n(cfg.retFee); return { cod:c!=null?c:(k==="yalidine"?DEF_COD:0), ret:r!=null?r:(k==="yalidine"?DEF_RET:0) }; }
  const normS = v => String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  function settle(it) {
    if (it.manual) return null; const o=it.o, A_=A(); let st=it.ship;
    if (!["livree","echec","expediee","confirmee"].includes(st)) return null;
    { const f0=((A_.shipRaw||{})[o.id]||{}), rw=normS(f0.raw); if (f0.fin) { if (/^livr/.test(rw)) st="livree"; else if (/retourne\w* au vendeur|retour a retirer/.test(rw)) st="echec"; else if (st==="livree"||st==="echec") st="expediee"; } }      // الشركة لا تحسب المرتجع قبل «Retourné au vendeur/Retour à retirer» ولا «Tentative échouée»: يبقى معلَّقاً      // حالة الطرد الفعلية عند الشركة تسبق حالة الطلب في اللوحة (تحديث متأخر)
    const trk=A_.trackingOf?A_.trackingOf(o):null; if (st==="confirmee"&&!trk) return null;
    const act=A_.actualFees?A_.actualFees(o):null, fee=Number(o.fee)||0, total=Number(o.total)||0;
    let price, del=0, cod=0, ins=0, ret=0, net, got, src="est", pend=act&&act.pend?String(act.pend):"";
    if (act) {
      src="file"; price=Number(act.price)||0; del=Number(act.del)||0; ret=Number(act.ret)||0; ins=Number(act.ins)||0; cod=Number(act.cod)||0; net=Number(act.net)||0;
      got=Math.round((net+del+cod+ins+ret)*1000)/1000;
    } else {
      const rf=A_.realFees?A_.realFees(o):null, fin=((A_.shipRaw||{})[o.id]||{}).fin||null, RT=rates(it.co), tp=fin&&fin.tp>0?fin.tp:RT.cod; price=fin&&fin.price>0?Number(fin.price):Math.max(0,total-fee);      // أرقام الطرد الفعلية من قائمة الشركة تسبق التعريفة
      if (st==="echec") { ret=(fin&&fin.tr>0?fin.tr:RT.ret)+(it.co==='yalidine'&&A_.retLate?A_.retLate(o):0); got=0; }      // رسم الإرجاع 250 ثابت + غرامة تأخر سحب المرتجع (10 دج لكل يوم بعد 10 أيام عند الشركة)
      else {
        del=fin&&fin.fee!=null&&fin.fee>=0?Number(fin.fee):(rf&&rf.delivery!=null?Number(rf.delivery):(A_.carrierCost?A_.carrierCost(o):fee));
        cod=price*tp/100; ins=0; got=fin&&fin.price>0?price+(fin.free?0:del):total;      // الشركة: المحصَّل = سعر المنتج + رسم التوصيل (إلا الشحن المجاني)
      }
      net=got-del-cod-ins-ret;
    }
    const kind=st==="echec"?"ret":(st==="livree"?"done":"exp");
    return { price, got, del, cod, ins, ret, net, src, kind, pend, free:!(fee>0)&&st!=="echec" };
  }
  function cogs(it) { try { const A_=A(), L=A_.orderLines?A_.orderLines(it.o)||[]:[]; return L.reduce((n,l)=>n+(A_.lineCogs?A_.lineCogs(l.p&&l.p.slug,Number(l.qty)||1):(Number(A_.fin&&A_.fin.costs&&A_.fin.costs[l.p&&l.p.slug])||0)*(Number(l.qty)||1)),0); } catch (_) { return 0; } }
  function sumSettle(list, co) {
    const T={ grp:{}, got:0, net:0, netDone:0, netExp:0, retLoss:0, del:0, cod:0, ins:0, ret:0, cogs:0, pack:0, n:0, nDone:0, nExp:0, nRet:0, nFile:0 };
    const pk=Number(A().fin&&A().fin.set&&A().fin.set.packaging)||0;
    list.forEach(it=>{ if(co?it.co!==co:(it.co&&it.co!=="yalidine"))return; const x=settle(it); if(!x)return; T.n++; if(x.src==="file")T.nFile++; if(x.pend&&x.kind!=="exp"){ const G=T.grp[x.pend]||(T.grp[x.pend]={ n:0, net:0 }); G.n++; G.net+=x.net; }
      if(x.kind==="exp"){ T.netExp+=x.net; T.nExp++; return; }
      T.net+=x.net; T.del+=x.del; T.cod+=x.cod; T.ins+=x.ins; T.ret+=x.ret;
      if(x.kind==="ret"){ T.nRet++; T.retLoss+=x.ret; } else { T.nDone++; T.netDone+=x.net; T.got+=x.got; T.cogs+=cogs(it); T.pack+=pk; } });
    T.profit=T.net-T.cogs-T.pack; return T;
  }
  const dz=n=>Math.round(Number(n)||0).toLocaleString("fr-DZ");
  function settleCells(it) {
    if(it.co&&!it.manual&&it.co!=="yalidine") return '<td class="pm-note" title="التسوية التقديرية خاصة بياليدين">—</td><td>—</td>';
    const x=settle(it); if(!x) return '<td class="pm-note">—</td><td>—</td>';
    const tip=`المحصَّل ${dz(x.got)} − توصيل ${dz(x.del)} − COD ${dz(x.cod)}`+(x.ins?` − تأمين ${dz(x.ins)}`:"")+(x.ret?` − إرجاع ${dz(x.ret)}`:"")+(x.src==="file"?" (من كشف ياليدين)":" (تقدير من التعريفة)");
    const parts=x.kind==="ret"?[`إرجاع ${dz(x.ret)}`]:[`توصيل ${dz(x.del)}`,`COD ${dz(x.cod)}`].concat(x.ins?[`تأمين ${dz(x.ins)}`]:[]);
    const col=x.net<0?"#fca5a5":(x.kind==="exp"?"#fde047":"#d4ff4d");
    return `<td title="${esc(tip)}" style="font-size:.76rem;white-space:nowrap">${x.free?'<b style="color:#fdba74">توصيل مجاني</b> · ':""}${esc(parts.join(" · "))}<br><small>${x.src==="file"?"✓ كشف ياليدين":"≈ تقدير"}</small></td><td title="${esc(tip)}" style="color:${col};font-weight:700;white-space:nowrap">${dz(x.net)} دج${x.kind==="exp"?'<br><small style="font-weight:400">متوقع</small>':""}</td>`;
  }
  /* رقم التتبع الأصلي عند الشركة (yal-…) للطلب؛ فارغ للمدفوعات اليدوية */
  const trkOf = it => { try{ const t=A().trackingOf&&it.o&&!it.manual?A().trackingOf(it.o):null; return t&&t.tracking?String(t.tracking):""; }catch(_){ return ""; } };
  function view(it) { const r=rawRec(it)||{}, ov=r.ov||{}; return { name:ov.name!=null?ov.name:it.name, phone:ov.phone!=null?ov.phone:it.phone, product:ov.product!=null?ov.product:it.product, total:ov.total!=null?Number(ov.total):it.total }; }
  function amount(it, r) { return Number(r.amount)>0?Number(r.amount):view(it).total; }
  /* القائمة تُبقي ما يدخل في حساب الدفعة القادمة فقط: طرود الشركة (مسلَّم/مرتجع/في الطريق) غير المعلَّمة «مدفوع»؛ وزرّ «عرض الكل» يكشف الباقي للتراجع */
  const inNext = it => !!settle(it) && !manPaid(it) && !inFile(it);
  const baseList = () => S.all ? items() : items().filter(inNext);
  function filtered() {
    const q=S.query.trim().toLowerCase(), qd=q.replace(/\D/g, "");
    return baseList().filter(it=>{ if(S.co!=="all"&&it.co!==S.co) return false; const r=record(it), v=view(it), m=S.filter==="all"||r.status===S.filter; return m&&(!q||it.id.toLowerCase().includes(q)||trkOf(it).toLowerCase().includes(q)||String(v.name).toLowerCase().includes(q)||String(v.product).toLowerCase().includes(q)||String(v.phone).toLowerCase().includes(q)||(qd&&String(v.phone).replace(/\D/g, "").includes(qd))); });
  }
  function totals(co) {
    const is=items().filter(it=>!co||co==="all"||it.co===co);
    return { received:is.filter(it=>record(it).status==="paid").reduce((n,it)=>n+amount(it,record(it)),0), pending:is.filter(it=>it.ship==="expediee"&&record(it).status==="unpaid").reduce((n,it)=>n+view(it).total,0), refunded:is.filter(it=>record(it).status==="refunded").reduce((n,it)=>n+amount(it,record(it)),0) };
  }
  function draftFor(it) { return S.drafts[it.id] || Object.assign({},record(it),{ name:view(it).name, phone:view(it).phone, product:view(it).product, total:view(it).total }); }
  function csv() {
    const rows=[["company","tracking","id","date","name","phone","product","shipStatus","paymentStatus","amount","method","source","note"],...filtered().map(it=>{const r=draftFor(it);return[coName(it.co),trkOf(it),it.id,it.date||"",r.name,r.phone,r.product,it.manual?"manual":it.ship,r.status,r.amount,r.method,it.manual?"manual":(isMan(it)?"edited":"auto"),r.note||""];})];
    const body="﻿"+rows.map(row=>row.map(v=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"').join(",")).join("\r\n");
    const a=document.createElement("a"), u=URL.createObjectURL(new Blob([body],{type:"text/csv;charset=utf-8"})); a.href=u; a.download="payments.csv"; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1000);
  }
  function addForm() {
    const a=S.add||(S.add={ name:"", phone:"", product:"", total:"", method:"cash", date:today(), note:"" });
    return `<div class="pm-add"><b>＋ دفعة يدوية</b><input class="pm-n" id="pm-a-name" placeholder="الاسم" value="${esc(a.name)}"><input class="pm-p" id="pm-a-phone" dir="ltr" placeholder="الهاتف" value="${esc(a.phone)}"><input class="pm-pr" id="pm-a-prod" placeholder="المنتج (يدوي)" value="${esc(a.product)}"><input class="pm-a" id="pm-a-total" type="number" min="1" placeholder="المبلغ" value="${esc(a.total)}"><select id="pm-a-method">${Object.keys(methods).map(k=>`<option value="${k}"${k===a.method?" selected":""}>${methods[k]}</option>`).join("")}</select><input class="pm-d" id="pm-a-date" type="date" value="${esc(a.date)}"><input class="pm-nt" id="pm-a-note" placeholder="ملاحظة" value="${esc(a.note)}"><button id="pm-a-ok" type="button" class="pm-btn pm-primary">إضافة</button><button id="pm-a-no" type="button" class="pm-btn">إلغاء</button></div>`;
  }
  function row(it) {
    const r=draftFor(it), oid=esc(it.id), src=it.manual?'<span class="pm-src pm-man">يدوي</span>':(isMan(it)?'<span class="pm-src pm-man" title="عُدّل يدوياً؛ زر ↺ يعيده للتلقائي">معدَّل</span>':'<span class="pm-src pm-auto" title="من حالة شحن شركة التوصيل">⚡ تلقائي</span>');
    return `<tr data-id="${oid}"><td><input class="pm-check" type="checkbox" data-id="${oid}"${S.selected.has(it.id)?" checked":""}></td><td dir="ltr" title="طلب #${oid.replace(/^m/,"M")}">${trkOf(it)?esc(trkOf(it)):"#"+oid.replace(/^m/,"M")} · ${esc(String(it.date||"").slice(0,10))}${it.manual?"":`<br><small class="pm-note">${esc(coName(it.co))}</small>`}</td><td><input class="pm-name" data-id="${oid}" type="text" value="${esc(r.name)}"></td><td><input class="pm-phone" data-id="${oid}" dir="ltr" type="text" value="${esc(r.phone)}"></td><td><input class="pm-prod" data-id="${oid}" type="text" value="${esc(r.product)}"></td><td>${it.manual?"—":esc((A().ST_AR&&A().ST_AR[it.ship])||it.ship||"—")}</td><td>${it.manual?`<input class="pm-total" data-id="${oid}" type="number" min="1" value="${Math.max(0,Number(r.total)||0)}" style="width:95px">`:money(r.total)}</td>${settleCells(it)}<td>${src}</td><td><select class="pm-status" data-id="${oid}">${Object.keys(labels).map(k=>`<option value="${k}"${k===r.status?" selected":""}>${labels[k]}</option>`).join("")}</select></td><td><input class="pm-amount" data-id="${oid}" type="number" min="0" step="1" value="${Math.max(0,Number(r.amount)||0)}"></td><td><select class="pm-method" data-id="${oid}">${Object.keys(methods).map(k=>`<option value="${k}"${k===(r.method||"cod")?" selected":""}>${methods[k]}</option>`).join("")}</select></td><td><input class="pm-date" data-id="${oid}" type="date" value="${esc(String(r.date||"").slice(0,10))}"></td><td><input class="pm-note-input" data-id="${oid}" type="text" maxlength="300" value="${esc(r.note||"")}"></td><td><button class="pm-btn pm-mini pm-save" type="button" data-id="${oid}" ${S.saving?"disabled":""}>حفظ</button>${it.manual?` <button class="pm-btn pm-mini pm-del" type="button" data-id="${oid}" title="حذف">🗑</button>`:(isMan(it)?` <button class="pm-btn pm-mini pm-reset" type="button" data-id="${oid}" title="إعادة للتلقائي">↺</button>`:"")}</td></tr>`;
  }

  function totRow(list) {
    const T=sumSettle(list); if(!T.n) return "";
    return `<tfoot><tr style="font-weight:700"><td colspan="6">المجموع (${T.nDone+T.nRet} طرد منتهٍ)</td><td></td><td style="white-space:nowrap;font-size:.76rem">توصيل ${dz(T.del)} · COD ${dz(T.cod)}${T.ret?" · إرجاع "+dz(T.ret):""}</td><td style="color:${T.net<0?"#fca5a5":"#d4ff4d"};white-space:nowrap">${dz(T.net)} دج</td><td colspan="7"></td></tr></tfoot>`;
  }
  /* «Détail paiement» بنسق ياليدين نفسه (Livré / Retour، Total ramassé، Frais de recouvrement / livraison / retour / assurance، Net) لمقارنته مع كشف الشركة بالسنتيم */
  const d2=n=>(Math.round((Number(n)||0)*100)/100).toLocaleString("fr-DZ",{minimumFractionDigits:2,maximumFractionDigits:2})+" DA";
  /* كشوف الشركة المستوردة غير المدفوعة: كل مجموعة بصافيها كما عند الشركة (Pas prêt / Prochain) ثم المجموع */
  const GRP_L={ nr:"Pas prêt", next:"Prochain" };
  function grpHtml(T) {
    const g=T.grp||{}, ks=Object.keys(g).filter(k=>GRP_L[k]); if(!ks.length) return "";
    return `<div style="margin-top:.5rem;padding-top:.4rem;border-top:1px dashed rgba(255,255,255,.25)"><b>مطابقة كشوف الشركة (أرقام فعلية)</b>${ks.map(k=>`<div class="pm-dl"><span>${GRP_L[k]} · ${g[k].n} طرد</span><span dir="ltr">${d2(g[k].net)}</span></div>`).join("")}<div class="pm-dl"><span><b>المجموع</b></span><span dir="ltr"><b>${d2(ks.reduce((n,k)=>n+g[k].net,0))}</b></span></div></div>`;
  }
  function detailBlock(T) {
    const row=(l,v,k)=>`<div class="pm-dl"><span>${l}</span><span dir="ltr" style="color:${k}">${v}</span></div>`, net=T.realNet!=null?T.realNet:T.got-T.cod-T.del-T.ret-T.ins;      // مع الكشوف الحقيقية: مجموع صافي كل كشف كما حسبته الشركة (تقريب كل كشف على حدة)
    return `<div class="pm-card" style="margin:.6rem 0"><b>تفاصيل الدفع</b><div class="pm-note">${T.realNet!=null?"أرقام كشفَي الشركة الملصوقَين: "+T.nDone+" مسلَّم · "+T.nRet+" مرتجع":"تقدير اللوحة للطرود المنتهية غير المعلَّمة «مدفوع» ("+T.nDone+" Livré · "+T.nRet+" Retour)"}</div>${row("إجمالي المحصَّل",d2(T.got),"#60a5fa")}${row("عمولة التحصيل (COD)","-"+d2(T.cod),"#fca5a5")}${row("رسوم التوصيل","-"+d2(T.del),"#fca5a5")}${row("رسوم الإرجاع","-"+d2(T.ret),"#fca5a5")}${row("رسوم التأمين","-"+d2(T.ins),"#fca5a5")}${row("الصافي","= "+d2(net),net<0?"#fca5a5":"#d4ff4d")}${grpHtml(T)}</div>`;
  }
  /* كشوف «Détail paiement» الحقيقية من ياليدين (pas prêt / prêt à payer): تُلصق نصاً وتُحفظ؛ مجموع صافيها = المستحق الفعلي، ويُقارَن بتقدير اللوحة */
  const YP = { list:[], loaded:false, msg:"", cut:"" };
  /* طرود التسوية: من تاريخ القطع (الأقدم دُفع سابقاً فيُستثنى من التسوية لا من الأرباح) */
  /* وكذلك ما عُلِّم يدوياً «مدفوع» (تعليم المحدد كمدفوع) = قُبض سابقاً فلا يدخل في التسوية */
  /* وما ورد في كشف ياليدين المستورد (الكشف المدفوع: أرقام الشركة الفعلية لكل طرد) = مدفوع فلا يدخل في المتبقي */
  const paidCo = it => { try{ const A_=A(); return !!(A_.payState && it.o && A_.payState(((A_.shipRaw||{})[it.o.id]||{}).pay)==="paid"); }catch(_){ return false; } };      /* الشركة تقول «مدفوع» لهذا الطرد ← يخرج من المتبقي تلقائياً */
  const inFile = it => { try{ const a=A().actualFees && it.o && A().actualFees(it.o); return !!(a && !a.pend) || paidCo(it); }catch(_){ return false; } };      /* الكشف المدفوع = مستثنى؛ كشف «قادم/غير جاهز» = يبقى في المستحق بأرقام الشركة الحقيقية */
  /* علامة «مدفوع» اليدوية تُستثنى من التسوية إلا إن قالت الشركة إن الطرد ما زال Pas prêt / Prêt à payer (الشركة هي المرجع) */
  const coPending = it => { try{ const A_=A(), ps=A_.payState?A_.payState(((A_.shipRaw||{})[it.o&&it.o.id]||{}).pay):""; return ps==="notready"||ps==="ready"; }catch(_){ return false; } };
  const manPaid = it => isMan(it) && record(it).status === "paid" && !coPending(it);
  const sItems = co => items().filter(it => (co?it.co===co:(it.manual||it.co==="yalidine")) && !manPaid(it) && !inFile(it));      /* تسوية ياليدين لطرود ياليدين فقط */
  const pnum = v => Number(String(v).replace(/[\s\u00a0\u202f]/g,"").replace(",",".")) || 0;
  function parseDetail(txt) {
    const t=String(txt||"").replace(/\u00a0|\u202f/g," "), amt=l=>{ const m=t.match(new RegExp(l+"[^\\d\\-=]*([-=]?\\s*-?\\s*\\d[\\d\\s]*[,.]\\d{2})","i")); return m?pnum(m[1].replace(/[=\s]/g,"")):null; };
    const cnt=[...t.matchAll(/(\d+)\s*colis/gi)].map(m=>+m[1]), r={ livre:cnt[0]||0, retour:cnt[1]||0, got:amt("Total\\s*ramass"), cod:amt("Frais\\s*de\\s*recouvrement"), del:amt("Frais\\s*de\\s*livraison"), ret:amt("Frais\\s*de\\s*retour"), ins:amt("Frais\\s*d.assurance"), net:amt("\\bNet") };
    if(r.got==null||r.net==null) return null; ["cod","del","ret","ins"].forEach(k=>{ r[k]=Math.abs(r[k]||0); }); return r;
  }
  async function ydLoad() { if(YP.loaded) return; YP.loaded=true; try{ const v=await Priv.get("ydpay",[]); YP.list=Array.isArray(v)?v:[]; const c=await Priv.get("ydcut",""); YP.cut=/^\d{4}-\d{2}-\d{2}$/.test(String(c))?String(c):""; }catch(_){ } }
  async function ydSave() { try{ await Priv.set("ydpay",YP.list); }catch(_){ } }
  function ydReal() {
    return null;      /* أُلغي لصق كشوف «Détail paiement» وتاريخ القطع (v1.89.737) */
    if(!YP.list.length) return null; const z={ got:0, cod:0, del:0, ret:0, ins:0, net:0, livre:0, retour:0 };
    const act=YP.list.filter(x=>x.state!=="paid"); if(!act.length) return null; act.forEach(x=>{ Object.keys(z).forEach(k=>{ z[k]+=Number(x[k])||0; }); }); return z;
  }
  /* تجميع تلقائي من حالة الدفع لكل طرد عند الشركة (Pas prêt / Prêt à payer) إن أرسلتها في قائمة الطرود؛ مرتجع «Non payé» يدخل مع دفعة «prêt à payer» */
  function autoGroups() {
    const A_=A(), g={}, init=()=>({ got:0, cod:0, del:0, ret:0, ins:0, net:0, livre:0, retour:0 }); let any=0;
    sItems().forEach(it=>{ const raw=(A_.shipRaw||{})[it.o&&it.o.id], ps=A_.payState?A_.payState(raw&&raw.pay):""; if(!ps) return; any++;
      const x=settle(it); if(!x||(x.kind!=="done"&&x.kind!=="ret")) return; const key=ps==="notready"?"notready":(ps==="ready"||(ps==="unpaid"&&x.kind==="ret"))?"ready":null; if(!key) return;
      const G=g[key]||(g[key]=init()); G.got+=x.got; G.cod+=x.cod; G.del+=x.del; G.ret+=x.ret; G.ins+=x.ins; G.net+=x.net; if(x.kind==="ret") G.retour++; else G.livre++; });
    let rows=0, withPay=0, keys=""; try{ const R=(typeof AdminYd!=="undefined"&&AdminYd.S&&AdminYd.S.raw)||[]; rows=R.length; R.forEach(r=>{ if(r.pay) withPay++; if(!keys&&r.payKeys) keys=r.payKeys; }); }catch(_){ }
    return { any, g, rows, withPay, keys };
  }
  function ydPayCard() {
    const nf=n=>(Math.round((Number(n)||0)*100)/100).toLocaleString("fr-DZ",{minimumFractionDigits:2,maximumFractionDigits:2}), tot=YP.list.filter(x=>x.state!=="paid").reduce((n,x)=>n+x.net,0), est=sumSettle(sItems()).net;
    const E=sumSettle(sItems()), R=ydReal(), cmp=R?[["المحصَّل (Total ramassé)",E.got,R.got],["Frais de recouvrement (COD)",E.cod,R.cod],["Frais de livraison",E.del,R.del],["Frais de retour",E.ret,R.ret],["Frais d'assurance",E.ins,R.ins],["الصافي (Net)",E.net,R.net],["عدد Livré",E.nDone,R.livre],["عدد Retour",E.nRet,R.retour]]:[];
    const cmpHtml=R?`<div style="overflow:auto;margin-top:.6rem"><table style="border-collapse:collapse;min-width:360px"><thead><tr><th style="text-align:start">البند</th><th>اللوحة</th><th>ياليدين</th><th>الفرق</th></tr></thead><tbody>${cmp.map(([l,a,b])=>{ const d=Math.round((a-b)*100)/100, cnt=/عدد/.test(l); return `<tr><td style="white-space:nowrap;padding:.25rem .5rem">${l}</td><td dir="ltr" style="padding:.25rem .5rem;white-space:nowrap">${cnt?a:nf(a)}</td><td dir="ltr" style="padding:.25rem .5rem;white-space:nowrap">${cnt?b:nf(b)}</td><td dir="ltr" style="padding:.25rem .5rem;white-space:nowrap;font-weight:700;color:${Math.abs(d)<0.02?"#d4ff4d":"#fca5a5"}">${Math.abs(d)<0.02?"مطابق":(cnt?d:nf(d))}</td></tr>`; }).join("")}</tbody></table></div><div class="pm-note">المقارنة مع كل الطرود المنتهية في اللوحة. لتتطابق الأرقام كلها (الأرباح والإحصاءات) استورد ملف exportation_paiement من حساب الشركة: يحمل أرقام كل طرد على حدة فتعتمدها اللوحة في كل مكان؛ والكشف الملصوق مجموع فقط ولا يمكن توزيعه على الطلبات.</div>`:"";
    const act=YP.list.map((x,i)=>({x,i})).filter(o=>o.x.state!=="paid"), hist=YP.list.map((x,i)=>({x,i})).filter(o=>o.x.state==="paid"), histTot=hist.reduce((n,o)=>n+o.x.net,0);
    const AG=autoGroups(), gl={ notready:"pas prêt", ready:"prêt à payer" }, ag=Object.keys(AG.g);
    const agHtml=AG.any&&ag.length?`<div style="margin:.5rem 0;padding:.6rem;border:1px dashed rgba(255,255,255,.25);border-radius:12px"><b>تلقائي من حالة الدفع لكل طرد عند الشركة</b><div style="overflow:auto"><table style="border-collapse:collapse;margin-top:.3rem"><tbody>${ag.map(k=>{ const G=AG.g[k]; return `<tr><td style="padding:.2rem .5rem;white-space:nowrap">${gl[k]}</td><td style="padding:.2rem .5rem;white-space:nowrap">${G.livre} Livré · ${G.retour} Retour</td><td dir="ltr" style="padding:.2rem .5rem;white-space:nowrap">${nf(G.got)} − ${nf(G.cod)} − ${nf(G.del)} − ${nf(G.ret)}</td><td dir="ltr" style="padding:.2rem .5rem;font-weight:800">${nf(G.net)}</td></tr>`; }).join("")}</tbody></table></div><div class="pm-note">تقدير من أرقام كل طرد (الصافي ${nf(ag.reduce((n,k)=>n+AG.g[k].net,0))} DA). الأدق لصق الكشفين، أو اعتماد هذه الأرقام ثم تعديلها.</div><button type="button" class="pm-btn pm-yauto" style="margin-top:.3rem">اعتماد كالكشفين</button></div>`:(AG.rows&&!AG.withPay?`<div class="pm-note">قائمة طرود ياليدين لم تُرسل حالة الدفع (Pas prêt / Prêt à payer) في ردّها${AG.keys?" — حقول تخصّ الدفع: "+esc(AG.keys):""}؛ فلصق الكشفين يدوي.</div>`:"");
    const rows=act.map(({x,i})=>`<tr><td>${x.state==="ready"?"prêt à payer":"pas prêt"}</td><td>${x.livre} / ${x.retour}</td><td dir="ltr">${nf(x.got)}</td><td dir="ltr">-${nf(x.cod)}</td><td dir="ltr">-${nf(x.del)}</td><td dir="ltr">-${nf(x.ret)}</td><td dir="ltr">-${nf(x.ins)}</td><td dir="ltr"><b>${nf(x.net)}</b></td><td style="white-space:nowrap"><button type="button" class="pm-btn pm-ypaid" data-i="${i}">تم القبض</button> <button type="button" class="pm-btn pm-ydel" data-i="${i}">حذف</button></td></tr>`).join("");
    return `<section class="pm-card" data-noco><div class="pm-head" style="margin:0 0 8px"><div><b>المستحق الفعلي (Détail paiement)</b><div class="pm-note">انسخ نافذة «Détail paiement» من حسابك في ياليدين (مرة لـ«pas prêt» ومرة لـ«prêt à payer») والصقها هنا، فتظهر أرقام الشركة نفسها.</div></div></div>
      <div class="pm-row" style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin:.3rem 0"><label style="display:flex;gap:.4rem;align-items:center">كشوف الشركة الحالية تخص الطرود المسجّلة من <input type="date" id="pm-ycut" value="${esc(YP.cut)}" style="width:auto"></label>${YP.cut?'<button type="button" class="pm-btn" id="pm-ycut0">إلغاء التاريخ</button>':""}</div><div class="pm-note">الطرود الأقدم من هذا التاريخ، وما علّمتَه «مدفوع» في القائمة أسفل (تعليم المحدد كمدفوع)، دُفع لك سابقاً فيُستثنى من التسوية والمقارنة (لا من الأرباح والإحصاءات).</div>
      ${agHtml}
      ${act.length?`<div style="font-size:1.25rem;font-weight:900;color:#d4ff4d;margin:.3rem 0" dir="ltr">${nf(tot)} DA</div><div class="pm-note">المستحق الفعلي (مجموع الصافي) · تقدير اللوحة ${nf(est)} DA · الفرق ${nf(est-tot)} DA</div><div style="overflow:auto"><table style="border-collapse:collapse;margin-top:.4rem"><thead><tr><th>الحالة</th><th>Livré/Retour</th><th>Total ramassé</th><th>recouvrement</th><th>livraison</th><th>retour</th><th>assurance</th><th>Net</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>${cmpHtml}`:""}${hist.length?`<div class="pm-note" style="margin-top:.5rem">مقبوض سابقاً (${hist.length} كشف): <b dir="ltr">${nf(histTot)} DA</b> <button type="button" class="pm-btn pm-yhis" style="padding:3px 9px">${YP.showHist?"إخفاء":"عرض"}</button></div>${YP.showHist?`<table style="border-collapse:collapse;margin-top:.3rem"><tbody>${hist.map(({x,i})=>`<tr><td style="padding:.2rem .5rem">${new Date(x.paidAt||x.at).toLocaleDateString("fr-DZ")}</td><td style="padding:.2rem .5rem">${x.livre} Livré / ${x.retour} Retour</td><td dir="ltr" style="padding:.2rem .5rem">${nf(x.net)}</td><td><button type="button" class="pm-btn pm-ydel" data-i="${i}">حذف</button></td></tr>`).join("")}</tbody></table>`:""}`:""}
      <div class="pm-row" style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:flex-start;margin-top:.5rem"><select id="pm-yst" style="min-width:140px"><option value="notready">pas prêt</option><option value="ready">prêt à payer</option></select><textarea id="pm-ytx" rows="3" placeholder="الصق هنا نص Détail paiement" style="flex:1;min-width:200px"></textarea><button type="button" class="pm-btn pm-primary" id="pm-yadd">إضافة الكشف</button></div>${YP.msg?`<div class="pm-note" style="color:#fca5a5">${esc(YP.msg)}</div>`:""}</section>`;
  }
  /* الطرود الراجعة المحسوبة في رسوم الإرجاع: لكل طلب فاشل مرحلته عند الشركة (للتعرّف على الطرد الذي لا يظهر في كشف ياليدين) */
  function retList() {
    const A_=A(), PHL={ transit:"في طريق العودة", ready:"جاهز للسحب عند الشركة", received:"عاد للبائع", "":"غير محدّدة عند الشركة" };
    const L=sItems().filter(it=>{ const x=settle(it); return x&&x.kind==="ret"; }).map(it=>{ const x=settle(it), ph=A_.returnPhase?A_.returnPhase(it.o):"", raw=((A_.shipRaw||{})[it.o.id]||{}).raw||""; return { id:String(it.o.id).slice(-6), name:it.o.name||"", ph, raw, fee:x.ret }; });
    if(!L.length) return "";
    return `<details style="margin-top:.6rem"><summary style="cursor:pointer;font-weight:800;color:#e2fe17">طرود الإرجاع المحسوبة (${L.length}) — قارنها بكشف ياليدين</summary><div style="overflow:auto"><table style="border-collapse:collapse;margin-top:.3rem"><tbody>${L.map(r=>`<tr><td style="padding:.2rem .5rem;white-space:nowrap">#${esc(r.id)}</td><td style="padding:.2rem .5rem;white-space:nowrap">${esc(r.name)}</td><td style="padding:.2rem .5rem;white-space:nowrap;color:${r.ph==="received"?"#d4ff4d":"#fdba74"}">${PHL[r.ph]||""}${r.raw?" · "+esc(r.raw):""}</td><td dir="ltr" style="padding:.2rem .5rem">${dz(r.fee)}</td></tr>`).join("")}</tbody></table></div><div class="pm-note">إن كان عند ياليدين عدد أقل (مثلاً 3) فالطرد الزائد غالباً لم يصل بعد أو دُفع في دفعة سابقة. علّم المدفوع سابقاً «مدفوع» من القائمة أدناه فيُستثنى.</div></details>`;
  }
  /* طرود «في الطريق» في اللوحة: قد يكون أحدها سُلّم عند الشركة ولم تتحدّث حالته هنا فينقص المسلَّم والمحصَّل عن كشف الشركة */
  function expList() {
    const A_=A(), L=sItems().filter(it=>{ const x=settle(it); return x&&x.kind==="exp"; }).map(it=>({ id:String(it.o.id).slice(-6), name:it.o.name||"", wil:it.o.wilaya||"", total:Number(it.o.total)||0, raw:((A_.shipRaw||{})[it.o.id]||{}).raw||"" }));
    if(!L.length) return "";
    return `<details style="margin-top:.6rem"><summary style="cursor:pointer;font-weight:800;color:#e2fe17">طرود في الطريق (${L.length}) — قد يكون أحدها سُلّم عند الشركة</summary><div style="overflow:auto"><table style="border-collapse:collapse;margin-top:.3rem"><tbody>${L.map(r=>`<tr><td style="padding:.2rem .5rem;white-space:nowrap">#${esc(r.id)}</td><td style="padding:.2rem .5rem;white-space:nowrap">${esc(r.name)}</td><td style="padding:.2rem .5rem;white-space:nowrap">${esc(r.wil)}</td><td dir="ltr" style="padding:.2rem .5rem;white-space:nowrap;font-weight:700">${dz(r.total)}</td><td style="padding:.2rem .5rem;white-space:nowrap;color:#fdba74">${esc(r.raw)}</td></tr>`).join("")}</tbody></table></div><div class="pm-note">إن كان مبلغ أحدها يساوي فرق المحصَّل عن ياليدين فهو غالباً سُلّم هناك؛ حدّث حالات الطرود من «المسجلة» (تحديث الحالات).</div></details>`;
  }
  /* جدول مقارنة: كشفا الشركة (Pas prêt + Prêt à payer) مجموعَين مقابل حساب المنصة، مع الفرق لكل بند، واقتراح الطرود التي تفسّر فرق العدد والمبلغ */
  /* مجاميع الشركة مباشرة من قائمة طرودها (AdminYd.S.raw) حسب payment_status: not-ready = Pas prêt، ready = Prêt à payer؛ تطابق نافذتَي «Détail paiement» بالسنتيم:
     Livré: المحصَّل = السعر + رسم التوصيل، COD = السعر × النسبة، الصافي = المحصَّل − COD − التوصيل؛ «Retourné au vendeur» و«Retour à retirer»: رسم الإرجاع (taxe_retour) */
  function carrierGroups() {
    const A_=A(), R=(typeof AdminYd!=="undefined"&&AdminYd.S&&AdminYd.S.raw)||[], z=()=>({ livre:0, retour:0, got:0, cod:0, del:0, ret:0, ins:0, net:0, rows:[] }), g={ notready:z(), ready:z() }; let any=0;
    R.forEach(r=>{ const ps=A_.payState?A_.payState(r.pay):""; if(ps!=="notready"&&ps!=="ready") return; const G=g[ps], sn=normS(r.status);
      if(/^livr/.test(sn)){ const price=Number(r.price)||0, fee=Number(r.fee)||0, tp=r.taxe>0?r.taxe:rates('yalidine').cod, got=price+(r.free?0:fee), cod=price*tp/100; G.livre++; G.got+=got; G.cod+=cod; G.del+=fee; G.net+=got-cod-fee; G.rows.push(r); any++; }
      else if(/retourne\w* au vendeur|retour a retirer/.test(sn)){ const t=r.taxeRet>0?r.taxeRet:rates('yalidine').ret; G.retour++; G.ret+=t; G.net-=t; G.rows.push(r); any++; } });
    return { g, any };
  }
  function cmpCard() {
    const CG=carrierGroups(), apiOn=CG.any>0, st=apiOn?[Object.assign({ state:"notready" },CG.g.notready),Object.assign({ state:"ready" },CG.g.ready)].filter(x=>x.livre||x.retour):YP.list.filter(x=>x.state!=="paid"), np=st.find(x=>x.state==="notready"), rd=st.find(x=>x.state==="ready"), K=["livre","retour","got","cod","del","ret","ins","net"];
    const C={}; K.forEach(k=>{ C[k]=st.reduce((n,x)=>n+(Number(x[k])||0),0); });
    const T=sumSettle(sItems()), P={ livre:T.nDone, retour:T.nRet, got:T.got, cod:T.cod, del:T.del, ret:T.ret, ins:T.ins, net:T.net };
    const f=(k,v)=>v==null?"—":(k==="livre"||k==="retour")?String(v)+" colis":d2(v), cell=(k,v)=>`<td dir="ltr" style="padding:.3rem .5rem;white-space:nowrap;text-align:end">${f(k,v)}</td>`;
    const L={ livre:"Livré", retour:"Retour", got:"Total ramassé", cod:"Frais de recouvrement", del:"Frais de livraison", ret:"Frais de retour", ins:"Frais d'assurance", net:"Net" };
    const rows=st.length?K.map(k=>{ const d=Math.round((C[k]-P[k])*100)/100, col=Math.abs(d)<0.005?"#86efac":"#fca5a5", sg=d>0?"+":""; return `<tr style="${k==="net"?"font-weight:800;border-top:1px solid rgba(255,255,255,.25)":""}"><td style="padding:.3rem .5rem;white-space:nowrap">${L[k]}</td>${cell(k,np?np[k]:null)}${cell(k,rd?rd[k]:null)}${cell(k,C[k])}${cell(k,P[k])}<td dir="ltr" style="padding:.3rem .5rem;white-space:nowrap;text-align:end;color:${col};font-weight:700">${Math.abs(d)<0.005?"✓ 0":sg+((k==="livre"||k==="retour")?d+" colis":d2(d))}</td></tr>`; }).join(""):"";
    /* اقتراح: طرود في اللوحة لا تُحسب مسلَّمة (في الطريق/معلَّمة مدفوعة) مجموع مبالغها = فرق المحصَّل وعددها = فرق المسلَّم */
    let cand="";
    if(st.length&&!apiOn){ const dl=C.livre-P.livre, dg=Math.round((C.got-P.got)*100)/100;
      if(dl>0&&dl<=3&&dg>0){ const A_=A(), pool=items().filter(it=>{ const x=settle(it); return (x&&x.kind==="exp")||(manPaid(it)&&!inFile(it)&&it.ship==="livree"); }).slice(0,60), val=it=>Number(it.o&&it.o.total)||0, out=[];
        const rec=(i,left,sum,pick)=>{ if(out.length>=5) return; if(!left){ if(Math.abs(sum-dg)<0.5) out.push(pick.slice()); return; } for(let j=i;j<pool.length;j++){ pick.push(pool[j]); rec(j+1,left-1,sum+val(pool[j]),pick); pick.pop(); } };
        rec(0,dl,0,[]);
        cand=out.length?`<div style="margin-top:.5rem"><b>طرود محتملة تفسّر الفرق (${dl} طرد بمجموع ${d2(dg)})</b>${out.map(g=>`<div class="pm-note" style="margin:.25rem 0">${g.map(it=>{ const raw=((A_.shipRaw||{})[it.o.id]||{}).raw||""; return `#${esc(String(it.o.id).slice(-6))} · ${esc(it.o.name||"")} · ${esc(it.o.wilaya||"")} · ${dz(val(it))} دج${raw?" · "+esc(raw):""}`; }).join("<br>")}</div>`).join('<div style="border-top:1px dashed rgba(255,255,255,.2)"></div>')}<div class="pm-note">غالباً سُلّمت عند الشركة ولم تتحدّث حالتها هنا (أو عُلّمت «مدفوع» بالخطأ): حدّث الحالات من «المسجلة».</div></div>`:`<div class="pm-note" style="margin-top:.5rem">الشركة تحسب ${dl} طرد مسلَّم أكثر منا بمجموع ${d2(dg)}، ولا توجد في طرود اللوحة (في الطريق/المعلَّمة مدفوعة) مجموعة تطابق المبلغ؛ قد يكون الطرد غير مسجَّل عندنا أو بمبلغ معدَّل.</div>`; }
    }
    let missH=""; if(apiOn){ try{ const A_=A(), map={}, inS=new Set(sItems().map(x=>x.id)); items().forEach(it=>{ const t=A_.trackingOf?A_.trackingOf(it.o):null; if(t&&t.tracking) map[String(t.tracking)]=it; }); const L=[];
        ["notready","ready"].forEach(k=>CG.g[k].rows.forEach(r=>{ const it=map[String(r.tracking)]; let why=""; if(!it) why="غير موجود في طلباتك (أُدخل عند الشركة مباشرة أو لم يُربط)"; else if(!inS.has(it.id)) why=manPaid(it)?"علّمتَه «مدفوع» يدوياً عندنا":(inFile(it)?"مستثنى كمدفوع في كشف مستورد":"مستثنى"); else { const x=settle(it); if(!x||x.kind==="exp") why="حالة الطلب عندنا: "+((A_.ST_AR&&A_.ST_AR[it.ship])||it.ship||"—"); } if(why) L.push({ r, why, k }); }));
        missH=L.length?`<div style="margin-top:.5rem"><b>طرود تحسبها الشركة ولا نحسبها (${L.length})</b>${L.map(x=>`<div class="pm-note" style="margin:.25rem 0"><span dir="ltr">${esc(String(x.r.tracking))}</span> · ${esc(x.r.name||"")} · ${esc(x.r.wilaya||"")} · ${dz(x.r.price)} دج · ${esc(x.r.status||"")} · ${x.k==="ready"?"Prêt à payer":"Pas prêt"}<br><b style="color:#fdba74">${esc(x.why)}</b></div>`).join("")}</div>`:`<div class="pm-note" style="margin-top:.5rem">✓ كل طرود الشركة في الكشفين محسوبة عندنا.</div>`; }catch(_){ } }
    const lst=st.length&&!apiOn?`<div class="pm-note" style="margin-top:.4rem">${st.map(x=>`${x.state==="ready"?"prêt à payer":"pas prêt"} <button type="button" class="pm-btn pm-ydel" data-i="${YP.list.indexOf(x)}" style="padding:2px 9px">حذف</button>`).join(" · ")}</div>`:"";
    /* تلقائي: تجميع الطرود حسب حالة الدفع التي ترسلها الشركة لكل طرد (not-ready = Pas prêt، ready = Prêt à payer) بلا لصق */
    let autoH=""; try{ const AG=autoGroups(), gs=["notready","ready"].filter(k=>AG.g[k]);
      if(gs.length){ const Z={}; K.forEach(k=>{ Z[k]=gs.reduce((n,g)=>n+(AG.g[g][k]||0),0); });
        autoH=`<div style="margin-top:.4rem"><b>تلقائياً من حالة الدفع عند الشركة</b><div style="overflow:auto"><table style="border-collapse:collapse;margin-top:.3rem"><thead><tr style="opacity:.75"><th style="padding:.3rem .5rem;text-align:start">البند</th>${gs.map(g=>`<th style="padding:.3rem .5rem">${g==="ready"?"Prêt à payer":"Pas prêt"}</th>`).join("")}<th style="padding:.3rem .5rem">المجموع</th></tr></thead><tbody>${K.map(k=>`<tr style="${k==="net"?"font-weight:800;border-top:1px solid rgba(255,255,255,.25)":""}"><td style="padding:.3rem .5rem;white-space:nowrap">${L[k]}</td>${gs.map(g=>cell(k,AG.g[g][k])).join("")}${cell(k,Z[k])}</tr>`).join("")}</tbody></table></div><div class="pm-note">من حالة كل طرد وأرقامه الفعلية (توصيل، نسبة COD، رسم الإرجاع) كما ترسلها الشركة؛ والطرود التي حالتها عندهم «مدفوع» لا تدخل. تتحدّث مع كل تحديث للطرود.</div></div>`; } }catch(_){ }
    return `<section class="pm-card"><div class="pm-head" style="margin:0 0 8px"><div><b>⚖️ المنصة مقابل الشركة</b><div class="pm-note">${apiOn?"عمودا الشركة من قائمة طرودها مباشرة حسب حالة الدفع (تطابق نافذتَي «Détail paiement»)؛ والمنصة = حساب طلباتك. الفرق يفسّره قسم الطرود أدناه.":"الصق نص كل نافذة «Détail paiement» (Pas prêt ثم Prêt à payer)؛ يُجمع الكشفان ويُقارَن مجموعهما بحساب المنصة بنداً بنداً."}</div></div></div>
      ${apiOn?"":autoH}
      ${st.length?`<div style="overflow:auto"><table style="border-collapse:collapse;margin-top:.3rem"><thead><tr style="opacity:.75"><th style="padding:.3rem .5rem;text-align:start">البند</th><th style="padding:.3rem .5rem">Pas prêt</th><th style="padding:.3rem .5rem">Prêt à payer</th><th style="padding:.3rem .5rem">مجموع الشركة</th><th style="padding:.3rem .5rem">المنصة</th><th style="padding:.3rem .5rem">الفرق</th></tr></thead><tbody>${rows}</tbody></table></div>${apiOn?missH:cand}${lst}`:'<div class="pm-note">لم يُضَف أي كشف بعد.</div>'}
      ${apiOn?"":`      <div class="pm-row" style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:flex-start;margin-top:.5rem"><select id="pm-yst" style="min-width:140px"><option value="notready">pas prêt</option><option value="ready">prêt à payer</option></select><textarea id="pm-ytx" rows="3" placeholder="الصق هنا نص Détail paiement" style="flex:1;min-width:200px"></textarea><button type="button" class="pm-btn pm-primary" id="pm-yadd">إضافة الكشف</button></div>${YP.msg?`<div class="pm-note" style="color:#fca5a5">${esc(YP.msg)}</div>`:""}</section>`}`;
  }
  /* تسوية الشركات الأخرى (غير ياليدين) بمعاملتها: الصافي = المحصَّل − رسم التوصيل − عمولة التحصيل (٪ من سعر المنتج) − رسم الإرجاع، والنسبتان من إعداد الشركة */
  function coSettleCards() {
    let keys=[]; try{ keys=Object.keys((A().allDeliveryCompanies&&A().allDeliveryCompanies())||{}).filter(k=>k!=="yalidine"); }catch(_){}
    return keys.filter(k=>S.co==="all"||S.co===k).map(k=>{ const L=sItems(k); if(!L.length) return ""; const T=sumSettle(L,k), R=rates(k), nm=esc(coName(k));
      return `<section class="pm-card" data-noco><div class="pm-head" style="margin:0 0 8px"><div><b>🧾 تسوية ${nm}</b><div class="pm-note">الصافي = المحصَّل من الزبون − رسم التوصيل − عمولة التحصيل (${R.cod}% من سعر المنتج) − رسم الإرجاع (${R.ret} دج لكل مرتجع). غيّر النسبتين من شركات التوصيل ← ⚙️ إعداد ${nm}. المتبقي عند الشركة: ${T.n} طرد (تقدير).</div></div></div>${detailBlock(T)}</section>`; }).join("");
  }
  /* «الصافي» لكل شركة (كما في «تفاصيل الدفع»): المحصَّل − العمولة − التوصيل − الإرجاع − التأمين؛ للصفحة الرئيسية */
  function coNets() {
    let ks=[]; try{ ks=Object.keys((A().allDeliveryCompanies&&A().allDeliveryCompanies())||{}); }catch(_){}
    if(ks.indexOf("yalidine")<0) ks.unshift("yalidine"); else ks=["yalidine"].concat(ks.filter(k=>k!=="yalidine"));
    return ks.map(k=>{ const y=k==="yalidine", L=sItems(y?undefined:k); if(!L.length) return null; const T=y?sumSettle(L):sumSettle(L,k); return { k, net:T.net, got:T.got, n:T.n, nDone:T.nDone, nRet:T.nRet, netExp:T.netExp, nExp:T.nExp }; }).filter(Boolean);
  }
  function settleCard() {
    let T=sumSettle(sItems()); const R=ydReal();
    /* كشوف الشركة الحقيقية الملصوقة تحلّ محل التقدير في كل الأرقام (المحصَّل، التوصيل، COD، الإرجاع، الصافي، عدد الطرود) */
    if(R) T=Object.assign({},T,{ got:R.got, cod:R.cod, del:R.del, ret:R.ret, ins:R.ins, net:R.net, realNet:R.net, retLoss:R.ret, nDone:R.livre, nRet:R.retour, nFile:T.n, profit:R.net-T.cogs-T.pack });
    const M=v=>R?d2(v):dz(v)+" دج";
    if(!T.n&&!R) return `<section class="pm-card" data-noco><b>🧾 تسوية ياليدين</b><p class="pm-note">لا طلبات مسجَّلة بعد. عند التسجيل تظهر هنا الأرقام تلقائياً؛ ولأدقّ النتائج استورد كشف الدفع من حساب ياليدين.</p><button id="pm-imp" type="button" class="pm-btn pm-primary">📥 استيراد كشف ياليدين (xlsx / csv)</button></section>`;
    const c=(l,v,k,t)=>`<div class="pm-card pm-stat"${t?` title="${esc(t)}"`:""}><small>${l}</small><b${k?` style="color:${k}"`:""}>${v}</b></div>`;
    return `<section class="pm-card" data-noco><div class="pm-head" style="margin:0 0 8px"><div><b>🧾 تسوية ياليدين</b><div class="pm-note">الصافي = المحصَّل من الزبون − رسم التوصيل − عمولة COD (${rates('yalidine').cod}% من سعر المنتج — تُعدَّل من شركات التوصيل ← إعداد)؛ والمرتجع يخسر رسم الإرجاع (${rates('yalidine').ret} دج) + 10 دج عن كل يوم تأخّر فيه سحبه أكثر من 10 أيام عند الشركة. المتبقي عند الشركة: ${T.n} طرد (تقدير من التعريفة)${(()=>{ const p=items().filter(it=>inFile(it)&&settle(it)).length; return p?` · ${p} طرد مدفوع في الكشف المستورد مُستثنى`:""; })()}.</div></div><div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap"><select id="pm-impst" title="نوع الكشف الذي ستستورده" style="width:auto"><option value="paid"${S.impState==="paid"||!S.impState?" selected":""}>كشف مدفوع</option><option value="next"${S.impState==="next"?" selected":""}>كشف قادم (Prochain)</option><option value="nr"${S.impState==="nr"?" selected":""}>كشف غير جاهز (Pas prêt)</option></select><button id="pm-imp" type="button" class="pm-btn pm-primary">📥 استيراد كشف ياليدين</button></div></div>
      ${detailBlock(T)}
      ${retList()}
      ${expList()}
      <div class="pm-grid" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        ${c("إجمالي المحصَّل ("+T.nDone+" طرد مسلَّم)",dz(T.got)+" دج","#60a5fa","ما يجمعه ياليدين من الزبائن للطرود المسلَّمة المتبقية (Total ramassé)")}
        ${c("صافي ما يخصّك (مسلَّم + مرتجع)",M(T.net),T.net<0?"#fca5a5":"#d4ff4d","مثل «صافي الكشف» في كشف ياليدين")}
        ${c("رسوم التوصيل المدفوعة لياليدين",M(T.del))}
        ${c("عمولة COD"+(T.ins?" + التأمين":""),M(T.cod+T.ins))}
        ${c("رسوم الإرجاع ("+T.nRet+")",M(T.retLoss),"#fdba74")}
        ${c("تكلفة منتجات المسلَّم",dz(T.cogs)+" دج",null,"من تبويب «تكلفة المنتجات»")}
        ${c("التغليف",dz(T.pack)+" دج")}
        ${c("الربح النهائي (بعد التكلفة والتغليف)",dz(T.profit)+" دج",T.profit<0?"#fca5a5":"#d4ff4d","الإعلان لا يدخل هنا؛ تجده في «المخزون والأرباح»")}
        ${c("صافٍ متوقع (في الطريق: "+T.nExp+")",dz(T.netExp)+" دج","#fde047")}
      </div></section>`;
  }
  /* ملخص كل شركة: عدد الطلبات، المدفوع (العدد والمبلغ)، قيد التوصيل، المستردّ، المرتجع */
  function coStats() {
    const by={}, seen=[];
    items().forEach(it=>{ const k=it.co||"none"; if(!by[k]){ by[k]={n:0,paidN:0,received:0,pending:0,refunded:0,retN:0}; seen.push(k); } const g=by[k], r=record(it);
      g.n++; if(r.status==="paid"){ g.paidN++; g.received+=amount(it,r); } if(it.ship==="expediee"&&r.status==="unpaid") g.pending+=view(it).total; if(r.status==="refunded") g.refunded+=amount(it,r); if(it.ship==="echec") g.retN++; });
    const real=seen.filter(k=>k!=="manual"&&k!=="none"), keys=(typeof AdminCoStats!=="undefined"?AdminCoStats.keysFor(real).filter(k=>k!=="none"):real); keys.forEach(k=>{ if(!by[k]) by[k]={n:0,paidN:0,received:0,pending:0,refunded:0,retN:0}; });
    if(by.manual) keys.push("manual"); return { by, keys };
  }
  function coBar() {
    const C=coStats(), tot={n:0,paidN:0,received:0,pending:0,refunded:0,retN:0}; C.keys.forEach(k=>{ const g=C.by[k]; Object.keys(tot).forEach(f=>{ tot[f]+=g[f]; }); });
    const chip=(k,l,n)=>`<button type="button" class="pm-btn pm-cochip${S.co===k?" pm-primary":""}" data-co="${esc(k)}">${esc(l)} <small>(${n})</small></button>`;
    const tr=(l,g,strong)=>`<tr style="${strong?"font-weight:800;border-top:2px solid rgba(255,255,255,.3)":""}"><td style="text-align:start;white-space:nowrap">${esc(l)}</td><td>${g.n}</td><td>${g.paidN}</td><td style="color:#d4ff4d">${money(g.received)}</td><td style="color:#fde047">${money(g.pending)}</td><td style="color:#fca5a5">${money(g.refunded)}</td><td>${g.retN}</td></tr>`;
    return `<section class="pm-card"><div class="pm-head" style="margin:0 0 8px"><div><b>🚚 المدفوعات حسب شركة التوصيل</b><div class="pm-note">اختر شركة لعرض مدفوعاتها وإحصائياتها وحدها، أو «الكل» للخلاصة العامة. الشركة = التي أُرسل إليها الطلب فعلاً.</div></div></div>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.6rem">${chip("all","الكل",tot.n)}${C.keys.map(k=>chip(k,coName(k),C.by[k].n)).join("")}</div>
      <div style="overflow:auto"><table style="border-collapse:collapse;min-width:520px"><thead><tr style="opacity:.75"><th style="text-align:start;padding:.3rem .5rem">الشركة</th><th>الطلبات</th><th>مدفوعة</th><th>المبالغ المستلمة</th><th>قيد التوصيل</th><th>المستردّة</th><th>مرتجعة</th></tr></thead><tbody>${C.keys.map(k=>tr(coName(k),C.by[k])).join("")}${tr("الخلاصة العامة",tot,true)}</tbody></table></div></section>`;
  }
  /* تسوية ياليدين وبطاقة المقارنة تُعرضان مع «الكل» أو «ياليدين» وعند وجود طرود/كشوف ياليدين */
  function showYd() { if(S.co!=="all"&&S.co!=="yalidine") return false; try{ return items().some(it=>it.co==="yalidine")||(YP.list||[]).length>0||!!ydReal(); }catch(_){ return true; } }
  function draw() {
    const host=$("payments-content"); if(!host)return;
    const t=totals(S.co), list=filtered();
    host.innerHTML=`<style>#pm{display:grid;gap:14px;color:#fff}#pm *{box-sizing:border-box}#pm .pm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}#pm .pm-card{padding:15px;border:1px solid rgba(255,255,255,.14);border-radius:17px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025));box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 10px 24px rgba(0,0,0,.22)}#pm .pm-stat small{display:block;color:#b4c9be}#pm .pm-stat b{display:block;margin-top:5px;font-size:1.2rem}#pm .pm-head,#pm .pm-tools{display:flex;align-items:center;justify-content:space-between;gap:9px;flex-wrap:wrap}#pm input,#pm select,#pm textarea{padding:8px 10px;border:1px solid rgba(255,255,255,.17);border-radius:10px;color:#fff;background:rgba(255,255,255,.07);font:inherit}#pm select option{background:#10231b;color:#fff}#pm input[type=checkbox]{width:18px;height:18px}#pm .pm-tools input[type=search]{min-width:200px;flex:1}#pm .pm-btn{padding:9px 13px;border-radius:12px;color:#fff;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),inset 0 -5px 9px rgba(0,0,0,.2),0 5px 13px rgba(0,0,0,.22);backdrop-filter:blur(8px);font:inherit;font-weight:800;cursor:pointer;transition:transform .18s,background .18s}#pm .pm-btn:hover{transform:translateY(-2px);background:rgba(255,255,255,.13)}#pm .pm-primary{background:rgba(226,254,23,.18);border-color:rgba(226,254,23,.42)}#pm .pm-table{overflow:auto}#pm table{width:100%;min-width:1500px;border-collapse:collapse}#pm td,#pm th{white-space:nowrap}#pm th,#pm td{text-align:start;padding:8px;border-bottom:1px solid rgba(255,255,255,.1);vertical-align:middle}#pm th{color:#b4c9be;font-size:.84rem}#pm td input[type=number]{width:105px}#pm td input[type=date]{width:145px}#pm td input[type=text]{width:130px}#pm td input.pm-name{width:140px}#pm td input.pm-phone{width:112px}#pm td input.pm-prod{width:170px}#pm td input.pm-note-input{width:150px}#pm td select{max-width:130px}#pm .pm-src{font-size:.78rem;font-weight:800;padding:3px 8px;border-radius:99px;border:1px solid rgba(255,255,255,.2)}#pm .pm-auto{color:#d4ff4d;border-color:rgba(226,254,23,.45)}#pm .pm-man{color:#fcd34d;border-color:rgba(252,211,77,.45)}#pm .pm-add{display:flex;gap:8px;align-items:center;flex-wrap:nowrap;overflow:auto;padding:10px;border:1px dashed rgba(226,254,23,.4);border-radius:14px;margin-top:10px}#pm .pm-add input,#pm .pm-add select{flex:none}#pm .pm-add .pm-n{width:150px}#pm .pm-add .pm-p{width:115px}#pm .pm-add .pm-pr{width:180px}#pm .pm-add .pm-a{width:105px}#pm .pm-add .pm-d{width:145px}#pm .pm-add .pm-nt{width:150px}#pm .pm-del{background:rgba(244,63,94,.16);border-color:rgba(253,164,175,.45)}#pm .pm-mini{padding:6px 10px}#pm td input,#pm td select{height:36px;padding:4px 8px}#pm td select.pm-status{width:125px;max-width:none}#pm td select.pm-method{width:150px;max-width:none}#pm td input[type=checkbox]{height:18px;padding:0}#pm .pm-badge{display:inline-block;padding:4px 9px;border-radius:99px;font-weight:800;background:rgba(255,255,255,.1)}#pm .pm-paid{color:#d4ff4d}#pm .pm-refunded{color:#fda4af}#pm .pm-error{color:#ff9aa2}#pm .pm-note{color:#b4c9be;font-size:.88rem}@media(max-width:700px){#pm .pm-grid{grid-template-columns:1fr!important}#pm .pm-stat{padding:10px 14px;display:flex;justify-content:space-between;align-items:center;gap:.6rem}#pm .pm-stat small{display:inline;overflow:visible;text-overflow:clip}#pm .pm-stat b{font-size:1.05rem;margin:0;white-space:nowrap}}#pm h2,#pm h3,#pm th,#pm .pm-head b,#pm .pm-card>b,#pm .pm-stat small{white-space:nowrap}#pm .pm-stat small{overflow:hidden;text-overflow:ellipsis;font-size:.78rem}#pm .pm-card{min-width:0}#pm .pm-dl{display:flex;justify-content:space-between;gap:.6rem;padding:.38rem .2rem;border-bottom:1px solid rgba(255,255,255,.08);font-size:.9rem;max-width:520px}#pm .pm-dl span:first-child{white-space:nowrap}#pm .pm-dl span:last-child{font-weight:700;white-space:nowrap}</style>
      <div id="pm"><div class="pm-head"><div><h2>المدفوعات</h2><div class="pm-note">⚡ تلقائية من شركة التوصيل: الطلب المسلَّم = مدفوع. عدّل أي صف يدوياً أو أضف دفعة يدوية.</div></div><div><button id="pm-add-btn" type="button" class="pm-btn pm-primary">＋ دفعة يدوية</button> <button id="pm-export" type="button" class="pm-btn">تصدير CSV</button></div></div>
      ${coBar()}${showYd()?settleCard()+cmpCard():""}${coSettleCards()}<div class="pm-grid"><div class="pm-card pm-stat"><small>المبالغ المستلمة</small><b>${money(t.received)}</b></div><div class="pm-card pm-stat"><small>مبالغ لدى شركة التوصيل (قيد التوصيل)</small><b>${money(t.pending)}</b></div><div class="pm-card pm-stat"><small>المبالغ المستردّة</small><b>${money(t.refunded)}</b></div></div>
      <section class="pm-card"><div class="pm-tools"><input id="pm-search" type="search" placeholder="بحث برقم الطلب أو الاسم أو الهاتف أو المنتج" value="${esc(S.query)}"><select id="pm-filter"><option value="all"${S.filter==="all"?" selected":""}>كل الحالات</option><option value="unpaid"${S.filter==="unpaid"?" selected":""}>غير مدفوع</option><option value="paid"${S.filter==="paid"?" selected":""}>مدفوع</option><option value="refunded"${S.filter==="refunded"?" selected":""}>مسترد</option></select><button id="pm-bulk-paid" type="button" class="pm-btn pm-primary" ${S.selected.size?"":"disabled"}>تعليم المحدّد كمدفوع (${S.selected.size})</button><button id="pm-export2" type="button" class="pm-btn">تصدير CSV</button>${(()=>{ const hid=items().length-items().filter(inNext).length; return hid>0||S.all?`<button id="pm-showall" type="button" class="pm-btn">${S.all?"إخفاء ما خرج من الحساب":"عرض المخفي ("+hid+")"}</button>`:""; })()}</div>${S.addOpen?addForm():""}${S.err?`<p class="pm-error">${esc(S.err)}</p>`:""}<div class="pm-table"><table data-nomc="1"><thead><tr><th><input id="pm-all" type="checkbox" aria-label="تحديد الكل"></th><th>رقم / تاريخ</th><th>الاسم</th><th>الهاتف</th><th>المنتج</th><th>الشحن</th><th>المبلغ</th><th>تفصيل ياليدين</th><th>الصافي لك</th><th>المصدر</th><th>حالة الدفع</th><th>المسجّل</th><th>الطريقة</th><th>تاريخ الدفع</th><th>ملاحظة</th><th></th></tr></thead><tbody>${list.length?list.map(row).join(""):`<tr><td colspan="16" class="pm-note">لا توجد مدفوعات تطابق البحث.</td></tr>`}</tbody>${list.length?totRow(list):""}</table></div><p class="pm-note">تغيير حالة الدفع لا يغيّر حالة الشحن أو المخزون. الاسترداد يُسجَّل يدوياً لطلب مدفوع أو مسلَّم.</p></section></div>`;
    const search=$("pm-search"); if(search)search.oninput=()=>{const pos=search.selectionStart;S.query=search.value;draw();const n=$("pm-search");if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(_){}}};
    const filter=$("pm-filter"); if(filter)filter.onchange=()=>{S.filter=filter.value;S.selected.clear();draw();};
    const all=$("pm-all"); if(all)all.onchange=()=>{list.forEach(it=>all.checked?S.selected.add(it.id):S.selected.delete(it.id));draw();};
    host.querySelectorAll(".pm-check").forEach(el=>el.onchange=()=>{el.checked?S.selected.add(el.dataset.id):S.selected.delete(el.dataset.id);draw();});
    host.querySelectorAll(".pm-status,.pm-amount,.pm-method,.pm-date,.pm-note-input,.pm-name,.pm-phone,.pm-prod,.pm-total").forEach(el=>el.onchange=()=>{const it=items().find(x=>x.id===el.dataset.id);if(!it)return;const d=draftFor(it),c=el.classList;if(c.contains("pm-status"))d.status=el.value;else if(c.contains("pm-amount"))d.amount=Math.round(Number(el.value)||0);else if(c.contains("pm-method"))d.method=el.value;else if(c.contains("pm-date"))d.date=el.value;else if(c.contains("pm-name"))d.name=el.value;else if(c.contains("pm-phone"))d.phone=el.value;else if(c.contains("pm-prod"))d.product=el.value;else if(c.contains("pm-total"))d.total=Math.round(Number(el.value)||0);else d.note=el.value;S.drafts[it.id]=d;});
    host.querySelectorAll(".pm-save").forEach(el=>el.onclick=()=>commit(el.dataset.id));
    host.querySelectorAll(".pm-del").forEach(el=>el.onclick=()=>delManual(el.dataset.id));
    host.querySelectorAll(".pm-reset").forEach(el=>el.onclick=()=>resetAuto(el.dataset.id));
    const yadd=$("pm-yadd");if(yadd)yadd.onclick=async()=>{ const r=parseDetail(($("pm-ytx")||{}).value); if(!r){ YP.msg="تعذّر قراءة النص: انسخ نافذة Détail paiement كاملة (من Livré حتى Net)."; draw(); return; } const calc=Math.round((r.got-r.cod-r.del-r.ret-r.ins)*100)/100; YP.msg=Math.abs(calc-r.net)>0.02?"تنبيه: صافي النص ("+r.net+") لا يطابق مجموع بنوده ("+calc+") — تحقق من النسخ.":""; const st=($("pm-yst")||{}).value==="ready"?"ready":"notready"; YP.list=YP.list.filter(x=>x.state!==st); YP.list.push(Object.assign({ state:st, at:Date.now() },r));  /* كل حالة لقطة حيّة عند الشركة: لصق جديد يحلّ محل السابق */ await ydSave(); draw(); };
    const ycut=$("pm-ycut"); if(ycut) ycut.onchange=async()=>{ YP.cut=/^\d{4}-\d{2}-\d{2}$/.test(ycut.value)?ycut.value:""; try{ await Priv.set("ydcut",YP.cut); }catch(_){ } draw(); };
    const ycut0=$("pm-ycut0"); if(ycut0) ycut0.onclick=async()=>{ YP.cut=""; try{ await Priv.set("ydcut",""); }catch(_){ } draw(); };
    const yauto=host.querySelector(".pm-yauto"); if(yauto) yauto.onclick=async()=>{ const AG=autoGroups(); Object.keys(AG.g).forEach(k=>{ const G=AG.g[k]; YP.list=YP.list.filter(x=>x.state!==k); YP.list.push(Object.assign({ state:k, at:Date.now(), auto:true },G,{ net:Math.round(G.net*100)/100 })); }); await ydSave(); draw(); };
    host.querySelectorAll(".pm-ypaid").forEach(el=>el.onclick=async()=>{ const x=YP.list[+el.dataset.i]; if(!x||!window.confirm("تأكيد: هذا الكشف ("+x.net+" DA) قُبض فعلاً؟ سينتقل إلى «مقبوض سابقاً» ولا يدخل في المستحق.")) return; x.state="paid"; x.paidAt=Date.now(); await ydSave(); draw(); });
    const yh=host.querySelector(".pm-yhis"); if(yh) yh.onclick=()=>{ YP.showHist=!YP.showHist; draw(); };
    host.querySelectorAll(".pm-ydel").forEach(el=>el.onclick=async()=>{ YP.list.splice(+el.dataset.i,1); await ydSave(); draw(); });
    const ist=$("pm-impst");if(ist)ist.onchange=()=>{ S.impState=ist.value; };const imp=$("pm-imp");if(imp)imp.onclick=()=>{const f=document.getElementById("fin-import");if(f)f.click();else S.err="تعذّر فتح نافذة الاستيراد.";};
    const bulk=$("pm-bulk-paid");if(bulk)bulk.onclick=bulkPaid;
    host.querySelectorAll(".pm-cochip").forEach(el=>el.onclick=()=>{ S.co=el.dataset.co||"all"; S.selected.clear(); draw(); });
    const sa=$("pm-showall");if(sa)sa.onclick=()=>{S.all=!S.all;S.selected.clear();draw();};
    [$("pm-export"),$("pm-export2")].filter(Boolean).forEach(el=>el.onclick=csv);
    const ab=$("pm-add-btn");if(ab)ab.onclick=()=>{S.addOpen=!S.addOpen;draw();};
    if(S.addOpen){
      const rd=()=>{const a=S.add||(S.add={});a.name=$("pm-a-name").value;a.phone=$("pm-a-phone").value;a.product=$("pm-a-prod").value;a.total=$("pm-a-total").value;a.method=$("pm-a-method").value;a.date=$("pm-a-date").value;a.note=$("pm-a-note").value;return a;};
      ["pm-a-name","pm-a-phone","pm-a-prod","pm-a-total","pm-a-method","pm-a-date","pm-a-note"].forEach(k=>{const e=$(k);if(e)e.onchange=rd;});
      $("pm-a-no").onclick=()=>{S.addOpen=false;S.add=null;draw();};
      $("pm-a-ok").onclick=async()=>{const a=rd(),tot=Math.round(Number(a.total)||0);if(!(tot>0)||!String(a.name).trim()&&!String(a.product).trim()){S.err="أدخل الاسم أو المنتج ومبلغاً أكبر من صفر.";draw();return;}
        const mid="m"+Date.now().toString(36);S.manual.push({id:mid,date:a.date||today(),name:String(a.name).trim().slice(0,80),phone:String(a.phone).trim().slice(0,30),product:String(a.product).trim().slice(0,160),total:tot});
        S.byOrder[mid]={status:"paid",amount:tot,date:a.date||today(),method:methods[a.method]?a.method:"cash",note:String(a.note||"").slice(0,300),manual:true};
        S.add=null;S.addOpen=false;S.err="";const ok=await save();S.err=ok?(S.localOnly?"حُفظ محلياً فقط؛ لم يُنشر بعد.":""):S.err;draw();};
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
    const ok=await save();S.err=ok?(S.localOnly?"حُفظ محلياً فقط؛ لم يُنشر بعد.":""):S.err;draw();
  }
  async function resetAuto(oid) { if(!confirm("إعادة هذا الصف للحالة التلقائية من شركة التوصيل (يُمسح التعديل اليدوي)؟"))return; delete S.byOrder[oid];delete S.drafts[oid];const ok=await save();S.err=ok?"":S.err;draw(); }
  async function delManual(oid) { if(!confirm("حذف هذه الدفعة اليدوية؟"))return; S.manual=S.manual.filter(x=>String(x.id)!==oid);delete S.byOrder[oid];delete S.drafts[oid];S.selected.delete(oid);const ok=await save();S.err=ok?"":S.err;draw(); }
  async function bulkPaid() {
    const chosen=[...S.selected], is=items().filter(it=>chosen.includes(it.id));
    if(!is.length)return;
    is.forEach(it=>{const r=Object.assign({},record(it),S.drafts[it.id]||{}),V=view(it),prev=S.byOrder[it.id]||{};r.status="paid";if(!(Number(r.amount)>0))r.amount=V.total;if(!r.date)r.date=today();r.method=methods[r.method]?r.method:"cod";S.byOrder[it.id]=Object.assign({},prev,{status:r.status,amount:r.amount,date:r.date,method:r.method,note:r.note||"",manual:true});delete S.drafts[it.id];});
    S.selected.clear();S.err="";const ok=await save();S.err=ok?(S.localOnly?"حُفظت التغييرات محلياً فقط؛ لم تُنشر بعد.":""):S.err;draw();
  }
  async function render() { const host=$("payments-content");if(!host)return;host.innerHTML='<p class="pm-note">جارٍ تحميل سجلات الدفع…</p>';await load();await ydLoad();
    try{ const empty=!(typeof AdminYd!=="undefined"&&AdminYd.S&&AdminYd.S.rows&&AdminYd.S.rows.length); if(empty&&A().ydFetchParcels&&!S.fetchedCo){ S.fetchedCo=true; await A().ydFetchParcels(10); } }catch(_){ }
    draw(); }
  document.addEventListener("DOMContentLoaded",()=>{
    if(typeof Admin==="undefined"||Admin._paymentsTabWrapped)return;
    const original=Admin.tab;Admin.tab=function(t,btn){const result=original.call(this,t,btn),el=$("tab-payments");if(el)el.classList.toggle("hidden",t!=="payments");if(t==="payments")AdminPayments.render();return result;};Admin._paymentsTabWrapped=true;
  });
  return { render, items, record, view, autoRec, settle, sumSettle, detailBlock, parseDetail, totals, coStats, coNets, load, S, DEF_COD, DEF_RET, YP, cmpCard, trkOf };
})();
