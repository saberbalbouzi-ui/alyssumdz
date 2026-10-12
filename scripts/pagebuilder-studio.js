/* استوديو المنتج (المرحلة 2 من docs/photoroom-tools-report.md): صورة منتج ← صورة متجر احترافية بنقرات، داخل المتصفح وبلا API.
   ① نزع الخلفية (PBBgRemove) ← ② خلفية (لون/تدرّج/شفاف/منصة/مشهد) ← ③ ظل (ملامسة/ناعم/قوي) ← ④ حجم المنتج وموضعه (حدود ألفا) ← ⑤ مقاس منصة ← تطبيق/تنزيل.
   الدوال compose/bbox/hasAlpha نقية على Canvas وقابلة للاختبار؛ الخيارات تُحفظ في localStorage pbx_studio (أساس «قوالب المعالجة» في محرر الدفعات). */
const PBStudio = (() => {
  const SIZES = [["1000x1000", "مربع 1:1 — متجر (1000×1000)"], ["1080x1350", "عمودي 4:5 — إنستغرام"], ["1080x1920", "طولي 9:16 — ستوري/ريلز"], ["1920x1080", "عريض 16:9 — يوتيوب"], ["1200x630", "رابط/فيسبوك (1200×630)"], ["orig", "نفس نسبة الصورة"]];
  const BGS = [["white", "أبيض متجر", { type: "color", c1: "#ffffff" }], ["gray", "رمادي فاتح", { type: "color", c1: "#f1f2f4" }], ["cream", "كريمي", { type: "color", c1: "#f6efe4" }], ["warm", "دافئ", { type: "grad", c1: "#fff3e6", c2: "#f3d3b3" }], ["mint", "أخضر هادئ", { type: "grad", c1: "#eaf6ee", c2: "#bfe3cc" }], ["sky", "سماوي", { type: "grad", c1: "#eef5ff", c2: "#c4dbf7" }], ["dark", "داكن", { type: "grad", c1: "#2b2f33", c2: "#0d0f11" }], ["forest", "غابة", { type: "grad", c1: "#1d5a47", c2: "#0b2a21" }], ["none", "شفاف", { type: "none" }]];
  const SCENES = [1, 2, 3, 4, 5, 6].map(i => ({ id: "sc" + i, src: "assets/img/tpl/alyssum-sc" + i + ".webp", floor: .76 }));
  const DEF = { bg: "white", c1: "#ffffff", shadow: "contact", pad: .1, align: "center", size: "1000x1000", podium: false };
  const LSK = "pbx_studio";
  const S = { id: "", src: "", cut: null, bb: null, opt: Object.assign({}, DEF), busy: false, msg: "", scenes: {} };
  try { const o = JSON.parse(localStorage.getItem(LSK) || "null"); if (o && typeof o === "object") Object.assign(S.opt, o); } catch (e) { }
  const save = () => { try { localStorage.setItem(LSK, JSON.stringify(S.opt)); } catch (e) { } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ── دوال نقية ── */
  function hasAlpha(c) {
    const w = Math.min(c.width, 64), h = Math.min(c.height, 64), t = document.createElement("canvas"); t.width = w; t.height = h; const g = t.getContext("2d", { willReadFrequently: true }); g.drawImage(c, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data; let n = 0, edge = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = d[(y * w + x) * 4 + 3]; if (a < 250) { n++; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge++; } }
    return n > w * h * 0.03 && edge > (2 * (w + h)) * 0.5;      /* شفافية ملحوظة وعلى الحواف: صورة بخلفية شفافة فعلاً */
  }
  /* مستطيل المنتج (ألفا > thr) على نسخة مصغّرة ثم يُكبَّر */
  function bbox(c, thr) {
    thr = thr == null ? 12 : thr; const k = Math.min(1, 600 / Math.max(c.width, c.height)), w = Math.max(1, Math.round(c.width * k)), h = Math.max(1, Math.round(c.height * k)), t = document.createElement("canvas"); t.width = w; t.height = h;
    const g = t.getContext("2d", { willReadFrequently: true }); g.drawImage(c, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return { x: 0, y: 0, w: c.width, h: c.height };
    const X0 = Math.max(0, Math.floor(x0 / k) - 1), Y0 = Math.max(0, Math.floor(y0 / k) - 1), X1 = Math.min(c.width, Math.ceil((x1 + 1) / k) + 1), Y1 = Math.min(c.height, Math.ceil((y1 + 1) / k) + 1);
    return { x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0 };
  }
  const rgba = (hex, a) => { let x = String(hex || "#000").replace("#", ""); if (x.length === 3) x = x.replace(/./g, "$&$&"); const n = parseInt(x, 16) || 0; return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  function drawBg(g, W, H, bg, scene) {
    if (!bg || bg.type === "none") return;
    if (bg.type === "color") { g.fillStyle = bg.c1; g.fillRect(0, 0, W, H); return; }
    if (bg.type === "grad") { const gr = g.createLinearGradient(0, 0, W * .35, H); gr.addColorStop(0, bg.c1); gr.addColorStop(1, bg.c2 || bg.c1); g.fillStyle = gr; g.fillRect(0, 0, W, H); return; }
    if (bg.type === "scene" && scene) { const r = Math.max(W / scene.width, H / scene.height), w = scene.width * r, h = scene.height * r; g.drawImage(scene, (W - w) / 2, (H - h) / 2, w, h); }
  }
  function drawPodium(g, cx, floorY, rx, W, H, tint) {
    const ry = rx * .2, body = Math.max(H * .09, rx * .45), top = tint || "#f4f1ea", side = "#d9d4c8";
    const gr = g.createLinearGradient(cx - rx, 0, cx + rx, 0); gr.addColorStop(0, side); gr.addColorStop(.45, top); gr.addColorStop(1, "#bfb9ab");
    g.save(); g.fillStyle = gr; g.beginPath(); g.moveTo(cx - rx, floorY); g.lineTo(cx - rx, floorY + body); g.ellipse(cx, floorY + body, rx, ry, 0, Math.PI, 0, true); g.lineTo(cx + rx, floorY); g.closePath(); g.fill();
    g.fillStyle = top; g.beginPath(); g.ellipse(cx, floorY, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = Math.max(1, rx * .012); g.beginPath(); g.ellipse(cx, floorY, rx, ry, 0, Math.PI, 0, true); g.stroke(); g.restore();
  }
  /* يرسم المنتج على قماش بمقاس o.size ← Canvas. o: {size:[W,H], bg:{type,..}, scene, pad, align, shadow, podium} */
  function compose(cut, bb, o) {
    const [W, H] = o.size, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d"); g.imageSmoothingQuality = "high";
    bb = bb || bbox(cut); const pad = Math.min(.4, Math.max(.02, o.pad == null ? .1 : o.pad)), scene = o.bg && o.bg.type === "scene", floor = scene ? (o.sceneFloor || .76) : o.podium ? .78 : null;
    drawBg(g, W, H, o.bg, o.scene);
    const availW = W * (1 - 2 * pad) * (scene ? .62 : o.podium ? .8 : 1), availH = (floor === null ? H * (1 - 2 * pad) : H * floor - H * pad), sc = Math.min(availW / bb.w, availH / bb.h), dw = bb.w * sc, dh = bb.h * sc, cx = W / 2;
    let dy; if (floor !== null) dy = H * floor - dh; else dy = o.align === "bottom" ? H * (1 - pad) - dh : (H - dh) / 2; const dx = cx - dw / 2, foot = dy + dh;
    if (o.podium && !scene) drawPodium(g, cx, foot, Math.max(dw * .72, W * .22), W, H, o.podiumColor);
    if (o.shadow === "contact" || o.shadow === "contactStrong") {
      const op = o.shadow === "contact" ? .34 : .55, rx = dw * .5, ry = Math.max(5, dw * .07); g.save(); g.translate(cx, foot - ry * .25); g.scale(1, ry / rx);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, "rgba(0,0,0," + op + ")"); gr.addColorStop(.6, "rgba(0,0,0," + op * .45 + ")"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
    }
    g.save(); if (o.shadow === "soft" || o.shadow === "strong") { const k = o.shadow === "soft" ? 1 : 1.9; g.shadowColor = "rgba(0,0,0," + (.26 * Math.min(1.5, k)) + ")"; g.shadowBlur = dw * .05 * k; g.shadowOffsetY = dw * .03 * k; }
    g.drawImage(cut, bb.x, bb.y, bb.w, bb.h, dx, dy, dw, dh); g.restore();
    return cv;
  }
  const sizeOf = (opt, srcC) => { if (opt.size === "orig" && srcC) { const k = Math.min(1, 2000 / Math.max(srcC.width, srcC.height)); return [Math.round(srcC.width * k), Math.round(srcC.height * k)]; } const m = /^(\d+)x(\d+)$/.exec(opt.size); return m ? [+m[1], +m[2]] : [1000, 1000]; };
  const bgOf = opt => { if (opt.bg === "custom") return { type: "color", c1: opt.c1 || "#ffffff" }; if (/^sc\d$/.test(opt.bg)) return { type: "scene" }; const f = BGS.find(b => b[0] === opt.bg); return f ? f[2] : BGS[0][2]; };

  /* ── الواجهة (لوحة «استوديو المنتج» داخل «تعديل الصورة») ── */
  const A = () => PBApp;
  function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { const k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext("2d", { willReadFrequently: true }).drawImage(im, 0, 0, c.width, c.height); res(c); }; im.onerror = () => rej(new Error("تعذّر تحميل الصورة")); im.src = A().localize(String(src)); }); }
  async function sceneImg(id) { if (S.scenes[id]) return S.scenes[id]; const sc = SCENES.find(x => x.id === id); if (!sc) return null; const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("تعذّر تحميل المشهد")); i.src = (A().siteCtx && A().siteCtx().base || "") + sc.src; }); S.scenes[id] = im; return im; }
  const css = () => {
    if (document.getElementById("pbst-css")) return; const st = document.createElement("style"); st.id = "pbst-css";
    st.textContent = `#pbst{display:flex;flex-direction:column;gap:.55rem;font-size:.78rem}#pbst .pbst-n{margin:0;opacity:.85;line-height:1.7}
#pbst .pbst-pv{position:relative;border-radius:12px;overflow:hidden;background:repeating-conic-gradient(#cfcfcf 0 25%,#fff 0 50%) 50%/16px 16px;display:flex;align-items:center;justify-content:center;min-height:150px;border:1px solid rgba(128,128,128,.35)}#pbst canvas{max-width:100%;max-height:300px;display:block}
#pbst .pbst-ms{position:absolute;inset:auto 0 0 0;padding:.35rem .5rem;font-weight:700;background:rgba(9,24,18,.78);color:#fff;font-size:.72rem;display:none}#pbst .pbst-ms.on{display:block}
#pbst label.pbst-l{font-weight:800;opacity:.9;display:block;margin-bottom:.2rem}#pbst .pbst-sw{display:flex;flex-wrap:wrap;gap:.3rem}
#pbst .pbst-sw button{width:34px;height:34px;border-radius:9px;border:2px solid rgba(128,128,128,.4);cursor:pointer;padding:0;font-size:.6rem;font-weight:800;color:#222;overflow:hidden;background-size:cover;background-position:center}#pbst .pbst-sw button.on{border-color:#4ade80;box-shadow:0 0 0 2px rgba(74,222,128,.45)}
#pbst select,#pbst input[type=range]{width:100%}#pbst .pbst-row{display:grid;grid-template-columns:1fr 1fr;gap:.4rem}#pbst .pbst-act{display:flex;flex-wrap:wrap;gap:.4rem}#pbst .pbst-act button{flex:1 1 auto}
#pbst .pbst-ck{display:flex;align-items:center;gap:.4rem;font-weight:700}`;
    document.head.appendChild(st);
  };
  function panel() {
    css(); const o = S.opt;
    const sw = BGS.map(([k, n, b]) => `<button type="button" data-st-bg="${k}" class="${o.bg === k ? "on" : ""}" title="${esc(n)}" style="${b.type === "grad" ? `background:linear-gradient(135deg,${b.c1},${b.c2})` : b.type === "color" ? `background:${b.c1}` : "background:repeating-conic-gradient(#cfcfcf 0 25%,#fff 0 50%) 50%/10px 10px"}"></button>`).join("")
      + SCENES.map(sc => `<button type="button" data-st-bg="${sc.id}" class="${o.bg === sc.id ? "on" : ""}" title="مشهد طبيعي" style="background-image:url('${esc(sc.src)}')"></button>`).join("")
      + `<button type="button" data-st-bg="custom" class="${o.bg === "custom" ? "on" : ""}" title="لون مخصص" style="background:${esc(o.c1 || "#ffffff")}">＋</button>`;
    return `<div id="pbst"><p class="pbst-n">حوّل صورة منتجك إلى صورة متجر احترافية: تُنزع الخلفية داخل متصفحك ثم تختار الخلفية والظل والمقاس.</p>
<div class="pbst-pv"><canvas id="pbst-cv" width="10" height="10"></canvas><div class="pbst-ms" id="pbst-ms"></div></div>
<div class="pbst-act"><button type="button" class="pbx-small pz-go" data-st="cut" id="pbst-cut">① انزع الخلفية</button></div>
<div class="pbst-act"><button type="button" class="pbx-small pz-go" data-st="apply">تطبيق على الصورة</button><button type="button" class="pbx-small" data-st="dl">تنزيل</button><button type="button" class="pbx-small" data-st="reset">استعادة الافتراضي</button></div>
<div><label class="pbst-l">الخلفية</label><div class="pbst-sw">${sw}</div><input type="color" id="pbst-c1" value="${esc(o.c1 || "#ffffff")}" style="width:100%;margin-top:.3rem;display:${o.bg === "custom" ? "block" : "none"}"></div>
<div class="pbst-row"><div><label class="pbst-l">الظل</label><select id="pbst-sh"><option value="contact">ملامسة (الأنسب)</option><option value="contactStrong">ملامسة قوية</option><option value="soft">ناعم</option><option value="strong">قوي</option><option value="none">بدون</option></select></div>
<div><label class="pbst-l">الموضع</label><select id="pbst-al"><option value="center">في الوسط</option><option value="bottom">على الأرض</option></select></div></div>
<div><label class="pbst-l">حجم المنتج <span id="pbst-pv-n"></span></label><input type="range" id="pbst-pad" min="2" max="35" step="1" value="${Math.round((1 - o.pad * 2) * 100) ? Math.round(o.pad * 100) : 10}"></div>
<label class="pbst-ck"><input type="checkbox" id="pbst-pod" ${o.podium ? "checked" : ""}> منصة عرض تحت المنتج</label>
<div><label class="pbst-l">المقاس</label><select id="pbst-sz">${SIZES.map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join("")}</select></div></div>`;
  }
  let drawT = 0;
  async function draw() {
    const cv = document.getElementById("pbst-cv"); if (!cv) return; const base = S.cut;
    if (!base) { const s = S.srcC; if (s) { const k = Math.min(1, 300 / Math.max(s.width, s.height)); cv.width = Math.round(s.width * k); cv.height = Math.round(s.height * k); cv.getContext("2d").drawImage(s, 0, 0, cv.width, cv.height); } return; }
    const [W, H] = sizeOf(S.opt, S.srcC), k = Math.min(1, 320 / Math.max(W, H)), o = Object.assign({}, S.opt, { bg: bgOf(S.opt), size: [Math.round(W * k), Math.round(H * k)], scene: null, sceneFloor: SCENES[0].floor });
    if (/^sc\d$/.test(S.opt.bg)) { try { o.scene = await sceneImg(S.opt.bg); } catch (e) { } }
    const out = compose(base, S.bb, o); cv.width = out.width; cv.height = out.height; cv.getContext("2d").drawImage(out, 0, 0);
  }
  const redraw = () => { clearTimeout(drawT); drawT = setTimeout(draw, 40); };
  function say(t) { S.msg = t; const m = document.getElementById("pbst-ms"); if (m) { m.textContent = t; m.classList.toggle("on", !!t); } }
  async function ensureCut(inf) {
    if (S.cut) return true;
    say("⏳ جارِ تحميل الصورة…"); S.srcC = S.srcC || await loadImg(inf.node.set.src);
    if (hasAlpha(S.srcC)) { S.cut = S.srcC; S.bb = bbox(S.cut); say(""); return true; }
    say("⏳ جارِ نزع الخلفية داخل متصفحك…");
    const r = await PBBgRemove.autoCut(S.srcC, { onStep: m => say(m) }); S.cut = r.canvas; S.bb = bbox(S.cut); say(""); return true;
  }
  async function render(final) {
    const [W, H] = sizeOf(S.opt, S.srcC), o = Object.assign({}, S.opt, { bg: bgOf(S.opt), size: [W, H], scene: null, sceneFloor: SCENES[0].floor });
    if (/^sc\d$/.test(S.opt.bg)) o.scene = await sceneImg(S.opt.bg); return compose(S.cut, S.bb, o);
  }
  const toBlob = (c, type) => new Promise(r => c.toBlob(r, type || "image/png"));
  function mount(root, inf) {
    if (!root) return; css(); const id = inf.node.id, src = inf.node.set.src;
    if (S.id !== id || S.src !== src) { S.id = id; S.src = src; S.cut = null; S.bb = null; S.srcC = null; S.msg = ""; }
    const $ = i => root.querySelector("#" + i), o = S.opt;
    $("pbst-sh").value = o.shadow; $("pbst-al").value = o.align; $("pbst-sz").value = o.size; $("pbst-pv-n").textContent = Math.round((1 - o.pad * 2) * 100) + "%";
    const sync = () => { $("pbst-cut").style.display = S.cut ? "none" : ""; };
    sync(); say(S.msg);
    const run = async fn => { if (S.busy) return; S.busy = true; try { await fn(); } catch (e) { say("⚠️ " + (e && e.message || e)); console.error(e); } S.busy = false; sync(); };
    if (!S.srcC) run(async () => { say("⏳ جارِ تحميل الصورة…"); S.srcC = await loadImg(src); if (hasAlpha(S.srcC)) { S.cut = S.srcC; S.bb = bbox(S.cut); } say(""); }).then(redraw); else redraw();
    root.addEventListener("click", e => {
      const b = e.target.closest("[data-st-bg]"); if (b) { o.bg = b.dataset.stBg; if (o.bg === "custom") $("pbst-c1").style.display = "block"; else $("pbst-c1").style.display = "none"; root.querySelectorAll("[data-st-bg]").forEach(x => x.classList.toggle("on", x === b)); save(); redraw(); return; }
      const a = e.target.closest("[data-st]"); if (!a) return; const act = a.dataset.st;
      if (act === "cut") run(async () => { await ensureCut(inf); }).then(redraw);
      else if (act === "reset") { S.opt = Object.assign({}, DEF); save(); A().renderInspectorNow(); }
      else if (act === "dl") run(async () => { await ensureCut(inf); const c = await render(); const bl = await toBlob(c); const u = URL.createObjectURL(bl), l = document.createElement("a"); l.href = u; l.download = "product-studio.png"; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); say("✅ نُزّلت الصورة"); setTimeout(() => say(""), 1800); }).then(redraw);
      else if (act === "apply") run(async () => {
        await ensureCut(inf); say("⏳ جارِ تجهيز الصورة…"); const c = await render(), bl = await toBlob(c); say("⏳ جارِ رفع الصورة…");
        const path = await A().uploadBlob(bl, "studio-" + Date.now().toString(36), { max: 2600, q: .92 }), q = A().find(id); if (!q) throw new Error("لم يعد العنصر موجوداً");
        q.node.set.src = path; delete q.node.set.crop; q.node.set.hauto = true; A().E.nextLabel = "استوديو المنتج"; A().E.sel = id; A().renderCanvas(); A().commitAfter(id); say("✅ طُبِّقت على الصورة (Ctrl+Z للتراجع)"); S.src = path; S.cut = null; S.srcC = null;
      });
    });
    $("pbst-c1").addEventListener("input", e => { o.c1 = e.target.value; o.bg = "custom"; const cb = root.querySelector('[data-st-bg="custom"]'); if (cb) { cb.style.background = o.c1; root.querySelectorAll("[data-st-bg]").forEach(x => x.classList.toggle("on", x === cb)); } save(); redraw(); });
    $("pbst-sh").addEventListener("change", e => { o.shadow = e.target.value; save(); redraw(); });
    $("pbst-al").addEventListener("change", e => { o.align = e.target.value; save(); redraw(); });
    $("pbst-sz").addEventListener("change", e => { o.size = e.target.value; save(); redraw(); });
    $("pbst-pod").addEventListener("change", e => { o.podium = e.target.checked; save(); redraw(); });
    $("pbst-pad").addEventListener("input", e => { o.pad = +(Number(e.target.value) / 100).toFixed(3); $("pbst-pv-n").textContent = Math.round((1 - o.pad * 2) * 100) + "%"; save(); redraw(); });
  }
  return { panel, mount, compose, bbox, hasAlpha, sizeOf, bgOf, BGS, SIZES, SCENES, opts: () => S.opt, _S: S };
})();
