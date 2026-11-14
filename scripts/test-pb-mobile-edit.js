/* مطوّر الصفحات على الهاتف: لمستان سريعتان = تحرير النص، زر «تحرير» في الشريط، وتلوين كلمة محدّدة بمنتقي ألوان يسحب التركيز:
   python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-pb-mobile-edit.js */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ ...devices["Pixel 7"] }), p = await c.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  await p.evaluate(() => { const pg = PB.newPage("t", ""); pg.slug = "t-m"; pg.sections = [PB.TPLS.canvas.f()]; PBApp.open(pg, "", true); }); await p.waitForTimeout(2500);
  await p.evaluate(() => { const b = document.querySelector('[data-add="text"]'); b && b.click(); }); await p.waitForTimeout(900);
  const info = () => p.evaluate(() => { const f = document.getElementById("pbx-frame"), d = f.contentDocument, el = d.querySelector('[data-kind="widget"] [data-edit]'); if (!el) return null; const r = el.getBoundingClientRect(), fr = f.getBoundingClientRect(); return { x: fr.left + r.left + Math.min(r.width / 2, 60), y: fr.top + r.bottom - 8, n: d.querySelectorAll('[contenteditable=true]').length, editing: !!document.querySelector("#pb-app.pbx-ed"), txt: el.textContent }; });
  let i = await info(); ok("عنصر نص موجود", !!i, i); if (!i) { await b.close(); process.exit(1); }
  await p.evaluate(() => { const f = document.getElementById("pbx-frame"); f.contentDocument.querySelector('[data-kind="widget"] [data-edit]').scrollIntoView({ block: "center" }); }); await p.waitForTimeout(300); i = await info();
  await p.touchscreen.tap(i.x, i.y); await p.waitForTimeout(150); await p.touchscreen.tap(i.x, i.y); await p.waitForTimeout(500);
  const a = await info(); ok("لمستان سريعتان على النص تبدآن التحرير", a.n === 1 && a.editing, a);
  ok("حُدّدت كلمة (التحديد غير فارغ)", await p.evaluate(() => { const s = document.getElementById("pbx-frame").contentDocument.getSelection(); return !!s && String(s).trim().length > 0; }));
  /* لوحة الألوان داخل الصفحة (بدل منتقي النظام) تُطبَّق على الكلمة المحدَّدة */
  await p.evaluate(() => document.querySelector('#pbx-qbar label.qa').click()); await p.waitForTimeout(300);
  const sh = await p.evaluate(() => ({ pop: !!document.querySelector("#pbx-pop .cg"), n: document.querySelectorAll("#pbx-pop .cgb").length, title: (document.querySelector("#pbx-pop h6") || {}).textContent }));
  ok("لوحة ألوان داخل الصفحة تظهر بدل منتقي النظام (24 لوناً) وتخص الكلمة المحدَّدة", sh.pop && sh.n >= 24 && /الكلمة/.test(sh.title || ""), sh);
  await p.evaluate(() => document.querySelector('#pbx-pop [data-cc="#ef4444"]').click()); await p.waitForTimeout(300);
  const wc = await p.evaluate(() => { const e = document.getElementById("pbx-frame").contentDocument.querySelector("[contenteditable=true]"); return { editing: !!e, ok: !!e && /color:\s*(rgb\(239, 68, 68\)|#ef4444)/i.test(e.innerHTML), popClosed: !document.querySelector("#pbx-pop") }; });
  ok("اللون يُطبَّق على الكلمة المحدَّدة ويبقى التحرير وتُغلق اللوحة", wc.editing && wc.ok && wc.popClosed, wc);
  /* منتقي ألوان يسحب التركيز: نحاكيه بنقل التركيز إلى خانة اللون ثم إطلاق input */
  const res = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)), d = document.getElementById("pbx-frame").contentDocument, lab = document.querySelector('#pbx-qbar label.qa'), inp = lab && lab.querySelector('input[type=color]'); if (!inp) return { err: "no color input" };
    const before = d.querySelector('[contenteditable=true]').innerHTML;
    lab.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); inp.focus(); await w(250);            // blur للنص كما يفعل منتقي النظام
    const stillEditing = !!document.querySelector("#pb-app.pbx-ed");
    inp.value = "#ff0000"; inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true })); await w(200);
    const html = d.querySelector('[contenteditable=true]') ? d.querySelector('[contenteditable=true]').innerHTML : "(ended)";
    return { stillEditing, spans: /color:\s*(rgb\(255, 0, 0\)|#ff0000|red)/i.test(html), before: before.slice(0, 80), html: html.slice(0, 200) };
  });
  ok("التحرير يبقى بعد سحب التركيز", res.stillEditing, res);
  ok("اللون طُبّق على الكلمة المحدَّدة فقط (span)", res.spans, res);
  await p.touchscreen.tap(10, 700); await p.waitForTimeout(600);
  ok("اللمس خارج النص ينهي التحرير", (await info()).n === 0);
  await p.evaluate(() => { const el = document.getElementById("pbx-frame").contentDocument.querySelector('[data-kind="widget"] [data-edit]'); el.closest('[data-kind="widget"]').click(); }); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('#pbx-qbar label.qa').click()); await p.waitForTimeout(300);
  ok("بلا تحرير: اللوحة تخص النص كله", await p.evaluate(() => /النص كله/.test((document.querySelector("#pbx-pop h6") || {}).textContent || "")));
  await p.evaluate(() => document.querySelector('#pbx-pop [data-cc="#3b82f6"]').click()); await p.waitForTimeout(500);
  ok("لون النص كله يتغيّر في بيانات العنصر", await p.evaluate(() => { const f = document.getElementById("pbx-frame").contentDocument, e = f.querySelector('[data-kind="widget"] .pb-t'); return !!e && /rgb\(59, 130, 246\)/.test(getComputedStyle(e).color); }));
  /* زر «تحرير» في الشريط */
  await p.evaluate(() => { const el = document.getElementById("pbx-frame").contentDocument.querySelector('[data-kind="widget"] [data-edit]'); el.closest('[data-kind="widget"]').click(); }); await p.waitForTimeout(500);
  const hasBtn = await p.evaluate(() => !!document.querySelector('#pbx-qbar [data-qb="txedit"]')); ok("زر «تحرير» ظاهر في شريط النص", hasBtn);
  await p.evaluate(() => document.querySelector('#pbx-qbar [data-qb="txedit"]').click()); await p.waitForTimeout(500);
  ok("زر «تحرير» يبدأ التحرير", (await info()).n === 1);
  await p.evaluate(() => document.querySelector('#pbx-qbar [data-qb="txedit"]').click()); await p.waitForTimeout(500);
  ok("ضغطه ثانية ينهي التحرير", (await info()).n === 0);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
