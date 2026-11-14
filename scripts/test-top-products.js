/* أفضل المنتجات: توحيد المنتج الواحد المسمّى بعناوين مختلفة بالـ slug: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-top-products.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const r = await p.evaluate(() => {
    const A = Admin; A.products = [{ slug: "pa", title: "المنتج الأول", price: 1000 }, { slug: "pb", title: "المنتج الثاني", price: 1000 }]; const P = A.products[0], P2 = A.products[1];
    const mk = (id, lines, status) => ({ id, date: new Date().toISOString(), name: "ز", phone: "0550000000", wilaya: "الجزائر", commune: "x", dtype: "home", items: lines.map(l => l.title + " ×" + l.qty + " = 1000 DA").join("\n"), lines: lines.map(l => ({ slug: l.slug, title: l.title })), subtotal: 1, fee: 0, total: 1000, extra: {}, status: status || "confirmee", note: "" });
    A.orders = [mk("1", [{ title: "عنوان صفحة هبوط أ", slug: P.slug, qty: 5 }]), mk("2", [{ title: "عنوان ب", slug: P.slug, qty: 3 }]), mk("3", [{ title: P.title, slug: P.slug, qty: 2 }]), mk("4", [{ title: P2.title, slug: P2.slug, qty: 4 }]), mk("5", [{ title: "بلا slug", slug: "", qty: 1 }])];
    const o6 = mk("6", [{ title: "ثالث", slug: P.slug, qty: 7 }]); delete o6.lines; A.orders.push(o6);
    AdminHome.render(); const html = document.getElementById("ahome").innerText;
    const c = A.orderItemsCanon(A.orders[0]), c6 = A.orderItemsCanon(o6), cx = A.orderItemsCanon(Object.assign({}, A.orders[0], { lines: [{ slug: P.slug, title: "عنوان مختلف تماماً" }] }));
    return { pt: P.title, p2: P2.title, canon: c[0].title, noLines: c6[0].title, mismatch: cx[0].title, html }; });
  ok("البند بعنوان مختلف يُوحَّد باسم المنتج الحقيقي", r.canon === r.pt, r);
  ok("بلا lines يبقى العنوان كما هو (لا كسر)", r.noLines === "ثالث", r);
  ok("lines لا تطابق العنوان المقروء ⇒ لا توحيد (حماية)", r.mismatch === "عنوان صفحة هبوط أ", r);
  const sec = r.html.slice(r.html.indexOf("أفضل المنتجات"));
  ok("مبيعات المنتج الواحد تتجمّع: 5+3+2 = 10 قطع تحت اسمه", sec.includes(r.pt) && /10\s*قطعة/.test(sec), sec.slice(0, 300));
  ok("لا تظهر العناوين المتفرّقة منفصلة", !sec.includes("عنوان صفحة هبوط أ") && !sec.includes("عنوان ب"), sec.slice(0, 300));
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
