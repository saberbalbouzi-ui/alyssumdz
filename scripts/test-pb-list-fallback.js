/* قائمة صفحات المطوّر: فشل قراءة المستودع لا يعرض «لا توجد صفحات»: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-pb-list-fallback.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage|api\.github\.com/, r => r.fulfill({ status: 500, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const r = await p.evaluate(async () => { Admin.tab("builder"); await new Promise(r => setTimeout(r, 800)); const orig = GH.getFile; GH.getFile = async () => { throw new Error("توكن غير صالح (401)"); }; await PBAdmin.refresh(); const n1 = PBAdmin.list.length, err1 = PBAdmin.listErr, txt = (document.getElementById("pb-list") || {}).textContent || "";
    GH.getFile = orig; return { n1, err1, empty: /لا توجد صفحات بعد/.test(txt), has01: PBAdmin.list.some(x => x.slug === "01") }; });
  ok("فشل المستودع: تُعرض الصفحات المنشورة (لا «لا توجد صفحات»)", r.n1 >= 3 && r.has01 && !r.empty && /401/.test(r.err1 || ""), r);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
