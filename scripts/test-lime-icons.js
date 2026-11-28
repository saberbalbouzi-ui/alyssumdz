/* الأزرار الليمونية: أيقوناتها (modern-icons) غير بيضاء أبداً في كل التبويبات. NODE_PATH=/opt/node-tools/node_modules */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  for (const theme of ["white", "dark"]) {
    const c = await b.newContext({ ...devices["iPhone 13"], colorScheme: theme === "white" ? "light" : "dark" }), p = await c.newPage();
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|generativelanguage/, r => r.abort());
    await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.addInitScript(th => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.setItem("admin_theme", th); } catch (e) { } }, theme);
    await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(7000);
    const r = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; document.getElementById("login-box") && document.getElementById("login-box").classList.add("hidden"); document.dispatchEvent(new Event("pointerdown")); await new Promise(r => setTimeout(r, 4000));
      const mk = (id, st, d) => ({ id, date: new Date(Date.now() - d * 864e5).toISOString(), name: "ز" + id, phone: "0550000" + id.slice(-3), wilaya: "Alger", commune: "x", dtype: "home", items: "عسل ×1 = 2000 DA", subtotal: 2000, fee: 0, total: 2000, status: st, note: "" });
      Admin.orders = [mk("B1", "confirmee", 0), mk("B2", "confirmee", 1), mk("B3", "nouvelle", 2)]; const bad = [];
      const lime = bg => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(bg); return m && +m[1] > 200 && +m[2] > 235 && +m[3] < 80; };
      for (const tab of ["home", "orders", "pack", "shipped", "callcenter", "products", "finance"]) { try { Admin.tab(tab); } catch (e) { continue; } await new Promise(r => setTimeout(r, 700)); if (tab === "orders") { try { Admin.renderOrders(); } catch (e) { } const ck = document.querySelector("#orders-table input.op-ck[data-all]"); if (ck) ck.click(); await new Promise(r => setTimeout(r, 400)); }
        document.querySelectorAll("#app button, #app a").forEach(btn => { if (!btn.offsetParent) return; const cs = getComputedStyle(btn), bgi = cs.backgroundImage + " " + cs.backgroundColor; const lm = lime(cs.backgroundColor) || /rgb\((2[0-3]\d|239), ?25[0-5], ?2\d\)/.test(bgi); if (!lm) return; btn.querySelectorAll("svg").forEach(v => { const c = getComputedStyle(v).color, s = getComputedStyle(v).stroke; if (c === "rgb(255, 255, 255)" || s === "rgb(255, 255, 255)") bad.push(tab + ":" + (btn.textContent || "").trim().slice(0, 24)); }); }); }
      return bad; });
    t(theme + ": لا أيقونة بيضاء على زر ليموني", r.length === 0, r);
    await c.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
