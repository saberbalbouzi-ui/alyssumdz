/* الهاتف حين تكون خدمة LAURA غير مفعَّلة على الخادم (الإنتاج الساكن: لا api/index.php ولا خدمة LAURA): الضغط على زر LAURA كان بلا أثر مرئي
   (الرسالة تُكتب في شريط HUD المخفي على الهاتف)؛ يجب أن تظهر رسالة صريحة ويُفتح «اسألني» (مساعد الاستعمال) بدلها. يخدم المستودع بخادم ساكن بلا PHP.
   التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/phone-laura-off.js */
const PW = require("playwright"), { spawn } = require("child_process"), path = require("path"), net = require("net");
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 320) : "")); }; const wait = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
(async () => {
  const ROOT = path.resolve(__dirname, "../../.."), port = await freePort(), srv = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" }); let b = null;
  try {
    for (let i = 0; i < 40; i++) { try { const r = await fetch("http://127.0.0.1:" + port + "/VERSION"); if (r.ok) break; } catch (_) { } await wait(250); }
    b = await PW.chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }), p = await ctx.newPage(), errs = []; p.setDefaultTimeout(40000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await p.goto("http://127.0.0.1:" + port + "/admin-preview/spatial-os/index.html?real=1&nozoom=1&norestore=1&nospare=1&noextra=1"); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && document.body.classList.contains("ps"), null, { timeout: 60000 }); await wait(1500);
    ok("الوضع: حقيقي بلا واجهة PHP (apiReal=false) والواجهة الهاتفية فعّالة", await p.evaluate(() => SpatialOS.real === true && SpatialOS.apiReal === false && document.body.classList.contains("ps")), await p.evaluate(() => [SpatialOS.real, SpatialOS.apiReal]));
    await p.tap("#ps-bot .ps-laura"); await wait(2500);
    const R = await p.evaluate(() => { const m = document.getElementById("ps-msg"), r = m.getBoundingClientRect(); return { shown: !m.hidden && getComputedStyle(m).display !== "none", text: m.textContent, top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, panels: [...SpatialOS.panels.keys()] }; });
    ok("الضغط على LAURA يُظهر رسالة صريحة داخل الشاشة (لا صمت)", R.shown && /LAURA/.test(R.text) && /غير مفعَّلة/.test(R.text) && R.top >= 0 && R.bottom <= R.vh, R);
    ok("ويُفتح «اسألني» (مساعد الاستعمال) بدلها", R.panels.indexOf("ai") >= 0, R.panels);
    ok("لا أخطاء صفحة", errs.length === 0, errs);
  } catch (e) { fails++; console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 700)); }
  finally { try { if (b) await b.close(); } catch { } try { srv.kill(); } catch { } }
  console.log(fails ? "FAILS: " + fails : "ALL PASS"); process.exit(fails ? 1 : 0);
})();
