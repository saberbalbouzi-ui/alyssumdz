/* لغة اللوحة تتبع «لغة الموقع» (store.json lang) ما لم يختر المستخدم؛ واختياره الصريح يتقدّم ويُحفظ. NODE_PATH=/opt/node-tools/node_modules node scripts/test-i18n-site.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  async function run(siteLang, stored) {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: "block" }), p = await ctx.newPage(), errs = [];      /* الـservice worker يتجاوز route فيمنع محاكاة store.json */ p.on("pageerror", e => { if (!/serviceWorker/.test(String(e))) errs.push(String(e).slice(0, 140)); });
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
    await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.route(/assets\/data\/store\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ name: "X", lang: siteLang }) }));
    await p.addInitScript(([s]) => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.removeItem("alyssum_lang"); if (s) localStorage.setItem("alyssum_lang", s); } catch (e) { } }, [stored]);
    await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(7500);
    const r = await p.evaluate(() => ({ lang: AdminI18n.lang, dir: document.documentElement.dir, stored: localStorage.getItem("alyssum_lang") })); r.errs = errs; await ctx.close(); return r;
  }
  const a = await run("fr", ""), b2 = await run("fr", "ar"), c = await run("ar", ""), d = await run("ar", "fr");
  t("لغة الموقع فرنسية ولم يختر المستخدم: اللوحة بالفرنسية LTR ولا يُحفظ شيء", a.lang === "fr" && a.dir === "ltr" && a.stored === null, a);
  t("اختار المستخدم العربية صراحةً: تبقى العربية رغم لغة الموقع الفرنسية", b2.lang === "ar" && b2.dir === "rtl" && b2.stored === "ar", b2);
  t("لغة الموقع عربية: اللوحة بالعربية", c.lang === "ar" && c.dir === "rtl", c);
  t("اختار المستخدم الفرنسية: تبقى الفرنسية رغم لغة الموقع العربية", d.lang === "fr" && d.dir === "ltr", d);
  t("بلا أخطاء JS", [a, b2, c, d].every(x => x.errs.length === 0), [a.errs, b2.errs, c.errs, d.errs]);
  await b.close(); process.exit(bad ? 1 : 0);
})();
