/* فحص جودة المنتجات — يقرأ المنتجات والصور فقط ولا يكتب البيانات. */
const AdminAudit = (() => {
  const $ = id => document.getElementById(id), A = () => typeof Admin !== "undefined" ? Admin : {};
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const S = { products: [], damaged: [], filter: "all", busy: false };
  const ISSUE = { critical: "حرجة", high: "عالية", medium: "متوسطة", low: "منخفضة" };
  const points = { critical: 30, high: 18, medium: 10, low: 5 };
  const norm = s => String(s || "").normalize("NFKC").toLowerCase().replace(/[\s\u0640ً-ْ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي");
  function imageUrl(url) { const s = String(url || "").trim(); if (!s || /^(javascript|vbscript):/i.test(s)) return ""; return s; }
  function checkImage(src) {
    return new Promise(resolve => {
      const url = imageUrl(src); if (!url) return resolve(false);
      const img = new Image(); let done = false;
      const timer = setTimeout(() => finish(false), 12000);
      const finish = ok => { if (done) return; done = true; clearTimeout(timer); img.onload = img.onerror = null; resolve(ok); };
      img.onload = () => finish(img.naturalWidth > 0 && img.naturalHeight > 0); img.onerror = () => finish(false);
      img.src = url; if (img.complete) finish(img.naturalWidth > 0 && img.naturalHeight > 0);
    });
  }
  function addIssue(list, severity, code, message) { list.push({ severity, code, message, points: points[severity] }); }
  async function inspect(p, titles) {
    const issues = [], title = String(p.title || "").trim(), imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [], cover = p.cover || "";
    if (!cover) addIssue(issues, "critical", "cover", "لا يوجد غلاف للمنتج");
    const allImgs = [...new Set([cover, ...imgs].filter(Boolean))], broken = (await Promise.all(allImgs.map(checkImage))).filter(ok=>!ok).length;
    if (broken) addIssue(issues, "critical", "broken", `${broken} صورة مكسورة أو غير قابلة للتحميل`);
    if (allImgs.length < 3) addIssue(issues, "medium", "few-images", "أقل من 3 صور للمنتج");
    const desc = String(p.desc || p.description || "").trim(); if (desc.length < 80) addIssue(issues, "medium", "short-desc", desc ? `الوصف قصير (${desc.length}/80 حرفاً)` : "الوصف مفقود");
    if (!p.cat) addIssue(issues, "medium", "category", "المنتج بلا فئة");
    if (!Array.isArray(p.tags) || !p.tags.some(x => String(x).trim())) addIssue(issues, "low", "tags", "المنتج بلا وسوم");
    const price = Number(p.price), old = p.old === "" || p.old == null ? null : Number(p.old);
    if (old != null && Number.isFinite(old) && old <= price) addIssue(issues, "medium", "old-price", "السعر القديم ليس أكبر من السعر الحالي");
    if (Number.isFinite(price) && price === 0) addIssue(issues, "high", "zero-price", "السعر يساوي صفراً");
    if (title.length > 70) addIssue(issues, "low", "long-title", `العنوان طويل (${title.length}/70 حرفاً)`);
    if (title && titles.get(norm(title)) > 1) addIssue(issues, "high", "duplicate-title", "عنوان المنتج مكرر");
    if (p.active !== false && p.stock != null && Number(p.stock) === 0) addIssue(issues, "high", "out-stock", "المنتج نشط ومخزونه صفر");
    if (allImgs.some(src => !/\.webp(?:[?#]|$)/i.test(String(src)))) addIssue(issues, "low", "not-webp", "توجد صورة ليست بصيغة WebP");
    if (!p.slug || /[\s\u0600-\u06ff]/i.test(String(p.slug))) addIssue(issues, "high", "slug", "الرابط يحتوي أحرفاً غير لاتينية أو مسافات");
    const order = { critical: 0, high: 1, medium: 2, low: 3 }; issues.sort((a,b) => order[a.severity]-order[b.severity]);
    return { slug: String(p.slug || ""), title, score: Math.max(0, 100 - issues.reduce((n,x)=>n+x.points,0)), issues };
  }
  function exportCsv(rows) {
    const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const data = [["slug","title","score","severity","issue"], ...rows.flatMap(p => p.issues.length ? p.issues.map(i => [p.slug,p.title,p.score,ISSUE[i.severity],i.message]) : [[p.slug,p.title,p.score,"","لا توجد مشكلة"]])];
    const blob = new Blob(["\uFEFF" + data.map(r=>r.map(q).join(",")).join("\r\n")], { type:"text/csv;charset=utf-8" }), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "product-audit.csv"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  async function damagedReturns() {
    try {
      if (typeof AdminReturns === "undefined" || typeof AdminReturns.ensure !== "function") return [];
      await AdminReturns.ensure();
      return AdminReturns.items().filter(r => /تالف|تلف|damag/i.test(String(r.reason || ""))).flatMap(r => (r.items || []).map(item => {
        const p = (A().products || []).find(x => x.slug === item.slug);
        return { slug:String(item.slug || ""), title:p && p.title || item.slug || "منتج محذوف", variant:String(item.variantKey || ""), qty:Number(item.qty) || 0, orderId:String(r.orderId || ""), reason:String(r.reason || ""), date:r.date || r.createdAt || "", restock:item.restock !== false };
      }));
    } catch (_) { return []; }
  }
  function exportDamaged() {
    const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const rows = [["slug","product","variant","orderId","reason","qty","date"], ...S.damaged.map(x => [x.slug,x.title,x.variant,x.orderId,x.reason,x.qty,x.date])];
    const a=document.createElement("a"),url=URL.createObjectURL(new Blob(["\uFEFF"+rows.map(r=>r.map(q).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}));
    a.href=url;a.download="damaged-returns.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function damagedCard() {
    const card=document.createElement("section");card.className="aa-card aa-wrap";
    const rows=S.damaged.map(d=>"<tr><td><b>"+esc(d.title)+"</b><br><small>"+esc(d.slug)+(d.variant?" · "+esc(d.variant):"")+"</small></td><td dir=\"ltr\">#"+esc(d.orderId)+"</td><td>"+esc(d.reason)+"</td><td>"+d.qty+"</td><td>"+esc(new Date(d.date).toLocaleDateString("ar-DZ"))+"</td><td>"+(d.restock?"أُشير إلى إعادة المخزون":"مستثنى من إعادة المخزون")+"</td></tr>").join("");
    card.innerHTML="<div class=\"aa-head\"><div><h3>سجلّ المنتجات في المرتجعات التالفة ("+S.damaged.length+")</h3><div class=\"aa-damage-muted\">مستخرج من سجل المرتجعات؛ لا يغيّر حالتها أو المخزون.</div></div><button type=\"button\" class=\"aa-btn\" id=\"aa-damage-export\" "+(S.damaged.length?"":"disabled")+">تصدير السجل CSV</button></div><div class=\"aa-wrap\">"+(rows?"<table><thead><tr><th>المنتج</th><th>الطلب</th><th>السبب</th><th>الكمية</th><th>التاريخ</th><th>ملاحظة المخزون</th></tr></thead><tbody>"+rows+"</tbody></table>":"<div class=\"aa-empty\">لا توجد مرتجعات مسجّلة بسبب تلف.</div>")+"</div>";
    return card;
  }
  function shown() { return S.products.filter(p => S.filter === "all" || p.issues.some(i => i.severity === S.filter)); }
  function draw() {
    const host = $("admin-audit-app"); if (!host) return;
    const rows = shown(), counts = Object.fromEntries(Object.keys(ISSUE).map(k=>[k,S.products.filter(p=>p.issues.some(i=>i.severity===k)).length]));
    host.innerHTML = `<style>#aa{display:grid;gap:14px;color:#fff}#aa *{box-sizing:border-box}#aa .aa-card{padding:16px;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025));box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 12px 28px rgba(0,0,0,.24)}#aa .aa-head{display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap}#aa h2{margin:0}#aa .aa-muted{color:#b4c9be}#aa .aa-filters{display:flex;gap:7px;flex-wrap:wrap}#aa .aa-btn{padding:8px 12px;color:#fff;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);border-radius:11px;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -5px 8px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.2);backdrop-filter:blur(8px);cursor:pointer;transition:transform .18s,background .18s}#aa .aa-btn:hover{transform:translateY(-2px);background:rgba(74,222,128,.22)}#aa .aa-score{font-weight:900;font-size:1.05rem}#aa .aa-score.bad{color:#ff9aa2}#aa .aa-score.mid{color:#fdba74}#aa .aa-issues{display:grid;gap:4px;min-width:230px}#aa .aa-issue{font-size:.82rem}#aa .critical{color:#ff9aa2}#aa .high{color:#fdba74}#aa .medium{color:#f3d47b}#aa .low{color:#a9cfbd}#aa table{width:100%;border-collapse:collapse;min-width:700px}#aa th,#aa td{text-align:start;padding:10px;border-bottom:1px solid rgba(255,255,255,.09);vertical-align:top}#aa th{color:#b4c9be}#aa .aa-wrap{overflow:auto}#aa .aa-empty{text-align:center;color:#b4c9be;padding:30px}#aa .aa-damage-tag{display:inline-block;margin-top:5px;padding:3px 8px;border:1px solid #fca5a555;border-radius:99px;color:#fca5a5;font-size:.78rem}#aa .aa-damage-muted{color:#b4c9be;font-size:.85rem}@media(max-width:700px){#aa .aa-card{padding:12px}}</style><div id="aa"><div class="aa-card"><div class="aa-head"><div><h2>فحص جودة المنتجات</h2><div class="aa-muted">فحص للصور والمحتوى والأسعار والروابط — قراءة فقط</div></div><div class="aa-filters"><button class="aa-btn" data-filter="all">الكل (${S.products.length})</button>${Object.keys(ISSUE).map(k=>`<button class="aa-btn" data-filter="${k}">${ISSUE[k]} (${counts[k]})</button>`).join("")}<button class="aa-btn" id="aa-export">تصدير CSV</button></div></div></div><div class="aa-card aa-wrap">${S.busy ? '<div class="aa-empty">جارٍ فحص صور المنتجات…</div>' : rows.length ? `<table><thead><tr><th>المنتج</th><th>الدرجة</th><th>المشكلات حسب الخطورة</th><th></th></tr></thead><tbody>${rows.map(p=>`<tr><td><b>${esc(p.title || "بلا عنوان")}</b><br><small class="aa-muted">${esc(p.slug)}</small>${S.damaged.some(d=>d.slug===p.slug)?`<br><small class="aa-damage-tag">مرتجع بسبب تلف ×${S.damaged.filter(d=>d.slug===p.slug).reduce((n,d)=>n+d.qty,0)}</small>`:""}</td><td><span class="aa-score ${p.score<60?"bad":p.score<80?"mid":""}">${p.score}/100</span></td><td><div class="aa-issues">${p.issues.length ? p.issues.map(i=>`<span class="aa-issue ${i.severity}"><b>${ISSUE[i.severity]}:</b> ${esc(i.message)}</span>`).join("") : '<span class="aa-muted">لا توجد مشكلات</span>'}</div></td><td><button type="button" class="aa-btn" data-edit="${esc(p.slug)}">تعديل</button></td></tr>`).join("")}</tbody></table>` : '<div class="aa-empty">لا توجد منتجات تطابق هذه الخطورة.</div>'}</div></div>`;
    const root=$("#aa",host);if(root)root.appendChild(damagedCard());
    const dexp=$("#aa-damage-export");if(dexp)dexp.onclick=exportDamaged;
    host.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{S.filter=b.dataset.filter;draw();});
    const exp = $("aa-export"); if (exp) exp.onclick=()=>exportCsv(rows);
    host.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{if(typeof A().editProduct === "function") A().editProduct(b.dataset.edit);});
  }
  async function render() {
    const host = $("admin-audit-app"); if (!host || S.busy) return;
    S.busy = true; draw(); S.damaged = await damagedReturns(); draw();
    const products = (A().products || []).filter(Boolean), titles = new Map(); products.forEach(p=>{const k=norm(p.title);if(k)titles.set(k,(titles.get(k)||0)+1);});
    const results = []; for (let i=0;i<products.length;i+=8) results.push(...await Promise.all(products.slice(i,i+8).map(p=>inspect(p,titles))));
    S.products=results; S.busy=false; draw();
  }
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof Admin === "undefined") return;
    const original = Admin.tab;
    Admin.tab = function(t, btn) { const result=original.call(this,t,btn); const audit=$("tab-audit"); if(audit) audit.classList.toggle("hidden",t!=="audit"); if(t==="audit") AdminAudit.render(); return result; };
  });
  return { render };
})();
