/* يتحقق أن المتحكم التكيّفي ينزل المستوى تلقائياً تحت التباطؤ ولا يتذبذب، ثم يقيس بعد الاستقرار */
const { launch, newPage, measure } = require("./lib");
(async () => {
  const b = await launch(); const h = await newPage(b, (process.env.URL || "http://localhost:8765/admin-preview/spatial-os/index.html") + "?tier=high");
  const s = []; for (let i = 0; i < 9; i++) { await h.p.waitForTimeout(5000); s.push(await h.p.evaluate(() => { const x = SceneQuality.state(); return x.level + "@" + x.ema; })); }
  console.log("timeline(5s):", s.join(" "));
  const st = await h.p.evaluate(() => SceneQuality.state()); console.log("changes:", JSON.stringify(st.changes));
  const m = await measure(h, 6000, 500); console.log("settled:", JSON.stringify(m));
  const fx = await h.p.evaluate(() => ({ cnt: FX.count(), root: document.documentElement.dataset.q })); console.log(fx);
  await b.close();
})();
