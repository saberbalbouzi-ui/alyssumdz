/* الأوامر الصوتية للوحة التحكم (عربية فصحى + دارجة جزائرية + فرنسية) — بلا خدمة خارجية ولا مفتاح.
   الاستماع: SpeechRecognition في المتصفح (Chrome/Edge). الفهم: قواعد محلية (parse) نقية قابلة للاختبار؛ التنفيذ: استدعاء دوال اللوحة نفسها.
   المرحلة 1: تنقّل، بحث وتصفية الطلبات، أسئلة أرقام (طلبات/مبيعات/مخزون)، منتج جديد، تعديل منتج بالاسم، تبديل المظهر، تحديث اللوحة، أسئلة «اسألني».
   أي أمر يغيّر بيانات يمرّ بتأكيد (نعم/لا أو زر). الميكروفون داخل أيقونة «اسألني»: أصفر = متوقف (ردود كتابية)، أخضر = يعمل (استماع بكلمة النداء «hi + اسم المتجر» + ردود صوتية).
   أمر جديد = أضف قاعدة في parse() واسطراً في HELP_TXT، ثم اختبرها في scripts/test-voice.js. */
const AdminVoice = (() => {
  /* ── تطبيع: حروف صغيرة، بلا لهجات/تشكيل، توحيد الألف والتاء المربوطة والياء، أرقام لاتينية ── */
  const fold = s => String(s == null ? "" : s).toLowerCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "").replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  const norm = s => fold(s).replace(/[^a-z0-9ء-ي]+/g, " ").replace(/\s+/g, " ").trim();
  /* كلمة كاملة مع سوابق عربية اختيارية (و/ب/ل/ف + ال) */
  const re = list => new RegExp("(?:^| )(?:[وبلفك]?(?:ال)?|لل)(?:" + [...new Set(list.flatMap(x => { const f = fold(x); return f.startsWith("ال") && f.length > 4 ? [f, f.slice(2)] : [f]; }))].join("|") + ")(?= |$)");
  const has = (rx, t) => rx.test(t);

  /* ── مفردات (فصحى + دارجة جزائرية + فرنسية) ── */
  /* مفردات الأساس (احتياط)؛ قاموس assets/data/voice-lexicon.json يضيف عليها عبر useLexicon() */
  const BASE = {"V_OPEN": ["افتح", "فتح", "افتحلي", "حل", "حلي", "حللي", "اذهب", "اذهبي", "روح", "رح", "خذني", "وريني", "ورني", "ورلي", "وريلي", "وري", "اعرض", "اعرضلي", "عرض", "شوف", "شوفلي", "انتقل", "جيبلي", "جيب", "ouvre", "ouvrir", "ouvres", "va", "aller", "montre", "montrer", "affiche", "afficher", "voir", "open", "show", "go"], "V_ADD": ["add", "ajoute", "ajouter", "create", "cree", "creer", "importer", "insere", "inserer", "new", "nouveau", "nouvelle", "rajoute", "اصنع", "اضافه", "اضف", "اعمل", "انشئ", "حط", "حطلو", "حطلي", "دير", "ديرلي", "زيد", "زيدلي", "سوي", "ضيف", "ضيفلو", "ضيفلي", "نزيد", "نزيدلو", "نضيف"], "V_EDIT": ["عدل", "عدلي", "تعديل", "غير", "modifie", "modifier", "edit", "editer"], "V_CHANGE": ["غير", "بدل", "بدلي", "تبديل", "حول", "change", "changer", "passe", "passer", "bascule", "basculer", "mets", "met", "switch", "toggle"], "V_SEARCH": ["ابحث", "ابحثلي", "دور", "دورلي", "لوج", "لوجلي", "فتش", "cherche", "chercher", "recherche", "rechercher", "trouve", "trouver", "find", "search"], "V_UPDATE": ["حدث", "حدثي", "update", "actualise", "actualiser", "rafraichis", "mise a jour", "رفرش", "refresh"], "W_PRODUCTS": ["منتجات", "produits", "products"], "W_PRODUCT": ["article", "product", "produit", "برودوي", "برودي", "بروديه", "بروديي", "سلعا", "سلعه", "منتج", "منتجا", "منتجي", "منتوج", "منتوجا", "منتوجي"], "W_ORDER": ["طلب", "طلبات", "طلبيه", "طلبيات", "كوموند", "كوموندات", "كوموندا", "commande", "commandes", "order", "orders"], "W_CLIENT": ["زبون", "عميل", "client", "customer"], "W_STOCK": ["مخزون", "ستوك", "stock", "كميه", "كميات"], "COUNT_Q": ["كم", "كام", "قداش", "قديش", "شحال", "combien", "how many", "how much"], "WHAT_Q": ["ما", "ماهي", "ماهو", "واش", "شنو", "what", "quel", "quelle", "quels", "quelles", "c est quoi"], "W_REV": ["مبيعات", "مبيعاتي", "بيع", "بعت", "بعنا", "مداخيل", "مدخول", "دخل", "ايرادات", "ايراد", "ربح", "ارباح", "chiffre d affaires", "ventes", "vente", "revenu", "revenus", "sales", "revenue"], "W_LAST": ["اخر", "اخير", "اخرها", "dernier", "derniere", "last", "latest"], "P_TODAY": ["اليوم", "ليوم", "هاد اليوم", "aujourd hui", "today"], "P_YEST": ["امس", "البارح", "البارحه", "hier", "yesterday"], "P_WEEK": ["الاسبوع", "اسبوع", "semaine", "week", "7 ايام", "سبعه ايام"], "P_MONTH": ["الشهر", "شهر", "mois", "month", "30 يوم"], "S_OUT": ["نفد", "نفدت", "نفذ", "نفذت", "خلص", "خلصت", "سالا", "سالات", "ساليا", "سال", "منتهي", "انتهت", "انتهى", "rupture", "epuise", "epuisee", "epuises", "out of stock", "نقص"], "S_LOW": ["ناقص", "ناقصه", "منخفض", "منخفضه", "قليل", "قليله", "bas", "basse", "low", "يخلصو", "يخلص", "راهم يخلصو", "يوفي", "يوفى", "ينفد", "ينفذ", "bientot epuise"], "W_THEME": ["المظهر", "مظهر", "الوضع", "وضع", "ثيم", "theme", "mode", "dark", "sombre", "clair", "light", "الضو"], "T_DARK": ["داكن", "ليلي", "الليل", "ليل", "sombre", "dark", "noir", "اسود"], "T_LIGHT": ["فاتح", "نهاري", "النهار", "نهار", "clair", "light", "blanc", "ابيض"], "W_PANEL": ["اللوحه", "لوحه", "النسخه", "نسخه", "التحديث", "تحديث", "الصفحه", "page", "tableau", "panneau", "version", "panel"], "W_SITE": ["الموقع", "موقعي", "المتجر", "متجري", "site", "boutique", "magasin", "storefront"], "Q_START": ["كيف", "كيفاش", "كيفاه", "وين", "فين", "ماذا", "شنو", "واش", "لماذا", "علاش", "ليش", "اشرح", "اشرحلي", "علمني", "فسر", "comment", "pourquoi", "explique", "expliquer", "how", "what", "why", "c est quoi", "qu est ce que", "ou est", "ou se trouve"], "HELP": ["اوامر", "الاوامر", "ماذا اقول", "ما اقول", "واش نقول", "شنو نقول", "شنو نقدر", "واش نقدر", "مساعده", "aide", "aidez moi", "help", "commandes vocales", "que puis je dire", "que dire"], "STOP": ["الغاء", "الغي", "الغيه", "توقف", "وقف", "بطل", "خلاص", "annule", "annuler", "stop", "arrete", "tais toi", "cancel", "laisse tomber"], "YES": ["نعم", "ايوه", "ايه", "اي", "واه", "اكيد", "تمام", "موافق", "نفذ", "نفذها", "oui", "ok", "okay", "d accord", "yes", "confirme", "vas y", "ouais", "wah"], "NO": ["لا", "لأ", "non", "no", "ماشي", "annule", "الغاء"], "V_INC": ["زيد", "زيدلي", "زيدلو", "زيدها", "ضيف", "ضيفلي", "ضيفلو", "اضف", "ارفع", "ارفعلي", "كبر", "نزيد", "نضيف", "augmente", "augmenter", "ajoute", "ajouter", "rajoute", "rajouter", "monte", "majore", "increase", "add", "plus"], "V_DEC": ["نقص", "نقصلي", "نقصه", "نقصها", "نقصلو", "انقص", "نحي شويه", "حيد شويه", "هبط", "هبطلي", "قلل", "قللي", "baisse", "baisser", "diminue", "diminuer", "reduis", "reduire", "enleve un peu", "decrease", "lower", "moins"], "V_SET": ["خلي", "خليه", "خليها", "خلي", "ديرها", "ديرله", "ضع", "اجعل", "اجعله", "حط", "حطه", "حطها", "بدل", "بدلها", "بدله", "غير", "غيرها", "غيره", "عدل", "صحح", "fixe", "fixer", "definis", "definir", "mets", "mettre", "modifie", "modifier", "change", "changer", "passe", "set"], "V_HIDE": ["خبي", "خبيه", "خبيها", "اخف", "اخفي", "اخفه", "cache", "cacher", "masque", "masquer", "desactive", "desactiver", "hide", "عطل", "طفي", "طفيه"], "V_SHOWON": ["رجع", "رجعه", "رجعلي", "ارجع", "اظهر", "اظهره", "فعل", "فعله", "شغل", "شغله", "reactive", "reactiver", "active", "activer", "remets", "remettre", "republie", "republier"], "V_DEL": ["نحي", "نحيه", "نحيها", "نحيهالي", "نحيلي", "حيد", "حيده", "حيدها", "امسح", "امسحه", "امسحها", "احذف", "احذفه", "احذفها", "فسخ", "فسخه", "ارمي", "supprime", "supprimer", "efface", "effacer", "enleve", "enlever", "retire", "retirer", "delete", "remove"], "W_DISC": ["تخفيض", "تخفيضات", "خصم", "remise", "reduction", "promo", "promotion", "soldes", "solde", "discount", "ريدوكسيون", "بروموسيون"], "W_PRICE": ["سعر", "اسعار", "ثمن", "prix", "price", "tarif"], "W_PIECE": ["حبه", "حبات", "وحده", "وحدات", "قطعه", "قطع", "piece", "pieces", "pcs", "unite", "unites", "units", "unit"], "U_PCT": ["بالميه", "بالمايه", "بالمائه", "بالمئه", "في الميه", "في المايه", "فالميه", "pourcent", "pour cent", "pourcentage", "percent", "pct"], "U_CUR": ["دينار", "دنانير", "دج", "دينارا", "da", "dzd", "dinar", "dinars"], "W_THIS": ["هذا", "هذه", "هذي", "هاذا", "هاذي", "هاذ", "هذاك", "هذوك", "هادا", "هادي", "هاد", "ce", "cet", "cette", "celui ci", "celle ci", "ceci", "cela", "this", "نفسه", "نفس المنتوج"], "W_VAGUE": ["بزاف", "برشه", "كثير", "كثيره", "شويه", "شوي", "قليل", "ضاعف", "نصف", "نصفه", "double"], "W_ALLP": ["كامل", "كاملين", "قاع", "كلشي", "كل", "الكل", "جميع", "كل منتج", "tous", "toutes", "tout", "all"], "W_NEWW": ["جديد", "جديده", "اخر", "اخرى", "ثاني", "ثانيه", "nouveau", "nouvelle", "autre", "another", "new"], "W_SHOPW": ["بوتيك", "البوتيك", "متجر", "المتجر", "boutique", "magasin", "shop", "store", "الواجهه", "الموقع"], "REMAIN": ["بقالنا", "بقى", "بقي", "باقي", "باقيه", "بقات", "reste", "restant", "restants", "rest"]};
  let COUNT_Q, HELP, NO, P_MONTH, P_TODAY, P_WEEK, P_YEST, Q_START, REMAIN, STOP, S_LOW, S_OUT, T_DARK, T_LIGHT, U_CUR, U_PCT, V_ADD, V_CHANGE, V_DEC, V_DEL, V_EDIT, V_HIDE, V_INC, V_OPEN, V_SEARCH, V_SET, V_SHOWON, V_UPDATE, WHAT_Q, W_ALLP, W_CLIENT, W_DISC, W_LAST, W_NEWW, W_ORDER, W_PANEL, W_PIECE, W_PRICE, W_PRODUCT, W_PRODUCTS, W_REV, W_SHOPW, W_SITE, W_STOCK, W_THEME, W_THIS, W_VAGUE, YES;
  function buildRx(extra) {
    const W = k => (BASE[k] || []).concat((extra && extra[k]) || []);
    COUNT_Q = re(W("COUNT_Q"));
    HELP = re(W("HELP"));
    NO = re(W("NO"));
    P_MONTH = re(W("P_MONTH"));
    P_TODAY = re(W("P_TODAY"));
    P_WEEK = re(W("P_WEEK"));
    P_YEST = re(W("P_YEST"));
    Q_START = re(W("Q_START"));
    REMAIN = re(W("REMAIN"));
    STOP = re(W("STOP"));
    S_LOW = re(W("S_LOW"));
    S_OUT = re(W("S_OUT"));
    T_DARK = re(W("T_DARK"));
    T_LIGHT = re(W("T_LIGHT"));
    U_CUR = re(W("U_CUR"));
    U_PCT = re(W("U_PCT"));
    V_ADD = re(W("V_ADD"));
    V_CHANGE = re(W("V_CHANGE"));
    V_DEC = re(W("V_DEC"));
    V_DEL = re(W("V_DEL"));
    V_EDIT = re(W("V_EDIT"));
    V_HIDE = re(W("V_HIDE"));
    V_INC = re(W("V_INC"));
    V_OPEN = re(W("V_OPEN"));
    V_SEARCH = re(W("V_SEARCH"));
    V_SET = re(W("V_SET"));
    V_SHOWON = re(W("V_SHOWON"));
    V_UPDATE = re(W("V_UPDATE"));
    WHAT_Q = re(W("WHAT_Q"));
    W_ALLP = re(W("W_ALLP"));
    W_CLIENT = re(W("W_CLIENT"));
    W_DISC = re(W("W_DISC"));
    W_LAST = re(W("W_LAST"));
    W_NEWW = re(W("W_NEWW"));
    W_ORDER = re(W("W_ORDER"));
    W_PANEL = re(W("W_PANEL"));
    W_PIECE = re(W("W_PIECE"));
    W_PRICE = re(W("W_PRICE"));
    W_PRODUCT = re(W("W_PRODUCT"));
    W_PRODUCTS = re(W("W_PRODUCTS"));
    W_REV = re(W("W_REV"));
    W_SHOPW = re(W("W_SHOPW"));
    W_SITE = re(W("W_SITE"));
    W_STOCK = re(W("W_STOCK"));
    W_THEME = re(W("W_THEME"));
    W_THIS = re(W("W_THIS"));
    W_VAGUE = re(W("W_VAGUE"));
    YES = re(W("YES"));
  }
  buildRx(null);

  /* دمج قاموس JSON (assets/data/voice-lexicon.json) مع المفردات الأساسية */
  const LEXMAP = { "verbs.add": "V_ADD", "verbs.increase": "V_INC", "verbs.decrease": "V_DEC", "verbs.set": "V_SET", "verbs.hide": "V_HIDE", "verbs.show": "V_SHOWON", "verbs.delete": "V_DEL", "verbs.open": "V_OPEN", "verbs.search": "V_SEARCH", "verbs.edit": "V_EDIT", "verbs.update": "V_UPDATE",
    "objects.product": "W_PRODUCT", "objects.products": "W_PRODUCTS", "objects.order": "W_ORDER", "objects.customer": "W_CLIENT", "objects.stock": "W_STOCK", "objects.price": "W_PRICE", "objects.discount": "W_DISC", "objects.shop": "W_SHOPW",
    "units.piece": "W_PIECE", "units.percent": "U_PCT", "units.currency": "U_CUR", "pointers.this": "W_THIS", "quantity.vague": "W_VAGUE", "quantity.all": "W_ALLP", "modifiers.new": "W_NEWW", "confirm.yes": "YES", "control.stop": "STOP", "control.help": "HELP" };
  function useLexicon(lex) {
    if (!lex) return; const extra = {};
    Object.keys(LEXMAP).forEach(path => { const [a, b] = path.split("."), w = lex[a] && lex[a][b] && lex[a][b].words; if (Array.isArray(w)) extra[LEXMAP[path]] = w.filter(x => typeof x === "string" && x.trim()); });
    buildRx(extra);
  }
  const ASK_ME = /^(?:ي?ا?سالني|اسالني|demande moi|ask me)\s+(.+)/;
  const GENERIC = new Set("اداه ادوات قسم اقسام تبويب onglet section outil outils فضلك".split(" "));
  const FILL = new Set(("عن على علي في من الى ال لي لك انا اريد اريدك ابغي نحب نبغي بغيت لو سمحت ممكن يمكن يا هاي هاد هذا هذه هده تاع ديال دي ب الى بين مع و ثم ثم ان او اه " +
    "le la les un une des de du d l pour sur en et a au aux je veux voudrais s il te plait svp moi mes mon ma ce cette").split(" ").map(fold));

  /* ── التبويبات: المعرّف ← عبارات (الأطول يُقدَّم) ── */
  const TABS = {
    home: ["لوحه التحكم", "الصفحه الرئيسيه للوحه", "الرئيسيه", "نظره عامه", "accueil", "dashboard", "tableau de bord"],
    orders: ["الطلبات", "طلبات", "طلبيات", "طلبيه", "كوموند", "كوموندات", "commandes", "commande", "orders"],
    shipped: ["الطلبات المسجله", "المسجله", "الطلبات المشحونه", "المشحونه", "الطرود", "طرود", "colis", "commandes expediees", "expedies"],
    repeat: ["اعاده الشراء", "relance", "racheter"],
    setup: ["تجهيز المتجر", "تجهيز"],
    finance: ["المخزون والارباح", "الارباح", "ارباح", "benefice", "benefices", "finance", "profit"],
    analytics: ["التحليلات", "تحليلات", "احصائيات", "احصاءات", "ستاتيستيك", "statistiques", "analytics", "stats", "زيارات"],
    products: ["المنتجات", "منتجات", "سلع", "بضاعه", "produits", "products"],
    social: ["السوشيال", "سوشيال", "الاعلانات", "فيسبوك", "انستغرام", "reseaux sociaux", "social", "publications"],
    inventory: ["المخزون", "مخزون", "ستوك", "stock", "inventaire", "الجرد", "جرد"],
    bulkp: ["تعديل جماعي", "تعديل المنتجات جماعيا", "modification en masse", "edition groupee"],
    reports: ["التقارير", "تقارير", "rapports", "reports"],
    audit: ["فحص المنتجات", "audit des produits"],
    returns: ["المرتجعات", "مرتجعات", "ريتور", "retours", "retour", "استرجاع"],
    payments: ["المدفوعات", "مدفوعات", "paiements", "paiement", "payments"],
    seo: ["seo", "سيو", "سي او"],
    blog: ["المدونه", "مدونه", "السياسات", "blog"],
    builder: ["مطور الصفحات", "محرر الصفحات", "page builder", "editeur de pages", "constructeur de pages"],
    smart: ["المطور الذكي", "صفحه هبوط ذكيه"],
    voice: ["الوكيل الناطق", "وكيل ناطق", "agent vocal", "avatar"],
    ask: ["اسالني", "مساعد اللوحه", "assistant du panneau"],
    cloner: ["ناسخ القوالب", "نسخ قالب", "نسخ موقع", "cloneur", "cloner un site"],
    floaters: ["الايقونات العائمه", "ايقونات عائمه", "واتساب العائم", "icones flottantes"],
    imgtools: ["ادوات الصور", "ادوات تعديل الصور", "تعديل الصور", "outils images", "outils d image"],
    imggen: ["مولد الصور", "توليد الصور", "generateur d images", "generateur"],
    agent: ["الوكيل الذكي", "agent intelligent"],
    attributes: ["السمات", "سمات", "attributs"],
    categories: ["التصنيفات", "تصنيفات", "categories"],
    fees: ["رسوم التوصيل", "اسعار التوصيل", "تعريفه التوصيل", "frais de livraison", "tarifs de livraison", "frais", "فرايس"],
    delivery: ["شركات التوصيل", "livreurs", "transporteurs", "ياليدين", "yalidine", "zr express"],
    coupons: ["اكواد الخصم", "الخصم", "كوبون", "الكوبونات", "كوبونات", "اكواد", "coupons", "coupon", "code promo", "promo", "reduction", "تخفيض"],
    blacklist: ["القائمه السوداء", "السوداء", "liste noire", "blacklist", "بلاك ليست"],
    loyalty: ["الزبائن الاوفياء", "الاوفياء", "الولاء", "fidelite", "loyalty"],
    customers: ["العملاء", "عملاء", "الزبائن", "زبائن", "كليون", "الكليان", "clients", "customers"],
    admtheme: ["مظهر لوحه التحكم", "مظهر اللوحه", "ثيم اللوحه"],
    theme: ["مظهر الموقع", "ثيم الموقع", "apparence du site", "apparence"],
    chromeh: ["الهيدر", "header", "en tete"],
    chromef: ["الفوتر", "footer", "pied de page"],
    checkout: ["نموذج الطلب", "formulaire de commande", "فورم الطلب"],
    pixels: ["البكسلات", "البكسل", "pixels", "pixel"],
    store: ["اعدادات الموقع", "اعدادات المتجر", "parametres du site", "site settings"],
    pending: ["بانتظار التاكيد", "تعديلات معلقه"],
  };
  const TAB_RX = [];
  Object.keys(TABS).forEach(id => TABS[id].forEach(p => { const f = fold(p); TAB_RX.push({ id, len: f.length, rx: re([p]) }); }));
  TAB_RX.sort((a, b) => b.len - a.len);
  const TAB_LABEL = { home: "لوحة التحكم", orders: "الطلبات", shipped: "الطلبات المسجلة", repeat: "إعادة الشراء", setup: "تجهيز المتجر", finance: "المخزون والأرباح", analytics: "التحليلات", products: "المنتجات", social: "السوشيال والإعلانات", inventory: "المخزون", bulkp: "التعديل الجماعي", reports: "التقارير", audit: "فحص المنتجات", returns: "المرتجعات", payments: "المدفوعات", seo: "SEO", blog: "المدوّنة والسياسات", builder: "مطوّر الصفحات", smart: "المطوّر الذكي", voice: "الوكيل الناطق", ask: "اسألني", cloner: "ناسخ القوالب", floaters: "الأيقونات العائمة", imgtools: "أدوات الصور", imggen: "مولّد الصور", agent: "الوكيل الذكي", attributes: "السمات", categories: "التصنيفات", fees: "رسوم التوصيل", delivery: "شركات التوصيل", coupons: "أكواد الخصم", blacklist: "القائمة السوداء", loyalty: "الزبائن الأوفياء", customers: "العملاء", admtheme: "مظهر لوحة التحكم", theme: "مظهر الموقع", chromeh: "الهيدر", chromef: "الفوتر", checkout: "نموذج الطلب", pixels: "البكسلات", store: "إعدادات الموقع", pending: "بانتظار التأكيد" };

  /* حالات الطلب (القيم كما في مرشّح الطلبات) */
  const STATUS = [
    ["nouvelle", "في انتظار التأكيد", re(["جديد", "جديده", "جدد", "جداد", "انتظار", "نوفال", "nouvelle", "nouvelles", "nouveau", "nouveaux", "new", "pending", "بانتظار", "غير مؤكد", "غير مؤكده"])],
    ["confirmee", "المؤكَّدة", re(["موكد", "موكده", "ماكد", "ماكده", "confirme", "confirmee", "confirmees", "confirmed"])],
    ["annulee", "الملغاة", re(["ملغي", "ملغيه", "ملغاه", "ملغاة", "ملغات", "الغيت", "annule", "annulee", "annulees", "cancelled", "canceled"])],
    ["livree", "المسلَّمة", re(["مسلم", "مسلمه", "تم التسليم", "سلمت", "وصلت", "livre", "livree", "livrees", "delivered"])],
    ["expediee", "في الطريق", re(["في الطريق", "مشحون", "مشحونه", "مرسل", "مرسله", "expedie", "expediee", "shipped", "en route"])],
    ["echec", "فشل التوصيل", re(["فشل", "فاشل", "فاشله", "echec", "echoue", "failed"])],
  ];
  const statusOf = t => { for (const s of STATUS) if (has(s[2], t)) return s; return null; };
  const periodOf = t => has(P_TODAY, t) ? "today" : has(P_YEST, t) ? "yesterday" : has(P_WEEK, t) ? "week" : has(P_MONTH, t) ? "month" : "";
  const PERIOD_AR = { today: "اليوم", yesterday: "أمس", week: "آخر 7 أيام", month: "آخر 30 يوماً", "": "الإجمالي" };
  const PERIOD_FR = { today: "aujourd'hui", yesterday: "hier", week: "7 derniers jours", month: "30 derniers jours", "": "au total" };

  /* أرقام منطوقة (صفر..تسعة) ← أرقام، لأرقام الهاتف */
  const DIGITS = { صفر: 0, zero: 0, واحد: 1, وحده: 1, un: 1, one: 1, اثنان: 2, اثنين: 2, زوج: 2, ثنين: 2, deux: 2, two: 2, ثلاثه: 3, تلاته: 3, ثلاث: 3, trois: 3, three: 3, اربعه: 4, اربع: 4, ربعه: 4, quatre: 4, four: 4, خمسه: 5, خمس: 5, cinq: 5, five: 5, سته: 6, ست: 6, six: 6, سبعه: 7, سبع: 7, sept: 7, seven: 7, ثمانيه: 8, تمنيه: 8, ثمان: 8, huit: 8, eight: 8, تسعه: 9, تسع: 9, neuf: 9, nine: 9 };
  const spokenDigits = t => t.split(" ").map(w => (w in DIGITS ? String(DIGITS[w]) : (DIGITS[fold(w)] != null ? String(DIGITS[fold(w)]) : w))).join(" ");
  const phoneOf = t => { const m = spokenDigits(t).replace(/(\d)\s+(?=\d)/g, "$1").match(/\d{6,}/); return m ? m[0] : ""; };

  const fmtN = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const tokens = t => t.split(" ").filter(w => w && !FILL.has(w));
  const stripAl = w => w.replace(/^(?:وال|بال|لل|ال)/, "");

  /* مطابقة تقريبية لاسم منتج: نسبة كلمات الاستعلام الموجودة في العنوان (بادئة ≥3 أحرف) */
  function matchProduct(q, products) {
    const qs = tokens(q).map(stripAl).filter(w => w.length > 1); if (!qs.length) return null;
    let best = null;
    (products || []).forEach(p => {
      const ts = tokens(norm(p.title + " " + (p.slug || ""))).map(stripAl);
      let hit = 0;
      qs.forEach(w => { const forms = /^[لبوف]/.test(w) && w.length > 3 ? [w, w.slice(1)] : [w]; if (forms.some(f => ts.some(x => x === f || (f.length >= 3 && x.length >= 3 && (x.startsWith(f) || f.startsWith(x)))))) hit++; });
      const sc = hit / qs.length + (hit ? 0.001 * hit : 0);
      if (hit && (!best || sc > best.sc)) best = { p, sc };
    });
    return best && best.sc >= 0.6 ? best.p : null;
  }


  /* ── فهرس الكلمات المفتاحية: كل أداة/إعداد (بطاقات القائمة + قاعدة «اسألني») ── */
  const isVerb = w => [V_OPEN, V_EDIT, V_CHANGE, V_ADD].some(r => r.test(" " + w + " "));
  const contentTokens = t => tokens(t).filter(w => !isVerb(w) && !GENERIC.has(w)).map(stripAl).filter(w => w.length > 1);
  const tk = s => tokens(norm(s)).map(stripAl).filter(w => w.length > 1);
  function candList(data) {
    const out = [], nav = data.nav && data.nav.length ? data.nav : Object.keys(TAB_LABEL).map(id => ({ id, label: TAB_LABEL[id], desc: "" }));
    nav.forEach((n, i) => out.push({ kind: "tab", id: n.id, label: n.label, t: tk(n.label), k: tk((TABS[n.id] || []).join(" ") + " " + (n.desc || "")), syn: (TABS[n.id] || []).map(s => tk(s).join(" ")), pri: i }));
    (data.kb || []).forEach((e, i) => { if (e && e.t) out.push({ kind: "kb", id: e.id, label: e.t, go: e.go || "", ans: e.a || "", t: tk(e.t), k: tk(e.k || ""), pri: 1000 + i }); });
    return out;
  }
  function findCands(ct, data) {
    const eq = (a, b) => a === b, pre = (a, b) => a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)), res = [];
    candList(data).forEach(c => {
      let sc = 0;
      if (c.syn && c.syn.includes(ct.join(" "))) sc = 3 * ct.length;     /* مرادف مطابق تماماً لعبارة المستخدم */
      else for (const q of ct) {
        const s = c.t.some(x => eq(x, q)) ? 3 : c.t.some(x => pre(x, q)) ? 2 : c.k.some(x => eq(x, q)) ? 1.5 : c.k.some(x => pre(x, q)) ? 1 : 0;
        if (!s) { sc = -1; break; } sc += s;
      }
      if (sc > 0) res.push({ c, sc: sc + (c.kind === "tab" ? 0.5 : 0) });
    });
    res.sort((a, b) => b.sc - a.sc || a.c.pri - b.c.pri);
    if (!res.length) return [];
    const keep = res.filter(r => r.sc >= res[0].sc * 0.9), tabsIn = new Set(keep.filter(r => r.c.kind === "tab").map(r => r.c.id));
    return keep.filter(r => !(r.c.kind === "kb" && r.c.go && tabsIn.has(r.c.go))).map(r => r.c);
  }
  const optOf = c => ({ label: c.label, act: c.kind === "tab" ? { type: "nav", tab: c.id } : { type: "kb", go: c.go, id: c.id, label: c.label, ans: c.ans } });
  function choose(cands, word, L) {
    const opts = cands.slice(0, 5).map(optOf), more = cands.length > 5;
    if (opts.length === 1) return { kind: "choose", options: opts, single: true, say: L("تقصد «" + opts[0].label + "»؟", "Vous voulez dire « " + opts[0].label + " » ?") };
    return { kind: "choose", options: opts, say: L("كلمة «" + word + "» تخص عدة أدوات: " + opts.map((o, i) => (i + 1) + "- " + o.label).join("، ") + (more ? " وغيرها" : "") + ". أيها تقصد؟", "« " + word + " » concerne plusieurs outils : " + opts.map((o, i) => (i + 1) + "- " + o.label).join(", ") + ". Lequel ?") };
  }
  const ORD = [["1", "الاول", "اول", "الاولي", "الاول", "premier", "premiere", "first", "واحد", "وحده"], ["2", "الثاني", "ثاني", "الثانيه", "deuxieme", "second", "اثنين", "ثنين", "زوج"], ["3", "الثالث", "ثالث", "الثالثه", "troisieme", "third", "ثلاثه", "تلاته"], ["4", "الرابع", "رابع", "الرابعه", "quatrieme", "fourth", "اربعه", "ربعه"], ["5", "الخامس", "خامس", "الخامسه", "cinquieme", "fifth", "خمسه"]];
  /* اختيار خيار من كلام المستخدم: رقم ترتيبي، أو اسم الأداة، أو «نعم» = الأول؛ null = لم يُفهم؛ -1 = إلغاء */
  function pickOption(options, text) {
    const t = norm(text), ws = t.split(" ").filter(Boolean);
    if (!t) return null;
    if (has(NO, t) || has(STOP, t)) return -1;
    for (let i = 0; i < options.length && i < ORD.length; i++) if (ws.some(w => ORD[i].map(fold).includes(w))) return i;
    const q = ws.map(stripAl).filter(w => w.length > 1 && !FILL.has(w));
    if (q.length) {
      const sc = options.map(o => { const lt = tk(o.label); return q.filter(w => lt.some(x => x === w || (w.length >= 3 && x.length >= 3 && (x.startsWith(w) || w.startsWith(x))))).length; });
      const best = Math.max.apply(null, sc);
      if (best > 0 && sc.filter(x => x === best).length === 1) return sc.indexOf(best);
    }
    if (has(YES, t)) return 0;
    return null;
  }


  /* ═════════ الطبقة الدلالية: نية + عنصر + كمية + سياق (دارجة/فرنسية/فصحى) ═════════ */
  /* أرقام منطوقة: (قيمة، نوع) — add: يُجمع، m100: يضرب ما قبله في 100، m1000: يضرب ما قبله في 1000 */
  const NUMW = {};
  const nd = (v, kind, words) => words.forEach(w => { NUMW[fold(w)] = [v, kind]; });
  nd(0, "add", ["صفر", "zero"]); nd(1, "add", ["واحد", "احد"]); nd(2, "add", ["اثنين", "ثنين", "اثنان", "زوج", "deux", "two"]);
  nd(3, "add", ["ثلاثه", "ثلاث", "تلاته", "تلات", "trois", "three"]); nd(4, "add", ["اربعه", "اربع", "ربعه", "quatre", "four"]);
  nd(5, "add", ["خمسه", "خمس", "cinq", "five"]); nd(6, "add", ["سته", "ست", "six"]); nd(7, "add", ["سبعه", "سبع", "sept", "seven"]);
  nd(8, "add", ["ثمانيه", "ثماني", "ثمان", "تمنيه", "تمانيه", "huit", "eight"]); nd(9, "add", ["تسعه", "تسع", "neuf", "nine"]);
  nd(10, "add", ["عشره", "عشر", "dix", "ten"]); nd(11, "add", ["احدعش", "onze"]); nd(12, "add", ["اثناعش", "طناعش", "douze"]); nd(13, "add", ["ثلاثطاش", "تلطاش", "treize"]);
  nd(14, "add", ["اربعطاش", "ربعطاش", "quatorze"]); nd(15, "add", ["خمسطاش", "خمستاش", "quinze"]); nd(16, "add", ["ستطاش", "seize"]); nd(17, "add", ["سبعطاش"]); nd(18, "add", ["ثمنطاش", "تمنطاش"]); nd(19, "add", ["تسعطاش"]);
  nd(20, "add", ["عشرين", "vingt", "twenty"]); nd(30, "add", ["ثلاثين", "تلاتين", "trente", "thirty"]); nd(40, "add", ["اربعين", "ربعين", "quarante", "forty"]); nd(50, "add", ["خمسين", "cinquante", "fifty"]);
  nd(60, "add", ["ستين", "soixante", "sixty"]); nd(70, "add", ["سبعين"]); nd(80, "add", ["ثمانين", "تمانين"]); nd(90, "add", ["تسعين"]);
  nd(100, "m100", ["ميه", "مايه", "مئه", "cent", "cents", "hundred"]); nd(200, "add", ["ميتين", "مايتين", "مئتين"]); nd(300, "add", ["ثلاثميه", "تلتميه", "ثلثميه"]); nd(400, "add", ["اربعميه", "ربعميه"]);
  nd(500, "add", ["خمسميه", "خمسمايه"]); nd(600, "add", ["ستميه", "ستمايه"]); nd(700, "add", ["سبعميه", "سبعمايه"]); nd(800, "add", ["ثمانميه", "تمنميه", "ثمنميه"]); nd(900, "add", ["تسعميه", "تسعمايه"]);
  nd(1000, "m1000", ["الف", "الاف", "آلاف", "mille", "milles", "thousand", "k"]); nd(2000, "big", ["الفين", "الفان"]);
  const pre80 = s => s.replace(/quatre vingts? dix/g, "90").replace(/quatre vingts?/g, "80");
  /* أول مجموعة أرقام في النص ← {value, idx:Set(مواقع الرموز)} */
  function numberIn(t) {
    t = pre80(t).replace(/(\d{1,3}) (\d{3})(?!\d)/g, "$1$2");
    const ws = t.split(" "), isNum = w => /^\d+$/.test(w) || (w in NUMW) || (w[0] === "و" && w.length > 2 && (w.slice(1) in NUMW)) || w === "et";
    for (let i = 0; i < ws.length; i++) {
      if (!isNum(ws[i]) || ws[i] === "et") continue;
      let j = i, total = 0, cur = 0, idx = new Set(), seen = 0;
      for (; j < ws.length && isNum(ws[j]); j++) {
        let w = ws[j]; if (w === "et") { idx.add(j); continue; }
        idx.add(j); seen++;
        if (/^\d+$/.test(w)) { cur += Number(w); continue; }
        if (!(w in NUMW)) w = w.slice(1);
        const [v, k] = NUMW[w];
        if (k === "add") cur += v; else if (k === "big") { total += v; } else if (k === "m100") cur = (cur || 1) * 100; else { total += (cur || 1) * v; cur = 0; }
      }
      return { value: total + cur, idx, ws };
    }
    return null;
  }
  const HAS_NEG = /(?:^| )(?:مش|ميش|بلاش|لا|ne|non|pas|don t|do not)(?: |$)|(?:^| )ما \S+ش(?: |$)/;
  const BIGQ = new Set(["بزاف", "برشه", "كثير", "كثيره"]);
  const productRef = (t, ent) => {
    const ws = t.split(" ").map((w, i) => (ent && ent.idx && ent.idx.has(i) ? "" : w)).filter(Boolean);
    return ws.filter(w => ![V_INC, V_DEC, V_SET, V_HIDE, V_SHOWON, V_DEL, V_ADD, V_OPEN, V_EDIT, V_CHANGE, W_DISC, W_PRICE, W_PIECE, U_PCT, U_CUR, W_THIS, W_VAGUE, W_PRODUCT, W_STOCK, W_SHOPW, W_NEWW].some(r => r.test(" " + w + " "))).join(" ");
  };
  const pName = p => p.title.replace(/\s*[-–]\s*\d+\s*غ?$/, "");
  /* سؤال لإكمال معلومة ناقصة */
  const need = (slot, partial, say) => ({ kind: "need", slot, partial, say });
  const cmpl = (partial, data, L) => {
    const p = (data.products || []).find(x => x.slug === partial.slug); if (!p) return { kind: "unknown", say: L("لم أجد المنتج.", "Produit introuvable.") };
    const q = pName(p), fm = n => fmtN(n);
    if (partial.op === "delete") return { kind: "editProduct", say: L("لن أحذف بالصوت. أفتح «" + q + "» لتحذفه بنفسك بزر الحذف.", "Je ne supprime pas à la voix. J'ouvre « " + q + " »."), act: { type: "editProduct", slug: p.slug } };
    if (partial.op === "active") return { kind: "visibility", confirm: true, say: partial.on ? L("سأُظهر «" + q + "» في المتجر. أؤكد؟", "Je réaffiche « " + q + " ». Confirmer ?") : L("سأُخفي «" + q + "» من المتجر دون حذفه. أؤكد؟", "Je masque « " + q + " » (sans le supprimer). Confirmer ?"), act: { type: "active", slug: p.slug, on: !!partial.on } };
    if (partial.op === "price") {
      const cur = Number(p.price) || 0; let to = partial.mode === "set" ? partial.value : partial.mode === "inc" ? (partial.pct ? cur * (1 + partial.value / 100) : cur + partial.value) : (partial.pct ? cur * (1 - partial.value / 100) : cur - partial.value);
      to = Math.round(to); if (!(to > 0)) return { kind: "unknown", say: L("السعر الناتج غير صالح.", "Prix résultant invalide.") };
      if (to === cur) return { kind: "answer", say: L("«" + q + "» سعره " + fm(cur) + " دينار أصلاً.", "Déjà à " + fm(cur) + " DA.") };
      return { kind: "priceChange", confirm: true, say: L("سأغيّر سعر «" + q + "» من " + fm(cur) + " إلى " + fm(to) + " دينار. أؤكد؟", "Prix de « " + q + " » : " + fm(cur) + " → " + fm(to) + " DA. Confirmer ?"), act: { type: "price", slug: p.slug, to } };
    }
    if (partial.op === "discount") {
      const cur = Number(p.price) || 0, to = Math.round(cur * (1 - partial.value / 100)); if (!(partial.value > 0 && partial.value < 100) || !(to > 0)) return { kind: "unknown", say: L("نسبة التخفيض غير صالحة.", "Pourcentage invalide.") };
      return { kind: "discount", confirm: true, say: L("سأطبّق تخفيض " + partial.value + "% على «" + q + "»: السعر من " + fm(cur) + " إلى " + fm(to) + " دينار (ويظهر القديم مشطوباً). أؤكد؟", "Remise de " + partial.value + "% sur « " + q + " » : " + fm(cur) + " → " + fm(to) + " DA. Confirmer ?"), act: { type: "discount", slug: p.slug, to, old: cur } };
    }
    if (partial.op === "stock") {
      if (p.type === "variable") return { kind: "nav", say: L("«" + q + "» له تنويعات، عدّل مخزونها من صفحة المخزون.", "Produit à variantes : voir l'inventaire."), act: { type: "nav", tab: "inventory" } };
      if (p.stock == null) return { kind: "unknown", say: L("«" + q + "» بلا تتبع للمخزون (غير محدود). فعّل التتبع من تعديل المنتج أولاً.", "Stock non suivi pour « " + q + " »."), heard: "" };
      const cur = Number(p.stock) || 0, to = Math.max(0, partial.mode === "set" ? partial.value : partial.mode === "inc" ? cur + partial.value : cur - partial.value);
      return { kind: "stockChange", confirm: true, say: L("سأغيّر مخزون «" + q + "» من " + cur + " إلى " + to + " حبة. أؤكد؟", "Stock de « " + q + " » : " + cur + " → " + to + ". Confirmer ?"), act: { type: "stock", slug: p.slug, to } };
    }
    return { kind: "unknown", say: "" };
  };
  /* يكمل أمراً ناقصاً (منتج/قيمة) بجواب المستخدم */
  function fillSlot(prev, raw, data, L) {
    const partial = prev.partial, slot = prev.slot, t = norm(raw); L = L || ((a, f) => a);
    if (has(STOP, t) || has(NO, t)) return { kind: "stop", say: "" };
    const pt = Object.assign({}, partial);
    if (slot === "product") {
      let p = null;
      if (has(W_THIS, t) && data.ctx && data.ctx.slug) p = (data.products || []).find(x => x.slug === data.ctx.slug);
      if (!p) p = matchProduct(productRef(t, numberIn(t)) || t, data.products);
      if (!p) return need("product", partial, L("لم أجد منتجاً بهذا الاسم. قل اسم المنتج مرة أخرى.", "Je n'ai pas trouvé ce produit. Redites le nom."));
      pt.slug = p.slug;
    } else if (slot === "value") {
      const n = numberIn(t); if (!n || !(n.value >= 0)) return need("value", partial, L("لم أسمع رقماً. كم تريد؟", "Je n'ai pas entendu de nombre. Combien ?"));
      pt.value = n.value; if (has(U_PCT, t) || /%/.test(raw)) pt.pct = true;
    }
    return nextStep(pt, data, L);
  }
  function nextStep(pt, data, L) {
    if (!pt.slug) return need("product", pt, L("أي منتج تقصد؟ قل اسمه.", "Quel produit ? Dites son nom."));
    if (pt.needValue && pt.value == null) return need("value", pt, pt.op === "stock" ? L("كم حبة؟", "Combien de pièces ?") : pt.op === "discount" ? L("كم نسبة التخفيض؟", "Quel pourcentage de remise ?") : L("كم المبلغ أو النسبة؟", "Quel montant ou pourcentage ?"));
    return cmpl(pt, data, L);
  }
  /* الفهم الدلالي لأوامر المنتجات: يعيد null إن لم تنطبق القواعد */
  function understand(raw, t, data, L) {
    const prod = has(W_PRODUCT, t), prods = has(W_PRODUCTS, t), price = has(W_PRICE, t), disc = has(W_DISC, t), piece = has(W_PIECE, t), stockW = has(W_STOCK, t);
    const inc = has(V_INC, t) || has(V_ADD, t), dec = has(V_DEC, t), setv = has(V_SET, t) || has(V_CHANGE, t) || has(V_EDIT, t), hide = has(V_HIDE, t), show = has(V_SHOWON, t), del = has(V_DEL, t);
    const anyVerb = inc || dec || setv || hide || show || del;
    /* نفي على مستوى الجملة: «ما تنحيش الصورة» ≠ «نحي الصورة»؛ و«خبي المنتوج وما تمسحوش» ينفّذ الأولى فقط */
    const negClause = c => /(?:^| )(?:مش|ميش|بلاش|لا|ne|non|pas|don t|do not)(?: |$)|(?:^| )ما \S+ش(?: |$)/.test(c);
    const clauses = t.replace(/(^| )و(ما|لا|مش|ميش|ne|pas) /g, "$1 و $2 ").split(/ (?:و|ثم|puis|et|mais) /).map(c => c.trim()).filter(Boolean);
    if (clauses.some(negClause)) {
      const pos = clauses.filter(c => !negClause(c));
      if (!pos.length) return { kind: "negated", say: L("حسناً، لن أنفّذ ذلك.", "D'accord, je ne le fais pas.") };
      const r = parse(pos.join(" و "), data);
      if (r && r.kind !== "unknown") { r.say = r.say + " " + L("ولن أنفّذ ما نفيته.", "Et je ne fais pas le reste."); return r; }
      return { kind: "negated", say: L("حسناً، لن أنفّذ ذلك.", "D'accord, je ne le fais pas.") };
    }
    if (!anyVerb && !disc) return null;
    const ent = numberIn(t), num = ent ? ent.value : null, pct = has(U_PCT, t) || /%/.test(raw), ctxSlug = data.ctx && data.ctx.slug;
    const vague = has(W_VAGUE, t) && num == null;
    const needsProd = () => { if (has(W_THIS, t) && ctxSlug) return ctxSlug; const p = matchProduct(productRef(t, ent), data.products); return p ? p.slug : (has(W_THIS, t) ? "" : ""); };
    const mk = (op, extra) => nextStep(Object.assign({ op, slug: needsProd(), value: num, pct, needValue: op !== "active" && op !== "delete" }, extra || {}), data, L);

    /* حذف: لا ينفَّذ بالصوت */
    if (del && (prod || has(W_THIS, t) || matchProduct(productRef(t, ent), data.products))) return mk("delete", { needValue: false });
    if (del) return { kind: "unknown", say: L("للحذف النهائي استعمل زر الحذف داخل العنصر. أي عنصر تقصد؟", "Pour supprimer, utilisez le bouton de suppression."), heard: raw };
    /* إخفاء / إظهار منتج */
    if (hide && (prod || has(W_THIS, t) || matchProduct(productRef(t, ent), data.products))) return mk("active", { on: false });
    if (show && !prods && (prod || has(W_THIS, t) || matchProduct(productRef(t, ent), data.products))) return mk("active", { on: true });
    /* تخفيض */
    if (disc && (num != null || vague || inc || setv || has(V_OPEN, t) === false)) {
      if (/(?:^| )(?:كامل|قاع|كلشي|الكل|tous|toutes|all)(?: |$)/.test(t) || prods) return { kind: "nav", say: L("التخفيض على عدة منتجات يتم من التعديل الجماعي. أفتحه لك.", "Remise groupée : ouverture de l'édition en masse."), act: { type: "nav", tab: "bulkp" } };
      if (num != null) return mk("discount", { value: num });
    }
    /* سعر */
    if (price && (inc || dec || setv || num != null)) {
      if (vague) return { kind: "unknown", say: L("كم تريد بالضبط؟ قل مبلغاً أو نسبة، مثل «زيد السعر 10 بالمية».", "Combien exactement ?"), heard: raw };
      const mode = dec ? "dec" : (has(V_INC, t) && !setv) ? "inc" : setv || num != null ? "set" : "inc";
      if (!has(W_THIS, t) && !matchProduct(productRef(t, ent), data.products) && !ctxSlug && !prod) return mk("price", { mode });
      return mk("price", { mode });
    }
    /* مخزون / كمية بالحبات */
    if (stockW || piece || ((inc || dec) && num != null && !price && !prod && !disc)) {
      if (vague) return { kind: "unknown", say: L("كم حبة بالضبط؟", "Combien de pièces exactement ?"), heard: raw };
      const mode = dec ? "dec" : (setv && !inc) ? "set" : "inc";
      return mk("stock", { mode });
    }
    /* منتج جديد (أو عدة منتجات) */
    if (inc && (prod || prods) && !stockW && !price) {
      if (prods || vague) return { kind: "choose", single: false, say: L("لإضافة عدة منتجات: فتح نموذج منتج جديد، أو التعديل الجماعي. أيهما؟", "Plusieurs produits : nouveau produit ou édition en masse. Lequel ?"), options: [{ label: "منتج جديد", act: { type: "newProduct" } }, { label: "التعديل الجماعي", act: { type: "nav", tab: "bulkp" } }] };
      return { kind: "newProduct", say: L("أفتح نموذج منتج جديد.", "J'ouvre un nouveau produit."), act: { type: "newProduct" } };
    }
    /* «زيد» وحدها أو «زيد جديد» بلا عنصر: اسأل */
    if (inc && !prod && !prods && !price && !stockW && !disc && ent == null && ![V_OPEN, V_SEARCH].some(r => r.test(t)) && (t.split(" ").length <= 4)) {
      const noTarget = !tokens(t).filter(w => !V_INC.test(" " + w + " ") && !V_ADD.test(" " + w + " ") && !W_NEWW.test(" " + w + " ") && !W_SHOPW.test(" " + w + " ")).length;
      if (noTarget) return { kind: "choose", single: false, say: L("ما فهمتش مليح، تقصد نزيد منتوج جديد ولا نزيد الكمية في المخزون؟", "Je n'ai pas bien compris : un nouveau produit ou ajouter du stock ?"), options: [{ label: "منتج جديد", act: { type: "newProduct" } }, { label: "زيادة كمية في المخزون", text: "زيد مخزون" }, { label: "رفع سعر منتج", text: "زيد السعر" }] };
    }
    return null;
  }
  const ask = t => has(COUNT_Q, t) || has(WHAT_Q, t);

  /* ── الفهم: النص + بيانات اللوحة ← أمر ──
     النتيجة: { kind, say, act, ... } حيث kind: nav|orders|answer|newProduct|editProduct|theme|update|ask|search|site|help|stop|unknown
     say: ما يُقال/يُعرض، act: وصف التنفيذ (يُنفَّذ في exec)، confirm: يحتاج تأكيداً. */
  function parse(raw, data) {
    data = data || {};
    const t = norm(raw), fr = /[a-z]{3,}/.test(t) && !/[ء-ي]/.test(t);
    const L = (ar, f) => (fr ? f : ar);
    if (!t) return { kind: "unknown", say: "" };
    if (has(STOP, t) && t.split(" ").length <= 3) return { kind: "stop", say: "" };
    if (has(HELP, t)) return { kind: "help", say: L("هذه أمثلة على الأوامر.", "Voici des exemples de commandes.") };
    const am = ASK_ME.exec(t); if (am) return { kind: "ask", q: am[1], say: "" };

    const orders = data.orders || [], products = data.products || [];
    const sem = understand(raw, t, data, L); if (sem) return sem;
    const isOpen = has(V_OPEN, t), ask = has(COUNT_Q, t) || has(WHAT_Q, t);

    /* منتج جديد */
    if (has(V_ADD, t) && has(W_PRODUCT, t) && !/منتجات|produits|products/.test(t)) return { kind: "newProduct", say: L("أفتح نموذج منتج جديد.", "J'ouvre un nouveau produit."), act: { type: "newProduct" } };

    /* تبديل المظهر */
    if ((has(V_CHANGE, t) && (has(W_THEME, t) || has(T_DARK, t) || has(T_LIGHT, t))) || (has(W_THEME, t) && (has(T_DARK, t) || has(T_LIGHT, t)))) {
      if (!/موقع|site/.test(t) || /لوحه|panel|tableau/.test(t)) {
        const mode = has(T_DARK, t) ? "dark" : has(T_LIGHT, t) ? "white" : "toggle";
        return { kind: "theme", say: mode === "dark" ? L("المظهر الداكن.", "Mode sombre.") : mode === "white" ? L("المظهر الفاتح.", "Mode clair.") : L("بدّلت المظهر.", "Thème changé."), act: { type: "theme", mode } };
      }
    }

    /* تحديث اللوحة (بتأكيد) */
    if (has(V_UPDATE, t) && has(W_PANEL, t)) return { kind: "update", confirm: true, say: L("هل أحدّث اللوحة الآن؟ ستُعاد تحميل الصفحة.", "Actualiser le panneau maintenant ?"), act: { type: "update" } };

    /* أسئلة الأرقام */
    if (has(W_REV, t) && !has(W_ORDER, t) && !isOpen && (ask || periodOf(t))) {
      const per = periodOf(t), sum = orders.filter(o => inPeriod(o, per) && !["annulee", "echec"].includes(o.status)).reduce((s, o) => s + (Number(o.total) || 0), 0);
      return { kind: "answer", say: L("المبيعات " + PERIOD_AR[per] + ": " + fmtN(sum) + " دينار.", "Ventes " + PERIOD_FR[per] + " : " + fmtN(sum) + " DA.") };
    }
    if ((has(S_OUT, t) || has(S_LOW, t)) && (has(W_PRODUCT, t) || has(W_STOCK, t) || has(W_PRODUCTS, t))) return stockAnswer(t, products, data, L);
    if (ask && (has(W_STOCK, t) || has(REMAIN, t)) && !has(S_OUT, t) && !has(S_LOW, t)) {
      const pr = matchProduct(productRef(t, numberIn(t)), products), inf = data.stockInfo || (p => ({ tracked: p.stock != null, total: p.stock != null ? Number(p.stock) : null }));
      if (pr) { const s = inf(pr); return { kind: "answer", say: s.tracked && s.total != null ? L("مخزون «" + pName(pr) + "»: " + s.total + " حبة.", "Stock de « " + pName(pr) + " » : " + s.total + ".") : L("«" + pName(pr) + "» بلا تتبع للمخزون.", "Stock non suivi.") }; }
      let units = 0, items = 0, out = 0; products.filter(p => p.active !== false).forEach(p => { const s = inf(p); if (s.tracked && s.total != null) { items++; units += s.total; if (s.total <= 0) out++; } });
      return { kind: "answer", say: items ? L("في المخزون " + fmtN(units) + " حبة موزعة على " + items + " منتج" + (out ? "، منها " + out + " نفد." : "."), units + " pièces sur " + items + " produits" + (out ? " (" + out + " en rupture)." : ".")) : L("لا يوجد منتج بتتبّع للمخزون.", "Aucun produit avec suivi de stock.") };
    }
    if (ask && !isOpen) {
      if (has(W_ORDER, t) || has(W_CLIENT, t) && false) {
        const st = statusOf(t), per = periodOf(t);
        const n = orders.filter(o => inPeriod(o, per) && (!st || o.status === st[0])).length;
        return { kind: "answer", say: L("عدد الطلبات" + (st ? " " + st[1] : "") + " " + PERIOD_AR[per] + ": " + n + ".", "Commandes" + (st ? " (" + st[0] + ")" : "") + " " + PERIOD_FR[per] + " : " + n + ".") };
      }
      if (has(W_PRODUCT, t) || W_PRODUCTS.test(t)) {
        const n = products.filter(p => p.active !== false).length;
        return { kind: "answer", say: L("عندك " + n + " منتج نشط.", "Vous avez " + n + " produits actifs.") };
      }
    }
    /* آخر طلب */
    if (has(W_LAST, t) && has(W_ORDER, t) && !isOpen) {
      const o = orders.slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      return { kind: "answer", say: o ? L("آخر طلب من " + (o.name || "زبون") + " ولاية " + (o.wilaya || "—") + " بمبلغ " + fmtN(o.total) + " دينار.", "Dernière commande : " + (o.name || "client") + ", " + (o.wilaya || "") + ", " + fmtN(o.total) + " DA.") : L("لا توجد طلبات بعد.", "Aucune commande.") };
    }
    /* منتجات نفدت/منخفضة بدون سؤال كم */
    if ((has(S_OUT, t) || has(S_LOW, t)) && (has(W_PRODUCT, t) || has(W_STOCK, t) || W_PRODUCTS.test(t)) && !isOpen) return stockAnswer(t, products, data, L);

    /* بحث عن طلب/زبون */
    if (has(V_SEARCH, t) && (has(W_ORDER, t) || has(W_CLIENT, t))) {
      const phone = phoneOf(t), q = phone || tokens(t).filter(w => !V_SEARCH.test(" " + w + " ") && !W_ORDER.test(" " + w + " ") && !W_CLIENT.test(" " + w + " ")).join(" ").trim();
      return { kind: "orders", say: q ? L("أبحث في الطلبات عن " + q + ".", "Je cherche « " + q + " » dans les commandes.") : L("أفتح الطلبات.", "J'ouvre les commandes."), act: { type: "orders", q } };
    }
    if (has(V_SEARCH, t)) {
      const q = tokens(t).filter(w => !V_SEARCH.test(" " + w + " ")).join(" ").trim();
      return { kind: "search", say: q ? L("أبحث عن " + q + ".", "Je cherche « " + q + " ».") : L("أفتح البحث.", "J'ouvre la recherche."), act: { type: "search", q } };
    }

    /* فتح موقع المتجر نفسه */
    if (isOpen && has(W_SITE, t) && !has(re(["اعدادات", "مظهر", "parametres", "apparence"]), t)) return { kind: "site", say: L("أفتح موقعك.", "J'ouvre votre site."), act: { type: "site" } };

    /* تعديل منتج بالاسم */
    if (has(W_PRODUCT, t) && (isOpen || has(V_EDIT, t))) {
      const rest = t.split(" ").filter(w => !V_OPEN.test(" " + w + " ") && !V_EDIT.test(" " + w + " ") && !W_PRODUCT.test(" " + w + " ")).join(" ");
      const p = matchProduct(rest, products);
      if (p) return { kind: "editProduct", say: L("أفتح المنتج: " + p.title, "J'ouvre : " + p.title), act: { type: "editProduct", slug: p.slug } };
      if (tokens(rest).length) return { kind: "unknown", say: L("لم أجد منتجاً باسم «" + rest + "».", "Aucun produit « " + rest + " »."), heard: raw };
    }

    /* أسئلة شرح الاستعمال ← «اسألني» (قبل المطابقة المفتاحية) */
    if (has(Q_START, t.split(" ").slice(0, 2).join(" "))) return { kind: "ask", q: raw, say: "" };

    /* التبويبات + الكلمات المفتاحية: اسم الأداة بالضبط ← فتح مباشر؛ كلمة تخص أداة واحدة ← «تقصد؟»؛ مشتركة ← عرض الأدوات */
    let tab = null; for (const x of TAB_RX) if (x.rx.test(t)) { tab = x.id; break; }
    if (tab === "orders") {
      const st = statusOf(t), per = periodOf(t);
      if (st || per) return { kind: "orders", say: L("أعرض الطلبات " + (st ? st[1] + " " : "") + (per ? PERIOD_AR[per] : "").trim(), "J'affiche les commandes" + (st ? " " + st[0] : "") + (per ? " " + PERIOD_FR[per] : "")), act: { type: "orders", status: st ? st[0] : "", period: per } };
    }
    const ct = contentTokens(t);
    if (ct.length) {
      const navs = data.nav && data.nav.length ? data.nav : Object.keys(TAB_LABEL).map(id => ({ id, label: TAB_LABEL[id] }));
      const exact = navs.filter(n => tk(n.label).join(" ") === ct.join(" "));
      if (exact.length === 1) return { kind: "nav", tab: exact[0].id, say: L("أفتح " + exact[0].label + ".", "J'ouvre : " + exact[0].label + "."), act: { type: "nav", tab: exact[0].id } };
      const cands = ct.length <= 3 ? findCands(ct, data) : [];
      if (cands.length === 1 && cands[0].kind === "tab" && cands[0].id === tab) return { kind: "nav", tab, say: L("أفتح " + cands[0].label + ".", "J'ouvre : " + cands[0].label + "."), act: { type: "nav", tab } };
      if (cands.length) return choose(cands, ct.join(" "), L);
      if (tab && (isOpen || ct.length <= 4)) return { kind: "nav", tab, say: L("أفتح " + (TAB_LABEL[tab] || tab) + ".", "J'ouvre : " + (TAB_LABEL[tab] || tab) + "."), act: { type: "nav", tab } };
    } else if (isOpen) {
      return { kind: "unknown", say: L("ماذا تريد أن أفتح؟ قل اسم القسم أو الأداة.", "Que dois-je ouvrir ?"), heard: raw };
    }

    /* منتج بالاسم بدون كلمة «منتج»: افتح حنة الشفاء */
    if (isOpen || has(V_EDIT, t)) {
      const rest = t.split(" ").filter(w => !V_OPEN.test(" " + w + " ") && !V_EDIT.test(" " + w + " ")).join(" ");
      const p = matchProduct(rest, products);
      if (p) return { kind: "editProduct", say: L("أفتح المنتج: " + p.title, "J'ouvre : " + p.title), act: { type: "editProduct", slug: p.slug } };
    }

    return { kind: "unknown", say: L("لم أفهم الأمر. قل «ماذا أقول» لأرى الأمثلة.", "Je n'ai pas compris. Dites « aide » pour des exemples."), heard: raw };
  }

  function inPeriod(o, per) {
    if (!per) return true;
    const d = new Date(o.date); if (isNaN(d)) return false;
    const now = new Date(), day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    if (per === "today") return day(d) === day(now);
    if (per === "yesterday") return day(d) === day(now) - 86400000;
    if (per === "week") return now - d < 7 * 86400000 && d <= now;
    if (per === "month") return now - d < 30 * 86400000 && d <= now;
    return true;
  }
  function stockAnswer(t, products, data, L) {
    const low = Number((data && data.lowAt) || 5), info = data && data.stockInfo ? data.stockInfo : (p => ({ tracked: p.stock != null, total: p.stock != null ? Number(p.stock) : null }));
    const wantOut = has(S_OUT, t), wantLow = has(S_LOW, t);
    const out = [], lw = [];
    (products || []).filter(p => p.active !== false).forEach(p => { const s = info(p); if (!s.tracked || s.total == null) return; if (s.total <= 0) out.push(p.title); else if (s.total <= low) lw.push(p.title); });
    const list = a => a.slice(0, 5).join(L("، ", ", ")) + (a.length > 5 ? L(" وغيرها", " et d'autres") : "");
    const parts = [];
    if (wantOut || !wantLow) parts.push(out.length ? L("نفد مخزون " + out.length + ": " + list(out) + ".", "Rupture (" + out.length + ") : " + list(out) + ".") : L("لا منتج نفد مخزونه.", "Aucune rupture de stock."));
    if (wantLow || !wantOut) parts.push(lw.length ? L("مخزون منخفض لـ" + lw.length + ": " + list(lw) + ".", "Stock bas (" + lw.length + ") : " + list(lw) + ".") : L("لا منتج بمخزون منخفض.", "Aucun stock bas."));
    return { kind: "answer", say: parts.join(" ") };
  }

  /* أمثلة الأوامر (تُعرض في اللوحة العائمة) */
  const HELP_TXT = [
    ["تنقّل", "افتح الطلبات · حل المخزون · وريني العملاء · ouvre les commandes · va aux produits"],
    ["الطلبات", "الطلبات الجديدة · طلبات اليوم · ابحث عن طلب أحمد · cherche commande 0550…"],
    ["أرقام", "قداش من طلب اليوم؟ · كم المبيعات هذا الأسبوع؟ · شنو نفد من المنتجات؟ · آخر طلب"],
    ["منتجات", "زيد منتج جديد · افتح منتج حنة · عدّل منتج عسل"],
    ["اللوحة", "بدّل المظهر · المظهر الداكن · حدّث اللوحة · افتح الموقع"],
    ["مساعدة", "كيفاش نزيد صنف؟ · اسألني عن الكوبونات · ماذا أقول"],
  ];

  /* ═════════ التنفيذ والواجهة (المتصفح فقط) ═════════ */
  const A = () => (typeof Admin !== "undefined" ? Admin : {});
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { } return null; };
  const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  let lastSlug = "", rec = null, listening = false, micOn = false, armedUntil = 0, pending = null, pendingT = 0, lang = "ar-DZ", hud = null, restartT = 0, restarts = [];

  const navBtns = () => [...document.querySelectorAll(".nav-btn")];
  const tabBtn = id => { const m = navBtns().filter(b => (b.getAttribute("onclick") || "").includes("'" + id + "'")); return m.find(b => !b.classList.contains("nav-work")) || m[0]; };
  let KB = null, LEXLOADED = false;
  async function loadLex() { if (LEXLOADED) return; LEXLOADED = true; try { const r = await fetch("assets/data/voice-lexicon.json", { cache: "no-cache" }); if (r.ok) useLexicon(await r.json()); } catch (e) { } }
  async function loadKB() { if (KB !== null) return; KB = []; try { const r = await fetch("assets/data/admin-help.json", { cache: "no-cache" }); if (r.ok) KB = await r.json(); } catch (e) { } }
  /* بطاقات القائمة الظاهرة ← {id,label,desc} (الأقسام والتطبيقات) */
  const navNow = () => navBtns().filter(b => !b.classList.contains("nav-work")).map(b => {
    const m = /(?:Admin\.tab|AdminNav\.app)\('([a-z]+)'/.exec(b.getAttribute("onclick") || ""); if (!m) return null;
    const x = b.querySelector(".nav-txt"), l = x && x.querySelector("b"), d = x && x.querySelector("small");
    const own = l ? Array.from(l.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim() : "";
    return own ? { id: m[1], label: own, desc: d ? d.textContent.trim() : "" } : null;
  }).filter(Boolean);
  function exec(act) {
    if (!act) return true;
    const a = A();
    switch (act.type) {
      case "nav": { const b = tabBtn(act.tab); if (!b) return false; b.click(); return true; }
      case "orders": {
        const b = tabBtn("orders"); if (!b) return false; b.click();
        setTimeout(() => {
          const $ = id => document.getElementById(id), set = (id, v) => { const e = $(id); if (e) e.value = v; };
          set("order-filter-q", act.q || ""); set("order-filter-status", act.status || "");
          const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"), now = new Date();
          let from = "", to = "";
          if (act.period === "today") from = to = iso(now);
          else if (act.period === "yesterday") { const y = new Date(now - 86400000); from = to = iso(y); }
          else if (act.period === "week") from = iso(new Date(now - 6 * 86400000));
          else if (act.period === "month") from = iso(new Date(now - 29 * 86400000));
          set("order-filter-from", from); set("order-filter-to", to);
          try { a.applyOrderFilters(); } catch (e) { }
        }, 150);
        return true;
      }
      case "newProduct": if (!a.editProduct) return false; a.editProduct(null); return true;
      case "editProduct": if (!a.editProduct) return false; a.editProduct(act.slug); return true;
      case "theme": if (typeof AdminTheme === "undefined") return false; if (act.mode === "toggle") AdminTheme.toggle(); else AdminTheme.set(act.mode); return true;
      case "update": if (typeof AdminUpdate === "undefined") return false; AdminUpdate.apply(); return true;
      case "kb": {
        const b = act.go ? tabBtn(act.go) : null; if (b) b.click();
        if (!b && typeof AdminHelp !== "undefined") { AdminHelp.show().then(() => AdminHelp.ask(act.label)); }
        return true;
      }
      case "stock": if (!a.setStock) return false; a.setStock(act.slug, act.to); lastSlug = act.slug; return true;
      case "price": if (!a.setPrice) return false; a.setPrice(act.slug, act.to); lastSlug = act.slug; return true;
      case "active": case "discount": {
        const p = (a.products || []).find(x => x.slug === act.slug); if (!p || !a.queueStockPublish) return false;
        if (act.type === "active") p.active = !!act.on; else { p.old = act.old; p.price = act.to; }
        a.queueStockPublish(); try { a.renderProducts(); a.renderFinance && a.renderFinance(true); } catch (e) { }
        try { toast(act.type === "active" ? (act.on ? "تم إظهار المنتج (يُنشر خلال ثوانٍ)" : "تم إخفاء المنتج (يُنشر خلال ثوانٍ)") : "تم تطبيق التخفيض (يُنشر خلال ثوانٍ)"); } catch (e) { }
        lastSlug = act.slug; return true;
      }
      case "site": window.open("index.html", "_blank"); return true;
      case "search": if (typeof AdminSearch === "undefined") return false; AdminSearch.show(); setTimeout(() => { const i = document.getElementById("as-in"); if (i && act.q) { i.value = act.q; i.dispatchEvent(new Event("input")); } }, 60); return true;
    }
    return false;
  }
  const dataNow = () => { const a = A(); let lowAt = 5; try { lowAt = Number((a.inventory && a.inventory.low) || 5); } catch (e) { } return { ctx: { slug: (a.editingSlug || lastSlug || "") }, nav: navNow(), kb: KB || [], orders: a.orders || [], products: a.products || [], stockInfo: a.stockInfo ? p => a.stockInfo(p) : null, lowAt }; };

  /* ── المخارج: لوحة «اسألني» إن كانت مفتوحة، وإلا شريط عائم صغير ── */
  const $h = id => document.getElementById(id);
  const AH = () => (typeof AdminHelp !== "undefined" ? AdminHelp : null);
  const panelOpen = () => { const p = $h("ah-panel"); return !!p && p.classList.contains("on") && !!AH() && !!AH().post; };
  const speakOn = () => micOn;                                   /* الردّ بالصوت فقط والميكروفون أخضر */
  function speak(text, fr) {
    if (!text || !speakOn() || typeof speechSynthesis === "undefined") return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = fr ? "fr-FR" : "ar-SA"; u.rate = 1.02; speechSynthesis.speak(u); } catch (e) { }
  }
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function css() {
    if (document.getElementById("av-css")) return;
    const st = document.createElement("style"); st.id = "av-css";
    st.textContent = `#av-hud{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(20px);width:min(520px,calc(100vw - 24px));z-index:99990;background:rgba(9,24,18,.985);color:#fff;border:1px solid rgba(134,239,172,.35);border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.12);padding:.9rem 1rem;opacity:0;pointer-events:none;transition:.22s;direction:rtl;font-family:inherit}
#av-hud.on{opacity:1;pointer-events:auto;transform:translateX(-50%)}
#av-hud .av-r{display:flex;align-items:center;gap:.6rem}#av-hud .av-dot{width:12px;height:12px;border-radius:50%;background:#4ade80;flex:none;animation:avp 1.2s infinite}@keyframes avp{50%{transform:scale(1.3)}}
#av-hud .av-tx{flex:1;font-weight:800;font-size:.95rem;min-height:1.4em;color:#e2f7e8;word-break:break-word}#av-hud .av-tx i{opacity:.6;font-style:normal}
#av-hud .av-out{margin-top:.55rem;font-size:.9rem;line-height:1.8;color:#bef264;white-space:pre-line}#av-hud .av-out.err{color:#fda4af}
#av-hud .av-hp{margin-top:.6rem;display:none;font-size:.78rem;line-height:1.9;color:#cde8d6;border-top:1px solid rgba(255,255,255,.12);padding-top:.5rem}#av-hud.help .av-hp{display:block}.av-hp b{color:#86efac}
#av-hud .av-bt{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.65rem}
#av-hud button{font-family:inherit;font-weight:800;font-size:.8rem;color:#fff;cursor:pointer;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.10);backdrop-filter:blur(8px);border-radius:12px;padding:.42rem .85rem;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),inset 0 -5px 10px rgba(0,0,0,.18);transition:transform .15s,background .15s}
#av-hud button:hover{transform:translateY(-2px);background:rgba(134,239,172,.22)}#av-hud button.ok{background:rgba(74,222,128,.22);border-color:rgba(134,239,172,.55)}#av-hud button.no{background:rgba(239,68,68,.2);border-color:rgba(248,113,113,.5)}
@media(max-width:560px){#av-hud{bottom:12px}}`;
    document.head.appendChild(st);
  }
  function buildHud() {
    css(); if (hud) return;
    hud = document.createElement("div"); hud.id = "av-hud"; hud.setAttribute("role", "dialog"); hud.setAttribute("aria-live", "polite");
    hud.innerHTML = '<div class="av-r"><span class="av-dot"></span><div class="av-tx" id="av-tx"></div></div><div class="av-out" id="av-out"></div>' +
      '<div class="av-hp" id="av-hp">' + HELP_TXT.map(h => "<div><b>" + esc(h[0]) + ":</b> " + esc(h[1]) + "</div>").join("") + "</div>" +
      '<div class="av-bt" id="av-bt"></div>';
    document.body.appendChild(hud);
  }
  function buttons(extra) {
    const bt = $h("av-bt"); if (!bt) return; bt.innerHTML = "";
    const add = (label, fn, cls) => { const x = document.createElement("button"); x.type = "button"; x.textContent = label; if (cls) x.className = cls; x.onclick = fn; bt.appendChild(x); };
    (extra || []).forEach(e => add(e[0], e[1], e[2]));
    if (SR) add(lang === "ar-DZ" ? "العربية ⇄ Fr" : "Fr ⇄ العربية", toggleLang);
    add("الأوامر", () => hud.classList.toggle("help")); add("إغلاق", closeHud);
  }
  let hudT = 0;
  function showHud(o) {
    buildHud(); o = o || {}; hud.classList.add("on");
    clearTimeout(hudT); if (!pending && !(o.buttons && o.buttons.length)) hudT = setTimeout(() => { if (!pending && hud) hud.classList.remove("on", "help"); }, 9000);
    if (o.tx !== undefined) $h("av-tx").innerHTML = o.tx;
    if (o.out !== undefined) { const e = $h("av-out"); e.textContent = o.out; e.classList.toggle("err", !!o.err); }
    buttons(o.buttons);
  }
  function closeHud() { if (hud) hud.classList.remove("on", "help"); pending = null; }
  /* يعرض ناتج الأمر: محادثة «اسألني» إن كانت مفتوحة (مع أزرار الاختيار)، وإلا الشريط العائم */
  function sink(o) {
    if (panelOpen() && o.out !== undefined) { if (hud) hud.classList.remove("on"); AH().post("a", o.out, (o.buttons || []).map(b => [b[0], b[1], b[2] === "ok"]), !!o.err); return; }
    showHud(o);
  }
  const mirrorUser = txt => { if (panelOpen() && txt) AH().post("u", txt); };

  /* ── الميكروفون: أصفر = متوقف (ردود كتابية)، أخضر = يعمل (استماع بكلمة النداء + ردود صوتية) ── */
  const boutique = () => wakeNames().first;   /* اسم المتجر المعروض في تلميحات كلمة النداء */
  function paintMic() {
    const cls = !SR ? "na" : micOn ? "on" : "off";
    ["ah-mic", "ah-mic2"].forEach(id => { const x = $h(id); if (!x) return; x.classList.remove("on", "off", "na"); x.classList.add(cls); x.classList.toggle("live", micOn && listening); x.title = !SR ? "متصفحك لا يدعم الأوامر الصوتية" : micOn ? "الميكروفون يعمل — اضغط لإيقافه" : "الميكروفون متوقف — اضغط لتشغيله"; });
    const st = $h("ah-mic-st");
    if (st) st.textContent = !SR ? "متصفحك لا يدعم الصوت. استعمل Chrome أو Edge." : micOn ? "الميكروفون يعمل — قل: hi " + boutique() + " ثم أمرك. أردّ بالصوت." : "الميكروفون متوقف — أردّ بالكتابة. اضغط الميكروفون لتشغيله.";
  }
  function toggleMic() { micOn ? micOff(true) : micStart(true); }
  function micStart(user) {
    if (!SR) { paintMic(); if (user) sink({ out: "متصفحك لا يدعم الأوامر الصوتية. استعمل Chrome أو Edge.", err: true }); return; }
    micOn = true; LS("alyssum_voice_mic", "1"); startRec(); paintMic();
    if (user) sink({ out: "الميكروفون يعمل. قل: hi " + boutique() + " ثم أمرك.", tx: "<i>أسمعك… قل «hi " + esc(boutique()) + "»</i>" });
  }
  function micOff(user) {
    micOn = false; LS("alyssum_voice_mic", "0"); stopRec(); paintMic(); try { speechSynthesis.cancel(); } catch (e) { }
    if (user) sink({ out: "الميكروفون متوقف. أردّ بالكتابة." });
  }
  function startRec() {
    if (!SR || listening) return; clearTimeout(restartT);
    rec = new SR(); rec.lang = lang; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 3;
    rec.onstart = () => { listening = true; paintMic(); };
    rec.onresult = e => {
      let interim = "", fin = null;
      for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin = Array.from({ length: r.length }, (_, k) => r[k].transcript); else interim += r[0].transcript; }
      if (interim && (wakeRx().test(norm(interim)) || Date.now() < armedUntil || pending) && !panelOpen()) showHud({ tx: esc(interim) });
      if (fin) handle(fin);
    };
    rec.onerror = e => {
      const err = e && e.error; if (err === "no-speech" || err === "aborted") return;
      listening = false;
      if (err === "not-allowed" || err === "service-not-allowed" || err === "audio-capture") { micOn = false; LS("alyssum_voice_mic", "0"); paintMic(); sink({ out: err === "audio-capture" ? "لم أجد ميكروفوناً." : "اسمح للموقع باستعمال الميكروفون من إعدادات المتصفح ثم اضغط الميكروفون.", err: true }); return; }
      if (err === "network") { micOn = false; LS("alyssum_voice_mic", "0"); paintMic(); sink({ out: "التعرّف على الكلام يحتاج اتصالاً بالإنترنت.", err: true }); }
    };
    rec.onend = () => {
      listening = false; paintMic(); if (!micOn) return;
      const now = Date.now(); restarts = restarts.filter(x => now - x < 8000); restarts.push(now);
      if (restarts.length > 10) { micOn = false; LS("alyssum_voice_mic", "0"); paintMic(); sink({ out: "توقّف الاستماع بعد انقطاعات متكررة. اضغط الميكروفون لإعادة تشغيله.", err: true }); return; }
      restartT = setTimeout(() => { if (micOn && !listening) startRec(); }, 350);
    };
    try { rec.start(); } catch (e) { listening = false; }
  }
  function stopRec() { clearTimeout(restartT); try { if (rec) { rec.onend = null; rec.abort ? rec.abort() : rec.stop(); } } catch (e) { } listening = false; }
  function toggleLang() { lang = lang === "ar-DZ" ? "fr-FR" : "ar-DZ"; LS("alyssum_voice_lang", lang); if (micOn) { stopRec(); setTimeout(startRec, 250); } sink({ out: lang === "fr-FR" ? "Langue : français" : "اللغة: العربية (الجزائر)" }); }

  /* كلمة النداء: «hi + اسم المتجر» (اسم المتجر من إعدادات الموقع)، مع الصيغ التي تعلّمتها معايرة صوت صاحب المتجر */
  let STORE_NAME = "", WAKEV = null, WAKE_RX = null, calibrating = false;
  try { WAKEV = JSON.parse(LS("alyssum_voice_wake") || "null"); } catch (e) { WAKEV = null; }
  const siteName = () => { let nm = STORE_NAME; if (!nm) { try { nm = (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.name) || ""; } catch (e) { } } return nm; };
  function wakeNames() {
    const nm = siteName(), full = norm(nm), set = new Set(full.split(" ").filter(w => w.length >= 3));
    if (full.includes(" ") && full.length >= 4) set.add(full);
    ((WAKEV && WAKEV.variants) || []).forEach(v => set.add(v));
    if (!set.size) { set.add("مساعد"); set.add("assistant"); }
    return { ws: [...set], first: (nm || "").trim().split(/\s+/)[0] || "المساعد" };
  }
  const GREET = /^(?:(?:يا|ya|hey|hi|high|hello|هاي|هاى|اوكي|ok|okay|مرحبا|اهلا|salut|bonjour)\s+)+/;
  const wakeRx = () => WAKE_RX || (WAKE_RX = new RegExp("^(?:(?:يا|ya|hey|hi|high|hello|هاي|هاى|اوكي|ok|okay|مرحبا|اهلا|salut|bonjour)\\s+)*(?:" + wakeNames().ws.sort((a, b) => b.length - a.length).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\s*"));
  async function loadStoreName() { try { const r = await fetch("assets/data/store.json", { cache: "no-cache" }); if (r.ok) { const d = await r.json(); if (d && d.name) { STORE_NAME = String(d.name); WAKE_RX = null; paintMic(); } } } catch (e) { } }

  /* ── معايرة صوت صاحب المتجر: يقول «hi اسم متجره» ثلاث مرات فتُحفظ الصيغ التي يلتقطها المتصفح لنطقه ── */
  function oneShot() {
    return new Promise(res => {
      if (!SR) return res(null);
      const r = new SR(); r.lang = lang; r.interimResults = false; r.continuous = false; r.maxAlternatives = 5; let done = false;
      const fin = v => { if (done) return; done = true; clearTimeout(tm); try { r.abort && r.abort(); } catch (e) { } res(v); }, tm = setTimeout(() => fin(null), 9000);
      r.onresult = e => { const rr = e.results[e.results.length - 1], out = []; for (let k = 0; k < rr.length; k++) out.push(rr[k].transcript); fin(out); };
      r.onerror = () => fin(null); r.onend = () => fin(null);
      try { r.start(); } catch (e) { fin(null); }
    });
  }
  async function calibrate() {
    if (!SR) { sink({ out: "متصفحك لا يدعم الأوامر الصوتية. استعمل Chrome أو Edge.", err: true }); return; }
    if (calibrating) return; calibrating = true;
    const was = micOn; stopRec(); micOn = false; paintMic(); pending = null;
    const resume = () => { calibrating = false; if (was) { micOn = true; startRec(); paintMic(); } };
    const nm = wakeNames().first, takes = [];
    for (let i = 1; i <= 3; i++) {
      sink({ out: "المرة " + i + " من 3: قل «hi " + nm + "» بصوتك الآن…", tx: "<i>أسمعك…</i>" });
      const alts = await oneShot();
      if (!alts) { sink({ out: "لم أسمع شيئاً. اضغط «اضبط كلمة النداء» وأعد المحاولة بصوت أوضح.", err: true }); resume(); return; }
      takes.push(alts); await new Promise(r => setTimeout(r, 450));
    }
    const parts = new Map();
    takes.forEach(alts => alts.forEach((a, k) => { const n = norm(a); if (!n || n.split(" ").length > 4) return; const m = GREET.exec(n), rest = (m ? n.slice(m[0].length) : n).trim(); if (rest.length >= 3) parts.set(rest, (parts.get(rest) || 0) + (k === 0 ? 2 : 1)); }));
    const variants = [...parts.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 12);
    if (!variants.length) { sink({ out: "لم أتمكن من التقاط الكلمة. أعد المحاولة في مكان أهدأ وانطقها بوضوح.", err: true }); resume(); return; }
    WAKEV = { variants, lang, at: Date.now() }; LS("alyssum_voice_wake", JSON.stringify(WAKEV)); WAKE_RX = null;
    sink({ out: "تم الضبط. سأستجيب لـ: " + variants.map(v => "«hi " + v + "»").join("، ") + ".\nجرّب الآن: قل «hi " + nm + "» ثم أمرك." });
    speak(lang === "fr-FR" ? "C'est réglé" : "تم الضبط", lang === "fr-FR"); resume(); paintMic();
  }
  function resetWake() { WAKEV = null; WAKE_RX = null; LS("alyssum_voice_wake", ""); paintMic(); sink({ out: "أُعيد ضبط كلمة النداء إلى اسم المتجر." }); }

  function handle(alts, opt) {
    opt = opt || {}; const norms = alts.map(norm);
    /* ردّ على سؤال قائم (إكمال/اختيار/تأكيد): لا يحتاج كلمة النداء */
    if (pending) {
      if (!opt.typed) mirrorUser(alts[0]);
      if (pending.kind === "need") {
        const d0 = dataNow(); let res = null;
        for (const a of alts) { const r = fillSlot(pending, a, d0); if (r.kind !== "need") { res = r; break; } if (!res) res = r; }
        pending = null; run(res, alts[0]); return;
      }
      if (pending.kind === "choose") {
        for (const x of norms) { const i = pickOption(pending.options, x); if (i === -1) { pending = null; sink({ out: "تم الإلغاء." }); return; } if (i !== null) { chooseOpt(i); return; } }
        const alt = parse(alts[0], dataNow());   /* أمر جديد مفهوم يلغي السؤال القائم */
        if (alt.kind === "unknown" || alt.kind === "choose") { sink({ out: "لم أفهم اختيارك. قل الرقم أو اسم الأداة.", err: true, buttons: optBtns(pending.options) }); return; }
        pending = null;
      } else {
        const n = norms.find(x => has(YES, x) || has(NO, x) || has(STOP, x));
        if (n !== undefined) { confirmPending(has(YES, n)); return; }
      }
    }
    let list = alts;
    if (micOn && !opt.typed) {                       /* الاستماع المستمر: كلمة النداء شرط */
      const wakeAll = norms.map(x => wakeRx().exec(x)), i = wakeAll.findIndex(Boolean);
      if (i >= 0) {
        list = norms.map((x, k) => (wakeAll[k] ? x.slice(wakeAll[k][0].length) : x));
        if (!list[i]) { armedUntil = Date.now() + 10000; sink({ tx: "أسمعك…", out: lang === "fr-FR" ? "Je vous écoute." : "تفضّل، قل الأمر." }); speak(lang === "fr-FR" ? "Je vous écoute" : "تفضّل", lang === "fr-FR"); return; }
        list = list.map(x => x || list[i]);
      } else if (Date.now() < armedUntil) { /* ما زال مسلَّحاً بعد النداء */ }
      else return;
      armedUntil = 0;
    }
    const d = dataNow(); let best = null;
    for (const a of list) { const r = parse(a, d); if (r.kind !== "unknown") { best = r; break; } if (!best) best = r; }
    if (!opt.typed) mirrorUser(list[0]);
    run(best, list[0]);
  }
  function run(r, heardText) {
    const nt = norm(heardText || ""), fr = /[a-z]{3,}/.test(nt) && !/[ء-ي]/.test(nt);
    if (r.kind === "stop") { sink({ out: "" }); return; }
    if (r.kind === "help") { showHud({ out: r.say }); hud.classList.add("help"); speak(r.say, fr); return; }
    if (r.kind === "ask") {
      sink({ out: "أسأل مساعد اللوحة…" });
      try { if (AH()) { AH().show().then(() => AH().ask(r.q)); } } catch (e) { }
      return;
    }
    if (r.kind === "need") {
      pending = r; clearTimeout(pendingT); pendingT = setTimeout(() => { pending = null; }, 30000);
      sink({ out: r.say, buttons: [["إلغاء", () => { pending = null; sink({ out: "تم الإلغاء." }); }, "no"]] }); speak(r.say, fr); return;
    }
    if (r.kind === "negated") { sink({ out: r.say }); speak(r.say, fr); return; }
    if (r.kind === "choose") {
      pending = r; clearTimeout(pendingT); pendingT = setTimeout(() => { pending = null; }, 30000);
      sink({ out: r.say, buttons: optBtns(r.options) }); speak(r.say, fr); return;
    }
    if (r.confirm) {
      pending = r; clearTimeout(pendingT); pendingT = setTimeout(() => { pending = null; }, 20000);
      sink({ out: r.say, buttons: [["نعم", () => confirmPending(true), "ok"], ["لا", () => confirmPending(false), "no"]] }); speak(r.say, fr); return;
    }
    if (r.kind === "unknown") { sink({ out: r.say, err: true }); speak(r.say, fr); return; }
    const ok = exec(r.act);
    if (ok && r.act && r.act.slug) lastSlug = r.act.slug;
    sink({ out: ok ? r.say : "هذا القسم غير متاح في لوحتك.", err: !ok }); if (ok) speak(r.say, fr);
  }
  const optBtns = opts => opts.map((o, i) => [(i + 1) + "- " + o.label, () => chooseOpt(i), i === 0 ? "ok" : ""]);
  function chooseOpt(i) {
    const p = pending; if (!p || !p.options || !p.options[i]) return; pending = null; clearTimeout(pendingT);
    const o = p.options[i];
    if (o.text) { handle([o.text], { typed: true }); return; }
    const ok = exec(o.act);
    let out = ok ? "أفتح " + o.label + "." : "هذا القسم غير متاح في لوحتك.";
    if (ok && o.act.type === "kb" && o.act.ans) out += "\n" + o.act.ans.replace(/\*\*|`/g, "").split(/\n/)[0].slice(0, 220);
    sink({ out, err: !ok }); if (ok) speak("أفتح " + o.label, false);
  }
  function confirmPending(yes) {
    const p = pending; pending = null; clearTimeout(pendingT); if (!p) return;
    if (!yes) { sink({ out: "تم الإلغاء." }); return; }
    const ok = exec(p.act); if (ok && p.act && p.act.slug) lastSlug = p.act.slug;
    sink({ out: ok ? "تم." : "تعذّر التنفيذ.", err: !ok }); if (ok) speak("تم", false);
  }
  /* أمر مكتوب في محادثة «اسألني»: ينفَّذ إن كان أمراً مفهوماً، وإلا يبقى سؤالاً لقاعدة المعرفة */
  const TYPED_OK = new Set(["nav", "orders", "answer", "newProduct", "editProduct", "theme", "update", "site", "search", "stockChange", "priceChange", "visibility", "discount", "need", "negated"]);
  function tryCommand(q) {
    if (pending) { handle([q], { typed: true }); return true; }
    const r = parse(q, dataNow()); if (!TYPED_OK.has(r.kind)) return false;
    run(r, q); return true;
  }

  function init() {
    const saved = LS("alyssum_voice_lang"); if (saved === "fr-FR" || saved === "ar-DZ") lang = saved;
    loadKB(); loadLex(); loadStoreName();
    let tries = 0; const tick = () => { paintMic(); if (!$h("ah-mic") && tries++ < 40) setTimeout(tick, 500); }; tick();
    if (LS("alyssum_voice_mic") === "1" && SR) setTimeout(() => { if (!micOn) { micOn = true; startRec(); paintMic(); } }, 1500);   /* يستأنف إن كان الإذن ممنوحاً سابقاً */
    document.addEventListener("keydown", e => { if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "v" || e.key === "V" || e.key === "م")) { e.preventDefault(); toggleMic(); } });
  }
  if (typeof document !== "undefined" && typeof window !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init(); }
  const api = { calibrate, resetWake, wakeNames, _rx: () => ({ V_INC, V_ADD, V_DEC, V_SET, V_CHANGE, V_EDIT, V_HIDE, V_SHOWON, V_DEL, W_PIECE, W_STOCK, W_PRICE, W_DISC, W_THIS, W_PRODUCT }), parse, pickOption, fillSlot, findCands, numberIn, norm, useLexicon, handle, tryCommand, toggleMic, micStart, micOff, paint: paintMic, isMic: () => micOn, HELP_TXT, matchProduct, phoneOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  return api;
})();
