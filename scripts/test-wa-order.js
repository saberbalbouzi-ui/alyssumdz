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
    out.home = await read(0); out.stop = await read(1);
    A.openOrderPreview(1); await wait(350); const vb = [...document.querySelectorAll("#ord-prev-a a")].find(x => /^viber:/.test(x.getAttribute("href") || "")), tg = [...document.querySelectorAll("#ord-prev-a a")].find(x => /t\.me/.test(x.getAttribute("href") || ""));
    const vh = vb ? vb.getAttribute("href") : "", dm = /draft=(.*)$/.exec(vh); out.vb = { label: vb && vb.textContent, num: vh.split("&")[0], draft: dm ? decodeURIComponent(dm[1]) : "" }; out.tg = { label: tg && tg.textContent, href: tg ? tg.getAttribute("href") : "" };
    let copied = ""; try { Object.defineProperty(navigator, "clipboard", { value: { writeText: async v => { copied = v; } }, configurable: true }); } catch (e) { } tg.addEventListener("click", ev => ev.preventDefault(), true); tg.click(); await wait(250); out.copied = copied;
    const cb = document.createElement("div"); cb.innerHTML = A.callBtnsHtml(A.orders[0]); out.call = { n: cb.querySelectorAll("a.yd-cb").length, vb: !!cb.querySelector("a.vb"), tg: !!cb.querySelector("a.tg"), wa: (cb.querySelector("a.wa") || { getAttribute() { return ""; } }).getAttribute("href").indexOf("text=") > 0 };
    return out; });
  ok("الرابط يبدأ برقم الزبون الدولي ويحمل رسالة", R.home.href === "https://wa.me/213550123456" && R.home.text.length > 30, R.home);
  ok("الرسالة فيها اسم الزبون ورقم الطلب", /مرحباً محمد بن علي/.test(R.home.text) && /S1/.test(R.home.text), R.home.text);
  ok("ملخص الطلب: المنتجات بكمياتها بلا أسعار الأسطر", /عسل التركيز ×2/.test(R.home.text) && /زيت الحبة ×1/.test(R.home.text) && !/4000 DA/.test(R.home.text), R.home.text);
  ok("للمنزل: ولاية وبلدية، ورسم 600 والإجمالي 6,100", /إلى منزلك في/.test(R.home.text) && /600 دج/.test(R.home.text) && /6[\s  ,.]?100 دج/.test(R.home.text), R.home.text);
  ok("للمكتب: اسم المكتب وعنوانه، والتوصيل مجاني عند الرسم 0", /إلى مكتب Hub Ouargla Centre/.test(R.stop.text) && /عنوان المكتب: Rue 1er Novembre/.test(R.stop.text) && /رسم التوصيل: مجاني/.test(R.stop.text), R.stop.text);
  ok("زر فايبر في المعاينة: رقم الزبون الدولي ومسودة بالرسالة الجاهزة", R.vb.label === "فايبر" && R.vb.num === "viber://chat?number=%2B213550123456" && /مرحباً محمد بن علي/.test(R.vb.draft) && /عنوان المكتب: Rue 1er/.test(R.vb.draft), R.vb);
  ok("زر تلغرام: رابط t.me برقم الزبون، والنقر ينسخ الرسالة الجاهزة", R.tg.label === "تلغرام" && R.tg.href === "https://t.me/+213550123456" && /مرحباً محمد بن علي/.test(R.copied) && /المبلغ الإجمالي/.test(R.copied), [R.tg, R.copied]);
  ok("قائمة الطلبات الفاشلة/المسجلة (callBtnsHtml): اتصال وواتساب برسالة وفايبر وتلغرام", R.call.n === 4 && R.call.vb && R.call.tg && R.call.wa, R.call);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
