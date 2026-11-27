/* خطوة حجم الخط (+/−) في شريط التنسيق: في عنصر حر داخل قسم متناسب وله «حجم محتوى %» (wsc) يدمجه المُصيِّر في الخط (fs×wsc)، فكانت الخانة تقرأ المرسوم (46) وتكتبه كقيمة تصميم فتُضاعَف ثانيةً فتقفز (46 ← 83 ← 148). الآن الخطوة ±1 على قيمة التصميم. NODE_PATH=/opt/node-tools/node_modules */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ ...devices["Pixel 7"] }), p = await c.newPage(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  await p.evaluate(() => {
    document.getElementById("app").classList.remove("hidden"); window.toast = () => { };
    const w = (id, html, fs, wsc) => ({ id, type: "text", set: { html, fs, color: "#123", fw: "900", fx: { d: 10, t: 10, m: 8 }, fy: { d: 40, t: 30, m: 60 }, fwd: { d: 30, t: 30, m: 60 }, fh: { d: 100, t: 80, m: 90 }, zi: 2, hauto: false, wsc } });
    const pg = { v: 1, title: "t", slug: "t-fs", ff: "Cairo", css: "", sections: [{ id: "s1", set: { kind: "canvas", scaled: true, dw: 1274, cw: { d: 1274 }, layout: "full", mh: { d: 400, m: 500, t: 300 }, pad: { d: [0, 0, 0, 0] }, scaledT: true, scaledM: true }, free: [w("wz", "<p>مع زوم</p>", { d: 12, m: 26, t: 8 }, { d: 464, m: 176 }), w("wp", "<p>بلا زوم</p>", { d: 20, m: 28, t: 16 }, undefined)], cols: [{ id: "c1", widgets: [] }] }] };
    PBApp.open(pg, "", true);
  }); await p.waitForTimeout(3500);
  const step = id => p.evaluate(async id => { const w = ms => new Promise(r => setTimeout(r, ms)), val = () => document.querySelector('#pbx-qbar [data-qi="fs"]').value, out = [];
    PBApp.E.sel = id; PBApp.renderInspectorNow && PBApp.renderInspectorNow(); await w(400); out.push(Number(val()));
    for (const k of ["fs+", "fs+", "fs+", "fs-", "fs-"]) { document.querySelector('#pbx-qbar [data-qb="' + k + '"]').click(); await w(400); out.push(Number(val())); } return out; }, id);
  const A = await step("wz"), B = await step("wp");
  const d1 = a => a.slice(1).map((v, i) => v - a[i]);
  t("عنصر بحجم محتوى 176%: الرقم المعروض هو الحجم الفعلي (26×1.76≈46) والخطوة ±1 عليه بلا قفزة", d1(A).join() === "1,1,1,-1,-1" && A[0] === 46, A);
  t("عنصر بلا حجم محتوى: الخطوة ±1 أيضاً (لا تراجع)", d1(B).join() === "1,1,1,-1,-1" && B[0] === 28, B);
  const fsSet = await p.evaluate(() => { const f = s => JSON.stringify(s.set.fs); const sec = (PBApp.E.page || PBApp.E.pg).sections[0]; return sec.free.map(x => x.id + ":" + JSON.stringify(x.set.fs)); });
  t("القيمة المخزَّنة (التصميم) تتحرك بخطوة صغيرة لا ضعفاً: بعد صافي +1 فعلي: 26 ← ≈26.7 (مع الزوم) و28 ← 29 (بلا زوم)", /"m":(26|27)(\.\d)?\b/.test(fsSet[0]) && /"m":29\b/.test(fsSet[1]), fsSet);
  /* تكبير الإطار (حجم محتوى العنصر %) يغيّر الرقم المعروض فوراً */
  const E1 = await p.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)), val = () => Number(document.querySelector('#pbx-qbar [data-qi="fs"]').value), ws = (PBApp.E.page || PBApp.E.pg).sections[0].free, a = ws.find(x => x.id === "wz"); PBApp.E.sel = "wz"; PBApp.renderInspectorNow && PBApp.renderInspectorNow(); await w(300); const v0 = val(); a.set.wsc = { d: 464, m: 264 }; PBApp.renderCanvas(); await w(600); PBApp.E.sel = "wz"; PBApp.renderInspectorNow && PBApp.renderInspectorNow(); await w(400); return { v0, v1: val() }; });
  t("تكبير الإطار (wsc 176% ← 264%) يرفع الرقم في الشريط ≈1.5× (لا يبقى ثابتاً)", E1.v1 > E1.v0 * 1.35 && E1.v1 < E1.v0 * 1.65, E1);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
