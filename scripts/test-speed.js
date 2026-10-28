/* «سرعة الموقع»: النواة النقية + الواجهة على متصفح حقيقي (GitHub وGoogle مُحاكيان بتقرير Lighthouse حقيقي محفوظ):
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-speed.js */
const http = require("http"), fs = require("fs"), path = require("path"), zlib = require("zlib"); const { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const C = require(path.join(root, "assets/js/speed-core.js")), RECIPES = JSON.parse(fs.readFileSync(path.join(root, "assets/data/speed-recipes.json"), "utf8"));
const GZ = fs.readFileSync(path.join(__dirname, "fixtures/speed-sample.json.gz")), SAMPLE = JSON.parse(zlib.gunzipSync(GZ));
/* ── النواة ── */
C.setRecipes(RECIPES); const lhr = SAMPLE.devices.mobile.lhr, sm = C.summarize(lhr, { lang: "ar" });
ok("الدرجات الأربع", ["performance", "accessibility", "best-practices", "seo"].every((k) => typeof sm.scores[k] === "number"), sm.scores);
ok("مقاييس الأداء الخمسة", ["FCP", "LCP", "TBT", "CLS", "SI"].every((a) => sm.metrics.some((m) => m.acronym === a)), sm.metrics.map((m) => m.acronym));
ok("البنود مرتبة بالنقاط تنازلياً", sm.issues.every((x, i, a) => !i || a[i - 1].pointsGain >= x.pointsGain));
ok("وصفة إصلاح عربية لبند معروف", !!(sm.issues.find((x) => x.fix) || {}).fix);
ok("مجموع نقاط الفئات الراسبة ≈ 100 − الدرجة (إمكانية الوصول)", Math.abs(sm.issues.reduce((s, i) => s + (i.categories.accessibility || 0), 0) - (100 - sm.scores.accessibility)) < 2.5, [sm.issues.reduce((s, i) => s + (i.categories.accessibility || 0), 0), 100 - sm.scores.accessibility]);
ok("normUrl", C.normUrl("example.com") === "https://example.com/" && C.normUrl("javascript:alert(1)") === "" && C.normUrl("https://u:p@x.com") === "" && C.normUrl("") === "");
ok("fromPsi: خطأ حصة وخطأ وقت التشغيل وناجح", C.fromPsi("mobile", { error: { code: 429, message: "q" } }).error.code === "PSI_429" && /أكبر عنصر/.test(C.fromPsi("mobile", { lighthouseResult: { runtimeError: { code: "NO_LCP", message: "x" } } }).error.message) && !!C.fromPsi("mobile", { lighthouseResult: lhr }).lhr);
ok("grade", C.grade(95) === "good" && C.grade(60) === "mid" && C.grade(10) === "bad" && C.grade(null) === "na");
ok("وصفات الثلاث لغات لكل بند", Object.values(RECIPES).every((v) => v.length === 3 && v.every(Boolean)) && !Object.values(RECIPES).some((v) => /next\/|Next\.js|next build/.test(v.join(" "))));
/* ── الواجهة ── */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/__blank") { r.writeHead(200, { "Content-Type": "text/html" }); return r.end("<!doctype html><meta charset=utf-8><body></body>"); } const f = path.join(root, decodeURIComponent(u)); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch(), ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const gh = { dispatch: null, gets: 0, deleted: false, mode: "ok", runs: [] };
  await ctx.route("https://api.github.com/**", async (route) => {
    const u = route.request().url(), m = route.request().method(), j = (o, s) => route.fulfill({ status: s || 200, contentType: "application/json", body: JSON.stringify(o) });
    if (m === "POST" && /speed-test\.yml\/dispatches/.test(u)) { gh.dispatch = JSON.parse(route.request().postData()); return route.fulfill({ status: gh.mode === "nowf" ? 404 : 204, body: "" }); }
    if (m === "GET" && /\/runs\?/.test(u)) return j({ workflow_runs: gh.runs });
    if (m === "GET" && /contents\/assets\/speed\//.test(u)) { gh.gets++; if (gh.mode === "fail") return j({}, 404); return gh.gets < 2 ? j({}, 404) : j({ content: GZ.toString("base64"), sha: "abc" }); }
    if (m === "DELETE" && /contents\/assets\/speed\//.test(u)) { gh.deleted = true; return j({}); }
    return j({}, 404);
  });
  let psi = { n: 0, status: 200 };
  await ctx.route("https://www.googleapis.com/pagespeedonline/**", async (route) => { psi.n++; psi.last = route.request().url(); if (psi.status === 429) return route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: { code: 429, message: "Quota exceeded" } }) }); route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ lighthouseResult: lhr }) }); });
  const p = await ctx.newPage(), errs = []; p.on("pageerror", (e) => errs.push(e.message)); await p.goto(base + "/__blank");
  await p.evaluate(async () => {
    document.body.innerHTML = '<div id="tab-speed" class="hidden"><div id="speed-content"></div></div>'; window.__toasts = [];
    window.GH = { cfg: () => window.__gh }; window.__gh = { token: "t", owner: "o", repo: "r", branch: "main" }; window.Admin = { tab() { }, toast: (t) => window.__toasts.push(t) };
    for (const s of ["/assets/js/speed-core.js", "/assets/js/admin-speed.js"]) await new Promise((r) => { const e = document.createElement("script"); e.src = s; e.onload = r; document.body.appendChild(e); });
    Admin.tab("speed");
  });
  await p.waitForSelector("#sp-url");
  ok("لا خيارات محرّك ولا أسماء خدمات في الواجهة", !(await p.$("input[name=sp-eng]")) && !(await p.$("#sp-key")) && !/PageSpeed|Lighthouse|GitHub|Google/i.test(await p.evaluate(() => document.getElementById("sp-app").textContent)));
  /* رابط خاطئ ومحلي */
  await p.fill("#sp-url", "javascript:alert(1)"); await p.click("[data-sp=run]"); ok("رابط خطير يُرفض بلا نداء", gh.dispatch === null && (await p.evaluate(() => window.__toasts)).length >= 1);
  await p.fill("#sp-url", "http://localhost:3000/"); await p.click("[data-sp=run]"); ok("عنوان محلي يُرفض", gh.dispatch === null && (await p.evaluate(() => window.__toasts)).length >= 2);
  /* فحص مفصّل كامل */
  await p.fill("#sp-url", "alyssumdz.com"); await p.click("[data-sp=run]"); await p.waitForSelector(".sp-rings", { timeout: 40000 });
  ok("الإرسال للخادم بالمدخلات الصحيحة", gh.dispatch && gh.dispatch.inputs.url === "https://alyssumdz.com/" && gh.dispatch.inputs.devices === "both" && /^s[a-z0-9]+$/.test(gh.dispatch.inputs.id), gh.dispatch);
  ok("تُحذف نتيجة الخادم بعد قراءتها", await p.waitForFunction(() => true).then(() => gh.deleted));
  let t = await p.evaluate(() => document.getElementById("sp-app").textContent);
  ok("الدرجات والمقاييس ومعالج الأخطاء ظاهرة", /الأداء/.test(t) && /LCP/.test(t) && /ما الذي يمنع الوصول إلى 100/.test(t) && /طريقة الإصلاح/.test(t), t.slice(0, 200));
  ok("خمسة مقاييس + بنود راسبة", (await p.$$(".sp-met > div")).length === 5 && (await p.$$(".sp-iss")).length >= 5);
  ok("لا فيض أفقي على الجوال", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await p.click('[data-sp=cat][data-v=accessibility]'); const na = (await p.$$(".sp-iss")).length; await p.click('[data-sp=cat][data-v=all]'); ok("تصفية الفئة تقلّل القائمة", na > 0 && na < (await p.$$(".sp-iss")).length, na);
  await p.evaluate(() => { navigator.clipboard.writeText = async (v) => { window.__clip = v; }; }); await p.click("[data-sp=copyall]");
  ok("نسخ تقرير الأخطاء نصّ كامل بالإصلاحات", await p.evaluate(() => /# تقرير سرعة الموقع/.test(window.__clip) && /الإصلاح:/.test(window.__clip) && /\+\d/.test(window.__clip)));
  await p.click("[data-sp=full]"); await p.waitForSelector("#sp-full .lh-root, #sp-full .lh-vars, #sp-full [class*=lh-]", { timeout: 20000 }); ok("التقرير الكامل يُعرض بعارضه الرسمي", await p.evaluate(() => document.querySelectorAll("#sp-full .lh-audit").length > 10));
  ok("XSS: لا عناصر script داخل النتيجة", !(await p.$("#sp-app script")));
  /* الخدمة غير مفعّلة ← انتقال تلقائي صامت للخدمة الاحتياطية */
  gh.mode = "nowf"; psi.n = 0; await p.click("[data-sp=run]"); await p.waitForSelector(".sp-prog", { timeout: 5000 }); await p.waitForSelector(".sp-rings", { timeout: 60000 });
  ok("الانتقال التلقائي للاحتياطية بنتيجة كاملة وبلا رسالة خطأ", psi.n === 2 && !(await p.$(".sp-err")), psi.n);
  /* نفاد حصة الاحتياطية ← رسالة عامة بلا أسماء */
  psi.status = 429; await p.click("[data-sp=run]"); await p.waitForSelector(".sp-err", { timeout: 60000 });
  ok("رسالة الازدحام عامة", /مشغولة الآن/.test(await p.textContent("#sp-app")) && !/PageSpeed|Google|مفتاح/.test(await p.textContent("#sp-app")));
  /* بلا ربط نشر ← احتياطي مباشرة */
  psi.status = 200; psi.n = 0; await p.evaluate(() => { window.__gh = null; }); await p.click("[data-sp=run]"); await p.waitForSelector(".sp-rings", { timeout: 60000 });
  ok("بلا ربط نشر: يعمل بالاحتياطي دون خطأ", psi.n === 2 && /locale=ar/.test(psi.last) && /category=BEST_PRACTICES/.test(psi.last), psi.last);
  ok("السجل يحفظ الفحوص", await p.evaluate(() => JSON.parse(localStorage.getItem("alyssum_speed_hist")).length >= 2));
  ok("بلا أخطاء JS", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? "فشل " + fails : "✓ كل اختبارات سرعة الموقع نجحت"); process.exit(fails ? 1 : 0);
})();
