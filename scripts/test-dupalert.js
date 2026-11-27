/* تنبيه الطلب المكرَّر (نفس الزبون خلال 3 أيام) + «آخر الطلبات غير المسلَّمة» في الرئيسية. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1300, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.removeItem("alyssum_lang"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    document.getElementById("app").classList.remove("hidden"); const msgs = []; window.toast = m => msgs.push(String(m)); const A = Admin, o = {};
    const day = n => new Date(Date.now() - n * 864e5).toISOString();
    const mk = (id, ph, name, d, st, note) => ({ id, date: day(d), name, phone: ph, wilaya: "Alger", commune: "x", dtype: "home", items: "عسل ×1 = 2000 DA", subtotal: 2000, fee: 0, total: 2000, status: st, note: note || "" });
    A.orders = [mk("D1", "0550123456", "كريم بن علي", 2, "confirmee", "🚚wecan:WC1"), mk("D2", "0550 12 34 56", "كريم بن علي", 0, "nouvelle"), mk("D3", "0661000000", "سعيد", 0, "nouvelle"), mk("D4", "0550123456", "كريم بن علي", 6, "livree", "🚚wecan:WC4"), mk("D5", "0777000000", "منير", 1, "livree"), mk("D6", "0777000001", "ياسين", 1, "annulee")];
    o.d2 = AdminDup.others(A.orders[1]).map(x => x.id).sort(); o.d3 = AdminDup.others(A.orders[2]).length; o.d4 = AdminDup.others(A.orders[3]).length;
    A.orderFilters.showShipped = true; A.tab("orders"); A.resetOrderFilters(); const c = document.getElementById("order-show-shipped"); if (c) c.checked = true; A.applyOrderFilters(); await new Promise(r => setTimeout(r, 500));
    o.badges = document.querySelectorAll("#orders-table .dupb").length;
    let asked = 0; window.confirm = m => { asked++; o.msg = m; return false; };
    o.sendDup = await A.sendOrderToDelivery(1, "wecan"); o.asked = asked;
    A._autoReg = true; asked = 0; o.sendAuto = await A.sendOrderToDelivery(1, "wecan"); o.autoFail = A._autoFail || ""; o.askedAuto = asked; A._autoReg = false;
    asked = 0; await A.sendOrderToDelivery(2, "wecan"); o.askedPlain = asked;
    A.tab("home"); await new Promise(r => setTimeout(r, 1500)); const home = document.getElementById("ahome"); o.home = home ? home.innerText : "";
    o.dupBtn = !!document.querySelector("#ahome [data-dup]"); return o; });
  t("الطلب المكرّر: الزبون نفسه (الهاتف بصيغتين) خلال 3 أيام فقط، لا بعد 6 أيام ولا لزبون آخر", JSON.stringify(R.d2) === JSON.stringify(["D1"]) && R.d3 === 0 && R.d4 === 0, R);
  t("وسم ⚠️ «مكرّر» في جدول الطلبات للطلبين المتقاربين", R.badges === 2, R);
  t("إرسال طلب له مكرّر سبق تأكيده: يُسأل المستخدم ويُمنع عند الرفض", R.asked === 1 && R.sendDup === false && /#D1|D1/.test(R.msg || ""), R);
  t("الإرسال التلقائي يتوقف عند المكرّر ولا يسأل", R.sendAuto === false && R.askedAuto === 0 && /مكرّر/.test(R.autoFail), R);
  t("طلب بلا مكرّر لا يُسأل عنه", R.askedPlain === 0, R);
  t("الرئيسية: بند «طلب مكرّر» وزرّه، وبطاقة «آخر الطلبات غير المسلَّمة» بلا المسلَّم والملغى", R.dupBtn && /آخر الطلبات غير المسلَّمة/.test(R.home), R.home.slice(0, 300));
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
