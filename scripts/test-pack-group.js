/* تجهيز الطلبات: المتشابهة تحت بعض: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-pack-group.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const r = await p.evaluate(() => {
    const mk = (id, items, packed) => ({ id, name: "n" + id, wilaya: "w", commune: "c", items, packed: !!packed, status: "confirmee" });
    const rows = [mk("1", "عسل أ ×1 = 1 DA"), mk("2", "عسل ب ×2 = 1 DA"), mk("3", "عسل أ ×2 = 1 DA"), mk("4", "عسل ب ×2 = 1 DA"), mk("5", "عسل أ ×1 = 1 DA"), mk("6", "عسل ج ×1 = 1 DA\nعسل أ ×1 = 1 DA"), mk("7", "عسل أ ×1 = 1 DA", true), mk("8", "عسل ب ×2 = 1 DA")];
    const out = {}; out.all = AdminPack.filter(rows, "all", "").map(x => x.id).join(","); out.todo = AdminPack.filter(rows, "todo", "").map(x => x.id).join(","); out.q = AdminPack.filter(rows, "all", "عسل ب").map(x => x.id).join(","); out.same = AdminPack.filter(rows, "all", "").length === rows.length; return out; });
  ok("المتشابهة معاً: عسل أ (1,5,7 ثم 3) ثم عسل ب (2,4,8) ثم المختلط", r.all === "1,5,7,3,2,4,8,6", r.all);
  ok("فلتر «غير المجهّز» يحافظ على التجميع", r.todo === "1,5,3,2,4,8,6", r.todo);
  ok("البحث يحافظ على التجميع بلا فقد", r.q === "2,4,8" && r.same, r);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
