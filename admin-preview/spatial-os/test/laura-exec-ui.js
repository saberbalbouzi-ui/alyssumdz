/* تنفيذ اللوحة لتعديل المنتجات (الخيار أ): الخادم يوافق ويُصدر الأمر ← لوحة التحكم الحقيقية (متجر PHP محلي) تنفّذ Admin.setStock/setPrice وتنشر ثم تقرأ data.js من جديد ← الخادم يطابق ← الردّ. ثم الأمر نفسه من Spatial Core عبر إطار لوح. متجر PHP محلي حقيقي + الوسيط + Worker في workerd + نموذج محاكى.
   يثبت: استخراج بنية «الرئيسية» الحقيقية (إحصائيات اليوم، المؤشرات بالفترات الثلاث، نسب التسليم، الحالات...)، عدم تغيير فترة اللوحة الظاهرة، والإجابة من الأرقام المعروضة (9 ≠ 0).
   لا يثبت: نموذجاً لغوياً حقيقياً. التشغيل: WRANGLER_BIN=... NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/laura-stats-ui.js */
const path = require("path"), http = require("http"), PW = require("playwright");
const ROOT = path.resolve(__dirname, "../../.."); const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (x !== undefined && !c ? "  " + JSON.stringify(x).slice(0, 360) : "")); console.log(R[R.length - 1]); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { startStack, BASE, ASECRET } = await import(path.join(ROOT, "platform/api/tools/laura-local-stack.mjs")), { startStore } = require("./harness");
  const stack = await startStack(), store = await startStore({ stock: true }); let proxySrv = null, b = null;
  try {
    const T = await stack.mkTenant("EXEC-A", { orders: 3 });
    const SESS = { "owner-jwt": { owner: true, email: "owner@x.dz", name: "المالك" }, "agent-jwt": { owner: false, role: "agent", email: "agent@x.dz", perms: ["orders", "orders.write", "callcenter"] } };
    globalThis.Deno = { env: { get: k => ({ SUPABASE_URL: "https://sb.example", SUPABASE_ANON_KEY: "anon", PLATFORM_URL: BASE, PLATFORM_KEY: T.key, LAURA_ACTOR_SECRET: ASECRET, PLATFORM_TENANT_ID: String(T.id) }[k]) }, serve: h => { globalThis.__proxy = h; } };
    const realFetch = globalThis.fetch; globalThis.fetch = async (url, init = {}) => { url = String(url); const auth = (init.headers?.Authorization ?? "").replace("Bearer ", ""); if (url === "https://sb.example/rest/v1/rpc/staff_me") { const me = SESS[auth]; return new Response(JSON.stringify(me ?? { role: null }), { status: me ? 200 : 401 }); } if (url === "https://sb.example/rest/v1/rpc/is_admin") return new Response(JSON.stringify(!!SESS[auth]?.owner), { status: 200 }); return realFetch(url, init); };
    await import(path.join(ROOT, "platform/supabase/functions/platform-proxy/index.ts") + "?ex=1");
    proxySrv = http.createServer(async (req, res) => { const ch = []; for await (const c of req) ch.push(c); const r = await globalThis.__proxy(new Request("http://proxy.local/", { method: req.method, headers: req.headers, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(ch) })); res.statusCode = r.status; r.headers.forEach((v, k) => res.setHeader(k, v)); res.end(Buffer.from(await r.arrayBuffer())); }).listen(8790, "127.0.0.1");
    b = await PW.chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = (globalThis.__p = await ctx.newPage()), errs = (globalThis.__errs = []); p.setDefaultTimeout(30000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    const lastA = (pg) => pg.evaluate(() => { const a = [...document.querySelectorAll("#laura .lm-a, #laura .lm-e")]; return a.length ? a[a.length - 1].innerText : ""; });
    const askOn = async (pg, t) => { await pg.fill("#laura input", t); await pg.press("#laura input", "Enter"); await pg.waitForFunction(() => !Laura.state().busy, null, { timeout: 30000 }); await wait(200); return lastA(pg); };
    const dataJs = async () => { const t = await (await fetch(store.base + "/assets/js/data.js?t=" + Date.now())).text(), ip = t.indexOf("var PRODUCTS = "); return JSON.parse(t.slice(ip + 15, t.lastIndexOf(";\n"))); };
    const prod = async (slug) => (await dataJs()).find(x => x.slug === slug);
    const approve = async (pg) => { await pg.click("#laura .lm-ok"); await pg.waitForFunction(() => document.querySelectorAll("#laura .lm-pend").length === 0 && !Laura.state().busy, null, { timeout: 90000 }); await wait(300); return lastA(pg); };
    await p.goto(store.base + "/admin.html"); await wait(800); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
    await p.goto(store.base + "/admin.html"); await p.waitForFunction(() => typeof Admin !== "undefined" && Admin.products && Admin.products.length > 3 && document.getElementById("ahome") && document.getElementById("ahome").children.length, null, { timeout: 60000 }); await wait(800);
    await p.evaluate(() => { API.sb.token = async () => "owner-jwt"; API.sb.url = () => "http://127.0.0.1:8790/"; API.sb.headers = t => ({ Authorization: "Bearer " + t, "Content-Type": "application/json" }); });
    await p.waitForSelector("#laura-fab", { timeout: 40000 }); await p.click("#laura-fab"); await p.waitForFunction(() => /EXEC-A/.test(document.getElementById("laura").innerText));
    const before = await prod("miel-sidr"); ok("حالة البداية: miel-sidr مخزون 40 وسعر 3200 في data.js", before && +before.stock === 40 && +before.price === 3200, before && [before.stock, before.price]);
    ok("اللوحة تعلن قدرة التنفيذ (منتجات محمَّلة)", await p.evaluate(() => LauraActions.available()));
    /* 1) مخزون */
    await askOn(p, 'نفّذ TEST_CALL:product_set_stock:{"slug":"miel-sidr","stock":12}'); const card = await p.evaluate(() => document.querySelector("#laura .lm-pend") && document.querySelector("#laura .lm-pend").innerText);
    ok("بطاقة الموافقة: ملخص المخزون وملاحظة التنفيذ في اللوحة، والملف لم يتغيّر بعد", /مخزون المنتج «miel-sidr» إلى 12/.test(card || "") && /سيُنفَّذ في لوحة التحكم/.test(card) && +(await prod("miel-sidr")).stock === 40, card);
    let r = await approve(p); const after = await prod("miel-sidr");
    ok("بعد الموافقة: نُفِّذ في اللوحة ونُشر في data.js (12)", +after.stock === 12, after.stock);
    ok("الخادم طابق ما قرأته اللوحة من الملف المنشور: الردّ «تم» (done)", /^تم: /.test(r) && /الملف المنشور/.test(r), r);
    ok("ذاكرة اللوحة نفسها محدّثة وسجلّ المخزون سُجِّل", await p.evaluate(() => Admin.products.find(x => x.slug === "miel-sidr").stock === 12));
    /* 2) غير محدود */
    await askOn(p, 'نفّذ TEST_CALL:product_set_stock:{"slug":"miel-sidr","unlimited":true}'); r = await approve(p); const un = await prod("miel-sidr");
    ok("غير محدود: stock = null في الملف والردّ done", (un.stock === null || un.stock === undefined || un.stock === "") && /^تم: /.test(r), [un.stock, r]);
    /* 3) سعر (حساس) */
    await askOn(p, 'نفّذ TEST_CALL:product_set_price:{"slug":"miel-sidr","price":3500}'); ok("تغيير السعر بطاقة حساسة", await p.evaluate(() => !!document.querySelector("#laura .lm-pend.sens")));
    r = await approve(p); ok("السعر 3500 في data.js والردّ done", +(await prod("miel-sidr")).price === 3500 && /^تم: /.test(r), r);
    /* 4) أخطاء: منتج غير موجود، لا تغيير في الملف */
    const snap = JSON.stringify(await dataJs()); await askOn(p, 'نفّذ TEST_CALL:product_set_stock:{"slug":"no-such-product","stock":5}'); r = await approve(p);
    ok("منتج غير موجود في المتجر: failed برسالة واضحة، والملف لم يتغيّر", /تعذّر تنفيذ/.test(r) && /غير موجود/.test(r) && JSON.stringify(await dataJs()) === snap, r);
    /* 5) رفض المستخدم: لا تنفيذ */
    await askOn(p, 'نفّذ TEST_CALL:product_set_stock:{"slug":"tarkiz","stock":1}'); await p.click("#laura .lm-no"); await wait(800);
    ok("رفض المستخدم: لا تنفيذ والملف كما هو", +(await prod("tarkiz")).stock === 30);
    /* 6) Spatial Core: الأمر نفسه عبر إطار لوح */
    const p2 = (globalThis.__p2 = await ctx.newPage()); p2.setDefaultTimeout(30000); p2.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await p2.goto(store.spatial + "?nozoom=1"); await p2.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && typeof Laura !== "undefined" && SpatialOS.spare.ready, null, { timeout: 60000 }); await wait(1500);
    await p2.evaluate(() => { Laura.setTransport(async (m, pth, body) => { const r = await fetch("http://127.0.0.1:8790/", { method: "POST", headers: { Authorization: "Bearer owner-jwt", "Content-Type": "application/json" }, body: JSON.stringify({ method: m, path: pth, body }) }); const j = await r.json(); if (!r.ok || !j.ok) throw { code: j.error || "unavailable" }; return { status: j.status, data: j.data }; }); });
    await p2.waitForFunction(() => LauraActions.available(), null, { timeout: 40000 }); ok("Spatial: القدرة متاحة عبر إطار اللوح الجاهز", true);
    await p2.click("#core"); await p2.waitForFunction(() => { const l = document.getElementById("laura"); return l && !l.hidden; });
    await askOn(p2, 'نفّذ TEST_CALL:product_set_stock:{"slug":"tarkiz","stock":21}'); r = await approve(p2);
    ok("Spatial: نُفِّذ عبر إطار اللوحة ونُشر (21) والردّ done", +(await prod("tarkiz")).stock === 21 && /^تم: /.test(r), r);
    /* 7) الفرنسية */
    await p2.click("#hud-lang"); await p2.waitForFunction(() => document.documentElement.lang === "fr" && /Effacer/.test(document.getElementById("laura").innerText), null, { timeout: 20000 });
    await askOn(p2, 'TEST_CALL:product_set_stock:{"slug":"tarkiz","stock":22}'); const cf = await p2.evaluate(() => document.querySelector("#laura .lm-pend").innerText);
    ok("فرنسية: ملخص البطاقة وملاحظة التنفيذ بالفرنسية", /Changer le stock du produit/.test(cf) && /Sera exécuté dans le tableau de bord/.test(cf), cf);
    r = await approve(p2); ok("فرنسية: نتيجة التنفيذ بالفرنسية (Fait) والملف 22", /^Fait : /.test(r) && +(await prod("tarkiz")).stock === 22 && !/[\u0600-\u06ff]/.test(r), r);
    const au = (await (await fetch("http://127.0.0.1:8790/", { method: "POST", headers: { Authorization: "Bearer owner-jwt", "Content-Type": "application/json" }, body: JSON.stringify({ method: "GET", path: "/v1/laura/history" }) })).json()).data; ok("الذاكرة المشتركة تحمل نتائج التنفيذ من الواجهتين", (au.messages || []).filter(m => /Fait :|^تم: /.test(m.text)).length >= 5, (au.messages || []).length);
    ok("لا أخطاء صفحة", errs.length === 0, errs);
  } catch (e) { fails++; console.log("ERRS", JSON.stringify(globalThis.__errs)); try { console.log("DBG", JSON.stringify(await globalThis.__p.evaluate(() => { const l = document.getElementById("laura"); return { text: l && l.innerText.slice(-500), st: Laura.state() }; }))); } catch (e2) { } console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 900)); }
  finally { try { await b?.close(); } catch { } try { proxySrv?.close(); } catch { } try { store.stop(); } catch { } stack.stop(); }
  console.log(fails ? "\nFAILED: " + fails : "\nALL PASS (" + R.filter(x => x.startsWith("PASS")).length + ")"); process.exit(fails ? 1 : 0);
})();
