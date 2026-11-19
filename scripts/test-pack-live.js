/* التجهيز: يتبع الطلب بعد تعديله (الولاية/الاسم)، ويعرض الأسماء في الجدول وقائمة الجمع. NODE_PATH=/opt/node-tools/node_modules node scripts/test-pack-live.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 430, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    document.getElementById("app").classList.remove("hidden");
    const rows = [{ id: "P1", name: "قديم", items: "منتج أ ×1 = 1800", wilaya: "M'Sila", commune: "Sidi Aïssa", status: "confirmee", tracking: "T1", packed: false }, { id: "P2", name: "فاطمة", items: "منتج أ ×2 = 3000", wilaya: "Alger", status: "confirmee", tracking: "T2", packed: false }];
    Admin.orders = [{ id: "P1", name: "ليلى بن علي", wilaya: "Alger", commune: "Bourouba", items: "منتج أ ×1 = 1800 DA", status: "confirmee" }];
    const S = AdminPack._S; S.rows = rows; S.f = "all"; S.busy = false; S.err = ""; const host = document.createElement("div"); document.body.appendChild(host); S.host = host; AdminPack.draw();
    const tx = host.innerText, trs = [...host.querySelectorAll("tbody tr")].map(r => r.innerText.replace(/\s+/g, " "));
    const pl = AdminPack.pickList(S.rows);
    return { row1: trs.find(x => /ليلى/.test(x)) || "", stale: /M'Sila/.test(tx), hdr: /الزبون/.test(tx), names: pl[0] && pl[0].names, pn: host.querySelector(".pn") ? host.querySelector(".pn").innerText : "" };
  });
  t("بعد تعديل الطلب يتبع التجهيزُ الولاية (Alger لا M'Sila) والاسم الجديد", /ليلى/.test(R.row1) && /Alger/.test(R.row1) && !R.stale, R);
  t("عمود «الزبون» في الجدول", R.hdr, R);
  t("قائمة الجمع تحمل أسماء أصحاب كل منتج", R.names && R.names.length === 2 && /ليلى/.test(R.pn) && /فاطمة/.test(R.pn), R);
  await b.close(); process.exit(bad ? 1 : 0);
})();
