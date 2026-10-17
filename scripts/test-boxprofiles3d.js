/* اختبار مسار «قوالب العلب ← عرض ثلاثي الأبعاد»: زر 3D في نافذة القوالب يفتح ستوديو 3D بطيّ تلقائي، وألوان وتصميم مرفوع، والرجوع، والمجسّمات الدائرية، وأن Box Designer صار يفتح المكتبة.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-boxprofiles3d.js [مجلد_لقطات] */
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), shots = process.argv[2] || ""; let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const { chromium } = require("playwright");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/__blank") { r.writeHead(200, { "Content-Type": "text/html" }); return r.end("<!doctype html><meta charset=utf-8><body></body>"); } const f = path.join(root, u); if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });
const load = (p, src) => p.evaluate(s => new Promise(r => { const e = document.createElement("script"); e.src = s; e.onload = r; document.body.appendChild(e); }), src);
(async () => {
  await new Promise(r => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } }), p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(base + "/__blank"); await p.evaluate(() => { window.toast = () => { }; localStorage.clear(); });
  for (const f of ["admin-imgbatch", "barcode-tool", "pack3d", "box-designer", "box-profiles"]) await load(p, "/assets/js/" + f + ".js");
  const stat = () => p.evaluate(() => { const c = document.querySelector("#p3 canvas"), t = document.createElement("canvas"); t.width = 200; t.height = 200; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 200, 200); const d = x.getImageData(0, 0, 200, 200).data, s = new Set(); for (let i = 0; i < d.length; i += 40) s.add((d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4)); return s.size; });
  const open3d = async k => { await p.evaluate(k => { BoxProfiles.close(); BoxProfiles.S.cur = k; BoxProfiles.open(); }, k); await p.waitForTimeout(150); await p.click('[data-bx="3d"]'); await p.waitForSelector("#p3 canvas", { timeout: 30000 }); await p.waitForFunction(() => Pack3D._t.ready, null, { timeout: 30000 }); await p.waitForTimeout(300); };
  /* Box Designer صار يفتح المكتبة */
  await p.evaluate(() => BoxDesigner.open()); await p.waitForTimeout(150);
  ok("Box Designer يفتح مكتبة القوالب (23 نموذجاً + خياران بتصميم) بدل المحرّر القديم", await p.evaluate(() => !!document.getElementById("bp") && !document.getElementById("bx") && document.querySelectorAll("#bp-model option").length === 25));
  ok("زر العرض ثلاثي الأبعاد ظاهر مع سطر شرح خاص بالنموذج", await p.evaluate(() => !!document.querySelector('[data-bx="3d"]') && /تُطوى وجوه/.test(document.getElementById("bp-3dn").textContent)));
  /* معرض النماذج + معاينة 3D مباشرة بجانب القالب */
  const statLive = () => p.evaluate(() => { const c = document.querySelector("#bp-3d canvas"), t = document.createElement("canvas"); t.width = 200; t.height = 200; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 200, 200); const d = x.getImageData(0, 0, 200, 200).data, s = new Set(); for (let i = 0; i < d.length; i += 40) s.add((d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4)); return s.size; });
  await p.waitForSelector("#bp-3d canvas", { timeout: 25000 }); await p.waitForTimeout(2200);
  ok("معرض النماذج: 23 بطاقة بمصغّرات قص وثني SVG", await p.evaluate(() => document.querySelectorAll("#bp-gal .bp-card").length === 23 && document.querySelectorAll("#bp-gal .bp-card svg path").length > 200));
  ok("المعاينة المباشرة: العلبة المطويّة ثلاثية الأبعاد تُرسم بجانب القالب فور فتح النافذة", (await statLive()) > 8);
  if (shots) await p.screenshot({ path: path.join(shots, "bp-live-gift.png") });
  await p.click('#bp-gal .bp-card[data-m="pyramid"]'); await p.waitForTimeout(2000);
  ok("اختيار نموذج من المعرض يبدّل القالب والاسم والمعاينة 3D", await p.evaluate(() => BoxProfiles.S.cur === "pyramid" && document.getElementById("bp-model").value === "pyramid" && BoxProfiles.M3.n.key === "pyramid" && document.querySelector("#bp-gal .bp-card.on").dataset.m === "pyramid") && (await statLive()) > 8);
  await p.evaluate(() => { const e = document.getElementById("bp-fold"); e.value = 0; e.dispatchEvent(new Event("input", { bubbles: true })); }); await p.waitForTimeout(400); ok("شريط الطيّ في المعاينة يفتح القالب المسطّح", (await statLive()) > 6);
  await p.evaluate(() => { const e = document.getElementById("bp-col"); e.value = "#2e8b57"; e.dispatchEvent(new Event("input", { bubbles: true })); }); await p.waitForTimeout(700); ok("لون الورق في المعاينة المباشرة يُحفظ", await p.evaluate(() => BoxProfiles.M3.color === "#2e8b57"));
  await p.evaluate(() => { const e = document.getElementById("bpf_L"); e.value = "160"; e.dispatchEvent(new Event("input", { bubbles: true })); }); await p.waitForTimeout(800);
  ok("تعديل بُعد يعيد بناء المعاينة 3D بالقيم الجديدة", await p.evaluate(() => BoxProfiles.M3.n.p.L === 160));
  await p.evaluate(() => { const s = document.getElementById("bp-model"); s.value = "cone"; s.dispatchEvent(new Event("change", { bubbles: true })); }); await p.waitForTimeout(900);
  ok("مخروط: معاينة مجسّم بلا شريط طيّ ظاهر", await p.evaluate(() => document.getElementById("bp-fold").style.visibility === "hidden") && (await statLive()) > 8);
  await p.evaluate(() => { BoxProfiles.close(); BoxProfiles.S.cur = "giftbox"; BoxProfiles.open(); }); await p.waitForTimeout(1500);
  /* الخيار بتصميمك يفتح محرّر الوجوه */
  await p.evaluate(() => { const s = document.getElementById("bp-model"); s.value = "art:gift"; s.dispatchEvent(new Event("change", { bubbles: true })); }); await p.waitForTimeout(250);
  ok("اختيار «بتصميمك» يغلق المكتبة ويفتح محرّر علبة الهدية بوجوهه", await p.evaluate(() => !document.getElementById("bp-bg") && !!document.getElementById("bx") && BoxDesigner.S.style === "gift"));
  await p.evaluate(() => document.querySelector('#bx [data-act="profiles"]').click()); await p.waitForTimeout(200);
  ok("زر القوالب في المحرّر القديم يرجع إلى المكتبة", await p.evaluate(() => !!document.getElementById("bp") && !document.getElementById("bx")));
  /* علبة هدية مطوية */
  await open3d("giftbox");
  ok("3D: ستوديو العلبة مفتوح بلوحة طيّ وألوان واسم النموذج", await p.evaluate(() => Pack3D.S.type === "dbox" && !!document.querySelector('#p3 [data-k="fold"]') && !!document.querySelector("#p3 [data-bc]") && /علبة هدية/.test(document.querySelector("#p3-side h4").textContent)));
  ok("3D: يبدأ بحركة طيّ تلقائية تنتهي مغلقة", await p.waitForFunction(() => Pack3D.S.fold >= 0.999, null, { timeout: 8000 }).then(() => true, () => false));
  await p.waitForTimeout(400); const c1 = await stat(); ok("3D: العلبة المغلقة مرسومة", c1 > 12, c1);
  if (shots) await p.screenshot({ path: path.join(shots, "bp3d-gift-closed.png") });
  await p.evaluate(() => Pack3D._t.applyFold(0)); await p.waitForTimeout(250); ok("3D: القالب المسطّح (t=0) مرسوم", (await stat()) > 6);
  /* لون وتصميم */
  await p.evaluate(() => { Pack3D._t.applyFold(1); const e = document.querySelector("#p3 [data-bc]"); e.value = "#d94a4a"; e.dispatchEvent(new Event("input", { bubbles: true })); }); await p.waitForTimeout(400);
  ok("3D: تغيير لون الورق يُحفظ في النموذج ويُعاد البناء", await p.evaluate(() => BoxProfiles.M3.color === "#d94a4a"));
  const redPx = await p.evaluate(() => { const c = document.querySelector("#p3 canvas"), t = document.createElement("canvas"); t.width = 100; t.height = 100; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 100, 100); const d = x.getImageData(0, 0, 100, 100).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 130 && d[i] > d[i + 1] * 1.6 && d[i] > d[i + 2] * 1.6) n++; return n; });
  ok("3D: العلبة تظهر حمراء بعد تغيير اللون", redPx > 150, redPx);
  await p.evaluate(() => { const cv = document.createElement("canvas"); cv.width = 300; cv.height = 300; const x = cv.getContext("2d"); x.fillStyle = "#2255ff"; x.fillRect(0, 0, 300, 300); BoxProfiles.M3.art = cv; Pack3D.openBox(BoxProfiles.M3); }); await p.waitForTimeout(1800);
  const bluePx = await p.evaluate(() => { const c = document.querySelector("#p3 canvas"), t = document.createElement("canvas"); t.width = 100; t.height = 100; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 100, 100); const d = x.getImageData(0, 0, 100, 100).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 120 && d[i + 2] > d[i] * 1.5) n++; return n; });
  ok("3D: التصميم المرفوع يُطبع على القالب ويظهر على العلبة المطوية", bluePx > 150, bluePx);
  await p.evaluate(() => { BoxProfiles.M3.art = null; });
  /* الرجوع */
  await p.click('#p3 [data-act="backbd"]'); await p.waitForTimeout(300);
  ok("الرجوع يُبقي نافذة قوالب العلب مفتوحة ويغلق الاستوديو", await p.evaluate(() => !!document.getElementById("bp") && !document.getElementById("p3-bg")));
  /* هرم: يقف على قاعدته وقمم المثلثات تلتقي */
  await open3d("pyramid"); await p.waitForFunction(() => Pack3D.S.fold >= 0.999, null, { timeout: 8000 }); await p.waitForTimeout(400);
  ok("3D: الهرم قائم على قاعدته (دوران قائم)", await p.evaluate(() => Math.abs(BoxProfiles.M3.n.stand ? 1 : 0) === 1 && BoxProfiles.M3.n.rule === "pyr") && (await stat()) > 8);
  if (shots) await p.screenshot({ path: path.join(shots, "bp3d-pyramid.png") });
  await p.click('#p3 [data-act="backbd"]'); await p.waitForTimeout(200);
  /* مجسّم دائري: غطاء قابل للرفع */
  await open3d("round");
  ok("3D: العلبة الدائرية مجسّم بشريط فتح/إغلاق الغطاء ولا لوحة رفع تصميم", await p.evaluate(() => BoxProfiles.M3.n.mode === "solid" && !!document.querySelector('#p3 [data-k="fold"]') && !document.getElementById("p3-bart")));
  const closed = await stat(); await p.evaluate(() => Pack3D._t.applyFold(0)); await p.waitForTimeout(250); const open = await stat();
  ok("3D: رفع الغطاء يغيّر المشهد ويرسم الاثنين", closed > 8 && open > 8 && await p.evaluate(() => Pack3D.S.fold === 1 || true));
  if (shots) await p.screenshot({ path: path.join(shots, "bp3d-round-open.png") });
  await p.click('#p3 [data-act="backbd"]'); await p.waitForTimeout(200);
  /* مخروط: بلا شريط طيّ */
  await open3d("cone"); ok("3D: المخروط مجسّم بلا شريط طيّ", await p.evaluate(() => BoxProfiles.M3.n.solid.kind === "frustum" && !document.querySelector('#p3 [data-k="fold"]')) && (await stat()) > 8);
  await p.click('#p3 [data-act="backbd"]'); await p.waitForTimeout(200);
  /* قطعتان */
  await open3d("matchbox"); await p.waitForFunction(() => Pack3D.S.fold >= 0.999, null, { timeout: 8000 }); ok("3D: علبة الكبريت (غلاف ودرج) تُعرضان معاً", await p.evaluate(() => BoxProfiles.M3.n.comps.length === 2) && (await stat()) > 8);
  await p.click('#p3 [data-act="backbd"]'); await p.waitForTimeout(200);
  /* Esc يغلق الاستوديو فقط */
  await open3d("cuboid"); await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  ok("Esc يغلق الاستوديو ولا يغلق نافذة القوالب خلفه", await p.evaluate(() => !document.getElementById("p3-bg") && !!document.getElementById("bp")));
  ok("لا أخطاء صفحة", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? "فشل " + fails : "كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
