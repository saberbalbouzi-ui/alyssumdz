/* تشخيص زمن فتح اللوحة يتضمن تحليل الكود الرئيسي وتشغيله والمهام الطويلة: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-load-info.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(7000);
  const r = await p.evaluate(() => ({ cm: window.__cm, lt: window.__lt, txt: AdminTheme.loadTimes() }));
  ok("ثلاث علامات للكود الرئيسي متزايدة", Array.isArray(r.cm) && r.cm.length === 3 && r.cm[0] <= r.cm[1] && r.cm[1] <= r.cm[2], r.cm);
  ok("مصفوفة المهام الطويلة موجودة", Array.isArray(r.lt), r.lt);
  ok("نص التشخيص يعرض الكود الرئيسي (تحليل/تشغيل/مهام طويلة)", /الكود الرئيسي: وصول [\d.]+ ث · تحليل [\d.]+ ث · تشغيل [\d.]+ ث · مهام طويلة \d+/.test(r.txt), r.txt);
  ok("النص القديم سليم (الصفحة/الأدوات/الجاهزية)", /زمن فتح اللوحة: الصفحة .* الأدوات .* الجاهزية/.test(r.txt), r.txt);
  const h = await p.evaluate(() => { localStorage.setItem("adm_load", JSON.stringify([{ ready: 1800, v: "1.0.1" }, { ready: 7200, v: "1.0.2" }, { ready: 1700, v: "1.0.2" }])); return AdminTheme.loadTimes(); });
  ok("سجل الفتحات: علامة * عند أول فتح بعد تحديث فقط", /آخر الفتحات \(الجاهزية\): 1\.8 · 7\.2\* · 1\.7 \(\* أول فتح بعد تحديث\)/.test(h), h);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
