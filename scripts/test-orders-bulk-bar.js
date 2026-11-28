/* الطلبات (المظهر الناعم): عند تحديد الطلبات يظهر شريط الإجراءات الجماعية وفيه «إرسال المحدد للشركة» و«تأكيد المحدد». NODE_PATH=/opt/node-tools/node_modules */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  for (const theme of ["white", "dark"]) {
    const c = await b.newContext({ ...devices["iPhone 13"], colorScheme: theme === "white" ? "light" : "dark" }), p = await c.newPage();
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|generativelanguage/, r => r.abort());
    await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.addInitScript(th => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.setItem("admin_theme", th); } catch (e) { } }, theme);
    await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(7000);
    const r = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; document.getElementById("login-box") && document.getElementById("login-box").classList.add("hidden");
      const mk = (id, st, d) => ({ id, date: new Date(Date.now() - d * 864e5).toISOString(), name: "ز" + id, phone: "0550000" + id.slice(-3), wilaya: "Alger", commune: "x", dtype: "home", items: "عسل ×1 = 2000 DA", subtotal: 2000, fee: 0, total: 2000, status: st, note: "" });
      document.dispatchEvent(new Event("pointerdown")); await new Promise(r => setTimeout(r, 4000)); Admin.orders = [mk("B1", "confirmee", 0), mk("B2", "confirmee", 1), mk("B3", "nouvelle", 2)]; Admin.tab("orders"); await new Promise(r => setTimeout(r, 900)); Admin.tab("orders"); await new Promise(r => setTimeout(r, 600));
      try { Admin.renderOrders(); } catch (e) { } await new Promise(r => setTimeout(r, 600)); const ck = document.querySelector("#orders-table input.op-ck[data-all]"); if (!ck) return { noCk: true, rows: document.querySelectorAll("#orders-table tr").length, ords: Admin.orders.length, f: (Admin.getFilteredOrders() || []).length, tab: !document.getElementById("tab-orders").classList.contains("hidden") }; ck.click(); await new Promise(r => setTimeout(r, 500));
      const tabs = [...document.querySelectorAll("[id^=tab-]")].filter(e => getComputedStyle(e).display !== "none").map(e => e.id).join(","); const bulk = document.getElementById("op-bulk"), send = bulk && bulk.querySelector('[data-b="send"]'), conf = bulk && bulk.querySelector('[data-b="confirm"]'), vis = e => { if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return cs.display !== "none" && r.width > 20 && r.height > 10 && r.bottom <= innerHeight + 1 && r.top >= 0; };
      const dbg = bulk ? { d: getComputedStyle(bulk).display, pos: getComputedStyle(bulk).position, r: JSON.stringify(bulk.getBoundingClientRect()), ih: innerHeight, par: (() => { const o = []; for (let e = bulk; e && e !== document.body; e = e.parentElement) { const d = getComputedStyle(e).display; if (d === "none" || e.hidden) o.push((e.id || e.className) + ":" + d); } return o.join(" > "); })(), sr: send && JSON.stringify(send.getBoundingClientRect()), sd: send && getComputedStyle(send).display } : null; return { tabs, cls: document.getElementById("tab-orders").className, dbg, on: bulk && bulk.classList.contains("on"), bulkVis: vis(bulk), send: vis(send), conf: vis(conf), n: bulk && bulk.querySelector("b").textContent, noSt: bulk && !bulk.querySelector("#op-st") && !bulk.querySelector('[data-b="apply"]') };
    });
    t(theme + ": شريط التحديد ظاهر مع «إرسال المحدد للشركة» و«تأكيد المحدد»", r.on && r.bulkVis && r.send && r.conf && r.n === "3" && r.noSt, r);
    if (theme === "white") await p.screenshot({ path: "/tmp/bulk-white.png" });
    await c.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
