/* استوديو 3D (المحرّر): زر ☰ «قائمة المشروع» محذوف على الحاسوب (كان يفتح شريطاً مقصوصاً) ويبقى زر الحفظ؛ وعلى الجوال يبقى. NODE_PATH=/opt/node-tools/node_modules */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  for (const [name, ctxo, want] of [["مكتب", { viewport: { width: 1280, height: 800 } }, false], ["هاتف", { ...devices["Pixel 7"] }, true]]) {
    const c = await b.newContext(ctxo), p = await c.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
    await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
    await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
    const r = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); await new Promise(r => setTimeout(r, 800)); try { Studio3D.open({ tab: "box" }); } catch (e) { } let m = null; for (let i = 0; i < 40 && !m; i++) { await new Promise(r => setTimeout(r, 300)); m = document.getElementById("menuBtn"); }
      await new Promise(r => setTimeout(r, 800)); const sv = document.getElementById("saveBtn"); return m ? { menu: getComputedStyle(m).display !== "none", save: !!sv && getComputedStyle(sv).display !== "none" } : null; });
    t(name + ": زر ☰ " + (want ? "ظاهر" : "محذوف"), r && r.menu === want, r); t(name + ": زر الحفظ ظاهر", r && r.save, r); t(name + ": بلا أخطاء", errs.length === 0, errs); await c.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
