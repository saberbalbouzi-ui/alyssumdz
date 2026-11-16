/* الطلب اليدوي: ناقل أرخص افتراضياً من جدول الشركة + خيار «توصيل مجاني»: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-manual-free.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1000, height: 1200 } }); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, out = {}; window.toast = () => { };
    A.deliveryCfg = { wecan: { enabled: true, isDefault: true, prices: {}, optionsFix: "30=ZR:900/650،WeCanServices:900/750؛8=ZR:900/650،WeCanServices:1300/1100" } };
    const saved = []; API.addOrder = async o => { saved.push(o); return { ok: true, id: "M-FREE1" }; };
    const src = { id: "S1", name: "زبون تجريبي", phone: "0550123456", wilaya: "Ouargla", commune: "Ouargla", dtype: "home", items: "منتج ×1 = 3000 DA", subtotal: 3000, fee: 900, total: 3900, extra: {} };
    const wb = WILAYAS.find(x => x.id === 8); wb.desks = [{ id: 1, name: "Hub Bechar", commune: "Abadla", co: "wecan" }];
    ManualOrder.open({ mode: "copy", order: src }); await new Promise(r => setTimeout(r, 700));
    const bg = document.getElementById("mo-bg"), q = s => bg.querySelector(s), wait = ms => new Promise(r => setTimeout(r, ms));
    const w = q("#mo-wil"); w.value = "Béchar"; w.dispatchEvent(new Event("change", { bubbles: true })); await wait(500);
    out.def = { fee: q("#mo-fee").value, hint: q("#mo-fh").textContent, brand: bg._brand };
    const st = bg.querySelector('input[name="mo-dt"][value="stop"]'); if (st && !st.disabled) { st.checked = true; st.dispatchEvent(new Event("change", { bubbles: true })); await wait(400); }
    out.stop = { fee: q("#mo-fee").value, brand: bg._brand, dis: st && st.disabled, com: q("#mo-com").value, desk: q("#mo-desk").innerText.slice(0, 60), dtp: (bg.querySelector('input[name="mo-dt"]:checked') || {}).value };
    const fr = q("#mo-free"); out.hasFree = !!fr; fr.checked = true; fr.dispatchEvent(new Event("change", { bubbles: true })); await wait(300);
    out.free = { fee: q("#mo-fee").value, dis: q("#mo-fee").disabled, hint: q("#mo-fh").textContent, tot: q("#mo-tot").textContent.replace(/\D/g, "") };
    const c = bg.querySelector('#mo-opts [data-ob="WeCanServices"][data-ok="home"]'); if (c) { c.click(); await wait(300); } out.freeCard = { fee: q("#mo-fee").value, brand: bg._brand };
    fr.checked = false; fr.dispatchEvent(new Event("change", { bubbles: true })); await wait(300);
    out.unfree = { fee: q("#mo-fee").value, dis: q("#mo-fee").disabled };
    fr.checked = true; fr.dispatchEvent(new Event("change", { bubbles: true })); await wait(300);
    q("#mo-save").click(); await wait(1200);
    out.saved = saved.length ? { fee: saved[0].fee, total: saved[0].total, free: saved[0].extra && saved[0].extra["توصيل مجاني"], brand: saved[0].extra && saved[0].extra["🚚 الناقل"] } : null;
    return out; });
  ok("بشار منزل: الافتراضي أرخص ناقل (ZR 900) تلقائياً", Number(R.def.fee) === 900 && R.def.brand === "ZR" && /الأرخص/.test(R.def.hint), R.def);
  ok("مكتب: الأرخص ZR 650", Number(R.stop.fee) === 650 && R.stop.brand === "ZR", R.stop);
  ok("خيار «توصيل مجاني» موجود، ويجعل الرسم 0 ومقفلاً مع توضيح أن المتجر يتحمّل", R.hasFree && Number(R.free.fee) === 0 && R.free.dis && /يتحمّل المتجر/.test(R.free.hint) && Number(R.free.tot) === 3000, R.free);
  ok("اختيار ناقل أثناء التوصيل المجاني يبقي الرسم 0 ويسجّل الناقل", Number(R.freeCard.fee) === 0 && R.freeCard.brand === "WeCanServices", R.freeCard);
  ok("إلغاء التوصيل المجاني يعيد الرسم الحقيقي ويفك القفل", Number(R.unfree.fee) > 0 && !R.unfree.dis, R.unfree);
  ok("الحفظ: رسم 0 ومجموع 3000 ووسم التوصيل المجاني", R.saved && R.saved.fee === 0 && R.saved.total === 3000 && R.saved.free === "نعم", R.saved);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
