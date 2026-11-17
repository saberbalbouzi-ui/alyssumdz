/* زر واتساب في معاينة الطلب: رسالة جاهزة باسم الزبون وملخص الطلب: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-wa-order.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1000, height: 1200 } }); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, out = {}; window.toast = () => { }; const wait = ms => new Promise(r => setTimeout(r, ms));
    const w = WILAYAS.find(x => x.id === 30); w.desks = [{ id: 1, name: "Hub Ouargla Centre", commune: "Ouargla", address: "Rue 1er Novembre, face à la poste" }];
    const mk = (id, o) => Object.assign({ id, date: new Date().toISOString(), name: "محمد بن علي", phone: "0550123456", wilaya: w.name, commune: "Ouargla", dtype: "home", desk: "", items: "عسل التركيز ×2 = 4000 DA\nزيت الحبة ×1 = 1500 DA", subtotal: 5500, fee: 600, total: 6100, extra: {}, status: "nouvelle", note: "" }, o || {});
    A.orders = [mk("S1"), mk("S2", { dtype: "stop", desk: "Hub Ouargla Centre", fee: 0, total: 5500 })]; A.orderFilters = {}; A.renderOrders();
    const read = async i => { A.openOrderPreview(i); await wait(350); const a = [...document.querySelectorAll("#ord-prev-a a")].find(x => /واتساب/.test(x.textContent)); const h = a ? a.getAttribute("href") : ""; const m = /text=(.*)$/.exec(h); return { href: h.split("?")[0], text: m ? decodeURIComponent(m[1]) : "" }; };
    out.home = await read(0); out.stop = await read(1); return out; });
  ok("الرابط يبدأ برقم الزبون الدولي ويحمل رسالة", R.home.href === "https://wa.me/213550123456" && R.home.text.length > 30, R.home);
  ok("الرسالة فيها اسم الزبون ورقم الطلب", /مرحباً محمد بن علي/.test(R.home.text) && /S1/.test(R.home.text), R.home.text);
  ok("ملخص الطلب: المنتجات بكمياتها بلا أسعار الأسطر", /عسل التركيز ×2/.test(R.home.text) && /زيت الحبة ×1/.test(R.home.text) && !/4000 DA/.test(R.home.text), R.home.text);
  ok("للمنزل: ولاية وبلدية، ورسم 600 والإجمالي 6,100", /إلى منزلك في/.test(R.home.text) && /600 دج/.test(R.home.text) && /6[\s  ,.]?100 دج/.test(R.home.text), R.home.text);
  ok("للمكتب: اسم المكتب وعنوانه، والتوصيل مجاني عند الرسم 0", /إلى مكتب Hub Ouargla Centre/.test(R.stop.text) && /عنوان المكتب: Rue 1er Novembre/.test(R.stop.text) && /رسم التوصيل: مجاني/.test(R.stop.text), R.stop.text);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
