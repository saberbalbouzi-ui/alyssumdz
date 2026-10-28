/* مصلِّحات «سرعة الموقع»: node scripts/test-speed-fix.js */
const path = require("path"), F = require(path.join(__dirname, "../assets/js/speed-fix.js")); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const LHR = { finalDisplayedUrl: "https://shop.dz/", audits: {
  "largest-contentful-paint-element": { details: { items: [{ items: [{ node: { snippet: '<img src="assets/img/hero.png" class="h">' } }] }] } },
  "network-requests": { details: { items: [{ url: "https://fonts.gstatic.com/a.woff2", resourceType: "Font", networkRequestTime: 50 }, { url: "https://cdn.x.com/lib.js", resourceType: "Script", networkRequestTime: 10 }, { url: "https://shop.dz/app.js", resourceType: "Script", networkRequestTime: 5 }] } },
  "render-blocking-insight": { details: { items: [{ url: "https://shop.dz/assets/js/app.js" }, { url: "https://shop.dz/assets/js/b.js" }] } } } };
const HTML = `<!doctype html><html><head><title>t</title>
<style>@font-face{font-family:A;src:url(a.woff2)}</style>
<link href="https://fonts.googleapis.com/css2?family=Cairo" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/s.css?v=2">
<script src="assets/js/app.js"></script><script src="assets/js/b.js" async></script>
</head><body>
<img src="assets/img/hero.png"><img src="a1.png"><img src="x/b.jpg" class="c"><img src="c.webp" alt="x"><img src="d.png" title="شعار">
<button id="agent-close">✕</button><button class="x">فتح</button><button aria-label="ok">☰</button><button id="zz">?</button>
<a href="https://wa.me/213"><svg></svg></a><a href="https://wa.me/213">اتصل</a><a href="https://q.dz/p"><i></i></a>
<a href="/p"><img src="icon.png"> المنتج</a>
<noscript><img src="ns.png"></noscript><script>var s='<img src="in.png"><button>✕</button>'</script>
</body></html>`;
const CTX = { dims: { "a1.png": { w: 400, h: 300 } }, webp: { "assets/img/hero.png": "assets/img/hero-opt.webp" }, origin: "https://shop.dz" };
const an = F.analyze(HTML, LHR, CTX), by = id => an.find(x => x.id === id);
ok("meta: lang+viewport+وصف مفقود يُبلَّغ يدوياً", by("meta").count === 2 && by("meta").manual.some(m => /description/.test(m)), by("meta"));
ok("a11y: زرّا الإغلاق والقائمة محلولان، المجهول يدوي", by("a11y").count === 2 && by("a11y").manual.some(m => /zz/.test(m)), by("a11y"));
ok("alt: الصورة داخل رابط بنص زخرفية + title يصير alt", by("alt").count === 2 && by("alt").manual.length >= 2, by("alt"));
ok("lcp: fetchpriority + preload", by("lcp").count === 2);
ok("lazy: تتخطى أول صورتين وnoscript وscript", by("lazy").count === 4, by("lazy"));
ok("ratio: صورة معروفة الأبعاد فقط ويُطلب قياس الباقي", by("ratio").count === 1 && by("ratio").need.includes("x/b.jpg"), by("ratio"));
ok("preconnect: نطاقان خارجيان لا نطاق الموقع", by("preconnect").count === 2);
ok("fontdisplay: @font-face + رابط الخطوط", by("fontdisplay").count === 2);
ok("webp: استبدال المعروف ويطلب الباقي المحلي فقط", by("webp").count === 1 && by("webp").need.includes("x/b.jpg") && !by("webp").need.includes("ns.png"), by("webp"));
ok("defer: السكربت الحاجب فقط (ليس async)", by("defer").count === 1 && by("defer").risk === "review");
const all = F.FIXERS.map(f => f.id), r1 = F.apply(HTML, all, LHR, CTX), r2 = F.apply(r1.html, all, LHR, CTX);
ok("التطبيق الثاني لا يغيّر شيئاً (idempotent)", r2.html === r1.html && r2.report.every(x => x.id === "webp" || x.n === 0), r2.report.filter(x => x.n));
const h = r1.html;
ok("aria-label وtype على الزر", /<button id="agent-close" aria-label="إغلاق" type="button">✕<\/button>/.test(h), h.match(/<button id="agent-close"[^>]*>/));
ok("زر مسمّى لم يُمسّ", /<button aria-label="ok">☰<\/button>/.test(h));
ok("رابط واتساب بأيقونة فقط", /<a href="https:\/\/wa\.me\/213" aria-label="واتساب">/.test(h));
ok("alt الفارغ للصورة داخل رابط نصي", /<img src="icon\.png" alt=""/.test(h));
ok("alt من title", /<img src="d\.png" title="شعار" alt="شعار"/.test(h));
ok("lazy+decoding على الثالثة والخامسة", /<img src="x\/b\.jpg" class="c" loading="lazy" decoding="async"/.test(h) && /<img src="d\.png"[^>]*loading="lazy"/.test(h));
ok("LCP: preload بالمسار الجديد WebP بعد الاستبدال؟ (preload يحمل الأصل ثم يُستبدل بالتالي)", /rel="preload" as="image" href="assets\/img\/hero(-opt\.webp|\.png)"/.test(h), h.match(/<link rel="preload"[^>]*>/));
ok("aspect-ratio للصورة المقاسة", /<img src="a1\.png" style="aspect-ratio:400\/300"/.test(h));
ok("preconnect بعد <head> مع crossorigin للخطوط", /<head>\n<link rel="preconnect" href="https:\/\/cdn\.x\.com">\n<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>/.test(h) || /preconnect[^>]*gstatic[^>]*crossorigin/.test(h), h.slice(0, 400));
ok("font-display", /font-display:swap\}/.test(h) && /Cairo&display=swap/.test(h));
ok("defer على app.js وليس b.js", /<script defer src="assets\/js\/app\.js">/.test(h) && /<script src="assets\/js\/b\.js" async>/.test(h));
ok("noscript والسكربت الداخلي لم يُمسّا", h.includes('<noscript><img src="ns.png"></noscript>') && h.includes("var s='<img src=\"in.png\"><button>✕</button>'"));
ok("fixCss: لا يكرّر ولا يكسر", F.fixCss("@font-face{font-family:A;src:url(a)}@font-face{font-display:block;src:url(b)}").n === 1 && F.fixCss("@font-face{a:b;}").css === "@font-face{a:b;font-display:swap}");
ok("pagePath", F.pagePath("https://s.dz/") === "index.html" && F.pagePath("https://s.dz/lp/x/") === "lp/x/index.html" && F.pagePath("https://s.dz/shop.html") === "shop.html" && F.pagePath("https://s.dz/p/a") === "p/a/index.html");
ok("localCss: محلي فقط مع أصل الموقع", JSON.stringify(F.localCss(HTML, "https://shop.dz")) === '["assets/css/s.css"]', F.localCss(HTML, "https://shop.dz"));
ok("AUDIT_FIX", F.AUDIT_FIX["button-name"] === "a11y" && F.AUDIT_FIX["offscreen-images"] === "lazy");
process.exit(fails ? 1 : 0);
