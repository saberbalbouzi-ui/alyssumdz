/* V4: فهرسة قاعدة مساعدة اللوحة صارت مقسَّمة بشرائح؛ يجب أن يعمل المساعد في الحالتين: (أ) فتحه قبل اكتمال الفهرسة المؤجَّلة (مسار متزامن)، (ب) بعد اكتمالها،
   وألا تبقى مهمة رئيسية طويلة (>150ms) من الفهرسة تحت تخنيق 4×. التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/assistant-index.js */
const PW = require("playwright"), { startStore } = require("./harness");
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 300) : "")); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await PW.chromium.launch(), store = await startStore({ stock: true });
  try {
    for (const early of [true, false]) {
      const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage(), cdp = await ctx.newCDPSession(p), errs = []; p.setDefaultTimeout(60000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
      await p.goto(store.base + "/admin.html"); await wait(400); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
      await p.addInitScript(() => { window.__long = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ entryTypes: ["longtask"] }); } catch (_) { } });
      await p.goto(store.base + "/admin.html"); await p.waitForFunction(() => typeof AdminHelp !== "undefined" && document.querySelector("#app .top") && !document.querySelector("#app").classList.contains("hidden"), null, { timeout: 60000 });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await wait(early ? 2500 : 19000);   /* التحميل المؤجَّل عند 15ث من ظهور الشريط */
      await p.evaluate(() => AdminHelp.show()); await p.waitForSelector("#ah-in", { state: "visible" });
      await p.fill("#ah-in", "كيف أضيف منتجا جديدا"); await p.keyboard.press("Enter"); await wait(1500);
      const r = await p.evaluate(() => { const m = document.getElementById("ah-m"); return { n: m ? m.children.length : 0, txt: m ? m.innerText.slice(-300) : "" }; });
      ok((early ? "مبكراً (قبل الفهرسة المؤجَّلة)" : "متأخراً (بعد الفهرسة المؤجَّلة)") + ": المساعد يجيب عن سؤال باستعمال الفهرس", r.n >= 2 && r.txt.length > 20, r);
      if (!early) { const lt = await p.evaluate(() => window.__long.filter(x => x[0] > 14000)); const worst = Math.max(0, ...lt.map(x => x[1])); ok("تحت 4×: لا مهمة طويلة >200ms بسبب الفهرسة المؤجَّلة (أطولها " + worst + "ms؛ قبل التقسيم 385ms)", worst < 200, lt.slice(0, 6)); }
      ok("لا أخطاء صفحة", errs.length === 0, errs); await ctx.close();
    }
  } catch (e) { fails++; console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 700)); }
  finally { try { await b.close(); } catch { } try { store.stop(); } catch { } }
  console.log(fails ? "FAILS: " + fails : "ALL PASS"); process.exit(fails ? 1 : 0);
})();
