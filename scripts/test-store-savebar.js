/* إعدادات المتجر: زر «حفظ» في شريط ثابت أسفل الشاشة يبقى ظاهراً بلا تمرير إلى نهاية الصفحة، ويظهر «تعديلات غير محفوظة» عند التعديل. NODE_PATH=/opt/node-tools/node_modules */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  for (const [name, ctxo] of [["هاتف", { ...devices["Pixel 7"] }], ["مكتب", { viewport: { width: 1280, height: 800 } }]]) {
    const c = await b.newContext(ctxo), p = await c.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
    await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
    await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
    const r = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); Admin.tab("store"); await new Promise(r => setTimeout(r, 2500)); try { AdminStores.tog("cur"); } catch (e) { } await new Promise(r => setTimeout(r, 600)); window.scrollTo(0, 0); const sc = document.scrollingElement; sc.scrollTop = 0; await new Promise(r => setTimeout(r, 300));
      const bar = document.querySelector(".stp-savebar"); if (!bar) return { err: "no bar", html: !!document.getElementById("stores-app") };
      const r0 = bar.getBoundingClientRect(), d0 = document.getElementById("stp-dirty").hidden; const inp = document.getElementById("stp-name") || document.querySelector(".stp input"); inp.value = inp.value + "x"; inp.dispatchEvent(new Event("input", { bubbles: true }));
      return { top: Math.round(r0.top), bottom: Math.round(r0.bottom), vh: innerHeight, docH: document.documentElement.scrollHeight, dirtyBefore: d0, dirtyAfter: document.getElementById("stp-dirty").hidden }; });
    t(name + ": شريط الحفظ ظاهر داخل الشاشة دون تمرير للنهاية", !r.err && r.bottom <= r.vh + 2 && r.top >= 0 && r.docH > r.vh, r);
    t(name + ": «تعديلات غير محفوظة» تظهر عند التعديل", r.dirtyBefore === true && r.dirtyAfter === false, r);
    t(name + ": بلا أخطاء", errs.length === 0, errs); await c.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
