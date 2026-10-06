/* ═══ قناع الصورة بشكل (مثل «تقاطع/طرح» في Canva) ═══
   ضع شكلاً فوق الصورة ثم: «أبقِ الصورة داخل الشكل» (يختفي كل ما خارجه) أو «احذف الشكل من الصورة» (يُثقب مكانه).
   يُخزَّن القناع في الصورة نفسها كمسار قص نسبي (clip) فيتبعها عند التحريك والتحجيم؛ ويمكن إلغاؤه لاسترجاع الصورة كاملة. */
const PBMask = (function () {
  const A = () => PBApp, esc = s => PB.esc(s), S = { target: "", keep: false };
  const toast = m => { const t = document.getElementById("pbx-msg"); if (!t) return; t.textContent = m; t.style.display = "block"; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = "none", 4200); };
  const isShape = w => w.type === "shape" && (PB.SHAPES[w.set.shape] || [])[1] && !["stroke", "line"].includes(PB.SHAPES[w.set.shape][1]);
  const inter = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const zi = w => Number(w.set.zi) || 0;
  function cands(inf) {      // العناصر المتداخلة مع المحدّد: أشكال إن كان صورة، وصوراً إن كان شكلاً (مرتّبة الأعلى أولاً)
    const wantShape = inf.node.type === "image", me = A().layoutOf(inf.node.id), L = (inf.sec.free || []).map((w, i) => [w, i]).filter(([w]) => w !== inf.node && (wantShape ? isShape(w) : w.type === "image" && w.set.src && !w.set.pz) && inter(me, A().layoutOf(w.id)));
    return L.sort((x, y) => zi(y[0]) - zi(x[0]) || y[1] - x[1]).map(x => x[0]);
  }
  const wname = (w, n) => w.type === "shape" ? ((PB.SHAPES[w.set.shape] || [])[0] || "شكل") : "صورة " + (n + 1);
  function css() {
    if (document.getElementById("mk-css")) return; const st = document.createElement("style"); st.id = "mk-css";
    st.textContent = `.pbx-mk{display:flex;flex-direction:column;gap:.45rem;font-size:.8rem}.pbx-mk p{margin:0;color:#6b6556;line-height:1.7;font-size:.76rem}.pbx-mk label{display:flex;flex-direction:column;gap:.2rem;font-weight:700;font-size:.76rem}.pbx-mk select{width:100%;border:1px solid #d9dbe3;border-radius:8px;padding:.35rem;font-family:inherit}
.pbx-mk .mk-b{display:grid;grid-template-columns:1fr;gap:.35rem}.pbx-mk .mk-go{background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;border:0;padding:.55rem;font-size:.82rem}.pbx-mk .mk-k{flex-direction:row;align-items:center;gap:.4rem;font-weight:600;cursor:pointer}.pbx-mk .mk-on{background:#ede9fe;color:#6d28d9;border-radius:8px;padding:.35rem .5rem;font-weight:800;font-size:.76rem}`;
    document.head.appendChild(st);
  }
  function panel(inf) {
    css(); if (!inf || inf.kind !== "widget" || inf.set.pz) return "";
    const img = inf.node.type === "image", st = inf.set; if (img && !st.src) return "";
    const L = cands(inf), cur = L.find(w => w.id === S.target) || L[0], reset = img && st.clip ? `<div class="mk-on">🎭 القناع مفعّل (${st.clipMode === "out" ? "منطقة محذوفة" : "الصورة داخل الشكل فقط"})</div><button type="button" class="pbx-small" data-mk="reset">↺ إلغاء القناع (الصورة كاملة)</button>` : "";
    const hint = L.length ? "" : `<p>${img ? "ضع <b>شكلاً</b> (من «أشكال») فوق الصورة ثم اضغط أحد الخيارين: إبقاء الصورة داخل الشكل أو حذف الشكل منها." : "ضع هذا الشكل فوق <b>صورة</b> ثم اضغط أحد الخيارين: إبقاء الصورة داخل الشكل أو حذف الشكل منها."}</p>`;
    const iAll = (inf.sec.free || []).filter(w => w.type === "image");
    return `<div class="pbx-mk">${reset}${hint}${L.length ? `<label>${img ? "الشكل الذي فوق الصورة" : "الصورة التي تحت الشكل"}<select data-mkk="target">${L.map((w, i) => `<option value="${esc(w.id)}"${cur && w.id === cur.id ? " selected" : ""}>${esc(wname(w, iAll.indexOf(w)))}</option>`).join("")}</select></label>` : ""}
<div class="mk-b"><button type="button" class="pbx-small mk-go" data-mk="in">🖼 أبقِ الصورة داخل الشكل</button><button type="button" class="pbx-small mk-go" data-mk="out">✂ احذف الشكل من الصورة</button></div>
<label class="mk-k"><input type="checkbox" data-mkk="keep" ${S.keep ? "checked" : ""}> احتفظ بالشكل كعنصر بعد التطبيق</label></div>`;
  }
  function opt(k, v) { if (k === "target") S.target = v; else if (k === "keep") S.keep = !!v; }
  /* نقاط الشكل (حلقات) بإحداثيات نسبية من إطار الصورة */
  function rings(shp, imgR, shR, E) {
    const sh = PB.SHAPES[shp.set.shape], kind = sh[1], set = shp.set; let R = [];
    if (kind === "rect") { const rx = Math.max(0, Math.min(50, Number(set.rx) || 0)); R = rx ? sample(`M${rx} 0H${100 - rx}A${rx} ${rx} 0 0 1 100 ${rx}V${100 - rx}A${rx} ${rx} 0 0 1 ${100 - rx} 100H${rx}A${rx} ${rx} 0 0 1 0 ${100 - rx}V${rx}A${rx} ${rx} 0 0 1 ${rx} 0Z`) : [[[0, 0], [100, 0], [100, 100], [0, 100]]]; }
    else if (kind === "ellipse") R = [Array.from({ length: 96 }, (_, i) => [50 + 50 * Math.cos(i / 96 * 2 * Math.PI), 50 + 50 * Math.sin(i / 96 * 2 * Math.PI)])];
    else if (kind === "poly") R = String(sh[2]).split("|").map(g => g.trim().split(/\s+/).map(p => p.split(",").map(Number)));
    else R = sample(sh[2]);
    const stretch = !!sh[3] || set.keep === false, Wp = shR.width, Hp = shR.height, sc = Math.min(Wp, Hp) / 100, rot = (Number(PB.eff(set, "rot", E.dev)) || 0) * Math.PI / 180, co = Math.cos(rot), si = Math.sin(rot);
    const f = v => +v.toFixed(4);
    return R.filter(r => r.length >= 3).map(r => r.map(([px, py]) => { let x = stretch ? px / 100 * Wp : (Wp - 100 * sc) / 2 + px * sc, y = stretch ? py / 100 * Hp : (Hp - 100 * sc) / 2 + py * sc;
      const dx = x - Wp / 2, dy = y - Hp / 2; x = Wp / 2 + dx * co - dy * si; y = Hp / 2 + dx * si + dy * co;
      return [f((shR.left + x - imgR.left) / imgR.width), f((shR.top + y - imgR.top) / imgR.height)]; }));
  }
  let svg = null;
  function sample(d) {      // أخذ عيّنات من مسار SVG (أقواس ومنحنيات) إلى مضلعات
    if (!svg) { svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("style", "position:absolute;width:0;height:0;visibility:hidden"); svg.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "path")); document.body.appendChild(svg); }
    const pth = svg.firstChild, out = [];
    String(d).split(/(?=[Mm])/).forEach(sub => { sub = sub.trim(); if (!sub) return; pth.setAttribute("d", sub); const Ln = pth.getTotalLength(); if (!Ln) return; const n = Math.max(24, Math.min(320, Math.round(Ln / 1.1))), ring = []; for (let i = 0; i < n; i++) { const p = pth.getPointAtLength(Ln * i / n); ring.push([p.x, p.y]); } out.push(ring); });
    return out;
  }
  const pathOf = rs => rs.map(r => "M" + r.map(p => p[0] + " " + p[1]).join("L") + "Z").join("");
  function act(name, inf) {
    const E = A().E; if (name === "reset") { delete inf.set.clip; delete inf.set.clipEO; delete inf.set.clipMode; E.nextLabel = "إلغاء قناع"; A().commitAfter(); return; }
    const L = cands(inf), other = L.find(w => w.id === S.target) || L[0]; if (!other) { toast("ضع شكلاً فوق الصورة أولاً"); return; }
    const imgW = inf.node.type === "image" ? inf.node : other, shpW = inf.node.type === "image" ? other : inf.node, img = A().find(imgW.id), shp = A().find(shpW.id);
    if (!img || !shp) return; if (img.set.pz) { toast("قطع البازل لا تدعم القناع"); return; }
    if (Number(PB.eff(img.set, "rot", E.dev)) || 0) { toast("أزل تدوير الصورة أولاً"); return; }
    if (img.set.clip && (img.set.clipMode !== "out" || name !== "out")) { toast("على الصورة قناع بالفعل — ألغِه أولاً (يمكن حذف أكثر من شكل بالتتابع فقط)"); return; }
    const iR = A().layoutOf(img.node.id), sR = A().layoutOf(shp.node.id); if (!iR || !sR) return;
    const rs = rings(shp.node, iR, sR, E); if (!rs.length) { toast("تعذّر قراءة الشكل"); return; }
    const eo = ((PB.SHAPES[shp.node.set.shape] || [])[5] === "evenodd");
    if (name === "in") { img.set.clip = pathOf(rs); img.set.clipEO = eo || undefined; if (!eo) delete img.set.clipEO; }
    else { img.set.clip = (img.set.clip || "M0 0L1 0L1 1L0 1Z") + pathOf(rs); img.set.clipEO = true; }
    img.set.clipMode = name;
    if (!S.keep) { const i = shp.list.indexOf(shp.node); if (i >= 0) shp.list.splice(i, 1); }
    E.nextLabel = name === "in" ? "قناع: إبقاء داخل الشكل" : "قناع: حذف الشكل من الصورة"; E.sel = img.node.id; A().commitAfter(img.node.id);
    toast(name === "in" ? "🎭 بقيت الصورة داخل الشكل فقط" : "✂ حُذف الشكل من الصورة");
  }
  return { panel, opt, act };
})();
