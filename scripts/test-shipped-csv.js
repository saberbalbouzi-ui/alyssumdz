/* نسخة CSV للطلبات المسجلة: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-shipped-csv.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ acceptDownloads: true }); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  await p.evaluate(() => { const mk = (id, n, trk, st, note) => ({ id, date: new Date().toISOString(), name: n, phone: "0550000000", wilaya: "الجزائر", commune: "x", dtype: "home", items: "منتج ×1 = 1000 DA\nآخر ×2 = 500 DA", subtotal: 1000, fee: 0, total: 1500, extra: {}, status: st, note: "🚚yalidine:" + trk });
    Admin.orders = [mk("S1-AAA", 'زبون "أ"', "yal-AAA111", "confirmee"), mk("M261114-BBB", "زبون ب", "yal-BBB222", "livree")]; Admin.tab("shipped"); Admin.renderShipped(); });
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }), p.evaluate(() => Admin.exportShippedCsv())]);
  const fs = require("fs"), txt = fs.readFileSync(await dl.path(), "utf8");
  ok("اسم الملف", /^registered-orders-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  ok("BOM + ترويسة التتبع", txt.charCodeAt(0) === 0xfeff && txt.includes('"التتبع","الشركة"'), txt.slice(0, 60));
  ok("صفّان بالتتبع والمصدر (موقع/يدوي) والاقتباس المزدوج مهرَّب", txt.includes("yal-AAA111") && txt.includes("yal-BBB222") && txt.includes('"زبون ""أ"""') && /"الموقع"/.test(txt) && /"يدوي"/.test(txt), txt);
  ok("المنتجات في خلية واحدة", txt.includes("منتج ×1 = 1000 DA • آخر ×2 = 500 DA"), txt);
  ok("عدد الأسطر 3 (ترويسة + 2)", txt.trim().split("\r\n").length === 3, txt.trim().split("\r\n").length);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
