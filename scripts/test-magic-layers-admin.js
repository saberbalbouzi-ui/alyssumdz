/* Magic Layers داخل اللوحة: الأداة في ستوديو ديزاين، تُفتح بالرابط العميق، و«أرسل إلى المطوّر» ينشئ لوحة بمقاس الصورة (نص حقيقي + صور حرة).
   python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-magic-layers-admin.js */
const { chromium } = require("playwright"); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); } else console.log("✓", n); };
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1500, height: 950 } }), p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const reg = await p.evaluate(async () => { const c = await (await fetch("assets/data/tools-catalog.json")).json(); const list = c.tools || c; const t = list.find(x => x.id === "magiclayers"); return { cls: typeof MagicLayers, deep: typeof AdminNav.deepTool, tool: !!t, name: t && t.name, ic: t && t.icon }; });
  ok("الأداة في الكتالوج والوحدة محمّلة", reg.cls === "object" && reg.tool, reg);
  const opened = await p.evaluate(async () => { window.confirm = () => true; const r = await AdminNav.deepTool("magiclayers"); return { r, dlg: !!document.getElementById("ml-bg"), ttl: document.querySelector("#ml-top h3").textContent }; });
  ok("الرابط العميق يفتح Magic Layers", opened.r === true && opened.dlg, opened);
  const res = await p.evaluate(async () => {
    const W = 1200, H = 900, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d"), gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "#245"); gr.addColorStop(1, "#c96"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const truth = []; for (let i = 0; i < 12; i++) { const x = 80 + (i % 4) * 270, y = 200 + Math.floor(i / 4) * 200, w = 120, h = 110; g.fillStyle = "hsl(" + (i * 60) + ",80%,50%)"; g.fillRect(x, y, w, h); truth.push({ box: [x, y, x + w, y + h], label: "obj" + i, kind: "object" }); }
    g.font = "800 64px Arial"; g.fillStyle = "#ffffff"; g.fillText("BIG SALE", 80, 120); truth.push({ box: [76, 60, 380, 140], label: "BIG SALE", kind: "text" });
    const blob = await new Promise(r => cv.toBlob(r, "image/png"));
    ImgGen.text = async o => JSON.stringify(truth.map(t => { const b = t.box, r = { box_2d: [Math.round(b[1] / H * 1000), Math.round(b[0] / W * 1000), Math.round(b[3] / H * 1000), Math.round(b[2] / W * 1000)], label: t.label, kind: t.kind }; if (t.kind !== "text") r.mask = [[r.box_2d[1], r.box_2d[0]], [r.box_2d[3], r.box_2d[0]], [r.box_2d[3], r.box_2d[2]], [r.box_2d[1], r.box_2d[2]]]; return r; }));
    localStorage.setItem("alyssum_gp_gkey", "x"); await MagicLayers._t.loadSource(blob);
    document.getElementById("ml-cover").value = "fast"; document.getElementById("ml-local").checked = false; document.getElementById("ml-bgm").value = "orig"; document.getElementById("ml-go").click();
    for (let i = 0; i < 100 && (MagicLayers.S.busy || i < 3); i++) await new Promise(r => setTimeout(r, 100));
    return { n: MagicLayers.S.layers.length, text: MagicLayers.S.layers.filter(l => l.text).map(l => l.text), st: document.getElementById("ml-st").textContent };
  });
  ok("استخرج 12 عنصراً + نصاً + الخلفية", res.n === 14 && res.text[0] === "BIG SALE", res);
  await p.evaluate(() => { PBApp.uploadBlob = async (blob, name) => "assets/img/pages/" + name + ".webp"; document.getElementById("ml-send").click(); });
  await p.waitForFunction(() => PBApp.E && PBApp.E.page && PBApp.E.page.ad && document.getElementById("pb-app").classList.contains("on") && (PBApp.E.page.sections[0].free || []).length >= 14, null, { timeout: 25000 }).catch(() => { });
  const pg = await p.evaluate(() => { const pg = PBApp.E.page, f = pg.sections[0].free || []; return { ad: !!pg.ad, dw: pg.sections[0].set.dw, n: f.length, types: f.reduce((a, w) => (a[w.type] = (a[w.type] || 0) + 1, a), {}), t: f.find(w => w.type === "heading" || w.type === "text"), img: f.find(w => w.type === "image" && w.set.alt === "obj0"), srcs: f.slice(0,3).map(w => w.set.src) }; });
  ok("لوحة بمقاس الصورة 1200 في المطوّر", pg.ad && pg.dw === 1200, pg);
  ok("14 عنصراً حراً: 13 صورة + نص حقيقي واحد", pg.n === 14 && pg.types.image === 13 && (pg.types.heading || 0) + (pg.types.text || 0) === 1, pg.types);
  ok("النص عنصر نصي بعبارته ولونه وحجمه", pg.t && (pg.t.set.text === "BIG SALE" || /BIG SALE/.test(pg.t.set.html || "")) && /^#f/i.test(pg.t.set.color || "") && pg.t.set.fs.d >= 30, pg.t && pg.t.set);
  ok("الصورة بموضعها ونسبتها المئوية", pg.img && pg.img.set.fwd.d > 5 && pg.img.set.fh.d > 50, pg.img && pg.img.set);
  ok("لا أخطاء JS", errs.length === 0, errs);
  await b.close(); console.log(fails ? "FAILED " + fails : "ALL OK"); process.exit(fails ? 1 : 0);
})();
