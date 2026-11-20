// تدقيق تباين النصوص (WCAG) على القوالب كما تُنشر: لكل قالب وعرض (حاسوب 1360 / هاتف 390) يُرسم القالب بالمُصيِّر الحقيقي PB.fullHtml (بيانات تجريبية كما يراها التاجر)،
// ثم يُلتقط الخلفية الفعلية خلف كل نص (لقطة كاملة بعد إخفاء النصوص وحدها بلا تغيير في الخلفيات/الصور/الطبقات)، ويحسب scripts/contrast-calc.py نسبة التباين لكل عنصر نصي
// (النص العادي 4.5:1، الكبير ≥24px أو ≥18.66px عريضاً 3:1) على أسوأ 10% من بكسلات الخلفية خلف النص.
// التشغيل: EQA_BASE=http://127.0.0.1:8392 EQA_PASS=… CA_OUT=/tmp/ca CA_IDS=s-fashion,s-tech CA_W=1360,390 NODE_PATH=/opt/node-tools/node_modules node tests/contrast-audit.js
const { chromium } = require("playwright"); const declareProtect = require("./_declared-protect"); const fs = require("fs"), path = require("path");
const BASE = process.env.EQA_BASE, PW = process.env.EQA_PASS || "TestPass12345", OUT = process.env.CA_OUT || "/tmp/ca", IDS = process.env.CA_IDS ? process.env.CA_IDS.split(",") : null, WIDTHS = (process.env.CA_W || "1360,390").split(",").map(Number);
const SCHEME = process.env.CA_SCHEME || "light";      // light | dark: تفضيل نظام المتصفح (القوالب التي تدعمه تتبدّل)
const sleep = ms => new Promise(r => setTimeout(r, ms)); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const br = await chromium.launch(), actx = await br.newContext({ viewport: { width: 1360, height: 900 } }); await declareProtect(actx); const admin = await actx.newPage();
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await sleep(4000); await admin.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await admin.waitForFunction(() => typeof Admin !== "undefined" && typeof PB !== "undefined" && Admin.products && Admin.products.length, null, { timeout: 60000 }); await sleep(2500);
  const idx = await admin.evaluate(async () => (await (await fetch("assets/pages/templates/index.json", { cache: "no-store" })).json()).map(x => ({ id: x.id, cat: x.cat, file: x.file || x.id })));
  const list = idx.filter(x => !IDS || IDS.includes(x.id)); const meta = [];
  for (const t of list) {
    const html = await admin.evaluate(async ([file, scheme]) => { const r = await fetch("assets/pages/templates/" + file + ".json", { cache: "no-store" }); const pg = PB.migrate(await r.json()); const slug = ((Admin.products || [])[0] || {}).slug || ""; pg.product = slug; pg.slug = "ca"; return PB.fullHtml(pg, { base: "", baseHref: location.origin + "/", edit: false, path: "", demo: true, products: (Admin.products || []), pageProduct: slug, site: { name: "متجرك", wa: "213555000000" } }); }, [t.file, SCHEME]);
    for (const w of WIDTHS) {
      const mob = w < 600, c = await br.newContext({ viewport: { width: w, height: mob ? 844 : 900 }, isMobile: mob, hasTouch: mob, deviceScaleFactor: 1, colorScheme: SCHEME, serviceWorkers: "block" }); await declareProtect(c); const p = await c.newPage(); const route = BASE + "/__ca.html";
      await p.route(route, r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html })); try { await p.goto(route, { waitUntil: "load", timeout: 60000 }); } catch (e) { }
      await sleep(1200); await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 350) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); } window.scrollTo(0, 0); }); await sleep(900);
      await p.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}[data-anim],[class*=reveal]{opacity:1!important;transform:none!important}" }); await sleep(500);   // تثبيت التخطيط (بلا حركات دخول/شريط متحرك) قبل القياس كي تطابق الصناديق اللقطة
      const boxes = await p.evaluate(() => {
        const out = [], opAcc = el => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const v = parseFloat(getComputedStyle(n).opacity); if (!isNaN(v)) o *= v; } return o; };
        const rgba = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const a = m[1].split(",").map(x => parseFloat(x)); return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1]; };
        const W = Math.max(document.documentElement.scrollWidth, innerWidth);
        for (const el of document.body.querySelectorAll("*")) {
          if (/^(SCRIPT|STYLE|NOSCRIPT|SVG|PATH|IMG|VIDEO|IFRAME|OPTION)$/i.test(el.tagName)) continue;
          const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim().length > 1).map(n => n.textContent.trim()).join(" "); if (!own) continue;
          const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue; const rg = el.getClientRects(); if (!rg.length) continue; const r = el.getBoundingClientRect(); if (r.width < 6 || r.height < 6) continue;
          const col = rgba(cs.color); const fill = cs.webkitTextFillColor; const grad = (cs.backgroundClip === "text" || cs.webkitBackgroundClip === "text"); if (!col) continue;
          const op = opAcc(el); const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight) || 400;
          out.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 60), text: own.slice(0, 60), x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), color: col, alpha: col[3] * op, fs, fw, large: fs >= 24 || (fs >= 18.66 && fw >= 700), grad: grad || /rgba\(0, 0, 0, 0\)|transparent/.test(fill), shadow: cs.textShadow !== "none", stroke: parseFloat(cs.webkitTextStrokeWidth) || 0 });
        }
        return { boxes: out, W, H: document.documentElement.scrollHeight };
      });
      await p.addStyleTag({ content: "*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important;caret-color:transparent!important;animation:none!important;transition:none!important}[data-anim],[class*=reveal]{opacity:1!important;transform:none!important}::placeholder{color:transparent!important}" });
      await p.evaluate(() => { for (const el of document.body.querySelectorAll("*")) { try { el.style.setProperty("color", "transparent", "important"); el.style.setProperty("-webkit-text-fill-color", "transparent", "important"); el.style.setProperty("text-shadow", "none", "important"); } catch (e) { } } });   // أنماط inline!important تغلب ورقة الإخفاء: تُخفى صراحةً كي لا تظهر نصوص في اللقطة
      await sleep(500); const shot = path.join(OUT, `${t.id}__${w}.png`); try { await p.screenshot({ path: shot, fullPage: true, timeout: 90000 }); } catch (e) { console.log("لقطة فشلت", t.id, w, e.message.slice(0, 80)); await c.close(); continue; }
      fs.writeFileSync(path.join(OUT, `${t.id}__${w}.json`), JSON.stringify({ id: t.id, cat: t.cat, w, scheme: SCHEME, W: boxes.W, H: boxes.H, boxes: boxes.boxes })); meta.push({ id: t.id, w, n: boxes.boxes.length }); console.log(`${t.id} @${w}: ${boxes.boxes.length} عنصر نصي، ارتفاع ${boxes.H}`); await c.close();
    }
  }
  fs.writeFileSync(path.join(OUT, "_meta.json"), JSON.stringify(meta)); await br.close();
})();
