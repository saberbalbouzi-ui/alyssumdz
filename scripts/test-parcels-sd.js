/* «SD» بالأحمر بجانب وجهة الطرود إلى مكتب في بطاقتَي طرود ياليدين وطرود الشركة: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-parcels-sd.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const r = await p.evaluate(() => {
    const out = {}; const rowsY = [{ tracking: "yal-STOP", status: "En préparation", name: "أ", phone: "0550000001", wilaya: "الجزائر", commune: "x", date: "2026-11-10", orderId: "", price: 1000, stop: true }, { tracking: "yal-HOME", status: "En préparation", name: "ب", phone: "0550000002", wilaya: "الجزائر", commune: "y", date: "2026-11-10", orderId: "", price: 1000, stop: false }];
    AdminYd.set(rowsY, 2, false); const cy = [...document.querySelectorAll('tr[data-trk]')].filter(t => /^yal-(STOP|HOME)$/.test(t.dataset.trk));
    out.y = cy.map(t => ({ trk: t.dataset.trk, sd: !!t.querySelector(".o-sd") }));
    Admin.orders = [{ id: "S9", date: new Date().toISOString(), name: "ج", phone: "0550000003", wilaya: "الجزائر", commune: "z", dtype: "stop", desk: "مكتب", items: "م ×1 = 1 DA", subtotal: 1, fee: 0, total: 1, extra: {}, status: "confirmee", note: "🚚zrexpress_app:ZR-LINKED" }];
    const host = document.createElement("div"); document.body.appendChild(host);
    AdminCoP.draw(host, { key: "zrexpress_app", title: "ZR", rows: [{ tracking: "ZR-DIRECT", status: "x", client: "د", phone: "1", wilaya: "الجزائر", commune: "a", date: "2026-11-10", stop: true }, { tracking: "ZR-LINKED", status: "x", client: "هـ", phone: "2", wilaya: "الجزائر", commune: "b", date: "2026-11-10" }, { tracking: "ZR-HOME", status: "x", client: "و", phone: "3", wilaya: "الجزائر", commune: "c", date: "2026-11-10" }], at: Date.now() });
    out.c = [...host.querySelectorAll("tr[data-trk]")].map(t => ({ trk: t.dataset.trk, sd: !!t.querySelector(".o-sd") })); host.remove(); return out; });
  const g = (a, t) => (a.find(x => x.trk === t) || {}).sd;
  ok("ياليدين: SD لطرد المكتب فقط", g(r.y, "yal-STOP") === true && g(r.y, "yal-HOME") === false, r.y);
  ok("طرود الشركة: SD من حقل الطرد ومن طلب اللوحة المرتبط، وبدونه لا شيء", g(r.c, "ZR-DIRECT") === true && g(r.c, "ZR-LINKED") === true && g(r.c, "ZR-HOME") === false, r.c);
  const col = await p.evaluate(async () => { const out = {}; for (const m of ["dark", "white"]) { AdminTheme.set(m); await new Promise(r => setTimeout(r, 300)); AdminYd.set([{ tracking: "yal-S", status: "En préparation", name: "أ", phone: "1", wilaya: "Alger", commune: "x", date: "2026-11-10", orderId: "", price: 1, stop: true }], 1, false); const e = document.querySelector("tr[data-trk=yal-S] .o-sd"); out[m] = e ? getComputedStyle(e).color : null;
      const h = document.createElement("div"); h.innerHTML = '<span class="o-src man">يدوي</span><span class="o-src web">الموقع</span>'; document.body.appendChild(h); out[m + "S"] = [...h.children].map(x => getComputedStyle(x).color + "|" + getComputedStyle(x).backgroundColor); h.remove(); } return out; });
  const red = c => { const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(c || ""); return !!m && +m[1] > 180 && +m[1] > +m[2] + 70 && +m[1] > +m[3] + 30; };
  ok("«SD» أحمر في المظهرين الداكن والأبيض", red(col.dark) && red(col.white), col);
  ok("وسما «يدوي/الموقع» ملوّنان وبخلفية غير شفافة في المظهرين", [col.darkS, col.whiteS].every(a => a.every(x => !/rgba\(0, 0, 0, 0\)$/.test(x.split("|")[1]) && !/^rgb\(15, 23, 42\)/.test(x))), col);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
