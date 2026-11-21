/* جدول داخل .rtw يمرّر نفسه (طرود ياليدين) على الجوال: شريط التحديد وشريط السحب نسخة واحدة لا يتضاعفان. NODE_PATH=/opt/node-tools/node_modules node scripts/test-bars-dup.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 430, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 120)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(process_theme => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.setItem("admin_theme", process_theme); } catch (e) { } }, process.env.THEME || "glass");
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async (process_n) => { if (window.__white) { document.documentElement.classList.add("white"); document.documentElement.classList.remove("glass"); }
    document.getElementById("app").classList.remove("hidden"); document.querySelectorAll("[id^=tab-]").forEach(x => x.classList.add("hidden")); const ts = document.getElementById("tab-shipped"); ts.classList.remove("hidden"); const l = document.querySelector(".login"); if (l) l.classList.add("hidden");
    const rows0 = Array.from({ length: Number(process_n) }, (_, i) => ({ tracking: "yal-" + (1000 + i), date: "2026-11-2" + (i % 9), name: "زبون " + i, phone: "0550000" + (100 + i), wilaya: "Alger", commune: "Bab Ezzouar", product: "عسل", price: 2000, status: "En préparation", st: "En préparation" })); AdminYd.set(rows0, Number(process_n)); await new Promise(r => setTimeout(r, 500)); const card = document.getElementById("yd-card"); if (!card) return { err: "no card" }; card.style.display = ""; let el = card; while (el && el !== document.body) { el.classList && el.classList.remove("hidden"); if (el.style && el.style.display === "none") el.style.display = ""; el = el.parentElement; }
    const rows = Array.from({ length: 30 }, (_, i) => ({ tracking: "yal-" + (1000 + i), date: "2026-11-2" + (i % 9), name: "زبون " + i, phone: "0550000" + (100 + i), wilaya: "Alger", commune: "Bab Ezzouar", product: "عسل", price: 2000, status: "En préparation", st: "En préparation" }));
    AdminYd.set(rows, 30); for (let k = 0; k < 6; k++) { AdminYd.draw(); await new Promise(r => setTimeout(r, 700)); }
    for (let k = 0; k < 8; k++) { const d = document.createElement("i"); document.body.appendChild(d); d.remove(); card.insertAdjacentHTML("beforeend", "<span></span>"); await new Promise(r => setTimeout(r, 450)); }
    const order = [...card.children].map(x => x.className || x.tagName).join(" | ");
    if (process_n > 100) { document.documentElement.classList.add("white"); document.documentElement.classList.remove("glass"); }
    return { order, ts: card.querySelectorAll(".ts-bar").length, hs: card.querySelectorAll(".hs-bar").length, rows: card.querySelectorAll("tbody tr").length };
  }, process.env.N || "30");
  await p.evaluate(() => document.getElementById("yd-card").scrollIntoView()); await p.waitForTimeout(400); await p.screenshot({ path: process.env.SHOT || "/tmp/yd.png" });
  console.log(JSON.stringify(R)); t("جدول طرود ياليدين: شريط تحديد واحد وشريط سحب واحد بعد عدة تحديثات", R.ts === 1 && R.hs <= 1, R);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
