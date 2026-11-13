/* المرحلة 12 / WS4 (ب) — أحمال بيانات: 100 / 1000 / 10000 طلب مولَّد (اصطناعي بالكامل: أسماء «زبون اختبار N»، هواتف 0550xxxxxx وهمية) على متجر PHP محلي معزول.
   يقيس: كمون API، زمن جاهزية لوح الطلبات الحقيقي، مهام طويلة في المتصفح (استجابة الواجهة)، كمون الوكيل لأدوات القراءة، اتساق العدّ بين الخادم والوكيل واللوح،
   مزامنة الـHub بعد كتابة، نمو الذاكرة بعد 20 استعلاماً، التعافي من فشل API. التشغيل: SIZES=100,1000,10000 node test/phase12-load.js
   تنبيه صدق: المتصفح يعمل بتصيير برمجي (SwiftShader)؛ لذا نقيس المهام الطويلة وكمون المنطق لا معدل الإطارات. */
const fs = require("fs"), path = require("path"); const { startStore } = require("./harness"); const { boot, launch, sleep } = require("./lib-boot");
const SIZES = (process.env.SIZES || "100,1000,10000").split(",").map(Number), pct = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };
const W = ["الجزائر", "وهران", "قسنطينة", "عنابة", "سطيف", "باتنة", "تيزي وزو", "بجاية", "البليدة", "تلمسان"], C = ["مركز", "الحراش", "الخروب", "عزازقة", "بئر مراد رايس"], SL = [["miel-sidr", "عسل السدر الجبلي 500غ", 3200], ["tarkiz", "قطرات التركيز", 1800], ["huile-a-barbe", "زيت اللحية الفاخر", 2100]];
const gen = n => Array.from({ length: n }, (_, i) => { const s = SL[i % 3], q = 1 + (i % 3), st = i % 10 < 6 ? "nouvelle" : i % 10 < 9 ? "confirmee" : "livree"; return { name: "زبون اختبار " + (i + 1), phone: "0550" + String(100000 + i).slice(-6), wilaya: W[i % W.length], commune: C[i % C.length], dtype: "home", items: [{ slug: s[0], title: s[1], qty: q, price: s[2] }], fee: 400, status: st }; });

(async () => {
  const b = await launch(), out = [];
  for (const N of SIZES) {
    const row = { orders: N, status: "PASS", notes: [] }; let store = null, X = null;
    try {
      const t0 = Date.now(); store = await startStore({ stock: true, orders: [] });
      /* بذر عبر مسار الطلب اليدوي الحقيقي مع إعادة المحاولة (تصادم معرّف الطلب 20-بت معروف: انظر PHASE12-REPORT)؛ الحالات عبر order_update */
      const HS = { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", Cookie: store.cookie }; let retries = 0; const ords = gen(N), ids = [];
      for (const o of ords) { const sub = o.items.reduce((a, i) => a + i.price * i.qty, 0), body = JSON.stringify({ order: { name: o.name, phone: o.phone, wilaya: o.wilaya, commune: o.commune, dtype: o.dtype, items: o.items, subtotal: sub, fee: o.fee, total: sub + o.fee, manual: true } }); let j = null;
        for (let k = 0; k < 4 && !(j && j.ok); k++) { const r = await fetch(store.base + "/api/index.php?r=order", { method: "POST", headers: HS, body }); const tx = await r.text(); try { j = JSON.parse(tx); } catch (_) { j = null; } if (!(j && j.ok)) retries++; } if (!(j && j.ok)) throw new Error("seed failed"); ids.push(j.id); }
      for (let i = 0; i < ords.length; i++) if (ords[i].status !== "nouvelle") await fetch(store.base + "/api/index.php?r=order_update", { method: "POST", headers: HS, body: JSON.stringify({ id: ids[i], status: ords[i].status }) });
      row.seed_s = +((Date.now() - t0) / 1000).toFixed(1); row.seed_retries = retries; row.truth = { total: N, pending: ords.filter(o => o.status === "nouvelle").length, confirmed: ords.filter(o => o.status === "confirmee").length };
      const H = { "X-Requested-With": "XMLHttpRequest", Cookie: store.cookie }; const lat = [];
      let bytes = 0, list = null; for (let i = 0; i < 5; i++) { const t = Date.now(); const r = await fetch(store.base + "/api/index.php?r=orders", { headers: H }); const txt = await r.text(); lat.push(Date.now() - t); bytes = txt.length; list = JSON.parse(txt).orders; }
      row.api = { orders_returned: list.length, ok: list.length >= N, truncated_vs_truth: list.length < N, cap_note: list.length < N ? "الخادم يعيد آخر 2000 طلب فقط (LIMIT 2000) — أي حساب في الوكيل/اللوحة على هذه القائمة ناقص عند أحجام أكبر" : null, payload_kb: Math.round(bytes / 1024), latency_ms: { p50: pct(lat, 50), max: Math.max(...lat) } }; const pendApi = list.filter(o => o.status === "nouvelle").length, conf = list.filter(o => o.status === "confirmee").length; row.api.visible_pending = pendApi;
      const tb = Date.now(); X = await boot(b, store, { tier: "high", noOrd: true }); await X.openAgent(); await X.p.evaluate(() => AlyssumAgent.setLLMMode("off")); row.boot_s = +((Date.now() - tb) / 1000).toFixed(1);
      const tp = Date.now(); await X.p.evaluate(() => SpatialOS.open("ord")); const ready = await X.p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 240000 }).then(() => true).catch(() => false); row.ord_panel_ready = { ok: ready, s: +((Date.now() - tp) / 1000).toFixed(1) }; if (!ready) { row.status = "FAIL"; row.notes.push("لوح الطلبات لم يجهز خلال 240ث"); }
      await X.p.evaluate(() => { SpatialOS.panels.forEach(q => { if (q.frame) { q.st.w = 520; q.st.h = 400; } }); SpatialOS.tileAll(); }); await sleep(1200); await X.select("ai").catch(() => { });
      const lt0 = await X.p.evaluate(() => (window.__lt || []).length); await X.quiet(1500, 60000); const lts = await X.p.evaluate(() => (window.__lt || []).slice()); row.main_thread_longtasks = { count: lts.length, max_ms: lts.length ? Math.max(...lts) : 0, total_ms: lts.reduce((a, c) => a + c, 0) };
      /* كمون الوكيل لأدوات القراءة + اتساق العدّ */
      const Q = [["orders.list", "وريني الطلبات لي ما تأكدوش"], ["sales.summary", "شحال خدمنا اليوم؟"], ["sales.top_product", "واش هو أكثر منتج تباع؟"], ["inventory.read", "شحال بقالنا من المخزون؟"]]; row.agent = {}; let cons = null;
      for (const [tool, q] of Q) { const ms = [], st = []; for (let i = 0; i < 3; i++) { const t = Date.now(); const r = await X.say(q, 120000); ms.push(Date.now() - t); st.push(r.steps.some(s => s.tool === tool && /^(ok|done)$/.test(s.status)) ? "ok" : r.status); if (tool === "orders.list" && i === 0) cons = { text: r.text.slice(0, 160), nums: (r.text.match(/\d+/g) || []).map(Number) }; } row.agent[tool] = { p50_ms: pct(ms, 50), max_ms: Math.max(...ms), results: st }; if (st.some(s => s !== "ok")) { row.status = row.status === "FAIL" ? "FAIL" : "PARTIAL"; row.notes.push(tool + " لم ينجح دائماً: " + st.join(",")); } }
      row.consistency = { true_pending: row.truth.pending, api_visible_pending: pendApi, agent_matches_truth: cons ? cons.nums.includes(row.truth.pending) : null, agent_matches_visible: cons ? cons.nums.includes(pendApi) : null, api_pending: pendApi, api_confirmed: conf, agent_list_text: cons && cons.text, agent_numbers: cons && cons.nums.slice(0, 6), pending_in_agent_numbers: cons ? cons.nums.includes(pendApi) : null };
      /* مزامنة Hub بعد كتابة حقيقية */
      const tgt = list.find(o => o.status === "nouvelle"); const h0 = await X.p.evaluate(() => SpatialHub.stats()); const r = await X.say("أكد الطلب " + tgt.id, 120000); row.write_card = !!r.confirm; const n0 = await X.runs(); const tc = Date.now(); await X.select("ai"); await X.realClick(".ag-confirm .ag-yes"); await X.waitRun(n0, 120000).catch(() => { });
      const st = (await X.api()).find(o => o.id === tgt.id); row.write_confirmed = st && st.status === "confirmee"; const q = await X.quiet(1500, 90000); const h1 = await X.p.evaluate(() => SpatialHub.stats()); row.hub = { settled: q, settle_s: +((Date.now() - tc) / 1000).toFixed(1), accepted_delta: h1.accepted - h0.accepted, refreshOk_delta: h1.refreshOk - h0.refreshOk, refreshFail_delta: h1.refreshFail - h0.refreshFail };
      if (!row.write_confirmed || !row.write_card) { row.status = "FAIL"; row.notes.push("الكتابة الحساسة لم تكتمل كما يجب"); }
      /* نمو الذاكرة */
      const cdp = await X.c.newCDPSession(X.p); await cdp.send("HeapProfiler.enable"); const heap = async () => { await cdp.send("HeapProfiler.collectGarbage"); const m = await cdp.send("Runtime.getHeapUsage"); return +(m.usedSize / 1048576).toFixed(1); }; const m0 = await heap();
      for (let i = 0; i < 20; i++) await X.say(i % 2 ? "شحال خدمنا اليوم؟" : "وريني الطلبات لي ما تأكدوش", 120000); const m1 = await heap(); row.memory_mb = { before: m0, after_20_queries: m1, growth: +(m1 - m0).toFixed(1) };
      /* تعافٍ من فشل API */
      await X.p.route(/index\.php\?r=orders/, route => route.abort()); const rf = await X.say("وريني الطلبات لي ما تأكدوش", 120000); await X.p.unroute(/index\.php\?r=orders/); const tr = Date.now(); const rr = await X.say("وريني الطلبات لي ما تأكدوش", 120000); row.recovery = { failed_status: rf.status, recovered_ok: rr.steps.some(s => s.tool === "orders.list" && /^(ok|done)$/.test(s.status)), recover_ms: Date.now() - tr };
      if (!row.recovery.recovered_ok || rf.steps.some(s => /^(ok|done)$/.test(s.status))) { row.status = "FAIL"; row.notes.push("التعافي من فشل API"); }
      row.page_errors = X.errs.slice(0, 3);
    } catch (e) { row.status = "FAIL"; row.notes.push("استثناء: " + String(e.message || e).slice(0, 200)); }
    finally { if (X) await X.c.close().catch(() => { }); if (store) store.stop(); }
    out.push(row); console.log(JSON.stringify(row).slice(0, 1400));
  }
  fs.writeFileSync(path.join(__dirname, "phase12-load-result.json"), JSON.stringify({ phase: 12, workstream: "WS4-B", date: new Date().toISOString().slice(0, 10), renderer: "SwiftShader (software) — لا أرقام FPS هنا", synthetic_data: true, results: out }, null, 1)); await b.close();
})();
