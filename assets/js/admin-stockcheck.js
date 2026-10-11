/* ربط المخزون بالطلبات الجديدة (v1.89.78): يحسب ما تحتاجه الطلبات «في انتظار التأكيد» من كل منتج/تنويع (بعدد العلب في كل طلب: علبتان، ثلاث…)
   ويوزّع المخزون المتاح عليها بالأسبقية (الأقدم أولاً)؛ الطلب الذي لا يكفيه المتاح يُعدّ «خارج المخزون».
   - شارة «خارج المخزون» في صف الطلب، وإشعار بعدد الطلبات التي تفوق المخزون (أعلى اللوحة + «يحتاج انتباهك» + تبويب المخزون).
   - عند محاولة الاتصال بزبون طلبه خارج المخزون (زر «اتصل» أو تسجيل نتيجة اتصال) تظهر نافذة «المخزون لا يكفي لهذا الطلب» بخيارين: إلغاء الاتصال / إجراء الاتصال؛
     وعند تأكيد طلب يفوق المخزون الحالي: إلغاء / تأكيد رغم ذلك.
   الدوال plan/direct نقية (تأخذ الطلبات ودالة الأسطر) فتُختبر في scripts/test-stock.js. المخزون المقروء هو الحالي بعد خصم الطلبات المؤكَّدة أصلاً. */
window.StockCheck = (function () {
  const A = () => (typeof Admin !== "undefined" ? Admin : null);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const track = l => (l.v && l.v.stock != null) ? l.v : (l.p && l.p.stock != null ? l.p : null);       // ما يُخصم منه المخزون (التنويع ثم المنتج)
  const keyOf = l => { const t = track(l); return t ? (t === l.v ? "v:" + l.p.slug + ":" + l.v.id : "p:" + l.p.slug) : null; };
  const nameOf = l => l.p.title + (l.v ? " — " + (Object.values(l.v.attrs || {}).join(" / ") || l.v.id) : "");
  const need = (o, linesOf) => { const m = {}; (linesOf(o) || []).forEach(l => { const k = keyOf(l); if (!k) return; (m[k] = m[k] || { l, n: 0 }).n += Number(l.qty) || 0; }); return m; };
  const isPending = (o, since) => o && o.status === "nouvelle" && !/📦/.test(o.note || "") && !(since && new Date(o.date) < new Date(since));

  /* توزيع المخزون على الطلبات المعلّقة بالأقدمية. يعيد { byOrder:{id:{short:[{title,need,have,stock}]}}, byKey:{k:{title,stock,demand}}, pending } */
  function plan(orders, linesOf, since) {
    const pend = (orders || []).filter(o => isPending(o, since)).sort((a, b) => new Date(a.date) - new Date(b.date) || String(a.id).localeCompare(String(b.id)));
    const rem = {}, byOrder = {}, byKey = {};
    pend.forEach(o => {
      const nd = need(o, linesOf);
      Object.entries(nd).forEach(([k, x]) => { const t = track(x.l); if (!(k in rem)) { rem[k] = Number(t.stock) || 0; byKey[k] = { title: nameOf(x.l), stock: rem[k], demand: 0, slug: x.l.p.slug }; } byKey[k].demand += x.n; });
      const short = Object.entries(nd).filter(([k, x]) => rem[k] < x.n).map(([k, x]) => ({ title: nameOf(x.l), need: x.n, have: rem[k], stock: byKey[k].stock }));
      if (short.length) byOrder[o.id] = { short }; else Object.entries(nd).forEach(([k, x]) => { rem[k] -= x.n; });
    });
    return { byOrder, byKey, pending: pend.length };
  }
  /* فحص مباشر لطلب واحد مقابل المخزون الحالي (للتأكيد) */
  function direct(o, linesOf) {
    const short = Object.values(need(o, linesOf)).filter(x => (Number(track(x.l).stock) || 0) < x.n).map(x => ({ title: nameOf(x.l), need: x.n, have: Number(track(x.l).stock) || 0, stock: Number(track(x.l).stock) || 0 }));
    return short.length ? short : null;
  }
  const since = () => { const a = A(); return a && a.fin && a.fin.cfg && a.fin.cfg.since; };
  const linesOf = o => { const a = A(); try { return a && a.orderLines ? a.orderLines(o) : []; } catch (e) { return []; } };
  const live = () => { const a = A(); return plan((a && a.orders) || [], linesOf, since()); };
  /* طلبات تفوق المخزون الآن + المنتجات التي مجموع طلباتها المعلّقة أكبر من مخزونها */
  function summary(p) {
    p = p || live(); const prods = Object.values(p.byKey).filter(x => x.demand > x.stock).sort((a, b) => (b.demand - b.stock) - (a.demand - a.stock));
    return { orders: Object.keys(p.byOrder).length, products: prods };
  }
  const shortOf = o => { const r = live().byOrder[o && o.id]; return r ? r.short : null; };
  const directOf = o => (o && o.status === "nouvelle") ? direct(o, linesOf) : null;
  const badge = (o, p) => { const r = p && p.byOrder[o.id]; return r ? ' <span class="pill st-annulee sc-pill" title="' + esc(r.short.map(s => s.title + ": المطلوب " + s.need + " والمتاح " + s.have).join(" | ")) + '">⚠ خارج المخزون</span>' : ""; };

  /* ── النافذة ── */
  function ask(o, kind, go, short) {
    short = short || shortOf(o) || directOf(o); if (!short) { go(); return; }
    let bg = document.getElementById("sc-bg"); if (bg) bg.remove();
    bg = document.createElement("div"); bg.id = "sc-bg"; bg.dir = "rtl";
    bg.style.cssText = "position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px";
    const btn = col => `font:inherit;font-weight:800;cursor:pointer;color:#fff;border-radius:14px;padding:.65rem 1.1rem;border:1px solid rgba(${col},.6);background:rgba(${col},.22);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -6px 10px rgba(0,0,0,.2),0 6px 16px rgba(0,0,0,.25);backdrop-filter:blur(8px);transition:transform .15s,background .15s`;
    const conf = kind === "confirm", who = esc((o && o.name) || "الزبون");
    bg.innerHTML = `<div style="background:rgba(9,24,18,.985);color:#fff;border:1px solid rgba(251,146,60,.55);border-radius:20px;max-width:460px;width:100%;padding:1.3rem;box-shadow:0 24px 70px rgba(0,0,0,.6);font-family:inherit">
<h3 style="margin:0 0 .5rem;color:#fdba74">المخزون لا يكفي لهذا الطلب</h3>
<p style="margin:.2rem 0 .6rem;line-height:1.9;font-size:.9rem">طلب <b>${who}</b> يحتاج كمية أكبر من المتاح:</p>
<div style="background:rgba(255,255,255,.07);border-radius:12px;padding:.5rem .8rem;margin-bottom:.7rem;font-size:.88rem;line-height:2">${short.map(s => `<div><b>${esc(s.title)}</b> — المطلوب <b style="color:#fdba74">${s.need}</b> · المتاح <b style="color:${s.have > 0 ? "#fde047" : "#fda4af"}">${s.have}</b>${s.stock > s.have ? ` <small style="opacity:.75">(بقية المخزون محجوزة لطلبات أقدم)</small>` : ""}</div>`).join("")}</div>
<p style="margin:0 0 .9rem;line-height:1.8;font-size:.85rem;opacity:.9">${conf ? "تأكيد هذا الطلب سينزل المخزون إلى الصفر ولن تكفي الكمية للتوصيل." : "هل تريد الاتصال بالزبون رغم ذلك؟"}</p>
<div style="display:flex;gap:.5rem;flex-wrap:wrap"><button type="button" id="sc-no" style="${btn("251,146,60")}">${conf ? "إلغاء" : "إلغاء الاتصال"}</button><button type="button" id="sc-go" style="${btn("74,222,128")}">${conf ? "تأكيد رغم ذلك" : "إجراء الاتصال"}</button></div></div>`;
    document.body.appendChild(bg);
    bg.querySelector("#sc-no").onclick = () => bg.remove();
    bg.querySelector("#sc-go").onclick = () => { bg.remove(); go(); };
    bg.addEventListener("click", e => { if (e.target === bg) bg.remove(); });
  }
  /* زر «اتصل» في معاينة الطلب (وأي رابط اتصال مرتبط بطلب): يعترضه التحذير قبل فتح الاتصال */
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest("a.call-lnk"); if (!a) return;
    const bg = a.closest("#ord-prev-bg"), id = bg && bg.dataset.oid, ad = A(); if (!id || !ad) return;
    const o = (ad.orders || []).find(x => String(x.id) === String(id)), sh = o && shortOf(o); if (!sh) return;
    e.preventDefault(); e.stopPropagation(); ask(o, "call", () => { location.href = a.getAttribute("href"); }, sh);
  }, true);

  /* إشعار عدد الطلبات التي تفوق المخزون (يُستدعى من تحديث التنبيهات كل دقيقة؛ لا يتكرر إلا عند الزيادة) */
  let lastN = -1;
  function notify() {
    const s = summary();
    if (lastN >= 0 && s.orders > lastN && typeof toast === "function") toast("⚠️ " + s.orders + " طلب يفوق المخزون المتاح — راجع المخزون قبل الاتصال");
    lastN = s.orders; return s;
  }
  return { plan, direct, summary, shortOf, directOf, badge, ask, notify, live, _keyOf: keyOf };
})();
