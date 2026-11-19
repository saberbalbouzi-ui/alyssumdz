/* اختبار «حماية الموقع» مستقلاً عن وظائف الدفع/الـ Upsell:
     NODE_PATH=/opt/node-tools/node_modules node scripts/test-protect-bots.js
   (أ) حزمة عميل نظيفة مبنية بـ make-template: إعدادها الافتراضي protect.json = on + bots:true (لا يُعدَّل هنا).
   (ب) متصفح آلي حقيقي كما هو (بلا انتحال User-Agent ولا إخفاء webdriver) ⟵ تظهر شاشة #acg-ov فوق الصفحة كلها ويُمنع التفاعل مع النموذج والأزرار ولا يخرج طلب.
   (ج) شاهد ضابط: الإعداد نفسه بعد تعديل bots:false في الاستجابة داخل الاختبار فقط ⟵ لا شاشة وتعمل الصفحة (يثبت أن الحجب سببه الخيار لا خلل آخر).
   (د) قرار البوابة (anti-copy.js نفسه) داخل صندوق Node vm ببيئات معلنة: المستخدم البشري العادي لا يُحجب أبداً، والمتصفح الآلي (webdriver أو HeadlessChrome) يُحجب، ومحركات البحث/أدوات القياس المعروفة تُستثنى، وأن bots:false يعطّل الحجب.
   الخروج ≠ 0 عند أي فشل. */
const http = require("http"), fs = require("fs"), path = require("path"), vm = require("vm"), { spawnSync } = require("child_process"), { chromium } = require("playwright");
const root = path.join(__dirname, ".."), OUT = path.join(root, "dist", "protect-test");
let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/json" };

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  const b = spawnSync("python3", ["scripts/make-template.py", "--target", "php", "--out", "dist/protect-test", "--name", "Mystore", "--wa", "213000000000", "--kind", "physical"], { cwd: root, encoding: "utf8" });
  if (!fs.existsSync(path.join(OUT, "index.html"))) { console.log("تعذّر بناء الحزمة", b.stdout.slice(-300), b.stderr.slice(-300)); process.exit(2); }
  const cleanup = () => fs.rmSync(OUT, { recursive: true, force: true }); process.on("exit", cleanup);

  // (أ) الإعداد الافتراضي المسلَّم للعميل
  const pcfg = JSON.parse(fs.readFileSync(path.join(OUT, "assets/data/protect.json"), "utf8"));
  ok("حزمة العميل النظيفة: الحماية مفعّلة وحجب الروبوتات مفعّل افتراضياً (on + bots)", pcfg.on === true && pcfg.bots === true, pcfg);
  ok("إعداد المستودع نفسه لم يُخفَّف (bots:true)", JSON.parse(fs.readFileSync(path.join(root, "assets/data/protect.json"), "utf8")).bots === true);

  const reqs = [];
  const srv = http.createServer((q, r) => { reqs.push(q.method + " " + q.url); let u = decodeURIComponent(q.url.split("?")[0]); if (u.endsWith("/")) u += "index.html"; const f = path.join(OUT, u); if (!f.startsWith(OUT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
  await new Promise(r => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;

  const br0 = await chromium.launch();      // متصفح آلي حقيقي كما هو
  const open = async (route) => {
    const ctx = await br0.newContext({ serviceWorkers: "block", viewport: { width: 420, height: 900 } }), page = await ctx.newPage(), net = [];
    if (route) await ctx.route("**/assets/data/protect.json*", route);
    page.on("request", q => net.push(q.method() + " " + q.url()));
    await page.goto(base + "/p/demo/", { waitUntil: "load" }); await page.waitForTimeout(1500);
    return { ctx, page, net };
  };

  // (ب) الحجب
  { const { ctx, page, net } = await open(null);
    const ov = await page.evaluate(() => { const o = document.getElementById("acg-ov"); if (!o) return null; const cs = getComputedStyle(o), r = o.getBoundingClientRect(); return { txt: o.textContent, pos: cs.position, z: cs.zIndex, w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight }; });
    ok("المتصفح الآلي: تظهر شاشة #acg-ov برسالة «الوصول الآلي غير مسموح»", !!ov && /الوصول الآلي غير مسموح/.test(ov.txt), ov);
    ok("الشاشة ثابتة فوق الصفحة كلها (fixed، أعلى z-index، بمقاس نافذة العرض)", !!ov && ov.pos === "fixed" && Number(ov.z) >= 2147483647 && ov.w >= ov.vw && ov.h >= ov.vh, ov);
    const pts = await page.evaluate(() => { const out = []; for (const fx of [.1, .5, .9]) for (const fy of [.1, .3, .5, .7, .9]) { const t = document.elementFromPoint(innerWidth * fx, innerHeight * fy); out.push(!!(t && t.closest("#acg-ov"))); } return out; });
    ok("كل نقاط نافذة العرض (15 نقطة) تقع تحت الشاشة: لا عنصر من الصفحة يستقبل مؤشراً", pts.length === 15 && pts.every(Boolean), pts);
    let blocked = false, msg = ""; try { await page.click(".btn-order", { timeout: 2500 }); } catch (e) { blocked = true; msg = String(e.message); }
    ok("نقر حقيقي على زر الطلب يُرفض لأن الشاشة تعترض المؤشر", blocked && /intercepts pointer events/.test(msg), msg.slice(0, 200));
    await page.keyboard.press("Enter"); await page.waitForTimeout(500);
    ok("لا طلب إرسال/طلبية يخرج من الصفحة المحجوبة", !net.some(x => /submit_order|\/api\/.*order|order\.php|action=order|\?a=order|PLATFORM|\/v1\/orders/i.test(x) && /^POST/.test(x)), net.filter(x => /^POST/.test(x)));
    await ctx.close(); }

  // (ج) الشاهد الضابط: الاستجابة المعدّلة داخل الاختبار فقط
  { const { ctx, page } = await open(r => r.fulfill({ contentType: "application/json", body: JSON.stringify(Object.assign({}, pcfg, { bots: false })) }));
    const has = await page.evaluate(() => !!document.getElementById("acg-ov"));
    let clicked = true; try { await page.click("#name", { timeout: 3000 }); } catch (e) { clicked = false; }
    ok("شاهد ضابط (bots:false داخل الاختبار فقط): لا شاشة ويمكن النقر على الحقول", !has && clicked, { has, clicked });
    await ctx.close(); }

  await br0.close(); srv.close();

  // (د) قرار البوابة في بيئات معلنة (المستخدم البشري لا يُحجب)
  const SRC = fs.readFileSync(path.join(root, "assets/js/anti-copy.js"), "utf8");
  const gate = (env, cfg) => new Promise(res => {
    const els = {}, mk = () => { const e = { style: {}, children: [], setAttribute() { }, appendChild(c) { if (c.id) els[c.id] = c; return c; }, remove() { delete els[e.id]; }, insertAdjacentElement() { }, closest: () => null }; return e; };
    const docEl = { appendChild(c) { if (c.id) els[c.id] = c; return c; } };
    const win = { __x: 1, top: null, outerWidth: 1200, innerWidth: 1200, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null }, console: { log() { }, clear() { } }, setInterval() { }, Image: function () { }, Date, Math, Promise, JSON };
    win.top = win; win.window = win;
    const doc = { currentScript: null, head: docEl, documentElement: docEl, body: docEl, createElement: () => mk(), getElementById: id => els[id] || null, addEventListener() { } };
    const nav = { userAgent: env.ua, webdriver: env.webdriver };
    const sandbox = Object.assign(win, { document: doc, navigator: nav, location: { pathname: "/p/demo/", search: "", href: "http://x/p/demo/" }, fetch: u => Promise.resolve({ ok: true, json: () => Promise.resolve(/protect\.json/.test(u) ? cfg : { off: [] }) }), REL: "" });
    try { vm.runInNewContext(SRC, sandbox); } catch (e) { return res({ err: String(e) }); }
    setTimeout(() => res({ blocked: !!els["acg-ov"] }), 60);
  });
  const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", HEADLESS = CHROME.replace("Chrome/", "HeadlessChrome/");
  const ON = { on: true, bots: true };
  const cases = [
    ["مستخدم بشري عادي (Chrome، webdriver=false)", { ua: CHROME, webdriver: false }, ON, false],
    ["مستخدم بشري على هاتف (Safari iOS، webdriver غير معرَّف)", { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", webdriver: undefined }, ON, false],
    ["متصفح آلي (webdriver=true)", { ua: CHROME, webdriver: true }, ON, true],
    ["متصفح آلي (HeadlessChrome)", { ua: HEADLESS, webdriver: false }, ON, true],
    ["Googlebot (آلي معروف) يُستثنى", { ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", webdriver: true }, ON, false],
    ["Lighthouse (قياس أداء) يُستثنى", { ua: HEADLESS + " Chrome-Lighthouse", webdriver: true }, ON, false],
    ["آلي مع bots:false: لا حجب", { ua: HEADLESS, webdriver: true }, { on: true, bots: false }, false],
    ["آلي مع on:false: لا حجب", { ua: HEADLESS, webdriver: true }, { on: false, bots: true }, false]];
  for (const [name, env, cfg, want] of cases) { const r = await gate(env, cfg); ok("قرار البوابة — " + name + ": " + (want ? "يُحجب" : "لا يُحجب"), r.blocked === want && !r.err, r); }

  console.log(fails ? "\n" + fails + " إخفاق" : "\n✓ كل فحوص الحماية نجحت");
  process.exit(fails ? 1 : 0);
})();
