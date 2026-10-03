/* لوحة الطبقات: الأعلى = الأمام. سحب لإعادة الترتيب، عين/قفل/إعادة تسمية/تكرار/حذف. */
(function () {
  const Ed = window.Ed; let dragId = null;
  const ICON = { text: "T", image: "🖼", shape: "◼", svg: "◈", group: "▣", button: "▬", icon: "✦", background: "▭" };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function render() {
    if (!Ed.c) return; const box = document.getElementById("layers"); if (!box || box.querySelector("input")) return;      // لا نعيد البناء أثناء إعادة التسمية
    const objs = Ed.c.getObjects(), sel = new Set(Ed.selectedList());
    document.getElementById("lcount").textContent = "(" + objs.length + ")";
    box.innerHTML = objs.map((o, i) => ({ o, i })).reverse().map(({ o, i }) => {
      const bg = o.layerType === "background";
      return '<div class="lrow' + (sel.has(o) ? " sel" : "") + (o.visible === false ? " hid" : "") + '" data-id="' + o.id + '" draggable="' + (bg ? "false" : "true") + '"><span class="ty">' + (ICON[o.layerType] || "•") + '</span><span class="nm" title="انقر مرتين لإعادة التسمية">' + esc(o.name) + '</span>' +
        '<button class="ic" data-a="vis" title="إظهار/إخفاء">' + (o.visible === false ? "🚫" : "👁") + '</button><button class="ic" data-a="lock" title="قفل">' + (o.locked ? "🔒" : "🔓") + "</button>" +
        (bg ? "" : '<button class="ic" data-a="dup" title="تكرار">⧉</button><button class="ic" data-a="del" title="حذف">✕</button>') + "</div>";
    }).join("");
  }
  const byId = id => Ed.c.getObjects().find(o => o.id === id);
  document.addEventListener("DOMContentLoaded", () => {
    const box = document.getElementById("layers");
    box.addEventListener("click", e => {
      const row = e.target.closest(".lrow"); if (!row) return; const o = byId(row.dataset.id); if (!o) return; const a = e.target.closest("[data-a]");
      if (a) { const k = a.dataset.a; if (k === "vis") Ed.layers.toggleVisible(o); else if (k === "lock") Ed.layers.toggleLock(o); else if (k === "dup") Ed.layers.duplicate(o); else if (k === "del") Ed.layers.remove(o); return; }
      if (o.visible === false || Ed.c.getActiveObject() === o) return; Ed.c.discardActiveObject(); Ed.c.setActiveObject(o); Ed.c.requestRenderAll();
    });
    box.addEventListener("dblclick", e => {
      const nm = e.target.closest(".nm"); if (!nm) return; const row = nm.closest(".lrow"), o = byId(row.dataset.id); if (!o || o.layerType === "background") return;
      const inp = document.createElement("input"); inp.value = o.name; nm.innerHTML = ""; nm.appendChild(inp); inp.focus(); inp.select();
      const done = ok => { if (ok) Ed.layers.rename(o, inp.value); else render(); }; inp.onkeydown = ev => { if (ev.key === "Enter") done(true); if (ev.key === "Escape") done(false); ev.stopPropagation(); }; inp.onblur = () => done(true);
    });
    box.addEventListener("dragstart", e => { const row = e.target.closest(".lrow"); if (!row) return; dragId = row.dataset.id; row.classList.add("drag"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); });
    box.addEventListener("dragend", () => { dragId = null; box.querySelectorAll(".drag,.over").forEach(r => r.classList.remove("drag", "over")); });
    box.addEventListener("dragover", e => { const row = e.target.closest(".lrow"); if (!row || !dragId) return; e.preventDefault(); box.querySelectorAll(".over").forEach(r => r.classList.remove("over")); row.classList.add("over"); });
    box.addEventListener("drop", e => {
      const row = e.target.closest(".lrow"); if (!row || !dragId) return; e.preventDefault(); const o = byId(dragId), t = byId(row.dataset.id); if (!o || !t || o === t) return;
      Ed.layers.moveTo(o, Ed.c.getObjects().indexOf(t));                                  // يوضع مكان الهدف (فوقه في الترتيب)
    });
  });
  ["layers", "selection", "object:added", "object:removed"].forEach(ev => Ed.on(ev, () => { clearTimeout(render._t); render._t = setTimeout(render, 0); }));
  Ed.on("selection:created", render); Ed.on("selection:updated", render); Ed.on("selection:cleared", render); Ed.on("doc", render);
})();
