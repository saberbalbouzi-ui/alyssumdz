/* منتقي الألوان الموحَّد للوحة: يحلّ محلّ نافذة المتصفح الأصلية لـ <input type="color"> (التي تظهر بلغة الجهاز: فرنسية/إنجليزية…).
   عربي/فرنسي حسب لغة اللوحة، مع ألوان سريعة وآخر الألوان المستعملة وإدخال HEX وقطّارة:
   - المتصفحات التي تدعم EyeDropper (الحاسوب): قطّارة على أي نقطة من الشاشة.
   - الهاتف (بلا EyeDropper): قطّارة «من صورة» — اختر لقطة شاشة أو صورة ثم المس اللون.
   لا شيء خاص بمتجر. يُعطَّل لحقل بعينه بالسمة data-native-color. */
const AdminColorPick = (() => {
  "use strict";
  const T = s => { try { return typeof AdminI18n !== "undefined" && AdminI18n.t ? AdminI18n.t(s) : s; } catch (e) { return s; } };
  const RK = "cpk_recent", BASIC = ["#e2fe17", "#1f2123", "#ffffff", "#ef4444", "#f97316", "#facc15", "#22c55e", "#0d9488", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#78350f", "#64748b", "#d1d5db"];
  let S = null;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function hex2rgb(h) { h = String(h || "").trim().replace(/^#/, ""); if (/^[0-9a-f]{3}$/i.test(h)) h = h.replace(/(.)/g, "$1$1"); if (!/^[0-9a-f]{6}$/i.test(h)) return null; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  const rgb2hex = (r, g, b) => "#" + [r, g, b].map(x => clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0")).join("");
  function rgb2hsv(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? d / mx : 0, mx]; }
  function hsv2rgb(h, s, v) { const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c; let r = 0, g = 0, b = 0; if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; } return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; }
  const recent = () => { try { const a = JSON.parse(localStorage.getItem(RK) || "[]"); return Array.isArray(a) ? a.filter(x => hex2rgb(x)).slice(0, 8) : []; } catch (e) { return []; } };
  /* ألوان الصفحة المفتوحة في المطوّر (بحسب التكرار) كي تُختار دون كتابة HEX */
  function pageColors() {
    try {
      const P = typeof PBApp !== "undefined" && PBApp.E && PBApp.E.page; if (!P) return []; const cnt = new Map(), SKIP = /^(href|url|link|src|id|slug|action|poster|img|image)$/i;
      const add = h => { h = h.toLowerCase(); cnt.set(h, (cnt.get(h) || 0) + 1); };
      const scan = str => { if (str.length > 4000 || /:\/\//.test(str)) return; const re = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z])|rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,\/]+([\d.]+))?/gi; let m; while ((m = re.exec(str))) { if (m[1]) { const h = m[1].length === 3 ? m[1].replace(/(.)/g, "$1$1") : m[1].slice(0, 6); add("#" + h); } else if (m[5] === undefined || parseFloat(m[5]) > 0.05) add(rgb2hex(+m[2], +m[3], +m[4])); } };
      const walk = (v, k, d) => { if (d > 40) return; if (typeof v === "string") { if (!SKIP.test(k || "")) scan(v); } else if (Array.isArray(v)) v.forEach(x => walk(x, k, d + 1)); else if (v && typeof v === "object") for (const kk in v) walk(v[kk], kk, d + 1); };
      walk(P, "", 0); return [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(x => x[0]);
    } catch (e) { return []; }
  }
  const remember = h => { try { const a = [h, ...recent().filter(x => x !== h)].slice(0, 8); localStorage.setItem(RK, JSON.stringify(a)); } catch (e) { } };

  const CSS = `#cpk-bg{position:fixed;inset:0;z-index:100075;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:inherit}
#cpk-box{width:100%;max-width:340px;max-height:94vh;overflow:auto;background:#0c1714;color:#f1f5f2;border:1px solid rgba(255,255,255,.2);border-radius:18px;padding:1rem;box-shadow:0 20px 60px rgba(0,0,0,.55);box-sizing:border-box}
html.white #cpk-box{background:#fdfefb;color:#1f2123;border-color:rgba(0,0,0,.14)}
#cpk-box *{box-sizing:border-box}
#cpk-box h4{margin:0 0 .6rem;font-size:1rem;font-weight:900;color:inherit}
#cpk-sv{position:relative;height:150px;border-radius:12px;touch-action:none;cursor:crosshair;background:linear-gradient(to top,rgb(0,0,0),rgba(0,0,0,0)),linear-gradient(to right,rgb(255,255,255),hsl(var(--cpk-h,0),100%,50%))}
#cpk-sv i,#cpk-cv i{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;border:3px solid rgb(255,255,255);box-shadow:0 0 0 1.5px rgba(0,0,0,.6);pointer-events:none}
#cpk-hue{display:block;width:100%;height:14px;margin:.7rem 0;border-radius:8px;-webkit-appearance:none;appearance:none;background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);touch-action:none}
#cpk-hue::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:rgb(255,255,255);border:2px solid rgba(0,0,0,.55)}
#cpk-hue::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:rgb(255,255,255);border:2px solid rgba(0,0,0,.55)}
.cpk-row{display:flex;gap:.5rem;align-items:center;margin:.55rem 0}
#cpk-prev{width:42px;height:38px;flex:none;border-radius:10px;border:1px solid rgba(128,128,128,.55)}
#cpk-hex{flex:1;min-width:0;direction:ltr;text-align:center;font-weight:800;font-size:1rem;padding:.45rem;border-radius:10px;border:1px solid rgba(128,128,128,.5);background:rgba(128,128,128,.12);color:inherit;font-family:inherit}
#cpk-eye{flex:none;border:1px solid rgba(128,128,128,.5);background:rgba(128,128,128,.12);color:inherit;border-radius:10px;padding:.45rem .7rem;font-weight:800;font-family:inherit;cursor:pointer;display:inline-flex;gap:.35rem;align-items:center}
.cpk-sw{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}
.cpk-sw button{aspect-ratio:1;border-radius:8px;border:1px solid rgba(128,128,128,.55);padding:0;cursor:pointer}
.cpk-lb{font-size:.78rem;font-weight:800;opacity:.7;margin:.6rem 0 .3rem}
#cpk-img{display:none;margin:.5rem 0}
#cpk-cv{position:relative;touch-action:none;cursor:crosshair;border-radius:10px;overflow:hidden;border:1px solid rgba(128,128,128,.5)}
#cpk-cv canvas{display:block;width:100%;height:auto}
#cpk-hint{font-size:.78rem;opacity:.75;margin:.3rem 0 0}
.cpk-act{display:flex;gap:.5rem;margin-top:.8rem}
.cpk-act button{flex:1;padding:.65rem;font-weight:900;font-family:inherit;border-radius:14px;cursor:pointer;font-size:.95rem}
.cpk-no{background:rgba(128,128,128,.15);color:inherit;border:1px solid rgba(128,128,128,.45)}
.cpk-ok{background:linear-gradient(180deg,#effe17,#e2fe17);color:#1f2123;border:0}`;

  function close(cancel) {
    if (!S) return; const s = S; S = null;
    document.removeEventListener("keydown", s.kd, true); s.bg.remove();
    const el = s.el;
    if (cancel) { if (el.value !== s.orig) { el.value = s.orig; fire(el, "input"); fire(el, "change"); } }
    else { remember(s.hex); if (el.value !== s.hex) el.value = s.hex; fire(el, "input"); fire(el, "change"); }
  }
  function fire(el, t) { try { el.dispatchEvent(new Event(t, { bubbles: true })); } catch (e) { } }

  function open(el) {
    if (S) close(true);
    if (!document.getElementById("cpk-css")) { const st = document.createElement("style"); st.id = "cpk-css"; st.textContent = CSS; document.head.appendChild(st); }
    const orig = (hex2rgb(el.value) ? el.value.toLowerCase() : "#000000"), rgb = hex2rgb(orig), hsv = rgb2hsv(rgb[0], rgb[1], rgb[2]);
    const bg = document.createElement("div"); bg.id = "cpk-bg";
    const rec = recent(), pg = pageColors();
    bg.innerHTML = `<div id="cpk-box" role="dialog" aria-modal="true"><h4>اختيار اللون</h4>
<div id="cpk-sv"><i></i></div><input type="range" id="cpk-hue" min="0" max="360" step="1" aria-label="${T("درجة اللون")}">
<div class="cpk-row"><span id="cpk-prev"></span><input id="cpk-hex" type="text" maxlength="7" spellcheck="false" autocomplete="off" aria-label="HEX"><button type="button" id="cpk-eye">قطّارة</button></div>
<div id="cpk-img"><div id="cpk-cv"><canvas></canvas><i style="display:none"></i></div><div id="cpk-hint">المس الصورة لالتقاط اللون</div></div>
${pg.length ? `<div class="cpk-lb">ألوان الصفحة</div><div class="cpk-sw" id="cpk-pg">${pg.map(c => `<button type="button" data-c="${c}" style="background:${c} !important" title="${c}"></button>`).join("")}</div>` : ""}
${rec.length ? `<div class="cpk-lb">آخر الألوان</div><div class="cpk-sw" id="cpk-rec">${rec.map(c => `<button type="button" data-c="${c}" style="background:${c} !important" title="${c}"></button>`).join("")}</div>` : ""}
<div class="cpk-lb">ألوان سريعة</div><div class="cpk-sw" id="cpk-bas">${BASIC.map(c => `<button type="button" data-c="${c}" style="background:${c} !important" title="${c}"></button>`).join("")}</div>
<div class="cpk-act"><button type="button" class="cpk-no">إلغاء</button><button type="button" class="cpk-ok">تعيين</button></div></div>`;
    document.body.appendChild(bg);
    const $ = s => bg.querySelector(s), sv = $("#cpk-sv"), knob = sv.querySelector("i"), hue = $("#cpk-hue"), hexIn = $("#cpk-hex"), prev = $("#cpk-prev");
    const st = S = { el, bg, orig, hex: orig, h: hsv[0], s: hsv[1], v: hsv[2], kd: null };
    const paint = (fromHex) => {
      const c = hsv2rgb(st.h, st.s, st.v); st.hex = rgb2hex(c[0], c[1], c[2]);
      sv.style.setProperty("--cpk-h", st.h); knob.style.left = (st.s * 100) + "%"; knob.style.top = ((1 - st.v) * 100) + "%"; hue.value = Math.round(st.h); prev.style.background = st.hex; if (!fromHex) hexIn.value = st.hex.toUpperCase();
      el.value = st.hex; fire(el, "input");
    };
    const setHex = (h, fromHex) => { const c = hex2rgb(h); if (!c) return false; const v = rgb2hsv(c[0], c[1], c[2]); if (v[1] > 0 && v[2] > 0) st.h = v[0]; st.s = v[1]; st.v = v[2]; paint(fromHex); if (!fromHex) hexIn.value = rgb2hex(c[0], c[1], c[2]).toUpperCase(); return true; };
    const svPos = e => { const r = sv.getBoundingClientRect(); st.s = clamp((e.clientX - r.left) / r.width, 0, 1); st.v = 1 - clamp((e.clientY - r.top) / r.height, 0, 1); paint(); };
    let dragging = false; sv.addEventListener("pointerdown", e => { dragging = true; try { sv.setPointerCapture(e.pointerId); } catch (x) { } svPos(e); e.preventDefault(); });
    sv.addEventListener("pointermove", e => { if (dragging) svPos(e); }); sv.addEventListener("pointerup", () => { dragging = false; }); sv.addEventListener("pointercancel", () => { dragging = false; });
    hue.addEventListener("input", () => { st.h = +hue.value; paint(); });
    hexIn.addEventListener("input", () => { let v = hexIn.value.trim(); if (v && v[0] !== "#") v = "#" + v; if (hex2rgb(v) && v.length >= 4) setHex(v, true); });
    hexIn.addEventListener("blur", () => { hexIn.value = st.hex.toUpperCase(); });
    bg.querySelectorAll(".cpk-sw button").forEach(b => b.addEventListener("click", () => setHex(b.dataset.c)));
    $(".cpk-no").onclick = () => close(true); $(".cpk-ok").onclick = () => close(false);
    bg.addEventListener("pointerdown", e => { if (e.target === bg) st._bgd = true; }); bg.addEventListener("click", e => { if (e.target === bg && st._bgd) close(true); });
    st.kd = e => { const k = String(e.key || ""); if (k === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); } else if (k === "Enter" && e.target !== $(".cpk-no")) { e.preventDefault(); e.stopPropagation(); close(false); } };
    document.addEventListener("keydown", st.kd, true);

    /* القطّارة */
    const eye = $("#cpk-eye"), imgBox = $("#cpk-img"), cv = $("#cpk-cv"), canvas = cv.querySelector("canvas"), dot = cv.querySelector("i");
    const fromImage = () => {
      const f = document.createElement("input"); f.type = "file"; f.accept = "image/*"; f.setAttribute("data-native-color", "1");
      f.onchange = () => { const file = f.files && f.files[0]; if (!file) return; const url = URL.createObjectURL(file), im = new Image(); im.onload = () => { const w = Math.min(im.naturalWidth, 900), h = Math.round(im.naturalHeight * w / im.naturalWidth); canvas.width = w; canvas.height = h; const cx = canvas.getContext("2d", { willReadFrequently: true }); cx.drawImage(im, 0, 0, w, h); URL.revokeObjectURL(url); imgBox.style.display = "block"; try { sv.scrollIntoView({ block: "nearest" }); } catch (x) { } }; im.onerror = () => URL.revokeObjectURL(url); im.src = url; };
      f.click();
    };
    const pickAt = e => { const r = canvas.getBoundingClientRect(), x = clamp(Math.floor((e.clientX - r.left) * canvas.width / r.width), 0, canvas.width - 1), y = clamp(Math.floor((e.clientY - r.top) * canvas.height / r.height), 0, canvas.height - 1); try { const d = canvas.getContext("2d").getImageData(x, y, 1, 1).data; dot.style.display = "block"; dot.style.left = ((e.clientX - r.left) / r.width * 100) + "%"; dot.style.top = ((e.clientY - r.top) / r.height * 100) + "%"; setHex(rgb2hex(d[0], d[1], d[2])); } catch (x2) { } };
    let pk = false; cv.addEventListener("pointerdown", e => { pk = true; try { cv.setPointerCapture(e.pointerId); } catch (x) { } pickAt(e); e.preventDefault(); }); cv.addEventListener("pointermove", e => { if (pk) pickAt(e); }); cv.addEventListener("pointerup", () => { pk = false; }); cv.addEventListener("pointercancel", () => { pk = false; });
    eye.onclick = async () => {
      if (window.EyeDropper) { bg.style.opacity = "0"; bg.style.pointerEvents = "none"; try { const r = await new window.EyeDropper().open(); if (S === st && r && r.sRGBHex) setHex(r.sRGBHex); } catch (e) { } if (S === st) { bg.style.opacity = ""; bg.style.pointerEvents = ""; } }
      else fromImage();
    };
    if (!window.EyeDropper) eye.title = T("اختر صورة أو لقطة شاشة ثم المس اللون");
    hexIn.value = orig.toUpperCase(); prev.style.background = orig; sv.style.setProperty("--cpk-h", st.h); knob.style.left = (st.s * 100) + "%"; knob.style.top = ((1 - st.v) * 100) + "%"; hue.value = Math.round(st.h);
  }

  function onClick(e) {
    const el = e.target && e.target.closest ? e.target.closest('input[type="color"]') : null;
    if (!el || el.disabled || el.hasAttribute("data-native-color")) return;
    e.preventDefault(); e.stopPropagation(); open(el);
  }
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", e => { const k = String(e.key || ""); const el = e.target; if ((k === "Enter" || k === " ") && el && el.matches && el.matches('input[type="color"]') && !el.disabled && !el.hasAttribute("data-native-color")) { e.preventDefault(); e.stopPropagation(); open(el); } }, true);
  window.AdminColorPick = { open, close: () => close(true), hex2rgb, rgb2hex };
  return window.AdminColorPick;
})();
