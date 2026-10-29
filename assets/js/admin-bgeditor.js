/* محرّر إزالة الخلفية الاحترافي (BgEditor) — داخل محرّر الصور الحالي، بلا واجهة تجريبية منفصلة.
   المبدأ: الصورة الأصلية لا تُعدَّل أبداً؛ كل ما يلي طبقات غير مدمِّرة فوقها:
     قناع المحرّك (base) ← صقل الحواف (إزاحة/تنعيم/حدّة/هالة) ← ضربات الفرشاة (محو/استعادة) ← القناع النهائي (fin) بدقة الصورة الأصلية.
   المحرّكات قابلة للتبديل (registerEngine): SAM2 (كشف + تجزئة محلية على الحاسوب) هو الوحيد.
   التصدير PNG بقناع ألفا حقيقي مع تحقق بفكّ الملف الناتج؛ لا تُرسم الشفافية بالأبيض أبداً (رقعة الشطرنج CSS خلف اللوحة فقط). */
const BgEditor = (() => {
  "use strict";
  const MAX_PX = 24e6, HARD_PX = 64e6, MAX_BYTES = 20 * 1048576, OKTYPE = /^image\/(png|jpe?g|webp)$/;
  const DEF = () => ({ shift: 0, feather: 0, contrast: 0, halo: 0 });
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ───────────── عمليات البكسل النقية (قابلة للاختبار) ───────────── */
  function blurLine(src, dst, off, len, stride, r) {
    const n = 2 * r + 1; let s = 0;
    for (let k = -r; k <= r; k++) s += src[off + Math.min(len - 1, Math.max(0, k)) * stride];
    for (let i = 0; i < len; i++) { dst[off + i * stride] = (s / n + .5) | 0; s += src[off + Math.min(len - 1, i + r + 1) * stride] - src[off + Math.max(0, i - r) * stride]; }
  }
  function blurA(a, W, H, r, passes) {
    r = Math.max(1, r | 0); let cur = a;
    for (let p = 0; p < (passes || 2); p++) {
      const t = new Uint8Array(a.length), o = new Uint8Array(a.length);
      for (let y = 0; y < H; y++) blurLine(cur, t, y * W, W, 1, r);
      for (let x = 0; x < W; x++) blurLine(t, o, x, H, W, r);
      cur = o;
    }
    return cur;
  }
  function morph(a, W, H, r, isMax) {
    const t = new Uint8Array(a.length), o = new Uint8Array(a.length);
    for (let y = 0; y < H; y++) { const row = y * W; for (let x = 0; x < W; x++) { let m = isMax ? 0 : 255; const x0 = Math.max(0, x - r), x1 = Math.min(W - 1, x + r); for (let k = x0; k <= x1; k++) { const v = a[row + k]; if (isMax ? v > m : v < m) m = v; } t[row + x] = m; } }
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) { let m = isMax ? 0 : 255; const y0 = Math.max(0, y - r), y1 = Math.min(H - 1, y + r); for (let k = y0; k <= y1; k++) { const v = t[k * W + x]; if (isMax ? v > m : v < m) m = v; } o[y * W + x] = m; }
    return o;
  }
  /* صقل القناع: إزاحة (تآكل/تمدّد) ← تنعيم ← حدّة الحافة ← قصّ هالة الألفا المنخفضة. يعيد نسخة جديدة دائماً. */
  function refine(base, W, H, p) {
    let a = base;
    if (p.shift) a = morph(a, W, H, Math.min(16, Math.abs(p.shift | 0)), p.shift > 0);
    if (p.feather > 0) a = blurA(a, W, H, Math.round(p.feather), 2);
    if (p.contrast > 0 || p.halo > 0) {
      const k = 1 + (p.contrast || 0) / 12, cut = (p.halo || 0) / 100 * 40, lut = new Uint8Array(256);
      for (let i = 0; i < 256; i++) { let v = clamp((i - 128) * k + 128, 0, 255); if (v < cut) v = 0; lut[i] = v; }
      const o = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) o[i] = lut[a[i]]; a = o;
    }
    return a === base ? base.slice() : a;
  }
  /* تقليل الهالة اللونية: ألوان بكسلات الحافة (ألفا بين 1 و249) تُستبدل بلون الجسم الصلب المجاور (حقل ألوان مصغّر يُنشر للخارج). */
  function decontam(rgba, a, W, H, halo) {
    const out = new Uint8ClampedArray(rgba); if (!(halo > 0)) return out;
    /* المصادر = الجسم الصلب العميق (بعد تآكل r بكسل)، والأهداف = الحافة كلها (ألفا جزئي + الحلقة المعتمة الملاصقة لها حيث تتسرّب ألوان الخلفية) */
    const r0 = Math.max(1, Math.round(1 + halo / 100 * 3)), er = morph(a, W, H, r0, false);
    const f = Math.max(1, Math.ceil(Math.max(W, H) / 768)), w = Math.ceil(W / f), h = Math.ceil(H / f), n = w * h;
    let R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), has = new Uint8Array(n); const Wt = new Float32Array(n);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (er[i] >= 250) { const j = ((y / f) | 0) * w + ((x / f) | 0); R[j] += rgba[i * 4]; G[j] += rgba[i * 4 + 1]; B[j] += rgba[i * 4 + 2]; Wt[j]++; } }
    for (let j = 0; j < n; j++) if (Wt[j] > 0) { R[j] /= Wt[j]; G[j] /= Wt[j]; B[j] /= Wt[j]; has[j] = 1; }
    for (let it = 0; it < 10; it++) {
      const R2 = R.slice(), G2 = G.slice(), B2 = B.slice(), h2 = has.slice(); let any = false;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const j = y * w + x; if (has[j]) continue; let sr = 0, sg = 0, sb = 0, c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const q = yy * w + xx; if (has[q]) { sr += R[q]; sg += G[q]; sb += B[q]; c++; } }
        if (c) { R2[j] = sr / c; G2[j] = sg / c; B2[j] = sb / c; h2[j] = 1; any = true; } }
      R = R2; G = G2; B = B2; has = h2; if (!any) break;
    }
    const m = clamp(halo / 100, 0, 1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (a[i] === 0 || er[i] >= 250) continue;
      const gx = (x + .5) / f - .5, gy = (y + .5) / f - .5, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0; let sr = 0, sg = 0, sb = 0, sw = 0;
      for (let q = 0; q < 4; q++) { const xx = x0 + (q & 1), yy = y0 + (q >> 1); if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = yy * w + xx; if (!has[j]) continue; const wq = ((q & 1) ? fx : 1 - fx) * ((q >> 1) ? fy : 1 - fy); sr += R[j] * wq; sg += G[j] * wq; sb += B[j] * wq; sw += wq; }
      if (sw <= 0) continue; sr /= sw; sg /= sw; sb /= sw;
      out[i * 4] = rgba[i * 4] * (1 - m) + sr * m; out[i * 4 + 1] = rgba[i * 4 + 1] * (1 - m) + sg * m; out[i * 4 + 2] = rgba[i * 4 + 2] * (1 - m) + sb * m;
    }
    return out;
  }
  /* بصمة دائرية ناعمة في مصفوفة تغطية (أقصى قيمة لكل بكسل داخل الضربة الواحدة). تعيد المستطيل المتأثر. */
  function stampDisc(scr, W, H, cx, cy, R, hard, op) {
    const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(H - 1, Math.ceil(cy + R)), inner = clamp(hard, 0, .99);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + .5 - cx, y + .5 - cy) / R; if (d >= 1) continue;
      let t = d <= inner ? 1 : 1 - (d - inner) / (1 - inner); t = t * t * (3 - 2 * t); const v = (t * op * 255 + .5) | 0, i = y * W + x; if (v > scr[i]) scr[i] = v;
    }
    return [x0, y0, x1, y1];
  }
  function stampSeg(scr, W, H, ax, ay, bx, by, R, hard, op) {
    const dist = Math.hypot(bx - ax, by - ay), step = Math.max(1, R * .22), n = Math.max(1, Math.ceil(dist / step)); let bb = null;
    for (let k = 0; k <= n; k++) { const t = k / n, r = stampDisc(scr, W, H, ax + (bx - ax) * t, ay + (by - ay) * t, R, hard, op); bb = bb ? [Math.min(bb[0], r[0]), Math.min(bb[1], r[1]), Math.max(bb[2], r[2]), Math.max(bb[3], r[3])] : r; }
    return bb;
  }
  const lerpTo = (v, t, c) => (v + (t - v) * (c / 255) + .5) | 0;

  /* ───────────── المحرّكات القابلة للتبديل ───────────── */
  const ENGINES = [];
  function registerEngine(e) { const i = ENGINES.findIndex(x => x.id === e.id); if (i >= 0) ENGINES[i] = e; else ENGINES.push(e); }
  const canvasAlpha = (c, W, H) => { let src = c; if (c.width !== W || c.height !== H) { src = document.createElement("canvas"); src.width = W; src.height = H; src.getContext("2d").drawImage(c, 0, 0, W, H); } const d = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data, a = new Uint8Array(W * H); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]; return a; };
  /* المحرّك الوحيد: كشف Gemini + SAM2 داخل المتصفح (الحاسوب فقط) — بلا فوترة خدمة قصّ خارجية */
  const EXT = { state: null };
  async function extProbe() { return true; }
  const samOK = () => { try { return typeof AIVision !== "undefined" && AIVision.supported && AIVision.supported() && typeof PBBgRemove !== "undefined" && !!PBBgRemove.autoCut; } catch (_) { return false; } };
  registerEngine({
    id: "sam", name: "SAM2 — قصّ بالتجزئة", desc: "كشف الموضوع ثم تجزئته داخل متصفحك بحواف دقيقة. ما يتبقى من أشياء بجانبه صحّحه بفرشاة المحو أو الاستعادة.",
    available: samOK,
    run: async (c, o) => {
      if (o && o.onStep) o.onStep("كشف الموضوع وتجزئته…");
      const r = await PBBgRemove.autoCut(c, { sam: true, noPro: true, onStep: o && o.onStep }); return r.canvas;
    }
  });

  /* ───────────── الواجهة والحالة ───────────── */
  let INST = null;
  const CSS = `#bge{position:fixed;inset:0;z-index:10080;background:#060e0a;color:#fff;font-family:inherit;direction:rtl;display:flex;flex-direction:column}
#bge *{box-sizing:border-box}#bge button,#bge select,#bge input{font-family:inherit}
#bge button{width:auto!important;flex:0 0 auto!important;min-height:0!important;margin:0!important;height:auto!important}
#bge .hd{display:flex;align-items:center;gap:.6rem;padding:.55rem .8rem;border-bottom:1px solid rgba(255,255,255,.14);flex-wrap:wrap}
#bge .hd b{font-size:1rem}#bge .sp{flex:1}
#bge .bd{flex:1;display:flex;min-height:0}
#bge .stg{flex:1;position:relative;overflow:hidden;background:#0b1511;touch-action:none;direction:ltr;cursor:crosshair}
#bge .stg.hand{cursor:grab}#bge .stg.pan{cursor:grabbing}
#bge .wr{position:absolute;left:0;top:0;transform-origin:0 0;background:repeating-conic-gradient(#cfcab9 0 25%,#fff 0 50%) 50%/20px 20px}
#bge .wr canvas{display:block;position:absolute;left:0;top:0;width:100%;height:100%;image-rendering:auto}
#bge .wr .bgl{position:absolute;inset:0}
#bge .cmp{position:absolute;top:0;bottom:0;width:0;border-left:2px solid #e2fe17;box-shadow:0 0 8px rgba(226,254,23,.6);display:none;z-index:3}
#bge .cmp i{position:absolute;top:50%;left:-16px;width:32px;height:32px;margin-top:-16px;border-radius:50%;background:rgba(9,24,18,.92);border:2px solid #e2fe17;cursor:ew-resize;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:.8rem}
#bge .cur{position:absolute;pointer-events:none;border:1.5px solid #fff;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.6);display:none;z-index:5;transform:translate(-50%,-50%)}
#bge .side{width:310px;max-width:42vw;overflow:auto;border-right:1px solid rgba(255,255,255,.14);padding:.7rem;display:flex;flex-direction:column;gap:.7rem;direction:rtl;background:rgba(9,24,18,.9)}
#bge .sec{border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:.6rem;background:rgba(255,255,255,.04)}
#bge .sec h4{margin:0 0 .45rem;font-size:.82rem;color:#e2fe17}
#bge label.r{display:flex;align-items:center;gap:.4rem;font-size:.78rem;margin:.3rem 0}
#bge label.r span{width:6.2rem;flex:none;color:rgba(255,255,255,.85)}#bge label.r em{width:2.4rem;text-align:left;font-style:normal;font-size:.72rem;color:rgba(255,255,255,.7)}
#bge input[type=range]{flex:1;min-width:0}
#bge .btn{background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.04)),rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.28);color:#fff;border-radius:11px;padding:.45rem .8rem;font-weight:800;font-size:.8rem;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -2px 4px rgba(0,0,0,.25),0 2px 6px rgba(0,0,0,.25);backdrop-filter:blur(6px);transition:.15s}
#bge .btn:hover{transform:translateY(-2px)}#bge .btn:disabled{opacity:.45;cursor:not-allowed;transform:none}
#bge .btn.g{background:linear-gradient(180deg,rgba(226,254,23,.42),rgba(60,120,20,.35)),rgba(20,70,30,.5);border-color:rgba(226,254,23,.55)}
#bge .btn.o{background:linear-gradient(180deg,rgba(251,146,60,.5),rgba(180,70,10,.35)),rgba(120,50,10,.4);border-color:rgba(251,146,60,.6)}
#bge .btn.r2{background:linear-gradient(180deg,rgba(248,113,113,.5),rgba(150,30,30,.35)),rgba(100,20,20,.4);border-color:rgba(248,113,113,.6)}
#bge .btn.on{outline:2px solid #e2fe17}
#bge .row{display:flex;gap:.4rem;flex-wrap:wrap;align-items:center}
#bge select{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.28);border-radius:9px;padding:.4rem;max-width:100%}#bge select option{color:#000}
#bge .msg{font-size:.78rem;line-height:1.7;min-height:1.6em;color:rgba(255,255,255,.92)}
#bge .pg{height:4px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden;display:none}#bge .pg i{display:block;height:100%;width:40%;background:#e2fe17;animation:bgePg 1.1s linear infinite}
@keyframes bgePg{0%{margin-left:-40%}100%{margin-left:100%}}
#bge .note{font-size:.7rem;color:rgba(255,255,255,.65);line-height:1.6}
#bge .drop{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.7rem;z-index:6;background:#0b1511;direction:rtl}
#bge .drop.dz{outline:3px dashed #e2fe17;outline-offset:-14px}
#bge.dk{inset:0 0 var(--bge-b,64px) 0;z-index:10040}#bge.dk #bge-x,#bge.dk .sec.ex{display:none}
@media(max-width:760px){#bge .bd{flex-direction:column-reverse}#bge .side{width:100%;max-width:none;max-height:46vh;border-right:0;border-top:1px solid rgba(255,255,255,.14)}}`;

  function open(opts) {
    opts = opts || {}; if (INST) INST.close(true);
    if (!document.getElementById("bge-css")) { const st = document.createElement("style"); st.id = "bge-css"; st.textContent = CSS; document.head.appendChild(st); }
    const ov = document.createElement("div"); ov.id = "bge"; if (opts.dock) { ov.classList.add("dk"); const tb = document.getElementById("pbx-tbar"); if (tb) ov.style.setProperty("--bge-b", Math.max(0, innerHeight - tb.getBoundingClientRect().top) + "px"); }
    ov.innerHTML = `<div class="hd"><b>✂️ محرّر إزالة الخلفية</b><span class="msg" id="bge-st" style="flex:1;min-width:140px"></span>
<button class="btn" id="bge-undo" type="button" title="تراجع (Ctrl+Z)" disabled>↶</button><button class="btn" id="bge-redo" type="button" title="إعادة (Ctrl+Shift+Z)" disabled>↷</button><button class="btn r2" id="bge-x" type="button">✕ إغلاق</button></div>
<div class="bd"><div class="stg" id="bge-stg"><div class="wr" id="bge-wr"><div class="bgl" id="bge-bgl"></div><canvas id="bge-cv"></canvas><canvas id="bge-oc" style="display:none"></canvas><div class="cmp" id="bge-cmp"><i>⇆</i></div></div><div class="cur" id="bge-cur"></div>
<div class="drop" id="bge-drop"><div style="font-weight:800">اسحب صورة هنا أو اختر ملفاً</div><button class="btn g" id="bge-pick" type="button">📁 اختيار صورة</button><div class="note">PNG أو JPEG أو WebP — حتى 20MB. تُعالج بدقتها الأصلية.</div><input type="file" id="bge-file" accept="image/png,image/jpeg,image/webp" hidden></div></div>
<div class="side">
<div class="sec"><h4>① إزالة الخلفية</h4><select id="bge-eng" style="display:none"></select><div class="note" id="bge-engd" style="margin:.35rem 0;display:none"></div><div class="row"><button class="btn g" id="bge-go" type="button" disabled>✂️ إزالة الخلفية</button><button class="btn" id="bge-reset" type="button" disabled title="يعيد الصورة الأصلية كما هي ويمسح كل التعديلات">↺ إعادة للأصل</button></div><div class="pg" id="bge-pg" style="margin-top:.5rem"><i></i></div></div>
<div class="sec"><h4>② تصحيح القناع</h4><div class="row"><button class="btn on" id="bge-t-e" type="button" data-tool="erase" disabled>🧽 محو (E)</button><button class="btn" id="bge-t-r" type="button" data-tool="restore" disabled>🖌 استعادة (R)</button><button class="btn" id="bge-t-h" type="button" data-tool="hand" disabled>✋ تحريك (H)</button></div>
<label class="r"><span>حجم الفرشاة</span><input type="range" id="bge-sz" min="2" max="400" value="40"><em id="bge-szv">40</em></label>
<label class="r"><span>نعومة الحافة</span><input type="range" id="bge-sf" min="0" max="100" value="40"><em id="bge-sfv">40</em></label>
<label class="r"><span>الشدّة</span><input type="range" id="bge-op" min="5" max="100" value="100"><em id="bge-opv">100</em></label>
<div class="row"><button class="btn" id="bge-zo" type="button" disabled>－</button><button class="btn" id="bge-fit" type="button" disabled>⤢ ملاءمة</button><button class="btn" id="bge-zi" type="button" disabled>＋</button><button class="btn" id="bge-cmpb" type="button" disabled>◐ قبل/بعد (B)</button></div></div>
<div class="sec"><h4>③ صقل الحواف</h4>
<label class="r"><span>إزاحة الحافة</span><input type="range" id="bge-p-shift" min="-12" max="12" value="0"><em></em></label>
<label class="r"><span>تنعيم</span><input type="range" id="bge-p-feather" min="0" max="12" value="0"><em></em></label>
<label class="r"><span>حدّة الحافة</span><input type="range" id="bge-p-contrast" min="0" max="100" value="0"><em></em></label>
<label class="r"><span>تقليل الهالة</span><input type="range" id="bge-p-halo" min="0" max="100" value="0"><em></em></label>
<div class="note">الإزاحة السالبة تأكل الحافة والموجبة توسّعها. تقليل الهالة يستبدل ألوان بكسلات الحافة بلون الجسم المجاور ويقصّ الألفا الضعيف جداً.</div></div>
<div class="sec"><h4>④ الخلفية</h4><div class="row"><label class="r" style="margin:0"><input type="radio" name="bge-bg" value="none" checked> شفافة</label><label class="r" style="margin:0"><input type="radio" name="bge-bg" value="color"> لون</label><input type="color" id="bge-bgc" value="#ffffff" style="width:2.2rem;height:1.8rem;padding:0;border:0;background:none"><label class="r" style="margin:0"><input type="radio" name="bge-bg" value="img"> صورة</label><button class="btn" id="bge-bgi" type="button">📁</button><input type="file" id="bge-bgf" accept="image/png,image/jpeg,image/webp" hidden></div></div>
<div class="sec ex"><h4>⑤ التصدير</h4><div class="row"><button class="btn g" id="bge-dl" type="button" disabled>⬇ تنزيل PNG</button><button class="btn o" id="bge-ap" type="button" disabled style="display:none">✔ تطبيق على الصورة</button></div><div class="msg" id="bge-ver" style="margin-top:.4rem"></div></div>
</div></div>`;
    document.body.appendChild(ov);
    const $ = i => ov.querySelector("#" + i), stg = $("bge-stg"), wr = $("bge-wr"), cv = $("bge-cv"), oc = $("bge-oc"), cur = $("bge-cur"), cmp = $("bge-cmp");
    const S = { W: 0, H: 0, name: opts.name || "image", orig: null, origC: null, base0: null, base: null, bid: 0, params: DEF(), strokes: [], fbKey: "", fbase: null, rgba: null, out: null, fin: null, scr: null,
      hist: [], hi: -1, tool: "erase", z: 1, fit: 1, tx: 0, ty: 0, busy: false, token: 0, stk: null, pan: null, cmpOn: false, cmpP: 50, bg: { mode: "none", color: "#ffffff", img: null, url: "" }, dirty: false, pBefore: null, eng: "ext", space: false };
    const say = t => { $("bge-st").textContent = t || ""; }, busy = on => { $("bge-pg").style.display = on ? "block" : "none"; };

    /* —— التاريخ: لقطات خفيفة (المصفوفات تُحفظ بالمرجع ولا تُعدَّل) —— */
    const snap = () => ({ base: S.base, bid: S.bid, strokes: S.strokes.slice(), params: Object.assign({}, S.params) });
    const setSnap = s => { S.base = s.base; S.bid = s.bid; S.strokes = s.strokes.slice(); S.params = Object.assign({}, s.params); };
    const syncUI = () => { $("bge-undo").disabled = S.hi < 0; $("bge-redo").disabled = S.hi >= S.hist.length - 1; ["shift", "feather", "contrast", "halo"].forEach(k => { const r = $("bge-p-" + k); r.value = S.params[k]; r.nextElementSibling.textContent = S.params[k]; }); };
    const commit = before => { S.hist.length = S.hi + 1; S.hist.push({ a: before, b: snap() }); S.hi = S.hist.length - 1; S.dirty = true; syncUI(); };
    const undo = () => { if (S.busy || S.hi < 0) return; setSnap(S.hist[S.hi].a); S.hi--; rebuild(); syncUI(); };
    const redo = () => { if (S.busy || S.hi >= S.hist.length - 1) return; S.hi++; setSnap(S.hist[S.hi].b); rebuild(); syncUI(); };

    /* —— خط المعالجة: base → refine → ضربات → fin → لوحة —— */
    function rebuild() {
      if (!S.W) return; const p = S.params, key = S.bid + "|" + p.shift + "|" + p.feather + "|" + p.contrast + "|" + p.halo;
      if (key !== S.fbKey) { S.fbase = S.base ? refine(S.base, S.W, S.H, p) : new Uint8Array(S.W * S.H).fill(255); S.fbKey = key; S.rgba = null; }
      if (!S.rgba) { S.rgba = p.halo > 0 ? decontam(S.orig, S.fbase, S.W, S.H, p.halo) : S.orig; S.out = null; }
      const fin = S.fbase.slice(); for (const s of S.strokes) { const t = s.m === "r" ? 255 : 0; for (let y = 0; y < s.h; y++) { let i = (s.y0 + y) * S.W + s.x0, j = y * s.w; for (let x = 0; x < s.w; x++, i++, j++) { const c = s.cov[j]; if (c) fin[i] = lerpTo(fin[i], t, c); } } }
      S.fin = fin; paint(0, 0, S.W - 1, S.H - 1); updateButtons();
    }
    function paint(x0, y0, x1, y1) {
      const W = S.W;
      if (!S.out) { S.out = new ImageData(new Uint8ClampedArray(S.rgba), W, S.H); S.outSrc = S.rgba; } else if (S.outSrc !== S.rgba) { S.out.data.set(S.rgba); S.outSrc = S.rgba; }
      const d = S.out.data, f = S.fin;
      for (let y = y0; y <= y1; y++) { let i = y * W + x0; for (let x = x0; x <= x1; x++, i++) d[i * 4 + 3] = f[i]; }
      cv.getContext("2d").putImageData(S.out, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    }
    function updateButtons() { const has = !!S.W; ["bge-go", "bge-reset", "bge-t-e", "bge-t-r", "bge-t-h", "bge-zo", "bge-zi", "bge-fit", "bge-cmpb", "bge-dl"].forEach(i => { $(i).disabled = !has || S.busy; }); $("bge-ap").disabled = !has || S.busy; }
    function relayout() {
      if (!S.W) return; const r = stg.getBoundingClientRect(); S.fit = Math.min((r.width - 24) / S.W, (r.height - 24) / S.H, 1); if (!(S.fit > 0)) S.fit = 1;
      view();
    }
    function view() { const k = S.fit * S.z; wr.style.width = S.W + "px"; wr.style.height = S.H + "px"; wr.style.transform = `translate(${S.tx}px,${S.ty}px) scale(${k})`; const sz = +$("bge-sz").value; cur.style.width = cur.style.height = Math.max(4, sz * k) + "px"; }
    function fitView() { S.z = 1; const r = stg.getBoundingClientRect(), k = S.fit; S.tx = (r.width - S.W * k) / 2; S.ty = (r.height - S.H * k) / 2; view(); }
    function zoomAt(f, cx, cy) { const k0 = S.fit * S.z, z1 = clamp(S.z * f, .2, 24), k1 = S.fit * z1; S.tx = cx - (cx - S.tx) * (k1 / k0); S.ty = cy - (cy - S.ty) * (k1 / k0); S.z = z1; view(); }
    const setBgPreview = () => { const b = S.bg, el = $("bge-bgl"); if (b.mode === "none" || (b.mode === "img" && !b.url)) { el.style.background = "transparent"; wr.style.backgroundImage = ""; } else { wr.style.backgroundImage = "none"; el.style.background = b.mode === "color" ? b.color : `url(${b.url}) center/cover no-repeat`; } };

    /* —— تحميل الصورة: تحقق من النوع/الحجم/الأبعاد، والأصل لا يُعدَّل —— */
    async function magicOK(file) { const u = new Uint8Array(await file.slice(0, 12).arrayBuffer()), s = String.fromCharCode(...u); return (u[0] === 0x89 && s.slice(1, 4) === "PNG") || (u[0] === 0xFF && u[1] === 0xD8 && u[2] === 0xFF) || (s.slice(0, 4) === "RIFF" && s.slice(8, 12) === "WEBP"); }
    async function loadFile(file) {
      try {
        if (!file) return; if (!OKTYPE.test(file.type || "")) throw new Error("نوع الملف غير مدعوم — PNG أو JPEG أو WebP فقط");
        if (file.size > MAX_BYTES) throw new Error("الملف أكبر من 20MB"); if (!(await magicOK(file))) throw new Error("محتوى الملف لا يطابق نوع الصورة");
        const bmp = await createImageBitmap(file); let w = bmp.width, h = bmp.height;
        if (w * h > HARD_PX) throw new Error("أبعاد الصورة كبيرة جداً (" + w + "×" + h + ")");
        const c = document.createElement("canvas");
        if (w * h > MAX_PX) { if (!confirm("الصورة كبيرة (" + w + "×" + h + "). للتحرير الآمن يلزم تصغيرها إلى ≈24 ميغابكسل. تصغير؟")) return; const k = Math.sqrt(MAX_PX / (w * h)); w = Math.floor(w * k); h = Math.floor(h * k); }
        c.width = w; c.height = h; c.getContext("2d").drawImage(bmp, 0, 0, w, h); if (!opts.name) S.name = (file.name || "image").replace(/\.[^.]+$/, ""); loadCanvas(c);
      } catch (e) { say("⚠️ " + (e.message || e)); }
    }
    function loadCanvas(c) {
      if (c.width * c.height > MAX_PX) { say("⚠️ الصورة أكبر من 24 ميغابكسل"); return; }
      S.W = c.width; S.H = c.height; S.origC = document.createElement("canvas"); S.origC.width = S.W; S.origC.height = S.H; S.origC.getContext("2d").drawImage(c, 0, 0);
      S.orig = new Uint8ClampedArray(S.origC.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, S.W, S.H).data); let tr = 0; const a = new Uint8Array(S.W * S.H); for (let i = 0; i < a.length; i++) { a[i] = S.orig[i * 4 + 3]; if (a[i] < 250) tr++; }
      S.base0 = tr > a.length * .002 ? a : null; S.base = S.base0; S.bid++; S.params = DEF(); S.strokes = []; S.hist = []; S.hi = -1; S.fbKey = ""; S.rgba = null; S.out = null; S.scr = new Uint8Array(S.W * S.H); S.dirty = false;
      cv.width = S.W; cv.height = S.H; oc.width = S.W; oc.height = S.H; oc.getContext("2d").drawImage(S.origC, 0, 0); $("bge-drop").style.display = "none"; rebuild(); relayout(); fitView(); syncUI();
      say(S.base0 ? "صورة بقناع شفاف موجود — يمكنك تصحيحه بالفرشاة" : "جاهزة — اضغط «إزالة الخلفية»"); $("bge-ver").textContent = "";
    }

    /* —— تشغيل المحرّك —— */
    async function runEngine() {
      if (S.busy || !S.W) return; const eng = ENGINES.find(e => e.id === $("bge-eng").value); if (!eng) return; const my = ++S.token; S.busy = true; busy(true); updateButtons(); say("⏳ جارٍ إزالة الخلفية…");
      try {
        const res = await eng.run(S.origC, { onStep: m => { if (my === S.token) say(m); } }); if (my !== S.token) return;
        const a = canvasAlpha(res, S.W, S.H); let tr = 0; for (let i = 0; i < a.length; i++) if (a[i] < 250) tr++; const cov = tr / a.length;
        if (cov < .002 || cov > .995) throw new Error("نتيجة غير معقولة (الشفاف " + Math.round(cov * 100) + "%) — جرّب محرّكاً آخر أو الفرشاة");
        const before = snap(); S.base = a; S.bid++; S.strokes = []; commit(before); rebuild(); say("✅ تمّت الإزالة (" + eng.name + ") — صحّح الحواف بالفرشاة إن لزم");
      } catch (e) { if (my === S.token) say("⚠️ " + (e && e.message || e)); console.warn("BgEditor", e); }
      if (my === S.token) { S.busy = false; busy(false); updateButtons(); }
    }
    function resetAll() { if (S.busy || !S.W) return; if (S.dirty && !confirm("إعادة الصورة إلى الأصل؟ (يمكن التراجع بـ↶)")) return; const before = snap(); S.base = S.base0; S.bid++; S.params = DEF(); S.strokes = []; commit(before); rebuild(); say("أُعيدت الصورة الأصلية"); }

    /* —— الفرشاة —— */
    const imgPt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * S.W / r.width, (e.clientY - r.top) * S.H / r.height]; };
    const brush = () => ({ R: +$("bge-sz").value / 2, hard: 1 - (+$("bge-sf").value) / 100, op: +$("bge-op").value / 100 });
    function strokeStart(e) {
      const b = brush(), [x, y] = imgPt(e); S.stk = { m: S.tool === "restore" ? "r" : "e", b, fin0: S.fin.slice(), last: [x, y], bb: [S.W, S.H, -1, -1], before: snap() };
      strokeMove(e, true);
    }
    function strokeMove(e, first) {
      const k = S.stk; if (!k) return; const [x, y] = imgPt(e), [lx, ly] = first ? [x, y] : k.last, r = stampSeg(S.scr, S.W, S.H, lx, ly, x, y, k.b.R, k.b.hard, k.b.op); k.last = [x, y];
      k.bb = [Math.min(k.bb[0], r[0]), Math.min(k.bb[1], r[1]), Math.max(k.bb[2], r[2]), Math.max(k.bb[3], r[3])];
      const t = k.m === "r" ? 255 : 0, W = S.W; for (let yy = r[1]; yy <= r[3]; yy++) { let i = yy * W + r[0]; for (let xx = r[0]; xx <= r[2]; xx++, i++) { const c = S.scr[i]; if (c) S.fin[i] = lerpTo(k.fin0[i], t, c); } }
      paint(r[0], r[1], r[2], r[3]);
    }
    function strokeEnd() {
      const k = S.stk; if (!k) return; S.stk = null; const [x0, y0, x1, y1] = k.bb; if (x1 < x0) return; const w = x1 - x0 + 1, h = y1 - y0 + 1, cov = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y0 + y) * S.W + x0 + x; cov[y * w + x] = S.scr[i]; S.scr[i] = 0; }
      S.strokes.push({ m: k.m, x0, y0, w, h, cov }); commit(k.before);
    }

    /* —— التصدير والتحقق —— */
    function composeCanvas(withBg) {
      const c = document.createElement("canvas"); c.width = S.W; c.height = S.H; const g = c.getContext("2d");
      if (withBg && S.bg.mode === "color") { g.fillStyle = S.bg.color; g.fillRect(0, 0, S.W, S.H); }
      else if (withBg && S.bg.mode === "img" && S.bg.img) { const im = S.bg.img, k = Math.max(S.W / im.width, S.H / im.height), dw = im.width * k, dh = im.height * k; g.drawImage(im, (S.W - dw) / 2, (S.H - dh) / 2, dw, dh); }
      g.drawImage(cv, 0, 0); return c;
    }
    async function exportBlob() {
      const withBg = S.bg.mode !== "none" && !(S.bg.mode === "img" && !S.bg.img), c = composeCanvas(withBg), blob = await new Promise(r => c.toBlob(r, "image/png"));
      const v = await verify(blob, withBg); return { blob, v, withBg };
    }
    async function verify(blob, withBg) {
      try {
        const bmp = await createImageBitmap(blob), t = document.createElement("canvas"); t.width = bmp.width; t.height = bmp.height; const g = t.getContext("2d", { willReadFrequently: true }); g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, t.width, t.height).data;
        if (blob.type !== "image/png") return { ok: false, msg: "⚠️ الملف الناتج ليس PNG" }; if (t.width !== S.W || t.height !== S.H) return { ok: false, msg: "⚠️ أبعاد الناتج تختلف عن الأصل" };
        let zero = 0, part = 0, maxd = 0; for (let i = 0; i < S.fin.length; i++) { const a = d[i * 4 + 3]; if (a === 0) zero++; else if (a < 255) part++; if (!withBg) { const df = Math.abs(a - S.fin[i]); if (df > maxd) maxd = df; } }
        if (withBg) return { ok: true, msg: "✓ PNG " + S.W + "×" + S.H + " بخلفية مدمجة (بلا شفافية)" };
        const pct = Math.round((zero + part) / S.fin.length * 100);
        if (maxd > 2) return { ok: false, msg: "⚠️ فشل التحقق: الألفا في الملف يخالف القناع (فرق " + maxd + ")" };
        if (zero + part === 0) return { ok: true, msg: "⚠️ الملف PNG سليم لكن لا توجد شفافية (لم تُزَل خلفية بعد)" };
        return { ok: true, msg: "✓ تم التحقق: PNG حقيقي بقناع ألفا · " + S.W + "×" + S.H + " · شفاف أو جزئي " + pct + "% · أقصى فرق " + maxd };
      } catch (e) { return { ok: false, msg: "⚠️ تعذّر التحقق من الملف: " + (e.message || e) }; }
    }
    async function download() {
      if (S.busy) return; S.busy = true; updateButtons(); say("⏳ تجهيز PNG…");
      try { const { blob, v } = await exportBlob(); $("bge-ver").textContent = v.msg; if (!v.ok) { say("⚠️ لم يُنزَّل الملف"); S.busy = false; updateButtons(); return; }
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "nobg-" + S.name.replace(/[^\w؀-ۿ-]+/g, "_") + ".png"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); say("✅ نُزِّل الملف"); }
      catch (e) { say("⚠️ " + (e.message || e)); } S.busy = false; updateButtons();
    }
    async function apply(keep) {
      if (S.busy || typeof opts.onApply !== "function") return; S.busy = true; updateButtons(); say("⏳ تطبيق على الصورة…");
      try { const { blob, v } = await exportBlob(); $("bge-ver").textContent = v.msg; if (!v.ok) throw new Error("فشل التحقق من الملف الناتج"); await opts.onApply(blob, { w: S.W, h: S.H, name: S.name }); S.dirty = false; if (keep === true) { S.busy = false; updateButtons(); say("✅ طُبِّق على الصورة"); return true; } close(true); return; }
      catch (e) { say("⚠️ " + (e.message || e)); } S.busy = false; updateButtons();
    }

    /* —— الأحداث —— */
    const setTool = t => { S.tool = t; ov.querySelectorAll("[data-tool]").forEach(b => b.classList.toggle("on", b.dataset.tool === t)); stg.classList.toggle("hand", t === "hand"); };
    ov.querySelectorAll("[data-tool]").forEach(b => { b.onclick = () => setTool(b.dataset.tool); });
    stg.addEventListener("pointerdown", e => {
      if (!S.W || e.target.closest(".cmp") || e.target.closest(".drop")) return;
      if (e.button === 1 || e.button === 2 || S.tool === "hand" || S.space) { S.pan = { x: e.clientX, y: e.clientY, tx: S.tx, ty: S.ty }; stg.classList.add("pan"); stg.setPointerCapture(e.pointerId); e.preventDefault(); return; }
      if (e.button !== 0 || S.busy) return; stg.setPointerCapture(e.pointerId); strokeStart(e); e.preventDefault();
    });
    stg.addEventListener("pointermove", e => {
      const r = stg.getBoundingClientRect(); cur.style.left = (e.clientX - r.left) + "px"; cur.style.top = (e.clientY - r.top) + "px"; cur.style.display = S.W && S.tool !== "hand" && !S.pan ? "block" : "none";
      if (S.pan) { S.tx = S.pan.tx + e.clientX - S.pan.x; S.ty = S.pan.ty + e.clientY - S.pan.y; view(); } else if (S.stk) strokeMove(e);
    });
    const up = () => { if (S.pan) { S.pan = null; stg.classList.remove("pan"); } if (S.stk) strokeEnd(); };
    stg.addEventListener("pointerup", up); stg.addEventListener("pointercancel", up); stg.addEventListener("pointerleave", () => { cur.style.display = "none"; });
    stg.addEventListener("contextmenu", e => e.preventDefault());
    stg.addEventListener("wheel", e => { if (!S.W) return; e.preventDefault(); const r = stg.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    $("bge-zi").onclick = () => { const r = stg.getBoundingClientRect(); zoomAt(1.3, r.width / 2, r.height / 2); }; $("bge-zo").onclick = () => { const r = stg.getBoundingClientRect(); zoomAt(1 / 1.3, r.width / 2, r.height / 2); }; $("bge-fit").onclick = () => { relayout(); fitView(); };
    ["sz", "sf", "op"].forEach(k => { $("bge-" + k).oninput = () => { $("bge-" + k + "v").textContent = $("bge-" + k).value; view(); }; });
    /* مقارنة قبل/بعد: الأصل يسار الخط والنتيجة يمينه، والمقبض يُسحب */
    const cmpUpdate = () => { cmp.style.display = S.cmpOn ? "block" : "none"; oc.style.display = S.cmpOn ? "block" : "none"; cmp.style.left = S.cmpP + "%"; oc.style.clipPath = `inset(0 ${100 - S.cmpP}% 0 0)`; $("bge-cmpb").classList.toggle("on", S.cmpOn); };
    const toggleCmp = () => { if (!S.W) return; S.cmpOn = !S.cmpOn; cmpUpdate(); };
    $("bge-cmpb").onclick = toggleCmp;
    cmp.addEventListener("pointerdown", e => { e.stopPropagation(); cmp.setPointerCapture(e.pointerId); cmp._d = true; });
    cmp.addEventListener("pointermove", e => { if (!cmp._d) return; const r = wr.getBoundingClientRect(); S.cmpP = clamp((e.clientX - r.left) / r.width * 100, 0, 100); cmpUpdate(); });
    cmp.addEventListener("pointerup", () => { cmp._d = false; });
    /* الصقل: معاينة فورية (تأجيل 90ms)، والتاريخ عند ترك المنزلق */
    let tmr = 0;
    ["shift", "feather", "contrast", "halo"].forEach(k => { const r = $("bge-p-" + k);
      r.oninput = () => { if (!S.pBefore) S.pBefore = snap(); S.params[k] = +r.value; r.nextElementSibling.textContent = r.value; clearTimeout(tmr); tmr = setTimeout(rebuild, 90); };
      r.onchange = () => { clearTimeout(tmr); rebuild(); if (S.pBefore) { const b = S.pBefore; S.pBefore = null; commit(b); } }; });
    /* الخلفية البديلة */
    ov.querySelectorAll('input[name="bge-bg"]').forEach(r => { r.onchange = () => { S.bg.mode = r.value; if (r.value === "img" && !S.bg.img) $("bge-bgf").click(); setBgPreview(); }; });
    $("bge-bgc").oninput = () => { S.bg.color = $("bge-bgc").value; ov.querySelector('input[name="bge-bg"][value="color"]').checked = true; S.bg.mode = "color"; setBgPreview(); };
    $("bge-bgi").onclick = () => $("bge-bgf").click();
    $("bge-bgf").onchange = async () => { const f = $("bge-bgf").files[0]; $("bge-bgf").value = ""; if (!f) return; try { if (!OKTYPE.test(f.type) || f.size > 15 * 1048576 || !(await magicOK(f))) throw new Error("صورة خلفية غير صالحة (PNG/JPEG/WebP حتى 15MB)"); const bmp = await createImageBitmap(f); S.bg.img = bmp; if (S.bg.url) URL.revokeObjectURL(S.bg.url); S.bg.url = URL.createObjectURL(f); S.bg.mode = "img"; ov.querySelector('input[name="bge-bg"][value="img"]').checked = true; setBgPreview(); } catch (e) { say("⚠️ " + e.message); } };
    /* ملف المصدر */
    $("bge-pick").onclick = () => $("bge-file").click(); $("bge-file").onchange = () => { const f = $("bge-file").files[0]; $("bge-file").value = ""; loadFile(f); };
    const dr = $("bge-drop"); ["dragenter", "dragover"].forEach(ev => dr.addEventListener(ev, e => { e.preventDefault(); dr.classList.add("dz"); })); ["dragleave", "drop"].forEach(ev => dr.addEventListener(ev, e => { e.preventDefault(); dr.classList.remove("dz"); })); dr.addEventListener("drop", e => loadFile(e.dataTransfer && e.dataTransfer.files[0]));
    $("bge-go").onclick = runEngine; $("bge-reset").onclick = resetAll; $("bge-undo").onclick = undo; $("bge-redo").onclick = redo; $("bge-dl").onclick = download; $("bge-ap").onclick = () => apply();
    if (typeof opts.onApply === "function") $("bge-ap").style.display = "";
    const close = force => { if (!force && S.dirty && !confirm("إغلاق المحرّر وفقدان التعديلات غير المطبّقة؟")) return; S.token++; document.removeEventListener("keydown", onKey, true); document.removeEventListener("keyup", onKeyUp, true); window.removeEventListener("resize", relayout); if (S.bg.url) URL.revokeObjectURL(S.bg.url); ov.remove(); if (INST && INST.ov === ov) INST = null; };
    $("bge-x").onclick = () => close(false);
    const onKey = e => {
      if (!document.body.contains(ov)) return; const tg = e.target && e.target.tagName; if (tg === "INPUT" && e.target.type !== "range" && e.target.type !== "radio" && e.target.type !== "color") return;
      e.stopPropagation(); const k = String(e.key||"").toLowerCase(); if (e.key === "Escape") { if (!opts.dock) close(false); return; }
      if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; } if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); redo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Space") { S.space = true; e.preventDefault(); return; }
      if (k === "e") setTool("erase"); else if (k === "r") setTool("restore"); else if (k === "h") setTool("hand"); else if (k === "b") toggleCmp();
      else if (k === "[") { const s = $("bge-sz"); s.value = Math.max(2, +s.value - 6); s.oninput(); } else if (k === "]") { const s = $("bge-sz"); s.value = Math.min(400, +s.value + 6); s.oninput(); }
    };
    const onKeyUp = e => { if (e.code === "Space") S.space = false; };
    document.addEventListener("keydown", onKey, true); document.addEventListener("keyup", onKeyUp, true); window.addEventListener("resize", relayout);

    /* —— قائمة المحرّكات (المتاحة فقط؛ لا أزرار ميتة) —— */
    const fillEngines = () => {
      const sel = $("bge-eng"), keep = sel.value; sel.innerHTML = ""; ENGINES.filter(e => { try { return e.available(); } catch (_) { return false; } }).forEach(e => { const o = document.createElement("option"); o.value = e.id; o.textContent = e.name; sel.appendChild(o); });
      if (!sel.options.length) { const o = document.createElement("option"); o.value = ""; o.textContent = "لا يوجد محرّك متاح"; sel.appendChild(o); }
      if ([...sel.options].some(o => o.value === keep)) sel.value = keep; else if ([...sel.options].some(o => o.value === (opts.engine || ""))) sel.value = opts.engine; descr();
    };
    const descr = () => { const e = ENGINES.find(x => x.id === $("bge-eng").value); $("bge-engd").textContent = e ? "" : "خدمة نزع الخلفية غير مفعّلة على الخادم — راجع الدعم."; $("bge-engd").style.display = e ? "none" : ""; $("bge-go").disabled = !S.W || S.busy || !e; };
    $("bge-eng").onchange = descr; fillEngines(); extProbe().then(() => { if (document.body.contains(ov)) fillEngines(); });

    const flush = async () => { if (!S.W || S.busy || !S.dirty) return true; return !!(await apply(true)); };
    INST = { ov, close, S, flush, loadCanvas, loadFile, runEngine, undo, redo, rebuild, exportBlob, download, apply, setTool, strokeStart, strokeMove, strokeEnd, commit, snap, resetAll };
    if (opts.canvas) loadCanvas(opts.canvas); else if (opts.blob) loadFile(opts.blob); else if (opts.src) { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d").drawImage(im, 0, 0); loadCanvas(c); }; im.onerror = () => say("⚠️ تعذّر تحميل الصورة"); im.src = opts.src; }
    return INST;
  }
  return { open, registerEngine, engines: () => ENGINES.slice(), inst: () => INST, _t: { refine, decontam, blurA, morph, stampDisc, stampSeg, extProbe, extReset: () => { EXT.state = null; } } };
})();
