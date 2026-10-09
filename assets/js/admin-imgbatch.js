/* معالجة الصور دفعةً واحدة (v1.80): مقاسات جاهزة + قص/احتواء + علامة مائية (نص أو شعار) + تحويل WebP/JPEG/PNG + تنزيل فردي أو ZIP.
   كله في المتصفح (canvas) بلا خادم ولا API ولا اشتراك؛ تُضاف البطاقة تحت بطاقة «أدوات تعديل الصور» في تبويب imgtools.
   الصور من الحاسوب أو من منتجات المتجر (نفس النطاق). الإعدادات تُحفظ في localStorage ‎alyssum_imgbatch‎. */
const AdminImgBatch = (() => {
  const $ = id => document.getElementById(id), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KEY = "alyssum_imgbatch";
  const PRESETS = [["orig", "المقاس الأصلي (بدون قص)"], ["1000x1000", "منتج مربع 1000×1000"], ["1080x1080", "مربع 1080×1080 (فيسبوك/إنستغرام)"], ["1080x1350", "عمودي 4:5 — 1080×1350 (إنستغرام)"], ["1080x1920", "قصة 9:16 — 1080×1920 (تيك توك/ريلز)"], ["1920x1080", "أفقي 16:9 — 1920×1080 (يوتيوب)"], ["1200x628", "بانر إعلان 1200×628"], ["1200x400", "غلاف عريض 1200×400"], ["custom", "مخصص…"]];
  const POS = [["tl", "↖"], ["tc", "↑"], ["tr", "↗"], ["ml", "←"], ["mc", "•"], ["mr", "→"], ["bl", "↙"], ["bc", "↓"], ["br", "↘"]];
  const D = { preset: "orig", w: 1000, h: 1000, maxw: 1600, fit: "cover", bg: "#ffffff", fmt: "webp", q: 85, wm: "none", wmText: "", wmColor: "#ffffff", wmSize: 5, wmOp: 60, wmPos: "br", wmMar: 3, wmLogo: "" };
  const S = Object.assign({ files: [], out: [], busy: false, prod: "" }, { cfg: Object.assign({}, D) });
  try { Object.assign(S.cfg, JSON.parse(localStorage.getItem(KEY) || "{}")); S.cfg.wmLogo = ""; } catch (e) { }
  const save = () => { try { const c = Object.assign({}, S.cfg); delete c.wmLogo; localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { } };
  let logoImg = null;

  const kb = n => (n / 1024 >= 100 ? Math.round(n / 1024) : (n / 1024).toFixed(1)) + " ك.ب";
  function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => rej(new Error("تعذّر قراءة الصورة")); im.src = src; }); }
  const fileUrl = f => (f instanceof Blob ? URL.createObjectURL(f) : f.url);

  /* هدف المقاس: {w,h} أو null للأصلي (مع حدّ العرض الأقصى) */
  function target(c) { if (c.preset === "orig") return null; if (c.preset === "custom") return { w: Math.max(16, Math.min(6000, +c.w || 1000)), h: Math.max(16, Math.min(6000, +c.h || 1000)) }; const m = c.preset.split("x"); return { w: +m[0], h: +m[1] }; }

  async function render(item, c) {
    const im = await loadImg(item.src), tg = target(c); let W, H;
    if (tg) { W = tg.w; H = tg.h; } else { const k = Math.min(1, (+c.maxw || 1600) / im.naturalWidth); W = Math.round(im.naturalWidth * k); H = Math.round(im.naturalHeight * k); }
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d"); g.imageSmoothingQuality = "high";
    const flat = c.fmt === "jpeg" || (c.fit === "contain" && c.bg !== "transparent");
    if (flat || c.fmt === "jpeg") { g.fillStyle = c.bg && c.bg !== "transparent" ? c.bg : "#ffffff"; g.fillRect(0, 0, W, H); }
    if (tg) { const s = c.fit === "cover" ? Math.max(W / im.naturalWidth, H / im.naturalHeight) : Math.min(W / im.naturalWidth, H / im.naturalHeight), dw = im.naturalWidth * s, dh = im.naturalHeight * s; g.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh); }
    else g.drawImage(im, 0, 0, W, H);
    watermark(g, W, H, c);
    const mime = { webp: "image/webp", jpeg: "image/jpeg", png: "image/png" }[c.fmt] || "image/webp";
    const blob = await new Promise(r => cv.toBlob(r, mime, Math.max(.4, Math.min(1, c.q / 100))));
    return { blob, w: W, h: H, mime, canvas: cv };
  }

  function anchor(pos, W, H, w, h, m) { const x = pos[1] === "l" ? m : pos[1] === "r" ? W - w - m : (W - w) / 2, y = pos[0] === "t" ? m : pos[0] === "b" ? H - h - m : (H - h) / 2; return [x, y]; }
  function watermark(g, W, H, c) {
    if (c.wm === "none") return; const m = Math.round(Math.min(W, H) * (+c.wmMar || 0) / 100); g.save(); g.globalAlpha = Math.max(.05, Math.min(1, c.wmOp / 100));
    if (c.wm === "text" && c.wmText.trim()) {
      const fs = Math.max(10, Math.round(Math.min(W, H) * (+c.wmSize || 5) / 100)); g.font = "800 " + fs + 'px Tajawal,Cairo,"Segoe UI",Arial,sans-serif'; g.textBaseline = "top"; g.textAlign = "left"; g.direction = "rtl";
      const tw = g.measureText(c.wmText).width, [x, y] = anchor(c.wmPos, W, H, tw, fs * 1.15, m);
      g.fillStyle = "rgba(0,0,0,.45)"; g.fillText(c.wmText, x + fs * .05, y + fs * .05); g.fillStyle = c.wmColor || "#ffffff"; g.fillText(c.wmText, x, y);
    } else if (c.wm === "logo" && logoImg) {
      const lw = Math.round(W * (+c.wmSize || 5) / 100 * 2.2), lh = Math.round(lw * logoImg.naturalHeight / logoImg.naturalWidth), [x, y] = anchor(c.wmPos, W, H, lw, lh, m); g.drawImage(logoImg, x, y, lw, lh);
    }
    g.restore();
  }

  /* ZIP بدون ضغط (STORE) — كافٍ للصور لأنها مضغوطة أصلاً */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }; })();
  async function zip(files) {
    const enc = new TextEncoder(), parts = [], cen = []; let off = 0; const d = new Date(), dt = ((d.getFullYear() - 1980) << 9 | (d.getMonth() + 1) << 5 | d.getDate()) & 0xFFFF, tm = (d.getHours() << 11 | d.getMinutes() << 5 | d.getSeconds() >> 1) & 0xFFFF;
    for (const f of files) {
      const data = new Uint8Array(await f.blob.arrayBuffer()), name = enc.encode(f.name), crc = CRC(data), lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, tm, true); lh.setUint16(12, dt, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, tm, true); ch.setUint16(14, dt, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      cen.push(ch.buffer, name); off += 30 + name.length + data.length;
    }
    const csize = cen.reduce((n, b) => n + (b.byteLength || b.length), 0), end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(cen, [end.buffer]), { type: "application/zip" });
  }

  const extOf = f => ({ webp: "webp", jpeg: "jpg", png: "png" }[f] || "webp");
  const uniq = (name, used) => { let n = name, i = 2; while (used.has(n)) n = name.replace(/(\.[^.]+)$/, "-" + (i++) + "$1"); used.add(n); return n; };

  function addFiles(list) {
    [...list].filter(f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|avif)$/i.test(f.name || "")).forEach(f => S.files.push({ name: (f.name || "image").replace(/\.[^.]+$/, ""), src: URL.createObjectURL(f), size: f.size }));
    S.out = []; draw();
  }
  async function addProduct(slug) {
    const a = typeof Admin !== "undefined" ? Admin : null, p = a && (a.products || []).find(x => x.slug === slug); if (!p) return;
    const list = [p.cover].concat(p.images || []).filter(Boolean).filter((v, i, ar) => ar.indexOf(v) === i);
    list.forEach((u, i) => S.files.push({ name: slug + "-" + (i + 1), src: (typeof REL !== "undefined" ? REL : "") + u, size: 0 })); S.out = []; draw();
  }
  async function run() {
    if (S.busy || !S.files.length) return; S.busy = true; S.out = []; const c = Object.assign({}, S.cfg), used = new Set(); status("⏳ 0 / " + S.files.length);
    for (let i = 0; i < S.files.length; i++) {
      const it = S.files[i];
      try { const r = await render(it, c); S.out.push({ name: uniq(it.name + (c.wm !== "none" ? "-wm" : "") + "." + extOf(c.fmt), used), blob: r.blob, w: r.w, h: r.h, before: it.size, url: URL.createObjectURL(r.blob) }); }
      catch (e) { S.out.push({ name: it.name, err: e.message || String(e) }); }
      status("⏳ " + (i + 1) + " / " + S.files.length); await new Promise(r => setTimeout(r, 0));
    }
    S.busy = false; draw();
  }
  const status = m => { const e = $("ib-st"); if (e) e.textContent = m; };
  function dl(i) { const o = S.out[i]; if (!o || !o.blob) return; const a = document.createElement("a"); a.href = o.url; a.download = o.name; a.click(); }
  async function dlZip() { const ok = S.out.filter(o => o.blob); if (!ok.length) return; const b = await zip(ok), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "alyssum-images.zip"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }

  function ensure() { const tab = $("tab-imgtools"); if (!tab) return null; let c = $("ib-card"); if (!c) { c = document.createElement("div"); c.id = "ib-card"; c.className = "card"; tab.appendChild(c); } return c; }
  const sel = (id, opts, v) => `<select id="${id}">${opts.map(o => `<option value="${o[0]}"${o[0] === v ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`;
  function draw() {
    const c = ensure(); if (!c) return; const g = S.cfg, prods = (typeof Admin !== "undefined" && Admin.products) || [], tg = target(g);
    const ok = S.out.filter(o => o.blob);
    c.innerHTML = `<style>#ib-card .ib-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:.6rem 0}#ib-card label{display:grid;gap:4px;font-weight:700;font-size:.88rem}#ib-card .ib-pos{display:grid;grid-template-columns:repeat(3,30px);gap:3px}#ib-card .ib-pos button{padding:4px 0;border-radius:8px}#ib-card .ib-pos button.on{background:rgba(34,197,94,.35)}#ib-card .ib-res{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:.7rem}#ib-card .ib-it{border:1px solid var(--line);border-radius:12px;padding:6px;text-align:center;font-size:.78rem}#ib-card .ib-it img{width:100%;height:110px;object-fit:contain;border-radius:8px;background:repeating-conic-gradient(rgba(128,128,128,.18) 0 25%,transparent 0 50%) 50%/14px 14px}</style>
<b style="color:var(--green)">🗂️ معالجة الصور دفعة واحدة</b>
<div class="hint">اختر عدة صور (أو صور منتج) ← مقاس جاهز مع قص أو احتواء ← علامة مائية نصاً أو شعاراً ← صيغة وجودة ← نفّذ ثم نزّل الكل ZIP. كل شيء في متصفحك بلا خادم ولا اشتراك.</div>
<div class="action-bar" style="margin-top:.5rem"><label class="small gold" style="cursor:pointer;display:inline-flex;gap:.4rem;align-items:center">إضافة صور<input id="ib-files" type="file" accept="image/*" multiple style="display:none"></label>
<select id="ib-prod" title="صور منتج من متجرك"><option value="">+ من صور منتج…</option>${prods.map(p => `<option value="${esc(p.slug)}">${esc(p.title)}</option>`).join("")}</select>
<button class="small gray" id="ib-clear" ${S.files.length ? "" : "disabled"}>مسح القائمة (${S.files.length})</button></div>
<div class="ib-g"><label>المقاس${sel("ib-preset", PRESETS, g.preset)}</label>
${g.preset === "custom" ? `<label>العرض × الارتفاع<span style="display:flex;gap:4px"><input id="ib-w" type="number" min="16" max="6000" value="${g.w}"><input id="ib-h" type="number" min="16" max="6000" value="${g.h}"></span></label>` : ""}
${g.preset === "orig" ? `<label>أقصى عرض (px)<input id="ib-maxw" type="number" min="200" max="6000" value="${g.maxw}"></label>` : `<label>التعامل مع النسبة${sel("ib-fit", [["cover", "قص ليملأ المقاس"], ["contain", "احتواء مع خلفية"]], g.fit)}</label>`}
${tg && g.fit === "contain" ? `<label>لون الخلفية<input id="ib-bg" type="color" value="${esc(g.bg === "transparent" ? "#ffffff" : g.bg)}"></label>` : ""}
<label>الصيغة${sel("ib-fmt", [["webp", "WebP (الأخف)"], ["jpeg", "JPEG"], ["png", "PNG (شفافية)"]], g.fmt)}</label>
<label>الجودة ${g.q}%<input id="ib-q" type="range" min="40" max="100" value="${g.q}"></label></div>
<div class="ib-g"><label>العلامة المائية${sel("ib-wm", [["none", "بلا علامة"], ["text", "نص"], ["logo", "شعار (صورة)"]], g.wm)}</label>
${g.wm === "text" ? `<label>النص<input id="ib-wmt" maxlength="60" placeholder="اسم متجرك أو موقعك" value="${esc(g.wmText)}"></label><label>لون النص<input id="ib-wmc" type="color" value="${esc(g.wmColor)}"></label>` : ""}
${g.wm === "logo" ? `<label class="small" style="cursor:pointer">اختيار الشعار<input id="ib-logo" type="file" accept="image/*" style="display:none"></label><div class="hint" style="margin:0">${logoImg ? "✅ تم اختيار الشعار" : "لم يُختر شعار"}</div>` : ""}
${g.wm !== "none" ? `<label>الحجم ${g.wmSize}%<input id="ib-wms" type="range" min="2" max="30" value="${g.wmSize}"></label><label>الشفافية ${g.wmOp}%<input id="ib-wmo" type="range" min="10" max="100" value="${g.wmOp}"></label><label>الهامش ${g.wmMar}%<input id="ib-wmm" type="range" min="0" max="10" value="${g.wmMar}"></label><label>الموضع<span class="ib-pos">${POS.map(p => `<button type="button" class="small gray${p[0] === g.wmPos ? " on" : ""}" data-pos="${p[0]}">${p[1]}</button>`).join("")}</span></label>` : ""}</div>
<div class="action-bar"><button class="small" id="ib-run" ${S.files.length && !S.busy ? "" : "disabled"}>${S.busy ? "جارٍ التنفيذ…" : "▶ تنفيذ على " + S.files.length + " صورة"}</button><button class="small gold" id="ib-zip" ${ok.length ? "" : "disabled"}>⬇ تنزيل الكل (ZIP)</button><span id="ib-st" class="hint" style="margin:0"></span></div>
<div class="ib-res">${S.out.length ? S.out.map((o, i) => o.err ? `<div class="ib-it">⚠️ ${esc(o.name)}<br>${esc(o.err)}</div>` : `<div class="ib-it"><img src="${o.url}" alt=""><div dir="ltr" style="word-break:break-all">${esc(o.name)}</div><div>${o.w}×${o.h} · ${kb(o.blob.size)}${o.before ? " ← " + kb(o.before) : ""}</div><button class="small" data-dl="${i}">تنزيل</button></div>`).join("") : S.files.map(f => `<div class="ib-it"><img src="${f.src}" alt=""><div dir="ltr" style="word-break:break-all">${esc(f.name)}</div></div>`).join("")}</div>`;
    wire();
  }
  function wire() {
    const g = S.cfg, on = (id, ev, fn) => { const e = $(id); if (e) e[ev] = fn; };
    on("ib-files", "onchange", e => { addFiles(e.target.files); });
    on("ib-prod", "onchange", e => { if (e.target.value) addProduct(e.target.value); });
    on("ib-clear", "onclick", () => { S.files = []; S.out = []; draw(); });
    const bind = (id, k, num, redraw) => on(id, "onchange", e => { g[k] = num ? +e.target.value : e.target.value; save(); S.out = []; if (redraw) draw(); });
    bind("ib-preset", "preset", false, true); bind("ib-w", "w", true); bind("ib-h", "h", true); bind("ib-maxw", "maxw", true); bind("ib-fit", "fit", false, true); bind("ib-bg", "bg", false); bind("ib-fmt", "fmt", false, true);
    bind("ib-wm", "wm", false, true); bind("ib-wmt", "wmText", false); bind("ib-wmc", "wmColor", false);
    [["ib-q", "q"], ["ib-wms", "wmSize"], ["ib-wmo", "wmOp"], ["ib-wmm", "wmMar"]].forEach(([id, k]) => on(id, "oninput", e => { g[k] = +e.target.value; save(); const l = e.target.parentNode.firstChild; if (l && l.nodeType === 3) l.nodeValue = l.nodeValue.replace(/\d+%$/, g[k] + "%"); }));
    on("ib-logo", "onchange", async e => { const f = e.target.files[0]; if (!f) return; try { logoImg = await loadImg(URL.createObjectURL(f)); } catch (x) { logoImg = null; } S.out = []; draw(); });
    document.querySelectorAll("#ib-card [data-pos]").forEach(b => b.onclick = () => { g.wmPos = b.dataset.pos; save(); draw(); });
    document.querySelectorAll("#ib-card [data-dl]").forEach(b => b.onclick = () => dl(+b.dataset.dl));
    on("ib-run", "onclick", run); on("ib-zip", "onclick", dlZip);
  }
  function init() { if (!$("tab-imgtools")) return setTimeout(init, 300); draw(); const a = typeof Admin !== "undefined" ? Admin : null; if (a && !a.__ibWrapped && a.tab) { a.__ibWrapped = true; const o = a.tab.bind(a); a.tab = function (t) { const r = o.apply(a, arguments); if (t === "imgtools") draw(); return r; }; } }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0)); else setTimeout(init, 0);
  return { addFiles, addProduct, run, draw, zip, render, S, setLogo: im => { logoImg = im; } };
})();
