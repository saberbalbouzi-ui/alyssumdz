/* استيراد كشف الدفع لشركة غير ياليدين: زر لكل شركة مفعّلة، واكتشاف الأعمدة (فرنسي/عربي)، وحساب الصافي حين يغيب عموده. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright"); const fs = require("fs");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1300, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.removeItem("alyssum_lang"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  await p.evaluate(() => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; Admin.deliveryCfg = Object.assign({}, Admin.deliveryCfg, { wecan: { enabled: true }, yalidine: { enabled: true } }); Admin.tab("finance"); Admin.renderFinance(true); });
  await p.waitForTimeout(500);
  const btns = await p.evaluate(() => [...document.querySelectorAll("#fin-co-imp button")].map(x => x.textContent.trim()));
  t("زر لكل شركة مفعّلة غير ياليدين (WeCan) وبلا زر ياليدين مكرَّر", btns.length >= 1 && btns.some(x => /WeCan/i.test(x)) && !btns.some(x => /Yalidine/i.test(x)), btns);
  const dir = "/tmp/coimp"; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + "/fr.csv", "Tracking;Statut;Montant COD;Frais livraison;Taxe COD;Net client\nWC111111;Livré;2 000,00;600;15;1385\nWC222222;Retourné;0;0;0;-250\n");
  fs.writeFileSync(dir + "/ar.csv", "رقم التتبع,الحالة,المبلغ,رسم التوصيل,عمولة COD\nWC333333,مسلّم,1800,550,13.5\n");
  const run = async (file) => { await p.evaluate(() => { Admin.ydActual = {}; const i = document.getElementById("fin-import-co"); i.dataset.co = "wecan"; });
    await p.setInputFiles("#fin-import-co", file); await p.waitForTimeout(900); return p.evaluate(() => ({ a: Admin.ydActual, notice: (document.querySelector(".notice-card,.modal,#notice,.an-notice") || document.body).innerText.slice(-600) })); };
  const fr = await run(dir + "/fr.csv"), a1 = fr.a.WC111111, a2 = fr.a.WC222222;
  t("كشف فرنسي: التقاط التتبع والأعمدة وفاصل الأرقام الفرنسي", a1 && a1.price === 2000 && a1.del === 600 && a1.cod === 15 && a1.net === 1385 && a1.co === "wecan", fr.a);
  t("المرتجع: الصافي سالب كما في الكشف", a2 && a2.net === -250, a2);
  const ar = await run(dir + "/ar.csv"), a3 = ar.a.WC333333;
  t("كشف عربي بلا عمود صافٍ: الصافي = المحصَّل − (التوصيل + العمولة)", a3 && a3.price === 1800 && a3.del === 550 && Math.abs(a3.net - (1800 - 550 - 13.5)) < 0.01, ar.a);
  fs.writeFileSync(dir + "/bad.csv", "A,B\n1,2\n"); await p.evaluate(() => { Admin.ydActual = {}; document.getElementById("fin-import-co").dataset.co = "wecan"; }); await p.setInputFiles("#fin-import-co", dir + "/bad.csv"); await p.waitForTimeout(700);
  t("ملف بلا عمود تتبع: لا يُخزَّن شيء", await p.evaluate(() => Object.keys(Admin.ydActual).length === 0), 0);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
