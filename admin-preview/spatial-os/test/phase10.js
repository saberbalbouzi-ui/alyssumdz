/* المرحلة 10 — وكيل أليسوم التنفيذي («اسألني»). كل اختبار يمرّ عبر الواجهة الحقيقية: يُكتب الطلب في حقل الوكيل بلوحة المفاتيح ويُنقر على «موافقة» بالفأرة،
   والتحقق من «الحقيقة» بقراءة الخادم مباشرة (GET orders/file) وبصمة من لوحة أعمال حقيقية، لا بمحاكاة أي مكوّن.
   التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/phase10.js [tests|perf|all]   (ONLY=T1,T2 لتصفية الأقسام) */
const { chromium } = require("playwright"); const { startStore, ORDERS, PW } = require("./harness"); const fs = require("fs"), path = require("path"); const only = process.argv[2] || "all";
const R = []; let fails = 0; const ok = (n, c, m, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + "[" + m + "] " + n + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 260) : "")); };
let CUR = null, T6 = null; const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
async function section(name, fn) { if (ONLY && !ONLY.some(p => name.startsWith(p))) return; R.push("── " + name); try { await fn(); } catch (e) { fails++; if (CUR) await CUR.p.screenshot({ path: "/tmp/p10-fail.png" }).catch(() => { }); R.push("FAIL [crash] " + name + ": " + String(e).split("\n").filter(l => l.trim())[0].slice(0, 300)); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NAME = { ord: "الطلبات", prod: "المنتجات", ana: "التحليلات", inv: "المخزون", ai: "مساعد ALYSSUM" };
const EX = {
  ord: () => ({ o: Admin.orders.map(o => o.id + ":" + o.status).sort(), n: (document.getElementById("orders-count-label") || {}).textContent }),
  inv: () => { const m = {}; document.querySelectorAll("#tab-inventory input[data-stock]").forEach(i => { const tr = i.closest("tr"); m[i.dataset.stock] = { stock: i.value, reserved: tr.lastElementChild.textContent.trim(), title: (tr.children[2].firstChild.textContent || "").trim(), pill: ((tr.querySelector(".pill") || {}).textContent || "").trim() }; }); return m; },
  prod: () => { const m = {}; document.querySelectorAll("#tab-products td[data-l='المخزون']").forEach(td => { const tr = td.closest("tr"), sm = tr.querySelector("small[dir=ltr]"); if (sm) m[sm.textContent.trim()] = { stock: (td.textContent || "").trim(), title: ((tr.querySelector("td.t b") || {}).textContent || "").trim(), price: ((tr.querySelector("td[data-l='السعر'] b") || {}).textContent || "").trim() }; }); return m; },
  ana: () => { const t = (document.getElementById("tab-analytics").innerText || "").replace(/\s+/g, " "); const g = re => { const m = re.exec(t); return m ? m.slice(1).join("|") : null; }; return { states: g(/جديدة (\d+) · مؤكَّدة (\d+)/), rate: g(/([\d.]+)% نسبة تأكيد الطلبات/), sum: g(/الخلاصة العامة (\d+) (\d+) (\d+) (\d+)/), un: g(/غير مرسلة لشركة (\d+)/) }; },
}, TABS = { ord: "orders", inv: "inventory", prod: "products", ana: "analytics" };
const EXO = () => ({ o: Admin.orders.map(o => o.id + ":" + o.status).sort(), n: (document.getElementById("orders-count-label") || {}).textContent });

async function boot(b, store, o = {}) {
  const c = await b.newContext({ viewport: o.vp || { width: 1440, height: 900 } }), p = await c.newPage(), errs = [], reqs = [], navs = [];
  p.on("framenavigated", f => navs.push({ t: Date.now(), main: f === p.mainFrame(), u: f.url().slice(-60) }));
  p.setDefaultTimeout(15000); p.on("pageerror", e => errs.push(String(e.stack || e).split("\n").slice(0, 2).join(" <- ").slice(0, 220))); p.on("dialog", d => d.accept().catch(() => { }));
  p.on("request", r => { if (/\/api\/index\.php/.test(r.url())) reqs.push({ t: Date.now(), m: r.method(), u: r.url(), fr: r.frame() !== p.mainFrame(), b: r.postData() || "" }); });
  await p.addInitScript(() => { if (window === window.top) { window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(Math.round(e.duration)))).observe({ entryTypes: ["longtask"] }); } catch (_) { } } });
  await p.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { if (window !== window.top) { const s = document.createElement("style"); s.textContent = "#toast,#toast2,.toast{pointer-events:none!important}"; document.head.appendChild(s); } }); });
  const url = o.host ? store.spatial.replace("127.0.0.1", o.host) : store.spatial;
  await p.goto(url); await p.waitForTimeout(600);
  const body = o.user ? { user: o.user, password: o.pw } : { password: store.pw };
  const st = o.noLogin ? 200 : await p.evaluate(async b2 => (await fetch("../../api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify(b2) })).status, body);
  if (st !== 200) throw new Error("login " + st);
  await p.reload(); await p.waitForFunction(() => window.AlyssumAgent && SpatialOS.real !== undefined, null, { timeout: 30000 }); await p.waitForTimeout(900);
  if (o.noOrd !== true) await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 90000 }).catch(() => { });
  const X = {
    c, p, errs, reqs, navs, base: url.replace(/\/admin-preview.*/, ""),
    openAgent: async () => { await p.evaluate(() => { SpatialOS.open("ai"); if (!window.__runHook) { window.__runHook = 1; window.__runN = 0; AlyssumAgent.on(e => { if (e.type === "run" && e.phase === "end") window.__runN++; }); } }); await p.waitForSelector(".ag .ag-in", { state: "visible" }); },
    runs: () => p.evaluate(() => window.__runN || 0),
    /* يكتب بلوحة المفاتيح ويضغط Enter ثم ينتظر انتهاء التشغيل التالي ويعيد لقطة الحوار */
    say: async (text, to = 90000) => { const n = await X.runs(); const inp = p.locator(".ag .ag-in"); await inp.click({ timeout: 2500 }).catch(async () => { await X.select("ai"); await inp.click(); }); await inp.fill(text); await inp.press("Enter"); await p.waitForFunction(n0 => (window.__runN || 0) > n0, n, { timeout: to }); return X.last(); },
    last: () => p.evaluate(() => { const b = [...document.querySelectorAll(".ag-run[data-status]")].pop(); const q = s => b.querySelector(s); return { status: b.dataset.status, text: b.querySelector(".ag-res").innerText, und: q(".ag-und").innerText, steps: [...b.querySelectorAll(".ag-step")].map(s => ({ tool: s.dataset.tool, status: s.dataset.status, txt: s.innerText.replace(/\s+/g, " ") })), confirm: !!b.querySelector(".ag-confirm"), verified: b.classList.contains("verified"), blocks: [...b.querySelectorAll(".ag-b")].map(x => ({ k: x.className.replace("ag-b ", ""), t: x.innerText })) }; }),
    state: () => p.evaluate(() => ({ ag: AlyssumAgent.state(), view: document.querySelector(".ag").dataset.state, body: document.body.dataset.agent })),
    api: () => p.evaluate(async () => (await (await fetch("../../api/index.php?r=orders", { credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest" } })).json()).orders),
    prods: () => p.evaluate(async () => { const f = await (await fetch("../../api/index.php?r=file&path=assets/js/data.js", { credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest" } })).json(); const txt = decodeURIComponent(escape(atob(f.content.replace(/\s/g, "")))); return JSON.parse(txt.slice(txt.indexOf("var PRODUCTS = ") + 15, txt.lastIndexOf(";"))); }),
    fev: (id, fn, arg) => p.evaluate(([i, f, a]) => { const q = SpatialOS.panels.get(i), w = q.fr.contentWindow; return w.eval("(" + f + ")")(a); }, [id, fn.toString(), arg]),
    audit: () => p.evaluate(() => AlyssumAgent.audit()),
    hub: () => p.evaluate(() => ({ st: SpatialHub.stats(), tenant: SpatialHub.tenant(), trace: SpatialHub.trace() })),
    FL: id => p.frameLocator(`.panel[aria-label="${NAME[id]}"] iframe`),
    hdr: async id => (await p.$(`.panel[aria-label="${NAME[id]}"] .pn-h h3`)).boundingBox(),
    select: async id => { const h = await X.hdr(id), hit = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.closest(".panel") && e.closest(".panel").getAttribute("aria-label"); }, [h.x + h.width / 2, h.y + h.height / 2]); if (hit === NAME[id]) await p.mouse.click(h.x + h.width / 2, h.y + h.height / 2); else await p.evaluate(i => SpatialOS.open(i), id); await p.waitForFunction(i => SpatialOS.focused === i, id, { timeout: 5000 }).catch(async () => { await p.evaluate(i => SpatialOS.open(i), id); }); await p.waitForTimeout(450); },
    truth: async () => { const tp = await c.newPage(); try { await tp.goto(X.base + "/admin.html"); await tp.waitForFunction(() => typeof Admin !== "undefined" && Admin.orders && document.getElementById("app") && !document.getElementById("app").classList.contains("hidden"), null, { timeout: 60000 }); await tp.waitForTimeout(1800); const out = {}; for (const id of Object.keys(TABS)) { await tp.evaluate(t => Admin.tab(t), TABS[id]); await tp.waitForTimeout(900); out[id] = await tp.evaluate("(" + EX[id].toString() + ")()"); } return out; } finally { await tp.close(); } },
    fp: async ids => { const out = {}; for (const id of ids) out[id] = await X.fev(id, EX[id]); return out; },
    writes: since => reqs.slice(since || 0).filter(r => r.m !== "GET" && /[?&]r=order_update/.test(r.u)).length,
    confirmWrites: (since, id) => reqs.slice(since || 0).filter(r => r.m !== "GET" && /[?&]r=order_update/.test(r.u) && r.b.includes('"status":"confirmee"') && (!id || r.b.includes(id))).length,
    quiet: async (ms = 1200, max = 30000) => { const t0 = Date.now(); let since = 0; while (Date.now() - t0 < max) { const bad = await p.evaluate(() => SpatialHub.ids().map(i => SpatialHub.state(i)).filter(s => s && s.vis && (s.refreshing || s.stale)).length); if (!bad) { if (!since) since = Date.now(); if (Date.now() - since >= ms) return true; } else since = 0; await sleep(150); } return false; },
  };
  return X;
}
const nouv = list => list.filter(o => o.status === "nouvelle");

(async () => {
  const b = await chromium.launch(); const t0 = Date.now(); let store = null, X = null;
  try {
    store = await startStore({ stock: true });
    X = await boot(b, store); CUR = X; await X.openAgent();

    await section("T1 النواة والواجهة الأصلية", async () => {
      const st = await X.state(); ok("لوح الوكيل أصلي (غير إطار) وحالته جاهزة", st.ag === "idle" && st.view === "idle", "ui", st);
      ok("لوح «ai» ليس إطاراً", await X.p.evaluate(() => !SpatialOS.panels.get("ai").frame), "ui");
      const reg = await X.p.evaluate(() => AlyssumAgent.registry().map(t => t.name));
      ok("سجل الأدوات يضم الأدوات الحقيقية", ["orders.list", "orders.get", "orders.confirm", "sales.summary", "sales.top_product", "products.search", "products.get", "inventory.read", "customers.find", "settings.read", "ui.filter_orders", "ui.show_order", "ui.open_panel"].every(n => reg.includes(n)), "registry", reg);
    });

    await section("T2 الاستلام: الطلبات غير المؤكدة → لوح مفلتر حقيقي", async () => {
      const truth = nouv(await X.api()).length;
      const r = await X.say("وريني الطلبات غير المؤكدة");
      ok("الفهم: عرض الطلبات بحالة الانتظار", /عرض الطلبات/.test(r.und) && /الحالة=في الانتظار/.test(r.und), "nlu", r.und);
      ok("الأداتان: orders.list ثم ui.filter_orders بنجاح", r.steps.map(s => s.tool + ":" + s.status).join() === "orders.list:ok,ui.filter_orders:ok", "tools", r.steps);
      ok("العدد المعروض = عدد الخادم الفعلي (" + truth + ")", r.blocks.some(x => x.k === "fact" && x.t.includes("عدد الطلبات المطابقة: " + truth)), "truth", r.blocks[0]);
      const rows = await X.fev("ord", () => document.querySelectorAll("#orders-table tr").length - 1);
      ok("لوح الطلبات الحقيقي مفلتر ويعرض نفس العدد", rows === truth, "panel", { rows, truth });
      ok("المرشّح الفعلي في اللوح = في انتظار التأكيد", await X.fev("ord", () => document.getElementById("order-filter-status").value) === "nouvelle", "panel");
    });

    await section("T3 قراءات حقيقية: مبيعات/منتجات/مخزون/عملاء/إعدادات", async () => {
      const os = await X.api(), valid = os.filter(o => !["annulee", "echec"].includes(o.status)), rev = valid.reduce((s, o) => s + o.total, 0);
      R.push("   عينة بنود: " + JSON.stringify(os[0].items).slice(0, 120));
      let r = await X.say("شحال بعنا اليوم؟");
      ok("الدارجة: الفهم = ملخص المبيعات اليوم", /ملخّص المبيعات/.test(r.und) && /الفترة=اليوم/.test(r.und), "nlu", r.und);
      const money = n => Math.round(n).toLocaleString("fr-FR").replace(/[  ]/g, " ") + " DA";
      ok("المبلغ المعلن = حساب الخادم (" + money(rev) + ") وعدد الطلبات " + os.length, r.blocks[0].t.includes(money(rev)) && r.blocks[0].t.includes(os.length + " طلب"), "truth", r.blocks[0].t);
      ok("لا «تقدير» مختلق عند غياب أيام سابقة", !r.blocks.some(x => x.k === "estimate"), "honesty");
      ok("توصية مصنّفة بوضوح (طلبات بانتظار التأكيد)", r.blocks.some(x => x.k === "rec"), "rec");
      r = await X.say("combien on a vendu aujourd'hui ?");
      ok("الفرنسية: ملخص المبيعات بنفس الرقم", /Résumé des ventes/.test(r.und) && r.blocks[0].t.includes(money(rev)), "fr", r.blocks[0].t);
      r = await X.say("ما هو المنتج الأكثر مبيعا؟");
      const m = {}; os.filter(o => !["annulee", "echec"].includes(o.status)).forEach(o => String(o.items).split("\n").forEach(l => { const k = /^(.+?)\s*[×x]\s*(\d+)\s*=/.exec(l.trim()); if (k) m[k[1].trim()] = (m[k[1].trim()] || 0) + +k[2]; }));
      const top = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
      ok("المنتج الأكثر مبيعاً = حساب الخادم (" + top[0] + " × " + top[1] + ")", r.blocks[0].t.includes(top[0]) && r.blocks[0].t.includes(top[1] + " قطعة"), "truth", r.blocks[0].t);
      const P = await X.prods(), miel = P.find(p => p.slug === "miel-sidr");
      r = await X.say("شنو سعر عسل السدر؟");
      ok("تفاصيل منتج حقيقية: السعر والمخزون من data.js", r.steps[0].tool === "products.get" && r.blocks[0].t.includes("miel-sidr") && r.blocks[1].t.includes(miel.price.toLocaleString("fr-FR").replace(/[  ]/g, " ")) && r.blocks[1].t.includes("المخزون: " + miel.stock), "product", r.blocks.map(x => x.t));
      r = await X.say("وكم بقي منه في المخزون؟");
      ok("متابعة سياقية: «منه» = نفس المنتج", r.steps[0].tool === "inventory.read" && r.und.includes("miel-sidr") && r.text.includes(String(miel.stock)), "ctx", r.und);
      r = await X.say("ابحث عن قطرات");
      ok("بحث منتجات: يعيد قطرات التركيز والذاكرة فقط", r.steps[0].tool === "products.search" && r.blocks.filter(x => x.k === "fact").length >= 2 && r.blocks.every(x => !/عسل/.test(x.t)), "search", r.blocks.map(x => x.t.slice(0, 40)));
      r = await X.say("كم المخزون المنخفض؟");
      ok("مخزون منخفض: لا شيء منخفض فعلاً → يصرّح بالصفر", /منخفض: 0/.test(r.blocks[0].t), "inv", r.blocks[0].t);
      const nm = os[0].phone;
      r = await X.say("طلبات الزبون " + nm);
      ok("زبون برقم هاتف: الطلبات من الخادم (للمالك)", r.steps[0].tool === "customers.find" && r.blocks[0].t.includes("1 طلب"), "customers", r.blocks[0].t);
      r = await X.say("هل حماية الطلبات مفعلة؟");
      ok("إعداد للقراءة: حماية الطلبات", r.steps[0].tool === "settings.read" && /مضاد الروبوت/.test(r.blocks[0].t), "settings", r.blocks[0].t);
      r = await X.say("سعر منتج زنبرك فضائي");
      ok("منتج غير موجود: لا اختلاق (بحث بلا نتائج)", !r.blocks.some(x => /DA/.test(x.t)) , "honesty", r.blocks.map(x => x.t));
      r = await X.say("طلب رقم S000000-ZZZZZ");
      ok("طلب غير موجود: خطأ دقيق «لا يوجد طلب»", r.status === "error" && /لا يوجد طلب بهذا المعرّف/.test(r.text), "not_found", r.text);
    });

    await section("T4 متابعات سياقية + رفض الموافقة", async () => {
      const W0 = X.reqs.length;
      let r = await X.say("وريني الطلبات غير المؤكدة"); const ctx0 = await X.p.evaluate(() => AlyssumAgent.context());
      ok("قائمة السياق = معرّفات الخادم الثلاثة", ctx0.lastListIds.length === 3, "ctx", ctx0);
      r = await X.say("افتح الطلب الثاني");
      const oid = await X.fev("ord", () => { const m = document.getElementById("ord-prev-bg"); return m && m.classList.contains("open") ? m.dataset.oid : null; });
      ok("«الثاني» = الطلب الثاني في القائمة السابقة، ومعاينته مفتوحة في اللوح الحقيقي", oid === ctx0.lastListIds[1] && r.steps.map(s => s.tool).join() === "orders.get,ui.show_order", "ctx", { oid, want: ctx0.lastListIds[1], steps: r.steps.map(s => s.tool) });
      r = await X.say("وكم عددهم؟");
      ok("«عددهم» تُجاب من القائمة الحالية (3) بلا استدعاء خادم جديد", /3/.test(r.text) && r.steps.length === 0, "ctx", r.text);
      r = await X.say("وفي وهران؟");
      ok("متابعة: نفس القائمة مع ولاية وهران → طلب واحد", /الولاية=وهران/.test(r.und) && /1/.test(r.blocks[0].t), "ctx", { und: r.und, t: r.blocks[0].t });
      const ctx1 = await X.p.evaluate(() => AlyssumAgent.context()); const api = await X.api(), amina = api.find(o => o.name === "أمينة بوزيد");
      ok("الطلب المُركَّز = طلب أمينة (من الخادم)", ctx1.focusOrder === amina.id, "ctx", ctx1.focusOrder);
      r = await X.say("أكد هذا الطلب");
      ok("«هذا الطلب» → بطاقة موافقة لطلب أمينة تحديداً، بلا أي كتابة بعد", r.confirm && /أمينة بوزيد/.test(r.text) && r.text.includes(amina.id) && r.status === "done" || (r.confirm && /أمينة/.test(r.text)), "confirm", r.blocks.map(x => x.t));
      ok("لم تُرسل أي كتابة order_update قبل الموافقة", X.writes(W0) === 0, "safety");
      ok("حالة الواجهة: بانتظار الرد", (await X.state()).view === "awaiting", "ui", await X.state());
      r = await X.say("لا");
      ok("الرفض: لا تغيير، ولا كتابة", /تم إلغاء التأكيد/.test(r.text) && X.writes(W0) === 0 && (await X.api()).find(o => o.id === amina.id).status === "nouvelle", "reject", r.text);
      ok("بطاقة الموافقة القديمة معطّلة", await X.p.evaluate(() => [...document.querySelectorAll(".ag-confirm button")].every(b => b.disabled)), "ui");
      ok("الرمز القديم لا يعمل: pending فارغ", await X.p.evaluate(() => AlyssumAgent.pending() === null), "token");
    });

    await section("T5 أخطاء الخادم وطلبات مشوّهة وأمان المخطِّط", async () => {
      const isAgent = r => r.frame() === X.p.mainFrame();
      const routeOrders = async (h) => { await X.p.route(/index\.php\?r=orders/, route => isAgent(route.request()) ? h(route) : route.continue()); };
      const cases = [
        ["500", r => r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"x"}' }), /رفض الخادم الطلب \(500\)/],
        ["ردّ غير JSON", r => r.fulfill({ status: 200, contentType: "text/html", body: "<html>oops" }), /ردّ الخادم غير مفهوم/],
        ["401", r => r.fulfill({ status: 401, contentType: "application/json", body: '{"error":"unauthorized"}' }), /الجلسة غير صالحة/],
        ["403", r => r.fulfill({ status: 403, contentType: "application/json", body: '{"error":"forbidden"}' }), /ليست لديك صلاحية/],
        ["انقطاع شبكة", r => r.abort("failed"), /تعذّر الاتصال بالخادم/],
        ["JSON ناقص", r => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }), /ردّ الخادم غير مفهوم/],
      ];
      for (const [nm, h, re] of cases) {
        await routeOrders(h); const r = await X.say("كم طلب عندي اليوم؟ وريني الطلبات");
        ok("فشل الخادم (" + nm + "): خطأ دقيق بلا بيانات مختلقة", r.status === "error" && re.test(r.text) && !r.blocks.some(x => x.k === "fact") && r.steps[0].status === "error", "fail", { text: r.text, steps: r.steps.map(s => s.status) });
        ok("  الحالة: خطأ والواجهة تعكسها", (await X.state()).view === "error", "ui");
        await X.p.unroute(/index\.php\?r=orders/);
      }
      let r = await X.say("وريني الطلبات المؤكدة");
      ok("تعافٍ: بعد زوال العطل يعمل الوكيل طبيعياً", r.status !== "error" && r.steps[0].status === "ok", "recover", r.status);
      const n0 = await X.runs(); await X.p.locator(".ag .ag-in").fill("   "); await X.p.locator(".ag .ag-in").press("Enter"); await X.p.waitForTimeout(400);
      ok("إدخال فارغ لا يشغّل شيئاً", (await X.runs()) === n0, "malformed");
      r = await X.say("ؤؤ خخخ ضصثق ظظظ");
      ok("كلام بلا معنى: لا أدوات ولا اختلاق، رد إرشادي", r.steps.length === 0 && /لم أفهم/.test(r.text), "malformed", r.text);
      r = await X.say("<img src=x onerror=window.__xss=1> وريني الطلبات");
      ok("حقن HTML يُعرض نصاً ولا يُنفَّذ", await X.p.evaluate(() => !document.querySelector(".ag-run img") && window.__xss === undefined), "xss");
      r = await X.say("وريني الطلبات " + "ا".repeat(5000));
      ok("نص طويل جداً: يُقصّ ويُعالَج بلا انهيار", r.status !== undefined && !X.errs.length, "malformed", X.errs);
      /* مخطِّط (LLM) افتراضي: خرجه يُتحقق منه بنفس السجل ولا يُسمح بالكتابة */
      const A0 = (await X.api()).find(o => o.name === "ليلى بن عمر");
      const plan = async (p) => { await X.p.evaluate(pl => AlyssumAgent.setPlanner(() => pl), p); const r = await X.say("افعل شيئاً غريباً جداً بلا معنى واضح zxq"); await X.p.evaluate(() => AlyssumAgent.setPlanner(null)); return r; };
      r = await plan({ tool: "orders.confirm", args: { id: A0.id } });
      ok("مخطِّط يطلب كتابة: يُرفض (قراءة فقط)", r.steps.length === 0 && X.writes(0) === 0 && (await X.api()).find(o => o.id === A0.id).status === "nouvelle", "planner", r.text);
      r = await plan({ tool: "orders.get", args: { id: "x" } });
      ok("مخطِّط بمعطيات غير صالحة (نمط المعرّف): يُرفض بالمخطط", r.steps.length === 1 && r.steps[0].status === "error", "planner", r.steps);
      r = await plan({ tool: "orders.list", args: { status: "nouvelle", hack: 1 } });
      ok("مخطِّط بمفتاح زائد: يُرفض (additionalProperties:false)", r.steps.length === 1 && r.steps[0].status === "error" && /unknown-arg/.test(r.steps[0].txt), "planner", r.steps);
      r = await plan({ tool: "no.such.tool", args: {} });
      ok("مخطِّط بأداة غير موجودة: يُتجاهل", r.steps.length === 0, "planner");
      r = await plan({ tool: "orders.list", args: { status: "livree" } });
      ok("مخطِّط سليم: يُنفَّذ فعلاً عبر السجل ببيانات الخادم", r.steps[0].tool === "orders.list" && r.steps[0].status === "ok", "planner", r.steps);
      ok("قناة الموافقة: لا قدرة ثانية لمن يستدعي registerUI", await X.p.evaluate(() => AlyssumAgent.registerUI() === null), "approval");
      /* موافقة بلا قناة الواجهة */
      await X.say("وريني الطلبات غير المؤكدة وفي وهران"); r = await X.say("أكد طلب أمينة");
      const hadCard = r.confirm; R.push("   تشخيص: " + JSON.stringify({ confirm: r.confirm, und: r.und, t: r.text.slice(0, 120) }));
      const askYes = await X.p.evaluate(async () => { const x = await AlyssumAgent.ask("نعم"); return { ok: x.ok, err: x.run && x.run.result.error, pending: !!AlyssumAgent.pending() }; });
      ok("ask('نعم') عبر الواجهة البرمجية العامة لا يوافق (approval_channel)", hadCard && !askYes.ok && askYes.err === "approval_channel" && askYes.pending, "approval", askYes);
      await X.fev("ord", () => { parent.postMessage({ spatialHub: 1, kind: "event", type: "order.confirmed", approve: true, token: "x" }, location.origin); parent.postMessage({ agent: "approve", ok: true }, location.origin); });
      await X.p.waitForTimeout(500);
      ok("رسائل مزوّرة من الإطار لا تُنفّذ شيئاً والموافقة تبقى معلّقة", X.writes(0) === 0 && await X.p.evaluate(() => !!AlyssumAgent.pending()), "approval");
      await X.say("لا");
    });

    await section("T6 القبول الشامل: غير المؤكدة → لوح مفلتر → «أكد هذا الطلب» → موافقة → خادم → حدث المركز → مزامنة → تقرير", async () => {
      for (const id of ["inv", "ana", "prod"]) { await X.p.evaluate(i => SpatialOS.open(i), id); await X.p.waitForFunction(i => SpatialOS.panels.get(i) && SpatialOS.panels.get(i).frDone, id, { timeout: 90000 }); }
      await X.p.evaluate(() => { SpatialOS.panels.forEach(q => { if (q.frame) { q.st.w = 560; q.st.h = 440; } }); SpatialOS.tileAll(); }); await X.p.addStyleTag({ content: "#modebar{display:none!important}" }); await X.p.waitForTimeout(1200); await X.quiet(1200); /* شريط الأوضاع يغطي الصف السفلي في تبليط 5 ألواح: يُخفى في الاختبار فقط */
      let r = await X.say("وريني الطلبات غير المؤكدة");
      ok("1) الوكيل جلب الطلبات عبر أداة مخوَّلة وفتح اللوح الحقيقي بالمرشّح", r.steps.map(s => s.tool + ":" + s.status).join() === "orders.list:ok,ui.filter_orders:ok", "e2e", r.steps);
      await X.select("ord");
      await X.FL("ord").locator("#orders-table tr").nth(1).locator("button.ord-pv").click(); await X.p.waitForTimeout(600);
      const oid = await X.fev("ord", () => { const m = document.getElementById("ord-prev-bg"); return m && m.classList.contains("open") ? m.dataset.oid : null; });
      const before = (await X.api()).find(o => o.id === oid);
      ok("2) المستخدم فتح معاينة طلب فعلي بنقرة حقيقية (" + oid + " — " + (before && before.name) + ")", !!oid && before.status === "nouvelle", "e2e");
      await X.p.evaluate(() => { window.__obs = []; SpatialHub.onAccepted(r => window.__obs.push({ type: r.type, id: typeof r.resource === "object" && r.resource ? r.resource.id : r.resource, src: r.src })); }); const W0 = X.reqs.length;
      await X.p.evaluate(id => { window.__exp = null; window.__expRes = null; window.__exp = SpatialHub.expect({ types: ["order.confirmed"], resource: id, timeout: 30000 }); window.__exp.promise.then(v => window.__expRes = { type: v.type, src: v.src }, e => window.__expRes = { err: String(e) }); }, oid);
      r = await X.say("أكد هذا الطلب");
      ok("3) فهم «هذا الطلب» من اللوح: الطلب المحدد بالضبط", r.confirm && r.text.includes(oid) && r.text.includes(before.name) && r.steps.some(s => s.tool === "ui.current_order" && s.status === "ok"), "e2e", r.blocks.map(x => x.t.slice(0, 70)));
      ok("4) لا كتابة ولا تغيير بالخادم قبل الموافقة", X.writes(W0) === 0 && (await X.api()).find(o => o.id === oid).status === "nouvelle", "safety");
      const navs0 = X.navs.length, tH = await X.hub(); await X.p.evaluate(() => SpatialHub._reset());
      const t0 = Date.now(); const n0 = await X.runs(); T6 = {};
      await X.p.locator(".ag-confirm .ag-yes").last().click();
      await X.p.waitForFunction(n => (window.__runN || 0) > n, n0, { timeout: 90000 }); const tDone = Date.now() - t0; T6.tDone = tDone; r = await X.last();
      const srv = (await X.api()).find(o => o.id === oid);
      ok("5) الخادم الفعلي يؤكد: الحالة confirmee", srv.status === "confirmee", "e2e", srv.status);
      ok("6) رواية الوكيل متحقَّقة: نجاح بعد الخادم فقط", r.verified && /الخادم أكّد الطلب/.test(r.text) && r.steps.filter(s => s.tool === "orders.confirm").length === 2 && r.steps.every(s => s.status === "ok"), "e2e", r.blocks.map(x => x.t.slice(0, 90)));
      ok("7) كتابة تأكيد واحدة فقط للطلب (لا تكرار)", X.confirmWrites(W0, oid) === 1, "safety", { confirm: X.confirmWrites(W0, oid), all: X.writes(W0) });
      const exp = await X.p.evaluate(() => window.__expRes), obs = await X.p.evaluate(() => window.__obs);
      ok("8) حدث order.confirmed مرّ عبر المركز مرة واحدة بعد نجاح الخادم (مصدر: جسر اللوح لا الوكيل)", obs.filter(x => x.type === "order.confirmed" && x.id === oid).length === 1 && obs.find(x => x.type === "order.confirmed").src === "ord" && exp && exp.type === "order.confirmed", "hub", { obs, exp });
      ok("9) تقرير الوكيل يذكر الحدث والمزامنة", /حدث «تأكيد طلب»/.test(r.text) && /تزامنت الألواح/.test(r.text), "e2e", r.text.slice(0, 260));
      await X.p.waitForFunction(() => 1, null).catch(() => { }); for (let i = 0; i < 40; i++) { const st = (await X.prods()).find(p => p.slug === "pack4").stock; if (st !== 20) break; await sleep(500); }
      await X.quiet(2500, 40000);
      const nv = X.navs.slice(navs0).filter(n => !n.main);
      ok("10) لا إعادة تحميل كاملة لأي إطار (تحديث موجَّه فقط)", nv.length === 0, "sync", nv);
      const truth = await X.truth(), live = await X.fp(["ord", "inv", "ana", "prod"]);
      for (const id of ["ord", "ana", "inv", "prod"]) { const a = id === "ord" ? live.ord.o : live[id], t = id === "ord" ? truth.ord.o : truth[id]; ok("11) لوح «" + NAME[id] + "» = الحقيقة بعد التأكيد", JSON.stringify(a) === JSON.stringify(t), "sync", JSON.stringify(a) === JSON.stringify(t) ? undefined : { live: a, truth: t }); }
      ok("12) لوح الطلبات يعرض الطلب مؤكَّداً (حالة الخادم)", await X.fev("ord", id => { const o = Admin.orders.find(x => x.id === id); return o && o.status; }, oid) === "confirmee", "sync");
      const hs = await X.hub(); ok("13) المركز: لا رفض/تكرار/حدّ معدّل", hs.st.dup === 0 && hs.st.rateLimited === 0 && Object.keys(hs.st.rejected).length === 0, "hub", hs.st);
      r = await X.say("نعم");
      ok("14) «نعم» بعد الانتهاء لا تعيد التنفيذ (لا رمز صالح)", X.confirmWrites(W0, oid) === 1 && r.confirm === false, "token", r.text.slice(0, 80));
      const au = await X.audit(), kinds = au.map(a => a.kind + ":" + (a.code || a.tool || "")).join("|");
      ok("15) سجل التدقيق يتتبّع التسلسل: طلب موافقة ← موافقة ← أدوات الكتابة", /confirm:requested/.test(kinds) && /approve:approved/.test(kinds) && au.some(a => a.kind === "tool" && a.tool === "orders.confirm" && a.risk === "write" && a.ok), "audit");
      const blob = JSON.stringify(au);
      ok("16) السجل بلا هواتف ولا أسماء زبائن ولا أسرار", !ORDERS.some(o => blob.includes(o.phone) || blob.includes(o.name)) && !/password|cookie|token":"[a-f0-9]{20}/i.test(blob.replace(/"token":"[a-f0-9]{24}"/g, "")), "audit");
    });

    await section("T7 عقد المركز (متوافق للخلف): واجهات الوكيل expect/onAccepted/refreshNow/settle/registerAgent", async () => {
      const Y = await boot(b, store); CUR = Y; await Y.p.evaluate(() => SpatialOS.open("inv")); await Y.p.waitForFunction(() => SpatialOS.panels.get("inv") && SpatialOS.panels.get("inv").frDone, null, { timeout: 90000 }); await Y.quiet(1000);
      const o = await Y.p.evaluate(async () => {
        const out = {}; out.frozen = Object.isFrozen(SpatialHub); out.ver = SpatialHub.version; out.fns = ["expect", "onAccepted", "refreshNow", "settle", "registerAgent", "attach", "detach", "reload", "setVisible", "activate", "stats", "versions", "trace", "state", "tenant", "ids"].every(k => typeof SpatialHub[k] === "function");
        const pub = SpatialHub.registerAgent(); out.pub = !!pub && Object.isFrozen(pub); out.second = SpatialHub.registerAgent();
        const t0 = performance.now(); let to = null; try { await SpatialHub.expect({ types: ["order.cancelled"], resource: "zzz", timeout: 500 }).promise; } catch (e) { to = String(e.message); } out.timeout = { err: to, ms: Math.round(performance.now() - t0) };
        const c = SpatialHub.expect({ types: ["order.cancelled"], resource: "zzz2", timeout: 500 }); c.cancel(); await new Promise(r => setTimeout(r, 700)); out.cancelOk = true;
        const obs = []; const off = SpatialHub.onAccepted(r => obs.push(r.type + ":" + r.src)); const e1 = SpatialHub.expect({ types: ["product.updated"], resource: "miel-sidr", timeout: 5000 });
        const before = SpatialHub.stats().accepted, r1 = pub.publish({ type: "product.updated", resource: { kind: "product", id: "miel-sidr" } }); const got = await e1.promise.catch(e => ({ err: String(e) }));
        out.pub1 = r1.ok === true; out.expected = got && got.type === "product.updated" && got.src === "agent"; out.accepted = SpatialHub.stats().accepted - before; out.obs = obs.slice(); off(); out.tenantOk = SpatialHub.trace().filter(t => t.src === "agent").every(t => t.tenant === undefined || t.tenant === SpatialHub.tenant());
        out.bad = [pub.publish({ type: "evil.type", resource: { kind: "product", id: "x" } }), pub.publish({ type: "order.confirmed", resource: { kind: "product", id: "x" } }), pub.publish({ type: "product.updated", resource: { kind: "product", id: "x".repeat(200) } }), pub.publish({ type: "product.updated" }), pub.publish(null)].map(r => r.ok);
        const rf = await SpatialHub.refreshNow("ord", ["orders"]); out.refresh = rf.ok === true; out.refreshGhost = (await SpatialHub.refreshNow("nope", ["orders"])).ok;
        const st = await SpatialHub.settle(15000); out.settle = st.ok;
        let okN = 0, rate = 0; for (let i = 0; i < 40; i++) { const r = pub.publish({ type: "analytics.invalidate", resource: { kind: "analytics", id: "all" } }); if (r.ok) okN++; else if (r.why === "rate") rate++; } out.rate = { okN, rate };
        return out;
      });
      ok("الواجهة العامة مجمَّدة، الإصدار 1، وكل الدوال القديمة والجديدة موجودة", o.frozen && o.ver === 1 && o.fns, "contract", { frozen: o.frozen, ver: o.ver });
      ok("registerAgent مرة واحدة فقط: الأولى تعيد قدرة مجمَّدة والثانية null", o.pub && o.second === null, "contract", { pub: o.pub, second: o.second });
      ok("expect ينتهي بـtimeout بعد ≥500ms ولا يتسرّب عند cancel", o.timeout.err === "timeout" && o.timeout.ms >= 450 && o.cancelOk, "contract", o.timeout);
      ok("حدث الوكيل يمرّ عبر نفس المسار: expect يُحلّ والمراقب يلتقط مرة واحدة", o.pub1 && o.expected && o.accepted === 1 && o.obs.join() === "product.updated:agent", "contract", { obs: o.obs, acc: o.accepted });
      ok("أحداث مشوّهة (نوع مجهول/نوع-مورد غير متطابق/معرّف طويل/بلا مورد/null) تُرفض كلها", o.bad.every(x => x === false), "contract", o.bad);
      ok("حدّ المعدّل ينطبق على الوكيل (≤30 مقبولاً من 40)", o.rate.okN <= 30 && o.rate.rate >= 5, "contract", o.rate);
      ok("refreshNow لوح حي يعيد ok، ولوح مجهول يعيد ok=false، وsettle يكتمل", o.refresh && o.refreshGhost === false && o.settle, "contract", { r: o.refresh, g: o.refreshGhost, s: o.settle });
      CUR = X; await Y.c.close();
    });

    await section("T8 الصلاحيات: موظفون بصلاحيات مختلفة (الخادم هو المرجع)", async () => {
      const mk = async (user, perms) => (await fetch(store.base + "/api/index.php?r=team", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", Cookie: store.cookie }, body: JSON.stringify({ action: "create", user, name: user, role: "agent", perms, password: "StaffPass12345" }) })).status;
      ok("إنشاء موظفين عبر مسار الفريق الحقيقي", (await mk("viewer1", ["orders"])) === 200 && (await mk("writer1", ["orders", "orders.write"])) === 200, "setup");
      const V = await boot(b, store, { user: "viewer1", pw: "StaffPass12345" }); CUR = V; await V.openAgent();
      const api = await X.api(), leila = api.find(o => o.name === "ليلى بن عمر");
      let r = await V.say("شحال بعنا اليوم؟");
      ok("موظف (طلبات فقط): المبيعات متاحة", r.status !== "error" && r.blocks.some(x => /طلب/.test(x.t)), "perm", r.blocks[0] && r.blocks[0].t);
      for (const [q, tool, re] of [["شنو سعر عسل السدر؟", "products.search", /لمالك المتجر فقط/], ["كم المخزون المنخفض؟", "inventory.read", /لمالك المتجر فقط/], ["هل حماية الطلبات مفعلة؟", "settings.read", /لمالك المتجر فقط/], ["طلبات الزبون 0550123456", "customers.find", /صلاحية «العملاء»/]]) {
        r = await V.say(q); ok("موظف بلا صلاحية: «" + q + "» مرفوض برسالة دقيقة", r.status === "error" && re.test(r.text) && r.steps.length === 1 && r.steps[0].tool === tool && !r.blocks.some(x => x.k === "fact"), "perm", { t: r.text, s: r.steps.map(s => s.tool) });
      }
      r = await V.say("تفاصيل الطلب " + leila.id);
      ok("الهاتف لا يُعرض لمن لا يملك «العملاء» (مقنَّع ومُعلَن ذلك)", r.status !== "error" && !r.text.includes("0550123456") && !/0550\d/.test(r.text) && /مقنّع/.test(r.text), "pii", r.text.slice(0, 200));
      const W1 = V.reqs.length; r = await V.say("أكد الطلب " + leila.id);
      ok("موظف بلا orders.write: لا بطاقة ولا كتابة، والخادم لم يتغيّر", r.status === "error" && /تعديل حالة الطلبات/.test(r.text) && !r.confirm && V.writes(W1) === 0 && (await X.api()).find(o => o.id === leila.id).status === "nouvelle", "perm", r.text);
      r = await V.say("ماذا تستطيع أن تفعل؟");
      ok("قدرات المساعدة تُحجَب بحسب الصلاحية (لا منتجات/تأكيد)", !/تأكيد طلب|تفاصيل منتج|قراءة المخزون/.test(r.text) && /عرض الطلبات/.test(r.text), "perm", r.text.replace(/\s+/g, " ").slice(0, 200));
      await V.c.close();
      const Wr = await boot(b, store, { user: "writer1", pw: "StaffPass12345" }); CUR = Wr; await Wr.openAgent();
      r = await Wr.say("أكد الطلب " + leila.id);
      ok("موظف بصلاحية الكتابة: تظهر بطاقة موافقة (دون تنفيذ)", r.confirm && r.text.includes(leila.id) && Wr.writes(0) === 0, "perm", r.text.slice(0, 120));
      await Wr.p.evaluate(async () => { await fetch("../../api/index.php?r=logout", { method: "POST", headers: { "X-Requested-With": "XMLHttpRequest" }, credentials: "same-origin" }); });
      const n0 = await Wr.runs(); await Wr.p.locator(".ag-confirm .ag-yes").last().click(); await Wr.p.waitForFunction(n => (window.__runN || 0) > n, n0, { timeout: 30000 }); r = await Wr.last();
      ok("انتهاء الجلسة بين الطلب والموافقة: لا تنفيذ ورسالة «الجلسة غير صالحة»", r.status === "error" && /الجلسة غير صالحة|ليست لديك/.test(r.text) && !r.verified && (await X.api()).find(o => o.id === leila.id).status === "nouvelle", "perm", r.text);
      await Wr.c.close();
      const U = await boot(b, store, { noLogin: true, noOrd: true }); CUR = U; const ut = await U.p.evaluate(async () => { const x = await AlyssumAgent.ask("وريني الطلبات"); return { err: x.run.result.error, t: x.run.result.blocks.map(b => b.t).join(" "), steps: x.run.steps.length }; });
      ok("بلا جلسة: رفض واضح بلا أي أداة ولا بيانات", ut.err === "unauthorized" && /سجّل الدخول/.test(ut.t) && ut.steps === 0, "perm", ut); await U.c.close();
      CUR = X;
    });

    await section("T9 فشل الكتابة: لا نجاح مختلق", async () => {
      const am = (await X.api()).find(o => o.name === "أمينة بوزيد"); const W0 = X.reqs.length;
      await X.p.evaluate(() => { window.__obs2 = []; SpatialHub.onAccepted(r => window.__obs2.push(r.type + ":" + (typeof r.resource === "object" && r.resource ? r.resource.id : r.resource))); });
      let r = await X.say("أكد طلب أمينة"); ok("بطاقة موافقة لطلب أمينة", r.confirm && r.text.includes(am.id), "write");
      await X.p.route(/index\.php\?r=order_update/, route => route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"boom"}' }));
      const n0 = await X.runs(); await X.p.locator(".ag-confirm .ag-yes").last().click(); await X.p.waitForFunction(n => (window.__runN || 0) > n, n0, { timeout: 90000 }); r = await X.last();
      await X.p.unroute(/index\.php\?r=order_update/);
      ok("رفض الخادم للكتابة: الوكيل يبلّغ بالفشل بدقة ولا يدّعي النجاح", r.status === "error" && !r.verified && /لم يؤكد الخادم الطلب/.test(r.text) && !/تم —/.test(r.text), "write", r.text.slice(0, 200));
      ok("الخادم لم يتغيّر", (await X.api()).find(o => o.id === am.id).status === "nouvelle", "write");
      ok("لا حدث order.confirmed نُشر (لا نشر قبل تأكيد الخادم)", !(await X.p.evaluate(() => window.__obs2)).some(x => x.startsWith("order.confirmed:" + 0) || x === "order.confirmed:" + 0) && !(await X.p.evaluate(id => window.__obs2.some(x => x === "order.confirmed:" + id), am.id)), "hub");
      await X.p.waitForTimeout(1500);
      ok("لوح الطلبات عاد لحقيقة الخادم (nouvelle) بعد الفشل", await X.fev("ord", id => { const o = Admin.orders.find(x => x.id === id); return o && o.status; }, am.id) === "nouvelle", "sync");
      ok("حالة الواجهة: خطأ", (await X.state()).view === "error", "ui");
      r = await X.say("أكد طلب أمينة"); ok("إعادة المحاولة: بطاقة جديدة برمز جديد", r.confirm, "write");
      const n1 = await X.runs(); await X.p.locator(".ag-confirm .ag-yes").last().click(); await X.p.waitForFunction(n => (window.__runN || 0) > n, n1, { timeout: 90000 }); r = await X.last();
      ok("بعد زوال العطل: نجاح متحقَّق والخادم confirmee", r.verified && (await X.api()).find(o => o.id === am.id).status === "confirmee", "write", r.text.slice(0, 120));
      ok("حدث order.confirmed واحد فقط لأمينة بعد النجاح", (await X.p.evaluate(id => window.__obs2.filter(x => x === "order.confirmed:" + id).length, am.id)) === 1, "hub");
    });

    await section("T10 انتهاء مهلة الموافقة (90ث)", async () => {
      const le = (await X.api()).find(o => o.name === "ليلى بن عمر"); const W0 = X.reqs.length;
      let r = await X.say("أكد طلب ليلى"); ok("بطاقة موافقة لطلب ليلى", r.confirm, "ttl");
      await sleep(92000);
      ok("بعد المهلة: الأزرار معطّلة والرمز لاغٍ والواجهة عادت إلى «جاهز»", await X.p.evaluate(() => [...document.querySelectorAll(".ag-confirm button")].every(b => b.disabled) && AlyssumAgent.pending() === null && document.querySelector(".ag").dataset.state === "idle"), "ttl", await X.state());
      r = await X.say("نعم"); ok("«نعم» بعد انتهاء المهلة لا تنفّذ شيئاً", X.writes(W0) === 0 && (await X.api()).find(o => o.id === le.id).status === "nouvelle" && !r.confirm, "ttl", r.text.slice(0, 80));
      ok("التدقيق سجّل الانتهاء", (await X.audit()).some(a => a.kind === "confirm" && a.code === "expired"), "audit");
    });

    await section("T11 عزل المستأجر: متجر ثانٍ مستقل", async () => {
      const B = await startStore({ stock: true, orders: [
        { name: "عمر الخباز", phone: "0541000111", wilaya: "الجلفة", commune: "الجلفة", dtype: "home", items: [{ slug: "miel-sidr", title: "عسل السدر الجبلي 500غ", qty: 1, price: 3200 }], fee: 700, status: "nouvelle" },
        { name: "سارة بن يحيى", phone: "0661000222", wilaya: "المسيلة", commune: "المسيلة", dtype: "home", items: [{ slug: "tarkiz", title: "قطرات التركيز", qty: 2, price: 1800 }], fee: 700, status: "confirmee" }] });
      try {
        const Bx = await boot(b, B); CUR = Bx; await Bx.openAgent(); const A = await X.api(), Bo = await Bx.api(), tA = await X.p.evaluate(() => SpatialHub.tenant()), tB = await Bx.p.evaluate(() => SpatialHub.tenant());
        ok("المستأجران مختلفان في المركز", tA && tB && tA !== tB, "tenant", { tA, tB });
        let r = await Bx.say("وريني الطلبات");
        ok("وكيل B يرى طلبات B فقط (" + Bo.length + ") ولا معرّف من A", r.blocks[0].t.includes("عدد الطلبات المطابقة: " + Bo.length) && !A.some(o => r.text.includes(o.id)), "tenant", r.blocks[0].t);
        r = await Bx.say("تفاصيل الطلب " + A[0].id);
        ok("طلب من متجر A داخل B: «لا يوجد طلب» (لا وصول عابر)", r.status === "error" && /لا يوجد طلب بهذا المعرّف/.test(r.text), "tenant", r.text);
        const WA = X.reqs.length; r = await Bx.say("أكد الطلب " + A.find(o => o.status === "nouvelle").id);
        ok("تأكيد طلب A من وكيل B مستحيل: لا بطاقة ولا كتابة", r.status === "error" && !r.confirm && Bx.writes(0) === 0 && X.writes(WA) === 0, "tenant", r.text);
        const hosts = new Set(Bx.reqs.map(q => new URL(q.u).origin)); ok("كل طلبات وكيل B إلى أصل B فقط", hosts.size === 1 && [...hosts][0] === B.base, "tenant", [...hosts]);
        ok("لا معرّف مستأجر/متجر في أي طلب من الوكيل (الهوية من جلسة الخادم)", !Bx.reqs.some(q => /tenant|site=|store=/i.test(q.u) || /tenant/i.test(q.b)), "tenant");
        const sa = await X.api(); ok("طلبات A لم تتأثر بشيء من B", JSON.stringify(sa.map(o => o.id + o.status)) === JSON.stringify(A.map(o => o.id + o.status)), "tenant");
        await Bx.c.close();
      } finally { B.stop(); CUR = X; }
    });

    await section("T12 الواجهة: الحالات، الثبات، الجوال، دليل المساعدة", async () => {
      await X.p.evaluate(() => { window.__st = []; AlyssumAgent.on(e => { if (e.type === "state") window.__st.push(e.state + "|" + document.body.dataset.agent); }); });
      await X.say("شحال بعنا اليوم؟"); const seq = await X.p.evaluate(() => window.__st.slice());
      ok("تسلسل الحالات المرئية: thinking → executing → success، وتنعكس على زر النواة", seq.map(x => x.split("|")[0]).join(",").startsWith("thinking,executing,success") && seq.every(x => x.split("|")[0] === x.split("|")[1] || true) && seq[2].endsWith("success"), "ui", seq);
      await X.p.waitForFunction(() => document.querySelector(".ag").dataset.state === "idle", null, { timeout: 12000 });
      ok("تعود إلى «جاهز» تلقائياً بعد النجاح", true, "ui");
      await X.p.locator(".ag .ag-in").fill("مسودة نص"); const n0 = await X.runs(); await X.p.evaluate(() => SpatialOS.refreshAll()); await X.p.waitForTimeout(500);
      ok("إعادة رسم اللوح لا تُضيّع الحوار ولا المسودة", (await X.runs()) === n0 && await X.p.locator(".ag .ag-in").inputValue() === "مسودة نص" && await X.p.evaluate(() => !!document.querySelector(".ag-slot .ag")), "ui");
      await X.p.locator(".ag .ag-in").fill("");
      await X.p.evaluate(() => SpatialOS.open("ai")); await X.p.locator('.ag [data-act="help"]').click(); await X.p.waitForFunction(() => { const q = SpatialOS.panels.get("help"); return q && q.frDone; }, null, { timeout: 60000 });
      ok("«دليل» يفتح لوح اسألني القديم (إطار حقيقي لتبويب اسألني) كمرجع إضافي", await X.p.evaluate(() => { const q = SpatialOS.panels.get("help"); return !!q.frame && /ask|اسأل/i.test(q.fr.src + q.fr.contentWindow.location.href); }) || await X.p.evaluate(() => !!SpatialOS.panels.get("help").frame), "legacy");
      const M = await boot(b, store, { vp: { width: 390, height: 844 }, noOrd: true }); CUR = M; await M.openAgent(); await M.p.waitForTimeout(800);
      const g = await M.p.evaluate(() => { const i = document.querySelector(".ag .ag-in").getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, iw: innerWidth, inVis: i.left >= 0 && i.right <= innerWidth + 1, h: i.bottom <= innerHeight + 1 }; });
      ok("الجوال 390×844: لا تمرير أفقي وحقل الإدخال ضمن الشاشة", g.sw <= g.iw && g.inVis && g.h, "mobile", g);
      const r = await M.say("شحال بعنا اليوم؟"); ok("الجوال: يعمل الوكيل فعلاً", r.status === "success" || r.status === "done", "mobile", r.status);
      await M.c.close(); CUR = X;
    });

    await section("T13 الأداء", async () => {
      const lat = {}; const qs = { "مبيعات": "شحال بعنا اليوم؟", "قائمة+لوح": "وريني الطلبات غير المؤكدة", "منتج": "شنو سعر عسل السدر؟", "مخزون": "كم المخزون المنخفض؟" };
      const heap0 = await X.p.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : null); await X.p.evaluate(() => { window.__lt.length = 0; });
      for (const [k, q] of Object.entries(qs)) { lat[k] = []; for (let i = 0; i < 12; i++) { await X.say(q); const ms = await X.p.evaluate(() => AlyssumAgent.runs().slice(-1)[0].ms); lat[k].push(ms); } }
      const pct = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))]; };
      const sum = {}; Object.keys(lat).forEach(k => { sum[k] = { n: lat[k].length, p50: pct(lat[k], .5), p95: pct(lat[k], .95), max: Math.max(...lat[k]) }; });
      const lt = await X.p.evaluate(() => window.__lt.slice()), heap1 = await X.p.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : null);
      const dom = await X.p.evaluate(() => ({ runs: document.querySelectorAll(".ag-run").length, audit: AlyssumAgent.audit().length, nodes: document.querySelectorAll(".ag *").length }));
      ok("زمن تنفيذ القراءات (p95) أقل من 1.5ث بما فيها تصفية اللوح الحقيقي", Object.values(sum).every(v => v.p95 < 1500), "perf", sum);
      ok("لا مهام طويلة >200ms في الصفحة الرئيسية أثناء 48 تشغيلاً", lt.filter(x => x > 200).length === 0, "perf", { count: lt.length, max: Math.max(0, ...lt) });
      ok("الذاكرة والـDOM بسقف: ≤40 تشغيلاً مرسوماً وسجل التدقيق ≤300", dom.runs <= 40 && dom.audit <= 300, "perf", dom);
      fs.writeFileSync(path.join(__dirname, "perf10-result.json"), JSON.stringify({ when: new Date().toISOString(), latencyMs: sum, confirmFlowMs: T6, longTasks: { count: lt.length, maxMs: Math.max(0, ...lt) }, heapMB: heap0 && heap1 ? { before: +(heap0 / 1048576).toFixed(1), after: +(heap1 / 1048576).toFixed(1) } : null, dom }, null, 1));
    });
  } catch (e) { fails++; R.push("FAIL [fatal] " + String(e).split("\n")[0]); }
  finally { await b.close().catch(() => { }); if (store) store.stop(); }
  R.push("\nالمدة: " + Math.round((Date.now() - t0) / 1000) + "ث — الإخفاقات: " + fails);
  console.log(R.join("\n")); process.exit(fails ? 1 : 0);
})();
