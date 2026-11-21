/* LAURA في Spatial Core من المتصفح إلى المحرّك: صفحة العالم (Chromium) ← LAURA UI ← الوسيط platform-proxy الحقيقي (index.ts، جلسات Supabase مُحاكاة) ← Worker حقيقي في workerd ← نموذج محاكى.
   يثبت: فتح LAURA بنقرة الكرة، محادثة وأدوات بيانات حقيقية، بطاقة موافقة وتنفيذ وتحقق، صلاحيات الموظف، أعطال النموذج، وتزامن حالة الكرة مع التنفيذ الفعلي.
   لا يثبت: جلسة Supabase الحقيقية داخل إطار اللوحة (مسار النقل الافتراضي findAPI) ولا نموذجاً لغوياً حقيقياً. التشغيل: WRANGLER_BIN=... NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/laura-ui.js */
const path = require("path"), http = require("http"), { spawn } = require("child_process"), PW = require("playwright");
const ROOT = path.resolve(__dirname, "../../.."), SHOTS = process.env.SHOTS || "";
const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (x !== undefined && !c ? "  " + JSON.stringify(x).slice(0, 300) : "")); console.log(R[R.length - 1]); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { startStack, BASE, ASECRET, MOCKKEY } = await import(path.join(ROOT, "platform/api/tools/laura-local-stack.mjs"));
  const stack = await startStack(); let static_ = null, proxySrv = null, b = null;
  try {
    const T = await stack.mkTenant("UI-A", { orders: 3 });
    /* الوسيط الحقيقي (index.ts بتجريد الأنواع) فوق خادم HTTP محلي؛ الجلسات مُحاكاة */
    const SESS = { "owner-jwt": { owner: true, email: "owner@x.dz", name: "المالك" }, "agent-jwt": { owner: false, role: "agent", email: "agent@x.dz", perms: ["orders", "orders.write", "callcenter"] } };
    globalThis.Deno = { env: { get: k => ({ SUPABASE_URL: "https://sb.example", SUPABASE_ANON_KEY: "anon", PLATFORM_URL: BASE, PLATFORM_KEY: T.key, LAURA_ACTOR_SECRET: ASECRET, PLATFORM_TENANT_ID: String(T.id) }[k]) }, serve: h => { globalThis.__proxy = h; } };
    const realFetch = globalThis.fetch; globalThis.fetch = async (url, init = {}) => { url = String(url); const auth = (init.headers?.Authorization ?? "").replace("Bearer ", ""); if (url === "https://sb.example/rest/v1/rpc/staff_me") { const me = SESS[auth]; return new Response(JSON.stringify(me ?? { role: null }), { status: me ? 200 : 401 }); } if (url === "https://sb.example/rest/v1/rpc/is_admin") return new Response(JSON.stringify(!!SESS[auth]?.owner), { status: 200 }); return realFetch(url, init); };
    await import(path.join(ROOT, "platform/supabase/functions/platform-proxy/index.ts") + "?ui=1");
    proxySrv = http.createServer(async (req, res) => { const ch = []; for await (const c of req) ch.push(c); const r = await globalThis.__proxy(new Request("http://proxy.local/", { method: req.method, headers: req.headers, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(ch) })); res.statusCode = r.status; r.headers.forEach((v, k) => res.setHeader(k, v)); res.end(Buffer.from(await r.arrayBuffer())); }).listen(8790, "127.0.0.1");
    static_ = spawn("python3", ["-m", "http.server", "8767", "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" }); await wait(1200);
    b = await PW.chromium.launch(); const ctxB = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctxB.newPage(), errs = []; p.setDefaultTimeout(20000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await p.addInitScript(() => { window.__spoken = []; const ss = { speaking: false, speak(u) { window.__spoken.push(u.text); setTimeout(() => { u.onstart && u.onstart(); u.onboundary && u.onboundary(); setTimeout(() => u.onend && u.onend(), 80); }, 20); }, cancel() { }, getVoices() { return []; }, addEventListener() { } }; try { Object.defineProperty(window, "speechSynthesis", { value: ss, configurable: true }); } catch (_) { } });
    const URL_ = "http://127.0.0.1:8767/admin-preview/spatial-os/index.html?real=1";
    await p.goto(URL_); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && typeof Laura !== "undefined", null, { timeout: 30000 }); await wait(800);
    const setT = (mode) => p.evaluate(mode => { window.__JWT = "owner-jwt"; window.__DELAY_CONFIRM = 0; Laura.setTransport(async (m, pth, body) => { if (mode === "down") throw { code: "unavailable" }; if (/confirm/.test(pth) && window.__DELAY_CONFIRM) await new Promise(r => setTimeout(r, window.__DELAY_CONFIRM)); const r = await fetch("http://127.0.0.1:8790/", { method: "POST", headers: { Authorization: "Bearer " + window.__JWT, "Content-Type": "application/json" }, body: JSON.stringify({ method: m, path: pth, body }) }); const j = await r.json(); if (!r.ok || !j.ok) throw { code: j.error || "unavailable" }; return { status: j.status, data: j.data }; }); }, mode);
    await setT("up");
    /* نقرة الكرة تفتح LAURA */
    await p.click("#core"); await p.waitForFunction(() => { const l = document.getElementById("laura"); return l && !l.hidden; }, null, { timeout: 15000 });
    ok("نقرة الكرة تفتح LAURA (بعد health ناجح من Worker عبر الوسيط)", await p.evaluate(() => Laura.ready && Laura.open && !SpatialOS.panels.has("ai") && !SpatialOS.panels.has("help")));
    const sample = () => p.evaluate(() => { window.__vis = []; clearInterval(window.__vt); window.__vt = setInterval(() => { const v = Core3D.state().visual; if (window.__vis[window.__vis.length - 1] !== v) window.__vis.push(v); }, 25); });
    const ask = async (t) => { await p.fill("#laura input", t); await p.press("#laura input", "Enter"); await p.waitForFunction(() => !Laura.state().busy, null, { timeout: 20000 }); await wait(150); };
    const lastA = () => p.evaluate(() => { const a = [...document.querySelectorAll("#laura .lm-a, #laura .lm-e")]; return a.length ? a[a.length - 1].innerText : ""; });
    await stack.ctl({ delay: 600 }); await sample(); await ask("كم طلب لدي؟");
    ok("محادثة: ردّ من بيانات Worker الحقيقية (3 طلبات) مع شريحة الأداة", /لديك 3 طلباً/.test(await lastA()) && await p.evaluate(() => /إحصاءات الطلبات/.test(document.querySelector("#laura .lm-msgs").innerText)));
    ok("الكرة اتبعت التنفيذ الحقيقي: thinking أثناء الطلب ثم success", await p.evaluate(() => window.__vis.includes("thinking") && window.__vis.includes("success")), await p.evaluate(() => window.__vis));
    ok("الردّ نُطق بصوت المتصفح (والكرة اهتزت بنبضات الكلام)", await p.evaluate(() => window.__spoken.some(t => /لديك 3/.test(t))));
    await stack.ctl({ delay: 0 });
    await ask("chhal mabi3at lyoum"); ok("دارجة لاتينية في الواجهة", /Lmabi3at \(today\): 3 commande/.test(await lastA()));
    await ask("Combien de commandes ai-je ?"); ok("فرنسية في الواجهة", /Vous avez 3 commandes/.test(await lastA()));
    /* موافقة صريحة */
    const R1 = T.refs[0], st = async ref => { for (let a = 0, i = 0; i < 4; i++) { const j = (await stack.http("GET", "/v1/orders?limit=100" + (a ? "&after=" + a : ""), { key: T.key })).j; const o = (j.orders || []).find(x => x.ref === ref); if (o) return o.status; if (!j.next) return null; a = j.next; } return null; };
    await ask("أكد الطلب " + R1);
    ok("طلب تأكيد: بطاقة موافقة ظاهرة بالملخص، والطلب لم يتغيّر في المنصة", await p.evaluate(r => { const c = document.querySelector("#laura .lm-pend"); return !!c && c.innerText.includes(r) && !!c.querySelector(".lm-ok"); }, R1) && (await st(R1)) === "nouvelle");
    await p.evaluate(() => { window.__DELAY_CONFIRM = 700; }); await sample(); await p.click("#laura .lm-pend .lm-ok"); await p.waitForFunction(() => !Laura.state().busy && !document.querySelector("#laura .lm-pend"), null, { timeout: 20000 }); await wait(200);
    ok("الموافقة: تنفيذ وتحقق (الردّ يذكر «مؤكَّدة») والطلب confirmee فعلاً في D1 المحلية", /مؤكَّدة/.test(await lastA()) && (await st(R1)) === "confirmee");
    ok("الكرة: executing أثناء التنفيذ ثم success", await p.evaluate(() => window.__vis.includes("executing") && window.__vis.includes("success")), await p.evaluate(() => window.__vis));
    await p.evaluate(() => { window.__DELAY_CONFIRM = 0; });
    const R2 = T.refs[1]; await ask("ألغ الطلب " + R2); ok("إلغاء: بطاقة حساسة بتنبيه خاص", await p.evaluate(() => !!document.querySelector("#laura .lm-pend.sens")));
    await p.click("#laura .lm-pend .lm-no"); await p.waitForFunction(() => !document.querySelector("#laura .lm-pend"), null, { timeout: 10000 }); await wait(200);
    ok("رفض المستخدم: لا تنفيذ والطلب كما هو", (await st(R2)) === "nouvelle" && /لم يُنفَّذ|أُلغي/.test(await lastA()));
    /* الموظف */
    await p.evaluate(() => { window.__JWT = "agent-jwt"; }); await ask("TEST_CALL:products_list:{}");
    ok("موظف اتصال: أداة المنتجات محجوبة من الخادم وتظهر كشريحة «تعذّر»", await p.evaluate(() => !!document.querySelector("#laura .lm-chip.no")) && !/عسل/.test(await p.evaluate(() => document.querySelector("#laura .lm-msgs").innerText.split("TEST_CALL")[1] || "")));
    await p.evaluate(() => { window.__JWT = "bad-jwt"; }); await ask("كم طلب"); ok("جلسة غير صالحة: رسالة «سجّل الدخول» لا تفاصيل تقنية", /سجّل الدخول/.test(await lastA()));
    await p.evaluate(() => { window.__JWT = "owner-jwt"; });
    /* أعطال النموذج */
    await stack.ctl({ fail: { mode: "500", times: 2 } }); await sample(); await ask("كم طلب لدي؟"); ok("عطل النموذج: رسالة عربية واضحة بلا نصّ المزوّد، والكرة error", /تعذّر الوصول للنموذج/.test(await lastA()) && !/LEAK/.test(await lastA()) && await p.evaluate(() => window.__vis.includes("error")), await p.evaluate(() => window.__vis));
    await stack.ctl({ fail: { mode: "429", times: 1 } }); await ask("كم طلب لدي؟"); ok("429: «النموذج مشغول»", /النموذج مشغول/.test(await lastA())); await stack.ctl({ fail: null });
    /* أسرار */
    const dom = await p.evaluate(() => document.documentElement.outerHTML + JSON.stringify(localStorage) + JSON.stringify(sessionStorage)); ok("لا مفتاح نموذج ولا سرّ هوية ولا مفتاح منصة في صفحة المتصفح", !dom.includes(MOCKKEY) && !dom.includes(ASECRET) && !dom.includes(T.key));
    if (SHOTS) await p.screenshot({ path: SHOTS + "/laura-ui.png" });
    ok("لا أخطاء صفحة", errs.length === 0, errs);
    /* رجوع للمسار القديم عند عدم توفر LAURA */
    const p2 = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); await p2.goto(URL_); await p2.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && typeof Laura !== "undefined", null, { timeout: 30000 });
    await p2.evaluate(() => Laura.setTransport(async () => { throw { code: "unavailable" }; })); await wait(500); await p2.click("#core"); await wait(2500);
    ok("بلا LAURA (الخدمة غير متاحة): نقرة الكرة تفتح المسار القديم «اسألني» ولا تُظهر لوحة LAURA", await p2.evaluate(() => (SpatialOS.panels.has("ai") || SpatialOS.panels.has("help")) && (!document.getElementById("laura") || document.getElementById("laura").hidden)));
  } catch (e) { fails++; console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 700)); }
  finally { try { await b?.close(); } catch { } try { static_?.kill(); } catch { } try { proxySrv?.close(); } catch { } stack.stop(); }
  console.log(fails ? "\nFAILED: " + fails : "\nALL PASS (" + R.filter(x => x.startsWith("PASS")).length + ")"); process.exit(fails ? 1 : 0);
})();
