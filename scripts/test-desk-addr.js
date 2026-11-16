/* عنوان مكتب التوصيل يُحفظ في الطلب وقت إنشائه ويُعرض مع زر نسخ: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-desk-addr.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1000, height: 1200 } }); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, out = {}; window.toast = () => { }; const wait = ms => new Promise(r => setTimeout(r, ms));
    const w = WILAYAS.find(x => x.id === 30); w.desks = [{ id: 1, name: "Hub Ouargla Centre", commune: "Ouargla", address: "Rue 1er Novembre, face à la poste, Ouargla" }, { id: 2, name: "Hub Ouargla Centre", commune: "Hassi Messaoud", address: "Cité 500 logts, Hassi Messaoud" }];
    const mk = (id, extra) => ({ id, date: new Date().toISOString(), name: "ز", phone: "0550000000", wilaya: w.name, commune: "Ouargla", dtype: "stop", desk: "Hub Ouargla Centre", items: "x ×1 = 1000 DA", subtotal: 1000, fee: 0, total: 1000, extra: extra || {}, status: "nouvelle", note: "" });
    const o1 = mk("S1"), o2 = mk("S2", { "📍 عنوان المكتب": "العنوان المحفوظ وقت الطلب" }), o3 = mk("S3"); o3.commune = "Hassi Messaoud"; const o4 = mk("S4"); o4.dtype = "home";
    out.fromList = A.deskAddrOf(o1); out.saved = A.deskAddrOf(o2); out.byCommune = A.deskAddrOf(o3); out.home = A.deskAddrOf(o4);
    /* المعاينة: صف العنوان + نسخ + تثبيت تلقائي للطلب القديم */
    const calls = []; const u0 = API.updateOrderFields; API.updateOrderFields = async (k, id, f) => { calls.push({ id, f }); return true; };
    A.orders = [o1, o2]; A.orderFilters = {}; A.renderOrders(); A.openOrderPreview(0); await wait(400);
    const txt = document.getElementById("ord-prev-b").innerText; out.prev = { addr: /Rue 1er Novembre/.test(txt), copyBtn: !!document.querySelector("#ord-prev-b button[onclick*=copyDeskAddr]") };
    out.persist = calls.find(c => c.id === "S1"); let copied = ""; try { Object.defineProperty(navigator, "clipboard", { value: { writeText: async v => { copied = v; } }, configurable: true }); } catch (e) { }
    A.copyDeskAddr("S1"); await wait(200); out.copied = copied; API.updateOrderFields = u0;
    /* الطلب اليدوي */
    const saved = []; API.addOrder = async o => { saved.push(o); return { ok: true, id: "M-DA1" }; };
    A.deliveryCfg = { yalidine: { enabled: true, isDefault: true } };
    const src = { id: "S9", name: "زبون", phone: "0550123456", wilaya: w.name, commune: "Ouargla", dtype: "stop", desk: "Hub Ouargla Centre", items: "منتج ×1 = 3000 DA", subtotal: 3000, fee: 0, total: 3000, extra: {} };
    ManualOrder.open({ mode: "copy", order: src }); await wait(700); const bg = document.getElementById("mo-bg");
    const dk = bg.querySelector("#mo-desk"); out.deskOpts = [...dk.options].map(o => o.value).join("|"); dk.value = "Hub Ouargla Centre"; bg.querySelector("#mo-save").click(); await wait(1200);
    out.manual = saved[0] ? { addr: saved[0].extra && saved[0].extra["📍 عنوان المكتب"], desk: saved[0].desk } : null;
    return out; });
  ok("العنوان من قائمة مكاتب الولاية (وبحسب البلدية عند تكرار الاسم)", /Rue 1er Novembre/.test(R.fromList) && /Hassi Messaoud/.test(R.byCommune), [R.fromList, R.byCommune]);
  ok("العنوان المحفوظ في الطلب يسبق القائمة، والمنزل بلا عنوان", R.saved === "العنوان المحفوظ وقت الطلب" && R.home === "", [R.saved, R.home]);
  ok("معاينة الطلب تعرض العنوان وزر نسخ", R.prev.addr && R.prev.copyBtn, R.prev);
  ok("طلب قديم بلا عنوان: يُثبَّت تلقائياً في الطلب (extra)", R.persist && R.persist.f.extra && /Rue 1er Novembre/.test(R.persist.f.extra["📍 عنوان المكتب"]), R.persist);
  ok("زر النسخ ينسخ اسم المكتب وعنوانه", /Hub Ouargla Centre — Rue 1er Novembre/.test(R.copied), R.copied);
  ok("الطلب اليدوي بمكتب: يحفظ عنوان المكتب في الطلب", R.manual && /Rue 1er Novembre/.test(R.manual.addr) && R.manual.desk === "Hub Ouargla Centre", [R.manual, R.deskOpts]);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
