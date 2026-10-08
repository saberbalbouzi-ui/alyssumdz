/* خصومات متقدمة متوافقة مع واجهة Admin القديمة. */
const AdminCoupons2 = (() => {
  let ready=false, query="";
  const $=id=>document.getElementById(id), esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const A=()=>Admin;
  function usage(c){return (A().orders||[]).filter(o=>String(o.coupon||"").toUpperCase()===String(c.code||"").toUpperCase()).length;}
  function status(c){const now=Date.now(),from=c.from?new Date(c.from+"T00:00:00").getTime():0,to=c.to?new Date(c.to+"T23:59:59").getTime():c.expiresAt?new Date(c.expiresAt).getTime():0;if(c.active===false)return "موقوف";if(from&&now<from)return "مجدول";if(to&&now>to)return "منتهٍ";if(Number(c.limit)>0&&usage(c)>=Number(c.limit))return "مستنفد";return "فعّال";}
  function ensureForm(){
    if($("cp-from"))return;
    const min=$("cp-min-order"), exp=$("cp-expires"), active=$("cp-active"); if(!min||!exp||!active)return;
    min.placeholder="الحدّ الأدنى للسلة (دج)";
    const endLabel=exp.previousElementSibling;if(endLabel&&endLabel.classList.contains("hint"))endLabel.textContent="تاريخ انتهاء الصلاحية (اختياري)";
    const from=document.createElement("label");from.className="hint";from.textContent="تاريخ بدء الصلاحية (اختياري)";exp.parentNode.insertBefore(from,endLabel||exp); const fi=document.createElement("input");fi.type="date";fi.id="cp-from";exp.parentNode.insertBefore(fi,endLabel||exp);
    const grid=document.createElement("div");grid.className="grid2";grid.innerHTML='<label class="hint" style="margin:0">سقف الخصم بالنسبة المئوية (اختياري)<input id="cp-max" type="number" min="0" step="1" placeholder="بلا سقف"></label><label class="hint" style="margin:0">أقصى استعمال إرشادي<input id="cp-limit" type="number" min="1" step="1" placeholder="بلا حد"></label>';min.insertAdjacentElement("afterend",grid);
    const extra=document.createElement("div");extra.id="cp-v2-options";extra.innerHTML='<label class="hint" style="display:block;margin:.5rem 0">الفئات المسموحة — slug مفصول بفاصلة، فارغ = كل الفئات<input id="cp-cats" placeholder="honey, skin" dir="ltr"></label><label class="hint" style="display:block;margin:.5rem 0">المنتجات المسموحة — slug مفصول بفاصلة، فارغ = كل المنتجات<input id="cp-slugs" placeholder="miel-sidr, henna" dir="ltr"></label><div class="grid2"><label class="hint" style="margin:0"><input type="checkbox" id="cp-per-phone" style="width:auto"> مرة واحدة لكل رقم هاتف</label><label class="hint" style="margin:0"><input type="checkbox" id="cp-first-order" style="width:auto"> لأول طلب فقط</label></div><label class="hint" style="display:block;margin:.5rem 0"><input type="checkbox" id="cp-stack" style="width:auto"> السماح بالجمع مع عرض الكمية</label>';
    active.parentNode.insertBefore(extra,active);
    const hint=document.createElement("div");hint.className="hint";hint.id="cp-v2-limit-note";hint.textContent="عداد الحدّ الكلي إرشادي من الطلبات الظاهرة في لوحة الإدارة؛ لا يمنع الطلبات في المتجر لأن الموقع لا يملك عدّاداً موثوقاً على الخادم.";extra.appendChild(hint);
    const oldHint=[...document.querySelectorAll("#coupon-modal-bg .hint")].find(x=>x.textContent.includes("لا توجد حالياً آلية"));if(oldHint)oldHint.classList.add("hidden");
  }
  function fill(c){ensureForm();$("cp-min-order").value=c&&(c.min!=null?c.min:c.minOrder)||"";$("cp-from").value=c&&c.from||"";$("cp-expires").value=c&&(c.to||c.expiresAt)||"";$("cp-max").value=c&&c.max||"";$("cp-limit").value=c&&c.limit||"";$("cp-cats").value=Array.isArray(c&&c.cats)?c.cats.join(", "):"";$("cp-slugs").value=Array.isArray(c&&c.slugs)?c.slugs.join(", "):"";$("cp-per-phone").checked=!!(c&&c.perPhone);$("cp-first-order").checked=!!(c&&c.firstOrder);$("cp-stack").checked=!!(c&&c.stack);}
  function listValue(id){return $(id).value.split(",").map(x=>x.trim()).filter(Boolean);}
  function save(){
    const a=A(),code=$("cp-code").value.trim().toUpperCase(),type=$("cp-type").value,value=(type==="freeship"||type==="gift")?0:Number($("cp-value").value),min=Number($("cp-min-order").value)||0,max=Number($("cp-max").value)||0,limit=Number($("cp-limit").value)||0;
    if(!/^[A-Z0-9_-]{3,40}$/.test(code)){toast("أدخل كوداً من 3 إلى 40 حرفاً أو رقماً");return;}
    if(type==="gift"&&!$("cp-product").value){toast("اختر المنتج الهدية");return;}
    if(type!=="gift"&&type!=="freeship"&&(!Number.isFinite(value)||value<=0)){toast("أدخل قيمة خصم صحيحة");return;}
    if(type==="percent"&&value>100){toast("النسبة يجب ألا تتجاوز 100%");return;}
    if(min<0||max<0||limit<0){toast("لا تقبل القيم السالبة");return;}
    if(max&&type!=="percent"){toast("سقف الخصم متاح لكوبون النسبة فقط");return;}
    const dup=(a.coupons||[]).find(x=>x.code.toUpperCase()===code&&x.id!==a.editingCouponId);if(dup){toast("هذا الكود مستخدم بالفعل");return;}
    const data={id:a.editingCouponId||("cp_"+Date.now()),code,type,value,product:type==="gift"?$("cp-product").value:"",active:$("cp-active").checked,min,minOrder:min,from:$("cp-from").value||"",to:$("cp-expires").value||"",max,limit:limit||0,perPhone:$("cp-per-phone").checked,firstOrder:$("cp-first-order").checked,stack:$("cp-stack").checked,cats:listValue("cp-cats"),slugs:listValue("cp-slugs")};
    const i=a.coupons.findIndex(x=>x.id===data.id);if(i<0)a.coupons.push(data);else a.coupons[i]=data;
    a.publishCoupons().then(ok=>{if(ok)$("coupon-modal-bg").classList.remove("open");});
  }
  function render(){
    const table=$("coupons-table");if(!table)return;
    ensureForm();
    if(!$("cp-v2-search")){const head=$("tab-coupons").querySelector(".card");const search=document.createElement("input");search.id="cp-v2-search";search.type="search";search.placeholder="بحث بالكود أو النوع";search.setAttribute("aria-label","بحث في أكواد الخصم");search.style.cssText="max-width:280px;margin:.5rem 0";head.insertAdjacentElement("afterend",search);search.oninput=()=>{query=search.value.toLowerCase();render();};}
    const list=(A().coupons||[]).filter(c=>!query||(String(c.code)+" "+String(c.type)).toLowerCase().includes(query));
    if(!list.length){table.innerHTML='<tr><td style="text-align:center;padding:2rem;color:#999">لا توجد أكواد مطابقة — اضغط «+ كود جديد»</td></tr>';return;}
    table.innerHTML='<tr><th>الكود</th><th>الخصم</th><th>الشروط</th><th>الصلاحية</th><th>الاستعمال</th><th>الحالة</th><th>إجراءات</th></tr>'+list.map(c=>{
      const n=usage(c),st=status(c),pct=c.type==="percent"?Number(c.value)+"%"+(c.max?" · سقف "+Number(c.max):""):c.type==="freeship"?"توصيل مجاني":c.type==="gift"?"هدية: "+((A().products.find(p=>p.slug===c.product)||{}).title||c.product):Number(c.value).toLocaleString("fr-DZ")+" دج";
      const cond=[Number(c.min!=null?c.min:c.minOrder)?"حد أدنى "+Number(c.min!=null?c.min:c.minOrder).toLocaleString("fr-DZ")+" دج":"",c.cats&&c.cats.length?"فئات: "+c.cats.join("، "):"",c.slugs&&c.slugs.length?"منتجات: "+c.slugs.join("، "):"",c.perPhone?"مرة/هاتف":"",c.firstOrder?"أول طلب":"",c.stack?"يجمع مع عرض الكمية":""].filter(Boolean).join(" · ")||"بلا شروط إضافية";
      const date=[c.from?"من "+c.from:"",c.to||c.expiresAt?"إلى "+(c.to||c.expiresAt):""].filter(Boolean).join(" · ")||"بلا مدة";
      return `<tr><td dir="ltr"><b>${esc(c.code)}</b></td><td>${esc(pct)}</td><td>${esc(cond)}</td><td>${esc(date)}</td><td>${Number(c.limit)>0?`استُعمل ${n}/${Number(c.limit)}`:`${n} استعمال`}</td><td><span class="pill ${st==="فعّال"?"st-livree":st==="مجدول"?"st-nouvelle":"st-annulee"}">${st}</span></td><td style="white-space:nowrap"><button class="small" data-action="copy" data-id="${esc(c.id)}">نسخ الكود</button> <button class="small" data-action="edit" data-id="${esc(c.id)}">تعديل</button> <button class="small" data-action="duplicate" data-id="${esc(c.id)}">تكرار</button> <button class="small gold" data-action="toggle" data-id="${esc(c.id)}">${c.active===false?"تفعيل":"إيقاف"}</button> <button class="small warn" data-action="delete" data-id="${esc(c.id)}">حذف</button></td></tr>`;
    }).join("");
    table.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>action(b.dataset.action,b.dataset.id));
  }
  async function action(kind,id){const a=A(),c=a.coupons.find(x=>x.id===id);if(!c)return;
    if(kind==="edit")return a.editCoupon(id);
    if(kind==="toggle"){c.active=c.active===false;return a.publishCoupons();}
    if(kind==="delete"){if(!confirm("حذف هذا الكود؟"))return;a.coupons=a.coupons.filter(x=>x.id!==id);return a.publishCoupons();}
    if(kind==="copy"){try{await navigator.clipboard.writeText(c.code);toast("تم نسخ الكود");}catch(e){toast("تعذّر النسخ تلقائياً");}return;}
    if(kind==="duplicate"){let code=(c.code+"-COPY").slice(0,40),i=2;while(a.coupons.some(x=>x.code.toUpperCase()===code.toUpperCase()))code=(c.code+"-"+i++).slice(0,40);a.coupons.push(Object.assign({},c,{id:"cp_"+Date.now(),code}));return a.publishCoupons();}
  }
  function init(){if(ready)return;ready=true;ensureForm();
    const oldEdit=A().editCoupon;A().editCoupon=function(id){const r=oldEdit.call(this,id);fill(id?this.coupons.find(x=>x.id===id):null);return r;};
    A().saveCoupon=save;
    A().publishCoupons=async function(){
      const cfg=GH.cfg();if(!cfg||!cfg.token){toast("⚠️ اضبط GitHub أولاً");this.openGhSettings();return false;}
      toast("جارٍ نشر أكواد الخصم...");
      try{const b64=btoa(unescape(encodeURIComponent(JSON.stringify(this.coupons,null,2)))),res=await GH.putFile("assets/data/coupons.json",b64,this.couponsSha,"تحديث أكواد الخصم المتقدمة");this.couponsSha=res&&res.content?res.content.sha:undefined;this.renderCoupons();toast("تم نشر أكواد الخصم");return true;}
      catch(e){console.error(e);toast("تعذّر نشر الأكواد: "+(e.message||""));return false;}
    };
    render();
  }
  return {init,render};
})();
