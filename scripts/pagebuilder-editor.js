/* ══════════════════════════════════════════════════════════════════════════════
   PBApp — واجهة المحرر: لوحة العناصر، قماش حي (iframe) بتحرير مباشر، تحديد وسحب وتغيير حجم،
   لوحة إعدادات متجاوبة (محتوى/تنسيق/متقدم)، تراجع/إعادة، وحفظ/نشر إلى GitHub (أو PHP).
   ══════════════════════════════════════════════════════════════════════════════ */
const PBApp = (() => {
  const { DEVS, DEVNAME, DEVIC, uid, esc, clone, isObj, num, own, eff, setR, WIDGETS, ORDER, TPLS, SEC_CTL, COL_CTL, common } = PB;
  const $ = id => document.getElementById(id);
  const DEVW = { d: 1280, t: 820, m: 390 };
  const E = { sl: {}, snap: true, page: null, sel: null, dev: "d", hist: [], hi: -1, slug: "", isNew: true, dirty: false, tab: "c", ltab: "add", drag: null, scale: 1, sha: {} };
  let frame, fdoc, root, styleEl, built = false, raf = 0, saveT = 0;

  const EDIT_CSS = `
.pb-edit [data-pb]{cursor:pointer}
.pb-edit .pb-sec:hover{outline:1px dashed #2d6cdf;outline-offset:-1px}
.pb-edit .pb-col:hover>.pb-colin{outline:1px dashed #9b59b6;outline-offset:-1px}
.pb-edit .pb-w:hover{outline:1px dashed #e67e22;outline-offset:2px}
.pb-edit .pbx-dropcol{outline:3px dashed #9b59b6!important;outline-offset:-3px;background:rgba(155,89,182,.08)}
.pb-empty{border:2px dashed #cdbfa0;border-radius:10px;padding:18px;text-align:center;color:#a1936f;font-size:.9rem;width:100%}
[contenteditable=true]{outline:2px solid #2d6cdf!important;outline-offset:3px;cursor:text;min-width:20px}
.pb-edit .k-canvas .pb-in{background-image:linear-gradient(rgba(0,0,0,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.05) 1px,transparent 1px);background-size:20px 20px}
.pb-edit .pb-sl-cap:not(.below){cursor:move}
.pb-drop{position:absolute;background:#2d6cdf;height:4px;border-radius:2px;pointer-events:none;z-index:9999;box-shadow:0 0 0 2px rgba(45,108,223,.25)}
.pb-edit [data-anim]{opacity:1!important;transform:none!important}
body{overflow-x:hidden;margin:0}`;

  const css = `
#pb-app{position:fixed;inset:0;z-index:10000;background:#e9e6df;display:none;flex-direction:column;font-family:inherit;direction:rtl}
#pb-app.on{display:flex}
.pbx-top{display:flex;align-items:center;gap:.5rem;padding:.5rem .8rem;background:#173f35;color:#fff;flex-wrap:wrap}
.pbx-top input{background:#fff;border:0;border-radius:8px;padding:.4rem .7rem;font-weight:800;width:auto;flex:0 1 240px;min-width:120px;font-family:inherit;color:#173f35}
.pbx-top button{background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:8px;padding:.42rem .75rem;font-weight:800;cursor:pointer;font-family:inherit;font-size:.85rem}
.pbx-top button:hover{background:rgba(255,255,255,.22)}.pbx-top button.on{background:#c8a24b;color:#173f35}.pbx-top button.pub{background:#c8a24b;color:#173f35}.pbx-top button:disabled{opacity:.35;cursor:default}
.pbx-top .sp{margin-inline-start:auto}.pbx-dirty{font-size:.78rem;opacity:.8}
.pbx-main{flex:1;display:flex;min-height:0}
.pbx-left{width:260px;background:#fff;border-inline-end:1px solid #ddd;display:flex;flex-direction:column;min-height:0}
.pbx-right{width:310px;flex:0 0 auto;max-width:60vw;background:#fff;border-inline-start:1px solid #ddd;overflow:auto;padding:.7rem}
.pbx-tabs{display:flex;border-bottom:1px solid #eee}.pbx-tabs button{flex:1;border:0;background:none;padding:.6rem .2rem;font-weight:800;cursor:pointer;font-family:inherit;font-size:.8rem;color:#666;border-bottom:3px solid transparent}.pbx-tabs button.on{color:#173f35;border-bottom-color:#c8a24b}
.pbx-pane{padding:.7rem;overflow:auto;flex:1}
.pbx-grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
.pbx-wi{border:1.5px solid #e6dfcf;border-radius:10px;padding:.6rem .3rem;text-align:center;cursor:grab;background:#faf6ec;font-size:.8rem;font-weight:800;color:#173f35;user-select:none}.pbx-wi:hover{border-color:#c8a24b;background:#fff3d6}.pbx-wi i{display:block;font-style:normal;font-size:1.4rem;margin-bottom:.2rem}
.pbx-tpl{display:block;width:100%;text-align:start;border:1.5px solid #e6dfcf;border-radius:10px;padding:.65rem;margin-bottom:.5rem;background:#faf6ec;font-weight:800;color:#173f35;cursor:grab;font-family:inherit}.pbx-tpl:hover{border-color:#c8a24b}
.pbx-stage{flex:1;position:relative;overflow:auto;background:#cfcabd;min-width:0}
.pbx-sc{position:relative;margin:18px auto}
.pbx-fw{position:absolute;left:0;top:0;transform-origin:0 0;background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.25)}
.pbx-fw iframe{border:0;width:100%;height:100%;display:block;background:#fff}
#pbx-ovl{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.pbx-box{position:absolute;border:2px solid #2d6cdf;pointer-events:none;box-sizing:border-box}
.pbx-box.column{border-color:#9b59b6}.pbx-box.widget{border-color:#e67e22}
.pbx-bar{position:absolute;top:-30px;right:-2px;display:flex;gap:2px;pointer-events:auto;white-space:nowrap}
.pbx-bar span,.pbx-bar button{background:#2d6cdf;color:#fff;border:0;font-size:.74rem;font-weight:800;padding:.22rem .5rem;border-radius:6px 6px 0 0;cursor:pointer;font-family:inherit}.pbx-bar span{cursor:default}
.pbx-box.column .pbx-bar *{background:#9b59b6}.pbx-box.widget .pbx-bar *{background:#e67e22}
.pbx-bar button:hover{filter:brightness(1.15)}
.pbx-q{background:#faf6ec;border:1.5px solid #eadfc4;border-radius:10px;padding:.5rem;margin-bottom:.6rem;display:grid;gap:.5rem}
.pbx-qg{display:grid;gap:.2rem}.pbx-qg>small{font-size:.66rem;color:#a08a55;font-weight:800}
.pbx-qb{display:flex;flex-wrap:wrap;gap:.25rem}.pbx-qrow{display:grid;grid-template-columns:1fr auto;gap:.5rem;align-items:start}
.pbx-qk{flex:1 1 34px;min-width:34px;border:1.5px solid #e0d9c8;background:#fff;border-radius:8px;padding:.28rem .35rem;cursor:pointer;font-weight:800;font-family:inherit;font-size:.76rem;white-space:nowrap}
.pbx-qk.wide{flex:2 1 80px}.pbx-qk:hover{border-color:#c8a24b}.pbx-qk.on{background:#173f35;color:#fff;border-color:#173f35}
.pbx-dpad{display:grid;grid-template-columns:repeat(3,30px);grid-template-areas:". u ." "l d r";gap:.2rem;direction:ltr}.pbx-dpad .pbx-qk{min-width:0;padding:.2rem 0;text-align:center}.pbx-dpad .u{grid-area:u}.pbx-dpad .l{grid-area:l}.pbx-dpad .d{grid-area:d}.pbx-dpad .r{grid-area:r}
.pbx-note{font-size:.68rem;color:#999;line-height:1.6}
.pbx-crumbs{display:flex;flex-wrap:wrap;gap:.15rem;align-items:center}.pbx-sep{color:#bbb;font-style:normal;font-size:.8rem}.pbx-crumb{border:1px solid #e0d9c8;background:#fff;border-radius:6px;padding:.12rem .4rem;font-size:.72rem;cursor:pointer;font-family:inherit}.pbx-crumb.on{background:#e67e22;color:#fff;border-color:#e67e22}
.pbx-rz{width:7px;flex:0 0 7px;cursor:ew-resize;background:linear-gradient(90deg,transparent 2px,#cbbf9f 2px,#cbbf9f 4px,transparent 4px);position:relative;z-index:3}.pbx-rz:hover,.pbx-rz.on{background:linear-gradient(90deg,transparent 1px,#c8a24b 1px,#c8a24b 5px,transparent 5px)}
.pbx-h{position:absolute;pointer-events:auto;background:#fff;border:2px solid currentColor;border-radius:3px;color:#2d6cdf;z-index:3;width:11px;height:11px}
.pbx-box.column .pbx-h{color:#9b59b6}.pbx-box.widget .pbx-h{color:#e67e22}
.pbx-h.d-n{top:-7px;left:50%;margin-left:-6px;cursor:ns-resize}.pbx-h.d-s{bottom:-7px;left:50%;margin-left:-6px;cursor:ns-resize}.pbx-h.d-e{right:-7px;top:50%;margin-top:-6px;cursor:ew-resize}.pbx-h.d-w{left:-7px;top:50%;margin-top:-6px;cursor:ew-resize}
.pbx-h.d-ne{top:-7px;right:-7px;cursor:nesw-resize}.pbx-h.d-nw{top:-7px;left:-7px;cursor:nwse-resize}.pbx-h.d-se{bottom:-7px;right:-7px;cursor:nwse-resize}.pbx-h.d-sw{bottom:-7px;left:-7px;cursor:nesw-resize}
.pbx-guide{position:absolute;background:#e91e63;pointer-events:none;z-index:4}
.pbx-bar input[type=color]{width:26px;height:22px;padding:0;border:0;border-radius:4px;background:none;cursor:pointer;vertical-align:middle}.pbx-bar button.on{outline:2px solid #fff}
.pbx-gb{border:1.5px dashed #cdbfa0;border-radius:10px;padding:.6rem;margin-bottom:.6rem;background:#fff}.pbx-gb input{width:64px;border:1.5px solid #e0d9c8;border-radius:8px;padding:.3rem;font-family:inherit}
.pbx-tip{position:absolute;background:#173f35;color:#fff;font-size:.75rem;font-weight:800;padding:.15rem .5rem;border-radius:6px;pointer-events:none;z-index:5}
.pbx-add{display:block;margin:0 auto 24px;background:#173f35;color:#fff;border:0;border-radius:10px;padding:.6rem 1.4rem;font-weight:800;cursor:pointer;font-family:inherit}
.pbx-rt{position:absolute;display:none;background:#222;border-radius:8px;padding:3px;gap:2px;pointer-events:auto;z-index:6}.pbx-rt button{background:none;border:0;color:#fff;font-weight:800;padding:.25rem .55rem;cursor:pointer;border-radius:5px;font-family:inherit}.pbx-rt button:hover{background:#444}.pbx-rt input[type=color]{width:26px;height:26px;border:0;padding:0;background:none;vertical-align:middle}
.pbx-ih{display:flex;align-items:center;gap:.4rem;font-weight:900;color:#173f35;margin-bottom:.5rem}.pbx-ih small{color:#999;font-weight:600}
.pbx-itabs{display:flex;gap:.3rem;margin-bottom:.6rem}.pbx-itabs button{flex:1;border:1.5px solid #e6dfcf;background:#fff;border-radius:8px;padding:.4rem;font-weight:800;cursor:pointer;font-family:inherit;font-size:.82rem}.pbx-itabs button.on{background:#173f35;color:#fff;border-color:#173f35}
.pbx-dv{display:flex;gap:.3rem;margin-bottom:.6rem}.pbx-dv button{flex:1;border:1.5px solid #e6dfcf;background:#fff;border-radius:8px;padding:.3rem;cursor:pointer;font-size:.9rem}.pbx-dv button.on{background:#c8a24b;border-color:#c8a24b}
.pbx-f{margin-bottom:.7rem}.pbx-f>label{display:flex;align-items:center;gap:.3rem;font-size:.78rem;font-weight:800;color:#444;margin-bottom:.2rem}.pbx-f .dv{font-size:.7rem;opacity:.7}.pbx-f .rs{margin-inline-start:auto;border:0;background:none;cursor:pointer;color:#b83232;font-size:.8rem}
.pbx-f input[type=text],.pbx-f input[type=number],.pbx-f input[type=datetime-local],.pbx-f select,.pbx-f textarea{width:100%;border:1.5px solid #e0d9c8;border-radius:8px;padding:.4rem .5rem;font-family:inherit;font-size:.85rem;background:#fff}
.pbx-f textarea{min-height:70px;resize:vertical}.pbx-f .inh{background:#f7f5ee}
.pbx-f input[type=color]{width:46px;height:30px;padding:0;border:1.5px solid #e0d9c8;border-radius:6px;vertical-align:middle}
.pbx-row{display:flex;gap:.4rem;align-items:center}.pbx-row>*{flex:1}.pbx-row>.sm{flex:0 0 auto}
.pbx-al{display:flex;gap:.3rem}.pbx-al button{flex:1;border:1.5px solid #e0d9c8;background:#fff;border-radius:8px;padding:.3rem;cursor:pointer;font-family:inherit;font-size:.75rem}.pbx-al button.on{background:#173f35;color:#fff;border-color:#173f35}
.pbx-dims{display:grid;grid-template-columns:repeat(4,1fr);gap:.3rem}.pbx-dims input{text-align:center;padding:.3rem!important}.pbx-dims small{display:block;text-align:center;font-size:.65rem;color:#888}
.pbx-rep{border:1.5px dashed #e0d9c8;border-radius:10px;padding:.5rem;margin-bottom:.4rem}
.pbx-cp{display:flex;gap:.3rem;align-items:center;flex-wrap:wrap;margin-bottom:.6rem;font-size:.75rem;color:#666}.pbx-cp select{flex:1;min-width:90px;border:1.5px solid #e0d9c8;border-radius:8px;padding:.25rem;font-family:inherit;font-size:.75rem}
.pbx-small{border:1.5px solid #e0d9c8;background:#fff;border-radius:8px;padding:.3rem .6rem;cursor:pointer;font-weight:800;font-family:inherit;font-size:.78rem}
.pbx-lay{font-size:.82rem}.pbx-lay div{padding:.28rem .4rem;border-radius:6px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pbx-lay div:hover{background:#f4efe6}.pbx-lay div.on{background:#173f35;color:#fff}
.pbx-msg{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#173f35;color:#fff;padding:.6rem 1.2rem;border-radius:10px;font-weight:800;z-index:10002;display:none}
@media(max-width:1100px){.pbx-left{width:200px}.pbx-right{width:260px}.pbx-rz{display:none}}`;

  const toast = m => { const t = $("pbx-msg"); if (!t) return; t.textContent = m; t.style.display = "block"; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = "none", 3500); };

  /* ───────────────── بنية الواجهة ───────────────── */
  function build() {
    if (built) return; built = true;
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const d = document.createElement("div"); d.id = "pb-app";
    d.innerHTML = `
<div class="pbx-top">
  <button onclick="PBApp.close()" title="إغلاق المحرر">✕ إغلاق</button>
  <input id="pbx-title" placeholder="عنوان الصفحة" oninput="PBApp.meta('title',this.value)">
  <span id="pbx-url" dir="ltr" style="font-size:.78rem;opacity:.8"></span>
  <span class="sp"></span>
  <span class="pbx-dirty" id="pbx-dirty"></span>
  <button data-dv="d" onclick="PBApp.setDev('d')" title="المكتب">🖥️ المكتب</button>
  <button data-dv="t" onclick="PBApp.setDev('t')" title="التابلت">📱 تابلت</button>
  <button data-dv="m" onclick="PBApp.setDev('m')" title="الهاتف">📲 هاتف</button>
  <button id="pbx-snap" onclick="PBApp.toggleSnap()" title="الالتصاق بحواف العناصر الأخرى والمنتصف (اضغط Alt أثناء السحب لتعطيله مؤقتاً)">🧲 التصاق</button>
  <button id="pbx-undo" onclick="PBApp.undo()" title="تراجع (Ctrl+Z)">↶</button>
  <button id="pbx-redo" onclick="PBApp.redo()" title="إعادة (Ctrl+Y)">↷</button>
  <button onclick="PBApp.preview()">👁️ معاينة</button>
  <button class="pub" onclick="PBApp.publish()">🚀 حفظ ونشر</button>
</div>
<div class="pbx-main">
  <aside class="pbx-left">
    <div class="pbx-tabs"><button data-lt="add" onclick="PBApp.ltab('add')">➕ عناصر</button><button data-lt="tpl" onclick="PBApp.ltab('tpl')">🧱 أقسام</button><button data-lt="lay" onclick="PBApp.ltab('lay')">📚 طبقات</button><button data-lt="pg" onclick="PBApp.ltab('pg')">⚙️ الصفحة</button></div>
    <div class="pbx-pane" id="pbx-lpane"></div>
  </aside>
  <div class="pbx-stage" id="pbx-stage">
    <div class="pbx-sc" id="pbx-sc"><div class="pbx-fw" id="pbx-fw"><iframe id="pbx-frame" title="القماش"></iframe></div></div>
    <button class="pbx-add" onclick="PBApp.ltab('tpl')">＋ إضافة قسم جديد</button>
    <div id="pbx-ovl"></div>
  </div>
  <div class="pbx-rz" id="pbx-rz" title="اسحب لتوسيع الشريط الجانبي (نقر مزدوج = الافتراضي)"></div>
  <aside class="pbx-right" id="pbx-insp"></aside>
</div>
<div class="pbx-msg" id="pbx-msg"></div>`;
    document.body.appendChild(d);
    frame = $("pbx-frame");
    frame.srcdoc = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style id="pbs"></style></head><body class="pb-page pb-edit"><div id="pbr"></div></body></html>`;
    frame.addEventListener("load", () => { fdoc = frame.contentDocument; root = fdoc.getElementById("pbr"); styleEl = fdoc.getElementById("pbs"); wireFrame(); if (E.page) renderCanvas(); });
    $("pbx-stage").addEventListener("scroll", () => positionOverlay());
    const lp = $("pbx-lpane"); let layDrag = null;
    lp.addEventListener("dragstart", e => { const it = e.target.closest("[data-lay]"); if (it) { layDrag = it.dataset.lay; e.dataTransfer.setData("text/plain", "lay"); } });
    lp.addEventListener("dragover", e => { if (layDrag && e.target.closest("[data-lay]")) e.preventDefault(); });
    lp.addEventListener("drop", e => { const it = e.target.closest("[data-lay]"); if (!layDrag || !it) return; e.preventDefault(); layerReorder(layDrag, it.dataset.lay); layDrag = null; });
    new ResizeObserver(() => { fitStage(); positionOverlay(); }).observe($("pbx-stage"));
    window.addEventListener("resize", () => { if ($("pb-app").classList.contains("on")) { fitStage(); positionOverlay(); } });
    wireResizer();
    $("pbx-insp").addEventListener("input", onInspInput); $("pbx-insp").addEventListener("change", onInspChange); $("pbx-insp").addEventListener("click", onInspClick);
    document.addEventListener("keydown", onKey);
  }

  /* ───────────────── فتح/إغلاق ───────────────── */
  function open(page, slug, isNew) {
    build();
    E.page = PB.migrate(clone(page)); E.sl = {}; E.slug = slug || ""; E.isNew = !!isNew; E.sel = null; E.dev = "d"; E.hist = []; E.hi = -1; E.dirty = false; E.tab = "c"; E.ltab = "add";
    $("pb-app").classList.add("on"); document.body.style.overflow = "hidden";
    $("pbx-title").value = E.page.title || ""; commitHist(true);
    ltab("add"); setDev("d"); renderInspector(); updateTop();
    if (fdoc) renderCanvas();
  }
  function close() {
    if (E.dirty && !confirm("هناك تعديلات غير منشورة. إغلاق المحرر وفقدانها؟")) return;
    $("pb-app").classList.remove("on"); document.body.style.overflow = "";
    if (window.PBAdmin) PBAdmin.refresh();
  }

  /* ───────────────── البحث في النموذج ───────────────── */
  function find(id) {
    const P = E.page;
    for (let si = 0; si < P.sections.length; si++) {
      const sec = P.sections[si]; if (sec.id === id) return { kind: "section", node: sec, set: sec.set, list: P.sections, idx: si, sec, def: null };
      const fr = sec.free || [];
      for (let wi = 0; wi < fr.length; wi++) { const w = fr[wi]; if (w.id === id) return { kind: "widget", node: w, set: w.set, list: fr, idx: wi, sec, col: null, free: true, def: WIDGETS[w.type] }; }
      for (let ci = 0; ci < sec.cols.length; ci++) {
        const col = sec.cols[ci]; if (col.id === id) return { kind: "column", node: col, set: col.set, list: sec.cols, idx: ci, sec, col };
        for (let wi = 0; wi < col.widgets.length; wi++) { const w = col.widgets[wi]; if (w.id === id) return { kind: "widget", node: w, set: w.set, list: col.widgets, idx: wi, sec, col, def: WIDGETS[w.type] }; }
      }
    }
    return null;
  }
  const selInfo = () => E.sel ? find(E.sel) : null;

  /* ───────────────── التاريخ (تراجع/إعادة) ───────────────── */
  function commitHist(first) {
    const snap = JSON.stringify(E.page);
    if (!first && E.hist[E.hi] === snap) return;
    E.hist = E.hist.slice(0, E.hi + 1); E.hist.push(snap); if (E.hist.length > 80) E.hist.shift(); E.hi = E.hist.length - 1;
    if (!first) { E.dirty = true; clearTimeout(saveT); saveT = setTimeout(saveDraft, 800); }
    updateTop();
  }
  function undo() { if (E.hi <= 0) return; E.hi--; E.page = JSON.parse(E.hist[E.hi]); E.dirty = true; afterHist(); }
  function redo() { if (E.hi >= E.hist.length - 1) return; E.hi++; E.page = JSON.parse(E.hist[E.hi]); E.dirty = true; afterHist(); }
  function afterHist() { if (E.sel && !find(E.sel)) E.sel = null; renderCanvas(); renderInspector(); renderLeft(); updateTop(); }
  const draftKey = () => "pb_draft_" + (E.slug || "new");
  function saveDraft() { try { localStorage.setItem(draftKey(), JSON.stringify(E.page)); } catch (e) { } }
  function updateTop() {
    $("pbx-undo").disabled = E.hi <= 0; $("pbx-redo").disabled = E.hi >= E.hist.length - 1;
    $("pbx-dirty").textContent = E.dirty ? "● تعديلات غير منشورة" : "";
    document.querySelectorAll("[data-dv]").forEach(b => b.classList.toggle("on", b.dataset.dv === E.dev)); const sn = $("pbx-snap"); if (sn) sn.classList.toggle("on", E.snap);
    $("pbx-url").textContent = E.page && E.page.slug ? "/lp/" + E.page.slug + "/" : "";
  }
  function meta(k, v) { E.page[k] = v; if (k === "title" && E.isNew && !E.slugTouched) { E.page.slug = slugify(v); } E.dirty = true; clearTimeout(saveT); saveT = setTimeout(() => { commitHist(); saveDraft(); }, 600); if (k === "title") { updateTop(); if (E.ltab === "pg") { const s = $("pg-slug"); if (s && E.isNew && !E.slugTouched) s.value = E.page.slug; } } else renderCanvas(); }
  const slugify = t => String(t || "").toLowerCase().trim().replace(/[^a-z0-9؀-ۿ]+/g, "-").replace(/[؀-ۿ]+/g, "").replace(/^-+|-+$/g, "") || "page-" + Date.now().toString(36).slice(-4);

  /* ───────────────── اللوحة اليسرى ───────────────── */
  function ltab(t) { E.ltab = t; renderLeft(); }
  function renderLeft() {
    const pane = $("pbx-lpane"); if (!pane) return;
    document.querySelectorAll("[data-lt]").forEach(b => b.classList.toggle("on", b.dataset.lt === E.ltab));
    if (E.ltab === "add") {
      pane.innerHTML = `<div class="pbx-grid">${ORDER.map(t => `<div class="pbx-wi" draggable="true" data-add="${t}" title="اسحبه إلى الصفحة أو انقر لإضافته"><i>${WIDGETS[t].ic}</i>${WIDGETS[t].label}</div>`).join("")}</div><p style="font-size:.75rem;color:#888;margin-top:.8rem;line-height:1.7">اسحب العنصر إلى الصفحة، أو انقر عليه لإضافته إلى العمود المحدد. انقر مرتين على أي نص في الصفحة لتعديله مباشرة.</p>`;
    } else if (E.ltab === "tpl") {
      pane.innerHTML = `<div class="pbx-gb"><b>▦ قسم شبكي مخصص</b><div class="pbx-row" style="margin:.4rem 0"><label style="font-size:.8rem">صفوف <input id="gb-r" type="number" min="1" max="10" value="2"></label><label style="font-size:.8rem">أعمدة <input id="gb-c" type="number" min="1" max="12" value="3"></label></div><button class="pbx-small" data-grid="1" type="button">＋ إضافة القسم الشبكي</button></div>` + Object.keys(TPLS).map(k => `<button class="pbx-tpl" draggable="true" data-tpl="${k}">${TPLS[k].n}</button>`).join("") + `<button class="pbx-tpl" data-tpl="_blank" style="background:#fff">▭ قسم فارغ (عمود واحد)</button><button class="pbx-tpl" data-tpl="_two" style="background:#fff">▭▭ قسم بعمودين</button><button class="pbx-tpl" data-tpl="_three" style="background:#fff">▭▭▭ قسم بثلاثة أعمدة</button>`;
    } else if (E.ltab === "lay") {
      let h = "";
      E.page.sections.forEach((sec, i) => {
        h += `<div data-sel="${sec.id}" class="${E.sel === sec.id ? "on" : ""}">▤ قسم ${i + 1}</div>`;
        const fz = (sec.free || []).slice().sort((a, b) => (Number(b.set.zi) || 0) - (Number(a.set.zi) || 0));
        if (fz.length) { h += `<div style="margin-inline-start:14px;color:#8a8472;font-size:.72rem;cursor:default">طبقات حرة — اسحب لتغيير الأمام/الخلف (الأعلى = الأمام)</div>` + fz.map(w => `<div draggable="true" data-lay="${w.id}" data-sel="${w.id}" class="${E.sel === w.id ? "on" : ""}" style="margin-inline-start:28px">⠿ ${WIDGETS[w.type].ic} ${WIDGETS[w.type].label}</div>`).join(""); }
        sec.cols.forEach((col, j) => { if (sec.set.kind === "canvas") return; h += `<div data-sel="${col.id}" class="${E.sel === col.id ? "on" : ""}" style="margin-inline-start:14px">▯ عمود ${j + 1}</div>`; col.widgets.forEach(w => { h += `<div data-sel="${w.id}" class="${E.sel === w.id ? "on" : ""}" style="margin-inline-start:28px">${WIDGETS[w.type].ic} ${WIDGETS[w.type].label}</div>`; }); });
      });
      pane.innerHTML = `<div class="pbx-lay">${h}</div>`;
    } else {
      const P = E.page;
      pane.innerHTML = `
<div class="pbx-f"><label>عنوان الصفحة (SEO)</label><input type="text" value="${esc(P.title)}" oninput="PBApp.meta('title',this.value);document.getElementById('pbx-title').value=this.value"></div>
<div class="pbx-f"><label>الرابط (slug) — حروف لاتينية وأرقام وشرطات</label><input type="text" dir="ltr" id="pg-slug" value="${esc(P.slug)}" ${E.isNew ? "" : "disabled"} oninput="PBApp.slugEdit(this.value)"><small style="color:#888">${E.isNew ? "سيكون: /lp/…/" : "لا يتغير بعد النشر"}</small></div>
<div class="pbx-f"><label>وصف الصفحة (SEO)</label><textarea oninput="PBApp.meta('desc',this.value)">${esc(P.desc)}</textarea></div>
<div class="pbx-f"><label>لون خلفية الصفحة</label><input type="color" value="${esc(P.bg || "#ffffff")}" oninput="PBApp.meta('bg',this.value)"></div>
<div class="pbx-f"><label>الخط</label><select onchange="PBApp.meta('ff',this.value)">${[["", "الافتراضي (Cairo)"], ["Georgia,'Times New Roman',serif", "Serif"], ["system-ui,sans-serif", "System"]].map(o => `<option value="${esc(o[0])}"${P.ff === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select></div>
<div class="pbx-f"><label><input type="checkbox" ${P.header ? "checked" : ""} onchange="PBApp.meta('header',this.checked);PBApp.renderCanvas()"> ترويسة بسيطة (الشعار + واتساب)</label></div>
<div class="pbx-f"><label><input type="checkbox" ${P.footer ? "checked" : ""} onchange="PBApp.meta('footer',this.checked)"> تذييل بسيط</label></div>
<div class="pbx-f"><label>CSS مخصص للصفحة كلها</label><textarea dir="ltr" oninput="PBApp.meta('css',this.value)">${esc(P.css)}</textarea></div>`;
    }
  }
  function slugEdit(v) { E.slugTouched = true; E.page.slug = String(v).toLowerCase().replace(/[^a-z0-9-]/g, ""); E.dirty = true; updateTop(); }

  /* ───────────────── القماش ───────────────── */
  function ctx() { const A = (typeof Admin !== "undefined") ? Admin : {}; return { base: "", edit: true, products: A.products || [], wa: (typeof SITE_CFG !== "undefined" && SITE_CFG.waNumber) || "", meta: { tabs: A.collections || [], cats: A.categories || {} }, sl: E.sl }; }
  function renderCanvas() {
    if (!fdoc || !root || !E.page) return;
    const r = PB.renderSections(E.page, ctx());
    const sc = fdoc.scrollingElement ? fdoc.scrollingElement.scrollTop : 0;
    styleEl.textContent = PB.BASE_CSS + EDIT_CSS + `\n.pb-page{background:${E.page.bg || "#fff"}${E.page.ff ? ";font-family:" + E.page.ff : ""}}\n` + r.css + "\n" + (E.page.css || "");
    root.innerHTML = r.html;
    fixCountdown();
    if (fdoc.scrollingElement) fdoc.scrollingElement.scrollTop = sc;
    fitStage(); positionOverlay();
  }
  function fixCountdown() { root.querySelectorAll(".pb-cd").forEach(el => { const v = { d: "00", h: "23", m: "59", s: "59" }; for (const k in v) { const b = el.querySelector(`[data-u=${k}]`); if (b) b.textContent = v[k]; } }); }
  function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(renderCanvas); }
  function setDev(d) {
    E.dev = d; updateTop(); fitStage();
    if (E.sel) renderInspector(); renderCanvasHeight();
    setTimeout(positionOverlay, 30);
  }
  function fitStage() {
    const st = $("pbx-stage"), sc = $("pbx-sc"), fw = $("pbx-fw"); if (!st || !sc || !fw) return;
    const w = DEVW[E.dev], s = Math.min(1, Math.max(300, st.clientWidth - 36) / w); E.scale = s;
    const h = Math.max(500, (root ? root.offsetHeight : 0) + 40);
    fw.style.width = w + "px"; fw.style.height = h + "px"; fw.style.transform = `scale(${s})`; frame.style.height = h + "px";
    sc.style.width = (w * s) + "px"; sc.style.height = (h * s) + "px";
  }
  const renderCanvasHeight = () => fitStage();

  /* ───────────────── الأحداث داخل القماش ───────────────── */
  function wireFrame() {
    fdoc.addEventListener("click", e => {
      if (e.target.closest("[contenteditable=true]")) return;
      const a = e.target.closest("a"); if (a) e.preventDefault();
      const sa = e.target.closest(".pb-sl-a, .pb-sl-dots i");
      if (sa) {
        e.preventDefault(); const wEl = sa.closest('[data-kind="widget"]'), inf = find(wEl.dataset.pb), L = ((inf && inf.set.items) || []).length || 1; let i = E.sl[wEl.dataset.pb] || 0;
        if (sa.classList.contains("pv")) i--; else if (sa.classList.contains("nx")) i++; else i = [...sa.parentNode.children].indexOf(sa);
        E.sl[wEl.dataset.pb] = (i + L) % L; select(wEl.dataset.pb); renderCanvas(); return;
      }
      const el = e.target.closest("[data-pb]"); if (el) { const w = e.target.closest('[data-kind="widget"]'); select((w || el).dataset.pb); } else select(null);
    }, true);
    fdoc.addEventListener("mousedown", e => {
      if (e.button !== 0 || e.target.closest("[contenteditable=true]")) return;
      const wEl = e.target.closest('[data-kind="widget"]'); if (!wEl) return;
      const cap = e.target.closest(".pb-sl-cap:not(.below)");
      if (cap && E.sel === wEl.dataset.pb) { e.preventDefault(); return startCapDrag(e, cap, wEl); }
      { const i0 = find(wEl.dataset.pb); if (i0 && E.dev === "m" && i0.sec.set.kind !== "canvas" && (wEl.dataset.free ? PB.autoFlowFree(i0.sec) : true)) { if (E.sel !== wEl.dataset.pb) select(wEl.dataset.pb); if (!E.mToast) { E.mToast = 1; toast("📱 في الهاتف تُرتَّب العناصر تلقائياً داخل الأقسام العادية — حرّكها من عرض سطح المكتب أو استعمل إعدادات الشريط الجانبي"); } return; } }
      if (wEl.dataset.free && !e.target.closest("input,select,textarea,.pb-sl-a,.pb-sl-dots")) {
        if (E.sel !== wEl.dataset.pb) select(wEl.dataset.pb);
        e.preventDefault(); let inf = find(wEl.dataset.pb); if (inf && e.altKey) { dup(); inf = selInfo(); } if (inf) startMove(e, inf, false, e.altKey);
      } else if (!wEl.dataset.free && !e.target.closest("input,select,textarea,.pb-sl-a,.pb-sl-dots,button,.pb-fz")) {
        if (E.sel !== wEl.dataset.pb) select(wEl.dataset.pb);
        e.preventDefault(); let inf = find(wEl.dataset.pb); if (inf && e.altKey) { dup(); inf = selInfo(); } if (inf) startMove(e, inf, true, e.altKey);      // السحب يحوّل العنصر إلى حر عند أول حركة
      }
    }, true);
    fdoc.addEventListener("dblclick", e => {
      const ed = e.target.closest("[data-edit]"); if (ed) return startEdit(ed);
      const wEl = e.target.closest('[data-kind="widget"]'); if (!wEl) return;
      const inf = find(wEl.dataset.pb); if (inf && ["image", "slider", "gallery"].includes(inf.node.type)) uploadFor(inf);
    });
    fdoc.addEventListener("dragover", onDragOver); fdoc.addEventListener("drop", onDrop); fdoc.addEventListener("dragleave", e => { if (!e.relatedTarget) hideDrop(); });
    fdoc.addEventListener("keydown", onKey);
    fdoc.defaultView.addEventListener("scroll", () => positionOverlay());
    new ResizeObserver(() => { fitStage(); positionOverlay(); }).observe(root);
  }

  /* ───────────────── تحرير النص المباشر ───────────────── */
  let editing = null;
  function startEdit(el) {
    const wEl = el.closest('[data-kind="widget"]'); if (!wEl) return;
    select(wEl.dataset.pb);
    const field = el.dataset.edit, rich = field === "html"; editing = { el, id: wEl.dataset.pb, field, rich, idx: el.dataset.idx };
    el.setAttribute("contenteditable", "true"); el.focus();
    const r = fdoc.createRange(); r.selectNodeContents(el); const sl = fdoc.defaultView.getSelection(); sl.removeAllRanges(); sl.addRange(r);
    if (rich) showRt(true);
    el.addEventListener("blur", endEdit, { once: true });
    el.addEventListener("keydown", ev => { if (!rich && ev.key === "Enter") { ev.preventDefault(); el.blur(); } if (ev.key === "Escape") el.blur(); });
  }
  function endEdit() {
    if (!editing) return; const { el, id, field, rich, idx } = editing; editing = null; showRt(false);
    el.removeAttribute("contenteditable");
    const inf = find(id), val = rich ? PB.cleanHtml(el.innerHTML) : el.textContent.replace(/\s+/g, " ").trim();
    if (inf) { if (field === "cap") { const it = (inf.set.items || [])[Number(idx)]; if (it) it.title = val; } else inf.set[field] = val; commitHist(); }
    renderCanvas(); renderInspector();
  }
  function showRt(on) {
    let rt = $("pbx-rt");
    if (!rt) { rt = document.createElement("div"); rt.id = "pbx-rt"; rt.className = "pbx-rt";
      rt.innerHTML = `<button data-c="bold"><b>B</b></button><button data-c="italic"><i>I</i></button><button data-c="underline"><u>U</u></button><button data-c="insertUnorderedList">• قائمة</button><button data-c="createLink">🔗</button><button data-c="removeFormat">✕ تنسيق</button><input type="color" data-c="foreColor" title="لون النص">`;
      rt.addEventListener("mousedown", e => { if (e.target.tagName !== "INPUT") e.preventDefault(); });
      rt.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; let v = null; if (b.dataset.c === "createLink") { v = prompt("الرابط:", "https://"); if (!v) return; } fdoc.execCommand(b.dataset.c, false, v); });
      rt.addEventListener("input", e => { if (e.target.dataset.c) fdoc.execCommand(e.target.dataset.c, false, e.target.value); });
      $("pbx-stage").appendChild(rt); }
    rt.style.display = on ? "flex" : "none";
    if (on && editing) { const r = editing.el.getBoundingClientRect(), s = E.scale, fr = $("pbx-fw").getBoundingClientRect(), st = $("pbx-stage").getBoundingClientRect(); rt.style.top = (fr.top - st.top + $("pbx-stage").scrollTop + r.top * s - 40) + "px"; rt.style.left = Math.max(4, fr.left - st.left + r.left * s) + "px"; }
  }

  /* ───────────────── التحديد + الغطاء (Overlay) ───────────────── */
  function select(id) {
    if (editing) { try { editing.el.blur(); } catch (e) { } }
    E.sel = id; renderInspector(); positionOverlay(); if (E.ltab === "lay") renderLeft();
  }
  const mkShield = cur => { const d = document.createElement("div"); d.style.cssText = "position:fixed;inset:0;z-index:10001;cursor:" + cur; document.body.appendChild(d); return d; };   // يلتقط الحركة فوق الـ iframe
  /* تتبّع سحب موحّد: يعمل لمن بدأ داخل الـ iframe (Chrome يوصل الأحداث للإطار الذي بدأ فيه الضغط) أو من اللوحة؛ الإزاحة تُعاد بوحدات بكسل الصفحة */
  function dragTrack(e, cursor, onMove, onEnd) {
    const s = E.scale, inF = ev => ev.target && ev.target.ownerDocument === fdoc, f0 = $("pbx-fw").getBoundingClientRect();
    const P = ev => inF(ev) ? { x: f0.left + ev.clientX * s, y: f0.top + ev.clientY * s } : { x: ev.clientX, y: ev.clientY };
    const p0 = P(e), shield = inF(e) ? null : mkShield(cursor);
    const mv = ev => { const p = P(ev); onMove((p.x - p0.x) / s, (p.y - p0.y) / s, ev); };
    const up = ev => { [document, fdoc].forEach(d => { d.removeEventListener("mousemove", mv, true); d.removeEventListener("mouseup", up, true); }); if (shield) shield.remove(); onEnd(ev); };
    [document, fdoc].forEach(d => { d.addEventListener("mousemove", mv, true); d.addEventListener("mouseup", up, true); });
  }
  function ovlOrigin() { const st = $("pbx-stage"), fw = $("pbx-fw"), fr = fw.getBoundingClientRect(), sr = st.getBoundingClientRect(); return { ox: fr.left - sr.left + st.scrollLeft, oy: fr.top - sr.top + st.scrollTop, s: E.scale }; }
  function drawGuides(list, cr) {
    document.querySelectorAll(".pbx-guide").forEach(g => g.remove()); if (!list || !list.length) return;
    const o = ovlOrigin(), ovl = $("pbx-ovl");
    list.forEach(g => { const d = document.createElement("div"); d.className = "pbx-guide";
      if (g.x != null) d.style.cssText = `left:${o.ox + (cr.left + g.x) * o.s}px;top:${o.oy + cr.top * o.s}px;width:1px;height:${cr.height * o.s}px`;
      else d.style.cssText = `top:${o.oy + (cr.top + g.y) * o.s}px;left:${o.ox + cr.left * o.s}px;height:1px;width:${cr.width * o.s}px`;
      ovl.appendChild(d); });
  }
  /* نقاط الالتصاق (بكسل نسبة لحاوية القسم): الحواف والمنتصف + حواف ومنتصفات العناصر الحرة الأخرى */
  function snapPts(inf, cont) {
    const cr = cont.getBoundingClientRect(), xs = [0, cr.width / 2, cr.width], ys = [0, cr.height / 2, cr.height];
    (inf.sec.free || []).forEach(w => { if (w.id === inf.node.id) return; const el = fdoc.querySelector(`[data-pb="${w.id}"]`); if (!el) return; const r = el.getBoundingClientRect(), l = r.left - cr.left, t = r.top - cr.top; xs.push(l, l + r.width / 2, l + r.width); ys.push(t, t + r.height / 2, t + r.height); });
    return { xs, ys, cr };
  }
  function snapBox(x, y, w, h, pts) {
    const T = 7; let bx = x, by = y, bX = T + 1, bY = T + 1, gx = null, gy = null;
    [[x, 0], [x + w / 2, w / 2], [x + w, w]].forEach(([v, off]) => pts.xs.forEach(p => { const d = Math.abs(v - p); if (d < bX) { bX = d; bx = p - off; gx = p; } }));
    [[y, 0], [y + h / 2, h / 2], [y + h, h]].forEach(([v, off]) => pts.ys.forEach(p => { const d = Math.abs(v - p); if (d < bY) { bY = d; by = p - off; gy = p; } }));
    const g = []; if (gx != null) g.push({ x: gx }); if (gy != null) g.push({ y: gy }); return { x: bx, y: by, guides: g };
  }
  const snapEdge = (v, list) => { let b = v, bd = 8, g = null; list.forEach(p => { const d = Math.abs(v - p); if (d < bd) { bd = d; b = p; g = p; } }); return [b, g]; };

  function positionOverlay() {
    const ovl = $("pbx-ovl"); if (!ovl) return; ovl.innerHTML = "";
    if (!E.sel || !fdoc || !root) return; const inf = find(E.sel); if (!inf) return;
    const el = fdoc.querySelector(`[data-pb="${E.sel}"]`); if (!el) return;
    const r = el.getBoundingClientRect(), o = ovlOrigin(), s = o.s;
    const box = document.createElement("div"); box.className = "pbx-box " + inf.kind;
    box.style.cssText = `left:${o.ox + r.left * s}px;top:${o.oy + r.top * s}px;width:${r.width * s}px;height:${r.height * s}px`;
    const lbl = inf.kind === "widget" ? WIDGETS[inf.node.type].label + (inf.free ? " ✦" : "") : inf.kind === "column" ? "عمود" : "قسم" + ({ grid: " شبكي", canvas: " حر" }[inf.set.kind] || "");
    const bar = document.createElement("div"); bar.className = "pbx-bar"; bar.innerHTML = `<span>${lbl}</span>`;
    const btn = (t, tt, fn, drag, on) => { const b = document.createElement("button"); b.textContent = t; b.title = tt; if (on) b.className = "on"; if (drag) { b.draggable = true; b.addEventListener("dragstart", e => { E.drag = { move: inf.node.id }; e.dataTransfer.setData("text/plain", "pb"); e.dataTransfer.effectAllowed = "move"; }); b.addEventListener("dragend", hideDrop); } else b.onclick = e => { e.stopPropagation(); fn(); }; bar.appendChild(b); };
    const colorIn = (key, tt, ic) => { const w = document.createElement("label"); w.title = tt; w.style.cssText = "background:inherit;display:flex;align-items:center;gap:2px;color:#fff;font-size:.72rem;padding:.12rem .3rem;cursor:pointer;background:inherit"; const i = document.createElement("input"); i.type = "color"; i.value = /^#[0-9a-f]{6}$/i.test(inf.set[key] || "") ? inf.set[key] : "#ffffff";
      i.oninput = () => { inf.set[key] = i.value; schedule(); }; i.onchange = () => { commitHist(); renderInspector(); }; w.append(ic, i); bar.appendChild(w); };
    const has = k => inf.kind === "widget" && (inf.def.ctl || []).some(c => c.k === k);
    if (inf.kind === "widget") { if (has("color")) colorIn("color", "لون النص", "🔤"); if (has("bgc")) colorIn("bgc", "لون الزر", "🎨"); else colorIn("bg", "لون الخلفية", "🎨"); }
    else colorIn("bg", "لون الخلفية", "🎨");
    btn("⧉", "تكرار", dup); btn("🗑", "حذف", del);
    box.appendChild(bar);
    const dirs = inf.kind === "widget" ? ["n", "s", "e", "w", "ne", "nw", "se", "sw"] : ["n", "s", "e", "w"];
    dirs.forEach(d => { const h = document.createElement("div"); h.className = "pbx-h d-" + d; h.title = "اسحب لتغيير الحجم"; h.onmousedown = ev => startResize(ev, d, inf); box.appendChild(h); });
    ovl.appendChild(box);
  }

  /* ───────────────── تغيير الحجم من كل الاتجاهات ───────────────── */
  function startResize(e, dir, inf) {
    e.preventDefault(); e.stopPropagation(); if (inf.kind === "widget" && inf.free) ensureMobile(inf.sec);
    const el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), s = E.scale, dev = E.dev, r0 = el.getBoundingClientRect(), set = inf.set;
    const hasW = dir.includes("e") || dir.includes("w"), hasH = dir.includes("n") || dir.includes("s"), free = inf.kind === "widget" && inf.free;
    const cursor = dir.length === 1 ? (hasW ? "ew-resize" : "ns-resize") : (dir === "nw" || dir === "se" ? "nwse-resize" : "nesw-resize");
    const tip = document.createElement("div"); tip.className = "pbx-tip"; $("pbx-ovl").appendChild(tip);
    const cont = el.closest(".pb-in") || el.querySelector(".pb-in"), pts = free ? snapPts(inf, cont) : null, cr = free ? pts.cr : null;
    const parentW = el.parentElement ? el.parentElement.getBoundingClientRect().width : r0.width;
    const gridCell = inf.kind === "column" && inf.sec.set.kind === "grid";
    const m0 = ((own(set, "mar", dev) || eff(set, "mar", dev)) || [0, 0, 0, 0]).slice();
    let nb = null, pair = 0;
    if (inf.kind === "column" && hasW && !gridCell) { const sibs = inf.sec.cols, nbn = dir.includes("w") ? (sibs[inf.idx + 1] || sibs[inf.idx - 1]) : (sibs[inf.idx - 1] || sibs[inf.idx + 1]); if (nbn && eff(nbn.set, "w", dev) != null && eff(set, "w", dev) != null) { nb = nbn; pair = Number(eff(set, "w", dev)) + Number(eff(nbn.set, "w", dev)); } }
    const mv = (dx, dy, ev) => {
      let label = "", guides = [];
      if (free) {
        let L = r0.left - cr.left, T = r0.top - cr.top, R = L + r0.width, B = T + r0.height; const W0 = r0.width, H0 = r0.height, snap = E.snap && !ev.altKey;
        if (dir.includes("e")) R += dx; if (dir.includes("w")) L += dx; if (dir.includes("s")) B += dy; if (dir.includes("n")) T += dy;
        if (hasW && hasH && ev.shiftKey) { let w = R - L, h = B - T; if (Math.abs(dx) > Math.abs(dy)) h = w * H0 / W0; else w = h * W0 / H0; if (dir.includes("w")) L = R - w; else R = L + w; if (dir.includes("n")) T = B - h; else B = T + h; }
        else if (snap) { let g; if (dir.includes("e")) { [R, g] = snapEdge(R, pts.xs); if (g != null) guides.push({ x: g }); } if (dir.includes("w")) { [L, g] = snapEdge(L, pts.xs); if (g != null) guides.push({ x: g }); } if (dir.includes("s")) { [B, g] = snapEdge(B, pts.ys); if (g != null) guides.push({ y: g }); } if (dir.includes("n")) { [T, g] = snapEdge(T, pts.ys); if (g != null) guides.push({ y: g }); } }
        if (R - L < 24) { if (dir.includes("w")) L = R - 24; else R = L + 24; } if (B - T < 14) { if (dir.includes("n")) T = B - 14; else B = T + 14; }
        setR(set, "fx", dev, Math.round(L / cr.width * 1000) / 10); setR(set, "fwd", dev, Math.round((R - L) / cr.width * 1000) / 10); setR(set, "fy", dev, Math.round(T / uOf(inf.sec, cr))); setR(set, "fh", dev, Math.round((B - T) / uOf(inf.sec, cr)));
        if (dev !== "d") ["fx", "fwd", "fy", "fh"].forEach(k => { if (own(set, k, "d") === undefined) setR(set, k, "d", eff(set, k, dev)); });
        label = Math.round((R - L)) + "×" + Math.round(B - T);
      } else if (inf.kind === "widget") {
        const al = eff(set, "al", dev);
        if (hasW) { let W = r0.width; if (al === "center") W += (dir.includes("e") ? 2 : -2) * dx; else { W += (dir.includes("e") ? 1 : -1) * dx; setR(set, "al", dev, dir.includes("e") ? "end" : "start"); } const pct = Math.max(5, Math.min(100, Math.round(W / parentW * 1000) / 10)); setR(set, "w", dev, pct); label = pct + "%"; }
        if (hasH) { let H = r0.height + (dir.includes("s") ? dy : -dy); H = Math.max(10, Math.round(H)); setR(set, "mh", dev, H); if (dir.includes("n")) { const m = m0.slice(); m[0] = (Number(m0[0]) || 0) + dy; setR(set, "mar", dev, m); } label += (label ? " × " : "") + H + "px"; }
      } else if (inf.kind === "column") {
        if (hasW && !gridCell) { const W = r0.width + (dir.includes("e") ? dx : -dx), pct = Math.max(5, Math.min(100, Math.round(W / parentW * 100))); setR(set, "w", dev, pct); if (nb) setR(nb.set, "w", dev, Math.max(5, Math.round((pair - pct) * 10) / 10)); label = pct + "%"; }
        if (hasH) { const H = Math.max(0, Math.round(r0.height + (dir.includes("s") ? dy : -dy))); setR(set, "mh", dev, H); label += (label ? " × " : "") + H + "px"; }
      } else {
        if (hasH) { const H = Math.max(40, Math.round(r0.height + (dir.includes("s") ? dy : -dy))); setR(set, "mh", dev, H); label = H + "px"; }
        if (hasW) { const inner = el.querySelector(".pb-in").getBoundingClientRect().width, W = Math.max(280, Math.round(inner + (dir.includes("e") ? 2 : -2) * dx)); set.layout = "boxed"; setR(set, "cw", dev, W); label += (label ? " × " : "") + "عرض " + W + "px"; }
      }
      tip.textContent = label; const st = $("pbx-stage").getBoundingClientRect(); tip.style.left = (ev.clientX - st.left + 14) + "px"; tip.style.top = (ev.clientY - st.top + 14) + "px";
      renderCanvas(); positionOverlay(); $("pbx-ovl").appendChild(tip); if (free) drawGuides(guides, pts.cr);
    };
    dragTrack(e, cursor, mv, () => { tip.remove(); document.querySelectorAll(".pbx-guide").forEach(g => g.remove()); commitHist(); renderInspector(); });
  }

  /* ───────────────── تحريك العنصر الحر (حر أو ملتصق) ───────────────── */
  function startMove(e, inf, lazy, copy) {
    const id = inf.node.id, dev = E.dev; if (!lazy) ensureMobile(inf.sec);
    const el = fdoc.querySelector(`[data-pb="${id}"]`), cont = el.closest(".pb-in"), r0 = el.getBoundingClientRect();
    let pts = lazy ? null : snapPts(inf, cont), cr = lazy ? cont.getBoundingClientRect() : pts.cr, conv = !lazy;
    const u = uOf(inf.sec, cr), X0 = r0.left - cr.left, Y0 = r0.top - cr.top; let moved = false, dropCol = null, ptr = null;
    const f0 = $("pbx-fw").getBoundingClientRect(), inF = e.target && e.target.ownerDocument === fdoc, px0 = inF ? e.clientX : (e.clientX - f0.left) / E.scale, py0 = inF ? e.clientY : (e.clientY - f0.top) / E.scale;
    const clearDrop = () => fdoc.querySelectorAll(".pbx-dropcol").forEach(c => c.classList.remove("pbx-dropcol"));
    const mv = (dx, dy, ev) => {
      if (!moved && Math.abs(dx) + Math.abs(dy) < (lazy ? 5 : 3)) return; moved = true;
      if (!conv) { conv = true; E.sel = id; toggleFree(); inf = find(id); ensureMobile(inf.sec); pts = snapPts(inf, fdoc.querySelector(`[data-pb="${id}"]`).closest(".pb-in")); cr = pts.cr; }
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }                       // Shift = حركة في محور واحد
      let X = X0 + dx, Y = Y0 + dy, guides = [];
      if (E.snap && (copy || !ev.altKey)) { const sn = snapBox(X, Y, r0.width, r0.height, pts); X = sn.x; Y = sn.y; guides = sn.guides; }
      setR(inf.set, "fx", dev, Math.round(X / cr.width * 1000) / 10); setR(inf.set, "fy", dev, Math.round(Y / u));
      if (dev !== "d") ["fx", "fy"].forEach(k => { if (own(inf.set, k, "d") === undefined) setR(inf.set, k, "d", eff(inf.set, k, dev)); });
      renderCanvas(); positionOverlay(); drawGuides(guides, pts.cr);
      ptr = { x: px0 + dx, y: py0 + dy }; const col = fdoc.elementsFromPoint(ptr.x, ptr.y).map(n => n.closest && n.closest(".pb-col[data-pb]")).find(Boolean);       // العمود تحت المؤشر
      clearDrop(); dropCol = col ? col.dataset.pb : null; if (col) { const ci = col.querySelector(".pb-colin"); if (ci) ci.classList.add("pbx-dropcol"); }
      const tp = document.createElement("div"); tp.className = "pbx-tip"; tp.textContent = col ? "اترك Ctrl مضغوطاً عند الإفلات لإدراجه داخل هذا العمود" : ""; if (col) { const st = $("pbx-stage").getBoundingClientRect(), pp = inF ? { x: f0.left + ev.clientX * E.scale, y: f0.top + ev.clientY * E.scale } : { x: ev.clientX, y: ev.clientY }; tp.style.left = (pp.x - st.left + 14) + "px"; tp.style.top = (pp.y - st.top + 14) + "px"; $("pbx-ovl").appendChild(tp); }
    };
    dragTrack(e, "move", mv, ev => {
      document.querySelectorAll(".pbx-guide").forEach(g => g.remove()); clearDrop();
      if (moved && dropCol && ev && (ev.ctrlKey || ev.metaKey)) {                                          // إفلات مع Ctrl: إدراج في العمود
        const me = find(id), tc = find(dropCol); if (me && tc && tc.kind === "column") {
          me.list.splice(me.idx, 1); ["fx", "fy", "fwd", "fh"].forEach(k => delete me.node.set[k]);
          const ws = tc.node.widgets, rects = ws.map(w => { const n = fdoc.querySelector(`[data-pb="${w.id}"]`); return n ? n.getBoundingClientRect() : null; });
          let at = ws.length; for (let i = 0; i < ws.length; i++) if (rects[i] && ptr && ptr.y < rects[i].top + rects[i].height / 2) { at = i; break; }
          ws.splice(at, 0, me.node); afterEdit(id); return;
        }
      }
      if (moved) { commitHist(); renderInspector(); }
    });
  }
  /* سحب عنوان شريحة السلايدر بحرية فوق الصورة */
  function startCapDrag(e, cap, wEl) {
    const inf = find(wEl.dataset.pb), it = inf && (inf.set.items || [])[Number(cap.dataset.idx)]; if (!it) return;
    const slide = cap.parentNode.getBoundingClientRect(), cx0 = num(it.cx) ?? 50, cy0 = num(it.cy) ?? 84; let moved = false;
    const mv = (dx, dy) => { if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return; moved = true; it.cx = Math.max(0, Math.min(100, Math.round((cx0 + dx / slide.width * 100) * 10) / 10)); it.cy = Math.max(0, Math.min(100, Math.round((cy0 + dy / slide.height * 100) * 10) / 10)); renderCanvas(); positionOverlay(); };
    dragTrack(e, "move", mv, () => { if (moved) commitHist(); });
  }

  /* ───────────────── عمليات على النموذج ───────────────── */
  function afterEdit(sel) { if (sel !== undefined) E.sel = sel; commitHist(); renderCanvas(); renderInspector(); renderLeft(); }
  function move(d) {
    const inf = selInfo(); if (!inf) return; const j = inf.idx + d;
    if (inf.kind === "widget" && inf.free) { zOrder(-d); return; }
    if (inf.kind === "widget" && (j < 0 || j >= inf.list.length)) { moveCol(d > 0 ? 1 : -1, true); return; }
    if (j < 0 || j >= inf.list.length) return; [inf.list[inf.idx], inf.list[j]] = [inf.list[j], inf.list[inf.idx]]; afterEdit();
  }
  function moveCol(dir, atEdge) {
    const inf = selInfo(); if (!inf || inf.kind !== "widget" || inf.free) return; const cols = inf.sec.cols, ci = cols.indexOf(inf.col);
    let to = ci + (dir || 1); if (to >= cols.length) to = 0; if (to < 0) to = cols.length - 1; if (to === ci) return;
    inf.list.splice(inf.idx, 1); const tgt = cols[to].widgets; if (atEdge && dir < 0) tgt.push(inf.node); else tgt.splice(atEdge ? 0 : tgt.length, 0, inf.node); afterEdit();
  }
  /* نسخ كل الإعدادات المتجاوبة (الموضع، الحجم، الخط، الهوامش...) من الجهاز الحالي إلى جهاز آخر */
  function copyDevice(to, scope) {
    const inf = selInfo(); let nodes = [];
    const walk = n => { nodes.push(n); (n.cols || []).forEach(walk); (n.widgets || []).forEach(walk); (n.free || []).forEach(walk); };
    if (scope === "all") E.page.sections.forEach(walk); else if (scope === "sec" && inf) walk(inf.sec); else if (inf) walk(inf.node); else return toast("اختر عنصراً أولاً");
    if (scope === "all" && !confirm("نسخ إعدادات " + DEVNAME[E.dev] + " إلى " + DEVNAME[to] + " لكل عناصر الصفحة؟ ستُستبدل إعدادات " + DEVNAME[to] + " الحالية لهذه الخصائص.")) return;
    let n = 0; nodes.forEach(nd => { Object.keys(nd.set || {}).forEach(k => { const v = nd.set[k]; if (isObj(v) && ("d" in v || "t" in v || "m" in v)) { const val = eff(nd.set, k, E.dev); if (val !== undefined) { setR(nd.set, k, to, clone(val)); n++; } } }); });
    afterEdit(); toast("📋 نُسخت " + n + " خاصية إلى " + DEVNAME[to]);
  }
  function reId(n) { n.id = uid(); (n.cols || []).forEach(reId); (n.widgets || []).forEach(reId); (n.free || []).forEach(reId); return n; }
  function dup() {
    const inf = selInfo(); if (!inf) return; const c = reId(clone(inf.node));
    if (inf.kind === "widget" && inf.free) { setR(c.set, "fx", E.dev, (Number(eff(c.set, "fx", E.dev)) || 0) + 3); setR(c.set, "fy", E.dev, (Number(eff(c.set, "fy", E.dev)) || 0) + 30); c.set.zi = (Number(c.set.zi) || 0) + 1; }
    inf.list.splice(inf.idx + 1, 0, c); afterEdit(c.id);
  }
  function del() { const inf = selInfo(); if (!inf) return; if (inf.kind === "column" && inf.sec.cols.length === 1) { toast("القسم يحتاج عموداً واحداً على الأقل — احذف القسم كله"); return; } inf.list.splice(inf.idx, 1); afterEdit(null); }
  function addCol(sec, at) { const c = PB.mkC([]); if (at == null) sec.cols.push(c); else sec.cols.splice(at, 0, c); if (sec.set.kind !== "grid") sec.cols.forEach(x => { if (x.set.w) delete x.set.w; }); afterEdit(c.id); }
  /* مرتبة الطبقات: أمام/خلف نسبةً لبقية عناصر القسم */
  function zOrder(dir) {
    const inf = selInfo(); if (!inf || inf.kind !== "widget") return;
    const sibs = inf.sec.cols.reduce((a, c) => a.concat(c.widgets), []).concat(inf.sec.free || []).filter(w => w !== inf.node), zs = sibs.map(w => Number(w.set.zi) || 0), cur = Number(inf.set.zi) || 0;
    inf.set.zi = dir > 0 ? Math.max(cur, ...(zs.length ? zs : [0])) + 1 : Math.min(cur, ...(zs.length ? zs : [0])) - 1; afterEdit();
  }
  /* إعادة ترتيب الطبقات بالسحب في اللوحة: العنصر المسحوب يوضع قبل (أمام) العنصر الهدف ثم تُعاد أرقام zi */
  function layerReorder(dragId, targetId) {
    const a = find(dragId), b = find(targetId); if (!a || !b || !a.free || !b.free || a.sec !== b.sec || dragId === targetId) return;
    const arr = a.sec.free.slice().sort((x, y) => (Number(y.set.zi) || 0) - (Number(x.set.zi) || 0)).filter(w => w.id !== dragId), at = arr.findIndex(w => w.id === targetId);
    arr.splice(at, 0, a.node); arr.forEach((w, i) => { w.set.zi = arr.length - i; }); afterEdit(dragId);
  }
  function alignFree(how) { const inf = selInfo(); if (!inf || !inf.free) return; const w = Number(eff(inf.set, "fwd", E.dev)) || 30; setR(inf.set, "fx", E.dev, Math.round((how === "left" ? 0 : how === "right" ? 100 - w : (100 - w) / 2) * 10) / 10); afterEdit(); }
  /* تحويل عنصر بين الوضع العادي (داخل عمود) والحر (موضع مطلق فوق القسم) */
  function toggleFree() {
    const inf = selInfo(); if (!inf || inf.kind !== "widget") return; const set = inf.node.set;
    if (inf.free && inf.sec.set.kind === "canvas") { toast("القسم الحر لا يحتوي أعمدة: انقل العنصر إلى قسم آخر بالسحب من الشريط ✥ بعد تحويله، أو أنشئ قسماً عادياً"); return; }
    if (inf.free) { inf.list.splice(inf.idx, 1); ["fx", "fy", "fwd", "fh"].forEach(k => delete set[k]); inf.sec.cols[0].widgets.push(inf.node); return afterEdit(inf.node.id); }
    const el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), cont = el.closest(".pb-in"), cr = cont.getBoundingClientRect(), r = el.getBoundingClientRect(), sec = inf.sec;
    inf.list.splice(inf.idx, 1); ["w", "mh", "al", "mar"].forEach(k => delete set[k]);
    const put = (k, v) => { setR(set, k, E.dev, v); if (E.dev !== "d" && own(set, k, "d") === undefined) setR(set, k, "d", v); };
    put("fx", Math.round((r.left - cr.left) / cr.width * 1000) / 10); const uu = uOf(sec, cr); put("fy", Math.round((r.top - cr.top) / uu)); put("fwd", Math.round(r.width / cr.width * 1000) / 10); put("fh", Math.round(r.height / uu));
    set.zi = Math.max(0, ...(sec.free || []).map(w => Number(w.set.zi) || 0)) + 1; (sec.free = sec.free || []).push(inf.node); afterEdit(inf.node.id);
  }
  /* تكييف الهاتف: التصميم الحر يُرتَّب تلقائياً عند العرض (PB.autoMobileLayout)؛ هذا الزر يحوّله إلى قيم صريحة قابلة للتعديل */
  function autoMobile(sec) { writeMobile(sec); E.dev = "m"; updateTop(); fitStage(); afterEdit(); toast("📲 ثُبّتت قيم الهاتف — عدّل أي عنصر بالسحب بعد ذلك"); }
  function writeMobile(sec) { const L = PB.autoMobileLayout(sec); (sec.free || []).forEach(w => { const a = L.items[w.id]; if (a) { setR(w.set, "fx", "m", a.fx); setR(w.set, "fwd", "m", a.fwd); setR(w.set, "fy", "m", a.fy); setR(w.set, "fh", "m", a.fh); } }); setR(sec.set, "mh", "m", L.h); }
  /* عند أول تعديل يدوي في عرض الهاتف نثبّت الترتيب التلقائي أولاً حتى لا تتبعثر بقية العناصر */
  function ensureMobile(sec) {
    if (E.dev !== "m" || sec.set.kind !== "canvas" || sec.set.scaled || sec.set.autoM === false) return; const fr = sec.free || [];
    if (!fr.length || fr.some(w => ["fx", "fy", "fwd", "fh"].some(k => own(w.set, k, "m") !== undefined)) || own(sec.set, "mh", "m") !== undefined) return; writeMobile(sec);
  }
  const uOf = (sec, cr) => sec.set.scaled ? cr.width / (num(sec.set.dw) || 1140) : 1;      // نسبة التكبير الفعلية للأقسام المتناسبة
  function addFree(type, sec, x, y) {
    const fr = sec.free || [], bottom = fr.reduce((m, q) => Math.max(m, (Number(eff(q.set, "fy", "d")) || 0) + (Number(eff(q.set, "fh", "d")) || 0)), 0);
    const w = PB.mkFree(type, x != null ? x : 6, y != null ? y : (fr.length ? bottom + 20 : 24), Math.max(0, ...fr.map(q => Number(q.set.zi) || 0)) + 1);
    (sec.free = sec.free || []).push(w);
    if (sec.set.kind === "canvas") { const need = (Number(w.set.fy.d) || 0) + (Number(w.set.fh.d) || 0) + 40; if (need > (Number(eff(sec.set, "mh", "d")) || 0)) setR(sec.set, "mh", "d", need); }   // يكبر القماش ليتسع للعنصر
    afterEdit(w.id); setTimeout(() => { const el = fdoc.querySelector(`[data-pb="${w.id}"]`); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 50);
  }
  function addWidget(type, col, at) {
    const t = col ? { col } : target();
    if (t.sec) return addFree(type, t.sec);
    const w = PB.mkW(type); if (at == null) t.col.widgets.push(w); else t.col.widgets.splice(at, 0, w); afterEdit(w.id);
    setTimeout(() => { const el = fdoc.querySelector(`[data-pb="${w.id}"]`); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 50);
  }
  /* وجهة الإضافة: قسم حر/عنصر حر ⟵ طبقة حرة، وإلا عمود */
  function target() {
    const inf = selInfo();
    if (inf) { if (inf.kind === "widget") return inf.free ? { sec: inf.sec } : { col: inf.col }; if (inf.kind === "column") return { col: inf.node }; if (inf.kind === "section") return inf.node.set.kind === "canvas" ? { sec: inf.node } : { col: inf.node.cols[0] }; }
    let sec = E.page.sections[E.page.sections.length - 1]; if (!sec) { sec = PB.mkS(); E.page.sections.push(sec); }
    return sec.set.kind === "canvas" ? { sec } : { col: sec.cols[sec.cols.length - 1] };
  }
  function mkTpl(k) {
    if (TPLS[k]) return TPLS[k].f();
    const n = { _blank: 1, _two: 2, _three: 3 }[k] || 1; return PB.mkS(Array.from({ length: n }, () => PB.mkC([])));
  }
  function addSection(k, at) { const s = mkTpl(k); if (at == null) { const inf = selInfo(); at = inf ? inf.sec ? E.page.sections.indexOf(inf.sec) + 1 : E.page.sections.length : E.page.sections.length; } E.page.sections.splice(at, 0, s); afterEdit(s.id); setTimeout(() => { const el = fdoc.querySelector(`[data-pb="${s.id}"]`); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 50); }
  function addGrid() { const r = Math.max(1, Math.min(10, Number(($("gb-r") || {}).value) || 2)), c = Math.max(1, Math.min(12, Number(($("gb-c") || {}).value) || 3)), s = PB.mkGrid(r, c), inf = selInfo(), at = inf ? E.page.sections.indexOf(inf.sec) + 1 : E.page.sections.length; E.page.sections.splice(at, 0, s); afterEdit(s.id); }

  /* ───────────────── رفع الصور مباشرة من الصفحة (جودة عالية بلا تصغير مفرط) ───────────────── */
  const HQ = { max: 2400, q: .92, noVariants: true };
  const pickFiles = multi => new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.multiple = !!multi; i.onchange = () => res([...i.files]); i.click(); });
  async function mediaList() { try { const f = await GH.getFile("assets/pages/media.json"); return JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); } catch (e) { return []; } }
  async function mediaAdd(paths) { try { const L = await mediaList(); paths.forEach(p => { if (!L.some(x => x.p === p)) L.unshift({ p, t: Date.now() }); }); await putJson("assets/pages/media.json", L.slice(0, 400), "مكتبة صور منشئ الصفحات"); } catch (e) { } }
  /* مكتبة الصور: كل ما رُفع سابقاً + صور المنتجات؛ تعيد مصفوفة المسارات المختارة */
  function openLibrary(multi) {
    return new Promise(async res => {
      const A = (typeof Admin !== "undefined") ? Admin : {}, up = await mediaList(), prod = []; (A.products || []).forEach(p => [p.cover].concat(p.images || []).forEach(i => { if (i && !prod.includes(i)) prod.push(i); }));
      let tab = "up"; const sel = new Set(), m = document.createElement("div"); m.id = "pbx-lib"; m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10003;display:flex;align-items:center;justify-content:center;direction:rtl";
      const draw = () => { const list = tab === "up" ? up.map(x => x.p) : prod;
        m.innerHTML = `<div style="background:#fff;border-radius:16px;width:min(900px,94vw);max-height:86vh;display:flex;flex-direction:column;overflow:hidden"><div style="display:flex;gap:.5rem;padding:.8rem;border-bottom:1px solid #eee;align-items:center"><b>📚 مكتبة الصور</b><button class="pbx-small" data-t="up" style="${tab === "up" ? "background:#173f35;color:#fff" : ""}">المرفوعة (${up.length})</button><button class="pbx-small" data-t="prod" style="${tab === "prod" ? "background:#173f35;color:#fff" : ""}">صور المنتجات (${prod.length})</button><span style="margin-inline-start:auto"></span><button class="pbx-small" data-x="ok" ${sel.size ? "" : "disabled"}>إدراج (${sel.size})</button><button class="pbx-small" data-x="no">إغلاق</button></div><div style="padding:.8rem;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:.6rem">${list.map(pth => `<div data-p="${esc(pth)}" style="aspect-ratio:1;border:3px solid ${sel.has(pth) ? "#c8a24b" : "transparent"};border-radius:10px;overflow:hidden;cursor:pointer;background:#f4efe6"><img src="${esc(pth)}" loading="lazy" style="width:100%;height:100%;object-fit:cover"></div>`).join("") || '<p style="color:#888">لا توجد صور بعد — ارفع صوراً من الصفحة وستظهر هنا.</p>'}</div></div>`; };
      m.addEventListener("click", e => { const t = e.target.closest("[data-t]"), x = e.target.closest("[data-x]"), pi = e.target.closest("[data-p]");
        if (t) { tab = t.dataset.t; draw(); } else if (x) { m.remove(); res(x.dataset.x === "ok" ? [...sel] : []); } else if (pi) { const pth = pi.dataset.p; if (multi) { sel.has(pth) ? sel.delete(pth) : sel.add(pth); draw(); } else { m.remove(); res([pth]); } } else if (e.target === m) { m.remove(); res([]); } });
      document.body.appendChild(m); draw();
    });
  }
  function applyPaths(inf, paths) {
    const t = inf.node.type;
    if (t === "image") inf.set.src = paths[0];
    else if (t === "gallery") inf.set.imgs = ((inf.set.imgs || "").trim() ? inf.set.imgs.trim() + "\n" : "") + paths.join("\n");
    else if (t === "slider") { const L = inf.set.items = inf.set.items || []; const empty = L.filter(x => !x.img); paths.forEach((pth, i) => { if (empty[i]) empty[i].img = pth; else L.push({ img: pth, title: "", cx: 50, cy: 84 }); }); }
    afterEdit();
  }
  async function libFor(inf) { const paths = await openLibrary(inf.node.type !== "image"); if (paths.length) applyPaths(inf, paths); }
  async function uploadFiles(files) { toast("⏳ جارِ رفع " + files.length + " صورة بجودة عالية..."); const out = []; for (const f of files) out.push(await Admin.uploadImageFile(f, "assets/img/pages", "pg-", HQ)); toast("✅ تم الرفع"); mediaAdd(out); return out; }
  async function uploadFor(inf) {
    const files = await pickFiles(inf.node.type !== "image"); if (!files.length) return;
    try { applyPaths(inf, await uploadFiles(files)); } catch (err) { toast("❌ " + err.message); }
  }

  /* ───────────────── السحب والإفلات من اللوحة ───────────────── */
  function dropTarget(e) {
    const t = fdoc.elementFromPoint(e.clientX, e.clientY); if (!t) return null;
    if (E.drag && E.drag.tpl) {
      const secs = [...root.querySelectorAll(".pb-sec")]; let at = secs.length;
      for (let i = 0; i < secs.length; i++) { const r = secs[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { at = i; break; } }
      const ref = secs[at] || secs[secs.length - 1];
      return { type: "sec", at, y: ref ? (secs[at] ? ref.getBoundingClientRect().top : ref.getBoundingClientRect().bottom) : 0, x: 0, w: fdoc.documentElement.clientWidth };
    }
    const cv = t.closest(".pb-sec.k-canvas");
    if (cv) { const sec = find(cv.dataset.pb), cont = cv.querySelector(".pb-in").getBoundingClientRect(); if (sec) return { type: "free", sec: sec.node, px: (e.clientX - cont.left) / cont.width * 100, py: (e.clientY - cont.top) / uOf(sec.node, cont), y: e.clientY - 2, x: e.clientX - 40, w: 80 }; }
    let colEl = t.closest(".pb-col"); if (!colEl) { const sec = t.closest(".pb-sec"); if (sec) colEl = sec.querySelector(".pb-col"); } if (!colEl) return null;
    const col = find(colEl.dataset.pb); if (!col) return null;
    const ws = [...colEl.querySelectorAll(":scope>.pb-colin>.pb-w")].filter(w => !(E.drag && E.drag.move === w.dataset.pb)); let at = ws.length, y;
    for (let i = 0; i < ws.length; i++) { const r = ws[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { at = i; break; } }
    const cr = colEl.getBoundingClientRect();
    y = ws.length ? (at < ws.length ? ws[at].getBoundingClientRect().top - 4 : ws[ws.length - 1].getBoundingClientRect().bottom + 4) : cr.top + 8;
    return { type: "col", col: col.node, at, y, x: cr.left + 4, w: cr.width - 8 };
  }
  function onDragOver(e) {
    if (!E.drag) return; const tg = dropTarget(e); if (!tg) { hideDrop(); return; } e.preventDefault(); e.dataTransfer.dropEffect = "move";
    let d = fdoc.getElementById("pbdrop"); if (!d) { d = fdoc.createElement("div"); d.id = "pbdrop"; d.className = "pb-drop"; fdoc.body.appendChild(d); }
    const sy = fdoc.defaultView.scrollY; d.style.top = (tg.y + sy - 2) + "px"; d.style.left = tg.x + "px"; d.style.width = tg.w + "px";
  }
  function hideDrop() { const d = fdoc && fdoc.getElementById("pbdrop"); if (d) d.remove(); }
  function onDrop(e) {
    if (!E.drag) return; e.preventDefault(); const tg = dropTarget(e), dr = E.drag; E.drag = null; hideDrop(); if (!tg) return;
    if (dr.tpl) { addSection(dr.tpl, tg.at); return; }
    if (tg.type === "free") {
      if (dr.add) { addFree(dr.add, tg.sec, Math.max(0, Math.round(tg.px)), Math.max(0, Math.round(tg.py))); return; }
      if (dr.move) { const inf = find(dr.move); if (inf && inf.kind === "widget" && !inf.free) { E.sel = inf.node.id; const secBak = tg.sec; toggleFree(); const nw = find(dr.move); if (nw && nw.sec !== secBak) { nw.list.splice(nw.idx, 1); (secBak.free = secBak.free || []).push(nw.node); } const w2 = find(dr.move); if (w2) { setR(w2.set, "fx", E.dev, Math.max(0, Math.round(tg.px))); setR(w2.set, "fy", E.dev, Math.max(0, Math.round(tg.py))); afterEdit(dr.move); } } return; }
    }
    if (dr.add) { addWidget(dr.add, tg.col, tg.at); return; }
    if (dr.move) { const inf = find(dr.move); if (!inf) return; if (inf.kind === "widget") { inf.list.splice(inf.idx, 1); tg.col.widgets.splice(Math.min(tg.at, tg.col.widgets.length), 0, inf.node); afterEdit(inf.node.id); } }
  }
  document.addEventListener("dragstart", e => { const w = e.target.closest && e.target.closest("[data-add],[data-tpl]"); if (!w) return; E.drag = w.dataset.add ? { add: w.dataset.add } : { tpl: w.dataset.tpl }; e.dataTransfer.setData("text/plain", "pb"); e.dataTransfer.effectAllowed = "copyMove"; });
  document.addEventListener("dragend", () => { E.drag = null; hideDrop(); });
  document.addEventListener("click", e => {
    if (!$("pb-app") || !$("pb-app").contains(e.target)) return;
    const a = e.target.closest("[data-add]"); if (a) return addWidget(a.dataset.add);
    if (e.target.closest("[data-grid]")) return addGrid();
    const t = e.target.closest("[data-tpl]"); if (t) return addSection(t.dataset.tpl);
    const l = e.target.closest("[data-sel]"); if (l) { select(l.dataset.sel); const el = fdoc.querySelector(`[data-pb="${l.dataset.sel}"]`); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }
  });
  function toggleSnap() { E.snap = !E.snap; updateTop(); toast(E.snap ? "🧲 الالتصاق مفعّل: يلتصق العنصر بحواف وأوسط العناصر الأخرى" : "التحريك حر تماماً بلا التصاق"); }
  function onKey(e) {
    if (!$("pb-app").classList.contains("on")) return;
    const tag = (e.target.tagName || "").toLowerCase(); if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); dup(); }
    else if (e.key === "Delete" && E.sel) { e.preventDefault(); del(); }
    else if (e.key === "Escape") { const inf = selInfo(); select(inf ? parentId(inf) : null); }          // Esc = تحديد الأب (عمود ثم قسم ثم لا شيء)
    else if (/^Arrow/.test(e.key) && E.sel) {                                                  // تحريك العنصر الحر بالأسهم (Shift = 10 بكسل)
      const inf = selInfo(); if (!inf) return;
      if (!inf.free) { e.preventDefault(); const d = (e.key === "ArrowUp" || e.key === "ArrowLeft") ? -1 : (e.key === "ArrowDown" || e.key === "ArrowRight") ? 1 : 0; if (d) { if (e.altKey) move(d); else nav(d); } return; }   // العناصر العادية: الأسهم تنقل التحديد (Alt = إعادة ترتيب)
      const el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), cw = el.closest(".pb-in").getBoundingClientRect().width, st = e.shiftKey ? 10 : 1;
      let fx = Number(eff(inf.set, "fx", E.dev)) || 0, fy = Number(eff(inf.set, "fy", E.dev)) || 0;
      const u = uOf(inf.sec, { width: cw }); ensureMobile(inf.sec); fx = Number(eff(inf.set, "fx", E.dev)) || 0; fy = Number(eff(inf.set, "fy", E.dev)) || 0;
      if (e.key === "ArrowLeft") fx -= st / cw * 100; if (e.key === "ArrowRight") fx += st / cw * 100; if (e.key === "ArrowUp") fy -= st / u; if (e.key === "ArrowDown") fy += st / u;
      setR(inf.set, "fx", E.dev, Math.round(fx * 10) / 10); setR(inf.set, "fy", E.dev, Math.round(fy)); schedule(); positionOverlaySoon(); clearTimeout(hT); hT = setTimeout(() => { commitHist(); renderInspector(); }, 400);
    }
  }

  /* توسيع الشريط الجانبي بالسحب (يُحفظ العرض في المتصفح) */
  function wireResizer() {
    const rz = $("pbx-rz"), side = $("pbx-insp"); if (!rz || !side) return;
    try { const w = Number(localStorage.getItem("pbx_side_w")); if (w >= 260 && w <= 720) side.style.width = w + "px"; } catch (e) { }
    rz.addEventListener("mousedown", e => {
      e.preventDefault(); if (e.detail >= 2) { side.style.width = ""; try { localStorage.removeItem("pbx_side_w"); } catch (e2) { } fitStage(); positionOverlay(); return; }
      /* نقر مزدوج = العرض الافتراضي */ const x0 = e.clientX, w0 = side.getBoundingClientRect().width, onRight = side.getBoundingClientRect().left > rz.getBoundingClientRect().left, sh = mkShield("ew-resize"); rz.classList.add("on");
      const mv = ev => { const d = ev.clientX - x0; side.style.width = Math.max(260, Math.min(720, Math.round(w0 + (onRight ? -d : d)))) + "px"; fitStage(); positionOverlay(); };
      const up = () => { document.removeEventListener("mousemove", mv, true); document.removeEventListener("mouseup", up, true); sh.remove(); rz.classList.remove("on"); try { localStorage.setItem("pbx_side_w", String(parseInt(side.style.width))); } catch (e) { } };
      document.addEventListener("mousemove", mv, true); document.addEventListener("mouseup", up, true);
    });
  }
  /* ───────────────── تنقل سلس بين العناصر ───────────────── */
  const parentId = inf => inf.kind === "widget" ? (inf.free ? inf.sec.id : inf.col.id) : inf.kind === "column" ? inf.sec.id : null;
  function nav(d) {
    const inf = selInfo(); if (!inf) return; let j = inf.idx + d, to = null;
    if (inf.kind === "widget" && !inf.free && (j < 0 || j >= inf.list.length)) { const c = inf.sec.cols[inf.sec.cols.indexOf(inf.col) + d]; if (c && c.widgets.length) to = c.widgets[d > 0 ? 0 : c.widgets.length - 1]; }
    else if (inf.list[j]) to = inf.list[j];
    if (!to) return; select(to.id); const el = fdoc.querySelector(`[data-pb="${to.id}"]`); if (el) el.scrollIntoView({ block: "nearest" });
  }
  function nudge(dx, dy) {
    const inf = selInfo(); if (!inf || !inf.free) return; ensureMobile(inf.sec);
    const el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), cw = el.closest(".pb-in").getBoundingClientRect().width, u = uOf(inf.sec, { width: cw });
    setR(inf.set, "fx", E.dev, Math.round(((Number(eff(inf.set, "fx", E.dev)) || 0) + dx / cw * 100) * 10) / 10); setR(inf.set, "fy", E.dev, Math.round((Number(eff(inf.set, "fy", E.dev)) || 0) + dy / u));
    if (E.dev !== "d") ["fx", "fy"].forEach(k => { if (own(inf.set, k, "d") === undefined) setR(inf.set, k, "d", eff(inf.set, k, E.dev)); });
    afterEdit();
  }
  /* لوحة الإجراءات السريعة في الشريط الجانبي (بدل ازدحام الشريط فوق العنصر) */
  function quickHtml(inf) {
    const q = (k, t, tt, on, cls) => `<button class="pbx-qk${on ? " on" : ""}${cls ? " " + cls : ""}" data-q="${k}" title="${esc(tt || t)}">${t}</button>`;
    const grp = (cap, body, cls) => `<div class="pbx-qg${cls ? " " + cls : ""}"><small>${cap}</small><div class="pbx-qb">${body}</div></div>`;
    const chain = []; for (let n = inf, g = 0; n && g < 4; g++) { chain.unshift(n); n = parentId(n) ? find(parentId(n)) : null; }
    const crumbs = chain.map(n => `<button class="pbx-crumb${n.node.id === inf.node.id ? " on" : ""}" data-pick="${n.node.id}">${n.kind === "widget" ? WIDGETS[n.node.type].ic + " " + WIDGETS[n.node.type].label : n.kind === "column" ? "▯ عمود" : "▤ قسم"}</button>`).join('<i class="pbx-sep">‹</i>');
    let h = `<div class="pbx-q"><div class="pbx-crumbs">${crumbs}</div>`;
    h += grp("التنقل", q("prev", "▲", "تحديد العنصر السابق (↑)") + q("next", "▼", "تحديد العنصر التالي (↓)") + q("parent", "⤴ الحاوية", "تحديد الحاوية (Esc)", false, "wide"));
    if (inf.kind === "widget") {
      h += grp("الطبقة والوضع", q("front", "↥ أمام", "إحضار للأمام") + q("back", "↧ خلف", "إرسال للخلف") + q("free", inf.free ? "↩ إلى عمود" : "🕊️ حر", inf.free ? "تثبيت العنصر داخل عمود" : "تحرير العنصر ليتحرك بحرية", inf.free, "wide"));
      if (inf.free) h += `<div class="pbx-qrow">${grp("محاذاة", q("al-left", "⇤", "محاذاة لأقصى اليسار") + q("al-center", "↔", "توسيط أفقي") + q("al-right", "⇥", "محاذاة لأقصى اليمين"))}${grp("إزاحة", `<span class="pbx-dpad">${q("n-u", "↑", "للأعلى", false, "u")}${q("n-l", "←", "لليسار", false, "l")}${q("n-d", "↓", "للأسفل", false, "d")}${q("n-r", "→", "لليمين", false, "r")}</span>`)}</div>`;
      else h += grp("الترتيب", q("up", "↑", "تقديم في الترتيب (Alt+↑)") + q("down", "↓", "تأخير في الترتيب (Alt+↓)") + `<button class="pbx-qk wide" data-q="grab" draggable="true" title="اسحبه إلى عمود آخر أو قسم آخر" style="cursor:grab">✥ نقل لعمود</button>`) + `<small class="pbx-note">اسحب العنصر بالفأرة لتحريكه بحرية · Alt+سحب = نسخ · Ctrl+إفلات فوق عمود = إدراج</small>`;
      if (["image", "slider", "gallery"].includes(inf.node.type)) h += grp("الصور", q("upl", "⬆ رفع", "رفع صور مباشرة") + q("lib", "📚 المكتبة", "مكتبة الصور"));
    } else {
      let b2 = q("up", inf.kind === "column" ? "▶" : "↑", "تحريك") + q("down", inf.kind === "column" ? "◀" : "↓", "تحريك");
      if (inf.kind === "section" && inf.node.set.kind !== "canvas") b2 += q("addcol", "＋ عمود", "إضافة عمود", false, "wide");
      if (inf.kind === "column") b2 += q("addcol", "＋ عمود بعده", "إضافة عمود بعده", false, "wide");
      h += grp("الترتيب", b2);
      if (inf.kind === "section" && (inf.node.free || []).length) h += grp("الهاتف", q("automob", "📲 تكييف للهاتف", "ترتيب عناصر القماش الحر تلقائياً للهاتف", false, "wide"));
    }
    return h + `</div>`;
  }
  function onQuick(k, inf) {
    const d = { prev: () => nav(-1), next: () => nav(1), parent: () => select(parentId(inf)), front: () => zOrder(1), back: () => zOrder(-1), free: toggleFree, up: () => move(-1), down: () => move(1),
      "al-left": () => alignFree("left"), "al-center": () => alignFree("center"), "al-right": () => alignFree("right"), upl: () => uploadFor(inf), lib: () => libFor(inf),
      addcol: () => inf.kind === "column" ? addCol(inf.sec, inf.idx + 1) : addCol(inf.node), automob: () => autoMobile(inf.node) };
    if (k.startsWith("n-")) { const st = 1; const m = { l: [-st, 0], r: [st, 0], u: [0, -st], d: [0, st] }[k[2]]; return nudge(m[0] * 4, m[1] * 4); }
    if (d[k]) d[k]();
  }

  /* ───────────────── الإعدادات (Inspector) ───────────────── */
  function ctlsFor(inf) {
    let base, com;
    if (inf.kind === "widget") { base = inf.def.ctl.slice(); com = common("widget").filter(c => !(c.skipFor && c.skipFor.includes(inf.node.type))); }
    else if (inf.kind === "column") { base = COL_CTL.slice(); com = common("column"); }
    else { base = SEC_CTL.slice(); com = common("section"); }
    const have = new Set(base.map(c => c.k));
    return base.concat(com.filter(c => !have.has(c.k))).filter(c => {
      if (c.onlyFree && !inf.free) return false;
      if (inf.free && (c.k === "w" || c.k === "al" || c.k === "mh") && c.tab === "s") return false;                       // العنصر الحر يُدار بالموضع والحجم
      if (c.showIf) { const cur = inf.set[c.showIf[0]] === undefined ? (c.showIf[0] === "kind" ? "flow" : c.showIf[0] === "mode" ? "all" : undefined) : inf.set[c.showIf[0]]; if (cur !== c.showIf[1]) return false; }
      return true;
    });
  }
  function renderInspector() {
    const el = $("pbx-insp"); if (!el) return; const inf = selInfo();
    if (!inf) { el.innerHTML = `<div class="pbx-ih">⚙️ الإعدادات</div><p style="color:#888;font-size:.85rem;line-height:1.8">انقر على أي قسم أو عمود أو عنصر في الصفحة لتعديل إعداداته.<br><br>• انقر مرتين على النص لتعديله مباشرة.<br>• اسحب المقبض الجانبي ↔ لتغيير العرض والسفلي ↕ للارتفاع (Shift = خطوات ثابتة).<br>• غيّر الجهاز من الأعلى: تعديلات التابلت والهاتف تُحفظ منفصلة وتتوارث من الأكبر.</p>`; return; }
    const lbl = inf.kind === "widget" ? WIDGETS[inf.node.type].ic + " " + WIDGETS[inf.node.type].label : inf.kind === "column" ? "▯ عمود" : "▤ قسم";
    const all = ctlsFor(inf).filter(c => c.tab === E.tab);
    el.innerHTML = `<div class="pbx-ih">${lbl}</div>
${quickHtml(inf)}
<div class="pbx-dv">${DEVS.map(d => `<button data-dev="${d}" class="${E.dev === d ? "on" : ""}" title="${DEVNAME[d]}">${DEVIC[d]}</button>`).join("")}</div>
<div class="pbx-cp"><small>نسخ تصميم ${DEVIC[E.dev]} ${DEVNAME[E.dev]} إلى:</small><select id="cp-scope"><option value="sel">العنصر المحدد</option><option value="sec">القسم كله</option><option value="all">الصفحة كلها</option></select>${DEVS.filter(d => d !== E.dev).map(d => `<button class="pbx-small" data-cpy="${d}" title="نسخ إلى ${DEVNAME[d]}">${DEVIC[d]}</button>`).join("")}</div>
<div class="pbx-itabs">${[["c", "محتوى"], ["s", "تنسيق"], ["a", "متقدم"]].map(([k, n]) => `<button data-itab="${k}" class="${E.tab === k ? "on" : ""}">${n}</button>`).join("")}</div>
${all.map(c => field(c, inf.set)).join("") || '<p style="color:#888;font-size:.82rem">لا توجد إعدادات في هذا التبويب.</p>'}`;
    const gr = el.querySelector('[data-q="grab"]'); if (gr) { gr.addEventListener("dragstart", e => { E.drag = { move: inf.node.id }; e.dataTransfer.setData("text/plain", "pb"); e.dataTransfer.effectAllowed = "move"; }); gr.addEventListener("dragend", hideDrop); }
  }
  function field(c, set) {
    const dev = E.dev, k = c.k, isR = !!c.r;
    const ownV = isR ? own(set, k, dev) : set[k], effV = isR ? eff(set, k, dev) : set[k];
    const inherited = isR && ownV === undefined && effV !== undefined;
    const rs = (ownV !== undefined && ownV !== "" && !(c.t === "switch" && ownV === false && !isR)) ? `<button class="rs" data-rs="${k}" title="إعادة للافتراضي">↺</button>` : "";
    const head = `<label>${esc(c.l)}${isR ? ` <span class="dv">${DEVIC[dev]}</span>` : ""}${rs}</label>`;
    const a = `data-k="${k}" data-t="${c.t}"`;
    let b = "";
    switch (c.t) {
      case "text": b = `<input type="text" ${a} value="${esc(ownV ?? "")}">`; break;
      case "textarea": case "rich": case "gallery": b = `<textarea ${a} ${c.t === "rich" ? 'dir="ltr" rows="8"' : ""}>${esc(ownV ?? "")}</textarea>` + (c.t === "gallery" ? `<button class="pbx-small" data-upadd="${k}">⬆ رفع صور وإضافتها</button>` : ""); break;
      case "datetime": b = `<input type="datetime-local" ${a} value="${esc(ownV ?? "")}">`; break;
      case "num": { const rng = (c.max != null && c.min != null && c.max - c.min <= 2000) ? `<input type="range" ${a} data-range="1" min="${c.min}" max="${c.max}" step="${c.step || 1}" value="${effV ?? c.min}" class="sm" style="max-width:96px">` : ""; b = `<div class="pbx-row"><input type="number" ${a} ${c.min != null ? `min="${c.min}"` : ""} ${c.max != null ? `max="${c.max}"` : ""} step="${c.step || 1}" value="${ownV ?? ""}" placeholder="${inherited ? effV : ""}" class="${inherited ? "inh" : ""}">${rng}</div>`; break; }
      case "select": b = `<select ${a} class="${inherited ? "inh" : ""}">${(inherited || ownV === undefined) && c.r ? `<option value=""${ownV === undefined ? " selected" : ""}>${inherited ? "↩ موروث" : "—"}</option>` : ""}${(typeof c.o === "function" ? c.o() : c.o).map(o => `<option value="${esc(o[0])}"${String(ownV ?? (c.r ? "" : set[k] ?? "")) === String(o[0]) && !(c.r && ownV === undefined) ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`; break;
      case "color": b = `<div class="pbx-row"><input type="color" ${a} value="${/^#[0-9a-f]{6}$/i.test(ownV || "") ? ownV : "#ffffff"}" class="sm"><span style="font-size:.75rem;color:#888">${esc(ownV || "—")}</span>${ownV ? `<button class="pbx-small sm" data-clr="${k}">مسح</button>` : ""}</div>`; break;
      case "switch": b = `<label style="font-weight:600"><input type="checkbox" ${a} ${effV ? "checked" : ""}> مفعّل</label>`; break;
      case "align": b = `<div class="pbx-al">${AL3.map(([v, t]) => `<button data-al="${k}" data-v="${v}" class="${(effV || "") === v ? "on" : ""}">${t}</button>`).join("")}</div>`; break;
      case "image": b = `<div class="pbx-row"><input type="text" ${a} value="${esc(ownV ?? "")}" placeholder="مسار/رابط الصورة"><button class="pbx-small sm" data-up="${k}">⬆ رفع</button><button class="pbx-small sm" data-lib="${k}">📚</button></div>${ownV ? `<img src="${esc(/^(https?:|data:|\/)/.test(ownV) ? ownV : ownV)}" style="max-width:100%;max-height:80px;margin-top:.3rem;border-radius:6px">` : ""}`; break;
      case "dims": { const arr = (isR ? (ownV || effV) : set[k]) || []; b = `<div class="pbx-dims">${["أعلى", "يمين", "أسفل", "يسار"].map((n, i) => `<div><input type="number" data-k="${k}" data-t="dims" data-i="${i}" value="${arr[i] ?? ""}" placeholder="${isR && ownV === undefined && effV ? (effV[i] ?? "") : ""}"><small>${n}</small></div>`).join("")}</div>`; break; }
      case "rep": { const items = set[k] || []; b = items.map((it, i) => `<div class="pbx-rep">${c.f.map(([fk, fl, ft]) => ft === "image" ? `<div class="pbx-row" style="margin-bottom:.3rem"><input type="text" data-rep="${k}" data-i="${i}" data-f="${fk}" placeholder="${esc(fl)}" value="${esc(it[fk] || "")}">${it[fk] ? `<img src="${esc(it[fk])}" style="width:38px;height:38px;object-fit:cover;border-radius:6px" class="sm">` : ""}<button class="pbx-small sm" data-repup="${k}" data-i="${i}" data-f="${fk}">⬆</button></div>` : `<input type="text" data-rep="${k}" data-i="${i}" data-f="${fk}" placeholder="${esc(fl)}" value="${esc(it[fk] || "")}" style="margin-bottom:.3rem">`).join("")}<button class="pbx-small" data-repdel="${k}" data-i="${i}">حذف</button></div>`).join("") + `<div class="pbx-row"><button class="pbx-small" data-repadd="${k}">＋ إضافة</button>${c.up ? `<button class="pbx-small" data-repmulti="${k}" data-f="${c.up}">⬆ رفع عدة صور</button>` : ""}</div>`; break; }
      case "prodpick": { const sel = new Set(String(set[k] || "").split(/[\s,،]+/).filter(Boolean)); b = '<div style="max-height:200px;overflow:auto;border:1.5px solid #e0d9c8;border-radius:8px;padding:.4rem">' + (((typeof Admin !== "undefined" && Admin.products) || []).map(p => `<label style="display:flex;gap:.4rem;align-items:center;font-weight:600;font-size:.82rem;margin-bottom:.2rem"><input type="checkbox" data-pp="${k}" data-v="${esc(p.slug)}" style="width:auto"${sel.has(p.slug) ? " checked" : ""}> ${esc(p.title)}</label>`).join("") || "لا منتجات") + "</div>"; break; }
    }
    return `<div class="pbx-f">${head}${b}</div>`;
  }
  const AL3 = [["start", "بداية"], ["center", "وسط"], ["end", "نهاية"]];

  function applyVal(inf, c, val, idx) {
    const set = inf.set, k = c.k; if (inf.kind === "widget" && inf.free && /^(fx|fy|fwd|fh)$/.test(k)) ensureMobile(inf.sec);
    if (c.t === "dims") {
      let arr = (c.r ? (own(set, k, E.dev) || eff(set, k, E.dev)) : set[k]) || ["", "", "", ""]; arr = arr.slice(); arr[idx] = val === "" ? "" : Number(val);
      const empty = arr.every(x => x === "" || x == null); if (c.r) setR(set, k, E.dev, empty ? undefined : arr); else { if (empty) delete set[k]; else set[k] = arr; } return;
    }
    if (c.t === "num") val = val === "" ? undefined : Number(val);
    if (c.t === "switch") val = !!val;
    if (c.r) setR(set, k, E.dev, val); else if (val === "" || val === undefined) delete set[k]; else set[k] = val;
  }
  const ctlByKey = (inf, k) => ctlsFor(inf).find(c => c.k === k);
  let hT = 0;
  function onInspInput(e) {
    const t = e.target, inf = selInfo(); if (!inf) return;
    if (t.dataset.rep) { const items = inf.set[t.dataset.rep] || []; items[t.dataset.i][t.dataset.f] = t.value; inf.set[t.dataset.rep] = items; schedule(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500); return; }
    if (!t.dataset.k) return; const c = ctlByKey(inf, t.dataset.k); if (!c) return;
    if (t.dataset.range) { const n = t.parentNode.querySelector('input[type=number]'); if (n) n.value = t.value; }
    applyVal(inf, c, t.type === "checkbox" ? t.checked : t.value, t.dataset.i != null ? Number(t.dataset.i) : undefined);
    schedule(); positionOverlaySoon(); clearTimeout(hT); hT = setTimeout(() => commitHist(), 500);
  }
  const positionOverlaySoon = () => setTimeout(positionOverlay, 40);
  function onInspChange(e) {
    const t = e.target;
    if (t.dataset && t.dataset.pp) { const inf = selInfo(); if (!inf) return; const cur = new Set(String(inf.set[t.dataset.pp] || "").split(/[\s,،]+/).filter(Boolean)); t.checked ? cur.add(t.dataset.v) : cur.delete(t.dataset.v); inf.set[t.dataset.pp] = [...cur].join(","); afterEdit(); return; } if (t.dataset.k || t.dataset.rep) { commitHist(); if (t.tagName === "SELECT" || t.type === "checkbox" || t.type === "color") { onInspInput(e); renderInspector(); } if (t.dataset.range) renderInspector(); }
    if (t.dataset.fileFor) {}
  }
  async function onInspClick(e) {
    const t = e.target.closest("button, [data-dev]"); if (!t) return; const inf = selInfo();
    if (t.dataset.dev) { setDev(t.dataset.dev); return; }
    if (t.dataset.itab) { E.tab = t.dataset.itab; renderInspector(); return; }
    if (t.dataset.pick) { select(t.dataset.pick); return; }
    if (!inf) return;
    if (t.dataset.q) { if (t.dataset.q !== "grab") onQuick(t.dataset.q, inf); return; }
    if (t.dataset.rs) { const c = ctlByKey(inf, t.dataset.rs); if (c.r) setR(inf.set, c.k, E.dev, undefined); else delete inf.set[c.k]; afterEdit(); return; }
    if (t.dataset.clr) { delete inf.set[t.dataset.clr]; afterEdit(); return; }
    if (t.dataset.al) { const c = ctlByKey(inf, t.dataset.al); applyVal(inf, c, t.dataset.v); afterEdit(); return; }
    if (t.dataset.lib) { const paths = await openLibrary(false); if (paths.length) { inf.set[t.dataset.lib] = paths[0]; afterEdit(); } return; }
    if (t.dataset.cpy) { copyDevice(t.dataset.cpy, ($("cp-scope") || {}).value || "sel"); return; }
    if (t.dataset.repadd) { const arr = inf.set[t.dataset.repadd] = inf.set[t.dataset.repadd] || []; arr.push(inf.node.type === "slider" ? { img: "", title: "عنوان جديد", cx: 50, cy: 84 } : { q: "سؤال جديد", a: "الجواب" }); afterEdit(); return; }
    if (t.dataset.repup || t.dataset.repmulti) {
      const multi = !!t.dataset.repmulti, k = t.dataset.repup || t.dataset.repmulti, f = t.dataset.f, files = await pickFiles(multi); if (!files.length) return;
      try { const paths = await uploadFiles(files), arr = inf.set[k] = inf.set[k] || [];
        if (multi) paths.forEach(pth => arr.push(inf.node.type === "slider" ? { img: pth, title: "", cx: 50, cy: 84 } : { [f]: pth })); else arr[Number(t.dataset.i)][f] = paths[0]; afterEdit(); }
      catch (err) { toast("❌ " + err.message); }
      return;
    }
    if (t.dataset.repdel) { inf.set[t.dataset.repdel].splice(Number(t.dataset.i), 1); afterEdit(); return; }
    if (t.dataset.up || t.dataset.upadd) {
      const multi = !!t.dataset.upadd, k = t.dataset.up || t.dataset.upadd;
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = multi;
      inp.onchange = async () => {
        const files = [...inp.files]; if (!files.length) return; toast("⏳ جارِ رفع " + files.length + " صورة...");
        try {
          const paths = []; for (const f of files) paths.push(await Admin.uploadImageFile(f, "assets/img/pages", "pg-", HQ));
          if (multi) inf.set[k] = ((inf.set[k] || "").trim() ? inf.set[k].trim() + "\n" : "") + paths.join("\n"); else inf.set[k] = paths[0];
          toast("✅ تم الرفع"); afterEdit();
        } catch (err) { toast("❌ " + err.message); }
      };
      inp.click();
    }
  }

  /* ───────────────── النشر والمعاينة ───────────────── */
  const b64 = str => btoa(unescape(encodeURIComponent(str)));
  function siteCtx() {
    const S = (typeof SITE_CFG !== "undefined") ? SITE_CFG : {};
    return { site: { name: S.name, domain: S.domain, wa: S.waNumber }, products: (typeof Admin !== "undefined" && Admin.products) || [], meta: { tabs: (typeof Admin !== "undefined" && Admin.collections) || [], cats: (typeof Admin !== "undefined" && Admin.categories) || {} } };
  }
  function validate() {
    const P = E.page; if (!P.title.trim()) { toast("أدخل عنوان الصفحة"); return false; }
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(P.slug || "")) { toast("الرابط (slug) يجب أن يكون حروفاً لاتينية صغيرة وأرقاماً وشرطات (حرفان على الأقل) — من تبويب ⚙️ الصفحة"); E.ltab = "pg"; renderLeft(); return false; }
    return true;
  }
  function preview() {
    const dir = location.href.replace(/[^/]*$/, "");
    const html = PB.fullHtml(E.page, Object.assign({ base: "", baseHref: dir }, siteCtx()));
    const w = window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank"); if (!w) toast("اسمح بالنوافذ المنبثقة للمعاينة");
  }
  async function putJson(path, obj, msg) {
    let sha; try { sha = (await GH.getFile(path)).sha; } catch (e) { sha = undefined; }
    return GH.putFile(path, b64(typeof obj === "string" ? obj : JSON.stringify(obj, null, 1)), sha, msg);
  }
  async function publish() {
    if (!validate()) return;
    const P = E.page, slug = P.slug; toast("⏳ جارِ النشر...");
    try {
      const html = PB.fullHtml(P, Object.assign({ base: "../../" }, siteCtx()));
      await putJson("lp/" + slug + "/index.html", html, "نشر صفحة هبوط: " + P.title);
      await putJson("assets/pages/" + slug + ".json", P, "مصدر صفحة هبوط: " + slug);
      let idx = []; try { const f = await GH.getFile("assets/pages/index.json"); idx = JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); } catch (e) { }
      const row = { slug, title: P.title, updated: new Date().toISOString().slice(0, 16).replace("T", " "), live: true };
      const i = idx.findIndex(x => x.slug === slug); if (i >= 0) idx[i] = row; else idx.push(row);
      await putJson("assets/pages/index.json", idx, "فهرس صفحات الهبوط");
      E.isNew = false; E.dirty = false; try { localStorage.removeItem(draftKey()); } catch (e) { } updateTop();
      toast("✅ نُشرت: /lp/" + slug + "/ (قد يستغرق ظهورها دقيقة)");
    } catch (err) { console.error(err); toast("❌ " + err.message); }
  }

  return { open, close, meta, setDev, undo, redo, preview, publish, ltab, slugEdit, renderCanvas, toggleSnap, mediaAdd, E, find };
})();

/* ───────── قائمة الصفحات في تبويب لوحة الإدارة ───────── */
const PBAdmin = {
  list: [],
  async init() { const h = document.getElementById("pb-gen-host"); if (h && !h.dataset.m && typeof PBGen !== "undefined") { h.dataset.m = "1"; PBGen.mount(h); } await this.refresh(); },
  async refresh() {
    const box = document.getElementById("pb-list"); if (!box) return;
    try { const f = await GH.getFile("assets/pages/index.json"); this.list = JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); } catch (e) { this.list = []; }
    const dom = (typeof SITE_CFG !== "undefined" && SITE_CFG.domain) || location.host;
    box.innerHTML = this.list.length ? `<table class="rt"><tr class="hd"><th>العنوان</th><th>الرابط</th><th>آخر تحديث</th><th>إجراءات</th></tr>${this.list.map(p => `<tr><td class="t"><b>${PB.esc(p.title)}</b></td><td data-l="الرابط"><a href="lp/${PB.esc(p.slug)}/" target="_blank" dir="ltr">/lp/${PB.esc(p.slug)}/</a></td><td data-l="آخر تحديث"><small>${PB.esc(p.updated || "")}</small></td><td class="act"><button class="small" onclick="PBAdmin.edit('${PB.esc(p.slug)}')">✏️ تعديل</button> <button class="small gray" onclick="PBAdmin.duplicate('${PB.esc(p.slug)}')">⧉ تكرار</button> <button class="small gray" onclick="PBAdmin.exportPage('${PB.esc(p.slug)}')">⬇ تصدير</button> <button class="small gray" onclick="PBAdmin.copyLink('${PB.esc(p.slug)}','${PB.esc(dom)}')">🔗 نسخ الرابط</button> <button class="small" style="background:var(--red);color:#fff" onclick="PBAdmin.unpublish('${PB.esc(p.slug)}')">إلغاء النشر</button></td></tr>`).join("")}</table>` : '<p class="hint">لا توجد صفحات بعد. اضغط «＋ صفحة جديدة» لبدء التصميم.</p>';
  },
  /* تكرار صفحة، وتصدير/استيراد ملف JSON (لنقل التصاميم بين متاجرك أو بيعها كقوالب) */
  async load(slug) { const f = await GH.getFile("assets/pages/" + slug + ".json"); return JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); },
  fresh(p) { const re = n => { n.id = PB.uid(); (n.cols || []).forEach(re); (n.widgets || []).forEach(re); }; p.sections.forEach(re); return p; },
  async duplicate(slug) {
    const ns = prompt("رابط الصفحة الجديدة (حروف لاتينية صغيرة وأرقام وشرطات):", slug + "-copy"); if (!ns) return;
    try { const p = this.fresh(await this.load(slug)); p.slug = ns.toLowerCase().replace(/[^a-z0-9-]/g, ""); p.title += " (نسخة)"; PBApp.open(p, "", true); } catch (e) { toast("❌ " + e.message); }
  },
  async exportPage(slug) {
    try { const p = await this.load(slug), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(p, null, 1)], { type: "application/json" })); a.download = "page-" + slug + ".json"; a.click(); } catch (e) { toast("❌ " + e.message); }
  },
  importPage() {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = async () => { try { const p = JSON.parse(await inp.files[0].text()); if (!p || !Array.isArray(p.sections)) throw new Error("ملف صفحة غير صالح"); this.fresh(p); p.slug = String(p.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "") || "page-" + Date.now().toString(36).slice(-4); PBApp.open(p, "", true); } catch (e) { toast("❌ " + e.message); } };
    inp.click();
  },
  newPage() {
    const t = prompt("عنوان الصفحة الجديدة:", "عرض خاص"); if (!t) return;
    const p = PB.newPage(t, ""); p.slug = ""; PBApp.E.slugTouched = false;
    p.slug = (t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) || "page-" + Date.now().toString(36).slice(-4);
    PBApp.open(p, "", true);
  },
  async edit(slug) {
    try { const f = await GH.getFile("assets/pages/" + slug + ".json"); const p = JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); PBApp.open(p, slug, false); }
    catch (e) { alert("تعذّر فتح الصفحة: " + e.message); }
  },
  copyLink(slug, dom) { const u = "https://" + dom + "/lp/" + slug + "/"; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast("✅ نُسخ: " + u), () => prompt("انسخ الرابط:", u)); },
  async unpublish(slug) {
    if (!confirm("إلغاء نشر هذه الصفحة؟ سيُحوَّل رابطها إلى الصفحة الرئيسية (المصدر يبقى محفوظاً).")) return;
    try {
      const stub = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=../../"><title>…</title></head><body></body></html>';
      let sha; try { sha = (await GH.getFile("lp/" + slug + "/index.html")).sha; } catch (e) { }
      await GH.putFile("lp/" + slug + "/index.html", btoa(unescape(encodeURIComponent(stub))), sha, "إلغاء نشر صفحة هبوط " + slug);
      this.list = this.list.filter(x => x.slug !== slug);
      let s2; try { s2 = (await GH.getFile("assets/pages/index.json")).sha; } catch (e) { }
      await GH.putFile("assets/pages/index.json", btoa(unescape(encodeURIComponent(JSON.stringify(this.list, null, 1)))), s2, "فهرس صفحات الهبوط");
      toast("✅ أُلغي النشر"); this.refresh();
    } catch (e) { toast("❌ " + e.message); }
  },
};
