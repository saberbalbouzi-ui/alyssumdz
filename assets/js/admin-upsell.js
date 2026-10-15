/* «العروض الإضافية» في لوحة التحكم: قواعد Order Bump (خانة قبل زر التأكيد) وUpsell بعد الشراء (بطاقة في صفحة الشكر)، إحصاؤها،
   ودمج الطلب المرتبط (عرض بعد الشراء) في الطلب الأصلي ليُشحنا طرداً واحداً. القواعد في assets/data/upsell.json (يقرؤها المتجر: assets/js/upsell.js). */
const AdminUpsell = (() => {
  const FILE = "assets/data/upsell.json", GK = "🧺 مجموعة", UP = "🔼 عرض بعد الشراء", BP = "➕ إضافة سريعة", RID = "🆔 قاعدة العرض";
  const $ = id => document.getElementById(id), A = () => (typeof Admin !== "undefined" ? Admin : null);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = n => (Number(n) || 0).toLocaleString("fr-DZ") + " دج";
  let rules = [], sha, host, dirty = false;
  const dec = v => JSON.parse(decodeURIComponent(escape(atob(String(v || "").replace(/\s/g, "")))));
  const ex = o => { let e = o && o.extra; if (typeof e === "string") { try { e = JSON.parse(e); } catch (x) { e = {}; } } return e && typeof e === "object" ? e : {}; };
  const newRule = type => ({ id: "u_" + Date.now().toString(36), on: true, type: type || "bump", title: "", text: "", offer: "", mode: "pct", value: 20, trigger: { slugs: [], cats: [], min: 0 }, from: "", to: "" });

  /* ── التخزين ── */
  async function load() {
    try {
      if (typeof GH !== "undefined" && GH.cfg && GH.cfg().token) { const f = await GH.getFile(FILE); sha = f.sha; const j = dec(f.content); rules = Array.isArray(j) ? j : (j.rules || []); }
      else rules = (JSON.parse(localStorage.getItem("alyssum_upsell_draft") || "{}").rules) || [];
    } catch (e) { rules = []; }
    dirty = false; render();
  }
  async function save() {
    const bad = rules.find(r => !r.offer); if (bad) { toast("اختر المنتج المعروض في كل قاعدة"); return; }
    const json = JSON.stringify({ rules }, null, 2);
    try {
      if (typeof GH === "undefined" || !GH.cfg || !GH.cfg().token) { localStorage.setItem("alyssum_upsell_draft", json); toast("حُفظت مسودة محلية؛ اربط النشر لتظهر العروض في الموقع"); return; }
      if (!sha) { try { sha = (await GH.getFile(FILE)).sha; } catch (e) { } }
      const res = await GH.putFile(FILE, btoa(unescape(encodeURIComponent(json))), sha, "حفظ العروض الإضافية");
      sha = res && res.content && res.content.sha || sha; dirty = false; toast("✓ نُشرت العروض الإضافية — تظهر في الموقع خلال دقائق"); draw();
    } catch (e) { toast("تعذّر النشر: " + (e.message || "")); console.error(e); }
  }

  /* ── الإحصاء (من الطلبات الظاهرة في اللوحة، آخر 30 يوماً) ── */
  function stats(orders, now) {
    const from = (now || Date.now()) - 30 * 864e5, L = (orders || []).filter(o => new Date(o.date).getTime() >= from && o.status !== "annulee");
    const bump = L.filter(o => ex(o)[BP]), post = L.filter(o => ex(o)[UP]), main = L.filter(o => !ex(o)[UP]);
    const sum = a => a.reduce((s, o) => s + (Number(o.total) || 0), 0);
    return { orders: main.length, bump: bump.length, post: post.length, bumpRate: main.length ? Math.round(bump.length / main.length * 100) : 0, postRate: main.length ? Math.round(post.length / main.length * 100) : 0, postRev: sum(post),
      aovBump: bump.length ? Math.round(sum(bump) / bump.length) : 0, aovPlain: (main.length - bump.length) > 0 ? Math.round((sum(main) - sum(bump)) / (main.length - bump.length)) : 0 };
  }


  /* ربح كل قاعدة (آخر 30 يوماً): الطلبات الموسومة بمعرّفها؛ الإيراد المضاف = سطر المنتج المعروض (البمب) أو كامل الطلب المرتبط (بعد الشراء)، والربح = الإيراد − تكلفة الشراء (إن عُرفت) */
  function ruleStats(orders, rls, now) {
    const a = A(), from = (now || Date.now()) - 30 * 864e5, costs = (a && a.fin && a.fin.costs) || {};
    const L = (orders || []).filter(o => new Date(o.date).getTime() >= from && o.status !== "annulee" && o.status !== "echec" && !o._trash);
    return (rls || rules).map(r => {
      const mine = L.filter(o => ex(o)[RID] === r.id); let rev = 0, cost = 0, units = 0, known = true;
      mine.forEach(o => {
        const lines = a && a.orderLines ? a.orderLines(o) : [];
        lines.filter(l => l.p.slug === r.offer).forEach(l => { rev += l.total; units += l.qty; if (costs[l.p.slug] == null) known = false; else cost += (Number(costs[l.p.slug]) || 0) * l.qty; });
      });
      return { id: r.id, type: r.type, offer: r.offer, orders: mine.length, units, rev, cost: known ? cost : null, profit: known ? rev - cost : null };
    });
  }

  /* ── دمج الطلب المرتبط ── */
  function group(o, orders) {
    const g = ex(o)[GK]; if (!g) return null;
    const mem = (orders || []).filter(x => ex(x)[GK] === g && x.status !== "annulee" && !x._trash); if (mem.length < 2) return null;
    const keep = mem.filter(x => !ex(x)[UP]).sort((a, b) => new Date(a.date) - new Date(b.date))[0], drops = mem.filter(x => x !== keep && ex(x)[UP]);
    if (!keep || !drops.length) return null;
    return { keep, drops, total: drops.reduce((s, x) => s + (Number(x.total) || 0), 0) };
  }
  function blocked(g) {
    const a = A(); const reg = x => (a && a.trackingOf ? a.trackingOf(x) : null);
    if (g.keep.status !== "nouvelle" || g.drops.some(d => d.status !== "nouvelle")) return "الدمج متاح والطلبان «جديدان» (قبل التأكيد)";
    if (reg(g.keep) || g.drops.some(reg)) return "أحد الطلبين أُرسل إلى الشركة";
    return "";
  }
  /* مجموعات قابلة للدمج الآن (طلبان «جديدان» لم يُرسلا) — تغذّي بطاقة الرئيسية */
  function mergeable(orders) {
    const seen = {}, out = []; (orders || []).forEach(o => { const g = ex(o)[GK]; if (!g || seen[g] || o._trash) return; seen[g] = 1; const gr = group(o, orders); if (gr && !blocked(gr)) out.push(Object.assign({ gid: g }, gr)); });
    return out;
  }
  function previewRow(o) {
    const g = group(o, (A() || {}).orders); if (!g) return "";
    const why = blocked(g), names = g.drops.map(d => esc(String((A() || {}).itemsDisplay ? A().itemsDisplay(d) : "").split(/\n/)[0] || d.id)).join("، ");
    return '<tr><td style="color:#8a8f8c;width:120px;vertical-align:top">🧺 طلب مرتبط</td><td>طلب «عرض بعد الشراء»: ' + names + ' (' + fmt(g.total) + ')' +
      (why ? '<div style="font-size:.82rem;color:#fb923c;margin-top:.2rem">' + esc(why) + '</div>' : '<div style="margin-top:.3rem"><button type="button" class="small" onclick="AdminUpsell.mergeId(\'' + esc(o.id) + '\')">🧺 دمجهما في طلب واحد (شحنة واحدة)</button></div>') + '</td></tr>';
  }
  function ccLine(o) {
    const g = group(o, (A() || {}).orders); if (!g || blocked(g)) return g ? '<div class="ccm-m">🧺 له طلب مرتبط (عرض بعد الشراء) — ' + esc(blocked(g)) + '</div>' : "";
    return '<div class="ccm-m">🧺 اشترى أيضاً عبر «عرض بعد الشراء» (' + esc(fmt(g.total)) + ') — <button type="button" class="small" data-d="merge">دمجهما في طلب واحد</button></div>';
  }
  async function merge(o) {
    const a = A(), M = window.ManualOrder; if (!a || !M) return false; const g = group(o, a.orders); if (!g) { toast("لا طلب مرتبط للدمج"); return false; }
    const why = blocked(g); if (why) { toast(why); return false; }
    const lines = []; [g.keep].concat(g.drops).forEach(x => M.parseLines(a.itemsDisplay(x)).forEach(l => { const e = lines.find(y => y.title === l.title && y.price === l.price); if (e) e.qty += l.qty; else lines.push(Object.assign({}, l)); }));
    const P = a.products || [], clean = lines.map(l => ({ slug: ((P.find(p => p.title === l.title || (p.bord && p.bord === l.title)) || {}).slug) || "", title: l.title, qty: l.qty, price: l.price }));
    const c = M.calc(clean, g.keep.fee, g.keep.discount), txt = M.textOf(clean);
    if (!confirm("دمج " + g.drops.length + " طلب في طلب " + (g.keep.name || "") + "؟\nالإجمالي الجديد: " + fmt(c.total) + " (التوصيل: " + fmt(c.fee) + "). يُنقل الطلب المرتبط إلى سلة المهملات.")) return false;
    const fdb = { subtotal: c.sub, discount: c.disc, fee: c.fee, total: c.total, items: clean, items_text: txt }, local = Object.assign({}, fdb, { items: txt }); delete local.items_text;
    Object.assign(g.keep, local); if (window.OrderEdit && OrderEdit.stash) OrderEdit.stash(g.keep.id, local);
    let saved = false; try { saved = await API.updateOrderFields(a.key, g.keep.id, fdb); } catch (e) { }
    if (saved && window.OrderEdit && OrderEdit.unstash) OrderEdit.unstash(g.keep.id);
    g.keep.note = (String(g.keep.note || "") + " 🧺دُمج:" + g.drops.map(d => d.id).join(",")).trim(); try { API.updateOrder(a.key, g.keep.id, undefined, g.keep.note); } catch (e) { }
    try { await a.deleteOrders(g.drops, { silent: true }); } catch (e) { }
    toast("✓ دُمج الطلبان في طلب واحد" + (saved ? "" : " (محلياً على هذا الجهاز حتى يُفعَّل تعديل الطلبات في الخادم)"));
    try { a.renderAll && a.renderAll(); } catch (e) { } return true;
  }
  const mergeId = async id => { const a = A(), o = a && (a.orders || []).find(x => x.id === id); if (!o) return; const ok = await merge(o); if (ok) { const bg = $("ord-prev-bg"); if (bg) bg.classList.remove("open"); } };

  /* ── الواجهة ── */
  function prodOpts(sel) {
    const P = ((A() && A().products) || []).filter(p => p.active !== false && p.type !== "variable" && p.type !== "grouped" && p.slug !== "test");
    return '<option value="">— اختر المنتج —</option>' + P.map(p => '<option value="' + esc(p.slug) + '"' + (p.slug === sel ? " selected" : "") + '>' + esc(p.title) + " — " + fmt(p.price) + '</option>').join("");
  }
  function ruleStat(r) {
    const st = ruleStats((A() || {}).orders || [], [r])[0]; if (!st || !st.orders) return '<div style="margin-top:.3rem">لا طلبات بهذه القاعدة بعد (آخر 30 يوماً)</div>';
    return '<div style="margin-top:.3rem">📈 آخر 30 يوماً: <b>' + st.orders + '</b> طلب · إيراد مضاف <b>' + fmt(st.rev) + '</b> · ' + (st.profit == null ? 'الربح غير محسوب (أضف سعر شراء المنتج)' : 'ربح تقديري <b style="color:' + (st.profit >= 0 ? "#86efac" : "#fca5a5") + '">' + fmt(st.profit) + '</b>') + '</div>';
  }
  function ruleCard(r, i) {
    const P = ((A() && A().products) || []).filter(p => p.active !== false && p.slug !== "test"), cats = (A() && A().categories) || {}, f = (k, label, inner) => '<label class="fl"><span class="fl-t">' + label + '</span>' + inner + '</label>';
    const prod = P.find(p => p.slug === r.offer), base = prod ? Number(prod.price) || 0 : 0, price = r.mode === "price" ? Number(r.value) || 0 : Math.round(base * (1 - Math.min(100, Math.max(0, Number(r.value) || 0)) / 100));
    return '<div class="card" style="margin:.6rem 0;padding:.8rem" data-i="' + i + '"><div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;justify-content:space-between"><b>' + (r.type === "bump" ? "☑️ Order Bump" : "🔼 Upsell بعد الشراء") + '</b>' +
      '<span><label class="hint"><input type="checkbox" data-k="on"' + (r.on !== false ? " checked" : "") + '> مفعّل</label> <button type="button" class="small gray" data-act="up">↑</button> <button type="button" class="small gray" data-act="down">↓</button> <button type="button" class="small" style="background:var(--red)" data-act="del">حذف</button></span></div>' +
      '<div class="grid2">' + f("offer", "المنتج المعروض", '<select data-k="offer">' + prodOpts(r.offer) + '</select>') +
      f("mode", "طريقة السعر", '<select data-k="mode"><option value="pct"' + (r.mode === "pct" ? " selected" : "") + '>نسبة تخفيض %</option><option value="price"' + (r.mode === "price" ? " selected" : "") + '>سعر ثابت (دج)</option></select>') +
      f("value", r.mode === "price" ? "السعر الخاص (دج)" : "نسبة التخفيض %", '<input type="number" min="0" data-k="value" value="' + esc(r.value) + '">') +
      f("title", "العنوان (اختياري)", '<input data-k="title" value="' + esc(r.title) + '" placeholder="' + (r.type === "bump" ? "أضف الحقيبة الواقية فقط" : "عرض خاص لك فقط") + '">') + '</div>' +
      f("text", "النص (اختياري) — يمكنك استعمال {title} {price} {old} {pct}", '<input data-k="text" value="' + esc(r.text) + '" placeholder="أضف «{title}» إلى طلبك بـ {price} بدل {old}">') +
      '<div class="grid2">' + f("slugs", "يظهر عند شراء هذه المنتجات (فارغ = الكل)", '<select multiple size="4" data-k="slugs">' + P.map(p => '<option value="' + esc(p.slug) + '"' + ((r.trigger.slugs || []).includes(p.slug) ? " selected" : "") + '>' + esc(p.title) + '</option>').join("") + '</select>') +
      f("cats", "أو هذه التصنيفات", '<select multiple size="4" data-k="cats">' + Object.keys(cats).map(k => '<option value="' + esc(k) + '"' + ((r.trigger.cats || []).includes(k) ? " selected" : "") + '>' + esc(cats[k]) + '</option>').join("") + '</select>') +
      f("min", "أدنى مبلغ للطلب (دج)", '<input type="number" min="0" data-k="min" value="' + esc(r.trigger.min || 0) + '">') + f("from", "من تاريخ", '<input type="date" data-k="from" value="' + esc(r.from) + '">') + f("to", "إلى تاريخ", '<input type="date" data-k="to" value="' + esc(r.to) + '">') + '</div>' +
      '<div class="hint">' + (prod ? "السعر في الموقع: <b>" + fmt(price) + "</b> بدل " + fmt(base) + (price >= base ? " (لا تخفيض)" : "") : "اختر المنتج لمعاينة السعر") + ruleStat(r) + '</div></div>';
  }
  function draw() {
    const el = $("upsell-rules"); if (!el) return;
    el.innerHTML = rules.length ? rules.map(ruleCard).join("") : '<p class="hint" style="text-align:center;padding:1.2rem">لا توجد عروض بعد — أضف «Order Bump» أو «Upsell بعد الشراء».</p>';
    const s = $("upsell-save"); if (s) s.textContent = dirty ? "💾 حفظ ونشر (تغييرات غير محفوظة)" : "💾 حفظ ونشر";
  }
  function statsHtml() {
    const s = stats((A() || {}).orders || []);
    const box = (t, v, h) => '<div class="card" style="margin:0;padding:.6rem"><div class="hint">' + t + '</div><b style="font-size:1.25rem">' + v + '</b>' + (h ? '<div class="hint">' + h + '</div>' : "") + '</div>';
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem;margin:.6rem 0">' + box("طلبات بإضافة سريعة", s.bump, s.bumpRate + "% من الطلبات") + box("طلبات «بعد الشراء»", s.post, s.postRate + "% من الطلبات") + box("مبيعات مضافة بعد الشراء", fmt(s.postRev), "آخر 30 يوماً") +
      box("متوسط الطلب مع إضافة", s.aovBump ? fmt(s.aovBump) : "—", s.aovPlain ? "بدونها " + fmt(s.aovPlain) : "") + '</div>';
  }
  function render() {
    if (!host) return;
    host.innerHTML = '<div class="card"><h2>🎯 العروض الإضافية</h2><p class="hint">ارفع متوسط الطلب دون أن يقف الزبون أمام خطوات إضافية: <b>Order Bump</b> خانة اختيار قبل زر التأكيد تضيف منتجاً مكمّلاً بسعر خاص، و<b>Upsell بعد الشراء</b> بطاقة تظهر بعد تسجيل الطلب تضيف منتجاً ثانياً بنقرة واحدة. أول قاعدة صالحة هي التي تظهر.</p>' +
      statsHtml() + '<div class="action-bar"><button type="button" id="upsell-add-b">＋ Order Bump</button><button type="button" id="upsell-add-p">＋ Upsell بعد الشراء</button><button type="button" id="upsell-save">💾 حفظ ونشر</button></div></div><div id="upsell-rules"></div>' +
      '<div class="card"><h3>كيف يصل الطلب إليك؟</h3><p class="hint">الإضافة السريعة تدخل في نفس الطلب (بند إضافي بسعرها الخاص). عرض «بعد الشراء» يُسجَّل طلباً ثانياً بنفس بيانات الزبون وبلا رسم توصيل ويحمل وسم «🧺 مجموعة»؛ يظهر في معاينة الطلب وفي مركز الاتصال زر <b>دمجهما في طلب واحد</b> فيُشحن طرداً واحداً. الدمج متاح قبل تأكيد الطلبين.</p></div>';
    $("upsell-add-b").onclick = () => { rules.push(newRule("bump")); dirty = true; draw(); };
    $("upsell-add-p").onclick = () => { rules.push(newRule("post")); dirty = true; draw(); };
    $("upsell-save").onclick = save;
    const box = $("upsell-rules");
    box.addEventListener("input", onEdit); box.addEventListener("change", onEdit);
    box.addEventListener("click", e => {
      const b = e.target.closest("[data-act]"); if (!b) return; const i = +b.closest("[data-i]").dataset.i;
      if (b.dataset.act === "del") { if (!confirm("حذف هذه القاعدة؟")) return; rules.splice(i, 1); }
      else if (b.dataset.act === "up" && i > 0) [rules[i - 1], rules[i]] = [rules[i], rules[i - 1]];
      else if (b.dataset.act === "down" && i < rules.length - 1) [rules[i + 1], rules[i]] = [rules[i], rules[i + 1]];
      dirty = true; draw();
    });
    draw();
  }
  function onEdit(e) {
    const el = e.target.closest("[data-k]"); if (!el) return; const i = +el.closest("[data-i]").dataset.i, r = rules[i], k = el.dataset.k; if (!r) return;
    if (k === "on") r.on = el.checked; else if (k === "slugs" || k === "cats") r.trigger[k] = [...el.selectedOptions].map(o => o.value);
    else if (k === "min") r.trigger.min = Math.max(0, Number(el.value) || 0); else if (k === "value") r.value = Math.max(0, Number(el.value) || 0);
    else r[k] = el.value;
    dirty = true; if (e.type === "change") draw(); else { const s = $("upsell-save"); if (s) s.textContent = "💾 حفظ ونشر (تغييرات غير محفوظة)"; }
  }
  function init(hostId) { host = $(hostId || "tab-upsell"); if (!host) return false; load(); return true; }
  return { init, load, stats, ruleStats, mergeable, group, blocked, merge, mergeId, previewRow, ccLine, newRule, _rules: () => rules };
})();
document.addEventListener("DOMContentLoaded", () => { if (typeof Admin === "undefined" || Admin._upsellTabWrapped) return; const original = Admin.tab; Admin.tab = function (t, btn) { const r = original.call(this, t, btn), el = document.getElementById("tab-upsell"); if (el) el.classList.toggle("hidden", t !== "upsell"); if (t === "upsell") AdminUpsell.init("tab-upsell"); return r; }; Admin._upsellTabWrapped = true; });
