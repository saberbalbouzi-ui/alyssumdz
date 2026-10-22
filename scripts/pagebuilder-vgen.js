/* مولّد الفيديو (Alyssum API): صورة منتج (1–4 صور) + قالب جاهز للتجارة الإلكترونية و/أو وصف حر + نسبة أبعاد ← فيديو MP4 قصير يُضاف للصفحة أو يُنزَّل.
   منفصل عن «تحريك الصورة» (PBVideo: حركة كاميرا محلية مجانية بلا ذكاء). يستعمل ImgGen.video (تأكيد تكلفة، حدّ إنفاق، لا إعادة تلقائية). */
const PBVGen = (() => {
  const A = () => PBApp, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /* قوالب حركة للتجارة الإلكترونية: [المعرّف، الاسم، وصف الحركة بالإنجليزية للنموذج] */
  const TPL = [
    ["orbit", "دوران بطيء حول المنتج", "the camera slowly orbits around the product, smooth cinematic motion, soft studio light", "عام"],
    ["zoom", "تقريب على التفاصيل", "slow push-in toward the product revealing fine texture and label details, shallow depth of field", "عام"],
    ["shine", "لمعان يمرّ على المنتج", "a soft sweep of light glides across the product surface highlighting its shine and shape, elegant premium feel", "عام"],
    ["float", "المنتج يطفو بلطف", "the product floats gently in the air with subtle rotation and soft shadows below, clean minimal background", "عام"],
    ["splash", "رذاذ ماء وانتعاش", "fresh water droplets and splashes burst around the product in slow motion, cool bright light", "عام"],
    ["steam", "بخار دافئ وأجواء مريحة", "warm gentle steam rises beside the product, cozy golden light, calm atmosphere", "غذاء"],
    ["leaves", "أوراق وزهور تتطاير", "fresh green leaves and petals drift softly around the product in a light breeze, natural daylight", "عناية"],
    ["hand", "يد تلتقط المنتج", "a hand with a long sleeve (only the hand and forearm visible, no face) picks the product up and presents it to the camera, natural window light", "عام"],
    ["reveal", "كشف المنتج بضوء", "the scene starts dim and light gradually reveals the product, dramatic yet tasteful reveal", "عام"],
    ["sparkle", "بريق فاخر", "tiny golden sparkles glimmer around the product, luxurious dark elegant background, slow camera drift", "مجوهرات"],
    ["turntable", "منصة دوّارة", "the product rotates slowly on a turntable platform, even lighting, clean e-commerce look", "عام"],
    ["pop", "حركة إعلانية ديناميكية", "dynamic advertising motion: quick but smooth camera moves and punchy lighting changes that energize the product, social-media ad feel", "عام"],
    ["wind", "قماش يتحرك بالنسيم", "the fabric of the garment sways gently in a light breeze showing its drape and flow, soft natural light, no person visible", "أزياء"],
    ["fabric", "تقريب على نسيج القماش", "slow macro push-in across the fabric weave and stitching of the garment, shallow depth of field", "أزياء"],
    ["hanger", "قطعة معلّقة تدور", "the garment hangs on a hanger and rotates slowly against a clean backdrop, soft studio light", "أزياء"],
    ["swatch", "تدرّج ألوان القطعة", "the same garment smoothly transitions through its available colors one after another, clean backdrop", "أزياء"],
    ["swirl", "ملمس الكريم الناعم", "a swirl of creamy product texture glides across a clean surface next to the product, macro close-up, soft pastel light", "عناية"],
    ["drop", "قطرة تنساب", "a single glossy drop slowly forms and falls near the product bottle, macro, calm spa lighting", "عناية"],
    ["mist", "رذاذ منعش", "a light fine mist sprays softly around the product with sparkling light, fresh clean look", "عناية"],
    ["pour", "سكب ينساب", "a rich stream is poured slowly beside the product in slow motion, appetizing warm light", "غذاء"],
    ["sprinkle", "رشّ مكوّنات", "natural ingredients sprinkle softly around the product in slow motion, rustic wooden surface, appetizing light", "غذاء"],
    ["sun", "ضوء الشمس يتحرك", "warm sunlight slowly moves across the product and its surface through a window, cozy home atmosphere", "منزل"],
    ["roomrev", "كشف المنتج في الغرفة", "the camera glides from a wide view of a tasteful room into the product in place, smooth reveal", "منزل"],
    ["glow", "توهّج حواف تقني", "subtle neon edge-light glow traces the product outline on a dark backdrop, slow rotation, modern tech look", "إلكترونيات"],
    ["expl", "تفكيك تقني أنيق", "the product floats with its parts gently separating and reassembling, clean tech-explainer look, soft shadows", "إلكترونيات"],
    ["flare", "وهج ضوئي على المجوهرات", "a soft light flare passes over the jewelry making the stones glint, slow rotation on dark velvet, luxurious", "مجوهرات"],
    ["gift", "هدية تُفتح", "the product is revealed from gift wrapping with a gentle ribbon motion, festive warm light", "هدايا"],
    ["toy", "حركة مرحة", "the product moves with a playful bounce on a bright pastel backdrop, cheerful family-friendly mood", "أطفال"],
    ["energy", "طاقة وحركة رياضية", "dynamic energetic motion with fast light streaks and a quick camera push around the sports product, bold contrast lighting", "رياضة"],
    ["herb", "أعشاب وطبيعة", "dried and fresh herbs drift softly beside the product on a natural wooden surface, calm apothecary mood", "صحة"]
  ];
  const RATIOS = [["9:16", "طولي 9:16 (ريلز/ستوري)"], ["1:1", "مربع 1:1"], ["4:5", "عمودي 4:5"], ["16:9", "عريض 16:9"]];
  const GUARD = " Keep the product exactly as in the reference photo(s): same shape, proportions, colors, packaging and label artwork. Do not add text, subtitles, logos or watermarks. No distortion or morphing of the product. Realistic physics, smooth natural motion, no sound needed.";
  /* نقية: تركّب التعليمات من القالب والوصف الحر */
  function buildPrompt(tpl, text) {
    const t = TPL.find(x => x[0] === tpl), parts = []; if (t) parts.push(t[2]); const u = String(text || "").trim(); if (u) parts.push(u);
    if (!parts.length) return ""; return "Create a short product video from the reference photo(s): " + parts.join(". Additionally: ") + "." + GUARD;
  }
  const S = { id: "", src: "", pool: [], picks: [], cat: "الكل", tpl: "", text: "", ratio: "9:16", dur: 5, busy: false, msg: "", url: "", blob: null, type: "", ver: 0 };
  const poolOf = src => (typeof PBCollage !== "undefined" && PBCollage.poolOf ? PBCollage.poolOf(src) : []).filter(u => u && u !== src);
  const blobOfSrc = async src => { const r = await fetch(A().localize(String(src))); if (!r.ok) throw new Error("تعذّر قراءة الصورة"); return r.blob(); };
  function panel() {
    const rdy = typeof ImgGen !== "undefined" ? ImgGen.videoReady() : { ok: false, nokey: true, price: 0 };
    return `<div class="pbx-pz" id="pbvg"><p>أنشئ فيديو إعلانياً من صورة منتجك: اختر قالباً جاهزاً أو اكتب وصف الحركة، وأضف حتى 4 صور للمنتج لدقة أفضل. (للتحريك المجاني بلا ذكاء استعمل «تحريك الصورة».)</p>
<div class="ep-n"><b>قوالب الحركة</b> (${TPL.length})</div><div class="pbrt-row">${["الكل"].concat([...new Set(TPL.map(x => x[3]))]).map(c => `<button type="button" class="pbx-small${S.cat === c ? " pz-go" : ""}" data-vg="cat" data-v="${c}">${c}</button>`).join("")}</div><div class="pbrt-row" id="pbvg-tpls">${TPL.filter(x => S.cat === "الكل" || x[3] === S.cat || x[3] === "عام").map(x => `<button type="button" class="pbx-small${S.tpl === x[0] ? " pz-go" : ""}" data-vg="tpl" data-v="${x[0]}">${x[1]}</button>`).join("")}</div>
<label class="fl" style="display:block;margin:.4rem 0">وصف الحركة (اختياري مع القالب، إلزامي بدونه)<textarea id="pbvg-t" rows="3" style="width:100%" placeholder="مثال: تقترب الكاميرا ببطء من العبوة بينما تتساقط بتلات وردية حولها">${esc(S.text)}</textarea></label>
<div class="ep-n"><b>صور المنتج</b> (<span id="pbvg-n">${1 + S.picks.length}</span> من 4) — الصورة المحدّدة دائماً مضمَّنة</div>
<div id="pbvg-pool" style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;max-height:96px;overflow:auto">${S.pool.map((u, i) => `<img src="${esc(A().localize(u))}" data-vg="pick" data-i="${i}" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;cursor:pointer;outline:${S.picks.includes(u) ? "3px solid #7c3aed" : "none"}">`).join("") || '<span class="ep-n">لا صور أخرى في الصفحة</span>'}</div>
<div class="pbrt-row"><select id="pbvg-r" class="pbx-small">${RATIOS.map(([k, t]) => `<option value="${k}"${S.ratio === k ? " selected" : ""}>${t}</option>`).join("")}</select></div>
<div class="rt-g"><label>المدة (ثانية) <b id="pbvg-dv">${S.dur}</b><input type="range" id="pbvg-d" min="3" max="10" value="${S.dur}"></label></div>
<div class="ep-n" id="pbvg-cost">${rdy.ok ? "يستهلك من رصيد Alyssum API — تُطلب موافقتك قبل التنفيذ" : "تحتاج مفتاح Alyssum API (الاتصال الثاني) من إعدادات مولّد الصور"}</div>
<div class="pbrt-row"><button type="button" class="pbx-small pz-go" data-vg="go">🎬 أنشئ الفيديو</button></div>
<div id="pbvg-out"></div><div id="pbvg-msg" class="ep-n" style="min-height:1.2em">${esc(S.msg)}</div></div>`;
  }
  const say = t => { S.msg = t; const e = $("pbvg-msg"); if (e) e.textContent = t; };
  function showOut() {
    const out = $("pbvg-out"); if (!out || !S.url) return; const ext = /mp4/.test(S.type) ? "mp4" : "webm";
    out.innerHTML = `<video src="${S.url}" controls loop muted playsinline style="max-width:100%;border-radius:6px"></video><div class="pbrt-row"><button type="button" class="pbx-small pz-go" data-vg="add">＋ أضفه للصفحة</button><a class="pbx-small" href="${S.url}" download="alyssum-ai-video.${ext}" style="text-decoration:none;display:inline-block">⬇ تنزيل</a></div>`;
  }
  async function go() {
    if (S.busy) return; const prompt = buildPrompt(S.tpl, S.text);
    if (!prompt) { say("اختر قالباً أو اكتب وصف الحركة"); return; }
    S.busy = true; const ver = ++S.ver; say("⏳ تجهيز الصور…");
    try {
      const imgs = [await blobOfSrc(S.src)]; for (const u of S.picks.slice(0, 3)) imgs.push(await blobOfSrc(u));
      const r = await ImgGen.video({ images: imgs, prompt, ratio: S.ratio, dur: S.dur, title: "فيديو", onStatus: m => { if (ver === S.ver) say("⏳ " + m); } });
      if (!r) { say("أُلغي"); return; }
      if (S.url) URL.revokeObjectURL(S.url); S.blob = r.blob; S.type = r.type; S.url = URL.createObjectURL(r.blob); showOut(); say("✅ جاهز — راجع الفيديو (قد تتغير تفاصيل دقيقة) ثم أضفه للصفحة");
    } catch (e) { say(e.code === "NOKEY" ? "⚠️ أضف مفتاح Alyssum API (الاتصال الثاني) من إعدادات مولّد الصور" : e.code === "OFF" ? "توليد الفيديو معطّل من الإعدادات" : "❌ " + e.message); }
    finally { S.busy = false; }
  }
  async function add() {
    if (!S.blob) return; try { const ext = /mp4/.test(S.type) ? "mp4" : "webm", f = new File([S.blob], "ai-video." + ext, { type: S.type || "video/mp4" }), p = await A().uploadVideo(f); if (!p) return; A().addVideoFile(p); say("✅ أُضيف الفيديو للصفحة"); } catch (e) { say("❌ " + e.message); }
  }
  async function mount(host, inf) {
    const id = inf.node.id; if (S.id !== id) { S.id = id; S.picks = []; if (S.url) { URL.revokeObjectURL(S.url); } S.url = ""; S.blob = null; S.msg = ""; }
    S.src = inf.set.src; S.pool = poolOf(S.src); host.innerHTML = panel(); showOut();
    const root = host.querySelector("#pbvg"); if (!root) return;
    root.addEventListener("input", e => { const t = e.target; if (t.id === "pbvg-t") S.text = t.value; else if (t.id === "pbvg-d") { S.dur = +t.value; const v = $("pbvg-dv"); if (v) v.textContent = S.dur; } });
    root.addEventListener("change", e => { if (e.target.id === "pbvg-r") S.ratio = e.target.value; });
    root.addEventListener("click", e => {
      const t = e.target.closest("[data-vg]"); if (!t) return; const k = t.dataset.vg;
      if (k === "cat") { S.cat = t.dataset.v; const host2 = root.parentNode; host2.innerHTML = panel(); showOut(); mount(host2, { node: { id: S.id }, set: { src: S.src } }); return; }
      if (k === "tpl") { S.tpl = S.tpl === t.dataset.v ? "" : t.dataset.v; root.querySelectorAll('[data-vg="tpl"]').forEach(b => b.classList.toggle("pz-go", b.dataset.v === S.tpl)); }
      else if (k === "pick") { const u = S.pool[+t.dataset.i]; if (!u) return; const i = S.picks.indexOf(u); if (i >= 0) S.picks.splice(i, 1); else if (S.picks.length < 3) S.picks.push(u); else say("الحد الأقصى 4 صور"); t.style.outline = S.picks.includes(u) ? "3px solid #7c3aed" : "none"; const n = $("pbvg-n"); if (n) n.textContent = 1 + S.picks.length; }
      else if (k === "go") go(); else if (k === "add") add();
    });
  }
  return { panel, mount, reset: () => { S.id = ""; if (S.url) URL.revokeObjectURL(S.url); S.url = ""; S.blob = null; S.msg = ""; S.ver++; }, state: S, _t: { buildPrompt, TPL, RATIOS } };
})();
