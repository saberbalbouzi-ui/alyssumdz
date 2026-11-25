/* نقل عنصر إلى القسم الأسفل/الأعلى بأمر من قائمة العنصر (بلا سحب): يظهر العنصر في القسم الهدف ويختفي من المصدر، وتهبط عناصر الهدف فلا تتراكب. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = m => { window.__t = m; };
    const w = (id, html, x, y, wd, h) => ({ id, type: "text", set: { html, fs: { d: 18 }, color: "#123", fx: { d: x }, fy: { d: y }, fwd: { d: wd }, fh: { d: h }, zi: 2, hauto: false } });
    const sec = (id, free, mh) => ({ id, set: { kind: "canvas", mh: { d: mh, t: mh, m: mh }, pad: { d: [0, 0, 0, 0] } }, free, cols: [{ id: "c" + id, widgets: [] }] });
    PBApp.open({ v: 1, title: "t", slug: "t-mv", ff: "Cairo", css: "", sections: [sec("sA", [w("pills", "<p>عسل طبيعي · الجنكة · إكليل الجبل</p>", 15, 60, 50, 60)], 300), sec("sB", [w("old", "<p>قسم المكونات القديم</p>", 10, 30, 60, 80)], 400)], }, "", true); await new Promise(r => setTimeout(r, 2500)); });
  const st = () => p.evaluate(() => { const S = PBApp.E.page.sections, n = x => Number(x && typeof x === "object" ? x.d : x); return { A: S[0].free.map(w => w.id), B: S[1].free.map(w => w.id + ":" + n(w.set.fy)), mhB: n(S[1].set.mh), mhA: n(S[0].set.mh) }; });
  const ctx = async txt => { const c = await p.evaluate(() => { const fr = document.getElementById("pbx-frame"), el = fr.contentDocument.querySelector('[data-pb="pills"]'), r = el.getBoundingClientRect(), f = fr.getBoundingClientRect(), k = PBApp.E.scale || 1; return { x: f.left + (r.left + r.width / 2) * k, y: f.top + (r.top + r.height / 2) * k }; }); await p.mouse.click(c.x, c.y); await p.waitForTimeout(300); await p.mouse.click(c.x, c.y, { button: "right" }); await p.waitForTimeout(400); return p.evaluate(txt => { const b = [...document.querySelectorAll("#pbx-ctx button")].find(x => x.textContent.includes(txt)); if (b) { b.click(); return true; } return false; }, txt); };
  const s0 = await st();
  t("الأمر ظاهر في قائمة العنصر وينفَّذ", await ctx("نقل إلى القسم الأسفل"));
  await p.waitForTimeout(800); const s1 = await st();
  t("العنصر انتقل إلى القسم الأسفل وغادر الأعلى", s0.A.includes("pills") && !s1.A.includes("pills") && s1.B.some(x => x.startsWith("pills:")), { s0, s1 });
  const fy = id => Number((s1.B.find(x => x.startsWith(id + ":")) || ":0").split(":")[1]);
  t("عنصر الهدف القديم هبط تحت العنصر المنقول فلا تراكب، وارتفاع القسم زاد", fy("old") > fy("pills") + 55 && s1.mhB > s0.mhB, { s1 });
  await ctx("نقل إلى القسم الأعلى"); await p.waitForTimeout(800); const s2 = await st();
  t("وبالأمر المعاكس يعود إلى القسم الأعلى", s2.A.includes("pills") && !s2.B.some(x => x.startsWith("pills:")), s2);
  await ctx("نقل إلى القسم الأعلى"); await p.waitForTimeout(400); const s3 = await st();
  t("لا قسم فوق الأول: لا تغيير ولا خطأ", JSON.stringify(s3) === JSON.stringify(s2), { s2, s3 });
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
