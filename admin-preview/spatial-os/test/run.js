/* اختبار تفاعلات Spatial OS (معاينة معزولة). التشغيل:
   python3 -m http.server 8765   (من جذر المشروع)  ثم:
   NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/run.js [desktop|mobile|all]
   كل سطر: PASS/FAIL + [الطريقة]. «mouse» فأرة حقيقية عبر Playwright، «cdp-touch» لمس حقيقي عبر CDP،
   «synthetic» أحداث Pointer مُنشأة برمجياً (لا تثبت سلوك إصبع حقيقي)، «api» قراءة حالة التطبيق. */
const { chromium } = require("playwright"); const URL = process.env.URL || "http://localhost:8765/admin-preview/spatial-os/index.html"; const only = process.argv[2] || "all";
const R = []; let fails = 0; const ok = (n, c, m, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + "[" + m + "] " + n + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 150) : "")); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function section(name, fn) { R.push("── " + name); try { await fn(); } catch (e) { fails++; R.push("FAIL [crash] " + name + ": " + String(e).split("\n")[0].slice(0, 160)); } }

async function desktop(b) {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await c.newPage(), errs = []; p.setDefaultTimeout(6000);
  p.on("pageerror", e => errs.push(String(e).slice(0, 160)));
  await p.goto(URL); await p.waitForTimeout(1500);
  const S = () => p.evaluate(() => { const o = {}; SpatialOS.panels.forEach((q, id) => { const r = q.el.getBoundingClientRect(); o[id] = { st: { ...q.st }, min: q.min, big: q.big, user: q.user, back: !!q.inBack, z: +q.el.style.zIndex, op: +q.el.style.opacity, box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] }; }); return { o, pa: SpatialOS.pa, orbit: SpatialOS.orbit, sel: SpatialOS.selected }; });
  const hdr = async id => { const n = await p.evaluate(i => SpatialOS.panels.get(i).sec.name, id); return (await p.$(`.panel[aria-label="${n}"] .pn-h h3`)).boundingBox(); };
  const settle = () => p.waitForFunction(() => !SpatialOS.tweening, null, { timeout: 15000 }).catch(() => { });
  const drag = async (x0, y0, x1, y1, n = 10, d = 35) => { await p.mouse.move(x0, y0); await p.mouse.down(); for (let i = 1; i <= n; i++) { await p.mouse.move(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); await p.waitForTimeout(d); } await p.mouse.up(); };
  await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(700);

  await section("A. الاسطوانة والملاحة", async () => {
    await p.mouse.move(700, 850); const a0 = (await S()).pa; await drag(600, 820, 900, 820, 12, 25); await p.waitForTimeout(300);
    ok("سحب الخلفية يدوّر الاسطوانة (والمدار معها)", Math.abs((await S()).pa - a0) > 15, "mouse", [a0, (await S()).pa]);
    { const nb0 = await p.evaluate(() => { const n = [...document.querySelectorAll(".node")].sort((x, y) => y.style.zIndex - x.style.zIndex)[0], q = n.getBoundingClientRect(); return { id: n.dataset.id, x: q.left + q.width / 2, y: q.top + q.height / 2 }; }), g0 = await p.evaluate(() => SpatialOS.angle);
      await p.mouse.move(nb0.x, nb0.y); await p.mouse.down(); for (let i = 1; i <= 10; i++) { await p.mouse.move(nb0.x + i * 20, nb0.y); await p.waitForTimeout(30); } await p.mouse.up(); await p.waitForTimeout(500);
      ok("السحب يدوّر الاسطوانة حتى لو بدأ فوق عقدة قسم", Math.abs((await p.evaluate(() => SpatialOS.angle)) - g0) > 15, "mouse"); ok("ولا يفتح لوح القسم بالخطأ بعد السحب", !(await S()).o[nb0.id], "mouse");
      const co = await (await p.$("#core")).boundingBox(), g1 = await p.evaluate(() => SpatialOS.angle); await p.mouse.move(co.x + co.width / 2, co.y + co.height / 2); await p.mouse.down(); for (let i = 1; i <= 10; i++) { await p.mouse.move(co.x + co.width / 2 - i * 20, co.y + co.height / 2); await p.waitForTimeout(30); } await p.mouse.up(); await p.waitForTimeout(500);
      ok("السحب يدوّر الاسطوانة حتى لو بدأ فوق زر المركز (ولا يفتح المساعد)", Math.abs((await p.evaluate(() => SpatialOS.angle)) - g1) > 15 && !(await S()).o.ai, "mouse"); }
    const ang0 = await p.evaluate(() => SpatialOS.angle);
    await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); await p.keyboard.press("ArrowRight"); await p.waitForTimeout(1800); const a1 = await p.evaluate(() => ({ ang: SpatialOS.angle, sel: SpatialOS.selected }));
    ok("سهم لوحة المفاتيح يحدّد القسم التالي ويدوّر الاسطوانة", !!a1.sel && Math.abs(a1.ang - ang0) > 5, "keyboard", a1);
    const hl = await p.evaluate(() => { const n = document.querySelector(".node.sel"); return n && n.dataset.id; }); ok("القسم المحدَّد مظلَّل (.sel)", hl === a1.sel, "api", hl);
    await p.waitForTimeout(1800); const front = await p.evaluate(() => { let best = null, bz = -1e9; document.querySelectorAll(".node").forEach(n => { const z = +n.style.zIndex; if (z > bz) { bz = z; best = n.dataset.id; } }); return best; });
    ok("القسم المحدَّد مُحاذى نحو المستخدم (أقرب عقدة)", front === a1.sel, "api", [front, a1.sel, await p.evaluate(() => [SpatialOS.angle, [...document.querySelectorAll(".node")].map(n => n.dataset.id + ":" + n.style.zIndex).join(" ")])]);
    await p.keyboard.press("Enter"); await p.waitForTimeout(1500); ok("Enter يفتح القسم المحدَّد", !!(await S()).o[a1.sel], "keyboard");
    await p.evaluate(id => SpatialOS.dismiss(id, "close"), a1.sel); await p.waitForTimeout(800);
    await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await p.keyboard.press("Tab"); const fo = await p.evaluate(() => ({ tag: document.activeElement.tagName, cls: document.activeElement.className })); ok("Tab ينقل التركيز إلى أزرار تفاعلية", /BUTTON/.test(fo.tag), "keyboard", fo);
    await settle(); const nb = await p.evaluate(() => { const n = [...document.querySelectorAll(".node")].sort((a, b) => b.style.zIndex - a.style.zIndex)[0]; const r = n.getBoundingClientRect(); return { id: n.dataset.id, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.click(nb.x, nb.y); await p.waitForTimeout(1600); const s2 = await S(); ok("نقر عقدة مدارية يحدّدها ويفتح لوحها", s2.sel === nb.id && !!s2.o[nb.id], "mouse", [s2.sel, Object.keys(s2.o)]);
    await p.evaluate(id => SpatialOS.dismiss(id, "close"), nb.id); await p.waitForTimeout(700);
  });

  await section("A2. بطاقات الجدران الحقيقية (الجانبان)", async () => {
    const fl = await p.evaluate(() => { const c = document.getElementById("floorcv"), r = c.getBoundingClientRect(), d = c.getContext("2d").getImageData(1024, 1500, 1, 1).data, cc = c.getContext("2d").getImageData(1024, 1024, 1, 1).data, co = document.getElementById("core").getBoundingClientRect(); return { w: Math.round(r.width), cx: Math.round(r.left + r.width / 2), px: [d[3], cc[3]], coreCx: Math.round(co.left + co.width / 2) }; });
    ok("أرضية لامعة مرسومة (بلاط/أشعة/حلقات/منصة/خطوط ضوء) في لوحة واحدة، ومركزها تحت الاسطوانة", fl.w > 1500 && Math.abs(fl.cx - fl.coreCx) < 40 && fl.px[0] > 0 && fl.px[1] > 200, "api", fl);
    const n = await p.evaluate(() => ({ l: document.querySelectorAll(".wall.l .wcard").length, r: document.querySelectorAll(".wall.r .wcard").length, bl: document.querySelectorAll(".wall.bl .wcard").length, br: document.querySelectorAll(".wall.br .wcard").length, txt: [...document.querySelectorAll(".wcard")].every(c => c.querySelector(".wb").textContent.trim().length > 15) }));
    ok("9 بطاقات على كل جانب + 9 في كل مجموعة خلفية، بمحتوى فعلي لا زينة", n.l === 9 && n.r === 9 && n.bl === 9 && n.br === 9 && n.txt, "api", n);
    const bg = await p.evaluate(() => { const c = document.querySelector(".wcard"), s = getComputedStyle(c); return { bd: s.backdropFilter, a: /rgba\(.*0?\.\d+\)/.test(s.backgroundImage) }; }); ok("البطاقات شفافة (خلفية متدرّجة نصف شفافة)", bg.a, "api", bg);
    const dash = await p.evaluate(() => document.querySelector('.wcard[data-id="dash"] .wb').textContent); ok("بطاقة لوحة التحكم تعرض أرقام البيانات الفعلية (بانتظار التأكيد/الإيراد)", /بانتظار التأكيد/.test(dash) && /\d/.test(dash), "api");
    const bb = await p.evaluate(() => { const c = document.querySelector('.wcard[data-id="inv"]'), r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const hit = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.closest(".wcard") && e.closest(".wcard").dataset.id; }, bb); ok("بطاقة الجدار قابلة للنقر في الفضاء ثلاثي الأبعاد", !!hit, "api", hit);
    await p.mouse.click(bb[0], bb[1]); await p.waitForTimeout(1600); const sid = hit && (await S()).o[hit]; ok("النقر على بطاقة جانبية يفتح لوح القسم الكامل", !!sid, "mouse", hit);
    if (hit) { await p.evaluate(i => SpatialOS.dismiss(i, "close"), hit); await p.waitForTimeout(700); }
    const g0 = await p.evaluate(() => SpatialOS.angle); const wc = await p.evaluate(() => { const c = [...document.querySelectorAll('.wall.r .wcard')].map(e => e.getBoundingClientRect()).find(r => r.left + r.width / 2 > 1000 && r.left + r.width / 2 < 1380 && r.top > 40); return [c.left + c.width / 2, c.top + c.height / 2]; });
    await p.mouse.move(wc[0], wc[1]); await p.mouse.down(); for (let i = 1; i <= 10; i++) { await p.mouse.move(wc[0] - i * 20, wc[1]); await p.waitForTimeout(30); } await p.mouse.up(); await p.waitForTimeout(500);
    ok("السحب فوق بطاقة جانبية يدوّر الاسطوانة ولا يفتحها", Math.abs((await p.evaluate(() => SpatialOS.angle)) - g0) > 15 && Object.keys((await S()).o).length === 0, "mouse", [g0, await p.evaluate(() => SpatialOS.angle), Object.keys((await S()).o), wc]);
    const p0 = await p.evaluate(() => document.querySelector('.wcard[data-id="dash"] .wb').textContent.match(/بانتظار التأكيد\s*(\d+)/)); await p.evaluate(() => { SpatialOS.setOrbit(false); SpatialOS.open("ord"); }); await p.waitForTimeout(1500);
    await p.click('.panel[aria-label="الطلبات"] [data-ok]'); await p.waitForTimeout(500); const p1 = await p.evaluate(() => document.querySelector('.wcard[data-id="dash"] .wb').textContent.match(/بانتظار التأكيد\s*(\d+)/));
    ok("بطاقة الجدار تتحدّث حيّةً عند تأكيد طلب في لوح الطلبات", p0 && p1 && +p1[1] === +p0[1] - 1, "mouse", [p0 && p0[1], p1 && p1[1]]); await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(700);
  });

  await section("B. سحب وتدوير وتحجيم اللوح", async () => {
    await p.evaluate(() => SpatialOS.setOrbit(false)); await p.evaluate(() => SpatialOS.open("ord")); await p.waitForTimeout(1500);
    let h = await hdr("ord"); const s0 = (await S()).o.ord.st; await drag(h.x + h.width / 2, h.y + 10, h.x + h.width / 2 - 60, h.y + 60, 10, 40); await p.waitForTimeout(500);
    let s = (await S()).o.ord.st; ok("سحب اللوح بالفأرة يحرّكه في الفضاء", Math.hypot(s.x - s0.x, s.y - s0.y) > 30, "mouse", [s0.x, s0.y, s.x, s.y]);
    const ry0 = s.ry, rb = await (await p.$(`.panel[aria-label="الطلبات"] .pn-rot`)).boundingBox(); await drag(rb.x + 14, rb.y + 14, rb.x + 94, rb.y + 38, 8, 35); await p.waitForTimeout(300);
    s = (await S()).o.ord.st; ok("تدوير اللوح بمقبض ⟳ (مع حدّ ±38°)", Math.abs(s.ry - ry0) > 10 && Math.abs(s.ry) <= 38, "mouse", [ry0, s.ry, s.rx]);
    h = await hdr("ord"); const ry1 = s.ry; await p.keyboard.down("Shift"); await drag(h.x + h.width / 2, h.y + 10, h.x + h.width / 2 - 70, h.y + 10, 8, 35); await p.keyboard.up("Shift"); await p.waitForTimeout(300);
    s = (await S()).o.ord.st; ok("Shift+سحب الترويسة يدوّر اللوح", Math.abs(s.ry - ry1) > 8, "mouse", [ry1, s.ry]);
    const w0 = s.w, rs = await (await p.$(`.panel[aria-label="الطلبات"] .pn-rs`)).boundingBox(); await drag(rs.x + 12, rs.y + 12, rs.x - 38, rs.y + 50, 8, 35); await p.waitForTimeout(400);
    s = (await S()).o.ord.st; ok("تحجيم بمقبض الزاوية", s.w > w0 + 30, "mouse", [w0, s.w]);
    h = await hdr("ord"); const sc0 = s.s; await p.mouse.move(h.x + h.width / 2, h.y + 10); for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, -100); await p.waitForTimeout(40); } await p.waitForTimeout(200);
    ok("عجلة الفأرة تكبّر اللوح", (await S()).o.ord.st.s > sc0 * 1.1, "mouse");
    await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(800);
  });

  await section("C. توسيع/استعادة ومحتوى اللوح الموسَّع", async () => {
    for (const [id, nm, extra] of [["inv", "المخزون", ".tbl"], ["ord", "الطلبات", ".tbl"], ["prod", "المنتجات", ".grid3.big"], ["ana", "التحليلات", ".h4"], ["dash", "لوحة التحكم", ".h4"]]) {
      await p.evaluate(i => SpatialOS.open(i), id); await p.waitForTimeout(1500); const before = await p.evaluate(n => document.querySelector(`.panel[aria-label="${n}"] .pn-b`).textContent.length, nm);
      let h = await hdr(id); await p.mouse.move(h.x + h.width / 2, h.y + 10); await p.waitForTimeout(250); h = await hdr(id); await p.mouse.dblclick(h.x + h.width / 2, h.y + 10); await p.waitForTimeout(1600);
      const m = await p.evaluate(([n, ex]) => { const e = document.querySelector(`.panel[aria-label="${n}"]`), b = e.querySelector(".pn-b"), r = b.getBoundingClientRect(); let bot = 0; [...b.children].forEach(c => { bot = Math.max(bot, c.getBoundingClientRect().bottom); }); return { len: b.textContent.length, extra: !!b.querySelector(ex), op: +e.style.opacity, back: !!e.closest("#panels-back"), fill: Math.min(1, (bot - r.top) / r.height), vis: r.height > 300 }; }, [nm, extra]);
      ok(`توسيع «${nm}»: محتوى كامل غني (${before}→${m.len} حرفاً) + عنصر موسَّع`, m.len > before && m.extra, "mouse", m);
      ok(`توسيع «${nm}»: معتم 100% وفي الطبقة الأمامية ويملأ ≥70% من ارتفاعه`, m.op === 1 && !m.back && m.fill >= .7, "api", [m.op, m.back, +m.fill.toFixed(2)]);
      h = await hdr(id); await p.mouse.dblclick(h.x + h.width / 2, h.y + 10); await p.waitForTimeout(1400); const st = (await S()).o[id];
      ok(`الاستعادة بنقر مزدوج ثانٍ («${nm}») تعيد الحجم والمحتوى المضغوط`, !st.big && (await p.evaluate(n => !document.querySelector(`.panel[aria-label="${n}"] .pn-b .tbl, .panel[aria-label="${n}"] .pn-b .grid3.big`) || n === "التحليلات" || n === "لوحة التحكم", nm)), "mouse", { big: st.big });
      await p.evaluate(i => SpatialOS.dismiss(i, "close"), id); await p.waitForTimeout(700);
    }
  });

  await section("D. الرمي والاستعادة وحفظ الحالة", async () => {
    await p.evaluate(() => SpatialOS.setOrbit(false)); await p.evaluate(() => SpatialOS.open("ord")); await p.waitForTimeout(1500);
    await p.click('.panel[aria-label="الطلبات"] [data-f="new"]'); await p.waitForTimeout(300); const rows0 = await p.evaluate(() => document.querySelectorAll('.panel[aria-label="الطلبات"] .row').length);
    await p.waitForTimeout(1200); const h = await hdr("ord"), dir = (await S()).o.ord.st.x >= 0 ? 1 : -1, fx0 = await p.evaluate(() => FX.count());
    await p.evaluate(() => { window.__e = []; ['pointerdown','pointerup'].forEach(n => document.addEventListener(n, e => window.__e.push(n + ':' + (e.target.className||e.target.tagName).toString().slice(0,18)), true)); }); await p.mouse.move(h.x + h.width / 2, h.y + 10); await p.mouse.down(); for (let i = 1; i <= 5; i++) { await p.mouse.move(h.x + h.width / 2 + dir * i * 90, h.y + 10 - i * 8); await p.waitForTimeout(14); } await p.mouse.up();
    let fx = 0; for (let k = 0; k < 20; k++) { fx = Math.max(fx, await p.evaluate(() => FX.count())); await p.waitForTimeout(100); } await p.waitForTimeout(1200);
    R.push("   dbg " + JSON.stringify(await p.evaluate(() => window.__e))); ok("الرمي نحو الحافة يُغلق اللوح بسرعة الإفلات", !(await S()).o.ord, "mouse", await p.evaluate(() => SpatialOS.lastRelease));
    ok("تلاشٍ بجسيمات مضيئة", fx > fx0 + 20, "api", [fx0, fx]); ok("حُذف عنصر اللوح من الصفحة", await p.evaluate(() => !document.querySelector('.panel[aria-label="الطلبات"]')), "api");
    await settle(); await p.waitForTimeout(1200); const nb = await p.evaluate(() => { const n = document.querySelector('.node[data-id="ord"]'), r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, sel: n.classList.contains("sel") }; });
    ok("العقدة تدور لمقدمة المشهد وتُظلَّل بعد الرمي", nb.sel, "api", nb);
    const hit = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.closest(".node") && e.closest(".node").dataset.id; }, [nb.x, nb.y]); await p.mouse.click(nb.x, nb.y); await p.waitForTimeout(1600);
    ok("إعادة الفتح من الاسطوانة", !!(await S()).o.ord && hit === "ord", "mouse", hit);
    ok("حالة اللوح محفوظة (فلتر «جديدة» ما زال مفعّلاً)", (await p.evaluate(() => document.querySelectorAll('.panel[aria-label="الطلبات"] .row').length)) === rows0, "api", rows0);
    await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(700);
  });

  await section("E. نوافذ متعددة وإدارتها", async () => {
    await p.evaluate(() => SpatialOS.setOrbit(false)); for (const i of ["ord", "ana", "inv", "prod", "cus"]) { await p.evaluate(x => SpatialOS.open(x), i); await p.waitForTimeout(500); } await p.waitForTimeout(1200);
    let s = await S(), ids = Object.keys(s.o).filter(k => !s.o[k].min); let ov = 0; for (let i = 0; i < ids.length; i++)for (let j = i + 1; j < ids.length; j++) { const A = s.o[ids[i]].box, B = s.o[ids[j]].box, ox = Math.min(A[0] + A[2], B[0] + B[2]) - Math.max(A[0], B[0]), oy = Math.min(A[1] + A[3], B[1] + B[3]) - Math.max(A[1], B[1]); if (ox > 0 && oy > 0) ov += ox * oy; }
    ok("5 نوافذ مستقلة معاً بلا تراكب (تخطيط واعٍ بالتصادم)", ids.length === 5 && ov === 0, "api", { n: ids.length, overlapPx2: ov });
    const z0 = s.o.cus.z; const hb = await hdr("ord"); await p.mouse.click(hb.x + hb.width / 2, hb.y + 10); await p.waitForTimeout(300); s = await S(); ok("النقر على لوح يُحضره للأمام (z-index أعلى)", s.o.ord.z > Math.max(...ids.filter(k => k !== "ord").map(k => s.o[k].z)) - 0, "mouse", { ord: s.o.ord.z });
    await p.click('.panel[aria-label="التحليلات"] .pn-min'); await p.waitForTimeout(900); s = await S(); ok("تصغير لوح", s.o.ana.min, "mouse"); ok("وسم التصغير على العقدة", await p.evaluate(() => document.querySelector('.node[data-id="ana"]').classList.contains("min")), "api");
    await p.evaluate(() => SpatialOS.open("ana")); await p.waitForTimeout(1500); s = await S(); ok("استعادة المصغَّر من الاسطوانة", !s.o.ana.min, "api");
    await p.evaluate(() => { const q = SpatialOS.panels.get("ord"); q.body.scrollTop = 0; }); await p.click('.panel[aria-label="الطلبات"] [data-f="done"]'); await p.waitForTimeout(300);
    await p.click('.panel[aria-label="الطلبات"] .pn-min'); await p.waitForTimeout(900); await p.evaluate(() => SpatialOS.open("ord")); await p.waitForTimeout(1500);
    ok("حالة اللوح محفوظة بعد التصغير والاستعادة (فلتر «مسلَّمة»)", await p.evaluate(() => [...document.querySelectorAll('.panel[aria-label="الطلبات"] .chip.on')].some(e => e.dataset.f === "done")), "api");
    await p.evaluate(() => { SpatialOS.dismiss("ord", "close"); SpatialOS.dismiss("ana", "close"); SpatialOS.dismiss("inv", "close"); SpatialOS.dismiss("prod", "close"); SpatialOS.dismiss("cus", "close"); }); await p.waitForTimeout(900);
  });

  await section("F. المدار والتثبيت على المدار", async () => {
    await p.evaluate(() => SpatialOS.setOrbit(true)); for (const i of ["ord", "ana", "inv", "prod"]) { await p.evaluate(x => SpatialOS.open(x), i); await p.waitForTimeout(600); } await settle(); await p.mouse.move(720, 880); await p.waitForTimeout(2500);
    const a = await S(); await p.waitForTimeout(2200); const b2 = await S(); ok("الألواح تدور حول الاسطوانة", Object.keys(a.o).some(k => Math.abs(a.o[k].st.x - b2.o[k].st.x) > 3), "api");
    ok("الخلفية الخلفية تحت الاسطوانة والأمامية فوقها", await p.evaluate(() => [...SpatialOS.panels.values()].every(q => (q.st.z < -250) === !!q.el.closest("#panels-back") || (q.st.z > -250 && q.st.z < -100))), "api");
    const fr = Object.entries(b2.o).sort((x, y) => y[1].st.z - x[1].st.z)[0][0]; const nm = await p.evaluate(i => SpatialOS.panels.get(i).sec.name, fr); const hb = await (await p.$(`.panel[aria-label="${nm}"] .pn-h h3`)).boundingBox();
    await p.mouse.move(hb.x + hb.width / 2, hb.y + 8); await p.waitForTimeout(300); const pa0 = (await S()).pa; await p.waitForTimeout(1200); ok("المؤشر فوق لوح يوقف الدوران", Math.abs((await S()).pa - pa0) < .01, "mouse");
    { const q = await (await p.$(`.panel[aria-label="${nm}"] .pn-h h3`)).boundingBox(); await drag(q.x + q.width / 2, q.y + 8, q.x + q.width / 2 + 12, q.y + 34, 5, 40); await p.waitForTimeout(1200); ok("إفلات اللوح قرب موضعه على المدار يعيده إلى المدار (snap-to-orbit)", !(await S()).o[fr].user, "mouse"); }
    await p.mouse.move(720, 880); await p.waitForTimeout(400);
    const hb2 = await (await p.$(`.panel[aria-label="${nm}"] .pn-h h3`)).boundingBox(); await drag(hb2.x + hb2.width / 2, hb2.y + 8, hb2.x + hb2.width / 2 + 40, hb2.y + 160, 8, 40); await p.waitForTimeout(500);
    let s = await S(); ok("سحب لوح بعيداً عن المدار يحرّره ويبقى حيث وُضع", s.o[fr] && s.o[fr].user, "mouse"); const fx = s.o[fr].st.x; await p.mouse.move(720, 880); await p.waitForTimeout(1800); ok("اللوح الحرّ لا يتحرك مع المدار", Math.abs((await S()).o[fr].st.x - fx) < 3, "api");
    await p.hover(`.panel[aria-label="${nm}"] .pn-h`); await p.waitForTimeout(300); await p.click(`.panel[aria-label="${nm}"] .pn-orb`); await p.waitForTimeout(1500); ok("زر ◎ يعيد اللوح إلى المدار", !(await S()).o[fr].user, "mouse");
    await p.evaluate(() => SpatialOS.dismiss("inv", "close")); await p.waitForTimeout(1200); const left = Object.keys((await S()).o).length; ok("إغلاق لوح يعيد توزيع البقية على المدار", left === 3, "api", left);
    await p.evaluate(() => ["ord", "ana", "prod"].forEach(i => SpatialOS.dismiss(i, "close"))); await p.waitForTimeout(800);
  });
  await section("I. المرحلة 3 — تفاعل مكاني (إدخال حقيقي)", async () => {
    await p.evaluate(() => SpatialOS.setOrbit(false)); await p.evaluate(() => SpatialOS.open("ord")); await p.waitForTimeout(1500); await p.mouse.move(700, 860);
    /* قصور ذاتي: إفلات بسرعة معتدلة (بين عتبة الانزلاق وعتبة الرمي) فيستمر اللوح بالانزلاق ثم يتوقف باحتكاك */
    let glided = null;
    for (const step of [14, 9, 20, 6, 28]) {
      await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(500); await p.evaluate(() => SpatialOS.open("ord")); await p.waitForTimeout(1500);
      const h = await hdr("ord"); await p.mouse.move(h.x + h.width / 2, h.y + 10); await p.mouse.down(); for (let i = 1; i <= 5; i++) { await p.mouse.move(h.x + h.width / 2 - i * step, h.y + 10 + i * 3); await p.waitForTimeout(14); } await p.mouse.up();
      const lr = await p.evaluate(() => SpatialOS.lastRelease), x0 = (await S()).o.ord && (await S()).o.ord.st.x; await p.waitForTimeout(250); const x1 = (await S()).o.ord && (await S()).o.ord.st.x; await p.waitForTimeout(1800); const x2 = (await S()).o.ord && (await S()).o.ord.st.x, x3 = await (async () => { await p.waitForTimeout(500); return (await S()).o.ord && (await S()).o.ord.st.x; })();
      if ((await S()).o.ord && lr.sp > .08 && lr.sp <= .5) { glided = { lr, x0, x1, x2, x3 }; break; }
    }
    ok("قصور ذاتي: يستمر اللوح بالانزلاق بعد الإفلات (يتحرك بعد لحظة الإفلات)", !!glided && Math.abs(glided.x2 - glided.x0) > 2, "mouse", glided);
    ok("احتكاك: يتوقف الانزلاق ويستقر الموضع", !!glided && Math.abs(glided.x3 - glided.x2) < 1.5, "mouse", glided && [glided.x2, glided.x3]);
    await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(600); await p.evaluate(() => SpatialOS.open("ord")); await p.waitForTimeout(1500);
    /* تغذية بصرية وحدود التدوير */
    let h = await hdr("ord"); const rb = await (await p.$('.panel[aria-label="الطلبات"] .pn-rot')).boundingBox(); await p.mouse.move(rb.x + 14, rb.y + 14); await p.mouse.down(); for (let i = 1; i <= 12; i++) { await p.mouse.move(rb.x + 14 + i * 40, rb.y + 14 - i * 12); await p.waitForTimeout(30); }
    const fb = await p.evaluate(() => { const e = document.querySelector('.panel[aria-label="الطلبات"]'); return { cls: e.classList.contains("dragging"), badge: e.querySelector(".gbadge").textContent, on: e.querySelector(".gbadge").classList.contains("on"), ry: SpatialOS.panels.get("ord").st.ry, rx: SpatialOS.panels.get("ord").st.rx }; });
    ok("تغذية بصرية أثناء التدوير: إطار متوهّج + شارة بالزوايا", fb.cls && fb.on && /⟲/.test(fb.badge), "mouse", fb); ok("حد التدوير أثناء السحب (≤34° أفقياً و≤26° رأسياً): لا تصير اللوحة غير مقروءة", Math.abs(fb.ry) <= 34.01 && Math.abs(fb.rx) <= 26.01, "mouse", fb);
    await p.mouse.up(); await p.waitForTimeout(900); const af = await p.evaluate(() => ({ ry: SpatialOS.panels.get("ord").st.ry, rx: SpatialOS.panels.get("ord").st.rx, cls: document.querySelector('.panel[aria-label="الطلبات"]').classList.contains("dragging") }));
    ok("بعد الإفلات يعود اللوح إلى زاوية مقروءة (≤24°/≤18°) وتزول التغذية", Math.abs(af.ry) <= 24.01 && Math.abs(af.rx) <= 18.01 && !af.cls, "mouse", af);
    /* طبقات العمق: Shift+عجلة والمفاتيح */
    const pbx = await (await p.$('.panel[aria-label="الطلبات"]')).boundingBox(); await p.mouse.move(pbx.x + pbx.width / 2, pbx.y + pbx.height / 2); const z0 = (await S()).o.ord.st.z; await p.keyboard.down("Shift"); for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, -100); await p.waitForTimeout(60); } await p.keyboard.up("Shift"); await p.waitForTimeout(300); const z1 = (await S()).o.ord.st.z;
    ok("Shift+عجلة يحرّك اللوح عبر طبقات العمق (محصور −240…260)", z1 > z0 + 40 && z1 <= 260, "mouse", [z0, z1]);
    await p.evaluate(() => SpatialOS.panels.get("ord").el.focus()); await p.keyboard.press("PageDown"); await p.keyboard.press("PageDown"); await p.waitForTimeout(400); const z2 = (await S()).o.ord.st.z; ok("PageUp/PageDown تغيّر العمق بلوحة المفاتيح", z2 < z1 - 40, "keyboard", [z1, z2]);
    /* تحريك وإمالة بلوحة المفاتيح */
    const k0 = (await S()).o.ord.st; await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowDown"); await p.waitForTimeout(400); const k1 = (await S()).o.ord.st; ok("الأسهم تحرّك اللوح أفقياً ورأسياً", k1.x > k0.x + 40 && k1.y > k0.y + 15, "keyboard", [k0.x, k0.y, k1.x, k1.y]);
    await p.keyboard.down("Alt"); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft"); await p.keyboard.up("Alt"); await p.waitForTimeout(400); ok("Alt+أسهم تميل اللوح", Math.abs((await S()).o.ord.st.ry - k1.ry) > 5, "keyboard", [k1.ry, (await S()).o.ord.st.ry]);
    /* بديل لوحة المفاتيح للرمي */
    const fx0 = await p.evaluate(() => FX.count()); await p.keyboard.press("Delete"); let fxm = 0; for (let k = 0; k < 15; k++) { fxm = Math.max(fxm, await p.evaluate(() => FX.count())); await p.waitForTimeout(100); } await p.waitForTimeout(1200);
    ok("Delete يرمي اللوح للخارج ويحلّه بجسيمات (بديل لوحة المفاتيح)", !(await S()).o.ord && fxm > fx0 + 15, "keyboard", [fx0, fxm]);
    /* لا تنقّل عرضي أثناء سحب لوح فوق عقدة */
    await p.evaluate(() => SpatialOS.open("ana")); await p.waitForTimeout(1500); await settle(); const nodeP = await p.evaluate(() => { const n = [...document.querySelectorAll(".node")].filter(x => !x.classList.contains("open")).sort((a, b) => b.style.zIndex - a.style.zIndex)[0], r = n.getBoundingClientRect(); return { id: n.dataset.id, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    h = await hdr("ana"); await p.mouse.move(h.x + h.width / 2, h.y + 10); await p.mouse.down(); for (let i = 1; i <= 10; i++) { await p.mouse.move(h.x + h.width / 2 + (nodeP.x - h.x - h.width / 2) * i / 10, h.y + 10 + (nodeP.y - h.y - 10) * i / 10); await p.waitForTimeout(40); } await p.mouse.up(); await p.waitForTimeout(1500);
    ok("إفلات لوح فوق عقدة قسم لا يفتح ذلك القسم عن طريق الخطأ", !(await S()).o[nodeP.id], "mouse", [nodeP.id, Object.keys((await S()).o)]); await p.evaluate(() => SpatialOS.dismiss("ana", "close")); await p.waitForTimeout(700);
    /* ثبات المواضع عند تغيير حجم النافذة */
    await p.evaluate(() => SpatialOS.open("prod")); await p.waitForTimeout(1500); const pr0 = (await S()).o.prod.st, rel0 = [pr0.x / 1440, pr0.y / 900]; await p.setViewportSize({ width: 1100, height: 760 }); await p.waitForTimeout(1200); const pr1 = (await S()).o.prod.st;
    ok("تغيير حجم النافذة يحفظ الموضع النسبي للوح (±3%)", Math.abs(pr1.x / 1100 - rel0[0]) < .03 && Math.abs(pr1.y / 760 - rel0[1]) < .03, "api", [rel0, [pr1.x / 1100, pr1.y / 760]]); await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(900); await p.evaluate(() => SpatialOS.dismiss("prod", "close")); await p.waitForTimeout(700);
    /* تنظيم ذكي: تقديم المحدَّد وإبقاء الباقي ظاهراً في الخلفية */
    await p.evaluate(() => SpatialOS.setOrbit(true)); for (const i of ["ord", "ana", "inv", "prod"]) { await p.evaluate(x => SpatialOS.open(x), i); await p.waitForTimeout(600); } await settle(); await p.mouse.move(720, 880); await p.waitForTimeout(1200);
    const bk = await p.evaluate(() => [...SpatialOS.panels.values()].filter(q => q.inBack).map(q => { const r = q.el.getBoundingClientRect(); return { id: q.id, vis: r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight, op: +q.el.style.opacity }; }));
    ok("الألواح الخلفية تبقى ظاهرة داخل الشاشة وليست مخفية", bk.length >= 1 && bk.every(b => b.vis && b.op >= .35), "api", bk);
    const backId = await p.evaluate(() => [...SpatialOS.panels.values()].sort((a, b) => a.st.z - b.st.z)[0].id); const nbk = await (await p.$(`.node[data-id="${backId}"]`)).boundingBox().catch(() => null);
    await p.evaluate(id => SpatialOS.open(id), backId); await settle(); await p.waitForTimeout(2500); ok("اختيار لوح خلفي من الاسطوانة يقدّمه إلى الأمام", (await S()).o[backId].st.z > 250 && !(await S()).o[backId].back, "api", (await S()).o[backId].st.z);
    ok("تحديد القسم النشط ظاهر كنص", await p.evaluate(() => document.getElementById("active").classList.contains("on") && document.getElementById("active").textContent.length > 2), "api");
    await p.evaluate(() => ["ord", "ana", "inv", "prod"].forEach(i => SpatialOS.dismiss(i, "close"))); await p.waitForTimeout(900);
  });
  ok("لا أخطاء صفحة (سطح المكتب)", errs.length === 0, "api", errs); await c.close();
}

async function mobile(b) {
  const c = await b.newContext({ viewport: { width: 448, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), p = await c.newPage(), errs = []; p.setDefaultTimeout(6000);
  p.on("pageerror", e => errs.push(String(e).slice(0, 160))); await p.goto(URL); await p.waitForTimeout(2200); const cdp = await c.newCDPSession(p);
  const T = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  const swipe = async (a, b2, n = 10, d = 30) => { await T("touchStart", [a]); for (let i = 1; i <= n; i++) { await T("touchMove", [[a[0] + (b2[0] - a[0]) * i / n, a[1] + (b2[1] - a[1]) * i / n]]); await p.waitForTimeout(d); } await T("touchEnd", []); };
  const S = () => p.evaluate(() => { const o = {}; SpatialOS.panels.forEach((q, id) => { o[id] = { ...q.st, min: q.min, big: q.big }; }); return { o, ang: SpatialOS.angle }; });
  const hdr = async n => (await p.$(`.panel[aria-label="${n}"] .pn-h h3`)).boundingBox();
  const dtap = n => p.evaluate(async nm => { const h = document.querySelector(`.panel[aria-label="${nm}"] .pn-h`), r = h.getBoundingClientRect(), x = r.left + r.width * .5, y = r.top + 10; for (let k = 0; k < 2; k++) { for (const t of ['pointerdown', 'pointerup']) h.dispatchEvent(new PointerEvent(t, { pointerId: 55, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true })); await new Promise(r => setTimeout(r, 80)); } }, n);
  await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(700);
  await section("G. هاتف: لمس واختلاط الإيماءات", async () => {
    ok("الشريط السفلي بديل التنقل ظاهر", await p.evaluate(() => getComputedStyle(document.getElementById("dock")).display === "flex"), "api");
    const a0 = (await S()).ang; await swipe([200, 330], [340, 330], 10, 25); await p.waitForTimeout(300); ok("لمس السحب على الخلفية يدوّر الاسطوانة", Math.abs((await S()).ang - a0) > 15, "cdp-touch");
    ok("الصفحة لم تتمرّر ولم تُكبَّر أثناء تدوير الاسطوانة", await p.evaluate(() => scrollY === 0 && visualViewport.scale === 1), "api");
    await p.click('#dock button[data-id="ana"]'); await p.waitForTimeout(1600); ok("الشريط السفلي يفتح لوحاً ويحدّد القسم", !!(await S()).o.ana && (await p.evaluate(() => SpatialOS.selected)) === "ana", "cdp-touch");
    const h = await hdr("التحليلات"), y0 = (await S()).o.ana.y; await swipe([h.x + h.width / 2, h.y + 10], [h.x + h.width / 2, h.y - 70], 8, 30); await p.waitForTimeout(500); ok("سحب ترويسة اللوح باللمس يحرّكه", Math.abs((await S()).o.ana.y - y0) > 20, "cdp-touch", [y0, (await S()).o.ana.y]);
    const r = await (await p.$('.panel[aria-label="التحليلات"] .pn-rot')).boundingBox(), ry0 = (await S()).o.ana.ry; await swipe([r.x + 14, r.y + 14], [r.x + 74, r.y + 30], 8, 30); await p.waitForTimeout(300); ok("تدوير اللوح باللمس بمقبض ⟳", Math.abs((await S()).o.ana.ry - ry0) > 8, "cdp-touch", [ry0, (await S()).o.ana.ry]);
    const rs = await (await p.$('.panel[aria-label="التحليلات"] .pn-rs')).boundingBox(), w0 = (await S()).o.ana.w; await swipe([rs.x + 10, rs.y + 10], [rs.x - 50, rs.y + 40], 8, 30); await p.waitForTimeout(400); ok("تحجيم باللمس بمقبض الزاوية", (await S()).o.ana.w !== w0 || (await S()).o.ana.h > 0, "cdp-touch", [w0, (await S()).o.ana.w]);
    const pb = await (await p.$('.panel[aria-label="التحليلات"]')).boundingBox(), cx = pb.x + pb.width / 2, cy = Math.max(120, Math.min(780, pb.y + pb.height / 2)), s0 = (await S()).o.ana.s;
    await T("touchStart", [[cx - 30, cy], [cx + 30, cy]]); for (let i = 1; i <= 8; i++) { await T("touchMove", [[cx - 30 - i * 7, cy], [cx + 30 + i * 7, cy]]); await p.waitForTimeout(30); } await T("touchEnd", []); await p.waitForTimeout(400);
    ok("قرص إصبعين يكبّر اللوح", (await S()).o.ana.s > s0 * 1.2, "cdp-touch", [s0, (await S()).o.ana.s]); ok("القرص لم يكبّر الصفحة", await p.evaluate(() => visualViewport.scale === 1), "api");
    await T("touchStart", [[cx - 30 - 56, cy], [cx + 30 + 56, cy]]); for (let i = 1; i <= 8; i++) { await T("touchMove", [[cx - 86 + i * 9, cy], [cx + 86 - i * 9, cy]]); await p.waitForTimeout(30); } await T("touchEnd", []); await p.waitForTimeout(300);
    await p.evaluate(() => { const q = SpatialOS.panels.get("ana"); Object.assign(q.st, { s: 1, x: 0, y: 150, rx: 0, ry: 0 }); q.el.classList.add("tr2"); SpatialOS.open("ana"); }); await p.waitForTimeout(900);
    await dtap("التحليلات"); await p.waitForTimeout(900);
    ok("لمس مزدوج على الترويسة يوسّع اللوح (أحداث Pointer مصطنعة؛ اللمس الحقيقي عبر CDP بطيء هنا فلا يُعتمد)", (await S()).o.ana.big === true, "synthetic"); ok("المحتوى الموسَّع غني (جدول/قمع)", await p.evaluate(() => !!document.querySelector('.panel[aria-label="التحليلات"] .h4')), "api");
    await dtap("التحليلات"); await p.waitForTimeout(900); ok("لمس مزدوج ثانٍ يستعيد", (await S()).o.ana.big === false, "synthetic");
    // scroll inside panel
    await p.evaluate(() => { const q = SpatialOS.panels.get("ana"); q.el.classList.add("tr2"); Object.assign(q.st, { s: 1, x: 0, y: 150, rx: 0, ry: 0 }); SpatialOS.open("ana"); }); await p.waitForTimeout(900);
    const info = await p.evaluate(() => { const b = document.querySelector('.panel[aria-label="التحليلات"] .pn-b'), r = b.getBoundingClientRect(); return { sc: b.scrollHeight > b.clientHeight + 4, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    ok("المحتوى قابل للتمرير (شرط الاختبار)", info.sc, "api"); const a1 = (await S()).ang, st1 = (await S()).o.ana.y;
    await swipe([info.x, info.y + 60], [info.x, info.y - 100], 10, 30); await p.waitForTimeout(500);
    const after = await p.evaluate(() => ({ top: document.querySelector('.panel[aria-label="التحليلات"] .pn-b').scrollTop, pg: scrollY })); ok("السحب الرأسي داخل اللوح يمرّر محتواه", after.top > 20, "cdp-touch", after);
    ok("لا تمرير للصفحة ولا تدوير للاسطوانة ولا تحريك للوح أثناء تمرير المحتوى", after.pg === 0 && Math.abs((await S()).ang - a1) < 1 && Math.abs((await S()).o.ana.y - st1) < 3, "cdp-touch");
    const dk = await p.evaluate(() => { const d = document.getElementById("dock"); return { sw: d.scrollWidth > d.clientWidth, l: d.scrollLeft }; }); await swipe([300, 870], [80, 870], 8, 25); await p.waitForTimeout(300); ok("الشريط السفلي يتمرّر أفقياً", dk.sw && (await p.evaluate(() => Math.abs(document.getElementById("dock").scrollLeft))) !== Math.abs(dk.l), "cdp-touch", dk);
    // throw (synthetic)
    const hh = await hdr("التحليلات"); await p.evaluate(async ([x, y]) => { const h = document.querySelector('.panel[aria-label="التحليلات"] .pn-h'), ev = (t, px, py) => h.dispatchEvent(new PointerEvent(t, { pointerId: 77, pointerType: "touch", isPrimary: true, clientX: px, clientY: py, bubbles: true, cancelable: true })); ev("pointerdown", x, y); for (let i = 1; i <= 7; i++) { await new Promise(r => setTimeout(r, 12)); ev("pointermove", x - i * 40, y - i * 12); } ev("pointerup", x - 280, y - 84); }, [hh.x + hh.width / 2, hh.y + 10]); await p.waitForTimeout(1800);
    ok("رمي اللوح نحو الحافة يغلقه (أحداث Pointer مصطنعة بنوع touch، لا إصبع حقيقي)", !(await S()).o.ana, "synthetic");
    await p.waitForTimeout(800); await p.click('#dock button[data-id="ana"]'); await p.waitForTimeout(1600); ok("إعادة الفتح من الشريط/الاسطوانة بعد الرمي", !!(await S()).o.ana, "cdp-touch");
  });
  await section("J. المرحلة 3 — لمس حقيقي (CDP) على الهاتف", async () => {
    await p.click('#dock button[data-id="ana"]'); await p.waitForTimeout(1800); await p.evaluate(() => { const q = SpatialOS.panels.get("ana"); Object.assign(q.st, { s: 1, x: 0, y: 150, rx: 0, ry: 0, rz: 0 }); SpatialOS.open("ana"); }); await p.waitForTimeout(900);
    /* التواء + قرص بإصبعين مع تغذية بصرية */
    const pb = await (await p.$('.panel[aria-label="التحليلات"]')).boundingBox(), cx = pb.x + pb.width / 2, cy = Math.max(160, Math.min(760, pb.y + pb.height / 2)), q0 = (await S()).o.ana;
    await T("touchStart", [[cx - 40, cy], [cx + 40, cy]]); let fbSeen = null, rzSeen = 0;
    for (let i = 1; i <= 8; i++) { const a = i * 4 * Math.PI / 180; await T("touchMove", [[cx - 40 * Math.cos(a) - i * 3, cy - 40 * Math.sin(a)], [cx + 40 * Math.cos(a) + i * 3, cy + 40 * Math.sin(a)]]); await p.waitForTimeout(30); if (i === 6) { fbSeen = await p.evaluate(() => { const e = document.querySelector('.panel[aria-label="التحليلات"]'); return { gest: e.classList.contains("gest"), badge: e.querySelector(".gbadge").textContent, rz: SpatialOS.panels.get("ana").st.rz }; }); rzSeen = fbSeen.rz; } }
    ok("التواء بإصبعين يدوّر اللوح (rz) مع تغذية بصرية (إطار + شارة ×/↻)", !!fbSeen && fbSeen.gest && /↻/.test(fbSeen.badge) && Math.abs(rzSeen) > 5, "cdp-touch", fbSeen);
    await T("touchEnd", []); await p.waitForTimeout(900); const q1 = (await S()).o.ana; ok("الالتواء يعود إلى الصفر بعد الرفع (قراءة سهلة) ويبقى القرص مطبَّقاً", Math.abs(q1.rz || 0) < .5 && q1.s > q0.s, "cdp-touch", [q0.s, q1.s, q1.rz]);
    ok("زالت التغذية بعد الرفع", await p.evaluate(() => !document.querySelector('.panel[aria-label="التحليلات"]').classList.contains("gest")), "api");
    /* لمس مزدوج حقيقي: الإيماءتان تُرسلان بلا انتظار بينهما */
    await p.evaluate(() => { const q = SpatialOS.panels.get("ana"); Object.assign(q.st, { s: 1, x: 0, y: 150, rx: 0, ry: 0, rz: 0 }); SpatialOS.open("ana"); }); await p.waitForTimeout(900); const hd = await hdr("التحليلات"), tx = hd.x + hd.width / 2, ty = hd.y + 10;
    await Promise.all([T("touchStart", [[tx, ty]]), T("touchEnd", []), T("touchStart", [[tx, ty]]), T("touchEnd", [])]); await p.waitForTimeout(1200);
    ok("لمس مزدوج حقيقي (CDP) يوسّع اللوح", (await S()).o.ana.big === true, "cdp-touch");
    await p.evaluate(() => { const q = SpatialOS.panels.get("ana"); if (q.big) { /* استعادة بنفس الإيماءة */ } }); const hd2 = await hdr("التحليلات"); await Promise.all([T("touchStart", [[hd2.x + hd2.width / 2, hd2.y + 10]]), T("touchEnd", []), T("touchStart", [[hd2.x + hd2.width / 2, hd2.y + 10]]), T("touchEnd", [])]); await p.waitForTimeout(1200); ok("لمس مزدوج حقيقي ثانٍ يستعيد", (await S()).o.ana.big === false, "cdp-touch");
    /* رمي حقيقي باللمس: خطوات كبيرة قليلة فتبلغ السرعة المقاسة (من الطوابع الزمنية) العتبة رغم بطء البيئة */
    await p.evaluate(() => { const q = SpatialOS.panels.get("ana"); Object.assign(q.st, { s: 1, x: 0, y: 150, rx: 0, ry: 0, rz: 0 }); SpatialOS.open("ana"); }); await p.waitForTimeout(900); const ht = await hdr("التحليلات");
    await T("touchStart", [[ht.x + ht.width / 2, ht.y + 10]]); for (let i = 1; i <= 5; i++) { await T("touchMove", [[ht.x + ht.width / 2 - i * 70, ht.y + 10 - i * 20]]); await p.waitForTimeout(10); } await T("touchEnd", []); await p.waitForTimeout(2000);
    const lr = await p.evaluate(() => SpatialOS.lastRelease); ok("رمي باللمس الحقيقي (CDP) يغلق اللوح بحسب سرعة الإفلات المقاسة", !(await S()).o.ana, "cdp-touch", lr);
    await p.evaluate(() => 0); await p.waitForTimeout(500); await p.click('#dock button[data-id="ana"]'); await p.waitForTimeout(1800); ok("الاستعادة من الشريط/الاسطوانة بعد الرمي باللمس", !!(await S()).o.ana, "cdp-touch");
    ok("الصفحة بلا تمرير ولا تكبير بعد كل الإيماءات", await p.evaluate(() => scrollY === 0 && scrollX === 0 && visualViewport.scale === 1), "api");
  });
  await section("H. هاتف: لا تمرير أفقي للصفحة", async () => { ok("بلا تمرير أفقي", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "api"); });
  ok("لا أخطاء صفحة (هاتف)", errs.length === 0, "api", errs); await c.close();
}
(async () => { const b = await chromium.launch(); if (only === "all" || only === "desktop") await desktop(b); if (only === "all" || only === "mobile") await mobile(b); await b.close(); console.log(R.join("\n")); console.log(fails ? "\nFAILED: " + fails : "\nALL PASSED (" + R.filter(l => l.startsWith("PASS")).length + ")"); process.exit(fails ? 1 : 0); })();
