/* اختبار حيّ على Beta المنشور (يدوي، ليس في CI): طلب حقيقي بنموذج المراحل على /p/demo/ مع إعداد حماية معلن للأداة فقط (bots:false عبر route) وإعدادات checkout/pay-methods الافتراضية لـBeta (نفس الملفين المشحونين).
   ينشئ طلباً تجريبياً واحداً في Supabase Beta (الاسم يبدأ بـ«QA»). التشغيل: NODE_PATH=<node_modules> NODE_USE_ENV_PROXY=1 node platform/env/beta/e2e/live-order.js   (BETA_WEB لتغيير العنوان) */
const { chromium } = require("playwright");
const fs = require("fs"); const WEB = process.env.BETA_WEB || "https://alyssum-beta-web.contact-alyssumbio.workers.dev"; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = require("path").resolve(__dirname, "..") + "/";
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1360, height: 900 }, serviceWorkers: "block" });
  const prot = await (await fetch(WEB + "/assets/data/protect.json")).json(); prot.bots = false;
  await c.route("**/assets/data/protect.json*", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(prot) }));
  await c.route("**/assets/data/checkout.json*", r => r.fulfill({ contentType: "application/json", body: fs.readFileSync(R + "checkout.json", "utf8") }));
  await c.route("**/assets/data/pay-methods.json*", r => r.fulfill({ contentType: "application/json", body: fs.readFileSync(R + "pay-methods.json", "utf8") }));
  const p = await c.newPage(); const rpc = [], errs = [];
  p.on("pageerror", e => errs.push(e.message.slice(0, 120)));
  p.on("request", q => { if (/rpc\/submit_order/.test(q.url()) && q.method() === "POST") rpc.push({ url: q.url(), body: q.postData() }); });
  p.on("response", async r => { if (/rpc\/submit_order/.test(r.url()) && r.request().method() === "POST") rpc.push({ status: r.status(), resp: (await r.text().catch(() => "")).slice(0, 200) }); });
  await p.goto(WEB + "/p/demo/", { waitUntil: "load" }); await sleep(3500);
  const S = () => p.evaluate(() => ({ step: OrderSteps.state.step, on: OrderSteps.state.on, fee: (document.getElementById("fee") || {}).textContent, grand: (document.getElementById("grand") || {}).textContent, btn: (document.querySelector(".btn-order") || {}).textContent, vis: [...document.querySelectorAll("#order-form input,#order-form select,#order-form textarea")].filter(e => e.offsetParent).map(e => e.id || e.name).join(",") }));
  console.log("S0", JSON.stringify(await S()));
  await p.locator("#offers .offer").nth(1).click(); await sleep(500);
  const wil = await p.evaluate(() => [...document.querySelectorAll("#wilaya option")].slice(0, 20).map(o => o.value + ":" + o.textContent.trim()).join(" | ")); console.log("wil", wil);
  await p.selectOption("#wilaya", { index: 16 }); await sleep(1200);
  const com = await p.evaluate(() => ({ tag: document.getElementById("commune").tagName, opts: [...document.querySelectorAll("#commune option")].slice(0, 6).map(o => o.value + ":" + o.textContent.trim()) })); console.log("commune", JSON.stringify(com));
  if (com.tag === "SELECT") await p.selectOption("#commune", { index: 1 }); else await p.fill("#commune", "بلدية الاختبار"); await sleep(1200);
  console.log("S1", JSON.stringify(await S()));
  const nxt = await p.evaluate(() => { const n = OrderSteps.state.next; return n ? (n.textContent || "").trim() : null; }); console.log("next btn:", nxt);
  await p.evaluate(() => OrderSteps.state.next && OrderSteps.state.next.click()); await sleep(1200);
  console.log("S2", JSON.stringify(await S()));
  const ship = await (await fetch(WEB + "/assets/data/ship-co.json")).json(); const exp = ship.companies[ship.def].prices["16"]; console.log("ship-co default", ship.def, "Alger home/stop", JSON.stringify(exp), "adj", JSON.stringify((ship.companies[ship.def].adj)));
  await p.fill("#name", "QA بيتا طلب مرحلي"); await p.fill("#phone", "0550123401");
  const before = await p.evaluate(() => ({ grand: document.getElementById("grand").textContent, fee: document.getElementById("fee").textContent }));
  console.log("btns", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("#order-form button, .btn-order, [type=submit]")].map(e => ({c: e.className.slice(0,40), t: (e.textContent||"").trim().slice(0,30), vis: !!e.offsetParent, r: JSON.stringify(e.getBoundingClientRect().toJSON ? {w:Math.round(e.getBoundingClientRect().width),h:Math.round(e.getBoundingClientRect().height)}:0)})))));
  await p.screenshot({path:"pre-confirm.png"}); const OB = p.locator("button.btn-order.os-fade").first(); await OB.scrollIntoViewIfNeeded(); await OB.click({timeout:10000}); await sleep(5000);
  console.log("RPC", JSON.stringify(rpc.map(x => x.body ? { body: JSON.parse(x.body) } : x)).slice(0, 1500));
  console.log("URL after", p.url().replace(WEB, ""), "| title:", await p.title());
  console.log("before", JSON.stringify(before));
  console.log("errs", JSON.stringify(errs)); await p.screenshot({ path: "step2.png" }); await b.close();
})();
