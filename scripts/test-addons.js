/* قسم «الإضافات»: المنصَّبة / متجر الإضافات / تطوير الإضافات؛ التثبيت والتفعيل وإلغاء التثبيت، وبحث المتجر بالاسم، وإخفاء أدوات ستوديو ديزاين المعطَّلة. NODE_PATH=/opt/node-tools/node_modules node scripts/test-addons.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1300, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 160)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.removeItem("alyssum_lang"); localStorage.removeItem("admin_apps_rm"); localStorage.removeItem("admin_apps_off"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const o = {}, W = ms => new Promise(r => setTimeout(r, ms)); document.getElementById("app").classList.remove("hidden"); window.toast = () => { };
    AdminNav.group("apps"); await W(400); o.navApps = [...document.querySelectorAll('.side-nav .nav-btn[data-grp="apps"]')].filter(x => !x.classList.contains("nav-hid") && !x.classList.contains("nav-work")).map(x => (x.querySelector("b") || {}).textContent);
    o.navShopHas = [...document.querySelectorAll('.side-nav .nav-btn[data-grp="shop"]')].some(x => /appstore|appdev/.test(x.getAttribute("onclick") || ""));
    try { AdminStudio.load(); } catch (e) { } await W(1500); const btn = [...document.querySelectorAll(".nav-btn")].find(x => /'addons'/.test(x.getAttribute("onclick") || "")); Admin.tab("addons", btn); await W(1500);
    const cards = () => [...document.querySelectorAll("#ai-body .ao-card")];
    o.n0 = cards().length; o.core0 = cards().filter(c => !/^sd:/.test(c.dataset.aid)).length; o.sd0 = cards().filter(c => /^sd:/.test(c.dataset.aid)).length;
    o.ver = !!document.querySelector("#ai-body .ao-v"); o.sum = (document.querySelector("#ai-body .ao-sum") || {}).textContent;
    // بحث بالاسم
    const q = document.getElementById("ai-q"); q.value = "الوكيل"; q.dispatchEvent(new Event("input", { bubbles: true })); await W(200); o.searchN = cards().length; o.searchHas = cards().some(c => /الوكيل/.test(c.textContent)); q.value = ""; q.dispatchEvent(new Event("input", { bubbles: true })); await W(200);
    // تعطيل إضافة ثم تصفية «المعطّلة»
    const tg = document.querySelector('#ai-body input[data-ao="tg"][data-id="cloner"]'); tg.checked = false; tg.dispatchEvent(new Event("change", { bubbles: true })); await W(300);
    o.clonerOff = AdminNav.isOff("cloner"); document.querySelector('#ai-body [data-ao="inf"][data-k="off"]').click(); await W(200); o.offList = cards().map(c => c.dataset.aid).filter(x => !/^sd:/.test(x)); document.querySelector('#ai-body [data-ao="inf"][data-k="all"]').click(); await W(100);
    // إلغاء تثبيت أداة ستوديو ثم اختفاؤها من الستوديو
    const sdId = (cards().find(c => /^sd:/.test(c.dataset.aid)) || {}).dataset.aid; o.sdId = sdId; const stBefore = AdminStudio.catalog().length;
    window.confirm = () => true; document.querySelector(`#ai-body [data-ao="rm"][data-id="${sdId}"]`).click(); await W(300);
    o.sdGone = !document.querySelector(`#ai-body .ao-card[data-aid="${sdId}"]`); o.stAfter = AdminStudio.catalog().length; o.stBefore = stBefore; o.rmSaved = JSON.parse(localStorage.getItem("admin_apps_rm") || "[]").includes(sdId);
    // المتجر: الأداة المُلغاة تظهر بزر «تثبيت وتفعيل»، والبحث بالاسم
    const sb = [...document.querySelectorAll(".nav-btn")].find(x => /'appstore'/.test(x.getAttribute("onclick") || "")); Admin.tab("appstore", sb); await W(1800);
    o.storeCards = document.querySelectorAll("#ao-store .ao-card").length; const sc = document.querySelector(`#ao-store .ao-card[data-aid="${sdId}"]`); o.storeInstallBtn = !!(sc && /تثبيت وتفعيل/.test(sc.textContent)); o.storeVer = !!document.querySelector("#ao-store .ao-v");
    const sq = document.getElementById("as-q"); sq.value = "نزع"; sq.dispatchEvent(new Event("input", { bubbles: true })); await W(250); o.sq = [...document.querySelectorAll("#ao-store .ao-card")].map(c => c.querySelector("b").textContent);
    sq.value = ""; sq.dispatchEvent(new Event("input", { bubbles: true })); await W(200);
    sc.querySelector('[data-ao="install"]') ? null : 0; document.querySelector(`#ao-store .ao-card[data-aid="${sdId}"] [data-ao="install"]`).click(); await W(300);
    o.reinstalled = AdminNav.usable(sdId) && AdminStudio.catalog().length === stBefore;
    const c2 = document.querySelector('#ao-store .ao-card[data-aid="cloner"]'); o.clonerStoreOn = !!(c2 && /تفعيل/.test(c2.textContent) && !/مثبَّتة ومفعّلة/.test(c2.textContent)); c2.querySelector('[data-ao="on"]').click(); await W(300); o.clonerOn = !AdminNav.isOff("cloner");
    // زرّ «الإعدادات» يفتح صفحة إعدادات الإضافة
    Admin.tab("addons", btn); await W(800); document.querySelector('#ai-body [data-ao="cfg"][data-id="protect"]').click(); await W(800); o.cfg = !document.getElementById("tab-appcfg").classList.contains("hidden") && /Protection|حماية/.test(document.getElementById("app-cfg-body").textContent);
    o.storeNoOpen = !document.querySelector('#ao-store [data-ao="open"]');
    // تبويب تطوير الإضافات
    const db = [...document.querySelectorAll(".nav-btn")].find(x => /'appdev'/.test(x.getAttribute("onclick") || "")); Admin.tab("appdev", db); await W(1200); o.dev = document.getElementById("tab-appdev") && !document.getElementById("tab-appdev").classList.contains("hidden");
    // الفرنسية
    await AdminI18n.set("fr"); Admin.tab("addons", btn); await W(1800); o.fr = document.getElementById("tab-addons").innerText.slice(0, 400);
    return o; });
  t("القائمة الجانبية لمجموعة الإضافات: المنصَّبة ثم المتجر ثم تطوير الإضافات في المقدّمة، وخرجتا من مجموعة المتجر", R.navApps[0] === "الإضافات المنصَّبة" && R.navApps[1] === "متجر الإضافات" && R.navApps[2] === "تطوير الإضافات" && !R.navShopHas, R);
  t("«الإضافات المنصَّبة»: بطاقات الإضافات وأدوات الستوديو بالإصدار وملخّص العدّ", R.core0 >= 8 && R.sd0 >= 30 && R.ver && /المثبَّتة/.test(R.sum || ""), R);
  t("البحث السريع بالاسم في المنصَّبة", R.searchN >= 1 && R.searchN < R.n0 && R.searchHas, R);
  t("تعطيل إضافة يحفظ حالتها ويظهر تحت «المعطّلة»", R.clonerOff && R.offList.includes("cloner"), R);
  t("إلغاء تثبيت أداة ستوديو: تختفي من المنصَّبة ومن الستوديو وتُحفظ في rm", R.sdGone && R.stAfter === R.stBefore - 1 && R.rmSaved, R);
  t("متجر الإضافات: كل الإضافات بالإصدار، والأداة المُلغاة بزر «تثبيت وتفعيل»، والبحث بالاسم يصفّي", R.storeCards >= 38 && R.storeVer && R.storeInstallBtn && R.sq.length >= 1 && R.sq.length < 6 && R.sq.some(x => /نزع/.test(x)), R);
  t("التثبيت يعيد الأداة للستوديو، وتفعيل إضافة معطّلة من المتجر", R.reinstalled && R.clonerStoreOn && R.clonerOn, R);
  t("متجر الإضافات بلا أي زر «فتح»", R.storeNoOpen, R);
  t("تبويب «تطوير الإضافات» يفتح وزرّ «الإعدادات» يفتح إعدادات الإضافة", R.dev && R.cfg, R);
  t("الفرنسية: نص التبويب بلا عربية غالبة", !/[؀-ۿ]{5}.*[؀-ۿ]{5}.*[؀-ۿ]{5}.*[؀-ۿ]{5}.*[؀-ۿ]{5}/s.test(R.fr || ""), R.fr);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
