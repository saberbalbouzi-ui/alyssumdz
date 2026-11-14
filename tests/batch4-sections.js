// اختبار وظيفي لأقسام الاتصال والطلب (c-* و o-*) — الدفعة 4. لا يقيس الشكل بل يقيس أن القسم يعمل كما في الأصل:
//   • نموذج الاتصال: تحقق الحقول (إجباري/هاتف جزائري/بريد)، Honeypot، مهلة الإرسال، إرسال واتساب برسالة تحوي كل القيم المدخلة
//   • نموذج الطلب الأصلي (orderorig): يُحمَّل داخل الإطار، ويُرسَل طلب حقيقي إلى المتجر ويظهر في لوحة الإدارة
//   • عدم التعدي الأفقي (clientWidth) في 1360/820/390 وعدم وجود أخطاء JS
// يُشغَّل على الأصل (c83b917) ثم على القوالب الجديدة بالمعايير نفسها (لا يُضعف شيء بين التشغيلين).
// التشغيل: EQA_BASE EQA_PASS EQA_OUT و B4_TPLS=c-aurora,o-flash  و B4_NEW=1 لفحوص الميزات المضافة (قنوات اتصال بروابط حقيقية…)
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.env.EQA_BASE || "http://127.0.0.1:8391";
const PW = process.env.EQA_PASS || "TestPass12345";
const OUT = process.env.EQA_OUT || "/tmp";
const NEW = !!process.env.B4_NEW;
const ALL = ["c-aurora", "c-neon", "c-gold", "c-soft", "c-steps", "o-flash", "o-lux", "o-steps", "o-bundle", "o-proof"];
const TPLS = process.env.B4_TPLS ? process.env.B4_TPLS.split(",") : ALL;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (tpl, name, cond, extra) => { results.push(!!cond); console.log((cond ? "PASS " : "FAIL ") + `[${tpl}] ${name}` + (extra !== undefined && extra !== "" ? "  — " + String(extra).slice(0, 240) : "")); };

(async () => {
  const browser = await chromium.launch();
  const mk = async (w = 1360, h = 900) => { const c = await browser.newContext({ userAgent: UA, viewport: { width: w, height: h } }); await c.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); }); return c; };
  const ctx = await mk(); const admin = await ctx.newPage(); admin.on("dialog", d => d.accept());
  const jsErrs = []; admin.on("pageerror", e => jsErrs.push(e.message.slice(0, 160)));
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await sleep(4000);
  await admin.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 });
  await admin.waitForFunction(() => typeof Admin !== "undefined" && typeof AdminNav !== "undefined" && typeof PBApp !== "undefined" && typeof PB !== "undefined", null, { timeout: 60000 }); await sleep(2500);
  const prod = await admin.evaluate(() => ((Admin.products || [])[0] || {}).slug || "");
  console.log("منتج الاختبار:", prod);
  const placed = [];

  for (const tpl of TPLS) {
    console.log("\n════════ " + tpl + " ════════");
    // 1) فتح القالب في المطوّر (كما يفعل المستخدم: «تعديل القالب») واستخراج الصفحة
    const info = await admin.evaluate(async id => {
      try { if (typeof AdminNav.libOpen === "function") { await AdminNav.libOpen(); AdminNav.libClose(); } await AdminNav.tplEdit(id); } catch (e) { return { err: e.message }; }
      for (let i = 0; i < 40 && !(PBApp.E && PBApp.E.page); i++) await new Promise(r => setTimeout(r, 250));
      if (!(PBApp.E && PBApp.E.page)) return { err: "المطوّر لم يفتح الصفحة" };
      const pg = PBApp.E.page, ws = [];
      const walk = n => { (n.cols || []).forEach(walk); (n.widgets || []).forEach(w => { ws.push({ id: w.id, type: w.type }); }); (n.free || []).forEach(w => ws.push({ id: w.id, type: w.type })); };
      pg.sections.forEach(walk);
      return { n: ws.length, types: [...new Set(ws.map(w => w.type))], untyped: ws.filter(w => !w.type).length, secs: pg.sections.length, json: JSON.stringify(pg) };
    }, tpl);
    check(tpl, "فتح القالب في المطوّر", !info.err && info.n > 0, info.err || `${info.secs} قسم، ${info.n} عنصراً`);
    if (info.err) continue;
    check(tpl, "كل عنصر له نوع ولا عنصر HTML/كود مخصص", info.untyped === 0 && !info.types.includes("html") && !info.types.includes("code") && !info.types.includes("embed"), info.types.join(","));
    const hasContact = info.types.includes("contact"), hasOrder = info.types.includes("orderorig");
    check(tpl, "يحتوي المكوّن الوظيفي الأصلي (contact أو orderorig)", hasContact || hasOrder, hasContact ? "contact" : hasOrder ? "orderorig" : "none");

    // 2) عرض الصفحة كما تُنشر (بلا وضع التحرير) على أصل المتجر نفسه
    const html = await admin.evaluate(([pgJson, slug]) => {
      const pg = PB.migrate(JSON.parse(pgJson)); pg.product = slug; pg.slug = "b4";
      return PB.fullHtml(pg, { base: "", baseHref: location.origin + "/", edit: false, path: "", demo: false, products: (Admin.products || []), pageProduct: slug, site: { name: "متجرك", wa: "213555000000" } });
    }, [info.json, prod]);
    const route = BASE + "/__b4.html";
    for (const w of [1360, 820, 390]) {
      const c = await mk(w, 900); const p = await c.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 140))); p.on("dialog", d => d.accept());
      await p.route(route, r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }));
      await p.goto(route, { waitUntil: "load", timeout: 60000 }); await sleep(1800);
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 350) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 160)); } window.scrollTo(0, 0); }); await sleep(900);
      const m = await p.evaluate(() => ({ h: document.documentElement.scrollHeight, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      check(tpl, `لا تعدٍّ أفقياً عند ${w}px`, m.over <= 0, `over=${m.over} h=${m.h}`);
      if (errs.length) check(tpl, `لا أخطاء JS عند ${w}px`, false, errs.join(" | "));
      await p.screenshot({ path: `${OUT}/${tpl}-${w}.jpg`, fullPage: true, type: "jpeg", quality: 70 }).catch(() => {});

      if (w === 1360) {
        // ── نموذج الاتصال ──
        const nf = await p.locator("form.pb-cf").count();
        if (hasContact) check(tpl, "نموذج الاتصال موجود في الصفحة المنشورة", nf >= 1, nf);
        if (hasContact && nf) {
          const f = p.locator("form.pb-cf").first();
          await p.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(String(u)); return null; }; });
          const submit = async () => { const b = f.locator("button[type=submit]"); await b.evaluate(e => e.scrollIntoView({ block: "center" })); await sleep(150); await b.click({ force: true }); await sleep(350); };
          const msg = () => f.locator(".pb-cf-msg").evaluate(e => ({ t: e.textContent, c: e.className, v: e.style.display }));
          await submit(); let m1 = await msg();
          check(tpl, "إرسال فارغ يُرفض برسالة خطأ ولا يفتح واتساب", /bad/.test(m1.c) && m1.v !== "none" && (await p.evaluate(() => window.__opened.length)) === 0, m1.t);
          const fields = await f.locator("[data-f]").evaluateAll(els => els.map(e => ({ tag: e.tagName, type: e.type, l: e.getAttribute("data-l"), req: e.hasAttribute("data-req"), opts: e.tagName === "SELECT" ? [...e.options].filter(o => o.value).map(o => o.value || o.text) : [] })));
          const sample = { text: "زبون اختبار", tel: "0550123456", email: "qa@example.com", textarea: "رسالة اختبار آلي للقسم", number: "5", date: "2026-12-01" };
          const fill = async (phone) => {
            const els = f.locator("[data-f]"); const n = await els.count(); const used = [];
            for (let i = 0; i < n; i++) {
              const e = els.nth(i), d = fields[i];
              if (d.tag === "SELECT") { if (d.opts.length) { await e.selectOption(d.opts[0]); used.push(d.opts[0]); } }
              else if (d.type === "checkbox") { await e.check(); }
              else { let v = sample[d.type] || sample.text; if (d.type === "tel") v = phone; await e.fill(v); used.push(v); }
            } return used;
          };
          await fill("123"); await submit(); const m2 = await msg();
          const telLabel = (fields.find(x => x.type === "tel") || {}).l || "";
          check(tpl, "هاتف غير جزائري يُرفض", /bad/.test(m2.c) && m2.t.includes(telLabel) && (await p.evaluate(() => window.__opened.length)) === 0, m2.t);
          const hp = f.locator("[name=pbhp]"); await hp.evaluate(e => { e.value = "bot"; });
          await fill("0550123456"); await submit(); const m3 = await msg(); const o3 = await p.evaluate(() => window.__opened.length);
          check(tpl, "حقل Honeypot المملوء لا يُرسل شيئاً", o3 === 0, m3.t);
          await hp.evaluate(e => { e.value = ""; });
          const used = await fill("0550123456"); await submit(); const m4 = await msg(); const op = await p.evaluate(() => window.__opened.slice());
          const txt = op[0] ? decodeURIComponent(op[0].split("?text=")[1] || "") : "";
          check(tpl, "إرسال صحيح يفتح واتساب برسالة تحوي كل القيم المدخلة", op.length === 1 && /wa\.me\/213555000000\?text=/.test(op[0]) && used.every(v => txt.includes(v)), op[0] ? txt.slice(0, 120).replace(/\n/g, " | ") : "لم يُفتح");
          check(tpl, "رسالة النجاح تظهر ويُفرَّغ النموذج", /ok/.test(m4.c) && m4.v !== "none", m4.t);
          await fill("0550123456"); await submit(); const m5 = await msg();
          check(tpl, "مهلة بين إرسالين تمنع التكرار الفوري", /bad/.test(m5.c) && /الانتظار/.test(m5.t), m5.t);
          if (NEW) {
            const links = await p.evaluate(() => ({ tel: document.querySelectorAll('a[href^="tel:"]').length, wa: document.querySelectorAll('a[href*="wa.me"]').length, mail: document.querySelectorAll('a[href^="mailto:"]').length }));
            check(tpl, "قنوات اتصال مباشرة بروابط حقيقية (هاتف + واتساب + بريد)", links.tel >= 1 && links.wa >= 1 && links.mail >= 1, JSON.stringify(links));
            check(tpl, "حقل اختيار موضوع/خدمة داخل النموذج", fields.some(x => x.tag === "SELECT"), fields.map(x => x.tag + ":" + x.l).join(" · "));
          }
        }
        // ── نموذج الطلب الأصلي (طلب حقيقي) ──
        if (hasOrder) {
          const src = await p.locator("iframe.pb-ofr").first().getAttribute("src").catch(() => null);
          check(tpl, "نموذج الطلب الأصلي مضمَّن بمنتج صحيح", !!src && src.includes("order-embed.html?p=" + prod), src);
          const ifr = p.locator("iframe.pb-ofr").first(); await ifr.evaluate(e => e.scrollIntoView({ block: "center" })); await p.waitForFunction(() => { const f = document.querySelector("iframe.pb-ofr"); return f && f.style.visibility !== "hidden"; }, null, { timeout: 30000 }).catch(() => { }); await sleep(4600);
          const fr = p.frameLocator("iframe.pb-ofr").first(); await fr.locator("#order-form").waitFor({ timeout: 20000 }).catch(() => { });
          const humanFill = async (sel, text) => {
            const l = fr.locator(sel); await l.evaluate(e => e.scrollIntoView({ block: "center" })); await sleep(250); const bb = await l.boundingBox(); if (!bb) throw new Error("no box " + sel);
            await p.mouse.move(bb.x + bb.width / 2 - 40, bb.y + bb.height / 2, { steps: 6 }); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 4 });
            await p.mouse.down(); await sleep(70); await p.mouse.up(); await sleep(260); await p.keyboard.type(text, { delay: 60 });
          };
          let ok = false, pm = ""; const nm = "زبون QA", ph = "0550" + String(100000 + Math.floor(Math.random() * 899999));
          try {
            const hasForm = await fr.locator("#order-form").count();
            check(tpl, "نموذج الطلب داخل الإطار يحمل الحقول الأساسية", hasForm && (await fr.locator("#name").count()) && (await fr.locator("#phone").count()) && (await fr.locator("#wilaya").count()), "");
            await humanFill("#name", nm); await sleep(350); await humanFill("#phone", ph); await sleep(350);
            for (const [sel, v] of [["#name", nm], ["#phone", ph]]) { if ((await fr.locator(sel).inputValue()) !== v) { await fr.locator(sel).fill(v); } }
            await fr.locator("#wilaya").selectOption({ index: 5 }); await sleep(1400);
            const com = fr.locator("#commune"); if (await com.count() && (await com.evaluate(s => s.options.length)) > 1) { await com.selectOption({ index: 1 }).catch(() => { }); await sleep(300); }
            const btn = fr.locator('#order-form button[type="submit"]').first(); await btn.evaluate(e => e.scrollIntoView({ block: "center" })); await sleep(500); await btn.click({ timeout: 8000, force: true }); await sleep(4500);
            ok = await fr.locator("#thx").evaluate(t => /تم استلام طلبك/.test(t.innerText)).catch(() => false);
            pm = ok ? "شاشة الشكر ظهرت" : "لا شاشة شكر: " + (await fr.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(-260);
          } catch (e) { pm = e.message.slice(0, 160); }
          if (!ok) await p.screenshot({ path: `${OUT}/${tpl}-order-fail.png`, fullPage: true }).catch(() => { });
          check(tpl, "طلب حقيقي عبر الإطار يُقبل (شاشة الشكر)", ok, pm); if (ok) placed.push({ tpl, ph });
        }
      }
      await c.close();
    }
  }

  // الطلبات الحقيقية ظاهرة في لوحة الإدارة
  if (placed.length) {
    let orders = [];
    for (let i = 0; i < 6; i++) {
      await sleep(2500);
      orders = await admin.evaluate(async () => { try { const r = await API.orders(Admin.key); return ((r && r.orders) || []).map(o => (o.name || o.customer || "") + "|" + (o.phone || "")); } catch (e) { return ["ERR:" + e.message]; } });
      if (placed.every(x => orders.some(o => o.includes(x.ph)))) break;
    }
    for (const x of placed) check(x.tpl, "الطلب الحقيقي ظاهر في لوحة الإدارة", orders.some(o => o.includes(x.ph)), x.ph);
  }
  fs.writeFileSync(OUT + "/batch4-sections-results.json", JSON.stringify({ results, jsErrs: jsErrs.slice(0, 20) }, null, 1));
  console.log("\nJS errors (admin):", jsErrs.length); [...new Set(jsErrs)].slice(0, 6).forEach(e => console.log("   " + e));
  const bad = results.filter(r => !r).length; console.log(`\n${results.length - bad}/${results.length} PASS — ${bad} FAILURES`);
  await browser.close(); process.exit(bad ? 1 : 0);
})();
