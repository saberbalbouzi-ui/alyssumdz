/* ═══ أدوات ذكية في منشئ الصفحات: «التقاط النص» (مثل Canva) ═══
   تفحص الصورة المحدّدة، تحيط النصوص المكتشفة بمستطيلات ملوّنة، وتعرض نافذة بخيارين: «عنصر» (نص واحد تنقر عليه) أو «كل النصوص».
   عند «التقاط» تُقرأ النصوص (Gemini إن وُجد مفتاحه وإلا Tesseract)، تُمسح من الصورة بدقة مع إعادة رسم الخلفية، وتصير عناصر نص قابلة للتعديل فوق الصورة.
   تعمل على صورة داخل قسم «كانفاس» (الصفحات المولَّدة). تعتمد على assets/js/text-capture.js و image-tools.js. */
const PBSmart = (function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const FSK = { ar: 1.15, lat: .74 }, ARABIC = /[؀-ۿ]/;
  const A = () => PBApp;
  function pane() {
    const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const tool = (d, label, tip, fn, extra) => `<button type="button" class="pbx-it" title="${tip}" onclick="PBSmart.${fn}()"${extra || ""}>${svg(d)}<span>${label}</span></button>`;
    return `<div class="pbx-f"><div class="pbx-it-row">
${tool('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>', "رفع صورة", "رفع صورة أو عدة صور من الجهاز، كل صورة في قسم كانفاس جاهز", "importImages")}
${tool('<path d="M4 7V5h16v2M12 5v14M9 19h6"/><path d="M3 21h18" stroke-dasharray="2 3"/>', "التقاط النص", "يفصل النصوص عن الصورة ويحوّلها نصوصاً قابلة للتعديل — حدّد صورة أولاً", "capture")}
${tool('<path d="M4 20L16 8"/><path d="M14 4l.9 2.1L17 7l-2.1.9L14 10l-.9-2.1L11 7l2.1-.9z"/><path d="M19 12l.6 1.4L21 14l-1.4.6L19 16l-.6-1.4L17 14l1.4-.6z"/>', "التقاط العناصر", "الالتقاط السحري: يقصّ الأشخاص والمنتجات كصور شفافة — حدّد صورة أولاً", "captureElements", ' onmouseenter="PBSmart.warm()"')}
</div>
<div style="font-size:.72rem;color:#6b6556;line-height:1.7;margin:.55rem 0">حدّد صورة في الصفحة (حتى في قسم عادي — تُنسخ تلقائياً إلى قسم كانفاس) ثم اضغط أداة الالتقاط.</div>
${(typeof PBGen !== "undefined" && PBGen.aiOn && PBGen.aiOn()) ? `<label style="display:flex;gap:.4rem;align-items:flex-start;font-size:.72rem;color:#6b6556;line-height:1.6;cursor:pointer"><input type="checkbox" ${gemOn() ? "checked" : ""} onchange="PBSmart.setGem(this.checked)"> <span>اختياري: الاستعانة بمفتاح Gemini لأسماء أدق. بدونه تعمل الأدوات كاملة داخل متصفحك مجاناً.</span></label>` : `<div style="font-size:.72rem;color:#6b6556;line-height:1.6">🔒 Gemini (API) معطّل — تعمل الأدوات كاملة داخل متصفحك بلا API.</div>`}
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
  /* صورة خارج قسم الكانفاس ← تُنسخ إلى قسم كانفاس جديد تحتها (الأصل يبقى كما هو) لتعمل عليها أدوات الالتقاط */
  function toCanvas(inf) {
    const E = A().E, DW = 1100, fd = (document.getElementById("pbx-frame") || {}).contentDocument, im = fd && fd.querySelector(`[data-pb="${inf.node.id}"] img`);
    const nw = (im && im.naturalWidth) || 1100, nh = (im && im.naturalHeight) || 1100, h = Math.round(nh * DW / nw);
    const bg = PB.mkFree("image", 0, 0, 0); Object.assign(bg.set, { src: inf.node.set.src, alt: inf.node.set.alt || "", fit: "fill", fx: { d: 0 }, fy: { d: 0 }, fwd: { d: 100 }, fh: { d: h }, zi: 0 });
    const sec = PB.mkCanvas(); Object.assign(sec.set, { scaled: true, dw: DW, layout: "boxed", cw: { d: DW }, mh: { d: h } }); sec.free = [bg];
    const i = E.page.sections.findIndex(x => x.id === inf.sec.id); E.page.sections.splice(i < 0 ? E.page.sections.length : i + 1, 0, sec);
    E.sel = bg.id; A().renderCanvas(); A().commitAfter(bg.id); return A().find(bg.id);
  }
  function target() {
    let inf = A().E && A().E.sel ? A().find(A().E.sel) : null;
    if (!inf || inf.kind !== "widget" || inf.node.type !== "image" || !inf.node.set.src) return { err: "حدّد صورة (انقر عليها) ثم اضغط الأداة من إعداداتها." };
    if (!inf.free || inf.sec.set.kind !== "canvas") inf = toCanvas(inf);      // تحويل تلقائي إلى قسم كانفاس
    return { inf };
  }
  /* هيكل النافذة المشترك (يشبه لوحة Canva): صورة ملوّنة الإطارات + لوحة خيارات «عنصر / الكل» + زر التقاط */
  function shell(title, oneLabel, allLabel, hintOne, hintAll) {
    const host = document.createElement("div"); host.id = "pbs-modal";
    host.style.cssText = "position:fixed;inset:0;z-index:10050;background:rgba(15,15,20,.72);display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:inherit";
    host.innerHTML = `<div style="background:#fff;border-radius:16px;display:flex;gap:0;max-width:1100px;width:100%;max-height:94vh;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)">
  <div id="pbs-view" style="flex:1;min-width:0;background:repeating-conic-gradient(#3a3a42 0% 25%,#33333a 0% 50%) 50%/20px 20px;overflow:auto;position:relative"><div id="pbs-stage" style="position:relative;margin:0 auto;width:fit-content"></div><div id="pbs-load" style="position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;align-items:center;gap:.4rem;color:#fff;font-weight:800;font-size:.85rem;background:rgba(15,23,25,.78);padding:.45rem 1rem;border-radius:999px;white-space:nowrap;z-index:3;box-shadow:0 4px 18px rgba(0,0,0,.35)">⏳ جارِ مسح الصورة…</div></div>
  <div style="width:320px;flex:0 0 320px;padding:1.1rem;display:flex;flex-direction:column;gap:.9rem;overflow:auto">
    <div style="display:flex;align-items:center;gap:.6rem"><button id="pbs-back" title="رجوع" style="border:0;background:none;font-size:1.3rem;cursor:pointer">→</button><b style="font-size:1.05rem;flex:1">${title}</b><button id="pbs-x" title="إغلاق" style="border:0;background:none;font-size:1.4rem;cursor:pointer">✕</button></div>
    <div style="font-weight:800;line-height:1.6">حدّد ما تريد التقاطه.</div>
    <div id="pbs-seg" style="display:flex;background:#f3f2f6;border-radius:12px;padding:4px"><button data-m="one" style="flex:1;border:0;border-radius:9px;padding:.55rem;cursor:pointer;font-weight:700;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.15)">✨ ${oneLabel}</button><button data-m="all" style="flex:1;border:0;border-radius:9px;padding:.55rem;cursor:pointer;font-weight:700;background:transparent">${allLabel}</button></div>
    <div id="pbs-hint" style="font-size:.8rem;color:#6b6556;line-height:1.7">${hintOne}</div>
    <div id="pbs-extra" style="display:flex;flex-direction:column;gap:.5rem"></div>
    <button id="pbs-go" disabled style="border:0;border-radius:12px;padding:.8rem;font-weight:800;font-size:1rem;cursor:pointer;background:#0d9488;color:#fff">التقاط</button>
    <div id="pbs-msg" style="font-size:.78rem;line-height:1.7;color:#173f35;min-height:3em"></div>
    <div style="font-size:.74rem;color:#8a8472;border-top:1px solid #eee;padding-top:.6rem">تعمل الأداة داخل متصفحك. الصورة الأصلية لا تتغير إلا عند «التقاط».<div id="pbs-ver" style="margin-top:.35rem;font-size:.68rem;color:#a8a294;direction:rtl"></div></div>
  </div></div>`;
    document.body.appendChild(host); const $ = id => host.querySelector("#" + id), S = { mode: "one", closed: false, hintOne, hintAll };
    const close = () => { S.closed = true; host.remove(); }; $("pbs-x").onclick = $("pbs-back").onclick = close;
    return { host, $, S, close };
  }
  function bindSeg(sh, repaint) { sh.host.querySelectorAll("#pbs-seg button").forEach(b => b.onclick = () => { sh.S.mode = b.dataset.m; sh.S.onMode && sh.S.onMode(); sh.host.querySelectorAll("#pbs-seg button").forEach(x => { const on = x === b; x.style.background = on ? "#fff" : "transparent"; x.style.boxShadow = on ? "0 1px 4px rgba(0,0,0,.15)" : "none"; }); sh.$("pbs-hint").textContent = sh.S.mode === "all" ? sh.S.hintAll : sh.S.hintOne; repaint(); }); }
  /* أثناء التحليل: الصورة ظاهرة وخط مضيء يمسحها ذهاباً وإياباً حتى ينتهي المسح ← يعيد دالة الإيقاف */
  function scanFx(sh, cv) {
    if (!document.getElementById("pbs-scan-css2")) { const st = document.createElement("style"); st.id = "pbs-scan-css2"; st.textContent = "@keyframes pbsScan{0%{top:0}100%{top:calc(100% - 4px)}}@keyframes pbsGlow{0%,100%{opacity:.5}50%{opacity:1}}#pbs-glow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,rgba(70,150,255,.16),rgba(30,90,255,.34));box-shadow:inset 0 0 80px 22px rgba(60,140,255,.6);animation:pbsGlow 1.5s ease-in-out infinite;mix-blend-mode:screen}#pbs-scanline{position:absolute;left:0;right:0;height:4px;background:linear-gradient(90deg,transparent,#3b82f6 12%,#e0f2fe 50%,#3b82f6 88%,transparent);box-shadow:0 0 18px 6px rgba(59,130,246,.65),0 0 70px 22px rgba(37,99,235,.35);animation:pbsScan 1.7s ease-in-out infinite alternate;pointer-events:none}#pbs-scanline:before,#pbs-scanline:after{content:'';position:absolute;left:0;right:0;height:110px;pointer-events:none}#pbs-scanline:before{bottom:4px;background:linear-gradient(to top,rgba(59,130,246,.38),transparent)}#pbs-scanline:after{top:4px;background:linear-gradient(to bottom,rgba(59,130,246,.38),transparent)}"; document.head.appendChild(st); }
    const stage = sh.$("pbs-stage"); stage.innerHTML = ""; const { vw, vh } = viewSize(sh, cv.width, cv.height), img = document.createElement("canvas"); img.width = vw; img.height = vh; img.getContext("2d").drawImage(cv, 0, 0, vw, vh); img.style.cssText = "display:block;background:#fff;filter:saturate(.85)"; stage.appendChild(img);
    const gl = document.createElement("div"); gl.id = "pbs-glow"; stage.appendChild(gl); const ln = document.createElement("div"); ln.id = "pbs-scanline"; stage.appendChild(ln); sh.$("pbs-load").style.display = "flex"; sh.$("pbs-go").disabled = true; sh.$("pbs-go").textContent = "⏳ جارِ المسح…";
    return () => { stage.innerHTML = ""; };
  }
  function viewSize(sh, W, H) { const view = sh.$("pbs-view"), vw = Math.max(260, Math.min(W, view.clientWidth - 24)), k = vw / W; return { vw, vh: Math.round(H * k), k }; }

  /* ═══ التقاط النص ═══ */
  async function capture() {
    const t = target(); if (t.err) return alert(t.err);
    const inf = t.inf, w = inf.node, sh = shell("التقاط النص", "عنصر", "كل النصوص", "انقر على أحد المستطيلات الملوّنة لاختيار نص واحد. فاتك نص؟ ارسم مستطيلاً حوله بالسحب.", "ستُلتقط كل النصوص المكتشفة دفعة واحدة."), $ = sh.$;
    let cv; try { cv = await loadCanvas(w.set.src); } catch (e) { $("pbs-load").textContent = "⚠️ " + e.message; return; }
    const W = cv.width, H = cv.height, stopScan = scanFx(sh, cv); await new Promise(r => setTimeout(r, 40));
    /* مسح الصورة: كشف بالصورة (+ قراءة إن وُجد مفتاح Gemini ليكون الكشف أدق وتُستبعد الصناديق غير النصية) */
    let sc; try { sc = await TextCapture.scan(cv, { ocr: !!TextCapture.ocr.key() }); } catch (e) { $("pbs-load").textContent = "⚠️ " + e.message; return; }
    if (sh.S.closed) return; stopScan(); $("pbs-load").style.display = "none"; const items = sc.items; items.forEach((b, i) => b.i = i);
    const stage = $("pbs-stage"), { vw, vh, k } = viewSize(sh, W, H);
    const img = document.createElement("canvas"); img.width = vw; img.height = vh; img.getContext("2d").drawImage(cv, 0, 0, vw, vh); img.style.cssText = "display:block;background:#fff"; stage.appendChild(img);
    const ov = document.createElement("canvas"); ov.width = vw; ov.height = vh; ov.style.cssText = "position:absolute;left:0;top:0;cursor:pointer"; stage.appendChild(ov);
    let sel = new Set(), hov = -1;
    const R = b => { const c = b.core || b; return { x: Math.max(0, c.x0 - 3) * k, y: Math.max(0, c.y0 - 3) * k, w: (c.x1 - c.x0 + 6) * k, h: (c.y1 - c.y0 + 6) * k }; };
    function paint() {
      const g = ov.getContext("2d"), mode = sh.S.mode; g.clearRect(0, 0, vw, vh);
      items.forEach(b => { const r = R(b), on = mode === "all" || sel.has(b.i); g.lineWidth = on || hov === b.i ? 3 : 2; g.strokeStyle = "#0d9488"; if (on) { g.fillStyle = "rgba(13,148,136,.22)"; g.fillRect(r.x, r.y, r.w, r.h); } else if (hov === b.i) { g.fillStyle = "rgba(13,148,136,.1)"; g.fillRect(r.x, r.y, r.w, r.h); } g.setLineDash(on ? [] : [6, 3]); g.strokeRect(r.x, r.y, r.w, r.h); });
      const n = mode === "all" ? items.length : sel.size; $("pbs-go").disabled = !n; $("pbs-go").textContent = mode === "all" ? "التقاط " + items.length + " نصاً" : "التقاط";
      $("pbs-msg").textContent = items.length ? (mode === "all" ? "سيُلتقط كل النصوص المحيطة بمستطيلات ملوّنة (" + items.length + ")." : sel.size ? "نص محدّد." : "") : "لم أجد نصوصاً في هذه الصورة.";
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

  /* ═══ التقاط العناصر (مثل «الالتقاط السحري» في Canva) ═══
     الذكاء داخل المتصفح (assets/js/ai-vision.js): كشف العناصر بأسمائها (امرأة، طفل، عبوة، صحن، ملعقة، قلم، إبريق، كتب…) وحدود دقيقة بالبكسل،
     واختيار عنصر أو أكثر أو الكل، وإضافة ما فات الكشف بنقرة أو مستطيل. إن تعذّر تحميل النموذج نعود إلى الكشف البسيط بالحواف. */
  const HINT_EL1 = "انقر على عنصر محاط بخط ملوّن لاختياره (وانقر على غيره لإضافته). فاتك عنصر؟ انقر عليه مباشرة أو ارسم مستطيلاً حوله.", HINT_EL2 = "ستُلتقط كل العناصر المكتشفة دفعة واحدة وتبقى الخلفية.";
  const GEMK = "alyssum_pbs_gem", gemOn = () => { try { return localStorage.getItem(GEMK) === "1"; } catch (e) { return false; } };      // Gemini اختياري ومُطفأ افتراضياً: الأداة تعمل كاملة بلا مفتاح
  function setGem(on) { try { localStorage.setItem(GEMK, on ? "1" : "0"); } catch (e) { } }
  function warm() { try { if (window.AIVision && AIVision.supported() && !warm.done) { warm.done = true; AIVision.warm(); } } catch (e) { } }
  async function captureElements() {
    const t = target(); if (t.err) return alert(t.err);
    const inf = t.inf, w = inf.node, sh = shell("التقاط العناصر", "عنصر", "كل العناصر", HINT_EL1, HINT_EL2), $ = sh.$;
    let cv; try { cv = await loadCanvas(w.set.src); } catch (e) { $("pbs-load").textContent = "⚠️ " + e.message; return; }
    await new Promise(r => setTimeout(r, 40)); let Z = null;
    if (window.AIVision && AIVision.supported()) {                     // «منطقة» قبل التحليل: مستطيل حول العنصر ← تحليل ذلك الجزء وحده بدقة أعلى
      var z = await pickZone(sh, cv); if (sh.S.closed) return;
      if (z) { const c = document.createElement("canvas"); c.width = z[2] - z[0]; c.height = z[3] - z[1]; c.getContext("2d", { willReadFrequently: true }).drawImage(cv, z[0], z[1], c.width, c.height, 0, 0, c.width, c.height); Z = { full: cv, ox: z[0], oy: z[1] }; cv = c; }
    }
    const stopScan = scanFx(sh, cv);
    let res = null, note = !window.AIVision ? "نسخة قديمة من لوحة التحكم محمّلة — اضغط Ctrl+Shift+R لتحديثها" : !AIVision.supported() ? "متصفحك لا يدعم تشغيل النماذج (Web Worker) — جرّب Chrome على الحاسوب" : "";
    if (window.AIVision && AIVision.supported()) {
      const key = gemOn() ? TextCapture.ocr.key() : "";
      try { res = await AIVision.analyze(cv, { key, zone: Z ? { margin: .053 } : null, onStep: m => { if (!sh.S.closed) $("pbs-load").textContent = m; } }); } catch (e) { console.warn("AIVision", e); note = (e && e.message) || String(e) || "خطأ غير معروف"; }
      if (sh.S.closed) return; if (res) { stopScan(); return elementsAI(sh, cv, inf, w, res, key, Z); }
    }
    stopScan(); return elementsBasic(sh, cv, inf, w, note);
  }
  /* الخطوة الأولى: الصورة كاملة + «حلّل الصورة كاملة» أو ارسم مستطيلاً حول العنصر (منطقة) ← [x0,y0,x1,y1] أو null */
  function pickZone(sh, cv) {
    const $ = sh.$, W = cv.width, H = cv.height; $("pbs-load").style.display = "none"; $("pbs-seg").style.display = "none";
    $("pbs-hint").innerHTML = "<b>✏️ منطقة (أدق):</b> ارسم بالسحب مستطيلاً حول العنصر الذي تريد التقاطه، فتُحلَّل تلك المنطقة وحدها بدقة أعلى.<br>أو حلّل الصورة كاملة.";
    $("pbs-go").disabled = false; $("pbs-go").textContent = "تحليل الصورة كاملة";
    const stage = $("pbs-stage"), { vw, vh, k } = viewSize(sh, W, H), img = document.createElement("canvas"); img.width = vw; img.height = vh; img.getContext("2d").drawImage(cv, 0, 0, vw, vh); img.style.cssText = "display:block;background:#fff"; stage.appendChild(img);
    const ov = document.createElement("canvas"); ov.width = vw; ov.height = vh; ov.style.cssText = "position:absolute;left:0;top:0;cursor:crosshair"; stage.appendChild(ov);
    return new Promise(res => {
      let d = null; const pos = e => { const r = ov.getBoundingClientRect(); return [Math.max(0, Math.min(vw, e.clientX - r.left)), Math.max(0, Math.min(vh, e.clientY - r.top))]; };
      const draw = (a, b) => { const g = ov.getContext("2d"); g.clearRect(0, 0, vw, vh); if (!a) return; const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]), w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]); g.fillStyle = "rgba(15,15,20,.45)"; g.fillRect(0, 0, vw, vh); g.clearRect(x, y, w, h); g.setLineDash([6, 4]); g.strokeStyle = "#0d9488"; g.lineWidth = 2.5; g.strokeRect(x, y, w, h); };
      const done = z => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); stage.innerHTML = ""; $("pbs-seg").style.display = "flex"; $("pbs-hint").textContent = sh.S.hintOne; $("pbs-go").onclick = null; res(z); };
      ov.onmousedown = e => { d = { a: pos(e) }; };
      const mm = e => { if (!d) return; d.b = pos(e); draw(d.a, d.b); };
      const mu = () => { if (!d) return; const a = d.a, b = d.b || a; d = null; if (Math.abs(b[0] - a[0]) < 12 || Math.abs(b[1] - a[1]) < 12) return draw(null);
        const x0 = Math.min(a[0], b[0]) / k, y0 = Math.min(a[1], b[1]) / k, x1 = Math.max(a[0], b[0]) / k, y1 = Math.max(a[1], b[1]) / k, m = Math.max(x1 - x0, y1 - y0) * .06;      // هامش صغير حول العنصر
        done([Math.max(0, Math.floor(x0 - m)), Math.max(0, Math.floor(y0 - m)), Math.min(W, Math.ceil(x1 + m)), Math.min(H, Math.ceil(y1 + m))]); };
      window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu);
      $("pbs-go").onclick = () => done(null); const c0 = sh.close; sh.close = () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); c0(); res(null); };
    });
  }
  /* الواجهة الذكية: حدود ملوّنة تتبع العنصر + اسمه، قائمة العناصر، نقرة/مستطيل لإضافة عنصر، دمج، وملء الخلفية */
  function elementsAI(sh, cv, inf, w, res, key, Z) {
    const $ = sh.$, W = cv.width, H = cv.height, S = res.S, items = res.items; $("pbs-load").style.display = "none";
    $("pbs-ver").textContent = "تشخيص v3 · " + W + "×" + H + " · " + (S.dev === "webgpu" ? "⚡ كرت الشاشة" : "المعالج") + " · كشف: " + (res.src === "gemini" ? "Gemini+محلي" : "محلي") + " · مرشّحات: " + (res.dets || []).map(d => d.label + " " + Math.round(d.score * 100)).join("، ");
    const stage = $("pbs-stage"), { vw, vh, k } = viewSize(sh, W, H);
    const img = document.createElement("canvas"); img.width = vw; img.height = vh; img.getContext("2d").drawImage(cv, 0, 0, vw, vh); img.style.cssText = "display:block;background:#fff"; stage.appendChild(img);
    const ov = document.createElement("canvas"); ov.width = vw; ov.height = vh; ov.style.cssText = "position:absolute;left:0;top:0;cursor:pointer"; stage.appendChild(ov);
    const prep = it => { it.v = (Z || it.sil) && AIVision.fineView ? AIVision.fineView(S, cv, it, k, items) : AIVision.viewMask(S, it, k);      // المنطقة والأشياء في اليد: حدود بالدقة الكاملة
      const o = AIVision.overlays(it.v, [13, 148, 136]); it.out = o.out; it.fill = o.fill; };
    items.forEach(prep);
    let sel = new Set(), hov = -1, busy = false; const AIF = "alyssum_pbs_aifill"; if (Z) items.forEach(i => { if (i.zoneMain) sel.add(i.id); });      // العنصر داخل المنطقة محدَّد مسبقاً
    const names = () => { const c = {}, n = {}; items.forEach(it => c[it.label] = (c[it.label] || 0) + 1); const out = {}; items.slice().sort((a, b) => a.v.cx - b.v.cx).forEach(it => { n[it.label] = (n[it.label] || 0) + 1; out[it.id] = c[it.label] > 1 ? it.label + " " + n[it.label] : it.label; }); return out; };
    const ex = $("pbs-extra"); let aiFill = false; try { aiFill = !!key && localStorage.getItem(AIF) !== "0"; } catch (e) { aiFill = !!key; }
    ex.innerHTML = `<div id="pbs-list" style="display:flex;flex-wrap:wrap;gap:.35rem"></div><button id="pbs-merge" type="button" style="display:none;border:1.5px solid #0d9488;background:#fff;color:#0d9488;border-radius:10px;padding:.4rem;font-weight:700;cursor:pointer;font-family:inherit">🔗 دمج المحدّد في عنصر واحد</button>` +
      (key ? `<label style="font-size:.78rem;display:flex;gap:.4rem;align-items:flex-start;line-height:1.6;cursor:pointer"><input type="checkbox" id="pbs-aifill" ${aiFill ? "checked" : ""}> <span>إعادة رسم الخلفية بـ Gemini بدل النموذج المحلي (يستهلك طلب صورة).</span></label>` : `<div style="font-size:.74rem;color:#8a8472;line-height:1.6">🪄 مكان العناصر في الخلفية يُعاد رسمه بنموذج ذكي داخل متصفحك (بلا مفتاح).</div>`);
    if ($("pbs-aifill")) $("pbs-aifill").onchange = e => { aiFill = e.target.checked; try { localStorage.setItem(AIF, aiFill ? "1" : "0"); } catch (er) { } };
    function list() {
      const nm = names(), on = it => sh.S.mode === "all" || sel.has(it.id);
      const html = items.map(it => `<button type="button" data-id="${it.id}" style="border:1.5px solid #0d9488;border-radius:999px;padding:.22rem .6rem;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit;background:${on(it) ? "#0d9488" : "#fff"};color:${on(it) ? "#fff" : "#0d9488"}">${on(it) ? "✓ " : ""}${esc(nm[it.id])}</button>`).join("");
      $("pbs-merge").style.display = sh.S.mode !== "all" && sel.size > 1 ? "block" : "none"; if (html === list.last) return; list.last = html; $("pbs-list").innerHTML = html;      // لا نعيد البناء عند مجرد التمرير
      $("pbs-list").querySelectorAll("button").forEach(b => { b.onclick = () => { const id = +b.dataset.id; if (sh.S.mode === "all") setMode("one"); sel.has(id) ? sel.delete(id) : sel.add(id); paint(); }; b.onmouseenter = () => { hov = +b.dataset.id; paint(); }; b.onmouseleave = () => { hov = -1; paint(); }; });
    }
    function paint() {
      const g = ov.getContext("2d"), mode = sh.S.mode, nm = names(); g.clearRect(0, 0, vw, vh);
      items.forEach(it => { const on = mode === "all" || sel.has(it.id); if (on) g.drawImage(it.fill, it.v.dx, it.v.dy); else if (hov === it.id) { g.globalAlpha = .5; g.drawImage(it.fill, it.v.dx, it.v.dy); g.globalAlpha = 1; } g.drawImage(it.out, it.v.dx, it.v.dy); if (on || hov === it.id) g.drawImage(it.out, it.v.dx, it.v.dy); });
      g.font = "bold 12px Cairo, Tahoma, sans-serif"; g.textBaseline = "middle"; g.textAlign = "center"; g.direction = "rtl"; const boxes = [];
      items.forEach(it => { const on = mode === "all" || sel.has(it.id), t = nm[it.id], tw = g.measureText(t).width + 12, th = 20; let x = Math.max(2, Math.min(vw - tw - 2, it.v.lx - tw / 2)), y = Math.max(2, it.v.ly - th - 4);
        for (let n = 0; n < 8 && boxes.some(b => x < b[0] + b[2] && x + tw > b[0] && y < b[1] + b[3] && y + th > b[1]); n++) y += th + 2; boxes.push([x, y, tw, th]);
        g.fillStyle = on || hov === it.id ? "#0d9488" : "rgba(255,255,255,.92)"; g.beginPath(); if (g.roundRect) g.roundRect(x, y, tw, th, 10); else g.rect(x, y, tw, th); g.fill(); g.strokeStyle = "#0d9488"; g.lineWidth = 1; g.stroke(); g.fillStyle = on || hov === it.id ? "#fff" : "#115e59"; g.fillText(t, x + tw / 2, y + th / 2 + 1); });
      const n = mode === "all" ? items.length : sel.size; $("pbs-go").disabled = !n || busy; $("pbs-go").textContent = mode === "all" ? "التقاط " + items.length + " عنصراً" : n > 1 ? "التقاط " + n + " عناصر" : "التقاط";
      if (!busy) $("pbs-msg").textContent = items.length ? (mode === "all" ? "سيُلتقط كل العناصر (" + items.length + ") وتبقى الخلفية." : sel.size ? "محدّد: " + [...sel].map(id => nm[id]).join("، ") : "") : "لم أجد عناصر — انقر على أي عنصر في الصورة أو ارسم مستطيلاً حوله لإضافته.";
      list();
    }
    const setMode = m => { const b = sh.host.querySelector('#pbs-seg button[data-m="' + m + '"]'); if (b) b.click(); };
    const pos = e => { const r = ov.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const at = (x, y) => { let best = -1, ba = 1e18; items.forEach(it => { const lx = Math.round(x - it.v.dx), ly = Math.round(y - it.v.dy); if (lx >= 0 && ly >= 0 && lx < it.v.dw && ly < it.v.dh && it.v.a[ly * it.v.dw + lx] && it.area < ba) { ba = it.area; best = it.id; } }); return best; };
    async function add(p, msg) {
      if (busy) return; busy = true; $("pbs-msg").textContent = "⏳ " + msg; paint();
      try { const it = await AIVision.addItem(S, p, items, p.pre); busy = false; if (!it) { $("pbs-msg").textContent = "لم أجد عنصراً هنا — جرّب النقر في وسطه أو رسم مستطيل حوله."; return paint(); } prep(it); if (sh.S.mode === "one") sel.add(it.id); hov = -1; paint(); $("pbs-msg").textContent = "✅ أُضيف «" + names()[it.id] + "»."; }
      catch (e) { busy = false; $("pbs-msg").textContent = "⚠️ " + e.message; paint(); }
    }
    let drag = null; const zone = () => false;
    ov.onmousemove = e => { if (drag) return; const [x, y] = pos(e), h = at(x, y); if (h !== hov) { hov = h; paint(); } };
    ov.onmouseleave = () => { if (hov !== -1) { hov = -1; paint(); } };
    ov.onmousedown = e => { const [x, y] = pos(e); drag = { x, y, moved: false, pts: [[x, y]] }; };
    const mm = ev => { if (!drag || sh.S.closed) return; const [x, y] = pos(ev); if (Math.abs(x - drag.x) + Math.abs(y - drag.y) > 8) drag.moved = true;
      if (zone()) { const l = drag.pts[drag.pts.length - 1]; if (Math.abs(l[0] - x) + Math.abs(l[1] - y) > 2) drag.pts.push([x, y]); if (drag.moved) { paint(); const g = ov.getContext("2d"); g.beginPath(); drag.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = "rgba(13,148,136,.25)"; g.fill(); g.setLineDash([5, 3]); g.strokeStyle = "#0d9488"; g.lineWidth = 2; g.stroke(); g.setLineDash([]); } return; }
      if (drag.moved) { paint(); const g = ov.getContext("2d"); g.setLineDash([5, 3]); g.strokeStyle = "#16a34a"; g.lineWidth = 2; g.strokeRect(Math.min(drag.x, x), Math.min(drag.y, y), Math.abs(x - drag.x), Math.abs(y - drag.y)); g.setLineDash([]); } };
    const mu = ev => { if (!drag || sh.S.closed) return; const d = drag, [x, y] = pos(ev); drag = null;
      if (zone() && d.moved) { const it = AIVision.zoneItem(S, d.pts.map(p => [Math.max(0, Math.min(W, p[0] / k)), Math.max(0, Math.min(H, p[1] / k))]), items); if (!it) return paint(); prep(it); sel.add(it.id); paint(); $("pbs-msg").textContent = "✅ حُدّدت منطقة. ارسم أخرى أو اضغط «التقاط»."; return; }
      if (d.moved) { const b = [Math.max(0, Math.min(d.x, x) / k), Math.max(0, Math.min(d.y, y) / k), Math.min(W, Math.max(d.x, x) / k), Math.min(H, Math.max(d.y, y) / k)]; if (b[2] - b[0] < 8 || b[3] - b[1] < 8) return paint(); return add({ box: b }, "تحديد العنصر داخل المستطيل…"); }
      const h = at(x, y); if (h >= 0) { if (sh.S.mode !== "all") { sel.has(h) ? sel.delete(h) : sel.add(h); paint(); } return; }
      if (zone()) return;
      add({ pts: [[x / k, y / k, 1]] }, "تحديد العنصر تحت النقرة…"); };
    window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu); const cl0 = sh.close; sh.close = () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); cl0(); };
    { const zb = document.createElement("button"); zb.type = "button"; zb.textContent = "✏️ منطقة أخرى"; zb.title = "ارسم مستطيلاً حول عنصر آخر لتحليله بدقة أعلى"; zb.style.cssText = "border:1.5px dashed #0d9488;background:#fff;color:#0d9488;border-radius:10px;padding:.4rem;font-weight:700;cursor:pointer;font-family:inherit"; zb.onclick = () => { sh.close(); captureElements(); }; $("pbs-extra").appendChild(zb); }
    const hint0 = sh.S.hintOne; sh.S.onMode = () => { sh.S.hintOne = zone() ? "ارسم بالسحب حدّاً حرّاً حول المنطقة التي تريد التقاطها (مثل «Zone» في Canva)؛ يمكنك رسم أكثر من منطقة." : hint0; ov.style.cursor = zone() ? "crosshair" : "pointer"; };
    $("pbs-x").onclick = $("pbs-back").onclick = () => sh.close(); bindSeg(sh, () => { sel = new Set(); paint(); });
    $("pbs-merge").onclick = () => { const L = items.filter(it => sel.has(it.id)); if (L.length < 2) return; const it = AIVision.joinItems(S, items, L); prep(it); sel = new Set([it.id]); paint(); $("pbs-msg").textContent = "✅ دُمجت العناصر في «" + names()[it.id] + "»."; };
    $("pbs-msg").style.color = "#173f35"; paint();
    if (res.note) $("pbs-msg").textContent = "ℹ️ تعذّر كشف Gemini (" + res.note.slice(0, 90) + ") — استُعمل الكشف المحلي.";
    /* معاينة نتيجة المسح قبل الحفظ: الخلفية المرمَّمة + العناصر المفصولة مرفوعة قليلاً بظل، وزرّا «حفظ» و«إلغاء» */
    function preview(bgCanvas, cuts) {
      return new Promise(res => {
        const kids = [...stage.childNodes]; kids.forEach(n => n.remove()); const c = document.createElement("canvas"); c.width = vw; c.height = vh; c.style.cssText = "display:block;background:#fff"; stage.appendChild(c); const g = c.getContext("2d");
        let t = 0, on = true; const draw = () => { if (!on) return; g.clearRect(0, 0, vw, vh); g.drawImage(bgCanvas, 0, 0, vw, vh); const lift = 6 + 4 * Math.sin(t / 12); t++;
          cuts.slice().sort((a, b) => a.front - b.front).forEach(q => { g.save(); g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 16; g.shadowOffsetY = lift; g.drawImage(q.canvas, q.x0 * k, q.y0 * k - lift, q.w * k, q.h * k); g.restore(); }); requestAnimationFrame(draw); }; draw();
        const bar = document.createElement("div"); bar.style.cssText = "display:flex;gap:.5rem"; bar.innerHTML = '<button type="button" id="pbs-ok" style="flex:1;border:0;border-radius:12px;padding:.75rem;font-weight:800;cursor:pointer;background:#0d9488;color:#fff;font-family:inherit">💾 حفظ</button><button type="button" id="pbs-no" style="flex:1;border:1.5px solid #d6d3cb;border-radius:12px;padding:.75rem;font-weight:800;cursor:pointer;background:#fff;color:#44403c;font-family:inherit">✖ إلغاء</button>';
        $("pbs-go").style.display = "none"; $("pbs-go").after(bar); $("pbs-msg").textContent = "👀 هذه نتيجة المسح: العناصر مفصولة (مرفوعة قليلاً) والخلفية أُعيد رسمها. احفظها أو ألغِها.";
        const end = ok => { on = false; bar.remove(); $("pbs-go").style.display = ""; if (!ok) { stage.innerHTML = ""; kids.forEach(n => stage.appendChild(n)); $("pbs-go").disabled = false; } res(ok); };
        bar.querySelector("#pbs-ok").onclick = () => end(true); bar.querySelector("#pbs-no").onclick = () => end(false);
      });
    }
    $("pbs-go").onclick = async () => {
      const chosen = sh.S.mode === "all" ? items.slice() : items.filter(it => sel.has(it.id)); if (!chosen.length || busy) return; busy = true; $("pbs-go").disabled = true;
      try {
        $("pbs-msg").textContent = "⏳ قصّ العناصر بدقة…"; await new Promise(r => setTimeout(r, 30));
        const nm = names(), cuts = AIVision.cutouts(S, cv, chosen); cuts.forEach(c => c.label = nm[c.item.id] || c.label);
        $("pbs-msg").textContent = aiFill && key ? "⏳ Gemini يعيد رسم الخلفية مكان العناصر…" : "⏳ إعادة رسم الخلفية مكان العناصر…"; await new Promise(r => setTimeout(r, 30));
        const part = document.createElement("canvas"); part.width = W; part.height = H; part.getContext("2d", { willReadFrequently: true }).drawImage(cv, 0, 0); let fillNote = "";
        const gen = aiFill && key && typeof PBGen !== "undefined" && PBGen.gemGenerate ? async parts => PBGen.gemGenerate(key, "image", parts, {}, await PBGen.imageModels(key)) : null;
        const how = await AIVision.eraseBg(part, cuts, { gen, onNote: m => { fillNote = m; }, onStep: m => { $("pbs-msg").textContent = m; } });
        const FW = Z ? Z.full.width : W, FH = Z ? Z.full.height : H, ox = Z ? Z.ox : 0, oy = Z ? Z.oy : 0, base = document.createElement("canvas"); base.width = FW; base.height = FH; const bg = base.getContext("2d"); if (Z) bg.drawImage(Z.full, 0, 0); bg.drawImage(part, ox, oy);      // المنطقة المرمَّمة تعود لمكانها في الصورة الكاملة
        if (!(await preview(part, cuts))) { busy = false; paint(); return; }      // معاينة: حفظ أو إلغاء
        $("pbs-msg").textContent = "⏳ رفع الصور…"; const stamp = Date.now().toString(36);
        const basePath = await A().uploadBlob(await new Promise(r => base.toBlob(r, "image/png")), "bg-" + stamp, { max: 3200, q: .95 }), paths = [];
        for (let i = 0; i < cuts.length; i++) paths.push(await A().uploadBlob(await new Promise(r => cuts[i].canvas.toBlob(r, "image/png")), "el-" + stamp + "-" + i, { max: 2400, q: .92 }));
        const els = cuts.map(c => ({ x0: c.x0 + ox, y0: c.y0 + oy, x1: c.x0 + ox + c.w, y1: c.y0 + oy + c.h, area: c.px, front: c.front, label: c.label }));
        const n = applyElements(inf, w, FW, FH, els, paths, basePath); sh.close();
        alert("✅ التُقط " + n + " عنصراً كصور مستقلة قابلة للتحريك: " + els.map(e => e.label).join("، ") + (how === "ai" ? "\n🪄 أعاد Gemini رسم الخلفية مكانها." : how === "model" ? "\n🪄 أُعيد رسم الخلفية مكانها بالنموذج المحلي." : "\nℹ️ رُمِّمت الخلفية مكانها بترميم بسيط" + (fillNote ? " (" + fillNote.slice(0, 80) + ")" : "") + "."));
      } catch (e) { console.error(e); busy = false; $("pbs-msg").textContent = "⚠️ " + e.message; $("pbs-go").disabled = false; }
    };
  }
  /* الكشف البسيط بالحواف (بلا شبكة): للتصاميم ذات الخلفية الناعمة — يُستعمل إن تعذّر تحميل النموذج الذكي */
  function elementsBasic(sh, cv, inf, w, note) {
    const $ = sh.$, W = cv.width, H = cv.height; $("pbs-ver").textContent = "تشخيص v3 · الطريقة البسيطة (بلا نماذج)";
    $("pbs-hint").textContent = sh.S.hintOne = "انقر على أحد العناصر المحاطة بخط ملوّن لاختياره (منتج، عشبة، مكوّنات…).";
    let sc; try { sc = ImageTools.scanElements(cv); } catch (e) { console.error(e); $("pbs-load").textContent = "⚠️ " + e.message; return; }
    if (sh.S.closed) return; $("pbs-load").style.display = "none"; const items = sc.items;
    const stage = $("pbs-stage"), { vw, vh, k } = viewSize(sh, W, H);
    const img = document.createElement("canvas"); img.width = vw; img.height = vh; img.getContext("2d").drawImage(cv, 0, 0, vw, vh); img.style.cssText = "display:block;background:#fff"; stage.appendChild(img);
    const ov = document.createElement("canvas"); ov.width = vw; ov.height = vh; ov.style.cssText = "position:absolute;left:0;top:0;cursor:pointer"; stage.appendChild(ov);
    /* حدود كل عنصر بدقة البكسل (بدقة العرض): قناع ألفا مصغَّر + خط خارجي ملوّن + تعبئة شفافة عند الاختيار */
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
      if (!note) $("pbs-msg").textContent = items.length ? (mode === "all" ? "سيُلتقط كل العناصر المحاطة (" + items.length + ") ويبقى الخلفية." : sel.size ? "عنصر محدّد." : "") : "لم أجد عناصر قابلة للفصل في هذه الصورة (الخلفية قد تكون معقدة).";
    }
    const at = e => { const r = ov.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = -1, ba = 1e18; items.forEach(it => { const lx = Math.round(x - it.dx), ly = Math.round(y - it.dy); if (lx >= 0 && ly >= 0 && lx < it.dw && ly < it.dh && it.a[ly * it.dw + lx] && it.area < ba) { ba = it.area; best = it.id; } }); return best; };
    ov.onmousemove = e => { const h = at(e); if (h !== hov) { hov = h; paint(); } };
    ov.onclick = e => { if (sh.S.mode !== "one") return; const h = at(e); if (h < 0) return; sel = new Set([h]); paint(); };
    bindSeg(sh, () => { sel = new Set(); paint(); }); paint();
    if (note) { $("pbs-msg").style.color = "#b45309"; $("pbs-msg").textContent = "⚠️ لم يعمل الكشف الذكي: " + note.slice(0, 140) + " — هذه الطريقة البسيطة القديمة (لا تصلح للصور الفوتوغرافية)."; }
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
    chosen.slice().sort((p, q) => p.front != null && q.front != null ? p.front - q.front : q.area - p.area).forEach((it, i) => {      // الخلفي أولاً (الأمامي = الأقرب للأسفل في الصورة)
      const idx = chosen.indexOf(it), im = PB.mkFree("image", 0, 0, bz + 1 + i);
      Object.assign(im.set, { src: paths[idx], fit: "fill", alt: it.label || "", fx: { d: Math.round((fx + it.x0 / W * fwd) * 10) / 10 }, fy: { d: Math.round(fy + it.y0 * ky) }, fwd: { d: Math.round((it.x1 - it.x0) / W * fwd * 10) / 10 }, fh: { d: Math.max(10, Math.round((it.y1 - it.y0) * ky)) } });
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
  /* جلب صور جاهزة: كل صورة ← قسم كانفاس مُحجَّم بعرض مرجعي 1100 (كما يفعل المولّد)، بترتيب الأسماء */
  function importImages() {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp"; inp.multiple = true;
    inp.onchange = async () => {
      const files = [...inp.files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })); if (!files.length) return; const E = A().E, DW = 1100, made = [];
      try {
        for (let i = 0; i < files.length; i++) {
          const f = files[i]; if (f.size > 25 * 1024 * 1024) throw new Error(f.name + ": أكبر من 25MB");
          const cv = await new Promise((res, rej) => { const u = URL.createObjectURL(f), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res({ w: im.naturalWidth, h: im.naturalHeight }); }; im.onerror = () => rej(new Error(f.name + ": ليست صورة صالحة")); im.src = u; });
          const path = await A().uploadBlob(f, "imp-" + Date.now().toString(36) + "-" + i, { max: 3200, q: .95 }), kf = DW / cv.w, h = Math.round(cv.h * kf);
          const bg = PB.mkFree("image", 0, 0, 0); Object.assign(bg.set, { src: path, fit: "fill", fx: { d: 0 }, fy: { d: 0 }, fwd: { d: 100 }, fh: { d: h }, zi: 0 });
          const sec = PB.mkCanvas(); Object.assign(sec.set, { scaled: true, dw: DW, layout: "boxed", cw: { d: DW }, mh: { d: h } }); sec.free = [bg]; E.page.sections.push(sec); made.push(bg.id);
        }
        A().commitAfter(made[0]); alert("✅ أُضيفت " + made.length + " صورة كأقسام كانفاس جاهزة. حدّد أي صورة ثم استعمل «التقاط النص» أو «التقاط العناصر».");
      } catch (e) { alert("⚠️ " + e.message); }
    }; inp.click();
  }

  /* ───── ممحاة بالفرشاة: ارسم فوق ما تريد حذفه فتُرمَّم الخلفية بنموذج MI-GAN المحلي (أو ترميم محلي بسيط إن تعذّر النموذج) ───── */
  async function eraser(inf) {
    if (!inf || inf.node.type !== "image" || !inf.set.src) { alert("حدّد صورة أولاً"); return; }
    const id = inf.node.id; let src; try { src = await loadCanvas(inf.set.src); } catch (e) { alert("⚠️ " + e.message); return; }
    const MAXS = 1800, k0 = Math.min(1, MAXS / Math.max(src.width, src.height)); let base = src;
    if (k0 < 1) { base = document.createElement("canvas"); base.width = Math.round(src.width * k0); base.height = Math.round(src.height * k0); base.getContext("2d").drawImage(src, 0, 0, base.width, base.height); }
    const W = base.width, H = base.height, dispW = Math.max(240, Math.min(W, innerWidth * .88 - 8, (innerHeight - 230) * W / H)), dispH = Math.round(dispW * H / W), K = W / dispW;
    const ov = document.createElement("div"); ov.id = "pbs-er"; ov.style.cssText = "position:fixed;inset:0;z-index:10050;background:rgba(10,15,12,.78);display:flex;align-items:center;justify-content:center;font-family:inherit;direction:rtl";
    ov.innerHTML = `<div style="background:#fff;border-radius:16px;padding:.8rem;max-width:96vw;max-height:96vh;display:flex;flex-direction:column;gap:.6rem;box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <div style="display:flex;flex-wrap:wrap;gap:.5rem;align-items:center"><b style="font-size:1rem">🧽 ممحاة الصورة</b><span style="flex:1"></span>
        <label style="font-size:.78rem;display:flex;gap:.4rem;align-items:center">حجم الفرشاة <input id="er-sz" type="range" min="6" max="120" value="36" style="width:120px"></label>
        <button id="er-undo" type="button" class="pbx-small">↶ ضربة</button><button id="er-clr" type="button" class="pbx-small">مسح الرسم</button><button id="er-back" type="button" class="pbx-small" disabled>↩ تراجع الإزالة</button>
        <button id="er-go" type="button" style="background:#173f35;color:#fff;border:0;border-radius:8px;padding:.45rem .9rem;font-weight:800;cursor:pointer;font-family:inherit">✨ إزالة المحدد</button>
        <button id="er-save" type="button" style="background:#c8a24b;color:#173f35;border:0;border-radius:8px;padding:.45rem .9rem;font-weight:800;cursor:pointer;font-family:inherit" disabled>💾 حفظ في الصفحة</button><button id="er-x" type="button" class="pbx-small">إغلاق</button></div>
      <div id="er-st" style="position:relative;width:${dispW}px;height:${dispH}px;margin:0 auto;background:repeating-conic-gradient(#e6e0d0 0 25%,#fff 0 50%) 50%/16px 16px;border-radius:8px;overflow:hidden;touch-action:none"><canvas id="er-v" width="${dispW}" height="${dispH}" style="position:absolute;inset:0"></canvas><canvas id="er-o" width="${dispW}" height="${dispH}" style="position:absolute;inset:0;cursor:crosshair"></canvas><div id="er-c" style="position:absolute;pointer-events:none;border:2px solid #fff;box-shadow:0 0 0 1px #000;border-radius:50%;display:none"></div></div>
      <div id="er-msg" style="font-size:.78rem;color:#6b6556;text-align:center;min-height:1.2em">ارسم بالفأرة أو الإصبع فوق ما تريد حذفه (نص، شعار، عنصر)، ثم اضغط «إزالة المحدد». يمكنك التكرار على أجزاء متعددة.</div></div>`;
    document.body.appendChild(ov); const $ = i => ov.querySelector("#" + i), v = $("er-v"), o = $("er-o"), cur = $("er-c"), vg = v.getContext("2d"), og = o.getContext("2d"), msg = t => { $("er-msg").textContent = t; };
    let strokes = [], drawing = null, hist = [], dirty = false, busy = false;
    const redrawBase = () => { vg.clearRect(0, 0, dispW, dispH); vg.drawImage(base, 0, 0, dispW, dispH); };
    const paintView = () => { og.clearRect(0, 0, dispW, dispH); og.lineCap = og.lineJoin = "round"; og.strokeStyle = og.fillStyle = "rgba(255,60,60,.55)"; strokes.forEach(s => { og.lineWidth = s.r * 2 / K; og.beginPath(); s.p.forEach((q, i) => i ? og.lineTo(q[0] / K, q[1] / K) : og.moveTo(q[0] / K, q[1] / K)); if (s.p.length === 1) { og.arc(s.p[0][0] / K, s.p[0][1] / K, s.r / K, 0, 7); og.fill(); } else og.stroke(); }); };
    const pos = e => { const r = o.getBoundingClientRect(); return [(e.clientX - r.left) * K * (dispW / r.width), (e.clientY - r.top) * K * (dispH / r.height)]; };
    const rad = () => Number($("er-sz").value) * K / 2;
    o.addEventListener("pointerdown", e => { if (busy) return; e.preventDefault(); o.setPointerCapture(e.pointerId); drawing = { r: rad(), p: [pos(e)] }; strokes.push(drawing); paintView(); });
    o.addEventListener("pointermove", e => { const r = o.getBoundingClientRect(), d = Number($("er-sz").value) / (dispW / r.width) * (r.width / dispW); cur.style.display = "block"; cur.style.width = cur.style.height = $("er-sz").value + "px"; cur.style.left = (e.clientX - r.left - $("er-sz").value / 2) + "px"; cur.style.top = (e.clientY - r.top - $("er-sz").value / 2) + "px"; if (drawing) { drawing.p.push(pos(e)); paintView(); } });
    o.addEventListener("pointerup", () => { drawing = null; }); o.addEventListener("pointerleave", () => { cur.style.display = "none"; });
    $("er-undo").onclick = () => { strokes.pop(); paintView(); }; $("er-clr").onclick = () => { strokes = []; paintView(); };
    const close = () => { if (dirty && !confirm("هناك إزالة لم تُحفظ في الصفحة. إغلاق دون حفظ؟")) return; ov.remove(); }; $("er-x").onclick = close;
    $("er-back").onclick = () => { if (!hist.length || busy) return; base = hist.pop(); redrawBase(); strokes = []; paintView(); $("er-back").disabled = !hist.length; dirty = hist.length > 0; $("er-save").disabled = !dirty; };
    $("er-go").onclick = async () => {
      if (busy) return; if (!strokes.length) { msg("ارسم أولاً فوق ما تريد حذفه"); return; } busy = true; $("er-go").disabled = true; msg("⏳ جارٍ التجهيز…");
      try {
        const mk = document.createElement("canvas"); mk.width = W; mk.height = H; const mg = mk.getContext("2d"); mg.lineCap = mg.lineJoin = "round"; mg.strokeStyle = mg.fillStyle = "#fff";
        strokes.forEach(s => { mg.lineWidth = s.r * 2; mg.beginPath(); s.p.forEach((q, i) => i ? mg.lineTo(q[0], q[1]) : mg.moveTo(q[0], q[1])); if (s.p.length === 1) { mg.arc(s.p[0][0], s.p[0][1], s.r, 0, 7); mg.fill(); } else mg.stroke(); });
        const d = mg.getImageData(0, 0, W, H).data, U = new Uint8Array(W * H); let n = 0; for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] > 100) { U[i] = 1; n++; } if (!n) throw new Error("لم يُحدَّد شيء");
        const work = document.createElement("canvas"); work.width = W; work.height = H; work.getContext("2d", { willReadFrequently: true }).drawImage(base, 0, 0);
        let note = ""; const how = await AIVision.eraseBg(work, [{ erase: { m: U, x0: 0, y0: 0, w: W, h: H } }], { grow: Math.max(2, Math.round(Math.max(W, H) / 700)), onNote: m => { note = m; }, onStep: m => msg(m) });
        hist.push(base); base = work; redrawBase(); strokes = []; paintView(); dirty = true; $("er-back").disabled = false; $("er-save").disabled = false;
        msg(how === "model" ? "✅ تمت الإزالة بنموذج الذكاء الاصطناعي. أكمل إزالة أجزاء أخرى أو احفظ." : "✅ تمت الإزالة بترميم محلي بسيط" + (note ? " (" + note + ")" : "") + " — للخلفيات المعقدة جرّب الاتصال بالإنترنت ليُحمَّل النموذج.");
      } catch (e) { msg("⚠️ " + e.message); } busy = false; $("er-go").disabled = false;
    };
    $("er-save").onclick = async () => {
      if (busy) return; busy = true; $("er-save").disabled = true; msg("⏳ جارٍ رفع الصورة…");
      try { const blob = await new Promise(r => base.toBlob(r, "image/png")), path = await A().uploadBlob(blob, "er-" + Date.now().toString(36), { max: 3200, q: .95 }), q = A().find(id); if (q) { q.node.set.src = path; A().E.sel = id; A().renderCanvas(); A().commitAfter(id); } dirty = false; ov.remove(); }
      catch (e) { msg("⚠️ " + e.message); $("er-save").disabled = false; } busy = false;
    };
    redrawBase();
  }
  return { pane, capture, captureElements, importImages, eraser, warm, setGem };
})();
