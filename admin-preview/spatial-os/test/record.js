/* تسجيل شاشة لكل تفاعل على حدة (عناوين على الشاشة). التشغيل:
   NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/record.js <مجلد-الإخراج>
   ينتج desktop.webm (فأرة/لوحة مفاتيح حقيقية) وmobile.webm (لمس CDP حقيقي؛ الرمي بأحداث Pointer مصطنعة وذلك معلَن على الشاشة). */
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const OUT = path.resolve(process.argv[2] || "recordings"), URL = process.env.URL || "http://localhost:8765/admin-preview/spatial-os/index.html"; fs.mkdirSync(OUT, { recursive: true });
const cap = (p, t, sub) => p.evaluate(([t, sub]) => { let c = document.getElementById("__cap"); if (!c) { c = document.createElement("div"); c.id = "__cap"; c.style.cssText = "position:fixed;inset-inline:0;bottom:40px;margin:auto;width:max-content;max-width:92vw;z-index:99999;padding:10px 22px;border-radius:14px;background:rgba(0,0,0,.82);border:1px solid #dcff1f;color:#fff;font:800 16px Cairo,sans-serif;text-align:center;pointer-events:none"; document.body.appendChild(c); } c.innerHTML = t + (sub ? '<div style=\"font-weight:600;font-size:12px;color:#9fd\">' + sub + "</div>" : ""); }, [t, sub]);
(async () => {
  const b = await chromium.launch();
  { /* سطح المكتب */
    const c = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: OUT + "/tmp-d", size: { width: 1280, height: 800 } } }), p = await c.newPage(); await p.goto(URL); await p.waitForTimeout(1800);
    const drag = async (x0, y0, x1, y1, n = 14, d = 40) => { await p.mouse.move(x0, y0); await p.mouse.down(); for (let i = 1; i <= n; i++) { await p.mouse.move(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); await p.waitForTimeout(d); } await p.mouse.up(); };
    const hdr = async nm => (await p.$(`.panel[aria-label="${nm}"] .pn-h h3`)).boundingBox(), hover = async nm => { let h = await hdr(nm); await p.mouse.move(h.x + h.width / 2, h.y + 8); await p.waitForTimeout(400); return hdr(nm); };
    await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(800);
    await cap(p, "1) تدوير الاسطوانة بسحب الخلفية (فأرة)"); await drag(420, 700, 820, 700, 16, 45); await p.waitForTimeout(1500);
    await cap(p, "2) ملاحة الاسطوانة: أسهم لوحة المفاتيح تحدّد قسماً وتدوّره نحو المستخدم", "← → ثم Enter يفتح القسم المحدَّد"); await p.keyboard.press("ArrowRight"); await p.waitForTimeout(1800); await p.keyboard.press("ArrowRight"); await p.waitForTimeout(2000); await p.keyboard.press("Enter"); await p.waitForTimeout(2500); await p.evaluate(() => { for (const id of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(id, "close"); }); await p.waitForTimeout(1200);
    await cap(p, "3) اختيار قسم من المدار بالنقر: يخرج اللوح من الاسطوانة"); await p.evaluate(() => { SpatialOS.setOrbit(false); }); const nb = await p.evaluate(() => { const n = document.querySelector('.node[data-id="ord"]'); SpatialOS.select("ord"); return 0; }); await p.waitForTimeout(2200);
    const o = await p.evaluate(() => { const r = document.querySelector('.node[data-id="ord"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await p.mouse.click(o[0], o[1]); await p.waitForTimeout(2500);
    await cap(p, "4) سحب اللوح بحرية في الفضاء"); let h = await hover("الطلبات"); await drag(h.x + h.width / 2, h.y + 8, h.x + h.width / 2 - 140, h.y + 90, 16, 45); await p.waitForTimeout(1200);
    await cap(p, "5) تدوير اللوح (مقبض ⟳)"); const r = await (await p.$('.panel[aria-label="الطلبات"] .pn-rot')).boundingBox(); await drag(r.x + 14, r.y + 14, r.x + 100, r.y + 30, 14, 45); await p.waitForTimeout(1400);
    await cap(p, "6) تحجيم بمقبض الزاوية + عجلة الفأرة"); const rs = await (await p.$('.panel[aria-label="الطلبات"] .pn-rs')).boundingBox(); await drag(rs.x + 12, rs.y + 12, rs.x - 60, rs.y + 50, 14, 45); h = await hover("الطلبات"); for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, -100); await p.waitForTimeout(120); } await p.waitForTimeout(1200);
    await p.evaluate(() => { SpatialOS.dismiss("ord", "close"); }); await p.waitForTimeout(1000); await p.evaluate(() => SpatialOS.open("inv")); await p.waitForTimeout(2000);
    await cap(p, "7) نقر مزدوج: توسيع المخزون بمحتواه الكامل (جدول الحركة والأصناف)"); h = await hover("المخزون"); await p.mouse.dblclick(h.x + h.width / 2, h.y + 8); await p.waitForTimeout(3200);
    await cap(p, "8) نقر مزدوج ثانٍ: استعادة الحجم"); h = await hdr("المخزون"); await p.mouse.dblclick(h.x + h.width / 2, h.y + 8); await p.waitForTimeout(2400);
    await p.evaluate(() => { SpatialOS.dismiss("inv", "close"); }); await p.waitForTimeout(900); await p.evaluate(() => { SpatialOS.setOrbit(false); SpatialOS.open("ord"); }); await p.waitForTimeout(2000);
    await cap(p, "9) رمي اللوح نحو الحافة: يتلاشى بجسيمات ثم يعاد فتحه من الاسطوانة (بحالته: فلتر «جديدة»)"); await p.click('.panel[aria-label="الطلبات"] [data-f="new"]'); await p.waitForTimeout(800); h = await hover("الطلبات"); const dir = (await p.evaluate(() => SpatialOS.panels.get("ord").st.x)) >= 0 ? 1 : -1;
    await p.mouse.down(); for (let i = 1; i <= 5; i++) { await p.mouse.move(h.x + h.width / 2 + dir * i * 90, h.y + 8 - i * 8); await p.waitForTimeout(16); } await p.mouse.up(); await p.waitForTimeout(3000);
    const o2 = await p.evaluate(() => { const r = document.querySelector('.node[data-id="ord"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await p.mouse.click(o2[0], o2[1]); await p.waitForTimeout(3000);
    await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(900);
    await cap(p, "10) نوافذ متعددة مستقلة: تخطيط واعٍ بالتصادم، إحضار للأمام، تصغير واستعادة"); for (const i of ["ord", "ana", "inv", "prod"]) { await p.evaluate(x => SpatialOS.open(x), i); await p.waitForTimeout(900); } await p.waitForTimeout(1500);
    h = await hdr("التحليلات"); await p.mouse.click(h.x + h.width / 2, h.y + 8); await p.waitForTimeout(800); await p.click('.panel[aria-label="المنتجات"] .pn-min'); await p.waitForTimeout(1500); await p.evaluate(() => SpatialOS.open("prod")); await p.waitForTimeout(2200);
    await cap(p, "11) المدار: الألواح تدور حول الاسطوانة؛ المؤشر فوق لوح يوقف دورانه؛ السحب بعيداً يحرّره؛ ◎ يعيده"); await p.evaluate(() => SpatialOS.setOrbit(true)); await p.waitForTimeout(2500); await p.mouse.move(640, 760); await p.waitForTimeout(3000);
    const fr = await p.evaluate(() => [...SpatialOS.panels.values()].filter(q => !q.min).sort((a, b) => b.st.z - a.st.z)[0].sec.name); h = await hover(fr); await p.waitForTimeout(1500);
    await drag(h.x + h.width / 2, h.y + 8, h.x + h.width / 2 + 30, h.y + 190, 14, 45); await p.waitForTimeout(2500); await p.hover(`.panel[aria-label="${fr}"] .pn-h`); await p.waitForTimeout(400); await p.click(`.panel[aria-label="${fr}"] .pn-orb`); await p.mouse.move(640, 770); await p.waitForTimeout(3500);
    await p.evaluate(() => SpatialOS.panels.forEach((q, id) => id !== "ana" && SpatialOS.dismiss(id, "close"))); await p.waitForTimeout(1200);
    await c.close();
  }
  { /* الهاتف */
    const c = await b.newContext({ viewport: { width: 448, height: 900 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, recordVideo: { dir: OUT + "/tmp-m", size: { width: 448, height: 900 } } }), p = await c.newPage(); await p.goto(URL); await p.waitForTimeout(2200); const cdp = await c.newCDPSession(p);
    const T = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
    const swipe = async (a, b2, n = 10, d = 40) => { await T("touchStart", [a]); for (let i = 1; i <= n; i++) { await T("touchMove", [[a[0] + (b2[0] - a[0]) * i / n, a[1] + (b2[1] - a[1]) * i / n]]); await p.waitForTimeout(d); } await T("touchEnd", []); };
    const hdr = async nm => (await p.$(`.panel[aria-label="${nm}"] .pn-h h3`)).boundingBox();
    await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(900);
    await cap(p, "هاتف 1) سحب باللمس لتدوير الاسطوانة"); await swipe([120, 330], [360, 330], 12, 45); await p.waitForTimeout(1500);
    await cap(p, "هاتف 2) الشريط السفلي: فتح قسم"); await p.click('#dock button[data-id="ana"]'); await p.waitForTimeout(2500);
    await cap(p, "هاتف 3) سحب اللوح باللمس"); let h = await hdr("التحليلات"); await swipe([h.x + h.width / 2, h.y + 10], [h.x + h.width / 2 - 30, h.y - 90], 10, 45); await p.waitForTimeout(1200);
    await cap(p, "هاتف 4) تدوير اللوح باللمس (مقبض ⟳)"); const rr = await (await p.$('.panel[aria-label="التحليلات"] .pn-rot')).boundingBox(); await swipe([rr.x + 14, rr.y + 14], [rr.x + 80, rr.y + 30], 10, 45); await p.waitForTimeout(1200);
    await cap(p, "هاتف 5) قرص بإصبعين لتكبير اللوح"); const pb = await (await p.$('.panel[aria-label="التحليلات"]')).boundingBox(), cx = pb.x + pb.width / 2, cy = Math.max(160, Math.min(760, pb.y + pb.height / 2)); await T("touchStart", [[cx - 30, cy], [cx + 30, cy]]); for (let i = 1; i <= 10; i++) { await T("touchMove", [[cx - 30 - i * 6, cy], [cx + 30 + i * 6, cy]]); await p.waitForTimeout(60); } await T("touchEnd", []); await p.waitForTimeout(1200);
    await p.evaluate(() => { const q = SpatialOS.panels.get("ana"); Object.assign(q.st, { s: 1, x: 0, y: 150, rx: 0, ry: 0 }); q.el.classList.add("tr2"); SpatialOS.open("ana"); }); await p.waitForTimeout(1200);
    await cap(p, "هاتف 6) تمرير محتوى اللوح رأسياً دون تدوير الاسطوانة أو تمرير الصفحة"); const bb = await (await p.$('.panel[aria-label="التحليلات"] .pn-b')).boundingBox(); await swipe([bb.x + bb.width / 2, bb.y + bb.height - 30], [bb.x + bb.width / 2, bb.y + 20], 12, 45); await p.waitForTimeout(1500);
    await cap(p, "هاتف 7) لمس مزدوج: توسيع ثم استعادة", "(أحداث Pointer مصطنعة بنوع touch؛ اللمس الحقيقي عبر CDP بطيء في هذه البيئة)"); const dt = () => p.evaluate(async () => { const h = document.querySelector('.panel[aria-label="التحليلات"] .pn-h'), r = h.getBoundingClientRect(); for (let k = 0; k < 2; k++) { for (const t of ["pointerdown", "pointerup"]) h.dispatchEvent(new PointerEvent(t, { pointerId: 5, pointerType: "touch", isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + 10, bubbles: true, cancelable: true })); await new Promise(r => setTimeout(r, 80)); } }); await dt(); await p.waitForTimeout(2500); await dt(); await p.waitForTimeout(2000);
    await cap(p, "هاتف 8) رمي اللوح نحو الحافة ثم إعادة فتحه من الشريط", "(الرمي بأحداث Pointer مصطنعة بسرعة محسوبة؛ لم يُجرَّب بإصبع حقيقي)"); h = await hdr("التحليلات"); await p.evaluate(async ([x, y]) => { const hh = document.querySelector('.panel[aria-label="التحليلات"] .pn-h'), ev = (t, px, py) => hh.dispatchEvent(new PointerEvent(t, { pointerId: 9, pointerType: "touch", isPrimary: true, clientX: px, clientY: py, bubbles: true, cancelable: true })); ev("pointerdown", x, y); for (let i = 1; i <= 7; i++) { await new Promise(r => setTimeout(r, 14)); ev("pointermove", x - i * 40, y - i * 12); } ev("pointerup", x - 280, y - 84); }, [h.x + h.width / 2, h.y + 10]); await p.waitForTimeout(2500);
    await p.click('#dock button[data-id="ana"]'); await p.waitForTimeout(3000);
    await c.close();
  }
  await b.close();
  for (const [d, n] of [["tmp-d", "desktop.webm"], ["tmp-m", "mobile.webm"]]) { const f = fs.readdirSync(OUT + "/" + d).find(x => x.endsWith(".webm")); fs.renameSync(OUT + "/" + d + "/" + f, OUT + "/" + n); fs.rmdirSync(OUT + "/" + d); }
  console.log("saved", OUT);
})();
