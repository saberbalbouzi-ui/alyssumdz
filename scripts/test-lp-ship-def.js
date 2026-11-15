/* صفحات الهبوط المنشورة تحسب التوصيل من الشركة الافتراضية لا من المناطق: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-lp-ship-def.js */
const { chromium, devices } = require("playwright"); const fs = require("fs");
(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  const errs = [];
  for (const slug of ["honey-focus", "honey-focus-copy"]) {
    const html = fs.readFileSync("lp/" + slug + "/index.html", "utf8"); const m = /order-embed\.html\?[^"'\s]*oc=([^"'&\s]+)/.exec(html); const oc = m ? decodeURIComponent(m[1]) : "";
    ok(slug + ": الصفحة المنشورة تحمل نموذجاً مضمَّناً بإعداد sc=def", /"sc":"def"/.test(oc), oc.slice(0, 120));
    const c = await b.newContext({ ...devices["iPhone 13"] }), p = await c.newPage(); p.on("pageerror", e => errs.push(String(e)));
    await p.route(/supabase\.co|script\.google\.com|\/functions\/v1\//, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    const pm = /order-embed\.html\?p=([a-z0-9-]+)/.exec(html); const prod = pm ? pm[1] : "tarkiz";
    await p.goto("http://localhost:8765/order-embed.html?p=" + prod + "&embed=1&oc=" + encodeURIComponent(oc), { waitUntil: "load" }); await p.waitForTimeout(3500);
    const r = await p.evaluate(async () => { const w = WILAYAS.find(x => x.id === 8), z = { home: w.home, stop: w.stop }; const sel = document.getElementById("wilaya"); sel.value = "8"; sel.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(r => setTimeout(r, 600));
      const q = shipQuote(w, "", "home", 1800, pshipCo({}), null, undefined), qs = shipQuote(w, "", "stop", 1800, pshipCo({}), null, undefined); return { z, home: q.fee, stop: qs.fee, ocsc: typeof __OCSC !== "undefined" ? __OCSC : "?" }; });
    ok(slug + ": تكلفة الشحن لبشار من الشركة الافتراضية (WeCan 1000/800) لا المناطق (" + r.z.home + "/" + r.z.stop + ")", r.home === 1000 && r.stop === 800 && r.ocsc === "", r);
    await c.close();
  }
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
