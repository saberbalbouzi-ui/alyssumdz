/* إدارة المخزون — تُكتب المنتجات عبر Admin.publishDataJs فقط. */
const AdminInventory = (() => {
  const $ = id => document.getElementById(id), state = { filter: "all", query: "", dirty: new Map(), low: 5, lowSha: null, loaded: false, csvRows: [] };
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const products = () => (typeof Admin !== "undefined" && Array.isArray(Admin.products)) ? Admin.products : [];
  const keyOf = (p, v) => p.slug + (v ? ":" + (v.id || v.sku || Object.values(v.attrs || {}).join("-") || "variation") : "");
  function rows() {
    const out = [];
    products().forEach(p => {
      const vars = p.type === "variable" && Array.isArray(p.variations) ? p.variations : [];
      if (vars.length) vars.forEach(v => out.push({ p, v, key: keyOf(p, v), title: p.title + " — " + Object.values(v.attrs || {}).join(" / "), stock: v.stock }));
      else out.push({ p, v: null, key: keyOf(p), title: p.title || p.slug, stock: p.stock });
    });
    return out;
  }
  function stockOf(r) { return state.dirty.has(r.key) ? state.dirty.get(r.key) : r.stock; }
  function statusOf(stock) { if (stock == null || stock === "") return "untracked"; const n = Number(stock); return n <= 0 ? "out" : n <= state.low ? "low" : "available"; }
  const statusText = s => ({ available:"متوفر", low:"منخفض", out:"نافد", untracked:"غير متتبَّع" }[s]);
  function soldCounts() {
    const counts = new Map(), orders = (Admin && Admin.orders) || [], cancelled = ["annulee", "annulée", "cancelled", "canceled"];
    orders.forEach(o => {
      if (String(o.status || "").toLowerCase() === "livree" || cancelled.includes(String(o.status || "").toLowerCase())) return;
      let items = (Array.isArray(o.items) && o.items.length ? o.items : null) || o.items_text || o.products || o.lines || [];
      if (typeof items === "string") { try { items = JSON.parse(items); } catch (_) { items = []; } }
      if (!Array.isArray(items)) items = [];
      items.forEach(it => { const slug = it.slug || it.productSlug || it.product_slug || (typeof it.product === "string" ? it.product : ""), qty = Number(it.qty || it.quantity) || 0, vid = it.vid || it.variationId || it.variation_id; if (slug) { counts.set(slug, (counts.get(slug) || 0) + qty); if (vid) counts.set(slug + ":" + vid, (counts.get(slug + ":" + vid) || 0) + qty); } });
    });
    return counts;
  }
  async function loadLow() {
    if (state.loaded) return;
    state.loaded = true;
    try {
      if (typeof PHPAPI !== "undefined" && PHPAPI.on()) {
        const r = await PHPAPI.call("file", { method:"GET" }, "&path=assets%2Fdata%2Finventory.json&t=" + Date.now());
        if (r.ok && r.j.content) { state.lowSha = r.j.sha; const j = JSON.parse(decodeURIComponent(escape(atob(String(r.j.content).replace(/\n/g, ""))))); state.low = Math.max(0, Number(j.low) || 5); return; }
      } else if (typeof GH !== "undefined" && GH.cfg() && GH.cfg().token) {
        const f = await GH.getFile("assets/data/inventory.json"); state.lowSha = f.sha;
        const j = JSON.parse(decodeURIComponent(escape(atob(String(f.content || "").replace(/\n/g, ""))))); state.low = Math.max(0, Number(j.low) || 5); return;
      }
    } catch (_) { }
    try { state.low = Math.max(0, Number(localStorage.getItem("admin_inv_low")) || 5); } catch (_) { state.low = 5; }
  }
  async function saveLow(value) {
    const n = Number(value); if (!Number.isInteger(n) || n < 0) { toast("أدخل حداً صحيحاً غير سالب"); return; }
    state.low = n;
    const data = JSON.stringify({ low:n, track:true }, null, 2), b64 = btoa(unescape(encodeURIComponent(data)));
    try {
      if (typeof PHPAPI !== "undefined" && PHPAPI.on()) {
        const r = await PHPAPI.call("file", { method:"PUT", body:JSON.stringify({ path:"assets/data/inventory.json", content:b64, sha:state.lowSha, message:"تحديث حد المخزون المنخفض" }) });
        if (!r.ok) throw new Error("تعذّر حفظ حد المخزون"); state.lowSha = r.j.content && r.j.content.sha;
      } else if (typeof GH !== "undefined" && GH.cfg() && GH.cfg().token) {
        const r = await GH.putFile("assets/data/inventory.json", b64, state.lowSha, "تحديث حد المخزون المنخفض"); state.lowSha = r && r.content ? r.content.sha : state.lowSha;
      } else { localStorage.setItem("admin_inv_low", String(n)); }
      toast("تم حفظ حد المخزون"); render();
    } catch (e) { toast("تعذّر حفظ الحد: " + (e.message || "")); }
  }
  function render() {
    const host = $("inventory-content"); if (!host) return;
    loadLow().then(() => {
      const all = rows(), sold = soldCounts(), low = all.filter(r => statusOf(stockOf(r)) === "low").length, out = all.filter(r => statusOf(stockOf(r)) === "out").length;
      let list = all.filter(r => { const s = statusOf(stockOf(r)), f = state.filter; return (f === "all" || s === f) && (!state.query || (r.title + " " + r.p.slug).toLowerCase().includes(state.query)); });
      host.innerHTML = `<div class="card"><b>تنبيه المخزون</b><p>${low} منخفض · ${out} نافد</p><button class="small warn" type="button" data-filter="low">عرض المنخفض</button> <button class="small warn" type="button" data-filter="out">عرض النافد</button><label>حد المنخفض <input id="inv-low" type="number" min="0" step="1" value="${state.low}" style="width:90px"></label><button class="small" id="inv-low-save">حفظ الحد</button></div>
        <div class="card"><div class="search-bar"><input id="inv-search" placeholder="بحث بالاسم أو slug" value="${esc(state.query)}"><select id="inv-filter"><option value="all">الكل</option><option value="low">منخفض</option><option value="out">نافد</option><option value="untracked">غير متتبَّع</option></select><button class="small" id="inv-save" ${state.dirty.size ? "" : "disabled"}>حفظ التغييرات (${state.dirty.size})</button><button class="small" id="inv-bulk">ضبط دفعة</button><button class="small" id="inv-export">تصدير CSV</button><button class="small" id="inv-import">استيراد CSV</button><input id="inv-file" type="file" accept=".csv,text/csv" hidden></div><div id="inv-preview"></div><div class="rtw" style="overflow:auto"><table class="rt"><thead><tr><th></th><th>الصورة</th><th>المنتج / التنويع</th><th>المخزون</th><th>الحالة</th><th>مبيع في طلبات غير مسلَّمة</th></tr></thead><tbody>${list.map(r => { const s=statusOf(stockOf(r)), img=r.v && r.v.image || r.p.cover || (r.p.images||[])[0] || ""; return `<tr data-row-search="${esc((r.title+" "+r.p.slug).toLowerCase())}"><td><input type="checkbox" data-select="${esc(r.key)}" aria-label="اختيار ${esc(r.title)}"></td><td>${img?`<img src="${esc(img)}" alt="" width="44" height="44" style="object-fit:cover;border-radius:9px">`:"—"}</td><td>${esc(r.title)}<small style="display:block;opacity:.65" dir="ltr">${esc(r.key)}</small></td><td><input type="number" min="0" step="1" data-stock="${esc(r.key)}" value="${stockOf(r)==null?"":esc(stockOf(r))}" placeholder="—" style="width:90px"></td><td><span class="pill ${s === "out" ? "st-annulee" : s === "low" ? "st-nouvelle" : "st-livree"}">${statusText(s)}</span></td><td>${Number(sold.get(r.key) || (r.v ? 0 : sold.get(r.p.slug)) || 0)}</td></tr>`; }).join("") || `<tr><td colspan="6">لا توجد نتائج</td></tr>`}</tbody></table></div></div>`;
      $("inv-filter").value = state.filter;
      host.querySelectorAll("[data-filter]").forEach(b => b.onclick = () => { state.filter = b.dataset.filter; render(); });
      $("inv-low-save").onclick = () => saveLow($("inv-low").value);
      $("inv-search").oninput = e => { state.query=e.target.value.toLowerCase(); host.querySelectorAll("[data-row-search]").forEach(row => { row.hidden = !row.dataset.rowSearch.includes(state.query); }); };
      $("inv-filter").onchange = e => { state.filter=e.target.value; render(); };
      host.querySelectorAll("[data-stock]").forEach(inp => inp.oninput = () => { state.dirty.set(inp.dataset.stock, inp.value === "" ? null : Number(inp.value)); const b=$("inv-save"); if(b){b.disabled=false;b.textContent="حفظ التغييرات (توجد تعديلات)";} });
      $("inv-save").onclick = saveChanges;
      $("inv-bulk").onclick = bulk;
      $("inv-export").onclick = exportCsv;
      $("inv-import").onclick = () => $("inv-file").click();
      $("inv-file").onchange = e => { const f=e.target.files[0]; if(f){const r=new FileReader();r.onload=()=>previewCsv(String(r.result||""));r.readAsText(f);} };
    });
  }
  async function saveChanges() {
    if (!state.dirty.size) return;
    const index = new Map(rows().map(r => [r.key, r]));
    state.dirty.forEach((value, key) => { const r=index.get(key); if(!r)return; if(r.v) r.v.stock=value; else r.p.stock=value; });
    const ok = await Admin.publishDataJs();
    if (ok) { state.dirty.clear(); toast("تم حفظ المخزون"); render(); }
  }
  function bulk() {
    const selected = [...document.querySelectorAll("[data-select]:checked")].map(x=>x.dataset.select); if(!selected.length){toast("اختر منتجاً واحداً على الأقل");return;}
    const raw=prompt("أدخل قيمة جديدة (12) أو زيادة/نقصان (+5 أو -2)"); if(raw==null||!raw.trim())return;
    const re=/^[+-]\d+$/.test(raw.trim()), delta=Number(raw), index=new Map(rows().map(r=>[r.key,r]));
    if(!re && (!Number.isInteger(delta) || delta < 0)){toast("أدخل كمية صحيحة غير سالبة أو زيادة/نقصان مثل +5 أو -2");return;}
    selected.forEach(k=>{const r=index.get(k);if(!r)return;const cur=Number(stockOf(r)||0);state.dirty.set(k,Math.max(0,re?cur+delta:delta));}); render();
  }
  function csvEscape(s) { return '"' + String(s == null ? "" : s).replace(/"/g,'""') + '"'; }
  function exportCsv() {
    const lines=[["slug","title","stock","status"].join(","), ...rows().map(r=>[r.key,r.title,stockOf(r)==null?"":stockOf(r),statusText(statusOf(stockOf(r)))].map(csvEscape).join(","))];
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"}));a.download="inventory.csv";a.click();URL.revokeObjectURL(a.href);
  }
  function parseCsv(text) {
    const out=[];let row=[],field="",quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted&&c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===","&&!quoted){row.push(field);field="";}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&text[i+1]==="\n")i++;row.push(field);if(row.some(x=>x.trim()))out.push(row);row=[];field="";}else field+=c;}if(field||row.length){row.push(field);out.push(row);}return out;
  }
  function previewCsv(text) {
    const parsed=parseCsv(text), header=(parsed.shift()||[]).map(x=>x.trim().toLowerCase()), si=header.indexOf("slug"), ti=header.indexOf("stock"), map=new Map(rows().map(r=>[r.key,r]));
    if(si<0||ti<0){toast("يجب أن يحتوي CSV على عمودي slug وstock");return;}
    state.csvRows=parsed.map(r=>{const key=(r[si]||"").trim(), stock=(r[ti]||"").trim(), target=map.get(key);return {key,stock,target,valid:!!target&&(stock===""||/^\d+$/.test(stock))};});
    const preview=$("inv-preview");preview.innerHTML=`<div class="card"><b>معاينة الاستيراد</b><p>${state.csvRows.filter(x=>x.valid).length} تعديل صالح · ${state.csvRows.filter(x=>!x.valid).length} سطر متجاهل</p><div style="max-height:220px;overflow:auto">${state.csvRows.slice(0,60).map(x=>`<div>${x.valid?"✓":"—"} ${esc(x.key)}: ${x.valid?esc(x.stock||"غير متتبَّع"):"غير مطابق أو قيمة غير صالحة"}</div>`).join("")}</div><button class="small" id="inv-apply-import" ${state.csvRows.some(x=>x.valid)?"":"disabled"}>تطبيق التغييرات</button></div>`;
    const b=$("inv-apply-import");if(b)b.onclick=()=>{state.csvRows.filter(x=>x.valid).forEach(x=>state.dirty.set(x.key,x.stock===""?null:Number(x.stock)));state.csvRows=[];render();};
  }
  function init() {
    if (typeof Admin === "undefined" || Admin.__inventoryHook) return; Admin.__inventoryHook=1;
    const original=Admin.tab; Admin.tab=function(t,btn){const r=original.call(this,t,btn);const host=$("tab-inventory");document.querySelectorAll('[id^="tab-"]').forEach(el=>el.classList.toggle("hidden",el!==host&&el.id!=="tab-"+t));if(host)host.classList.toggle("hidden",t!=="inventory");if(t==="inventory")render();return r;};
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded",init) : init();
  return { render };
})();
