/* التصدير بأبعاد المستند الأصلية (لا بأبعاد العرض المكبّر). المرحلة 6 لاحقاً: HTML/ZIP. */
(function () {
  const Ed = window.Ed;
  function dl(href, name) { const a = document.createElement("a"); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  Ed.exportDataURL = function (format, quality) {
    Ed.c.discardActiveObject(); Ed.c.renderAll();
    return Ed.c.toDataURL({ format: format === "jpeg" ? "jpeg" : "png", quality: quality || .92, multiplier: 1 / Ed.zoom, enableRetinaScaling: false });
  };
  Ed.exportImage = function (format) { const url = Ed.exportDataURL(format), n = (Ed.projectName || "design").replace(/[^\w؀-ۿ-]+/g, "_"); dl(url, n + "." + (format === "jpeg" ? "jpg" : "png")); };
  Ed.saveFile = function () {
    const blob = new Blob([JSON.stringify(Ed.serialize({ embed: true }))], { type: "application/json" }), u = URL.createObjectURL(blob);
    dl(u, (Ed.projectName || "design").replace(/[^\w؀-ۿ-]+/g, "_") + ".alyssum.json"); setTimeout(() => URL.revokeObjectURL(u), 3000);
  };
})();
