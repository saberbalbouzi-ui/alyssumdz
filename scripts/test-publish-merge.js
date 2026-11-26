/* نشر المنتجات من جلسة قديمة لا يُرجع تعديلات جلسة أخرى (الصفحة الرسمية/المسار)، وما غيّرتَه أنت يبقى. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  const r = await p.evaluate(async () => {
    const enc = o => btoa(unescape(encodeURIComponent("/* x */\nvar CATEGORIES = [];\nvar PRODUCTS = " + JSON.stringify(o) + ";\n")));
    const base = [{ slug: "a", title: "A", price: 100, officialPage: "old" }, { slug: "b", title: "B", price: 5 }, { slug: "gone", title: "G" }];
    // الجلسة القديمة: غيّرت سعر a فقط وأضافت c
    const ours = JSON.parse(JSON.stringify(base)); ours[0].price = 120; ours.push({ slug: "c", title: "C" });
    // النسخة المنشورة الحالية (جلسة أخرى): غيّرت officialPage/route لـa، وسعر b، وحذفت gone، وأضافت d
    const live = [{ slug: "a", title: "A", price: 100, officialPage: "new", route: "new" }, { slug: "b", title: "B", price: 9 }, { slug: "d", title: "D" }];
    Admin.products = ours; Admin._pBase = JSON.parse(JSON.stringify(base)); let put = null;
    GH.cfg = () => ({ token: "x", owner: "o", repo: "r", branch: "main" }); GH.getFile = async () => ({ sha: "s", content: enc(live) }); GH.putFile = async (path, b64) => { put = decodeURIComponent(escape(atob(b64))); return {}; }; Admin.ensureProductPages = async () => { };
    const ok = await Admin.publishDataJs(); const P = JSON.parse(put.match(/var PRODUCTS = (\[[\s\S]*\]);\s*$/)[1]), by = Object.fromEntries(P.map(x => [x.slug, x]));
    return { ok, slugs: P.map(x => x.slug), a: by.a, b: by.b, baseAfter: Admin._pBase.map(x => x.slug) };
  });
  t("ما غيّرتُه أنا (سعر a) يبقى", r.a && r.a.price === 120, r.a);
  t("ما غيّرته جلسة أخرى (الصفحة الرسمية والمسار) لا يُرجَع للقديم", r.a && r.a.officialPage === "new" && r.a.route === "new", r.a);
  t("تعديل منتج آخر في جلسة أخرى (سعر b) يُحفظ", r.b && r.b.price === 9, r.b);
  t("المحذوف في جلسة أخرى يُحذف، والمُضاف هناك (d) وهنا (c) يبقيان", !r.slugs.includes("gone") && r.slugs.includes("c") && r.slugs.includes("d"), r.slugs);
  t("أساس الدمج يُحدَّث بعد النشر", r.ok === true && r.baseAfter.join() === r.slugs.join(), r);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
