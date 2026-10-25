/* نافذة الأداة (ستوديو ديزاين): كل أداة صور تفتح نافذة لتحميل الصورة (جهاز / سحب / لصق / منتجات المتجر) ثم تُفتح الأداة على الصورة مباشرة في المطوّر
   (لوحة بمقاس الصورة) لتعديلها ثم الحفظ بـ«تصدير الصورة» (تنزيل أو مكتبة) أو «حفظ ونشر» أو متابعة العمل في المطوّر. الأدوات ذات النافذة الخاصة (باركود، استوديو 3D، Magic Layers…) تُفتح بنافذتها.
   الاستعمال: ToolWin.open(id) · ToolWin.has(id) */
const ToolWin = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /* أدوات بنافذتها الخاصة (لا تحتاج خطوة الصورة) */
  const OWN = ["gen", "batch", "catalog", "logo", "txt2img", "ast", "stk", "barcode", "studio3d", "magiclayers", "pagepilot"];
  const MULTI = { bl: "دمج صور: الصورة الأولى هي الأساس والباقي تُدمج فوقها", cl: "كولاج: اختر من 2 إلى 8 صور", vgen: "حتى 4 صور للفيديو", vad: "حتى 4 صور للإعلان", v360: "من 6 إلى 36 إطاراً مرتّبة بأسمائها" };
  const NEED = { tryon: "صورة القطعة — صورة الشخص تُرفع داخل الأداة" };
  const S = { id: "", files: [], urls: [], cat: null, busy: false };
  let bg = null;
  const CSS = `#tw-bg{position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:12px}
#tw-box{width:min(620px,100%);max-height:94vh;overflow:auto;background:rgba(9,24,18,.985);border:1px solid rgba(255,255,255,.22);border-radius:20px;padding:1.1rem 1.2rem;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.6)}
#tw-box .tw-h{display:flex;gap:.8rem;align-items:center;margin-bottom:.8rem}#tw-box .tw-h img,#tw-box .tw-h i{flex:none;width:58px;height:58px;border-radius:14px;object-fit:contain;background:#061810}#tw-box .tw-h i{display:grid;place-items:center;font-style:normal;font-weight:900;font-size:1.5rem;border:1px solid rgba(255,255,255,.25)}
#tw-box .tw-h b{display:block;font-size:1.15rem}#tw-box .tw-h small{opacity:.8}#tw-box .tw-x{margin-inline-start:auto;background:none;border:0;color:#fff;font-size:1.3rem;cursor:pointer}
#tw-box .tw-dz{border:2px dashed rgba(255,255,255,.35);border-radius:16px;min-height:190px;display:grid;place-items:center;text-align:center;padding:1rem;cursor:pointer;transition:border-color .2s,background .2s}#tw-box .tw-dz.on,#tw-box .tw-dz:hover{border-color:var(--g-mint,#c6fe17);background:rgba(var(--g-mint-rgb,198,254,23),.07)}
#tw-box .tw-pv{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center}#tw-box .tw-pv div{position:relative}#tw-box .tw-pv img{height:120px;max-width:200px;object-fit:contain;border-radius:10px;background:repeating-conic-gradient(#0003 0 25%,#fff1 0 50%) 0 0/16px 16px}#tw-box .tw-pv button{position:absolute;top:2px;inset-inline-end:2px;width:22px;height:22px;border-radius:50%;border:0;background:rgba(0,0,0,.75);color:#fff;cursor:pointer;line-height:1}
#tw-box .tw-row{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.8rem;align-items:center}#tw-box .tw-row select{flex:1 1 200px;padding:.55rem;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.2);font-family:inherit}#tw-box .tw-row select option{color:#000}
#tw-box .tw-b{border:1px solid rgba(255,255,255,.28);color:#fff;border-radius:12px;padding:.65rem 1.1rem;font-weight:800;cursor:pointer;font-family:inherit;backdrop-filter:blur(8px);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -3px 6px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.25);background:rgba(198,254,23,.22);transition:transform .2s,background .2s}#tw-box .tw-b:hover{transform:translateY(-2px);background:rgba(198,254,23,.34)}#tw-box .tw-b.g{background:rgba(255,255,255,.1)}#tw-box .tw-b[disabled]{opacity:.45;pointer-events:none}
#tw-box .tw-n{font-size:.82rem;opacity:.8;margin-top:.7rem;line-height:1.8}`;
  async function cat() { if (S.cat) return S.cat; try { const r = await fetch("assets/data/tools-catalog.json", { cache: "no-cache" }); S.cat = r.ok ? (await r.json()).tools || [] : []; } catch (e) { S.cat = []; } return S.cat; }
  const info = id => (S.cat || []).find(t => t.id === id) || { id, name: id, tag: "" };
  const has = id => OWN.indexOf(id) < 0 && typeof PBApp !== "undefined" && !!PBApp.toolSession;
  const urlBlob = async u => { const r = await fetch(u, { cache: "force-cache" }); if (!r.ok) throw new Error("تعذّر جلب الصورة"); return r.blob(); };
  function close() { if (bg) { bg.remove(); bg = null; } document.removeEventListener("paste", onPaste, true); document.removeEventListener("keydown", onKey, true); S.files = []; S.urls = []; }
  const onKey = e => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  function onPaste(e) { if (!bg) return; const it = [...(e.clipboardData && e.clipboardData.items || [])].filter(x => x.type && x.type.indexOf("image/") === 0).map(x => x.getAsFile()).filter(Boolean); if (it.length) { e.preventDefault(); add(it); } }
  function multi() { return !!MULTI[S.id]; }
  function add(files) {
    const ok = [...files].filter(f => f && /^image\//.test(f.type)); if (!ok.length) return;
    S.files = multi() ? S.files.concat(ok).slice(0, 36) : [ok[0]]; draw();
  }
  function draw() {
    if (!bg) return; const t = info(S.id), n = S.files.length;
    S.urls.forEach(u => URL.revokeObjectURL(u)); S.urls = S.files.map(f => URL.createObjectURL(f));
    const ico = t.ic ? `<img src="assets/img/tools/ic/${esc(t.ic)}.webp" alt="">` : `<i>${esc((t.name || "?").charAt(0))}</i>`;
    const prods = (typeof Admin !== "undefined" && Admin.products || []).filter(p => p && p.cover);
    $("tw-box").innerHTML = `<div class="tw-h">${ico}<span><b>${esc(t.name)}</b><small>${esc(t.tag || "")}</small></span><button type="button" class="tw-x" data-tw="x" aria-label="إغلاق">✕</button></div>
${typeof Credits !== "undefined" ? Credits.chip(S.id) : ""}
<div class="tw-dz" id="tw-dz" tabindex="0">${n ? `<div class="tw-pv">${S.urls.map((u, i) => `<div><img src="${u}" alt=""><button type="button" data-tw="rm" data-i="${i}" aria-label="حذف">✕</button></div>`).join("")}</div>` : `<div><div style="font-size:2rem">⬆</div><b>اسحب الصورة هنا أو اضغط للاختيار</b><div style="opacity:.75;font-size:.85rem;margin-top:.3rem">${esc(MULTI[S.id] || NEED[S.id] || "يمكنك أيضاً لصق صورة بـ Ctrl+V")}</div></div>`}</div>
<input id="tw-file" type="file" accept="image/*" ${multi() ? "multiple" : ""} hidden>
<div class="tw-row">${prods.length ? `<select id="tw-prod"><option value="">أو اختر صورة منتج من متجرك…</option>${prods.map(p => `<option value="${esc(p.slug)}">${esc(p.title || p.slug)}</option>`).join("")}</select>` : ""}<button type="button" class="tw-b" data-tw="go" ${n && !S.busy ? "" : "disabled"}>${S.busy ? "⏳ جارٍ الفتح…" : "ابدأ التعديل"}</button></div>
<div class="tw-n">تُفتح الأداة على صورتك مباشرة. عند الانتهاء اضغط «تصدير الصورة» لتنزيلها أو حفظها في المكتبة، أو «حفظ ونشر»، أو تابع التعديل في المطوّر.</div>`;
  }
  async function go() {
    if (S.busy || !S.files.length) return; S.busy = true; draw();
    try { const ok = await PBApp.toolSession(S.files.slice(), S.id, info(S.id).name); S.busy = false; if (ok !== false) close(); else draw(); } catch (e) { S.busy = false; draw(); if (typeof Admin !== "undefined" && Admin.toast) Admin.toast("⚠️ " + (e && e.message || e)); }
  }
  async function pickProduct(slug) {
    const p = (Admin.products || []).find(x => x.slug === slug); if (!p || !p.cover) return;
    try { const b = await urlBlob(p.cover); add([new File([b], slug + ".webp", { type: b.type || "image/webp" })]); } catch (e) { alert("تعذّر تحميل صورة المنتج"); }
  }
  async function open(id) {
    id = String(id || "").toLowerCase(); await cat();
    if (OWN.indexOf(id) >= 0 || typeof PBApp === "undefined" || !PBApp.toolSession) { if (typeof AdminNav !== "undefined" && AdminNav.deepTool) return AdminNav.deepTool(id); return false; }
    close(); S.id = id; S.files = [];
    if (!$("tw-css")) { const st = document.createElement("style"); st.id = "tw-css"; st.textContent = CSS; document.head.appendChild(st); }
    bg = document.createElement("div"); bg.id = "tw-bg"; bg.innerHTML = `<div id="tw-box" role="dialog" aria-modal="true"></div>`; document.body.appendChild(bg);
    bg.addEventListener("click", e => {
      if (e.target === bg) return close(); const el = e.target.closest("[data-tw],#tw-dz"); if (!el) return;
      if (el.id === "tw-dz") return $("tw-file").click();
      const a = el.dataset.tw; if (a === "x") close(); else if (a === "go") go(); else if (a === "rm") { S.files.splice(+el.dataset.i, 1); draw(); }
    });
    bg.addEventListener("change", e => { if (e.target.id === "tw-file") add(e.target.files); else if (e.target.id === "tw-prod" && e.target.value) pickProduct(e.target.value); });
    bg.addEventListener("dragover", e => { e.preventDefault(); const z = $("tw-dz"); if (z) z.classList.add("on"); });
    bg.addEventListener("dragleave", e => { const z = $("tw-dz"); if (z && !bg.contains(e.relatedTarget)) z.classList.remove("on"); });
    bg.addEventListener("drop", e => { e.preventDefault(); add(e.dataTransfer.files || []); });
    document.addEventListener("paste", onPaste, true); document.addEventListener("keydown", onKey, true);
    draw(); return true;
  }
  return { open, close, has, state: S, OWN };
})();
