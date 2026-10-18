/* اختبار AiProxy: مع رمز الموقع تمرّ كل استدعاءات التوليد عبر دالة الخادم (لا اتصال مباشر ولا مفتاح في المتصفح).
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-ai-proxy.js */
const { chromium } = require("playwright");
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } };
const TOK = "ab12".repeat(10);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }), p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  const proxyCalls = [], direct = []; let mode = "ok", planned = 0;
  await p.route(/functions\/v1\/ai$/, async r => {
    const q = JSON.parse(r.request().postData() || "{}"); proxyCalls.push(q);
    if (mode === "nocredit") return r.fulfill({ status: 402, contentType: "application/json", body: JSON.stringify({ error: "no_credits", message: "انتهى رصيدك من هذه الخدمة" }) });
    if (mode === "notcfg") return r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "not_configured" }) });
    let text = "{}";
    if (q.kind === "text") { const pr = q.parts[0].text; text = /خطة تصميم/.test(pr) && !/خطة التصميم المعتمدة/.test(pr) ? JSON.stringify({ concept: "x", palette: { primary: "#1e5e20" }, sections: [], assets: [] }) : JSON.stringify({ format: "alyssum-design/1", page: { title: "t", width: 1080 }, sections: [{ height: 400, layers: [{ type: "heading", text: "مرحبا", x: 60, y: 60, w: 500, font: { size: 60 } }] }] }); }
    const body = q.kind === "image" ? { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "iVBORw0KGgo=" } }] } }] } : { candidates: [{ content: { parts: [{ text }] } }] };
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, left: 41, model: "m", data: body }) });
  });
  await p.route(/generativelanguage\.googleapis\.com/, r => { direct.push(r.request().url()); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }) }); });
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  t("الوحدة محمّلة", await p.evaluate(() => typeof AiProxy === "object" && typeof AiProxy.set === "function"));

  /* بلا رمز: سلوك قديم (اتصال مباشر بمفتاح المتصفح) */
  await p.evaluate(() => { localStorage.removeItem("alyssum_ai_token"); localStorage.setItem("alyssum_gp_gkey", "AIzaTEST"); });
  await p.evaluate(async () => { try { await ImgGen.text({ prompt: "x", json: false }); } catch (e) { } });
  t("بلا رمز: اتصال مباشر ولا يمرّ بالخادم", direct.length >= 1 && direct.length <= 2 && proxyCalls.length === 0, { d: direct.length, p: proxyCalls.length });

  /* رمز غير صالح يُرفض */
  const bad1 = await p.evaluate(() => AiProxy.set("not-a-token")); t("رمز غير صالح يُرفض", bad1.ok === false, bad1);

  /* مع رمز صالح */
  direct.length = 0; proxyCalls.length = 0;
  await p.evaluate(t => { localStorage.removeItem("alyssum_gp_gkey"); AiProxy.set(t); }, TOK);
  const st = await p.evaluate(() => ({ on: AiProxy.on(), key: localStorage.getItem("alyssum_gp_gkey"), rd: ImgGen.ready() }));
  t("الرمز يفعّل الوضع ويضع علامة بدل المفتاح، والتوليد جاهز", st.on && st.key === "via-proxy" && st.rd.ok, st);
  const tx = await p.evaluate(async () => { const r = await ImgGen.text({ prompt: "hello", json: false }); return { r, left: AiProxy.state.left }; });
  t("نص: يمرّ بالخادم بالرمز والنوع text بلا أي استدعاء مباشر", proxyCalls.length === 1 && proxyCalls[0].token === TOK && proxyCalls[0].kind === "text" && direct.length === 0, { pc: proxyCalls.length, d: direct });
  t("نص: الردّ يعود كما لو من Gemini وتُسجَّل الحصة المتبقية", tx.left === 41, tx);
  t("لا مفتاح في الطلب إلى الخادم", !JSON.stringify(proxyCalls[0]).includes("AIza"));

  /* صورة */
  const im = await p.evaluate(async () => { const c = document.createElement("canvas"); c.width = 64; c.height = 64; const bl = await new Promise(r => c.toBlob(r, "image/png")); try { const r = await ImgGen.edit({ textOnly: true, prompt: "a jar", W: 64, H: 64, confirm: false, title: "t" }); return { ok: !!r }; } catch (e) { return { err: e.message }; } });
  t("صورة: نوع الطلب image عبر الخادم", proxyCalls.some(c => c.kind === "image") && direct.length === 0, { kinds: proxyCalls.map(c => c.kind), im });

  /* PBSpec.generate كاملاً عبر الوسيط (خطة ثم مخطط) */
  proxyCalls.length = 0;
  const gen = await p.evaluate(async () => { const r = await PBSpec.generate({ name: "عسل" }); const v = PBSpec.validate(r); return { ok: v.ok, plan: !!v.plan, h: v.sections[0].layers[0].text }; });
  t("PBSpec.generate: مرحلتان عبر الخادم وتنتج تصميماً صالحاً", gen.ok && gen.plan && gen.h === "مرحبا" && proxyCalls.length === 2 && direct.length === 0, { gen, n: proxyCalls.length });

  /* أخطاء الخادم تصل برسائل واضحة */
  mode = "nocredit"; const e1 = await p.evaluate(async () => { try { await ImgGen.text({ prompt: "x" }); return "no error"; } catch (e) { return e.message; } });
  t("انتهاء الرصيد: رسالة عربية واضحة من الخادم", /رصيدك/.test(e1), e1);
  mode = "notcfg"; const e2 = await p.evaluate(async () => { try { await ImgGen.text({ prompt: "x" }); return "no error"; } catch (e) { return e.message; } });
  t("الخدمة غير مُفعَّلة على الخادم: رسالة واضحة", /غير مُفعَّلة|مُفعَّلة/.test(e2), e2);
  mode = "ok";

  /* قائمة النماذج لا تخرج للإنترنت */
  const ml = await p.evaluate(async () => { const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": "x" } }); return r.json(); });
  t("فحص النماذج يُجاب محلياً بلا اتصال", ml.models && ml.models.length >= 2 && direct.length === 0, ml);

  /* واجهة الإعدادات + إلغاء الرمز */
  const ui = await p.evaluate(() => { const h = AiProxy.html(); return { has: /ig-tok/.test(h), on: /مُفعَّل/.test(h) }; });
  t("بطاقة الإعدادات تعرض الحقل والحالة", ui.has && ui.on, ui);
  await p.evaluate(() => AiProxy.set(""));
  const off = await p.evaluate(() => ({ on: AiProxy.on(), key: localStorage.getItem("alyssum_gp_gkey") }));
  t("إلغاء الرمز يرجع للوضع القديم ويمسح العلامة", !off.on && !off.key, off);
  t("بلا أخطاء JS", errs.length === 0, errs);
  console.log(bad ? "فشل " + bad + " / " + (ok + bad) : "كل الفحوص نجحت (" + ok + ")"); await b.close(); process.exit(bad ? 1 : 0);
})();
