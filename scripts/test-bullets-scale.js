/* قائمة المزايا الحرة: سحب زاوية إطارها يكبّر المحتوى كله (الخط والعلامة والفجوة) لا الإطار وحده. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  const VARS = { icon: { micon: "ic:check-circle", ms: { d: 18 }, gap: { d: 8 } }, disc: { mk: "disc", ms: { d: 18 }, gap: { d: 8 } }, badge: { mk: "bdc", ms: { d: 18 }, gap: { d: 8 } }, plain: { mk: "dec" } };
  for (const [name, extra] of Object.entries(VARS)) {
    await p.evaluate(async extra => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { };
      const set = Object.assign({ fs: { d: 21, t: 16, m: 14 }, fx: { d: 25 }, fy: { d: 100 }, fwd: { d: 25.3 }, fh: { d: 143 }, zi: 6, color: "#000", items: "يساعد على دعم التركيز\nيرفع القدرة على الحفظ\nيقوي الذاكرة" }, extra);
      PBApp.open({ v: 1, title: "t", slug: "t-bl", ff: "Cairo", css: "", sections: [{ id: "s1", set: { kind: "canvas", mh: { d: 700, t: 700, m: 700 }, pad: { d: [0, 0, 0, 0] } }, free: [{ id: "bl", type: "bullets", set }], cols: [{ id: "c1", widgets: [] }] }] }, "", true); await new Promise(r => setTimeout(r, 2000)); }, extra);
    const info = () => p.evaluate(() => { const fr = document.getElementById("pbx-frame"), el = fr.contentDocument.querySelector('[data-pb="bl"]'), li = el.querySelector("li"), w = fr.contentWindow, bi = li.querySelector(".pb-bi"), r = el.getBoundingClientRect(), ul = el.querySelector(".pb-bl").getBoundingClientRect(), bef = w.getComputedStyle(li, ":before"); return { fs: parseFloat(w.getComputedStyle(li).fontSize), pad: parseFloat(w.getComputedStyle(li).paddingInlineStart), gap: parseFloat(w.getComputedStyle(li).marginBottom), mk: bi ? parseFloat(w.getComputedStyle(bi).fontSize) : parseFloat(bef.fontSize), h: r.height, ulh: ul.height, w: r.width }; });
    const pt = await p.evaluate(() => { const fr = document.getElementById("pbx-frame"), el = fr.contentDocument.querySelector('[data-pb="bl"]'), r = el.getBoundingClientRect(), f = fr.getBoundingClientRect(), k = PBApp.E.scale || 1; return { x: f.left + (r.left + r.width / 2) * k, y: f.top + (r.top + r.height / 2) * k }; });
    await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(500);
    const a = await info();
    const h = await p.evaluate(() => { const e = document.querySelector("#pbx-ovl .pbx-box .pbx-h.d-se"); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.move(h.x, h.y); await p.mouse.down(); await p.mouse.move(h.x + 60, h.y + 40, { steps: 6 }); await p.mouse.move(h.x + 160, h.y + 100, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(600);
    const c = await info(), k = c.w / a.w;
    t(name + ": الخط يكبر مع الإطار", k > 1.5 && Math.abs(c.fs / a.fs - k) < .12 * k, { a, c, k });
    t(name + ": العلامة تكبر معه", Math.abs(c.mk / a.mk - k) < .12 * k, { a: a.mk, c: c.mk, k });
    if (extra.gap) t(name + ": الفجوة تكبر معه", c.gap > a.gap * k * .85, { a: a.gap, c: c.gap, k });
    t(name + ": القائمة داخل الإطار (لا فيض)", c.ulh <= c.h + 3, c);
  }
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
