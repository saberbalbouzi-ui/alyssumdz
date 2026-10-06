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
.pbx-mk .pbx-pr{display:flex;flex-direction:column;gap:.15rem;font-weight:700;font-size:.74rem}.pbx-mk .pbx-pr input{width:100%}.pbx-mk .mk-b{display:grid;grid-template-columns:1fr;gap:.35rem}.pbx-mk .mk-go{background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;border:0;padding:.55rem;font-size:.82rem}.pbx-mk .mk-k{flex-direction:row;align-items:center;gap:.4rem;font-weight:600;cursor:pointer}.pbx-mk .mk-on{background:#ede9fe;color:#6d28d9;border-radius:8px;padding:.35rem .5rem;font-weight:800;font-size:.76rem}`;
    document.head.appendChild(st);
  }
  const libKeys = () => Object.keys(PB.SHAPES).filter(k => !["stroke", "line"].includes(PB.SHAPES[k][1]));
  const libSel = () => S.target && S.target.startsWith("lib:") && PB.SHAPES[S.target.slice(4)] ? S.target.slice(4) : "";
  Object.assign(S, { size: 70, px: 50, py: 50 });
  function panel(inf) {
    css(); if (!inf || inf.kind !== "widget" || inf.set.pz) return "";
    const img = inf.node.type === "image", st = inf.set; if (img && !st.src) return "";
    const L = cands(inf), lib = img ? libSel() : "", cur = lib ? null : (L.find(w => w.id === S.target) || L[0]), reset = img && st.clip ? `<div class="mk-on">🎭 القناع مفعّل (${st.clipMode === "out" ? "منطقة محذوفة" : "الصورة داخل الشكل فقط"})</div><button type="button" class="pbx-small" data-mk="reset">↺ إلغاء القناع (الصورة كاملة)</button>` : "";
    const iAll = (inf.sec.free || []).filter(w => w.type === "image"), sl = (k, lbl, mn, mx) => `<label class="pbx-pr">${lbl} <b>${S[k]}</b><input type="range" data-mkk="${k}" min="${mn}" max="${mx}" value="${S[k]}"></label>`;
    if (!img) {      // من جهة الشكل: اختيار الصورة التي تحته
      const hint = L.length ? "" : `<p>ضع هذا الشكل فوق <b>صورة</b> ثم اضغط أحد الخيارين.</p>`;
      return `<div class="pbx-mk">${hint}${L.length ? `<label>الصورة التي تحت الشكل<select data-mkk="target">${L.map(w => `<option value="${esc(w.id)}"${cur && w.id === cur.id ? " selected" : ""}>${esc(wname(w, iAll.indexOf(w)))}</option>`).join("")}</select></label>` : ""}
<div class="mk-b"><button type="button" class="pbx-small mk-go" data-mk="in">🖼 أبقِ الصورة داخل الشكل</button><button type="button" class="pbx-small mk-go" data-mk="out">✂ احذف الشكل من الصورة</button></div>
<label class="mk-k"><input type="checkbox" data-mkk="keep" ${S.keep ? "checked" : ""}> احتفظ بالشكل كعنصر بعد التطبيق</label></div>`; }
    // من جهة الصورة: قائمة واحدة فيها الأشكال الموضوعة فوق الصورة + مكتبة الأشكال الجاهزة
    const val = lib ? "lib:" + lib : cur ? cur.id : "lib:ellipse", cl = val.startsWith("lib:");
    const groups = PB.SHAPE_GROUPS.map(g => { const ks = libKeys().filter(k => PB.SHAPES[k][4] === g); return ks.length ? `<optgroup label="${esc(g)}">${ks.map(k => `<option value="lib:${k}"${val === "lib:" + k ? " selected" : ""}>${esc(PB.SHAPES[k][0])}</option>`).join("")}</optgroup>` : ""; }).join("");
    const placed = L.length ? `<optgroup label="شكل موضوع فوق الصورة">${L.map(w => `<option value="${esc(w.id)}"${val === w.id ? " selected" : ""}>${esc(wname(w, 0))}</option>`).join("")}</optgroup>` : "";
    return `<div class="pbx-mk">${reset}<label>اختر الشكل<select data-mkk="target">${placed}${groups}</select></label>
${cl ? `${sl("size", "حجم الشكل %", 10, 100)}${sl("px", "الموضع الأفقي %", 0, 100)}${sl("py", "الموضع العمودي %", 0, 100)}<button type="button" class="pbx-small" data-mk="place" title="يضع الشكل المختار فوق الصورة كعنصر لتحرّكه وتكبّره بيدك ثم تطبّق القناع">➕ ضعه فوق الصورة لأعدّله بيدي</button>` : `<label class="mk-k"><input type="checkbox" data-mkk="keep" ${S.keep ? "checked" : ""}> احتفظ بالشكل كعنصر بعد التطبيق</label>`}
<div class="mk-b"><button type="button" class="pbx-small mk-go" data-mk="in">🖼 أبقِ الصورة داخل الشكل</button><button type="button" class="pbx-small mk-go" data-mk="out">✂ احذف الشكل من الصورة</button></div></div>`;
  }
  function opt(k, v) { if (k === "target") { S.target = v; return true; } if (k === "keep") S.keep = !!v; else if (k === "size" || k === "px" || k === "py") { S[k] = Number(v); return false; } return false; }
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
    const isImg = inf.node.type === "image", lib = isImg ? (libSel() || (cands(inf).length ? "" : "ellipse")) : "";
    const L = cands(inf), other = isImg && lib ? null : (L.find(w => w.id === S.target) || L[0]);
    if (!lib && !other) { toast("ضع شكلاً فوق الصورة أولاً"); return; }
    const imgW = isImg ? inf.node : other, img = A().find(imgW.id); if (!img) return;
    if (img.set.pz) { toast("قطع البازل لا تدعم القناع"); return; }
    if (Number(PB.eff(img.set, "rot", E.dev)) || 0) { toast("أزل تدوير الصورة أولاً"); return; }
    const iR = A().layoutOf(img.node.id); if (!iR) return;
    // شكل من المكتبة: مربع حول مركز مختار بنسبة من أصغر بُعدي الصورة
    const box = () => { const side = Math.max(8, Math.min(iR.width, iR.height) * S.size / 100); return { side, left: iR.left + (iR.width - side) * S.px / 100, top: iR.top + (iR.height - side) * S.py / 100 }; };
    if (name === "place") {
      if (!lib) return; const bx = box(), sh = PB.mkFree("shape", 0, 0, (Number(img.set.zi) || 0) + 1), E2 = E; sh.set.shape = lib; sh.set.fill = "#c8a24b";
      const g = { fx: Number(PB.eff(img.set, "fx", E2.dev)), fy: Number(PB.eff(img.set, "fy", E2.dev)), fwd: Number(PB.eff(img.set, "fwd", E2.dev)), fh: Number(PB.eff(img.set, "fh", E2.dev)) };
      PB.setR(sh.set, "fx", E2.dev, +(g.fx + (bx.left - iR.left) / iR.width * g.fwd).toFixed(2)); PB.setR(sh.set, "fy", E2.dev, +(g.fy + (bx.top - iR.top) / iR.height * g.fh).toFixed(2)); PB.setR(sh.set, "fwd", E2.dev, +(bx.side / iR.width * g.fwd).toFixed(2)); PB.setR(sh.set, "fh", E2.dev, +(bx.side / iR.height * g.fh).toFixed(2));
      img.list.splice(img.idx + 1, 0, sh); E.nextLabel = "إضافة شكل للقناع"; E.sel = sh.id; S.target = img.node.id; A().commitAfter(sh.id); toast("➕ وُضع الشكل فوق الصورة — حرّكه وكبّره ثم اختر الصورة في «قناع بالشكل» وطبّق"); return; }
    if (img.set.clip && (img.set.clipMode !== "out" || name !== "out")) { toast("على الصورة قناع بالفعل — ألغِه أولاً (يمكن حذف أكثر من شكل بالتتابع فقط)"); return; }
    let shpNode, rs, key;
    if (lib) { const bx = box(); key = lib; shpNode = { set: { shape: lib, rx: 0 } }; rs = rings(shpNode, iR, { left: bx.left, top: bx.top, width: bx.side, height: bx.side }, E); }
    else { const shp = A().find(isImg ? other.id : inf.node.id); if (!shp) return; shpNode = shp.node; key = shpNode.set.shape; const sR = A().layoutOf(shp.node.id); if (!sR) return; rs = rings(shpNode, iR, sR, E); }
    if (!rs.length) { toast("تعذّر قراءة الشكل"); return; }
    const eo = ((PB.SHAPES[key] || [])[5] === "evenodd");
    if (name === "in") { img.set.clip = pathOf(rs); if (eo) img.set.clipEO = true; else delete img.set.clipEO; }
    else { img.set.clip = (img.set.clip || "M0 0L1 0L1 1L0 1Z") + pathOf(rs); img.set.clipEO = true; }
    img.set.clipMode = name;
    if (!lib && !S.keep) { const shp = A().find(shpNode.id); if (shp) { const i = shp.list.indexOf(shp.node); if (i >= 0) shp.list.splice(i, 1); } }
    E.nextLabel = name === "in" ? "قناع: إبقاء داخل الشكل" : "قناع: حذف الشكل من الصورة"; E.sel = img.node.id; A().commitAfter(img.node.id);
    toast(name === "in" ? "🎭 بقيت الصورة داخل الشكل فقط" : "✂ حُذف الشكل من الصورة");
  }
  return { panel, opt, act };
})();
