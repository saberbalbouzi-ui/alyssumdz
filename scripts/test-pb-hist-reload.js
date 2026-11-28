/* سجلّ التراجع يبقى بعد إعادة التحميل (تحديث تلقائي): عدة مراحل لا آخر تعديل فقط. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ serviceWorkers: "block", viewport: { width: 1200, height: 900 } }), p = await c.newPage(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|generativelanguage/, r => r.abort());
  await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(5000);
  await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; PBApp.open({ v: 1, title: "t", slug: "t-hr", ff: "Cairo", css: "", sections: [{ id: "s1", set: { kind: "canvas", mh: { d: 300, t: 300, m: 300 } }, free: [], cols: [{ id: "c1", widgets: [] }] }] }, "", true); await new Promise(r => setTimeout(r, 1200)); const E = PBApp.E; for (const v of [400, 500, 600]) { E.page.sections[0].set.mh.d = v; PBApp.afterEdit("e" + v); await new Promise(r => setTimeout(r, 300)); } });
  await p.evaluate(() => window.dispatchEvent(new Event("pagehide"))); const has = await p.evaluate(() => !!sessionStorage.getItem("au_hist")); t("saveState يحفظ السجلّ", has);
  await p.reload({ waitUntil: "commit" }); await p.waitForTimeout(12000);
  const r = await p.evaluate(() => { const E = PBApp.E; return E && E.page ? { len: E.hist.length, hi: E.hi, v: E.page.sections[0].set.mh.d } : null; });
  t("بعد إعادة التحميل يبقى السجلّ (4 مراحل) على آخر حالة", r && r.len >= 4 && r.hi === r.len - 1 && r.v === 600, r);
  const pend = await p.evaluate(async () => { PBApp.E.page.sections[0].set.mh.d = 777; PBApp.undo(); await new Promise(r => setTimeout(r, 400)); const a = PBApp.E.page.sections[0].set.mh.d; PBApp.undo(); await new Promise(r => setTimeout(r, 400)); const b2 = PBApp.E.page.sections[0].set.mh.d; PBApp.redo(); PBApp.redo(); await new Promise(r => setTimeout(r, 400)); return [a, b2, PBApp.E.page.sections[0].set.mh.d]; });
  t("تعديل لم يُسجَّل بعد يُتراجع عنه وحده ثم مرحلة قبله", JSON.stringify(pend.slice(0, 2)) === "[600,500]", pend);
  const v = []; for (let i = 0; i < 3; i++) { await p.evaluate(() => PBApp.undo()); await p.waitForTimeout(400); v.push(await p.evaluate(() => PBApp.E.page.sections[0].set.mh.d)); }
  t("تراجع ثلاث مراحل متتالية بعد إعادة التحميل", JSON.stringify(v) === "[600,500,400]", v);
  await b.close(); process.exit(bad ? 1 : 0);
})();
