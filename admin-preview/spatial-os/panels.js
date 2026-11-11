/* محتوى الألواح (بيانات تجريبية حتمية). كل قسم: { id, name, icon, w, h, html(), bind(root, refresh) }.
   لا اتصال بأي API؛ AI.ask هو نقطة التوصيل المستقبلية بالمساعد الحقيقي. */
const D = {
  /* حقول الطلب بنفس أسماء بيانات المتجر (id/name/phone/wilaya/items/total/status) مع تعيين الحالات: new=nouvelle ok=confirmee ship=expediee done=livree */
  orders: [
    { id: "A1182", n: "ليلى ب.", ph: "0550 12 34 56", wi: "الجزائر", pr: "عسل التركيز 500غ", t: 3200, s: "new" }, { id: "A1181", n: "أمينة ب.", ph: "0661 22 10 98", wi: "وهران", pr: "قطرات التركيز", t: 1800, s: "new" },
    { id: "A1180", n: "سلمى و.", ph: "0770 55 41 02", wi: "قسنطينة", pr: "عسل السدر 500غ ×2", t: 4500, s: "ok" }, { id: "A1179", n: "ريم ف.", ph: "0555 90 12 33", wi: "سطيف", pr: "قطرات التركيز", t: 1800, s: "ship" },
    { id: "A1178", n: "كريم م.", ph: "0699 14 70 85", wi: "عنابة", pr: "عسل التركيز 500غ", t: 3200, s: "done" }, { id: "A1177", n: "نور ح.", ph: "0540 33 21 67", wi: "البليدة", pr: "عسل السدر 500غ", t: 2750, s: "done" }, { id: "A1176", n: "سعاد ك.", ph: "0662 80 45 19", wi: "تلمسان", pr: "عسل التركيز 500غ ×2", t: 5200, s: "ship" }],
  moves: [["اليوم 14:20", "بيع", "عسل التركيز 500غ", -2], ["اليوم 11:05", "دخول", "قطرات التركيز", 30], ["أمس 17:40", "بيع", "عسل السدر 500غ", -3], ["أمس 09:12", "إرجاع", "عسل التركيز 500غ", 1], ["قبل يومين", "بيع", "قطرات التركيز", -4]],
  stock: [{ n: "عسل التركيز 500غ", q: 18, m: 40, img: "p1", pc: 3200, w: 14 }, { n: "عسل السدر 500غ", q: 4, m: 40, img: "p2", pc: 2750, w: 9 }, { n: "قطرات التركيز", q: 26, m: 40, img: "p3", pc: 1800, w: 11 }],
  sales7: [4.2, 7.8, 11.5, 9.4, 13.8, 16.3, 11.9], sales30: [6, 8, 7, 11, 9, 14, 12, 15, 11, 13, 17, 14, 12, 16, 18, 13, 15, 19, 16, 14, 17, 20, 15, 18, 21, 17, 19, 16, 22, 18],
  range: 7, open: true, theme: "dark", ext: { chat: true, pixel: false, sms: true, reviews: false }, set: { sound: false, notif: true, auto: true },
};
const ST = { new: ["جديدة", "new"], ok: ["مؤكَّدة", "ok"], ship: ["في الطريق", "ship"], done: ["مسلَّمة", "done"] };
const dz = n => Math.round(n).toLocaleString("fr-DZ").replace(/ | /g, " ");
const svg = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const IC = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  prod: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  ord: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 002 1.6h7.7a2 2 0 002-1.5L21 8H6"/>',
  store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>',
  inv: '<path d="M4 7h16v13H4z"/><path d="M2 3h20v4H2z"/><path d="M10 12h4"/>',
  cus: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.5c2.4.2 4 1.7 4.5 4.5"/>',
  mkt: '<path d="M3 11v3l12 5V6L3 11z"/><path d="M15 9.5a3.5 3.5 0 010 5"/><path d="M7 15v4"/>',
  ana: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-8"/><path d="M22 20H2"/>',
  look: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.3"/><circle cx="12" cy="7.5" r="1.3"/><circle cx="15.5" cy="10" r="1.3"/><path d="M12 21c-1.5 0-2-1.2-1.4-2.3.7-1.2.3-2.7-1.6-2.7"/>',
  ext: '<path d="M10 3H5a2 2 0 00-2 2v5a2 2 0 002 0 2 2 0 014 0 2 2 0 002 0V5a2 2 0 00-1-2z"/><path d="M14 13h5a2 2 0 012 2v5H9v-5a2 2 0 012-2"/>',
  set: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  ai: '<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>',
};
const h4 = s => `<h4 class="h4">${s}</h4>`;
const kpi = (l, v) => `<div class="kpi"><small>${l}</small><b>${v}</b></div>`;
const pend = () => D.orders.filter(o => o.s === "new").length, revenue = () => D.orders.filter(o => o.s === "done").reduce((a, o) => a + o.t, 0);
function chart(vals) {
  const W = 520, H = 160, mx = Math.max(...vals) * 1.1, pts = vals.map((v, i) => [i * W / (vals.length - 1), H - v / mx * H]);
  const d = pts.map((p, i) => { if (!i) return "M" + p.join(" "); const q = pts[i - 1], c = (q[0] + p[0]) / 2; return `C${c} ${q[1]} ${c} ${p[1]} ${p[0]} ${p[1]}`; }).join(" ");
  return `<svg class="chart" viewBox="0 0 ${W} ${H + 6}" preserveAspectRatio="none"><defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dcff1f" stop-opacity=".5"/><stop offset="1" stop-color="#7bd10f" stop-opacity="0"/></linearGradient></defs><g class="gd">${[0, 1, 2, 3].map(i => `<line x1="0" x2="${W}" y1="${i * H / 3}" y2="${i * H / 3}"/>`).join("")}</g><path class="ar" d="${d} L${W} ${H} L0 ${H}Z"/><path class="ln" d="${d}"/></svg>`;
}
const AI = {
  endpoint: null, /* نقطة التوصيل المستقبلية: إن وُجد endpoint يُرسَل السؤال والسياق إليه بدل الرد التجريبي */
  async ask(q) {
    if (this.endpoint) { const r = await fetch(this.endpoint, { method: "POST", body: JSON.stringify({ q, ctx: { pending: pend() } }) }); return (await r.json()).answer; }
    await new Promise(r => setTimeout(r, 450));
    if (/طلب|طلبات|تأكيد/.test(q)) return `لديك ${pend()} طلبات بانتظار التأكيد. أقترح تأكيدها الآن؛ افتح لوح الطلبات واضغط «تأكيد».`;
    if (/مخزون|نفد|عسل السدر/.test(q)) { const l = D.stock.filter(s => s.q < 10); return l.length ? `المخزون المنخفض: ${l.map(s => s.n + " (" + s.q + ")").join("، ")}. يُنصح بإعادة الطلب.` : "المخزون كافٍ."; }
    if (/مبيعات|إيراد|ربح/.test(q)) return `إيراد الطلبات المسلَّمة ${dz(revenue())} دج، وتتجه المبيعات صعوداً هذا الأسبوع.`;
    return "هذه معاينة تجريبية: أجيب عن الطلبات والمخزون والمبيعات. اسألني عن أحدها.";
  },
};
const SEC = [
  { id: "dash", name: "لوحة التحكم", icon: IC.dash, w: 460, h: 380,
    html: p => `<div class="kpis">${kpi("الإيراد", dz(revenue()) + " دج")}${kpi("بانتظار التأكيد", pend())}${kpi("التحويل", "2.9%")}${p.big ? kpi("متوسط الطلب", "2 750") : ""}</div>${chart(D.sales7)}<div class="hint">آخر 7 أيام · بيانات تجريبية</div>${p.big ? h4("آخر الطلبات") + D.orders.slice(0, 5).map(o => `<div class="row"><div class="grow"><b>#${o.id} · ${o.n}</b><small>${o.wi} · ${o.pr}</small></div><b>${dz(o.t)} دج</b><span class="st ${ST[o.s][1]}">${ST[o.s][0]}</span></div>`).join("") : ""}` },
  { id: "prod", name: "المنتجات", icon: IC.prod, w: 460, h: 360,
    html: p => p.big ? `<div class="grid3 big">${D.stock.map(s => `<div class="pcard"><img src="img/${s.img}.webp" alt=""><b>${s.n}</b><small>${dz(s.pc)} دج · ${s.q} قطعة</small><div class="bar"><i style="width:${Math.min(100, s.q / s.m * 100)}%"></i></div><small>بيع ${s.w} هذا الأسبوع</small></div>`).join("")}</div>${h4("الأكثر مبيعاً")}${D.stock.slice().sort((a, b) => b.w - a.w).map(s => `<div class="row"><div class="grow"><b>${s.n}</b></div><b>${s.w}</b></div>`).join("")}` : `<div class="grid3">${D.stock.map(s => `<div class="pcard"><img src="img/${s.img}.webp" alt=""><b>${s.n}</b><small>${s.q} قطعة</small></div>`).join("")}</div>` },
  { id: "ord", name: "الطلبات", icon: IC.ord, w: 470, h: 440, st: { f: "all" },
    html(p) { const f = p.st.f, l = D.orders.filter(o => f === "all" || o.s === f), chips = `<div class="chips">${[["all", "الكل"], ["new", "جديدة"], ["ok", "مؤكَّدة"], ["ship", "في الطريق"], ["done", "مسلَّمة"]].map(([k, v]) => `<button type="button" class="chip${f === k ? " on" : ""}" data-f="${k}">${v}</button>`).join("")}</div>`;
      if (p.big) return `<div class="kpis">${kpi("الطلبات", D.orders.length)}${kpi("جديدة", pend())}${kpi("الإيراد", dz(revenue()) + " دج")}</div>${chips}<table class="tbl"><thead><tr><th>الطلب</th><th>الزبون</th><th>الهاتف</th><th>الولاية</th><th>المنتج</th><th>المبلغ</th><th>الحالة</th><th></th></tr></thead><tbody>${l.map(o => `<tr><td>#${o.id}</td><td>${o.n}</td><td dir="ltr">${o.ph}</td><td>${o.wi}</td><td>${o.pr}</td><td>${dz(o.t)} دج</td><td><span class="st ${ST[o.s][1]}">${ST[o.s][0]}</span></td><td>${o.s === "new" ? `<button type="button" class="btn" data-ok="${o.id}">تأكيد</button>` : ""}</td></tr>`).join("")}</tbody></table>`;
      return chips + (l.map(o => `<div class="row"><div class="grow"><b>#${o.id} · ${o.n}</b><small>${dz(o.t)} دج</small></div><span class="st ${ST[o.s][1]}">${ST[o.s][0]}</span>${o.s === "new" ? `<button type="button" class="btn" data-ok="${o.id}">تأكيد</button>` : ""}</div>`).join("") || '<div class="hint">لا طلبات</div>'); },
    bind(r, p, rf) { r.onclick = e => { const f = e.target.closest("[data-f]"), k = e.target.closest("[data-ok]"); if (f) { p.st.f = f.dataset.f; rf(); } if (k) { const o = D.orders.find(x => x.id === k.dataset.ok); if (o) { o.s = "ok"; toast("تم تأكيد الطلب #" + o.id); rf(true); } } }; } },
  { id: "store", name: "المتجر", icon: IC.store, w: 400, h: 300,
    html: () => `<div class="row"><div class="grow"><b>حالة المتجر</b><small>${D.open ? "مفتوح ويستقبل الطلبات" : "مغلق مؤقتاً"}</small></div><button type="button" class="tg${D.open ? " on" : ""}" data-tg="open" aria-label="تبديل حالة المتجر"></button></div><div class="kpis" style="margin-top:12px">${kpi("الزوار اليوم", "1 085")}${kpi("طلبات اليوم", D.orders.length)}</div>`,
    bind(r, p, rf) { r.onclick = e => { if (e.target.closest("[data-tg]")) { D.open = !D.open; toast(D.open ? "المتجر مفتوح" : "المتجر مغلق"); rf(true); } }; } },
  { id: "inv", name: "المخزون", icon: IC.inv, w: 440, h: 340,
    html: p => { const rows = D.stock.map(s => `<div class="row"><div class="grow"><b>${s.n}</b><div class="bar"><i style="width:${Math.min(100, s.q / s.m * 100)}%"></i></div></div><span class="st ${s.q < 10 ? "low" : "ok"}">${s.q}</span>${s.q < 10 ? `<button type="button" class="btn" data-re="${s.n}">إعادة طلب</button>` : ""}</div>`).join("");
      if (!p.big) return rows;
      return `<div class="kpis">${kpi("الأصناف", D.stock.length)}${kpi("مخزون منخفض", D.stock.filter(s => s.q < 10).length)}${kpi("إجمالي القطع", D.stock.reduce((a, s) => a + s.q, 0))}</div><div class="cols2"><div>${h4("مستوى المخزون")}${rows}</div><div>${h4("الأصناف")}<div class="grid3">${D.stock.map(s => `<div class="pcard"><img src="img/${s.img}.webp" alt=""><b>${s.n}</b><small>${s.q} قطعة · ${dz(s.pc)} دج</small></div>`).join("")}</div></div></div>${h4("حركة المخزون")}<table class="tbl"><thead><tr><th>الوقت</th><th>النوع</th><th>الصنف</th><th>الكمية</th></tr></thead><tbody>${D.moves.map(m => `<tr><td>${m[0]}</td><td>${m[1]}</td><td>${m[2]}</td><td dir="ltr" style="text-align:right">${m[3] > 0 ? "+" : ""}${m[3]}</td></tr>`).join("")}</tbody></table>`; },
    bind(r, p, rf) { r.onclick = e => { const b = e.target.closest("[data-re]"); if (b) { const s = D.stock.find(x => x.n === b.dataset.re); s.q += 30; D.moves.unshift(["الآن", "دخول", s.n, 30]); toast("طُلبت 30 قطعة: " + s.n); rf(true); } }; } },
  { id: "cus", name: "العملاء", icon: IC.cus, w: 420, h: 340,
    html: () => D.orders.slice(0, 6).map(o => `<div class="row"><div class="grow"><b>${o.n}</b><small>آخر طلب #${o.id}</small></div><b>${dz(o.t)} دج</b></div>`).join("") },
  { id: "mkt", name: "التسويق", icon: IC.mkt, w: 420, h: 330,
    html: () => ["حملة عسل التركيز · 4.8% نقر", "كود SAHA10 · 23 استعمال", "رسائل ما بعد الشراء · نشطة"].map((t, i) => `<div class="row"><div class="grow"><b>${t}</b><div class="bar"><i style="width:${[78, 46, 90][i]}%"></i></div></div></div>`).join("") },
  { id: "ana", name: "التحليلات", icon: IC.ana, w: 480, h: 420,
    html: p => `<div class="chips"><button type="button" class="chip${D.range === 7 ? " on" : ""}" data-r="7">7 أيام</button><button type="button" class="chip${D.range === 30 ? " on" : ""}" data-r="30">30 يوماً</button></div>${chart(D.range === 7 ? D.sales7 : D.sales30)}<div class="kpis" style="margin-top:10px">${kpi("الزيارات", "1 085")}${kpi("التحويل", "2.9%")}${kpi("متوسط الطلب", "2 750")}</div>${p.big ? h4("قمع التحويل") + [["الزيارات", 1085, 100], ["مشاهدة المنتج", 629, 58], ["إضافة للسلة", 174, 16], ["بدء الدفع", 81, 7.5], ["طلبات مؤكَّدة", 32, 2.9]].map(([l, v, w]) => `<div class="row"><div class="grow"><b>${l}</b><div class="bar"><i style="width:${w}%"></i></div></div><b>${dz(v)}</b></div>`).join("") : ""}<div class="heat">${Array.from({ length: p.big ? 84 : 48 }, (_, i) => { const v = (Math.sin(i * 1.7) + Math.cos(i * .9) + 2) / 4; return `<i style="--hc:${v > .7 ? "#dcff1f" : v > .45 ? "#2be4ff" : v > .25 ? "rgba(165,139,255,.8)" : "rgba(255,255,255,.12)"}"></i>`; }).join("")}</div>`,
    bind(r, p, rf) { r.onclick = e => { const b = e.target.closest("[data-r]"); if (b) { D.range = +b.dataset.r; rf(true); } }; } },
  { id: "look", name: "المظهر", icon: IC.look, w: 380, h: 300,
    html: () => `<div class="chips">${[["dark", "داكن"], ["glass", "زجاجي"], ["light", "فاتح"]].map(([k, v]) => `<button type="button" class="chip${D.theme === k ? " on" : ""}" data-th="${k}">${v}</button>`).join("")}</div><div class="hint">معاينة فقط: لا يغيّر مظهر المتجر.</div>`,
    bind(r, p, rf) { r.onclick = e => { const b = e.target.closest("[data-th]"); if (b) { D.theme = b.dataset.th; rf(true); } }; } },
  { id: "ext", name: "الإضافات", icon: IC.ext, w: 400, h: 340,
    html: () => [["chat", "محادثة الزائر"], ["pixel", "بكسل التتبع"], ["sms", "رسائل SMS"], ["reviews", "التقييمات"]].map(([k, v]) => `<div class="row"><div class="grow"><b>${v}</b></div><button type="button" class="tg${D.ext[k] ? " on" : ""}" data-ex="${k}" aria-label="${v}"></button></div>`).join(""),
    bind(r, p, rf) { r.onclick = e => { const b = e.target.closest("[data-ex]"); if (b) { D.ext[b.dataset.ex] = !D.ext[b.dataset.ex]; rf(true); } }; } },
  { id: "set", name: "الإعدادات", icon: IC.set, w: 400, h: 320,
    html: () => [["sound", "صوت الإشعارات"], ["notif", "الإشعارات"], ["auto", "إرسال تلقائي للشركة"]].map(([k, v]) => `<div class="row"><div class="grow"><b>${v}</b></div><button type="button" class="tg${D.set[k] ? " on" : ""}" data-st="${k}" aria-label="${v}"></button></div>`).join(""),
    bind(r, p, rf) { r.onclick = e => { const b = e.target.closest("[data-st]"); if (b) { D.set[b.dataset.st] = !D.set[b.dataset.st]; rf(true); } }; } },
  { id: "ai", name: "مساعد ALYSSUM", icon: IC.ai, w: 430, h: 470, hidden: true, st: { m: [{ a: 1, t: "مرحباً، أنا مساعد ALYSSUM. ما الذي تريد معرفته؟" }] },
    html: p => `<div class="ai-core"><i></i><i></i><i></i></div><div class="msgs">${p.st.m.map(m => `<div class="msg ${m.a ? "a" : "u"}">${m.t}</div>`).join("")}</div><div class="chips">${["كم طلباً ينتظر التأكيد؟", "ما حالة المخزون؟", "كيف المبيعات؟"].map(s => `<button type="button" class="chip" data-q="${s}">${s}</button>`).join("")}</div><div class="ask"><input id="ai-in" placeholder="اسأل المساعد..." aria-label="سؤال"><button type="button" class="btn" data-send>إرسال</button></div>`,
    bind(r, p, rf) {
      const send = async q => { q = (q || "").trim(); if (!q) return; p.st.m.push({ t: q }); rf(); const a = await AI.ask(q); p.st.m.push({ a: 1, t: a }); rf(); const b = r.querySelector(".pn-bodywrap") || r; b.scrollTop = b.scrollHeight; };
      r.onclick = e => { const c = e.target.closest("[data-q]"); if (c) send(c.dataset.q); if (e.target.closest("[data-send]")) send(r.querySelector("#ai-in").value); };
      r.onkeydown = e => { if (e.key === "Enter" && e.target.id === "ai-in") send(e.target.value); };
    } },
];
function toast(t) { const d = document.createElement("div"); d.className = "toast"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2500); }
