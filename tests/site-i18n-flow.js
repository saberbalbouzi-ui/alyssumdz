// مسارات التفاعل بالفرنسية (حزمة عميل حقيقية): أخطاء التحقق، كود خصم خاطئ، إضافة للسلة، صفحة السلة ونموذجها، شكراً بعد الطلب، تتبع الطلب والحساب
// يجب ألا يبقى أي نص عربي ظاهر بعد كل خطوة (الملف يمنع التسرّب فيما يُرسَم ديناميكياً). التشغيل: EQA_BASE=… NODE_PATH=… node tests/site-i18n-flow.js
const pw = require("playwright"), chromium = pw[process.env.SI_BROWSER || "chromium"]; const BASE = process.env.EQA_BASE; const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ck = (t, n, ok, d) => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"} [${t}] ${n}${!ok && d !== undefined ? "  — " + JSON.stringify(d).slice(0, 400) : ""}`); };
const LEFT = () => { const AR = /[؀-ۿ]/, SK = "script,style,textarea,code,pre,noscript,[data-i18n-skip],.notranslate"; const out = []; const tw = document.createTreeWalker(document.body, 5, { acceptNode: n => n.nodeType === 1 ? (n.matches(SK) ? 2 : 3) : 1 }); let n; while ((n = tw.nextNode())) { if (n.nodeType === 3 && AR.test(n.nodeValue)) { const e = n.parentElement; if (e && e.getClientRects().length) out.push(n.nodeValue.replace(/\s+/g, " ").trim()); } else if (n.nodeType === 1) { for (const a of ["placeholder", "title", "aria-label", "alt", "value"]) { const v = n.getAttribute(a); if (v && AR.test(v) && !(a === "value" && n.tagName === "OPTION" && false)) out.push("[" + a + "] " + v); } } } return [...new Set(out)]; };
(async () => {
  const br = await chromium.launch(); const errs = []; const c = await br.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" }); const p = await c.newPage(); p.on("pageerror", e => errs.push(String(e).slice(0, 120)));
  const step = async (name) => { await sleep(900); const l = await p.evaluate(LEFT); ck(name, "لا نص عربي ظاهر", l.length === 0, l.slice(0, 6)); };
  const go = async u => { await p.goto(BASE + u, { waitUntil: "load" }).catch(() => { }); await sleep(3000); };
  await go("/p/demo/?lang=fr"); await step("المنتج");
  await p.evaluate(() => { const f = document.getElementById("order-form"); const b = f && f.querySelector("[type=submit]"); b && b.click(); }); await step("إرسال فارغ");
  await p.fill("#name", "Test"); await p.fill("#phone", "0123"); await p.evaluate(() => document.getElementById("phone").dispatchEvent(new Event("input", { bubbles: true }))); await step("هاتف خاطئ");
  await p.fill("#phone", "05551234567"); await p.evaluate(() => document.getElementById("phone").dispatchEvent(new Event("input", { bubbles: true }))); await step("هاتف أطول");
  await p.selectOption("#wilaya", { index: 16 }); await sleep(900); await p.selectOption("#commune", { index: 1 }).catch(() => { }); await step("ولاية وبلدية");
  await p.evaluate(() => { const r = document.querySelector("input[name=dtype][value=stop]"); r && r.click(); }); await step("مكتب Stop Desk");
  await p.evaluate(() => { const r = document.querySelector("input[name=dtype][value=home]"); r && r.click(); });
  await p.fill("#prod-coupon-input", "XXXX").catch(() => { }); await p.evaluate(() => document.getElementById("prod-coupon-btn").click()); await step("كود خصم خاطئ");
  await p.fill("#phone", "0555123456"); await p.evaluate(() => document.getElementById("phone").dispatchEvent(new Event("input", { bubbles: true }))); await step("هاتف صحيح");
  await p.evaluate(() => { const f = document.getElementById("order-form"); f.querySelector("[type=submit]").click(); }); await sleep(3500); await step("شكراً بعد الطلب");
  await go("/p/demo/?lang=fr"); await p.evaluate(() => document.getElementById("add-cart").click()); await step("إضافة للسلة");
  await p.evaluate(() => { const b = document.querySelector(".cart-btn"); b && b.click(); }); await step("درج السلة");
  await go("/cart.html?lang=fr"); await step("صفحة السلة");
  await p.evaluate(() => { const b = document.querySelector("#cart-page .btn-order,.btn-order[onclick*=checkout]"); b && b.click(); }); await step("تأكيد السلة فارغ النموذج");
  await p.fill("#cphone", "12").catch(() => { }); await p.evaluate(() => document.getElementById("cart-coupon-btn") && document.getElementById("cart-coupon-btn").click()); await step("كود في السلة");
  await go("/account.html?lang=fr"); await step("الحساب");
  await p.evaluate(() => { const f = document.querySelector("form"); f && f.requestSubmit && f.requestSubmit(); }); await step("حساب: إرسال فارغ");
  await p.evaluate(() => { const t = [...document.querySelectorAll("button,a,[role=tab]")].find(x => /Inscription|Nouveau|S’inscrire/i.test(x.textContent)); t && t.click(); }); await step("حساب: تسجيل جديد");
  await p.evaluate(() => { const t = [...document.querySelectorAll("button,a,[role=tab]")].find(x => /sans compte|Suivre/i.test(x.textContent)); t && t.click(); }); await step("حساب: تتبع بلا حساب");
  await p.evaluate(() => { const f = [...document.querySelectorAll("form")].pop(); f && f.requestSubmit && f.requestSubmit(); }); await step("تتبع: إرسال");
  ck("all", "بلا أخطاء JS", errs.length === 0, errs.slice(0, 4));
  console.log(`\n${fail ? fail + " إخفاق" : "✓ كل الفحوص نجحت"} (${pass} نجاح)`); await br.close(); process.exit(fail ? 1 : 0);
})();
