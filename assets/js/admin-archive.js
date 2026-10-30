/* الأرشيف وبداية جديدة: يخفي الطلبات المنتهية القديمة (مسلَّمة/مرتجعة/ملغاة) من كل أقسام اللوحة والإحصائيات دون حذفها
   من الخادم، ويحفظ لقطة بأرقامها، ويبدأ الحساب من الصفر. الاسترجاع ممكن لآخر أرشيف.
   السجلّ: Priv("archive") = { list:[{ id, name, at, ids[], trk[], sum{}, snap{ads,adh} }] }  (الأحدث في آخر القائمة) */
const AdminArchive = (() => {
  const A = () => (typeof Admin !== "undefined" ? Admin : null);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dz = n => Math.round(Number(n) || 0).toLocaleString("fr-DZ") + " دج";
  const FINAL = ["livree", "echec", "annulee"];
  const S = { list: [], ids: new Set(), trk: new Set(), cut: 0, liveTrk: null, open: false, busy: false };
  const TABS = ["shipped", "finance", "analytics", "reports", "payments", "profit"];

  function index() {
    S.ids = new Set(); S.trk = new Set(); S.cut = 0;
    S.list.forEach(r => { (r.ids || []).forEach(i => S.ids.add(String(i))); (r.trk || []).forEach(t => S.trk.add(String(t))); S.cut = Math.max(S.cut, Number(r.at) || 0); });
  }
  function read(v) { S.list = (v && Array.isArray(v.list)) ? v.list : []; index(); }
  /* تُستدعى مبكراً من Admin.load قبل قراءة الطلبات: المحفوظ محلياً ثم الخادم */
  async function load() {
    try { read(Priv.loc("archive", null)); } catch (e) { }
    try { read(await Priv.get("archive", { list: [] })); } catch (e) { }
    paint();
  }
  const save = () => Priv.set("archive", { list: S.list });
  const cut = () => S.cut;
  const dateMs = d => { const t = new Date(String(d || "").replace(" ", "T")).getTime(); return isFinite(t) ? t : 0; };

  /* يفصل الطلبات المؤرشفة عن الحيّة؛ تُستدعى من Admin.liveOrders */
  function split(list) {
    const a = A(); if (!a) return list;
    const arch = [], live = [];
    (list || []).forEach(o => (S.ids.size && S.ids.has(String(o.id)) ? arch : live).push(o));
    a.archivedOrders = arch;
    try { S.liveTrk = new Set(live.map(o => { const t = a.trackingOf(o); return t ? String(t.tracking || t) : ""; }).filter(Boolean)); } catch (e) { S.liveTrk = null; }
    try { if (typeof AdminYd !== "undefined" && AdminYd.refilter) setTimeout(() => AdminYd.refilter(), 0); } catch (e) { }
    return live;
  }
  /* طرد الشركة مخفيّ؟ مرتبط بطلب مؤرشف، أو أقدم من آخر أرشفة وبلا طلب حيّ يقابله */
  function hiddenRow(r) {
    if (!S.list.length || !r) return false;
    const t = String(r.tracking || ""); if (S.trk.has(t)) return true;
    if (S.cut && S.liveTrk && !S.liveTrk.has(t)) { const d = dateMs(r.date); if (d && d < S.cut) return true; }
    return false;
  }
  const archived = () => (A() && A().archivedOrders) || [];
  const allOrders = () => ((A() && A().orders) || []).concat(archived());

  function eligible(o) {
    if (!o || !FINAL.includes(o.status)) return false;
    try { const W = A()._W && A()._W(); if (W && W.tagOf(o.note).has) return false; } catch (e) { }   /* ما زالت علبه محسومة من المخزون (مرتجع لم يصل) */
    return true;
  }
  function plan() {
    const a = A(), L = (a && a.orders) || [], el = L.filter(eligible), by = k => el.filter(o => o.status === k).length;
    return { el, n: el.length, livree: by("livree"), echec: by("echec"), annulee: by("annulee"), keep: L.length - el.length };
  }
  function summarize(list) {
    const a = A(), s = { n: list.length, livree: 0, echec: 0, annulee: 0, sales: 0, real: null, ad: 0 };
    list.forEach(o => { if (o.status === "livree") { s.livree++; s.sales += Number(o.total) || 0; } else if (o.status === "echec") s.echec++; else if (o.status === "annulee") s.annulee++; });
    try { const keep = a.orders; a.orders = list; try { const f = a.computeFinance(0); s.real = Math.round(f.K.real); s.ad = Math.round(f.K.adTotal || 0); } finally { a.orders = keep; } } catch (e) { }
    return s;
  }
  function csv(list) {
    const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""').replace(/\r?\n/g, " ") + '"';
    const rows = [["id", "date", "name", "phone", "wilaya", "commune", "status", "total", "items"]].concat(list.map(o => [o.id, o.date, o.name, o.phone, o.wilaya, o.commune, o.status, o.total, o.items_text || o.items || ""]));
    return "﻿" + rows.map(r => r.map(q).join(",")).join("\n");
  }
  function down(name, text) { const b = new Blob([text], { type: "text/csv;charset=utf-8" }), u = URL.createObjectURL(b), l = document.createElement("a"); l.href = u; l.download = name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }

  /* إعادة توزيع الطلبات بعد أرشفة/استرجاع دون إعادة تحميل الصفحة */
  function redistribute() {
    const a = A(); if (!a) return;
    const all = allOrders(); a.orders = split(all);
    try { a._adRows = null; } catch (e) { }
    ["renderAll", "renderFinance", "renderShipped", "renderOrders"].forEach(f => { try { a[f] && a[f](); } catch (e) { } });
    try { typeof AdminYd !== "undefined" && AdminYd.refilter && AdminYd.refilter(); } catch (e) { }
    try { typeof AdminPayments !== "undefined" && AdminPayments.render && AdminPayments.render(); } catch (e) { }
    try { typeof AdminProfit !== "undefined" && AdminProfit.render && AdminProfit.render(); } catch (e) { }
    paint();
  }

  async function doArchive(name, withAds) {
    const a = A(), p = plan(); if (!p.n || S.busy) return false; S.busy = true;
    try {
      const sum = summarize(p.el), snap = {};
      const trk = p.el.map(o => { const t = a.trackingOf(o); return t ? String(t.tracking || t) : ""; }).filter(Boolean);
      const rec = { id: "a" + Date.now().toString(36), name: name || ("حتى " + new Date().toISOString().slice(0, 10)), at: Date.now(), ids: p.el.map(o => String(o.id)), trk, sum, snap };
      if (withAds && a.fin) {
        rec.snap = { ads: JSON.parse(JSON.stringify(a.fin.ads || {})), adh: JSON.parse(JSON.stringify(a.fin.adh || [])) };
        a.fin.ads = {}; a.fin.adh = [];
        await Priv.set("adcfg", {}); await Priv.set("adhist", []);
      }
      S.list.push(rec); index(); await save();
      redistribute();
      return true;
    } finally { S.busy = false; }
  }
  async function restoreLast() {
    const a = A(), r = S.list[S.list.length - 1]; if (!r || S.busy) return false; S.busy = true;
    try {
      if (r.snap && a.fin && (Object.keys(r.snap.ads || {}).length || (r.snap.adh || []).length)) {
        a.fin.ads = Object.assign({}, r.snap.ads || {}, a.fin.ads || {});
        const have = new Set((a.fin.adh || []).map(h => h.id)); a.fin.adh = (r.snap.adh || []).filter(h => !have.has(h.id)).concat(a.fin.adh || []);
        await Priv.set("adcfg", a.fin.ads); await Priv.set("adhist", a.fin.adh);
      }
      S.list.pop(); index(); await save();
      redistribute();
      return true;
    } finally { S.busy = false; }
  }

  /* ---------- الواجهة ---------- */
  function since() { return S.cut ? "من " + new Date(S.cut).toISOString().slice(0, 10) : "من البداية"; }
  function paint() {
    TABS.forEach(t => {
      const tab = document.getElementById("tab-" + t); if (!tab) return;
      let bar = tab.querySelector(":scope > .arch-bar");
      if (!bar) { bar = document.createElement("div"); bar.className = "arch-bar"; tab.insertBefore(bar, tab.firstChild); bar.addEventListener("click", e => { if (e.target.closest("[data-arch=open]")) show(); }); }
      bar.innerHTML = '<span class="arch-t">📅 الفترة الحالية ' + esc(since()) + (S.list.length ? " · " + S.list.length + " أرشيف" : "") + '</span><button type="button" class="small" data-arch="open">🗄 الأرشيف · بداية جديدة</button>';
    });
  }
  function css() {
    if (document.getElementById("arch-css")) return; const s = document.createElement("style"); s.id = "arch-css";
    s.textContent = `.arch-bar{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:0 0 10px;padding:8px 12px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18)}
.arch-t{font-weight:700;font-size:.88rem}
#arch-bg{position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:14px}
#arch-bg .ar-box{background:#0b1f18;color:#ecfdf5;border:1px solid rgba(226,254,23,.35);border-radius:18px;width:min(760px,100%);max-height:92vh;overflow:auto;padding:18px}
#arch-bg h3{margin:0 0 6px;font-size:1.15rem}#arch-bg .ar-s{margin:12px 0;padding:12px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14)}
#arch-bg .ar-g{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}#arch-bg input[type=text]{width:100%;padding:9px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff}
#arch-bg .ar-k{display:inline-block;margin:2px 6px 2px 0;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,.1);font-size:.82rem}
#arch-bg label.ar-c{display:flex;gap:8px;align-items:center;margin-top:8px;font-size:.9rem}
#arch-bg .ar-warn{color:#fde68a;font-size:.85rem;margin-top:6px}`;
    document.head.appendChild(s);
  }
  function card(r, last) {
    const m = r.sum || {};
    return '<div class="ar-s"><b>' + esc(r.name) + '</b> <small>· ' + esc(new Date(r.at).toISOString().slice(0, 10)) + '</small><div style="margin-top:6px">' +
      '<span class="ar-k">' + (m.n || (r.ids || []).length) + ' طلب</span><span class="ar-k">مسلَّم ' + (m.livree || 0) + '</span><span class="ar-k">مرتجع ' + (m.echec || 0) + '</span><span class="ar-k">ملغى ' + (m.annulee || 0) + '</span>' +
      '<span class="ar-k">مبيعات ' + dz(m.sales) + '</span>' + (m.real != null ? '<span class="ar-k">الربح الصافي ' + dz(m.real) + '</span>' : "") + '</div>' +
      '<div class="ar-g"><button type="button" class="small" data-arch="csv" data-id="' + esc(r.id) + '">⬇ تنزيل طلبات هذه الفترة (CSV)</button>' +
      (last ? '<button type="button" class="small warn" data-arch="restore">↩ استرجاع هذا الأرشيف</button>' : "") + '</div></div>';
  }
  function show() {
    css(); const a = A(); if (!a) return;
    if (typeof AdminRoles !== "undefined" && AdminRoles.isReadOnly && AdminRoles.isReadOnly()) { try { toast("⛔ الأرشفة للمالك فقط"); } catch (e) { } return; } let bg = document.getElementById("arch-bg"); if (bg) bg.remove();
    const p = plan(); bg = document.createElement("div"); bg.id = "arch-bg";
    const nm = "حتى " + new Date().toISOString().slice(0, 10);
    bg.innerHTML = '<div class="ar-box" dir="rtl"><h3>🗄 الأرشيف وبداية جديدة</h3><div style="opacity:.85;font-size:.9rem">الفترة الحالية ' + esc(since()) + '. الأرشفة تُخفي الطلبات المنتهية من كل الأقسام والإحصائيات وتبدأ الحساب من الصفر دون حذف شيء، ويمكن استرجاع آخر أرشيف.</div>' +
      '<div class="ar-s"><b>ابدأ فترة جديدة الآن</b>' +
      (p.n ? '<div style="margin-top:6px"><span class="ar-k">سيُؤرشف ' + p.n + ' طلب</span><span class="ar-k">مسلَّم ' + p.livree + '</span><span class="ar-k">مرتجع ' + p.echec + '</span><span class="ar-k">ملغى ' + p.annulee + '</span><span class="ar-k">يبقى نشطاً ' + p.keep + '</span></div>' : '<div class="ar-warn">لا طلبات منتهية لأرشفتها الآن.</div>') +
      '<div style="margin-top:8px">اسم الأرشيف<input id="ar-nm" type="text" value="' + esc(nm) + '"></div>' +
      '<label class="ar-c"><input id="ar-ads" type="checkbox" checked> أرشِف الحملات الإعلانية الحالية وابدأها من الصفر</label>' +
      '<div class="ar-warn">تبقى نشطة: الطلبات الجديدة والمؤكَّدة وقيد التوصيل، والمرتجعات التي لم يصل مخزونها بعد. التكاليف وأسعار الشراء والإعدادات لا تتغير.</div>' +
      '<div class="ar-g"><button type="button" class="small" data-arch="csvnow"' + (p.n ? "" : " disabled") + '>⬇ نسخة CSV أولاً</button><button type="button" class="ah-btn" data-arch="go"' + (p.n ? "" : " disabled") + '>🗄 أرشِف وابدأ من الصفر</button><button type="button" class="small gray" data-arch="x">إغلاق</button></div></div>' +
      (S.list.length ? '<b>الأرشيفات السابقة</b>' + S.list.slice().reverse().map((r, i) => card(r, i === 0)).join("") : "") + '</div>';
    document.body.appendChild(bg);
    bg.addEventListener("click", async e => {
      if (e.target === bg) { bg.remove(); return; }
      const b = e.target.closest("[data-arch]"); if (!b) return; const k = b.dataset.arch;
      if (k === "x") bg.remove();
      else if (k === "csvnow") down("orders-" + new Date().toISOString().slice(0, 10) + ".csv", csv(plan().el));
      else if (k === "csv") { const r = S.list.find(x => x.id === b.dataset.id), ids = new Set((r && r.ids || []).map(String)); down("archive-" + (r ? r.name : "") + ".csv", csv(archived().filter(o => ids.has(String(o.id))))); }
      else if (k === "go") {
        const pl = plan(); if (!pl.n) return;
        if (!confirm("سيُؤرشف " + pl.n + " طلب وتبدأ الإحصائيات والأرباح والمدفوعات من الصفر. يمكنك استرجاع الأرشيف لاحقاً. متابعة؟")) return;
        b.disabled = true; b.textContent = "⏳ جارٍ الأرشفة…";
        const ok = await doArchive((document.getElementById("ar-nm") || {}).value || "", !!(document.getElementById("ar-ads") || {}).checked);
        bg.remove(); if (ok) try { toast("✅ أُرشف " + pl.n + " طلب — بدأت فترة جديدة من الصفر"); } catch (er) { }
      } else if (k === "restore") {
        if (!confirm("سيعود آخر أرشيف إلى الإحصائيات والأقسام. متابعة؟")) return;
        const ok = await restoreLast(); bg.remove(); if (ok) try { toast("↩ استُرجع الأرشيف"); } catch (er) { }
      }
    });
  }
  setTimeout(function w() { if (document.getElementById("tab-shipped")) paint(); else setTimeout(w, 800); }, 1500);
  return { load, split, hiddenRow, cut, show, plan, archived, allOrders, eligible, summarize, doArchive, restoreLast, S };
})();
