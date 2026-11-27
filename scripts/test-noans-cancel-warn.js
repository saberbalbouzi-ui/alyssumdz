/* تسجيل طلب جديد: هاتف له طلب سابق أُلغي بعد محاولات اتصال دون رد ⟵ تنبيه كالمرتجعات؛ والزبون السليم بلا تنبيه. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { };
    const mk = (id, st, note, ph, d) => ({ id, status: st, note, phone: ph, name: "ن", date: d || "2026-11-20T10:00:00Z", total: 1000 });
    Admin.orders = [mk("N1", "annulee", "📞3", "0550123456"), mk("N2", "annulee", "", "0660111222"), mk("N3", "livree", "📞2", "0770999888"), mk("N4", "annulee", "📞1", "0550123456", "2026-11-22T10:00:00Z")];
    Admin.blInval(); try { ManualOrder.open(); } catch (e) { window.__e = String(e); } await new Promise(r => setTimeout(r, 600)); });
  const warn = async ph => { await p.evaluate(ph => { const i = document.getElementById("mo-phone"); i.value = ph; i.dispatchEvent(new Event("input", { bubbles: true })); }, ph); await p.waitForTimeout(250); return p.evaluate(() => { const w = document.getElementById("mo-blw"); return w && !w.classList.contains("hidden") ? w.textContent : ""; }); };
  const w1 = await warn("0550123456"), w2 = await warn("0660111222"), w3 = await warn("0770999888"), w4 = await warn("0555000111");
  t("هاتف له طلبان أُلغيا بعد محاولات: تنبيه بالعدد وأقصى المحاولات", /تنبيه/.test(w1) && /2 طلبات سابقة أُلغيت/.test(w1) && /3 محاولات/.test(w1), w1);
  t("إلغاء بلا محاولات اتصال (الزبون ألغى) لا يُنبَّه", !/دون رد/.test(w2), w2);
  t("طلب مسلَّم بمحاولات سابقة لا يُنبَّه", !/دون رد/.test(w3), w3);
  t("زبون جديد: لا تنبيه إلغاء", !/دون رد/.test(w4), w4);
  t("بلا أخطاء JS", errs.length === 0 && !(await p.evaluate(() => window.__e)), errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
