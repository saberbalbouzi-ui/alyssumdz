/* صفحة الهبوط تحفظ وسوم الحملة فيقرؤها نموذج الإطار (alyssum_utm). NODE_PATH=/opt/node-tools/node_modules node scripts/test-lp-utm.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const ctx = await b.newContext(), p = await ctx.newPage();
  await p.goto("http://localhost:8765/honey-focus/?utm_source=facebook&utm_medium=cpc&utm_campaign=honey-nov&fbclid=ABC123", { waitUntil: "load" }); await p.waitForTimeout(800);
  const u = await p.evaluate(() => JSON.parse(localStorage.getItem("alyssum_utm") || "null"));
  t("وسوم الحملة محفوظة من رابط الإعلان", u && u.s === "facebook" && u.c === "honey-nov" && u.k === "ABC123", u);
  const q = await ctx.newPage(); await q.goto("http://localhost:8765/order-embed.html?p=honey-focus&embed=1", { waitUntil: "load" }); await q.waitForTimeout(800);
  const ex = await q.evaluate(() => typeof Attrib !== "undefined" ? Attrib : null).catch(() => null);
  t("الإطار (نموذج الطلب) يقرؤها: 📣 الحملة = facebook/honey-nov", ex && ex["📣 الحملة"] === "facebook/honey-nov", ex);
  const c2 = await b.newContext(), r = await c2.newPage(); await r.goto("http://localhost:8765/honey-focus/", { waitUntil: "load" }); await r.waitForTimeout(500);
  t("رابط مباشر بلا وسوم: لا شيء محفوظ", (await r.evaluate(() => localStorage.getItem("alyssum_utm"))) === null);
  await b.close(); process.exit(bad ? 1 : 0);
})();
