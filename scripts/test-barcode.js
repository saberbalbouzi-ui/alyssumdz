/* مولّد الباركود و QR: المحرّكات النقية + الواجهة والتنزيل (PNG/WebP/SVG/ZIP) في متصفح حقيقي.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-barcode.js
   للتحقق بفاكّ ترميز مستقل (zxing) شغّل: python3 scripts/verify-barcode.py (اختياري، يحتاج zxing-cpp) */
const http = require("http"), fs = require("fs"), path = require("path"); const B = require("../assets/js/barcode-tool.js");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const throws = f => { try { f(); return false; } catch (e) { return e.message; } };
/* ═══ نقية ═══ */
ok("EAN-13: رقم التحقق الكلاسيكي 5901234123457", B.linear("ean13", "590123412345").text === "5901234123457");
ok("EAN-13: 95 وحدة وحارسا البداية والنهاية", (() => { const r = B.linear("ean13", "5901234123457"); return r.bits.length === 95 && r.bits.startsWith("101") && r.bits.endsWith("101") && r.bits.slice(45, 50) === "01010"; })());
ok("EAN-13: رقم تحقق خاطئ يُرفض برسالة", /رقم التحقق/.test(throws(() => B.linear("ean13", "5901234123458")) || ""));
ok("EAN-8 و UPC-A: التحقق والطول", B.linear("ean8", "1234567").text === "12345670" && B.linear("upca", "03600029145").text === "036000291452" && B.linear("ean8", "1234567").bits.length === 67 && B.linear("upca", "03600029145").bits.length === 95);
ok("Code 128: A ← بداية B + 'A' + تحقق 34 + نهاية", (() => { const r = B.linear("code128", "A"); return r.bits.startsWith("11010010000") && r.bits.length === 11 * 3 + 13 && r.bits.endsWith("1100011101011"); })());
ok("Code 128: أرقام زوجية ≥4 تُرمَّز بالمجموعة C (أقصر)", B.linear("code128", "123456").bits.length < B.linear("code128", "12345a").bits.length);
ok("Code 128: يرفض الحروف العربية برسالة", /لاتينية/.test(throws(() => B.linear("code128", "عسل")) || ""));
ok("Code 39: يضيف * ويرفض الحروف الصغيرة غير المسموحة", B.linear("code39", "abc-1").text === "ABC-1" && /Code 39/.test(throws(() => B.linear("code39", "a@b")) || ""));
const q1 = B.qr("A", "M"), q2 = B.qr("x".repeat(120), "M");
ok("QR: الإصدار 1 = 21×21 والإصدار الأكبر يتبع القاعدة 17+4v", q1.size === 21 && q1.version === 1 && q2.size === 17 + 4 * q2.version);
ok("QR: نمط الكشف في الزوايا الثلاث", [[0, 0], [q1.size - 7, 0], [0, q1.size - 7]].every(([x, y]) => { const m = q1.modules; for (let d = 0; d < 7; d++) for (let e = 0; e < 7; e++) { const edge = d === 0 || d === 6 || e === 0 || e === 6, core = d >= 2 && d <= 4 && e >= 2 && e <= 4; if (m[y + d][x + e] !== (edge || core)) return false; } return true; }));
ok("QR: خطا التوقيت وبت الوحدة الداكنة الثابتة", (() => { const m = q2.modules, n = q2.size; for (let i = 8; i < n - 8; i++) if (m[6][i] !== (i % 2 === 0) || m[i][6] !== (i % 2 === 0)) return false; return m[n - 8][8] === true; })());
ok("QR: نسختا معلومات التنسيق متطابقتان", (() => { const m = q2.modules, n = q2.size, a = [], b = []; for (let i = 0; i <= 5; i++) a.push(m[i][8]); a.push(m[7][8], m[8][8], m[8][7]); for (let i = 9; i < 15; i++) a.push(m[8][14 - i]); for (let i = 0; i < 8; i++) b.push(m[8][n - 1 - i]); for (let i = 8; i < 15; i++) b.push(m[n - 15 + i][8]); return a.join() === b.join(); })());
ok("QR: يقبل العربية (UTF-8) ويقيس السعة", B.qr("مرحباً بكم", "Q").bytes === Buffer.byteLength("مرحباً بكم") && /أطول/.test(throws(() => B.qr("x".repeat(3000), "L")) || ""));
ok("QR: مستوى أعلى = إصدار أكبر أو يساوي", B.qr("x".repeat(100), "H").version >= B.qr("x".repeat(100), "L").version);
ok("قوالب المحتوى: واتساب/Wi-Fi/هاتف", B.content("wa", { p: "+213 550 00 00 00", t: "مرحبا" }) === "https://wa.me/213550000000?text=" + encodeURIComponent("مرحبا") && B.content("wifi", { p: "Home", k: "pa;ss" }) === "WIFI:T:WPA;S:Home;P:pa\\;ss;;" && B.content("tel", { p: "0550 00 00 00" }) === "tel:0550000000");
ok("SVG: يحوي مستطيلات وأبعاد الخطة", (() => { const s = B.svg({ type: "qr", text: "hello", scale: 4, fg: "#123456", bg: "#fff" }), L = B.layout({ type: "qr", text: "hello", scale: 4 }); return /<svg/.test(s) && /#123456/.test(s) && s.includes('width="' + L.w + '"'); })());
/* ═══ الواجهة ═══ */
const { chromium } = require("playwright");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/__blank") { r.writeHead(200, { "Content-Type": "text/html" }); return r.end("<!doctype html><meta charset=utf-8><body></body>"); } const f = path.join(root, u); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });
const load = (p, src) => p.evaluate(s => new Promise(r => { const e = document.createElement("script"); e.src = s; e.onload = r; document.body.appendChild(e); }), src);
(async () => {
  await new Promise(r => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch(), ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 900 } }), p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(base + "/__blank"); await p.evaluate(() => { window.toast = () => { }; }); await load(p, "/assets/js/barcode-tool.js"); await load(p, "/assets/js/admin-imgbatch.js");
  await p.evaluate(() => BarcodeTool.open()); await p.waitForSelector("#bc");
  ok("الحوار يفتح بنوع QR ومعاينة فارغة بإرشاد", await p.evaluate(() => document.getElementById("bc-t").value === "qr" && /اكتب المحتوى/.test(document.getElementById("bc-pv").textContent)));
  await p.fill("#bc-x", "https://alyssumdz.com"); await p.waitForSelector("#bc-pv canvas");
  ok("معاينة QR + معلومات الإصدار", await p.evaluate(() => { const c = document.querySelector("#bc-pv canvas"); return c.width > 100 && /QR إصدار/.test(document.getElementById("bc-info").textContent); }));
  ok("اللوحة المرسومة تحوي بكسلات داكنة وفاتحة (QR حقيقي)", await p.evaluate(() => { const c = document.querySelector("#bc-pv canvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let dk = 0, lt = 0; for (let i = 0; i < d.length; i += 4) { if (d[i] < 60) dk++; else if (d[i] > 200) lt++; } return dk > 500 && lt > 500; }));
  const grab = async () => { const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#bc-dl")]); const f = await dl.path(); return { name: dl.suggestedFilename(), buf: fs.readFileSync(f) }; };
  let d = await grab(); ok("تنزيل PNG: توقيع PNG واسم الملف", d.buf.slice(1, 4).toString() === "PNG" && /\.png$/.test(d.name), d.name);
  await p.selectOption("#bc-f", "webp"); d = await grab(); ok("تنزيل WebP: توقيع RIFF/WEBP", d.buf.slice(0, 4).toString() === "RIFF" && d.buf.slice(8, 12).toString() === "WEBP" && /\.webp$/.test(d.name), d.name);
  await p.selectOption("#bc-f", "svg"); d = await grab(); ok("تنزيل SVG", /<svg/.test(d.buf.toString()) && /\.svg$/.test(d.name));
  await p.selectOption("#bc-f", "png"); await p.check("#bc-cl");
  d = await grab(); ok("PNG بخلفية شفافة: قناة ألفا", d.buf.readUInt8(25) === 6, d.buf.readUInt8(25));
  await p.selectOption("#bc-t", "ean13"); await p.waitForSelector("#bc-h"); await p.fill("#bc-x", "5901234123457");
  await p.waitForTimeout(200); ok("EAN-13: معاينة بعرض 95 وحدة + هامش", await p.evaluate(() => { const c = document.querySelector("#bc-pv canvas"); return !!c && c.width === (95 + 20) * 8; }));
  await p.fill("#bc-x", "5901234123458"); await p.waitForTimeout(200); ok("EAN-13 بتحقق خاطئ: رسالة خطأ ولا معاينة", await p.evaluate(() => /رقم التحقق/.test(document.getElementById("bc-err").textContent) && !document.querySelector("#bc-pv canvas")));
  await p.selectOption("#bc-t", "code128"); await p.fill("#bc-x", "ORDER-1\nORDER-2\nORDER-3"); await p.waitForTimeout(200);
  ok("عدة أسطر: تنبيه ZIP", await p.evaluate(() => /3 رمزاً/.test(document.getElementById("bc-info").textContent)));
  await p.selectOption("#bc-f", "png"); d = await grab(); ok("عدة أسطر ← ZIP بثلاثة ملفات PNG", d.buf.slice(0, 2).toString() === "PK" && /\.zip$/.test(d.name) && (d.buf.toString("latin1").match(/ORDER-\d-\d\.png/g) || []).length >= 3, d.name);
  await p.selectOption("#bc-t", "qr"); await p.selectOption("#bc-tpl", "wifi"); await p.fill("#bc-p", "MyWifi"); await p.fill("#bc-k", "secret1"); await p.waitForTimeout(200);
  ok("قالب Wi-Fi يعمل ويبني معاينة", await p.evaluate(() => !!document.querySelector("#bc-pv canvas")));
  ok("لا أخطاء JS", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? "FAILED " + fails : "ALL OK"); process.exit(fails ? 1 : 0);
})();
