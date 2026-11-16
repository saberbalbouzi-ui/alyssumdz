/* لوحة التحكم قابلة للتثبيت كتطبيق مستقل: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-admin-pwa.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ serviceWorkers: "allow" }), p = await ctx.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "load" }); await p.waitForTimeout(3000); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(500);
  const href = await p.evaluate(() => (document.querySelector('link[rel="manifest"]') || {}).href || "");
  ok("الصفحة تربط مانيفست اللوحة (لا مانيفست المتجر)", /manifest-admin\.webmanifest$/.test(href), href);
  const mf = await (await p.request.get(href)).json();
  ok("المانيفست: standalone وبداية من اللوحة ونطاق صحيح", mf.display === "standalone" && /^admin\.html/.test(mf.start_url) && mf.scope === "./", mf);
  ok("اسم عام بلا هوية المتجر", !/أليسوم|alyssum/i.test(JSON.stringify(mf)), mf.name);
  const st = []; for (const i of mf.icons) st.push((await p.request.get(new URL(i.src, href).href)).status());
  ok("الأيقونات الثلاث موجودة", st.length === 3 && st.every(x => x === 200), st);
  const cdp = await ctx.newCDPSession(p); let errsInst = null; try { errsInst = (await cdp.send("Page.getInstallabilityErrors")).installabilityErrors.map(e => e.errorId); } catch (e) { errsInst = ["n/a:" + e.message]; }
  ok("Chrome لا يرى عوائق للتثبيت (عدا ما يخصّ localhost/وسائط الأمان)", !errsInst.some(x => /manifest|icon|start-url|service-worker|display/i.test(x) && !/not-served-from-secure|no-matching-service-worker/.test(x)), errsInst);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
