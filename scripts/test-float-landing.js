/* الأيقونات العائمة على صفحات الهبوط: تظهر على /tarkiz/ و/lp/tarkiz/؛ والمُنشئ يضيف المحمِّل؛ وقائمة الاختيار تعرض اسم الصفحة (ALYSSUM MEMORY) للمنتج المشترك الرابط. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const base = "http://localhost:" + (process.env.PORT || 8765), STORE = String(JSON.parse(require("fs").readFileSync(__dirname + "/../assets/data/store.json", "utf8")).wa || "").replace(/\D/g, "");
  const cfg = JSON.stringify({ v: 1, wa: { on: true, device: "all", pages: { home: true, product: true, shop: true, other: true }, only: ["tarkiz"], scopeMode: "only", number: "" }, tel: { on: false }, msgr: { on: false } });
  for (const path of ["/tarkiz/", "/lp/tarkiz/", "/produit/tarkiz/"]) {
    const c = await b.newContext({ serviceWorkers: "block", viewport: { width: 412, height: 800 } }), p = await c.newPage();
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|supabase\.co|google|facebook|tiktok/, r => r.abort());
    await p.route(/assets\/data\/float-icons\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: cfg }));
    await p.goto(base + path, { waitUntil: "load" }); await p.waitForTimeout(3500);
    const r = await p.evaluate(() => { const a = document.querySelector('.fli[data-k="wa"]'); return a ? { href: a.getAttribute("href"), vis: a.getBoundingClientRect().width > 0 } : null; });
    t(path + ": أيقونة واتساب ظاهرة برابط wa.me برقم المتجر المسجَّل (" + STORE + ")", !!r && r.vis && STORE.length > 8 && r.href.indexOf("wa.me/" + STORE) >= 0, r);
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
      const L = [...h.querySelectorAll("#fl-pk-lp label")].map(l => l.textContent.trim()); AdminFloat.pickFilter("lp", "alyssum memory"); const vis = [...h.querySelectorAll("#fl-pk-lp label")].filter(l => l.style.display !== "none").length;
      return { loader: /float-icons\.js/.test(html) && /FloatIcons\.init/.test(html), L, vis }; });
    const sh = await p.evaluate(async () => { AdminFloat.sset("side", "right"); AdminFloat.sset("size", 70); AdminFloat.sset("pages.shop", false); const d = AdminFloat.data(); AdminFloat.set("tel", "color", "#123456"); let sent = null; GH.cfg = () => ({ token: "x", owner: "o", repo: "r", branch: "main" }); GH.getFile = async () => ({ sha: "s" }); GH.putFile = async (pth, b64) => { sent = JSON.parse(decodeURIComponent(escape(atob(b64)))); return {}; }; await AdminFloat.save();
      const n = FloatIcons.norm(sent); return { all: ["wa", "tel", "msgr"].every(k => d[k].side === "right" && d[k].size === 70 && d[k].pages.shop === false), colors: d.tel.color === "#123456" && d.wa.color !== "#123456", saved: !!sent.shared && sent.shared.side === "right", rt: ["wa", "tel", "msgr"].every(k => n[k].side === "right" && n[k].size === 70), cards: document.querySelectorAll("#fl-host .fl-card").length, perCardNoSide: ![...document.querySelectorAll("#fl-host .fl-card")].slice(1).some(c => /الجهة|الحجم \(px\)|الحركة/.test(c.textContent)) }; });
    t("الإعدادات مشتركة: تغيير الجهة/الحجم/صفحات الظهور يسري على الثلاث، واللون يبقى لكل أيقونة، ويُحفظ shared ويقرؤه الموقع، وبطاقات الأيقونات بلا إعدادات مشتركة", sh.all && sh.colors && sh.saved && sh.rt && sh.cards === 4 && sh.perCardNoSide, sh);
    const ap = await p.evaluate(async () => { AdminNav.app("floaters"); await new Promise(r => setTimeout(r, 2500)); const secs = [...document.querySelectorAll("#app-cfg-body > *")].map(e => (e.querySelector("b,h3") || e).textContent.trim()); const hostIdx = [...document.querySelectorAll("#app-cfg-body > *")].findIndex(e => e.querySelector("#fl-host") || e.id === "fl-host" || e.querySelector(".fl-card")); const f = { secs, hostIdx, noWhere: !secs.some(x => /أين تجده/.test(x)) }; AdminNav.app("speed"); await new Promise(r => setTimeout(r, 800)); f.speedWhere = [...document.querySelectorAll("#app-cfg-body > * b")].some(b => /أين تجده/.test(b.textContent)); return f; });
    t("صفحة إضافة الأيقونات العائمة: التعريف وكيف يعمل في الأعلى ثم الإعدادات، وبلا قسم «أين تجده»، وبقية الإضافات تحتفظ به", ap.noWhere && ap.hostIdx === 3 && ap.secs[1] === "التعريف" && ap.secs[2] === "كيف يعمل" && ap.speedWhere, ap);
    t("المنشئ يضيف محمِّل الأيقونات العائمة لصفحات الهبوط", r.loader, r);
    t("قائمة صفحات الهبوط تعرض «ALYSSUM MEMORY» والبحث «alyssum memory» يجدها", r.L.some(x => /ALYSSUM MEMORY/i.test(x)) && r.vis === 1, r);
    await c.close(); }
  await b.close(); process.exit(bad ? 1 : 0);
})();
