/* مستوى الزبون: أخضر/برتقالي/برتقالي غامق/أحمر من عدد المرتجعات؛ شارة في الطلبات، إشعار في الطلب اليدوي، وسجل المرتجعات في القائمة السوداء. NODE_PATH=/opt/node-tools/node_modules node scripts/test-cust-tier.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, out = {}; window.toast = () => { }; document.getElementById("app").classList.remove("hidden");
    const mk = (id, ph, st, d) => ({ id, date: d || "2026-11-01T10:00:00Z", name: "زبون " + ph.slice(-2), phone: ph, wilaya: "Alger", commune: "Bab Ezzouar", dtype: "home", items: "عسل ×1 = 2000 DA", subtotal: 2000, fee: 0, total: 2000, status: st, note: st === "echec" ? " 🚚yalidine:yal-" + id : "", extra: {} });
    A.blacklist = []; A.blRule = Object.assign(A.blRuleDefaults(), { on: false });
    A.orders = [mk("A1", "0550000001", "livree"), mk("B1", "0550000002", "echec"), mk("C1", "0550000003", "echec"), mk("C2", "0550000003", "echec", "2026-10-01T10:00:00Z"), mk("D1", "0550000004", "echec"), mk("D2", "0550000004", "echec", "2026-10-01T10:00:00Z"), mk("D3", "0550000004", "echec", "2026-09-01T10:00:00Z")]; A.blInval();
    const T = ph => { const x = A.custTier(ph); return x && [x.lvl, x.cls, x.n].join(":"); };
    out.tiers = [T("0550000001"), T("0550000002"), T("0550000003"), T("0550000004"), T("0770000000"), T("+213550000004")];
    out.badge = [A.custBadge("0550000002"), A.custBadge("0550000004"), A.custBadge("0550000001")].map(h => (h.match(/cb-[a-z0-9]+/) || [""])[0] + "|" + (h.match(/>([^<]+)</) || [])[1]);
    // قائمة الطلبات: الشارة تظهر في صف الزبون
    A.orderFilters = { q: "", status: "", wilaya: "", company: "", src: "", dateFrom: "", dateTo: "", showShipped: true }; A.renderOrders(); out.rowBadges = [...document.querySelectorAll("#orders-table tbody td.nm .cb")].map(x => x.className.replace("cb ", "")).sort().join(",");
    // سجل المرتجعات
    A.renderRetLedger(); const rows = [...document.querySelectorAll("#bl-led-table tr")].filter(r => r.querySelector(".cb")); out.ledger = rows.map(r => r.cells[0].textContent.trim().slice(0, 10) + "|" + r.cells[2].textContent.trim()).join(" ; ");
    document.getElementById("bl-led-q").value = "0550000003"; A.renderRetLedger(); out.ledSearch = [...document.querySelectorAll("#bl-led-table tr")].filter(r => r.querySelector(".cb")).length; document.getElementById("bl-led-q").value = "";
    out.ledOpen = (A._ledOpen = { "0550000004": true }, A.renderRetLedger(), document.querySelectorAll("#bl-led-table tr").length);
    // الطلب اليدوي
    ManualOrder.open({ mode: "new" }); await new Promise(r => setTimeout(r, 400));
    const w = () => { const e = document.getElementById("mo-blw"); return { hidden: e.classList.contains("hidden"), txt: e.textContent, bc: e.style.borderColor }; }; const setP = async v => { const i = document.getElementById("mo-phone"); i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); await new Promise(r => setTimeout(r, 80)); return w(); };
    out.mo = { green: await setP("0550000001"), fresh: await setP("0661234567"), o1: await setP("0550000002"), o2: await setP("0550000003"), red: await setP("0550000004"), short: await setP("055") };
    A.blacklist = [{ phone: "0661234567", reason: "x", state: "confirmed", date: new Date().toISOString() }]; out.mo.blk = await setP("0661234567");
    return out;
  });
  t("المستويات: 0 أخضر، 1 برتقالي، 2 برتقالي غامق، 3 أحمر، ورقم مجهول أخضر، وصيغة +213 تُطابق", R.tiers.join(",") === "0:cb-g:0,1:cb-o1:1,2:cb-o2:2,3:cb-r:3,0:cb-g:0,3:cb-r:3", R.tiers);
  t("الشارة: ✓/1/3 بألوانها", R.badge[0] === "cb-o1|1" && R.badge[1] === "cb-r|3" && R.badge[2] === "cb-g|✓", R.badge);
  t("الشارة في صفوف «الطلبات»", /cb-g/.test(R.rowBadges) && /cb-o1/.test(R.rowBadges) && /cb-o2/.test(R.rowBadges) && /cb-r/.test(R.rowBadges), R.rowBadges);
  t("سجل المرتجعات: 3 زبائن مرتبين بالأخطر أولاً (3 ثم 2 ثم 1)", /^0550000004\|3 ; 0550000003\|2 ; 0550000002\|1$/.test(R.ledger), R.ledger);
  t("بحث السجل بالهاتف ⟵ زبون واحد، وفتح «كل الطلبات» يضيف صفاً للتفاصيل", R.ledSearch === 1 && R.ledOpen === 5, [R.ledSearch, R.ledOpen]);
  const m = R.mo;
  t("الطلب اليدوي: هاتف سليم/جديد ⟵ أخضر «زبون سليم»", !m.green.hidden && /زبون سليم/.test(m.green.txt) && !m.fresh.hidden && /زبون سليم/.test(m.fresh.txt), [m.green, m.fresh]);
  t("الطلب اليدوي: مرتجع واحد ⟵ إشعار برتقالي بالعدد، ومرتجعان ⟵ «احذر»، و3 ⟵ أحمر «خطر»", /1 مرتجع/.test(m.o1.txt) && /2 مرتجعان/.test(m.o2.txt) && /احذر/.test(m.o2.txt) && /3 مرتجعات/.test(m.red.txt) && /خطر/.test(m.red.txt), m);
  t("هاتف قصير ⟵ لا إشعار، والمحظور المؤكَّد ⟵ أحمر مع نص الحظر", m.short.hidden && /محظور/.test(m.blk.txt), [m.short, m.blk]);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
