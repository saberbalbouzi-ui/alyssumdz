/* المشهد الفضائي: اسطوانة سحابية + عقد مدارية + مدير ألواح عائمة (سحب/تدوير/تحجيم/رمي/استعادة).
   معزول بالكامل؛ المحتوى من panels.js. كل إيماءة هنا منفَّذة، والمُختبَر منها مسجّل في README. */
(() => {
  const $ = s => document.querySelector(s), RM = matchMedia("(prefers-reduced-motion:reduce)").matches, PERSP = 1500;
  const layerBack = $("#panels-back"), stage = $("#stage"), cyl = $("#cyl"), cylIn = $("#cyl-in"), orbit = $("#orbit"), layer = $("#panels"), dock = $("#dock"), core = $("#core");
  const isMob = () => innerWidth <= 820, W = () => innerWidth, H = () => innerHeight;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ───── الاسطوانة ───── */
  const cols = ["#2be4ff", "#dcff1f", "#a58bff", "#2be4ff"];
  function slats(host, n, bars) { for (let i = 0; i < n; i++) { const s = document.createElement("div"); s.className = "slat"; s.style.setProperty("--i", i); s.style.setProperty("--R", "152px"); for (let k = 0; k < bars; k++) { const b = document.createElement("i"); b.style.top = (14 + ((i * 37 + k * 71) % 300)) + "px"; b.style.width = (8 + ((i * 13 + k * 29) % 26)) + "px"; b.style.setProperty("--c", cols[(i + k) % cols.length]); b.style.setProperty("--d", ((i * .21 + k * .37) % 3).toFixed(2) + "s"); s.appendChild(b); } host.appendChild(s); } }
  slats(cyl, 16, isMob() ? 3 : 6); slats(cylIn, 10, 2);
  [[-150, 152, "#2be4ff"], [-60, 160, "#dcff1f"], [20, 154, "#2be4ff"], [100, 160, "#a58bff"], [160, 152, "#dcff1f"]].forEach(([y, r, c]) => { const e = document.createElement("div"); e.className = "ring"; e.style.setProperty("--y", y + "px"); e.style.setProperty("--r", r + "px"); e.style.setProperty("--c", c); cyl.appendChild(e); });

  /* ───── القاعة: شاشات جدارية + لوحيّات أرضية + أيقونات عائمة داخل الاسطوانة ───── */
  const room = $("#room"), kinds = ["a", "b", "c", "d"];
  function wall(cls, n) { const w = document.createElement("div"); w.className = "wall " + cls; for (let i = 0; i < n; i++) { const s = document.createElement("i"); s.className = "scr " + kinds[(i * 3 + n) % 4]; s.style.setProperty("--d", (i * .7 % 6) + "s"); w.appendChild(s); } room.appendChild(w); }
  /* قاعة كاملة بحسب صورة المرجع: جدار خلفي بنيوي + مجموعتا شاشات خلفيتان + جداران جانبيان (كلها بطاقات حيّة شفافة) + أعمدة وعوارض إضاءة */
  /* الأرضية كلها لوحة Canvas واحدة تُرسم مرة واحدة: بلاط + أشعة + حلقات + منصة + خطوط ضوء + توهّج (أقل بكثير من عشرات الطبقات) */
  (function drawFloor() {
    const cv = document.getElementById("floorcv"), g = cv.getContext("2d"), N = 2048, k = N / 2400, C = N / 2; g.clearRect(0, 0, N, N); g.save(); g.translate(C, C); g.scale(k, k);
    const rg = (r0, r1, stops) => { const gr = g.createRadialGradient(0, 0, r0, 0, 0, r1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
    g.fillStyle = rg(0, 1200, [[0, "rgba(34,120,150,.8)"], [.14, "rgba(14,58,78,.82)"], [.34, "rgba(8,32,46,.9)"], [.6, "rgba(4,17,26,.95)"], [1, "rgba(3,13,21,1)"]]); g.fillRect(-1200, -1200, 2400, 2400);
    g.lineWidth = 2; g.strokeStyle = "rgba(43,228,255,.32)"; g.beginPath(); for (let v = -1200; v <= 1200; v += 150) { g.moveTo(v, -1200); g.lineTo(v, 1200); g.moveTo(-1200, v); g.lineTo(1200, v); } g.stroke();
    g.lineWidth = 1; g.strokeStyle = "rgba(43,228,255,.09)"; g.beginPath(); for (let v = -1200; v <= 1200; v += 37.5) { g.moveTo(v, -1200); g.lineTo(v, 1200); g.moveTo(-1200, v); g.lineTo(1200, v); } g.stroke();
    g.fillStyle = rg(0, 760, [[0, "rgba(43,228,255,.5)"], [.3, "rgba(43,228,255,.22)"], [.55, "rgba(120,255,160,.08)"], [1, "rgba(43,228,255,0)"]]); g.fillRect(-800, -800, 1600, 1600);
    for (let a = 0; a < 360; a += 7.5) { const r = a * Math.PI / 180, lime = a % 30 === 0; g.strokeStyle = lime ? "rgba(220,255,31,.28)" : "rgba(43,228,255,.2)"; g.lineWidth = lime ? 1.6 : 1; g.beginPath(); g.moveTo(Math.cos(r) * 380, Math.sin(r) * 380); g.lineTo(Math.cos(r) * 950, Math.sin(r) * 950); g.stroke(); }
    const ring = (r, w, col, dash, glow) => { g.save(); g.lineWidth = w; g.strokeStyle = col; g.setLineDash(dash || []); if (glow) { g.shadowColor = glow; g.shadowBlur = 24; } g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.stroke(); g.restore(); };
    ring(1700 / 2, 12, "rgba(165,139,255,.32)", [26, 18]); ring(700, 3, "rgba(43,228,255,.6)", [], "#2be4ff"); ring(590, 26, "rgba(43,228,255,.38)", [4, 16]); ring(500, 2, "rgba(220,255,31,.75)", [], "#dcff1f"); ring(430, 16, "rgba(43,228,255,.5)", [22, 14], "#2be4ff");
    ring(310, 1.5, "rgba(220,255,31,.4)", [6, 8]);
    /* المنصة */
    g.fillStyle = rg(0, 350, [[0, "#0b3346"], [.4, "#082635"], [.78, "#04141d"], [1, "#020b11"]]); g.beginPath(); g.arc(0, 0, 350, 0, 6.2832); g.fill();
    g.lineWidth = 1.2; g.strokeStyle = "rgba(43,228,255,.2)"; for (let r = 24; r < 350; r += 24) { g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.stroke(); }
    ring(350, 4, "rgba(110,240,255,.95)", [], "#2be4ff"); ring(358, 2, "rgba(220,255,31,.6)", [], "#dcff1f"); ring(366, 2, "rgba(43,228,255,.5)"); ring(374, 2, "rgba(43,228,255,.35)");
    g.fillStyle = rg(0, 210, [[0, "rgba(220,255,31,.55)"], [.38, "rgba(43,228,255,.35)"], [1, "rgba(43,228,255,0)"]]); g.beginPath(); g.arc(0, 0, 210, 0, 6.2832); g.fill();
    /* خطوط ضوء أرضية تتقارب نحو المنصة */
    [[-430, 1], [430, 1], [-780, .6], [780, .6], [-150, .55], [150, .55]].forEach(([x, o]) => { const gr = g.createLinearGradient(0, -750, 0, 750); gr.addColorStop(0, "rgba(120,240,255,0)"); gr.addColorStop(.42, `rgba(120,240,255,${.7 * o})`); gr.addColorStop(.5, `rgba(235,255,255,${.9 * o})`); gr.addColorStop(.58, `rgba(120,240,255,${.7 * o})`); gr.addColorStop(1, "rgba(120,240,255,0)"); g.fillStyle = gr; g.shadowColor = "#2be4ff"; g.shadowBlur = 18; g.fillRect(x - 3.5, -750, 7, 1500); g.shadowBlur = 0; });
    g.restore(); g.globalCompositeOperation = "destination-out"; g.fillStyle = (() => { const gr = g.createRadialGradient(C, C, C * .62, C, C, C); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,1)"); return gr; })(); g.fillRect(0, 0, N, N); g.globalCompositeOperation = "source-over";
  })();
  const hall = document.createElement("div"); hall.className = "hall"; room.appendChild(hall);
  [[-880, -50, -380], [880, -50, -380], [-100, -120, -1100], [100, -120, -1100]].forEach(([x, y, z]) => { const p = document.createElement("i"); p.className = "pillar"; p.style.transform = `translate3d(${x}px,${y}px,${z}px)`; room.appendChild(p); });
  [[0, -345, -840, 1500, 0], [-640, -330, -330, 600, 50], [640, -330, -330, 600, -50]].forEach(([x, y, z, w, ry]) => { const s = document.createElement("i"); s.className = "strip"; s.style.width = w + "px"; s.style.marginLeft = (-w / 2) + "px"; s.style.transform = `translate3d(${x}px,${y}px,${z}px) rotateY(${ry}deg)`; room.appendChild(s); });
  const WL = ["dash", "ana", "ord", "prod", "inv", "cus", "mkt", "store", "ana2", "ord2", "look", "ext"], WR = ["store2", "mkt2", "ana3", "look2", "ext2", "set", "dash2", "inv2", "cus2", "prod2", "ord3", "set2"], BL = ["ana4", "dash3", "ord4", "inv3", "prod3", "mkt3", "cus3", "store3", "ext3"], BR = ["dash4", "ana5", "ord5", "prod4", "inv4", "set3", "look3", "mkt4", "cus4"];
  function sidewall(cls, ids) { const w = document.createElement("div"); w.className = "wall " + cls; ids.forEach(id => { const real = id.replace(/\d+$/, ""), sec = SEC.find(s => s.id === real), d = document.createElement("div"); d.className = "wcard"; d.dataset.id = real; d.dataset.card = id; d.innerHTML = '<div class="wh">' + svg(sec.icon) + "<b>" + sec.name + '</b></div><div class="wbw"><div class="wb"></div></div>'; d.addEventListener("click", () => { if (performance.now() - lastPanelDrag < 300) return; openSection(real); }); w.appendChild(d); }); room.appendChild(w); }
  sidewall("l", WL.slice(0, 9)); sidewall("r", WR.slice(0, 9)); sidewall("bl", BL); sidewall("br", BR);
  const tabSpec = [["الإيراد", () => dz(revenue()) + " دج"], ["بانتظار التأكيد", () => pend()], ["التحويل", () => "2.9%"], ["الزيارات", () => "1 085"], ["مخزون منخفض", () => D.stock.filter(s => s.q < 10).length], ["متوسط الطلب", () => "2 750"], ["الطلبات", () => D.orders.length], ["مؤكَّدة", () => D.orders.filter(o => o.s === "ok").length], ["في الطريق", () => D.orders.filter(o => o.s === "ship").length], ["مسلَّمة", () => D.orders.filter(o => o.s === "done").length], ["الأصناف", () => D.stock.length]];
  [[-520, 330, -18], [-330, 380, 12], [450, 340, 20], [300, 400, -10], [-60, 430, 4], [600, 160, 40], [-640, 150, -35], [-720, 300, 22], [700, 300, -24], [130, 470, -8], [-190, 470, 10]].forEach(([x, z, r], i) => { const d = document.createElement("i"); d.className = "tab"; d.style.setProperty("--x", x + "px"); d.style.setProperty("--z", z + "px"); d.style.setProperty("--r", r + "deg"); d.dataset.k = i; room.appendChild(d); });
  function fillWalls() {
    room.querySelectorAll(".wcard").forEach(d => { const sec = SEC.find(s => s.id === d.dataset.id), st = sec.st ? JSON.parse(JSON.stringify(sec.st)) : {}; if (d.dataset.card === "ana2") D.__w = 1; d.querySelector(".wb").innerHTML = sec.html({ st, big: false }); });
    room.querySelectorAll(".tab").forEach(d => { const s = tabSpec[+d.dataset.k]; d.innerHTML = "<small>" + s[0] + "</small><b>" + s[1]() + "</b>"; });
  }
  fillWalls();
  const glyphs = document.createElement("div"); glyphs.className = "glyphs"; const gl = [];
  SEC.filter(s => !s.hidden).forEach((s, i) => { const g = document.createElement("div"); g.className = "glyph"; g.innerHTML = svg(s.icon); glyphs.appendChild(g); gl.push(g); }); room.appendChild(glyphs);
  /* ───── عقد الأقسام على المدار ───── */
  const secs = SEC.filter(s => !s.hidden), nodes = new Map(), RO = 310;
  secs.forEach((s, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "node"; b.dataset.id = s.id; b.setAttribute("aria-label", "فتح " + s.name); b.innerHTML = svg(s.icon) + "<span>" + s.name + "</span>";
    b.addEventListener("click", () => { if (performance.now() - lastPanelDrag < 300) return; openSection(s.id); }); b.addEventListener("focus", () => select(s.id)); orbit.appendChild(b); nodes.set(s.id, b);
    const d = document.createElement("button"); d.type = "button"; d.dataset.id = s.id; d.innerHTML = svg(s.icon) + "<span>" + s.name + "</span>"; d.addEventListener("click", () => openSection(s.id)); dock.appendChild(d);
  });
  let ang = 20, va = 0, drag = null, lastInput = 0, tw = null, yaw = 0;
  /* تدوير القاعة كلها حول الاسطوانة (الكاميرا المدارية): Shift+سحب أو التواء بإصبعين على الخلفية أو المفتاحان [ ] */
  function setYaw(v) { yaw = clamp(v, -50, 50); stage.style.setProperty("--yaw", yaw.toFixed(1) + "deg"); const c = document.getElementById("yawchip"); if (c) { c.classList.toggle("on", Math.abs(yaw) > 1); c.textContent = "القاعة ↻ " + Math.round(yaw) + "° — انقر للتصفير"; } }
  /* مدار الألواح: كل لوح لم يمسكه المستخدم يدور حول الاسطوانة (pa = زاوية المدار، pt = انتقال لتقديم لوح جديد، hov = ألواح تحت المؤشر فيتوقف الدوران) */
  let orbitMode = innerWidth > 820, pa = 0, pt = null, hov = 0, pprev = 20, draggingPanel = false;
  /* مرحلة 5: ثلاثة أوضاع منفصلة — العالم (لا لوح محدّد)، الكائن (لوح صغير محدّد)، التركيز (اللوح المحدّد موسَّع) */
  let objSel = null, tool = "move";
  /* تدوير الاسطوانة لتقديم عقدة قسم إلى مقدمة المشهد (أقصر دوران) */
  function spinTo(id) { const i = secs.findIndex(s => s.id === id); if (i < 0) return; const step = 360 / secs.length; let t = -i * step - yaw; t += Math.round((ang - t) / 360) * 360; tw = { to: t }; va = 0; lastInput = performance.now() + 4000; /* يبقى مُحاذياً ~6 ثوانٍ قبل أن يستأنف الدوران الهادئ */ }
  function frame(t) {
    const rdt = Math.min(250, t - (frame.t || t)), dt = Math.min(50, rdt); frame.t = t; const ek = 1 - Math.exp(-rdt / 150); /* تسهيل مبني على الزمن الحقيقي (مستقل عن معدل الإطارات) */
    if (tw) { ang += (tw.to - ang) * ek; if (Math.abs(tw.to - ang) < .15) { ang = tw.to; tw = null; } } else if (!drag) { const f = rdt / 16.7; ang += va * f; va *= Math.pow(.94, f); if (!RM && !objSel && Math.abs(va) < .02 && t - lastInput > 2500) ang += rdt * .004; }
    const dA = ang - pprev; pprev = ang;
    if (orbitMode) { if (pt) { pa += (pt.to - pa) * ek; if (Math.abs(pt.to - pa) < .15) { pa = pt.to; pt = null; } } else if (!layer.querySelector(".panel:hover") && !draggingPanel) pa += dA + (RM || objSel ? 0 : rdt * .006); orbitFrame(t, ek); }
    if (((frame.n = (frame.n || 0) + 1) & 1) === 0) open.forEach(p => { if (p.origin && !p.min && t - p.born < 900) { const r = p.el.getBoundingClientRect(); FX.stream(p.origin.x, p.origin.y, r.left + r.width / 2, r.top + r.height / 2, 3); } });
    const a = ang % 360; cyl.style.transform = `rotateY(${a}deg)`; cylIn.style.transform = `rotateY(${-a * 1.6}deg)`;
    gl.forEach((g, i) => { const th = (-a * 1.3 + i * 360 / gl.length) * Math.PI / 180, y = -110 + (i % 4) * 62 + Math.sin(t / 900 + i) * 6; g.style.transform = `translate3d(${(Math.sin(th) * 92).toFixed(1)}px,${y.toFixed(1)}px,${(Math.cos(th) * 92).toFixed(1)}px)`; });
    secs.forEach((s, i) => {
      const th = (a + i * 360 / secs.length) * Math.PI / 180, x = Math.sin(th) * RO, z = Math.cos(th) * RO, y = Math.sin(i * 1.9) * 72, n = nodes.get(s.id), f = (z + RO) / (2 * RO);
      n.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px)`; { const zy = Math.cos(th + yaw * Math.PI / 180) * RO, fy = (zy + RO) / (2 * RO); n.style.opacity = (.42 + .58 * fy).toFixed(2); n.style.zIndex = Math.round(zy + RO); }
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  /* تدوير الاسطوانة بسحب الخلفية (فأرة/لمس) مع قصور ذاتي */
  /* السحب يدوّر من أي نقطة، حتى فوق عقدة قسم أو زر المركز: الضغط على زر «ينتظر» حتى يتحرك المؤشر 6px فيتحوّل إلى تدوير ويُلغى النقر؛ أما النقر العادي فيعمل كما هو */
  let pendDrag = null, noClick = false; const sp = new Set();
  const beginDrag = (e, x) => { tw = null; drag = { x, id: e.pointerId, t: performance.now(), v: 0, yaw: e.shiftKey }; try { stage.setPointerCapture(e.pointerId); } catch (_) { } stage.classList.add("grab"); lastInput = performance.now(); };
  stage.addEventListener("pointerdown", e => { clearSel(); sp.add(e.pointerId); if (sp.size > 1) { drag = null; pendDrag = null; return; } if (e.target.closest("button,.wcard")) { pendDrag = { x: e.clientX, id: e.pointerId, shift: e.shiftKey }; return; } beginDrag(e, e.clientX); });
  stage.addEventListener("pointermove", e => {
    if (pendDrag && e.pointerId === pendDrag.id && !drag && Math.abs(e.clientX - pendDrag.x) > 6) { beginDrag(e, pendDrag.x); drag.yaw = pendDrag.shift; noClick = true; pendDrag = null; }
    if (!drag || e.pointerId !== drag.id) return; const dx = e.clientX - drag.x, now = performance.now(); if (drag.yaw) setYaw(yaw + dx * .22); else { ang += dx * .35; drag.v = dx * .35 * .6 + drag.v * .4; } drag.x = e.clientX; lastInput = now; });
  stage.addEventListener("click", e => { if (noClick) { e.stopPropagation(); e.preventDefault(); noClick = false; } }, true);
  document.addEventListener("pointerup", e => { sp.delete(e.pointerId); pendDrag = null; setTimeout(() => { noClick = false; }, 60); }, true); document.addEventListener("pointercancel", e => sp.delete(e.pointerId), true);
  /* التواء بإصبعين على الخلفية = تدوير القاعة كلها */
  let ty0 = 0, ya0 = 0, tw2 = false; const tang = ts => Math.atan2(ts[1].clientY - ts[0].clientY, ts[1].clientX - ts[0].clientX) * 180 / Math.PI;
  stage.addEventListener("touchstart", e => { if (e.touches.length === 2 && !e.target.closest(".wcard,.node")) { tw2 = true; ty0 = tang(e.touches); ya0 = yaw; drag = null; stage.classList.add("grab"); } }, { passive: true });
  stage.addEventListener("touchmove", e => { if (tw2 && e.touches.length === 2) { e.preventDefault(); let da = tang(e.touches) - ty0; da = ((da + 540) % 360) - 180; setYaw(ya0 + da); } }, { passive: false });
  stage.addEventListener("touchend", e => { if (e.touches.length < 2 && tw2) { tw2 = false; stage.classList.remove("grab"); } }, { passive: true });
  $("#yawchip").addEventListener("click", () => setYaw(0));
  const endDrag = e => { if (!drag) return; va = clamp(drag.v, -14, 14); drag = null; stage.classList.remove("grab"); };
  stage.addEventListener("pointerup", endDrag); stage.addEventListener("pointercancel", endDrag);
  /* تحديد قسم: تظليل العقدة + تدوير سلس لتقديمها نحو المستخدم */
  let sel = null;
  function select(id, rotate) { sel = id; { const a = document.getElementById("active"), sc = SEC.find(s => s.id === id); if (a && sc) { a.textContent = sc.name; a.classList.add("on"); } } nodes.forEach((n, k) => { n.classList.toggle("sel", k === id); n.setAttribute("aria-current", k === id ? "true" : "false"); }); dock.querySelectorAll("button").forEach(b => b.classList.toggle("sel", b.dataset.id === id)); if (rotate !== false && nodes.has(id)) spinTo(id); }
  const step = d => { const i = secs.findIndex(s => s.id === sel), j = i < 0 ? 0 : (i + d + secs.length) % secs.length; select(secs[j].id); };
  document.addEventListener("keydown", e => { const k = String(e.key || ""), tg = e.target || {}, inPanel = tg.closest && tg.closest(".panel");
    if (/INPUT|TEXTAREA/.test(tg.tagName || "")) { if (k === "Escape") tg.blur(); return; }
    if (!e.ctrlKey && !e.metaKey && !e.altKey) { const kl = k.toLowerCase(); if (kl === "w") { clearSel(); return; } if (kl === "o") { toObject(); return; } if (kl === "f") { toFocus(); return; } if (objSel && modeOf() === "object" && TOOLS[kl]) { setTool(TOOLS[kl]); return; } }
    if (k === "Escape" && (focused || objSel)) { const bp = objSel && open.get(objSel), fp = bp && bp.big ? bp : open.get(focused); if (fp && fp.big) toggleBig(fp); else if (fp) dismiss(fp.id, "close"); return; } if (inPanel) return;
    if (k === "[") setYaw(yaw - 10); else if (k === "]") setYaw(yaw + 10); else if (k === "0") setYaw(0); else if (k === "ArrowRight") { e.preventDefault(); step(1); } else if (k === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if ((k === "Enter" || k === " ") && sel && !/BUTTON/.test(tg.tagName || "")) { e.preventDefault(); openSection(sel); } });

  /* ───── مدير الألواح ───── */
  const open = new Map(), memo = {}; let zc = 10, focused = null;
  /* حفظ حالة اللوح عند الإغلاق/الرمي ليعود بمحتواه (فلتر الطلبات، محادثة المساعد…) وحجمه */
  function remember(p) { memo[p.id] = { content: JSON.parse(JSON.stringify(p.content || {})), size: { w: p.big && p.prev ? p.prev.w : p.st.w, h: p.big && p.prev ? p.prev.h : p.st.h } }; }
  const fz = p => 1 - 0; /* موضع للتوسّع المستقبلي */
  function persp(tz) { return PERSP / (PERSP - tz); }
  function apply(p) { const s = p.st, tz = s.z + (p.id === focused ? 40 : 0) + (p.lift || 0), hx = (p.bk ? p.bk.x : 0) + (p.hold ? p.hold.x : 0), hy = (p.bk ? p.bk.y : 0) + (p.hold ? p.hold.y : 0); p.el.style.transform = `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,${tz}px) rotateX(${(s.rx + hx).toFixed(1)}deg) rotateY(${(s.ry + hy).toFixed(1)}deg) rotateZ(${(s.rz || 0).toFixed(1)}deg) scale(${s.s.toFixed(3)})`; p.el.style.setProperty("--gx", ((s.ry + hy) * 1.5).toFixed(1) + "%"); p.el.style.setProperty("--zp", clamp((s.z - ZMIN) / (ZMAX - ZMIN), 0, 1).toFixed(3)); p.el.style.setProperty("--w", s.w + "px"); p.el.style.setProperty("--h", s.h + "px"); }
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
  /* ───── المدار ───── */
  const orbList = () => [...open.values()].filter(p => !p.min && !p.user && !p.big);
  const OS = () => clamp(W() / 2400, .45, .6);
  function orbState(thDeg, i, k) { const th = thDeg * Math.PI / 180, c = Math.cos(th), s = Math.sin(th); return { c, st: { x: s * W() * .335, y: -H() * .04 + Math.sin(th * 2 + (i || 0)) * 14, z: c * 340, rx: -3, ry: -s * 30, s: OS() * (k || 1) } }; }
  const wrap = d => ((d % 360) + 540) % 360 - 180;
  function setLayer(p, back) { if (!!p.inBack === back) return; p.inBack = back; p.el.classList.toggle("back", back); (back ? layerBack : layer).appendChild(p.el); }
  function orbitFrame(now, ek) {
    const list = orbList(), n = list.length, step = 360 / Math.max(n, 1);
    list.forEach((p, i) => {
      if (p.off == null) p.off = i * step; p.off += wrap(i * step - p.off) * (ek || .1) * .7;
      const o = orbState(pa + p.off + yaw, i, n <= 4 ? 1 : Math.max(.74, 4 / n)); Object.assign(p.st, o.st);
      const born = now - (p.born || 0) < 1000; if (!born) p.el.style.setProperty("--op", (.42 + .58 * (o.c + 1) / 2).toFixed(2));
      p.el.style.zIndex = Math.round(o.c * 100 + 200); setLayer(p, o.c < (p.inBack ? .05 : -.18) && p.id !== focused);
      apply(p);
    });
  }
  /* خروج لوح من المدار عند إمساك المستخدم به: يبقى حيث هو أمام الاسطوانة */
  function snapOrbit(p, force) {
    if (!orbitMode || !p.user || p.big) return false; const nx = p.st.x / (W() * .335), nz = p.st.z / 340, th = Math.atan2(nx, nz) * 180 / Math.PI, ideal = orbState(th, 0).st;
    if (!force && Math.hypot(p.st.x - ideal.x, p.st.y - ideal.y) > 70) return false;
    p.user = false; p.off = wrap(th - pa - yaw); p.el.classList.remove("free"); p.el.classList.add("tr2"); setTimeout(() => p.el.classList.remove("tr2"), 700); return true;
  }
  function userize(p) { if (p.user) return; p.el.classList.add("free"); p.user = true; setLayer(p, false); p.el.style.setProperty("--op", 1); p.el.classList.remove("back"); }
  /* يعيد ترتيب الألواح التي لم يحرّكها المستخدم؛ الجديد يأخذ مكانه فوراً والباقي ينزلق بسلاسة */
  function arrange(fresh) {
    if (orbitMode) { const list = orbList(); if (fresh) { const i = list.indexOf(fresh), step = 360 / list.length; fresh.off = i * step; let to = -i * step; to += Math.round((pa - to) / 360) * 360; pt = { to }; Object.assign(fresh.st, orbState(0, i).st); } return; }
    const list = [...open.values()].filter(p => !p.min && !p.user && !p.big), L = layoutFor(list.length);
    list.forEach((p, i) => { const c = L[i]; if (p === fresh) { Object.assign(p.st, { x: c.x, y: c.y, z: c.z, rx: c.rx, ry: c.ry, s: c.s }); return; } p.el.classList.remove("tr"); p.el.classList.add("tr2"); Object.assign(p.st, { x: c.x, y: c.y, z: c.z, rx: c.rx, ry: c.ry, s: c.s }); apply(p); setTimeout(() => p.el.classList.remove("tr2"), 450); });
  }
  const rectOf = p => ({ x: p.st.x, y: p.st.y, w: p.st.w * p.st.s, h: p.st.h * p.st.s });
  function overlap(a, b) { const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x), oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y); return ox > 0 && oy > 0 ? { ox, oy, a: ox * oy } : null; }
  function sizeFor(sec) { const mw = W(), mh = H(); return isMob() ? { w: Math.min(sec.w, mw - 24), h: Math.min(sec.h, Math.round(mh * .42)) } : { w: Math.min(sec.w, mw - 60), h: Math.min(sec.h, mh - 120) }; }
  function nodePos(id) { const n = id === "ai" ? core : nodes.get(id); if (!n) return { x: 0, y: 0 }; const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2 - W() / 2, y: r.top + r.height / 2 - H() / 2 }; }
  function render(p, keep) { const b = p.body, top = b.scrollTop; b.innerHTML = p.sec.html(p); if (keep !== false) b.scrollTop = top; }
  const refreshAll = () => { open.forEach(p => { if (!p.min) render(p); }); fillWalls(); };
  function markNodes() { document.body.classList.toggle("many", open.size > 3); nodes.forEach((n, id) => { const p = open.get(id); n.classList.toggle("open", !!p && !p.min); n.classList.toggle("min", !!p && p.min); }); dock.querySelectorAll("button").forEach(b => { const p = open.get(b.dataset.id); b.classList.toggle("open", !!p && !p.min); }); }
  function pulse(id) { const n = nodes.get(id); if (n) { n.classList.remove("hot"); void n.offsetWidth; n.classList.add("hot"); } core.classList.remove("pulse"); void core.offsetWidth; core.classList.add("pulse"); }

  function openSection(id) {
    const sec = SEC.find(s => s.id === id); if (!sec) return;
    const ex = open.get(id), from = nodePos(id); select(id);
    if (ex) { if (ex.min) { ex.min = false; ex.el.style.display = ""; setTimeout(() => { ex.body.scrollTop = ex.scroll || 0; }, 30); ex.el.classList.add("tr"); arrange(ex); ex.keep = Object.assign({}, ex.st); setPos(ex, ex.keep, from); setTimeout(() => ex.el.classList.remove("tr"), 900); } faceFront(ex); focus(id); pulse(id); FX.burst(from.x + W() / 2, from.y + H() / 2, "220,255,31", 26, 3.5); markNodes(); return; }
    const sz = sizeFor(sec); if (memo[id] && memo[id].size) { sz.w = Math.min(memo[id].size.w, W() - 24); sz.h = Math.min(memo[id].size.h, H() - 80); }
    const sl = { x: 0, y: 0, z: 0, rx: 0, ry: 0 }, el = document.createElement("section"); el.className = "panel"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", sec.name); el.tabIndex = -1;
    el.innerHTML = '<i class="face"></i><i class="vol v2"></i><i class="vol v1"></i><i class="slab s3"></i><i class="slab s2"></i><i class="slab s1"></i><i class="pn-ac"></i><i class="eg t"></i><i class="eg b"></i><i class="eg l"></i><i class="eg r"></i><header class="pn-h"><button type="button" class="pn-rot" aria-label="تدوير اللوح (اسحب)" title="اسحب لتدوير اللوح">&#10227;</button><button type="button" class="pn-dep" aria-label="تحريك في العمق (اسحب عمودياً)" title="اسحب عمودياً: أقرب/أبعد">&#8661;</button><h3></h3><button type="button" class="pn-orb" aria-label="إرجاع إلى المدار" title="إرجاع إلى المدار">&#9678;</button><button type="button" class="pn-min" aria-label="تصغير" title="تصغير">&#8211;</button><button type="button" class="pn-max" aria-label="تكبير/استعادة" title="تكبير">&#9633;</button><button type="button" class="pn-x" aria-label="إغلاق" title="إغلاق">&#10005;</button></header><div class="pn-b"></div><div class="gbadge" aria-hidden="true"></div><i class="pn-z" aria-hidden="true"><b></b></i><i class="pn-br" aria-hidden="true"></i><i class="pn-rs" aria-hidden="true"></i>';
    el.querySelector("h3").textContent = sec.name;
    const content = memo[id] && sec.st ? JSON.parse(JSON.stringify(memo[id].content)) : sec.st ? JSON.parse(JSON.stringify(sec.st)) : {}, p = { id, content, sec: Object.assign({}, sec, { html: q => sec.html({ st: content, big: p.big }) }), el, body: el.querySelector(".pn-b"), min: false, big: false, keep: null, st: { x: sl.x, y: sl.y, z: sl.z, rx: sl.rx, ry: sl.ry, s: 1, w: sz.w, h: sz.h } };
    setState(p, "opening"); p.born = performance.now(); p.origin = { x: from.x + W() / 2, y: from.y + H() / 2 }; layer.appendChild(el); open.set(id, p); wire(p); arrange(p); if (sec.bind) sec.bind(p.body, { st: content }, all => all ? refreshAll() : render(p)); render(p, false);
    p.keep = Object.assign({}, p.st);
    Object.assign(p.st, { x: from.x * .35, y: from.y * .35, z: -380, s: .1, rx: 0, ry: 0 }); apply(p); el.style.setProperty("--op", 0); el.classList.add("tr"); void el.offsetWidth;
    Object.assign(p.st, p.keep); focus(id); apply(p); el.style.setProperty("--op", 1); if (RM) { el.classList.remove("tr"); }
    setTimeout(() => { el.classList.remove("tr"); if (p.state === "opening") setState(p, focused === id ? "focused" : "floating"); }, 950); pulse(id); FX.burst(from.x + W() / 2, from.y + H() / 2, "43,228,255", 40, 4.5); markNodes(); setTimeout(() => { try { el.focus({ preventScroll: true }); } catch (e) { } }, 60);
  }
  function setPos(p, s, from) { if (from) { Object.assign(p.st, { x: from.x * .35, y: from.y * .35, z: -380, s: .1 }); apply(p); p.el.style.setProperty("--op", 0); void p.el.offsetWidth; } Object.assign(p.st, s); apply(p); p.el.style.setProperty("--op", 1); }
  function focus(id) { focused = id; open.forEach(p => { p.el.classList.toggle("focus", p.id === id); if (!p.min && p.state !== "opening" && p.state !== "expanded" && p.state !== "dismissing") setState(p, p.id === id ? "focused" : "floating"); if (p.id === id) { p.el.style.zIndex = ++zc; } apply(p); }); }
  /* ───── مرحلة 3: قصور ذاتي، تثبيت التدوير، تغذية بصرية، عمق، مفاتيح ───── */
  const ZMIN = -260, ZMAX = 300, stLog = []; let lastPanelDrag = 0;
  /* آلة حالات اللوح: opening → floating ⇄ focused ⇄ expanded، minimized، dismissing (ثم يُزال)؛ كل انتقال يُسجَّل ويظهر في data-state */
  function setState(p, s) { if (p.state === s) return; p.state = s; p.el.dataset.state = s; stLog.push([p.id, s, Math.round(performance.now())]); if (stLog.length > 300) stLog.shift(); }
  /* قصور ذاتي دوراني بعد تدوير اللوح: يستمر الدوران ثم يتباطأ بالاحتكاك ويستقر على زاوية مقروءة */
  function spin(p, wy, wx) { cancelGlide(p); let last = performance.now(); const step = t => { const dt = Math.min(100, t - last); last = t; p.st.ry = clamp(p.st.ry + wy * dt, -34, 34); p.st.rx = clamp(p.st.rx + wx * dt, -26, 26); const k = Math.exp(-dt / 260); wy *= k; wx *= k; badge(p, "⟲ " + Math.round(p.st.ry) + "° / " + Math.round(p.st.rx) + "°"); apply(p); if (Math.hypot(wy, wx) > .006) p.glide = requestAnimationFrame(step); else { p.glide = 0; settleRot(p); } }; p.glide = requestAnimationFrame(step); }
  const badge = (p, txt) => { const b = p.el.querySelector(".gbadge"); if (b) { b.textContent = txt || ""; b.classList.toggle("on", !!txt); } };
  function cancelGlide(p) { if (p.glide) { cancelAnimationFrame(p.glide); p.glide = 0; } }
  /* انزلاق بعد الإفلات بقصور ذاتي واحتكاك (يرتدّ برفق عن حدود مساحة العمل) ثم تثبيت على المدار أو إزاحة لتفادي التراكب */
  function glide(p, vx, vy) {
    cancelGlide(p); let last = performance.now(); p.el.classList.add("gliding");
    const step = t => { const dt = Math.min(100, t - last); last = t; const f = persp(p.st.z + (focused === p.id ? 40 : 0)); p.st.x += vx * dt / f; p.st.y += vy * dt / f; const k = Math.exp(-dt / 240); vx *= k; vy *= k;
      p.bk = { y: clamp(vx * 5, -9, 9), x: clamp(-vy * 4, -7, 7) }; const mx = W() / 2 - p.st.w * p.st.s / 3, my = H() / 2 - p.st.h * p.st.s / 3; if (Math.abs(p.st.x) > mx) { p.st.x = clamp(p.st.x, -mx, mx); vx *= -.35; } if (Math.abs(p.st.y) > my) { p.st.y = clamp(p.st.y, -my, my); vy *= -.35; } apply(p);
      if (Math.hypot(vx, vy) > .02) p.glide = requestAnimationFrame(step); else { p.glide = 0; p.bk = null; p.el.classList.remove("gliding"); p.el.classList.add("tr2"); setTimeout(() => p.el.classList.remove("tr2"), 400); if (!snapOrbit(p)) resolve(p); } };
    p.glide = requestAnimationFrame(step);
  }
  /* بعد تدوير اللوح: يرجع تلقائياً إلى زاوية مقروءة (≤24° أفقياً و≤18° رأسياً) */
  function settleRot(p) { badge(p, ""); if (Math.abs(p.st.ry) > 24 || Math.abs(p.st.rx) > 18) { p.st.ry = clamp(p.st.ry, -24, 24); p.st.rx = clamp(p.st.rx, -18, 18); p.el.classList.add("tr2"); apply(p); setTimeout(() => p.el.classList.remove("tr2"), 450); } }
  function settleRz(p) { if (p.st.rz) { p.el.classList.add("tr2"); p.st.rz = 0; apply(p); setTimeout(() => p.el.classList.remove("tr2"), 450); } }
  /* تقديم لوح المدار المحدَّد نحو المستخدم */
  function faceFront(p) { if (!orbitMode || p.user || p.big || p.off == null) return; let to = -p.off - yaw; to += Math.round((pa - to) / 360) * 360; pt = { to }; }

  /* ───── مرحلة 5: الأوضاع الثلاثة ─────
     العالم: لا لوح محدَّد — سحب الخلفية/Shift/التواء يدوّر البيئة كلها.
     الكائن: لوح صغير محدَّد — كل الإيماءات تخصّه وحده والبيئة ثابتة (لا دوران تلقائي ولا قصور).
     التركيز: اللوح المحدَّد موسَّع في مركز مساحة العمل، مثبَّت حتى نقرتين/Esc. */
  const TOOLS = { m: "move", r: "rot", z: "depth", t: "roll" }, TOOL_NAME = { move: "تحريك", rot: "تدوير", depth: "عمق", roll: "ميل" }, ACT_NAME = { move: "يتحرك", rot: "يدور", depth: "يتحرك في العمق", roll: "يميل", focus: "مثبّت للتركيز", resize: "يتغيّر حجمه", pinch: "قرص/التواء" };
  function modeOf() { const p = objSel && open.get(objSel); return !p || p.min ? "world" : p.big ? "focus" : "object"; }
  function setRead(txt) {
    const r = document.getElementById("mread"); if (!r) return; const m = modeOf(), p = objSel && open.get(objSel), nm = p ? p.sec.name : "";
    r.textContent = txt || (m === "world" ? "العالم — اسحب الخلفية لتدوير البيئة كلها" : m === "object" ? "الكائن · " + nm + " — الأداة: " + TOOL_NAME[tool] : "التركيز · " + nm + " — نقرتان أو Esc للعودة");
  }
  function syncMode() {
    const m = modeOf(); document.body.dataset.mode = m;
    document.querySelectorAll("#modebar [data-m]").forEach(b => { const on = b.dataset.m === m; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
    document.querySelectorAll("#modebar [data-t]").forEach(b => { const on = b.dataset.t === tool; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
    open.forEach(p => p.el.classList.toggle("objsel", p.id === objSel && !p.min)); setRead();
  }
  /* بعد إزالة اللوح المحدَّد: إن كان لوح آخر موسَّعاً يعود التحديد إليه (وضع التركيز) وإلا يعود وضع العالم */
  const bigSel = skip => { const q = [...open.values()].find(o => o.id !== skip && o.big && !o.min); return q ? q.id : null; };
  function selectObj(id) { if (objSel === id) { syncMode(); return; } objSel = id; va = 0; syncMode(); }
  function clearSel() { if (!objSel) return; objSel = null; syncMode(); }
  function setTool(t) { tool = t; syncMode(); }
  const livePanel = () => { const a = objSel && open.get(objSel); if (a && !a.min) return a; const f = focused && open.get(focused); if (f && !f.min) return f; return [...open.values()].filter(q => !q.min).pop() || null; };
  function toObject() { const p = livePanel(); if (!p) return; if (p.big) { toggleBig(p); return; } focus(p.id); selectObj(p.id); }
  function toFocus() { const p = livePanel(); if (!p) return; if (!p.big) { focus(p.id); toggleBig(p); } }
  /* تغذية بصرية: ما الذي يفعله اللوح الآن (تحريك/تدوير/عمق/ميل/تحجيم) + إمكان الرمي */
  function act(p, a) {
    if (a) p.el.dataset.act = a; else { delete p.el.dataset.act; p.el.classList.remove("can-dismiss"); document.body.classList.remove("throwzone"); }
    setRead(a ? "الكائن · " + p.sec.name + " · " + (ACT_NAME[a] || a) : null);
  }
  /* نيّة الرمي: سرعة شعاعية نحو الخارج (تُعتمد فقط حين يبتعد اللوح عن المركز فلا يُعدّ عبور المركز رمياً) أو تجاوز الحافة؛ تُستعمل للتلميح قبل الإفلات وللقرار عند الإفلات معاً */
  function throwIntent(p, s) {
    const n = s.length; let vx = 0, vy = 0; if (n >= 2) { const a = s[0], b = s[n - 1], dt = Math.max(1, b[0] - a[0]); vx = (b[1] - a[1]) / dt; vy = (b[2] - a[2]) / dt; }
    const sp = Math.hypot(vx, vy), pos = Math.hypot(p.st.x, p.st.y) || 1, out = (vx * p.st.x + vy * p.st.y) / pos, beyond = Math.abs(p.st.x) > W() / 2 + p.st.w * p.st.s * .15 || Math.abs(p.st.y) > H() / 2 + p.st.h * p.st.s * .15;
    return { vx, vy, sp, out, beyond, n, can: (sp > .5 && out > .15 * sp && pos > Math.min(W(), H()) * .14) || beyond };
  }
  function dismissHint(p, g) {
    const can = throwIntent(p, g.s).can;
    p.el.classList.toggle("can-dismiss", can); document.body.classList.toggle("throwzone", can); if (can) badge(p, "حرّر للرمي"); else if (p.el.querySelector(".gbadge").textContent === "حرّر للرمي") badge(p, "");
  }
  /* ───── مرحلة 7: فيزياء طبيعية — قصور في العمق، مغناطيس ناعم نحو المواضع المفضَّلة، رفع/إمالة عند الإمساك ───── */
  const SLOT_R = 110;
  function dropHold(p, mode) { ghost(null); if (!p.lift && !p.hold) return; p.lift = 0; p.hold = null; if (mode !== "rot") { p.el.classList.add("tr2"); setTimeout(() => p.el.classList.remove("tr2"), 420); } apply(p); }
  /* مواضع العمل المفضَّلة = شبكة التخطيط الذكي؛ لا مغناطيس في المدار (للمدار تثبيته الخاص) ولا للوح الموسَّع، ولا إن كان الموضع محجوزاً بلوح آخر */
  /* الموضع «حرّ» إن لم يحجب أكثر من 35% من لوح آخر */
  function slotFree(p, c) { const me = { x: c.x, y: c.y, w: p.st.w * p.st.s, h: p.st.h * p.st.s }; for (const o of open.values()) if (o !== p && !o.min && !o.big) { const r = overlap(me, rectOf(o)); if (r && r.a > .35 * Math.min(me.w * me.h, rectOf(o).w * rectOf(o).h)) return false; } return true; }
  function magnetFor(p) {
    if (orbitMode || p.big || isMob()) return null; let best = null; layoutFor(6).forEach(c => { const d = Math.hypot(c.x - p.st.x, c.y - p.st.y); if (d < SLOT_R && (!best || d < best.d)) best = { c, d }; }); if (!best) return null;
    return slotFree(p, best.c) ? best : null;
  }
  function ghost(p, m) {
    let gh = document.getElementById("slotghost"); if (!m) { if (gh) gh.classList.remove("on"); return; }
    if (!gh) { gh = document.createElement("div"); gh.id = "slotghost"; gh.className = "slotghost"; gh.setAttribute("aria-hidden", "true"); layer.appendChild(gh); }
    gh.style.setProperty("--w", p.st.w + "px"); gh.style.setProperty("--h", p.st.h + "px"); gh.style.transform = `translate3d(${m.c.x.toFixed(1)}px,${m.c.y.toFixed(1)}px,0) scale(${p.st.s})`; gh.style.opacity = (.3 + .6 * (1 - m.d / SLOT_R)).toFixed(2); gh.classList.add("on");
  }
  /* سرعة العمق عند الإفلات من عيّنات السحب العمودي → قصور مع احتكاك وارتداد خفيف عند الحدّين */
  function zIntent(s) { const n = s.length; if (n < 2) return 0; const a = s[0], b = s[n - 1], dt = Math.max(1, b[0] - a[0]); return clamp(-(b[2] - a[2]) / dt * .35, -1.2, 1.2); }
  function zglide(p, vz) {
    cancelGlide(p); let last = performance.now();
    const step = t => { const dt = Math.min(100, t - last); last = t; p.st.z += vz * dt; if (p.st.z > ZMAX) { p.st.z = ZMAX; vz *= -.3; } else if (p.st.z < ZMIN) { p.st.z = ZMIN; vz *= -.3; } vz *= Math.exp(-dt / 240); badge(p, "عمق " + Math.round(p.st.z)); apply(p); if (Math.abs(vz) > .012) p.glide = requestAnimationFrame(step); else { p.glide = 0; badge(p, ""); resolve(p); } };
    p.glide = requestAnimationFrame(step);
  }
  function settleRoll(p) { const rz = clamp(p.st.rz || 0, -12, 12); if (rz !== p.st.rz) { p.st.rz = rz; p.el.classList.add("tr2"); apply(p); setTimeout(() => p.el.classList.remove("tr2"), 450); } }
  document.querySelectorAll("#modebar [data-m]").forEach(b => b.addEventListener("click", () => { const m = b.dataset.m; if (m === "world") clearSel(); else if (m === "object") toObject(); else toFocus(); }));
  document.querySelectorAll("#modebar [data-t]").forEach(b => b.addEventListener("click", () => { if (modeOf() !== "object") toObject(); setTool(b.dataset.t); }));
  function wire(p) {
    const el = p.el, h = el.querySelector(".pn-h"), rot = el.querySelector(".pn-rot"), rs = el.querySelector(".pn-rs");
    el.addEventListener("pointerdown", () => { if (focused !== p.id) focus(p.id); selectObj(p.id); });
    el.addEventListener("pointerenter", () => { hov++; }); el.addEventListener("pointerleave", () => { hov = Math.max(0, hov - 1); });
    el.querySelector(".pn-orb").onclick = () => snapOrbit(p, true); el.querySelector(".pn-x").onclick = () => dismiss(p.id, "close"); el.querySelector(".pn-min").onclick = () => dismiss(p.id, "min"); el.querySelector(".pn-max").onclick = () => toggleBig(p);
    let tap = 0, tapX = 0;
    h.addEventListener("pointerdown", e => {
      if (e.target.closest(".pn-min,.pn-max,.pn-x,.pn-orb")) return; e.preventDefault(); const mode = e.target.closest(".pn-rot") ? "rot" : e.target.closest(".pn-dep") ? "depth" : e.shiftKey ? "rot" : e.altKey ? "depth" : (e.ctrlKey || e.metaKey) ? "roll" : tool, now = performance.now();
      if ((mode === "move" || p.big) && !e.target.closest(".pn-dep,.pn-rot") && now - tap < 520 && Math.abs(e.clientX - tapX) < 30) { tap = 0; toggleBig(p); return; } tap = now; tapX = e.clientX;
      if (p.big) { act(p, "focus"); return; } /* وضع التركيز: اللوح ثابت في مركز مساحة العمل (نقرتان أو Esc للعودة) */
      cancelGlide(p); el.classList.remove("tr", "tr2", "gliding"); el.classList.add("dragging"); const g = { mode, id: e.pointerId, x: e.clientX, y: e.clientY, s: [] }; h._g = g; try { h.setPointerCapture(e.pointerId); } catch (_) { }
      /* استجابة فيزيائية للإمساك: يرتفع اللوح نحو الكاميرا قليلاً ويميل بحسب موضع الإمساك (كأن الإصبع يثبّت نقطة منه) */
      { const r = el.getBoundingClientRect(), gx = clamp((e.clientX - (r.left + r.width / 2)) / Math.max(1, r.width / 2), -1, 1), gy = clamp((e.clientY - (r.top + r.height / 2)) / Math.max(1, r.height / 2), -1, 1); p.lift = 22; p.hold = mode === "rot" ? null : { x: -gy * 3 - 1, y: gx * 4.5 }; el.classList.add("tr2"); apply(p); setTimeout(() => { if (h._g === g) el.classList.remove("tr2"); }, 240); }
    });
    h.addEventListener("pointermove", e => { const g = h._g; if (!g || g.id !== e.pointerId) return; const dx = e.clientX - g.x, dy = e.clientY - g.y; g.x = e.clientX; g.y = e.clientY; const t = performance.now(); let co = []; try { co = e.getCoalescedEvents ? e.getCoalescedEvents() : []; } catch (_) { } if (co.length > 1) co.forEach(c => g.s.push([c.timeStamp || t, c.clientX, c.clientY])); else g.s.push([t, e.clientX, e.clientY]); while (g.s.length > 2 && t - g.s[0][0] > 170) g.s.shift();
      userize(p); draggingPanel = true; act(p, g.mode); if (g.mode === "roll") { p.st.rz = clamp((p.st.rz || 0) + dx * .22, -35, 35); badge(p, "ميل " + Math.round(p.st.rz) + "°"); } else if (g.mode === "depth") { p.st.z = clamp(p.st.z - dy * 1.15, ZMIN, ZMAX); badge(p, "عمق " + Math.round(p.st.z)); } else if (g.mode === "move") { const f = persp(p.st.z + (focused === p.id ? 40 : 0)); p.st.x += dx / f; p.st.y += dy / f; { const m = magnetFor(p); if (m) { const k = (1 - m.d / SLOT_R) * .18; p.st.x += (m.c.x - p.st.x) * k; p.st.y += (m.c.y - p.st.y) * k; } ghost(p, m); } p.bk = { y: clamp(((p.bk && p.bk.y) || 0) * .5 + dx * .45, -9, 9), x: clamp(((p.bk && p.bk.x) || 0) * .5 - dy * .35, -7, 7) }; } else { p.st.ry = clamp(p.st.ry + dx * .35 * (1 - Math.abs(p.st.ry) / 75), -34, 34); p.st.rx = clamp(p.st.rx - dy * .3 * (1 - Math.abs(p.st.rx) / 65), -26, 26); badge(p, "⟲ " + Math.round(p.st.ry) + "° / " + Math.round(p.st.rx) + "°"); } if (g.mode === "move") dismissHint(p, g); apply(p); });
    const up = e => { const g = h._g; if (!g || g.id !== e.pointerId) return; h._g = null; draggingPanel = false; el.classList.remove("dragging"); lastPanelDrag = performance.now(); act(p, ""); dropHold(p, g.mode); if (g.mode === "roll") { badge(p, ""); settleRoll(p); return; } if (g.mode === "depth") { const vz = zIntent(g.s); if (Math.abs(vz) > .05) zglide(p, vz); else { badge(p, ""); resolve(p); } return; } if (g.mode === "rot") { const s = g.s, n = s.length; let wy = 0, wx = 0; if (n >= 2) { const a = s[0], b = s[n - 1], dt = Math.max(1, b[0] - a[0]); wy = (b[1] - a[1]) / dt * .3; wx = -(b[2] - a[2]) / dt * .25; } if (Math.hypot(wy, wx) > .03) spin(p, wy, wx); else settleRot(p); return; } p.bk = null; el.classList.add("tr2"); setTimeout(() => el.classList.remove("tr2"), 400); g.s.push([performance.now(), e.clientX, e.clientY]); release(p, g); };
    h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
    /* تحجيم بمقبض الزاوية */
    rs.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); cancelGlide(p); el.classList.remove("tr", "tr2"); el.classList.add("dragging"); rs._g = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { rs.setPointerCapture(e.pointerId); } catch (_) { } focus(p.id); selectObj(p.id); act(p, "resize"); });
    rs.addEventListener("pointermove", e => { const g = rs._g; if (!g || g.id !== e.pointerId) return; const f = persp(p.st.z) * p.st.s, dx = (e.clientX - g.x) / f, dy = (e.clientY - g.y) / f; g.x = e.clientX; g.y = e.clientY; const nw = clamp(p.st.w - dx, 300, Math.min(920, W() - 16)), nh = clamp(p.st.h + dy, 240, Math.min(720, H() - 60)), dw = nw - p.st.w, dh = nh - p.st.h; userize(p); p.st.w = nw; p.st.h = nh; p.st.x -= dw * p.st.s / 2; p.st.y += dh * p.st.s / 2; badge(p, Math.round(nw) + "×" + Math.round(nh)); apply(p); });
    const rsUp = e => { if (rs._g) { rs._g = null; act(p, ""); el.classList.remove("dragging"); badge(p, ""); lastPanelDrag = performance.now(); resolve(p); } }; rs.addEventListener("pointerup", rsUp); rs.addEventListener("pointercancel", rsUp);
    /* عجلة الفأرة: تكبير اللوح (إلا إن كان المحتوى قابلاً للتمرير) */
    el.addEventListener("wheel", e => { if (e.shiftKey) { e.preventDefault(); userize(p); const d = e.deltaY || e.deltaX; p.st.z = clamp(p.st.z + (d < 0 ? 34 : -34), ZMIN, ZMAX); p.el.classList.add("tr2"); apply(p); badge(p, "عمق " + Math.round(p.st.z)); clearTimeout(p._bt); p._bt = setTimeout(() => { badge(p, ""); p.el.classList.remove("tr2"); }, 700); return; } const b = e.target.closest(".pn-b"); if (b && !e.ctrlKey && b.scrollHeight > b.clientHeight + 2) return; e.preventDefault(); userize(p); p.st.s = clamp(p.st.s * (e.deltaY < 0 ? 1.06 : .943), .5, 1.9); apply(p); }, { passive: false });
    /* قرص + التواء بإصبعين مع تغذية بصرية (يعود الالتواء تلقائياً لتبقى القراءة سهلة) */
    let pd = 0, ps = 1, a0 = 0, rz0 = 0; const ang2 = ts => Math.atan2(ts[1].clientY - ts[0].clientY, ts[1].clientX - ts[0].clientX) * 180 / Math.PI, dist2 = ts => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
    el.addEventListener("touchstart", e => { if (e.touches.length === 2) { pd = dist2(e.touches); ps = p.st.s; a0 = ang2(e.touches); rz0 = p.st.rz || 0; cancelGlide(p); el.classList.remove("tr", "tr2"); el.classList.add("gest"); selectObj(p.id); act(p, "pinch"); } }, { passive: true });
    el.addEventListener("touchmove", e => { if (e.touches.length === 2 && pd) { e.preventDefault(); let da = ang2(e.touches) - a0; da = ((da + 540) % 360) - 180; userize(p); p.st.s = clamp(ps * dist2(e.touches) / pd, .5, 1.9); p.st.rz = clamp(rz0 + da, -22, 22); badge(p, "×" + p.st.s.toFixed(2) + "  ↻ " + Math.round(p.st.rz) + "°"); apply(p); } }, { passive: false });
    el.addEventListener("touchend", e => { if (e.touches.length < 2 && pd) { pd = 0; el.classList.remove("gest"); act(p, ""); badge(p, ""); lastPanelDrag = performance.now(); settleRz(p); resolve(p); } }, { passive: true });
    /* لوحة المفاتيح: أسهم = تحريك، Alt+أسهم = إمالة، PageUp/PageDown = عمق، Home = عودة للمدار، Delete = رمي مع تلاشٍ */
    el.addEventListener("keydown", e => { const tg = e.target; if (/INPUT|TEXTAREA/.test(tg.tagName || "") || !(tg === el || (tg.closest && tg.closest(".pn-h")))) return; const k = String(e.key || ""), d = e.shiftKey ? 64 : 26; let used = true;
      if (/^Arrow/.test(k)) { userize(p); cancelGlide(p); if (e.altKey) { p.st.ry = clamp(p.st.ry + (k === "ArrowRight" ? 4 : k === "ArrowLeft" ? -4 : 0), -24, 24); p.st.rx = clamp(p.st.rx + (k === "ArrowUp" ? 3 : k === "ArrowDown" ? -3 : 0), -18, 18); } else { p.st.x += k === "ArrowRight" ? d : k === "ArrowLeft" ? -d : 0; p.st.y += k === "ArrowDown" ? d : k === "ArrowUp" ? -d : 0; } p.el.classList.add("tr2"); apply(p); setTimeout(() => p.el.classList.remove("tr2"), 300); }
      else if (k === "PageUp" || k === "PageDown") { userize(p); p.st.z = clamp(p.st.z + (k === "PageUp" ? 34 : -34), ZMIN, ZMAX); p.el.classList.add("tr2"); apply(p); badge(p, "عمق " + Math.round(p.st.z)); clearTimeout(p._bt); p._bt = setTimeout(() => { badge(p, ""); p.el.classList.remove("tr2"); }, 700); }
      else if (k === "Home") { if (!snapOrbit(p, true)) arrange(); }
      else if (k === "Delete" || k === "Backspace") { const n = Math.hypot(p.st.x, p.st.y) || 1; throwAway(p, (p.st.x || 1) / n * 1.6, p.st.y / n * 1.6); }
      else used = false; if (used) e.preventDefault(); });
  }
  /* رفع الإصبع: رمي نحو الحافة = تلاشٍ بجسيمات؛ وإلا تثبيت/إزاحة لتفادي التراكب */
  function release(p, g) {
    const t = throwIntent(p, g.s), vx = t.vx, vy = t.vy, sp = t.sp;
    SpatialOS.lastRelease = { sp: +sp.toFixed(2), out: +t.out.toFixed(2), beyond: t.beyond, n: t.n };
    if (t.can) return throwAway(p, vx || p.st.x / 400, vy || p.st.y / 400);
    if (sp > .08) { const m = Math.min(1, 2.4 / sp) * .6; glide(p, vx * m, vy * m); return; }
    if (snapOrbit(p)) return; resolve(p);
  }
  function throwAway(p, vx, vy) {
    hov = 0; act(p, ""); setState(p, "dismissing"); remember(p); const id = p.id; open.delete(id); if (focused === id) focused = null; if (objSel === id) objSel = bigSel(id); syncMode(); if (objSel && open.get(objSel)) focus(objSel); markNodes(); select(id); setTimeout(() => arrange(), 60); p.el.classList.remove("tr", "tr2"); let last = performance.now(), op = 1, burst = false, acc = 1; const sp = Math.max(.9, Math.hypot(vx, vy)), k = Math.min(2.2, 1.4 / sp * 1) || 1; cancelGlide(p); p.el.classList.add("dragging");
    const step = t => { const dt = Math.min(250, t - last); last = t; acc *= Math.pow(1.05, dt / 16); /* يتسارع نحو الخارج */ p.st.x += vx * dt * 1.15 * k * 1.4 * acc / persp(p.st.z); p.st.y += vy * dt * 1.15 * k * 1.4 * acc / persp(p.st.z); p.st.s *= Math.pow(.965, dt / 16); p.st.ry += vx * dt * .05; op -= dt / 520; p.el.style.setProperty("--op", Math.max(0, op).toFixed(2)); apply(p);
      if (!burst && op < .55) { burst = true; const r = p.el.getBoundingClientRect(); FX.dissolve(r, null); }
      if (op > 0) requestAnimationFrame(step); else p.el.remove(); };
    requestAnimationFrame(step);
  }
  function dismiss(id, how) {
    const p = open.get(id); if (!p) return; hov = 0; act(p, ""); if (objSel === id) objSel = bigSel(id); const to = nodePos(id); p.el.classList.remove("tr"); p.el.classList.add("tr2"); p.keep = Object.assign({}, p.st);
    if (focused === id) focused = null; Object.assign(p.st, { x: to.x * .35, y: to.y * .35, z: -380, s: .1 }); apply(p); p.el.style.setProperty("--op", 0);
    const r = p.el.getBoundingClientRect(); if (how === "close") { setState(p, "dismissing"); remember(p); open.delete(id); FX.dissolve(r, "43,228,255"); setTimeout(() => p.el.remove(), 420); } else { p.min = true; setState(p, "minimized"); p.scroll = p.body.scrollTop; setTimeout(() => { if (p.min) p.el.style.display = "none"; }, 420); }
    markNodes(); select(id); setTimeout(() => arrange(), 60); syncMode();
  }
  function toggleBig(p) {
    p.el.classList.remove("tr"); p.el.classList.add("tr2"); focus(p.id);
    if (!p.big) { p.prev = Object.assign({}, p.st); const w = Math.min(920, W() - 24), h = Math.min(660, H() - 92); Object.assign(p.st, { x: 0, y: isMob() ? -6 : -10, z: 110, rx: 0, ry: 0, s: 1, w, h }); p.big = true; setState(p, "expanded"); setLayer(p, false); p.el.style.setProperty("--op", 1); p.el.style.zIndex = ++zc; }
    else { Object.assign(p.st, p.prev); p.big = false; setState(p, focused === p.id ? "focused" : "floating"); }
    p.el.classList.toggle("is-big", p.big); const top = p.body.scrollTop; render(p); p.body.scrollTop = top; apply(p); setTimeout(() => p.el.classList.remove("tr2"), 420); objSel = p.id; va = 0; syncMode();
  }
  /* منع التراكب: إزاحة اللوح الساقط عن لوح يخفي أكثر من 35% + مغناطيس لأقرب موضع حرّ */
  function resolve(p) {
    if (p.big) return; const me = rectOf(p); let moved = false;
    open.forEach(o => { if (o === p || o.min || o.big) return; const r = overlap(me, rectOf(o)); if (r && r.a > .35 * Math.min(me.w * me.h, rectOf(o).w * rectOf(o).h)) { if (r.ox < r.oy) p.st.x += (me.x >= o.st.x ? 1 : -1) * (r.ox + 14); else p.st.y += (me.y >= o.st.y ? 1 : -1) * (r.oy + 14); moved = true; me.x = p.st.x; me.y = p.st.y; } });
    const mx = W() / 2 - me.w / 3, my = H() / 2 - me.h / 3; p.st.x = clamp(p.st.x, -mx, mx); p.st.y = clamp(p.st.y, -my, my);
    if (!moved) { const near = layoutFor(6).find(c => Math.hypot(c.x - p.st.x, c.y - p.st.y) < (isMob() ? 55 : 85) && slotFree(p, c)); if (near) { Object.assign(p.st, { x: near.x, y: near.y }); moved = true; }   /* المغناطيس موضعي فقط: لا يمسّ العمق ولا الإمالة التي ضبطها المستخدم */ }
    p.el.classList.add("tr2"); apply(p); setTimeout(() => p.el.classList.remove("tr2"), 420);
  }
  core.addEventListener("click", () => openSection("ai")); document.body.classList.toggle("orbit-on", orbitMode);
  function setOrbit(on) { orbitMode = on && !isMob(); document.body.classList.toggle("orbit-on", orbitMode); const bt = $("#hud-orbit"); if (bt) { bt.textContent = orbitMode ? "المدار: يعمل" : "المدار: متوقف"; bt.setAttribute("aria-pressed", orbitMode); }
    if (!orbitMode) { open.forEach(p => { setLayer(p, false); p.el.classList.remove("back"); p.el.style.setProperty("--op", 1); p.el.style.zIndex = ++zc; }); arrange(); } else open.forEach(p => { p.off = null; }); }
  $("#hud-orbit").addEventListener("click", () => setOrbit(!orbitMode));
  $("#hud-reset").addEventListener("click", () => { open.forEach(p => { p.user = false; p.el.classList.remove("free", "is-big"); p.big = false; const s = sizeFor(p.sec); p.st.w = s.w; p.st.h = s.h; p.off = null; }); if (orbitMode) { pt = null; } arrange(); });
  let vw0 = W(), vh0 = H();
  /* عند تغيير حجم النافذة: تُحفظ المواضع النسبية للألواح الحرة (والمدار يُعاد حسابه من الأبعاد الجديدة) */
  addEventListener("resize", () => { const kx = W() / vw0, ky = H() / vh0; vw0 = W(); vh0 = H();
    open.forEach(p => { if (p.min) return; if (p.big) { Object.assign(p.st, { w: Math.min(920, W() - 24), h: Math.min(660, H() - 92) }); } else { if (isMob()) { const m = sizeFor(p.sec); p.st.w = m.w; p.st.h = m.h; } if (!orbitMode || p.user) { p.st.x *= kx; p.st.y *= ky; } } apply(p); });
    if (!orbitMode) arrange(); });
  window.SpatialOS = { stateLog: () => stLog.slice(), stateOf: id => { const p = open.get(id); return p ? p.state : null; }, setYaw, get yaw() { return yaw; }, open: openSection, spinTo, select, snapOrbit, memo, get selected() { return sel; }, setOrbit, get orbit() { return orbitMode; }, get pa() { return pa; }, get tweening() { return !!pt; }, panels: open, dismiss, get angle() { return ang; }, set angle(v) { ang = v; }, get focused() { return focused; }, refreshAll, get mode() { return modeOf(); }, slots: () => layoutFor(6).map(c => ({ x: c.x, y: c.y })), get objSel() { return objSel; }, get tool() { return tool; }, setTool, clearSel, selectObj, toObject, toFocus, world: () => ({ angle: ang, yaw, pa, va, tw: !!tw, pt: !!pt }) };
  syncMode(); setTimeout(() => openSection("ord"), 700);
})();
