/* ستوديو ديزاين: كل أدوات الصور والتصميم في تبويب واحد بمجموعة الإضافات؛ اضغط أداة فتفتح صفحتها مباشرة داخل اللوحة (صفحة التعريف الغنية بمعرضها وخطواتها، مضمَّنة في إطار؛ وللأدوات بلا صفحة تعريف صفحة مختصرة بالخطوات والنصائح)
   المصدر assets/data/tools-catalog.json (يولّده scripts/gen-tool-pages.py من saas/guide/tools.json). المسار #studio=<معرّف> يفتح صفحة أداة مباشرة ويعمل معه زر الرجوع في المتصفح. */
const AdminStudio = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { data: null, busy: false, err: false, q: "", g: "", k: "", id: "", fh: 0 };
  const CSS = `#tab-studio .sd-top{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin-bottom:.6rem}#tab-studio .sd-top input{flex:1 1 220px}#tab-studio .sd-chips{display:flex;gap:.4rem;flex-wrap:wrap;margin:.2rem 0 .8rem}#tab-studio .sd-chips button{border:1px solid var(--line);background:transparent;color:inherit;border-radius:999px;padding:.35rem .95rem;font:inherit;font-weight:800;cursor:pointer}#tab-studio .sd-chips button.on{border-color:var(--g-mint,#157a55);color:var(--g-mint,#157a55);background:rgba(var(--g-mint-rgb,21,122,85),.12)}
#tab-studio .sd-kind{margin-top:1.4rem}#tab-studio .sd-kind>h2{margin:0 0 .3rem;font-size:1.25rem;padding-bottom:.4rem;border-bottom:1px solid var(--line)}#tab-studio .sd-sec{margin-top:1rem}#tab-studio .sd-sec>h3{margin:0 0 .5rem;font-size:1.05rem}#tab-studio .sd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:.7rem}
#tab-studio .sd-card{border:1px solid var(--line);border-radius:16px;padding:.8rem;display:flex;flex-direction:column;gap:.5rem;cursor:pointer;text-align:start;background:transparent;color:inherit;font:inherit;transition:transform .2s,border-color .2s}#tab-studio .sd-card:hover,#tab-studio .sd-card:focus-visible{transform:translateY(-2px);border-color:var(--g-mint,#157a55);outline:none}
#tab-studio .sd-h{display:flex;gap:.7rem;align-items:center}#tab-studio .sd-h img,#tab-studio .sd-h i{flex:none;width:54px;height:54px;border-radius:12px;object-fit:contain;background:#061810}#tab-studio .sd-h i{display:grid;place-items:center;font-style:normal;font-weight:900;font-size:1.3rem;border:1px solid var(--line);background:transparent}#tab-studio .sd-h span{display:grid;min-width:0}#tab-studio .sd-h small{opacity:.75;line-height:1.5}
#tab-studio em.sd-b{font-style:normal;font-size:.7rem;font-weight:800;border-radius:999px;padding:1px 9px;border:1px solid var(--line);align-self:flex-start}#tab-studio em.sd-b.free{color:#16a34a;border-color:#16a34a}#tab-studio em.sd-b.pro{color:#fff;letter-spacing:.06em;border-color:rgba(245,158,11,.7);background:linear-gradient(180deg,rgba(245,158,11,.55),rgba(217,119,6,.35));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -2px 3px rgba(0,0,0,.2),0 1px 4px rgba(0,0,0,.25);backdrop-filter:blur(4px)}
#tab-studio .sd-page{display:grid;gap:.9rem}#tab-studio .sd-head{display:flex;gap:1rem;align-items:center;flex-wrap:wrap}#tab-studio .sd-head img,#tab-studio .sd-head i{width:96px;height:96px;border-radius:18px;object-fit:contain;background:#061810;flex:none}#tab-studio .sd-head i{display:grid;place-items:center;font-style:normal;font-weight:900;font-size:2.2rem;border:1px solid var(--line);background:transparent}#tab-studio .sd-head h2{margin:0}#tab-studio .sd-head p{margin:.2rem 0 0;opacity:.8}
#tab-studio .sd-box{border:1px solid var(--line);border-radius:16px;padding:.9rem 1.1rem}#tab-studio .sd-box>b{display:block;margin-bottom:.35rem;color:var(--g-mint,#157a55)}#tab-studio .sd-box ol,#tab-studio .sd-box ul{margin:0;padding-inline-start:1.3rem;line-height:2}#tab-studio .sd-act{display:flex;gap:.5rem;flex-wrap:wrap}#tab-studio .sd-act button{flex:1 1 170px;min-height:48px}#tab-studio .sd-rel{display:flex;gap:.4rem;flex-wrap:wrap}#tab-studio .sd-rel button{border:1px solid var(--line);background:transparent;color:inherit;border-radius:999px;padding:.35rem .95rem;font:inherit;font-weight:800;cursor:pointer}#tab-studio .sd-nav{display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap}#tab-studio .sd-fr{width:100%;border:1px solid var(--line);border-radius:16px;background:#fff;display:block}#tab-studio .sd-empty{opacity:.7;padding:1.2rem;text-align:center}`;
  function css() { if ($("sd-css")) return; const s = document.createElement("style"); s.id = "sd-css"; s.textContent = CSS; document.head.appendChild(s); }
  function load() { if (S.data || S.busy) return; S.busy = true; S.err = false; fetch("assets/data/tools-catalog.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).then(j => { if (j && j.tools) S.data = j; else S.err = true; }).catch(() => { S.err = true; }).finally(() => { S.busy = false; draw(); }); }
  const weakDev = () => { try { return typeof AIVision !== "undefined" && AIVision.weak && AIVision.weak(); } catch (e) { return false; } };      // الهاتف: لا التقاط عناصر
  const tools = () => ((S.data && S.data.tools) || []).filter(t => !(t.id === "cap" && weakDev()));
  const groups = () => tools().reduce((a, t) => (a.indexOf(t.g) < 0 && a.push(t.g), a), []);
  const byId = id => tools().find(t => t.id === id);
  const badge = t => `<em class="sd-b ${t.needs === "free" ? "free" : "pro"}">${t.needs === "free" ? "مجانية" : "PRO"}</em>`;
  const ico = (t, cls) => t.ic ? `<img src="assets/img/tools/ic/${esc(t.ic)}.webp" alt="" loading="lazy">` : `<i>${esc(t.name.charAt(0))}</i>`;
  const fold = s => String(s || "").toLowerCase().replace(/[ً-ٰٟ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
  function match(t) { if (S.k === "p" && !t.pd) return false; if (S.k === "o" && t.pd) return false; const q = fold(S.q).trim(); if (!q) return true; const h = fold([t.name, t.tag, t.what, t.id].join(" ")); return q.split(/\s+/).every(w => h.indexOf(w) >= 0); }
  function listHtml() {
    const gs = groups(), L = tools().filter(match), np = tools().filter(t => t.pd).length;
    const kc = (k, n, c) => `<button type="button" data-sdk="${k}" class="${S.k === k ? "on" : ""}">${n} (${c})</button>`;
    const chips = `<div class="sd-chips">${kc("", "الكل", tools().length)}${kc("p", "أدوات المنتجات", np)}${kc("o", "أدوات أخرى", tools().length - np)}</div>`;
    const card = t => `<button type="button" class="sd-card" data-sdt="${esc(t.id)}"><span class="sd-h">${ico(t)}<span><b>${esc(t.name)}</b><small>${esc(t.tag)}</small></span></span>${badge(t)}</button>`;
    const kinds = [["p", "🛍️ أدوات المنتجات"], ["o", "🎨 أدوات أخرى"]].map(([k, title]) => {
      const KL = L.filter(t => (k === "p") === !!t.pd); if (!KL.length) return "";
      const inner = gs.map(g => { const l = KL.filter(t => t.g === g); return l.length ? `<div class="sd-sec"><h3>${esc(g)}</h3><div class="sd-grid">${l.map(card).join("")}</div></div>` : ""; }).join("");
      return `<section class="sd-kind" data-sdkind="${k}"><h2>${title}</h2>${inner}</section>`;
    }).join("");
    const body = L.length ? kinds : `<div class="sd-empty">لا توجد أداة بهذا الاسم</div>`;
    return `<div class="sd-top"><input id="sd-q" type="search" placeholder="ابحث عن أداة…" value="${esc(S.q)}"></div>${chips}<div id="sd-list">${body}</div>`;
  }
  const base = () => String((typeof CONFIG !== "undefined" && CONFIG.TOOLS_PAGES) || (S.data && S.data.base) || "").replace(/\/*$/, "/");
  function navHtml(t) { const L = tools(), i = L.findIndex(x => x.id === t.id), prev = L[(i - 1 + L.length) % L.length], next = L[(i + 1) % L.length]; return `<div class="sd-nav"><button type="button" class="small gray" data-sdback="1">→ كل الأدوات</button><span><button type="button" class="small gray" data-sdt="${esc(prev.id)}">‹ ${esc(prev.name)}</button> <button type="button" class="small gray" data-sdt="${esc(next.id)}">${esc(next.name)} ›</button></span></div>`; }
  function pageHtml(t) {
    if (t.landing) return `<div class="sd-page">${navHtml(t)}${typeof Credits !== "undefined" ? Credits.chip(t.id) : ""}<iframe id="sd-fr" class="sd-fr" title="${esc(t.name)}" src="${esc(base() + t.landing + "?embed=1")}" loading="eager" style="height:${S.fh || 900}px"></iframe></div>`;
    const rel = (t.rel || []).map(byId).filter(Boolean);
    return `<div class="sd-page">${navHtml(t)}
<div class="sd-head">${ico(t)}<div><h2>${esc(t.name)}</h2><p>${esc(t.tag)}</p>${badge(t)}</div></div>
${typeof Credits !== "undefined" ? Credits.chip(t.id) : ""}
${t.what ? `<div class="sd-box"><b>ما هي هذه الأداة؟</b>${esc(t.what)}</div>` : ""}
${t.nt ? `<div class="sd-box"><b>المتطلب</b>${esc(t.nt)}</div>` : ""}
${(t.steps || []).length ? `<div class="sd-box"><b>طريقة الاستعمال</b><ol>${t.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol></div>` : ""}
${(t.tips || []).length ? `<div class="sd-box"><b>نصائح</b><ul>${t.tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
<div class="sd-act"><button type="button" data-sdgo="${esc(t.id)}">ابدأ الآن</button></div>
${rel.length ? `<div class="sd-box"><b>أدوات مرتبطة</b><div class="sd-rel">${rel.map(r => `<button type="button" data-sdt="${esc(r.id)}">${esc(r.name)}</button>`).join("")}</div></div>` : ""}</div>`;
  }
  function draw() {
    const host = $("studio-content"); if (!host) return; css();
    if (!S.data) { host.innerHTML = `<div class="card"><h2>🎨 ستوديو ديزاين</h2><div class="sd-empty">${S.err ? "تعذّر تحميل قائمة الأدوات — أعد المحاولة بعد قليل." : "جارٍ التحميل…"}</div></div>`; return; }
    const t = S.id && byId(S.id);
    host.innerHTML = `<div class="card"><h2>🎨 ستوديو ديزاين</h2>${t ? pageHtml(t) : `<div class="hint" style="margin:0 0 .6rem">كل أدوات الصور والتصميم في مكان واحد (${tools().length} أداة). اضغط أي أداة لتفتح صفحتها مباشرة، ومنها تفتحها في المحرّر.</div>${listHtml()}`}</div>`;
    try { window.scrollTo({ top: 0 }); } catch (e) { }
  }
  /* «ابدأ الآن»: نافذة تحميل الصورة ثم الأداة على صورتك (أو نافذة الأداة الخاصة بها) */
  function start(id) { if (typeof ToolWin !== "undefined") return ToolWin.open(id); if (typeof AdminNav !== "undefined") return AdminNav.toolGo(id); }
  function open(id) { S.id = id || ""; S.fh = 0; const h = id ? "#studio=" + id : ""; try { if (location.hash !== h) history.pushState(null, "", location.pathname + location.search + h); } catch (e) { } draw(); }
  function fromHash() { const m = /[#&]studio=([a-z0-9]+)/i.exec(location.hash); const id = m ? m[1].toLowerCase() : ""; if (id !== S.id) { S.id = id; if (!$("tab-studio").classList.contains("hidden")) draw(); } return id; }
  function bind() {
    const host = $("studio-content"); if (!host || host.__b) return; host.__b = 1;
    host.addEventListener("click", e => {
      const el = e.target.closest("[data-sdt],[data-sdk],[data-sdback],[data-sdgo]"); if (!el) return;
      if (el.dataset.sdt) return open(el.dataset.sdt);
      if (el.dataset.sdback) return open("");
      if (el.dataset.sdgo) return start(el.dataset.sdgo);
      if (el.dataset.sdk !== undefined) { S.k = el.dataset.sdk; draw(); }
    });
    host.addEventListener("input", e => { if (e.target.id === "sd-q") { S.q = e.target.value; const l = $("sd-list"); if (l) { const f = document.createElement("div"); f.innerHTML = listHtml(); l.innerHTML = f.querySelector("#sd-list").innerHTML; } } });
  }
  window.addEventListener("message", e => {
    const d = e.data; if (!d || !d.pfStudio) return; const fr = $("sd-fr"); if (!fr || e.source !== fr.contentWindow) return;
    if (d.pfStudio === "h") { const h = Math.max(600, Math.min(30000, +d.h || 0)); if (h && Math.abs(h - S.fh) > 4) { S.fh = h; fr.style.height = h + "px"; } }
    else if (d.pfStudio === "open" && /^[a-z0-9]+$/i.test(String(d.tool || ""))) start(d.tool);
  });
  function init() {
    if (typeof Admin === "undefined" || !Admin.tab || Admin.tab.__sd) return setTimeout(init, 400);
    const orig = Admin.tab;
    Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-studio"); if (el) el.classList.toggle("hidden", t !== "studio"); if (t === "studio") { bind(); fromHash(); load(); draw(); } return r; };
    Admin.tab.__sd = 1;
    window.addEventListener("hashchange", () => { if (/[#&]studio=/.test(location.hash) || S.id) { const t = $("tab-studio"); if (t && t.classList.contains("hidden") && /[#&]studio=/.test(location.hash)) { const b = document.querySelector('.nav-btn[onclick*="studio"]'); if (b) b.click(); } else fromHash(); } });
    if (/[#&]studio=/.test(location.hash)) { let n = 0; const t = setInterval(() => { n++; if (typeof Admin !== "undefined" && Admin.products && document.getElementById("app") && !document.getElementById("app").hidden) { clearInterval(t); const b = document.querySelector('.nav-btn[onclick*="studio"]'); if (b) b.click(); } else if (n > 60) clearInterval(t); }, 500); }
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
  return { open, draw, load, state: S, catalog: () => tools() };
})();
