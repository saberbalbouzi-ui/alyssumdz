/* صانع إعلانات الفيديو («مخرج»): من 1–4 صور للمنتج ← التعرّف على المنتج واقتراح النوع والمدة ← خطة لقطات ونص صوتي قابل للتعديل ← فيديو إعلاني بصوت بلغات متعددة بالممثل نفسه.
   أنواع: فيديو UGC (بأسلوب مبدع حقيقي)، فيديو منتج (المنتج في الصدارة)، فيديو ترند تيك توك، أو وصف حر. تنسيقات 9:16 (تيك توك/ميتا/ريلز) و16:9 (يوتيوب/الموقع) و1:1.
   الخطة والنص بنص Alyssum API (ImgGen.text) والفيديو بخدمة الفيديو (ImgGen.video)؛ الرصيد وتنبيهاته كبقية الأدوات. منفصل عن «مولّد الفيديو» السريع (PBVGen). */
const PBVAd = (() => {
  const A = () => PBApp, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TYPES = [["ugc", "فيديو UGC", "مبدع/زبون يتحدث عن المنتج بأسلوب أصيل"], ["product", "فيديو منتج", "المنتج في الصدارة بلقطات نظيفة"], ["trend", "فيديو ترند تيك توك", "قوالب سريعة تتبع ما يشاهده جمهورك"], ["free", "وصف حر", "اكتب الفيديو الذي تريده بكلماتك"]];
  const TYPE_BRIEF = { ugc: "a UGC-style ad that feels like a real customer or creator talking about and using the product, shot on a phone, natural and unpolished, speaking to camera or in an authentic testimonial/unboxing moment", product: "a clean product-showcase ad where the product is the hero, polished lighting, close-ups of details, smooth camera moves", trend: "a short-form TikTok trend-style ad: fast hooks in the first second, quick cuts, satisfying reveals, popular vertical-video pacing", free: "an ad exactly as described by the owner" };
  const ACTORS = [["none", "بلا ممثل (المنتج فقط)", ""], ["woman", "امرأة بخمار ولباس محتشم", "a woman wearing a plain tasteful hijab and modest full-coverage clothing (long sleeves, only face and hands visible)"], ["man", "رجل", "a man in plain modest everyday clothing"]];
  const LANGS = [["dz", "الدارجة الجزائرية", "Algerian Arabic dialect (Darija)"], ["ar", "العربية الفصحى", "clear Modern Standard Arabic"], ["fr", "الفرنسية", "French"], ["en", "الإنجليزية", "English"]];
  const RATIOS = [["9:16", "9:16 — تيك توك وميتا وريلز وستوري"], ["16:9", "16:9 — يوتيوب والموقع"], ["1:1", "1:1 — منشور مربع"]];
  const LENGTHS = [5, 8, 10];
  const CATS = { fashion: "أزياء", beauty: "تجميل وعناية", food: "أغذية", home: "منزل وأثاث", tech: "إلكترونيات", jewelry: "مجوهرات وإكسسوار", kids: "أطفال", health: "صحة وأعشاب", other: "عام" };
  /* اقتراح نوع/مدة حسب الفئة (احتياط حين لا يتوفر التعرّف) */
  const REC = { fashion: ["ugc", 8], beauty: ["ugc", 8], food: ["product", 5], home: ["product", 8], tech: ["ugc", 10], jewelry: ["product", 5], kids: ["ugc", 8], health: ["product", 8], other: ["product", 8] };
  const CLAIM = /علاج|يشفي|شفاء|يعالج|يداوي|مضمون 100|cure|heal|guérit|guerit|treat(s)? (a|the)? ?disease|100% guarantee/i;
  /* نقية: تحذيرات ادعاءات يجب مراجعتها في النص */
  const claims = txt => { const m = String(txt || "").match(new RegExp(CLAIM.source, "gi")); return m ? [...new Set(m)] : []; };
  /* نقية: يحدّد فئة المنتج من عنوانه/تصنيفه حين لا يتوفر التعرّف */
  const guessCat = t => { const s = String(t || ""); return /فستان|قميص|حذاء|حقيبة|عباية|جلابة|سروال|ملابس|dress|shirt|shoe|bag/i.test(s) ? "fashion" : /كريم|سيروم|شامبو|عناية|تجميل|عطر|cream|serum|perfume/i.test(s) ? "beauty" : /عسل|تمر|زيت|قهوة|حلويات|honey|dates|oil|coffee/i.test(s) ? "food" : /كرسي|طاولة|ديكور|مفرش|chair|table|decor/i.test(s) ? "home" : /هاتف|سماعة|شاحن|ساعة|phone|headphone|charger/i.test(s) ? "tech" : /خاتم|سوار|قلادة|ring|bracelet|necklace/i.test(s) ? "jewelry" : /أعشاب|مكمل|فيتامين|herb|supplement/i.test(s) ? "health" : "other"; };
  const recommend = cat => { const r = REC[cat] || REC.other; return { type: r[0], length: r[1] }; };
  /* نقية: يحوّل ردّ الأداة إلى خطة صالحة (لقطات بمجموع ثوانٍ، نص صوتي لكل لغة مختارة) */
  function parsePlan(j, opt) {
    const shots = (Array.isArray(j && j.shots) ? j.shots : []).slice(0, 8).map(x => ({ s: Math.max(1, Math.min(10, Math.round(+x.seconds || +x.s || 2))), v: String(x.visual || x.v || "").trim().slice(0, 300), c: String(x.camera || x.c || "").trim().slice(0, 120) })).filter(x => x.v).map((x, i) => Object.assign(x, { n: i + 1 }));
    const sc = {}; for (const l of (opt.langs || ["ar"])) sc[l] = String(((j && j.script) || {})[l] || "").trim().slice(0, 700);
    return { title: String((j && j.title) || "").trim().slice(0, 80), shots, script: sc };
  }
  /* نقية: تعليمات خدمة الفيديو من الخطة */
  function buildPrompt(opt, plan, lang) {
    const L = LANGS.find(x => x[0] === lang) || LANGS[0], act = ACTORS.find(x => x[0] === opt.actor) || ACTORS[0], T = TYPE_BRIEF[opt.type] || TYPE_BRIEF.product;
    const shots = (plan.shots || []).map(x => x.n + ". (" + x.s + "s) " + x.v + (x.c ? " — camera: " + x.c : "")).join(" ");
    return "Create a " + opt.length + "-second " + (opt.ratio === "16:9" ? "horizontal" : opt.ratio === "1:1" ? "square" : "vertical") + " video ad: " + T + ". "
      + (act[2] && opt.type !== "product" ? "On-screen person: " + act[2] + " (keep the same person throughout; never show bare skin beyond face and hands). " : "No on-screen person; the product only. ")
      + (shots ? "Shot plan: " + shots + " " : "") + (opt.free ? "Owner's description: " + opt.free + ". " : "")
      + "Voiceover language: " + L[2] + (plan.script && plan.script[lang] ? ". Voiceover script (speak it naturally" + (act[2] && opt.type !== "product" ? " with lip-sync" : "") + "): \"" + plan.script[lang] + "\"" : "") + ". "
      + "Keep the product exactly as in the reference photos: same shape, proportions, colors, packaging and label artwork. No on-screen text, subtitles, logos or watermarks. No medical or guaranteed-result claims. Realistic physics, smooth natural motion.";
  }
  const S = { id: "", src: "", pool: [], picks: [], extra: [], type: "ugc", length: 8, ratio: "9:16", actor: "woman", langs: ["dz"], free: "", rec: null, plan: null, busy: false, msg: "", res: [], ver: 0 };
  const poolOf = src => (typeof PBCollage !== "undefined" && PBCollage.poolOf ? PBCollage.poolOf(src) : []).filter(u => u && u !== src);
  const blobOf = async src => { const r = await fetch(A().localize(String(src))); if (!r.ok) throw new Error("تعذّر قراءة الصورة"); return r.blob(); };
  const storeProds = () => ((typeof Admin !== "undefined" && Admin.products) || []).filter(p => p && p.active !== false && (p.cover || (p.images || [])[0]));
  /* روابط Google Drive / Dropbox إلى روابط تنزيل مباشرة */
  function directUrl(u) {
    u = String(u || "").trim(); let m;
    if ((m = /drive\.google\.com\/file\/d\/([\w-]+)/.exec(u)) || (m = /drive\.google\.com\/open\?id=([\w-]+)/.exec(u))) return "https://drive.google.com/uc?export=download&id=" + m[1];
    if (/dropbox\.com\//.test(u)) return u.replace(/[?&]dl=0/, "").replace(/(\?|$)/, (x, q) => q ? "?dl=1" : "?dl=1");
    return u;
  }
  const allPics = () => [S.src].concat(S.picks).concat(S.extra).filter(Boolean).slice(0, 4);
  function panel() {
    const pics = allPics(), sp = storeProds();
    const chip = (k, v, t, on) => `<button type="button" class="pbx-small${on ? " pz-go" : ""}" data-vad="${k}" data-v="${v}">${t}</button>`;
    const rec = S.rec ? `<div class="ep-n" style="color:#16a34a">تعرّفنا على المنتج: <b>${esc(S.rec.name || "")}</b> (${esc(CATS[S.rec.category] || CATS.other)}) — نقترح: ${esc((TYPES.find(x => x[0] === S.rec.type) || [0, ""])[1])} · ${S.rec.length} ثوانٍ${(S.rec.points || []).length ? "<br>نقاط البيع: " + S.rec.points.map(esc).join(" · ") : ""}</div>` : "";
    return `<div class="pbx-pz" id="pbvad"><p>أنشئ <b>إعلان فيديو</b> للتجارة الإلكترونية: أضف حتى 4 صور لمنتجك، ودع المخرج يتعرّف عليه ويقترح النوع والمدة، ثم يكتب خطة اللقطات والنص الصوتي لتراجعها وتعدّلها قبل التوليد، ويمكنك إصدار نسخ بلغات متعددة بالممثل نفسه.</p>
<div class="ep-n"><b>① صور المنتج</b> (${pics.length} من 4) — الصورة المحدّدة مضمَّنة دائماً</div>
<div id="pbvad-pool" style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;max-height:96px;overflow:auto">${S.pool.map((u, i) => `<img src="${esc(A().localize(u))}" data-vad="pick" data-i="${i}" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;cursor:pointer;outline:${S.picks.includes(u) ? "3px solid #7c3aed" : "none"}">`).join("") || '<span class="ep-n">لا صور أخرى في الصفحة</span>'}</div>
<div class="pbrt-row"><select id="pbvad-sp" class="pbx-small"><option value="">＋ من منتجات متجرك…</option>${sp.map(p => `<option value="${esc(p.slug)}">${esc(p.title)}</option>`).join("")}</select><label class="pbx-small" style="cursor:pointer">📁 من جهازك<input type="file" id="pbvad-f" accept="image/*" multiple style="display:none"></label></div>
<div class="pbrt-row"><input id="pbvad-u" type="url" dir="ltr" class="pbx-small" style="flex:1;min-width:140px" placeholder="رابط صورة أو Google Drive أو Dropbox"><button type="button" class="pbx-small" data-vad="url">استيراد</button></div>
<div class="ep-n"><b>② نوع الإعلان</b></div><div class="pbrt-row">${TYPES.map(x => chip("type", x[0], x[1], S.type === x[0])).join("")}</div>
<div class="ep-n" id="pbvad-th">${esc((TYPES.find(x => x[0] === S.type) || [0, 0, ""])[2])}</div>
${S.type === "free" ? `<textarea id="pbvad-free" rows="3" style="width:100%" placeholder="صف الإعلان الذي تريده: المشهد، الحركة، الإحساس…">${esc(S.free)}</textarea>` : ""}
<div class="pbrt-row"><button type="button" class="pbx-small" data-vad="rec">🔎 تعرَّف على المنتج واقترح</button></div>${rec}
<div class="rt-g"><label>الممثل <select id="pbvad-a" class="pbx-small">${ACTORS.map(x => `<option value="${x[0]}"${S.actor === x[0] ? " selected" : ""}>${x[1]}</option>`).join("")}</select></label><label>المدة <select id="pbvad-l" class="pbx-small">${LENGTHS.map(n => `<option value="${n}"${S.length === n ? " selected" : ""}>${n} ثوانٍ</option>`).join("")}</select></label><label>التنسيق <select id="pbvad-r" class="pbx-small">${RATIOS.map(x => `<option value="${x[0]}"${S.ratio === x[0] ? " selected" : ""}>${x[1]}</option>`).join("")}</select></label></div>
<div class="ep-n"><b>③ لغات التعليق الصوتي</b> (نسخة لكل لغة بالممثل نفسه)</div><div class="pbrt-row">${LANGS.map(x => `<label class="pbx-small"><input type="checkbox" data-vad="lang" data-v="${x[0]}"${S.langs.includes(x[0]) ? " checked" : ""}> ${x[1]}</label>`).join("")}</div>
<div class="pbrt-row"><button type="button" class="pbx-small pz-go" data-vad="plan">📝 اكتب خطة الإعلان</button></div>
${planHtml()}
<div id="pbvad-msg" class="ep-n" style="min-height:1.2em">${esc(S.msg)}</div><div id="pbvad-out">${outHtml()}</div></div>`;
  }
  function planHtml() {
    const P = S.plan; if (!P) return "";
    const warn = claims(Object.values(P.script).join(" ")); 
    return `<div class="ep-n"><b>④ خطة الإعلان</b> — عدّل ما تشاء قبل التوليد</div>
<label class="fl" style="display:block">العنوان الداخلي <input type="text" id="pbvad-pt" value="${esc(P.title)}" style="width:100%"></label>
<div class="ep-n"><b>اللقطات</b></div>${P.shots.map((x, i) => `<div style="display:grid;grid-template-columns:34px 1fr;gap:4px;margin:3px 0"><input type="number" min="1" max="10" data-vadshot="s" data-i="${i}" value="${x.s}" title="ثوانٍ"><input type="text" data-vadshot="v" data-i="${i}" value="${esc(x.v)}"></div>`).join("")}
${S.langs.map(l => `<label class="fl" style="display:block;margin-top:.3rem">النص الصوتي — ${esc((LANGS.find(x => x[0] === l) || [0, l])[1])}<textarea data-vadscript="${l}" rows="3" style="width:100%">${esc(P.script[l] || "")}</textarea></label>`).join("")}
${warn.length ? `<div class="ep-n" style="color:#b45309">⚠️ عبارات تحتاج مراجعة قبل النشر (ادعاءات علاجية/ضمان مطلق): ${warn.map(esc).join("، ")}</div>` : ""}
<div class="pbrt-row"><button type="button" class="pbx-small pz-go" data-vad="go">🎬 أنشئ الإعلان${S.langs.length > 1 ? " (" + S.langs.length + " لغات)" : ""}</button></div>`;
  }
  function outHtml() {
    return S.res.map((r, i) => `<div style="margin:.4rem 0"><div class="ep-n"><b>${esc(r.langName)}</b></div><video src="${r.url}" controls loop muted playsinline style="max-width:100%;border-radius:6px"></video><div class="pbrt-row"><button type="button" class="pbx-small pz-go" data-vad="add" data-i="${i}">＋ أضفه للصفحة</button><a class="pbx-small" href="${r.url}" download="alyssum-ad-${r.lang}.${/mp4/.test(r.type) ? "mp4" : "webm"}" style="text-decoration:none;display:inline-block">⬇ تنزيل</a></div></div>`).join("");
  }
  const say = t => { S.msg = t; const e = $("pbvad-msg"); if (e) e.textContent = t; };
  const errText = e => e && e.code === "NOKEY" ? "الخدمة غير مفعّلة لموقعك — تواصل مع الدعم" : e && e.code === "OFF" ? "الأداة معطّلة من الإعدادات" : "❌ " + (e && e.message || e);
  const prodCtx = () => { const p = storeProds().find(x => x.cover === S.src || (x.images || []).includes(S.src)); return p ? "Store listing: " + p.title + (p.desc ? " — " + String(p.desc).slice(0, 300) : "") + "." : ""; };
  async function recognize() {
    if (S.busy) return; S.busy = true; say("⏳ نتعرّف على المنتج…");
    try {
      const blobs = []; for (const u of allPics()) blobs.push(await blobOf(u));
      let j = null;
      try { j = await ImgGen.text({ blobs, json: true, temp: .3, prompt: "Look at these product photos for an online store and answer in JSON only: {\"name\": short product name in Arabic, \"category\": one of fashion|beauty|food|home|tech|jewelry|kids|health|other, \"points\": [up to 3 short selling points in Arabic that are visible or obvious (no medical claims)], \"type\": one of ugc|product|trend (best ad type for it), \"length\": one of 5|8|10 (best ad length in seconds)}. " + prodCtx() }); } catch (e) { if (e && (e.code === "NOKEY" || e.code === "OFF")) throw e; }
      let cat = j && CATS[j.category] ? j.category : guessCat(prodCtx() || ""), rc = recommend(cat);
      S.rec = { name: j && j.name || "", category: cat, points: j && Array.isArray(j.points) ? j.points.slice(0, 3).map(String) : [], type: j && ["ugc", "product", "trend"].includes(j.type) ? j.type : rc.type, length: j && LENGTHS.includes(+j.length) ? +j.length : rc.length };
      S.type = S.rec.type; S.length = S.rec.length; if (S.type === "product") S.actor = "none"; else if (S.actor === "none") S.actor = "woman";
      const r = $("pbvad"); if (r) { const h = r.parentNode; refresh(h); } say("✅ اخترنا لك الإعدادات المقترحة — غيّر ما تشاء");
    } catch (e) { say(errText(e)); } finally { S.busy = false; }
  }
  async function makePlan() {
    if (S.busy) return; if (S.type === "free" && !S.free.trim()) { say("اكتب وصف الإعلان"); return; } if (!S.langs.length) { say("اختر لغة واحدة على الأقل"); return; }
    S.busy = true; say("⏳ نكتب خطة الإعلان…");
    try {
      const blobs = []; for (const u of allPics().slice(0, 2)) blobs.push(await blobOf(u));
      const L = S.langs.map(l => (LANGS.find(x => x[0] === l) || LANGS[0])), act = ACTORS.find(x => x[0] === S.actor) || ACTORS[0];
      const j = await ImgGen.text({ blobs, json: true, temp: .8, prompt: "You are an e-commerce video-ad director for an Algerian online store (cash on delivery, delivery to all wilayas). Plan a " + S.length + "-second " + (S.ratio === "16:9" ? "horizontal" : S.ratio === "1:1" ? "square" : "vertical") + " ad: " + TYPE_BRIEF[S.type] + ". " + (S.rec && S.rec.name ? "Product: " + S.rec.name + ". " : "") + prodCtx() + (S.free ? " Owner's brief: " + S.free + "." : "") + (act[2] && S.type !== "product" ? " On-screen person: " + act[2] + "." : " No on-screen person.")
        + " Answer in JSON only: {\"title\": short Arabic title, \"shots\": [{\"seconds\": int, \"visual\": what we see, \"camera\": camera move}] (3 to 5 shots whose seconds add up to " + S.length + "), \"script\": {" + L.map(x => "\"" + x[0] + "\": voiceover text in " + x[2]).join(", ") + "} (each voiceover must be speakable within " + S.length + " seconds, hook in the first sentence, one clear call to action to order now, no fake testimonials or statistics, NO medical claims or guaranteed results)}." });
      S.plan = parsePlan(j, { langs: S.langs }); if (!S.plan.shots.length) throw new Error("لم نتمكن من إنتاج خطة — أعد المحاولة");
      refresh($("pbvad").parentNode); say("✅ الخطة جاهزة — عدّلها ثم أنشئ الإعلان");
    } catch (e) { say(errText(e)); } finally { S.busy = false; }
  }
  async function generate() {
    if (S.busy || !S.plan) return; syncPlan(); S.busy = true; const ver = ++S.ver; S.res.forEach(r => URL.revokeObjectURL(r.url)); S.res = [];
    try {
      const blobs = []; for (const u of allPics()) blobs.push(await blobOf(u));
      if (ImgGen.canVideo && !ImgGen.canVideo(S.langs.length)) { if (ImgGen.credit) ImgGen.credit.note(); throw new Error("رصيد Alyssum API لا يكفي لهذه العملية — جدّد الرصيد"); }
      if (!confirm("إنشاء إعلان فيديو — " + S.langs.length + (S.langs.length > 1 ? " نسخ بلغات مختلفة" : " نسخة") + " — سيستهلك من رصيد Alyssum API.\nقد يستغرق التوليد دقائق. متابعة؟")) { say(""); S.busy = false; return; }
      const seed = Math.floor(Math.random() * 1e9);
      for (let i = 0; i < S.langs.length; i++) {
        const l = S.langs[i], L = LANGS.find(x => x[0] === l) || LANGS[0];
        say("⏳ " + L[1] + " (" + (i + 1) + " من " + S.langs.length + ")…");
        const r = await ImgGen.video({ images: blobs, prompt: buildPrompt({ type: S.type, length: S.length, ratio: S.ratio, actor: S.actor, free: S.type === "free" ? S.free : "" }, S.plan, l), ratio: S.ratio, dur: S.length, audio: true, script: S.plan.script[l], lang: l, seed, confirm: false, title: "إعلان فيديو", onStatus: m => { if (ver === S.ver) say("⏳ " + L[1] + " — " + m); } });
        if (!r) break; if (ver !== S.ver) return; S.res.push({ lang: l, langName: L[1], blob: r.blob, type: r.type, url: URL.createObjectURL(r.blob) }); const o = $("pbvad-out"); if (o) o.innerHTML = outHtml();
      }
      say(S.res.length ? "✅ جاهز — راجع الإعلان (قد تتغير تفاصيل دقيقة) ثم أضفه أو نزّله" : "");
    } catch (e) { say(errText(e) + (S.res.length ? " — اكتمل " + S.res.length + " من " + S.langs.length : "")); } finally { S.busy = false; }
  }
  const syncPlan = () => { const r = $("pbvad"); if (!r || !S.plan) return; const t = $("pbvad-pt"); if (t) S.plan.title = t.value; r.querySelectorAll("[data-vadshot]").forEach(i => { const sh = S.plan.shots[+i.dataset.i]; if (sh) sh[i.dataset.vadshot] = i.dataset.vadshot === "s" ? Math.max(1, Math.min(10, +i.value || 1)) : i.value; }); r.querySelectorAll("[data-vadscript]").forEach(t2 => { S.plan.script[t2.dataset.vadscript] = t2.value; }); };
  async function add(i) { const r = S.res[i]; if (!r) return; try { const ext = /mp4/.test(r.type) ? "mp4" : "webm", f = new File([r.blob], "ad-" + r.lang + "." + ext, { type: r.type || "video/mp4" }), p = await A().uploadVideo(f); if (!p) return; A().addVideoFile(p); say("✅ أُضيف الفيديو للصفحة"); } catch (e) { say("❌ " + e.message); } }
  function refresh(host) { if (!host) return; syncPlan(); host.innerHTML = panel(); bind(host); }
  function bind(host) {
    const root = host.querySelector("#pbvad"); if (!root) return;
    root.addEventListener("input", e => { const t = e.target; if (t.id === "pbvad-free") S.free = t.value; });
    root.addEventListener("change", async e => {
      const t = e.target;
      if (t.id === "pbvad-a") S.actor = t.value; else if (t.id === "pbvad-l") S.length = +t.value; else if (t.id === "pbvad-r") S.ratio = t.value;
      else if (t.dataset.vad === "lang") { const v = t.dataset.v; S.langs = S.langs.filter(x => x !== v); if (t.checked) S.langs.push(v); if (!S.langs.length) { S.langs = [v]; t.checked = true; } if (S.plan) { for (const l of S.langs) if (S.plan.script[l] == null) S.plan.script[l] = ""; refresh(host); } }
      else if (t.id === "pbvad-sp") { const p = storeProds().find(x => x.slug === t.value); if (p) { for (const u of [p.cover].concat(p.images || []).filter(Boolean)) if (allPics().length < 4 && !allPics().includes(u)) S.extra.push(u); refresh(host); } }
      else if (t.id === "pbvad-f") { for (const f of Array.from(t.files || []).filter(f => /^image\//.test(f.type))) if (allPics().length < 4) S.extra.push(URL.createObjectURL(f)); refresh(host); }
    });
    root.addEventListener("click", e => {
      const t = e.target.closest("[data-vad]"); if (!t) return; const k = t.dataset.vad;
      if (k === "type") { S.type = t.dataset.v; if (S.type === "product") S.actor = "none"; else if (S.actor === "none") S.actor = "woman"; S.plan = null; refresh(host); }
      else if (k === "pick") { const u = S.pool[+t.dataset.i]; if (!u) return; const i = S.picks.indexOf(u); if (i >= 0) S.picks.splice(i, 1); else if (allPics().length < 4) S.picks.push(u); else { say("الحد الأقصى 4 صور"); return; } refresh(host); }
      else if (k === "url") { const u = directUrl(($("pbvad-u") || {}).value); if (!/^https?:\/\//.test(u)) { say("ألصق رابط صورة صالحاً"); return; } if (allPics().length >= 4) { say("الحد الأقصى 4 صور"); return; } S.extra.push(u); refresh(host); say("أُضيف الرابط — إن حجبه الموقع (CORS) حمّل الصورة على جهازك ثم ارفعها"); }
      else if (k === "rec") recognize(); else if (k === "plan") makePlan(); else if (k === "go") generate(); else if (k === "add") add(+t.dataset.i);
    });
  }
  function mount(host, inf) {
    const id = inf.node.id; if (S.id !== id) { S.id = id; S.picks = []; S.extra = []; S.plan = null; S.rec = null; S.res.forEach(r => URL.revokeObjectURL(r.url)); S.res = []; S.msg = ""; }
    S.src = inf.set.src; S.pool = poolOf(S.src); host.innerHTML = panel(); bind(host);
  }
  return { panel, mount, reset: () => { S.id = ""; S.ver++; S.res.forEach(r => URL.revokeObjectURL(r.url)); S.res = []; S.plan = null; S.msg = ""; }, state: S, _t: { buildPrompt, parsePlan, claims, guessCat, recommend, directUrl, TYPES, ACTORS, LANGS, RATIOS, LENGTHS, CATS } };
})();
