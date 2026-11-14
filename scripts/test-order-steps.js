/* الطلب بمراحل: تشغيل: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-order-steps.js */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ ...devices["iPhone 13"] }), p = await c.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  const errs = []; p.on("pageerror", e => errs.push(String(e))); const posts = [];
  await p.route(/assets\/data\/checkout\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ steps: process.env.OFF ? false : true, showOffers: true, phoneDz: true, guard: {} }) }));
  await p.route(/supabase\.co|script\.google\.com|\/functions\/v1\//, r => { const rq = r.request(); if (rq.method() !== "GET" && rq.method() !== "OPTIONS") posts.push({ u: rq.url().slice(-60), b: (rq.postData() || "").slice(0, 600) }); if (rq.method() === "OPTIONS") return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } }); r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true, id: "T1", result: "ok", status: "ok" }) }); });
  await p.goto("http://localhost:8765/p/anti-acne/", { waitUntil: "load" }); await p.waitForTimeout(3500);
  await p.evaluate(() => { window.__marker = "alive"; });
  const st0 = await p.evaluate(() => ({ on: OrderSteps.state.on, why: OrderSteps.state.why, step: OrderSteps.state.step, bar: !!document.querySelector(".os-bar"), n: document.querySelectorAll(".os-st").length }));
  if (process.env.OFF) { ok("الإعداد مطفأ: لا مراحل ويبقى النموذج العادي", !st0.on && !st0.bar, st0); console.log(fail ? "فشل" : "نجح"); await b.close(); process.exit(fail ? 1 : 0); }
  ok("الإعداد مفعّل: تُبنى 4 مراحل", st0.on && st0.bar && st0.n === 4 && st0.step === 1, st0);
  const vis = id => p.evaluate(id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return !!(r.width && r.height) && getComputedStyle(e).visibility !== "hidden"; }, id);
  ok("المرحلة 1: الولاية والبلدية ظاهرتان، والاسم والهاتف وزر التأكيد مخفية", (await vis("wilaya")) && (await vis("commune")) && !(await vis("name")) && !(await vis("phone")) && !(await p.evaluate(() => { const b = document.querySelector("#order-form .btn-order"); const r = b.getBoundingClientRect(); return !!(r.width && r.height); })));
  const url0 = p.url();
  await p.evaluate(() => { window.scrollTo(0, 0); }); await p.evaluate(() => { const a = document.querySelector('a[href="#order-form"]'); a.click(); }); await p.waitForTimeout(900);
  ok("«اطلب الآن» تمرّر إلى النموذج بسلاسة دون تغيير العنوان أو إعادة التحميل", p.url() === url0 && (await p.evaluate(() => window.__marker)) === "alive" && (await p.evaluate(() => document.querySelector(".os-bar").getBoundingClientRect().top < innerHeight)), p.url());
  await p.evaluate(() => OrderSteps.state.next.click()); await p.waitForTimeout(300);
  ok("التالي بلا ولاية: يُمنع وتبقى المرحلة 1", (await p.evaluate(() => OrderSteps.state.step)) === 1);
  const w = await p.evaluate(() => { const s = document.getElementById("wilaya"); const o = [...s.options].find(x => x.value); s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); return o.textContent; }); await p.waitForTimeout(500);
  const cm = await p.evaluate(() => { const s = document.getElementById("commune"); const o = [...s.options].filter(x => x.value)[0]; if (o) { s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); } return o ? o.value : ""; }); await p.waitForTimeout(300);
  await p.evaluate(() => OrderSteps.state.next.click()); await p.waitForTimeout(400);
  const s2 = await p.evaluate(() => ({ step: OrderSteps.state.step, offs: document.querySelectorAll(".os-off").length, on: document.querySelectorAll(".os-off.on").length, fee: (document.getElementById("fee") || {}).textContent, grand: (document.getElementById("grand") || {}).textContent, hint: OrderSteps.state.hint.textContent.slice(0, 30) }));
  ok("المرحلة 2: قائمة العروض مع إرشاد واضح، ورسوم التوصيل والمجموع ظاهران فوراً", s2.step === 2 && s2.offs >= 2 && s2.on === 1 && /\d/.test(s2.fee) && /\d/.test(s2.grand) && (await vis("fee")) && (await vis("grand")), s2);
  const g1 = s2.grand; await p.evaluate(() => document.querySelectorAll(".os-off")[1].click()); await p.waitForTimeout(500);
  const s2b = await p.evaluate(() => ({ orig: [...document.querySelectorAll("#offers .offer")].findIndex(x => x.classList.contains("on")), mir: [...document.querySelectorAll(".os-off")].findIndex(x => x.classList.contains("on")), grand: document.getElementById("grand").textContent }));
  ok("اختيار عرض من القائمة يغيّر العرض الأصلي والمجموع", s2b.orig === 1 && s2b.mir === 1 && s2b.grand !== g1, { g1, s2b });
  await p.evaluate(() => OrderSteps.state.next.click()); await p.waitForTimeout(300);
  ok("المرحلة 3: الاسم والهاتف ظاهران", (await p.evaluate(() => OrderSteps.state.step)) === 3 && (await vis("name")) && (await vis("phone")) && !(await vis("wilaya")));
  await p.evaluate(() => { document.getElementById("name").value = "علي"; document.getElementById("phone").value = "0123"; }); await p.evaluate(() => OrderSteps.state.next.click()); await p.waitForTimeout(300);
  ok("هاتف غير صحيح: يُمنع التقدّم", (await p.evaluate(() => OrderSteps.state.step)) === 3);
  await p.fill("#name", "علي بن أحمد"); await p.fill("#phone", "0551234567"); await p.evaluate(() => OrderSteps.state.next.click()); await p.waitForTimeout(400);
  const s4 = await p.evaluate(() => ({ step: OrderSteps.state.step, rows: [...document.querySelectorAll(".os-rv")].map(r => r.textContent.replace(/\s+/g, " ").trim()), btn: (() => { const b = document.querySelector("#order-form .btn-order"); const r = b.getBoundingClientRect(); return !!(r.width && r.height); })() }));
  ok("المرحلة 4: مراجعة بالاسم والهاتف والولاية والمجموع وزر التأكيد ظاهر", s4.step === 4 && s4.btn && s4.rows.some(r => /علي بن أحمد/.test(r)) && s4.rows.some(r => /0551234567/.test(r)) && s4.rows.some(r => r.indexOf(w.trim()) >= 0), s4);
  await p.evaluate(() => document.querySelector('.os-rv a[data-os-go="1"]').click()); await p.waitForTimeout(300);
  const back = await p.evaluate(() => ({ step: OrderSteps.state.step, wil: document.getElementById("wilaya").value, nm: document.getElementById("name").value, ph: document.getElementById("phone").value, off: [...document.querySelectorAll("#offers .offer")].findIndex(x => x.classList.contains("on")) }));
  ok("الرجوع إلى المرحلة 1 من المراجعة يحفظ كل البيانات (ولاية، اسم، هاتف، عرض)", back.step === 1 && !!back.wil && back.nm === "علي بن أحمد" && back.ph === "0551234567" && back.off === 1, back);
  await p.evaluate(() => OrderSteps.go(4)); await p.waitForTimeout(500);
  ok("القفز للمرحلة 4 يتحقق من المراحل السابقة ثم يصل", (await p.evaluate(() => OrderSteps.state.step)) === 4);
  await p.evaluate(() => document.querySelector(".os-bar .os-st").click()); await p.waitForTimeout(200); await p.evaluate(() => document.querySelector(".os-nav .os-next").click()); await p.waitForTimeout(200);
  await p.evaluate(() => OrderSteps.go(3)); await p.waitForTimeout(400);
  await p.evaluate(() => { document.getElementById("phone").focus(); }); await p.keyboard.press("Enter"); await p.waitForTimeout(500);
  ok("Enter داخل حقل الهاتف ينقل للمراجعة ولا يرسل الطلب", (await p.evaluate(() => OrderSteps.state.step)) === 4 && !posts.some(x => /0551234567/.test(decodeURIComponent(x.b))), posts.map(x => x.u));
  await p.evaluate(() => document.querySelector("#order-form .btn-order").click()); await p.waitForTimeout(3500);
  ok("«تأكيد الطلب» يرسل الطلب بالاسم والهاتف دون إعادة تحميل الصفحة", posts.some(x => /علي|0551234567/.test(decodeURIComponent(x.b))) && (await p.evaluate(() => window.__marker)) === "alive", posts.map(x => x.u));
  /* داخل إطار صفحة الهبوط (order-embed): نفس المراحل، وقائمة العروض الأصلية مخفية، وتُرسَل ارتفاعات للأب */
  const c2 = await b.newContext({ ...devices["iPhone 13"] }), q = await c2.newPage(); const hs = []; await q.exposeFunction("__h", h => hs.push(h)); await q.addInitScript(() => { const pm = window.parent.postMessage.bind(window.parent); window.parent.postMessage = (m, o) => { if (m && m.pbEmbedH) window.__h(m.pbEmbedH); return pm(m, o); }; });
  await q.route(/assets\/data\/checkout\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ steps: true, phoneDz: true }) }));
  await q.goto("http://localhost:8765/order-embed.html?p=anti-acne&embed=1", { waitUntil: "load" }); await q.waitForTimeout(3500);
  const e0 = await q.evaluate(() => ({ on: OrderSteps.state.on, origHidden: getComputedStyle(document.getElementById("offers")).display === "none", step: OrderSteps.state.step }));
  ok("داخل الإطار: المراحل تُبنى وقائمة العروض الأصلية مخفية", e0.on && e0.origHidden && e0.step === 1, e0);
  await q.evaluate(() => { const s = document.getElementById("wilaya"); s.value = [...s.options].find(x => x.value).value; s.dispatchEvent(new Event("change", { bubbles: true })); OrderSteps.state.next.click(); }); await q.waitForTimeout(600);
  const e2 = await q.evaluate(() => ({ step: OrderSteps.state.step, offs: document.querySelectorAll(".os-off").length, vis: (() => { const r = document.querySelector(".os-offs").getBoundingClientRect(); return r.height > 50; })() }));
  ok("داخل الإطار: المرحلة 2 تعرض العروض", e2.step === 2 && e2.offs >= 2 && e2.vis, e2);
  ok("ارتفاع الإطار يُبلَّغ للأب عند تغيّر المرحلة", hs.length >= 2 && new Set(hs).size >= 2, hs);
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
