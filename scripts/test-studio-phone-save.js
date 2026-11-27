/* استوديو 3D على الهاتف: زر «صورة» (تحميل) ظاهر داخل الشاشة ويفتح التصدير وينزّل صورة؛ و«ابدأ الآن» أسود بنص أبيض. NODE_PATH=/opt/node-tools/node_modules */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const c = await b.newContext({ ...devices["Pixel 7"], acceptDownloads: true }), p = await c.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); await new Promise(r => setTimeout(r, 600)); Studio3D.open({ tab: "box" }); for (let i = 0; i < 40 && !document.getElementById("exportBtn"); i++) await new Promise(r => setTimeout(r, 300)); await new Promise(r => setTimeout(r, 2500)); });
  const ex = await p.evaluate(() => { const e = document.querySelector("#s3d-bar .ex"), r = e.getBoundingClientRect(); return { txt: e.innerText.trim(), vis: r.width > 0, right: Math.round(r.right), W: innerWidth, left: Math.round(r.left) }; });
  t("زر «صورة» (تحميل) ظاهر داخل الشاشة", /صورة/.test(ex.txt) && ex.vis && ex.left >= 0 && ex.right <= ex.W, ex);
  await p.click("#s3d-bar .ex"); await p.waitForTimeout(600);
  t("يفتح نافذة التصدير", await p.evaluate(() => document.getElementById("dExport").open), 0);
  const dl = p.waitForEvent("download", { timeout: 20000 }).catch(() => null); await p.evaluate(() => document.getElementById("exGo").click()); const d = await dl;
  t("ينزّل صورة", !!d && /\.(png|jpg|webp)$/.test(d.suggestedFilename()), d && d.suggestedFilename());
  await p.evaluate(() => { try { document.getElementById("dExport").close(); } catch (e) { } Studio3D.close(); });
  const bt = await p.evaluate(async () => { document.documentElement.classList.add("white"); Admin.tab("studio"); await new Promise(r => setTimeout(r, 800)); const cat = AdminStudio.catalog(), tl = cat.find(x => !x.landing) || cat[0]; await AdminStudio.open(tl.id); await new Promise(r => setTimeout(r, 1200)); const e = document.querySelector("#tab-studio .sd-act button"); if (!e) return null; const cs = getComputedStyle(e); return { bg: cs.backgroundColor, c: cs.color }; });
  console.log("btn", JSON.stringify(bt)); t("«ابدأ الآن» أسود بنص أبيض", !!bt && (bt.bg === "rgb(11, 15, 20)" && bt.c === "rgb(255, 255, 255)"), bt);
  t("بلا أخطاء JS", !errs.length, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
