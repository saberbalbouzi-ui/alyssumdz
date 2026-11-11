/* جسيمات: خلفية + دفقات ظهور + تلاشٍ؛ تُرسم بتوهّج إضافي (lighter) من لوحات ضوء جاهزة لأداء أفضل، مع ذيول وجاذبية خفيفة */
const FX = (() => {
  const cv = document.getElementById("fx"), g = cv.getContext("2d"), RM = matchMedia("(prefers-reduced-motion:reduce)").matches;
  let W = 0, H = 0, dpr = 1, amb = [], bursts = [], run = true;
  const mobile = () => innerWidth <= 820, rnd = (a, b) => a + Math.random() * (b - a);
  const sprites = {};
  function sprite(rgb) { if (sprites[rgb]) return sprites[rgb]; const c = document.createElement("canvas"); c.width = c.height = 48; const x = c.getContext("2d"), gr = x.createRadialGradient(24, 24, 0, 24, 24, 24); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.25, `rgba(${rgb},.9)`); gr.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = gr; x.fillRect(0, 0, 48, 48); return (sprites[rgb] = c); }
  function size() { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); const n = RM ? 12 : mobile() ? 34 : 80; amb = Array.from({ length: n }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(3, 9), vy: -rnd(.08, .35), vx: rnd(-.08, .08), a: rnd(.25, .8), c: Math.random() < .3 ? "220,255,31" : "43,228,255" })); }
  const cap = () => (document.body.classList.contains("many") ? 140 : 360);
  function push(o) { if (bursts.length < cap()) bursts.push(o); }
  function burst(x, y, color, count, spread) {
    if (RM) count = Math.min(count, 10); if (mobile()) count = Math.round(count * .55);
    for (let i = 0; i < count; i++) { const a = Math.random() * 6.283, s = rnd(.5, 1) * (spread || 4); push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, d: rnd(.012, .03), r: rnd(5, 12), c: color || "220,255,31", g: 0 }); }
  }
  /* تلاشٍ: جسيمات على امتداد مستطيل اللوح تتطاير للخارج وتهبط قليلاً */
  function dissolve(rect, color) {
    const n = RM ? 16 : mobile() ? 46 : 96;
    for (let i = 0; i < n; i++) { const x = rnd(rect.left, rect.right), y = rnd(rect.top, rect.bottom), a = Math.random() * 6.283, s = rnd(.4, 2.6); push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - .5, life: 1, d: rnd(.009, .022), r: rnd(4, 11), c: color || (Math.random() < .5 ? "43,228,255" : "220,255,31"), g: .018 }); }
  }
  /* دفق ظهور: جسيمات على الخط بين العقدة واللوح */
  function stream(x0, y0, x1, y1, n) { if (RM) return; for (let i = 0; i < n; i++) { const t = Math.random(); push({ x: x0 + (x1 - x0) * t + rnd(-6, 6), y: y0 + (y1 - y0) * t + rnd(-6, 6), vx: rnd(-.3, .3), vy: rnd(-.3, .3), life: .9, d: rnd(.03, .06), r: rnd(3, 7), c: Math.random() < .5 ? "220,255,31" : "43,228,255", g: 0 }); } }
  function tick() {
    if (!run) return; g.clearRect(0, 0, W, H); g.globalCompositeOperation = "lighter";
    amb.forEach(p => { if (!RM) { p.x += p.vx; p.y += p.vy; } if (p.y < -9) { p.y = H + 9; p.x = rnd(0, W); } g.globalAlpha = p.a * .7; g.drawImage(sprite(p.c), p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); });
    for (let i = bursts.length - 1; i >= 0; i--) { const b = bursts[i]; b.x += b.vx; b.y += b.vy; b.vy += b.g; b.vx *= .985; b.vy *= .985; b.life -= b.d; if (b.life <= 0) { bursts.splice(i, 1); continue; } g.globalAlpha = Math.min(1, b.life * 1.2); const r = b.r * (.4 + b.life); g.drawImage(sprite(b.c), b.x - r, b.y - r, r * 2, r * 2);
      g.globalAlpha = b.life * .35; g.drawImage(sprite(b.c), b.x - b.vx * 3 - r * .6, b.y - b.vy * 3 - r * .6, r * 1.2, r * 1.2); }
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; requestAnimationFrame(tick);
  }
  addEventListener("resize", size); document.addEventListener("visibilitychange", () => { run = !document.hidden; if (run) requestAnimationFrame(tick); });
  size(); requestAnimationFrame(tick);
  return { burst, dissolve, stream, count: () => bursts.length };
})();
