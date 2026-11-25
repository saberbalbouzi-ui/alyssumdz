/* السحب بالماوس يزيح العناصر التي أمام المسحوب افتراضياً (فلا يمكن وضع عنصر فوق صورة)، وخيار «السحب فوق العناصر دون إزاحتها (دائماً)» في قائمة العنصر يتيح ذلك بلا Alt/Ctrl ويُحفظ. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  const open = () => p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { };
    const pg = { v: 1, title: "t", slug: "t-dr", ff: "Cairo", css: "", sections: [{ id: "s1", set: { kind: "canvas", mh: { d: 700, m: 700, t: 700 }, pad: { d: [0, 0, 0, 0] } }, free: [
      { id: "img", type: "shape", set: { shape: "rect", fill: "#cde", fx: { d: 10 }, fy: { d: 40 }, fwd: { d: 60 }, fh: { d: 220 }, zi: 2 } },
      { id: "txt", type: "text", set: { html: "<p>بطاقة نص فوق الصورة</p>", fs: { d: 20 }, color: "#123", fx: { d: 20 }, fy: { d: 320 }, fwd: { d: 30 }, fh: { d: 90 }, zi: 3, hauto: false } }], cols: [{ id: "c1", widgets: [] }] }] };
    PBApp.open(pg, "", true); await new Promise(r => setTimeout(r, 2500)); });
  const drag = () => p.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)), fr = document.getElementById("pbx-frame"), el = fr.contentDocument.querySelector('[data-pb="txt"]'); const r = el.getBoundingClientRect(), f = fr.getBoundingClientRect(); const k = PBApp.E.scale || 1; return { x: f.left + (r.left + r.width / 2) * k, y: f.top + (r.top + r.height / 2) * k }; });
  const fys = () => p.evaluate(() => { const g = id => PBApp.E.page.sections[0].free.find(w => w.id === id).set; const n = x => Number(x && typeof x === "object" ? x.d : x); return { img: n(g("img").fy), imgH: n(g("img").fh), txt: n(g("txt").fy) }; });
  const doDrag = async () => { const c = await drag(); await p.mouse.click(c.x, c.y); await p.waitForTimeout(250); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.x, c.y - 120, { steps: 8 }); await p.mouse.move(c.x, c.y - 230, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(500); };
  await open(); const a0 = await fys(); await doDrag(); const a1 = await fys();
  t("افتراضياً: السحب فوق الصورة يزيحها (لا تبقى في مكانها)", a1.img !== a0.img || a1.txt >= a0.img + a0.imgH - 5, { a0, a1 });
  /* خيار السحب فوق العناصر من قائمة العنصر */
  await open(); await p.evaluate(() => { try { localStorage.removeItem("pbx_carry"); } catch (e) { } PBApp.E.carry = undefined; });
  const c0 = await drag(); await p.mouse.click(c0.x, c0.y); await p.waitForTimeout(250); await p.mouse.click(c0.x, c0.y, { button: "right" }); await p.waitForTimeout(400);
  const has = await p.evaluate(() => { const m = document.getElementById("pbx-ctx"); return !!m && /السحب فوق العناصر دون إزاحتها/.test(m.textContent); });
  t("الخيار ظاهر في قائمة العنصر", has, has);
  await p.evaluate(() => { const b = [...document.querySelectorAll("#pbx-ctx button")].find(x => /السحب فوق العناصر دون إزاحتها/.test(x.textContent)); b && b.click(); }); await p.waitForTimeout(300);
  const stored = await p.evaluate(() => localStorage.getItem("pbx_carry"));
  await doDrag(); const b1 = await fys();
  t("مع الخيار: الصورة تبقى في مكانها والنص صار فوقها", b1.img === a0.img && b1.txt < a0.img + a0.imgH - 20, { a0, b1 });
  t("الخيار يُحفظ في المتصفح", stored === "1", stored);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
