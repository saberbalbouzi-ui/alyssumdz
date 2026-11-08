/* اختبار مسار المنصة للفيديو (دالة ai-video: المزوّد يوفّر المفتاح والزبون يشتري الرصيد) بمحاكاة الخادم — بلا شبكة:
     NODE_PATH=/opt/node-tools/node_modules node scripts/test-vplat.js */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
let total = 0, fails = 0; const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } else console.log("✓", n); };
const TOKEN = "a".repeat(40);
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.route("https://t.test/**", r => r.fulfill({ contentType: "text/html", body: "<!doctype html><html><body></body></html>" }));
  await p.goto("https://t.test/");
  await p.evaluate(TOKEN => {
    localStorage.clear(); window.confirm = () => true; window.toast = () => { }; window.CONFIG = { SAAS_URL: "https://srv.test" };
    const real = window.fetch.bind(window); window.__png = () => real("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==").then(r => r.blob());
    window.__srv = []; window.__mode = "ok"; let polls = 0;
    window.fetch = async (url, o) => {
      const u = String(url); if (u.startsWith("data:")) return real(u);
      if (u === "https://srv.test/functions/v1/ai-video") {
        const b = JSON.parse(o.body); window.__srv.push(b);
        if (window.__mode === "nocredit") return new Response(JSON.stringify({ error: "no_credits", message: "انتهى رصيد الفيديو — اشترِ رصيداً إضافياً لمتابعة الاستعمال" }), { status: 402 });
        if (b.action === "dl") return new Response(new Blob([new Uint8Array(2048)], { type: "video/mp4" }), { status: 200 });
        if (b.action === "submit") return new Response(JSON.stringify({ request_id: "r1", status_url: "https://queue.fal.run/fal-ai/x/requests/r1/status", response_url: "https://queue.fal.run/fal-ai/x/requests/r1", left: 4 }), { status: 200 });
        if (/status$/.test(b.url)) { polls++; return new Response(JSON.stringify({ status: polls < 2 ? "IN_QUEUE" : "COMPLETED" }), { status: 200 }); }
        return new Response(JSON.stringify({ video: { url: "plat:https://generativelanguage.googleapis.com/v1beta/files/abc:download?alt=media" } }), { status: 200 });
      }
      if (/queue\.fal\.run/.test(u)) return new Response("direct-should-not-happen", { status: 500 });
      if (u === "https://cdn.test/v.mp4") return new Response(new Blob([new Uint8Array(2048)], { type: "video/mp4" }), { status: 200 });
      return new Response("", { status: 404 });
    };
  }, TOKEN);
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "../assets/js/ai-proxy.js"), "utf8") });
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "../assets/js/img-gen.js"), "utf8") });
  const T = fn => p.evaluate(fn);
  ok("بلا رمز ولا مفتاح: الفيديو غير جاهز ويظهر صندوق المفتاح", await T(() => { const r = ImgGen.videoReady(); return !r.ok && r.nokey && ImgGen.videoKeyBox().length > 50; }));
  await T(() => AiProxy.set("a".repeat(40)));
  ok("برمز الموقع: الفيديو جاهز بلا مفتاح محلي ولا صندوق", await T(() => { const r = ImgGen.videoReady(); return r.ok && !r.nokey && ImgGen.videoKeyBox() === ""; }));
  const r1 = await T(async () => { try { const v = await ImgGen.video({ images: [await __png()], prompt: "x", pollMs: 0, confirm: false }); return { size: v.blob.size, srv: __srv.map(x => [x.action, x.model || x.url, !!x.token, !!x.jwt]) }; } catch (e) { return { err: e.message }; } });
  ok("التوليد عبر المنصة ينجح ويعيد الفيديو", r1.size === 2048, r1);
  ok("الطلبات كلها إلى ai-video بالرمز (submit ثم get)", r1.srv && r1.srv[0][0] === "submit" && r1.srv.slice(1).every(x => (x[0] === "get" && x[1].startsWith("https://queue.fal.run/")) || x[0] === "dl") && r1.srv.every(x => x[2] && !x[3]), r1.srv);
  ok("لا مفتاح خدمة يخرج من المتصفح ولا اتصال مباشر", await T(() => !__srv.some(x => JSON.stringify(x).includes("Key ")) && !localStorage.getItem("alyssum_fal_key")));
  const r2 = await T(async () => { __mode = "nocredit"; try { await ImgGen.video({ images: [await __png()], prompt: "x", pollMs: 0, confirm: false }); return {}; } catch (e) { return { err: e.message }; } });
  ok("انتهاء الرصيد: رسالة شراء رصيد واضحة", /اشترِ رصيداً/.test(r2.err || ""), r2);
  await T(() => { __mode = "ok"; localStorage.setItem("alyssum_fal_key", "abcdefgh:12345678"); });
  const r3 = await T(async () => { const f0 = window.fetch; let direct = 0; window.fetch = async (u, o) => { if (/queue\.fal\.run/.test(String(u)) && o && o.method === "POST") { direct++; return new Response(JSON.stringify({ video: { url: "https://cdn.test/v.mp4" } }), { status: 200 }); } return f0(u, o); }; try { await ImgGen.video({ images: [await __png()], prompt: "x", pollMs: 0, confirm: false }); } catch (e) { return { err: e.message }; } window.fetch = f0; return { direct }; });
  ok("بوجود مفتاح محلي صالح يُستعمل الاتصال المباشر (للمالك)", r3.direct === 1, r3);
  ok("بلا أخطاء JS", errs.length === 0, errs);
  console.log(fails ? `\n✗ فشل ${fails} من ${total}` : `\nنجح ${total} من ${total}`); await b.close(); process.exit(fails ? 1 : 0);
})();
