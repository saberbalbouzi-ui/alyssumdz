/* الرؤية الذكية (مشترك: منشئ الصفحات، ولاحقاً المحرر): «التقاط العناصر» مثل الالتقاط السحري في Canva، ويعمل بلا مفتاح.
   ① الكشف: Gemini إن وُجد مفتاح المولّد (أسماء عربية وتجميع ذكي)، وإلا نموذجان محليان داخل المتصفح (D-FINE على COCO وObjects365).
   ② الحدود: SAM 2.1 يرسم قناع كل عنصر بدقة البكسل من صندوقه، أو من نقرة/مستطيل يرسمه المستخدم لعنصر فاته الكشف،
      ثم «مرشّح موجَّه» يلصق الحافة بحواف الصورة الأصلية بدقتها الكاملة.
   ③ القصّ: صورة شفافة لكل عنصر (+ ظلّه إن كانت خلفيته ناعمة)، وإعادة رسم مكانه في الخلفية بنموذج MI-GAN محلي (أو Gemini إن فعّله المستخدم).
   Gemini اختياري ومُطفأ افتراضياً. النماذج تعمل في Web Worker (ai-vision-worker.js) فلا تتجمد الصفحة، وتُنزَّل مرة واحدة (~110MB) ثم تُحفظ في ذاكرة المتصفح. */
window.AIVision = (function () {
  const BASE = (document.currentScript && document.currentScript.src) || location.href, WURL = new URL("ai-vision-worker.js", BASE).href;
  const SAMSZ = 1024, DETSZ = 960, W8 = {};
  let seq = 0, curS = null;
  /* ───── العمّال: عامل للقصّ (SAM) وآخر للكشف يعملان بالتوازي ───── */
  function mkWorker(kind) {
    const w = new Worker(WURL, { type: "module" }), P = new Map(); let ok, ko; const ready = new Promise((r, j) => { ok = r; ko = j; }); ready.catch(() => { });
    const t = setTimeout(() => die(new Error("انتهت مهلة تحميل مكتبة الذكاء (الإنترنت بطيء؟)")), 120000);
    function die(err) { clearTimeout(t); if (W8[kind] === w) delete W8[kind]; try { w.terminate(); } catch (e) { } ko(err); P.forEach(p => p.rej(err)); P.clear(); }
    w.onmessage = e => { const d = e.data || {}; if (d.ready) { clearTimeout(t); return ok(); } const p = P.get(d.id); if (!p) return; if (d.progress) return p.onp && p.onp(d.progress); P.delete(d.id); d.ok ? p.res(d.r) : p.rej(new Error(d.err)); };
    w.onerror = e => { if (e.preventDefault) e.preventDefault(); die(new Error("تعذّر تشغيل نموذج الذكاء داخل المتصفح — تحقّق من الإنترنت" + (e.message ? " (" + e.message + ")" : ""))); };
    w.call = (op, a, onp, tr) => ready.then(() => new Promise((res, rej) => { const id = ++seq; P.set(id, { res, rej, onp }); w.postMessage({ id, op, a }, tr || []); }));
    return w;
  }
  const worker = kind => W8[kind] || (W8[kind] = mkWorker(kind));
  const supported = () => typeof Worker !== "undefined";
  function pix(cv, max) {
    const k = Math.min(1, max / Math.max(cv.width, cv.height)), w = Math.max(1, Math.round(cv.width * k)), h = Math.max(1, Math.round(cv.height * k)), c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(cv, 0, 0, w, h); return { data: g.getImageData(0, 0, w, h).data.buffer, w, h, k };
  }
  /* تقدّم التنزيل لكل الملفات معاً ← نص عربي */
  function progress(step) {
    const files = {}; let last = 0;
    return what => p => { files[what + p.file] = [p.loaded, p.total]; const v = Object.values(files), L = v.reduce((s, x) => s + x[0], 0), T = v.reduce((s, x) => s + x[1], 0), now = Date.now(); if (now - last < 250 && L < T) return; last = now; step(T > 1048576 ? "⏳ تنزيل نموذج الذكاء (مرة واحدة فقط) " + Math.round(L / 1048576) + " / " + Math.round(T / 1048576) + "MB" : "⏳ تجهيز نموذج الذكاء…"); };
  }
  /* ───── الكشف ───── */
  const AR = { person: "شخص", book: "كتاب", spoon: "ملعقة", "pen/pencil": "قلم", marker: "قلم", plate: "صحن", bowl: "صحن", "bowl/basin": "وعاء", "tea pot": "إبريق", kettle: "إبريق", jug: "إبريق", bottle: "عبوة", cup: "كوب", vase: "إناء", "wine glass": "كأس", fork: "شوكة", knife: "سكين", "cell phone": "هاتف", laptop: "حاسوب", clock: "ساعة", "potted plant": "نبتة", pottedplant: "نبتة", flower: "زهور", "green vegetables": "أعشاب", apple: "تفاح", orange: "برتقال", "orange/tangerine": "برتقال", banana: "موز", lemon: "ليمون", garlic: "ثوم", nuts: "مكسرات", bread: "خبز", cake: "كعكة", cookies: "بسكويت", dessert: "حلوى", cosmetics: "مستحضر", toiletry: "عبوة", canned: "علبة", "storage box": "علبة", basket: "سلة", handbag: "حقيبة", "handbag/satchel": "حقيبة", backpack: "حقيبة", luggage: "حقيبة", "teddy bear": "دمية", "stuffed toy": "دمية", candle: "شمعة", "cutting/chopping board": "لوح تقطيع", scissors: "مقص", "paint brush": "فرشاة", brush: "فرشاة", "pencil case": "مقلمة", notepaper: "ورقة", folder: "ملف", towel: "منشفة", dog: "كلب", cat: "قطة", bird: "طائر", "wild bird": "طائر", horse: "حصان", carrot: "جزر", broccoli: "بروكلي", tomato: "طماطم", pepper: "فلفل", egg: "بيض", mushroom: "فطر", flask: "قارورة", "barrel/bucket": "دلو", lantern: "فانوس", lamp: "مصباح", tablet: "لوحي", camera: "كاميرا", "head phone": "سماعة", remote: "جهاز تحكم", keyboard: "لوحة مفاتيح", mouse: "فأرة", umbrella: "مظلة", "sports ball": "كرة", soap: "صابون", lipstick: "أحمر شفاه", comb: "مشط", "hair dryer": "مجفف شعر", toothbrush: "فرشاة أسنان", strawberry: "فراولة", grape: "عنب", pear: "إجاص", peach: "خوخ", pomegranate: "رمان", watermelon: "بطيخ", "kiwi fruit": "كيوي", mango: "مانجو", coconut: "جوز الهند", avocado: "أفوكادو", cucumber: "خيار", onion: "بصل", potato: "بطاطا", lettuce: "خس", cheese: "جبن" };
  const DROP = new Set(["dining table", "diningtable", "dinning table", "couch", "sofa", "chair", "bed", "bench", "toilet", "sink", "refrigerator", "oven", "tv", "tvmonitor", "monitor/tv", "desk", "coffee table", "side table", "cabinet/shelf", "nightstand", "stool", "pillow", "carpet", "picture/frame", "mirror", "ring", "necklace", "bracelet", "glasses", "hat", "watch", "belt", "tie", "bow tie", "mask", "gloves", "other shoes", "sneakers", "boots", "leather shoes", "sandals", "slippers", "high heels", "power outlet", "air conditioner", "radiator", "faucet", "awning", "street lights", "traffic light", "traffic sign", "stop sign", "speed limit sign", "crosswalk sign", "trash bin can", "bathtub", "blackboard/whiteboard", "carriage", "extension cord", "converter"]);
  const PRODUCT = /bottle|cup|vase|jug|tea pot|kettle|canned|cosmetics|toiletry|storage box|flask|bowl|plate|basket|barrel|soap|lipstick/i;
  const PERSON = /^(شخص|رجل|امرأة|إمرأة|سيدة|طفل|طفلة|ولد|بنت|فتاة|شاب|أم|أب|جدة|جد|person|man|woman|child|boy|girl|people)/i;
  const arName = en => AR[en] || en;
  const bArea = b => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]), bInter = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const iou = (a, b) => { const i = bInter(a, b); return i / Math.max(1, bArea(a) + bArea(b) - i); };
  async function localDetect(cv, onp) {
    const im = pix(cv, DETSZ), W = cv.width, H = cv.height, K = 1 / im.k;
    const raw = await worker("det").call("detect", { data: im.data, w: im.w, h: im.h, thr: .1 }, onp, [im.data]);
    const all = raw.map(d => ({ src: d.src, en: String(d.label).toLowerCase(), score: d.score, b: d.box.map((v, i) => Math.max(0, Math.min(i % 2 ? H : W, v * K))) }));
    const o365 = all.filter(d => d.src === "o365");
    all.forEach(d => { if (d.src !== "coco") return; let bi = .45; o365.forEach(q => { const v = iou(d.b, q.b); if (v > bi) { bi = v; d.en2 = q.en; } }); });      // اسم Objects365 أدق (قلم بدل «سكين»، صحن بدل «وعاء»)
    const c = all.filter(d => { const en = d.en2 || d.en, a = bArea(d.b); if (DROP.has(en) || DROP.has(d.en)) return false; if (a > W * H * .85 || a < W * H * .0012) return false; return d.score >= (PRODUCT.test(en) ? .2 : .3); });
    c.sort((p, q) => q.score - p.score); const keep = [];
    c.forEach(d => { const en = d.en2 || d.en; if (!keep.some(k => iou(k.b, d.b) > .6 || ((k.en2 || k.en) === en && bInter(k.b, d.b) / Math.max(1, bArea(d.b)) > .85))) keep.push(d); });
    return keep.slice(0, 24).map(d => ({ label: (d.en2 || d.en) === "cup" && (d.b[3] - d.b[1]) > (d.b[2] - d.b[0]) * 1.1 ? "عبوة" : arName(d.en2 || d.en), en: d.en2 || d.en, score: d.score, box: d.b, src: d.src }));
  }
  /* كشف بـ Gemini: صناديق + أسماء عربية (يُرسل الصورة مصغّرة إلى Google بمفتاحك فقط) */
  async function geminiDetect(cv, key) {
    const W = cv.width, H = cv.height, sc = Math.min(1, 1280 / Math.max(W, H)), c = document.createElement("canvas"); c.width = Math.round(W * sc); c.height = Math.round(H * sc); c.getContext("2d").drawImage(cv, 0, 0, c.width, c.height);
    const b64 = c.toDataURL("image/jpeg", .9).split(",")[1];
    const prompt = "Detect every distinct object in this image that a designer could cut out as its own layer (like Canva \"Magic Grab\"). One item for: each person (the WHOLE person: hair, hijab/clothes, arms and hands — never split a person into parts), each product/package/jar/bottle/box, plates and dishes, cups, teapots, spoons and cutlery, pens and pencils, books (a pile or group of books lying together = ONE item), food, fruits, herbs, flowers, plants, animals, toys, decorative objects. Small items of the same kind lying together (seeds, leaves, herbs, pencils, coins) = ONE item. Do NOT include: background, walls, windows, curtains, floor, the table/desk itself, sofas, chairs, cushions, pictures on the wall, text, logos or labels printed on something, or parts of an object (faces, hands, lids, labels). Return ONLY a JSON array (max 25 items): [{\"box_2d\":[ymin,xmin,ymax,xmax],\"label\":\"short Arabic name\"}] with box_2d normalized to 0-1000.";
    let last = "";
    for (const m of ["gemini-2.5-flash", "gemini-2.0-flash"]) {
      const cfg = { responseMimeType: "application/json", temperature: 0 }; if (/2\.5/.test(m)) cfg.thinkingConfig = { thinkingBudget: 0 };
      let r; try { r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: "image/jpeg", data: b64 } }, { text: prompt }] }], generationConfig: cfg }) }); } catch (e) { throw new Error("تعذّر الاتصال بـ Google"); }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { last = r.status + ": " + ((j.error && j.error.message) || ""); if (r.status === 400 && /API key/i.test(last) || r.status === 403) throw new Error("مفتاح Gemini غير صالح: " + last.slice(0, 120)); continue; }
      const t = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(x => x.text || "").join(""); let p;
      try { const s = t.replace(/^```(json)?|```$/g, "").trim(); p = JSON.parse(s.slice(Math.min(...["[", "{"].map(ch => s.indexOf(ch)).filter(i => i >= 0)))); } catch (e) { last = "رد غير مفهوم"; continue; }
      const arr = Array.isArray(p) ? p : (p.items || p.objects || []);
      return arr.filter(x => x && Array.isArray(x.box_2d) && x.box_2d.length === 4).slice(0, 25).map((x, i) => { const [a, b, cc, d] = x.box_2d.map(Number); return { label: String(x.label || "عنصر").trim().slice(0, 24), score: 1 - i * .01, box: [Math.max(0, b / 1000 * W), Math.max(0, a / 1000 * H), Math.min(W, d / 1000 * W), Math.min(H, cc / 1000 * H)], src: "gemini" }; }).filter(d => bArea(d.box) > W * H * .0008);
    }
    throw new Error("فشل كشف Gemini — " + last.slice(0, 140));
  }
  /* ───── الأقنعة (SAM) ─────
     كل عنصر يحفظ قناعه منخفض الدقة (logits 256×256) ونحوّله عند الحاجة: عرض سريع، أو دقة كاملة مع تنعيم الحافة */
  async function embed(cv, onp) { const im = pix(cv, SAMSZ), S = { W: cv.width, H: cv.height, k: im.k, sw: im.w, sh: im.h }; await worker("sam").call("embed", { data: im.data, w: im.w, h: im.h }, onp, [im.data]); curS = S; return S; }
  function cleanLo(lo, lw, lh) {                                     // إزالة الجزر الصغيرة البعيدة (تشويش) والإبقاء على أجزاء العنصر الحقيقية
    const lab = new Int32Array(lw * lh), sizes = [0], st = []; let n = 0;
    for (let i = 0; i < lw * lh; i++) { if (lo[i] <= 0 || lab[i]) continue; n++; let c = 0; st.push(i); lab[i] = n; while (st.length) { const j = st.pop(), x = j % lw; c++; for (const q of [j - 1, j + 1, j - lw, j + lw]) { if (q < 0 || q >= lw * lh || (q === j - 1 && x === 0) || (q === j + 1 && x === lw - 1) || lo[q] <= 0 || lab[q]) continue; lab[q] = n; st.push(q); } } sizes.push(c); }
    const big = Math.max(0, ...sizes); for (let i = 0; i < lw * lh; i++) if (lab[i] && sizes[lab[i]] < Math.max(12, big * .04)) lo[i] = -8;
  }
  /* سدّ الثقوب الصغيرة داخل العنصر (عيون/ظلال على الوجه) مع إبقاء الفراغات الحقيقية (مقبض كوب، ما بين الذراع والجسم) وما يشغله عنصر آخر (قلم في اليد) */
  function fillHoles(it, others) {
    const { lo, lw, lh } = it, N = lw * lh, seen = new Uint8Array(N); let area = 0; for (let i = 0; i < N; i++) if (lo[i] > 0) area++; const lim = Math.max(6, area * .012);
    for (let s = 0; s < N; s++) { if (lo[s] > 0 || seen[s]) continue; const comp = [s]; seen[s] = 1; let edge = false;
      for (let q = 0; q < comp.length; q++) { const j = comp[q], x = j % lw, y = (j / lw) | 0; if (x === 0 || y === 0 || x === lw - 1 || y === lh - 1) edge = true; for (const t of [x > 0 ? j - 1 : -1, x < lw - 1 ? j + 1 : -1, y > 0 ? j - lw : -1, y < lh - 1 ? j + lw : -1]) if (t >= 0 && !seen[t] && lo[t] <= 0) { seen[t] = 1; comp.push(t); } }
      if (edge || comp.length > lim) continue; const occ = comp.filter(j => others.some(o => o.lo[j] > 0)).length; if (occ < comp.length * .3) comp.forEach(j => { lo[j] = 4; }); }
  }
  function stats(it, S) {
    const { lo, lw, lh } = it; let a = 0, x0 = lw, y0 = lh, x1 = -1, y1 = -1; for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) if (lo[y * lw + x] > 0) { a++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    it.area = a; if (!a) return it; const fx = S.fx, fy = S.fy;
    it.x0 = Math.max(0, Math.floor((x0 - 1) / fx)); it.y0 = Math.max(0, Math.floor((y0 - 1) / fy)); it.x1 = Math.min(S.W, Math.ceil((x1 + 2) / fx)); it.y1 = Math.min(S.H, Math.ceil((y1 + 2) / fy)); return it;
  }
  async function maskFor(S, p) {
    if (curS !== S) throw new Error("تغيّرت الصورة — أعد فتح الأداة");
    const r = await worker("sam").call("prompt", { box: p.box && p.box.map(v => v * S.k), pts: p.pts && p.pts.map(q => [q[0] * S.k, q[1] * S.k, q[2] == null ? 1 : q[2]]) });
    const n = r.dims[2], lh = r.dims[3], lw = r.dims[4], N = lw * lh;
    S.lw = lw; S.lh = lh; S.fx = S.k * (r.rs[1] / S.sw) * (lw / SAMSZ); S.fy = S.k * (r.rs[0] / S.sh) * (lh / SAMSZ);      // بكسل كامل ← بكسل القناع
    let bi = 0; for (let i = 1; i < n; i++) if (r.scores[i] > r.scores[bi]) bi = i;
    if (p.box) {                                                      // صندوق: القناع الذي يملأ الصندوق (لا يفيض عنه: ملعقة دون صحنها)
      const B = [p.box[0] * S.fx, p.box[1] * S.fy, p.box[2] * S.fx, p.box[3] * S.fy]; let bv = -1e9;
      for (let i = 0; i < n; i++) { let x0 = lw, y0 = lh, x1 = -1, y1 = -1; for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) if (r.masks[i * N + y * lw + x] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        const v = x1 < 0 ? -1 : r.scores[i] + .8 * iou([x0, y0, x1 + 1, y1 + 1], B); if (v > bv) { bv = v; bi = i; } }
    } else { let ba = -1; const top = r.scores[bi]; for (let i = 0; i < n; i++) if (r.scores[i] >= top - .06) { let a = 0; for (let j = i * N; j < (i + 1) * N; j++) if (r.masks[j] > 0) a++; if (a > ba) { ba = a; bi = i; } } }      // نقرة: العنصر كاملاً لا جزءاً منه
    const lo = r.masks.slice(bi * N, (bi + 1) * N); cleanLo(lo, lw, lh);
    return stats({ lo, lw, lh, score: r.scores[bi], obj: r.obj }, S);
  }
  const both = (a, b) => { let c = 0; for (let i = 0; i < a.lo.length; i++) if (a.lo[i] > 0 && b.lo[i] > 0) c++; return c; };
  function unite(a, b, S) { for (let i = 0; i < a.lo.length; i++) if (b.lo[i] > a.lo[i]) a.lo[i] = b.lo[i]; a.parts = (a.parts || 1) + (b.parts || 1); a.det = Math.max(a.det || 0, b.det || 0); stats(a, S); }
  function touching(a, b, r) {
    const { lw, lh } = a, d = new Uint8Array(lw * lh);
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) if (a.lo[y * lw + x] > 0) for (let dy = -r; dy <= r; dy++) { const yy = y + dy; if (yy < 0 || yy >= lh) continue; for (let dx = -r; dx <= r; dx++) { const xx = x + dx; if (xx >= 0 && xx < lw) d[yy * lw + xx] = 1; } }
    for (let i = 0; i < d.length; i++) if (d[i] && b.lo[i] > 0) return true; return false;
  }
  /* إزالة قناع عنصر علوي (ملعقة) من عنصر تحته (صحن) */
  function carve(big, small, S) { for (let i = 0; i < big.lo.length; i++) if (small.lo[i] > 0) big.lo[i] = Math.min(big.lo[i], -small.lo[i]); cleanLo(big.lo, big.lw, big.lh); stats(big, S); }
  const FAM = { "ملعقة": "cut", "سكين": "cut", "شوكة": "cut", "كتاب": "book", "كتب": "book", "دفتر": "book", "كراسة": "book", "مجموعة كتب": "book", "قلم": "pen", "أقلام": "pen", "قلم رصاص": "pen", "أقلام رصاص": "pen" };
  /* تنظيف القائمة: قناع مكرَّر = نفس العنصر (يُدمج)؛ قناع داخل آخر = جزء منه (غطاء/ملصق يُدمج) أو عنصر فوقه (ملعقة على صحن: يُقتطع منه)؛
     ومتشابهات متلاصقة (كتب/أعشاب/أقلام/أجزاء ملعقة) = عنصر واحد، إلا الأشخاص */
  function mergeItems(items, S) {
    const out = [], N = S.lw * S.lh;
    items.forEach(it => {
      if (!it.area || (it.obj < 0 && !it.manual) || (it.score < (it.src === "gemini" ? .35 : .5) && !it.manual)) return; const fr = it.area / N; if (!it.manual && (fr > .62 || fr < .0012)) return;
      const hit = out.find(o => both(o, it) / Math.min(o.area, it.area) > .6); if (!hit) return out.push(it);
      if (both(hit, it) / Math.max(hit.area, it.area) > .5) return unite(hit, it, S);                     // نفس العنصر
      const small = hit.area < it.area ? hit : it, big = small === hit ? it : hit;
      const CONT = /عبوة|كوب|إناء|قارورة|علبة|إبريق|مستحضر/, related = (FAM[small.label] || small.label) === (FAM[big.label] || big.label) || (CONT.test(small.label) && CONT.test(big.label));
      /* عنصر داخل شخص (منتج في اليد) أو من نوع مختلف = عنصر مستقل فوقه يُقتطع منه؛ «الجزء» فقط بين متقاربين (غطاء داخل عبوة) */
      if (PERSON.test(big.label) || !related || (small.det || 0) > (big.det || 0) || (small.src === "gemini" && big.src === "gemini")) { carve(big, small, S); if (it.area) out.push(it); return; }      // عنصر فوق آخر (Gemini لا يذكر أجزاء العناصر)
      const lb = big.label; unite(hit, it, S); hit.label = lb;                                                // جزء من العنصر
    });
    const fam = l => FAM[l] || l;
    for (let again = true; again;) { again = false;
      for (let i = 0; i < out.length && !again; i++) for (let j = i + 1; j < out.length; j++) { const a = out[i], b = out[j]; if (fam(a.label) !== fam(b.label) || PERSON.test(a.label) || a.manual || b.manual) continue; if (touching(a, b, 3)) { const lb = (a.det || 0) >= (b.det || 0) ? a.label : b.label; unite(a, b, S); a.label = lb; out.splice(j, 1); again = true; break; } } }
    out.forEach(it => { if (it.parts > 1 && it.label === "كتاب") it.label = "كتب"; if (it.parts > 1 && it.label === "قلم") it.label = "أقلام"; });
    return out;
  }
  /* تحليل كامل: كشف (Gemini أو محلي) بالتوازي مع ترميز SAM، ثم قناع لكل عنصر */
  async function analyze(cv, o) {
    o = o || {}; const step = o.onStep || (() => { }), prog = progress(step);
    step("⏳ تجهيز نموذج الذكاء…");
    const pS = embed(cv, prog("sam")); pS.catch(() => { });
    /* الكشف المحلي يعمل دائماً (بالتوازي)؛ ومع مفتاح Gemini تتقدّم عناصره (أسماء أدق) ويُكمَّل بما فاته من الكشف المحلي */
    let localErr = null, gem = [], src = "local", note = ""; const pLoc = localDetect(cv, prog("det")).catch(e => { localErr = e; return []; });
    if (o.key) { try { step("⏳ Gemini يتعرّف على العناصر…"); gem = await geminiDetect(cv, o.key); src = "gemini"; } catch (e) { note = e.message; } }
    const loc = await pLoc; if (!gem.length && !loc.length && localErr) throw localErr;
    const dets = gem.concat(loc.filter(d => !gem.some(g => iou(g.box, d.box) > .5)).map(d => gem.length ? Object.assign(d, { score: d.score * .7 }) : d));
    step("⏳ تحليل الصورة…"); const S = await pS, items = [];
    for (let i = 0; i < dets.length; i++) {
      step("⏳ رسم حدود العناصر (" + (i + 1) + "/" + dets.length + ")…"); const d = dets[i], m = await maskFor(S, { box: d.box }); if (!m.area) continue;
      items.push(Object.assign(m, { label: d.label, en: d.en || "", det: d.score, rank: i, src: d.src }));
    }
    const out = mergeItems(items, S); out.forEach((it, i) => { it.id = i; fillHoles(it, out.filter(o => o !== it)); stats(it, S); }); return { S, items: out, src, note, dets };
  }
  /* دمج عناصر يختارها المستخدم في عنصر واحد (يأخذ اسم أكبرها) */
  function joinItems(S, items, list) {
    const a = list.slice().sort((p, q) => q.area - p.area)[0], lb = a.label; list.forEach(b => { if (b === a) return; unite(a, b, S); const i = items.indexOf(b); if (i >= 0) items.splice(i, 1); });
    a.label = lb; a.manual = true; a.v = null; return a;
  }
  /* عنصر يضيفه المستخدم: نقرة (pts) أو مستطيل (box) */
  async function addItem(S, p, items) {
    const m = await maskFor(S, p); if (!m.area) return null; m.manual = true; m.label = p.label || "عنصر"; m.det = 1;
    const hit = items.find(o => both(o, m) / Math.min(o.area, m.area) > .85 && Math.abs(o.area - m.area) / Math.max(o.area, m.area) < .25); if (hit) return hit;
    m.id = Math.max(-1, ...items.map(o => o.id)) + 1; items.push(m); return m;
  }
  /* قيمة القناع عند بكسل كامل (x,y) بالاستيفاء الخطي */
  function sampler(S, it) {
    const { lo, lw, lh } = it, fx = S.fx, fy = S.fy;
    return (x, y) => { let u = (x + .5) * fx - .5, v = (y + .5) * fy - .5; u = Math.max(0, Math.min(lw - 1.001, u)); v = Math.max(0, Math.min(lh - 1.001, v)); const x0 = u | 0, y0 = v | 0, tx = u - x0, ty = v - y0, i = y0 * lw + x0;
      return (lo[i] * (1 - tx) + lo[i + 1] * tx) * (1 - ty) + (lo[i + lw] * (1 - tx) + lo[i + lw + 1] * tx) * ty; };
  }
  /* قناع للعرض بمقياس k (بكسل عرض لكل بكسل أصلي) ← {a, dx, dy, dw, dh} */
  function viewMask(S, it, k) {
    const f = sampler(S, it), dx = Math.floor(it.x0 * k), dy = Math.floor(it.y0 * k), dw = Math.max(2, Math.ceil(it.x1 * k) - dx), dh = Math.max(2, Math.ceil(it.y1 * k) - dy), a = new Uint8Array(dw * dh);
    let ly = -1, sx = 0, nx = 0, cnt = 0, cx = 0, cy = 0;
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) if (f((dx + x + .5) / k, (dy + y + .5) / k) > 0) { a[y * dw + x] = 1; cnt++; cx += x; cy += y; if (ly < 0 || y <= ly + 2) { if (ly < 0) ly = y; sx += x; nx++; } }
    return { a, dx, dy, dw, dh, lx: dx + (nx ? sx / nx : dw / 2), ly: dy + Math.max(0, ly), cx: dx + (cnt ? cx / cnt : dw / 2), cy: dy + (cnt ? cy / cnt : dh / 2) };      // lx/ly: أعلى العنصر (لاسمه)، cx/cy: مركزه
  }
  /* ───── الدقة الكاملة: مرشّح موجَّه (Guided Filter) يلصق حافة القناع بحواف الصورة ───── */
  function boxMean(src, w, h, r) {
    const I = new Float64Array((w + 1) * (h + 1)), o = new Float32Array(w * h);
    for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x++) { s += src[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + s; } }
    for (let y = 0; y < h; y++) { const ya = Math.max(0, y - r), yb = Math.min(h, y + r + 1); for (let x = 0; x < w; x++) { const xa = Math.max(0, x - r), xb = Math.min(w, x + r + 1); o[y * w + x] = (I[yb * (w + 1) + xb] - I[ya * (w + 1) + xb] - I[yb * (w + 1) + xa] + I[ya * (w + 1) + xa]) / ((xb - xa) * (yb - ya)); } }
    return o;
  }
  function guided(I, p, w, h, r, eps) {
    const N = w * h, II = new Float32Array(N), Ip = new Float32Array(N); for (let i = 0; i < N; i++) { II[i] = I[i] * I[i]; Ip[i] = I[i] * p[i]; }
    const mI = boxMean(I, w, h, r), mp = boxMean(p, w, h, r), mII = boxMean(II, w, h, r), mIp = boxMean(Ip, w, h, r), A = new Float32Array(N), B = new Float32Array(N);
    for (let i = 0; i < N; i++) { const a = (mIp[i] - mI[i] * mp[i]) / (mII[i] - mI[i] * mI[i] + eps); A[i] = a; B[i] = mp[i] - a * mI[i]; }
    const mA = boxMean(A, w, h, r), mB = boxMean(B, w, h, r), q = new Float32Array(N); for (let i = 0; i < N; i++) q[i] = mA[i] * I[i] + mB[i]; return q;
  }
  /* ألفا العنصر بالدقة الكاملة داخل نافذته ← {a: Float32Array, x0, y0, w, h} */
  function fullAlpha(S, it, D, opt) {
    opt = opt || {}; const W = S.W, H = S.H, pad = Math.max(4, Math.ceil(1.5 / S.fx)), x0 = Math.max(0, it.x0 - pad), y0 = Math.max(0, it.y0 - pad), x1 = Math.min(W, it.x1 + pad), y1 = Math.min(H, it.y1 + pad), w = x1 - x0, h = y1 - y0, N = w * h;
    const f = sampler(S, it), p = new Float32Array(N), I = new Float32Array(N), Bm = new Uint8Array(N), inv = new Uint8Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, gi = ((y0 + y) * W + x0 + x) * 4, v = f(x0 + x, y0 + y) > 0 ? 1 : 0; Bm[i] = v; inv[i] = 1 - v; p[i] = v; I[i] = (D[gi] * .299 + D[gi + 1] * .587 + D[gi + 2] * .114) / 255; }
    if (opt.refine === false) return { a: p, x0, y0, w, h };
    /* داخل العنصر معتم تماماً وخارجه شفاف؛ الشريط الضيق حول الحدّ فقط يُعاد حسابه بالمرشّح الموجَّه ليلتصق بحافة الصورة */
    const rb = Math.max(2, Math.round(.9 / S.fx)), dil = ImageTools.sqDilate(Bm, w, h, rb), ero = ImageTools.sqDilate(inv, w, h, rb), q = guided(I, p, w, h, rb, opt.eps || 4e-4), a = new Float32Array(N);
    for (let i = 0; i < N; i++) { if (!(dil[i] && ero[i])) { a[i] = Bm[i]; continue; } const v = (q[i] - .5) * 1.6 + .5; a[i] = v < .06 ? 0 : v > .94 ? 1 : v; }
    return { a, x0, y0, w, h };
  }
  /* ظل العنصر على خلفية ناعمة (تصاميم المنتجات): تعتيم محايد اللون قرب العنصر ← أسود شفاف. الصور الفوتوغرافية (خلفية بملمس) بلا ظل */
  function shadowOf(S, A, D, others) {
    const W = S.W, H = S.H, R = Math.max(10, Math.min(70, Math.round(Math.max(A.w, A.h) * .14))), x0 = Math.max(0, A.x0 - R), y0 = Math.max(0, A.y0 - R), x1 = Math.min(W, A.x0 + A.w + R), y1 = Math.min(H, A.y0 + A.h + R), w = x1 - x0, h = y1 - y0;
    const inA = (x, y) => { const lx = x - A.x0, ly = y - A.y0; return lx >= 0 && ly >= 0 && lx < A.w && ly < A.h ? A.a[ly * A.w + lx] : 0; };
    const obj = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inA(x0 + x, y0 + y) > .3) obj[y * w + x] = 1;
    const near = ImageTools.sqDilate ? ImageTools.sqDilate(obj, w, h, R) : obj, ring = [];
    const isOther = (x, y) => others.some(o => { const lx = x - o.x0, ly = y - o.y0; return lx >= 0 && ly >= 0 && lx < o.w && ly < o.h && o.a[ly * o.w + lx] > .3; });
    const st = Math.max(1, Math.floor(Math.sqrt(w * h / 4000)));
    for (let y = 0; y < h; y += st) for (let x = 0; x < w; x += st) { if (!near[y * w + x] || obj[y * w + x]) continue; const gi = ((y0 + y) * W + x0 + x) * 4; ring.push([x, y, D[gi], D[gi + 1], D[gi + 2]]); }
    if (ring.length < 40) return null;
    const pl = [0, 1, 2].map(c => ImageTools.fitPlane(ring.filter((q, i) => i % 2 === 0 || ring.length < 400), c)), at = (x, y, c) => pl[c][0] + pl[c][1] * x + pl[c][2] * y;
    const res = ring.map(q => Math.abs(q[2] - at(q[0], q[1], 0)) + Math.abs(q[3] - at(q[0], q[1], 1)) + Math.abs(q[4] - at(q[0], q[1], 2))).sort((a, b) => a - b), med = res[res.length >> 1];
    if (med > 10) return null;                                          // خلفية بملمس (صورة فوتوغرافية) ← بلا استخراج ظل
    const s = new Float32Array(w * h); let cnt = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!near[i] || obj[i]) continue; const gx = x0 + x, gy = y0 + y, gi = (gy * W + gx) * 4, rr = [0, 1, 2].map(c => D[gi + c] / Math.max(1, at(x, y, c))), m = (rr[0] + rr[1] + rr[2]) / 3;
      if (m < .96 && Math.max(...rr) - Math.min(...rr) < .09 && !isOther(gx, gy)) { s[i] = Math.min(.85, 1 - m); cnt++; } }
    return cnt > 20 ? { s, x0, y0, w, h } : null;
  }
  /* قصّ العناصر المختارة: الأمامي (أسفل الصورة) يحتفظ بالبكسلات المشتركة. يعيد [{canvas, x0, y0, w, h, label, front, erase:{m,x0,y0,w,h}}] */
  function cutouts(S, cv, chosen, opt) {
    opt = opt || {}; const W = S.W, H = S.H, D = cv.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const order = chosen.slice().sort((a, b) => b.y1 - a.y1 || a.area - b.area), A = order.map(it => fullAlpha(S, it, D, opt)), out = [];
    order.forEach((it, n) => {
      const a = A[n], m = new Float32Array(a.a); for (let q = 0; q < n; q++) { const b = A[q]; for (let y = Math.max(a.y0, b.y0); y < Math.min(a.y0 + a.h, b.y0 + b.h); y++) for (let x = Math.max(a.x0, b.x0); x < Math.min(a.x0 + a.w, b.x0 + b.w); x++) { const v = b.a[(y - b.y0) * b.w + x - b.x0]; if (v > 0) { const i = (y - a.y0) * a.w + x - a.x0; m[i] *= 1 - v; } } }
      const sh = opt.shadow === false ? null : shadowOf(S, a, D, A.filter((_, q) => q !== n)), X0 = sh ? sh.x0 : a.x0, Y0 = sh ? sh.y0 : a.y0, w = sh ? sh.w : a.w, h = sh ? sh.h : a.h;
      const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"), im = g.createImageData(w, h), er = new Uint8Array(w * h); let px = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const gx = X0 + x, gy = Y0 + y, i = y * w + x, lx = gx - a.x0, ly = gy - a.y0, al = lx >= 0 && ly >= 0 && lx < a.w && ly < a.h ? m[ly * a.w + lx] : 0, gi = (gy * W + gx) * 4;
        if (al > .02) { im.data[i * 4] = D[gi]; im.data[i * 4 + 1] = D[gi + 1]; im.data[i * 4 + 2] = D[gi + 2]; im.data[i * 4 + 3] = Math.round(al * 255); if (al > .08) er[i] = 1; px++; continue; }
        const sv = sh ? sh.s[i] : 0; if (sv > .03) { im.data[i * 4 + 3] = Math.round(sv * 255); er[i] = 1; }
      }
      g.putImageData(im, 0, 0); out.push({ canvas: c, x0: X0, y0: Y0, w, h, label: it.label, front: order.length - 1 - n, item: it, erase: { m: er, x0: X0, y0: Y0, w, h }, px });
    });
    return out;
  }
  /* مسح العناصر من الخلفية: قناع موحّد موسَّع قليلاً ← ترميم محلي (أو Gemini إن مُرِّر gen) */
  function unionMask(W, H, cuts, grow) {
    const U = new Uint8Array(W * H); cuts.forEach(c => { const e = c.erase; for (let y = 0; y < e.h; y++) for (let x = 0; x < e.w; x++) if (e.m[y * e.w + x]) U[(e.y0 + y) * W + e.x0 + x] = 1; });
    return grow > 0 && ImageTools.sqDilate ? ImageTools.sqDilate(U, W, H, grow) : U;
  }
  async function eraseBg(base, cuts, opt) {
    opt = opt || {}; const W = base.width, H = base.height, g = base.getContext("2d", { willReadFrequently: true }), U = unionMask(W, H, cuts, opt.grow == null ? Math.max(3, Math.round(Math.max(W, H) / 450)) : opt.grow);
    if (opt.gen) { try { await inpaintAI(base, U, opt.gen); return "ai"; } catch (e) { console.warn("ai fill", e); if (opt.onNote) opt.onNote(e.message); } }
    let X0 = W, Y0 = H, X1 = -1, Y1 = -1; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (U[y * W + x]) { if (x < X0) X0 = x; if (x > X1) X1 = x; if (y < Y0) Y0 = y; if (y > Y1) Y1 = y; }
    if (X1 < 0) return "none";
    if (opt.local !== false) { try { await inpaintLocal(base, U, [X0, Y0, X1, Y1], opt.onStep); return "model"; } catch (e) { console.warn("migan", e); if (opt.onNote) opt.onNote(e.message); } }
    const pad = Math.max(24, Math.round(Math.max(X1 - X0, Y1 - Y0) * .06)), x0 = Math.max(0, X0 - pad), y0 = Math.max(0, Y0 - pad), x1 = Math.min(W, X1 + 1 + pad), y1 = Math.min(H, Y1 + 1 + pad), w = x1 - x0, h = y1 - y0, m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = U[(y0 + y) * W + x0 + x]; ImageTools.fillMask(g, x0, y0, w, h, m);
    return "local";
  }
  /* ترميم بنموذج محلي (MI-GAN) داخل العامل: كل مجموعة مناطق متقاربة على حدة (دقة أعلى لكل ثقب) بنافذة سياق حولها،
     ثم دمج الناتج داخل القناع فقط بحافة ناعمة */
  function regions(Ug, W, H) {
    const q = 8, gw = Math.ceil(W / q), gh = Math.ceil(H / q), G = new Uint8Array(gw * gh); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Ug[y * W + x]) G[((y / q) | 0) * gw + ((x / q) | 0)] = 1;
    const seen = new Uint8Array(gw * gh), boxes = [];
    for (let s0 = 0; s0 < gw * gh; s0++) { if (!G[s0] || seen[s0]) continue; const st = [s0]; seen[s0] = 1; const b = [gw, gh, -1, -1];
      while (st.length) { const j = st.pop(), x = j % gw, y = (j / gw) | 0; b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy, t = yy * gw + xx; if (xx >= 0 && yy >= 0 && xx < gw && yy < gh && G[t] && !seen[t]) { seen[t] = 1; st.push(t); } } }
      boxes.push([b[0] * q, b[1] * q, Math.min(W - 1, (b[2] + 1) * q), Math.min(H - 1, (b[3] + 1) * q)]); }
    const near = (a, c) => { const m = Math.max(24, .15 * Math.max(a[2] - a[0], c[2] - c[0])); return a[0] - m < c[2] && c[0] - m < a[2] && a[1] - m < c[3] && c[1] - m < a[3]; };
    for (let again = true; again;) { again = false; for (let i = 0; i < boxes.length && !again; i++) for (let j = i + 1; j < boxes.length; j++) if (near(boxes[i], boxes[j])) { const a = boxes[i], c = boxes[j]; boxes[i] = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[2]), Math.max(a[3], c[3])]; boxes.splice(j, 1); again = true; break; } }
    return boxes.sort((a, c) => (a[2] - a[0]) * (a[3] - a[1]) - (c[2] - c[0]) * (c[3] - c[1]));
  }
  async function inpaintLocal(base, U, bb, onStep) {
    const W = base.width, H = base.height, g = base.getContext("2d", { willReadFrequently: true }), R = Math.max(4, Math.round(Math.max(W, H) / 180)), Ug = ImageTools.sqDilate(U, W, H, R), prog = progress(onStep || (() => { }));
    for (const rb of regions(Ug, W, H)) {
      const cx = Math.round(Math.max(rb[2] - rb[0], rb[3] - rb[1]) * .5) + 32, x0 = Math.max(0, rb[0] - cx), y0 = Math.max(0, rb[1] - cx), x1 = Math.min(W, rb[2] + 1 + cx), y1 = Math.min(H, rb[3] + 1 + cx), w = x1 - x0, h = y1 - y0;
      const img = g.getImageData(x0, y0, w, h), m = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = Ug[(y0 + y) * W + x0 + x];
      const r = await worker("det").call("inpaint", { data: img.data.buffer.slice(0), mask: m.buffer.slice(0), w, h }, prog("migan")), G = r.masks, soft = boxMean(Float32Array.from(m), w, h, 3);
      for (let i = 0; i < w * h; i++) { if (!m[i]) continue; const f = U[(y0 + ((i / w) | 0)) * W + x0 + (i % w)] ? 1 : Math.min(1, soft[i] * 1.4); for (let k = 0; k < 3; k++) img.data[i * 4 + k] = Math.round(img.data[i * 4 + k] * (1 - f) + G[i * 4 + k] * f); }
      g.putImageData(img, x0, y0);
    }
  }
  /* ملء بالذكاء الاصطناعي: نلوّن المنطقة بالأرجواني ونطلب إكمال الخلفية، ثم نأخذ بكسلات الناتج داخل المنطقة فقط (بحافة ناعمة) */
  async function inpaintAI(base, U, gen) {
    const W = base.width, H = base.height, s = Math.min(1, 1536 / Math.max(W, H)), w = Math.round(W * s), h = Math.round(H * s), c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(base, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (U[Math.min(H - 1, Math.round((y + .5) / s)) * W + Math.min(W - 1, Math.round((x + .5) / s))]) { const i = (y * w + x) * 4; d.data[i] = 255; d.data[i + 1] = 0; d.data[i + 2] = 255; } g.putImageData(d, 0, 0);
    const parts = [{ text: "Edit this image: the areas painted solid magenta (#FF00FF) are holes where objects were removed. Fill ONLY the magenta areas with a realistic continuation of the surrounding background (walls, table, fabric, gradient, lighting and perspective), as if those objects were never there. Do not add any new object, person, text or logo. Keep every non-magenta pixel exactly the same, with the same framing and size. Return only the edited image." }, { inline_data: { mime_type: "image/png", data: c.toDataURL("image/png").split(",")[1] } }];
    const j = await gen(parts), pt = ((((j.candidates || [])[0] || {}).content || {}).parts || []).find(x => x.inlineData || x.inline_data), dd = pt && (pt.inlineData || pt.inline_data); if (!dd) throw new Error("لم يُرجع Gemini صورة للملء");
    const bin = atob(dd.data), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const im = await createImageBitmap(new Blob([arr], { type: dd.mimeType || dd.mime_type || "image/png" })); if (Math.abs(im.width / im.height - W / H) > .04 * (W / H)) throw new Error("أبعاد صورة الملء لا تطابق الأصل");
    const t = document.createElement("canvas"); t.width = W; t.height = H; const tg = t.getContext("2d", { willReadFrequently: true }); tg.drawImage(im, 0, 0, W, H); const G = tg.getImageData(0, 0, W, H).data;
    const R = Math.max(2, Math.round(Math.max(W, H) / 500)), soft = ImageTools.sqDilate(U, W, H, R), bd = base.getContext("2d", { willReadFrequently: true }), B = bd.getImageData(0, 0, W, H); let mag = 0, tot = 0;
    const blur = boxMean(Float32Array.from(soft), W, H, R);
    for (let i = 0; i < W * H; i++) { if (!soft[i]) continue; const f = U[i] ? 1 : Math.min(1, blur[i] * 1.5), j4 = i * 4; if (U[i]) { tot++; if (G[j4] > 200 && G[j4 + 1] < 60 && G[j4 + 2] > 200) mag++; } for (let k = 0; k < 3; k++) B.data[j4 + k] = Math.round(B.data[j4 + k] * (1 - f) + G[j4 + k] * f); }
    if (tot && mag / tot > .03) throw new Error("لم يملأ Gemini المنطقة");
    bd.putImageData(B, 0, 0);
  }
  /* خطوط الحدود للعرض: حافة القناع ← قماش بنفسجي + تعبئة شفافة */
  function overlays(v, rgb) {
    const { a, dw, dh } = v, o = new Uint8Array(dw * dh), O = 2;
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) { if (a[y * dw + x]) continue; let near = false; for (let dy = -O; dy <= O && !near; dy++) for (let dx = -O; dx <= O; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < dw && yy < dh && a[yy * dw + xx]) { near = true; break; } } if (near) o[y * dw + x] = 1; }
    const mk = fn => { const c = document.createElement("canvas"); c.width = dw; c.height = dh; const g = c.getContext("2d"), im = g.createImageData(dw, dh); for (let i = 0; i < dw * dh; i++) { const al = fn(i); if (al) { im.data[i * 4] = rgb[0]; im.data[i * 4 + 1] = rgb[1]; im.data[i * 4 + 2] = rgb[2]; im.data[i * 4 + 3] = al; } } g.putImageData(im, 0, 0); return c; };
    return { out: mk(i => o[i] ? 255 : 0), fill: mk(i => a[i] ? 85 : 0) };
  }
  function warm() { try { worker("sam").call("load", { sam: true }).catch(() => { }); worker("det").call("load", { det: ["coco", "o365"] }).catch(() => { }); } catch (e) { } }
  return { supported, analyze, addItem, joinItems, viewMask, overlays, cutouts, eraseBg, inpaintAI, localDetect, geminiDetect, warm };
})();
