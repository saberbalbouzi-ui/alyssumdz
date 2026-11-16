/* اختصارات الرئيسية: الطلبات ثم الأرباح ثم المنتج والعملاء ثم الرقية، والرقية للبائع فقط: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-home-quick.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 900 } }); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const r = await p.evaluate(() => {
    AdminHome.render(); const gs = () => [...document.querySelectorAll("#ahome .ah-quick")].map(g => [...g.querySelectorAll("button")].map(x => x.dataset.go));
    const out = { with: gs(), hdBtns: [...document.querySelectorAll("#ahome .ah-hd [data-go]")].map(x => x.dataset.go) };
    return out; });
  ok("المجموعات: الطلبات ← المنتج والعملاء (بلا مخزون/أرباح ولا مسجلة ولا رقية)", JSON.stringify(r.with.map(g => g.filter(x => !/^ruqya/.test(x))).filter(g => g.length)) === JSON.stringify([["neword", "orders", "orders-new", "pack"], ["newp", "customers"]]) && !r.with.some(g => g.some(x => /^ruqya/.test(x))), r.with);
  ok("أزرار الطلب خرجت من ترويسة الصفحة", r.hdBtns.length === 0, r.hdBtns);
  ok("لا أزرار رقية في الاختصارات", !r.with.some(g => g.some(x => /^ruqya/.test(x))), r.with);
  const r2 = await p.evaluate(() => { document.querySelectorAll('.nav-btn[onclick*="\'ruqya\'"]').forEach(x => x.remove()); AdminHome.render(); const hasBtn = [...document.querySelectorAll("#ahome [data-go^=ruqya]")].length, card = /مواعيد الرقية/.test(document.getElementById("ahome").innerText); return { hasBtn, card }; });
  ok("نسخة بلا قسم الرقية (عميل): لا أزرار ولا بطاقة رقية في الرئيسية", r2.hasBtn === 0 && r2.card === false, r2);
  { const cp = require("child_process"), fs = require("fs"), out = "dist/_rq_test"; fs.rmSync(out, { recursive: true, force: true });
    for (const tg of ["github", "php"]) { const x = cp.spawnSync("python3", ["scripts/make-template.py", "--out", out, "--name", "تجربة", "--kind", "physical", "--target", tg], { encoding: "utf8" });
      const g = cp.spawnSync("grep", ["-rli", "ruqya", out], { encoding: "utf8" }).stdout.trim().split("\n").filter(Boolean);
      ok("حزمة عميل (" + tg + "): تُبنى وتجتاز فحص التسرّب بلا أثر للرقية سوى حارس الرئيسية", x.status === 0 && g.length === 1 && /assets\/js\/admin-home\.js$/.test(g[0]), { st: x.status, g, e: (x.stdout || "").slice(-300) }); }
    fs.rmSync(out, { recursive: true, force: true }); }
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
