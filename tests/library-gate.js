// بوابة جودة قوالب المكتبة كما تصل التاجر (يُشغَّل على متجر مُحدَّث من حزمة الإصدار الفعلية):
//  A) كل قالب: عناصر مطوّر أصلية فقط (بلا عنصر html ولا <script>/<iframe>/<form>/onclick داخل النصوص)، ويُصيَّر بلا أخطاء.
//  B) النماذج: كل <form> في الصفحة المصيَّرة هو نموذج المنصة (طلب #order-form أو اتصال pb-cf) وبلا action خارجي.
//  C) الولايات والبلديات: كل ولاية (58) × كل بلدية تُحمَّل وتُحتسب رسوم التوصيل في نموذج الطلب الأصلي، بلا أخطاء JS.
//  D) الهاتف (390): كل الصور تُحمَّل (naturalWidth>0)، بلا استجابة ≥400 لصورة، بلا تمرير أفقي، لا صورة أعرض من الشاشة.
//  E) الروابط: كل رابط داخلي يصل (200) أو مرساة موجودة؛ لا رابط/نص يشير إلى موقع البائع (alyssumdz، مشروع Supabase، حساب GitHub، أرقام/بريد البائع).
// التشغيل: GATE_BASE=http://127.0.0.1:8394 GATE_PASS=… GATE_OUT=/tmp/gate NODE_PATH=… node tests/library-gate.js   (GATE_IDS=a,b لتحديد قوالب؛ GATE_BROWSER=firefox|webkit)
const pw = require("playwright"); const declareProtect = require("./_declared-protect"); const fs = require("fs"), path = require("path");
const BASE = process.env.GATE_BASE, PASS = process.env.GATE_PASS || "TestPass12345", OUT = process.env.GATE_OUT || "/tmp/gate", IDS = process.env.GATE_IDS ? process.env.GATE_IDS.split(",") : null, BR = process.env.GATE_BROWSER || "chromium";
const sleep = ms => new Promise(r => setTimeout(r, ms)); fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const failures = [], report = []; const ck = (t, n, ok, d) => { if (ok) pass++; else { fail++; failures.push(t + ": " + n); } const line = `${ok ? "PASS" : "FAIL"} [${t}] ${n}${d !== undefined && (!ok || process.env.GATE_VERBOSE) ? "  — " + JSON.stringify(d).slice(0, 400) : ""}`; console.log(line); report.push(line); };
const PRIVATE = /alyssumdz|qvdaiundlkfbmjlummni|saberbalbouzi|balbouzi|supabase\.co|raw\.githubusercontent\.com|أليسوم/i;
(async () => {
  const br = await pw[BR].launch(); const actx = await br.newContext({ viewport: { width: 1360, height: 900 } }); await declareProtect(actx); const admin = await actx.newPage(); admin.on("dialog", d => d.accept());
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await sleep(4000); await admin.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PASS); await sleep(3500);
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await admin.waitForFunction(() => typeof Admin !== "undefined" && typeof PB !== "undefined" && Admin.products && Admin.products.length, null, { timeout: 60000 }); await sleep(2500);
  const idx = (await admin.evaluate(async () => (await (await fetch("assets/pages/templates/index.json", { cache: "no-store" })).json()).map(x => ({ id: x.id, cat: x.cat, file: x.file || x.id })))).filter(x => !IDS || IDS.includes(x.id));
  const wTypes = await admin.evaluate(() => Object.keys(PB.WIDGETS)); const slug = await admin.evaluate(() => Admin.products[0].slug);
  console.log(`متصفح: ${BR} — ${idx.length} قالباً`);
  const renderIn = async (t, w) => {      // يصيّر القالب كما يُنشر ويفتحه في صفحة مستقلة
    const html = await admin.evaluate(async ([file, slug]) => { const r = await fetch("assets/pages/templates/" + file + ".json", { cache: "no-store" }); const pg = PB.migrate(await r.json()); pg.product = slug; pg.slug = "gate"; return PB.fullHtml(pg, { base: "", baseHref: location.origin + "/", edit: false, path: "", demo: false, products: (Admin.products || []), pageProduct: slug, site: { name: "Mystore", wa: "213000000000" } }); }, [t.file, slug]);
    const mob = w < 600, c = await br.newContext({ viewport: { width: w, height: mob ? 844 : 900 }, isMobile: mob && BR !== "firefox", hasTouch: mob && BR !== "firefox", deviceScaleFactor: 1, serviceWorkers: "block" }); await declareProtect(c); const p = await c.newPage(); const route = BASE + "/__gate.html"; const errs = [], bad = [];
    p.on("pageerror", e => errs.push(String(e.message).slice(0, 100))); p.on("response", r => { const u = r.url(); if (r.status() >= 400 && u.startsWith(BASE)) bad.push(r.status() + " " + u.replace(BASE, "").slice(0, 80)); });
    await p.route(route, r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html })); try { await p.goto(route, { waitUntil: "load", timeout: 60000 }); } catch (e) { } await sleep(1200);
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 350) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } window.scrollTo(0, 0); }); await sleep(900);
    return { c, p, errs, bad, html };
  };
  const linkOk = {}; const getStatus = async u => { if (linkOk[u] !== undefined) return linkOk[u]; try { const r = await fetch(u, { redirect: "follow" }); linkOk[u] = r.status; } catch (e) { linkOk[u] = 0; } return linkOk[u]; };
  const sheets = [];
  for (const t of idx) {
    // ── A: بنية القالب ──
    const st = await admin.evaluate(async ([file, wt]) => { const j = await (await fetch("assets/pages/templates/" + file + ".json", { cache: "no-store" })).json(); const types = [], strs = []; let canvas = 0, flow = 0;
      const walk = (o, d) => { if (Array.isArray(o)) o.forEach(x => walk(x, d)); else if (o && typeof o === "object") { if (typeof o.type === "string" && o.id && (o.set || o.type)) types.push(o.type); if (o.kind === "canvas" || Array.isArray(o.free)) canvas++; for (const k of Object.keys(o)) walk(o[k], d + 1); } else if (typeof o === "string") strs.push(o); }; walk(j.sections || j, 0); (j.sections || []).forEach(s => { if (!(s.kind === "canvas" || Array.isArray(s.free))) flow++; });
      return { types, unk: [...new Set(types)].filter(x => !wt.includes(x)), html: types.filter(x => x === "html" || x === "code" || x === "embed").length, bad: strs.filter(s => /<script|<iframe|<form\b|\son[a-z]+\s*=|javascript:/i.test(s)).map(s => s.slice(0, 60)).slice(0, 3), priv: strs.filter(s => /alyssumdz|qvdaiundlkfbmjlummni|saberbalbouzi|balbouzi|supabase\.co|raw\.githubusercontent\.com|أليسوم/i.test(s)).map(s => s.slice(0, 70)).slice(0, 3), canvas, flow }; }, [t.file, wTypes]);
    ck(t.id, "A: عناصر مطوّر أصلية فقط (بلا html/كود/تضمين)", st.html === 0 && st.unk.length === 0, { html: st.html, unk: st.unk });
    ck(t.id, "A: لا <script>/<iframe>/<form>/onclick داخل النصوص", st.bad.length === 0, st.bad);
    ck(t.id, "E: لا إشارة إلى موقع البائع في بيانات القالب", st.priv.length === 0, st.priv);
    // ── B/D/E: التصيير الفعلي ──
    for (const w of [1360, 390]) {
      const R = await renderIn(t, w); const { p } = R;
      const dom = await p.evaluate(() => {
        const forms = [...document.forms].map(f => ({ id: f.id, cls: String(f.className || "").slice(0, 40), action: f.getAttribute("action") || "", ok: !!(f.id === "order-form" || f.closest(".pb-ofraw,.pb-ofm,.pb-cf,.pb-ofr") || /pb-cf/.test(f.className) || f.querySelector(".pb-cf-b")) }));
        const imgs = [...document.images].filter(i => { const cs = getComputedStyle(i); const r = i.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 1 && r.height > 1; }).map(i => ({ src: (i.currentSrc || i.src || "").slice(-60), full: i.currentSrc || i.src || "", ok: i.complete && i.naturalWidth > 0, w: Math.round(i.getBoundingClientRect().width), left: Math.round(i.getBoundingClientRect().left) }));
        const vw = document.documentElement.clientWidth; const wide = imgs.filter(i => i.w > vw + 2).length;
        const as = [...document.querySelectorAll("a[href]")].map(a => a.getAttribute("href")); const ifr = [...document.querySelectorAll("iframe")].map(f => f.src.slice(0, 80));
        const anchors = as.filter(h => /^#./.test(h) && !document.getElementById(h.slice(1)) && !document.getElementsByName(h.slice(1)).length);
        const txt = document.documentElement.outerHTML; return { forms, imgs, wide, as: [...new Set(as)], anchors, ifr, sw: document.documentElement.scrollWidth, vw, priv: (txt.match(/alyssumdz|qvdaiundlkfbmjlummni|saberbalbouzi|balbouzi|raw\.githubusercontent\.com|أليسوم/gi) || []).slice(0, 3) };
      });
      const tag = t.id + "@" + w;
      ck(tag, "لا أخطاء JS في الصفحة", R.errs.length === 0, R.errs);
      ck(tag, "B: كل النماذج هي نماذج المنصة (طلب/اتصال) وبلا action خارجي", dom.forms.every(f => f.ok && !/^https?:\/\//i.test(f.action)) && dom.ifr.length === 0, { forms: dom.forms.filter(f => !f.ok || /^https?:/i.test(f.action)), ifr: dom.ifr });
      const pend = dom.imgs.filter(i => !i.ok); const pendBad = []; for (const i of pend) { const u = i.full; const s2 = await getStatus(u); if (s2 !== 200) pendBad.push(i.src + " → " + s2); }      // صورة كسولة خارج الشاشة (شريط أفقي): يُتحقق أنها تُجلب 200
      ck(tag, "D: كل الصور الظاهرة تُحمَّل (الكسولة خارج الشاشة تُجلب بنجاح)", pendBad.length === 0, pendBad.slice(0, 4));
      ck(tag, "D: لا استجابة 4xx لموارد المتجر (صور/خطوط/سكربتات)", R.bad.length === 0, R.bad.slice(0, 4));
      if (w < 600) ck(tag, "D: لا تمرير أفقي ولا صورة أعرض من الشاشة على الهاتف", dom.sw <= dom.vw + 1 && dom.wide === 0, { sw: dom.sw, vw: dom.vw, wide: dom.wide });
      const rel = dom.as.filter(h => !/^(#|tel:|mailto:|sms:|https?:|whatsapp:|javascript:|data:)/i.test(h) && h !== ""); const ext = dom.as.filter(h => /^https?:/i.test(h));
      const relBad = []; for (const h of [...new Set(rel)]) { const u = new URL(h, BASE + "/").href.split("#")[0]; if (!u.startsWith(BASE)) continue; const s = await getStatus(u); if (!(s >= 200 && s < 400)) relBad.push(h + " → " + s); }
      ck(tag, "E: كل الروابط الداخلية تصل", relBad.length === 0, relBad.slice(0, 5));
      ck(tag, "E: كل مراسي # موجودة في الصفحة", dom.anchors.length === 0, dom.anchors.slice(0, 5));
      ck(tag, "E: روابط خارجية: لا تشير إلى موقع البائع", ext.every(h => !PRIVATE.test(h)) && dom.priv.length === 0, { ext: ext.filter(h => PRIVATE.test(h)), priv: dom.priv });
      const wa = dom.as.filter(h => /wa\.me|whatsapp/i.test(h)); ck(tag, "E: روابط واتساب برقم المتجر فقط (لا رقم البائع)", wa.every(h => /213000000000|213555000000/.test(h) || !/\d{9,}/.test(h)), wa.slice(0, 3));
      if (w === 1360 && await p.locator("#order-form").count()) {      // قوالب فيها نموذج الطلب الأصلي: ولايات (أولى/وسطى/أخيرة) وبلدياتها ورسومها
        const oo = await p.evaluate(async () => { const ws = [...document.querySelectorAll("#wilaya option")].filter(o => o.value).map(o => o.value); const pick = [ws[0], ws[Math.floor(ws.length / 2)], ws[ws.length - 1]], out = []; for (const v of pick) { const el = document.getElementById("wilaya"); el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(r => setTimeout(r, 400)); const cs = [...document.querySelectorAll("#commune option")].filter(o => o.value); const c = document.getElementById("commune"); if (cs.length) { c.value = cs[0].value; c.dispatchEvent(new Event("change", { bubbles: true })); } await new Promise(r => setTimeout(r, 200)); out.push({ w: v, n: cs.length, fee: ((document.getElementById("fee") || {}).textContent || "").trim().slice(0, 20) }); } return { n: ws.length, out }; });
        ck(tag, "C: نموذج الطلب: كل الولايات محمَّلة وبلدياتها ورسومها تعمل", oo.n >= 58 && oo.out.every(x => x.n > 0 && /\d|مجان/.test(x.fee)), oo);
      }
      if (w === 390 && sheets.length < 60) { try { await p.screenshot({ path: path.join(OUT, `${t.id}__390.png`), fullPage: true, timeout: 60000 }); } catch (e) { } }
      report.push(JSON.stringify({ id: t.id, w, ext: ext.slice(0, 20), forms: dom.forms.length, imgs: dom.imgs.length, canvas: st.canvas, flow: st.flow })); await R.c.close();
    }
  }
  // ── C: الولايات والبلديات في نموذج الطلب الأصلي (صفحة المنتج) ──
  const pc = await actx.newPage(); const cerr = []; pc.on("pageerror", e => cerr.push(String(e.message).slice(0, 100))); await pc.goto(BASE + "/p/" + slug + "/", { waitUntil: "load" }); await sleep(3000);
  const wl = await pc.evaluate(() => [...document.querySelectorAll("#wilaya option")].filter(o => o.value).map(o => o.value)); ck("C", "قائمة الولايات تحمّل كل الولايات (58)", wl.length >= 58, wl.length);
  let tot = 0, noCom = [], noFee = [];
  for (const wv of wl) {
    const r = await pc.evaluate(async v => { const w = document.getElementById("wilaya"); w.value = v; w.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(r => setTimeout(r, 250)); const cs = [...document.querySelectorAll("#commune option")].filter(o => o.value).map(o => o.value); const bad = []; for (const c of cs) { const el = document.getElementById("commune"); el.value = c; el.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(r => setTimeout(r, 15)); const f = (document.getElementById("fee") || {}).textContent || ""; if (!/\d/.test(f) && !/مجان|free/i.test(f)) bad.push(c); } return { n: cs.length, bad: bad.length, sample: bad[0] }; }, wv);
    tot += r.n; if (!r.n) noCom.push(wv); if (r.bad) noFee.push(wv + ":" + r.bad + "/" + r.n);
  }
  ck("C", `كل ولاية لها بلديات (${tot} بلدية إجمالاً)`, noCom.length === 0, noCom); ck("C", "رسوم التوصيل تظهر لكل ولاية/بلدية", noFee.length === 0, noFee.slice(0, 8)); ck("C", "لا أخطاء JS أثناء الاختيار", cerr.length === 0, cerr);
  fs.writeFileSync(path.join(OUT, "gate-report.txt"), report.join("\n")); console.log(`\n${fail ? fail + " إخفاق" : "✓ كل الفحوص نجحت"} (${pass} نجاح)`); if (fail) console.log(failures.slice(0, 40).join("\n")); await br.close(); process.exit(fail ? 1 : 0);
})();
