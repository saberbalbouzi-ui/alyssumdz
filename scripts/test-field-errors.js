/* أخطاء الحقول المرئية (تحمرّ الخانة مع رسالة): python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-field-errors.js */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : "  " + JSON.stringify(x))); };
  const posts = [], errs = [];
  async function open(steps, url) {
    const c = await b.newContext({ ...devices["iPhone 13"] }), p = await c.newPage(); p.on("pageerror", e => errs.push(String(e)));
    await p.route(/assets\/data\/checkout\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ steps, phoneDz: true }) }));
    await p.route(/supabase\.co|script\.google\.com|\/functions\/v1\//, r => { const rq = r.request(); if (rq.method() !== "GET" && rq.method() !== "OPTIONS" && !/rpc\/(track_|saas_)/.test(rq.url())) posts.push(rq.url()); r.fulfill({ status: 200, contentType: "application/json", body: "{}" }); });
    await p.goto("http://localhost:8765" + url, { waitUntil: "load" }); await p.waitForTimeout(3500); await p.evaluate(() => document.getElementById("acg-ov")?.remove()); return p;
  }
  const bad = (p, id) => p.evaluate(id => { const e = document.getElementById(id); const m = e && e.closest(".field") && e.closest(".field").querySelector(".fe-msg"); return { cls: !!e && e.classList.contains("fe-bad"), msg: m ? m.textContent : "", bd: e ? getComputedStyle(e).borderColor : "" }; }, id);
  /* 1) النموذج العادي */
  let p = await open(false, "/p/anti-acne/");
  await p.evaluate(() => document.querySelector("#order-form .btn-order").click()); await p.waitForTimeout(400);
  let w = await bad(p, "wilaya"), n = await bad(p, "name"), ph = await bad(p, "phone");
  ok("عادي: زر التأكيد على نموذج فارغ يحمّر الولاية والاسم والهاتف مع رسائل", w.cls && n.cls && ph.cls && /الولاية/.test(w.msg) && /الاسم/.test(n.msg) && /الهاتف/.test(ph.msg), { w, n, ph });
  ok("اللون أحمر فعلاً", /217, ?45, ?32/.test(ph.bd), ph);
  ok("لا طلب أُرسل", posts.length === 0, posts);
  await p.evaluate(() => { const s = document.getElementById("wilaya"); s.value = [...s.options].find(x => x.value).value; s.dispatchEvent(new Event("change", { bubbles: true })); });
  w = await bad(p, "wilaya"); ok("اختيار الولاية يزيل الخطأ فوراً", !w.cls && !w.msg, w);
  await p.fill("#name", "علي بن أحمد"); await p.fill("#phone", "0569856"); await p.evaluate(() => document.querySelector("#order-form .btn-order").click()); await p.waitForTimeout(400);
  ph = await bad(p, "phone"); n = await bad(p, "name");
  ok("هاتف خاطئ (7 أرقام): الخانة حمراء بعبارة «خاطئ» والاسم الصحيح لا يحمرّ", ph.cls && /خاطئ/.test(ph.msg) && !n.cls, { ph, n });
  ok("رسالة واحدة فقط تحت الهاتف", await p.evaluate(() => document.getElementById("phone").closest(".field").querySelectorAll(".fe-msg").length === 1));
  await p.close(); await p.context().close();
  /* 2) الطلب بمراحل */
  p = await open(true, "/p/anti-acne/");
  await p.evaluate(() => OrderSteps.state.next.click()); await p.waitForTimeout(300);
  w = await bad(p, "wilaya"); ok("مراحل: «التالي» بلا ولاية يحمّر الولاية مع «ادخل الولاية» ويبقى في المرحلة 1", w.cls && /ادخل الولاية/.test(w.msg) && (await p.evaluate(() => OrderSteps.state.step)) === 1, w);
  await p.evaluate(() => { const s = document.getElementById("wilaya"); s.value = [...s.options].find(x => x.value).value; s.dispatchEvent(new Event("change", { bubbles: true })); }); await p.waitForTimeout(500);
  await p.evaluate(() => { const s = document.getElementById("commune"); const o = [...s.options].filter(x => x.value)[0]; if (o) { s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); } });
  await p.evaluate(() => OrderSteps.state.next.click()); await p.waitForTimeout(400); await p.evaluate(() => OrderSteps.state.next.click()); await p.waitForTimeout(400);
  ok("مراحل: الوصول للمرحلة 3", (await p.evaluate(() => OrderSteps.state.step)) === 3);
  await p.evaluate(() => OrderSteps.state.next.click()); await p.waitForTimeout(300);
  n = await bad(p, "name"); ph = await bad(p, "phone"); ok("مراحل 3: بلا اسم وهاتف تحمرّ الخانتان", n.cls && ph.cls && /ادخل الاسم/.test(n.msg) && /ادخل رقم/.test(ph.msg), { n, ph });
  await p.fill("#name", "صابر"); await p.fill("#phone", "0569856"); await p.evaluate(() => OrderSteps.state.next.click()); await p.waitForTimeout(300);
  n = await bad(p, "name"); ph = await bad(p, "phone"); ok("مراحل 3: هاتف خاطئ فقط يحمرّ مع «خاطئ»", !n.cls && ph.cls && /خاطئ/.test(ph.msg) && (await p.evaluate(() => OrderSteps.state.step)) === 3, { n, ph });
  await p.fill("#phone", "0551234567"); ph = await bad(p, "phone"); ok("تصحيح الرقم يزيل الخطأ", !ph.cls && !ph.msg, ph);
  await p.evaluate(() => OrderSteps.state.next.click()); await p.waitForTimeout(400); ok("ثم يتقدّم إلى المراجعة", (await p.evaluate(() => OrderSteps.state.step)) === 4);
  await p.evaluate(() => { document.getElementById("phone").value = ""; }); await p.evaluate(() => document.querySelector("#order-form .btn-order").click()); await p.waitForTimeout(500);
  ph = await bad(p, "phone"); ok("تأكيد الطلب في المرحلة 4 مع هاتف فارغ يعيد للمرحلة 3 ويحمّر الهاتف", (await p.evaluate(() => OrderSteps.state.step)) === 3 && ph.cls && posts.length === 0, { ph, posts });
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail + " من " + (pass + fail) : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
