/* فهم اللغة لوكيل ALYSSUM (المرحلة 10): عربية فصحى وعامية جزائرية وفرنسية، مع متابعة السياق.
   محلّل دلالي حتمي (قواعد + كيانات + مطابقة تقريبية لأسماء المنتجات/الزبائن/الولايات من **بيانات المتجر الحقيقية** المرسلة في السياق)؛ لا يستدعي أي خدمة ولا يخترع بيانات.
   مخرجه «خطة نيّة» فقط {intent,args,lang,conf,follow}؛ لا يُنفَّذ شيء هنا، وكل أداة تُتحقَّق من مخططها وصلاحيتها في النواة. */
(() => {
  "use strict";
  const AD = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
  /* تطبيع: حذف التشكيل والتطويل والأaccents، توحيد الألف/الياء/التاء المربوطة/الواو الهمزة، ڨ→ق، ڤ→ف، أرقام عربية→لاتينية */
  const N = s => String(s == null ? "" : s).replace(/[٠-٩]/g, d => AD[d]).toLowerCase().normalize("NFKD").replace(/[ً-ٰٟـ̀-ͯ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/[ڨگ]/g, "ق").replace(/ڤ/g, "ف").replace(/['’`]/g, " ").replace(/[^\p{L}\p{N}\s\-_.:/#]/gu, " ").replace(/\s+/g, " ").trim();
  const PRE = "(?:و|ف|ب|ل|ك|ال|لل|وال|بال|فال|كال)?";
  const rx = (w, suf) => new RegExp("(?:^|\\s)" + PRE + "(?:" + w + ")" + (suf === false ? "" : "(?:ه|ها|هم|هما|نا|ي|ين|ون|ات|ان|s|es|x)?") + "(?=\\s|$|[?!.,:;])", "u");
  const mk = list => list.map(w => rx(N(w).replace(/\s+/g, "\\s+(?:ال)?")));
  const mkx = list => list.map(w => rx(N(w).replace(/\s+/g, "\\s+(?:ال)?"), false)); /* بلا لواحق: أفعال الأمر/الموافقة تختلف عن صيغ الحالة (confirmées ≠ confirme) */
  const any = (s, rs) => rs.some(r => r.test(s));
  const W = {
    show: mk(["وريني", "ورني", "ورّيني", "اعرض", "اعرضلي", "افتح", "افتحلي", "جيب", "جيبلي", "وين", "فين", "اظهر", "شوف", "ابغي نشوف", "حاب نشوف", "نحب نشوف", "قولي", "montre", "montre moi", "affiche", "ouvre", "liste", "donne", "voir", "show", "list", "open", "display", "اعطني", "اعطيني", "اريد", "ابي", "ابغي", "عندي"]),
    order: mk(["طلب", "طلبات", "طلبيه", "طلبيات", "كوموند", "كومند", "commande", "commandes", "order", "orders"]),
    sales: mk(["مبيعات", "مبيع", "بعنا", "بيعنا", "بعت", "بيع", "المبيعات", "مداخيل", "مدخول", "دخل", "ارباح", "ربح", "رقم الاعمال", "chiffre", "ventes", "vendu", "vendus", "revenu", "revenus", "ca", "sales", "revenue", "sold", "sell", "selling", "turnover", "كسبنا", "خدمنا"]),
    howmuch: mk(["كم", "شحال", "قداش", "combien", "how much", "how many", "قدّاش", "كيفاش"]),
    top: mk(["اكثر", "اكتر", "افضل", "احسن", "اعلي", "اعلى", "الاكثر", "plus", "meilleur", "meilleurs", "top", "best", "bezzaf", "بزاف", "ياكثر"]),
    product: mk(["منتج", "منتجات", "بضاعه", "سلعه", "produit", "produits", "article", "articles", "product", "products", "تباع", "يتباع", "نباع", "vend", "vendu"]),
    price: mk(["سعر", "اسعار", "ثمن", "بشحال", "بقداش", "prix", "tarif", "price", "cout", "coute", "combien coute", "شحال سعر"]),
    stock: mk(["مخزون", "المخزون", "ستوك", "stock", "inventaire", "بقي", "بقى", "باقي", "ما بقي", "نفد", "نفاد", "نفذ", "نفدت", "rupture", "reste", "disponible", "dispo", "متوفر", "متوفره", "كميه", "الكميه", "quantite"]),
    low: mk(["منخفض", "قليل", "ناقص", "قارب", "bas", "faible", "low", "critique", "نفد", "نفاد", "rupture", "ينفد"]),
    search: mk(["ابحث", "دور", "دورلي", "ابحثلي", "لقي", "لقى", "cherche", "recherche", "trouve", "search", "find", "اعطني", "عن"]),
    confirm: mkx(["اكد", "اكدلي", "اكدو", "تاكيد", "اكّد", "تاكد", "اكدي", "صادق", "وافق", "validate", "valide", "valider", "confirme", "confirmer", "confirmez", "confirm", "approuve", "approuver"]),
    yes: mkx(["نعم", "ايه", "اه", "ايوه", "واه", "اي", "اكيد", "موافق", "تمام", "اوكي", "اوك", "ok", "okay", "oui", "ouais", "d accord", "yes", "yep", "sure", "go ahead", "do it", "proceed", "تفضل", "كمل", "ايه اكد", "نعم اكد"]),
    no: mkx(["لا", "لأ", "لاه", "non", "no", "الغ", "الغي", "الغاء", "ارجع", "وقف", "قف", "stop", "annule", "annuler", "cancel", "ما تاكدش", "لا تؤكد", "ماشي", "رفض", "ارفض"]),
    cust: mk(["زبون", "الزبون", "زبائن", "عميل", "العميل", "عملاء", "client", "clients", "customer", "customers", "كليون", "كليان"]),
    settings: mk(["اعدادات", "الاعدادات", "اعداد", "حمايه", "حمايه الطلبات", "guard", "protection", "parametre", "parametres", "settings", "config", "تكوين", "ضبط"]),
    panel: mk(["لوحه", "لوحة", "panneau", "panel", "نافذه", "نافذة"]),
    help: mk(["مساعده", "ساعدني", "ماذا تستطيع", "وش تقدر", "واش تقدر", "شو تقدر", "كيفاش نستعملك", "aide", "aidemoi", "help", "que sais tu faire", "que peux tu", "capacites", "اوامر", "ماذا تفعل", "what can you do", "what can i ask", "capabilities", "what do you do"]),
    hello: mk(["مرحبا", "اهلا", "السلام", "سلام", "صباح الخير", "مساء الخير", "هلا", "salut", "bonjour", "bonsoir", "coucou", "hello", "hi", "hey"]),
    thanks: mk(["شكرا", "شكراً", "بارك الله فيك", "يعطيك الصحه", "جزاك الله", "merci", "thanks", "thx", "الله يعطيك الصحه"]),
    demo: mkx(["هذا", "هذه", "هاد", "هاذ", "هاذا", "هاذي", "هادي", "هده", "هدا", "ce", "cette", "celui", "celle", "celui ci", "celle ci", "ذلك", "ذاك", "نفسه", "نفسها", "this", "that", "it", "same"]),
    dz: mk(["واش", "شحال", "وريني", "ورني", "بزاف", "علاش", "فين", "كاش", "ماشي", "حاب", "نحب", "ابغي", "راه", "لي", "ديال", "دوك", "غدوه", "برك", "هاذ", "هاد", "نهار", "قداش", "وش", "شو", "نبغي", "كيفاش", "ديما", "تاع", "ماتاكدش", "ما تاكدش", "تاكدو", "لقيتو", "بعنا", "نباع", "يتباع"]),
    fr: mk(["le", "la", "les", "des", "du", "est", "que", "combien", "montre", "commande", "commandes", "produit", "aujourd hui", "hier", "semaine", "mois", "quel", "quelle", "qui", "non", "oui", "stock", "prix"]),
  };
  const P = { /* فترات */
    today: mk(["اليوم", "ليوم", "نهار ليوم", "هاد النهار", "هذا اليوم", "ce jour", "aujourd hui", "aujourdhui", "today", "اليومي", "هاذ النهار"]),
    yesterday: mk(["امس", "البارح", "البارحه", "البارحة", "امبارح", "hier", "yesterday"]),
    week: mk(["الاسبوع", "اسبوع", "هذا الاسبوع", "هاد الاسبوع", "هاذ الاسبوع", "سيمان", "semaine", "week", "7 ايام", "سبعه ايام", "اخر 7 ايام"]),
    month: mk(["الشهر", "شهر", "هذا الشهر", "هاد الشهر", "هاذ الشهر", "mois", "month", "30 يوم", "30 jours", "ثلاثين يوم"]),
    all: mk(["كامل", "الكل", "كل الوقت", "منذ البدايه", "من البدايه", "طول", "ديما", "toujours", "depuis le debut", "tout", "all time", "الاجمالي", "اجمالي"]),
  };
  const ST = [ /* الحالات: السلبيات أولاً */
    ["nouvelle", mk(["غير مؤكد", "غير مؤكده", "غير مؤكدين", "ما تاكدش", "ما تاكدوش", "ماتاكدش", "ماتاكدوش", "ما اتاكدش", "لم تؤكد", "لم يتم تاكيد", "لم يتم تاكيدها", "بلا تاكيد", "بدون تاكيد", "تحتاج تاكيد", "محتاجه تاكيد", "تستني التاكيد", "في انتظار التاكيد", "في الانتظار", "بانتظار التاكيد", "الجديده", "جديده", "جديد", "الجدد", "non confirme", "non confirmees", "non confirmee", "non confirmes", "pas confirme", "pas confirmees", "en attente", "a confirmer", "nouvelle", "nouvelles", "unconfirmed", "pending", "new orders", "غير مأكدين"])],
    ["confirmee", mk(["مؤكد", "مؤكده", "مؤكدين", "تاكدو", "تاكدت", "تم تاكيدها", "confirme", "confirmee", "confirmees", "confirmes", "confirmed"])],
    ["expediee", mk(["في الطريق", "مرسل", "مرسله", "المرسله", "تم ارسالها", "shipped", "expedie", "expediee", "expedies", "en route", "en livraison", "en cours de livraison", "خرجو", "تبعتو"])],
    ["livree", mk(["تم التسليم", "مسلم", "مسلمه", "المسلمه", "سلمو", "تسلمو", "وصلو", "livre", "livree", "livrees", "livres", "delivered"])],
    ["annulee", mk(["ملغي", "ملغيه", "ملغاه", "الملغاه", "الملغيه", "الغيو", "تلغات", "annule", "annulee", "annulees", "annules", "cancelled", "canceled"])],
    ["echec", mk(["فشل التوصيل", "فشل", "مرتجع", "مرتجعه", "ريتور", "retour", "retours", "echec", "echecs", "failed", "returned", "راجعه"])],
  ];
  const ORD = [[1, mk(["الاول", "الاولي", "اول", "الاولى", "premier", "premiere", "1er", "1ere", "first", "الاولا"])], [2, mk(["الثاني", "الثانيه", "ثاني", "deuxieme", "second", "seconde", "2eme", "2e"])], [3, mk(["الثالث", "الثالثه", "ثالث", "troisieme", "3eme", "3e", "third"])], [4, mk(["الرابع", "الرابعه", "quatrieme", "4eme", "fourth"])], [5, mk(["الخامس", "الخامسه", "cinquieme", "5eme", "fifth"])], ["last", mk(["اخر", "الاخير", "الاخيره", "dernier", "derniere", "last"])]];

  const lev1 = (a, b) => { if (a === b) return true; if (Math.abs(a.length - b.length) > 1) return false; let i = 0, j = 0, e = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++e > 1) return false; if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; } } return e + (a.length - i) + (b.length - j) <= 1; };
  const STOPTOK = new Set(("ال في من على الى عن مع او و ثم هل ما ماذا كيف هو هي هذا هذه ذلك ان انا انت لا نعم لي لك لنا له لها كل بعد قبل عند اذا كان كانت يكون تكون اي ايه le la les de du des un une et ou est que qui quoi pour avec sur dans ce cet cette ces je tu il elle nous vous au aux en a the of to and is are 500g 250g 1kg 500 250").split(" "));
  const QW = new Set(["شنو", "واش", "ايش", "اش", "ماهو", "ماهي", "قداش", "شحال", "quel", "quelle", "est", "combien", "quoi", "what", "how", "much", "son", "sa", "ses", "il", "elle", "du", "de"]);
  const GENERIC = new Set(["منتج", "منتجات", "produit", "produits", "product", "products", "سعر", "ثمن", "prix", "price", "عرض", "عروض", "offre"]);
  const toks = s => N(s).split(" ").filter(w => w.length > 1 && !STOPTOK.has(w)).map(w => w.replace(/^(?:ال|لل|وال|بال)/, ""));
  /* مطابقة منتج من الفهرس الحقيقي: أفضل تغطية لرموز العنوان/المعرّف في الجملة (تحمّل خطأ إملائي واحد) */
  function matchProduct(text, catalog) {
    const ut = toks(text), us = N(text); let best = null, tie = false;
    (catalog || []).forEach(p => {
      const t = toks(p.title).filter(w => w.length >= 3 && !GENERIC.has(w)), sl = N(p.slug || ""); if (!t.length && !sl) return;
      if (sl && us.includes(sl)) { best = best && best.score >= 1 ? best : { slug: p.slug, title: p.title, score: 1.5 }; return; }
      let hit = 0; t.forEach(w => { if (ut.some(u => u === w || (w.length >= 5 && lev1(u, w)) || (u.length >= 4 && w.length >= 4 && (w.startsWith(u) || u.startsWith(w))))) hit++; });
      const sc = t.length ? hit / t.length : 0; if (hit > 0 && sc >= .5) { if (!best || sc > best.score) { best = { slug: p.slug, title: p.title, score: sc }; tie = false; } else if (best.score < 1.5 && Math.abs(sc - best.score) < .01) tie = true; }
    });
    return tie ? null : best; /* تعادل بين منتجين بنفس الدرجة = غموض ← يُعامَل بحثاً لا تحديداً */
  }
  function matchName(text, names) { /* أسماء زبائن حقيقية (من الطلبات): تطابق كل رموز الاسم أو أول وآخر رمز */
    const ut = new Set(N(text).split(" ")); let best = null;
    (names || []).forEach(nm => { const t = N(nm).split(" ").filter(w => w.length > 1); if (!t.length) return; const hit = t.filter(w => ut.has(w) || [...ut].some(u => u.length >= 4 && lev1(u, w))).length; if (hit >= Math.min(2, t.length) && (!best || hit > best.hit)) best = { name: nm, hit }; if (t.length === 1 && hit === 1 && !best) best = { name: nm, hit }; });
    if (best) return best.name;
    /* اسم أول فقط: يُقبل إن لم يطابق إلا اسماً واحداً (وإلا غموض ← لا تخمين) */
    const one = [...new Set((names || []).filter(nm => N(nm).split(" ").some(w => w.length >= 4 && !STOPTOK.has(w) && !GENERIC.has(w) && ut.has(w))))];
    return one.length === 1 ? one[0] : null;
  }
  const FRW = /\b(le|la|les|des|du|un|une|est|sont|combien|commandes?|montre|montrez|confirme|confirmer|aujourd|hui|ventes?|vendu|vendus|produits?|prix|quel|quelle|quels|mes|moi|je|pour|avec|dans|cette|oui|merci|bonjour|salut|derniere|dernieres|non|attente|annulees?|livrees?|expediees?)\b/g, ENW = /\b(the|show|me|how|many|much|what|which|orders?|sales?|today|yesterday|confirm|confirmed|unconfirmed|pending|price|prices|product|products|stock|inventory|low|best|selling|seller|top|please|thanks|thank|hello|hi|my|is|are|of|for|in|this|that|customer|customers|status|open|panel|week|month|did|we|sell|sold|revenue|how|any|list|find|search|cost|costs|settings|protection|can|you|do|help|yes|no|cancel|cancelled|delivered|shipped|failed|first|second|third|last)\b/g;
  const detectLang = (raw, n) => { const lat = (String(raw).match(/[A-Za-z]/g) || []).length, ar = (String(raw).match(/[\u0600-\u06FF]/g) || []).length; if (lat > ar) { const low = String(raw).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""), f = (low.match(FRW) || []).length + (/[éèêàçùâîôû]/i.test(String(raw)) ? 1 : 0), e = (low.match(ENW) || []).length; return e > f ? "en" : "fr"; } return any(n, W.dz) ? "dz" : "ar"; };
  const orderId = raw => { const m = /\b([SM]\d{6}-[A-Z0-9]{4,16})\b/i.exec(String(raw)); return m ? m[1].toUpperCase() : null; };
  const period = n => any(n, P.yesterday) ? "yesterday" : any(n, P.today) ? "today" : any(n, P.week) ? "week" : any(n, P.month) ? "month" : any(n, P.all) ? "all" : null;
  const status = n => { for (const [k, r] of ST) if (any(n, r)) return k; return null; };
  const ordinal = n => { const m = /(?:رقم|n°|no|num|numero|#)\s*(\d{1,2})\b/.exec(n); if (m) return +m[1]; for (const [k, r] of ORD) if (any(n, r)) return k; return null; };
  const wilayaOf = (n, list) => (list || []).find(w => { const x = N(w); return x.length >= 3 && (" " + n + " ").includes(" " + x + " ") || (x.length >= 4 && new RegExp("(?:^|\\s)(?:ب|في|ل|من|a|de)?" + x + "(?:\\s|$)").test(n)); }) || null;
  const limitOf = n => { const m = /(?:اخر|dernier|derniers|last|top|اول)\s*(\d{1,2})\b/.exec(n) || /\b(\d{1,2})\s*(?:طلبات|طلب|commandes|orders)\b/.exec(n); return m ? Math.min(50, Math.max(1, +m[1])) : null; };

  const LABEL = {
    "sales.summary": { ar: "ملخّص المبيعات", fr: "Résumé des ventes", en: "Sales summary" }, "sales.top_product": { ar: "المنتج الأكثر مبيعاً", fr: "Produit le plus vendu", en: "Best-selling product" }, "orders.list": { ar: "عرض الطلبات", fr: "Afficher les commandes", en: "List orders" },
    "orders.get": { ar: "تفاصيل طلب", fr: "Détails d'une commande", en: "Order details" }, "orders.confirm": { ar: "تأكيد طلب", fr: "Confirmer une commande", en: "Confirm an order" }, "products.search": { ar: "البحث عن منتج", fr: "Chercher un produit", en: "Search products" }, "products.get": { ar: "تفاصيل منتج", fr: "Détails d'un produit", en: "Product details" },
    "inventory.read": { ar: "قراءة المخزون", fr: "Lire le stock", en: "Read stock" }, "customers.find": { ar: "طلبات زبون", fr: "Commandes d'un client", en: "Customer orders" }, "settings.read": { ar: "قراءة إعداد", fr: "Lire un réglage", en: "Read a setting" }, "ui.open_panel": { ar: "فتح لوحة", fr: "Ouvrir un panneau", en: "Open a panel" },
    "select_order": { ar: "تحديد طلب", fr: "Sélectionner une commande", en: "Select an order" }, "approve": { ar: "موافقة", fr: "Approbation", en: "Approval" }, "reject": { ar: "رفض", fr: "Refus", en: "Rejection" }, "help": { ar: "ما أستطيع فعله", fr: "Mes capacités", en: "What I can do" }, "hello": { ar: "تحية", fr: "Salutation", en: "Greeting" }, "thanks": { ar: "شكر", fr: "Remerciement", en: "Thanks" }, "count": { ar: "عدد النتائج", fr: "Nombre de résultats", en: "Result count" },
  };
  /* ───── التحليل الرئيس ───── */
  function parse(raw, ctx) {
    ctx = ctx || {}; const text = String(raw == null ? "" : raw).slice(0, 400), n = N(text), lang = detectLang(text, n), tk = n ? n.split(" ") : [];
    const out = (intent, args, extra) => Object.assign({ intent, args: args || {}, lang, conf: 0.9, follow: false, norm: n }, extra || {});
    if (!n) return out("unknown", {}, { conf: 0, reason: "empty" });
    const oid = orderId(text), per = period(n), st = status(n), ord = ordinal(n), demo = any(n, W.demo), lim = limitOf(n);
    const isOrder = any(n, W.order), isSales = any(n, W.sales), isTop = any(n, W.top), isProd = any(n, W.product), isStock = any(n, W.stock), isLow = any(n, W.low), isPrice = any(n, W.price), isShow = any(n, W.show), isHow = any(n, W.howmuch), isCust = any(n, W.cust);
    const pm = matchProduct(text, ctx.catalog), wil = wilayaOf(n, ctx.wilayas), nm = matchName(text, ctx.names);
    /* 1) ردود على طلب موافقة معلَّق */
    if (ctx.pending && tk.length <= 5) { const y = any(n, W.yes) || any(n, W.confirm), no = any(n, W.no) && !y; if (y && !no) return out("approve", {}, { conf: 1 }); if (no) return out("reject", {}, { conf: 1 }); }
    /* 2) انتظار توضيح (أي طلب؟) */
    if (ctx.awaiting && ctx.awaiting.kind === "order_for_confirm") { const sel = oid ? { id: oid } : ord ? { ordinal: ord } : nm ? { name: nm } : null; if (sel) return out("orders.confirm", sel, { follow: true }); if (any(n, W.no)) return out("reject", {}, { conf: 1 }); }
    /* 3) تأكيد طلب */
    if (any(n, W.confirm) && st !== "nouvelle" && (isOrder || oid || demo || ord || nm || tk.length <= 4)) { const a = oid ? { id: oid } : ord ? { ordinal: ord } : nm ? { name: nm } : {}; if (demo && !oid && !ord) a.demonstrative = true; return out("orders.confirm", a); }
    /* 4) أدوات القراءة بالكلمات المفتاحية */
    if (any(n, W.panel)) { const pn = /(?:طلب|commande|order)/.test(n) ? "ord" : /(?:منتج|produit|product)/.test(n) ? "prod" : /(?:مخزون|stock|inventory)/.test(n) ? "inv" : /(?:تحليل|analyse|analytic|احصاء|stat)/.test(n) ? "ana" : null; if (pn) return out("ui.open_panel", { panel: pn }); }
    if (/(?:حمايه|guard|protection)/.test(n) || (any(n, W.settings) && !isOrder)) return out("settings.read", { key: /(?:مخزون|stock)/.test(n) && !/(?:حمايه|guard|protection)/.test(n) ? "stock" : "guard" });
    if (isTop && (isProd || isSales || any(n, W.howmuch) || /(?:مبيعا|تباع|vend)/.test(n))) return out("sales.top_product", { period: per || "all", by: /ايراد|دخل|revenu|chiffre|ca\b/.test(n) ? "revenue" : "qty" });
    if (isSales || (isHow && /(?:بعنا|باع|vendu|sold|sell|دخل|ربح)/.test(n))) return out("sales.summary", { period: per || "today" });
    if (isCust && (nm || /\d{9,10}/.test(n) || tk.length > 2)) return out("customers.find", { q: (nm || (n.match(/\d{9,10}/) || [""])[0] || tk.filter(w => !any(w, W.cust) && !any(w, W.show) && w.length > 2).slice(-2).join(" ")).slice(0, 60) });
    if (isOrder || (st && (isShow || tk.length <= 4)) || oid) {
      if (oid && !isShow && !st && !isOrder) return out("orders.get", { id: oid });
      if (oid) return out("orders.get", { id: oid });
      const a = {}; if (st) a.status = st; if (wil) a.wilaya = wil; if (per && per !== "all") a.period = per; if (lim) a.limit = lim; if (nm) a.q = nm; else if (pm && !st) a.q = pm.title.split(" ")[0];
      if ((ord || demo) && !st && !lim && ctx.lastListIds && ctx.lastListIds.length) return out("select_order", ord ? { ordinal: ord } : { demonstrative: true });
      if (isHow && !isShow && !st && ctx.lastListIds && ctx.lastListIds.length && /(?:عدد|كم|combien)/.test(n)) return out("count", {});
      return out("orders.list", a);
    }
    if (isStock || isLow) { if (pm) return out("inventory.read", { slug: pm.slug }); if (isLow || /(?:المنخفض|منخفض|bas|low)/.test(n)) return out("inventory.read", { low: true }); if (ctx.focusProduct && (demo || tk.length <= 5)) return out("inventory.read", { slug: ctx.focusProduct }, { follow: true }); return out("inventory.read", {}); }
    if (pm || isProd || isPrice) {
      if (pm) return out(isPrice || /(?:ثمن|prix)/.test(n) ? "products.get" : (any(n, W.search) || isShow || isProd ? "products.get" : "products.get"), { slug: pm.slug }, { conf: pm.score >= 1 ? 0.95 : 0.8 });
      const resid = tk.filter(w => w.length > 2 && !STOPTOK.has(w) && !GENERIC.has(w) && !QW.has(w) && !any(w, W.show) && !any(w, W.search) && !any(w, W.product) && !any(w, W.price) && !any(w, W.demo));
      if (ctx.focusProduct && !resid.length && (demo || isPrice || tk.length <= 4)) return out("products.get", { slug: ctx.focusProduct }, { follow: true }); /* متابعة فقط إن لم تُذكر كلمات جديدة تدل على منتج آخر */
      const q = tk.filter(w => !any(w, W.show) && !any(w, W.search) && !any(w, W.product) && !any(w, W.price) && w.length > 2).join(" ").slice(0, 60); return out("products.search", { q: q || "" });
    }
    if (any(n, W.settings)) return out("settings.read", { key: /(?:حمايه|guard|protection)/.test(n) ? "guard" : /(?:مخزون|stock)/.test(n) ? "stock" : "guard" });
    if (any(n, W.panel) || (isShow && /(?:لوحه|panneau|panel)/.test(n))) { const pn = /(?:طلب|commande|order)/.test(n) ? "ord" : /(?:منتج|produit|product)/.test(n) ? "prod" : /(?:مخزون|stock|inventory)/.test(n) ? "inv" : /(?:تحليل|analyse|analytic|احصاء|stat)/.test(n) ? "ana" : null; if (pn) return out("ui.open_panel", { panel: pn }); }
    if (any(n, W.search) && !isOrder && !isSales && !isCust && tk.length >= 2) { const q = tk.filter(w => !any(w, W.show) && !any(w, W.search) && !any(w, W.product) && !any(w, W.price) && w.length > 2).join(" ").slice(0, 60); if (q) return out("products.search", { q }); }
    if (any(n, W.help)) return out("help"); if (any(n, W.thanks)) return out("thanks"); if (any(n, W.hello) && tk.length <= 4) return out("hello");
    /* 5) متابعات قصيرة تعتمد السياق */
    if (tk.length <= 7 && ctx.lastIntent) {
      const li = ctx.lastIntent, la = ctx.lastArgs || {};
      if (per && /^(sales|orders)\./.test(li)) return out(li, Object.assign({}, la, { period: per }), { follow: true });
      if (st && li === "orders.list") return out("orders.list", Object.assign({}, la, { status: st }), { follow: true });
      if (wil && li === "orders.list") return out("orders.list", Object.assign({}, la, { wilaya: wil }), { follow: true });
      if ((ord || demo || oid) && ctx.lastListIds && ctx.lastListIds.length) return out("select_order", oid ? { id: oid } : ord ? { ordinal: ord } : { demonstrative: true }, { follow: true });
      if (isHow && ctx.lastListIds) return out("count", {}, { follow: true });
      if ((demo || isPrice) && ctx.focusProduct) return out("products.get", { slug: ctx.focusProduct }, { follow: true });
    }
    return out("unknown", {}, { conf: 0.1, reason: "no-intent" });
  }
  const label = (intent, lang) => (LABEL[intent] || {})[lang === "fr" ? "fr" : lang === "en" ? "en" : "ar"] || intent;
  window.AgentNLU = Object.freeze({ parse, normalize: N, matchProduct, matchName, label, version: 1 });
})();
