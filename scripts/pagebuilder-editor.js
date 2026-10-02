/* ══════════════════════════════════════════════════════════════════════════════
   PBApp — واجهة المحرر: لوحة العناصر، قماش حي (iframe) بتحرير مباشر، تحديد وسحب وتغيير حجم،
   لوحة إعدادات متجاوبة (محتوى/تنسيق/متقدم)، تراجع/إعادة، وحفظ/نشر إلى GitHub (أو PHP).
   ══════════════════════════════════════════════════════════════════════════════ */
const PBApp = (() => {
  const { DEVS, DEVNAME, DEVIC, uid, esc, clone, isObj, num, own, eff, setR, WIDGETS, ORDER, TPLS, SEC_CTL, COL_CTL, common } = PB;
  const $ = id => document.getElementById(id);
  const DEVW = { d: 1280, t: 820, m: 390 };
  const E = { page: null, sel: null, dev: "d", hist: [], hi: -1, slug: "", isNew: true, dirty: false, tab: "c", ltab: "add", drag: null, scale: 1, sha: {} };
  let frame, fdoc, root, styleEl, built = false, raf = 0, saveT = 0;

  const EDIT_CSS = `
.pb-edit [data-pb]{cursor:pointer}
.pb-edit .pb-sec:hover{outline:1px dashed #2d6cdf;outline-offset:-1px}
.pb-edit .pb-col:hover>.pb-colin{outline:1px dashed #9b59b6;outline-offset:-1px}
.pb-edit .pb-w:hover{outline:1px dashed #e67e22;outline-offset:2px}
.pb-empty{border:2px dashed #cdbfa0;border-radius:10px;padding:18px;text-align:center;color:#a1936f;font-size:.9rem;width:100%}
[contenteditable=true]{outline:2px solid #2d6cdf!important;outline-offset:3px;cursor:text;min-width:20px}
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
.pbx-right{width:310px;background:#fff;border-inline-start:1px solid #ddd;overflow:auto;padding:.7rem}
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
.pbx-h{position:absolute;pointer-events:auto;background:#fff;border:2px solid currentColor;border-radius:4px;color:#2d6cdf;z-index:3}
.pbx-box.column .pbx-h{color:#9b59b6}.pbx-box.widget .pbx-h{color:#e67e22}
.pbx-h.l{left:-7px;top:50%;margin-top:-12px;width:10px;height:24px;cursor:ew-resize}
.pbx-h.b{bottom:-7px;left:50%;margin-left:-12px;height:10px;width:24px;cursor:ns-resize}
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
.pbx-small{border:1.5px solid #e0d9c8;background:#fff;border-radius:8px;padding:.3rem .6rem;cursor:pointer;font-weight:800;font-family:inherit;font-size:.78rem}
.pbx-lay{font-size:.82rem}.pbx-lay div{padding:.28rem .4rem;border-radius:6px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pbx-lay div:hover{background:#f4efe6}.pbx-lay div.on{background:#173f35;color:#fff}
.pbx-msg{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#173f35;color:#fff;padding:.6rem 1.2rem;border-radius:10px;font-weight:800;z-index:10002;display:none}
@media(max-width:1100px){.pbx-left{width:200px}.pbx-right{width:260px}}`;

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
  <aside class="pbx-right" id="pbx-insp"></aside>
</div>
<div class="pbx-msg" id="pbx-msg"></div>`;
    document.body.appendChild(d);
    frame = $("pbx-frame");
    frame.srcdoc = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style id="pbs"></style></head><body class="pb-page pb-edit"><div id="pbr"></div></body></html>`;
    frame.addEventListener("load", () => { fdoc = frame.contentDocument; root = fdoc.getElementById("pbr"); styleEl = fdoc.getElementById("pbs"); wireFrame(); if (E.page) renderCanvas(); });
    $("pbx-stage").addEventListener("scroll", () => positionOverlay());
    new ResizeObserver(() => { fitStage(); positionOverlay(); }).observe($("pbx-stage"));
    window.addEventListener("resize", () => { if ($("pb-app").classList.contains("on")) { fitStage(); positionOverlay(); } });
    $("pbx-insp").addEventListener("input", onInspInput); $("pbx-insp").addEventListener("change", onInspChange); $("pbx-insp").addEventListener("click", onInspClick);
    document.addEventListener("keydown", onKey);
  }

  /* ───────────────── فتح/إغلاق ───────────────── */
  function open(page, slug, isNew) {
    build();
    E.page = clone(page); E.slug = slug || ""; E.isNew = !!isNew; E.sel = null; E.dev = "d"; E.hist = []; E.hi = -1; E.dirty = false; E.tab = "c"; E.ltab = "add";
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
    document.querySelectorAll("[data-dv]").forEach(b => b.classList.toggle("on", b.dataset.dv === E.dev));
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
      pane.innerHTML = Object.keys(TPLS).map(k => `<button class="pbx-tpl" draggable="true" data-tpl="${k}">${TPLS[k].n}</button>`).join("") + `<button class="pbx-tpl" data-tpl="_blank" style="background:#fff">▭ قسم فارغ (عمود واحد)</button><button class="pbx-tpl" data-tpl="_two" style="background:#fff">▭▭ قسم بعمودين</button><button class="pbx-tpl" data-tpl="_three" style="background:#fff">▭▭▭ قسم بثلاثة أعمدة</button>`;
    } else if (E.ltab === "lay") {
      let h = "";
      E.page.sections.forEach((sec, i) => {
        h += `<div data-sel="${sec.id}" class="${E.sel === sec.id ? "on" : ""}">▤ قسم ${i + 1}</div>`;
        sec.cols.forEach((col, j) => { h += `<div data-sel="${col.id}" class="${E.sel === col.id ? "on" : ""}" style="margin-inline-start:14px">▯ عمود ${j + 1}</div>`; col.widgets.forEach(w => { h += `<div data-sel="${w.id}" class="${E.sel === w.id ? "on" : ""}" style="margin-inline-start:28px">${WIDGETS[w.type].ic} ${WIDGETS[w.type].label}</div>`; }); });
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
  function ctx() { return { base: "", edit: true, products: (typeof Admin !== "undefined" && Admin.products) || [], wa: (typeof SITE_CFG !== "undefined" && SITE_CFG.waNumber) || "" }; }
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
      const el = e.target.closest("[data-pb]"); if (el) { const w = e.target.closest('[data-kind="widget"]'); select((w || el).dataset.pb); } else select(null);
    }, true);
    fdoc.addEventListener("dblclick", e => { const ed = e.target.closest("[data-edit]"); if (ed) startEdit(ed); });
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
    const field = el.dataset.edit, rich = field === "html"; editing = { el, id: wEl.dataset.pb, field, rich };
    el.setAttribute("contenteditable", "true"); el.focus();
    const r = fdoc.createRange(); r.selectNodeContents(el); const sl = fdoc.defaultView.getSelection(); sl.removeAllRanges(); sl.addRange(r);
    if (rich) showRt(true);
    el.addEventListener("blur", endEdit, { once: true });
    el.addEventListener("keydown", ev => { if (!rich && ev.key === "Enter") { ev.preventDefault(); el.blur(); } if (ev.key === "Escape") el.blur(); });
  }
  function endEdit() {
    if (!editing) return; const { el, id, field, rich } = editing; editing = null; showRt(false);
    el.removeAttribute("contenteditable");
    const inf = find(id); if (inf) { inf.set[field] = rich ? PB.cleanHtml(el.innerHTML) : el.textContent.replace(/\s+/g, " ").trim(); commitHist(); }
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
  function positionOverlay() {
    const ovl = $("pbx-ovl"); if (!ovl) return; ovl.innerHTML = "";
    if (!E.sel || !fdoc || !root) return; const inf = find(E.sel); if (!inf) return;
    const el = fdoc.querySelector(`[data-pb="${E.sel}"]`); if (!el) return;
    const r = el.getBoundingClientRect(), s = E.scale, st = $("pbx-stage"), fw = $("pbx-fw"), fr = fw.getBoundingClientRect(), sr = st.getBoundingClientRect();
    const win = fdoc.defaultView, ox = fr.left - sr.left + st.scrollLeft, oy = fr.top - sr.top + st.scrollTop;
    const box = document.createElement("div"); box.className = "pbx-box " + inf.kind;
    box.style.cssText = `left:${ox + r.left * s}px;top:${oy + r.top * s}px;width:${r.width * s}px;height:${r.height * s}px`;
    const lbl = inf.kind === "widget" ? WIDGETS[inf.node.type].label : inf.kind === "column" ? "عمود" : "قسم";
    const bar = document.createElement("div"); bar.className = "pbx-bar";
    const btn = (t, tt, fn, drag) => { const b = document.createElement("button"); b.textContent = t; b.title = tt; if (drag) { b.draggable = true; b.addEventListener("dragstart", e => { E.drag = { move: inf.node.id }; e.dataTransfer.setData("text/plain", "pb"); e.dataTransfer.effectAllowed = "move"; }); b.addEventListener("dragend", hideDrop); } else b.onclick = e => { e.stopPropagation(); fn(); }; bar.appendChild(b); };
    bar.innerHTML = `<span>${lbl}</span>`;
    if (inf.kind === "widget") btn("✥", "اسحب لنقل العنصر", null, true);
    btn(inf.kind === "column" ? "▶" : "↑", "تحريك", () => move(-1)); btn(inf.kind === "column" ? "◀" : "↓", "تحريك", () => move(1));
    if (inf.kind === "widget") btn("⇆", "نقل إلى العمود المجاور", () => moveCol());
    btn("⧉", "تكرار", dup);
    if (inf.kind === "section") btn("＋عمود", "إضافة عمود", () => addCol(inf.node)); if (inf.kind === "column") btn("＋عمود", "إضافة عمود بعده", () => addCol(inf.sec, inf.idx + 1));
    btn("🗑", "حذف", del);
    box.appendChild(bar);
    if (inf.kind !== "section" || true) {
      if (inf.kind !== "section") { const hl = document.createElement("div"); hl.className = "pbx-h l"; hl.title = "اسحب لتغيير العرض"; hl.onmousedown = e => startResize(e, "w", inf); box.appendChild(hl); }
      if (inf.kind !== "column") { const hb = document.createElement("div"); hb.className = "pbx-h b"; hb.title = "اسحب لتغيير الارتفاع"; hb.onmousedown = e => startResize(e, "h", inf); box.appendChild(hb); }
    }
    ovl.appendChild(box);
  }

  /* ───────────────── تغيير الحجم بالسحب ───────────────── */
  function startResize(e, mode, inf) {
    e.preventDefault(); e.stopPropagation();
    const el = fdoc.querySelector(`[data-pb="${inf.node.id}"]`), s = E.scale, dev = E.dev, x0 = e.clientX, y0 = e.clientY;
    const r0 = el.getBoundingClientRect(); let parentW = 0;
    if (mode === "w") { const p = inf.kind === "column" ? el.parentElement : el.parentElement; parentW = p.getBoundingClientRect().width; }
    const tip = document.createElement("div"); tip.className = "pbx-tip"; $("pbx-ovl").appendChild(tip);
    const shield = document.createElement("div"); shield.style.cssText = "position:fixed;inset:0;z-index:10001;cursor:" + (mode === "w" ? "ew-resize" : "ns-resize"); document.body.appendChild(shield);   // يلتقط الحركة فوق الـ iframe
    const centered = inf.kind === "widget" && eff(inf.set, "al", dev) === "center";
    let last = 0;
    /* عند تغيير عرض عمود يتكيّف العمود المجاور (إن كان له عرض صريح) ليبقى المجموع 100% */
    let nb = null, pair = 0;
    if (mode === "w" && inf.kind === "column") { const sibs = inf.sec.cols, nbn = sibs[inf.idx + 1] || sibs[inf.idx - 1]; if (nbn && eff(nbn.set, "w", dev) != null && eff(inf.set, "w", dev) != null) { nb = nbn; pair = Number(eff(inf.set, "w", dev)) + Number(eff(nbn.set, "w", dev)); } }
    const mv = ev => {
      const dx = (ev.clientX - x0) / s, dy = (ev.clientY - y0) / s;
      if (mode === "w") {
        let px = r0.width - dx * (centered ? 2 : 1); let pct = px / parentW * 100; const snap = ev.shiftKey ? 5 : 1; pct = Math.round(pct / snap) * snap; pct = Math.max(5, Math.min(100, pct));
        setR(inf.set, "w", dev, pct); if (nb) setR(nb.set, "w", dev, Math.max(5, Math.round((pair - pct) * 10) / 10)); tip.textContent = pct + "%"; last = pct;
      } else {
        let h = Math.round(Math.max(0, r0.height + dy)); if (ev.shiftKey) h = Math.round(h / 10) * 10;
        setR(inf.set, "mh", dev, h); tip.textContent = h + "px"; last = h;
      }
      tip.style.left = (ev.clientX - $("pbx-stage").getBoundingClientRect().left + 14) + "px"; tip.style.top = (ev.clientY - $("pbx-stage").getBoundingClientRect().top + 14) + "px";
      renderCanvas(); positionOverlay(); $("pbx-ovl").appendChild(tip);
    };
    const up = () => { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); shield.remove(); tip.remove(); commitHist(); renderInspector(); };
    document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up);
  }

  /* ───────────────── عمليات على النموذج ───────────────── */
  function afterEdit(sel) { if (sel !== undefined) E.sel = sel; commitHist(); renderCanvas(); renderInspector(); renderLeft(); }
  function move(d) {
    const inf = selInfo(); if (!inf) return; const j = inf.idx + d;
    if (inf.kind === "widget" && (j < 0 || j >= inf.list.length)) { moveCol(d > 0 ? 1 : -1, true); return; }
    if (j < 0 || j >= inf.list.length) return; [inf.list[inf.idx], inf.list[j]] = [inf.list[j], inf.list[inf.idx]]; afterEdit();
  }
  function moveCol(dir, atEdge) {
    const inf = selInfo(); if (!inf || inf.kind !== "widget") return; const cols = inf.sec.cols, ci = cols.indexOf(inf.col);
    let to = ci + (dir || 1); if (to >= cols.length) to = 0; if (to < 0) to = cols.length - 1; if (to === ci) return;
    inf.list.splice(inf.idx, 1); const tgt = cols[to].widgets; if (atEdge && dir < 0) tgt.push(inf.node); else tgt.splice(atEdge ? 0 : tgt.length, 0, inf.node); afterEdit();
  }
  function reId(n) { n.id = uid(); (n.cols || []).forEach(reId); (n.widgets || []).forEach(reId); return n; }
  function dup() { const inf = selInfo(); if (!inf) return; const c = reId(clone(inf.node)); inf.list.splice(inf.idx + 1, 0, c); afterEdit(c.id); }
  function del() { const inf = selInfo(); if (!inf) return; if (inf.kind === "column" && inf.sec.cols.length === 1) { toast("القسم يحتاج عموداً واحداً على الأقل — احذف القسم كله"); return; } inf.list.splice(inf.idx, 1); afterEdit(null); }
  function addCol(sec, at) { const c = PB.mkC([]); if (at == null) sec.cols.push(c); else sec.cols.splice(at, 0, c); sec.cols.forEach(x => { if (x.set.w) delete x.set.w; }); afterEdit(c.id); }
  function addWidget(type, col, at) {
    const w = PB.mkW(type); col = col || targetCol(); if (at == null) col.widgets.push(w); else col.widgets.splice(at, 0, w); afterEdit(w.id);
    setTimeout(() => { const el = fdoc.querySelector(`[data-pb="${w.id}"]`); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 50);
  }
  function targetCol() {
    const inf = selInfo();
    if (inf) { if (inf.kind === "widget") return inf.col; if (inf.kind === "column") return inf.node; if (inf.kind === "section") return inf.node.cols[0]; }
    let sec = E.page.sections[E.page.sections.length - 1]; if (!sec) { sec = PB.mkS(); E.page.sections.push(sec); } return sec.cols[sec.cols.length - 1];
  }
  function mkTpl(k) {
    if (TPLS[k]) return TPLS[k].f();
    const n = { _blank: 1, _two: 2, _three: 3 }[k] || 1; return PB.mkS(Array.from({ length: n }, () => PB.mkC([])));
  }
  function addSection(k, at) { const s = mkTpl(k); if (at == null) { const inf = selInfo(); at = inf ? inf.sec ? E.page.sections.indexOf(inf.sec) + 1 : E.page.sections.length : E.page.sections.length; } E.page.sections.splice(at, 0, s); afterEdit(s.id); setTimeout(() => { const el = fdoc.querySelector(`[data-pb="${s.id}"]`); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 50); }

  /* ───────────────── السحب والإفلات ───────────────── */
  function dropTarget(e) {
    const t = fdoc.elementFromPoint(e.clientX, e.clientY); if (!t) return null;
    if (E.drag && E.drag.tpl) {
      const secs = [...root.querySelectorAll(".pb-sec")]; let at = secs.length;
      for (let i = 0; i < secs.length; i++) { const r = secs[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { at = i; break; } }
      const ref = secs[at] || secs[secs.length - 1];
      return { type: "sec", at, y: ref ? (secs[at] ? ref.getBoundingClientRect().top : ref.getBoundingClientRect().bottom) : 0, x: 0, w: fdoc.documentElement.clientWidth };
    }
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
    if (dr.add) { addWidget(dr.add, tg.col, tg.at); return; }
    if (dr.move) { const inf = find(dr.move); if (!inf) return; if (inf.kind === "widget") { inf.list.splice(inf.idx, 1); tg.col.widgets.splice(Math.min(tg.at, tg.col.widgets.length), 0, inf.node); afterEdit(inf.node.id); } }
  }
  document.addEventListener("dragstart", e => { const w = e.target.closest && e.target.closest("[data-add],[data-tpl]"); if (!w) return; E.drag = w.dataset.add ? { add: w.dataset.add } : { tpl: w.dataset.tpl }; e.dataTransfer.setData("text/plain", "pb"); e.dataTransfer.effectAllowed = "copyMove"; });
  document.addEventListener("dragend", () => { E.drag = null; hideDrop(); });
  document.addEventListener("click", e => {
    if (!$("pb-app") || !$("pb-app").contains(e.target)) return;
    const a = e.target.closest("[data-add]"); if (a) return addWidget(a.dataset.add);
    const t = e.target.closest("[data-tpl]"); if (t) return addSection(t.dataset.tpl);
    const l = e.target.closest("[data-sel]"); if (l) { select(l.dataset.sel); const el = fdoc.querySelector(`[data-pb="${l.dataset.sel}"]`); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }
  });
  function onKey(e) {
    if (!$("pb-app").classList.contains("on")) return;
    const tag = (e.target.tagName || "").toLowerCase(); if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); dup(); }
    else if (e.key === "Delete" && E.sel) { e.preventDefault(); del(); }
    else if (e.key === "Escape") select(null);
  }

  /* ───────────────── الإعدادات (Inspector) ───────────────── */
  function ctlsFor(inf) {
    let base, com;
    if (inf.kind === "widget") { base = inf.def.ctl.slice(); com = common("widget").filter(c => !(c.skipFor && c.skipFor.includes(inf.node.type))); }
    else if (inf.kind === "column") { base = COL_CTL.slice(); com = common("column"); }
    else { base = SEC_CTL.slice(); com = common("section"); }
    const have = new Set(base.map(c => c.k)); return base.concat(com.filter(c => !have.has(c.k)));
  }
  function renderInspector() {
    const el = $("pbx-insp"); if (!el) return; const inf = selInfo();
    if (!inf) { el.innerHTML = `<div class="pbx-ih">⚙️ الإعدادات</div><p style="color:#888;font-size:.85rem;line-height:1.8">انقر على أي قسم أو عمود أو عنصر في الصفحة لتعديل إعداداته.<br><br>• انقر مرتين على النص لتعديله مباشرة.<br>• اسحب المقبض الجانبي ↔ لتغيير العرض والسفلي ↕ للارتفاع (Shift = خطوات ثابتة).<br>• غيّر الجهاز من الأعلى: تعديلات التابلت والهاتف تُحفظ منفصلة وتتوارث من الأكبر.</p>`; return; }
    const lbl = inf.kind === "widget" ? WIDGETS[inf.node.type].ic + " " + WIDGETS[inf.node.type].label : inf.kind === "column" ? "▯ عمود" : "▤ قسم";
    const all = ctlsFor(inf).filter(c => c.tab === E.tab);
    el.innerHTML = `<div class="pbx-ih">${lbl}</div>
<div class="pbx-dv">${DEVS.map(d => `<button data-dev="${d}" class="${E.dev === d ? "on" : ""}" title="${DEVNAME[d]}">${DEVIC[d]}</button>`).join("")}</div>
<div class="pbx-itabs">${[["c", "محتوى"], ["s", "تنسيق"], ["a", "متقدم"]].map(([k, n]) => `<button data-itab="${k}" class="${E.tab === k ? "on" : ""}">${n}</button>`).join("")}</div>
${all.map(c => field(c, inf.set)).join("") || '<p style="color:#888;font-size:.82rem">لا توجد إعدادات في هذا التبويب.</p>'}`;
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
      case "select": b = `<select ${a} class="${inherited ? "inh" : ""}">${(inherited || ownV === undefined) && c.r ? `<option value=""${ownV === undefined ? " selected" : ""}>${inherited ? "↩ موروث" : "—"}</option>` : ""}${c.o.map(o => `<option value="${esc(o[0])}"${String(ownV ?? (c.r ? "" : set[k] ?? "")) === String(o[0]) && !(c.r && ownV === undefined) ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`; break;
      case "color": b = `<div class="pbx-row"><input type="color" ${a} value="${/^#[0-9a-f]{6}$/i.test(ownV || "") ? ownV : "#ffffff"}" class="sm"><span style="font-size:.75rem;color:#888">${esc(ownV || "—")}</span>${ownV ? `<button class="pbx-small sm" data-clr="${k}">مسح</button>` : ""}</div>`; break;
      case "switch": b = `<label style="font-weight:600"><input type="checkbox" ${a} ${effV ? "checked" : ""}> مفعّل</label>`; break;
      case "align": b = `<div class="pbx-al">${AL3.map(([v, t]) => `<button data-al="${k}" data-v="${v}" class="${(effV || "") === v ? "on" : ""}">${t}</button>`).join("")}</div>`; break;
      case "image": b = `<div class="pbx-row"><input type="text" ${a} value="${esc(ownV ?? "")}" placeholder="مسار/رابط الصورة"><button class="pbx-small sm" data-up="${k}">⬆ رفع</button></div>${ownV ? `<img src="${esc(/^(https?:|data:|\/)/.test(ownV) ? ownV : ownV)}" style="max-width:100%;max-height:80px;margin-top:.3rem;border-radius:6px">` : ""}`; break;
      case "dims": { const arr = (isR ? (ownV || effV) : set[k]) || []; b = `<div class="pbx-dims">${["أعلى", "يمين", "أسفل", "يسار"].map((n, i) => `<div><input type="number" data-k="${k}" data-t="dims" data-i="${i}" value="${arr[i] ?? ""}" placeholder="${isR && ownV === undefined && effV ? (effV[i] ?? "") : ""}"><small>${n}</small></div>`).join("")}</div>`; break; }
      case "rep": { const items = set[k] || []; b = items.map((it, i) => `<div class="pbx-rep">${c.f.map(([fk, fl]) => `<input type="text" data-rep="${k}" data-i="${i}" data-f="${fk}" placeholder="${esc(fl)}" value="${esc(it[fk] || "")}" style="margin-bottom:.3rem">`).join("")}<button class="pbx-small" data-repdel="${k}" data-i="${i}">حذف</button></div>`).join("") + `<button class="pbx-small" data-repadd="${k}">＋ إضافة عنصر</button>`; break; }
    }
    return `<div class="pbx-f">${head}${b}</div>`;
  }
  const AL3 = [["start", "بداية"], ["center", "وسط"], ["end", "نهاية"]];

  function applyVal(inf, c, val, idx) {
    const set = inf.set, k = c.k;
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
    const t = e.target; if (t.dataset.k || t.dataset.rep) { commitHist(); if (t.tagName === "SELECT" || t.type === "checkbox" || t.type === "color") { onInspInput(e); renderInspector(); } if (t.dataset.range) renderInspector(); }
    if (t.dataset.fileFor) {}
  }
  async function onInspClick(e) {
    const t = e.target.closest("button, [data-dev]"); if (!t) return; const inf = selInfo();
    if (t.dataset.dev) { setDev(t.dataset.dev); return; }
    if (t.dataset.itab) { E.tab = t.dataset.itab; renderInspector(); return; }
    if (!inf) return;
    if (t.dataset.rs) { const c = ctlByKey(inf, t.dataset.rs); if (c.r) setR(inf.set, c.k, E.dev, undefined); else delete inf.set[c.k]; afterEdit(); return; }
    if (t.dataset.clr) { delete inf.set[t.dataset.clr]; afterEdit(); return; }
    if (t.dataset.al) { const c = ctlByKey(inf, t.dataset.al); applyVal(inf, c, t.dataset.v); afterEdit(); return; }
    if (t.dataset.repadd) { const arr = inf.set[t.dataset.repadd] = inf.set[t.dataset.repadd] || []; arr.push({ q: "سؤال جديد", a: "الجواب" }); afterEdit(); return; }
    if (t.dataset.repdel) { inf.set[t.dataset.repdel].splice(Number(t.dataset.i), 1); afterEdit(); return; }
    if (t.dataset.up || t.dataset.upadd) {
      const multi = !!t.dataset.upadd, k = t.dataset.up || t.dataset.upadd;
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = multi;
      inp.onchange = async () => {
        const files = [...inp.files]; if (!files.length) return; toast("⏳ جارِ رفع " + files.length + " صورة...");
        try {
          const paths = []; for (const f of files) paths.push(await Admin.uploadImageFile(f, "assets/img/pages", "pg-"));
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
    return { site: { name: S.name, domain: S.domain, wa: S.waNumber }, products: (typeof Admin !== "undefined" && Admin.products) || [] };
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

  return { open, close, meta, setDev, undo, redo, preview, publish, ltab, slugEdit, renderCanvas, E, find };
})();

/* ───────── قائمة الصفحات في تبويب لوحة الإدارة ───────── */
const PBAdmin = {
  list: [],
  async init() { await this.refresh(); },
  async refresh() {
    const box = document.getElementById("pb-list"); if (!box) return;
    try { const f = await GH.getFile("assets/pages/index.json"); this.list = JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); } catch (e) { this.list = []; }
    const dom = (typeof SITE_CFG !== "undefined" && SITE_CFG.domain) || location.host;
    box.innerHTML = this.list.length ? `<table class="rt"><tr class="hd"><th>العنوان</th><th>الرابط</th><th>آخر تحديث</th><th>إجراءات</th></tr>${this.list.map(p => `<tr><td class="t"><b>${PB.esc(p.title)}</b></td><td data-l="الرابط"><a href="lp/${PB.esc(p.slug)}/" target="_blank" dir="ltr">/lp/${PB.esc(p.slug)}/</a></td><td data-l="آخر تحديث"><small>${PB.esc(p.updated || "")}</small></td><td class="act"><button class="small" onclick="PBAdmin.edit('${PB.esc(p.slug)}')">✏️ تعديل</button> <button class="small gray" onclick="PBAdmin.copyLink('${PB.esc(p.slug)}','${PB.esc(dom)}')">🔗 نسخ الرابط</button> <button class="small" style="background:var(--red);color:#fff" onclick="PBAdmin.unpublish('${PB.esc(p.slug)}')">إلغاء النشر</button></td></tr>`).join("")}</table>` : '<p class="hint">لا توجد صفحات بعد. اضغط «＋ صفحة جديدة» لبدء التصميم.</p>';
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
