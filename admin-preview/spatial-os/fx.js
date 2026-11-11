/* جسيمات الخلفية ودفقات الظهور/التلاشي (Canvas 2D خفيف) */
const FX = (() => {
  const cv = document.getElementById("fx"), g = cv.getContext("2d"), RM = matchMedia("(prefers-reduced-motion:reduce)").matches;
  let W = 0, H = 0, dpr = 1, amb = [], bursts = [], run = true;
  const mobile = () => innerWidth <= 820, rnd = (a, b) => a + Math.random() * (b - a);
  function size() { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); const n = RM ? 12 : mobile() ? 38 : 90; amb = Array.from({ length: n }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(.6, 2.2), vy: -rnd(.08, .35), vx: rnd(-.08, .08), a: rnd(.25, .85), c: Math.random() < .3 ? "220,255,31" : "43,228,255" })); }
  function burst(x, y, color, count, spread) {
    if (RM) count = Math.min(count, 10); if (mobile()) count = Math.round(count * .55);
    for (let i = 0; i < count; i++) { const a = Math.random() * 6.283, s = rnd(.5, 1) * (spread || 4); bursts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, d: rnd(.012, .03), r: rnd(1, 3), c: color || "220,255,31" }); }
  }
  /* تلاشي لوح إلى جسيمات مضيئة على امتداد مستطيله */
  function dissolve(rect, color) {
    const n = RM ? 16 : mobile() ? 50 : 110;
    for (let i = 0; i < n; i++) { const x = rnd(rect.left, rect.right), y = rnd(rect.top, rect.bottom), a = Math.random() * 6.283, s = rnd(.4, 2.4); bursts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - .4, life: 1, d: rnd(.01, .024), r: rnd(1, 3.2), c: color || (Math.random() < .5 ? "43,228,255" : "220,255,31") }); }
  }
  function tick() {
    if (!run) return; g.clearRect(0, 0, W, H);
    amb.forEach(p => { if (!RM) { p.x += p.vx; p.y += p.vy; } if (p.y < -5) { p.y = H + 5; p.x = rnd(0, W); } g.fillStyle = `rgba(${p.c},${p.a * .8})`; g.shadowColor = `rgb(${p.c})`; g.shadowBlur = 8; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill(); });
    for (let i = bursts.length - 1; i >= 0; i--) { const b = bursts[i]; b.x += b.vx; b.y += b.vy; b.vx *= .985; b.vy *= .985; b.life -= b.d; if (b.life <= 0) { bursts.splice(i, 1); continue; } g.fillStyle = `rgba(${b.c},${b.life})`; g.shadowColor = `rgb(${b.c})`; g.shadowBlur = 10; g.beginPath(); g.arc(b.x, b.y, b.r * (.5 + b.life), 0, 6.283); g.fill(); }
    g.shadowBlur = 0; requestAnimationFrame(tick);
  }
  addEventListener("resize", size); document.addEventListener("visibilitychange", () => { run = !document.hidden; if (run) requestAnimationFrame(tick); });
  size(); requestAnimationFrame(tick);
  return { burst, dissolve, count: () => bursts.length };
})();
