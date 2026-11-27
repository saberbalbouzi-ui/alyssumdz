/* وضع صفحة في «مسار» المنتج من نموذج المنتج يحدّث قائمة الصفحات فوراً (شارة المسار والرابط) دون إعادة تحميل. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 160)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  const r = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { };
    GH.cfg = () => ({ token: "x", owner: "o", repo: "r", branch: "main" });
    GH.getFile = async path => { if (/index\.json$/.test(path)) return { sha: "s", content: btoa(unescape(encodeURIComponent(JSON.stringify(PBAdmin.list)))) }; if (/data\.js$/.test(path)) return { sha: "d", content: btoa(unescape(encodeURIComponent("var CATEGORIES = [];\nvar PRODUCTS = " + JSON.stringify(Admin.products) + ";\n"))) }; throw new Error("404"); };
    GH.putFile = async () => ({}); Admin.ensureProductPages = async () => { }; API.saveProduct = () => { };
    PBAdmin.list = [{ slug: "pg1", title: "صفحة", live: true }];
    Admin.products = [{ slug: "prodx", title: "منتج", price: 100, cat: "x", desc: "", cover: "", images: [] }]; Admin._pBase = JSON.parse(JSON.stringify(Admin.products));
    if (!document.getElementById("pb-list")) { const d = document.createElement("div"); d.id = "pb-list"; document.body.appendChild(d); }
    await PBAdmin.refresh(true); const before = document.getElementById("pb-list").innerHTML;
    await Admin.publishProduct(Object.assign({}, Admin.products[0], { officialPage: "pg1", route: "pg1" }), undefined); await new Promise(r => setTimeout(r, 600));
    const html = document.getElementById("pb-list").innerHTML; return { beforePill: /مسار/.test(before), pill: /مسار/.test(html), url: (html.match(/class="pbx-url"[^>]*><a[^>]*>([^<]*)</) || [])[1], prod: JSON.stringify(Admin.products), prodLinks: [...document.querySelectorAll('#pb-list .pbx-url a')].map(a => a.textContent) }; });
  t("قبل الحفظ: لا شارة مسار", r.beforePill === false, r);
  t("بعد حفظ المنتج بمسار الصفحة: شارة «مسار» تظهر فوراً والصفحة تبقى في جذرها", r.pill && r.url === "alyssumdz.com/pg1", r);
  t("قائمة صفحات المنتجات: روابطها تحت /produit/", r.prodLinks.includes("alyssumdz.com/produit/prodx"), r.prodLinks);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
