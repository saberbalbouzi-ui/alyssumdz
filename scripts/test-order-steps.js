/* الطلب بمراحل: تشغيل: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-order-steps.js */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ ...devices["iPhone 13"] }), p = await c.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  const errs = []; p.on("pageerror", e => errs.push(String(e))); const posts = [];
  await p.route(/assets\/data\/checkout\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ steps: process.env.OFF ? false : true, showOffers: true, phoneDz: true, guard: {} }) }));
  await p.route(/supabase\.co|script\.google\.com|\/functions\/v1\//, r => { const rq = r.request(); if (rq.method() !== "GET" && rq.method() !== "OPTIONS") posts.push({ u: rq.url().slice(-60), b: (rq.postData() || "").slice(0, 600) }); if (rq.method() === "OPTIONS") return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } }); r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true, id: "T1", result: "ok", status: "ok" }) }); });
  await p.goto("http://localhost:8765/p/anti-acne/", { waitUntil: "load" }); await p.waitForTimeout(3500);
  await p.goto("http://localhost:8765/p/anti-acne/", { waitUntil: "load" }); await p.waitForTimeout(3500);
  await p.evaluate(() => { window.__marker = "alive"; document.getElementById("acg-ov")?.remove(); });
  const st0 = await p.evaluate(() => ({ on: OrderSteps.state.on, why: OrderSteps.state.why, step: OrderSteps.state.step, bar: !!document.querySelector(".os-bar"), n: document.querySelectorAll(".os-st").length }));
  if (process.env.OFF) { ok("الإعداد مطفأ: لا مراحل ويبقى النموذج العادي", !st0.on && !st0.bar, st0); console.log(fail ? "فشل" : "نجح"); await b.close(); process.exit(fail ? 1 : 0); }
  ok("الإعداد مفعّل: تُبنى مرحلتان فقط", st0.on && st0.bar && st0.n === 2 && st0.step === 1, st0);
  const vis = id => p.evaluate(id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return !!(r.width && r.height) && getComputedStyle(e).visibility !== "hidden"; }, id);
  const visSel = sel => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return !!(r.width && r.height); }, sel);
  ok("المرحلة 1: الولاية والبلدية والعروض والسعر ظاهرة، والاسم والهاتف وزر التأكيد مخفية", (await vis("wilaya")) && (await vis("commune")) && (await visSel(".os-off")) && (await vis("grand")) && !(await vis("name")) && !(await vis("phone")) && !(await visSel("#order-form .btn-order")));
  const ord = await p.evaluate(() => { const f = x => document.querySelector(x), after = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); const c = f("#commune"), o = f(".os-offs"), g = f("#grand"), n = f("#name"), bt = f("#order-form .btn-order"); return { off: after(c, o), grand: after(o, g), name: after(g, n), btn: after(n, bt) }; });
  ok("الترتيب: البلدية ← العروض ← السعر مع التوصيل ← الاسم/الهاتف ← زر التأكيد", ord.off && ord.grand && ord.name && ord.btn, ord);
  const url0 = p.url();
  await p.evaluate(() => { window.scrollTo(0, 0); }); await p.evaluate(() => { const a = document.querySelector('a[href="#order-form"]'); a.click(); }); await p.waitForTimeout(900);
  ok("«اطلب الآن» تمرّر إلى النموذج بسلاسة دون تغيير العنوان أو إعادة التحميل", p.url() === url0 && (await p.evaluate(() => window.__marker)) === "alive");
  await p.evaluate(() => OrderSteps.state.next.click()); await p.waitForTimeout(300);
  ok("«متابعة» بلا ولاية: يُمنع وتبقى المرحلة 1 والولاية حمراء", (await p.evaluate(() => OrderSteps.state.step)) === 1 && (await p.evaluate(() => document.getElementById("wilaya").classList.contains("fe-bad"))));
  await p.evaluate(() => { const s = document.getElementById("wilaya"); const o = [...s.options].find(x => x.value); s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); }); await p.waitForTimeout(600);
  await p.evaluate(() => { const s = document.getElementById("commune"); const o = [...s.options].filter(x => x.value)[0]; if (o) { s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); } }); await p.waitForTimeout(500);
  const s1 = await p.evaluate(() => ({ offs: document.querySelectorAll(".os-off").length, on: document.querySelectorAll(".os-off.on").length, fee: (document.getElementById("fee") || {}).textContent, grand: (document.getElementById("grand") || {}).textContent }));
  ok("بعد الولاية والبلدية: العروض ظاهرة وعرض واحد مختار، ورسوم التوصيل والمجموع بأرقام", s1.offs >= 2 && s1.on === 1 && /\d/.test(s1.fee || "") && /\d/.test(s1.grand || ""), s1);
  const g1 = s1.grand; await p.evaluate(() => document.querySelectorAll(".os-off")[1].click()); await p.waitForTimeout(500);
  const s1b = await p.evaluate(() => ({ orig: [...document.querySelectorAll("#offers .offer")].findIndex(x => x.classList.contains("on")), mir: [...document.querySelectorAll(".os-off")].findIndex(x => x.classList.contains("on")), grand: document.getElementById("grand").textContent }));
  ok("اختيار عرض من القائمة يغيّر العرض الأصلي والمجموع", s1b.orig === 1 && s1b.mir === 1 && s1b.grand !== g1, { g1, s1b });
  await p.evaluate(() => OrderSteps.state.next.click()); await p.waitForTimeout(500);
  ok("المرحلة 2 تُضاف تحت الأولى: الاسم والهاتف وزر التأكيد ظاهرة، والولاية والعروض والسعر ما زالت ظاهرة", (await p.evaluate(() => OrderSteps.state.step)) === 2 && (await vis("name")) && (await vis("phone")) && (await visSel("#order-form .btn-order")) && (await vis("wilaya")) && (await visSel(".os-off")) && (await vis("grand")));
  ok("لا شاشة مراجعة ولا زر رجوع", !(await p.evaluate(() => !!document.querySelector(".os-rev,.os-back,.os-rv"))));
  const n0 = posts.length;
  await p.evaluate(() => { document.getElementById("name").value = "علي"; document.getElementById("phone").value = "0123"; }); await p.evaluate(() => document.querySelector("#order-form .btn-order").click()); await p.waitForTimeout(500);
  ok("هاتف غير صحيح: لا إرسال والهاتف أحمر برسالة", posts.length === n0 && (await p.evaluate(() => document.getElementById("phone").classList.contains("fe-bad"))));
  await p.evaluate(() => { const s = document.getElementById("wilaya"); s.value = ""; s.dispatchEvent(new Event("change", { bubbles: true })); }); await p.fill("#phone", "0551234567"); await p.fill("#name", "علي بن أحمد");
  await p.evaluate(() => document.querySelector("#order-form .btn-order").click()); await p.waitForTimeout(500);
  ok("تعديل المرحلة 1 إلى ولاية فارغة ثم التأكيد: يلوّن الولاية ولا يرسل", posts.length === n0 && (await p.evaluate(() => document.getElementById("wilaya").classList.contains("fe-bad"))));
  await p.evaluate(() => { const s = document.getElementById("wilaya"); s.value = [...s.options].find(x => x.value).value; s.dispatchEvent(new Event("change", { bubbles: true })); }); await p.waitForTimeout(500);
  await p.evaluate(() => { const s = document.getElementById("commune"); const o = [...s.options].filter(x => x.value)[0]; if (o) { s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); } }); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector("#order-form .btn-order").click()); await p.waitForTimeout(3500);
  ok("«تأكيد الطلب» يرسل الطلب بالاسم والهاتف دون إعادة تحميل الصفحة", posts.some(x => /علي|0551234567/.test(decodeURIComponent(x.b))) && (await p.evaluate(() => window.__marker)) === "alive", posts.map(x => x.u));
  /* داخل إطار صفحة الهبوط (order-embed): نفس المرحلتين، وقائمة العروض الأصلية مخفية، وتُرسَل ارتفاعات للأب */
  const c2 = await b.newContext({ ...devices["iPhone 13"] }), q = await c2.newPage(); const hs = []; await q.exposeFunction("__h", h => hs.push(h)); await q.addInitScript(() => { const pm = window.parent.postMessage.bind(window.parent); window.parent.postMessage = (m, o) => { if (m && m.pbEmbedH) window.__h(m.pbEmbedH); return pm(m, o); }; });
  await q.route(/assets\/data\/checkout\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ steps: true, phoneDz: true }) }));
  await q.goto("http://localhost:8765/order-embed.html?p=anti-acne&embed=1", { waitUntil: "load" }); await q.waitForTimeout(3500);
  const e0 = await q.evaluate(() => ({ on: OrderSteps.state.on, origHidden: getComputedStyle(document.getElementById("offers")).display === "none", step: OrderSteps.state.step, offs: document.querySelectorAll(".os-off").length, vis: (() => { const r = document.querySelector(".os-offs").getBoundingClientRect(); return !!(r.width && r.height); })() }));
  ok("داخل الإطار: المرحلتان تُبنيان وقائمة العروض الأصلية مخفية وقائمة المرحلة 1 ظاهرة", e0.on && e0.origHidden && e0.step === 1 && e0.offs >= 2 && e0.vis, e0);
  await q.evaluate(() => { const s = document.getElementById("wilaya"); s.value = [...s.options].find(x => x.value).value; s.dispatchEvent(new Event("change", { bubbles: true })); }); await q.waitForTimeout(500); const h1 = hs.length;
  await q.evaluate(() => OrderSteps.state.next.click()); await q.waitForTimeout(700);
  const e2 = await q.evaluate(() => ({ step: OrderSteps.state.step, name: !!document.getElementById("name").getBoundingClientRect().height, offs: !!document.querySelector(".os-offs").getBoundingClientRect().height }));
  ok("داخل الإطار: المرحلة 2 تُضاف تحت الأولى (العروض ما زالت ظاهرة)", e2.step === 2 && e2.name && e2.offs, e2);
  ok("ارتفاع الإطار يُبلَّغ للأب عند ظهور المرحلة 2", hs.length > h1 && new Set(hs).size >= 2, hs);

  /* تفضيل الصفحة من مطوّر الصفحات: st=0 يعطّل رغم تفعيل المتجر، st=1 يفعّل رغم تعطيله */
  for (const [glob, st, want] of [[true, "0", false], [false, "1", true], [true, "", true]]) {
    const c3 = await b.newContext({ ...devices["iPhone 13"] }), r3 = await c3.newPage();
    await r3.route(/assets\/data\/checkout\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ steps: glob, phoneDz: true }) }));
    await r3.goto("http://localhost:8765/order-embed.html?p=anti-acne&embed=1" + (st ? "&oc=" + encodeURIComponent(JSON.stringify({ st })) : ""), { waitUntil: "load" }); await r3.waitForTimeout(3200);
    const on = await r3.evaluate(() => !!OrderSteps.state.on);
    ok("تفضيل الصفحة: المتجر=" + glob + " والصفحة=" + (st || "افتراضي") + " ← " + (want ? "مراحل" : "نموذج عادي"), on === want, { on }); await c3.close();
  }
  { const c4 = await b.newContext({ ...devices["iPhone 13"] }), r4 = await c4.newPage();
    await r4.route(/assets\/data\/checkout\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ steps: false, phoneDz: true }) }));
    await r4.goto("http://localhost:8765/p/anti-acne/", { waitUntil: "load" }); await r4.evaluate(() => { const f = document.getElementById("order-form"), d = document.createElement("div"); d.setAttribute("data-ost", "1"); f.parentNode.insertBefore(d, f); d.appendChild(f); });
    await r4.evaluate(() => { try { if (typeof initCheckout === "function") initCheckout(); } catch (e) { } }); await r4.waitForTimeout(3500);
    ok("تفضيل الصفحة على صفحة المنتج (data-ost=1) يفعّل المراحل رغم تعطيل المتجر", await r4.evaluate(() => !!OrderSteps.state.on)); await c4.close(); }
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail + " من " + (pass + fail) : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
