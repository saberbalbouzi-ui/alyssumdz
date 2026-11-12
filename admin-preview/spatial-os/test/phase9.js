/* المرحلة 9 — المزامنة الحيّة بين الألواح الفضائية (Spatial OS Event Hub).
   كل اختبار يتحقق من نتائج الـAPI الفعلية ومن «الحقيقة»: بصمة تُستخرج من لوحة حقيقية تُحمَّل حديثاً (صفحة admin.html مستقلة) وتُقارَن ببصمة كل لوح فضائي؛
   لا يُكتفى بأن مستمعاً نُفِّذ. المتجر محلي معزول (نسخة PHP حقيقية) والطلبات والمنتجات أُنشئت عبر المسارات الحقيقية.
   «real-ui» تفاعل حقيقي داخل لوحة الأعمال · «api» قراءة من الخادم · «hub» حالة المركز · «mouse» فأرة حقيقية.
   التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/phase9.js [tests|perf|all] */
const { chromium } = require("playwright"); const { startStore, ORDERS } = require("./harness"); const fs = require("fs"), path = require("path"); const only = process.argv[2] || "all";
const R = []; let fails = 0; const ok = (n, c, m, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + "[" + m + "] " + n + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 220) : "")); };
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
async function section(name, fn) { if (ONLY && !ONLY.some(p => name.startsWith(p))) return; R.push("── " + name); try { await fn(); } catch (e) { fails++; R.push("FAIL [crash] " + name + ": " + String(e).split("\n").filter(l => l.trim()).slice(0, process.env.ONLY ? 30 : 9).join(" | ").slice(0, process.env.ONLY ? 3000 : 900)); } }
const NAME = { ord: "الطلبات", prod: "المنتجات", ana: "التحليلات", inv: "المخزون", ai: "مساعد ALYSSUM" }, TABS = { ord: "orders", inv: "inventory", prod: "products", ana: "analytics" };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* بصمات تُستخرج داخل أي نافذة لوحة (لوح فضائي أو صفحة مستقلة) — نفس الدوال للطرفين */
const EX = {
  ord: () => ({ o: Admin.orders.map(o => o.id + ":" + o.status).sort(), n: (document.getElementById("orders-count-label") || {}).textContent }),
  inv: () => { const m = {}; document.querySelectorAll("#tab-inventory input[data-stock]").forEach(i => { const tr = i.closest("tr"); m[i.dataset.stock] = { stock: i.value, reserved: tr.lastElementChild.textContent.trim(), title: (tr.children[2].firstChild.textContent || "").trim(), pill: ((tr.querySelector(".pill") || {}).textContent || "").trim() }; }); return m; },
  prod: () => { const m = {}; document.querySelectorAll("#tab-products td[data-l='المخزون']").forEach(td => { const tr = td.closest("tr"), sm = tr.querySelector("small[dir=ltr]"); if (sm) m[sm.textContent.trim()] = { stock: (td.textContent || "").trim(), title: ((tr.querySelector("td.t b") || {}).textContent || "").trim(), price: ((tr.querySelector("td[data-l='السعر'] b") || {}).textContent || "").trim() }; }); return m; },
  ana: () => { const t = (document.getElementById("tab-analytics").innerText || "").replace(/\s+/g, " "); const g = re => { const m = re.exec(t); return m ? m.slice(1).join("|") : null; }; return { states: g(/جديدة (\d+) · مؤكَّدة (\d+)/), rate: g(/([\d.]+)% نسبة تأكيد الطلبات/), sum: g(/الخلاصة العامة (\d+) (\d+) (\d+) (\d+)/), un: g(/غير مرسلة لشركة (\d+)/) }; },
};
const json = (v) => JSON.stringify(v);

async function boot(b, store, o = {}) {
  const c = await b.newContext({ viewport: o.vp || { width: 1440, height: 900 } }), p = await c.newPage(), errs = [], reqs = [];
  p.setDefaultTimeout(12000); p.on("pageerror", e => errs.push(String(e.stack || e).split("\n").slice(0, 2).join(" <- ").slice(0, 220))); p.on("dialog", d => d.accept().catch(() => { }));
  p.on("request", r => { if (/\/api\/index\.php|\/admin(\.html)?(\?|$)/.test(r.url()) && r.frame() !== p.mainFrame()) reqs.push({ t: Date.now(), m: r.method(), u: r.url() }); });
  /* الإشعارات العائمة في لوحة الأعمال تعترض نقر الأزرار تحتها أثناء الأتمتة؛ نجعلها لا تلتقط المؤشر في الاختبار فقط */
  await p.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { if (window !== window.top) { const s = document.createElement("style"); s.textContent = "#toast,#toast2,.toast{pointer-events:none!important}"; document.head.appendChild(s); } }); });
  await p.addInitScript(() => { try { const top = window.top; top.__spy = top.__spy || []; addEventListener("message", e => { try { top.__spy.push({ where: window === top ? "parent" : "frame", origin: e.origin, d: JSON.stringify(e.data).slice(0, 1500) }); } catch (_) { } }, true); } catch (_) { } });
  const url = (o.host ? store.spatial.replace("127.0.0.1", o.host) : store.spatial);
  await p.goto(url); await p.waitForTimeout(800);
  await p.evaluate(async pw => (await fetch("../../api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: pw }) })).status, store.pw);
  await p.reload(); await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 90000 });
  for (const id of (o.panels || [])) { await p.evaluate(i => SpatialOS.open(i), id); await p.waitForFunction(i => SpatialOS.panels.get(i) && SpatialOS.panels.get(i).frDone, id, { timeout: 90000 }); }
  if (o.tile !== false && (o.panels || []).length) { await p.evaluate(() => { SpatialOS.panels.forEach(q => { if (q.frame) { q.st.w = 560; q.st.h = 440; } }); SpatialOS.tileAll(); }); await p.waitForTimeout(1200); }
  const base = url.replace(/\/admin-preview.*/, "");
  const X = {
    c, p, errs, reqs, base,
    hub: () => p.evaluate(() => ({ st: SpatialHub.stats(), ver: SpatialHub.versions(), tenant: SpatialHub.tenant() })),
    trace: () => p.evaluate(() => SpatialHub.trace()),
    state: id => p.evaluate(i => SpatialHub.state(i), id),
    reset: () => p.evaluate(() => SpatialHub._reset()),
    fev: (id, fn, arg) => p.evaluate(([i, f, a]) => { const q = SpatialOS.panels.get(i), w = q.fr.contentWindow; return w.eval("(" + f + ")")(a); }, [id, fn.toString(), arg]),
    FL: id => p.frameLocator(`.panel[aria-label="${NAME[id]}"] iframe`),
    hdr: async id => (await p.$(`.panel[aria-label="${NAME[id]}"] .pn-h h3`)).boundingBox(),
    /* تفعيل لوح قبل التفاعل داخل إطاره: نقرة حقيقية على ترويسته إن كانت ظاهرة، وإلا (يغطيها لوح آخر) يُفعَّل بالمحرّك نفسه */
    select: async id => { const h = await X.hdr(id), hit = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.closest(".panel") && e.closest(".panel").getAttribute("aria-label"); }, [h.x + h.width / 2, h.y + h.height / 2]); if (hit === NAME[id]) await p.mouse.click(h.x + h.width / 2, h.y + h.height / 2); else await p.evaluate(i => SpatialOS.open(i), id); await p.waitForFunction(i => SpatialOS.focused === i, id, { timeout: 5000 }).catch(async () => { await p.evaluate(i => SpatialOS.open(i), id); }); await p.waitForTimeout(450); },
    api: () => p.evaluate(async () => (await (await fetch("../../api/index.php?r=orders", { credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest" } })).json()).orders),
    prods: () => p.evaluate(async () => { const f = await (await fetch("../../api/index.php?r=file&path=assets/js/data.js", { credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest" } })).json(); const txt = decodeURIComponent(escape(atob(f.content))), i = txt.indexOf("var PRODUCTS = "); return JSON.parse(txt.slice(i + 15, txt.lastIndexOf(";"))); }),
    stock: async () => Object.fromEntries((await X.prods()).map(x => [x.slug, x.stock])),
    mark: () => reqs.length,
    net: m => { const o = { orders: 0, data: 0, put: 0, admin: 0, writes: 0, other: 0 }; reqs.slice(m).forEach(r => { const rt = (/[?&]r=([a-z_]+)/.exec(r.u) || [])[1] || "", path = decodeURIComponent((/[?&]path=([^&]+)/.exec(r.u) || [])[1] || ""); if (/\/admin(\.html)?(\?|$)/.test(r.u) && r.m === "GET" && !rt) o.admin++; else if (rt === "orders" && r.m === "GET") o.orders++; else if (rt === "file" && r.m === "GET" && /assets\/js\/data\.js/.test(path)) o.data++; else if (rt === "file" && r.m === "PUT") o.put++; else if (r.m !== "GET") o.writes++; else o.other++; }); return o; },
    /* ينتظر هدوء المركز: لا تحديث جارٍ ولا لوح قديم/معلَّق، مستقراً لمدة */
    quiet: async (ms = 1500, max = 30000) => { const t0 = Date.now(); let since = 0; while (Date.now() - t0 < max) { const bad = await p.evaluate(() => SpatialHub.ids().map(i => SpatialHub.state(i)).filter(s => s && s.vis && (s.refreshing || s.stale.length)).length); if (!bad) { if (!since) since = Date.now(); if (Date.now() - since >= ms) return true; } else since = 0; await sleep(250); } return false; },
    truth: async () => { const tp = await c.newPage(); try { await tp.goto(base + "/admin.html"); await tp.waitForFunction(() => typeof Admin !== "undefined" && Admin.orders && document.getElementById("app") && !document.getElementById("app").classList.contains("hidden"), null, { timeout: 60000 }); await tp.waitForTimeout(1800); const out = {}; for (const id of Object.keys(TABS)) { await tp.evaluate(t => Admin.tab(t), TABS[id]); await tp.waitForTimeout(900); out[id] = await tp.evaluate("(" + EX[id].toString() + ")()"); } return out; } finally { await tp.close(); } },
    fp: async (ids) => { const out = {}; for (const id of ids) out[id] = await X.fev(id, EX[id]); return out; },
    spy: () => p.evaluate(() => (window.__spy || []).slice()),
    /* يختار أول قيمة متاحة فعلاً في قائمة إجراءات الصف (قائمة الاتصال للجديد، وقائمة الحالات للمؤكَّد) عبر واجهة اللوحة الحقيقية */
    confirmOrder: async (name, ...want) => { want = want.length ? want : ["confirm"]; await X.select("ord"); const sel = X.FL("ord").locator("#orders-table tr", { hasText: name }).locator("select.act-sel"); const opts = await sel.locator("option").evaluateAll(o => o.map(x => x.value)); const v = want.find(w => opts.includes(w)); if (!v) throw new Error("لا خيار من " + want + " ضمن " + opts); await sel.selectOption(v); },
  };
  return X;
}
const diffFp = (a, b) => json(a) === json(b);
const until = async (fn, max = 25000, step = 250) => { const t0 = Date.now(); while (Date.now() - t0 < max) { try { if (await fn()) return true; } catch (_) { } await sleep(step); } return false; };
const EXTRA = Array.from({ length: 12 }, (_, i) => ({ name: "عميل اختبار " + ["ألف", "باء", "جيم", "دال", "هاء", "واو", "زاي", "حاء", "طاء", "ياء", "كاف", "لام"][i], phone: "0661" + String(200100 + i * 53), wilaya: "البليدة", commune: "بوفاريك", dtype: "home", items: [{ slug: i % 2 ? "tarkiz" : "pack4", title: i % 2 ? "قطرات التركيز" : "باقة العناية الأربعة", qty: 1, price: i % 2 ? 1800 : 4900 }], fee: 450, status: "nouvelle" }));

async function tests(b) {
  const store = await startStore({ stock: true, orders: ORDERS.concat(EXTRA) }), store2 = await startStore({ stock: true });
  try {
    const X = await boot(b, store, { panels: ["inv", "prod", "ana"] }), { p } = X; await p.waitForTimeout(2500); await X.quiet(1000);
    const names = o => ORDERS.find(x => x.name === o);

    await section("S0. الإعداد: خمسة ألواح مسجّلة، مستأجر مثبَّت، كل لوح متزامن", async () => {
      const h = await X.hub(), sts = await Promise.all(["ord", "inv", "prod", "ana"].map(i => X.state(i)));
      ok("المركز يسجّل الألواح الأربعة الحقيقية ويثبّت سياق المستأجر", sts.every(s => s && s.ready) && /^t_[a-z0-9]+$/.test(h.tenant || ""), "hub", [h.tenant, sts.map(s => s.sync)]);
      const [fp, tr] = [await X.fp(["ord", "inv", "prod", "ana"]), await X.truth()];
      ok("البداية متطابقة مع الحقيقة (بصمة لوحة حديثة) لكل لوح", ["ord", "inv", "prod", "ana"].every(i => diffFp(fp[i], tr[i])), "api", ["ord", "inv", "prod", "ana"].filter(i => !diffFp(fp[i], tr[i])));
      await X.reset();
    });

    await section("T1. تأكيد طلب في لوح الطلبات ← تحديث موجَّه في المخزون والتحليلات والمنتجات", async () => {
      const m0 = X.mark(), stock0 = await X.stock(), sum0 = await X.fev("ana", EX.ana); await X.confirmOrder("ليلى بن عمر"); await until(async () => (await X.stock())["miel-sidr"] === 38, 30000); const ok1 = await X.quiet(2500, 40000);
      const o = (await X.api()).find(x => x.name === "ليلى بن عمر"), stock1 = await X.stock(), tr = await X.trace(), net = X.net(m0), h = await X.hub();
      ok("الخادم: الطلب صار «مؤكَّد»", o.status === "confirmee", "api", o.status);
      ok("الخادم: المخزون نقص بمنطق اللوحة الحالي (عسل السدر 40 ← 38)", stock0["miel-sidr"] === 40 && stock1["miel-sidr"] === 38, "api", [stock0["miel-sidr"], stock1["miel-sidr"]]);
      ok("المركز استقرّ (لا تحديث جارٍ ولا لوح قديم)", ok1, "hub");
      const fp = await X.fp(["ord", "inv", "prod", "ana"]), truth = await X.truth();
      ok("لوح المخزون يعرض المخزون الجديد من الخادم (38)", fp.inv["miel-sidr"].stock === "38" && diffFp(fp.inv, truth.inv), "real-ui", fp.inv["miel-sidr"]);
      ok("لوح المنتجات يعرض الإتاحة الجديدة وفق الخادم", fp.prod["miel-sidr"].stock === "38" && diffFp(fp.prod, truth.prod), "real-ui", fp.prod["miel-sidr"]);
      ok("لوح التحليلات والمؤشرات التشغيلية تغيّرت وتطابق الحقيقة", diffFp(fp.ana, truth.ana) && json(fp.ana) !== json(sum0), "real-ui", [sum0.states, fp.ana.states]);
      ok("لوح الطلبات (المصدر) مطابق للحقيقة", diffFp(fp.ord, truth.ord), "real-ui");
      const started = tr.filter(t => t.k === "refresh.start").map(t => t.id);
      ok("لم يُحدَّث لوح الطلبات المصدر (لا تكرار لما نفّذه بنفسه)", started.indexOf("ord") < 0, "hub", started);
      ok("حُدِّث لوحا المخزون والتحليلات وحدهما بما يلزم (المنتجات عند حدث المخزون)", started.indexOf("inv") >= 0 && started.indexOf("ana") >= 0 && started.indexOf("prod") >= 0, "hub", started);
      ok("لا إعادة تحميل لأي صفحة admin.html (تحديث موجَّه فقط)", net.admin === 0, "api", net);
      ok("أحداث الطلب والمخزون قُبلت بعد نجاح الخادم (order.confirmed + inventory.updated)", tr.some(t => t.k === "accept" && t.type === "order.confirmed") && tr.some(t => t.k === "accept" && t.type === "inventory.updated"), "hub", tr.filter(t => t.k === "accept").map(t => t.type));
      ok("لا حلقات: لا أحداث صدى ولا رفض ولا تحديث فاشل", h.st.echoDropped === 0 && h.st.refreshFail === 0 && Object.keys(h.st.rejected).length === 0, "hub", h.st);
      ok("حدث لوح الطلبات بعد التحديث فقط يتعلّق بما اختلف: عدد طلبات GET /orders ≤ 2 وقراءات data.js ≤ 4", net.orders <= 2 && net.data <= 4, "api", net);
      await X.reset();
    });

    await section("T2. إلغاء طلب ← تحديث بعد تأكيد الخادم فقط (تأخير الاستجابة)", async () => {
      await X.select("ord"); const delay = { on: true }; let released = 0;
      await p.route(/api\/index\.php\?r=order_update/, async r => { if (delay.on && /annulee/.test(r.request().postData() || "")) { await sleep(2500); released = Date.now(); } await r.continue(); });
      const before = await X.hub(), t0 = Date.now(); const trigger = X.confirmOrder("ليلى بن عمر", "annulee", "cancel");
      await sleep(1200); const mid = await X.hub(), midState = await Promise.all(["inv", "ana", "prod"].map(i => X.state(i)));
      const trMid = await X.trace(), srvMid = (await X.api()).find(x => x.name === "ليلى بن عمر");
      ok("قبل أن يردّ الخادم: الطلب ما زال «مؤكَّد» في الخادم، ولا order.cancelled مقبول، ولا لوح آخر قديم بسبب الإلغاء", srvMid.status === "confirmee" && !trMid.some(t => t.k === "accept" && t.type === "order.cancelled") && !trMid.some(t => t.k === "accept" && t.type === "order.updated" && t.status === "annulee"), "hub", [srvMid.status, trMid.filter(t => t.k === "accept").map(t => t.type)]);
      await trigger; await until(async () => (await X.stock())["miel-sidr"] === 40, 30000); await X.quiet(2500, 40000); delay.on = false; await p.unroute(/api\/index\.php\?r=order_update/);
      const o = (await X.api()).find(x => x.name === "ليلى بن عمر"), tr = await X.trace(), canc = tr.find(t => t.k === "accept" && t.type === "order.cancelled");
      ok("الخادم: الطلب «ملغى»", o.status === "annulee", "api", o.status);
      ok("حدث order.cancelled قُبل بعد الاستجابة (لا قبلها)", !!canc && canc.t >= released - 50, "hub", [canc && canc.t - t0, released - t0]);
      const fp = await X.fp(["ord", "inv", "prod", "ana"]), truth = await X.truth(), st = await X.stock();
      ok("كل الألواح تطابق الحقيقة بعد الإلغاء (بما فيها المخزون المُعاد وفق منطق الخادم/اللوحة)", ["ord", "inv", "prod", "ana"].every(i => diffFp(fp[i], truth[i])), "api", ["ord", "inv", "prod", "ana"].filter(i => !diffFp(fp[i], truth[i])));
      ok("المخزون في الخادم هو ما تعرضه الألواح (لا قيم مخترعة)", fp.inv["miel-sidr"].stock === String(st["miel-sidr"]) && fp.prod["miel-sidr"].stock === String(st["miel-sidr"]), "api", [st["miel-sidr"], fp.inv["miel-sidr"].stock]);
      await X.reset();
    });

    await section("T3. تعديل منتج (واجهة حقيقية) ← المخزون والتحليلات والمنتجات", async () => {
      await X.select("prod"); const f = X.FL("prod"), m0 = X.mark(); await f.locator("button[onclick*='editProduct'][onclick*='tarkiz']").first().click(); await p.waitForTimeout(1200);
      try { await f.locator("#f-title").fill("قطرات التركيز المحسّنة", { timeout: 6000 }); } catch (e) { console.log("DBG T3", JSON.stringify(await X.fev("prod", () => ({ modal: (document.getElementById("prod-modal-bg") || {}).className, toast: (document.getElementById("toast2") || {}).textContent, vis: document.visibilityState, hasEdit: typeof Admin.editProduct, prods: Admin.products.map(p => p.slug), focus: !!document.hasFocus(), sh: getComputedStyle(parent.document.querySelector('.panel[aria-label="المنتجات"] .pn-shield')).display }))), JSON.stringify(X.errs.slice(-3))); await p.screenshot({ path: process.env.SHOTS_DIR ? process.env.SHOTS_DIR + "/t3-fail.png" : "/tmp/t3-fail.png" }); throw e; } await f.locator("button[onclick='Admin.publishProduct()']").click(); await X.quiet(2000, 40000);
      const P = (await X.prods()).find(x => x.slug === "tarkiz"), tr = await X.trace(), started = tr.filter(t => t.k === "refresh.start").map(t => t.id + ":" + t.res.join("+")), net = X.net(m0);
      ok("الخادم: عنوان المنتج تغيّر في data.js", P.title === "قطرات التركيز المحسّنة", "api", P.title);
      ok("حدث product.updated قُبل", tr.some(t => t.k === "accept" && t.type === "product.updated"), "hub", tr.filter(t => t.k === "accept").map(t => t.type));
      const fp = await X.fp(["ord", "inv", "prod", "ana"]), truth = await X.truth();
      ok("لوح المخزون يعرض العنوان الجديد", fp.inv.tarkiz.title === "قطرات التركيز المحسّنة" && diffFp(fp.inv, truth.inv), "real-ui", fp.inv.tarkiz.title);
      ok("لوح المنتجات (المصدر) والتحليلات تطابق الحقيقة", diffFp(fp.prod, truth.prod) && diffFp(fp.ana, truth.ana), "real-ui");
      ok("حُدِّث المخزون والتحليلات ولم يُحدَّث لوح الطلبات (لا يعرض منتجات)", started.some(s => s.startsWith("inv:")) && started.some(s => s.startsWith("ana:")) && !started.some(s => s.startsWith("ord:")), "hub", started);
      ok("لا إعادة تحميل صفحات", net.admin === 0, "api", net);
      await X.reset();
    });

    await section("T4. تحديث مخزون (واجهة حقيقية) ← إتاحة المنتجات والتحليلات", async () => {
      await X.select("inv"); const f = X.FL("inv"), m0 = X.mark(); await f.locator("input[data-stock='memory-drops']").fill("77"); await f.locator("input[data-stock='memory-drops']").press("Tab"); await f.locator("#inv-save").click(); await until(async () => (await X.stock())["memory-drops"] === 77, 25000); await X.quiet(2500, 40000);
      const st = await X.stock(), tr = await X.trace(), fp = await X.fp(["inv", "prod", "ana"]), truth = await X.truth(), started = tr.filter(t => t.k === "refresh.start").map(t => t.id);
      ok("الخادم: مخزون «قطرات الذاكرة» = 77", st["memory-drops"] === 77, "api", st["memory-drops"]);
      ok("حدث inventory.updated قُبل لهذا المنتج فقط", tr.filter(t => t.k === "accept" && t.type === "inventory.updated").length >= 1 && tr.filter(t => t.k === "accept" && t.type === "inventory.updated").every(t => t.res === "memory-drops"), "hub", tr.filter(t => t.k === "accept").map(t => t.type + ":" + t.res));
      ok("لوح المنتجات يعرض الإتاحة الجديدة (77) كما في الحقيقة", fp.prod["memory-drops"].stock === "77" && diffFp(fp.prod, truth.prod), "real-ui", fp.prod["memory-drops"]);
      ok("لوح المخزون (المصدر) والتحليلات مطابقان للحقيقة", diffFp(fp.inv, truth.inv) && diffFp(fp.ana, truth.ana), "real-ui");
      ok("لم يُحدَّث لوح الطلبات؛ حُدِّث المنتجات والتحليلات", started.indexOf("ord") < 0 && started.indexOf("prod") >= 0 && started.indexOf("ana") >= 0, "hub", started);
      ok("لا إعادة تحميل صفحات", X.net(m0).admin === 0, "api");
      await X.reset();
    });

    await section("T5. حماية التكرار: معرّف الحدث ودمج الأحداث المتطابقة", async () => {
      const send = (n, id) => p.evaluate(([i, id]) => { const w = SpatialOS.panels.get(i).fr.contentWindow; const ev = { spatialHub: 1, kind: "event", id, type: "analytics.invalidate", resource: { kind: "analytics", id: "all" }, ts: Date.now(), rev: null, tenant: SpatialHub.tenant(), meta: {} }; w.eval("parent.postMessage(" + JSON.stringify(ev) + ", location.origin)"); }, [n, id]);
      await X.reset(); const id = "ev_" + "a1b2c3d4e5f60718"; await send("ord", id); await send("ord", id); await send("ord", id); await X.quiet(1500, 20000);
      let h = await X.hub(), tr = await X.trace();
      ok("ثلاث رسائل بنفس المعرّف ← قُبلت واحدة ورُفض تكراران", h.st.accepted === 1 && h.st.dup === 2, "hub", [h.st.accepted, h.st.dup]);
      ok("وتحديث واحد فقط للوح التحليلات (لا تضاعف)", tr.filter(t => t.k === "refresh.start" && t.id === "ana").length === 1, "hub", tr.filter(t => t.k === "refresh.start").map(t => t.id));
      await X.reset(); for (let k = 0; k < 6; k++) await send("ord", "ev_" + (k + 10).toString(16).padStart(2, "0") + "ffeeddccbbaa00"); await X.quiet(1500, 20000); h = await X.hub(); tr = await X.trace();
      ok("ست إشارات مختلفة المعرّف في لحظة واحدة ← تُقبل كلها وتُدمج في تحديث واحد (debounce)", h.st.accepted === 6 && tr.filter(t => t.k === "refresh.start" && t.id === "ana").length === 1, "hub", [h.st.accepted, tr.filter(t => t.k === "refresh.start").length]);
      await X.reset();
    });

    await section("T6. رسائل مشوَّهة ← تُرفض كلها ولا يحدث تحديث", async () => {
      await X.reset(); const before = JSON.stringify(await X.api()); const tn = await p.evaluate(() => SpatialHub.tenant()); const ts = Date.now();
      const good = { spatialHub: 1, kind: "event", id: "ev_00112233445566aa", type: "analytics.invalidate", resource: { kind: "analytics", id: "all" }, ts, rev: null, tenant: tn, meta: {} };
      const bad = [
        ["نوع مجهول", { ...good, type: "order.exploded" }], ["بلا معرّف", (({ id, ...r }) => r)(good)], ["مفتاح زائد", { ...good, extra: 1 }], ["معرّف سيئ", { ...good, id: "x;drop" }], ["ts قديم", { ...good, ts: ts - 3600e3 }],
        ["ts غير رقم", { ...good, ts: "now" }], ["مورد غير متوافق", { ...good, type: "order.confirmed", resource: { kind: "product", id: "a" } }], ["معرّف مورد حقن", { ...good, type: "order.updated", resource: { kind: "order", id: "<img onerror=1>" } }],
        ["حالة meta غير معروفة", { ...good, type: "order.updated", resource: { kind: "order", id: "S1" }, meta: { status: "hacked" } }], ["حقل meta خارج القائمة", { ...good, type: "order.updated", resource: { kind: "order", id: "S1" }, meta: { fields: ["password"] } }],
        ["meta فيه بيانات زبون", { ...good, type: "order.updated", resource: { kind: "order", id: "S1" }, meta: { name: "ليلى" } }], ["إصدار خاطئ", { ...good, spatialHub: 2 }], ["kind خاطئ", { ...good, kind: "exec" }], ["مصفوفة", [good]], ["نص", "event"], ["null", null],
        ["rev ضخم", { ...good, rev: "x".repeat(200) }], ["حمولة ضخمة", { ...good, meta: {}, pad: "y".repeat(5000) }], ["مستأجر بصيغة سيئة", { ...good, tenant: "tenant-1" }], ["مستأجر آخر", { ...good, tenant: "t_zzzzzz" }],
      ];
      await p.evaluate(([list]) => { const w = SpatialOS.panels.get("ord").fr.contentWindow; list.forEach(([n, m]) => w.eval("parent.postMessage(" + (m === undefined ? "undefined" : JSON.stringify(m)) + ", location.origin)")); w.eval('parent.postMessage(JSON.parse(\'{"spatialHub":1,"kind":"event","__proto__":{"polluted":1},"id":"ev_00112233445566bb","type":"analytics.invalidate","resource":{"kind":"analytics","id":"all"},"ts":' + Date.now() + ',"rev":null,"tenant":"' + SpatialHub.tenant() + '","meta":{}}\'), location.origin)'); }, [bad]);
      await sleep(1500); const h = await X.hub(), rej = Object.values(h.st.rejected).reduce((a, x) => a + x, 0), tr = await X.trace();
      ok("كل الرسائل المشوَّهة (" + (bad.length + 1) + ") رُفضت ولم يُقبل أي حدث", h.st.accepted === 0 && rej >= bad.length + 1, "hub", { accepted: h.st.accepted, rej, why: h.st.rejected });
      ok("ولم يبدأ أي تحديث ولم يتغيّر أي طلب في الخادم", h.st.refreshes === 0 && JSON.stringify(await X.api()) === before && !({}).polluted, "api");
      await p.evaluate(g => SpatialOS.panels.get("ord").fr.contentWindow.eval("parent.postMessage(" + JSON.stringify(g) + ", location.origin)"), { ...good, id: "ev_00112233445566cc" }); await X.quiet(1200, 20000);
      const h2 = await X.hub(); ok("والمركز يعمل بعدها (حدث سليم يُقبل ويُحدِّث)", h2.st.accepted === 1 && h2.st.refreshOk >= 1, "hub", [h2.st.accepted, h2.st.refreshOk]);
      await X.reset();
    });

    await section("T7. أصول ونوافذ غير موثوقة ← تُرفض ولا تؤثر", async () => {
      await X.reset(); const tn = await p.evaluate(() => SpatialHub.tenant()), m0 = X.mark();
      const r = await p.evaluate(async tn => {
        const ev = { spatialHub: 1, kind: "event", id: "ev_0a0b0c0d0e0f0123", type: "analytics.invalidate", resource: { kind: "analytics", id: "all" }, ts: Date.now(), rev: null, tenant: tn, meta: {} };
        const mkF = (attrs, html) => new Promise(res => { const f = document.createElement("iframe"); f.style.display = "none"; for (const k in attrs) f.setAttribute(k, attrs[k]); f.srcdoc = html; f.onload = () => res(f); document.body.appendChild(f); });
        const code = "<script>parent.postMessage(" + JSON.stringify(ev) + ",'*');parent.postMessage(" + JSON.stringify({ ...ev, id: "ev_0a0b0c0d0e0f0124" }) + ",'*')<\/script>";
        const sandboxed = await mkF({ sandbox: "allow-scripts" }, code);     /* أصل «null» (غير مطابق) */
        const sameOriginUnregistered = await mkF({}, code);                  /* نفس الأصل لكنه ليس لوحاً مسجَّلاً */
        /* نافذة متداخلة داخل لوح مسجَّل (المصدر ليس نافذة اللوح نفسها) */
        const w = SpatialOS.panels.get("ord").fr.contentWindow, nf = w.document.createElement("iframe"); nf.srcdoc = code.replace("parent.postMessage", "top.postMessage"); w.document.body.appendChild(nf);
        /* محاولة أمر تحديث من نافذة غير الأب إلى لوح مسجَّل */
        const f3 = await mkF({}, ""); f3.contentWindow.eval("parent.SpatialOS.panels.get('ana').fr.contentWindow.postMessage(" + JSON.stringify({ spatialHub: 1, kind: "cmd", cmd: "refresh", reqId: "rq_deadbeefdeadbeef", resources: ["orders", "products"], tenant: tn }) + "," + JSON.stringify(location.origin) + ")");
        await new Promise(r => setTimeout(r, 300)); return { ok: true };
      }, tn);
      await sleep(1500); const h = await X.hub(), spy = await X.spy();
      ok("لا حدث مقبول من إطار sandbox (أصل null) ولا من نافذة بنفس الأصل غير مسجَّلة ولا من نافذة متداخلة", h.st.accepted === 0, "hub", h.st);
      ok("سُجّل سبب الرفض: أصل/مصدر", (h.st.rejected.origin || 0) >= 2 && (h.st.rejected.source || 0) >= 2, "hub", h.st.rejected);
      ok("ولم يبدأ أي تحديث في المركز", h.st.refreshes === 0, "hub");
      ok("أمر تحديث مزوَّر من نافذة غير الأب يتجاهله الجسر: لا ack ولا قراءة data.js (الصدى الوحيد: استقراء الإدارة الدوري للطلبات)", !spy.some(s => /rq_deadbeefdeadbeef/.test(s.d) && s.where === "parent") && X.net(m0).data === 0, "api", X.net(m0));
      await p.evaluate(() => document.querySelectorAll("body > iframe[srcdoc]").forEach(f => f.remove())); await X.reset();
    });

    await section("T8. لوح مغلق ثم مُعاد فتحه + استرداد بعد إعادة تحميل الإطار", async () => {
      await p.evaluate(() => SpatialOS.dismiss("inv", "close")); await sleep(900); ok("المركز يلغي تسجيل اللوح المغلق", !(await p.evaluate(() => SpatialHub.ids().includes("inv"))), "hub");
      await X.reset(); const m0 = X.mark(); await X.confirmOrder("أمينة بوزيد"); await until(async () => (await X.stock()).tarkiz === 29, 30000); await X.quiet(2500, 40000); const tr = await X.trace();
      ok("أثناء الإغلاق لا أوامر ولا تحديثات تُرسَل للوح المغلق", !tr.some(t => (t.k === "refresh.start" || t.k === "skip.hidden") && t.id === "inv"), "hub");
      const stock = await X.stock(); await p.evaluate(() => SpatialOS.open("inv")); await p.waitForFunction(() => SpatialOS.panels.get("inv") && SpatialOS.panels.get("inv").frDone, null, { timeout: 60000 }); await X.quiet(1500, 30000);
      const fp = await X.fp(["inv"]), truth = await X.truth();
      ok("بعد إعادة الفتح يعرض المخزون الحالي من الخادم (قطرات التركيز بعد التأكيد) ويطابق الحقيقة", fp.inv.tarkiz.stock === String(stock.tarkiz) && diffFp(fp.inv, truth.inv), "real-ui", [fp.inv.tarkiz.stock, stock.tarkiz]);
      ok("واللوح متزامن وبلا نقص", (await X.state("inv")).sync === "synced", "hub");
      /* استرداد بعد إعادة تحميل إطار لوح التحليلات بينما يُنفَّذ تغيير */
      await X.reset(); await p.evaluate(() => { const f = SpatialOS.panels.get("ana").fr; f.src = f.getAttribute("src"); }); /* إعادة تحميل الإطار (location.reload على خادم php المحلي يفقد مسار /admin النظيف؛ على الاستضافة الحقيقية تُعيده قواعد إعادة الكتابة) */ await sleep(300); await X.confirmOrder("عميل اختبار جيم"); await sleep(500); await p.waitForFunction(() => SpatialOS.panels.get("ana").frDone, null, { timeout: 90000 }); await until(async () => (await X.state("ana")).ready, 30000); await X.quiet(3000, 60000);
      const tr2 = await X.trace(), fp2 = await X.fp(["ana", "ord"]), truth2 = await X.truth(), h = await X.hub();
      ok("بعد إعادة تحميل الإطار: استقبل المركز hello من جديد واللوح متزامن", tr2.some(t => t.k === "reload" && t.id === "ana") && tr2.some(t => t.k === "hello" && t.id === "ana") && (await X.state("ana")).sync === "synced", "hub", tr2.filter(t => /reload|hello|activate|refresh.start/.test(t.k) && t.id === "ana").map(t => t.k));
      ok("لوح التحليلات يطابق الحقيقة بعد التغيير أثناء التحميل (استرداد)", diffFp(fp2.ana, truth2.ana) && diffFp(fp2.ord, truth2.ord), "real-ui", [fp2.ana, truth2.ana]);
      ok("لا إعادة تحميل غير مقصودة لصفحات أخرى", h.st.refreshFail === 0, "hub", h.st);
      await X.reset();
    });

    await section("T9. لوح مصغَّر ثم مُستعاد", async () => {
      await p.evaluate(() => SpatialOS.dismiss("prod", "min")); await sleep(900); await X.reset(); const m0 = X.mark();
      await X.select("inv"); await X.FL("inv").locator("input[data-stock='huile-a-barbe']").fill("11"); await X.FL("inv").locator("input[data-stock='huile-a-barbe']").press("Tab"); await X.FL("inv").locator("#inv-save").click(); await until(async () => (await X.stock())["huile-a-barbe"] === 11, 25000); await X.quiet(2500, 40000);
      const tr = await X.trace(), stBefore = await X.state("prod"), net = X.net(m0);
      ok("اللوح المصغَّر لم يُحدَّث (تخطّاه المركز) ويُعلَّم «قديماً»", tr.some(t => t.k === "skip.hidden" && t.id === "prod") && !tr.some(t => t.k === "refresh.start" && t.id === "prod") && stBefore.stale.includes("products"), "hub", [stBefore.stale, tr.filter(t => t.id === "prod").map(t => t.k)]);
      const stale = await X.fev("prod", EX.prod), truthBefore = await X.stock();
      ok("وبياناته المحلية ما زالت القديمة (لا تطبيق تفاؤلي)", stale["huile-a-barbe"].stock !== String(truthBefore["huile-a-barbe"]), "real-ui", [stale["huile-a-barbe"].stock, truthBefore["huile-a-barbe"]]);
      await p.evaluate(() => SpatialOS.open("prod")); await sleep(800); await X.quiet(2000, 30000); const tr2 = await X.trace(), fp = await X.fp(["prod"]), truth = await X.truth();
      ok("عند استعادته يُحدَّث تلقائياً (activate) ويعرض مخزون الخادم (11)", tr2.some(t => t.k === "activate" && t.id === "prod") && fp.prod["huile-a-barbe"].stock === "11" && diffFp(fp.prod, truth.prod), "real-ui", fp.prod["huile-a-barbe"]);
      ok("وصار متزامناً", (await X.state("prod")).sync === "synced", "hub");
      await X.reset();
    });

    await section("T10. عدة ألواح معاً وتغييرات متتابعة: تحديث موجَّه، بلا حلقات", async () => {
      await X.reset(); const m0 = X.mark(); const t0 = Date.now();
      await X.confirmOrder("عميل اختبار ألف"); await X.select("inv"); await X.FL("inv").locator("input[data-stock='pack4']").fill("9"); await X.FL("inv").locator("input[data-stock='pack4']").press("Tab"); await X.FL("inv").locator("#inv-save").click(); await X.select("prod"); await X.FL("prod").locator("button[onclick*='editProduct'][onclick*='pack4']").first().click(); await p.waitForTimeout(900); await X.FL("prod").locator("#f-title").fill("باقة العناية الأربعة بلس"); await X.FL("prod").locator("button[onclick='Admin.publishProduct()']").click();
      await until(async () => (await X.stock()).pack4 === 9 && (await X.prods()).find(x => x.slug === "pack4").title === "باقة العناية الأربعة بلس", 40000); const q = await X.quiet(3500, 60000), h = await X.hub(); const refs = h.st.refreshes;
      const fp = await X.fp(["ord", "inv", "prod", "ana"]), truth = await X.truth(), net = X.net(m0);
      ok("استقرّ المركز بعد ثلاث عمليات متتابعة", q, "hub");
      ok("كل الألواح الأربعة تطابق الحقيقة", ["ord", "inv", "prod", "ana"].every(i => diffFp(fp[i], truth[i])), "api", ["ord", "inv", "prod", "ana"].filter(i => !diffFp(fp[i], truth[i])));
      await sleep(4000); const h2 = await X.hub(); ok("لا حلقات تحديث: بعد الهدوء لا تحديثات جديدة (4ث)", h2.st.refreshes === refs && h2.st.accepted === h.st.accepted, "hub", [refs, h2.st.refreshes]);
      ok("لا إعادة تحميل صفحات admin.html مطلقاً", net.admin === 0, "api", net);
      ok("التحديثات أقل من «كل لوح لكل حدث» (" + h.st.accepted + " أحداث × 3 ألواح = " + h.st.accepted * 3 + ")", refs < h.st.accepted * 3, "hub", [refs, h.st.accepted]);
      await X.reset();
    });

    await section("T11. عمليات API فاشلة ← لا أحداث ولا تغيير في الألواح الأخرى، ويُعاد المصدر إلى الحقيقة", async () => {
      await X.reset(); const before = json((await X.api()).map(o => [o.id, o.status])), cases = [["HTTP 500", r => r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"x"}' })], ["200 مع ok:false", r => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":false}' })], ["انقطاع شبكة", r => r.abort("failed")]];
      for (const [label, h] of cases) {
        await X.reset(); await p.route(/api\/index\.php\?r=order_update/, h); const m0 = X.mark(); await X.confirmOrder("عميل اختبار هاء"); await sleep(3200); await X.quiet(1500, 20000); await p.unroute(/api\/index\.php\?r=order_update/);
        const hh = await X.hub(), tr = await X.trace(), srv = (await X.api()).find(o => o.name === "عميل اختبار هاء"), local = await X.fev("ord", () => Admin.orders.find(o => o.name === "عميل اختبار هاء").status), orderEv = tr.filter(t => t.k === "accept" && /^order\./.test(t.type)).length;
        ok(label + ": لا حدث order.* مقبول (الكتابة فشلت) ولا تحديث تحليلات بسببه", orderEv === 0 && !tr.some(t => t.k === "refresh.start" && t.id === "ana" && t.res.includes("orders")), "hub", { orderEv, acc: tr.filter(t => t.k === "accept").map(t => t.type) });
        ok(label + ": الخادم لم يتغيّر (حالة الطلب كما هي: " + srv.status + ")", srv.status === "nouvelle", "api", srv.status);
        ok(label + ": سُجّل فشل الكتابة وأُعيد لوح الطلبات المصدر إلى حقيقة الخادم", tr.some(t => t.k === "write.failed") && local === srv.status, "hub", [local, srv.status]);
        await X.quiet(2500, 30000); { const fp = await X.fp(["inv", "prod", "ana", "ord"]), truth = await X.truth(); ok(label + ": وكل الألواح (بما فيها ما حدث لمخزونها بمنطق اللوحة نفسه) تطابق الحقيقة", ["ord", "inv", "prod", "ana"].every(i => diffFp(fp[i], truth[i])), "api", ["ord", "inv", "prod", "ana"].filter(i => !diffFp(fp[i], truth[i]))); }
      }
      ok("لا تغيير في أي طلب بسبب كل الإخفاقات", json((await X.api()).map(o => [o.id, o.status])) === before, "api");
      /* ملاحظة موثَّقة: منطق المخزون الحالي في اللوحة يُنفَّذ محلياً حتى لو فشل order_update (سلوك قائم قبل المزامنة) */
      /* كتابة مخزون فاشلة (409) */
      await X.reset(); await p.route(/api\/index\.php\?r=file/, r => r.request().method() === "PUT" ? r.fulfill({ status: 409, contentType: "application/json", body: '{"error":"conflict"}' }) : r.continue());
      const st0 = await X.stock(); await X.select("inv"); await X.FL("inv").locator("input[data-stock='tarkiz']").fill("3"); await X.FL("inv").locator("input[data-stock='tarkiz']").press("Tab"); await X.FL("inv").locator("#inv-save").click(); await sleep(3500); await X.quiet(1500, 20000); await p.unroute(/api\/index\.php\?r=file/);
      const hh = await X.hub(), tr = await X.trace(), st1 = await X.stock();
      ok("فشل كتابة المخزون (409): لا حدث inventory.updated ولا تحديث لبقية الألواح والخادم لم يتغيّر", hh.st.accepted === 0 && st1.tarkiz === st0.tarkiz && !tr.some(t => t.k === "refresh.start" && (t.id === "prod" || t.id === "ana")), "hub", [hh.st.accepted, st0.tarkiz, st1.tarkiz]);
      /* اللوح المصدر ما زال فيه تعديل غير محفوظ (فشل حفظه): حماية «لا نطمس عمل المستخدم» — أي تحديث خارجي للمنتجات يُؤجَّل (deferred) ولا يستبدل ما كتبه */
      await X.reset(); await X.select("prod"); await X.FL("prod").locator("button[onclick*='editProduct'][onclick*='pack4']").first().click(); await p.waitForTimeout(900); await X.FL("prod").locator("#f-title").fill("باقة العناية الأربعة تجريبية"); await X.FL("prod").locator("button[onclick='Admin.publishProduct()']").click(); await until(async () => (await X.prods()).find(x => x.slug === "pack4").title === "باقة العناية الأربعة تجريبية", 25000); await X.quiet(3000, 40000);
      const kept = await X.fev("inv", () => document.querySelector("#tab-inventory input[data-stock='tarkiz']").value), h3 = await X.hub(), invTitle = (await X.fev("inv", EX.inv)).pack4.title;
      ok("لوح المخزون ذو التعديل غير المحفوظ لم يُطمَس (قيمته «3» محفوظة) وأُجِّل تحديثه (deferred) وبقي عنوان pack4 القديم فيه", kept === "3" && h3.st.deferred >= 1 && invTitle !== "باقة العناية الأربعة تجريبية", "hub", [kept, h3.st.deferred, invTitle]);
      /* تنظيف: إعادة تحميل إطار المخزون (استرداد) فيعود مطابقاً للخادم */
      await p.evaluate(() => { const f = SpatialOS.panels.get("inv").fr; f.src = f.getAttribute("src"); }); await sleep(500); await p.waitForFunction(() => SpatialOS.panels.get("inv").frDone, null, { timeout: 90000 }); await until(async () => (await X.state("inv")).ready, 30000); await X.quiet(3000, 60000);
      { const fp = await X.fp(["inv"]), truth = await X.truth(); ok("وبعد إعادة تحميله يعرض حالة الخادم الحالية (يطابق الحقيقة)", diffFp(fp.inv, truth.inv) && fp.inv.pack4.title === "باقة العناية الأربعة تجريبية", "real-ui"); }
      await X.reset();
    });

    await section("T13. إنشاء طلب يدوي وإنشاء/حذف منتج بواجهات اللوحة الحقيقية ← order.created / product.created / product.deleted", async () => {
      await X.reset(); await X.select("ord"); const fo = X.FL("ord"); await fo.locator("#mo-btn").click(); await p.waitForTimeout(1500);
      await fo.locator("#mo-name").fill("زبون يدوي للمزامنة"); await fo.locator("#mo-phone").fill("0555123987"); await fo.locator("#mo-wil").selectOption({ index: 16 }); await p.waitForTimeout(700); if ((await fo.locator("#mo-com option").count()) > 1) await fo.locator("#mo-com").selectOption({ index: 1 });
      await fo.locator("#mo-lines select").first().selectOption({ label: "قطرات التركيز" }); await p.waitForTimeout(400); await fo.locator("#mo-save").click(); await until(async () => (await X.api()).some(o => o.name === "زبون يدوي للمزامنة"), 20000); await X.quiet(2500, 40000);
      let tr = await X.trace(), fp = await X.fp(["ord", "inv", "ana"]), truth = await X.truth(), srv = (await X.api()).find(o => o.name === "زبون يدوي للمزامنة");
      ok("الخادم: الطلب اليدوي موجود (" + (srv && srv.id) + ")", !!srv && /^M/.test(srv.id), "api");
      ok("حدث order.created قُبل بمعرّف الطلب فقط (لا اسم ولا هاتف)", tr.some(t => t.k === "accept" && t.type === "order.created" && t.res === srv.id), "hub", tr.filter(t => t.k === "accept").map(t => t.type + ":" + t.res));
      ok("لوح الطلبات (المصدر) ولوحا المخزون والتحليلات يطابقان الحقيقة، والتحليلات تغيّرت", diffFp(fp.ord, truth.ord) && diffFp(fp.inv, truth.inv) && diffFp(fp.ana, truth.ana), "real-ui", { bad: ["ord", "inv", "ana"].filter(i => !diffFp(fp[i], truth[i])), invDiff: Object.keys(truth.inv).filter(k => json(fp.inv[k]) !== json(truth.inv[k])).map(k => [k, fp.inv[k], truth.inv[k]]) });
      ok("ولم يُحدَّث لوح الطلبات المصدر", !tr.some(t => t.k === "refresh.start" && t.id === "ord"), "hub");
      /* منتج جديد */
      await X.reset(); await X.select("prod"); const fpd = X.FL("prod"); await fpd.locator("button[onclick='Admin.editProduct(null)']").click(); await p.waitForTimeout(1300);
      await fpd.locator("#f-slug").fill("nouveau-sync"); await fpd.locator("#f-title").fill("منتج المزامنة الجديد"); await fpd.locator("#f-price").fill("1234"); await fpd.locator("button[onclick='Admin.publishProduct()']").click(); await until(async () => (await X.prods()).some(x => x.slug === "nouveau-sync"), 25000); await X.quiet(2500, 40000);
      tr = await X.trace(); fp = await X.fp(["inv", "prod", "ana"]); truth = await X.truth();
      ok("الخادم: المنتج الجديد في data.js", (await X.prods()).some(x => x.slug === "nouveau-sync" && x.title === "منتج المزامنة الجديد"), "api");
      ok("حدث product.created قُبل بالمعرّف nouveau-sync", tr.some(t => t.k === "accept" && t.type === "product.created" && t.res === "nouveau-sync"), "hub", tr.filter(t => t.k === "accept").map(t => t.type + ":" + t.res));
      ok("لوح المخزون يعرض المنتج الجديد وكل الألواح تطابق الحقيقة", !!fp.inv["nouveau-sync"] && diffFp(fp.inv, truth.inv) && diffFp(fp.prod, truth.prod) && diffFp(fp.ana, truth.ana), "real-ui", { invKeys: Object.keys(fp.inv), truthInv: Object.keys(truth.inv), prodKeys: Object.keys(fp.prod), truthProd: Object.keys(truth.prod), st: tr.filter(t => /^refresh/.test(t.k)).map(t => t.k + ":" + t.id) });
      /* حذف المنتج */
      await X.reset(); await X.select("prod"); await fpd.locator("button[onclick*='delProduct'][onclick*='nouveau-sync']").first().click(); await until(async () => !(await X.prods()).some(x => x.slug === "nouveau-sync"), 25000); await X.quiet(2500, 40000);
      tr = await X.trace(); fp = await X.fp(["inv", "prod", "ana"]); truth = await X.truth();
      ok("الخادم: المنتج حُذف", !(await X.prods()).some(x => x.slug === "nouveau-sync"), "api");
      ok("حدث product.deleted قُبل وحُدِّثت الألواح (المخزون لا يعرض الصف المحذوف) وتطابق الحقيقة", tr.some(t => t.k === "accept" && t.type === "product.deleted" && t.res === "nouveau-sync") && !fp.inv["nouveau-sync"] && diffFp(fp.inv, truth.inv) && diffFp(fp.prod, truth.prod) && diffFp(fp.ana, truth.ana), "real-ui", tr.filter(t => t.k === "accept").map(t => t.type));
      await X.reset();
    });

    await section("T12. عزل المستأجر والجلسة", async () => {
      await X.reset(); const tn = await p.evaluate(() => SpatialHub.tenant()); await p.evaluate(tn => { const w = SpatialOS.panels.get("ord").fr.contentWindow; const ev = { spatialHub: 1, kind: "event", id: "ev_f00dfeed00112233", type: "analytics.invalidate", resource: { kind: "analytics", id: "all" }, ts: Date.now(), rev: null, tenant: "t_otherone", meta: {} }; w.eval("parent.postMessage(" + JSON.stringify(ev) + ", location.origin); parent.postMessage(" + JSON.stringify({ spatialHub: 1, kind: "hello", tenant: "t_otherone", ts: Date.now() }) + ", location.origin)"); }, tn); await sleep(1200);
      let h = await X.hub(); ok("حدث بسياق مستأجر آخر (وhello بمستأجر آخر) يُرفض ولا يغيّر شيئاً", h.st.accepted === 0 && (h.st.rejected.tenant || 0) >= 2 && h.tenant === tn, "hub", h.st.rejected);
      /* متجر ثانٍ (أصل ومستأجر مختلفان) بجانب الأول */
      const Y = await boot(b, store2, { panels: ["inv", "ana"], host: "localhost" }); await Y.quiet(1000, 30000); const t2 = (await Y.hub()).tenant;
      ok("المتجر الثاني بأصل ومستأجر مختلفين (لا اشتراك في الأحداث)", !!t2 && t2 !== tn && Y.base !== X.base, "hub", [tn, t2]);
      const bef2 = json((await Y.api()).map(o => [o.id, o.status])), stock2 = json(await Y.stock()), m0 = Y.mark(); await Y.reset(); await X.reset();
      await X.confirmOrder("عميل اختبار زاي"); await until(async () => (await X.api()).find(o => o.name === "عميل اختبار زاي").status === "confirmee", 20000); await X.quiet(2500, 40000); await sleep(1200);
      const hy = await Y.hub(), hx = await X.hub();
      ok("تأكيد طلب في المتجر الأول ← لا أحداث ولا تحديثات ولا طلبات شبكة في المتجر الثاني", hy.st.accepted === 0 && hy.st.refreshes === 0 && Y.net(m0).orders === 0 && Y.net(m0).data === 0, "hub", [hy.st.accepted, hy.st.refreshes, Y.net(m0)]);
      ok("وبيانات المتجر الثاني على الخادم كما هي، والأول تغيّر", json((await Y.api()).map(o => [o.id, o.status])) === bef2 && json(await Y.stock()) === stock2 && hx.st.accepted >= 1, "api");
      /* لا أسرار ولا بيانات شخصية في أي رسالة */
      const spyAll = await X.spy(), spy = spyAll.filter(s => /spatialHub/.test(s.d) && !/ev_00112233|ev_0a0b0c|ev_f00dfeed|ev_a1b2c3d4|ev_(0|1)[0-9a-f]ffeeddcc/.test(s.d)), blob = spy.map(s => s.d).join("\n"), pii = ORDERS.flatMap(o => [o.name, o.phone, o.commune]), secrets = ["PHPSESSID", "TestPass12345", "password", "cookie", "token", "Authorization"];
      ok("لا اسم زبون ولا هاتف ولا عنوان في أي رسالة تبادلتها الألواح مع المركز (" + spy.length + " رسالة)", spy.length > 20 && !pii.some(v => blob.includes(v)), "hub", pii.filter(v => blob.includes(v)));
      ok("ولا رمز جلسة ولا كلمة مرور ولا ترويسة تفويض في أي رسالة", !secrets.some(v => blob.toLowerCase().includes(v.toLowerCase())), "hub", secrets.filter(v => blob.toLowerCase().includes(v.toLowerCase())).map(v => [v, (spy.find(s => s.d.toLowerCase().includes(v.toLowerCase())) || {}).d]));
      ok("وكل رسالة واردة للأب بنفس الأصل (لا أصول أخرى)", spy.filter(s => s.where === "parent").every(s => s.origin === new URL(X.base).origin || s.origin === "null"), "hub");
      const ownEx = Y.errs.concat(X.errs).filter(e => /admin-preview\/spatial-os/.test(e)); ok("لا أخطاء JavaScript من ملفات المعاينة", ownEx.length === 0, "api", ownEx);
      await Y.c.close();
    });
    await section("T14. مطابقة العقد: كل أحداث الجسر الحقيقية (غير المصنوعة يدوياً) ضمن الأنواع والمخطط والمستأجر الواحد", async () => {
      const TY = ["order.created", "order.updated", "order.confirmed", "order.cancelled", "product.created", "product.updated", "product.deleted", "inventory.updated", "analytics.invalidate"], KEYS = ["spatialHub", "kind", "id", "type", "resource", "ts", "rev", "tenant", "meta"], MK = ["status", "change", "fields", "stock"];
      const spy = (await X.spy()).filter(s => s.where === "parent" && /"kind":"event"/.test(s.d) && /"id":"ev_[a-f0-9]{20}"/.test(s.d)).map(s => JSON.parse(s.d))  /* معرّفات الجسر الحقيقية 20 خانة؛ الأحداث المصنوعة للاختبار بمعرّفات أقصر */, types = {};
      spy.forEach(e => { types[e.type] = (types[e.type] || 0) + 1; });
      ok("أحداث حقيقية صدرت (" + spy.length + ") من الأنواع: " + Object.keys(types).join(", "), spy.length >= 15 && ["order.confirmed", "order.cancelled", "order.created", "product.updated", "product.created", "product.deleted", "inventory.updated"].every(k => types[k]), "hub", types);
      const badEv = spy.filter(e => !(TY.includes(e.type) && Object.keys(e).every(k => KEYS.includes(k)) && Object.keys(e.meta).every(k => MK.includes(k)) && typeof e.id === "string" && typeof e.ts === "number" && /^t_/.test(e.tenant)));
      ok("كلها بنوع من العقد ومفاتيح العقد فقط ومفاتيح meta المسموحة", badEv.length === 0, "hub", badEv.slice(0, 2));
      ok("وكلها بمستأجر واحد ومعرّفات أحداث فريدة", new Set(spy.map(e => e.tenant)).size === 1 && new Set(spy.map(e => e.id)).size === spy.length, "hub");
      ok("ومعرّف المورد معرّف طلب/منتج فقط (لا أسماء ولا هواتف)", spy.every(e => /^[\w.:\-]{1,120}$/.test(e.resource.id)), "hub");
    });
    await X.c.close();
  } finally { store.stop(); store2.stop(); }
}

async function perf(b) {
  const out = { env: {}, runs: [] }; const W16 = ["ألف", "باء", "جيم", "دال", "هاء", "واو", "زاي", "حاء", "طاء", "ياء", "كاف", "لام", "ميم", "نون", "سين", "عين"], mk = i => ({ name: "عميل أداء " + W16[i - 1], phone: "0550" + String(100000 + i * 37).slice(0, 6), wilaya: "الجزائر", commune: "باب الزوار", dtype: "home", items: [{ slug: "miel-sidr", title: "عسل السدر الجبلي 500غ", qty: 1, price: 3200 }], fee: 400, status: "nouvelle" });
  const extra = Array.from({ length: 16 }, (_, i) => mk(i + 1)), store = await startStore({ stock: true, orders: ORDERS.concat(extra) });
  try {
    const sets = [["ord"], ["ord", "ana"], ["ord", "ana", "inv"], ["ord", "ana", "inv", "prod"]]; let k = 0;
    for (const panels of sets) {
      const N = panels.length, X = await boot(b, store, { panels: panels.filter(x => x !== "ord") }); await X.p.waitForTimeout(2500); await X.quiet(1000, 30000); const cdp = await X.c.newCDPSession(X.p); await cdp.send("Performance.enable");
      await X.p.evaluate(() => { window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ entryTypes: ["longtask"] }); } catch (_) { } });
      for (let rep = 0; rep < 2; rep++) {
        const name = "عميل أداء " + W16[k++]; await X.reset(); const m0 = X.mark(); await X.p.evaluate(() => { window.__lt = []; }); const t0 = Date.now(); await X.confirmOrder(name);
        const s0 = (await X.stock())["miel-sidr"]; await until(async () => (await X.api()).find(o => o.name === name).status === "confirmee", 30000); await until(async () => (await X.stock())["miel-sidr"] < s0, 30000); await X.quiet(1800, 40000);
        const h = await X.hub(), tr = await X.trace(), net = X.net(m0), done = tr.filter(t => t.k === "refresh.done"), starts = tr.filter(t => t.k === "refresh.start"), last = Math.max(0, ...done.map(t => t.t)), acc = tr.filter(t => t.k === "accept"), lt = await X.p.evaluate(() => window.__lt.slice());
        out.runs.push({ panels: N, rep, acceptedEvents: h.st.accepted, refreshes: h.st.refreshes, noop: h.st.noop, refreshMsTotal: done.reduce((a, t) => a + t.ms, 0), bridgeMsTotal: done.reduce((a, t) => a + (t.bridgeMs || 0), 0), refreshMsMax: Math.max(0, ...done.map(t => t.ms)), eventToLastRefreshMs: acc.length && last ? last - acc[0].t : 0, syncLatencyMs: (() => { const L = done.map(d => { const prevAcc = acc.filter(x => x.t <= d.t).pop(); return prevAcc ? d.t - prevAcc.t : null; }).filter(x => x != null).sort((a, b) => a - b); return { median: L[Math.floor(L.length / 2)] || 0, max: L[L.length - 1] || 0 }; })(), wallMs: Date.now() - t0, requests: net, msgBytes: h.st.bytes, longTasks: lt.length, longTaskMs: Math.round(lt.reduce((a, x) => a + x, 0)), perPanel: Object.fromEntries(panels.map(id => [id, starts.filter(t => t.id === id).length])) });
        console.log(JSON.stringify(out.runs[out.runs.length - 1]));
      }
      /* البديل الساذج: إعادة تحميل كل الألواح بعد كل حدث */
      const m1 = X.mark(), tn0 = Date.now(); await X.p.evaluate(() => { SpatialOS.panels.forEach(q => { if (q.fr) { q.frDone = false; q.fr.src = q.fr.getAttribute("src"); } }); }); await X.p.waitForFunction(() => [...SpatialOS.panels.values()].every(q => q.frDone || !q.frame), null, { timeout: 120000 }); const naive = { panels: N, reloadAllMs: Date.now() - tn0, requests: X.net(m1), allRequests: X.reqs.length - m1 };
      out.runs.push({ naive }); console.log(JSON.stringify({ naive })); await X.c.close();
    }
  } finally { store.stop(); }
  fs.writeFileSync(path.join(__dirname, "perf9-result.json"), JSON.stringify(out, null, 1)); return out;
}

(async () => {
  const b = await chromium.launch();
  try { if (only === "all" || only === "tests") await tests(b); if (only === "all" || only === "perf") await perf(b); } finally { await b.close(); }
  console.log(R.join("\n")); console.log(fails ? "\nFAILED: " + fails : "\nALL PASSED (" + R.filter(x => /^PASS/.test(x)).length + ")"); process.exit(fails ? 1 : 0);
})();
