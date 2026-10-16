/* اختبار مكتبة قوالب العلب الجاهزة (BoxProfiles): هندسة 23 نموذجاً تطابق صفحة المصدر بالأرقام، وتصدير SVG/PDF/DXF/PNG، وواجهة حقيقية.
     NODE_PATH=/opt/node-tools/node_modules node scripts/test-boxprofiles.js */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os"), { execSync } = require("child_process");
let total = 0, fails = 0; const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } else console.log("✓", n); };
/* قيم مرجعية محسوبة من صفحة المصدر الأصلية بالقيم الافتراضية: [عرض الرسم، ارتفاعه، عدد خطوط القص، عدد خطوط الثني، عدد النقاط] */
const GOLD = {"giftbox":[150,234.5,12,10,117],"cardbox":[195,189,18,10,169],"matchbox":[172,118,12,8,54],"boxlid":[578,250,16,8,72],"shallowbox":[190,254.5,16,8,113],"nestable":[296.337,253.337,8,8,44],"mailer":[174,271.8,6,5,49],"envelope":[312.5,216.25,4,4,23],"milkcarton":[390,265.17,10,17,110],"cuboid":[145,280,14,7,56],"pyramid":[301.639,301.639,12,4,40],"polypyr":[245.997,139.297,10,7,53],"cone":[146.495,284.631,2,0,67],"polygon":[208.785,207.962,20,14,106],"polygonlid":[229.941,231.317,22,16,120],"round":[279.301,220.075,48,42,302],"ellipse":[249.153,210.042,48,42,302],"egg":[405.883,234.48,68,62,442],"heart":[352.996,212.082,60,54,386],"rhombus":[399.663,227.282,16,10,78],"coffin":[459.169,180.287,20,14,106],"cakeslice":[424.327,200.799,20,14,106],"bag":[275,195,7,8,38]};
(async () => {
  const BP = require("../assets/js/box-profiles.js"), keys = Object.keys(BP.MODELS);
  ok("23 نموذجاً في 3 مجموعات", keys.length === 23 && Object.keys(BP.groups()).length === 3, keys.length);
  const bad = []; keys.forEach(k => { const r = BP.build(k), g = GOLD[k]; const pts = [...r.g.cut, ...r.g.fold].reduce((a, l) => a + l.length, 0); if (!g || Math.abs(r.dw - g[0]) > .002 || Math.abs(r.dh - g[1]) > .002 || r.g.cut.length !== g[2] || r.g.fold.length !== g[3] || pts !== g[4]) bad.push([k, r.dw, r.dh, r.g.cut.length, r.g.fold.length, pts, g]); });
  ok("هندسة كل النماذج (الأبعاد وعدد خطوط القص والثني والنقاط) تطابق صفحة المصدر", bad.length === 0, bad.slice(0, 3));
  ok("كل الإحداثيات أعداد منتهية", keys.every(k => { const r = BP.build(k); return [...r.g.cut, ...r.g.fold].every(l => l.every(p => isFinite(p[0]) && isFinite(p[1]))); }));
  ok("كل الأسماء والأوصاف وعناوين الحقول بالعربية بلا فرنسية", keys.every(k => { const m = BP.MODELS[k]; return /[؀-ۿ]/.test(m.name) && /[؀-ۿ]/.test(m.desc) && m.params.every(p => /[؀-ۿABC]/.test(p[1])) && !/[éèêàç]/i.test(m.name + m.desc + m.params.map(p => p[1]).join()); }));
  const big = BP.build("giftbox", { L: 100, W: 80, H: 120 }), small = BP.build("giftbox");
  ok("تغيير الأبعاد يكبّر القالب", big.dw > small.dw && big.dh > small.dh);
  const lo = BP.build("giftbox", { L: 1, W: 1, H: 1 }); ok("الحدود الدنيا تُطبَّق (لا قالب منهار)", lo.dw > 0 && lo.p.L === 15 && lo.p.H === 10);
  const a4 = BP.build("envelope", {}, { page: "210x297", orient: "p", margin: 10 }), a4l = BP.build("envelope", {}, { page: "210x297", orient: "l", margin: 10 });
  ok("مقاس الصفحة والاتجاه يعملان ويُنبَّه إن تجاوز الرسم الصفحة", a4.pw === 210 && a4.ph === 297 && a4l.pw === 297 && a4l.ph === 210 && a4.fit === false && BP.build("envelope", { W: 60, H: 40 }, { page: "210x297", margin: 10 }).fit === true, [a4.fit]);
  const sv = BP.svg("cuboid", {}, { page: "fit", margin: 5, perf: true, perfLen: 4 }).text;
  ok("SVG: طبقتا fold وcut بالمليمتر والطي المنقّط", /<g id="fold"[^>]*stroke-dasharray="4 2"/.test(sv) && /<g id="cut"/.test(sv) && /width="[0-9.]+mm"/.test(sv) && /viewBox="0 0 /.test(sv));
  const dx = BP.dxf("cuboid"); ok("DXF: خطوط LINE على طبقتي CUT وFOLD", /\nLINE\n8\nCUT\n/.test(dx) && /\nLINE\n8\nFOLD\n/.test(dx) && /EOF\n$/.test(dx));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bp-")), pf = path.join(tmp, "a.pdf"); fs.writeFileSync(pf, Buffer.from(await BP.pdf("giftbox", {}, { page: "210x297", orient: "p", margin: 10 }).arrayBuffer()));
  let info = ""; try { info = execSync("pdfinfo " + pf).toString(); } catch (e) { info = "ERR " + e.message; }
  ok("PDF: صفحة واحدة بأبعاد A4 الحقيقية (210×297مم)", /Pages:\s+1/.test(info) && /Page size:\s+595\.\d+ x 841\.\d+/.test(info), info);
  try { execSync("pdftoppm -r 40 -png " + pf + " " + path.join(tmp, "pg")); const pg = fs.readdirSync(tmp).find(f => /^pg.*png$/.test(f)); ok("PDF: يُرسم ويحوي خطوطاً ملوّنة", !!pg && fs.statSync(path.join(tmp, pg)).size > 800); } catch (e) { ok("PDF يُرسم", false, e.message); }
  /* ── واجهة حقيقية ── */
  const b = await chromium.launch(), ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } }), p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.setContent("<!doctype html><html><body></body></html>"); await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "../assets/js/box-profiles.js"), "utf8") });
  await p.evaluate(() => BoxProfiles.open());
  const ui = await p.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); const R = {}; R.dlg = !!document.getElementById("bp"); R.opts = document.querySelectorAll("#bp-model option").length; R.grp = document.querySelectorAll("#bp-model optgroup").length; R.svg = !!document.querySelector("#bp-out svg"); R.paths = document.querySelectorAll("#bp-out svg path").length;
    const sel = document.getElementById("bp-model"); sel.value = "heart"; sel.dispatchEvent(new Event("change", { bubbles: true })); await w(100); R.heartDesc = document.getElementById("bp-desc").textContent; R.heartPaths = document.querySelectorAll("#bp-out svg path").length; R.fields = document.querySelectorAll("#bp-fields input").length;
    const f = document.getElementById("bpf_L"); const i0 = document.getElementById("bp-info").textContent; f.value = "200"; f.dispatchEvent(new Event("input", { bubbles: true })); await w(100); R.infoChanged = i0 !== document.getElementById("bp-info").textContent;
    const u = document.querySelector('input[name="bp-u"][value="cm"]'); u.checked = true; u.dispatchEvent(new Event("change", { bubbles: true })); await w(60); R.cm = document.getElementById("bpf_L").value;
    const pg = document.getElementById("bp-page"); pg.value = "210x297"; pg.dispatchEvent(new Event("change", { bubbles: true })); await w(60); R.warn = /يتجاوز الصفحة/.test(document.getElementById("bp-info").innerHTML); return R; });
  ok("الواجهة: نافذة بمجموعاتها الثلاث و23 خياراً ومعاينة SVG", ui.dlg && ui.opts === 23 && ui.grp === 3 && ui.svg && ui.paths > 5, ui);
  ok("الواجهة: تبديل النموذج يغيّر الوصف والرسم وحقوله", /قلب/.test(ui.heartDesc) && ui.heartPaths > 20 && ui.fields >= 4, ui);
  ok("الواجهة: تعديل حقل يحدّث المعاينة، والوحدة سم تقسم على 10، وتنبيه تجاوز الصفحة", ui.infoChanged && ui.cm === "20" && ui.warn, ui);
  const dls = {}; for (const k of ["svg", "pdf", "dxf", "png"]) { const [d] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }), p.click('[data-bx="' + k + '"]')]); const fp = path.join(tmp, "d." + k); await d.saveAs(fp); dls[k] = [d.suggestedFilename(), fs.statSync(fp).size]; }
  ok("التصدير الفعلي من الواجهة: أربع صيغ بأسماء مناسبة وأحجام غير فارغة", /\.svg$/.test(dls.svg[0]) && /\.pdf$/.test(dls.pdf[0]) && /\.dxf$/.test(dls.dxf[0]) && /\.png$/.test(dls.png[0]) && dls.svg[1] > 500 && dls.pdf[1] > 500 && dls.dxf[1] > 500 && dls.png[1] > 2000, dls);
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(150);
  const mob = await p.evaluate(() => { const d = document.getElementById("bp").getBoundingClientRect(); return { w: d.width <= innerWidth, ov: document.documentElement.scrollWidth <= innerWidth + 1 }; });
  ok("الجوال: النافذة داخل الشاشة بلا تمرير أفقي", mob.w && mob.ov, mob);
  ok("لا أخطاء جافاسكربت", errs.length === 0, errs);
  await b.close(); console.log(fails ? "\n✗ " + fails + " من " + total + " فشل" : "\n✓ " + total + " فحصاً ناجحاً"); process.exit(fails ? 1 : 0);
})();
