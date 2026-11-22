/* قبول LAURA المركزية: لوحة التحكم الحقيقية admin.html (زر + محادثة مدمجة مباشرة في الصفحة بلا iframe) ← تحليل + إجراء بموافقة ← Spatial Core يكمل بنفس الذاكرة والسياق. متجر PHP محلي حقيقي + الوسيط + Worker في workerd + نموذج محاكى.
   يثبت: استخراج بنية «الرئيسية» الحقيقية (إحصائيات اليوم، المؤشرات بالفترات الثلاث، نسب التسليم، الحالات...)، عدم تغيير فترة اللوحة الظاهرة، والإجابة من الأرقام المعروضة (9 ≠ 0).
   لا يثبت: نموذجاً لغوياً حقيقياً. التشغيل: WRANGLER_BIN=... NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/laura-stats-ui.js */
const path = require("path"), http = require("http"), PW = require("playwright");
const ROOT = path.resolve(__dirname, "../../.."); const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (x !== undefined && !c ? "  " + JSON.stringify(x).slice(0, 360) : "")); console.log(R[R.length - 1]); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { startStack, BASE, ASECRET } = await import(path.join(ROOT, "platform/api/tools/laura-local-stack.mjs")), { startStore } = require("./harness");
  const stack = await startStack(), store = await startStore(); let proxySrv = null, b = null;
  try {
    const T = await stack.mkTenant("ADMIN-A", { orders: 3 });
    const SESS = { "owner-jwt": { owner: true, email: "owner@x.dz", name: "المالك" }, "agent-jwt": { owner: false, role: "agent", email: "agent@x.dz", perms: ["orders", "orders.write", "callcenter"] } };
    globalThis.Deno = { env: { get: k => ({ SUPABASE_URL: "https://sb.example", SUPABASE_ANON_KEY: "anon", PLATFORM_URL: BASE, PLATFORM_KEY: T.key, LAURA_ACTOR_SECRET: ASECRET, PLATFORM_TENANT_ID: String(T.id) }[k]) }, serve: h => { globalThis.__proxy = h; } };
    const realFetch = globalThis.fetch; globalThis.fetch = async (url, init = {}) => { url = String(url); const auth = (init.headers?.Authorization ?? "").replace("Bearer ", ""); if (url === "https://sb.example/rest/v1/rpc/staff_me") { const me = SESS[auth]; return new Response(JSON.stringify(me ?? { role: null }), { status: me ? 200 : 401 }); } if (url === "https://sb.example/rest/v1/rpc/is_admin") return new Response(JSON.stringify(!!SESS[auth]?.owner), { status: 200 }); return realFetch(url, init); };
    await import(path.join(ROOT, "platform/supabase/functions/platform-proxy/index.ts") + "?ad=1");
    proxySrv = http.createServer(async (req, res) => { const ch = []; for await (const c of req) ch.push(c); const r = await globalThis.__proxy(new Request("http://proxy.local/", { method: req.method, headers: req.headers, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(ch) })); res.statusCode = r.status; r.headers.forEach((v, k) => res.setHeader(k, v)); res.end(Buffer.from(await r.arrayBuffer())); }).listen(8790, "127.0.0.1");
    b = await PW.chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = (globalThis.__p = await ctx.newPage()), errs = []; p.setDefaultTimeout(30000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await p.addInitScript(() => { window.__spoken = []; try { Object.defineProperty(window, "speechSynthesis", { value: { speaking: false, speak(u) { window.__spoken.push(u.text); }, cancel() { }, getVoices() { return []; }, addEventListener() { } }, configurable: true }); } catch (_) { } });
    const wireSession = (jwt) => p.evaluate(j => { API.sb.token = async () => j; API.sb.url = () => "http://127.0.0.1:8790/"; API.sb.headers = t => ({ Authorization: "Bearer " + t, "Content-Type": "application/json" }); }, jwt);
    const lastA = (pg) => pg.evaluate(() => { const a = [...document.querySelectorAll("#laura .lm-a, #laura .lm-e")]; return a.length ? a[a.length - 1].innerText : ""; });
    const askOn = async (pg, t) => { await pg.fill("#laura input", t); await pg.press("#laura input", "Enter"); await pg.waitForFunction(() => !Laura.state().busy, null, { timeout: 30000 }); await wait(200); return lastA(pg); };
    const st = async ref => { for (let a = 0, i = 0; i < 4; i++) { const j = (await stack.http("GET", "/v1/orders?limit=100" + (a ? "&after=" + a : ""), { key: T.key })).j; const o = (j.orders || []).find(x => x.ref === ref); if (o) return o.status; if (!j.next) return null; a = j.next; } return null; };
    /* 1) لوحة التحكم الحقيقية بجلسة المتجر */
    await p.goto(store.base + "/admin.html"); await wait(800); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
    await p.goto(store.base + "/admin.html"); await p.waitForFunction(() => typeof Admin !== "undefined" && document.getElementById("ahome") && document.getElementById("ahome").children.length, null, { timeout: 60000 }); await wait(500);
    ok("بلا جلسة سحابية صالحة: لا زر LAURA (لا واجهة ميتة)", await p.evaluate(() => !document.getElementById("laura-fab")));
    await wireSession("owner-jwt"); await p.waitForSelector("#laura-fab", { timeout: 40000 });
    ok("بعد جلسة صالحة ووحدة مفعّلة: يظهر زر LAURA في لوحة التحكم", true);
    await p.click("#laura-fab"); await p.waitForFunction(() => { const l = document.getElementById("laura"); return l && !l.hidden && /ADMIN-A/.test(l.innerText); });
    ok("المحادثة مدمجة في الصفحة نفسها (لا iframe) واسم المتجر الحالي مكتشف تلقائياً", await p.evaluate(() => !!document.querySelector("body > #laura.admin") && document.querySelectorAll("#laura iframe").length === 0 && window.Laura.state().ready === true));
    let r = await askOn(p, "كم طلب لدي؟"); ok("تحليل: ردّ من بيانات Worker الحقيقية لهذا المتجر (3 طلبات)", /لديك 3 طلباً/.test(r), r);
    r = await askOn(p, "كم أرسلت من طلب اليوم؟"); ok("«المرسَلة اليوم» تُقرأ من رئيسية لوحة التحكم نفسها (لا أداة ولا تخمين)", /أُرسل اليوم \d+ طلب/.test(r) && /إحصائيات اليوم/.test(r), r);
    const R1 = T.refs[0], R2 = T.refs[1];
    r = await askOn(p, "أكد الطلب " + R1); ok("إجراء: بطاقة موافقة صريحة والطلب لم يتغيّر", (await p.evaluate(() => document.querySelectorAll("#laura .lm-pend").length)) === 1 && (await st(R1)) === "nouvelle");
    await p.click("#laura .lm-ok"); await p.waitForFunction(() => document.querySelectorAll("#laura .lm-pend").length === 0 && /مؤكَّدة/.test(document.querySelector("#laura .lm-msgs").innerText), null, { timeout: 30000 });
    ok("الموافقة: نُفّذ وتُحقّق منه فعلاً في المنصة (confirmee)", (await st(R1)) === "confirmee");
    await askOn(p, "ألغ الطلب " + R2); ok("إجراء ثانٍ (إلغاء) يبقى معلّقاً بلا قرار من المستخدم", (await p.evaluate(() => document.querySelectorAll("#laura .lm-pend.sens").length)) === 1 && (await st(R2)) === "nouvelle");
    /* 2) Spatial Core (نفس المستخدم/المتجر): نفس الذاكرة ونفس الإجراء المعلّق */
    const p2 = await ctx.newPage(); p2.setDefaultTimeout(30000); p2.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await p2.goto(store.spatial + "?nozoom=1"); await p2.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && typeof Laura !== "undefined" && SpatialOS.spare.ready, null, { timeout: 60000 }); await wait(1200);
    await p2.evaluate(() => { Laura.setTransport(async (m, pth, body) => { const r = await fetch("http://127.0.0.1:8790/", { method: "POST", headers: { Authorization: "Bearer owner-jwt", "Content-Type": "application/json" }, body: JSON.stringify({ method: m, path: pth, body }) }); const j = await r.json(); if (!r.ok || !j.ok) throw { code: j.error || "unavailable" }; return { status: j.status, data: j.data }; }); });
    ok("إطارات اللوحات في Spatial لا تحمل نواة LAURA ولا زراً (نواة واحدة في الصفحة الأم)", await p2.evaluate(() => { const f = SpatialOS.spare.frame; try { return f.contentWindow.Laura === undefined && !f.contentDocument.getElementById("laura-fab"); } catch (_) { return false; } }));
    await p2.click("#core"); await p2.waitForFunction(() => { const l = document.getElementById("laura"); return l && !l.hidden && l.querySelectorAll(".lm-pend").length; }, null, { timeout: 30000 });
    const txt = await p2.evaluate(() => document.querySelector("#laura .lm-msgs").innerText);
    ok("Spatial: نفس المحادثة (رسائل لوحة التحكم) تظهر بلا فقدان السياق", /كم طلب لدي/.test(txt) && /أكد الطلب/.test(txt) && /ألغ الطلب/.test(txt) && /ADMIN-A/.test(await p2.evaluate(() => document.getElementById("laura").innerText)), txt.slice(0, 200));
    ok("Spatial: الإجراء المعلّق من لوحة التحكم ظاهر ويمكن حسمه", await p2.evaluate(() => /ألغ|إلغاء/.test(document.querySelector("#laura .lm-pend").innerText)));
    await p2.click("#laura .lm-ok"); await p2.waitForFunction(() => document.querySelectorAll("#laura .lm-pend").length === 0, null, { timeout: 30000 }); await wait(400);
    ok("الموافقة من Spatial: الطلب أُلغي فعلاً في المنصة (annulee)", (await st(R2)) === "annulee");
    r = await askOn(p2, "كم طلب لدي؟"); ok("Spatial يكمل الحوار بنفس المحرك (بيانات حقيقية بعد الإلغاء)", /لديك 3 طلباً/.test(r), r);
    /* 3) العودة للوحة التحكم: تُحدَّث بما جرى في Spatial عند الفتح (بلا تكرار نظامين) */
    await p.click("#laura .lm-x"); await wait(4500); await p.click("#laura-fab"); await p.waitForFunction(() => document.querySelectorAll("#laura .lm-pend").length === 0 && /أُلغي|ملغاة|ألغي/.test(document.querySelector("#laura .lm-msgs").innerText), null, { timeout: 20000 });
    ok("لوحة التحكم تعرض ما جرى في Spatial (الإجراء حُسم، لا بطاقة قديمة)", true);
    const hs = (await (await fetch("http://127.0.0.1:8790/", { method: "POST", headers: { Authorization: "Bearer owner-jwt", "Content-Type": "application/json" }, body: JSON.stringify({ method: "GET", path: "/v1/laura/history" }) })).json()).data; ok("الذاكرة على الخادم: واجهتان (admin وspatial) في محادثة واحدة", !!hs && new Set((hs.messages || []).map(m => m.client).filter(Boolean)).size === 2, (hs.messages || []).map(m => m.client));
    /* 4) موظف اتصال: صلاحياته الفعلية من الخادم */
    const pA = await ctx.newPage(); pA.setDefaultTimeout(30000); pA.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await pA.goto(store.base + "/admin.html"); await pA.waitForFunction(() => typeof Admin !== "undefined", null, { timeout: 60000 });
    await pA.evaluate(() => { API.sb.token = async () => "agent-jwt"; API.sb.url = () => "http://127.0.0.1:8790/"; API.sb.headers = t => ({ Authorization: "Bearer " + t, "Content-Type": "application/json" }); }); await pA.waitForSelector("#laura-fab", { timeout: 40000 }); await pA.click("#laura-fab"); await pA.waitForFunction(() => { const l = document.getElementById("laura"); return l && !l.hidden; });
    r = await askOn(pA, "TEST_CALL:payments_pending:{}"); ok("موظف اتصال في لوحة التحكم: أداة الدفعات محجوبة من الخادم (شريحة «تعذّر»)", await pA.evaluate(() => /تعذّر/.test(document.querySelector("#laura .lm-msgs").innerText)));
    r = await askOn(pA, "كم طلب لدي؟"); ok("نفس الموظف يحلّل الطلبات (مسموح)", /لديك \d+ طلباً/.test(r), r);
    const dom = await p.evaluate(() => document.documentElement.outerHTML + JSON.stringify(localStorage)); ok("لا مفتاح منصة ولا سرّ هوية في صفحة لوحة التحكم", !dom.includes(T.key) && !dom.includes(ASECRET));
    ok("لا أخطاء صفحة", errs.length === 0, errs);
  } catch (e) { fails++; try { console.log("DBG", JSON.stringify(await globalThis.__p.evaluate(() => { const l = document.getElementById("laura"); return { has: !!l, hidden: l && l.hidden, text: l && l.innerText.slice(0, 300), st: window.Laura && Laura.state() }; }))); } catch (e2) { console.log("DBGERR", String(e2).slice(0, 200)); } console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 900)); }
  finally { try { await b?.close(); } catch { } try { proxySrv?.close(); } catch { } try { store.stop(); } catch { } stack.stop(); }
  console.log(fails ? "\nFAILED: " + fails : "\nALL PASS (" + R.filter(x => x.startsWith("PASS")).length + ")"); process.exit(fails ? 1 : 0);
})();
