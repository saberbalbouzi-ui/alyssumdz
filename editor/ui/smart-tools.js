/* أدوات التحديد اليدوي (فرشاة/ممحاة القناع/مستطيل/لاسو) + «استخراج» و«إزالة» على طبقة صورة. كله محلي. القناع قابل لإعادة الاستعمال حتى تمسحه. */
(function () {
  const Ed = window.Ed; const $ = id => document.getElementById(id);
  const M = Ed.mask = { on: false, tool: "brush", img: null, cv: null, ov: null, size: 40 };
  function pickImage() {
    const a = Ed.selected(); if (a && a.type === "image") return a;
    const vis = Ed.c.getObjects().filter(o => o.type === "image" && o.visible !== false && !o.locked); return vis.sort((p, q) => q.getScaledWidth() * q.getScaledHeight() - p.getScaledWidth() * p.getScaledHeight())[0] || null;
  }
  function ensureOverlay() {
    const host = Ed.c.getElement().parentNode; if (!M.ov) { M.ov = document.createElement("canvas"); M.ov.id = "mask-ov"; M.ov.style.cssText = "position:absolute;left:0;top:0;z-index:20;cursor:crosshair;touch-action:none"; }
    if (M.ov.parentNode !== host) host.appendChild(M.ov); const w = Math.round(Ed.doc.width * Ed.zoom), h = Math.round(Ed.doc.height * Ed.zoom); if (M.ov.width !== w || M.ov.height !== h) { M.ov.width = w; M.ov.height = h; M.ov.style.width = w + "px"; M.ov.style.height = h + "px"; }
  }
  function draw(extra) {
    if (!M.on || !M.img) return; ensureOverlay(); const g = M.ov.getContext("2d"), im = M.img; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, M.ov.width, M.ov.height);
    const m = im.calcTransformMatrix(); g.setTransform(Ed.zoom, 0, 0, Ed.zoom, 0, 0); g.transform(m[0], m[1], m[2], m[3], m[4], m[5]); g.translate(-im.width / 2, -im.height / 2);
    g.globalAlpha = .5; g.drawImage(M.cv, 0, 0); g.globalAlpha = 1; g.strokeStyle = "#7c3aed"; g.lineWidth = 2 / Ed.zoom / Math.abs(im.scaleX); g.setLineDash([8 / Ed.zoom, 6 / Ed.zoom]); g.strokeRect(0, 0, im.width, im.height);
    if (extra) extra(g);
  }
  function local(ev) { const r = M.ov.getBoundingClientRect(); return Ed.px.fromDoc(M.img, (ev.clientX - r.left) / Ed.zoom, (ev.clientY - r.top) / Ed.zoom); }
  const radius = () => (M.size / 2) / Ed.zoom / Math.abs(M.img.scaleX || 1);
  function stroke(pts, erase) { const g = M.cv.getContext("2d"); g.save(); g.globalCompositeOperation = erase ? "destination-out" : "source-over"; g.strokeStyle = g.fillStyle = "#ff2d55"; g.lineCap = g.lineJoin = "round"; g.lineWidth = radius() * 2; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); if (pts.length === 1) { g.arc(pts[0].x, pts[0].y, radius(), 0, 7); g.fill(); } else g.stroke(); g.restore(); }
  function poly(pts, erase) { const g = M.cv.getContext("2d"); g.save(); g.globalCompositeOperation = erase ? "destination-out" : "source-over"; g.fillStyle = "#ff2d55"; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.fill(); g.restore(); }
  function bind() {
    let cur = null;
    M.ov.onpointerdown = e => { e.preventDefault(); M.ov.setPointerCapture(e.pointerId); const p = local(e); cur = { pts: [p], start: p, erase: M.tool === "erase" }; if (M.tool === "brush" || M.tool === "erase") { stroke(cur.pts, cur.erase); draw(); } };
    M.ov.onpointermove = e => { if (!cur) return; const p = local(e); if (M.tool === "brush" || M.tool === "erase") { cur.pts.push(p); stroke(cur.pts.slice(-2), cur.erase); draw(); } else if (M.tool === "rect") { cur.end = p; draw(g => { g.strokeStyle = "#ff2d55"; g.lineWidth = 2 / Ed.zoom / Math.abs(M.img.scaleX); g.setLineDash([]); const a = cur.start; g.strokeRect(Math.min(a.x, p.x), Math.min(a.y, p.y), Math.abs(p.x - a.x), Math.abs(p.y - a.y)); }); } else if (M.tool === "lasso") { cur.pts.push(p); draw(g => { g.strokeStyle = "#ff2d55"; g.lineWidth = 2 / Ed.zoom / Math.abs(M.img.scaleX); g.setLineDash([]); g.beginPath(); cur.pts.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); g.stroke(); }); } };
    M.ov.onpointerup = e => { if (!cur) return; const p = local(e); if (M.tool === "rect") { const a = cur.start; poly([{ x: a.x, y: a.y }, { x: p.x, y: a.y }, { x: p.x, y: p.y }, { x: a.x, y: p.y }]); } else if (M.tool === "lasso" && cur.pts.length > 2) poly(cur.pts); cur = null; draw(); };
  }
  function setTool(t) { M.tool = t; document.querySelectorAll("[data-mask]").forEach(b => b.classList.toggle("on", b.dataset.mask === t)); }
  function enter(tool) {
    if (!M.on) {
      const img = pickImage(); if (!img) return Ed.toast("أضف صورة أولاً ثم اختر أداة التحديد");
      M.img = img; M.cv = document.createElement("canvas"); M.cv.width = img.width; M.cv.height = img.height; M.on = true; Ed.c.discardActiveObject(); Ed.c.selection = false; Ed.c.skipTargetFind = true;
      ensureOverlay(); bind(); $("maskbar").classList.add("on"); document.body.classList.add("masking");
    }
    setTool(tool); draw();
  }
  function exit() { M.on = false; M.img = null; if (M.ov && M.ov.parentNode) M.ov.parentNode.removeChild(M.ov); Ed.c.selection = true; Ed.c.skipTargetFind = false; $("maskbar").classList.remove("on"); document.body.classList.remove("masking"); document.querySelectorAll("[data-mask]").forEach(b => b.classList.remove("on")); Ed.c.requestRenderAll(); }
  function clear() { if (M.cv) { M.cv.getContext("2d").clearRect(0, 0, M.cv.width, M.cv.height); draw(); } }
  Ed.maskTools = { enter, exit, clear, active: () => M.on };
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-mask]").forEach(b => b.addEventListener("click", () => enter(b.dataset.mask)));
    $("mk-size").addEventListener("input", e => { M.size = +e.target.value; $("mk-sz").textContent = M.size; });
    $("mk-clear").onclick = clear; $("mk-exit").onclick = exit;
    $("mk-extract").onclick = () => { if (!M.on) return; try { const L = Ed.px.extract(M.img, M.cv); if (!L) return Ed.toast("حدّد منطقة أولاً"); const idx = Ed.c.getObjects().indexOf(M.img); Ed.add(L, { select: false }); L.moveTo(idx + 1 + (Ed.c.getObjects().filter(o => o.role === "object").length > 1 ? 1 : 0)); Ed.c.setActiveObject(L); clear(); Ed.toast("تم استخراج العنصر كطبقة مستقلة"); Ed.emit("changed", "extract"); draw(); } catch (e) { console.error(e); Ed.toast("⚠️ " + e.message, 3500); } };
    $("mk-remove").onclick = () => { if (!M.on) return; try { if (!Ed.px.remove(M.img, M.cv)) return Ed.toast("حدّد منطقة أولاً"); clear(); Ed.toast("تمت الإزالة وملء الخلفية"); Ed.emit("changed", "remove"); } catch (e) { console.error(e); Ed.toast("⚠️ " + e.message, 3500); } };
  });
  Ed.on("zoom", () => draw());
  window.addEventListener("keydown", e => { if (M.on && e.key === "Escape") { e.stopPropagation(); exit(); } }, true);
})();
