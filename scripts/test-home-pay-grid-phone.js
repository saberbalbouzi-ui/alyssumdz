/* الهاتف: بطاقات «صافي الشركات» في عمودين لا عمود طويل واحد؛ والمكتب كما هو. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  for (const [name, vp, want] of [["هاتف", { width: 412, height: 840 }, 2], ["مكتب", { width: 1280, height: 900 }, null]]) {
    const p = await b.newPage({ viewport: vp }); const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
    await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
    await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
    const r = await p.evaluate(() => { document.getElementById("app").classList.remove("hidden"); try { AdminHome.render(); } catch (e) { } if (!document.getElementById("ahome-css")) return { err: "no css" }; const h = document.createElement("div"); h.id = "ahome"; h.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9"; h.innerHTML = '<div class="ah-pay">' + [1, 2, 3, 4].map(i => '<div class="ah-pc"><b>Co' + i + '</b><strong>0</strong><span>x</span></div>').join("") + "</div>"; document.body.appendChild(h);
      const cs = getComputedStyle(h.querySelector(".ah-pay")), cols = cs.gridTemplateColumns.split(" ").length, w = [...h.querySelectorAll(".ah-pc")].map(e => Math.round(e.getBoundingClientRect().width)); return { cols, w }; });
    if (want) t(name + ": عمودان", r.cols === want, r); else t(name + ": أكثر من عمودين (كما كان)", r.cols >= 3, r);
    t(name + ": بلا أخطاء", errs.length === 0, errs); await p.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
