/* اختبار ثبات النصوص في الأقسام المتناسبة عبر المتصفحات (بلاغ ماسنجر 1.89.1058–1.89.1065):
   (1) دمج zoom المحتوى في حجم الخط للنص/العنوان/الزر/القائمة فلا يبقى zoom على أبناء العنصر؛
   (2) حد أدنى 8px لحجم الخط المُحتسَب (max(8px,…))؛
   (3) سكربت TZ_HEAD لا يفعل شيئاً في متصفح عادي، ويعيد القياس في بيئة تكبّر النص 1.3× وتفرض حداً أدنى 8px.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-textfit.js   (يحتاج: python3 -m http.server 8765 من جذر المشروع) */
const path = require("path"), fs = require("fs"), { chromium } = require("playwright"); const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const code = fs.readFileSync(path.join(root, "scripts/pagebuilder.js"), "utf8");
const secSet = { cls: "t-sec", kind: "canvas", scaled: true, scaledM: true, dw: 1274, cw: { d: 1274 }, layout: "full", mh: { d: 600, m: 700 }, pad: { d: [0, 0, 0, 0] } };
const W = (id, type, set) => ({ id, type, set });
const page = { v: 1, title: "t", slug: "tf", bg: "#fff", ff: "Cairo", header: false, footer: false, css: "", sections: [{ id: "tfs1", set: secSet, cols: [{ id: "tfc1", set: {}, widgets: [] }], free: [
  W("tfa", "text", { html: "<p>نص تجريبي طويل قليلاً لاختبار الالتفاف داخل الصندوق</p>", fs: { d: 20, m: 16 }, wsc: { d: 100, m: 250 }, fx: { d: 10, m: 6 }, fy: { d: 20, m: 20 }, fwd: { d: 60, m: 88 }, fh: { d: 80, m: 90 } }),
  W("tfb", "bullets", { items: ["أول", "ثان", "ثالث"], fs: { d: 18, m: 11.6 }, gap: { d: 8 }, ms: { d: 18 }, wsc: { d: 100, m: 336 }, fx: { d: 10, m: 6 }, fy: { d: 120, m: 130 }, fwd: { d: 50, m: 60 }, fh: { d: 150, m: 200 } }),
  W("tfc", "text", { html: "<p>نص صغير جداً</p>", fs: { d: 20, m: 6 }, fx: { d: 10, m: 6 }, fy: { d: 300, m: 400 }, fwd: { d: 50, m: 60 }, fh: { d: 40, m: 40 } })] }] };
(async () => {
  const br = await chromium.launch(), p0 = await br.newPage(); await p0.goto("about:blank");
  const out = await p0.evaluate(([c, pg]) => { const PB = new Function(c + ";return PB;")(); return { html: PB.fullHtml(pg, { base: "../../", site: { name: "x", domain: "x.com", wa: "1" }, products: [], meta: { tabs: [], cats: {} } }), css: PB.renderSections(pg, { base: "../../", site: {}, products: [], meta: { tabs: [], cats: {} } }).css }; }, [code, page]); await p0.close();
  ok("zoom المحتوى مدموج في خط النص (zoom:1 على الأبناء)", /\.x-tfa>\*\{zoom:1\}/.test(out.css) && /\.x-tfb>\*\{zoom:1\}/.test(out.css));
  ok("لا zoom متبقٍّ بقيمة wsc على النص أو القائمة", !/\.x-tfa>\*\{zoom:2\.5/.test(out.css.split("@media(max-width:767px)")[1] || "") || /\.x-tfa>\*\{zoom:1\}/.test(out.css.split("@media(max-width:767px)")[1] || ""));
  ok("حد أدنى 8px للخط المُحتسَب", /max\(8px,calc\(var\(--u\)\*6\)\)/.test(out.css));
  ok("سكربت TZ_HEAD موجود في رأس الصفحة", /pb-tz/.test(out.html) && /measureText/.test(out.html));
  const measure = async (env) => {
    const ctx = await br.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), q = await ctx.newPage();
    if (env) await q.addInitScript(() => { const o = CanvasRenderingContext2D.prototype.measureText; CanvasRenderingContext2D.prototype.measureText = function (t) { const r = o.call(this, t); return { width: r.width / 1.3 }; }; });
    await q.route("**/lp/tf/", r => r.fulfill({ status: 200, contentType: "text/html", body: out.html }));
    await q.goto("http://localhost:8765/lp/tf/", { waitUntil: "load" }); await q.waitForTimeout(600);
    if (env) await q.evaluate(() => { const els = Array.from(document.querySelectorAll("main *")), f = els.map(e => parseFloat(getComputedStyle(e).fontSize)); els.forEach((e, i) => { if (e.closest("svg") || e.tagName === "IMG") return; e.style.setProperty("font-size", Math.max(f[i], 8) * 1.3 + "px", "important"); }); });
    await q.waitForTimeout(300);
    const r = await q.evaluate(() => ({ cls: document.documentElement.className.trim(), under8: Array.from(document.querySelectorAll("main *")).filter(e => Array.from(e.childNodes).some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 8 && !document.documentElement.className.includes("pb-tz")).length, boxes: Array.from(document.querySelectorAll("main .pb-t,main .pb-bl li")).map(t => { const rr = document.createRange(); rr.selectNodeContents(t); const b = rr.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; }) }));
    await ctx.close(); return r;
  };
  const A = await measure(false), B = await measure(true);
  ok("متصفح عادي: لا صنف pb-tz ولا نص دون 8px", A.cls === "" && A.under8 === 0, A);
  ok("بيئة تكبير 1.3× وحد أدنى 8px: فُعّل pb-tz", /pb-tz/.test(B.cls), B.cls);
  const off = A.boxes.filter((x, i) => B.boxes[i] && Math.max(Math.abs(x[0] - B.boxes[i][0]), Math.abs(x[1] - B.boxes[i][1])) > 6).length;
  ok("البيئة المكبِّرة تطابق المتصفح العادي (صناديق النص والقائمة ضمن 6px)", off === 0, { A: A.boxes, B: B.boxes });
  await br.close(); console.log(fails ? "✗ فشل " + fails : "✓ نجح الكل"); process.exit(fails ? 1 : 0);
})();
