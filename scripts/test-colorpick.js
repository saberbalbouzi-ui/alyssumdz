/* منتقي الألوان الموحَّد: يحلّ محلّ نافذة المتصفح (فرنسية/إنجليزية) بعربي/فرنسي حسب لغة اللوحة + قطّارة من صورة على الهاتف. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright"), zlib = require("zlib");
function png(w, h, rgb) { const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; } } const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; } const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; const ch = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); }; const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch("IHDR", ih), ch("IDAT", zlib.deflateSync(raw)), ch("IEND", Buffer.alloc(0))]); }
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 800 } }), p = await c.newPage(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|generativelanguage/, r => r.abort());
  await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "load" }); await p.waitForTimeout(1200);
  await p.evaluate(() => { document.body.insertAdjacentHTML("beforeend", '<input type="color" id="tc" value="#ff0000" style="position:fixed;top:5px;left:5px;z-index:9">'); window.__ev = []; const e = document.getElementById("tc"); ["input", "change"].forEach(k => e.addEventListener(k, () => window.__ev.push(k + ":" + e.value))); });
  await p.click("#tc"); await p.waitForSelector("#cpk-box");
  const r1 = await p.evaluate(() => ({ title: document.querySelector("#cpk-box h4").textContent, hex: document.getElementById("cpk-hex").value, eye: document.getElementById("cpk-eye").textContent, w: document.getElementById("cpk-box").getBoundingClientRect().width, vw: innerWidth }));
  t("النافذة عربية وتُظهر اللون الحالي وقطّارة وتتسع للهاتف", r1.title === "اختيار اللون" && r1.hex === "#FF0000" && /قطّارة/.test(r1.eye) && r1.w <= r1.vw, r1);
  await p.fill("#cpk-hex", "#12ab34"); await p.click(".cpk-ok");
  const r2 = await p.evaluate(() => ({ v: document.getElementById("tc").value, ev: window.__ev, open: !!document.getElementById("cpk-box") }));
  t("إدخال HEX ثم «تعيين» يضبط القيمة ويُطلق input وchange وتُغلق النافذة", r2.v === "#12ab34" && r2.ev.some(x => x.startsWith("change:#12ab34")) && !r2.open, r2);
  await p.click("#tc"); await p.waitForSelector("#cpk-box"); await p.click("#cpk-bas button:nth-child(4)"); await p.click(".cpk-no");
  t("«إلغاء» يعيد اللون السابق", (await p.evaluate(() => document.getElementById("tc").value)) === "#12ab34");
  await p.click("#tc"); await p.waitForSelector("#cpk-box"); const box = await p.locator("#cpk-sv").boundingBox(); await p.mouse.click(box.x + box.width - 10, box.y + 10); await p.click(".cpk-ok");
  const v3 = await p.evaluate(() => document.getElementById("tc").value); t("النقر على أعلى يمين لوحة اللون يعطي لوناً ساطعاً مشبعاً", /^#[0-9a-f]{6}$/.test(v3) && v3 !== "#12ab34", v3);
  // قطّارة من صورة (الهاتف: بلا EyeDropper)
  await p.evaluate(() => { try { delete window.EyeDropper; } catch (e) { window.EyeDropper = undefined; } });
  await p.click("#tc"); await p.waitForSelector("#cpk-box");
  const fc = p.waitForEvent("filechooser"); await p.click("#cpk-eye"); const f = await fc; await f.setFiles({ name: "a.png", mimeType: "image/png", buffer: png(40, 40, [10, 200, 90]) });
  await p.waitForSelector("#cpk-img", { state: "visible" }); await p.waitForTimeout(200);
  const cb = await p.locator("#cpk-cv canvas").boundingBox(); await p.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2); await p.click(".cpk-ok");
  t("القطّارة من صورة تلتقط اللون بدقة", (await p.evaluate(() => document.getElementById("tc").value)) === "#0ac85a", await p.evaluate(() => document.getElementById("tc").value));
  // ألوان الصفحة المفتوحة في المطوّر
  await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; PBApp.open({ v: 1, title: "t", slug: "t-cp", ff: "Cairo", css: "a{color:#AB12CD}", sections: [{ id: "s1", set: { kind: "canvas", mh: { d: 300, t: 300, m: 300 }, bg: "#112233" }, free: [{ id: "x", type: "text", set: { color: "#112233", href: "#fad", bg: "rgba(10,20,30,.5)" } }], cols: [] }] }, "", true); await new Promise(r => setTimeout(r, 1200)); });
  await p.evaluate(() => { document.getElementById("tc").value = "#000000"; }); await p.evaluate(() => AdminColorPick.open(document.getElementById("tc"))); await p.waitForSelector("#cpk-box");
  const pg = await p.evaluate(() => [...document.querySelectorAll("#cpk-pg button")].map(b => b.dataset.c));
  t("ألوان الصفحة المستعملة تظهر بترتيب التكرار بلا روابط", pg[0] === "#112233" && pg.includes("#ab12cd") && pg.includes("#0a141e") && !pg.includes("#ffaadd") && !pg.includes("#fad") && !pg.includes("#ffaadd"), pg);
  await p.click('#cpk-pg button[data-c="#ab12cd"]'); await p.click(".cpk-ok"); t("اختيار لون من ألوان الصفحة يُطبَّق", (await p.evaluate(() => document.getElementById("tc").value)) === "#ab12cd");
  // الفرنسية
  await p.evaluate(() => AdminI18n.set("fr")); await p.waitForTimeout(500); await p.evaluate(() => AdminColorPick.open(document.getElementById("tc"))); await p.waitForSelector("#cpk-box"); await p.waitForTimeout(500);
  const fr = await p.evaluate(() => ({ h: document.querySelector("#cpk-box h4").textContent, ok: document.querySelector(".cpk-ok").textContent, no: document.querySelector(".cpk-no").textContent, pgl: (document.querySelector("#cpk-pg") || {}).previousElementSibling ? document.querySelector("#cpk-pg").previousElementSibling.textContent : "" }));
  t("بالفرنسية تُترجَم النافذة (وألوان الصفحة)", /Choisir/.test(fr.h) && /Couleurs de la page/.test(fr.pgl) && /Définir/.test(fr.ok) && /Annuler/.test(fr.no), fr);
  await p.click(".cpk-no"); t("«Annuler» يغلق", !(await p.$("#cpk-box")));
  await p.evaluate(() => document.getElementById("tc").setAttribute("data-native-color", "1")); t("بلا أخطاء JS", errs.filter(m => !/sandboxed/.test(m)).length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
