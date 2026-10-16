/* البحث الشامل (Ctrl+K أو /): أقسام اللوحة، المنتجات، الطلبات، صفحات الهبوط، إجراءات سريعة، ومقالات «اسألني» — واجهة فقط بلا خلفية خاصة،
   فتعمل بنفس الشكل على GitHub/Supabase ونسخة PHP. المصدر: Admin.products/orders وPBAdmin.list وأزرار القائمة الجانبية وقاعدة admin-help.json. */
const AdminSearch = (() => {
  let box = null, inp = null, list = null, items = [], sel = 0, open = false, help = null, pages = null;
  const $ = id => document.getElementById(id), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = s => String(s || "").toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").trim();
  const A = () => (typeof Admin !== "undefined" ? Admin : {});
  const ACTIONS = [
    ["فتح المخزون", "فتح تبويب إدارة المخزون", () => { const b = document.querySelector('.nav-btn[onclick*="inventory"]'); if (b) b.click(); }, "المخزون الكمية تنبيه نافد منخفض"],
    ["السوشيال والإعلانات", "جدولة منشورات فيسبوك وإنستغرام وإدارة الحملات", () => { const b = document.querySelector('.nav-btn[onclick*="social"]'); if (b) b.click(); }, "فيسبوك انستغرام منشور حملة اعلان ميتا جدولة"],
    ["التوجيه والبوردرو", "توجيه الطلبات لشركات التوصيل بالمنطقة والأداء، إرسال وطباعة البوردرو بنقرة، ومحطة مسح الباركود", () => { const b = document.querySelector('.nav-btn[onclick*="dispatch"]'); if (b) b.click(); }, "توجيه تلقائي auto routing شركة توصيل ياليدين زد ار بوردرو طباعة جماعية باركود مسح سكانر كشف تسليم ليفريزون dispatch"],
    ["الربح الحقيقي", "صافي ما دخل جيبك بعد التوصيل والمرتجعات وكلفة البضاعة وإعلانات Meta وتيك توك", () => { const b = document.querySelector('.nav-btn[onclick*="profit"]'); if (b) b.click(); }, "ربح حقيقي صافي مرتجعات رتور roas cpa إعلانات فيسبوك تيك توك ميتا انفاق مصاريف bénéfice net réel cod rvp codflow"],
    ["خدمات التسويق", "اشترِ حساب TikTok Ads أو Meta Ads جاهزاً بالدينار من محفظتك واستلم رابط دعوة الحساب", () => { const b = document.querySelector('.nav-btn[onclick*="agency"]'); if (b) b.click(); }, "خدمات التسويق حساب اعلاني tiktok meta فيسبوك تيك توك وكالة شراء حساب ads agency compte publicitaire"],
    ["متجر التطبيقات", "ثبّت تطبيقات إضافية من مطوّرين مستقلين بصلاحيات محدودة وتحكّم كامل في الإلغاء", () => { const b = document.querySelector('.nav-btn[onclick*="appstore"]'); if (b) b.click(); }, "متجر التطبيقات تطبيقات اضافات plugins app store مطور تثبيت صلاحيات oauth webhook تكامل marketplace"],
    ["استوديو التطبيقات", "أنشئ تطبيقك وأرسله للمراجعة، دوّر أسراره، وثّق نطاقه وتابع سجلّ التسليمات والإيرادات", () => { const b = document.querySelector('.nav-btn[onclick*="appdev"]'); if (b) b.click(); }, "استوديو التطبيقات بوابة المطور تطبيقات developer portal app oauth client secret webhook تسليمات deliveries ايرادات توثيق نطاق دومين"],
    ["سوق التوريد", "دروبشيبينغ محلي: استورد منتجات موردين بنقرة وبِع بعمولة، أو أدرج منتجاتك ليبيعها غيرك، مع ضمان العمولة من رصيد المورّد", () => { const b = document.querySelector('.nav-btn[onclick*="\'market\'"]'); if (b) b.click(); }, "سوق التوريد دروبشيبينغ dropshipping افيليت affiliate مورد عمولة استيراد منتج كتالوج مشترك marketplace revendeur"],
    ["المنتجات الرقمية", "مفاتيح وحسابات واشتراكات وملفات تُسلَّم تلقائياً بعد الدفع، مع موافقة تحويلات BaridiMob وCCP", () => { const b = document.querySelector('.nav-btn[onclick*="\'digital\'"]'); if (b) b.click(); }, "منتجات رقمية digital مفتاح ترخيص license iptv اشتراك حساب ألعاب كورس تكوين ملف pdf تنزيل baridimob بريدي موب ccp اثبات دفع موافقة تسليم تلقائي"],
    ["ستوديو ديزاين", "كل أدوات الصور والتصميم في مكان واحد، لكل أداة صفحتها: ما تفعله وخطوات استعمالها وفتحها في المحرّر", () => { const b = document.querySelector('.nav-btn[onclick*="studio"]'); if (b) b.click(); }, "ستوديو ديزاين تصميم ادوات صور studio design outils images كل الادوات"],
    ["المحفظة", "رصيدك على المنصة: الضمان وسحب الأرباح وشراء رصيد إعلانات بالدولار ودفتر الحركات", () => { const b = document.querySelector('.nav-btn[onclick*="wallet"]'); if (b) b.click(); }, "محفظة رصيد سحب ضمان escrow دولار اعلانات ايداع wallet portefeuille retrait"],
    ["مركز المتاجر", "طلبات متاجر Shopify وWooCommerce وجداول Google في لوحة واحدة", () => { const b = document.querySelector('.nav-btn[onclick*="sources"]'); if (b) b.click(); }, "متاجر متعددة هب مركزي shopify woocommerce شوبيفاي ووكومرس جدول قوقل شيت ربط متجر استيراد طلبات codflow"],
    ["شبكة الخبراء", "البحث عن مستقلين جزائريين (تصميم، إعلانات، تأكيد، توصيل، UGC) والتواصل بواتساب", () => { const b = document.querySelector('.nav-btn[onclick*="experts"]'); if (b) b.click(); }, "خبير مستقل freelance مصمم media buyer مؤكدة موزع ugc تغليف براندينغ توظيف"],
    ["منتج جديد", "إضافة منتج جديد للمتجر", () => A().editProduct && A().editProduct(null), "اضافة منتج جديد"],
    ["نسخة احتياطية", "تنزيل ملف بكل طلباتك ومنتجاتك وتكاليفك", () => A().backupNow && A().backupNow(), "نسخة احتياطية تصدير حفظ البيانات backup"],
    ["مظهر اللوحة", "التبديل بين المظهر الداكن والفاتح", () => typeof AdminTheme !== "undefined" && AdminTheme.toggle(), "الوضع الداكن المظهر ثيم"],
    ["تحديث اللوحة", "جلب آخر نسخة منشورة", () => typeof AdminUpdate !== "undefined" && AdminUpdate.apply(), "تحديث نسخة"],
    ["فتح العملاء", "عرض شرائح العملاء وسجلّ طلباتهم", () => { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'customers'")); if (b) b.click(); }, "عملاء زبائن"],
    ["فتح التقارير", "عرض التقارير المتقدمة حسب الفترة", () => { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'reports'")); if (b) b.click(); }, "تقارير مبيعات فئة ولاية حملة قمع"],
    ["فتح المرتجعات", "تسجيل ومتابعة مرتجعات الطلبات المسلَّمة", () => { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'returns'")); if (b) b.click(); }, "مرتجعات استبدال استرداد إعادة المخزون"],
    ["فتح المدفوعات", "حالة الدفع اليدوية والمبالغ المعلّقة", () => { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'payments'")); if (b) b.click(); }, "مدفوعات دفع تحصيل مدفوع مسترد معلق"],
    ["فتح المدوّنة والسياسات", "مقالات المدوّنة وصفحات الخصوصية والاسترجاع والشحن والشروط", () => { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'blog'")); if (b) b.click(); }, "مدونة مقال مقالات سياسة الخصوصية الاسترجاع الشحن الشروط blog policy"],
    ["فتح العروض الإضافية", "Order Bump وعرض بعد الشراء لرفع متوسط الطلب", () => { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'upsell'")); if (b) b.click(); }, "order bump upsell عرض إضافي بعد الشراء"],
    ["فتح تجهيز الطلبات", "قائمة الجمع ووصل التجهيز لأمين المخزن", () => { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'pack'")); if (b) b.click(); }, "تجهيز المخزن magasinier جُهِّز"],
    ["فتح SEO", "عناوين وأوصاف المنتجات وبيانات المشاركة", () => { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'seo'")); if (b) b.click(); }, "seo محركات البحث وصف عنوان noindex sitemap"],
  ];
  function build() {
    if (box) return;
    box = document.createElement("div"); box.id = "as-box";
    box.innerHTML = '<div class="as-win" role="dialog" aria-label="بحث شامل"><input id="as-in" type="search" autocomplete="off" placeholder="ابحث عن قسم أو منتج أو طلب أو صفحة أو إعداد…"><div id="as-list" role="listbox"></div><div class="as-ft"><span>↑ ↓ للتنقل</span><span>Enter للفتح</span><span>Esc للإغلاق</span></div></div>';
    document.body.appendChild(box);
    inp = $("as-in"); list = $("as-list");
    box.addEventListener("mousedown", e => { if (e.target === box) close(); });
    inp.addEventListener("input", draw);
    inp.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); } else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") { e.preventDefault(); run(sel); } else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    list.addEventListener("click", e => { const r = e.target.closest("[data-i]"); if (r) run(+r.dataset.i); });
    list.addEventListener("mousemove", e => { const r = e.target.closest("[data-i]"); if (r && +r.dataset.i !== sel) { sel = +r.dataset.i; paintSel(); } });
  }
  function tabs() {
    return [...document.querySelectorAll(".nav-btn")].map(b => {
      const full = (b.textContent || "").replace(/\s+/g, " ").trim(); if (!full || b.classList.contains("nav-work")) return null;
      /* العنوان من <b> وحده (النصوص المتجاورة بلا فاصل كانت تلتصق: «العملاءشرائح العملاء…»)؛ والشرح يدخل في المطابقة فقط */
      const bb = b.querySelector(".nav-txt b, b"), t = bb ? [...bb.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").replace(/\s+/g, " ").trim() || full : full, sm = b.querySelector("small"), n = norm(t + " " + (sm ? sm.textContent : ""));
      if (b.dataset.app === "ask" || t === "اسألني") return null;      // «اسألني» ليست قسماً: لا تظهر في نتائج البحث (v1.89.121)
      return { k: "قسم", t, s: "فتح القسم", n, go: () => { try { b.click(); } catch (e) { } } };
    }).filter(Boolean);
  }
  async function loadExtra() {
    if (help === null) { help = []; try { const r = await fetch("assets/data/admin-help.json", { cache: "no-cache" }); if (r.ok) help = await r.json(); } catch (e) { } }
    if (!help._ctl) { try { const ce = typeof CtlHelp !== "undefined" && CtlHelp.entries ? CtlHelp.entries() : []; if (ce.length) { const have = new Set(help.map(h => h.id)); help = help.concat(ce.filter(c => !have.has(c.id))); } if (ce.length) help._ctl = 1; } catch (e) { } }
    if (pages === null) { pages = []; try { const r = await fetch("assets/pages/index.json", { cache: "no-cache" }); if (r.ok) pages = await r.json(); } catch (e) { } }
  }
  function all() {
    const out = [], a = A();
    tabs().forEach(x => out.push(x));
    ACTIONS.forEach(x => out.push({ k: "إجراء", t: x[0], s: x[1], n: norm(x[0] + " " + x[3]), go: x[2] }));
    (a.products || []).forEach(p => out.push({ k: "منتج", t: p.title, s: (p.price != null ? p.price + " دج" : "") + (p.cat ? " · " + p.cat : "") + " · تعديل المنتج", n: norm(p.title + " " + p.slug + " " + (p.cat || "")), go: () => a.editProduct && a.editProduct(p.slug) }));
    (a.orders || []).slice(0, 600).forEach(o => out.push({ k: "طلب", t: (o.name || "—") + " — " + (o.phone || ""), s: (o.status || "") + " · " + (o.wilaya || "") + (o.total ? " · " + o.total + " دج" : ""), n: norm((o.name || "") + " " + (o.phone || "") + " " + (o.id || "")), go: () => openOrder(o) }));
    (pages || []).forEach(p => out.push({ k: "صفحة", t: p.title || p.slug, s: "/lp/" + p.slug + "/ · تعديل في المطوّر", n: norm((p.title || "") + " " + p.slug), go: () => typeof PBAdmin !== "undefined" && PBAdmin.edit(p.slug) }));
    (help || []).forEach(h => out.push({ k: "شرح", t: h.t, s: String(h.a || "").replace(/[*_`#>]|\n+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80), n: norm(h.t + " " + (h.k || "")), go: () => { try { if (h.go && a.tab) a.tab(h.go); else AdminHelp.ask(h.t); } catch (e) { } } }));
    return out;
  }
  function openOrder(o) {
    const a = A(); try { a.tab("orders", [...document.querySelectorAll(".nav-btn")].find(b => (b.getAttribute("onclick") || "").includes("'orders'"))); } catch (e) { }
    const q = $("order-filter-q"); if (q) { q.value = o.phone || o.id || ""; try { a.applyOrderFilters(); } catch (e) { } }
  }
  function score(it, words) {
    let s = 0; for (const w of words) { const i = it.n.indexOf(w); if (i < 0) return -1; s += i === 0 ? 5 : (it.n[i - 1] === " " ? 3 : 1); }
    return s + (it.k === "قسم" ? 3 : it.k === "إجراء" ? 2 : 0);
  }
  function results(text) {
    const words = norm(text).split(/\s+/).filter(Boolean), src = all();
    const res = !words.length ? src.filter(x => x.k === "قسم" || x.k === "إجراء") : src.map(x => ({ x, s: score(x, words) })).filter(r => r.s >= 0).sort((a, b) => b.s - a.s).map(r => r.x);
    return res.slice(0, 40);
  }
  const rowsHtml = its => its.length ? its.map((x, i) => '<div class="as-it" role="option" data-i="' + i + '"><span class="as-k">' + esc(x.k) + '</span><span class="as-t">' + esc(x.t) + '</span><span class="as-s">' + esc(x.s) + '</span></div>').join("") : '<div class="as-no">لا نتائج — جرّب كلمة أخرى.</div>';
  function draw() { items = results(inp.value); sel = 0; list.innerHTML = rowsHtml(items); paintSel(); }
  /* بحث مباشر في خانة القائمة الجانبية: قائمة نتائج تحت الخانة بلا نافذة (حسب الكلمات المفتاحية) */
  let nq = null, nres = null, nitems = [], nsel = 0;
  const npaint = () => { [...nres.querySelectorAll(".as-it")].forEach((r, i) => { r.classList.toggle("on", i === nsel); if (i === nsel) r.scrollIntoView({ block: "nearest" }); }); };
  function nclose() { if (nres) nres.classList.remove("on"); }
  function ndraw() {
    if (!nq.value.trim()) { nclose(); return; }
    nitems = results(nq.value).filter(x => x.k === "قسم"); nsel = 0; nres.innerHTML = rowsHtml(nitems); nres.classList.add("on"); npaint();
  }
  function nrun(i) { const it = nitems[i]; if (!it) return; nq.value = ""; nclose(); try { it.go(); } catch (e) { console.warn("AdminSearch", e); } }
  function attach() {
    nq = $("nav-q"); if (!nq || nres) return;
    const lab = nq.closest(".nav-q"); nres = document.createElement("div"); nres.id = "nav-res"; nres.setAttribute("role", "listbox"); lab.parentNode.insertBefore(nres, lab.nextSibling);
    const go = () => { loadExtra().then(() => { if (nq.value.trim()) ndraw(); }); ndraw(); };
    nq.addEventListener("input", go); nq.addEventListener("focus", go);
    nq.addEventListener("keydown", e => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (nitems.length) { nsel = (nsel + (e.key === "ArrowDown" ? 1 : -1) + nitems.length) % nitems.length; npaint(); } }
      else if (e.key === "Enter") { e.preventDefault(); nrun(nsel); } else if (e.key === "Escape") { e.preventDefault(); nq.value = ""; nclose(); }
    });
    nres.addEventListener("mousedown", e => { const r = e.target.closest("[data-i]"); if (r) { e.preventDefault(); nrun(+r.dataset.i); } });
    nres.addEventListener("mousemove", e => { const r = e.target.closest("[data-i]"); if (r && +r.dataset.i !== nsel) { nsel = +r.dataset.i; npaint(); } });
    document.addEventListener("mousedown", e => { if (!lab.contains(e.target) && !nres.contains(e.target)) nclose(); });
  }
  const paintSel = () => { [...list.querySelectorAll(".as-it")].forEach((r, i) => { r.classList.toggle("on", i === sel); if (i === sel) r.scrollIntoView({ block: "nearest" }); }); };
  const move = d => { if (!items.length) return; sel = (sel + d + items.length) % items.length; paintSel(); };
  function run(i) { const it = items[i]; if (!it) return; close(); try { it.go(); } catch (e) { console.warn("AdminSearch", e); } }
  async function show(q) { build(); open = true; box.classList.add("on"); inp.value = typeof q === "string" ? q : ""; draw(); setTimeout(() => inp.focus(), 30); await loadExtra(); if (open) draw(); }
  function close() { if (!box) return; open = false; box.classList.remove("on"); }
  function init() {
    attach();
    document.addEventListener("keydown", e => {
      const k = e.key.toLowerCase(), t = e.target, typing = t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && k === "k") { e.preventDefault(); open ? close() : show(); }
      else if (k === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !open) { e.preventDefault(); show(); }
      else if (k === "escape" && open) close();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { show, close, attach };
})();
