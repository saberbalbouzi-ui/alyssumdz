/* اختبار «استوديو 3D» الموحّد (Studio3D): شريط التبويبات، الفتح على المحرّر الرئيسي، التبديل للعلب والقوالب وبالعكس، الإغلاق، ملف قالب القص عبر Studio3D.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-studio3d.js */
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
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 920 } }), p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/fonts\.g|ERR_|net::|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(base + "/__blank"); await p.evaluate(() => { localStorage.clear(); window.confirm = () => true; });
  for (const f of ["mockup-studio", "mockup-models", "box-studio", "box-profiles", "box-designer", "studio3d"]) await load(p, "/assets/js/" + f + ".js");
  await p.evaluate(() => Studio3D.open()); await p.waitForSelector("#bs #gl", { timeout: 40000 }); await p.waitForTimeout(1200);
  ok("يفتح مباشرة على المحرّر الرئيسي (نماذج واقعية + ملصقات) مع شريط التبويبات", await p.evaluate(() => Studio3D.tab === "box" && !!document.querySelector("#s3d-bar") && document.querySelector('#s3d-bar [data-t="box"]').classList.contains("on") && Object.keys(BoxStudio.inst.MODELS).filter(k => /^mk_/.test(k)).length === 35));
  ok("لا زر «نماذج واقعية» منفصل ولا استوديو موكاب في الشريط", await p.evaluate(() => !document.querySelector('#s3d-bar [data-t="mock"]') && [...document.querySelectorAll("#s3d-bar [data-t]")].map(b => b.dataset.t).join() === "box,cut,un,re,sh,ex,x"));
  ok("زر «تصدير فائق» في الشريط العلوي (يفتح نافذة التصدير) وزر التصدير الداخلي مخفي وزر الإغلاق الداخلي مخفي (الإغلاق من الشريط) وعنوان «استوديو العلب» مخفي", await p.evaluate(async () => { const ex = document.querySelector("#s3d-bar .ex"); if (!ex || ex.hidden) return false; const inner = document.querySelector("#bs #exportBtn"), cl = document.querySelector("#bs #closeBtn"); if (getComputedStyle(inner).display !== "none" || getComputedStyle(cl).display !== "none" || getComputedStyle(document.querySelector("#bs .top .brand")).display !== "none") return false; ex.click(); await new Promise(r => setTimeout(r, 300)); const o = document.querySelector("#bs #dExport").open; if (o) document.querySelector("#bs #dExport").close(); return o; }));

  ok("المحرّر تحت الشريط", await p.evaluate(() => document.querySelector("#bs-bg").getBoundingClientRect().top >= 46));
  await p.evaluate(() => Studio3D.open({ tab: "mock" })); await p.waitForSelector("#bs #gl", { timeout: 40000 });
  ok("اسم التبويب القديم «mock» يفتح المحرّر الرئيسي", await p.evaluate(() => Studio3D.tab === "box" && !document.querySelector("#mk-bg")));
  await p.click('#s3d-bar [data-t="x"]'); await p.waitForTimeout(300);
  ok("زر إغلاق الشريط يغلق كل شيء", await p.evaluate(() => !document.querySelector("#s3d-bar") && !document.querySelector("#bs-bg")));
  await p.evaluate(() => Studio3D.open({ tab: "box", model: "mk_r_wine" })); await p.waitForSelector("#bs #gl", { timeout: 40000 }); await p.waitForTimeout(1500);
  ok("الفتح على نموذج بعينه (زجاجة نبيذ واقعية)", await p.evaluate(() => BoxStudio.inst.state.model === "mk_r_wine"));
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  ok("Esc في المحرّر يزيل الشريط أيضاً", await p.evaluate(() => !document.querySelector("#s3d-bar") && !document.querySelector("#bs-bg")));
  await p.evaluate(() => BoxDesigner.open()); await p.waitForSelector("#bp", { timeout: 40000 }); await p.waitForTimeout(500);
  ok("Box Designer صار تبويب «قوالب القص» داخل استوديو 3D", await p.evaluate(() => Studio3D.tab === "cut" && !!document.querySelector("#bp-bg") && document.querySelector('#s3d-bar [data-t="cut"]').classList.contains("on") && document.querySelector("#bp-bg").getBoundingClientRect().top >= 46));
  await p.click('#s3d-bar [data-t="box"]'); await p.waitForSelector("#bs", { timeout: 40000 });
  ok("من القوالب إلى العلب: يُغلق القوالب ويفتح العلب", await p.evaluate(() => Studio3D.tab === "box" && !document.querySelector("#bp-bg") && !!document.querySelector("#bs")));
  await p.click('#s3d-bar [data-t="cut"]'); await p.waitForSelector("#bp", { timeout: 40000 }); await p.waitForTimeout(800);
  await p.evaluate(() => BoxProfiles.to3d()); await p.waitForSelector("#bs", { timeout: 40000 }); await p.waitForTimeout(800);
  ok("«حوّل إلى ستوديو 3D» من القوالب ينتقل لتبويب العلب بالقالب", await p.evaluate(() => Studio3D.tab === "box" && !document.querySelector("#bp-bg") && !!document.querySelector("#bs") && !!document.querySelector("#s3d-bar")));
  await p.click('#s3d-bar [data-t="x"]'); await p.waitForTimeout(300);
  ok("بلا أخطاء صفحة", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? "\n" + fails + " فشل" : "\nكل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
