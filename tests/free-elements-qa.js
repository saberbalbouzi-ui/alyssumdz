// اختبار تراجع وظيفي لمحرّر العناصر الحرة (القوالب الستة s-*) — يقود واجهة المطوّر الحقيقية
// بأحداث فأرة/لوحة مفاتيح فعلية عبر Playwright (لا اختبارات بنى بيانات معزولة).
//
// التشغيل:
//   1) ابنِ حزمة PHP وثبّتها:  python3 scripts/make-template.py --target php --kind physical --out dist/qa-store
//      ثم انسخ مكتبة القوالب فوقها (هي رقعة فوق الحزمة):  assets/pages/templates/ + assets/img/tpl/
//      وثبّت عبر install.php، ووفّر تجاوز _conv التجريبي في api/index.php (انظر docs/PLATFORM-DEFECT-PHP-FILE-ALLOWLIST.md)
//   2) شغّل الخادم:  php -S 127.0.0.1:8391 -t <جذر المتجر>
//   3) EQA_BASE=http://127.0.0.1:8391 EQA_STORE=<جذر المتجر> EQA_PASS=<كلمة مرور المالك> node tests/free-elements-qa.js
//      EQA_TPLS=s-men,s-kids   لتحديد قوالب بعينها · EQA_OUT=<مجلد> لمخرجات اللقطات وJSON
//
// ملاحظات التصميم (دروس من تطوير البطارية):
// - Escape يُنهي التحرير ويعيد تحديد الأب — يُنهى تحرير النص بـ blur لا بـ Escape.
// - نسخة العناصر الحرة (FREE_ONLY): لا مفتاح «حر» لكل عنصر؛ التحويل على مستوى القسم (sec-free)
//   وأول سحب لعنصر انسيابي يحوّل قسمه تلقائياً؛ ترتيب الطبقات يتطلب عنصرين حرّين (يُكرَّر ثم يُحذف).
// - التدوير زاوي حول مركز العنصر (startRotate) — السحب الخطي المستقيم قد يصفّر المحصلة؛ يُسحب قوساً.
// - التحديد يُمسح (Escape×4) قبل كل نقرة على اللوحة حتى لا تلتقط أشرطة عائمة قديمة نقرات شاردة.
// - الإخفاء عبر button[data-vis="hd|ht|hm"] في اللوحة السريعة؛ الألوان/المقاسات عبر المفتّش.
// - سياقات المتصفح ببصمة متصفح حقيقي (UA قياسي + إخفاء webdriver) لتمرير بوابة مكافحة الروبوتات
//   (assets/js/anti-copy.js cfg.bots) كما يمرّ زائر حقيقي — الحماية تبقى مفعّلة ولا تُعطَّل.
// - نموذج الطلب: حقول بالمعرفات (#name/#phone/#wilaya/#commune)، رمز النموذج يحتاج ≥3 ثوانٍ،
//   وإشارة النجاح الصارمة هي ستارة #thx ثم ظهور الطلب في لوحة المدير.
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.env.EQA_BASE || "http://127.0.0.1:8391";
const STORE = process.env.EQA_STORE || "/tmp/store";
const PW = process.env.EQA_PASS || "TestPass12345";
const OUT = process.env.EQA_OUT || (require("path").join(__dirname, "out"));
const TEMPLATES = process.env.EQA_TPLS ? process.env.EQA_TPLS.split(",") : ["s-perfume", "s-skincare", "s-makeup", "s-women", "s-men", "s-kids"];
const UA_D = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const UA_M = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const newQAContext = async (br, opts) => {
  const c = await br.newContext(Object.assign({ userAgent: UA_D }, opts || {}));
  await c.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); });
  return c;
};

const results = [];
const check = async (tpl, name, cond, extra) => {
  results.push({ tpl, name, pass: !!cond, extra: extra == null ? "" : String(extra).slice(0, 300) });
  console.log((cond ? "PASS " : "FAIL ") + `[${tpl}] ${name}` + (extra ? "  — " + String(extra).slice(0, 160) : ""));
  if (!cond) { try { await page.screenshot({ path: `${OUT}/eqa-FAIL-${tpl}-${name.replace(/[^a-z0-9]+/gi, "_").slice(0, 40)}.png` }); } catch (e) {} }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
let page;

(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  const ctx = await newQAContext(browser, { viewport: { width: 1360, height: 900 } });
  page = await ctx.newPage();
  page.on("dialog", d => d.accept());
  const jsErrs = [];
  page.on("pageerror", e => jsErrs.push(e.message.slice(0, 160)));

  // ── login ────────────────────────────────────────────────────────────────
  await page.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 });
  await page.waitForTimeout(4000);
  await page.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW);
  await page.waitForTimeout(3500);
  await page.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 });
  await page.waitForFunction(() => typeof Admin !== "undefined" && typeof AdminNav !== "undefined" && AdminNav.tplInstallHome && typeof PBConvert !== "undefined", null, { timeout: 60000 });
  await page.waitForTimeout(2000);
  await check("setup", "admin login", await page.evaluate(() => !!(typeof Admin !== "undefined" && Admin.products)));

  // ensure the two QA products exist (store may have been rebuilt with only a demo product)
  const prods = await page.evaluate(async () => {
    const need = [
      { slug: "prod-a", title: "عطر العود الملكي", price: 3900, oldPrice: 4900, active: true, cat: "perf", cover: "assets/img/tpl/perf_bottle.webp", images: ["assets/img/tpl/perf_bottle.webp"], offers: [{ qty: 1, price: 3900 }, { qty: 2, price: 6900 }] },
      { slug: "prod-b", title: "كريم الوجه المغذي", price: 2400, oldPrice: 3000, active: true, cat: "skin", cover: "assets/img/tpl/skin_cream.webp", images: ["assets/img/tpl/skin_cream.webp"], offers: [{ qty: 1, price: 2400 }] }
    ];
    Admin.products = Admin.products || [];
    let changed = false;
    for (const p of need) { const cur = Admin.products.find(x => x.slug === p.slug); if (cur) { if (!cur.cover) { Object.assign(cur, p); changed = true; } } else { Admin.products.push(p); changed = true; } }
    Admin.categories = Object.assign({}, Admin.categories, { perf: "عطور", skin: "عناية بالبشرة" });
    if (changed) await Admin.publishDataJs();
    return Admin.products.map(p => p.slug + ":" + p.price + ":" + (p.cover ? "img" : "noimg"));
  });
  await check("setup", "QA products present", prods.some(p => p.startsWith("prod-a:3900:img")) && prods.some(p => p.startsWith("prod-b:2400:img")), prods.join(","));

  // ── helpers ──────────────────────────────────────────────────────────────
  const acceptPbAsk = async (which = "ok") => {
    const ask = page.locator("#pbx-ask");
    if (await ask.count()) { await page.click(`#pbx-ask [data-k="${which}"]`).catch(() => {}); await sleep(300); return true; }
    return false;
  };
  const model = () => page.evaluate(() => {
    const E = PBApp.E, P = E.page, out = { sel: E.sel, dev: E.dev, dirty: E.dirty, demo: P.demo, secs: [] };
    P.sections.forEach(s => {
      const so = { id: s.id, kind: (s.set && s.set.kind) || "flow", bgImg: (s.set && s.set.bgImg) || "", cols: [], free: [] };
      (s.cols || []).forEach(c => (c.widgets || []).forEach(w => so.cols.push({ id: w.id, type: w.type, set: w.set })));
      (s.free || []).forEach(w => so.free.push({ id: w.id, type: w.type, set: w.set }));
      out.secs.push(so);
    });
    return out;
  });
  const findW = (m, id) => { for (const s of m.secs) { const f = s.free.find(w => w.id === id); if (f) return { w: f, sec: s, free: true }; const c = s.cols.find(w => w.id === id); if (c) return { w: c, sec: s, free: false }; } return null; };
  const eff = (set, k, dev) => { const v = set && set[k]; if (v && typeof v === "object") return v[dev || "d"]; return v; };
  const widgetCount = m => m.secs.reduce((a, s) => a + s.cols.length + s.free.length, 0);
  const selIs = id => page.evaluate(x => PBApp.E.sel === x, id);

  // v3: drop any selection (and its float bar / side bar) before canvas interactions.
  // Escape×4 reaches null from any depth (widget→column→section→null) and clears multi-select;
  // onKey is bound to both the top document and the frame document, so focus doesn't matter.
  const clearSel = async () => { for (let i = 0; i < 4; i++) { await page.keyboard.press("Escape"); await sleep(120); } };
  // overlay chrome (float bar / quickbar / inspector): real mouse click, DOM-click fallback
  // (a re-render mid-click used to stall Playwright's actionability waits for 30s)
  const uiClick = async sel => {
    const l = page.locator(sel).first();
    if (!(await l.count())) return "missing";
    try { await l.click({ timeout: 6000 }); return "mouse"; }
    catch (e) { const ok = await page.evaluate(s => { const el = document.querySelector(s); if (el) { el.click(); return true; } return false; }, sel); return ok ? "dom" : "missing"; }
  };

  // click a widget in the canvas with selection verification + retries at alternate points
  const clickWidget = async id => {
    await clearSel(); // v3: no float bars → no stray lock/dup clicks on adjacent elements
    const fr = page.locator("#pbx-frame").contentFrame();
    const el = fr.locator(`[data-kind="widget"][data-pb="${id}"]`);
    for (const [fx, fy] of [[0.5, 0.5], [0.3, 0.5], [0.7, 0.5], [0.5, 0.3]]) {
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(250);
      const bb = await el.boundingBox();
      if (!bb) continue;
      await page.mouse.click(bb.x + bb.width * fx, bb.y + bb.height * fy);
      await sleep(380);
      if (await selIs(id)) return true;
    }
    return false;
  };
  const dragEl = async (loc, dx, dy) => {
    const bb = await loc.boundingBox();
    if (!bb) throw new Error("no bbox");
    const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
    await page.mouse.move(cx, cy); await sleep(80); await page.mouse.down(); await sleep(120);
    await page.mouse.move(cx + dx, cy + dy, { steps: 14 }); await sleep(120); await page.mouse.up();
    await sleep(450);
  };
  // v3: rotation is angular — the editor measures the pointer's angle around the ELEMENT
  // CENTER (startRotate). A straight-line drag can net ~0°; sweep an arc instead.
  const dragArc = async (btnLoc, cx, cy, sweepDeg) => {
    const bb = await btnLoc.boundingBox();
    if (!bb) throw new Error("no rot btn bbox");
    const sx = bb.x + bb.width / 2, sy = bb.y + bb.height / 2;
    const r = Math.hypot(sx - cx, sy - cy), a0 = Math.atan2(sx - cx, -(sy - cy));
    await page.mouse.move(sx, sy); await sleep(80); await page.mouse.down(); await sleep(150);
    const N = 18;
    for (let i = 1; i <= N; i++) {
      const a = a0 + (sweepDeg * Math.PI / 180) * (i / N);
      await page.mouse.move(cx + r * Math.sin(a), cy - r * Math.cos(a));
      await sleep(35);
    }
    await page.mouse.up(); await sleep(450);
  };
  const ensureField = async sel => {
    for (const t of ["c", "s", "a"]) {
      const tab = page.locator(`#pbx-insp [data-itab="${t}"]`);
      if (await tab.count()) { await tab.click().catch(() => {}); await sleep(300); }
      if (await page.locator(sel).count()) return true;
      const accs = page.locator("#pbx-insp [data-ac]");
      const n = await accs.count();
      for (let i = 0; i < n; i++) {
        await accs.nth(i).click().catch(() => {}); await sleep(220);
        if (await page.locator(sel).count()) return true;
      }
    }
    return !!(await page.locator(sel).count());
  };
  const setColorField = async (loc, val) => {
    await loc.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, val);
    await sleep(400);
  };
  const endTextEdit = () => page.evaluate(() => { const f = document.getElementById("pbx-frame"); const ce = f && f.contentDocument && f.contentDocument.querySelector("[contenteditable]"); if (ce) ce.blur(); });
  const editorOpen = () => page.waitForFunction(() => typeof PBApp !== "undefined" && PBApp.E && PBApp.E.page && document.getElementById("pbx-frame"), null, { timeout: 30000 });
  const frameReady = async () => {
    await page.waitForFunction(() => { const f = document.getElementById("pbx-frame"); return f && f.contentDocument && f.contentDocument.querySelector('[data-kind="widget"]'); }, null, { timeout: 30000 });
    await sleep(600);
  };

  for (const tpl of TEMPLATES) {
    console.log("\n════════ " + tpl + " ════════");
    const mods = {};
    try {
      // ── install template on home through the real library function ──
      const inst = await page.evaluate(async id => {
        try {
          if (typeof AdminNav.libOpen === "function") { await AdminNav.libOpen(); AdminNav.libClose(); }
          await AdminNav.tplInstallHome(id);
          return { ok: true };
        } catch (e) { return { ok: false, err: e.message }; }
      }, tpl);
      await check(tpl, "install opens editor", inst.ok, JSON.stringify(inst));
      if (!inst.ok) continue;
      await editorOpen(); await frameReady();
      await acceptPbAsk("no");

      const m0 = await model();
      const wtype = t => { for (const s of m0.secs) { for (const w of s.cols) if (w.type === t) return { id: w.id, free: false, sec: s.id }; for (const w of s.free) if (w.type === t) return { id: w.id, free: true, sec: s.id }; } return null; };
      const sbar = wtype("sbar"), shdr = wtype("shdr"), heading = wtype("heading"), textW = wtype("text"), testi = wtype("testimonial"), products = wtype("products"), countdown = wtype("countdown"), coupon = wtype("coupon");
      await check(tpl, "inventory: 2 free (sbar+shdr)", !!(sbar && sbar.free && shdr && shdr.free), JSON.stringify({ sbar: sbar && sbar.id, shdr: shdr && shdr.id }));
      await check(tpl, "inventory: commerce widgets present", !!(products && countdown && coupon), JSON.stringify({ products: !!products, countdown: !!countdown, coupon: !!coupon }));

      // ── T1: independent mouse selection of a free element ──
      await check(tpl, "T1 select free sbar by mouse", await clickWidget(sbar.id));
      await page.screenshot({ path: `${OUT}/eqa-${tpl}-01-selected.png` });

      // ── T2: drag/reposition free shdr with the mouse ──
      await clickWidget(shdr.id);
      const fr1 = page.locator("#pbx-frame").contentFrame();
      const bw0 = findW(await model(), shdr.id);
      const fx0 = Number(eff(bw0.w.set, "fx", "d")) || 0, fy0 = Number(eff(bw0.w.set, "fy", "d")) || 0;
      await dragEl(fr1.locator(`[data-kind="widget"][data-pb="${shdr.id}"]`), 90, 34);
      const bw1 = findW(await model(), shdr.id);
      const fx1 = Number(eff(bw1.w.set, "fx", "d")) || 0, fy1 = Number(eff(bw1.w.set, "fy", "d")) || 0;
      await check(tpl, "T2 drag free shdr", Math.abs(fx1 - fx0) > 0.3 || Math.abs(fy1 - fy0) > 3, `fx ${fx0}→${fx1} fy ${fy0}→${fy1}`);
      mods.shdr = { fx: fx1, fy: fy1 };

      // ── T2b: drag a FLOW widget reorders it within the column, then undo ──
      let t2bok = false, t2bmsg = "";
      try {
        const colInfo = await page.evaluate(hid => {
          for (const s of PBApp.E.page.sections) for (const c of s.cols || []) {
            const i = c.widgets.findIndex(w => w.id === hid);
            if (i >= 0) return { col: c.id, idx: i, ids: c.widgets.map(w => w.id) };
          }
          return null;
        }, heading.id);
        if (colInfo && colInfo.ids.length >= 2 && colInfo.idx === 0) {
          await clickWidget(heading.id);
          const hb = await fr1.locator(`[data-kind="widget"][data-pb="${heading.id}"]`).boundingBox();
          const nb = await fr1.locator(`[data-kind="widget"][data-pb="${colInfo.ids[colInfo.idx + 1]}"]`).boundingBox();
          await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down(); await sleep(120);
          await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height * 0.75, { steps: 12 }); await sleep(150); await page.mouse.up(); await sleep(500);
          const after = await page.evaluate(cid => { for (const s of PBApp.E.page.sections) for (const c of s.cols || []) if (c.id === cid) return c.widgets.map(w => w.id); return []; }, colInfo.col);
          t2bok = JSON.stringify(after) !== JSON.stringify(colInfo.ids);
          t2bmsg = `order ${colInfo.ids.length} widgets changed=${t2bok}`;
          // restore via real undo
          await page.keyboard.press("Control+z"); await sleep(500);
          const back = await page.evaluate(cid => { for (const s of PBApp.E.page.sections) for (const c of s.cols || []) if (c.id === cid) return c.widgets.map(w => w.id); return []; }, colInfo.col);
          t2bok = t2bok && JSON.stringify(back) === JSON.stringify(colInfo.ids);
          t2bmsg += ` undo-restored=${JSON.stringify(back) === JSON.stringify(colInfo.ids)}`;
        } else { t2bmsg = "heading not first in its column — pattern n/a"; t2bok = true; }
      } catch (e) { t2bmsg = e.message.slice(0, 120); }
      await check(tpl, "T2b flow drag reorders + Ctrl+Z undo", t2bok, t2bmsg);

      // ── T3: resize free sbar via the SE handle ──
      await clickWidget(sbar.id);
      const bs0 = findW(await model(), sbar.id);
      const fwd0 = Number(eff(bs0.w.set, "fwd", "d")) || 0, fh0 = Number(eff(bs0.w.set, "fh", "d")) || 0;
      const hnd = page.locator("#pbx-ovl .pbx-h.d-se");
      if (await hnd.count() && await selIs(sbar.id)) {
        await dragEl(hnd.first(), 70, 26);
        const bs1 = findW(await model(), sbar.id);
        const fwd1 = Number(eff(bs1.w.set, "fwd", "d")) || 0, fh1 = Number(eff(bs1.w.set, "fh", "d")) || 0;
        await check(tpl, "T3 resize free sbar (d-se handle)", Math.abs(fwd1 - fwd0) > 0.3 || Math.abs(fh1 - fh0) > 3, `fwd ${fwd0}→${fwd1} fh ${fh0}→${fh1}`);
        mods.sbar = { fwd: fwd1, fh: fh1 };
      } else await check(tpl, "T3 resize free sbar (d-se handle)", false, "handle missing or selection lost");

      // ── T4: rotate via float-bar handle (long arc), reset via quickbar ──
      await clickWidget(shdr.id);
      // v3: a stray click may have locked shdr earlier — locked elements render no side bar
      if (findW(await model(), shdr.id).w.set.locked) {
        await uiClick('.pbx-ft button[data-k="lock"]'); await sleep(450);
        await clickWidget(shdr.id);
      }
      const rotBtn = page.locator("#pbx-ovl .pbx-sb button").first();
      if (await rotBtn.count() && await selIs(shdr.id)) {
        const rotPre = Number(eff(findW(await model(), shdr.id).w.set, "rot", "d")) || 0;
        const shBb = await fr1.locator(`[data-kind="widget"][data-pb="${shdr.id}"]`).boundingBox();
        await dragArc(rotBtn, shBb.x + shBb.width / 2, shBb.y + shBb.height / 2, 60);
        const rot1 = Number(eff(findW(await model(), shdr.id).w.set, "rot", "d")) || 0;
        await check(tpl, "T4a rotate free shdr (rot handle)", Math.abs(rot1 - rotPre) > 1, `rot ${rotPre}→${rot1}`);
        const rq = page.locator('button[data-q="rot-0"]').first();
        if (await rq.count()) { await uiClick('button[data-q="rot-0"]'); await sleep(400); }
        const rot2 = Number(eff(findW(await model(), shdr.id).w.set, "rot", "d")) || 0;
        await check(tpl, "T4b rotation reset (quickbar)", Math.abs(rot2) < 1, "rot=" + rot2);
      } else await check(tpl, "T4 rotate", false, "rot button missing or selection lost");

      // ── T5: select a FLOW widget by mouse ──
      await check(tpl, "T5 select flow heading by mouse", await clickWidget(heading.id));

      // ── T6: in-canvas text editing (click data-edit → type → blur commits) ──
      const fr2 = page.locator("#pbx-frame").contentFrame();
      const newText = "عنوان معدّل QA-" + tpl;
      let t6ok = false, t6msg = "";
      try {
        const edEl = fr2.locator(`[data-kind="widget"][data-pb="${heading.id}"] [data-edit]`).first();
        await edEl.click({ force: true, timeout: 6000 }); await sleep(450);
        const isCE = await page.evaluate(() => { const f = document.getElementById("pbx-frame"); return !!(f && f.contentDocument && f.contentDocument.querySelector("[contenteditable=true]")); });
        if (isCE) {
          await page.keyboard.press("Control+a"); await sleep(80);
          await page.keyboard.type(newText, { delay: 8 });
          await endTextEdit(); await sleep(550); // blur → endEdit commits (real path; Escape would also re-select parent)
          const hw = findW(await model(), heading.id);
          t6ok = String(hw.w.set.text || "").includes("QA-" + tpl); t6msg = "text=" + String(hw.w.set.text).slice(0, 60);
        } else t6msg = "contenteditable did not activate";
      } catch (e) { t6msg = e.message.slice(0, 120); }
      await check(tpl, "T6 in-canvas text edit (click→type→blur)", t6ok, t6msg);
      mods.headingText = newText;
      await clickWidget(heading.id); // ensure still selected for T7/T8

      // ── T7: typography via inspector (font size, تنسيق tab) ──
      const fsFound = await ensureField('#pbx-insp input[data-k="fs"][type="number"]');
      let t7ok = false, t7msg = "";
      if (fsFound && await selIs(heading.id)) {
        const fsIn = page.locator('#pbx-insp input[data-k="fs"][type="number"]').first();
        const cur = await fsIn.inputValue().catch(() => "");
        const target = String((parseInt(cur, 10) || 40) + 6);
        await fsIn.fill(target); await sleep(500);
        const hw = findW(await model(), heading.id);
        t7ok = Number(eff(hw.w.set, "fs", "d")) === Number(target); t7msg = `fs ${cur}→${target} model=${eff(hw.w.set, "fs", "d")}`;
        if (t7ok) mods.fs = Number(target);
      } else t7msg = "fs field not found or selection lost";
      await check(tpl, "T7 typography: font size via inspector", t7ok, t7msg);

      // ── T8: color via inspector color field (تنسيق tab) ──
      const cFound = await ensureField('#pbx-insp input[data-k="color"][type="color"]');
      let t8ok = false, t8msg = "";
      if (cFound && await selIs(heading.id)) {
        await setColorField(page.locator('#pbx-insp input[data-k="color"][type="color"]').first(), "#1a5f9e");
        const hw = findW(await model(), heading.id);
        t8ok = (hw.w.set.color || "").toLowerCase() === "#1a5f9e"; t8msg = "color=" + hw.w.set.color;
        if (t8ok) mods.color = "#1a5f9e";
      } else t8msg = "color field not found or selection lost";
      await check(tpl, "T8 color editing via inspector", t8ok, t8msg);

      // ── T9: duplicate then delete via float bar ──
      await clickWidget(textW.id);
      const cnt0 = widgetCount(await model());
      const dupB = page.locator('.pbx-ft button[data-k="dup"]');
      let t9a = false, t9b = false, t9msg = "";
      if (await dupB.count() && await selIs(textW.id)) {
        await uiClick('.pbx-ft button[data-k="dup"]'); await sleep(600);
        const cnt1 = widgetCount(await model());
        t9a = cnt1 === cnt0 + 1;
        const delB = page.locator('.pbx-ft button[data-k="del"]');
        if (await delB.count()) {
          await uiClick('.pbx-ft button[data-k="del"]'); await sleep(400); await acceptPbAsk("ok"); await sleep(450);
          const cnt2 = widgetCount(await model());
          t9b = cnt2 === cnt0; t9msg = `count ${cnt0}→${cnt1}→${cnt2}`;
        } else t9msg = "del missing (dup ok=" + t9a + ")";
      } else t9msg = "dup button missing or selection lost";
      await check(tpl, "T9a duplicate (float bar)", t9a, t9msg);
      await check(tpl, "T9b delete duplicate (float bar)", t9b, t9msg);

      // ── T10: hide on desktop then show again (quick panel visRow: button[data-vis]) ──
      await clickWidget(textW.id);
      const hdFound = await ensureField('#pbx-insp button[data-vis="hd"]');
      let t10ok = false, t10msg = "";
      if (hdFound && await selIs(textW.id)) {
        const hdB = page.locator('#pbx-insp button[data-vis="hd"]').first();
        await hdB.click(); await sleep(500);
        let tw = findW(await model(), textW.id);
        const hiddenSet = !!tw.w.set.hd;
        const frH = page.locator("#pbx-frame").contentFrame();
        const visibleInCanvas = await frH.locator(`[data-kind="widget"][data-pb="${textW.id}"]`).isVisible().catch(() => null);
        const hdB2 = page.locator('#pbx-insp button[data-vis="hd"]').first();
        await hdB2.click(); await sleep(500);
        tw = findW(await model(), textW.id);
        t10ok = hiddenSet && !tw.w.set.hd;
        t10msg = `hd=${hiddenSet} canvasHidden=${visibleInCanvas === false} restored=${!tw.w.set.hd}`;
      } else t10msg = "vis button not found or selection lost";
      await check(tpl, "T10 hide on desktop + show again", t10ok, t10msg);

      // ── T11: lock free sbar, drag attempt blocked, unlock ──
      await clickWidget(sbar.id);
      let t11ok = false, t11msg = "";
      try {
        const lockVia = await uiClick('.pbx-ft button[data-k="lock"]');
        await sleep(450);
        let sw = findW(await model(), sbar.id);
        const lockedSet = !!sw.w.set.locked;
        const lx0 = Number(eff(sw.w.set, "fx", "d")) || 0, ly0 = Number(eff(sw.w.set, "fy", "d")) || 0;
        const fr3 = page.locator("#pbx-frame").contentFrame();
        await dragEl(fr3.locator(`[data-kind="widget"][data-pb="${sbar.id}"]`), 60, 20).catch(() => {});
        await page.mouse.move(700, 860); await page.mouse.up().catch(() => {}); await sleep(300);
        sw = findW(await model(), sbar.id);
        const lx1 = Number(eff(sw.w.set, "fx", "d")) || 0, ly1 = Number(eff(sw.w.set, "fy", "d")) || 0;
        const blocked = Math.abs(lx1 - lx0) < 0.2 && Math.abs(ly1 - ly0) < 2;
        await clearSel(); // v3: drop marquee/multi-select from the blocked drag before re-selecting
        await clickWidget(sbar.id);
        await uiClick('.pbx-ft button[data-k="lock"]'); await sleep(450);
        sw = findW(await model(), sbar.id);
        t11ok = lockedSet && blocked && !sw.w.set.locked;
        t11msg = `lockVia=${lockVia} locked=${lockedSet} dragBlocked=${blocked} (fx ${lx0}→${lx1}) unlocked=${!sw.w.set.locked}`;
      } catch (e) { t11msg = "ERR " + e.message.slice(0, 110); }
      await check(tpl, "T11 lock → drag blocked → unlock", t11ok, t11msg);
      await sleep(900); // let the marquee skipClick window expire

      // ── T12: z-order between two free elements (duplicate sbar → back/front → delete) ──
      let t12ok = false, t12msg = "";
      if (await clickWidget(sbar.id)) {
        await uiClick('.pbx-ft button[data-k="dup"]'); await sleep(600);
        const secAfterDup = findW(await model(), sbar.id).sec;
        if (secAfterDup.free.length === 2) {
          const dupId = (await model()).secs.find(s => s.id === secAfterDup.id).free.find(w => w.id !== sbar.id).id;
          await clickWidget(dupId);
          await uiClick('button[data-q="back"]'); await sleep(400);
          const mm = await model();
          const ziDup = Number(findW(mm, dupId).w.set.zi) || 0, ziOrig = Number(findW(mm, sbar.id).w.set.zi) || 0;
          const wentBack = ziDup < ziOrig;
          await uiClick('button[data-q="front"]'); await sleep(400);
          const mm2 = await model();
          const ziDup2 = Number(findW(mm2, dupId).w.set.zi) || 0, ziOrig2 = Number(findW(mm2, sbar.id).w.set.zi) || 0;
          const cameFront = ziDup2 > ziOrig2;
          await clickWidget(dupId);
          await uiClick('.pbx-ft button[data-k="del"]'); await sleep(400); await acceptPbAsk("ok"); await sleep(400);
          const cleaned = findW(await model(), sbar.id).sec.free.length === 1;
          t12ok = wentBack && cameFront && cleaned; t12msg = `back: dup${ziDup}<orig${ziOrig} front: dup${ziDup2}>orig${ziOrig2} cleaned=${cleaned}`;
        } else t12msg = "dup did not create a second free element (free=" + secAfterDup.free.length + ")";
      } else t12msg = "selection lost";
      await check(tpl, "T12 z-order back/front between 2 free elements", t12ok, t12msg);

      // ── T13: section → free-canvas conversion (sec-free), drag former-flow widget, Ctrl+Z ──
      let t13ok = false, t13msg = "";
      try {
        await clickWidget(heading.id);
        // Esc ×2 from widget → column → section (real keyboard path)
        await page.keyboard.press("Escape"); await sleep(250);
        await page.keyboard.press("Escape"); await sleep(300);
        const kindNow = await page.evaluate(() => { const i = PBApp.find(PBApp.E.sel); return i ? i.kind : "none"; });
        if (kindNow !== "section") { // fallback: click section edge
          const frS = page.locator("#pbx-frame").contentFrame();
          const secEl = frS.locator(`.pb-sec[data-pb="${heading.sec}"]`);
          await secEl.scrollIntoViewIfNeeded().catch(() => {}); await sleep(250);
          const sbb = await secEl.boundingBox();
          await page.mouse.click(sbb.x + 6, sbb.y + 3); await sleep(300);
          await page.mouse.click(sbb.x + 6, sbb.y + 3); await sleep(300);
        }
        const secSel = await page.evaluate(() => { const i = PBApp.find(PBApp.E.sel); return i && i.kind === "section" ? PBApp.E.sel : null; });
        const secFreeB = page.locator('button[data-q="sec-free"]').first();
        if (secSel && await secFreeB.count()) {
          await secFreeB.click(); await sleep(800);
          let mm = await model();
          const secC = mm.secs.find(s => s.id === secSel);
          const becameCanvas = secC.kind === "canvas" && secC.free.length > 0;
          // drag one of the newly-free widgets
          const fw0 = secC.free.find(w => w.type === "heading") || secC.free[0];
          const fxA = Number(eff(fw0.set, "fx", "d")) || 0;
          const frS2 = page.locator("#pbx-frame").contentFrame();
          await dragEl(frS2.locator(`[data-kind="widget"][data-pb="${fw0.id}"]`), 50, 18);
          mm = await model();
          const fxB = Number(eff(findW(mm, fw0.id).w.set, "fx", "d")) || 0;
          const draggedFree = Math.abs(fxB - fxA) > 0.3;
          await page.keyboard.press("Control+z"); await sleep(500); // undo drag
          await page.keyboard.press("Control+z"); await sleep(600); // undo conversion
          mm = await model();
          const reverted = mm.secs.find(s => s.id === secSel).kind !== "canvas";
          t13ok = becameCanvas && draggedFree && reverted;
          t13msg = `canvas=${becameCanvas} dragFree=${draggedFree} undoReverted=${reverted}`;
        } else t13msg = "section not selected or sec-free missing (kind=" + kindNow + ")";
      } catch (e) { t13msg = e.message.slice(0, 140); }
      await check(tpl, "T13 section→free conversion + drag + undo", t13ok, t13msg);

      // ── T14: replace testimonial avatar via the media library (products tab) ──
      await clickWidget(testi.id);
      const libFound = await ensureField('#pbx-insp button[data-lib="img"]');
      let t14ok = false, t14msg = "";
      if (libFound && await selIs(testi.id)) {
        await page.locator('#pbx-insp button[data-lib="img"]').first().click(); await sleep(900);
        const lib = page.locator("#pbx-lib");
        if (await lib.count()) {
          await lib.locator('[data-t="prod"]').click().catch(() => {}); await sleep(400);
          if (tpl === "s-perfume") await page.screenshot({ path: `${OUT}/eqa-library-dialog.png` });
          const item = lib.locator("[data-p]").first();
          if (await item.count()) {
            const picked = await item.getAttribute("data-p");
            await item.click(); await sleep(600);
            const tw2 = findW(await model(), testi.id);
            t14ok = tw2.w.set.img === picked; t14msg = "img=" + picked;
            if (t14ok) mods.testiImg = picked;
          } else t14msg = "library empty (both tabs)";
        } else t14msg = "library dialog did not open";
      } else t14msg = "data-lib=img button not found or selection lost";
      await check(tpl, "T14 replace image via library", t14ok, t14msg);

      // ── T15: section background image set via library, then cleared ──
      let t15ok = false, t15msg = "";
      try {
        const sec0 = m0.secs.find(s => s.kind !== "canvas" && s.cols.length > 0);
        // v3: in FREE_ONLY canvas clicks can't select sections — select a widget, Esc×2 (proven in T13)
        let selKind = "";
        const firstW = sec0.cols[0] && sec0.cols[0].id;
        if (firstW && await clickWidget(firstW)) {
          // v3.1: adaptive — the widget→column→section chain length/timing varies per template
          for (let k = 0; k < 3 && selKind !== "section"; k++) {
            await page.keyboard.press("Escape"); await sleep(300);
            selKind = await page.evaluate(() => { const i = PBApp.find(PBApp.E.sel); return i ? i.kind : "none"; });
          }
        }
        if (selKind !== "section") { // fallback: click section edge
          const frS = page.locator("#pbx-frame").contentFrame();
          const secEl = frS.locator(`.pb-sec[data-pb="${sec0.id}"]`);
          await secEl.scrollIntoViewIfNeeded().catch(() => {}); await sleep(250);
          const sbb = await secEl.boundingBox();
          for (let att = 0; att < 3 && selKind !== "section"; att++) {
            await page.mouse.click(sbb.x + 6, sbb.y + 3); await sleep(350);
            selKind = await page.evaluate(() => { const i = PBApp.find(PBApp.E.sel); return i ? i.kind : "none"; });
          }
        }
        if (selKind === "section") {
          const bgFound = await ensureField('#pbx-insp button[data-lib="bgImg"]');
          if (bgFound) {
            await page.locator('#pbx-insp button[data-lib="bgImg"]').first().click(); await sleep(900);
            const lib2 = page.locator("#pbx-lib");
            await lib2.locator('[data-t="prod"]').click().catch(() => {}); await sleep(400);
            const item = lib2.locator("[data-p]").first();
            if (await item.count()) {
              const picked = await item.getAttribute("data-p");
              await item.click(); await sleep(600);
              let mm = await model();
              const wasSet = mm.secs.find(s => s.id === sec0.id).bgImg === picked;
              const txtIn = page.locator('#pbx-insp input[data-k="bgImg"]').first();
              if (await txtIn.count()) { await txtIn.fill(""); await sleep(450); }
              mm = await model();
              const cleared = !mm.secs.find(s => s.id === sec0.id).bgImg;
              t15ok = wasSet && cleared; t15msg = `set=${wasSet} (${picked}) cleared=${cleared}`;
            } else t15msg = "library empty for section";
          } else t15msg = "bgImg library button not found";
        } else t15msg = "could not select section (kind=" + selKind + ")";
      } catch (e) { t15msg = e.message.slice(0, 140); }
      await check(tpl, "T15 section background image set/clear", t15ok, t15msg);

      // ── T16: mobile device mode + editor preview overlay (s-perfume) ──
      await page.click('button[data-dv="m"]'); await sleep(900);
      const mob = await page.evaluate(() => {
        const f = document.getElementById("pbx-frame");
        return { dev: PBApp.E.dev, w: f ? Math.round(f.getBoundingClientRect().width) : 0, widgets: f && f.contentDocument ? f.contentDocument.querySelectorAll('[data-kind="widget"]').length : 0 };
      });
      await check(tpl, "T16 editor mobile mode renders", mob.dev === "m" && mob.w > 200 && mob.w < 600 && mob.widgets > 10, JSON.stringify(mob));
      await page.screenshot({ path: `${OUT}/eqa-${tpl}-03-mobile-editor.png` });
      await page.click('button[data-dv="d"]'); await sleep(700);
      if (tpl === "s-perfume") {
        await page.click("#pbx-prev"); await sleep(2500);
        const prevOk = await page.evaluate(() => document.querySelectorAll("iframe").length > 1);
        await check(tpl, "T16b editor preview overlay opens", prevOk);
        if (prevOk) await page.screenshot({ path: `${OUT}/eqa-${tpl}-preview.png` });
        await page.keyboard.press("Escape"); await sleep(500);
        await page.evaluate(() => { if (typeof SitePreview !== "undefined" && SitePreview.close) SitePreview.close(); });
        await sleep(400);
      }
      await page.screenshot({ path: `${OUT}/eqa-${tpl}-02-edited.png` });

      // ── T17: publish through the real UI (حفظ ونشر → حفظ مباشر) ──
      await page.click("#pbx-pubb"); await sleep(900);
      if (await page.locator("#pbc-ask").count()) await page.click('#pbc-ask button[data-m="direct"]');
      let pubOk = true;
      try { await page.waitForFunction(() => PBApp.E.dirty === false, null, { timeout: 90000 }); }
      catch (e) { pubOk = false; }
      await sleep(1200);
      await check(tpl, "T17 publish via UI (حفظ مباشر)", pubOk, "dirty=" + (await page.evaluate(() => PBApp.E.dirty)));
      const convPath = STORE + "/assets/pages/_conv/home.json";
      const conv = fs.existsSync(convPath) ? JSON.parse(fs.readFileSync(convPath, "utf8")) : null;
      await check(tpl, "T17b _conv/home.json carries edits", !!(conv && JSON.stringify(conv).includes("QA-" + tpl)), conv ? ("tplSkin=" + conv.tplSkin) : "no file");
      await check(tpl, "T17c publish switched demo→real data", !!(conv && conv.demo === false), "demo=" + (conv && conv.demo));
      const idxHtml = fs.readFileSync(STORE + "/index.html", "utf8");
      await check(tpl, "T17d storefront index.html has edited text", idxHtml.includes("QA-" + tpl));

      // ── T18: close and reopen — every modification must persist ──
      await page.click('button[onclick="PBApp.close()"]'); await sleep(800);
      await acceptPbAsk("ok");
      // v3: close() hides #pb-app (removes .on) — the frame node stays in the DOM
      const closed = await page.waitForFunction(() => { const a = document.getElementById("pb-app"); return a && !a.classList.contains("on"); }, null, { timeout: 15000 }).then(() => true).catch(() => false);
      await check(tpl, "T18a editor closed", closed);
      await page.evaluate(() => PBConvert.edit("home"));
      // edit() re-fetches _conv/home.json from the server; dirty flips false→true on the fresh open
      await page.waitForFunction(() => typeof PBApp !== "undefined" && PBApp.E && PBApp.E.page && PBApp.E.dirty === true, null, { timeout: 30000 });
      await frameReady();
      await acceptPbAsk("no");
      const rm = await model();
      const rh = findW(rm, heading.id), rs = findW(rm, sbar.id), rsh = findW(rm, shdr.id), rt = findW(rm, testi.id), rtx = findW(rm, textW.id);
      const per = [];
      per.push(["heading text", String(rh && rh.w.set.text || "").includes("QA-" + tpl)]);
      if (mods.fs) per.push(["font size", Number(eff(rh.w.set, "fs", "d")) === mods.fs]);
      if (mods.color) per.push(["color", (rh.w.set.color || "").toLowerCase() === mods.color]);
      if (mods.shdr) per.push(["shdr position", Math.abs((Number(eff(rsh.w.set, "fx", "d")) || 0) - mods.shdr.fx) < 0.7 && Math.abs((Number(eff(rsh.w.set, "fy", "d")) || 0) - mods.shdr.fy) < 7]);
      if (mods.sbar) per.push(["sbar size", Math.abs((Number(eff(rs.w.set, "fwd", "d")) || 0) - mods.sbar.fwd) < 0.7 && Math.abs((Number(eff(rs.w.set, "fh", "d")) || 0) - mods.sbar.fh) < 7]);
      if (mods.testiImg) per.push(["testimonial img", rt.w.set.img === mods.testiImg]);
      per.push(["no stray lock", !(rs.w.set.locked || rsh.w.set.locked)]);
      per.push(["no stray hidden", !rtx.w.set.hd]);
      per.push(["widget count stable", widgetCount(rm) === widgetCount(m0)]);
      const perFails = per.filter(p => !p[1]);
      await check(tpl, "T18b reopen: all modifications persist", perFails.length === 0, perFails.length ? "FAILED: " + perFails.map(p => p[0]).join(", ") : per.length + " props verified");
      await check(tpl, "T18c reopened page uses real store data", rm.demo === false, "demo=" + rm.demo);
      await page.screenshot({ path: `${OUT}/eqa-${tpl}-04-reopened.png` });

      await page.click('button[onclick="PBApp.close()"]'); await sleep(600);
      await acceptPbAsk("ok");
      await page.waitForFunction(() => { const a = document.getElementById("pb-app"); return a && !a.classList.contains("on"); }, null, { timeout: 15000 }).catch(() => {});

      // ── T19: storefront preview desktop + mobile ──
      const tplJson = JSON.parse(fs.readFileSync(`/mnt/agents/alyssum/assets/pages/templates/${tpl}.json`, "utf8"));
      const tplAnims = (JSON.stringify(tplJson).match(/"anim":\s*"[^"]+"/g) || []).length;
      for (const [mode, vp] of [["d", { width: 1360, height: 900 }], ["m", { width: 390, height: 844 }]]) {
        const c2 = await newQAContext(browser, { viewport: vp, isMobile: mode === "m", hasTouch: mode === "m", userAgent: mode === "m" ? UA_M : UA_D });
        const p2 = await c2.newPage();
        await p2.goto(BASE + "/index.html", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
        await p2.waitForTimeout(1500);
        await p2.evaluate(async () => { const h = document.body.scrollHeight; for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); } window.scrollTo(0, 0); });
        await p2.waitForTimeout(600);
        const sf = await p2.evaluate(() => {
          const html = document.documentElement.innerHTML;
          const bodyTxt = document.body.innerText;
          return {
            anims: document.querySelectorAll("[data-anim]").length,
            hoverCss: (html.match(/:hover/g) || []).length,
            edited: bodyTxt.includes("QA-"),
            price: /3[\s.,٬]?900/.test(bodyTxt.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))),
            prodLink: !!document.querySelector('a[href*="p/prod-a"]'),
            hscroll: document.documentElement.scrollWidth - window.innerWidth,
            countdown: !!document.querySelector("[class*=cdown], [class*=countdown], .pb-cd"),
            coupon: /كوبون|COUPON|كود/i.test(bodyTxt) || !!document.querySelector("[class*=coupon], .pb-cp")
          };
        });
        await check(tpl, `T19-${mode} storefront: edited text live`, sf.edited);
        if (mode === "d") {
          await check(tpl, "T19-d storefront: entrance animations preserved", sf.anims >= Math.min(10, tplAnims * 0.5), `anims=${sf.anims} tpl≈${tplAnims}`);
          await check(tpl, "T19-d storefront: hover effects css present", sf.hoverCss > 3, "hover rules=" + sf.hoverCss);
          await check(tpl, "T19-d storefront: real product price rendered", sf.price, "");
          await check(tpl, "T19-d storefront: product links to native page", sf.prodLink, "");
          await check(tpl, "T19-d storefront: countdown+coupon render", sf.countdown && sf.coupon, `cd=${sf.countdown} cp=${sf.coupon}`);
        }
        await check(tpl, `T19-${mode} no horizontal overflow`, sf.hscroll <= 3, "overflow=" + sf.hscroll + "px");
        await p2.screenshot({ path: `${OUT}/eqa-${tpl}-05-store-${mode}.jpg`, fullPage: true, type: "jpeg", quality: 80 });
        await c2.close();
      }
    } catch (e) {
      await check(tpl, "template run completed without crash", false, e.message.slice(0, 200));
      try { await page.click('button[onclick="PBApp.close()"]', { timeout: 3000 }); } catch (x) {}
      await acceptPbAsk("ok");
      await page.waitForFunction(() => { const a = document.getElementById("pb-app"); return !a || !a.classList.contains("on"); }, null, { timeout: 8000 }).catch(() => {});
    }
  }

  // ── T20: native commerce engine — product page order form end-to-end (once) ──
  // Real-browser profile (UA + no webdriver) so anti-copy.js cfg.bots treats the visit as a
  // human visitor — the protection stays fully ON. Form token must age ≥3s before submit
  // (server rule), honeypot untouched, DZ phone format, strict success = #thx overlay.
  {
    const c3 = await newQAContext(browser, { viewport: { width: 1360, height: 900 } });
    const p3 = await c3.newPage();
    p3.on("dialog", d => d.accept());
    await p3.goto(BASE + "/p/prod-a/", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
    await p3.waitForTimeout(4200); // Guard token issued on load must be ≥3s old at submit time
    const gated = await p3.evaluate(() => !!document.getElementById("acg-ov"));
    await check("commerce", "T20a0 bot gate passes real-browser profile (protection ON)", !gated, gated ? "acg-ov overlay present" : "clean");
    const or0 = await p3.evaluate(() => {
      const f = document.getElementById("order-form");
      return { hasForm: !!f, fields: ["name", "phone", "wilaya", "commune"].filter(id => !!document.getElementById(id)) };
    });
    await check("commerce", "T20a product page has order form", or0.hasForm && or0.fields.length >= 3, or0.fields.join(","));
    let placed = false, pmsg = "";
    try {
      const humanFill = async (sel, text) => {
        const l = p3.locator(sel);
        await l.scrollIntoViewIfNeeded(); await sleep(250);
        const bb = await l.boundingBox();
        await p3.mouse.move(bb.x + bb.width / 2 - 40, bb.y + bb.height / 2, { steps: 6 });
        await p3.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 4 });
        await p3.mouse.down(); await sleep(70); await p3.mouse.up(); await sleep(280);
        await p3.keyboard.type(text, { delay: 65 });
      };
      await humanFill("#name", "زبون QA"); await sleep(400);
      await humanFill("#phone", "0550000111"); await sleep(400);
      await p3.locator("#wilaya").selectOption({ index: 5 }); await sleep(1400); // onchange sets state.wilaya + fills communes
      const com = p3.locator("#commune");
      if (await com.count() && (await com.evaluate(s => s.options.length)) > 1) { await com.selectOption({ index: 1 }).catch(() => {}); await sleep(300); }
      const btn = p3.locator('#order-form button[type="submit"]').first();
      await btn.scrollIntoViewIfNeeded(); await sleep(500);
      await btn.click({ timeout: 8000 });
      await p3.waitForTimeout(4500);
      placed = await p3.evaluate(() => { const t = document.getElementById("thx"); return !!t && /تم استلام طلبك/.test(t.innerText); });
      pmsg = placed ? "thanks overlay shown" : "page text: " + (await p3.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 120)));
    } catch (e) { pmsg = e.message.slice(0, 120); }
    await check("commerce", "T20b order submission accepted (thanks overlay)", placed, pmsg);
    await p3.screenshot({ path: `${OUT}/eqa-product-order.jpg`, fullPage: true, type: "jpeg", quality: 80 });
    await c3.close();
    const c4 = await newQAContext(browser, { viewport: { width: 1360, height: 900 } });
    const p4 = await c4.newPage();
    p4.on("dialog", d => d.accept());
    await p4.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 });
    await p4.waitForTimeout(3500);
    await p4.evaluate(pw => { const e = document.getElementById("login-pass"); if (e) { e.classList.remove("hidden"); e.value = pw; Admin.login(); } }, PW);
    await p4.waitForTimeout(3000);
    await p4.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 });
    await p4.waitForTimeout(3500);
    const orders = await p4.evaluate(async () => {
      try { if (typeof Admin.loadOrders === "function") await Admin.loadOrders(); const O = (Admin.orders || []); return O.map(o => (o.name || o.customer || "") + "|" + (o.phone || "")); }
      catch (e) { return ["ERR:" + e.message]; }
    });
    await check("commerce", "T20c order visible in admin", orders.some(o => o.includes("زبون QA") || o.includes("0550000111")), orders.slice(-3).join(" ; "));
    await c4.close();
  }

  fs.writeFileSync(OUT + "/free-elements-qa-results.json", JSON.stringify({ results, jsErrs: jsErrs.slice(0, 20) }, null, 1));
  console.log("\nJS errors:", jsErrs.length);
  [...new Set(jsErrs)].slice(0, 8).forEach(e => console.log("   " + e));
  const fails = results.filter(r => !r.pass);
  console.log(`\n${results.length - fails.length}/${results.length} PASS — ${fails.length} FAILURES`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error("FATAL", e); process.exit(2); });