/* زر «تحديث» في الطلبات المسجلة: عملية واحدة بالتتابع، والضغطة الثانية أثناء الجريان تُتجاهل. NODE_PATH=/opt/node-tools/node_modules node scripts/test-refresh-single.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, log = [], wait = ms => new Promise(r => setTimeout(r, ms)); window.toast = m => log.push("T:" + m);
    A._shipCo = "wecan"; A.allDeliveryCompanies = () => ({ wecan: { name: "W" } });
    A.syncShipping = async () => { log.push("sync-start"); await wait(150); log.push("sync-end"); };
    A.extRefresh = async () => { log.push("load-start"); await wait(100); log.push("load-end"); };
    const p1 = A.refreshShipped(); await wait(30); const p2 = A.refreshShipped(); await Promise.all([p1, p2]); await A.refreshShipped();
    return log;
  });
  const i = k => R.indexOf(k);
  t("بالتتابع: التحديث ينتهي قبل أن يبدأ الجلب", i("sync-end") > -1 && i("load-start") > i("sync-end"), R);
  t("الضغطة الثانية أثناء الجريان تُتجاهل برسالة", R.filter(x => x === "sync-start").length === 2 && R.some(x => /جارٍ بالفعل/.test(x)), R);
  t("بعد الانتهاء تعمل الضغطة التالية (دورتان فقط)", R.filter(x => x === "load-end").length === 2, R);
  t("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  await b.close(); process.exit(bad ? 1 : 0);
})();
