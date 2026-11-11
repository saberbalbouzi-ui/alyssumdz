/* معاينة مظهر هولوغرافي ثلاثي الأبعاد — بيانات تجريبية، لا اتصال بأي API أو قاعدة بيانات */
(() => {
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const world = $("#world"), fit = $("#fit"), mobile = () => innerWidth <= 820;

  /* أبعاد/إزاحات Z من data-* */
  $$(".pane,.pop").forEach(el => {
    el.style.setProperty("--z", (el.dataset.z || 0) + "px"); el.style.setProperty("--d", el.dataset.d || 1);
    if (el.dataset.dz) el.style.setProperty("--dz", el.dataset.dz + "px");
  });
  /* سُمك الزجاج: طبقات خلفية حقيقية في Z */
  $$(".pane:not(.back)").forEach(p => { for (let i = 4; i >= 1; i--) { const s = document.createElement("i"); s.className = "slab s" + i; p.prepend(s); } });

  /* منحنى المبيعات */
  const vals = [4.2, 7.8, 11.5, 9.4, 13.8, 16.3, 11.9], W = 560, H = 230, max = 20;
  const pts = vals.map((v, i) => [i * (W / (vals.length - 1)) * .96 + 10, H - (v / max) * H * .92 - 8]);
  const sm = pts.map((p, i) => { if (!i) return "M" + p; const q = pts[i - 1], cx = (q[0] + p[0]) / 2; return "C" + cx + " " + q[1] + " " + cx + " " + p[1] + " " + p[0] + " " + p[1]; }).join(" ");
  $("#c-line").setAttribute("d", sm); $("#c-area").setAttribute("d", sm + ` L${pts[pts.length - 1][0]} ${H} L${pts[0][0]} ${H}Z`);
  $("#c-dots").innerHTML = pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === 5 ? 7 : 4.5}" fill="${i === 5 ? "#fff" : "#e3ff3a"}" stroke="#e3ff3a" stroke-width="2"/>`).join("");
  $(".gridl").innerHTML = [0, 1, 2, 3, 4].map(i => `<line x1="0" x2="${W}" y1="${i * H / 4}" y2="${i * H / 4}"/>`).join("");

  /* أعمدة + خريطة حرارية */
  const bars = [40, 62, 48, 80, 66, 92, 58, 76, 100, 70];
  $("#bars").innerHTML = bars.map((b, i) => `<rect x="${i * 30 + 3}" y="${110 - b * 1.0}" width="22" height="${b}" rx="4" fill="${i % 3 === 2 ? "#a58bff" : "#2be4ff"}" fill-opacity=".8"/>`).join("");
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  $("#heat").innerHTML = Array.from({ length: 60 }, () => { const v = rnd(); return `<i style="--hc:${v > .72 ? "#dcff1f" : v > .45 ? "#2be4ff" : v > .22 ? "rgba(165,139,255,.8)" : "rgba(255,255,255,.12)"}"></i>`; }).join("");
  $("#ghost-body").innerHTML = Array.from({ length: 20 }, () => "<i></i>").join("");

  /* ملاءمة العرض + بارالاكس بالمؤشر مع انجراف هادئ */
  function size() { const s = mobile() ? 1 : Math.min(innerWidth / 1440, innerHeight / 900, 1.15) * .9; fit.style.setProperty("--s", s); netSize(); }
  let tx = 0, ty = 0, cx = 0, cy = 0, last = 0;
  addEventListener("pointermove", e => { tx = (e.clientX / innerWidth - .5) * 2; ty = (e.clientY / innerHeight - .5) * 2; last = performance.now(); }, { passive: true });
  function tick(t) {
    if (t - last > 3000) { tx = Math.sin(t / 3800) * .55; ty = Math.cos(t / 5200) * .35; }
    cx += (tx - cx) * .06; cy += (ty - cy) * .06;
    if (!mobile() && !matchMedia("(prefers-reduced-motion:reduce)").matches) { world.style.setProperty("--mx", cx.toFixed(3)); world.style.setProperty("--my", cy.toFixed(3)); $$(".pane,.pop").forEach(el => { el.style.setProperty("--mx", cx.toFixed(3)); el.style.setProperty("--my", cy.toFixed(3)); }); }
    drawNet(t); requestAnimationFrame(tick);
  }

  /* شبكة عُقد في الخلفية */
  const cv = $("#net"), g = cv.getContext("2d"); let nodes = [], nw = 0, nh = 0;
  function netSize() { nw = cv.width = innerWidth; nh = cv.height = innerHeight; nodes = Array.from({ length: mobile() ? 26 : 56 }, () => ({ x: rnd() * nw, y: rnd() * nh, vx: (rnd() - .5) * .25, vy: (rnd() - .5) * .25, r: 1 + rnd() * 2.2 })); }
  function drawNet() {
    g.clearRect(0, 0, nw, nh);
    nodes.forEach(n => { n.x += n.vx; n.y += n.vy; if (n.x < 0 || n.x > nw) n.vx *= -1; if (n.y < 0 || n.y > nh) n.vy *= -1; });
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const a = nodes[i], b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y); if (d < 170) { g.strokeStyle = `rgba(120,255,220,${.28 * (1 - d / 170)})`; g.lineWidth = 1; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); } }
    nodes.forEach(n => { g.fillStyle = "rgba(190,255,230,.85)"; g.shadowColor = "#6dffd0"; g.shadowBlur = 8; g.beginPath(); g.arc(n.x, n.y, n.r, 0, 7); g.fill(); }); g.shadowBlur = 0;
  }
  addEventListener("resize", size); size(); requestAnimationFrame(tick);
})();
