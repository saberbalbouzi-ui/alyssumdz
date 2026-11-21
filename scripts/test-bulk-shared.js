/* تعديل جماعي للإعدادات المشتركة للمنتجات (توصيل/شحن مجاني/ملاحظة طبية). NODE_PATH=/opt/node-tools/node_modules node scripts/test-bulk-shared.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, B = AdminBulkProducts, out = {}; window.toast = m => { (out.toasts = out.toasts || []).push(String(m)); };
    document.getElementById("app").classList.remove("hidden"); document.getElementById("tab-bulkp").classList.remove("hidden");
    A.products = [{ slug: "a1", title: "أ", price: 1000, cat: "x", stock: 5, shipCo: "yalidine" }, { slug: "a2", title: "ب", price: 2000, cat: "x", stock: 5 }, { slug: "a3", title: "ج", price: 3000, cat: "x", stock: 5, shipCo: "zones", medNoteOff: true }];
    A.renderAll && A.renderAll(); B.render(); await new Promise(r => setTimeout(r, 300));
    out.hasUi = !!document.getElementById("bp-sop") && [...document.getElementById("bp-sop").options].some(o => o.value === "ship-zones") && [...document.getElementById("bp-sop").options].some(o => o.value === "freeship-on");
    const pick = slugs => { ["a1", "a2", "a3"].forEach(sl => { const c = document.querySelector('#bulk-products-app [data-pick="' + sl + '"]'), want = slugs.includes(sl); if (c && c.checked !== want) { c.checked = want; c.dispatchEvent(new Event("change", { bubbles: true })); } }); };
    const run = async (op, vals) => { const sel = document.getElementById("bp-sop"); sel.value = op; sel.dispatchEvent(new Event("change", { bubbles: true })); Object.entries(vals || {}).forEach(([id, v]) => { document.getElementById(id).value = v; }); document.querySelector('[data-act="preview-shared"]').click(); await new Promise(r => setTimeout(r, 120)); const modal = document.querySelector("[data-preview]"); const txt = modal ? modal.textContent : ""; if (modal) document.querySelector('[data-act="confirm-preview"]').click(); await new Promise(r => setTimeout(r, 120)); return txt; };
    pick(["a1", "a2"]); const t1 = await run("ship-zones"); out.zonesPreview = /المناطق/.test(t1) && /يافا|أ|ب/.test(t1); out.ch1 = JSON.stringify([...B.changes.entries()]);
    pick(["a2", "a3"]); const t2 = await run("freeship-on"); out.ch2 = JSON.stringify([...B.changes.entries()]);
    pick(["a1"]); await run("adj-custom", { "bp-sh-adj": "300" }); pick(["a2"]); await run("ship-free", { "bp-sh-home": "500", "bp-sh-stop": "300" });
    pick(["a3"]); await run("mednote-on"); pick(["a3"]); const before = B.changes.size; out.toastCount0 = (out.toasts || []).length; await run("ship-zones"); out.noop = (out.toasts || []).slice(out.toastCount0).some(x => /لا تغيير/.test(x));
    A.publishDataJs = async () => true; await B.save();
    const g = s => A.products.find(p => p.slug === s); out.final = ["a1", "a2", "a3"].map(s => { const p = g(s); return s + ":" + JSON.stringify({ shipCo: p.shipCo, h: p.shipFreeHome, st: p.shipFreeStop, adj: p.shipAdj, fs: p.freeShip, mn: p.medNoteOff, price: p.price }); });
    // توجيه الطلب: منتج shipCo=zones لا يُرسل إلى شركة بل يتبع الافتراضية
    A.deliveryCfg = { wecan: { enabled: true, isDefault: true }, yalidine: { enabled: true } }; A.enabledCompanyKeys = () => ["wecan", "yalidine"]; A.products = [{ slug: "pz", title: "ز", price: 100, shipCo: "zones" }, { slug: "py", title: "ي", price: 100, shipCo: "yalidine" }];
    const ord = s => ({ id: "X" + s, note: "", items: (s === "pz" ? "ز" : "ي") + " ×1 = 100 DA", extra: {}, status: "confirmee" });
    out.route = [A.orderCompanyKey(ord("pz")), A.orderCompanyKey(ord("py"))];
    return out;
  });
  t("الواجهة: قائمة الإعدادات المشتركة فيها المناطق والشحن المجاني", R.hasUi, R);
  t("معاينة قبل/بعد تُظهر عمود الإعدادات المشتركة وتُطبَّق على المحدد فقط (a1 وa2 ← مناطق، a3 لا يتغيّر)", R.zonesPreview && /"a1"/.test(R.ch1) && /"a2"/.test(R.ch1) && !/"a3"/.test(R.ch1), R.ch1);
  const f = R.final || [];
  t("الحفظ: a1 مناطق + منقوص 300 + شحن مجاني (لا: a1 لم يُحدَّد للشحن) — a1 يحمل منقوص 300", /a1:.*"shipCo":"zones".*"adj":300/.test(f[0]) && !/"fs":true/.test(f[0]), f[0]);
  t("a2: سعر حر 500/300 وشحن مجاني (من التحديد الثاني)", /a2:.*"shipCo":"free".*"h":500.*"st":300.*"fs":true/.test(f[1]), f[1]);
  t("a3: يبقى مناطق، شحن مجاني، والملاحظة الطبية أُعيدت (حُذف medNoteOff)، والأسعار لم تُمسّ", /a3:.*"shipCo":"zones".*"fs":true/.test(f[2]) && !/"mn":true/.test(f[2]) && /"price":3000/.test(f[2]), f[2]);
  t("تطبيق إعداد هو نفسه قائم أصلاً ⟵ «لا تغيير» بلا معاينة", R.noop, R);
  t("توجيه الطلب: منتج أسعار المناطق يتبع الشركة الافتراضية (wecan)، ومنتج ياليدين يذهب إلى ياليدين", R.route[0] === "wecan" && R.route[1] === "yalidine", R.route);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
