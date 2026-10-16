/* مكتبة الأصول (v1.89.254): بحث بالفلترة في قاعدة واسعة بلا علامات مائية وتنزيل العنصر إلى الموقع.
   المصادر: Pixabay (صور/رسوم/متجهات/فيديو — ترخيص Pixabay يسمح بالاستعمال التجاري ويمنع إعادة توزيعها ملفات مستقلة في مكتبة منافسة؛ المفتاح مجاني يضعه صاحب المتجر)
   وIconify (آلاف مجموعات الأيقونات SVG — تُعرض رخصة كل مجموعة ويُفضَّل المسموح منها). Unsplash غير مستعمل عمداً (ترخيصه يمنع التجميع في خدمة مشابهة).
   لا ربط دائم: العنصر يُنزَّل ويُحفظ في الموقع (assets/img/pages) كأي صورة مرفوعة. المفتاح في localStorage فقط. */
const PBAssets = (() => {
  const LSK = "alyssum_pixabay_key", LSS = "pbx_ast_state", PX = "https://pixabay.com/api/", IC = "https://api.iconify.design/";
  const CATS = { backgrounds: "خلفيات", fashion: "أزياء", nature: "طبيعة", science: "علوم", education: "تعليم", feelings: "مشاعر", health: "صحة", people: "أشخاص", religion: "دين", places: "أماكن", animals: "حيوانات", industry: "صناعة", computer: "كمبيوتر", food: "طعام", sports: "رياضة", transportation: "نقل", travel: "سفر", buildings: "مبانٍ", business: "أعمال", music: "موسيقى" };
  const COLORS = { red: "أحمر", orange: "برتقالي", yellow: "أصفر", green: "أخضر", turquoise: "فيروزي", blue: "أزرق", lilac: "بنفسجي", pink: "وردي", white: "أبيض", gray: "رمادي", black: "أسود", brown: "بني", transparent: "شفاف", grayscale: "تدرّج رمادي" };
  const OK_LIC = /^(MIT|Apache-2\.0|ISC|CC0-1\.0|Unlicense|0BSD|BSD-[23]-Clause)$/;      // تراخيص لا تفرض نسب المصدر ولا تمنع الاستعمال التجاري
  const SETS = ["tabler", "lucide", "mdi", "ph", "bi", "carbon", "heroicons", "fluent-emoji-flat", "noto", "twemoji", "streamline-emojis", "material-symbols"];
  /* استكشاف سريع بنمط قوائم Pixabay: الإعدادات تُطبَّق على البحث نفسه (ما يدعمه واجهة Pixabay البرمجية: صور/رسوم/متجهات/فيديو/اختيار المحررين/الأشهر والأحدث) */
  const MEDIA = [["photo", "صور", { tab: "img", type: "photo" }], ["illus", "رسوم", { tab: "img", type: "illustration" }], ["vector", "متجهات", { tab: "img", type: "vector" }], ["video", "فيديو", { tab: "vid" }]];
  const DISC = [["editors", "اختيار المحررين", { ed: true, order: "popular" }], ["popimg", "صور شائعة", { tab: "img", ed: false, order: "popular", type: "all" }], ["popvid", "فيديو شائع", { tab: "vid", ed: false, order: "popular" }], ["latest", "الأحدث", { order: "latest", ed: false }]];
  const TREND = ["Halloween", "Fall", "Wallpaper", "Nature", "Travel"];
  const POPQ = ["fond blanc", "miel", "cosmétique", "huile", "emballage", "livraison", "ramadan", "soldes", "family", "business"];
  /* أقسام موجودة على موقع Pixabay لكن واجهته البرمجية لا تتيحها: روابط تفتح الموقع في تبويب جديد (لا تنزيل مباشر منها) */
  const EXT = [["الموسيقى", "https://pixabay.com/music/"], ["المؤثرات الصوتية", "https://pixabay.com/sound-effects/"], ["نماذج 3D", "https://pixabay.com/3d-models/"], ["GIF", "https://pixabay.com/gifs/"], ["مجموعات منتقاة", "https://pixabay.com/collections/"], ["راديو Pixabay", "https://pixabay.com/radio/"], ["المسابقات", "https://pixabay.com/contests/"], ["المبدعون", "https://pixabay.com/creators/"], ["المدوّنة", "https://pixabay.com/blog/"], ["المنتدى", "https://pixabay.com/forum/"]];
  const D = { tab: "img", q: "", type: "all", ori: "", cat: "", color: "", ed: false, min: "", order: "popular", safe: true, lang: "fr", vtype: "all", iq: "", set: "", okOnly: true, icolor: "#173f35", page: 1 };
  const S = Object.assign({}, D, (() => { try { return JSON.parse(localStorage.getItem(LSS) || "{}"); } catch (e) { return {}; } })(), { res: null, busy: false, err: "", total: 0, lic: null, sets: null, ibusy: "" });
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const key = () => { try { return localStorage.getItem(LSK) || (typeof CONFIG !== "undefined" && CONFIG.PIXABAY_KEY) || ""; } catch (e) { return ""; } };
  /* وسيط المنصة: مفتاح Pixabay سرّ في الخادم والتنزيل يمرّ به (لا CORS). يتعطّل تلقائياً إن لم تُنشر الدالة فيعود المفتاح الشخصي. */
  const PX_ST = { on: null };
  const proxyOk = () => PX_ST.on !== false && typeof API !== "undefined" && !!(API.sb && API.sb.url && API.sb.token && API.sb.headers);
  async function viaProxy(body) {
    if (!proxyOk()) return null;
    try {
      const t = await API.sb.token(); if (!t) return null;
      const r = await fetch(API.sb.url("/functions/v1/pixabay-proxy"), { method: "POST", headers: API.sb.headers(t), body: JSON.stringify(body) });
      if ([401, 403, 404, 503].includes(r.status)) { PX_ST.on = false; return null; }
      PX_ST.on = true; return r;
    } catch (e) { return null; }
  }
  const canSearch = () => !!key() || proxyOk();
  const keep = () => { try { const o = {}; Object.keys(D).forEach(k => { if (k !== "page") o[k] = S[k]; }); localStorage.setItem(LSS, JSON.stringify(o)); } catch (e) { } };
  const toast = m => { try { if (typeof PBApp !== "undefined" && PBApp.toast) return PBApp.toast(m); } catch (e) { } };

  /* ===== بناء الطلبات (نقية) ===== */
  function pixUrl(s, k) {
    const vid = s.tab === "vid", p = new URLSearchParams();
    p.set("key", k || key()); if (s.q) p.set("q", s.q.slice(0, 100)); if (s.lang) p.set("lang", s.lang);
    if (vid) { if (s.vtype && s.vtype !== "all") p.set("video_type", s.vtype); } else { p.set("image_type", s.type || "all"); if (s.ori) p.set("orientation", s.ori); }
    if (s.cat) p.set("category", s.cat); if (s.color && !vid) p.set("colors", s.color);
    if (s.ed) p.set("editors_choice", "true"); p.set("safesearch", s.safe ? "true" : "false");
    if (Number(s.min) > 0) p.set("min_width", String(Number(s.min))); p.set("order", s.order || "popular");
    p.set("page", String(s.page || 1)); p.set("per_page", "30");
    return PX + (vid ? "videos/" : "") + "?" + p.toString();
  }
  function iconUrl(s) {
    const p = new URLSearchParams(); p.set("query", s.iq || "cart"); p.set("limit", "96"); if (s.set) p.set("prefix", s.set); else p.set("prefixes", SETS.join(","));
    return IC + "search?" + p.toString();
  }
  const iconSvgUrl = (id, color) => { const i = id.indexOf(":"), q = color ? "?color=" + encodeURIComponent(color) + "&height=256" : "?height=256"; return IC + id.slice(0, i) + "/" + id.slice(i + 1) + ".svg" + q; };
  const licOk = l => !!(l && l.spdx && OK_LIC.test(l.spdx));
  /* أنسب رابط فيديو يتسع في 8MB؛ وإلا الأصغر المتاح (يُضغط عند الرفع) */
  function pickVideo(v) {
    const L = ["medium", "small", "tiny", "large"].map(k => v && v[k]).filter(x => x && x.url);
    return L.find(x => !x.size || x.size <= 8 * 1048576) || L[0] || null;
  }

  /* ===== الشبكة ===== */
  async function search() {
    if (S.tab === "ico") return iconSearch();
    if (!canSearch()) { S.err = "nokey"; S.res = null; return; }
    S.busy = true; S.err = ""; draw();
    try {
      let r = null;
      if (proxyOk()) {
        const q = {}; new URL(pixUrl(S, "x")).searchParams.forEach((v, k) => { if (k !== "key") q[k] = v; });
        r = await viaProxy({ op: "search", kind: S.tab === "vid" ? "videos" : "images", query: q });
        if (r && r.status === 429) throw new Error("تجاوزتَ حدّ الطلبات (100 في الدقيقة) — انتظر قليلاً ثم أعد المحاولة");
        if (r && !r.ok) r = null;
      }
      if (!r) { if (!key()) throw new Error("خدمة المكتبة غير متاحة الآن — حاول لاحقاً"); r = await fetch(pixUrl(S)); }
      if (r.status === 429) throw new Error("تجاوزتَ حدّ الطلبات (100 في الدقيقة) — انتظر قليلاً ثم أعد المحاولة");
      if (r.status === 400 || r.status === 401 || r.status === 403) throw new Error("مفتاح Pixabay مرفوض — تأكد من نسخه كاملاً");
      if (!r.ok) throw new Error("تعذّر الاتصال (" + r.status + ")");
      const j = await r.json(); S.res = j.hits || []; S.total = j.totalHits || 0;
    } catch (e) { S.err = e.message || "تعذّر البحث"; S.res = null; }
    S.busy = false; draw();
  }
  async function iconSearch() {
    S.busy = true; S.err = ""; draw();
    try {
      const r = await fetch(iconUrl(S)); if (!r.ok) throw new Error("تعذّر الاتصال (" + r.status + ")");
      const j = await r.json(); S.lic = Object.assign(S.lic || {}, j.collections || {});
      let L = (j.icons || []).filter(id => S.lic[id.split(":")[0]]);
      if (S.okOnly) L = L.filter(id => licOk(S.lic[id.split(":")[0]].license));
      S.res = L; S.total = j.total || L.length;
    } catch (e) { S.err = e.message || "تعذّر البحث"; S.res = null; }
    S.busy = false; draw();
  }
  async function blobOf(urls) {      // يجرّب الروابط بالترتيب (الدقة العالية ثم المتوسطة) — بعض الخوادم لا تفتح CORS للأصلية
    let last = null;
    if (proxyOk()) for (const u of urls.filter(Boolean)) {
      const r = await viaProxy({ op: "dl", url: u }); if (r && r.ok) return await r.blob(); if (PX_ST.on === false) break;
    }
    for (const u of urls.filter(Boolean)) { try { const r = await fetch(u); if (r.ok) return await r.blob(); last = new Error("HTTP " + r.status); } catch (e) { last = e; } }
    throw last || new Error("تعذّر التنزيل");
  }

  /* ===== التنزيل إلى الموقع ===== */
  async function takeImage(h) {
    const b = await blobOf([h.largeImageURL, h.webformatURL]);
    return PBApp.uploadBlob(b, "px-" + h.id, { max: 2000, q: .88 });
  }
  async function takeVideo(h) {
    const v = pickVideo(h.videos); if (!v) throw new Error("لا رابط فيديو");
    const b = await blobOf([v.url]), f = new File([b], "px-" + h.id + ".mp4", { type: "video/mp4" });
    return PBApp.uploadVideo ? PBApp.uploadVideo(f) : null;
  }
  async function takeIcon(id) {
    const txt = await (await fetch(iconSvgUrl(id, S.icolor))).text(); if (!/<svg[\s>]/i.test(txt)) throw new Error("ليس SVG");
    if (txt.length > 300 * 1024) throw new Error("الأيقونة كبيرة جداً");
    return PBApp.uploadSvg(txt, "ic-" + id.replace(/[^a-z0-9]+/gi, "-"));
  }
  async function take(kind, i) {
    if (S.ibusy) return; const h = S.res[i]; if (!h) return; S.ibusy = kind + i; draw();
    try {
      let p = null;
      if (kind === "img") p = await takeImage(h); else if (kind === "vid") p = await takeVideo(h); else p = await takeIcon(h);
      if (p) { if (kind === "vid") PBApp.addVideoFile(p); else PBApp.addPageImage(p); toast("✅ أُضيف العنصر إلى الصفحة"); }
    } catch (e) { toast("❌ " + (e.message || "تعذّر التنزيل")); }
    S.ibusy = ""; draw();
  }

  /* ===== الواجهة ===== */
  const css = () => {
    if (document.getElementById("ast-css")) return; const st = document.createElement("style"); st.id = "ast-css";
    st.textContent = `#ast-root{font-size:.78rem}#ast-root .ast-seg{display:flex;gap:.3rem;margin-bottom:.5rem}#ast-root .ast-seg button,#ast-root .ast-b{flex:1;font:inherit;font-weight:800;font-size:.76rem;padding:.4rem .5rem;border-radius:12px;cursor:pointer;color:#fff;border:1px solid rgba(255,255,255,.28);background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.04));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -3px 6px rgba(0,0,0,.18),0 2px 6px rgba(0,0,0,.18);backdrop-filter:blur(6px);transition:transform .15s,background .15s}
#ast-root .ast-seg button.on,#ast-root .ast-b.go{background:linear-gradient(180deg,rgba(80,200,120,.55),rgba(30,120,70,.45))}#ast-root .ast-seg button:hover,#ast-root .ast-b:hover{transform:translateY(-2px)}
#ast-root input,#ast-root select{width:100%;box-sizing:border-box;padding:.45rem .55rem;border-radius:10px;border:1.5px solid #e6dfcf;font:inherit;font-size:.78rem;margin-bottom:.35rem;background:#fff;color:#173f35}
#ast-root .ast-f{display:grid;grid-template-columns:1fr 1fr;gap:.3rem}#ast-root label.ast-c{display:flex;align-items:center;gap:.35rem;font-weight:700;color:#173f35;margin:.1rem 0 .35rem}#ast-root label.ast-c input{width:auto;margin:0}
#ast-root .ast-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.4rem;margin-top:.4rem}#ast-root .ast-grid.ic{grid-template-columns:repeat(4,1fr)}
#ast-root .ast-i{position:relative;border:1.5px solid #ece5d3;border-radius:12px;background:#fff;overflow:hidden;cursor:pointer;padding:0;aspect-ratio:1;display:flex;align-items:center;justify-content:center;transition:transform .15s,border-color .15s}#ast-root .ast-i:hover{transform:translateY(-2px);border-color:#0d9488}
#ast-root .ast-i img,#ast-root .ast-i video{width:100%;height:100%;object-fit:cover;pointer-events:none}#ast-root .ast-grid.ic .ast-i img{object-fit:contain;padding:.35rem}#ast-root .ast-i.busy{opacity:.45}
#ast-root .ast-i span{position:absolute;inset-inline:0;bottom:0;font-size:.6rem;font-weight:800;color:#fff;background:linear-gradient(0deg,rgba(0,0,0,.65),transparent);padding:.5rem .3rem .15rem;text-align:center}
#ast-root .ast-ex{margin-bottom:.5rem}#ast-root .ast-ex summary{cursor:pointer;font-weight:800;color:#173f35;margin-bottom:.3rem}#ast-root .ast-g{display:flex;flex-wrap:wrap;gap:.25rem;align-items:center;margin:.3rem 0}#ast-root .ast-g b{font-size:.7rem;color:#6b6556;width:100%}#ast-root .ast-ch{font:inherit;font-size:.7rem;font-weight:800;padding:.22rem .55rem;border-radius:999px;cursor:pointer;color:#fff;text-decoration:none;border:1px solid rgba(255,255,255,.28);background:linear-gradient(180deg,rgba(23,63,53,.75),rgba(23,63,53,.55));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -2px 4px rgba(0,0,0,.18);transition:transform .15s,background .15s}#ast-root .ast-ch:hover{transform:translateY(-2px);background:linear-gradient(180deg,rgba(80,200,120,.6),rgba(30,120,70,.5))}#ast-root .ast-n{font-size:.72rem;color:#6b6556;line-height:1.7;margin:.4rem 0}#ast-root .ast-n a{color:#0d9488;font-weight:800}#ast-root .ast-w{background:#fff7e6;border:1px solid #f0d9a8;border-radius:10px;padding:.5rem .6rem;color:#7a5a12}`;
    document.head.appendChild(st);
  };
  const opt = (o, cur, all) => (all != null ? `<option value="">${all}</option>` : "") + Object.keys(o).map(k => `<option value="${k}"${cur === k ? " selected" : ""}>${o[k]}</option>`).join("");
  function pane() {
    css(); return `<div id="ast-root"></div>`;
  }
  function explore() {
    const ch = (n, a, v) => `<button type="button" class="ast-ch" ${a}="${esc(v)}">${esc(n)}</button>`;
    return `<details class="ast-ex" open><summary>استكشف</summary>
<div class="ast-g"><b>الوسائط</b>${MEDIA.map(m => ch(m[1], "data-ast-pre", m[0])).join("")}</div>
<div class="ast-g"><b>اكتشف</b>${DISC.map(m => ch(m[1], "data-ast-pre", m[0])).join("")}</div>
<div class="ast-g"><b>رائج</b>${TREND.map(q => ch(q, "data-ast-qs", q)).join("")}</div>
<div class="ast-g"><b>عمليات بحث شائعة</b>${POPQ.map(q => ch(q, "data-ast-qs", q)).join("")}</div>
<div class="ast-g"><b>على موقع Pixabay</b>${EXT.map(e => `<a class="ast-ch" href="${esc(e[1])}" target="_blank" rel="noopener">${esc(e[0])} ↗</a>`).join("")}</div>
<p class="ast-n">الأقسام ذات السهم تُفتح في موقع Pixabay (واجهته البرمجية لا تتيح الموسيقى والمؤثرات وGIF ونماذج 3D فلا تنزيل مباشر منها).</p></details>`;
  }
  function form() {
    const seg = `<div class="ast-seg">${[["img", "صور ورسوم"], ["vid", "فيديو"], ["ico", "أيقونات"]].map(([k, n]) => `<button type="button" data-ast-tab="${k}" class="${S.tab === k ? "on" : ""}">${n}</button>`).join("")}</div>`;
    if (S.tab === "ico") {
      const lic = S.lic && S.set && S.lic[S.set] ? S.lic[S.set].license : null;
      return seg + `<input type="search" id="ast-iq" placeholder="ابحث بالإنجليزية: cart, honey, star…" value="${esc(S.iq)}" autocomplete="off">
<select id="ast-set"><option value="">كل المجموعات المختارة</option>${SETS.map(k => `<option value="${k}"${S.set === k ? " selected" : ""}>${k}</option>`).join("")}</select>
<label class="ast-c"><input type="checkbox" id="ast-ok"${S.okOnly ? " checked" : ""}> تراخيص حرة فقط (MIT / Apache / CC0 …)</label>
<div class="ast-f"><label class="ast-c" style="margin:0">لون <input type="color" id="ast-ic" value="${esc(S.icolor)}" style="width:44px;padding:0;height:28px;margin:0"></label><button type="button" class="ast-b go" data-ast-go="1">بحث</button></div>` + (lic ? `<p class="ast-n">رخصة المجموعة: <a href="${esc(lic.url || "#")}" target="_blank" rel="noopener">${esc(lic.title || lic.spdx || "")}</a></p>` : "");
    }
    const vid = S.tab === "vid";
    return seg + explore() + `<input type="search" id="ast-q" placeholder="ابحث: honey, cosmetics, fond blanc…" value="${esc(S.q)}" autocomplete="off">
<div class="ast-f">${vid ? `<select id="ast-vtype"><option value="all">كل الأنواع</option><option value="film"${S.vtype === "film" ? " selected" : ""}>مقاطع حقيقية</option><option value="animation"${S.vtype === "animation" ? " selected" : ""}>رسوم متحركة</option></select>`
      : `<select id="ast-type">${opt({ all: "كل الأنواع", photo: "صور", illustration: "رسوم", vector: "متجهات" }, S.type)}</select><select id="ast-ori">${opt({ horizontal: "أفقي", vertical: "عمودي" }, S.ori, "كل الاتجاهات")}</select>`}
<select id="ast-cat">${opt(CATS, S.cat, "كل التصنيفات")}</select>${vid ? "" : `<select id="ast-col">${opt(COLORS, S.color, "كل الألوان")}</select>`}
<select id="ast-min">${opt({ 640: "≥ 640px", 1280: "≥ 1280px", 1920: "≥ 1920px" }, String(S.min), "أي حجم")}</select><select id="ast-ord">${opt({ popular: "الأشهر", latest: "الأحدث" }, S.order)}</select>
<select id="ast-lang">${opt({ fr: "لغة البحث: Français", en: "English", es: "Español", de: "Deutsch", tr: "Türkçe" }, S.lang)}</select></div>
<label class="ast-c"><input type="checkbox" id="ast-ed"${S.ed ? " checked" : ""}> اختيار المحررين فقط</label><label class="ast-c"><input type="checkbox" id="ast-safe"${S.safe ? " checked" : ""}> محتوى آمن للعائلة</label>
<button type="button" class="ast-b go" data-ast-go="1" style="width:100%">بحث</button>`;
  }
  function results() {
    if (S.tab !== "ico" && S.err === "nokey") return `<div class="ast-w ast-n">لاستعمال مكتبة الصور والفيديو الواسعة (ملايين الملفات بلا علامات مائية) أدخل مفتاح Pixabay المجاني: <a href="https://pixabay.com/api/docs/" target="_blank" rel="noopener">احصل عليه من هنا</a> (حساب مجاني ثم انسخ المفتاح).<br><input type="password" id="ast-key" placeholder="الصق المفتاح هنا" autocomplete="off" style="margin-top:.4rem"><button type="button" class="ast-b go" data-ast-key="1" style="width:100%">حفظ المفتاح</button><br>يُحفظ المفتاح في متصفحك فقط.</div>`;
    if (S.busy) return `<p class="ast-n">جارٍ البحث…</p>`;
    if (S.err) return `<p class="ast-n" style="color:#b91c1c">${esc(S.err)}</p>`;
    if (!S.res) return `<p class="ast-n">${S.tab === "ico" ? "اكتب كلمة ثم «بحث» — أيقونات SVG ملوّنة بلونك تُحفظ في موقعك." : "اكتب كلمة ثم «بحث». النتائج بلا علامات مائية، وتُنزَّل إلى موقعك عند النقر."}</p>`;
    if (!S.res.length) return `<p class="ast-n">لا نتائج. جرّب كلمة أخرى (الأفضل بالإنجليزية أو الفرنسية) أو خفّف الفلاتر.</p>`;
    const grid = S.tab === "ico" ? "ic" : "";
    let h = `<div class="ast-grid ${grid}">` + S.res.map((x, i) => {
      const busy = S.ibusy === (S.tab === "ico" ? "ico" : S.tab) + i ? " busy" : "";
      if (S.tab === "ico") return `<button type="button" class="ast-i${busy}" data-ast-take="${i}" title="${esc(x)}"><img loading="lazy" alt="" src="${esc(iconSvgUrl(x, S.icolor))}"></button>`;
      if (S.tab === "vid") { const v = x.videos && (x.videos.tiny || x.videos.small); return `<button type="button" class="ast-i${busy}" data-ast-take="${i}" title="${esc(x.tags)}"><img loading="lazy" alt="" src="${esc("https://i.vimeocdn.com/video/" + x.picture_id + "_295x166.jpg")}"><span>${esc(x.duration)}ث — ${esc(x.user)}</span></button>`; }
      return `<button type="button" class="ast-i${busy}" data-ast-take="${i}" title="${esc(x.tags)}"><img loading="lazy" alt="" src="${esc(x.previewURL || x.webformatURL)}"><span>${esc(x.imageWidth)}×${esc(x.imageHeight)} — ${esc(x.user)}</span></button>`;
    }).join("") + `</div>`;
    const pages = Math.ceil(S.total / (S.tab === "ico" ? 96 : 30));
    if (S.tab !== "ico" && pages > 1) h += `<div class="ast-f" style="margin-top:.5rem"><button type="button" class="ast-b" data-ast-pg="-1"${S.page <= 1 ? " disabled" : ""}>السابق</button><button type="button" class="ast-b" data-ast-pg="1"${S.page >= pages ? " disabled" : ""}>التالي</button></div><p class="ast-n">صفحة ${S.page} من ${pages} — ${S.total} نتيجة</p>`;
    h += S.tab === "ico" ? `<p class="ast-n">انقر الأيقونة لإضافتها SVG بلونك. تأكد من رخصة المجموعة قبل أي إعادة توزيع.</p>` : `<p class="ast-n">انقر للتنزيل والإضافة. ترخيص Pixabay يسمح بالاستعمال التجاري بلا نسب؛ لا تعد بيع الملفات أو توزيعها كمكتبة مستقلة.</p>`;
    return h;
  }
  function draw() {
    const root = document.getElementById("ast-root"); if (!root) return;
    const q = root.querySelector("#ast-q,#ast-iq"), foc = q && document.activeElement === q;      // لا نعيد بناء النموذج أثناء الكتابة
    let f = root.querySelector("#ast-form"), o = root.querySelector("#ast-out");
    if (!f) { root.innerHTML = `<div id="ast-form"></div><div id="ast-out"></div>`; f = root.querySelector("#ast-form"); o = root.querySelector("#ast-out"); }
    if (f.dataset.sig !== S.tab + S.set + S.okOnly + (S.lic && S.set && S.lic[S.set] ? "1" : "0") || !foc) { f.innerHTML = form(); f.dataset.sig = S.tab + S.set + S.okOnly + (S.lic && S.set && S.lic[S.set] ? "1" : "0"); }
    o.innerHTML = results();
  }
  function bind(root) {
    if (!root || root.__ast) { draw(); return; } root.__ast = 1;
    const read = () => {
      const g = id => root.querySelector("#" + id), v = id => { const e = g(id); return e ? e.value : undefined; }, c = id => { const e = g(id); return e ? e.checked : undefined; };
      if (S.tab === "ico") { const a = { iq: v("ast-iq"), set: v("ast-set"), okOnly: c("ast-ok"), icolor: v("ast-ic") }; Object.keys(a).forEach(k => { if (a[k] !== undefined) S[k] = a[k]; }); }
      else { const a = { q: v("ast-q"), type: v("ast-type"), ori: v("ast-ori"), cat: v("ast-cat"), color: v("ast-col"), min: v("ast-min"), order: v("ast-ord"), lang: v("ast-lang"), vtype: v("ast-vtype"), ed: c("ast-ed"), safe: c("ast-safe") }; Object.keys(a).forEach(k => { if (a[k] !== undefined) S[k] = a[k]; }); }
      keep();
    };
    const run = () => { read(); S.page = 1; search(); };
    root.addEventListener("click", e => {
      const t = e.target.closest("[data-ast-tab]"); if (t) { read(); S.tab = t.dataset.astTab; S.res = null; S.err = ""; S.page = 1; keep(); root.querySelector("#ast-form").dataset.sig = ""; draw(); if (S.tab !== "ico" && !canSearch()) { S.err = "nokey"; draw(); } return; }
      const pre = e.target.closest("[data-ast-pre]"); if (pre) { const d = (MEDIA.concat(DISC).find(x => x[0] === pre.dataset.astPre) || [])[2]; if (d) { read(); if (S.tab === "ico") S.tab = "img"; Object.assign(S, { q: "" }, d); keep(); root.querySelector("#ast-form").dataset.sig = ""; root.querySelector("#ast-form").innerHTML = ""; S.page = 1; return search(); } }
      const qs = e.target.closest("[data-ast-qs]"); if (qs) { read(); if (S.tab === "ico") S.tab = "img"; S.q = qs.dataset.astQs; keep(); root.querySelector("#ast-form").dataset.sig = ""; root.querySelector("#ast-form").innerHTML = ""; S.page = 1; return search(); }
      if (e.target.closest("[data-ast-go]")) return run();
      const k = e.target.closest("[data-ast-key]"); if (k) { const v = (root.querySelector("#ast-key").value || "").trim(); if (!/^[0-9]{5,}-[0-9a-f]{10,}$/i.test(v)) { toast("❌ شكل المفتاح غير صحيح"); return; } try { localStorage.setItem(LSK, v); } catch (x) { } S.err = ""; toast("✅ حُفظ المفتاح"); return run(); }
      const pg = e.target.closest("[data-ast-pg]"); if (pg && !pg.disabled) { S.page = Math.max(1, S.page + Number(pg.dataset.astPg)); return search(); }
      const tk = e.target.closest("[data-ast-take]"); if (tk) return take(S.tab, Number(tk.dataset.astTake));
    });
    root.addEventListener("keydown", e => { if (e.key === "Enter" && /^ast-(q|iq|key)$/.test(e.target.id)) { e.preventDefault(); if (e.target.id === "ast-key") root.querySelector("[data-ast-key]").click(); else run(); } });
    root.addEventListener("change", e => { if (e.target.id && /^ast-/.test(e.target.id) && e.target.id !== "ast-key" && e.target.id !== "ast-q" && e.target.id !== "ast-iq") { read(); if (S.tab === "ico" && /ast-(set|ok)/.test(e.target.id)) root.querySelector("#ast-form").dataset.sig = ""; if (S.res) { S.page = 1; search(); } else draw(); } });
    if (!S.sets && !S.lic) { S.lic = {}; fetch(IC + "collections?prefixes=" + SETS.join(",")).then(r => r.json()).then(j => { S.lic = j || {}; draw(); }).catch(() => { }); }
    root.querySelector("#ast-form") || draw();
    if (S.tab !== "ico" && !canSearch()) S.err = "nokey"; draw();
  }
  return { pane, bind, pixUrl, iconUrl, iconSvgUrl, licOk, pickVideo, search, take, key, _S: S, OK_LIC, _px: PX_ST, EXT };
})();
