/* الأيقونات العائمة: خيار «صفحات أو منتجات محدّدة» — تظهر فيها وحدها (بغضّ النظر عن الأنواع)، والفارغ = حسب الأنواع؛ ويُحفظ ويُعرض في اللوحة. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const base = "http://localhost:" + (process.env.PORT || 8765);
  { const p = await b.newPage(); await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|supabase\.co/, r => r.abort());
    await p.goto(base + "/robots.txt"); await p.addScriptTag({ url: base + "/assets/js/float-icons.js" });
    const r = await p.evaluate(() => { const F = window.FloatIcons; window.PRODUCTS = [{ slug: "tarkiz", route: "honey-copy" }, { slug: "miel", title: "x" }]; const at = path => { history.pushState(null, "", path); return F.onlyOk({ only: ["tarkiz"] }); };
      return { norm: F.norm({ wa: { only: ["a", "", 5] } }).wa.only, def: F.norm({}).wa.only, empty: F.onlyOk({ only: [] }), prodRoot: at("/tarkiz/"), prodPrefix: (history.pushState(null, "", "/produit/tarkiz/"), F.onlyOk({ only: ["tarkiz"] })), other: (history.pushState(null, "", "/produit/miel/"), F.onlyOk({ only: ["tarkiz"] })), pageByRouteProduct: (history.pushState(null, "", "/tarkiz/"), F.onlyOk({ only: ["honey-copy"] })), lpDirect: (history.pushState(null, "", "/lp/honey-copy/"), F.onlyOk({ only: ["tarkiz"] })), page: (history.pushState(null, "", "/lp/zzz/"), F.onlyOk({ only: ["zzz"] })) }; });
    t("التطبيع يحوّل only إلى قائمة نصوص بلا فارغ", JSON.stringify(r.norm) === '["a","5"]' && JSON.stringify(r.def) === "[]", r);
    t("فارغة ⟵ null (حسب الأنواع)", r.empty === null, r);
    t("منتج في الجذر (/tarkiz/) وتحت /produit/ يطابق", r.prodRoot === true && r.prodPrefix === true, r);
    t("منتج آخر لا يطابق", r.other === false, r);
    t("صفحة هبوط مساراً لمنتج: تطابق باسم الصفحة أو المنتج في الاتجاهين", r.pageByRouteProduct === true && r.lpDirect === true, r);
    t("صفحة /lp/<slug>/ تطابق", r.page === true, r); await p.close(); }
  { const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
    await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
    await p.goto(base + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
    const r = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); Admin.products = [{ slug: "prodx", title: "منتج إكس" }, { slug: "prody", title: "منتج واي" }];
      const h = document.createElement("div"); h.style.cssText = "position:fixed;inset:0;z-index:9;overflow:auto;background:#fff"; document.body.appendChild(h); await AdminFloat.mount(h); await new Promise(r => setTimeout(r, 600));
      const labels = h.querySelectorAll(".fl-pk").length, cb = h.querySelector("#fl-pk-wa input[type=checkbox]"); cb.click(); await new Promise(r => setTimeout(r, 100)); const only = AdminFloat.data().wa.only.slice(), note = h.querySelector("#fl-pkn-wa").textContent;
      AdminFloat.pickFilter("wa", "واي"); const vis = [...h.querySelectorAll("#fl-pk-wa label")].filter(l => l.style.display !== "none").length;
      const wa = h.querySelector(".fl-card .fl-r input[dir=ltr]"), lbl = wa ? wa.closest(".fl-f").querySelector("label").textContent : "";
      return { labels, only, note, vis, ph: wa && wa.placeholder, lbl }; });
    t("خيار الصفحات/المنتجات المحدّدة يظهر في بطاقة كل أيقونة (3)", r.labels === 3, r);
    t("اختيار منتج يُسجَّل في الإعداد ويُحدّث الملاحظة", r.only.length === 1 && /ستظهر في 1 فقط/.test(r.note), r);
    t("البحث يفلتر القائمة", r.vis === 1, r);
    t("رقم واتساب المتجر يظهر في إعداد الأيقونة (نصاً وplaceholder) من store.json", /\d{9,}/.test(r.ph || "") && r.lbl.includes("+" + r.ph), { ph: r.ph, lbl: r.lbl });
    t("بلا أخطاء JS", errs.length === 0, errs); await p.close(); }
  { const cx = await b.newContext({ viewport: { width: 412, height: 800 }, serviceWorkers: "block" }), p = await cx.newPage(); let CFG = {};
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|supabase\.co|api\.alyssumhub/, r => r.abort());
    await p.route("**/assets/data/float-icons.json*", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CFG) }));
    await p.route("**/assets/data/apps.json*", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ off: [] }) }));
    await p.goto(base + "/index.html", { waitUntil: "load" }); await p.waitForTimeout(1500);
    const run = async (cfg, path) => { CFG = cfg; return p.evaluate(async path => { document.querySelectorAll("a.fli, a[data-k]").forEach(e => e.remove()); history.pushState(null, "", path); window.PRODUCTS = [{ slug: "tarkiz", route: "honey-copy" }, { slug: "miel" }]; await FloatIcons.init("../".repeat(path.split("/").filter(Boolean).length)); await new Promise(r => setTimeout(r, 300)); const a = document.querySelector('a[data-k="wa"]'); return a ? decodeURIComponent(a.getAttribute("href")) : null; }, path); };
    const base0 = { v: 1, wa: { on: true, number: "0661000000", msg: "عامة", only: ["tarkiz"], cmsg: "مخصصة للمنتج", cnum: "0550123456", pages: { home: true, product: true, shop: true, other: true } } };
    const h1 = await run(base0, "/tarkiz/"), h2 = await run(base0, "/produit/miel/"), h3 = await run(Object.assign({}, base0, { wa: Object.assign({}, base0.wa, { scopeMode: "all" }) }), "/produit/miel/"), h4 = await run(Object.assign({}, base0, { wa: Object.assign({}, base0.wa, { scopeMode: "all", cnum: "" }) }), "/tarkiz/");
    t("على المحدَّد: رسالة مخصصة ورقم بديل", h1 && /wa\.me\/213550123456/.test(h1) && /مخصصة للمنتج/.test(h1), h1);
    t("خارج المحدَّد (وضع «فقط»): لا أيقونة", h2 === null, h2);
    t("وضع «في كل الصفحات»: خارج المحدَّد بالرقم والرسالة الافتراضيين", h3 && /wa\.me\/213661000000/.test(h3) && /عامة/.test(h3), h3);
    t("رقم بديل فارغ ⟵ يبقى الرقم الافتراضي مع الرسالة المخصصة", h4 && /wa\.me\/213661000000/.test(h4) && /مخصصة للمنتج/.test(h4), h4);
    await p.close(); }
  await b.close(); process.exit(bad ? 1 : 0);
})();
