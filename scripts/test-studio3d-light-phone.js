/* استوديو 3D على الهاتف في المظهر الفاتح: تسميات «قوالب القص» (لوح داكن) فاتحة مقروءة، وأيقونات رأس استوديو العلب مقروءة (رأس داكن بأيقونات فاتحة)، وشريط التبويبات لا يتقطع. NODE_PATH=/opt/node-tools/node_modules */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const lum = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ""); return m ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 : null; };
  const run = async tab => { const c = await b.newContext({ ...devices["Pixel 7"], colorScheme: "light" }), p = await c.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
    await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
    await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
    const r = await p.evaluate(async tab => { document.getElementById("app").classList.remove("hidden"); document.documentElement.classList.add("white"); await new Promise(r => setTimeout(r, 600)); Studio3D.open({ tab }); await new Promise(r => setTimeout(r, 6500));
      const bar = document.getElementById("s3d-bar"), o = { bar: bar && { h: Math.round(bar.getBoundingClientRect().height), sh: bar.scrollHeight, out: [...bar.children].filter(e => e.getBoundingClientRect().width > 0 && (e.getBoundingClientRect().left < -1 || e.getBoundingClientRect().right > innerWidth + 1)).length } };
      if (tab === "cut") { const l = [...document.querySelectorAll("#bp-bg label")].find(e => e.offsetParent && /الطول/.test(e.textContent)); o.label = l && getComputedStyle(l).color; }
      else { const s = document.getElementById("saveBtn"); o.save = s && getComputedStyle(s).color; o.bg = s && getComputedStyle(document.querySelector("#bs .top")).backgroundColor; } return o; }, tab);
    await c.close(); return { r, errs }; };
  const cut = await run("cut"), box = await run("box");
  t("قوالب القص: تسمية «الطول» فاتحة على اللوح الداكن", cut.r.label && lum(cut.r.label) > 0.6, cut.r);
  t("استوديو العلب: رأس داكن بأيقونات فاتحة (لا فاتحة على أبيض)", box.r.save && lum(box.r.bg) < 0.25 && lum(box.r.save) > 0.6, box.r);
  t("شريط التبويبات العلوي لا يتقطع (ارتفاع المحتوى ≤ ارتفاع الشريط)", cut.r.bar.sh <= cut.r.bar.h + 2 && box.r.bar.sh <= box.r.bar.h + 2, { c: cut.r.bar, b: box.r.bar });
  t("كل أزرار الشريط العلوي داخل عرض الشاشة (لا شيء يخرج منها)", cut.r.bar.out === 0 && box.r.bar.out === 0, { c: cut.r.bar, b: box.r.bar });
  t("بلا أخطاء JS", cut.errs.length === 0 && box.errs.length === 0, [cut.errs, box.errs]);
  await b.close(); process.exit(bad ? 1 : 0);
})();
