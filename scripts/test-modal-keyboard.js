/* لوحة المفاتيح على الجوال لا تغطّي الحقل: عند تقلّص المنظور المرئي تُقصَّر النافذة فوق الكلافيي ويُمرَّر الحقل المركَّز إلى المساحة المرئية، وتعود كما كانت عند إغلاقها. (محاكاة visualViewport — الكلافيي الحقيقي لم يُجرَّب.) NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 800 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { }
    const vv = new EventTarget(); Object.assign(vv, { width: 420, height: 800, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1 }); window.__vv = vv; Object.defineProperty(window, "visualViewport", { get: () => vv, configurable: true }); });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  await p.evaluate(() => { document.getElementById("app").classList.remove("hidden"); Admin.showNotice("نافذة", "<div>" + Array.from({ length: 14 }, (_, i) => "<div style='height:46px'><input id='f" + i + "' type='text' style='width:100%'></div>").join("") + "</div>"); });
  await p.waitForTimeout(700);
  const geo = () => p.evaluate(() => { const bg = document.getElementById("notice-modal-bg"), m = bg.querySelector(".modal").getBoundingClientRect(); return { bgH: Math.round(bg.getBoundingClientRect().height), top: Math.round(m.top), bottom: Math.round(m.bottom) }; });
  const g0 = await geo();
  await p.evaluate(() => { __vv.height = 400; __vv.dispatchEvent(new Event("resize")); }); await p.waitForTimeout(500);
  const g1 = await geo();
  t("الكلافيي مفتوح (منظور 400 من 800): النافذة كلها فوقه", g1.bgH <= 401 && g1.bottom <= 401 && g1.top >= 0, { g0, g1 });
  await p.evaluate(() => document.getElementById("f13").focus()); await p.waitForTimeout(1100);
  const f = await p.evaluate(() => { const r = document.getElementById("f13").getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
  t("الحقل الأخير بعد التركيز يظهر داخل المساحة المرئية فوق الكلافيي", f.top >= 0 && f.bottom <= 400, f);
  await p.evaluate(() => { __vv.height = 800; __vv.dispatchEvent(new Event("resize")); }); await p.waitForTimeout(500);
  const g2 = await geo(), un = await p.evaluate(() => { const bg = document.getElementById("notice-modal-bg"), k = bg.querySelector(".modal"); return { mh: k.style.maxHeight, bgh: bg.style.height }; });
  t("بعد إغلاق الكلافيي تعود النافذة لحجمها (بلا قيود باقية)", g2.bgH >= 790 && un.bgh === "" && un.mh === "", { g2, un });
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
