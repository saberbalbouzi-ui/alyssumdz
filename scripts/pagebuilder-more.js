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
    return `<div class="pbx-pz" id="pbcl"><p>اصنع كولاجاً من صور الصفحة: اختر القالب ثم انقر الصور بالترتيب (حتى ${need}) — يظهر مباشرة على الصورة ثم «تنفيذ» أو «إلغاء».</p>
<div class="pbrt-row"><select id="pbcl-l" class="pbx-small">${Object.entries(LAYOUTS).map(([k, v]) => `<option value="${k}"${S.layout === k ? " selected" : ""}>${v[0]}</option>`).join("")}</select><select id="pbcl-s" class="pbx-small">${SIZES.map(([v, t]) => `<option value="${v}"${S.size === v ? " selected" : ""}>${t}</option>`).join("")}</select></div>
<div class="rt-g"><label>المسافة <input type="range" id="pbcl-g" min="0" max="60" value="${S.gap}"></label><label>الزوايا <input type="range" id="pbcl-r" min="0" max="80" value="${S.radius}"></label><label>الخلفية <input type="color" id="pbcl-b" value="${S.bg}"></label></div>
<div class="ep-n">الصور المختارة: <b id="pbcl-n">${S.picks.length}</b> / ${need} <button type="button" class="pbx-small" data-cl="clear">مسح</button></div>
<div id="pbcl-pool" style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;max-height:150px;overflow:auto">${S.pool.map((u, i) => `<img src="${esc(A().localize(u))}" data-cl="pick" data-i="${i}" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;cursor:pointer;outline:${S.picks.includes(i) ? "3px solid #7c3aed" : "none"}">`).join("")}</div>
<div id="pbcl-msg" class="ep-n" style="min-height:1.2em">${esc(S.msg)}</div></div>`;
  }
  const say = t => { S.msg = t; const e = $("pbcl-msg"); if (e) e.textContent = t; };
  let ct = 0;
  async function draw() {
    const n = $("pbcl-n"), need = (LAYOUTS[S.layout] || LAYOUTS.g4)[1].length, picks = S.picks.slice(0, need); if (n) n.textContent = picks.length;
    clearTimeout(ct); ct = setTimeout(async () => {
      if (!picks.length) { A().liveClear(true); return; }
      const [W, H] = S.size.split("x").map(Number), k = Math.min(1, 1100 / Math.max(W, H)), ims = []; for (const i of picks) { try { ims.push(await loadImg(S.pool[i])); } catch (e) { ims.push(null); } }
      S.res = render(ims, { layout: S.layout, W: Math.round(W * k), H: Math.round(H * k), gap: S.gap * k, radius: S.radius * k, bg: S.bg });
      await A().liveCanvas(S.id, S.res, { tab: "cl", apply, cancel: () => { S.picks = []; } });
    }, 90);
  }
  async function apply() {
    if (S.busy || !S.picks.length) return; S.busy = true; say("⏳ جارٍ إنشاء الكولاج…");
    try { const [W, H] = S.size.split("x").map(Number), need = (LAYOUTS[S.layout] || LAYOUTS.g4)[1].length, ims = []; for (const i of S.picks.slice(0, need)) ims.push(await loadImg(S.pool[i])); const out = render(ims, { layout: S.layout, W, H, gap: S.gap, radius: S.radius, bg: S.bg }), blob = await new Promise(r => out.toBlob(r, "image/webp", .93)), path = await A().uploadBlob(blob, "cl-" + Date.now().toString(36), { max: 4096, q: .93 }), q = A().find(S.id); if (q && path) { q.node.set.src = path; delete q.node.set.crop; A().E.nextLabel = "كولاج الصور"; S.picks = []; A().liveClear(false); A().commitAfter(S.id); say("✅ نُفِّذ الكولاج"); } } catch (e) { say("⚠️ " + (e.message || e)); } S.busy = false;
  }
  function mount(host, inf) {
    if (S.id !== inf.node.id) { S.id = inf.node.id; S.picks = []; } S.pool = poolOf(inf.set.src); const root = host.querySelector("#pbcl"); if (!root) return; draw();
    root.addEventListener("change", e => { const t = e.target; if (t.id === "pbcl-l") { S.layout = t.value; S.picks = S.picks.slice(0, (LAYOUTS[S.layout] || LAYOUTS.g4)[1].length); root.parentNode.innerHTML = panel(); mount(host, inf); } else if (t.id === "pbcl-s") { S.size = t.value; draw(); } else if (t.id === "pbcl-b") { S.bg = t.value; draw(); } });
    root.addEventListener("input", e => { const t = e.target; if (t.id === "pbcl-g") { S.gap = +t.value; draw(); } else if (t.id === "pbcl-r") { S.radius = +t.value; draw(); } });
    root.addEventListener("click", e => { const t = e.target.closest("[data-cl]"); if (!t) return; const k = t.dataset.cl, need = (LAYOUTS[S.layout] || LAYOUTS.g4)[1].length;
      if (k === "pick") { const i = +t.dataset.i, at = S.picks.indexOf(i); if (at >= 0) S.picks.splice(at, 1); else if (S.picks.length < need) S.picks.push(i); else { say("اكتمل العدد — أزل صورة أو غيّر القالب"); return; } root.querySelectorAll('[data-cl="pick"]').forEach(im => { im.style.outline = S.picks.includes(+im.dataset.i) ? "3px solid #7c3aed" : "none"; }); draw(); }
      else if (k === "clear") { S.picks = []; root.querySelectorAll('[data-cl="pick"]').forEach(im => { im.style.outline = "none"; }); draw(); } });
  }
  return { panel, mount, poolOf, reset: () => { S.id = ""; S.picks = []; S.msg = ""; }, state: S, _t: { render, LAYOUTS } };
})();

const PBFrame = (() => {
  const A = () => PBApp, $ = id => document.getElementById(id);
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const LSK = "alyssum_brand_logo";      // يتزامن مع حسابك عبر PrivSync (s_brand_logo)
  const S = { id: "", base: null, o: { border: 0, bcolor: "#ffffff", radius: 0, pad: 0, bg: "#ffffff", card: false, shadow: 0, logo: false, lpos: "br", lsize: 16, lop: 90 }, logo: null, msg: "", busy: false };
  try { let d = localStorage.getItem(LSK); if (!d) { d = localStorage.getItem("pbx_brand_logo"); if (d) localStorage.setItem(LSK, d); } if (d) { const im = new Image(); im.onload = () => { S.logo = im; }; im.src = d; } } catch (e) { }
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
    return `<div class="pbx-pz" id="pbfr"><p>إطار وهوية: حدّ وزوايا وهامش وظل بطاقة، وختم شعار علامتك — يظهر مباشرة على الصورة ثم «تنفيذ» أو «إلغاء».</p>
<div class="rt-g">${rg("pbfr-b", "border", 0, 12, "سماكة الحدّ", o.border)}<label>لون الحدّ <input type="color" data-fr="bcolor" value="${o.bcolor}"></label>${rg("pbfr-r", "radius", 0, 40, "الزوايا", o.radius)}${rg("pbfr-p", "pad", 0, 20, "الهامش الداخلي", o.pad)}<label>لون الهامش <input type="color" data-fr="bg" value="${o.bg}"></label>${rg("pbfr-s", "shadow", 0, 12, "ظل البطاقة", o.shadow)}</div>
<div class="rt-g"><label><input type="checkbox" data-fr="logo" ${o.logo ? "checked" : ""}> ختم شعار العلامة</label><label class="pbx-small" style="cursor:pointer">رفع الشعار<input type="file" accept="image/*" id="pbfr-lf" style="display:none"></label><span class="ep-n">${S.logo ? "✔ الشعار محفوظ" : "لم يُرفع شعار بعد"}</span>
<label>الموضع <select data-fr="lpos" class="pbx-small">${[["tl", "أعلى يسار"], ["tr", "أعلى يمين"], ["bl", "أسفل يسار"], ["br", "أسفل يمين"], ["mc", "الوسط"]].map(([k, t]) => `<option value="${k}"${o.lpos === k ? " selected" : ""}>${t}</option>`).join("")}</select></label>${rg("pbfr-ls", "lsize", 5, 50, "حجم الشعار", o.lsize)}${rg("pbfr-lo", "lop", 10, 100, "الشفافية", o.lop)}</div>
<div class="pbrt-row"><button type="button" class="pbx-small" data-frb="reset">تصفير</button></div><div id="pbfr-msg" class="ep-n" style="min-height:1.2em">${S.msg}</div></div>`;
  }
  const say = t => { S.msg = t; const e = $("pbfr-msg"); if (e) e.textContent = t; };
  const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { const k = Math.min(1, 3000 / Math.max(im.naturalWidth, im.naturalHeight)), c = mk(im.naturalWidth * k, im.naturalHeight * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c); }; im.onerror = () => rej(new Error("تعذّر تحميل الصورة")); im.src = A().localize(String(src)); });
  const dirtyF = () => { const o = S.o; return !!(o.border || o.pad || o.radius || o.shadow || o.card || (o.logo && S.logo)); };
  let ft = 0;
  function draw() {
    if (!S.base) return; clearTimeout(ft); ft = setTimeout(async () => {
      if (!dirtyF()) { A().liveClear(true); return; }
      const k = Math.min(1, 1100 / Math.max(S.base.width, S.base.height)), s = mk(S.base.width * k, S.base.height * k); s.getContext("2d").drawImage(S.base, 0, 0, s.width, s.height);
      await A().liveCanvas(S.id, frame(s, S.o, S.logo), { tab: "fr", apply, cancel: () => { Object.assign(S.o, { border: 0, radius: 0, pad: 0, shadow: 0, card: false, logo: false }); } });
    }, 70);
  }
  async function mount(host, inf) {
    const id = inf.node.id; if (S.id !== id || !S.base) { S.id = id; try { S.base = await loadImg(inf.set.src); } catch (e) { say("⚠️ " + e.message); return; } }
    const root = host.querySelector("#pbfr"); if (!root) return; draw();
    const upd = e => { const t = e.target, k = t.dataset && t.dataset.fr; if (!k) return; S.o[k] = t.type === "checkbox" ? t.checked : t.type === "range" ? +t.value : t.value; draw(); };
    root.addEventListener("input", upd); root.addEventListener("change", upd);
    const lf = $("pbfr-lf"); if (lf) lf.onchange = () => { const f = lf.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { S.logo = im; S.o.logo = true; try { if (String(r.result).length < 600000) localStorage.setItem(LSK, String(r.result)); } catch (e) { } host.innerHTML = panel(); mount(host, inf); }; im.src = String(r.result); }; r.readAsDataURL(f); };
    root.addEventListener("click", async e => { const t = e.target.closest("[data-frb]"); if (!t) return; if (t.dataset.frb === "reset") { Object.assign(S.o, { border: 0, radius: 0, pad: 0, shadow: 0, card: false, logo: false }); A().liveClear(true); host.innerHTML = panel(); mount(host, inf); } });
  }
  async function apply() {
    if (S.busy || !S.base || !dirtyF()) return; S.busy = true; say("⏳ جارٍ التنفيذ…");
    try { const out = frame(S.base, S.o, S.logo), alpha = !!(S.o.radius || S.o.shadow), blob = await new Promise(r => out.toBlob(r, alpha ? "image/png" : "image/webp", .93)), path = await A().uploadBlob(blob, "fr-" + Date.now().toString(36), { max: 4096, q: .93 }), q = A().find(S.id); if (q && path) { q.node.set.src = path; delete q.node.set.crop; A().E.nextLabel = "إطار وهوية"; S.base = out; Object.assign(S.o, { border: 0, radius: 0, pad: 0, shadow: 0, card: false, logo: false }); A().liveClear(false); A().commitAfter(S.id); say("✅ نُفِّذ"); } } catch (e) { say("⚠️ " + (e.message || e)); } S.busy = false;
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
  /* قوالب فيديو للتجارة الإلكترونية: حركة + مقاس + مدة + خلفية + نمط العنوان. العنوان والسعر وزر الدعوة تُرسم على كل إطار بألوان الهوية البصرية وخطها (PBBrand) */
  const VTPL = [["story", "ستوري إعلان", "zin", "720x1280", 6, "#0b1d17", "bottom"], ["sale", "عرض خصم", "pulse", "720x900", 5, "#173f35", "badge"], ["lux", "فاخر هادئ", "zout", "720x900", 6, "#111111", "bottom"], ["reels", "ريلز ديناميكي", "pl", "720x1280", 5, "#0b1d17", "top"], ["wide", "واجهة عريضة", "pr", "1280x720", 5, "#ffffff", "bottom"], ["post", "منشور مربع", "pd", "720x720", 5, "#fbf8f2", "bottom"]];
  /* نقية: تُرسم فوق الإطار t∈[0,1] (العنوان يظهر تدريجياً بعد 12% والسعر والدعوة بعد 40%) */
  function overlay(g, W, H, t, o) {
    if (!o || (!o.title && !o.price && !o.cta)) return; const kit = (typeof PBBrand !== "undefined" ? PBBrand._t.load() : { colors: ["#173f35", "#c8a24b", "#fbf8f2", "#1c2420", "#d64545"], font: "Cairo" }), ff = "'" + (kit.font || "Cairo") + "','Cairo',sans-serif", u = Math.min(W, H) / 100, ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    const aT = ease((t - .12) / .18), aP = ease((t - .4) / .2), place = o.style || "bottom"; g.save(); g.direction = "rtl"; g.textAlign = "center"; g.textBaseline = "middle";
    const band = (y, h, a) => { g.globalAlpha = .86 * a; g.fillStyle = kit.colors[0]; g.fillRect(0, y, W, h); g.globalAlpha = a; };
    const ty = place === "top" ? H * .1 : H * .8, off = (1 - aT) * 18 * u;
    if (o.title) { const fs = Math.round(u * 6.2); g.font = "800 " + fs + "px " + ff; if (place !== "badge") band(ty - fs * 1.1 + off, fs * 2.2, aT); else g.globalAlpha = aT; g.fillStyle = kit.colors[2]; g.fillText(o.title, W / 2, ty + off, W * .9); }
    if (o.price && aP > 0) { const fs = Math.round(u * 5.4), r = place === "badge" ? u * 13 : 0; g.font = "900 " + fs + "px " + ff; g.globalAlpha = aP;
      if (place === "badge") { const cx = W * .82, cy = H * .17 + (1 - aP) * -20 * u; g.fillStyle = kit.colors[4]; g.beginPath(); g.arc(cx, cy, r * aP, 0, 7); g.fill(); g.fillStyle = "#fff"; g.fillText(o.price, cx, cy, r * 1.7); }
      else { const py = place === "top" ? H * .2 : H * .9, w = Math.min(W * .5, g.measureText(o.price).width + fs * 2); g.fillStyle = kit.colors[1]; g.beginPath(); g.roundRect ? g.roundRect(W / 2 - w / 2, py - fs, w, fs * 2, fs) : g.rect(W / 2 - w / 2, py - fs, w, fs * 2); g.fill(); g.fillStyle = kit.colors[0]; g.fillText(o.price, W / 2, py, w); } }
    if (o.cta && t > .7) { const a = ease((t - .7) / .15), fs = Math.round(u * 4); g.font = "800 " + fs + "px " + ff; g.globalAlpha = a; g.fillStyle = kit.colors[2]; g.fillText(o.cta, W / 2, place === "top" ? H * .93 : H * .96 - (place === "bottom" && o.price ? 0 : 0), W * .9); }
    g.restore();
  }
  const S = { tpl: "", title: "", price: "", cta: "", id: "", src: null, fx: "zin", size: "720x720", dur: 5, bg: "#000000", busy: false, url: "", mime: "", msg: "", raf: 0 };
  const supported = () => typeof MediaRecorder !== "undefined" && !!HTMLCanvasElement.prototype.captureStream;
  const pickMime = () => ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || "";
  function panel() {
    return `<div class="pbx-pz" id="pbvd"><p>حوّل الصورة إلى فيديو قصير بحركة ناعمة (Ken Burns) للإعلانات والستوريز — محلياً بلا خادم، بقوالب وعنوان وسعر وزر دعوة بألوان وخط هويتك البصرية. (توليد فيديو واقعي بالذكاء الاصطناعي غير متوفر بعد.) ${supported() ? "" : "<b style='color:#b45309'>متصفحك لا يدعم التسجيل من اللوحة.</b>"}</p>
<div class="ep-n"><b>قوالب جاهزة للتجارة الإلكترونية</b></div><div class="pbrt-row">${VTPL.map(x => `<button type="button" class="pbx-small${S.tpl === x[0] ? " pz-go" : ""}" data-vt="${x[0]}">${x[1]}</button>`).join("")}</div>
<div class="rt-g"><label>العنوان <input type="text" data-vtx="title" value="${(S.title || "").replace(/"/g, "&quot;")}" placeholder="مثال: عسل طبيعي 100%" style="width:100%"></label><label>السعر / العرض <input type="text" data-vtx="price" value="${(S.price || "").replace(/"/g, "&quot;")}" placeholder="مثال: 2500 دج" style="width:100%"></label><label>زر الدعوة <input type="text" data-vtx="cta" value="${(S.cta || "").replace(/"/g, "&quot;")}" placeholder="مثال: اطلب الآن" style="width:100%"></label></div>
<div class="pbrt-row"><select id="pbvd-f" class="pbx-small">${EFFECTS.map(([k, t]) => `<option value="${k}"${S.fx === k ? " selected" : ""}>${t}</option>`).join("")}</select><select id="pbvd-s" class="pbx-small">${SIZES.map(([k, t]) => `<option value="${k}"${S.size === k ? " selected" : ""}>${t}</option>`).join("")}</select></div>
<div class="rt-g"><label>المدة (ثانية) <b id="pbvd-dv">${S.dur}</b><input type="range" id="pbvd-d" min="2" max="12" value="${S.dur}"></label><label>لون الخلفية <input type="color" id="pbvd-b" value="${S.bg}"></label></div>
<div style="text-align:center;margin:.4rem 0"><canvas id="pbvd-pv" style="max-width:100%;border-radius:6px;border:1px solid rgba(128,128,128,.3)"></canvas></div>
<div class="pbrt-row"><button type="button" class="pbx-small" data-vd="play">▶ معاينة الحركة</button><button type="button" class="pbx-small pz-go" data-vd="make" ${supported() ? "" : "disabled"}>🎬 أنشئ الفيديو</button></div>
<div id="pbvd-out"></div><div id="pbvd-msg" class="ep-n" style="min-height:1.2em">${S.msg}</div></div>`;
  }
  const say = t => { S.msg = t; const e = $("pbvd-msg"); if (e) e.textContent = t; };
  const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => rej(new Error("تعذّر تحميل الصورة")); im.src = A().localize(String(src)); });
  function still() { const cv = $("pbvd-pv"); if (!cv || !S.src) return; const [W, H] = S.size.split("x").map(Number), k = Math.min(1, 280 / Math.max(W, H)); cv.width = Math.round(W * k); cv.height = Math.round(H * k); { const g0 = cv.getContext("2d"); frameAt(g0, S.src, cv.width, cv.height, 0, S.fx, S.bg); overlay(g0, cv.width, cv.height, .9, S); } }
  function play(ms) { cancelAnimationFrame(S.raf); const cv = $("pbvd-pv"); if (!cv || !S.src) return; const g = cv.getContext("2d"), t0 = performance.now(), dur = (ms || S.dur * 1000); const step = n => { const t = Math.min(1, (n - t0) / dur); frameAt(g, S.src, cv.width, cv.height, t, S.fx, S.bg); overlay(g, cv.width, cv.height, t, S); if (t < 1) S.raf = requestAnimationFrame(step); }; S.raf = requestAnimationFrame(step); }
  async function make() {
    if (S.busy || !S.src || !supported()) return; const mime = pickMime(); if (!mime) { say("لا يدعم المتصفح تسجيل الفيديو"); return; }
    S.busy = true; const [W, H] = S.size.split("x").map(Number), c = mk(W, H), g = c.getContext("2d"), stream = c.captureStream(30), rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4e6 }), chunks = []; rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise(r => { rec.onstop = r; }); rec.start(200); const t0 = performance.now(), dur = S.dur * 1000; frameAt(g, S.src, W, H, 0, S.fx, S.bg); overlay(g, W, H, 0, S);
    await new Promise(res => { const step = n => { const t = Math.min(1, (n - t0) / dur); frameAt(g, S.src, W, H, t, S.fx, S.bg); overlay(g, W, H, t, S); say("⏳ تسجيل " + Math.round(t * 100) + "%"); if (t < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
    rec.stop(); await done; const blob = new Blob(chunks, { type: mime.split(";")[0] }); if (S.url) URL.revokeObjectURL(S.url); S.url = URL.createObjectURL(blob); S.mime = mime;
    const ext = /mp4/.test(mime) ? "mp4" : "webm", out = $("pbvd-out"); if (out) out.innerHTML = `<video src="${S.url}" controls loop muted playsinline style="max-width:100%;border-radius:6px"></video><div class="pbrt-row"><a class="pbx-small pz-go" href="${S.url}" download="alyssum-video.${ext}" style="text-decoration:none;display:inline-block">⬇ تنزيل الفيديو (${(blob.size / 1048576).toFixed(1)}MB)</a></div>`;
    say("✅ جاهز — يمكنك رفعه من «فيديو» في عناصر الصفحة"); S.busy = false; return blob;
  }
  async function mount(host, inf) {
    const id = inf.node.id; if (S.id !== id || !S.src) { S.id = id; try { S.src = await loadImg(inf.set.src); } catch (e) { say("⚠️ " + e.message); return; } }
    const root = host.querySelector("#pbvd"); if (!root) return; still();
    root.addEventListener("change", e => { const t = e.target; if (t.id === "pbvd-f") { S.fx = t.value; still(); play(1600); } else if (t.id === "pbvd-s") { S.size = t.value; still(); } else if (t.id === "pbvd-b") { S.bg = t.value; still(); } });
    root.addEventListener("input", e => { if (e.target.id === "pbvd-d") { S.dur = +e.target.value; const v = $("pbvd-dv"); if (v) v.textContent = S.dur; } });
    root.addEventListener("input", e => { const k = e.target.dataset && e.target.dataset.vtx; if (k) { S[k] = e.target.value; still(); } });
    root.addEventListener("click", e => { const q = e.target.closest("[data-vt]"); if (q) { const x = VTPL.find(z => z[0] === q.dataset.vt); if (x) { S.tpl = x[0]; S.fx = x[2]; S.size = x[3]; S.dur = x[4]; S.bg = x[5]; S.style = x[6]; host.innerHTML = panel(); mount(host, inf); play(1800); } return; } const t = e.target.closest("[data-vd]"); if (!t) return; if (t.dataset.vd === "play") play(1800); else if (t.dataset.vd === "make") make(); });
  }
  return { panel, mount, reset: () => { cancelAnimationFrame(S.raf); S.id = ""; S.src = null; S.msg = ""; }, state: S, make, supported, _t: { frameAt, EFFECTS, overlay, VTPL } };
})();

/* «دمج صورة داخل صورة»: صورة صغيرة تُدمج في الكبيرة بحواف ناعمة (Contour fondu: مربع/دائرة + تمويه غاوسي) مع التحكم بالموضع (سحب على المعاينة) والحجم والشفافية وأسلوب المزج. */
const PBBlend = (() => {
  const A = () => PBApp, $ = id => document.getElementById(id);
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MODES = [["source-over", "عادي"], ["multiply", "تعتيم (Multiply)"], ["screen", "إضاءة (Screen)"], ["overlay", "تراكب (Overlay)"], ["soft-light", "ضوء ناعم"], ["lighten", "الأفتح"], ["darken", "الأغمق"]];
  /* نقية: o = {x,y مركز الصورة الصغيرة كنسبة 0..1 من الكبيرة، size % من عرض الكبيرة، shape rect|circle، blur 0..100 (تمويه الحواف)، op 5..100، mode} */
  function blend(base, over, o) {
    const W = base.width, H = base.height, c = mk(W, H), g = c.getContext("2d"); g.drawImage(base, 0, 0);
    const ow = over.naturalWidth || over.width, oh = over.naturalHeight || over.height, w = Math.max(8, W * Math.max(3, Math.min(100, o.size || 40)) / 100), h = w * oh / ow, k = Math.min(1, 1600 / Math.max(ow, oh)), s = mk(ow * k, oh * k); s.getContext("2d").drawImage(over, 0, 0, s.width, s.height);
    const f = PBFade._t.feather(s, { shape: o.shape || "rect", blur: o.blur == null ? 40 : o.blur }), x = (o.x == null ? .5 : o.x) * W - w / 2, y = (o.y == null ? .5 : o.y) * H - h / 2;
    g.save(); g.globalAlpha = Math.max(.05, Math.min(1, (o.op == null ? 100 : o.op) / 100)); try { g.globalCompositeOperation = o.mode || "source-over"; } catch (e) { } g.drawImage(f, x, y, w, h); g.restore(); return c;
  }
  const S = { id: "", base: null, over: null, o: { x: .5, y: .5, size: 40, shape: "circle", blur: 45, op: 100, mode: "source-over" }, pool: [], msg: "", busy: false, drag: false };
  const loadImg = (src, cap) => new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { const k = Math.min(1, (cap || 3000) / Math.max(im.naturalWidth, im.naturalHeight)), c = mk(im.naturalWidth * k, im.naturalHeight * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c); }; im.onerror = () => rej(new Error("تعذّر تحميل الصورة")); im.src = /^data:|^blob:/.test(String(src)) ? src : A().localize(String(src)); });
  function panel() {
    const o = S.o, sh = (k, t) => `<button type="button" class="pbx-small pz-pat${o.shape === k ? " on" : ""}" data-bl="shape" data-v="${k}">${t}</button>`;
    return `<div class="pbx-pz" id="pbbl"><p>ادمج صورة صغيرة داخل الصورة الكبيرة بحواف ناعمة (Contour fondu): اختر الصورة الصغيرة، اسحبها على المعاينة، واضبط الحجم والتمويه.</p>
<div id="pbbl-pool" style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;max-height:96px;overflow:auto">${S.pool.map((u, i) => `<img src="${esc(A().localize(u))}" data-bl="pick" data-i="${i}" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;cursor:pointer;outline:${S.overSrc === u ? "3px solid #7c3aed" : "none"}">`).join("")}</div>
<div class="pbrt-row"><label class="pbx-small" style="cursor:pointer">＋ رفع صورة صغيرة<input type="file" accept="image/*" id="pbbl-f" style="display:none"></label></div>
<div class="pbrt-row"><b>الشكل</b>${sh("rect", "▢ مربع")}${sh("circle", "◯ دائرة")}</div>
<div class="rt-g"><label>الحجم % <input type="range" id="pbbl-z" min="8" max="100" value="${o.size}"></label><label>تمويه الحواف (غاوسي) <input type="range" id="pbbl-b" min="0" max="100" value="${o.blur}"></label><label>الشفافية % <input type="range" id="pbbl-o" min="10" max="100" value="${o.op}"></label>
<label>أسلوب المزج <select id="pbbl-m" class="pbx-small">${MODES.map(([k, t]) => `<option value="${k}"${o.mode === k ? " selected" : ""}>${t}</option>`).join("")}</select></label></div>
<div style="text-align:center;margin:.4rem 0;background:repeating-conic-gradient(#d8d4c8 0 25%,#fff 0 50%) 50%/14px 14px;border-radius:6px"><canvas id="pbbl-pv" style="max-width:100%;cursor:move;touch-action:none"></canvas></div><div class="ep-n">اسحب الصورة الصغيرة على هذه المصغّرة لتحريكها — وتظهر النتيجة مباشرة على الصورة، ثم «تنفيذ» أو «إلغاء».</div>
<div id="pbbl-msg" class="ep-n" style="min-height:1.2em">${esc(S.msg)}</div></div>`;
  }
  const say = t => { S.msg = t; const e = $("pbbl-msg"); if (e) e.textContent = t; };
  let bt = 0;
  function draw() {
    const cv = $("pbbl-pv"); if (!cv || !S.base) return; const k = Math.min(1, 300 / Math.max(S.base.width, S.base.height)), b = mk(S.base.width * k, S.base.height * k); b.getContext("2d").drawImage(S.base, 0, 0, b.width, b.height);
    const out = S.over ? blend(b, S.over, S.o) : b; cv.width = out.width; cv.height = out.height; cv.getContext("2d").drawImage(out, 0, 0);
    clearTimeout(bt); bt = setTimeout(async () => { if (!S.over || !S.base) { A().liveClear(true); return; } const k2 = Math.min(1, 1100 / Math.max(S.base.width, S.base.height)), b2 = mk(S.base.width * k2, S.base.height * k2); b2.getContext("2d").drawImage(S.base, 0, 0, b2.width, b2.height); await A().liveCanvas(S.id, blend(b2, S.over, S.o), { tab: "bl", apply, cancel: () => { S.over = null; S.overSrc = ""; } }); }, 80);
  }
  async function setOver(src) { try { S.over = await loadImg(src, 1600); S.overSrc = src; say(""); const root = $("pbbl"); if (root) root.querySelectorAll('[data-bl="pick"]').forEach(im => { im.style.outline = S.pool[+im.dataset.i] === src ? "3px solid #7c3aed" : "none"; }); draw(); } catch (e) { say("⚠️ " + e.message); } }
  async function mount(host, inf) {
    const id = inf.node.id; if (S.id !== id || !S.base) { S.id = id; S.over = null; S.overSrc = ""; S.pool = PBCollage.poolOf(inf.set.src).filter(u => u !== inf.set.src); try { S.base = await loadImg(inf.set.src, 3000); } catch (e) { say("⚠️ " + e.message); return; } host.innerHTML = panel(); }
    const root = host.querySelector("#pbbl"); if (!root) return; draw();
    root.addEventListener("input", e => { const t = e.target; if (t.id === "pbbl-z") S.o.size = +t.value; else if (t.id === "pbbl-b") S.o.blur = +t.value; else if (t.id === "pbbl-o") S.o.op = +t.value; else return; draw(); });
    root.addEventListener("change", e => { if (e.target.id === "pbbl-m") { S.o.mode = e.target.value; draw(); } else if (e.target.id === "pbbl-f") { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => setOver(String(r.result)); r.readAsDataURL(f); } });
    root.addEventListener("click", e => { const t = e.target.closest("[data-bl]"); if (!t) return; const k = t.dataset.bl; if (k === "shape") { S.o.shape = t.dataset.v; root.querySelectorAll('[data-bl="shape"]').forEach(b => b.classList.toggle("on", b.dataset.v === S.o.shape)); draw(); } else if (k === "pick") setOver(S.pool[+t.dataset.i]); });
    const cv = $("pbbl-pv"); if (cv && !cv._bl) { cv._bl = 1; const mv = e => { const r = cv.getBoundingClientRect(); S.o.x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); S.o.y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)); draw(); }; cv.addEventListener("pointerdown", e => { if (!S.over) return; S.drag = true; cv.setPointerCapture(e.pointerId); mv(e); }); cv.addEventListener("pointermove", e => { if (S.drag) mv(e); }); cv.addEventListener("pointerup", () => { S.drag = false; }); }
  }
  async function apply() {
    if (S.busy || !S.over || !S.base) return; S.busy = true; say("⏳ جارٍ الدمج…");
    try { const out = blend(S.base, S.over, S.o), blob = await new Promise(r => out.toBlob(r, "image/webp", .93)), path = await A().uploadBlob(blob, "bl-" + Date.now().toString(36), { max: 4096, q: .93 }), q = A().find(S.id); if (q && path) { q.node.set.src = path; delete q.node.set.crop; A().E.nextLabel = "دمج صورة داخل صورة"; S.base = out; S.over = null; S.overSrc = ""; A().liveClear(false); A().commitAfter(S.id); say("✅ نُفِّذ الدمج"); draw(); } } catch (e) { say("⚠️ " + (e.message || e)); } S.busy = false;
  }
  return { panel, mount, reset: () => { S.id = ""; S.base = null; S.over = null; S.overSrc = ""; S.msg = ""; }, state: S, _t: { blend, MODES } };
})();

/* الهوية البصرية (v1.89.257): ألوان العلامة + خطها + شعارها تُحفظ مرة واحدة (localStorage) وتُطبَّق على الصورة المحدّدة:
   إطار/خلفية بلون من الألوان، ختم الشعار، واسم العلامة بخطّها. الافتراضي يُستورد من ألوان الموقع وخطه واسم المتجر (theme.json وstore.json). معاينة حيّة ثم «تنفيذ/إلغاء». */
const PBBrand = (() => {
  const A = () => PBApp, $ = id => document.getElementById(id);
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LSK = "alyssum_brand_kit", LSL = "alyssum_brand_logo";      // تتزامن بين أجهزتك عبر PrivSync (s_brand_kit / s_brand_logo)
  const SLOTS = ["الأساسي", "الثانوي", "الخلفية", "النص", "التمييز"];
  const DEF = { colors: ["#173f35", "#c8a24b", "#fbf8f2", "#1c2420", "#d64545"], font: "Cairo", name: "" };
  const S = { id: "", base: null, kit: null, logo: null, msg: "", busy: false, site: false, o: { border: 0, bcol: 1, pad: 0, bgc: 2, radius: 0, logo: false, lpos: "br", lsize: 16, lop: 90, txt: false, tpos: "bc", tsize: 6, tcol: 2, band: true } };
  const load = () => { if (S.kit) return S.kit; let k = null; try { const raw = localStorage.getItem(LSK) || localStorage.getItem("pbx_brand_kit"); k = JSON.parse(raw || "null"); } catch (e) { } S.kit = Object.assign({}, DEF, k && typeof k === "object" ? k : {}); if (!Array.isArray(S.kit.colors) || S.kit.colors.length < 5) S.kit.colors = DEF.colors.slice(); return S.kit; };
  const save = () => { try { localStorage.setItem(LSK, JSON.stringify(S.kit)); } catch (e) { } };
  try { const d = localStorage.getItem(LSL) || localStorage.getItem("pbx_brand_logo"); if (d) { const im = new Image(); im.onload = () => { S.logo = im; }; im.src = d; } } catch (e) { }
  const hex = v => /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : "#000000";
  const FONTS = () => (typeof PB !== "undefined" && PB.FONT_FAMS ? PB.FONT_FAMS.filter(x => !x[3]) : []).map(([n, w, l]) => [n, l === n ? n : l + " (" + n + ")"]);
  async function loadFont(name) {
    if (!document.getElementById("pbfonts-a") && typeof PB !== "undefined" && PB.fontsHref) { const l = document.createElement("link"); l.id = "pbfonts-a"; l.rel = "stylesheet"; l.href = PB.fontsHref(PB.FONT_FAMS.map(x => x[0])); document.head.appendChild(l); }
    if (document.fonts) await Promise.race([document.fonts.load("800 24px '" + name + "'", "أبجد Abc"), new Promise(r => setTimeout(r, 1500))]).catch(() => { });
  }
  /* نقية: تُرجع قماشاً بإطار/خلفية بألوان العلامة + شعار + اسم العلامة بخطها */
  function render(src, kit, o, logo) {
    const col = i => hex(kit.colors[i]), fo = { border: o.border, bcolor: col(o.bcol), radius: o.radius, pad: o.pad, bg: col(o.bgc), card: false, shadow: 0, logo: !!(o.logo && logo), lpos: o.lpos, lsize: o.lsize, lop: o.lop };
    const c = (fo.border || fo.pad || fo.logo || fo.radius) ? PBFrame._t.frame(src, fo, logo) : (() => { const x = mk(src.width, src.height); x.getContext("2d").drawImage(src, 0, 0); return x; })();
    if (o.txt && kit.name) {
      const g = c.getContext("2d"), W = c.width, H = c.height, fs = Math.max(10, Math.round(Math.min(W, H) * o.tsize / 100)), p = o.tpos, ph = Math.round(fs * 1.9);
      g.save(); g.direction = "rtl"; g.font = "800 " + fs + "px '" + kit.font + "', 'Cairo', sans-serif"; g.textBaseline = "middle"; g.textAlign = "center";
      const y = p[0] === "t" ? ph / 2 : p[0] === "m" ? H / 2 : H - ph / 2, x = p[1] === "l" ? Math.min(W / 2, g.measureText(kit.name).width / 2 + fs) : p[1] === "r" ? Math.max(W / 2, W - g.measureText(kit.name).width / 2 - fs) : W / 2;
      if (o.band) { g.fillStyle = col(0); g.globalAlpha = .88; g.fillRect(0, y - ph / 2, W, ph); g.globalAlpha = 1; }
      g.fillStyle = col(o.tcol); g.fillText(kit.name, x, y); g.restore();
    }
    return c;
  }
  const sw = (i, v) => `<label class="pbbr-sw" title="${SLOTS[i]}"><input type="color" data-brc="${i}" value="${hex(v)}"><span>${SLOTS[i]}</span></label>`;
  const pick = (k, v, kit) => `<select data-bro="${k}" class="pbx-small">${kit.colors.map((c, i) => `<option value="${i}"${+v === i ? " selected" : ""}>${SLOTS[i]} ${hex(c)}</option>`).join("")}</select>`;
  function panel() {
    const kit = load(), o = S.o, pos = (k, v) => `<select data-bro="${k}" class="pbx-small">${[["tl", "أعلى يسار"], ["tr", "أعلى يمين"], ["bl", "أسفل يسار"], ["br", "أسفل يمين"], ["mc", "الوسط"]].map(([a, t]) => `<option value="${a}"${v === a ? " selected" : ""}>${t}</option>`).join("")}</select>`;
    const rg = (k, min, max, t, v) => `<label>${t} <input type="range" min="${min}" max="${max}" value="${v}" data-bro="${k}"></label>`;
    return `<div class="pbx-pz" id="pbbr"><style>#pbbr .pbbr-sw{display:inline-flex;flex-direction:column;align-items:center;gap:2px;font-size:.7rem;margin:0 .15rem .3rem}#pbbr .pbbr-sw input{width:42px;height:34px;padding:0;border:1.5px solid rgba(128,128,128,.4);border-radius:8px;background:none;cursor:pointer}</style>
<p>هويتك البصرية: <b>الألوان</b> و<b>الخط</b> و<b>الشعار</b> تُحفظ مرة واحدة وتُطبَّق على أي صورة: إطار وخلفية بألوان علامتك، ختم الشعار، واسم العلامة بخطها. المعاينة مباشرة على الصورة ثم «تنفيذ» أو «إلغاء».</p>
<div class="ep-n"><b>① الألوان</b></div><div>${kit.colors.map((c, i) => sw(i, c)).join("")}</div>
<div class="pbrt-row"><button type="button" class="pbx-small" data-brb="site">استيراد من ألوان الموقع</button><button type="button" class="pbx-small" data-brb="defaults">الألوان الافتراضية</button></div>
<div class="ep-n"><b>② الخط والاسم</b></div>
<div class="rt-g"><label>خط العلامة <select data-brk="font" class="pbx-small">${FONTS().map(([n, l]) => `<option value="${esc(n)}"${kit.font === n ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label><label>اسم العلامة <input type="text" data-brk="name" value="${esc(kit.name)}" placeholder="اسم متجرك" style="width:100%"></label></div>
<div class="rt-g"><label><input type="checkbox" data-bro="txt" ${o.txt ? "checked" : ""}> كتابة اسم العلامة على الصورة</label><label>الموضع <select data-bro="tpos" class="pbx-small">${[["tc", "أعلى"], ["mc", "الوسط"], ["bc", "أسفل"]].map(([a, t]) => `<option value="${a}"${o.tpos === a ? " selected" : ""}>${t}</option>`).join("")}</select></label>${rg("tsize", 3, 14, "حجم الاسم", o.tsize)}<label>لون الاسم ${pick("tcol", o.tcol, kit)}</label><label><input type="checkbox" data-bro="band" ${o.band ? "checked" : ""}> شريط بلون العلامة خلف الاسم</label></div>
<div class="ep-n"><b>③ الشعار</b></div>
<div class="rt-g"><label><input type="checkbox" data-bro="logo" ${o.logo ? "checked" : ""}> ختم الشعار</label><label class="pbx-small" style="cursor:pointer">رفع الشعار<input type="file" accept="image/*" id="pbbr-lf" style="display:none"></label><span class="ep-n">${S.logo ? "✔ الشعار محفوظ" : "لا يوجد شعار محفوظ بعد"}</span><label>الموضع ${pos("lpos", o.lpos)}</label>${rg("lsize", 6, 40, "الحجم", o.lsize)}${rg("lop", 20, 100, "الشفافية", o.lop)}</div>
<div class="ep-n"><b>④ الإطار بألوان العلامة</b></div>
<div class="rt-g">${rg("border", 0, 12, "سماكة الحدّ", o.border)}<label>لون الحدّ ${pick("bcol", o.bcol, kit)}</label>${rg("pad", 0, 20, "الهامش", o.pad)}<label>لون الهامش ${pick("bgc", o.bgc, kit)}</label>${rg("radius", 0, 40, "الزوايا", o.radius)}</div>
<div class="pbrt-row"><button type="button" class="pbx-small" data-brb="reset">تصفير الصورة</button></div><div id="pbbr-msg" class="ep-n" style="min-height:1.2em">${esc(S.msg)}</div></div>`;
  }
  const say = t => { S.msg = t; const e = $("pbbr-msg"); if (e) e.textContent = t; };
  const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { const k = Math.min(1, 3000 / Math.max(im.naturalWidth, im.naturalHeight)), c = mk(im.naturalWidth * k, im.naturalHeight * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c); }; im.onerror = () => rej(new Error("تعذّر تحميل الصورة")); im.src = A().localize(String(src)); });
  const dirty = () => { const o = S.o; return !!(o.border || o.pad || o.radius || (o.logo && S.logo) || (o.txt && S.kit.name)); };
  const reset = () => Object.assign(S.o, { border: 0, pad: 0, radius: 0, logo: false, txt: false });
  let ft = 0;
  function draw() {
    if (!S.base) return; clearTimeout(ft); ft = setTimeout(async () => {
      if (!dirty()) { A().liveClear(true); return; }
      await loadFont(S.kit.font); const k = Math.min(1, 1100 / Math.max(S.base.width, S.base.height)), s = mk(S.base.width * k, S.base.height * k); s.getContext("2d").drawImage(S.base, 0, 0, s.width, s.height);
      await A().liveCanvas(S.id, render(s, S.kit, S.o, S.logo), { tab: "br", apply, cancel: reset });
    }, 70);
  }
  /* استيراد ألوان الموقع وخطه واسم المتجر (theme.json وstore.json) */
  async function fromSite() {
    try {
      const t = await (await fetch("assets/data/theme.json?_=" + Date.now())).json(), c = t.colors || {}, kit = load();
      kit.colors = [c.green || kit.colors[0], c.gold || kit.colors[1], c.bg || kit.colors[2], c.ink || kit.colors[3], c.red || kit.colors[4]].map(hex);
      const f = String(t.fontFamily || "").split(",")[0].replace(/['"]/g, "").trim(); if (f && FONTS().some(x => x[0] === f)) kit.font = f;
      try { const s = await (await fetch("assets/data/store.json?_=" + Date.now())).json(); if (s && s.name && !kit.name) kit.name = s.name; } catch (e) { }
      save(); return true;
    } catch (e) { return false; }
  }
  async function mount(host, inf) {
    load(); const id = inf.node.id;
    if (!S.site && !localStorage.getItem(LSK) && !localStorage.getItem("pbx_brand_kit")) { S.site = true; if (await fromSite()) { host.innerHTML = panel(); } }
    if (S.id !== id || !S.base) { S.id = id; try { S.base = await loadImg(inf.set.src); } catch (e) { say("⚠️ " + e.message); return; } }
    const root = host.querySelector("#pbbr"); if (!root) return; draw();
    const rerender = () => { host.innerHTML = panel(); mount(host, inf); };
    const upd = e => {
      const t = e.target; if (t.dataset.brc != null) { S.kit.colors[+t.dataset.brc] = t.value; save(); draw(); return; }
      if (t.dataset.brk) { S.kit[t.dataset.brk] = t.value; save(); draw(); return; }
      const k = t.dataset.bro; if (!k) return; S.o[k] = t.type === "checkbox" ? t.checked : t.type === "range" ? +t.value : /^(bcol|bgc|tcol)$/.test(k) ? +t.value : t.value; draw();
    };
    root.addEventListener("input", upd); root.addEventListener("change", upd);
    const lf = $("pbbr-lf"); if (lf) lf.onchange = () => { const f = lf.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { S.logo = im; S.o.logo = true; try { if (String(r.result).length < 600000) localStorage.setItem(LSL, String(r.result)); } catch (e) { } rerender(); }; im.src = String(r.result); }; r.readAsDataURL(f); };
    root.addEventListener("click", async e => {
      const t = e.target.closest("[data-brb]"); if (!t) return; const k = t.dataset.brb;
      if (k === "site") { say("⏳ جارٍ الاستيراد…"); if (await fromSite()) rerender(); else say("تعذّر قراءة ألوان الموقع"); }
      else if (k === "defaults") { S.kit.colors = DEF.colors.slice(); save(); rerender(); }
      else if (k === "reset") { reset(); A().liveClear(true); rerender(); }
    });
  }
  async function apply() {
    if (S.busy || !S.base || !dirty()) return; S.busy = true; say("⏳ جارٍ التنفيذ…");
    try {
      await loadFont(S.kit.font); const out = render(S.base, S.kit, S.o, S.logo), alpha = !!S.o.radius, blob = await new Promise(r => out.toBlob(r, alpha ? "image/png" : "image/webp", .93)), path = await A().uploadBlob(blob, "br-" + Date.now().toString(36), { max: 4096, q: .93 }), q = A().find(S.id);
      if (q && path) { q.node.set.src = path; delete q.node.set.crop; A().E.nextLabel = "الهوية البصرية"; S.base = out; reset(); A().liveClear(false); A().commitAfter(S.id); say("✅ نُفِّذ"); }
    } catch (e) { say("⚠️ " + (e.message || e)); } S.busy = false;
  }
  /* منشئ الشعار: ① شعار نصي مجاني (مونوغرام + اسم بألوان وخط الهوية) على Canvas ② شعار بالذكاء (Alyssum API) من وصف؛ الناتج يُحفظ شعاراً للعلامة ويمكن إضافته للصفحة */
  const LSTYLES = [["badge", "شارة دائرية"], ["round", "مستطيل مدوّر"], ["plain", "نص بخط تحتي"], ["mono", "مونوغرام فقط"]];
  function logoCanvas(name, kit, style, scheme) {
    const W = 800, H = style === "mono" ? 800 : style === "plain" ? 360 : 500, c = mk(W, H), g = c.getContext("2d"), col = i => hex(kit.colors[i]), dark = scheme === "dark", bg = dark ? col(0) : "transparent", fg = dark ? col(2) : col(0), ac = col(1), ff = "'" + (kit.font || "Cairo") + "','Cairo',sans-serif";
    const words = String(name || "").trim().split(/\s+/).filter(Boolean), ini = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "A").slice(0, 2)).toUpperCase();
    g.direction = "rtl"; g.textAlign = "center"; g.textBaseline = "middle";
    if (style === "mono") { g.fillStyle = col(0); g.beginPath(); g.arc(W / 2, H / 2, 340, 0, 7); g.fill(); g.lineWidth = 14; g.strokeStyle = ac; g.beginPath(); g.arc(W / 2, H / 2, 314, 0, 7); g.stroke(); g.fillStyle = col(2); g.font = "900 300px " + ff; g.fillText(ini, W / 2, H / 2 + 10); return c; }
    if (style === "badge") { g.fillStyle = col(0); g.beginPath(); g.arc(150, H / 2, 120, 0, 7); g.fill(); g.lineWidth = 8; g.strokeStyle = ac; g.beginPath(); g.arc(150, H / 2, 104, 0, 7); g.stroke(); g.fillStyle = col(2); g.font = "900 110px " + ff; g.fillText(ini, 150, H / 2 + 6); g.fillStyle = col(0); g.textAlign = "left"; g.direction = "ltr"; g.font = "800 84px " + ff; g.fillText(name || "", 300, H / 2, W - 320); return c; }
    if (style === "round") { g.fillStyle = col(0); if (g.roundRect) { g.beginPath(); g.roundRect(20, 100, W - 40, 300, 60); g.fill(); } else g.fillRect(20, 100, W - 40, 300); g.fillStyle = ac; g.fillRect(W / 2 - 60, 330, 120, 8); g.fillStyle = col(2); g.font = "900 110px " + ff; g.fillText(name || "", W / 2, 230, W - 120); return c; }
    g.fillStyle = col(0); g.font = "900 130px " + ff; g.fillText(name || "", W / 2, 140, W - 60); g.fillStyle = ac; g.fillRect(W / 2 - 130, 250, 260, 10); return c;
  }
  const logoPrompt = (name, kind, kit, style) => "DESIGN A BRAND LOGO for a business named \"" + String(name).trim() + "\"" + (kind ? " (" + String(kind).trim() + ")" : "") + ". Style: " + style + ". Use mainly these brand colors: " + kit.colors.slice(0, 3).map(hex).join(", ") + ". Flat vector-style logo, centered on a plain solid white background, simple memorable shape, clean edges, high contrast, readable at small sizes. Include the business name as clean, correctly spelled text only if it is short. No mockups, no photos, no gradients on the background, no watermark. Output only the logo image.";
  function openLogo() {
    if (!A().E || !A().E.page) return; const old = $("pbx-logo"); if (old) old.remove(); const kit = load();
    const bg = document.createElement("div"); bg.id = "pbx-logo"; bg.setAttribute("style", "position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem");
    bg.innerHTML = `<div style="background:rgba(9,24,18,.985);color:#fff;border:1px solid rgba(198,254,23,.35);border-radius:16px;max-width:540px;width:100%;max-height:92vh;overflow:auto;padding:1rem" dir="rtl"><b>🏷️ منشئ الشعار</b><p class="ep-n">يستعمل ألوان وخط هويتك البصرية. اختر شعاراً نصياً مجانياً، أو ولّد شعاراً بالذكاء الاصطناعي من وصف.</p>
<div class="rt-g"><label>اسم العلامة <input type="text" id="pblg-n" value="${esc(kit.name)}" style="width:100%" placeholder="اسم متجرك"></label><label>المجال (للذكاء) <input type="text" id="pblg-k" style="width:100%" placeholder="مثال: عسل طبيعي وأعشاب"></label></div>
<div class="ep-n"><b>① شعار نصي مجاني</b></div><div class="pbrt-row">${LSTYLES.map(x => `<button type="button" class="pbx-small" data-lg="${x[0]}">${x[1]}</button>`).join("")}<label class="pbx-small"><input type="checkbox" id="pblg-d"> خلفية بلون العلامة</label></div>
<div class="ep-n"><b>② شعار بالذكاء الاصطناعي (Alyssum API)</b></div><div class="pbrt-row"><button type="button" class="pbx-small pz-go" data-lg="ai">✨ ولّد شعاراً</button></div>
<div id="pblg-m" class="ep-n" style="min-height:1.3em"></div><div id="pblg-o" style="margin:.4rem 0;text-align:center;background:repeating-conic-gradient(#d8d4c8 0 25%,#fff 0 50%) 50%/16px 16px;border-radius:8px;min-height:60px"></div>
<div class="pbrt-row"><button type="button" class="pbx-small pz-go" data-lg="save">✔ اعتمده شعاراً للعلامة</button><button type="button" class="pbx-small" data-lg="add">＋ أضفه للصفحة</button><button type="button" class="pbx-small" data-lg="close">إغلاق</button></div></div>`;
    document.body.appendChild(bg); const R = { cv: null }, m = t => { const e = $("pblg-m"); if (e) e.textContent = t; };
    const show = cv => { R.cv = cv; const o = $("pblg-o"); o.innerHTML = ""; const im = new Image(); im.src = cv.toDataURL("image/png"); im.style.cssText = "max-width:100%;max-height:220px"; o.appendChild(im); };
    bg.addEventListener("click", async e => {
      if (e.target === bg) { bg.remove(); return; } const b = e.target.closest("[data-lg]"); if (!b) return; const k = b.dataset.lg, name = ($("pblg-n").value || "").trim();
      if (k === "close") { bg.remove(); return; }
      if (["badge", "round", "plain", "mono"].includes(k)) { if (!name) { m("اكتب اسم العلامة أولاً"); return; } kit.name = name; save(); await loadFont(kit.font); show(logoCanvas(name, kit, k, $("pblg-d").checked ? "dark" : "light")); m("✅ جاهز — اعتمده أو غيّر النمط"); }
      else if (k === "ai") {
        if (!name) { m("اكتب اسم العلامة أولاً"); return; } if (typeof ImgGen === "undefined" || !ImgGen.edit) { m("مولّد الصور غير متاح"); return; }
        try { m("⏳ جارٍ التوليد…"); const r = await ImgGen.edit({ textOnly: true, prompt: logoPrompt(name, $("pblg-k").value, kit, "modern, professional and minimal"), W: 1024, H: 1024, title: "منشئ الشعار" }); if (!r) { m(""); return; } show(r.canvas); m("✅ تمّ — راجع الشعار ثم اعتمده"); }
        catch (x) { m(x && x.code === "NOKEY" ? "أدخل مفتاح Alyssum API من إعدادات مولّد الصور" : x && x.code === "OFF" ? "التوليد الذكي معطّل من الإعدادات" : "⚠️ " + (x.message || x)); }
      } else if (k === "save" && R.cv) {
        try { const d = R.cv.toDataURL("image/png"); if (d.length < 900000) localStorage.setItem(LSL, d); const im = new Image(); im.onload = () => { S.logo = im; }; im.src = d; kit.name = name || kit.name; save(); m("✅ اعتُمد شعاراً للعلامة — يظهر في «الهوية البصرية» و«إطار وهوية»"); } catch (x) { m("⚠️ تعذّر الحفظ: " + (x.message || x)); }
      } else if (k === "add" && R.cv) {
        try { m("⏳ جارٍ الرفع…"); const blob = await new Promise(r => R.cv.toBlob(r, "image/png")), path = await A().uploadBlob(blob, "logo-" + Date.now().toString(36), { max: 2048, q: .95 }); if (path && typeof PB !== "undefined") { A().insertSections([PB.mkS([PB.mkC([PB.mkW("image", { src: path, alt: kit.name || "", hauto: true })])], { pad: { d: [20, 20, 20, 20], m: [14, 12, 14, 12] } })], "شعار"); bg.remove(); } } catch (x) { m("⚠️ " + (x.message || x)); }
      }
    });
  }
  return { panel, mount, apply, openLogo, reset: () => { S.id = ""; S.base = null; S.msg = ""; }, state: S, _t: { render, load, DEF, SLOTS, logoCanvas, logoPrompt, LSTYLES } };
})();
