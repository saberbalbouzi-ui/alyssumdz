/* أسماء المنتجات والحملات بالفرنسية في اللوحة: من ملف أسماء المتجر ومن حقل «الاسم بالفرنسية» في المنتج. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1300, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.setItem("alyssum_lang", "fr"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(7000);
  const R = await p.evaluate(async () => {
    document.getElementById("app").classList.remove("hidden");
    Admin.products = (Admin.products || []).concat([{ slug: "zz-test", title: "منتج تجريبي خاص", titleFr: "Produit spécial de test", price: 1 }]);
    const d = document.createElement("div"); d.id = "nm-test"; d.innerHTML = "<b>الباقة الرباعية للرقية الشرعية 4x</b><i>حملة مساج · منذ 28-10-2026</i><u>عسل التركيز و تنشيط الذاكرة</u><s>كريمة ضد حب الشباب</s><em>منتج تجريبي خاص</em><h3>الحملات الإعلانية <small>1 نشطة من 4</small></h3>";
    document.body.appendChild(d); AdminI18n.syncNames(); await new Promise(r => setTimeout(r, 900)); return d.innerText; });
  t("أسماء المنتجات والحملات من ملف المتجر تظهر بالفرنسية", /Forfait Roqya/.test(R) && /Campagne massage/.test(R) && /Miel Concentration/.test(R) && /Crème anti-acné/.test(R) && !/[؀-ۿ]/.test(R.replace(/منتج تجريبي خاص/, "")), R);
  t("عدّاد الحملات «1 نشطة من 4» بالفرنسية الصحيحة (sur لا depuis)", /1 active\(s\) sur 4/i.test(R) && !/depuis 4/i.test(R), R);
  t("حقل «الاسم بالفرنسية» في المنتج يترجم اسمه", /Produit spécial de test/.test(R), R);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
