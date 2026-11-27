/* order-embed.html?embed=1 على شبكة بطيئة: لا يظهر أبداً خلفية الموقع السوداء قبل اكتمال النموذج (الإطار شفاف ومخفي حتى يُبنى). NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 430, height: 700 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const cdp = await p.context().newCDPSession(p); await cdp.send("Network.enable"); await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 300, downloadThroughput: 150 * 1024, uploadThroughput: 80 * 1024 });
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|supabase\.co/, r => r.abort());
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/order-embed.html?p=honey-focus&embed=1", { waitUntil: "commit" });
  let darkMax = 0, n = 0;
  for (let i = 0; i < 14; i++) { await p.waitForTimeout(500); const buf = await p.screenshot({ clip: { x: 0, y: 0, width: 430, height: 700 } }).catch(() => null); if (!buf) continue; n++;
    const dark = await p.evaluate(async b64 => { const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode(); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 40 && d[i + 1] < 50 && d[i + 2] < 50) k++; return k / (d.length / 4); }, buf.toString("base64")).catch(() => 0);
    darkMax = Math.max(darkMax, dark); }
  t("لا مساحة سوداء ظاهرة أثناء التحميل البطيء (أقصى نسبة داكنة " + darkMax.toFixed(2) + ")", n > 3 && darkMax < 0.15, { n, darkMax });
  await b.close(); process.exit(bad ? 1 : 0);
})();
