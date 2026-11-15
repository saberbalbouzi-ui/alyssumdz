/* ترتيب أرقام المبلغ في بطاقات العرض بمرحلة الطلب (1 800 لا 800 1): python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-offer-price-dir.js */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ ...devices["iPhone 13"] }), p = await c.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.route(/assets\/data\/checkout\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ steps: true, showOffers: true, phoneDz: true, guard: {} }) }));
  await p.route(/supabase\.co|script\.google\.com|\/functions\/v1\//, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.goto("http://localhost:8765/p/anti-acne/", { waitUntil: "load" }); await p.waitForTimeout(3500);
  await p.goto("http://localhost:8765/p/anti-acne/", { waitUntil: "load" }); await p.waitForTimeout(3500);
  await p.evaluate(() => { document.getElementById("acg-ov")?.remove(); });
  const r = await p.evaluate(() => {
    const out = []; document.querySelectorAll(".os-off b").forEach(bb => { const t = bb.firstChild; if (!t || t.nodeType !== 3) return; const txt = t.textContent; const m = /(\d)[   ](\d{3})/.exec(txt); if (!m) { out.push({ txt, grouped: false }); return; }
      const rg = document.createRange(); const i1 = m.index, i2 = m.index + m[0].length - 3; rg.setStart(t, i1); rg.setEnd(t, i1 + 1); const a = rg.getBoundingClientRect(); rg.setStart(t, i2); rg.setEnd(t, i2 + 1); const z = rg.getBoundingClientRect();
      out.push({ txt: JSON.stringify(txt), firstDigitLeftOfThousands: a.left < z.left, sep: txt.charCodeAt(m.index + 1).toString(16) }); }); return out; });
  ok("توجد بطاقات عرض بمبالغ بآلاف", r.some(x => x.grouped !== false), r);
  ok("في كل مبلغ بآلاف: الرقم الأول على يسار الثلاثة أرقام (1 800 لا 800 1)", r.filter(x => x.grouped !== false).every(x => x.firstDigitLeftOfThousands === true), r);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
