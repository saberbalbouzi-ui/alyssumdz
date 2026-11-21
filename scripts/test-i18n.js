/* لغة اللوحة: زرّ FR/ع، الترجمة الفرنسية للواجهة الأساسية، الاتجاه LTR، والعودة للعربية تستعيد الأصل. NODE_PATH=/opt/node-tools/node_modules node scripts/test-i18n.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 430, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.removeItem("alyssum_lang"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(7000);
  const R = await p.evaluate(async () => {
    const out = {}; document.getElementById("app").classList.remove("hidden"); window.toast = () => { };
    const A = Admin, mk = (id, st) => ({ id, date: new Date().toISOString(), name: "كريم", phone: "0550000000", wilaya: "Alger", commune: "x", dtype: "home", items: "عسل ×1 = 2000 DA", subtotal: 2000, fee: 0, total: 2000, status: st, note: "", extra: {} }); A.orders = [mk("A1", "nouvelle"), mk("A2", "confirmee")];
    out.btn = !!document.getElementById("top-lang") && document.getElementById("top-lang").textContent; out.dir0 = document.documentElement.dir;
    A.tab("orders"); await new Promise(r => setTimeout(r, 500)); A.renderOrders();
    const arTxt = document.body.innerText;
    document.getElementById("top-lang").click(); await new Promise(r => setTimeout(r, 800));
    out.dir1 = document.documentElement.dir; out.lang1 = document.documentElement.lang; out.btn1 = document.getElementById("top-lang").textContent; out.stored = localStorage.getItem("alyssum_lang");
    const txt = document.body.innerText + " " + document.getElementById("tab-orders").textContent; out.has = { orders: /Commandes/.test(txt), nav: /Tableau de bord|Paramètres du site/.test(txt), filt: /Tous les statuts/.test(txt), keepName: /كريم/.test(txt) };
    A.renderOrders(); await new Promise(r => setTimeout(r, 400)); { const o = document.getElementById("tab-orders").textContent; out.reRender = /Tous les statuts/.test(o) && !/كل الحالات/.test(o); }
    const ph = [...document.querySelectorAll("input[placeholder]")].map(i => i.placeholder).filter(x => /Rechercher/.test(x)).length; out.ph = ph;
    document.getElementById("top-lang").click(); await new Promise(r => setTimeout(r, 600));
    out.dir2 = document.documentElement.dir; { const o = document.getElementById("tab-orders").textContent; out.back = /كل الحالات/.test(o) && !/Tous les statuts/.test(o); } out.btn2 = document.getElementById("top-lang").textContent;
    out.api = [AdminI18n.t("حفظ"), (AdminI18n.set("fr"), 1)]; await new Promise(r => setTimeout(r, 300)); out.api2 = AdminI18n.t("حفظ");
    return out; });
  t("زرّ اللغة في الشريط العلوي: يعرض «FR» والاتجاه RTL بالعربية", R.btn === "FR" && R.dir0 === "rtl", R);
  t("بعد الضغط: الفرنسية، الاتجاه LTR، lang=fr، والزرّ «ع»، ويُحفظ الاختيار", R.dir1 === "ltr" && R.lang1 === "fr" && R.btn1 === "ع" && R.stored === "fr", R);
  t("الواجهة الأساسية بالفرنسية (القائمة وفلاتر الطلبات) وبيانات الزبون تبقى كما هي", R.has.orders && R.has.nav && R.has.filt && R.has.keepName, R.has);
  t("ما يُرسم لاحقاً يُترجم (إعادة رسم الطلبات)، وplaceholder تُترجم", R.reRender && R.ph >= 1, [R.reRender, R.ph]);
  t("العودة للعربية تستعيد النصوص الأصلية والاتجاه RTL والزرّ «FR»", R.back && R.dir2 === "rtl" && R.btn2 === "FR", R);
  t("واجهة البرمجة: t() تترجم عند الفرنسية فقط", R.api[0] === "حفظ" && R.api2 === "Enregistrer", R);
  const H = await p.evaluate(async () => {
    const o = {}; await AdminI18n.set("fr"); await new Promise(r => setTimeout(r, 500));
    await AdminHelp.show(); await new Promise(r => setTimeout(r, 1500)); const kb = AdminHelp.kb || [];
    o.kbFr = kb.length > 200 && kb.filter(e => !/[\u0600-\u06ff]/.test(e.t)).length > 200; o.url = AdminI18n.helpUrl();
    o.frQ = AdminHelp.search("comment ajouter une nouvelle section").length > 0; o.arQ = AdminHelp.search("كيف أضيف قسماً جديداً؟").length > 0;
    AdminHelp.ask("comment connecter un transporteur"); await new Promise(r => setTimeout(r, 600)); const last = [...document.querySelectorAll("#ah-m .ah-b.a")].pop(); o.ans = last ? last.textContent.slice(0, 160) : "";
    o.ansFr = !!o.ans && !/[\u0600-\u06ff]{4}/.test(o.ans);
    await AdminI18n.set("ar"); await new Promise(r => setTimeout(r, 1500)); o.kbAr = (AdminHelp.kb || []).some(e => /[\u0600-\u06ff]/.test(e.t)); o.url2 = AdminI18n.helpUrl(); return o; });
  t("«اسألني» بالفرنسية: قاعدة المعرفة فرنسية، السؤال الفرنسي والعربي يجدان جواباً، والجواب فرنسي", H.kbFr && H.frQ && H.arQ && H.ansFr && /fr\.json/.test(H.url), H);
  t("العودة للعربية تعيد قاعدة المعرفة العربية", H.kbAr && /admin-help\.json$/.test(H.url2), H);
  const C = await p.evaluate(async () => { await AdminI18n.set("fr"); const out = {}; for (const tab of ["store", "finance", "payments", "reports", "dispatch", "delivery", "inventory", "customers", "settings"]) { try { Admin.tab(tab); } catch (e) { } await new Promise(r => setTimeout(r, 900)); const root = document.getElementById("tab-" + tab); if (!root) continue; let n = 0; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let x; while ((x = w.nextNode())) { const s = x.textContent.trim(); if (s && /[\u0600-\u06ff]/.test(s) && x.parentElement && !/SCRIPT|STYLE/.test(x.parentElement.tagName) && !x.parentElement.closest("#pb-app,[data-i18n-skip],textarea,code,pre")) n++; } out[tab] = n; } return out; });
  t("تغطية الترجمة: أقسام الإعدادات والمالية والإحصائيات بلا نصوص عربية متبقية (≤ 3 لكل قسم)", Object.values(C).every(n => n <= 3), C);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
