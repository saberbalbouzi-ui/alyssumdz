/* إحصائيات اليوم في الرئيسية: عدد المرسَلة والسعر الإجمالي وسعر التوصيل والصافي. NODE_PATH=/opt/node-tools/node_modules node scripts/test-home-today.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const R = await p.evaluate(async () => {
    const A = Admin, out = {}; document.getElementById("app").classList.remove("hidden");
    const now = Date.now(), mk = (id, tot, fee) => ({ id, date: new Date().toISOString(), name: "ز" + id, phone: "0550000000", wilaya: "Alger", commune: "x", dtype: "home", items: "a ×1 = " + tot + " DA", subtotal: tot, fee, total: tot, status: "confirmee", note: "", extra: {} });
    A.orders = [mk("T1", 3000, 400), mk("T2", 2000, 0), mk("T3", 5000, 600), mk("OLD", 9999, 500)];
    A.carrierFee = (k, o) => ({ T1: 500, T2: 450 })[o.id] || 0;
    const reg = { "tr1": { id: "T1", at: now - 1000, co: "wecan" }, "tr2": { id: "T2", at: now - 2000, co: "yalidine" }, "tr3": { id: "T3", at: now - 3000, co: "wecan" }, "trO": { id: "OLD", at: now - 3 * 864e5, co: "wecan" }, "trX": { id: "GONE", at: now - 4000, co: "wecan" }, "trdup": { id: "T1", at: now - 500, co: "wecan" } };
    AdminYd.sentLog = () => reg;
    out.s = AdminHome.todayStats(); AdminHome.render(); const card = [...document.querySelectorAll("#ahome .ah-card")].find(c => /إحصائيات اليوم/.test(c.textContent)); out.card = !!card; out.txt = card ? card.textContent.replace(/\s+/g, " ") : ""; out.tiles = card ? card.querySelectorAll(".ah-pc").length : 0;
    { AdminHome.render(); await new Promise(r => setTimeout(r, 1500)); AdminHome.render(); const c1 = document.querySelector("#ahome .ah-card"); AdminHome.render(); AdminHome.render(); out.stable = c1 === document.querySelector("#ahome .ah-card"); }
    AdminYd.sentLog = null; localStorage.setItem("alyssum_yd_sent", JSON.stringify({ x1: { id: "T1", at: now - 100, co: "wecan" } })); out.fb = AdminHome.todayStats(); localStorage.removeItem("alyssum_yd_sent");
    return out; });
  t("الحساب: 4 طلبات مرسَلة اليوم (T1 يتكرر مرة واحدة، وطلب محذوف يُعدّ)، القديم لا يُحسب", R.s.n === 4 && R.s.miss === 1, R.s);
  t("السعر الإجمالي 10000 (3000+2000+5000)، التوصيل 500+450+600 (رسم الطلب لما لا تعريفة له)، الصافي 8450", R.s.total === 10000 && R.s.del === 1550 && R.s.net === 8450 && R.s.est === 1, R.s);
  t("بطاقة «إحصائيات اليوم» في الرئيسية بأربع خانات", R.card && R.tiles === 4 && /عدد الطلبات المرسَلة/.test(R.txt) && /السعر الإجمالي/.test(R.txt) && /سعر التوصيل/.test(R.txt) && /الصافي/.test(R.txt), R.txt.slice(0, 300));
  t("على الهاتف (AdminYd غير جاهز): يُقرأ السجلّ المحفوظ مباشرة فتظهر البطاقة", R.fb && R.fb.n === 1 && R.fb.total === 3000, R.fb);
  t("إعادة الرسم بلا تغيير لا تبني الصفحة من جديد (البطاقات لا تتحرك)", R.stable === true, R.stable);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
