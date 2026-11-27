/* order-embed.html?embed=1 لا يعرض الصفحة الكاملة (النموذج الأسود القديم/الطويل) أثناء التحميل: مخفي حتى يُبنى النموذج الجديد. NODE_PATH=/opt/node-tools/node_modules node scripts/test-embed-flash.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 430, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  await p.addInitScript(() => { window.__samples = []; const tick = () => { try { const d = document.documentElement, bd = document.body, w = document.getElementById("pb-embed-wrap"); window.__samples.push({ inputs: document.querySelectorAll('#order-form input,#order-form select,.order-wide input').length, pre: d.classList.contains("pb-embed-pre"), op: bd ? getComputedStyle(bd).opacity : "nb", wrap: !!w, t: Math.round(performance.now()) }); } catch (e) { } }; setInterval(tick, 25); });
  await p.goto("http://localhost:8765/order-embed.html?p=honey-focus&embed=1", { waitUntil: "load" }); await p.waitForTimeout(2500);
  const S = await p.evaluate(() => window.__samples), fin = S[S.length - 1];
  const visibleBeforeWrap = S.filter(x => !x.wrap && x.op !== "0" && x.op !== "nb").length;
  t("لا لقطة مرئية قبل بناء النموذج الجديد (opacity 0 ما دام لا wrap)", visibleBeforeWrap === 0, S.filter(x => !x.wrap && x.op !== "0").slice(0, 3));
  t("بعد البناء يُكشف الإطار (بلا pb-embed-pre وopacity 1)", fin.wrap && !fin.pre && fin.op === "1", fin);
  const bgc = await p.evaluate(() => [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.body).backgroundColor]);
  t("خلفية الإطار شفافة دائماً (لا مستطيل أسود)", bgc.every(c => c === "rgba(0, 0, 0, 0)" || c === "transparent"), bgc);
  const firstShown = S.find(x => !x.pre && x.op === "1");
  t("لا يُكشف الإطار قبل ظهور حقول النموذج", !firstShown || firstShown.inputs >= 3, firstShown);
  const nonEmbed = await (async () => { const q = await b.newPage({ viewport: { width: 430, height: 900 } }); await q.goto("http://localhost:8765/order-embed.html?p=honey-focus", { waitUntil: "load" }); await q.waitForTimeout(800); const r = await q.evaluate(() => ({ pre: document.documentElement.classList.contains("pb-embed-pre"), op: getComputedStyle(document.body).opacity })); await q.close(); return r; })();
  t("بدون embed=1 لا يُخفى شيء", !nonEmbed.pre && nonEmbed.op === "1", nonEmbed);
  await b.close(); process.exit(bad ? 1 : 0);
})();
