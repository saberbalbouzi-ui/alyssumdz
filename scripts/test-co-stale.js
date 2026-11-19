/* طرد أُرسل ولا حالة من الشركة منذ 30 دقيقة ⟵ تنبيه بدل «تم الإرسال للشركة»: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-co-stale.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1000, height: 1200 } }); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, out = {}; window.toast = () => { }; const wait = ms => new Promise(r => setTimeout(r, ms));
    const mk = (id, note, st) => ({ id, date: new Date().toISOString(), name: "ز", phone: "0550000000", wilaya: "Tindouf", commune: "c", dtype: "home", items: "منتج ×1 = 1000 DA", subtotal: 1000, fee: 0, total: 1000, extra: {}, status: st || "confirmee", note });
    A.orders = [mk("A1", "🚚wecan:WS-ALY-aaa"), mk("A2", "🚚wecan:WS-ALY-bbb"), mk("A3", "🚚wecan:WS-ALY-ccc"), mk("A4", "", "nouvelle")];
    A.shipRaw = { A1: { raw: "تم الإرسال للشركة" }, A2: { raw: "تم الإرسال للشركة" }, A3: { raw: "En préparation" } };
    localStorage.removeItem("alyssum_ship_ns"); A._ns = null;
    out.before = A.orders.map(o => A.coStale(o));
    A.noStatusMark("A1", true); A.noStatusMark("A3", true); out.fresh = A.coStale(A.orders[0]);
    A._ns.A1 = Date.now() - 45 * 60000; A._ns.A3 = Date.now() - 45 * 60000; localStorage.setItem("alyssum_ship_ns", JSON.stringify(A._ns));
    out.stale = A.orders.map(o => A.coStale(o));
    A.orders.forEach((o, i) => { }); AdminHome.render(); const html = document.getElementById("ahome").innerText; out.home = /لا حالة من الشركة بعد/.test(html);
    A.orderFilters = {}; A.renderOrders(); A.openOrderPreview(0); await wait(300); out.prev = /لا حالة من الشركة منذ مدة/.test(document.getElementById("ord-prev-b").innerText);
    A.noStatusMark("A1", false); out.cleared = !A.coStale(A.orders[0]) && !(A._ns || {}).A1;
    return out; });
  ok("بلا علامة 'بلا حالة' لا تنبيه (حتى لو الحالة «تم الإرسال للشركة»)", R.before.every(x => x === false), R.before);
  ok("قبل مرور 30 دقيقة لا تنبيه", R.fresh === false, R.fresh);
  ok("بعد 30 دقيقة بلا حالة: A1 فقط (A2 بلا علامة، A3 لها حالة En préparation، A4 جديد)", JSON.stringify(R.stale) === JSON.stringify([true, false, false, false]), R.stale);
  ok("الرئيسية تعرض «⚠️ لا حالة من الشركة بعد» بدل العبارة المضلِّلة", R.home, R.home);
  ok("معاينة الطلب تحذّر وتوجّه لمراجعته عند الشركة", R.prev, R.prev);
  ok("وصول حالة من الشركة يمسح العلامة", R.cleared, R.cleared);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
