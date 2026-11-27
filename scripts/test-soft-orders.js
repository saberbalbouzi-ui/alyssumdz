/* المظهر الناعم: بطاقات إحصاء الطلبات تعرض أعداداً صحيحة، وزرّا التحقق/الأرشيف متجاوران، وتجهيز الطلبات فيه رأس. NODE_PATH=/opt/node-tools/node_modules */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ ...devices["iPhone 13"], colorScheme: "light" }), p = await c.newPage(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|generativelanguage/, r => r.abort());
  await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.setItem("admin_theme", "white"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(7000);
  const r = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; document.getElementById("login-box") && document.getElementById("login-box").classList.add("hidden"); await new Promise(r => setTimeout(r, 2500));
    const mk = (id, st, d) => ({ id, date: new Date(Date.now() - d * 864e5).toISOString(), name: "ز" + id, phone: "0550000" + id.slice(-3), wilaya: "Alger", commune: "x", dtype: "home", items: "عسل ×1 = 2000 DA", subtotal: 2000, fee: 0, total: 2000, status: st, note: "" });
    Admin.orders = [mk("A1", "expediee", 0), mk("A2", "nouvelle", 0), mk("A3", "nouvelle", 2), mk("A4", "livree", 5), mk("A5", "confirmee", 1)];
    Admin.tab("orders"); await new Promise(r => setTimeout(r, 800)); Admin.tab("orders"); const co = document.getElementById("order-co-chips"); co.removeAttribute("hidden"); co.innerHTML = "<button>الكل 5</button><button>Yalidine 1</button><button>WeCan 4</button>"; await new Promise(r => setTimeout(r, 2200));
    const g = id => (document.getElementById(id) || {}).textContent, v = document.getElementById("verify-btn").getBoundingClientRect(), a = document.getElementById("cc-btn").getBoundingClientRect(), m = document.getElementById("mo-btn").getBoundingClientRect();
    const fold = document.getElementById("co-fold"), cv0 = getComputedStyle(co).display; fold.click(); const cv1 = getComputedStyle(co).display; const chips = [...document.querySelectorAll("#ord-chiprow .opv")].filter(e => e.offsetParent).length, inMore = ["trash-btn", "arch-btn", "order-filter-status"].every(i => document.getElementById(i).closest("#of-more")), srch = document.querySelector("#order-filter-q").getBoundingClientRect(), chr = document.getElementById("ord-chiprow").getBoundingClientRect();
    return { fold: cv0 === "none" && cv1 !== "none" && document.getElementById("cf-n").textContent === "2", chips, inMore, below: chr.top > srch.bottom - 2, total: g("os-total"), today: g("os-today"), wait: g("os-wait"), way: g("os-way"), sameRow: Math.abs(v.top - a.top) < 6 && Math.abs(v.left - a.left) > 40, moFull: m.width > 0.8 * (v.width + a.width), moFirst: m.top < v.top }; });
  t("الإجمالي 5 · اليوم 2 · الانتظار 2 · الطريق 1", r.total === "5" && r.today === "2" && r.wait === "2" && r.way === "1", r);
  t("صف شركات التوصيل قابل للطيّ (2)، والشرائح ثلاث، والأدوات داخل «فلاتر»، والشرائح تحت البحث", r.fold && r.chips <= 3 && r.chips >= 1 && r.inMore && r.below, r);
  t("«إضافة طلب جديد» أول وأعرض، والزرّان الثانويان في صف واحد", r.moFull && r.moFirst && r.sameRow, r);
  const k = await p.evaluate(async () => { Admin.tab("pack"); await new Promise(r => setTimeout(r, 1200)); AdminPack._S.err = ""; AdminPack._S.busy = false; AdminPack._S.rows = [{ id: "A1", name: "ز", wilaya: "Alger", items: "عسل ×2 = 4000 DA", status: "confirmee", packed: false }]; AdminPack.draw(); await new Promise(r => setTimeout(r, 500)); return { head: !!document.querySelector("#pk .ord-head h2"), cam: !!document.querySelector('#pk [data-pk="cam"]') }; });
  t("تجهيز الطلبات: رأس الصفحة وزر الكاميرا", k.head && k.cam, k);
  const cc = await p.evaluate(async () => { Admin.tab("callcenter"); await new Promise(r => setTimeout(r, 1200)); const mk2 = (id, st, d) => ({ id, date: new Date(Date.now() - d * 6e4).toISOString(), name: "عادل", phone: "0553122171", wilaya: "Béchar", commune: "Béchar", dtype: "home", items: "عسل ×3 = 4000 DA", subtotal: 4000, fee: 0, total: 4000, status: st, note: "" }); Admin.orders = [mk2("A1", "nouvelle", 27), mk2("A2", "nouvelle", 80)]; CallCenter.render(); await new Promise(r => setTimeout(r, 600));
    const g = s => document.querySelector(s), c = g('#ccm .ccm-act [data-d=confirm]').getBoundingClientRect(), l = g('#ccm .ccm-act [data-d=later]').getBoundingClientRect(), x = g('#ccm .ccm-act [data-d=cancel]').getBoundingClientRect(), t2 = g('#ccm .ccm-act [data-d=tomorrow]').getBoundingClientRect();
    return { stats: [...document.querySelectorAll("#ccm .ord-stats .os b")].map(e => e.textContent).join(), head: !!g("#ccm .ord-head h2"), row3: Math.abs(l.top - x.top) < 6 && Math.abs(l.top - t2.top) < 6, confirmWide: c.width > 2.5 * l.width }; });
  t("تأكيد الطلبات: رأس وأربع بطاقات (متبقية=2) وثلاثة أزرار بصف واحد وتأكيد عريض", cc.head && /^0,0%,2,2$/.test(cc.stats) && cc.row3 && cc.confirmWide, cc);
  t("بلا أخطاء JS", !errs.length, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
