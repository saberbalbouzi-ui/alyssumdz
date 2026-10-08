/* الصفحة الرئيسية للوحة (Dashboard): ترحيب + فترة (اليوم/7/30) + 4 بطاقات + مخطط المبيعات والطلبات + حلقة الحالات
   + «يحتاج انتباهك» + آخر الطلبات + أفضل المنتجات. تُحسب كلها محلياً من Admin.orders/products (لا طلبات شبكة جديدة)، فتعمل
   على كل الأنظمة (GitHub/Supabase/PHP/محلي). مخططات SVG بلا مكتبات؛ ألوان الحلقة مُتحقَّق منها بـ validate_palette (dark) وتحمل وسيلة إيضاح بالأرقام. */
const AdminHome = (() => {
  const $ = id => document.getElementById(id);
  const A = () => (typeof Admin !== "undefined" ? Admin : {});
  const S = { days: 7, metric: "sales", table: false, shown: false };
  const MINT = "#86f06a", INK = "#ffffff", MUT = "rgba(255,255,255,.72)", GRID = "rgba(255,255,255,.1)";
  /* ترتيب ثابت للألوان الفئوية (dark): أزرق، برتقالي، تركوازي، أصفر، وردي — يتبع تدفّق الحالة */
  const ST = [
    { k: "nouvelle", g: 0, t: "في انتظار التأكيد", c: "#3987e5" },
    { k: "confirmee", g: 1, t: "قيد التجهيز", c: "#d95926" },
    { k: "expediee", g: 2, t: "في الطريق", c: "#199e70" },
    { k: "livree", g: 3, t: "تم التسليم", c: "#c98500" },
    { k: "annulee", g: 4, t: "ملغاة / فشل", c: "#d55181" }, { k: "echec", g: 4 },
  ];
  const GROUPS = [0, 1, 2, 3, 4].map(g => ST.find(s => s.g === g && s.t));
  const num = n => Number(n || 0).toLocaleString("fr-DZ");
  const money = n => num(Math.round(n)) + " دج";
  const day0 = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const DAY = 864e5;
  const css = () => {
    if ($("ahome-css")) return;
    const st = document.createElement("style"); st.id = "ahome-css";
    st.textContent = `body.ah-on #stats{display:none!important}#ahome{display:grid;gap:16px}#ahome *{box-sizing:border-box}
#ahome .ah-hd{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}#ahome .ah-hd h2{margin:0;font-size:1.5rem;color:#fff}#ahome .ah-hd p{margin:.2rem 0 0;color:${MUT};font-size:.92rem}
#ahome .ah-act{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#ahome .ah-seg{display:inline-flex;padding:3px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14)}#ahome .ah-seg button{border:0;background:transparent;color:${MUT};padding:7px 14px;border-radius:999px;font:inherit;font-size:.85rem;font-weight:800;cursor:pointer;transition:background .2s,color .2s}#ahome .ah-seg button.on{background:rgba(134,240,106,.2);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}
#ahome .ah-btn{padding:9px 16px;border-radius:12px;font:inherit;font-weight:800;color:#fff;cursor:pointer;background:rgba(74,222,128,.2);border:1px solid rgba(134,239,172,.45);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),inset 0 -6px 10px rgba(0,0,0,.2),0 6px 16px rgba(0,0,0,.25);backdrop-filter:blur(8px);transition:transform .2s,background .2s}#ahome .ah-btn:hover{transform:translateY(-2px);background:rgba(74,222,128,.32)}#ahome .ah-btn.gh{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.22)}
#ahome .ah-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
#ahome .ah-card{padding:16px;border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 14px 34px rgba(0,0,0,.35);color:#fff;min-width:0}
#ahome .ah-card h3{margin:0 0 10px;font-size:1rem;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:8px}#ahome .ah-card h3 small{font-weight:600;color:${MUT};font-size:.78rem}
#ahome .kpi{position:relative;overflow:hidden}#ahome .kpi .lb{display:flex;align-items:center;gap:8px;color:${MUT};font-size:.88rem}#ahome .kpi .ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16)}#ahome .kpi .ic svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#ahome .kpi .v{font-size:1.65rem;font-weight:900;margin:8px 0 2px;letter-spacing:-.01em;color:#fff}#ahome .kpi .d{font-size:.8rem;font-weight:800;display:inline-flex;gap:4px;align-items:center}#ahome .kpi .d.up{color:#86f06a}#ahome .kpi .d.dn{color:#ff9aa2}#ahome .kpi .d.eq{color:${MUT}}#ahome .kpi .d span{font-weight:600;color:${MUT}}
#ahome .kpi svg.sp{display:block;width:100%;height:34px;margin-top:8px}
#ahome .ah-row{display:grid;grid-template-columns:1.7fr 1fr;gap:14px}#ahome .ah-row2{display:grid;grid-template-columns:1.5fr 1fr;gap:14px}
#ahome .ch{position:relative}#ahome .ch svg{display:block;width:100%;height:auto;overflow:visible}#ahome .ch text{fill:${MUT};font-size:11px;font-family:inherit}
#ahome .tip{position:absolute;pointer-events:none;z-index:4;min-width:130px;padding:8px 10px;border-radius:12px;background:rgba(9,24,18,.985);border:1px solid rgba(255,255,255,.2);box-shadow:0 10px 26px rgba(0,0,0,.5);font-size:.8rem;opacity:0;transition:opacity .12s}#ahome .tip.on{opacity:1}#ahome .tip b{display:block;color:#fff;font-size:1rem}#ahome .tip span{color:${MUT}}#ahome .tip i{display:inline-block;width:14px;height:3px;border-radius:2px;background:${MINT};margin-inline-end:6px;vertical-align:middle}
#ahome .dn-w{display:flex;gap:16px;align-items:center;flex-wrap:wrap;justify-content:center}#ahome .dn-w svg{width:170px;height:170px;flex:none}#ahome .lg{display:grid;gap:7px;flex:1;min-width:150px}#ahome .lg div{display:flex;align-items:center;gap:8px;font-size:.88rem;color:#fff}#ahome .lg i{width:12px;height:12px;border-radius:3px;flex:none}#ahome .lg b{margin-inline-start:auto;color:#fff}#ahome .lg span{color:${MUT}}
#ahome table{width:100%;border-collapse:collapse;font-size:.88rem}#ahome th{text-align:start;color:${MUT};font-weight:700;padding:8px 6px;border-bottom:1px solid rgba(255,255,255,.12)}#ahome td{padding:9px 6px;border-bottom:1px solid rgba(255,255,255,.07);color:#fff;white-space:nowrap;max-width:190px;overflow:hidden;text-overflow:ellipsis}#ahome tr.cl{cursor:pointer}#ahome tr.cl:hover td{background:rgba(255,255,255,.05)}
#ahome .bd{display:inline-block;padding:3px 10px;border-radius:999px;font-size:.76rem;font-weight:800;color:#fff;border:1px solid}
#ahome .tp{display:grid;gap:10px}#ahome .tp .r{display:grid;grid-template-columns:22px 1fr auto;gap:4px 10px;align-items:center}#ahome .tp .n{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;font-size:.75rem;font-weight:900;background:rgba(255,255,255,.1);color:#fff}#ahome .tp .t{color:#fff;font-size:.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#ahome .tp .q{color:${MUT};font-size:.8rem}#ahome .tp .bar{grid-column:2/4;height:6px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden}#ahome .tp .bar i{display:block;height:100%;border-radius:6px;background:${MINT}}
#ahome .at{display:grid;gap:8px}#ahome .at button{display:flex;align-items:center;gap:10px;text-align:start;padding:11px 13px;border-radius:14px;font:inherit;color:#fff;cursor:pointer;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);transition:transform .2s,background .2s}#ahome .at button:hover{transform:translateY(-2px);background:rgba(255,255,255,.1)}#ahome .at b{font-size:1.15rem;min-width:30px}#ahome .at span{color:${MUT};font-size:.86rem}#ahome .at .w{border-color:rgba(251,146,60,.5)}#ahome .at .w b{color:#fdba74}#ahome .at .ok b{color:#86f06a}
#ahome .em{padding:24px;text-align:center;color:${MUT}}
@media(max-width:1100px){#ahome .ah-kpis{grid-template-columns:repeat(2,1fr)}#ahome .ah-row,#ahome .ah-row2{grid-template-columns:1fr}}
@media(max-width:520px){#ahome .ah-kpis{grid-template-columns:1fr 1fr;gap:10px}#ahome .kpi .v{font-size:1.25rem}#ahome .ah-card{padding:12px}}`;
    document.head.appendChild(st);
  };
  const ICONS = {
    sales: '<path d="M3 17l6-6 4 4 7-8"/><path d="M14 7h6v6"/>', orders: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
    wait: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', avg: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  };
  const stOf = s => (GROUPS.find(g => g.k === s) || (s === "echec" ? GROUPS[4] : GROUPS[0]));
  function orders() { return (A().orders || []).filter(o => o && o.date && !isNaN(new Date(o.date))); }
  const okOrder = o => !["annulee", "echec"].includes(o.status);
  function range(days, back) { /* [from, to) بمنتصف الليل المحلي */
    const end = day0(Date.now()) + DAY - back * days * DAY, start = end - days * DAY; return [start, end];
  }
  function bucket(list, from, to, step, key) {
    const n = Math.round((to - from) / step), v = Array(n).fill(0);
    list.forEach(o => { const t = new Date(o.date).getTime(); if (t >= from && t < to) { const i = Math.min(n - 1, Math.floor((t - from) / step)); v[i] += key(o); } });
    return v;
  }
  const sum = a => a.reduce((s, x) => s + x, 0);
  function delta(cur, prev) {
    if (!prev && !cur) return { c: "eq", t: "—", p: "" };
    if (!prev) return { c: "up", t: "جديد", p: "" };
    const p = Math.round((cur - prev) / prev * 100);
    return { c: p > 0 ? "up" : p < 0 ? "dn" : "eq", t: (p > 0 ? "▲ " : p < 0 ? "▼ " : "") + Math.abs(p) + "%", p: "" };
  }
  function spark(vals, color) {
    const W = 120, H = 34, m = Math.max(1, ...vals), n = vals.length;
    if (n < 2) return "";
    const pts = vals.map((v, i) => [i * W / (n - 1), H - 3 - (v / m) * (H - 8)]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    return `<svg class="sp" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d} L${W} ${H} L0 ${H}Z" fill="${color}" opacity=".14"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
  }
  function kpi(ic, label, value, dl, vals, color) {
    return `<div class="ah-card kpi"><div class="lb"><span class="ic" style="color:${color}"><svg viewBox="0 0 24 24">${ICONS[ic]}</svg></span>${label}</div><div class="v">${value}</div>${dl ? `<div class="d ${dl.c}">${dl.t} <span>عن الفترة السابقة</span></div>` : '<div class="d eq">&nbsp;</div>'}${spark(vals, color)}</div>`;
  }
  const dateLabel = (t, hourly) => { const d = new Date(t); return hourly ? d.getHours() + ":00" : d.toLocaleDateString("ar-DZ", { day: "numeric", month: "short" }); };

  function chartSvg(vals, labels, fmt) {
    const W = 720, H = 250, L = 8, R = 8, T = 14, B = 26, n = vals.length, m = Math.max(1, ...vals);
    const nice = (() => { const e = Math.pow(10, Math.floor(Math.log10(m))), f = m / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; })();
    const x = i => L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1)), y = v => T + (H - T - B) * (1 - v / nice);
    const line = vals.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
    let g = ""; for (let k = 0; k <= 4; k++) { const v = nice * k / 4, yy = y(v); g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="${GRID}" stroke-width="1"/>`; if (k) g += `<text x="${W - R}" y="${yy - 4}" text-anchor="end">${fmt(v)}</text>`; }
    const every = Math.ceil(n / 7); let xl = ""; labels.forEach((t, i) => { if (i % every === 0 || i === n - 1) xl += `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}">${t}</text>`; });
    const dots = n <= 31 ? vals.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${n > 14 ? 2.5 : 3.5}" fill="${MINT}" stroke="#0a1f15" stroke-width="2"/>`).join("") : "";
    return { svg: `<svg style="direction:ltr" viewBox="0 0 ${W} ${H}" role="img" aria-label="مخطط ${S.metric === "sales" ? "المبيعات" : "الطلبات"}"><defs><linearGradient id="ah-g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${MINT}" stop-opacity=".32"/><stop offset="1" stop-color="${MINT}" stop-opacity="0"/></linearGradient></defs>${g}<path d="${line} L${x(n - 1)} ${y(0)} L${x(0)} ${y(0)}Z" fill="url(#ah-g)"/><path d="${line}" fill="none" stroke="${MINT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${dots}${xl}<line id="ah-cx" y1="${T}" y2="${H - B}" stroke="rgba(255,255,255,.5)" stroke-width="1" stroke-dasharray="3 3" opacity="0"/></svg>`, x, y, W, n };
  }
  function donut(counts) {
    const total = sum(counts), R = 66, r = 44, C = 85;
    if (!total) return `<svg viewBox="0 0 170 170" aria-hidden="true"><circle cx="${C}" cy="${C}" r="${(R + r) / 2}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="${R - r}"/></svg>`;
    let a0 = -Math.PI / 2, out = "";
    counts.forEach((c, i) => {
      if (!c) return; const a1 = a0 + c / total * 2 * Math.PI, gap = Math.min(.04, (a1 - a0) / 3), s = a0 + gap, e = a1 - gap, large = e - s > Math.PI ? 1 : 0;
      const P = (rad, a) => (C + rad * Math.cos(a)).toFixed(2) + " " + (C + rad * Math.sin(a)).toFixed(2);
      out += `<path d="M${P(R, s)} A${R} ${R} 0 ${large} 1 ${P(R, e)} L${P(r, e)} A${r} ${r} 0 ${large} 0 ${P(r, s)}Z" fill="${GROUPS[i].c}"><title>${GROUPS[i].t}: ${c}</title></path>`; a0 = a1;
    });
    return `<svg viewBox="0 0 170 170" role="img" aria-label="توزيع الطلبات حسب الحالة">${out}<text x="${C}" y="${C - 2}" text-anchor="middle" style="fill:#fff;font-size:24px;font-weight:900">${num(total)}</text><text x="${C}" y="${C + 16}" text-anchor="middle" style="fill:${MUT};font-size:11px">طلب</text></svg>`;
  }
  function render() {
    const root = $("ahome"); if (!root) return;
    css(); const a = A(), all = orders(), days = S.days, hourly = days === 1;
    const [f1, t1] = range(days, 0), [f0, t0] = range(days, 1);
    const cur = all.filter(o => { const t = new Date(o.date).getTime(); return t >= f1 && t < t1; }), prev = all.filter(o => { const t = new Date(o.date).getTime(); return t >= f0 && t < t0; });
    const step = hourly ? 36e5 : DAY, ok = cur.filter(okOrder), okp = prev.filter(okOrder);
    const sales = sum(ok.map(o => Number(o.total) || 0)), salesP = sum(okp.map(o => Number(o.total) || 0));
    const waiting = all.filter(o => o.status === "nouvelle" || !o.status).length;
    const avg = ok.length ? sales / ok.length : 0, avgP = okp.length ? salesP / okp.length : 0;
    const sb = hourly ? bucket(all, day0(Date.now()) - 6 * DAY, t1, DAY, o => okOrder(o) ? Number(o.total) || 0 : 0) : bucket(all, f1, t1, step, o => okOrder(o) ? Number(o.total) || 0 : 0);
    const ob = hourly ? bucket(all, day0(Date.now()) - 6 * DAY, t1, DAY, () => 1) : bucket(all, f1, t1, step, () => 1);
    const series = S.metric === "sales" ? bucket(all, f1, t1, step, o => okOrder(o) ? Number(o.total) || 0 : 0) : bucket(all, f1, t1, step, () => 1);
    const labels = series.map((_, i) => dateLabel(f1 + i * step, hourly));
    const fmt = S.metric === "sales" ? v => v >= 1000 ? Math.round(v / 1000) + "ك" : Math.round(v) : v => Math.round(v);
    const ch = chartSvg(series, labels, fmt);
    const counts = GROUPS.map((g, i) => cur.filter(o => stOf(o.status).g === i).length);
    const last = all.slice().sort((p, q) => new Date(q.date) - new Date(p.date)).slice(0, 8);
    const prodMap = {}; cur.filter(okOrder).forEach(o => (a.parseOrderItems ? a.parseOrderItems(o.items) : []).forEach(it => { prodMap[it.title] = (prodMap[it.title] || 0) + it.qty; }));
    const top = Object.entries(prodMap).sort((p, q) => q[1] - p[1]).slice(0, 5), topMax = top.length ? top[0][1] : 1;
    const prods = (a.products || []).filter(p => p.active !== false), low = prods.filter(p => p.stock !== undefined && p.stock !== null && p.stock !== "" && Number(p.stock) > 0 && Number(p.stock) <= 5), out = prods.filter(p => p.stock !== undefined && p.stock !== null && p.stock !== "" && Number(p.stock) <= 0);
    const fail = all.filter(o => o.status === "echec").length;
    const name = (typeof SITE_CFG !== "undefined" && SITE_CFG.name) || "متجرك";
    const hour = new Date().getHours(), greet = hour < 12 ? "صباح الخير" : hour < 18 ? "مرحباً" : "مساء الخير";
    root.innerHTML = `
<div class="ah-hd"><div><h2>${greet}، لوحة ${name.replace(/[<>&]/g, "")}</h2><p>نظرة عامة على متجرك ومبيعاتك — تُحسب من طلباتك الحالية.</p></div>
<div class="ah-act"><div class="ah-seg" role="group" aria-label="الفترة">${[[1, "اليوم"], [7, "7 أيام"], [30, "30 يوماً"]].map(([d, t]) => `<button type="button" data-d="${d}" class="${S.days === d ? "on" : ""}">${t}</button>`).join("")}</div>
<button type="button" class="ah-btn" data-go="newp">منتج جديد</button><button type="button" class="ah-btn gh" data-go="orders">كل الطلبات</button></div></div>
<div class="ah-kpis">
${kpi("sales", "المبيعات", money(sales), delta(sales, salesP), sb, MINT)}
${kpi("orders", "الطلبات", num(cur.length), delta(cur.length, prev.length), ob, "#3987e5")}
${kpi("wait", "في انتظار التأكيد", num(waiting), null, [], "#c98500")}
${kpi("avg", "متوسط قيمة الطلب", money(avg), delta(avg, avgP), [], "#d55181")}
</div>
<div class="ah-row">
<div class="ah-card"><h3>${S.metric === "sales" ? "مخطط المبيعات" : "مخطط الطلبات"}<span class="ah-act"><span class="ah-seg" role="group"><button type="button" data-m="sales" class="${S.metric === "sales" ? "on" : ""}">المبيعات</button><button type="button" data-m="orders" class="${S.metric === "orders" ? "on" : ""}">الطلبات</button></span><button type="button" class="ah-btn gh" data-tb="1" style="padding:6px 11px;font-size:.78rem">${S.table ? "عرض المخطط" : "عرض كجدول"}</button></span></h3>
${S.table ? `<div style="max-height:260px;overflow:auto"><table><thead><tr><th>${hourly ? "الساعة" : "اليوم"}</th><th>${S.metric === "sales" ? "المبيعات" : "الطلبات"}</th></tr></thead><tbody>${series.map((v, i) => `<tr><td>${labels[i]}</td><td>${S.metric === "sales" ? money(v) : num(v)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="ch" id="ah-ch">${cur.length || sum(series) ? ch.svg : '<div class="em">لا طلبات في هذه الفترة بعد.</div>'}<div class="tip" id="ah-tip"></div></div>`}</div>
<div class="ah-card"><h3>الطلبات حسب الحالة <small>${days === 1 ? "اليوم" : "آخر " + days + " يوماً"}</small></h3><div class="dn-w">${donut(counts)}<div class="lg">${GROUPS.map((g, i) => `<div><i style="background:${g.c}"></i>${g.t}<b>${num(counts[i])}</b></div>`).join("")}</div></div></div>
</div>
<div class="ah-row2">
<div class="ah-card"><h3>آخر الطلبات <button type="button" class="ah-btn gh" data-go="orders" style="padding:6px 11px;font-size:.78rem">عرض الكل</button></h3>${last.length ? `<div style="overflow:auto"><table><thead><tr><th>الزبون</th><th>الولاية</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${last.map((o, i) => { const g = stOf(o.status); return `<tr class="cl" data-o="${i}"><td></td><td></td><td>${money(o.total)}</td><td><span class="bd" style="background:${g.c}33;border-color:${g.c}">${g.t}</span></td><td>${new Date(o.date).toLocaleDateString("ar-DZ", { day: "numeric", month: "short" })}</td></tr>`; }).join("")}</tbody></table></div>` : '<div class="em">لا توجد طلبات بعد. ستظهر هنا فور وصولها.</div>'}</div>
<div class="ah-card"><h3>يحتاج انتباهك</h3><div class="at">
<button type="button" class="${waiting ? "w" : "ok"}" data-go="orders-new"><b>${num(waiting)}</b><span>طلب في انتظار التأكيد</span></button>
<button type="button" class="${low.length ? "w" : "ok"}" data-go="products"><b>${num(low.length)}</b><span>منتج مخزونه منخفض (5 أو أقل)</span></button>
<button type="button" class="${out.length ? "w" : "ok"}" data-go="products"><b>${num(out.length)}</b><span>منتج نفد من المخزون</span></button>
<button type="button" class="${fail ? "w" : "ok"}" data-go="shipped"><b>${num(fail)}</b><span>فشل توصيل / مرتجع</span></button></div>
<h3 style="margin-top:16px">أفضل المنتجات مبيعاً</h3>${top.length ? `<div class="tp">${top.map(([t, q], i) => `<div class="r"><span class="n">${i + 1}</span><span class="t"></span><span class="q">${num(q)} قطعة</span><span class="bar"><i style="width:${Math.max(6, q / topMax * 100)}%"></i></span></div>`).join("")}</div>` : '<div class="em" style="padding:10px">لا مبيعات في هذه الفترة.</div>'}</div>
</div>`;
    /* نصوص من البيانات بـtextContent (لا innerHTML) */
    root.querySelectorAll("tr[data-o]").forEach(tr => { const o = last[+tr.dataset.o]; tr.cells[0].textContent = o.name || "—"; tr.cells[1].textContent = o.wilaya || "—"; tr._o = o; });
    root.querySelectorAll(".tp .t").forEach((el, i) => { el.textContent = top[i][0]; el.title = top[i][0]; });
    bind(root, ch, series, labels, hourly);
  }
  function bind(root, ch, series, labels, hourly) {
    root.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { S.days = +b.dataset.d; render(); });
    root.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { S.metric = b.dataset.m; render(); });
    root.querySelectorAll("[data-tb]").forEach(b => b.onclick = () => { S.table = !S.table; render(); });
    root.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
    root.querySelectorAll("tr[data-o]").forEach(tr => tr.onclick = () => { const o = tr._o; go("orders"); const q = $("order-filter-q"); if (q) { q.value = o.phone || o.id || ""; try { A().applyOrderFilters(); } catch (e) { } } });
    const box = $("ah-ch"), svg = box && box.querySelector("svg"); if (!svg) return;
    const tip = $("ah-tip"), cx = $("ah-cx");
    const move = e => {
      const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * ch.W, n = ch.n;
      let i = Math.round((px - 8) / ((ch.W - 16) / Math.max(1, n - 1))); i = Math.max(0, Math.min(n - 1, i));
      const X = ch.x(i); cx.setAttribute("x1", X); cx.setAttribute("x2", X); cx.setAttribute("opacity", 1);
      tip.replaceChildren(); const b = document.createElement("b"), s = document.createElement("span"), k = document.createElement("i");
      b.textContent = S.metric === "sales" ? money(series[i]) : num(series[i]) + " طلب"; s.append(k, labels[i]); tip.append(b, s);
      const rx = X / ch.W * r.width, ty = ch.y(series[i]) / 250 * r.height; tip.style.left = Math.max(0, Math.min(r.width - 140, rx - 70)) + "px"; tip.style.top = Math.max(0, ty - 64) + "px"; tip.classList.add("on");
    };
    svg.addEventListener("pointermove", move); svg.addEventListener("pointerdown", move);
    svg.addEventListener("pointerleave", () => { tip.classList.remove("on"); cx.setAttribute("opacity", 0); });
  }
  function go(w) {
    const a = A(), btn = k => [...document.querySelectorAll(".nav-btn")].find(b => (b.getAttribute("onclick") || "").includes("'" + k + "'"));
    if (w === "newp") { try { a.editProduct(null); } catch (e) { } return; }
    if (w === "orders-new") { a.tab("orders", btn("orders")); const s = $("order-filter-status"); if (s) { s.value = "nouvelle"; try { a.applyOrderFilters(); } catch (e) { } } return; }
    const b = btn(w); if (b) a.tab(w, b);
  }
  function open() { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'home'")); if (b && A().tab) A().tab("home", b); }
  function init() {
    const a = A(); if (!a || a.__homeWrap || typeof a.renderAll !== "function") return setTimeout(init, 400);
    a.__homeWrap = 1; const o = a.renderAll;
    a.renderAll = function () { const r = o.apply(this, arguments); try { render(); if (!S.shown) { S.shown = true; open(); } } catch (e) { console.warn("AdminHome", e); } return r; };
    const ot = a.tab; a.tab = function (t, b) { const r = ot.apply(this, arguments); document.body.classList.toggle("ah-on", t === "home"); if (t === "home") render(); return r; };
    if (a.orders && a.orders.length !== undefined && !$("app").classList.contains("hidden")) { render(); if (!S.shown) { S.shown = true; open(); } }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { render, open, S };
})();
