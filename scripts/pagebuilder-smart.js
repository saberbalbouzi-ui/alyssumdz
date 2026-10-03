/* ═══ أدوات ذكية في منشئ الصفحات: «التقاط النص» (مثل Canva) ═══
   تفحص الصورة المحدّدة، تحيط النصوص المكتشفة بمستطيلات بنفسجية، وتعرض نافذة بخيارين: «عنصر» (نص واحد تنقر عليه) أو «كل النصوص».
   عند «التقاط» تُقرأ النصوص (Gemini إن وُجد مفتاحه وإلا Tesseract)، تُمسح من الصورة بدقة مع إعادة رسم الخلفية، وتصير عناصر نص قابلة للتعديل فوق الصورة.
   تعمل على صورة داخل قسم «كانفاس» (الصفحات المولَّدة). تعتمد على assets/js/text-capture.js و image-tools.js. */
const PBSmart = (function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const FSK = { ar: 1.15, lat: .74 }, ARABIC = /[؀-ۿ]/;
  const A = () => PBApp;
  function pane() {
    const card = (ic, title, desc, fn) => `<div style="border:1.5px solid #e4dfd2;border-radius:12px;padding:.7rem;background:#fff;margin-bottom:.6rem"><div style="font-weight:800">${ic} ${title}</div><div style="font-size:.78rem;color:#6b6556;line-height:1.7;margin:.3rem 0 .6rem">${desc}</div><button type="button" style="width:100%;background:#7c3aed;color:#fff;border:0;border-radius:10px;padding:.55rem;font-weight:800;cursor:pointer;font-family:inherit" onclick="PBSmart.${fn}()">${title} من الصورة المحدّدة</button></div>`;
    return `<div class="pbx-f"><div style="font-weight:900;color:#173f35;margin-bottom:.2rem">🪄 أدوات ذكية</div>
<div style="font-size:.76rem;color:#6b6556;line-height:1.7;margin-bottom:.6rem">حدّد صورة داخل قسم كانفاس (الصفحات المولَّدة)، ثم اختر الأداة: تمسح الصورة وتحيط بما يمكن فصله بخط بنفسجي، وتختار <b>عنصراً</b> أو <b>الكل</b> ثم «التقاط».</div>
${card("🔤", "التقاط النص", "يفصل النصوص عن الصورة بدقة ويحوّلها إلى نصوص قابلة للتعديل، وتُمسح من الصورة وتبقى خلفيتها.", "capture")}
${card("🖼️", "التقاط العناصر", "يفصل المنتجات والأعشاب والمكوّنات والأشكال <b>مع ظلالها</b> (والعناصر الصغيرة المتجمعة عنصراً واحداً) كصور شفافة مستقلة، وتبقى الخلفية.", "captureElements")}
</div>`;
  }
  /* تحميل صورة الودجت كقماش بالحجم الطبيعي */
  function loadCanvas(src) {
    return new Promise((res, rej) => {
      const url = A().localize(String(src)), im = new Image(); im.crossOrigin = "anonymous";
      im.onload = () => { const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d", { willReadFrequently: true }).drawImage(im, 0, 0); res(c); };
      im.onerror = () => rej(new Error("تعذّر تحميل الصورة (" + src + ")")); im.src = url;
    });
  }
  function target() {
    const inf = A().E && A().E.sel ? A().find(A().E.sel) : null;
    if (!inf || inf.kind !== "widget" || inf.node.type !== "image" || !inf.node.set.src) return { err: "حدّد صورة أولاً (انقر عليها في الصفحة) ثم افتح «أدوات ذكية»." };
    if (!inf.free || inf.sec.set.kind !== "canvas") return { err: "التقاط النص يعمل على الصور داخل أقسام الكانفاس (الصفحات المولَّدة بالذكاء الاصطناعي)." };
    return { inf };
  }
  /* هيكل النافذة المشترك (يشبه لوحة Canva): صورة بنفسجية الإطارات + لوحة خيارات «عنصر / الكل» + زر التقاط */
  function shell(title, oneLabel, allLabel, hintOne, hintAll) {
    const host = document.createElement("div"); host.id = "pbs-modal";
    host.style.cssText = "position:fixed;inset:0;z-index:10050;background:rgba(15,15,20,.72);display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:inherit";
    host.innerHTML = `<div style="background:#fff;border-radius:16px;display:flex;gap:0;max-width:1100px;width:100%;max-height:94vh;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)">
  <div id="pbs-view" style="flex:1;min-width:0;background:repeating-conic-gradient(#3a3a42 0% 25%,#33333a 0% 50%) 50%/20px 20px;overflow:auto;position:relative"><div id="pbs-stage" style="position:relative;margin:0 auto;width:fit-content"></div><div id="pbs-load" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;background:rgba(0,0,0,.35)">⏳ جارِ مسح الصورة…</div></div>
  <div style="width:320px;flex:0 0 320px;padding:1.1rem;display:flex;flex-direction:column;gap:.9rem;overflow:auto">
    <div style="display:flex;align-items:center;gap:.6rem"><button id="pbs-back" title="رجوع" style="border:0;background:none;font-size:1.3rem;cursor:pointer">→</button><b style="font-size:1.05rem;flex:1">${title}</b><button id="pbs-x" title="إغلاق" style="border:0;background:none;font-size:1.4rem;cursor:pointer">✕</button></div>
    <div style="font-weight:800;line-height:1.6">حدّد ما تريد التقاطه.</div>
    <div id="pbs-seg" style="display:flex;background:#f3f2f6;border-radius:12px;padding:4px"><button data-m="one" style="flex:1;border:0;border-radius:9px;padding:.55rem;cursor:pointer;font-weight:700;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.15)">✨ ${oneLabel}</button><button data-m="all" style="flex:1;border:0;border-radius:9px;padding:.55rem;cursor:pointer;font-weight:700;background:transparent">${allLabel}</button></div>
    <div id="pbs-hint" style="font-size:.8rem;color:#6b6556;line-height:1.7">${hintOne}</div>
    <button id="pbs-go" disabled style="border:0;border-radius:12px;padding:.8rem;font-weight:800;font-size:1rem;cursor:pointer;background:#7c3aed;color:#fff">التقاط</button>
    <div id="pbs-msg" style="font-size:.78rem;line-height:1.7;color:#173f35;min-height:3em"></div>
    <div style="font-size:.74rem;color:#8a8472;border-top:1px solid #eee;padding-top:.6rem">تعمل الأداة داخل متصفحك. الصورة الأصلية لا تتغير إلا عند «التقاط».</div>
  </div></div>`;
    document.body.appendChild(host); const $ = id => host.querySelector("#" + id), S = { mode: "one", closed: false, hintOne, hintAll };
    const close = () => { S.closed = true; host.remove(); }; $("pbs-x").onclick = $("pbs-back").onclick = close;
    return { host, $, S, close };
  }
  function bindSeg(sh, repaint) { sh.host.querySelectorAll("#pbs-seg button").forEach(b => b.onclick = () => { sh.S.mode = b.dataset.m; sh.S.onMode && sh.S.onMode(); sh.host.querySelectorAll("#pbs-seg button").forEach(x => { const on = x === b; x.style.background = on ? "#fff" : "transparent"; x.style.boxShadow = on ? "0 1px 4px rgba(0,0,0,.15)" : "none"; }); sh.$("pbs-hint").textContent = sh.S.mode === "one" ? sh.S.hintOne : sh.S.hintAll; repaint(); }); }
  function viewSize(sh, W, H) { const view = sh.$("pbs-view"), vw = Math.max(260, Math.min(W, view.clientWidth - 24)), k = vw / W; return { vw, vh: Math.round(H * k), k }; }

  /* ═══ التقاط النص ═══ */
  async function capture() {
    const t = target(); if (t.err) return alert(t.err);
    const inf = t.inf, w = inf.node, sh = shell("التقاط النص", "عنصر", "كل النصوص", "انقر على أحد المستطيلات البنفسجية لاختيار نص واحد. فاتك نص؟ ارسم مستطيلاً حوله بالسحب.", "ستُلتقط كل النصوص المكتشفة دفعة واحدة."), $ = sh.$;
    let cv; try { cv = await loadCanvas(w.set.src); } catch (e) { $("pbs-load").textContent = "⚠️ " + e.message; return; }
    const W = cv.width, H = cv.height; await new Promise(r => setTimeout(r, 40));
    /* مسح الصورة: كشف بالصورة (+ قراءة إن وُجد مفتاح Gemini ليكون الكشف أدق وتُستبعد الصناديق غير النصية) */
    let sc; try { sc = await TextCapture.scan(cv, { ocr: !!TextCapture.ocr.key() }); } catch (e) { $("pbs-load").textContent = "⚠️ " + e.message; return; }
    if (sh.S.closed) return; $("pbs-load").style.display = "none"; const items = sc.items; items.forEach((b, i) => b.i = i);
    const stage = $("pbs-stage"), { vw, vh, k } = viewSize(sh, W, H);
    const img = document.createElement("canvas"); img.width = vw; img.height = vh; img.getContext("2d").drawImage(cv, 0, 0, vw, vh); img.style.cssText = "display:block;background:#fff"; stage.appendChild(img);
    const ov = document.createElement("canvas"); ov.width = vw; ov.height = vh; ov.style.cssText = "position:absolute;left:0;top:0;cursor:pointer"; stage.appendChild(ov);
    let sel = new Set(), hov = -1;
    const R = b => { const c = b.core || b; return { x: Math.max(0, c.x0 - 3) * k, y: Math.max(0, c.y0 - 3) * k, w: (c.x1 - c.x0 + 6) * k, h: (c.y1 - c.y0 + 6) * k }; };
    function paint() {
      const g = ov.getContext("2d"), mode = sh.S.mode; g.clearRect(0, 0, vw, vh);
      items.forEach(b => { const r = R(b), on = mode === "all" || sel.has(b.i); g.lineWidth = on || hov === b.i ? 3 : 2; g.strokeStyle = "#7c3aed"; if (on) { g.fillStyle = "rgba(124,58,237,.22)"; g.fillRect(r.x, r.y, r.w, r.h); } else if (hov === b.i) { g.fillStyle = "rgba(124,58,237,.1)"; g.fillRect(r.x, r.y, r.w, r.h); } g.setLineDash(on ? [] : [6, 3]); g.strokeRect(r.x, r.y, r.w, r.h); });
      const n = mode === "all" ? items.length : sel.size; $("pbs-go").disabled = !n; $("pbs-go").textContent = mode === "all" ? "التقاط " + items.length + " نصاً" : "التقاط";
      $("pbs-msg").textContent = items.length ? (mode === "all" ? "سيُلتقط كل النصوص المحيطة بمستطيلات بنفسجية (" + items.length + ")." : sel.size ? "نص محدّد." : "") : "لم أجد نصوصاً في هذه الصورة.";
    }
    const at = e => { const r = ov.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let hit = -1; items.forEach(b => { const q = R(b); if (x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) hit = b.i; }); return hit; };
    let drag = null;
    ov.onmousemove = e => { const h = at(e); if (h !== hov) { hov = h; paint(); } };
    ov.onclick = e => { if (drag && drag.moved) return; if (sh.S.mode !== "one") return; const h = at(e); if (h < 0) return; sel = new Set([h]); paint(); };
    ov.onmousedown = e => { if (at(e) >= 0) return; const r = ov.getBoundingClientRect(); drag = { x: e.clientX - r.left, y: e.clientY - r.top, moved: false }; };
    const mm = ev => { if (!drag) return; const r = ov.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top; if (Math.abs(x - drag.x) + Math.abs(y - drag.y) > 6) drag.moved = true; if (drag.moved) { paint(); const g = ov.getContext("2d"); g.setLineDash([4, 3]); g.strokeStyle = "#16a34a"; g.lineWidth = 2; g.strokeRect(Math.min(drag.x, x), Math.min(drag.y, y), Math.abs(x - drag.x), Math.abs(y - drag.y)); } };
    const mu = ev => { if (!drag) return; const d = drag; drag = null; if (!d.moved || sh.S.closed) return; const r = ov.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, b = { x0: Math.max(0, Math.min(d.x, x) / k), x1: Math.min(W, Math.max(d.x, x) / k), y0: Math.max(0, Math.min(d.y, y) / k), y1: Math.min(H, Math.max(d.y, y) / k) };
      if (b.x1 - b.x0 < 12 || b.y1 - b.y0 < 8) return paint(); const g2 = cv.getContext("2d", { willReadFrequently: true }), c = ImageTools.inkColor(g2, b); Object.assign(b, c, { manual: true, i: items.length }); b.core = ImageTools.coreBox(g2, b, c.ink, c.bg); items.push(b); sel = new Set([b.i]); paint(); $("pbs-msg").textContent = "أُضيف نص يدوي. اضغط «التقاط»."; };
    window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu); const cl0 = sh.close; sh.close = () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); cl0(); };
    $("pbs-x").onclick = $("pbs-back").onclick = () => sh.close(); bindSeg(sh, () => { sel = new Set(); paint(); }); paint();
    $("pbs-go").onclick = async () => {
      const chosen = sh.S.mode === "all" ? items.slice() : items.filter(b => sel.has(b.i)); if (!chosen.length) return; $("pbs-go").disabled = true;
      try {
        $("pbs-msg").textContent = "⏳ قراءة النصوص…"; let use = chosen;
        if (!chosen.every(b => b.text && !b.placeholder)) { const r = await TextCapture.readInto(cv, chosen.map(b => Object.assign({}, b))); use = r.items; if (!r.hadOcr) $("pbs-msg").textContent = "تعذّرت القراءة (" + (r.note || "بلا مفتاح") + ") — ستُوضع نصوص بديلة تكتبها أنت."; }
        $("pbs-msg").textContent = "⏳ فصل النصوص عن الصورة…"; await new Promise(r => setTimeout(r, 30));
        const work = document.createElement("canvas"); work.width = W; work.height = H; work.getContext("2d", { willReadFrequently: true }).drawImage(cv, 0, 0);
        const res = await TextCapture.erase(work, use), skipped = res.filter(x => x.skipped).length;
        $("pbs-msg").textContent = "⏳ إنشاء عناصر النص…"; await new Promise(r => setTimeout(r, 30));
        const path = await A().uploadBlob(await new Promise(r => work.toBlob(r, "image/png")), "txt-" + Date.now().toString(36), { max: 3200, q: .95 });
        const n = apply(inf, w, work.width, work.height, use, path); sh.close(); alert("✅ التُقط " + n + " نصاً وصار قابلاً للتعديل" + (skipped ? "\nℹ️ بقي " + skipped + " نصاً على خلفية معقدة (صورة) لم يُمسح." : ""));
      } catch (e) { console.error(e); $("pbs-msg").textContent = "⚠️ " + e.message; $("pbs-go").disabled = false; }
    };
  }

  /* ═══ التقاط العناصر: تحيط الأداة بكل عنصر قابل للفصل بخط بنفسجي يتبع حدوده ═══ */
  async function captureElements() {
    const t = target(); if (t.err) return alert(t.err);
    const inf = t.inf, w = inf.node, sh = shell("التقاط العناصر", "عنصر", "كل العناصر", "انقر على أحد العناصر المحاطة بالبنفسجي لاختياره (منتج، عشبة، مكوّنات…).", "ستُلتقط كل العناصر القابلة للفصل دفعة واحدة وتبقى الخلفية."), $ = sh.$;
    let cv; try { cv = await loadCanvas(w.set.src); } catch (e) { $("pbs-load").textContent = "⚠️ " + e.message; return; }
    const W = cv.width, H = cv.height; await new Promise(r => setTimeout(r, 40));
    let sc; try { sc = ImageTools.scanElements(cv); } catch (e) { console.error(e); $("pbs-load").textContent = "⚠️ " + e.message; return; }
    if (sh.S.closed) return; $("pbs-load").style.display = "none"; const items = sc.items;
    const stage = $("pbs-stage"), { vw, vh, k } = viewSize(sh, W, H);
    const img = document.createElement("canvas"); img.width = vw; img.height = vh; img.getContext("2d").drawImage(cv, 0, 0, vw, vh); img.style.cssText = "display:block;background:#fff"; stage.appendChild(img);
    const ov = document.createElement("canvas"); ov.width = vw; ov.height = vh; ov.style.cssText = "position:absolute;left:0;top:0;cursor:pointer"; stage.appendChild(ov);
    /* حدود كل عنصر بدقة البكسل (بدقة العرض): قناع ألفا مصغَّر + خط خارجي بنفسجي + تعبئة شفافة عند الاختيار */
    items.forEach(it => {
      const dw = Math.max(2, Math.round(it.cut.w * k)), dh = Math.max(2, Math.round(it.cut.h * k)), c = document.createElement("canvas"); c.width = dw; c.height = dh; c.getContext("2d").drawImage(it.cut.canvas, 0, 0, dw, dh);
      const d = c.getContext("2d").getImageData(0, 0, dw, dh).data, a = new Uint8Array(dw * dh); for (let i = 0; i < dw * dh; i++) a[i] = d[i * 4 + 3] > 90 ? 1 : 0;
      const O = 2, o = new Uint8Array(dw * dh); for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) { if (a[y * dw + x]) continue; let near = false; for (let dy = -O; dy <= O && !near; dy++) for (let dx = -O; dx <= O; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < dw && yy < dh && a[yy * dw + xx]) { near = true; break; } } if (near) o[y * dw + x] = 1; }
      const mk = (fn) => { const cc = document.createElement("canvas"); cc.width = dw; cc.height = dh; const g = cc.getContext("2d"), im = g.createImageData(dw, dh); for (let i = 0; i < dw * dh; i++) { const v = fn(i); if (v) { im.data[i * 4] = 124; im.data[i * 4 + 1] = 58; im.data[i * 4 + 2] = 237; im.data[i * 4 + 3] = v; } } g.putImageData(im, 0, 0); return cc; };
      it.dx = Math.round(it.x0 * k); it.dy = Math.round(it.y0 * k); it.dw = dw; it.dh = dh; it.a = a; it.out = mk(i => o[i] ? 255 : 0); it.fill = mk(i => a[i] ? 85 : 0);
    });
    let sel = new Set(), hov = -1;
    function paint() {
      const g = ov.getContext("2d"), mode = sh.S.mode; g.clearRect(0, 0, vw, vh);
      items.forEach(it => { const on = mode === "all" || sel.has(it.id); if (on) g.drawImage(it.fill, it.dx, it.dy); else if (hov === it.id) { g.globalAlpha = .45; g.drawImage(it.fill, it.dx, it.dy); g.globalAlpha = 1; } g.drawImage(it.out, it.dx, it.dy); if (on || hov === it.id) g.drawImage(it.out, it.dx, it.dy); });
      const n = mode === "all" ? items.length : sel.size; $("pbs-go").disabled = !n; $("pbs-go").textContent = mode === "all" ? "التقاط " + items.length + " عنصراً" : "التقاط";
      $("pbs-msg").textContent = items.length ? (mode === "all" ? "سيُلتقط كل العناصر المحاطة (" + items.length + ") ويبقى الخلفية." : sel.size ? "عنصر محدّد." : "") : "لم أجد عناصر قابلة للفصل في هذه الصورة (الخلفية قد تكون معقدة).";
    }
    const at = e => { const r = ov.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = -1, ba = 1e18; items.forEach(it => { const lx = Math.round(x - it.dx), ly = Math.round(y - it.dy); if (lx >= 0 && ly >= 0 && lx < it.dw && ly < it.dh && it.a[ly * it.dw + lx] && it.area < ba) { ba = it.area; best = it.id; } }); return best; };
    ov.onmousemove = e => { const h = at(e); if (h !== hov) { hov = h; paint(); } };
    ov.onclick = e => { if (sh.S.mode !== "one") return; const h = at(e); if (h < 0) return; sel = new Set([h]); paint(); };
    bindSeg(sh, () => { sel = new Set(); paint(); }); paint();
    $("pbs-go").onclick = async () => {
      const chosen = sh.S.mode === "all" ? items.slice() : items.filter(it => sel.has(it.id)); if (!chosen.length) return; $("pbs-go").disabled = true;
      try {
        $("pbs-msg").textContent = "⏳ فصل العناصر عن الخلفية…"; await new Promise(r => setTimeout(r, 30));
        const base = document.createElement("canvas"); base.width = W; base.height = H; base.getContext("2d", { willReadFrequently: true }).drawImage(cv, 0, 0); ImageTools.eraseElements(base, sc.F, chosen);
        $("pbs-msg").textContent = "⏳ رفع الصور…"; const stamp = Date.now().toString(36);
        const basePath = await A().uploadBlob(await new Promise(r => base.toBlob(r, "image/png")), "bg-" + stamp, { max: 3200, q: .95 }), paths = [];
        for (let i = 0; i < chosen.length; i++) paths.push(await A().uploadBlob(await new Promise(r => chosen[i].cut.canvas.toBlob(r, "image/png")), "el-" + stamp + "-" + i, { max: 2400, q: .92 }));
        const n = applyElements(inf, w, W, H, chosen, paths, basePath); sh.close(); alert("✅ التُقط " + n + " عنصراً كصور مستقلة قابلة للتحريك، وبقيت الخلفية.");
      } catch (e) { console.error(e); $("pbs-msg").textContent = "⚠️ " + e.message; $("pbs-go").disabled = false; }
    };
  }
  /* العناصر الملتقطة: ودجتات صور حرة بنفس الموضع فوق الصورة الأصلية (الممسوحة منها العناصر) وتحت بقية العناصر */
  function applyElements(inf, w, W, H, chosen, paths, basePath) {
    const sec = inf.sec, s = w.set, eff = PB.eff, num = PB.num, DW = sec.set.scaled ? (num(sec.set.dw) || 1140) : (num(eff(sec.set, "cw", "d")) || 720);
    const fx = Number(eff(s, "fx", "d")) || 0, fy = Number(eff(s, "fy", "d")) || 0, fwd = Number(eff(s, "fwd", "d")) || 100, fh = Number(eff(s, "fh", "d")) || H * (DW * fwd / 100) / W, ky = fh / H, bz = Number(s.zi) || 0, n = chosen.length;
    (sec.free || []).forEach(q => { if (q !== w && (Number(q.set.zi) || 0) > bz) q.set.zi = (Number(q.set.zi) || 0) + n; });          // نفتح مكاناً فوق الأساس مباشرة
    chosen.slice().sort((p, q) => q.area - p.area).forEach((it, i) => {
      const idx = chosen.indexOf(it), im = PB.mkFree("image", 0, 0, bz + 1 + i);
      Object.assign(im.set, { src: paths[idx], fit: "fill", fx: { d: Math.round((fx + it.x0 / W * fwd) * 10) / 10 }, fy: { d: Math.round(fy + it.y0 * ky) }, fwd: { d: Math.round((it.x1 - it.x0) / W * fwd * 10) / 10 }, fh: { d: Math.max(10, Math.round((it.y1 - it.y0) * ky)) } });
      (sec.free = sec.free || []).push(im);
    });
    s.src = basePath; A().E.sel = w.id; A().renderCanvas(); A().commitAfter(w.id); return n;
  }
  /* تحويل النصوص الملتقطة إلى ودجتات حرة فوق الصورة بنفس الأبعاد، واستبدال الصورة بنسخة ممسوحة */
  function apply(inf, w, W, H, items, path) {
    const sec = inf.sec, s = w.set, eff = PB.eff, num = PB.num, DW = sec.set.scaled ? (num(sec.set.dw) || 1140) : (num(eff(sec.set, "cw", "d")) || 720);
    const fx = Number(eff(s, "fx", "d")) || 0, fy = Number(eff(s, "fy", "d")) || 0, fwd = Number(eff(s, "fwd", "d")) || 100, fh = Number(eff(s, "fh", "d")) || H * (DW * fwd / 100) / W;
    const kx = (fwd / 100 * DW) / W, ky = fh / H, z0 = Math.max(0, ...(sec.free || []).map(q => Number(q.set.zi) || 0));
    const paras = TextCapture.paragraphs(items, W); let made = 0;
    paras.forEach((g, i) => {
      const L = g.lines, C = l => l.core || l, x0 = Math.min(...L.map(l => l.x0)), x1 = Math.max(...L.map(l => l.x1)), y0 = Math.min(...L.map(l => l.y0)), y1 = Math.max(...L.map(l => l.y1)), text = L.map(l => l.text || "نص");
      const rtl = ARABIC.test(text.join(" ")), lh = L.reduce((a, l) => a + (C(l).y1 - C(l).y0), 0) / L.length, fsImg = lh / (rtl ? FSK.ar : FSK.lat), padX = W * .03, cxm = (x0 + x1) / 2, centered = Math.abs(cxm - W / 2) < W * .1, align = centered ? "center" : (cxm > W / 2 ? "start" : "end");
      const n = text.length, type = n === 1 ? "heading" : "text", wd = PB.mkW(type, type === "heading" ? { text: text[0], tag: "div" } : { html: "<p>" + text.map(esc).join("<br>") + "</p>" });
      const xa = Math.max(0, x0 - padX), xb = Math.min(W, x1 + padX), pitch = n > 1 ? (C(L[n - 1]).y0 - C(L[0]).y0) / (n - 1) : fsImg * 1.3;
      Object.assign(wd.set, { color: L[0].ink, fs: { d: Math.max(8, Math.round(fsImg * ky)) }, fw: fsImg > 36 ? "800" : "700", lh: { d: Math.max(1, Math.min(2, Math.round(pitch / fsImg * 100) / 100)) }, ta: { d: align }, fx: { d: Math.round((fx + xa / W * fwd) * 10) / 10 }, fy: { d: Math.round(fy + y0 * ky) }, fwd: { d: Math.round((xb - xa) / W * fwd * 10) / 10 }, fh: { d: Math.max(10, Math.round((y1 - y0) * ky)) }, zi: z0 + 1 + i });
      (sec.free = sec.free || []).push(wd); made++;
    });
    s.src = path; A().E.sel = w.id; A().renderCanvas(); A().commitAfter(w.id); return made;
  }
  return { pane, capture, captureElements };
})();
