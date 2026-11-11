/* المرحلة 5 — التحكم المستقل بالكائنات: الأوضاع الثلاثة (العالم/الكائن/التركيز) والسيناريو الكامل ذو الخطوات السبع.
   كل اختبار بإدخال حقيقي («mouse» فأرة Playwright، «cdp-touch» لمس CDP)؛ «api» = قراءة حالة فقط.
   الثابت الأساسي: التعامل مع كائن واحد لا يحرّك البيئة (angle/yaw/pa) ولا ألواحاً أخرى.
   التشغيل: python3 -m http.server 8765 (من الجذر) ثم  NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/phase5.js [desktop|mobile|all] */
const { chromium } = require("playwright"); const URL = process.env.URL || "http://localhost:8765/admin-preview/spatial-os/index.html"; const only = process.argv[2] || "all";
const R = []; let fails = 0; const ok = (n, c, m, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + "[" + m + "] " + n + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 170) : "")); };
async function section(name, fn) { R.push("── " + name); try { await fn(); } catch (e) { fails++; R.push("FAIL [crash] " + name + ": " + String(e).split("\n")[0].slice(0, 200)); } }
const KEYS = ["x", "y", "z", "rx", "ry", "rz", "s", "w", "h"], near = (a, b, e = .02) => Math.abs((a || 0) - (b || 0)) <= e, same = (a, b, e) => !!a && !!b && KEYS.every(k => near(a[k], b[k], e)), diff = (a, b, ks) => ks.some(k => !near(a[k], b[k], .5));

async function desktop(b) {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await c.newPage(), errs = []; p.setDefaultTimeout(7000); p.on("pageerror", e => errs.push(String(e).slice(0, 160)));
  await p.goto(URL); await p.waitForTimeout(1500);
  const Wd = () => p.evaluate(() => SpatialOS.world()), P = id => p.evaluate(i => { const q = SpatialOS.panels.get(i); return q ? { ...q.st, big: q.big, user: q.user, min: q.min } : null; }, id);
  const MODE = () => p.evaluate(() => ({ mode: SpatialOS.mode, sel: SpatialOS.objSel, body: document.body.dataset.mode, marked: [...document.querySelectorAll(".panel.objsel")].map(e => e.getAttribute("aria-label")) }));
  const settled = () => p.waitForFunction(() => { const w = SpatialOS.world(); return !w.tw && !w.pt; }, null, { timeout: 15000 }).catch(() => { });
  const drag = async (x0, y0, x1, y1, n = 10, d = 35) => { await p.mouse.move(x0, y0); await p.mouse.down(); for (let i = 1; i <= n; i++) { await p.mouse.move(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); await p.waitForTimeout(d); } await p.mouse.up(); };
  /* ينتظر استقرار لوح بعد قصوره الدوراني/انزلاقه (عينتان متطابقتان) كي لا يُخلط قياس حركته الذاتية بأثر لوح آخر */
  const calm = async id => { let prev = null; for (let k = 0; k < 20; k++) { const q = JSON.stringify(await P(id)); if (q === prev) return; prev = q; await p.waitForTimeout(300); } };
  const nm = id => p.evaluate(i => SpatialOS.panels.get(i).sec.name, id);
  const H = async id => (await p.$(`.panel[aria-label="${await nm(id)}"] .pn-h h3`)).boundingBox();
  const sel = async (id, q) => `.panel[aria-label="${await nm(id)}"] ${q}`;
  /* نقطة على ترويسة اللوح تعود فعلاً له (لا زرّ ولا لوح آخر فوقها) */
  const freePt = id => p.evaluate(i => { const q = SpatialOS.panels.get(i), h = q.el.querySelector(".pn-h"), r = h.getBoundingClientRect(); for (let f = 0.5; f <= 1.5; f += .05) { const k = f > 1 ? 1 - (f - 1) : f, x = r.left + r.width * (0.12 + 0.76 * k), y = r.top + r.height / 2, t = document.elementFromPoint(x, y); if (t && t.closest(".panel") === q.el && !t.closest("button")) return [x, y]; } return null; }, id);
  const reset = async (orbit) => { await p.evaluate(() => { for (const k of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(k, "close"); SpatialOS.setYaw(0); SpatialOS.clearSel(); }); await p.waitForTimeout(900); await p.evaluate(o => SpatialOS.setOrbit(o), orbit); await p.waitForTimeout(500); };
  await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(700);

  /* ═══ N1. الأوضاع الثلاثة وشريطها ═══ */
  await section("N1. نموذج الأوضاع: العالم / الكائن / التركيز", async () => {
    await reset(false);
    let m = await MODE(); ok("البداية: وضع العالم (لا لوح محدَّد) والشريط ظاهر", m.mode === "world" && m.body === "world" && !m.sel && await p.isVisible("#modebar"), "api", m);
    ok("زر «العالم» مضاء (aria-pressed)", await p.getAttribute('#modebar [data-m="world"]', "aria-pressed") === "true", "api");
    await p.evaluate(() => SpatialOS.open("ord")); await p.waitForTimeout(1300); await p.evaluate(() => SpatialOS.open("ana")); await p.waitForTimeout(1300); await settled();
    m = await MODE(); ok("فتح لوح لا يغيّر الوضع (يبقى العالم) — لا تحديد تلقائي يجمّد البيئة", m.mode === "world" && !m.sel, "api", m);
    const h = await H("ord"); await p.mouse.click(h.x + h.width / 2, h.y + h.height / 2); await p.waitForTimeout(300); m = await MODE();
    ok("نقر لوح يحدّده → وضع الكائن، وهو وحده يحمل علامة التحديد", m.mode === "object" && m.sel === "ord" && m.marked.length === 1, "mouse", m);
    ok("أدوات الكائن (تحريك/تدوير/عمق/ميل) تظهر في وضع الكائن فقط", await p.isVisible('#modebar [data-t="rot"]'), "api");
    await p.click('#modebar [data-m="world"]'); await p.waitForTimeout(200); m = await MODE(); ok("زر «العالم» يلغي التحديد", m.mode === "world" && !m.sel && m.marked.length === 0, "mouse", m);
    ok("وأدوات الكائن تختفي", !(await p.isVisible('#modebar [data-t="rot"]')), "api");
    await p.click('#modebar [data-m="object"]'); await p.waitForTimeout(200); m = await MODE(); ok("زر «الكائن» يحدّد اللوح الأحدث/المُركَّز", m.mode === "object" && !!m.sel, "mouse", m);
    await p.click('#modebar [data-m="focus"]'); await p.waitForTimeout(700); m = await MODE(); ok("زر «التركيز» يوسّع اللوح المحدَّد", m.mode === "focus" && (await P(m.sel)).big, "mouse", m);
    await p.keyboard.press("Escape"); await p.waitForTimeout(700); m = await MODE(); ok("Esc في التركيز يعيد اللوح إلى حجمه (وضع الكائن) ولا يغلقه", m.mode === "object" && !!(await P(m.sel)) && !(await P(m.sel)).big, "keyboard", m);
    await p.keyboard.press("w"); m = await MODE(); ok("مفتاح W = العالم", m.mode === "world", "keyboard", m);
    await p.keyboard.press("o"); m = await MODE(); ok("مفتاح O = الكائن", m.mode === "object", "keyboard", m);
    await p.keyboard.press("f"); await p.waitForTimeout(700); m = await MODE(); ok("مفتاح F = التركيز", m.mode === "focus", "keyboard", m);
    await p.keyboard.press("o"); await p.waitForTimeout(700); m = await MODE(); ok("O من التركيز يعود للكائن", m.mode === "object", "keyboard", m);
    const bg = [60, 760]; await p.mouse.click(bg[0], bg[1]); await p.waitForTimeout(200); m = await MODE(); ok("نقر الخلفية يلغي التحديد → العالم", m.mode === "world", "mouse", m);
  });

  /* ═══ N2. البيئة ثابتة أثناء تحديد كائن ═══ */
  await section("N2. البيئة ثابتة (لا دوران تلقائي) ما دام كائن محدَّداً", async () => {
    await reset(true); await p.evaluate(() => SpatialOS.open("ord")); await p.waitForTimeout(1200); await p.evaluate(() => SpatialOS.open("ana")); await p.waitForTimeout(1500); await settled(); await p.mouse.move(40, 800);
    await p.waitForTimeout(6800); const a0 = await Wd(); await p.waitForTimeout(1500); const a1 = await Wd();
    ok("وضع العالم: الدوران الهادئ يعمل (الاسطوانة والمدار يتحرّكان)", Math.abs(a1.angle - a0.angle) > .8 && Math.abs(a1.pa - a0.pa) > .8, "api", [a0.angle, a1.angle, a0.pa, a1.pa]);
    const fp = await p.evaluate(() => { const o = [...SpatialOS.panels.values()].filter(q => !q.inBack).map(q => q.id)[0]; return o; }); const h = await H(fp); await p.mouse.click(h.x + h.width / 2, h.y + h.height / 2); await p.waitForTimeout(400);
    const b0 = await Wd(); await p.mouse.move(40, 800); await p.waitForTimeout(3200); const b1 = await Wd();
    ok("بعد تحديد لوح: الاسطوانة ثابتة تماماً لثلاث ثوانٍ", near(b0.angle, b1.angle, .01), "api", [b0.angle, b1.angle]);
    ok("والمدار ثابت (pa) فلا تتحرك الألواح الأخرى", near(b0.pa, b1.pa, .01) && !b1.va, "api", [b0.pa, b1.pa]);
    await p.mouse.click(40, 800); await p.waitForTimeout(3300); const c1 = await Wd(); ok("وبمجرد إلغاء التحديد يستأنف الدوران الهادئ", Math.abs(c1.angle - b1.angle) > .5, "api", [b1.angle, c1.angle]);
  });

  /* ═══ N3. تدوير لوح مستقل (أفقي/رأسي/ميل) وحركة XY وعمق — بأدوات الشريط ═══ */
  await section("N3. تدوير وتحريك وعمق لوح واحد بأدوات الكائن", async () => {
    await reset(false); await p.evaluate(() => SpatialOS.open("ord")); await p.waitForTimeout(1300); await p.evaluate(() => SpatialOS.open("ana")); await p.waitForTimeout(1500); await settled();
    const ordPt = await freePt("ord"); await p.mouse.click(ordPt[0], ordPt[1]); await p.waitForTimeout(300);
    ok("الأداة الافتراضية: تحريك", (await p.evaluate(() => SpatialOS.tool)) === "move", "api");
    const w0 = await Wd(), B0 = await P("ana"), A0 = await P("ord");
    await p.click('#modebar [data-t="rot"]'); ok("زر «تدوير» يختار الأداة", (await p.evaluate(() => SpatialOS.tool)) === "rot", "mouse");
    let pt = await freePt("ord"); await p.mouse.move(pt[0], pt[1]); await p.mouse.down(); let act = null; for (let i = 1; i <= 8; i++) { await p.mouse.move(pt[0] + i * 22, pt[1] + i * 9); await p.waitForTimeout(35); if (i === 5) act = await p.evaluate(() => ({ a: document.querySelector('.panel[data-act]') && document.querySelector('.panel[data-act]').dataset.act, t: document.getElementById("mread").textContent })); } await p.mouse.up(); await p.waitForTimeout(900);
    const A1 = await P("ord"), w1 = await Wd(), B1 = await P("ana");
    ok("أداة التدوير: السحب على الترويسة يدوّر اللوح أفقياً ورأسياً", Math.abs(A1.ry - A0.ry) > 4 && Math.abs(A1.rx - A0.rx) > 1, "mouse", [A0.ry, A1.ry, A0.rx, A1.rx]);
    ok("أثناء السحب: تغذية بصرية data-act=rot ونص الشريط يذكر «يدور»", !!act && act.a === "rot" && /يدور/.test(act.t), "api", act);
    ok("اللوح الآخر لم يتغيّر إطلاقاً", same(B0, B1), "api", [B0, B1]); ok("والبيئة ثابتة (angle/yaw/pa)", near(w0.angle, w1.angle, .01) && near(w0.yaw, w1.yaw, .01) && near(w0.pa, w1.pa, .01), "api", [w0, w1]);
    /* ميل (roll) */
    await p.keyboard.press("t"); ok("مفتاح T يختار أداة الميل", (await p.evaluate(() => SpatialOS.tool)) === "roll", "keyboard"); pt = await freePt("ord"); await p.mouse.move(pt[0], pt[1]); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(pt[0] + i * 14, pt[1]); await p.waitForTimeout(30); } const rzMid = (await P("ord")).rz; await p.mouse.up(); await p.waitForTimeout(800);
    const A2 = await P("ord"); ok("أداة الميل: يميل اللوح حول محور الشاشة ثم يستقر ضمن ±12° ليبقى مقروءاً", Math.abs(rzMid) > 5 && Math.abs(A2.rz) <= 12.01 && Math.abs(A2.rz) > 1, "mouse", [rzMid, A2.rz]);
    /* عمق */
    await p.keyboard.press("z"); const bw0 = (await (await p.$(await sel("ord", ""))).boundingBox()).width, z0 = (await P("ord")).z; pt = await freePt("ord"); await p.mouse.move(pt[0], pt[1]); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(pt[0], pt[1] - i * 18); await p.waitForTimeout(30); } const zp = await p.evaluate(() => getComputedStyle(document.querySelector(".panel.objsel")).getPropertyValue("--zp")); await p.mouse.up(); await p.waitForTimeout(500);
    const z1 = (await P("ord")).z, bw1 = (await (await p.$(await sel("ord", ""))).boundingBox()).width;
    ok("أداة العمق: السحب للأعلى يقرّب اللوح نحو الكاميرا (z يزيد)", z1 > z0 + 40, "mouse", [z0, z1]); ok("والمنظور يكبّره فعلاً على الشاشة (عرض أكبر)", bw1 > bw0 * 1.04, "api", [bw0, bw1]);
    ok("مؤشر العمق --zp يعكس الموضع ضمن المدى", +zp > 0 && +zp < 1, "api", zp);
    await p.keyboard.press("m"); pt = await freePt("ord"); const x0 = (await P("ord")).x; await p.mouse.move(pt[0], pt[1]); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(pt[0] + i * 12, pt[1] + i * 8); await p.waitForTimeout(30); } const mv = await p.evaluate(() => document.querySelector(".panel[data-act]").dataset.act); await p.mouse.up(); await p.waitForTimeout(1200);
    ok("أداة التحريك: data-act=move أثناء السحب ويتحرك X/Y", mv === "move" && Math.abs((await P("ord")).x - x0) > 40, "mouse", [mv, x0, (await P("ord")).x]);
    const B2 = await P("ana"), w2 = await Wd(); ok("طوال ذلك: لوح ana وبيئة العالم لم يتغيّرا", same(B0, B2) && near(w0.angle, w2.angle, .01) && near(w0.pa, w2.pa, .01), "api", [B0, B2]);
    ok("Ctrl + سحب يميل اللوح دون تغيير الأداة المختارة", await (async () => { await p.keyboard.press("m"); const r0 = (await P("ord")).rz || 0; const q = await freePt("ord"); await p.keyboard.down("Control"); await p.mouse.move(q[0], q[1]); await p.mouse.down(); for (let i = 1; i <= 6; i++) { await p.mouse.move(q[0] - i * 12, q[1]); await p.waitForTimeout(30); } const mid = (await P("ord")).rz; await p.mouse.up(); await p.keyboard.up("Control"); return Math.abs(mid - r0) > 4 && (await p.evaluate(() => SpatialOS.tool)) === "move"; })(), "mouse");
  });

  /* ═══ N4. رمي: تغذية بصرية قبل الإفلات + أثر على لوح واحد فقط ═══ */
  await section("N4. رمي للإغلاق: إشارة «يمكن الرمي» والبيئة والألواح الأخرى ثابتة", async () => {
    await reset(false); await p.evaluate(() => SpatialOS.open("ord")); await p.waitForTimeout(1300); await p.evaluate(() => SpatialOS.open("ana")); await p.waitForTimeout(1500); await settled();
    const A0 = await P("ord"), w0 = await Wd(); const pt = await freePt("ana"); await p.mouse.move(pt[0], pt[1]); await p.mouse.down(); const st0 = await P("ana"), dir = st0.x >= 0 ? 1 : -1, need = p.viewportSize().width / 2 + st0.w * .15 + 90 - dir * st0.x; let seen = { early: false, edge: false };
    for (let i = 1; i <= 14; i++) { await p.mouse.move(pt[0] + dir * i * need / 14, pt[1] - i * 3); await p.waitForTimeout(60); if (i === 2) seen.early = await p.evaluate(() => document.querySelector(".panel.can-dismiss") !== null); }
    seen.edge = await p.evaluate(() => ({ cls: !!document.querySelector(".panel.can-dismiss"), zone: document.body.classList.contains("throwzone"), badge: document.querySelector(".panel[data-act] .gbadge").textContent })); await p.mouse.up(); await p.waitForTimeout(250);
    ok("قرب الحافة وقبل الإفلات: يتوهّج اللوح وتظهر شارة «حرّر للرمي» وتوهّج الحافة", seen.edge.cls && seen.edge.zone && /للرمي/.test(seen.edge.badge), "mouse", seen);
    ok("وقبل الاقتراب من الحافة لا تظهر الإشارة", seen.early === false, "api", seen.early);
    await p.waitForTimeout(900); ok("اللوح المرمي أُزيل من مساحة العمل", !(await P("ana")), "api"); const A1 = await P("ord"), w1 = await Wd();
    ok("لوح الطلبات لم يتغيّر إطلاقاً بعد رمي الآخر", same(A0, A1, .6), "api", [A0, A1]); ok("والبيئة ثابتة (angle/yaw)", near(w0.angle, w1.angle, .02) && near(w0.yaw, w1.yaw, .01), "api", [w0.angle, w1.angle]);
    ok("زالت الإشارات بعد الرمي (لا توهّج حافة ولا تحديد)", await p.evaluate(() => !document.body.classList.contains("throwzone") && !document.querySelector(".panel.can-dismiss")) && (await MODE()).mode === "world", "api");
    /* لا إنذار كاذب عند إرجاعه إلى الداخل قبل الإفلات */
    await p.evaluate(() => SpatialOS.open("inv")); await p.waitForTimeout(1500); const q = await freePt("inv"), si = await P("inv"), need2 = p.viewportSize().width / 2 + si.w * .15 + 90 - si.x; await p.mouse.move(q[0], q[1]); await p.mouse.down(); for (let i = 1; i <= 12; i++) { await p.mouse.move(q[0] + i * need2 / 12, q[1]); await p.waitForTimeout(60); } const on = await p.evaluate(() => !!document.querySelector(".panel.can-dismiss")); for (let i = 1; i <= 12; i++) { await p.mouse.move(q[0] + need2 - i * (need2 + si.x) / 12, q[1]); await p.waitForTimeout(110); } await p.waitForTimeout(250); const off = await p.evaluate(() => !document.querySelector(".panel.can-dismiss") && !document.body.classList.contains("throwzone")); await p.mouse.up(); await p.waitForTimeout(900);
    ok("إعادة اللوح للداخل قبل الإفلات تُطفئ الإشارة (ولا يُرمى)", on && off && !!(await P("inv")), "mouse", { on, off });
  });

  /* ═══ N5. السيناريو الكامل ذو الخطوات السبع ═══ */
  await section("N5. السيناريو: 1 تدوير العالم · 2 لوحان · 3 تدوير الأول · 4 تحريك الثاني · 5 توسيع الأول · 6 رمي الثاني · 7 استعادته", async () => {
    await reset(false);
    /* 1 */ const a0 = (await Wd()).angle; await drag(500, 780, 900, 780, 12, 25); await p.waitForTimeout(300); await p.keyboard.down("Shift"); await drag(420, 790, 760, 790, 12, 25); await p.keyboard.up("Shift"); await p.waitForTimeout(900);
    const w1 = await Wd(); ok("1) تدوير مساحة العمل كلها: الاسطوانة والقاعة (yaw)", Math.abs(w1.angle - a0) > 15 && Math.abs(w1.yaw) > 5 && (await MODE()).mode === "world", "mouse", w1);
    /* 2 */ await p.evaluate(() => SpatialOS.open("ord")); await p.waitForTimeout(1300); await p.evaluate(() => SpatialOS.open("ana")); await p.waitForTimeout(1500); await settled();
    ok("2) لوحان عائمان مفتوحان", !!(await P("ord")) && !!(await P("ana")), "api"); const posA = await P("ord"), posB = await P("ana");
    /* 3 */ const pa = await freePt("ord"); await p.mouse.click(pa[0], pa[1]); await p.waitForTimeout(300); const W3 = await Wd(), B3 = await P("ana");
    const rot = await (await p.$(await sel("ord", ".pn-rot"))).boundingBox(); await p.mouse.move(rot.x + 14, rot.y + 14); await p.mouse.down(); for (let i = 1; i <= 10; i++) { await p.mouse.move(rot.x + 14 + i * 28, rot.y + 14 + i * 5); await p.waitForTimeout(40); } await p.mouse.up(); await p.waitForTimeout(600); await calm("ord");
    const A3 = await P("ord"), W3b = await Wd(), B3b = await P("ana");
    ok("3) تدوير الأول فقط: زاويته تغيّرت", Math.abs(A3.ry - posA.ry) > 4, "mouse", [posA.ry, A3.ry]); ok("   الثاني لم يتحرك ولا يدور", same(B3, B3b), "api", [B3, B3b]);
    ok("   البيئة لم تتحرك (angle/yaw/pa)", near(W3.angle, W3b.angle, .01) && near(W3.yaw, W3b.yaw, .01) && near(W3.pa, W3b.pa, .01), "api", [W3, W3b]);
    /* 4 */ const pb = await freePt("ana"); await p.mouse.move(pb[0], pb[1]); await p.mouse.down(); const m4 = await MODE(); for (let i = 1; i <= 10; i++) { await p.mouse.move(pb[0] - i * 17, pb[1] + i * 7); await p.waitForTimeout(40); } await p.mouse.up(); await p.waitForTimeout(1200);
    const A4 = await P("ord"), B4 = await P("ana"), W4 = await Wd();
    ok("4) تحريك الثاني باستقلال: تغيّر موضعه", Math.hypot(B4.x - posB.x, B4.y - posB.y) > 60, "mouse", [posB.x, posB.y, B4.x, B4.y]); ok("   التحديد انتقل إليه وحده", m4.sel === "ana" && m4.marked.length === 1, "api", m4);
    ok("   الأول بقي بتدويره كما هو", same(A3, A4, .6), "api", [A3, A4]); ok("   والبيئة ثابتة", near(W3.angle, W4.angle, .01) && near(W3.yaw, W4.yaw, .01) && near(W3.pa, W4.pa, .01), "api", [W3, W4]);
    /* 5 */ const mx = await (await p.$(await sel("ord", ".pn-max"))).boundingBox(); await p.mouse.click(mx.x + mx.width / 2, mx.y + mx.height / 2); await p.waitForTimeout(900);
    const A5 = await P("ord"), B5 = await P("ana"), W5 = await Wd(), m5 = await MODE();
    ok("5) توسيع الأول: وضع التركيز واللوح موسَّع", A5.big && m5.mode === "focus" && m5.sel === "ord", "mouse", m5); ok("   الثاني لم يتحرك", same(B4, B5, .6), "api", [B4, B5]); ok("   والبيئة ثابتة", near(W4.angle, W5.angle, .01) && near(W4.yaw, W5.yaw, .01), "api");
    const hh = await H("ord"); await drag(hh.x + hh.width / 2, hh.y + hh.height / 2, hh.x + hh.width / 2 + 160, hh.y + hh.height / 2 + 90, 8, 30); await p.waitForTimeout(500); const A5b = await P("ord");
    ok("   في التركيز اللوح مثبّت: السحب على ترويسته لا يزحزحه", near(A5.x, A5b.x, .5) && near(A5.y, A5b.y, .5), "mouse", [A5.x, A5b.x, A5.y, A5b.y]);
    /* 6 */ const p6 = await freePt("ana"); ok("6) الثاني قابل للإمساك رغم اللوح الموسَّع (جزء من ترويسته ظاهر)", !!p6, "api", p6); let thrown = false, rel = null, tries = 0, fxN = 0;
    while (!thrown && tries < 4) { tries++; const q = tries === 1 ? p6 : await freePt("ana"); if (!q) break; const dir = (await P("ana")).x >= 0 ? 1 : -1; await p.mouse.move(q[0], q[1]); await p.mouse.down(); const n = 3 + tries; for (let i = 1; i <= n; i++) { await p.mouse.move(q[0] + dir * i * (520 / n), q[1] - i * 4); await p.waitForTimeout(8 + tries * 4); } await p.mouse.up(); fxN = 0; for (let k = 0; k < 12; k++) { await p.waitForTimeout(100); fxN = Math.max(fxN, await p.evaluate(() => FX.count())); } await p.waitForTimeout(300); thrown = !(await P("ana")); rel = await p.evaluate(() => SpatialOS.lastRelease); if (!thrown) await p.evaluate(() => SpatialOS.setOrbit(false)); }
    ok("6) رمي الثاني بعيداً: أُزيل بعد التسارع والتصغير والتلاشي", thrown, "mouse", rel); ok("   جسيمات التلاشي ظهرت", fxN > 10, "api", fxN);
    const A6 = await P("ord"), W6 = await Wd(), m6 = await MODE();
    ok("   الأول بقي موسَّعاً كما هو", A6.big && same(A5, A6, .6), "api"); ok("   البيئة ثابتة", near(W5.angle, W6.angle, .02) && near(W5.yaw, W6.yaw, .01), "api", [W5.angle, W6.angle]); ok("   والتحديد عاد إلى اللوح الموسَّع (التركيز)", m6.mode === "focus" && m6.sel === "ord", "api", m6);
    /* 7 */ const getNd = () => p.evaluate(() => { const n = [...document.querySelectorAll('.node')].find(e => e.dataset.id === "ana"); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, ok: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) && n.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) }; });
    let nd = await getNd(), tr = 0; while ((!nd || !nd.ok) && tr < 9) { tr++; await drag(tr % 2 ? 420 : 700, 860, tr % 2 ? 560 : 560, 860, 6, 30); await p.waitForTimeout(500); await settled(); nd = await getNd(); }
    let collapsed = false; if (!nd || !nd.ok) { /* اللوح الموسَّع يغطي مركز المشهد فتُخفى الاسطوانة خلفه: الخروج من التركيز (Esc) يكشفها */ collapsed = true; await p.keyboard.press("Escape"); await p.waitForTimeout(900); nd = await getNd(); }
    ok("7) عقدة القسم المرمي ظاهرة على الاسطوانة وقابلة للنقر" + (collapsed ? " (بعد Esc لأن اللوح الموسَّع كان يغطيها)" : ""), !!nd && nd.ok, "api", nd); if (nd) await p.mouse.click(nd.x, nd.y); await p.waitForTimeout(1600);
    const B7 = await P("ana"), A7 = await P("ord"), m7 = await MODE(); ok("   استُعيد من الاسطوانة بنقرة حقيقية", !!B7 && !B7.min, "mouse", B7 && { x: B7.x, y: B7.y });
    ok("   والأول ما زال في مكانه" + (collapsed ? " (بحجمه الصغير بعد Esc)" : " موسَّعاً"), A7.big === !collapsed && (collapsed || (near(A6.x, A7.x, .6) && near(A6.y, A7.y, .6))), "api", [A6.big, A7.big]); ok("   وقيمة yaw كما بعد الخطوة 1 (لم تتبدّل طوال السيناريو)", near((await Wd()).yaw, w1.yaw, .01), "api", [w1.yaw, (await Wd()).yaw]);
  });
  ok("لا أخطاء صفحة (سطح المكتب)", errs.length === 0, "api", errs); await c.close();
}

async function mobile(b) {
  const c = await b.newContext({ viewport: { width: 448, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), p = await c.newPage(), errs = []; p.setDefaultTimeout(7000);
  p.on("pageerror", e => errs.push(String(e).slice(0, 160))); await p.goto(URL); await p.waitForTimeout(2200); const cdp = await c.newCDPSession(p);
  const T = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  const P = id => p.evaluate(i => { const q = SpatialOS.panels.get(i); return q ? { ...q.st, big: q.big } : null; }, id), Wd = () => p.evaluate(() => SpatialOS.world()), MODE = () => p.evaluate(() => ({ mode: SpatialOS.mode, sel: SpatialOS.objSel }));
  const hdr = async n => (await p.$(`.panel[aria-label="${n}"] .pn-h h3`)).boundingBox();
  await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(700);
  await section("N6. هاتف — لمس حقيقي (CDP): الأوضاع والتحكم بلوح دون تحريك البيئة", async () => {
    const mb = await (await p.$("#modebar")).boundingBox(); ok("شريط الأوضاع داخل الشاشة ولا يتجاوز عرضها", mb.x >= 0 && mb.x + mb.width <= 448.5, "api", mb);
    await p.click('#dock button[data-id="ord"]'); await p.waitForTimeout(1500); await p.click('#dock button[data-id="ana"]'); await p.waitForTimeout(1500);
    const mb2 = await (await p.$("#modebar")).boundingBox(), hb = await p.evaluate(() => [...document.querySelectorAll(".panel .pn-h")].map(e => { const r = e.getBoundingClientRect(); return [r.top, r.bottom]; })); ok("الشريط لا يغطي ترويسات ألواح الهاتف (ومساحته لا تعترض اللمس أصلاً)", hb.every(([a, b2]) => b2 <= mb2.y || a >= mb2.y + mb2.height) && (await p.evaluate(() => getComputedStyle(document.getElementById("modebar")).pointerEvents)) === "none", "api", [mb2.y, hb]);
    const h = await hdr("الطلبات"), tx = h.x + h.width / 2, ty = h.y + h.height / 2; await T("touchStart", [[tx, ty]]); await T("touchEnd", []); await p.waitForTimeout(300); let m = await MODE();
    ok("لمسة على اللوح تحدّده → وضع الكائن", m.mode === "object" && m.sel === "ord", "cdp-touch", m);
    const w0 = await Wd(), B0 = await P("ana"), A0 = await P("ord"); await p.tap('#modebar [data-t="rot"]'); await p.waitForTimeout(800); /* بعد نافذة النقر المزدوج (520ms) كي لا تُعدّ اللمسة الثانية توسيعاً */
    const h2 = await hdr("الطلبات"); await T("touchStart", [[h2.x + h2.width / 2, h2.y + h2.height / 2]]); let act = null; for (let i = 1; i <= 8; i++) { await T("touchMove", [[h2.x + h2.width / 2 + i * 12, h2.y + h2.height / 2 + i * 6]]); await p.waitForTimeout(40); if (i === 5) act = await p.evaluate(() => document.querySelector(".panel[data-act]") && document.querySelector(".panel[data-act]").dataset.act); } await T("touchEnd", []); await p.waitForTimeout(900);
    const A1 = await P("ord"), B1 = await P("ana"), w1 = await Wd();
    ok("أداة التدوير باللمس: يدور اللوح المحدَّد وحده", Math.abs(A1.ry - A0.ry) > 3 || Math.abs(A1.rx - A0.rx) > 2, "cdp-touch", [A0.ry, A1.ry, A0.rx, A1.rx]); ok("   data-act=rot أثناء اللمس", act === "rot", "cdp-touch", act);
    ok("   اللوح الآخر ثابت والبيئة ثابتة", same(B0, B1, .6) && near(w0.angle, w1.angle, .01) && near(w0.yaw, w1.yaw, .01), "api", [w0, w1]);
    /* التواء بإصبعين فوق لوح محدَّد = ميل اللوح لا تدوير القاعة */
    const pb = await (await p.$('.panel[aria-label="الطلبات"]')).boundingBox(), cx = pb.x + pb.width / 2, cy = Math.max(200, Math.min(700, pb.y + pb.height / 2)), yw = (await Wd()).yaw;
    await T("touchStart", [[cx - 40, cy], [cx + 40, cy]]); for (let i = 1; i <= 8; i++) { const a = i * 4 * Math.PI / 180; await T("touchMove", [[cx - 40 * Math.cos(a), cy - 40 * Math.sin(a)], [cx + 40 * Math.cos(a), cy + 40 * Math.sin(a)]]); await p.waitForTimeout(30); } const rz = (await P("ord")).rz; await T("touchEnd", []); await p.waitForTimeout(700);
    ok("التواء بإصبعين فوق اللوح يميله هو (rz) ولا يدوّر القاعة", Math.abs(rz) > 4 && near((await Wd()).yaw, yw, .01), "cdp-touch", [rz, yw, (await Wd()).yaw]);
    const bg = await p.evaluate(() => { for (let y = innerHeight - 90; y > 90; y -= 24) for (let x = 20; x < innerWidth - 120; x += 24) { const t = document.elementFromPoint(x, y), t2 = document.elementFromPoint(x + 100, y); if (t && t2 && t.closest("#stage") && t2.closest("#stage") && !t.closest(".panel,.modebar,.dock,.node,.wcard,button")) return [x, y]; } return null; });
    ok("توجد نقطة خلفية حرّة للمس على الهاتف", !!bg, "api", bg);
    await T("touchStart", [[bg[0], bg[1]]]); await T("touchMove", [[bg[0] + 40, bg[1]]]); await T("touchMove", [[bg[0] + 80, bg[1]]]); await T("touchMove", [[bg[0] + 100, bg[1]]]); await T("touchEnd", []); await p.waitForTimeout(400); m = await MODE(); ok("لمس/سحب الخلفية يعيد وضع العالم ويدوّر الاسطوانة", m.mode === "world" && Math.abs((await Wd()).angle - w1.angle) > 5, "cdp-touch", m);
    ok("لا تمرير أفقي ولا تكبير للصفحة", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && visualViewport.scale === 1), "api");
  });
  ok("لا أخطاء صفحة (هاتف)", errs.length === 0, "api", errs); await c.close();
}

(async () => { const b = await chromium.launch(); if (only === "all" || only === "desktop") await desktop(b); if (only === "all" || only === "mobile") await mobile(b); await b.close(); console.log(R.join("\n")); console.log(fails ? "\nFAILED: " + fails : "\nALL PASSED (" + R.filter(x => /^PASS/.test(x)).length + ")"); process.exit(fails ? 1 : 0); })();
