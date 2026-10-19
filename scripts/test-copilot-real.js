/* اختبار المرحلة 2: PBCopilotReal + AiProxy.call مع محاكٍ لدالة الخادم `ai` (Playwright يعترض POST /functions/v1/ai).
   ما يُختبر فعلاً هنا: المحوّلات الحقيقية في المتصفح (طلبات/معرّفات/مهلة/إلغاء/ترجمة الأخطاء)، المحرر الحقيقي، PBBgRemove الحقيقي، التراجع والاستئناف، scope_violation.
   ما لا يُختبر هنا: Gemini الحقيقي (لا مفتاح)، ولا قاعدة بيانات الحدود (يغطيها test-copilot-limits.sh على Postgres حقيقي بطلبات متزامنة)، ولا كود الدالة الفعلي (test-copilot-fn.mjs).
   المحاكي يكرّر خوارزمية saas_ai_charge2/refund2 في JS لإظهار سلوك العميل أمام الرفض؛ هو ليس برهاناً على متانة قاعدة البيانات.
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-copilot-real.js */
const fs = require("fs"), path = require("path"); const { chromium } = require("playwright");
const ROOT = path.join(__dirname, ".."), PAGE = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/pages/memory-focus.json"), "utf8")), HELPERS = require("./lib/copilot-test-helpers.js");
let n = 0; const fails = []; const ok = (c, m, x) => { if (!c) { console.log("✗ " + m + (x !== undefined ? " " + JSON.stringify(x).slice(0, 500) : "")); fails.push(m); } else { n++; console.log("✓ " + m); } };
const TOKEN = "a".repeat(40), sleep = ms => new Promise(r => setTimeout(r, ms));

/* ───── محاكي الخادم (يعكس خوارزمية SQL: الرفض لا يغيّر شيئاً، نفس req لا يُخصم مرتين، الاسترداد مرة واحدة، العدّادات لا تنقص) ───── */
class Srv {
  constructor() { this.reset(); }
  reset(pol) { this.pol = Object.assign({ llm: 6, img: 8, tries: 2, cap: 200, cText: 1, cImg: 8 }, pol); this.runs = {}; this.led = {}; this.credits = { text: 1000, image: 1000 }; this.req = []; this.mode = {}; this.vars = {}; this.seq = { img: {} }; }
  spent() { return Object.values(this.led).filter(l => l.state === "charged").reduce((s, l) => s + l.cost, 0); }
  charges(kind) { return Object.values(this.led).filter(l => l.state === "charged" && (!kind || l.kind === kind)).length; }
  refunds(kind) { return Object.values(this.led).filter(l => l.state === "refunded" && (!kind || l.kind === kind)).length; }
  charge(b) {
    const r = this.runs[b.run] || { llm: 0, img: 0, tries: {} }, led = this.led[b.req], P = this.pol; if (b.token !== TOKEN) return { reason: "unknown_token" };
    if (!/^[\w.-]{6,64}$/.test(b.run || "") || !/^[\w.-]{6,80}$/.test(b.req || "")) return { reason: "bad_request" };
    if (led && led.state === "charged") return { reason: "duplicate_request" };
    if (b.kind === "text" && r.llm >= P.llm) return { reason: "run_llm_limit" };
    if (b.kind === "image") { if (r.img >= P.img) return { reason: "run_img_limit" }; if ((r.tries[b.key || "_"] || 0) >= P.tries) return { reason: "run_tries_limit" }; }
    const c = b.kind === "text" ? P.cText : P.cImg; if (this.spent() + c > P.cap) return { reason: "daily_cap" }; if (this.credits[b.kind] <= 0) return { reason: "no_credits" };
    this.credits[b.kind]--; if (b.kind === "text") r.llm++; else { r.img++; r.tries[b.key || "_"] = (r.tries[b.key || "_"] || 0) + 1; } this.runs[b.run] = r; this.led[b.req] = { kind: b.kind, cost: c, state: "charged", run: b.run, key: b.key }; return { ok: true };
  }
  refund(req) { const l = this.led[req]; if (!l || l.state !== "charged") return; l.state = "refunded"; this.credits[l.kind]++; }
}
const ST = { duplicate_request: 409, run_llm_limit: 429, run_img_limit: 429, run_tries_limit: 429, daily_cap: 429, no_credits: 402, unknown_token: 401, bad_request: 400 };
const gtext = t => ({ candidates: [{ content: { parts: [{ text: t }] } }] }), gimg = b64 => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: b64 } }] } }] });

(async () => {
  const srv = new Srv(), b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1500, height: 950 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  await p.addScriptTag({ path: path.join(ROOT, "scripts/pagebuilder-copilot.js") }); await p.addScriptTag({ path: path.join(ROOT, "scripts/pagebuilder-copilot-real.js") });
  await p.evaluate(pg => { window.__PAGE = pg; }, PAGE); await p.evaluate(HELPERS);
  /* صور اختبار: PNG عادية، وPNG بخلفية بيضاء مسطّحة وقرص أحمر (لنزع الخلفية الحقيقي) */
  const IMG = await p.evaluate(async () => { const toB64 = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(String(f.result).split(",")[1]); f.readAsDataURL(b); });
    const mk = (draw) => new Promise(r => { const c = document.createElement("canvas"); c.width = 320; c.height = 240; draw(c.getContext("2d")); c.toBlob(r, "image/png"); });
    const plain = await mk(x => { x.fillStyle = "#c8a24b"; x.fillRect(0, 0, 320, 240); }), disc = await mk(x => { x.fillStyle = "#ffffff"; x.fillRect(0, 0, 320, 240); x.fillStyle = "#c62828"; x.beginPath(); x.arc(160, 120, 80, 0, 7); x.fill(); x.fillStyle = "#7f1d1d"; x.beginPath(); x.arc(135, 100, 18, 0, 7); x.fill(); });
    return { plain: await toB64(plain), disc: await toB64(disc) }; });
  const DESIGN = await p.evaluate(() => __T.designOps());
  const urlRe = /\/functions\/v1\/ai$/;
  await p.route(urlRe, async route => {
    const rq = route.request(); let body; try { body = JSON.parse(rq.postData() || "{}"); } catch (e) { return route.fulfill({ status: 400, body: "{}" }); }
    srv.req.push({ kind: body.kind, run: body.run, req: body.req, key: body.key, validate: body.validate, raw: rq.postData() });
    const done = (status, o) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(o) }).catch(() => { srv.refund(body.req); });          // العميل انقطع ← الخادم الحقيقي يستردّ
    const ch = srv.charge(body); if (!ch.ok) return done(ST[ch.reason] || 402, { error: ch.reason, message: "مرفوض: " + ch.reason });
    const m = srv.mode, k = body.kind, first = (srv.seq.img[body.key] = (srv.seq.img[body.key] || 0) + 1) === 1;
    if (m.hangText && k === "text") { await sleep(m.hangText); srv.refund(body.req); return done(504, { error: "timeout" }); }
    if (m.hangImg && k === "image" && (m.hangImg === "all" || first)) { await sleep(3200); srv.refund(body.req); return done(504, { error: "timeout" }); }
    if (m.failText && k === "text") { srv.refund(body.req); return done(502, { error: "upstream_failed", message: "تعذّر الذكاء الاصطناعي مؤقتاً — لم يُخصم من رصيدك" }); }
    if (m.failImg && k === "image") { srv.refund(body.req); return done(502, { error: "upstream_failed", message: "تعذّر" }); }
    if (m.invalidText && k === "text") { srv.refund(body.req); return done(422, { error: "invalid_output", why: "not_json", message: "مخرجات النموذج غير صالحة — لم يُخصم من رصيدك" }); }
    const L = srv.led[body.req], out = { ok: true, left: srv.credits[k], spent: srv.spent(), cap: srv.pol.cap, model: "mock" };
    if (k === "image") { const b64 = m.disc ? IMG.disc : IMG.plain; return done(200, Object.assign(out, { data: gimg(b64) })); }
    let obj; if (body.validate === "copilot_plan") obj = { palette: { bg: "#F8F4E9" }, flow: ["offer"] }; else { obj = m.envelope ? JSON.parse(JSON.stringify(m.envelope).replace(/\$\{(\w+)\}/g, (_, v) => srv.vars[v] || "zzzzzz")) : JSON.parse(JSON.stringify(DESIGN)); }
    return done(200, Object.assign(out, { data: gtext(JSON.stringify(obj)), parsed: m.parsedNull ? null : obj }));
  });
  await p.evaluate(t => { AiProxy.set(t); }, TOKEN);
  const real = (extra) => `(() => { window.__R = window.__R || { uploads: [], blobs: {} }; return PBCopilotReal.create(Object.assign({ timeoutMs: 2000, store: PBCopilot.stores.mem(), upload: async (b, name) => { const pth = "assets/img/pages/" + name + ".webp"; __R.uploads.push(pth); __R.blobs[pth] = b; return pth; } }, ${extra || "{}"})); })()`;
  const open = () => p.evaluate(async () => { await __T.open(); return PBApp.pageJson(); });
  const S = () => ({ hist: "PBApp.E.hist.length" });
  const RUN = (adExtra, runExtra) => p.evaluate(async ([ae, re]) => { const E = PBApp.E, before = PBApp.pageJson(), h0 = E.hist.length, ad = eval(ae); let r, thrown = null;
      try { r = await PBCopilot.run(Object.assign({ goal: "قسم عرض لعسل التركيز", facts: __T.FACTS, adapters: ad }, eval("(" + re + ")"))); } catch (e) { thrown = { code: e.code, interrupt: !!e.interrupt, cancelled: !!e.cancelled, msg: e.message }; }
      return { r, thrown, same: PBApp.pageJson() === before, h: E.hist.length - h0, ids: ad.store.list ? ad.store.list() : [] }; }, [real(adExtra), runExtra || "{}"]);

  /* ───── 1) نجاح كامل بالمحوّلات الحقيقية ───── */
  srv.reset(); await open(); const A = await p.evaluate(async (re) => { const E = PBApp.E, before = PBApp.pageJson(), h0 = E.hist.length, ad = eval(re); window.__R.uploads.length = 0; const r = await PBCopilot.run({ goal: "قسم عرض لعسل التركيز", facts: __T.FACTS, adapters: ad });
      const off = E.page.sections[1], texts = off.free.map(w => __T.textOf(w)).filter(Boolean), types = off.free.map(w => w.type); const out = { r, h: E.hist.length - h0, texts, types, nsec: E.page.sections.length, uploads: __R.uploads.slice(), imgs: off.free.filter(w => w.type === "image").map(w => w.set.src) };
      const fd = document.getElementById("pbx-frame").contentDocument; let sel = 0; for (const w of off.free) { E.sel = w.id; PBApp.renderInspectorNow(); await new Promise(r => setTimeout(r, 12)); if (fd.querySelector('[data-pb="' + w.id + '"]') && document.getElementById("pbx-insp").querySelectorAll("input,textarea,select,button").length > 3) sel++; } out.sel = sel; out.nFree = off.free.length;
      E.sel = null; PBApp.undo(); await new Promise(r => setTimeout(r, 200)); out.undoSame = PBApp.pageJson() === before; out.ls = Object.keys(localStorage).map(k => [k, String(localStorage.getItem(k)).slice(0, 12000)]); return out; }, real());
  ok(A.r.ok && A.r.status === "done", "نجاح: التشغيل بالمحوّلات الحقيقية ينتهي done", A.r);
  ok(srv.charges("text") === 2 && srv.charges("image") === 2 && srv.refunds() === 0, "الخادم خصم مكالمتي نموذج وصورتين فقط بلا استرداد", { t: srv.charges("text"), i: srv.charges("image"), r: srv.refunds() });
  ok(new Set(srv.req.map(x => x.req)).size === srv.req.length && srv.req.every(x => x.run === A.r.runId), "كل طلب بمعرّف فريد ومعرّف التشغيل نفسه", srv.req.map(x => x.req));
  ok(A.h === 1 && A.undoSame, "مدخل تاريخ واحد وتراجع واحد يعيد الصفحة JSON مطابقاً بايتاً ببايت");
  ok(A.nsec === 3 && A.nFree === 8 && A.sel === 8, "قسم واحد متواصل بثماني طبقات مستقلة كلها قابلة للتحديد والتحرير (" + A.sel + "/8)");
  ok(A.texts.some(t => /^السعر: 1800 دج$/.test(t)) && !A.types.some(t => /pprice|poffers|html/.test(t)), "السعر نص عادي من بيانات المستخدم بلا ربط ديناميكي", A.texts);
  const allBodies = srv.req.map(x => x.raw).join("\n"), ls = JSON.stringify(A.ls);
  ok(!/AIza[\w-]{20,}|GEMINI|GK-SECRET/i.test(allBodies + ls), "لا مفتاح Gemini في الطلبات ولا في localStorage");
  ok(srv.req.every(x => JSON.parse(x.raw).token === TOKEN) && !/"token"/.test(ls.replace(/alyssum_ai_token/g, "")) , "الرمز الوحيد المُرسَل هو رمز الموقع؛ وحالة التشغيل المخزنة لا تحتويه");
  ok(srv.req.filter(x => x.kind === "text").every(x => ["copilot_plan", "copilot_envelope"].includes(x.validate)), "كل طلب نص يعلن نوع التحقق الخادمي (بديل responseSchema)");

  /* ───── 2) فشل الخادم / مهلة / إلغاء ← الصفحة كما هي والاسترداد مرة واحدة ───── */
  srv.reset(); srv.mode = { failText: 1 }; await open(); let X = await RUN(real(), "{}");
  ok(X.r && !X.r.ok && X.r.status === "failed" && X.same && X.h === 0, "فشل الخادم 502: لا تغيير في الصفحة ولا في التاريخ", X.r);
  ok(srv.charges() === 0 && srv.refunds("text") === 1, "المكالمة الفاشلة استُردّت مرة واحدة (الصافي صفر)", { c: srv.charges(), r: srv.refunds() });
  srv.reset(); srv.mode = { hangText: 3300 }; await open(); const t0 = Date.now(); X = await RUN(real(), "{}");
  ok(X.r && X.r.status === "failed" && X.r.error.code === "timeout" && X.same && X.h === 0 && Date.now() - t0 < 3300, "المهلة: العميل يقطع عند ~2ث (error.code=timeout) والصفحة كما هي", { err: X.r && X.r.error, ms: Date.now() - t0 });
  await sleep(1500); ok(srv.refunds("text") === 1 && srv.charges() === 0, "ولا خصم بعد المهلة (الخادم استردّ لأن العميل قطع)", { r: srv.refunds(), c: srv.charges() });
  srv.reset(); srv.mode = { hangText: 3300 }; await open(); X = await p.evaluate(async (re) => { const E = PBApp.E, before = PBApp.pageJson(), ctl = new AbortController(); setTimeout(() => ctl.abort(), 400); const ad2 = PBCopilotReal.create({ timeoutMs: 20000, signal: ctl.signal, store: PBCopilot.stores.mem(), upload: async () => "assets/x.webp" }); let thrown = null; try { await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: ad2 }); } catch (e) { thrown = { cancelled: !!e.cancelled, code: e.code }; } return { thrown, same: PBApp.pageJson() === before, h: E.hist.length }; }, real());
  ok(X.thrown && X.thrown.cancelled && X.same, "الإلغاء من المستخدم: يُرمى cancelled والصفحة كما هي", X);
  await sleep(3500); ok(srv.charges() === 0 && srv.refunds("text") === 1, "الإلغاء استُردّ مرة واحدة ولا خصم", { c: srv.charges(), r: srv.refunds() });

  /* ───── 3) حدود الخادم أمام العميل: تزامن، إعادة محاولة، رفض ← بلا أثر ───── */
  srv.reset({ img: 8 }); await open(); const conc = await p.evaluate(async (re) => { const ad = eval(re), jobs = Array.from({ length: 14 }, (_, i) => ad.img.generate({ prompt: "جرة عسل ذهبية على طاولة", W: 400, H: 300, runId: "runCONC01", key: "k" + i, attempt: 1 }).then(() => "ok", e => e.code)); const r = await Promise.all(jobs); return { ok: r.filter(x => x === "ok").length, lim: r.filter(x => x === "run_img_limit").length, other: r.filter(x => x !== "ok" && x !== "run_img_limit") }; }, real());
  ok(conc.ok === 8 && conc.lim === 6 && !conc.other.length, "14 طلب صورة متزامنة بسقف 8: 8 تنجح و6 ترفض run_img_limit والعميل يترجم الرمز", conc);
  ok(srv.charges("image") === 8, "ما خُصم 8 فقط");
  srv.reset({ cap: 3 }); await open(); X = await RUN(real(), "{}");
  ok(X.r && X.r.status === "done_with_errors" || X.r && !X.r.ok, "سقف يومي صغير (3): لا يتجاوزه الخادم (الإنفاق ≤ 3)", { st: X.r && X.r.status, spent: srv.spent() }); ok(srv.spent() <= 3, "الإنفاق المسجَّل ≤ السقف اليومي", srv.spent());
  srv.reset({ cap: 0 }); await open(); X = await RUN(real(), "{}");
  ok(X.r && X.r.status === "failed" && X.r.error.code === "daily_cap" && X.same && X.h === 0 && srv.charges() === 0, "السقف اليومي مستنفد: يفشل التشغيل فوراً بلا أثر ولا خصم", X.r);
  srv.reset(); srv.mode = { failImg: 1 }; await open(); X = await RUN(real(), "{}");
  ok(X.r.status === "done_with_errors" && srv.charges("image") === 0 && srv.refunds("image") === 4, "فشل الصور الدائم: محاولتان لكل صورة (4 طلبات) كلها مستردّة، والصافي صفر", { st: X.r.status, rf: srv.refunds("image"), ch: srv.charges("image") });
  srv.reset({ tries: 1 }); srv.mode = { failImg: 1 }; await open(); X = await RUN(real(), "{}");
  ok(Object.values(srv.led).filter(l => l.kind === "image").length === 2 && srv.charges("image") === 0, "سقف محاولات الخادم = 1: محاولة مقبولة واحدة لكل صورة (والثانية رُفضت بلا تكلفة ولم تُعد المحاولة)", { accepted: Object.values(srv.led).filter(l => l.kind === "image").length, asked: srv.req.filter(x => x.kind === "image").length });
  srv.reset({ tries: 1 }); srv.mode = {}; await open(); X = await RUN(real(), "{}");
  ok(X.r.status === "done" && srv.charges("image") === 2, "سقف المحاولات 1 لا يمنع المحاولة الأولى الناجحة");
  srv.reset({ img: 1 }); await open(); X = await RUN(real(), "{}");
  ok(X.r.status === "done_with_errors" && X.r.errors.some(e => e.code === "guard_denied") && srv.charges("image") === 1 && srv.req.filter(x => x.kind === "image").length === 2, "سقف صور التشغيل = 1: الثانية guard_denied بلا إعادة محاولة على رفض الحد", { st: X.r.status, e: X.r.errors, n: srv.req.filter(x => x.kind === "image").length });
  srv.reset({ llm: 1 }); await open(); X = await RUN(real(), "{}");
  ok(X.r.status === "failed" && X.same && X.h === 0 && srv.charges("text") === 1, "سقف مكالمات النموذج = 1: الثانية (الأوامر) تُرفض فيفشل التشغيل بلا أثر", { st: X.r.status, e: X.r.error });
  srv.reset({ llm: 0 }); await open(); X = await RUN(real(), "{}"); ok(X.r.status === "failed" && X.r.error.code === "run_llm_limit" && srv.charges() === 0, "سقف صفر: رفض فوري بلا خصم", X.r.error);
  /* رمز مجهول */
  srv.reset(); await open(); await p.evaluate(() => { localStorage.setItem("alyssum_ai_token", "e".repeat(40)); }); X = await RUN(real(), "{}"); await p.evaluate(t => { AiProxy.set(t); }, TOKEN);
  ok(X.r.status === "failed" && X.r.error.code === "unknown_token" && X.same, "رمز موقع غير صالح: يفشل بلا أثر", X.r.error);

  /* ───── 4) مخرجات غير صالحة لا تغيّر الصفحة ───── */
  srv.reset(); srv.mode = { invalidText: 1 }; await open(); X = await RUN(real(), "{}"); ok(!X.r.ok && X.same && X.h === 0 && srv.charges() === 0, "422 invalid_output من الخادم: لا تغيير والتكلفة مستردّة", X.r);
  srv.reset(); srv.mode = { parsedNull: 1 }; await open(); X = await RUN(real(), "{}"); ok(!X.r.ok && X.same && X.h === 0, "ردّ 200 بلا parsed: يُرفض بلا تغيير", X.r);
  const mut = fn => { const o = JSON.parse(JSON.stringify(DESIGN)); fn(o.ops); return o; };
  const cases = { "سعر مخترع 999 دج": mut(o => { o[3 + 1].args.layer.text = "السعر: 999 دج"; }), "خصم مخترع 50%": mut(o => { o[4 + 1].args.layer.text = "خصم 50% اليوم"; }), "أمر نشر": mut(o => { o.push({ id: "z1", op: "page.publish", args: {} }); }), "HTML في نص": mut(o => { o[3 + 1].args.layer.text = "<img src=x onerror=alert(1)>"; }), "رابط javascript": mut(o => { o[8].args.layer.link = "javascript:alert(1)"; }),
    "نوع html": mut(o => { o[3 + 1].args.layer.type = "html"; }), "رمز معلومة ناقصة": mut(o => { o[3 + 1].args.layer.text = "{{offer9.price}}"; }), "حذف نموذج الطلب": mut(o => { o.push({ id: "z2", op: "layer.delete", args: { ref: "${ORDER}" } }); }) };
  for (const [name, env] of Object.entries(cases)) { srv.reset(); srv.mode = { envelope: env }; await open(); await p.evaluate(() => { }); srv.vars.ORDER = await p.evaluate(() => __T.widgets(PBApp.E.page).find(w => w.type === "orderorig").id); X = await RUN(real(), "{}");
    const protectedCase = name === "حذف نموذج الطلب"; ok(X.same && X.h === 0 && !X.r.ok, "مخرجات عدائية (" + name + "): الصفحة كما هي والتاريخ لم يتغير", { st: X.r.status, err: X.r.errors && X.r.errors.map(e => e.code) });
    if (protectedCase) ok(X.r.errors.some(e => e.code === "protected_layer"), "حذف نموذج الطلب سُجِّل protected_layer", X.r.errors); }

  /* ───── 5) التراجع والاستئناف بالمحوّلات الحقيقية ───── */
  srv.reset(); await open(); const BASE = await p.evaluate(async (re) => { const ad = eval(re); await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: ad }); return __T.sig(PBApp.E.page); }, real());
  const baseImgCharges = srv.charges("image");
  for (const k of [2, 6, 11, 15]) {
    srv.reset(); await open(); const R = await p.evaluate(async ([re, k]) => { const E = PBApp.E, before = PBApp.pageJson(), h0 = E.hist.length; let c = 0; const ad = eval(re); ad.hooks = { beforeOp: async () => { if (++c === k) throw new PBCopilot.Interrupt("cut"); } };
        let first, err; try { first = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: ad }); } catch (e) { err = e; } const idle = PBApp.pageJson() === before, id = ad.store.list()[0]; ad.hooks = {}; const r2 = await PBCopilot.resume(id, { adapters: ad });
        const keyed = __T.widgets(E.page).filter(w => w.set.aiKey).map(w => w.set.aiKey); const out = { interrupted: !!(err && err.interrupt), idle, status: r2.status, sig: __T.sig(E.page), dup: keyed.length - new Set(keyed).size, h: E.hist.length - h0 }; PBApp.undo(); await new Promise(r => setTimeout(r, 150)); out.undo = PBApp.pageJson() === before; return out; }, [real(), k]);
    ok(R.interrupted && R.idle && R.status === "done" && R.sig === BASE && R.dup === 0 && R.h === 1 && R.undo, "انقطاع عند الأمر " + k + " ثم استئناف بالمحوّلات الحقيقية: نتيجة مطابقة بلا تكرار، تاريخ +1، وتراجع واحد يعيد الأصل", R);
    ok(srv.charges("image") === baseImgCharges && srv.charges("text") === 2 && srv.req.filter(x => x.kind === "image").length === baseImgCharges, "  ولا صورة/نموذج مكرر على الخادم (صور " + srv.charges("image") + "، نموذج " + srv.charges("text") + ")");
  }
  /* إلغاء أثناء توليد صورة ثم استئناف */
  srv.reset(); srv.mode = { hangImg: "first" }; await open(); const CR = await p.evaluate(async () => { const E = PBApp.E, before = PBApp.pageJson(), ctl = new AbortController(), ad = PBCopilotReal.create({ timeoutMs: 20000, signal: ctl.signal, store: PBCopilot.stores.mem(), upload: async (b, n) => "assets/img/pages/" + n + ".webp" });
    setTimeout(() => ctl.abort(), 700); let err; try { await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: ad }); } catch (e) { err = e; } const idle = PBApp.pageJson() === before, id = ad.store.list()[0];
    const ad2 = PBCopilotReal.create({ timeoutMs: 20000, store: ad.store, upload: async (b, n) => "assets/img/pages/" + n + ".webp" }); const r2 = await PBCopilot.resume(id, { adapters: ad2 }); const keyed = __T.widgets(E.page).filter(w => w.set.aiKey).map(w => w.set.aiKey);
    return { cancelled: !!(err && err.cancelled), idle, status: r2.status, sig: __T.sig(E.page), dup: keyed.length - new Set(keyed).size }; });
  ok(CR.cancelled && CR.idle && CR.status === "done" && CR.sig === BASE && CR.dup === 0, "إلغاء أثناء توليد صورة ثم استئناف: يكتمل بنفس النتيجة بلا تكرار", CR);
  await sleep(3500); ok(srv.charges("image") === 2 && srv.refunds("image") >= 1, "الصورة الملغاة استُردّت وأُعيد توليدها مرة واحدة (صافي صورتان)", { c: srv.charges("image"), r: srv.refunds("image") });
  const perKey = {}; srv.req.filter(x => x.kind === "image").forEach(x => { perKey[x.key] = (perKey[x.key] || 0) + 1; }); ok(Object.values(perKey).every(v => v <= 2), "محاولات كل صورة ≤ سقف الخادم (2)", perKey);

  /* ───── 6) نزع الخلفية الحقيقي (PBBgRemove كلاسيكي محلي) ───── */
  const RB = await p.evaluate(async (b64) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const blob = new Blob([u], { type: "image/png" });
    const out = await PBCopilotReal.removeBgLocal(blob), bm = await createImageBitmap(out), c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; const x = c.getContext("2d"); x.drawImage(bm, 0, 0); const a = (px, py) => x.getImageData(px, py, 1, 1).data[3];
    return { type: out.type, w: bm.width, corner: [a(2, 2), a(bm.width - 3, 2), a(2, bm.height - 3)], center: a(Math.round(bm.width / 2), Math.round(bm.height / 2)) }; }, IMG.disc);
  ok(RB.type === "image/png" && RB.corner.every(v => v < 20) && RB.center > 235, "removeBgLocal الحقيقي: الزوايا شفافة والمركز معتم", RB);
  srv.reset(); srv.mode = { disc: 1 }; await open(); const RD = await p.evaluate(async (re) => { const ad = eval(re); window.__R.uploads.length = 0; const r = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: ad }); const res = [];
      for (const pth of __R.uploads) { const bm = await createImageBitmap(__R.blobs[pth]), c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; const x = c.getContext("2d"); x.drawImage(bm, 0, 0); res.push({ corner: x.getImageData(2, 2, 1, 1).data[3], center: x.getImageData(Math.round(bm.width / 2), Math.round(bm.height / 2), 1, 1).data[3] }); }
      return { st: r.status, res }; }, real());
  ok(RD.st === "done" && RD.res.length === 2 && RD.res.every(x => x.corner < 20 && x.center > 235), "صورتان cutout عبر خط التشغيل الكامل: المرفوعة بنزع خلفية حقيقي (شفافة الزوايا)", RD);

  /* ───── 7) scope_violation ───── */
  srv.reset(); await open(); const SV = await p.evaluate(async (re) => { const E = PBApp.E, before = PBApp.pageJson(), h0 = E.hist.length, ad = eval(re); ad.hooks = { afterOp: async (op, work) => { if (op.op === "layer.add") { const w = work.sections[0].free[3]; w.set.op = 0.4; } } };
      const r = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: ad }); return { r, same: PBApp.pageJson() === before, h: E.hist.length - h0 }; }, real());
  ok(!SV.r.ok && SV.r.status === "rolled_back" && SV.r.error.code === "scope_violation" && SV.same && SV.h === 0, "scope_violation: تغيير عنصر لم تذكره الأوامر يُلغي الاعتماد كله والصفحة كما هي", SV.r);
  ok(SV.r.error.msg && /w:/.test(SV.r.error.msg), "ورسالة الخطأ تسمّي العنصر المتغيّر", SV.r.error);
  srv.reset(); await open(); const SV2 = await p.evaluate(async (re) => { const E = PBApp.E, before = PBApp.pageJson(), ad = eval(re); ad.hooks = { afterOp: async (op, work) => { if (op.op === "layer.add") work.sections[0].set.bg = "#000000"; } }; const r = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: ad }); return { r, same: PBApp.pageJson() === before }; }, real());
  ok(SV2.r.status === "rolled_back" && SV2.r.error.code === "scope_violation" && SV2.same, "تغيير خلفية قسم غير ملموس أيضاً scope_violation");

  /* ───── 8) تعديل تدريجي بالمحوّلات الحقيقية ───── */
  srv.reset(); await open(); const ED = await p.evaluate(async (re) => { const E = PBApp.E, ad = eval(re); await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: ad }); const ws = __T.widgets(E.page), title = ws.find(w => w.set.aiKey === "title"); window.__title = title.id; return { id: title.id }; }, real());
  srv.mode = { envelope: { v: 1, ops: [{ id: "e1", op: "layer.update", args: { ref: "${TITLE}", patch: { text: "عسل التركيز — جديد", color: "#8a1c1c" } } }] } }; srv.vars.TITLE = ED.id;
  const E2 = await p.evaluate(async (re) => { const E = PBApp.E, snap = () => Object.fromEntries(__T.widgets(E.page).map(w => [w.id, JSON.stringify(w)])), b = snap(), h0 = E.hist.length, ad = eval(re); const r = await PBCopilot.edit({ instruction: "غيّر العنوان فقط", facts: __T.FACTS, adapters: ad }); const a = snap(); return { st: r.status, changed: Object.keys(a).filter(k => a[k] !== b[k]), h: E.hist.length - h0 }; }, real());
  ok(E2.st === "done" && E2.changed.length === 1 && E2.changed[0] === ED.id && E2.h === 1, "تعديل تدريجي حقيقي: عنصر واحد فقط تغيّر ومدخل تاريخ واحد", E2);
  ok(!errs.length, "لا أخطاء JavaScript في الصفحة", errs.slice(0, 3));

  await b.close();
  console.log("\n" + n + " ✓" + (fails.length ? "  —  " + fails.length + " ✗: " + fails.join(" | ") : "")); process.exit(fails.length ? 1 : 0);
})();
