/* شريط التحديد المتعدد (نسخ/تكرار/ربط/محاذاة/حذف) ثابت دائماً أعلى المنصة: لا يحجب الصفحة فوق العناصر المحدَّدة ولا يتحرك مع موضعها أو مع التمرير. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 800 } }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  await p.evaluate(() => {
    document.getElementById("app").classList.remove("hidden"); window.toast = () => { };
    const w = (id, x, y) => ({ id, type: "text", set: { html: "<p>عنصر " + id + "</p>", fs: { d: 20, t: 16, m: 18 }, color: "#123", fx: { d: x, t: x, m: 10 }, fy: { d: y, t: y, m: y }, fwd: { d: 20, t: 20, m: 60 }, fh: { d: 60, t: 60, m: 60 }, zi: 2, hauto: false } });
    PBApp.open({ v: 1, title: "t", slug: "t-mb", ff: "Cairo", css: "", sections: [{ id: "s1", set: { kind: "canvas", mh: { d: 1800, m: 1800, t: 1800 }, pad: { d: [0, 0, 0, 0] } }, free: [w("a", 5, 40), w("b", 30, 60), w("c", 55, 300), w("d", 5, 900), w("e", 40, 1000)], cols: [{ id: "c1", widgets: [] }] }] }, "", true);
  }); await p.waitForTimeout(3500);
  const pos = () => p.evaluate(() => { const bar = document.querySelector("#pbx-ovl .pbx-mt"), st = document.getElementById("pbx-stage"); if (!bar) return null; const r = bar.getBoundingClientRect(), s = st.getBoundingClientRect(); return { top: Math.round(r.top - s.top), left: Math.round(r.left - s.left), n: (bar.querySelector("b") || {}).textContent, scroll: st.scrollTop }; });
  const sel = (ids) => p.evaluate(async ids => { PBApp.E.sel = ids[0]; PBApp.E.multi = ids; PBApp.positionOverlay ? PBApp.positionOverlay() : 0; PBApp.afterSel && PBApp.afterSel(); await new Promise(r => setTimeout(r, 400)); }, ids);
  await sel(["a", "b", "c"]); await p.evaluate(() => PBApp.renderCanvas && PBApp.renderCanvas()); await p.waitForTimeout(600);
  const A = await pos();
  await p.evaluate(() => { PBApp.E.sel = "d"; PBApp.E.multi = ["d", "e"]; PBApp.renderCanvas(); }); await p.waitForTimeout(700);
  const B = await pos();
  await p.evaluate(() => { document.getElementById("pbx-stage").scrollTop = 500; }); await p.waitForTimeout(600); const C = await pos();
  t("الشريط موجود للتحديد المتعدد", A && B && C, { A, B, C });
  t("ثابت أعلى المنصة (≈8px) أياً كان موضع العناصر المحدَّدة (قرب الأعلى أو أسفل الصفحة)", A && B && A.top >= 4 && A.top <= 14 && B.top >= 4 && B.top <= 14, { A, B });
  t("لا يتحرك مع التمرير (يبقى أعلى المنصة بعد تمرير 500px)", C && C.scroll > 0 && C.top >= 4 && C.top <= 14, C);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
