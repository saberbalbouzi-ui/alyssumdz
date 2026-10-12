/* لقطات مراجعة للخبراء: يبني حزمة نظيفة ويثبّتها ويصوّر المتجر (حاسوب/جوال) وكل أقسام اللوحة.
   NODE_PATH=/opt/node-tools/node_modules node scripts/review-shots.js <مجلد الإخراج> */
const { spawn, spawnSync } = require("child_process"), fs = require("fs"), path = require("path"), os = require("os");
const { chromium } = require("playwright");
const root = path.join(__dirname, ".."), outDir = path.resolve(process.argv[2] || "/tmp/review-shots"), PORT = 8600 + Math.floor(Math.random() * 300), PW = "TestPass12345";
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const out = path.join(root, "dist", "shots"), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "shots-"));
  fs.rmSync(out, { recursive: true, force: true });
  const b = spawnSync("python3", ["scripts/make-template.py", "--target", "php", "--out", "dist/shots", "--name", "Alyssum", "--wa", "213550000000"], { cwd: root, encoding: "utf8" });
  const code = (/([0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4})/.exec(b.stdout) || [])[1]; if (!code) { console.log("فشل البناء"); process.exit(2); }
  fs.cpSync(out, tmp, { recursive: true });
  const php = spawn("php", ["-S", "127.0.0.1:" + PORT, "-t", tmp], { stdio: "ignore" }); process.on("exit", () => { try { php.kill(); } catch (e) { } fs.rmSync(out, { recursive: true, force: true }); fs.rmSync(tmp, { recursive: true, force: true }); });
  await new Promise(r => setTimeout(r, 1500)); const base = "http://127.0.0.1:" + PORT;
  await fetch(base + "/install.php", { method: "POST", body: new URLSearchParams({ code, pw: PW, pw2: PW, name: "Alyssum", wa: "213550000000" }) });
  const br = await chromium.launch(), shot = async (p, name, full) => { await p.waitForTimeout(700); await p.screenshot({ path: path.join(outDir, name + ".png"), fullPage: !!full }); console.log(name); };
  for (const [tag, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844, isMobile: true, hasTouch: true }]]) {
    const ctx = await br.newContext({ viewport: vp }), p = await ctx.newPage();
    for (const [n, u] of [["home", "/"], ["product", "/p/demo/"], ["shop", "/shop.html"], ["account", "/account.html"]]) { try { await p.goto(base + u); await p.waitForTimeout(1500); await shot(p, "store-" + tag + "-" + n, true); } catch (e) { console.log("skip", n, e.message); } }
    await ctx.close();
  }
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage();
  await p.goto(base + "/admin.html"); await p.waitForTimeout(1200);
  await p.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW);
  await p.waitForFunction(() => typeof Admin !== "undefined" && Admin.products && document.querySelector("#app .top"), null, { timeout: 20000 }); await p.waitForTimeout(2500);
  const tabs = await p.evaluate(() => [...document.querySelectorAll("[id^=tab-]")].map(e => e.id.slice(4)).filter(Boolean));
  for (const t of tabs) { try { await p.evaluate(t => { try { Admin.tab(t); } catch (e) { } }, t); await shot(p, "admin-" + t, false); } catch (e) { console.log("skip", t); } }
  const mc = await br.newContext({ viewport: { width: 390, height: 844, isMobile: true, hasTouch: true } }), mp = await mc.newPage();
  await mp.goto(base + "/admin.html"); await mp.waitForTimeout(1200);
  await mp.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW);
  await mp.waitForFunction(() => typeof Admin !== "undefined" && Admin.products && document.querySelector("#app .top"), null, { timeout: 20000 }); await mp.waitForTimeout(2500);
  for (const t of ["home", "orders", "products", "finance"]) { try { await mp.evaluate(t => Admin.tab(t), t); await shot(mp, "admin-mobile-" + t, false); } catch (e) { } }
  await br.close(); process.exit(0);
})();
