/* واجهة «المنتجات الرقمية» في لوحة التاجر على متصفح حقيقي بوسيط مُحاكى (الخادم مختبَر في platform/api/test/digital-vault.test.mjs):
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-digital-ui.js */
const http = require("http"), fs = require("fs"), path = require("path"); const { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/__blank") { r.writeHead(200, { "Content-Type": "text/html" }); return r.end("<!doctype html><meta charset=utf-8><body></body>"); } const f = path.join(root, decodeURIComponent(u)); if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });
const DB = { off: false, wa: { configured: false, auto: false, template: false, template_name: "", phone_number_id: "" }, calls: [], keys: [{ sku: "iptv-1m", available: 2, sold: 5 }, { sku: "old-sku", available: 9, sold: 0 }], assets: [{ sku: "ebook" }],
  proofs: [{ id: 7, order_id: "W-ORDER-1", method: "baridimob", amount: 3000, payer: "أحمد <b>", state: "pending", has_proof: true, created_at: 1790000000 }],
  orders: [{ order_ref: "W-ORDER-1", name: "زبون <i>x</i>", items: [{ sku: "iptv-1m", qty: 2, title: "IPTV" }], paid: false, state: "awaiting", has_email: true, created_at: 1790000000 },
           { order_ref: "W-ORDER-2", name: "سعيد", items: [{ sku: "iptv-1m", qty: 1, title: "IPTV" }], paid: false, state: "awaiting", has_email: false, created_at: 1790000100 },
           { order_ref: "W-ORDER-3", name: "علي", items: [{ sku: "iptv-1m", qty: 1, title: "IPTV" }], paid: true, state: "ready", has_email: false, created_at: 1790000200 },
           { order_ref: "W-ORDER-4", name: "ياسين", items: [{ sku: "iptv-1m", qty: 3, title: "IPTV" }], paid: true, state: "short", detail: "iptv-1m", has_email: true, created_at: 1790000300 }] };
function handle(b) {
  DB.calls.push(b); if (DB.off) return null; const m = b.method, p = b.path;
  if (m === "GET" && p === "/v1/digital/keys") return { skus: DB.keys };
  if (m === "GET" && p === "/v1/digital/wa") return DB.wa;
  if (m === "PUT" && p === "/v1/digital/wa") { const x = b.body; if (x.auto && !(x.access_token || DB.wa.configured) ) return { __err: { status: 409, error: { code: "wa_not_configured", message: "x" } } }; if (x.access_token) DB.wa.configured = true; if (x.clear_token) DB.wa.configured = false; DB.wa.phone_number_id = x.phone_number_id || ""; DB.wa.template_name = x.template || ""; DB.wa.template = !!x.template; DB.wa.auto = DB.wa.configured && !!x.auto; return { ok: true, auto: DB.wa.auto }; }
  if (m === "GET" && p === "/v1/digital/assets") return { assets: DB.assets };
  if (m === "GET" && p === "/v1/payments/manual") return { proofs: DB.proofs };
  if (m === "GET" && p === "/v1/digital/orders") return { orders: DB.orders };
  if (m === "GET" && p === "/v1/payments/manual/7/proof") return { proof: "data:image/jpeg;base64,/9j/4AAQ" };
  if (m === "POST" && p === "/v1/digital/keys") { DB.keys[0].available += b.body.text.split("\n").filter(Boolean).length; return { ok: true, added: b.body.text.split("\n").filter(Boolean).length, duplicates: 1, delivered_waiting: 1 }; }
  if (m === "DELETE" && p === "/v1/digital/keys/old-sku") { DB.keys = DB.keys.filter((k) => k.sku !== "old-sku"); return { ok: true, removed: 9 }; }
  if (m === "POST" && p === "/v1/digital/assets") return { id: 1, sku: b.body.sku };
  if (m === "POST" && p === "/v1/payments/manual/7/approve") { DB.proofs = []; DB.orders[0].state = "delivered"; return { ok: true }; }
  if (m === "POST" && p === "/v1/payments/manual/orders/W-ORDER-2/approve") { DB.orders[1].state = "delivered"; return { ok: true }; }
  if (m === "GET" && p === "/v1/digital/orders/W-ORDER-3") return { keys: [{ sku: "iptv-1m", values: ["user9:pass9"] }] };
  if (m === "POST" && p === "/v1/digital/orders/W-ORDER-3/sent") { DB.orders[2].state = "delivered"; return { ok: true }; }
  if (m === "POST" && p === "/v1/digital/orders/W-ORDER-4/deliver") return { ok: true, state: "short" };
  return { __err: { status: 404, error: { code: "not_found" } } };
}
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch(), ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.route("**/sb/functions/v1/platform-proxy", async (route) => { const b = JSON.parse(route.request().postData() || "{}"), r = handle(b); if (r === null) return route.fulfill({ status: 404, body: "{}" }); if (r.__err) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: r.__err.status, data: { error: r.__err.error } }) }); route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: 200, data: r }) }); });
  const p = await ctx.newPage(), errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept(/رابط ملف/.test(d.message()) ? "https://f.example/x.pdf" : d.defaultValue())); await p.goto(base + "/__blank");
  await p.addInitScript(() => { window.__open = []; window.open = (u) => { window.__open.push(u); return null; }; });
  await p.evaluate(async () => {
    document.body.innerHTML = '<div id="tab-digital" class="hidden"><div id="digital-content"></div></div>'; window.__toasts = []; window.__open = [];
    window.open = (u) => { window.__open.push(u); return null; };
    window.API = { sb: { token: async () => "tok", url: (q) => "/sb" + q, headers: () => ({ "Content-Type": "application/json" }) } };
    window.Admin = { products: [{ slug: "iptv-1m", title: "اشتراك <u>IPTV</u>", digital: true }, { slug: "plain", title: "عادي" }, { slug: "ebook", title: "كتاب", digital: true }, { slug: "vp", title: "VPN", digital: true, variations: [{ id: "m1", attrs: { المدة: "شهر" } }, { id: "y1", attrs: { المدة: "سنة" } }, { id: "gone", attrs: { المدة: "قديم" }, active: false }] }],
      orders: [{ id: "o3", status: "confirmee", name: "علي", phone: "0550123456", extra: { "🔗 مرجع": "W-ORDER-3" } }], tab() { }, toast: (t) => window.__toasts.push(t), changeStatus(i, st) { window.__status = [i, st]; } };
    await new Promise((r) => { const e = document.createElement("script"); e.src = "/assets/js/admin-digital.js"; e.onload = r; document.body.appendChild(e); }); Admin.tab("digital");
  });
  await p.waitForSelector(".dgx-tbl", { timeout: 8000 });
  const txt = () => p.evaluate(() => document.getElementById("dg-app").textContent.replace(/[  ]/g, " ")), toasts = () => p.evaluate(() => window.__toasts);
  let t = await txt();
  ok("المنتجات الرقمية فقط + المفاتيح اليتيمة", /اشتراك <u>IPTV<\/u>/.test(t) && /كتاب/.test(t) && !/عادي/.test(t) && /old-sku/.test(t));
  ok("لا XSS", !(await p.$("#dg-app u")) && !(await p.$("#dg-app i")) && !(await p.$("#dg-app b b")));
  ok("تنبيه المخزون المنخفض (≤3)", await p.evaluate(() => !!document.querySelector(".dgx-low")) && /2 ⚠️/.test(t));
  ok("ملف مربوط يظهر", /ملف مربوط/.test(t));
  ok("الجوال: لا فيض أفقي", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  /* مفاتيح */
  await p.click('[data-dg=addkeys][data-sku="iptv-1m"]'); await p.waitForSelector("#dg-keys"); await p.click("[data-dg=keysave]"); ok("بلا نص: تنبيه", (await toasts()).some((x) => /ألصق المفاتيح/.test(x)));
  await p.fill("#dg-keys", "u1:p1\nu2:p2\nu3:p3"); await p.click("[data-dg=keysave]"); await p.waitForFunction(() => !document.getElementById("dg-keys"));
  const kc = DB.calls.filter((c) => c.method === "POST" && c.path === "/v1/digital/keys").pop(); ok("حفظ المفاتيح بالنص والـsku", kc.body.sku === "iptv-1m" && kc.body.text.split("\n").length === 3);
  ok("إشعار الإضافة يذكر المكرر والطلب المنتظر", (await toasts()).some((x) => /أُضيف 3/.test(x) && /مكرراً/.test(x) && /سُلّم 1/.test(x)));
  await p.click('[data-dg=delkeys][data-sku="old-sku"]'); await p.waitForFunction(() => !/old-sku/.test(document.getElementById("dg-app").textContent)); ok("حذف المتاح", DB.calls.some((c) => c.method === "DELETE"));
  await p.click('[data-dg=file][data-sku="iptv-1m"]'); await p.waitForFunction(() => window.__toasts.some((x) => /رُبط الملف/.test(x))); const fc = DB.calls.filter((c) => c.path === "/v1/digital/assets" && c.method === "POST").pop(); ok("ربط ملف يرسل sku والرابط", fc && fc.body.sku === "iptv-1m" && fc.body.location === "https://f.example/x.pdf", fc);
  /* إثباتات الدفع */
  t = await txt(); ok("الإثبات المعلّق بمبلغه ووسيلته", /W-ORDER-1/.test(t) && /BaridiMob/.test(t) && /3 000/.test(t) && /أحمد <b>/.test(t) && !(await p.$("#dg-app .dgx-pf b b")));
  ok("طلب بلا إثبات يظهر بزر «بلا صورة»", await p.$('[data-dg=approveorder][data-ref="W-ORDER-2"]') !== null && await p.$('[data-dg=approveorder][data-ref="W-ORDER-1"]') === null);
  await p.click("[data-dg=showproof]"); await p.waitForSelector(".dgx-pf img"); ok("عرض صورة الإثبات عند الطلب فقط", (await p.getAttribute(".dgx-pf img", "src")).startsWith("data:image/jpeg"));
  await p.click("[data-dg=approve]"); await p.waitForFunction(() => !document.querySelector("[data-dg=approve]")); ok("الموافقة تستدعي المسار وتحدّث", DB.calls.some((c) => c.path === "/v1/payments/manual/7/approve") && (await toasts()).some((x) => /تمت الموافقة/.test(x)));
  await p.click('[data-dg=approveorder][data-ref="W-ORDER-2"]'); await p.waitForFunction(() => !document.querySelector('[data-dg=approveorder]')); ok("موافقة مباشرة بلا صورة", DB.calls.some((c) => c.path === "/v1/payments/manual/orders/W-ORDER-2/approve"));
  /* الطلبات */
  t = await txt(); ok("حالات الطلبات", /جاهز للإرسال/.test(t) && /نفد المخزون/.test(t) && /مُسلَّم/.test(t));
  await p.click('[data-dg=wa][data-ref="W-ORDER-3"]'); await p.waitForFunction(() => window.__open.length > 0); const wa = await p.evaluate(() => window.__open[0]);
  ok("واتساب برقم الزبون بصيغة دولية ورسالة فيها المفتاح", wa.startsWith("https://wa.me/213550123456?text=") && decodeURIComponent(wa).includes("user9:pass9"), wa);
  await p.click('[data-dg=sent][data-ref="W-ORDER-3"]'); await p.waitForFunction(() => window.__status); ok("تم الإرسال ← الطلب مُسلَّم في اللوحة أيضاً", DB.calls.some((c) => c.path === "/v1/digital/orders/W-ORDER-3/sent") && (await p.evaluate(() => window.__status))[1] === "livree");
  await p.click('[data-dg=redeliver][data-ref="W-ORDER-4"]'); await p.waitForFunction(() => window.__toasts.some((x) => /ما زال لا يكفي/.test(x))); ok("إعادة المحاولة مع بقاء النفاد", true);
  /* منتج رقمي متغيّر: صف مخزون لكل تنويع فعّال */
  ok("صف لكل تنويع فعّال بـsku slug.vkey", await p.$('[data-dg=addkeys][data-sku="vp.m1"]') !== null && await p.$('[data-dg=addkeys][data-sku="vp.y1"]') !== null && await p.$('[data-dg=addkeys][data-sku="vp"]') === null && await p.$('[data-dg=addkeys][data-sku="vp.gone"]') === null);
  ok("عنوان الصف يذكر المنتج والمدة", /VPN — سنة/.test(await txt()));
  await p.click('[data-dg=addkeys][data-sku="vp.y1"]'); await p.waitForSelector("#dg-keys"); await p.fill("#dg-keys", "y1\ny2"); await p.click("[data-dg=keysave]"); await p.waitForFunction(() => !document.getElementById("dg-keys"));
  ok("المفاتيح تُحفظ بـsku التنويع", DB.calls.filter((c) => c.method === "POST" && c.path === "/v1/digital/keys").pop().body.sku === "vp.y1");
  ok("vsku يطابق المنصة", await p.evaluate(() => AdminDigital._t.vsku("a", "x y/1") === "a.x_y_1" && AdminDigital._t.vsku("a", "") === "a"));
  /* التسليم الآلي عبر واتساب */
  t = await txt(); ok("بطاقة التسليم الآلي بحالة متوقف", /التسليم الآلي عبر واتساب/.test(t) && /متوقف/.test(t));
  await p.check("#dg-wa-on"); await p.click("[data-dg=wasave]"); await p.waitForFunction(() => window.__toasts.some((x) => /أدخل معرّف الرقم والرمز/.test(x))); ok("تفعيل بلا رمز يُرفض برسالة واضحة", true);
  await p.fill("#dg-wa-pid", "555000111"); await p.fill("#dg-wa-tok", "EAAB" + "z".repeat(30)); await p.fill("#dg-wa-tpl", "order_keys"); await p.check("#dg-wa-on"); await p.click("[data-dg=wasave]"); await p.waitForFunction(() => window.__toasts.some((x) => /مفعّل/.test(x)));
  const wc = DB.calls.filter((c) => c.method === "PUT" && c.path === "/v1/digital/wa").pop(); ok("الحفظ يرسل المعرّف والرمز والقالب والتفعيل", wc.body.phone_number_id === "555000111" && wc.body.access_token.startsWith("EAAB") && wc.body.template === "order_keys" && wc.body.auto === true, wc.body);
  await p.waitForFunction(() => /مفعّل/.test(document.getElementById("dg-app").textContent) && document.getElementById("dg-wa-tok").value === ""); ok("الرمز لا يبقى في الخانة ولا في الصفحة", !(await p.evaluate(() => document.documentElement.outerHTML.includes("EAABzzzz"))));
  await p.fill("#dg-wa-pid", "555000111"); await p.click("[data-dg=wasave]"); await p.waitForFunction(() => window.__toasts.filter((x) => /حُفظ|مفعّل/.test(x)).length >= 2); ok("حفظ بلا رمز يُبقي المحفوظ (لا access_token في الطلب)", !("access_token" in DB.calls.filter((c) => c.method === "PUT" && c.path === "/v1/digital/wa").pop().body));
  /* تنبيهات الرئيسية */
  DB.keys.push({ sku: "low-one", available: 1, sold: 4 }, { sku: "zero-one", available: 0, sold: 2 }); await p.evaluate(() => AdminDigital.refresh()); const al = await p.evaluate(() => AdminDigital.alerts()); ok("تنبيهات: إثبات معلّق ومخزون منخفض وطلب ينتظر مفاتيح", al && al.low === 1 && al.out === 1 && al.short === 1 && al.lowSkus.length === 2, al);
  /* طرق الدفع */
  await p.fill("#dg-b-rip", "0079 9999 0012 3456 7890abc"); await p.check("#dg-b-on"); await p.fill("#dg-b-name", "علي"); await p.click("[data-dg=paysave]");
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("alyssum_pay_methods"))); ok("حفظ طرق الدفع بتنظيف الـRIP", saved.baridimob.on && saved.baridimob.rip === "0079 9999 0012 3456 7890" && saved.ccp.on === false, saved);
  await p.fill("#dg-c-acc", ""); await p.check("#dg-c-on"); await p.click("[data-dg=paysave]"); ok("CCP بلا رقم حساب مرفوض", (await toasts()).some((x) => /رقم حساب CCP/.test(x)));
  DB.off = true; await p.evaluate(() => AdminDigital.refresh()); ok("وسيط غير منشور ← رسالة دعم", /غير مفعّلة بعد/.test(await txt()));
  ok("بلا أخطاء جافاسكربت", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? "فشل " + fails : "كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
