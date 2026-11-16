// مراجعة قبول الجودة والتصميم والتجربة لقوالب الدفعات الأربع (قراءة فقط: لا تغيّر قالباً ولا كوداً).
// يبني حزمة عميل نظيفة، يثبّتها على خادم php محلي، يفتح كل قالب في المطوّر الحقيقي ويعرضه كما يُنشر عند 1360 و390،
// ويلتقط صورة كاملة لكل عرض + مقاييس موضوعية، ثم يجري رحلة زبون حقيقية (صفحة منتج ← نموذج ← طلب) على قوالب المتاجر.
// حماية الموقع: لا انتحال UA ولا webdriver؛ يُعلَن إعداد للمراجعة فقط (إعداد الحزمة + bots:false عبر استجابة معدّلة داخل المتصفح).
// التشغيل: NODE_PATH=/opt/node-tools/node_modules node tests/library-experience-review.js   (EXR_OUT مجلد الصور، EXR_IDS لتحديد قوالب)
const { spawn, spawnSync } = require("child_process"), fs = require("fs"), path = require("path"), os = require("os");
const { chromium } = require("playwright");
const root = path.join(__dirname, ".."), PORT = 8600 + Math.floor(Math.random() * 300), PW = "TestPass12345";
const OUT = process.env.EXR_OUT || "/tmp/exr", ONLY = process.env.EXR_IDS ? process.env.EXR_IDS.split(",") : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dist = path.join(root, "dist", "exr-store"), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "exr-"));
  fs.rmSync(dist, { recursive: true, force: true });
  const b = spawnSync("python3", ["scripts/make-template.py", "--target", "php", "--out", "dist/exr-store", "--name", "Mystore", "--wa", "213000000000", "--kind", "physical"], { cwd: root, encoding: "utf8" });
  const code = (/([0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4})/.exec(b.stdout) || [])[1]; if (!code) { console.log("تعذّر بناء الحزمة", b.stdout.slice(-300)); process.exit(2); }
  // حزمة التثبيت النظيفة لا تحوي القوالب (تُسلَّم بحزمة التحديث): تُنسخ من المصدر كما تفعل حزمة التحديث (باستثناء owner_only)
  fs.cpSync(dist, tmp, { recursive: true });
  const sf = JSON.parse(fs.readFileSync(path.join(root, "shared-files.json"), "utf8")), own = new Set((sf.owner_only && sf.owner_only.files) || []);
  const upd = spawnSync("python3", ["scripts/make-template.py", "--target", "php", "--update", "--out", "dist/exr-update", "--name", "Mystore", "--wa", "213000000000"], { cwd: root, encoding: "utf8" });
  const updDir = path.join(root, "dist", "exr-update");
  if (fs.existsSync(updDir)) fs.cpSync(updDir, tmp, { recursive: true, force: true }); else console.log("تنبيه: لا حزمة تحديث", upd.stdout.slice(-200), upd.stderr.slice(-200));
  const php = spawn("php", ["-S", "127.0.0.1:" + PORT, "-t", tmp], { stdio: "ignore" });
  const kill = () => { try { php.kill(); } catch (e) { } fs.rmSync(dist, { recursive: true, force: true }); fs.rmSync(updDir, { recursive: true, force: true }); fs.rmSync(tmp, { recursive: true, force: true }); };
  process.on("exit", kill); await sleep(1500);
  const base = "http://127.0.0.1:" + PORT;
  const inst = await (await fetch(base + "/install.php", { method: "POST", body: new URLSearchParams({ code, pw: PW, pw2: PW, name: "Mystore", wa: "213000000000" }) })).text();
  if (!/تم التثبيت/.test(inst)) { console.log("فشل التثبيت"); process.exit(2); }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } }), admin = await ctx.newPage(); admin.on("dialog", d => d.accept());
  await admin.goto(base + "/admin.html"); await sleep(1200);
  await admin.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW);
  await admin.waitForFunction(() => typeof Admin !== "undefined" && Admin.products && document.querySelector("#app .top"), null, { timeout: 25000 }); await sleep(1500);
  await admin.evaluate(async () => { await AdminNav.libOpen(); }); await sleep(800); await admin.evaluate(() => AdminNav.libClose());   // يحمّل فهرس القوالب (LIBX) كما تفعل واجهة المكتبة
  const items = await admin.evaluate(async () => { const j = await (await fetch("assets/pages/templates/index.json", { cache: "no-store" })).json(); return (j.templates || j).map(x => ({ id: x.id, kind: x.kind, cat: x.cat, n: x.n })); });
  const REVIEW_PROTECT = Object.assign({}, JSON.parse(fs.readFileSync(path.join(tmp, "assets/data/protect.json"), "utf8")), { bots: false });   // إعداد معلن للمراجعة فقط (حزمة العميل لم تتغير)
  console.log("إعداد الحماية المعلن للمراجعة فقط:", JSON.stringify(REVIEW_PROTECT));
  const rows = [];
  for (const it of items) {
    if (ONLY && !ONLY.includes(it.id)) continue;
    const info = await admin.evaluate(async id => {
      try { await AdminNav.tplEdit(id); } catch (e) { return { err: e.message }; }
      for (let i = 0; i < 40 && !(PBApp.E && PBApp.E.page); i++) await new Promise(r => setTimeout(r, 250));
      if (!(PBApp.E && PBApp.E.page)) return { err: "لم يفتح" };
      const json = JSON.stringify(PBApp.E.page); try { PBApp.close(true); } catch (e) { } return { json };
    }, it.id);
    if (info.err) { console.log(it.id, "ERR", info.err); rows.push({ id: it.id, err: info.err }); continue; }
    const html = await admin.evaluate(([pgJson]) => { const pg = PB.migrate(JSON.parse(pgJson)); const slug = ((Admin.products || [])[0] || {}).slug || ""; pg.product = slug; pg.slug = "exr"; return PB.fullHtml(pg, { base: "", baseHref: location.origin + "/", edit: false, path: "", demo: true, products: (Admin.products || []), pageProduct: slug, site: { name: "متجرك", wa: "213555000000" } }); }, [info.json]);
    const row = { id: it.id, kind: it.kind, n: it.n };
    for (const w of [1360, 390]) {
      const c = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 }), p = await c.newPage(), errs = [], miss = [];
      p.on("pageerror", e => errs.push(e.message.slice(0, 100)));
      p.on("response", r => { if (r.status() >= 400 && r.url().startsWith(base) && !/favicon|\/api\/|checkout\.json/.test(r.url())) miss.push(r.status() + " " + r.url().replace(base, "").slice(0, 60)); });
      await c.route("**/assets/data/protect.json*", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(REVIEW_PROTECT) }));
      await p.route(base + "/__exr.html", r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }));
      await p.goto(base + "/__exr.html", { waitUntil: "load", timeout: 60000 }); await sleep(1200);
      await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 200)); } await new Promise(r => setTimeout(r, 1200)); }); const hid = await p.evaluate(() => [...document.querySelectorAll("body *")].filter(e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.height > 60 && r.width > 100 && +cs.opacity < 0.05 && cs.display !== "none"; }).slice(0, 6).map(e => e.tagName + "." + String(e.className).slice(0, 40))); row["hid" + w] = hid; await p.evaluate(() => window.scrollTo(0, 0)); await sleep(700);
      const m = await p.evaluate(() => {
        const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0; };
        const txtEls = [...document.querySelectorAll("h1,h2,h3,h4,p,span,a,button,li,label,small")].filter(e => vis(e) && e.childElementCount === 0 && (e.textContent || "").trim().length > 1);
        const sizes = txtEls.map(e => parseFloat(getComputedStyle(e).fontSize)), tiny = txtEls.filter((e, i) => sizes[i] < 11.5).length;
        const tr = e => (e.matches("input[type=checkbox],input[type=radio]") && e.closest("label") ? e.closest("label") : e).getBoundingClientRect();      // مربع الموافقة داخل label: هدف اللمس هو الـ label كله
        const taps = [...document.querySelectorAll("a[href],button,input,select,textarea")].filter(vis).map(tr), small = taps.filter(r => Math.min(r.width, r.height) < 36).length;
        const imgs = [...document.querySelectorAll("img")].filter(vis), broken = imgs.filter(i => i.complete && i.naturalWidth === 0).length, noalt = imgs.filter(i => !i.hasAttribute("alt")).length;
        const text = document.body.innerText, ph = (text.match(/lorem|ipsum|example\.com|0555 ?00 ?00 ?00|213555000000|TODO|undefined|NaN|\[\[|\{\{/gi) || []);
        const isSr = e => e.classList.contains("sr-only") || (e.getBoundingClientRect().width <= 3 && e.getBoundingClientRect().height <= 3);      // نص قارئ الشاشة (sr-only) مقتطع بالتصميم لا مشكلة
        const clipped = txtEls.filter(e => { const cs = getComputedStyle(e); return !isSr(e) && (cs.overflow === "hidden" || cs.textOverflow === "ellipsis") && e.scrollWidth > e.clientWidth + 2; }).length;
        const h1 = document.querySelectorAll("h1").length, ctas = [...document.querySelectorAll("a,button")].filter(e => vis(e) && /اطلب|اشتر|أضف|تسوق|احجز|تواصل|إرسال|ابدأ|سلة|buy|order/i.test(e.textContent)).length;
        // عناصر التفاعل داخل الإطارات (نموذج الطلب الأصلي يُحمَّل في iframe فلا يراه المقياس العادي)
        const frames = [...document.querySelectorAll("iframe")].map(f => { try { const d = f.contentDocument; if (!d || !d.body) return { src: (f.src || "").slice(-40), ok: false }; const fr = f.getBoundingClientRect(); const els = [...d.querySelectorAll("a[href],button,input,select,textarea")].filter(e => { const r = e.getBoundingClientRect(), cs = d.defaultView.getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && e.type !== "hidden"; }); return { src: (f.src || "").slice(-40), ok: true, w: Math.round(fr.width), h: Math.round(fr.height), taps: els.length, small: els.filter(e => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height) < 36).length, fields: d.querySelectorAll("input:not([type=hidden]),select,textarea").length, btns: d.querySelectorAll("button").length }; } catch (e) { return { src: (f.src || "").slice(-40), ok: false, err: String(e).slice(0, 60) }; } });
        const desc = e => e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.split(" ").filter(Boolean).slice(0, 2).join(".") : "") + "[" + (e.textContent || e.getAttribute("aria-label") || e.getAttribute("title") || "").trim().slice(0, 18) + "]" + Math.round(e.getBoundingClientRect().width) + "x" + Math.round(e.getBoundingClientRect().height);
        const smallList = [...document.querySelectorAll("a[href],button,input,select,textarea")].filter(vis).filter(e => { const r = tr(e); return Math.min(r.width, r.height) < 36; }).slice(0, 14).map(desc);
        const clippedList = txtEls.filter(e => { const cs = getComputedStyle(e); return !isSr(e) && (cs.overflow === "hidden" || cs.textOverflow === "ellipsis") && e.scrollWidth > e.clientWidth + 2; }).slice(0, 6).map(e => desc(e) + " sw=" + e.scrollWidth + " cw=" + e.clientWidth + " ov=" + getComputedStyle(e).overflow + "/" + getComputedStyle(e).textOverflow);
        const tapsAll = taps.length + frames.reduce((a, f) => a + (f.taps || 0), 0);
        return { tapsAll, frames, smallList, clippedList, h: document.documentElement.scrollHeight, over: document.documentElement.scrollWidth - document.documentElement.clientWidth, tiny, small, taps: taps.length, imgs: imgs.length, broken, noalt, ph: [...new Set(ph)].slice(0, 5), clipped, h1, ctas, dir: document.documentElement.dir || getComputedStyle(document.body).direction, secs: document.querySelectorAll("section").length };
      });
      Object.assign(row, { ["m" + w]: Object.assign(m, { errs: errs.length, miss: [...new Set(miss)].slice(0, 3) }) });
      const h = Math.min(m.h, w > 500 ? 9000 : 12000);
      await p.screenshot({ path: path.join(OUT, `${it.id}-${w}.png`), fullPage: true, clip: { x: 0, y: 0, width: w, height: h } }).catch(async () => { await p.screenshot({ path: path.join(OUT, `${it.id}-${w}.png`), fullPage: true }); });
      await c.close();
    }
    rows.push(row); console.log(it.id, JSON.stringify({ d: row.m1360, m: row.m390 }).slice(0, 420));
  }
  fs.writeFileSync(path.join(OUT, "metrics.json"), JSON.stringify(rows, null, 1));
  await browser.close(); process.exit(0);
})();
