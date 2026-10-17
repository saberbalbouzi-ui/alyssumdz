/* Alyssum Box Designer: هندسة القالب (نقية) + الواجهة + تصدير SVG/PDF/PNG + إرسال إلى 3D Pack Studio وطيّ العلبة.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-boxdesigner.js [مجلد_لقطات] */
const http = require("http"), fs = require("fs"), path = require("path"), cp = require("child_process");
const root = path.join(__dirname, ".."), shots = process.argv[2] || ""; let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const BD = require("../assets/js/box-designer.js");
/* ═══ نقية ═══ */
{ const g = BD.geom({ W: 60, H: 110, D: 35, glue: 12, bleed: 3, tuck: 0 });
  ok("عرض القالب = لسان + 2×(العرض+العمق) + هوامش", Math.abs(g.tw - (12 + 2 * 60 + 2 * 35 + 2 * g.M)) < 1e-9, g.tw);
  ok("ارتفاع القالب = لسانان + 2×العمق + الارتفاع + هوامش", Math.abs(g.th - (2 * g.T + 2 * 35 + 110 + 2 * g.M)) < 1e-9, g.th);
  ok("ستة وجوه بالمقاسات الصحيحة", g.faces.length === 6 && g.faces.find(f => f.id === "front").w === 60 && g.faces.find(f => f.id === "left").w === 35 && g.faces.find(f => f.id === "top").h === 35 && g.faces.find(f => f.id === "back").h === 110);
  ok("الوجوه متجاورة بلا فجوات أو تداخل (الخلفي-الأيسر-الأمامي-الأيمن)", (() => { const f = id => g.faces.find(x => x.id === id); return Math.abs(f("back").x + f("back").w - f("left").x) < 1e-9 && Math.abs(f("left").x + f("left").w - f("front").x) < 1e-9 && Math.abs(f("front").x + f("front").w - f("right").x) < 1e-9 && Math.abs(f("top").y + f("top").h - f("front").y) < 1e-9 && Math.abs(f("front").y + f("front").h - f("bottom").y) < 1e-9; })());
  ok("ثماني خطوط ثني وأربع ألسنة دفتر غبار ولسانا إدخال", g.creases.length === 8 && g.flaps.filter(f => /^dust/.test(f.id)).length === 4 && g.flaps.filter(f => /^tuck/.test(f.id)).length === 2);
  ok("كل نقاط القص داخل حدود القالب", g.cut.every(p => p[0] >= -1e-9 && p[1] >= -1e-9 && p[0] <= g.tw - 2 * g.M + 1e-9 && p[1] <= g.th - 2 * g.M + 1e-9));
  ok("لسان الإدخال التلقائي بين 12 و28 مم", g.T >= 12 && g.T <= 28);
  const g2 = BD.geom({ W: 45, H: 125, D: 45, glue: 10, bleed: 0, tuck: 20 }); ok("لسان إدخال مخصص وبلا نزف", g2.T === 20 && g2.B === 0 && g2.M === 5); }
/* ═══ علبة هدية (Gift Box) نقية ═══ */
{ const g = BD.geom({ style: "gift", W: 60, H: 110, D: 35, glue: 12, bleed: 3, tuck: 0, thumb: 0 }), f = id => g.faces.find(x => x.id === id);
  ok("هدية: عرض القالب = 2×الارتفاع + العرض", Math.abs(g.tw - (2 * 110 + 60 + 2 * g.M)) < 1e-9, g.tw);
  ok("هدية: ارتفاع القالب = لسان + 2×العمق + 2×الارتفاع", Math.abs(g.th - (g.T + 2 * 35 + 2 * 110 + 2 * g.M)) < 1e-9, g.th);
  ok("هدية: ستة وجوه وأبعاد الصور قبل الدوران صحيحة", g.faces.length === 6 && f("front").lw === 60 && f("front").lh === 110 && f("left").lw === 35 && f("left").lh === 110 && f("top").lw === 60 && f("top").lh === 35);
  ok("هدية: الجانبان مدوَّران 90° والأمامي 180° والخلفي بلا دوران", f("left").rot === 90 && f("right").rot === 270 && f("front").rot === 180 && f("back").rot === 0);
  ok("هدية: الوجوه متجاورة (الخلفي فوق الأرضية والأمامي تحتها والجانبان على جانبيها)", Math.abs(f("back").y + f("back").h - f("bottom").y) < 1e-9 && Math.abs(f("bottom").y + f("bottom").h - f("front").y) < 1e-9 && Math.abs(f("right").x + f("right").w - f("bottom").x) < 1e-9 && Math.abs(f("bottom").x + f("bottom").w - f("left").x) < 1e-9);
  ok("هدية: أربعة أجنحة لصق وستة خطوط ثني", g.glues.length === 4 && g.creases.length === 6);
  ok("هدية: كل نقاط القص داخل حدود القالب", g.cut.every(p => p[0] >= -1e-9 && p[1] >= -1e-9 && p[0] <= g.tw - 2 * g.M + 1e-9 && p[1] <= g.th - 2 * g.M + 1e-9));
  ok("هدية: فتحة الإبهام تلقائية وتقع داخل عرض الأمامي", g.dia > 8 && g.dia <= 28 + 1e-9);
  const ys = g.cut.filter(p => Math.abs(p[1] - (g.th - 2 * g.M)) > 1e-6 && p[1] > g.th - 2 * g.M - g.dia / 2 - 1e-6 && p[0] > 110 && p[0] < 170).length; ok("هدية: نقاط قوس الفتحة داخل القص", ys >= 10, ys);
  ok("هدية: قطر الفتحة المخصص", BD.geom({ style: "gift", W: 60, H: 110, D: 35, glue: 12, bleed: 3, thumb: 20 }).dia === 20); }
/* ═══ الواجهة ═══ */
const { chromium } = require("playwright");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/__blank") { r.writeHead(200, { "Content-Type": "text/html" }); return r.end("<!doctype html><meta charset=utf-8><body></body>"); } const f = path.join(root, u); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });
const load = (p, src) => p.evaluate(s => new Promise(r => { const e = document.createElement("script"); e.src = s; e.onload = r; document.body.appendChild(e); }), src);
(async () => {
  await new Promise(r => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 900 } }), p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(base + "/__blank"); await p.evaluate(() => { window.toast = () => { }; localStorage.clear(); });
  for (const f of ["admin-imgbatch", "barcode-tool", "pack3d", "box-designer"]) await load(p, "/assets/js/" + f + ".js");
  await p.evaluate(() => BoxDesigner.openArt()); await p.waitForSelector("#bx-st canvas");
  ok("الحوار يفتح ويعرض القالب", await p.evaluate(() => { const c = document.querySelector("#bx-st canvas"); return c.width > 400 && /مم/.test(document.getElementById("bx-info").textContent); }));
  if (shots) await p.screenshot({ path: path.join(shots, "bx-1.png") });
  /* تعديل الأبعاد يغيّر القالب */
  const before = await p.evaluate(() => document.querySelector("#bx-st canvas").width);
  await p.fill('[data-k="W"]', "80"); await p.waitForTimeout(300);
  ok("تغيير العرض يوسّع القالب ويحوّل النوع إلى مخصص", await p.evaluate(b => document.querySelector("#bx-st canvas").width !== b || document.getElementById("bx-info").textContent.includes("80"), before) && await p.evaluate(() => BoxDesigner.S.W === 80 && BoxDesigner.S.type === "custom"));
  await p.click('[data-pre="rect"]'); await p.waitForTimeout(250);
  ok("الإعداد المسبق يعيد الأبعاد", await p.evaluate(() => BoxDesigner.S.W === 60 && BoxDesigner.S.H === 110));
  /* اختيار وجه بالنقر وتعديله */
  await p.click('[data-face="back"]'); await p.fill('[data-fk="text"]', "Ingredients: honey, aloe vera.\nUsage: apply daily."); await p.waitForTimeout(300);
  ok("تعديل نص الوجه الخلفي وحده", await p.evaluate(() => BoxDesigner.S.faces.back.text.startsWith("Ingredients") && BoxDesigner.S.faces.front.text === ""));
  await p.click('[data-face="front"]'); await p.waitForTimeout(150);
  /* ألوان وهوية */
  await p.evaluate(() => { const e = document.querySelector('[data-id="name"]'); e.value = "LUXE BOTANICA"; e.dispatchEvent(new Event("input", { bubbles: true })); const s = document.querySelector('[data-id="pattern"]'); s.value = "flowers"; s.dispatchEvent(new Event("change", { bubbles: true })); });
  await p.waitForTimeout(300); if (shots) await p.screenshot({ path: path.join(shots, "bx-2.png") });
  /* وجه بلا شعار: لا يظهر الشعار ثم نرفع شعاراً اصطناعياً */
  await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 200; c.height = 200; const x = c.getContext("2d"); x.fillStyle = "#c6fe17"; x.beginPath(); x.arc(100, 100, 90, 0, 7); x.fill(); x.fillStyle = "#173f35"; x.font = "bold 90px sans-serif"; x.textAlign = "center"; x.fillText("L", 100, 130); BoxDesigner._t.setLogo(c); BoxDesigner._t.preview(); });
  await p.waitForTimeout(200);
  /* التصدير */
  const grab = async sel => { const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 90000 }), p.click(sel)]); return { name: dl.suggestedFilename(), buf: fs.readFileSync(await dl.path()) }; };
  let d = await grab('[data-ex="svg"]'); const svg = d.buf.toString("utf8"), out = path.join(shots || "/tmp", "bx-test");
  ok("SVG بأبعاد حقيقية بالمليمتر ومنسَّق", /^<\?xml/.test(svg) && /width="[\d.]+mm" height="[\d.]+mm"/.test(svg) && /viewBox="0 0 [\d.]+ [\d.]+"/.test(svg), svg.slice(0, 300));
  ok("SVG: طبقات القص والثني واللصق والصور منفصلة", ['id="cut-line"', 'id="crease-line"', 'id="glue-area"', 'id="artwork-faces"', 'id="face-front"', 'id="face-back"'].every(t => svg.includes(t)));
  ok("SVG: ست صور وجوه مضمّنة PNG", (svg.match(/data:image\/png;base64,/g) || []).length === 6);
  const dom = await p.evaluate(t => { const d = new DOMParser().parseFromString(t, "image/svg+xml"); return { err: !!d.querySelector("parsererror"), imgs: d.querySelectorAll("image").length }; }, svg);
  ok("SVG صالح XML", !dom.err && dom.imgs === 6, dom);
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, "box.svg"), svg);
  d = await grab('[data-ex="pdf"]'); fs.writeFileSync(path.join(out, "box.pdf"), d.buf);
  ok("PDF يبدأ وينتهي بشكل صحيح", d.buf.slice(0, 5).toString() === "%PDF-" && d.buf.slice(-6).toString().includes("%%EOF"), d.name);
  let info = ""; try { info = cp.execSync("pdfinfo " + path.join(out, "box.pdf"), { encoding: "utf8" }); } catch (e) { info = "ERR " + e.message; }
  const gg = BD.geom(); const mm = (gg.tw - 2 * gg.M + 2 * gg.M); const pg = /Page size:\s+([\d.]+) x ([\d.]+) pts/.exec(info);
  ok("pdfinfo: صفحة واحدة بالأبعاد الحقيقية (مم → نقطة)", /Pages:\s+1/.test(info) && pg && Math.abs(pg[1] / 72 * 25.4 - gg.tw) < 0.6 && Math.abs(pg[2] / 72 * 25.4 - gg.th) < 0.6, info.slice(0, 300));
  try { cp.execSync("pdftoppm -r 60 -png " + path.join(out, "box.pdf") + " " + path.join(out, "pdf")); ok("pdftoppm يرسم الـPDF", fs.existsSync(path.join(out, "pdf-1.png"))); } catch (e) { ok("pdftoppm يرسم الـPDF", false, e.message); }
  d = await grab('[data-ex="img"]'); ok("PNG صحيح", d.buf.slice(1, 4).toString() === "PNG");
  await p.selectOption('[data-k="fmt"]', "webp"); d = await grab('[data-ex="img"]'); ok("WebP صحيح", d.buf.slice(0, 4).toString() === "RIFF" && d.buf.slice(8, 12).toString() === "WEBP");
  /* إلى 3D */
  await p.click('[data-act="to3d"]'); await p.waitForSelector("#p3 canvas", { timeout: 30000 }); await p.waitForFunction(() => Pack3D._t.ready, null, { timeout: 30000 }); await p.waitForTimeout(900);
  const stat = () => p.evaluate(() => { const c = document.querySelector("#p3 canvas"), t = document.createElement("canvas"); t.width = 200; t.height = 200; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 200, 200); const d = x.getImageData(0, 0, 200, 200).data, s = new Set(); for (let i = 0; i < d.length; i += 40) s.add((d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4)); return s.size; });
  ok("3D: العلبة المطوية مرسومة وفيها لوحة طي", (await stat()) > 12 && await p.evaluate(() => !!document.querySelector('#p3 [data-k="fold"]') && Pack3D.S.type === "dbox"));
  if (shots) await p.screenshot({ path: path.join(shots, "bx-3d-closed.png") });
  for (const [t, n] of [[0, "flat"], [0.55, "mid"], [0.85, "late"]]) { await p.evaluate(v => Pack3D._t.applyFold(v), t); await p.waitForTimeout(250); ok("3D: الطي عند " + t + " يرسم", (await stat()) > 8); if (shots) await p.screenshot({ path: path.join(shots, "bx-3d-" + n + ".png") }); }
  await p.evaluate(() => Pack3D._t.applyFold(1)); await p.waitForTimeout(200);
  await p.evaluate(() => { const e = document.querySelector('#p3 [data-k="yaw"]'); e.value = 200; e.dispatchEvent(new Event("input", { bubbles: true })); }); await p.waitForTimeout(250); if (shots) await p.screenshot({ path: path.join(shots, "bx-3d-back.png") });
  d = await grab('#p3 [data-ex="one"]'); ok("3D: تصدير صورة للعلبة المطوية", d.buf.slice(1, 4).toString() === "PNG");
  await p.click('#p3 [data-act="backbd"]'); await p.waitForTimeout(300);
  ok("العودة إلى Box Designer تُبقيه مفتوحاً ونوع 3D يُستعاد", await p.evaluate(() => !!document.getElementById("bx-bg") && !document.getElementById("p3-bg") && Pack3D.S.type !== "dbox"));
  /* ═══ علبة هدية: واجهة + تصدير + طيّ 3D ═══ */
  await p.evaluate(() => { BoxDesigner.S.style = "gift"; BoxDesigner.close(); BoxDesigner.openArt("gift"); }); await p.waitForTimeout(500);
  ok("هدية: حقل قطر فتحة الإبهام ظاهر وزر النوع مفعّل", await p.evaluate(() => !!document.querySelector('[data-k="thumb"]') && document.querySelector('[data-style="gift"]').className === "on"));
  const gg2 = await p.evaluate(() => BoxDesigner.geom());
  d = await grab('[data-ex="svg"]'); const gsvg = d.buf.toString();
  ok("هدية SVG: طبقات القص والثني واللصق (4 أجنحة) والوجوه المدوَّرة", /id="cut-line"/.test(gsvg) && /id="crease-line"/.test(gsvg) && (gsvg.match(/<path d="[^"]*" fill="url\(#glue-hatch\)"/g) || []).length === 4 && (gsvg.match(/transform="rotate\(/g) || []).length >= 5 && /giftbox-/.test(d.name), d.name);
  d = await grab('[data-ex="pdf"]'); fs.writeFileSync(path.join(out, "gift.pdf"), d.buf); let gi = ""; try { gi = cp.execSync("pdfinfo " + path.join(out, "gift.pdf"), { encoding: "utf8" }); } catch (e) { gi = "ERR"; }
  const gp = gi.match(/Page size:\s+([\d.]+) x ([\d.]+)/); ok("هدية PDF: صفحة واحدة بالأبعاد الحقيقية", /Pages:\s+1/.test(gi) && gp && Math.abs(gp[1] / 72 * 25.4 - gg2.tw) < 0.6 && Math.abs(gp[2] / 72 * 25.4 - gg2.th) < 0.6, gi.slice(0, 200));
  try { cp.execSync("pdftoppm -r 40 -png " + path.join(out, "gift.pdf") + " " + path.join(out, "gift")); ok("هدية: pdftoppm يرسم الـPDF", true); } catch (e) { ok("هدية: pdftoppm يرسم الـPDF", false, e.message); }
  if (shots) await p.screenshot({ path: path.join(shots, "bx-gift-net.png") });
  await p.click('[data-act="to3d"]'); await p.waitForSelector("#p3 canvas", { timeout: 30000 }); await p.waitForFunction(() => Pack3D._t.ready, null, { timeout: 30000 }); await p.waitForTimeout(900);
  ok("هدية 3D: العلبة المطوية مرسومة", (await stat()) > 12 && await p.evaluate(() => Pack3D.S.type === "dbox"));
  if (shots) await p.screenshot({ path: path.join(shots, "bx-gift-closed.png") });
  await p.evaluate(() => { Pack3D.S.yaw = 0; Pack3D._t.view(); });
  for (const [t, n] of [[0, "flat"], [0.5, "mid"], [0.9, "late"]]) { await p.evaluate(v => Pack3D._t.applyFold(v), t); await p.waitForTimeout(250); ok("هدية 3D: الطي عند " + t + " يرسم", (await stat()) > 8); if (shots) await p.screenshot({ path: path.join(shots, "bx-gift-" + n + ".png") }); }
  await p.click('#p3 [data-act="backbd"]'); await p.waitForTimeout(300);
  ok("لا أخطاء صفحة", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? "فشل " + fails : "كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
