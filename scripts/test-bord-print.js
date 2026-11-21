/* طباعة البوردرو: زر «طباعة» واختيار A4 (4 في الورقة) أو A6 لكل الشركات، للطلب الواحد وللمحدَّد. NODE_PATH=/opt/node-tools/node_modules node scripts/test-bord-print.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 120)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    document.getElementById("app").classList.remove("hidden"); const A = Admin, out = {};
    const wins = []; window.open = () => { const w = { html: "", document: { open() { w.html = ""; }, write(h) { w.html += h; }, close() { } }, location: {}, close() { w.closed = true; } }; wins.push(w); return w; };
    // 1) نافذة الاختيار
    const pr = A.bordAsk(3); out.dlg = !!document.querySelector("#bord-fmt-bg button[data-f=a4]") && !!document.querySelector("#bord-fmt-bg button[data-f=a6]") && /3 بوردرو/.test(document.querySelector("#bord-fmt-bg h3").textContent);
    document.querySelector("#bord-fmt-bg button[data-f=a6]").click(); const a = await pr; out.pick = a && a.fmt === "a6" && !!a.w && localStorage.getItem("alyssum_bord_fmt") === "a6" && !document.getElementById("bord-fmt-bg");
    const pc = A.bordAsk(1); document.querySelector("#bord-fmt-bg button[data-f='']").click(); out.cancel = (await pc) === null;
    // 2) دمج PDF حقيقي: A4 ← ورقة واحدة لـ3، A6 ← ثلاث أوراق
    const P = await A.loadPdfLib(), mk = async () => { const d = await P.PDFDocument.create(), pg = d.addPage([300, 420]); pg.drawRectangle({ x: 10, y: 10, width: 100, height: 100 }); return await d.save(); }, bytes = [await mk(), await mk(), await mk()];
    const m4 = await A.mergePdf4(bytes, [false, false, false]), m6 = await A.mergePdfA6(bytes, [false, false, false]); const d6 = await P.PDFDocument.load(m6.bytes), sz = d6.getPage(0).getSize();
    out.merge = { a4: m4.sheets, a6: m6.sheets, w: Math.round(sz.width), h: Math.round(sz.height) };
    // 3) HTML (E-com): A4 أربعة/ورقة ثم A6 ورقة لكل بوردرو
    A.deliveryCfg = A.deliveryCfg || {}; A.courierFetch = async () => ({ ok: true, status: 200, text: "<!doctype html><html><body><div>LBL</div></body></html>" });
    const mkO = i => ({ o: { id: "X" + i, name: "z" + i, wilaya: "Alger" }, t: { company: "ecomdelivery", tracking: "EC" + i } }), L = [1, 2, 3, 4, 5].map(mkO);
    await A.printBordereaux(L, wins[wins.length - 1] = (() => { const w = { html: "", document: { open() { w.html = ""; }, write(h) { w.html += h; }, close() { } }, location: {}, close() { } }; return w; })(), "a4"); const h4 = wins[wins.length - 1].html;
    const w6 = { html: "", document: { open() { w6.html = ""; }, write(h) { w6.html += h; }, close() { } }, location: {}, close() { } }; await A.printBordereaux(L, w6, "a6");
    out.html = { a4sheets: (h4.match(/class="sheet"/g) || []).length, a4frames: (h4.match(/<iframe/g) || []).length, a6frames: (w6.html.match(/<iframe/g) || []).length, a6sheet: /class="sheet"/.test(w6.html), a6page: /size:A6/.test(w6.html) };
    // 4) أسماء الأزرار
    const ix = 0; A.orders = [{ id: "M1", name: "x", phone: "0550000000", wilaya: "Alger", status: "confirmee", total: 1000, items: "a ×1 = 1000 DA", note: " 🚚ecomdelivery:EC1", date: new Date().toISOString() }];
    out.btn = typeof A.printOrderBord === "function" && /Admin\.printOrderBord\(/.test(document.documentElement.innerHTML) || true;
    return out;
  });
  t("نافذة اختيار الحجم: A4 وA6 وإلغاء، وتحفظ آخر اختيار وتفتح نافذة الطباعة ضمن النقرة", R.dlg && R.pick && R.cancel, R);
  t("دمج حقيقي: 3 بوردرو ← ورقة A4 واحدة (4 في الورقة)، وA6 ← 3 أوراق بمقاس 105×148مم", R.merge.a4 === 1 && R.merge.a6 === 3 && R.merge.w === 298 && R.merge.h === 420, R.merge);
  t("بوردرو E-com (صفحة HTML): A4 ← 5 بوردرو في ورقتين (4+1)، وA6 ← ورقة لكل بوردرو بلا شبكة", R.html.a4sheets === 2 && R.html.a4frames === 5 && R.html.a6frames === 5 && !R.html.a6sheet && R.html.a6page, R.html);
  const L = await p.evaluate(() => ({ cfg: /طباعة<\/button>|"طباعة"/.test(Admin.printOrderBord.toString()) || true, src: [Admin.printBordereauxFor, Admin.bordPrintList, Admin.printOrderBord].every(f => typeof f === "function") }));
  t("نقاط الدخول موجودة (طلب واحد، محدَّد، الكل)", L.src, L);
  const txt = await p.evaluate(() => fetch("admin.html").then(r => r.text()).then(h => ({ old: /بوليصة الشركة<\/button>|"طباعة بوردرو الشركة"|🏷️ بوردرو الشركة/.test(h), neu: /Admin\.printOrderBord\(' \+ i \+ '\)[^>]*>🖨 طباعة<\/button>/.test(h) })));
  t("الأزرار صارت «طباعة» ولا بقي «بوردرو الشركة/بوليصة الشركة» على الأزرار", !txt.old && txt.neu, txt);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
