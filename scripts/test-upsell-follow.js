/* اختبار: ربح كل قاعدة عرض + مجموعات الدمج للرئيسية + ماسح التجهيز.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-upsell-follow.js */
const path = require("path"), { chromium } = require("playwright"); const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
(async () => {
  const br = await chromium.launch(), page = await br.newPage(), errs = []; page.on("pageerror", e => errs.push(String(e)));
  await page.setContent('<div id="tab-upsell"></div><div id="tab-pack"></div>');
  await page.evaluate(() => {
    const now = Date.now(), day = 864e5; window.toast = m => (window.__toast = m); window.GH = undefined; window.__marked = [];
    const P = [{ slug: "anti", title: "كريمة", price: 2400, active: true }, { slug: "bag", title: "حقيبة", price: 500, active: true }, { slug: "nocost", title: "بلا تكلفة", price: 900, active: true }];
    const mk = (id, st, items, extra, d) => ({ id, date: new Date(now - (d || 1) * day).toISOString(), status: st, name: "ن" + id, total: 0, items, extra });
    const O = [
      mk("A1", "nouvelle", "كريمة ×1 = 2400 DA\nحقيبة ×1 = 400 DA", { "➕ إضافة سريعة": "ح", "🆔 قاعدة العرض": "r1" }),
      mk("A2", "confirmee", "حقيبة ×2 = 800 DA", { "➕ إضافة سريعة": "ح", "🆔 قاعدة العرض": "r1" }),
      mk("A3", "annulee", "حقيبة ×1 = 400 DA", { "🆔 قاعدة العرض": "r1" }),
      mk("A4", "nouvelle", "حقيبة ×1 = 400 DA", { "🆔 قاعدة العرض": "r1" }, 90),
      mk("G1", "nouvelle", "كريمة ×1 = 2400 DA", { "🧺 مجموعة": "G" }), mk("G2", "nouvelle", "حقيبة ×1 = 450 DA", { "🧺 مجموعة": "G", "🔼 عرض بعد الشراء": "x", "🆔 قاعدة العرض": "r2" }),
      mk("H1", "confirmee", "كريمة ×1 = 2400 DA", { "🧺 مجموعة": "H" }), mk("H2", "nouvelle", "حقيبة ×1 = 450 DA", { "🧺 مجموعة": "H", "🔼 عرض بعد الشراء": "x" }),
      mk("N1", "nouvelle", "بلا تكلفة ×1 = 900 DA", { "🆔 قاعدة العرض": "r3" })];
    const lines = o => o.items.split("\n").map(l => { const m = l.match(/^(.+?)\s*×\s*(\d+)\s*=\s*(\d+)/); const p = P.find(x => x.title === m[1].trim()); return p ? { p, qty: +m[2], total: +m[3] } : null; }).filter(Boolean);
    window.Admin = { key: "k", orders: O, products: P, fin: { costs: { anti: 1000, bag: 150 } }, orderLines: lines, itemsDisplay: o => o.items, trackingOf: () => null, categories: {} };
    const rows = [{ id: "M1", name: "س", tracking: "YAL-AB12", items: "كريمة ×1", status: "confirmee", packed: false }, { id: "M2", name: "ك", tracking: "", items: "حقيبة ×2", status: "confirmee", packed: true }];
    window.PHPAPI = { on: () => true, call: async (n, o) => { if (n === "pack_orders") return { ok: true, j: rows.map(r => Object.assign({}, r)) }; const b = JSON.parse(o.body); window.__marked.push(b); return { ok: true, j: { ok: true } }; } };
  });
  await page.addScriptTag({ path: path.join(root, "assets/js/admin-upsell.js") });
  await page.addScriptTag({ path: path.join(root, "assets/js/admin-pack.js") });
  const R = await page.evaluate(() => {
    const U = AdminUpsell, rules = [{ id: "r1", offer: "bag", type: "bump" }, { id: "r2", offer: "bag", type: "post" }, { id: "r3", offer: "nocost", type: "bump" }];
    const st = U.ruleStats(Admin.orders, rules, Date.now()), m = U.mergeable(Admin.orders);
    return { st, mg: m.map(g => ({ k: g.keep.id, gid: g.gid })) };
  });
  const s1 = R.st[0], s2 = R.st[1], s3 = R.st[2];
  ok("ربح البمب: طلبان (المُلغى والقديم خارج) وقطعتان + 2×… ", s1.orders === 2 && s1.units === 3 && s1.rev === 1200 && s1.cost === 450 && s1.profit === 750, s1);
  ok("ربح الـpost: سطر المنتج المعروض فقط", s2.orders === 1 && s2.rev === 450 && s2.profit === 300, s2);
  ok("بلا سعر شراء ← الربح غير محسوب", s3.orders === 1 && s3.profit === null && s3.rev === 900, s3);
  ok("مجموعات قابلة للدمج: الجديدان فقط (المؤكَّد مستبعد)", R.mg.length === 1 && R.mg[0].gid === "G" && R.mg[0].k === "G1", R.mg);
  await page.evaluate(() => AdminPack.init("tab-pack")); await page.waitForSelector("#pk-scan");
  const P = await page.evaluate(() => ({ n: AdminPack.normScan(" https://x.dz/t?c=yal-ab12 "), f1: (AdminPack.findRow([{ id: "M1", tracking: "YAL-AB12" }], "yal-ab12") || {}).id, f2: (AdminPack.findRow([{ id: "M1", tracking: "" }], "m1") || {}).id, f3: AdminPack.findRow([{ id: "M1", tracking: "z" }], "nope") }));
  ok("تطبيع الرابط والمقارنة بلا حساسية للحالة", P.n === "YAL-AB12" && P.f1 === "M1" && P.f2 === "M1" && P.f3 === null, P);
  await page.fill("#pk-scan", "yal-ab12"); await page.press("#pk-scan", "Enter"); await page.waitForTimeout(150);
  ok("المسح يجهّز الطلب ويستدعي pack_mark", (await page.evaluate(() => window.__marked)).some(b => b.id === "M1" && b.undo === false));
  ok("رسالة النجاح", /جُهِّز/.test(await page.innerText("#pk-scan-msg")));
  await page.fill("#pk-scan", "M1"); await page.press("#pk-scan", "Enter"); await page.waitForTimeout(100);
  ok("المسح الثاني: سبق تجهيزه ولا نداء جديد", /سبق/.test(await page.innerText("#pk-scan-msg")) && (await page.evaluate(() => window.__marked)).length === 1);
  await page.fill("#pk-scan", "ZZZ999"); await page.press("#pk-scan", "Enter"); await page.waitForTimeout(100);
  ok("رقم مجهول يُبلَّغ عنه", /غير موجود/.test(await page.innerText("#pk-scan-msg")));
  ok("بلا أخطاء صفحة", errs.length === 0, errs);
  await br.close(); console.log(fails ? "فشل " + fails : "كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
