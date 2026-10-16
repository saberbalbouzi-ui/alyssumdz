/* اختبار مولّد الفيديو بالذكاء (ImgGen.video + PBVGen) بمحاكاة خدمة الفيديو — بلا مفتاح ولا شبكة:
     NODE_PATH=/opt/node-tools/node_modules node scripts/test-vgen.js */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
let total = 0, fails = 0; const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } else console.log("✓", n); };
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.route("https://t.test/**", r => r.fulfill({ contentType: "text/html", body: "<!doctype html><html><body><div id=host></div></body></html>" }));
  await p.goto("https://t.test/");
  await p.evaluate(() => {
    window.real0 = window.fetch.bind(window); window.__reqs = []; window.__confirm = true; window.confirm = () => window.__confirm; window.__added = [];
    window.toast = () => { };
    window.PBApp = { localize: s => s, uploadVideo: async f => { window.__up = [f.name, f.type, f.size]; return "assets/img/pages/pv-test.mp4"; }, addVideoFile: p => window.__added.push(p) };
    window.PBCollage = { poolOf: () => ["x1.png", "x2.png", "x3.png", "x4.png"] };
    const png = () => fetch("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==").then(r => r.blob());
    window.__png = () => real0("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==").then(r => r.blob()); let polls = 0; const real = window.fetch.bind(window);
    window.fetch = async (url, o) => {
      const u = String(url); window.__reqs.push([u, o && o.method || "GET", o && o.body ? JSON.parse(o.body) : null, o && o.headers && o.headers.Authorization]);
      if (u.startsWith("data:")) return real(u);
      if (/\.png$/.test(u)) return real("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
      if (/queue\.fal\.run\/[^?]+\/requests\/r1\/status/.test(u)) { polls++; return new Response(JSON.stringify({ status: polls < 2 ? "IN_QUEUE" : "COMPLETED", queue_position: 1 }), { status: 200 }); }
      if (/queue\.fal\.run\/[^?]+\/requests\/r1$/.test(u)) return new Response(JSON.stringify({ video: { url: "https://cdn.test/v.mp4" } }), { status: 200 });
      if (/queue\.fal\.run/.test(u)) return new Response(JSON.stringify({ request_id: "r1" }), { status: 200 });
      if (u === "https://cdn.test/v.mp4") return new Response(new Blob([new Uint8Array(2048)], { type: "video/mp4" }), { status: 200 });
      return new Response("", { status: 404 });
    };
  });
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "../assets/js/img-gen.js"), "utf8") });
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "pagebuilder-vgen.js"), "utf8") });
  const T = fn => p.evaluate(fn);
  /* ── دوال نقية ── */
  ok("القوالب: 12 قالباً بمعرّفات فريدة", await T(() => PBVGen._t.TPL.length === 12 && new Set(PBVGen._t.TPL.map(x => x[0])).size === 12));
  ok("التعليمات: بلا قالب ولا نص = فارغة", await T(() => PBVGen._t.buildPrompt("", "  ") === ""));
  ok("التعليمات: قالب + نص + حراسة المنتج", await T(() => { const t = PBVGen._t.buildPrompt("orbit", "مع بتلات"); return /orbits/.test(t) && /مع بتلات/.test(t) && /Do not add text/.test(t) && /same shape/.test(t); }));
  ok("التعليمات: نص فقط يعمل", await T(() => /Create a short product video/.test(PBVGen._t.buildPrompt("", "camera zoom"))));
  ok("مشهد اليد: يمنع الوجه ويفرض الكم الطويل", await T(() => { const h = PBVGen._t.TPL.find(x => x[0] === "hand")[2]; return /no face/.test(h) && /long sleeve/.test(h); }));
  /* ── جاهزية الخدمة ── */
  ok("بلا مفتاح: videoReady.nokey", await T(() => { localStorage.removeItem("alyssum_fal_key"); const r = ImgGen.videoReady(); return !r.ok && r.nokey; }));
  ok("بلا مفتاح: video يرمي NOKEY", await T(async () => { try { await ImgGen.video({ images: [await __png()], prompt: "x" }); return false; } catch (e) { return e.code === "NOKEY"; } }));
  ok("معطّل من الإعدادات: OFF", await T(async () => { localStorage.setItem("alyssum_fal_key", "k"); localStorage.setItem("alyssum_ai_vid", "0"); try { await ImgGen.video({ images: [await __png()], prompt: "x" }); return false; } catch (e) { localStorage.removeItem("alyssum_ai_vid"); return e.code === "OFF"; } }));
  ok("بلا وصف: يرفض", await T(async () => { try { await ImgGen.video({ images: [await __png()], prompt: " " }); return false; } catch (e) { return /وصف/.test(e.message); } }));
  ok("بلا صورة: يرفض", await T(async () => { try { await ImgGen.video({ images: [], prompt: "x" }); return false; } catch (e) { return /صورة/.test(e.message); } }));
  ok("حدّ الإنفاق: يرفض قبل أي طلب", await T(async () => { localStorage.setItem("alyssum_ig_budget", "0.1"); localStorage.setItem("alyssum_ig_spent", "0"); __reqs.length = 0; try { await ImgGen.video({ images: [await __png()], prompt: "x" }); return false; } catch (e) { return /حدّ الإنفاق/.test(e.message) && __reqs.length === 0; } }));
  ok("رفض التأكيد: يعيد null بلا طلب", await T(async () => { localStorage.setItem("alyssum_ig_budget", "5"); __confirm = false; __reqs.length = 0; const r = await ImgGen.video({ images: [await __png()], prompt: "x" }); __confirm = true; return r === null && __reqs.length === 0; }));
  /* ── تدفق كامل (إرسال ← طابور ← اكتمال ← تنزيل) ── */
  const flow = await T(async () => {
    localStorage.setItem("alyssum_ig_spent", "0"); localStorage.setItem("alyssum_ig_count", "0"); __reqs.length = 0; const st = [];
    const r = await ImgGen.video({ images: [await __png(), await __png(), await __png(), await __png(), await __png()], prompt: "test prompt", ratio: "1:1", dur: 7, pollMs: 0, onStatus: m => st.push(m) });
    const sub = __reqs.find(x => x[1] === "POST");
    return { size: r.blob.size, cost: r.cost, spent: localStorage.getItem("alyssum_ig_spent"), n: localStorage.getItem("alyssum_ig_count"), body: sub && sub[2], auth: sub && sub[3], url: sub && sub[0], st };
  });
  ok("التدفق: ينتهي بفيديو ويُحتسب مرة واحدة", flow.size === 2048 && flow.spent === "0.5" && flow.n === "1", flow);
  ok("التدفق: المفتاح في الترويسة لا في الرابط", flow.auth === "Key k" && !/k$/.test(flow.url.replace("queue.fal.run", "")), flow.auth);
  ok("التدفق: الجسم (نسبة، مدة نص، صورة أولى، 4 صور بحد أقصى)", flow.body.aspect_ratio === "1:1" && flow.body.duration === "7" && /^data:image\/jpeg/.test(flow.body.image_url) && flow.body.image_urls.length === 4 && flow.body.prompt === "test prompt", Object.keys(flow.body));
  ok("التدفق: رسائل الحالة", flow.st.some(x => /الطابور/.test(x)) && flow.st.some(x => /التوليد/.test(x)), flow.st);
  ok("فشل الخدمة: لا يُحتسب إنفاق", await T(async () => { const f0 = window.fetch; localStorage.setItem("alyssum_ig_spent", "0"); window.fetch = async (u, o) => /queue\.fal\.run/.test(String(u)) && o && o.method === "POST" ? new Response(JSON.stringify({ detail: "bad key" }), { status: 401 }) : f0(u, o); try { await ImgGen.video({ images: [await __png()], prompt: "x", pollMs: 0 }); return false; } catch (e) { return /401/.test(e.message) && /تحقق من المفتاح/.test(e.message) && localStorage.getItem("alyssum_ig_spent") === "0"; } finally { window.fetch = f0; } }));
  /* ── اللوحة ── */
  const ui = await T(async () => {
    const host = document.getElementById("host"); localStorage.setItem("alyssum_ig_spent", "0"); const inf = { node: { id: "n1" }, set: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" } };
    host.innerHTML = PBVGen.panel(); await PBVGen.mount(host, inf);
    const q = s => host.querySelector(s), out = {};
    out.tpls = host.querySelectorAll('[data-vg="tpl"]').length; out.pool = host.querySelectorAll('[data-vg="pick"]').length;
    q('[data-vg="go"]').click(); await new Promise(r => setTimeout(r, 30)); out.msgEmpty = q("#pbvg-msg").textContent;
    q('[data-vg="tpl"][data-v="orbit"]').click(); out.on = q('[data-vg="tpl"][data-v="orbit"]').classList.contains("pz-go");
    for (const i of [0, 1, 2, 3]) q('[data-vg="pick"][data-i="' + i + '"]').click(); out.n = q("#pbvg-n").textContent;
    const sel = q("#pbvg-r"); sel.value = "16:9"; sel.dispatchEvent(new Event("change", { bubbles: true }));
    __reqs.length = 0; window.confirm = () => true; ImgGen._t && 0;
    PBVGen.state.busy = false; q('[data-vg="go"]').click();
    for (let i = 0; i < 80 && !q("video"); i++) await new Promise(r => setTimeout(r, 250));
    out.video = !!q("video"); out.sub = (__reqs.find(x => x[1] === "POST") || [])[2]; out.msg = q("#pbvg-msg").textContent;
    if (q('[data-vg="add"]')) { q('[data-vg="add"]').click(); await new Promise(r => setTimeout(r, 100)); }
    out.added = __added.slice(); out.up = window.__up;
    return out;
  });
  ok("اللوحة: 12 قالباً وصور المجمع", ui.tpls === 12 && ui.pool === 4, ui);
  ok("اللوحة: بلا قالب ولا وصف تطلب اختياراً", /اختر قالباً/.test(ui.msgEmpty), ui.msgEmpty);
  ok("اللوحة: تحديد قالب والحد الأقصى 4 صور", ui.on && ui.n === "4", ui);
  ok("اللوحة: تنتج فيديو بالنسبة المختارة و4 صور", ui.video && ui.sub && ui.sub.aspect_ratio === "16:9" && ui.sub.image_urls.length === 4 && /orbits/.test(ui.sub.prompt), ui.sub && Object.keys(ui.sub));
  ok("اللوحة: «أضفه للصفحة» يرفع الفيديو ويضيفه", ui.added.length === 1 && ui.added[0] === "assets/img/pages/pv-test.mp4" && ui.up && ui.up[1] === "video/mp4", ui);
  ok("بلا أخطاء JS", errs.length === 0, errs);
  console.log(fails ? "فشل " + fails + " من " + total : "نجح " + total + " من " + total);
  await b.close(); process.exit(fails ? 1 : 0);
})();
