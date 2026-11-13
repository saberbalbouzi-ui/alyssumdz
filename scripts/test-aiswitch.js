/* مفتاح تفعيل/تعطيل أدوات الذكاء: تشغيل: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-aiswitch.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x || ""))); };
  const hits = []; await p.route(/generativelanguage\.googleapis\.com/, r => { hits.push(r.request().url()); r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }); });
  await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => { if (!/PB is not defined/.test(String(e))) errs.push(String(e)); });
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const call = () => p.evaluate(async () => { try { const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", { method: "POST", body: "{}" }); return { ok: true, status: r.status }; } catch (e) { return { ok: false, code: e.code, msg: String(e.message).slice(0, 40) }; } });
  ok("افتراضياً مفعّلة: الطلب يمرّ", (await call()).ok === true && hits.length === 1);
  await p.evaluate(() => AiSwitch.set(false));
  const r = await call(); ok("معطّلة: الطلب يُرفض برمز OFF ولا يصل للشبكة", r.ok === false && r.code === "OFF" && hits.length === 1, r);
  ok("معطّلة: شريط التنبيه ظاهر", await p.evaluate(() => !!document.getElementById("ais-bar")));
  const loc = await p.evaluate(async () => { try { await fetch("assets/js/data.js", { method: "GET" }); return "ok"; } catch (e) { return "blocked"; } }); ok("طلبات الموقع العادية لا تتأثر", loc === "ok", loc);
  await p.evaluate(() => { const h = document.createElement("div"); h.setAttribute("data-aisw-card", ""); document.body.appendChild(h); }); await p.waitForTimeout(400);
  ok("بطاقة التبديل تُملأ تلقائياً وتعكس الحالة", await p.evaluate(() => { const c = document.querySelector("[data-aisw-card]"); return !!c.querySelector('[data-aisw="toggle"]') && !c.querySelector('[data-aisw="toggle"]').checked; }));
  await p.evaluate(() => document.querySelector('[data-aisw="on"]').click()); await p.waitForTimeout(300);
  ok("زر «تفعيل» في الشريط يعيد التفعيل ويزيل الشريط", await p.evaluate(() => AiSwitch.enabled() && !document.getElementById("ais-bar")));
  ok("بعد التفعيل يمرّ الطلب من جديد", (await call()).ok === true && hits.length === 2);
  await p.evaluate(() => { document.querySelector('[data-aisw="toggle"]').click(); }); await p.waitForTimeout(300);
  ok("المفتاح في البطاقة يعطّل", await p.evaluate(() => !AiSwitch.enabled()) && (await call()).code === "OFF");
  await p.evaluate(() => AiSwitch.set(true));
  const st = await p.evaluate(async () => { const bt = [...document.querySelectorAll(".nav-btn")].find(b => (b.getAttribute("onclick") || "").includes("'store'")); Admin.tab("store", bt); await new Promise(r => setTimeout(r, 2500)); try { AdminStores.go && 0; } catch (e) { } const c = document.querySelector("#stores-app [data-aisw-card]"); return { card: !!c, toggle: !!(c && c.querySelector('[data-aisw="toggle"]')) }; }); ok("بطاقة المفتاح في «إعدادات الموقع» (الإعدادات العامة)", st.card && st.toggle, st);
  ok("المفتاح يُزامَن بين الأجهزة (PrivSync)", await p.evaluate(() => PrivSync.KEYS.alyssum_ai_master === "s_ai_master"));
  ok("لا بطاقة مكرَّرة في «رصيد الأدوات»", await p.evaluate(async () => { try { Credits.open && Credits.open(); } catch (e) { } await new Promise(r => setTimeout(r, 400)); return !document.querySelector("#cr-box [data-aisw-card]"); }));
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail + " من " + (pass + fail) : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
