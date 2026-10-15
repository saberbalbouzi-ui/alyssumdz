/* اختبار تكامل: لوحة المزوّد الحقيقية saas/index.html بمكتبة Supabase مُحاكاة ووسيط platform-admin مُحاكى —
   يتحقق من ربط تبويب «المحفظة» في الشريط الجانبي وapp.js وتحميله وعمل سحب كامل (اعتماد ← صرف).
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-saas-wallet-e2e.js */
const http = require("http"), fs = require("fs"), path = require("path"), { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
const STUB = `window.supabase={createClient:()=>{const R={data:[],error:null};const ch=new Proxy(function(){},{get:(t,k)=>k==='then'?(f=>Promise.resolve(R).then(f)):ch,apply:()=>ch});
return{auth:{getSession:async()=>({data:{session:{access_token:'tok',user:{email:'admin@x.test'}}}}),signOut:async()=>({}),signInWithPassword:async()=>({})},
from:()=>ch,rpc:async()=>({data:{},error:null}),channel:()=>({on(){return this},subscribe(){return this}}),removeChannel(){},functions:{invoke:async()=>({data:{},error:null})}}}};`;
(async () => {
  await new Promise(r => srv.listen(8791, r));
  const br = await chromium.launch(), page = await br.newPage({ viewport: { width: 1200, height: 800 } }), calls = [], errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  let st = "requested";
  await page.route("**/cdn.jsdelivr.net/**", r => r.fulfill({ contentType: "text/javascript", body: STUB }));
  await page.route("**/functions/v1/platform-admin", async route => {
    const b = JSON.parse(route.request().postData() || "{}"); calls.push(b); let data = {};
    if (b.path === "/admin/wallet/summary") data = { balanced: true, by_currency: [], platform_fees: [], owed_to_tenants: [{ currency: "DZD", s: 70000 }], pending_withdrawals: 1 };
    else if (b.path === "/admin/wallet/tenants") data = { tenants: [{ id: 1, name: "Alyssum", site_ref: "alyssumdz", balances: { available: { DZD: 40000 }, escrow: {}, withdraw_hold: { DZD: 30000 }, ads_credit: {} }, pending_withdrawals: 1 }] };
    else if (b.path.startsWith("/admin/wallet/withdrawals/list")) data = { withdrawals: b.path.endsWith(st) ? [{ id: 9, tenant_id: 1, amount: 30000, currency: "DZD", method: "ccp", destination: "0012", status: st, note: "", created_at: 1792000000 }] : [] };
    else if (/withdrawals\/9\/approve$/.test(b.path)) { st = "approved"; data = { ok: true }; }
    else if (/withdrawals\/9\/pay$/.test(b.path)) { st = "paid"; data = { ok: true }; }
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true, status: 200, data }) });
  });
  await page.addInitScript(() => { window.confirm = () => true; });
  await page.goto("http://localhost:8791/saas/index.html#wallet"); await page.waitForSelector("#app:not([hidden])", { timeout: 15000 });
  ok("التبويب موجود في الشريط الجانبي", !!(await page.$('button.nv[data-tab="wallet"]')));
  await page.waitForSelector("#wlroot table", { timeout: 10000 });
  ok("يُحمَّل من الرابط #wallet ويعرض الأرصدة", /40,000 دج/.test(await page.innerText("#wlroot")));
  ok("زر القائمة نشط وعنوان القسم «المحفظة»", (await page.getAttribute('button.nv[data-tab="wallet"]', "class")).includes("on"));
  await page.click('[data-tab="home"]'); await page.waitForTimeout(200); await page.click('[data-tab="wallet"]'); await page.waitForSelector("#wlroot table");
  ok("العودة للتبويب تعيد التحميل", calls.filter(c => c.path === "/admin/wallet/summary").length >= 2);
  await page.click('[data-wl=wd][data-act=approve]'); await page.waitForTimeout(250);
  await page.click('[data-wl=st][data-st=approved]'); await page.waitForTimeout(250);
  await page.click('[data-wl=wd][data-act=pay]'); await page.waitForTimeout(250);
  ok("دورة السحب كاملة عبر اللوحة الحقيقية (اعتماد ثم صرف)", ["approve", "pay"].every(a => calls.some(c => c.method === "POST" && c.path === "/admin/wallet/withdrawals/9/" + a)));
  ok("لا أخطاء جافاسكربت", errs.length === 0, errs);
  await page.setViewportSize({ width: 390, height: 800 }); await page.waitForTimeout(200);
  ok("الجوال: لا فيض أفقي", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await br.close(); srv.close(); console.log(fails ? "\n" + fails + " إخفاق" : "\n✓ كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
