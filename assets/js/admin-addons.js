/* «الإضافات» (مجموعة الإضافات): ثلاثة أقسام — «الإضافات المنصَّبة» (المثبَّتة في موقعك: مفعّلة ومعطّلة)، «متجر الإضافات» (إضافات المنصّة وأدوات ستوديو ديزاين وإضافات المطوّرين
   بالإصدار ونبذة قصيرة والتثبيت والتفعيل وبحث سريع بالاسم)، و«تطوير الإضافات» (بوابة المطوّر: admin-appdev.js).
   الحالة: AdminNav (assets/data/apps.json: off = معطَّلة، rm = غير مثبَّتة). أدوات ستوديو ديزاين بمعرّف «sd:<أداة>» وتُخفى من الستوديو عند تعطيلها أو إلغاء تثبيتها؛ وإضافات المطوّرين من المتجر المستقل (admin-appstore.js).
   لا شيء خاص بمتجر: القائمة تُبنى من سجلّ AdminNav.apps() وكتالوج الأدوات tools-catalog.json. */
const AdminAddons = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { iq: "", inf: "all", sq: "", sf: "all", tools: null, busy: false };
  const NAV = () => (typeof AdminNav !== "undefined" ? AdminNav : null);
  const toast = t => { try { if (typeof Admin !== "undefined" && Admin.toast) return Admin.toast(t); } catch (e) { } try { window.toast && window.toast(t); } catch (e) { } };
  const fold = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[ً-ٰٟ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim();
  const ver = () => { const u = typeof AdminUpdate !== "undefined" && AdminUpdate.current; if (u) return String(u); const h = document.querySelector(".top h1"); const m = h && /(\d+\.\d+\.\d+)/.exec(h.title || ""); return m ? m[1] : "1.0"; };
  const first = d => String(d || "").replace(/\s+/g, " ").trim();      /* النص كاملاً (يقصّه CSS بثلاثة أسطر ويظهر كاملاً في التلميح) فيبقى مطابقاً لترجمته الفرنسية */
  const OPEN = { builder: () => go("builder"), smart: () => go("pbgen"), imggen: () => go("imggen"), checkout: () => go("checkout"), speed: () => go("speed"), agent: () => go("agent"), voice: () => go("agent"), ask: () => { try { AdminHelp.show(); } catch (e) { } }, cloner: () => { try { NAV().clone(); } catch (e) { } }, protect: () => NAV().app("protect"), floaters: () => NAV().app("floaters") };
  function go(tab) { try { const b = [...document.querySelectorAll(".side-nav .nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'" + tab + "'")); Admin.tab(tab, b); } catch (e) { } }

  /* ── الكتالوج: إضافات المنصّة + أدوات ستوديو ديزاين ── */
  function core() {
    const N = NAV(); if (!N || !N.apps) return [];
    return Object.entries(N.apps()).map(([id, A]) => ({ id, n: A.n, d: first(A.d), v: ver(), cat: "core", free: true, open: OPEN[id] || (() => N.app(id)), cfg: () => N.app(id) }));
  }
  function studio() {
    return (S.tools || []).map(t => ({ id: "sd:" + t.id, n: t.name, d: t.tag || first(t.what), v: String(t.v || "1.0"), cat: "studio", g: t.g, free: t.needs === "free", pro: t.needs !== "free", open: () => { go("studio"); try { AdminStudio.open(t.id); } catch (e) { } } }));
  }
  const all = () => core().concat(studio());
  const CATS = { core: "إضافات المنصّة", studio: "ستوديو ديزاين", dev: "إضافات المطوّرين" };
  const inst = id => { const N = NAV(); return !N || N.installed(id); };
  const act = id => { const N = NAV(); return !N || N.usable(id); };
  async function loadTools() { if (S.tools) return; S.tools = []; try { const r = await fetch("assets/data/tools-catalog.json", { cache: "no-cache" }); if (r.ok) { const j = await r.json(); S.tools = (j && j.tools) || []; } } catch (e) { } }
  const tx = x => { try { return typeof AdminI18n !== "undefined" && AdminI18n.lang === "fr" ? (AdminI18n.t(x) || x) : x; } catch (e) { return x; } };      /* البحث يطابق النص المعروض (الفرنسي عند الفرنسية) والأصل العربي معاً */
  const match = (a, q) => { q = fold(q); if (!q) return true; const h = fold([a.n, a.d, a.g, tx(a.n), tx(a.d), tx(a.g)].join(" ")); return q.split(/\s+/).every(w => h.includes(w)); };

  /* ── التنسيق ── */
  function css() {
    if ($("ao-css")) return; const st = document.createElement("style"); st.id = "ao-css";
    st.textContent = `.ao-wrap{display:grid;gap:1rem;max-width:1100px;grid-template-columns:minmax(0,1fr)}.ao-wrap>*{min-width:0}
.ao-top{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}.ao-top input[type=search]{flex:1 1 240px;min-width:0;padding:.55rem .8rem;border-radius:12px;font:inherit}
.ao-chips{display:flex;flex-wrap:wrap;gap:.4rem}.ao-chips button{padding:.35rem .9rem;border-radius:999px;font:inherit;font-weight:700;cursor:pointer;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);color:inherit}.ao-chips button.on{background:rgba(var(--g-mint-rgb),.28);border-color:rgba(var(--g-mint-rgb),.7)}
.ao-box{padding:1rem;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04)}.ao-box h3{margin:0 0 .6rem;font-size:1.05rem}
.ao-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(270px,100%),1fr));gap:.8rem}
.ao-card{padding:.9rem;border-radius:16px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02));display:grid;gap:.4rem;align-content:start}.ao-card.off{opacity:.78}
.ao-h{display:flex;gap:.5rem;align-items:center;justify-content:space-between}.ao-h b{font-size:.98rem}.ao-d{font-size:.84rem;opacity:.85;line-height:1.7;margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ao-meta{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;font-size:.76rem}.ao-chip{display:inline-block;padding:.08rem .6rem;border-radius:99px;font-weight:800;border:1px solid currentColor}.ao-pro{color:#ff9a3d;background:rgba(255,154,61,.14)}html.white .ao-pro{color:#c2560a;background:rgba(194,86,10,.1)}.ao-v{direction:ltr;opacity:.8}
.ao-act{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;margin-top:.2rem}.ao-empty{padding:1rem;text-align:center;opacity:.8}.ao-sum{display:flex;flex-wrap:wrap;gap:.6rem;font-size:.86rem}.ao-sum b{font-size:1.05rem}
.ao-sub{margin:.2rem 0 .1rem;font-size:.92rem;font-weight:800;opacity:.9}`;
    document.head.appendChild(st);
  }
  const chip = (t, c) => t === "PRO" ? `<span class="ao-chip ao-pro">PRO</span>` : `<span class="ao-chip" style="color:rgb(var(${c}))">${esc(t)}</span>`;      /* شارة PRO برتقالية */

  /* ── الإضافات المنصَّبة ── */
  function instCard(a) {
    const on = act(a.id), N = NAV(), badge = a.pro ? chip("PRO", "--g-amber-rgb") : "";
    return `<div class="ao-card ${on ? "" : "off"}" data-aid="${esc(a.id)}"><div class="ao-h"><b>${esc(a.n)}</b><label class="sw" title="${on ? "تعطيل" : "تفعيل"} الإضافة"><input type="checkbox" data-ao="tg" data-id="${esc(a.id)}" ${on ? "checked" : ""}><i></i></label></div>
<div class="ao-meta">${on ? chip("مفعّلة", "--g-mint-rgb") : chip("معطّلة", "--g-amber-rgb")}${badge}<span class="ao-v">v${esc(a.v)}</span></div><p class="ao-d" title="${esc(a.d)}">${esc(a.d)}</p>
<div class="ao-act"><button type="button" class="small" data-ao="open" data-id="${esc(a.id)}" ${on ? "" : "disabled"}>فتح</button>${a.cfg ? `<button type="button" class="small gray" data-ao="cfg" data-id="${esc(a.id)}">الإعدادات</button>` : ""}<button type="button" class="small red" data-ao="rm" data-id="${esc(a.id)}">إلغاء التثبيت</button></div></div>`;
  }
  function drawInstalled() {
    const host = $("ai-body"); if (!host) return;
    const L = all().filter(a => inst(a.id)), on = L.filter(a => act(a.id)).length;
    const F = L.filter(a => (S.inf === "on" ? act(a.id) : S.inf === "off" ? !act(a.id) : true) && match(a, S.iq));
    const sec = (k, title) => { const l = F.filter(a => a.cat === k); return l.length ? `<div class="ao-box"><h3>${title} (${l.length})</h3><div class="ao-grid">${l.map(instCard).join("")}</div></div>` : ""; };
    const body = sec("core", CATS.core) + sec("studio", CATS.studio);
    const kc = (k, n, c) => `<button type="button" data-ao="inf" data-k="${k}" class="${S.inf === k ? "on" : ""}">${n} (${c})</button>`;
    const nA = (L.length - on);
    host.querySelector(".ao-lst").innerHTML = `<div class="ao-sum"><span>المثبَّتة: <b>${L.length}</b></span><span>المفعّلة: <b>${on}</b></span><span>المعطّلة: <b>${nA}</b></span></div><div class="ao-chips">${kc("all", "الكل", L.length)}${kc("on", "المفعّلة", on)}${kc("off", "المعطّلة", nA)}</div>${body || '<div class="ao-box ao-empty">لا توجد إضافة بهذا الاسم أو الحالة — جرّب «متجر الإضافات» لتثبيت المزيد.</div>'}`;
  }
  async function renderInstalled() {
    css(); const host = $("addons-content"); if (!host) return;
    if (!$("ai-body")) { host.innerHTML = `<div class="ao-wrap" id="ai-body"><div class="ao-top"><input id="ai-q" type="search" placeholder="ابحث في إضافاتك بالاسم…" autocomplete="off" value="${esc(S.iq)}"></div><div class="ao-lst ao-wrap"></div><div id="ai-dev"></div></div>`; bind(host); }
    await loadTools(); drawInstalled();
    try { if (typeof AdminAppStore !== "undefined" && AdminAppStore.mountMine) { const d = $("ai-dev"); if (d && !d.firstChild) AdminAppStore.mountMine(d); } } catch (e) { }
  }

  /* ── متجر الإضافات (يُرسم فوق إضافات المطوّرين المتاحة في تبويب appstore) ── */
  function storeCard(a) {
    const i = inst(a.id), on = act(a.id), N = NAV();
    const st = !i ? "" : on ? chip("✓ مثبَّتة ومفعّلة", "--g-mint-rgb") : chip("مثبَّتة · معطّلة", "--g-amber-rgb");
    const btn = !i ? `<button type="button" class="small" data-ao="install" data-id="${esc(a.id)}">تثبيت وتفعيل</button>` : on ? "" : `<button type="button" class="small" data-ao="on" data-id="${esc(a.id)}">تفعيل</button>`;      /* المتجر للتعريف والتثبيت والتفعيل فقط: لا زر «فتح» (يُفتح من «الإضافات المنصَّبة») */
    return `<div class="ao-card" data-aid="${esc(a.id)}"><div class="ao-h"><b>${esc(a.n)}</b>${st}</div><div class="ao-meta"><span class="ao-v">v${esc(a.v)}</span>${a.pro ? chip("PRO", "--g-amber-rgb") : chip("مجانية", "--g-blue-rgb")}${a.g ? `<span>${esc(a.g)}</span>` : ""}</div><p class="ao-d" title="${esc(a.d)}">${esc(a.d)}</p>${btn ? `<div class="ao-act">${btn}</div>` : ""}</div>`;
  }
  function drawStoreList() {
    const host = $("ao-store"); if (!host) return; const box = host.querySelector(".ao-lst"); if (!box) return;
    const L = all().filter(a => match(a, S.sq) && (S.sf === "all" || S.sf === "dev" ? S.sf === "all" : a.cat === S.sf));
    const sec = (k, title) => { const l = L.filter(a => a.cat === k); return l.length ? `<div class="ao-box"><h3>${title} (${l.length})</h3><div class="ao-grid">${l.map(storeCard).join("")}</div></div>` : ""; };
    box.innerHTML = (S.sf === "dev") ? "" : (sec("core", CATS.core) + sec("studio", CATS.studio) || '<div class="ao-box ao-empty">لا توجد إضافة بهذا الاسم.</div>');
    filterDev();
  }
  function filterDev() {
    const dev = $("as-app"); if (!dev) return; const q = fold(S.sq), hide = S.sf === "core" || S.sf === "studio";
    dev.style.display = hide ? "none" : "";
    dev.querySelectorAll(".as-app").forEach(c => { const n = fold((c.querySelector("b") || {}).textContent + " " + c.textContent); c.style.display = (!q || q.split(/\s+/).every(w => n.includes(w))) ? "" : "none"; });
  }
  async function drawStore(host) {
    css(); if (!host) return;
    if (!host.querySelector(".ao-lst")) {
      const kc = (k, n) => `<button type="button" data-ao="sf" data-k="${k}" class="${S.sf === k ? "on" : ""}">${n}</button>`;
      host.innerHTML = `<div class="ao-wrap"><div class="ao-top"><input id="as-q" type="search" placeholder="ابحث عن إضافة بالاسم…" autocomplete="off" value="${esc(S.sq)}"></div><div class="ao-chips" id="ao-sf">${kc("all", "الكل")}${kc("core", CATS.core)}${kc("studio", CATS.studio)}${kc("dev", CATS.dev)}</div><div class="ao-lst ao-wrap"></div></div>`; bind(host);
    }
    await loadTools(); drawStoreList();
  }

  /* ── الأحداث ── */
  function bind(host) {
    if (host._ab) return; host._ab = 1;
    host.addEventListener("input", e => { const t = e.target; if (t.id === "ai-q") { S.iq = t.value; drawInstalled(); } else if (t.id === "as-q") { S.sq = t.value; drawStoreList(); } });
    host.addEventListener("change", e => { const t = e.target; if (t.dataset && t.dataset.ao === "tg") change(t.dataset.id, t.checked); });
    host.addEventListener("click", e => {
      const b = e.target.closest("[data-ao]"); if (!b || b.tagName === "INPUT") return; const a = b.dataset.ao, id = b.dataset.id, A = all().find(x => x.id === id);
      if (a === "inf") { S.inf = b.dataset.k; drawInstalled(); }
      else if (a === "sf") { S.sf = b.dataset.k; host.querySelectorAll("#ao-sf button").forEach(x => x.classList.toggle("on", x.dataset.k === S.sf)); drawStoreList(); }
      else if (a === "open" && A) A.open();
      else if (a === "cfg" && A && A.cfg) A.cfg();
      else if (a === "rm" && A) { if (confirm(`إلغاء تثبيت «${A.n}»؟ تتعطّل فوراً وتختفي من «الإضافات المنصَّبة»، ويمكنك إعادة تثبيتها من «متجر الإضافات» في أي وقت.`)) { NAV().setInstalled(id, false); toast("أُلغي تثبيت «" + A.n + "»"); refresh(); } }
      else if (a === "install" && A) { NAV().setInstalled(id, true, true); toast("✅ ثُبّتت «" + A.n + "» وفُعّلت"); refresh(); }
      else if (a === "on" && A) { NAV().toggle(id, true); toast("✅ فُعّلت «" + A.n + "»"); refresh(); }
    });
  }
  function change(id, on) { const N = NAV(); if (!N) return; N.toggle(id, on); refresh(); }
  function refresh() { drawInstalled(); drawStoreList(); }
  document.addEventListener("alyssum:addons", () => { try { if ($("ai-body")) drawInstalled(); if ($("ao-store")) drawStoreList(); } catch (e) { } });
  document.addEventListener("alyssum:devapps", () => { filterDev(); });
  document.addEventListener("alyssum:lang", () => { setTimeout(() => { try { if ($("ai-body")) drawInstalled(); if ($("ao-store")) drawStoreList(); } catch (e) { } }, 150); });

  function init() {
    const w = () => { if (typeof Admin === "undefined" || !Admin.tab || Admin._aoWrapped) return; const orig = Admin.tab;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-addons"); if (el) el.classList.toggle("hidden", t !== "addons"); if (t === "addons") renderInstalled(); return r; };
      Admin._aoWrapped = true; };
    w(); setTimeout(w, 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { renderInstalled, drawStore, all, refresh };
})();
window.AdminAddons = AdminAddons;
