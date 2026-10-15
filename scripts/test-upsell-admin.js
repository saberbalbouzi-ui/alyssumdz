/* اختبار جانب اللوحة للعروض الإضافية: الإحصاء، تجميع الطلبات المرتبطة، شروط الدمج، دمج فعلي (بنود/إجمالي/نقل الطلب المرتبط للسلة)، وواجهة القواعد.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-upsell-admin.js */
const path = require("path"), { chromium } = require("playwright"); const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
(async () => {
  const br = await chromium.launch(), page = await br.newPage(), errs = []; page.on("pageerror", e => errs.push(String(e)));
  await page.setContent('<div id="tab-upsell"></div><div id="ord-prev-bg" class="open"></div>');
  await page.evaluate(() => {
    const now = Date.now(), day = 864e5, calls = { fields: [], note: [], del: [] };
    window.__calls = calls; window.toast = m => (window.__toast = m); window.confirm = () => true;
    window.API = { updateOrderFields: async (k, id, f) => { calls.fields.push([id, f]); return true; }, updateOrder: (k, id, st, note) => calls.note.push([id, note]) };
    window.GH = undefined;
    window.OrderEdit = { stash() { }, unstash() { } };
    const O = [
      { id: "A1", date: new Date(now - day).toISOString(), status: "nouvelle", name: "سارة", subtotal: 2400, fee: 600, discount: 0, total: 3000, items: "كريمة ×1 = 2400 DA", extra: { "🧺 مجموعة": "G1", "➕ إضافة سريعة": "x" } },
      { id: "A2", date: new Date(now - day).toISOString(), status: "nouvelle", name: "سارة", subtotal: 1200, fee: 0, discount: 0, total: 1200, items: "مضاد ×1 = 1200 DA", extra: { "🧺 مجموعة": "G1", "🔼 عرض بعد الشراء": "عرض" } },
      { id: "B1", date: new Date(now - 2 * day).toISOString(), status: "confirmee", name: "كريم", subtotal: 1000, fee: 400, total: 1400, items: "س ×1 = 1000 DA", extra: { "🧺 مجموعة": "G2" } },
      { id: "B2", date: new Date(now - 2 * day).toISOString(), status: "nouvelle", name: "كريم", subtotal: 500, fee: 0, total: 500, items: "ص ×1 = 500 DA", extra: { "🧺 مجموعة": "G2", "🔼 عرض بعد الشراء": "عرض" } },
      { id: "C1", date: new Date(now - 90 * day).toISOString(), status: "livree", name: "قديم", total: 900, subtotal: 900, fee: 0, items: "ق ×1 = 900 DA", extra: { "➕ إضافة سريعة": "x" } },
      { id: "D1", date: new Date(now - day).toISOString(), status: "nouvelle", name: "بسيط", total: 2000, subtotal: 2000, fee: 0, items: "ب ×1 = 2000 DA", extra: "{}" },
    ];
    window.Admin = { key: "k", orders: O, products: [{ slug: "anti", title: "كريمة", price: 2400, active: true }, { slug: "chute", title: "مضاد", price: 1200, active: true }, { slug: "var", title: "متغيّر", type: "variable", price: 5 }],
      categories: { skin: "بشرة" }, itemsDisplay: o => o.items, trackingOf: o => (o.id === "T1" ? { tracking: "x" } : null), deleteOrders: async (l) => { calls.del.push(l.map(x => x.id)); l.forEach(x => O.splice(O.indexOf(x), 1)); }, renderAll() { }, tab(t) { return t; } };
  });
  await page.addScriptTag({ path: path.join(root, "assets/js/admin-manualorder.js") });
  await page.addScriptTag({ path: path.join(root, "assets/js/admin-upsell.js") });
  const R = await page.evaluate(async () => {
    const out = {}, U = AdminUpsell, A = Admin;
    out.stats = U.stats(A.orders, Date.now());
    out.gA = (() => { const g = U.group(A.orders[1], A.orders); return g && { keep: g.keep.id, drops: g.drops.map(d => d.id), total: g.total }; })();
    out.gSame = (() => { const g = U.group(A.orders[0], A.orders); return g && g.keep.id; })();
    out.noGroup = U.group(A.orders[5], A.orders);
    out.blockedConf = U.blocked(U.group(A.orders[3], A.orders));
    out.blockedOk = U.blocked(U.group(A.orders[1], A.orders));
    out.row = U.previewRow(A.orders[0]); out.rowBlocked = U.previewRow(A.orders[2]); out.cc = U.ccLine(A.orders[1]);
    out.merged = await U.merge(A.orders[1]);
    out.keep = A.orders.find(o => o.id === "A1"); out.left = A.orders.map(o => o.id); out.calls = window.__calls;
    out.refuse = await U.merge(A.orders.find(o => o.id === "B2"));
    return out;
  });
  ok("الإحصاء يتجاهل الأقدم من 30 يوماً ويعدّ الأصلية فقط", R.stats.bump === 1 && R.stats.post === 2 && R.stats.orders === 3 && R.stats.postRev === 1700, R.stats);
  ok("تجميع المجموعة: الأصلي هو الذي بلا «بعد الشراء»", R.gA && R.gA.keep === "A1" && R.gA.drops[0] === "A2" && R.gA.total === 1200, R.gA);
  ok("نفس المجموعة من أي طرف", R.gSame === "A1");
  ok("بلا مجموعة ← لا ربط", R.noGroup === null);
  ok("الدمج مرفوض إن كان الأصلي مؤكَّداً", /جديدان/.test(R.blockedConf), R.blockedConf);
  ok("الدمج متاح للجديدين", R.blockedOk === "");
  ok("معاينة الطلب: صف الدمج وزرّه، ومع المنع تُشرح العلّة", /دمجهما/.test(R.row) && /مرتبط/.test(R.row) && !/button/.test(R.rowBlocked) && /جديدان/.test(R.rowBlocked));
  ok("مركز الاتصال: سطر الدمج بزر data-d=merge", /data-d="merge"/.test(R.cc));
  ok("الدمج نجح", R.merged === true);
  const f = R.calls.fields[0];
  ok("الحقول المحفوظة: بندان، المجموع 3600، التوصيل يبقى، الإجمالي 4200", f && f[0] === "A1" && f[1].items.length === 2 && f[1].subtotal === 3600 && f[1].fee === 600 && f[1].total === 4200 && /×1 = 1200/.test(f[1].items_text), f);
  ok("slug مضاف من اسم المنتج", f[1].items.map(i => i.slug).join() === "anti,chute", f[1].items);
  ok("الطلب المرتبط انتقل إلى السلة وبقي الأصلي", R.calls.del[0][0] === "A2" && !R.left.includes("A2") && R.left.includes("A1"));
  ok("ملاحظة الدمج على الأصلي", /🧺دُمج:A2/.test(R.keep.note || ""), R.keep.note);
  ok("الطلب المحلي يعكس الدمج فوراً", R.keep.total === 4200);
  ok("الدمج يُرفض إن كان الأصلي مؤكَّداً ولا يغيّر شيئاً", R.refuse === false && R.calls.fields.length === 1);
  /* واجهة القواعد */
  await page.evaluate(() => { Admin.tab("upsell"); AdminUpsell.init("tab-upsell"); }); await page.waitForSelector("#upsell-add-b");
  ok("بطاقات الإحصاء تظهر", /طلبات بإضافة سريعة/.test(await page.innerText("#tab-upsell")));
  await page.click("#upsell-add-b"); await page.click("#upsell-add-p");
  ok("قاعدتان جديدتان", (await page.$$("#upsell-rules [data-i]")).length === 2);
  ok("قائمة المنتجات تستبعد المتغيّر", !(await page.innerText('#upsell-rules [data-i="0"] select[data-k=offer]')).includes("متغيّر"));
  await page.selectOption('#upsell-rules [data-i="0"] select[data-k=offer]', "chute"); await page.fill('#upsell-rules [data-i="0"] input[data-k=value]', "50"); await page.dispatchEvent('#upsell-rules [data-i="0"] input[data-k=value]', "change");
  ok("معاينة السعر الخاص", /600/.test(await page.innerText('#upsell-rules [data-i="0"]')));
  await page.click('#upsell-rules [data-i="1"] [data-act=up]');
  ok("ترتيب القواعد (↑)", await page.getAttribute('#upsell-rules [data-i="1"] select[data-k=offer]', "data-k") === "offer" && (await page.evaluate(() => AdminUpsell._rules()[0].type)) === "post");
  await page.click("#upsell-save"); await page.waitForTimeout(100);
  ok("الحفظ بلا اختيار منتج يُرفض برسالة", /اختر المنتج/.test(await page.evaluate(() => window.__toast)));
  ok("لا أخطاء جافاسكربت", errs.length === 0, errs);
  await br.close(); console.log(fails ? "\n" + fails + " إخفاق" : "\n✓ كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
