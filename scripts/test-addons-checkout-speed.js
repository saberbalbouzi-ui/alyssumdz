/* «نموذج الطلب» و«سرعة الموقع» صارا من الإضافات: يظهران في كتالوج الإضافات، و«أفتح» يفتح قسمهما، وتعطيلهما يمنع الفتح من الإضافة. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  const r = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; await new Promise(r => setTimeout(r, 800));
    const keys = Object.keys(AdminNav.apps()), vis = id => { const e = document.getElementById(id); return !!e && !e.classList.contains("hidden"); };
    const navVisible = [...document.querySelectorAll('.side-nav .nav-btn[onclick*="Admin.tab(\'checkout\'"],.side-nav .nav-btn[onclick*="Admin.tab(\'speed\'"]')].filter(b => getComputedStyle(b).display !== "none").length;
    const waitVis = async id => { for (let i = 0; i < 30; i++) { if (vis(id)) return true; await new Promise(r => setTimeout(r, 200)); } return false; }; AdminNav.work("checkout"); const c1 = await waitVis("tab-checkout"); AdminNav.work("speed"); const s1 = await waitVis("tab-speed");
    AdminNav.toggle("speed", false); const toasts = []; window.toast = m => toasts.push(m); AdminNav.work("speed"); AdminNav.toggle("speed", true);
    const cards = typeof AdminAddons !== "undefined"; return { keys, navVisible, c1, s1, offToast: toasts.join("|"), cards }; });
  t("الإضافتان مسجَّلتان في سجلّ الإضافات", r.keys.includes("checkout") && r.keys.includes("speed"), r.keys);
  t("زرّاهما القديمان لا يظهران في القائمة الجانبية (صارا في الإضافات)", r.navVisible === 0, r);
  t("«أفتح» يفتح قسم نموذج الطلب وقسم سرعة الموقع", r.c1 && r.s1, r);
  t("التعطيل يمنع الفتح من الإضافة برسالة", /معطّلة/.test(r.offToast), r.offToast);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
