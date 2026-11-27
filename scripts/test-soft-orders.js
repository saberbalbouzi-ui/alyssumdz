/* المظهر الناعم: بطاقات إحصاء الطلبات تعرض أعداداً صحيحة، وزرّا التحقق/الأرشيف متجاوران، وتجهيز الطلبات فيه رأس. NODE_PATH=/opt/node-tools/node_modules */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ ...devices["iPhone 13"], colorScheme: "light" }), p = await c.newPage(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|generativelanguage/, r => r.abort());
  await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.setItem("admin_theme", "white"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(7000);
  const r = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; document.getElementById("login-box") && document.getElementById("login-box").classList.add("hidden"); await new Promise(r => setTimeout(r, 2500));
    const mk = (id, st, d) => ({ id, date: new Date(Date.now() - d * 864e5).toISOString(), name: "ز" + id, phone: "0550000" + id.slice(-3), wilaya: "Alger", commune: "x", dtype: "home", items: "عسل ×1 = 2000 DA", subtotal: 2000, fee: 0, total: 2000, status: st, note: "" });
    Admin.orders = [mk("A1", "expediee", 0), mk("A2", "nouvelle", 0), mk("A3", "nouvelle", 2), mk("A4", "livree", 5), mk("A5", "confirmee", 1)];
    Admin.tab("orders"); await new Promise(r => setTimeout(r, 800)); Admin.tab("orders"); await new Promise(r => setTimeout(r, 2000));
    const g = id => (document.getElementById(id) || {}).textContent, v = document.getElementById("verify-btn").getBoundingClientRect(), a = document.getElementById("presend-btn").getBoundingClientRect(), m = document.getElementById("mo-btn").getBoundingClientRect();
    return { total: g("os-total"), today: g("os-today"), wait: g("os-wait"), way: g("os-way"), sameRow: Math.abs(v.top - a.top) < 6 && Math.abs(v.left - a.left) > 40, moFull: m.width > 0.8 * (v.width + a.width), moFirst: m.top < v.top }; });
  t("الإجمالي 5 · اليوم 2 · الانتظار 2 · الطريق 1", r.total === "5" && r.today === "2" && r.wait === "2" && r.way === "1", r);
  t("«إضافة طلب جديد» أول وأعرض، والزرّان الثانويان في صف واحد", r.moFull && r.moFirst && r.sameRow, r);
  const k = await p.evaluate(async () => { Admin.tab("pack"); await new Promise(r => setTimeout(r, 1200)); AdminPack._S.err = ""; AdminPack._S.busy = false; AdminPack._S.rows = [{ id: "A1", name: "ز", wilaya: "Alger", items: "عسل ×2 = 4000 DA", status: "confirmee", packed: false }]; AdminPack.draw(); await new Promise(r => setTimeout(r, 500)); return { head: !!document.querySelector("#pk .ord-head h2"), cam: !!document.querySelector('#pk [data-pk="cam"]') }; });
  t("تجهيز الطلبات: رأس الصفحة وزر الكاميرا", k.head && k.cam, k);
  t("بلا أخطاء JS", !errs.length, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
