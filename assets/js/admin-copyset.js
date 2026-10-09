/* نسخ الإعدادات من منتج إلى المنتجات المحددة + تحديد الكل + مسح المعلومات — لجدولَي «المنتجات» و«المخزون والأرباح».
   السياقات: prod (جدول المنتجات) وfin (جدول المخزون والأرباح). الحفظ دفعة واحدة عبر Admin.publishDataJs (مع تراجع عند الفشل)؛ سعر الشراء في Priv("costs"). */
const AdminCopySet = (() => {
  const $ = id => document.getElementById(id), A = () => typeof Admin !== "undefined" ? Admin : null;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = x => JSON.parse(JSON.stringify(x));
  const isGrp = p => p.type === "grouped", isSimple = p => !p.type || p.type === "simple";
  /* الحقول: copy(src,dst) تُرجع true إن غيّرت منتجاً (cost تُعالج منفصلة)، clear(dst) كذلك */
  const F = {
    price: { l: "السعر", copy: (s, d) => { if (!isSimple(d)) return false; d.price = Number(s.price) || 0; return true; } },
    old: { l: "السعر القديم", copy: (s, d) => { if (!isSimple(d)) return false; d.old = s.old || null; return true; }, clear: d => { if (!isSimple(d)) return false; d.old = null; return true; } },
    cat: { l: "القسم", copy: (s, d) => { d.cat = s.cat; return true; } },
    stock: { l: "المخزون", copy: (s, d) => { if (isGrp(d)) return false; d.stock = s.stock == null ? null : s.stock; return true; },
      clear: d => { if (isGrp(d)) return false; d.stock = null; (d.variations || []).forEach(v => { v.stock = null; }); return true; } },
    cost: { l: "سعر الشراء", cost: true },
    tags: { l: "الوسوم", copy: (s, d) => { d.tags = (s.tags || []).slice(); return true; }, clear: d => { d.tags = []; return true; } },
    freeShip: { l: "الشحن المجاني", copy: (s, d) => { d.freeShip = !!s.freeShip; return true; }, clear: d => { d.freeShip = false; return true; } },
    offers: { l: "العروض", copy: (s, d) => { if (isGrp(d)) return false; d.offers = clone(s.offers || [{ qty: 1, price: d.price }]); return true; }, clear: d => { if (isGrp(d)) return false; d.offers = [{ qty: 1, price: Number(d.price) || 0 }]; return true; } },
    active: { l: "الحالة (نشط/موقوف)", copy: (s, d) => { d.active = s.active !== false; return true; } }
  };
  const CTX = { prod: ["price", "old", "cat", "stock", "cost", "tags", "freeShip", "offers", "active"], fin: ["stock", "cost"] };
  const S = { prod: { sel: new Set(), src: "", fields: new Set(), open: false }, fin: { sel: new Set(), src: "", fields: new Set(), open: false } };
  const prods = () => (A() && A().products) || [];
  const costs = () => (A() && A().fin && A().fin.costs) || {};
  function th(ctx) { return '<th style="width:30px"><input type="checkbox" title="تحديد كل الظاهر" onchange="AdminCopySet.all(\'' + ctx + '\',this.checked)" aria-label="تحديد الكل"></th>'; }
  function cell(ctx, slug) { return '<td style="width:30px"><input type="checkbox" data-cs="' + ctx + '" value="' + esc(slug) + '"' + (S[ctx].sel.has(slug) ? " checked" : "") + ' onchange="AdminCopySet.tog(\'' + ctx + '\',this)" aria-label="تحديد"></td>'; }
  function count(ctx) { const e = $("cs-n-" + ctx); if (e) e.textContent = S[ctx].sel.size; }
  function tog(ctx, el) { el.checked ? S[ctx].sel.add(el.value) : S[ctx].sel.delete(el.value); count(ctx); }
  function all(ctx, on) { document.querySelectorAll('input[data-cs="' + ctx + '"]').forEach(c => { c.checked = on; on ? S[ctx].sel.add(c.value) : S[ctx].sel.delete(c.value); }); document.querySelectorAll('[data-csall="' + ctx + '"]').forEach(c => { c.checked = on; }); count(ctx); }
  function mount(ctx) {
    const host = $("cs-" + ctx); if (!host) return; const st = S[ctx];
    const live = new Set(prods().map(p => p.slug)); st.sel.forEach(s => { if (!live.has(s)) st.sel.delete(s); });
    if (!st.fields.size) CTX[ctx].forEach(k => { if (k === "stock" || k === "cost") st.fields.add(k); });
    host.innerHTML = '<details class="cs-box"' + (st.open ? " open" : "") + ' ontoggle="AdminCopySet.S.' + ctx + '.open=this.open"><summary><b>⚙ نسخ الإعدادات / مسح المعلومات للمنتجات المحددة</b> <small>(<span id="cs-n-' + ctx + '">' + st.sel.size + '</span> محدد)</small></summary>' +
      '<div class="cs-row"><label class="cs-ck"><input type="checkbox" data-csall="' + ctx + '" onchange="AdminCopySet.all(\'' + ctx + '\',this.checked)"> تحديد الكل (الظاهر في الجدول)</label></div>' +
      '<div class="cs-row"><label>انسخ من منتج: <select id="cs-src-' + ctx + '" onchange="AdminCopySet.S.' + ctx + '.src=this.value"><option value="">— اختر المنتج المصدر —</option>' + prods().map(p => '<option value="' + esc(p.slug) + '"' + (st.src === p.slug ? " selected" : "") + '>' + esc(p.title) + '</option>').join("") + '</select></label></div>' +
      '<div class="cs-row cs-f">' + CTX[ctx].map(k => '<label class="cs-ck"><input type="checkbox" value="' + k + '"' + (st.fields.has(k) ? " checked" : "") + ' onchange="this.checked?AdminCopySet.S.' + ctx + '.fields.add(this.value):AdminCopySet.S.' + ctx + '.fields.delete(this.value)"> ' + F[k].l + '</label>').join("") + '</div>' +
      '<div class="cs-row"><button type="button" class="small" onclick="AdminCopySet.run(\'' + ctx + '\',\'copy\')">📋 نسخ الحقول المعلَّمة إلى المحدد</button> <button type="button" class="small warn" onclick="AdminCopySet.run(\'' + ctx + '\',\'clear\')">🧹 مسح الحقول المعلَّمة من المحدد</button></div>' +
      '<div class="hint">النسخ يضع قيمة المنتج المصدر في كل منتج محدد. المسح يفرّغ المخزون (غير متتبَّع) والسعر القديم والوسوم والعروض والشحن المجاني وسعر الشراء؛ السعر والقسم والحالة لا تُمسح.</div></details>';
    count(ctx);
  }
  async function run(ctx, mode) {
    const a = A(), st = S[ctx]; if (!a) return;
    const fields = [...st.fields].filter(k => CTX[ctx].includes(k) && (mode === "copy" ? true : (F[k].clear || F[k].cost)));
    const targets = prods().filter(p => st.sel.has(p.slug));
    if (!targets.length) { toast("حدّد منتجاً واحداً على الأقل في الجدول"); return; }
    if (!fields.length) { toast("علّم حقلاً واحداً على الأقل"); return; }
    let src = null;
    if (mode === "copy") { src = prods().find(p => p.slug === st.src); if (!src) { toast("اختر المنتج المصدر أولاً"); return; } }
    const t2 = targets.filter(p => !src || p.slug !== src.slug); if (!t2.length) { toast("المصدر هو المنتج المحدد الوحيد"); return; }
    const names = fields.map(k => F[k].l).join("، ");
    if (!confirm((mode === "copy" ? "نسخ (" + names + ") من «" + src.title + "» إلى " : "مسح (" + names + ") من ") + t2.length + " منتج؟")) return;
    const snap = new Map(t2.map(p => [p.slug, clone(p)])), changed = new Set(); let skipped = 0, costChanged = false;
    const newCosts = Object.assign({}, costs());
    t2.forEach(d => fields.forEach(k => {
      const f = F[k];
      if (f.cost) { if (mode === "copy") { const v = costs()[src.slug]; if (v == null) delete newCosts[d.slug]; else newCosts[d.slug] = v; } else delete newCosts[d.slug]; costChanged = true; return; }
      const fn = mode === "copy" ? f.copy : f.clear; const ok = fn(mode === "copy" ? src : d, d);
      if (mode === "copy" && ok === undefined) return;
      if (ok) changed.add(d.slug); else skipped++;
    }));
    if (changed.size) {
      const ok = await a.publishDataJs();
      if (!ok) { t2.forEach(p => { const s = snap.get(p.slug), i = a.products.findIndex(x => x.slug === p.slug); if (i >= 0 && s) a.products[i] = s; }); toast("تعذّر النشر — لم يُغيَّر شيء"); a.renderProducts && a.renderProducts(); return; }
      t2.forEach(p => { const b = snap.get(p.slug); if (b && fields.includes("stock") && (b.stock !== p.stock) && a.stockLog) a.stockLog(p, p.stock == null ? 0 : (p.stock - (Number(b.stock) || 0)), p.stock, "", mode === "copy" ? "نسخ إعدادات" : "مسح معلومات"); });
    }
    if (costChanged) { a.fin.costs = newCosts; try { await Priv.set("costs", newCosts); } catch (e) { toast("تعذّر حفظ سعر الشراء: " + (e.message || "")); } }
    a.renderProducts && a.renderProducts(); a.renderFinance && a.renderFinance();
    try { if (typeof AdminInventory !== "undefined") AdminInventory.render(); } catch (e) { }
    toast("✅ " + (mode === "copy" ? "نُسخت" : "مُسحت") + " الحقول لـ" + t2.length + " منتج" + (skipped ? " — تُخطّي " + skipped + " حقل غير مناسب لنوع المنتج" : ""));
  }
  const css = document.createElement("style");
  css.textContent = ".cs-box{margin:.5rem 0;border:1px solid var(--line,rgba(255,255,255,.15));border-radius:14px;padding:.55rem .8rem;background:rgba(255,255,255,.04)}.cs-box summary{cursor:pointer}.cs-row{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin:.5rem 0}.cs-f{gap:.9rem}.cs-ck{display:inline-flex;gap:.3rem;align-items:center;cursor:pointer}.cs-box select{min-height:36px}";
  document.head.appendChild(css);
  return { th, cell, tog, all, mount, run, S };
})();
