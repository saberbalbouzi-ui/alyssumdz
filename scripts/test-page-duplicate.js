/* نسخ صفحة: تظهر النسخة فوراً في قائمة الصفحات كمسودة (مصدر + سطر فهرس live:false)، ولا تُنشر ولا تُمسّ الأصلية. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1300, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(7000);
  const R = await p.evaluate(async () => {
    document.getElementById("app").classList.remove("hidden"); const msgs = []; window.toast = m => msgs.push(String(m));
    const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))), page = { v: 1, title: "صفحة أصل", slug: "orig", sections: [{ id: "s1", cols: [{ id: "c1", widgets: [{ id: "w1", type: "text", set: { html: "x" } }] }] }] };
    const index = [{ slug: "orig", thumb: "", title: "صفحة أصل", updated: "2026-11-01 10:00", live: true }];
    GH.getFile = async path => { if (/index\.json$/.test(path)) return { content: enc(index), sha: "i" }; if (/orig\.json$/.test(path)) return { content: enc(page), sha: "p" }; throw new Error("404"); };
    const puts = []; PBApp.putJson = async (path, obj, msg) => { puts.push({ path, obj }); }; let refreshed = 0; PBAdmin.refresh = async () => { refreshed++; };
    PBAdmin.list = index.slice(); window.prompt = () => "orig-copy";
    await PBAdmin.duplicate("orig");
    const src = puts.find(x => /orig-copy\.json$/.test(x.path)), idx = puts.find(x => /index\.json$/.test(x.path));
    window.prompt = () => "orig"; puts.length = 0; msgs.length = 0; await PBAdmin.duplicate("orig");
    return { src: src && { title: src.obj.title, slug: src.obj.slug, idChanged: src.obj.sections[0].id !== "s1" }, idx: idx && idx.obj.map(x => [x.slug, x.live]), refreshed, dupPuts: puts.length, dupMsg: msgs.join("|") }; });
  t("النسخة تُحفظ فوراً: مصدرها باسم وعنوان جديدين ومعرّفات عناصر جديدة", R.src && R.src.slug === "orig-copy" && /نسخة/.test(R.src.title) && R.src.idChanged, R);
  t("وتظهر في الفهرس أولاً كمسودة غير منشورة والأصلية كما هي، وتُحدَّث القائمة", JSON.stringify(R.idx) === JSON.stringify([["orig-copy", false], ["orig", true]]) && R.refreshed === 1, R);
  t("رابط مستعمل يُرفض بلا كتابة شيء", R.dupPuts === 0 && /مستعمل/.test(R.dupMsg), R);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
