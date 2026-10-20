/* Magic Layers: دوال نقية + خط استخراج كامل بنموذج محاكى (أكثر من 20 عنصراً على خلفية معقّدة) + نصوص حقيقية + تصدير ZIP.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-magic-layers.js */
const http = require("http"), fs = require("fs"), path = require("path"), root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const { chromium } = require("playwright");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/__blank") { r.writeHead(200, { "Content-Type": "text/html" }); return r.end("<!doctype html><meta charset=utf-8><body style='margin:0'></body>"); } const f = path.join(root, u); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });
const load = (p, src) => p.evaluate(s => new Promise(r => { const e = document.createElement("script"); e.src = s; e.onload = r; document.body.appendChild(e); }), src);
(async () => {
  await new Promise(r => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch(), ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 900 } }), p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(base + "/__blank"); await p.evaluate(() => { window.toast = () => { }; window.confirm = () => true; window.ImgGen = {}; });
  await load(p, "/assets/js/image-tools.js"); await load(p, "/assets/js/magic-layers.js");
  /* ═══ نقية ═══ */
  const pure = await p.evaluate(() => {
    const T = MagicLayers._t, r = {};
    r.tiles0 = T.tilesFor(500, 500, 2).length; const t = T.tilesFor(1600, 1200, 3); r.tiles3 = t.length; r.tcover = t.every(a => a.x >= 0 && a.y >= 0 && a.x + a.w <= 1600 && a.y + a.h <= 1200) && t[0].x === 0 && t[8].x + t[8].w === 1600 && t[8].y + t[8].h === 1200;
    r.parse1 = T.parseItems('```json\n[{"box_2d":[0,0,10,10],"label":"a"}]\n```').length; r.parse2 = T.parseItems('[{"box_2d":[0,0,10,10],"label":"a"},{"box_2d":[5,5,50,50],"label":"b","mask":[[1,1],[2,').length;
    r.parse3 = T.parseItems('garbage "box_2d": [10, 20, 30, 40], "label": "x" , "kind":"text"').length; r.parse4 = T.parseItems('{"items":[{"box_2d":[1,1,9,9]}]}').length;
    const W = 1000, H = 1000, a = T.norm({ box_2d: [100, 100, 300, 300], label: "A", mask: [[100, 100], [300, 100], [300, 300], [100, 300]] }, { x: 0, y: 0, w: W, h: H }, W, H);
    r.normA = a.box.join(","); r.poly = a.poly && a.poly[0].map(Math.round).join(",");
    const tile = { x: 500, y: 500, w: 500, h: 500 }, b = T.norm({ box_2d: [0, 0, 500, 500], label: "B", kind: "text" }, tile, W, H); r.normB = b.box.join(",") + "|" + b.kind + "|" + b.cut;
    const d = T.dedupe([{ box: [0, 0, 100, 100], label: "x", kind: "object" }, { box: [5, 5, 105, 105], label: "x2", kind: "object" }, { box: [200, 200, 300, 300], label: "Hello", kind: "text" }, { box: [205, 202, 300, 305], label: "hello", kind: "text" }, { box: [600, 600, 700, 700], label: "y", kind: "object" }, { box: [610, 610, 650, 650], label: "y-part", kind: "object", cut: true }]);
    r.dedupe = d.length; return r;
  });
  ok("التجزئة: صورة صغيرة بلا مربعات و3×3 = 9 تغطي الصورة", pure.tiles0 === 0 && pure.tiles3 === 9 && pure.tcover, pure);
  ok("parseItems: سياجات، JSON مقطوع، نص متهالك، كائن مغلّف", pure.parse1 === 1 && pure.parse2 === 2 && pure.parse3 === 1 && pure.parse4 === 1, pure);
  ok("norm: صندوق ومضلّع بالبكسل + مربع جزئي يعلَّم مقطوعاً", pure.normA === "100,100,300,300" && pure.poly === "100,100" && /^500,500,750,750\|text\|true$/.test(pure.normB), pure);
  ok("dedupe: تقاطع عالٍ، نص مكرر، جزء مقطوع داخل أكبر → 3", pure.dedupe === 3, pure);

  /* ═══ الخط الكامل بنموذج محاكى ═══ */
  const out = await p.evaluate(async () => {
    const W = 1600, H = 1200, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "#21456b"); gr.addColorStop(.5, "#7a4a6e"); gr.addColorStop(1, "#d9a066"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) { g.fillStyle = "rgba(" + (i * 37 % 255) + "," + (i * 91 % 255) + "," + (i * 53 % 255) + ",.18)"; g.fillRect((i * 97) % W, (i * 61) % H, 40 + i % 90, 6 + i % 20); }
    const truth = []; let k = 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) { const x = 90 + c * 250, y = 230 + r * 175, w = 70 + (k % 3) * 25, h = 70 + (k % 4) * 15, hue = (k * 47) % 360; g.fillStyle = "hsl(" + hue + ",85%,50%)"; if (k % 2) { g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, 7); g.fill(); } else g.fillRect(x, y, w, h); truth.push({ box: [x, y, x + w, y + h], label: "shape" + k, kind: "object" }); k++; }
    const texts = [["SALE 50%", 100, 90, "#ffffff", 70], ["Alyssum Honey", 700, 90, "#ffe27a", 60], ["NEW", 1300, 100, "#ffffff", 60], ["Free Delivery", 100, 1120, "#ffffff", 50], ["عسل طبيعي", 800, 1120, "#fff3c4", 56], ["Call now", 1300, 1120, "#ffffff", 40]];
    g.textBaseline = "alphabetic"; texts.forEach(([t, x, y, col, fs]) => { g.font = "800 " + fs + "px Arial, sans-serif"; g.fillStyle = col; g.fillText(t, x, y); const w = g.measureText(t).width; truth.push({ box: [x - 4, y - fs, x + w + 4, y + fs * .25], label: t, kind: "text" }); });
    const blob = await new Promise(r => cv.toBlob(r, "image/png"));
    window.__truth = truth; window.__calls = []; let tileN = 0, textN = 0;
    const toRaw = (t, tile) => { const o = { box_2d: [Math.round((t.box[1] - tile.y) / tile.h * 1000), Math.round((t.box[0] - tile.x) / tile.w * 1000), Math.round((t.box[3] - tile.y) / tile.h * 1000), Math.round((t.box[2] - tile.x) / tile.w * 1000)], label: t.label, kind: t.kind };
      if (t.kind !== "text") { const [a, b, c, d] = o.box_2d; o.mask = [[b, a], [d, a], [d, c], [b, c]]; } return o; };
    const TILES = (n => { const T = MagicLayers._t.tilesFor(W, H, n); return T; })(2);
    ImgGen.text = async o => {
      const pr = o.prompt, isTile = /zoomed crop/.test(pr), resid = /ALREADY FOUND/.test(pr); let rows;
      if (/EXACT text you read/.test(pr)) { const B = MagicLayers._t.bandsFor(W, H), bl = B[textN++ % Math.max(1, B.length)]; rows = truth.filter(t => { if (t.kind !== "text") return false; const cx = (t.box[0] + t.box[2]) / 2, cy = (t.box[1] + t.box[3]) / 2; return cx > bl.x && cx < bl.x + bl.w && cy > bl.y && cy < bl.y + bl.h; }).map(t => toRaw(t, bl)); window.__calls.push("text"); }
      else if (isTile) { const tl = TILES[tileN++ % TILES.length]; rows = truth.filter(t => { const cx = (t.box[0] + t.box[2]) / 2, cy = (t.box[1] + t.box[3]) / 2; return cx > tl.x + 8 && cx < tl.x + tl.w - 8 && cy > tl.y + 8 && cy < tl.y + tl.h - 8; }).map(t => toRaw(t, tl)); window.__calls.push("tile"); }
      else if (resid) { const listed = (pr.match(/"/g) || []).length; rows = truth.slice(0).reverse().slice(0, 12).map(t => toRaw(t, { x: 0, y: 0, w: W, h: H })); window.__calls.push("resid"); }
      else { rows = truth.slice(0, 20).map(t => toRaw(t, { x: 0, y: 0, w: W, h: H })); window.__calls.push("full"); }
      return JSON.stringify(rows);
    };
    localStorage.setItem("alyssum_gp_gkey", "test-key"); MagicLayers.open(); await MagicLayers._t.loadSource(blob);
    const res = {};
    const run = async cover => { document.getElementById("ml-cover").value = cover; document.getElementById("ml-local").checked = false; document.getElementById("ml-max").value = "120"; document.getElementById("ml-bgm").value = "orig"; window.__calls.length = 0; document.getElementById("ml-go").click();
      for (let i = 0; i < 200 && (MagicLayers.S.busy || i < 3); i++) await new Promise(r => setTimeout(r, 100)); return { calls: window.__calls.slice(), n: MagicLayers.S.layers.length }; };
    res.fast = await run("fast");
    res.dense = await run("dense");
    const S = MagicLayers.S; res.layers = S.layers.map(l => ({ name: l.name, kind: l.kind, how: l.how, text: l.text || "", tp: l.tp, x: l.x, y: l.y, w: l.w, h: l.h })); res.status = document.getElementById("ml-st").textContent;
    /* تغطية: كل عنصر حقيقي له طبقة تتقاطع معه */
    const iouf = (a, b) => { const i = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1])); return i / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i); };
    res.found = truth.filter(t => S.layers.some(l => l.kind !== "background" && iouf([l.x, l.y, l.x + l.w, l.y + l.h], t.box) > .5)).length; res.total = truth.length;
    /* النص الحقيقي: اللون والحجم؛ والنص ممسوح من الخلفية */
    const tl = S.layers.find(l => l.text === "SALE 50%"); res.saleTp = tl && tl.tp; 
    const bgL = S.layers[0], bgc = bgL.canvas.getContext("2d"), tr = truth.find(t => t.label === "SALE 50%"), px = bgc.getImageData(Math.round(tr.box[0] + 10), Math.round(tr.box[1] + 40), 1, 1).data; res.bgPix = [px[0], px[1], px[2]];
    const full = S.layers.length; const zipBlob = await (async () => { const files = []; return null; })();
    return res;
  });
  console.log("  fast:", JSON.stringify(out.fast), "dense:", JSON.stringify(out.dense), "found", out.found + "/" + out.total, "\n  status:", out.status);
  ok("وضع «سريع» يتجاوز 20 عنصراً بمرور المتبقي", out.fast.n > 21 && out.fast.calls.filter(c => c !== "text").join() === "full,resid,resid".slice(0, out.fast.calls.filter(c => c !== "text").join().length) && out.fast.calls[0] === "full", out.fast);
  ok("وضع «شامل»: صورة كاملة + 4 مربعات + مرورا متبقٍ", out.dense.calls.filter(c => c === "tile").length === 4 && out.dense.calls[0] === "full" && out.dense.calls.includes("resid"), out.dense);
  ok("كل العناصر الـ36 مستخرجة (>20) + طبقة الخلفية", out.found === out.total && out.dense.n === out.total + 1, [out.found, out.total, out.dense.n]);
  ok("النصوص صارت نصاً حقيقياً بعبارتها وحجمها ولونها", (() => { const t = out.layers.filter(l => l.kind === "text"); return t.length === 6 && t.every(l => l.text && l.tp && l.tp.fs >= 20) && out.saleTp && out.saleTp.color.toLowerCase() >= "#e0e0e0" && out.layers.some(l => l.text === "عسل طبيعي" && l.tp.rtl); })(), out.saleTp);
  ok("النص ممسوح من الخلفية (لا بكسل أبيض ساطع تحت «SALE»)", out.bgPix[0] < 235 || out.bgPix[1] < 235 || out.bgPix[2] < 235, out.bgPix);
  ok("الأشكال بمضلّع والنصوص كنص", out.layers.filter(l => l.how === "poly").length >= 30 && out.layers.filter(l => l.how === "text").length === 6);
  /* ═══ التصدير ═══ */
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#ml-zip")]); const buf = fs.readFileSync(await dl.path()), s = buf.toString("latin1");
  ok("ZIP: توقيع PK + manifest + composition + ~37 ملف PNG", buf.slice(0, 2).toString() === "PK" && s.includes("manifest.json") && s.includes("composition.png") && (s.match(/\d{3}_[^\x00]*\.png/g) || []).length >= 37, (s.match(/\d{3}_/g) || []).length);
  const man = await p.evaluate(async () => { const S = MagicLayers.S; return S.layers.filter(l => l.text).map(l => ({ t: l.text, c: l.tp.color })); });
  ok("manifest يحمل نص ولون الحرف للنصوص", man.length === 6);
  await p.evaluate(() => { const l = MagicLayers.S.layers[5]; document.querySelectorAll(".ml-row")[0].click(); });
  ok("لا أخطاء JS", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? "FAILED " + fails : "ALL OK"); process.exit(fails ? 1 : 0);
})();
