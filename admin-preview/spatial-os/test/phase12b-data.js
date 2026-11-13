/* المرحلة 12B / WS2 — اكتمال بيانات الطلبات والتجميع على متجر PHP حقيقي معزول (بذر SQL مباشر لقاعدة مؤقتة، بيانات اصطناعية).
   الحقيقة المرجعية تُحسب بـSQL مستقل (لا من نقاط الاختبار نفسها): أعداد الحالات، الإيراد، سلسلة الأيام، أفضل المنتجات، وكل معرّفات الطلبات.
   يختبر: بيانات الاقتطاع في `orders`، الترقيم بمؤشر (بلا تكرار/فقد حتى مع إدراج متزامن)، الفلاتر عبر الصفحات، `orders_stats`، التوافق الخلفي، الصلاحيات، الكمون.
   التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/phase12b-data.js   (SIZES=100,1000,10000,50000) */
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process"); const { startStore } = require("./harness");
const SIZES = (process.env.SIZES || "100,1000,10000,50000").split(",").map(Number), R = []; let fails = 0;
const ok = (n, c, x) => { if (!c) fails++; R.push({ n, pass: !!c, x }); console.log((c ? "PASS " : "FAIL ") + n + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 240) : "")); };
const sqlq = (st, q) => execFileSync("php", [path.join(__dirname, "sqlq.php"), path.join(st.dir, "api", "_data", "store.db"), q], { encoding: "utf8", maxBuffer: 1 << 29 }).split("\n").filter(Boolean).map(l => JSON.parse(l));
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };
(async () => {
  const t0 = Date.now(); const P = {};
  for (const N of SIZES) {
    let st = null; console.log("\n══ N =", N);
    try {
      st = await startStore({ stock: true, orders: [] }); const db = path.join(st.dir, "api", "_data", "store.db");
      execFileSync("php", [path.join(__dirname, "seed_orders.php"), db, String(N)]);
      const H = { "X-Requested-With": "XMLHttpRequest", Cookie: st.cookie }, g = async (q, h) => { const t = Date.now(); const r = await fetch(st.base + "/api/index.php?r=" + q, { headers: h || H }); const j = await r.json().catch(() => null); return { s: r.status, j, ms: Date.now() - t }; };
      const truthRows = sqlq(st, "select id, created_at, status, total, wilaya, name, items from orders order by created_at desc, id desc"), allIds = truthRows.map(r => r.id);
      /* 1) عقد orders القديم + بيانات الاقتطاع */
      const o = await g("orders"); const exp = allIds.slice(0, 2000);
      ok(`[${N}] orders: العقد القديم محفوظ (نفس أول ${Math.min(N, 2000)} معرّفاً بنفس الترتيب)`, o.s === 200 && o.j.ok && JSON.stringify(o.j.orders.map(x => x.id)) === JSON.stringify(exp), { returned: o.j.returned });
      ok(`[${N}] orders: بيانات الاقتطاع صحيحة (total_count=${N}، truncated=${N > 2000})`, o.j.total_count === N && o.j.truncated === (N > 2000) && o.j.has_more === (N > 2000) && (N > 2000) === !!o.j.next_cursor, { total_count: o.j.total_count, truncated: o.j.truncated, window: o.j.window });
      /* 2) ترقيم كامل: لا تكرار ولا فقد، ترتيب ثابت */
      const walk = async (q, lim) => { const ids = []; let cur = "", pages = 0, total = null, lat = []; for (;;) { const r = await g("orders_page&limit=" + lim + (q ? "&" + q : "") + (cur ? "&cursor=" + cur : "")); if (r.s !== 200) return { err: r.s, ids }; lat.push(r.ms); total = r.j.total; r.j.orders.forEach(x => ids.push(x.id)); pages++; if (!r.j.has_more) break; cur = r.j.next_cursor; if (pages > 2000) break; } return { ids, pages, total, lat }; };
      const w = await walk("", 500); const uniq = new Set(w.ids).size;
      ok(`[${N}] ترقيم كامل (500/صفحة، ${w.pages} صفحة): 0 تكرار و0 فقد وبنفس ترتيب الحقيقة`, w.ids.length === N && uniq === N && JSON.stringify(w.ids) === JSON.stringify(allIds) && w.total === N, { pages: w.pages, got: w.ids.length, uniq, p95_ms: pct(w.lat, 95) });
      /* 3) فلاتر عبر الصفحات */
      const wlTruth = truthRows.filter(r => r.status === "nouvelle" && r.wilaya === "وهران").map(r => r.id), wf = await walk("status=nouvelle&wilaya=" + encodeURIComponent("وهران"), 97);
      ok(`[${N}] فلاتر (الحالة+الولاية) محفوظة عبر الصفحات وtotal صحيح`, JSON.stringify(wf.ids) === JSON.stringify(wlTruth) && wf.total === wlTruth.length, { expect: wlTruth.length, got: wf.ids.length });
      const mid = truthRows[Math.floor(N / 2)].created_at, since = mid - 86400 * 10, until = mid + 86400 * 10, rngTruth = truthRows.filter(r => r.created_at >= since && r.created_at < until && ["nouvelle", "livree"].includes(r.status)).map(r => r.id), wr = await walk("status=nouvelle,livree&since=" + since + "&until=" + until, 64);
      ok(`[${N}] نطاق زمني + حالتان محفوظان عبر الصفحات`, JSON.stringify(wr.ids) === JSON.stringify(rngTruth), { expect: rngTruth.length, got: wr.ids.length });
      const qtruth = truthRows.filter(r => r.name.includes("زبون اختبار 7")).map(r => r.id), wq = await walk("q=" + encodeURIComponent("زبون اختبار 7"), 50);
      ok(`[${N}] بحث نصي عبر الصفحات`, JSON.stringify(new Set(wq.ids).size) === JSON.stringify(qtruth.length) && wq.ids.every(i => qtruth.includes(i)), { expect: qtruth.length, got: wq.ids.length });
      /* 4) إدراج متزامن أثناء الترقيم: لا تكرار ولا فقد لمن كان موجوداً عند البداية */
      { const snap = allIds.slice(), got = []; let cur = "", pages = 0, inserted = 0; for (;;) { const r = await g("orders_page&limit=" + (N > 2000 ? 400 : 50) + (cur ? "&cursor=" + cur : "")); r.j.orders.forEach(x => got.push(x.id)); pages++;
          if (pages % 3 === 1 && inserted < 30) { for (let i = 0; i < 6; i++) { const a = await fetch(st.base + "/api/index.php?r=order", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify({ order: { manual: true, name: "وارد جديد " + (inserted + i), phone: "0661" + String(100000 + inserted + i).slice(-6), wilaya: "الجزائر", commune: "مركز", dtype: "home", items: [{ slug: "tarkiz", title: "x", qty: 1, price: 1 }], subtotal: 1, fee: 0, total: 1 } }) }); await a.text(); } inserted += 6; }
          if (!r.j.has_more) break; cur = r.j.next_cursor; }
        const gotSet = new Set(got), dups = got.length - gotSet.size, missing = snap.filter(i => !gotSet.has(i)).length;
        ok(`[${N}] إدراج ${inserted} طلباً أثناء الترقيم: 0 تكرار و0 فقد من لقطة البداية`, dups === 0 && missing === 0, { pages, dups, missing, inserted }); }
      /* 5) orders_stats مقابل SQL المستقل */
      const rows2 = sqlq(st, "select status, total, items, created_at from orders"), by = {}; let rev = 0, deliv = 0; const prod = new Map();
      rows2.forEach(r => { by[r.status] = (by[r.status] || 0) + 1; if (r.status !== "annulee" && r.status !== "echec") { rev += r.total; (JSON.parse(r.items) || []).forEach(it => { const k = it.title.toLowerCase(), e = prod.get(k) || { qty: 0, revenue: 0 }; e.qty += it.qty; e.revenue += it.qty * it.price; prod.set(k, e); }); } if (r.status === "livree") deliv += r.total; });
      const s = await g("orders_stats&top=5"), sj = s.j, topT = [...prod.entries()].sort((a, b) => b[1].qty - a[1].qty || b[1].revenue - a[1].revenue).slice(0, 5);
      ok(`[${N}] orders_stats: الأعداد والإيراد والمُسلَّم تطابق SQL المستقل`, sj.orders === rows2.length && JSON.stringify(sj.by_status) === JSON.stringify(Object.assign({ nouvelle: 0, confirmee: 0, expediee: 0, livree: 0, annulee: 0, echec: 0 }, by)) && Math.abs(sj.revenue - rev) < 0.01 && Math.abs(sj.delivered_revenue - deliv) < 0.01, { orders: sj.orders, revenue: sj.revenue, truth: rev });
      ok(`[${N}] orders_stats: أفضل المنتجات تطابق الحقيقة`, JSON.stringify(sj.top_products.map(p => [p.title.toLowerCase(), p.qty, p.revenue])) === JSON.stringify(topT.map(([k, v]) => [k, v.qty, v.revenue])), { top1: sj.top_products[0] });
      const dayTruth = {}; rows2.forEach(r => { if (r.status !== "annulee" && r.status !== "echec") { const d = new Date((r.created_at + 60 * 60) * 1000).toISOString().slice(0, 10); dayTruth[d] = (dayTruth[d] || 0) + r.total; } });
      const s60 = (await g("orders_stats&tz=60")).j, dsum = s60.by_day.reduce((a, d) => a + d.revenue, 0), dmatch = s60.by_day.every(d => Math.abs((dayTruth[d.day] || 0) - d.revenue) < 0.01);
      ok(`[${N}] orders_stats: سلسلة الأيام بمنطقة زمنية (+60د) تطابق الحقيقة ومجموعها = الإيراد`, dmatch && Math.abs(dsum - rev) < 0.01, { days: s60.by_day.length });
      const sw = (await g("orders_stats&since=" + since + "&until=" + until)).j, wTruth = truthRows.filter(r => r.created_at >= since && r.created_at < until);
      ok(`[${N}] orders_stats: نطاق زمني (since/until)`, sw.orders === wTruth.length, { got: sw.orders, truth: wTruth.length });
      /* 6) الأخطاء والصلاحيات والحدود */
      const bc = await g("orders_page&cursor=%%%"), l0 = await g("orders_page&limit=0"), l9 = await g("orders_page&limit=99999");
      ok(`[${N}] مؤشر تالف ← 422، وحدّ الصفحة محصور (0→1، 99999→500)`, bc.s === 422 && l0.j.orders.length === 1 && l9.j.orders.length === Math.min(500, l9.j.total), { bc: bc.s, l0: l0.j.orders.length, l9: l9.j.orders.length });
      const noauth = await g("orders_page", { "X-Requested-With": "XMLHttpRequest" }), noauth2 = await g("orders_stats", { "X-Requested-With": "XMLHttpRequest" });
      ok(`[${N}] بلا جلسة ← 401 للنقطتين الجديدتين`, noauth.s === 401 && noauth2.s === 401, { page: noauth.s, stats: noauth2.s });
      /* 7) الكمون */
      const lp = [], ls = []; for (let i = 0; i < 5; i++) { lp.push((await g("orders_page&limit=100")).ms); ls.push((await g("orders_stats")).ms); } const lo = []; for (let i = 0; i < 3; i++) lo.push((await g("orders")).ms);
      P[N] = { page100_p50_ms: pct(lp, 50), stats_p50_ms: pct(ls, 50), orders_legacy_p50_ms: pct(lo, 50), walk_pages: w.pages, walk_page_p95_ms: pct(w.lat, 95) }; console.log("latency", JSON.stringify(P[N]));
      if (N === SIZES[0]) { /* صلاحيات الموظف */
        const mkS = async (user, perms) => (await fetch(st.base + "/api/index.php?r=team", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify({ action: "create", user, name: user, role: "agent", perms, password: "StaffPass12345" }) })).status;
        await mkS("noorders", ["products"]); await mkS("withorders", ["orders"]); const cookieOf = async u => { const r = await fetch(st.base + "/api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ user: u, password: "StaffPass12345" }) }); return (r.headers.getSetCookie() || []).map(c => c.split(";")[0]).join("; "); };
        const c1 = await cookieOf("noorders"), c2 = await cookieOf("withorders"), hh = c => ({ "X-Requested-With": "XMLHttpRequest", Cookie: c });
        const a1 = await g("orders_page", hh(c1)), a2 = await g("orders_stats", hh(c1)), b1 = await g("orders_page", hh(c2)), b2 = await g("orders_stats", hh(c2));
        ok("صلاحيات الموظف: بلا «orders» ← 403 للنقطتين، ومعها ← 200", a1.s === 403 && a2.s === 403 && b1.s === 200 && b2.s === 200, { without: [a1.s, a2.s], with: [b1.s, b2.s] }); }
    } catch (e) { fails++; console.log("HARNESS ERROR", String(e.stack || e).slice(0, 500)); } finally { if (st) st.stop(); }
  }
  const out = { phase: "12B", workstream: "WS2", date: new Date().toISOString().slice(0, 10), isolation: "متجر PHP محلي؛ بذر SQL لقاعدة مؤقتة؛ بيانات اصطناعية", sizes: SIZES, latency_ms: P, pass: R.filter(r => r.pass).length, fail: R.filter(r => !r.pass).length, duration_s: Math.round((Date.now() - t0) / 1000), results: R };
  fs.writeFileSync(path.join(__dirname, "phase12b-data-result.json"), JSON.stringify(out, null, 1)); console.log("\nPASS " + out.pass + " · FAIL " + out.fail + " · " + out.duration_s + "s"); process.exit(fails ? 1 : 0);
})();
