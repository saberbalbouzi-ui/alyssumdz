/* أحجام خط شاذة (> 300) من خلل الخطوة القديم تُصلَح تلقائياً عند فتح الصفحة (والمسودة) وعند النشر: لا تتضخم النصوص ولا تنزاح إطارات التحديد عن عناصرها. NODE_PATH=/opt/node-tools/node_modules */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ ...devices["Pixel 7"] }), p = await c.newPage(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  const R = await p.evaluate(async () => {
    document.getElementById("app").classList.remove("hidden"); window.toast = () => { };
    const w = (id, fs, y) => ({ id, type: "text", set: { html: "<p>نص تجريبي طويل قليلاً " + id + "</p>", fs, color: "#123", fx: { d: 10, t: 10, m: 8 }, fy: { d: y, t: y, m: y }, fwd: { d: 40, t: 40, m: 80 }, fh: { d: 60, t: 60, m: 60 }, zi: 2, hauto: false } });
    const pg = { v: 1, title: "t", slug: "t-heal", ff: "Cairo", css: "", sections: [{ id: "s1", set: { kind: "canvas", scaled: true, dw: 1274, cw: { d: 1274 }, layout: "full", mh: { d: 600, m: 700, t: 500 }, pad: { d: [0, 0, 0, 0] }, scaledM: true, scaledT: true }, free: [w("a", { d: 12, t: 10, m: 900 }, 40), w("b", { d: 20, t: 18, m: 26 }, 200), w("c", 5000, 300), w("e", { d: 1200, m: 30 }, 400)], cols: [{ id: "c1", widgets: [] }] }] };
    PBApp.open(pg, "", true); await new Promise(r => setTimeout(r, 2500));
    const secs = PBApp.E.page.sections, ws = secs[0].free, d = document.getElementById("pbx-frame").contentDocument;
    const hs = [...d.querySelectorAll('[data-kind="widget"]')].map(e => Math.round(e.getBoundingClientRect().height));
    return { a: ws[0].set.fs, b: ws[1].set.fs, c: ws[2].set.fs, e: ws[3].set.fs, maxH: Math.max(...hs), docW: d.documentElement.scrollWidth, vw: d.documentElement.clientWidth };
  });
  t("المنفرد الشاذ يُستبدل بقيمة جهاز سليمة (m: 900 ← 12 من المكتب)", R.a.m === 12 && R.a.d === 12 && R.a.t === 10, R.a);
  t("القيم السليمة لا تُمسّ", JSON.stringify(R.b) === '{"d":20,"t":18,"m":26}', R.b);
  t("رقم مفرد شاذ (5000) ← 24، ومكتب شاذ (1200) ← قيمة الهاتف السليمة", R.c === 24 && R.e.d === 30 && R.e.m === 30, { c: R.c, e: R.e });
  t("لا تضخّم في الارتفاع ولا عرض صفحة زائد بعد الإصلاح", R.maxH < 400 && R.docW <= R.vw + 2, R);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
