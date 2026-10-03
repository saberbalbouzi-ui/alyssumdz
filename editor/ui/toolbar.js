(function () {
  const Ed = window.Ed; const $ = id => document.getElementById(id);
  function guard(fn) { return async function () { try { return await fn.apply(this, arguments); } catch (e) { console.error(e); Ed.toast("⚠️ " + e.message, 3500); } }; }
  document.addEventListener("DOMContentLoaded", () => {
    // قوائم الأشكال والأيقونات
    $("pop-icon").innerHTML = Object.keys(Ed.ICONS).map(k => '<button data-icon="' + k + '" title="' + k + '"><svg viewBox="0 0 24 24" width="28" height="28"><path d="' + Ed.ICONS[k] + '" fill="#7c3aed"/></svg></button>').join("");
    document.querySelectorAll(".menu > .tool").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); const m = b.parentNode, on = m.classList.contains("open"); document.querySelectorAll(".menu.open").forEach(x => x.classList.remove("open")); if (!on) m.classList.add("open"); }));
    document.addEventListener("click", () => document.querySelectorAll(".menu.open").forEach(x => x.classList.remove("open")));
    $("pop-shape").addEventListener("click", e => { const b = e.target.closest("[data-shape]"); if (b) Ed.addShape(b.dataset.shape); });
    $("pop-icon").addEventListener("click", e => { const b = e.target.closest("[data-icon]"); if (b) Ed.addIcon(b.dataset.icon); });
    document.querySelectorAll("[data-tool]").forEach(b => b.addEventListener("click", guard(async () => {
      const t = b.dataset.tool;
      if (t === "text") { await Ed.loadFont("Cairo"); Ed.addText(); } else if (t === "image") $("f-img").click(); else if (t === "button") { await Ed.loadFont("Cairo"); Ed.addButton(); }
      else if (t === "select") { Ed.c.discardActiveObject(); Ed.c.requestRenderAll(); }
    })));
    $("t-decomp").onclick = guard(async () => Ed.decomp.runUI());
    $("t-dup").onclick = () => { const o = Ed.selected(); if (o) Ed.layers.duplicate(o); };
    $("t-del").onclick = () => { const l = Ed.selectedList(); if (l.length) Ed.layers.remove(l); };
    $("f-img").addEventListener("change", guard(async e => { for (const f of e.target.files) await Ed.addImageFile(f); e.target.value = ""; }));
    $("f-rep").addEventListener("change", guard(async e => { const o = Ed.selected(); if (o && o.type === "image" && e.target.files[0]) await Ed.replaceImage(o, e.target.files[0]); e.target.value = ""; }));
    // أعلى الصفحة
    $("b-undo").onclick = () => Ed.history.undo(); $("b-redo").onclick = () => Ed.history.redo();
    $("b-zin").onclick = () => Ed.setZoom(Ed.zoom * 1.2, true); $("b-zout").onclick = () => Ed.setZoom(Ed.zoom / 1.2, true); $("b-fit").onclick = () => Ed.setZoom(Ed.fitZoom());
    $("b-save").onclick = () => { Ed.saveFile(); Ed.toast("تم تنزيل ملف التصميم"); };
    $("b-open").onclick = () => $("f-open").click();
    $("f-open").addEventListener("change", guard(async e => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; if (f.size > 200 * 1024 * 1024) throw new Error("الملف كبير جداً"); const doc = JSON.parse(await f.text()); Ed.history.flush(); await Ed.deserialize(doc); Ed.history.reset(); Ed.emit("changed", "open"); Ed.toast("فُتح التصميم"); }));
    $("b-new").onclick = guard(async () => { const v = await Ed.newDocDialog(); if (!v) return; Ed.newDoc(v.w, v.h, v.bg); Ed.history.reset(); Ed.toast("تصميم جديد " + Ed.doc.width + "×" + Ed.doc.height); });
    $("b-prev").onclick = guard(async () => Ed.previewDialog());
    $("b-png").onclick = guard(async () => Ed.exportImage("png")); $("b-jpg").onclick = guard(async () => Ed.exportImage("jpeg"));
    Ed.on("zoom", z => { $("zoomlbl").textContent = Math.round(z * 100) + "%"; });
    const hs = () => { $("b-undo").disabled = !Ed.history.canUndo(); $("b-redo").disabled = !Ed.history.canRedo(); }; Ed.on("history", hs); hs();
    // سحب وإسقاط ملفات صور على المنصة
    const st = $("stage"); st.addEventListener("dragover", e => { if ([...(e.dataTransfer.types || [])].includes("Files")) e.preventDefault(); });
    st.addEventListener("drop", guard(async e => { const fs = [...(e.dataTransfer.files || [])].filter(f => /^image\//.test(f.type)); if (!fs.length) return; e.preventDefault(); for (const f of fs) await Ed.addImageFile(f); }));
  });
})();
