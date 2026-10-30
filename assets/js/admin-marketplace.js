/* «التسويق بالعمولة»: شبكة دروبشيبينغ محلية بين متاجر المنصة.
   (1) الكتالوج: منتجات الموردين بسعر المورّد والسعر العام المقترح والعمولة، واستيراد بنقرة إلى متجرك (يبقى مرتبطاً بالمورّد فيتزامن المخزون).
   (2) مستورداتي: سعر البيع (لا يقل عن سعر المورّد + العمولة) والمخزون الحيّ من المورّد.
   (3) كمورّد: أدرج منتجاتك، وتابع الطلبات المطلوب شحنها ببيانات الزبون وحدّث حالتها.
   (4) عمولاتي كأفلييت: معلّقة ← متاحة عند التسليم فقط.
   الأموال تُقيَّد في الخادم وحده (ضمان من رصيد المورّد)؛ يعمل عبر وسيط مدير مسجَّل الدخول. كل نص قادم من الخادم يُهرَّب. */
const AdminMarketplace = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { v: "cat", cat: [], more: null, q: "", seller: "", sort: "new", imps: [], mine: [], ord: [], aff: [], w: null, off: false, err: "", busy: false, timer: null, form: false, sync: 0 };
  const nf = n => Math.round(+n || 0).toLocaleString("fr-DZ");
  const toast = t => { if (typeof Admin !== "undefined" && Admin.toast) Admin.toast(t); else alert(t); };
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const dt = s => { const n = +s; return n ? new Date(n * 1000).toLocaleString("fr-DZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""; };
  const ERR = { own_product: "هذا منتجك أنت", slug_taken: "هذا الرابط مستعمل لديك، جرّب آخر", plan_limit: "بلغت الحد المسموح", bad_state: "الحالة الحالية لا تسمح بهذا الإجراء", module_disabled: "التسويق بالعمولة غير مفعّل لحسابك", rate_limited: "طلبات كثيرة، أعد المحاولة بعد قليل" };
  const PST = { pending: ["بانتظار موافقة الإدارة", "var(--g-amber-rgb)"], active: ["معروض", "var(--g-mint-rgb)"], paused: ["موقوف منك", "var(--g-blue-rgb)"], rejected: ["مرفوض", "var(--g-rose-rgb)"], suspended: ["أوقفته الإدارة", "var(--g-rose-rgb)"] };
  const OST = { pending: ["معلّقة", "var(--g-amber-rgb)"], available: ["متاحة", "var(--g-mint-rgb)"], returned: ["مرتجعة", "var(--g-rose-rgb)"], return_claimed: ["مرتجع بانتظار قرار الإدارة", "var(--g-amber-rgb)"], rejected: ["رُفض (رصيد المورّد)", "var(--g-rose-rgb)"] };
  const SHIP = { new: "لم يُشحن", shipped: "شُحن", delivered: "سُلِّم", returned: "مرتجع" };

  async function call(method, path, body, query) {
    try {
      if (typeof API === "undefined" || !API.sb || !API.sb.token) return { ok: false, off: true };
      const t = await API.sb.token(); if (!t) return { ok: false, st: 401 };
      const r = await fetch(API.sb.url("/functions/v1/platform-proxy"), { method: "POST", headers: API.sb.headers(t), body: JSON.stringify({ method, path, body, query, idempotencyKey: method === "POST" ? uid() : undefined }) });
      if (r.status === 404) return { ok: false, off: true };
      const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) return { ok: false, st: r.status, j };
      return { ok: j.status >= 200 && j.status < 300, st: j.status, j: j.data || {} };
    } catch (e) { return { ok: false, st: 0 }; }
  }
  const errOf = r => (r && r.j && r.j.error && (r.j.error.fields ? Object.values(r.j.error.fields)[0] : (ERR[r.j.error.code] || r.j.error.message))) || (r && r.st === 401 ? "انتهت الجلسة، أعد تسجيل الدخول" : "تعذّر تنفيذ الطلب، حاول لاحقاً");
  const A = () => (typeof Admin !== "undefined" ? Admin : null);
  const abs = p => { try { return new URL(String(p || ""), location.href).href; } catch (e) { return ""; } };
  const slugOf = s => String(s || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || ("p" + Date.now().toString(36));

  /* ───── تحميل ───── */
  async function loadCat(more) {
    const q = { limit: 24, sort: S.sort }; if (S.q) q.q = S.q; if (S.seller) q.seller = S.seller; if (more && S.more) q.offset = S.more;
    const r = await call("GET", "/v1/marketplace/catalog", null, q);
    if (r.off) { S.off = true; return; } S.off = false; if (!r.ok) { S.err = errOf(r); return; } S.err = "";
    S.cat = more ? S.cat.concat(r.j.products || []) : r.j.products || []; S.more = r.j.next_offset || null;
  }
  async function loadAll() {
    const [w, im, mine, so, ao] = await Promise.all([call("GET", "/v1/marketplace/wallet"), call("GET", "/v1/marketplace/imports"), call("GET", "/v1/marketplace/products"), call("GET", "/v1/marketplace/orders", null, { role: "supplier", limit: 50 }), call("GET", "/v1/marketplace/orders", null, { role: "affiliate", limit: 50 })]);
    if (w.off) { S.off = true; return; } S.off = false; if (!w.ok) { S.err = errOf(w); return; } S.err = "";
    S.w = w.j; S.imps = im.ok ? im.j.imports || [] : []; S.mine = mine.ok ? mine.j.products || [] : []; S.ord = so.ok ? so.j.orders || [] : []; S.aff = ao.ok ? ao.j.orders || [] : [];
  }

  /* ───── مزامنة المخزون والسعر والإتاحة مع منتجات المتجر المستوردة ───── */
  async function syncStore(force) {
    const ad = A(); if (!ad || !Array.isArray(ad.products)) return 0; let n = 0;
    for (const i of S.imps) {
      const p = ad.products.find(x => x.slug === i.slug && x.mpId === i.mp_id); if (!p) continue;
      const stock = i.stock == null ? null : +i.stock, act = !!i.sellable;
      const patch = { stock, active: act, mpMin: i.min_price, price: i.price };
      for (const k of Object.keys(patch)) { if (JSON.stringify(p[k]) !== JSON.stringify(patch[k]) && !(k === "stock" && patch.stock === null && p.stock == null)) { p[k] = patch[k]; n++; } }
      if (stock === null) delete p.stock;
    }
    if (n && typeof ad.publishDataJs === "function") { const ok = await ad.publishDataJs(); if (ok) { try { ad.renderProducts && ad.renderProducts(); } catch (e) { } if (force) toast("✅ تمت مزامنة مخزون وأسعار المنتجات المستوردة"); } else return -1; }
    else if (force) toast(n ? "" : "كل شيء متزامن");
    S.sync = Date.now(); return n;
  }

  /* ───── استيراد بنقرة ───── */
  async function doImport(id) {
    const ad = A(), card = S.cat.find(x => x.id === id); if (!ad || !card) return; const inp = $("mk-pr-" + id), price = Math.round(+(inp || {}).value || card.rrp);
    if (price < card.supplier_price + card.commission) { toast(`السعر لا يقل عن ${nf(card.supplier_price + card.commission)} دج (سعر المورّد + عمولته)`); return; }
    S.busy = true; draw(); const slug = slugOf("mp-" + card.slug);
    const r = await call("POST", "/v1/marketplace/imports", { mp_id: id, price, slug }); S.busy = false;
    if (!r.ok) { toast(errOf(r)); draw(); return; }
    const pr = r.j.product || card, imgs = (pr.images && pr.images.length ? pr.images : (pr.image ? [pr.image] : []));
    const had = ad.products.findIndex(x => x.slug === r.j.slug);
    const rec = { slug: r.j.slug, title: pr.title, price: r.j.price, desc: pr.descr || "", cat: Object.keys(ad.categories || {})[0] || "", cover: imgs[0] || pr.image || "", images: imgs, active: pr.stock == null || pr.stock > 0, mpId: id, mpMin: pr.supplier_price + pr.commission, tags: [] };
    if (pr.stock != null) rec.stock = pr.stock;
    const before = ad.products.slice(); if (had >= 0) ad.products[had] = Object.assign({}, ad.products[had], rec); else ad.products.push(rec);
    const ok = typeof ad.publishDataJs === "function" ? await ad.publishDataJs() : false;
    if (!ok) { ad.products = before; toast("تعذّر نشر المنتج في متجرك — لم يُضَف (أعد المحاولة)"); } else { toast("✅ أُضيف المنتج إلى متجرك بسعر " + nf(r.j.price) + " دج وهو مرتبط بالمورّد"); try { ad.renderProducts && ad.renderProducts(); } catch (e) { } }
    await Promise.all([loadCat(false), loadAll()]); draw();
  }

  /* ───── إدراج منتجاتي كمورّد ───── */
  function ownList() { const ad = A(); return ad && Array.isArray(ad.products) ? ad.products.filter(p => p.slug && !p.mpId && !p.digital && !(S.mine || []).some(m => m.slug === p.slug)) : []; }
  async function listOwn() {
    const ad = A(), slug = ($("mk-f-p") || {}).value, p = ad && ad.products.find(x => x.slug === slug); if (!p) { toast("اختر منتجاً"); return; }
    const sp = Math.round(+($("mk-f-sp") || {}).value), cm = Math.round(+($("mk-f-cm") || {}).value), rrp = Math.round(+($("mk-f-rrp") || {}).value) || sp + cm, st = ($("mk-f-st") || {}).value;
    if (!(sp >= 1) || !(cm >= 1)) { toast("اكتب سعرك للأفلييت وعمولته بالدينار"); return; } if (rrp < sp + cm) { toast("السعر العام المقترح لا يقل عن سعرك + العمولة (" + nf(sp + cm) + ")"); return; }
    const imgs = (Array.isArray(p.images) ? p.images : []).concat(p.cover ? [p.cover] : []).map(abs).filter(u => /^https:\/\//.test(u));
    if (!imgs.length) { toast("المنتج يحتاج صورة على رابط https (انشر موقعك أولاً)"); return; }
    S.busy = true; draw(); const r = await call("POST", "/v1/marketplace/products", { slug: p.slug, title: p.title, descr: String(p.desc || "").slice(0, 3900), image: abs(p.cover) || imgs[0], images: [...new Set(imgs)].slice(0, 8), category: (ad.categories || {})[p.cat] || "", supplier_price: sp, commission: cm, rrp, stock: st === "" ? (p.stock == null ? null : +p.stock) : +st }); S.busy = false;
    if (!r.ok) toast(errOf(r)); else { toast(r.j.status === "pending" ? "✅ أُرسل للمراجعة — يظهر في الكتالوج بعد موافقة الإدارة" : "✅ المنتج معروض في الكتالوج"); S.form = false; } await loadAll(); draw();
  }

  /* ───── عرض ───── */
  function css() {
    if ($("mk-css")) return; const s = document.createElement("style"); s.id = "mk-css";
    s.textContent = `#mk-app{display:grid;grid-template-columns:minmax(0,1fr);gap:1rem;max-width:1180px}#mk-app>*{min-width:0}.mk-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:.7rem}.mk-box{padding:1rem;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05)}.mk-box h3{margin:0 0 .6rem;font-size:1.05rem}
.mk-st b{display:block;font-size:1.35rem;margin-top:.15rem}.mk-st small{opacity:.8}.mk-seg{display:flex;gap:.4rem;flex-wrap:wrap}.mk-seg button,.mk-btn{padding:.5rem 1rem;border-radius:12px;font:inherit;font-weight:800;color:#fff;cursor:pointer;border:1px solid rgba(var(--g-mint-d-rgb),.6);background:linear-gradient(180deg,rgba(var(--g-mint-d-rgb),.4),rgba(var(--g-mint-d-rgb),.14));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -3px 6px rgba(0,0,0,.22),0 3px 10px rgba(0,0,0,.25);backdrop-filter:blur(6px);transition:transform .15s}
.mk-seg button:not(.on){opacity:.65;background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.2)}.mk-btn:hover,.mk-seg button:hover{transform:translateY(-2px)}.mk-btn.r{border-color:rgba(var(--g-rose-rgb),.6);background:linear-gradient(180deg,rgba(var(--g-rose-rgb),.45),rgba(var(--g-rose-rgb),.16))}.mk-btn.o{border-color:rgba(var(--g-amber-rgb),.6);background:linear-gradient(180deg,rgba(var(--g-amber-rgb),.45),rgba(var(--g-amber-rgb),.16))}.mk-btn[disabled]{opacity:.5;pointer-events:none}
.mk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(230px,100%),1fr));gap:.8rem}.mk-p{border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);overflow:hidden;display:grid;align-content:start}.mk-p img{width:100%;aspect-ratio:1;object-fit:cover;background:rgba(255,255,255,.05)}.mk-p>div{padding:.7rem;display:grid;gap:.35rem}
.mk-p h4{margin:0;font-size:.95rem}.mk-row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:end}.mk-row label{display:grid;gap:.2rem;font-size:.82rem}.mk-row input,.mk-row select{padding:.5rem .65rem;border-radius:10px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.07);color:inherit;font:inherit;min-width:0;width:100%}
.mk-kv{display:flex;justify-content:space-between;font-size:.83rem;gap:.5rem}.mk-kv b{color:var(--g-mint,#e2fe17)}.mk-chip{display:inline-block;padding:.1rem .6rem;border-radius:99px;font-size:.75rem;border:1px solid rgba(var(--c),.6);background:rgba(var(--c),.18)}.mk-tbl{width:100%;border-collapse:collapse;font-size:.85rem}.mk-tbl th,.mk-tbl td{padding:.45rem .5rem;border-bottom:1px solid rgba(255,255,255,.1);text-align:right;vertical-align:top}.mk-sc{overflow:auto}.mk-hint{font-size:.8rem;opacity:.8;margin:.4rem 0 0}.mk-off{padding:1.2rem;text-align:center;opacity:.85}.mk-warn{padding:.7rem 1rem;border-radius:12px;border:1px solid rgba(var(--g-amber-rgb),.6);background:rgba(var(--g-amber-rgb),.14)}`;
    document.head.appendChild(s);
  }
  const chip = (t, c) => `<span class="mk-chip" style="--c:${c}">${esc(t)}</span>`;
  const phoneLinks = c => { const ph = String((c && c.phone) || "").replace(/[^0-9+]/g, ""); if (!ph) return ""; const intl = ph.replace(/^0/, "213"); return ` <a href="tel:${esc(ph)}">${esc(ph)}</a> · <a href="https://wa.me/${esc(intl.replace(/^\+/, ""))}" target="_blank" rel="noopener">واتساب</a>`; };

  function head() {
    const w = S.w || {}, a = w.affiliate || {}, sp = w.supplier || {};
    return `${sp.rejected_for_funds ? `<div class="mk-warn">⚠️ رُفض <b>${nf(sp.rejected_for_funds)}</b> طلب خلال 7 أيام لأن رصيدك المتاح لا يغطي عمولة الأفلييت. اشحن محفظتك من تبويب «المحفظة» كي لا تفقد المبيعات.</div>` : ""}
<div class="mk-cards"><div class="mk-box mk-st"><small>رصيدك المتاح</small><b>${nf(w.available)} دج</b></div><div class="mk-box mk-st"><small>عمولات محجوزة كمورّد (ضمان)</small><b>${nf(w.supplier_escrow)} دج</b></div>
<div class="mk-box mk-st"><small>عمولاتي المعلّقة كأفلييت</small><b>${nf(a.pending)} دج</b></div><div class="mk-box mk-st"><small>عمولات محرَّرة (في رصيدك)</small><b>${nf(a.available)} دج</b></div>
<div class="mk-box mk-st"><small>طلبات تنتظر شحنك</small><b>${nf(sp.to_ship)}</b></div></div>
<p class="mk-hint" style="margin:0">عند كل طلب على منتج مستورد تُحجز عمولته من رصيد المورّد وتُحرَّر لك عند التسليم فقط، وتعود للمورّد عند الإرجاع. اشحن رصيدك كمورّد من تبويب «المحفظة».</p>`;
  }
  function sellerBadge(sl) {
    if (!sl) return ""; const w = sl.kind === "wholesale", n = (+sl.delivered || 0) + (+sl.returned || 0);
    return ` <span class="mk-chip" style="--c:${w ? "var(--g-amber-rgb)" : "var(--g-blue-rgb)"}">${w ? "🏭 جملة" : "🛍️ تجزئة"}</span>` + (n >= 5 && sl.rate != null ? ` <span class="mk-chip" title="نسبة التسليم من ${nf(n)} طلب">✓ ${nf(sl.rate)}%</span>` : "");
  }
  function cardHtml(p) {
    return `<div class="mk-p">${p.image ? `<img loading="lazy" src="${esc(p.image)}" alt="">` : ""}<div><h4>${esc(p.title)}</h4><small style="opacity:.75">${esc(p.supplier || "")}${sellerBadge(p.seller)}${p.category ? " · " + esc(p.category) : ""}</small>
<div class="mk-kv"><span>سعر المورّد</span><b>${nf(p.supplier_price)} دج</b></div><div class="mk-kv"><span>عمولتك</span><b>${nf(p.commission)} دج</b></div><div class="mk-kv"><span>السعر المقترح</span><span>${nf(p.rrp)} دج</span></div><div class="mk-kv"><span>المخزون</span><span>${p.stock == null ? "غير محدود" : nf(p.stock)}</span></div>
${p.imported ? '<span class="mk-chip" style="--c:var(--g-mint-rgb)">✓ مستورد في متجرك</span>' : `<label class="mk-row" style="display:grid;font-size:.8rem">سعر بيعك (دج)<input id="mk-pr-${p.id}" type="number" min="${p.supplier_price + p.commission}" value="${p.rrp}"></label><button class="mk-btn" data-mk="imp" data-id="${p.id}" ${S.busy ? "disabled" : ""}>استيراد بنقرة</button>`}</div></div>`;
  }
  function rulesHtml() {
    return `<details class="mk-box" style="margin-bottom:.7rem"><summary style="cursor:pointer;font-weight:800">📜 قواعد التعامل بين المورّد والأفلييت</summary><div class="mk-hint" style="line-height:1.9;opacity:1">
<b>الأدوار:</b> المورّد يملك المنتج والمخزون ويؤكّد الطلب بالهاتف ويشحن ويحصّل ثمنه من الزبون عند الاستلام. الأفلييت يعرض المنتج ويجلب الزبائن، ولا يشحن ولا يحصّل المال.<br>
<b>المال:</b> سعر بيعك لا يقل عن سعر المورّد + العمولة. تُحجز العمولة من رصيد المورّد عند الطلب، وتُحرَّر لك عند «سُلِّم» بعد رسم المنصة، وتعود للمورّد عند الإرجاع أو الإلغاء قبل الشحن. رصيد المورّد لا يكفي ← يُرفض الطلب.<br>
<b>مواعيد مقترحة للمورّد:</b> تأكيد الزبون بالهاتف خلال 24 ساعة، والشحن خلال 48 ساعة من التأكيد؛ زبون لا يردّ ← إلغاء قبل الشحن.<br>
<b>التواصل:</b> حالة الطلب والعمولة والمخزون تتحدّث تلقائياً لدى الطرفين. المورّد وحده يتصل بالزبون. الخلاف بين الطرفين يُرفع كطلب دعم من «إعدادات الموقع ← طلبات الدعم» وتحسمه الإدارة.<br>
<b>الأفلييت:</b> لا ادّعاءات طبية أو وعود غير حقيقية، ويسوّق المنتج كما وصفه المورّد.</div></details>`;
  }
  function vCat() { return rulesHtml() + `<div class="mk-box"><div class="mk-row"><label style="flex:1;min-width:180px">بحث<input id="mk-q" value="${esc(S.q)}" placeholder="اسم المنتج"></label><label>الترتيب<select id="mk-sort"><option value="new"${S.sort === "new" ? " selected" : ""}>الأحدث</option><option value="commission"${S.sort === "commission" ? " selected" : ""}>الأعلى عمولة</option><option value="price"${S.sort === "price" ? " selected" : ""}>الأرخص عند المورّد</option></select></label><label>البائع<select id="mk-seller"><option value="">الكل</option><option value="wholesale"${S.seller === "wholesale" ? " selected" : ""}>🏭 جملة</option><option value="retail"${S.seller === "retail" ? " selected" : ""}>🛍️ تجزئة</option></select></label><button class="mk-btn" data-mk="search">بحث</button></div></div>
${S.cat.length ? `<div class="mk-grid">${S.cat.map(cardHtml).join("")}</div>${S.more ? '<p><button class="mk-btn" data-mk="more">عرض المزيد</button></p>' : ""}` : '<div class="mk-box mk-off">لا منتجات في الكتالوج حالياً. عندما يعرض الموردون منتجاتهم تظهر هنا.</div>'}`; }
  function vImp() {
    return `<div class="mk-box"><div class="mk-row"><h3 style="margin:0">منتجاتي المستوردة</h3><button class="mk-btn o" data-mk="sync">⟳ مزامنة المخزون والأسعار مع متجري</button></div><p class="mk-hint">المخزون والإتاحة يتبعان المورّد: ينفد عنده ← يتوقف البيع عندك تلقائياً. تعديل السعر هنا ينعكس على متجرك.</p>
${S.imps.length ? `<div class="mk-sc"><table class="mk-tbl"><thead><tr><th>المنتج</th><th>سعر بيعك</th><th>الحد الأدنى</th><th>عمولتك</th><th>مخزون المورّد</th><th>الحالة</th><th></th></tr></thead><tbody>${S.imps.map(i => `<tr><td>${esc(i.title)}<br><small>${esc(i.slug)}</small></td><td><input id="mk-ip-${i.id}" type="number" value="${i.price}" min="${i.min_price}" style="width:90px"> <button class="mk-btn" data-mk="ipr" data-id="${i.id}">حفظ</button></td><td>${nf(i.min_price)}</td><td>${nf(i.commission)}</td><td>${i.stock == null ? "غير محدود" : nf(i.stock)}</td><td>${i.sellable ? chip("للبيع", "var(--g-mint-rgb)") : chip(i.product_status !== "active" ? "أوقفه المورّد" : i.active ? "نفد المخزون" : "موقوف منك", "var(--g-rose-rgb)")}</td><td><button class="mk-btn ${i.active ? "r" : ""}" data-mk="itog" data-id="${i.id}" data-on="${i.active ? 0 : 1}">${i.active ? "إيقاف" : "استئناف"}</button></td></tr>`).join("")}</tbody></table></div>` : '<p class="mk-hint">لم تستورد منتجاً بعد — ابدأ من «الكتالوج».</p>'}</div>`; }
  function vSup() {
    const own = ownList();
    return `<div class="mk-box"><div class="mk-row"><h3 style="margin:0">منتجاتي المعروضة للأفلييت</h3><button class="mk-btn" data-mk="form">${S.form ? "إغلاق" : "＋ إدراج منتج"}</button></div>
${S.form ? `<div class="mk-row" style="margin-top:.7rem"><label style="flex:1;min-width:200px">المنتج<select id="mk-f-p">${own.map(p => `<option value="${esc(p.slug)}">${esc(p.title)} — ${nf(p.price)} دج</option>`).join("")}</select></label><label>سعرك للأفلييت (دج)<input id="mk-f-sp" type="number" min="1"></label><label>عمولة الأفلييت للقطعة (دج)<input id="mk-f-cm" type="number" min="1"></label><label>السعر العام المقترح (دج)<input id="mk-f-rrp" type="number" min="1"></label><label>المخزون (فارغ = مخزون المنتج)<input id="mk-f-st" type="number" min="0"></label><button class="mk-btn" data-mk="list" ${S.busy || !own.length ? "disabled" : ""}>أدرج في السوق</button></div><p class="mk-hint">تُحجز العمولة من رصيدك عند كل طلب، فاحرص على رصيد كافٍ. المنتج الجديد يمرّ بموافقة الإدارة.</p>` : ""}
${S.mine.length ? `<div class="mk-sc"><table class="mk-tbl"><thead><tr><th>المنتج</th><th>سعرك</th><th>العمولة</th><th>المقترح</th><th>المخزون</th><th>الحالة</th><th>أفلييت/طلبات</th><th></th></tr></thead><tbody>${S.mine.map(p => { const s = PST[p.status] || [p.status, "var(--g-blue-rgb)"]; return `<tr><td>${esc(p.title)}</td><td>${nf(p.supplier_price)}</td><td>${nf(p.commission)}</td><td>${nf(p.rrp)}</td><td><input id="mk-st-${p.id}" type="number" min="0" value="${p.stock == null ? "" : p.stock}" placeholder="∞" style="width:80px"> <button class="mk-btn" data-mk="stk" data-id="${p.id}">حفظ</button></td><td>${chip(s[0], s[1])}${p.note ? `<br><small>${esc(p.note)}</small>` : ""}</td><td>${nf(p.importers)} / ${nf(p.pending_orders)}</td><td>${p.status === "active" ? `<button class="mk-btn r" data-mk="pst" data-id="${p.id}" data-s="paused">إيقاف</button>` : p.status === "paused" ? `<button class="mk-btn" data-mk="pst" data-id="${p.id}" data-s="active">استئناف</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>` : '<p class="mk-hint">لم تُدرج منتجاً بعد.</p>'}</div>`; }
  function vOrd() {
    const rows = S.ord.filter(o => o.state !== "rejected");
    return `<div class="mk-box"><h3>طلبات تشحنها كمورّد</h3><p class="mk-hint">هذه طلبات متاجر الأفلييت لمنتجاتك: اشحنها للزبون وحصّل <b>المبلغ الإجمالي</b> منه عند التسليم (دفع عند الاستلام). تُحجز العمولة من رصيدك لحين التسليم.</p>
${rows.length ? `<div class="mk-sc"><table class="mk-tbl"><thead><tr><th>الطلب</th><th>المنتج</th><th>الزبون</th><th>العنوان</th><th>التحصيل</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map(o => { const c = o.customer || {}, s = OST[o.state] || [o.state, "var(--g-blue-rgb)"], open = o.state === "pending"; return `<tr><td>${esc(o.mko)}<br><small>${dt(o.created_at)}</small></td><td>${esc(o.title)} ×${nf(o.qty)}</td><td>${esc(c.name)}${phoneLinks(c)}</td><td>${esc(c.wilaya)} · ${esc(c.commune)}<br><small>${c.dtype === "stop" ? "مكتب: " + esc(c.desk) : "منزل"}</small></td><td><b>${nf(o.collect)} دج</b><br><small>عمولة ${nf(o.commission)}</small></td><td>${chip(s[0], s[1])}<br><small>${esc(SHIP[o.ship] || o.ship)}</small></td><td>${open ? `${o.ship === "new" ? `<button class="mk-btn" data-mk="ost" data-id="${o.id}" data-s="shipped">شُحن</button> ` : ""}<button class="mk-btn" data-mk="ost" data-id="${o.id}" data-s="delivered">سُلِّم</button> <button class="mk-btn r" data-mk="ost" data-id="${o.id}" data-s="${o.ship === "new" ? "cancelled" : "returned"}">${o.ship === "new" ? "إلغاء" : "مرتجع"}</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>` : '<p class="mk-hint">لا طلبات بعد.</p>'}</div>`; }
  function vAff() {
    return `<div class="mk-box"><h3>عمولاتي كأفلييت</h3><p class="mk-hint">«معلّقة» حتى يُسلَّم الطلب، ثم تصير «متاحة» في رصيدك بعد رسم المنصة؛ وتسقط إن رُجع الطرد.</p>
${S.aff.length ? `<div class="mk-sc"><table class="mk-tbl"><thead><tr><th>الطلب</th><th>المنتج</th><th>الزبون</th><th>عمولتي</th><th>الحالة</th></tr></thead><tbody>${S.aff.map(o => { const s = OST[o.state] || [o.state, "var(--g-blue-rgb)"]; return `<tr><td>${esc(o.ref)}<br><small>${dt(o.created_at)}</small></td><td>${esc(o.title)} ×${nf(o.qty)}</td><td>${esc((o.customer || {}).name)} · ${esc((o.customer || {}).wilaya)}</td><td>${nf(o.state === "available" ? o.net_commission : o.commission)} دج${o.state === "available" && o.fee ? `<br><small>بعد رسم ${nf(o.fee)}</small>` : ""}</td><td>${chip(s[0], s[1])}<br><small>${esc(SHIP[o.ship] || o.ship)}</small></td></tr>`; }).join("")}</tbody></table></div>` : '<p class="mk-hint">لا عمولات بعد.</p>'}</div>`; }

  function draw() {
    const host = $("mk-app"); if (!host) return;
    if (S.off) { host.innerHTML = '<div class="mk-box mk-off">التسويق بالعمولة غير مفعّل بعد على حسابك — تواصل مع الدعم لتفعيله.</div>'; return; }
    if (S.err) { host.innerHTML = `<div class="mk-box mk-off">${esc(S.err)} <button class="mk-btn" data-mk="reload">إعادة المحاولة</button></div>`; return; }
    if (!S.w) { host.innerHTML = '<div class="mk-box mk-off">جارِ التحميل…</div>'; return; }
    const V = [["cat", "الكتالوج"], ["imp", "مستورداتي"], ["aff", "عمولاتي"], ["sup", "منتجاتي كمورّد"], ["ord", "طلبات للشحن" + (S.w.supplier && S.w.supplier.to_ship ? " (" + S.w.supplier.to_ship + ")" : "")]];
    host.innerHTML = head() + `<div class="mk-seg">${V.map(([k, l]) => `<button type="button" class="${S.v === k ? "on" : ""}" data-mk="v" data-v="${k}">${esc(l)}</button>`).join("")}</div>` + ({ cat: vCat, imp: vImp, aff: vAff, sup: vSup, ord: vOrd }[S.v] || vCat)();
  }

  async function onClick(e) {
    const el = e.target.closest("[data-mk]"); if (!el) return; const a = el.dataset.mk, id = +el.dataset.id;
    if (a === "v") { S.v = el.dataset.v; draw(); }
    else if (a === "reload") { S.err = ""; await refresh(); }
    else if (a === "search") { S.q = ($("mk-q") || {}).value || ""; S.sort = ($("mk-sort") || {}).value || "new"; S.seller = ($("mk-seller") || {}).value || ""; await loadCat(false); draw(); }
    else if (a === "more") { await loadCat(true); draw(); }
    else if (a === "imp") await doImport(id);
    else if (a === "sync") { await loadAll(); const n = await syncStore(true); if (n === -1) toast("تعذّر نشر التحديث"); draw(); }
    else if (a === "ipr") { const v = Math.round(+($("mk-ip-" + id) || {}).value); const r = await call("PATCH", "/v1/marketplace/imports/" + id, { price: v }); toast(r.ok ? "✅ حُفظ السعر" : errOf(r)); await loadAll(); await syncStore(); draw(); }
    else if (a === "itog") { const r = await call("PATCH", "/v1/marketplace/imports/" + id, { active: el.dataset.on === "1" }); toast(r.ok ? "تم" : errOf(r)); await loadAll(); await syncStore(); draw(); }
    else if (a === "form") { S.form = !S.form; draw(); }
    else if (a === "list") await listOwn();
    else if (a === "stk") { const v = ($("mk-st-" + id) || {}).value; const r = await call("PATCH", "/v1/marketplace/products/" + id, { stock: v === "" ? null : Math.round(+v) }); toast(r.ok ? "✅ حُدّث المخزون ويصل لمتاجر الأفلييت" : errOf(r)); await loadAll(); draw(); }
    else if (a === "pst") { const r = await call("PATCH", "/v1/marketplace/products/" + id, { status: el.dataset.s }); toast(r.ok ? "تم" : errOf(r)); await loadAll(); draw(); }
    else if (a === "ost") {
      const s = el.dataset.s, msg = { shipped: "تأكيد أنك شحنت الطلب؟", delivered: "تأكيد تسليم الطلب للزبون؟ ستُحرَّر العمولة للأفلييت ولا رجوع.", cancelled: "إلغاء الطلب قبل الشحن؟ تعود العمولة والمخزون لك.", returned: "الطرد رجع إليك؟ تبقى العمولة محجوزة حتى تأكيد الناقل أو قرار الإدارة." }[s];
      if (!confirm(msg)) return; const r = await call("POST", "/v1/marketplace/orders/" + id + "/status", { status: s }); toast(r.ok ? "✅ تم" : errOf(r)); await loadAll(); draw();
    }
  }
  async function refresh() { await Promise.all([loadCat(false), loadAll()]); draw(); if (!S.off && !S.err) syncStore().then(() => { }); }
  function bind() { const root = $("mk-app"); if (!root || root._b) return; root._b = 1; root.addEventListener("click", onClick); root.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "mk-q") { e.preventDefault(); onClick({ target: root.querySelector('[data-mk="search"]') }); } }); }
  async function render() {
    css(); const host = $("market-content"); if (!host) return; if (!$("mk-app")) host.innerHTML = '<div id="mk-app"></div>'; bind(); draw();
    clearInterval(S.timer); S.timer = setInterval(() => { const t = $("tab-market"); if (t && !t.classList.contains("hidden") && !document.hidden && !S.busy && !(document.activeElement && document.activeElement.closest && document.activeElement.closest("#mk-app"))) loadAll().then(() => { draw(); syncStore(); }); }, 60000);
    await refresh();
  }
  /* تنبيهات الرئيسية: طلبات تنتظر الشحن / رُفضت لنقص الرصيد (مرة كل 5 دقائق، للمالك فقط) */
  const AL = { at: 0, to_ship: 0, rej: 0 };
  async function warm() { if (Date.now() - AL.at < 300000) return AL; AL.at = Date.now(); const w = await call("GET", "/v1/marketplace/wallet"); if (w.ok) { AL.to_ship = (w.j.supplier || {}).to_ship || 0; AL.rej = (w.j.supplier || {}).rejected_for_funds || 0; } return AL; }
  function init() {
    const w = () => { if (typeof Admin === "undefined" || !Admin.tab || Admin._mkWrapped) return; const orig = Admin.tab;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-market"); if (el) el.classList.toggle("hidden", t !== "market"); if (t === "market") render(); else clearInterval(S.timer); return r; };
      Admin._mkWrapped = true; };
    w(); setTimeout(w, 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { render, refresh, S, warm, alerts: () => AL, syncStore, _t: { slugOf, abs } };
})();
