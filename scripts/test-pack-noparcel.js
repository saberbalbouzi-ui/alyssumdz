/* تجهيز الطلبات: الطلب بلا طرد عند الشركة يُعلَّم بالأحمر. NODE_PATH=/opt/node-tools/node_modules node scripts/test-pack-noparcel.js */
const { chromium } = require("playwright"); let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log("✗", n, JSON.stringify(x)); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => {
    const rows = [{ id: "A", items: "منتج ×1 = 1800", wilaya: "Alger", status: "confirmee", tracking: "yal-OK", packed: false }, { id: "B", items: "منتج ×1 = 1800", wilaya: "Oran", status: "confirmee", tracking: "", packed: true }];
    const S = AdminPack._S; S.rows = rows; S.f = "all"; S.busy = false; S.err = ""; const host = document.createElement("div"); document.body.appendChild(host); S.host = host;
    AdminPack.draw(); const h = host.innerHTML; return { warn: /بلا طرد عند الشركة/.test(h), rowsRed: (h.match(/background:rgba\(248,113,113,\.14\)/g) || []).length };
    return { has: AdminPack.S.rows.length, warn: /بلا طرد عند الشركة/.test(h), rowsRed: (h.match(/background:rgba\(248,113,113,\.14\)/g) || []).length, api: Object.keys(AdminPack) };
  });
  t("تحذير وصف واحد مُعلَّم", r.warn && r.rowsRed === 1, r);
  console.log(ok + " ✓ / " + bad + " ✗"); await b.close(); process.exit(bad ? 1 : 0);
})();
