/* إدارة المخزون — تُكتب المنتجات عبر Admin.publishDataJs فقط. */
const AdminInventory = (() => {
  const $ = id => document.getElementById(id), state = { filter: "all", query: "", dirty: new Map(), low: 5, lowSha: null, loaded: false, csvRows: [], moves: [], reason: new Map(), counts: new Map(), mode: "list", logQ: "" };
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
        if (r.ok && r.j.content) { state.lowSha = r.j.sha; const j = JSON.parse(decodeURIComponent(escape(atob(String(r.j.content).replace(/\n/g, ""))))); state.low = Math.max(0, Number(j.low) || 5); state.moves = Array.isArray(j.moves) ? j.moves.slice(0, 500) : []; return; }
      } else if (typeof GH !== "undefined" && GH.cfg() && GH.cfg().token) {
        const f = await GH.getFile("assets/data/inventory.json"); state.lowSha = f.sha;
        const j = JSON.parse(decodeURIComponent(escape(atob(String(f.content || "").replace(/\n/g, ""))))); state.low = Math.max(0, Number(j.low) || 5); state.moves = Array.isArray(j.moves) ? j.moves.slice(0, 500) : []; return;
      }
    } catch (_) { }
    try { state.low = Math.max(0, Number(localStorage.getItem("admin_inv_low")) || 5); state.moves = JSON.parse(localStorage.getItem("admin_inv_moves") || "[]").slice(0, 500); } catch (_) { state.low = 5; state.moves = []; }
  }
  async function persistMeta(msg) {
    const data = JSON.stringify({ low:state.low, track:true, moves:state.moves.slice(0, 500) }, null, 2), b64 = btoa(unescape(encodeURIComponent(data)));
    if (typeof PHPAPI !== "undefined" && PHPAPI.on()) {
      const r = await PHPAPI.call("file", { method:"PUT", body:JSON.stringify({ path:"assets/data/inventory.json", content:b64, sha:state.lowSha, message:msg }) });
      if (!r.ok) throw new Error("تعذّر حفظ بيانات المخزون"); state.lowSha = r.j.content && r.j.content.sha;
    } else if (typeof GH !== "undefined" && GH.cfg() && GH.cfg().token) {
      const r = await GH.putFile("assets/data/inventory.json", b64, state.lowSha, msg); state.lowSha = r && r.content ? r.content.sha : state.lowSha;
    } else { localStorage.setItem("admin_inv_low", String(state.low)); localStorage.setItem("admin_inv_moves", JSON.stringify(state.moves.slice(0, 500))); }
  }
  async function saveLow(value) {
    const n = Number(value); if (!Number.isInteger(n) || n < 0) { toast("أدخل حداً صحيحاً غير سالب"); return; }
    state.low = n;
    try { await persistMeta("تحديث حد المخزون المنخفض"); toast("تم حفظ حد المخزون"); render(); }
    catch (e) { toast("تعذّر حفظ الحد: " + (e.message || "")); }
  }
  function render() {
    const host = $("inventory-content"); if (!host) return;
    loadLow().then(() => {
      if (state.mode === "count") return drawCount(host);
      if (state.mode === "log") return drawLog(host);
      const all = rows(), sold = soldCounts(), low = all.filter(r => statusOf(stockOf(r)) === "low").length, out = all.filter(r => statusOf(stockOf(r)) === "out").length;
      let list = all.filter(r => { const s = statusOf(stockOf(r)), f = state.filter; return (f === "all" || s === f) && (!state.query || (r.title + " " + r.p.slug).toLowerCase().includes(state.query)); });
      host.innerHTML = `<div class="card"><b>تنبيه المخزون</b><p>${low} منخفض · ${out} نافد</p><button class="small warn" type="button" data-filter="low">عرض المنخفض</button> <button class="small warn" type="button" data-filter="out">عرض النافد</button><button class="small" type="button" id="inv-count">📋 جرد</button> <button class="small" type="button" id="inv-log">🕘 سجلّ الحركة (${state.moves.length})</button> <label>حد المنخفض <input id="inv-low" type="number" min="0" step="1" value="${state.low}" style="width:90px"></label><button class="small" id="inv-low-save">حفظ الحد</button></div>
        <div class="card"><div class="search-bar"><input id="inv-search" placeholder="بحث بالاسم أو slug" value="${esc(state.query)}"><select id="inv-filter"><option value="all">الكل</option><option value="low">منخفض</option><option value="out">نافد</option><option value="untracked">غير متتبَّع</option></select><button class="small" id="inv-save" ${state.dirty.size ? "" : "disabled"}>حفظ التغييرات (${state.dirty.size})</button><button class="small" id="inv-bulk">ضبط دفعة</button><button class="small" id="inv-export">تصدير CSV</button><button class="small" id="inv-import">استيراد CSV</button><input id="inv-file" type="file" accept=".csv,text/csv" hidden></div><div id="inv-preview"></div><div class="rtw" style="overflow:auto"><table class="rt"><thead><tr><th></th><th>الصورة</th><th>المنتج / التنويع</th><th>المخزون</th><th>الحالة</th><th>مبيع في طلبات غير مسلَّمة</th></tr></thead><tbody>${list.map(r => { const s=statusOf(stockOf(r)), img=r.v && r.v.image || r.p.cover || (r.p.images||[])[0] || ""; return `<tr data-row-search="${esc((r.title+" "+r.p.slug).toLowerCase())}"><td><input type="checkbox" data-select="${esc(r.key)}" aria-label="اختيار ${esc(r.title)}"></td><td>${img?`<img src="${esc(img)}" alt="" width="44" height="44" style="object-fit:cover;border-radius:9px">`:"—"}</td><td>${esc(r.title)}<small style="display:block;opacity:.65" dir="ltr">${esc(r.key)}</small></td><td><input type="number" min="0" step="1" data-stock="${esc(r.key)}" value="${stockOf(r)==null?"":esc(stockOf(r))}" placeholder="—" style="width:90px"></td><td><span class="pill ${s === "out" ? "st-annulee" : s === "low" ? "st-nouvelle" : "st-livree"}">${statusText(s)}</span></td><td>${Number(sold.get(r.key) || (r.v ? 0 : sold.get(r.p.slug)) || 0)}</td></tr>`; }).join("") || `<tr><td colspan="6">لا توجد نتائج</td></tr>`}</tbody></table></div></div>`;
      $("inv-filter").value = state.filter;
      host.querySelectorAll("[data-filter]").forEach(b => b.onclick = () => { state.filter = b.dataset.filter; render(); });
      $("inv-low-save").onclick = () => saveLow($("inv-low").value);
      $("inv-count").onclick = () => { state.mode = "count"; render(); };
      $("inv-log").onclick = () => { state.mode = "log"; render(); };
      $("inv-search").oninput = e => { state.query=e.target.value.toLowerCase(); host.querySelectorAll("[data-row-search]").forEach(row => { row.hidden = !row.dataset.rowSearch.includes(state.query); }); };
      $("inv-filter").onchange = e => { state.filter=e.target.value; render(); };
      host.querySelectorAll("[data-stock]").forEach(inp => inp.oninput = () => { state.reason.set(inp.dataset.stock, "تعديل يدوي"); state.dirty.set(inp.dataset.stock, inp.value === "" ? null : Number(inp.value)); const b=$("inv-save"); if(b){b.disabled=false;b.textContent="حفظ التغييرات (توجد تعديلات)";} });
      $("inv-save").onclick = saveChanges;
      $("inv-bulk").onclick = bulk;
      $("inv-export").onclick = exportCsv;
      $("inv-import").onclick = () => $("inv-file").click();
      $("inv-file").onchange = e => { const f=e.target.files[0]; if(f){const r=new FileReader();r.onload=()=>previewCsv(String(r.result||""));r.readAsText(f);} };
    });
  }
  async function saveChanges() {
    if (!state.dirty.size) return;
    const index = new Map(rows().map(r => [r.key, r])), moves = [], at = new Date().toISOString(), same = (a, b) => (a == null || a === "") ? (b == null || b === "") : (b != null && b !== "" && Number(a) === Number(b));
    state.dirty.forEach((value, key) => { const r=index.get(key); if(!r)return; if(!same(r.stock, value)) moves.push({ at, key, title:r.title, from:r.stock == null || r.stock === "" ? null : Number(r.stock), to:value == null ? null : Number(value), reason:state.reason.get(key) || "تعديل يدوي" }); if(r.v) r.v.stock=value; else r.p.stock=value; });
    const ok = await Admin.publishDataJs();
    if (ok) {
      state.dirty.clear(); state.reason.clear();
      if (moves.length) { state.moves = moves.concat(state.moves).slice(0, 500); try { await persistMeta("سجلّ حركة المخزون"); } catch (e) { toast("حُفظ المخزون لكن تعذّر حفظ السجلّ: " + (e.message || "")); } }
      toast("تم حفظ المخزون"); render();
    }
  }
  function drawCount(host) {
    const all = rows(), counted = all.filter(r => state.counts.has(r.key) && state.counts.get(r.key) !== "");
    host.innerHTML = `<div class="card"><b>📋 جرد المخزون</b><p class="hint">أدخل الكمية الفعلية التي عددتها. الفروق: <span style="color:#f87171">أحمر = أقل من المسجَّل</span> · <span style="color:#fbbf24">أصفر = أكثر</span> · <span style="color:#4ade80">أخضر = مطابق</span>. لا يتغيّر شيء قبل «تطبيق الجرد».</p><button class="small" type="button" id="ic-apply">تطبيق الجرد (<span id="ic-n">0</span>)</button> <button class="small warn" type="button" id="ic-back">رجوع</button></div><div class="card"><div class="rtw" style="overflow:auto"><table class="rt"><thead><tr><th>المنتج / التنويع</th><th>المسجَّل</th><th>الفعلي</th><th>الفرق</th></tr></thead><tbody>${all.map(r => `<tr><td>${esc(r.title)}<small style="display:block;opacity:.65" dir="ltr">${esc(r.key)}</small></td><td>${r.stock == null || r.stock === "" ? "—" : esc(r.stock)}</td><td><input type="number" min="0" step="1" data-ic="${esc(r.key)}" value="${state.counts.has(r.key) ? esc(state.counts.get(r.key)) : ""}" style="width:90px"></td><td data-icd="${esc(r.key)}">—</td></tr>`).join("")}</tbody></table></div></div>`;
    const idx = new Map(all.map(r => [r.key, r]));
    const diff = key => {
      const r = idx.get(key), v = state.counts.get(key), cell = host.querySelector('[data-icd="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"]');
      if (!cell) return;
      if (v === "" || v == null) { cell.textContent = "—"; cell.style.color = ""; return; }
      const d = Number(v) - Number(r.stock || 0);
      cell.textContent = d > 0 ? "+" + d : String(d); cell.style.color = d < 0 ? "#f87171" : d > 0 ? "#fbbf24" : "#4ade80"; cell.style.fontWeight = "800";
    };
    const upd = () => { const n = [...state.counts.entries()].filter(([k, v]) => v !== "" && idx.has(k) && Number(v) !== Number(idx.get(k).stock || 0)).length; const e = $("ic-n"); if (e) e.textContent = n; };
    host.querySelectorAll("[data-ic]").forEach(inp => { diff(inp.dataset.ic); inp.oninput = () => { const v = inp.value.trim(); if (v === "" || (/^\d+$/.test(v))) state.counts.set(inp.dataset.ic, v); diff(inp.dataset.ic); upd(); }; });
    upd();
    $("ic-back").onclick = () => { state.mode = "list"; render(); };
    $("ic-apply").onclick = () => {
      let n = 0;
      state.counts.forEach((v, k) => { const r = idx.get(k); if (!r || v === "" || Number(v) === Number(r.stock || 0) && r.stock != null && r.stock !== "") return; state.reason.set(k, "جرد"); state.dirty.set(k, Number(v)); n++; });
      if (!n) { toast("لا فروق لتطبيقها"); return; }
      state.counts.clear(); state.mode = "list"; saveChanges();
    };
  }
  function drawLog(host) {
    const q = state.logQ.toLowerCase(), list = state.moves.filter(m => !q || (String(m.title) + " " + String(m.key) + " " + String(m.reason)).toLowerCase().includes(q));
    host.innerHTML = `<div class="card"><b>🕘 سجلّ حركة المخزون</b><p class="hint">آخر ${state.moves.length} حركة (الحد 500)، تُسجَّل عند الحفظ من هذا التبويب فقط؛ أما خصم المخزون بسبب الطلبات فلا يظهر هنا.</p><input id="il-q" placeholder="بحث" value="${esc(state.logQ)}"> <button class="small" type="button" id="il-csv">تصدير CSV</button> <button class="small warn" type="button" id="il-back">رجوع</button></div><div class="card"><div class="rtw" style="overflow:auto"><table class="rt"><thead><tr><th>التاريخ</th><th>المنتج</th><th>قبل ← بعد</th><th>السبب</th></tr></thead><tbody>${list.map(m => `<tr><td dir="ltr">${esc(String(m.at || "").replace("T", " ").slice(0, 16))}</td><td>${esc(m.title)}<small style="display:block;opacity:.65" dir="ltr">${esc(m.key)}</small></td><td>${m.from == null ? "—" : esc(m.from)} ← ${m.to == null ? "—" : esc(m.to)}</td><td>${esc(m.reason)}</td></tr>`).join("") || `<tr><td colspan="4">لا توجد حركات</td></tr>`}</tbody></table></div></div>`;
    $("il-back").onclick = () => { state.mode = "list"; render(); };
    $("il-q").oninput = e => { state.logQ = e.target.value; const pos = e.target.selectionStart; drawLog(host); const n = $("il-q"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } };
    $("il-csv").onclick = () => {
      const lines = [["date","key","title","from","to","reason"].join(","), ...list.map(m => [m.at, m.key, m.title, m.from == null ? "" : m.from, m.to == null ? "" : m.to, m.reason].map(csvEscape).join(","))];
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\uFEFF" + lines.join("\r\n")], { type:"text/csv;charset=utf-8" })); a.download = "inventory-moves.csv"; a.click(); URL.revokeObjectURL(a.href);
    };
  }
  function bulk() {
    const selected = [...document.querySelectorAll("[data-select]:checked")].map(x=>x.dataset.select); if(!selected.length){toast("اختر منتجاً واحداً على الأقل");return;}
    const raw=prompt("أدخل قيمة جديدة (12) أو زيادة/نقصان (+5 أو -2)"); if(raw==null||!raw.trim())return;
    const re=/^[+-]\d+$/.test(raw.trim()), delta=Number(raw), index=new Map(rows().map(r=>[r.key,r]));
    if(!re && (!Number.isInteger(delta) || delta < 0)){toast("أدخل كمية صحيحة غير سالبة أو زيادة/نقصان مثل +5 أو -2");return;}
    selected.forEach(k=>{const r=index.get(k);if(!r)return;const cur=Number(stockOf(r)||0);state.reason.set(k,"تعديل جماعي");state.dirty.set(k,Math.max(0,re?cur+delta:delta));}); render();
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
    const b=$("inv-apply-import");if(b)b.onclick=()=>{state.csvRows.filter(x=>x.valid).forEach(x=>{state.reason.set(x.key,"استيراد");state.dirty.set(x.key,x.stock===""?null:Number(x.stock));});state.csvRows=[];render();};
  }
  function init() {
    if (typeof Admin === "undefined" || Admin.__inventoryHook) return; Admin.__inventoryHook=1;
    const original=Admin.tab; Admin.tab=function(t,btn){const r=original.call(this,t,btn);const host=$("tab-inventory");document.querySelectorAll('[id^="tab-"]').forEach(el=>el.classList.toggle("hidden",el!==host&&el.id!=="tab-"+t));if(host)host.classList.toggle("hidden",t!=="inventory");if(t==="inventory")render();return r;};
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded",init) : init();
  return { render };
})();
