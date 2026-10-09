/* Print A4 invoices and A6 COD waybills from the existing selected-orders toolbar. */
const AdminOrderDocs = (() => {
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=n=>Math.round(Number(n)||0).toLocaleString("fr-DZ")+" دج";
  const A=()=>typeof Admin!=="undefined"?Admin:{};
  const B128=["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];
  function barcodeSvg(value){
    const text=String(value||"").replace(/[^\x20-\x7e]/g,"").slice(0,40)||"0", codes=[104,...[...text].map(ch=>ch.charCodeAt(0)-32)];
    let sum=104;for(let i=1;i<codes.length;i++)sum+=codes[i]*i;codes.push(sum%103,106);
    let x=8, bars="";
    codes.forEach(code=>{const pat=B128[code];if(!pat)return;let black=true;for(const w of pat){const width=Number(w)*2;if(black)bars+='<rect x="'+x+'" y="0" width="'+width+'" height="48"/>';x+=width;black=!black;}});
    return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Code 128 '+esc(text)+'" viewBox="0 0 '+(x+8)+' 64" style="width:100%;max-width:340px;height:64px"><g fill="#111">'+bars+'</g><text x="50%" y="61" text-anchor="middle" font-size="10">'+esc(text)+'</text></svg>';
  }
  function lines(order){
    let items=Array.isArray(order.items)?order.items:[];
    if(!items.length&&typeof parseOrderItems==="function"){try{items=parseOrderItems(order.items||"")||[];}catch(e){items=[];}}
    if(!Array.isArray(items))items=[];
    return items.map(x=>({title:String(x.title||x.name||x.product||x.slug||"منتج"),variant:String(x.vlabel||x.variant||""),qty:Math.max(1,Number(x.qty||x.quantity)||1),price:Math.max(0,Number(x.price)||0)}));
  }
  function totals(o,its=lines(o)){
    const calculated=its.reduce((n,x)=>n+x.qty*x.price,0);
    const subtotal=o.subtotal!==null&&o.subtotal!==undefined&&o.subtotal!==""&&Number.isFinite(Number(o.subtotal))?Number(o.subtotal):calculated;
    const fee=Math.max(0,Number(o.fee)||0),discount=Math.max(0,Number(o.discount)||0);
    const total=o.total!==null&&o.total!==undefined&&o.total!==""&&Number.isFinite(Number(o.total))?Number(o.total):Math.max(0,subtotal+fee-discount);
    return {subtotal,fee,discount,total};
  }
  function barcode(order){return String(order.tracking||order.trackingNumber||order.tracking_number||order.id||"").trim();}
  function pageCss(size){return '@page{size:'+size+';margin:8mm}*{box-sizing:border-box}body{font-family:Arial,"Noto Naskh Arabic",sans-serif;direction:rtl;color:#111;margin:0}h1,h2,p{margin:.25rem 0}.muted{color:#555}.box{border:1px solid #bbb;padding:10px;border-radius:8px;margin:8px 0}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #bbb;padding:7px;text-align:right}th{background:#f2f2f2}.totals{width:min(100%,420px);margin-inline-start:auto}.brand{display:flex;justify-content:space-between;border-bottom:2px solid #222;padding-bottom:8px}.barcode{text-align:center;margin:12px 0}.break{page-break-after:always}.waybill{border:2px solid #111;padding:14px;min-height:130mm}.waybill h1{font-size:20px}.field{padding:7px;border-bottom:1px solid #bbb}.print{position:fixed;left:10px;top:10px} @media print{.print{display:none}}';}
  function invoice(o){
    const its=lines(o),t=totals(o,its),site=(typeof CONFIG!=="undefined"&&CONFIG.SITE)||{};
    const rows=its.map(x=>'<tr><td>'+esc(x.title)+(x.variant?' — '+esc(x.variant):'')+'</td><td>'+x.qty+'</td><td>'+money(x.price)+'</td><td>'+money(x.price*x.qty)+'</td></tr>').join("");
    return '<section class="invoice"><div class="brand"><div><h1>فاتورة</h1><b>'+esc(site.name||"المتجر")+'</b><div class="muted">'+esc(site.domain||"")+'</div></div><div><b>رقم الطلب:</b> '+esc(o.id||"—")+'<br><b>التاريخ:</b> '+esc(o.date||"—")+'</div></div><div class="box"><b>الزبون:</b> '+esc(o.name||"—")+'<br><b>الهاتف:</b> '+esc(o.phone||"—")+'<br><b>العنوان:</b> '+esc([o.commune,o.wilaya,o.address].filter(Boolean).join("، ")||"—")+'</div><table><thead><tr><th>المنتج</th><th>الكمية</th><th>سعر الوحدة</th><th>المجموع</th></tr></thead><tbody>'+rows+'</tbody></table><table class="totals"><tbody><tr><th>قيمة المنتجات</th><td>'+money(t.subtotal)+'</td></tr><tr><th>التوصيل</th><td>'+money(t.fee)+'</td></tr><tr><th>الخصم</th><td>− '+money(t.discount)+'</td></tr><tr><th>الإجمالي</th><td><b>'+money(t.total)+'</b></td></tr></tbody></table><p class="muted">الدفع عند الاستلام ما لم تُسجَّل حالة دفع أخرى في الطلب.</p></section>';
  }
  function waybill(o){
    const t=totals(o),track=barcode(o);
    return '<section class="waybill"><div style="display:flex;justify-content:space-between;gap:8px"><h1>📦 بوليصة توصيل</h1><b>COD: '+money(t.total)+'</b></div><div class="field"><b>رقم الطلب:</b> '+esc(o.id||"—")+' &nbsp; <b>التتبع:</b> '+esc(track||"—")+'</div><div class="field"><b>الزبون:</b> '+esc(o.name||"—")+'</div><div class="field"><b>الهاتف:</b> '+esc(o.phone||"—")+'</div><div class="field"><b>العنوان:</b> '+esc([o.commune,o.wilaya,o.address].filter(Boolean).join("، ")||"—")+'</div><div class="field"><b>التوصيل:</b> '+esc(o.dtype==="stop"?"مكتب":"للمنزل")+'</div><div class="field"><b>محتوى الطرد:</b> '+esc(lines(o).map(x=>x.title+" ×"+x.qty).join("، "))+'</div><div class="barcode">'+barcodeSvg(track||o.id||"0")+'</div><p class="muted">المبلغ المطلوب عند التسليم: '+money(t.total)+'</p></section>';
  }
  function print(kind,orders){
    const list=(Array.isArray(orders)?orders:[]).filter(Boolean);if(!list.length){if(typeof toast==="function")toast("حدد طلباً واحداً على الأقل");return false;}
    const content=list.map((o,i)=>(i?'<div class="break"></div>':'')+(kind==="invoice"?invoice(o):waybill(o))).join("");
    const title=kind==="invoice"?"فاتورة":"بوليصة";
    const win=window.open("","_blank");if(!win){if(typeof toast==="function")toast("اسمح بفتح نافذة الطباعة");return false;}
    win.document.open();win.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+title+'</title><style>'+pageCss(kind==="invoice"?"A4":"A6")+'</style></head><body><button class="print" onclick="window.print()">طباعة</button>'+content+'</body></html>');win.document.close();win.focus();return true;
  }
  function selected(){
    const a=A(),sel=typeof AdminOrdersPlus!=="undefined"&&AdminOrdersPlus.sel;
    if(!a.orders||!sel)return [];
    return a.orders.filter(o=>sel.has(String(o.id)));
  }
  function inject(){
    const bar=document.getElementById("op-bulk");if(!bar)return;
    if(bar.querySelector("[data-order-docs]"))return;
    const group=document.createElement("span");group.setAttribute("data-order-docs","1");group.style.cssText="display:flex;gap:6px;flex-wrap:wrap";
    group.innerHTML='<button type="button" class="opb" data-print="invoice">🧾 فاتورة المحدد</button><button type="button" class="opb" data-print="waybill">📦 بوليصة المحدد</button>';
    bar.appendChild(group);
    group.querySelectorAll("[data-print]").forEach(b=>b.onclick=()=>print(b.dataset.print,selected()));
  }
  function init(){
    if(!document.body)return;
    const obs=new MutationObserver(inject);obs.observe(document.body,{childList:true,subtree:true});inject();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
  return {print,lines,totals,barcodeSvg,invoice,waybill};
})();
