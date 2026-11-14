// استبدال الصور عبر مكتبة الوسائط الحقيقية في المحرّر (أحداث فأرة فعلية) لتجربتي s-watches وs-tech.
// يتحقق: (1) الصورة تتبدّل فعلاً من المكتبة (2) إطار الصورة (العرض والارتفاع على الشاشة) لا يتغيّر
// (3) لافتة s-watches: استبدال خلفية القسم لا يغيّر ارتفاعه ويبقى bgFixed/cover (4) Ctrl+Z يعيد الأصل.
// التشغيل: نفس متغيرات البطارية EQA_BASE EQA_STORE EQA_PASS EQA_OUT. ينتج لقطات قبل/بعد في EQA_OUT.
const { chromium } = require("playwright");
const BASE = process.env.EQA_BASE || "http://127.0.0.1:8391";
const PW = process.env.EQA_PASS || "TestPass12345";
const OUT = process.env.EQA_OUT || "/tmp";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const sleep = ms => new Promise(r => setTimeout(r, ms));
// ما يُختبَر لكل قالب: صورة رئيسية (اسم الملف) و/أو قسم بخلفية صورة (اسم الملف). الباقي يُستنتج من النموذج.
const SPEC = {
  "s-watches": { img: "men_watch", bg: "watch_rock" }, "s-tech": { img: "it_color" },
  "s-jewelry": { img: "jewel_ring", bg: "jewel_pearl" }, "s-supplements": { bg: "supp_green" }, "s-accessories": { img: "acc_pink" }, "s-it": { bg: "it_circuit" }, "s-digital": { img: "dig_dash" }, "s-marketplace": { col: "mkt_bags" }, "s-cosmetics": { bg: "cosm_terra" }, "s-honey": { img: "honey_amber" }, "s-herbs": { img: "herb_jars" }, "s-fashion": { img: "fashion_man" },
  "s-aurora": { img: "it_color" }, "s-gold": { bg: "jewel_dark" }, "s-fresh": { img: "skin_oil" }, "s-pop": { img: "fashion_sneakers" },
  "c-aurora": { img: "dig_code" }, "c-neon": { img: "it_dark" }, "c-gold": { img: "jewel_pearl" }, "c-soft": { img: "cosm_pink" }, "c-steps": { img: "mkt_open" }, "o-flash": { img: "mkt_bags" }, "o-lux": { img: "jewel_ring" }, "o-steps": { img: "mkt_open" },
};
const TPLS = process.env.LIB_TPLS ? process.env.LIB_TPLS.split(",") : ["s-watches", "s-tech"];
const results = []; let page;
const check = (tpl, name, cond, extra) => { results.push(!!cond); console.log((cond ? "PASS " : "FAIL ") + `[${tpl}] ${name}` + (extra ? "  — " + String(extra).slice(0, 220) : "")); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1360, height: 900 } });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); });
  page = await ctx.newPage(); page.on("dialog", d => d.accept());
  const jsErrs = []; page.on("pageerror", e => jsErrs.push(e.message.slice(0, 160)));
  await page.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await sleep(4000);
  await page.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
  await page.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 });
  await page.waitForFunction(() => typeof Admin !== "undefined" && typeof AdminNav !== "undefined" && AdminNav.tplInstallHome && typeof PBConvert !== "undefined", null, { timeout: 60000 });
  await sleep(2000);

  const secs = () => page.evaluate(() => PBApp.E.page.sections.map(s => ({ id: s.id, set: s.set, bgImg: s.set && s.set.bgImg, ws: [].concat((s.free || []), ...(s.cols || []).map(c => c.widgets || [])).map(w => ({ id: w.id, type: w.type, set: w.set })), cols: (s.cols || []).map(c => ({ id: c.id, set: c.set, bgImg: c.set && c.set.bgImg, ws: (c.widgets || []).map(w => w.id) })) })));
  const selIs = id => page.evaluate(x => PBApp.E.sel === x, id);
  const clearSel = async () => { for (let i = 0; i < 4; i++) { await page.keyboard.press("Escape"); await sleep(110); } };
  const scrollTo = async id => { await page.evaluate(wid => { const f = document.getElementById("pbx-frame"); const el = f.contentDocument.querySelector(`[data-kind="widget"][data-pb="${wid}"]`); if (!el) return; const fr = f.getBoundingClientRect(), er = el.getBoundingClientRect(); window.scrollTo(0, Math.max(0, window.scrollY + fr.top + er.top - window.innerHeight * 0.3)); }, id); await sleep(350); };
  const clickWidget = async id => {
    await clearSel(); const fr = page.locator("#pbx-frame").contentFrame(); const el = fr.locator(`[data-kind="widget"][data-pb="${id}"]`);
    for (const [fx, fy] of [[.5, .5], [.3, .5], [.7, .5], [.5, .3], [.5, .7]]) {
      await scrollTo(id); await el.scrollIntoViewIfNeeded().catch(() => {}); await sleep(200);
      const bb = await el.boundingBox(); if (!bb) continue;
      await page.mouse.click(bb.x + bb.width * fx, bb.y + bb.height * fy); await sleep(320); if (await selIs(id)) return true;
    } return false;
  };
  const ensureField = async sel => {
    for (const t of ["c", "s", "a"]) {
      const tab = page.locator(`#pbx-insp [data-itab="${t}"]`); if (await tab.count()) { await tab.click().catch(() => {}); await sleep(300); }
      if (await page.locator(sel).count()) return true;
      const accs = page.locator("#pbx-insp [data-ac]"); const n = await accs.count();
      for (let i = 0; i < n; i++) { await accs.nth(i).click().catch(() => {}); await sleep(220); if (await page.locator(sel).count()) return true; }
    } return !!(await page.locator(sel).count());
  };
  const pickFromLibrary = async () => {     // يعيد مسار الصورة المختارة من تبويب صور المنتجات
    const lib = page.locator("#pbx-lib"); if (!(await lib.count())) return null;
    await lib.locator('[data-t="prod"]').click().catch(() => {}); await sleep(400);
    const item = lib.locator("[data-p]").first(); if (!(await item.count())) return null;
    const picked = await item.getAttribute("data-p"); await item.click(); await sleep(900); return picked;
  };
  const box = async id => { const fr = page.locator("#pbx-frame").contentFrame(); const bb = await fr.locator(`[data-kind="widget"][data-pb="${id}"]`).boundingBox(); return bb && { w: Math.round(bb.width), h: Math.round(bb.height) }; };
  const shot = async (id, name) => { try { const fr = page.locator("#pbx-frame").contentFrame(); await clearSel(); await scrollTo(id); await fr.locator(`[data-kind="widget"][data-pb="${id}"]`).screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 70 }); } catch (e) { } };

  for (const tpl of TPLS) {
    console.log("\n════════ " + tpl + " ════════");
    try {
      await page.evaluate(async ([id, sec]) => { if (typeof AdminNav.libOpen === "function") { await AdminNav.libOpen(); AdminNav.libClose(); } await (sec ? AdminNav.tplEdit(id) : AdminNav.tplInstallHome(id)); }, [tpl, !!process.env.PILOT_SEC]);
      await page.waitForFunction(() => { const f = document.getElementById("pbx-frame"); return f && f.contentDocument && f.contentDocument.querySelector('[data-kind="widget"]'); }, null, { timeout: 40000 }); await sleep(900);
      if (await page.locator("#pbx-ask").count()) await page.click('#pbx-ask [data-k="no"]').catch(() => {}); await sleep(300);
      const sp = SPEC[tpl] || {}; const S0 = await secs(); let hero = null;
      if (sp.img) { for (const s of S0) for (const w of s.ws) if (w.type === "image" && new RegExp(sp.img).test(w.set.src || "")) hero = hero || w; check(tpl, `عُثر على الصورة الرئيسية (${sp.img})`, !!hero, hero && hero.set.src); }
      if (hero) {
      const src0 = hero.set.src, b0 = await box(hero.id); await shot(hero.id, `${tpl}-lib-before`);
      check(tpl, "اختيار الصورة الرئيسية بالفأرة", await clickWidget(hero.id));
      const found = await ensureField('#pbx-insp button[data-lib="src"]');
      check(tpl, "زر مكتبة الوسائط (📚) ظاهر في المفتّش", found);
      let picked = null;
      if (found) { await page.locator('#pbx-insp button[data-lib="src"]').first().click(); await sleep(900); picked = await pickFromLibrary(); }
      check(tpl, "اختيار صورة من المكتبة الحقيقية", !!picked, picked);
      const S1 = await secs(); const w1 = S1.flatMap(s => s.ws).find(w => w.id === hero.id);
      check(tpl, "مصدر الصورة تبدّل فعلاً إلى المختارة", w1 && w1.set.src === picked && picked !== src0, `${src0} → ${w1 && w1.set.src}`);
      const rendered = await page.evaluate(id => { const f = document.getElementById("pbx-frame"); const im = f.contentDocument.querySelector(`[data-kind="widget"][data-pb="${id}"] img`); return im && { src: im.getAttribute("src"), ok: im.complete && im.naturalWidth > 0 }; }, hero.id);
      check(tpl, "الصورة الجديدة تُرسم فعلاً في المحرّر", rendered && rendered.ok && picked && rendered.src.includes(picked.split("/").pop()), rendered && rendered.src);
      const b1 = await box(hero.id); await shot(hero.id, `${tpl}-lib-after`);
      check(tpl, "إطار الصورة لا يتغيّر (العرض والارتفاع على الشاشة)", b0 && b1 && Math.abs(b0.w - b1.w) <= 1 && Math.abs(b0.h - b1.h) <= 1, `${JSON.stringify(b0)} → ${JSON.stringify(b1)}`);
      await clearSel(); await page.keyboard.press("Control+z"); await sleep(600);
      const w2 = (await secs()).flatMap(s => s.ws).find(w => w.id === hero.id);
      check(tpl, "Ctrl+Z يعيد الصورة الأصلية", w2 && w2.set.src === src0, w2 && w2.set.src);
      }

      // خلفية قسم بصورة (لافتة/هيرو/قسم هدايا): تُستبدل من المكتبة بلا تغيّر في ارتفاع القسم أو خصائص الخلفية الأصلية
      if (sp.bg) {
        const S = await secs(); const ban = S.find(s => s.bgImg && new RegExp(sp.bg).test(s.bgImg)); check(tpl, `قسم بخلفية ${sp.bg} الأصلية`, !!ban, ban && JSON.stringify({ f: ban.set.bgFixed, s: ban.set.bgSize }));
        const cs = await page.evaluate(id => { const f = document.getElementById("pbx-frame"); const el = f.contentDocument.querySelector(`.pb-sec[data-pb="${id}"]`); if (!el) return null; const c = getComputedStyle(el); return { att: c.backgroundAttachment, size: c.backgroundSize, h: Math.round(el.getBoundingClientRect().height) }; }, ban.id);
        check(tpl, "خصائص الخلفية الأصلية مرسومة (cover" + (ban.set.bgFixed ? " + fixed" : "") + ")", cs && /cover/.test(cs.size) && (!ban.set.bgFixed || /fixed/.test(cs.att)), JSON.stringify(cs));
        const firstW = ban.ws.find(w => w.type === "heading") || ban.ws.find(w => w.type !== "spacer") || ban.ws[0];
        let kind = ""; check(tpl, "اختيار عنصر داخل القسم بالفأرة", await clickWidget(firstW.id));
        for (let k = 0; k < 3 && kind !== "section"; k++) { await page.keyboard.press("Escape"); await sleep(300); kind = await page.evaluate(() => { const i = PBApp.find(PBApp.E.sel); return i ? i.kind : "none"; }); }
        check(tpl, "الصعود إلى القسم (Esc)", kind === "section");
        let bgPicked = null;
        if (kind === "section" && await ensureField('#pbx-insp button[data-lib="bgImg"]')) { await page.locator('#pbx-insp button[data-lib="bgImg"]').first().click(); await sleep(900); bgPicked = await pickFromLibrary(); }
        check(tpl, "اختيار صورة خلفية من المكتبة الحقيقية", !!bgPicked, bgPicked);
        const ban2 = (await secs()).find(s => s.id === ban.id);
        const cs2 = await page.evaluate(id => { const f = document.getElementById("pbx-frame"); const el = f.contentDocument.querySelector(`.pb-sec[data-pb="${id}"]`); const c = getComputedStyle(el); return { att: c.backgroundAttachment, size: c.backgroundSize, h: Math.round(el.getBoundingClientRect().height) }; }, ban.id);
        check(tpl, "الخلفية تبدّلت وبقيت خصائصها وارتفاع القسم كما هي", ban2.bgImg === bgPicked && ban2.set.bgFixed === ban.set.bgFixed && ban2.set.bgSize === ban.set.bgSize && /cover/.test(cs2.size) && Math.abs(cs2.h - cs.h) <= 2, `${JSON.stringify(cs)} → ${JSON.stringify(cs2)}`);
        await page.keyboard.press("Control+z"); await sleep(600);
        const ban3 = (await secs()).find(s => s.id === ban.id); check(tpl, "Ctrl+Z يعيد خلفية القسم الأصلية", ban3.bgImg === ban.bgImg, ban3.bgImg);
      }
      // خلفية عمود بصورة (لافتات الأعمدة): تُستبدل من المكتبة بلا تغيّر في أبعاد العمود وخصائص الخلفية
      if (sp.col) {
        const S = await secs(); let colO = null; for (const s of S) for (const c of s.cols) if (c.bgImg && new RegExp(sp.col).test(c.bgImg)) colO = colO || c;
        check(tpl, `عمود بخلفية ${sp.col} الأصلية`, !!colO, colO && colO.bgImg);
        if (colO) {
          const fr = page.locator("#pbx-frame").contentFrame(); const wid = colO.ws.find(id => true);
          const cbox = async () => { const el = page.locator("#pbx-frame").contentFrame().locator(`[data-pb="${colO.id}"]`).first(); const bb = await el.boundingBox(); return bb && { w: Math.round(bb.width), h: Math.round(bb.height) }; };
          const bAll0 = await cbox();
          let kind = ""; check(tpl, "اختيار عنصر داخل العمود بالفأرة", await clickWidget(wid));
          for (let k = 0; k < 2 && !/col|column/.test(kind); k++) { await page.keyboard.press("Escape"); await sleep(300); kind = await page.evaluate(() => { const i = PBApp.find(PBApp.E.sel); return i ? i.kind : "none"; }); }
          check(tpl, "الصعود إلى العمود (Esc)", /col|column/.test(kind), kind);
          let bgPicked = null;
          if (/col|column/.test(kind) && await ensureField('#pbx-insp button[data-lib="bgImg"]')) { await page.locator('#pbx-insp button[data-lib="bgImg"]').first().click(); await sleep(900); bgPicked = await pickFromLibrary(); }
          check(tpl, "اختيار صورة خلفية للعمود من المكتبة الحقيقية", !!bgPicked, bgPicked);
          const c2 = (await secs()).flatMap(s => s.cols).find(c => c.id === colO.id); const bAll1 = await cbox();
          check(tpl, "خلفية العمود تبدّلت وأبعاده وخصائص الخلفية كما هي", c2 && c2.bgImg === bgPicked && c2.set.bgSize === colO.set.bgSize && c2.set.bgPos === colO.set.bgPos && c2.set.grad1 === colO.set.grad1 && bAll0 && bAll1 && Math.abs(bAll0.w - bAll1.w) <= 1 && Math.abs(bAll0.h - bAll1.h) <= 1, `${JSON.stringify(bAll0)} → ${JSON.stringify(bAll1)}`);
          await page.keyboard.press("Control+z"); await sleep(600);
          const c3 = (await secs()).flatMap(s => s.cols).find(c => c.id === colO.id); check(tpl, "Ctrl+Z يعيد خلفية العمود الأصلية", c3 && c3.bgImg === colO.bgImg, c3 && c3.bgImg);
        }
      }
    } catch (e) { check(tpl, "اكتمال التشغيل بلا انهيار", false, e.message); }
  }
  check("all", "لا أخطاء JS", jsErrs.length === 0, jsErrs.slice(0, 3).join(" | "));
  const f = results.filter(r => !r).length; console.log(`\n${results.length - f}/${results.length} PASS` + (f ? ` — ${f} FAILURES` : " — 0 FAILURES"));
  await browser.close(); process.exit(f ? 1 : 0);
})();
