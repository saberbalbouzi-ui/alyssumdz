/* الإطار البنفسجي للنص/العنوان الحر يحيط بنصّه دائماً: ارتفاع ثابت قادم من تحويل (hauto=false) يُصحَّح تلقائياً عند الفتح، ومن ضبط الارتفاع يدوياً (hfix) يُحترم، وسطر جديد أثناء الكتابة يوسّع الإطار. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { };
    const w = (id, html, y, extra) => ({ id, type: "text", set: Object.assign({ html, fs: { d: 20 }, color: "#123", fx: { d: 10 }, fy: { d: y }, fwd: { d: 30 }, fh: { d: 30 }, zi: 2 }, extra) });
    PBApp.open({ v: 1, title: "t", slug: "t-fr", ff: "Cairo", css: "", sections: [{ id: "s1", set: { kind: "canvas", mh: { d: 900, t: 900, m: 900 }, pad: { d: [0, 0, 0, 0] } }, free: [
      w("conv", "<p>نص طويل يلتفّ على عدة أسطر داخل إطار ارتفاعه ثابت صغير قادم من تحويل الصفحة وهذا لا يكفيه</p>", 40, { hauto: false }),
      w("manual", "<p>نص بارتفاع يدوي مقصود</p>", 300, { hauto: false, hfix: true, fh: { d: 200 } }),
      w("edit", "<p>سطر واحد</p>", 560, { hauto: false })], cols: [{ id: "c1", widgets: [] }] }] }, "", true); await new Promise(r => setTimeout(r, 2500)); });
  const info = id => p.evaluate(id => { const fr = document.getElementById("pbx-frame"), el = fr.contentDocument.querySelector('[data-pb="' + id + '"]'), tx = el.querySelector(".pb-t"), S = PBApp.E.page.sections[0].free.find(w => w.id === id).set; return { h: Math.round(el.getBoundingClientRect().height), content: Math.round(tx.scrollHeight), hauto: S.hauto, hfix: S.hfix }; }, id);
  const c = await info("conv"), m = await info("manual");
  t("نص بارتفاع ثابت صغير يصير إطاره بحجم نصّه (ارتفاع تلقائي) ولا يفيض", c.hauto === undefined && c.h >= c.content - 2, c);
  t("ارتفاع ضُبط يدوياً (hfix) يُحترم ويبقى 200", m.hauto === false && m.hfix === true && m.h >= 150, m);
  /* سطر جديد أثناء الكتابة يوسّع الإطار */
  const e0 = await info("edit");
  const pt = await p.evaluate(() => { const fr = document.getElementById("pbx-frame"), el = fr.contentDocument.querySelector('[data-pb="edit"]'), r = el.getBoundingClientRect(), f = fr.getBoundingClientRect(), k = PBApp.E.scale || 1; return { x: f.left + (r.left + r.width / 2) * k, y: f.top + (r.top + r.height / 2) * k }; });
  await p.mouse.dblclick(pt.x, pt.y); await p.waitForTimeout(500); await p.keyboard.press("End"); await p.keyboard.press("Enter"); await p.keyboard.type("سطر ثانٍ"); await p.keyboard.press("Enter"); await p.keyboard.type("سطر ثالث"); await p.waitForTimeout(600);
  const during = await p.evaluate(() => { const fr = document.getElementById("pbx-frame"), el = fr.contentDocument.querySelector('[data-pb="edit"]'), box = document.querySelector("#pbx-ovl .pbx-box"), k = PBApp.E.scale || 1; return { el: Math.round(el.getBoundingClientRect().height), box: box ? Math.round(box.getBoundingClientRect().height / 1) : null, k }; });
  t("أثناء الكتابة: سطران جديدان يوسّعان العنصر وإطاره البنفسجي يتبعه", during.el > e0.h + 20 && during.box && Math.abs(during.box - during.el * during.k) < 12, { e0, during });
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
