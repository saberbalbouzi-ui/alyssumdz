/* جدول الطلبات على الجوال: لا فراغ كبير في خانة الحالة. NODE_PATH=/opt/node-tools/node_modules node scripts/test-orders-status-gap.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 1 });
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.setItem("alyssum_admin_theme", "white"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R0 = await p.evaluate(async () => {
    document.getElementById("app").classList.remove("hidden"); const A = Admin;
    A.orders = [1, 2, 3].map(i => ({ id: "M26112" + i + "-AB" + i, date: new Date().toISOString(), name: "زبون " + i, phone: "055500000" + i, wilaya: "الجزائر", commune: "باب الزوار", dtype: "home", items: "عسل ×2 = 1600 DA", subtotal: 1600, fee: 400, total: 2000, status: "nouvelle", note: i === 3 ? " 📞1" : "", extra: {} }));
    const nb = document.querySelector('.nav-btn[onclick*="tab(\'orders\'"]'); if (nb) nb.click(); else A.tab("orders"); await new Promise(r => setTimeout(r, 1500)); document.querySelectorAll("[id^=tab-]").forEach(x => x.classList.add("hidden")); document.getElementById("tab-orders").classList.remove("hidden"); document.querySelector(".login") && document.querySelector(".login").classList.add("hidden"); try { A.renderOrders(); } catch (e) { }
    await new Promise(r => setTimeout(r, 800));
    const tr = [...document.querySelectorAll("#tab-orders tbody tr")].find(x => x.querySelector("td")); if (!tr) return { none: 1 };
    const tb = tr.closest("table"), sc = tb.parentElement;
    return { tw: tb.scrollWidth, sw: sc.clientWidth, cols: [...tr.children].map(td => [td.dataset.l || td.className, Math.round(td.getBoundingClientRect().width), (td.textContent || "").trim().slice(0, 14), td.querySelectorAll("button,select").length]) };
  });
  const st = (R0.cols || []).find(c => c[0] === "الحالة"); const ok = !!st && st[1] <= 190; console.log((ok ? "✓ " : "✗ ") + "الطلبات: خانة الحالة لا تتّسع بفراغ (≤190px) رغم اختلاف محتوى الصفوف " + JSON.stringify(st)); await b.close(); process.exit(ok ? 0 : 1); 
})();
