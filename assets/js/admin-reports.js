/* تقارير متقدمة للوحة — قراءة فقط من الطلبات والمنتجات. */
const AdminReports = (() => {
  const $ = id => document.getElementById(id), A = () => typeof Admin !== "undefined" ? Admin : {};
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const money = n => Math.round(Number(n) || 0).toLocaleString("fr-DZ") + " دج", DAY = 864e5;
  const palette = ["#79d9a3", "#79b8f2", "#f2bd70", "#c39af2", "#f28f9d", "#6dd4cf", "#e6dd79", "#efaa83"];
  let view = "chart";
  function parseExtra(o) { if (o && typeof o.extra === "string") { try { return JSON.parse(o.extra) || {}; } catch (_) { return {}; } } return o && o.extra && typeof o.extra === "object" ? o.extra : {}; }
  function validOrders() { return (A().orders || []).filter(o => o && o.date && Number.isFinite(new Date(o.date).getTime())); }
  function lines(o) { try { return typeof A().orderLines === "function" ? A().orderLines(o) : []; } catch (_) { return []; } }
  function getRange() {
    const from = $("ar-from") && $("ar-from").value, to = $("ar-to") && $("ar-to").value;
    if (!from || !to) return null;
    const start = new Date(from + "T00:00:00").getTime(), end = new Date(to + "T00:00:00").getTime() + DAY;
    return Number.isFinite(start) && Number.isFinite(end) && start < end ? { start, end, days: Math.round((end - start) / DAY) } : null;
  }
  function inRange(o, r) { const t = new Date(o.date).getTime(); return t >= r.start && t < r.end; }
  function active(o) { return !["annulee", "echec"].includes(o.status); }
  function compare(cur, prev) { if (!prev) return cur ? "جديد" : "—"; const p = Math.round((cur - prev) / prev * 100); return (p > 0 ? "▲ " : p < 0 ? "▼ " : "") + Math.abs(p) + "%"; }
  function metrics(list) {
    const delivered = list.filter(o => o.status === "livree").length;
    return { orders: list.length, revenue: list.filter(active).reduce((n, o) => n + (Number(o.total) || 0), 0), delivered, rate: list.length ? delivered / list.length * 100 : 0 };
  }
  function svg(vals, labels, previous) {
    const w = 760, h = 230, pad = 30, max = Math.max(1, ...vals), x = i => pad + i * (w - pad * 2) / Math.max(1, vals.length - 1), y = v => h - pad - v / max * (h - pad * 2);
    const d = vals.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
    const points = vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="#79d9a3"><title>${esc(labels[i])}: ${money(v)}</title></circle>`).join("");
    const pd = (previous || []).map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="المبيعات اليومية مقارنة بالفترة السابقة" style="width:100%;height:auto;direction:ltr"><path d="${pd}" fill="none" stroke="#79b8f2" stroke-width="2" stroke-dasharray="6 5"/><path d="${d}" fill="none" stroke="#79d9a3" stroke-width="3"/>${points}<text x="${pad}" y="${h-5}" fill="#b4c9be" font-size="11">${esc(labels[0] || "")}</text><text x="${w-pad}" y="${h-5}" text-anchor="end" fill="#b4c9be" font-size="11">${esc(labels[labels.length-1] || "")}</text></svg><div class="ar-note">━━ الفترة الحالية　<span style="color:#79b8f2">┄┄ الفترة السابقة المماثلة</span></div>`;
  }
  function csv(name, rows) {
    const quote = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const blob = new Blob(["\uFEFF" + rows.map(row => row.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportSection(section) {
    const r = getRange(); if (!r) return;
    const all = validOrders(), os = all.filter(o => inRange(o, r));
    const pos = { start: r.start-r.days*DAY, end:r.start, days:r.days }, before = all.filter(o=>inRange(o,pos));
    if (section === "daily") { const cur=daily(os,r), old=daily(before,pos); return csv("reports-daily", [["التاريخ", "الإيراد", "إيراد الفترة السابقة", "الطلبات", "طلبات الفترة السابقة"], ...cur.map((d,i)=>[d.label,d.revenue,old[i]&&old[i].revenue||0,d.orders,old[i]&&old[i].orders||0])]); }
    if (section === "category") { const old=new Map(byCategory(before).map(x=>[x.key,x])); return csv("reports-category", [["التصنيف", "الإيراد", "إيراد الفترة السابقة", "الكمية", "كمية الفترة السابقة"], ...byCategory(os).map(x=>[x.name,x.revenue,old.get(x.key)?.revenue||0,x.qty,old.get(x.key)?.qty||0])]); }
    if (section === "wilaya") { const old=new Map(byWilaya(before).map(x=>[x.name,x])); return csv("reports-wilaya", [["الولاية","الطلبات","طلبات الفترة السابقة","مسلّمة %","مسلّمة سابقاً %","فاشلة/ملغاة %","فاشلة/ملغاة سابقاً %"], ...byWilaya(os).map(x=>{const y=old.get(x.name)||{};return [x.name,x.orders,y.orders||0,x.delivered,y.delivered||0,x.failed,y.failed||0];})]); }
    if (section === "campaign") { const old=new Map(byCampaign(before).map(x=>[x.name,x])); return csv("reports-campaign", [["الحملة","الطلبات","طلبات الفترة السابقة","الإيراد","إيراد الفترة السابقة","التسليم %","التسليم سابقاً %"], ...byCampaign(os).map(x=>{const y=old.get(x.name)||{};return [x.name,x.orders,y.orders||0,x.revenue,y.revenue||0,x.delivery,y.delivery||0];})]); }
    if (section === "funnel") { const old=funnel(before); return csv("reports-funnel", [["المرحلة","الطلبات","طلبات الفترة السابقة","التحويل %","التحويل سابقاً %"], ...funnel(os).map((x,i)=>[x[0],x[1],old[i][1],x[2],old[i][2]])]); }
  }
  function daily(os, r) {
    const keyOf = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    const rows = Array.from({ length: r.days }, (_, i) => { const d = new Date(r.start + i * DAY); return { key: keyOf(d), label: d.toLocaleDateString("ar-DZ", { day: "numeric", month: "short" }), orders: 0, revenue: 0 }; });
    const by = new Map(rows.map(x => [x.key, x])); os.forEach(o => { const d = new Date(o.date), row = by.get(keyOf(d)); if (row) { row.orders++; if (active(o)) row.revenue += Number(o.total) || 0; } }); return rows;
  }
  function byCategory(os) {
    const map = new Map(), cats = A().categories || {};
    os.filter(active).forEach(o => lines(o).forEach(l => { const key = l.p && l.p.cat || "بدون تصنيف", row = map.get(key) || { key, name: cats[key] || key, revenue: 0, qty: 0 }; row.revenue += Number(l.total) || (Number(l.p && l.p.price) || 0) * (Number(l.qty) || 0); row.qty += Number(l.qty) || 0; map.set(key, row); }));
    return [...map.values()].sort((a,b) => b.revenue - a.revenue);
  }
  function byWilaya(os) {
    const map = new Map(); os.forEach(o => { const name = String(o.wilaya || "غير محدد"), x = map.get(name) || { name, orders: 0, delivered: 0, failed: 0 }; x.orders++; if (o.status === "livree") x.delivered++; if (["echec", "annulee"].includes(o.status)) x.failed++; map.set(name, x); });
    return [...map.values()].map(x => ({ ...x, delivered: x.orders ? (x.delivered / x.orders * 100).toFixed(1) : "0.0", failed: x.orders ? (x.failed / x.orders * 100).toFixed(1) : "0.0" })).sort((a,b) => b.orders-a.orders);
  }
  function byCampaign(os) {
    const map = new Map(); os.forEach(o => { const raw = String(parseExtra(o)["📣 الحملة"] || "").trim(); if (!raw) return; const key = raw.split("/").pop(); const x = map.get(key) || { name: key, orders: 0, revenue: 0, delivered: 0 }; x.orders++; if (active(o)) x.revenue += Number(o.total) || 0; if (o.status === "livree") x.delivered++; map.set(key, x); });
    return [...map.values()].map(x => ({ ...x, delivery: x.orders ? (x.delivered / x.orders * 100).toFixed(1) : "0.0" })).sort((a,b) => b.orders-a.orders);
  }
  function funnel(os) {
    const stages = [["جديد", o => true], ["مؤكد", o => ["confirmee", "confirmed", "expediee", "shipped", "livree"].includes(o.status)], ["مرسل", o => ["expediee", "shipped", "livree"].includes(o.status)], ["مسلَّم", o => o.status === "livree"]];
    let prev = null; return stages.map(([name, test]) => { const n = os.filter(test).length, rate = prev == null ? "—" : prev ? (n / prev * 100).toFixed(1) : "0.0"; prev = n; return [name, n, rate]; });
  }
  function table(headers, rows, keys, section) {
    return `<div class="ar-table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}<th><button class="ar-btn" data-export="${section}">تصدير CSV</button></th></tr></thead><tbody>${rows.length ? rows.map(x=>`<tr>${keys.map(k=>`<td>${esc(x[k])}</td>`).join("")}<td></td></tr>`).join("") : `<tr><td colspan="${headers.length+1}">لا توجد بيانات لهذه الفترة</td></tr>`}</tbody></table></div>`;
  }
  function render() {
    const host = $("admin-reports-app"); if (!host) return;
    const now = new Date(), iso = d => { const x = new Date(d.getTime() - d.getTimezoneOffset()*60000); return x.toISOString().slice(0,10); };
    if (!$("ar-from")) { const end = new Date(), start = new Date(); start.setDate(start.getDate()-29); host.innerHTML = `<style>#ar{display:grid;gap:14px;color:#fff}#ar *{box-sizing:border-box}#ar .ar-card{padding:16px;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025));box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 12px 28px rgba(0,0,0,.24)}#ar .ar-head,#ar .ar-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:space-between}#ar .ar-head h2{margin:0}#ar .ar-controls input{color:#fff;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);padding:9px;border-radius:10px}#ar .ar-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}#ar .ar-kpi small{display:block;color:#b4c9be}#ar .ar-kpi b{font-size:1.35rem}#ar .ar-btn{padding:8px 12px;color:#fff;background:rgba(74,222,128,.14);border:1px solid rgba(134,239,172,.38);border-radius:11px;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -5px 8px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.2);backdrop-filter:blur(8px);cursor:pointer;transition:transform .18s,background .18s}#ar .ar-btn:hover{transform:translateY(-2px);background:rgba(74,222,128,.25)}#ar table{width:100%;border-collapse:collapse;min-width:520px}#ar th,#ar td{text-align:start;padding:9px;border-bottom:1px solid rgba(255,255,255,.09)}#ar th{color:#b4c9be}#ar .ar-table-wrap{overflow:auto}#ar .ar-note{color:#b4c9be;font-size:.88rem}#ar .ar-bar{height:7px;border-radius:10px;background:#79d9a3}#ar .ar-toggle{display:flex;gap:7px}@media(max-width:700px){#ar .ar-kpis{grid-template-columns:repeat(2,1fr)}}</style><div id="ar"><div class="ar-card ar-head"><div><h2>التقارير المتقدمة</h2><div class="ar-note">تقارير قراءة فقط من الطلبات والمنتجات</div></div><div class="ar-controls"><label>من <input id="ar-from" type="date" value="${iso(start)}"></label><label>إلى <input id="ar-to" type="date" value="${iso(end)}"></label><button class="ar-btn" id="ar-refresh">تحديث</button></div></div><div id="ar-content"></div></div>`; $("ar-refresh").onclick = draw; }
    draw();
  }
  function draw() {
    const host = $("ar-content"), r = getRange(); if (!host) return;
    if (!r) { host.innerHTML = '<div class="ar-card">أدخل فترة صحيحة: تاريخ البداية يجب أن يسبق النهاية.</div>'; return; }
    const all = validOrders(), os = all.filter(o=>inRange(o,r)), prevRange = { start:r.start-r.days*DAY, end:r.start, days:r.days }, prev = all.filter(o=>inRange(o,prevRange)), m = metrics(os), pm = metrics(prev), day = daily(os,r), prevDay = daily(prev,prevRange), oldCats=new Map(byCategory(prev).map(x=>[x.key,x])), cats = byCategory(os).map(x=>({...x,prevRevenue:oldCats.get(x.key)?.revenue||0,prevQty:oldCats.get(x.key)?.qty||0})), oldWil=new Map(byWilaya(prev).map(x=>[x.name,x])), wil = byWilaya(os).map(x=>({...x,prevOrders:oldWil.get(x.name)?.orders||0,prevDelivered:oldWil.get(x.name)?.delivered||"0.0",prevFailed:oldWil.get(x.name)?.failed||"0.0"})), oldCamps=new Map(byCampaign(prev).map(x=>[x.name,x])), camps = byCampaign(os).map(x=>({...x,prevOrders:oldCamps.get(x.name)?.orders||0,prevRevenue:oldCamps.get(x.name)?.revenue||0,prevDelivery:oldCamps.get(x.name)?.delivery||"0.0"})), oldFunnel=funnel(prev), fn = funnel(os).map((x,i)=>({name:x[0],orders:x[1],rate:x[2],prevOrders:oldFunnel[i][1],prevRate:oldFunnel[i][2]}));
    const RF = typeof AdminReturns !== "undefined" && AdminReturns.refunds, rf = RF ? AdminReturns.refunds(r.start, r.end) : 0, rfp = RF ? AdminReturns.refunds(prevRange.start, prevRange.end) : 0;
    if (RF && !AdminReturns.loaded()) AdminReturns.ensure().then(() => { if (AdminReturns.items().length) draw(); });
    const catHtml = cats.length ? cats.map((x,i)=>`<tr><td>${esc(x.name)}</td><td>${money(x.revenue)}</td><td>${money(x.prevRevenue)}</td><td>${x.qty}</td><td>${x.prevQty}</td><td><span class="ar-bar" style="display:block;width:${Math.max(4,x.revenue/Math.max(1,cats[0].revenue)*100)}%;background:${palette[i%palette.length]}"></span></td></tr>`).join("") : '<tr><td colspan="6">لا توجد بيانات لهذه الفترة</td></tr>';
    host.innerHTML = `<div class="ar-kpis"><div class="ar-card ar-kpi"><small>الطلبات</small><b>${m.orders.toLocaleString("fr-DZ")}</b><div class="ar-note">${esc(compare(m.orders,pm.orders))} عن الفترة السابقة</div></div><div class="ar-card ar-kpi"><small>الإيراد التقديري</small><b>${money(m.revenue)}</b><div class="ar-note">${esc(compare(m.revenue,pm.revenue))} عن الفترة السابقة</div></div><div class="ar-card ar-kpi"><small>المسلَّمة</small><b>${m.delivered}</b><div class="ar-note">${esc(compare(m.delivered,pm.delivered))} عن الفترة السابقة</div></div><div class="ar-card ar-kpi"><small>نسبة التسليم</small><b>${m.rate.toFixed(1)}%</b><div class="ar-note">${esc(compare(m.rate,pm.rate))} عن الفترة السابقة</div></div>${RF?`<div class="ar-card ar-kpi"><small>المبالغ المستردة (مرتجعات)</small><b>${money(rf)}</b><div class="ar-note">${esc(compare(rf,rfp))} عن الفترة السابقة</div></div>`:""}</div>
<section class="ar-card"><div class="ar-head"><h3>المبيعات حسب اليوم</h3><div class="ar-toggle"><button class="ar-btn" data-view="chart">مخطط</button><button class="ar-btn" data-view="table">عرض كجدول</button><button class="ar-btn" data-export="daily">تصدير CSV</button></div></div><div id="ar-daily">${view==="chart"?svg(day.map(x=>x.revenue),day.map(x=>x.label),prevDay.map(x=>x.revenue)):table(["اليوم","الإيراد","سابقاً","الطلبات","سابقاً"],day.map((x,i)=>({...x,prevRevenue:prevDay[i].revenue,prevOrders:prevDay[i].orders})),["label","revenue","prevRevenue","orders","prevOrders"],"daily")}</div></section>
<section class="ar-card"><div class="ar-head"><h3>حسب التصنيف</h3><button class="ar-btn" data-export="category">تصدير CSV</button></div><div class="ar-table-wrap"><table><thead><tr><th>التصنيف</th><th>الإيراد</th><th>سابقاً</th><th>الكمية</th><th>سابقاً</th><th>النسبة البصرية</th><th></th></tr></thead><tbody>${catHtml}</tbody></table></div></section>
<section class="ar-card"><div class="ar-head"><h3>نجاح التسليم حسب الولاية</h3><button class="ar-btn" data-export="wilaya">تصدير CSV</button></div>${table(["الولاية","الطلبات","سابقاً","مسلّمة %","سابقاً","فاشلة/ملغاة %","سابقاً"],wil,["name","orders","prevOrders","delivered","prevDelivered","failed","prevFailed"],"wilaya")}</section>
<section class="ar-card"><div class="ar-head"><h3>المصدر والحملة</h3><button class="ar-btn" data-export="campaign">تصدير CSV</button></div>${table(["الحملة","الطلبات","سابقاً","الإيراد","سابقاً","معدل التسليم %","سابقاً"],camps,["name","orders","prevOrders","revenue","prevRevenue","delivery","prevDelivery"],"campaign")}</section>
<section class="ar-card"><div class="ar-head"><h3>قمع الحالات</h3><button class="ar-btn" data-export="funnel">تصدير CSV</button></div>${table(["المرحلة","الطلبات","سابقاً","التحويل من السابقة %","سابقاً %"],fn,["name","orders","prevOrders","rate","prevRate"],"funnel")}</section>`;
    host.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{view=b.dataset.view;draw();});
    host.querySelectorAll("[data-export]").forEach(b=>b.onclick=()=>exportSection(b.dataset.export));
  }
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof Admin === "undefined" || Admin._reportsTabWrapped) return;
    const original = Admin.tab;
    Admin.tab = function (t, btn) {
      const result = original.call(this, t, btn);
      document.querySelectorAll(".admin-extra-tab").forEach(el => el.classList.toggle("hidden", el.id !== "tab-" + t));
      if (t === "reports") AdminReports.render();
      return result;
    };
    Admin._reportsTabWrapped = true;
  });
  return { render };
})();
