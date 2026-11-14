/* شريط «جارٍ التنفيذ»: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-busy.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  await p.evaluate(() => { const A = Admin; A.deliveryCfg = Object.assign({}, A.deliveryCfg, { dhd: { enabled: true, isDefault: true, token: "T", baseUrl: "https://platform.dhd-dz.com" } });
    const d = document.createElement("div"); d.id = "tbox"; d.innerHTML = A.fetchPricesButtonHtml(); document.body.appendChild(d);
    window.__calls = 0; A.courierFetch = async req => { window.__calls++; await new Promise(r => setTimeout(r, 120)); return { ok: true, status: 200, text: JSON.stringify({ "1": { nom: "Alpha", has_stop_desk: 1, code_postal: "00" + window.__calls } }) }; };
    try { Object.keys(localStorage).filter(k => /^alyssum_centers_v/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) { } A._centersMap = {}; });
  const btn = () => p.evaluate(() => { const b = [...document.querySelectorAll("#tbox button")].find(x => /مزامنة مكاتب Stop Desk/.test(x.textContent)); b.click(); return true; });
  await btn(); await p.waitForTimeout(400);
  const a = await p.evaluate(() => { const bx = document.getElementById("busy-box"); return { shown: !!bx, text: bx ? bx.textContent.replace(/\s+/g, " ") : "", bg: bx && getComputedStyle(bx.firstElementChild).backgroundColor }; });
  ok("يظهر شريط «جارٍ مزامنة مكاتب Stop Desk…» فور الضغط مع تقدّم الولايات والثواني", a.shown && /جارٍ مزامنة مكاتب/.test(a.text) && /الولاية \d+ من 58/.test(a.text) && /ث/.test(a.text), a);
  ok("خلفية الشريط معتمة", a.bg && !/rgba\(0, 0, 0, 0\)/.test(a.bg), a);
  await btn(); await p.waitForTimeout(100); ok("ضغطة ثانية أثناء التنفيذ لا تبدأ مزامنة ثانية", (await p.evaluate(() => document.querySelectorAll(".busy-pill").length)) === 1);
  await p.waitForFunction(() => !document.getElementById("busy-box"), null, { timeout: 30000 });
  ok("يختفي الشريط عند انتهاء العملية (58 ولاية جُلبت مرة واحدة)", (await p.evaluate(() => window.__calls)) === 58, await p.evaluate(() => window.__calls));
  /* دالة تفشل: يختفي الشريط أيضاً */
  const f = await p.evaluate(async () => { Admin.syncDesksFromCompany = Admin.syncDesksFromCompany; let boxes = []; const orig = Admin.fetchCompanyPrices; Admin.courierFetch = async () => { throw new Error("boom"); }; try { document.querySelector("#tbox button[onclick*=fetchCompanyPrices]").click(); } catch (e) { } boxes.push(!!document.getElementById("busy-box")); await new Promise(r => setTimeout(r, 400)); boxes.push(!!document.getElementById("busy-box")); return boxes; });
  ok("جلب الأسعار: الشريط يظهر عند الضغط ويختفي بعد انتهاء العملية (حتى عند الفشل)", f[0] === true && f[1] === false, f);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
