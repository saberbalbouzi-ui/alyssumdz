/* عدة حملات لنفس المنتج: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-multi-campaign.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 1200 } }); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, out = {}; window.toast = () => { }; window.confirm = () => true; const wait = ms => new Promise(r => setTimeout(r, ms)); const saved = {}; Priv.set = async (k, v) => { saved[k] = JSON.parse(JSON.stringify(v)); };
    document.documentElement.classList.remove("glass"); document.documentElement.classList.add("white"); document.getElementById("app").classList.remove("hidden");
    A.products = [{ slug: "pa", title: "منتج أ", price: 2000, active: true }, { slug: "pb", title: "منتج ب", price: 1000, active: true }];
    A.fin.costs = { pa: 500, pb: 300 }; A.fin.adh = []; A.fin.ads = { pa: { method: "spend", a: 1000, n: 0, m: 1, from: "2026-11-01", name: "camp_one" } };
    const day = "2026-11-10T10:00:00Z"; let id = 0; const mk = (camp) => ({ id: "T" + (++id), date: day, name: "ز", phone: "0550000000", wilaya: "Alger", commune: "c", dtype: "home", items: "منتج أ ×1 = 2000 DA", lines: [{ slug: "pa", title: "منتج أ", qty: 1, price: 2000 }], subtotal: 2000, fee: 0, total: 2000, extra: camp ? { "📣 الحملة": camp } : {}, status: "livree", note: "" });
    A.orders = [mk("camp_one"), mk("camp_one"), mk("camp_two"), mk("camp_two"), mk("camp_two"), mk("camp_two")];
    A._adCampsC = null; A._adRows = null; A._adSig = null;
    /* إضافة حملة ثانية لنفس المنتج */
    A.tab("finance"); A.renderAds(true); A.addAdRow(); await wait(100);
    out.rowsAfterAdd = A._adRows.length; const r2 = A._adRows[A._adRows.length - 1]; r2.slug = "pa"; r2.cfg = { method: "spend", a: 3000, n: 0, m: 1, from: "2026-11-01", name: "camp_two" };
    A.adSync = () => { }; await A.saveAdRow(A._adRows.length - 1, true);
    out.keys = Object.keys(A.fin.ads).sort(); out.persist = saved.adcfg ? Object.keys(saved.adcfg).sort() : null;
    out.camps = A.adAllCamps().map(c => c.key + ":" + c.slug);
    /* اختيار الحملة بحسب الاسم */
    const t = new Date(day).getTime(); out.pick1 = (A.adPick("pa", t, A.orders[0]) || {}).key; out.pick2 = (A.adPick("pa", t, A.orders[2]) || {}).key; out.pickNone = (A.adPick("pa", t, mk(""), 0) || {}).key;
    /* تكلفة الإعلان لكل طلب: camp_one 1000/2 = 500 للطلب، camp_two 3000/4 = 750 */
    const F = A.computeFinance(0); out.adTotal = Math.round(F.K.adTotal); out.perAd = Math.round(F.per.pa.ad);
    /* الصف الأول بعد الإضافة يُحفظ بمفتاح مختلف ولا يستبدل الأولى */
    out.firstKept = A.fin.ads.pa && A.fin.ads.pa.name === "camp_one" && A.fin.ads["pa#2"] && A.fin.ads["pa#2"].name === "camp_two";
    /* حذف الأولى ⟵ تتقدّم الثانية */
    const i1 = A._adRows.findIndex(r => r.orig === "pa"); await A.delAdRow(i1); out.afterDel = Object.keys(A.fin.ads).sort().join(","); out.promoted = A.fin.ads.pa && A.fin.ads.pa.name;
    /* الرئيسية تحمل المفتاح */
    A.fin.ads = { pa: { method: "spend", a: 1, from: "2026-11-01", name: "x" }, "pa#2": { method: "spend", a: 2, from: "2026-11-01", name: "y" } }; A._adCampsC = null; AdminHome.render(); out.homeKeys = [...document.querySelectorAll("#ahome [data-adt]")].map(x => x.getAttribute("data-adt"));
    return out; });
  ok("إضافة حملة لنفس المنتج مسموحة وتُحفظ بمفتاح pa#2 دون استبدال الأولى", R.rowsAfterAdd === 2 && R.firstKept && JSON.stringify(R.keys) === JSON.stringify(["pa", "pa#2"]) && JSON.stringify(R.persist) === JSON.stringify(["pa", "pa#2"]), R);
  ok("الحملتان تحملان المنتج نفسه ومفتاحيهما", JSON.stringify(R.camps) === JSON.stringify(["pa:pa", "pa#2:pa"]), R.camps);
  ok("اختيار الحملة بحسب وسم الطلب «📣 الحملة» (camp_one ← pa، camp_two ← pa#2) وبلا وسم ← أول حملة", R.pick1 === "pa" && R.pick2 === "pa#2" && R.pickNone === "pa", [R.pick1, R.pick2, R.pickNone]);
  ok("تكلفة الإعلان تُوزَّع: 1000 على طلبي الأولى + 3000 على أربعة طلبات الثانية = 4000", R.adTotal === 4000 && R.perAd === 4000, [R.adTotal, R.perAd]);
  ok("حذف الحملة الأولى تُقدِّم الثانية لتصير fin.ads.pa", R.afterDel === "pa" && R.promoted === "camp_two", [R.afterDel, R.promoted]);
  ok("بطاقة الرئيسية تفعّل/تعطّل كل حملة بمفتاحها (pa وpa#2)", JSON.stringify(R.homeKeys) === JSON.stringify(["pa", "pa#2"]), R.homeKeys);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
