// استقلال تحرير كل عنصر في قالبي التجربة (s-watches وs-tech) — يقود المحرر الحقيقي بأحداث فأرة فعلية.
// يكمّل tests/free-elements-qa.js (لا يحلّ محلّه ولا يضعف شيئاً منه):
//   1) تحديد كل عنصر (متدفق وحر) بالفأرة، وتصنيف ما لا يُحدَّد بسبب تغطية عنصر آخر له بالتصميم
//   2) سحب كل عنصر حر قابل للتحديد: يتحرك هو وحده (لقطة كل العناصر قبل/بعد) ثم تراجع Ctrl+Z يعيد كل شيء
//   3) على عنصر البطل الحر: تحجيم بالمقبض، تدوير زاوي، تكرار ثم حذف، إخفاء/إظهار، قفل/فك قفل
// التشغيل: نفس متغيرات البطارية: EQA_BASE EQA_STORE EQA_PASS EQA_OUT، و PILOT_TPLS=s-watches,s-tech
const { chromium } = require("playwright");
const BASE = process.env.EQA_BASE || "http://127.0.0.1:8391";
const PW = process.env.EQA_PASS || "TestPass12345";
const SEC_MODE = !!process.env.PILOT_SEC;   // أقسام اتصال/طلب (c-*/o-*): تُفتح بـ«تعديل القالب» لا بالتثبيت على الرئيسية
const TEMPLATES = process.env.PILOT_TPLS ? process.env.PILOT_TPLS.split(",") : ["s-watches", "s-tech"];
const UA_D = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
let page;
const check = (tpl, name, cond, extra) => {
  results.push({ tpl, name, pass: !!cond });
  console.log((cond ? "PASS " : "FAIL ") + `[${tpl}] ${name}` + (extra ? "  — " + String(extra).slice(0, 200) : ""));
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await browser.newContext({ userAgent: UA_D, viewport: { width: 1360, height: 900 } });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); });
  page = await ctx.newPage(); page.on("dialog", d => d.accept());
  const jsErrs = []; page.on("pageerror", e => jsErrs.push(e.message.slice(0, 160)));
  await page.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await sleep(4000);
  await page.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
  await page.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 });
  await page.waitForFunction(() => typeof Admin !== "undefined" && typeof AdminNav !== "undefined" && AdminNav.tplInstallHome && typeof PBConvert !== "undefined", null, { timeout: 60000 });
  await sleep(2000);

  const model = () => page.evaluate(() => {
    const out = { sel: PBApp.E.sel, secs: [] };
    PBApp.E.page.sections.forEach(s => {
      const so = { id: s.id, kind: (s.set && s.set.kind) || "flow", cols: [], free: [] };
      (s.cols || []).forEach(c => (c.widgets || []).forEach(w => so.cols.push({ id: w.id, type: w.type, set: w.set })));
      (s.free || []).forEach(w => so.free.push({ id: w.id, type: w.type, set: w.set }));
      out.secs.push(so);
    });
    return out;
  });
  const all = m => m.secs.flatMap(s => s.free.map(w => ({ ...w, free: true, sec: s.id })).concat(s.cols.map(w => ({ ...w, free: false, sec: s.id }))));
  const val = (set, k) => { const v = set && set[k]; return v && typeof v === "object" ? v.d : v; };
  const snap = m => { const o = {}; all(m).forEach(w => { o[w.id] = [val(w.set, "fx"), val(w.set, "fy"), val(w.set, "fwd"), val(w.set, "fh"), val(w.set, "rot") || 0, w.set.zi || 0].join("|"); }); return o; };
  const selIs = id => page.evaluate(x => PBApp.E.sel === x, id);
  const clearSel = async () => { for (let i = 0; i < 4; i++) { await page.keyboard.press("Escape"); await sleep(110); } };
  const uiClick = async sel => {
    const l = page.locator(sel).first(); if (!(await l.count())) return "missing";
    try { await l.click({ timeout: 6000 }); return "mouse"; } catch (e) { const ok = await page.evaluate(s => { const el = document.querySelector(s); if (el) { el.click(); return true; } return false; }, sel); return ok ? "dom" : "missing"; }
  };
  const scrollToWidget = async id => {
    await page.evaluate(wid => {
      const f = document.getElementById("pbx-frame"); const el = f && f.contentDocument && f.contentDocument.querySelector(`[data-kind="widget"][data-pb="${wid}"]`); if (!el) return;
      const fr = f.getBoundingClientRect(), er = el.getBoundingClientRect(); window.scrollTo(0, Math.max(0, window.scrollY + fr.top + er.top - window.innerHeight * 0.3));
    }, id); await sleep(300);
  };
  // يحدّد عنصراً بالفأرة (محاولات من نقاط متعددة) ويعيد النقطة المستعملة أو null
  const clickWidget = async id => {
    await clearSel();
    const fr = page.locator("#pbx-frame").contentFrame(); const el = fr.locator(`[data-kind="widget"][data-pb="${id}"]`); let last = "";
    for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75], [0.15, 0.3], [0.85, 0.7]]) {
      await scrollToWidget(id); await el.scrollIntoViewIfNeeded().catch(() => {}); await sleep(160);
      const bb = await el.boundingBox(); if (!bb || bb.width < 0.5 || bb.height < 0.5) continue;
      const x = bb.x + bb.width * fx, y = bb.y + bb.height * fy;
      await page.mouse.click(x, y); await sleep(300);
      if (await selIs(id)) return { x, y, bb };
      last = await page.evaluate(([px, py]) => { const e = document.elementFromPoint(px, py); return e ? (e.id || e.className || e.tagName) + "" : "none"; }, [x, y]);
    }
    clickWidget.lastHit = last;
    return null;
  };
  const dragFrom = async (x, y, dx, dy) => { await page.mouse.move(x, y); await sleep(70); await page.mouse.down(); await sleep(110); await page.mouse.move(x + dx, y + dy, { steps: 12 }); await sleep(110); await page.mouse.up(); await sleep(420); };
  const dragArc = async (btn, cx, cy, deg) => {
    const bb = await btn.boundingBox(); const sx = bb.x + bb.width / 2, sy = bb.y + bb.height / 2, r = Math.hypot(sx - cx, sy - cy), a0 = Math.atan2(sx - cx, -(sy - cy));
    await page.mouse.move(sx, sy); await sleep(70); await page.mouse.down(); await sleep(140);
    for (let i = 1; i <= 18; i++) { const a = a0 + (deg * Math.PI / 180) * (i / 18); await page.mouse.move(cx + r * Math.sin(a), cy - r * Math.cos(a)); await sleep(32); }
    await page.mouse.up(); await sleep(420);
  };
  const acceptAsk = async () => { if (await page.locator("#pbx-ask").count()) { await page.click('#pbx-ask [data-k="ok"]').catch(() => {}); await sleep(300); } };

  for (const tpl of TEMPLATES) {
    console.log("\n════════ " + tpl + " ════════");
    try {
      const inst = await page.evaluate(async ([id, process_edit]) => { try { if (typeof AdminNav.libOpen === "function") { await AdminNav.libOpen(); AdminNav.libClose(); } await (process_edit ? AdminNav.tplEdit(id) : AdminNav.tplInstallHome(id)); return true; } catch (e) { return e.message; } }, [tpl, SEC_MODE]);
      check(tpl, "install opens editor", inst === true, inst);
      await page.waitForFunction(() => typeof PBApp !== "undefined" && PBApp.E && PBApp.E.page && document.getElementById("pbx-frame"), null, { timeout: 40000 });
      await page.waitForFunction(() => { const f = document.getElementById("pbx-frame"); return f && f.contentDocument && f.contentDocument.querySelector('[data-kind="widget"]'); }, null, { timeout: 40000 }); await sleep(700);
      if (await page.locator("#pbx-ask").count()) await page.click('#pbx-ask [data-k="no"]').catch(() => {}); await sleep(300);

      const m0 = await model(); const W = all(m0);
      const nFree = W.filter(w => w.free).length;
      check(tpl, `inventory: ${W.length} elements (${nFree} free, ${W.length - nFree} flow)`, (SEC_MODE ? W.length >= 5 : (W.length >= 30 && nFree >= 2)) && W.every(w => w.type), `types=${[...new Set(W.map(w => w.type))].join(",")}`);

      // ── 1) تحديد كل عنصر بالفأرة ──
      const picked = {}, miss = [];
      for (const w of W) { const r = await clickWidget(w.id); if (r) picked[w.id] = r; else miss.push({ ...w, hit: clickWidget.lastHit }); }
      // ما لم يُحدَّد: يصنَّف (مغطّى بتصميم) إن كان يُحدَّد برمجياً وعنصر آخر فوقه عند مركزه
      const occl = [];
      for (const w of miss) {     // لا يُحدَّد بالفأرة: نصنّفه (مغطّى بعنصر آخر؟) ونحدّده من لوحة الطبقات (مسار واجهة حقيقي)
        const info = await page.evaluate(wid => {
          const f = document.getElementById("pbx-frame"), d = f.contentDocument, el = d.querySelector(`[data-kind="widget"][data-pb="${wid}"]`); if (!el) return { gone: true };
          const r = el.getBoundingClientRect(); const top = d.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const tw = top && top.closest('[data-kind="widget"]');
          return { over: tw ? tw.getAttribute("data-pb") : null };
        }, w.id);
        await uiClick('[data-lt="lay"]'); await sleep(250);
        const row = page.locator(`.pbx-lay [data-sel="${w.id}"]`).first();
        let viaLayers = false;
        if (await row.count()) { await row.click().catch(() => {}); await sleep(300); viaLayers = await selIs(w.id); }
        occl.push({ id: w.id, type: w.type, ...info, sel: viaLayers, hit: w.hit });
      }
      await clearSel();
      const direct = Object.keys(picked).length;
      check(tpl, `T1 كل العناصر قابلة للتحديد: ${direct}/${W.length} بالفأرة`, direct + occl.filter(o => o.sel).length === W.length, `بالفأرة=${direct}`);
      const unexplained = occl.filter(o => !(o.sel && o.over && o.over !== o.id));   // مغطّى فعلاً بعنصر آخر + يُحدَّد من الطبقات
      check(tpl, `T1b ما لم يُحدَّد بالفأرة (${occl.length}) مغطّى بعنصر آخر بالتصميم وقابل للتحديد من لوحة الطبقات`, unexplained.length === 0, occl.map(o => `${o.type}:${o.id}←${o.over}`).join("; ") + (unexplained.length ? " | غير مفسَّر: " + JSON.stringify(unexplained) : ""));

      // ── 2) سحب كل عنصر حر قابل للتحديد: هو وحده يتحرك ──
      let okDrag = 0, bad = [], tried = 0, nudged = 0;
      for (const w of W.filter(x => x.free && picked[x.id])) {
        tried++;
        const r = await clickWidget(w.id); if (!r) { bad.push(w.id + ":lost"); continue; }
        const before = snap(await model());
        // عنصر أرفع من 6px على الشاشة: مقبض التحجيم يغطي مركزه فيُحرَّك بأسهم لوحة المفاتيح (مسار واجهة حقيقي) بدل السحب
        if (r.bb.height < 6 || r.bb.width < 6) { for (let q = 0; q < 3; q++) { await page.keyboard.press("Shift+ArrowRight"); await sleep(120); await page.keyboard.press("Shift+ArrowDown"); await sleep(120); } await sleep(300); nudged++; }
        else await dragFrom(r.x, r.y, 26, 18);
        const after = snap(await model());
        const changed = Object.keys(after).filter(id => after[id] !== before[id]);
        const only = changed.length === 1 && changed[0] === w.id;
        await page.keyboard.press("Control+z"); await sleep(420);
        const back = snap(await model()); const restored = Object.keys(back).every(id => back[id] === before[id]);
        if (only && restored) okDrag++; else bad.push(`${w.type}:${w.id} moved=${changed.length}[${changed.map(c => c + ":" + before[c] + "→" + after[c]).join(" ; ")}] multi=${await page.evaluate(() => (PBApp.E.multi || []).length)} restored=${restored}`);
      }
      check(tpl, `T2 سحب كل عنصر حر قابل للتحديد يحرّكه وحده ثم يُستعاد بالتراجع: ${okDrag}/${tried} (منها ${nudged} رفيعة حُرّكت بالأسهم)`, tried > 0 && okDrag === tried, bad.slice(0, 4).join("; "));

      // ── 3) عمليات على عنصر البطل (أكبر صورة حرة) ──
      const hero = W.filter(x => x.free && x.type === "image").sort((a, b) => (Number(val(b.set, "fh")) || 0) - (Number(val(a.set, "fh")) || 0))[0];
      if (!hero) { console.log(`N/A  [${tpl}] T3 لا صورة حرة في هذا القالب (بطله متدفّق بالتصميم) — تحجيم/تدوير العنصر الحر مغطّاة في T2 وبطارية free-elements-qa`); }
      else {
        const hid = hero.id; const fr = page.locator("#pbx-frame").contentFrame();
        const heroOrNull = async () => await clickWidget(hid);
        // تحجيم
        let p = await heroOrNull(); const s0 = (await model()); const hw0 = all(s0).find(w => w.id === hid); const f0 = [val(hw0.set, "fwd"), val(hw0.set, "fh")];
        const hnd = page.locator("#pbx-ovl .pbx-h.d-se");
        if (p && await hnd.count()) { const hb = await hnd.first().boundingBox(); await dragFrom(hb.x + hb.width / 2, hb.y + hb.height / 2, 40, 30); }
        const hw1 = all(await model()).find(w => w.id === hid); const f1 = [val(hw1.set, "fwd"), val(hw1.set, "fh")];
        check(tpl, "T3a تحجيم عنصر البطل بالمقبض", Math.abs(f1[0] - f0[0]) > 0.3 || Math.abs(f1[1] - f0[1]) > 3, `fwd/fh ${f0}→${f1}`);
        await page.keyboard.press("Control+z"); await sleep(400);
        // تدوير زاوي
        p = await heroOrNull(); const rotBtn = page.locator("#pbx-ovl .pbx-sb button").first();
        if (p && await rotBtn.count()) { const bb = await fr.locator(`[data-kind="widget"][data-pb="${hid}"]`).boundingBox(); await dragArc(rotBtn, bb.x + bb.width / 2, bb.y + bb.height / 2, 50); }
        const rot1 = Number(val(all(await model()).find(w => w.id === hid).set, "rot")) || 0;
        check(tpl, "T3b تدوير عنصر البطل بالمقبض", Math.abs(rot1) > 1, "rot=" + rot1);
        await page.keyboard.press("Control+z"); await sleep(400);
        // تكرار ثم حذف
        await heroOrNull(); const c0 = all(await model()).length;
        let dupOk = false, delOk = false;
        if (await page.locator('.pbx-ft button[data-k="dup"]').count()) {
          await uiClick('.pbx-ft button[data-k="dup"]'); await sleep(550); const c1 = all(await model()).length; dupOk = c1 === c0 + 1;
          if (await page.locator('.pbx-ft button[data-k="del"]').count()) { await uiClick('.pbx-ft button[data-k="del"]'); await sleep(400); await acceptAsk(); await sleep(400); delOk = all(await model()).length === c0; }
        }
        check(tpl, "T3c تكرار عنصر البطل ثم حذف النسخة", dupOk && delOk, `dup=${dupOk} del=${delOk}`);
        // إخفاء على المكتب ثم إظهار
        await heroOrNull(); let hideOk = false;
        if (await page.locator('button[data-vis="hd"]').count()) {
          await uiClick('button[data-vis="hd"]'); await sleep(450); const hidden = !!all(await model()).find(w => w.id === hid).set.hd;
          await uiClick('button[data-vis="hd"]'); await sleep(450); const shown = !all(await model()).find(w => w.id === hid).set.hd; hideOk = hidden && shown;
        }
        check(tpl, "T3d إخفاء عنصر البطل على المكتب ثم إظهاره", hideOk);
        // قفل يمنع السحب
        await heroOrNull(); let lockOk = false;
        if (await page.locator('.pbx-ft button[data-k="lock"]').count()) {
          await uiClick('.pbx-ft button[data-k="lock"]'); await sleep(450); const locked = !!all(await model()).find(w => w.id === hid).set.locked;
          const pre = snap(await model())[hid]; const q = await clickWidget(hid);
          if (q) await dragFrom(q.x, q.y, 40, 30); const post = snap(await model())[hid];
          await clickWidget(hid); await uiClick('.pbx-ft button[data-k="lock"]'); await sleep(450);
          lockOk = locked && pre === post && !all(await model()).find(w => w.id === hid).set.locked;
        }
        check(tpl, "T3e قفل عنصر البطل يمنع السحب ثم فكّه", lockOk);
      }
      await clearSel();
    } catch (e) { check(tpl, "اكتمال التشغيل بلا انهيار", false, e.message); }
  }
  check("all", "لا أخطاء JS في الصفحة", jsErrs.length === 0, jsErrs.slice(0, 3).join(" | "));
  const f = results.filter(r => !r.pass).length;
  console.log(`\n${results.length - f}/${results.length} PASS` + (f ? ` — ${f} FAILURES` : " — 0 FAILURES"));
  await browser.close(); process.exit(f ? 1 : 0);
})();
