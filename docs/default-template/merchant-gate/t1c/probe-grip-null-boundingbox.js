const { chromium } = require("playwright"); const declareProtect = require("./_declared-protect");
const BASE = process.env.EQA_BASE, PW = "TestPass12345", sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1360, height: 900 } }); await declareProtect(ctx); const page = await ctx.newPage(); page.on("dialog", d => d.accept());
  await page.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await sleep(4000);
  await page.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
  await page.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await page.waitForFunction(() => typeof Admin !== "undefined" && AdminNav.tplInstallHome && typeof PBConvert !== "undefined", null, { timeout: 60000 }); await sleep(2000);
  await page.evaluate(async () => { await AdminNav.libOpen(); AdminNav.libClose(); await AdminNav.tplInstallHome("s-tech"); });
  await page.waitForFunction(() => { const f = document.getElementById("pbx-frame"); return f && f.contentDocument && f.contentDocument.querySelector('[data-kind="widget"]'); }, null, { timeout: 40000 }); await sleep(2500);
  if (await page.locator("#pbx-ask").count()) await page.click('#pbx-ask [data-k="no"]').catch(() => {}); await sleep(500);
  // 1) عيّنة كل إطار رسم أثناء تمرير المنصّة: هل توجد أطر بلا أي مقبض؟
  const frames = await page.evaluate(async () => { const st = document.getElementById("pbx-stage"); const out = { total: 0, zero: 0, minGrips: 999, maxGrips: 0, ex: [] }; let t = 0, stop = false; const sample = () => { const n = document.querySelectorAll("#pbx-ovl .pbx-sdiv-g").length; out.total++; if (n === 0) { out.zero++; if (out.ex.length < 3) out.ex.push({ t: Math.round(performance.now()), scroll: st.scrollTop }); } out.minGrips = Math.min(out.minGrips, n); out.maxGrips = Math.max(out.maxGrips, n); if (!stop) requestAnimationFrame(sample); }; requestAnimationFrame(sample); for (let i = 0; i < 60; i++) { st.scrollTop = (i * 137) % Math.max(1, st.scrollHeight - st.clientHeight); await new Promise(r => setTimeout(r, 25)); } stop = true; await new Promise(r => setTimeout(r, 100)); return out; });
  console.log("RAF-SAMPLES", JSON.stringify(frames));
  // 1b) مراقب تغييرات: هل يُفرَّغ المقبض ثم يُعاد رسمه في مهمة لاحقة؟
  const mo = await page.evaluate(async () => { const ovl = document.getElementById("pbx-ovl"), st = document.getElementById("pbx-stage"); const out = { cbs: 0, emptyAfterBatch: 0, tasksWithGap: 0 }; const obs = new MutationObserver(() => { out.cbs++; if (!ovl.querySelector(".pbx-sdiv-g")) out.emptyAfterBatch++; }); obs.observe(ovl, { childList: true, subtree: true }); for (let i = 0; i < 40; i++) { st.scrollTop = (i * 173) % Math.max(1, st.scrollHeight - st.clientHeight); await new Promise(r => setTimeout(r, 30)); } obs.disconnect(); return out; });
  console.log("MUTATION", JSON.stringify(mo));
  // 2) المسار الفعلي للاختبار: تمرير ثم boundingBox بعد زمن عشوائي قصير (سباق Playwright)
  let nulls = 0, N = 80; const loc = page.locator("#pbx-ovl .pbx-sdiv-g").first();
  for (let i = 0; i < N; i++) { await page.evaluate(i => { const st = document.getElementById("pbx-stage"); st.scrollTop = (i * 211) % Math.max(1, st.scrollHeight - st.clientHeight); }, i); await sleep(Math.floor(Math.random() * 30)); const bb = await loc.boundingBox(); if (!bb) nulls++; }
  console.log("BOUNDINGBOX-NULLS", nulls + "/" + N); await b.close();
})();
