/* كشف عناصر الصورة المسطحة (بلا شبكة): أسطر النص بتحليل الصورة + ألوان الحبر. المنتجات/الأشخاص تأتي في المرحلة 4. */
(function () {
  const Ed = window.Ed;
  const hx = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  Ed.detect = {
    colorDist(a, b) { const p = hx(a), q = hx(b); return Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]); },
    texts(canvas) { return ImageTools.detectText(canvas); },
    /* دمج الأسطر المتجاورة المتشابهة في فقرة واحدة قابلة للتحرير */
    paragraphs(items, W) {
      const out = []; items.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
      for (const it of items) {
        const h = it.y1 - it.y0, cx = (it.x0 + it.x1) / 2; let hit = null;
        for (let i = out.length - 1; i >= 0 && i >= out.length - 6; i--) {
          const g = out[i], last = g.lines[g.lines.length - 1], lh = last.y1 - last.y0, gap = it.y0 - last.y1;
          const sameH = Math.abs(h - lh) <= .28 * Math.max(h, lh), near = gap >= -h * .2 && gap < .95 * Math.max(h, lh), lc = (last.x0 + last.x1) / 2;
          const aligned = Math.abs(cx - lc) < W * .06 || Math.abs(it.x0 - last.x0) < W * .03 || Math.abs(it.x1 - last.x1) < W * .03;
          if (sameH && near && aligned && Ed.detect.colorDist(it.ink, last.ink) < 100) { hit = g; break; }
        }
        if (hit) hit.lines.push(it); else out.push({ lines: [it] });
      }
      return out;
    }
  };
})();
