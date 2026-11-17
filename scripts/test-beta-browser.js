#!/usr/bin/env node
// واجهة Beta في Chromium حقيقي: لا يتصل أي طلب بمضيف/مشروع Production، الشريط ظاهر على الحاسوب والهاتف، والإبلاغ عن مشكلة/التقاط الأخطاء يصلان لـAPI Beta فقط.
// ⚠ الشبكة الخارجية كلها مقطوعة (route.abort) عدا ما يُستجاب له بـfulfill؛ Supabase Beta وهمي. نوع الاختبار: متصفح حقيقي لملفات ساكنة (ليس نشراً حقيقياً).
const { chromium } = require("playwright"); const { spawnSync } = require("child_process"); const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, ".."); let pass = 0, fail = 0; const ok = (m, c, x) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  " + JSON.stringify(x).slice(0, 300))); };
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, "platform/env/environments.json"), "utf8")), P = REG.environments.production, B = REG.environments.beta, N = REG.never_outside_production;
const tmp = fs.mkdtempSync(path.join(ROOT, "dist-tmp-betab-")), rel = path.relative(ROOT, path.join(tmp, "b"));
const b = spawnSync("python3", ["scripts/build-beta.py", "--out", rel, "--allow-placeholder"], { cwd: ROOT, encoding: "utf8" }); if (b.status !== 0) { console.log("✗ تعذّر بناء Beta\n" + b.stdout + b.stderr); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(1); }
const DIR = path.join(ROOT, rel), MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const srv = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(DIR, p); if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end("nf"); } s.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(s); });
const PROD_HOSTS = [P.api_host, P.gateway_host, P.app_host, "www." + P.app_host, ...N.hosts].map((h) => h.toLowerCase()), isProd = (u) => { try { const x = new URL(u); return PROD_HOSTS.includes(x.hostname.toLowerCase()) || N.supabase_refs.some((r) => x.hostname.includes(r)) || /saberbalbouzi-ui/.test(u) || /script\.google\.com/.test(u); } catch { return false; } };
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port, br = await chromium.launch();
  const seen = [], feedback = [];
  async function openPage(url, vp) {
    const ctx = await br.newContext({ viewport: vp, serviceWorkers: "block" }), pg = await ctx.newPage(), errs = [];
    await pg.addInitScript(() => { try { localStorage.setItem("store_guard_off", "1"); } catch (e) { } });                    // مفتاح المالك: يعطّل حارس منع الأتمتة (anti-copy) في بيئة الاختبار فقط
    pg.on("pageerror", (e) => errs.push(String(e).slice(0, 150)));
    await pg.route("**/*", async (route) => {
      const u = route.request().url(); if (u.startsWith(base)) return route.continue(); seen.push(u);
      if (u === "https://" + B.api_host + "/v1/beta/status") return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ banner: "نص تنبيه Beta من الخادم (اختبار)", phase: "internal", signups_open: false }) });
      if (u === "https://" + B.api_host + "/v1/beta/feedback") { if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST" } }); feedback.push(JSON.parse(route.request().postData() || "{}")); return route.fulfill({ status: 201, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"id":1}' }); }
      return route.abort();                                                                                                   // كل شيء آخر مقطوع (الخطوط/السكربتات الخارجية/أي مضيف)
    });
    await pg.goto(base + url, { waitUntil: "domcontentloaded" }); await pg.waitForTimeout(900); return { ctx, pg, errs };
  }
  for (const [name, vp] of [["حاسوب", { width: 1280, height: 800 }], ["هاتف", { width: 360, height: 640 }]]) for (const url of ["/index.html", "/shop.html", "/account.html", "/admin.html"]) {
    const { ctx, pg, errs } = await openPage(url, vp);
    const bar = await pg.evaluate(() => { const e = document.getElementById("beta-bar"); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), vw: innerWidth, visible: r.height > 0 && getComputedStyle(e).display !== "none", text: e.textContent, hscroll: document.documentElement.scrollWidth > innerWidth + 1 }; });
    ok(`[BR1] ${name} ${url}: شريط Beta ظاهر بنص الخادم (/v1/beta/status من مضيف Beta)`, !!bar && bar.visible && /نص تنبيه Beta من الخادم/.test(bar.text), bar);
    ok(`[BR1] ${name} ${url}: الشريط داخل عرض الشاشة وبلا تمرير أفقي ناتج عنه`, !!bar && bar.w <= bar.vw && (name === "حاسوب" || !bar.hscroll || url === "/admin.html"), bar);
    ok(`[BR2] ${name} ${url}: CONFIG.BETA مفعّل وبلا مرجع إنتاج`, await pg.evaluate((ref) => typeof CONFIG !== "undefined" && CONFIG.BETA && CONFIG.BETA.enabled === true && !JSON.stringify(CONFIG).includes(ref), N.supabase_refs[0]));
    await ctx.close(); }
  ok("[BR3] طوال كل الصفحات: لا طلب واحد إلى Production (مضيفو الإنتاج/مرجع Supabase الإنتاج/GitHub المالك/Apps Script)", !seen.some(isProd), seen.filter(isProd).slice(0, 5));
  console.log("  (معلومة) المضيفون الخارجيون المرصودون:", [...new Set(seen.map((u) => new URL(u).hostname))].join(", "));
  { const { ctx, pg } = await openPage("/index.html", { width: 1280, height: 800 }); feedback.length = 0;
    await pg.click("#beta-bar button"); await pg.fill("#beta-dlg textarea", "زر الإرسال لا يعمل عندي"); await pg.click("#beta-send"); await pg.waitForTimeout(500);
    ok("[BR4] «أبلغ عن مشكلة»: POST إلى /v1/beta/feedback على مضيف Beta فقط بنوع feedback وصفحة المسار", feedback.length === 1 && feedback[0].kind === "feedback" && feedback[0].message === "زر الإرسال لا يعمل عندي" && feedback[0].page === "/index.html", feedback);
    ok("[BR4] رسالة الشكر تظهر", /وصلتنا ملاحظتك/.test(await pg.evaluate(() => document.getElementById("beta-dlg").innerText)));
    feedback.length = 0; await pg.evaluate(() => { setTimeout(() => { throw new Error("boom-test"); }, 0); }); await pg.waitForTimeout(500);
    ok("[BR5] خطأ JS غير معالَج يُرسَل كـkind=error إلى API Beta (بلا بيانات مستخدم)", feedback.length === 1 && feedback[0].kind === "error" && /boom-test/.test(feedback[0].message), feedback);
    for (let i = 0; i < 6; i++) await pg.evaluate(() => { setTimeout(() => { throw new Error("spam"); }, 0); }); await pg.waitForTimeout(600);
    ok("[BR5] حدّ 3 أخطاء لكل صفحة (لا إغراق)", feedback.length <= 3, feedback.length); await ctx.close(); }
  await br.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nالنتيجة: ${pass} ناجح، ${fail} فاشل`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("CRASH", e); try { srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); } catch { } process.exit(2); });
