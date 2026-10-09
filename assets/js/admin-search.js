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
    ["منتج جديد", "إضافة منتج جديد للمتجر", () => A().editProduct && A().editProduct(null), "اضافة منتج جديد"],
    ["مظهر اللوحة", "التبديل بين الزجاج الداكن والكلاسيكي", () => typeof AdminTheme !== "undefined" && AdminTheme.toggle(), "الوضع الداكن المظهر ثيم"],
    ["اسألني", "مساعد اللوحة: اسأل عن أي أداة أو إعداد", () => typeof AdminHelp !== "undefined" && AdminHelp.show(), "مساعدة شرح"],
    ["تحديث اللوحة", "جلب آخر نسخة منشورة", () => typeof AdminUpdate !== "undefined" && AdminUpdate.apply(), "تحديث نسخة"],
    ["فتح العملاء", "عرض شرائح العملاء وسجلّ طلباتهم", () => { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'customers'")); if (b) b.click(); }, "عملاء زبائن"],
    ["فتح التقارير", "عرض التقارير المتقدمة حسب الفترة", () => { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'reports'")); if (b) b.click(); }, "تقارير مبيعات فئة ولاية حملة قمع"],
    ["فتح المرتجعات", "تسجيل ومتابعة مرتجعات الطلبات المسلَّمة", () => { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'returns'")); if (b) b.click(); }, "مرتجعات استبدال استرداد إعادة المخزون"],
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
      const t = (b.textContent || "").replace(/\s+/g, " ").trim(); if (!t || b.classList.contains("nav-work")) return null;
      return { k: "قسم", t, s: "فتح القسم", n: norm(t), go: () => { try { b.click(); } catch (e) { } } };
    }).filter(Boolean);
  }
  async function loadExtra() {
    if (help === null) { help = []; try { const r = await fetch("assets/data/admin-help.json", { cache: "no-cache" }); if (r.ok) help = await r.json(); } catch (e) { } }
    if (pages === null) { pages = []; try { const r = await fetch("assets/pages/index.json", { cache: "no-cache" }); if (r.ok) pages = await r.json(); } catch (e) { } }
  }
  function all() {
    const out = [], a = A();
    tabs().forEach(x => out.push(x));
    ACTIONS.forEach(x => out.push({ k: "إجراء", t: x[0], s: x[1], n: norm(x[0] + " " + x[3]), go: x[2] }));
    (a.products || []).forEach(p => out.push({ k: "منتج", t: p.title, s: (p.price != null ? p.price + " دج" : "") + (p.cat ? " · " + p.cat : "") + " · تعديل المنتج", n: norm(p.title + " " + p.slug + " " + (p.cat || "")), go: () => a.editProduct && a.editProduct(p.slug) }));
    (a.orders || []).slice(0, 600).forEach(o => out.push({ k: "طلب", t: (o.name || "—") + " — " + (o.phone || ""), s: (o.status || "") + " · " + (o.wilaya || "") + (o.total ? " · " + o.total + " دج" : ""), n: norm((o.name || "") + " " + (o.phone || "") + " " + (o.id || "")), go: () => openOrder(o) }));
    (pages || []).forEach(p => out.push({ k: "صفحة", t: p.title || p.slug, s: "/lp/" + p.slug + "/ · تعديل في المطوّر", n: norm((p.title || "") + " " + p.slug), go: () => typeof PBAdmin !== "undefined" && PBAdmin.edit(p.slug) }));
    (help || []).forEach(h => out.push({ k: "مساعدة", t: h.t, s: "اسألني", n: norm(h.t + " " + (h.k || "")), go: () => { try { AdminHelp.ask(h.t); } catch (e) { } } }));
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
  function draw() {
    const q = norm(inp.value), words = q.split(/\s+/).filter(Boolean), src = all();
    let res = !words.length ? src.filter(x => x.k === "قسم" || x.k === "إجراء") : src.map(x => ({ x, s: score(x, words) })).filter(r => r.s >= 0).sort((a, b) => b.s - a.s).map(r => r.x);
    items = res.slice(0, 40); sel = 0;
    list.innerHTML = items.length ? items.map((x, i) => '<div class="as-it" role="option" data-i="' + i + '"><span class="as-k">' + esc(x.k) + '</span><span class="as-t">' + esc(x.t) + '</span><span class="as-s">' + esc(x.s) + '</span></div>').join("") : '<div class="as-no">لا نتائج — جرّب كلمة أخرى، أو اسأل «اسألني».</div>';
    paintSel();
  }
  const paintSel = () => { [...list.querySelectorAll(".as-it")].forEach((r, i) => { r.classList.toggle("on", i === sel); if (i === sel) r.scrollIntoView({ block: "nearest" }); }); };
  const move = d => { if (!items.length) return; sel = (sel + d + items.length) % items.length; paintSel(); };
  function run(i) { const it = items[i]; if (!it) return; close(); try { it.go(); } catch (e) { console.warn("AdminSearch", e); } }
  async function show() { build(); open = true; box.classList.add("on"); inp.value = ""; draw(); setTimeout(() => inp.focus(), 30); await loadExtra(); if (open) draw(); }
  function close() { if (!box) return; open = false; box.classList.remove("on"); }
  function init() {
    document.addEventListener("keydown", e => {
      const k = e.key.toLowerCase(), t = e.target, typing = t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && k === "k") { e.preventDefault(); open ? close() : show(); }
      else if (k === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !open) { e.preventDefault(); show(); }
      else if (k === "escape" && open) close();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { show, close };
})();
