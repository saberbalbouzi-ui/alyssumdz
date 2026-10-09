/* رفع دقة الصور بلا ذكاء اصطناعي: تكبير تدريجي عالي الجودة + حدّة على السطوع فقط (Unsharp Mask) مع عتبة تمنع تضخيم الضجيج.
   كله داخل المتصفح (canvas)؛ يحفظ الشفافية. بطاقة #iu-card في تبويب أدوات الصور. */
const ImgUpscale = (() => {
  const $ = id => document.getElementById(id), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
  const MOBILE = () => /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || innerWidth < 800;
  const MAXPX = () => MOBILE() ? 8e6 : 24e6;
  const S = { cfg: { scale: LS.get("alyssum_iu_scale", "2"), sharp: Number(LS.get("alyssum_iu_sharp", "50")), fmt: LS.get("alyssum_iu_fmt", "webp"), q: Number(LS.get("alyssum_iu_q", "92")) }, out: [], busy: false };
  const load = blob => new Promise((res, rej) => { const u = URL.createObjectURL(blob), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error("تعذّر قراءة الصورة")); }; i.src = u; });
  const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  /* تكبير تدريجي: خطوات ≤ ×1.6 تعطي حواف أنعم من قفزة واحدة كبيرة */
  function resize(src, W, H) {
    let cur = src, cw = src.width || src.naturalWidth, ch = src.height || src.naturalHeight;
    while (cw < W || ch < H) {
      const nw = Math.min(W, Math.round(cw * 1.6)), nh = Math.min(H, Math.round(ch * 1.6)), c = cv(nw, nh), x = c.getContext("2d");
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(cur, 0, 0, nw, nh); cur = c; cw = nw; ch = nh;
    }
    if (cw === W && ch === H) { if (cur === src) { const c = cv(W, H); c.getContext("2d").drawImage(src, 0, 0); return c; } return cur; }
    const c = cv(W, H), x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(cur, 0, 0, W, H); return c;
  }
  function boxBlur(a, w, h, r) {
    const t = new Float32Array(a.length), o = new Float32Array(a.length), d = 2 * r + 1;
    for (let y = 0; y < h; y++) { let s = 0; const i0 = y * w; for (let k = -r; k <= r; k++) s += a[i0 + Math.min(w - 1, Math.max(0, k))]; for (let x = 0; x < w; x++) { t[i0 + x] = s / d; s += a[i0 + Math.min(w - 1, x + r + 1)] - a[i0 + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let k = -r; k <= r; k++) s += t[Math.min(h - 1, Math.max(0, k)) * w + x]; for (let y = 0; y < h; y++) { o[y * w + x] = s / d; s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
    return o;
  }
  /* Unsharp Mask على السطوع: detail = L − blur(L)؛ تفاصيل أصغر من العتبة (ضجيج) تُخفَّف، والباقي يُضاف لقنوات اللون بالتساوي */
  function sharpen(c, amount, radius) {
    if (amount <= 0) return c;
    const w = c.width, h = c.height, x = c.getContext("2d"), im = x.getImageData(0, 0, w, h), d = im.data, n = w * h, L = new Float32Array(n);
    for (let i = 0, p = 0; i < n; i++, p += 4) L[i] = .299 * d[p] + .587 * d[p + 1] + .114 * d[p + 2];
    let B = boxBlur(L, w, h, radius); B = boxBlur(B, w, h, radius); B = boxBlur(B, w, h, radius);
    const k = amount / 100 * 1.6, thr = 2.5;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      if (d[p + 3] === 0) continue;
      let det = L[i] - B[i]; const a = Math.abs(det); if (a < thr) det *= a / thr;
      const add = det * k; if (!add) continue;
      d[p] = Math.max(0, Math.min(255, d[p] + add)); d[p + 1] = Math.max(0, Math.min(255, d[p + 1] + add)); d[p + 2] = Math.max(0, Math.min(255, d[p + 2] + add));
    }
    x.putImageData(im, 0, 0); return c;
  }
  const toBlob = (c, fmt, q) => new Promise(res => c.toBlob(res, "image/" + (fmt === "jpg" ? "jpeg" : fmt), q / 100));
  /* opts: {scale:2|3|4|"w1920", sharp:0..100, fmt, q} → {blob,w,h,from:[w,h],capped} */
  async function run(blob, opts) {
    const o = Object.assign({ scale: "2", sharp: 50, fmt: "webp", q: 92 }, opts || {}), img = await load(blob), w0 = img.naturalWidth, h0 = img.naturalHeight;
    let k = /^w\d+$/.test(String(o.scale)) ? Number(String(o.scale).slice(1)) / w0 : Number(o.scale) || 2, capped = false;
    if (k < 1) k = 1;
    const mx = MAXPX(); if (w0 * k * h0 * k > mx) { k = Math.sqrt(mx / (w0 * h0)); capped = true; }
    if (k <= 1.001) { return { blob, w: w0, h: h0, from: [w0, h0], capped: true, same: true }; }
    const W = Math.round(w0 * k), H = Math.round(h0 * k);
    const c = sharpen(resize(img, W, H), Number(o.sharp) || 0, k >= 3 ? 2 : 1);
    return { blob: await toBlob(c, o.fmt, o.q), w: W, h: H, from: [w0, h0], capped };
  }
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.round(n / 1024) + " KB";
  function ensure() { const tab = $("tab-imgtools"); if (!tab) return null; let c = $("iu-card"); if (!c) { c = document.createElement("div"); c.id = "iu-card"; c.className = "card"; tab.appendChild(c); } return c; }
  function draw() {
    const c = ensure(); if (!c) return; const g = S.cfg, ok = S.out.filter(o => o.res);
    c.innerHTML = `<style>#iu-card .iu-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:.6rem 0}#iu-card label{display:grid;gap:4px;font-weight:700;font-size:.88rem}#iu-card .iu-res{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-top:.7rem}#iu-card .iu-it{border:1px solid var(--line);border-radius:12px;padding:6px;text-align:center;font-size:.8rem}#iu-card .iu-it img{max-width:100%;max-height:130px;border-radius:8px;background:repeating-conic-gradient(#8883 0 25%,transparent 0 50%) 0 0/14px 14px}</style>
<b style="color:var(--green)">🔍 رفع دقة الصور (بلا ذكاء اصطناعي)</b>
<p class="hint">تكبير تدريجي عالي الجودة + حدّة ذكية على السطوع فقط (لا تضخّم الضجيج). لا يخترع تفاصيل جديدة كالذكاء الاصطناعي، لكنه يعطي صورة أكبر وأوضح بلا هالات. يتم كل شيء في متصفحك، والشفافية تُحفظ. الحدّ الأقصى للناتج ${(MAXPX() / 1e6)} ميغابكسل.</p>
<div class="iu-g"><label>التكبير<select id="iu-scale">${[["2", "×2"], ["3", "×3"], ["4", "×4"], ["w1200", "عرض 1200px"], ["w1600", "عرض 1600px"], ["w2000", "عرض 2000px"]].map(o => `<option value="${o[0]}"${o[0] === String(g.scale) ? " selected" : ""}>${o[1]}</option>`).join("")}</select></label>
<label>الحدّة: <b id="iu-sv">${g.sharp}</b><input id="iu-sharp" type="range" min="0" max="100" value="${g.sharp}"></label>
<label>الصيغة<select id="iu-fmt">${["webp", "png", "jpeg"].map(f => `<option${f === g.fmt ? " selected" : ""}>${f}</option>`).join("")}</select></label>
<label>الجودة: <b id="iu-qv">${g.q}</b><input id="iu-q" type="range" min="60" max="100" value="${g.q}"></label></div>
<div class="action-bar"><button class="small" id="iu-pick" type="button">＋ اختر صوراً</button><input id="iu-file" type="file" accept="image/*" multiple hidden> <button class="small" id="iu-zip-all" type="button"${ok.length ? "" : " disabled"}>⬇ تنزيل الكل</button> <button class="small gray" id="iu-clear" type="button"${S.out.length ? "" : " disabled"}>مسح</button> <span class="hint" id="iu-msg"></span></div>
<div class="iu-res">${S.out.map((o, i) => `<div class="iu-it">${o.res ? `<img src="${esc(o.url)}" alt="">` : "⏳"}<div>${esc(o.name)}</div>${o.res ? `<div>${o.res.from[0]}×${o.res.from[1]} ← <b>${o.res.w}×${o.res.h}</b> · ${kb(o.res.blob.size)}${o.res.same ? " (لم يتغيّر: بلغ الحدّ الأقصى)" : o.res.capped ? " (قُلِّص للحدّ الأقصى)" : ""}</div><button class="small" data-dl="${i}" type="button">تنزيل</button>` : o.err ? `<div style="color:#f87171">${esc(o.err)}</div>` : ""}</div>`).join("")}</div>`;
    const sv = (k, v) => { g[k] = v; LS.set("alyssum_iu_" + k, String(v)); };
    $("iu-scale").onchange = e => sv("scale", e.target.value); $("iu-fmt").onchange = e => sv("fmt", e.target.value);
    $("iu-sharp").oninput = e => { $("iu-sv").textContent = e.target.value; sv("sharp", Number(e.target.value)); }; $("iu-q").oninput = e => { $("iu-qv").textContent = e.target.value; sv("q", Number(e.target.value)); };
    $("iu-pick").onclick = () => $("iu-file").click(); $("iu-file").onchange = e => add([...e.target.files]);
    $("iu-clear").onclick = () => { S.out.forEach(o => o.url && URL.revokeObjectURL(o.url)); S.out = []; draw(); };
    $("iu-zip-all").onclick = () => S.out.forEach((o, i) => o.res && setTimeout(() => dl(i), i * 250));
    c.querySelectorAll("[data-dl]").forEach(b => b.onclick = () => dl(+b.dataset.dl));
  }
  function dl(i) { const o = S.out[i]; if (!o || !o.res) return; const a = document.createElement("a"); a.href = o.url; a.download = o.name.replace(/\.[^.]+$/, "") + "-x" + (o.res.w) + "." + (S.cfg.fmt === "jpeg" ? "jpg" : S.cfg.fmt); a.click(); }
  async function add(files) {
    if (S.busy) return; S.busy = true;
    for (const f of files) {
      const it = { name: f.name || "image" }; S.out.push(it); draw();
      try { const msg = $("iu-msg"); if (msg) msg.textContent = "⏳ " + it.name; it.res = await run(f, S.cfg); it.url = URL.createObjectURL(it.res.blob); } catch (e) { it.err = e.message || "فشل"; }
      draw();
    }
    S.busy = false;
  }
  function init() { if (!$("tab-imgtools")) return setTimeout(init, 300); draw(); const a = typeof Admin !== "undefined" ? Admin : null; if (a && !a.__iuWrapped && a.tab) { a.__iuWrapped = true; const o = a.tab.bind(a); a.tab = function (t) { const r = o.apply(a, arguments); if (t === "imgtools" && !$("iu-card")) draw(); return r; }; } }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0)); else setTimeout(init, 0);
  return { run, resize, sharpen };
})();
