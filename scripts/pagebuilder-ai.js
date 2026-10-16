/* أدوات الصور الذكية (Alyssum API) داخل لوحة «تعديل الصورة» (+ استوديو الأزياء الذكي): ① توسيع الخلفية (Generative Expand) ② تعديل بالوصف (Magic Edit: لون المنتج، إضاءة، خلفية، إزالة…).
   تستعمل خدمة التوليد نفسها وضوابط التكلفة (ImgGen.edit: تأكيد قبل كل طلب، حدّ إنفاق، لا إعادة محاولة تلقائية). تُحفظ الصورة الأصلية بعد التوليد كما هي:
   في التوسيع تُلصق المنطقة الأصلية فوق الناتج بحافة مُنعَّمة فلا يغيّر النموذج بكسلاً واحداً من المنتج. تعمل الأدوات المحلية (الممحاة، لمسات وتصحيح) بلا مفتاح. */
const PBAI = (() => {
  const A = () => PBApp;
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MAXD = 2048;

  try { const d = localStorage.getItem(PLS); if (d) { const im = new Image(); im.onload = () => { const c = mk(im.naturalWidth, im.naturalHeight); c.getContext("2d").drawImage(im, 0, 0); S.person = { c, w: c.width, h: c.height }; S.remember = true; }; im.src = d; } } catch (e) { }
  const keepPerson = () => { try { if (S.remember && S.person) { const c = S.person.c, k = Math.min(1, 1000 / Math.max(c.width, c.height)), t = mk(c.width * k, c.height * k); t.getContext("2d").drawImage(c, 0, 0, t.width, t.height); localStorage.setItem(PLS, t.toDataURL("image/jpeg", .85)); } else localStorage.removeItem(PLS); } catch (e) { } };
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
  const PLS = "pbx_tryon_person";      // صورة الشخص تُحفظ على هذا الجهاز فقط وبموافقة صريحة («تذكّر صورتي»)
  const S = { rc: { item: "", sel: ["red", "navy"], custom: "#3366cc", useCustom: false }, ps: [0, 1, 2], person: null, remember: false, tpart: "auto", shotI: 0, kind: "", id: "", src: "", srcC: null, res: null, resP: null, busy: false, msg: "", fa: { who: "mannequin", pose: "stand", bg: "white", ratio: "same" }, opt: { mode: "ratio", ratio: 1, anchor: "center", l: 20, r: 20, t: 0, b: 0, hint: "", text: "" } };
  const PRESETS = [["🎨 غيّر لون المنتج", "غيّر لون المنتج إلى اللون: "], ["💡 إضاءة استوديو", "حسّن الإضاءة لتصبح إضاءة استوديو احترافية ناعمة مع ظلال طبيعية"], ["🖼️ خلفية جديدة", "استبدل الخلفية بخلفية: "], ["🧹 إزالة عنصر", "أزل من الصورة العنصر التالي وأكمل الخلفية بشكل طبيعي: "], ["✨ لمسة إعلان", "اجعل الصورة بأسلوب إعلاني فاخر مع إضاءة سينمائية وانعكاسات خفيفة"], ["🌿 أجواء طبيعية", "ضع المنتج في أجواء طبيعية دافئة بين نباتات وإضاءة صباحية"]];
  /* أساليب التصوير الذكية (AI Shot List): كل أسلوب = مشهد/إضاءة جاهزة يُعاد فيها تصوير المنتج مع حفظ شكله وملصقاته */
  const SHOTS = [["studio", "استوديو أبيض نظيف", "a clean seamless white studio with soft shadows"], ["marble", "رخام فاخر", "a luxurious white marble surface with soft gold accents and gentle window light"], ["nature", "أعشاب وطبيعة", "a natural setting with fresh green leaves and herbs, soft morning sunlight"], ["wood", "خشب ريفي دافئ", "a warm rustic wooden table with soft golden-hour light"], ["kitchen", "مطبخ عصري", "a bright modern kitchen counter with blurred background"], ["spa", "حمام وسبا", "a calm spa bathroom setting with towels, stones and soft steam"], ["gift", "هدية وتغليف", "a festive gift flat-lay with ribbons and tasteful wrapping paper"], ["beach", "صيف وشاطئ", "a sunny summer beach setting with sand and soft bokeh sea"], ["lantern", "أجواء رمضانية دافئة", "a warm festive evening mood with soft lantern light and elegant dark background"], ["neon", "نيون ليلي", "a dark stylish background with colorful neon rim lighting and reflections"], ["splash", "انتعاش وماء", "a fresh dynamic scene with water droplets and splashes, cool bright light"], ["pop", "لون صارخ بسيط", "a bold minimal solid color backdrop that contrasts with the product, hard shadow, pop-art feel"],
    /* مشاهد الاستخدام اليومي (Product Staging): العنصر الرابع true = يظهر إنسان (يد/جسم بلا وجه) بلباس محتشم */
    ["hand", "في اليد", "the product held naturally in one hand, only the hand and forearm visible with a long sleeve covering the arm, softly blurred everyday background, natural window light", true], ["table", "على طاولة بجو يومي", "the product placed on a wooden cafe table among a few tasteful everyday props (a cup, a notebook, a plant), softly blurred background, natural daylight", true], ["worn", "ملبوس أو محمول", "the product being worn or carried naturally by a person shown from the neck down WITHOUT showing the face, wearing plain modest full-coverage clothing (long sleeves, long trousers or skirt, a loose top), natural everyday setting, softly blurred background", true], ["desk", "مكتب وعمل", "the product on a tidy modern work desk next to a laptop and a notebook, soft morning light, shallow depth of field", true], ["gifting", "تسليم كهدية", "the product being offered as a gift in two hands (only hands and long-sleeved forearms visible), warm soft background with ribbon details", true]];
  const shotPrompt = (desc, extra, life) => "RE-SHOOT THIS PRODUCT PHOTO. Keep the product exactly as it is — same shape, proportions, label artwork, packaging text, logos and colors — and place it in this scene: " + desc + ". " + (extra ? "Extra direction: " + extra + ". " : "") + "Photorealistic commercial photography, natural contact shadows and reflections, same camera angle, product centered and fully visible, " + (life ? "if a person appears show no face and no bare skin other than the hands (and the covering must be modest), " : "no people, ") + "no extra text, no watermark. Output the new image.";
  /* استوديو الأزياء الذكي: صورة قطعة ملابس ← عارض افتراضي | مانيكان غير مرئي | تصوير مسطح | إزالة تجاعيد. القواعد: القطعة كما هي تماماً، بلا وجه حقيقي افتراضياً، ولا جلد مكشوف خارج الوجه واليدين، والمرأة بخمار ولباس محتشم */
  const FA_MODES = [["model", "عارض افتراضي", "ألبس القطعة على عارض"], ["ghost", "مانيكان غير مرئي", "القطعة بشكل ثلاثي الأبعاد بلا عارض"], ["flat", "تصوير مسطح", "القطعة مفرودة على خلفية نظيفة"], ["wrinkle", "إزالة التجاعيد", "كوي رقمي للقطعة"]];
  const FA_WHO = [["mannequin", "مانيكان بلا وجه"], ["man", "رجل"], ["woman", "امرأة محجبة بلباس محتشم"]];
  const FA_POSE = [["stand", "واقف أمامي"], ["walk", "يمشي"], ["side", "نصف جانبي"]];
  const FA_BG = [["white", "استوديو أبيض نظيف"], ["grey", "رمادي ناعم"], ["street", "شارع عصري ضبابي"], ["home", "داخلي دافئ"]];
  const FA_BGD = { white: "a clean seamless white studio background", grey: "a soft light-grey seamless studio background", street: "a softly blurred modern city street background with natural daylight", home: "a softly blurred warm bright interior background" };
  const FA_KEEP = "Keep the garment EXACTLY as in the input photo: same cut, length, sleeves, collar, fabric texture, color, patterns, prints, embroidery, buttons, zippers, stitching, labels and logos — do not redesign, recolor, shorten or add details. ";
  const FA_END = "Photorealistic professional e-commerce fashion photography, natural soft lighting with realistic shadows, sharp focus on the garment, no watermark, no extra text, no brand logos that are not on the garment, no borders. Output the final image.";
  function fashionPrompt(mode, o) {
    o = o || {}; const bg = FA_BGD[o.bg] || FA_BGD.white;
    if (mode === "wrinkle") return "RETOUCH THIS GARMENT PHOTO: remove wrinkles, creases and folds from the fabric so it looks freshly steamed and smooth, while keeping the natural drape and fabric texture. " + FA_KEEP + "Keep the same framing, background and composition. " + FA_END;
    if (mode === "ghost") return "Create a GHOST MANNEQUIN (invisible mannequin) product photo of the garment from the input photo: the garment appears filled out with natural 3D volume as if worn by an invisible person — show the inside back of the collar and neckline where visible — with NO mannequin, NO person, NO hanger visible. " + FA_KEEP + "Centered, front view, on " + bg + ". " + FA_END;
    if (mode === "flat") return "Create a FLAT LAY product photo of the garment from the input photo: neatly laid flat, smoothed and symmetrical, photographed straight from above, no wrinkles, on " + bg + ", with a soft natural shadow. No person, no mannequin, no hanger, no props. " + FA_KEEP + FA_END;
    const pose = { stand: "standing straight facing the camera in a relaxed natural pose", walk: "walking naturally with a confident stride", side: "turned slightly to the side in an elegant three-quarter pose" }[o.pose] || "standing straight facing the camera";
    const who = o.who === "man" ? "a male fashion model with a natural, neutral expression, wearing the garment together with plain modest complementary clothing for the rest of the outfit (full-length trousers or matching neutral pieces)"
      : o.who === "woman" ? "a female fashion model who wears a plain, tasteful hijab (headscarf) fully covering her hair and neck, and modest loose full-coverage clothing: long sleeves and full-length bottoms or the garment worn modestly over neutral layers — NO bare arms, NO bare legs, only face and hands visible"
      : "a plain faceless white mannequin torso-to-feet form without any face or facial features";
    return "Show the garment from the input photo being worn by " + who + ", " + pose + ", on " + bg + ". " + FA_KEEP + "The model must look natural and realistic, proportionate, with correct hands; do not show skin other than the face and hands. " + FA_END;
  }
  /* تجربة افتراضية: الصورة المحدّدة في الصفحة = القطعة، وصورة الشخص تُرفع من الجهاز (تبقى في الذاكرة فقط ولا تُحفظ). الصورة الأولى للنموذج = الشخص، والثانية = القطعة */
  const tryOnPrompt = o => "VIRTUAL TRY-ON. Image 1 is a photo of a real person. Image 2 is a garment product photo. Dress the person from Image 1 in the garment from Image 2. "
    + "STRICT RULES: keep the person's face, identity, skin tone, hair or hijab, body shape, pose, hands and the background EXACTLY as in Image 1; only the clothing changes. Replace only the clothing area the garment covers (" + ({ top: "upper body", bottom: "lower body", full: "full outfit / dress", auto: "whatever part of the body the garment is made for" }[o && o.part] || "whatever part of the body the garment is made for") + "). "
    + "Keep the garment EXACTLY as in Image 2: same cut, length, sleeves, collar, fabric, color, patterns, prints, buttons and logos — fit it naturally to the person's body with realistic drape, folds, shadows and perspective. "
    + "Do not expose any more skin than the original photo shows: no nudity, no tighter or more revealing result than the garment itself. No watermark, no added text, no borders. Output the final image at the same framing as Image 1.";
  /* صورة من وصف نصي (بلا صورة مرجعية): نافذة مستقلة تضيف الناتج للصفحة أو تحفظه في المكتبة */
  const TX_SIZES = [["1:1", 1, 1], ["4:5", 4, 5], ["9:16", 9, 16], ["16:9", 16, 9]];
  const TX_IDEAS = ["عبوة منتج على طاولة رخامية بإضاءة ناعمة", "خلفية خضراء من أوراق نباتية للإعلانات", "مشهد رمضاني دافئ بفوانيس ونجوم", "نمط هندسي إسلامي أنيق بألوان هادئة"];
  const textPrompt = (d, ratio) => "GENERATE A NEW IMAGE from this description: " + String(d).trim() + ". Photorealistic, professional commercial quality, balanced composition suited to " + ratio + " framing, natural lighting. No text, no letters, no logos, no watermark, no borders. If people appear they must be fully and modestly dressed (women with a hijab and full-coverage clothing), with no bare skin except face and hands. Output only the image.";
  const T = { res: null, busy: false };
  function openTx() {
    if (!A().E || !A().E.page) return; const old = $("pbx-tx"); if (old) old.remove();
    const bg = document.createElement("div"); bg.id = "pbx-tx"; bg.setAttribute("style", "position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem");
    bg.innerHTML = `<div style="background:rgba(9,24,18,.985);color:#fff;border:1px solid rgba(198,254,23,.35);border-radius:16px;max-width:520px;width:100%;max-height:92vh;overflow:auto;padding:1rem" dir="rtl"><b>✨ صورة من وصف نصي</b><p class="ep-n">اكتب ما تريد رؤيته ويُولَّد صورة جديدة بالذكاء الاصطناعي (Alyssum API) بعد حساب التكلفة وموافقتك.</p>${stateBar()}
<textarea id="pbtx-t" rows="4" style="width:100%;box-sizing:border-box" placeholder="مثال: عبوة كريم على طاولة رخامية مع أوراق خضراء وإضاءة صباحية"></textarea>
<div class="pbrt-row" style="margin:.3rem 0">${TX_IDEAS.map((x, i) => `<button type="button" class="pbx-small" data-txi="${i}">${esc(x)}</button>`).join("")}</div>
<div class="rt-g"><label>المقاس <select id="pbtx-r" class="pbx-small">${TX_SIZES.map(x => `<option value="${x[0]}">${x[0]}</option>`).join("")}</select></label></div>
<div class="pbrt-row"><button type="button" class="pbx-small pz-go" data-txb="go">✨ ولّد الصورة</button><button type="button" class="pbx-small" data-txb="close">إغلاق</button></div>
<div id="pbtx-m" class="ep-n" style="min-height:1.3em"></div><div id="pbtx-o"></div></div>`;
    document.body.appendChild(bg); T.res = null;
    const m = t => { const e = $("pbtx-m"); if (e) e.textContent = t; };
    bg.addEventListener("click", async e => {
      if (e.target === bg) { bg.remove(); return; }
      const ib = e.target.closest("[data-txi]"); if (ib) { $("pbtx-t").value = TX_IDEAS[+ib.dataset.txi]; return; }
      const b = e.target.closest("[data-txb]"); if (!b) return; const k = b.dataset.txb;
      if (k === "close") { bg.remove(); return; }
      if (k === "go") {
        if (T.busy) return; const d = $("pbtx-t").value.trim(); if (!d) { m("اكتب وصف الصورة أولاً"); return; }
        const sz = TX_SIZES.find(x => x[0] === $("pbtx-r").value) || TX_SIZES[0], mx = 1536, W = sz[1] >= sz[2] ? mx : Math.round(mx * sz[1] / sz[2]), H = sz[1] >= sz[2] ? Math.round(mx * sz[2] / sz[1]) : mx;
        T.busy = true; m("⏳ جارٍ التوليد…");
        try {
          if (typeof ImgGen === "undefined" || !ImgGen.edit) throw new Error("مولّد الصور غير متاح");
          const r = await ImgGen.edit({ textOnly: true, prompt: textPrompt(d, sz[0]), W, H, title: "صورة من وصف نصي" }); if (!r) { m(""); T.busy = false; return; }
          T.res = r; $("pbtx-o").innerHTML = `<div style="margin:.4rem 0;border-radius:8px;overflow:hidden"><img src="${r.canvas.toDataURL("image/webp", .85)}" alt="" style="max-width:100%;display:block;margin:auto"></div><div class="pbrt-row"><button type="button" class="pbx-small pz-go" data-txb="add">＋ أضفها للصفحة</button><button type="button" class="pbx-small" data-txb="go">↻ ولّد غيرها</button></div>`; m("✅ تمّ التوليد");
        } catch (x) { m(errText(x)); }
        T.busy = false;
      } else if (k === "add" && T.res) {
        try { m("⏳ جارٍ الرفع…"); const path = await A().uploadBlob(T.res.blob, "tx-" + Date.now().toString(36), { max: 4096, q: .93 }); if (path && typeof PB !== "undefined") { A().insertSections([PB.mkS([PB.mkC([PB.mkW("image", { src: path, alt: "", hauto: true, fit: "cover" })])], { pad: { d: [20, 20, 20, 20], m: [14, 12, 14, 12] } })], "صورة من وصف نصي"); bg.remove(); } } catch (x) { m("⚠️ " + (x.message || x)); }
      }
    });
  }
  /* تلوين الملابس والمنتجات بالذكاء (Recolor): ألوان متعددة من صورة واحدة بموافقة تكلفة واحدة، مع حفظ نسيج القماش والطيّات والظلال */
  const RC_COLORS = [["red", "أحمر", "#c1272d", "deep red"], ["navy", "كحلي", "#1f2d5c", "navy blue"], ["green", "أخضر زيتي", "#556b2f", "olive green"], ["black", "أسود", "#151515", "black"], ["beige", "بيج", "#d8c3a5", "beige"], ["pink", "وردي", "#e8a0b8", "dusty pink"], ["purple", "بنفسجي", "#6a3d9a", "purple"], ["gold", "ذهبي", "#c8a24b", "gold"], ["white", "أبيض", "#f4f4f4", "white"], ["brown", "بني", "#6b4226", "chocolate brown"]];
  const recolorPrompt = (item, color) => "RECOLOR THE PRODUCT in this photo: change ONLY the color of " + (String(item || "").trim() ? "the " + String(item).trim() : "the main garment or product") + " to " + color + ". "
    + "Preserve the exact fabric/material texture, weave, stitching, folds, wrinkles, highlights, natural shading and shadows so the new color looks photographed, not painted over — do not flatten it with a flat overlay. "
    + "Keep everything else exactly the same: shape, proportions, patterns/prints/logos (only recolor them if they are part of the base color), background, lighting, framing and any person's skin, face and hair. No watermark, no added text. Output the edited image.";
  const stateBar = () => { const r = (typeof ImgGen !== "undefined" && ImgGen.ready) ? ImgGen.ready() : { ok: false, nokey: true }; return r.ok ? '<div class="ep-n" style="color:#16a34a">✔ Alyssum API جاهزة — تُحسب التكلفة وتُطلب موافقتك قبل كل توليد.</div>' : '<div class="ep-n" style="color:#b45309">⚠️ هذه الأداة تحتاج تفعيل Alyssum API: أدخل مفتاح الاتصال من «إعدادات مولّد الصور». (الأدوات المحلية — الممحاة ولمسات وتصحيح ونزع الخلفية — تعمل بلا مفتاح.)</div>'; };
  function panel(kind) {
    const o = S.opt;
    if (kind === "rc") { const r = S.rc; return `<div class="pbx-pz" id="pbai"><p>أنشئ عدة ألوان من صورة واحدة بلا إعادة تصوير: يتغير اللون فقط ويبقى نسيج القماش والطيّات والظلال طبيعية.</p>${stateBar()}
<div class="rt-g"><label>ما الذي تريد تلوينه؟ <input type="text" id="pbai-rci" value="${esc(r.item)}" placeholder="مثال: الفستان، الحقيبة، الغطاء" style="width:100%"></label></div>
<div class="ep-n"><b>اختر حتى 4 ألوان</b></div>
<div style="display:flex;flex-wrap:wrap;gap:.3rem">${RC_COLORS.map(x => `<label style="display:inline-flex;align-items:center;gap:.25rem;border:1.5px solid rgba(128,128,128,.4);border-radius:999px;padding:.2rem .55rem;font-size:.78rem;cursor:pointer"><input type="checkbox" data-rck="${x[0]}"${r.sel.includes(x[0]) ? " checked" : ""}><i style="width:14px;height:14px;border-radius:50%;background:${x[2]};border:1px solid rgba(128,128,128,.5)"></i>${x[1]}</label>`).join("")}</div>
<div class="rt-g"><label>أو لون مخصص <input type="color" id="pbai-rcc" value="${r.custom || "#3366cc"}"></label><label><input type="checkbox" id="pbai-rcu" ${r.useCustom ? "checked" : ""}> استعمل اللون المخصص</label></div>
<button type="button" class="pbx-small pz-go" data-ai="recolor">🎨 ولّد الألوان</button>
<div id="pbai-msg" class="ep-n" style="min-height:1.3em">${esc(S.msg)}</div><div id="pbai-res"></div></div>`; }
    if (kind === "ps") return `<div class="pbx-pz" id="pbai"><p>جلسة تصوير كاملة لمنتجك: اختر حتى <b>3 مشاهد</b> ويُصوَّر المنتج في كلٍّ منها بالذكاء الاصطناعي مع حفظ شكله وملصقاته، ثم تختار الأفضل. موافقة واحدة على التكلفة الإجمالية.</p>${stateBar()}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem">${SHOTS.map((x, i) => `<label style="border:1.5px solid rgba(128,128,128,.35);border-radius:8px;padding:.35rem .4rem;font-size:.78rem;cursor:pointer"><input type="checkbox" data-psk="${i}"${S.ps.includes(i) ? " checked" : ""}> ${x[1]}</label>`).join("")}</div>
<div class="rt-g"><label>توجيه إضافي (اختياري)<textarea id="pbai-hint" rows="2" style="width:100%" placeholder="مثال: ألوان دافئة وحدّ أدنى من العناصر">${esc(o.hint)}</textarea></label></div>
<button type="button" class="pbx-small pz-go" data-ai="pshoot">📸 ابدأ الجلسة</button>
<div id="pbai-msg" class="ep-n" style="min-height:1.3em">${esc(S.msg)}</div><div id="pbai-res"></div></div>`;
    if (kind === "to") return `<div class="pbx-pz" id="pbai"><p>اختر صورة القطعة في الصفحة، ثم ارفع <b>صورة شخص واحدة</b> لترى القطعة عليه. تبقى ملامحه وجسمه ووضعيته وخلفيته كما هي ويتغير اللباس فقط.</p>${stateBar()}
<div class="rt-g"><label class="pbx-small" style="cursor:pointer;display:block;text-align:center">📷 ارفع صورة الشخص<input type="file" accept="image/*" id="pbai-tp" style="display:none"></label><div class="ep-n" id="pbai-tpn">${S.person ? "✔ صورة الشخص جاهزة (" + S.person.w + "×" + S.person.h + ") — تبقى لكل قطعة تجرّبها بعدها" : "لم تُرفع صورة بعد"}</div><label><input type="checkbox" id="pbai-trem" ${S.remember ? "checked" : ""}> تذكّر صورتي على هذا الجهاز</label>${S.person ? '<button type="button" class="pbx-small" data-ai="tpdel">🗑 احذف صورتي</button>' : ""}<label>جزء الجسم <select id="pbai-tpart" class="pbx-small">${[["auto", "تلقائي"], ["top", "علوي"], ["bottom", "سفلي"], ["full", "إطلالة كاملة / فستان"]].map(x => `<option value="${x[0]}"${S.tpart === x[0] ? " selected" : ""}>${x[1]}</option>`).join("")}</select></label></div>
<button type="button" class="pbx-small pz-go" data-ai="tryon">✨ جرّب القطعة عليه</button>
<div class="ep-n">صورة الشخص لا تُحفظ في المتجر؛ تبقى في المتصفح فقط إن فعّلت «تذكّر صورتي» ويمكن حذفها في أي وقت. استعمل صوراً لك أو لمن وافق على ذلك.</div>
<div id="pbai-msg" class="ep-n" style="min-height:1.3em">${esc(S.msg)}</div><div id="pbai-res"></div></div>`;
    if (kind === "fa") { const f = S.fa, sel = (id, list, v) => `<select id="${id}" class="pbx-small">${list.map(x => `<option value="${x[0]}"${v === x[0] ? " selected" : ""}>${x[1]}</option>`).join("")}</select>`;
      return `<div class="pbx-pz" id="pbai"><p>ارفع صورة قطعة ملابس واحصل على صورة احترافية: على عارض افتراضي، أو بمانيكان غير مرئي، أو مفرودة، أو بعد إزالة التجاعيد. تبقى القطعة كما هي بقصّتها وألوانها ونقوشها.</p>${stateBar()}
<div class="rt-g"><label>العارض ${sel("pbai-fw", FA_WHO, f.who)}</label><label>الوضعية ${sel("pbai-fp", FA_POSE, f.pose)}</label><label>الخلفية ${sel("pbai-fb", FA_BG, f.bg)}</label><label>المقاس <select id="pbai-fr" class="pbx-small"><option value="same"${f.ratio === "same" ? " selected" : ""}>نفس مقاس الصورة</option><option value="4:5"${f.ratio === "4:5" ? " selected" : ""}>4:5 (متجر)</option><option value="1:1"${f.ratio === "1:1" ? " selected" : ""}>1:1</option><option value="9:16"${f.ratio === "9:16" ? " selected" : ""}>9:16 (ستوري)</option></select></label></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem">${FA_MODES.map(x => `<button type="button" class="pbx-small" data-ai="fashion" data-m="${x[0]}" style="padding:.5rem .3rem;white-space:normal"><b>${x[1]}</b><br><small>${x[2]}</small></button>`).join("")}</div>
<div class="ep-n">الاختيار الافتراضي مانيكان بلا وجه. العارض والوضعية تخصّ «عارض افتراضي» فقط.</div>
<div id="pbai-msg" class="ep-n" style="min-height:1.3em">${esc(S.msg)}</div><div id="pbai-res"></div></div>`; }
    if (kind === "sl") return `<div class="pbx-pz" id="pbai"><p>اختر أسلوب تصوير جاهزاً ويُعاد تصوير منتجك فيه بالذكاء الاصطناعي مع حفظ شكله وملصقاته.</p>${stateBar()}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem">${SHOTS.map((x, i) => `<button type="button" class="pbx-small" data-ai="shot" data-i="${i}" style="padding:.5rem .3rem;white-space:normal">${x[1]}</button>`).join("")}</div>
<div class="rt-g"><label>توجيه إضافي (اختياري)<textarea id="pbai-hint" rows="2" style="width:100%" placeholder="مثال: ألوان دافئة وحدّ أدنى من العناصر">${esc(o.hint)}</textarea></label></div>
<div id="pbai-msg" class="ep-n" style="min-height:1.3em">${esc(S.msg)}</div><div id="pbai-res"></div></div>`;
    if (kind === "xp") return `<div class="pbx-pz" id="pbai"><p>غيّر مقاس الصورة أو اتجاهها (مربع، طولي، عريض) <b>بالتوسيع الذكي</b> الذي يملأ المساحة الجديدة بما يطابق الأصل، أو <b>بلا ذكاء</b> بملء الهوامش بامتداد مموّه مجاني. للتوسيع الذكي: <b>اسحب مقابض الإطار البنفسجي حول الصورة إلى الخارج</b> حتى المكان الذي تريده (الصورة تبقى في مكانها)، ثم يُنشئ الذكاء امتداداً للصورة الأم ويعطيك <b>خيارين</b> لتختار بينهما.</p>${stateBar()}
<div class="rt-g"><label>أو اضبط الإطار حسب نسبة <select id="pbai-r" class="pbx-small">${RATIOS.map(([n, v]) => `<option value="${v}"${Math.abs(o.ratio - v) < .001 ? " selected" : ""}>${n}</option>`).join("")}</select></label><label>موضع الأصل <select id="pbai-a" class="pbx-small">${ANCH.map(a => `<option value="${a[0]}"${o.anchor === a[0] ? " selected" : ""}>${a[1]}</option>`).join("")}</select></label></div>
<div class="rt-g"><label>أو مقاس جاهز لمنصة <select id="pbai-sz" class="pbx-small"><option value="">— اختر —</option>${(typeof ImgGen !== "undefined" && ImgGen.sizes ? ImgGen.sizes() : []).map(g => `<optgroup label="${esc(g[0])}">${g[1].filter(x => x[0] !== "custom").map(x => `<option value="${x[2]}x${x[3]}"${o.sz && o.sz.w === x[2] && o.sz.h === x[3] ? " selected" : ""}>${esc(x[1])}</option>`).join("")}</optgroup>`).join("")}</select></label></div>
<div class="ep-n" id="pbai-xi" style="min-height:1.3em"></div>
<div class="rt-g"><label>وصف المشهد في المنطقة الجديدة (اختياري)<textarea id="pbai-hint" rows="2" style="width:100%" placeholder="مثال: امتداد طاولة خشبية وضوء دافئ">${esc(o.hint)}</textarea></label></div>
<div class="pbrt-row"><button type="button" class="pbx-small pz-go" data-ai="expand">✨ توسيع ذكي (خياران)</button><button type="button" class="pbx-small" data-ai="xlocal">↔ تغيير المقاس بلا ذكاء</button><button type="button" class="pbx-small" data-ai="xreset">↺ إعادة الإطار</button></div><div id="pbai-msg" class="ep-n" style="min-height:1.3em">${esc(S.msg)}</div><div id="pbai-res"></div></div>`;
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
    if ($("pbai-rci")) { S.rc.item = v("pbai-rci"); S.rc.custom = v("pbai-rcc"); S.rc.useCustom = $("pbai-rcu").checked; }
    if ($("pbai-tpart")) S.tpart = v("pbai-tpart");
    if ($("pbai-trem")) { const r = $("pbai-trem").checked; if (r !== S.remember) { S.remember = r; keepPerson(); } }
    if ($("pbai-fw")) S.fa = { who: v("pbai-fw"), pose: v("pbai-fp"), bg: v("pbai-fb"), ratio: v("pbai-fr") };
    if ($("pbai-sz")) { const z = v("pbai-sz"); if (z) { const [zw, zh] = z.split("x").map(Number); o.sz = { w: zw, h: zh }; } }
    if ($("pbai-hint")) o.hint = v("pbai-hint") || ""; if ($("pbai-text")) o.text = v("pbai-text") || "";
  };
  const errText = e => e && e.code === "NOKEY" ? "أدخل مفتاح Alyssum API من «إعدادات مولّد الصور» لتفعيل هذه الأداة" : e && e.code === "OFF" ? "التوليد الذكي للصور معطّل من الإعدادات" : "⚠️ " + (e && e.message || e);
  function showRes(list, note) {
    const r = $("pbai-res"); if (!r) return; list = Array.isArray(list) ? list : [list]; S.vars = list; S.res = list[0]; const many = list.length > 1;
    const card = (cv, i) => `<label style="display:block;cursor:pointer;border:2px solid ${i === 0 ? "#7c3aed" : "transparent"};border-radius:8px;padding:2px" data-vc="${i}"><div style="border-radius:6px;overflow:hidden;background:repeating-conic-gradient(#d8d4c8 0 25%,#fff 0 50%) 50%/14px 14px"><img src="${cv.toDataURL("image/webp", .85)}" alt="" style="max-width:100%;display:block;margin:auto"></div>${many ? `<div style="text-align:center;font-size:.8rem;margin-top:.2rem"><input type="radio" name="pbai-v" value="${i}"${i === 0 ? " checked" : ""}> الخيار ${i + 1}</div>` : ""}</label>`;
    if (S.kind !== "xp" && S.kind !== "ps" && S.kind !== "rc") { r.innerHTML = note ? '<div class="ep-n">' + esc(note) + '</div>' : ""; A().liveCanvas(S.id, S.res, { tab: S.kind, apply: () => apply({ node: { id: S.id } }), cancel: () => { S.res = null; S.vars = null; const r2 = $("pbai-res"); if (r2) r2.innerHTML = ""; say(""); } }); return; }      // النتيجة تظهر مباشرة على الصورة بـ«تنفيذ/إلغاء»
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
      if (kind === "expand" || kind === "xlocal") {
        const o = S.opt, x = A().xpGet && A().xpGet(), g = A().xpGeom ? A().xpGeom(S.id) : null, frame = !!(x && g && x.id === S.id && (x.l + x.r + x.t + x.b) > 0);
        let base = src;      // الإطار الظاهر قد تكون نسبته غير نسبة الملف (قصّ cover): نقصّ الأصل لنسبة الإطار كي تنطبق الإضافات على ما يراه المستخدم
        if (frame) { const fa = g.w / g.h, ia = src.width / src.height; if (Math.abs(ia - fa) > .02 * fa) { const cw = ia > fa ? src.height * fa : src.width, ch = ia > fa ? src.height : src.width / fa, c = mk(cw, ch); c.getContext("2d").drawImage(src, (src.width - cw) / 2, (src.height - ch) / 2, cw, ch, 0, 0, cw, ch); base = c; } }
        const p = frame ? plan(base.width, base.height, { dirs: { l: x.l / g.w * 100, r: x.r / g.w * 100, t: x.t / g.h * 100, b: x.b / g.h * 100 } }) : plan(base.width, base.height, { ratio: o.ratio, anchor: o.anchor });
        if (!p.grow) { say(frame ? "الإطار لم يخرج عن الصورة — اسحب مقبضاً إلى الخارج" : "النسبة المطلوبة لا تحتاج توسيعاً — اختر نسبة مختلفة أو اسحب الإطار"); S.busy = false; return; }
        if (kind === "xlocal") {      // تغيير مقاس مجاني: هوامش بامتداد مموّه (padded) ثم مقاس المنصة بالبكسل إن اختير
          const pad = padded(base, p), tz = o.sz && Math.abs(p.W / p.H - o.sz.w / o.sz.h) < .012 * (o.sz.w / o.sz.h) ? o.sz : null, k = tz ? Math.min(1, 2048 / Math.max(tz.w, tz.h)) : 1, out = tz ? mk(tz.w * k, tz.h * k) : pad;
          if (tz) out.getContext("2d").drawImage(pad, 0, 0, out.width, out.height); S.resP = p; S.frame = frame; showRes([out], "الحجم الناتج " + out.width + "×" + out.height + " — بلا ذكاء ولا تكلفة"); say("✅ جاهز — راجع النتيجة ثم طبّق"); S.busy = false; return;
        }
        const G = typeof ImgGen !== "undefined" ? ImgGen : null, e = G && G.estimate ? G.estimate() : null;
        if (e) { if (e.left < 2 * e.cost) throw new Error("بلغتَ حدّ الإنفاق — ارفعه من إعدادات مولّد الصور"); if (!confirm("توسيع الصورة بالذكاء الاصطناعي — خياران لتختار بينهما\nالتكلفة التقريبية: " + e.fmt(2 * e.cost) + " (" + e.fmt(e.cost) + " لكل خيار)\nالمقاس الناتج: " + p.W + "×" + p.H + "\nمتابعة؟")) { say(""); S.busy = false; return; } }
        const pad = padded(base, p), blob = await blobOf(pad, "image/png"); say("⏳ يُنشئ الذكاء خيارين…");
        const rs = await Promise.allSettled([0, 1].map(v => ImgGen.edit({ blob, prompt: expandPrompt(o.hint.trim(), v), W: p.W, H: p.H, title: "توسيع الصورة بالذكاء الاصطناعي", confirm: e ? false : undefined })));
        const ok = rs.filter(r => r.status === "fulfilled" && r.value).map(r => restore(r.value.canvas, base, p));
        if (!ok.length) { const bad = rs.find(r => r.status === "rejected"); if (bad) throw bad.reason; say(""); S.busy = false; return; }
        S.resP = p; S.frame = frame; showRes(ok, "الحجم الناتج " + p.W + "×" + p.H + " — الصورة الأصلية محفوظة كما هي" + (ok.length < 2 ? " (نجح خيار واحد فقط)" : "") + ". اختر الأفضل ثم طبّقه."); say("✅ جاهز — اختر أحد الخيارين");
      } else if (kind === "recolor") {
        const r = S.rc, names = r.sel.map(k => (RC_COLORS.find(x => x[0] === k) || [])[3]).filter(Boolean).slice(0, 4); if (r.useCustom && names.length < 4) names.push("the exact color " + r.custom);
        if (!names.length) { say("اختر لوناً واحداً على الأقل"); S.busy = false; return; }
        const e = ImgGen.estimate ? ImgGen.estimate() : null;
        if (e) { if (e.left < names.length * e.cost) throw new Error("بلغتَ حدّ الإنفاق — ارفعه من إعدادات مولّد الصور"); if (!confirm("تلوين بالذكاء الاصطناعي — " + names.length + " ألوان\nالتكلفة التقريبية: " + e.fmt(names.length * e.cost) + "\nمتابعة؟")) { say(""); S.busy = false; return; } }
        const blob = await blobOf(src, "image/png"); say("⏳ جارٍ توليد " + names.length + " ألوان…");
        const rs = await Promise.allSettled(names.map(n => ImgGen.edit({ blob, prompt: recolorPrompt(r.item, n), W: src.width, H: src.height, title: "تلوين — " + n, confirm: e ? false : undefined })));
        const ok = rs.filter(x => x.status === "fulfilled" && x.value).map(x => x.value.canvas);
        if (!ok.length) { const bad = rs.find(x => x.status === "rejected"); if (bad) throw bad.reason; say(""); S.busy = false; return; }
        showRes(ok, "نجح " + ok.length + " من " + names.length + " — اختر اللون ثم طبّقه (الصورة الأصلية تبقى في تاريخ التراجع)."); say("✅ جاهز — اختر لوناً");
      } else if (kind === "pshoot") {
        const idx = S.ps.filter(i => SHOTS[i]).slice(0, 3); if (!idx.length) { say("اختر مشهداً واحداً على الأقل"); S.busy = false; return; }
        const e = ImgGen.estimate ? ImgGen.estimate() : null;
        if (e) { if (e.left < idx.length * e.cost) throw new Error("بلغتَ حدّ الإنفاق — ارفعه من إعدادات مولّد الصور"); if (!confirm("تصوير المنتج بالذكاء الاصطناعي — " + idx.length + " مشاهد\nالتكلفة التقريبية: " + e.fmt(idx.length * e.cost) + "\nمتابعة؟")) { say(""); S.busy = false; return; } }
        const blob = await blobOf(src, "image/png"); say("⏳ جارٍ تصوير " + idx.length + " مشاهد…");
        const rs = await Promise.allSettled(idx.map(i => ImgGen.edit({ blob, prompt: shotPrompt(SHOTS[i][2], S.opt.hint.trim(), SHOTS[i][3]), W: src.width, H: src.height, title: "تصوير المنتج — " + SHOTS[i][1], confirm: e ? false : undefined })));
        const ok = rs.filter(r => r.status === "fulfilled" && r.value).map(r => r.value.canvas);
        if (!ok.length) { const bad = rs.find(r => r.status === "rejected"); if (bad) throw bad.reason; say(""); S.busy = false; return; }
        showRes(ok, "نجح " + ok.length + " من " + idx.length + " — اختر الأفضل ثم طبّقه."); say("✅ جاهز — اختر أحد الخيارات");
      } else if (kind === "tryon") {
        if (!S.person) { say("ارفع صورة الشخص أولاً"); S.busy = false; return; }
        const pc = S.person.c, k1 = Math.min(1, 1600 / Math.max(pc.width, pc.height)), W = Math.round(pc.width * k1), H = Math.round(pc.height * k1);
        const r = await ImgGen.edit({ blob: await blobOf(pc, "image/png"), extra: [await blobOf(src, "image/png")], prompt: tryOnPrompt({ part: S.tpart }), W, H, title: "تجربة افتراضية للقطعة" }); if (!r) { say(""); S.busy = false; return; }
        showRes(r.canvas, "تجربة افتراضية — " + W + "×" + H); say("✅ تمّ — راجع النتيجة ثم طبّقها");
      } else if (kind === "fashion") {
        const f = S.fa, m = FA_MODES.find(x => x[0] === S.faMode); if (!m) { S.busy = false; return; }
        let W = src.width, H = src.height; if (f.ratio !== "same") { const [a, b] = f.ratio.split(":").map(Number), r = a / b, mx = 1600; if (r >= 1) { W = mx; H = Math.round(mx / r); } else { H = mx; W = Math.round(mx * r); } }
        say("⏳ يعمل الاستوديو…"); const r = await ImgGen.edit({ blob: await blobOf(src, "image/png"), prompt: fashionPrompt(S.faMode, f), W, H, title: "استوديو أزياء ذكي — " + m[1] }); if (!r) { say(""); S.busy = false; return; }
        showRes(r.canvas, m[1] + " — " + W + "×" + H); say("✅ تمّ — راجع النتيجة ثم طبّقها");
      } else if (kind === "shot") {
        const sh = SHOTS[S.shotI]; if (!sh) { S.busy = false; return; }
        const r = await ImgGen.edit({ blob: await blobOf(src, "image/png"), prompt: shotPrompt(sh[2], S.opt.hint.trim(), sh[3]), W: src.width, H: src.height, title: "إعادة تصوير المنتج — " + sh[1] }); if (!r) { say(""); S.busy = false; return; }
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
    try { const blob = await blobOf(S.res), path = await A().uploadBlob(blob, "ai-" + Date.now().toString(36), { max: 4096, q: .93 }), q = A().find(S.id || inf.node.id); if (q && path) { q.node.set.src = path; delete q.node.set.crop; A().liveClear(false); if (S.kind === "xp" && S.frame && A().xpApply) A().xpApply(q.node.id); S.frame = false; A().E.nextLabel = S.kind === "xp" ? "توسيع خلفية الصورة" : S.kind === "sl" ? "أسلوب تصوير ذكي" : S.kind === "fa" ? "استوديو أزياء ذكي" : S.kind === "to" ? "تجربة افتراضية" : S.kind === "ps" ? "تصوير المنتج بالذكاء" : S.kind === "rc" ? "تلوين بالذكاء" : "تعديل ذكي للصورة"; S.res = null; const r = $("pbai-res"); if (r) r.innerHTML = ""; A().commitAfter(q.node.id); say("✅ طُبّق على الصورة"); } }
    catch (e) { say("⚠️ " + (e.message || e)); }
    S.busy = false;
  }
  function mount(host, inf, kind) {
    S.kind = kind; if (S.id !== inf.node.id) { S.res = null; S.msg = ""; } S.id = inf.node.id;
    const root = host.querySelector("#pbai"); if (!root) return;
    root.addEventListener("change", e => { if (e.target.dataset.rck != null) { const k = e.target.dataset.rck; S.rc.sel = S.rc.sel.filter(x => x !== k); if (e.target.checked) { S.rc.sel.push(k); if (S.rc.sel.length > 4) { const f = S.rc.sel.shift(), b = root.querySelector('[data-rck="' + f + '"]'); if (b) b.checked = false; } } return; } if (e.target.dataset.psk != null) { const i = +e.target.dataset.psk; S.ps = S.ps.filter(x => x !== i); if (e.target.checked) { S.ps.push(i); if (S.ps.length > 3) { const first = S.ps.shift(); const b = root.querySelector('[data-psk="' + first + '"]'); if (b) b.checked = false; } } return; } readForm(); if (e.target.name === "pbai-v") pickVar(+e.target.value); else if (e.target.id === "pbai-r" || e.target.id === "pbai-a") { S.opt.sz = null; const zz = $("pbai-sz"); if (zz) zz.value = ""; frameFromRatio(); } else if (e.target.id === "pbai-sz") { if (S.opt.sz) { S.opt.ratio = S.opt.sz.w / S.opt.sz.h; frameFromRatio(); } } });
    xpChanged();
    const tp = $("pbai-tp"); if (tp) tp.onchange = () => { const f = tp.files[0]; if (!f) return; const u = URL.createObjectURL(f), im = new Image(); im.onload = () => { const k = Math.min(1, 2000 / Math.max(im.naturalWidth, im.naturalHeight)), c = mk(im.naturalWidth * k, im.naturalHeight * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); S.person = { c, w: c.width, h: c.height }; keepPerson(); const n = $("pbai-tpn"); if (n) n.textContent = "✔ صورة الشخص جاهزة (" + c.width + "×" + c.height + ")"; }; im.onerror = () => say("تعذّر قراءة الصورة"); im.src = u; };
    root.addEventListener("input", readForm);
    root.addEventListener("click", e => {
      const t = e.target.closest("[data-ai]"); if (!t) return; const k = t.dataset.ai;
      if (k === "recolor") run("recolor", inf); else if (k === "pshoot") run("pshoot", inf); else if (k === "tryon") run("tryon", inf); else if (k === "fashion") { S.faMode = t.dataset.m; run("fashion", inf); } else if (k === "shot") { S.shotI = +t.dataset.i; run("shot", inf); } else if (k === "expand") run("expand", inf); else if (k === "xlocal") run("xlocal", inf); else if (k === "edit") run("edit", inf); else if (k === "apply") apply(inf); else if (k === "xreset") { A().xpSet && A().xpSet({ l: 0, r: 0, t: 0, b: 0 }); }
      else if (k === "tpdel") { S.person = null; S.remember = false; keepPerson(); const n = $("pbai-tpn"); if (n) n.textContent = "حُذفت صورتك"; t.remove(); }
      else if (k === "discard") { S.res = null; const r = $("pbai-res"); if (r) r.innerHTML = ""; say(""); }
      else if (k === "preset") { const p = PRESETS[+t.dataset.i], ta = $("pbai-text"); if (p && ta) { ta.value = p[1]; S.opt.text = p[1]; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
    });
  }
  const reset = () => { S.res = null; S.vars = null; S.frame = false; S.id = ""; S.msg = ""; S.busy = false; };
  return { panel, mount, openTx, reset, xpChanged, state: S, _t: { plan, padded, restore, expandPrompt, editPrompt, shotPrompt, SHOTS, fashionPrompt, FA_MODES, tryOnPrompt, textPrompt, keepPerson, recolorPrompt, RC_COLORS } };
})();
