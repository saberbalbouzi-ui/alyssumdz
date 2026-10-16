/* اختبار «مكتبة الأصول» (PBAssets): الوحدة معزولة في صفحة فارغة مع PBApp وfetch مُحاكيَين.
   تشغيل: NODE_PATH=/opt/node-tools/node_modules node scripts/test-assets.js */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "pagebuilder-assets.js"), "utf8");
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log("✗", n, x === undefined ? "" : x); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.route("http://t.local/", r => r.fulfill({ contentType: "text/html", body: `<body><div id="host"></div></body>` })); await p.goto("http://t.local/");
  await p.evaluate(() => {
    window.calls = []; window.tm = [];
    window.PBApp = { toast: m => tm.push(m), uploadBlob: async (b, n) => { calls.push(["blob", n, b.size]); return "assets/img/pages/" + n + ".webp"; }, uploadVideo: async f => { calls.push(["vid", f.name]); return "assets/img/pages/pv-x.mp4"; }, uploadSvg: (t, n) => { calls.push(["svg", n, t.length]); return "assets/img/pages/" + n + ".svg"; }, addPageImage: p => calls.push(["addImg", p]), addVideoFile: p => calls.push(["addVid", p]) };
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#173f35" d="M1 2h2"/></svg>';
    window.fetchLog = [];
    window.fetch = async (u, o) => {
      u = String(u); fetchLog.push(u);
      const J = (j, s = 200) => new Response(JSON.stringify(j), { status: s, headers: { "content-type": "application/json" } });
      if (u.startsWith("https://pixabay.com/api/videos/")) return J({ totalHits: 1, hits: [{ id: 9, tags: "honey", user: "bob", duration: 12, picture_id: "123", videos: { medium: { url: "https://cdn.pixabay.com/v.mp4", size: 3e6 }, tiny: { url: "https://cdn.pixabay.com/t.mp4", size: 1e5 } } }] });
      if (u.startsWith("https://pixabay.com/api/")) { if (/key=bad/.test(u)) return J({}, 400); return J({ totalHits: 90, hits: [1, 2, 3].map(i => ({ id: i, tags: "honey, jar", user: "u" + i, previewURL: "https://cdn.pixabay.com/p" + i + ".jpg", webformatURL: "https://cdn.pixabay.com/w" + i + ".jpg", largeImageURL: i === 2 ? "https://pixabay.com/get/blocked.jpg" : "https://pixabay.com/get/l" + i + ".jpg", imageWidth: 4000, imageHeight: 3000 })) }); }
      if (u.startsWith("https://pixabay.com/get/blocked")) throw new TypeError("CORS");
      if (/pixabay\.com\/get\/|cdn\.pixabay\.com\/w/.test(u)) return new Response(new Blob([new Uint8Array(500)], { type: "image/jpeg" }));
      if (u.endsWith(".mp4")) return new Response(new Blob([new Uint8Array(800)], { type: "video/mp4" }));
      if (u.startsWith("https://api.iconify.design/collections")) return J({ tabler: { name: "Tabler", license: { title: "MIT", spdx: "MIT", url: "u" } }, solar: { name: "Solar", license: { title: "CC BY 4.0", spdx: "CC-BY-4.0" } } });
      if (u.startsWith("https://api.iconify.design/search")) return J({ icons: ["tabler:cart", "solar:cart-bold", "tabler:star", "nolic:x"], total: 3, collections: { tabler: { name: "Tabler", license: { title: "MIT", spdx: "MIT", url: "u" } }, solar: { name: "Solar", license: { title: "CC BY 4.0", spdx: "CC-BY-4.0" } } } });
      if (/api\.iconify\.design\/tabler\/(cart|star)\.svg/.test(u)) return new Response(svg);
      return J({}, 404);
    };
  });
  await p.addScriptTag({ content: src + "\nwindow.PBAssets=PBAssets;" });
  const draw = () => p.evaluate(() => { document.getElementById("host").innerHTML = PBAssets.pane(); PBAssets.bind(document.getElementById("host").querySelector("#ast-root")); });

  /* نقي */
  const u = await p.evaluate(() => { const S = { tab: "img", q: "honey jar", type: "photo", ori: "vertical", cat: "food", color: "red", ed: true, min: "1280", order: "latest", safe: true, lang: "fr", page: 2 };
    return { img: PBAssets.pixUrl(S, "K1"), vid: PBAssets.pixUrl(Object.assign({}, S, { tab: "vid", vtype: "film", color: "red" }), "K1"), ic: PBAssets.iconUrl({ iq: "cart", set: "" }), ic2: PBAssets.iconUrl({ iq: "cart", set: "tabler" }), svg: PBAssets.iconSvgUrl("mdi:cart-outline", "#ff0000"),
      lic: [PBAssets.licOk({ spdx: "MIT" }), PBAssets.licOk({ spdx: "CC-BY-4.0" }), PBAssets.licOk(null), PBAssets.licOk({ spdx: "CC0-1.0" }), PBAssets.licOk({ spdx: "GPL-3.0" })],
      pv: [PBAssets.pickVideo({ medium: { url: "m", size: 9e6 }, small: { url: "s", size: 4e6 } }).url, PBAssets.pickVideo({ large: { url: "L", size: 2e7 } }).url, PBAssets.pickVideo(null)] }; });
  t("pix img url", /^https:\/\/pixabay\.com\/api\/\?/.test(u.img) && /image_type=photo/.test(u.img) && /orientation=vertical/.test(u.img) && /category=food/.test(u.img) && /colors=red/.test(u.img) && /editors_choice=true/.test(u.img) && /min_width=1280/.test(u.img) && /order=latest/.test(u.img) && /page=2/.test(u.img) && /safesearch=true/.test(u.img) && /key=K1/.test(u.img) && /lang=fr/.test(u.img), u.img);
  t("pix vid url", /\/api\/videos\/\?/.test(u.vid) && /video_type=film/.test(u.vid) && !/colors=|image_type|orientation/.test(u.vid), u.vid);
  t("iconify urls", /search\?query=cart&limit=96&prefixes=/.test(u.ic) && /prefix=tabler/.test(u.ic2) && u.svg === "https://api.iconify.design/mdi/cart-outline.svg?color=%23ff0000&height=256", u.svg);
  t("license allow", u.lic.join() === "true,false,false,true,false", u.lic);
  t("video pick", u.pv[0] === "s" && u.pv[1] === "L" && u.pv[2] === null, u.pv);

  /* بلا مفتاح */
  await draw();
  t("no key prompt", await p.evaluate(() => !!document.querySelector("#ast-key") && /pixabay\.com\/api\/docs/.test(document.getElementById("ast-out").innerHTML)));
  await p.fill("#ast-key", "abc"); await p.click("[data-ast-key]");
  t("bad key format rejected", await p.evaluate(() => !localStorage.getItem("alyssum_pixabay_key") && tm.some(m => /شكل المفتاح/.test(m))));
  await p.fill("#ast-key", "12345678-abcdef0123456789abcdef012"); await p.fill("#ast-q", "honey"); await p.click("[data-ast-key]");
  await p.waitForSelector(".ast-grid .ast-i");
  t("key saved + results", await p.evaluate(() => localStorage.getItem("alyssum_pixabay_key") && document.querySelectorAll(".ast-grid .ast-i").length === 3));
  t("search sent key+q", await p.evaluate(() => fetchLog.some(x => /pixabay\.com\/api\/(videos\/)?\?/.test(x) && /key=12345678/.test(x))));
  t("pagination shown", await p.evaluate(() => /صفحة 1 من 3/.test(document.getElementById("ast-out").textContent)));

  /* فلاتر */
  await p.selectOption("#ast-type", "vector"); await p.waitForTimeout(150);
  t("filter triggers re-search", await p.evaluate(() => fetchLog.filter(x => /image_type=vector/.test(x)).length >= 1));
  await p.click('[data-ast-pg="1"]'); await p.waitForTimeout(150);
  t("next page", await p.evaluate(() => /page=2/.test(fetchLog[fetchLog.length - 1])));

  /* تنزيل صورة (الأولى) وبديل عند حجب CORS (الثانية) */
  await p.evaluate(() => { calls.length = 0; });
  await p.click('[data-ast-take="0"]'); await p.waitForFunction(() => calls.some(c => c[0] === "addImg"));
  t("image downloaded + added", await p.evaluate(() => calls[0][0] === "blob" && calls[0][1] === "px-1" && calls.some(c => c[0] === "addImg" && /px-1/.test(c[1]))), await p.evaluate(() => JSON.stringify(calls)));
  await p.evaluate(() => { calls.length = 0; fetchLog.length = 0; });
  await p.click('[data-ast-take="1"]'); await p.waitForFunction(() => calls.some(c => c[0] === "addImg"));
  t("CORS fallback to webformat", await p.evaluate(() => fetchLog.some(x => /blocked/.test(x)) && fetchLog.some(x => /cdn\.pixabay\.com\/w2/.test(x))));

  /* فيديو */
  await p.click('[data-ast-tab="vid"]'); await p.fill("#ast-q", "honey"); await p.click("[data-ast-go]"); await p.waitForSelector(".ast-grid .ast-i");
  t("video thumb", await p.evaluate(() => /vimeocdn\.com\/video\/123_/.test(document.querySelector(".ast-i img").src)));
  await p.evaluate(() => { calls.length = 0; }); await p.click('[data-ast-take="0"]'); await p.waitForFunction(() => calls.some(c => c[0] === "addVid"));
  t("video uploaded + widget", await p.evaluate(() => calls[0][0] === "vid" && calls.some(c => c[0] === "addVid" && /pv-x\.mp4/.test(c[1]))));

  /* أيقونات */
  await p.click('[data-ast-tab="ico"]'); await p.fill("#ast-iq", "cart"); await p.click("[data-ast-go]"); await p.waitForSelector(".ast-grid.ic .ast-i");
  t("icons license filter (only free)", await p.evaluate(() => [...document.querySelectorAll(".ast-grid.ic .ast-i")].map(e => e.title).join() === "tabler:cart,tabler:star"), await p.evaluate(() => [...document.querySelectorAll(".ast-grid.ic .ast-i")].map(e => e.title).join()));
  await p.evaluate(() => { document.getElementById("ast-ok").checked = false; document.getElementById("ast-ok").dispatchEvent(new Event("change", { bubbles: true })); }); await p.waitForTimeout(200);
  t("icons all licenses when unchecked", await p.evaluate(() => [...document.querySelectorAll(".ast-grid.ic .ast-i")].some(e => e.title === "solar:cart-bold")));
  await p.evaluate(() => { calls.length = 0; }); await p.click('.ast-grid.ic .ast-i'); await p.waitForFunction(() => calls.some(c => c[0] === "addImg"));
  t("icon saved as svg + added", await p.evaluate(() => calls[0][0] === "svg" && calls.some(c => c[0] === "addImg" && /\.svg$/.test(c[1]))));


  /* وضع الوسيط: بلا مفتاح شخصي، البحث والتنزيل عبر دالة المنصة */
  await p.evaluate(() => {
    localStorage.removeItem("alyssum_pixabay_key"); window.pxLog = [];
    window.API = { sb: { url: x => "https://sb.local" + x, token: async () => "jwt", headers: t => ({ Authorization: "Bearer " + t, "Content-Type": "application/json" }) } };
    const old = window.fetch;
    window.fetch = async (u, o) => {
      u = String(u); if (!u.startsWith("https://sb.local/functions/v1/pixabay-proxy")) return old(u, o);
      const b = JSON.parse(o.body); pxLog.push(b);
      if (b.op === "search") return new Response(JSON.stringify({ totalHits: 2, hits: [1, 2].map(i => ({ id: 70 + i, tags: "x", user: "u", previewURL: "https://cdn.pixabay.com/p.jpg", webformatURL: "https://cdn.pixabay.com/w.jpg", largeImageURL: "https://pixabay.com/get/px" + i + ".jpg", imageWidth: 1, imageHeight: 1 })) }), { status: 200 });
      return new Response(new Blob([new Uint8Array(300)], { type: "image/jpeg" }));
    };
  });
  await p.evaluate(() => { PBAssets._px.on = null; PBAssets._S.tab = "img"; PBAssets._S.res = null; PBAssets._S.err = ""; });
  await draw(); await p.fill("#ast-q", "miel"); await p.click("[data-ast-go]"); await p.waitForSelector(".ast-grid .ast-i");
  t("proxy: no key prompt + results", await p.evaluate(() => !document.querySelector("#ast-key") && document.querySelectorAll(".ast-grid .ast-i").length === 2));
  t("proxy: search body has no key", await p.evaluate(() => pxLog[0].op === "search" && pxLog[0].query.q === "miel" && !("key" in pxLog[0].query)));
  await p.evaluate(() => { calls.length = 0; fetchLog.length = 0; }); await p.click('[data-ast-take="0"]'); await p.waitForFunction(() => calls.some(c => c[0] === "addImg"));
  t("proxy: direct download via proxy, no browser fetch to pixabay", await p.evaluate(() => pxLog.some(x => x.op === "dl" && /px1/.test(x.url)) && !fetchLog.some(x => /pixabay\.com\/get/.test(x)) && calls[0][1] === "px-71"));
  /* استكشاف على نمط قوائم Pixabay */
  await p.evaluate(() => { PBAssets._S.tab = "img"; });
  await draw();
  t("explore: chips + external links", await p.evaluate(() => document.querySelectorAll("[data-ast-pre]").length === 8 && document.querySelectorAll("[data-ast-qs]").length === 15 && [...document.querySelectorAll("a.ast-ch")].length === 10 && [...document.querySelectorAll("a.ast-ch")].every(a => a.target === "_blank" && /^https:\/\/pixabay\.com\//.test(a.href))));
  await p.evaluate(() => { pxLog.length = 0; }); await p.click('[data-ast-pre="vector"]'); await p.waitForFunction(() => pxLog.length > 0);
  t("explore: vectors preset", await p.evaluate(() => pxLog[0].query.image_type === "vector" && !pxLog[0].query.q));
  await p.evaluate(() => { pxLog.length = 0; }); await p.click('[data-ast-qs="Halloween"]'); await p.waitForFunction(() => pxLog.length > 0);
  t("explore: trending query", await p.evaluate(() => pxLog[0].query.q === "Halloween" && document.getElementById("ast-q").value === "Halloween"));
  await p.evaluate(() => { pxLog.length = 0; }); await p.click('[data-ast-pre="editors"]'); await p.waitForFunction(() => pxLog.length > 0);
  t("explore: editors choice", await p.evaluate(() => pxLog[0].query.editors_choice === "true"));
  await p.evaluate(() => { pxLog.length = 0; }); await p.click('[data-ast-pre="video"]'); await p.waitForFunction(() => pxLog.length > 0);
  t("explore: video preset", await p.evaluate(() => pxLog[0].kind === "videos"));

  /* الدالة غير منشورة (404) ← يعود للمفتاح الشخصي */
  await p.evaluate(() => { const o = window.fetch; window.fetch = async (u, x) => String(u).includes("pixabay-proxy") ? new Response("{}", { status: 404 }) : o(u, x); PBAssets._px.on = null; localStorage.setItem("alyssum_pixabay_key", "12345678-abcdef0123456789abcdef012"); fetchLog.length = 0; });
  await p.fill("#ast-q", "cire"); await p.click("[data-ast-go]"); await p.waitForTimeout(300);
  t("proxy 404 falls back to own key", await p.evaluate(() => PBAssets._px.on === false && fetchLog.some(x => /pixabay\.com\/api\/(videos\/)?\?/.test(x) && /key=12345678/.test(x))));

  /* مفتاح مرفوض */
  await p.evaluate(() => localStorage.setItem("alyssum_pixabay_key", "bad")); await p.click('[data-ast-tab="img"]'); await p.fill("#ast-q", "x"); await p.click("[data-ast-go]"); await p.waitForTimeout(300);
  t("rejected key message", await p.evaluate(() => /مفتاح Pixabay مرفوض/.test(document.getElementById("ast-out").textContent)));
  t("no page errors", errs.length === 0, errs);
  await b.close(); console.log(`test-assets: ${ok} passed, ${bad} failed`); process.exit(bad ? 1 : 0);
})();
