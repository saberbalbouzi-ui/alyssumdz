/* المرحلة 12B / WS4 — تجميد الألواح المصغّرة وتفريغها بلا فقد حالة (ألواح iframe حقيقية من admin.html على متجر PHP محلي معزول).
   يتحقق: التجميد الخفيف الفوري وعكسه، التفريغ لوح نظيف فقط، حفظ/استعادة (تبويب/تمرير/فلاتر)، عدم تفريغ لوح فيه حقل معدَّل أو تبويب مختلف، حداثة البيانات بعد الاستعادة،
   مزامنة Hub، تعطيل ?discard=0، وعدم أخطاء صفحة. التفريغ يُسرَّع بـ?discard=4000 (الافتراضي 60000). التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/phase12b-panels.js */
const fs = require("fs"), path = require("path"); const { startStore } = require("./harness"); const { boot, launch, sleep } = require("./lib-boot");
const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push({ n, pass: !!c, x }); console.log((c ? "PASS " : "FAIL ") + n + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 240) : "")); };
(async () => {
  const t0 = Date.now(); const store = await startStore({ stock: true }), b = await launch(null); let X = null, Y = null;
  try {
    X = await boot(b, store, { tier: "high", noOrd: true, query: "q=3&discard=4000" }); const p = X.p;
    const openP = async ids => { await p.evaluate(ids => ids.forEach(i => SpatialOS.open(i)), ids); await p.waitForFunction(ids => ids.every(i => { const q = SpatialOS.panels.get(i); return q && q.frDone; }), ids, { timeout: 120000 }); };
    const st = id => p.evaluate(id => { const q = SpatialOS.panels.get(id); if (!q) return null; let hid = null, cls = null, src = null; try { const d = q.fr.contentWindow.document; hid = d.hidden; cls = d.documentElement.classList.contains("sp-susp"); src = q.fr.contentWindow.location.href; } catch (_) { } return { min: !!q.min, susp: !!q.suspended, discarded: !!q.discarded, skipped: q.discardSkipped || 0, frDone: !!q.frDone, hid, cls, src: /about:blank/.test(String(src)) ? "blank" : (/admin/.test(String(src)) ? "admin" : String(src)) }; }, id);
    const minimize = id => p.evaluate(id => SpatialOS.panels.get(id).el.querySelector(".pn-min").click(), id);
    const restore = async id => { await p.evaluate(id => SpatialOS.open(id), id); await p.waitForFunction(id => { const q = SpatialOS.panels.get(id); return q && !q.min && q.frDone; }, id, { timeout: 90000 }); await sleep(800); };
    const inFrame = (id, fn, arg) => p.evaluate(([id, src, arg]) => { const q = SpatialOS.panels.get(id), w = q.fr.contentWindow; return w.eval("(" + src + ")")(arg); }, [id, fn.toString(), arg]);
    await openP(["ord", "prod"]); await p.evaluate(() => { SpatialOS.panels.forEach(q => { if (q.frame) { q.st.w = 520; q.st.h = 420; } }); SpatialOS.tileAll(); });
    /* 1) تجميد خفيف فوري وعكسه */
    await minimize("ord"); await sleep(700); let s = await st("ord");
    ok("تجميد خفيف فوري عند التصغير: document.hidden=true داخل الإطار وصنف sp-susp", s.min && s.susp && s.hid === true && s.cls === true && !s.discarded, s);
    await restore("ord"); s = await st("ord");
    ok("الفتح قبل انقضاء المهلة: يعود كل شيء (hidden=false، بلا sp-susp، بلا إعادة تحميل)", !s.min && !s.susp && s.hid === false && s.cls === false && !s.discarded && s.src === "admin", s);
    /* 2) تفريغ لوح نظيف + استعادة كاملة للحالة */
    const orders0 = await X.api(); const q0 = "زبون"; await inFrame("ord", () => { const e = document.getElementById("order-filter-q"); e.value = "سلمى"; e.dispatchEvent(new Event("input", { bubbles: true })); if (window.Admin && Admin.applyOrderFilters) Admin.applyOrderFilters(); return true; });
    await sleep(600); const rowsBefore = await inFrame("ord", () => document.querySelectorAll("#orders-table tr").length);
    await inFrame("ord", () => { window.scrollTo(0, 140); return true; }); await sleep(300); const scrBefore = await inFrame("ord", () => Math.round(window.scrollY));
    const nodesBefore = await inFrame("ord", () => document.getElementsByTagName("*").length);
    await minimize("ord"); await sleep(6500); s = await st("ord");
    ok("بعد المهلة: اللوح النظيف يُفرَّغ فعلاً (الإطار about:blank، discarded=true)", s.min && s.discarded && s.src === "blank" && !s.frDone, s);
const mid = await p.evaluate(() => { const q = SpatialOS.panels.get("ord"); let n = -1; try { n = q.fr.contentWindow.document.getElementsByTagName("*").length; } catch (_) { } return { frame_nodes: n, ds: q.el.dataset.frame }; });
    ok("التفريغ حرّر عقد DOM الإطار (من " + nodesBefore + " إلى " + mid.frame_nodes + ")", nodesBefore > 5000 && mid.frame_nodes >= 0 && mid.frame_nodes < 10 && mid.ds === "discarded", { frame_nodes_before: nodesBefore, after: mid.frame_nodes });
    /* بيانات جديدة أثناء التفريغ */
    const newId = await (async () => { const r = await fetch(store.base + "/api/index.php?r=order", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", Cookie: store.cookie }, body: JSON.stringify({ order: { manual: true, name: "وارد أثناء التفريغ", phone: "0661123456", wilaya: "الجزائر", commune: "مركز", dtype: "home", items: [{ slug: "tarkiz", title: "x", qty: 1, price: 1800 }], subtotal: 1800, fee: 0, total: 1800 } }) }); return (await r.json()).id; })();
    await restore("ord"); s = await st("ord");
    const fq = await inFrame("ord", () => document.getElementById("order-filter-q").value), rowsAfter = await inFrame("ord", () => document.querySelectorAll("#orders-table tr").length), scrAfter = await inFrame("ord", () => Math.round(window.scrollY));
    ok("الاستعادة: اللوح يعود حيّاً (admin.html، frDone) على التبويب نفسه", !s.min && !s.discarded && s.frDone && s.src === "admin" && s.hid === false, s);
    ok("الاستعادة: الفلتر النصي محفوظ (\"سلمى\") والصفوف المعروضة كما كانت", fq === "سلمى" && rowsAfter === rowsBefore, { filter: fq, rows: [rowsBefore, rowsAfter] });
    ok("الاستعادة: موضع التمرير محفوظ (±25px)", Math.abs(scrAfter - scrBefore) <= 25 || scrBefore === 0, { before: scrBefore, after: scrAfter });
    await inFrame("ord", () => { const e = document.getElementById("order-filter-q"); e.value = ""; e.dispatchEvent(new Event("input", { bubbles: true })); if (window.Admin && Admin.applyOrderFilters) Admin.applyOrderFilters(); return true; }); await sleep(600);
    let sawNew = false; for (let i = 0; i < 24 && !sawNew; i++) { sawNew = await inFrame("ord", id => document.body.innerText.includes(id) || document.body.innerText.includes("وارد أثناء التفريغ"), newId); if (!sawNew) await sleep(500); }
    ok("بعد الاستعادة تظهر بيانات الخادم الحديثة (طلب أُنشئ أثناء التفريغ)", sawNew === true, { newId });
    const hub = await p.evaluate(() => { const x = SpatialHub.state("ord"); return x && { ready: x.ready, vis: x.vis, sync: x.sync, degraded: x.degraded }; });
    ok("مصالحة Hub بعد الاستعادة: جاهز ومرئي وبلا تدهور", hub && hub.ready && hub.vis && !hub.degraded, hub);
    /* 3) كتابة حقيقية بعد الاستعادة تنعكس في اللوح (الأحداث تصل) */
    const tgt = orders0.find(o => o.status === "nouvelle"); await X.openAgent(); await p.evaluate(() => AlyssumAgent.setLLMMode("off")); const r1 = await X.say("أكد الطلب " + tgt.id); const n0 = await X.runs(); await X.select("ai"); await X.realClick(".ag-confirm .ag-yes"); await X.waitRun(n0, 60000);
    await X.quiet(1500, 30000); const reflected = await inFrame("ord", id => document.body.innerText.includes(id), tgt.id), srvSt = (await X.api()).find(o => o.id === tgt.id).status;
    ok("كتابة حساسة بعد الاستعادة: تُنفَّذ بموافقة وتنعكس في اللوح المستعاد", r1.confirm && srvSt === "confirmee" && reflected, { server: srvSt });
    /* 4) لوح تفاعل معه المستخدم فعلاً (نقر حقيقي isTrusted داخل الإطار) لا يُفرَّغ أبداً */
    await openP(["prod"]); await inFrame("prod", () => { document.body.dataset.spMark = "alive"; return true; });
    const bb = await p.locator('.panel[aria-label="المنتجات"] iframe.pn-frame').boundingBox(); await p.mouse.click(bb.x + 70, bb.y + 150); await sleep(350); await p.mouse.click(bb.x + 70, bb.y + 150); await sleep(350);
    const uA = await p.evaluate(() => !!SpatialOS.panels.get("prod").frUser); await minimize("prod"); await sleep(6500); s = await st("prod");
    ok("لوح تفاعل معه المستخدم (نقر حقيقي): لا يُفرَّغ (تجميد خفيف فقط) ويُسجَّل أن التفريغ تُخطّي", uA && s.min && !s.discarded && s.susp && s.skipped >= 1 && s.src === "admin", { frUser: uA, ...s });
    await restore("prod"); const mark = await inFrame("prod", () => document.body.dataset.spMark); ok("اللوح المتفاعَل معه يعود بنفس المستند (لا إعادة تحميل: العلامة باقية)", mark === "alive", { mark });
    /* 5) لوح انتقل المستخدم داخله لتبويب آخر لا يُفرَّغ */
        await inFrame("prod", () => { Admin.tab("analytics"); return true; }); await sleep(800); await minimize("prod"); await sleep(6500); s = await st("prod");
    ok("لوح انتقل المستخدم داخله إلى تبويب آخر: لا يُفرَّغ", s.min && !s.discarded && s.skipped >= 1, s);
    await restore("prod");
    const errs = X.errs.filter(e => !/ResizeObserver/.test(e)); ok("لا أخطاء صفحة في كل المسارات", errs.length === 0, errs.slice(0, 3));
    await X.c.close(); X = null;
    /* 6) ?discard=0 يعطّل التفريغ */
    Y = await boot(b, store, { tier: "high", noOrd: true, query: "q=3&discard=0" }); const q = Y.p; await q.evaluate(() => SpatialOS.open("inv")); await q.waitForFunction(() => { const x = SpatialOS.panels.get("inv"); return x && x.frDone; }, null, { timeout: 90000 });
    await q.evaluate(() => SpatialOS.panels.get("inv").el.querySelector(".pn-min").click()); await sleep(6500); const d0 = await q.evaluate(() => { const x = SpatialOS.panels.get("inv"); return { discarded: !!x.discarded, susp: !!x.suspended }; });
    ok("?discard=0: لا تفريغ أبداً (التجميد الخفيف فقط)", !d0.discarded && d0.susp, d0);
  } catch (e) { fails++; console.log("HARNESS ERROR", String(e.stack || e).slice(0, 700)); if (X) await X.p.screenshot({ path: "/tmp/p12b-panels-fail.png" }).catch(() => { }); }
  finally { await b.close().catch(() => { }); store.stop(); }
  const out = { phase: "12B", workstream: "WS4", date: new Date().toISOString().slice(0, 10), isolation: "متجر PHP محلي؛ ألواح iframe حقيقية؛ ?discard=4000 لتسريع الاختبار", pass: R.filter(r => r.pass).length, fail: R.filter(r => !r.pass).length, duration_s: Math.round((Date.now() - t0) / 1000), results: R };
  fs.writeFileSync(path.join(__dirname, "phase12b-panels-result.json"), JSON.stringify(out, null, 1)); console.log("\nPASS " + out.pass + " · FAIL " + out.fail + " · " + out.duration_s + "s"); process.exit(fails ? 1 : 0);
})();
