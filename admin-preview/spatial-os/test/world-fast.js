/* العالم الحقيقي: سرعة الفتح، المداران، بطاقات الرئيسية، اللوح الاحتياطي، جسر صوت الكرة، الوضع الخفيف.
   التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/world-fast.js  (متجر PHP محلي حقيقي عبر harness) */
const PW = require("playwright"), { startStore } = require("./harness"); const SHOTS = process.env.SHOTS || "";
const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 300) : "")); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await PW.chromium.launch(); const store = await startStore();
  try {
    const c = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await c.newPage(), errs = []; p.setDefaultTimeout(30000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await p.goto(store.base + "/admin.html"); await wait(800);
    await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
    const t0 = Date.now(); await p.goto(store.base + "/admin-preview/spatial-os/index.html?real=1"); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two, null, { timeout: 30000 }); const tw = Date.now() - t0;
    ok("العالم الحقيقي جاهز بسرعة بلا تحميل أي لوح (< 4 ث على معالج برمجي)", tw < 4000 && await p.evaluate(() => SpatialOS.panels.size === 0), { ms: tw });
    /* المداران */
    const o1 = await p.evaluate(() => ({ tab: SpatialOS.tab, subs: SpatialOS.subIds(), top: document.querySelectorAll(".node:not(.sub)").length, sub: document.querySelectorAll(".node.sub").length }));
    ok("المدار العلوي 6 مجموعات (قائمة لوحة التحكم) والثاني عناصر «المتجر» افتراضياً", o1.tab === "store" && o1.top === 6 && o1.sub === o1.subs.length && o1.subs[0] === "ord" && o1.subs.includes("payments") && o1.subs.includes("delivery"), o1);
    await p.evaluate(() => document.querySelector('.node:not(.sub)[data-id="prod"]').click()); await wait(700);
    const o2 = await p.evaluate(() => ({ tab: SpatialOS.tab, subs: SpatialOS.subIds(), panels: SpatialOS.panels.size, live: document.querySelectorAll(".node.sub:not(.out)").length }));
    ok("نقر تبويب في المدار العلوي لا يفتح لوحاً بل يبدّل بطاقات السفلي", o2.tab === "prod" && o2.panels === 0 && o2.subs[0] === "prod" && o2.subs.includes("categories") && !o2.subs.includes("payments") && o2.live === o2.subs.length, o2);
    /* بطاقات الرئيسية */
    await p.waitForFunction(() => SCParts.live, null, { timeout: 60000 }); const ps = await p.evaluate(() => ({ vis: SCParts.visible, n: document.querySelectorAll("#hparts .hp").length, kpi: document.querySelectorAll("#hparts .hp-kpi").length, txt: document.getElementById("hparts").innerText.slice(0, 80), cached: !!localStorage.getItem("sc_parts_v1") }));
    ok("بطاقات الصفحة الرئيسية الحقيقية ظاهرة (4 مؤشرات + مخطط + حالات + آخر الطلبات...) ومحفوظة للفتح الفوري", ps.vis && ps.kpi === 4 && ps.n >= 7 && ps.cached, ps);
    ok("بطاقات الرئيسية داخل الشاشة بلا تداخل مع وسط الاسطوانة", await p.evaluate(() => [...document.querySelectorAll("#hparts .hp")].every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight - 4 && (r.right < innerWidth * .26 || r.left > innerWidth * .74); })));
    /* اللوح الاحتياطي: فتح لوح فوري */
    await p.waitForFunction(() => SpatialOS.spare.ready, null, { timeout: 60000 }); const sup = await p.evaluate(() => SpatialOS.spare.supported);
    const t1 = Date.now(); await p.evaluate(() => SpatialOS.open("ord")); await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 30000 }); const to = Date.now() - t1, ad = await p.evaluate(() => SpatialOS.panels.get("ord").wasAdopted);
    ok("فتح لوح بعد التسخين فوري (< 1.2 ث) عبر اللوح الاحتياطي", !sup || (ad && to < 1200), { ms: to, adopted: ad, supported: sup });
    ok("اللوح المُتبنّى يعرض التبويب الصحيح وبلا إعادة تحميل", await p.evaluate(() => { const q = SpatialOS.panels.get("ord"), d = q.fr.contentDocument; return !!d.getElementById("tab-orders") && !d.getElementById("tab-orders").classList.contains("hidden"); }));
    ok("اللوح المفرد يتوسط بين جناحي البطاقات", await p.evaluate(() => { const r = SpatialOS.panels.get("ord").el.getBoundingClientRect(); return r.left > innerWidth * .24 && r.right < innerWidth * .76; }));
    await p.waitForFunction(() => SpatialOS.spare.ready, null, { timeout: 60000 }); ok("يُسخَّن لوح احتياطي جديد بعد الاستهلاك", await p.evaluate(() => SpatialOS.spare.count >= 2));
    /* بطاقة سفلية تفتح لوحها */
    await p.evaluate(() => document.querySelector('.node:not(.sub)[data-id="store"]').click()); await wait(700);
    await p.evaluate(() => document.querySelector('.node.sub[data-id="returns"]').click()); await p.waitForFunction(() => { const q = SpatialOS.panels.get("returns"); return q && q.frDone; }, null, { timeout: 30000 });
    ok("النقر على بطاقة المدار السفلي يفتح لوحها الحقيقي", await p.evaluate(() => { const q = SpatialOS.panels.get("returns"), d = q.fr.contentDocument, t = d.getElementById("tab-returns"); return !!t && !t.classList.contains("hidden"); }));
    /* جسر صوت الكرة */
    await p.evaluate(() => SpatialOS.open("help")); await p.waitForFunction(() => { const q = SpatialOS.panels.get("help"); return q && q.frDone; }, null, { timeout: 30000 }); await wait(800);
    const vb = await p.evaluate(async () => { const q = SpatialOS.panels.get("help"), w = q.fr.contentWindow, u = new w.SpeechSynthesisUtterance("اختبار"); w.speechSynthesis.speak(u); u.dispatchEvent(new Event("start")); u.dispatchEvent(new Event("boundary")); const s1 = Core3D.state(); await new Promise(r => setTimeout(r, 120)); const s2 = Core3D.state(); u.dispatchEvent(new Event("end")); await new Promise(r => setTimeout(r, 700)); const s3 = Core3D.state(); w.speechSynthesis.cancel(); return { patched: !!w.__scVoice, during: [s1.presence, s2.presence], audio: s2.audio, after: s3.presence }; });
    ok("كلام المساعد داخل لوح اسألني يضع الكرة في حالة الكلام ثم يعيدها للراحة", vb.patched && (vb.during.includes("voice") || vb.audio > 0.05) && vb.after === "rest", vb);
    if (SHOTS) await p.screenshot({ path: SHOTS + "/world-real.png" });
    ok("لا أخطاء صفحة", errs.length === 0, errs); await c.close();
    /* هاتف: بلا بطاقات الرئيسية، يفتح لوحاً تلقائياً */
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), q2 = await c2.newPage(), e2 = []; q2.setDefaultTimeout(30000); q2.on("pageerror", e => e2.push(String(e).slice(0, 200)));
    await q2.goto(store.base + "/admin-preview/spatial-os/index.html?real=1"); await q2.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two, null, { timeout: 30000 }); await wait(2500);
    const ph = await q2.evaluate(() => ({ parts: !!document.getElementById("hparts") && getComputedStyle(document.getElementById("hparts")).display !== "none", ord: SpatialOS.panels.has("ord"), over: document.documentElement.scrollWidth <= innerWidth + 1, tab: SpatialOS.tab }));
    ok("الهاتف: لا بطاقات رئيسية (شريط الأقسام) ويُفتح لوح الطلبات تلقائياً بلا فيض أفقي", !ph.parts && ph.ord && ph.over && ph.tab === "store", ph); ok("الهاتف: لا أخطاء", e2.length === 0, e2); await c2.close();
  } catch (e) { fails++; R.push("FAIL [crash] " + String(e).slice(0, 500)); }
  await b.close(); console.log(R.join("\n")); console.log(fails ? "\nFAILED: " + fails : "\nALL PASS"); process.exit(fails ? 1 : 0);
})();
