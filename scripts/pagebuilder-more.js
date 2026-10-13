/* أدوات صور إضافية محلية (بلا API): ① كولاج (شبكات جاهزة من صور الصفحة) ② فيديو من الصورة (تقريب/تحريك Ken Burns بصيغة WebM/MP4) ③ إطار وهوية (حدّ، زوايا، بطاقة بظل، شعار محفوظ).
   كل أداة لها دوال نقية على Canvas في `_t` (قابلة للاختبار) ولوحة داخل «تعديل الصورة». المخرجات ترفع عبر PBApp.uploadBlob وتستبدل مصدر الصورة المحدّدة (التراجع عبر Ctrl+Z)، والفيديو يُنزَّل. */
const PBCollage = (() => {
  const A = () => PBApp, $ = id => document.getElementById(id);
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /* قوالب: خلايا نسبية [x,y,w,h] داخل مساحة 0..1 */
  const LAYOUTS = { h2: ["صورتان أفقياً", [[0, 0, .5, 1], [.5, 0, .5, 1]]], v2: ["صورتان عمودياً", [[0, 0, 1, .5], [0, .5, 1, .5]]], g4: ["شبكة 2×2", [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]]], r3: ["3 صفوف", [[0, 0, 1, 1 / 3], [0, 1 / 3, 1, 1 / 3], [0, 2 / 3, 1, 1 / 3]]], c3: ["3 أعمدة", [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]]], m3: ["كبيرة + صغيرتان", [[0, 0, .62, 1], [.62, 0, .38, .5], [.62, .5, .38, .5]]], m4: ["كبيرة + ثلاث", [[0, 0, 1, .62], [0, .62, 1 / 3, .38], [1 / 3, .62, 1 / 3, .38], [2 / 3, .62, 1 / 3, .38]]], g6: ["شبكة 3×2", [[0, 0, 1 / 3, .5], [1 / 3, 0, 1 / 3, .5], [2 / 3, 0, 1 / 3, .5], [0, .5, 1 / 3, .5], [1 / 3, .5, 1 / 3, .5], [2 / 3, .5, 1 / 3, .5]]] };
  const SIZES = [["1080x1080", "مربع 1080×1080"], ["1080x1350", "عمودي 4:5 — 1080×1350"], ["1080x1920", "طولي 9:16 — 1080×1920"], ["1600x900", "عريض 16:9 — 1600×900"]];
  /* نقية: يرسم الكولاج. imgs = قماش/صورة لكل خلية بالترتيب (الناقص يبقى فارغاً)، o = {layout, W, H, gap(px), radius(px), bg} */
  function render(imgs, o) {
    const W = o.W, H = o.H, c = mk(W, H), g = c.getContext("2d"), lay = (LAYOUTS[o.layout] || LAYOUTS.g4)[1], gap = Math.max(0, o.gap || 0), r = Math.max(0, o.radius || 0);
    g.fillStyle = o.bg || "#ffffff"; g.fillRect(0, 0, W, H);
    lay.forEach((cell, i) => {
      const x = cell[0] * W + gap / 2, y = cell[1] * H + gap / 2, w = cell[2] * W - gap, h = cell[3] * H - gap, im = imgs[i]; if (w <= 0 || h <= 0) return;
      g.save(); g.beginPath(); if (r > 0 && g.roundRect) g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else g.rect(x, y, w, h); g.clip();
      if (im) { const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, k = Math.max(w / iw, h / ih); g.drawImage(im, x + (w - iw * k) / 2, y + (h - ih * k) / 2, iw * k, ih * k); } else { g.fillStyle = "#e9e5da"; g.fillRect(x, y, w, h); }
      g.restore();
    });
    return c;
  }
  const S = { id: "", layout: "g4", size: "1080x1080", gap: 12, radius: 14, bg: "#ffffff", picks: [], pool: [], res: null, busy: false, msg: "" };
  const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => rej(new Error("تعذّر تحميل صورة")); im.src = A().localize(String(src)); });
  function poolOf(curSrc) {
    const out = [], add = u => { u = String(u || ""); if (u && !/^data:|\.svg(\?|$)/i.test(u) && !out.includes(u)) out.push(u); }; add(curSrc);
    try { const E = A().E; (E.page.media || []).forEach(add); const walk = ws => ws.forEach(w => { if (w.type === "image" && w.set) add(w.set.src); }); (E.page.sections || []).forEach(sec => { (sec.cols || []).forEach(c => walk(c.widgets || [])); walk(sec.free || []); }); } catch (e) { }
    return out.slice(0, 40);
  }
  function panel() {
    const need = (LAYOUTS[S.layout] || LAYOUTS.g4)[1].length;
    return `<div class="pbx-pz" id="pbcl"><p>اصنع كولاجاً من صور الصفحة: اختر القالب ثم انقر الصور بالترتيب (حتى ${need}).</p>
<div class="pbrt-row"><select id="pbcl-l" class="pbx-small">${Object.entries(LAYOUTS).map(([k, v]) => `<option value="${k}"${S.layout === k ? " selected" : ""}>${v[0]}</option>`).join("")}</select><select id="pbcl-s" class="pbx-small">${SIZES.map(([v, t]) => `<option value="${v}"${S.size === v ? " selected" : ""}>${t}</option>`).join("")}</select></div>
<div class="rt-g"><label>المسافة <input type="range" id="pbcl-g" min="0" max="60" value="${S.gap}"></label><label>الزوايا <input type="range" id="pbcl-r" min="0" max="80" value="${S.radius}"></label><label>الخلفية <input type="color" id="pbcl-b" value="${S.bg}"></label></div>
<div class="ep-n">الصور المختارة: <b id="pbcl-n">${S.picks.length}</b> / ${need} <button type="button" class="pbx-small" data-cl="clear">مسح</button></div>
<div id="pbcl-pool" style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;max-height:150px;overflow:auto">${S.pool.map((u, i) => `<img src="${esc(A().localize(u))}" data-cl="pick" data-i="${i}" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;cursor:pointer;outline:${S.picks.includes(i) ? "3px solid #7c3aed" : "none"}">`).join("")}</div>
<div style="margin:.4rem 0;text-align:center"><canvas id="pbcl-pv" style="max-width:100%;border-radius:6px;border:1px solid rgba(128,128,128,.3)"></canvas></div>
<div class="pbrt-row"><button type="button" class="pbx-small pz-go" data-cl="apply" id="pbcl-ap" disabled>✔ تطبيق على الصورة</button></div><div id="pbcl-msg" class="ep-n" style="min-height:1.2em">${esc(S.msg)}</div></div>`;
  }
  const say = t => { S.msg = t; const e = $("pbcl-msg"); if (e) e.textContent = t; };
  async function draw() {
    const cv = $("pbcl-pv"); if (!cv) return; const [W, H] = S.size.split("x").map(Number), k = Math.min(1, 300 / Math.max(W, H)), need = (LAYOUTS[S.layout] || LAYOUTS.g4)[1].length, picks = S.picks.slice(0, need);
    const ims = []; for (const i of picks) { try { ims.push(await loadImg(S.pool[i])); } catch (e) { ims.push(null); } }
    S.res = render(ims, { layout: S.layout, W: Math.round(W * k), H: Math.round(H * k), gap: S.gap * k, radius: S.radius * k, bg: S.bg }); cv.width = S.res.width; cv.height = S.res.height; cv.getContext("2d").drawImage(S.res, 0, 0);
    const n = $("pbcl-n"); if (n) n.textContent = picks.length; const ap = $("pbcl-ap"); if (ap) ap.disabled = !picks.length;
  }
  async function apply() {
    if (S.busy || !S.picks.length) return; S.busy = true; say("⏳ جارٍ إنشاء الكولاج…");
    try { const [W, H] = S.size.split("x").map(Number), need = (LAYOUTS[S.layout] || LAYOUTS.g4)[1].length, ims = []; for (const i of S.picks.slice(0, need)) ims.push(await loadImg(S.pool[i])); const out = render(ims, { layout: S.layout, W, H, gap: S.gap, radius: S.radius, bg: S.bg }), blob = await new Promise(r => out.toBlob(r, "image/webp", .93)), path = await A().uploadBlob(blob, "cl-" + Date.now().toString(36), { max: 4096, q: .93 }), q = A().find(S.id); if (q && path) { q.node.set.src = path; delete q.node.set.crop; A().E.nextLabel = "كولاج الصور"; A().commitAfter(S.id); say("✅ طُبِّق الكولاج"); } } catch (e) { say("⚠️ " + (e.message || e)); } S.busy = false;
  }
  function mount(host, inf) {
    if (S.id !== inf.node.id) { S.id = inf.node.id; S.picks = []; } S.pool = poolOf(inf.set.src); const root = host.querySelector("#pbcl"); if (!root) return; draw();
    root.addEventListener("change", e => { const t = e.target; if (t.id === "pbcl-l") { S.layout = t.value; S.picks = S.picks.slice(0, (LAYOUTS[S.layout] || LAYOUTS.g4)[1].length); root.parentNode.innerHTML = panel(); mount(host, inf); } else if (t.id === "pbcl-s") { S.size = t.value; draw(); } else if (t.id === "pbcl-b") { S.bg = t.value; draw(); } });
    root.addEventListener("input", e => { const t = e.target; if (t.id === "pbcl-g") { S.gap = +t.value; draw(); } else if (t.id === "pbcl-r") { S.radius = +t.value; draw(); } });
    root.addEventListener("click", e => { const t = e.target.closest("[data-cl]"); if (!t) return; const k = t.dataset.cl, need = (LAYOUTS[S.layout] || LAYOUTS.g4)[1].length;
      if (k === "pick") { const i = +t.dataset.i, at = S.picks.indexOf(i); if (at >= 0) S.picks.splice(at, 1); else if (S.picks.length < need) S.picks.push(i); else { say("اكتمل العدد — أزل صورة أو غيّر القالب"); return; } root.querySelectorAll('[data-cl="pick"]').forEach(im => { im.style.outline = S.picks.includes(+im.dataset.i) ? "3px solid #7c3aed" : "none"; }); draw(); }
      else if (k === "clear") { S.picks = []; root.querySelectorAll('[data-cl="pick"]').forEach(im => { im.style.outline = "none"; }); draw(); } else if (k === "apply") apply(); });
  }
  return { panel, mount, reset: () => { S.id = ""; S.picks = []; S.msg = ""; }, state: S, _t: { render, LAYOUTS } };
})();

const PBFrame = (() => {
  const A = () => PBApp, $ = id => document.getElementById(id);
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const LSK = "pbx_brand_logo";
  const S = { id: "", base: null, o: { border: 0, bcolor: "#ffffff", radius: 0, pad: 0, bg: "#ffffff", card: false, shadow: 0, logo: false, lpos: "br", lsize: 16, lop: 90 }, logo: null, msg: "", busy: false };
  try { const d = localStorage.getItem(LSK); if (d) { const im = new Image(); im.onload = () => { S.logo = im; }; im.src = d; } } catch (e) { }
  /* نقية: إطار (هامش بخلفية + حدّ + زوايا مدوّرة + ظل بطاقة) وختم شعار؛ تُرجع قماشاً جديداً أكبر قليلاً عند وجود هامش/ظل */
  function frame(src, o, logo) {
    const w = src.width, h = src.height, m = Math.min(w, h), pad = Math.round(m * (o.pad || 0) / 100), bw = Math.round(m * (o.border || 0) / 100), sh = Math.round(m * (o.shadow || 0) / 100), rad = Math.round(m * (o.radius || 0) / 100), ext = sh * 2 + (sh ? Math.round(sh * .3) : 0);
    const W = w + 2 * (pad + bw) + ext, H = h + 2 * (pad + bw) + ext, c = mk(W, H), g = c.getContext("2d"), cx = ext / 2 + (sh ? 0 : 0), cy = ext / 2, bx = cx, by = cy, bW = w + 2 * (pad + bw), bH = h + 2 * (pad + bw);
    const path = (x, y, ww, hh, r) => { g.beginPath(); if (r > 0 && g.roundRect) g.roundRect(x, y, ww, hh, Math.min(r, ww / 2, hh / 2)); else g.rect(x, y, ww, hh); };
    if (sh) { g.save(); g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = sh; g.shadowOffsetY = Math.round(sh * .35); g.fillStyle = "#fff"; path(bx, by, bW, bH, rad + bw); g.fill(); g.restore(); }
    if (bw || pad || o.card) { g.fillStyle = bw ? o.bcolor : o.bg; path(bx, by, bW, bH, rad + bw); g.fill(); if (bw && (pad || o.card)) { g.fillStyle = o.bg; path(bx + bw, by + bw, bW - 2 * bw, bH - 2 * bw, rad); g.fill(); } }
    g.save(); path(bx + bw + pad, by + bw + pad, w, h, Math.max(0, rad - (pad ? 0 : 0))); g.clip(); g.drawImage(src, bx + bw + pad, by + bw + pad, w, h); g.restore();
    if (o.logo && logo) { const lw = W * (o.lsize || 16) / 100, lh = lw * logo.height / logo.width, mm = W * .03, p = o.lpos || "br", x = p[1] === "l" ? mm : p[1] === "r" ? W - lw - mm : (W - lw) / 2, y = p[0] === "t" ? mm : p[0] === "b" ? H - lh - mm : (H - lh) / 2; g.save(); g.globalAlpha = Math.max(.05, Math.min(1, (o.lop == null ? 90 : o.lop) / 100)); g.drawImage(logo, x, y, lw, lh); g.restore(); }
    return c;
  }
  const rg = (id, k, min, max, t, v) => `<label>${t} <input type="range" id="${id}" min="${min}" max="${max}" value="${v}" data-fr="${k}"></label>`;
  function panel() {
    const o = S.o;
    return `<div class="pbx-pz" id="pbfr"><p>إطار وهوية: حدّ وزوايا وهامش وظل بطاقة، وختم شعار علامتك (يُحفظ في متصفحك).</p>
<div class="rt-g">${rg("pbfr-b", "border", 0, 12, "سماكة الحدّ", o.border)}<label>لون الحدّ <input type="color" data-fr="bcolor" value="${o.bcolor}"></label>${rg("pbfr-r", "radius", 0, 40, "الزوايا", o.radius)}${rg("pbfr-p", "pad", 0, 20, "الهامش الداخلي", o.pad)}<label>لون الهامش <input type="color" data-fr="bg" value="${o.bg}"></label>${rg("pbfr-s", "shadow", 0, 12, "ظل البطاقة", o.shadow)}</div>
<div class="rt-g"><label><input type="checkbox" data-fr="logo" ${o.logo ? "checked" : ""}> ختم شعار العلامة</label><label class="pbx-small" style="cursor:pointer">رفع الشعار<input type="file" accept="image/*" id="pbfr-lf" style="display:none"></label><span class="ep-n">${S.logo ? "✔ الشعار محفوظ" : "لم يُرفع شعار بعد"}</span>
<label>الموضع <select data-fr="lpos" class="pbx-small">${[["tl", "أعلى يسار"], ["tr", "أعلى يمين"], ["bl", "أسفل يسار"], ["br", "أسفل يمين"], ["mc", "الوسط"]].map(([k, t]) => `<option value="${k}"${o.lpos === k ? " selected" : ""}>${t}</option>`).join("")}</select></label>${rg("pbfr-ls", "lsize", 5, 50, "حجم الشعار", o.lsize)}${rg("pbfr-lo", "lop", 10, 100, "الشفافية", o.lop)}</div>
<div style="text-align:center;margin:.4rem 0;background:repeating-conic-gradient(#d8d4c8 0 25%,#fff 0 50%) 50%/14px 14px;border-radius:6px"><canvas id="pbfr-pv" style="max-width:100%"></canvas></div>
<div class="pbrt-row"><button type="button" class="pbx-small pz-go" data-frb="apply">✔ تطبيق على الصورة</button><button type="button" class="pbx-small" data-frb="reset">تصفير</button></div><div id="pbfr-msg" class="ep-n" style="min-height:1.2em">${S.msg}</div></div>`;
  }
  const say = t => { S.msg = t; const e = $("pbfr-msg"); if (e) e.textContent = t; };
  const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { const k = Math.min(1, 3000 / Math.max(im.naturalWidth, im.naturalHeight)), c = mk(im.naturalWidth * k, im.naturalHeight * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c); }; im.onerror = () => rej(new Error("تعذّر تحميل الصورة")); im.src = A().localize(String(src)); });
  function draw() { const cv = $("pbfr-pv"); if (!cv || !S.base) return; const k = Math.min(1, 320 / Math.max(S.base.width, S.base.height)), s = mk(S.base.width * k, S.base.height * k); s.getContext("2d").drawImage(S.base, 0, 0, s.width, s.height); const out = frame(s, S.o, S.logo); cv.width = out.width; cv.height = out.height; cv.getContext("2d").drawImage(out, 0, 0); }
  async function mount(host, inf) {
    const id = inf.node.id; if (S.id !== id || !S.base) { S.id = id; try { S.base = await loadImg(inf.set.src); } catch (e) { say("⚠️ " + e.message); return; } }
    const root = host.querySelector("#pbfr"); if (!root) return; draw();
    const upd = e => { const t = e.target, k = t.dataset && t.dataset.fr; if (!k) return; S.o[k] = t.type === "checkbox" ? t.checked : t.type === "range" ? +t.value : t.value; draw(); };
    root.addEventListener("input", upd); root.addEventListener("change", upd);
    const lf = $("pbfr-lf"); if (lf) lf.onchange = () => { const f = lf.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { S.logo = im; S.o.logo = true; try { if (String(r.result).length < 600000) localStorage.setItem(LSK, String(r.result)); } catch (e) { } host.innerHTML = panel(); mount(host, inf); }; im.src = String(r.result); }; r.readAsDataURL(f); };
    root.addEventListener("click", async e => { const t = e.target.closest("[data-frb]"); if (!t) return; if (t.dataset.frb === "reset") { Object.assign(S.o, { border: 0, radius: 0, pad: 0, shadow: 0, card: false, logo: false }); host.innerHTML = panel(); mount(host, inf); } else await apply(); });
  }
  async function apply() {
    if (S.busy || !S.base) return; S.busy = true; say("⏳ جارٍ التطبيق…");
    try { const out = frame(S.base, S.o, S.logo), alpha = !!(S.o.radius || S.o.shadow), blob = await new Promise(r => out.toBlob(r, alpha ? "image/png" : "image/webp", .93)), path = await A().uploadBlob(blob, "fr-" + Date.now().toString(36), { max: 4096, q: .93 }), q = A().find(S.id); if (q && path) { q.node.set.src = path; delete q.node.set.crop; A().E.nextLabel = "إطار وهوية"; S.base = out; A().commitAfter(S.id); say("✅ طُبِّق"); } } catch (e) { say("⚠️ " + (e.message || e)); } S.busy = false;
  }
  return { panel, mount, reset: () => { S.id = ""; S.base = null; S.msg = ""; }, state: S, _t: { frame } };
})();

const PBVideo = (() => {
  const A = () => PBApp, $ = id => document.getElementById(id);
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const EFFECTS = [["zin", "تقريب تدريجي"], ["zout", "ابتعاد تدريجي"], ["pl", "تحريك لليسار"], ["pr", "تحريك لليمين"], ["pu", "تحريك للأعلى"], ["pd", "تحريك للأسفل"], ["pulse", "نبض هادئ"]];
  const SIZES = [["720x720", "مربع 1:1"], ["720x900", "عمودي 4:5"], ["720x1280", "طولي 9:16 (ريلز/ستوري)"], ["1280x720", "عريض 16:9"]];
  /* نقية: يرسم الإطار t∈[0,1] من الحركة على اللوحة g (W×H) من صورة src بوضع cover مع زوم احتياطي لتتحرك داخله */
  function frameAt(g, src, W, H, t, fx, bg) {
    const e = t * t * (3 - 2 * t), iw = src.naturalWidth || src.width, ih = src.naturalHeight || src.height, base = Math.max(W / iw, H / ih); let z = 1.0, ox = 0, oy = 0; const room = .16;
    if (fx === "zin") z = 1 + room * e; else if (fx === "zout") z = 1 + room * (1 - e); else if (fx === "pulse") z = 1 + .06 * Math.sin(t * Math.PI * 2); else z = 1 + room;
    const dw = iw * base * z, dh = ih * base * z, mx = Math.max(0, dw - W) / 2, my = Math.max(0, dh - H) / 2;
    if (fx === "pl") ox = mx * (1 - 2 * e); else if (fx === "pr") ox = -mx * (1 - 2 * e); else if (fx === "pu") oy = my * (1 - 2 * e); else if (fx === "pd") oy = -my * (1 - 2 * e);
    g.fillStyle = bg || "#000"; g.fillRect(0, 0, W, H); g.drawImage(src, (W - dw) / 2 + ox, (H - dh) / 2 + oy, dw, dh);
  }
  const S = { id: "", src: null, fx: "zin", size: "720x720", dur: 5, bg: "#000000", busy: false, url: "", mime: "", msg: "", raf: 0 };
  const supported = () => typeof MediaRecorder !== "undefined" && !!HTMLCanvasElement.prototype.captureStream;
  const pickMime = () => ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || "";
  function panel() {
    return `<div class="pbx-pz" id="pbvd"><p>حوّل الصورة إلى فيديو قصير بحركة ناعمة (Ken Burns) للإعلانات والستوريز — محلياً بلا خادم. ${supported() ? "" : "<b style='color:#b45309'>متصفحك لا يدعم التسجيل من اللوحة.</b>"}</p>
<div class="pbrt-row"><select id="pbvd-f" class="pbx-small">${EFFECTS.map(([k, t]) => `<option value="${k}"${S.fx === k ? " selected" : ""}>${t}</option>`).join("")}</select><select id="pbvd-s" class="pbx-small">${SIZES.map(([k, t]) => `<option value="${k}"${S.size === k ? " selected" : ""}>${t}</option>`).join("")}</select></div>
<div class="rt-g"><label>المدة (ثانية) <b id="pbvd-dv">${S.dur}</b><input type="range" id="pbvd-d" min="2" max="12" value="${S.dur}"></label><label>لون الخلفية <input type="color" id="pbvd-b" value="${S.bg}"></label></div>
<div style="text-align:center;margin:.4rem 0"><canvas id="pbvd-pv" style="max-width:100%;border-radius:6px;border:1px solid rgba(128,128,128,.3)"></canvas></div>
<div class="pbrt-row"><button type="button" class="pbx-small" data-vd="play">▶ معاينة الحركة</button><button type="button" class="pbx-small pz-go" data-vd="make" ${supported() ? "" : "disabled"}>🎬 أنشئ الفيديو</button></div>
<div id="pbvd-out"></div><div id="pbvd-msg" class="ep-n" style="min-height:1.2em">${S.msg}</div></div>`;
  }
  const say = t => { S.msg = t; const e = $("pbvd-msg"); if (e) e.textContent = t; };
  const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => rej(new Error("تعذّر تحميل الصورة")); im.src = A().localize(String(src)); });
  function still() { const cv = $("pbvd-pv"); if (!cv || !S.src) return; const [W, H] = S.size.split("x").map(Number), k = Math.min(1, 280 / Math.max(W, H)); cv.width = Math.round(W * k); cv.height = Math.round(H * k); frameAt(cv.getContext("2d"), S.src, cv.width, cv.height, 0, S.fx, S.bg); }
  function play(ms) { cancelAnimationFrame(S.raf); const cv = $("pbvd-pv"); if (!cv || !S.src) return; const g = cv.getContext("2d"), t0 = performance.now(), dur = (ms || S.dur * 1000); const step = n => { const t = Math.min(1, (n - t0) / dur); frameAt(g, S.src, cv.width, cv.height, t, S.fx, S.bg); if (t < 1) S.raf = requestAnimationFrame(step); }; S.raf = requestAnimationFrame(step); }
  async function make() {
    if (S.busy || !S.src || !supported()) return; const mime = pickMime(); if (!mime) { say("لا يدعم المتصفح تسجيل الفيديو"); return; }
    S.busy = true; const [W, H] = S.size.split("x").map(Number), c = mk(W, H), g = c.getContext("2d"), stream = c.captureStream(30), rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4e6 }), chunks = []; rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise(r => { rec.onstop = r; }); rec.start(200); const t0 = performance.now(), dur = S.dur * 1000; frameAt(g, S.src, W, H, 0, S.fx, S.bg);
    await new Promise(res => { const step = n => { const t = Math.min(1, (n - t0) / dur); frameAt(g, S.src, W, H, t, S.fx, S.bg); say("⏳ تسجيل " + Math.round(t * 100) + "%"); if (t < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
    rec.stop(); await done; const blob = new Blob(chunks, { type: mime.split(";")[0] }); if (S.url) URL.revokeObjectURL(S.url); S.url = URL.createObjectURL(blob); S.mime = mime;
    const ext = /mp4/.test(mime) ? "mp4" : "webm", out = $("pbvd-out"); if (out) out.innerHTML = `<video src="${S.url}" controls loop muted playsinline style="max-width:100%;border-radius:6px"></video><div class="pbrt-row"><a class="pbx-small pz-go" href="${S.url}" download="alyssum-video.${ext}" style="text-decoration:none;display:inline-block">⬇ تنزيل الفيديو (${(blob.size / 1048576).toFixed(1)}MB)</a></div>`;
    say("✅ جاهز — يمكنك رفعه من «فيديو» في عناصر الصفحة"); S.busy = false; return blob;
  }
  async function mount(host, inf) {
    const id = inf.node.id; if (S.id !== id || !S.src) { S.id = id; try { S.src = await loadImg(inf.set.src); } catch (e) { say("⚠️ " + e.message); return; } }
    const root = host.querySelector("#pbvd"); if (!root) return; still();
    root.addEventListener("change", e => { const t = e.target; if (t.id === "pbvd-f") { S.fx = t.value; still(); play(1600); } else if (t.id === "pbvd-s") { S.size = t.value; still(); } else if (t.id === "pbvd-b") { S.bg = t.value; still(); } });
    root.addEventListener("input", e => { if (e.target.id === "pbvd-d") { S.dur = +e.target.value; const v = $("pbvd-dv"); if (v) v.textContent = S.dur; } });
    root.addEventListener("click", e => { const t = e.target.closest("[data-vd]"); if (!t) return; if (t.dataset.vd === "play") play(1800); else if (t.dataset.vd === "make") make(); });
  }
  return { panel, mount, reset: () => { cancelAnimationFrame(S.raf); S.id = ""; S.src = null; S.msg = ""; }, state: S, make, supported, _t: { frameAt, EFFECTS } };
})();
