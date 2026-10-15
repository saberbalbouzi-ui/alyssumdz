/* واجهة «المحفظة» على متصفح حقيقي بوسيط مُحاكى (الخادم والدفتر مختبَران في saas/platform/test/wallet.test.mjs):
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-wallet-ui.js */
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0, total = 0;
const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/__blank") { r.writeHead(200, { "Content-Type": "text/html" }); return r.end("<!doctype html><meta charset=utf-8><body></body>"); } const f = path.join(root, decodeURIComponent(u)); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });
const NOW = Math.floor(Date.now() / 1000);
const DB = { off: false, calls: [], avail: 34480, hold: 0, ads: 5000, rate: 260, wds: [{ id: 1, amount: 20000, currency: "DZD", method: "ccp", status: "paid", note: "", created_at: NOW - 86400, updated_at: NOW }, { id: 2, amount: 5000, currency: "DZD", method: "baridimob", status: "requested", note: "", created_at: NOW - 600, updated_at: NOW }],
  escrow: [{ order_id: "<b>W9</b>", amount: 5000, currency: "DZD", state: "held", fee: 0, created_at: NOW - 3600, settled_at: null }],
  led: [{ id: 9, ref: "r9", kind: "escrow_release", memo: "رسم المنصة 520", order_id: "W1", created_at: NOW - 100, legs: [{ account: "escrow", currency: "DZD", amount: -5000 }, { account: "available", currency: "DZD", amount: 4480 }, { account: "platform_fees", currency: "DZD", amount: 520 }] }, { id: 8, ref: "r8", kind: "deposit", memo: "<img src=x onerror=\"window.__pwn=1\">", order_id: null, created_at: NOW - 900, legs: [{ account: "available", currency: "DZD", amount: 50000 }] }] };
function handle(b) {
  DB.calls.push(b); const m = b.method, p = b.path, q = b.query || {}; if (DB.off) return null;
  if (m === "GET" && p === "/v1/wallet") return { balances: { available: { DZD: DB.avail }, escrow: { DZD: 5000 }, withdraw_hold: { DZD: DB.hold }, ads_credit: { USD: DB.ads } }, settings: { fee_pct: 10, fee_fixed: 20, usd_rate: DB.rate, min_withdrawal: 1000 } };
  if (m === "GET" && p === "/v1/wallet/escrow") return { escrow: DB.escrow };
  if (m === "GET" && p === "/v1/wallet/withdrawals") return { withdrawals: DB.wds };
  if (m === "GET" && p === "/v1/wallet/ledger") return { entries: DB.led, next: null };
  if (m === "GET" && p === "/v1/wallet/ads-quote") return { usd: +q.usd, dzd: Math.ceil(q.usd * DB.rate), rate: DB.rate };
  if (m === "POST" && p === "/v1/wallet/withdrawals") { if (b.body.amount > DB.avail) return { __err: { status: 409, error: { code: "insufficient_funds", message: "x" } } }; DB.avail -= b.body.amount; DB.hold += b.body.amount; DB.wds.unshift({ id: 3, amount: b.body.amount, currency: "DZD", method: b.body.method, status: "requested", note: "", created_at: NOW, updated_at: NOW }); return { id: 3, status: "requested" }; }
  if (m === "POST" && p === "/v1/wallet/ads-topup") { DB.avail -= Math.ceil(b.body.usd * DB.rate); DB.ads += b.body.usd * 100; return { ok: true }; }
  if (m === "DELETE" && /\/withdrawals\/\d+$/.test(p)) { const w = DB.wds.find((x) => p.endsWith("/" + x.id)); if (w) { w.status = "cancelled"; DB.avail += w.amount; } return { ok: true }; }
  return { __err: { status: 404, error: { code: "not_found" } } };
}
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch(), ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route("**/sb/functions/v1/platform-proxy", async (route) => {
    const b = JSON.parse(route.request().postData() || "{}"), r = handle(b);
    if (r === null) return route.fulfill({ status: 404, body: "{}" });
    if (r.__err) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: r.__err.status, data: { error: r.__err.error } }) });
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: 200, data: r }) });
  });
  const p = await ctx.newPage(), errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept());
  await p.goto(base + "/__blank");
  await p.evaluate(async () => {
    document.body.innerHTML = '<div id="tab-wallet" class="hidden"><div id="wallet-content"></div></div>';
    window.__toasts = []; window.API = { sb: { token: async () => "tok", url: (p) => "/sb" + p, headers: () => ({ "Content-Type": "application/json" }) } };
    window.Admin = { tab() { }, toast: (t) => window.__toasts.push(t) };
    await new Promise((r) => { const e = document.createElement("script"); e.src = "/assets/js/admin-wallet.js"; e.onload = r; document.body.appendChild(e); });
    Admin.tab("wallet");
  });
  await p.waitForSelector(".wl-cards", { timeout: 8000 });
  const txt = () => p.evaluate(() => document.getElementById("wl-app").textContent.replace(/[\u00a0\u202f]/g, " "));
  let t = await txt();
  ok("أربع بطاقات أرصدة: المتاح والضمان والسحب والإعلانات", await p.evaluate(() => document.querySelectorAll(".wl-card").length === 4) && /34 480/.test(t) && /5 000 دج/.test(t) && /50\.00 \$/.test(t), t.slice(0, 300));
  ok("الضمان المحجوز يُهرَّب (لا HTML) ويُشرح الرسم 10%", !(await p.evaluate(() => document.querySelector(".wl-tbl b"))) && /10%/.test(t));
  ok("الدفتر: عمليات بالعربية وأثر الأرجل (متاح/ضمان) بلا حسابات النظام", /تحرير ضمان/.test(t) && /\+4 480 دج/.test(t) && !/platform_fees/.test(t));
  ok("ملاحظة الدفتر تُهرَّب (لا تنفيذ)", await p.evaluate(() => !window.__pwn && !document.querySelector("#wl-app img")));
  ok("حالات السحب بالعربية وزر إلغاء للمنتظِر فقط", /تم الصرف/.test(t) && /قيد المراجعة/.test(t) && (await p.evaluate(() => document.querySelectorAll('[data-wl="cancel"]').length)) === 1);
  /* سحب */
  await p.fill("#wl-amt", "500"); await p.fill("#wl-dst", "0012345678"); await p.click('[data-wl="wd"]'); ok("أقل من الحد الأدنى لا يُرسل", !DB.calls.some((c) => c.method === "POST") && await p.evaluate(() => /الحد الأدنى للسحب/.test(__toasts.join())));
  await p.fill("#wl-amt", "900000"); await p.click('[data-wl="wd"]'); ok("أكبر من المتاح لا يُرسل", !DB.calls.some((c) => c.method === "POST"));
  await p.fill("#wl-amt", "10000"); await p.fill("#wl-dst", "ab"); await p.click('[data-wl="wd"]'); ok("وجهة قصيرة لا تُرسل", !DB.calls.some((c) => c.method === "POST"));
  await p.fill("#wl-amt", "10000"); await p.fill("#wl-dst", "0012345678 clé 12"); await p.selectOption("#wl-met", "ccp"); await p.click('[data-wl="wd"]');
  await p.waitForFunction(() => /24 480/.test(document.getElementById("wl-app").textContent.replace(/[\u00a0\u202f]/g, " ")) && document.querySelectorAll(".wl-tbl").length >= 2);
  const post = DB.calls.filter((c) => c.method === "POST").pop();
  ok("طلب السحب يرسل المبلغ والوسيلة والوجهة ومفتاح عدم التكرار", post && post.path === "/v1/wallet/withdrawals" && post.body.amount === 10000 && post.body.method === "ccp" && post.body.destination.includes("0012345678") && post.idempotencyKey && post.idempotencyKey.length > 8, post);
  t = await txt(); ok("بعد الطلب: المتاح 24 480 والمحجوز للسحب 10 000", /24 480/.test(t) && /10 000 دج/.test(t), t.slice(0, 200));
  ok("الوجهة لا تبقى في الصفحة بعد الإرسال", await p.evaluate(() => document.getElementById("wl-dst").value === ""));
  await p.click('[data-wl="cancel"]'); await p.waitForFunction(() => !document.querySelector('[data-wl="cancel"]') || document.querySelectorAll('[data-wl="cancel"]').length < 2);
  ok("إلغاء طلب سحب يرسل DELETE", DB.calls.some((c) => c.method === "DELETE" && /withdrawals\/\d+$/.test(c.path)));
  /* دولار */
  await p.fill("#wl-usd", "50"); await p.click('[data-wl="quote"]'); await p.waitForFunction(() => /13 000/.test(document.getElementById("wl-app").textContent.replace(/[\u00a0\u202f]/g, " ")));
  ok("عرض السعر: 50$ = 13 000 دج", true);
  const before = DB.ads; await p.fill("#wl-usd", "50"); await p.click('[data-wl="topup"]'); await p.waitForFunction((b) => document.getElementById("wl-app").textContent.includes("100.00 $"), before);
  ok("شراء الرصيد يزيد الدولار 50 → 100", DB.ads === 10000 && DB.calls.filter((c) => c.path === "/v1/wallet/ads-topup").pop().body.usd === 50);
  DB.rate = null; await p.evaluate(() => AdminWallet.refresh()); ok("بلا سعر صرف: لا نموذج شراء ورسالة واضحة", await p.evaluate(() => !document.getElementById("wl-usd") && /تحدّد الإدارة سعر الصرف/.test(document.getElementById("wl-app").textContent)));
  /* غير مفعّلة + جوال */
  await p.setViewportSize({ width: 390, height: 800 }); await p.evaluate(() => AdminWallet.refresh()); ok("الجوال: بلا اتساع أفقي", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
  DB.off = true; await p.evaluate(() => AdminWallet.refresh()); ok("الوسيط غير منشور: رسالة «غير مفعّلة»", await p.evaluate(() => /غير مفعّلة/.test(document.getElementById("wl-app").textContent)));
  ok("لا أخطاء جافاسكربت", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? `\n✗ ${fails} من ${total} فشل` : `\n✓ ${total} فحصاً ناجحاً`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
