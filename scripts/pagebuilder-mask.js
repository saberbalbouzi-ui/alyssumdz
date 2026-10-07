/* ═══ قناع الصورة بشكل (مثل «تقاطع/طرح» في Canva) ═══
   ماسك: ضع شكلاً فوق الصورة؛ الافتراضي «احذف الشكل من الصورة» (يُثقب مكانه) ومع «اعكس» «أبقِ الشكل» (يختفي كل ما خارجه) مع معاينة حيّة ثم تأكيد أو إلغاء.
   يُخزَّن القناع في الصورة نفسها كمسار قص نسبي (clip) فيتبعها عند التحريك والتحجيم؛ ويمكن إلغاؤه لاسترجاع الصورة كاملة. */
const PBMask = (function () {
  const A = () => PBApp, esc = s => PB.esc(s), S = { target: "", keep: false };
  const toast = m => { const t = document.getElementById("pbx-msg"); if (!t) return; t.textContent = m; t.style.display = "block"; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = "none", 4200); };
  const isShape = w => w.type === "shape" && (PB.SHAPES[w.set.shape] || [])[1] && !["stroke", "line"].includes(PB.SHAPES[w.set.shape][1]);
  const inter = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const zi = w => Number(w.set.zi) || 0;
  const SKIP = ["shdr", "sbar", "herow", "sfoot", "orderorig"], rectKey = () => Object.keys(PB.SHAPES).find(k => PB.SHAPES[k][1] === "rect") || "rect";
  const maskKey = w => isShape(w) ? w.set.shape : rectKey();
  function cands(inf) {      // العناصر المتداخلة مع المحدّد: إن كان صورة فأي عنصر فوقها/تحتها (الأشكال أولاً ثم الأعلى)، وإن كان عنصراً آخر فالصور المتداخلة معه
    const isImg = inf.node.type === "image", me = A().layoutOf(inf.node.id), L = (inf.sec.free || []).map((w, i) => [w, i]).filter(([w]) => w !== inf.node && !SKIP.includes(w.type) && (isImg ? !(w.type === "image" && w.set.pz) : w.type === "image" && w.set.src && !w.set.pz) && inter(me, A().layoutOf(w.id)));
    return L.sort((x, y) => (isImg ? (isShape(y[0]) ? 1e6 : 0) - (isShape(x[0]) ? 1e6 : 0) : 0) || zi(y[0]) - zi(x[0]) || y[1] - x[1]).map(x => x[0]);
  }
  const wname = (w, n) => w.type === "shape" ? ((PB.SHAPES[w.set.shape] || [])[0] || "شكل") : w.type === "image" ? "صورة " + (n + 1) : ((PB.WIDGETS[w.type] || {}).label || "عنصر");
  function css() {
    if (document.getElementById("mk-css")) return; const st = document.createElement("style"); st.id = "mk-css";
    st.textContent = `.pbx-mk{display:flex;flex-direction:column;gap:.45rem;font-size:.8rem}.pbx-mk p{margin:0;color:#6b6556;line-height:1.7;font-size:.76rem}.pbx-mk label{display:flex;flex-direction:column;gap:.2rem;font-weight:700;font-size:.76rem}.pbx-mk select{width:100%;border:1px solid #d9dbe3;border-radius:8px;padding:.35rem;font-family:inherit}
.pbx-mk .pbx-pr{display:flex;flex-direction:column;gap:.15rem;font-weight:700;font-size:.74rem}.pbx-mk .pbx-pr input{width:100%}.pbx-mk .mk-b{display:grid;grid-template-columns:1fr;gap:.35rem}.pbx-mk .mk-go{background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;border:0;padding:.55rem;font-size:.82rem}.pbx-mk .mk-k{flex-direction:row;align-items:center;gap:.4rem;font-weight:600;cursor:pointer}.pbx-mk .mk-list{max-height:290px;overflow:auto;border:1px solid #e6e0d0;border-radius:10px;padding:.35rem;background:#fff}.pbx-mk .mk-gh{font-weight:800;font-size:.72rem;color:#8a8268;margin:.4rem .1rem .2rem}.pbx-mk .mk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.25rem}.pbx-mk .mk-sh{display:flex;align-items:center;gap:.4rem;border:1.5px solid #e6e0d0;background:#faf6ec;border-radius:9px;padding:.25rem .4rem;cursor:pointer;font-family:inherit;font-size:.74rem;font-weight:700;color:#173f35;text-align:start}.pbx-mk .mk-sh.on{border-color:#7c3aed;background:#ede9fe;color:#5b21b6}.pbx-mk .mk-sh .pbx-thumb{width:28px;height:28px;flex:none}.pbx-mk .mk-pend{background:#ecfdf5;border:1.5px solid #86d4b0;border-radius:10px;padding:.5rem;font-size:.76rem;font-weight:700;color:#14573b;line-height:1.7}.pbx-mk .mk-pb{display:flex;gap:.4rem;margin-top:.4rem}.pbx-mk .mk-yes{background:#0d9488;color:#fff;border:0;flex:1;padding:.5rem}.pbx-mk .mk-no{background:#fff;color:#b91c1c;border:1.5px solid #fca5a5;flex:1;padding:.5rem}.pbx-mk .mk-on{background:#ede9fe;color:#6d28d9;border-radius:8px;padding:.35rem .5rem;font-weight:800;font-size:.76rem}`;
    document.head.appendChild(st);
  }
  const libKeys = () => Object.keys(PB.SHAPES).filter(k => !["stroke", "line"].includes(PB.SHAPES[k][1]));
  const libSel = () => S.target && S.target.startsWith("lib:") && PB.SHAPES[S.target.slice(4)] ? S.target.slice(4) : "";
  Object.assign(S, { size: 70, sw: null, sh: null, rot: 0, px: 50, py: 50, invert: false, pend: null, picked: false, dd: false });
  /* مستطيل الشكل داخل الصورة: العرض والارتفاع مستقلان (% من الصورة)، وافتراضيهما مربع بنسبة size من أصغر بُعد */
  const dims = L => { const base = Math.min(L.width, L.height) * S.size / 100, w = Math.max(10, Math.min(L.width, S.sw != null ? L.width * S.sw / 100 : base)), h = Math.max(10, Math.min(L.height, S.sh != null ? L.height * S.sh / 100 : base)); return { L, w, h, x: L.left + (L.width - w) * S.px / 100, y: L.top + (L.height - h) * S.py / 100 }; };
  const fillWH = () => { const inf = A().find(A().E.sel), L = inf && A().layoutOf(inf.node.id); if (!L) return; const d = dims(L); if (S.sw == null) S.sw = Math.round(d.w / L.width * 100); if (S.sh == null) S.sh = Math.round(d.h / L.height * 100); };
  const curWH = inf => { const L = A().layoutOf(inf.node.id); if (!L) return [S.size, S.size]; const d = dims(L); return [Math.round(d.w / L.width * 100), Math.round(d.h / L.height * 100)]; };
  const CHEV = '<svg class="ep-chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const thumbBtn = (val, key, name, on) => `<button type="button" class="mk-sh${on ? " on" : ""}" data-mksh="${esc(val)}" title="${esc(name)}">${PB.shapeThumb(key)}<span>${esc(name)}</span></button>`;
  function panel(inf) {
    css(); if (!inf || inf.kind !== "widget" || inf.set.pz) return "";
    const img = inf.node.type === "image", st = inf.set; if (img && !st.src) return "";
    const L = cands(inf), lib = img ? libSel() : "", cur = lib ? null : (L.find(w => w.id === S.target) || L[0]), pend = !!(S.pend && S.pend.id === inf.node.id);
    const reset = img && st.clip && !pend ? `<div class="mk-on">الماسك مفعّل (${st.clipMode === "out" ? "شكل محذوف من الصورة" : "الصورة داخل الشكل فقط"})</div><button type="button" class="pbx-small" data-mk="reset">إلغاء الماسك (الصورة كاملة)</button>` : "";
    const iAll = (inf.sec.free || []).filter(w => w.type === "image"), wh = curWH(inf), sl = (k, lbl, mn, mx) => { const v = k === "sw" ? wh[0] : k === "sh" ? wh[1] : S[k]; return `<label class="pbx-pr">${lbl} <b>${v}</b><input type="range" data-mkk="${k}" min="${mn}" max="${mx}" value="${v}"></label>`; };
    const invertUi = `<label class="mk-k"><input type="checkbox" data-mkk="invert" ${S.invert ? "checked" : ""}> اعكس: أبقِ الشكل وأخفِ بقية الصورة</label><p>الافتراضي: <b>يُحذف الشكل من الصورة</b> (يُثقب مكانه). فعّل «اعكس» لتبقى الصورة داخل الشكل فقط.</p>`;
    if (!img) {      // من جهة الشكل: اختيار الصورة التي تحته
      const hint = L.length ? "" : `<p>ضع هذا العنصر فوق <b>صورة</b> ثم اضغط «تطبيق الماسك» (أو بالزر الأيمن على العنصر).</p>`;
      return `<div class="pbx-mk">${hint}${L.length ? `<label>الصورة التي تحت الشكل<select data-mkk="target">${L.map(w => `<option value="${esc(w.id)}"${cur && w.id === cur.id ? " selected" : ""}>${esc(wname(w, iAll.indexOf(w)))}</option>`).join("")}</select></label>` : ""}
${invertUi}<label class="mk-k"><input type="checkbox" data-mkk="keep" ${S.keep ? "checked" : ""}> احتفظ بالشكل كعنصر بعد التطبيق</label>
<div class="mk-b"><button type="button" class="pbx-small mk-go" data-mk="apply">تطبيق الماسك</button></div></div>`; }
    // من جهة الصورة: أشكال حقيقية بجانب أسمائها (الموضوعة فوق الصورة + المكتبة) + معاينة حيّة على الصفحة
    const val = lib ? "lib:" + lib : cur ? cur.id : "lib:ellipse", cl = val.startsWith("lib:"), shown = S.picked || pend || !!st.clip;
    const small = (v, key, name, on) => `<button type="button" class="ep-it${on ? " on" : ""}" data-mksh="${esc(v)}" title="${esc(name)}">${PB.shapeThumb(key)}<span>${esc(name)}</span></button>`;
    const curKey = lib || (cur && cur.set ? maskKey(cur) : ""), curName = lib ? PB.SHAPES[lib][0] : cur ? wname(cur, 0) : "";
    const placed = L.length ? `<div class="mk-gh">عناصر متداخلة مع الصورة في الصفحة</div><div class="mk-grid">${L.map((w, i) => small(w.id, maskKey(w), wname(w, iAll.indexOf(w)), val === w.id)).join("")}</div>` : "";
    const groups = PB.SHAPE_GROUPS.map(g => { const ks = libKeys().filter(k => PB.SHAPES[k][4] === g); return ks.length ? `<div class="mk-gh">${esc(g)}</div><div class="mk-grid">${ks.map(k => small("lib:" + k, k, PB.SHAPES[k][0], val === "lib:" + k)).join("")}</div>` : ""; }).join("");
    const dd = `<div class="ep-dd"><button type="button" class="ep-ddb${S.dd ? " open" : ""}" data-ddt="mk">${S.picked && curKey ? PB.shapeThumb(curKey) : ""}<b>${S.picked && curName ? esc(curName) : "اختر شكل الماسك"}</b>${CHEV}</button>${S.dd ? `<div class="ep-ddl mk-list">${placed}${groups}</div>` : ""}</div>`;
    const hint = pend ? `<p>تظهر المعاينة على الصورة — اسحب الشكل بالفأرة فوق الصورة لتحريكه، وأي جانب من إطاره البنفسجي أو زاويته لتعديل شكله (الزاوية تحفظ النسبة)، ثم اضغط ✓ العائمة تحت الصورة للتأكيد أو ✕ للإلغاء.</p>` : `<p>اختر شكلاً من القائمة لتظهر معاينته مباشرة على الصورة.</p>`;
    return `<div class="pbx-mk">${reset}${dd}
${shown && cl ? `<div class="mk-pre"><button type="button" class="pbx-small" data-mkp="c" title="يضع الشكل في مركز الصورة تماماً">وسط الصورة</button>${[30, 50, 70, 100].map(v => `<button type="button" class="pbx-small" data-mkp="${v}" title="حجم الشكل ${v}% من الصورة">${v}%</button>`).join("")}</div>${sl("sw", "عرض الشكل %", 5, 100)}${sl("sh", "ارتفاع الشكل %", 5, 100)}${sl("px", "الموضع الأفقي %", 0, 100)}${sl("rot", "تدوير الشكل °", -180, 180)}${sl("py", "الموضع العمودي %", 0, 100)}<button type="button" class="pbx-small" data-mk="place" title="يضع الشكل المختار فوق الصورة كعنصر لتحرّكه وتكبّره بيدك ثم تطبّق الماسك">ضعه فوق الصورة كعنصر لأعدّله بيدي</button>` : shown ? `<label class="mk-k"><input type="checkbox" data-mkk="keep" ${S.keep ? "checked" : ""}> احتفظ بالشكل كعنصر بعد التطبيق</label>` : ""}
${invertUi}${hint}</div>`;
  }
  /* خيارات اللوحة؛ تعيد true إن لزم إعادة رسم اللوحة. أي تغيير على الصورة يحدّث المعاينة الحيّة فوراً */
  function opt(k, v) {
    if (k === "dd") { S.dd = !S.dd; return true; }
    if (k === "target") { S.target = v; S.picked = true; S.dd = false; } else if (k === "keep") S.keep = !!v; else if (k === "invert") S.invert = !!v; else if (k === "size") { S.size = Number(v); S.sw = S.sh = null; } else if (k === "sw" || k === "sh") { fillWH(); S[k] = Number(v); } else if (k === "px" || k === "py" || k === "rot") S[k] = Number(v); else return false;
    const had = !!S.pend, ok = S.picked ? livePreview() : false; return k === "target" || k === "invert" || (!had && ok);
  }
  function livePreview() {      // يحدّث المعاينة إن كان المحدّد صورة بها صورة؛ يعيد true إن بدأت معاينة جديدة
    const inf = A().find(A().E.sel); if (!inf || inf.node.type !== "image" || !inf.set.src || inf.set.pz) return false; const had = !!S.pend; preview(inf); return !had && !!S.pend;
  }
  /* مربع تحريك الشكل فوق الصورة قبل التأكيد: اسحب الجسم لنقل الشكل، والمقبض لتكبيره */
  let box = null;
  const boxGeom = inf => { const L = A().layoutOf(inf.node.id); return L ? dims(L) : null; };
  function hideBox() { if (box) { box.el.remove(); if (box.v) { box.v.remove(); box.h.remove(); } box = null; } }
  /* معالم المنتصف: خطّا مركز الصورة (متقطّعان) يتوهّجان عند محاذاة مركز الشكل لهما، ويتجاذب الشكل معهما ومع حواف الصورة (Alt يعطّل التجاذب) */
  function guides(g, f, s) {
    if (!box.v) { box.v = document.createElement("i"); box.v.className = "mk-gl v"; box.h = document.createElement("i"); box.h.className = "mk-gl h"; document.body.append(box.v, box.h); }
    const L = g.L, rx = L.width - g.w, ry = L.height - g.h;
    box.v.style.cssText = `left:${f.left + (L.left + L.width / 2) * s}px;top:${f.top + L.top * s}px;height:${L.height * s}px`; box.h.style.cssText = `left:${f.left + L.left * s}px;top:${f.top + (L.top + L.height / 2) * s}px;width:${L.width * s}px`;
    box.v.classList.toggle("hot", rx > 1 && S.px === 50); box.h.classList.toggle("hot", ry > 1 && S.py === 50);
  }
  function snapPos(g, s, raw) {      // raw: [px,py] بالنسبة المئوية → بعد التجاذب مع المركز والحواف
    const L = g.L, T = 8 / s, out = raw.slice(), rx = L.width - g.w, ry = L.height - g.h;
    [[0, rx, L.width, g.w], [1, ry, L.height, g.h]].forEach(([i, r, W, sz]) => { if (r <= 1) return; const off = r * raw[i] / 100, cen = off + sz / 2;
      if (Math.abs(cen - W / 2) < T) out[i] = 50; else if (off < T) out[i] = 0; else if (r - off < T) out[i] = 100; });
    return out;
  }
  function placeBox() {
    if (!box) return; const inf = A().find(box.id), fw = document.getElementById("pbx-fw"); if (!inf || !fw || !S.pend || !libSel()) return hideBox();
    const g = boxGeom(inf); if (!g) return hideBox(); const f = fw.getBoundingClientRect(), s = A().E.scale || 1, st = box.el.style;
    st.left = (f.left + g.x * s) + "px"; st.top = (f.top + g.y * s) + "px"; st.width = (g.w * s) + "px"; st.height = (g.h * s) + "px"; st.transform = S.rot ? `rotate(${S.rot}deg)` : ""; guides(g, f, s);
  }
  function showBox(inf) {
    if (!S.pend || !libSel() || !inf || inf.node.type !== "image") return hideBox();
    if (!box || box.id !== inf.node.id) {
      hideBox(); const el = document.createElement("div"); el.className = "mk-box"; el.innerHTML = ["n", "s", "e", "w", "ne", "nw", "se", "sw"].map(h => `<i class="mk-hd" data-h="${h}"></i>`).join("") + '<i class="mk-rot" data-h="rot" title="اسحب لتدوير الشكل (Shift = بلا تجاذب للزوايا)"></i>'; document.body.appendChild(el); box = { id: inf.node.id, el };
      const down = (e, h) => { e.preventDefault(); e.stopPropagation(); const i2 = A().find(box.id), g = boxGeom(i2); if (!g) return; const s = A().E.scale || 1, x0 = e.clientX, y0 = e.clientY, L = g.L, W = L.width, H = L.height, l0 = g.x - L.left, t0 = g.y - L.top, w0 = g.w, h0 = g.h, MIN = 12, rad = (S.rot || 0) * Math.PI / 180, co = Math.cos(rad), si = Math.sin(rad), bc = el.getBoundingClientRect(), ccx = bc.left + bc.width / 2, ccy = bc.top + bc.height / 2; el.setPointerCapture(e.pointerId);
        const mv = ev => {
          if (h === "rot") { let a = Math.atan2(ev.clientY - ccy, ev.clientX - ccx) * 180 / Math.PI + 90; a = ((a + 540) % 360) - 180; if (!ev.shiftKey) [-180, -135, -90, -45, 0, 45, 90, 135, 180].forEach(q => { if (Math.abs(a - q) < 4) a = q; }); S.rot = Math.round(a) === -180 ? 180 : Math.round(a); }
          else { const dx = (ev.clientX - x0) / s, dy = (ev.clientY - y0) / s;
            if (!h) { const raw = [Math.max(0, Math.min(100, W - w0 > 1 ? (l0 + dx) / (W - w0) * 100 : 50)), Math.max(0, Math.min(100, H - h0 > 1 ? (t0 + dy) / (H - h0) * 100 : 50))], sn = ev.altKey ? raw : snapPos(g, s, raw); S.px = Math.round(sn[0]); S.py = Math.round(sn[1]); }
            else { const dxl = dx * co + dy * si, dyl = -dx * si + dy * co; let l = l0, t = t0, r = l0 + w0, b = t0 + h0;      // الإزاحة في إطار الشكل المُدار
              if (h.includes("w")) l += dxl; if (h.includes("e")) r += dxl; if (h.includes("n")) t += dyl; if (h.includes("s")) b += dyl;
              if (h.length === 2 && !ev.shiftKey) { const k = Math.max((r - l) / w0, (b - t) / h0); if (h.includes("w")) l = r - w0 * k; else r = l + w0 * k; if (h.includes("n")) t = b - h0 * k; else b = t + h0 * k; }      // الزاوية تحفظ النسبة (Shift = حرّة)
              if (r - l < MIN) { if (h.includes("w")) l = r - MIN; else r = l + MIN; } if (b - t < MIN) { if (h.includes("n")) t = b - MIN; else b = t + MIN; }
              let w = Math.min(W, r - l), hh = Math.min(H, b - t); const c0x = l0 + w0 / 2, c0y = t0 + h0 / 2, sx = (l + r) / 2 - c0x, sy = (t + b) / 2 - c0y, ncx = c0x + sx * co - sy * si, ncy = c0y + sx * si + sy * co;      // المركز الجديد يُدار مع الشكل
              const nl = Math.max(0, Math.min(W - w, ncx - w / 2)), nt = Math.max(0, Math.min(H - hh, ncy - hh / 2));
              S.sw = Math.round(w / W * 100); S.sh = Math.round(hh / H * 100); S.px = W - w > 1 ? Math.round(nl / (W - w) * 100) : 50; S.py = H - hh > 1 ? Math.round(nt / (H - hh) * 100) : 50; } }
          const i3 = A().find(box.id); if (i3) { preview(i3); placeBox(); } };
        const up = () => { el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); if (S.hook) S.hook(); }; el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up); };
      el.addEventListener("pointerdown", e => { const hd = e.target.closest("[data-h]"); down(e, hd ? hd.dataset.h : ""); });
    }
    placeBox();
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
    let del = false;
    if (lib) { const d = dims(iR); key = lib; shpNode = { set: { shape: lib, rx: 0, keep: false, rot: S.rot ? { d: S.rot, t: S.rot, m: S.rot } : undefined } }; rs = rings(shpNode, iR, { left: d.x, top: d.y, width: d.w, height: d.h }, E); }
    else { const shp = A().find(isImg ? other.id : inf.node.id); if (!shp) return { err: "تعذّر إيجاد العنصر" }; shpNode = shp.node; del = isShape(shpNode); const sR = A().layoutOf(shp.node.id); if (!sR) return { err: "تعذّر قراءة العنصر" };
      let ringNode = shpNode; if (!del) { const mn = Math.min(sR.width, sR.height) || 1; ringNode = { set: { shape: rectKey(), keep: false, rx: Math.max(0, Math.min(50, (Number(PB.eff(shpNode.set, "rad", E.dev)) || 0) / mn * 100)), rot: shpNode.set.rot } }; }      // عنصر غير شكل: يُستعمل مستطيله (بتدوير زواياه) كماسك
      key = ringNode.set.shape; rs = rings(ringNode, iR, sR, E); }
    if (!rs.length) return { err: "تعذّر قراءة الشكل" };
    const eo = ((PB.SHAPES[key] || [])[5] === "evenodd");
    return mode === "in" ? { img, mode, clip: pathOf(rs), eo, lib, shpNode, del } : { img, mode, clip: (b.clip || "M0 0L1 0L1 1L0 1Z") + pathOf(rs), eo: true, lib, shpNode, del };
  }
  const setClip = (img, r) => { img.set.clip = r.clip; if (r.eo) img.set.clipEO = true; else delete img.set.clipEO; img.set.clipMode = r.mode; };
  function restorePend() { const p = S.pend; if (!p) return null; const img = A().find(p.id); S.pend = null; if (img) { ["clip", "clipEO", "clipMode"].forEach(k => { if (p.prev[k] === undefined) delete img.set[k]; else img.set[k] = p.prev[k]; }); } return img; }
  function preview(inf) {      // معاينة حيّة: تُطبَّق على الصفحة بلا حفظ في السجل حتى «تأكيد»
    if (S.pend && S.pend.id !== inf.node.id) { restorePend(); }
    const base = S.pend ? S.pend.prev : { clip: inf.set.clip, clipEO: inf.set.clipEO, clipMode: inf.set.clipMode }, r = compute(inf, base);
    if (r.err) { toast(r.err); return; }
    if (!S.pend) S.pend = { id: r.img.node.id, prev: base };
    setClip(r.img, r); A().renderCanvas(); showBox(A().find(r.img.node.id));
  }
  function cancel() { const img = restorePend(); hideBox(); if (img) A().renderCanvas(); }
  function act(name, inf) {
    const E = A().E; if (name === "reset") { cancel(); S.picked = false; delete inf.set.clip; delete inf.set.clipEO; delete inf.set.clipMode; E.nextLabel = "إلغاء الماسك"; A().commitAfter(); return; }
    if (name === "no") { cancel(); toast("أُلغيت المعاينة"); return; }
    if (name === "preview") { preview(inf); return; }
    if (name === "place") {
      const isImg = inf.node.type === "image", lib = isImg ? libSel() : ""; if (!lib) return; const img = A().find(inf.node.id), iR = A().layoutOf(img.node.id); if (!iR) return;
      cancel(); const d = dims(iR), bx = { left: d.x, top: d.y, w: d.w, h: d.h };
      const sh = PB.mkFree("shape", 0, 0, (Number(img.set.zi) || 0) + 1), E2 = E; sh.set.shape = lib; sh.set.fill = "#c8a24b"; if (S.rot) PB.setR(sh.set, "rot", E2.dev, S.rot);
      const g = { fx: Number(PB.eff(img.set, "fx", E2.dev)), fy: Number(PB.eff(img.set, "fy", E2.dev)), fwd: Number(PB.eff(img.set, "fwd", E2.dev)), fh: Number(PB.eff(img.set, "fh", E2.dev)) };
      PB.setR(sh.set, "fx", E2.dev, +(g.fx + (bx.left - iR.left) / iR.width * g.fwd).toFixed(2)); PB.setR(sh.set, "fy", E2.dev, +(g.fy + (bx.top - iR.top) / iR.height * g.fh).toFixed(2)); PB.setR(sh.set, "fwd", E2.dev, +(bx.w / iR.width * g.fwd).toFixed(2)); PB.setR(sh.set, "fh", E2.dev, +(bx.h / iR.height * g.fh).toFixed(2));
      img.list.splice(img.idx + 1, 0, sh); E.nextLabel = "إضافة شكل للماسك"; E.sel = sh.id; S.target = img.node.id; A().commitAfter(sh.id); toast("وُضع الشكل فوق الصورة — حرّكه وكبّره ثم اختر الصورة في «ماسك» وطبّق"); return; }
    // ok / apply: تأكيد المعاينة، أو تطبيق مباشر من جهة الشكل
    const pend = S.pend && S.pend.id === inf.node.id ? S.pend : null; if (pend) S.pend = null; hideBox(); S.picked = false;
    const base = pend ? pend.prev : null, r = compute(inf, base);
    if (r.err) { if (pend) { S.pend = pend; } toast(r.err); return; }
    setClip(r.img, r);
    if (!r.lib && r.del && !S.keep) { const shp = A().find(r.shpNode.id); if (shp) { const i = shp.list.indexOf(shp.node); if (i >= 0) shp.list.splice(i, 1); } }
    E.nextLabel = r.mode === "in" ? "ماسك: إبقاء داخل الشكل" : "ماسك: حذف الشكل من الصورة"; E.sel = r.img.node.id; A().commitAfter(r.img.node.id);
    S.sw = S.sh = null; S.rot = 0; toast(r.mode === "in" ? "بقيت الصورة داخل الشكل فقط" : "حُذف الشكل من الصورة");
  }
  /* الزر الأيمن على عنصر موضوع فوق صورة (أو صورة تحتها عنصر): ماسك فوري عادي أو معكوس بلا فتح اللوحة */
  const can = inf => { try { return !!inf && inf.kind === "widget" && !!inf.free && !inf.set.pz && (inf.node.type !== "image" || !!inf.set.src) && cands(inf).length > 0; } catch (e) { return false; } };
  function quick(inf, invert) {
    cancel(); const L = cands(inf); if (!L.length) { toast("ضع عنصراً فوق الصورة أولاً"); return; }
    S.invert = !!invert; S.target = L[0].id; S.picked = false; S.keep = false; S.rot = 0; act("apply", inf);
  }
  return { panel, opt, act, cancel, can, quick, hideBox, reposition: placeBox, setHook: f => { S.hook = f; }, pending: () => (S.pend ? S.pend.id : "") };
})();
