// تدقيق صورة الـHero في كل قوالب المكتبة (حاسوب 1360 + هاتف 390) كما تُنشر: القالب يُرسَم بالمُصيِّر الحقيقي PB.fullHtml (بيانات تجريبية كما يراها التاجر) ثم:
//   • أول قسم محتوى بعد الهيدر/الشريط = Hero؛ يُجمع كل وسائطه: <img> وخلفيات CSS (background-image) بأحجامها الفعلية وحالة التحميل الحقيقية (لا مجرد وجود الرابط)
//   • الشروط: صورة Hero ظاهرة ومحمَّلة في الحاسوب والهاتف معاً؛ لا وسيط يُخفى على الهاتف (display/visibility/opacity/حجم صفري) وهو ظاهر على الحاسوب؛ لا فراغ رأسي كبير بلا محتوى داخل الـHero؛ لا أخطاء شبكة للصور؛ العنوان ظاهر
//   • يلتقط لقطات شاشة فعلية لكل قالب/عرض في HA_OUT ويكتب hero-report.json لتجميع ورقة اللقطات (scripts/hero-sheets.py)
// التشغيل: EQA_BASE=http://127.0.0.1:8392 EQA_PASS=… HA_OUT=/tmp/ha [HA_IDS=s-fashion,s-nexus-fashion] NODE_PATH=/opt/node-tools/node_modules node tests/hero-audit.js
const { chromium } = require("playwright"); const declareProtect = require("./_declared-protect"); const fs = require("fs"), path = require("path");
const BASE = process.env.EQA_BASE, PW = process.env.EQA_PASS || "TestPass12345", OUT = process.env.HA_OUT || "/tmp/ha", IDS = process.env.HA_IDS ? process.env.HA_IDS.split(",") : null;
const sleep = ms => new Promise(r => setTimeout(r, ms)); fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const failures = [], report = [];
const ck = (id, n, c, x) => { if (c) pass++; else { fail++; failures.push(id + ": " + n); } console.log((c ? "PASS " : "FAIL ") + `[${id}] ${n}` + (x !== undefined && !c ? "  — " + (typeof x === "string" ? x : JSON.stringify(x)).slice(0, 300) : "")); };
const NONHERO = ["sbar", "shdr", "marquee", "anchor", "spacer", "sfoot", "cookie", "buybar"];
// يعمل داخل الصفحة: يعيد وصف الـHero (أول قسم محتوى) ووسائطه وفجواته
const PROBE = async ([heroIdx, NONHERO]) => {
  const secs = [...document.querySelectorAll(".pb-sec")]; const vw = innerWidth;
  const vis = el => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === "none" || c.visibility === "hidden" || parseFloat(c.opacity) < 0.05) return false; } return true; };
  let hero = null, idx = heroIdx;
  if (idx == null) { idx = secs.findIndex(s => { const types = [...s.querySelectorAll(".pb-w")].map(w => w.dataset.type); const r = s.getBoundingClientRect(); return types.length && !types.every(t => NONHERO.includes(t)) && r.height >= 160 && getComputedStyle(s).display !== "none"; }); }
  hero = secs[idx]; if (!hero) return { idx: -1 };
  const hr = hero.getBoundingClientRect(), H = { idx, top: Math.round(hr.top + scrollY), h: Math.round(hr.height), w: Math.round(hr.width), types: [...new Set([...hero.querySelectorAll(".pb-w")].map(w => w.dataset.type))] };
  const media = [];
  for (const im of hero.querySelectorAll("img")) { const r = im.getBoundingClientRect(), c = getComputedStyle(im); const nat = [im.naturalWidth, im.naturalHeight]; let visFrac = null; if (nat[0] > 0 && r.width > 0 && r.height > 0 && /cover/.test(c.objectFit)) { const bar = r.width / r.height, iar = nat[0] / nat[1]; visFrac = bar > iar ? iar / bar : bar / iar; }
    media.push({ kind: "img", src: (im.currentSrc || im.src || "").replace(location.origin + "/", "").slice(0, 90), loaded: im.complete && nat[0] > 0, nat, rect: [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)], visible: vis(im) && r.width > 8 && r.height > 8, fit: c.objectFit, pos: c.objectPosition, visFrac: visFrac === null ? null : +visFrac.toFixed(2) }); }
  const bgs = []; for (const el of [hero, ...hero.querySelectorAll("*")]) { const c = getComputedStyle(el); const m = c.backgroundImage && c.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/g); if (!m) continue; const r = el.getBoundingClientRect(); for (const u of m) { const url = u.replace(/^url\(["']?|["']?\)$/g, ""); if (/^data:image\/svg/.test(url) && url.length < 400) continue; bgs.push({ url, rect: r, vis: vis(el) && r.width > 8 && r.height > 8, size: c.backgroundSize, pos: c.backgroundPosition, el: el.className.toString().slice(0, 40) }); } }
  const loaded = await Promise.all(bgs.map(b => new Promise(res => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res(null); i.src = b.url; setTimeout(() => res(null), 8000); })));
  bgs.forEach((b, k) => media.push({ kind: "bg", src: b.url.replace(location.origin + "/", "").slice(0, 90), loaded: !!loaded[k], nat: loaded[k] || [0, 0], rect: [Math.round(b.rect.left), Math.round(b.rect.top + scrollY), Math.round(b.rect.width), Math.round(b.rect.height)], visible: b.vis, fit: b.size, pos: b.pos, visFrac: null }));
  // محتوى الـHero (نصوص/أزرار/وسائط ظاهرة) لقياس الفجوات الرأسية
  const VH = innerHeight; for (const m of media) { const t0 = m.rect[1], t1 = m.rect[1] + m.rect[3]; const inter = Math.max(0, Math.min(t1, VH) - Math.max(t0, 0)); m.fold = m.rect[3] > 0 ? +(inter / m.rect[3]).toFixed(2) : 0; m.foldW = m.rect[2]; }
  const occ = []; const t = hero.querySelectorAll("h1,h2,h3,h4,p,a,button,span,li,input,label,.pb-w"); for (const el of t) { if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 6) continue; const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 0); if (hasText || /^(A|BUTTON|INPUT)$/.test(el.tagName)) occ.push([r.top, r.bottom]); }
  for (const el of hero.querySelectorAll("div,section,figure,aside")) { if (!vis(el)) continue; const c = getComputedStyle(el), r = el.getBoundingClientRect(); const bgc = c.backgroundColor.match(/rgba?\(([^)]+)\)/); const a = bgc ? (bgc[1].split(",").length > 3 ? parseFloat(bgc[1].split(",")[3]) : 1) : 0; if ((a > 0.12 || (c.backgroundImage && c.backgroundImage !== "none") || /solid/.test(c.borderTopStyle) && parseFloat(c.borderTopWidth) >= 1) && r.height >= 60 && r.width >= 100 && r.width < hr.width * 0.97) occ.push([r.top, r.bottom]); }
  for (const m of media) if (m.visible && m.rect[2] > 30 && m.rect[3] > 30 && !(m.kind === "bg" && m.rect[2] >= hr.width * 0.95 && m.rect[3] >= hr.height * 0.95)) occ.push([m.rect[1] - scrollY, m.rect[1] - scrollY + m.rect[3]]);
  occ.sort((a, b) => a[0] - b[0]); let gap = 0, topGap = 0, botGap = 0, cur = null; const lim = hr.bottom; for (const [a, b] of occ) { if (b < hr.top || a > lim) continue; if (cur === null) { topGap = Math.max(0, a - hr.top); cur = b; continue; } gap = Math.max(gap, a - cur); cur = Math.max(cur, b); } botGap = cur === null ? hr.height : Math.max(0, lim - cur);
  const hs = [...hero.querySelectorAll("h1,h2,h3,h4,.pb-hd,.pb-t")].filter(e => vis(e) && e.textContent.trim().length > 2).sort((a, b) => (b.tagName === "H1") - (a.tagName === "H1") || parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize)); const h = hs[0] || null; const ht = h ? h.getBoundingClientRect() : null;
  return { idx, hero: H, media, maxGap: Math.round(gap), topGap: Math.round(topGap), botGap: Math.round(botGap), heading: h ? { text: h.textContent.trim().slice(0, 60), visible: vis(h), w: Math.round(ht.width), h: Math.round(ht.height) } : null, over: document.documentElement.scrollWidth - document.documentElement.clientWidth, vw };
};
(async () => {
  const br = await chromium.launch(), actx = await br.newContext({ viewport: { width: 1360, height: 900 } }); await declareProtect(actx); const admin = await actx.newPage();
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await sleep(4000); await admin.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await admin.waitForFunction(() => typeof Admin !== "undefined" && typeof PB !== "undefined" && Admin.products && Admin.products.length, null, { timeout: 60000 }); await sleep(2500);
  const idx = await admin.evaluate(async () => (await (await fetch("assets/pages/templates/index.json", { cache: "no-store" })).json()).map(x => ({ id: x.id, cat: x.cat, file: x.file || x.id })));
  const list = idx.filter(x => !IDS || IDS.includes(x.id));
  for (const t of list) {
    const html = await admin.evaluate(async file => { const r = await fetch("assets/pages/templates/" + file + ".json", { cache: "no-store" }); const pg = PB.migrate(await r.json()); const slug = ((Admin.products || [])[0] || {}).slug || ""; pg.product = slug; pg.slug = "ha"; return PB.fullHtml(pg, { base: "", baseHref: location.origin + "/", edit: false, path: "", demo: true, products: (Admin.products || []), pageProduct: slug, site: { name: "متجرك", wa: "213555000000" } }); }, t.file);
    const isSection = t.cat === "contact" || t.cat === "order"; const R = { id: t.id, cat: t.cat, dev: {} }; report.push(R);
    for (const w of [1360, 390]) {
      const mob = w < 600, c = await br.newContext({ viewport: { width: w, height: mob ? 844 : 900 }, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 2 : 1, serviceWorkers: "block" }); await declareProtect(c); const p = await c.newPage(), net = [], errs = [];
      p.on("pageerror", e => errs.push(e.message.slice(0, 100))); p.on("response", r => { if (r.status() >= 400 && r.url().startsWith(BASE) && !/favicon|\/api\/|manifest|sw\.js|checkout\.json/.test(r.url()) && !r.url().endsWith("__ha.html")) net.push(r.status() + " " + r.url().replace(BASE, "").slice(0, 70)); }); p.on("requestfailed", r => { if (r.url().startsWith(BASE) && !/favicon|\/api\//.test(r.url())) net.push("FAILED " + r.url().replace(BASE, "").slice(0, 70)); });
      const route = BASE + "/__ha.html"; await p.route(route, r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html })); try { await p.goto(route, { waitUntil: "load", timeout: 60000 }); } catch (e) { }
      await sleep(1500); await p.evaluate(async () => { for (let y = 0; y < Math.min(document.body.scrollHeight, 3000); y += 350) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } window.scrollTo(0, 0); }); await sleep(900);
      const heroIdx = w === 390 && R.dev[1360] ? R.dev[1360].idx : null; const probe = await p.evaluate(PROBE, [heroIdx, NONHERO]); probe.net = net.slice(0, 5); probe.errs = errs.slice(0, 3); R.dev[w] = probe;
      try { await p.screenshot({ path: path.join(OUT, `${t.id}__${w}.png`), fullPage: true, clip: { x: 0, y: 0, width: w, height: Math.min(mob ? 1500 : 1000, 99999) } }); } catch (e) { try { await p.screenshot({ path: path.join(OUT, `${t.id}__${w}.png`) }); } catch (e2) { } }
      await c.close();
    }
    // ── تقييم ──
    const D = R.dev[1360], M = R.dev[390];
    if (isSection) { ck(t.id, "قالب قسم (اتصال/طلب): لا Hero مطلوب — يُفحص بلا أخطاء شبكة ولا تعدٍّ أفقي", (D.net.length + M.net.length) === 0 && M.over <= 0, { d: D.net, m: M.net, over: M.over }); continue; }
    ck(t.id, "يوجد قسم Hero (أول قسم محتوى بعد الهيدر)", D.idx >= 0 && M.idx >= 0, { d: D.idx, m: M.idx }); if (D.idx < 0 || M.idx < 0) continue;
    const good = m => m.filter(x => x.visible && x.loaded && x.rect[2] >= 120 && x.rect[3] >= 120 && !(x.kind === "img" && x.rect[2] < 160 && x.rect[3] < 160)), gd = good(D.media), gm = good(M.media);
    const aboveD = gd.filter(x => x.fold >= 0.35), aboveM = gm.filter(x => x.fold >= 0.35);
    ck(t.id, "حاسوب: صورة Hero ظاهرة ومحمَّلة فعلاً (naturalWidth>0)", gd.length > 0, D.media.map(x => [x.kind, x.visible, x.loaded, x.rect.slice(2)].join(":")));
    ck(t.id, "هاتف 390: صورة Hero ظاهرة ومحمَّلة فعلاً (ليست مخفية ولا مساحة فارغة)", gm.length > 0, M.media.map(x => [x.kind, x.visible, x.loaded, x.rect.slice(2)].join(":")));
    ck(t.id, "حاسوب: صورة Hero تظهر داخل الشاشة الأولى (≥35% منها فوق خط الطيّ)", aboveD.length > 0, gd.map(x => [x.src.split("/").pop(), "fold=" + x.fold, "y=" + x.rect[1]].join(" ")));
    ck(t.id, "هاتف: صورة Hero تظهر داخل الشاشة الأولى 390×844 (≥35% منها فوق خط الطيّ) لا أسفل النص", aboveM.length > 0, gm.map(x => [x.src.split("/").pop(), "fold=" + x.fold, "y=" + x.rect[1]].join(" ")));
    const hidden = D.media.filter(x => x.visible && x.loaded && x.rect[2] >= 120).filter(x => { const mm = M.media.find(y => y.src === x.src); return !mm || !mm.visible || mm.rect[2] < 40 || mm.rect[3] < 40; });
    ck(t.id, "لا وسيط Hero يُخفى على الهاتف وهو ظاهر على الحاسوب (CSS/Media Query)", hidden.length === 0, hidden.map(x => x.src));
    const fullBg = m => m.media.some(x => x.kind === "bg" && x.visible && x.loaded && x.rect[2] >= m.vw * 0.95 && x.rect[3] >= m.hero.h * 0.95);      // صورة خلفية تغطي الـHero كله: لا «فراغ» فيه (الصورة هي المحتوى)
    ck(t.id, "هاتف: لا فراغ رأسي كبير بلا محتوى بين عناصر Hero (≤120px) ولا في أعلاه/أسفله (≤240px)" + (fullBg(M) ? " (Hero بصورة خلفية كاملة)" : ""), fullBg(M) || (M.maxGap <= 120 && M.topGap <= 240 && M.botGap <= 240), { inner: M.maxGap, top: M.topGap, bottom: M.botGap, h: M.hero.h });
    ck(t.id, "حاسوب: لا فراغ رأسي كبير بلا محتوى داخل Hero (≤240px)", D.maxGap <= 240 && D.topGap <= 300 && D.botGap <= 300, { inner: D.maxGap, top: D.topGap, bottom: D.botGap, h: D.hero.h });
    ck(t.id, "لا أخطاء شبكة ولا JS ولا تعدٍّ أفقي (حاسوب/هاتف)", D.net.length + M.net.length + D.errs.length + M.errs.length === 0 && M.over <= 0 && D.over <= 0, { d: D.net, m: M.net, e: D.errs.concat(M.errs), over: [D.over, M.over] });
    ck(t.id, "عنوان Hero ظاهر بحجم مقروء على الهاتف", !!M.heading && M.heading.visible && M.heading.w > 120 && M.heading.h > 14, M.heading);
    const crop = gm.filter(x => x.visFrac !== null && x.visFrac < 0.5); R.cropWarn = crop.map(x => ({ src: x.src, visFrac: x.visFrac, pos: x.pos }));
  }
  fs.writeFileSync(path.join(OUT, "hero-report.json"), JSON.stringify(report, null, 1));
  console.log(`\n${fail ? fail + " إخفاق: " + failures.join(" | ") : "✓ كل الفحوص نجحت"} (${pass} نجاح)`); await br.close(); process.exit(fail ? 1 : 0);
})();
