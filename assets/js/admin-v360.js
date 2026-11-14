/* عرض 360° (ستوديو ديزاين): معاينة تفاعلية داخل الأداة نفسها قبل أي فتح في مطوّر الصفحات — سحب للتدوير، دوران تلقائي، التحكم ببُعد الكاميرا (حجم المنتج داخل الإطار)،
   السرعة والاتجاه والخلفية ومقاس منصة التواصل — مع تنزيل بكل الخيارات: فيديو دوران (WebM/MP4 إن دعمه المتصفح)، إطارات ZIP (PNG/WebP/JPG بالمقاس والخلفية المختارين)،
   الإطار الحالي، شريط إطارات (Sprite)، وعارض HTML مستقل بملف واحد يدور بالسحب؛ ويبقى «فتح في مطوّر الصفحات» (بالإعدادات نفسها).
   كله محلي ومجاني (بلا رصيد). الاستعمال: V360.open(files[]) — الاختبار: scripts/test-v360.js */
const V360 = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const FALLBACK = [{ id: "1:1", w: 1080, h: 1080, label: "1:1 — 1080×1080" }, { id: "4:5", w: 1080, h: 1350, label: "4:5 — 1080×1350" }, { id: "9:16", w: 1080, h: 1920, label: "9:16 — 1080×1920" }, { id: "16:9", w: 1920, h: 1080, label: "16:9 — 1920×1080" }];
  const fmts = () => (typeof ImgGen !== "undefined" && ImgGen.videoFormats) ? ImgGen.videoFormats() : FALLBACK;
  const fmtOf = id => fmts().find(f => f.id === id) || fmts()[0];
  const S = { files: [], bms: [], p: 0, auto: true, ms: 450, inv: false, zoom: 80, bg: "#ffffff", tr: false, fmt: "1:1", smooth: false, turns: 2, busy: false, raf: 0, last: 0, drag: null, msg: "", resume: 0 };
  let bg = null;
  const CSS = `#v3-bg{position:fixed;inset:0;z-index:100020;background:rgba(0,0,0,.82);display:grid;place-items:center;padding:10px}
#v3-box{width:min(940px,100%);max-height:96vh;overflow:auto;background:rgba(9,24,18,.99);border:1px solid rgba(255,255,255,.22);border-radius:20px;padding:1rem 1.1rem;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.6)}
#v3-box .v3-h{display:flex;align-items:center;gap:.7rem;margin-bottom:.7rem}#v3-box .v3-h b{font-size:1.15rem}#v3-box .v3-h small{opacity:.8}#v3-box .v3-x{margin-inline-start:auto;background:none;border:0;color:#fff;font-size:1.3rem;cursor:pointer}
#v3-box .v3-m{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:1rem;align-items:start}@media(max-width:720px){#v3-box .v3-m{grid-template-columns:1fr}}
#v3-box .v3-st{position:relative;border-radius:14px;overflow:hidden;background:repeating-conic-gradient(#ffffff14 0 25%,#ffffff08 0 50%) 0 0/18px 18px;display:grid;place-items:center;touch-action:pan-y;cursor:grab;max-height:62vh}
#v3-box .v3-st canvas{display:block;max-width:100%;max-height:62vh;width:auto;height:auto;user-select:none}#v3-box .v3-st:active{cursor:grabbing}
#v3-box .v3-fr{position:absolute;top:8px;left:50%;transform:translateX(-50%);background:#173f35;color:#fff;font-weight:800;font-size:.85rem;border-radius:999px;padding:.15rem .8rem;white-space:nowrap;pointer-events:none}
#v3-box .v3-ctl{display:grid;gap:.55rem}#v3-box .v3-ctl label{display:grid;gap:.15rem;font-weight:800;font-size:.88rem}#v3-box .v3-ctl label span{display:flex;justify-content:space-between;gap:.5rem}#v3-box .v3-ctl small{font-weight:400;opacity:.8}
#v3-box input[type=range]{width:100%;accent-color:#e2fe17}#v3-box select,#v3-box input[type=color]{width:100%;padding:.45rem;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.2);font-family:inherit}#v3-box select option{color:#000}#v3-box input[type=color]{-webkit-appearance:auto;appearance:auto;display:block;padding:2px;height:40px;min-height:40px;border:1.5px solid rgba(255,255,255,.45);cursor:pointer}
#v3-box .v3-ctl label.v3-ck{display:flex;gap:.55rem;align-items:center;font-weight:700;font-size:.88rem}#v3-box .v3-ck input{width:18px;height:18px;flex:none;margin:0}
#v3-box .v3-dl{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.45rem;margin-top:.5rem}
#v3-box .v3-b{border:1px solid rgba(255,255,255,.28);color:#fff;border-radius:12px;padding:.55rem .8rem;font-weight:800;cursor:pointer;font-family:inherit;background:rgba(255,255,255,.1)}#v3-box .v3-b:disabled{opacity:.5;cursor:wait}
#v3-box .v3-b.p{background:#e2fe17;color:#1f2123;border-color:#e2fe17}#v3-box .v3-s{font-weight:900;margin:.7rem 0 .2rem;font-size:.95rem}#v3-box .v3-msg{min-height:1.3em;font-size:.86rem;margin-top:.5rem}`;
  const load = async files => { const out = []; for (const f of files) out.push(await createImageBitmap(f)); return out; };
  const natKey = f => String(f.name || "").replace(/[0-9]+/g, d => d.padStart(6, "0"));
  const N = () => S.bms.length;
  const wrap = (k, n) => ((k % n) + n) % n;
  /* رسم الإطار p (قد يكون كسرياً للتنعيم) على سياق W×H */
  function paint(ctx, W, H, p, smooth) {
    const n = N(); ctx.clearRect(0, 0, W, H); if (!S.tr) { ctx.fillStyle = S.bg; ctx.fillRect(0, 0, W, H); }
    const k = Math.floor(p), t = p - k, a = S.bms[wrap(k, n)], b = S.bms[wrap(k + 1, n)];
    const put = (bm, al) => { const s = Math.min(W / bm.width, H / bm.height) * S.zoom / 100, dw = bm.width * s, dh = bm.height * s; ctx.globalAlpha = al; ctx.drawImage(bm, (W - dw) / 2, (H - dh) / 2, dw, dh); ctx.globalAlpha = 1; };
    if (smooth && t > 0.001) { put(a, 1); put(b, t); } else put(t > .5 && !smooth ? b : a, 1);
  }
  function stageSize() { const f = fmtOf(S.fmt), k = Math.min(1, 720 / Math.max(f.w, f.h)); return { w: Math.round(f.w * k), h: Math.round(f.h * k) }; }
  function redraw() {
    const cv = $("v3-cv"); if (!cv || !N()) return; const z = stageSize(); if (cv.width !== z.w || cv.height !== z.h) { cv.width = z.w; cv.height = z.h; }
    paint(cv.getContext("2d"), z.w, z.h, S.p, S.smooth); const fr = $("v3-fr"); if (fr) { const k = wrap(Math.round(S.p), N()); fr.textContent = "إطار " + (k + 1) + " / " + N() + " · " + Math.round(360 * k / N()) + "°"; }
  }
  function tick(ts) {
    S.raf = requestAnimationFrame(tick); if (!bg) return; const dt = S.last ? ts - S.last : 0; S.last = ts;
    if (S.auto && !S.drag && !S.busy && S.ms > 0) { S.p = wrap(S.p + (S.inv ? -1 : 1) * dt / S.ms, N()); redraw(); }
  }
  const dl = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  const toBlob = (cv, type, q) => new Promise(r => cv.toBlob(r, type, q));
  const say = m => { S.msg = m; const e = $("v3-msg"); if (e) e.textContent = m; };
  async function frameBlob(k, type) {
    const f = fmtOf(S.fmt), cv = document.createElement("canvas"); cv.width = f.w; cv.height = f.h; const tr = S.tr && type !== "image/jpeg";
    const keep = S.tr; S.tr = tr; paint(cv.getContext("2d"), f.w, f.h, k, false); S.tr = keep; return toBlob(cv, type, .93);
  }
  const EXT = { "image/png": "png", "image/webp": "webp", "image/jpeg": "jpg" };
  async function zipFrames(type) {
    if (S.busy) return; S.busy = true; setBusy(); try { const files = []; for (let k = 0; k < N(); k++) { say("تجهيز الإطار " + (k + 1) + " من " + N() + "…"); files.push({ name: "frame-" + String(k + 1).padStart(2, "0") + "-" + Math.round(360 * k / N()) + "deg." + EXT[type], blob: await frameBlob(k, type) }); } dl(await AdminImgBatch.zip(files), "alyssum-360-" + EXT[type] + ".zip"); say("تم تنزيل " + N() + " إطاراً"); } catch (e) { say("تعذّر التنزيل: " + (e.message || e)); } S.busy = false; setBusy();
  }
  async function oneFrame(type) { const k = wrap(Math.round(S.p), N()); dl(await frameBlob(k, type), "alyssum-360-frame-" + (k + 1) + "." + EXT[type]); say("تم تنزيل الإطار " + (k + 1)); }
  async function sprite() {
    if (S.busy) return; S.busy = true; setBusy(); try { const f = fmtOf(S.fmt), w = 360, h = Math.round(360 * f.h / f.w), cv = document.createElement("canvas"); cv.width = w * N(); cv.height = h; const cx = cv.getContext("2d"), tmp = document.createElement("canvas"); tmp.width = w; tmp.height = h; for (let k = 0; k < N(); k++) { paint(tmp.getContext("2d"), w, h, k, false); cx.drawImage(tmp, k * w, 0); } dl(await toBlob(cv, S.tr ? "image/png" : "image/jpeg", .92), "alyssum-360-sprite." + (S.tr ? "png" : "jpg")); say("تم تنزيل شريط الإطارات (" + N() + " إطاراً أفقياً)"); } catch (e) { say("تعذّر: " + (e.message || e)); } S.busy = false; setBusy();
  }
  async function video(mime) {
    if (S.busy) return; if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) { say("متصفحك لا يدعم تسجيل الفيديو — نزّل الإطارات أو افتح في المطوّر"); return; }
    S.busy = true; setBusy(); const f = fmtOf(S.fmt), k0 = Math.min(1, 1920 / Math.max(f.w, f.h)), W = Math.round(f.w * k0 / 2) * 2, H = Math.round(f.h * k0 / 2) * 2, keepTr = S.tr; S.tr = false;
    try {
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const cx = cv.getContext("2d"), st = cv.captureStream(30), mt = [mime, "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(m => m && MediaRecorder.isTypeSupported(m)) || "";
      const rec = new MediaRecorder(st, mt ? { mimeType: mt, videoBitsPerSecond: 8e6 } : { videoBitsPerSecond: 8e6 }), ch = []; rec.ondataavailable = e => { if (e.data && e.data.size) ch.push(e.data); }; const done = new Promise(r => { rec.onstop = r; });
      const total = N() * Math.max(80, S.ms) * S.turns, t0 = performance.now(); rec.start(250);
      await new Promise(res => { (function step() { const e = performance.now() - t0, pos = (e / Math.max(80, S.ms)) * (S.inv ? -1 : 1); paint(cx, W, H, wrap(pos, N()), S.smooth); say("تسجيل الفيديو… " + Math.min(100, Math.round(100 * e / total)) + "%"); if (e < total) requestAnimationFrame(step); else res(); })(); });
      paint(cx, W, H, 0, false); await new Promise(r => setTimeout(r, 200)); rec.stop(); await done;
      const type = (rec.mimeType || mt || "video/webm").split(";")[0]; dl(new Blob(ch, { type }), "alyssum-360-" + f.id.replace(":", "x") + "." + (/mp4/.test(type) ? "mp4" : "webm")); say("تم تنزيل الفيديو (" + W + "×" + H + ")");
    } catch (e) { say("تعذّر تسجيل الفيديو: " + (e.message || e)); }
    S.tr = keepTr; S.busy = false; setBusy();
  }
  async function viewerHtml() {
    if (S.busy) return; S.busy = true; setBusy(); try {
      const f = fmtOf(S.fmt), k0 = Math.min(1, 1000 / Math.max(f.w, f.h)), w = Math.round(f.w * k0), h = Math.round(f.h * k0), uris = [], keep = S.tr; S.tr = false;
      for (let k = 0; k < N(); k++) { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; paint(cv.getContext("2d"), w, h, k, false); uris.push(cv.toDataURL("image/jpeg", .86)); } S.tr = keep;
      const js = "var F=" + JSON.stringify(uris) + ",n=F.length,i=0,d=0,x0=0,c0=0,ms=" + (S.auto ? Math.max(80, S.ms) : 0) + ",inv=" + (S.inv ? -1 : 1) + ",im=document.getElementById('v'),t=null;function g(k){i=((k%n)+n)%n;im.src=F[i]}function p(){if(ms>0&&!t)t=setInterval(function(){g(i+inv)},ms)}function s(){if(t){clearInterval(t);t=null}}var b=document.body;b.addEventListener('pointerdown',function(e){d=1;x0=e.clientX;c0=i;s();document.getElementById('h').style.opacity=0});b.addEventListener('pointermove',function(e){if(d)g(c0+inv*Math.round((e.clientX-x0)/(innerWidth/n/1.2)))});b.addEventListener('pointerup',function(){d=0;setTimeout(p,2500)});g(0);p();";
      const html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>عرض 360°</title><style>html,body{margin:0;height:100%;background:' + (S.tr ? "#fff" : S.bg) + ';overflow:hidden;touch-action:pan-y;user-select:none;cursor:grab}#v{position:absolute;inset:0;margin:auto;max-width:100%;max-height:100%;pointer-events:none}#h{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.6);color:#fff;font:800 14px sans-serif;padding:4px 14px;border-radius:99px;transition:opacity .4s;white-space:nowrap}</style></head><body><img id="v" alt=""><div id="h">360° — اسحب لتدوير المنتج</div><script>' + js + '<' + '/script></body></html>';
      dl(new Blob([html], { type: "text/html" }), "alyssum-360-viewer.html"); say("تم تنزيل العارض (ملف HTML واحد يدور بالسحب)");
    } catch (e) { say("تعذّر: " + (e.message || e)); } S.busy = false; setBusy();
  }
  async function toBuilder() {
    if (typeof PBApp === "undefined" || !PBApp.view360Session) { say("مطوّر الصفحات غير متاح"); return; }
    const files = S.files.slice(), opts = { v360z: S.zoom, vbg: S.tr ? "transparent" : S.bg, v360a: S.auto ? S.ms : 0, v360i: !!S.inv };
    S.busy = true; setBusy(); try { const ok = await PBApp.view360Session(files, opts); if (ok !== false) close(); } catch (e) { say("⚠️ " + (e.message || e)); } S.busy = false; setBusy();
  }
  function setBusy() { const b = $("v3-box"); if (b) b.querySelectorAll(".v3-b").forEach(x => { x.disabled = S.busy; }); }
  function html() {
    const vm = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported("video/mp4");
    return `<div class="v3-h"><div><b>عرض 360° للمنتج</b><br><small>${N()} إطاراً — اسحب الصورة لتدويرها، واضبط بُعد الكاميرا قبل التنزيل أو الفتح في المطوّر. مجاني بلا رصيد.</small></div><button type="button" class="v3-x" data-v3="x" aria-label="إغلاق">✕</button></div>
<div class="v3-m"><div><div class="v3-st" id="v3-st"><canvas id="v3-cv"></canvas><span class="v3-fr" id="v3-fr"></span></div>
<div class="v3-dl" style="margin-top:.5rem"><button type="button" class="v3-b" data-v3="play">${S.auto ? "إيقاف الدوران" : "تشغيل الدوران"}</button><button type="button" class="v3-b" data-v3="prev">الإطار السابق</button><button type="button" class="v3-b" data-v3="next">الإطار التالي</button></div></div>
<div class="v3-ctl">
<label><span>بُعد الكاميرا (حجم المنتج داخل الإطار)<b id="v3-zv">${S.zoom}%</b></span><input type="range" id="v3-z" min="30" max="130" step="1" value="${S.zoom}"><small>أقل = الكاميرا أبعد والمنتج أصغر بهوامش أكبر</small></label>
<label><span>سرعة الدوران (مللي ثانية للإطار)<b id="v3-sv">${S.ms}</b></span><input type="range" id="v3-s" min="100" max="1500" step="10" value="${S.ms}"></label>
<label>مقاس الإخراج<select id="v3-f">${fmts().map(f => `<option value="${esc(f.id)}"${f.id === S.fmt ? " selected" : ""}>${esc(f.label)}</option>`).join("")}</select></label>
<label>الخلفية<input type="color" id="v3-col" value="${esc(S.bg)}"></label>
<label class="v3-ck"><input type="checkbox" id="v3-tr"${S.tr ? " checked" : ""}> خلفية شفافة (PNG/WebP وشريط الإطارات)</label>
<label class="v3-ck"><input type="checkbox" id="v3-inv"${S.inv ? " checked" : ""}> عكس اتجاه الدوران</label>
<label class="v3-ck"><input type="checkbox" id="v3-sm"${S.smooth ? " checked" : ""}> تنعيم الانتقال بين الإطارات (مزج)</label>
<label>عدد الدورات في الفيديو<select id="v3-t">${[1, 2, 3].map(n => `<option value="${n}"${S.turns === n ? " selected" : ""}>${n}</option>`).join("")}</select></label></div></div>
<div class="v3-s">تنزيل</div><div class="v3-dl">
<button type="button" class="v3-b" data-v3="vid">فيديو دوران (WebM)</button>${vm ? '<button type="button" class="v3-b" data-v3="vidmp4">فيديو دوران (MP4)</button>' : ""}
<button type="button" class="v3-b" data-v3="zpng">كل الإطارات PNG (ZIP)</button><button type="button" class="v3-b" data-v3="zwebp">كل الإطارات WebP (ZIP)</button><button type="button" class="v3-b" data-v3="zjpg">كل الإطارات JPG (ZIP)</button>
<button type="button" class="v3-b" data-v3="fpng">الإطار الحالي PNG</button><button type="button" class="v3-b" data-v3="fwebp">الإطار الحالي WebP</button><button type="button" class="v3-b" data-v3="fjpg">الإطار الحالي JPG</button>
<button type="button" class="v3-b" data-v3="sprite">شريط الإطارات (صورة واحدة)</button><button type="button" class="v3-b" data-v3="html">عارض HTML مستقل (ملف واحد)</button></div>
<div class="v3-dl" style="margin-top:.7rem"><button type="button" class="v3-b p" data-v3="builder" style="grid-column:1/-1">فتح في مطوّر الصفحات (بهذه الإعدادات)</button></div>
<div class="v3-msg" id="v3-msg">${esc(S.msg)}</div>`;
  }
  function close() { cancelAnimationFrame(S.raf); S.raf = 0; if (bg) { bg.remove(); bg = null; } document.removeEventListener("keydown", onKey, true); S.bms.forEach(b => { try { b.close(); } catch (e) { } }); S.bms = []; S.files = []; }
  const onKey = e => { if (String(e.key || "") === "Escape") { e.stopPropagation(); close(); } };
  function bind() {
    const st = $("v3-st");
    st.addEventListener("pointerdown", e => { S.drag = { x: e.clientX, p: S.p }; try { st.setPointerCapture(e.pointerId); } catch (x) { } });
    st.addEventListener("pointermove", e => { if (!S.drag) return; const step = Math.max(8, st.clientWidth / N() / 1.3); S.p = wrap(S.drag.p + (S.inv ? -1 : 1) * (e.clientX - S.drag.x) / step, N()); redraw(); });
    const up = () => { S.drag = null; };
    st.addEventListener("pointerup", up); st.addEventListener("pointercancel", up);
    const r = (id, fn) => { const el = $(id); if (el) el.addEventListener("input", () => { fn(el); redraw(); }); };
    r("v3-z", el => { S.zoom = +el.value; $("v3-zv").textContent = S.zoom + "%"; }); r("v3-s", el => { S.ms = +el.value; $("v3-sv").textContent = S.ms; });
    r("v3-col", el => { S.bg = el.value; }); r("v3-tr", el => { S.tr = el.checked; }); r("v3-inv", el => { S.inv = el.checked; }); r("v3-sm", el => { S.smooth = el.checked; });
    const sel = (id, fn) => { const el = $(id); if (el) el.addEventListener("change", () => { fn(el); redraw(); }); }; sel("v3-f", el => { S.fmt = el.value; }); sel("v3-t", el => { S.turns = +el.value; });
  }
  async function open(files) {
    files = (Array.isArray(files) ? files : [files]).filter(Boolean).slice(0, 36).sort((a, b) => natKey(a) < natKey(b) ? -1 : 1);
    if (files.length < 6) { if (typeof Admin !== "undefined" && Admin.toast) Admin.toast("⚠️ اختر 6 صور على الأقل من زوايا متتالية"); return false; }
    close(); S.files = files; S.p = 0; S.msg = "جارٍ التحميل…"; S.busy = false;
    if (!$("v3-css")) { const st = document.createElement("style"); st.id = "v3-css"; st.textContent = CSS; document.head.appendChild(st); }
    bg = document.createElement("div"); bg.id = "v3-bg"; bg.innerHTML = '<div id="v3-box" role="dialog" aria-modal="true"><div class="v3-msg">جارٍ تحميل الإطارات…</div></div>'; document.body.appendChild(bg);
    try { S.bms = await load(files); } catch (e) { close(); if (typeof Admin !== "undefined" && Admin.toast) Admin.toast("⚠️ تعذّر قراءة الصور"); return false; }
    if (!bg) return false; S.msg = ""; $("v3-box").innerHTML = html(); bind(); redraw(); document.addEventListener("keydown", onKey, true);
    bg.addEventListener("click", e => {
      if (e.target === bg) return close(); const el = e.target.closest("[data-v3]"); if (!el) return; const a = el.dataset.v3;
      if (a === "x") close(); else if (a === "play") { S.auto = !S.auto; el.textContent = S.auto ? "إيقاف الدوران" : "تشغيل الدوران"; } else if (a === "prev") { S.auto = false; S.p = wrap(Math.round(S.p) - 1, N()); redraw(); const pb = bg.querySelector('[data-v3="play"]'); if (pb) pb.textContent = "تشغيل الدوران"; } else if (a === "next") { S.auto = false; S.p = wrap(Math.round(S.p) + 1, N()); redraw(); const pb = bg.querySelector('[data-v3="play"]'); if (pb) pb.textContent = "تشغيل الدوران"; }
      else if (a === "vid") video(""); else if (a === "vidmp4") video("video/mp4"); else if (a === "zpng") zipFrames("image/png"); else if (a === "zwebp") zipFrames("image/webp"); else if (a === "zjpg") zipFrames("image/jpeg");
      else if (a === "fpng") oneFrame("image/png"); else if (a === "fwebp") oneFrame("image/webp"); else if (a === "fjpg") oneFrame("image/jpeg"); else if (a === "sprite") sprite(); else if (a === "html") viewerHtml(); else if (a === "builder") toBuilder();
    });
    S.last = 0; S.raf = requestAnimationFrame(tick); return true;
  }
  return { open, close, state: S, _t: { paint, frameBlob } };
})();
