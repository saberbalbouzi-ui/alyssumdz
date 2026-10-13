/* أدوات الصور الذكية (Alyssum API) داخل لوحة «تعديل الصورة»: ① توسيع الخلفية (Generative Expand) ② تعديل بالوصف (Magic Edit: لون المنتج، إضاءة، خلفية، إزالة…).
   تستعمل خدمة التوليد نفسها وضوابط التكلفة (ImgGen.edit: تأكيد قبل كل طلب، حدّ إنفاق، لا إعادة محاولة تلقائية). تُحفظ الصورة الأصلية بعد التوليد كما هي:
   في التوسيع تُلصق المنطقة الأصلية فوق الناتج بحافة مُنعَّمة فلا يغيّر النموذج بكسلاً واحداً من المنتج. تعمل الأدوات المحلية (الممحاة، لمسات وتصحيح) بلا مفتاح. */
const PBAI = (() => {
  const A = () => PBApp;
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MAXD = 2048;

  /* ── نقية ── */
  const RATIOS = [["1:1", 1], ["4:5", .8], ["9:16", 9 / 16], ["16:9", 16 / 9], ["3:2", 1.5], ["2:3", 2 / 3], ["21:9", 21 / 9]];
  const ANCH = [["center", "الوسط", .5, .5], ["left", "يسار", 0, .5], ["right", "يمين", 1, .5], ["top", "أعلى", .5, 0], ["bottom", "أسفل", .5, 1]];
  /* أبعاد القماش الجديد ومكان الصورة الأصلية: خياران — نسبة هدف (يكبر القماش ليحوي الأصل بتلك النسبة) أو نسب اتجاهات (يسار/يمين/أعلى/أسفل % من الأبعاد) */
  function plan(w, h, o) {
    let W, H, ox, oy;
    if (o.dirs) { const L = Math.max(0, o.dirs.l || 0) / 100, R = Math.max(0, o.dirs.r || 0) / 100, T = Math.max(0, o.dirs.t || 0) / 100, B = Math.max(0, o.dirs.b || 0) / 100; W = Math.round(w * (1 + L + R)); H = Math.round(h * (1 + T + B)); ox = Math.round(w * L); oy = Math.round(h * T); }
    else { const r = o.ratio || w / h; if (w / h < r) { H = h; W = Math.ceil(h * r); } else { W = w; H = Math.ceil(w / r); } const a = ANCH.find(x => x[0] === (o.anchor || "center")) || ANCH[0]; ox = Math.round((W - w) * a[2]); oy = Math.round((H - h) * a[3]); }
    const k = Math.min(1, MAXD / Math.max(W, H));
    return { W: Math.max(1, Math.round(W * k)), H: Math.max(1, Math.round(H * k)), ox: Math.round(ox * k), oy: Math.round(oy * k), w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), k, grow: W > w || H > h };
  }
  /* قماش جديد: الهوامش بنسخة مموّهة ممدودة من الأصل (سياق لوني للنموذج) ثم الأصل في مكانه */
  function padded(src, p) {
    const c = mk(p.W, p.H), g = c.getContext("2d"), r = Math.max(p.W / src.width, p.H / src.height);
    g.save(); try { g.filter = "blur(" + Math.round(Math.max(p.W, p.H) / 22) + "px)"; } catch (e) { } g.drawImage(src, (p.W - src.width * r) / 2, (p.H - src.height * r) / 2, src.width * r, src.height * r); g.restore();
    g.drawImage(src, p.ox, p.oy, p.w, p.h); return c;
  }
  /* إعادة الأصل فوق الناتج بحافة مُنعَّمة (feather بكسل) فلا يمسّ النموذج المنتج */
  function restore(result, src, p, feather) {
    const out = mk(p.W, p.H), g = out.getContext("2d"); g.drawImage(result, 0, 0, p.W, p.H);
    const f = Math.max(0, feather == null ? Math.round(Math.min(p.w, p.h) * .012) : feather), o = mk(p.w, p.h), og = o.getContext("2d"); og.drawImage(src, 0, 0, p.w, p.h);
    if (f > 0) { const m = mk(p.w, p.h), mg = m.getContext("2d"); try { mg.filter = "blur(" + (f / 2).toFixed(1) + "px)"; } catch (e) { } mg.fillStyle = "#fff"; mg.fillRect(f, f, p.w - 2 * f, p.h - 2 * f); og.globalCompositeOperation = "destination-in"; og.drawImage(m, 0, 0); }
    g.drawImage(o, p.ox, p.oy); return out;
  }
  const expandPrompt = (hint, v) => "OUTPAINT / EXTEND THE CANVAS. The attached image is a photo placed on a larger canvas: the central rectangle is the real original photo, and the surrounding border area contains only a blurred, stretched placeholder copy of the edges. "
    + "Fill the border area with a seamless, natural, photorealistic continuation of the same scene — same lighting direction, perspective, color grading, depth of field, texture and materials — so the result looks like it was originally shot with a wider frame. "
    + "STRICT RULES: do NOT change, move, resize, re-light or restyle anything in the central original photo; keep the product exactly as is; do not add text, logos, watermarks, borders or new people; do not leave blur placeholders visible. "
    + (hint ? "Scene guidance for the extended area: " + hint + ". " : "") + (v ? "VARIATION B: do not produce the most obvious continuation — compose the new area differently (different background elements, arrangement or props) while staying consistent with the scene. " : "") + "Output the complete image at the same aspect ratio as the input canvas.";
  const editPrompt = text => "EDIT THIS IMAGE according to the following instruction: " + String(text).trim() + ". "
    + "Keep the product's exact shape, proportions, label artwork, packaging text and logos unchanged unless the instruction explicitly says otherwise. Keep the same framing and composition, photorealistic result, natural lighting, no watermark, no added text unless requested, no borders. Output the edited image.";

  /* ── حالة اللوحات ── */
  const S = { shotI: 0, kind: "", id: "", src: "", srcC: null, res: null, resP: null, busy: false, msg: "", opt: { mode: "ratio", ratio: 1, anchor: "center", l: 20, r: 20, t: 0, b: 0, hint: "", text: "" } };
  const PRESETS = [["🎨 غيّر لون المنتج", "غيّر لون المنتج إلى اللون: "], ["💡 إضاءة استوديو", "حسّن الإضاءة لتصبح إضاءة استوديو احترافية ناعمة مع ظلال طبيعية"], ["🖼️ خلفية جديدة", "استبدل الخلفية بخلفية: "], ["🧹 إزالة عنصر", "أزل من الصورة العنصر التالي وأكمل الخلفية بشكل طبيعي: "], ["✨ لمسة إعلان", "اجعل الصورة بأسلوب إعلاني فاخر مع إضاءة سينمائية وانعكاسات خفيفة"], ["🌿 أجواء طبيعية", "ضع المنتج في أجواء طبيعية دافئة بين نباتات وإضاءة صباحية"]];
  /* أساليب التصوير الذكية (AI Shot List): كل أسلوب = مشهد/إضاءة جاهزة يُعاد فيها تصوير المنتج مع حفظ شكله وملصقاته */
  const SHOTS = [["studio", "استوديو أبيض نظيف", "a clean seamless white studio with soft shadows"], ["marble", "رخام فاخر", "a luxurious white marble surface with soft gold accents and gentle window light"], ["nature", "أعشاب وطبيعة", "a natural setting with fresh green leaves and herbs, soft morning sunlight"], ["wood", "خشب ريفي دافئ", "a warm rustic wooden table with soft golden-hour light"], ["kitchen", "مطبخ عصري", "a bright modern kitchen counter with blurred background"], ["spa", "حمام وسبا", "a calm spa bathroom setting with towels, stones and soft steam"], ["gift", "هدية وتغليف", "a festive gift flat-lay with ribbons and tasteful wrapping paper"], ["beach", "صيف وشاطئ", "a sunny summer beach setting with sand and soft bokeh sea"], ["lantern", "أجواء رمضانية دافئة", "a warm festive evening mood with soft lantern light and elegant dark background"], ["neon", "نيون ليلي", "a dark stylish background with colorful neon rim lighting and reflections"], ["splash", "انتعاش وماء", "a fresh dynamic scene with water droplets and splashes, cool bright light"], ["pop", "لون صارخ بسيط", "a bold minimal solid color backdrop that contrasts with the product, hard shadow, pop-art feel"]];
  const shotPrompt = (desc, extra) => "RE-SHOOT THIS PRODUCT PHOTO. Keep the product exactly as it is — same shape, proportions, label artwork, packaging text, logos and colors — and place it in this scene: " + desc + ". " + (extra ? "Extra direction: " + extra + ". " : "") + "Photorealistic commercial photography, natural contact shadows and reflections, same camera angle, product centered and fully visible, no people, no extra text, no watermark. Output the new image.";
  const stateBar = () => { const r = (typeof ImgGen !== "undefined" && ImgGen.ready) ? ImgGen.ready() : { ok: false, nokey: true }; return r.ok ? '<div class="ep-n" style="color:#16a34a">✔ Alyssum API جاهزة — تُحسب التكلفة وتُطلب موافقتك قبل كل توليد.</div>' : '<div class="ep-n" style="color:#b45309">⚠️ هذه الأداة تحتاج تفعيل Alyssum API: أدخل مفتاح الاتصال من «إعدادات مولّد الصور». (الأدوات المحلية — الممحاة ولمسات وتصحيح ونزع الخلفية — تعمل بلا مفتاح.)</div>'; };
  function panel(kind) {
    const o = S.opt;
    if (kind === "sl") return `<div class="pbx-pz" id="pbai"><p>اختر أسلوب تصوير جاهزاً ويُعاد تصوير منتجك فيه بالذكاء الاصطناعي مع حفظ شكله وملصقاته.</p>${stateBar()}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem">${SHOTS.map((x, i) => `<button type="button" class="pbx-small" data-ai="shot" data-i="${i}" style="padding:.5rem .3rem;white-space:normal">${x[1]}</button>`).join("")}</div>
<div class="rt-g"><label>توجيه إضافي (اختياري)<textarea id="pbai-hint" rows="2" style="width:100%" placeholder="مثال: ألوان دافئة وحدّ أدنى من العناصر">${esc(o.hint)}</textarea></label></div>
<div id="pbai-msg" class="ep-n" style="min-height:1.3em">${esc(S.msg)}</div><div id="pbai-res"></div></div>`;
    if (kind === "xp") return `<div class="pbx-pz" id="pbai"><p>وسّع الصورة بالذكاء الاصطناعي: <b>اسحب مقابض الإطار البنفسجي حول الصورة إلى الخارج</b> حتى المكان الذي تريده (الصورة تبقى في مكانها)، ثم يُنشئ الذكاء امتداداً للصورة الأم ويعطيك <b>خيارين</b> لتختار بينهما.</p>${stateBar()}
<div class="rt-g"><label>أو اضبط الإطار حسب نسبة <select id="pbai-r" class="pbx-small">${RATIOS.map(([n, v]) => `<option value="${v}"${Math.abs(o.ratio - v) < .001 ? " selected" : ""}>${n}</option>`).join("")}</select></label><label>موضع الأصل <select id="pbai-a" class="pbx-small">${ANCH.map(a => `<option value="${a[0]}"${o.anchor === a[0] ? " selected" : ""}>${a[1]}</option>`).join("")}</select></label></div>
<div class="ep-n" id="pbai-xi" style="min-height:1.3em"></div>
<div class="rt-g"><label>وصف المشهد في المنطقة الجديدة (اختياري)<textarea id="pbai-hint" rows="2" style="width:100%" placeholder="مثال: امتداد طاولة خشبية وضوء دافئ">${esc(o.hint)}</textarea></label></div>
<div class="pbrt-row"><button type="button" class="pbx-small pz-go" data-ai="expand">✨ أنشئ خيارين</button><button type="button" class="pbx-small" data-ai="xreset">↺ إعادة الإطار</button></div><div id="pbai-msg" class="ep-n" style="min-height:1.3em">${esc(S.msg)}</div><div id="pbai-res"></div></div>`;
    return `<div class="pbx-pz" id="pbai"><p>اكتب بالعربية ما تريد تغييره في الصورة، ويعدّلها الذكاء الاصطناعي مع الحفاظ على المنتج وملصقاته.</p>${stateBar()}
<div class="pbrt-row">${PRESETS.map((p, i) => `<button type="button" class="pbx-small" data-ai="preset" data-i="${i}">${p[0]}</button>`).join("")}</div>
<div class="rt-g"><label>التعليمات<textarea id="pbai-text" rows="4" style="width:100%" placeholder="مثال: غيّر لون الغطاء إلى الذهبي وأضف ظلاً ناعماً تحت المنتج">${esc(o.text)}</textarea></label></div>
<button type="button" class="pbx-small pz-go" data-ai="edit">✨ نفّذ التعديل</button><div id="pbai-msg" class="ep-n" style="min-height:1.3em">${esc(S.msg)}</div><div id="pbai-res"></div></div>`;
  }
  const say = t => { S.msg = t; const e = $("pbai-msg"); if (e) e.textContent = t; };
  function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { const c = mk(im.naturalWidth, im.naturalHeight); c.getContext("2d").drawImage(im, 0, 0); res(c); }; im.onerror = () => rej(new Error("تعذّر تحميل الصورة")); im.src = A().localize(String(src)); }); }
  const blobOf = (c, type) => new Promise(r => c.toBlob(r, type || "image/webp", .93));
  const readForm = () => {
    const o = S.opt, v = id => ($(id) || {}).value; if ($("pbai-r")) o.ratio = +v("pbai-r") || o.ratio; if ($("pbai-a")) o.anchor = v("pbai-a") || o.anchor;
    if ($("pbai-hint")) o.hint = v("pbai-hint") || ""; if ($("pbai-text")) o.text = v("pbai-text") || "";
  };
  const errText = e => e && e.code === "NOKEY" ? "أدخل مفتاح Alyssum API من «إعدادات مولّد الصور» لتفعيل هذه الأداة" : e && e.code === "OFF" ? "التوليد الذكي للصور معطّل من الإعدادات" : "⚠️ " + (e && e.message || e);
  function showRes(list, note) {
    const r = $("pbai-res"); if (!r) return; list = Array.isArray(list) ? list : [list]; S.vars = list; S.res = list[0]; const many = list.length > 1;
    const card = (cv, i) => `<label style="display:block;cursor:pointer;border:2px solid ${i === 0 ? "#7c3aed" : "transparent"};border-radius:8px;padding:2px" data-vc="${i}"><div style="border-radius:6px;overflow:hidden;background:repeating-conic-gradient(#d8d4c8 0 25%,#fff 0 50%) 50%/14px 14px"><img src="${cv.toDataURL("image/webp", .85)}" alt="" style="max-width:100%;display:block;margin:auto"></div>${many ? `<div style="text-align:center;font-size:.8rem;margin-top:.2rem"><input type="radio" name="pbai-v" value="${i}"${i === 0 ? " checked" : ""}> الخيار ${i + 1}</div>` : ""}</label>`;
    r.innerHTML = `<div style="display:grid;grid-template-columns:${many ? "1fr 1fr" : "1fr"};gap:.4rem;margin:.4rem 0">${list.map(card).join("")}</div><div class="pbrt-row"><button type="button" class="pbx-small pz-go" data-ai="apply">✔ تطبيق ${many ? "الخيار المحدّد" : "على الصورة"}</button><button type="button" class="pbx-small" data-ai="discard">تجاهل</button></div>${note ? '<div class="ep-n">' + esc(note) + '</div>' : ""}`;
  }
  const pickVar = i => { if (!S.vars || !S.vars[i]) return; S.res = S.vars[i]; document.querySelectorAll("#pbai-res [data-vc]").forEach(e => { e.style.borderColor = +e.dataset.vc === i ? "#7c3aed" : "transparent"; }); };
  /* ملخص الإطار الموسَّع تحت اللوحة (يُحدَّث أثناء سحب المقابض) */
  function xpChanged() {
    const e = $("pbai-xi"); if (!e) return; const x = A().xpGet && A().xpGet(), g = A().xpGeom && S.id ? A().xpGeom(S.id) : null;
    if (!x || !g || x.id !== S.id || !(x.l + x.r + x.t + x.b)) { e.textContent = "لم يُسحب الإطار بعد — اسحب أي مقبض بنفسجي إلى الخارج."; return; }
    const W = Math.round(g.w + x.l + x.r), H = Math.round(g.h + x.t + x.b); e.textContent = `يسار ${Math.round(x.l / g.w * 100)}% · يمين ${Math.round(x.r / g.w * 100)}% · أعلى ${Math.round(x.t / g.h * 100)}% · أسفل ${Math.round(x.b / g.h * 100)}% ← ${W}×${H}`;
  }
  /* ضبط الإطار حسب نسبة + موضع الأصل (خطة نقية ثم مقابض الإطار) */
  function frameFromRatio() {
    const g = A().xpGeom && S.id ? A().xpGeom(S.id) : null; if (!g || !A().xpSet) return; const o = S.opt, p = plan(g.w, g.h, { ratio: o.ratio, anchor: o.anchor });
    A().xpSet({ l: p.ox, t: p.oy, r: p.W - p.w - p.ox, b: p.H - p.h - p.oy });
  }
  async function run(kind, inf) {
    if (S.busy) return; readForm(); S.id = inf.node.id; S.busy = true;
    try {
      if (typeof ImgGen === "undefined" || !ImgGen.edit) throw new Error("مولّد الصور غير متاح");
      say("⏳ جارٍ تجهيز الصورة…"); const src0 = await loadImg(inf.set.src), k0 = Math.min(1, 1600 / Math.max(src0.width, src0.height)), src = k0 < 1 ? (() => { const c = mk(src0.width * k0, src0.height * k0); c.getContext("2d").drawImage(src0, 0, 0, c.width, c.height); return c; })() : src0;
      if (kind === "expand") {
        const o = S.opt, x = A().xpGet && A().xpGet(), g = A().xpGeom ? A().xpGeom(S.id) : null, frame = !!(x && g && x.id === S.id && (x.l + x.r + x.t + x.b) > 0);
        let base = src;      // الإطار الظاهر قد تكون نسبته غير نسبة الملف (قصّ cover): نقصّ الأصل لنسبة الإطار كي تنطبق الإضافات على ما يراه المستخدم
        if (frame) { const fa = g.w / g.h, ia = src.width / src.height; if (Math.abs(ia - fa) > .02 * fa) { const cw = ia > fa ? src.height * fa : src.width, ch = ia > fa ? src.height : src.width / fa, c = mk(cw, ch); c.getContext("2d").drawImage(src, (src.width - cw) / 2, (src.height - ch) / 2, cw, ch, 0, 0, cw, ch); base = c; } }
        const p = frame ? plan(base.width, base.height, { dirs: { l: x.l / g.w * 100, r: x.r / g.w * 100, t: x.t / g.h * 100, b: x.b / g.h * 100 } }) : plan(base.width, base.height, { ratio: o.ratio, anchor: o.anchor });
        if (!p.grow) { say(frame ? "الإطار لم يخرج عن الصورة — اسحب مقبضاً إلى الخارج" : "النسبة المطلوبة لا تحتاج توسيعاً — اختر نسبة مختلفة أو اسحب الإطار"); S.busy = false; return; }
        const G = typeof ImgGen !== "undefined" ? ImgGen : null, e = G && G.estimate ? G.estimate() : null;
        if (e) { if (e.left < 2 * e.cost) throw new Error("بلغتَ حدّ الإنفاق — ارفعه من إعدادات مولّد الصور"); if (!confirm("توسيع الصورة بالذكاء الاصطناعي — خياران لتختار بينهما\nالتكلفة التقريبية: " + e.fmt(2 * e.cost) + " (" + e.fmt(e.cost) + " لكل خيار)\nالمقاس الناتج: " + p.W + "×" + p.H + "\nمتابعة؟")) { say(""); S.busy = false; return; } }
        const pad = padded(base, p), blob = await blobOf(pad, "image/png"); say("⏳ يُنشئ الذكاء خيارين…");
        const rs = await Promise.allSettled([0, 1].map(v => ImgGen.edit({ blob, prompt: expandPrompt(o.hint.trim(), v), W: p.W, H: p.H, title: "توسيع الصورة بالذكاء الاصطناعي", confirm: e ? false : undefined })));
        const ok = rs.filter(r => r.status === "fulfilled" && r.value).map(r => restore(r.value.canvas, base, p));
        if (!ok.length) { const bad = rs.find(r => r.status === "rejected"); if (bad) throw bad.reason; say(""); S.busy = false; return; }
        S.resP = p; S.frame = frame; showRes(ok, "الحجم الناتج " + p.W + "×" + p.H + " — الصورة الأصلية محفوظة كما هي" + (ok.length < 2 ? " (نجح خيار واحد فقط)" : "") + ". اختر الأفضل ثم طبّقه."); say("✅ جاهز — اختر أحد الخيارين");
      } else if (kind === "shot") {
        const sh = SHOTS[S.shotI]; if (!sh) { S.busy = false; return; }
        const r = await ImgGen.edit({ blob: await blobOf(src, "image/png"), prompt: shotPrompt(sh[2], S.opt.hint.trim()), W: src.width, H: src.height, title: "إعادة تصوير المنتج — " + sh[1] }); if (!r) { say(""); S.busy = false; return; }
        showRes(r.canvas, "أسلوب: " + sh[1]); say("✅ تمّ — راجع النتيجة ثم طبّقها");
      } else {
        const text = S.opt.text.trim(); if (!text) { say("اكتب التعليمات أولاً أو اختر اقتراحاً"); S.busy = false; return; }
        const r = await ImgGen.edit({ blob: await blobOf(src, "image/png"), prompt: editPrompt(text), W: src.width, H: src.height, title: "تعديل الصورة بالوصف" }); if (!r) { say(""); S.busy = false; return; }
        showRes(r.canvas, "الحجم الناتج " + src.width + "×" + src.height); say("✅ تمّ التعديل — راجع النتيجة ثم طبّقها");
      }
    } catch (e) { say(errText(e)); }
    S.busy = false;
  }
  async function apply(inf) {
    if (!S.res || S.busy) return; S.busy = true; say("⏳ جارٍ الرفع…");
    try { const blob = await blobOf(S.res), path = await A().uploadBlob(blob, "ai-" + Date.now().toString(36), { max: 4096, q: .93 }), q = A().find(S.id || inf.node.id); if (q && path) { q.node.set.src = path; delete q.node.set.crop; if (S.kind === "xp" && S.frame && A().xpApply) A().xpApply(q.node.id); S.frame = false; A().E.nextLabel = S.kind === "xp" ? "توسيع خلفية الصورة" : S.kind === "sl" ? "أسلوب تصوير ذكي" : "تعديل ذكي للصورة"; S.res = null; const r = $("pbai-res"); if (r) r.innerHTML = ""; A().commitAfter(q.node.id); say("✅ طُبّق على الصورة"); } }
    catch (e) { say("⚠️ " + (e.message || e)); }
    S.busy = false;
  }
  function mount(host, inf, kind) {
    S.kind = kind; if (S.id !== inf.node.id) { S.res = null; S.msg = ""; } S.id = inf.node.id;
    const root = host.querySelector("#pbai"); if (!root) return;
    root.addEventListener("change", e => { readForm(); if (e.target.name === "pbai-v") pickVar(+e.target.value); else if (e.target.id === "pbai-r" || e.target.id === "pbai-a") frameFromRatio(); });
    xpChanged();
    root.addEventListener("input", readForm);
    root.addEventListener("click", e => {
      const t = e.target.closest("[data-ai]"); if (!t) return; const k = t.dataset.ai;
      if (k === "shot") { S.shotI = +t.dataset.i; run("shot", inf); } else if (k === "expand") run("expand", inf); else if (k === "edit") run("edit", inf); else if (k === "apply") apply(inf); else if (k === "xreset") { A().xpSet && A().xpSet({ l: 0, r: 0, t: 0, b: 0 }); }
      else if (k === "discard") { S.res = null; const r = $("pbai-res"); if (r) r.innerHTML = ""; say(""); }
      else if (k === "preset") { const p = PRESETS[+t.dataset.i], ta = $("pbai-text"); if (p && ta) { ta.value = p[1]; S.opt.text = p[1]; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
    });
  }
  const reset = () => { S.res = null; S.vars = null; S.frame = false; S.id = ""; S.msg = ""; S.busy = false; };
  return { panel, mount, reset, xpChanged, state: S, _t: { plan, padded, restore, expandPrompt, editPrompt, shotPrompt, SHOTS } };
})();
