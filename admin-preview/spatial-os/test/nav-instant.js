/* فتح الإعدادات آنياً: النقر على عنصر في المدار الثاني ينقل اللوح المفتوح (إطار محمَّل) إلى تبويبه بلا إعادة تحميل ولا شاشة «جارٍ التحميل»؛
   Shift/Ctrl يفتح لوحاً جديداً؛ ومع لوح مفتوح على العنصر نفسه يُفعَّل بدل التكرار. سطح مكتب + هاتف. التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/nav-instant.js */
const PW = require("playwright"), { startStore } = require("./harness");
const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 320) : "")); console.log(R[R.length - 1]); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await PW.chromium.launch(); const store = await startStore({ stock: true });
  try {
    for (const [name, vp, mob] of [["سطح المكتب", { width: 1440, height: 900 }, false], ["الهاتف", { width: 412, height: 915 }, true]]) {
      const ctx = await b.newContext(Object.assign({ viewport: vp, deviceScaleFactor: 1 }, mob ? { hasTouch: true, isMobile: true } : {})), p = await ctx.newPage(), errs = []; p.setDefaultTimeout(40000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
      await p.goto(store.base + "/admin.html"); await wait(500); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
      await p.goto(store.base + "/admin-preview/spatial-os/index.html?real=1&nozoom=1&noextra=1&nospare=1"); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two, null, { timeout: 90000 }); await wait(1500);
      await p.evaluate(() => { for (const k of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(k, "close"); }); await wait(800);
      const sub = (id, mod) => p.evaluate(([id, mod]) => { const n = document.querySelector('#orbit .node.sub[data-id="' + id + '"]'); n.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: !!mod })); }, [id, mod]);
      await p.evaluate(() => document.querySelector('#orbit .node[data-id="store"]:not(.sub)').click()); await wait(700);
      await sub("ord"); await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 90000 }); await wait(800);
      await p.evaluate(() => { SpatialOS.panels.get("ord").fr.contentWindow.__mark = 7; });
      const t0 = Date.now(); await sub("delivery");
      await p.waitForFunction(() => { const q = SpatialOS.panels.get("delivery"); if (!q) return false; const d = q.fr.contentDocument, t = d.getElementById("tab-delivery"); return !!t && !t.classList.contains("hidden"); }, null, { timeout: 5000 }); const dt = Date.now() - t0;
      const s = await p.evaluate(() => { const q = SpatialOS.panels.get("delivery"), ld = q.el.querySelector(".fr-load"); return { n: SpatialOS.panels.size, old: SpatialOS.panels.has("ord"), mark: q.fr.contentWindow.__mark, title: q.el.querySelector("h3").textContent, aria: q.el.getAttribute("aria-label"), load: !!ld && getComputedStyle(ld).display !== "none" && ld.offsetParent !== null, nodeOpen: document.querySelector('#orbit .node.sub[data-id="delivery"]').classList.contains("open") || document.querySelector('#orbit .node.sub[data-id="delivery"]').classList.contains("sel") }; });
      ok(name + ": النقر على عنصر في المدار الثاني ينقل اللوح المفتوح إلى تبويبه آنياً (< 800ms) بلا لوح جديد", dt < 800 && s.n === 1 && !s.old, { dt, s });
      ok(name + ": الإطار نفسه (لا إعادة تحميل) ولا شاشة «جارٍ التحميل»", s.mark === 7 && !s.load, s);
      ok(name + ": عنوان اللوح باسم القسم الجديد وعقدة المدار تتعلّم", /التوصيل/.test(s.title) && s.aria === s.title, s);
      await sub("ord"); await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && !q.fr.contentDocument.getElementById("tab-orders").classList.contains("hidden"); }, null, { timeout: 5000 });
      ok(name + ": العودة إلى «تجهيز الطلبات» أيضاً آنية على اللوح نفسه", await p.evaluate(() => SpatialOS.panels.size === 1 && SpatialOS.panels.get("ord").fr.contentWindow.__mark === 7));
      await sub("coupons", true); await p.waitForFunction(() => SpatialOS.panels.size === 2, null, { timeout: 8000 }); ok(name + ": Shift+نقر يفتح لوحاً جديداً (نافذة إضافية)", await p.evaluate(() => SpatialOS.panels.has("coupons") && SpatialOS.panels.has("ord")));
      await sub("ord"); await wait(500); ok(name + ": عنصر مفتوح أصلاً يُفعَّل ولا يتكرر", await p.evaluate(() => SpatialOS.panels.size === 2));
      await p.evaluate(() => SpatialOS.panels.get("ord").fr.contentWindow.__m2 = 1); await sub("returns"); await wait(900);
      const ks = await p.evaluate(() => [...SpatialOS.panels.keys()].sort()); ok(name + ": ينتقل اللوح المُركَّز (ord) فقط إلى العنصر الجديد ويبقى الآخر (coupons) كما هو", JSON.stringify(ks) === JSON.stringify(["coupons", "returns"]), ks);
      ok(name + ": لا أخطاء صفحة", errs.length === 0, errs); await ctx.close();
    }
  } catch (e) { fails++; console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 800)); }
  finally { try { await b.close(); } catch { } try { store.stop(); } catch { } }
  console.log(fails ? "\nFAILED: " + fails : "\nALL PASS (" + R.filter(x => x.startsWith("PASS")).length + ")"); process.exit(fails ? 1 : 0);
})();
