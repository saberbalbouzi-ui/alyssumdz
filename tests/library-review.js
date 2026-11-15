// مراجعة تكامل مكتبة القوالب في المحرّر الحقيقي بعد الدفعات الأربع (فهرس + مكتبة + محرّر + معاينات + تثبيت). لا تغيّر شيئاً ولا تنشر:
//   1) واجهة المكتبة: بطاقة لكل قالب، معاينة مصغّرة تُحمَّل، أزرار (معاينة/تعديل/تثبيت)، فلاتر الميدان والنوع، البحث بالاسم
//   2) لكل قالب: فتحه في المطوّر (أنواع كل العناصر مسجَّلة)، عرضه كما يُنشر بـ3 أعراض (لا تعدٍّ أفقياً بـclientWidth، لا أخطاء JS، لا صور/ملفات 404)
//   3) قوالب المتاجر: «المعاينة الحقيقية» TplSite: الرئيسية ← المتجر ← صفحة منتج ← الحساب
//   4) نافذة «تثبيت القالب» تعرض الخيارات الصحيحة لنوعه
// التشغيل: EQA_BASE EQA_PASS EQA_OUT ، LR_IDS=… لتحديد قوالب بعينها
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.env.EQA_BASE || "http://127.0.0.1:8391";
const PW = process.env.EQA_PASS || "TestPass12345";
const OUT = process.env.EQA_OUT || "/tmp";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = []; const notes = [];
const check = (id, name, cond, extra) => { results.push(!!cond); console.log((cond ? "PASS " : "FAIL ") + `[${id}] ${name}` + (extra !== undefined && extra !== "" ? "  — " + String(extra).slice(0, 240) : "")); };
// قيم تعدٍّ أفقي على الجوال موجودة في الأصل c83b917 بالقيمة نفسها (موثّقة في docs/batches/batch3): لا تُعدّ إخفاقاً جديداً لكنها تُسجَّل
const KNOWN_OVERFLOW = { "s-watches": 3, "s-cosmetics": 4 };

(async () => {
  const browser = await chromium.launch();
  const mk = async (w = 1360, h = 900) => { const c = await browser.newContext({ userAgent: UA, viewport: { width: w, height: h } }); await c.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); }); return c; };
  const ctx = await mk(); const admin = await ctx.newPage(); admin.on("dialog", d => d.accept());
  const jsErrs = []; admin.on("pageerror", e => jsErrs.push(e.message.slice(0, 160)));
  const bad404 = new Set(); admin.on("response", r => { if (r.status() >= 400 && r.url().startsWith(BASE) && /\/assets\/(img|pages|css|js)\//.test(r.url())) bad404.add(r.status() + " " + r.url().replace(BASE, "")); });
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await sleep(4000);
  await admin.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 });
  await admin.waitForFunction(() => typeof Admin !== "undefined" && typeof AdminNav !== "undefined" && typeof PBApp !== "undefined" && typeof PB !== "undefined" && typeof TplSite !== "undefined", null, { timeout: 60000 }); await sleep(2500);

  // ── 1) واجهة المكتبة ──
  await admin.evaluate(async () => { await AdminNav.libOpen(); }); await sleep(800);
  const items = await admin.evaluate(async () => { const idx = await (await fetch("assets/pages/templates/index.json", { cache: "no-store" })).json(); return AdminNav.libItems().map(x => ({ id: x.id, cat: x.cat, fld: x.fld, n: x.n, adv: false, alyssum: !!x.alyssum })).concat(idx.map(x => ({ id: x.id, cat: x.cat, fld: x.fld, n: x.n, adv: true, alyssum: !!x.alyssum || x.id === "s-alyssum" }))); });
  const only = process.env.LR_IDS ? process.env.LR_IDS.split(",") : null;
  console.log("قوالب المكتبة:", items.length, "— فهرس:", items.filter(x => x.adv).length, "— مدمجة:", items.filter(x => !x.adv).length);
  const cards = await admin.locator("#tl-lib .tl-c").count();
  check("lib", "بطاقة لكل قالب في المكتبة", cards === items.length, `${cards} بطاقة / ${items.length} قالباً`);
  for (let y = 0; y < 60; y++) { await admin.evaluate(() => { const b = document.querySelector("#tl-lib .tl-body") || document.querySelector("#tl-lib .tl-box"); if (b) b.scrollTop += 700; }); await sleep(120); }
  await sleep(1500);
  const th = await admin.evaluate(() => [...document.querySelectorAll("#tl-lib .tl-c")].map(c => { const i = c.querySelector(".tl-th img"); return { t: (c.querySelector("b,h4,.tl-n") || c).textContent.trim().slice(0, 30), ok: !!i && i.complete && i.naturalWidth > 0, cls: c.querySelector(".tl-th") && c.querySelector(".tl-th").className }; }));
  const noThumb = th.filter(x => !x.ok); check("lib", "كل معاينة مصغّرة تُحمَّل في البطاقة", noThumb.length === 0, noThumb.map(x => x.t).join(" | "));
  const acts = await admin.evaluate(() => [...document.querySelectorAll("#tl-lib .tl-c")].map(c => ({ p: !!c.querySelector("[onclick*=tplPreview]"), e: !!c.querySelector("[onclick*=tplEdit]"), i: !!c.querySelector("[onclick*=tplInstall]") })));
  check("lib", "كل بطاقة فيها معاينة وتعديل وتثبيت", acts.every(a => a.p && a.e && a.i), acts.filter(a => !(a.p && a.e && a.i)).length + " ناقصة");
  const typeOpts = await admin.evaluate(() => [...document.querySelectorAll("#tl-lib .tl-fb select")][1] ? [...[...document.querySelectorAll("#tl-lib .tl-fb select")][1].options].map(o => o.value) : []);
  const catOf = { full: "store", pages: "page", order: "order", contact: "contact" };
  for (const tv of typeOpts.filter(v => v !== "all")) {
    await admin.evaluate(v => { AdminNav.libSet("type", v); }, tv); await sleep(300);
    const n = await admin.locator("#tl-lib .tl-c").count(); const exp = items.filter(x => x.cat === catOf[tv]).length;
    check("lib", `فلتر النوع «${tv}» يعرض ${exp}`, n === exp, `${n}`);
  }
  await admin.evaluate(() => AdminNav.libSet("type", "all")); await sleep(200);
  const flds = [...new Set(items.map(x => x.fld))];
  let fldOk = true; for (const f of flds) { await admin.evaluate(v => AdminNav.libSet("fld", v), f); await sleep(200); const n = await admin.locator("#tl-lib .tl-c").count(); if (n !== items.filter(x => x.fld === f).length) { fldOk = false; console.log("  فلتر ميدان خاطئ:", f, n); } }
  check("lib", `فلتر الميدان (${flds.length} ميداناً) يطابق الفهرس`, fldOk);
  await admin.evaluate(() => AdminNav.libSet("fld", "all")); await sleep(200);
  let sOk = true; const sMiss = [];
  for (const it of items) { await admin.evaluate(q => AdminNav.libSet("q", q), it.n); await sleep(120); const has = await admin.evaluate(n => [...document.querySelectorAll("#tl-lib .tl-c")].some(c => c.textContent.includes(n)), it.n); if (!has) { sOk = false; sMiss.push(it.id); } }
  check("lib", "البحث بالاسم يجد كل قالب", sOk, sMiss.join(","));
  await admin.evaluate(() => { AdminNav.libSet("q", ""); AdminNav.libClose(); }); await sleep(300);

  // ── 2) كل قالب: محرّر + عرض منشور + معاينة حقيقية + نافذة التثبيت ──
  const wTypes = await admin.evaluate(() => Object.keys(PB.WIDGETS));
  const perId = [];
  for (const it of items) {
    if (only && !only.includes(it.id)) continue;
    const id = it.id; console.log("\n════════ " + id + " (" + it.cat + ") ════════");
    const j0 = jsErrs.length;
    const info = await admin.evaluate(async id => {
      try { await AdminNav.tplEdit(id); } catch (e) { return { err: e.message }; }
      for (let i = 0; i < 40 && !(PBApp.E && PBApp.E.page); i++) await new Promise(r => setTimeout(r, 250));
      if (!(PBApp.E && PBApp.E.page)) return { err: "لم يفتح المطوّر" };
      const pg = PBApp.E.page, ws = []; const walk = n => { (n.cols || []).forEach(walk); (n.widgets || []).forEach(w => ws.push(w.type)); (n.free || []).forEach(w => ws.push(w.type)); }; pg.sections.forEach(walk);
      return { secs: pg.sections.length, types: ws, json: JSON.stringify(pg) };
    }, id);
    check(id, "يُفتح في المطوّر", !info.err && info.secs > 0, info.err || `${info.secs} قسم، ${info.types.length} عنصراً`);
    if (info.err) continue;
    const unk = [...new Set(info.types)].filter(t => !t || !wTypes.includes(t));
    check(id, "كل أنواع العناصر مسجَّلة في المطوّر", unk.length === 0, unk.join(","));
    const html = await admin.evaluate(([pgJson]) => { const pg = PB.migrate(JSON.parse(pgJson)); const slug = ((Admin.products || [])[0] || {}).slug || ""; pg.product = slug; pg.slug = "lr"; return PB.fullHtml(pg, { base: "", baseHref: location.origin + "/", edit: false, path: "", demo: true, products: (Admin.products || []), pageProduct: slug, site: { name: "متجرك", wa: "213555000000" } }); }, [info.json]);
    const route = BASE + "/__lr.html"; const pw = {};
    for (const w of [1360, 820, 390]) {
      const c = await mk(w, 900); const p = await c.newPage(); const errs = [], miss = []; p.on("pageerror", e => errs.push(e.message.slice(0, 120)));
      p.on("response", r => { if (r.status() >= 400 && r.url().startsWith(BASE) && !r.url().endsWith("__lr.html") && !/favicon|\/api\//.test(r.url())) miss.push(r.status() + " " + r.url().replace(BASE, "").slice(0, 70)); });
      await p.route(route, r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }));
      await p.goto(route, { waitUntil: "load", timeout: 60000 }); await sleep(1500);
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 130)); } window.scrollTo(0, 0); }); await sleep(600);
      const m = await p.evaluate(() => ({ h: document.documentElement.scrollHeight, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      pw[w] = m;
      const known = w === 390 && KNOWN_OVERFLOW[id] === m.over && m.over > 0;
      check(id, `عرض منشور ${w}px بلا تعدٍّ أفقي`, m.over <= 0 || known, `over=${m.over} h=${m.h}${known ? " (قائم في الأصل c83b917 بالقيمة نفسها)" : ""}`);
      if (known) notes.push(`${id}@390: ${m.over}px قائم في الأصل`);
      if (errs.length) check(id, `لا أخطاء JS عند ${w}px`, false, errs.join(" | "));
      if (miss.length) check(id, `لا ملفات مفقودة (404) عند ${w}px`, false, [...new Set(miss)].slice(0, 3).join(" | "));
      await c.close();
    }
    if (it.cat === "store" && !it.alyssum) {
      const tp = await admin.evaluate(async id => {
        const out = { pages: [] }; try { await TplSite.open(id); } catch (e) { return { err: e.message }; }
        const f = document.getElementById("spv-frame");
        const wait = async () => { for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 250)); try { const d = f.contentDocument; if (d && d.body && d.body.innerText.trim().length > 40 && d.readyState === "complete") return true; } catch (e) { } } return false; };
        const snap = async name => { const ok = await wait(); const d = f.contentDocument; out.pages.push({ name, ok, secs: d ? d.querySelectorAll("section,.pb-sec").length : 0, len: d ? d.body.innerText.length : 0, title: document.getElementById("spv-title").textContent }); };
        await snap("home");
        for (const [name, href] of [["shop", "shop.html"], ["product", "p/demo-1/"], ["account", "account.html"]]) { try { f.contentWindow.eval("parent.postMessage({tplNav:" + JSON.stringify(href) + "},'*')"); } catch (e) { } await new Promise(r => setTimeout(r, 600)); await snap(name); }
        SitePreview.close(); return out;
      }, id);
      check(id, "المعاينة الحقيقية: الرئيسية ← المتجر ← صفحة منتج ← الحساب تُبنى كلها", !tp.err && tp.pages.length === 4 && tp.pages.every(x => x.ok && x.len > 40), tp.err || tp.pages.map(x => `${x.name}:${x.len}`).join(" "));
      if (!tp.err) check(id, "عناوين صفحات المعاينة تتبدّل (تنقّل فعلي)", new Set(tp.pages.map(x => x.title)).size >= 3, tp.pages.map(x => x.title.replace(/^معاينة:.*— /, "")).join(" | "));
    } else {
      const pv = await admin.evaluate(async id => { try { await AdminNav.tplPreview(id); await new Promise(r => setTimeout(r, 1200)); const f = document.getElementById("spv-frame"), ok = !!(f && (f.srcdoc || "").length > 500); SitePreview.close(); return ok; } catch (e) { return "ERR " + e.message; } }, id);
      check(id, "المعاينة الحقيقية تفتح", pv === true, pv);
    }
    const dlg = await admin.evaluate(async id => { AdminNav.tplInstall(id); await new Promise(r => setTimeout(r, 300)); const d = document.getElementById("tl-inst"), t = d ? d.innerText : ""; if (d) d.style.display = "none"; return t; }, id);
    const want = it.cat === "store" ? (it.alyssum ? ["الصفحة الرئيسية"] : ["الصفحة الرئيسية", "صفحات المنتجات"]) : ["صفحة جديدة"];
    check(id, "نافذة التثبيت تعرض خيارات نوعه", want.every(w => dlg.includes(w)), dlg.replace(/\s+/g, " ").slice(0, 100));
    const newErr = jsErrs.slice(j0); if (newErr.length) check(id, "لا أخطاء JS في المحرّر أثناء الفتح والمعاينة", false, [...new Set(newErr)].slice(0, 2).join(" | "));
    perId.push({ id, cat: it.cat, secs: info.secs, widgets: info.types.length, h1360: pw[1360].h, h390: pw[390].h });
  }
  console.log("\nملفات assets مفقودة أثناء الجلسة (لوحة الإدارة):", bad404.size ? [...bad404].slice(0, 8).join(" | ") : "لا شيء");
  // قائم في الأصل (c83b917) وخارج النطاق (s-alyssum لا يُمسّ): في حزمة العميل تُعاد تسمية علم alyssum إلى store في الكود لا في index.json، فيُجرَّب لقالب أليسوم جلد منتج غير موجود
  const knownS = [...bad404].filter(u => /prod-s-alyssum\.json/.test(u)); knownS.forEach(u => notes.push("معروف وخارج النطاق: " + u));
  const real404 = [...bad404].filter(u => !/prod-s-alyssum\.json/.test(u));
  check("session", "لا طلبات 404 لملفات assets أثناء مراجعة المكتبة (عدا المعروف أعلاه)", real404.length === 0, real404.slice(0, 5).join(" | "));
  fs.writeFileSync(OUT + "/library-review-results.json", JSON.stringify({ results, perId, notes, jsErrs: jsErrs.slice(0, 20) }, null, 1));
  console.log("\nJS errors (admin):", jsErrs.length); [...new Set(jsErrs)].slice(0, 6).forEach(e => console.log("   " + e));
  if (notes.length) console.log("ملاحظات:", notes.join(" ; "));
  const bad = results.filter(r => !r).length; console.log(`\n${results.length - bad}/${results.length} PASS — ${bad} FAILURES`);
  await browser.close(); process.exit(bad ? 1 : 0);
})();
