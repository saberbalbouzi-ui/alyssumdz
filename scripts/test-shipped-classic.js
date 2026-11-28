/* «الطلبات المسجلة»: القائمة القديمة (الأعمدة: Tracking/الحالة/الاسم/البلدية/الولاية/Stop Desk/Action) هي الافتراضية، واسم شركة التوصيل تحت التتبع دائماً وشارة SD بجانب الاسم. NODE_PATH=/opt/node-tools/node_modules */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ ...devices["iPhone 13"], colorScheme: "light" }), p = await c.newPage(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|generativelanguage/, r => r.abort());
  await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.setItem("admin_theme", "white"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(7000);
  const r = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; document.getElementById("login-box") && document.getElementById("login-box").classList.add("hidden"); document.dispatchEvent(new Event("pointerdown")); await new Promise(r => setTimeout(r, 4000));
    const mk = (id, st, co, trk, name, w, dt) => ({ id, date: new Date().toISOString(), name, phone: "0550000" + id.slice(-3), wilaya: w, commune: "x", dtype: dt, desk: dt === "stop" ? "مكتب" : "", items: "عسل ×1", subtotal: 2000, fee: 0, total: 2000, status: st, note: "🚚" + co + ":" + trk });
    Admin.orders = [mk("S1", "expediee", "yalidine", "yal-1", "علي", "Alger", "stop"), mk("S2", "expediee", "yalidine", "yal-2", "سمير", "Oran", "home")];
    Admin.tab("shipped"); await new Promise(r => setTimeout(r, 800)); Admin.tab("shipped"); await new Promise(r => setTimeout(r, 1500));
    const soft = !!document.getElementById("sh-soft"); Admin.tab("orders"); await new Promise(r => setTimeout(r, 800)); const sc = document.getElementById("order-show-shipped"); if (sc) sc.checked = true; try { Admin.applyOrderFilters(); } catch (e) { } await new Promise(r => setTimeout(r, 600));
    const rows = [...document.querySelectorAll("#orders-table tr")].filter(x => x.querySelector(".nm"));
    return { soft, rows: rows.length, co: rows.map(x => (x.querySelector(".o-src.co") || {}).textContent || ""), sd: rows.map(x => !!x.querySelector(".o-src.sd")), names: rows.map(x => x.querySelector(".nm b").textContent) };
  });
  t("قائمة «الطلبات المسجلة» القديمة هي المعروضة (لا تصميم الطلبات المسجلة الجديد)", !r.soft, r);
  const i1 = r.names.indexOf("علي"), i2 = r.names.indexOf("سمير");
  t("الطلب في قائمة الطلبات يحمل اسم شركة التوصيل، وSD لطلب المكتب فقط", i1 >= 0 && i2 >= 0 && /Yalidine/.test(r.co[i1]) && /Yalidine/.test(r.co[i2]) && r.sd[i1] && !r.sd[i2], r);
  await b.close(); process.exit(bad ? 1 : 0);
})();
