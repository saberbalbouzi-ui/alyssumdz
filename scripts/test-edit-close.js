/* بعد حفظ تعديل طلب مرسَل: النافذة تُغلق وتعود المعاينة حتى لو فشلت/علّقت الشركة: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-edit-close.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const scenario = async (mode) => p.evaluate(async (mode) => {
    const A = Admin, mk = () => ({ id: "S-" + mode, date: new Date().toISOString(), name: "زبون قديم", phone: "0550000000", wilaya: "Alger", commune: "Alger Centre", dtype: "home", desk: "", items: "م ×1 = 1000 DA", subtotal: 1000, fee: 500, total: 1500, extra: {}, status: "confirmee", note: "🚚dhd:DHD123456" });
    A.orders = [mk()]; const o = A.orders[0]; API.updateOrderFields = async () => true; A.openOrderPreview = function (i) { document.body.dataset.prev = "open:" + i; };
    A.updateAtCompany = mode === "throw" ? async () => { const e = new Error("CORS_BLOCKED"); e.cors = true; throw e; } : mode === "hang" ? () => new Promise(() => { }) : async () => ({ ok: true });
    window.__TO = setTimeout; if (mode === "hang") { window.setTimeout = (fn, ms, ...a) => ms === 25000 ? window.__TO(fn, 200, ...a) : window.__TO(fn, ms, ...a); }
    delete document.body.dataset.prev; OrderEdit.open(0); await new Promise(r => setTimeout(r, 400));
    document.getElementById("oe-name").value = "زبون جديد"; document.getElementById("oe-save").click();
    for (let k = 0; k < 40 && document.getElementById("oe-bg"); k++) await new Promise(r => setTimeout(r, 100));
    window.setTimeout = window.__TO; const notice = document.getElementById("notice-modal-bg"); return { closed: !document.getElementById("oe-bg"), prev: document.body.dataset.prev || "", name: o.name, notice: !!(notice && notice.classList.contains("open")) }; }, mode);
  const ok1 = await scenario("ok"), th = await scenario("throw"), hg = await scenario("hang");
  ok("نجاح الشركة: تُغلق النافذة وتعود المعاينة", ok1.closed && ok1.prev === "open:0" && ok1.name === "زبون جديد", ok1);
  ok("الشركة ترمي استثناء (حجب المتصفح): تُغلق النافذة وتعود المعاينة مع تنبيه", th.closed && th.prev === "open:0" && th.notice, th);
  ok("الشركة تعلّق: تنتهي المهلة فتُغلق النافذة وتعود المعاينة", hg.closed && hg.prev === "open:0", hg);
  ok("بلا أخطاء JS غير معالَجة", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
