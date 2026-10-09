/* استيراد وتصدير مناطق التوصيل وقوالب أولية قابلة للتعديل. */
const AdminZonesIO = (() => {
  const KEY = "admin_zones_io_undo_v1";
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fees = () => (typeof Admin !== "undefined" && Array.isArray(Admin.fees) ? Admin.fees : []);
  const state = () => (typeof AdminZones !== "undefined" ? AdminZones.S : null);
  const toast = msg => { try { window.toast(msg); } catch (_) { alert(msg); } };
  const idText = n => String(n).padStart(2, "0");
  let observer = null, preview = null, styleAdded = false;

  function csvCell(value) { return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"'; }
  function makeCSV(zones, exclusions) {
    const head = ["zone","wilaya_id","wilaya","home","stop","free_home","free_stop","free_over","exclusions"];
    const rows = [head];
    zones.forEach(z => {
      const ids = Array.isArray(z.wilayas) ? z.wilayas : [];
      const entries = ids.length ? ids : [""];
      entries.forEach(id => {
        const w = fees().find(x => Number(x.id) === Number(id));
        const name = w ? w.name + (Number(w.id) >= 59 && w.par ? ` (par ${w.par})` : "") : "";
        rows.push([z.name,id,name,z.home,z.stop,z.freeHome?1:0,z.freeStop?1:0,z.freeOver||0,JSON.stringify(exclusions)]);
      });
    });
    return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
  }
  function downloadCSV() {
    const s = state(); if (!s || !s.inited) { toast("حمّل إعدادات المناطق أولاً."); return; }
    const exclusions = [
      ...(s.exw || []).map(w => ({ wilaya_id:Number(w), commune:"", mode:"all" })),
      ...(s.ex || []).map(e => ({ wilaya_id:Number(e.w), commune:String(e.c), mode:e.m === "home" ? "home" : "all" }))
    ];
    const blob = new Blob([makeCSV(s.zones || [], exclusions)], { type:"text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "delivery-zones.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function parseCSV(text) {
    const rows = []; let row = [], cell = "", quoted = false, src = String(text || "").replace(/^\uFEFF/, "");
    for (let i=0; i<src.length; i++) {
      const ch = src[i];
      if (quoted) { if (ch === '"' && src[i+1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch; }
      else if (ch === '"' && cell === "") quoted = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && src[i+1] === "\n") i++; row.push(cell); cell = ""; if (row.some(v => v.trim())) rows.push(row); row = []; }
      else cell += ch;
    }
    if (quoted) throw new Error("يوجد حقل نصي غير مغلق بعلامة اقتباس.");
    if (cell || row.length) { row.push(cell); if (row.some(v => v.trim())) rows.push(row); }
    return rows;
  }
  function validateCSV(text) {
    const rows = parseCSV(text); if (rows.length < 2) throw new Error("الملف لا يحتوي على صفوف بيانات.");
    const headers = rows[0].map(x => x.trim().toLowerCase());
    const required = ["zone","wilaya_id","wilaya","home","stop","free_home","free_stop","free_over","exclusions"];
    if (required.some(x => !headers.includes(x))) throw new Error("عناوين الأعمدة غير مكتملة. استخدم قالب التصدير الحالي.");
    const ix = Object.fromEntries(required.map(x => [x, headers.indexOf(x)])), known = new Map(fees().map(w => [Number(w.id),w]));
    if (!known.size) throw new Error("تعذّر تحميل قائمة الولايات.");
    const zones = new Map(), assigned = new Map(), errors = [], exclusions = new Map();
    rows.slice(1).forEach((line, ri) => {
      const lineNo = ri + 2, val = key => String(line[ix[key]] || "").trim();
      const name = val("zone"); if (!name) { errors.push(`السطر ${lineNo}: اسم المنطقة فارغ.`); return; }
      const parsePrice = key => { const raw=val(key), n=Number(raw); if (raw === "" || !Number.isFinite(n) || n < 0) throw new Error(`السطر ${lineNo}: سعر ${key} فارغ أو سالب.`); return n; };
      let z = zones.get(name);
      try {
        const home=parsePrice("home"), stop=parsePrice("stop"), freeOver=val("free_over")===""?0:Number(val("free_over"));
        if (!Number.isFinite(freeOver) || freeOver < 0) throw new Error(`السطر ${lineNo}: قيمة الشحن المجاني غير صالحة.`);
        const freeHome=["1","true","yes"].includes(val("free_home").toLowerCase()), freeStop=["1","true","yes"].includes(val("free_stop").toLowerCase());
        if (!z) { z={name,home,stop,freeHome,freeStop,freeOver,wilayas:[]}; zones.set(name,z); }
        else if (z.home!==home || z.stop!==stop || z.freeHome!==freeHome || z.freeStop!==freeStop || z.freeOver!==freeOver) throw new Error(`السطر ${lineNo}: إعدادات المنطقة لا تطابق صفوفها السابقة.`);
        const rawId=val("wilaya_id");
        if (rawId) {
          const wid=Number(rawId); if (!Number.isInteger(wid)||!known.has(wid)) throw new Error(`السطر ${lineNo}: الولاية ${rawId} غير معروفة.`);
          if (assigned.has(wid)&&assigned.get(wid)!==name) throw new Error(`السطر ${lineNo}: الولاية ${wid} موجودة في منطقتين.`);
          assigned.set(wid,name); if (!z.wilayas.includes(wid)) z.wilayas.push(wid);
        }
        if (val("exclusions")) {
          let arr; try { arr=JSON.parse(val("exclusions")); } catch (_) { throw new Error(`السطر ${lineNo}: صيغة الاستثناءات غير صالحة.`); }
          if (!Array.isArray(arr)) throw new Error(`السطر ${lineNo}: الاستثناءات يجب أن تكون قائمة.`);
          arr.forEach(e=>{
            const wid=Number(e.wilaya_id), w=known.get(wid), mode=e.mode==="home"?"home":"all", commune=String(e.commune||"");
            if (!w) throw new Error(`السطر ${lineNo}: ولاية استثناء غير معروفة (${e.wilaya_id}).`);
            if (commune && !(w.communes||[]).includes(commune)) throw new Error(`السطر ${lineNo}: البلدية «${commune}» غير موجودة في ${w.name}.`);
            const k=`${wid}|${commune}|${mode}`; exclusions.set(k,{w:wid,c:commune,m:mode});
          });
        }
      } catch (e) { errors.push(e.message); }
    });
    if (errors.length) return {errors,zones:[],ex:[],exw:[]};
    return {errors,zones:[...zones.values()].map(z=>({...z,id:"z"+Date.now().toString(36)+Math.random().toString(36).slice(2,5)})),ex:[...exclusions.values()].filter(e=>e.c),exw:[...new Set([...exclusions.values()].filter(e=>!e.c).map(e=>e.w))]};
  }
  function csvPreview(file) {
    const reader = new FileReader(); reader.onload=()=>{
      try { preview=validateCSV(reader.result); showPreview(file.name); }
      catch(e){ preview=null; toast("تعذّر قراءة CSV: "+e.message); }
    }; reader.onerror=()=>toast("تعذّر فتح الملف."); reader.readAsText(file,"UTF-8");
  }
  function showPreview(filename) {
    const host=$("#zn-card"); if(!host||!preview)return;
    let modal=$("#znio-preview"); if(modal)modal.remove(); modal=document.createElement("div"); modal.id="znio-preview";
    const errors=preview.errors;
    modal.innerHTML=`<div class="znio-dialog" role="dialog" aria-modal="true" aria-labelledby="znio-title"><h3 id="znio-title">معاينة استيراد المناطق</h3><p>${esc(filename)} — ${preview.zones.length} منطقة، ${preview.zones.reduce((n,z)=>n+z.wilayas.length,0)} ولاية</p>${errors.length?`<div class="znio-errors">${errors.map(esc).join("<br>")}</div>`:`<div class="znio-scroll"><table><thead><tr><th>المنطقة</th><th>الولايات</th><th>المنزل</th><th>المكتب</th><th>مجاني</th></tr></thead><tbody>${preview.zones.map(z=>`<tr><td>${esc(z.name)}</td><td>${z.wilayas.length}</td><td>${z.home} دج</td><td>${z.stop} دج</td><td>${z.freeHome?"منزل ":""}${z.freeStop?"مكتب":"—"}</td></tr>`).join("")}</tbody></table></div><p class="znio-warning">سيستبدل الاستيراد المناطق والاستثناءات الحالية. يمكنك التراجع بـ Ctrl+Z قبل إجراء تعديل آخر.</p>`}<div class="znio-actions"><button type="button" data-zio-cancel>إلغاء</button><button type="button" data-zio-apply ${errors.length?"disabled":""}>تطبيق الاستيراد</button></div></div>`;
    host.appendChild(modal); modal.querySelector("[data-zio-cancel]").onclick=()=>modal.remove();
    modal.querySelector("[data-zio-apply]").onclick=()=>{saveBackup();const s=state();s.zones=preview.zones;s.ex=preview.ex;s.exw=preview.exw;refreshZones();modal.remove();preview=null;toast("تم تطبيق المناطق. اضغط «حفظ الكل» لنشر التغيير.");};
  }
  function saveBackup() { const s=state(); if(!s)return; try{localStorage.setItem(KEY,JSON.stringify({zones:s.zones,ex:s.ex,exw:s.exw}));}catch(_){} }
  function refreshZones(){AdminZones.apply();if(typeof Admin!=="undefined"&&typeof Admin.renderFees==="function")Admin.renderFees();AdminZones.draw();}
  function undo() {
    const raw=localStorage.getItem(KEY); if(!raw){toast("لا توجد نسخة تراجع محفوظة.");return;}
    try{const b=JSON.parse(raw),s=state();if(!s)throw 0;s.zones=b.zones;s.ex=b.ex;s.exw=b.exw;refreshZones();localStorage.removeItem(KEY);toast("تم التراجع عن آخر استيراد أو قالب.");}catch(_){toast("تعذّر استعادة النسخة الاحتياطية.");}
  }
  const south = new Set([1,3,7,8,11,17,30,32,33,37,39,45,47,49,50,51,52,53,54,55,56,57,58]);
  const center = new Set([5,14,20,26,28,34,38,40,41,43]);
  function template(kind, prices) {
    const ws=fees(); if(!ws.length)throw new Error("قائمة الولايات غير متاحة.");
    const home=prices.home,stop=prices.stop, zones=[];
    if(kind==="flat") zones.push({name:"سعر موحّد",home,stop,freeHome:false,freeStop:false,freeOver:0,wilayas:ws.map(w=>Number(w.id))});
    else {
      const group={"الشمال":[],"الوسط":[],"الجنوب":[]};
      ws.forEach(w=>{let parent=Number(w.id);if(parent>=59&&w.par)parent=Number(w.par);const key=south.has(parent)?"الجنوب":center.has(parent)?"الوسط":"الشمال";group[key].push(Number(w.id));});
      const rates=kind==="three"?{الشمال:[home,stop],الوسط:[home+100,stop+100],الجنوب:[home+250,stop+200]}:{الشمال:[home,stop],الوسط:[home,stop],الجنوب:[home,stop]};
      Object.keys(group).forEach(name=>zones.push({name,home:rates[name][0],stop:rates[name][1],freeHome:false,freeStop:false,freeOver:0,wilayas:group[name]}));
    }
    return zones.filter(z=>z.wilayas.length);
  }
  function applyTemplate(kind) {
    const home=Number($("#znio-home")?.value), stop=Number($("#znio-stop")?.value);
    if(!Number.isFinite(home)||home<0||!Number.isFinite(stop)||stop<0){toast("أدخل سعراً صحيحاً غير سالب.");return;}
    let zones;try{zones=template(kind,{home,stop});}catch(e){toast(e.message);return;}
    const label=kind==="flat"?"سعر موحّد":"الشمال/الوسط/الجنوب";
    if(!confirm(`سيستبدل قالب «${label}» المناطق الحالية (${state().zones.length}) بمجموعات مقترحة وأسعار قابلة للتعديل. تطبيق القالب؟`))return;
    saveBackup();const s=state();s.zones=zones;s.ex=[];s.exw=[];refreshZones();toast("طُبّق القالب المقترح. عدّل الأسعار ثم اضغط «حفظ الكل».");
  }
  function inject() {
    const host=$("#zn-card");if(!host||!state()?.inited)return;
    let bar=$("#znio-tools",host);if(bar)return;
    bar=document.createElement("div");bar.id="znio-tools";bar.className="znio-tools";
    bar.innerHTML='<div class="znio-prices"><label>منزل <input id="znio-home" type="number" min="0" value="600"> دج</label><label>مكتب <input id="znio-stop" type="number" min="0" value="400"> دج</label></div><div class="znio-actions"><button type="button" data-zio-export>تصدير CSV</button><button type="button" data-zio-import>استيراد CSV</button><button type="button" data-zio-flat>تطبيق سعر موحّد</button><button type="button" data-zio-three>تطبيق قالب المناطق</button><button type="button" data-zio-undo>تراجع Ctrl+Z</button><input type="file" accept=".csv,text/csv" hidden data-zio-file></div><p>القوالب مقترحة وقابلة للتعديل. التغييرات غير منشورة حتى تضغط «حفظ الكل».</p>';
    host.prepend(bar);
    const file=$("[data-zio-file]",bar);$("[data-zio-export]",bar).onclick=downloadCSV;$("[data-zio-import]",bar).onclick=()=>file.click();file.onchange=()=>{if(file.files[0])csvPreview(file.files[0]);file.value="";};$("[data-zio-flat]",bar).onclick=()=>applyTemplate("flat");$("[data-zio-three]",bar).onclick=()=>applyTemplate("three");$("[data-zio-undo]",bar).onclick=undo;
  }
  function addStyle() { if(styleAdded)return;styleAdded=true;const st=document.createElement("style");st.textContent=`#znio-tools{margin:12px 0;padding:12px;border:1px solid rgba(255,255,255,.16);border-radius:16px;background:rgba(255,255,255,.045)}.znio-prices,.znio-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.znio-prices label{display:flex;align-items:center;gap:5px}#znio-tools input[type=number]{width:90px;padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:#fff}#znio-tools button,.znio-actions button{padding:9px 12px;border:1px solid rgba(255,255,255,.2);border-radius:12px;background:rgba(255,255,255,.07);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -4px 8px rgba(0,0,0,.18),0 5px 12px rgba(0,0,0,.2);backdrop-filter:blur(8px);font:inherit;font-weight:800;cursor:pointer;transition:.18s}#znio-tools button:hover,.znio-actions button:hover{transform:translateY(-2px);background:rgba(255,255,255,.13)}#znio-preview{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.62);display:grid;place-items:center;padding:16px}.znio-dialog{width:min(760px,100%);max-height:90vh;overflow:auto;padding:20px;border:1px solid rgba(255,255,255,.2);border-radius:18px;background:rgba(9,24,18,.985);color:#fff;box-shadow:0 20px 60px #0008}.znio-dialog h3{margin-top:0}.znio-scroll{max-height:45vh;overflow:auto}.znio-dialog table{width:100%;border-collapse:collapse}.znio-dialog th,.znio-dialog td{padding:8px;border-bottom:1px solid #ffffff22;text-align:start}.znio-errors{padding:12px;border-radius:12px;background:#f004;color:#ffc1c1}.znio-warning{color:#ffd08a}.znio-dialog button{padding:9px 12px;border-radius:10px;border:1px solid #ffffff33;background:#ffffff12;color:white;font:inherit;cursor:pointer}.znio-dialog button:disabled{opacity:.45;cursor:not-allowed}`;document.head.appendChild(st); }
  function attach() {
    addStyle();
    const card=$("#zn-card");if(card&&!observer){observer=new MutationObserver(inject);observer.observe(card,{childList:true,subtree:false});}
    inject();
  }
  function init() {
    if(typeof AdminZones==="undefined"||!AdminZones.S)return setTimeout(init,300);
    const tick=()=>{if($("#zn-card")&&AdminZones.S.inited)attach();};
    new MutationObserver(tick).observe(document.body,{childList:true,subtree:true});tick();
    document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||"")&&$("#zn-card")&&$("#zn-card").offsetParent&&localStorage.getItem(KEY)){e.preventDefault();undo();}});
  }
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init):init();
  return {downloadCSV,parseCSV,validateCSV};
})();

