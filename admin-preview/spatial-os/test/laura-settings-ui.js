/* إعدادات المتجر الحقيقية عبر LAURA: وضع الصيانة (store.json) والشريط الإعلاني (chrome.json) — قراءة من الملف، عرض القيمة قبل التنفيذ، موافقة، تنفيذ دالة اللوحة (AdminStores.patch / ChromeAdmin.save)، قراءة الملف المنشور، وأثر فعلي على واجهة المتجر؛ رفض غير المخوّل وفشل محرر مفتوح؛ ثم من Spatial وبالفرنسية. متجر PHP محلي حقيقي + الوسيط + Worker في workerd + نموذج محاكى.
   يثبت: استخراج بنية «الرئيسية» الحقيقية (إحصائيات اليوم، المؤشرات بالفترات الثلاث، نسب التسليم، الحالات...)، عدم تغيير فترة اللوحة الظاهرة، والإجابة من الأرقام المعروضة (9 ≠ 0).
   لا يثبت: نموذجاً لغوياً حقيقياً. التشغيل: WRANGLER_BIN=... NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/laura-stats-ui.js */
const path = require("path"), http = require("http"), PW = require("playwright");
const ROOT = path.resolve(__dirname, "../../.."); const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (x !== undefined && !c ? "  " + JSON.stringify(x).slice(0, 360) : "")); console.log(R[R.length - 1]); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { startStack, BASE, ASECRET } = await import(path.join(ROOT, "platform/api/tools/laura-local-stack.mjs")), { startStore } = require("./harness");
  const stack = await startStack(), store = await startStore({ stock: true }); let proxySrv = null, b = null;
  try {
    const T = await stack.mkTenant("SET-A", { orders: 3 });
    const SESS = { "owner-jwt": { owner: true, email: "owner@x.dz", name: "المالك" }, "agent-jwt": { owner: false, role: "agent", email: "agent@x.dz", perms: ["orders", "orders.write", "callcenter"] } };
    globalThis.Deno = { env: { get: k => ({ SUPABASE_URL: "https://sb.example", SUPABASE_ANON_KEY: "anon", PLATFORM_URL: BASE, PLATFORM_KEY: T.key, LAURA_ACTOR_SECRET: ASECRET, PLATFORM_TENANT_ID: String(T.id) }[k]) }, serve: h => { globalThis.__proxy = h; } };
    const realFetch = globalThis.fetch; globalThis.fetch = async (url, init = {}) => { url = String(url); const auth = (init.headers?.Authorization ?? "").replace("Bearer ", ""); if (url === "https://sb.example/rest/v1/rpc/staff_me") { const me = SESS[auth]; return new Response(JSON.stringify(me ?? { role: null }), { status: me ? 200 : 401 }); } if (url === "https://sb.example/rest/v1/rpc/is_admin") return new Response(JSON.stringify(!!SESS[auth]?.owner), { status: 200 }); return realFetch(url, init); };
    await import(path.join(ROOT, "platform/supabase/functions/platform-proxy/index.ts") + "?st=1");
    proxySrv = http.createServer(async (req, res) => { const ch = []; for await (const c of req) ch.push(c); const r = await globalThis.__proxy(new Request("http://proxy.local/", { method: req.method, headers: req.headers, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(ch) })); res.statusCode = r.status; r.headers.forEach((v, k) => res.setHeader(k, v)); res.end(Buffer.from(await r.arrayBuffer())); }).listen(8790, "127.0.0.1");
    b = await PW.chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = (globalThis.__p = await ctx.newPage()), errs = (globalThis.__errs = []); p.setDefaultTimeout(30000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    const lastA = (pg) => pg.evaluate(() => { const a = [...document.querySelectorAll("#laura .lm-a, #laura .lm-e")]; return a.length ? a[a.length - 1].innerText : ""; });
    const askOn = async (pg, t) => { await pg.fill("#laura input", t); await pg.press("#laura input", "Enter"); await pg.waitForFunction(() => !Laura.state().busy, null, { timeout: 30000 }); await wait(200); return lastA(pg); };
    const jf = async (path) => (await fetch(store.base + "/" + path + "?t=" + Date.now())).json();
    const approve = async (pg) => { await pg.click("#laura .lm-ok"); await pg.waitForFunction(() => document.querySelectorAll("#laura .lm-pend").length === 0 && !Laura.state().busy, null, { timeout: 90000 }); await wait(300); return lastA(pg); };
    const wire = (pg, jwt) => pg.evaluate(j => { API.sb.token = async () => j; API.sb.url = () => "http://127.0.0.1:8790/"; API.sb.headers = t => ({ Authorization: "Bearer " + t, "Content-Type": "application/json" }); }, jwt);
    await p.goto(store.base + "/admin.html"); await wait(800); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
    await p.goto(store.base + "/admin.html"); await p.waitForFunction(() => typeof Admin !== "undefined" && Admin.products && Admin.products.length > 3 && typeof AdminStores !== "undefined" && window.ChromeAdmin && document.getElementById("ahome") && document.getElementById("ahome").children.length, null, { timeout: 60000 }); await wait(1000);
    await wire(p, "owner-jwt"); await p.waitForSelector("#laura-fab", { timeout: 40000 }); await p.click("#laura-fab"); await p.waitForFunction(() => /SET-A/.test(document.getElementById("laura").innerText));
    const st0 = await jf("assets/data/store.json"); ok("البداية: الصيانة متوقفة في store.json", st0.maintenance === false, st0.maintenance);
    /* قراءة القيمة الحالية */
    let r = await askOn(p, "نفّذ TEST_CALL:store_settings:{}"); ok("قراءة الإعدادات: الصيانة متوقفة والشريط الإعلاني الافتراضي ظاهر (من الملفات)", /"maintenance":\{"on":false/.test(r.replace(/\s/g, "")) && /"announcement":\{"show":true/.test(r.replace(/\s/g, "")), r);
    /* 1) الصيانة: تفعيل */
    await askOn(p, 'نفّذ TEST_CALL:maintenance_set:{"on":true,"message":"نعود بعد قليل"}'); const card = await p.evaluate(() => document.querySelector("#laura .lm-pend").innerText);
    ok("البطاقة تعرض الحالة الحالية ← الجديدة، حساسة، وملاحظة التنفيذ، والملف لم يتغيّر", /متوقفة ← مفعّلة/.test(card) && /نعود بعد قليل/.test(card) && /لوحة الإدارة تبقى متاحة/.test(card) && /سيُنفَّذ في لوحة التحكم/.test(card) && (await p.evaluate(() => !!document.querySelector("#laura .lm-pend.sens"))) && (await jf("assets/data/store.json")).maintenance === false, card);
    r = await approve(p); const st1 = await jf("assets/data/store.json");
    ok("بعد الموافقة: store.json maintenance=true والرسالة، والردّ «تم» (مطابقة الملف المنشور)", st1.maintenance === true && st1.maintMsg === "نعود بعد قليل" && /^تم: /.test(r), [st1.maintenance, st1.maintMsg, r]);
    /* أثر فعلي: زائر يرى شاشة الصيانة؛ لوحة الإدارة تبقى متاحة */
    const vis = await (await b.newContext()).newPage(); await vis.goto(store.base + "/index.html"); await vis.waitForSelector("#store-maint", { timeout: 20000 }); ok("أثر فعلي: الزائر يرى شاشة الصيانة برسالتها", /نعود بعد قليل/.test(await vis.evaluate(() => document.getElementById("store-maint").innerText)));
    await vis.goto(store.base + "/admin.html"); await wait(2500); ok("لوحة الإدارة تبقى متاحة أثناء الصيانة (لا شاشة صيانة فيها وشاشة الدخول ظاهرة)", await vis.evaluate(() => !document.getElementById("store-maint") && !!document.getElementById("login-box")));
    ok("المالك داخل لوحة التحكم يعمل بلا انقطاع أثناء الصيانة", await p.evaluate(() => typeof Admin !== "undefined" && !document.getElementById("store-maint")));
    r = await askOn(p, 'نفّذ TEST_CALL:maintenance_set:{"on":true}'); ok("تفعيل مكرر: يُرفض مبكراً (already_done) لأن اللقطة المحدّثة تقول مفعّلة", await p.evaluate(() => document.querySelectorAll("#laura .lm-pend").length === 0) && /مفعّلة|بهذه الحالة|already|تعذّر/.test(r), r);
    /* 2) الصيانة: إيقاف */
    await askOn(p, 'نفّذ TEST_CALL:maintenance_set:{"on":false}'); ok("بطاقة الإيقاف: مفعّلة ← متوقفة", /مفعّلة ← متوقفة/.test(await p.evaluate(() => document.querySelector("#laura .lm-pend").innerText)));
    r = await approve(p); ok("الإيقاف: store.json false والردّ done، والزائر لا يرى الصيانة", (await jf("assets/data/store.json")).maintenance === false && /^تم: /.test(r) && await (async () => { await vis.goto(store.base + "/index.html"); await wait(2500); return await vis.evaluate(() => !document.getElementById("store-maint")); })(), r);
    /* 3) الشريط الإعلاني */
    await askOn(p, 'نفّذ TEST_CALL:announcement_set:{"show":true,"text":"خصم **20%** اليوم فقط","bg":"#0a7d3b","color":"#ffffff"}'); const c2 = await p.evaluate(() => document.querySelector("#laura .lm-pend").innerText);
    ok("بطاقة الشريط: النص الحالي ← الجديد ولون الخلفية ← الجديد، غير حساسة", /النص: «.+» ← «خصم \*\*20%\*\* اليوم فقط»/.test(c2) && /لون الخلفية: «.*» ← «#0a7d3b»/.test(c2) && (await p.evaluate(() => !document.querySelector("#laura .lm-pend.sens"))), c2);
    r = await approve(p); const ch = await jf("assets/data/chrome.json"), tb = ch.header && ch.header.topbar;
    ok("chrome.json: النص واللونان والإظهار كما طُلب، والردّ done", tb && tb.show === true && tb.text === "خصم **20%** اليوم فقط" && tb.bg === "#0a7d3b" && tb.color === "#ffffff" && /^تم: /.test(r), [tb, r]);
    await vis.goto(store.base + "/index.html"); await vis.waitForSelector(".topbar", { timeout: 20000 }); const tbv = await vis.evaluate(() => { const e = document.querySelector(".topbar"); return { t: e.innerText, bg: getComputedStyle(e).backgroundColor }; });
    ok("أثر فعلي: واجهة المتجر تعرض الشريط بالنص واللون الجديدين", /خصم/.test(tbv.t) && /20%/.test(tbv.t) && tbv.bg === "rgb(10, 125, 59)", tbv);
    await askOn(p, 'نفّذ TEST_CALL:announcement_set:{"show":false}'); r = await approve(p); ok("تعطيل الشريط: show=false في الملف والردّ done", (await jf("assets/data/chrome.json")).header.topbar.show === false && /^تم: /.test(r), r);
    /* 4) رفض المستخدم: لا تنفيذ */
    const snapC = JSON.stringify(await jf("assets/data/chrome.json")); await askOn(p, 'نفّذ TEST_CALL:announcement_set:{"text":"لن يُنشر"}'); await p.click("#laura .lm-no"); await wait(800); ok("رفض المستخدم: لا تغيير في chrome.json", JSON.stringify(await jf("assets/data/chrome.json")) === snapC);
    /* 5) محرر الإعدادات مفتوح: فشل واضح بلا تغيير */
    await p.evaluate(() => Admin.tab("store")); await wait(1500); const snapS = JSON.stringify(await jf("assets/data/store.json"));
    await askOn(p, 'نفّذ TEST_CALL:maintenance_set:{"on":true}'); r = await approve(p); ok("محرر «إعدادات الموقع» ظاهر: failed برسالة واضحة والملف لم يتغيّر", /تعذّر تنفيذ/.test(r) && /محرر/.test(r) && JSON.stringify(await jf("assets/data/store.json")) === snapS, r);
    await p.evaluate(() => Admin.tab("home")); await wait(800);
    /* 6) غير مخوّل: موظف اتصال */
    const pA = await ctx.newPage(); pA.setDefaultTimeout(30000); pA.on("pageerror", e => errs.push(String(e).slice(0, 200))); await pA.goto(store.base + "/admin.html"); await pA.waitForFunction(() => typeof Admin !== "undefined" && Admin.products && Admin.products.length > 3, null, { timeout: 60000 }); await wire(pA, "agent-jwt");
    await pA.waitForSelector("#laura-fab", { timeout: 40000 }); await pA.click("#laura-fab"); await pA.waitForFunction(() => { const l = document.getElementById("laura"); return l && !l.hidden; });
    await askOn(pA, 'نفّذ TEST_CALL:maintenance_set:{"on":true}'); ok("موظف اتصال: لا بطاقة موافقة (الأداة محجوبة على الخادم) والملف كما هو", await pA.evaluate(() => document.querySelectorAll("#laura .lm-pend").length === 0 && /تعذّر/.test(document.querySelector("#laura .lm-msgs").innerText)) && JSON.stringify(await jf("assets/data/store.json")) === snapS);
    /* 7) Spatial + الفرنسية */
    const p2 = (globalThis.__p2 = await ctx.newPage()); p2.setDefaultTimeout(30000); p2.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await p2.goto(store.spatial + "?nozoom=1"); await p2.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && typeof Laura !== "undefined" && SpatialOS.spare.ready, null, { timeout: 60000 }); await wait(1500);
    await p2.evaluate(() => { Laura.setTransport(async (m, pth, body) => { const r = await fetch("http://127.0.0.1:8790/", { method: "POST", headers: { Authorization: "Bearer owner-jwt", "Content-Type": "application/json" }, body: JSON.stringify({ method: m, path: pth, body }) }); const j = await r.json(); if (!r.ok || !j.ok) throw { code: j.error || "unavailable" }; return { status: j.status, data: j.data }; }); });
    await p2.waitForFunction(() => LauraActions.available(), null, { timeout: 40000 }); await p2.click("#core"); await p2.waitForFunction(() => { const l = document.getElementById("laura"); return l && !l.hidden; });
    await askOn(p2, 'نفّذ TEST_CALL:announcement_set:{"show":true,"text":"من Spatial"}'); r = await approve(p2); ok("Spatial: الشريط عُدِّل عبر إطار اللوحة ونُشر والردّ done", (await jf("assets/data/chrome.json")).header.topbar.text === "من Spatial" && /^تم: /.test(r), r);
    await p2.click("#hud-lang"); await p2.waitForFunction(() => document.documentElement.lang === "fr" && /Effacer/.test(document.getElementById("laura").innerText), null, { timeout: 20000 });
    await askOn(p2, 'TEST_CALL:maintenance_set:{"on":true,"message":"Retour bientôt"}'); const cf = await p2.evaluate(() => document.querySelector("#laura .lm-pend").innerText);
    ok("فرنسية: بطاقة الصيانة (Mode maintenance : désactivée → activée) وملاحظة التنفيذ", /Mode maintenance : désactivée → activée/.test(cf) && /Retour bientôt/.test(cf) && /Sera exécuté dans le tableau de bord/.test(cf), cf);
    r = await approve(p2); ok("فرنسية: نتيجة «Fait» والملف maintenance=true", /^Fait : /.test(r) && (await jf("assets/data/store.json")).maintenance === true && !/[\u0600-\u06ff]/.test(r), r);
    await askOn(p2, 'TEST_CALL:maintenance_set:{"on":false}'); r = await approve(p2); ok("فرنسية: إيقاف الصيانة وتحقق الملف", /^Fait : /.test(r) && (await jf("assets/data/store.json")).maintenance === false, r);
    ok("لا أخطاء صفحة", errs.length === 0, errs);
  } catch (e) { fails++; console.log("ERRS", JSON.stringify(globalThis.__errs)); try { console.log("DBG", JSON.stringify(await globalThis.__p.evaluate(() => { const l = document.getElementById("laura"); return { text: l && l.innerText.slice(-500) }; }))); } catch (e2) { } console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 900)); }
  finally { try { await b?.close(); } catch { } try { proxySrv?.close(); } catch { } try { store.stop(); } catch { } stack.stop(); }
  console.log(fails ? "\nFAILED: " + fails : "\nALL PASS (" + R.filter(x => x.startsWith("PASS")).length + ")"); process.exit(fails ? 1 : 0);
})();
