/* كشف أسطر النص وفقراتها — مشترك: assets/js/text-capture.js */
(function () {
  const Ed = window.Ed;
  Ed.detect = { colorDist: TextCapture.colorDist, texts: c => TextCapture.detect(c), paragraphs: (items, W) => TextCapture.paragraphs(items, W) };
})();
