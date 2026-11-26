/* المشهد الفضائي: اسطوانة سحابية + عقد مدارية + مدير ألواح عائمة (سحب/تدوير/تحجيم/رمي/استعادة).
   معزول بالكامل؛ المحتوى من panels.js. كل إيماءة هنا منفَّذة، والمُختبَر منها مسجّل في README. */
(() => {
  const $ = s => document.querySelector(s), RM = matchMedia("(prefers-reduced-motion:reduce)").matches, PERSP = 1500;
  const layerBack = $("#panels-back"), stage = $("#stage"), cyl = $("#cyl"), cylIn = $("#cyl-in"), orbit = $("#orbit"), layer = $("#panels"), dock = $("#dock"), core = $("#core");
  const isMob = () => innerWidth <= 820, W = () => innerWidth, H = () => innerHeight;
  const PHR = () => (isMob() && window.SpatialPhone && SpatialPhone.on && SpatialPhone.rect) ? SpatialPhone.rect() : null;   /* مستطيل «الورقة» على الهاتف بين شرائط التنقل العلوية والسفلية (phone.js) */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ───── الاسطوانة ───── */
  let wLast = "", wAlive = 0, wLastT = 0, worldVer = 0; const bumpWorld = () => { worldVer++; };   /* نسخة تخطيط العالم: تُزاد عند أي تغيير يستلزم إعادة وضع العقد */
  const cols = ["#2be4ff", "#dcff1f", "#a58bff", "#2be4ff"];
  function slats(host, n, bars) { for (let i = 0; i < n; i++) { const s = document.createElement("div"); s.className = "slat"; s.style.setProperty("--i", i); s.style.setProperty("--R", "152px"); for (let k = 0; k < bars; k++) { const b = document.createElement("i"); b.style.top = (14 + ((i * 37 + k * 71) % 300)) + "px"; b.style.width = (8 + ((i * 13 + k * 29) % 26)) + "px"; b.style.setProperty("--c", cols[(i + k) % cols.length]); b.style.setProperty("--d", ((i * .21 + k * .37) % 3).toFixed(2) + "s"); s.appendChild(b); } host.appendChild(s); } }
  slats(cyl, 8, 0); /* الشرائح بخطوط بيانات ثابتة في CSS (لا عناصر مضيئة متحركة) والاسطوانة الداخلية محذوفة: عشرات الطبقات الشفافة كانت تُركَّب كل إطار */
  [[-150, 152, "#2be4ff"], [-60, 160, "#dcff1f"], [20, 154, "#2be4ff"], [100, 160, "#a58bff"], [160, 152, "#dcff1f"]].forEach(([y, r, c]) => { const e = document.createElement("div"); e.className = "ring"; e.style.setProperty("--y", y + "px"); e.style.setProperty("--r", r + "px"); e.style.setProperty("--c", c); cyl.appendChild(e); });

  /* ───── القاعة: شاشات جدارية + لوحيّات أرضية + أيقونات عائمة داخل الاسطوانة ───── */
  const room = $("#room"), kinds = ["a", "b", "c", "d"];
  function wall(cls, n) { const w = document.createElement("div"); w.className = "wall " + cls; for (let i = 0; i < n; i++) { const s = document.createElement("i"); s.className = "scr " + kinds[(i * 3 + n) % 4]; s.style.setProperty("--d", (i * .7 % 6) + "s"); w.appendChild(s); } room.appendChild(w); }
  /* قاعة كاملة بحسب صورة المرجع: جدار خلفي بنيوي + مجموعتا شاشات خلفيتان + جداران جانبيان (كلها بطاقات حيّة شفافة) + أعمدة وعوارض إضاءة */
  /* الأرضية كلها لوحة Canvas واحدة تُرسم مرة واحدة: بلاط + أشعة + حلقات + منصة + خطوط ضوء + توهّج (أقل بكثير من عشرات الطبقات) */
  (function drawFloor() {
    const cv = document.getElementById("floorcv"), N = isMob() ? 1536 : 2048;   /* الهاتف 1536 (كان 1024 فتبدو الأرضية صورة مكبَّرة ضبابية بكثافة بكسل 3×) */ cv.width = cv.height = N; const g = cv.getContext("2d"), k = N / 2400, C = N / 2; g.clearRect(0, 0, N, N); g.save(); g.translate(C, C); g.scale(k, k);
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
  /* بطاقات الجدران: كل قسم مرة واحدة فقط (بلا تكرار)، موزَّعة بالتناوب على الجدران الأربعة */
  
  function sidewall(cls, ids) { const w = document.createElement("div"); w.className = "wall " + cls; ids.forEach(id => { const real = id.replace(/\d+$/, ""), sec = SEC.find(s => s.id === real), d = document.createElement("div"); d.className = "wcard"; d.dataset.id = real; d.dataset.card = id; d.innerHTML = '<div class="wh">' + svg(sec.icon) + "<b>" + sec.name + '</b></div><div class="wbw"><div class="wb"></div></div>'; d.addEventListener("click", () => { if (performance.now() - lastPanelDrag < 300) return; openSection(real); }); w.appendChild(d); }); room.appendChild(w); }
  /* جدار مقوّس واحد: كل بطاقة على أسطوانة نصف قطرها --wR حول مركز المشهد بزاوية منتظمة وتواجه المركز، في 3 صفوف؛ تُجمَّع في حاويات l/bl/br/r بحسب الزاوية */
  /* الوضع الحقيقي: لا بطاقات جدارية ولا لوحيّات أرضية — كانت تعرض أرقاماً تجريبية (D) مختلطة بالحقيقية ومكدّسة خلف الاسطوانة؛ البيانات الحقيقية في بطاقات الرئيسية (hparts) على الجانبين */
  const REALQ = /[?&]real=1/.test(location.search);
  if (!REALQ) { const ids = SEC.filter(s => !s.hidden || s.wall).map(s => s.id), ROWS = 4, COLS = Math.ceil(ids.length / ROWS), cls = c => (c < COLS * .25 ? "r" : c < COLS * .5 ? "br" : c < COLS * .75 ? "bl" : "l"), box = {}; room.classList.add("arc");
    ["l", "bl", "br", "r"].forEach(k => { const w = document.createElement("div"); w.className = "wall " + k; box[k] = w; room.appendChild(w); });
    ids.forEach((id, i) => { const c = Math.floor(i / ROWS), r = i % ROWS, sec = SEC.find(s => s.id === id), d = document.createElement("div"); d.className = "wcard"; d.dataset.id = id; d.dataset.card = id; d.style.setProperty("--ci", c); d.style.setProperty("--ri", r); d.style.setProperty("--cn", COLS);
      d.innerHTML = '<div class="wh">' + svg(sec.icon) + "<b>" + sec.name + '</b></div><div class="wbw"><div class="wb"></div></div>'; d.addEventListener("click", () => { if (performance.now() - lastPanelDrag < 300) return; openSection(id); }); box[cls(c)].appendChild(d); }); }
  const tabSpec = [["الإيراد", () => dz(revenue()) + " دج"], ["بانتظار التأكيد", () => pend()], ["التحويل", () => "2.9%"], ["الزيارات", () => "1 085"], ["مخزون منخفض", () => D.stock.filter(s => s.q < 10).length], ["متوسط الطلب", () => "2 750"], ["الطلبات", () => D.orders.length], ["مؤكَّدة", () => D.orders.filter(o => o.s === "ok").length], ["في الطريق", () => D.orders.filter(o => o.s === "ship").length], ["مسلَّمة", () => D.orders.filter(o => o.s === "done").length], ["الأصناف", () => D.stock.length]];
  if (!REALQ) [[-520, 330, -18], [-330, 380, 12], [450, 340, 20], [300, 400, -10], [-60, 430, 4], [600, 160, 40], [-640, 150, -35], [-720, 300, 22], [700, 300, -24], [130, 470, -8], [-190, 470, 10]].forEach(([x, z, r], i) => { const d = document.createElement("i"); d.className = "tab"; d.style.setProperty("--x", x + "px"); d.style.setProperty("--z", z + "px"); d.style.setProperty("--r", r + "deg"); d.dataset.k = i; room.appendChild(d); });
  function fillWalls() {
    room.querySelectorAll(".wcard").forEach(d => { const sec = SEC.find(s => s.id === d.dataset.id), st = sec.st ? JSON.parse(JSON.stringify(sec.st)) : {}; if (d.dataset.card === "ana2") D.__w = 1; d.querySelector(".wb").innerHTML = sec.html({ st, big: false }); });
    room.querySelectorAll(".tab").forEach(d => { const s = tabSpec[+d.dataset.k]; d.innerHTML = "<small>" + s[0] + "</small><b>" + s[1]() + "</b>"; });
  }
  fillWalls();
  const glyphs = document.createElement("div"); glyphs.className = "glyphs"; const gl = [];
  SEC.filter(s => !s.hidden).forEach((s, i) => { const g = document.createElement("div"); g.className = "glyph"; g.innerHTML = svg(s.icon); glyphs.appendChild(g); gl.push(g); }); room.appendChild(glyphs);
  /* ───── عقد الأقسام على المدار ───── */
  const secs = SEC.filter(s => !s.hidden), ring = RING.map(id => SEC.find(s => s.id === id)).filter(Boolean), nodes = new Map(); const CYL_R = 152, PHn = () => innerWidth <= 820; let RO = PHn() ? CYL_R : 310; addEventListener("resize", () => { RO = PHn() ? CYL_R : 310; bumpWorld(); }); /* الهاتف: المدارات لا تتعدى الاسطوانة (نصف قطرها 152) */
  secs.forEach((s, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "node"; b.dataset.id = s.id; b.setAttribute("aria-label", "فتح " + s.name); b.innerHTML = svg(s.icon) + "<span>" + s.name + "</span>";
    b.addEventListener("click", () => { if (performance.now() - lastPanelDrag < 300) return; if (TWO) selectTab(s.id); else openSection(s.id); }); b.addEventListener("focus", () => { if (!TWO) select(s.id); }); orbit.appendChild(b); nodes.set(s.id, b);
    const d = document.createElement("button"); d.type = "button"; d.dataset.id = s.id; d.innerHTML = svg(s.icon) + "<span>" + s.name + "</span>"; d.addEventListener("click", () => openSection(s.id)); dock.appendChild(d);
  });
  /* المداران (الوضع الحقيقي): العلوي تبويبات رئيسية لا تفتح شيئاً بل تبدّل بطاقات السفلي؛ السفلي بطاقات إعدادات التبويب المحدَّد وتفتح لوحها (الافتراضي: المتجر) */
  let TWO = false, curTab = "store"; const subs = new Map(); let RS = 236, subIds = [];
  /* المدار الثالث: إعدادات المرتبة الثالثة = أقسام (عناوين البطاقات) داخل لوح الإعداد المحدَّد، تُقرأ من لوحة التحكم الحقيقية نفسها (لا قائمة ثابتة) وتُخزَّن؛ النقر يفتح اللوح وينزل إلى القسم */
  const subs3 = new Map(), RT = 150; let sub3Ids = [], curSub = "", l3tm = 0;
  const L3SEL = "h2,h3,h4,.card > b:first-child";
  const L3K = () => "sc_l3_v1" + (window.SpatialI18n && SpatialI18n.lang === "fr" ? "_fr" : "");
  const l3get = () => { try { return JSON.parse(localStorage.getItem(L3K()) || "{}") || {}; } catch (_) { return {}; } }, l3put = (id, L) => { try { const c = l3get(); c[id] = L; localStorage.setItem(L3K(), JSON.stringify(c)); } catch (_) { } };
  function l3headings(d, tab) {
    const root = d.getElementById("tab-" + tab) || d.body, out = [];
    root.querySelectorAll(L3SEL).forEach(h => {
      if (h.closest(".hidden,[hidden]")) return; let t = ""; h.childNodes.forEach(n => { if (n.nodeType === 3) t += n.textContent; }); t = (t || h.textContent).replace(/\s+/g, " ").trim().replace(/^[^\p{L}\p{N}]+/u, "").replace(/\s*\(\d+\)\s*$/, "");
      if (t.length < 2 || t.length > 38 || out.some(x => x === t)) return; out.push(t);
    }); return out.slice(0, 12);
  }
  function buildSubs3(id, list) { bumpWorld();
    [...subs3.values()].forEach(b => { b.classList.add("out"); setTimeout(() => b.remove(), 260); }); subs3.clear(); sub3Ids = []; if (!TWO || !list || !list.length) return;
    const sc = SEC.find(x => x.id === id); sub3Ids = list.map((t, i) => "i" + i);
    list.forEach((t, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "node sub sub3 in"; b.dataset.id = id; b.dataset.i = String(i); b.setAttribute("aria-label", t); b.innerHTML = "<span>" + t.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])) + "</span>"; b.addEventListener("click", () => { if (performance.now() - lastPanelDrag < 300) return; gotoItem(id, t); }); orbit.appendChild(b); subs3.set("i" + i, b); setTimeout(() => b.classList.remove("in"), 30); });
  }
  function showSub3(id) {
    curSub = id; clearTimeout(l3tm); const c = l3get()[id]; buildSubs3(id, c || []);
    let n = 0; const tryRead = () => { if (curSub !== id) return; const p = open.get(id), tab = FRAME[id] && FRAME[id].tab; if (p && p.fr && p.frDone && tab) { try { const L = l3headings(p.fr.contentDocument, tab); if (L.length && JSON.stringify(L) !== JSON.stringify(c || [])) { l3put(id, L); buildSubs3(id, L); } } catch (_) { } if (n++ < 8) l3tm = setTimeout(tryRead, 1500); return; } if (n++ < 60) l3tm = setTimeout(tryRead, 300); }; l3tm = setTimeout(tryRead, 200);
  }
  /* فتح اللوح (إن لم يكن مفتوحاً) ثم النزول إلى القسم الثالث داخله وإبرازه */
  function gotoItem(id, label) {
    openSection(id); let n = 0; const go = () => { const p = open.get(id), tab = FRAME[id] && FRAME[id].tab; if (!p || !p.fr || !p.frDone) { if (n++ < 80) setTimeout(go, 250); return; }
      try { const d = p.fr.contentDocument, root = d.getElementById("tab-" + tab) || d.body; const h = [...root.querySelectorAll(L3SEL)].find(x => { let t = ""; x.childNodes.forEach(k => { if (k.nodeType === 3) t += k.textContent; }); t = (t || x.textContent).replace(/\s+/g, " ").trim().replace(/^[^\p{L}\p{N}]+/u, ""); return t === label; });
        if (h) { const c = h.closest(".card") || h; c.scrollIntoView({ block: "start", behavior: "smooth" }); const o = c.style.outline, tr = c.style.transition; c.style.transition = "outline-color .3s"; c.style.outline = "2px solid #e2fe17"; setTimeout(() => { c.style.outline = o; c.style.transition = tr; }, 1600); } } catch (_) { } };
    setTimeout(go, 150);
  }
  function buildSubs(tab) { bumpWorld();
    const ent = (typeof GROUPS !== "undefined" && GROUPS[tab] || [tab]).map(e => String(e).split("|")), lab = {}; ent.forEach(e => { if (e[1]) lab[e[0]] = e[1]; }); const ids = ent.map(e => e[0]).filter(id => SEC.some(s => s.id === id)); RS = PHn() ? 178 : ids.length > 14 ? Math.min(340, 236 + (ids.length - 14) * 6) : 236; orbit.classList.toggle("dense", ids.length > 14); const old = [...subs.values()]; old.forEach(b => { b.classList.add("out"); setTimeout(() => b.remove(), 260); }); subs.clear(); subIds = ids;
    ids.forEach(id => { const sc = SEC.find(s => s.id === id), b = document.createElement("button"); b.type = "button"; b.className = "node sub in"; b.dataset.id = id; b.setAttribute("aria-label", "فتح " + (lab[id] || sc.name)); b.innerHTML = svg(sc.icon) + "<span>" + (lab[id] || sc.name) + "</span>"; b.addEventListener("click", ev => { if (performance.now() - lastPanelDrag < 300) return; if (!(ev && (ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey)) && navInPlace(id)) { setTimeout(() => showSub3(id), 60); return; } openSection(id); showSub3(id); }); orbit.appendChild(b); subs.set(id, b); setTimeout(() => b.classList.remove("in"), 30); });
    markNodes();
  }
  function selectTab(id) { if (!TWO || !ring.some(s => s.id === id)) return; curTab = id; nodes.forEach((n, k) => { n.classList.toggle("tab", k === id); n.setAttribute("aria-current", k === id ? "true" : "false"); }); { const a = document.getElementById("active"), sc = SEC.find(s => s.id === id); if (a && sc) { a.textContent = "بطاقات: " + sc.name; a.classList.add("on"); } } buildSubs(id); curSub = ""; buildSubs3("", []); spinTo(id); }
  function enableTwo() { if (TWO) return; bumpWorld(); TWO = true; document.body.classList.add("two"); [...nodes.keys()].forEach(id => { if (!RING.includes(id)) { nodes.get(id).remove(); nodes.delete(id); } }); selectTab(curTab); }
  let spinK = 1, spinT = 1, ang = 20, va = 0, drag = null, lastInput = 0, tw = null, yaw = 0;
  /* تدوير القاعة كلها حول الاسطوانة (الكاميرا المدارية): Shift+سحب أو التواء بإصبعين على الخلفية أو المفتاحان [ ] */
  function setYaw(v) { yaw = clamp(v, -50, 50); stage.style.setProperty("--yaw", yaw.toFixed(1) + "deg"); const c = document.getElementById("yawchip"); if (c) { c.classList.toggle("on", Math.abs(yaw) > 1); c.textContent = "القاعة ↻ " + Math.round(yaw) + "° — انقر للتصفير"; } }
  /* مدار الألواح: كل لوح لم يمسكه المستخدم يدور حول الاسطوانة (pa = زاوية المدار، pt = انتقال لتقديم لوح جديد، hov = ألواح تحت المؤشر فيتوقف الدوران) */
  let orbitMode = innerWidth > 820, pa = 0, pt = null, hov = 0, pprev = 20, draggingPanel = false;
  /* مرحلة 5: ثلاثة أوضاع منفصلة — العالم (لا لوح محدّد)، الكائن (لوح صغير محدّد)، التركيز (اللوح المحدّد موسَّع) */
  let objSel = null, tool = "move";
  /* ───── مرحلة 8: لوحة التحكم الحقيقية داخل الألواح ─────
     عند التشغيل من متجر حقيقي (نسخة PHP محلية فيها admin.html وapi) تصير ألواح الطلبات/المنتجات/التحليلات/المخزون/المساعد إطاراً (iframe) يحمّل admin.html الحقيقي نفسه
     (نفس الأصل: لا تعديل على ملف إنتاج) فتعمل منطق الأعمال والصلاحيات وواجهة الـAPI كما هي. وإلا (خادم ملفات عادي) تبقى بيانات العرض التجريبية. */
  let REAL = false, APIREAL = false;
  /* زاوية 0: يلغي ميلان كل الألواح (X/Y/Z) بحركة سلسة لتواجه الشاشة؛ عرض فقط (الزوايا المخزّنة تبقى فتعود عند الإيقاف)، ويُحفظ اختيار المستخدم */
  let FLAT = false, flatK = 0; try { FLAT = localStorage.getItem("sc_flat") === "1"; flatK = FLAT ? 1 : 0; } catch (_) { }
  const FRAME = { ord: { tab: "orders", w: 660, h: 580 }, prod: { tab: "products", w: 660, h: 560 }, ana: { tab: "analytics", w: 640, h: 540 }, inv: { tab: "inventory", w: 640, h: 540 }, help: { tab: "ask", w: 480, h: 560 },
    /* المظهر الهولوغرافي: بقية أقسام الأسطوانة أيضاً لوحات حقيقية؛ nav = يبقى تنقّل اللوحة ظاهراً داخل الإطار فيصل المستخدم إلى كل الأقسام والإعدادات */
    dash: { tab: "home", w: 680, h: 580, nav: 1 }, store: { tab: "store", w: 680, h: 580, nav: 1 }, cus: { tab: "customers", w: 660, h: 560, nav: 1 }, look: { tab: "theme", w: 680, h: 580, nav: 1 }, ext: { tab: "appstore", w: 660, h: 560, nav: 1 }, set: { tab: "setup", w: 680, h: 580, nav: 1 },
    /* أقسام بطاقات الجدران: لوح حقيقي بلا تنقّل داخلي */
    returns: { tab: "returns", w: 640, h: 540 }, ...Object.fromEntries(NAVX.map(([id]) => [id, { tab: id, w: 660, h: 560 }])), profit: { tab: "profit", w: 640, h: 540 }, wallet: { tab: "wallet", w: 640, h: 540 }, delivery: { tab: "delivery", w: 640, h: 540 }, pack: { tab: "pack", w: 640, h: 540 }, shipped: { tab: "shipped", w: 660, h: 560 }, callcenter: { tab: "callcenter", w: 600, h: 540 }, categories: { tab: "categories", w: 640, h: 540 }, builder: { tab: "builder", w: 680, h: 560 }, seo: { tab: "seo", w: 640, h: 540 }, payments: { tab: "payments", w: 640, h: 540 }, blog: { tab: "blog", w: 640, h: 540 }, bulkp: { tab: "bulkp", w: 660, h: 540 }, audit: { tab: "audit", w: 640, h: 540 }, attributes: { tab: "attributes", w: 640, h: 540 }, dispatch: { tab: "dispatch", w: 680, h: 560 }, costs: { tab: "costs", w: 640, h: 540 }, finance: { tab: "finance", w: 660, h: 540 }, team: { tab: "team", w: 640, h: 540 } };
  /* قائمة لوحة التحكم الحقيقية ← المدار الثاني: تُقرأ من اللوحة الجاهزة نفسها (فيتبع المدار النسخة والصلاحيات واللغة وما يُضاف من تبويبات)، وتُخزَّن للفتح التالي؛ والقائمة الثابتة في GROUPS احتياط أول مرة */
  const NAVK = () => "sc_nav_v1" + (window.SpatialI18n && SpatialI18n.lang === "fr" ? "_fr" : ""), TOPOF = { products: "prod", shop: "store", look: "look", apps: "ext", gen: "set" }; let navSig = "";
  function navEnsure(id, name, top) { if (!SEC.some(s => s.id === id)) SEC.push({ id, name, icon: IC[top] || IC.set, w: 400, h: 300, hidden: true, html: () => "" }); if (!FRAME[id]) FRAME[id] = { tab: id, w: 660, h: 560 }; }
  function navRead(d) {
    const bt = [...d.querySelectorAll(".side-nav .nav-btn")]; if (bt.length < 12) return null; const out = { dash: [], prod: [], store: [], look: [], ext: [], set: [] }, t2id = {}; for (const k in FRAME) if (!t2id[FRAME[k].tab]) t2id[FRAME[k].tab] = k;
    bt.forEach(b => { const c = b.classList; if (c.contains("ed-x") || c.contains("rl-hid") || c.contains("nav-hid")) return; const tab = ((/Admin\.tab\('([a-z0-9_-]+)'/.exec(b.getAttribute("onclick") || "")) || [])[1], bb = b.querySelector("b"); if (!tab || !bb) return;
      const cl = bb.cloneNode(true); cl.querySelectorAll(".nb").forEach(x => x.remove()); const name = cl.textContent.replace(/\s+/g, " ").trim(); let top = tab === "home" ? "dash" : TOPOF[b.dataset.grp]; if (!name || !top) return;
      let id = t2id[tab]; if (!id) { id = tab; navEnsure(id, name, top); t2id[tab] = id; } out[top].push(id + "|" + name); });
    return out;
  }
  function navApply(o) { let ch = false; for (const k in o) if (o[k] && o[k].length && JSON.stringify(GROUPS[k]) !== JSON.stringify(o[k])) { o[k].forEach(e => { const [id, nm] = e.split("|"); navEnsure(id, nm, k); }); GROUPS[k] = o[k]; if (k === curTab) ch = true; } if (ch && TWO) buildSubs(curTab); }
  function navDoc() { try { if (SP.f && SP.ready && SP.f.contentDocument) return SP.f.contentDocument; for (const p of open.values()) if (p.fr && p.fr.contentDocument && p.fr.contentDocument.querySelector(".side-nav")) return p.fr.contentDocument; } catch (_) { } return null; }
  function navSync(d) { try { d = d || navDoc(); const o = d && navRead(d); if (!o) return; const sig = JSON.stringify(o); if (sig === navSig) return; navSig = sig; navApply(o); try { localStorage.setItem(NAVK(), sig); } catch (_) { } } catch (_) { } }
  try { const c = JSON.parse(localStorage.getItem(NAVK()) || "null"); if (c && typeof c === "object") navApply(c); } catch (_) { }
  document.addEventListener("alyssum:lang", () => { navSig = ""; try { const c = JSON.parse(localStorage.getItem(NAVK()) || "null"); if (c) navApply(c); } catch (_) { } setTimeout(() => navSync(), 1100); });
  /* تدوير الاسطوانة لتقديم عقدة قسم إلى مقدمة المشهد (أقصر دوران) */
  function spinTo(id) { const RG = TWO ? ring : secs, i = RG.findIndex(s => s.id === id); if (i < 0) return; const step = 360 / RG.length; let t = -i * step - yaw; t += Math.round((ang - t) / 360) * 360; tw = { to: t }; va = 0; lastInput = performance.now() + 4000; /* يبقى مُحاذياً ~6 ثوانٍ قبل أن يستأنف الدوران الهادئ */ }
  function frame(t) {
    const rdt = Math.min(250, t - (frame.t || t)), dt = Math.min(50, rdt); frame.t = t; const ek = 1 - Math.exp(-rdt / 150); spinK += (spinT - spinK) * (1 - Math.exp(-rdt / 400)); /* سرعة الدوران التلقائي (يبطئها الوكيل أثناء الصوت) */ /* تسهيل مبني على الزمن الحقيقي (مستقل عن معدل الإطارات) */
    if (tw) { ang += (tw.to - ang) * ek; if (Math.abs(tw.to - ang) < .15) { ang = tw.to; tw = null; } } else if (!drag) { const f = rdt / 16.7; ang += va * f; va *= Math.pow(.94, f); if (!RM && !objSel && open.size === 0 && Math.abs(va) < .02 && t - lastInput > 2500 && t - lastInput < 25000) { ang += rdt * .004 * spinK; wAlive = t; } }  /* دوران هادئ حتى 25ث من آخر تفاعل ثم يثبت العالم (صفر كلفة وبطارية) */  /* دوران هادئ فقط حين لا نافذة مفتوحة: العالم ثابت أثناء العمل */
    const dA = ang - pprev; pprev = ang;
    { const ft = FLAT ? 1 : 0; if (flatK !== ft) { flatK += (ft - flatK) * Math.min(1, ek * 1.6); if (Math.abs(ft - flatK) < .004) flatK = ft; open.forEach(p => apply(p)); } }
    if (orbitMode) { if (pt) { pa += (pt.to - pa) * ek; if (Math.abs(pt.to - pa) < .15) { pa = pt.to; pt = null; } } else if (!layer.querySelector(".panel:hover") && !draggingPanel) pa += dA + (RM || objSel ? 0 : rdt * .006 * spinK); orbitFrame(t, ek); }
    if (((frame.n = (frame.n || 0) + 1) & 1) === 0) open.forEach(p => { if (p.origin && !p.min && t - p.born < 900) { const r = p.el.getBoundingClientRect(); FX.stream(p.origin.x, p.origin.y, r.left + r.width / 2, r.top + r.height / 2, 3); } });
    const a = ang % 360;
    /* العالم يُعاد رسمه فقط حين يتغيّر شيء (دوران/سحب/قصور/تبديل مدار/تغيير حجم/ميل)؛ ثابتاً لا كتابات DOM ولا إعادة تركيب */
    const wsig = a.toFixed(2) + "|" + yaw + "|" + worldVer + "|" + (flatK | 0), moving = !!tw || !!drag || Math.abs(va) >= .02 || t - wAlive < 120 || !!pt || (orbitMode && [...open.values()].some(q => !q.user && !q.min));
    const spinOnly = !tw && !drag && Math.abs(va) < .02 && !pt && t - wAlive < 120 && !(orbitMode && [...open.values()].some(q => !q.user && !q.min)); if (spinOnly && t - wLastT < 32) { requestAnimationFrame(frame); return; }   /* الدوران الهادئ وحده بـ30 إطاراً/ث */
    if (wsig === wLast && !moving) { if (typeof FX !== "undefined" && FX.ambient) FX.ambient(open.size === 0); requestAnimationFrame(frame); return; } wLast = wsig; wLastT = t;
    if (typeof FX !== "undefined" && FX.ambient) FX.ambient(open.size === 0);
    cyl.style.transform = `rotateY(${a}deg)`; 
    gl.forEach((g, i) => { const th = (-a * 1.3 + i * 360 / gl.length) * Math.PI / 180, y = -110 + (i % 4) * 62 + Math.sin(t / 900 + i) * 6; g.style.transform = `translate3d(${(Math.sin(th) * 92).toFixed(1)}px,${y.toFixed(1)}px,${(Math.cos(th) * 92).toFixed(1)}px)`; });
    const RG = TWO ? ring : secs; RG.forEach((s, i) => {
      const th = (a + i * 360 / RG.length) * Math.PI / 180, x = Math.sin(th) * RO, z = Math.cos(th) * RO, y = TWO ? -112 : Math.sin(i * 1.9) * 72, n = nodes.get(s.id), f = (z + RO) / (2 * RO);
      n.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px)`; { const zy = Math.cos(th + yaw * Math.PI / 180) * RO, fy = (zy + RO) / (2 * RO); n.style.opacity = (.42 + .58 * fy).toFixed(2); n.style.zIndex = Math.round(zy + RO); }
    });
    if (TWO) { const ph = PHn(), nS = subIds.length, per = nS,   /* الهاتف: مدار واحد حول القاعدة بأيقونات صغيرة (لا صفوف متراكبة) */ rows = Math.ceil(nS / per); subIds.forEach((id, j) => { const n = subs.get(id); if (!n) return; const row = Math.floor(j / per), inRow = j % per, cnt = row === rows - 1 ? nS - row * per : per, th = (-a * .55 + (inRow + (row % 2) * .5) * 360 / Math.max(cnt, 1)) * Math.PI / 180, x = Math.sin(th) * RS, z = Math.cos(th) * RS, zy = Math.cos(th + yaw * Math.PI / 180) * RS, fy = (zy + RS) / (2 * RS), y = rows > 1 ? -52 + row * 56 : 102; n.style.transform = `translate3d(${x.toFixed(1)}px,${y}px,${z.toFixed(1)}px)`; n.style.opacity = (.5 + .5 * fy).toFixed(2); n.style.zIndex = Math.round(zy + RS); }); }
    if (TWO) sub3Ids.forEach((k, j) => { const n = subs3.get(k); if (!n) return; const th = (a * .4 + j * 360 / sub3Ids.length) * Math.PI / 180, x = Math.sin(th) * RT, z = Math.cos(th) * RT, zy = Math.cos(th + yaw * Math.PI / 180) * RT, fy = (zy + RT) / (2 * RT); n.style.transform = `translate3d(${x.toFixed(1)}px,292px,${z.toFixed(1)}px)`; n.style.opacity = (.55 + .45 * fy).toFixed(2); n.style.zIndex = Math.round(zy + RT); });
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
  function select(id, rotate) { sel = id; { const a = document.getElementById("active"), sc = SEC.find(s => s.id === id); if (a && sc) { a.textContent = sc.name; a.classList.add("on"); } } if (!TWO) nodes.forEach((n, k) => { n.classList.toggle("sel", k === id); n.setAttribute("aria-current", k === id ? "true" : "false"); }); subs.forEach((n, k) => n.classList.toggle("sel", k === id)); dock.querySelectorAll("button").forEach(b => b.classList.toggle("sel", b.dataset.id === id)); if (rotate !== false && nodes.has(id) && !TWO) spinTo(id); }
  const step = d => { const RG = TWO ? ring : secs, i = RG.findIndex(s => s.id === sel), j = i < 0 ? 0 : (i + d + RG.length) % RG.length; select(RG[j].id); };
  document.addEventListener("keydown", e => { const k = String(e.key || ""), tg = e.target || {}, inPanel = tg.closest && tg.closest(".panel");
    if (/INPUT|TEXTAREA/.test(tg.tagName || "")) { if (k === "Escape") tg.blur(); return; }
    if (!e.ctrlKey && !e.metaKey && !e.altKey) { const kl = k.toLowerCase(); if (kl === "w") { clearSel(); return; } if (kl === "o") { toObject(); return; } if (kl === "c") { toCylinder(); return; } if (kl === "a") { tileAll(); return; } if (kl === "l") { setFlat(!FLAT); return; } if (kl === "f") { toFocus(); return; } if (objSel && modeOf() === "object" && TOOLS[kl]) { setTool(TOOLS[kl]); return; } }
    if (k === "Escape" && (focused || objSel)) { const bp = objSel && open.get(objSel), fp = bp && bp.big ? bp : open.get(focused); if (fp && fp.big) toggleBig(fp); else if (fp) dismiss(fp.id, "close"); return; } if (inPanel) return;
    if (k === "[") setYaw(yaw - 10); else if (k === "]") setYaw(yaw + 10); else if (k === "0") setYaw(0); else if (k === "ArrowRight") { e.preventDefault(); step(1); } else if (k === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if ((k === "Enter" || k === " ") && sel && !/BUTTON/.test(tg.tagName || "")) { e.preventDefault(); openSection(sel); } });

  /* ───── مدير الألواح ───── */
  const open = new Map(), memo = {}; let zc = 10, focused = null;
  /* حفظ حالة اللوح عند الإغلاق/الرمي ليعود بمحتواه (فلتر الطلبات، محادثة المساعد…) وحجمه */
  function remember(p, pose) { if (p.frame) snapFrame(p); const q = pose || p.st; memo[p.id] = { pos: p.frame ? { x: q.x, y: q.y, z: q.z, rx: q.rx, ry: q.ry, rz: q.rz || 0, s: q.s } : null, content: JSON.parse(JSON.stringify(p.content || {})), size: { w: p.big && p.prev ? p.prev.w : p.st.w, h: p.big && p.prev ? p.prev.h : p.st.h } }; }
  const fz = p => 1 - 0; /* موضع للتوسّع المستقبلي */
  function persp(tz) { return PERSP / (PERSP - tz); }
  function apply(p) { if (p.frame && p.frDone && p._zw !== p.st.w) frameZoom(p); const s = p.st, tz = s.z + (p.id === focused ? 40 : 0) + (p.lift || 0), hx = (p.bk ? p.bk.x : 0) + (p.hold ? p.hold.x : 0), hy = (p.bk ? p.bk.y : 0) + (p.hold ? p.hold.y : 0); p.el.style.transform = (isMob() && p.frame) ? `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px) rotate(${((s.rz || 0) * (1 - flatK)).toFixed(1)}deg) scale(${s.s.toFixed(3)})` /* هاتف: لوح إطار حقيقي بتحويل ثنائي الأبعاد فقط — iOS لا يمرّر سحب اللمس داخل iframe تحت translateZ/rotateX */ : `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,${tz}px) rotateX(${((s.rx + hx) * (1 - flatK)).toFixed(1)}deg) rotateY(${((s.ry + hy) * (1 - flatK)).toFixed(1)}deg) rotateZ(${((s.rz || 0) * (1 - flatK)).toFixed(1)}deg) scale(${s.s.toFixed(3)})`; p.el.style.setProperty("--gx", ((s.ry + hy) * (1 - flatK) * 1.5).toFixed(1) + "%"); p.el.style.setProperty("--zp", clamp((s.z - ZMIN) / (ZMAX - ZMIN), 0, 1).toFixed(3)); p.el.style.setProperty("--w", s.w + "px"); p.el.style.setProperty("--h", s.h + "px"); }
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
  function setLayer(p, back) { if (p.frame) return; if (!!p.inBack === back) return; p.inBack = back; p.el.classList.toggle("back", back); (back ? layerBack : layer).appendChild(p.el); }
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
    if (!orbitMode || !p.user || p.big || p.frame) return false; const nx = p.st.x / (W() * .335), nz = p.st.z / 340, th = Math.atan2(nx, nz) * 180 / Math.PI, ideal = orbState(th, 0).st;
    if (!force && Math.hypot(p.st.x - ideal.x, p.st.y - ideal.y) > 70) return false;
    p.user = false; p.off = wrap(th - pa - yaw); p.el.classList.remove("free"); p.el.classList.add("tr2"); setTimeout(() => p.el.classList.remove("tr2"), 700); return true;
  }
  function userize(p) { if (p.user) return; p.el.classList.add("free"); p.user = true; setLayer(p, false); p.el.style.setProperty("--op", 1); p.el.classList.remove("back"); }
  /* يعيد ترتيب الألواح التي لم يحرّكها المستخدم؛ الجديد يأخذ مكانه فوراً والباقي ينزلق بسلاسة */
  function arrange(fresh) {
    if (orbitMode) { const list = orbList(); if (fresh && !fresh.user) { const i = list.indexOf(fresh), step = 360 / list.length; fresh.off = i * step; let to = -i * step; to += Math.round((pa - to) / 360) * 360; pt = { to }; Object.assign(fresh.st, orbState(0, i).st); } return; }
    const list = [...open.values()].filter(p => !p.min && !p.user && !p.big), L = layoutFor(list.length);
    list.forEach((p, i) => { const c = L[i]; if (p === fresh) { Object.assign(p.st, { x: c.x, y: c.y, z: c.z, rx: c.rx, ry: c.ry, s: c.s }); return; } p.el.classList.remove("tr"); p.el.classList.add("tr2"); Object.assign(p.st, { x: c.x, y: c.y, z: c.z, rx: c.rx, ry: c.ry, s: c.s }); apply(p); setTimeout(() => p.el.classList.remove("tr2"), 450); });
  }
  const rectOf = p => ({ x: p.st.x, y: p.st.y, w: p.st.w * p.st.s, h: p.st.h * p.st.s });
  function overlap(a, b) { const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x), oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y); return ox > 0 && oy > 0 ? { ox, oy, a: ox * oy } : null; }
  function sizeFor(sec) { const mw = W(), mh = H(), r = PHR(); if (r && sec.w) return { w: r.w, h: r.h }; return isMob() ? { w: Math.min(sec.w, mw - 24), h: Math.min(sec.h, Math.round(mh * .42)) } : { w: Math.min(sec.w, mw - 60), h: Math.min(sec.h, mh - 120) }; }
  function nodePos(id) { let n = id === "ai" ? core : (TWO && subs.get(id)) || nodes.get(id); if (!n && TWO) { const g = Object.keys(GROUPS).find(k => GROUPS[k].some(e => e.split("|")[0] === id)); n = (g && nodes.get(g)) || core; } if (!n) return { x: 0, y: 0 }; const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2 - W() / 2, y: r.top + r.height / 2 - H() / 2 }; }
  function render(p, keep) { if (p.frame) return; const b = p.body, top = b.scrollTop; b.innerHTML = p.sec.html(p); if (keep !== false) b.scrollTop = top; }
  const refreshAll = () => { open.forEach(p => { if (!p.min) render(p); }); fillWalls(); };
  function markNodes() { document.body.classList.toggle("many", open.size > 3); nodes.forEach((n, id) => { const p = TWO ? null : open.get(id); n.classList.toggle("open", !!p && !p.min); n.classList.toggle("min", !!p && p.min); }); subs.forEach((n, id) => { const p = open.get(id); n.classList.toggle("open", !!p && !p.min); n.classList.toggle("min", !!p && p.min); }); dock.querySelectorAll("button").forEach(b => { const p = open.get(b.dataset.id); b.classList.toggle("open", !!p && !p.min); }); }
  function pulse(id) { const n = (TWO && subs.get(id)) || nodes.get(id); if (n) { n.classList.remove("hot"); void n.offsetWidth; n.classList.add("hot"); } core.classList.remove("pulse"); void core.offsetWidth; core.classList.add("pulse"); }

  /* فتح آني كالمنصة التقليدية: النقر على عنصر في المدار الثاني ينقل اللوح الحقيقي المفتوح (إطار محمَّل أصلاً) إلى تبويب العنصر بـAdmin.tab بلا تحميل إطار جديد؛ يُفتح لوح جديد فقط إن لم يوجد لوح جاهز أو بـShift/Ctrl/Alt. يُعاد تسجيل اللوح باسم القسم الجديد (open/Hub/العنوان) فتبقى كل الأنظمة متسقة */
  function navInPlace(id) {
    if (!REAL || !TWO) return false; const sec = SEC.find(s => s.id === id), fr = FRAME[id]; if (!sec || !fr || open.has(id)) return false;
    const cand = [...open.values()].filter(x => x.fr && x.frame && x.fr.isConnected && !x.discarded && !x.blank && !x.min), p = cand.find(x => x.id === focused) || cand[cand.length - 1]; if (!p) return false;
    try { const w = p.fr.contentWindow, A = w.eval('typeof Admin !== "undefined" ? Admin : null'); if (!A || typeof A.tab !== "function") return false; A.tab(fr.tab); } catch (_) { return false; }
    const old = p.id, content = p.content; try { remember(p); } catch (_) { }
    const hubRenamed = !!(window.SpatialHub && SpatialHub.rename && SpatialHub.rename(old, id)); if (!hubRenamed && window.SpatialHub) SpatialHub.detach(old); open.delete(old); const wasNav = !!(p.frame && p.frame.nav); p.id = id; p.frame = fr; p.sec = Object.assign({}, sec, { html: q => sec.html({ st: content, big: p.big }) }); open.set(id, p); if (focused === old) focused = id;
    p.el.setAttribute("aria-label", sec.name); const h3 = p.el.querySelector("h3"); if (h3) h3.textContent = sec.name; p.fr.title = sec.name;
    if (wasNav !== !!fr.nav) { try { const d = p.fr.contentDocument, st = d && d.getElementById("__spEmbed"); if (st) st.textContent = (fr.nav ? EMBED_NAV_CSS : EMBED_CSS) + HOLO_SKIN; } catch (_) { } }   /* إعادة كتابة الأنماط تُعيد حساب أنماط الصفحة كلها: فقط إن تغيّر نمط التنقل */
    if (!hubRenamed && window.SpatialHub) { try { SpatialHub.attach(id, p.fr.contentWindow, p.el); } catch (_) { } }
    /* الانتقال (A.tab + إعادة التسجيل) متزامن ويُرسَم أولاً؛ تمييز العقدة/التركيز/التحديث بعد الإطار (pulse كانت تُجبر تخطيطاً متزامناً للعالم كله) */
    requestAnimationFrame(() => { select(id); focus(id); markNodes(); }); return true;
  }
  function openSection(id) {
    const sec = SEC.find(s => s.id === id); if (!sec) return;
    const ex = open.get(id), from = nodePos(id); select(id);
    if (ex) { if (ex.min) { ex.min = false; resumePanel(ex); if (window.SpatialHub) SpatialHub.setVisible(id, true); ex.el.style.display = ""; setTimeout(() => { ex.body.scrollTop = ex.scroll || 0; }, 30); ex.el.classList.add("tr"); if (ex.user && ex.keep) Object.assign(ex.st, ex.keep); /* مواضع الألواح الحرة تُستعاد كما كانت قبل التصغير */ arrange(ex); ex.keep = Object.assign({}, ex.st); setPos(ex, ex.keep, from); setTimeout(() => ex.el.classList.remove("tr"), 900); } faceFront(ex); focus(id); pulse(id); FX.burst(from.x + W() / 2, from.y + H() / 2, "220,255,31", 26, 3.5); markNodes(); return; }
    const fr = REAL ? FRAME[id] : null, sz = fr ? sizeFor(Object.assign({}, sec, { w: clamp(W() * .44, 460, fr.w), h: fr.h })) : sizeFor(sec); if (memo[id] && memo[id].size) { sz.w = Math.min(memo[id].size.w, W() - 24); sz.h = Math.min(memo[id].size.h, H() - 80); }
    const sl = { x: 0, y: 0, z: 0, rx: 0, ry: 0 }, el = document.createElement("section"); el.className = "panel"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", sec.name); el.tabIndex = -1;
    el.innerHTML = '<i class="face"></i><i class="vol v2"></i><i class="vol v1"></i><i class="slab s3"></i><i class="slab s2"></i><i class="slab s1"></i><i class="pn-ac"></i><i class="eg t"></i><i class="eg b"></i><i class="eg l"></i><i class="eg r"></i><header class="pn-h"><button type="button" class="pn-rot" aria-label="تدوير اللوح (اسحب)" title="اسحب لتدوير اللوح">&#10227;</button><button type="button" class="pn-dep" aria-label="تحريك في العمق (اسحب عمودياً)" title="اسحب عمودياً: أقرب/أبعد">&#8661;</button><h3></h3><button type="button" class="pn-min" aria-label="تصغير" title="تصغير">&#8211;</button><button type="button" class="pn-max" aria-label="تكبير/استعادة" title="تكبير">&#9633;</button><button type="button" class="pn-x" aria-label="إغلاق" title="إغلاق">&#10005;</button></header><div class="pn-b"></div><div class="gbadge" aria-hidden="true"></div><i class="pn-z" aria-hidden="true"><b></b></i><i class="pn-br" aria-hidden="true"></i><i class="pn-rs" aria-hidden="true"></i>';
    el.querySelector("h3").textContent = sec.name;
    const content = memo[id] ? JSON.parse(JSON.stringify(memo[id].content || (sec.st || {}))) : sec.st ? JSON.parse(JSON.stringify(sec.st)) : {}, p = { id, frame: fr || null, content, sec: Object.assign({}, sec, { html: q => sec.html({ st: content, big: p.big }) }), el, body: el.querySelector(".pn-b"), min: false, big: false, keep: null, st: { x: sl.x, y: sl.y, z: sl.z, rx: sl.rx, ry: sl.ry, s: 1, w: sz.w, h: sz.h } };
    setState(p, "opening"); p.born = performance.now(); p.origin = { x: from.x + W() / 2, y: from.y + H() / 2 }; if (REAL) el.dataset.real = (fr || id === "ai") ? "1" : "0"; /* لوح المساعد في الوضع الحقيقي هو الوكيل الحقيقي (أو إشعار صادق) لا «عرض تجريبي» */ layer.appendChild(el); open.set(id, p); wire(p);
    if (fr || PHR()) { p.user = true; el.classList.add("free"); placeFrame(p); } /* هاتف: كل لوح (ومنه مساعد ALYSSUM) ورقة كاملة بين الشريطين */ else if (memo[id] && memo[id].pos) { p.user = true; el.classList.add("free"); Object.assign(p.st, memo[id].pos); } /* المواضع تُحفظ طوال الجلسة */
    if (PHR() && fr) [...open.values()].forEach(q => { if (q !== p && q.frame && !q.min) setTimeout(() => dismiss(q.id, "min"), 0); });   /* هاتف: ورقة مرئية واحدة (الذاكرة والوضوح) */
    arrange(p); if (sec.bind && !fr) sec.bind(p.body, { st: content }, all => all ? refreshAll() : render(p)); render(p, false); if (fr) mountFrame(p);
    p.keep = Object.assign({}, p.st);
    Object.assign(p.st, { x: from.x * .35, y: from.y * .35, z: -380, s: .1, rx: 0, ry: 0 }); apply(p); el.style.setProperty("--op", 0); el.classList.add("tr"); void el.offsetWidth;
    Object.assign(p.st, p.keep); focus(id); apply(p); el.style.setProperty("--op", 1); if (RM) { el.classList.remove("tr"); }
    setTimeout(() => { el.classList.remove("tr"); if (p.state === "opening") setState(p, focused === id ? "focused" : "floating"); }, 950); pulse(id); FX.burst(from.x + W() / 2, from.y + H() / 2, "43,228,255", 40, 4.5); markNodes(); setTimeout(() => { try { el.focus({ preventScroll: true }); } catch (e) { } }, 60);
  }
  function setPos(p, s, from) { if (from) { Object.assign(p.st, { x: from.x * .35, y: from.y * .35, z: -380, s: .1 }); apply(p); p.el.style.setProperty("--op", 0); void p.el.offsetWidth; } Object.assign(p.st, s); apply(p); p.el.style.setProperty("--op", 1); }
  function focus(id) { lqFocus(id); if (focused !== id && window.SpatialHub) setTimeout(() => SpatialHub.activate(id), 0); focused = id; open.forEach(p => { p.el.classList.toggle("focus", p.id === id); if (!p.min && p.state !== "opening" && p.state !== "expanded" && p.state !== "dismissing") setState(p, p.id === id ? "focused" : "floating"); if (p.id === id) { p.el.style.zIndex = ++zc; } apply(p); }); }
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
      p.bk = { y: clamp(vx * 5, -9, 9), x: clamp(-vy * 4, -7, 7) }; const mx = W() / 2 - p.st.w * p.st.s / 3, my = H() / 2 - p.st.h * p.st.s / 3; if (Math.abs(p.st.x) > mx) { p.st.x = clamp(p.st.x, -mx, mx); vx *= -.35; } { const yt = yTop(p.st.h * p.st.s); if (p.st.y > my || p.st.y < yt) { p.st.y = clamp(p.st.y, yt, my); vy *= -.35; } } apply(p);
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
  /* رسالة قصيرة في شريط الوضع (3 ثوانٍ) حين لا يجد الزر ما يعمل عليه، بدل أن يبدو معطّلاً */
  function hint(msg) { setRead(msg); clearTimeout(hint.t); hint.t = setTimeout(() => setRead(), 3200); }
  function setRead(txt) {
    const r = document.getElementById("mread"); if (!r) return; const m = modeOf(), p = objSel && open.get(objSel), nm = p ? p.sec.name : "";
    r.textContent = txt || (m === "world" ? "العالم — اسحب الخلفية لتدوير البيئة كلها" : m === "object" ? "الكائن · " + nm + " — الأداة: " + TOOL_NAME[tool] : "التركيز · " + nm + " — نقرتان أو Esc للعودة");
  }
  function syncMode() {
    const m = modeOf(); document.body.dataset.mode = m;
    document.querySelectorAll("#modebar [data-m]").forEach(b => { const on = b.dataset.m === m; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
    document.querySelectorAll("#modebar [data-t]").forEach(b => { const on = b.dataset.t === tool; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
    open.forEach(p => p.el.classList.toggle("objsel", p.id === objSel && !p.min)); setRead();
    const mb = document.getElementById("modebar"); if (mb) mb.classList.toggle("mini", isMob() && !mbXp); /* على الهاتف في وضع العالم يتقلّص الشريط إلى شريحة صغيرة كي لا يغطي المحتوى (اضغطها للتوسيع) */
  }
  let mbXp = false, mbT = 0; const mbKeep = () => { clearTimeout(mbT); if (mbXp) mbT = setTimeout(() => { mbXp = false; syncMode(); }, 7000); };
  { const r = document.getElementById("mread"), mb = document.getElementById("modebar"); if (r) r.addEventListener("click", () => { if (isMob()) { mbXp = !mbXp; mbKeep(); syncMode(); } }); if (mb) mb.addEventListener("click", () => { if (mbXp) mbKeep(); }, true); }
  /* بعد إزالة اللوح المحدَّد: إن كان لوح آخر موسَّعاً يعود التحديد إليه (وضع التركيز) وإلا يعود وضع العالم */
  const bigSel = skip => { const q = [...open.values()].find(o => o.id !== skip && o.big && !o.min); return q ? q.id : null; };
  function selectObj(id) { if (objSel === id) { syncMode(); return; } objSel = id; va = 0; syncMode(); }
  function clearSel() { if (!objSel) return; objSel = null; syncMode(); }
  function setTool(t) { tool = t; syncMode(); }
  const livePanel = () => { const a = objSel && open.get(objSel); if (a && !a.min) return a; const f = focused && open.get(focused); if (f && !f.min) return f; return [...open.values()].filter(q => !q.min).pop() || null; };
  function toObject() { const p = livePanel(); if (!p) { hint("لا يوجد لوح مفتوح — اختر قسماً من الأسطوانة أولاً"); return; } if (p.big) { toggleBig(p); return; } focus(p.id); selectObj(p.id); }
  function toFocus() { const p = livePanel(); if (!p) { hint("لا يوجد لوح مفتوح — اختر قسماً من الأسطوانة أولاً"); return; } if (!p.big) { focus(p.id); toggleBig(p); } }
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
  function lift0(p) { if (!p.lift && !p.hold) return; p.lift = 0; p.hold = null; ghost(null); p.el.classList.add("tr2"); apply(p); setTimeout(() => p.el.classList.remove("tr2"), 420); }
  function dropHold(p, mode) { ghost(null); if (!p.lift && !p.hold) return; p.lift = 0; p.hold = null; if (mode !== "rot") { p.el.classList.add("tr2"); setTimeout(() => p.el.classList.remove("tr2"), 260); } apply(p); }
  /* مواضع العمل المفضَّلة = شبكة التخطيط الذكي؛ لا مغناطيس في المدار (للمدار تثبيته الخاص) ولا للوح الموسَّع، ولا إن كان الموضع محجوزاً بلوح آخر */
  /* الموضع «حرّ» إن لم يحجب أكثر من 35% من لوح آخر */
  function slotFree(p, c) { const me = { x: c.x, y: c.y, w: p.st.w * p.st.s, h: p.st.h * p.st.s }; for (const o of open.values()) if (o !== p && !o.min && !o.big) { const r = overlap(me, rectOf(o)); if (r && r.a > .35 * Math.min(me.w * me.h, rectOf(o).w * rectOf(o).h)) return false; } return true; }
  function magnetFor(p) {
    if ((orbitMode && !p.frame) || p.big || isMob()) return null; let best = null; layoutFor(6).forEach(c => { const d = Math.hypot(c.x - p.st.x, c.y - p.st.y); if (d < SLOT_R && (!best || d < best.d)) best = { c, d }; }); if (!best) return null;
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

  /* ───── مرحلة 8: الإطار الحقيقي وإدارة مساحة العمل ───── */
  const EMBED_CSS = "#toast,#toast2{border-radius:16px!important;max-width:calc(100vw - 28px)!important;width:max-content!important;right:auto!important;left:50%!important;transform:translateX(-50%)!important;text-align:center}html,body{background:rgba(6,16,24,.95)!important;margin:0!important;touch-action:pan-x pan-y!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}#app{max-width:none!important;margin:0!important;padding:6px 8px 14px!important}#app>.top,#nav-groups,#stats,.side-nav,#cs-svc,.wa-float,#hand-fab,.hand-fab,.ask-fab,#ah-btn,#ah-hand,.ah-x{display:none!important}#ah-panel{position:fixed!important;inset:0!important;top:0!important;right:0!important;width:auto!important;height:auto!important;max-height:none!important;border-radius:0!important;box-shadow:none!important}.admin-body{display:block!important}.admin-main{width:100%!important;max-width:none!important;margin:0!important;padding:0!important;min-width:0!important}";
  /* أقسام nav: تنقّل اللوحة الحقيقي (الشريط العلوي والقائمة/الدرج) يبقى ظاهراً فيصل المستخدم إلى كل الأقسام والإعدادات من داخل اللوح */
  /* جسر لمس احتياطي داخل إطار اللوح (أندرويد/كروم): إن سحب الإصبع سحباً واضحاً ولم يتحرك أي شيء أصلياً (touch-action موروث من الصفحة الأم أو غيره) يمرّر أقرب عنصر قابل للتمرير (نافذة منبثقة أو الصفحة) يدوياً بإسناد مطلق (لا مضاعفة إن اشتغل التمرير الأصلي)؛ لا يمنع شيئاً (مستمعون سلبيون) */
  function touchBridge(w) {
    try {
      const d = w.document; if (d.__scTb || !(("ontouchstart" in w) || (w.navigator && w.navigator.maxTouchPoints > 0))) return; d.__scTb = 1;
      let sc = null, y0 = 0, x0 = 0, s0 = 0, t0 = 0, man = false, ok = false;
      const find = el => { for (; el && el.nodeType === 1; el = el.parentElement) { const oy = w.getComputedStyle(el).overflowY; if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) return el; } return d.scrollingElement; };
      d.addEventListener("touchstart", e => { if (e.touches.length !== 1) { sc = null; return; } const t = e.touches[0]; y0 = t.clientY; x0 = t.clientX; sc = find(e.target); s0 = sc ? sc.scrollTop : 0; t0 = performance.now(); man = false; ok = false; }, { passive: true, capture: true });
      d.addEventListener("touchmove", e => {
        if (!sc || e.touches.length !== 1) return; const t = e.touches[0], dy = y0 - t.clientY, dx = Math.abs(x0 - t.clientX);
        if (!man) { if (ok) return; if (Math.abs(sc.scrollTop - s0) > 1) { ok = true; return; } if (Math.abs(dy) > 28 && Math.abs(dy) > dx * 1.2 && performance.now() - t0 > 120) man = true; else return; }
        sc.scrollTop = s0 + dy;
      }, { passive: true, capture: true });
      d.addEventListener("touchend", () => { sc = null; }, { passive: true, capture: true });
    } catch (_) { }
  }
  const EMBED_NAV_CSS = EMBED_CSS.replace("#app>.top,#nav-groups,", "").replace(".side-nav,", "").replace(".admin-body{display:block!important}", "");
  /* غلاف Spatial Core اللوني: يُحقن داخل لوحة التحكم الحقيقية في الألواح فقط (ألوان وأسطح؛ لا بنية ولا إعدادات ولا تخزين). اللون الأساسي سماوي كهربائي بدل الليموني، النجاح زمردي، التنبيه بنفسجي، والأسطح زرقاء داكنة بحواف مضيئة.
     !important لأن اللوحة تضع --g-mint و--ac نمطاً مضمّناً على <html>. */
  const HOLO_SKIN = "html{--c:59,230,255;--g-mint:#3be6ff!important;--g-mint-rgb:59,230,255!important;--ac:#3be6ff!important;--g-ok:#35f2a5!important;--g-ok-rgb:53,242,165!important;--green:#35f2a5!important;--g-surf:linear-gradient(155deg,rgba(46,130,225,.26),rgba(5,16,36,.66) 72%)!important;--g-smoke:rgba(5,14,32,.7)!important;--lime-hi:rgba(70,228,255,.68)!important;--lime-lo:rgba(150,104,255,.64)!important;--lime-edge:rgba(160,246,255,.95)!important;--lime-ink:#ffffff!important}" +
    "body .card,body .pcard,body .kpi{border:1px solid rgba(59,230,255,.5)!important;box-shadow:inset 0 1px 0 rgba(160,240,255,.14),0 0 0 1px rgba(59,230,255,.05),0 10px 30px rgba(0,0,0,.5)!important}" +
    "html.glass body .stat div:nth-child(4n+1){--c:59,230,255!important}html.glass body .stat div:nth-child(4n+2){--c:138,98,255!important}html.glass body .stat div:nth-child(4n+3){--c:53,242,165!important}html.glass body .stat div:nth-child(4n+4){--c:255,92,214!important}" +
    "#upd-btn,#au-btn,#theme-sw,#theme-btn,#cr-top,.cr-pill,#ais-top,button.logout,#app>.top button[onclick*='SitePreview'],#app>.top button[onclick*='Admin.logout']{display:none!important}" +
    "html{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}" +
    "html.glass body :is(.btn,.small):not(.gray):not(.warn):not(.danger):not(.red):not(.ico):not(#_){text-shadow:0 1px 1px rgba(0,18,40,.55)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.4)!important;font-weight:900!important}" +
    "html.glass body :is(.small.gray,.btn.gray):not(#_){background:rgba(8,28,52,.92)!important;border:1px solid rgba(59,230,255,.5)!important;color:#f0fcff!important}" +
    "html.glass body :is(input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),select,textarea):not(#_){background:rgba(6,24,46,.92)!important;border:1px solid rgba(59,230,255,.5)!important;color:#f4fdff!important}" +
    "html.glass body :is(input,textarea)::placeholder{color:rgba(196,232,246,.72)!important}" +
    "html.glass body :is(input,select,textarea):focus:not(#_){border-color:#3be6ff!important;box-shadow:0 0 0 2px rgba(59,230,255,.3)!important;outline:0!important}";
  /* الليموني الحرفي المضمّن (سمات style/stroke/fill التي تولّدها وحدات اللوحة) يُستبدل بالسماوي أولاً بأول داخل الإطار؛ لا يمس ملفات اللوحة ولا بياناتها */
  const LIME_T = /#(?:e2fe17|effe17|dcff1f|cfe60f|91ac10)\b|rgba?\(\s*(?:226\s*,\s*254\s*,\s*23|220\s*,\s*255\s*,\s*31)\b/i;
  const toHolo = t => t.replace(/#(?:e2fe17|effe17|dcff1f)\b/gi, "#3be6ff").replace(/#(?:cfe60f|91ac10)\b/gi, "#0a8aa6").replace(/(rgba?\()\s*(?:226\s*,\s*254\s*,\s*23|220\s*,\s*255\s*,\s*31)\b/gi, "$1 59,230,255");
  const RC_ATTR = ["style", "stroke", "fill", "stop-color"];
  function recolor(n) { if (!n || n.nodeType !== 1) return; const els = [n].concat([...n.querySelectorAll("[style],[stroke],[fill],[stop-color]")]); for (const e of els) for (const a of RC_ATTR) { const v = e.getAttribute(a); if (v && LIME_T.test(v)) e.setAttribute(a, toHolo(v)); } }
  function holoRecolor(d) { if (d.__spRc) return; d.__spRc = 1; const W2 = d.defaultView; if (!W2 || !W2.MutationObserver) return; recolor(d.body); new W2.MutationObserver(ms => { for (const m of ms) { if (m.type === "attributes") recolor(m.target); else for (const x of m.addedNodes) recolor(x); } }).observe(d.body, { subtree: true, childList: true, attributes: true, attributeFilter: RC_ATTR }); }

  /* مقياس الكاميرا يتكيّف مع حجم النافذة فتبقى الجدران كاملة داخل الإطار (عند 1440×900 يبقى المقاس الأصلي كما اعتُمد) */
  /* لا تكبير للصفحة بإصبعين (iOS يرسل gesture*): كان يكبّر الصفحة فيتبدّل التخطيط وتتعطل اللمسات؛ تدوير القاعة بالإصبعين يعمل بأحداث اللمس لا بها */
  ["gesturestart", "gesturechange", "gestureend"].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
  const camEl = document.getElementById("cam"), roomEl = document.getElementById("room"), BASE_CS = {};
  function fitCam() { [camEl, roomEl].forEach((el, i) => { if (!el) return; if (BASE_CS[i] === undefined) { el.style.removeProperty("--cs"); BASE_CS[i] = parseFloat(getComputedStyle(el).getPropertyValue("--cs")) || 0; } if (innerWidth <= 820 || !BASE_CS[i]) { el.style.removeProperty("--cs"); return; } const k = Math.max(.66, Math.min(1.12, Math.min(innerWidth / 1440, innerHeight / 900))); el.style.setProperty("--cs", (BASE_CS[i] * k).toFixed(3)); }); }
  fitCam(); addEventListener("resize", fitCam);
  async function detectReal() { if (/[?&]demo=1/.test(location.search)) return { real: false, api: false }; let api = false; try { const r = await fetch("../../api/index.php?r=me", { credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest" } }); api = /json/.test(r.headers.get("content-type") || ""); } catch (_) { } return { real: api || /[?&]real=1/.test(location.search), api }; } /* api = واجهة PHP للوكيل التنفيذي متاحة؛ real = ألواح اللوحة الحقيقية (تُفرض بـ?real=1 من إعدادات اللوحة) */
  /* ◎ للوح الإطار الحقيقي: ألواح الإطار لا تدور في المدار (نقل الإطار يعيد تحميله) فيعيده الزر إلى مكانه وزاويته وحجمه الافتراضية */
  /* أعلى موضع رأسي مسموح للوح ارتفاعه hh: يبقى شريط عنوانه ظاهراً تحت الشريط العلوي (لا يصعد فوق الشاشة ولا يختبئ) */
  const yTop = hh => Math.min(-H() / 2 + (isMob() ? 46 : 66) + hh * (isMob() ? 1.04 : 1.1) / 2, 0); /* 1.1: الميلان والمنظور يكبّران الحافة القريبة فيصير الارتفاع المرسوم أكبر من المخزَّن */
  function homeFrame(p) { if (p.big) toggleBig(p); if (p.home) Object.assign(p.st, p.home); else { if (memo[p.id]) memo[p.id].pos = null; placeFrame(p); } p.el.classList.add("tr2"); apply(p); setTimeout(() => p.el.classList.remove("tr2"), 700); }
  function placeFrame(p) {
    { const r = PHR(); if (r) { Object.assign(p.st, { x: 0, y: Math.round(r.cy - H() / 2), z: 0, rx: 0, ry: 0, rz: 0, s: 1, w: r.w, h: r.h }); p.home = { x: 0, y: p.st.y, z: 0, rx: 0, ry: 0, rz: 0, s: 1 }; return; } }   /* هاتف: ورقة كاملة العرض ثابتة */
    const m = memo[p.id] && memo[p.id].pos; if (m) { Object.assign(p.st, m); p.st.x = clamp(p.st.x, -(W() / 2 - 80), W() / 2 - 80); p.st.y = clamp(p.st.y, yTop(p.st.h * p.st.s), H() / 2 - 80); p.st.s = clamp(p.st.s, .5, 1.9); return; }
    const n = [...open.values()].filter(q => !q.min).length, L = layoutFor(Math.min(6, Math.max(2, n))), c = L.find(x => slotFree(p, x)) || L[(n - 1) % L.length];
    Object.assign(p.st, { x: c.x, y: c.y, z: c.z, rx: c.rx, ry: c.ry, rz: 0, s: Math.min(c.s, 1) });
    if (n === 1 && !isMob()) p.st.x = (window.SCParts && SCParts.visible) ? 0 : Math.min(p.st.x, W() / 2 - p.st.w / 2 - 70); /* بين جناحي بطاقات الرئيسية */ /* اللوح الوحيد لا يخرج من حافة الشاشة مع ميلانه */
    p.home = { x: p.st.x, y: p.st.y, z: p.st.z, rx: p.st.rx, ry: p.st.ry, rz: 0, s: p.st.s }; /* خانته الأصلية لزر ◎ */
  }
  /* لوح احتياطي مُسخَّن (السرعة): إطار لوحة حقيقي يُحمَّل خفيةً في الخلفية؛ عند فتح أي لوح يُنقَل إليه بـ moveBefore (يحفظ حالته فلا يُعاد تحميله) فيظهر اللوح فوراً، ثم يُحمَّل بديل. بلا moveBefore يعمل التحميل العادي */
  /* ───── طابور تحميل الإطارات (V3) ─────
     الإطارات المتزامنة تتقاسم خيطاً رئيسياً واحداً (نفس الأصل)، فتحميلها معاً يؤخّر الكل ويؤخّر النشطة آخراً؛ لذا تُحمَّل واحدة واحدة: المركَّزة أولاً ثم الأحدث، والتالية تبدأ بعد اكتمال السابقة وهدوء الإدخال (حتى 3ث)
     أو مهلة 14ث. المنتظرة تُظهر «بانتظار دورها» وتتقدّم فوراً إن فُعِّلت؛ المصغَّرة قبل تحميلها لا تُحمَّل حتى تُستعاد. */
  const LQ = { q: [], cur: null, t0: 0, tm: 0, avg: 0, gaps: [], raf: 0, bt: 0 };
  const lqSet = (p, txt) => { try { const s = p.body && p.body.querySelector(".fr-load span"); if (s) s.textContent = txt; } catch (_) { } };
  /* دفعة التحميل تُعلِم SpatialShare (مشاركة القراءات): أثناءها تعيش القراءات المشتركة أطول، وتنتهي بعدها بثوانٍ */
  function lqBurst() { try { if (!window.SpatialShare) return; clearTimeout(LQ.bt); if (LQ.cur || LQ.q.length) SpatialShare.burst(true); else LQ.bt = setTimeout(() => { if (!LQ.cur && !LQ.q.length) SpatialShare.burst(false); }, 1200); } catch (_) { } }
  /* عيّنة هدوء الإطارات (V4): تعمل فقط ما دام في الطابور عمل؛ لا نبدأ حمولة خلفية والإطارات متقطعة (فجوة ≥70ms) */
  function lqSample() { if (LQ.raf) return; let last = 0; const f = t => { if (last) { LQ.gaps.push(t - last); if (LQ.gaps.length > 8) LQ.gaps.shift(); } last = t; LQ.raf = (LQ.q.length || LQ.cur) ? requestAnimationFrame(f) : 0; }; LQ.raf = requestAnimationFrame(f); }
  const lqCalm = () => LQ.gaps.length >= 5 && LQ.gaps.slice(-5).every(g => g < 70);
  function lqStart(p) { LQ.cur = p; LQ.t0 = performance.now(); p._lq = "loading"; if (p.el.dataset.frame === "queued") p.el.dataset.frame = "loading"; lqSet(p, "جارٍ تحميل لوحة التحكم…"); p.fr.src = "../../admin.html"; clearTimeout(LQ.tm); LQ.tm = setTimeout(() => { if (LQ.cur === p) { LQ.cur = null; lqPump(99); } }, 14000); lqBurst(); }
  function lqAsk(p) {
    p._lq = "queued"; p.el.dataset.frame = "queued"; lqSet(p, "بانتظار دورها…"); if (LQ.q.indexOf(p) < 0) LQ.q.push(p);
    if (!p._hv) { p._hv = 1; p.el.addEventListener("pointerenter", () => { clearTimeout(p._hvt); p._hvt = setTimeout(() => { if (p._lq === "queued") p.hot = performance.now(); }, 350); }); p.el.addEventListener("pointerleave", () => clearTimeout(p._hvt)); }   /* تحويم متعمَّد (350ms) يرفع الأولوية */
    lqBurst(); lqSample(); setTimeout(() => lqPump(0), 0);
  }
  function lqPump(n) {
    if (LQ.cur && !LQ.cur._lqGone && LQ.cur._lq === "loading") return; LQ.q = LQ.q.filter(x => !x._lqGone && x.fr && x.fr.isConnected && x._lq === "queued"); if (!LQ.q.length) { lqBurst(); return; }
    const t = performance.now(), hot = x => (x.hot && t - x.hot < 8000) ? 1 : 0;
    const best = LQ.q.slice().sort((a, b) => ((b.id === focused) - (a.id === focused)) || (hot(b) - hot(a)) || ((b.born || 0) - (a.born || 0)))[0];
    /* الأولوية للنافذة التي يتفاعل معها المستخدم: لا تبدأ حمولة خلفية إلا بعد هدوء إدخال (مؤشر/لمس/مفتاح) وإطارات هادئة. الشرط تكيّفي بثقل الحمولة المقيس على الجهاز نفسه:
       جهاز سريع (حمولة ~1.5ث) ← هدوء 0.4ث وسقف انتظار ~3.8ث؛ جهاز بطيء (~5ث) ← هدوء 1.2ث وسقف ~12.5ث؛ بعد السقف تبدأ الحمولة ولو استمر التفاعل (لا تجويع دائم). */
    const avg = LQ.avg || 3000, quiet = Math.max(250, Math.min(1200, avg * .25)), cap = Math.ceil(Math.max(2500, Math.min(15000, avg * 2.5)) / 250);
    if (best.id !== focused && (n || 0) < cap && !(t - lastIn >= quiet && (document.hidden || lqCalm()))) { lqSample(); return setTimeout(() => lqPump((n || 0) + 1), 250); }
    LQ.q.splice(LQ.q.indexOf(best), 1); lqStart(best);
  }
  /* اختيار نافذة منتظرة: تتقدّم فوراً، وتُلغى الحمولة الخلفية الجارية إن كانت في بدايتها (تعود لدورها) فلا تنتظر المُختارة إتمام ما لا يخصّها */
  function lqAbort(c) { c._lqAborts = (c._lqAborts || 0) + 1; c._lqAbort = true; clearTimeout(c._fi); clearTimeout(LQ.tm); LQ.cur = null; c.frDone = false; c.frReady = false; try { c.fr.src = "about:blank"; } catch (_) { } lqAsk(c); }
  function lqFocus(id) {
    const p = open.get(id); if (!p || p._lq !== "queued") return; p.hot = performance.now(); const c = LQ.cur;
    if (c && c !== p && c._lq === "loading" && (c._lqAborts || 0) < 2 && (!LQ.avg || performance.now() - LQ.t0 < LQ.avg * .6)) lqAbort(c);
    setTimeout(() => lqPump(0), 0);
  }
  const lqDone = p => { if (p._lq === "loading") p._lq = "done"; if (LQ.cur === p) { const d = performance.now() - LQ.t0; LQ.avg = LQ.avg ? LQ.avg * .6 + d * .4 : d; LQ.cur = null; clearTimeout(LQ.tm); setTimeout(() => lqPump(0), Math.max(150, Math.min(900, d * .2))); lqBurst(); } };   /* فاصل يتناسب مع ثقل التحميل السابق (الجهاز البطيء يُمنح متنفَّساً أطول) ليمرّ إدخال المستخدم والتبديل بين الحمولات */
  const lqDrop = p => { p._lqGone = true; LQ.q = LQ.q.filter(x => x !== p); if (LQ.cur === p) { LQ.cur = null; clearTimeout(LQ.tm); setTimeout(() => lqPump(0), 60); } lqBurst(); };
  const SP = { f: null, ready: false, off: typeof Element === "undefined" || !Element.prototype.moveBefore, n: 0 };
  function spareMake() {
    if (!REAL || SP.f || (isMob() && !(navigator.deviceMemory >= 4)) || document.hidden || /[?&]nospare=1/.test(location.search)) return; /* الهاتف: لوح احتياطي واحد فقط إن أعلن الجهاز ذاكرة ≥ 4GB (iOS لا يعلنها فلا لوح) */ let park = document.getElementById("spare-park"); if (!park) { park = document.createElement("div"); park.id = "spare-park"; park.setAttribute("aria-hidden", "true"); document.body.appendChild(park); }
    const f = document.createElement("iframe"); f.className = "pn-frame"; f.title = ""; f.tabIndex = -1; SP.f = f; SP.ready = false; f.addEventListener("load", () => spareWait(f, 0)); f.src = "../../admin.html"; park.appendChild(f);
  }
  /* التسخين يُبنى في صمت: يُؤجَّل حتى يهدأ المستخدم (لا إدخال 2.5ث) كي لا يقطع إقلاع اللوح الاحتياطي (مهمة طويلة على الخيط الرئيسي نفسه) تفاعلاً جارياً */
  let lastIn = 0; ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"].forEach(ev => addEventListener(ev, () => { lastIn = performance.now(); }, { capture: true, passive: true }));
  function spareSoon(ms, n) { setTimeout(() => { if (performance.now() - lastIn < 2500 && (n || 0) < 40) return spareSoon(1000, (n || 0) + 1); spareMake(); }, ms); }
  /* ألواح احتياطية إضافية (سطح المكتب فقط): تُحمَّل بعد جاهزية الأول وتُجهَّز على تبويبي الطلبات والمنتجات فيُفتح لوحاهما **آنياً** بمحتوى مرسوم؛ يُعاد تعبئتها بعد كل تبنٍّ وفي هدوء المستخدم */
  const EXT = [], EX_TABS = ["orders", "products"];
  function extraMake() {
    if (!REAL || SP.off || isMob() || document.hidden || !SP.ready || /[?&](nospare|noextra)=1/.test(location.search)) return; const want = EX_TABS.find(t => !EXT.some(e => e.tab === t)); if (!want) return; const park = document.getElementById("spare-park"); if (!park) return;
    const f = document.createElement("iframe"); f.className = "pn-frame"; f.title = ""; f.tabIndex = -1; const e = { f, tab: want, ready: false }; EXT.push(e); f.addEventListener("load", () => extraWait(e, 0)); f.src = "../../admin.html"; park.appendChild(f);
  }
  function extraSoon(ms, n) { setTimeout(() => { if (performance.now() - lastIn < 2500 && (n || 0) < 40) return extraSoon(1000, (n || 0) + 1); extraMake(); }, ms); }
  function extraWait(e, n) {
    if (!EXT.includes(e)) return;
    try { const w = e.f.contentWindow, d = w.document, A = w.eval('typeof Admin !== "undefined" ? Admin : null'), app = d.getElementById("app"); if (A && app && !app.classList.contains("hidden") && typeof A.tab === "function") { try { A.tab(e.tab); } catch (_) { } setTimeout(() => { e.ready = true; extraSoon(1200); }, 900); return; } } catch (_) { }
    if (n < 120) setTimeout(() => extraWait(e, n + 1), 250);
  }
  function spareWait(f, n) {
    if (SP.f !== f) return;
    try { const w = f.contentWindow, d = w.document, A = w.eval('typeof Admin !== "undefined" ? Admin : null'), app = d.getElementById("app"); if (A && app && !app.classList.contains("hidden") && typeof A.tab === "function") { SP.ready = true; SP.n++; try { A.tab("home"); } catch (_) { } setTimeout(() => navSync(d), 1200); document.dispatchEvent(new CustomEvent("sc-spare", { detail: { f } })); extraSoon(2500); return; } } catch (_) { }
    if (n < 120) setTimeout(() => spareWait(f, n + 1), 250);
  }
  function mountFrame(p) {
    const b = p.body; b.classList.add("fr"); p.el.classList.add("framed");
    b.innerHTML = '<iframe class="pn-frame" title=""></iframe><div class="pn-shield" aria-hidden="true"><span>انقر على اللوح لتفعيله</span></div><div class="fr-load"><i></i><span>جارٍ تحميل لوحة التحكم…</span></div>';
    /* السحب على ستارة لوح غير مُركَّز يحرّك اللوح كأنه من شريط عنوانه (النقرة وحدها تفعّله) */
    b.querySelector(".pn-shield").addEventListener("pointerdown", e => { if (e.pointerType === "mouse" && e.button !== 0) return; const h = p.el.querySelector(".pn-h"); if (!h) return; e.preventDefault(); h.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: e.pointerId, pointerType: e.pointerType, clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY, button: e.button, buttons: e.buttons, isPrimary: e.isPrimary })); });
    let f = b.querySelector("iframe"), adopted = false; const ex = !SP.off ? EXT.find(e => e.ready && e.f.isConnected && e.tab === p.frame.tab) : null;
    if (ex) { try { b.moveBefore(ex.f, f); f.remove(); f = ex.f; EXT.splice(EXT.indexOf(ex), 1); adopted = true; extraSoon(1600); } catch (_) { adopted = false; } }   /* لوح مُجهَّز مسبقاً على التبويب نفسه: يظهر آنياً */
    else if (SP.ready && SP.f && SP.f.isConnected && !SP.off) { const sf = SP.f; try { b.moveBefore(sf, f); f.remove(); f = sf; SP.f = null; SP.ready = false; adopted = true; spareSoon(1600); } catch (_) { adopted = false; } } p.adopted = adopted; p.wasAdopted = adopted; f.title = p.sec.name; p.fr = f; p.frReady = false; if (window.SpatialHub) SpatialHub.attach(p.id, f.contentWindow, p.el); let first = !adopted; f.addEventListener("load", () => { if (!f.getAttribute("src")) return; if (p._lqAbort) { p._lqAbort = false; return; } /* load صفحة about:blank التي نقلنا إليها الإطار عند إلغاء حمولة خلفية */ /* load الصفحة الفارغة الأولية قبل أن يمنح الطابور الإطار عنوانه: يُتجاهَل (وإلا عدّه SpatialHub إعادة تحميل وأسقط جاهزية اللوح بعد hello) */ if (p.blank) { p.blank = false; p.discarded = true; return; } p._bt0 = 0; p.frUser = false; /* تفريغ مقصود (المرحلة 12B): لا تهيئة لصفحة فارغة */ if (!first && window.SpatialHub) SpatialHub.reload(p.id); first = false; p.frDone = false; p.frReady = false; p.frTry = 0; p.frGuard = 0; p.frTouched = false; initFrame(p); }); if (adopted) { p.frDone = false; p.frTry = 0; p.frGuard = 0; p.frTouched = false; initFrame(p); } else if (LAZY.has(p.id)) { LAZY.delete(p.id); p.blank = true; p.discarded = true; p.el.dataset.frame = "discarded"; /* لوح مُستعاد من الحفظ: لا يُحمَّل إطاره حتى يُفعَّل */ } else lqAsk(p); clearTimeout(p._fs); p.el.classList.remove("fr-show"); p._fs = setTimeout(() => p.el.classList.add("fr-show"), 16000); /* كشف احتياطي إن تعذّر ظهور التبويب */
  }
  /* جسر الصوت: كلام المساعد (speechSynthesis) والميكروفون داخل لوح «اسألني» يحرّكان الكرة (أعصاب + صوت ستيريو) كأنها تتكلم وتستمع */
  function bridgeVoice(p, w, d) {
    try {
      if (w.__scVoice) return; w.__scVoice = true; const ss = w.speechSynthesis; let lvl = 0, spk = 0, tm = 0; if (!ss) return;
      const set = m => { try { if (window.Core3D) Core3D.setVoice(m); } catch (_) { } }, tick = () => { lvl *= .82; try { if (window.Core3D) Core3D.setAudio(spk ? Math.max(lvl, .18) : lvl); if (window.SphereAudio) SphereAudio.level(lvl); } catch (_) { } if (!spk && lvl < .02) { clearInterval(tm); tm = 0; } };
      const pulse = () => { lvl = Math.min(1, lvl + .5); if (!tm) tm = setInterval(tick, 60); };
      const sp = ss.speak.bind(ss); ss.speak = function (u) { try { u.addEventListener("start", () => { spk++; set("speaking"); pulse(); }); u.addEventListener("boundary", pulse); const end = () => { spk = Math.max(0, spk - 1); if (!spk) set(listening() ? "listening" : "none"); }; u.addEventListener("end", end); u.addEventListener("error", end); } catch (_) { } return sp(u); };
      const listening = () => { try { const m = d.getElementById("ah-mic"); return !!(m && m.classList.contains("on")); } catch (_) { return false; } };
      let last = ""; p._vb = setInterval(() => { if (!p.fr || !p.fr.isConnected) { clearInterval(p._vb); return; } if (spk) return; const m = listening() ? "listening" : "none"; if (m !== last) { last = m; set(m); } }, 300);
    } catch (_) { }
  }
  function hookFrame(p, d) {
    const sc = e => [...e.touches].slice(0, 2).map(t => [t.screenX, t.screenY]);
    d.addEventListener("pointerdown", () => { p.frTouched = true; if (focused !== p.id) focus(p.id); selectObj(p.id); }, true);
    /* المرحلة 12B: تفاعل مستخدم حقيقي (isTrusted) داخل اللوح خارج مرشحات الطلبات = «عمل قائم» فلا يُفرَّغ الإطار أبداً (الاستعادة تعيد التبويب/التمرير/المرشحات فقط) */
    const userAct = e => { if (!e.isTrusted) return; const t = e.target; if (t && t.closest && t.closest("#order-filter-q,#order-filter-status,#order-filter-wilaya,#order-filter-from,#order-filter-to,#order-show-shipped")) return; p.frUser = true; };
    d.addEventListener("pointerdown", userAct, true); d.addEventListener("keydown", userAct, true); d.addEventListener("paste", userAct, true);
    d.addEventListener("wheel", e => { if (e.shiftKey) { e.preventDefault(); userize(p); p.st.z = clamp(p.st.z + (e.deltaY < 0 ? 34 : -34), ZMIN, ZMAX); p.el.classList.add("tr2"); apply(p); badge(p, "عمق " + Math.round(p.st.z)); clearTimeout(p._bt); p._bt = setTimeout(() => { badge(p, ""); p.el.classList.remove("tr2"); }, 700); } }, { passive: false });
    d.addEventListener("touchstart", e => { if (e.touches.length === 2) p.pinch.start(sc(e)); }, { passive: true });
    d.addEventListener("touchmove", e => { if (e.touches.length === 2 && p.pinch.active()) { e.preventDefault(); p.pinch.move(sc(e)); } }, { passive: false });
    d.addEventListener("touchend", e => { if (e.touches.length < 2 && p.pinch.active()) p.pinch.end(); }, { passive: true });
  }
  const OF = { q: "order-filter-q", status: "order-filter-status", wilaya: "order-filter-wilaya", from: "order-filter-from", to: "order-filter-to" };
  function snapFrame(p) {
    if (!p.fr || !p.frReady) return; try {
      const w = p.fr.contentWindow, d = w.document, fs = { tab: p.frame.tab, scroll: Math.round(w.scrollY) };
      if (p.frame.tab === "orders") { fs.f = {}; for (const k in OF) { const e = d.getElementById(OF[k]); fs.f[k] = e ? e.value : ""; } const sh = d.getElementById("order-show-shipped"); fs.f.shipped = !!(sh && sh.checked); }
      p.content.fs = fs;
    } catch (_) { }
  }
  /* ───── المرحلة 12B: تجميد الألواح المصغّرة ─────
     فوري وخفيف: الحركات تتوقف وdocument.hidden=true داخل الإطار (فتتوقف الوحدات التي تحترمه) ويُعاد كل شيء عند الفتح — الحالة لا تُمَس.
     بعد DISCARD_MS (?discard=ms، 0 = تعطيل) يُفرَّغ الإطار فعلاً (تحرير DOM/ذاكرة) إن كان اللوح «نظيفاً»: لا حقل معدَّل ولا تبويب غير الأصلي ولا تحميل ملف؛
     وإلا يبقى مجمَّداً خفيفاً فقط (لا نخسر عملاً غير محفوظ أبداً). الاستعادة: إعادة تحميل اللوح ثم تطبيق (تبويب/تمرير/فلاتر) المحفوظة + مصالحة Hub. */
  const DISCARD_MS = (m => m ? +m[1] : 60000)(/[?&]discard=(\d+)/.exec(location.search));
  const SUSP_CSS = "html.sp-susp *,html.sp-susp *::before,html.sp-susp *::after{animation-play-state:paused!important;transition:none!important}";
  function frameDirty(p) {
    try {
      if (p.frUser) return true;                                                                /* تفاعل مستخدم حقيقي داخل اللوح ← عمل قائم لا نفرّغه */
      const w = p.fr.contentWindow, d = w.document;
      const tgt = d.getElementById("tab-" + p.frame.tab), ahp = d.getElementById("ah-panel"), onTab = p.frame.tab === "ask" ? !!(ahp && ahp.classList.contains("on")) : !!(tgt && !tgt.classList.contains("hidden"));
      if (!onTab) return true;                                                                  /* تنقّل داخل اللوح إلى تبويب آخر: لا نعرف كيف نعيده ← لا تفريغ */
      for (const e of d.querySelectorAll('input[type="file"]')) if (e.files && e.files.length) return true;
      if (d.querySelector('[contenteditable="true"]:focus') || (w.getSelection && String(w.getSelection()).length)) return true;
      return false;
    } catch (_) { return true; }                                                                /* تعذّر الفحص ← الأحوط عدم التفريغ */
  }
  function softSuspend(p, on) {
    try {
      const w = p.fr.contentWindow, d = w.document; if (!d || !d.head) return;
      if (!d.getElementById("__spSusp")) { const st = d.createElement("style"); st.id = "__spSusp"; st.textContent = SUSP_CSS; d.head.appendChild(st); }
      d.documentElement.classList.toggle("sp-susp", !!on); p.suspended = !!on;
      if (on && !p._hid) { p._hid = true; Object.defineProperty(d, "hidden", { configurable: true, get: () => true }); Object.defineProperty(d, "visibilityState", { configurable: true, get: () => "hidden" }); }
      else if (!on && p._hid) { p._hid = false; delete d.hidden; delete d.visibilityState; }
      d.dispatchEvent(new w.Event("visibilitychange"));
    } catch (_) { }
  }
  function discardFrame(p) {
    if (!p.min || p.discarded || p.blank || !p.fr || !p.frDone) return;
    if (frameDirty(p)) { p.discardSkipped = (p.discardSkipped || 0) + 1; return; }
    p.blank = true; try { p.fr.src = "about:blank"; }   /* الحالة (تبويب/تمرير/مرشحات) حُفظت لحظة التصغير في suspendPanel: بعد إخفاء الإطار يصير التمرير 0 فلا نُعيد اللقطة */ catch (_) { p.blank = false; return; }
    p.discardedAt = Date.now(); p.el.dataset.frame = "discarded"; p.frDone = false; p.frReady = false; clearTimeout(p._fi);
  }
  function suspendPanel(p) { if (!p.fr) return; snapFrame(p); softSuspend(p, true); clearTimeout(p._dis); if (DISCARD_MS > 0) p._dis = setTimeout(() => discardFrame(p), DISCARD_MS); }
  function resumePanel(p) {
    if (!p.fr) return; clearTimeout(p._dis); if (p._lq === "held") { lqAsk(p); return; }
    if (p.discarded || p.blank) { p.discarded = false; p.blank = false; p.frDone = false; p.frReady = false; p.frTry = 0; p.frGuard = 0; p.frTouched = false; p.suspended = false; p._hid = false; p.el.dataset.frame = "restoring"; if (!p.body.querySelector(".fr-load")) p.body.insertAdjacentHTML("beforeend", '<div class="fr-load"><i></i><span>جارٍ استعادة اللوح…</span></div>'); lqAsk(p); }
    else { softSuspend(p, false); setTimeout(() => { try { if (!p.min && p.frDone) restoreFrame(p, p.fr.contentWindow, p.fr.contentWindow.document); } catch (_) { } }, 280); }   /* التمرير/المرشحات تضيع عند إخفاء الإطار: نعيدها */
  }
  function restoreFrame(p, w, d) {
    const fs = p.content && p.content.fs; if (!fs) return;
    try { if (fs.f) { for (const k in OF) { const e = d.getElementById(OF[k]); if (e && fs.f[k] != null) e.value = fs.f[k]; } const sh = d.getElementById("order-show-shipped"); if (sh) sh.checked = !!fs.f.shipped; if (p.frA && p.frA.applyOrderFilters) p.frA.applyOrderFilters(); } if (fs.scroll) setTimeout(() => { try { w.scrollTo(0, fs.scroll); } catch (_) { } }, 120); } catch (_) { }
  }
  function initFrame(p) {
    const f = p.fr; if (!f || !f.isConnected) return; clearTimeout(p._fi); let n = 0;
    const tick = () => {
      if (!f.isConnected || p.fr !== f) return; let w, d; try { w = f.contentWindow; d = w.document; } catch (_) { return; }
      touchBridge(w); if (d.head && !d.getElementById("__spEmbed")) { const st = d.createElement("style"); st.id = "__spEmbed"; st.textContent = (p.frame && p.frame.nav ? EMBED_NAV_CSS : EMBED_CSS) + HOLO_SKIN; d.documentElement.classList.add("glass"); d.documentElement.classList.remove("white"); holoRecolor(d); /* داكن داخل الإطار فقط؛ لا يُكتب شيء في تخزين المستخدم */ d.head.appendChild(st); hookFrame(p, d); bridgeVoice(p, w, d); }
      const app = d.getElementById("app"), ld = p.body.querySelector(".fr-load");
      let A = null; try { A = w.eval('typeof Admin !== "undefined" ? Admin : null'); } catch (_) { } /* Admin وAdminHelp ثوابت عامة وليست على window */
      const bootOk = !w.__spBoot || w.__spBoot.done || (p._bt0 = p._bt0 || Date.now(), Date.now() - p._bt0 > 15000);   /* شريحة إقلاع اللوحة (V4): لا نعلن الجاهزية قبل انتهاء مستمعاتها المُجدولة (سقف 15ث) فلا يظهر المحتوى ناقصاً */
      if (A && app && !app.classList.contains("hidden") && typeof A.tab === "function" && bootOk) {
        if (!p.frReady) { p.frReady = true; p.frA = A; p.frTry = 0; if (window.SpatialHub && !d.getElementById("__spBridge")) { const sc = d.createElement("script"); sc.id = "__spBridge"; sc.src = new URL("bridge.js", location.href).href; d.head.appendChild(sc); } }
        /* اللوحة تنهي تهيئتها بعد ظهورها وقد تعيد التبويب الرئيسي: نثبّت التبويب المطلوب حتى يظهر فعلاً */
        const tgt = d.getElementById("tab-" + p.frame.tab), ahp = d.getElementById("ah-panel"), shown = p.frame.tab === "ask" ? !!(ahp && ahp.classList.contains("on")) : tgt && !tgt.classList.contains("hidden");
        if (!p.frGuard) p.frGuard = Date.now() + 14000; /* اللوحة قد تعود إلى «الرئيسية» عند اكتمال تهيئتها: نُبقي التبويب المطلوب 14ث الأولى ما لم يلمس المستخدم الإطار */
        if (!shown && !p.frTouched && p.frTry < 220) { p.frTry++; try { if (p.frame.tab === "ask") { const H = w.eval('typeof AdminHelp !== "undefined" ? AdminHelp : null'); if (H && !(ahp && ahp.classList.contains("on"))) H.show(); } else A.tab(p.frame.tab); } catch (_) { } p._fi = setTimeout(tick, 90); return; }
        if (!p.frDone) { frameZoom(p); p.frDone = true; lqDone(p); setTimeout(() => { try { navSync(p.fr.contentDocument); } catch (_) { } }, 700); if (p.adopted) { p.adopted = false; /* لوح احتياطي حُمِّل قبل لحظات: بياناته قد تكون أقدم من الخادم ← تحديث فوري عبر الهَب (يُعاد المحاولة حتى يجهز الجسر) */ let tries = 0; const rf = () => { try { if (window.SpatialHub) SpatialHub.refreshNow(p.id).then(r => { if (!(r && r.ok) && ++tries < 8 && open.get(p.id) === p) setTimeout(rf, 600); }).catch(() => { }); } catch (_) { } }; setTimeout(rf, 500); } if (p.autoMic) { p.autoMic = false; setTimeout(() => { try { const m = d.getElementById("ah-mic"); if (m && !m.classList.contains("on")) m.click(); } catch (_) { } }, 900); } if (isMob() && !SP.f && !SP.ready) spareSoon(1200); setTimeout(() => restoreFrame(p, w, d), 100); if (ld) ld.remove(); p.el.dataset.frame = "ready"; }
        if (Date.now() < p.frGuard && !p.frTouched) p._fi = setTimeout(tick, 250);
        return;
      }
      if (ld && n > 3) ld.classList.add("login"); /* شاشة الدخول الحقيقية ظاهرة داخل اللوح */
      if (++n < 3000) p._fi = setTimeout(tick, 150);
    };
    tick();
  }
  /* إدارة مساحة العمل: ترتيب، عودة للاسطوانة، استعادة الكل */
  function tileAll() {
    const L = [...open.values()].filter(q => !q.min && !q.big); if (!L.length) return; const slots = layoutFor(Math.min(6, Math.max(2, L.length)));
    L.forEach((q, i) => { const c = slots[i % slots.length]; if (!q.user) { q.user = true; q.el.classList.add("free"); setLayer(q, false); q.el.style.setProperty("--op", 1); q.el.classList.remove("back"); } cancelGlide(q); q.bk = null; q.hold = null; Object.assign(q.st, { x: c.x, y: c.y, z: c.z, rx: c.rx, ry: c.ry, rz: 0, s: c.s }); q.el.classList.add("tr2"); apply(q); setTimeout(() => q.el.classList.remove("tr2"), 450); });
  }
  function toCylinder() { open.forEach(q => { if (q.big) toggleBig(q); }); clearSel(); [...open.values()].filter(q => !q.min).forEach(q => dismiss(q.id, "min")); focused = null; }
  function restoreAll() { [...open.values()].filter(q => q.min).forEach((q, i) => setTimeout(() => openSection(q.id), i * 140)); }
  document.querySelectorAll("#modebar [data-w]").forEach(b => b.addEventListener("click", () => { const w = b.dataset.w, nOpen = [...open.values()].filter(q => !q.min).length, nMin = [...open.values()].filter(q => q.min).length; if (w === "tile") { if (!nOpen) hint("لا توجد ألواح مفتوحة لترتيبها"); else tileAll(); } else if (w === "cyl") { if (!nOpen) hint("لا توجد ألواح مفتوحة لتصغيرها"); else toCylinder(); } else { if (!nMin) hint("لا توجد ألواح مصغَّرة لاستعادتها"); else restoreAll(); } }));
  function wire(p) {
    const el = p.el, h = el.querySelector(".pn-h"), rot = el.querySelector(".pn-rot"), rs = el.querySelector(".pn-rs");
    el.addEventListener("pointerdown", () => { if (focused !== p.id) focus(p.id); selectObj(p.id); });
    el.addEventListener("pointerenter", () => { hov++; }); el.addEventListener("pointerleave", () => { hov = Math.max(0, hov - 1); });
    el.querySelector(".pn-x").onclick = () => dismiss(p.id, "close"); el.querySelector(".pn-min").onclick = () => dismiss(p.id, "min"); el.querySelector(".pn-max").onclick = () => toggleBig(p);
    let tapUp = 0, tapX = 0;
    h.addEventListener("pointerdown", e => {
      if (e.target.closest(".pn-min,.pn-max,.pn-x")) return; e.preventDefault(); const mode = e.target.closest(".pn-rot") ? "rot" : e.target.closest(".pn-dep") ? "depth" : e.shiftKey ? "rot" : e.altKey ? "depth" : (e.ctrlKey || e.metaKey) ? "roll" : tool, now = performance.now();
      /* نقرتان = توسيع/استعادة، لكن تُحسب نقرة ثانية فقط إن كانت «نقرة» (دون سحب) خلال 520ms من نقرة أولى؛ فالضغط للتحديد ثم السحب فوراً لا يوسّع اللوح بالخطأ */
      const maybeDouble = (mode === "move" || p.big) && !e.target.closest(".pn-dep,.pn-rot") && now - tapUp < 520 && Math.abs(e.clientX - tapX) < 30;
      if (p.big && !maybeDouble) { act(p, "focus"); } /* وضع التركيز: اللوح ثابت في مركز مساحة العمل (نقرتان أو Esc للعودة) */
      cancelGlide(p); el.classList.remove("tr", "tr2", "gliding"); el.classList.add("dragging"); const g = { mode, id: e.pointerId, x: e.clientX, y: e.clientY, s: [], t0: now, moved: 0, dbl: maybeDouble, x0: e.clientX }; h._g = g; {
        /* احتياط أثناء السحب فقط: (1) فقد التقاط المؤشر (iOS/طبقات ثلاثية الأبعاد) ← نتابع الحركة والرفع على النافذة؛ (2) بعد pointercancel نكمل بأحداث اللمس مع منع تمرير المتصفح */
        const out = n => e => { const q = h._g; if (q === g && !g.tc && e.pointerId === g.id && e.target !== h && !h.contains(e.target)) (n === "m" ? hmove : up)(e); }, tp = e => { if (h._g !== g || !g.tc) return null; const c = [...(e.changedTouches || [])][0]; return c ? { pointerId: g.id, clientX: c.clientX, clientY: c.clientY } : null; };
        const L = [["pointermove", out("m"), true], ["pointerup", out("u"), true], ["touchmove", e => { if (h._g !== g) return; if (!g.tc && performance.now() - g.lpm > 90 && (e.touches || []).length === 1) g.tc = true; const q = tp(e); if (q) { if (e.cancelable) e.preventDefault(); hmove(q); } }, { passive: false, capture: true }], ["touchend", e => { const q = tp(e); if (q) up(q); }, true], ["touchcancel", e => { const q = tp(e); if (q) up(q); }, true]];
        g.lpm = performance.now(); /* آخر pointermove معالَج: إن توقّفت أحداث المؤشر والإصبع يتحرك (التقاط مفقود/إطار تحت الإصبع) يتولى اللمس */
        L.forEach(a => addEventListener(a[0], a[1], a[2])); g.off = () => L.forEach(a => removeEventListener(a[0], a[1], a[2]));
      } if (!p.big) p.pre = { x: p.st.x, y: p.st.y, z: p.st.z, rx: p.st.rx, ry: p.st.ry, rz: p.st.rz || 0, s: p.st.s }; try { h.setPointerCapture(e.pointerId); } catch (_) { }
      /* استجابة فيزيائية للإمساك: عند بدء السحب فعلاً (لا عند النقرة) يرتفع اللوح نحو الكاميرا قليلاً ويميل بحسب موضع الإمساك (كأن الإصبع يثبّت نقطة منه) */
      { const r = el.getBoundingClientRect(); g.gx = clamp((e.clientX - (r.left + r.width / 2)) / Math.max(1, r.width / 2), -1, 1); g.gy = clamp((e.clientY - (r.top + r.height / 2)) / Math.max(1, r.height / 2), -1, 1); }
    });
    const hmove = e => { const g = h._g; if (!g || g.id !== e.pointerId) return; if (PHR() && p.frame) return;   /* ورقة الهاتف لا تُسحب */ if (g.tc && e.pointerType === "touch") return; /* بعد تولّي اللمس (g.tc) نتجاهل أحداث المؤشر اللمسية */ g.lpm = performance.now(); const dx = e.clientX - g.x, dy = e.clientY - g.y; g.x = e.clientX; g.y = e.clientY; g.moved += Math.abs(dx) + Math.abs(dy); /* لوح اللوحة الحقيقية الكبير (بحجم المكتب) يُحرَّك من شريط عنوانه بحدود تُبقي العنوان ظاهراً وجزءاً كافياً منه على الشاشة؛ ألواح العرض التجريبي الكبيرة تبقى ثابتة في المركز */ if (p.big) { if (!p.frame || g.mode !== "move" || g.moved < 8) return; el.classList.add("dragging"); el.classList.remove("tr", "tr2"); const f = persp(p.st.z + (focused === p.id ? 40 : 0)), mx = W() / 2 + p.st.w * p.st.s / 2 - 140; p.st.x = clamp(p.st.x + dx / f, -mx, mx); p.st.y = clamp(p.st.y + dy / f, yTop(p.st.h * p.st.s), H() / 2 - 70); apply(p); return; } const t = performance.now(); let co = []; try { co = e.getCoalescedEvents ? e.getCoalescedEvents() : []; } catch (_) { } if (co.length > 1) co.forEach(c => g.s.push([c.timeStamp || t, c.clientX, c.clientY])); else g.s.push([t, e.clientX, e.clientY]); while (g.s.length > 2 && t - g.s[0][0] > 170) g.s.shift();
      userize(p); draggingPanel = true; act(p, g.mode); if (!g.held) { g.held = true; p.lift = 22; p.hold = g.mode === "rot" ? null : { x: -g.gy * 2.2 - .6, y: g.gx * 3 }; el.classList.add("tr2"); apply(p); setTimeout(() => { if (h._g === g) el.classList.remove("tr2"); }, 200); } if (g.mode === "roll") { p.st.rz = clamp((p.st.rz || 0) + dx * .22, -35, 35); badge(p, "ميل " + Math.round(p.st.rz) + "°"); } else if (g.mode === "depth") { p.st.z = clamp(p.st.z - dy * 1.15, ZMIN, ZMAX); badge(p, "عمق " + Math.round(p.st.z)); } else if (g.mode === "move") { const f = persp(p.st.z + (focused === p.id ? 40 : 0)); p.st.x += dx / f; p.st.y += dy / f; { const m = magnetFor(p); if (m) { const k = (1 - m.d / SLOT_R) * .18; p.st.x += (m.c.x - p.st.x) * k; p.st.y += (m.c.y - p.st.y) * k; } ghost(p, m); } p.bk = { y: clamp(((p.bk && p.bk.y) || 0) * .5 + dx * .45, -9, 9), x: clamp(((p.bk && p.bk.x) || 0) * .5 - dy * .35, -7, 7) }; } else { p.st.ry = clamp(p.st.ry + dx * .35 * (1 - Math.abs(p.st.ry) / 75), -34, 34); p.st.rx = clamp(p.st.rx - dy * .3 * (1 - Math.abs(p.st.rx) / 65), -26, 26); badge(p, "⟲ " + Math.round(p.st.ry) + "° / " + Math.round(p.st.rx) + "°"); } if (g.mode === "move") dismissHint(p, g); apply(p); };
    h.addEventListener("pointermove", hmove);
    const up = e => { const g = h._g; if (!g || g.id !== e.pointerId) return; h._g = null; if (g.off) g.off(); draggingPanel = false; el.classList.remove("dragging");
      if (g.moved < 6 && performance.now() - g.t0 < 450) { /* نقرة (لا سحب) */ el.classList.remove("tr2"); lift0(p); if (g.dbl) { tapUp = 0; toggleBig(p); return; } tapUp = performance.now(); tapX = e.clientX; act(p, ""); if (p.big) return; }
      if (p.big) { act(p, ""); lift0(p); return; } lastPanelDrag = performance.now(); act(p, ""); dropHold(p, g.mode); if (g.mode === "roll") { badge(p, ""); settleRoll(p); return; } if (g.mode === "depth") { const vz = zIntent(g.s); if (Math.abs(vz) > .05) zglide(p, vz); else { badge(p, ""); resolve(p); } return; } if (g.mode === "rot") { const s = g.s, n = s.length; let wy = 0, wx = 0; if (n >= 2) { const a = s[0], b = s[n - 1], dt = Math.max(1, b[0] - a[0]); wy = (b[1] - a[1]) / dt * .3; wx = -(b[2] - a[2]) / dt * .25; } if (Math.hypot(wy, wx) > .03) spin(p, wy, wx); else settleRot(p); return; } p.bk = null; el.classList.add("tr2"); setTimeout(() => el.classList.remove("tr2"), 400); g.s.push([performance.now(), e.clientX, e.clientY]); release(p, g); };
    h.addEventListener("pointerup", up);
    /* pointercancel على اللمس = المتصفح استلم الإيماءة (كروم أندرويد/سفاري آيفون): لا ننهي السحب بل نكمله بأحداث اللمس (g.tc) */
    h.addEventListener("pointercancel", e => { const g = h._g; if (g && g.id === e.pointerId && e.pointerType === "touch") { g.tc = true; return; } up(e); });
    /* تحجيم بمقبض الزاوية */
    rs.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); cancelGlide(p); el.classList.remove("tr", "tr2"); el.classList.add("dragging"); rs._g = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { rs.setPointerCapture(e.pointerId); } catch (_) { } focus(p.id); selectObj(p.id); act(p, "resize"); });
    rs.addEventListener("pointermove", e => { const g = rs._g; if (!g || g.id !== e.pointerId) return; const f = persp(p.st.z) * p.st.s, dx = (e.clientX - g.x) / f, dy = (e.clientY - g.y) / f; g.x = e.clientX; g.y = e.clientY; const nw = clamp(p.st.w - dx, 300, Math.min(920, W() - 16)), nh = clamp(p.st.h + dy, 240, Math.min(720, H() - 60)), dw = nw - p.st.w, dh = nh - p.st.h; userize(p); p.st.w = nw; p.st.h = nh; p.st.x -= dw * p.st.s / 2; p.st.y += dh * p.st.s / 2; badge(p, Math.round(nw) + "×" + Math.round(nh)); apply(p); });
    const rsUp = e => { if (rs._g) { rs._g = null; act(p, ""); el.classList.remove("dragging"); badge(p, ""); lastPanelDrag = performance.now(); resolve(p); } }; rs.addEventListener("pointerup", rsUp); rs.addEventListener("pointercancel", rsUp);
    /* عجلة الفأرة: تكبير اللوح (إلا إن كان المحتوى قابلاً للتمرير) */
    el.addEventListener("wheel", e => { if (e.shiftKey) { e.preventDefault(); userize(p); const d = e.deltaY || e.deltaX; p.st.z = clamp(p.st.z + (d < 0 ? 34 : -34), ZMIN, ZMAX); p.el.classList.add("tr2"); apply(p); badge(p, "عمق " + Math.round(p.st.z)); clearTimeout(p._bt); p._bt = setTimeout(() => { badge(p, ""); p.el.classList.remove("tr2"); }, 700); return; } const b = e.target.closest(".pn-b"); if (b && !e.ctrlKey && b.scrollHeight > b.clientHeight + 2) return; e.preventDefault(); userize(p); p.st.s = clamp(p.st.s * (e.deltaY < 0 ? 1.06 : .943), .5, 1.9); apply(p); }, { passive: false });
    /* قرص + التواء بإصبعين مع تغذية بصرية (يعود الالتواء تلقائياً لتبقى القراءة سهلة)؛ دوال بدء/حركة/نهاية تأخذ نقاطاً فيُعاد استعمالها للمس داخل الإطار الحقيقي (iframe) بإحداثيات الشاشة */
    let pd = 0, ps = 1, a0 = 0, rz0 = 0; const ang2 = t => Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]) * 180 / Math.PI, dist2 = t => Math.hypot(t[0][0] - t[1][0], t[0][1] - t[1][1]), pts = e => [...e.touches].slice(0, 2).map(t => [t.clientX, t.clientY]);
    const pStart = t => { pd = dist2(t) || 1; ps = p.st.s; a0 = ang2(t); rz0 = p.st.rz || 0; cancelGlide(p); el.classList.remove("tr", "tr2"); el.classList.add("gest"); selectObj(p.id); act(p, "pinch"); };
    const pMove = t => { let da = ang2(t) - a0; da = ((da + 540) % 360) - 180; userize(p); p.st.s = clamp(ps * dist2(t) / pd, .5, 1.9); p.st.rz = clamp(rz0 + da, -22, 22); badge(p, "×" + p.st.s.toFixed(2) + "  ↻ " + Math.round(p.st.rz) + "°"); apply(p); };
    const pEnd = () => { pd = 0; el.classList.remove("gest"); act(p, ""); badge(p, ""); lastPanelDrag = performance.now(); settleRz(p); resolve(p); };
    el.addEventListener("touchstart", e => { if (e.touches.length === 2) pStart(pts(e)); }, { passive: true });
    el.addEventListener("touchmove", e => { if (e.touches.length === 2 && pd) { e.preventDefault(); pMove(pts(e)); } }, { passive: false });
    el.addEventListener("touchend", e => { if (e.touches.length < 2 && pd) pEnd(); }, { passive: true });
    p.pinch = { start: pStart, move: pMove, end: pEnd, active: () => !!pd };
    /* لوحة المفاتيح: أسهم = تحريك، Alt+أسهم = إمالة، PageUp/PageDown = عمق، Home = عودة للمدار، Delete = رمي مع تلاشٍ */
    el.addEventListener("keydown", e => { const tg = e.target; if (/INPUT|TEXTAREA/.test(tg.tagName || "") || !(tg === el || (tg.closest && tg.closest(".pn-h")))) return; const k = String(e.key || ""), d = e.shiftKey ? 64 : 26; let used = true;
      if (/^Arrow/.test(k)) { userize(p); cancelGlide(p); if (e.altKey) { p.st.ry = clamp(p.st.ry + (k === "ArrowRight" ? 4 : k === "ArrowLeft" ? -4 : 0), -24, 24); p.st.rx = clamp(p.st.rx + (k === "ArrowUp" ? 3 : k === "ArrowDown" ? -3 : 0), -18, 18); } else { p.st.x += k === "ArrowRight" ? d : k === "ArrowLeft" ? -d : 0; p.st.y += k === "ArrowDown" ? d : k === "ArrowUp" ? -d : 0; } p.el.classList.add("tr2"); apply(p); setTimeout(() => p.el.classList.remove("tr2"), 300); }
      else if (k === "PageUp" || k === "PageDown") { userize(p); p.st.z = clamp(p.st.z + (k === "PageUp" ? 34 : -34), ZMIN, ZMAX); p.el.classList.add("tr2"); apply(p); badge(p, "عمق " + Math.round(p.st.z)); clearTimeout(p._bt); p._bt = setTimeout(() => { badge(p, ""); p.el.classList.remove("tr2"); }, 700); }
      else if (k === "Home") { if (!snapOrbit(p, true)) { if (p.frame) homeFrame(p); else arrange(); } }
      else if (k === "Delete" || k === "Backspace") { p.pre = null; const n = Math.hypot(p.st.x, p.st.y) || 1; throwAway(p, (p.st.x || 1) / n * 1.6, p.st.y / n * 1.6); }
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
    hov = 0; act(p, ""); setState(p, "dismissing"); remember(p, p.pre); const id = p.id; open.delete(id); if (window.SpatialHub) SpatialHub.detach(id); if (focused === id) focused = null; if (objSel === id) objSel = bigSel(id); syncMode(); if (objSel && open.get(objSel)) focus(objSel); markNodes(); select(id); setTimeout(() => arrange(), 60); p.el.classList.remove("tr", "tr2"); let last = performance.now(), op = 1, burst = false, acc = 1; const sp = Math.max(.9, Math.hypot(vx, vy)), k = Math.min(2.2, 1.4 / sp * 1) || 1; cancelGlide(p); p.el.classList.add("dragging");
    const step = t => { const dt = Math.min(250, t - last); last = t; acc *= Math.pow(1.05, dt / 16); /* يتسارع نحو الخارج */ p.st.x += vx * dt * 1.15 * k * 1.4 * acc / persp(p.st.z); p.st.y += vy * dt * 1.15 * k * 1.4 * acc / persp(p.st.z); p.st.s *= Math.pow(.965, dt / 16); p.st.ry += vx * dt * .05; op -= dt / 520; p.el.style.setProperty("--op", Math.max(0, op).toFixed(2)); apply(p);
      if (!burst && op < .55) { burst = true; const r = p.el.getBoundingClientRect(); FX.dissolve(r, null); }
      if (op > 0) requestAnimationFrame(step); else p.el.remove(); };
    requestAnimationFrame(step);
  }
  function dismiss(id, how) {
    const p = open.get(id); if (!p) return; hov = 0; act(p, ""); if (objSel === id) objSel = bigSel(id); const to = nodePos(id); p.el.classList.remove("tr"); p.el.classList.add("tr2"); p.keep = Object.assign({}, p.st);
    if (focused === id) focused = null; Object.assign(p.st, { x: to.x * .35, y: to.y * .35, z: -380, s: .1 }); apply(p); p.el.style.setProperty("--op", 0);
    const r = p.el.getBoundingClientRect(); if (how === "close") { lqDrop(p); setState(p, "dismissing"); remember(p, p.keep); open.delete(id); if (window.SpatialHub) SpatialHub.detach(id); FX.dissolve(r, "43,228,255"); setTimeout(() => p.el.remove(), 420); } else { p.min = true; if (p._lq === "queued") { LQ.q = LQ.q.filter(x => x !== p); p._lq = "held"; } if (window.SpatialHub) SpatialHub.setVisible(id, false); suspendPanel(p); setState(p, "minimized"); p.scroll = p.body.scrollTop; setTimeout(() => { if (p.min) p.el.style.display = "none"; }, 420); }
    markNodes(); select(id); setTimeout(() => arrange(), 60); syncMode();
  }
  /* النافذة الكبيرة: لوح اللوحة الحقيقية على المكتب يملأ الشاشة تحت الشريط العلوي (عمق 0، وعامل 0.973 لارتفاع المُركَّز)؛ غير ذلك كما اعتُمد */
  function bigBox(p) { const full = !!p.frame && !isMob(), fk = .973; return { full, w: full ? Math.floor(Math.min(W() - 24, 1900) * fk) : Math.min(920, W() - 24), h: full ? Math.floor((H() - 84) * fk) : Math.min(660, H() - 92), y: isMob() ? -6 : (full ? 20 : -10), z: full ? 0 : 110 }; }
  /* محتوى اللوح الحقيقي بحجمه الطبيعي: عرض منطقي ثابت ≈1100px (تخطيط المكتب) يُقاس بنسبة عرض النافذة (zoom = العرض/1100 بين 0.55 و1.6) — فالبطاقة الصغيرة تعرض الواجهة كاملة مصغّرة لا مكبّرة، والنافذة الكبيرة تكبّر محتواها؛ الهاتف 1 */
  function frameZoom(p) { if (!p.frame || !p.fr) return; try { const d = p.fr.contentDocument; if (!d || !d.documentElement) return; const k = isMob() || /[?&]nozoom=1/.test(location.search) ? 1 : Math.max(.55, Math.min(1.6, p.st.w / 1100)); d.documentElement.style.zoom = Math.abs(k - 1) < .01 ? "" : k.toFixed(3); p.zoomK = Math.abs(k - 1) < .01 ? 1 : +k.toFixed(3); p._zw = p.st.w; } catch (_) { } }
  function toggleBig(p) {
    p.el.classList.remove("tr"); p.el.classList.add("tr2"); focus(p.id);
    if (!p.big) { p.prev = Object.assign({}, p.st); const bb = bigBox(p); Object.assign(p.st, { x: 0, y: bb.y, z: bb.z, rx: 0, ry: 0, rz: 0, s: 1, w: bb.w, h: bb.h }); p.big = true; setState(p, "expanded"); setLayer(p, false); p.el.style.setProperty("--op", 1); p.el.style.zIndex = ++zc; }
    else { Object.assign(p.st, p.prev); p.big = false; setState(p, focused === p.id ? "focused" : "floating"); }
    p.el.classList.toggle("is-big", p.big); const top = p.body.scrollTop; render(p); p.body.scrollTop = top; apply(p); frameZoom(p); setTimeout(() => p.el.classList.remove("tr2"), 420); objSel = p.id; va = 0; syncMode();
  }
  /* منع التراكب: إزاحة اللوح الساقط عن لوح يخفي أكثر من 35% + مغناطيس لأقرب موضع حرّ */
  function resolve(p) {
    if (p.big) return; const me = rectOf(p); let moved = false;
    open.forEach(o => { if (o === p || o.min || o.big) return; const r = overlap(me, rectOf(o)); if (r && r.a > .35 * Math.min(me.w * me.h, rectOf(o).w * rectOf(o).h)) { if (r.ox < r.oy) p.st.x += (me.x >= o.st.x ? 1 : -1) * (r.ox + 14); else p.st.y += (me.y >= o.st.y ? 1 : -1) * (r.oy + 14); moved = true; me.x = p.st.x; me.y = p.st.y; } });
    const mx = W() / 2 - me.w / 3, my = H() / 2 - me.h / 3; p.st.x = clamp(p.st.x, -mx, mx); p.st.y = clamp(p.st.y, yTop(me.h * (p.st.s || 1)), my);
    if (!moved) { const near = layoutFor(6).find(c => Math.hypot(c.x - p.st.x, c.y - p.st.y) < (isMob() ? 55 : 85) && slotFree(p, c)); if (near) { Object.assign(p.st, { x: near.x, y: near.y }); moved = true; }   /* المغناطيس موضعي فقط: لا يمسّ العمق ولا الإمالة التي ضبطها المستخدم */ }
    p.el.classList.add("tr2"); apply(p); setTimeout(() => p.el.classList.remove("tr2"), 420);
  }
  function setFlat(v, keep) { FLAT = !!v; if (!keep) { try { localStorage.setItem("sc_flat", FLAT ? "1" : "0"); } catch (_) { } } const b = $("#hud-flat"); if (b) { b.setAttribute("aria-pressed", String(FLAT)); b.classList.toggle("on", FLAT); b.textContent = FLAT ? "زاوية 0: مفعّلة" : "زاوية 0"; } }
  { const fb = $("#hud-flat"); if (fb) fb.addEventListener("click", () => setFlat(!FLAT)); setFlat(FLAT, true); }
  core.addEventListener("click", () => { const notReady = () => { hint("LAURA قيد الإعداد ولم تُفعَّل على الخادم بعد"); pulse("ai"); }; if (REAL && window.Laura) { const L = Laura, st = L.state(); if (L.ready || L.open) { L.toggle(); return; } if (st.ready === null) { L.probe().then(r => { if (r) L.show(); else if (APIREAL) legacyCore(); else notReady(); }); return; } if (!APIREAL) { notReady(); return; } } else if (REAL && !APIREAL) { notReady(); return; } legacyCore(); }); function legacyCore() { openSection("ai"); const q = open.get("ai"); if (REAL && q && q.frame && q.frame.tab === "ask") { hint("تكلّم بعد أن يضيء الميكروفون، أو اكتب سؤالك"); if (q.frDone) { try { const m = q.fr.contentDocument.getElementById("ah-mic"); if (m && !m.classList.contains("on")) m.click(); } catch (_) { } } else q.autoMic = true; } } document.body.classList.toggle("orbit-on", orbitMode);
  function setOrbit(on) { orbitMode = on && !isMob(); document.body.classList.toggle("orbit-on", orbitMode); const bt = $("#hud-orbit"); if (bt) { bt.textContent = orbitMode ? "المدار: يعمل" : "المدار: متوقف"; bt.setAttribute("aria-pressed", orbitMode); }
    if (!orbitMode) { open.forEach(p => { setLayer(p, false); p.el.classList.remove("back"); p.el.style.setProperty("--op", 1); p.el.style.zIndex = ++zc; }); arrange(); } else open.forEach(p => { p.off = null; }); }
  $("#hud-orbit").addEventListener("click", () => setOrbit(!orbitMode));
  $("#hud-reset").addEventListener("click", () => { open.forEach(p => { p.user = false; p.el.classList.remove("free", "is-big"); p.big = false; const s = sizeFor(p.sec); p.st.w = s.w; p.st.h = s.h; p.off = null; }); if (orbitMode) { pt = null; } arrange(); });
  let vw0 = W(), vh0 = H();
  /* عند تغيير حجم النافذة: تُحفظ المواضع النسبية للألواح الحرة (والمدار يُعاد حسابه من الأبعاد الجديدة) */
  addEventListener("resize", () => { const kx = W() / vw0, ky = H() / vh0; vw0 = W(); vh0 = H();
    open.forEach(p => { if (p.min) return; if (p.big) { const bb = bigBox(p); Object.assign(p.st, { w: bb.w, h: bb.h, y: bb.y }); frameZoom(p); } else { if (isMob()) { const m = sizeFor(p.sec); p.st.w = m.w; p.st.h = m.h; } if (!orbitMode || p.user) { p.st.x *= kx; p.st.y *= ky; } } apply(p); });
    if (!orbitMode) arrange(); });
  window.SpatialOS = { spare: { get ready() { return SP.ready; }, get frame() { return SP.f; }, get count() { return SP.n; }, get supported() { return !SP.off; }, get extra() { return EXT.map(e => ({ tab: e.tab, ready: e.ready })); }, make: spareMake }, get tab() { return curTab; }, selectTab, navSync, navTo: id => navInPlace(id), relayout: () => { [...open.values()].forEach(p => { if (p.frame && !p.min) { if (PHR()) { placeFrame(p); } apply(p); frameZoom(p); } }); bumpWorld(); }, get lang() { return window.SpatialI18n ? SpatialI18n.lang : "ar"; }, groups: () => GROUPS, ring: () => RING.slice(), secName: id => { const s = SEC.find(x => x.id === id); return s ? s.name : id; }, minimizeAll: () => { [...open.values()].forEach(q => { if (!q.min) dismiss(q.id, "min"); }); }, activeId: () => { const q = [...open.values()].filter(x => x.frame && !x.min).pop(); return q ? q.id : null; }, laura: () => core.click(), get two() { return TWO; }, subIds: () => subIds.slice(), setSpin: v => { spinT = clamp(+v || 0, 0, 1); }, get spin() { return spinK; }, get spinTarget() { return spinT; }, stateLog: () => stLog.slice(), stateOf: id => { const p = open.get(id); return p ? p.state : null; }, setYaw, get yaw() { return yaw; }, open: openSection, spinTo, select, snapOrbit, memo, get selected() { return sel; }, setOrbit, get orbit() { return orbitMode; }, get pa() { return pa; }, get tweening() { return !!pt; }, panels: open, dismiss, get angle() { return ang; }, set angle(v) { ang = v; }, get focused() { return focused; }, refreshAll, get mode() { return modeOf(); }, get real() { return REAL; }, get apiReal() { return APIREAL; }, get flat() { return FLAT; }, get flatK() { return flatK; }, setFlat, tileAll, toCylinder, restoreAll, snapFrame, slots: () => layoutFor(6).map(c => ({ x: c.x, y: c.y })), get objSel() { return objSel; }, get tool() { return tool; }, setTool, clearSel, selectObj, toObject, toFocus, world: () => ({ angle: ang, yaw, pa, va, tw: !!tw, pt: !!pt }) };
  /* وضع خفيف تلقائي: إن هبط معدل الإطارات تحت 22 لثلاث قياسات متتالية تُعطَّل الزخارف الثقيلة (محتوى بطاقات الجدار، طبقات سُمك الألواح، الأرضية الكبيرة) فتخفّ النوافذ */
  { let c = 0, t0 = performance.now(), bad = 0; const tickL = () => { c++; requestAnimationFrame(tickL); }; requestAnimationFrame(tickL); setInterval(() => { if (document.hidden) { c = 0; t0 = performance.now(); return; } const now = performance.now(), fps = c * 1000 / (now - t0); c = 0; t0 = now; if (document.body.classList.contains("lite") || (navigator.webdriver && !/[?&]lite=1/.test(location.search))) return; bad = fps < 22 ? bad + 1 : 0; if (bad >= 3) { document.body.classList.add("lite"); window.__lite = Math.round(fps); } }, 2000); }
  /* ───── ترتيب العالم والنوافذ يُحفظ ويُستعاد بعد إعادة التحميل (laura-dev) ─────
     المحفوظ: الدوران (yaw) والمجموعة المحددة والنافذة المركَّزة، ولكل نافذة حقيقية: موضعها/حجمها/تكبيرها/تصغيرها ولقطة (تبويب/تمرير/مرشحات).
     الاستعادة: النافذة المركَّزة تُفتح وتُحمَّل، والباقي يعود مصغَّراً بلا تحميل إطاره (يُحمَّل عند النقر على عقدته). ?norestore=1 يعطّلها. حالة العالم منفصلة عن حالة النوافذ: لا إعادة بناء للعالم. */
  const LAYK = "sc_layout_v1", LAZY = new Set(); let layLast = "";
  const layoutNow = () => ({ v: 1, yaw: Math.round(yaw), tab: curTab, focus: focused, panels: [...open.values()].filter(p => p.frame && FRAME[p.id]).map(p => { const q = p.big && p.prev ? p.prev : p.st, w = q.w, h = q.h; try { snapFrame(p); } catch (_) { } return { id: p.id, st: { x: Math.round(q.x), y: Math.round(q.y), z: Math.round(q.z || 0), rx: +(q.rx || 0).toFixed(1), ry: +(q.ry || 0).toFixed(1), rz: +(q.rz || 0).toFixed(1), s: +(q.s || 1).toFixed(3), w: Math.round(w), h: Math.round(h) }, big: !!p.big, min: !!p.min, fs: (p.content && p.content.fs) || null }; }) });
  function saveLayout() { if (!REAL) return; try { const s = JSON.stringify(layoutNow()); if (s !== layLast) { layLast = s; localStorage.setItem(LAYK, s); } } catch (_) { } }
  setInterval(() => { if (!document.hidden) saveLayout(); }, 1500); addEventListener("pagehide", saveLayout); document.addEventListener("visibilitychange", () => { if (document.hidden) saveLayout(); });
  function restoreLayout() {
    if (/[?&](norestore|autoopen)=/.test(location.search)) return false; let L = null; try { L = JSON.parse(localStorage.getItem(LAYK) || "null"); } catch (_) { }
    if (!L || L.v !== 1 || !Array.isArray(L.panels) || !L.panels.length) return false;
    const ps = L.panels.filter(q => q && FRAME[q.id] && q.st).slice(0, 4); if (!ps.length) return false;
    try { if (L.yaw) setYaw(+L.yaw || 0); if (L.tab && ring.some(s => s.id === L.tab)) selectTab(L.tab); } catch (_) { }
    ps.forEach(q => { const s = q.st; memo[q.id] = { pos: { x: s.x, y: s.y, z: s.z, rx: s.rx, ry: s.ry, rz: s.rz, s: s.s }, content: { fs: q.fs || null }, size: { w: s.w, h: s.h } }; });
    const first = ps.find(q => q.id === L.focus && !q.min) || ps.find(q => !q.min) || null;
    ps.forEach(q => { if (q !== first) LAZY.add(q.id); });
    ps.forEach((q, i) => setTimeout(() => { try { openSection(q.id); if (q !== first) dismiss(q.id, "min"); else if (q.big) { const p = open.get(q.id); if (p && !p.big) setTimeout(() => toggleBig(p), 400); } } catch (_) { } }, 200 + i * 350));
    return true;
  }
  if (isMob()) { document.body.classList.add("lite"); document.body.classList.add("phone"); /* هاتف: وضع خفيف دائماً وألواح مسطّحة تواجه الشاشة */ } mbXp = false; syncMode(); detectReal().then(r => { REAL = r.real; APIREAL = r.api; if (r.real && !r.api) FRAME.ai = { tab: "ask", w: 480, h: 560 }; /* بلا واجهة PHP: النقر على الكرة يفتح «اسألني» الحقيقي (فيه الميكروفون) بدل وكيل لا يعمل */ document.body.classList.toggle("real", r.real); if (r.real) { if (isMob()) setFlat(true, true); enableTwo(); document.dispatchEvent(new Event("sc-real")); spareSoon(500); } /* الوضع الحقيقي على المكتب: بلا لوح تلقائي — بطاقات الرئيسية تظهر فوراً ولوح الطلبات يُفتح بنقرة (فوري من اللوح الاحتياطي) */ const restored = r.real && restoreLayout(); if (!restored && (!(r.real && !isMob() && innerWidth >= 1100) || /[?&]autoopen=1/.test(location.search))) setTimeout(() => openSection("ord"), 700); });
})();
