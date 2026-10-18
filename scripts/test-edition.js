/* اختبار نسخ لوحة الإدارة (إيكومرس برو / بازيك / إنفوغراف ديزاين): دوال نقية + قائمة جانبية حقيقية + الحارس + بطاقة الإعدادات:
     NODE_PATH=/opt/node-tools/node_modules node scripts/test-edition.js */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
let total = 0, fails = 0; const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } else console.log("✓", n); };
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  const html = fs.readFileSync(path.join(__dirname, "../admin.html"), "utf8");
  /* نبني صفحة تحوي قائمة اللوحة الحقيقية (أزرار nav-btn) وسكربت النسخة فقط */
  const navHtml = (html.match(/<nav class="side-nav"[\s\S]*?<\/nav>/) || [""])[0];
  await p.route("https://t.test/**", r => r.fulfill({ contentType: "text/html", body: "<!doctype html><html><body><div id='nav-groups'></div>" + navHtml + "<div id='stage'></div></body></html>" }));
  await p.goto("https://t.test/");
  await p.evaluate(() => { window.__tabs = []; window.toast = m => { window.__toast = m; }; window.Admin = { tab: (t) => { window.__tabs.push(t); } }; window.__d = {}; window.AdminStores = { data: () => window.__d }; });
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "../assets/js/admin-edition.js"), "utf8") });
  const T = fn => p.evaluate(fn);
  ok("القائمة الحقيقية محمَّلة", await T(() => document.querySelectorAll(".side-nav .nav-btn").length > 60));
  /* نقية */
  ok("allows: برو يسمح بكل شيء", await T(() => AdminEdition.allows("pro", "studio") && AdminEdition.allows("pro", "orders")));
  ok("allows: بازيك يحجب studio فقط", await T(() => !AdminEdition.allows("basic", "studio") && AdminEdition.allows("basic", "orders") && AdminEdition.allows("basic", "builder")));
  ok("allows: ديزاين = مطوّر الصفحات وستوديو ديزاين وما يلزم الحساب فقط", await T(() => ["builder", "studio", "store", "admtheme", "team", "imgtools", "imggen"].every(t => AdminEdition.allows("design", t)) && ["orders", "products", "finance", "shipped", "customers", "wallet", "appstore", "digital", "home", "blog", "social", "delivery"].every(t => !AdminEdition.allows("design", t))));
  ok("keepBtn: ديزاين يُبقي Admin.tab('builder') وإعدادات إضافة المطوّر ويحجب غيرها", await T(() => AdminEdition.keepBtn("design", "Admin.tab('builder',this)") && AdminEdition.keepBtn("design", "AdminNav.app('builder',this)") && !AdminEdition.keepBtn("design", "AdminNav.app('agent',this)") && !AdminEdition.keepBtn("design", "AdminNav.tpl(this)") && !AdminEdition.keepBtn("design", "Admin.tab('orders',this)")));
  /* برو: لا شيء مخفي */
  const vis = async () => T(() => [...document.querySelectorAll(".side-nav .nav-btn")].filter(b => !b.classList.contains("nav-work") && !b.classList.contains("nav-hid") && getComputedStyle(b).display !== "none" && !b.classList.contains("ed-x")).map(b => (/Admin\.tab\('([a-z0-9]+)'/.exec(b.getAttribute("onclick") || "") || /AdminNav\.app\('([a-z0-9]+)'/.exec(b.getAttribute("onclick") || "") || [0, "?"])[1]));
  await T(() => { window.__d = {}; AdminEdition.apply(); });
  const pro = await T(() => [...document.querySelectorAll(".side-nav .nav-btn")].filter(b => b.classList.contains("ed-x")).length); ok("برو: لا زر مخفي بالنسخة", pro === 0, pro);
  /* بازيك */
  await T(() => { window.__d = { edition: "basic" }; AdminEdition.apply(); });
  const bas = await T(() => ({ hid: [...document.querySelectorAll(".side-nav .nav-btn.ed-x")].map(b => (/Admin\.tab\('([a-z0-9]+)'/.exec(b.getAttribute("onclick") || "") || [0, "?"])[1]), cls: document.documentElement.classList.contains("ed-basic"), groups: getComputedStyle(document.getElementById("nav-groups")).display }));
  ok("بازيك: يخفي ستوديو ديزاين ومولّد الصور", bas.cls && bas.hid.includes("studio") && bas.hid.includes("imggen") && bas.hid.length === 3, bas);
  ok("بازيك: الحارس يرفض studio ويفتح الرئيسية", await T(() => { __tabs.length = 0; Admin.tab("studio"); const a = __tabs.join(); __tabs.length = 0; Admin.tab("orders"); return a === "home" && __tabs.join() === "orders" && /غير متاح/.test(__toast); }));
  /* ديزاين */
  await T(() => { window.__d = { edition: "design" }; AdminEdition.apply(); });
  const dz = await T(() => ({ cls: document.documentElement.classList.contains("ed-design"), keep: [...document.querySelectorAll(".side-nav .nav-btn.ed-keep")].map(b => (/Admin\.tab\('([a-z0-9]+)'/.exec(b.getAttribute("onclick") || "") || /AdminNav\.app\('([a-z0-9]+)'/.exec(b.getAttribute("onclick") || "") || [0, "?"])[1]), groups: getComputedStyle(document.getElementById("nav-groups")).display, shownVisible: [...document.querySelectorAll(".side-nav .nav-btn.ed-keep")].every(b => getComputedStyle(b).display !== "none"), hiddenAll: [...document.querySelectorAll(".side-nav .nav-btn.ed-x")].every(b => getComputedStyle(b).display === "none") }));
  ok("ديزاين: يبقى مطوّر الصفحات وستوديو ديزاين والإعدادات الضرورية فقط", dz.cls && dz.keep.includes("builder") && dz.keep.includes("studio") && dz.keep.includes("store") && dz.keep.includes("admtheme") && !dz.keep.some(k => ["orders", "products", "finance", "shipped", "digital", "appstore", "wallet", "customers", "social", "fees", "delivery", "coupons", "agent", "voice", "checkout"].includes(k)), dz.keep);
  ok("ديزاين: كل زر مُبقى ظاهر وكل زر محجوب مخفي فعلاً ومجموعات القائمة مخفية", dz.shownVisible && dz.hiddenAll && dz.groups === "none", dz);
  ok("ديزاين: الحارس يحوّل orders/home/finance إلى مطوّر الصفحات ويسمح builder وstudio", await T(() => { const r = []; for (const t of ["orders", "home", "finance", "builder", "studio"]) { __tabs.length = 0; Admin.tab(t); r.push(__tabs.join()); } return r.join("|") === "builder|builder|builder|builder|studio"; }));
  ok("ديزاين: الصفحة المقصودة عند الفتح = مطوّر الصفحات", await T(() => AdminEdition.landing() === "builder"));
  /* ديجيتال */
  await T(() => { window.__d = { edition: "digital" }; AdminEdition.apply(); });
  ok("ديجيتال: يحجب التوصيل والمادي ويُبقي المنتجات الرقمية والطلبات والستوديو", await T(() => ["shipped", "dispatch", "delivery", "fees", "returns", "inventory", "pack", "callcenter"].every(t => !AdminEdition.allows("digital", t)) && ["digital", "orders", "products", "finance", "studio", "builder", "home"].every(t => AdminEdition.allows("digital", t)) && document.documentElement.classList.contains("ed-digital")));
  ok("ديجيتال: الحارس يحوّل shipped إلى digital", await T(() => { __tabs.length = 0; Admin.tab("shipped"); const a = __tabs.join(); __tabs.length = 0; Admin.tab("orders"); return a === "digital" && __tabs.join() === "orders"; }));
  ok("ديجيتال: الصفحة المقصودة = digital", await T(() => AdminEdition.landing() === "digital"));
  /* البطاقة */
  const card = await T(() => { const d = document.createElement("div"); d.innerHTML = AdminEdition.cardHtml("basic"); document.getElementById("stage").appendChild(d); return { n: d.querySelectorAll('input[name="stp-edition"]').length, checked: AdminEdition.picked(), txt: d.textContent }; });
  ok("بطاقة الإعدادات: أربعة خيارات والمحدّد الحالي", card.n === 4 && card.checked === "basic" && /إيكومرس برو/.test(card.txt) && /إيكومرس بازيك/.test(card.txt) && /إنفوغراف ديزاين/.test(card.txt), card);
  /* العودة لبرو */
  await T(() => { window.__d = { edition: "pro" }; AdminEdition.apply(); });
  ok("الرجوع إلى برو يعيد كل شيء", await T(() => !document.documentElement.classList.contains("ed-design") && !document.documentElement.classList.contains("ed-basic") && [...document.querySelectorAll(".side-nav .nav-btn.ed-x")].length === 0));
  ok("نسخة غير معروفة = برو", await T(() => { window.__d = { edition: "zzz" }; return AdminEdition.edition() === "pro"; }));
  ok("بلا أخطاء JS", errs.length === 0, errs);
  console.log(fails ? "فشل " + fails + " من " + total : "نجح " + total + " من " + total);
  await b.close(); process.exit(fails ? 1 : 0);
})();
