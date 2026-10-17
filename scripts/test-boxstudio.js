/* اختبار «استوديو العلب 3D» (BoxStudio): فتح مباشر ومن قوالب العلب، مكتبة النماذج، طبقات النص والصورة على الوجه، الفتح والإغلاق، الخامة، الخلفية، التراجع، التصدير (صورة/لوحة أوجه/مشروع/قالب القص)، الإغلاق وتحرير الذاكرة.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-boxstudio.js [مجلد_لقطات] */
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
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 900 } }), p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/fonts\.g|ERR_|net::|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(base + "/__blank"); await p.evaluate(() => { localStorage.clear(); });
  for (const f of ["box-profiles", "box-designer", "box-studio"]) await load(p, "/assets/js/" + f + ".js");
  const px = () => p.evaluate(() => { const c = document.querySelector("#bs #gl"), t = document.createElement("canvas"); t.width = 200; t.height = 160; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 200, 160); const d = x.getImageData(0, 0, 200, 160).data, s = new Set(); for (let i = 0; i < d.length; i += 24) s.add((d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4)); return s.size; });
  const grab = async fn => { const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), fn()]); return { name: dl.suggestedFilename(), buf: fs.readFileSync(await dl.path()) }; };
  /* ═══ فتح مباشر ═══ */
  ok("المحرّك three r128 محلي لا CDN", fs.existsSync(path.join(root, "assets/js/vendor/three.r128.min.js")));
  await p.evaluate(() => BoxStudio.open()); await p.waitForSelector("#bs #gl", { timeout: 25000 }); await p.waitForTimeout(1800);
  ok("الاستوديو يفتح: شريط علوي وقضيب أقسام ولوحة ومسرح ثلاثي الأبعاد", await p.evaluate(() => !!document.querySelector("#bs .top .brand") && document.querySelectorAll("#bs .rail .tab").length === 7 && !!document.querySelector("#bs .panel") && BoxStudio.inst.THREE_OK && THREE.REVISION === "128"));
  ok("العلبة البريدية الافتراضية مرسومة", (await px()) > 12);
  if (shots) await p.screenshot({ path: path.join(shots, "bs-open.png") });
  const nm = await p.evaluate(() => Object.keys(BoxStudio.inst.MODELS).length); ok("مكتبة النماذج: 60 نموذجاً أو أكثر (مع قوالب القص الـ23)", nm >= 60, nm);
  /* ═══ تحرير: نص وصورة وتراجع ═══ */
  const nL = () => p.evaluate(() => (BoxStudio.inst.state.faces[BoxStudio.inst.state.sel.face] || { layers: [] }).layers.length);
  const n0 = await nL(); await p.click("#bs #addText"); await p.waitForTimeout(200); ok("إضافة طبقة نص إلى الوجه المحدّد", (await nL()) === n0 + 1);
  await p.click("#bs #addPat"); await p.waitForTimeout(200); ok("إضافة نمط", (await nL()) === n0 + 2);
  await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 400; c.height = 300; const x = c.getContext("2d"); x.fillStyle = "#ff2255"; x.fillRect(0, 0, 400, 300); c.toBlob(b => { window.__f = new File([b], "red.png", { type: "image/png" }); }); }); await p.waitForTimeout(300);
  await p.setInputFiles("#bs #fImg", { name: "red.png", mimeType: "image/png", buffer: await p.evaluate(async () => { const b = await new Promise(r => { const c = document.createElement("canvas"); c.width = 64; c.height = 64; c.getContext("2d").fillStyle = "#e11"; c.getContext("2d").fillRect(0, 0, 64, 64); c.toBlob(r); }); return Array.from(new Uint8Array(await b.arrayBuffer())); }).then(a => Buffer.from(a)) }); await p.waitForTimeout(700);
  ok("رفع صورة يضيف طبقة صورة على الوجه", await p.evaluate(() => { const L = BoxStudio.inst.state.faces[BoxStudio.inst.state.sel.face].layers; return L.some(l => l.type === "image"); }));
  await p.keyboard.press("Control+z"); await p.waitForTimeout(300); ok("التراجع Ctrl+Z يزيل آخر تعديل (الصورة)", await p.evaluate(() => !BoxStudio.inst.state.faces[BoxStudio.inst.state.sel.face].layers.some(l => l.type === "image")));
  /* فتح وإغلاق */
  await p.evaluate(() => { BoxStudio.inst.state.open = 1; BoxStudio.inst.applyOpen(); }); await p.waitForTimeout(250); const openPx = await px(); ok("العلبة المفتوحة تُرسم", openPx > 8, openPx);
  await p.evaluate(() => { BoxStudio.inst.state.open = 0; BoxStudio.inst.applyOpen(); });
  /* نموذج آخر */
  await p.click('#bs .tab[data-tab="models"]'); await p.waitForTimeout(300);
  const cats = await p.evaluate(() => [...document.querySelectorAll("#bs #cats button")].map(b => b.textContent.trim())); ok("فئات النماذج تشمل «قوالب القص»", cats.some(c => /قوالب القص/.test(c)), cats);
  await p.evaluate(() => { const b = [...document.querySelectorAll("#bs #cats button")].find(x => /زجاجات/.test(x.textContent)); b.click(); }); await p.waitForTimeout(200);
  await p.evaluate(() => { const c = [...document.querySelectorAll("#bs #mc .card")].find(x => /نبيذ/.test(x.textContent)); c.click(); }); await p.waitForTimeout(900);
  ok("اختيار «زجاجة نبيذ» يبدّل النموذج ويرسمه", await p.evaluate(() => BoxStudio.inst.state.model === "wine") && (await px()) > 12);
  if (shots) await p.screenshot({ path: path.join(shots, "bs-wine.png") });
  /* الخلفية والتنسيق */
  await p.click('#bs .tab[data-tab="bg"]'); await p.waitForTimeout(200); await p.evaluate(() => document.querySelectorAll("#bs .bgb")[2].click()); await p.waitForTimeout(200);
  ok("تغيير الخلفية الجاهزة", await p.evaluate(() => BoxStudio.inst.state.bg.c1 === "#3a3f3d"));
  await p.click('#bs .tab[data-tab="layout"]'); await p.waitForTimeout(200); await p.evaluate(() => document.querySelectorAll("#bs #lc .card")[3].click()); await p.waitForTimeout(700); ok("تنسيق «ثلاث علب» يرسم ثلاث نسخ", await p.evaluate(() => BoxStudio.inst.state.layout === "trio") && (await px()) > 12);
  /* تصدير صورة / لوحة أوجه / مشروع */
  await p.click("#bs #exportBtn"); await p.waitForTimeout(200); await p.evaluate(() => { document.querySelector("#bs #exRes").value = "1"; });
  let d = await grab(() => p.click("#bs #exGo")); ok("تصدير صورة PNG", d.buf.slice(1, 4).toString() === "PNG" && d.buf.length > 3000, d.name);
  await p.click("#bs #exportBtn"); await p.waitForTimeout(150); await p.evaluate(() => document.querySelector('#bs #exKind [data-v="sheet"]').click());
  d = await grab(() => p.click("#bs #exGo")); ok("تصدير لوحة الأوجه PNG", d.buf.slice(1, 4).toString() === "PNG" && d.buf.length > 2000, d.name);
  await p.click("#bs #exportBtn"); await p.waitForTimeout(150); await p.evaluate(() => document.querySelector('#bs #exKind [data-v="proj"]').click());
  d = await grab(() => p.click("#bs #exGo")); let pj = null; try { pj = JSON.parse(d.buf.toString()); } catch (e) { }
  ok("تصدير مشروع JSON صالح يحمل النموذج والحالة", pj && pj.state && pj.state.model === "wine", d.name);
  ok("زر «قالب القص» لا يظهر لنموذج ليس من القوالب", await p.evaluate(() => { document.querySelector("#bs #exportBtn").click(); const b = document.querySelector('#bs #exKind [data-v="cut"]'); const hid = !b || b.style.display === "none"; document.querySelector("#bs #dExport").close(); return hid; }));
  /* ═══ من قوالب العلب ═══ */
  await p.evaluate(() => BoxStudio.close()); ok("الإغلاق يزيل الواجهة", await p.evaluate(() => !document.getElementById("bs-bg") && !BoxStudio.inst));
  await p.evaluate(() => { BoxProfiles.S.cur = "giftbox"; BoxProfiles.open(); }); await p.waitForTimeout(400);
  ok("نافذة القوالب فيها زر «حوّل إلى استوديو العلب 3D»", await p.evaluate(() => /استوديو العلب 3D/.test(document.querySelector('#bp [data-bx="3d"]').textContent)));
  await p.evaluate(() => document.querySelector('#bp [data-bx="3d"]').click()); await p.waitForSelector("#bs #gl", { timeout: 25000 }); await p.waitForTimeout(3000);
  ok("الزر يفتح الاستوديو على قالب علبة الهدية بأبعادها ويطويها", await p.evaluate(() => { const X = BoxStudio.inst; return X.state.model === "pf_giftbox" && X.state.pf.giftbox && X.state.pf.giftbox.L === 50 && X.state.open === 0 && Object.keys(X.FC).length >= 13; }));
  ok("القالب مطويّ ومرسوم", (await px()) > 5);
  if (shots) await p.screenshot({ path: path.join(shots, "bs-profile-gift.png") });
  ok("نافذة القوالب تبقى مفتوحة خلف الاستوديو", await p.evaluate(() => !!document.getElementById("bp")));
  /* تصميم على وجه من القالب */
  await p.click("#bs #addText"); await p.waitForTimeout(250); ok("طبقة نص على وجه من القالب", (await nL()) >= 1);
  /* أبعاد القالب */
  await p.evaluate(() => { document.querySelector('#bs .acc[data-acc="dims"] > button').click(); }); await p.waitForTimeout(200);
  const f0 = await p.evaluate(() => { const i = document.querySelector("#bs #pfd input"); i.value = "80"; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); return BoxStudio.inst.state.pf.giftbox.L; });
  await p.waitForTimeout(500); ok("تعديل بُعد القالب يعيد بناء العلبة", f0 === 80 && await p.evaluate(() => BoxStudio.inst.state.dims.L >= 79));
  /* تصدير القص من الاستوديو */
  await p.click("#bs #exportBtn"); await p.waitForTimeout(150); await p.evaluate(() => document.querySelector('#bs #exKind [data-v="cut"]').click());
  d = await grab(() => p.click("#bs #exGo")); const sv = d.buf.toString();
  ok("«قالب القص» يصدّر SVG بطبقتي القص والثني من الاستوديو", /<g id="cut"/.test(sv) && /<g id="fold"/.test(sv) && /^dieline-giftbox\.svg$/.test(d.name), d.name);
  await p.click("#bs #exportBtn"); await p.waitForTimeout(150); await p.evaluate(() => { document.querySelector('#bs #exKind [data-v="cut"]').click(); document.querySelector("#bs #exCutFmt").value = "pdf"; });
  d = await grab(() => p.click("#bs #exGo")); ok("«قالب القص» يصدّر PDF", d.buf.slice(0, 5).toString() === "%PDF-", d.name);
  /* مجسّم صلب */
  await p.evaluate(() => { BoxStudio.close(); BoxProfiles.close(); BoxProfiles.S.cur = "heart"; BoxProfiles.open(); }); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#bp [data-bx="3d"]').click()); await p.waitForSelector("#bs #gl", { timeout: 25000 }); await p.waitForTimeout(3000);
  ok("علبة القلب (مجسّم صلب بغطاء) تُفتح في الاستوديو وتُرسم", await p.evaluate(() => BoxStudio.inst.state.model === "pf_heart" && Object.keys(BoxStudio.inst.FC).includes("lidSide")) && (await px()) > 12);
  if (shots) await p.screenshot({ path: path.join(shots, "bs-profile-heart.png") });
  /* Esc يغلق الاستوديو فقط */
  await p.keyboard.press("Escape"); await p.waitForTimeout(300); ok("Esc يغلق الاستوديو ولا يغلق نافذة القوالب", await p.evaluate(() => !document.getElementById("bs-bg") && !!document.getElementById("bp")));
  /* فتح بعد إغلاق (لا تسريب) */
  await p.evaluate(() => BoxStudio.open()); await p.waitForSelector("#bs #gl", { timeout: 25000 }); await p.waitForTimeout(1200); ok("إعادة الفتح تعمل بعد الإغلاق", (await px()) > 12 && await p.evaluate(() => document.querySelectorAll("#bs-bg").length === 1));
  await p.evaluate(() => BoxStudio.close());
  ok("لا أخطاء صفحة", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? "فشل " + fails : "كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
