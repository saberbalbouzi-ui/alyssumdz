/* ═══ أدوات في منشئ الصفحات: «التقاط النص» (مثل Canva) ═══
   تفحص الصورة المحدّدة، تحيط النصوص المكتشفة بمستطيلات ملوّنة، وتعرض نافذة بخيارين: «عنصر» (نص واحد تنقر عليه) أو «كل النصوص».
   عند «التقاط» تُقرأ النصوص (Alyssum API إن وُجد مفتاحه وإلا Tesseract)، تُمسح من الصورة بدقة مع إعادة رسم الخلفية، وتصير عناصر نص قابلة للتعديل فوق الصورة.
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
${tool('<path d="M4 20L16 8"/><path d="M14 4l.9 2.1L17 7l-2.1.9L14 10l-.9-2.1L11 7l2.1-.9z"/><path d="M19 12l.6 1.4L21 14l-1.4.6L19 16l-.6-1.4L17 14l1.4-.6z"/>', "التقاط العناصر", "الالتقاط السحري: يقصّ الأشخاص والمنتجات كصور شفافة — حدّد صورة أولاً", "captureElements", ' onmouseenter="PBSmart.warm()"')}
</div>
<div style="font-size:.72rem;color:#6b6556;line-height:1.7;margin:.55rem 0">حدّد صورة في الصفحة (حتى في قسم عادي — تُنسخ تلقائياً إلى قسم كانفاس) ثم اضغط أداة الالتقاط.</div>
${(typeof PBGen !== "undefined" && PBGen.aiOn && PBGen.aiOn()) ? `<label style="display:flex;gap:.4rem;align-items:flex-start;font-size:.72rem;color:#6b6556;line-height:1.6;cursor:pointer"><input type="checkbox" ${gemOn() ? "checked" : ""} onchange="PBSmart.setGem(this.checked)"> <span>اختياري: الاستعانة بمفتاح Alyssum API لأسماء أدق. بدونه تعمل الأدوات كاملة داخل متصفحك مجاناً.</span></label>` : `<div style="font-size:.72rem;color:#6b6556;line-height:1.6">🔒 Alyssum API (Alyssum API) معطّل — تعمل الأدوات كاملة داخل متصفحك بلا API.</div>`}
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
    if (!document.getElementById("pbs-shell-css")) { const st = document.createElement("style"); st.id = "pbs-shell-css"; st.textContent = "#pbs-modal.pbs-m{padding:0}#pbs-modal.pbs-m>div{border-radius:0;max-height:100vh;height:100vh}#pbs-modal.pbs-m #pbs-panel{position:absolute;top:0;bottom:0;left:0;width:min(320px,88vw)!important;flex:none!important;z-index:6;background:#fff;box-shadow:6px 0 24px rgba(0,0,0,.35);transition:transform .25s}#pbs-modal.pbs-m.pbs-c #pbs-panel{transform:translateX(-104%)}#pbs-modal:not(.pbs-m).pbs-c #pbs-panel{display:none}#pbs-tg{position:absolute;top:50%;margin-top:-34px;z-index:7;width:28px;height:68px;border:0;border-radius:0 12px 12px 0;background:#0d9488;color:#fff;font-size:1.5rem;font-weight:900;cursor:pointer;box-shadow:2px 2px 10px rgba(0,0,0,.3);padding:0;line-height:1}#pbs-fab{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:5;display:none;gap:.5rem}#pbs-fab button{border:0;border-radius:999px;padding:.75rem 1.4rem;font-weight:800;font-size:1rem;cursor:pointer;background:#0d9488;color:#fff;font-family:inherit;box-shadow:0 6px 20px rgba(0,0,0,.45)}#pbs-fab button.no{background:#fff;color:#b83232}#pbs-fab button:disabled{opacity:.5}"; document.head.appendChild(st); }
    host.innerHTML = `<div style="background:#fff;border-radius:16px;display:flex;gap:0;max-width:1100px;width:100%;height:94vh;max-height:94vh;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4);position:relative">
  <div id="pbs-view" style="flex:1;min-width:0;background:repeating-conic-gradient(#3a3a42 0% 25%,#33333a 0% 50%) 50%/20px 20px;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center"><div id="pbs-stage" style="position:relative;margin:0 auto;width:fit-content"></div><div id="pbs-load" style="position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;align-items:center;gap:.4rem;color:#fff;font-weight:800;font-size:.85rem;background:rgba(15,23,25,.78);padding:.45rem 1rem;border-radius:999px;white-space:nowrap;z-index:3;box-shadow:0 4px 18px rgba(0,0,0,.35)">⏳ جارِ مسح الصورة…</div></div>
  <div id="pbs-panel" style="width:320px;flex:0 0 320px;padding:1.1rem;display:flex;flex-direction:column;gap:.9rem;overflow:auto">
    <div style="display:flex;align-items:center;gap:.6rem"><button id="pbs-back" title="رجوع" style="border:0;background:none;font-size:1.3rem;cursor:pointer">→</button><b style="font-size:1.05rem;flex:1">${title}</b><button id="pbs-x" title="إغلاق" style="border:0;background:none;font-size:1.4rem;cursor:pointer">✕</button></div>
    <div style="font-weight:800;line-height:1.6">حدّد ما تريد التقاطه.</div>
    <div id="pbs-seg" style="display:flex;background:#f3f2f6;border-radius:12px;padding:4px"><button data-m="one" class="on" style="flex:1;border:0;border-radius:9px;padding:.55rem;cursor:pointer;font-weight:700;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.15)">✨ ${oneLabel}</button><button data-m="all" style="flex:1;border:0;border-radius:9px;padding:.55rem;cursor:pointer;font-weight:700;background:transparent">${allLabel}</button></div>
    <div id="pbs-hint" style="font-size:.8rem;color:#6b6556;line-height:1.7">${hintOne}</div>
    <div id="pbs-extra" style="display:flex;flex-direction:column;gap:.5rem"></div>
    <button id="pbs-go" disabled style="border:0;border-radius:12px;padding:.8rem;font-weight:800;font-size:1rem;cursor:pointer;background:#0d9488;color:#fff">التقاط</button>
    <div id="pbs-msg" style="font-size:.78rem;line-height:1.7;color:#173f35;min-height:3em"></div>
    <div style="font-size:.74rem;color:#8a8472;border-top:1px solid #eee;padding-top:.6rem">تعمل الأداة داخل متصفحك. الصورة الأصلية لا تتغير إلا عند «التقاط».<div id="pbs-ver" style="margin-top:.35rem;font-size:.68rem;color:#a8a294;direction:rtl"></div></div>
  </div><button id="pbs-tg" type="button" title="إخفاء/إظهار الشريط">‹</button><div id="pbs-fab"></div></div>`;
    document.body.appendChild(host); const $ = id => host.querySelector("#" + id), S = { mode: "one", closed: false, hintOne, hintAll };
    /* الشريط الجانبي قابل للطيّ بسهم (يدخل إلى اليسار)؛ على الهاتف يطفو فوق الصورة ويبدأ مطوياً، وزرّ عائم في أسفل الصورة ينوب عن زرّ الالتقاط/الحفظ */
    const mob = () => innerWidth <= 820, tg = $("pbs-tg"), fab = $("pbs-fab"), panel = $("pbs-panel");
    const place = () => { const open = !host.classList.contains("pbs-c"); tg.textContent = open ? "‹" : "›"; tg.style.left = (open ? panel.offsetWidth : 0) + "px"; };
    const lay = () => { host.classList.toggle("pbs-m", mob()); place(); }; let first = true;
    const setCollapsed = c => { host.classList.toggle("pbs-c", c); setTimeout(place, 270); place(); };
    tg.onclick = () => setCollapsed(!host.classList.contains("pbs-c"));
    lay(); if (mob()) setCollapsed(true); const onR = () => { if (S.closed) return; const was = host.classList.contains("pbs-m"); lay(); if (mob() && !was) setCollapsed(true); }; window.addEventListener("resize", onR);
    const syncFab = () => { if (S.closed) return clearInterval(S.fabT); const ok = $("pbs-ok"), no = $("pbs-no"), go = $("pbs-go"), want = host.classList.contains("pbs-c"); if (!want) { fab.style.display = "none"; return; }
      const key = ok ? "ok" : go && go.style.display !== "none" ? "go:" + go.textContent + go.disabled : ""; if (!key) { fab.style.display = "none"; return; } fab.style.display = "flex"; if (fab.dataset.k === key) return; fab.dataset.k = key; fab.innerHTML = "";
      const mkb = (t, fn, cls, dis) => { const b = document.createElement("button"); b.type = "button"; b.textContent = t; if (cls) b.className = cls; b.disabled = !!dis; b.onclick = fn; fab.appendChild(b); };
      if (ok) { mkb("💾 حفظ", () => ok.click()); mkb("✕ إلغاء", () => no && no.click(), "no"); } else mkb(go.textContent, () => go.click(), "", go.disabled); };
    S.fabT = setInterval(syncFab, 250); S.setCollapsed = setCollapsed;
    const close = () => { S.closed = true; clearInterval(S.fabT); window.removeEventListener("resize", onR); host.remove(); }; $("pbs-x").onclick = $("pbs-back").onclick = close;
    return { host, $, S, close, setCollapsed };
  }
  function bindSeg(sh, repaint) { sh.host.querySelectorAll("#pbs-seg button").forEach(b => b.onclick = () => { sh.S.mode = b.dataset.m; sh.S.onMode && sh.S.onMode(); sh.host.querySelectorAll("#pbs-seg button").forEach(x => { const on = x === b; x.classList.toggle("on", on); x.style.background = on ? "#fff" : "transparent"; x.style.boxShadow = on ? "0 1px 4px rgba(0,0,0,.15)" : "none"; }); sh.$("pbs-hint").textContent = sh.S.mode === "all" ? sh.S.hintAll : sh.S.hintOne; repaint(); }); }
  /* أثناء التحليل: الصورة ظاهرة وخط مضيء يمسحها ذهاباً وإياباً حتى ينتهي المسح ← يعيد دالة الإيقاف */
  function scanFx(sh, cv) {
    if (!document.getElementById("pbs-scan-css4")) { const st = document.createElement("style"); st.id = "pbs-scan-css4"; st.textContent = "@keyframes pbsScan{0%{top:0}100%{top:calc(100% - 3px)}}@keyframes pbsTint{0%,100%{opacity:.7}50%{opacity:1}}#pbs-tint{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(34,197,94,.26),rgba(16,185,129,.2));animation:pbsTint 2.2s ease-in-out infinite}#pbs-scanline{position:absolute;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#22c55e 8%,#d9ffe6 50%,#22c55e 92%,transparent);box-shadow:0 0 14px 4px rgba(74,222,128,.75),0 0 34px 10px rgba(34,197,94,.4);animation:pbsScan 1.1s ease-in-out infinite alternate;pointer-events:none}"; document.head.appendChild(st); }
    const stage = sh.$("pbs-stage"); stage.innerHTML = ""; const { vw, vh } = viewSize(sh, cv.width, cv.height), img = document.createElement("canvas"); img.width = vw; img.height = vh; img.getContext("2d").drawImage(cv, 0, 0, vw, vh); img.style.cssText = "display:block;background:#fff"; stage.appendChild(img);
    const tint = document.createElement("div"); tint.id = "pbs-tint"; stage.appendChild(tint); const ln = document.createElement("div"); ln.id = "pbs-scanline"; stage.appendChild(ln); sh.$("pbs-load").style.display = "flex"; sh.$("pbs-go").disabled = true; sh.$("pbs-go").textContent = "⏳ جارِ المسح…";
    return () => { stage.innerHTML = ""; };
  }
  /* الصورة كاملة داخل النافذة (العرض والارتفاع معاً) بلا شريط تمرير */
  function viewSize(sh, W, H) { const view = sh.$("pbs-view"), k = Math.max(.05, Math.min(1, (view.clientWidth - 24) / W, (view.clientHeight - 24) / H)), vw = Math.max(40, Math.round(W * k)); return { vw, vh: Math.max(40, Math.round(H * k)), k: vw / W }; }

  /* ═══ التقاط النص ═══ */
  async function capture() {
    const t = target(); if (t.err) return alert(t.err);
    const inf = t.inf, w = inf.node, sh = shell("التقاط النص", "عنصر", "كل النصوص", "انقر على أحد المستطيلات الملوّنة لاختيار نص واحد. فاتك نص؟ ارسم مستطيلاً حوله بالسحب.", "ستُلتقط كل النصوص المكتشفة دفعة واحدة."), $ = sh.$;
    let cv; try { cv = await loadCanvas(w.set.src); } catch (e) { $("pbs-load").textContent = "⚠️ " + e.message; return; }
    const W = cv.width, H = cv.height, stopScan = scanFx(sh, cv); await new Promise(r => setTimeout(r, 40));
    /* مسح الصورة: كشف بالصورة (+ قراءة إن وُجد مفتاح Alyssum API ليكون الكشف أدق وتُستبعد الصناديق غير النصية) */
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
     الأداة داخل المتصفح (assets/js/ai-vision.js): كشف العناصر بأسمائها (امرأة، طفل، عبوة، صحن، ملعقة، قلم، إبريق، كتب…) وحدود دقيقة بالبكسل،
     واختيار عنصر أو أكثر أو الكل، وإضافة ما فات الكشف بنقرة أو مستطيل. إن تعذّر تحميل النموذج نعود إلى الكشف البسيط بالحواف. */
  const HINT_EL1 = "انقر على عنصر محاط بخط ملوّن لاختياره. تلتقط الأداة العناصر الكاملة فقط (شخص، منتج، كتاب، قلم، زهرة…)؛ الجزء المقطوع كيدٍ تمسك منتجاً لا يُلتقط، ويُلتقط المنتج وحده.", HINT_EL2 = "ستُلتقط كل العناصر المكتشفة دفعة واحدة وتبقى الخلفية.";
  const GEMK = "alyssum_pbs_gem", gemOn = () => { try { return localStorage.getItem(GEMK) === "1"; } catch (e) { return false; } };      // Alyssum API اختياري ومُطفأ افتراضياً: الأداة تعمل كاملة بلا مفتاح
  function setGem(on) { try { localStorage.setItem(GEMK, on ? "1" : "0"); } catch (e) { } }
  function warm() { }      // لا تحميل نماذج محلية: الأدوات تعمل بـAlyssum API فقط
  const LITE = () => { try { return (window.ImgCfg && ImgCfg.get("capture", "lite", false)) || matchMedia("(pointer: coarse)").matches || innerWidth <= 820 || (navigator.deviceMemory || 8) <= 4; } catch (e) { return false; } };      // هاتف/جهاز ضعيف: تحليل أخف حتى لا يتعطّل
  function capCanvas(cv, max) { const m = Math.max(cv.width, cv.height); if (m <= max) return cv; const r = max / m, c = document.createElement("canvas"); c.width = Math.round(cv.width * r); c.height = Math.round(cv.height * r); c.getContext("2d", { willReadFrequently: true }).drawImage(cv, 0, 0, c.width, c.height); return c; }
  const segReady = () => { try { return !!window.AICapture && AICapture.ready() && !!ImgGen.edit; } catch (e) { return false; } };
  /* التقاط العناصر بالـAPI بدقة عالية (وحدة AICapture المستقلة): كشف المربعات ← اختيار ← قناع تجزئة لكل عنصر على محيطه بدقة الصورة ← صقل الحواف من بكسلات الصورة الأصلية
     ← إعادة رسم الخلفية مكان العناصر داخل منطقتها فقط ← معاينة ثم حفظ. يُرجع "local" ليكمل الطريقة المحلية عند فشل الكشف. */
  async function apiCapture(sh, cv, inf, w) {
    const $ = sh.$, W = cv.width, H = cv.height;
    const stopScan = scanFx(sh, cv); $("pbs-load").style.display = "flex"; $("pbs-load").textContent = "⏳ كشف العناصر…"; let items;
    try { items = await AICapture.detectAll(cv, { onStep: m => { if (!sh.S.closed) $("pbs-load").textContent = m; } }); }
    catch (e) { stopScan(); if (sh.S.closed) return null; console.warn("AICapture", e); $("pbs-load").style.display = ""; $("pbs-load").textContent = "⚠️ " + (e && e.code === "OFF" ? "التوليد معطّل من الإعدادات" : e && e.code === "NOKEY" ? "أدخل مفتاح Alyssum API من «إعدادات مولّد الصور» لتفعيل التقاط العناصر" : String(e && e.message || e).slice(0, 160)); return null; }
    stopScan(); if (sh.S.closed) return null; $("pbs-load").style.display = "none";
    const stage = $("pbs-stage"), { vw, vh, k } = viewSize(sh, W, H), img = document.createElement("canvas"); img.width = vw; img.height = vh; img.getContext("2d").drawImage(cv, 0, 0, vw, vh); img.style.cssText = "display:block;background:#fff"; stage.appendChild(img);
    const ov = document.createElement("canvas"); ov.width = vw; ov.height = vh; ov.style.cssText = "position:absolute;left:0;top:0;cursor:pointer"; stage.appendChild(ov);
    const area = it => (it.box.x1 - it.box.x0) * (it.box.y1 - it.box.y0); let sel = new Set(), hov = -1, busy = false;
    const hit = (x, y) => { let best = -1, ba = 1e18; items.forEach(it => { const b = it.box; if (x >= b.x0 * k && x <= b.x1 * k && y >= b.y0 * k && y <= b.y1 * k && area(it) < ba) { ba = area(it); best = it.id; } }); return best; };
    $("pbs-hint").textContent = sh.S.hintOne = "انقر على عنصر لاختياره، أو التقط كل العناصر دفعة واحدة. تُقصّ الحواف بدقة من بكسلات صورتك الأصلية وتُعاد الخلفية مكانها.";
    $("pbs-extra").innerHTML = '<label style="display:flex;gap:.45rem;align-items:center;font-size:.82rem;font-weight:700"><input type="checkbox" id="pbs-fill" checked> إعادة رسم الخلفية مكان العناصر</label>';
    const colors = ["#0d9488", "#7c3aed", "#ea580c", "#2563eb", "#db2777", "#16a34a", "#ca8a04", "#0891b2"];
    function paint() {
      const g = ov.getContext("2d"), mode = sh.S.mode; g.clearRect(0, 0, vw, vh); g.font = "700 12px sans-serif"; g.textBaseline = "top";
      items.forEach(it => { const b = it.box, on = mode === "all" || sel.has(it.id), c = colors[it.id % colors.length], x = b.x0 * k, y = b.y0 * k, bw = (b.x1 - b.x0) * k, bh = (b.y1 - b.y0) * k; g.lineWidth = on || hov === it.id ? 3 : 2; g.strokeStyle = c; g.setLineDash(on ? [] : [6, 3]);
        if (on) { g.fillStyle = c + "33"; g.fillRect(x, y, bw, bh); } else if (hov === it.id) { g.fillStyle = c + "1a"; g.fillRect(x, y, bw, bh); } g.strokeRect(x, y, bw, bh); const tw = g.measureText(it.label).width + 10; g.setLineDash([]); g.fillStyle = c; g.fillRect(x, y, tw, 18); g.fillStyle = "#fff"; g.fillText(it.label, x + 5, y + 3); });
      const n = mode === "all" ? items.length : sel.size; $("pbs-go").disabled = !n || busy; $("pbs-go").textContent = mode === "all" ? "التقاط " + items.length + " عنصراً" : "التقاط"; $("pbs-msg").textContent = n ? (mode === "all" ? "سيُلتقط كل ما وجدته الأداة (" + items.length + ")." : "عنصر محدّد.") : "وجدت الأداة " + items.length + " عنصراً — اختر منها.";
    }
    ov.onmousemove = e => { const r = ov.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top); if (h !== hov) { hov = h; paint(); } };
    ov.onclick = e => { if (sh.S.mode !== "one") return; const r = ov.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top); if (h < 0) return; sel = new Set([h]); paint(); };
    bindSeg(sh, () => { sel = new Set(); paint(); }); paint();
    return new Promise(done => {
      const c0 = sh.close; sh.close = () => { c0(); done(null); };
      $("pbs-go").onclick = async () => {
        const chosen = sh.S.mode === "all" ? items.slice() : items.filter(it => sel.has(it.id)); if (!chosen.length || busy) return; busy = true; $("pbs-go").disabled = true; const fill = !!($("pbs-fill") && $("pbs-fill").checked);
        try {
          const cuts = [], fails = []; let next = 0, dn = 0; const say = m => { if (!sh.S.closed) $("pbs-msg").textContent = m; };
          const worker = async () => { while (next < chosen.length && !sh.S.closed) { const it = chosen[next++]; try { const c = await AICapture.cutout(cv, it, { onStep: m => say(m + " (" + dn + "/" + chosen.length + ")") }); cuts.push(c); } catch (e) { if (e && (e.code === "NOKEY" || e.code === "OFF")) throw e; fails.push(it.label); console.warn("cutout", it.label, e); } dn++; } };
          await Promise.all([worker(), worker(), worker()]); if (sh.S.closed) return; if (!cuts.length) throw new Error("لم يُعزل أي عنصر — جرّب مستطيلاً أضيق حول العنصر");
          cuts.sort((a, b) => (a.y0 + a.h) - (b.y0 + b.h)); const nm = {}, cnt = {}; cuts.forEach(c => cnt[c.label] = (cnt[c.label] || 0) + 1); cuts.forEach(c => { nm[c.label] = (nm[c.label] || 0) + 1; c.label = cnt[c.label] > 1 ? c.label + " " + nm[c.label] : c.label; });
          const part = document.createElement("canvas"); part.width = W; part.height = H; part.getContext("2d", { willReadFrequently: true }).drawImage(cv, 0, 0); let how = "none";
          if (fill) { try { say("⏳ إعادة رسم الخلفية…"); await AICapture.fillBg(part, cuts, { onStep: say }); how = "ai"; } catch (e) { console.warn("fillBg", e); if (e && (e.code === "NOKEY" || e.code === "OFF")) throw e; throw new Error("تعذّرت إعادة رسم الخلفية — أعد المحاولة أو ألغِ خيار «إعادة رسم الخلفية»"); } }
          const ok = await new Promise(res => {      // معاينة: الخلفية بعد الإزالة + العناصر مرفوعة قليلاً ← حفظ أو إلغاء
            const kids = [...stage.childNodes]; kids.forEach(n => n.remove()); const c = document.createElement("canvas"); c.width = vw; c.height = vh; c.style.cssText = "display:block;background:#fff"; stage.appendChild(c); const g = c.getContext("2d");
            g.drawImage(part, 0, 0, vw, vh); cuts.forEach(q => { g.save(); g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = 14; g.shadowOffsetY = 6; g.drawImage(q.canvas, q.x0 * k, q.y0 * k - 6, q.w * k, q.h * k); g.restore(); });
            const bar = document.createElement("div"); bar.style.cssText = "display:flex;gap:.5rem"; bar.innerHTML = '<button type="button" id="pbs-ok" style="flex:1;border:0;border-radius:12px;padding:.75rem;font-weight:800;cursor:pointer;background:#0d9488;color:#fff;font-family:inherit">💾 حفظ</button><button type="button" id="pbs-no" style="flex:1;border:1.5px solid #d6d3cb;border-radius:12px;padding:.75rem;font-weight:800;cursor:pointer;background:#fff;color:#44403c;font-family:inherit">✖ إلغاء</button>';
            $("pbs-go").style.display = "none"; $("pbs-go").after(bar); say("👀 النتيجة: العناصر مقصوصة من بكسلات صورتك" + (how === "none" ? "" : " والخلفية أُعيد رسمها") + (fails.length ? " — تعذّر: " + fails.join("، ") : "") + ". احفظها أو ألغِها.");
            const end = v => { bar.remove(); $("pbs-go").style.display = ""; if (!v) { stage.innerHTML = ""; kids.forEach(n => stage.appendChild(n)); } res(v); }; bar.querySelector("#pbs-ok").onclick = () => end(true); bar.querySelector("#pbs-no").onclick = () => end(false); });
          if (!ok) { busy = false; paint(); return; }
          say("⏳ رفع الصور…"); const stamp = Date.now().toString(36), toB = c => new Promise(r => c.toBlob(r, "image/png")), basePath = await A().uploadBlob(await toB(part), "bg-" + stamp, { max: 3200, q: .95 }), paths = [];
          for (let i = 0; i < cuts.length; i++) paths.push(await A().uploadBlob(await toB(cuts[i].canvas), "el-" + stamp + "-" + i, { max: 2400, q: .92 }));
          const els = cuts.map((c, i) => ({ x0: c.x0, y0: c.y0, x1: c.x0 + c.w, y1: c.y0 + c.h, area: c.w * c.h, front: i, label: c.label })), n = applyElements(inf, w, W, H, els, paths, basePath); sh.close(); done(null);
          alert("✅ التُقط " + n + " عنصراً كصور مستقلة قابلة للتحريك: " + els.map(e => e.label).join("، ") + (how === "ai" ? "\n🪄 أُعيد رسم الخلفية مكانها." : "") + (fails.length ? "\n⚠️ تعذّر عزل: " + fails.join("، ") : "") + "\nللتراجع اضغط Ctrl+Z.");
        } catch (e) { console.error(e); busy = false; if (!sh.S.closed) { $("pbs-msg").textContent = "⚠️ " + (e && e.code === "NOKEY" ? "أدخل مفتاح Alyssum API من إعدادات مولّد الصور" : e && e.code === "OFF" ? "التوليد معطّل من الإعدادات" : (e.message || e)); $("pbs-go").disabled = false; } }
      };
    });
  }
  async function captureElements() {
    const t = target(); if (t.err) return alert(t.err);
    const inf = t.inf, w = inf.node, sh = shell("التقاط العناصر", "عنصر", "كل العناصر", HINT_EL1, HINT_EL2), $ = sh.$;
    let cv; try { cv = await loadCanvas(w.set.src); } catch (e) { $("pbs-load").textContent = "⚠️ " + e.message; return; }
    cv = capCanvas(cv, 2200);
    if (!segReady()) { $("pbs-load").style.display = ""; $("pbs-load").textContent = "⚠️ أدخل مفتاح Alyssum API من «إعدادات مولّد الصور» لتفعيل التقاط العناصر"; return; }
    await new Promise(r => setTimeout(r, 40)); if (sh.S.closed) return;
    await apiCapture(sh, cv, inf, w);      // كشف وأقنعة بطلب واحد ← اختيار ← قصّ محلي بدقة البكسل ← إعادة رسم الخلفية بطلب واحد
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
        A().commitAfter(made[0]); alert("✅ أُضيفت " + made.length + " صورة كأقسام كانفاس جاهزة. حدّد أي صورة ثم استعمل «التقاط العناصر».");
      } catch (e) { alert("⚠️ " + e.message); }
    }; inp.click();
  }

  /* ───── ممحاة بالفرشاة: ارسم فوق ما تريد حذفه فيُمسح فور رفع يدك — طلب واحد إلى Alyssum API يعيد رسم الخلفية داخل منطقة الرسم فقط ───── */
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
        <button id="er-go" type="button" style="display:none;background:#173f35;color:#fff;border:0;border-radius:8px;padding:.45rem .9rem;font-weight:800;cursor:pointer;font-family:inherit">✨ إزالة المحدد</button>
        <button id="er-save" type="button" style="background:#c8a24b;color:#173f35;border:0;border-radius:8px;padding:.45rem .9rem;font-weight:800;cursor:pointer;font-family:inherit" disabled>💾 حفظ في الصفحة</button><button id="er-x" type="button" class="pbx-small">إغلاق</button></div>
      <div id="er-st" style="position:relative;width:${dispW}px;height:${dispH}px;margin:0 auto;background:repeating-conic-gradient(#e6e0d0 0 25%,#fff 0 50%) 50%/16px 16px;border-radius:8px;overflow:hidden;touch-action:none"><canvas id="er-v" width="${dispW}" height="${dispH}" style="position:absolute;inset:0"></canvas><canvas id="er-o" width="${dispW}" height="${dispH}" style="position:absolute;inset:0;cursor:crosshair"></canvas><div id="er-c" style="position:absolute;pointer-events:none;border:2px solid #fff;box-shadow:0 0 0 1px #000;border-radius:50%;display:none"></div></div>
      <div id="er-msg" style="font-size:.78rem;color:#6b6556;text-align:center;min-height:1.2em">ارسم بالفأرة أو الإصبع فوق ما تريد حذفه — يُمسح فور رفع يدك (نص، شعار، عنصر)، ثم اضغط «إزالة المحدد». يمكنك التكرار على أجزاء متعددة.</div></div>`;
    document.body.appendChild(ov); const $ = i => ov.querySelector("#" + i), v = $("er-v"), o = $("er-o"), cur = $("er-c"), vg = v.getContext("2d"), og = o.getContext("2d"), msg = t => { $("er-msg").textContent = t; };
    let strokes = [], drawing = null, hist = [], dirty = false, busy = false;
    const redrawBase = () => { vg.clearRect(0, 0, dispW, dispH); vg.drawImage(base, 0, 0, dispW, dispH); };
    const paintView = () => { og.clearRect(0, 0, dispW, dispH); og.lineCap = og.lineJoin = "round"; og.strokeStyle = og.fillStyle = "rgba(255,60,60,.55)"; strokes.forEach(s => { og.lineWidth = s.r * 2 / K; og.beginPath(); s.p.forEach((q, i) => i ? og.lineTo(q[0] / K, q[1] / K) : og.moveTo(q[0] / K, q[1] / K)); if (s.p.length === 1) { og.arc(s.p[0][0] / K, s.p[0][1] / K, s.r / K, 0, 7); og.fill(); } else og.stroke(); }); };
    const pos = e => { const r = o.getBoundingClientRect(); return [(e.clientX - r.left) * K * (dispW / r.width), (e.clientY - r.top) * K * (dispH / r.height)]; };
    const rad = () => Number($("er-sz").value) * K / 2;
    o.addEventListener("pointerdown", e => { if (busy) return; e.preventDefault(); o.setPointerCapture(e.pointerId); drawing = { r: rad(), p: [pos(e)] }; strokes.push(drawing); paintView(); });
    o.addEventListener("pointermove", e => { const r = o.getBoundingClientRect(), d = Number($("er-sz").value) / (dispW / r.width) * (r.width / dispW); cur.style.display = "block"; cur.style.width = cur.style.height = $("er-sz").value + "px"; cur.style.left = (e.clientX - r.left - $("er-sz").value / 2) + "px"; cur.style.top = (e.clientY - r.top - $("er-sz").value / 2) + "px"; if (drawing) { drawing.p.push(pos(e)); paintView(); } });
    o.addEventListener("pointerup", () => { const had = drawing; drawing = null; if (had && !busy) $("er-go").click(); });      // ارفع إصبعك ← يُمسح فوراً (مسحة واحدة) o.addEventListener("pointerleave", () => { cur.style.display = "none"; });
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
        if (typeof AICapture === "undefined" || !AICapture.ready()) { const e = new Error("أدخل مفتاح Alyssum API من «إعدادات مولّد الصور» لتفعيل الممحاة"); throw e; }
        const mc = document.createElement("canvas"); mc.width = W; mc.height = H; const mi = mc.getContext("2d"), im = mi.createImageData(W, H); for (let i = 0; i < W * H; i++) if (U[i]) { im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = 255; im.data[i * 4 + 3] = 255; } mi.putImageData(im, 0, 0);
        msg("⏳ جارٍ المسح…"); await AICapture.fillBg(work, [{ canvas: mc, x0: 0, y0: 0, w: W, h: H }], { onStep: m => msg(m) });
        hist.push(base); base = work; redrawBase(); strokes = []; paintView(); dirty = true; $("er-back").disabled = false; $("er-save").disabled = false;
        msg("✅ تمّ المسح. امسح عنصراً آخر أو احفظ.");
      } catch (e) { msg("⚠️ " + e.message); } busy = false; $("er-go").disabled = false;
    };
    $("er-save").onclick = async () => {
      if (busy) return; busy = true; $("er-save").disabled = true; msg("⏳ جارٍ رفع الصورة…");
      try { const blob = await new Promise(r => base.toBlob(r, "image/png")), path = await A().uploadBlob(blob, "er-" + Date.now().toString(36), { max: 3200, q: .95 }), q = A().find(id); if (q) { q.node.set.src = path; A().E.sel = id; A().renderCanvas(); A().commitAfter(id); } dirty = false; ov.remove(); }
      catch (e) { msg("⚠️ " + e.message); $("er-save").disabled = false; } busy = false;
    };
    redrawBase();
  }
  return { pane, capture, captureElements, importImages, eraser, warm, setGem, _shell: shell, _scanFx: scanFx };
})();
