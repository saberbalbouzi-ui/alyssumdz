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
  const BASE = {"V_OPEN": ["افتح", "فتح", "افتحلي", "حل", "حلي", "حللي", "اذهب", "اذهبي", "روح", "رح", "خذني", "وريني", "ورني", "ورلي", "وريلي", "وري", "اعرض", "اعرضلي", "عرض", "شوف", "شوفلي", "انتقل", "جيبلي", "جيب", "ouvre", "ouvrir", "ouvres", "va", "aller", "montre", "montrer", "affiche", "afficher", "voir", "open", "show", "go"], "V_ADD": ["add", "ajoute", "ajouter", "create", "cree", "creer", "importer", "insere", "inserer", "new", "nouveau", "nouvelle", "rajoute", "اصنع", "اضافه", "اضف", "اعمل", "انشئ", "حط", "حطلو", "حطلي", "دير", "ديرلي", "زيد", "زيدلي", "سوي", "ضيف", "ضيفلو", "ضيفلي", "نزيد", "نزيدلو", "نضيف"], "V_EDIT": ["عدل", "عدلي", "تعديل", "غير", "modifie", "modifier", "edit", "editer"], "V_CHANGE": ["غير", "بدل", "بدلي", "تبديل", "حول", "change", "changer", "passe", "passer", "bascule", "basculer", "mets", "met", "switch", "toggle"], "V_SEARCH": ["ابحث", "ابحثلي", "دور", "دورلي", "لوج", "لوجلي", "فتش", "cherche", "chercher", "recherche", "rechercher", "trouve", "trouver", "find", "search"], "V_UPDATE": ["حدث", "حدثي", "update", "actualise", "actualiser", "rafraichis", "mise a jour", "رفرش", "refresh"], "W_PRODUCTS": ["منتجات", "produits", "products"], "W_PRODUCT": ["article", "product", "produit", "برودوي", "برودي", "بروديه", "بروديي", "سلعا", "سلعه", "منتج", "منتجا", "منتجي", "منتوج", "منتوجا", "منتوجي"], "W_ORDER": ["commande", "commandes", "order", "orders", "طلب", "طلبات", "طلبيات", "طلبيه", "كوموند", "كوموندا", "كوموندات"], "W_CLIENT": ["client", "clients", "customer", "customers", "زبائن", "زبون", "عملاء", "عميل"], "W_STOCK": ["مخزون", "ستوك", "stock", "كميه", "كميات"], "COUNT_Q": ["كم", "كام", "قداش", "قديش", "شحال", "combien", "how many", "how much"], "WHAT_Q": ["ما", "ماهي", "ماهو", "واش", "شنو", "what", "quel", "quelle", "quels", "quelles", "c est quoi"], "W_REV": ["مبيعات", "مبيعاتي", "بيع", "بعت", "بعنا", "مداخيل", "مدخول", "دخل", "ايرادات", "ايراد", "ربح", "ارباح", "chiffre d affaires", "ventes", "vente", "revenu", "revenus", "sales", "revenue"], "W_LAST": ["اخر", "اخير", "اخرها", "dernier", "derniere", "last", "latest"], "P_TODAY": ["اليوم", "ليوم", "هاد اليوم", "aujourd hui", "today"], "P_YEST": ["امس", "البارح", "البارحه", "hier", "yesterday"], "P_WEEK": ["الاسبوع", "اسبوع", "semaine", "week", "7 ايام", "سبعه ايام"], "P_MONTH": ["الشهر", "شهر", "mois", "month", "30 يوم"], "S_OUT": ["نفد", "نفدت", "نفذ", "نفذت", "خلص", "خلصت", "سالا", "سالات", "ساليا", "سال", "منتهي", "انتهت", "انتهى", "rupture", "epuise", "epuisee", "epuises", "out of stock", "نقص"], "S_LOW": ["ناقص", "ناقصه", "منخفض", "منخفضه", "قليل", "قليله", "bas", "basse", "low", "يخلصو", "يخلص", "راهم يخلصو", "يوفي", "يوفى", "ينفد", "ينفذ", "bientot epuise"], "W_THEME": ["المظهر", "مظهر", "الوضع", "وضع", "ثيم", "theme", "mode", "dark", "sombre", "clair", "light", "الضو"], "T_DARK": ["داكن", "ليلي", "الليل", "ليل", "sombre", "dark", "noir", "اسود"], "T_LIGHT": ["فاتح", "نهاري", "النهار", "نهار", "clair", "light", "blanc", "ابيض"], "W_PANEL": ["اللوحه", "لوحه", "النسخه", "نسخه", "التحديث", "تحديث", "الصفحه", "page", "tableau", "panneau", "version", "panel"], "W_SITE": ["الموقع", "موقعي", "المتجر", "متجري", "site", "boutique", "magasin", "storefront"], "Q_START": ["كيف", "كيفاش", "كيفاه", "وين", "فين", "ماذا", "شنو", "واش", "لماذا", "علاش", "ليش", "اشرح", "اشرحلي", "علمني", "فسر", "comment", "pourquoi", "explique", "expliquer", "how", "what", "why", "c est quoi", "qu est ce que", "ou est", "ou se trouve"], "HELP": ["اوامر", "الاوامر", "ماذا اقول", "ما اقول", "واش نقول", "شنو نقول", "شنو نقدر", "واش نقدر", "مساعده", "aide", "aidez moi", "help", "commandes vocales", "que puis je dire", "que dire"], "STOP": ["الغاء", "الغي", "الغيه", "توقف", "وقف", "بطل", "خلاص", "annule", "annuler", "stop", "arrete", "tais toi", "cancel", "laisse tomber"], "YES": ["نعم", "ايوه", "ايه", "اي", "واه", "اكيد", "تمام", "موافق", "نفذ", "نفذها", "oui", "ok", "okay", "d accord", "yes", "confirme", "vas y", "ouais", "wah"], "NO": ["لا", "لأ", "non", "no", "ماشي", "annule", "الغاء"], "V_INC": ["زيد", "زيدلي", "زيدلو", "زيدها", "ضيف", "ضيفلي", "ضيفلو", "اضف", "ارفع", "ارفعلي", "كبر", "نزيد", "نضيف", "augmente", "augmenter", "ajoute", "ajouter", "rajoute", "rajouter", "monte", "majore", "increase", "add", "plus"], "V_DEC": ["نقص", "نقصلي", "نقصه", "نقصها", "نقصلو", "انقص", "نحي شويه", "حيد شويه", "هبط", "هبطلي", "قلل", "قللي", "baisse", "baisser", "diminue", "diminuer", "reduis", "reduire", "enleve un peu", "decrease", "lower", "moins"], "V_SET": ["خلي", "خليه", "خليها", "خلي", "ديرها", "ديرله", "ضع", "اجعل", "اجعله", "حط", "حطه", "حطها", "بدل", "بدلها", "بدله", "غير", "غيرها", "غيره", "عدل", "صحح", "fixe", "fixer", "definis", "definir", "mets", "mettre", "modifie", "modifier", "change", "changer", "passe", "set"], "V_HIDE": ["خبي", "خبيه", "خبيها", "اخف", "اخفي", "اخفه", "cache", "cacher", "masque", "masquer", "desactive", "desactiver", "hide", "عطل", "طفي", "طفيه"], "V_SHOWON": ["رجع", "رجعه", "رجعلي", "ارجع", "اظهر", "اظهره", "فعل", "فعله", "شغل", "شغله", "reactive", "reactiver", "active", "activer", "remets", "remettre", "republie", "republier"], "V_DEL": ["نحي", "نحيه", "نحيها", "نحيهالي", "نحيلي", "حيد", "حيده", "حيدها", "امسح", "امسحه", "امسحها", "احذف", "احذفه", "احذفها", "فسخ", "فسخه", "ارمي", "supprime", "supprimer", "efface", "effacer", "enleve", "enlever", "retire", "retirer", "delete", "remove"], "W_DISC": ["تخفيض", "تخفيضات", "خصم", "remise", "reduction", "promo", "promotion", "soldes", "solde", "discount", "ريدوكسيون", "بروموسيون"], "W_PRICE": ["سعر", "اسعار", "ثمن", "prix", "price", "tarif"], "W_PIECE": ["حبه", "حبات", "وحده", "وحدات", "قطعه", "قطع", "piece", "pieces", "pcs", "unite", "unites", "units", "unit"], "U_PCT": ["بالميه", "بالمايه", "بالمائه", "بالمئه", "في الميه", "في المايه", "فالميه", "pourcent", "pour cent", "pourcentage", "percent", "pct"], "U_CUR": ["دينار", "دنانير", "دج", "دينارا", "da", "dzd", "dinar", "dinars"], "W_THIS": ["هذا", "هذه", "هذي", "هاذا", "هاذي", "هاذ", "هذاك", "هذوك", "هادا", "هادي", "هاد", "ce", "cet", "cette", "celui ci", "celle ci", "ceci", "cela", "this", "نفسه", "نفس المنتوج"], "W_VAGUE": ["بزاف", "برشه", "كثير", "كثيره", "شويه", "شوي", "قليل", "ضاعف", "نصف", "نصفه", "double"], "W_ALLP": ["كامل", "كاملين", "قاع", "كلشي", "كل", "الكل", "جميع", "كل منتج", "tous", "toutes", "tout", "all"], "W_NEWW": ["جديد", "جديده", "اخر", "اخرى", "ثاني", "ثانيه", "nouveau", "nouvelle", "autre", "another", "new"], "W_SHOPW": ["بوتيك", "البوتيك", "متجر", "المتجر", "boutique", "magasin", "shop", "store", "الواجهه", "الموقع"], "REMAIN": ["بقالنا", "بقى", "بقي", "باقي", "باقيه", "بقات", "reste", "restant", "restants", "rest"], "COUNT_N": ["عدد", "مجموع", "اجمالي", "كميه", "nombre", "nb", "total"], "W_AVG": ["متوسط", "معدل", "moyenne", "average", "avg"], "W_TOPQ": ["اكثر", "افضل", "اعلي", "اكبر", "الاول", "meilleur", "meilleurs", "top", "plus vendu"], "W_WILAYA": ["ولايه", "ولايات", "wilaya", "wilayas"], "W_RATE": ["نسبه", "معدل", "taux", "percentage"], "W_CANCEL": ["الغاء", "ملغاه", "ملغي", "ملغيه", "فشل", "annulation", "annule", "annulees", "echec"], "COMPARE": ["قارن", "مقارنه", "قارنها", "قارنه", "مقابل", "compare", "comparer", "versus"], "A_STATUS": ["etat", "statut", "حالت", "حاله", "وضع", "وضعيه"], "A_CUST": ["زبون", "عميل", "اسم", "client", "nom", "شكون"], "A_PHONE": ["portable", "tel", "telephone", "رقم", "رقمه", "رقمها", "هاتف"], "A_ADDR": ["adresse", "commune", "wilaya", "بلديت", "عنوان", "مدينت", "مكان", "ولايت", "ولايه"], "A_TOTAL": ["مبلغ", "قيمه", "montant", "total", "ثمن"], "A_ITEMS": ["منتجات", "تفاصيل", "محتوي", "produits", "articles", "شنو شري"], "V_CONFIRM": ["اكد", "اكده", "اكدها", "اكدلي", "اكدلو", "confirme", "confirmer", "valide", "valider", "confirm"], "V_CANCEL": ["الغ", "الغي", "الغه", "الغها", "annule", "annuler", "cancel"], "V_SEND": ["ارسل", "ارسله", "ارسلها", "ابعث", "ابعثه", "ابعتو", "ابعتلو", "envoie", "envoyer", "expedie", "expedier", "send"], "W_DELIVERY": ["شركه التوصيل", "للتوصيل", "التوصيل", "شركه الشحن", "للشحن", "livraison", "livreur", "transporteur", "yalidine", "ياليدين", "courier"], "W_STATUSW": ["حاله", "وضع", "الحاله", "statut", "status", "etat"]};
  let A_ADDR, A_CUST, A_ITEMS, A_PHONE, A_STATUS, A_TOTAL, COMPARE, COUNT_N, COUNT_Q, HELP, NO, P_MONTH, P_TODAY, P_WEEK, P_YEST, Q_START, REMAIN, STOP, S_LOW, S_OUT, T_DARK, T_LIGHT, U_CUR, U_PCT, V_ADD, V_CANCEL, V_CHANGE, V_CONFIRM, V_DEC, V_DEL, V_EDIT, V_HIDE, V_INC, V_OPEN, V_SEARCH, V_SEND, V_SET, V_SHOWON, V_UPDATE, WHAT_Q, W_ALLP, W_AVG, W_CANCEL, W_CLIENT, W_DELIVERY, W_DISC, W_LAST, W_NEWW, W_ORDER, W_PANEL, W_PIECE, W_PRICE, W_PRODUCT, W_PRODUCTS, W_RATE, W_REV, W_SHOPW, W_SITE, W_STATUSW, W_STOCK, W_THEME, W_THIS, W_TOPQ, W_VAGUE, W_WILAYA, YES;
  function buildRx(extra) {
    const W = k => (BASE[k] || []).concat((extra && extra[k]) || []);
    A_ADDR = re(W("A_ADDR"));
    A_CUST = re(W("A_CUST"));
    A_ITEMS = re(W("A_ITEMS"));
    A_PHONE = re(W("A_PHONE"));
    A_STATUS = re(W("A_STATUS"));
    A_TOTAL = re(W("A_TOTAL"));
    COMPARE = re(W("COMPARE"));
    COUNT_N = re(W("COUNT_N"));
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
    V_CANCEL = re(W("V_CANCEL"));
    V_CHANGE = re(W("V_CHANGE"));
    V_CONFIRM = re(W("V_CONFIRM"));
    V_DEC = re(W("V_DEC"));
    V_DEL = re(W("V_DEL"));
    V_EDIT = re(W("V_EDIT"));
    V_HIDE = re(W("V_HIDE"));
    V_INC = re(W("V_INC"));
    V_OPEN = re(W("V_OPEN"));
    V_SEARCH = re(W("V_SEARCH"));
    V_SEND = re(W("V_SEND"));
    V_SET = re(W("V_SET"));
    V_SHOWON = re(W("V_SHOWON"));
    V_UPDATE = re(W("V_UPDATE"));
    WHAT_Q = re(W("WHAT_Q"));
    W_ALLP = re(W("W_ALLP"));
    W_AVG = re(W("W_AVG"));
    W_CANCEL = re(W("W_CANCEL"));
    W_CLIENT = re(W("W_CLIENT"));
    W_DELIVERY = re(W("W_DELIVERY"));
    W_DISC = re(W("W_DISC"));
    W_LAST = re(W("W_LAST"));
    W_NEWW = re(W("W_NEWW"));
    W_ORDER = re(W("W_ORDER"));
    W_PANEL = re(W("W_PANEL"));
    W_PIECE = re(W("W_PIECE"));
    W_PRICE = re(W("W_PRICE"));
    W_PRODUCT = re(W("W_PRODUCT"));
    W_PRODUCTS = re(W("W_PRODUCTS"));
    W_RATE = re(W("W_RATE"));
    W_REV = re(W("W_REV"));
    W_SHOPW = re(W("W_SHOPW"));
    W_SITE = re(W("W_SITE"));
    W_STATUSW = re(W("W_STATUSW"));
    W_STOCK = re(W("W_STOCK"));
    W_THEME = re(W("W_THEME"));
    W_THIS = re(W("W_THIS"));
    W_TOPQ = re(W("W_TOPQ"));
    W_VAGUE = re(W("W_VAGUE"));
    W_WILAYA = re(W("W_WILAYA"));
    YES = re(W("YES"));
  }
  buildRx(null);

  /* دمج قاموس JSON (assets/data/voice-lexicon.json) مع المفردات الأساسية */
  const LEXMAP = { "verbs.add": "V_ADD", "verbs.increase": "V_INC", "verbs.decrease": "V_DEC", "verbs.set": "V_SET", "verbs.hide": "V_HIDE", "verbs.show": "V_SHOWON", "verbs.delete": "V_DEL", "verbs.open": "V_OPEN", "verbs.search": "V_SEARCH", "verbs.edit": "V_EDIT", "verbs.update": "V_UPDATE", "verbs.confirm": "V_CONFIRM", "verbs.cancel": "V_CANCEL", "verbs.send": "V_SEND",
    "objects.product": "W_PRODUCT", "objects.products": "W_PRODUCTS", "objects.order": "W_ORDER", "objects.customer": "W_CLIENT", "objects.stock": "W_STOCK", "objects.price": "W_PRICE", "objects.discount": "W_DISC", "objects.shop": "W_SHOPW",
    "units.piece": "W_PIECE", "units.percent": "U_PCT", "units.currency": "U_CUR", "pointers.this": "W_THIS", "quantity.vague": "W_VAGUE", "quantity.all": "W_ALLP", "modifiers.new": "W_NEWW", "confirm.yes": "YES", "control.stop": "STOP", "control.help": "HELP" };
  let TTS_LEX = null;
  function useLexicon(lex) {
    if (!lex) return; const extra = {}; TTS_LEX = lex;
    Object.keys(LEXMAP).forEach(path => { const [a, b] = path.split("."), w = lex[a] && lex[a][b] && lex[a][b].words; if (Array.isArray(w)) extra[LEXMAP[path]] = w.filter(x => typeof x === "string" && x.trim()); });
    buildRx(extra);
    if (lex.ui && lex.ui.aliases && typeof lex.ui.aliases === "object") Object.keys(lex.ui.aliases).forEach(k => { const v = lex.ui.aliases[k]; if (Array.isArray(v)) UI_ALIAS[fold(k)] = v.map(fold); });
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
    callcenter: ["مركز الاتصال", "مركز الاتصالات", "التاكيد", "تاكيد الطلبات", "centre d appel", "call center"],
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
  const TAB_LABEL = { callcenter: "مركز الاتصال", pb: "مطوّر الصفحات (المحرّر)", home: "لوحة التحكم", orders: "الطلبات", shipped: "الطلبات المسجلة", repeat: "إعادة الشراء", setup: "تجهيز المتجر", finance: "المخزون والأرباح", analytics: "التحليلات", products: "المنتجات", social: "السوشيال والإعلانات", inventory: "المخزون", bulkp: "التعديل الجماعي", reports: "التقارير", audit: "فحص المنتجات", returns: "المرتجعات", payments: "المدفوعات", seo: "SEO", blog: "المدوّنة والسياسات", builder: "مطوّر الصفحات", smart: "المطوّر الذكي", voice: "الوكيل الناطق", ask: "اسألني", cloner: "ناسخ القوالب", floaters: "الأيقونات العائمة", imgtools: "أدوات الصور", imggen: "مولّد الصور", agent: "الوكيل الذكي", attributes: "السمات", categories: "التصنيفات", fees: "رسوم التوصيل", delivery: "شركات التوصيل", coupons: "أكواد الخصم", blacklist: "القائمة السوداء", loyalty: "الزبائن الأوفياء", customers: "العملاء", admtheme: "مظهر لوحة التحكم", theme: "مظهر الموقع", chromeh: "الهيدر", chromef: "الفوتر", checkout: "نموذج الطلب", pixels: "البكسلات", store: "إعدادات الموقع", pending: "بانتظار التأكيد" };

  /* حالات الطلب (القيم كما في مرشّح الطلبات) */
  const STATUS = [
    ["nouvelle", "في انتظار التأكيد", re(["جديد", "جديده", "جدد", "جداد", "انتظار", "نوفال", "nouvelle", "nouvelles", "nouveau", "nouveaux", "new", "pending", "بانتظار", "غير مؤكد", "غير مؤكده"])],
    ["confirmee", "المؤكَّدة", re(["موكد", "موكده", "ماكد", "ماكده", "confirme", "confirmee", "confirmees", "confirmed"])],
    ["annulee", "الملغاة", re(["ملغي", "ملغيه", "ملغاه", "ملغاة", "ملغات", "الغيت", "annule", "annulee", "annulees", "cancelled", "canceled"])],
    ["livree", "المسلَّمة", re(["مسلم", "مسلمه", "تم التسليم", "سلمت", "وصلت", "تسلم", "تسلمت", "اتسلم", "استلم", "استلمه", "livre", "livree", "livrees", "delivered"])],
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


  /* أوامر عناصر اللوحة: عبارات + أنماط (نقية، تُستعمل في parse) */
  const UI_CLICK = ["اضغط", "اضغطلي", "انقر", "انقرلي", "كليكي", "كليك", "click", "clique", "cliquer", "appuie", "appuyer", "presse"];
  const UI_WHERE = ["وين", "فين", "اين", "اريني", "وريني وين", "ou est", "ou se trouve", "where", "montre moi ou"];
  const UI_TYPE_RX = /^(?:اكتب|ادخل|دخل|tape|ecris|saisis|type)\s+(.+?)\s+(?:في|فى|داخل|dans|in)\s+(.+)$/;
  let UIRX = null; const uiRegex = () => UIRX || (UIRX = { click: re(UI_CLICK), where: re(UI_WHERE) });

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
    return ws.filter(w => ![V_INC, V_DEC, V_SET, V_HIDE, V_SHOWON, V_DEL, V_ADD, V_OPEN, V_EDIT, V_CHANGE, W_DISC, W_PRICE, W_PIECE, U_PCT, U_CUR, W_THIS, W_VAGUE, W_PRODUCT, W_STOCK, W_SHOPW, W_NEWW, COUNT_Q, WHAT_Q, COUNT_N, REMAIN, A_STATUS, A_CUST, A_PHONE, A_ADDR, A_TOTAL, A_ITEMS].some(r => r.test(" " + w + " "))).join(" ");
  };
  const pName = p => p.title.replace(/\s*[-–]\s*\d+\s*غ?$/, "");
  /* سؤال لإكمال معلومة ناقصة */
  const need = (slot, partial, say, chips) => ({ kind: "need", slot, partial, say, chips });
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
    if (slot === "flow") return flowAnswer(partial, raw, data, L);
    if (has(STOP, t) || has(NO, t)) return { kind: "stop", say: "" };
    const pt = Object.assign({}, partial);
    if (slot === "order") {
      const prefer = partial.op === "confirm" ? ["nouvelle"] : partial.op === "send" ? ["confirmee"] : null, list = findOrders(t, data.orders || [], prefer);
      if (!list.length) return need("order", partial, L("لم أجد هذا الطلب. قل اسم الزبون أو رقم هاتفه.", "Je n'ai pas trouvé cette commande."));
      if (list.length > 1) return { kind: "choose", single: false, say: L("وجدت عدة طلبات، أيها تقصد؟ " + list.slice(0, 4).map((o, i) => (i + 1) + "- " + oDesc(o)).join("، "), "Laquelle ?"), options: list.slice(0, 4).map(o => ({ label: oDesc(o), text: ({ send: "ارسل", cancel: "الغ", confirm: "اكد", status: "علم" })[partial.op] + " طلب " + (o.phone || o.id) + (partial.op === "status" ? " " + (STATUS.find(s => s[0] === partial.status) || [])[2] : "") })) };
      return mkOrderCmd(list[0], partial.op, partial.status, L);
    }
    if (slot === "pbname") {
      const name = String(raw || "").replace(/\s+/g, " ").trim().slice(0, 80); if (!name) return need("pbname", partial, L("ما عنوان الصفحة الجديدة؟", "Quel titre ?"));
      return { kind: "builder", say: L("أنشئ صفحة جديدة «" + name + "».", "Je crée la page."), confirm: false, act: { type: "pb", op: "newPage", title: name } };
    }
    if (slot === "product") {
      let p = null;
      if (has(W_THIS, t) && refSlug(data)) p = (data.products || []).find(x => x.slug === refSlug(data));
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
    const ent = numberIn(t), num = ent ? ent.value : null, pct = has(U_PCT, t) || /%/.test(raw), ctxSlug = refSlug(data);
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


  /* ── الضمائر الغائبة: «سعره/مخزونها/أخفِه/ديالو/son prix» تُفكَّك إلى (الكلمة + «هذا») فتُربط بآخر منتج/طلب مذكور ── */
  const PRON_BASES = new Set(["علم", "ارسل", "ابعث", "سعر", "مخزون", "كميه", "كميت", "صور", "صوره", "صورت", "وصف", "تخفيض", "اسم", "حاله", "حالت", "زبون", "عنوان", "هاتف", "مبلغ", "تفاصيل", "منتجات", "ولايت", "بلديت", "مدينت", "رقم", "اخف", "نقص", "زيد", "غير", "بدل", "عدل", "احذف", "امسح", "اظهر", "فعل", "اكد", "الغ", "الغي", "ارسل", "افتح", "اعرض", "وريني", "رجع", "قارن", "حول", "حدث", "شوف", "خبي", "طفي", "شغل", "اعد", "ثمن", "قيمت", "قيمه"]);
  const PRON_ALONE = new Set(["ديالو", "ديالها", "ديالهم", "تاعو", "تاعها", "تاعهم", "منو", "منها", "عليه", "عليها", "فيه", "فيها", "عنه", "عنها", "له", "لها", "لهم", "ذلك", "تلك", "ذاك", "son", "sa", "ses", "lui", "il", "elle", "celui", "celle"]);
  const WHATW = new Set(["ما", "ماذا", "ماهو", "ماهي", "شنو", "واش", "اش"]);
  function splitPron(t) {
    const ws = t.split(" "), out = [];
    ws.forEach((w, i) => {
      if (PRON_ALONE.has(w)) { out.push("هذا"); return; }
      if ((w === "هو" || w === "هي") && i > 0 && !WHATW.has(ws[i - 1])) { out.push("هذا"); return; }
      for (const s of ["ها", "هم", "ه"]) if (w.length > s.length + 2 && w.endsWith(s)) { const b = w.slice(0, -s.length), b2 = b.replace(/^(?:ال|و|ف)/, ""); if (PRON_BASES.has(b) || PRON_BASES.has(b2)) { out.push(b, "هذا"); return; } }
      out.push(w);
    });
    return out.join(" ");
  }
  /* ── تحليلات سريعة (نقية) ── */
  const itemsOf = o => String(o.items || "").split(/\n/).map(l => { const m = /^(.+?)\s*×\s*(\d+)\s*=/.exec(l); return m ? { title: m[1].trim(), qty: Number(m[2]) } : null; }).filter(Boolean);
  const valid = o => !["annulee", "echec"].includes(o.status);
  function topCount(list, keyFn, n) { const c = new Map(); list.forEach(x => keyFn(x).forEach(([k, v]) => c.set(k, (c.get(k) || 0) + v))); return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n || 3); }
  function numAnswer(k, per, st, orders, L) {
    const list = orders.filter(o => inPeriod(o, per) && (!st || o.status === st));
    if (k === "rev") { const sum = list.filter(valid).reduce((s, o) => s + (Number(o.total) || 0), 0); return { kind: "answer", topic: { k, per }, say: L("المبيعات " + PERIOD_AR[per || ""] + ": " + fmtN(sum) + " دينار.", "Ventes " + PERIOD_FR[per || ""] + " : " + fmtN(sum) + " DA.") }; }
    const sname = st ? (STATUS.find(s => s[0] === st) || [])[1] : "";
    return { kind: "answer", topic: { k: "ord", per, st }, say: L("عدد الطلبات" + (sname ? " " + sname : "") + " " + PERIOD_AR[per || ""] + ": " + list.length + ".", "Commandes" + (st ? " (" + st + ")" : "") + " " + PERIOD_FR[per || ""] + " : " + list.length + ".") };
  }
  const EXAMPLES_Q = ["كم عدد الطلبات اليوم؟", "كم المبيعات هذا الشهر؟", "ما أكثر منتج مبيعاً؟", "ما أكثر ولاية طلباً؟", "شنو نفد من المنتجات؟", "ما متوسط قيمة الطلب؟"];
  function analyticsAnswer(t, data, L) {
    const orders = data.orders || [], per = periodOf(t), inP = orders.filter(o => inPeriod(o, per)), PA = PERIOD_AR[per || ""], PF = PERIOD_FR[per || ""];
    if (has(W_TOPQ, t) && (has(W_PRODUCT, t) || has(W_PRODUCTS, t))) {
      const top = topCount(inP.filter(valid), o => itemsOf(o).map(i => [i.title, i.qty]), 3);
      return { kind: "answer", topic: { k: "topp", per }, say: top.length ? L("الأكثر مبيعاً " + PA + ": " + top.map(x => x[0] + " (" + x[1] + ")").join("، ") + ".", "Top ventes " + PF + " : " + top.map(x => x[0] + " (" + x[1] + ")").join(", ") + ".") : L("لا توجد مبيعات " + PA + ".", "Aucune vente.") };
    }
    if (has(W_TOPQ, t) && has(W_WILAYA, t)) {
      const top = topCount(inP, o => [[o.wilaya || "—", 1]], 3);
      return { kind: "answer", topic: { k: "topw", per }, say: top.length ? L("أكثر الولايات طلباً " + PA + ": " + top.map(x => x[0] + " (" + x[1] + ")").join("، ") + ".", "Top wilayas " + PF + " : " + top.map(x => x[0] + " (" + x[1] + ")").join(", ") + ".") : L("لا توجد طلبات.", "Aucune commande.") };
    }
    if (has(W_AVG, t) && (has(W_ORDER, t) || has(W_REV, t) || /قيمه|valeur|montant/.test(t))) {
      const v = inP.filter(valid), avg = v.length ? v.reduce((s, o) => s + (Number(o.total) || 0), 0) / v.length : 0;
      return { kind: "answer", topic: { k: "avg", per }, say: L("متوسط قيمة الطلب " + PA + ": " + fmtN(avg) + " دينار (من " + v.length + " طلب).", "Panier moyen " + PF + " : " + fmtN(avg) + " DA.") };
    }
    if (has(W_RATE, t) && has(W_CANCEL, t)) {
      const n = inP.length, c = inP.filter(o => !valid(o)).length;
      return { kind: "answer", topic: { k: "rate", per }, say: L("نسبة الإلغاء والفشل " + PA + ": " + (n ? Math.round(c * 100 / n) : 0) + "% (" + c + " من " + n + ").", "Taux d'annulation " + PF + " : " + (n ? Math.round(c * 100 / n) : 0) + "%.") };
    }
    if (has(W_CLIENT, t) && (has(COUNT_Q, t) || has(COUNT_N, t))) {
      const ph = new Set(inP.map(o => String(o.phone || "").replace(/\D/g, "")).filter(Boolean));
      return { kind: "answer", topic: { k: "cust", per }, say: L("عدد الزبائن " + PA + ": " + ph.size + ".", "Clients " + PF + " : " + ph.size + ".") };
    }
    return null;
  }
  /* متابعة قصيرة تعتمد على آخر سؤال: «وأمس؟» «والمؤكدة؟» «والمبيعات؟» «قارنها بأمس» «ماهي؟» */
  function followUp(t, data, L) {
    const last = data.mem && data.mem.topic, verbs = [V_OPEN, V_INC, V_DEC, V_SET, V_HIDE, V_SHOWON, V_DEL, V_ADD, V_EDIT, V_CHANGE, V_SEARCH, V_UPDATE].some(r => r.test(t));
    if (verbs) return null;
    const rest = tokens(t).filter(w => !WHAT_Q.test(" " + w + " ") && !COUNT_Q.test(" " + w + " ") && !["عن", "عنه", "و", "هل", "ايضا", "كذلك"].includes(w));
    if (!rest.length && (has(WHAT_Q, t) || has(COUNT_Q, t))) return { kind: "choose", single: false, say: L("ماذا تريد أن تعرف بالضبط؟ اختر أو قل سؤالك:", "Que voulez-vous savoir ?"), options: EXAMPLES_Q.slice(0, 5).map(q => ({ label: q.replace(/؟$/, ""), text: q })) };
    if (!last || t.split(" ").length > 7) return null;
    const per = periodOf(t), st = statusOf(t), orders = data.orders || [], noun = has(W_ORDER, t) || has(W_REV, t) || has(W_PRODUCT, t) || has(W_PRODUCTS, t);
    if (has(COMPARE, t) && (last.k === "ord" || last.k === "rev")) {
      const a = last.per || "today", b = (per && per !== a) ? per : (a === "today" ? "yesterday" : "today");
      const A1 = numAnswer(last.k, a, last.st, orders, (x, f) => x), B1 = numAnswer(last.k, b, last.st, orders, (x, f) => x);
      const num = r => Number((/(\d[\d ]*)(?:\.| دينار)/.exec(String(r.say).replace(/\s(?=\d{3})/g, "")) || [0, 0])[1].toString().replace(/\s/g, ""));
      const x = num(A1), y = num(B1), d = y ? Math.round((x - y) * 100 / y) : null;
      return { kind: "answer", topic: last, say: L((last.k === "rev" ? "المبيعات" : "الطلبات") + ": " + PERIOD_AR[a] + " " + fmtN(x) + " مقابل " + PERIOD_AR[b] + " " + fmtN(y) + (d === null ? "" : " (" + (d >= 0 ? "+" : "") + d + "%)") + ".", "Comparaison : " + PERIOD_FR[a] + " " + fmtN(x) + " vs " + PERIOD_FR[b] + " " + fmtN(y) + ".") };
    }
    if (per && !noun && !st && (last.k === "ord" || last.k === "rev")) return numAnswer(last.k, per, last.st, orders, L);
    if (per && !noun && ["topp", "topw", "avg", "rate", "cust"].includes(last.k)) return analyticsAnswer(norm(({ topp: "اكثر منتج", topw: "اكثر ولايه", avg: "متوسط الطلب", rate: "نسبه الالغاء", cust: "كم زبون" })[last.k]) + " " + t, data, L);
    if (st && !has(W_REV, t)) return numAnswer("ord", per || last.per || "", st[0], orders, L);
    if (has(W_REV, t) && !has(W_ORDER, t) && t.split(" ").length <= 3) return numAnswer("rev", per || last.per || "", "", orders, L);
    return null;
  }
  /* أسئلة عن خصائص منتج/طلب مذكور سابقاً: «سعره؟» «مخزونها؟» «ما حالته؟» «من هو زبونه؟» */
  function attrAnswer(t, data, L) {
    const mem = data.mem || {}, products = data.products || [], ref = has(W_THIS, t), ctx = data.ctx && data.ctx.slug;
    const named = matchProduct(productRef(t, numberIn(t)), products);
    const slug = named ? named.slug : (ref ? (mem.kind === "order" ? "" : (ctx || mem.slug)) : "");
    const pAttrPrice = has(W_PRICE, t) && !has(A_TOTAL, t) || (has(A_TOTAL, t) && (named || mem.kind === "product" || (!mem.order)));
    if (slug && !([V_INC, V_DEC, V_SET].some(r => r.test(t))) && (has(W_PRICE, t) || has(W_STOCK, t) || has(REMAIN, t) || (has(A_STATUS, t) && !mem.order))) {
      const p = products.find(x => x.slug === slug); if (!p) return null; const q = pName(p), inf = data.stockInfo || (x => ({ tracked: x.stock != null, total: x.stock != null ? Number(x.stock) : null }));
      if (has(W_STOCK, t) || has(REMAIN, t)) { const s = inf(p); return { kind: "answer", mem: { slug, kind: "product" }, say: s.tracked && s.total != null ? L("مخزون «" + q + "»: " + s.total + " حبة.", "Stock de « " + q + " » : " + s.total + ".") : L("«" + q + "» بلا تتبع للمخزون.", "Stock non suivi.") }; }
      if (has(W_PRICE, t)) return { kind: "answer", mem: { slug, kind: "product" }, say: L("سعر «" + q + "»: " + fmtN(p.price) + " دينار" + (Number(p.old) > Number(p.price) ? " (بدل " + fmtN(p.old) + ")" : "") + ".", "Prix de « " + q + " » : " + fmtN(p.price) + " DA.") };
      return { kind: "answer", mem: { slug, kind: "product" }, say: L("«" + q + "» " + (p.active === false ? "مخفي عن المتجر." : "ظاهر في المتجر."), "« " + q + " » " + (p.active === false ? "masqué." : "visible.")) };
    }
    const o = mem.order;
    if (o && (ref || has(W_ORDER, t)) && !named) {
      const nm = o.name || "—", ph = o.phone || "—";
      if (has(A_STATUS, t)) { const s = STATUS.find(x => x[0] === o.status); return { kind: "answer", mem: { kind: "order" }, say: L("حالة طلب " + nm + ": " + (s ? s[1] : o.status || "—") + ".", "Statut de la commande de " + nm + " : " + (s ? s[1] : o.status) + ".") }; }
      if (has(A_PHONE, t)) return { kind: "answer", mem: { kind: "order" }, say: L("هاتف " + nm + ": " + ph + ".", "Téléphone de " + nm + " : " + ph + ".") };
      if (has(A_ADDR, t)) return { kind: "answer", mem: { kind: "order" }, say: L("ولاية " + nm + ": " + (o.wilaya || "—") + (o.commune ? " / " + o.commune : "") + ".", "Wilaya de " + nm + " : " + (o.wilaya || "—") + ".") };
      if (has(A_TOTAL, t) || has(W_PRICE, t)) return { kind: "answer", mem: { kind: "order" }, say: L("مبلغ طلب " + nm + ": " + fmtN(o.total) + " دينار.", "Montant de la commande de " + nm + " : " + fmtN(o.total) + " DA.") };
      if (has(A_ITEMS, t)) return { kind: "answer", mem: { kind: "order" }, say: L("منتجات طلب " + nm + ": " + (String(o.items || "—").replace(/\s*=\s*[\d ]+(?:DA|دج)?/g, "").split(/\n/).join("، ")) + ".", "Articles : " + String(o.items || "—").split(/\n/).join(", ") + ".") };
      if (has(A_CUST, t)) return { kind: "answer", mem: { kind: "order" }, say: L("الزبون: " + nm + " (" + ph + ").", "Client : " + nm + " (" + ph + ").") };
    }
    return null;
  }

  /* المنتج الذي تشير إليه الضمائر: المفتوح في اللوحة، وإلا آخر منتج في المحادثة */
  const refSlug = data => (data.ctx && data.ctx.slug) || (data.mem && data.mem.kind === "product" && data.mem.slug) || "";
  /* تحديث ذاكرة المحادثة من نتيجة أمر (نقي): آخر منتج/طلب/موضوع */
  function memUpdate(m, r) {
    const n = Object.assign({ slug: "", order: null, kind: "", topic: null }, m || {});
    if (!r || r.kind === "unknown" || r.kind === "stop") return n;
    if (r.topic) n.topic = r.topic;
    if (r.mem) { if (r.mem.slug) n.slug = r.mem.slug; if (r.mem.order) n.order = r.mem.order; if (r.mem.kind) n.kind = r.mem.kind; }
    if (r.act && r.act.slug) { n.slug = r.act.slug; n.kind = "product"; }
    return n;
  }


  /* ── أوامر الطلبات: تأكيد/إلغاء/تغيير حالة/إرسال لشركة التوصيل (بتأكيد دائماً، وبحراسة الحالات) ── */
  const money = o => fmtN(o.total) + " دج" + (o.wilaya ? " · " + o.wilaya : "");
  const oDesc = o => (o.name || "زبون") + " (" + money(o) + ")";
  const sameOrder = (a, b) => String(a.id) === String(b.id);
  /* يعثر على طلبات من: هاتف، رقم الطلب، «الأخير»، أو اسم الزبون (كلمات الاسم كلها موجودة) */
  function findOrders(t, orders, prefer) {
    const phone = phoneOf(t); let res = [];
    if (phone) res = orders.filter(o => String(o.phone || "").replace(/\D/g, "").endsWith(phone.replace(/^0/, "")) || String(o.phone || "").replace(/\D/g, "") === phone);
    if (!res.length) { const idm = /(?:طلب|commande|order|رقم|no|n)\s*(?:رقم)?\s*(\d{1,6})(?: |$)/.exec(t); if (idm) res = orders.filter(o => String(o.id) === idm[1]); }
    if (!res.length && /(?:^| )(?:الاخير|الاخيره|اخر|اخير|dernier|derniere|last)(?: |$)/.test(t)) { const s = orders.slice().sort((a, b) => new Date(b.date) - new Date(a.date)); if (s.length) res = [s[0]]; }
    if (!res.length) {
      const GEN2 = new Set(["لشركه", "توصيل", "للتوصيل", "للشحن", "شحن", "طلب", "طلبيه", "كوموند", "commande", "order", "زبون", "عميل", "client", "رقم", "تاع", "ديال", "de", "du", "الي", "اللي", "شركه", "التوصيل"]);
      const qs = tokens(t.replace(/(?:ل)?شركه (?:ال)?(?:توصيل|شحن)/g, " ")).map(stripAl).filter(w => w.length > 1 && !GEN2.has(w) && ![V_CONFIRM, V_CANCEL, V_SEND, V_SET, V_CHANGE, V_OPEN, V_EDIT, V_ADD].some(r => r.test(" " + w + " ")) && !STATUS.some(s => s[2].test(" " + w + " ")) && !W_THIS.test(" " + w + " ") && !W_DELIVERY.test(" " + w + " ") && !W_STATUSW.test(" " + w + " "));
      if (qs.length) res = orders.filter(o => { const ts = tokens(norm(o.name || "")).map(stripAl); return qs.every(w => ts.some(x => x === w || (w.length >= 3 && x.length >= 3 && (x.startsWith(w) || w.startsWith(x))))); });
    }
    if (prefer && res.length > 1) { const pr = res.filter(o => prefer.includes(o.status)); if (pr.length) res = pr; }
    return res;
  }
  /* يبني أمر الطلب مع فحص الحالة؛ confirm دائماً */
  function mkOrderCmd(o, op, status, L) {
    const d = oDesc(o), st = STATUS.find(s => s[0] === o.status), sn = st ? st[1] : o.status;
    const mem = { order: o, kind: "order" }, refuse = say => ({ kind: "answer", mem, say });
    const cmd = (say, extra) => ({ kind: "orderAction", confirm: true, mem, say, act: Object.assign({ type: "order", op, id: o.id, status, label: o.name || "", phone: o.phone || "", total: o.total }, extra || {}) });
    if (op === "confirm") {
      if (o.status === "confirmee") return refuse(L("طلب " + d + " مؤكَّد أصلاً.", "Déjà confirmée."));
      if (["annulee", "echec", "livree", "expediee"].includes(o.status)) return refuse(L("حالة طلب " + d + " «" + sn + "»؛ لا يمكن تأكيده.", "Statut « " + sn + " » : impossible de confirmer."));
      return cmd(L("سأؤكّد طلب " + d + ". أؤكد؟", "Confirmer la commande " + d + " ?"));
    }
    if (op === "cancel") {
      if (o.status === "annulee") return refuse(L("طلب " + d + " ملغى أصلاً.", "Déjà annulée."));
      if (o.status === "livree") return refuse(L("طلب " + d + " سُلِّم؛ لا يُلغى بل يُسجَّل كمرتجع من «المرتجعات».", "Commande livrée : utilisez les retours."));
      return cmd(L("سألغي طلب " + d + (o.status === "expediee" ? " — تنبيه: هو في الطريق وإلغاؤه لا يوقف الطرد عند الشركة تلقائياً" : "") + ". أؤكد الإلغاء؟", "Annuler la commande " + d + " ?"));
    }
    if (op === "send") {
      if (o.status !== "confirmee") return refuse(L("طلب " + d + " ليس مؤكَّداً (حالته «" + sn + "»)؛ أكّده أولاً ثم أرسله.", "Confirmez d'abord la commande."));
      return cmd(L("سأرسل طلب " + d + " إلى شركة التوصيل (ينشئ طرداً حقيقياً). أؤكد الإرسال؟", "Envoyer la commande " + d + " au livreur ?"));
    }
    if (op === "status") {
      if (o.status === status) return refuse(L("طلب " + d + " في هذه الحالة أصلاً.", "Déjà dans ce statut."));
      const nn = (STATUS.find(s => s[0] === status) || [])[1] || status;
      return cmd(L("سأغيّر حالة طلب " + d + " من «" + sn + "» إلى «" + nn + "». أؤكد؟", "Statut de " + d + " : " + sn + " → " + nn + ". Confirmer ?"));
    }
    return null;
  }
  function orderAction(t, data, L) {
    const conf = has(V_CONFIRM, t), canc = has(V_CANCEL, t), st = statusOf(t), ctxOrd = has(W_ORDER, t) || has(W_THIS, t) || has(W_STATUSW, t);
    const send = has(V_SEND, t) && (has(W_DELIVERY, t) || has(W_ORDER, t) || has(W_THIS, t)), setv = st && ctxOrd && [V_SET, V_CHANGE].some(r => r.test(t)) || (st && has(W_THIS, t) && /(?:^| )(?:علم|علمو|علمه|حط|خلي|خليه|mets|marque|passe)(?: |$)/.test(t));
    if (!(conf || canc || send || setv)) return null;
    if (has(W_PRICE, t) || has(W_STOCK, t) || has(W_PRODUCT, t) || has(W_PRODUCTS, t) || has(W_DISC, t)) return null;
    const mem = data.mem || {}, orders = data.orders || [], op = send ? "send" : canc ? "cancel" : conf ? "confirm" : "status", status = op === "status" ? st[0] : (op === "confirm" ? "confirmee" : op === "cancel" ? "annulee" : "");
    const prefer = op === "confirm" ? ["nouvelle"] : op === "send" ? ["confirmee"] : null;
    let list = findOrders(t, orders, prefer);
    if (!list.length && has(W_THIS, t) && mem.kind === "order" && mem.order) { const f = orders.find(o => sameOrder(o, mem.order)); if (f) list = [f]; }
    const part = { op, status, orderSlot: true };
    if (!list.length) return need("order", part, L("أي طلب تقصد؟ قل اسم الزبون أو رقم هاتفه.", "Quelle commande ? Dites le nom ou le téléphone du client."));
    if (list.length > 1) return { kind: "choose", single: false, say: L("وجدت عدة طلبات، أيها تقصد؟ " + list.slice(0, 4).map((o, i) => (i + 1) + "- " + oDesc(o)).join("، "), "Plusieurs commandes, laquelle ?"), options: list.slice(0, 4).map(o => ({ label: oDesc(o), text: ({ send: "ارسل", cancel: "الغ", confirm: "اكد", status: "علم" })[op] + " طلب " + (o.phone || o.id) + (op === "status" ? " " + (STATUS.find(s => s[0] === status) || [])[2] : "") })) };
    return mkOrderCmd(list[0], op, status, L);
  }

  /* ── مطوّر الصفحات: أوامر تعمل والمحرّر مفتوح (data.pb = {open, widgets:[{type,label}], selKind}) ──
     التراجع/الإعادة، المعاينة، حفظ ونشر (بتأكيد)، عرض المكتب/التابلت/الهاتف، إضافة قسم أو عنصر بالاسم، لوحات الجانب، أدوات القسم/العنصر المحدد، تنسيق النص.
     الحذف يُشار إليه فقط ولا يُنفَّذ بالصوت. act = {type:"pb", op, ...} ويُنفَّذ في pbDo بعناصر المحرّر الحقيقية. */
  const PB_ALIAS = {
    heading: ["عنوان", "عناوين", "titre", "titres", "heading", "title"], text: ["نص", "نصا", "فقره", "paragraphe", "texte", "text"], image: ["صوره", "صور", "image", "images", "photo", "img"],
    button: ["زر", "ازرار", "bouton", "boutons", "button", "buttons"], video: ["فيديو", "video", "فيديوهات"], divider: ["فاصل", "فواصل", "separateur", "divider", "ligne"], spacer: ["فراغ", "espace", "spacer"],
    table: ["جدول", "tableau", "table"], map: ["خريطه", "خرائط", "carte", "map"], counter: ["عداد", "compteur", "counter"], slider: ["سلايدر", "سلايدير", "carrousel", "slider", "diaporama"],
    gallery: ["معرض صور", "معرض", "galerie", "gallery"], accordion: ["اسئله شائعه", "اسئله", "faq", "accordeon"], countdown: ["عد تنازلي", "تنازلي", "compte a rebours", "countdown"],
    contact: ["نموذج اتصال", "نموذج تواصل", "formulaire", "contact"], testimonial: ["رايزبون", "راي زبون", "ارا", "avis", "temoignage", "testimonial"], social: ["ايقونات التواصل", "تواصل اجتماعي", "reseaux sociaux", "social"],
  };
  const PB_VIEW = /(?:^| )(?:شوف|شوفها|اعرض|اعرضها|عرض|وريني|ورني|وضع|بدل|حول|غير|انتقل|نسخه|نسخت|vue|affiche|montre|passe|mode|version|view|show|switch|sur)(?: |$)/;
  const PB_DEV = { m: /(?:^| )(?:ال)?(?:هاتف|موبايل|جوال|تلفون|telephone|mobile|portable|smartphone|phone)(?: |$)/, t: /(?:^| )(?:ال)?(?:تابلت|لوحي|tablette|tablet|ipad)(?: |$)/, d: /(?:^| )(?:ال)?(?:مكتب|حاسوب|كمبيوتر|ordinateur|desktop|pc|bureau|computer)(?: |$)/ };
  const PB_SEC = /(?:^| )(?:ال)?(?:قسم|اقسام|section|sections)(?: |$)/, PB_EL = /(?:^| )(?:ال)?(?:عنصر|element)(?: |$)|(?:^| )(?:هذا|هاذا|هذه|هادا|هادي|ce|cet|cette)(?: |$)/;
  function pbWidget(t, pb) {
    const ws = new Set(tk(t)), phrases = " " + t + " ", cands = [];
    (pb.widgets || []).forEach(w => {
      let hit = 0, tot = 1, alias = false;
      (PB_ALIAS[w.type] || []).forEach(a => { const f = fold(a); if (phrases.includes(" " + f + " ") || phrases.includes(" ال" + f + " ")) { alias = true; hit = Math.max(hit, f.split(" ").length); } });
      const lt = tk(w.label); tot = lt.length || 1; const lh = lt.filter(x => ws.has(x)).length;
      if (!alias && (!lh || lh / tot < 0.6)) return;
      cands.push({ type: w.type, label: w.label, hit: Math.max(hit, lh), exact: lh === tot || alias });
    });
    if (!cands.length) return [];
    const top = Math.max(...cands.map(c => c.hit * 10 + (c.exact ? 1 : 0)));
    return cands.filter(c => c.hit * 10 + (c.exact ? 1 : 0) === top);
  }
  function builderCmd(t, data, L) {
    const pb = data.pb || {}, add = has(V_ADD, t) || /(?:^| )(?:اضف|ضيف|زيد|حط|ajoute|ajouter|insere|inserer|add|insert)(?: |$)/.test(t);
    const mk = (op, say, extra, conf) => ({ kind: "builder", say, confirm: !!conf, act: Object.assign({ type: "pb", op }, extra || {}) });
    /* صفحة جديدة (تعمل ولو كان المحرّر مغلقاً) */
    if (add && /(?:^| )(?:ال)?(?:صفحه|page)(?: |$)/.test(t) && /(?:^| )(?:جديده|جديد|nouvelle|nouveau|new)(?: |$)/.test(t) && !has(W_PRODUCT, t)) {
      const m = /(?:باسم|اسمها|اسمه|عنوانها|عنوان|nommee|appelee|intitulee|titre|named|called)\s+(.+)$/.exec(norm(data.raw || "")) , name = m ? m[1].trim() : "";
      if (!name) return need("pbname", { op: "newPage" }, L("ما عنوان الصفحة الجديدة؟", "Quel titre pour la nouvelle page ?"));
      return mk("newPage", L("أنشئ صفحة جديدة «" + name + "».", "Je crée la page « " + name + " »."), { title: name });
    }
    if (!pb.open) return null;
    const hasObjW = has(W_PRODUCT, t) || has(W_PRODUCTS, t) || has(W_ORDER, t) || has(W_CLIENT, t);
    if (/(?:^| )(?:تراجع|تراجعي|undo|ctrl z)(?: |$)|(?:^| )(?:ارجع|رجع|رجعني|reviens)(?: \S+)? (?:خطوه|خطوات|للخلف|للوراء|لورا|en arriere)(?: |$)|(?:^| )خطوه (?:للوراء|للخلف|ورا|الي الوراء)(?: |$)|(?:^| )annule (?:la |le )?(?:derniere|dernier|action|modif|modification|etape|changement)|(?:^| )(?:الغ|الغي) (?:اخر|آخر) (?:تعديل|خطوه|عمليه)/.test(t)) {
      const n = numberIn(t), k = n && n.value >= 1 && n.value <= 10 ? n.value : 1; return mk("undo", L("تراجعت" + (k > 1 ? " " + k + " خطوات." : " خطوة."), "Annulé."), { n: k });
    }
    if (/(?:^| )(?:redo|refais|retablis|rejoue)(?: |$)|(?:^| )(?:اعد|اعاده) (?:ال)?(?:تعديل|خطوه|عمليه)|(?:^| )(?:تقدم خطوه|(?:تقدم|ارجع|رجع) (?:خطوه )?(?:للامام|لقدام))|(?:^| )خطوه (?:للامام|لقدام)/.test(t)) return mk("redo", L("أعدت الخطوة.", "Rétabli."), {});
    if (/(?:^| )(?:معاينه|عاين|عاينلي|عاينها|apercu|previsualise|previsualiser|preview)(?: |$)|(?:^| )(?:وريني|ورني|شوف) (?:كيف|كيفاش) (?:تبان|تبدو|تظهر)/.test(t)) return mk("preview", L("أفتح المعاينة.", "J'ouvre l'aperçu."), {});
    if (/(?:^| )(?:اغلق|سكر|اقفل|ferme|fermer|close|اخرج من) (?:ال)?(?:محرر|مطور|editeur|builder)(?: |$)/.test(t)) return mk("close", L("هل أغلق المحرّر؟ التعديلات غير المحفوظة قد تضيع.", "Fermer l'éditeur ? Les modifications non enregistrées seront perdues."), {}, true);
    if (!hasObjW && /(?:^| )(?:احفظ|احفظها|حفظ|انشر|انشرها|نشر|publie|publier|sauvegarde|sauvegarder|enregistre|enregistrer|save|publish)(?: |$)/.test(t) && (t.split(" ").length <= 5 || /(?:صفحه|page|تعديلات|modifications|الان|maintenant)/.test(t))) return mk("publish", L("هل أحفظ الصفحة وأنشرها الآن؟", "Enregistrer et publier la page maintenant ?"), {}, true);
    /* عرض الجهاز */
    const dev = ["m", "t", "d"].find(k => PB_DEV[k].test(t));
    if (dev && (PB_VIEW.test(t) || t.split(" ").length <= 3) && !hasObjW && !has(W_ORDER, t)) { const nm = { m: "الهاتف", t: "التابلت", d: "المكتب" }[dev]; return mk("dev", L("عرض " + nm + ".", { m: "Vue mobile.", t: "Vue tablette.", d: "Vue ordinateur." }[dev]), { dev }); }
    /* قسم/عنصر جديد */
    if (add && PB_SEC.test(t) && !has(W_PRODUCT, t) && !/(?:^| )(?:بعد|تحت|فوق|قبل)(?: |$)/.test(t)) return mk("addSection", L("أضيف قسماً جديداً.", "J'ajoute une section."), {});
    if (add && !hasObjW || add && /(?:بطاقه|carte) (?:منتج|produit)/.test(t)) {
      const q = t.split(" ").filter(w => !isVerb(w)).join(" "), c = pbWidget(q, pb), n0 = numberIn(t), cnt = n0 && n0.value >= 2 && n0.value <= 6 && !c.some(x => tk(x.label).some(w => /^\d+$/.test(w))) ? n0.value : 1;
      if (c.length === 1 && (!hasObjW || c[0].hit >= 2)) return mk("widget", L("أضيف عنصر «" + c[0].label + "»" + (cnt > 1 ? " " + cnt + " مرات." : "."), "J'ajoute : " + c[0].label), { widget: c[0].type, label: c[0].label, n: cnt });
      if (c.length > 1) return { kind: "choose", single: false, say: L("أيّ عنصر تقصد؟ " + c.slice(0, 4).map((x, i) => (i + 1) + "- " + x.label).join("، "), "Lequel ?"), options: c.slice(0, 4).map(x => ({ label: x.label, act: { type: "pb", op: "widget", widget: x.type, label: x.label, n: cnt }, say: "" })) };
    }
    /* لوحات الجانب */
    const show = /(?:^| )(?:افتح|فتح|اظهر|اعرض|وريني|ouvre|montre|affiche|open|show|اخف|خبي|سكر|اغلق|cache|masque|ferme|hide|close)(?: |$)/.test(t), hide = /(?:^| )(?:اخف|خبي|سكر|اغلق|cache|masque|ferme|hide|close)(?: |$)/.test(t);
    if (show || t.split(" ").length <= 3) {
      if (/(?:^| )(?:ال)?(?:طبقات|calques|layers)(?: |$)/.test(t)) return mk("panel", L("لوحة الطبقات.", "Calques."), { panel: "lay" });
      if (/(?:^| )(?:اعدادات|reglages|parametres) (?:ال)?(?:صفحه|page)(?: |$)|(?:^| )(?:ال)?(?:صفحه|page) (?:اعدادات|settings)(?: |$)/.test(t)) return mk("panel", L("إعدادات الصفحة.", "Réglages de la page."), { panel: "pg" });
      if (/(?:^| )(?:ال)?(?:اقسام|عناصر|قوالب) (?:ال)?جاهزه(?: |$)|(?:^| )(?:ال)?جاهزه(?: |$)|(?:^| )(?:modeles|prets a l emploi)(?: |$)/.test(t)) return mk("panel", L("الأقسام الجاهزة.", "Modèles prêts."), { panel: "def" });
      if (/(?:^| )(?:ال)?ادوات (?:ال)?ذكيه(?: |$)/.test(t)) return mk("panel", L("تعديل الصورة (فيه الأدوات الذكية).", "Retouche d'image (outils intelligents)."), { panel: "img" });
      if (/(?:^| )(?:ال)?(?:عناصر|palette|elements)(?: |$)/.test(t) && !add && !hasObjW) return mk("panel", L("لوحة العناصر.", "Éléments."), { panel: "add" });
      if (show && /(?:^| )(?:ال)?(?:ادوات|outils)(?: |$)/.test(t)) return mk("panel", hide ? L("أخفيت شريط الأدوات.", "Barre d'outils masquée.") : L("شريط الأدوات.", "Barre d'outils."), { panel: "l" });
      if (show && /(?:^| )(?:ال)?(?:اعدادات|parametres|reglages|settings)(?: |$)/.test(t)) return mk("panel", hide ? L("أخفيت شريط الإعدادات.", "Réglages masqués.") : L("شريط الإعدادات.", "Réglages."), { panel: "r" });
    }
    /* أدوات القسم المحدد */
    const isSec = PB_SEC.test(t), isEl = PB_EL.test(t) && !isSec, kind = isSec ? "sec" : isEl ? "el" : (pb.selKind === "section" ? "sec" : pb.selKind ? "el" : "");
    const sayK = kind === "sec" ? L("القسم", "la section") : L("العنصر", "l'élément");
    if (/(?:^| )(?:احذف|احذفه|احذفها|امسح|امسحه|امسحها|نحي|نحيه|نحيها|حيد|حيده|supprime|supprimer|efface|effacer|delete|remove)(?: |$)/.test(t) && (isSec || isEl || t.split(" ").length <= 3)) return mk("point", L("لا أحذف بالصوت. أشير إلى زر الحذف: اضغطه بنفسك.", "Je ne supprime pas par la voix : je montre le bouton."), { tool: (kind || "el") === "sec" ? "delsec" : "delel" });
    if (kind && /(?:^| )(?:كرر|كررها|كرره|انسخ|انسخه|انسخها|ضاعف|duplique|dupliquer|copie|copier|duplicate|clone)(?: |$)/.test(t)) return mk("tool", L("أكرّر " + sayK + ".", "Je duplique."), { tool: kind === "sec" ? "dupsec" : "dupel" });
    if (kind && /(?:^| )(?:اقفل|اقفله|اقفلها|قفل|verrouille|verrouiller|lock)(?: |$)/.test(t)) return mk("tool", L("أقفل " + sayK + ".", "Je verrouille."), { tool: kind === "sec" ? "locksec" : "lockel" });
    if (isSec && /(?:^| )(?:اخف|اخفيه|اخفها|خبي|خبيه|خبيها|cache|cacher|masque|masquer|hide)(?: |$)/.test(t)) return mk("tool", L("أخفي القسم.", "Je masque la section."), { tool: "hidesec" });
    const UPW = /(?:^| )(?:لفوق|للاعلي|الي الاعلي|فوق|ارفع|ارفعه|en haut|haut|monte|up)(?: |$)/, DNW = /(?:^| )(?:لتحت|للاسفل|الي الاسفل|تحت|اسفل|نزل|نزله|انزل|en bas|bas|descend|down)(?: |$)/;
    if (isSec && UPW.test(t) && !DNW.test(t)) return mk("tool", L("أنقل القسم للأعلى.", "Section vers le haut."), { tool: "secup" });
    if (isSec && DNW.test(t) && !UPW.test(t)) return mk("tool", L("أنقل القسم للأسفل.", "Section vers le bas."), { tool: "secdown" });
    /* تنسيق النص المحدد */
    const sz = /(?:^| )(?:ال)?(?:خط|حجم|كتابه|نص|texte|police|taille|font|text)(?: |$)/.test(t), nn = numberIn(t), kk = nn && nn.value >= 1 && nn.value <= 10 ? nn.value : 1;
    if (sz && /(?:^| )(?:كبر|كبرلي|كبره|كبرها|اكبر|ضخم|ارفع|زيد|agrandis|agrandir|augmente|plus grand|bigger|increase)(?: |$)/.test(t)) return mk("fmt", L("أكبّر الخط.", "Police plus grande."), { q: "fs+", n: kk });
    if (sz && /(?:^| )(?:صغر|صغرلي|صغره|صغرها|اصغر|نقص|قلل|diminue|reduis|reduire|plus petit|smaller|decrease)(?: |$)/.test(t)) return mk("fmt", L("أصغّر الخط.", "Police plus petite."), { q: "fs-", n: kk });
    if (/(?:^| )(?:عريض|غليظ|bold|gras|ثخين)(?: |$)/.test(t)) return mk("fmt", L("نص عريض.", "Gras."), { q: "bold" });
    if (/(?:^| )(?:مائل|مايل|italique|italic|اتاليك)(?: |$)/.test(t)) return mk("fmt", L("نص مائل.", "Italique."), { q: "italic" });
    if (/(?:^| )(?:تحته خط|مسطر|underline|souligne|سطر تحته)(?: |$)/.test(t)) return mk("fmt", L("تسطير.", "Souligné."), { q: "under" });
    if (/(?:^| )(?:وسط|توسيط|وسطه|وسطها|centre|centrer|center)(?: |$)/.test(t) && (isEl || PB_SEC.test(t) === false) && (isEl || /(?:^| )(?:الصفحه|page)(?: |$)/.test(t) || t.split(" ").length <= 3)) return mk("fmt", L("أوسّط العنصر.", "Centré."), { q: "al-center" });
    if (/(?:^| )(?:حاذي|محاذاه|align|aligne|aligner)(?: |$)/.test(t) && /(?:^| )(?:يمين|لليمين|droite|right)(?: |$)/.test(t)) return mk("fmt", L("محاذاة لليمين.", "À droite."), { q: "al-right" });
    if (/(?:^| )(?:حاذي|محاذاه|align|aligne|aligner)(?: |$)/.test(t) && /(?:^| )(?:يسار|لليسار|gauche|left)(?: |$)/.test(t)) return mk("fmt", L("محاذاة لليسار.", "À gauche."), { q: "al-left" });
    if (/(?:^| )(?:قدام|للامام|امام|premier plan|devant|front)(?: |$)/.test(t) && (isEl || /(?:^| )(?:الكل|الجميع)(?: |$)/.test(t))) return mk("fmt", L("للأمام.", "Au premier plan."), { q: "front" });
    if (/(?:^| )(?:للخلف|خلف|ورا|الخلفيه|arriere plan|derriere|back)(?: |$)/.test(t) && isEl) return mk("fmt", L("للخلف.", "À l'arrière-plan."), { q: "back" });
    return null;
  }

  /* ── الفهم: النص + بيانات اللوحة ← أمر ──
     النتيجة: { kind, say, act, ... } حيث kind: nav|orders|answer|newProduct|editProduct|theme|update|ask|search|site|help|stop|unknown
     say: ما يُقال/يُعرض، act: وصف التنفيذ (يُنفَّذ في exec)، confirm: يحتاج تأكيداً. */
  function parse(raw, data) {
    data = data || {};
    const t = splitPron(norm(raw)), fr = /[a-z]{3,}/.test(t) && !/[ء-ي]/.test(t);
    const L = (ar, f) => (fr ? f : ar);
    if (!t) return { kind: "unknown", say: "" };
    { const fl = flowStart(t, data, L); if (fl) return fl; }
    { const bc = builderCmd(t, Object.assign({ raw }, data), L); if (bc) return bc; }
    if (has(STOP, t) && t.split(" ").length <= 3 && !has(WHAT_Q, t) && !has(COUNT_Q, t) && !has(W_RATE, t) && !has(W_ORDER, t) && !has(W_THIS, t)) return { kind: "stop", say: "" };
    if (has(HELP, t)) return { kind: "help", say: L("هذه أمثلة على الأوامر.", "Voici des exemples de commandes.") };
    const am = ASK_ME.exec(t); if (am) return { kind: "ask", q: am[1], say: "", explicit: true };

    if (/(?:^| )(?:اوقف|ايقاف|طفي|عطل|بلا|بدون|ما نبغيش|لا تحرك|stop|sans|desactive)(?: \S+)? (?:ال)?(?:يد|main)(?: |$)/.test(t)) return { kind: "hand", say: L("أوقفت اليد، سأنفّذ مباشرة.", "Main désactivée."), act: { type: "hand", on: false } };
    if (/(?:^| )(?:شغل|فعل|ارني|وريني|اظهر|active|montre)(?: \S+)? (?:ال)?(?:يد|main)(?: |$)/.test(t)) return { kind: "hand", say: L("شغّلت اليد.", "Main activée."), act: { type: "hand", on: true } };
    const orders = data.orders || [], products = data.products || [];
    /* عناصر اللوحة بالكلمات المفتاحية (حيّة من الصفحة): «اضغط حفظ»، «اكتب 3000 في سعر البيع»، «وين زر…» */
    if (data.ui && data.ui.find) {
      const UR = uiRegex(), PH = UI_CLICK.concat(UI_WHERE).map(fold).sort((x, y) => y.length - x.length);
      const strip = s => { let z = " " + s + " "; PH.forEach(ph => { z = z.split(" " + ph + " ").join(" "); z = z.split(" " + ph + " ").join(" "); }); return tokens(z.trim()).join(" "); };
      const tab = id => TAB_LABEL[id] || id, show = c => "«" + c.label + "»" + (c.tab ? " في قسم " + tab(c.tab) : "");
      const mk = (c, mode, extra) => Object.assign({ kind: "ui", say: "", confirm: false, act: Object.assign({ type: "ui", mode, item: c, label: c.label, tab: c.tab }, extra || {}) }, {});
      const pickOne = (cands, builder) => {
        if (cands.length === 1 || (cands.length > 1 && cands[0].label !== cands[1].label && false)) return builder(cands[0]);
        return { kind: "choose", single: false, say: L("أيّ عنصر تقصد؟ " + cands.slice(0, 4).map((c, i) => (i + 1) + "- " + c.label + (c.tab ? " (" + tab(c.tab) + ")" : "")).join("، "), "Lequel ?"), options: cands.slice(0, 4).map(c => { const r = builder(c); return { label: c.label + (c.tab ? " — " + tab(c.tab) : ""), act: r.act, confirm: r.confirm, say: r.say }; }) };
      };
      const mt = UI_TYPE_RX.exec(t);
      if (mt) {
        const cands = data.ui.find(mt[2], 4).filter(c => c.kind !== "button");
        if (cands.length) return pickOne(cands, c => Object.assign(mk(c, "type", { value: mt[1] }), { say: L("أكتب «" + mt[1] + "» في " + show(c), "J'écris « " + mt[1] + " » dans " + c.label) , confirm: c.risk !== "ok" }));
      }
      if (has(UR.click, t) && !has(V_OPEN, t)) {
        const q = strip(t), cands = q ? data.ui.find(q, 5) : [];
        if (cands.length) return pickOne(cands, c => c.risk === "danger"
          ? Object.assign(mk(c, "point"), { say: L("هذا الزر يحذف أو يمسح؛ لا أضغطه بالصوت. أشير إليه فقط: اضغطه بنفسك. " + show(c), "Action destructive : je la montre seulement.") })
          : Object.assign(mk(c, "click"), { say: L("أضغط " + show(c), "Je clique : " + c.label), confirm: c.risk === "confirm" }));
      }
      if (has(UR.where, t)) {
        const q = strip(t), cands = q ? data.ui.find(q, 4) : [];
        if (cands.length) { const c = cands[0], rest = cands.slice(1).filter(x => x.label === c.label && x.tab !== c.tab); return Object.assign(mk(c, "point"), { say: L("هنا: " + show(c) + (rest.length ? " (وله نظير في " + rest.map(x => tab(x.tab)).join("، ") + ")" : ""), "Ici : " + c.label) }); }
      }
    }
    const oa = orderAction(t, data, L); if (oa) return oa;
    const fu = followUp(t, data, L); if (fu) return fu;
    const sem = understand(raw, t, data, L); if (sem) return sem;
    const at = attrAnswer(t, data, L); if (at) return at;
    const isOpen = has(V_OPEN, t), ask = has(COUNT_Q, t) || has(WHAT_Q, t) || has(COUNT_N, t);

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
    if (!isOpen) { const an = analyticsAnswer(t, data, L); if (an) return an; }
    if (has(W_REV, t) && !has(W_ORDER, t) && !isOpen && (ask || periodOf(t))) {
      const per = periodOf(t), sum = orders.filter(o => inPeriod(o, per) && !["annulee", "echec"].includes(o.status)).reduce((s, o) => s + (Number(o.total) || 0), 0);
      return numAnswer("rev", per, "", orders, L);
    }
    if ((has(S_OUT, t) || has(S_LOW, t)) && (has(W_PRODUCT, t) || has(W_STOCK, t) || has(W_PRODUCTS, t))) return stockAnswer(t, products, data, L);
    if (ask && (has(W_STOCK, t) || has(REMAIN, t)) && !has(S_OUT, t) && !has(S_LOW, t)) {
      const pr = matchProduct(productRef(t, numberIn(t)), products), inf = data.stockInfo || (p => ({ tracked: p.stock != null, total: p.stock != null ? Number(p.stock) : null }));
      if (pr) { const s = inf(pr); return { kind: "answer", mem: { slug: pr.slug, kind: "product" }, say: s.tracked && s.total != null ? L("مخزون «" + pName(pr) + "»: " + s.total + " حبة.", "Stock de « " + pName(pr) + " » : " + s.total + ".") : L("«" + pName(pr) + "» بلا تتبع للمخزون.", "Stock non suivi.") }; }
      let units = 0, items = 0, out = 0; products.filter(p => p.active !== false).forEach(p => { const s = inf(p); if (s.tracked && s.total != null) { items++; units += s.total; if (s.total <= 0) out++; } });
      return { kind: "answer", say: items ? L("في المخزون " + fmtN(units) + " حبة موزعة على " + items + " منتج" + (out ? "، منها " + out + " نفد." : "."), units + " pièces sur " + items + " produits" + (out ? " (" + out + " en rupture)." : ".")) : L("لا يوجد منتج بتتبّع للمخزون.", "Aucun produit avec suivi de stock.") };
    }
    if (ask && !isOpen) {
      if (has(W_ORDER, t)) { const st = statusOf(t), per = periodOf(t); return numAnswer("ord", per, st ? st[0] : "", orders, L); }
      if (has(W_PRODUCT, t) || W_PRODUCTS.test(t)) {
        const n = products.filter(p => p.active !== false).length;
        return { kind: "answer", say: L("عندك " + n + " منتج نشط.", "Vous avez " + n + " produits actifs.") };
      }
    }
    /* آخر طلب */
    if (has(W_LAST, t) && has(W_ORDER, t) && !isOpen) {
      const o = orders.slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      return { kind: "answer", mem: o ? { order: o, kind: "order" } : undefined, say: o ? L("آخر طلب من " + (o.name || "زبون") + " ولاية " + (o.wilaya || "—") + " بمبلغ " + fmtN(o.total) + " دينار.", "Dernière commande : " + (o.name || "client") + ", " + (o.wilaya || "") + ", " + fmtN(o.total) + " DA.") : L("لا توجد طلبات بعد.", "Aucune commande.") };
    }
    /* منتجات نفدت/منخفضة بدون سؤال كم */
    if ((has(S_OUT, t) || has(S_LOW, t)) && (has(W_PRODUCT, t) || has(W_STOCK, t) || W_PRODUCTS.test(t)) && !isOpen) return stockAnswer(t, products, data, L);

    /* بحث عن طلب/زبون */
    if (has(V_SEARCH, t) && (has(W_ORDER, t) || has(W_CLIENT, t))) {
      const phone = phoneOf(t), q = phone || tokens(t).filter(w => !V_SEARCH.test(" " + w + " ") && !W_ORDER.test(" " + w + " ") && !W_CLIENT.test(" " + w + " ")).join(" ").trim();
      const hit = q ? orders.filter(o => norm((o.name || "") + " " + (o.phone || "")).includes(norm(q).replace(/\s/g, " "))) : [];
      return { kind: "orders", mem: hit.length === 1 ? { order: hit[0], kind: "order" } : undefined, say: q ? L("أبحث في الطلبات عن " + q + ".", "Je cherche « " + q + " » dans les commandes.") : L("أفتح الطلبات.", "J'ouvre les commandes."), act: { type: "orders", q } };
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
    ["مطوّر الصفحات", "اضف عنوان · ضيف زر · تراجع · شوفها على الهاتف · معاينة · احفظ وانشر · كرر القسم · كبّر الخط"],
    ["اللوحة", "بدّل المظهر · المظهر الداكن · حدّث اللوحة · افتح الموقع"],
    ["مساعدة", "كيفاش نزيد صنف؟ · اسألني عن الكوبونات · ماذا أقول"],
  ];

  /* ═════════ نطق عربي أوضح (دوال نقية قابلة للاختبار) ═════════
     Web Speech يقرأ الأرقام والرموز واللاتينية بصوت واحد فيخطئ؛ هنا نُحضّر النص: أرقام ← كلمات عربية، «دج» ← دينار، «%» ← بالمئة،
     حذف الإيموجي والروابط، تقطيع إلى جمل قصيرة، وفصل الكلمات اللاتينية (أسماء العلامات) لتُقرأ بصوت لاتيني. */
  const TTS_ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const TTS_TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const TTS_HUND = ["", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة", "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة"];
  function arNum(n) {
    n = Math.floor(Math.abs(Number(n) || 0)); if (!n) return "صفر";
    const u3 = k => { const o = [], h = Math.floor(k / 100), r = k % 100; if (h) o.push(TTS_HUND[h]); if (r) { if (r < 20) o.push(TTS_ONES[r]); else { const a = r % 10, t = Math.floor(r / 10); o.push(a ? TTS_ONES[a] + " و" + TTS_TENS[t] : TTS_TENS[t]); } } return o.join(" و"); };
    const out = [];
    [[1e9, "مليار", "ملياران", "مليارات"], [1e6, "مليون", "مليونان", "ملايين"], [1e3, "ألف", "ألفان", "آلاف"]].forEach(([sc, one, two, pl]) => {
      const q = Math.floor(n / sc); n %= sc; if (!q) return;
      out.push(q === 1 ? one : q === 2 ? two : q <= 10 ? u3(q) + " " + pl : u3(q) + " " + one);
    });
    if (n) out.push(u3(n));
    return out.join(" و");
  }
  const digitsSpoken = d => String(d).split("").map(c => (c === "0" ? "صفر" : TTS_ONES[Number(c)])).join(" ");
  function prepSpeech(text, lex) {
    let t = String(text == null ? "" : text);
    t = t.replace(/https?:\/\/\S+/g, " ").replace(/\*\*|`|^#{1,6}\s?/gm, "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}←→↑↓•▪●■▶►✓✔✖✕]/gu, " ").replace(/[«»“”"]/g, " ");
    const rep = lex && lex.tts && lex.tts.replace; if (rep && typeof rep === "object") Object.keys(rep).sort((a, b) => b.length - a.length).forEach(k => { if (k) t = t.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), /^[A-Za-z]/.test(k) ? "gi" : "g"), rep[k]); });
    t = t.replace(/(\d)\s*(?:دج|DA|DZD)(?![؀-ۿA-Za-z])/g, "$1 دينار").replace(/(\d)\s*[%٪]/g, "$1 بالمئة").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    t = t.replace(/\d{1,3}(?:[ ,]\d{3})+(?!\d)|\d+(?:\.\d+)?/g, m => {
      const raw = m.replace(/[ ,]/g, "");
      if (/^0\d{8,}$/.test(raw) || raw.replace(/\D/g, "").length >= 10) return " " + digitsSpoken(raw.replace(/\D/g, "")) + " ";
      if (raw.includes(".")) { const [a, b] = raw.split("."); return " " + arNum(a) + " فاصلة " + digitsSpoken(b) + " "; }
      return " " + arNum(raw) + " ";
    });
    return t.replace(/\n+/g, ". ").replace(/\s+/g, " ").trim();
  }
  /* تقطيع إلى جمل ≤ 180 حرفاً (كروم يوقف المقاطع الطويلة) */
  function chunkSpeech(t) {
    const parts = String(t || "").split(/(?<=[.؟?!؛])\s+/), out = [];
    parts.forEach(pt => { let x = pt.trim(); while (x.length > 180) { let i = x.lastIndexOf("،", 180); if (i < 40) i = x.lastIndexOf(" ", 180); if (i < 40) i = 180; out.push(x.slice(0, i + 1).trim()); x = x.slice(i + 1).trim(); } if (x) out.push(x); });
    return out;
  }
  /* يفصل المقاطع العربية عن اللاتينية (أسماء علامات/كلمات إنجليزية) ← [{t, lang:"ar"|"lat"}] */
  function splitScripts(t) {
    const out = []; let cur = null;
    String(t || "").split(/\s+/).filter(Boolean).forEach(w => {
      const lat = /[A-Za-zÀ-ÿ]/.test(w) && !/[؀-ۿ]/.test(w), k = lat ? "lat" : "ar";
      if (cur && cur.lang === k) cur.t += " " + w; else { cur = { t: w, lang: k }; out.push(cur); }
    });
    return out;
  }
  /* ترتيب أصوات المتصفح: الأفضل أولاً (الاسم المحفوظ، ثم الطبيعية/العصبية، ثم جوجل/مايكروسوفت، وتُستبعد الآلية الرديئة) */
  function rankVoices(list, saved) {
    const sc = v => { const n = v.name || "", l = (v.lang || "").toLowerCase(); let x = 0;
      if (saved && n === saved) x += 1000;
      if (/natural|neural|online|multilingual|enhanced|premium/i.test(n)) x += 10; if (/google/i.test(n)) x += 5; if (/microsoft/i.test(n)) x += 4; if (/espeak|festival|robot/i.test(n)) x -= 20;
      if (l === "ar-dz") x += 8; else if (/^ar-(sa|ae|kw|qa)/.test(l)) x += 6; else if (/^ar-(ma|tn|eg|jo|lb)/.test(l)) x += 3;
      if (v.localService === false) x += 1; return x; };
    return (list || []).slice().sort((a, b) => sc(b) - sc(a));
  }

  /* ═════════ المسارات الحوارية (Flows) ═════════
     مهمة مركّبة = أسئلة متتابعة تملأ «خانات» (تُملأ من الجملة الأولى ما أمكن فتُتخطّى أسئلتها) ثم ملخّص يُؤكَّد ثم تنفيذ بعناصر اللوحة الحقيقية.
     الحالة تنتقل داخل `need` (slot "flow") فتعمل بالصوت والكتابة دون حالة عامة؛ الدوال نقية. أضف مساراً = أضف تعريفاً في FL (+ تنفيذه في flowDo). */
  const FSTOP = new Set(("صفحه هبوط landing page لمنتج للمنتج منتج المنتج نموذج الطلب الطلبات طلب طلبات عداد تنازلي العداد مسار رئيسي الرئيسي اجعلها اجعله واجعلها اضف وضيف ضيف لها له مع ثم هذه هده هاد بسيطه جديده جديد انشئ انشي اصنع اعمل سوي ابني بني ولد حضر جهز create cree creer fais faire genere generer build make add formulaire compte rebours pour de la le un une avec et ترويجيه اعلانيه").split(" ").map(fold));
  const flowQuery = t => tokens(t).filter(w => !isVerb(w) && !FSTOP.has(w) && !FSTOP.has(stripAl(w))).join(" ");
  const extrasIn = t => { const o = []; if (/نموذج (?:ال)?طلب|formulaire|اطلب الان|order form|استمار/.test(t)) o.push("orderform"); if (/عداد|عد تنازلي|تنازلي|compte a rebours|countdown|compteur/.test(t)) o.push("countdown"); return o; };
  const BOTHW = /(?:^| )(?:الاثنين|الاثنان|كلاهما|كليهما|كلهم|الكل|كل شيء|كلشي|both|les deux|tout|tous)(?: |$)/, NONEW = /(?:^| )(?:لا شيء|ولا واحد|بدون|لا احد|rien|aucun|aucune|sans|nothing|none)(?: |$)/;
  const FL = {
    landing: {
      id: "landing", order: ["product", "extras", "route"],
      match: t => /(?:^| )(?:انشئ|انشي|اصنع|اعمل|سوي|ابني|بني|ولد|حضر|جهز|زيد|ضيف|اضف|دير|create|cree|creer|fais|faire|genere|generer|build|make|add)(?: |$)/.test(t) && (/(?:^| )(?:ال)?(?:صفحه|page)(?: \S+)? (?:ال)?(?:هبوط|landing|atterrissage|ترويجيه|اعلانيه)(?: |$)/.test(t) || /(?:^| )landing(?: page)?(?: |$)/.test(t)),
      fromAll(t, data) {
        const o = {}, prod = matchProduct(flowQuery(t), data.products || []); if (prod) o.product = prod.slug;
        const ex = extrasIn(t); if (ex.length) o.extras = ex; else if (BOTHW.test(t) && /(?:نموذج|عداد)/.test(t)) o.extras = ["orderform", "countdown"];
        if (/مسار|رئيس|اساسي|principal|route|(?:^| )main(?: |$)/.test(t)) o.route = true;
        return o;
      },
      parse(k, t, data) {
        if (k === "product") { if (has(W_THIS, t)) { const sl = refSlug(data); if (sl) return sl; } const m = matchProduct(flowQuery(t) || t, data.products || []); return m ? m.slug : undefined; }
        if (k === "extras") { if (BOTHW.test(t)) return ["orderform", "countdown"]; const ex = extrasIn(t); if (ex.length) return ex; if (NONEW.test(t) || has(NO, t)) return []; return undefined; }
        if (k === "route") { if (has(YES, t) || /اجعلها|رئيس|مسار|principal|route/.test(t)) return true; if (has(NO, t) || NONEW.test(t)) return false; return undefined; }
      },
      ask(k, st, data, L, retry) {
        const pre = retry ? L("لم أفهم. ", "Je n'ai pas compris. ") : "";
        if (k === "product") { const ps = (data.products || []).filter(p => p.active !== false).slice(0, 4); return need("flow", { flow: st }, pre + L("لأي منتج أنشئ صفحة الهبوط؟", "Pour quel produit ?"), ps.map(p => pName(p))); }
        if (k === "extras") return need("flow", { flow: st }, pre + L("ماذا أضيف إلى الصفحة؟ نموذج الطلب، عدّاد تنازلي، أو الاثنين؟", "Que dois-je ajouter ? Formulaire de commande, compte à rebours, ou les deux ?"), [L("نموذج الطلب", "Formulaire"), L("عدّاد تنازلي", "Compte à rebours"), L("الاثنان", "Les deux"), L("لا شيء", "Rien")]);
        if (k === "route") return need("flow", { flow: st }, pre + L("هل أجعلها المسار الرئيسي للمنتج؟ أي يصل إليها كل من يفتح المنتج.", "La définir comme page principale du produit ?"), [L("نعم", "Oui"), L("لا", "Non")]);
      },
      done(st, data, L) {
        const p = (data.products || []).find(x => x.slug === st.slots.product), nm = p ? pName(p) : st.slots.product, ex = st.slots.extras || [];
        const list = [].concat(ex.includes("countdown") ? [L("عدّاد تنازلي", "compte à rebours")] : [], ex.includes("orderform") ? [L("نموذج الطلب", "formulaire de commande")] : []);
        const say = L("سأنشئ صفحة هبوط للمنتج «" + nm + "»" + (list.length ? " وأضيف: " + list.join(" و") : "") + (st.slots.route ? "، وأجعلها المسار الرئيسي للمنتج" : "") + ". أنفّذ؟",
          "Je crée une page d'atterrissage pour « " + nm + " »" + (list.length ? " avec " + list.join(" et ") : "") + (st.slots.route ? " et la définis comme page principale" : "") + ". J'exécute ?");
        return { kind: "flow", confirm: true, say, mem: { slug: st.slots.product, kind: "product" }, act: { type: "flow", id: "landing", slots: Object.assign({}, st.slots) } };
      },
    },
  };
  function flowNext(st, data, L) {
    const D = FL[st.id]; const k = D.order.find(x => st.slots[x] === undefined);
    if (!k) return D.done(st, data, L);
    st.ask = k; return D.ask(k, st, data, L, false);
  }
  function flowStart(t, data, L) {
    for (const id of Object.keys(FL)) { const D = FL[id]; if (!D.match(t)) continue; const st = { id, slots: Object.assign({}, D.fromAll(t, data)), ask: null, fails: 0 }; return flowNext(st, data, L); }
    return null;
  }
  function flowAnswer(prev, raw, data, L) {
    const st = JSON.parse(JSON.stringify(prev.flow)), D = FL[st.id], t = splitPron(norm(raw)), k = st.ask;
    if (has(STOP, t) || /(?:^| )(?:الغ|الغي|الغاء|توقف|وقف|بطل|annule|annuler|stop|arrete|cancel)(?: |$)/.test(t) || (k === "product" && has(NO, t))) return { kind: "negated", say: L("ألغيتُ المسار.", "Parcours annulé.") };
    const v = D.parse(k, t, data);
    if (v === undefined) { st.fails = (st.fails || 0) + 1; if (st.fails >= 3) return { kind: "negated", say: L("لم أفهم؛ ألغيتُ المسار. ابدأ من جديد متى شئت.", "Je n'ai pas compris ; parcours annulé.") }; return D.ask(k, st, data, L, true); }
    st.slots[k] = v;
    const more = D.fromAll(t, data); Object.keys(more).forEach(x => { if (st.slots[x] === undefined && x !== k) st.slots[x] = more[x]; });
    return flowNext(st, data, L);
  }

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
      case "pb": pbDo(act, null); return true;
      case "flow": flowDo(act, null); return true;
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
      case "ui": {
        const it = act.item; if (!it || !it.el) return false;
        const go = () => { if (act.mode === "type") { it.el.focus(); it.el.value = act.value; it.el.dispatchEvent(new Event("input", { bubbles: true })); it.el.dispatchEvent(new Event("change", { bubbles: true })); } else if (act.mode === "click") it.el.click(); else { it.el.scrollIntoView({ block: "center" }); it.el.classList.add("aly-hl"); setTimeout(() => it.el.classList.remove("aly-hl"), 1400); } };
        if (it.tab && it.el.offsetParent === null) { const b = tabBtn(it.tab); if (b) { b.click(); setTimeout(go, 250); return true; } return false; }
        go(); return true;
      }
      case "order": {
        const i = (a.orders || []).findIndex(x => String(x.id) === String(act.id)); if (i < 0) return false;
        if (act.op === "confirm" && a.confirmOrder) { a.confirmOrder(i); return true; }
        if (act.op === "status" && a.changeStatus) { a.changeStatus(i, act.status); return true; }
        if (act.op === "cancel" && a.cancelOrder) { const oc = window.confirm; window.confirm = () => true; try { a.cancelOrder(i); } finally { window.confirm = oc; } return true; }   /* تأكيدك الصوتي/الزر كافٍ، فلا نافذة متصفح ثانية */
        if (act.op === "send" && a.sendConfirmed) { a.sendConfirmed(i); return true; }
        return false;
      }
      case "hand": if (typeof AdminHand === "undefined") return false; AdminHand.setEnabled(!!act.on); paintMic(); return true;
      case "site": window.open("index.html", "_blank"); return true;
      case "search": if (typeof AdminSearch === "undefined") return false; AdminSearch.show(); setTimeout(() => { const i = document.getElementById("as-in"); if (i && act.q) { i.value = act.q; i.dispatchEvent(new Event("input")); } }, 60); return true;
    }
    return false;
  }

  /* ── فهرس اللوحة الحيّ: كل زر/خانة/قائمة بكلماته المفتاحية (يُعاد بناؤه تلقائياً عند أي تغيير في الصفحة)،
        فتعرف اليد و«اسألني» أي أداة أو إعداد جديد بعد أي تحديث دون صيانة يدوية ── */
  const UI_RISK_DANGER = /حذف|احذف|مسح|امسح|supprim|delete|remove|effac|اعاده ضبط|reset|استرجاع|تسجيل الخروج|خروج|logout|الغاء الطلب|الغ(?:اء|ي) نهائ/;
  const UI_RISK_CONFIRM = /نشر|publish|ارسال|send|تاكيد|confirm|حفظ ونشر|تحديث|update|تفعيل|activer|ارسل/;
  /* مرادفات فرنسية/إنجليزية/دارجة لكلمات واجهة اللوحة العربية (تُوسَّع من القاموس ui.aliases) */
  let UI_ALIAS = { save: ["حفظ"], sauvegarde: ["حفظ"], enregistre: ["حفظ"], enregistrer: ["حفظ"], delete: ["حذف"], supprimer: ["حذف"], supprime: ["حذف"], export: ["تصدير"], exporter: ["تصدير"], import: ["استيراد"], importer: ["استيراد"], add: ["اضافه", "اضف", "جديد"], ajouter: ["اضافه", "اضف", "جديد"], search: ["بحث", "ابحث"], recherche: ["بحث", "ابحث"], chercher: ["بحث"], price: ["سعر"], prix: ["سعر"], stock: ["مخزون"], quantite: ["كميه"], order: ["طلب", "طلبات"], commande: ["طلب", "طلبات"], customer: ["عميل", "زبون"], client: ["عميل", "زبون"], product: ["منتج"], produit: ["منتج"], publish: ["نشر"], publier: ["نشر"], edit: ["تعديل", "عدل"], modifier: ["تعديل", "عدل"], cancel: ["الغاء"], annuler: ["الغاء"], confirm: ["تاكيد", "اكد"], confirmer: ["تاكيد"], send: ["ارسال", "ارسل"], envoyer: ["ارسال"], print: ["طباعه", "طباعة"], imprimer: ["طباعه"], download: ["تحميل", "تنزيل"], telecharger: ["تحميل", "تنزيل"], name: ["اسم"], nom: ["اسم"], phone: ["هاتف"], telephone: ["هاتف"], image: ["صوره", "صور"], photo: ["صوره", "صور"], coupon: ["كود", "كوبون"], discount: ["خصم", "تخفيض"], remise: ["خصم", "تخفيض"], filter: ["تصفيه", "فلتر"], filtre: ["تصفيه", "فلتر"], date: ["تاريخ"], status: ["حاله"], statut: ["حاله"], wilaya: ["ولايه"], category: ["تصنيف"], categorie: ["تصنيف"], sstock: ["مخزون"] };
  let UIX = { items: [], at: 0, dirty: true }, uiObs = null;
  const uiLabel = e => {
    const own = s => (s || "").replace(/\s+/g, " ").trim();
    let l = own(e.getAttribute("aria-label")) || own(e.title);
    const tag = e.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
      const td = e.closest("td[data-l]"), tr = e.closest("tr"), first = tr && tr.querySelector("td.t, th.t, td:not([data-l])");
      if (td) l = own(td.dataset.l) + " " + (first ? own(first.textContent).slice(0, 40) : "");
      else {
        const f = e.closest(".field,.row,div"), lb = (e.id && document.querySelector('label[for="' + e.id + '"]')) || (f && f.querySelector("label"));
        l = own(lb && lb.textContent) || l || own(e.placeholder) || own(e.name) || own(e.id);
      }
    } else l = own(e.textContent).slice(0, 60) || l;
    return l;
  };
  /* جداول بعض الأقسام لا تُرسم إلا عند فتحها: نرسمها (بصمت) قبل الفهرسة/الفحص ليراها اليد و«اسألني» */
  let primedAt = 0;
  function prime() {
    if (Date.now() - primedAt < 30000) return; primedAt = Date.now();
    const a = A(); ["renderFinance", "renderProducts"].forEach(f => { try { if (typeof a[f] === "function" && (a.products || []).length) a[f](); } catch (e) { } });
  }
  function uiBuild() {
    prime();
    const pbo = pbOpen(), items = [], root = (pbo ? document.getElementById("pb-app") : document.getElementById("app")) || document.body;
    root.querySelectorAll('button, a[onclick], input:not([type="hidden"]):not([type="file"]), select, textarea, [role="button"], summary').forEach(e => {
      if (e.closest(pbo ? "#av-hud,#ah-panel,#aly-hand,#as-box,.pbx-wi,.modal-bg" : "#av-hud,#ah-panel,#aly-hand,#as-box,.pbx,#pb-app,.modal-bg")) return;
      const label = uiLabel(e); if (!label || label.length < 2) return;
      const tabEl = pbo ? null : e.closest('[id^="tab-"]'), tab = pbo ? "pb" : tabEl ? tabEl.id.slice(4) : "", t = tk(label);
      if (!t.length) return;
      const oc = (e.getAttribute("onclick") || "") + " " + label, risk = UI_RISK_DANGER.test(fold(oc)) ? "danger" : UI_RISK_CONFIRM.test(fold(label)) ? "confirm" : "ok";
      items.push({ el: e, label, tab, t, kind: e.tagName === "SELECT" ? "select" : (e.tagName === "INPUT" || e.tagName === "TEXTAREA") ? "input" : "button", risk });
    });
    UIX = { items, at: Date.now(), dirty: false, pb: pbo };
    return items;
  }
  function uiItems() {
    if (UIX.dirty || !UIX.items.length || UIX.pb !== pbOpen() || Date.now() - UIX.at > (UIX.pb ? 6000 : 60000)) uiBuild();
    if (!uiObs && typeof MutationObserver !== "undefined") {
      let tm = 0; uiObs = new MutationObserver(() => { clearTimeout(tm); tm = setTimeout(() => { UIX.dirty = true; }, 500); });
      try { uiObs.observe(document.getElementById("app") || document.body, { childList: true, subtree: true }); } catch (e) { }
    }
    return UIX.items;
  }
  /* بحث بكلمات مفتاحية عن عنصر في اللوحة (الأقرب لما يظهر الآن أولاً) */
  function findUI(q, n) {
    const GEN = new Set(["زر", "خانه", "حقل", "قائمه", "مفتاح", "button", "bouton", "champ", "case", "menu"]);
    const qs = tk(q).filter(w => !GEN.has(w)); if (!qs.length) return [];
    const alt = w => [w].concat(UI_ALIAS[w] || []);
    const cur = (document.querySelector(".nav-btn.on") && (/'([a-z]+)'/.exec(document.querySelector(".nav-btn.on").getAttribute("onclick") || "") || [])[1]) || "";
    const res = [];
    uiItems().forEach(it => {
      let sc = 0; for (const q0 of qs) { let s = 0; for (const w of alt(q0)) { const v = it.t.some(x => x === w) ? 3 : it.t.some(x => w.length >= 3 && x.length >= 3 && (x.startsWith(w) || w.startsWith(x))) ? 1.6 : 0; if (v > s) s = v; } if (!s) { sc = -1; break; } sc += s; }
      if (sc > 0) res.push({ it, sc: sc + (it.tab === cur ? 1 : 0) + (it.el.offsetParent !== null ? 0.5 : 0) - Math.abs(it.t.length - qs.length) * 0.15 });
    });
    res.sort((a, b) => b.sc - a.sc);
    return res.slice(0, n || 5).map(r => r.it);
  }

  /* ── التنفيذ باليد الافتراضية: تنقر وتكتب في عناصر اللوحة الحقيقية؛ وعند غياب العنصر يعود التنفيذ المباشر ── */
  const q$ = s => { try { return document.querySelector(s); } catch (e) { return null; } };
  async function waitFor(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 1800)) { const v = fn(); if (v) return v; await new Promise(r => setTimeout(r, 80)); } return null; }
  const isoD = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  function periodDates(per) { const now = new Date(); if (per === "today") return [isoD(now), isoD(now)]; if (per === "yesterday") { const y = isoD(new Date(now - 86400000)); return [y, y]; } if (per === "week") return [isoD(new Date(now - 6 * 86400000)), ""]; if (per === "month") return [isoD(new Date(now - 29 * 86400000)), ""]; return ["", ""]; }
  let working = false;
  const editBtn = slug => [...document.querySelectorAll('[onclick*="editProduct("]')].find(b => (b.getAttribute("onclick") || "").includes(slug) && !/editProduct\(null\)/.test(b.getAttribute("onclick")));

  /* ── مطوّر الصفحات: التنفيذ بعناصر المحرّر الحقيقية (اليد إن وُجدت وإلا نقرة مباشرة) ── */
  const pbOpen = () => !!q$("#pb-app.on");
  function pbInfo() {
    if (!pbOpen()) return { open: false };
    let widgets = []; try { if (typeof PB !== "undefined" && PB.WIDGETS) widgets = Object.keys(PB.WIDGETS).filter(k => PB.WIDGETS[k] && PB.WIDGETS[k].label).map(k => ({ type: k, label: PB.WIDGETS[k].label })); } catch (e) { }
    const box = q$("#pbx-ovl .pbx-box"), selKind = box ? (box.classList.contains("section") ? "section" : box.classList.contains("widget") ? "widget" : "column") : "";
    return { open: true, widgets, selKind };
  }
  const PB_SEL = {
    undo: "#pbx-undo", redo: "#pbx-redo", preview: '[onclick="PBApp.preview()"]', publish: '[onclick="PBApp.publish()"]', close: '#pb-app [onclick="PBApp.close()"]', addSection: "#pbx-add2",
    dev_m: "[onclick=\"PBApp.setDev('m')\"]", dev_t: "[onclick=\"PBApp.setDev('t')\"]", dev_d: "[onclick=\"PBApp.setDev('d')\"]",
    panel_l: "#pbx-tgl", panel_r: "#pbx-tgr", panel_lay: "[onclick=\"PBApp.ltoggle('lay')\"]", panel_pg: "[onclick=\"PBApp.ltoggle('pg')\"]", panel_def: "[onclick=\"PBApp.ltoggle('def')\"]", panel_img: "[onclick=\"PBApp.ltoggle('img')\"]", panel_add: "[onclick=\"PBApp.ltoggle('add')\"]",
  };
  const PB_TOOL = { secup: "نقل القسم للأعلى", secdown: "نقل القسم للأسفل", hidesec: "إخفاء القسم", locksec: "قفل القسم", dupsec: "تكرار القسم", delsec: "حذف القسم", lockel: "قفل العنصر", dupel: "تكرار", delel: "حذف" };
  const pbTool = key => { const want = fold(PB_TOOL[key]); return [...document.querySelectorAll("#pbx-ovl button")].find(b => fold(b.title || "").startsWith(want) && (key === "dupel" ? !/قسم/.test(b.title) : key === "delel" ? !/قسم/.test(b.title) : true)); };
  async function pbDo(act, H) {
    const click = async el => { if (H) { if (await H.click(el)) return true; } try { el.click(); return true; } catch (e) { return false; } };
    const miss = why => { logMiss(act, why); sink({ out: why, err: true }); return true; };
    const wait = (sel, ms) => waitFor(() => { const e = q$(sel); return e && (e.offsetParent !== null || getComputedStyle(e).position === "fixed") ? e : null; }, ms || 1800);
    const stable = () => new Promise(r => setTimeout(r, 160));
    switch (act.op) {
      case "undo": case "redo": { const b = await wait(PB_SEL[act.op]); if (!b) return miss("المحرّر غير مفتوح."); for (let i = 0; i < (act.n || 1); i++) { await click(b); await stable(); } return true; }
      case "preview": case "publish": case "close": case "addSection": { const b = await wait(PB_SEL[act.op]); if (!b) return miss("المحرّر غير مفتوح."); await click(b); return true; }
      case "dev": { const b = await wait(PB_SEL["dev_" + act.dev]); if (!b) return miss("المحرّر غير مفتوح."); await click(b); return true; }
      case "panel": { const b = await wait(PB_SEL["panel_" + act.panel]); if (!b) return miss("المحرّر غير مفتوح."); if (/^(?:lay|pg|def|img|add)$/.test(act.panel) && typeof PBApp !== "undefined" && PBApp.E && PBApp.E.ltab === act.panel) return true; await click(b); return true; }
      case "widget": {
        const sel = '#pbx-lpane .pbx-wi[data-add="' + act.widget + '"]';
        let tile = q$(sel);
        if (!tile || tile.offsetParent === null) {
          const lt = q$(PB_SEL.panel_add), open = typeof PBApp !== "undefined" && PBApp.E && PBApp.E.ltab === "add";
          if (!pbOpen()) return miss("افتح المحرّر أولاً.");
          const lp = q$("#pbx-lside"); if (lp && lp.offsetParent === null) { const tg = q$("#pbx-tgl"); if (tg) await click(tg); await stable(); }
          if (!open && lt) await click(lt);
          tile = await wait(sel);
        }
        if (!tile) return miss("لم أجد العنصر «" + (act.label || act.widget) + "» في لوحة العناصر.");
        for (let i = 0; i < (act.n || 1); i++) { await click(tile); await stable(); }
        return true;
      }
      case "tool": case "point": {
        const key = act.tool, b = pbTool(key);
        if (!b) return miss(/sec/.test(key) ? "حدّد القسم أولاً (انقر عليه) ثم أعد الأمر." : "حدّد العنصر أولاً (انقر عليه) ثم أعد الأمر.");
        if (act.op === "point") { if (H) await H.point(b); return true; }
        await click(b); return true;
      }
      case "fmt": {
        const q = act.q, b = q$('#pb-app [data-qb="' + q + '"]') || q$('#pb-app [data-q="' + q + '"]');
        if (!b) return miss("حدّد عنصراً نصياً أولاً ثم أعد الأمر.");
        for (let i = 0; i < (act.n || 1); i++) { await click(b); await stable(); } return true;
      }
      case "newPage": {
        if (typeof PBAdmin === "undefined") return false;
        if (H) { const tb = tabBtn("builder"); if (tb && !tb.classList.contains("on")) await H.click(tb); await H.sleep(250); }
        PBAdmin.newPage({ title: act.title });
        return true;
      }
    }
    return false;
  }

  /* ── تنفيذ المسارات الحوارية بعناصر اللوحة الحقيقية (اليد إن وُجدت) ── */
  async function flowDo(act, H) {
    if (act.id !== "landing") return false;
    const a = A(), slots = act.slots || {}, p = (a.products || []).find(x => x.slug === slots.product);
    if (!p) { sink({ out: "لم أجد المنتج.", err: true }); return true; }
    const say = m => sink({ out: m }), ex = slots.extras || [];
    say("أنشئ صفحة جديدة للمنتج «" + (p.title || p.slug) + "»…");
    await pbDo({ op: "newPage", title: (p.title || p.slug) + " — صفحة هبوط" }, H);
    if (!(await waitFor(() => pbOpen(), 9000))) { sink({ out: "تعذّر فتح المحرّر.", err: true }); return true; }
    await new Promise(r => setTimeout(r, 400));
    const taken = new Set(((typeof PBAdmin !== "undefined" && PBAdmin.list) || []).map(x => x.slug)); let slug = (p.slug + "-lp").toLowerCase().replace(/[^a-z0-9-]/g, ""), i = 1; while (!slug || taken.has(slug)) slug = (p.slug + "-lp").replace(/[^a-z0-9-]/g, "") + "-" + (++i);
    try { PBApp.slugEdit(slug); const inp = q$("#pg-slug"); if (inp) inp.value = slug; PBApp.linkProduct(p.slug); } catch (e) { }
    const setSel = fn => { try { const inf = PBApp.find(PBApp.E.sel); if (inf) { fn(inf.set); PBApp.E.dirty = true; PBApp.renderCanvas(); } } catch (e) { } };
    say("أضيف العنوان وصورة المنتج…");
    await pbDo({ op: "widget", widget: "heading", label: "عنوان", n: 1 }, H); setSel(st => { st.text = p.title || p.slug; });
    const cover = p.cover || (p.images && p.images[0]) || "";
    await pbDo({ op: "widget", widget: "image", label: "صورة", n: 1 }, H); if (cover) setSel(st => { st.src = cover; st.hauto = true; });
    if (ex.includes("countdown")) { say("أضيف العدّاد التنازلي…"); await pbDo({ op: "widget", widget: "countdown", label: "عدّ تنازلي", n: 1 }, H); }
    if (ex.includes("orderform")) { say("أضيف نموذج الطلب…"); await pbDo({ op: "widget", widget: "orderorig", label: "نموذج الطلب", n: 1 }, H); }
    try { PBApp.linkProduct(p.slug); if (slots.route) PBApp.setMainRoute(true); PBApp.renderCanvas(); } catch (e) { }
    const msg = "الصفحة جاهزة في المطوّر" + (slots.route ? " وستصبح المسار الرئيسي للمنتج عند النشر" : "") + ". هل أفتح المعاينة؟";
    pending = { kind: "flow", confirm: true, say: msg, act: { type: "pb", op: "preview" } }; clearTimeout(pendingT); pendingT = setTimeout(() => { pending = null; }, 60000);
    sink({ out: msg, buttons: [["معاينة", () => { pending = null; execVia({ type: "pb", op: "preview" }); }, "ok"], ["حفظ ونشر", () => { pending = null; run({ kind: "builder", confirm: true, say: "هل أحفظ الصفحة وأنشرها الآن؟", act: { type: "pb", op: "publish" } }, ""); }, ""], ["لاحقاً", () => { pending = null; }, ""]] });
    speak(msg, false);
    return true;
  }

  /* ── مراقبة ذاتية: ما تعذّر على اليد إيجاده يُسجَّل (لتنبيه المطوّر بعد أي تحديث) والتنفيذ يرجع مباشراً ── */
  function logMiss(act, why) {
    try {
      const a = JSON.parse(LS("alyssum_hand_misses") || "[]"), v = (document.querySelector('meta[name="admin-version"]') || {}).content || "";
      a.push({ type: act && act.type, why: String(why || "").slice(0, 120), v, at: Date.now() }); LS("alyssum_hand_misses", JSON.stringify(a.slice(-30)));
      if (typeof console !== "undefined") console.warn("[AdminVoice] اليد لم تجد العنصر:", act && act.type, why);
    } catch (e) { }
  }
  const fb = (act, why) => { logMiss(act, why); return exec(act); };
  /* عناصر اعتمدت عليها اليد؛ تُفحص تلقائياً فيظهر أي تغيّر بعد تحديث (يقابلها scripts/test-hand.js قبل كل دمج) */
  const HAND_CHECKS = [["زر منتج جديد", '[onclick="Admin.editProduct(null)"]', 0], ["خانة السعر", 'input[onchange*="setPrice(\'"]', 1], ["خانة المخزون", 'input[onchange*="setStock(\'"]', 1],
    ["بحث الطلبات", "#order-filter-q", 0], ["حالة الطلبات", "#order-filter-status", 0], ["تاريخ من", "#order-filter-from", 0], ["تاريخ إلى", "#order-filter-to", 0],
    ["مفتاح المظهر", '#theme-sw button[data-m="dark"]', 0], ["زر البحث", "#as-btn", 0], ["زر تعديل منتج", '[onclick*="editProduct("]:not([onclick*="editProduct(null)"])', 1], ["مجموعات القائمة", ".ng[data-g]", 0]];
  function selfTest() {
    prime();
    const has = (A().products || []).length > 0, missing = HAND_CHECKS.filter(c => (c[2] ? has : true) && !document.querySelector(c[1])).map(c => c[0]);
    const res = { ok: !missing.length, missing, checked: HAND_CHECKS.length, version: (document.querySelector('meta[name="admin-version"]') || {}).content || "" };
    if (missing.length) logMiss({ type: "selftest" }, missing.join("، "));
    return res;
  }
  /* بعد كل تحديث: ما ظهر من أدوات جديدة في القائمة يُعلَن في «اسألني» مع زر «أرني» تنقر اليد به */
  function announceNew() {
    const ver = (document.querySelector('meta[name="admin-version"]') || {}).content || "", navs = navNow(); if (!navs.length || !ver) return;
    const cur = {}; navs.forEach(n => { cur[n.id] = n.label; });
    let prev = null; try { prev = JSON.parse(LS("alyssum_ui_seen") || "null"); } catch (e) { }
    LS("alyssum_ui_seen", JSON.stringify({ v: ver, items: cur }));
    if (!prev || prev.v === ver) return;
    const fresh = Object.keys(cur).filter(k => !(k in (prev.items || {}))); if (!fresh.length) return;
    const names = fresh.map(k => cur[k]), msg = "جديد في اللوحة بعد التحديث: " + names.join("، ") + ". اضغط اسم الأداة لأوصلك إليها.";
    try { if (AH() && AH().post) AH().post("a", msg, fresh.slice(0, 4).map(k => [cur[k], () => showTab(k), true])); } catch (e) { }
    try { toast("جديد في اللوحة: " + names.join("، ")); } catch (e) { }
  }
  const showTab = id => execVia({ type: "nav", tab: id });
  async function execVia(act) {
    const H = (typeof AdminHand !== "undefined" && AdminHand.enabled()) ? AdminHand : null;
    if (!H || !act || act.type === "hand") return exec(act);
    const dims = [$h("ah-panel"), $h("av-hud")].filter(Boolean); dims.forEach(x => x.classList.add("ah-dim")); working = true;
    const a = A(), goTab = async id => { const b = tabBtn(id); if (!b) return false; if (b.classList.contains("on")) return true; return await H.click(b); };
    try {
      switch (act.type) {
        case "nav": { const b = tabBtn(act.tab); if (!b) return false; if (!(await H.click(b))) b.click(); return true; }
        case "orders": {
          if (!(await goTab("orders"))) return exec(act);
          await H.sleep(220);
          if (act.q) await H.type(q$("#order-filter-q"), act.q);
          if (act.status) await H.type(q$("#order-filter-status"), act.status);
          const [from, to] = periodDates(act.period);
          if (from) await H.type(q$("#order-filter-from"), from); if (to) await H.type(q$("#order-filter-to"), to);
          try { a.applyOrderFilters(); } catch (e) { } return true;
        }
        case "order": {
          if (!(await goTab("orders"))) return exec(act);
          await H.sleep(220);
          const inp = q$("#order-filter-q");
          if (inp) { await H.type(inp, act.phone || act.label); try { a.applyOrderFilters(); } catch (e) { } await H.sleep(300); const row = [...document.querySelectorAll("#tab-orders tr")].find(r => r.textContent.includes(act.label || "§") ); if (row) await H.point(row); }
          return exec(act);
        }
        case "ui": {
          let it = act.item;
          const fresh = () => { if (it && it.el.isConnected) return it; uiBuild(); const f = findUI(act.label, 3).find(x => x.tab === (it && it.tab)) || findUI(act.label, 1)[0]; if (f) it = act.item = f; return f || null; };
          if (!fresh()) return fb(act, "عنصر مفقود: " + act.label);
          if (it.tab && !H.visible(it.el)) { await goTab(it.tab); await H.sleep(250); }
          await waitFor(() => { const f = fresh(); return f && H.visible(f.el); }, 2600); if (!it || !it.el.isConnected || !H.visible(it.el)) return fb(act, "غير ظاهر: " + act.label);
          if (act.mode === "point") { await H.point(it.el); return true; }
          if (act.mode === "type") return await H.type(it.el, act.value);
          return await H.click(it.el);
        }
        case "newProduct": { await goTab("products"); const btn = await waitFor(() => q$('[onclick="Admin.editProduct(null)"]')); if (btn && await H.click(btn)) return true; return fb(act, "زر منتج جديد"); }
        case "editProduct": { await goTab("products"); const btn = await waitFor(() => editBtn(act.slug)); if (btn && await H.click(btn)) return true; return fb(act, "زر تعديل المنتج " + act.slug); }
        case "stock": case "price": {
          await goTab("finance"); if (A().finClose && A()._finSel) A().finClose(); const fn = act.type === "stock" ? "setStock" : "setPrice";
          const inp = await waitFor(() => q$('input[onchange*="' + fn + "('" + act.slug + "'" + '"]'));
          if (inp && await H.type(inp, String(act.to))) { lastSlug = act.slug; return true; } return fb(act, "خانة " + fn + " للمنتج " + act.slug);
        }
        case "theme": {
          const m = act.mode === "toggle" ? (typeof AdminTheme !== "undefined" && AdminTheme.mode() === "dark" ? "white" : "dark") : act.mode;
          const b = q$('#theme-sw button[data-m="' + m + '"]'); if (b && await H.click(b)) return true; return fb(act, "مفتاح المظهر");
        }
        case "update": { const b = q$("#au-btn"); if (b) await H.point(b); return exec(act); }
        case "pb": return await pbDo(act, H);
        case "flow": return await flowDo(act, H);
        case "search": {
          const b = q$("#as-btn"); if (b && await H.click(b)) { const i = await waitFor(() => q$("#as-in")); if (i && act.q) await H.type(i, act.q); return true; } return fb(act, "زر البحث");
        }
        case "active": case "discount": { await goTab("products"); const ok = exec(act); const row = editBtn(act.slug); if (row) await H.point(row.closest("tr") || row); return ok; }
        default: return exec(act);
      }
    } catch (e) { logMiss(act, "استثناء: " + (e && e.message)); return exec(act); }
    finally { dims.forEach(x => x.classList.remove("ah-dim")); working = false; }
  }
  /* ذاكرة المحادثة: آخر منتج/طلب/موضوع (10 دقائق) لربط الضمائر الغائبة والمتابعات القصيرة */
  let MEM = { slug: "", order: null, kind: "", topic: null, at: 0 };
  const memNow = () => (Date.now() - MEM.at < 600000 ? MEM : { slug: "", order: null, kind: "", topic: null, at: 0 });
  function remember(r) {
    const base = Date.now() - MEM.at < 600000 ? MEM : null;
    MEM = Object.assign(memUpdate(base, r), { at: Date.now() }); if (r && r.act && r.act.slug) lastSlug = r.act.slug;
  }
  const dataNow = () => { const a = A();  let lowAt = 5; try { lowAt = Number((a.inventory && a.inventory.low) || 5); } catch (e) { } return { mem: memNow(), pb: pbInfo(), ui: { find: findUI }, ctx: { slug: (a.editingSlug || (memNow().kind === "product" ? memNow().slug : "") || lastSlug || "") }, nav: navNow(), kb: KB || [], orders: a.orders || [], products: a.products || [], stockInfo: a.stockInfo ? p => a.stockInfo(p) : null, lowAt }; };

  /* ── المخارج: لوحة «اسألني» إن كانت مفتوحة، وإلا شريط عائم صغير ── */
  const $h = id => document.getElementById(id);
  const AH = () => (typeof AdminHelp !== "undefined" ? AdminHelp : null);
  const panelOpen = () => { const p = $h("ah-panel"); return !!p && p.classList.contains("on") && !!AH() && !!AH().post; };
  const speakOn = () => micOn;                                   /* الردّ بالصوت فقط والميكروفون أخضر */
  let speakingUntil = 0;                                         /* أثناء نطق المساعد لا يُلتقط كلامه كأمر (منع الصدى) */
  /* منع سماع المساعد لنفسه: (1) يُوقَف الاستماع فعلياً من بدء النطق الحقيقي (onstart/onplay) حتى نهايته ثم يُستأنف بعد 750ms؛
     (2) كل جملة نطقها تُحفظ فتُهمَل الأصداء المتأخرة المطابقة لها (isEcho) */
  let speakingNow = false, ttsGen = 0, spoken = [], spokenEnd = 0, wdT = 0, ttsEst = 0;
  function speakBegin(g) {
    if (g !== ttsGen) return; speakingNow = true; clearTimeout(wdT); wdT = setTimeout(() => speakDone(g), Math.min(60000, ttsEst * 2 + 4000));
    if (micOn) { try { stopRec(); } catch (e) { } }
  }
  function speakDone(g) {
    if (g !== ttsGen) return; clearTimeout(wdT); const was = speakingNow; speakingNow = false; spokenEnd = Date.now(); speakingUntil = Math.max(speakingUntil, Date.now() + 700);
    if (was && micOn) { clearTimeout(restartT); restartT = setTimeout(() => { if (micOn && !listening && !speakingNow && !calibrating) startRec(); }, 750); }
  }
  function isEcho(alts) {
    const now = Date.now(), recent = spoken.filter(x => now - x.t < 60000); if (!recent.length) return false;
    if (speakingNow) return true; const since = now - spokenEnd; if (since > 3000) return false;
    const bag = new Set(); recent.forEach(x => x.n.split(/\s+/).forEach(w => w && bag.add(w)));
    const toks = norm(alts[0] || "").split(/\s+/).filter(Boolean); if (!toks.length) return false;
    const hit = toks.filter(w => bag.has(w)).length / toks.length;
    return since < 1500 ? hit >= .99 : (toks.length >= 3 && hit >= .85);
  }
  /* ── النطق: أفضل صوت عربي متاح + تحضير النص (أرقام/رموز/لاتينية) + الصوت الاحترافي اختيارياً ── */
  let curAudio = null; const elCache = new Map();
  const ttsRate = () => { const r = Number(LS("alyssum_voice_rate")); return r >= .6 && r <= 1.4 ? r : .95; };
  const ttsVoices = () => { try { return speechSynthesis.getVoices() || []; } catch (e) { return []; } };
  function ttsPick(kind) {
    const re = kind === "ar" ? /^ar/i : kind === "fr" ? /^fr/i : /^en/i;
    return rankVoices(ttsVoices().filter(v => re.test(v.lang || "")), kind === "ar" ? LS("alyssum_voice_tts") : "")[0] || null;
  }
  const premiumKey = () => (LS("alyssum_el_key") || "").trim();
  const premiumOn = () => !!premiumKey() && LS("alyssum_voice_premium") !== "0";
  function ttsStop() { ttsGen++; speakingNow = false; clearTimeout(wdT); try { speechSynthesis.cancel(); } catch (e) { } try { if (curAudio) { curAudio.pause(); curAudio = null; } } catch (e) { } }
  async function speakPremium(t) {
    const key = premiumKey(), voice = LS("alyssum_el_voice") || "21m00Tcm4TlvDq8ikWAM", txt = t.slice(0, 400);
    let url = elCache.get(txt);
    if (!url) {
      const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voice) + "?output_format=mp3_44100_128", { method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg" }, body: JSON.stringify({ text: txt, model_id: "eleven_multilingual_v2" }) });
      if (!r.ok) throw new Error("tts " + r.status);
      url = URL.createObjectURL(await r.blob()); elCache.set(txt, url);
      if (elCache.size > 40) { const k0 = elCache.keys().next().value; try { URL.revokeObjectURL(elCache.get(k0)); } catch (e) { } elCache.delete(k0); }
    }
    ttsStop(); const g = ++ttsGen, a = new Audio(url); curAudio = a;
    a.onplay = () => speakBegin(g); a.onerror = () => speakDone(g);
    a.onloadedmetadata = () => { if (a.duration) speakingUntil = Date.now() + a.duration * 1000 + 600; }; a.onended = () => { speakingUntil = Date.now() + 500; speakDone(g); };
    await a.play();
  }
  function speakBrowser(clean, fr) {
    ttsStop(); const g = ++ttsGen, parts = [];
    chunkSpeech(clean).forEach(ch => splitScripts(ch).forEach(sg => parts.push(sg)));
    parts.forEach((sg, i) => {
      const kind = fr ? (sg.lang === "ar" ? "ar" : "fr") : (sg.lang === "ar" ? "ar" : "en"), u = new SpeechSynthesisUtterance(sg.t), v = ttsPick(kind);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = kind === "ar" ? "ar-SA" : kind === "fr" ? "fr-FR" : "en-US";
      u.rate = ttsRate(); if (i === 0) u.onstart = () => speakBegin(g); if (i === parts.length - 1) u.onend = u.onerror = () => { speakingUntil = Date.now() + 500; speakDone(g); };
      try { speechSynthesis.speak(u); } catch (e) { }
    });
  }
  function speak(text, fr, force) {
    if (!text || !(speakOn() || force) || typeof speechSynthesis === "undefined") return;
    const clean = prepSpeech(text, TTS_LEX); if (!clean) return;
    ttsEst = Math.min(24000, 900 + clean.length * 80); speakingUntil = Date.now() + ttsEst; spoken.push({ n: norm(clean), t: Date.now() }); if (spoken.length > 6) spoken.shift();
    if (!force && premiumOn()) { speakPremium(clean).catch(() => speakBrowser(clean, fr)); return; }
    speakBrowser(clean, fr);
  }
  /* اختيار صوت المساعد وسرعته (من زر «الصوت» في «اسألني») */
  function chooseVoice() {
    const cur = LS("alyssum_voice_tts"), ar = rankVoices(ttsVoices().filter(v => /^ar/i.test(v.lang || "")), cur), sample = "مرحباً، هذا صوت المساعد. السعر ألفان وخمسمئة دينار.";
    const short = v => v.name.replace(/^(Microsoft|Google)\s+/i, "").replace(/\s*-\s*Arabic.*$/i, "").replace(/\(.*?\)/g, "").trim() + " · " + v.lang;
    const test = () => speakBrowser(prepSpeech(sample, TTS_LEX), false);
    const btns = ar.slice(0, 5).map(v => [short(v) + (v.name === cur ? " ✓" : ""), () => { LS("alyssum_voice_tts", v.name); test(); chooseVoice(); }, v.name === cur ? "ok" : ""]);
    btns.push(["تلقائي (الأفضل)", () => { LS("alyssum_voice_tts", ""); test(); chooseVoice(); }, !cur ? "ok" : ""]);
    btns.push(["أبطأ", () => { LS("alyssum_voice_rate", String(Math.max(.6, +(ttsRate() - .1).toFixed(2)))); test(); }], ["أسرع", () => { LS("alyssum_voice_rate", String(Math.min(1.4, +(ttsRate() + .1).toFixed(2)))); test(); }]);
    if (premiumKey()) btns.push(["الصوت الاحترافي: " + (premiumOn() ? "يعمل" : "متوقف"), () => { LS("alyssum_voice_premium", premiumOn() ? "0" : "1"); chooseVoice(); }, premiumOn() ? "ok" : ""]);
    const natural = ar.some(v => /natural|neural|online/i.test(v.name || "")), edge = /Edg\//.test(navigator.userAgent || "");
    const tip = natural ? " أصوات «Online (Natural)» هي الأوضح." : edge ? " لم تظهر الأصوات الطبيعية بعد: أعد تحميل الصفحة وافتح هذه القائمة ثانية." : " للحصول على أوضح نطق افتح اللوحة بمتصفح Microsoft Edge: تظهر فيه أصوات عربية طبيعية (مثل الجزائر والسعودية) تلقائياً هنا.";
    const out = ar.length ? "اختر صوتاً لأسمعك إياه. السرعة الحالية: " + ttsRate().toFixed(2) + (premiumOn() ? ". الصوت الاحترافي يعمل ويُستعمل بدل صوت المتصفح." : ".") + tip
      : "لا يوجد صوت عربي في متصفحك. للحصول على صوت أوضح: استعمل Microsoft Edge (أصوات طبيعية) أو ثبّت حزمة صوت عربية من إعدادات النظام، أو فعّل الصوت الاحترافي.";
    sink({ out, buttons: btns }); if (!ar.length && !premiumKey()) return; return true;
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
    const wb = $h("ah-wake"); if (wb) { wb.textContent = wakeRequired() ? "كلمة النداء: مفعّلة" : "كلمة النداء: مطفأة"; wb.classList.toggle("off", !wakeRequired()); }
    const hb = $h("ah-hand"); if (hb) { const hon = typeof AdminHand !== "undefined" && AdminHand.enabled(); hb.textContent = hon ? "اليد: تعمل" : "اليد: متوقفة"; hb.classList.toggle("off", !hon); hb.style.display = typeof AdminHand === "undefined" ? "none" : ""; }
    const st = $h("ah-mic-st");
    if (st) st.textContent = !SR ? "متصفحك لا يدعم الصوت. استعمل Chrome أو Edge." : micOn ? (wakeRequired() ? "الميكروفون يعمل — قل: hi " + boutique() + " ثم أمرك. أردّ بالصوت." : "الميكروفون يعمل — تكلّم مباشرة. أردّ بالصوت.") : "الميكروفون متوقف — أردّ بالكتابة. اضغط الميكروفون لتشغيله.";
  }
  /* ── أول مرة فقط: التعرّف على الصوت (hi + اسم المتجر)، ثم تحية عند كل فتح للميكروفون وكلام مباشر بلا نداء ── */
  const enrolled = () => LS("alyssum_voice_enrolled") === "1" || !!(WAKEV && WAKEV.variants && WAKEV.variants.length);
  const wakeRequired = () => LS("alyssum_voice_wake_req") === "1";
  const shopName = () => (siteName() || "").trim();
  function greet(first) {
    const nm = shopName(), fr = lang === "fr-FR";
    const msg = fr ? "Bonjour " + nm + ", je vous écoute." : "مرحباً " + nm + "، أنا أسمعك.";
    sink({ out: msg + (first ? "\n" + (fr ? "Dites par exemple : ouvre les commandes." : "قل مثلاً: افتح الطلبات، أو: قداش من كوموند اليوم؟") : ""), tx: "<i>أسمعك…</i>" });
    speak(msg, fr);
  }
  function toggleMic() { micOn ? micOff(true) : micStart(true); }
  function skipEnroll() { LS("alyssum_voice_enrolled", "1"); calibrating = false; micStart(true); }
  function enroll() {
    const nm = shopName() || wakeNames().first, fr = lang === "fr-FR";
    const msg = fr ? "Bienvenue sur la plateforme ! Pour reconnaître votre voix, dites « hi " + nm + " » une seule fois." : "مرحباً بك في المنصة! لأتعرّف على صوتك قل «hi " + nm + "» مرة واحدة.";
    sink({ out: msg, buttons: [["ابدأ", () => calibrate({ auto: true }), "ok"], ["تخطّي", skipEnroll, "no"]] }); speakForce(msg, fr);
  }
  /* نطق قبل أن يصير الميكروفون أخضر (مرحلة التعرّف الأولى) */
  function speakForce(text, fr) { const w = micOn; micOn = true; speak(text, fr); micOn = w; }
  function micStart(user) {
    if (!SR) { paintMic(); if (user) sink({ out: "متصفحك لا يدعم الأوامر الصوتية. استعمل Chrome أو Edge.", err: true }); return; }
    if (user && !enrolled() && !calibrating) { enroll(); return; }
    micOn = true; LS("alyssum_voice_mic", "1"); startRec(); paintMic();
    if (user) greet(!LS("alyssum_voice_greeted")); if (user) LS("alyssum_voice_greeted", "1");
  }
  function micOff(user) {
    micOn = false; LS("alyssum_voice_mic", "0"); stopRec(); paintMic(); ttsStop();
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

  /* ── معايرة صوت صاحب المتجر: يقول «hi اسم متجره» مرة واحدة (وتُعاد فقط إن كان الصوت غير واضح) فتُحفظ الصيغ التي يلتقطها المتصفح لنطقه ── */
  function oneShot() {
    return new Promise(res => {
      if (!SR) return res(null);
      const r = new SR(); r.lang = lang; r.interimResults = false; r.continuous = false; r.maxAlternatives = 5; let done = false;
      const fin = v => { if (done) return; done = true; clearTimeout(tm); try { r.abort && r.abort(); } catch (e) { } res(v); }, tm = setTimeout(() => fin(null), 9000);
      r.onresult = e => { const rr = e.results[e.results.length - 1], out = []; for (let k = 0; k < rr.length; k++) out.push({ t: rr[k].transcript, c: Number(rr[k].confidence) || 0 }); fin(out); };
      r.onerror = () => fin(null); r.onend = () => fin(null);
      try { r.start(); } catch (e) { fin(null); }
    });
  }
  /* تشابه نصّين (مسافة تحرير مُطبَّعة) لتقدير إن كان المسموع يشبه اسم المتجر */
  function sim(a, b) {
    if (!a || !b) return 0; const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i].concat(Array(n).fill(0)));
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return 1 - d[m][n] / Math.max(m, n);
  }
  /* هل المسموع واضح بما يكفي؟ (قصير، يشبه اسم المتجر أو ثقته عالية) ← الصيغ المقبولة، وإلا null فيُعاد السؤال */
  function judgeTake(alts) {
    const exp = norm(siteName()).split(" ").filter(w => w.length >= 3);
    const parts = alts.map(a => { const n = norm(a.t), m = GREET.exec(n), rest = (m ? n.slice(m[0].length) : n).trim(); return { rest, c: a.c, words: rest ? rest.split(" ").length : 0 }; }).filter(p => p.rest.length >= 3 && p.words <= 3);
    if (!parts.length) return null;
    const near = p => exp.some(e => p.rest.includes(e) || e.includes(p.rest) || sim(p.rest, e) >= 0.55), top = parts[0], noConf = alts.every(a => !a.c);
    if (!(parts.some(near) || top.c >= 0.6 || noConf)) return null;
    const keep = parts.filter(p => near(p) || p.c >= 0.5 || noConf).map(p => p.rest);
    return [...new Set(keep.length ? keep : [top.rest])].slice(0, 12);
  }
  async function calibrate(opt) {
    opt = opt || {};
    if (!SR) { sink({ out: "متصفحك لا يدعم الأوامر الصوتية. استعمل Chrome أو Edge.", err: true }); return; }
    if (calibrating) return; calibrating = true;
    const was = micOn; stopRec(); micOn = false; paintMic(); pending = null;
    const resume = () => { calibrating = false; if (was) { micOn = true; startRec(); paintMic(); } };
    const nm = shopName() || wakeNames().first, fr = lang === "fr-FR";
    let variants = null;
    for (let i = 1; i <= 3 && !variants; i++) {                          /* مرة واحدة، وتُعاد فقط إن كان الصوت غير واضح */
      const ask = i === 1 ? (fr ? "Dites « hi " + nm + " » une seule fois." : "قل «hi " + nm + "» مرة واحدة الآن…") : (fr ? "Je ne vous ai pas bien entendu. Répétez « hi " + nm + " »." : "لم أسمعك بوضوح. أعد قول «hi " + nm + "» بصوت أوضح…");
      sink({ out: ask, tx: "<i>أسمعك…</i>" }); if (i > 1) speakForce(ask, fr);
      const alts = await oneShot(); await new Promise(r => setTimeout(r, 300));
      if (alts) variants = judgeTake(alts);
    }
    if (!variants) { calibrating = false; sink({ out: "لم يتضح الصوت. جرّب في مكان أهدأ وقرّب الميكروفون.", err: true, buttons: [["أعد المحاولة", () => calibrate(opt), "ok"], ["تخطّي", skipEnroll, "no"]] }); if (!opt.auto) resume(); return; }
    WAKEV = { variants, lang, at: Date.now() }; LS("alyssum_voice_wake", JSON.stringify(WAKEV)); LS("alyssum_voice_enrolled", "1"); WAKE_RX = null;
    if (opt.auto) { calibrating = false; micStart(false); LS("alyssum_voice_greeted", "1"); const hello = (fr ? "Bonjour " : "مرحباً ") + shopName(); sink({ out: "تعرّفتُ على صوتك. " + hello + (fr ? ", je vous écoute." : "، أنا أسمعك.") + "\n" + (fr ? "Parlez directement : « ouvre les commandes »." : "تكلّم مباشرة بلا كلمة نداء: «افتح الطلبات»، «قداش من كوموند اليوم؟».") }); speak(hello, fr); if (hud) hud.classList.add("help"); return; }
    sink({ out: "تم التعرّف على صوتك: " + variants.map(v => "«hi " + v + "»").join("، ") + "." }); speak(fr ? "C'est réglé" : "تم", fr); resume(); paintMic();
  }
  function toggleWakeReq() { LS("alyssum_voice_wake_req", wakeRequired() ? "0" : "1"); paintMic(); sink({ out: wakeRequired() ? "صار الاستماع يتطلب كلمة النداء «hi " + shopName() + "»." : "أستمع مباشرة بلا كلمة نداء." }); }
  function resetWake() { WAKEV = null; WAKE_RX = null; LS("alyssum_voice_wake", ""); paintMic(); sink({ out: "أُعيد ضبط كلمة النداء إلى اسم المتجر." }); }

  function handle(alts, opt) {
    opt = opt || {};
    if (working) return;                              /* اليد تعمل: لا أقاطعها */
    if (!opt.typed && (Date.now() < speakingUntil || speakingNow || isEcho(alts))) return;   /* المساعد يتكلم الآن أو هذا صدى كلامه: لا نلتقطه */ const norms = alts.map(norm);
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
    let direct = false;
    if (micOn && !opt.typed) {
      const wakeAll = norms.map(x => wakeRx().exec(x)), i = wakeAll.findIndex(Boolean);
      if (i >= 0) {                                   /* ذُكرت كلمة النداء (اختيارية بعد التعرّف الأول) */
        list = norms.map((x, k) => (wakeAll[k] ? x.slice(wakeAll[k][0].length) : x));
        if (!list[i]) { armedUntil = Date.now() + 10000; sink({ tx: "أسمعك…", out: lang === "fr-FR" ? "Je vous écoute." : "تفضّل، قل الأمر." }); speak(lang === "fr-FR" ? "Je vous écoute" : "تفضّل", lang === "fr-FR"); return; }
        list = list.map(x => x || list[i]); armedUntil = 0;
      } else if (Date.now() < armedUntil) { armedUntil = 0; }
      else if (wakeRequired()) return;               /* وضع كلمة النداء الإجبارية */
      else direct = true;                            /* كلام مباشر: ننفّذ المفهوم فقط ونتجاهل الباقي بصمت */
    }
    const d = dataNow(); let best = null;
    for (const a of list) { const r = parse(a, d); if (r.kind !== "unknown") { best = r; break; } if (!best) best = r; }
    if (direct && (best.kind === "unknown" || (best.kind === "ask" && !best.explicit) || best.kind === "stop")) return;   /* حديث عادي لا أمر */
    if (!opt.typed) mirrorUser(list[0]);
    run(best, list[0]);
  }
  async function run(r, heardText) {
    remember(r);
    const nt = norm(heardText || ""), fr = /[a-z]{3,}/.test(nt) && !/[ء-ي]/.test(nt);
    if (r.kind === "stop") { sink({ out: "" }); return; }
    if (r.kind === "help") { showHud({ out: r.say }); hud.classList.add("help"); speak(r.say, fr); return; }
    if (r.kind === "ask") {
      sink({ out: "أسأل مساعد اللوحة…" });
      try { if (AH()) { AH().show().then(() => AH().ask(r.q)); } } catch (e) { }
      return;
    }
    if (r.kind === "need") {
      pending = r; clearTimeout(pendingT); pendingT = setTimeout(() => { pending = null; }, r.slot === "flow" ? 120000 : 30000);
      sink({ out: r.say, buttons: (r.chips || []).map((c, i) => [c, () => handle([c], { typed: true }), i === 0 ? "ok" : ""]).concat([["إلغاء", () => { pending = null; sink({ out: "تم الإلغاء." }); }, "no"]]) }); speak(r.say, fr); return;
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
    sink({ out: r.say }); if (r.act && ["nav","orders","newProduct","editProduct","stock","price","theme","search","pb"].includes(r.act.type)) speak(r.say, fr);
    const ok = await execVia(r.act);
    if (ok && r.act && r.act.slug) lastSlug = r.act.slug;
    if (!ok) sink({ out: "هذا القسم غير متاح في لوحتك.", err: true }); else if (!(r.act && ["nav","orders","newProduct","editProduct","stock","price","theme","search","pb"].includes(r.act.type))) speak(r.say, fr);
  }
  const optBtns = opts => opts.map((o, i) => [(i + 1) + "- " + o.label, () => chooseOpt(i), i === 0 ? "ok" : ""]);
  async function chooseOpt(i) {
    const p = pending; if (!p || !p.options || !p.options[i]) return; pending = null; clearTimeout(pendingT);
    const o = p.options[i];
    if (o.text) { handle([o.text], { typed: true }); return; }
    const ok = await execVia(o.act);
    let out = ok ? "أفتح " + o.label + "." : "هذا القسم غير متاح في لوحتك.";
    if (ok && o.act.type === "kb" && o.act.ans) out += "\n" + o.act.ans.replace(/\*\*|`/g, "").split(/\n/)[0].slice(0, 220);
    sink({ out, err: !ok }); if (ok) speak("أفتح " + o.label, false);
  }
  async function confirmPending(yes) {
    const p = pending; pending = null; clearTimeout(pendingT); if (!p) return;
    if (!yes) { sink({ out: "تم الإلغاء." }); return; }
    const isFlow = p.act && p.act.type === "flow"; sink({ out: isFlow ? "أبدأ التنفيذ…" : "أنفّذ…" });
    const ok = await execVia(p.act); if (ok && p.act && p.act.slug) lastSlug = p.act.slug;
    if (!isFlow || !ok) sink({ out: ok ? "تم." : "تعذّر التنفيذ.", err: !ok }); if (ok && !isFlow) speak("تم", false);
  }
  /* أمر مكتوب في محادثة «اسألني»: ينفَّذ إن كان أمراً مفهوماً، وإلا يبقى سؤالاً لقاعدة المعرفة */
  const TYPED_OK = new Set(["flow", "builder", "orderAction", "hand", "nav", "orders", "answer", "newProduct", "editProduct", "theme", "update", "site", "search", "stockChange", "priceChange", "visibility", "discount", "need", "negated"]);
  function tryCommand(q) {
    if (pending) { handle([q], { typed: true }); return true; }
    const r = parse(q, dataNow()); if (!TYPED_OK.has(r.kind)) return false;
    if (r.kind === "nav" && !V_OPEN.test(" " + norm(q) + " ")) return false;   /* اسم قسم بلا فعل «افتح»: لا يفتح القسم، بل يبحث في الشروحات */
    run(r, q); return true;
  }

  function init() {
    const saved = LS("alyssum_voice_lang"); if (saved === "fr-FR" || saved === "ar-DZ") lang = saved;
    loadKB(); loadLex(); loadStoreName(); try { speechSynthesis.getVoices(); } catch (e) { }
    setTimeout(() => { try { const r = selfTest(); if (!r.ok) console.warn("[AdminVoice] عناصر اليد المتغيّرة:", r.missing.join("، ")); announceNew(); } catch (e) { } }, 9000);
    let tries = 0; const tick = () => { paintMic(); if (!$h("ah-mic") && tries++ < 40) setTimeout(tick, 500); }; tick();
    if (LS("alyssum_voice_mic") === "1" && SR) setTimeout(() => { if (!micOn) { micOn = true; startRec(); paintMic(); } }, 1500);   /* يستأنف إن كان الإذن ممنوحاً سابقاً */
    document.addEventListener("keydown", e => { if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "v" || e.key === "V" || e.key === "م")) { e.preventDefault(); toggleMic(); } });
  }
  if (typeof document !== "undefined" && typeof window !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init(); }
  const api = { _spk: (t, ago) => { spoken.push({ n: norm(t), t: Date.now() }); spokenEnd = Date.now() - (ago || 0); speakingNow = false; }, _echo: isEcho, chooseVoice, arNum, prepSpeech, chunkSpeech, splitScripts, rankVoices, memUpdate, examples: () => EXAMPLES_Q.slice(), memory: () => memNow(), quiet: () => Date.now() >= speakingUntil, toggleWakeReq, enroll, exec: execVia, busy: () => working, tabLabel: id => { const n = navNow().find(x => x.id === id); return n ? n.label : (TAB_LABEL[id] || id); }, showMe: c => execVia({ type: "ui", mode: "point", item: c, label: c.label, tab: c.tab }), findUI, showTab, selfTest, announceNew, toggleHand: () => { if (typeof AdminHand !== "undefined") { AdminHand.setEnabled(!AdminHand.enabled()); paintMic(); } }, calibrate, resetWake, wakeNames, _rx: () => ({ V_INC, V_ADD, V_DEC, V_SET, V_CHANGE, V_EDIT, V_HIDE, V_SHOWON, V_DEL, W_PIECE, W_STOCK, W_PRICE, W_DISC, W_THIS, W_PRODUCT }), parse, pickOption, fillSlot, findCands, numberIn, norm, useLexicon, handle, tryCommand, toggleMic, micStart, micOff, paint: paintMic, isMic: () => micOn, HELP_TXT, matchProduct, phoneOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  return api;
})();
