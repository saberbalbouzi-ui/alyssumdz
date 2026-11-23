/* فحص الترجمة الفرنسية لما أُضيف حديثاً: يستخرج النصوص العربية من الأسطر المضافة في فرق git (افتراضياً مقابل HEAD~1، أو مرجع تمرّره)
   لملفات اللوحة، ويمرّرها على مترجم اللوحة ويطبع ما بقي عربياً. أضف أزواجها إلى scripts/i18n-fr-miss.json ثم شغّل scripts/gen-i18n-fr.py.
   التشغيل: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/check-i18n-new.js [مرجع_git]
   تنبيه: الأسطر التي هي تعليقات أو أسماء مفاتيح/أنماط تظهر أحياناً كإيجابيات كاذبة؛ المهم نصوص الواجهة. */
const { chromium } = require("playwright"); const { execSync } = require("child_process");
(async () => {
  const base = process.argv[2] || "HEAD~1";
  const diff = execSync(`git diff ${base} -- admin.html "assets/js/admin-*.js"`, { maxBuffer: 1 << 28 }).toString("utf8");
  const segs = new Set();
  diff.split("\n").filter(l => l.startsWith("+") && !l.startsWith("+++")).forEach(l => {
    const t = l.slice(1).replace(/\/\*.*?\*\//g, "").replace(/(^|\s)\/\/.*$/, "");
    for (const m of t.matchAll(/[؀-ۿ][؀-ۿ\s«»،؛:.\-()/٪%\d]*[؀-ۿ)»]/g)) { const s = m[0].trim(); if (s.length >= 3 && !/^[؀-ۿ]+$/.test(s.replace(/\s/g, "")) || s.includes(" ")) segs.add(s); }
  });
  const b = await chromium.launch(), p = await b.newPage();
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.setItem("alyssum_lang", "fr"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(7000);
  const miss = await p.evaluate(async (L) => { await AdminI18n.set("fr", true); await new Promise(r => setTimeout(r, 500)); return L.filter(s => /[؀-ۿ]/.test(AdminI18n.t(s))); }, [...segs]);
  console.log(miss.length ? "⚠️ نصوص جديدة بلا ترجمة فرنسية (" + miss.length + " من " + segs.size + "):\n" + miss.map(s => " - " + s).join("\n") : "✓ كل النصوص المضافة مترجمة (" + segs.size + " نصاً فُحص)");
  await b.close();
})();
