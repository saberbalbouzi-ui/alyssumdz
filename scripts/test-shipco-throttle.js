/* publishShipCo: لا commit إن لم يتغيّر المحتوى، ومرة كل 3 أيام للتغيّر البسيط، وforce فوري. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ serviceWorkers: "block", viewport: { width: 1200, height: 800 } }), p = await c.newPage(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => { if (!/serviceWorker/.test(String(e))) errs.push(String(e).slice(0, 140)); });
  let served = null;
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|generativelanguage/, r => r.abort());
  await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.route(/assets\/data\/ship-co\.json/, r => served ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(served) }) : r.continue());
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(7000);
  const R = await p.evaluate(async () => {
    document.getElementById("app").classList.remove("hidden"); await new Promise(r => setTimeout(r, 2000));
    let puts = 0; PBApp.putJson = async () => { puts++; };
    const d = Admin.shipCoData(), body = { def: d.def, dk: d.dk, dp: d.dp, noStop: d.noStop, companies: d.companies, sup: d.sup, cp: d.cp, nd: d.nd };
    return { body };
  });
  served = Object.assign({ updated: "2020-01-01" }, R.body);                       // المنشور = الحالي (فرق updated فقط)
  const out = await p.evaluate(async () => {
    let puts = 0; PBApp.putJson = async () => { puts++; }; const r = {};
    localStorage.removeItem("alyssum_shipco_pub_at"); await Admin.publishShipCo(); r.same = puts; puts = 0; return r; });
  t("محتوى مطابق للمنشور (updated فقط يختلف) ← بلا commit", out.same === 0, out);
  served = Object.assign({ updated: "2020-01-01" }, R.body, { def: "other-co" });  // المنشور مختلف
  const o2 = await p.evaluate(async () => { let puts = 0; PBApp.putJson = async () => { puts++; }; const r = {};
    localStorage.setItem("alyssum_shipco_pub_at", String(Date.now() - 864e5)); await Admin.publishShipCo(); r.recent = puts; puts = 0;
    await Admin.publishShipCo(true); r.force = puts; puts = 0;
    localStorage.setItem("alyssum_shipco_pub_at", String(Date.now() - 4 * 864e5)); await Admin.publishShipCo(); r.old = puts; puts = 0;
    localStorage.removeItem("alyssum_shipco_pub_at"); await Admin.publishShipCo(); r.never = puts; return r; });
  t("تغيّر + نُشر قبل يوم ← لا commit", o2.recent === 0, o2);
  t("force ← commit فوري", o2.force === 1, o2);
  t("تغيّر + آخر نشر قبل 4 أيام ← commit واحد", o2.old === 1, o2);
  t("تغيّر + لم يُنشر من قبل ← commit", o2.never === 1, o2);
  t("بلا أخطاء JS", !errs.length, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
