/* اختبار «جرّب عليك» في صفحة المنتج (tryon-shopper.js): ظهور الزر بشرطيه، الموافقة، التصغير، الإرسال، الأخطاء، تذكّر الصورة في الجلسة فقط:
     NODE_PATH=/opt/node-tools/node_modules node scripts/test-tryon-shopper.js */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
let total = 0, fails = 0; const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } else console.log("✓", n); };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.route("https://shop.test/**", r => /\.(png|jpg)$/.test(r.request().url()) ? r.fulfill({ contentType: "image/png", body: PNG }) : r.fulfill({ contentType: "text/html", body: "<!doctype html><html><body><main><h1>p</h1><form id='order-form'></form></main></body></html>" }));
  await p.goto("https://shop.test/p/dress/");
  const src = fs.readFileSync(path.join(__dirname, "../assets/js/tryon-shopper.js"), "utf8");
  const T = fn => p.evaluate(fn);
  const boot = async (cfg, prods) => { await p.evaluate(([c, pr]) => { document.querySelectorAll("#tryon-open,#tryon-bg,#tryon-css").forEach(e => e.remove()); window.CONFIG = c; window.PRODUCTS = pr; window.REL = "../../"; window.currentProductSlugFromUrl = () => "dress"; delete window.TryOnShopper; }, [cfg, prods]); await p.addScriptTag({ content: src }); await p.waitForTimeout(900); };
  /* بلا مفتاح: لا شيء */
  await boot({ PLATFORM_URL: "https://api.x" }, [{ slug: "dress", title: "فستان", cover: "assets/a.png", tryon: true }]); ok("بلا مفتاح: لا زر", await T(() => !document.getElementById("tryon-open") && !window.TryOnShopper));
  await boot({ PLATFORM_URL: "https://api.x", PLATFORM_TRYON_KEY: "pk_pub_t" }, [{ slug: "dress", title: "فستان", cover: "assets/a.png" }]); ok("منتج بلا tryon: لا زر", await T(() => !document.getElementById("tryon-open")));
  await boot({ PLATFORM_URL: "https://api.x", PLATFORM_TRYON_KEY: "pk_pub_t" }, [{ slug: "dress", title: "فستان <b>", cover: "assets/a.png", tryon: true }]);
  ok("منتج tryon + مفتاح: زر قبل النموذج", await T(() => { const b = document.getElementById("tryon-open"); return !!b && b.nextElementSibling === document.getElementById("order-form"); }));
  /* النافذة */
  await T(() => document.getElementById("tryon-open").click());
  ok("النافذة: العنوان مهرَّب والزر معطّل بلا صورة", await T(() => { const x = document.getElementById("tryon-box"); return !!x && !x.querySelector("h3 b") && document.getElementById("tryon-go").disabled; }));
  await p.setInputFiles("#tryon-f", { name: "me.png", mimeType: "image/png", buffer: PNG }); await p.waitForTimeout(400);
  ok("بعد رفع صورة: تُعرض لكن الزر معطّل حتى الموافقة", await T(() => !!document.querySelector("#tryon-pv img") && document.getElementById("tryon-go").disabled));
  await T(() => { const c = document.getElementById("tryon-c"); c.checked = true; c.dispatchEvent(new Event("change")); });
  ok("بعد الموافقة: الزر يعمل", await T(() => !document.getElementById("tryon-go").disabled));
  /* الإرسال الناجح */
  await T(() => { window.__req = null; window.__real = window.fetch; window.fetch = (u, o) => { if (String(u).startsWith("https://api.x")) { window.__req = [String(u), o]; return Promise.resolve(new Response(JSON.stringify({ image: "data:image/jpeg;base64,/9j/AA==", remaining_today: 5 }), { status: 200 })); } return window.__real(u, o); }; });
  await T(() => document.getElementById("tryon-k").click()); await T(() => document.getElementById("tryon-go").click()); await p.waitForTimeout(900);
  const req = await T(() => { const r = window.__req; return r && { url: r[0], auth: r[1].headers.Authorization, ct: r[1].headers["Content-Type"], body: JSON.parse(r[1].body) }; });
  ok("الطلب: المسار والمفتاح العام وconsent", req && req.url === "https://api.x/v1/tryon" && req.auth === "Bearer pk_pub_t" && req.body.consent === true, req && Object.keys(req.body));
  ok("الطلب: الشخص والقطعة JPEG data URL", req && /^data:image\/jpeg;base64,/.test(req.body.person) && /^data:image\/jpeg;base64,/.test(req.body.garment));
  ok("النتيجة: صورة وتنزيل وزر اطلب الآن", await T(() => !!document.querySelector("#tryon-out img.t-r") && !!document.querySelector("#tryon-out a[download]") && !!document.getElementById("tryon-buy")));
  ok("تذكّر الصورة: بجلسة التصفح فقط (sessionStorage) لا localStorage", await T(() => { const keys = Object.keys(localStorage).filter(k => /tryon/.test(k)); return !!sessionStorage.getItem("tryon_person") && !keys.length; }));
  /* إغلاق ثم فتح: الصورة المحفوظة تظهر */
  await T(() => document.getElementById("tryon-x").click()); await T(() => document.getElementById("tryon-open").click());
  ok("إعادة الفتح: الصورة المتذكَّرة جاهزة", await T(() => !!document.querySelector("#tryon-pv img")));
  /* أخطاء الخدمة */
  await T(() => { window.fetch = (u, o) => String(u).startsWith("https://api.x") ? Promise.resolve(new Response(JSON.stringify({ error: { code: "quota_exceeded" } }), { status: 429 })) : window.__real(u, o); document.getElementById("tryon-c").checked = true; document.getElementById("tryon-c").dispatchEvent(new Event("change")); });
  await T(() => document.getElementById("tryon-go").click()); await p.waitForTimeout(900);
  ok("حصة منتهية: رسالة عربية مفهومة", await T(() => /غداً/.test(document.getElementById("tryon-msg").textContent) && !document.querySelector("#tryon-out img")));
  await T(() => { window.fetch = (u, o) => String(u).startsWith("https://api.x") ? Promise.reject(new Error("net")) : window.__real(u, o); });
  await T(() => document.getElementById("tryon-go").click()); await p.waitForTimeout(900);
  ok("انقطاع الشبكة: رسالة اتصال", await T(() => /الاتصال/.test(document.getElementById("tryon-msg").textContent) && !document.getElementById("tryon-go").disabled));
  /* عدم التذكّر */
  await T(() => { document.getElementById("tryon-k").checked = false; window.fetch = (u, o) => String(u).startsWith("https://api.x") ? Promise.resolve(new Response(JSON.stringify({ image: "data:image/jpeg;base64,/9j/AA==" }), { status: 200 })) : window.__real(u, o); });
  await T(() => document.getElementById("tryon-go").click()); await p.waitForTimeout(900);
  ok("إلغاء «تذكّر صورتي» يمسحها", await T(() => !sessionStorage.getItem("tryon_person")));
  ok("بلا أخطاء JS", errs.length === 0, errs);
  console.log(fails ? "فشل " + fails + " من " + total : "نجح " + total + " من " + total);
  await b.close(); process.exit(fails ? 1 : 0);
})();
