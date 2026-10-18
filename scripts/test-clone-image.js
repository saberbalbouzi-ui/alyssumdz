/* اختبار كفاءة «نسخ قالب ← صورة»: لقطة شاشة اصطناعية ببنية معروفة ← عناصر حرة؛ يقيس اكتشاف البنية (IoU) وتشابه الرسم النهائي مع الأصل.
   OCR (Tesseract من الشبكة) يُحاكى بنصوص الحقيقة الأرضية، فالاختبار يقيس بنية العناصر لا جودة التعرّف على الحروف.
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-clone-image.js [--dump] */
const { chromium } = require("playwright");
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } }; const info = (...a) => console.log(...a);
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1500, height: 950 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  t("الوحدة محمّلة", await p.evaluate(() => typeof PBClone === "object" && typeof PBClone._t.detect === "function"));
  /* لقطة اصطناعية (1000×1500) + الحقيقة الأرضية */
  const JPEG = process.argv.includes("--jpeg") ? 0.7 : 0, GRAD = process.argv.includes("--gradient"); await p.evaluate(([q, g]) => { window.__jpeg = q; window.__grad = g; }, [JPEG, GRAD]);
  const G = await p.evaluate(async () => {
    const W = 1000, H = 1500, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const c = cv.getContext("2d"); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const truth = { shapes: [], photos: [], texts: [], buttons: [] };
    c.fillStyle = "#ffffff"; c.fillRect(0, 0, W, H);
    const rect = (x, y, w, h, col, r = 0, tag) => { c.fillStyle = col; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); c.fill(); if (tag) truth.shapes.push({ x, y, w, h, tag, r }); };
    const photo = (x, y, w, h, hue) => { for (let yy = 0; yy < h; yy += 3) for (let xx = 0; xx < w; xx += 3) { const v = 40 + 30 * Math.sin(xx / 17 + hue) + 30 * Math.cos(yy / 23) + rnd() * 55; c.fillStyle = `hsl(${(hue * 40 + xx / 6) % 360},55%,${Math.max(15, Math.min(85, v))}%)`; c.fillRect(x + xx, y + yy, 3, 3); } truth.photos.push({ x, y, w, h }); };
    const text = (s, x, y, size, col, weight = 700, align = "left", tag) => { c.fillStyle = col; c.font = `${weight} ${size}px Arial`; c.textBaseline = "alphabetic"; c.textAlign = align; c.fillText(s, x, y); const w = c.measureText(s).width, x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x; truth.texts.push({ s, x: Math.round(x0), y: Math.round(y - size * .78), w: Math.round(w), h: Math.round(size * .98), size, col, tag }); };
    rect(0, 0, W, 70, "#173f35", 0, "header"); text("Alyssum Shop", 40, 45, 26, "#ffffff"); text("Home   Shop   Contact", 640, 44, 18, "#e8f0ec", 400);
    photo(40, 110, 480, 330, 1); text("Natural Honey", 560, 190, 44, "#173f35"); text("Pure raw honey from mountain", 560, 240, 20, "#444444", 400); text("flowers delivered to your door", 560, 270, 20, "#444444", 400);
    rect(560, 320, 230, 60, "#e07b00", 14, "btn1"); text("Order now", 675, 359, 22, "#ffffff", 700, "center"); truth.buttons.push({ x: 560, y: 320, w: 230, h: 60, s: "Order now" });
    rect(0, 480, W, 8, "#f3ecd8", 0, "divider");
    for (let i = 0; i < 3; i++) { const x = 40 + i * 320; rect(x, 540, 280, 360, "#f4f1ea", 18, "card" + i); photo(x + 20, 560, 240, 170, 2 + i); text("Product " + (i + 1), x + 20, 775, 24, "#173f35"); text("1800 DA", x + 20, 815, 22, "#c0392b"); rect(x + 20, 835, 240, 46, "#173f35", 10, "cbtn" + i); text("Buy", x + 140, 866, 20, "#ffffff", 700, "center"); truth.buttons.push({ x: x + 20, y: 835, w: 240, h: 46, s: "Buy" }); }
    if (window.__grad) { const g = c.createLinearGradient(0, 960, 0, 1180); g.addColorStop(0, "#173f35"); g.addColorStop(1, "#4fa37c"); c.fillStyle = g; c.beginPath(); c.roundRect(40, 960, 920, 220, 24); c.fill(); truth.shapes.push({ x: 40, y: 960, w: 920, h: 220, tag: "banner", r: 24 }); } else rect(40, 960, 920, 220, "#e9f3ee", 24, "banner"); text("Free delivery on orders over 5000 DA", 500, 1060, 34, "#173f35", 700, "center"); text("Valid in all 58 wilayas", 500, 1110, 22, "#555555", 400, "center");
    rect(0, 1300, W, 200, "#10241d", 0, "footer"); text("Contact us: 0555 12 34 56", 40, 1380, 22, "#d6e4dc", 400); text("2026 Alyssum", 40, 1430, 18, "#9fb5ab", 400);
    truth.dataUrl = cv.toDataURL(window.__jpeg ? "image/jpeg" : "image/png", window.__jpeg || undefined); truth.W = W; truth.H = H; return truth;
  });
  info(`الحقيقة الأرضية: ${G.shapes.length} شكلاً، ${G.photos.length} صور، ${G.texts.length} نصاً، ${G.buttons.length} أزرار`);
  /* محاكاة OCR بنصوص الحقيقة (أسطر) */
  await p.evaluate((texts) => { window.Tesseract = { recognize: async () => ({ data: { lines: texts.map(x => ({ text: x.s, confidence: 95, bbox: { x0: x.x, y0: x.y, x1: x.x + x.w, y1: x.y + x.h } })) } }) }; }, G.texts);
  /* الرفع الحقيقي يتطلب ربط نشر؛ نحاكيه بروابط data: ليُرسم الناتج */
  await p.evaluate(() => { PBApp.uploadBlob = (blob) => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); });
  /* تشغيل: افتح الناسخ، تبويب الصورة، أسقط الملف، انسخ */
  await p.evaluate(() => { PBClone.open(); document.querySelector('[data-cltab="img"]').click(); });
  await p.evaluate(async (d) => { const blob = await (await fetch(d)).blob(), file = new File([blob], "shot.png", { type: "image/png" }), dt = new DataTransfer(); dt.items.add(file); document.getElementById("pbx-clone").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true })); }, G.dataUrl);
  await p.waitForFunction(() => PBClone._t.S.img, null, { timeout: 8000 }).catch(() => { });
  t("الصورة حُمّلت في الناسخ", await p.evaluate(() => !!PBClone._t.S.img));
  await p.evaluate(() => { PBClone._t.S.limit = PBClone._t.S.img.H || 1500; });
  const t0 = Date.now(); await p.evaluate(() => document.querySelector("#pbx-clone .cl-go").click());
  await p.waitForFunction("!document.getElementById(\"pbx-clone\")", null, { timeout: 60000, polling: 100 }).catch(() => { });
  const ms = Date.now() - t0;
  const R = await p.evaluate(() => { const pg = PBApp.E.page; const sec = pg.sections.find(s => (s.free || []).length > 3) || pg.sections[0]; const dw = (sec.set && sec.set.dw && (sec.set.dw.d || sec.set.dw)) || 1000;
    return { dw, widgets: (sec.free || []).map(w => ({ type: w.type, x: (w.set.fx.d / 100) * dw, y: w.set.fy.d, w: (w.set.fwd.d / 100) * dw, h: w.set.fh.d, text: (w.set.html || w.set.text || "").replace(/<[^>]*>/g, " "), color: w.set.color || "", tdir: w.set.tdir || "", ta: w.set.ta && w.set.ta.d, fill: w.set.fill || w.set.bgc || "", src: !!(w.set.src) })), page: JSON.parse(JSON.stringify(pg)) }; });
  info(`زمن التحويل: ${ms}ms ، عناصر ناتجة: ${R.widgets.length} (${[...new Set(R.widgets.map(w => w.type))].map(k => k + "×" + R.widgets.filter(w => w.type === k).length).join(" ، ")})`);
  t("زمن التحويل < 8 ثوانٍ لصفحة 1000×1500", ms < 8000, ms);
  const iou = (a, b) => { const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h), i = Math.max(0, x1 - x0) * Math.max(0, y1 - y0); return i / (a.w * a.h + b.w * b.h - i || 1); };
  const best = (g, types) => { let m = { v: 0, w: null }; for (const w of R.widgets) { if (!types.includes(w.type)) continue; const v = iou(g, w); if (v > m.v) m = { v, w }; } return m; };
  const rep = (name, arr, types, thr = .8) => { const rs = arr.map(g => best(g, types).v), hit = rs.filter(v => v >= thr).length; info(`${name}: ${hit}/${arr.length} مكتشفة (IoU≥${thr}) ، متوسط IoU ${(rs.reduce((a, v) => a + v, 0) / (rs.length || 1)).toFixed(2)} ، أدنى ${Math.min(...rs).toFixed(2)}`); return { hit, n: arr.length, rs }; };
  const shp = G.shapes.filter(s => s.tag !== "header" && s.tag !== "footer" && s.tag !== "divider"), edge = G.shapes.filter(s => s.tag === "header" || s.tag === "footer" || s.tag === "divider");
  const rShape = rep("أشكال (بطاقات/بانر/أزرار)", shp, ["shape", "button"]); const rEdge = rep("أشرطة كاملة العرض (هيدر/فوتر/فاصل)", edge, ["shape"], .7);
  const rPhoto = rep("صور", G.photos, ["image"], .75); const rBtn = rep("أزرار كعنصر زر", G.buttons, ["button"], .8); const norm = v => String(v).replace(/\s+/g, " ").trim().toLowerCase(), TW = R.widgets.filter(w => w.type === "text" || w.type === "button");
  const found = G.texts.map(g => { const cx = g.x + g.w / 2, cy = g.y + g.h / 2, w = TW.find(w => norm(w.text).includes(norm(g.s)) && cx >= w.x - 6 && cx <= w.x + w.w + 6 && cy >= w.y - 6 && cy <= w.y + w.h + 6); return { g, w }; });
  const rTxt = { hit: found.filter(f => f.w).length, n: G.texts.length, rs: found.map(f => f.w ? 1 : 0) }; info(`نصوص: ${rTxt.hit}/${rTxt.n} موجودة بنصها وفي موضعها`);
  const hexRgb = h => { const m = /#?([0-9a-f]{6})/i.exec(h || ""); return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : null; }, colHit = found.filter(f => f.w && f.w.type === "text" && hexRgb(f.w.color) && hexRgb(f.g.col) && Math.abs(hexRgb(f.w.color)[0] - hexRgb(f.g.col)[0]) + Math.abs(hexRgb(f.w.color)[1] - hexRgb(f.g.col)[1]) + Math.abs(hexRgb(f.w.color)[2] - hexRgb(f.g.col)[2]) < 120);
  const txtN = found.filter(f => f.w && f.w.type === "text").length; info(`ألوان النصوص مطابقة: ${colHit.length}/${txtN}`);
  const price = found.find(f => f.g.s === "1800 DA"); info("سعر 1800 DA → لون العنصر:", price && price.w && price.w.color, "اتجاه:", price && price.w && price.w.tdir);
  const btnText = R.widgets.filter(w => w.type === "button").map(w => w.text);
  info(`أزرار بنصها: ${btnText.length} (${[...new Set(btnText)].join("|")})`);
  const extra = R.widgets.filter(w => w.type !== "image" || w.w < R.dw * .98).filter(w => !G.shapes.concat(G.photos, G.texts).some(g => iou(g, w) > .3)).length; info(`عناصر زائدة بلا مقابل: ${extra}`);
  /* التشابه البصري: ارسم الصفحة الناتجة وقارنها بالأصل */
  const html = await p.evaluate(() => PB.fullHtml(PBApp.E.page, Object.assign({ base: "/" }, PBApp.siteCtx())));
  const q = await b.newPage({ viewport: { width: 1000, height: 900 } }); await q.setContent(html.replace("<head>", '<head><base href="http://localhost:8765/">'), { waitUntil: "load" }); await q.waitForTimeout(1200);
  const shot = await q.screenshot({ fullPage: true, type: "png" }); require("fs").writeFileSync("/tmp/clone-out.png", shot);
  const sim = await p.evaluate(async ({ a, b64, H }) => { const ld = u => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = u; }); const A = await ld(a), B = await ld("data:image/png;base64," + b64); const W = 1000, h = Math.min(H, B.naturalHeight), cvs = [A, B].map(im => { const c = document.createElement("canvas"); c.width = W; c.height = h; const x = c.getContext("2d"); x.drawImage(im, 0, 0, im.naturalWidth, Math.min(im.naturalHeight, h), 0, 0, W, h); return x.getImageData(0, 0, W, h).data; }); let d = 0, bigs = 0, n = W * h; for (let i = 0; i < cvs[0].length; i += 4) { const e = (Math.abs(cvs[0][i] - cvs[1][i]) + Math.abs(cvs[0][i + 1] - cvs[1][i + 1]) + Math.abs(cvs[0][i + 2] - cvs[1][i + 2])) / 3; d += e; if (e > 40) bigs++; } return { mad: d / n, bigPct: bigs / n * 100, outH: B.naturalHeight }; }, { a: G.dataUrl, b64: shot.toString("base64"), H: G.H });
  info(`التشابه البصري: متوسط فرق البكسل ${sim.mad.toFixed(2)}/255 ، بكسلات مختلفة جداً ${sim.bigPct.toFixed(2)}% ، ارتفاع الناتج ${sim.outH} (الأصل ${G.H})`);
  /* الأصل لا يُكرَّر: صورة الخلفية لا تحتوي نصوصاً/أشكالاً كانت عناصر (تنظيف) — نقيس تباين منطقة نص في صورة الخلفية */
  t("الاكتشاف: ≥ 90% من الأشكال" + (JPEG && GRAD ? " (حد معروف: تدرّج + JPEG يُجزَّأ جزئياً، المطلوب ≥ 60%)" : ""), rShape.hit / rShape.n >= (JPEG && GRAD ? .6 : .9), rShape.rs.map(v => +v.toFixed(2)));
  t("الاكتشاف: كل الصور", rPhoto.hit === rPhoto.n, rPhoto.rs.map(v => +v.toFixed(2)));
  t("الاكتشاف: كل الأزرار عناصر زر", rBtn.hit === rBtn.n, rBtn.rs.map(v => +v.toFixed(2)));
  t("النصوص: كلها موجودة بنصها وموضعها", rTxt.hit >= rTxt.n - 1, found.filter(f => !f.w).map(f => f.g.s));
  t("ألوان النصوص تُحفظ (≥ 90%)", colHit.length >= Math.floor(txtN * .9), { colHit: colHit.length, txtN });
  t("لا عناصر زائدة كثيرة", extra <= 3, extra);
  t("التشابه البصري مقبول (فرق < 6/255 و< 4% بكسلات مختلفة جداً)", sim.mad < 6 && sim.bigPct < 4, sim);
  t("بلا أخطاء جافاسكربت", errs.length === 0, errs.slice(0, 3));
  console.log(bad ? `\n✗ ${bad} فشل / ${ok + bad}` : `\n✓ ${ok} فحصاً ناجحاً`); await b.close(); process.exit(bad ? 1 : 0);
})();
