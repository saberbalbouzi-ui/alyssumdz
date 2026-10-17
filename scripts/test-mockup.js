/* اختبار «استوديو الموكاب 3D» (MockupStudio): المعرض والمصغّرات والفئات والبحث، بناء كل النماذج وعرضها بلا أخطاء، الألوان، مناطق الطباعة (سريع/صورة)، فتح الغطاء، التصدير (PNG/شفاف/ZIP)، الإغلاق.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-mockup.js [مجلد_لقطات] */
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), shots = process.argv[2] || ""; let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const { chromium } = require("playwright");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".webp": "image/webp" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/__blank") { r.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); return r.end("<!doctype html><meta charset=utf-8><body></body>"); } const f = path.join(root, decodeURIComponent(u)); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
const load = (p, src) => p.evaluate(s => new Promise(r => { const e = document.createElement("script"); e.src = s; e.onload = r; document.body.appendChild(e); }), src);
(async () => {
  await new Promise(r => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 920 } }), p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/fonts\.g|ERR_|net::|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(base + "/__blank"); await p.evaluate(() => { localStorage.clear(); });
  await load(p, "/assets/js/admin-imgbatch.js").catch(() => { }); await load(p, "/assets/js/mockup-studio.js");
  ok("المحرّك three المحلي موجود (لا CDN)", fs.existsSync(path.join(root, "assets/js/vendor/three.module.min.js")));
  const info = await p.evaluate(() => ({ n: MockupStudio.MODELS.length, cats: [...new Set(MockupStudio.MODELS.map(m => m.cat))], ids: MockupStudio.MODELS.map(m => m.id) }));
  ok("مكتبة النماذج: 24 نموذجاً أو أكثر في خمس فئات", info.n >= 24 && info.cats.length >= 5, info);
  ok("لكل نموذج: ألوان ومناطق طباعة وبناء", await p.evaluate(() => MockupStudio.MODELS.every(m => m.colors.length >= 3 && m.areas.length >= 1 && typeof m.build === "function" && m.areas.every(a => a.id && a.n && a.ar > 0))));
  /* ═══ المعرض ═══ */
  await p.evaluate(() => MockupStudio.open()); await p.waitForSelector("#mk .mk-card", { timeout: 30000 });
  ok("المعرض: بطاقة لكل نموذج وفئات وبحث", await p.evaluate(() => document.querySelectorAll("#mk .mk-card").length === MockupStudio.MODELS.length && document.querySelectorAll("#mk #mk-cats [data-cat]").length === 6 && !!document.querySelector("#mk #mk-q")));
  await p.waitForFunction(() => document.querySelectorAll("#mk .mk-th img").length >= 6, null, { timeout: 120000 });
  ok("المصغّرات تُولَّد تدريجياً من العرض الثلاثي الأبعاد الحقيقي", await p.evaluate(() => [...document.querySelectorAll("#mk .mk-th img")].every(i => /^data:image\/(webp|png)/.test(i.src))));
  if (shots) await p.screenshot({ path: path.join(shots, "mk-gallery.png") });
  await p.click('#mk #mk-cats [data-cat="apparel"]'); await p.waitForTimeout(200);
  ok("فئة «ملابس»: قمصان وهودي وقبعة وحقيبة فقط", await p.evaluate(() => { const ids = [...document.querySelectorAll("#mk .mk-card")].map(c => c.dataset.m); return ids.includes("tee") && ids.includes("hoodie") && ids.includes("cap") && ids.includes("tote") && !ids.includes("pouch"); }));
  await p.evaluate(() => { const q = document.querySelector("#mk-q"); q.value = "hoodie"; q.dispatchEvent(new Event("input")); }); await p.waitForFunction(() => document.querySelectorAll("#mk .mk-card").length === 1, null, { timeout: 30000 }).catch(() => { });
  ok("البحث بالاسم يصفّي المعرض", (await p.evaluate(() => document.querySelectorAll("#mk .mk-card").length)) === 1, await p.evaluate(() => [document.querySelector("#mk-q").value, [...document.querySelectorAll("#mk .mk-card")].map(c => c.dataset.m)]));
  await p.evaluate(() => { const q = document.querySelector("#mk-q"); q.value = ""; q.dispatchEvent(new Event("input")); }); await p.click('#mk #mk-cats [data-cat="all"]'); await p.waitForTimeout(300);
  /* ═══ كل النماذج تُبنى وتُعرض ═══ */
  const rend = await p.evaluate(() => { const S = MockupStudio, out = {}; for (const m of S.MODELS) { try { const st = S._t.newState(m); S._t.loadModel(m, st, { q: "lo" }); const c = S._t.renderTo(160, 160, true), d = c.getContext("2d").getImageData(0, 0, 160, 160).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; out[m.id] = n; } catch (e) { out[m.id] = "ERR " + e.message; } } return out; });
  const bad = Object.entries(rend).filter(([k, v]) => !(v > 700)); ok("كل النماذج تُبنى وتُرسم (بكسلات المنتج فوق الحدّ الأدنى)", bad.length === 0, bad);
  /* ═══ المحرّر ═══ */
  await p.click('#mk .mk-card[data-m="tee"]'); await p.waitForSelector("#mk .mk-side", { timeout: 20000 }); await p.waitForTimeout(1200);
  ok("المحرّر: لوحة جانبية بالألوان والتصميم والتصدير ومسرح 3D بقماش WebGL", await p.evaluate(() => !!document.querySelector("#mk #mk-st canvas") && document.querySelectorAll("#mk [data-c]").length >= 5 && !!document.querySelector("#mk [data-q=name]") && !!document.querySelector("#mk [data-ex=one]")));
  const cnt = (fn) => p.evaluate(fn);
  const redPx = () => p.evaluate(() => { const c = MockupStudio._t.renderTo(300, 300, true), d = c.getContext("2d").getImageData(0, 0, 300, 300).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] > 170 && d[i + 1] < 90 && d[i + 2] < 90) n++; return n; });
  await p.evaluate(() => { const S = MockupStudio._t, st = S.CUR.s.a.front; st.q.c1 = "#ff0000"; st.q.ink = "#ff0000"; st.q.name = "RED"; S.refreshArea("front"); }); await p.waitForTimeout(150);
  const r0 = await redPx(); ok("طباعة التصميم السريع تظهر فعلاً على قماش القميص (بكسلات حمراء)", r0 > 40, r0);
  await p.evaluate(() => { const S = MockupStudio._t; S.CUR.s.a.front.src = "none"; S.refreshArea("front"); }); await p.waitForTimeout(150);
  ok("إزالة التصميم تزيل الطباعة", (await redPx()) < r0 / 4);
  /* رفع صورة */
  await p.click('#mk [data-src="img"]'); await p.waitForSelector("#mk #mk-img", { state: "attached" });
  const png = await p.evaluate(async () => { const c = document.createElement("canvas"); c.width = 200; c.height = 200; const x = c.getContext("2d"); x.fillStyle = "#ff0000"; x.fillRect(0, 0, 200, 200); return (await new Promise(r => c.toBlob(r))).arrayBuffer().then(b => Array.from(new Uint8Array(b))); });
  await p.setInputFiles("#mk #mk-img", { name: "red.png", mimeType: "image/png", buffer: Buffer.from(png) }); await p.waitForTimeout(700);
  ok("رفع صورة يطبّقها على منطقة الطباعة", await p.evaluate(() => MockupStudio._t.CUR.s.a.front.src === "img" && !!MockupStudio._t.CUR.s.a.front.img));
  ok("الصورة المرفوعة تظهر على القميص", (await redPx()) > 400);
  await p.evaluate(() => { const st = MockupStudio._t.CUR.s.a.front; st.sc = 0.2; MockupStudio._t.refreshArea("front"); }); await p.waitForTimeout(150);
  const rSmall = await redPx(); await p.evaluate(() => { const st = MockupStudio._t.CUR.s.a.front; st.sc = 0.8; MockupStudio._t.refreshArea("front"); }); await p.waitForTimeout(150);
  ok("حجم الصورة قابل للتحكّم (أكبر ← بكسلات أكثر)", (await redPx()) > rSmall * 1.5, rSmall);
  /* لون */
  const cssC = await p.evaluate(() => { const S = MockupStudio._t; const before = S.CUR.s.color; document.querySelector('#mk [data-c="#2a62b8"]').click(); return before; });
  await p.waitForTimeout(700); ok("تغيير لون القميص يُعيد البناء بلون جديد", await p.evaluate(b => MockupStudio._t.CUR.s.color === "#2a62b8" && b !== "#2a62b8", cssC));
  ok("اللون الأزرق يظهر في الصورة المرسومة", await p.evaluate(() => { const c = MockupStudio._t.renderTo(300, 300, true), d = c.getContext("2d").getImageData(0, 0, 300, 300).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i + 2] > d[i] + 40 && d[i + 2] > 90) n++; return n > 3000; }));
  if (shots) await p.screenshot({ path: path.join(shots, "mk-editor-tee.png") });
  /* منطقة الظهر ونسخ التصميم */
  await p.click('#mk [data-act="copyall"]'); await p.waitForTimeout(300);
  ok("نسخ التصميم إلى كل المناطق", await p.evaluate(() => { const a = MockupStudio._t.CUR.s.a; return a.back.src === a.front.src && !!a.back.img; }));
  /* ═══ نموذج بغطاء: فتح وإغلاق ═══ */
  await p.click('#mk [data-act="back"]'); await p.waitForSelector("#mk .mk-card", { timeout: 10000 }); await p.click('#mk .mk-card[data-m="mailer"]'); await p.waitForSelector("#mk [data-k=open]", { timeout: 20000 }); await p.waitForTimeout(900);
  const openPx = () => p.evaluate(() => { const S = MockupStudio._t; const c = S.renderTo(240, 240, true), d = c.getContext("2d").getImageData(0, 0, 240, 240).data; let top = 1e9; for (let y = 0; y < 240; y++) { for (let x = 0; x < 240; x++) if (d[(y * 240 + x) * 4 + 3] > 40) { top = y; break; } if (top < 1e9) break; } return top; });
  const t1 = await openPx(); await p.evaluate(() => { const e = document.querySelector("#mk [data-k=open]"); e.value = 0; e.dispatchEvent(new Event("input")); }); await p.waitForTimeout(200); const t0 = await openPx();
  ok("منزلق فتح الغطاء يغيّر هيئة الصندوق (الغطاء المفتوح أعلى من المغلق)", t1 < t0 - 8, [t1, t0]);
  /* ═══ التصدير ═══ */
  const grab = async fn => { const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), fn()]); return { name: dl.suggestedFilename(), buf: fs.readFileSync(await dl.path()) }; };
  let d1 = await grab(() => p.click('#mk [data-ex="one"]')); ok("تصدير PNG بمقاس 1080×1080 وترويسة صحيحة", /\.png$/.test(d1.name) && d1.buf.readUInt32BE(16) === 1080 && d1.buf.readUInt32BE(20) === 1080, [d1.name, d1.buf.readUInt32BE(16)]);
  await p.evaluate(() => { const e = document.querySelector('#mk [data-k=transparent]'); e.checked = true; e.dispatchEvent(new Event("change")); });
  d1 = await grab(() => p.click('#mk [data-ex="one"]')); const tr = await p.evaluate(async b => { const im = await createImageBitmap(new Blob([new Uint8Array(b)], { type: "image/png" })); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d"); x.drawImage(im, 0, 0); return x.getImageData(4, 4, 1, 1).data[3]; }, Array.from(d1.buf)); ok("الخلفية الشفافة: زاوية الصورة المصدَّرة شفافة", tr === 0, tr);
  if (await p.evaluate(() => typeof AdminImgBatch !== "undefined" && !!AdminImgBatch.zip)) { const z = await grab(() => p.click('#mk [data-ex="angles"]')); ok("4 زوايا في ملف ZIP", /\.zip$/.test(z.name) && z.buf.length > 4000 && z.buf.slice(0, 2).toString() === "PK", z.name); } else console.log("• ZIP: AdminImgBatch غير محمّل في الاختبار (تخطّي)");
  /* الإغلاق */
  await p.keyboard.press("Escape"); await p.waitForTimeout(250); ok("Esc من المحرّر يعود للمعرض", await p.evaluate(() => !!document.querySelector("#mk .mk-grid") && !document.querySelector("#mk .mk-side")));
  await p.keyboard.press("Escape"); await p.waitForTimeout(250); ok("Esc من المعرض يغلق الاستوديو ويحرّر الموارد", await p.evaluate(() => !document.getElementById("mk-bg") && MockupStudio._t.R === null));
  ok("لا أخطاء في الصفحة", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? "✗ فشل " + fails : "✓ نجح الكل"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("ERR", e); process.exit(1); });
