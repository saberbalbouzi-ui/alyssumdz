/* غطاء «جارٍ التحديث…» (قبل الإعادة وبعدها) يتمركز في المساحة المرئية حتى حين تتّسع نافذة التخطيط عن الشاشة (جوال/تكبير): بمحاكاة visualViewport أضيق. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const p = await b.newPage({ viewport: { width: 420, height: 800 } }); const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); sessionStorage.setItem("au_state", JSON.stringify({ pb: 1, t: Date.now() })); } catch (e) { }
    const vv = new EventTarget(); Object.assign(vv, { width: 300, height: 700, offsetTop: 0, offsetLeft: 0, scale: 1 }); window.__vv = vv; Object.defineProperty(window, "visualViewport", { get: () => vv, configurable: true }); });
  await p.goto("http://localhost:8766/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(1500);
  const geo = () => p.evaluate(() => { const c = document.getElementById("au-cover"); if (!c) return null; const r = c.getBoundingClientRect(), kids = [...c.children].filter(k => k.tagName === "SPAN").map(k => { const q = k.getBoundingClientRect(); return Math.round(q.left + q.width / 2); }); return { l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), kids }; });
  const g1 = await geo();
  t("الغطاء المبكر بعد الإعادة يطابق المساحة المرئية (300×700) ومحتواه في وسطها", g1 && g1.l === 0 && g1.w === 300 && g1.h === 700 && g1.kids.every(x => Math.abs(x - 150) <= 2), g1);
  await p.waitForTimeout(9000);
  await p.evaluate(() => { document.getElementById("au-cover") && document.getElementById("au-cover").remove(); AdminUpdate.showCover("جارٍ التحديث… سيُعاد فتح عملك تلقائياً"); }); await p.waitForTimeout(400);
  const g2 = await geo();
  t("غطاء «جارٍ التحديث» (showCover) في وسط المساحة المرئية لا وسط نافذة التخطيط الأوسع", g2 && g2.l === 0 && g2.w === 300 && g2.kids.every(x => Math.abs(x - 150) <= 2), g2);
  await p.evaluate(() => { __vv.width = 380; __vv.offsetLeft = 20; __vv.dispatchEvent(new Event("resize")); }); await p.waitForTimeout(400);
  const g3 = await geo(); t("يتبع تغيّر المنظور (تكبير/تحريك) فوراً", g3 && g3.l === 20 && g3.w === 380 && g3.kids.every(x => Math.abs(x - 210) <= 2), g3);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
