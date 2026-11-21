/* LAURA تقرأ إحصائيات الرئيسية الحقيقية: متجر PHP محلي حقيقي (لوحة التحكم الفعلية) + Spatial Core + الوسيط + Worker حقيقي في workerd + نموذج محاكى.
   يثبت: استخراج بنية «الرئيسية» الحقيقية (إحصائيات اليوم، المؤشرات بالفترات الثلاث، نسب التسليم، الحالات...)، عدم تغيير فترة اللوحة الظاهرة، والإجابة من الأرقام المعروضة (9 ≠ 0).
   لا يثبت: نموذجاً لغوياً حقيقياً. التشغيل: WRANGLER_BIN=... NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/laura-stats-ui.js */
const path = require("path"), http = require("http"), PW = require("playwright");
const ROOT = path.resolve(__dirname, "../../.."); const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (x !== undefined && !c ? "  " + JSON.stringify(x).slice(0, 360) : "")); console.log(R[R.length - 1]); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { startStack, BASE, ASECRET } = await import(path.join(ROOT, "platform/api/tools/laura-local-stack.mjs")), { startStore } = require("./harness");
  const stack = await startStack(), store = await startStore(); let proxySrv = null, b = null;
  try {
    const T = await stack.mkTenant("STATS", { orders: 2 });
    const SESS = { "owner-jwt": { owner: true, email: "owner@x.dz", name: "المالك" } };
    globalThis.Deno = { env: { get: k => ({ SUPABASE_URL: "https://sb.example", SUPABASE_ANON_KEY: "anon", PLATFORM_URL: BASE, PLATFORM_KEY: T.key, LAURA_ACTOR_SECRET: ASECRET, PLATFORM_TENANT_ID: String(T.id) }[k]) }, serve: h => { globalThis.__proxy = h; } };
    const realFetch = globalThis.fetch; globalThis.fetch = async (url, init = {}) => { url = String(url); const auth = (init.headers?.Authorization ?? "").replace("Bearer ", ""); if (url === "https://sb.example/rest/v1/rpc/staff_me") { const me = SESS[auth]; return new Response(JSON.stringify(me ?? { role: null }), { status: me ? 200 : 401 }); } return realFetch(url, init); };
    await import(path.join(ROOT, "platform/supabase/functions/platform-proxy/index.ts") + "?st=1");
    proxySrv = http.createServer(async (req, res) => { const ch = []; for await (const c of req) ch.push(c); const r = await globalThis.__proxy(new Request("http://proxy.local/", { method: req.method, headers: req.headers, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(ch) })); res.statusCode = r.status; r.headers.forEach((v, k) => res.setHeader(k, v)); res.end(Buffer.from(await r.arrayBuffer())); }).listen(8790, "127.0.0.1");
    b = await PW.chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(), errs = []; p.setDefaultTimeout(30000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await p.goto(store.base + "/admin.html"); await wait(800); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
    await p.goto(store.spatial + "?nozoom=1"); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && typeof Laura !== "undefined" && SpatialOS.spare.ready, null, { timeout: 60000 }); await wait(1500);
    await p.evaluate(() => { Laura.setTransport(async (m, pth, body) => { const r = await fetch("http://127.0.0.1:8790/", { method: "POST", headers: { Authorization: "Bearer owner-jwt", "Content-Type": "application/json" }, body: JSON.stringify({ method: m, path: pth, body }) }); const j = await r.json(); if (!r.ok || !j.ok) throw { code: j.error || "unavailable" }; return { status: j.status, data: j.data }; }); window.__capture = []; const orig = window.fetch; window.fetch = async (u, i) => { if (/8790/.test(String(u)) && i && i.body && /laura\/chat/.test(i.body)) window.__capture.push(JSON.parse(i.body)); return orig(u, i); }; });
    const baseD = await p.evaluate(() => { const d = SpatialOS.spare.frame.contentDocument, on = d.querySelector("#ahome .ah-seg .on"); return on && on.getAttribute("data-d"); });
    const st = await p.evaluate(() => Laura.collectStats());
    ok("لقطة الرئيسية الحقيقية: أقسام «إحصائيات اليوم» و«مؤشرات الفترة» و«نسب التسليم» و«آخر الطلبات»", !!st && ["إحصائيات اليوم", "مؤشرات الفترة", "نسب التسليم والإرجاع", "آخر الطلبات"].every(t => st.snapshots.some(sn => sn.sections.some(x => x.title === t))), st && st.snapshots.map(s => [s.period, s.sections.map(x => x.title)]));
    ok("ثلاث فترات (اليوم/7 أيام/30 يوماً) بقيم مؤشرات من المنصة نفسها", ["اليوم", "7", "30"].every(k => st.snapshots.some(sn => sn.period.includes(k) && sn.sections.some(x => x.title === "مؤشرات الفترة"))), st.snapshots.map(s => s.period));
    const today = st.snapshots.flatMap(sn => sn.sections).find(x => x.title === "إحصائيات اليوم");
    ok("إحصائيات اليوم: الأربعة (عدد المرسَلة، السعر الإجمالي، سعر التوصيل، الصافي) بقيمها المعروضة", !!today && today.metrics.map(m => m.label).join("|") === "عدد الطلبات المرسَلة|السعر الإجمالي|سعر التوصيل|الصافي" && today.metrics[0].value === (await p.evaluate(() => SpatialOS.spare.frame.contentDocument.querySelector("#ahome .ah-pc strong").textContent.trim())), today);
    ok("اللقطة من إطار خفي: فترة لوحة الرئيسية رجعت كما كانت (لا تبدّل مرئي)", (await p.evaluate(() => { const d = SpatialOS.spare.frame.contentDocument, on = d.querySelector("#ahome .ah-seg .on"); return on && on.getAttribute("data-d"); })) === baseD, baseD);
    ok("حجم اللقطة ضمن الحدّ (<40KB) وبلا HTML/SVG", JSON.stringify(st).length < 40000 && !/<svg|<div|<table/.test(JSON.stringify(st)), JSON.stringify(st).length);
    /* الإجابة من المنصة: 0 كما تعرض الرئيسية، ثم 9 بعد تغيّر الرقم المعروض */
    await p.click("#core"); await p.waitForFunction(() => { const l = document.getElementById("laura"); return l && !l.hidden; }); const ask = async t => { await p.evaluate(() => { const i = document.querySelector("#laura input"); i.value = ""; }); await p.fill("#laura input", t); await p.press("#laura input", "Enter"); await p.waitForFunction(() => !Laura.state().busy, null, { timeout: 30000 }); await wait(200); return p.evaluate(() => { const a = [...document.querySelectorAll("#laura .lm-a, #laura .lm-e")]; return a[a.length - 1].innerText; }); };
    let r = await ask("كم أرسلت من طلب اليوم؟"); ok("«كم أرسلت من طلب اليوم؟» ← تُجاب من إحصائيات اليوم المعروضة (0) لا من تخمين", /أُرسل اليوم 0 طلب/.test(r) && /إحصائيات اليوم/.test(r), r);
    ok("أُرسلت اللقطة مع الرسالة (من الرئيسية الحقيقية)", await p.evaluate(() => window.__capture.length >= 1 && window.__capture[0].body.stats && window.__capture[0].body.stats.snapshots.length >= 2));
    await p.evaluate(() => { const d = SpatialOS.spare.frame.contentDocument; d.querySelector("#ahome .ah-pc strong").textContent = "9"; Laura.setStatsProvider(null); });
    r = await ask("كم أرسلت من طلب اليوم؟"); ok("بعد أن يعرض اللوح 9: تُجاب 9 (الرقم يتبع المنصة)", /أُرسل اليوم 9 طلب/.test(r), r);
    r = await ask("Combien de commandes envoyées aujourd'hui ?"); ok("فرنسية: 9", /Aujourd'hui 9 commande/.test(r), r);
    ok("لا أخطاء صفحة", errs.length === 0, errs);
  } catch (e) { fails++; console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 700)); }
  finally { try { await b?.close(); } catch { } try { proxySrv?.close(); } catch { } try { store.stop(); } catch { } stack.stop(); }
  console.log(fails ? "\nFAILED: " + fails : "\nALL PASS (" + R.filter(x => x.startsWith("PASS")).length + ")"); process.exit(fails ? 1 : 0);
})();
