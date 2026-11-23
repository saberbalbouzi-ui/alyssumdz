/* الدفع عبر LAURA: طرق الدفع المسبق (BaridiMob / CCP / Chargily) في assets/data/pay-methods.json — قراءة من لقطة اللوحة، بطاقة موافقة بالقديم ← الجديد كاملين، تنفيذ بالنشر نفسه الذي تستعمله نافذة «المنتجات الرقمية»، قراءة الملف المنشور، أثر فعلي في المتجر، الرفض عند فتح نافذة المنتجات الرقمية، موظف الاتصال، Spatial بالفرنسية.
   لا يثبت: نموذجاً لغوياً حقيقياً ولا بوابة دفع حقيقية. التشغيل: WRANGLER_BIN=... NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/laura-payments-ui.js */
const path = require("path"), http = require("http"), PW = require("playwright");
const ROOT = path.resolve(__dirname, "../../.."); const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (x !== undefined && !c ? "  " + JSON.stringify(x).slice(0, 360) : "")); console.log(R[R.length - 1]); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { startStack, BASE, ASECRET } = await import(path.join(ROOT, "platform/api/tools/laura-local-stack.mjs")), { startStore } = require("./harness");
  const stack = await startStack(), store = await startStore({ stock: true }); let proxySrv = null, b = null;
  try {
    const T = await stack.mkTenant("PAY-A", { orders: 3 });
    const SESS = { "owner-jwt": { owner: true, email: "owner@x.dz", name: "المالك" }, "agent-jwt": { owner: false, role: "agent", email: "agent@x.dz", perms: ["orders", "orders.write", "callcenter"] } };
    globalThis.Deno = { env: { get: k => ({ SUPABASE_URL: "https://sb.example", SUPABASE_ANON_KEY: "anon", PLATFORM_URL: BASE, PLATFORM_KEY: T.key, LAURA_ACTOR_SECRET: ASECRET, PLATFORM_TENANT_ID: String(T.id) }[k]) }, serve: h => { globalThis.__proxy = h; } };
    const realFetch = globalThis.fetch; globalThis.fetch = async (url, init = {}) => { url = String(url); const auth = (init.headers?.Authorization ?? "").replace("Bearer ", ""); if (url === "https://sb.example/rest/v1/rpc/staff_me") { const me = SESS[auth]; return new Response(JSON.stringify(me ?? { role: null }), { status: me ? 200 : 401 }); } if (url === "https://sb.example/rest/v1/rpc/is_admin") return new Response(JSON.stringify(!!SESS[auth]?.owner), { status: 200 }); return realFetch(url, init); };
    await import(path.join(ROOT, "platform/supabase/functions/platform-proxy/index.ts") + "?sh=1");
    proxySrv = http.createServer(async (req, res) => { const ch = []; for await (const c of req) ch.push(c); const r = await globalThis.__proxy(new Request("http://proxy.local/", { method: req.method, headers: req.headers, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(ch) })); res.statusCode = r.status; r.headers.forEach((v, k) => res.setHeader(k, v)); res.end(Buffer.from(await r.arrayBuffer())); }).listen(8790, "127.0.0.1");
    b = await PW.chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = (globalThis.__p = await ctx.newPage()), errs = (globalThis.__errs = []); p.setDefaultTimeout(30000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    const lastA = (pg) => pg.evaluate(() => { const a = [...document.querySelectorAll("#laura .lm-a, #laura .lm-e")]; return a.length ? a[a.length - 1].innerText : ""; });
    const askOn = async (pg, t) => { await pg.fill("#laura input", t); await pg.press("#laura input", "Enter"); await pg.waitForFunction(() => !Laura.state().busy, null, { timeout: 30000 }); await wait(200); return lastA(pg); };
    const wfile = async () => { const t = await (await fetch(store.base + "/assets/js/wilayas.js?t=" + Date.now())).text(), a = t.indexOf("var WILAYAS = ") + 14, m = t.indexOf(";\nvar SHIPPING = "); return { W: JSON.parse(t.slice(a, m > 0 ? m : t.lastIndexOf(";\n"))), SH: m > 0 ? JSON.parse(t.slice(m + 17, t.lastIndexOf(";\n"))) : {} }; };
    const wil = async () => (await wfile()).W;
    const dat = async () => { const t = await (await fetch(store.base + "/assets/js/data.js?t=" + Date.now())).text(); return JSON.parse(t.slice(t.indexOf("var PRODUCTS = ") + 15, t.lastIndexOf(";\n"))); };
    const approve = async (pg) => { await pg.click("#laura .lm-ok"); await pg.waitForFunction(() => document.querySelectorAll("#laura .lm-pend").length === 0 && !Laura.state().busy, null, { timeout: 90000 }); await wait(300); return lastA(pg); };
    const wire = (pg, jwt) => pg.evaluate(j => { API.sb.token = async () => j; API.sb.url = () => "http://127.0.0.1:8790/"; API.sb.headers = t => ({ Authorization: "Bearer " + t, "Content-Type": "application/json" }); }, jwt);
    await p.goto(store.base + "/admin.html"); await wait(800); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
    await p.goto(store.base + "/admin.html"); await p.waitForFunction(() => typeof Admin !== "undefined" && Admin.products && Admin.products.length > 3 && Admin.fees && Admin.fees.length >= 58 && document.getElementById("ahome") && document.getElementById("ahome").children.length, null, { timeout: 60000 }); await wait(1000);
    await wire(p, "owner-jwt"); await p.waitForSelector("#laura-fab", { timeout: 40000 }); await p.click("#laura-fab"); await p.waitForFunction(() => /PAY-A/.test(document.getElementById("laura").innerText));
    const pfile = async () => { const r = await fetch(store.base + "/assets/data/pay-methods.json?t=" + Date.now()); return r.ok ? await r.json() : null; };
    ok("البداية: لا ملف طرق دفع منشور بعد", (await pfile()) === null);
    let r = await askOn(p, "نفّذ TEST_CALL:payment_overview:{}"); const sn = await p.evaluate(() => { LauraActions.invalidate(); return LauraActions.settingsSnapshot(); });
    ok("لقطة الدفع: كل الطرق متوقفة وبلا أرقام قبل أي إعداد", !!sn && !!sn.payments && sn.payments.baridimob.on === false && sn.payments.ccp.on === false && sn.payments.chargily.on === false && sn.payments.baridimob.rip === "", sn && sn.payments);
    /* تفعيل BaridiMob بلا RIP: يُرفض على الخادم بلا بطاقة */
    await askOn(p, "نفّذ TEST_CALL:payment_method_set:{\"method\":\"baridimob\",\"on\":true}"); ok("تفعيل بلا RIP: لا بطاقة موافقة (missing_rip)", (await p.evaluate(() => document.querySelectorAll("#laura .lm-pend").length)) === 0);
    /* إعداد BaridiMob */
    await askOn(p, "نفّذ TEST_CALL:payment_method_set:{\"method\":\"baridimob\",\"on\":true,\"rip\":\"00799999 0012345678\",\"name\":\"متجر الاختبار\"}"); const c1 = await p.evaluate(() => document.querySelector("#laura .lm-pend").innerText);
    ok("البطاقة: الحالة والرقم والاسم القديم ← الجديد وتنبيه الحساب، حساسة، والملف لم يُنشر", /BaridiMob/.test(c1) && /متوقفة ← مفعّلة/.test(c1) && /00799999 0012345678/.test(c1) && /سيحوّلون المال/.test(c1) && (await pfile()) === null, c1);
    r = await approve(p); let F = await pfile();
    ok("بعد الموافقة: pay-methods.json منشور بـBaridiMob مفعّلاً وبالرقم والاسم، والردّ «تم»", !!F && F.baridimob.on === true && F.baridimob.rip === "00799999 0012345678" && F.baridimob.name === "متجر الاختبار" && F.ccp.on === false && /^تم: /.test(r), [F, r]);
    /* CCP: دمج لا استبدال */
    await askOn(p, "نفّذ TEST_CALL:payment_method_set:{\"method\":\"ccp\",\"on\":true,\"account\":\"1234567\",\"key\":\"45\",\"name\":\"المتجر\"}"); r = await approve(p); F = await pfile();
    ok("CCP: يُدمج الحقل دون مسّ BaridiMob (الرقم باقٍ) والملف يحمل الحساب والمفتاح", F.ccp.on === true && F.ccp.account === "1234567" && F.ccp.key === "45" && F.baridimob.rip === "00799999 0012345678" && /^تم: /.test(r), F);
    /* تغيير الرقم */
    await askOn(p, "نفّذ TEST_CALL:payment_method_set:{\"method\":\"baridimob\",\"rip\":\"00799999 0099999999\"}"); const c2 = await p.evaluate(() => document.querySelector("#laura .lm-pend").innerText);
    ok("تغيير الرقم: البطاقة تعرض القديم والجديد كاملين", /00799999 0012345678/.test(c2) && /00799999 0099999999/.test(c2), c2);
    r = await approve(p); F = await pfile(); ok("الرقم الجديد منشور والطرق الأخرى كما هي", F.baridimob.rip === "00799999 0099999999" && F.ccp.account === "1234567" && /^تم: /.test(r), F);
    /* أثر فعلي في المتجر */
    const vis = await (await b.newContext()).newPage(); await vis.goto(store.base + "/index.html"); ok("أثر فعلي: الملف يخدمه المتجر نفسه بالقيم الجديدة", await vis.evaluate(async () => { const j = await (await fetch("assets/data/pay-methods.json?_=" + Date.now(), { cache: "no-store" })).json(); return j.baridimob.rip === "00799999 0099999999" && j.ccp.on === true; }));
    /* نافذة المنتجات الرقمية تقرأ الحالة الجديدة (لا تحفظ القديمة فوقها) */
    ok("ذاكرة نافذة المنتجات الرقمية تتبع الملف المنشور", await p.evaluate(() => AdminDigital.S.pay && AdminDigital.S.pay.baridimob.rip === "00799999 0099999999"));
    /* Chargily */
    await askOn(p, "نفّذ TEST_CALL:payment_method_set:{\"method\":\"chargily\",\"on\":true}"); r = await approve(p); F = await pfile(); ok("Chargily: on=true في الملف", F.chargily.on === true && /^تم: /.test(r), F);
    /* إيقاف */
    await askOn(p, "نفّذ TEST_CALL:payment_method_set:{\"method\":\"ccp\",\"on\":false}"); r = await approve(p); F = await pfile(); ok("إيقاف CCP: on=false مع بقاء الحساب محفوظاً", F.ccp.on === false && F.ccp.account === "1234567" && /^تم: /.test(r), F);
    /* مرفوض: نافذة المنتجات الرقمية مفتوحة */
    const snapP = JSON.stringify(await pfile()); await p.evaluate(() => { let t = document.getElementById("tab-digital"); if (!t) { t = document.createElement("div"); t.id = "tab-digital"; t.textContent = "x"; document.body.appendChild(t); } t.classList.remove("hidden"); t.style.display = "block"; });
    await askOn(p, "نفّذ TEST_CALL:payment_method_set:{\"method\":\"chargily\",\"on\":false}"); r = await approve(p); ok("نافذة المنتجات الرقمية مفتوحة: failed برسالة واضحة والملف لم يتغيّر", /تعذّر تنفيذ/.test(r) && JSON.stringify(await pfile()) === snapP, r);
    await p.evaluate(() => { const t = document.getElementById("tab-digital"); if (t) t.classList.add("hidden"); });
    /* حارس اللوحة نفسه: أمر مشوَّه */
    const bad = await p.evaluate(() => Promise.all([LauraActions.run({ tool: "payment_method_set", args: { method: "baridimob", rip: "12ab" } }), LauraActions.run({ tool: "payment_method_set", args: { method: "chargily", rip: "123" } }), LauraActions.run({ tool: "payment_method_set", args: { method: "ccp", on: true, account: "" } }), LauraActions.run({ tool: "payment_method_set", args: { method: "paypal", on: true } })]));
    ok("حارس اللوحة: RIP بحروف/حقل لا يخص الطريقة/تفعيل CCP بحساب فارغ/طريقة مجهولة — كلها تُرفض", bad.every(x => x.ok === false) && JSON.stringify(await pfile()) === snapP, bad);
    /* رفض المستخدم */
    await askOn(p, "نفّذ TEST_CALL:payment_method_set:{\"method\":\"baridimob\",\"rip\":\"1111\"}"); await p.click("#laura .lm-no"); await wait(800); ok("رفض المستخدم: لا تغيير في الملف", JSON.stringify(await pfile()) === snapP);
    /* غير مخوّل */
    const pA = await ctx.newPage(); pA.setDefaultTimeout(30000); pA.on("pageerror", e => errs.push(String(e).slice(0, 200))); await pA.goto(store.base + "/admin.html"); await pA.waitForFunction(() => typeof Admin !== "undefined" && Admin.products && Admin.products.length > 3, null, { timeout: 60000 }); await wait(800); await wire(pA, "agent-jwt");
    await pA.waitForSelector("#laura-fab", { timeout: 40000 }); await pA.click("#laura-fab"); await pA.waitForFunction(() => { const l = document.getElementById("laura"); return l && !l.hidden; });
    await askOn(pA, "نفّذ TEST_CALL:payment_method_set:{\"method\":\"baridimob\",\"rip\":\"1111\"}"); ok("موظف اتصال: لا بطاقة والملف كما هو", (await pA.evaluate(() => document.querySelectorAll("#laura .lm-pend").length)) === 0 && JSON.stringify(await pfile()) === snapP);
    /* Spatial + فرنسية */
    const p2 = (globalThis.__p2 = await ctx.newPage()); p2.setDefaultTimeout(30000); p2.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await p2.goto(store.spatial + "?nozoom=1"); await p2.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && typeof Laura !== "undefined" && SpatialOS.spare.ready, null, { timeout: 60000 }); await wait(1500);
    await p2.evaluate(() => { Laura.setTransport(async (m, pth, body) => { const r = await fetch("http://127.0.0.1:8790/", { method: "POST", headers: { Authorization: "Bearer owner-jwt", "Content-Type": "application/json" }, body: JSON.stringify({ method: m, path: pth, body }) }); return r.json(); }); });
    await p2.waitForFunction(() => LauraActions.available(), null, { timeout: 40000 }); await p2.click("#core"); await p2.waitForFunction(() => { const l = document.getElementById("laura"); return l && !l.hidden; });
    await p2.click("#hud-lang"); await p2.waitForFunction(() => document.documentElement.lang === "fr" && /Effacer/.test(document.getElementById("laura").innerText), null, { timeout: 20000 });
    await wait(2500); await askOn(p2, "TEST_CALL:payment_method_set:{\"method\":\"baridimob\",\"rip\":\"00799999 0055555555\"}"); const cf = await p2.evaluate(() => document.querySelector("#laura .lm-pend").innerText);
    ok("Spatial بالفرنسية: بطاقة «Paiement BaridiMob — RIP : … → …» والتنبيه وملاحظة التنفيذ", /Paiement BaridiMob — RIP : « 00799999 0099999999 » → « 00799999 0055555555 »/.test(cf) && /vos clients enverront l’argent/.test(cf) && /Sera exécuté dans le tableau de bord/.test(cf), cf);
    r = await approve(p2); F = await pfile(); ok("Spatial/فرنسية: «Fait» والرقم الجديد منشور", /^Fait : /.test(r) && F.baridimob.rip === "00799999 0055555555", [r, F && F.baridimob]);
    ok("لا أخطاء صفحة", errs.length === 0, errs);

  } catch (e) { fails++; console.log("ERRS", JSON.stringify(globalThis.__errs)); try { console.log("DBG", JSON.stringify(await globalThis.__p.evaluate(() => { const l = document.getElementById("laura"); return { text: l && l.innerText.slice(-500) }; }))); } catch (e2) { } console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 900)); }
  finally { try { await b?.close(); } catch { } try { proxySrv?.close(); } catch { } try { store.stop(); } catch { } stack.stop(); }
  console.log(fails ? "\nFAILED: " + fails : "\nALL PASS (" + R.filter(x => x.startsWith("PASS")).length + ")"); process.exit(fails ? 1 : 0);
})();
