/* اختبار زر المفضلة «استيراد منتج» (للمواقع التي تحجب الخادم كـAliExpress): يستخرج المنتج من صفحة مفتوحة في متصفح العميل ويرسله للوحة.
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-pagepilot-bm.js */
const { chromium } = require("playwright");
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } };
const zlib = require("zlib"); const crc = b => { let c, t = [], r = 0xffffffff; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
const ck = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const W = 400, ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(W, 4); ih[8] = 8; ih[9] = 2; const raw = Buffer.alloc((W * 3 + 1) * W, 120);
for (let y = 0; y < W; y++) raw[y * (W * 3 + 1)] = 0;
const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ck("IHDR", ih), ck("IDAT", zlib.deflateSync(raw)), ck("IEND", Buffer.alloc(0))]);
const PAGE = `<!doctype html><html lang="ar"><head><title>AliExpress</title><meta property="og:description" content="مجفف شعر احترافي بقوة عالية">
<script>window.runParams={"data":{"imagePathList":["https://ae01.alicdn.com/kf/Sabc111.jpg_80x80.jpg_.webp","https://ae01.alicdn.com/kf/Sdef222.jpg"],"subject":"x"}}</script></head>
<body><h1>مجفف شعر أيوني 2200W</h1><div class="price--current">US $12.50</div><ul><li>قوة 2200 واط وتقنية أيونية للحماية</li><li>قصير</li></ul>
<img id="a" src="https://cdn.example/big1.jpg" width="600" height="600"><img src="https://cdn.example/logo.png" width="40" height="40"></body></html>`;
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const href = await p.evaluate(() => PBSpec.bookmarklet("http://localhost:8765/admin.html"));
  t("رابط المفضلة javascript: ومرمَّز", /^javascript:\(function/.test(href) && !/\s/.test(href), href.slice(0, 60));
  /* صفحة منتج «خارجية» */
  const q = await ctx.newPage(); await q.route("https://shop.example/**", r => r.fulfill({ contentType: "text/html; charset=utf-8", body: PAGE }));
  await q.route("https://**/*.{jpg,png,webp}", r => r.fulfill({ contentType: "image/png", body: PNG }));
  await q.goto("https://shop.example/item/1"); await q.waitForTimeout(500);
  const sent = await q.evaluate(async h => { let u = ""; window.open = x => { u = x; return {}; }; window.alert = m => { u = "ALERT:" + m; }; (0, eval)(decodeURIComponent(h.slice(11))); return u; }, href);
  t("الزر يفتح اللوحة بحمولة #ppimp", /^http:\/\/localhost:8765\/admin\.html#ppimp=[\w-]+$/.test(sent), sent.slice(0, 100));
  const payload = JSON.parse(Buffer.from(sent.split("#ppimp=")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  t("العنوان والسعر والوصف", payload.title === "مجفف شعر أيوني 2200W" && payload.price === "12.50" && /مجفف شعر/.test(payload.desc), payload);
  t("صور CDN بحجمها الأصلي بلا لاحقة المقاس + صور كبيرة، بلا الشعار", payload.images.includes("https://ae01.alicdn.com/kf/Sabc111.jpg") && payload.images.includes("https://cdn.example/big1.jpg") && !payload.images.some(u => /logo/.test(u)), payload.images);
  t("نقاط المزايا الطويلة فقط", payload.bullets.length === 1, payload.bullets);
  await q.close();
  /* اللوحة تستقبل الحمولة وتملأ الحقول */
  const p2 = await ctx.newPage(); p2.on("pageerror", e => errs.push(String(e)));
  await p2.route("https://**/*.{jpg,png,webp}", r => r.fulfill({ contentType: "image/png", body: PNG }));
  await p2.goto(sent); await p2.waitForTimeout(2500);
  t("بلا تسجيل دخول: يبقى الطلب محفوظاً ولا تفتح الأداة", await p2.evaluate(() => !document.getElementById("pp-bg") && !!sessionStorage.getItem("pp_imp")));
  await p2.evaluate(() => { document.getElementById("login-box").style.display = "none"; });
  await p2.waitForFunction(() => document.getElementById("pp-bg") && document.getElementById("pp-name") && document.getElementById("pp-name").value, null, { timeout: 30000 }).catch(() => { });
  const r = await p2.evaluate(() => ({ dlg: !!document.getElementById("pp-bg"), name: (document.getElementById("pp-name") || {}).value, desc: (document.getElementById("pp-desc") || {}).value, thumbs: document.querySelectorAll("#pp-impres [data-ppi]").length, hash: location.hash }));
  t("افتحت أداة المنشئ بالاسم والوصف والصور", r.dlg && r.name === "مجفف شعر أيوني 2200W" && /مجفف/.test(r.desc) && r.thumbs >= 2, r);
  t("نُظّف الـhash", r.hash === "", r.hash);
  /* حمولة عدائية */
  const s = await p2.evaluate(() => PBSpec.fromPayload({ title: "<img onerror=1>x", images: ["javascript:alert(1)", "http://a/x.jpg", "https://ok/x.jpg"], url: "javascript:1", bullets: "no" }));
  t("تعقيم: لا وسوم ولا روابط غير https", !/[<>]/.test(s.title) && s.images.length === 1 && s.url === "" && s.bullets.length === 0, s);
  t("بلا أخطاء صفحة", errs.length === 0, errs);
  console.log(ok + " ✓ / " + bad + " ✗"); await b.close(); process.exit(bad ? 1 : 0);
})();
