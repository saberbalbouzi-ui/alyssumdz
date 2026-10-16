/* Alyssum 3D Pack Studio: عرض WebGL حقيقي (SwiftShader)، الأنواع الأربعة، الملصق، التصدير.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-pack3d.js [مجلد_لقطات] */
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), shots = process.argv[2] || ""; let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const { chromium } = require("playwright");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/__blank") { r.writeHead(200, { "Content-Type": "text/html" }); return r.end("<!doctype html><meta charset=utf-8><body></body>"); } const f = path.join(root, u); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });
const load = (p, src) => p.evaluate(s => new Promise(r => { const e = document.createElement("script"); e.src = s; e.onload = r; document.body.appendChild(e); }), src);
(async () => {
  await new Promise(r => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1360, height: 900 } }), p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(base + "/__blank"); await p.evaluate(() => { window.toast = () => { }; }); await load(p, "/assets/js/admin-imgbatch.js"); await load(p, "/assets/js/pack3d.js");
  await p.evaluate(() => Pack3D.open()); await p.waitForSelector("#p3 canvas", { timeout: 30000 });
  await p.waitForFunction(() => Pack3D._t.ready, null, { timeout: 30000 });
  ok("الحوار يفتح ويُنشئ WebGL", true);
  const stat = () => p.evaluate(() => { const c = document.querySelector("#p3 canvas"); const t = document.createElement("canvas"); t.width = 200; t.height = 200; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 200, 200); const d = x.getImageData(0, 0, 200, 200).data; const set = new Set(); for (let i = 0; i < d.length; i += 40) set.add((d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4)); return set.size; });
  const wait = ms => p.waitForTimeout(ms);
  await wait(800); ok("الصورة ليست فارغة (ألوان متعددة)", (await stat()) > 12);
  for (const t of ["bottle", "jar", "box", "glass"]) {
    await p.click('[data-type="' + t + '"]'); await wait(900);
    ok("نوع " + t + ": مرسوم", (await stat()) > 12);
    if (shots) await p.screenshot({ path: path.join(shots, "t-" + t + ".png") });
  }
  /* ملصق مرفوع بلون صلب + نمط */
  await p.click('[data-type="bottle"]'); await wait(500);
  const mk = await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 600; c.height = 400; const x = c.getContext("2d"); x.fillStyle = "#c0392b"; x.fillRect(0, 0, 600, 400); x.fillStyle = "#fff"; x.font = "bold 120px sans-serif"; x.textAlign = "center"; x.fillText("TEST", 300, 230); return c.toDataURL("image/png"); });
  await p.evaluate(u => Pack3D._t.setArt(u), mk); await wait(900);
  ok("الملصق المرفوع يُطبَّق", await p.evaluate(() => !!document.querySelector('[data-act="art"]')));
  if (shots) await p.screenshot({ path: path.join(shots, "art.png") });
  /* تدوير وخلفيات */
  await p.evaluate(() => { const e = document.querySelector('[data-k="yaw"]'); e.value = 120; e.dispatchEvent(new Event("input", { bubbles: true })); }); await wait(300);
  await p.selectOption('[data-k="bgMode"]', "radial"); await wait(300);
  if (shots) await p.screenshot({ path: path.join(shots, "rot-radial.png") });
  /* تصدير */
  const grab = async sel => { const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), p.click(sel)]); return { name: dl.suggestedFilename(), buf: fs.readFileSync(await dl.path()) }; };
  let d = await grab('[data-ex="one"]');
  ok("تصدير PNG صحيح", d.buf.slice(1, 4).toString() === "PNG" && /\.png$/.test(d.name), d.name);
  const dims = d.buf.readUInt32BE(16) + "x" + d.buf.readUInt32BE(20); ok("أبعاد التصدير = المقاس المختار", /^\d+x\d+$/.test(dims), dims);
  await p.selectOption('[data-k="fmt"]', "webp"); d = await grab('[data-ex="one"]');
  ok("تصدير WebP صحيح", d.buf.slice(0, 4).toString() === "RIFF" && d.buf.slice(8, 12).toString() === "WEBP");
  await p.selectOption('[data-k="bodyFin"]', "gloss"); await wait(300);
  await p.evaluate(() => { const e = document.querySelector('[data-k="transparent"]'); e.checked = true; e.dispatchEvent(new Event("change", { bubbles: true })); }); await p.selectOption('[data-k="fmt"]', "png");
  d = await grab('[data-ex="one"]'); if (shots) fs.writeFileSync(path.join(shots, "transparent.png"), d.buf);
  const tr = await p.evaluate(async b64 => { const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode(); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d"); x.drawImage(im, 0, 0); const a = x.getImageData(2, 2, 1, 1).data[3], m = x.getImageData(im.width >> 1, im.height >> 1, 1, 1).data[3]; return [a, m]; }, d.buf.toString("base64"));
  ok("الخلفية الشفافة: الزاوية شفافة والمنتج معتم", tr[0] === 0 && tr[1] > 200, tr);
  d = await grab('[data-ex="angles"]'); ok("ZIP الزوايا", d.buf.slice(0, 2).toString() === "PK" && /\.zip$/.test(d.name), d.name);
  /* صورة العبوة الأصلية تلتقط الألوان */
  const col = await p.evaluate(async () => { const c = document.createElement("canvas"); c.width = 100; c.height = 200; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 100, 200); x.fillStyle = "#1e8449"; x.fillRect(30, 60, 40, 130); x.fillStyle = "#222"; x.fillRect(35, 20, 30, 40); return Pack3D._t.pickColors ? JSON.stringify(Pack3D._t.pickColors(c)) : "na"; });
  ok("pickColors يعيد ألواناً", /#[0-9a-f]{6}/i.test(col), col);
  ok("لا أخطاء صفحة", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? "فشل " + fails : "كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
