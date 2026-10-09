/* Local business insights layered on top of AdminHome; no edits to admin-home.js. */
const AdminInsights = (() => {
  const DAY=864e5, esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const A=()=>typeof Admin!=="undefined"?Admin:{};
  const nowMs=()=>Date.now();
  const date=o=>{const n=new Date(o&& (o.date||o.created_at||o.createdAt)).getTime();return Number.isFinite(n)?n:0;};
  const delivered=o=>String(o&&o.status||"").toLowerCase()==="livree";
  const failed=o=>["annulee","echec","failed","cancelled"].includes(String(o&&o.status||"").toLowerCase());
  function itemsOf(o){
    if(Array.isArray(o&&o.items))return o.items;
    if(typeof o?.items==="string"){
      try{if(typeof parseOrderItems==="function")return parseOrderItems(o.items);}catch(e){}
      try{return JSON.parse(o.items);}catch(e){}
    }
    return [];
  }
  function compute(orders,products,now=Date.now()){
    const all=Array.isArray(orders)?orders:[], ps=Array.isArray(products)?products:[];
    if(all.length<10)return [];
    const insights=[], add=(priority,text,kind,value)=>insights.push({priority,text,kind,value});
    const cur=all.filter(o=>date(o)>=now-7*DAY&&date(o)<=now);
    const prev=all.filter(o=>date(o)>=now-14*DAY&&date(o)<now-7*DAY);
    const sales=os=>os.filter(delivered).reduce((n,o)=>n+Math.max(0,Number(o.total)||0),0);
    const cs=sales(cur),psales=sales(prev);
    if(psales>0&&cs!==psales){
      const pct=Math.round((cs-psales)/psales*100);
      add(80,"مبيعات 7 أيام "+(pct>0?"↑":"↓")+Math.abs(pct)+"% عن الفترة السابقة","analytics",pct);
    } else if(!psales&&cs>0)add(70,"بدأت المبيعات في آخر 7 أيام","analytics",cs);
    const unitMap=os=>{
      const m={};
      for(const o of os.filter(delivered))for(const it of itemsOf(o)){
        const key=String(it&& (it.slug||it.productSlug||it.title)||"");
        if(key)m[key]=(m[key]||0)+Math.max(0,Number(it.qty||it.quantity)||0);
      }
      return m;
    };
    const prodNow=unitMap(cur),prodPrev=unitMap(prev),bySlug=new Map(ps.map(p=>[String(p.slug||""),p]));
    Object.keys(prodPrev).forEach(key=>{
      const before=prodPrev[key],after=prodNow[key]||0;
      if(before>=3&&after<before){
        const pct=Math.round((before-after)/before*100),p=bySlug.get(key);
        if(pct>=40)add(88,"مبيعات المنتج «"+String(p&&p.title||key)+"» انخفضت "+pct+"%","product",key);
      }
    });
    const cnt=os=>{const m={};for(const o of os){const k=String(o.wilaya||"").trim();if(k)m[k]=(m[k]||0)+1;}return m;};
    const wn=cnt(cur),wp=cnt(prev);
    Object.keys(wn).forEach(k=>{const before=wp[k]||0,after=wn[k];if(after>=2&&after>before){const pct=before?Math.round((after-before)/before*100):100;add(55,"طلبات ولاية "+k+" ارتفعت "+pct+"%","wilaya",k);}});
    const last30=all.filter(o=>date(o)>=now-30*DAY&&date(o)<=now),failBy={},totalBy={};
    last30.forEach(o=>{const k=String(o.wilaya||"").trim();if(!k)return;totalBy[k]=(totalBy[k]||0)+1;if(failed(o))failBy[k]=(failBy[k]||0)+1;});
    Object.keys(totalBy).forEach(k=>{const n=totalBy[k],f=failBy[k]||0,pct=n?Math.round(f/n*100):0;if(n>=5&&pct>=25)add(95,"معدل الفشل في ولاية "+k+" = "+pct+"%","wilaya",k);});
    const sold30=unitMap(last30);
    ps.forEach(p=>{
      const slug=String(p.slug||""),stock=Number(p.stock);
      if(!slug||!Number.isFinite(stock)||stock<0)return;
      const rate=(sold30[slug]||0)/30;if(rate<=0)return;
      const days=stock/rate;
      if(days<=14)add(days<=5?100:75,"مخزون «"+String(p.title||slug)+"» ينفد خلال ~"+Math.max(0,Math.ceil(days))+" أيام","product",slug);
    });
    return insights.sort((a,b)=>b.priority-a.priority).slice(0,6);
  }
  function openOrders(query){
    const a=A(),btn=[...document.querySelectorAll(".nav-btn")].find(x=>(x.getAttribute("onclick")||"").includes("'orders'")||/الطلبات/.test(x.textContent||""));
    if(a.tab)a.tab("orders",btn);
    const q=document.getElementById("order-filter-q");
    if(q&&query){q.value=query;q.dispatchEvent(new Event("input",{bubbles:true}));q.focus();q.setSelectionRange(q.value.length,q.value.length);}
  }
  function act(kind,value){
    const a=A();
    if(kind==="product"){if(a.editProduct)a.editProduct(value);return;}
    if(kind==="wilaya"){openOrders(value);return;}
    const b=[...document.querySelectorAll(".nav-btn")].find(x=>(x.getAttribute("onclick")||"").includes("'analytics'")||/التحليلات/.test(x.textContent||""));
    if(b)b.click();
  }
  let presenceAt=0;
  async function presence(){
    const box=document.getElementById("ai-live");if(!box)return;
    if(typeof API==="undefined"||typeof API.presence!=="function"){box.hidden=true;return;}
    if(Date.now()-presenceAt<30000)return;presenceAt=Date.now();
    try{const r=await API.presence();const n=Number(r&&r.now);if(!r||r.ok===false||!Number.isFinite(n)){box.hidden=true;return;}box.hidden=false;box.textContent="👁️ "+n.toLocaleString("fr-DZ")+" زائر الآن";}
    catch(e){box.hidden=true;}
  }
  function render(){
    const root=document.getElementById("ahome");if(!root)return;
    let host=document.getElementById("ai-insights");
    if(!host){host=document.createElement("section");host.id="ai-insights";host.className="card";host.style.cssText="padding:1rem;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:rgba(255,255,255,.05);color:inherit";root.appendChild(host);}
    const a=A(),rows=compute(a.orders||[],a.products||[]);
    host.innerHTML='<h3 style="margin:0 0 .7rem">💡 رؤى المتجر <span id="ai-live" hidden style="float:left"></span></h3>'+
      (rows.length?'<div style="display:grid;gap:.5rem">'+rows.map((x,i)=>'<div style="display:flex;gap:.5rem;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:.5rem;border-bottom:1px solid rgba(255,255,255,.1)"><span>'+esc(x.text)+'</span><button type="button" data-ai="'+i+'" style="border:1px solid #86f06a;background:rgba(134,240,106,.12);border-radius:8px;padding:.35rem .65rem;color:inherit">افتح</button></div>').join("")+'</div>':'<p style="margin:.2rem 0;color:rgba(255,255,255,.7)">تظهر الرؤى بعد توفر 10 طلبات على الأقل.</p>');
    host.querySelectorAll("[data-ai]").forEach(b=>b.onclick=()=>{const x=rows[Number(b.dataset.ai)];if(x)act(x.kind,x.value);});
    presence();
  }
  function init(){
    if(typeof AdminHome==="undefined"||!AdminHome||typeof AdminHome.render!=="function")return setTimeout(init,300);
    if(AdminHome.__insightsWrapped)return;AdminHome.__insightsWrapped=true;
    const old=AdminHome.render;
    AdminHome.render=function(){const r=old.apply(this,arguments);try{render();}catch(e){console.warn("AdminInsights",e);}return r;};
    render();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
  return {compute,render,init};
})();
