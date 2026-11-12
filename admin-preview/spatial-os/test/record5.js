/* المرحلة 5 — تسجيل السيناريو الكامل ذي الخطوات السبع (فأرة حقيقية على سطح المكتب + لمس CDP على الهاتف) مع شرح كل خطوة وقراءة حيّة لوضع التفاعل.
   كل حركة إدخال حقيقي (لا حركة مبرمجة). التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/record5.js <مجلد-الإخراج> */
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const OUT = path.resolve(process.argv[2] || "recordings"), URL = process.env.URL || "http://localhost:8765/admin-preview/spatial-os/index.html"; fs.mkdirSync(OUT, { recursive: true });
const cap = (p, t, sub) => p.evaluate(([t, sub]) => { let c = document.getElementById("__cap"); if (!c) { c = document.createElement("div"); c.id = "__cap"; c.style.cssText = "position:fixed;inset-inline:0;top:46px;margin:auto;width:max-content;max-width:92vw;z-index:99999;padding:9px 20px;border-radius:14px;background:rgba(0,0,0,.85);border:1px solid #dcff1f;color:#fff;font:800 15px Cairo,sans-serif;text-align:center;pointer-events:none"; document.body.appendChild(c); } c.innerHTML = t + (sub ? '<div style="font-weight:600;font-size:12px;color:#9fd">' + sub + "</div>" : ""); }, [t, sub]);
async function session(name, mobile, fn) {
  const b = await chromium.launch(), vp = mobile ? { width: 448, height: 900 } : { width: 1280, height: 800 };
  const c = await b.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, recordVideo: { dir: OUT + "/tmp-" + name, size: vp } }), p = await c.newPage(); await p.goto(URL); await p.waitForTimeout(2000);
  const cdp = mobile ? await c.newCDPSession(p) : null; const T = mobile ? (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) }) : null;
  const ctx = {
    p, T, cap: (t, s) => cap(p, t, s), wait: ms => p.waitForTimeout(ms),
    drag: async (x0, y0, x1, y1, n = 14, d = 40) => { await p.mouse.move(x0, y0); await p.mouse.down(); for (let i = 1; i <= n; i++) { await p.mouse.move(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); await p.waitForTimeout(d); } await p.mouse.up(); },
    swipe: async (a, b2, n = 10, d = 40) => { await T("touchStart", [a]); for (let i = 1; i <= n; i++) { await T("touchMove", [[a[0] + (b2[0] - a[0]) * i / n, a[1] + (b2[1] - a[1]) * i / n]]); await p.waitForTimeout(d); } await T("touchEnd", []); },
    hdr: async nm => (await p.$(`.panel[aria-label="${nm}"] .pn-h h3`)).boundingBox(),
    box: async nm => (await p.$(`.panel[aria-label="${nm}"]`)).boundingBox(),
    /* فتح قسم بنقر حقيقي على بطاقة جدار ظاهرة (أو زر الشريط السفلي على الهاتف) */
    openCard: async id => { if (mobile) { await p.click(`#dock button[data-id="${id}"]`); } else {
      const pt = await p.evaluate(id => { const out = []; document.querySelectorAll(`.wcard[data-id="${id}"]`).forEach(e => { const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; if (x > 15 && x < innerWidth - 15 && y > 30 && y < innerHeight - 30) { const t = document.elementFromPoint(x, y); if (t && t.closest(".wcard") === e) out.push([x, y]); } }); return out[0] || null; }, id);
      if (pt) await p.mouse.click(pt[0], pt[1]); else { /* لا بطاقة ظاهرة لهذا القسم: نقر حقيقي على عقدته المدارية بعد إحضارها للمقدمة */ await p.evaluate(id => SpatialOS.select(id), id); await p.waitForTimeout(2500); const nb = await p.evaluate(id => { const r = document.querySelector(`.node[data-id="${id}"]`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id); await p.mouse.click(nb[0], nb[1]); } } await p.waitForTimeout(2200); },
    state: () => p.evaluate(() => Object.fromEntries([...SpatialOS.panels].map(([id, q]) => [id, { ...q.st, min: q.min, big: q.big }]))),
  };
  await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(1000);
  try { await fn(ctx); } finally { await c.close(); await b.close(); }
  const f = fs.readdirSync(OUT + "/tmp-" + name).find(x => x.endsWith(".webm")); fs.renameSync(OUT + "/tmp-" + name + "/" + f, OUT + "/" + name + ".webm"); fs.rmdirSync(OUT + "/tmp-" + name); console.log("saved", name);
}
const ensure = async (x, id) => { await x.openCard(id); await x.wait(1600); if (!(await x.p.evaluate(i => !!SpatialOS.panels.get(i), id))) { await x.p.evaluate(i => SpatialOS.open(i), id); await x.wait(1600); } };
const freePt = (p, id) => p.evaluate(i => { const q = SpatialOS.panels.get(i), h = q.el.querySelector(".pn-h"), r = h.getBoundingClientRect(), y = r.top + r.height / 2; for (let x = Math.max(8, r.left + 8); x < Math.min(innerWidth - 8, r.right - 8); x += 6) { const t = document.elementFromPoint(x, y); if (t && t.closest(".panel") === q.el && !t.closest("button")) return [x, y]; } return null; }, id);
const fastDrag = async (p, x0, y0, x1, y1, n, d) => { await p.mouse.move(x0, y0); await p.mouse.down(); for (let i = 1; i <= n; i++) { await p.mouse.move(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); await p.waitForTimeout(d); } await p.mouse.up(); };
(async () => {
  await session("09-phase5-seven-step-scenario", false, async x => { const { p } = x; await p.evaluate(() => SpatialOS.setOrbit(false));
    await x.cap("1) وضع العالم: اسحب الخلفية فتدور الاسطوانة، وShift+سحب يدوّر القاعة كلها", "الشريط أسفل اليمين يعرض الوضع الحالي"); await x.wait(1500);
    await x.drag(420, 700, 800, 700, 22, 45); await x.wait(1200); await p.keyboard.down("Shift"); await x.drag(380, 740, 820, 740, 22, 45); await p.keyboard.up("Shift"); await x.wait(2000);
    await x.cap("2) افتح لوحين عائمين (بنقر بطاقتين من الجدار)"); await ensure(x, "ord"); await ensure(x, "ana"); await x.wait(1200);
    await x.cap("3) وضع الكائن: انقر الأول فيُحدَّد (أقواس ليمونية) ثم دوّره بمقبض ⟳ — الثاني والبيئة ثابتان"); let pt = await freePt(p, "ord"); await p.mouse.click(pt[0], pt[1]); await x.wait(1400);
    let r = await (await p.$('.panel[aria-label="الطلبات"] .pn-rot')).boundingBox(); await p.mouse.move(r.x + 14, r.y + 14); await p.mouse.down(); for (let i = 1; i <= 24; i++) { await p.mouse.move(r.x + 14 + i * 14, r.y + 14 + i * 4); await p.waitForTimeout(55); } await p.mouse.up(); await x.wait(2600);
    await x.cap("4) حرّك الثاني باستقلال: ينتقل التحديد إليه وحده وتبقى زاوية الأول كما هي"); pt = await freePt(p, "ana"); await p.mouse.move(pt[0], pt[1]); await p.mouse.down(); for (let i = 1; i <= 22; i++) { await p.mouse.move(pt[0] - i * 12, pt[1] + i * 5); await p.waitForTimeout(55); } await p.mouse.up(); await x.wait(2600);
    await x.cap("5) وضع التركيز: وسّع الأول (□) فيمتلئ مركز المشهد ويثبت — الثاني والاسطوانة لم يتحركا"); r = await (await p.$('.panel[aria-label="الطلبات"] .pn-max')).boundingBox(); await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2); await x.wait(3200);
    await x.cap("6) ارمِ الثاني بعيداً: يتوهّج «حرّر للرمي» قرب الحافة ثم يتسارع ويصغر ويتلاشى بجسيمات، والأول يبقى موسَّعاً"); pt = await freePt(p, "ana"); const dir = (await x.state()).ana.x >= 0 ? 1 : -1;
    await p.mouse.move(pt[0], pt[1]); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(pt[0] + dir * i * 55, pt[1] - i * 3); await p.waitForTimeout(110); } await x.wait(700); await p.mouse.up(); await x.wait(3000);
    await x.cap("7) الاستعادة من الاسطوانة: اللوح الموسَّع يخفيها فنخرج من التركيز بـEsc ثم ننقر عقدة القسم", "يعود اللوح بحجمه ومحتواه المحفوظين"); await p.keyboard.press("Escape"); await x.wait(1800);
    let nd = null; for (let t = 0; t < 9 && !nd; t++) { nd = await p.evaluate(() => { const n = [...document.querySelectorAll(".node")].find(e => e.dataset.id === "ana"); if (!n) return null; const r = n.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, h = document.elementFromPoint(cx, cy); return h && n.contains(h) ? [cx, cy] : null; }); if (!nd) { await x.drag(420, 860, 560, 860, 8, 40); await x.wait(900); } }
    if (nd) { await p.mouse.move(nd[0], nd[1]); await x.wait(900); await p.mouse.click(nd[0], nd[1]); } await x.wait(3500);
    await x.cap("انتهى: لم تتحرك البيئة أثناء أي تعامل مع كائن منفرد (تأكّد الاختبار الآلي من angle/yaw/pa)"); await x.wait(2500); });
  await session("10-phase5-object-tools", false, async x => { const { p } = x; await p.evaluate(() => SpatialOS.setOrbit(false));
    await x.cap("أدوات الكائن: انقر لوحاً ثم اختر الأداة من الشريط أو بالمفاتيح (M تحريك · R تدوير · T ميل · Z عمق)"); await ensure(x, "ord"); await x.wait(600); let pt = await freePt(p, "ord"); await p.mouse.click(pt[0], pt[1]); await x.wait(1500);
    await x.cap("R — تدوير أفقي/رأسي (لون برتقالي أثناء السحب)"); await p.keyboard.press("r"); pt = await freePt(p, "ord"); await fastDrag(p, pt[0], pt[1], pt[0] + 220, pt[1] + 80, 22, 55); await x.wait(2400);
    await x.cap("T — ميل حول محور الشاشة (يستقر ضمن ±12°)"); await p.keyboard.press("t"); pt = await freePt(p, "ord"); await fastDrag(p, pt[0], pt[1], pt[0] + 170, pt[1], 18, 55); await x.wait(2400);
    await x.cap("Z — عمق: اسحب للأعلى فيقترب ويكبر بالمنظور؛ مقياس العمق على الحافة"); await p.keyboard.press("z"); pt = await freePt(p, "ord"); await fastDrag(p, pt[0], pt[1], pt[0], pt[1] - 150, 22, 55); await x.wait(1200); pt = await freePt(p, "ord"); await fastDrag(p, pt[0], pt[1], pt[0], pt[1] + 220, 26, 55); await x.wait(2200);
    await x.cap("M — تحريك X/Y؛ وعند الاقتراب من الحافة يتوهّج اللوح وتظهر «حرّر للرمي»؛ أعده للداخل فتنطفئ الإشارة ولا يُرمى"); await p.keyboard.press("m"); pt = await freePt(p, "ord"); const dir = (await x.state()).ord.x >= 0 ? 1 : -1;
    await p.mouse.move(pt[0], pt[1]); await p.mouse.down(); for (let i = 1; i <= 14; i++) { await p.mouse.move(pt[0] + dir * i * 55, pt[1]); await p.waitForTimeout(80); } await x.wait(1800); for (let i = 1; i <= 14; i++) { await p.mouse.move(pt[0] + dir * 770 - dir * i * 60, pt[1]); await p.waitForTimeout(110); } await p.mouse.up(); await x.wait(2200); });
  await session("11-phase5-touch", true, async x => { const { p, T } = x;
    await x.cap("هاتف (لمس حقيقي): افتح لوحين من الشريط السفلي"); await x.openCard("ord"); await x.wait(1700); await x.openCard("ana"); await x.wait(2000);
    await x.cap("لمسة على لوح = تحديده (وضع الكائن)"); let h = await x.hdr("الطلبات"); await T("touchStart", [[h.x + h.width / 2, h.y + h.height / 2]]); await T("touchEnd", []); await x.wait(1600);
    await x.cap("أداة «تدوير» ثم سحب الترويسة: يدور اللوح المحدَّد وحده"); await p.tap('#mread'); await x.wait(400); await p.tap('#modebar [data-t="rot"]'); await x.wait(900); h = await x.hdr("الطلبات"); await x.swipe([h.x + h.width / 2, h.y + h.height / 2], [h.x + h.width / 2 + 90, h.y + h.height / 2 + 40], 14, 60); await x.wait(2000);
    await x.cap("التواء بإصبعين فوق اللوح = ميل اللوح هو (لا تدوير القاعة)"); const b = await x.box("الطلبات"), cx = b.x + b.width / 2, cy = Math.max(200, Math.min(660, b.y + b.height / 2));
    await T("touchStart", [[cx - 40, cy], [cx + 40, cy]]); for (let i = 1; i <= 12; i++) { const a = i * 3.2 * Math.PI / 180; await T("touchMove", [[cx - 40 * Math.cos(a), cy - 40 * Math.sin(a)], [cx + 40 * Math.cos(a), cy + 40 * Math.sin(a)]]); await p.waitForTimeout(60); } await x.wait(500); await T("touchEnd", []); await x.wait(1800);
    await x.cap("سحب الخلفية = العودة لوضع العالم وتدوير الاسطوانة"); const bg = await p.evaluate(() => { for (let y = innerHeight - 90; y > 90; y -= 24) for (let xx = 20; xx < innerWidth - 120; xx += 24) { const t = document.elementFromPoint(xx, y), t2 = document.elementFromPoint(xx + 100, y); if (t && t2 && t.closest("#stage") && t2.closest("#stage") && !t.closest(".panel,.modebar,.dock,.node,.wcard,button")) return [xx, y]; } return null; });
    if (bg) await x.swipe(bg, [bg[0] + 110, bg[1]], 10, 60); await x.wait(2200); });
})();
