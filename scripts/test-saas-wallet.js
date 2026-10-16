/* اختبار تبويب «المحفظة» في لوحة المزوّد (saas/wallet.js) على متصفح حقيقي بوسيط مُحاكى + قائمة السماح في دالة platform-admin.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-saas-wallet.js */
const fs = require("fs"), path = require("path"), { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };

/* (1) قائمة السماح في الدالة: تُستخرج من المصدر نفسه */
const ts = fs.readFileSync(path.join(root, "platform/supabase/functions/platform-admin/index.ts"), "utf8");
const ALLOW = [...ts.matchAll(/\["(GET|POST|PUT)", (\/\^.*?\/)\]/g)].map(m => [m[1], eval(m[2])]);
const allowed = (m, p) => ALLOW.some(([x, re]) => x === m && re.test(p));
ok("قائمة السماح: قراءة الملخص والمستأجرين والسحوبات", allowed("GET", "/admin/wallet/summary") && allowed("GET", "/admin/wallet/tenants") && allowed("GET", "/admin/wallet/withdrawals/list?status=requested") && allowed("GET", "/admin/wallet/7"));
ok("قائمة السماح: الإجراءات المالية", allowed("POST", "/admin/wallet/7/deposit") && allowed("POST", "/admin/wallet/7/fee") && allowed("POST", "/admin/wallet/7/ads-spend") && allowed("PUT", "/admin/wallet/7/settings") && ["approve", "pay", "reject"].every(a => allowed("POST", "/admin/wallet/withdrawals/9/" + a)));
ok("قائمة السماح ترفض ما عداها", !allowed("GET", "/admin/tenants") && !allowed("POST", "/admin/tenants") && !allowed("DELETE", "/admin/wallet/7") && !allowed("POST", "/admin/wallet/7/../tenants") && !allowed("GET", "/admin/wallet/withdrawals/list?status=x;drop") && !allowed("POST", "/v1/events") && !allowed("GET", "/admin/wallet/7/deposit") && !allowed("PUT", "/admin/wallet/abc/settings"));

(async () => {
  const br = await chromium.launch(), calls = [];
  const T = [{ id: 1, name: "Alyssum <img src=x onerror=window.__x=1>", site_ref: "alyssumdz", balances: { available: { DZD: 125000 }, escrow: { DZD: 40000 }, withdraw_hold: { DZD: 30000 }, ads_credit: { USD: 2550 } }, pending_withdrawals: 1 }];
  let WD = [{ id: 5, tenant_id: 1, amount: 30000, currency: "DZD", method: "ccp", destination: "0012345 <b>98</b>", status: "requested", note: "", created_at: 1792000000 }];
  const ctxB = await br.newContext({ viewport: { width: 390, height: 800 } }), page = await ctxB.newPage();
  await page.route("**/functions/v1/platform-admin", async route => {
    const b = JSON.parse(route.request().postData() || "{}"); calls.push(b);
    let data = {}, status = 200;
    if (b.path === "/admin/wallet/summary") data = { balanced: true, by_currency: [], platform_fees: [{ currency: "DZD", balance: -1500 }], owed_to_tenants: [{ currency: "DZD", s: 195000 }], pending_withdrawals: 1 };
    else if (b.path === "/admin/wallet/tenants") data = { tenants: T };
    else if (b.path.startsWith("/admin/wallet/withdrawals/list")) data = { withdrawals: WD.filter(w => b.path.endsWith(w.status)) };
    else if (b.path === "/admin/wallet/1") data = { balances: T[0].balances, settings: { fee_pct: 3, fee_fixed: 0, usd_rate: 270, min_withdrawal: 1000, require_carrier: false } };
    else if (/withdrawals\/5\/(approve|pay|reject)$/.test(b.path)) { const a = b.path.split("/").pop(); WD[0].status = { approve: "approved", pay: "paid", reject: "rejected" }[a]; data = { ok: true }; }
    else if (/deposit$/.test(b.path)) data = { ok: true, duplicate: b.body.ref === "DUP-001" };
    else if (/\/1\/(fee|ads-spend|settings)$/.test(b.path)) data = { ok: true };
    else { data = { error: { code: "not_found", message: "x" } }; status = 404; }
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true, status, data }) });
  });
  await page.setContent('<link rel="stylesheet" href="file://' + root + '/saas/app.css"><div id="toasts"></div><div id="r"></div>');
  await page.addScriptTag({ content: "window.SAAS_CFG={URL:'https://x.supabase.co',KEY:'k'};" });
  await page.addScriptTag({ path: path.join(root, "saas/wallet.js") });
  await page.evaluate(() => { window.confirm = () => true; window.prompt = () => "رقم خاطئ"; window.alert = m => (window.__al = (window.__al || []).concat(m)); SaasWallet.mount(document.getElementById("r"), async () => "tok"); });
  await page.waitForSelector("table");
  const txt = await page.innerText("#r");
  ok("الأرصدة تُعرض بالدينار والدولار", /125,000 دج/.test(txt) && /40,000 دج/.test(txt) && /25\.50 \$/.test(txt), txt.slice(0, 300));
  ok("توازن الدفتر ظاهر", /متوازن/.test(txt));
  ok("لا ثغرة XSS في اسم المستأجر ولا الوجهة", (await page.evaluate(() => window.__x)) === undefined && !(await page.$("#r img")) && !(await page.$("#r b:text('98')")));
  ok("الوجهة تظهر نصاً للصرف", /0012345 <b>98<\/b>/.test(txt));
  ok("الجوال: لا فيض أفقي للصفحة", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  /* السحب */
  await page.click('[data-wl=wd][data-act=approve]'); await page.waitForTimeout(150);
  ok("الاعتماد يرسل المسار الصحيح", calls.some(c => c.method === "POST" && c.path === "/admin/wallet/withdrawals/5/approve"));
  await page.click('[data-wl=st][data-st=approved]'); await page.waitForTimeout(150);
  await page.click('[data-wl=wd][data-act=pay]'); await page.waitForTimeout(150);
  ok("تأكيد الصرف", calls.some(c => c.path === "/admin/wallet/withdrawals/5/pay"));
  WD.push({ id: 6, tenant_id: 1, amount: 1000, currency: "DZD", method: "baridimob", destination: "x", status: "requested", note: "", created_at: 1792000000 }); WD[0].status = "paid";
  await page.click('[data-wl=st][data-st=requested]'); await page.waitForTimeout(150);
  /* إدارة المستأجر */
  await page.click('[data-wl=open]'); await page.waitForSelector("#wl-manage");
  ok("الإعدادات الحالية تُحمَّل في النموذج", await page.inputValue('[data-ws=usd_rate]') === "270" && await page.inputValue('[data-ws=fee_pct]') === "3");
  await page.click('[data-wl=deposit]'); await page.waitForTimeout(100);
  ok("إيداع بلا مبلغ يُرفض محلياً", !calls.some(c => /deposit$/.test(c.path)) && /مبلغاً/.test(await page.innerText("#toasts")));
  await page.fill('[data-wf=dep-amount]', "50000"); await page.fill('[data-wf=dep-ref]', "a b"); await page.click('[data-wl=deposit]'); await page.waitForTimeout(100);
  ok("مرجع غير صالح يُرفض محلياً", !calls.some(c => /deposit$/.test(c.path)));
  await page.fill('[data-wf=dep-ref]', "BANK-777"); await page.click('[data-wl=deposit]'); await page.waitForTimeout(200);
  const dep = calls.find(c => /deposit$/.test(c.path));
  ok("الإيداع يُرسل المبلغ والمرجع", dep && dep.body.amount === 50000 && dep.body.ref === "BANK-777", dep);
  await page.fill('[data-wf=dep-amount]', "10"); await page.fill('[data-wf=dep-ref]', "DUP-001"); await page.click('[data-wl=deposit]'); await page.waitForTimeout(200);
  ok("المرجع المكرر يُبلَّغ به", /لم يتكرر/.test(await page.innerText("#toasts")));
  await page.fill('[data-wf=fee-amount]', "2000"); await page.fill('[data-wf=fee-ref]', "SUB-1"); await page.click('[data-wl=fee]'); await page.waitForTimeout(150);
  const fee = calls.find(c => /\/1\/fee$/.test(c.path)); ok("رسم اشتراك", fee && fee.body.kind === "subscription" && fee.body.amount === 2000, fee);
  await page.fill('[data-wf=ad-usd]', "25.5"); await page.fill('[data-wf=ad-ref]', "ADS-1"); await page.click('[data-wl=adspend]'); await page.waitForTimeout(150);
  const ad = calls.find(c => /ads-spend$/.test(c.path)); ok("إنفاق إعلاني", ad && ad.body.usd === 25.5, ad);
  await page.check('[data-ws=require_carrier]'); await page.fill('[data-ws=usd_rate]', "280"); await page.click('[data-wl=settings]'); await page.waitForTimeout(150);
  const st = calls.find(c => /settings$/.test(c.path)); ok("حفظ الإعدادات", st && st.method === "PUT" && st.body.require_carrier === true && st.body.usd_rate === 280 && st.body.fee_pct === 3, st);
  await page.click('[data-wl=wd][data-act=reject]'); await page.waitForTimeout(150);
  const rj = calls.find(c => /withdrawals\/6\/reject$/.test(c.path)); ok("الرفض يحمل السبب", rj && rj.body.note === "رقم خاطئ", rj);
  ok("لا فيض أفقي بعد فتح الإدارة", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await br.close(); console.log(fails ? "\n" + fails + " إخفاق" : "\n✓ كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
