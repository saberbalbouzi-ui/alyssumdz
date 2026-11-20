// توافق الخوادم والمسارات والمتصفحات لمكتبة القوالب على متجر مثبَّت فعلاً (جذر أو مجلد فرعي) خلف خادم حقيقي (Apache/nginx/php -S):
//   SC_SEED=1  : يزرع المتجر (منتجات) ثم يثبّت s-nexus على الرئيسية وينشرها ويُنشر صفحتا /lp/ وجلد صفحة منتج (عبر لوحة الإدارة الحقيقية)
//   (دائماً)   : مصفوفة روابط تشمل الأدلة بلا الشرطة المائلة الأخيرة، وتتحقق من الوجهة النهائية ومحتواها وسلامة الموارد وروابط الفوتر
// التشغيل: SC_BASE=http://127.0.0.1:8081/store SC_STORE=/tmp/nxsrv/www/store SC_SEED=1 SC_BROWSER=chromium|firefox|webkit NODE_PATH=/opt/node-tools/node_modules node tests/server-compat.js
const { chromium, firefox, webkit } = require("playwright"); const declareProtect = require("./_declared-protect");
const fs = require("fs"), path = require("path");
const BASE = (process.env.SC_BASE || "").replace(/\/+$/, ""), STORE = process.env.SC_STORE, PW = process.env.EQA_PASS || "TestPass12345", BR = process.env.SC_BROWSER || "chromium";
if (!BASE || !STORE) { console.log("SC_BASE وSC_STORE مطلوبان"); process.exit(2); }
const ORIGIN = new URL(BASE).origin, PRE = new URL(BASE).pathname.replace(/\/$/, "");
const sleep = ms => new Promise(r => setTimeout(r, ms)); let pass = 0, fail = 0; const failures = [];
const ck = (n, c, x) => { if (c) pass++; else { fail++; failures.push(n); } console.log((c ? "PASS " : "FAIL ") + `[${BR}] ${n}` + (x !== undefined && x !== "" ? "  — " + (typeof x === "string" ? x : JSON.stringify(x)).slice(0, 280) : "")); };
const IM = n => "assets/img/tpl/" + n + ".webp", CATS = { fashion: "فئة اختبار أولى", tech: "فئة اختبار ثانية" };
const mkProd = i => ({ slug: "rs-p" + i, title: "منتج اختبار " + i, price: 2000 + i * 150, old: 0, cover: IM("acc_pink"), images: [IM("acc_pink"), IM("acc_round")], desc: "وصف " + i, cat: Object.keys(CATS)[i % 2], active: true, stock: 25, tags: [["best"], ["new"]][i % 2], offers: [{ qty: 1, price: 2000 + i * 150 }] });
function seedStore() {
  const P = [1, 2, 3, 4].map(mkProd), df = path.join(STORE, "assets/js/data.js"); let t = fs.readFileSync(df, "utf8");
  t = t.replace(/var CATEGORIES = .*;\n/, "var CATEGORIES = " + JSON.stringify(CATS) + ";\n").replace(/var PRODUCTS = .*;\n?/, "var PRODUCTS = " + JSON.stringify(P) + ";\n"); fs.writeFileSync(df, t);
  const tpl = fs.readFileSync(path.join(STORE, "p/_template/index.html"), "utf8");
  for (const p of P) { for (const im of new Set([p.cover].concat(p.images))) for (const w of ["w480", "w720"]) { const s = path.join(STORE, im), d = path.join(STORE, im.replace(/\.webp$/, "." + w + ".webp")); try { if (fs.existsSync(s) && !fs.existsSync(d)) fs.copyFileSync(s, d); } catch (e) { } } const d = path.join(STORE, "p", p.slug); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "index.html"), tpl.replace(/\{\{SLUG\}\}/g, p.slug)); }
}
(async () => {
  const B = { chromium, firefox, webkit }[BR], seedBrowser = await chromium.launch(), br = BR === "chromium" ? seedBrowser : await B.launch();
  const mk = async (b, w = 1360, h = 900) => { const c = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" }); await declareProtect(c); return c; };
  if (process.env.SC_SEED) {
    seedStore();
    const actx = await seedBrowser.newContext({ viewport: { width: 1360, height: 900 } }); await declareProtect(actx); const a = await actx.newPage(); a.on("dialog", d => d.accept());
    const open = async () => { await a.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await a.waitForFunction(() => typeof Admin !== "undefined" && typeof AdminNav !== "undefined" && typeof PBApp !== "undefined" && typeof PBConvert !== "undefined" && Admin.products && Admin.products.length, null, { timeout: 60000 }); await sleep(2500); };
    await a.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await sleep(4000); await a.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500); await open();
    const r = await a.evaluate(async () => { await AdminNav.libOpen(); try { await AdminNav.tplInstallHome("s-nexus"); } catch (e) { return { err: e.message }; } for (let i = 0; i < 60 && !(PBApp.E && PBApp.E.page && PBApp.E.page.origin); i++) await new Promise(r => setTimeout(r, 250)); await new Promise(r => setTimeout(r, 1500)); try { await PBApp.publish("direct"); } catch (e) { return { err: e.message }; } await new Promise(r => setTimeout(r, 8000)); return { ok: true }; });
    ck("زرع: تثبيت s-nexus ونشر الرئيسية عبر الخادم الحقيقي", r.ok, r);
    for (const [id, slug] of [["p-nexus-faq", "nx-faq"], ["p-nexus-collection", "nx-collection"]]) {
      const x = await a.evaluate(async ([id, slug]) => { await AdminNav.libOpen(); AdminNav.libClose(); await AdminNav.tplEdit(id); for (let i = 0; i < 40 && !(PBApp.E && PBApp.E.page && PBApp.E.page.sections.length); i++) await new Promise(r => setTimeout(r, 250)); const P = PBApp.E.page; P.slug = slug; P.title = P.title || slug; P.demo = false; window.confirm = () => true; try { await PBApp.publish(); } catch (e) { return "ERR " + e.message; } await new Promise(r => setTimeout(r, 6500)); return "ok"; }, [id, slug]); ck("زرع: نشر صفحة /lp/" + slug + "/", x === "ok", x);
    }
    await open(); const pr = await a.evaluate(async () => { try { return await AdminNav.tplInstallProducts("s-nexus", ["rs-p1"]); } catch (e) { return { err: e.message }; } }); ck("زرع: جلد NEXUS لصفحة المنتج rs-p1", pr && pr.done && pr.done.length === 1, pr);
    await actx.close();
  }
  // ── مصفوفة الروابط ──
  const J = x => JSON.stringify(x);
  const FL = [["الرئيسية", "index.html"], ["المتجر", "shop.html"], ["السلة", "cart.html"], ["حسابي", "account.html"]];
  const M = [["", "root-no-slash", /h1|pb-/, false], ["/", "root", /pb-/, true], ["/index.html", "index.html", /pb-/, true], ["/shop.html", "shop.html", /shop-grid/, true], ["/cart.html", "cart.html", /cart-page/, true], ["/account.html", "account.html", /acc-bg|account/i, true],
    ["/p/rs-p1/", "product-slash", /order-form|offers/, true], ["/p/rs-p1", "product-NO-slash", /order-form|offers/, true], ["/lp/nx-faq/", "lp-slash", /pb-/, true], ["/lp/nx-faq", "lp-NO-slash", /pb-/, true], ["/lp/nx-collection", "lp-collection-NO-slash", /pb-/, true]];
  for (const [u, name, mark, slashOk] of M) {
    const c = await mk(br), p = await c.newPage(), errs = [], bad = [], redirects = []; p.on("pageerror", e => errs.push(e.message.slice(0, 120)));
    p.on("response", r => { const s = r.status(), url = r.url(); if (s >= 300 && s < 400 && url.startsWith(ORIGIN) && /^\/(store\/)?(p|lp)?\/?[^.]*$/.test(new URL(url).pathname)) redirects.push(s + " " + new URL(url).pathname); if (s >= 400 && url.startsWith(ORIGIN) && !/favicon|\/api\/|manifest|sw\.js|checkout\.json|\/lib\//.test(url)) bad.push(s + " " + new URL(url).pathname); });
    let resp = null; try { resp = await p.goto(BASE + u, { waitUntil: "load", timeout: 60000 }); } catch (e) { }
    await sleep(2200); const fin = new URL(p.url()), st = resp ? resp.status() : 0;
    const info = await p.evaluate(() => { const html = document.documentElement.outerHTML; const foot = document.querySelector("footer.pb-sf"); return { len: html.length, html: html.slice(0, 200000), fl: foot ? [...foot.querySelectorAll("a")].map(a => ({ t: a.textContent.trim(), href: a.href })) : null, over: document.documentElement.scrollWidth - document.documentElement.clientWidth, broken: [...document.images].filter(i => i.getBoundingClientRect().width > 4 && i.complete && i.naturalWidth === 0).length }; }).catch(() => ({ len: 0, html: "", fl: null, over: 0, broken: 0 }));
    const under = fin.pathname === PRE || fin.pathname.startsWith(PRE + "/");
    ck(`${name} (${u || "/store بلا شرطة"}): الاستجابة 200 داخل مسار التثبيت ${PRE || "/"}${redirects.length ? " — بعد " + redirects[0] : ""}`, st === 200 && under && info.len > 3000, { st, final: fin.pathname, redir: redirects[0] || "-" });
    ck(`${name}: المحتوى الصحيح ظاهر (${mark})`, mark.test(info.html), "");
    ck(`${name}: الموارد (CSS/JS/صور/خطوط) بلا 4xx ولا صور مكسورة ولا أخطاء JS`, !bad.length && !errs.length && info.broken === 0, { bad: bad.slice(0, 4), errs: errs.slice(0, 2), broken: info.broken });
    if (info.fl) { const want = FL.map(([t, f]) => ORIGIN + PRE + "/" + f), got = FL.map(([t]) => (info.fl.find(x => x.t === t) || {}).href); ck(`${name}: روابط الفوتر الأربعة تصل صفحات المتجر داخل المسار نفسه`, J(got) === J(want), got); }
    await c.close();
  }
  console.log(`\n${fail ? fail + " إخفاق: " + failures.join(" | ") : "✓ كل الفحوص نجحت"} (${pass} نجاح)`); await seedBrowser.close(); if (br !== seedBrowser) await br.close(); process.exit(fail ? 1 : 0);
})();
