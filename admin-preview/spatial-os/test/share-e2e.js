/* مشاركة القراءات بين النوافذ الحقيقية (V4): ثلاث نوافذ تُفتح معاً؛ تُقارَن طلبات API مع ‎noshare=1‎ (تقليل ≥ 30%)، المسارات غير المسموحة (me) لا تُدمَج،
   الكتابة عبر لوح تُبطل القراءة المشتركة فلا يرى لوح آخر قيمة قديمة، وتبقى الألواح متزامنة في الهَب بلا أخطاء. التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/share-e2e.js */
const PW = require("playwright"), { startStore } = require("./harness");
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 320) : "")); }; const wait = ms => new Promise(r => setTimeout(r, ms));
async function run(b, store, extra) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage(), errs = [], reqs = []; p.setDefaultTimeout(60000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
  await p.goto(store.base + "/admin.html"); await wait(500); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
  await p.goto(store.base + "/admin-preview/spatial-os/index.html?real=1&nozoom=1&noextra=1&nospare=1&norestore=1" + extra); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two, null, { timeout: 90000 }); await wait(1500);
  await p.evaluate(() => { for (const k of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(k, "close"); }); await wait(800);
  p.on("request", r => { const u = r.url(); if (/api\/index\.php/.test(u)) reqs.push(r.method() + " " + u.replace(/^.*index\.php/, "").replace(/&t=\d+/, "")); });
  await p.evaluate(() => ["ord", "prod", "inv"].forEach(id => SpatialOS.open(id)));
  await p.waitForFunction(() => ["ord", "prod", "inv"].every(i => { const q = SpatialOS.panels.get(i); return q && q.frDone; }), null, { timeout: 120000 }); await wait(5000);
  return { p, ctx, errs, reqs };
}
(async () => {
  const b = await PW.chromium.launch(), store = await startStore({ stock: true });
  try {
    const off = await run(b, store, "&noshare=1"), offN = off.reqs.length; await off.ctx.close();
    const on = await run(b, store, ""), { p } = on, onN = on.reqs.length;
    ok("المشاركة تقلّل طلبات API عند فتح 3 نوافذ بنسبة ≥ 30% (" + offN + " ← " + onN + ")", onN <= offN * 0.7, { offN, onN });
    const kvGets = on.reqs.filter(x => /^GET \?r=kv/.test(x)), uniq = new Set(kvGets).size;
    ok("قراءات kv: لا تكرار يُذكر (كل مفتاح مرة، سماح 25%)", kvGets.length <= uniq * 1.25 + 2, { total: kvGets.length, uniq });
    ok("مسار me (الجلسة) لا يُدمَج: طُلب لكل إطار على الأقل", on.reqs.filter(x => /^GET \?r=me/.test(x)).length >= 3, on.reqs.filter(x => /r=me/.test(x)).length);
    const st = await p.evaluate(() => SpatialShare.stats());
    ok("الذاكرة المشتركة استُعملت فعلاً (hit > 0) وغير معطّلة", st.hit > 0 && !st.off, st);
    /* كتابة عبر لوح ثم قراءة عبر آخر: لا قيمة قديمة */
    const call = (id, m, k, v) => p.evaluate(async ([id, m, k, v]) => { const w = SpatialOS.panels.get(id).fr.contentWindow; const r = await w.fetch("api/index.php?r=kv" + (m === "GET" ? "&k=" + k : ""), m === "GET" ? { headers: { "X-Requested-With": "XMLHttpRequest" }, credentials: "same-origin", cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, credentials: "same-origin", body: JSON.stringify({ k, v }) }); return await r.json(); }, [id, m, k, v]);
    await call("ord", "POST", "s_v4_probe", "one"); const g1 = await call("prod", "GET", "s_v4_probe"), g2 = await call("inv", "GET", "s_v4_probe");
    ok("كتابة من لوح وقراءة من لوحين آخرين: يرون القيمة الجديدة", g1.v === "one" && g2.v === "one", [g1, g2]);
    await call("ord", "POST", "s_v4_probe", "two"); const g3 = await call("prod", "GET", "s_v4_probe");
    ok("كتابة ثانية تُبطل المشترَك فلا يرى لوح آخر القيمة القديمة", g3.v === "two", g3);
    const probeGets = on.reqs.filter(x => /^GET \?r=kv&k=s_v4_probe/.test(x)).length;
    const sts = await p.evaluate(() => ["ord", "prod", "inv"].map(i => SpatialHub.state(i) && SpatialHub.state(i).sync));
    ok("الألواح الثلاثة متزامنة في الهَب", sts.every(x => x === "synced"), sts);
    ok("لا أخطاء صفحة (المشاركة وتقطيع الإقلاع)", on.errs.length === 0, on.errs);
    const boot = await p.evaluate(() => ["ord", "prod", "inv"].map(i => { const w = SpatialOS.panels.get(i).fr.contentWindow; return w.__spBoot ? [w.__spBoot.n, Math.round(w.__spBoot.maxMs), w.__spBoot.done] : null; }));
    ok("شريحة الإقلاع عملت في كل لوح (n>0، اكتملت)", boot.every(x => x && x[0] > 3 && x[2] === true), boot);
    /* إغلاق نافذة أثناء تحميلها ثم فتح غيرها: طلب الإطار المغلق قد لا يُحلّ أبداً؛ يجب ألا يعلّق التالية (كان يعلّقها للأبد) */
    await p.evaluate(() => { for (const k of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(k, "close"); }); await wait(1000);
    await p.evaluate(() => SpatialOS.open("returns")); await wait(500); await p.evaluate(() => SpatialOS.dismiss("returns", "close")); await wait(300);
    await p.evaluate(() => SpatialOS.open("ana"));
    const done = await p.waitForFunction(() => { const q = SpatialOS.panels.get("ana"); return q && q.frDone; }, null, { timeout: 60000 }).then(() => true).catch(() => false);
    ok("إغلاق نافذة أثناء تحميلها ثم فتح أخرى: الثانية تكتمل (لا تعلق على طلب لا يُحلّ)", done);
    await on.ctx.close();
  } catch (e) { fails++; console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 700)); }
  finally { try { await b.close(); } catch { } try { store.stop(); } catch { } }
  console.log(fails ? "FAILS: " + fails : "ALL PASS"); process.exit(fails ? 1 : 0);
})();
