/* المشهد الفضائي: اسطوانة سحابية + عقد مدارية + مدير ألواح عائمة (سحب/تدوير/تحجيم/رمي/استعادة).
   معزول بالكامل؛ المحتوى من panels.js. كل إيماءة هنا منفَّذة، والمُختبَر منها مسجّل في README. */
(() => {
  const $ = s => document.querySelector(s), RM = matchMedia("(prefers-reduced-motion:reduce)").matches, PERSP = 1500;
  const stage = $("#stage"), cyl = $("#cyl"), cylIn = $("#cyl-in"), orbit = $("#orbit"), layer = $("#panels"), dock = $("#dock"), core = $("#core");
  const isMob = () => innerWidth <= 820, W = () => innerWidth, H = () => innerHeight;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ───── الاسطوانة ───── */
  const cols = ["#2be4ff", "#dcff1f", "#a58bff", "#2be4ff"];
  function slats(host, n, bars) { for (let i = 0; i < n; i++) { const s = document.createElement("div"); s.className = "slat"; s.style.setProperty("--i", i); s.style.setProperty("--R", "152px"); for (let k = 0; k < bars; k++) { const b = document.createElement("i"); b.style.top = (14 + ((i * 37 + k * 71) % 300)) + "px"; b.style.width = (8 + ((i * 13 + k * 29) % 26)) + "px"; b.style.setProperty("--c", cols[(i + k) % cols.length]); b.style.setProperty("--d", ((i * .21 + k * .37) % 3).toFixed(2) + "s"); s.appendChild(b); } host.appendChild(s); } }
  slats(cyl, 24, isMob() ? 3 : 6); slats(cylIn, 16, 2);
  [[-150, 152, "#2be4ff"], [-60, 160, "#dcff1f"], [20, 154, "#2be4ff"], [100, 160, "#a58bff"], [160, 152, "#dcff1f"]].forEach(([y, r, c]) => { const e = document.createElement("div"); e.className = "ring"; e.style.setProperty("--y", y + "px"); e.style.setProperty("--r", r + "px"); e.style.setProperty("--c", c); cyl.appendChild(e); });

  /* ───── عقد الأقسام على المدار ───── */
  const secs = SEC.filter(s => !s.hidden), nodes = new Map(), RO = 310;
  secs.forEach((s, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "node"; b.dataset.id = s.id; b.setAttribute("aria-label", "فتح " + s.name); b.innerHTML = svg(s.icon) + "<span>" + s.name + "</span>";
    b.addEventListener("click", () => openSection(s.id)); orbit.appendChild(b); nodes.set(s.id, b);
    const d = document.createElement("button"); d.type = "button"; d.dataset.id = s.id; d.innerHTML = svg(s.icon) + "<span>" + s.name + "</span>"; d.addEventListener("click", () => openSection(s.id)); dock.appendChild(d);
  });
  let ang = 20, va = 0, drag = null, lastInput = 0, tw = null;
  /* تدوير الاسطوانة لتقديم عقدة قسم إلى مقدمة المشهد (أقصر دوران) */
  function spinTo(id) { const i = secs.findIndex(s => s.id === id); if (i < 0) return; const step = 360 / secs.length; let t = -i * step; t += Math.round((ang - t) / 360) * 360; tw = { to: t }; lastInput = performance.now(); }
  function frame(t) {
    const dt = Math.min(50, t - (frame.t || t)); frame.t = t;
    if (tw) { ang += (tw.to - ang) * .07; if (Math.abs(tw.to - ang) < .15) { ang = tw.to; tw = null; } } else if (!drag) { ang += va; va *= .94; if (!RM && Math.abs(va) < .02 && t - lastInput > 2500) ang += dt * .004; }
    const a = ang % 360; cyl.style.transform = `rotateY(${a}deg)`; cylIn.style.transform = `rotateY(${-a * 1.6}deg)`;
    secs.forEach((s, i) => {
      const th = (a + i * 360 / secs.length) * Math.PI / 180, x = Math.sin(th) * RO, z = Math.cos(th) * RO, y = Math.sin(i * 1.9) * 72, n = nodes.get(s.id), f = (z + RO) / (2 * RO);
      n.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px)`; n.style.opacity = (.42 + .58 * f).toFixed(2); n.style.zIndex = Math.round(z + RO);
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  /* تدوير الاسطوانة بسحب الخلفية (فأرة/لمس) مع قصور ذاتي */
  stage.addEventListener("pointerdown", e => { if (e.target.closest("button")) return; tw = null; drag = { x: e.clientX, id: e.pointerId, t: performance.now(), v: 0 }; try { stage.setPointerCapture(e.pointerId); } catch (_) { } stage.classList.add("grab"); lastInput = performance.now(); });
  stage.addEventListener("pointermove", e => { if (!drag || e.pointerId !== drag.id) return; const dx = e.clientX - drag.x, now = performance.now(); ang += dx * .35; drag.v = dx * .35 * .6 + drag.v * .4; drag.x = e.clientX; lastInput = now; });
  const endDrag = e => { if (!drag) return; va = clamp(drag.v, -14, 14); drag = null; stage.classList.remove("grab"); };
  stage.addEventListener("pointerup", endDrag); stage.addEventListener("pointercancel", endDrag);
  document.addEventListener("keydown", e => { const k = String(e.key || ""); if (/INPUT|TEXTAREA/.test((e.target || {}).tagName || "")) { return; } if (k === "ArrowLeft") { va = -6; lastInput = performance.now(); } else if (k === "ArrowRight") { va = 6; lastInput = performance.now(); } else if (k === "Escape" && focused) dismiss(focused, "close"); });

  /* ───── مدير الألواح ───── */
  const open = new Map(); let zc = 10, focused = null;
  const fz = p => 1 - 0; /* موضع للتوسّع المستقبلي */
  function persp(tz) { return PERSP / (PERSP - tz); }
  function apply(p) { const s = p.st, tz = s.z + (p.id === focused ? 40 : 0); p.el.style.transform = `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,${tz}px) rotateX(${s.rx.toFixed(1)}deg) rotateY(${s.ry.toFixed(1)}deg) scale(${s.s.toFixed(3)})`; p.el.style.setProperty("--w", s.w + "px"); p.el.style.setProperty("--h", s.h + "px"); }
  /* تخطيط تلقائي: أماكن لكل عدد من الألواح (كسور من أبعاد الشاشة)؛ [x, y, مقياس, ry, rx, z] */
  const LAY = {
    1: [[.275, -.02, 1, -15, 0, 0]],
    2: [[.275, -.02, 1, -15, 0, 0], [-.275, -.02, 1, 15, 0, 0]],
    3: [[.285, -.03, .94, -14, 0, 0], [-.285, -.03, .94, 14, 0, 0], [0, .26, .78, 0, 4, 60]],
    4: [[.285, -.23, .8, -14, 2, 0], [.285, .23, .8, -14, -2, 0], [-.285, -.23, .8, 14, 2, 0], [-.285, .23, .8, 14, -2, 0]],
    5: [[.29, -.24, .74, -14, 2, 0], [.29, .22, .74, -14, -2, 0], [-.29, -.24, .74, 14, 2, 0], [-.29, .22, .74, 14, -2, 0], [0, .285, .62, 0, 6, 40]],
    6: [[.29, -.24, .72, -14, 2, 0], [.29, .22, .72, -14, -2, 0], [-.29, -.24, .72, 14, 2, 0], [-.29, .22, .72, 14, -2, 0], [0, .285, .6, 0, 6, 40], [0, -.31, .6, 0, -6, -40]],
  };
  function layoutFor(n) {
    const w = W(), h = H();
    if (isMob()) return Array.from({ length: n }, (_, i) => ({ x: i * 12 - 18, y: h * .15 + i * 30, z: 0, rx: 0, ry: 0, s: 1 }));
    return (LAY[Math.min(n, 6)] || LAY[6]).concat(Array.from({ length: Math.max(0, n - 6) }, (_, i) => [(i % 2 ? .12 : -.12), .1 + i * .02, .6, 0, 0, 160 + i * 20])).slice(0, n).map(([fx, fy, s, ry, rx, z]) => ({ x: fx * w, y: fy * h, z, rx, ry, s }));
  }
  /* يعيد ترتيب الألواح التي لم يحرّكها المستخدم؛ الجديد يأخذ مكانه فوراً والباقي ينزلق بسلاسة */
  function arrange(fresh) {
    const list = [...open.values()].filter(p => !p.min && !p.user && !p.big), L = layoutFor(list.length);
    list.forEach((p, i) => { const c = L[i]; if (p === fresh) { Object.assign(p.st, { x: c.x, y: c.y, z: c.z, rx: c.rx, ry: c.ry, s: c.s }); return; } p.el.classList.remove("tr"); p.el.classList.add("tr2"); Object.assign(p.st, { x: c.x, y: c.y, z: c.z, rx: c.rx, ry: c.ry, s: c.s }); apply(p); setTimeout(() => p.el.classList.remove("tr2"), 450); });
  }
  const rectOf = p => ({ x: p.st.x, y: p.st.y, w: p.st.w * p.st.s, h: p.st.h * p.st.s });
  function overlap(a, b) { const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x), oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y); return ox > 0 && oy > 0 ? { ox, oy, a: ox * oy } : null; }
  function sizeFor(sec) { const mw = W(), mh = H(); return isMob() ? { w: Math.min(sec.w, mw - 24), h: Math.min(sec.h, Math.round(mh * .42)) } : { w: Math.min(sec.w, mw - 60), h: Math.min(sec.h, mh - 120) }; }
  function nodePos(id) { const n = id === "ai" ? core : nodes.get(id); if (!n) return { x: 0, y: 0 }; const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2 - W() / 2, y: r.top + r.height / 2 - H() / 2 }; }
  function render(p, keep) { const b = p.body, top = b.scrollTop; b.innerHTML = p.sec.html(p); if (keep !== false) b.scrollTop = top; }
  const refreshAll = () => open.forEach(p => { if (!p.min) render(p); });
  function markNodes() { nodes.forEach((n, id) => { const p = open.get(id); n.classList.toggle("open", !!p && !p.min); n.classList.toggle("min", !!p && p.min); }); dock.querySelectorAll("button").forEach(b => { const p = open.get(b.dataset.id); b.classList.toggle("open", !!p && !p.min); }); }
  function pulse(id) { const n = nodes.get(id); if (n) { n.classList.remove("hot"); void n.offsetWidth; n.classList.add("hot"); } core.classList.remove("pulse"); void core.offsetWidth; core.classList.add("pulse"); }

  function openSection(id) {
    const sec = SEC.find(s => s.id === id); if (!sec) return;
    const ex = open.get(id), from = nodePos(id);
    if (ex) { if (ex.min) { ex.min = false; ex.el.style.display = ""; ex.el.classList.add("tr"); arrange(ex); ex.keep = Object.assign({}, ex.st); setPos(ex, ex.keep, from); setTimeout(() => ex.el.classList.remove("tr"), 900); } focus(id); pulse(id); FX.burst(from.x + W() / 2, from.y + H() / 2, "220,255,31", 26, 3.5); markNodes(); return; }
    const sz = sizeFor(sec), sl = { x: 0, y: 0, z: 0, rx: 0, ry: 0 }, el = document.createElement("section"); el.className = "panel"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", sec.name); el.tabIndex = -1;
    el.innerHTML = '<i class="slab s3"></i><i class="slab s2"></i><i class="slab s1"></i><header class="pn-h"><button type="button" class="pn-rot" aria-label="تدوير اللوح (اسحب)" title="اسحب لتدوير اللوح">&#10227;</button><h3></h3><button type="button" class="pn-min" aria-label="تصغير" title="تصغير">&#8211;</button><button type="button" class="pn-max" aria-label="تكبير/استعادة" title="تكبير">&#9633;</button><button type="button" class="pn-x" aria-label="إغلاق" title="إغلاق">&#10005;</button></header><div class="pn-b"></div><i class="pn-rs" aria-hidden="true"></i>';
    el.querySelector("h3").textContent = sec.name;
    const content = sec.st ? JSON.parse(JSON.stringify(sec.st)) : {}, p = { id, sec: Object.assign({}, sec, { html: q => sec.html({ st: content }) }), el, body: el.querySelector(".pn-b"), min: false, big: false, keep: null, st: { x: sl.x, y: sl.y, z: sl.z, rx: sl.rx, ry: sl.ry, s: 1, w: sz.w, h: sz.h } };
    layer.appendChild(el); open.set(id, p); wire(p); arrange(p); if (sec.bind) sec.bind(p.body, { st: content }, all => all ? refreshAll() : render(p)); render(p, false);
    p.keep = Object.assign({}, p.st);
    Object.assign(p.st, { x: from.x * .35, y: from.y * .35, z: -380, s: .1, rx: 0, ry: 0 }); apply(p); el.style.opacity = 0; el.classList.add("tr"); void el.offsetWidth;
    Object.assign(p.st, p.keep); focus(id); apply(p); el.style.opacity = 1; if (RM) { el.classList.remove("tr"); }
    setTimeout(() => el.classList.remove("tr"), 950); pulse(id); FX.burst(from.x + W() / 2, from.y + H() / 2, "43,228,255", 40, 4.5); markNodes(); setTimeout(() => { try { el.focus({ preventScroll: true }); } catch (e) { } }, 60);
  }
  function setPos(p, s, from) { if (from) { Object.assign(p.st, { x: from.x * .35, y: from.y * .35, z: -380, s: .1 }); apply(p); p.el.style.opacity = 0; void p.el.offsetWidth; } Object.assign(p.st, s); apply(p); p.el.style.opacity = 1; }
  function focus(id) { focused = id; open.forEach(p => { p.el.classList.toggle("focus", p.id === id); if (p.id === id) { p.el.style.zIndex = ++zc; } apply(p); }); }
  function wire(p) {
    const el = p.el, h = el.querySelector(".pn-h"), rot = el.querySelector(".pn-rot"), rs = el.querySelector(".pn-rs");
    el.addEventListener("pointerdown", () => { if (focused !== p.id) focus(p.id); });
    el.querySelector(".pn-x").onclick = () => dismiss(p.id, "close"); el.querySelector(".pn-min").onclick = () => dismiss(p.id, "min"); el.querySelector(".pn-max").onclick = () => toggleBig(p);
    let tap = 0, tapX = 0;
    h.addEventListener("pointerdown", e => {
      if (e.target.closest(".pn-min,.pn-max,.pn-x")) return; e.preventDefault(); const mode = e.target.closest(".pn-rot") || e.shiftKey ? "rot" : "move", now = performance.now();
      if (mode === "move" && now - tap < 320 && Math.abs(e.clientX - tapX) < 24) { tap = 0; toggleBig(p); return; } tap = now; tapX = e.clientX;
      el.classList.remove("tr", "tr2"); const g = { mode, id: e.pointerId, x: e.clientX, y: e.clientY, s: [] }; h._g = g; try { h.setPointerCapture(e.pointerId); } catch (_) { }
    });
    h.addEventListener("pointermove", e => { const g = h._g; if (!g || g.id !== e.pointerId) return; const dx = e.clientX - g.x, dy = e.clientY - g.y; g.x = e.clientX; g.y = e.clientY; const t = performance.now(); g.s.push([t, e.clientX, e.clientY]); while (g.s.length > 2 && t - g.s[0][0] > 110) g.s.shift();
      p.user = true; if (g.mode === "move") { const f = persp(p.st.z + (focused === p.id ? 40 : 0)); p.st.x += dx / f; p.st.y += dy / f; } else { p.st.ry = clamp(p.st.ry + dx * .35, -38, 38); p.st.rx = clamp(p.st.rx - dy * .3, -30, 30); } apply(p); });
    const up = e => { const g = h._g; if (!g || g.id !== e.pointerId) return; h._g = null; if (g.mode !== "move") return; release(p, g); };
    h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
    /* تحجيم بمقبض الزاوية */
    rs.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); el.classList.remove("tr", "tr2"); rs._g = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { rs.setPointerCapture(e.pointerId); } catch (_) { } focus(p.id); });
    rs.addEventListener("pointermove", e => { const g = rs._g; if (!g || g.id !== e.pointerId) return; const f = persp(p.st.z) * p.st.s, dx = (e.clientX - g.x) / f, dy = (e.clientY - g.y) / f; g.x = e.clientX; g.y = e.clientY; const nw = clamp(p.st.w - dx, 300, Math.min(920, W() - 16)), nh = clamp(p.st.h + dy, 240, Math.min(720, H() - 60)), dw = nw - p.st.w, dh = nh - p.st.h; p.user = true; p.st.w = nw; p.st.h = nh; p.st.x -= dw * p.st.s / 2; p.st.y += dh * p.st.s / 2; apply(p); });
    const rsUp = e => { if (rs._g) { rs._g = null; resolve(p); } }; rs.addEventListener("pointerup", rsUp); rs.addEventListener("pointercancel", rsUp);
    /* عجلة الفأرة: تكبير اللوح (إلا إن كان المحتوى قابلاً للتمرير) */
    el.addEventListener("wheel", e => { const b = e.target.closest(".pn-b"); if (b && !e.ctrlKey && b.scrollHeight > b.clientHeight + 2) return; e.preventDefault(); p.user = true; p.st.s = clamp(p.st.s * (e.deltaY < 0 ? 1.06 : .943), .5, 1.9); apply(p); }, { passive: false });
    /* قرص بإصبعين */
    let pd = 0, ps = 1; el.addEventListener("touchstart", e => { if (e.touches.length === 2) { pd = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); ps = p.st.s; el.classList.remove("tr", "tr2"); } }, { passive: true });
    el.addEventListener("touchmove", e => { if (e.touches.length === 2 && pd) { e.preventDefault(); const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); p.user = true; p.st.s = clamp(ps * d / pd, .5, 1.9); apply(p); } }, { passive: false });
    el.addEventListener("touchend", e => { if (e.touches.length < 2 && pd) { pd = 0; resolve(p); } }, { passive: true });
  }
  /* رفع الإصبع: رمي نحو الحافة = تلاشٍ بجسيمات؛ وإلا تثبيت/إزاحة لتفادي التراكب */
  function release(p, g) {
    const s = g.s, n = s.length; let vx = 0, vy = 0; if (n >= 2) { const a = s[0], b = s[n - 1], dt = Math.max(1, b[0] - a[0]); vx = (b[1] - a[1]) / dt; vy = (b[2] - a[2]) / dt; }
    const sp = Math.hypot(vx, vy), pos = Math.hypot(p.st.x, p.st.y) || 1, out = (vx * p.st.x + vy * p.st.y) / pos, beyond = Math.abs(p.st.x) > W() / 2 + p.st.w * p.st.s * .15 || Math.abs(p.st.y) > H() / 2 + p.st.h * p.st.s * .15;
    SpatialOS.lastRelease = { sp: +sp.toFixed(2), out: +out.toFixed(2), beyond, n };
    if ((sp > .85 && out > .15 * sp) || beyond) return throwAway(p, vx || p.st.x / 400, vy || p.st.y / 400);
    resolve(p);
  }
  function throwAway(p, vx, vy) {
    const id = p.id; open.delete(id); if (focused === id) focused = null; markNodes(); spinTo(id); setTimeout(() => arrange(), 60); p.el.classList.remove("tr", "tr2"); let last = performance.now(), op = 1, burst = false; const sp = Math.max(.9, Math.hypot(vx, vy)), k = Math.min(2.2, 1.4 / sp * 1) || 1;
    const step = t => { const dt = Math.min(40, t - last); last = t; p.st.x += vx * dt * 1.15 * k * 1.4 / persp(p.st.z); p.st.y += vy * dt * 1.15 * k * 1.4 / persp(p.st.z); p.st.s *= Math.pow(.965, dt / 16); p.st.ry += vx * dt * .05; op -= dt / 520; p.el.style.opacity = Math.max(0, op).toFixed(2); apply(p);
      if (!burst && op < .55) { burst = true; const r = p.el.getBoundingClientRect(); FX.dissolve(r, null); }
      if (op > 0) requestAnimationFrame(step); else p.el.remove(); };
    requestAnimationFrame(step);
  }
  function dismiss(id, how) {
    const p = open.get(id); if (!p) return; const to = nodePos(id); p.el.classList.remove("tr"); p.el.classList.add("tr2"); p.keep = Object.assign({}, p.st);
    if (focused === id) focused = null; Object.assign(p.st, { x: to.x * .35, y: to.y * .35, z: -380, s: .1 }); apply(p); p.el.style.opacity = 0;
    const r = p.el.getBoundingClientRect(); if (how === "close") { open.delete(id); FX.dissolve(r, "43,228,255"); setTimeout(() => p.el.remove(), 420); } else { p.min = true; setTimeout(() => { if (p.min) p.el.style.display = "none"; }, 420); }
    markNodes(); spinTo(id); setTimeout(() => arrange(), 60);
  }
  function toggleBig(p) {
    p.el.classList.remove("tr"); p.el.classList.add("tr2"); focus(p.id);
    if (!p.big) { p.prev = Object.assign({}, p.st); const w = Math.min(920, W() - 24), h = Math.min(660, H() - 92); Object.assign(p.st, { x: 0, y: isMob() ? -6 : -10, z: 110, rx: 0, ry: 0, s: 1, w, h }); p.big = true; } else { Object.assign(p.st, p.prev); p.big = false; }
    apply(p); setTimeout(() => p.el.classList.remove("tr2"), 420);
  }
  /* منع التراكب: إزاحة اللوح الساقط عن لوح يخفي أكثر من 35% + مغناطيس لأقرب موضع حرّ */
  function resolve(p) {
    if (p.big) return; const me = rectOf(p); let moved = false;
    open.forEach(o => { if (o === p || o.min || o.big) return; const r = overlap(me, rectOf(o)); if (r && r.a > .35 * Math.min(me.w * me.h, rectOf(o).w * rectOf(o).h)) { if (r.ox < r.oy) p.st.x += (me.x >= o.st.x ? 1 : -1) * (r.ox + 14); else p.st.y += (me.y >= o.st.y ? 1 : -1) * (r.oy + 14); moved = true; me.x = p.st.x; me.y = p.st.y; } });
    const mx = W() / 2 - me.w / 3, my = H() / 2 - me.h / 3; p.st.x = clamp(p.st.x, -mx, mx); p.st.y = clamp(p.st.y, -my, my);
    if (!moved) { const near = layoutFor(6).find(c => Math.hypot(c.x - p.st.x, c.y - p.st.y) < 55 && ![...open.values()].some(o => o !== p && !o.min && overlap({ x: c.x, y: c.y, w: me.w, h: me.h }, rectOf(o)))); if (near) { Object.assign(p.st, { x: near.x, y: near.y, z: near.z, rx: near.rx, ry: near.ry }); moved = true; } }
    p.el.classList.add("tr2"); apply(p); setTimeout(() => p.el.classList.remove("tr2"), 420);
  }
  core.addEventListener("click", () => openSection("ai"));
  $("#hud-reset").addEventListener("click", () => { open.forEach(p => { p.user = false; p.big = false; const s = sizeFor(p.sec); p.st.w = s.w; p.st.h = s.h; }); arrange(); });
  addEventListener("resize", () => { open.forEach(p => { if (p.min) return; const m = isMob() ? sizeFor(p.sec) : null; if (m && !p.big) { p.st.w = m.w; p.st.h = m.h; } apply(p); }); });
  window.SpatialOS = { open: openSection, spinTo, panels: open, dismiss, get angle() { return ang; }, set angle(v) { ang = v; }, get focused() { return focused; }, refreshAll };
  setTimeout(() => openSection("ord"), 700);
})();
