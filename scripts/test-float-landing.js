/* الأيقونات العائمة على صفحات الهبوط: تظهر على /tarkiz/ و/lp/tarkiz/؛ والمُنشئ يضيف المحمِّل؛ وقائمة الاختيار تعرض اسم الصفحة (ALYSSUM MEMORY) للمنتج المشترك الرابط. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const base = "http://localhost:" + (process.env.PORT || 8765);
  const cfg = JSON.stringify({ v: 1, wa: { on: true, device: "all", pages: { home: true, product: true, shop: true, other: true }, only: ["tarkiz"], scopeMode: "only", number: "" }, tel: { on: false }, msgr: { on: false } });
  for (const path of ["/tarkiz/", "/lp/tarkiz/", "/produit/tarkiz/"]) {
    const c = await b.newContext({ serviceWorkers: "block", viewport: { width: 412, height: 800 } }), p = await c.newPage();
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|supabase\.co|google|facebook|tiktok/, r => r.abort());
    await p.route(/assets\/data\/float-icons\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: cfg }));
    await p.goto(base + path, { waitUntil: "load" }); await p.waitForTimeout(3500);
    const r = await p.evaluate(() => { const a = document.querySelector('.fli[data-k="wa"]'); return a ? { href: a.getAttribute("href"), vis: a.getBoundingClientRect().width > 0 } : null; });
    t(path + ": أيقونة واتساب ظاهرة برابط wa.me", !!r && r.vis && /wa\.me\/213/.test(r.href), r);
    await c.close();
  }
  { const c = await b.newContext({ serviceWorkers: "block" }), p = await c.newPage(); const errs = [];
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
    await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
    await p.goto(base + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(7000);
    const r = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); await new Promise(r => setTimeout(r, 1500));
      const html = PB.fullHtml({ v: 1, title: "t", slug: "t-fl", ff: "Cairo", css: "", sections: [] }, Object.assign({ base: "../../" }, PBApp.siteCtx()));
      Admin.products = [{ slug: "tarkiz", title: "عسل التركيز و تنشيط الذاكرة" }];
      const h = document.createElement("div"); h.style.cssText = "position:fixed;inset:0;z-index:9;overflow:auto;background:#fff"; document.body.appendChild(h); await AdminFloat.mount(h); await new Promise(r => setTimeout(r, 800));
      const L = [...h.querySelectorAll("#fl-pk-wa label")].map(l => l.textContent.trim()); AdminFloat.pickFilter("wa", "alyssum memory"); const vis = [...h.querySelectorAll("#fl-pk-wa label")].filter(l => l.style.display !== "none").length;
      return { loader: /float-icons\.js/.test(html) && /FloatIcons\.init/.test(html), L, vis }; });
    t("المنشئ يضيف محمِّل الأيقونات العائمة لصفحات الهبوط", r.loader, r);
    t("قائمة الاختيار تعرض «ALYSSUM MEMORY» للصفحة المشتركة مع منتج، والبحث «alyssum memory» يجدها", r.L.some(x => /ALYSSUM MEMORY/i.test(x)) && r.vis === 1, r);
    await c.close(); }
  await b.close(); process.exit(bad ? 1 : 0);
})();
