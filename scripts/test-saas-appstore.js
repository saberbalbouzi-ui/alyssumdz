/* اختبار تبويب «متجر التطبيقات» في لوحة المزوّد (saas/appstore.js) بوسيط مُحاكى + قوائم السماح في platform-admin وplatform-proxy.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-saas-appstore.js */
const fs = require("fs"), path = require("path"), { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const lst = (f) => [...fs.readFileSync(path.join(root, f), "utf8").matchAll(/\["(GET|POST|PUT|PATCH|DELETE)", (\/\^.*?\/)\]/g)].map(m => [m[1], eval(m[2])]);
const AD = lst("supabase/functions/platform-admin/index.ts"), PX = lst("supabase/functions/platform-proxy/index.ts");
const ad = (m, p) => AD.some(([x, re]) => x === m && re.test(p)), px = (m, p) => PX.some(([x, re]) => x === m && re.test(p));
ok("المزوّد: المراجعة والإعدادات والإيرادات والمطوّرون", ad("POST", "/admin/appstore/developers") && ad("GET", "/admin/appstore/apps?status=pending") && ad("POST", "/admin/appstore/apps/5/review") && ad("GET", "/admin/appstore/settings") && ad("PUT", "/admin/appstore/settings") && ad("GET", "/admin/appstore/revenues") && ad("GET", "/admin/appstore/installations") && ad("GET", "/admin/appstore/installations?app_id=3"));
ok("المزوّد يرفض الخبيث", !ad("DELETE", "/admin/appstore/apps/5") && !ad("POST", "/admin/appstore/apps/x/review") && !ad("GET", "/admin/appstore/apps?status=a;drop") && !ad("GET", "/admin/appstore/../tenants") && !ad("PATCH", "/admin/appstore/settings"));
ok("وسيط التاجر: التصفح والتثبيت والإلغاء فقط", px("GET", "/v1/appstore/apps") && px("GET", "/v1/appstore/apps/4") && px("POST", "/v1/appstore/apps/4/install") && px("GET", "/v1/appstore/installations") && px("POST", "/v1/appstore/installations/3/authorize") && px("DELETE", "/v1/appstore/installations/3"));
ok("وسيط التاجر يمنع المطوّر وOAuth والإدارة", !px("POST", "/v1/appstore/dev/apps") && !px("GET", "/v1/appstore/dev/earnings") && !px("POST", "/oauth/token") && !px("POST", "/oauth/revoke") && !px("GET", "/v1/appstore/me") && !px("POST", "/admin/appstore/developers") && !px("POST", "/admin/appstore/apps/1/review") && !px("DELETE", "/v1/appstore/apps/1"));
(async () => {
  const br = await chromium.launch(), calls = [], page = await (await br.newContext({ viewport: { width: 390, height: 800 } })).newPage();
  let APPS = [{ id: 4, slug: "sms-tools", name: "أدوات <img src=x onerror=window.__x=1>", developer: "Dev", developer_id: 9, price: 2000, billing: "monthly", scopes: [{ id: "read_orders", label: "قراءة الطلبات", sensitive: false }, { id: "read_customers", label: "هواتف الزبائن", sensitive: true }], events: ["order.created"], webhook_url: "https://app.example/hook", redirect_uris: ["https://app.example/cb"], status: "pending", review_note: null }];
  await page.route("**/functions/v1/platform-admin", async route => {
    const b = JSON.parse(route.request().postData() || "{}"); calls.push(b); let data = {}, status = 200;
    if (b.path.startsWith("/admin/appstore/apps?")) data = { apps: APPS.filter(a => b.path.includes("status=" + a.status)) };
    else if (b.path === "/admin/appstore/settings" && b.method === "GET") data = { commission_pct: 20 };
    else if (b.path === "/admin/appstore/settings") data = { ok: true, commission_pct: b.body.commission_pct };
    else if (b.path === "/admin/appstore/revenues") data = { totals: { gross: 12000, fee: 2400, net: 9600, unsettled: 0 }, commission_pct: 20 };
    else if (b.path.startsWith("/admin/appstore/installations")) data = { installations: [{ app_id: 4, status: "active" }] };
    else if (/apps\/4\/review$/.test(b.path)) { APPS[0].status = b.body.status; data = { ok: true, status: b.body.status }; }
    else if (b.path === "/admin/appstore/developers") data = { ok: true };
    else { data = { error: { code: "not_found", message: "x" } }; status = 404; }
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true, status, data }) });
  });
  await page.setContent('<link rel="stylesheet" href="file://' + root + '/saas/app.css"><div id="toasts"></div><div id="r"></div>');
  await page.addScriptTag({ content: "window.SAAS_CFG={URL:'https://x.supabase.co',KEY:'k'};" });
  await page.addScriptTag({ path: path.join(root, "saas/appstore.js") });
  await page.evaluate(() => { window.confirm = () => true; window.prompt = () => "نطاق مبالغ فيه"; SaasAppStore.mount(document.getElementById("r"), async () => "tok"); });
  await page.waitForSelector("table");
  let txt = await page.innerText("#r");
  ok("التطبيق بمطوّره وسعره وعلامة بيانات الزبائن", /مطوّر #9/.test(txt) && /2.?000 دج/.test(txt.replace(/[  ]/g, " ").replace(/ (?=\d{3})/g, " ")) && /بيانات الزبائن/.test(txt) && /بانتظار المراجعة/.test(txt), txt.slice(0, 300));
  ok("لا XSS في اسم التطبيق", (await page.evaluate(() => window.__x)) === undefined && !(await page.$("#r img")));
  ok("الجوال: لا فيض أفقي", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.click("[data-as=open]"); txt = await page.innerText("#r"); ok("التفاصيل: النطاقات والروابط وتحذير المراجعة", /read_customers/.test(txt) && /app\.example\/hook/.test(txt) && /راجع:/.test(txt));
  await page.click('[data-as=rev][data-to=approved]'); await page.waitForTimeout(200);
  const rv = calls.find(c => c.method === "POST" && /review$/.test(c.path)); ok("الاعتماد يرسل الحالة", rv && rv.body.status === "approved", rv);
  await page.click('[data-as=st][data-st=approved]'); await page.waitForSelector("[data-as=rev][data-to=suspended]"); ok("المعتمد يعرض عدد التثبيتات وزر التعليق الفوري", /1 تثبيت/.test(await page.innerText("#r")));
  await page.click('[data-as=rev][data-to=suspended]'); await page.waitForTimeout(200);
  const sp = calls.filter(c => c.method === "POST" && /review$/.test(c.path)).pop(); ok("التعليق يرسل السبب", sp.body.status === "suspended" && sp.body.note === "نطاق مبالغ فيه", sp);
  ok("ملخص الإيرادات ظاهر", /12.?000/.test((await page.innerText("#r")).replace(/[  ]/g, "")) || /12/.test(await page.innerText("#r")));
  await page.fill("#as-pct", "70"); await page.click("[data-as=pct]"); await page.waitForTimeout(100); ok("عمولة >50 تُرفض محلياً", !calls.some(c => c.method === "PUT" && c.body.commission_pct === 70));
  await page.fill("#as-pct", "25"); await page.click("[data-as=pct]"); await page.waitForTimeout(150); ok("حفظ العمولة", calls.some(c => c.method === "PUT" && c.path === "/admin/appstore/settings" && c.body.commission_pct === 25));
  await page.fill("#as-dev", "9"); await page.click("[data-as=dev][data-to=active]"); await page.waitForTimeout(150); ok("تفعيل مطوّر", calls.some(c => c.path === "/admin/appstore/developers" && c.body.tenant_id === 9 && c.body.status === "active"));
  await br.close(); console.log(fails ? "فشل " + fails : "كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
