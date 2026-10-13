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
  const expandPrompt = hint => "OUTPAINT / EXTEND THE CANVAS. The attached image is a photo placed on a larger canvas: the central rectangle is the real original photo, and the surrounding border area contains only a blurred, stretched placeholder copy of the edges. "
    + "Fill the border area with a seamless, natural, photorealistic continuation of the same scene — same lighting direction, perspective, color grading, depth of field, texture and materials — so the result looks like it was originally shot with a wider frame. "
    + "STRICT RULES: do NOT change, move, resize, re-light or restyle anything in the central original photo; keep the product exactly as is; do not add text, logos, watermarks, borders or new people; do not leave blur placeholders visible. "
    + (hint ? "Scene guidance for the extended area: " + hint + ". " : "") + "Output the complete image at the same aspect ratio as the input canvas.";
  const editPrompt = text => "EDIT THIS IMAGE according to the following instruction: " + String(text).trim() + ". "
    + "Keep the product's exact shape, proportions, label artwork, packaging text and logos unchanged unless the instruction explicitly says otherwise. Keep the same framing and composition, photorealistic result, natural lighting, no watermark, no added text unless requested, no borders. Output the edited image.";

  /* ── حالة اللوحات ── */
  const S = { kind: "", id: "", src: "", srcC: null, res: null, resP: null, busy: false, msg: "", opt: { mode: "ratio", ratio: 1, anchor: "center", l: 20, r: 20, t: 0, b: 0, hint: "", text: "" } };
  const PRESETS = [["🎨 غيّر لون المنتج", "غيّر لون المنتج إلى اللون: "], ["💡 إضاءة استوديو", "حسّن الإضاءة لتصبح إضاءة استوديو احترافية ناعمة مع ظلال طبيعية"], ["🖼️ خلفية جديدة", "استبدل الخلفية بخلفية: "], ["🧹 إزالة عنصر", "أزل من الصورة العنصر التالي وأكمل الخلفية بشكل طبيعي: "], ["✨ لمسة إعلان", "اجعل الصورة بأسلوب إعلاني فاخر مع إضاءة سينمائية وانعكاسات خفيفة"], ["🌿 أجواء طبيعية", "ضع المنتج في أجواء طبيعية دافئة بين نباتات وإضاءة صباحية"]];
  const stateBar = () => { const r = (typeof ImgGen !== "undefined" && ImgGen.ready) ? ImgGen.ready() : { ok: false, nokey: true }; return r.ok ? '<div class="ep-n" style="color:#16a34a">✔ Alyssum API جاهزة — تُحسب التكلفة وتُطلب موافقتك قبل كل توليد.</div>' : '<div class="ep-n" style="color:#b45309">⚠️ هذه الأداة تحتاج تفعيل Alyssum API: أدخل مفتاح الاتصال من «إعدادات مولّد الصور». (الأدوات المحلية — الممحاة ولمسات وتصحيح ونزع الخلفية — تعمل بلا مفتاح.)</div>'; };
  function panel(kind) {
    const o = S.opt;
    if (kind === "xp") return `<div class="pbx-pz" id="pbai"><p>وسّع خلفية الصورة بالذكاء الاصطناعي ليكبر المشهد حول المنتج (لتحويل صورة مربعة إلى طولية أو عريضة…). يبقى المنتج كما هو بالبكسل.</p>${stateBar()}
<div class="rt-g"><label>طريقة التوسيع <select id="pbai-mode" class="pbx-small"><option value="ratio"${o.mode === "ratio" ? " selected" : ""}>إلى نسبة معيّنة</option><option value="dirs"${o.mode === "dirs" ? " selected" : ""}>بنسبة % لكل اتجاه</option></select></label></div>
<div class="rt-g" id="pbai-ratio" style="${o.mode === "ratio" ? "" : "display:none"}"><label>النسبة <select id="pbai-r" class="pbx-small">${RATIOS.map(([n, v]) => `<option value="${v}"${Math.abs(o.ratio - v) < .001 ? " selected" : ""}>${n}</option>`).join("")}</select></label><label>موضع الأصل <select id="pbai-a" class="pbx-small">${ANCH.map(a => `<option value="${a[0]}"${o.anchor === a[0] ? " selected" : ""}>${a[1]}</option>`).join("")}</select></label></div>
<div class="rt-g" id="pbai-dirs" style="${o.mode === "dirs" ? "" : "display:none"}">${[["l", "يسار"], ["r", "يمين"], ["t", "أعلى"], ["b", "أسفل"]].map(([k, n]) => `<label>${n} % <input type="number" id="pbai-d${k}" min="0" max="100" value="${o[k]}" style="width:64px"></label>`).join("")}</div>
<div class="rt-g"><label>وصف المشهد في المنطقة الجديدة (اختياري)<textarea id="pbai-hint" rows="2" style="width:100%" placeholder="مثال: امتداد طاولة خشبية وضوء دافئ">${esc(o.hint)}</textarea></label></div>
<button type="button" class="pbx-small pz-go" data-ai="expand">✨ وسّع الخلفية</button><div id="pbai-msg" class="ep-n" style="min-height:1.3em">${esc(S.msg)}</div><div id="pbai-res"></div></div>`;
    return `<div class="pbx-pz" id="pbai"><p>اكتب بالعربية ما تريد تغييره في الصورة، ويعدّلها الذكاء الاصطناعي مع الحفاظ على المنتج وملصقاته.</p>${stateBar()}
<div class="pbrt-row">${PRESETS.map((p, i) => `<button type="button" class="pbx-small" data-ai="preset" data-i="${i}">${p[0]}</button>`).join("")}</div>
<div class="rt-g"><label>التعليمات<textarea id="pbai-text" rows="4" style="width:100%" placeholder="مثال: غيّر لون الغطاء إلى الذهبي وأضف ظلاً ناعماً تحت المنتج">${esc(o.text)}</textarea></label></div>
<button type="button" class="pbx-small pz-go" data-ai="edit">✨ نفّذ التعديل</button><div id="pbai-msg" class="ep-n" style="min-height:1.3em">${esc(S.msg)}</div><div id="pbai-res"></div></div>`;
  }
  const say = t => { S.msg = t; const e = $("pbai-msg"); if (e) e.textContent = t; };
  function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { const c = mk(im.naturalWidth, im.naturalHeight); c.getContext("2d").drawImage(im, 0, 0); res(c); }; im.onerror = () => rej(new Error("تعذّر تحميل الصورة")); im.src = A().localize(String(src)); }); }
  const blobOf = (c, type) => new Promise(r => c.toBlob(r, type || "image/webp", .93));
  const readForm = () => {
    const o = S.opt, v = id => ($(id) || {}).value; if ($("pbai-mode")) o.mode = v("pbai-mode") || o.mode; if ($("pbai-r")) o.ratio = +v("pbai-r") || o.ratio; if ($("pbai-a")) o.anchor = v("pbai-a") || o.anchor;
    ["l", "r", "t", "b"].forEach(k => { if ($("pbai-d" + k)) o[k] = Math.max(0, Math.min(100, +v("pbai-d" + k) || 0)); }); if ($("pbai-hint")) o.hint = v("pbai-hint") || ""; if ($("pbai-text")) o.text = v("pbai-text") || "";
  };
  const errText = e => e && e.code === "NOKEY" ? "أدخل مفتاح Alyssum API من «إعدادات مولّد الصور» لتفعيل هذه الأداة" : e && e.code === "OFF" ? "التوليد الذكي للصور معطّل من الإعدادات" : "⚠️ " + (e && e.message || e);
  function showRes(cv, note) {
    const r = $("pbai-res"); if (!r) return; S.res = cv; const u = cv.toDataURL("image/webp", .9);
    r.innerHTML = `<div style="border-radius:8px;overflow:hidden;background:repeating-conic-gradient(#d8d4c8 0 25%,#fff 0 50%) 50%/14px 14px;margin:.4rem 0"><img src="${u}" alt="" style="max-width:100%;display:block;margin:auto"></div><div class="pbrt-row"><button type="button" class="pbx-small pz-go" data-ai="apply">✔ تطبيق على الصورة</button><button type="button" class="pbx-small" data-ai="discard">تجاهل</button></div>${note ? '<div class="ep-n">' + esc(note) + '</div>' : ""}`;
  }
  async function run(kind, inf) {
    if (S.busy) return; readForm(); S.id = inf.node.id; S.busy = true;
    try {
      if (typeof ImgGen === "undefined" || !ImgGen.edit) throw new Error("مولّد الصور غير متاح");
      say("⏳ جارٍ تجهيز الصورة…"); const src0 = await loadImg(inf.set.src), k0 = Math.min(1, 1600 / Math.max(src0.width, src0.height)), src = k0 < 1 ? (() => { const c = mk(src0.width * k0, src0.height * k0); c.getContext("2d").drawImage(src0, 0, 0, c.width, c.height); return c; })() : src0;
      if (kind === "expand") {
        const o = S.opt, p = plan(src.width, src.height, o.mode === "dirs" ? { dirs: { l: o.l, r: o.r, t: o.t, b: o.b } } : { ratio: o.ratio, anchor: o.anchor }); if (!p.grow) { say("النسبة المطلوبة لا تحتاج توسيعاً — اختر نسبة مختلفة أو زد الاتجاهات"); S.busy = false; return; }
        const pad = padded(src, p), r = await ImgGen.edit({ blob: await blobOf(pad, "image/png"), prompt: expandPrompt(o.hint.trim()), W: p.W, H: p.H, title: "توسيع الخلفية بالذكاء الاصطناعي" }); if (!r) { say(""); S.busy = false; return; }
        const fin = restore(r.canvas, src, p); S.resP = p; showRes(fin, "الحجم الناتج " + p.W + "×" + p.H + " — المنتج الأصلي محفوظ كما هو."); say("✅ تمّ التوسيع — راجع النتيجة ثم طبّقها");
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
    try { const blob = await blobOf(S.res), path = await A().uploadBlob(blob, "ai-" + Date.now().toString(36), { max: 4096, q: .93 }), q = A().find(S.id || inf.node.id); if (q && path) { q.node.set.src = path; delete q.node.set.crop; A().E.nextLabel = S.kind === "xp" ? "توسيع خلفية الصورة" : "تعديل ذكي للصورة"; S.res = null; const r = $("pbai-res"); if (r) r.innerHTML = ""; A().commitAfter(q.node.id); say("✅ طُبّق على الصورة"); } }
    catch (e) { say("⚠️ " + (e.message || e)); }
    S.busy = false;
  }
  function mount(host, inf, kind) {
    S.kind = kind; if (S.id !== inf.node.id) { S.res = null; S.msg = ""; } S.id = inf.node.id;
    const root = host.querySelector("#pbai"); if (!root) return;
    root.addEventListener("change", e => { readForm(); if (e.target.id === "pbai-mode") { $("pbai-ratio").style.display = S.opt.mode === "ratio" ? "" : "none"; $("pbai-dirs").style.display = S.opt.mode === "dirs" ? "" : "none"; } });
    root.addEventListener("input", readForm);
    root.addEventListener("click", e => {
      const t = e.target.closest("[data-ai]"); if (!t) return; const k = t.dataset.ai;
      if (k === "expand") run("expand", inf); else if (k === "edit") run("edit", inf); else if (k === "apply") apply(inf);
      else if (k === "discard") { S.res = null; const r = $("pbai-res"); if (r) r.innerHTML = ""; say(""); }
      else if (k === "preset") { const p = PRESETS[+t.dataset.i], ta = $("pbai-text"); if (p && ta) { ta.value = p[1]; S.opt.text = p[1]; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
    });
  }
  const reset = () => { S.res = null; S.id = ""; S.msg = ""; S.busy = false; };
  return { panel, mount, reset, state: S, _t: { plan, padded, restore, expandPrompt, editPrompt } };
})();
