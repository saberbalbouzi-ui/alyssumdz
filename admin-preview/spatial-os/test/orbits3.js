/* ثلاثة مدارات + فتح آني: (1) العلوي تبويبات رئيسية فقط (مفاتيح GROUPS)، (2) تحته إعدادات المرتبة الأولى للتبويب المحدَّد، (3) تحتها إعدادات المرتبة الثالثة (أقسام داخل لوح الإعداد من لوحة التحكم الحقيقية) والنقر ينزل إليها؛
   (4) ألواح احتياطية مسخَّنة مسبقاً على تبويبي الطلبات والمنتجات فيُفتح لوحاهما آنياً بمحتوى مرسوم ثم تُعاد تعبئتها. التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/orbits3.js */
const PW = require("playwright"), { startStore } = require("./harness");
const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 320) : "")); console.log(R[R.length - 1]); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await PW.chromium.launch(); const store = await startStore();
  try {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage(), errs = []; p.setDefaultTimeout(30000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await p.goto(store.base + "/admin.html"); await wait(800); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
    await p.goto(store.base + "/admin-preview/spatial-os/index.html?real=1&nozoom=1"); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && SpatialOS.spare.ready, null, { timeout: 90000 }); await wait(1500);
    const keys = await p.evaluate(() => Object.keys(GROUPS));
    const top = await p.evaluate(() => [...document.querySelectorAll("#orbit .node:not(.sub)")].map(n => n.dataset.id));
    const names = await p.evaluate(() => [...document.querySelectorAll("#orbit .node:not(.sub)")].map(n => n.innerText.trim()));
    ok("المدار العلوي = مجموعات قائمة لوحة التحكم الست بأسمائها (الرئيسية، المنتجات، المتجر، المظهر، إضافات، الإعدادات العامة) لا غير", top.length === 6 && top.every(id => keys.includes(id)) && JSON.stringify(names.slice().sort()) === JSON.stringify(["الرئيسية", "المنتجات", "المتجر", "المظهر", "إضافات", "الإعدادات العامة"].sort()), { top, names });
    await p.evaluate(() => document.querySelector('#orbit .node[data-id="store"]:not(.sub)').click()); await wait(700);
    const subs = await p.evaluate(() => [...document.querySelectorAll("#orbit .node.sub:not(.sub3)")].filter(n => !n.classList.contains("out")).map(n => n.dataset.id)), want = await p.evaluate(() => GROUPS.store.map(e => e.split("|")[0]).filter(id => SEC.some(s => s.id === id)));
    ok("المدار الثاني: إعدادات المرتبة الأولى للتبويب «المتجر» (من GROUPS)", subs.length === want.length && want.every(id => subs.includes(id)), { subs, want });
    ok("لا مدار ثالث قبل اختيار إعداد", (await p.evaluate(() => document.querySelectorAll("#orbit .node.sub3").length)) === 0);
    /* المدار الثالث */
    await p.evaluate(() => document.querySelector('#orbit .node.sub[data-id="delivery"]').click());
    await p.waitForFunction(() => document.querySelectorAll("#orbit .node.sub3:not(.out)").length >= 1, null, { timeout: 40000 });
    const l3 = await p.evaluate(() => [...document.querySelectorAll("#orbit .node.sub3:not(.out)")].map(n => n.innerText.trim()));
    ok("المدار الثالث يظهر أسفل الثاني بأقسام لوح التوصيل الحقيقية (عناوين غير فارغة بلا تكرار)", l3.length >= 1 && l3.every(t => t.length >= 2) && new Set(l3).size === l3.length, l3);
    const y2 = await p.evaluate(() => { const a = document.querySelector("#orbit .node.sub:not(.sub3)").getBoundingClientRect(), c = document.querySelector("#orbit .node.sub3").getBoundingClientRect(); return [Math.round(a.top), Math.round(c.top)]; });
    ok("المدار الثالث تحت الثاني (أدنى على الشاشة)", y2[1] > y2[0], y2);
    ok("حفظ العناوين للفتح التالي (sc_l3_v1)", await p.evaluate(() => !!(JSON.parse(localStorage.getItem("sc_l3_v1") || "{}").delivery || []).length));
    /* النقر ينزل إلى القسم */
    const pick = l3[l3.length - 1]; await p.evaluate(t => { [...document.querySelectorAll("#orbit .node.sub3")].find(n => n.innerText.trim() === t).click(); }, pick);
    const hl = await p.waitForFunction(() => { const q = SpatialOS.panels.get("delivery"); if (!q || !q.fr) return false; try { return [...q.fr.contentDocument.querySelectorAll("#tab-delivery *")].some(e => /solid 2px/.test(e.style.outline)); } catch (_) { return false; } }, null, { timeout: 15000 }).then(() => true).catch(() => false);
    ok("النقر على قسم ثالث يفتح لوح الإعداد وينزل إلى بطاقة القسم ويبرزه (إطار تمييز)", hl && (await p.evaluate(() => !!SpatialOS.panels.get("delivery"))), hl);
    /* الفتح الآني */
    await p.evaluate(() => { [...SpatialOS.panels.keys()].forEach(k => SpatialOS.panels.get(k).el.querySelector(".pn-x").click()); }); await wait(800);
    await p.waitForFunction(() => SpatialOS.spare.extra.filter(e => e.ready).length === 2 && SpatialOS.spare.ready, null, { timeout: 150000 });
    ok("ألواح احتياطية مسخَّنة مسبقاً على الطلبات والمنتجات (2) إضافة إلى الرئيسية", await p.evaluate(() => { const e = SpatialOS.spare.extra; return e.some(x => x.tab === "orders" && x.ready) && e.some(x => x.tab === "products" && x.ready); }));
    const t0 = Date.now(); await p.evaluate(() => SpatialOS.open("ord")); await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 20000 }); const ms = Date.now() - t0;
    const st = await p.evaluate(() => { const q = SpatialOS.panels.get("ord"), d = q.fr.contentDocument, t = d.getElementById("tab-orders"); return { adopted: q.wasAdopted, shown: !!t && !t.classList.contains("hidden"), h: d.documentElement.scrollHeight }; });
    ok("فتح لوح الطلبات آنياً (< 900ms) عبر لوح مُسخَّن مسبقاً على تبويب الطلبات وبمحتوى مرسوم", ms < 900 && st.adopted && st.shown && st.h > 600, { ms, st });
    await p.waitForFunction(() => SpatialOS.spare.extra.filter(e => e.ready).length === 2, null, { timeout: 150000 }); ok("إعادة التعبئة: يعود لوحا الطلبات والمنتجات جاهزين بعد التبنّي", true);
    const t1 = Date.now(); await p.evaluate(() => SpatialOS.open("prod")); await p.waitForFunction(() => { const q = SpatialOS.panels.get("prod"); return q && q.frDone; }, null, { timeout: 20000 }); const ms2 = Date.now() - t1;
    ok("فتح لوح المنتجات آنياً أيضاً (< 900ms)", ms2 < 900 && (await p.evaluate(() => SpatialOS.panels.get("prod").wasAdopted)), ms2);
    /* المدار الثاني يتبع قائمة اللوحة الحقيقية: إخفاء عنصر (كما تفعل النسخة/الصلاحيات) يزيله من المدار، وإظهاره يعيده */
    await p.evaluate(() => document.querySelector('#orbit .node[data-id="store"]:not(.sub)').click()); await wait(600);
    const hideNav = async (on) => p.evaluate((on) => { /* كل الإطارات (الاحتياطي وألواح مفتوحة) تُخفي العنصر معاً كما تفعل النسخة/الصلاحيات؛ وإلا أعاد إطار آخر القائمة الكاملة */ const docs = []; if (SpatialOS.spare.frame && SpatialOS.spare.frame.contentDocument) docs.push(SpatialOS.spare.frame.contentDocument); SpatialOS.panels.forEach(q => { try { if (q.fr && q.fr.contentDocument) docs.push(q.fr.contentDocument); } catch (_) { } }); docs.forEach(d => { const b = [...d.querySelectorAll('.side-nav .nav-btn')].find(x => /Admin\.tab\('coupons'/.test(x.getAttribute('onclick') || '')); if (b) b.classList.toggle('rl-hid', on); }); SpatialOS.navSync(docs[0]); return new Promise(r => setTimeout(() => r(SpatialOS.subIds().includes('coupons')), 500)); }, on);
    const hv = await hideNav(true), sv = await hideNav(false); ok("عنصر مخفي في قائمة اللوحة (rl-hid) يختفي من المدار الثاني ويعود عند إظهاره", hv === false && sv === true, { hv, sv, tab: await p.evaluate(() => SpatialOS.tab), subs: await p.evaluate(() => SpatialOS.subIds().slice(0, 8)) });
    ok("لا أخطاء صفحة", errs.length === 0, errs);
  } catch (e) { fails++; console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 700)); }
  finally { try { await b.close(); } catch { } try { store.stop(); } catch { } }
  console.log(fails ? "\nFAILED: " + fails : "\nALL PASS (" + R.filter(x => x.startsWith("PASS")).length + ")"); process.exit(fails ? 1 : 0);
})();
