/* الطلبات المسجلة: «SD» بالأحمر للطلب إلى مكتب: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-shipped-sd.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const r = await p.evaluate(() => { const mk = (id, dt, desk, trk) => ({ id, date: new Date().toISOString(), name: "ز" + id, phone: "0550000000", wilaya: "الجزائر", commune: "x", dtype: dt, desk, items: "م ×1 = 1 DA", subtotal: 1, fee: 0, total: 1, extra: {}, status: "confirmee", note: "🚚yalidine:" + trk });
    Admin.orders = [mk("S1", "stop", "مكتب بوزريعة", "yal-AAA111"), mk("S2", "home", "", "yal-BBB222"), mk("S3", "stop", "", "yal-CCC333")]; Admin.tab("shipped"); Admin.renderShipped();
    const rows = [...document.querySelectorAll("#ship-table tr[data-trk]")].map(tr => { const td = tr.querySelector('td[data-l="Stop Desk"]'), sd = td && td.querySelector(".o-sd"); return { trk: tr.dataset.trk, txt: td ? td.innerText.trim() : null, sd: !!sd, color: sd ? getComputedStyle(sd).color : "" }; });
    return rows; });
  const g = t => r.find(x => x.trk === t);
  ok("طلب المكتب: يظهر «SD» مع اسم المكتب", g("yal-AAA111").sd && /^SD\s*مكتب بوزريعة$/.test(g("yal-AAA111").txt), g("yal-AAA111"));
  ok("طلب المكتب بلا اسم مكتب: «SD» وحدها", g("yal-CCC333").sd && g("yal-CCC333").txt === "SD", g("yal-CCC333"));
  ok("طلب المنزل: لا شيء", !g("yal-BBB222").sd && g("yal-BBB222").txt === "", g("yal-BBB222"));
  const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(g("yal-AAA111").color || ""); ok("اللون أحمر/وردي دافئ (الأحمر أعلى القنوات)", !!m && +m[1] > 200 && +m[1] > +m[2] + 60 && +m[1] > +m[3], g("yal-AAA111").color);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
