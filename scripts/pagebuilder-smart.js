/* ═══ أدوات ذكية في منشئ الصفحات: «التقاط النص» (مثل Canva) ═══
   تفحص الصورة المحدّدة، تحيط النصوص المكتشفة بمستطيلات بنفسجية، وتعرض نافذة بخيارين: «عنصر» (نص واحد تنقر عليه) أو «كل النصوص».
   عند «التقاط» تُقرأ النصوص (Gemini إن وُجد مفتاحه وإلا Tesseract)، تُمسح من الصورة بدقة مع إعادة رسم الخلفية، وتصير عناصر نص قابلة للتعديل فوق الصورة.
   تعمل على صورة داخل قسم «كانفاس» (الصفحات المولَّدة). تعتمد على assets/js/text-capture.js و image-tools.js. */
const PBSmart = (function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const FSK = { ar: 1.15, lat: .74 }, ARABIC = /[؀-ۿ]/;
  const A = () => PBApp;
  function pane() {
    const card = (ic, title, desc, fn) => `<div style="border:1.5px solid #e4dfd2;border-radius:12px;padding:.7rem;background:#fff;margin-bottom:.6rem"><div style="font-weight:800">${ic} ${title}</div><div style="font-size:.78rem;color:#6b6556;line-height:1.7;margin:.3rem 0 .6rem">${desc}</div><button type="button" style="width:100%;background:#7c3aed;color:#fff;border:0;border-radius:10px;padding:.55rem;font-weight:800;cursor:pointer;font-family:inherit" onclick="PBSmart.${fn}()"${fn === "captureElements" ? ' onmouseenter="PBSmart.warm()"' : ""}>${title} من الصورة المحدّدة</button></div>`;
    return `<div class="pbx-f"><div style="font-weight:900;color:#173f35;margin-bottom:.2rem">🪄 أدوات ذكية</div>
<div style="font-size:.76rem;color:#6b6556;line-height:1.7;margin-bottom:.6rem">حدّد صورة داخل قسم كانفاس (الصفحات المولَّدة)، ثم اختر الأداة: تمسح الصورة وتحيط بما يمكن فصله بخط بنفسجي، وتختار <b>عنصراً</b> أو <b>الكل</b> ثم «التقاط».</div>
<div style="border:1.5px dashed #c9bfa6;border-radius:12px;padding:.7rem;background:#fffdf7;margin-bottom:.6rem"><div style="font-weight:800">📥 جلب صورة جاهزة</div><div style="font-size:.78rem;color:#6b6556;line-height:1.7;margin:.3rem 0 .6rem">لديك صفحة/تصميم من خارج الموقع؟ اجلب <b>صورة واحدة</b> أو <b>عدة صور مقسَّمة</b> (بالترتيب من الأعلى للأسفل): تُوضع كل صورة في قسم كانفاس جاهز، ثم تُجرّب عليها الأداتين أدناه.</div><button type="button" style="width:100%;background:#173f35;color:#fff;border:0;border-radius:10px;padding:.55rem;font-weight:800;cursor:pointer;font-family:inherit" onclick="PBSmart.importImages()">اختيار صورة / صور من الجهاز</button></div>
${card("🔤", "التقاط النص", "يفصل النصوص عن الصورة بدقة ويحوّلها إلى نصوص قابلة للتعديل، وتُمسح من الصورة وتبقى خلفيتها.", "capture")}
${card("🖼️", "التقاط العناصر", "مثل «الالتقاط السحري» في Canva: يتعرّف على العناصر بأسمائها (أشخاص، منتجات، أطباق، أقلام، أعشاب…) ويقصّها بحدود دقيقة <b>مع ظلالها</b> كصور شفافة مستقلة، وتبقى الخلفية. يعمل بلا مفتاح داخل متصفحك (أول مرة تُنزَّل النماذج ~110MB ثم تُحفظ).", "captureElements")}
<label style="display:flex;gap:.4rem;align-items:flex-start;font-size:.74rem;color:#6b6556;line-height:1.6;margin-top:-.2rem;cursor:pointer"><input type="checkbox" ${gemOn() ? "checked" : ""} onchange="PBSmart.setGem(this.checked)"> <span>اختياري: الاستعانة بمفتاح Gemini (أسماء أدق وإعادة رسم بالسحابة). بدونه تعمل الأداة كاملة داخل متصفحك مجاناً.</span></label>
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
    <div id="pbs-extra" style="display:flex;flex-direction:column;gap:.5rem"></div>
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

  /* ═══ التقاط العناصر (مثل «الالتقاط السحري» في Canva) ═══
     الذكاء داخل المتصفح (assets/js/ai-vision.js): كشف العناصر بأسمائها (امرأة، طفل، عبوة، صحن، ملعقة، قلم، إبريق، كتب…) وحدود دقيقة بالبكسل،
     واختيار عنصر أو أكثر أو الكل، وإضافة ما فات الكشف بنقرة أو مستطيل. إن تعذّر تحميل النموذج نعود إلى الكشف البسيط بالحواف. */
  const HINT_EL1 = "انقر على عنصر محاط بالبنفسجي لاختياره (وانقر على غيره لإضافته). فاتك عنصر؟ انقر عليه مباشرة أو ارسم مستطيلاً حوله.", HINT_EL2 = "ستُلتقط كل العناصر المكتشفة دفعة واحدة وتبقى الخلفية.";
  const GEMK = "alyssum_pbs_gem", gemOn = () => { try { return localStorage.getItem(GEMK) === "1"; } catch (e) { return false; } };      // Gemini اختياري ومُطفأ افتراضياً: الأداة تعمل كاملة بلا مفتاح
  function setGem(on) { try { localStorage.setItem(GEMK, on ? "1" : "0"); } catch (e) { } }
  function warm() { try { if (window.AIVision && AIVision.supported() && !warm.done) { warm.done = true; AIVision.warm(); } } catch (e) { } }
  async function captureElements() {
    const t = target(); if (t.err) return alert(t.err);
    const inf = t.inf, w = inf.node, sh = shell("التقاط العناصر", "عنصر", "كل العناصر", HINT_EL1, HINT_EL2), $ = sh.$;
    let cv; try { cv = await loadCanvas(w.set.src); } catch (e) { $("pbs-load").textContent = "⚠️ " + e.message; return; }
    await new Promise(r => setTimeout(r, 40)); let res = null, note = "";
    if (window.AIVision && AIVision.supported()) {
      const key = gemOn() ? TextCapture.ocr.key() : "";
      try { res = await AIVision.analyze(cv, { key, onStep: m => { if (!sh.S.closed) $("pbs-load").textContent = m; } }); } catch (e) { console.warn("AIVision", e); note = e.message; }
      if (sh.S.closed) return; if (res) return elementsAI(sh, cv, inf, w, res, key);
    }
    return elementsBasic(sh, cv, inf, w, note);
  }
  /* الواجهة الذكية: حدود بنفسجية تتبع العنصر + اسمه، قائمة العناصر، نقرة/مستطيل لإضافة عنصر، دمج، وملء الخلفية */
  function elementsAI(sh, cv, inf, w, res, key) {
    const $ = sh.$, W = cv.width, H = cv.height, S = res.S, items = res.items; $("pbs-load").style.display = "none";
    const stage = $("pbs-stage"), { vw, vh, k } = viewSize(sh, W, H);
    const img = document.createElement("canvas"); img.width = vw; img.height = vh; img.getContext("2d").drawImage(cv, 0, 0, vw, vh); img.style.cssText = "display:block;background:#fff"; stage.appendChild(img);
    const ov = document.createElement("canvas"); ov.width = vw; ov.height = vh; ov.style.cssText = "position:absolute;left:0;top:0;cursor:pointer"; stage.appendChild(ov);
    const prep = it => { it.v = AIVision.viewMask(S, it, k); const o = AIVision.overlays(it.v, [124, 58, 237]); it.out = o.out; it.fill = o.fill; };
    items.forEach(prep);
    let sel = new Set(), hov = -1, busy = false; const AIF = "alyssum_pbs_aifill";
    const names = () => { const c = {}, n = {}; items.forEach(it => c[it.label] = (c[it.label] || 0) + 1); const out = {}; items.slice().sort((a, b) => a.v.cx - b.v.cx).forEach(it => { n[it.label] = (n[it.label] || 0) + 1; out[it.id] = c[it.label] > 1 ? it.label + " " + n[it.label] : it.label; }); return out; };
    const ex = $("pbs-extra"); let aiFill = false; try { aiFill = !!key && localStorage.getItem(AIF) !== "0"; } catch (e) { aiFill = !!key; }
    ex.innerHTML = `<div id="pbs-list" style="display:flex;flex-wrap:wrap;gap:.35rem"></div><button id="pbs-merge" type="button" style="display:none;border:1.5px solid #7c3aed;background:#fff;color:#7c3aed;border-radius:10px;padding:.4rem;font-weight:700;cursor:pointer;font-family:inherit">🔗 دمج المحدّد في عنصر واحد</button>` +
      (key ? `<label style="font-size:.78rem;display:flex;gap:.4rem;align-items:flex-start;line-height:1.6;cursor:pointer"><input type="checkbox" id="pbs-aifill" ${aiFill ? "checked" : ""}> <span>إعادة رسم الخلفية بـ Gemini بدل النموذج المحلي (يستهلك طلب صورة).</span></label>` : `<div style="font-size:.74rem;color:#8a8472;line-height:1.6">🪄 مكان العناصر في الخلفية يُعاد رسمه بنموذج ذكي داخل متصفحك (بلا مفتاح).</div>`);
    if ($("pbs-aifill")) $("pbs-aifill").onchange = e => { aiFill = e.target.checked; try { localStorage.setItem(AIF, aiFill ? "1" : "0"); } catch (er) { } };
    function list() {
      const nm = names(), on = it => sh.S.mode === "all" || sel.has(it.id);
      const html = items.map(it => `<button type="button" data-id="${it.id}" style="border:1.5px solid #7c3aed;border-radius:999px;padding:.22rem .6rem;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit;background:${on(it) ? "#7c3aed" : "#fff"};color:${on(it) ? "#fff" : "#7c3aed"}">${on(it) ? "✓ " : ""}${esc(nm[it.id])}</button>`).join("");
      $("pbs-merge").style.display = sh.S.mode === "one" && sel.size > 1 ? "block" : "none"; if (html === list.last) return; list.last = html; $("pbs-list").innerHTML = html;      // لا نعيد البناء عند مجرد التمرير
      $("pbs-list").querySelectorAll("button").forEach(b => { b.onclick = () => { const id = +b.dataset.id; if (sh.S.mode === "all") setMode("one"); sel.has(id) ? sel.delete(id) : sel.add(id); paint(); }; b.onmouseenter = () => { hov = +b.dataset.id; paint(); }; b.onmouseleave = () => { hov = -1; paint(); }; });
    }
    function paint() {
      const g = ov.getContext("2d"), mode = sh.S.mode, nm = names(); g.clearRect(0, 0, vw, vh);
      items.forEach(it => { const on = mode === "all" || sel.has(it.id); if (on) g.drawImage(it.fill, it.v.dx, it.v.dy); else if (hov === it.id) { g.globalAlpha = .5; g.drawImage(it.fill, it.v.dx, it.v.dy); g.globalAlpha = 1; } g.drawImage(it.out, it.v.dx, it.v.dy); if (on || hov === it.id) g.drawImage(it.out, it.v.dx, it.v.dy); });
      g.font = "bold 12px Cairo, Tahoma, sans-serif"; g.textBaseline = "middle"; g.textAlign = "center"; g.direction = "rtl"; const boxes = [];
      items.forEach(it => { const on = mode === "all" || sel.has(it.id), t = nm[it.id], tw = g.measureText(t).width + 12, th = 20; let x = Math.max(2, Math.min(vw - tw - 2, it.v.lx - tw / 2)), y = Math.max(2, it.v.ly - th - 4);
        for (let n = 0; n < 8 && boxes.some(b => x < b[0] + b[2] && x + tw > b[0] && y < b[1] + b[3] && y + th > b[1]); n++) y += th + 2; boxes.push([x, y, tw, th]);
        g.fillStyle = on || hov === it.id ? "#7c3aed" : "rgba(255,255,255,.92)"; g.beginPath(); if (g.roundRect) g.roundRect(x, y, tw, th, 10); else g.rect(x, y, tw, th); g.fill(); g.strokeStyle = "#7c3aed"; g.lineWidth = 1; g.stroke(); g.fillStyle = on || hov === it.id ? "#fff" : "#5b21b6"; g.fillText(t, x + tw / 2, y + th / 2 + 1); });
      const n = mode === "all" ? items.length : sel.size; $("pbs-go").disabled = !n || busy; $("pbs-go").textContent = mode === "all" ? "التقاط " + items.length + " عنصراً" : n > 1 ? "التقاط " + n + " عناصر" : "التقاط";
      if (!busy) $("pbs-msg").textContent = items.length ? (mode === "all" ? "سيُلتقط كل العناصر (" + items.length + ") وتبقى الخلفية." : sel.size ? "محدّد: " + [...sel].map(id => nm[id]).join("، ") : "") : "لم أجد عناصر — انقر على أي عنصر في الصورة أو ارسم مستطيلاً حوله لإضافته.";
      list();
    }
    const setMode = m => { const b = sh.host.querySelector('#pbs-seg button[data-m="' + m + '"]'); if (b) b.click(); };
    const pos = e => { const r = ov.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const at = (x, y) => { let best = -1, ba = 1e18; items.forEach(it => { const lx = Math.round(x - it.v.dx), ly = Math.round(y - it.v.dy); if (lx >= 0 && ly >= 0 && lx < it.v.dw && ly < it.v.dh && it.v.a[ly * it.v.dw + lx] && it.area < ba) { ba = it.area; best = it.id; } }); return best; };
    async function add(p, msg) {
      if (busy) return; busy = true; $("pbs-msg").textContent = "⏳ " + msg; paint();
      try { const it = await AIVision.addItem(S, p, items); busy = false; if (!it) { $("pbs-msg").textContent = "لم أجد عنصراً هنا — جرّب النقر في وسطه أو رسم مستطيل حوله."; return paint(); } if (!it.v) prep(it); if (sh.S.mode === "one") sel.add(it.id); hov = -1; paint(); $("pbs-msg").textContent = "✅ أُضيف «" + names()[it.id] + "»."; }
      catch (e) { busy = false; $("pbs-msg").textContent = "⚠️ " + e.message; paint(); }
    }
    let drag = null;
    ov.onmousemove = e => { if (drag) return; const [x, y] = pos(e), h = at(x, y); if (h !== hov) { hov = h; paint(); } };
    ov.onmousedown = e => { const [x, y] = pos(e); drag = { x, y, moved: false }; };
    const mm = ev => { if (!drag || sh.S.closed) return; const [x, y] = pos(ev); if (Math.abs(x - drag.x) + Math.abs(y - drag.y) > 8) drag.moved = true; if (drag.moved) { paint(); const g = ov.getContext("2d"); g.setLineDash([5, 3]); g.strokeStyle = "#16a34a"; g.lineWidth = 2; g.strokeRect(Math.min(drag.x, x), Math.min(drag.y, y), Math.abs(x - drag.x), Math.abs(y - drag.y)); g.setLineDash([]); } };
    const mu = ev => { if (!drag || sh.S.closed) return; const d = drag, [x, y] = pos(ev); drag = null;
      if (d.moved) { const b = [Math.max(0, Math.min(d.x, x) / k), Math.max(0, Math.min(d.y, y) / k), Math.min(W, Math.max(d.x, x) / k), Math.min(H, Math.max(d.y, y) / k)]; if (b[2] - b[0] < 8 || b[3] - b[1] < 8) return paint(); return add({ box: b }, "تحديد العنصر داخل المستطيل…"); }
      const h = at(x, y); if (h >= 0) { if (sh.S.mode === "one") { sel.has(h) ? sel.delete(h) : sel.add(h); paint(); } return; }
      add({ pts: [[x / k, y / k, 1]] }, "تحديد العنصر تحت النقرة…"); };
    window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu); const cl0 = sh.close; sh.close = () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); cl0(); };
    $("pbs-x").onclick = $("pbs-back").onclick = () => sh.close(); bindSeg(sh, () => { sel = new Set(); paint(); });
    $("pbs-merge").onclick = () => { const L = items.filter(it => sel.has(it.id)); if (L.length < 2) return; const it = AIVision.joinItems(S, items, L); prep(it); sel = new Set([it.id]); paint(); $("pbs-msg").textContent = "✅ دُمجت العناصر في «" + names()[it.id] + "»."; };
    $("pbs-msg").style.color = "#173f35"; paint();
    if (res.note) $("pbs-msg").textContent = "ℹ️ تعذّر كشف Gemini (" + res.note.slice(0, 90) + ") — استُعمل الكشف المحلي.";
    $("pbs-go").onclick = async () => {
      const chosen = sh.S.mode === "all" ? items.slice() : items.filter(it => sel.has(it.id)); if (!chosen.length || busy) return; busy = true; $("pbs-go").disabled = true;
      try {
        $("pbs-msg").textContent = "⏳ قصّ العناصر بدقة…"; await new Promise(r => setTimeout(r, 30));
        const nm = names(), cuts = AIVision.cutouts(S, cv, chosen); cuts.forEach(c => c.label = nm[c.item.id] || c.label);
        $("pbs-msg").textContent = aiFill && key ? "⏳ Gemini يعيد رسم الخلفية مكان العناصر…" : "⏳ إعادة رسم الخلفية مكان العناصر…"; await new Promise(r => setTimeout(r, 30));
        const base = document.createElement("canvas"); base.width = W; base.height = H; base.getContext("2d", { willReadFrequently: true }).drawImage(cv, 0, 0); let fillNote = "";
        const gen = aiFill && key && typeof PBGen !== "undefined" && PBGen.gemGenerate ? async parts => PBGen.gemGenerate(key, "image", parts, {}, await PBGen.imageModels(key)) : null;
        const how = await AIVision.eraseBg(base, cuts, { gen, onNote: m => { fillNote = m; }, onStep: m => { $("pbs-msg").textContent = m; } });
        $("pbs-msg").textContent = "⏳ رفع الصور…"; const stamp = Date.now().toString(36);
        const basePath = await A().uploadBlob(await new Promise(r => base.toBlob(r, "image/png")), "bg-" + stamp, { max: 3200, q: .95 }), paths = [];
        for (let i = 0; i < cuts.length; i++) paths.push(await A().uploadBlob(await new Promise(r => cuts[i].canvas.toBlob(r, "image/png")), "el-" + stamp + "-" + i, { max: 2400, q: .92 }));
        const els = cuts.map(c => ({ x0: c.x0, y0: c.y0, x1: c.x0 + c.w, y1: c.y0 + c.h, area: c.px, front: c.front, label: c.label }));
        const n = applyElements(inf, w, W, H, els, paths, basePath); sh.close();
        alert("✅ التُقط " + n + " عنصراً كصور مستقلة قابلة للتحريك: " + els.map(e => e.label).join("، ") + (how === "ai" ? "\n🪄 أعاد Gemini رسم الخلفية مكانها." : how === "model" ? "\n🪄 أُعيد رسم الخلفية مكانها بالنموذج المحلي." : "\nℹ️ رُمِّمت الخلفية مكانها بترميم بسيط" + (fillNote ? " (" + fillNote.slice(0, 80) + ")" : "") + "."));
      } catch (e) { console.error(e); busy = false; $("pbs-msg").textContent = "⚠️ " + e.message; $("pbs-go").disabled = false; }
    };
  }
  /* الكشف البسيط بالحواف (بلا شبكة): للتصاميم ذات الخلفية الناعمة — يُستعمل إن تعذّر تحميل النموذج الذكي */
  function elementsBasic(sh, cv, inf, w, note) {
    const $ = sh.$, W = cv.width, H = cv.height;
    $("pbs-hint").textContent = sh.S.hintOne = "انقر على أحد العناصر المحاطة بالبنفسجي لاختياره (منتج، عشبة، مكوّنات…).";
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
    if (note) $("pbs-msg").textContent = "ℹ️ تعذّر تشغيل الكشف الذكي (" + note.slice(0, 100) + ") — استُعمل الكشف البسيط بالحواف.";
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
  return { pane, capture, captureElements, importImages, warm, setGem };
})();
