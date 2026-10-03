/* التحديد والحركة بلوحة المفاتيح والتحكم بالتكبير/التحريك */
(function () {
  const Ed = window.Ed;
  Ed.selected = () => { const a = Ed.c.getActiveObject(); return a || null; };
  Ed.selectedList = () => { const a = Ed.c.getActiveObject(); if (!a) return []; return a.type === "activeSelection" ? a.getObjects() : [a]; };
  Ed.selectAll = () => { const os = Ed.c.getObjects().filter(o => o.selectable && o.visible !== false); if (!os.length) return; Ed.c.discardActiveObject(); const s = new fabric.ActiveSelection(os, { canvas: Ed.c }); Ed.c.setActiveObject(s); Ed.c.requestRenderAll(); };
  Ed.nudge = (dx, dy) => { const a = Ed.selected(); if (!a || a.locked) return; a.set({ left: a.left + dx, top: a.top + dy }); a.setCoords(); Ed.c.requestRenderAll(); Ed.emit("live"); Ed.history.push(); };
  /* تحريك اللوحة: مسافة + سحب، وتكبير بـ Ctrl+عجلة */
  Ed.initPanZoom = function (stage) {
    let pan = null, space = false;
    window.addEventListener("keydown", e => { if (e.code === "Space" && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName) && !(Ed.c.getActiveObject() || {}).isEditing) { space = true; stage.classList.add("pan"); e.preventDefault(); } });
    window.addEventListener("keyup", e => { if (e.code === "Space") { space = false; stage.classList.remove("pan"); } });
    stage.addEventListener("mousedown", e => { if (space || e.button === 1) { pan = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop }; e.preventDefault(); e.stopPropagation(); } }, true);
    window.addEventListener("mousemove", e => { if (pan) { stage.scrollLeft = pan.sl - (e.clientX - pan.x); stage.scrollTop = pan.st - (e.clientY - pan.y); } });
    window.addEventListener("mouseup", () => { pan = null; });
    stage.addEventListener("wheel", e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); Ed.setZoom(Ed.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), true); } }, { passive: false });
  };
})();
