/* لوحة التحكم ← «الهيدر» و«الفوتر»: تعديل كل مكوّنات الهيدر والفوتر وحسابات التواصل وإعدادات المشاركة، مع معاينة حيّة.
   تُحفظ في assets/data/chrome.json (GitHub أو نسخة PHP عبر GH.putFile) وتطبّقها assets/js/chrome.js على كل صفحات الموقع. */
window.ChromeAdmin = (function () {
  const C = () => window.Chrome, SI = () => window.SocialIcons, esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const site = () => (typeof SITE_CFG !== "undefined" && SITE_CFG) || (typeof CONFIG !== "undefined" && CONFIG.SITE) || {};
  const HN = { logo: "الشعار", menu: "قائمة الروابط", social: "أيقونات التواصل", share: "زر المشاركة", account: "زر الحساب 👤", cart: "زر السلة 🛒" };
  const FN = { about: "نبذة عن المتجر", links: "روابط سريعة", contact: "تواصل معنا", social: "أيقونات التواصل", custom: "قسم نصي حرّ" };
  const SN = { whatsapp: "واتساب", facebook: "فيسبوك", messenger: "ماسنجر", telegram: "تيليغرام", x: "إكس", linkedin: "لينكدإن", pinterest: "بنترست", viber: "فايبر", reddit: "ريديت", email: "بريد إلكتروني", sms: "رسالة نصية" };
  const STY = [["brand", "خلفية بلون العلامة"], ["color", "رمز بلون العلامة"], ["soft", "خلفية فاتحة"], ["outline", "إطار"], ["mono", "لون النص"]], SHP = [["round", "دائري"], ["square", "مربع مدوَّر"], ["none", "بلا خلفية"]];
  /* بادئات تُكمَل بها المعرّفات المكتوبة بلا رابط كامل */
  const PRE = { facebook: "https://facebook.com/", instagram: "https://instagram.com/", tiktok: "https://tiktok.com/@", youtube: "https://youtube.com/@", x: "https://x.com/", telegram: "https://t.me/", snapchat: "https://snapchat.com/add/", pinterest: "https://pinterest.com/", linkedin: "https://linkedin.com/in/", threads: "https://threads.net/@", messenger: "https://m.me/", twitch: "https://twitch.tv/", github: "https://github.com/", reddit: "https://reddit.com/user/", vimeo: "https://vimeo.com/", medium: "https://medium.com/@", behance: "https://behance.net/", dribbble: "https://dribbble.com/", discord: "https://discord.gg/", kick: "https://kick.com/", soundcloud: "https://soundcloud.com/", spotify: "https://open.spotify.com/user/", tumblr: "https://tumblr.com/" };
  const S = { cfg: null, sha: undefined, tab: "header", pv: null, cust: {}, pages: null, acc: { logo: 1 } };

  const get = (p) => p.split(".").reduce((o, k) => (o == null ? o : o[k]), S.cfg);
  const put = (p, v) => { const ks = p.split("."), last = ks.pop(); let o = S.cfg; ks.forEach(k => { if (o[k] == null || typeof o[k] !== "object") o[k] = {}; o = o[k]; }); o[last] = v; };
  /* حقول: كلها تكتب في المسار p عبر ChromeAdmin.set */
  const lab = (p, l) => { if (typeof CtlHelp === "undefined") return l; const x = CtlHelp.qp(p, l); return esc(x.t) + x.q; };
  const F = {
    t: (p, l, o) => '<label class="ca-f"><span>' + lab(p, l) + '</span><input data-p="' + p + '" value="' + esc(get(p)) + '" placeholder="' + esc((o && o.ph) || "") + '"' + (o && o.ltr ? ' dir="ltr"' : "") + "></label>",
    a: (p, l, o) => '<label class="ca-f"><span>' + lab(p, l) + '</span><textarea data-p="' + p + '" rows="' + ((o && o.rows) || 3) + '" placeholder="' + esc((o && o.ph) || "") + '">' + esc(get(p)) + "</textarea></label>",
    c: (p, l) => '<label class="ca-c"><input type="checkbox" data-p="' + p + '"' + (get(p) ? " checked" : "") + "><span>" + lab(p, l) + "</span></label>",
    n: (p, l, mn, mx) => '<label class="ca-f"><span>' + lab(p, l) + '</span><input type="number" data-p="' + p + '" min="' + mn + '" max="' + mx + '" value="' + esc(get(p)) + '"></label>',
    s: (p, l, opts) => '<label class="ca-f"><span>' + lab(p, l) + '</span><select data-p="' + p + '">' + opts.map(o => '<option value="' + o[0] + '"' + (get(p) === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select></label>",
    col: (p, l) => { const v = get(p) || ""; return '<div class="ca-f"><span>' + lab(p, l) + '</span><div class="ca-col"><input type="color" data-p="' + p + '" value="' + (/^#[0-9a-f]{6}$/i.test(v) ? v : "#ffffff") + '"><button type="button" class="small gray" data-clr="' + p + '">افتراضي</button><i>' + (v || "افتراضي") + "</i></div></div>"; }
  };
  const cardH = (title, tools, on) => '<div class="ca-h"><b>' + title + '</b><span class="ca-tools">' + (tools || "") + "</span></div>";
  const mv = (kind, i) => '<button type="button" class="small gray" data-mv="' + kind + ':' + i + ':-1" title="أعلى">▲</button><button type="button" class="small gray" data-mv="' + kind + ':' + i + ':1" title="أسفل">▼</button>';
  /* قائمة روابط (عنوان + رابط) */
  /* قائمة روابط: لكل صف النص + اختيار «العنوان» من عناوين الموقع المتاحة (إعدادها في بطاقة «عناوين الموقع»)، أو «عنوان مخصص» برابط */
  function linkList(path, label) {
    const L = get(path) || [], reg = S.cfg.links || [];
    return '<div class="ca-list">' + L.map((it, i) => {
      const key = path + "." + i, hit = reg.find(r => r.url === it.url), cust = !!S.cust[key] || (!hit && !!it.url) || (!hit && !it.label);
      return '<div class="ca-row"><input data-p="' + key + '.label" value="' + esc(it.label) + '" placeholder="النص (فارغ = اسم العنوان)"><select data-lk="' + key + '"><option value="">— اختر عنواناً —</option>' + reg.map(r => '<option value="' + esc(r.url) + '"' + (!cust && hit && hit.url === r.url ? " selected" : "") + ">" + esc(r.label) + "</option>").join("") + '<option value="__c"' + (cust ? " selected" : "") + ">➕ عنوان مخصص (برابط)</option></select>" + (cust ? '<input data-p="' + key + '.url" value="' + esc(it.url) + '" dir="ltr" placeholder="https://… أو index.html#قسم">' : "") + '<span class="ca-tools">' + mv(path + "|", i) + '<button type="button" class="small red" data-del="' + path + ":" + i + '">✕</button></span></div>';
    }).join("") + '</div><button type="button" class="small" data-add="' + path + '">+ ' + label + "</button>";
  }
  /* عناوين الموقع المتاحة (cfg.links): يختار منها الهيدر والفوتر ومنشئ الصفحات؛ تُضاف صفحات الموقع ومنتجاته بنقرة أو عنوان مخصص */
  function linksCard() {
    const L = S.cfg.links || [], pages = (S.pages || []).filter(x => x && x.slug), prods = ((typeof Admin !== "undefined" && Admin.products) || []).filter(x => x && x.slug);
    const opt = (grp, arr, f) => arr.length ? '<optgroup label="' + grp + '">' + arr.map(f).join("") + "</optgroup>" : "";
    return '<div class="card"><div class="section-title">🧭 عناوين الموقع المتاحة</div><div class="hint">هذه قائمة كل العناوين (الصفحات والأقسام) التي تختار منها روابط قوائم الهيدر والفوتر وهيدر منشئ الصفحات بدل كتابة الروابط. أضف عنواناً جديداً مخصصاً برابط، أو أضف إحدى صفحاتك/منتجاتك بنقرة، ثم انشر.</div>' +
      '<div class="ca-list">' + L.map((it, i) => '<div class="ca-row"><input data-p="links.' + i + '.label" value="' + esc(it.label) + '" placeholder="اسم العنوان"><input data-p="links.' + i + '.url" value="' + esc(it.url) + '" dir="ltr" placeholder="index.html#products أو https://…"><span class="ca-tools">' + mv("links|", i) + '<button type="button" class="small red" data-del="links:' + i + '">✕</button></span></div>').join("") + "</div>" +
      '<div class="ca-row"><button type="button" class="small" data-add="links">➕ عنوان جديد مخصص (اسم + رابط)</button>' + '<select data-addpage="1"><option value="">📄 إضافة من صفحاتي ومنتجاتي…</option>' + opt("صفحات الهبوط", pages, x => '<option value="lp/' + esc(x.slug) + '/|' + esc(x.title || x.slug) + '">' + esc(x.title || x.slug) + "</option>") + opt("المنتجات", prods, x => '<option value="p/' + esc(x.slug) + '/|' + esc(x.title || x.slug) + '">' + esc(x.title || x.slug) + "</option>") + "</select></div></div>";
  }
  function orderCard(kind, names) {
    const ord = get(kind + ".order");
    return '<div class="card"><div class="section-title">ترتيب المكوّنات</div><div class="hint">رتّب ظهور المكوّنات (الأول يظهر أولاً من جهة اليمين). كل مكوّن له إعداداته أدناه.</div><div class="ca-ord">' + ord.map((id, i) => '<span class="ca-chip">' + names[id] + (get(kind + "." + id + ".show") === false ? " <small>(مخفي)</small>" : "") + mv(kind + ".order", i) + "</span>").join("") + "</div></div>";
  }
  /* لوحة حسابات التواصل (مشتركة بين الهيدر والفوتر) */
  function socialCard() {
    const L = S.cfg.social || [], hs = S.cfg.header.social.show, fs = S.cfg.footer.social.show;
    return '<div class="card"><div class="section-title">حسابات التواصل الاجتماعي (للهيدر والفوتر معاً)</div><div class="hint">اضغط على الأيقونة لإضافتها ثم اكتب الرابط أو اسم الحساب فقط. الحالة الآن: ' + (hs ? "✔ ظاهرة في الهيدر" : "✖ غير ظاهرة في الهيدر") + " · " + (fs ? "✔ ظاهرة في الفوتر" : "✖ غير ظاهرة في الفوتر") + "</div>" +
      '<div class="ca-pal">' + SI().list.map(i => '<button type="button" class="ca-pi" data-addsoc="' + i.id + '" title="' + i.label + '">' + SI().icon(i.id, { size: 18, style: "brand", shape: "round" }) + "<small>" + i.label + "</small></button>").join("") + "</div>" +
      '<div class="ca-list">' + L.map((s, i) => '<div class="ca-row ca-soc">' + SI().icon(s.id, { size: 18, style: "brand", shape: "round" }) + "<b>" + esc((SI().byId[s.id] || {}).label || s.id) + '</b><input data-p="social.' + i + '.url" data-soc="' + s.id + '" value="' + esc(s.url) + '" dir="ltr" placeholder="https://… أو اسم الحساب فقط"><span class="ca-tools">' + mv("social|", i) + '<button type="button" class="small red" data-del="social:' + i + '">✕</button></span></div>').join("") + "</div>" +
      '<div class="ca-chk">' + F.c("header.social.show", "إظهار الأيقونات في الهيدر") + F.c("footer.social.show", "إظهار الأيقونات في الفوتر") + "</div></div>";
  }
  function socialStyle(kind) {
    return '<div class="grid2">' + F.s(kind + ".social.style", "نمط الأيقونات", STY) + F.s(kind + ".social.shape", "الشكل", SHP) + F.n(kind + ".social.size", "الحجم (بكسل)", 12, 40) + "</div>";
  }
  function shareCard() {
    const sh = S.cfg.share;
    return '<div class="card"><div class="section-title">نافذة المشاركة (للرئيسية وصفحات المنتجات)</div><div class="hint">تفتح من أيقونة المشاركة فتعرض نسخ الرابط وأدوات المشاركة المختارة.</div><div class="ca-chk">' + F.c("header.share.show", "أيقونة المشاركة في الهيدر") + F.c("footer.share.show", "زر «شارك الموقع» في الفوتر") + F.c("share.float", "زر عائم على الصفحة") + "</div>" +
      '<div class="grid2">' + F.s("share.pos", "مكان الزر العائم", [["bottom-left", "أسفل اليسار"], ["bottom-right", "أسفل اليمين"]]) + F.s("header.share.style", "نمط أيقونة الهيدر", STY) + "</div>" + F.t("share.text", "نص يرافق الرابط عند المشاركة (اختياري)", { ph: "مثال: اكتشف منتجات أليسوم الطبيعية 🌿" }) +
      '<div class="section-title">أدوات المشاركة الظاهرة</div><div class="ca-pal">' + C().SHARE_ALL.map(id => '<label class="ca-pi' + (sh.channels.includes(id) ? " on" : "") + '"><input type="checkbox" data-ch="' + id + '"' + (sh.channels.includes(id) ? " checked" : "") + ">" + SI().icon(id, { size: 16, style: "brand", shape: "round" }) + "<small>" + SN[id] + "</small></label>").join("") + "</div></div>";
  }
  /* بطاقة قابلة للطيّ لكل عنصر في الهيدر: المحتوى ثم التنسيق (نفس أسماء العناصر) */
  const acc = (key, title, content, style, on) => '<details class="card ca-acc" data-acc="' + key + '"' + (S.acc[key] ? " open" : "") + '><summary class="ca-h"><b>' + title + "</b>" + (on === false ? '<small class="ca-off">مخفي</small>' : "") + "</summary>" + '<div class="ca-sub">محتوى</div>' + content + (style ? '<div class="ca-sub">🎨 التنسيق</div>' + style : "") + "</details>";
  const prodsList = () => ((typeof Admin !== "undefined" && Admin.products) || []).filter(x => x && x.slug);
  /* قائمة عناوين الهيدر: عنوان ذكي (الرئيسية/التصنيفات/المتجر/الفئات/المنتجات/حسابي) أو عنوان من سجلّ الموقع أو مخصص */
  function menuList(path) {
    const L = get(path) || [], reg = S.cfg.links || [], MK = C().MK, MKL = C().MK_LIST;
    const nm = it => it.label || (it.kind ? MK[it.kind][0] : (it.url ? "رابط" : "عنوان")), icon = it => it.kind ? (MKL.find(x => x[0] === it.kind) || ["", "🔗"])[1].split(" ")[0] : "🔗";
    return '<div class="ca-list">' + L.map((it, i) => {
      const key = path + "." + i, op = S.mcOpen === key;
      const pk = it.kind === "prods" ? '<details class="ca-pk"><summary>اختر منتجات معيّنة <b>(' + ((it.slugs || []).length || "الكل") + ')</b> — بلا اختيار = كل المنتجات</summary><div class="ca-pkb">' + (prodsList().map(x => '<label class="ca-c"><input type="checkbox" data-pk="' + key + '" data-v="' + esc(x.slug) + '"' + ((it.slugs || []).includes(x.slug) ? " checked" : "") + "><span>" + esc(x.title || x.slug) + "</span></label>").join("") || "لا منتجات") + "</div></details>" : "";
      return '<div class="ca-mc' + (op ? " open" : "") + (it.h ? " off" : "") + '"><div class="ca-mch" data-mcopen="' + key + '"><span>' + icon(it) + "</span><b>" + esc(nm(it)) + (it.h ? " <small>(مخفي)</small>" : "") + '</b><span class="ca-tools">' + mv(path + "|", i) + '<button type="button" class="small red" data-del="' + path + ":" + i + '">✕</button></span></div>' +
        (op ? '<div class="ca-mcs"><input data-p="' + key + '.label" value="' + esc(it.label || "") + '" placeholder="' + esc(it.kind ? "النص (فارغ = «" + MK[it.kind][0] + "»)" : "النص") + '">' + (it.kind ? "" : '<input data-p="' + key + '.url" value="' + esc(it.url || "") + '" dir="ltr" placeholder="https://… أو index.html#قسم">') + pk + '<label class="ca-c"><input type="checkbox" data-p="' + key + '.h"' + (it.h ? " checked" : "") + "><span>إخفاء هذا العنوان</span></label></div>" : "") + "</div>";
    }).join("") + '<div class="ca-mc add"><select data-mcadd="' + path + '"><option value="">➕ اضف عنوان…</option>' + MKL.map(x => '<option value="' + x[0] + '">' + esc(x[1]) + "</option>").join("") + '</select><button type="button" class="small" data-addmenu="' + path + '" style="margin-top:.4rem">🔗 رابط مخصص</button></div></div>';
  }
  function socialPick() {
    const g = (S.cfg.social || []).filter(x => x && x.id), ids = S.cfg.header.social.ids || [], av = [{ id: "whatsapp", label: "واتساب (رقم المتجر)" }].concat(g.filter(x => x.id !== "whatsapp").map(x => ({ id: x.id, label: (SI().byId[x.id] || {}).label || x.id })));
    return '<div class="hint">اختر الأيقونة أو الأيقونات التي تظهر في الهيدر قبل السلة. حسابات التواصل تُضاف من بطاقة «حسابات التواصل» أسفل.</div><div class="ca-pal">' + av.map(x => '<label class="ca-pi' + (ids.includes(x.id) ? " on" : "") + '"><input type="checkbox" data-sid="' + x.id + '"' + (ids.includes(x.id) ? " checked" : "") + ">" + SI().icon(x.id, { size: 18, style: "brand", shape: "round" }) + "<small>" + esc(x.label) + "</small></label>").join("") + "</div>";
  }
  function cartPick() {
    const cur = S.cfg.header.cart.icon || "emoji", CI = C().CART_ICONS;
    return '<div class="ca-pal">' + [["emoji", "🛒", "الافتراضية"]].concat(Object.keys(CI).map(k => [k, C().cartIcon(k, 24), CI[k][0]])).map(x => '<button type="button" class="ca-pi' + (cur === x[0] ? " on" : "") + '" data-cic="' + x[0] + '" title="' + esc(x[2]) + '"><span style="font-size:1.3rem;line-height:1">' + x[1] + "</span><small>" + esc(x[2]) + "</small></button>").join("") + "</div>";
  }
  function headerTab() {
    const h = S.cfg.header;
    return linksCard() + '<div class="card"><div class="section-title">عام</div><div class="ca-chk">' + F.c("header.sticky", "الهيدر ثابت أعلى الصفحة عند التمرير") + '</div><div class="grid2">' + F.col("header.bg", "لون خلفية الهيدر") + F.col("header.color", "لون الشعار والروابط") + F.n("header.pad", "التباعد الرأسي (بكسل)", 0, 40) + "</div></div>" +
      '<div class="card">' + cardH("📢 الشريط العلوي") + '<div class="ca-chk">' + F.c("header.topbar.show", "إظهار الشريط العلوي") + "</div>" + F.a("header.topbar.text", "النص (**كلمة** لتغميقها)", { rows: 2 }) + '<div class="grid2">' + F.t("header.topbar.link", "رابط عند الضغط (اختياري)", { ltr: 1 }) + F.col("header.topbar.bg", "لون الخلفية") + F.col("header.topbar.color", "لون النص") + "</div></div>" +
      orderCard("header", HN) +
      acc("logo", "🏷️ الشعار (نصي / صورة)", F.c("header.logo.show", "إظهار الشعار") + '<div class="ca-chk">' + F.c("header.logo.text", "إظهار الشعار النصي") + F.c("header.logo.image", "إظهار صورة الشعار") + "</div>" + F.s("header.logo.link", "رابط الشعار", [["home", "الرئيسية"], ["none", "بدون رابط"]]) + '<div class="hint">صورة الشعار وحجمها من تبويب «المظهر».</div>',
        '<div class="grid2">' + F.col("header.logo.color", "لون الشعار النصي") + F.n("header.logo.size", "حجم الشعار النصي (بكسل)", 14, 60) + "</div>", h.logo.show) +
      acc("menu", "☰ العناوين", F.c("header.menu.show", "إظهار العناوين (على الشاشات الكبيرة)") + '<div class="hint">اختر لكل عنوان من القائمة: الرئيسية، <b>التصنيفات</b> (قائمة بتصنيفات المتجر وكل تصنيف يفتح صفحته)، <b>المتجر</b> (صفحة كل المنتجات)، <b>الفئات</b> (الأكثر طلباً / تخفيضات / جديدة وكل فئة تفتح صفحتها)، <b>المنتجات</b> (قائمة بكل المنتجات أو بمنتجات تختارها)، <b>حسابي</b> (صفحة الدخول أو إنشاء حساب)، أو أي عنوان من «عناوين الموقع» أو مخصص.</div>' + menuList("header.menu.items"),
        '<div class="grid2">' + F.col("header.menu.color", "لون العناوين") + F.col("header.menu.hover", "لون العنوان عند المرور") + F.n("header.menu.size", "حجم الخط (بكسل)", 10, 28) + F.s("header.menu.weight", "سماكة الخط", [["", "افتراضي"], ["400", "عادي"], ["600", "متوسط"], ["700", "عريض"], ["800", "عريض جداً"], ["900", "أسود"]]) + F.n("header.menu.gap", "المسافة بين العناوين (بكسل)", 0, 80) + F.col("header.menu.popbg", "خلفية القوائم المنسدلة") + F.col("header.menu.popcolor", "نص القوائم المنسدلة") + "</div>", h.menu.show) +
      acc("social", "🔗 أيقونات التواصل", F.c("header.social.show", "إظهار الأيقونات (قبل السلة)") + socialPick(),
        '<div class="grid2">' + F.s("header.social.style", "نمط الأيقونات", STY) + F.s("header.social.shape", "الشكل", SHP) + F.n("header.social.size", "الحجم (بكسل)", 12, 48) + F.col("header.social.color", "اللون (للنمط «لون النص»)") + "</div>", h.social.show) +
      acc("share", "📤 النشر", F.c("header.share.show", "إظهار زر النشر") + F.s("header.share.mode", "الشكل", [["icon", "أيقونة نشر"], ["text", "كلمة «انشر»"]]) + F.t("header.share.label", "نص الزر (عند «كلمة»)"),
        '<div class="grid2">' + F.s("header.share.style", "نمط الأيقونة", STY) + F.n("header.share.size", "حجم الأيقونة (بكسل)", 14, 44) + F.col("header.share.color", "لون الأيقونة/الكلمة") + F.col("header.share.bg", "خلفية الكلمة") + "</div>", h.share.show) +
      acc("account", "👤 حسابي", F.c("header.account.show", "إظهار زر «حسابي»"), '<div class="grid2">' + F.col("header.account.bg", "الخلفية") + F.col("header.account.color", "لون الأيقونة") + "</div>", h.account.show) +
      acc("cart", "🛒 السلة", F.c("header.cart.show", "إظهار زر السلة") + '<div class="ca-sub2">أيقونة السلة</div>' + cartPick(), '<div class="grid2">' + F.col("header.cart.bg", "الخلفية") + F.col("header.cart.color", "لون الأيقونة") + "</div>", h.cart.show) +
      socialCard() + shareCard();
  }
  function footerTab() {
    const f = S.cfg.footer;
    return '<div class="card"><div class="section-title">عام</div><div class="ca-chk">' + F.c("footer.show", "إظهار الفوتر") + '</div><div class="grid2">' + F.col("footer.bg", "لون الخلفية") + F.col("footer.color", "لون النص") + F.col("footer.headColor", "لون العناوين") + "</div></div>" +
      orderCard("footer", FN) +
      '<div class="card">' + cardH("ℹ️ نبذة عن المتجر") + F.c("footer.about.show", "إظهار") + F.t("footer.about.title", "العنوان") + F.a("footer.about.text", "النص") + "</div>" +
      '<div class="card">' + cardH("🔗 روابط سريعة") + F.c("footer.links.show", "إظهار") + F.t("footer.links.title", "العنوان") + F.c("footer.links.tracking", "إضافة «تتبّع طلبك» و«حسابي»") + linkList("footer.links.items", "رابط") + "</div>" +
      '<div class="card">' + cardH("📞 تواصل معنا") + F.c("footer.contact.show", "إظهار") + F.t("footer.contact.title", "العنوان") + F.c("footer.contact.wa", "إظهار رقم واتساب المتجر") + '<div class="grid2">' + F.t("footer.contact.phone", "هاتف إضافي", { ltr: 1, ph: "0555 00 00 00" }) + F.t("footer.contact.email", "البريد الإلكتروني", { ltr: 1 }) + F.t("footer.contact.hours", "ساعات العمل") + F.t("footer.contact.address", "العنوان / الولاية") + "</div></div>" +
      '<div class="card">' + cardH("🔗 أيقونات التواصل") + F.c("footer.social.show", "إظهار") + F.t("footer.social.title", "العنوان") + socialStyle("footer") + "</div>" +
      socialCard() +
      '<div class="card">' + cardH("📝 قسم نصي حرّ") + F.c("footer.custom.show", "إظهار") + F.t("footer.custom.title", "العنوان") + F.a("footer.custom.text", "النص (**غامق**، سطر جديد = Enter)") + "</div>" +
      '<div class="card">' + cardH("📤 المشاركة وحقوق النشر") + '<div class="ca-chk">' + F.c("footer.share.show", "زر «شارك الموقع»") + F.c("footer.copy.show", "إظهار سطر الحقوق") + "</div>" + F.t("footer.copy.text", "نص الحقوق") + '<div class="hint">إعدادات نافذة المشاركة في تبويب «الهيدر».</div></div>';
  }
  /* معاينة حيّة داخل iframe بأنماط الموقع نفسها */
  function preview() {
    const fr = document.getElementById("ca-pv-" + S.tab); if (!fr) return;
    const cfg = S.cfg, ctx = { rel: "", wa: site().waNumber || "", site: site(), menuData: { cats: (typeof Admin !== "undefined" && Admin.categories) || (typeof CATEGORIES !== "undefined" ? CATEGORIES : {}), prods: prodsList() } }, th = (typeof Admin !== "undefined" && Admin.theme) || {};
    const base = location.href.replace(/[^/]*$/, ""), nm = esc(site().name || "المتجر");
    const hc = cfg.header.cart, keep = { logo: '<a class="logo"' + (cfg.header.logo.link === "none" ? ' data-nolink="1"' : ' href="#"') + ">" + nm + "</a>", cart: '<button class="cart-btn" type="button"><span aria-hidden="true">' + (C().CART_ICONS[hc.icon] ? C().cartIcon(hc.icon, 22) : "🛒") + '</span><span class="cart-count">0</span></button>', account: '<button class="acc-btn" type="button">👤</button>' };
    const tb = C().topbarHtml(cfg, ctx);
    const body = S.tab === "header" ? (tb ? '<div class="topbar">' + tb + "</div>" : "") + '<header class="site"><div class="container">' + C().headerHtml(cfg, ctx, keep) + "</div></header>" : '<footer class="site" style="margin:0"><div class="container">' + (cfg.footer.show ? C().footerHtml(cfg, ctx) : "<p>الفوتر مخفي</p>") + "</div></footer>";
    const font = th.fontUrl ? '<link rel="stylesheet" href="' + esc(th.fontUrl) + '">' : "";
    fr.srcdoc = '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><base href="' + esc(base) + '">' + font + '<link rel="stylesheet" href="assets/css/style.css"><style>body{margin:0;font-family:' + (th.fontFamily || "Cairo,Tahoma,sans-serif") + '}header.site{position:static!important}.acc-btn{background:#fff;border:1px solid #ddd;border-radius:12px;width:44px;height:44px}' + C().css(cfg, ctx) + "</style></head><body>" + body + "</body></html>";
  }
  let pvT = 0; const pvLater = () => { clearTimeout(pvT); pvT = setTimeout(preview, 160); };

  function render() {
    const box = document.getElementById("ca-body-" + S.tab); if (!box || !S.cfg) return;
    const y = box.scrollTop; box.innerHTML = S.tab === "header" ? headerTab() : footerTab(); preview();
  }
  function bind(root) {
    if (root._b) return; root._b = true;
    root.addEventListener("toggle", e => { const d = e.target; if (d && d.dataset && d.dataset.acc) S.acc[d.dataset.acc] = d.open ? 1 : 0; }, true);
    root.addEventListener("input", e => {
      const el = e.target, p = el.dataset && el.dataset.p; if (!p || el.type === "checkbox" || el.tagName === "SELECT") return;
      put(p, el.type === "number" ? (el.value === "" ? "" : +el.value) : el.value); if (el.type === "color") { const i = el.parentNode.querySelector("i"); if (i) i.textContent = el.value; } pvLater();
    });
    root.addEventListener("change", e => {
      const el = e.target;
      if (el.dataset.ch) { const a = S.cfg.share.channels; el.checked ? (!a.includes(el.dataset.ch) && a.push(el.dataset.ch)) : a.splice(a.indexOf(el.dataset.ch), 1); el.parentNode.classList.toggle("on", el.checked); preview(); return; }
      if (el.dataset.sid) { const ids = S.cfg.header.social.ids = S.cfg.header.social.ids || [], i = ids.indexOf(el.dataset.sid); el.checked ? (i < 0 && ids.push(el.dataset.sid)) : (i >= 0 && ids.splice(i, 1)); el.parentNode.classList.toggle("on", el.checked); preview(); return; }
      if (el.dataset.pk) { const row = get(el.dataset.pk); row.slugs = row.slugs || []; const i = row.slugs.indexOf(el.dataset.v); el.checked ? (i < 0 && row.slugs.push(el.dataset.v)) : (i >= 0 && row.slugs.splice(i, 1)); const sm = el.closest("details").querySelector("summary b"); if (sm) sm.textContent = "(" + (row.slugs.length || "الكل") + ")"; preview(); return; }
      if (el.dataset.mcadd) { if (!el.value) return; const arr = get(el.dataset.mcadd); arr.push({ kind: el.value, label: "" }); S.mcOpen = el.dataset.mcadd + "." + (arr.length - 1); render(); return; }
      if (el.dataset.lk) { const key = el.dataset.lk, row = get(key); if (el.value === "__c") { S.cust[key] = 1; row.url = ""; } else { delete S.cust[key]; row.url = el.value; if (!row.label) { const r = (S.cfg.links || []).find(q => q.url === el.value); if (r) row.label = r.label; } } render(); return; }
      if (el.dataset.addpage) { const [u, t] = String(el.value).split("|"); if (u) { S.cfg.links.push({ label: t, url: u }); } render(); return; }
      const p = el.dataset.p; if (!p) return;
      if (el.type === "checkbox") { put(p, el.checked); render(); }
      else if (el.tagName === "SELECT") { put(p, el.value); preview(); }
      else if (el.dataset.soc) {                // إكمال الرابط من اسم الحساب
        let v = el.value.trim(), id = el.dataset.soc;
        if (v && !/^(https?:|mailto:|tel:)/i.test(v)) {
          v = v.replace(/^@/, "");
          if (id === "whatsapp" && /^[\d+\s]+$/.test(v)) v = "https://wa.me/" + v.replace(/\D/g, "").replace(/^0/, "213");
          else if (id === "gmail") v = "mailto:" + v;
          else if (PRE[id] && !/[./]/.test(v)) v = PRE[id] + v; else if (!/^[\w-]+\.[a-z]{2,}/i.test(v)) v = PRE[id] ? PRE[id] + v : v; else v = "https://" + v;
        }
        el.value = v; put(p, v); preview();
      }
    });
    root.addEventListener("click", e => {
      const mh = e.target.closest("[data-mcopen]"); if (mh && !e.target.closest("button")) { S.mcOpen = S.mcOpen === mh.dataset.mcopen ? "" : mh.dataset.mcopen; render(); return; }
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.clr) { put(b.dataset.clr, ""); render(); }
      else if (b.dataset.addsoc) { S.cfg.social.push({ id: b.dataset.addsoc, url: "" }); render(); setTimeout(() => { const ins = root.querySelectorAll("[data-soc]"); ins[ins.length - 1] && ins[ins.length - 1].focus(); }, 30); }
      else if (b.dataset.del) { S.mcOpen = ""; const [p, i] = b.dataset.del.split(":"); get(p).splice(+i, 1); render(); }
      else if (b.dataset.cic) { S.cfg.header.cart.icon = b.dataset.cic; render(); }
      else if (b.dataset.addmenu) { const arr = get(b.dataset.addmenu); arr.push({ label: "", url: "" }); S.mcOpen = b.dataset.addmenu + "." + (arr.length - 1); render(); }
      else if (b.dataset.add) { get(b.dataset.add).push({ label: "", url: "" }); render(); }
      else if (b.dataset.mv) { S.mcOpen = ""; let [k, i, d] = b.dataset.mv.split(":"); k = k.replace("|", ""); i = +i; d = +d; const a = get(k), j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; render(); }
    });
  }

  async function load() {
    if (S.cfg) return;
    let cfg = null; const g = (typeof GH !== "undefined" && GH.cfg && GH.cfg());
    if (g && g.token) { try { const f = await GH.getFile("assets/data/chrome.json"); S.sha = f.sha; cfg = JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); } catch (e) { S.sha = undefined; } }
    else { try { const r = await fetch("assets/data/chrome.json", { cache: "no-store" }); if (r.ok) cfg = await r.json(); } catch (e) { } }
    if (cfg && cfg.off) cfg = null;
    S.cfg = C().norm(cfg, site());
    try { const r = await fetch("assets/pages/index.json", { cache: "no-store" }); S.pages = r.ok ? await r.json() : []; } catch (e) { S.pages = []; }
  }
  const out = {
    async open(tab) {
      S.tab = tab; await load();
      ["header", "footer"].forEach(t => { const r = document.getElementById("ca-body-" + t); if (r) bind(r); });
      render();
    },
    async save() {
      toast("⏳ جارِ النشر على GitHub...");
      try {
        const cfg = C().norm(S.cfg, site()), b64 = btoa(unescape(encodeURIComponent(JSON.stringify(cfg, null, 2))));
        const res = await GH.putFile("assets/data/chrome.json", b64, S.sha, "تحديث الهيدر والفوتر وأيقونات التواصل والمشاركة عبر لوحة التحكم");
        S.sha = res && res.content ? res.content.sha : S.sha; toast("✅ تم النشر — يظهر على الموقع خلال دقيقة تقريباً");
      } catch (err) { console.error(err); toast("❌ " + err.message); }
    },
    async reset() {
      if (!confirm("استرجاع الهيدر والفوتر الأصليين للموقع (إلغاء كل التخصيصات)؟")) return;
      try {
        const b64 = btoa(unescape(encodeURIComponent('{"off":true}\n')));
        const res = await GH.putFile("assets/data/chrome.json", b64, S.sha, "استرجاع الهيدر والفوتر الافتراضيين");
        S.sha = res && res.content ? res.content.sha : S.sha; S.cfg = C().norm(null, site()); render(); toast("✅ تم الاسترجاع");
      } catch (err) { toast("❌ " + err.message); }
    },
    state: S
  };
  return out;
})();
