/* الرؤية الذكية (مشترك: منشئ الصفحات، ولاحقاً المحرر): «التقاط العناصر» مثل الالتقاط السحري في Canva، ويعمل بلا مفتاح.
   ① الكشف: Gemini إن وُجد مفتاح المولّد (أسماء عربية وتجميع ذكي)، وإلا نموذجان محليان داخل المتصفح (D-FINE على COCO وObjects365).
   ② الحدود: SAM 2.1 يرسم قناع كل عنصر بدقة البكسل من صندوقه، أو من نقرة/مستطيل يرسمه المستخدم لعنصر فاته الكشف،
      ثم «مرشّح موجَّه» يلصق الحافة بحواف الصورة الأصلية بدقتها الكاملة.
   ③ القصّ: صورة شفافة لكل عنصر (+ ظلّه إن كانت خلفيته ناعمة)، وإعادة رسم مكانه في الخلفية بنموذج MI-GAN محلي (أو Gemini إن فعّله المستخدم).
   Gemini اختياري ومُطفأ افتراضياً. النماذج تعمل في Web Worker (ai-vision-worker.js) فلا تتجمد الصفحة، وتُنزَّل مرة واحدة (~110MB) ثم تُحفظ في ذاكرة المتصفح. */
window.AIVision = (function () {
  const BASE = (document.currentScript && document.currentScript.src) || location.href, WURL = new URL("ai-vision-worker.js?v=19", BASE).href;
  const SAMSZ = 1024, DETSZ = 736, W8 = {};      // 736 بدل 960: كشف أسرع بنحو الضعف بلا فقد يُذكر لعناصر بحجم مفيد
  let seq = 0, curS = null;
  /* ───── العمّال: عامل للقصّ (SAM) وآخر للكشف يعملان بالتوازي ───── */
  function mkWorker(kind) {
    const w = new Worker(WURL, { type: "module" }), P = new Map(); let ok, ko; const ready = new Promise((r, j) => { ok = r; ko = j; }); ready.catch(() => { });
    const t = setTimeout(() => die(new Error("انتهت مهلة تحميل أداة القص (الإنترنت بطيء؟)")), 120000);
    function die(err) { clearTimeout(t); if (W8[kind] === w) delete W8[kind]; try { w.terminate(); } catch (e) { } ko(err); P.forEach(p => p.rej(err)); P.clear(); }
    w.onmessage = e => { const d = e.data || {}; if (d.ready) { clearTimeout(t); return ok(); } const p = P.get(d.id); if (!p) return; if (d.progress) return p.onp && p.onp(d.progress); P.delete(d.id); d.ok ? p.res(d.r) : p.rej(new Error(d.err)); };
    w.onerror = e => { if (e.preventDefault) e.preventDefault(); die(new Error("تعذّر تشغيل أداة القص داخل المتصفح — تحقّق من الإنترنت" + (e.message ? " (" + e.message + ")" : ""))); };
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
    return what => p => { files[what + p.file] = [p.loaded, p.total]; const v = Object.values(files), L = v.reduce((s, x) => s + x[0], 0), T = v.reduce((s, x) => s + x[1], 0), now = Date.now(); if (now - last < 250 && L < T) return; last = now; step(T > 1048576 ? "⏳ تنزيل ملفات أداة القص (مرة واحدة فقط) " + Math.round(L / 1048576) + " / " + Math.round(T / 1048576) + "MB" : "⏳ تجهيز أداة القص…"); };
  }
  /* خريطة عمق نسبية (أكبر = أقرب) لصورة بحجم ≤640 ← {w,h,data} */
  const DC = new Map();      // ذاكرة قصيرة لخرائط العمق (للتحضير المسبق)
  function depth(cv, onp, max) {
    let key = ""; try { key = fingerprint(cv) + "|" + (max || 518); } catch (e) { } if (key && DC.has(key)) return DC.get(key);
    const im = pix(cv, max || 518), p = worker("dep").call("depth", { data: im.data, w: im.w, h: im.h }, onp, [im.data]);
    if (key) { DC.set(key, p); if (DC.size > 3) DC.delete(DC.keys().next().value); p.catch(() => DC.delete(key)); } return p;
  }
  /* ───── الكشف ───── */
  const AR = { globe: "مجسم الكرة الأرضية", "pencil case": "مقلمة", person: "شخص", book: "كتاب", spoon: "ملعقة", "pen/pencil": "قلم", marker: "قلم", plate: "صحن", bowl: "صحن", "bowl/basin": "وعاء", "tea pot": "إبريق", kettle: "إبريق", jug: "إبريق", bottle: "عبوة", cup: "كوب", vase: "إناء", "wine glass": "كأس", fork: "شوكة", knife: "سكين", "cell phone": "هاتف", laptop: "حاسوب", clock: "ساعة", "potted plant": "نبتة", pottedplant: "نبتة", flower: "زهور", "green vegetables": "أعشاب", apple: "تفاح", orange: "برتقال", "orange/tangerine": "برتقال", banana: "موز", lemon: "ليمون", garlic: "ثوم", nuts: "مكسرات", bread: "خبز", cake: "كعكة", cookies: "بسكويت", dessert: "حلوى", cosmetics: "مستحضر", toiletry: "عبوة", canned: "علبة", "storage box": "علبة", basket: "سلة", handbag: "حقيبة", "handbag/satchel": "حقيبة", backpack: "حقيبة", luggage: "حقيبة", "teddy bear": "دمية", "stuffed toy": "دمية", candle: "شمعة", "cutting/chopping board": "لوح تقطيع", scissors: "مقص", "paint brush": "فرشاة", brush: "فرشاة", "pencil case": "مقلمة", notepaper: "ورقة", folder: "ملف", towel: "منشفة", dog: "كلب", cat: "قطة", bird: "طائر", "wild bird": "طائر", horse: "حصان", carrot: "جزر", broccoli: "بروكلي", tomato: "طماطم", pepper: "فلفل", egg: "بيض", mushroom: "فطر", flask: "قارورة", "barrel/bucket": "دلو", lantern: "فانوس", lamp: "مصباح", tablet: "لوحي", camera: "كاميرا", "head phone": "سماعة", remote: "جهاز تحكم", keyboard: "لوحة مفاتيح", mouse: "فأرة", umbrella: "مظلة", "sports ball": "كرة", soap: "صابون", lipstick: "أحمر شفاه", comb: "مشط", "hair dryer": "مجفف شعر", toothbrush: "فرشاة أسنان", strawberry: "فراولة", grape: "عنب", pear: "إجاص", peach: "خوخ", pomegranate: "رمان", watermelon: "بطيخ", "kiwi fruit": "كيوي", mango: "مانجو", coconut: "جوز الهند", avocado: "أفوكادو", cucumber: "خيار", onion: "بصل", potato: "بطاطا", lettuce: "خس", cheese: "جبن" };
  const DROP = new Set(["dining table", "diningtable", "dinning table", "couch", "sofa", "chair", "bed", "bench", "toilet", "sink", "refrigerator", "oven", "tv", "tvmonitor", "monitor/tv", "desk", "coffee table", "side table", "cabinet/shelf", "nightstand", "stool", "pillow", "carpet", "picture/frame", "mirror", "ring", "necklace", "bracelet", "glasses", "hat", "watch", "belt", "tie", "bow tie", "mask", "gloves", "other shoes", "sneakers", "boots", "leather shoes", "sandals", "slippers", "high heels", "power outlet", "air conditioner", "radiator", "faucet", "awning", "street lights", "traffic light", "traffic sign", "stop sign", "speed limit sign", "crosswalk sign", "trash bin can", "bathtub", "blackboard/whiteboard", "carriage", "extension cord", "converter"]);
  const PRODUCT = /bottle|cup|vase|jug|tea pot|kettle|canned|cosmetics|toiletry|storage box|flask|bowl|plate|basket|barrel|soap|lipstick/i;
  const PERSON = /^(شخص|رجل|امرأة|إمرأة|سيدة|طفل|طفلة|ولد|بنت|فتاة|شاب|أم|أب|جدة|جد|person|man|woman|child|boy|girl|people)/i;
  const arName = en => AR[en] || en;
  const bArea = b => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]), bInter = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const iou = (a, b) => { const i = bInter(a, b); return i / Math.max(1, bArea(a) + bArea(b) - i); };
  async function localDetect(cv, onp, zone, lite) {
    const im = pix(cv, lite ? 640 : DETSZ), W = cv.width, H = cv.height, K = 1 / im.k;
    /* نموذجا الكشف (COCO وObjects365) في عاملين متوازيين بدل التتابع */
    const [r1, r2] = await Promise.all([worker("det").call("detect", { data: lite ? im.data : im.data.slice(0), w: im.w, h: im.h, thr: .1, models: ["coco"] }, onp), lite ? Promise.resolve([]) : worker("det2").call("detect", { data: im.data, w: im.w, h: im.h, thr: .1, models: ["o365"] }, onp, [im.data])]), raw = r1.concat(r2);      // الهاتف («خفيف»): نموذج COCO وحده بدقة أقل
    const all = raw.map(d => ({ src: d.src, en: String(d.label).toLowerCase(), score: d.score, b: d.box.map((v, i) => Math.max(0, Math.min(i % 2 ? H : W, v * K))) }));
    const o365 = all.filter(d => d.src === "o365");
    all.forEach(d => { if (d.src !== "coco") return; let bi = .45; o365.forEach(q => { const v = iou(d.b, q.b); if (v > bi) { bi = v; d.en2 = q.en; } }); });      // اسم Objects365 أدق (قلم بدل «سكين»، صحن بدل «وعاء»)
    const c = all.filter(d => { const en = d.en2 || d.en, a = bArea(d.b); if (DROP.has(en) || DROP.has(d.en)) return false; if ((!zone && a > W * H * .85) || a < W * H * .0012) return false; return d.score >= (PRODUCT.test(en) || en === "person" ? .2 : .3); });
    c.sort((p, q) => q.score - p.score); const keep = [];
    const per = {}; c.forEach(d => { const en = d.en2 || d.en; if ((per[en] || 0) >= (PRODUCT.test(en) ? 8 : 6)) return; if (!keep.some(k => iou(k.b, d.b) > .6 || ((k.en2 || k.en) === en && bInter(k.b, d.b) / Math.max(1, bArea(d.b)) > .85))) { keep.push(d); per[en] = (per[en] || 0) + 1; } });      // لا يستأثر صنف واحد (كتب كثيرة) بكل الأماكن
    const persons = keep.filter(k => (k.en2 || k.en) === "person"), held = d => persons.some(p => bInter(p.b, d.b) / Math.max(1, bArea(d.b)) > .8);      // وعاء/كوب في يد شخص = منتج (عبوة)
    return keep.slice(0, lite ? 10 : 18).map(d => ({ label: /^(cup|vase|bottle|jug|canned|cosmetics|toiletry)$/.test(d.en2 || d.en) && ((d.b[3] - d.b[1]) > (d.b[2] - d.b[0]) * 1.1 || held(d)) ? "عبوة" : arName(d.en2 || d.en), en: d.en2 || d.en, score: d.score, box: d.b, src: d.src }));
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
  async function embed(cv, onp) { const im = pix(cv, SAMSZ), S = { W: cv.width, H: cv.height, k: im.k, sw: im.w, sh: im.h }; const r = await worker("sam").call("embed", { data: im.data, w: im.w, h: im.h }, onp, [im.data]), rs = (r && r.rs) || [SAMSZ, SAMSZ]; S.dev = (r && r.dev) || "wasm"; S.lw = S.lh = 256; S.rs = rs; S.fx = S.k * (rs[1] / S.sw) * (256 / SAMSZ); S.fy = S.k * (rs[0] / S.sh) * (256 / SAMSZ); curS = S; return S; }
  function cleanLo(lo, lw, lh) {                                     // إزالة الجزر الصغيرة البعيدة (تشويش) والإبقاء على أجزاء العنصر الحقيقية
    const lab = new Int32Array(lw * lh), sizes = [0], st = []; let n = 0;
    for (let i = 0; i < lw * lh; i++) { if (lo[i] <= 0 || lab[i]) continue; n++; let c = 0; st.push(i); lab[i] = n; while (st.length) { const j = st.pop(), x = j % lw; c++; for (const q of [j - 1, j + 1, j - lw, j + lw]) { if (q < 0 || q >= lw * lh || (q === j - 1 && x === 0) || (q === j + 1 && x === lw - 1) || lo[q] <= 0 || lab[q]) continue; lab[q] = n; st.push(q); } } sizes.push(c); }
    const big = Math.max(0, ...sizes); for (let i = 0; i < lw * lh; i++) if (lab[i] && sizes[lab[i]] < Math.max(12, big * .04)) lo[i] = -8;
  }
  /* سدّ الثقوب الصغيرة داخل العنصر (عيون/ظلال على الوجه) مع إبقاء الفراغات الحقيقية (مقبض كوب، ما بين الذراع والجسم) وما يشغله عنصر آخر (قلم في اليد) */
  const SOLID = /عبوة|كوب|إناء|قارورة|علبة|إبريق|مستحضر|منتج|صابون|شمعة|كتاب|كتب|صحن|وعاء/;      // أشياء صلبة: صورتها الخارجية كاملة (الملصق والكتابة جزء منها)
  function fillHoles(it, others) {
    const { lo, lw, lh } = it, N = lw * lh, seen = new Uint8Array(N), solid = it.manual || it.zoneMain || SOLID.test(it.label || ""); let area = 0; for (let i = 0; i < N; i++) if (lo[i] > 0) area++; const lim = solid ? Infinity : Math.max(6, area * .012);
    for (let s = 0; s < N; s++) { if (lo[s] > 0 || seen[s]) continue; const comp = [s]; seen[s] = 1; let edge = false;
      for (let q = 0; q < comp.length; q++) { const j = comp[q], x = j % lw, y = (j / lw) | 0; if (x === 0 || y === 0 || x === lw - 1 || y === lh - 1) edge = true; for (const t of [x > 0 ? j - 1 : -1, x < lw - 1 ? j + 1 : -1, y > 0 ? j - lw : -1, y < lh - 1 ? j + lw : -1]) if (t >= 0 && !seen[t] && lo[t] <= 0) { seen[t] = 1; comp.push(t); } }
      if (edge || comp.length > lim) continue;
      if (solid) { comp.forEach(j => { if (!others.some(o => o.lo[j] > 0)) lo[j] = 4; }); continue; }      // كل الثقوب تُسدّ إلا ما يغطيه عنصر أمامه (الأصابع)
      const occ = comp.filter(j => others.some(o => o.lo[j] > 0)).length; if (occ < comp.length * .3) comp.forEach(j => { lo[j] = 4; }); }
    if (solid) closeLo(it, others, 2);
  }
  /* إغلاق مورفولوجي (توسيع ثم تآكل) يملأ التعرّجات والشقوق في حافة الشيء الصلب، دون أن يأخذ بكسلات عنصر أمامه (أصابع اليد) */
  function closeLo(it, others, r) {
    const { lo, lw, lh } = it, N = lw * lh, B = new Uint8Array(N); for (let i = 0; i < N; i++) B[i] = lo[i] > 0 ? 1 : 0;
    const D = ImageTools.sqDilate(B, lw, lh, r), inv = new Uint8Array(N); for (let i = 0; i < N; i++) inv[i] = D[i] ? 0 : 1;
    const E = ImageTools.sqDilate(inv, lw, lh, r); for (let i = 0; i < N; i++) if (!B[i] && !E[i] && !others.some(o => o.lo[i] > 0)) lo[i] = 3;
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
    } else { let ba = -1; const top = r.scores[bi]; for (let i = 0; i < n; i++) if (r.scores[i] >= Math.max(.5, top - (p.whole ? .25 : .06))) { let a = 0; for (let j = i * N; j < (i + 1) * N; j++) if (r.masks[j] > 0) a++; if (p.whole && a > N * .45) continue; if (a > ba) { ba = a; bi = i; } } }      // نقرة: العنصر كاملاً لا جزءاً منه
    const lo = r.masks.slice(bi * N, (bi + 1) * N); cleanLo(lo, lw, lh);
    return stats({ lo, lw, lh, score: r.scores[bi], obj: r.obj }, S);
  }
  const both = (a, b) => { let c = 0; for (let i = 0; i < a.lo.length; i++) if (a.lo[i] > 0 && b.lo[i] > 0) c++; return c; };
  function unite(a, b, S) { for (let i = 0; i < a.lo.length; i++) if (b.lo[i] > a.lo[i]) a.lo[i] = b.lo[i]; a.parts = (a.parts || 1) + (b.parts || 1); a.poly = null; a.zone = false; a.det = Math.max(a.det || 0, b.det || 0); stats(a, S); }
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
      if (!it.area || (it.obj < 0 && !it.manual) || (it.score < (it.src === "gemini" ? .35 : .5) && !it.manual)) return; const fr = it.area / N; if (!it.manual && ((fr > .62 && !it.zoneMain) || fr < .0012)) return;
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
  /* ذاكرة التحليل: إعادة فتح الأداة على الصورة نفسها (والترميز ما زال في العامل) تعيد النتيجة فوراً بلا ترميز ولا كشف ولا أقنعة */
  let AC = null;
  const fingerprint = cv => { const g = cv.getContext("2d", { willReadFrequently: true }), W = cv.width, H = cv.height; let h = 2166136261; for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) { const d = g.getImageData(Math.min(W - 1, Math.floor((i + .5) * W / 12)), Math.min(H - 1, Math.floor((j + .5) * H / 12)), 1, 1).data; for (let k = 0; k < 3; k++) h = Math.imul(h ^ d[k], 16777619); } return W + "x" + H + ":" + (h >>> 0); };
  const cloneItems = list => { const m = new Map(), out = list.map(it => { const c = {}; for (const k in it) { const v = it[k]; c[k] = ArrayBuffer.isView(v) ? v.slice() : Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : v; } m.set(it, c); return c; }); out.forEach(c => { if (c.holder) c.holder = m.get(c.holder) || null; }); return out; };
  /* تحليل كامل: كشف (Gemini أو محلي) بالتوازي مع ترميز SAM، ثم قناع لكل عنصر */
  const fpOf = (cv, o) => { try { return fingerprint(cv) + "|" + (o.zone ? JSON.stringify(o.zone) : "") + "|" + (o.noDetect ? 1 : 0) + "|" + (o.lite ? 1 : 0) + "|" + (o.noHeld ? 1 : 0) + "|" + (o.maxItems || 0) + "|" + (o.fastDet ? 1 : 0); } catch (e) { return ""; } };
  let INF = null;      /* تحليل جارٍ لصورة بعينها (تحضير مسبق في الخلفية): طلب مماثل ينتظره بدل أن يكرّره فيتلف حالة SAM */
  function cachedFor(cv, o) { const fp = fpOf(cv, o || {}); return !!fp && ((AC && AC.fp === fp && curS === AC.S) || (INF && INF.fp === fp)); }
  async function analyze(cv, o) {
    o = o || {}; const fp0 = fpOf(cv, o);
    if (fp0 && INF && INF.fp === fp0) { (o.onStep || (() => { }))("⏳ إكمال التحليل الجاري…"); const r = await INF.p; return Object.assign({}, r, { items: cloneItems(r.items) }); }
    const p = analyze0(cv, o); if (fp0) { INF = { fp: fp0, p }; const done = () => { if (INF && INF.p === p) INF = null; }; p.then(done, done); } return p;
  }
  async function analyze0(cv, o) {
    o = o || {}; const step = o.onStep || (() => { }), prog = progress(step);
    let fp = fpOf(cv, o);
    if (fp && AC && AC.fp === fp && curS === AC.S) { step("⚡ استُعيد التحليل المحلي المحفوظ لهذه الصورة"); return { S: AC.S, items: cloneItems(AC.items), src: "local", note: "", dets: AC.dets, later: null }; }
    step("⏳ تجهيز أداة القص…");
    const pS = embed(cv, prog("sam")); pS.catch(() => { });
    /* المسار المحلي فقط: لا تُرسل الصورة إلى Gemini أو أي خدمة خارجية. */
    let localErr = null, src = "local", note = "";
    const later = o.noDetect ? localDetect(cv, () => { }, false).catch(() => []) : null;
    const pLoc = o.noDetect ? Promise.resolve([]) : localDetect(cv, prog("det"), o.zone, o.lite || o.fastDet).catch(e => { localErr = e; return []; });
    const loc = (await pLoc).filter(d => !(o.skip || []).includes(d.label));
    if (!loc.length && localErr) throw localErr;
    const dets = loc;
    if (o.zone) {                                                     // «منطقة»: ما رسمه المستخدم حول العنصر هو صندوقه (الأدق)، واسمه من أكبر كشف محلي يطابقه
      const W = cv.width, H = cv.height, m = o.zone.margin || 0, zb = [W * m, H * m, W * (1 - m), H * (1 - m)], best = dets.filter(d => d.label && !PERSON.test(d.label)).sort((a, b) => iou(b.box, zb) - iou(a.box, zb))[0];
      dets.unshift({ label: best && iou(best.box, zb) > .3 ? best.label : "عنصر", score: 1.01, box: zb, src: "zone", zoneMain: true });
    }
    step("⏳ تحليل الصورة…"); const S = await pS, items = [];
    /* بعد ترميز SAM مرة واحدة، طلبات الأقنعة مستقلة؛ ننفذ اثنتين معاً لتقليل زمن الانتظار
       مع إبقاء ترتيب النتائج ثابتاً حتى لا تتغير أولوية الدمج/التعارض. */
    const maskJobs = (o.maxItems ? dets.slice(0, o.maxItems) : dets).map((d, i) => ({ d, i }));
    const masked = new Array(maskJobs.length); let nextMask = 0;
    const workers = 1;      /* متتابعة: عامل SAM يحمل حالة طلب واحد، والتوازي يتلف المدخلات فتفشل كل الأقنعة (أخطاء input_points/input_boxes) */
    await Promise.all(Array.from({ length: workers }, async () => {
      while (true) {
        const i = nextMask++; if (i >= maskJobs.length) return;
        const d = maskJobs[i].d;
        step("⏳ رسم حدود العناصر (" + (i + 1) + "/" + dets.length + ")…");
        try {
          const m = await maskFor(S, { box: d.box });
          masked[i] = m && m.area ? Object.assign(m, { label: d.label, en: d.en || "", det: d.score, rank: i, src: d.src, zoneMain: !!d.zoneMain }) : null;
        } catch (e) {
          masked[i] = null;
          console.warn("SAM mask", i, e);
        }
      }
    }));
    masked.forEach(m => { if (m) items.push(m); });
    const out = mergeItems(items, S), main = out.find(i => i.zoneMain);
    if (main) {                                                       // «منطقة»: أجزاء الشيء نفسه (شرائح كشف داخل المستطيل) تُضمّ إليه؛ الأشخاص/الأيدي تبقى منفصلة لتُطرح الأصابع
      const mb = [main.x0, main.y0, main.x1, main.y1], ex = .1 * Math.max(mb[2] - mb[0], mb[3] - mb[1]), eb = [mb[0] - ex, mb[1] - ex, mb[2] + ex, mb[3] + ex];
      for (let i = out.length - 1; i >= 0; i--) { const o = out[i]; if (o === main || PERSON.test(o.label)) continue; const ob = [o.x0, o.y0, o.x1, o.y1]; if (bInter(ob, eb) > .7 * bArea(ob)) { unite(main, o, S); out.splice(i, 1); } }
      if (main.label === "عنصر") { const n = dets.find(d => d.label && !PERSON.test(d.label) && d !== dets[0] && bInter(d.box, mb) > .5 * bArea(d.box)); if (n) main.label = n.label; }
    }
    if (!o.lite && !o.noHeld) await heldItems(S, out, step);
    if (!o.noHeld) await occlusions(S, out, step);
    out.forEach((it, i) => { it.id = i; if (!it.occFixed) fillHoles(it, out.filter(o => o !== it)); stats(it, S); }); if (fp) AC = { fp, S, items: cloneItems(out), src, note, dets }; return { S, items: out, src, note, dets, later };
  }
  /* دمج عناصر يختارها المستخدم في عنصر واحد (يأخذ اسم أكبرها) */
  function joinItems(S, items, list) {
    const a = list.slice().sort((p, q) => q.area - p.area)[0], lb = a.label; list.forEach(b => { if (b === a) return; unite(a, b, S); const i = items.indexOf(b); if (i >= 0) items.splice(i, 1); });
    a.label = lb; a.manual = true; a.v = null; return a;
  }
  /* احتياط: ما يمسكه شخص أو يقف أمامه (منتج في اليد) ولم يكشفه الكاشف = فراغ محاط بقناع الشخص ← نقرة SAM عنده تعطي العنصر */
  async function heldItems(S, out, step) {
    const { lw, lh } = S, N = lw * lh, any = new Uint8Array(N); out.forEach(o => { for (let i = 0; i < N; i++) if (o.lo[i] > 0) any[i] = 1; });
    for (const P of out.filter(o => PERSON.test(o.label)).slice(0, 2)) {
      const bx0 = Math.floor(P.x0 * S.fx), by0 = Math.floor(P.y0 * S.fy), bx1 = Math.ceil(P.x1 * S.fx), by1 = Math.ceil(P.y1 * S.fy), st = Math.max(3, Math.round(Math.min(bx1 - bx0, by1 - by0) / 9)), R = Math.max(4, st), seeds = [];
      const inP = (x, y) => x >= 0 && y >= 0 && x < lw && y < lh && P.lo[y * lw + x] > 0;
      for (let y = by0 + st; y < by1 - st / 2; y += st) for (let x = bx0 + st; x < bx1 - st / 2; x += st) { if (any[y * lw + x]) continue;
        let sides = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { for (let r = 1; r <= R * 3; r++) if (inP(x + dx * r, y + dy * r)) { sides++; break; } } if (sides >= 3) seeds.push([x, y]); }
      for (const [x, y] of seeds.slice(0, 5)) {
        if (any[y * lw + x]) continue; step("⏳ البحث عمّا في اليد…");
        const m = await maskFor(S, { pts: [[(x + .5) / S.fx, (y + .5) / S.fy, 1]] }); if (!m.area || m.score < .6) continue;
        const fr = m.area / N; let ov = 0; for (let i = 0; i < N; i++) if (m.lo[i] > 0 && any[i]) ov++;
        if (fr < .002 || fr > .2 || ov / m.area > .3 || m.area > P.area * .6) continue;
        let ring = 0, rp = 0; for (let yy = 0; yy < lh; yy++) for (let xx = 0; xx < lw; xx++) { const i = yy * lw + xx; if (m.lo[i] > 0) continue; let nb = false; for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { const q = (yy + dy) * lw + xx + dx; if (xx + dx >= 0 && xx + dx < lw && yy + dy >= 0 && yy + dy < lh && m.lo[q] > 0) { nb = true; break; } } if (nb) { ring++; if (P.lo[i] > 0) rp++; } }
        if (!ring || rp / ring < .5) continue;                       // محاط بالشخص من أغلب الجهات (في يده/أمامه)، لا شيء في الخلفية بجانبه
        carve(P, m, S); m.label = "عنصر"; m.det = .5; m.held = true; out.push(m); for (let i = 0; i < N; i++) if (m.lo[i] > 0) any[i] = 1;
      }
    }
  }
  /* مضلّع (بإحداثيات الصورة) ← ألفا ناعمة الحافة لنافذة (x0,y0,w,h) بمقياس k */
  function polyAlpha(poly, x0, y0, w, h, k) {
    const c = document.createElement("canvas"); c.width = Math.max(1, w); c.height = Math.max(1, h); const g = c.getContext("2d", { willReadFrequently: true });
    g.fillStyle = "#000"; g.beginPath(); poly.forEach((p, i) => { const X = p[0] * k - x0, Y = p[1] * k - y0; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); g.fill();
    const d = g.getImageData(0, 0, c.width, c.height).data, a = new Float32Array(c.width * c.height); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255; return a;
  }
  /* «منطقة» (مثل Zone في Canva): يرسم المستخدم حدّاً حرّاً فتُلتقط المنطقة كما هي بالضبط */
  function zoneItem(S, poly, items) {
    if (!poly || poly.length < 3) return null; const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    const it = { poly, zone: true, manual: true, label: "منطقة", det: 1, score: 1, obj: 1, lw: S.lw, lh: S.lh, x0: Math.max(0, Math.floor(Math.min(...xs))), y0: Math.max(0, Math.floor(Math.min(...ys))), x1: Math.min(S.W, Math.ceil(Math.max(...xs))), y1: Math.min(S.H, Math.ceil(Math.max(...ys))) };
    if (it.x1 - it.x0 < 6 || it.y1 - it.y0 < 6) return null;
    const a = polyAlpha(poly, 0, 0, S.lw, S.lh, 1), lo = new Float32Array(S.lw * S.lh); let n = 0;      // نسخة منخفضة الدقة للدمج والتعارض
    const lp = poly.map(p => [p[0] * S.fx, p[1] * S.fy]), b = polyAlpha(lp, 0, 0, S.lw, S.lh, 1); for (let i = 0; i < lo.length; i++) { lo[i] = b[i] > .5 ? 8 : -8; if (b[i] > .5) n++; }
    it.lo = lo; it.area = Math.max(1, n); it.id = Math.max(-1, ...items.map(o => o.id)) + 1; items.push(it); return it;
  }
  /* شيء صلب في يد شخص (عبوة): صورته الخارجية كاملة، والأصابع فقط تُستثنى منه.
     ① الصورة الكاملة = القناع بعد سدّ كل ثقوبه وإغلاق حافته ② نعيد قناع الشخص بنقاط سالبة على الشيء فيأخذ يده/أصابعه فقط
     ③ الشيء = الصورة الكاملة − الأصابع، والشخص يستعيد أصابعه ويخسر ما تبقّى من الشيء */
  async function occlusions(S, out, step) {
    const { lw, lh } = S, N = lw * lh;
    for (const P of out.filter(o => PERSON.test(o.label))) for (const J of out.filter(o => o !== P && (o.zoneMain || SOLID.test(o.label || "")))) {
      if (bInter([P.x0, P.y0, P.x1, P.y1], [J.x0, J.y0, J.x1, J.y1]) < .2 * bArea([J.x0, J.y0, J.x1, J.y1])) continue;      // يد تغطي جزءاً من الشيء (ولو من الأسفل فقط)
      step("⏳ فصل الأصابع عن العبوة…");
      const sil = { lo: Float32Array.from(J.lo), lw, lh, label: J.label }; fillHoles(sil, []); closeLo(sil, [], 3);
      const pts = []; let mnx = lw, mxx = -1, mny = lh, mxy = -1; for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) if (J.lo[y * lw + x] > 0) { if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; }
      for (const fy of [.2, .4, .6, .8]) for (const fx of [.3, .5, .7]) { const x = Math.round(mnx + (mxx - mnx) * fx), y = Math.round(mny + (mxy - mny) * fy); if (J.lo[y * lw + x] > 2) pts.push([(x + .5) / S.fx, (y + .5) / S.fy, 0]); }
      if (!pts.length) continue;
      const P2 = await maskFor(S, { box: [P.x0, P.y0, P.x1, P.y1], pts: pts.slice(0, 8) }); if (!P2.area || P2.area < P.area * .5) continue;
      let occ = 0, jn = 0; for (let i = 0; i < N; i++) { const inS = sil.lo[i] > 0, isP = P2.lo[i] > 0; if (inS && isP) occ++; if (inS && !isP) jn++; }
      if (jn < J.area * .5) continue;                                 // إعادة القناع لم تنجح ← نُبقي القديم
      J.orig = Float32Array.from(J.lo); J.sil = sil.lo; J.hand = P2.lo; J.holder = P;
      for (let i = 0; i < N; i++) { if (sil.lo[i] <= 0) continue; if (P2.lo[i] > 0) { J.lo[i] = -6; P.lo[i] = Math.max(P.lo[i], 4); } else { J.lo[i] = Math.max(J.lo[i], 4); P.lo[i] = Math.min(P.lo[i], -6); } }
      J.occFixed = true; stats(J, S); stats(P, S);
    }
  }
  /* عنصر يضيفه المستخدم: نقرة (pts) أو مستطيل (box) */
  /* معاينة فورية للعنصر تحت الماوس (مثل أداة اختيار الكائن في فوتوشوب): قناع نقطة بلا إضافة */
  async function pointMask(S, x, y, items, boxes) {
    /* «مكتشف الأجسام» كفوتوشوب: أصغر صندوق كشف يحوي الماوس ← صندوقه + النقطة = الجسم كاملاً لا جزءاً منه */
    const inB = (boxes || []).filter(d => x >= d.box[0] && x <= d.box[2] && y >= d.box[1] && y <= d.box[3]).sort((a, b) => bArea(a.box) - bArea(b.box))[0];
    const m = await maskFor(S, inB ? { box: inB.box, pts: [[x, y, 1]] } : { pts: [[x, y, 1]], whole: true }); if (!m.area) return null; m.manual = true; m.label = inB ? inB.label : "عنصر"; m.det = 1; fillHoles(m, items || []); stats(m, S); return m; }
  async function addItem(S, p, items, pre) {
    const m = pre || await maskFor(S, p); if (!m.area) return null; m.manual = true; m.label = p.label || (pre && pre.label) || "عنصر"; m.det = 1; fillHoles(m, items); stats(m, S);
    const hit = items.find(o => both(o, m) / Math.min(o.area, m.area) > .85 && Math.abs(o.area - m.area) / Math.max(o.area, m.area) < .25); if (hit) return hit;
    m.id = Math.max(-1, ...items.map(o => o.id)) + 1; items.push(m); return m;
  }
  /* تحسين قناع عنصر موجود محلياً: نقاط + / - تعيد استعمال embedding نفسه، بلا إعادة كشف الصورة. */
  async function refineItem(S, it, p, mode, items) {
    if (!it || !it.lo || !it.area) return null;
    const box = [it.x0, it.y0, it.x1, it.y1], pts = [[p[0], p[1], mode === "add" ? 1 : 0]];
    const m = await maskFor(S, { box, pts });
    if (!m || !m.area) return it;
    const N = it.lo.length;
    if (mode === "add") {
      /* الإضافة لا تسمح لـSAM بالقفز بعيداً عن العنصر: نأخذ فقط القناع داخل صندوق موسّع قليلاً. */
      const padX = Math.max(8, (it.x1 - it.x0) * .22), padY = Math.max(8, (it.y1 - it.y0) * .22);
      const bx0 = Math.max(0, it.x0 - padX), by0 = Math.max(0, it.y0 - padY), bx1 = Math.min(S.W, it.x1 + padX), by1 = Math.min(S.H, it.y1 + padY);
      for (let y = 0; y < S.lh; y++) for (let x = 0; x < S.lw; x++) {
        const gx = (x + .5) / S.fx, gy = (y + .5) / S.fy, j = y * S.lw + x;
        if (m.lo[j] > 0 && gx >= bx0 && gx <= bx1 && gy >= by0 && gy <= by1) it.lo[j] = Math.max(it.lo[j], m.lo[j]);
      }
    } else {
      for (let j = 0; j < N; j++) if (m.lo[j] > 0) it.lo[j] = -Math.max(4, Math.abs(it.lo[j]));
    }
    cleanLo(it.lo, it.lw, it.lh);
    stats(it, S); it.manual = true; it.v = null;
    return it;
  }
  /* قيمة القناع عند بكسل كامل (x,y) بالاستيفاء الخطي */
  function sampler(S, it) {
    const { lo, lw, lh } = it, fx = S.fx, fy = S.fy;
    return (x, y) => { let u = (x + .5) * fx - .5, v = (y + .5) * fy - .5; u = Math.max(0, Math.min(lw - 1.001, u)); v = Math.max(0, Math.min(lh - 1.001, v)); const x0 = u | 0, y0 = v | 0, tx = u - x0, ty = v - y0, i = y0 * lw + x0;
      return (lo[i] * (1 - tx) + lo[i + 1] * tx) * (1 - ty) + (lo[i + lw] * (1 - tx) + lo[i + lw + 1] * tx) * ty; };
  }
  /* قناع للعرض بمقياس k (بكسل عرض لكل بكسل أصلي) ← {a, dx, dy, dw, dh} */
  function viewMask(S, it, k) {
    if (it.poly) { const dx = Math.floor(it.x0 * k), dy = Math.floor(it.y0 * k), dw = Math.max(2, Math.ceil(it.x1 * k) - dx), dh = Math.max(2, Math.ceil(it.y1 * k) - dy), p = polyAlpha(it.poly, dx, dy, dw, dh, k), a = new Uint8Array(dw * dh); let cx = 0, cy = 0, n = 0, ly = -1, sx = 0, nx = 0;
      for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) if (p[y * dw + x] > .5) { a[y * dw + x] = 1; n++; cx += x; cy += y; if (ly < 0 || y <= ly + 2) { if (ly < 0) ly = y; sx += x; nx++; } }
      return { a, dx, dy, dw, dh, lx: dx + (nx ? sx / nx : dw / 2), ly: dy + Math.max(0, ly), cx: dx + (n ? cx / n : dw / 2), cy: dy + (n ? cy / n : dh / 2) }; }
    const f = sampler(S, it), dx = Math.floor(it.x0 * k), dy = Math.floor(it.y0 * k), dw = Math.max(2, Math.ceil(it.x1 * k) - dx), dh = Math.max(2, Math.ceil(it.y1 * k) - dy), a = new Uint8Array(dw * dh), fv = new Float32Array(dw * dh);
    let ly = -1, sx = 0, nx = 0, cnt = 0, cx = 0, cy = 0;
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) if ((fv[y * dw + x] = f((dx + x + .5) / k, (dy + y + .5) / k)) > 0) { a[y * dw + x] = 1; cnt++; cx += x; cy += y; if (ly < 0 || y <= ly + 2) { if (ly < 0) ly = y; sx += x; nx++; } }
    return { a, f: fv, dx, dy, dw, dh, lx: dx + (nx ? sx / nx : dw / 2), ly: dy + Math.max(0, ly), cx: dx + (cnt ? cx / cnt : dw / 2), cy: dy + (cnt ? cy / cnt : dh / 2) };      // lx/ly: أعلى العنصر (لاسمه)، cx/cy: مركزه
  }
  /* معاينة بالدقة الكاملة (نفس قصّ «التقاط») مصغّرة للعرض: للحواف الدقيقة كالأصابع */
  function fineView(S, cv, it, k, items) {
    const D = cv.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, S.W, S.H).data, A = fullAlpha(S, it, D, { matte: false });
    (items || []).filter(J => J.holder === it).forEach(J => { const B = fullAlpha(S, J, D, { matte: false }); for (let y = Math.max(A.y0, B.y0); y < Math.min(A.y0 + A.h, B.y0 + B.h); y++) for (let x = Math.max(A.x0, B.x0); x < Math.min(A.x0 + A.w, B.x0 + B.w); x++) A.a[(y - A.y0) * A.w + x - A.x0] *= 1 - B.a[(y - B.y0) * B.w + x - B.x0]; });      // اليد = حدودها ناقص الشيء الذي تمسكه
    const dx = Math.floor(A.x0 * k), dy = Math.floor(A.y0 * k), dw = Math.max(2, Math.ceil((A.x0 + A.w) * k) - dx), dh = Math.max(2, Math.ceil((A.y0 + A.h) * k) - dy), a = new Uint8Array(dw * dh), fv = new Float32Array(dw * dh).fill(-4); let ly = -1, sx = 0, nx = 0, n = 0, cx = 0, cy = 0;
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) { const gx = Math.min(A.w - 1, Math.floor((dx + x + .5) / k) - A.x0), gy = Math.min(A.h - 1, Math.floor((dy + y + .5) / k) - A.y0); if (gx >= 0 && gy >= 0) fv[y * dw + x] = (A.a[gy * A.w + gx] - .5) * 8; if (gx >= 0 && gy >= 0 && A.a[gy * A.w + gx] > .5) { a[y * dw + x] = 1; n++; cx += x; cy += y; if (ly < 0 || y <= ly + 2) { if (ly < 0) ly = y; sx += x; nx++; } } }
    return { a, f: fv, dx, dy, dw, dh, lx: dx + (nx ? sx / nx : dw / 2), ly: dy + Math.max(0, ly), cx: dx + (n ? cx / n : dw / 2), cy: dy + (n ? cy / n : dh / 2) };
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
    if (it.poly) return { a: polyAlpha(it.poly, x0, y0, w, h, 1), x0, y0, w, h };      // المنطقة تُلتقط كما رُسمت
    if (it.sil && !opt.inner) return heldAlpha(S, it, D, opt);
    const f = sampler(S, it), p = new Float32Array(N), I = new Float32Array(N), Bm = new Uint8Array(N), inv = new Uint8Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, gi = ((y0 + y) * W + x0 + x) * 4, v = f(x0 + x, y0 + y) > 0 ? 1 : 0; Bm[i] = v; inv[i] = 1 - v; p[i] = v; I[i] = (D[gi] * .299 + D[gi + 1] * .587 + D[gi + 2] * .114) / 255; }
    if (opt.refine === false) return { a: p, x0, y0, w, h };
    /* دقة الشعر والحواف: ألفا حقيقية من ألوان المقدّمة/الخلفية القريبة + مرشّح موجَّه + إزالة هالة الخلفية (محرّك «نزع الخلفية» نفسه)؛ احتياطاً المرشّح البسيط أدناه */
    if (opt.matte !== false && N <= (opt.matteMax || 3200000) && typeof PBBgRemove !== "undefined" && PBBgRemove._t && PBBgRemove._t.matteCore) {
      try { const rgb = new Float32Array(N * 3), M = new Float32Array(N);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, gi = ((y0 + y) * W + x0 + x) * 4; rgb[i * 3] = D[gi] / 255; rgb[i * 3 + 1] = D[gi + 1] / 255; rgb[i * 3 + 2] = D[gi + 2] / 255; M[i] = Math.max(0, Math.min(1, .5 + f(x0 + x, y0 + y) / 10)); }
        const band = (PERSON.test(it.label || "") ? 1.7 : 1.1) / S.fx, r = PBBgRemove._t.matteCore({ w, h, rgb }, M, { band, detail: 1, decon: true, shift: 0, feather: 0 }), c8 = new Uint8ClampedArray(N * 3);
        for (let i = 0; i < N; i++) { c8[i * 3] = r.data[i * 4]; c8[i * 3 + 1] = r.data[i * 4 + 1]; c8[i * 3 + 2] = r.data[i * 4 + 2]; }
        return { a: r.alpha, x0, y0, w, h, rgb8: c8 }; } catch (e) { console.warn("matte", e); }
    }
    /* داخل العنصر معتم تماماً وخارجه شفاف؛ الشريط الضيق حول الحدّ فقط يُعاد حسابه بالمرشّح الموجَّه ليلتصق بحافة الصورة */
    const rb = Math.max(2, Math.round(.9 / S.fx)), dil = ImageTools.sqDilate(Bm, w, h, rb), ero = ImageTools.sqDilate(inv, w, h, rb), q = guided(I, p, w, h, rb, opt.eps || 4e-4), a = new Float32Array(N);
    for (let i = 0; i < N; i++) { if (!(dil[i] && ero[i])) { a[i] = Bm[i]; continue; } const v = (q[i] - .5) * 1.6 + .5; a[i] = v < .06 ? 0 : v > .94 ? 1 : v; }
    return { a, x0, y0, w, h };
  }
  /* شيء في اليد بالدقة الكاملة: صورته الخارجية كاملة، ثم تُطرح الأصابع بتصنيف لوني (جلد اليد من ذراع الشخص نفسه، ولون الشيء من الشيء) قرب اليد فقط، وحافة ناعمة بالمرشّح الموجَّه */
  /* فصل دقيق للأصابع: حلّال تنعيم يراعي الحواف على نافذة مصغّرة ببذور (الشيء المؤكَّد / اليد المؤكَّدة) ونموذج لوني GMM للشيء واليد من هذه الصورة نفسها،
     ثم تكبير وماتينغ على الدقة الكاملة قرب اليد فقط. أي فشل ← الطريقة اللونية القديمة (heldAlphaOld) */
  function heldAlpha(S, it, D, opt) {
    try { const r = heldAlpha2(S, it, D, opt); if (r) return r; } catch (e) { console.warn("held2", e); }
    return heldAlphaOld(S, it, D, opt);
  }
  function heldAlpha2(S, it, D, opt) {
    const T = typeof PBBgRemove !== "undefined" && PBBgRemove._t; if (!T || !T.solve || !T.fitGMM || !T.llOf || !T.morph || !it.hand) return null;
    const W = S.W, old = fullAlpha(S, { lo: it.sil, lw: it.lw, lh: it.lh, x0: it.x0, y0: it.y0, x1: it.x1, y1: it.y1 }, D, Object.assign({}, opt, { inner: true, matte: false })), { x0, y0, w, h } = old, N = w * h, hs = sampler(S, { lo: it.hand, lw: it.lw, lh: it.lh }), key = x0 + "," + y0 + "," + w + "," + h;
    const skin = (r, g, b) => r > 90 && g > b && r - b > 25 && r - g > 10 && g / r > .5 && g / r < .93 && b / r > .35 && b / r < .88, ps = it.holder ? sampler(S, it.holder) : null;
    let R = it._hu && it._hu.key === key ? it._hu : null;
    if (!R) {
      const s = Math.min(1, 480 / Math.max(w, h)), sw = Math.max(8, Math.round(w * s)), sh = Math.max(8, Math.round(h * s)), n = sw * sh, rgb = new Float32Array(n * 3), ja = new Float32Array(n), hl = new Float32Array(n), hp = new Uint8Array(n);
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
        const i = y * sw + x; let r = 0, g = 0, b = 0;
        for (let q = 0; q < 4; q++) { const fx = Math.min(w - 1, Math.floor((x + .25 + (q & 1) * .5) / sw * w)), fy = Math.min(h - 1, Math.floor((y + .25 + (q >> 1) * .5) / sh * h)), gi = ((y0 + fy) * W + x0 + fx) * 4; r += D[gi]; g += D[gi + 1]; b += D[gi + 2]; }
        rgb[i * 3] = r / 1020; rgb[i * 3 + 1] = g / 1020; rgb[i * 3 + 2] = b / 1020;
        const cx = Math.min(w - 1, Math.floor((x + .5) / sw * w)), cy = Math.min(h - 1, Math.floor((y + .5) / sh * h)); ja[i] = old.a[cy * w + cx]; hl[i] = hs(x0 + cx, y0 + cy); hp[i] = ps && ps(x0 + cx, y0 + cy) > 0 ? 1 : 0;
      }
      /* منطقة اليد التقريبية (قناع اليد الخشن موسَّعاً): داخلها فقط يُعاد الحسم، وخارجها الشيء كما هو */
      const hm = new Uint8Array(n); for (let i = 0; i < n; i++) hm[i] = hl[i] > -3 || (ja[i] < .05 && hp[i]) ? 1 : 0;
      const nearU = T.morph(hm, sw, sh, Math.max(6, Math.round(Math.max(sw, sh) * .09)), false), near = new Uint8Array(n); for (let i = 0; i < n; i++) near[i] = nearU[i] && ja[i] >= .05 ? 1 : 0;
      const fS = [], bS = [], pick = (L, cap) => { const st = Math.max(1, L.length / cap), o = new Float32Array(Math.min(L.length, cap) * 3); let k = 0; for (let t = 0; t < L.length && k < cap; t += st) { const i = L[t | 0]; o[k * 3] = rgb[i * 3]; o[k * 3 + 1] = rgb[i * 3 + 1]; o[k * 3 + 2] = rgb[i * 3 + 2]; k++; } return o.subarray(0, k * 3); };
      for (let i = 0; i < n; i++) { const sk = skin(rgb[i * 3] * 255, rgb[i * 3 + 1] * 255, rgb[i * 3 + 2] * 255); if (ja[i] > .9 && (!nearU[i] || (hl[i] < -2 && !sk))) fS.push(i); if (sk && ((ja[i] < .05 && hp[i]) || (ja[i] > .5 && hl[i] > .6))) bS.push(i); }
      if (fS.length < 60 || bS.length < 60) { console.warn('held2 seeds', fS.length, bS.length); return null; }
      let sd = 7; const rnd = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296, GF = T.fitGMM(pick(fS, 5000), 6, rnd), GB = T.fitGMM(pick(bS, 5000), 6, rnd); if (!GF || !GB) return null;
      const P = new Float32Array(n), B0 = new Uint8Array(n);
      for (let i = 0; i < n; i++) { if (ja[i] < .05) { P[i] = 0; continue; } if (!near[i]) { P[i] = 1; B0[i] = 1; continue; } const d = Math.max(-14, Math.min(14, T.llOf(GF, rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) - T.llOf(GB, rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]))); P[i] = 1 / (1 + Math.exp(-.3 * d)); B0[i] = P[i] > .5 ? 1 : 0; }
      /* تنظيف (جزر/ثقوب صغيرة) ثم شريط غير مؤكَّد حول الحدّ يُحسم بالتنعيم الواعي بالحواف */
      const cl = T.cleanMask ? T.cleanMask(Float32Array.from(B0), sw, sh, new Uint8Array(n)) : Float32Array.from(B0); for (let i = 0; i < n; i++) B0[i] = cl[i] > .5 ? 1 : 0;
      /* كتلة «يد» لا يسندها قناع اليد (بلا بكسلات يد مؤكَّدة) = انعكاس على الزجاج أو لون يشبه الجلد داخل الشيء ← تعود للشيء */
      { const lab = new Int32Array(n), stk = []; let cn = 0;
        for (let s0 = 0; s0 < n; s0++) { if (B0[s0] || ja[s0] < .05 || lab[s0]) continue; cn++; const cp = []; let hv = 0, tc = 0; stk.push(s0); lab[s0] = cn;
          while (stk.length) { const j = stk.pop(), x = j % sw; cp.push(j); if (hl[j] > .6) hv++; for (const q of [x > 0 ? j - 1 : -1, x < sw - 1 ? j + 1 : -1, j - sw, j + sw]) if (q >= 0 && q < n) { if (!B0[q] && ja[q] >= .05 && !lab[q]) { lab[q] = cn; stk.push(q); } else if (ja[q] < .05 && hp[q]) tc++; } }
          if (hv < cp.length * .15) for (const j of cp) { B0[j] = 1; P[j] = Math.max(P[j], .9); } } }
      const e = Math.max(2, Math.round(Math.max(sw, sh) / 140)), fgC = T.morph(B0, sw, sh, e, true), inv = new Uint8Array(n); for (let i = 0; i < n; i++) inv[i] = 1 - B0[i];
      const bgC = T.morph(inv, sw, sh, e, true), seed = new Uint8Array(n);
      for (let i = 0; i < n; i++) { if (ja[i] < .05) { seed[i] = 2; continue; } if (!near[i]) { seed[i] = 1; continue; } if (fgC[i]) seed[i] = 1; else if (bgC[i]) seed[i] = 2; }
      R = it._hu = { key, u: T.solve(rgb, sw, sh, P, seed, .08), sw, sh, nearU };
    }
    const { u, sw, sh } = R, M = new Float32Array(N), nr = new Uint8Array(N);
    for (let y = 0; y < h; y++) { const fy = Math.max(0, Math.min(sh - 1.001, (y + .5) / h * sh - .5)), v0 = fy | 0, ty = fy - v0;
      for (let x = 0; x < w; x++) { const i = y * w + x; if (!R.nearU[(Math.min(R.sh - 1, (y / h * R.sh) | 0)) * R.sw + Math.min(R.sw - 1, (x / w * R.sw) | 0)]) { M[i] = old.a[i]; continue; } nr[i] = 1;
        const fx = Math.max(0, Math.min(sw - 1.001, (x + .5) / w * sw - .5)), u0 = fx | 0, tx = fx - u0, j = v0 * sw + u0, q = (u[j] * (1 - tx) + u[j + 1] * tx) * (1 - ty) + (u[j + sw] * (1 - tx) + u[j + sw + 1] * tx) * ty;
        M[i] = Math.max(0, Math.min(1, (q - .5) * 2.4 + .5)); } }
    let al = M, rgb8 = null;
    if (opt.matte !== false && N <= (opt.matteMax || 3200000) && T.matteCore) {
      const rgb = new Float32Array(N * 3); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, gi = ((y0 + y) * W + x0 + x) * 4; rgb[i * 3] = D[gi] / 255; rgb[i * 3 + 1] = D[gi + 1] / 255; rgb[i * 3 + 2] = D[gi + 2] / 255; }
      const r = T.matteCore({ w, h, rgb }, M, { band: 2, detail: 1, decon: true, shift: 0, feather: 0 });
      al = r.alpha; rgb8 = new Uint8ClampedArray(N * 3); for (let i = 0; i < N; i++) { rgb8[i * 3] = r.data[i * 4]; rgb8[i * 3 + 1] = r.data[i * 4 + 1]; rgb8[i * 3 + 2] = r.data[i * 4 + 2]; }
    }
    const a = Float32Array.from(al);
    return rgb8 ? { a, x0, y0, w, h, rgb8 } : { a, x0, y0, w, h };
  }
  function heldAlphaOld(S, it, D, opt) {
    const W = S.W, base = fullAlpha(S, { lo: it.sil, lw: it.lw, lh: it.lh, x0: it.x0, y0: it.y0, x1: it.x1, y1: it.y1 }, D, Object.assign({}, opt, { inner: true })), { x0, y0, w, h } = base, N = w * h;
    const lw = it.lw, lh = it.lh, at = (arr, x, y) => { const u = Math.min(lw - 1, Math.max(0, Math.floor((x + .5) * S.fx))), v = Math.min(lh - 1, Math.max(0, Math.floor((y + .5) * S.fy))); return arr[v * lw + u]; };
    const handN = new Uint8Array(lw * lh); for (let i = 0; i < lw * lh; i++) handN[i] = it.hand[i] > 0 ? 1 : 0; const gate = ImageTools.sqDilate(handN, lw, lh, 2);
    const px = (x, y) => { const gi = (y * W + x) * 4; return [D[gi], D[gi + 1], D[gi + 2]]; }, skinLike = c => c[0] > 90 && c[0] > c[1] && c[1] > c[2] && c[0] - c[2] > 25 && c[0] - c[1] > 10;
    const sk = [], jr = [], P = it.holder, ex = Math.round(Math.max(w, h) * .3), st = Math.max(1, Math.round(Math.sqrt(w * h / 6000)));
    for (let y = Math.max(0, y0 - ex); y < Math.min(S.H, y0 + h + ex); y += st) for (let x = Math.max(0, x0 - ex); x < Math.min(W, x0 + w + ex); x += st) {
      const inS = at(it.sil, x, y) > 0, c = px(x, y);
      if (!inS && P && at(P.lo, x, y) > 0 && skinLike(c)) sk.push(c);                 // يد/ذراع ظاهرة خارج الشيء
      else if (inS && at(it.orig, x, y) > 3 && !at(gate, x, y)) jr.push(c);          // الشيء بعيداً عن اليد
    }
    if (sk.length < 40) for (let y = y0; y < y0 + h; y += st) for (let x = x0; x < x0 + w; x += st) if (at(it.sil, x, y) > 0 && at(it.hand, x, y) > 0) sk.push(px(x, y));
    if (sk.length < 20 || jr.length < 20) { const a = new Float32Array(base.a); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(it.hand, x0 + x, y0 + y) > 0) a[y * w + x] = 0; return { a, x0, y0, w, h }; }
    const km = (P0, K) => { let C = []; for (let i = 0; i < K; i++) C.push(P0[Math.floor((i + .5) * P0.length / K)].slice()); for (let t = 0; t < 8; t++) { const sm = C.map(() => [0, 0, 0, 0]); P0.forEach(p => { let b = 0, bd = 1e9; C.forEach((c, j) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; b = j; } }); sm[b][0] += p[0]; sm[b][1] += p[1]; sm[b][2] += p[2]; sm[b][3]++; }); C = C.map((c, j) => sm[j][3] ? [sm[j][0] / sm[j][3], sm[j][1] / sm[j][3], sm[j][2] / sm[j][3]] : c); } return C; };
    const CS = km(sk.slice(0, 4000), 6), CJ = km(jr.slice(0, 4000), 8), dmin = (C, c) => Math.min(...C.map(q => (c[0] - q[0]) ** 2 + (c[1] - q[1]) ** 2 + (c[2] - q[2]) ** 2));
    const ps = new Float32Array(N), I = new Float32Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, gx = x0 + x, gy = y0 + y, c = px(gx, gy); I[i] = (c[0] * .299 + c[1] * .587 + c[2] * .114) / 255; if (base.a[i] <= 0 || !at(gate, gx, gy)) continue; const ds = Math.sqrt(dmin(CS, c)), dj = Math.sqrt(dmin(CJ, c)); ps[i] = dj / (ds + dj + 1e-6) > .5 ? 1 : 0; }
    const q = guided(I, ps, w, h, Math.max(2, Math.round(Math.max(w, h) / 220)), 1e-3), a = new Float32Array(N);
    for (let i = 0; i < N; i++) { const o = Math.max(0, Math.min(1, (q[i] - .5) * 2 + .5)); a[i] = base.a[i] * (1 - o); }
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
    const fy = it => it.holder && chosen.includes(it.holder) ? it.holder.y1 + 1 : it.y1, order = chosen.slice().sort((a, b) => fy(b) - fy(a) || a.area - b.area), A = order.map(it => fullAlpha(S, it, D, opt)), out = [];
    order.forEach((it, n) => {
      const a = A[n], m = new Float32Array(a.a); for (let q = 0; q < n; q++) { const b = A[q]; for (let y = Math.max(a.y0, b.y0); y < Math.min(a.y0 + a.h, b.y0 + b.h); y++) for (let x = Math.max(a.x0, b.x0); x < Math.min(a.x0 + a.w, b.x0 + b.w); x++) { const v = b.a[(y - b.y0) * b.w + x - b.x0]; if (v > 0) { const i = (y - a.y0) * a.w + x - a.x0; m[i] *= 1 - v; } } }
      const sh = opt.shadow === false || it.zone ? null : shadowOf(S, a, D, A.filter((_, q) => q !== n)), X0 = sh ? sh.x0 : a.x0, Y0 = sh ? sh.y0 : a.y0, w = sh ? sh.w : a.w, h = sh ? sh.h : a.h;
      const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"), im = g.createImageData(w, h), er = new Uint8Array(w * h); let px = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const gx = X0 + x, gy = Y0 + y, i = y * w + x, lx = gx - a.x0, ly = gy - a.y0, al = lx >= 0 && ly >= 0 && lx < a.w && ly < a.h ? m[ly * a.w + lx] : 0, gi = (gy * W + gx) * 4;
        if (al > .02) { const ci = (ly * a.w + lx) * 3, c8 = a.rgb8; im.data[i * 4] = c8 ? c8[ci] : D[gi]; im.data[i * 4 + 1] = c8 ? c8[ci + 1] : D[gi + 1]; im.data[i * 4 + 2] = c8 ? c8[ci + 2] : D[gi + 2]; im.data[i * 4 + 3] = Math.round(al * 255); if (al > .08) er[i] = 1; px++; continue; }
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
  /* حدّ العنصر: خط رفيع (~1px) مُنعَّم يتبع الحافة الفعلية بدقة جزء من البكسل (مسافة موقَّعة من حقل القناع f) بدل حلقة سميكة؛ وتعبئة خفيفة داخل العنصر */
  function overlays(v, rgb) {
    const { a, f, dw, dh } = v, lineA = new Uint8Array(dw * dh), fillA = new Uint8Array(dw * dh);
    if (f) {
      for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) { const i = y * dw + x, c = f[i], l = x > 0 ? f[i - 1] : c, r = x < dw - 1 ? f[i + 1] : c, u = y > 0 ? f[i - dw] : c, d = y < dh - 1 ? f[i + dw] : c, gx = (r - l) / 2, gy = (d - u) / 2, mg = Math.hypot(gx, gy);
        const sd = mg > 1e-3 ? c / mg : (c > 0 ? 9 : -9);      // مسافة تقريبية (بكسل) إلى الحافة، موجبة داخل العنصر
        const la = 1 - (Math.abs(sd) - .15) / .65; lineA[i] = la <= 0 ? 0 : la >= 1 ? 255 : Math.round(la * 255); const fa = sd + .5; fillA[i] = fa <= 0 ? 0 : fa >= 1 ? 85 : Math.round(fa * 85); }
    } else { for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) { const i = y * dw + x; if (!a[i]) continue; fillA[i] = 85; if (x === 0 || y === 0 || x === dw - 1 || y === dh - 1 || !a[i - 1] || !a[i + 1] || !a[i - dw] || !a[i + dw]) lineA[i] = 255; } }
    const mk = arr => { const c = document.createElement("canvas"); c.width = dw; c.height = dh; const g = c.getContext("2d"), im = g.createImageData(dw, dh); for (let i = 0; i < dw * dh; i++) { const al = arr[i]; if (al) { im.data[i * 4] = rgb[0]; im.data[i * 4 + 1] = rgb[1]; im.data[i * 4 + 2] = rgb[2]; im.data[i * 4 + 3] = al; } } g.putImageData(im, 0, 0); return c; };
    return { out: mk(lineA), fill: mk(fillA) };
  }
  function warm() { try { worker("sam").call("load", { sam: true }).catch(() => { }); worker("det").call("load", { det: ["coco"] }).catch(() => { }); worker("det2").call("load", { det: ["o365"] }).catch(() => { }); worker("dep").call("depthLoad", {}).catch(() => { }); } catch (e) { } }
  return { supported, analyze, pointMask, addItem, refineItem, zoneItem, joinItems, viewMask, fineView, overlays, cutouts, eraseBg, inpaintAI, localDetect, depth, cachedFor, warm };
})();
