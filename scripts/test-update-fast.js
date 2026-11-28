/* التحديث السريع: الغطاء يظهر فوراً لأي تبويب محفوظ (لا تُرى الرئيسية)، يُستعاد التبويب ثم يزول، والتحديث لا يعيد جلب مئات السكربتات. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ serviceWorkers: "block", viewport: { width: 412, height: 900 } }), p = await c.newPage(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|generativelanguage/, r => r.abort());
  await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } if (!sessionStorage.getItem("__seed")) { sessionStorage.setItem("__seed", "1"); sessionStorage.setItem("au_state", JSON.stringify({ t: Date.now(), tab: "orders", pb: null })); } document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = "#login-box{display:none!important}"; document.head.appendChild(st); }); window.__cov = []; const tick = () => { const c = document.getElementById("au-cover"), a = document.getElementById("tab-orders"), h = document.getElementById("tab-home"); window.__cov.push([!!c, !!(a && a.offsetParent), !!(h && h.offsetParent)]); }; setInterval(tick, 40); });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(3500); await p.evaluate(() => { document.getElementById("app").classList.remove("hidden"); document.getElementById("login-box") && document.getElementById("login-box").classList.add("hidden"); try { AdminUpdate.early(); } catch (e) { } }); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => { const S = window.__cov; const firstCover = S.findIndex(x => x[0]), coverEnd = S.length - 1 - [...S].reverse().findIndex(x => x[0]); const homeWhileNoCover = S.some((x, i) => x[2] && !x[0] && i > firstCover - 1 && !S.slice(0, i).some(y => y[1])); return { n: S.length, firstCover, coverEnd, ordersFinal: S[S.length - 1][1], homeBeforeOrdersNoCover: S.some((x, i) => x[2] && !x[0] && !S.slice(0, i + 1).some(y => y[1])) }; });
  t("الغطاء يظهر من أول لحظة لتبويب محفوظ، ولا تُرى الرئيسية قبل عودة الصفحة", r.firstCover >= 0 && r.firstCover <= 8 && !r.homeBeforeOrdersNoCover && r.ordersFinal, r);
  // لا إعادة جلب للسكربتات قبل التنقل عند «تحديث»
  const reqs = []; let navAt = -1; p.on("request", q => { if (q.isNavigationRequest() && /[?&]u=/.test(q.url()) && navAt < 0) navAt = reqs.length; else if (/\.(js|css)(\?|$)/.test(q.url())) reqs.push(q.url()); });
  const nav = p.waitForNavigation({ timeout: 15000 }).catch(() => null);
  await p.evaluate(() => { AdminUpdate.apply(); }); await nav; await p.waitForTimeout(300);
  t("التحديث لا يعيد جلب سكربتات اللوحة قبل إعادة التحميل (أقل من 10 طلبات js/css قبل التنقل)", navAt >= 0 && navAt < 10, { navAt, total: reqs.length });
  await b.close(); process.exit(bad ? 1 : 0);
})();
