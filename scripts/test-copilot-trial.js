/* اختبار «وضع التجريب»: المفتاح في المتصفح (ImgGen) + واجهة PBCopilotUI، مع Gemini مُحاكى عبر اعتراض الشبكة (لا مفتاح حقيقي ولا اتصال خارجي).
   المفتاح في الاختبار قيمة مزيّفة. لم يُجرَّب مع Gemini الحقيقي — هذا ما سيفعله المالك. تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-copilot-trial.js */
const fs = require("fs"), path = require("path"); const { chromium } = require("playwright");
const ROOT = path.join(__dirname, ".."), PAGE = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/pages/memory-focus.json"), "utf8")), HELPERS = require("./lib/copilot-test-helpers.js");
let n = 0; const fails = []; const ok = (c, m, x) => { if (!c) { console.log("✗ " + m + (x !== undefined ? " " + JSON.stringify(x).slice(0, 500) : "")); fails.push(m); } else { n++; console.log("✓ " + m); } };
const FAKE = "AIzaSyFAKE_TEST_KEY_0123456789abcdefghij", sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, permissions: ["clipboard-read", "clipboard-write"] }), p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  const G = { calls: [], mode: {}, models: ["gemini-flash-latest", "gemini-2.5-flash-image"] };
  await p.goto("http://localhost:8765/admin.html?copilot=1"); await p.waitForTimeout(2800);
  await p.evaluate(pg => { window.__PAGE = pg; }, PAGE); await p.evaluate(HELPERS); await p.evaluate(() => { window.pbcp_v = id => document.getElementById(id).value; });
  const DESIGN = await p.evaluate(() => __T.designOps()); const PNG = await p.evaluate(async () => { const b = await __T.png(); return await new Promise(r => { const f = new FileReader(); f.onload = () => r(String(f.result).split(",")[1]); f.readAsDataURL(b); }); });
  await p.route(/generativelanguage\.googleapis\.com/, async route => {
    const rq = route.request(), u = rq.url(), hdr = rq.headers(), body = rq.postData() ? JSON.parse(rq.postData()) : {}; G.calls.push({ u, key: hdr["x-goog-api-key"], body, raw: rq.postData() || "" });
    const send = (st, o) => route.fulfill({ status: st, contentType: "application/json", body: JSON.stringify(o) }).catch(() => { });
    if (/\/models\?/.test(u)) return send(200, { models: G.models.map(n => ({ name: "models/" + n, supportedGenerationMethods: ["generateContent"] })) });
    const m = /models\/([^:]+):generateContent/.exec(u); if (!m) return send(404, {}); const gc = body.generationConfig || {}, prompt = ((body.contents || [{}])[0].parts || [{}])[0].text || "";
    if ((gc.responseModalities || []).includes("IMAGE")) { if (G.mode.hangImg) { await sleep(G.mode.hangImg); return send(504, {}); } return send(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: PNG } }] } }] }); }
    if (G.mode.hang) { await sleep(G.mode.hang); return send(504, {}); }
    if (G.mode.garbageOnce && !G.mode.did) { G.mode.did = 1; return send(200, { candidates: [{ content: { parts: [{ text: "هذا ليس JSON" }] } }] }); }
    if (G.mode.garbage) return send(200, { candidates: [{ content: { parts: [{ text: "هذا ليس JSON" }] } }] });
    let obj; if (/DESIGN PLAN/.test(prompt)) obj = { palette: { bg: "#F8F4E9" }, flow: ["offer"] }; else if (G.mode.envelope) obj = JSON.parse(JSON.stringify(G.mode.envelope).replace(/\$\{(\w+)\}/g, (_, v) => (G.vars || {})[v] || "zzzzzz")); else obj = DESIGN;
    return send(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });
  });
  const open = () => p.evaluate(async () => { await __T.open(); return PBApp.pageJson(); });
  const setKey = k => p.evaluate(k => { if (k) localStorage.setItem("alyssum_gp_gkey", k); else localStorage.removeItem("alyssum_gp_gkey"); localStorage.removeItem("alyssum_ai_token"); localStorage.setItem("alyssum_ig_budget", "5"); localStorage.setItem("alyssum_ig_spent", "0"); localStorage.removeItem("alyssum_ig_out"); }, k);
  const loaded = await p.evaluate(() => ({ cp: typeof PBCopilot, real: typeof PBCopilotReal, ui: typeof PBCopilotUI, fab: !!document.getElementById("pbcp-fab"), ctor: typeof PBCopilotReal.createBrowser }));
  ok(loaded.cp === "object" && loaded.real === "object" && loaded.ui === "object" && loaded.fab && loaded.ctor === "function", "?copilot=1 يحمّل الوحدات الثلاث ويظهر زر ✨ Copilot", loaded);
  const plain = await (async () => { const c2 = await b.newContext(), p2 = await c2.newPage(); await p2.goto("http://localhost:8765/admin.html"); await p2.waitForTimeout(1500); const r = await p2.evaluate(() => ({ cp: typeof PBCopilot, fab: !!document.getElementById("pbcp-fab") })); await c2.close(); return r; })();
  const kept = await (async () => { const p3 = await ctx.newPage(); await p3.goto("http://localhost:8765/admin.html"); await p3.waitForTimeout(1800); const r = await p3.evaluate(() => ({ cp: typeof PBCopilot, fab: !!document.getElementById("pbcp-fab") })); await p3.goto("http://localhost:8765/admin.html?copilot=0"); await p3.waitForTimeout(1500); const off = await p3.evaluate(() => ({ cp: typeof PBCopilot, ls: localStorage.getItem("alyssum_copilot") })); await p3.close(); return { r, off }; })();
  ok(kept.r.cp === "object" && kept.r.fab, "بعد ?copilot=1 مرة واحدة يبقى Copilot ظاهراً دون الوسيط (للهاتف)", kept);
  ok(kept.off.cp === "undefined" && kept.off.ls === null, "?copilot=0 يطفئه ويمسح الحفظ", kept);
  ok(plain.cp === "undefined" && !plain.fab, "بلا ?copilot=1 لا يُحمَّل شيء (المحرر كما هو)", plain);

  /* ───── واجهة المستخدم: مفتاح → ملء من المنتج → تشغيل → تراجع ───── */
  await setKey(""); const before0 = await open();
  await p.click("#pbcp-fab"); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.getElementById("pbcp-key") && !document.getElementById("pbcp").hidden), "بلا مفتاح: تظهر خانة المفتاح التجريبي");
  await p.fill("#pbcp-key", FAKE); await p.click("#pbcp-savekey"); await p.waitForTimeout(300);
  ok(await p.evaluate(k => localStorage.getItem("alyssum_gp_gkey") === k && !document.getElementById("pbcp-key"), FAKE), "حفظ المفتاح يخزّنه في آلية ImgGen القائمة فقط ويخفي الخانة");
  await p.click("#pbcp-fill"); await p.waitForTimeout(300);
  const filled = await p.evaluate(() => ({ prod: pbcp_v("pbcp-prod"), price: pbcp_v("pbcp-price"), old: pbcp_v("pbcp-old"), offers: [0, 1].map(i => pbcp_v("pbcp-op" + i)) }));
  ok(filled.price === "1800" && filled.old === "3100" && filled.offers.join() === "1800,3200", "«املأ من منتج الصفحة» ينسخ السعر والعروض من بيانات المنتج (قابلة للتعديل)", filled);
  await p.fill("#pbcp-ol0", "قارورة واحدة"); await p.fill("#pbcp-ol1", "قارورتان + قارورة هدية"); await p.fill("#pbcp-goal", "قسم عرض لعسل التركيز بتصميم دافئ متواصل"); G.calls.length = 0;
  await p.click("#pbcp-go"); await p.waitForFunction(() => /✓ اكتمل|✗ لم يُعتمد/.test(document.getElementById("pbcp-log").textContent), null, { timeout: 60000 });
  const U = await p.evaluate(async () => { const E = PBApp.E, log = document.getElementById("pbcp-log").textContent, off = E.page.sections[1], txt = off.free.map(w => __T.textOf(w)).filter(Boolean); return { log, nsec: E.page.sections.length, nfree: off.free.length, txt, imgs: off.free.filter(w => w.type === "image").map(w => w.set.src) }; });
  ok(/✓ اكتمل: done/.test(U.log) && U.nsec === 3 && U.nfree === 8, "التشغيل من الواجهة ينجح: قسم جديد بثماني طبقات مستقلة", { log: U.log.slice(-300), nsec: U.nsec });
  ok(U.txt.some(t => /^السعر: 1800 دج$/.test(t)) && U.txt.some(t => /3100 دج/.test(t)), "الأسعار من بيانات الواجهة نصوص عادية", U.txt);
  ok(U.imgs.length === 2 && U.imgs.every(s => /^(data:image|blob:|assets\/)/.test(s || "")), "الصورتان وُلّدتا ورُفعتا (مسار/عنوان صالح)", U.imgs.map(s => String(s).slice(0, 40)));
  const txtCalls = G.calls.filter(c => /generateContent/.test(c.u) && !((c.body.generationConfig || {}).responseModalities || []).includes("IMAGE")), imgCalls = G.calls.filter(c => ((c.body.generationConfig || {}).responseModalities || []).includes("IMAGE"));
  ok(txtCalls.length === 2 && imgCalls.length === 2, "نداءان للنص (خطة + أوامر) ونداءان للصور فقط", { t: txtCalls.length, i: imgCalls.length });
  ok(G.calls.every(c => c.key === FAKE && !c.raw.includes(FAKE)), "المفتاح يُرسل في الترويسة فقط ولا يظهر في أجسام الطلبات");
  ok(txtCalls.every(c => c.body.generationConfig.responseMimeType === "application/json") && txtCalls[1].body.generationConfig.maxOutputTokens >= 12000, "طلبات النص بنمط JSON وبسقف مخرجات كافٍ للأوامر");
  const lsDump = await p.evaluate(() => Object.keys(localStorage).filter(k => /copilot|alyssum_copilot/.test(k)).map(k => localStorage.getItem(k)).join("\n"));
  ok(!lsDump.includes(FAKE), "حالة التشغيل المحفوظة لا تحتوي المفتاح");
  await p.click("#pbcp-undo"); await p.waitForTimeout(300); ok(await p.evaluate(b => PBApp.pageJson() === b, before0), "زر ↶ تراجع يعيد الصفحة كما كانت (مدخل واحد)");
  const rep = await p.evaluate(async () => { document.getElementById("pbcp-copy").click(); await new Promise(r => setTimeout(r, 300)); return await navigator.clipboard.readText(); });
  ok(rep.includes('"ops"') && !rep.includes("AIza"), "«نسخ تقرير التشغيل» ينسخ الأوامر بلا أي مفتاح");

  /* ───── مخرجات سيئة، مهلة، إلغاء، ميزانية ───── */
  const run = (extra, mode) => { G.mode = mode || {}; G.calls.length = 0; return p.evaluate(async ([ex]) => { const E = PBApp.E, before = PBApp.pageJson(), h0 = E.hist.length, ctl = new AbortController(); window.__ctl = ctl; const ad = eval("(" + ex + ")"); let r, thrown = null; try { r = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: ad }); } catch (e) { thrown = { code: e.code, cancelled: !!e.cancelled }; } return { r, thrown, same: PBApp.pageJson() === before, h: E.hist.length - h0 }; }, [extra]); };
  const A = o => "PBCopilotReal.createBrowser(Object.assign({ store: PBCopilot.stores.mem(), signal: window.__ctl.signal, upload: async (b, n) => 'assets/img/pages/' + n + '.webp' }, " + (o || "{}") + "))";
  await setKey(FAKE); await open(); let X = await run(A(), { garbageOnce: 1 });
  ok(X.r && X.r.ok && X.r.status === "done", "ردّ أول غير JSON: ImgGen يجرّب نموذجاً آخر وينجح التشغيل", X.r && X.r.status);
  await open(); X = await run(A(), { garbage: 1 }); ok(X.r && !X.r.ok && X.same && X.h === 0, "كل الردود غير JSON: يفشل بلا أي تغيير في الصفحة", X.r);
  await open(); X = await run(A("{ timeoutMs: 1500 }"), { hang: 4000 }); ok(X.r && X.r.error && X.r.error.code === "timeout" && X.same && X.h === 0, "مهلة النموذج: يفشل بكود timeout والصفحة كما هي", X.r && X.r.error);
  await open(); G.mode = { hang: 4000 }; G.calls.length = 0; X = await p.evaluate(async (ex) => { const E = PBApp.E, before = PBApp.pageJson(), ctl = new AbortController(); window.__ctl = ctl; const ad = eval("(" + ex + ")"); setTimeout(() => ctl.abort(), 500); let thrown = null; try { await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: ad }); } catch (e) { thrown = { cancelled: !!e.cancelled, code: e.code }; } return { thrown, same: PBApp.pageJson() === before }; }, A("{ timeoutMs: 30000 }"));
  ok(X.thrown && X.thrown.cancelled && X.same, "الإلغاء: يُرمى cancelled والصفحة كما هي", X);
  await p.evaluate(() => localStorage.setItem("alyssum_ig_budget", "0.0001")); await p.evaluate(() => localStorage.setItem("alyssum_ig_spent", "5")); await open(); X = await run(A(), {});
  ok(X.r && !X.r.ok && X.same && G.calls.filter(c => /generateContent/.test(c.u)).length === 0, "ميزانية ImgGen مستنفدة: يرفض قبل أي نداء للنموذج", { st: X.r && X.r.status, err: X.r && X.r.error });
  await setKey(""); await open(); X = await run(A(), {}); ok(X.r && !X.r.ok && X.same && G.calls.length === 0, "بلا مفتاح: يرفض بلا أي نداء شبكة", X.r && X.r.error);
  await setKey(FAKE); await open(); const bad = JSON.parse(JSON.stringify(DESIGN)); bad.ops[4].args.layer.text = "السعر: 999 دج";
  X = await run(A(), { envelope: bad }); ok(X.r && X.r.status === "rejected" && X.same && X.h === 0 && X.r.errors.some(e => e.code === "price_unapproved"), "نموذج يخترع سعراً: يُرفض الغلاف بلا تغيير (التحقق في العميل يعمل في وضع التجريب أيضاً)", X.r);
  await open(); X = await run(A(), {}); ok(X.r && X.r.ok, "تشغيل ناجح ثانٍ بعد الإخفاقات (لا حالة عالقة)");
  ok(!errs.length, "لا أخطاء JavaScript في الصفحة", errs.slice(0, 3));
  await b.close(); console.log("\n" + n + " ✓" + (fails.length ? "  —  " + fails.length + " ✗: " + fails.join(" | ") : "")); process.exit(fails.length ? 1 : 0);
})();
