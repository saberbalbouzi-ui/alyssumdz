/* مساحة المستقل — شبكة الخبراء: تسجيل ملف، معرض أعمال، تعرفة، روابط تواصل، وإدارة الملف بمفتاح سرّي (بلا حساب بريد).
   تتصل بالخادم عبر دوالّ محدودة فقط (expert_register / expert_me / expert_update / expert_pause / expert_delete)، ولا تقرأ أي جدول.
   المفتاح السرّي يظهر مرة واحدة ويُحفظ في هذا المتصفح؛ ضياعه = طلب إعادة تعيين من الإدارة. */
const ExpertsPage = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CFG = window.SAAS_CFG || {};
  const LS = "alyssum_expert_me", LL = "alyssum_expert_lang";
  const MAXP = 8, IMG_MAX = 140000, THUMB_MAX = 38000;     // حدود الخادم: صورة ≤150000 حرف، مصغّرة ≤40000
  const SOC = [["instagram", "Instagram"], ["tiktok", "TikTok"], ["facebook", "Facebook"], ["youtube", "YouTube"], ["behance", "Behance"], ["linkedin", "LinkedIn"], ["telegram", "Telegram"], ["website", "Site / موقع"]];
  const T = {
    ar: {
      title: "شبكة الخبراء", sub: "مساحة المستقل", h1: "انضم إلى شبكة الخبراء الجزائرية", lead: "ملفك يظهر لأصحاب المتاجر الإلكترونية الباحثين عن مصمم، مشتري إعلانات، مؤكِّدة طلبات، موزّع أو صانع محتوى UGC — ويتواصلون معك مباشرة على واتساب.",
      p1: "التسجيل مجاني", p2: "تتفق على السعر مباشرة مع التاجر", p3: "تقييمات حقيقية بعد التواصل", reg: "إنشاء ملفي", mine: "لدي ملف — دخول", id: "معرّف الملف", key: "المفتاح السرّي", enter: "دخول", out: "خروج",
      name: "الاسم (أو اسم الاستوديو)", headline: "عنوان مختصر (مثال: مصمم هوية وتغليف لمنتجات التجميل)", cat: "التخصص", bio: "نبذة عنك وخبرتك", wilaya: "الولاية", city: "المدينة / البلدية", remote: "أعمل عن بُعد", wa: "رقم واتساب (يُعرض فقط للمتاجر المسجَّلة)", rt: "نوع التسعير", rf: "من (دج)", rto: "إلى (دج)", langs: "اللغات",
      rts: { quote: "حسب الاتفاق", hourly: "للساعة", per_task: "للمهمة", monthly: "شهرياً", per_order: "للطلب" }, soc: "روابط حساباتك (اختياري — https فقط)", port: "معرض أعمالك", portHint: "حتى 8 عناصر: صور تُضغط تلقائياً قبل الرفع، أو روابط أعمال (Behance، Drive…).", addImg: "＋ رفع صور", addLink: "＋ رابط عمل", title_: "عنوان", linkT: "رابط https", consent: "أوافق على عرض ملفي ورقم واتساب الخاص بي لأصحاب المتاجر المسجَّلين في المنصة وعلى تخزين بياناتي لهذا الغرض، وأقرّ بأنّ الاتفاق والدفع يتمّان خارج المنصة بيني وبين التاجر. يمكنني حذف ملفي في أي وقت.",
      save: "حفظ التعديلات", send: "إرسال الملف للمراجعة", pause: "إيقاف الظهور", resume: "استئناف الظهور", del: "حذف ملفي نهائياً", sure: "حذف الملف والتقييمات نهائياً؟ لا يمكن التراجع.",
      status: { pending: "بانتظار الموافقة", approved: "معتمد ومنشور", rejected: "مرفوض", suspended: "موقوف", paused: "متوقف بطلبك" },
      stNote: { pending: "تتم مراجعة ملفك يدوياً قبل ظهوره (عادةً خلال يوم أو يومين).", approved: "ملفك ظاهر للتجار. تعديل الاسم أو العنوان أو النبذة أو المعرض يعيده للمراجعة.", rejected: "رُفض ملفك.", suspended: "الملف موقوف من الإدارة.", paused: "ملفك مخفي حتى تستأنف الظهور." },
      adminNote: "ملاحظة الإدارة", stats: "تواصل معك", share: "رابط ملفي العام (للمشاركة)", copyLink: "نسخ الرابط", times: "مرّة", rating: "التقييم", keyTitle: "احتفظ بمفتاحك السرّي الآن!", keyWarn: "يظهر هذا المفتاح مرة واحدة فقط ولا نستطيع استرجاعه. به تدخل وتعدّل ملفك. إن ضاع تطلب إعادة تعيينه من الإدارة.", copy: "نسخ", dl: "تنزيل ملف", copied: "تم النسخ ✓", cont: "متابعة إلى ملفي", mid: "معرّف ملفك",
      saved: "تم الحفظ ✓", saved2: "تم الحفظ — الملف عاد للمراجعة لأنك عدّلت المحتوى.", busy: "جارٍ المعالجة…", imgErr: "تعذّر تجهيز الصورة", maxP: "الحد الأقصى 8 عناصر",
      err: { consent_required: "يجب الموافقة على الشروط.", bad_name: "أدخل اسماً وعنواناً صحيحين.", bad_headline: "العنوان قصير جداً.", bad_category: "اختر التخصص.", bad_whatsapp: "رقم واتساب غير صالح (مثال: 0555123456).", bad_rate: "التسعير غير صالح.", already_registered: "هذا الرقم مسجَّل مسبقاً — ادخل بمفتاحك.", rate_limited: "محاولات كثيرة، أعد المحاولة لاحقاً.", bad_key: "المعرّف أو المفتاح غير صحيح.", locked: "الملف مقفل من الإدارة.", too_large: "الحجم كبير جداً — قلّل الصور.", def: "تعذّر تنفيذ الطلب، حاول مجدداً." }
    },
    fr: {
      title: "Réseau d'Experts", sub: "Espace freelance", h1: "Rejoignez le Réseau d'Experts algérien", lead: "Votre profil est visible des e-commerçants qui cherchent un designer, un media buyer, une confirmatrice, un livreur ou un créateur UGC — ils vous contactent directement sur WhatsApp.",
      p1: "Inscription gratuite", p2: "Vous négociez le prix directement", p3: "Avis réels après contact", reg: "Créer mon profil", mine: "J'ai déjà un profil", id: "ID du profil", key: "Clé secrète", enter: "Entrer", out: "Quitter",
      name: "Nom (ou nom du studio)", headline: "Titre court (ex : designer packaging cosmétique)", cat: "Spécialité", bio: "Présentation et expérience", wilaya: "Wilaya", city: "Ville / commune", remote: "Je travaille à distance", wa: "Numéro WhatsApp (visible uniquement des boutiques inscrites)", rt: "Type de tarif", rf: "De (DA)", rto: "À (DA)", langs: "Langues",
      rts: { quote: "Sur devis", hourly: "Par heure", per_task: "Par mission", monthly: "Par mois", per_order: "Par commande" }, soc: "Vos réseaux (facultatif — https uniquement)", port: "Portfolio", portHint: "Jusqu'à 8 éléments : images compressées automatiquement, ou liens vers vos travaux (Behance, Drive…).", addImg: "＋ Ajouter des images", addLink: "＋ Ajouter un lien", title_: "Titre", linkT: "Lien https", consent: "J'accepte que mon profil et mon numéro WhatsApp soient montrés aux boutiques inscrites et que mes données soient stockées à cette fin ; l'accord et le paiement se font hors plateforme entre le marchand et moi. Je peux supprimer mon profil à tout moment.",
      save: "Enregistrer", send: "Envoyer pour validation", pause: "Masquer mon profil", resume: "Réafficher mon profil", del: "Supprimer définitivement", sure: "Supprimer le profil et les avis définitivement ?",
      status: { pending: "En attente de validation", approved: "Validé et publié", rejected: "Refusé", suspended: "Suspendu", paused: "Masqué par vous" },
      stNote: { pending: "Votre profil est relu manuellement avant publication (généralement 1 à 2 jours).", approved: "Votre profil est visible. Modifier nom, titre, présentation ou portfolio le renvoie en validation.", rejected: "Votre profil a été refusé.", suspended: "Profil suspendu par l'administration.", paused: "Votre profil est masqué jusqu'à réaffichage." },
      adminNote: "Note de l'administration", stats: "Contacts reçus", share: "Lien public de mon profil", copyLink: "Copier le lien", times: "fois", rating: "Note", keyTitle: "Conservez votre clé secrète maintenant !", keyWarn: "Cette clé n'est affichée qu'une fois et ne peut pas être récupérée. Elle sert à modifier votre profil. Perdue, demandez sa réinitialisation à l'administration.", copy: "Copier", dl: "Télécharger", copied: "Copié ✓", cont: "Accéder à mon profil", mid: "ID de votre profil",
      saved: "Enregistré ✓", saved2: "Enregistré — le profil repasse en validation car le contenu a changé.", busy: "Traitement…", imgErr: "Image illisible", maxP: "Maximum 8 éléments",
      err: { consent_required: "Vous devez accepter les conditions.", bad_name: "Nom ou titre invalide.", bad_headline: "Titre trop court.", bad_category: "Choisissez une spécialité.", bad_whatsapp: "Numéro WhatsApp invalide (ex : 0555123456).", bad_rate: "Tarif invalide.", already_registered: "Ce numéro est déjà inscrit — connectez-vous avec votre clé.", rate_limited: "Trop de tentatives, réessayez plus tard.", bad_key: "ID ou clé incorrect.", locked: "Profil verrouillé par l'administration.", too_large: "Trop volumineux — réduisez les images.", def: "Action impossible, réessayez." }
    }
  };
  const S = { lang: "ar", cats: [], me: null, view: "home", form: null, msg: null, busy: false, secret: null };
  try { const l = localStorage.getItem(LL); S.lang = l === "fr" ? "fr" : "ar"; } catch (e) { }
  const L = () => T[S.lang];
  const pubUrl = id => location.origin + location.pathname.replace(/experts\.html$/, "") + "expert.html?id=" + id;

  /* ── RPC ── */
  async function rpc(fn, p) {
    const r = await fetch((CFG.URL || "").replace(/\/+$/, "") + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: CFG.KEY, Authorization: "Bearer " + CFG.KEY, "Content-Type": "application/json" }, body: JSON.stringify(p === undefined ? {} : { p }) });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
    if (!r.ok) { const e = new Error((j && (j.message || j.hint)) || ("HTTP " + r.status)); e.code = j && j.code; throw e; }
    return j;
  }
  const errText = e => { const m = String((e && e.message) || e || ""), k = Object.keys(L().err).find(x => m.indexOf(x) >= 0); return L().err[k || "def"]; };

  /* ── ضغط الصور (Canvas): أبعاد ≤ max، جودة تتناقص حتى يدخل الحجم في الحد؛ webp ثم jpeg ── */
  function loadImg(file) {
    return new Promise((ok, no) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); ok(im); }; im.onerror = () => { URL.revokeObjectURL(u); no(new Error("img")); }; im.src = u; });
  }
  async function compress(file, maxDim, maxChars) {
    const im = await loadImg(file), k = Math.min(1, maxDim / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
    return shrink(cv, maxChars);
  }
  function shrink(cv, maxChars) {
    let best = "";
    for (const fmt of ["image/webp", "image/jpeg"]) {
      for (let q = .85; q >= .3; q -= .1) {
        const d = cv.toDataURL(fmt, q); if (d.indexOf("data:" + fmt) !== 0) break;       // المتصفح لا يدعم الصيغة
        best = d; if (d.length <= maxChars) return d;
      }
      if (best && cv.width > 400) {                                                          // لا تزال كبيرة: صغّر الأبعاد
        const c2 = document.createElement("canvas"); c2.width = Math.round(cv.width * .75); c2.height = Math.round(cv.height * .75); c2.getContext("2d").drawImage(cv, 0, 0, c2.width, c2.height); return shrink(c2, maxChars);
      }
    }
    if (best.length > maxChars) throw new Error("img");
    return best;
  }

  /* ── نموذج الملف ── */
  const blank = () => ({ name: "", headline: "", cat: "", bio: "", wilaya: "", city: "", remote: true, wa: "", rate_type: "quote", rate_from: "", rate_to: "", langs: ["ar"], socials: {}, portfolio: [], consent: false });
  function fromMe(m) {
    return { name: m.name || "", headline: m.headline || "", cat: m.cat || "", bio: m.bio || "", wilaya: m.wilaya == null ? "" : String(m.wilaya), city: m.city || "", remote: m.remote !== false, wa: m.whatsapp || "", rate_type: m.rate_type || "quote",
      rate_from: m.rate_from == null ? "" : String(m.rate_from), rate_to: m.rate_to == null ? "" : String(m.rate_to), langs: (m.langs && m.langs.length) ? m.langs.slice() : ["ar"], socials: Object.assign({}, m.socials || {}),
      portfolio: (m.portfolio || []).map(x => Object.assign({}, x)), consent: true, thumb: m.thumb || "" };
  }
  function toPayload(f, withConsent) {
    const o = { name: f.name.trim(), headline: f.headline.trim(), bio: f.bio.trim(), cat: f.cat, whatsapp: f.wa.trim(), wilaya: f.wilaya === "" ? null : +f.wilaya, city: f.city.trim(), remote: !!f.remote, rate_type: f.rate_type,
      rate_from: f.rate_type === "quote" || f.rate_from === "" ? null : +f.rate_from, rate_to: f.rate_type === "quote" || f.rate_to === "" ? null : +f.rate_to, cur: "DZD", langs: f.langs, socials: {}, portfolio: f.portfolio.slice(0, MAXP), thumb: f.thumb || "" };
    Object.keys(f.socials || {}).forEach(k => { const v = String(f.socials[k] || "").trim(); if (v) o.socials[k] = v; });
    if (withConsent) o.consent = f.consent ? "true" : "false";
    return o;
  }
  /* تحقق مسبق في المتصفح (الخادم يعيد التحقق دائماً) → رمز خطأ أو "" */
  function check(f, reg) {
    if (f.name.trim().length < 2) return "bad_name"; if (f.headline.trim().length < 4) return "bad_headline"; if (!f.cat) return "bad_category";
    if (!/^(\+?213|0)[5-7][0-9]{8}$/.test(f.wa.replace(/[\s.\-()]/g, ""))) return "bad_whatsapp";
    if (f.rate_type !== "quote" && f.rate_from !== "" && f.rate_to !== "" && +f.rate_to < +f.rate_from) return "bad_rate";
    if (reg && !f.consent) return "consent_required"; return "";
  }

  /* ── واجهة ── */
  const catOpts = sel => '<option value="">—</option>' + S.cats.map(c => '<option value="' + esc(c.slug) + '"' + (c.slug === sel ? " selected" : "") + ">" + esc(S.lang === "fr" ? c.fr : c.ar) + "</option>").join("");
  const wilOpts = sel => '<option value="">—</option>' + ((window.WILAYAS || []).filter(w => !w.par)).map(w => '<option value="' + w.id + '"' + (String(w.id) === String(sel) ? " selected" : "") + ">" + w.id + " — " + esc(w.name) + "</option>").join("");
  function head() {
    return '<div class="top"><div><b>' + esc(L().title) + "</b> <span class=mut>· " + esc(L().sub) + '</span></div><div class="tabs"><button data-lang="ar" class="' + (S.lang === "ar" ? "on" : "") + '">عربي</button><button data-lang="fr" class="' + (S.lang === "fr" ? "on" : "") + '">Français</button></div></div>';
  }
  const msgH = () => (S.msg ? '<div class="msg ' + (S.msg.k ? "k" : "e") + '" role="status">' + esc(S.msg.t) + "</div>" : "");
  function homeH() {
    return '<div class="card hero"><h1>' + esc(L().h1) + "</h1><p class=mut>" + esc(L().lead) + '</p><div class="perks"><span class=pill>✓ ' + esc(L().p1) + "</span><span class=pill>✓ " + esc(L().p2) + "</span><span class=pill>✓ " + esc(L().p3) +
      '</span></div><div class="row" style="justify-content:center;margin-top:1rem"><button class="btn" data-go="reg">' + esc(L().reg) + '</button><button class="btn g" data-go="login">' + esc(L().mine) + "</button></div></div>";
  }
  function loginH() {
    return '<div class="card"><h2>' + esc(L().mine) + "</h2>" + msgH() + "<label>" + esc(L().id) + '</label><input id="lg-id" dir="ltr" autocomplete="off"><label>' + esc(L().key) + '</label><input id="lg-key" dir="ltr" type="password" autocomplete="off"><div class="row" style="margin-top:.9rem"><button class="btn" data-a="login">' + esc(L().enter) + '</button><button class="btn g" data-go="home">←</button></div></div>';
  }
  function formH(reg) {
    const f = S.form, l = L();
    const soc = SOC.map(s => "<div><label>" + s[1] + '</label><input data-soc="' + s[0] + '" dir="ltr" placeholder="https://" value="' + esc(f.socials[s[0]] || "") + '"></div>').join("");
    const pf = f.portfolio.map((x, i) => x.t === "img" ? '<div class="it"><button class="x" data-a="rmp" data-i="' + i + '" aria-label="x">×</button><img src="' + esc(x.d) + '" alt=""><input data-pt="' + i + '" placeholder="' + esc(l.title_) + '" maxlength="80" value="' + esc(x.title || "") + '"></div>' : "").join("");
    const lk = f.portfolio.map((x, i) => x.t === "link" ? '<div class="lk"><input data-pu="' + i + '" dir="ltr" placeholder="' + esc(l.linkT) + '" value="' + esc(x.u || "") + '"><input data-pt="' + i + '" placeholder="' + esc(l.title_) + '" maxlength="80" value="' + esc(x.title || "") + '"><button class="btn r" style="padding:.3rem .8rem" data-a="rmp" data-i="' + i + '">×</button></div>' : "").join("");
    return '<div class="card" id="frm">' + msgH() + "<label>" + esc(l.name) + '</label><input data-f="name" maxlength="80" value="' + esc(f.name) + '"><label>' + esc(l.headline) + '</label><input data-f="headline" maxlength="120" value="' + esc(f.headline) + '"><label>' + esc(l.cat) + '</label><select data-f="cat">' + catOpts(f.cat) + "</select><label>" + esc(l.bio) + '</label><textarea data-f="bio" maxlength="1500">' + esc(f.bio) + '</textarea>' +
      '<div class="g2"><div><label>' + esc(l.wilaya) + '</label><select data-f="wilaya">' + wilOpts(f.wilaya) + '</select></div><div><label>' + esc(l.city) + '</label><input data-f="city" maxlength="60" value="' + esc(f.city) + '"></div></div>' +
      '<label class="chips"><span style="display:contents"><input type="checkbox" data-f="remote"' + (f.remote ? " checked" : "") + "> " + esc(l.remote) + "</span></label><label>" + esc(l.wa) + '</label><input data-f="wa" dir="ltr" inputmode="tel" placeholder="05XXXXXXXX" value="' + esc(f.wa) + '">' +
      '<div class="g3"><div><label>' + esc(l.rt) + '</label><select data-f="rate_type">' + Object.keys(l.rts).map(k => '<option value="' + k + '"' + (f.rate_type === k ? " selected" : "") + ">" + esc(l.rts[k]) + "</option>").join("") + '</select></div><div><label>' + esc(l.rf) + '</label><input data-f="rate_from" type="number" min="0" inputmode="numeric" value="' + esc(f.rate_from) + '"' + (f.rate_type === "quote" ? " disabled" : "") + '></div><div><label>' + esc(l.rto) + '</label><input data-f="rate_to" type="number" min="0" inputmode="numeric" value="' + esc(f.rate_to) + '"' + (f.rate_type === "quote" ? " disabled" : "") + "></div></div>" +
      "<label>" + esc(l.langs) + '</label><div class="chips">' + [["ar", "العربية"], ["fr", "Français"], ["en", "English"], ["kab", "Taqbaylit"]].map(x => '<label><input type="checkbox" data-lang2="' + x[0] + '"' + (f.langs.indexOf(x[0]) >= 0 ? " checked" : "") + "> " + x[1] + "</label>").join("") + "</div>" +
      "<h2>" + esc(l.soc) + '</h2><div class="g2">' + soc + "</div><h2>" + esc(l.port) + '</h2><p class="mut">' + esc(l.portHint) + '</p><div class="pf">' + pf + "</div>" + lk + '<div class="row" style="margin-top:.6rem"><button class="btn g" data-a="addimg">' + esc(l.addImg) + '</button><button class="btn g" data-a="addlink">' + esc(l.addLink) + '</button><input id="pf-file" type="file" accept="image/*" multiple hidden></div>' +
      (reg ? '<label class="chk"><input type="checkbox" data-f="consent"' + (f.consent ? " checked" : "") + "><span>" + esc(l.consent) + "</span></label>" : "") +
      '<div class="row" style="margin-top:1rem"><button class="btn" data-a="' + (reg ? "register" : "update") + '"' + (S.busy ? " disabled" : "") + ">" + esc(reg ? l.send : l.save) + "</button>" + (reg ? '<button class="btn g" data-go="home">←</button>' : "") + "</div></div>";
  }
  function keyH() {
    const l = L(), s = S.secret;
    return '<div class="card"><h2>' + esc(l.keyTitle) + '</h2><div class="msg e">' + esc(l.keyWarn) + "</div><label>" + esc(l.mid) + '</label><div class="key">' + esc(s.id) + "</div><label>" + esc(l.key) + '</label><div class="key" id="k-val">' + esc(s.key) + '</div><div class="row" style="margin-top:.9rem"><button class="btn o" data-a="copykey">' + esc(l.copy) + '</button><button class="btn g" data-a="dlkey">' + esc(l.dl) + '</button><button class="btn" data-a="keydone">' + esc(l.cont) + "</button></div></div>";
  }
  function meH() {
    const l = L(), m = S.me, st = m.status;
    const head = '<div class="card"><div class="row" style="justify-content:space-between"><div><b style="font-size:1.15rem">' + esc(m.name) + '</b><div class="mut">' + esc(m.headline) + '</div></div><span class="st ' + esc(st) + '">' + esc(l.status[st] || st) + '</span></div><p class="mut" style="margin-top:.6rem">' + esc(l.stNote[st] || "") + "</p>" +
      (m.note ? '<div class="msg e">' + esc(l.adminNote) + ": " + esc(m.note) + "</div>" : "") + '<div class="row mut"><span>' + esc(l.stats) + ": <b>" + (+m.contacts || 0) + "</b> " + esc(l.times) + "</span><span>· " + esc(l.rating) + ": <b>" + (m.count ? (+m.rating).toFixed(1) + " (" + m.count + ")" : "—") + '</b></span></div>' + (st === "approved" ? '<p class="mut" style="margin-top:.6rem">' + esc(l.share) + ': <span dir="ltr" style="user-select:all">' + esc(pubUrl(m.id)) + '</span> <button class="btn g" style="padding:.2rem .7rem" data-a="copylink">' + esc(l.copyLink) + "</button></p>" : "") + '<div class="row" style="margin-top:.6rem">' +
      (st === "approved" ? '<button class="btn o" data-a="pause">' + esc(l.pause) + "</button>" : st === "paused" ? '<button class="btn" data-a="resume">' + esc(l.resume) + "</button>" : "") + '<button class="btn r" data-a="del">' + esc(l.del) + '</button><button class="btn g" data-a="logout">' + esc(l.out) + "</button></div></div>";
    return head + (st === "suspended" || st === "rejected" ? "" : formH(false));
  }
  function view() {
    const root = $("exw"); let b;
    if (S.secret) b = keyH(); else if (S.view === "me" && S.me) b = meH(); else if (S.view === "reg") b = '<div class="card"><h1>' + esc(L().reg) + "</h1></div>" + formH(true); else if (S.view === "login") b = loginH(); else b = homeH();
    document.documentElement.lang = S.lang; document.documentElement.dir = S.lang === "ar" ? "rtl" : "ltr"; document.title = L().title + " — " + L().sub;
    const keep = document.activeElement && document.activeElement.dataset ? (document.activeElement.dataset.f || "") : "";
    root.innerHTML = head() + (S.view === "home" || S.view === "me" || S.secret ? msgH() : "") + b;
    if (keep) { const el = root.querySelector('[data-f="' + keep + '"]'); if (el && el.type !== "checkbox") { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { } } }
  }
  const say = (t, k) => { S.msg = t ? { t, k: !!k } : null; };

  /* ── إجراءات ── */
  const saveMe = () => { try { if (S.me) localStorage.setItem(LS, JSON.stringify({ id: S.me.id, key: S.me._key })); else localStorage.removeItem(LS); } catch (e) { } };
  async function enter(id, key) {
    const m = await rpc("expert_me", { id, key }); m._key = key; S.me = m; S.form = fromMe(m); S.view = "me"; saveMe();
  }
  async function act(a, el) {
    const l = L();
    try {
      if (a === "login") { const id = $("lg-id").value.trim(), key = $("lg-key").value.trim(); say(""); await enter(id, key); }
      else if (a === "register" || a === "update") {
        const reg = a === "register", c = check(S.form, reg); if (c) { say(l.err[c] || l.err.def); return view(); }
        S.busy = true; say(l.busy, true); view();
        if (reg) { const r = await rpc("expert_register", toPayload(S.form, true)); S.secret = { id: r.id, key: r.key }; S.me = null; S.view = "me"; say(""); try { localStorage.setItem(LS, JSON.stringify({ id: r.id, key: r.key })); } catch (e) { } }
        else { const p = toPayload(S.form, false); p.id = S.me.id; p.key = S.me._key; const r = await rpc("expert_update", p); await enter(S.me.id, S.me._key); say(r && r.reviewed_again ? l.saved2 : l.saved, true); }
      }
      else if (a === "pause" || a === "resume") { await rpc("expert_pause", { id: S.me.id, key: S.me._key, paused: a === "pause" ? "true" : "false" }); await enter(S.me.id, S.me._key); }
      else if (a === "del") { if (!confirm(l.sure)) return; await rpc("expert_delete", { id: S.me.id, key: S.me._key }); S.me = null; saveMe(); S.view = "home"; say(""); }
      else if (a === "logout") { S.me = null; saveMe(); S.view = "home"; say(""); }
      else if (a === "copykey") { try { await navigator.clipboard.writeText(S.secret.key); el.textContent = l.copied; } catch (e) { const r = document.createRange(); r.selectNodeContents($("k-val")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } return; }
      else if (a === "dlkey") { const b = new Blob(["Experts ID: " + S.secret.id + "\nKey: " + S.secret.key + "\n"], { type: "text/plain" }), u = URL.createObjectURL(b), x = document.createElement("a"); x.href = u; x.download = "expert-key.txt"; x.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); return; }
      else if (a === "keydone") { const s = S.secret; S.secret = null; await enter(s.id, s.key); }
      else if (a === "copylink") { try { await navigator.clipboard.writeText(pubUrl(S.me.id)); el.textContent = l.copied; } catch (e) { prompt("URL", pubUrl(S.me.id)); } return; }
      else if (a === "addimg") { $("pf-file").click(); return; }
      else if (a === "addlink") { if (S.form.portfolio.length >= MAXP) { say(l.maxP); return view(); } S.form.portfolio.push({ t: "link", u: "", title: "" }); }
      else if (a === "rmp") { S.form.portfolio.splice(+el.dataset.i, 1); S.form.thumb = S.form.portfolio.some(x => x.t === "img") ? S.form.thumb : ""; }
    } catch (e) { say(errText(e)); }
    S.busy = false; view();
  }
  async function addFiles(files) {
    const l = L(); say(l.busy, true); view();
    try {
      for (const f of Array.from(files)) {
        if (S.form.portfolio.length >= MAXP) { say(l.maxP); break; } if (!/^image\//.test(f.type)) continue;
        const d = await compress(f, 1200, IMG_MAX); S.form.portfolio.push({ t: "img", d, title: "" });
        if (!S.form.thumb) S.form.thumb = await compress(f, 320, THUMB_MAX);
      }
      if (S.msg && S.msg.k) say("");
    } catch (e) { say(l.imgErr); }
    view();
  }
  function bind() {
    const root = $("exw");
    root.addEventListener("click", e => {
      const t = e.target.closest("[data-a],[data-go],[data-lang]"); if (!t) return;
      if (t.dataset.lang) { S.lang = t.dataset.lang; try { localStorage.setItem(LL, S.lang); } catch (x) { } return view(); }
      if (t.dataset.go) { S.view = t.dataset.go; say(""); if (S.view === "reg" && !S.form) S.form = blank(); if (S.view === "reg") S.form = blank(); return view(); }
      act(t.dataset.a, t);
    });
    root.addEventListener("input", e => {
      const t = e.target, f = S.form; if (!f) return;
      if (t.dataset.f && t.type !== "checkbox") f[t.dataset.f] = t.value;
      else if (t.dataset.soc) f.socials[t.dataset.soc] = t.value;
      else if (t.dataset.pt != null) f.portfolio[+t.dataset.pt].title = t.value;
      else if (t.dataset.pu != null) f.portfolio[+t.dataset.pu].u = t.value;
    });
    root.addEventListener("change", e => {
      const t = e.target, f = S.form;
      if (t.id === "pf-file") { addFiles(t.files); t.value = ""; return; }
      if (!f) return;
      if (t.dataset.f === "remote" || t.dataset.f === "consent") f[t.dataset.f === "remote" ? "remote" : "consent"] = t.checked;
      else if (t.dataset.f === "rate_type") { f.rate_type = t.value; view(); }
      else if (t.dataset.f) f[t.dataset.f] = t.value;
      else if (t.dataset.lang2) { const k = t.dataset.lang2, i = f.langs.indexOf(k); if (t.checked && i < 0) f.langs.push(k); else if (!t.checked && i >= 0) f.langs.splice(i, 1); if (!f.langs.length) f.langs = ["ar"]; }
    });
  }
  async function init() {
    bind(); view();
    try { S.cats = (await rpc("experts_categories")) || []; } catch (e) { S.cats = []; }
    try { const o = JSON.parse(localStorage.getItem(LS) || "null"); if (o && o.id && o.key) await enter(o.id, o.key); } catch (e) { S.me = null; }
    view();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { S, view, _t: { check, toPayload, fromMe, blank, compress, shrink, errText } };
})();
