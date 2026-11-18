/* الرئيسية: نسب التسليم والإرجاع، التسليم حسب الولاية، فترة مخصصة، الربح الصافي، جملة المكالمات: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-home-rates.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 1600 } }); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, H = AdminHome, out = {}; const wait = ms => new Promise(r => setTimeout(r, ms)); window.toast = () => { };
    const day = n => new Date(Date.now() - n * 864e5).toISOString();
    let id = 0; const mk = (st, wil, dAgo) => ({ id: "T" + (++id), date: day(dAgo || 0), name: "ز", phone: "0550000000", wilaya: wil, commune: "c", dtype: "home", items: "منتج ×1 = 1000 DA", subtotal: 1000, fee: 0, total: 1000, extra: {}, status: st, note: "" });
    A.orders = [];
    for (let i = 0; i < 6; i++) A.orders.push(mk("livree", "Skikda", 2)); A.orders.push(mk("echec", "Skikda", 2));
    for (let i = 0; i < 3; i++) A.orders.push(mk("expediee", "Skikda", 1));
    A.orders.push(mk("echec", "Béchar", 1)); A.orders.push(mk("echec", "Béchar", 1)); A.orders.push(mk("expediee", "Béchar", 1)); A.orders.push(mk("nouvelle", "Oran", 0)); A.orders.push(mk("annulee", "Oran", 0));
    A.orders.push(mk("livree", "Oran", 40));
    A.overdueList = () => [1, 2, 3, 4, 5, 6];
    A.computeFinance = (d, r) => ({ K: r && r.from < Date.now() - 8 * 864e5 ? { real: 1000, exp: 0, revenue: 5000 } : { real: 25000, exp: 8000, revenue: 50000, delivered: 6, failed: 3, open: 4 } });
    H.S.days = 7; H.render(); const q = s => document.querySelector("#ahome " + s), txt = () => document.getElementById("ahome").innerText;
    const bar = q(".rt-bar"); out.segs = bar ? [...bar.children].map(i => +getComputedStyle(i).flexGrow) : []; const t0 = txt(); out.rates = t0.slice(t0.indexOf("نسب التسليم"), t0.indexOf("نسب التسليم") + 400);
    const rows = [...document.querySelectorAll("#ahome td[data-wl]")].map(td => ({ n: td.textContent, rate: td.parentElement.children[2].textContent.trim(), cnt: td.parentElement.children[3].textContent.trim(), color: td.parentElement.children[2].style.color }));
    out.rows = rows;
    out.greet = txt().includes("6") && /ينتظر مكالمة منذ أكثر من يوم/.test(txt());
    out.profit = (() => { const t = txt(); const i = t.indexOf("الربح الصافي المحقق"); return t.slice(i, i + 260); })();
    /* فترة مخصصة: آخر 3 أيام فقط */
    document.querySelector('#ahome [data-d="0"]').click(); await wait(100);
    const f = document.getElementById("ah-from"), g = document.getElementById("ah-to"); out.hasInputs = !!(f && g);
    const iso = n => { const x = new Date(Date.now() - n * 864e5); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
    f.value = iso(2); f.dispatchEvent(new Event("change")); await wait(100); const g2 = document.getElementById("ah-to"); g2.value = iso(0); g2.dispatchEvent(new Event("change")); await wait(150);
    const kp = [...document.querySelectorAll("#ahome .kpi")].map(k => k.innerText.replace(/\s+/g, " ")); out.kpiOrders = (kp.find(x => /الطلبات/.test(x) && !/انتظار/.test(x)) || ""); out.customLabel = txt().includes("من " + iso(2) + " إلى " + iso(0));
    document.querySelector('#ahome [data-d="-1"]').click(); await wait(100); out.month = /هذا الشهر/.test(txt());
    return out; });
  ok("شريط النسب: 6 مسلَّمة و4 في الطريق و3 مرتجعة (13 مؤكَّدة)", JSON.stringify(R.segs) === JSON.stringify([6, 4, 3]), R.segs);
  ok("نص النسب: 46,2% مسلَّمة و23,1% مرتجعة و30,8% في الطريق من 13 مؤكَّدة", /46,2%/.test(R.rates) && /23,1%/.test(R.rates) && /30,8%/.test(R.rates) && /من 13 مؤكَّدة/.test(R.rates), R.rates);
  ok("الولايات: سكيكدة أولاً (10 طلبات، نسبة 85,7%)، بشار 0% بالأحمر، ووهران بلا منتهٍ «—»", R.rows[0] && R.rows[0].n === "Skikda" && /85,7/.test(R.rows[0].rate) && R.rows[0].cnt === "10" && R.rows.some(r => r.n === "Béchar" && /^0/.test(r.rate) && /229|e5484d|229, 72, 77/.test(r.color)), R.rows);
  ok("الجملة الترحيبية: طلبات تنتظر مكالمة منذ أكثر من يوم", R.greet, R.greet);
  ok("بطاقة الربح الصافي: 25 000 دج ومتوقع 8 000 والهامش 50%", /25[\s  ]?000 دج/.test(R.profit) && /8[\s  ]?000/.test(R.profit) && /50%/.test(R.profit), R.profit);
  ok("الفترة المخصصة: حقلا التاريخ، وتُحسب طلبات آخر 3 أيام (15 دون الطلب القديم) وتظهر تسمية الفترة", R.hasInputs && /15/.test(R.kpiOrders) && R.customLabel, [R.hasInputs, R.kpiOrders, R.customLabel]);
  ok("«هذا الشهر» يعمل", R.month, R.month);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
