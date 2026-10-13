/* المستودعات والمرتجعات: (1) مستودعات متعددة — الكمية الكلية للمنتج تبقى في `p.stock` (يقرؤها الموقع)، والمستودع الرئيسي = الكلي − مجموع بقية المستودعات،
   فلا يتجاوز أي تعديل يدوي للمخزون هذه الطبقة؛ كل طلب مؤكَّد يخصم من مستودع ولايته (وسم 📦@معرّف) ويعيد المرتجع إلى المستودع نفسه.
   (2) المرتجعات: طرد مرتجع لا يُعاد إلى المخزون حين يبدأ رجوعه بل حين يُسلَّم للبائع فعلاً (سياسة قابلة للتغيير)، والمرحلة تُقرأ من حالة الشركة
   (وسم 🔁مرحلة يكتبه الـwebhook أو المزامنة) ثم يُعاد تلقائياً دون أن يعدّل التاجر كميات يدوياً. */
(function (root) {
  const TAG_RE = /📦(?!livree)(?:@([\w-]+))?/, TAG_RE_G = /📦(?!livree)(?:@[\w-]+)?\s*/g, PH_RE = /🔁(transit|ready|received)/, PH_RE_G = /🔁\w+\s*/g;
  const RANK = { "": 0, transit: 1, ready: 2, received: 3 };
  const fold = s => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  /* مرحلة الرجوع من نص حالة الشركة: received = سُلِّم للبائع، ready = جاهز للسحب من مركز الشركة، transit = في طريق العودة، "" = لا يخصّ الإرجاع */
  function returnPhase(raw) {
    const t = fold(raw); if (!t) return "";
    if (/retourne\w*\s+(au|chez)\s+(le\s+)?(vendeur|expediteur|marchand|fournisseur)|retour\s+(recu|termine|livre|remis)|returned\s+to\s+(the\s+)?(sender|seller|vendor|merchant)|(مسترجع|ارجع|أرجع)\w*\s+(للبائع|الى البائع)/.test(t)) return "received";
    if (/retour\s+a\s+retirer|retour.*(disponible|en attente de retrait|a recuperer)|return.*(ready|available)/.test(t)) return "ready";
    if (/retour|retourn|return|echec livraison|echange.*(echou|echec)|refus|annul/.test(t)) return "transit";
    return "";
  }
  const maxPhase = (a, b) => ((RANK[b] || 0) > (RANK[a] || 0) ? b : (a || ""));
  const hold = (phase, policy) => policy !== "immediate" && (phase === "transit" || phase === "ready");     // «immediate» = السلوك القديم: يُعاد عند أول حالة فشل
  const phaseOfNote = note => { const m = PH_RE.exec(String(note || "")); return m ? m[1] : ""; };
  const withPhase = (note, ph) => { const c = String(note || "").replace(PH_RE_G, "").replace(/\s+/g, " ").trim(); return ph ? ((c ? c + " " : "") + "🔁" + ph) : c; };
  const tagOf = note => { const m = TAG_RE.exec(String(note || "")); return { has: !!m, wh: (m && m[1]) || "main" }; };
  const tagText = wh => "📦" + (wh && wh !== "main" ? "@" + wh : "");

  const normCfg = c => { c = c && typeof c === "object" ? c : {}; return { on: !!c.on, main: String(c.main || "المستودع الرئيسي"), list: (Array.isArray(c.list) ? c.list : []).filter(x => x && /^[\w-]{1,24}$/.test(x.id) && x.id !== "main").map(x => ({ id: x.id, name: String(x.name || x.id).slice(0, 40), from: x.from ? String(x.from).slice(0, 40) : "" })), routing: (c.routing && typeof c.routing === "object") ? c.routing : {}, retPolicy: c.retPolicy === "immediate" ? "immediate" : "received" }; };
  const exists = (cfg, id) => id === "main" || cfg.list.some(w => w.id === id);
  const nameOf = (cfg, id) => id === "main" ? cfg.main : ((cfg.list.find(w => w.id === id) || {}).name || id);
  /* المستودع المقرَّر لولاية الطلب (معرّف الولاية الأم)؛ main إن لم تُخصَّص أو كانت الميزة مطفأة */
  const pickWh = (cfg, parentId) => { if (!cfg || !cfg.on) return "main"; const w = cfg.routing[parentId]; return w && exists(cfg, w) ? w : "main"; };
  const keyOf = (slug, v) => (v && v.id != null) ? slug + ":" + v.id : slug;
  const qtyIn = (st, key, wh) => Number(((st || {})[key] || {})[wh]) || 0;
  const others = (st, key) => Object.values((st || {})[key] || {}).reduce((t, x) => t + (Number(x) || 0), 0);
  const mainQty = (total, st, key) => (Number(total) || 0) - others(st, key);
  function addStock(st, key, wh, d) { if (!wh || wh === "main") return; const o = st[key] || (st[key] = {}); o[wh] = (Number(o[wh]) || 0) + d; if (!o[wh]) delete o[wh]; if (!Object.keys(o).length) delete st[key]; }
  function setQty(st, key, wh, q) { q = Math.max(0, Math.floor(Number(q)) || 0); const o = st[key] || (st[key] = {}); if (q) o[wh] = q; else delete o[wh]; if (!Object.keys(o).length) delete st[key]; }
  /* نقل كمية بين مستودعين: الكلي لا يتغير؛ يرجع نص الخطأ أو "" عند النجاح */
  function transfer(st, key, total, from, to, qty) {
    qty = Math.floor(Number(qty)) || 0; if (qty <= 0) return "اكتب كمية صحيحة"; if (from === to) return "اختر مستودعين مختلفين";
    const have = from === "main" ? mainQty(total, st, key) : qtyIn(st, key, from); if (have < qty) return "الكمية المتاحة في المصدر " + have + " فقط";
    if (from !== "main") addStock(st, key, from, -qty); if (to !== "main") addStock(st, key, to, qty); return "";
  }
  const M = { TAG_RE, TAG_RE_G, PH_RE_G, returnPhase, maxPhase, hold, phaseOfNote, withPhase, tagOf, tagText, normCfg, pickWh, nameOf, exists, keyOf, qtyIn, others, mainQty, addStock, setQty, transfer };
  root.AdminWh = M;
  if (typeof module !== "undefined" && module.exports) module.exports = M;
  if (typeof document === "undefined") return;

  /* ═════ الحالة والتخزين (Priv: لا تُنشر للموقع) ═════ */
  const A = () => (typeof Admin !== "undefined" ? Admin : null), $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = t => { const a = A(); if (a && a.toast) a.toast(t); };
  let saveT = null;
  M.load = async function () { let c = null, s = null; try { c = await Priv.get("warehouses", {}); s = await Priv.get("whstock", {}); } catch (e) { } return { cfg: normCfg(c), stock: (s && typeof s === "object") ? s : {} }; };
  M.saveStock = function () { clearTimeout(saveT); saveT = setTimeout(() => { try { Priv.set("whstock", A().wh.stock); } catch (e) { } }, 1500); };
  M.saveCfg = function () { try { Priv.set("warehouses", A().wh.cfg); } catch (e) { } };

  /* ═════ الواجهة: بطاقة داخل تبويب المخزون ═════ */
  const BTN = "padding:.45rem .85rem;border-radius:12px;font:inherit;font-weight:800;font-size:.84rem;color:#fff;cursor:pointer;border:1px solid rgba(34,197,94,.6);background:linear-gradient(180deg,rgba(34,197,94,.45),rgba(34,197,94,.16));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -3px 6px rgba(0,0,0,.22),0 3px 10px rgba(0,0,0,.25);backdrop-filter:blur(6px)";
  const BTN_O = BTN.replace(/34,197,94/g, "251,146,60"), BTN_R = BTN.replace(/34,197,94/g, "239,68,68"), BTN_G = BTN.replace(/rgba\(34,197,94,\.6\)/, "rgba(255,255,255,.22)").replace(/rgba\(34,197,94,\.45\)/, "rgba(255,255,255,.14)").replace(/rgba\(34,197,94,\.16\)/, "rgba(255,255,255,.04)");
  const IN = "padding:.4rem .6rem;border-radius:10px;font:inherit;background:rgba(255,255,255,.07);color:#fff;border:1px solid rgba(255,255,255,.2);min-width:0";
  const PH_AR = { transit: ["في طريق العودة", "#fbbf24"], ready: ["جاهز للسحب من مركز الشركة", "#fb923c"], received: ["سُلِّم للبائع", "#4ade80"] };
  const tracked = () => { const a = A(), out = []; (a.products || []).forEach(p => { const vs = p.type === "variable" && Array.isArray(p.variations) ? p.variations.filter(v => v.stock != null) : []; if (vs.length) vs.forEach(v => out.push({ p, v, key: keyOf(p.slug, v), title: p.title + " — " + Object.values(v.attrs || {}).join(" / "), total: Number(v.stock) || 0 })); else if (p.stock != null) out.push({ p, v: null, key: keyOf(p.slug), title: p.title, total: Number(p.stock) || 0 }); }); return out; };
  const pending = () => { const a = A(); return (a.orders || []).filter(o => o.status === "echec" && tagOf(o.note).has); };
  const parent = name => { const w = (root.WILAYAS || []).find(x => x.name === name); return w ? (w.par || w.id) : 0; };

  function html() {
    const a = A(), W = a.wh || (a.wh = { cfg: normCfg(), stock: {} }), c = W.cfg, rows = tracked(), pend = pending();
    const logs = ((a.fin && a.fin.log) || []).filter(e => /^مرتجع/.test(e.why || "")).slice(0, 6);
    let h = '<div class="card" id="wr-card" style="margin-top:1rem"><h3 style="margin:0 0 .4rem">↩️ المرتجعات والمستودعات</h3>';
    /* المرتجعات */
    h += '<div class="field"><label>متى يعود الطرد المرتجع إلى المخزون تلقائياً؟</label><select id="wr-pol" style="' + IN + '"><option value="received"' + (c.retPolicy === "received" ? " selected" : "") + '>عندما يُسلَّم لي فعلاً (موصى به)</option><option value="immediate"' + (c.retPolicy === "immediate" ? " selected" : "") + '>فور تسجيله كمرتجع (قبل وصوله)</option></select><div class="hint">الطرد الذي لا يزال في طريق العودة لا يُحسب مخزوناً متاحاً، فلا تبيعه وهو ليس عندك. تُقرأ المرحلة من حالة شركة التوصيل وتتحدث وحدها.</div></div>';
    h += '<b>طرود مرتجعة تنتظر العودة (' + pend.length + ')</b>';
    h += pend.length ? '<div style="display:grid;gap:.4rem;margin:.4rem 0">' + pend.map(o => { const ph = a.returnPhase(o), p = PH_AR[ph] || ["حالة الرجوع غير معروفة", "#9ca3af"]; return '<div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;justify-content:space-between;padding:.5rem;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)"><span><b>' + esc(o.name || o.id) + '</b> · ' + esc(o.id) + ' · <span style="color:' + p[1] + '">' + p[0] + '</span></span><span style="display:flex;gap:.3rem;flex-wrap:wrap"><button type="button" data-wh="recv" data-id="' + esc(o.id) + '" style="' + BTN + '">✔ استلمتُه — أعده للمخزون</button><button type="button" data-wh="dmg" data-id="' + esc(o.id) + '" style="' + BTN_R + '">🔻 تالف — لا تُعده</button></span></div>'; }).join("") + '</div><div style="margin:.3rem 0"><button type="button" data-wh="check" style="' + BTN_O + '">⟳ تحقق من حالة الطرود الآن</button></div>' : '<div class="hint" style="margin:.3rem 0">لا طرود مرتجعة بانتظار العودة.</div>';
    if (logs.length) h += '<div class="hint">آخر ما أُعيد تلقائياً: ' + logs.map(e => esc(e.title) + " +" + e.delta).join("، ") + '</div>';
    /* المستودعات */
    h += '<hr style="border:0;border-top:1px solid rgba(255,255,255,.12);margin:.8rem 0"><label style="display:flex;gap:.5rem;align-items:center;font-weight:800"><input type="checkbox" id="wr-on"' + (c.on ? " checked" : "") + '> تفعيل المستودعات المتعددة</label><div class="hint">الكمية الكلية هي التي يراها الزبون في الموقع. كل طلب مؤكَّد يخصم من مستودع ولايته، والمرتجع يعود إلى المستودع نفسه الذي خرج منه.</div>';
    if (c.on) {
      h += '<div style="display:grid;gap:.5rem;margin:.5rem 0"><label style="display:flex;gap:.5rem;align-items:center">المستودع الرئيسي: <input id="wr-main" value="' + esc(c.main) + '" style="' + IN + '"></label>';
      h += c.list.map(w => { const ws = Object.keys(c.routing).filter(k => c.routing[k] === w.id); return '<div style="padding:.5rem;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);display:grid;gap:.4rem"><div style="display:flex;gap:.4rem;align-items:center"><input data-whname="' + w.id + '" value="' + esc(w.name) + '" style="' + IN + ';flex:1"><button type="button" data-wh="del" data-id="' + w.id + '" style="' + BTN_R + '">حذف</button></div><label class="hint" style="margin:0;display:grid;gap:.2rem">ولاية الانطلاق عند الشحن من هذا المستودع<select data-whfrom="' + w.id + '" style="' + IN + '"><option value="">الافتراضية (من إعدادات شركة التوصيل)</option>' + (root.WILAYAS || []).filter(x => !x.par).map(x => '<option value="' + esc(x.name) + '"' + (w.from === x.name ? " selected" : "") + '>' + x.id + ' — ' + esc(x.name) + '</option>').join("") + '</select></label><div class="hint" style="margin:0">ولايات هذا المستودع:</div><div style="display:flex;gap:.3rem;flex-wrap:wrap">' + (ws.map(k => { const wl = (root.WILAYAS || []).find(x => x.id === +k); return '<span style="padding:.15rem .55rem;border-radius:99px;border:1px solid rgba(255,255,255,.25);font-size:.78rem">' + esc(wl ? wl.id + " " + wl.name : k) + ' <a href="#" data-wh="unr" data-w="' + k + '" style="color:#f87171;text-decoration:none">✕</a></span>'; }).join("") || '<span class="hint" style="margin:0">لا ولايات (كل الطلبات من المستودع الرئيسي)</span>') + '</div><select data-whadd="' + w.id + '" style="' + IN + '"><option value="">＋ أضف ولاية…</option>' + (root.WILAYAS || []).filter(x => !x.par).map(x => '<option value="' + x.id + '">' + x.id + ' — ' + esc(x.name) + (c.routing[x.id] && c.routing[x.id] !== w.id ? " (حالياً: " + esc(nameOf(c, c.routing[x.id])) + ")" : "") + '</option>').join("") + '</select></div>'; }).join("");
      h += '<div style="display:flex;gap:.4rem"><input id="wr-new" placeholder="اسم مستودع جديد" style="' + IN + ';flex:1"><button type="button" data-wh="add" style="' + BTN + '">＋ إضافة</button></div></div>';
      if (rows.length) {
        const cols = ["main"].concat(c.list.map(w => w.id));
        h += '<div style="overflow:auto"><table class="rt" style="width:100%;border-collapse:collapse;font-size:.85rem"><tr><th style="text-align:right">المنتج</th>' + cols.map(id => '<th>' + esc(nameOf(c, id)) + '</th>').join("") + '<th>الكلي</th></tr>' + rows.map(r => '<tr><td>' + esc(r.title) + '</td>' + cols.map(id => id === "main" ? '<td style="text-align:center;' + (mainQty(r.total, W.stock, r.key) < 0 ? "color:#f87171" : "") + '">' + mainQty(r.total, W.stock, r.key) + '</td>' : '<td style="text-align:center"><input type="number" min="0" data-whq="' + esc(r.key) + '" data-wid="' + id + '" value="' + qtyIn(W.stock, r.key, id) + '" style="' + IN + ';width:70px;text-align:center"></td>').join("") + '<td style="text-align:center"><b>' + r.total + '</b></td></tr>').join("") + '</table></div>';
        h += '<div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:end;margin-top:.6rem"><label>نقل<select id="wr-tp" style="' + IN + '">' + rows.map(r => '<option value="' + esc(r.key) + '">' + esc(r.title) + '</option>').join("") + '</select></label><label>من<select id="wr-tf" style="' + IN + '">' + cols.map(id => '<option value="' + id + '">' + esc(nameOf(c, id)) + '</option>').join("") + '</select></label><label>إلى<select id="wr-tt" style="' + IN + '">' + cols.map((id, i) => '<option value="' + id + '"' + (i === 1 ? " selected" : "") + '>' + esc(nameOf(c, id)) + '</option>').join("") + '</select></label><label>الكمية<input id="wr-tq" type="number" min="1" style="' + IN + ';width:80px"></label><button type="button" data-wh="tr" style="' + BTN + '">↔ نقل</button></div><div id="wr-msg" class="hint"></div>';
      } else h += '<div class="hint">فعّل تتبّع الكمية لمنتج (حقل المخزون) ليظهر هنا.</div>';
    }
    return h + '</div>';
  }
  function draw() { const t = $("tab-inventory"); if (!t) return; let host = $("wr-host"); if (!host) { host = document.createElement("div"); host.id = "wr-host"; t.appendChild(host); } host.innerHTML = html(); }
  async function onClick(e) {
    const b = e.target.closest("[data-wh]"); if (!b) return; e.preventDefault(); const a = A(), W = a.wh, c = W.cfg, k = b.dataset.wh, id = b.dataset.id;
    if (k === "add") { const n = ($("wr-new") || {}).value.trim(); if (!n) return; const nid = "w" + Date.now().toString(36).slice(-5); c.list.push({ id: nid, name: n.slice(0, 40) }); M.saveCfg(); draw(); }
    else if (k === "del") { if (!confirm("حذف هذا المستودع؟ تُعاد كمياته إلى المستودع الرئيسي.")) return; c.list = c.list.filter(w => w.id !== id); Object.keys(c.routing).forEach(z => { if (c.routing[z] === id) delete c.routing[z]; }); Object.keys(W.stock).forEach(kk => { delete W.stock[kk][id]; if (!Object.keys(W.stock[kk]).length) delete W.stock[kk]; }); M.saveCfg(); M.saveStock(); draw(); }
    else if (k === "unr") { delete c.routing[b.dataset.w]; M.saveCfg(); draw(); }
    else if (k === "tr") { const key = $("wr-tp").value, r = tracked().find(x => x.key === key), err = r ? transfer(W.stock, key, r.total, $("wr-tf").value, $("wr-tt").value, $("wr-tq").value) : "اختر منتجاً"; if (err) { $("wr-msg").textContent = "⚠️ " + err; return; } a.stockLog(r.p, 0, r.total, "نقل", "نقل مخزون: " + nameOf(c, $("wr-tf").value) + " ← " + nameOf(c, $("wr-tt").value) + " (" + $("wr-tq").value + ")"); M.saveStock(); toast("✅ نُقلت الكمية"); draw(); }
    else if (k === "recv" || k === "dmg") { const o = (a.orders || []).find(x => x.id === id); if (!o) return; if (k === "recv") a.syncStockForOrder(o, "echec", { force: true }); else a.syncStockForOrder(o, "echec", { damaged: true }); a.renderOrders && a.renderOrders(); draw(); toast(k === "recv" ? "↩ أُعيد الطرد إلى المخزون" : "🔻 سُجّل تالفاً ولم يُعَد"); }
    else if (k === "check") { b.disabled = true; b.textContent = "…"; await a.returnsSweep({ net: true, manual: true }); draw(); }
  }
  function onChange(e) {
    const a = A(), W = a.wh, c = W.cfg, t = e.target;
    if (t.id === "wr-pol") { c.retPolicy = t.value === "immediate" ? "immediate" : "received"; M.saveCfg(); a.returnsSweep(); toast("✅ حُفظت السياسة"); }
    else if (t.id === "wr-on") { c.on = t.checked; M.saveCfg(); draw(); }
    else if (t.id === "wr-main") { c.main = t.value.trim().slice(0, 40) || "المستودع الرئيسي"; M.saveCfg(); }
    else if (t.dataset.whname) { const w = c.list.find(x => x.id === t.dataset.whname); if (w) { w.name = t.value.trim().slice(0, 40) || w.id; M.saveCfg(); } }
    else if (t.dataset.whfrom) { const w = c.list.find(x => x.id === t.dataset.whfrom); if (w) { w.from = t.value; M.saveCfg(); toast("✅ حُفظت ولاية الانطلاق"); } }
    else if (t.dataset.whadd) { if (t.value) { c.routing[t.value] = t.dataset.whadd; M.saveCfg(); draw(); } }
    else if (t.dataset.whq) { const r = tracked().find(x => x.key === t.dataset.whq); if (!r) return; setQty(W.stock, t.dataset.whq, t.dataset.wid, t.value); a.stockLog(r.p, 0, r.total, "يدوي", "تعديل كمية مستودع: " + nameOf(c, t.dataset.wid) + " = " + t.value); M.saveStock(); draw(); }
  }
  function init() {
    const w = () => { const a = A(); if (!a || !a.tab || a._whWrapped) return; const orig = a.tab; a.tab = function (t, btn) { const r = orig.call(this, t, btn); if (t === "inventory") setTimeout(draw, 250); return r; }; a._whWrapped = true; };
    w(); setTimeout(w, 500);
    let ob = null; const watch = () => { const t = $("tab-inventory"); if (!t || ob) return; ob = new MutationObserver(() => { clearTimeout(watch._t); watch._t = setTimeout(() => { const tt = $("tab-inventory"); if (tt && !tt.classList.contains("hidden") && !$("wr-host")) draw(); }, 120); }); ob.observe(t, { childList: true }); };      // إعادة رسم تبويب المخزون قد تمسح البطاقة فتُعاد
    watch(); setTimeout(watch, 1500);
    document.addEventListener("click", e => { if (e.target.closest("#wr-host")) onClick(e); });
    document.addEventListener("change", e => { if (e.target.closest("#wr-host")) onChange(e); });
  }
  M.draw = draw; M._t = { tracked, pending, parent };
  init();
})(typeof window !== "undefined" ? window : globalThis);
