/* ═══ قناع الصورة بشكل (مثل «تقاطع/طرح» في Canva) ═══
   ماسك: ضع شكلاً فوق الصورة؛ الافتراضي «احذف الشكل من الصورة» (يُثقب مكانه) ومع «اعكس» «أبقِ الشكل» (يختفي كل ما خارجه) مع معاينة حيّة ثم تأكيد أو إلغاء.
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
.pbx-mk .pbx-pr{display:flex;flex-direction:column;gap:.15rem;font-weight:700;font-size:.74rem}.pbx-mk .pbx-pr input{width:100%}.pbx-mk .mk-b{display:grid;grid-template-columns:1fr;gap:.35rem}.pbx-mk .mk-go{background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;border:0;padding:.55rem;font-size:.82rem}.pbx-mk .mk-k{flex-direction:row;align-items:center;gap:.4rem;font-weight:600;cursor:pointer}.pbx-mk .mk-list{max-height:290px;overflow:auto;border:1px solid #e6e0d0;border-radius:10px;padding:.35rem;background:#fff}.pbx-mk .mk-gh{font-weight:800;font-size:.72rem;color:#8a8268;margin:.4rem .1rem .2rem}.pbx-mk .mk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.25rem}.pbx-mk .mk-sh{display:flex;align-items:center;gap:.4rem;border:1.5px solid #e6e0d0;background:#faf6ec;border-radius:9px;padding:.25rem .4rem;cursor:pointer;font-family:inherit;font-size:.74rem;font-weight:700;color:#173f35;text-align:start}.pbx-mk .mk-sh.on{border-color:#7c3aed;background:#ede9fe;color:#5b21b6}.pbx-mk .mk-sh .pbx-thumb{width:28px;height:28px;flex:none}.pbx-mk .mk-pend{background:#ecfdf5;border:1.5px solid #86d4b0;border-radius:10px;padding:.5rem;font-size:.76rem;font-weight:700;color:#14573b;line-height:1.7}.pbx-mk .mk-pb{display:flex;gap:.4rem;margin-top:.4rem}.pbx-mk .mk-yes{background:#0d9488;color:#fff;border:0;flex:1;padding:.5rem}.pbx-mk .mk-no{background:#fff;color:#b91c1c;border:1.5px solid #fca5a5;flex:1;padding:.5rem}.pbx-mk .mk-on{background:#ede9fe;color:#6d28d9;border-radius:8px;padding:.35rem .5rem;font-weight:800;font-size:.76rem}`;
    document.head.appendChild(st);
  }
  const libKeys = () => Object.keys(PB.SHAPES).filter(k => !["stroke", "line"].includes(PB.SHAPES[k][1]));
  const libSel = () => S.target && S.target.startsWith("lib:") && PB.SHAPES[S.target.slice(4)] ? S.target.slice(4) : "";
  Object.assign(S, { size: 70, px: 50, py: 50, invert: false, pend: null });
  const thumbBtn = (val, key, name, on) => `<button type="button" class="mk-sh${on ? " on" : ""}" data-mksh="${esc(val)}" title="${esc(name)}">${PB.shapeThumb(key)}<span>${esc(name)}</span></button>`;
  function panel(inf) {
    css(); if (!inf || inf.kind !== "widget" || inf.set.pz) return "";
    const img = inf.node.type === "image", st = inf.set; if (img && !st.src) return "";
    const L = cands(inf), lib = img ? libSel() : "", cur = lib ? null : (L.find(w => w.id === S.target) || L[0]), pend = !!(S.pend && S.pend.id === inf.node.id);
    const reset = img && st.clip && !pend ? `<div class="mk-on">🎭 الماسك مفعّل (${st.clipMode === "out" ? "شكل محذوف من الصورة" : "الصورة داخل الشكل فقط"})</div><button type="button" class="pbx-small" data-mk="reset">↺ إلغاء الماسك (الصورة كاملة)</button>` : "";
    const iAll = (inf.sec.free || []).filter(w => w.type === "image"), sl = (k, lbl, mn, mx) => `<label class="pbx-pr">${lbl} <b>${S[k]}</b><input type="range" data-mkk="${k}" min="${mn}" max="${mx}" value="${S[k]}"></label>`;
    const invertUi = `<label class="mk-k"><input type="checkbox" data-mkk="invert" ${S.invert ? "checked" : ""}> ↔ اعكس: أبقِ الشكل وأخفِ بقية الصورة</label><p>الافتراضي: <b>يُحذف الشكل من الصورة</b> (يُثقب مكانه). فعّل «اعكس» لتبقى الصورة داخل الشكل فقط.</p>`;
    if (!img) {      // من جهة الشكل: اختيار الصورة التي تحته
      const hint = L.length ? "" : `<p>ضع هذا الشكل فوق <b>صورة</b> ثم اضغط «تطبيق الماسك».</p>`;
      return `<div class="pbx-mk">${hint}${L.length ? `<label>الصورة التي تحت الشكل<select data-mkk="target">${L.map(w => `<option value="${esc(w.id)}"${cur && w.id === cur.id ? " selected" : ""}>${esc(wname(w, iAll.indexOf(w)))}</option>`).join("")}</select></label>` : ""}
${invertUi}<label class="mk-k"><input type="checkbox" data-mkk="keep" ${S.keep ? "checked" : ""}> احتفظ بالشكل كعنصر بعد التطبيق</label>
<div class="mk-b"><button type="button" class="pbx-small mk-go" data-mk="apply">🎭 تطبيق الماسك</button></div></div>`; }
    // من جهة الصورة: أشكال حقيقية بجانب أسمائها (الموضوعة فوق الصورة + المكتبة) + معاينة حيّة على الصفحة
    const val = lib ? "lib:" + lib : cur ? cur.id : "lib:ellipse", cl = val.startsWith("lib:");
    const placed = L.length ? `<div class="mk-gh">شكل موضوع فوق الصورة</div><div class="mk-grid">${L.map(w => thumbBtn(w.id, w.set.shape, wname(w, 0), val === w.id)).join("")}</div>` : "";
    const groups = PB.SHAPE_GROUPS.map(g => { const ks = libKeys().filter(k => PB.SHAPES[k][4] === g); return ks.length ? `<div class="mk-gh">${esc(g)}</div><div class="mk-grid">${ks.map(k => thumbBtn("lib:" + k, k, PB.SHAPES[k][0], val === "lib:" + k)).join("")}</div>` : ""; }).join("");
    const bar = pend ? `<div class="mk-pend">👁 معاينة حيّة على الصفحة — غيّر الشكل أو الحجم أو الموضع وستراها مباشرة<div class="mk-pb"><button type="button" class="pbx-small mk-yes" data-mk="ok">✓ تأكيد النتيجة</button><button type="button" class="pbx-small mk-no" data-mk="no">✕ إلغاء</button></div></div>` : `<div class="mk-b"><button type="button" class="pbx-small mk-go" data-mk="preview">👁 معاينة الماسك على الصفحة</button></div><p>اختر شكلاً أو حرّك أي شريط لتظهر المعاينة الحيّة، ثم أكّد النتيجة أو ألغِها.</p>`;
    return `<div class="pbx-mk">${reset}<div class="mk-list">${placed}${groups}</div>
${cl ? `${sl("size", "حجم الشكل %", 10, 100)}${sl("px", "الموضع الأفقي %", 0, 100)}${sl("py", "الموضع العمودي %", 0, 100)}<button type="button" class="pbx-small" data-mk="place" title="يضع الشكل المختار فوق الصورة كعنصر لتحرّكه وتكبّره بيدك ثم تطبّق الماسك">➕ ضعه فوق الصورة لأعدّله بيدي</button>` : `<label class="mk-k"><input type="checkbox" data-mkk="keep" ${S.keep ? "checked" : ""}> احتفظ بالشكل كعنصر بعد التطبيق</label>`}
${invertUi}${bar}</div>`;
  }
  /* خيارات اللوحة؛ تعيد true إن لزم إعادة رسم اللوحة. أي تغيير على الصورة يحدّث المعاينة الحيّة فوراً */
  function opt(k, v) {
    if (k === "target") S.target = v; else if (k === "keep") S.keep = !!v; else if (k === "invert") S.invert = !!v; else if (k === "size" || k === "px" || k === "py") S[k] = Number(v); else return false;
    const had = !!S.pend, ok = livePreview(); return k === "target" || k === "invert" || (!had && ok);
  }
  function livePreview() {      // يحدّث المعاينة إن كان المحدّد صورة بها صورة؛ يعيد true إن بدأت معاينة جديدة
    const inf = A().find(A().E.sel); if (!inf || inf.node.type !== "image" || !inf.set.src || inf.set.pz) return false; const had = !!S.pend; preview(inf); return !had && !!S.pend;
  }
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
  /* يحسب مسار القص للصورة بحسب الشكل المختار والعكس؛ يعيد {clip, eo, mode, rs, shpNode, lib} أو {err} (لا يعدّل شيئاً) */
  function compute(inf, base) {
    const E = A().E, isImg = inf.node.type === "image", lib = isImg ? (libSel() || (cands(inf).length ? "" : "ellipse")) : "";
    const L = cands(inf), other = isImg && lib ? null : (L.find(w => w.id === S.target) || L[0]);
    if (!lib && !other) return { err: "ضع شكلاً فوق الصورة أولاً" };
    const imgW = isImg ? inf.node : other, img = A().find(imgW.id); if (!img) return { err: "تعذّر إيجاد الصورة" };
    if (img.set.pz) return { err: "قطع البازل لا تدعم الماسك" };
    if (Number(PB.eff(img.set, "rot", E.dev)) || 0) return { err: "أزل تدوير الصورة أولاً" };
    const iR = A().layoutOf(img.node.id); if (!iR) return { err: "تعذّر قراءة موضع الصورة" };
    const mode = S.invert ? "in" : "out", b = base || { clip: img.set.clip, clipMode: img.set.clipMode };
    if (b.clip && (b.clipMode !== "out" || mode !== "out")) return { err: "على الصورة ماسك بالفعل — ألغِه أولاً (يمكن حذف أكثر من شكل بالتتابع فقط)" };
    // شكل من المكتبة: مربع حول مركز مختار بنسبة من أصغر بُعدي الصورة
    let shpNode, rs, key;
    if (lib) { const side = Math.max(8, Math.min(iR.width, iR.height) * S.size / 100), bx = { left: iR.left + (iR.width - side) * S.px / 100, top: iR.top + (iR.height - side) * S.py / 100, side }; key = lib; shpNode = { set: { shape: lib, rx: 0 } }; rs = rings(shpNode, iR, { left: bx.left, top: bx.top, width: bx.side, height: bx.side }, E); }
    else { const shp = A().find(isImg ? other.id : inf.node.id); if (!shp) return { err: "تعذّر إيجاد الشكل" }; shpNode = shp.node; key = shpNode.set.shape; const sR = A().layoutOf(shp.node.id); if (!sR) return { err: "تعذّر قراءة الشكل" }; rs = rings(shpNode, iR, sR, E); }
    if (!rs.length) return { err: "تعذّر قراءة الشكل" };
    const eo = ((PB.SHAPES[key] || [])[5] === "evenodd");
    return mode === "in" ? { img, mode, clip: pathOf(rs), eo, lib, shpNode } : { img, mode, clip: (b.clip || "M0 0L1 0L1 1L0 1Z") + pathOf(rs), eo: true, lib, shpNode };
  }
  const setClip = (img, r) => { img.set.clip = r.clip; if (r.eo) img.set.clipEO = true; else delete img.set.clipEO; img.set.clipMode = r.mode; };
  function restorePend() { const p = S.pend; if (!p) return null; const img = A().find(p.id); S.pend = null; if (img) { ["clip", "clipEO", "clipMode"].forEach(k => { if (p.prev[k] === undefined) delete img.set[k]; else img.set[k] = p.prev[k]; }); } return img; }
  function preview(inf) {      // معاينة حيّة: تُطبَّق على الصفحة بلا حفظ في السجل حتى «تأكيد»
    if (S.pend && S.pend.id !== inf.node.id) { restorePend(); }
    const base = S.pend ? S.pend.prev : { clip: inf.set.clip, clipEO: inf.set.clipEO, clipMode: inf.set.clipMode }, r = compute(inf, base);
    if (r.err) { toast(r.err); return; }
    if (!S.pend) S.pend = { id: r.img.node.id, prev: base };
    setClip(r.img, r); A().renderCanvas();
  }
  function cancel() { const img = restorePend(); if (img) A().renderCanvas(); }
  function act(name, inf) {
    const E = A().E; if (name === "reset") { delete inf.set.clip; delete inf.set.clipEO; delete inf.set.clipMode; E.nextLabel = "إلغاء الماسك"; A().commitAfter(); return; }
    if (name === "no") { cancel(); toast("✕ أُلغيت المعاينة"); return; }
    if (name === "preview") { preview(inf); return; }
    if (name === "place") {
      const isImg = inf.node.type === "image", lib = isImg ? libSel() : ""; if (!lib) return; const img = A().find(inf.node.id), iR = A().layoutOf(img.node.id); if (!iR) return;
      cancel(); const side = Math.max(8, Math.min(iR.width, iR.height) * S.size / 100), bx = { left: iR.left + (iR.width - side) * S.px / 100, top: iR.top + (iR.height - side) * S.py / 100, side };
      const sh = PB.mkFree("shape", 0, 0, (Number(img.set.zi) || 0) + 1), E2 = E; sh.set.shape = lib; sh.set.fill = "#c8a24b";
      const g = { fx: Number(PB.eff(img.set, "fx", E2.dev)), fy: Number(PB.eff(img.set, "fy", E2.dev)), fwd: Number(PB.eff(img.set, "fwd", E2.dev)), fh: Number(PB.eff(img.set, "fh", E2.dev)) };
      PB.setR(sh.set, "fx", E2.dev, +(g.fx + (bx.left - iR.left) / iR.width * g.fwd).toFixed(2)); PB.setR(sh.set, "fy", E2.dev, +(g.fy + (bx.top - iR.top) / iR.height * g.fh).toFixed(2)); PB.setR(sh.set, "fwd", E2.dev, +(bx.side / iR.width * g.fwd).toFixed(2)); PB.setR(sh.set, "fh", E2.dev, +(bx.side / iR.height * g.fh).toFixed(2));
      img.list.splice(img.idx + 1, 0, sh); E.nextLabel = "إضافة شكل للماسك"; E.sel = sh.id; S.target = img.node.id; A().commitAfter(sh.id); toast("➕ وُضع الشكل فوق الصورة — حرّكه وكبّره ثم اختر الصورة في «ماسك» وطبّق"); return; }
    // ok / apply: تأكيد المعاينة، أو تطبيق مباشر من جهة الشكل
    const pend = S.pend && S.pend.id === inf.node.id ? S.pend : null; if (pend) S.pend = null;
    const base = pend ? pend.prev : null, r = compute(inf, base);
    if (r.err) { if (pend) { S.pend = pend; } toast(r.err); return; }
    setClip(r.img, r);
    if (!r.lib && !S.keep) { const shp = A().find(r.shpNode.id); if (shp) { const i = shp.list.indexOf(shp.node); if (i >= 0) shp.list.splice(i, 1); } }
    E.nextLabel = r.mode === "in" ? "ماسك: إبقاء داخل الشكل" : "ماسك: حذف الشكل من الصورة"; E.sel = r.img.node.id; A().commitAfter(r.img.node.id);
    toast(r.mode === "in" ? "🎭 بقيت الصورة داخل الشكل فقط" : "✂ حُذف الشكل من الصورة");
  }
  return { panel, opt, act, cancel, pending: () => (S.pend ? S.pend.id : "") };
})();
