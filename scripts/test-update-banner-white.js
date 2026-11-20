/* لافتة «يتوفر تحديث» داكنة: نصّها أبيض في المظهر الفاتح (لا يسوَّد). NODE_PATH=/opt/node-tools/node_modules node scripts/test-update-banner-white.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 430, height: 800 } });
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.setItem("alyssum_admin_theme", "white"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); document.documentElement.classList.add("white"); document.documentElement.classList.remove("glass");
    const d = document.createElement("div"); d.id = "au-banner"; d.style.cssText = "position:fixed;top:14px;inset-inline-end:18px;z-index:10080;background:#173f35;color:#fff;border-radius:14px;padding:.7rem 1rem"; d.innerHTML = '<div>عنوان <span>1.89</span><br><small style="opacity:.8">تعديلاتك غير المنشورة</small></div>'; document.body.appendChild(d); await new Promise(r => setTimeout(r, 900));
    return [d.querySelector("small"), d.querySelector("span"), d.querySelector("div")].map(e => getComputedStyle(e).color); });
  const ok = R.every(c => c === "rgb(255, 255, 255)"); console.log((ok ? "✓ " : "✗ ") + "لافتة التحديث الداكنة: نصّها أبيض في المظهر الفاتح " + (ok ? "" : JSON.stringify(R))); await b.close(); process.exit(ok ? 0 : 1);
})();
