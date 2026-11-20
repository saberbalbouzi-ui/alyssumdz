// إثبات قابل للإعادة: سقوط سحب عنصر شريط الإعلان (sbar) في pilot-editability يعتمد على موضع تمرير منصّة المحرّر (#pbx-stage.scrollTop)
// لا على القالب: شريط الإجراءات السريعة #pbx-qbar مثبَّت أعلى المنصّة ويظهر بعد التحديد فوق نقطة الضغط نفسها فيستلم هو الضغط.
// التشغيل (متجر تجريبي قائم): EQA_BASE=http://127.0.0.1:8392 EQA_PASS=TestPass12345 NODE_PATH=/opt/node-tools/node_modules node docs/default-template/blocker/sbar-qbar-proof.js
// المتوقّع: لكلا القالبين (s-nexus وs-nexus-fashion) النتيجة نفسها: moved=true عند stage.scrollTop = 0 و24، وmoved=false (والعنصر عند النقطة = QBAR) عند 48 فأكثر.
const { chromium } = require("playwright"); const declareProtect = require("../../../tests/_declared-protect");
const BASE = process.env.EQA_BASE || "http://127.0.0.1:8392", PW = process.env.EQA_PASS || "TestPass12345"; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ viewport: { width: 1360, height: 900 } }); await declareProtect(c); const page = await c.newPage(); page.on("dialog", d => d.accept());
  await page.goto(BASE + "/admin.html", { waitUntil: "commit" }); await sleep(4000);
  await page.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
  await page.goto(BASE + "/admin.html", { waitUntil: "commit" }); await page.waitForFunction(() => typeof PBApp !== "undefined" && Admin.products && Admin.products.length, null, { timeout: 60000 }); await sleep(2500);
  for (const id of ["s-nexus", "s-nexus-fashion"]) {
    await page.evaluate(async id => { await AdminNav.libOpen(); AdminNav.libClose(); await AdminNav.tplInstallHome(id); for (let i = 0; i < 60 && !(PBApp.E && PBApp.E.page && PBApp.E.page.origin); i++) await new Promise(r => setTimeout(r, 250)); }, id); await sleep(3500);
    const sid = await page.evaluate(() => { let s = null; const w = x => { if (x.type === "sbar") s = x.id; (x.cols || []).forEach(w); (x.widgets || []).forEach(w); (x.free || []).forEach(w); }; PBApp.E.page.sections.forEach(w); return s; });
    for (const sy of [0, 24, 48, 72, 120]) {
      await page.evaluate(() => { PBApp.E.sel = null; try { PBApp.E.multi = []; } catch (e) { } }); await page.keyboard.press("Escape"); await sleep(200);
      await page.evaluate(y => { document.getElementById("pbx-stage").scrollTop = y; }, sy); await sleep(500);
      const el = page.locator("#pbx-frame").contentFrame().locator(`[data-kind="widget"][data-pb="${sid}"]`), bb = await el.boundingBox(), x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
      const real = await page.evaluate(() => document.getElementById("pbx-stage").scrollTop);
      const posOf = () => page.evaluate(sid => { let s = null; const w = x => { if (x.id === sid) s = x; (x.cols || []).forEach(w); (x.widgets || []).forEach(w); (x.free || []).forEach(w); }; PBApp.E.page.sections.forEach(w); return JSON.stringify([s.set.fx, s.set.fy]); }, sid);
      await page.mouse.click(x, y); await sleep(400); const p0 = await posOf();
      const topEl = await page.evaluate(([px, py]) => { const e = document.elementFromPoint(px, py); return e ? (e.closest("#pbx-qbar") ? "QBAR" : (e.id || e.tagName)) : "none"; }, [x, y]);
      await page.mouse.move(x, y); await sleep(70); await page.mouse.down(); await sleep(110); await page.keyboard.down("Alt"); await page.mouse.move(x + 26, y + 18, { steps: 12 }); await sleep(110); await page.mouse.up(); await page.keyboard.up("Alt"); await sleep(420);
      const moved = p0 !== await posOf(); if (moved) { await page.keyboard.press("Control+z"); await sleep(300); }
      console.log(id.padEnd(16), "stage.scrollTop", String(real).padStart(4), "frameTop", Math.round(bb.y), "pointY", Math.round(y), "topElement@point:", topEl, "=> moved:", moved);
    }
  }
  await b.close();
})();
