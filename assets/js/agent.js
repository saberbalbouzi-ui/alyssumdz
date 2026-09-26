/* أليسوم — المساعد الذكي للبيع (ثنائي اللغة: عربي / فرنسي)
   وكيل مبيعات قاعدي يعرف السياق (صفحة المنتج الحالية)، يقرأ الأسعار والعروض ورسوم التوصيل
   مباشرة من بيانات الموقع الحيّة (PRODUCTS / WILAYAS) فلا يخترع أرقاماً، ويكتشف لغة السائل تلقائياً.
   قابل للربط بنموذج لغوي خارجي عبر CONFIG.AGENT_ENDPOINT إن وُجد. */
const Agent = (() => {
  const panel = () => document.getElementById("agent-panel");
  const body = () => document.getElementById("agent-body");
  let greeted = false;
  let lang = "ar"; // اللغة الحالية للمحادثة — تتحدّث تلقائياً حسب رسالة الزبون

  const fmtFr = n => Number(n).toLocaleString("fr-DZ") + " DA";
  const price = (n, l) => (l === "fr" ? fmtFr(n) : fmt(n));

  /* ── المنتج الحالي حسب مسار الصفحة (p/<slug>/) — يجعل الردود دقيقة حسب صفحة المنتج المفتوحة ── */
  const currentSlug = (() => {
    const m = location.pathname.match(/\/p\/([a-z0-9-]+)\/?/i);
    return m ? m[1] : null;
  })();
  const currentProduct = () => (window.PRODUCTS || []).find(p => p.slug === currentSlug) || null;

  /* ── ولايات الجزائر: id ↔ الاسم بالعربية (للتعرّف على الولاية عند كتابتها بالعربية؛
     أسماء WILAYAS نفسها بالفرنسية فتُستعمل مباشرة للتعرّف عند الكتابة بالفرنسية) ── */
  const WILAYA_AR = {1:"أدرار",2:"الشلف",3:"الأغواط",4:"أم البواقي",5:"باتنة",6:"بجاية",7:"بسكرة",8:"بشار",9:"البليدة",10:"البويرة",11:"تمنراست",12:"تبسة",13:"تلمسان",14:"تيارت",15:"تيزي وزو",16:"الجزائر",17:"الجلفة",18:"جيجل",19:"سطيف",20:"سعيدة",21:"سكيكدة",22:"سيدي بلعباس",23:"عنابة",24:"قالمة",25:"قسنطينة",26:"المدية",27:"مستغانم",28:"المسيلة",29:"معسكر",30:"ورقلة",31:"وهران",32:"البيض",33:"إليزي",34:"برج بوعريريج",35:"بومرداس",36:"الطارف",37:"تندوف",38:"تيسمسيلت",39:"الوادي",40:"خنشلة",41:"سوق أهراس",42:"تيبازة",43:"ميلة",44:"عين الدفلى",45:"النعامة",46:"عين تموشنت",47:"غرداية",48:"غليزان",49:"تيميمون",50:"برج باجي مختار",51:"أولاد جلال",52:"بني عباس",53:"عين صالح",54:"عين قزام",55:"تقرت",56:"جانت",57:"المغير",58:"المنيعة"};

  // إزالة "ال" التعريف من بداية الاسم فقط — لأن حروف الجر المتصلة (لـ/بـ/فـ/كـ) تُكتب عادة
  // ملتصقة بالاسم مع حذف الألف (مثال: "لِلبليدة" بدل "لِـالبليدة")، فتبقى بقية الاسم كما هي كسلسلة فرعية
  const stripAl = s => s.replace(/^ال/, "");

  function findWilaya(t) {
    const wl = (window.WILAYAS || []);
    const low = t.toLowerCase();
    let w = wl.find(x => x.name && low.includes(x.name.toLowerCase()));
    if (w) return w;
    for (const id in WILAYA_AR) {
      const name = WILAYA_AR[id];
      if (t.includes(name) || t.includes(stripAl(name))) {
        w = wl.find(x => x.id === Number(id));
        if (w) return w;
      }
    }
    return null;
  }

  /* ── كشف اللغة: عربي إن وُجد حرف عربي، وإلا فرنسي إن وُجدت حروف لاتينية، وإلا نبقى على آخر لغة معروفة ── */
  function detectLang(t) {
    if (/[؀-ۿ]/.test(t)) return "ar";
    if (/[a-zA-Z]/.test(t)) return "fr";
    return lang;
  }

  /* ── قاعدة معرفة إضافية (جملة تحفيزية قصيرة) فوق الوصف الحقيقي للمنتج — عربي وفرنسي ── */
  const KNOWLEDGE = {
    "anti-chute": {
      ar: "زيت أليسوم ضد التساقط غني بالأعشاب المرقية، والنتائج تظهر عادة خلال 3-4 أسابيع مع الاستعمال المنتظم.",
      fr: "L'huile Alyssum contre la chute des cheveux, riche en plantes reconnues — les résultats apparaissent généralement en 3-4 semaines d'usage régulier.",
    },
    "anti-acne": {
      ar: "كريمة أليسوم ضد حب الشباب طبيعية 100% ومناسبة للبشرة الحساسة، تهدئ الالتهاب وتخفف من ظهور البقع.",
      fr: "La crème Alyssum anti-acné est 100% naturelle, adaptée aux peaux sensibles — elle apaise l'inflammation et atténue les taches.",
    },
    "miel-sidr": {
      ar: "عسل السدر الطبيعي الأصلي من أجود المناحل، مفحوص وموثوق الجودة.",
      fr: "Le miel de sidr, 100% naturel et authentique, issu des meilleurs ruchers, contrôlé et garanti.",
    },
    "memory-drops": {
      ar: "قطرات التركيز خلاصة طبيعية تساعد الطلاب والموظفين على التركيز الذهني.",
      fr: "Les gouttes de concentration, un extrait naturel qui aide étudiants et actifs à mieux se concentrer.",
    },
    "uroflow": {
      ar: "يوروفلو من منتجاتنا الأكثر طلباً لراحة المثانة، مع الدفع عند الاستلام.",
      fr: "Uroflow, l'un de nos produits les plus demandés pour le confort de la vessie — paiement à la livraison.",
    },
    "flexi-relief": {
      ar: "مرهم أليسوم الحراري بالأعشاب الطبيعية يخفف آلام المفاصل والعضلات.",
      fr: "Le baume chauffant Alyssum aux plantes naturelles soulage les douleurs articulaires et musculaires.",
    },
    "hemorroides": {
      ar: "مرهم طبيعي خاص بنتائج موثوقة، والتوصيل سريع مع الدفع عند الاستلام.",
      fr: "Un baume naturel spécifique aux résultats fiables — livraison rapide et paiement à la livraison.",
    },
    "ithmed": {
      ar: "كحل الأثمد الأصفهاني الأصلي، تراثي وطبيعي 100%.",
      fr: "Le khôl Ithmed d'Ispahan, authentique, traditionnel et 100% naturel.",
    },
    "pack13": {
      ar: "الباقة الشاملة 13 منتجاً — العرض الأكمل لأهل الرقية، وتوفير كبير في السعر.",
      fr: "Le pack complet de 13 produits — l'offre la plus complète pour la rokia, avec une belle économie.",
    },
    "barbarie": {
      ar: "زيت بذور التين الشوكي من أغلى الزيوت الطبيعية، ممتاز للبشرة والشعر.",
      fr: "L'huile de pépins de figue de barbarie, l'une des huiles naturelles les plus précieuses — excellente pour la peau et les cheveux.",
    },
  };

  const T = {
    ar: {
      greet: p => p
        ? `أهلاً وسهلاً بك في <b>${SITE_NAME}</b> 🌿<br>أنت الآن في صفحة «<b>${p.title}</b>» — اسألني عن أي تفصيل فيه (السعر، المكوّنات، التوصيل، الدفع...) وسأجيبك بدقة.`
        : `أهلاً وسهلاً بك في <b>${SITE_NAME}</b> 🌿<br>أنا مساعدك الشخصي قبل الطلب. اسألني عن أي منتج، الأسعار، التوصيل أو الدفع — أو أخبرني بما تبحث عنه وسأرشح لك الأنسب.`,
      salam: () => `وعليكم السلام وأهلاً بك في ${SITE_NAME} 👋 أنا مساعدك الشخصي. هل تبحث عن منتج معين؟ أو أخبرني بما تشكو منه (تساقط الشعر، البشرة، آلام...) وأرشح لك الأنسب.`,
      payment: () => `الدفع عند الاستلام 💵 تدفع فقط عندما يصلك المنتج وتتأكد منه. لا نطلب أي دفع مسبق أبداً — هذا ضمان ثقتك.`,
      guarantee: () => `منتجاتنا طبيعية 100% وأصلية ✅ إذا لم تكن راضياً، تواصل معنا مباشرة وسنحل المشكلة. رضا زبائننا هو سر نجاحنا منذ سنوات.`,
      howOrder: () => `الطلب سهل جداً 👇\n1️⃣ اختر العرض (قطعة / قطعتين / 3 قطع)\n2️⃣ املأ الاسم والهاتف والولاية\n3️⃣ اضغط «تأكيد الطلب» وسنتواصل معك للتأكيد.\nالدفع عند الاستلام!`,
      whatsapp: () => `بالتأكيد! تواصل معنا مباشرة على واتساب 👇<br><a href="https://wa.me/${WA_NUMBER}" target="_blank" style="color:var(--ok);font-weight:900">📱 واتساب ${WA_NUMBER.replace("213","0")}</a>`,
      thanks: () => `العفو! ❤️ أنا هنا إذا احتجت أي مساعدة. تذكر: الدفع عند الاستلام والتوصيل سريع لكل الولايات.`,
      deliveryGeneral: () => `نوصل لـ 58 ولاية 🚚 توصيل للمنزل أو لمكتب التوصيل (Stop Desk)، والمدة عادة 24-72 ساعة. اكتب اسم ولايتك وسأعطيك سعر التوصيل الدقيق إليها.`,
      deliveryWilaya: w => `التوصيل إلى <b>${WILAYA_AR[w.id] || w.name}</b> 🚚<br>🏠 للمنزل: <b>${fmt(w.home)}</b><br>🏢 لمكتب Stop Desk: <b>${fmt(w.stop)}</b><br>المدة عادة 24-72 ساعة، والدفع عند الاستلام.`,
      priceGeneric: p => `أسعارنا تشمل عروضاً دائمة 🎁 مثلاً «${p.title}» بسعر ${fmt(p.price)}${p.old ? ` بدل ${fmt(p.old)}` : ""}، والدفع عند الاستلام. أي منتج يهمك؟`,
      askOrder: () => `هل أحجز لك طلباً؟ اضغط «اطلبه الآن» والدفع عند الاستلام 😊`,
      bestSellersIntro: () => `سؤال جميل! 🤔 منتجاتنا الأكثر طلباً الآن:`,
      askNeed: () => `أو صف لي ما تحتاجه (شعر، بشرة، صحة...) وأرشح لك الأفضل.`,
      wilayaNotFound: () => `لم أتعرّف على اسم الولاية بدقة 🤔 اكتب اسمها كما تُكتب رسمياً (مثال: البليدة، سطيف، وهران...) وسأعطيك سعر التوصيل فوراً.`,
      safety: () => `منتجاتنا طبيعية 100% ويثق بها آلاف الزبائن في كل الولايات ✅ التركيبة مصنوعة من مكونات نباتية مختارة بعناية. وتجربتك بدون أي مخاطرة: تدفع فقط عند الاستلام بعد أن ترى المنتج بنفسك 😊`,
      value: () => `السعر يعكس جودة المكوّنات الطبيعية 100% والنتائج التي يثق بها زبائننا 🌿 وتوفّر أكثر مع عروض الكمية (قطعتين أو 3 قطع، وأحياناً قطعة مجانية) — وتدفع فقط عند الاستلام، فلا مخاطرة في التجربة.`,
    },
    fr: {
      greet: p => p
        ? `Bienvenue chez <b>ALYSSUM</b> 🌿<br>Vous êtes sur la page « <b>${p.title}</b> » — posez-moi vos questions (prix, composition, livraison, paiement...) et je vous répondrai précisément.`
        : `Bienvenue chez <b>ALYSSUM</b> 🌿<br>Je suis votre assistant avant commande. Demandez-moi un produit, les prix, la livraison ou le paiement — ou décrivez votre besoin et je vous conseille.`,
      salam: () => `Bonjour et bienvenue chez ALYSSUM 👋 Je suis votre assistant personnel. Vous cherchez un produit précis ? Ou décrivez votre besoin (chute de cheveux, peau, douleurs...) et je vous conseille le plus adapté.`,
      payment: () => `Paiement à la livraison 💵 Vous ne payez qu'à la réception du produit, une fois vérifié. Aucun paiement à l'avance n'est jamais demandé — c'est notre garantie de confiance.`,
      guarantee: () => `Nos produits sont 100% naturels et authentiques ✅ Si vous n'êtes pas satisfait, contactez-nous directement et nous réglerons le problème. La satisfaction de nos clients est notre priorité depuis des années.`,
      howOrder: () => `Commander est très simple 👇\n1️⃣ Choisissez l'offre (1 / 2 / 3 pièces)\n2️⃣ Renseignez nom, téléphone et wilaya\n3️⃣ Cliquez sur « Confirmer la commande », nous vous contacterons pour confirmer.\nPaiement à la livraison !`,
      whatsapp: () => `Bien sûr ! Contactez-nous directement sur WhatsApp 👇<br><a href="https://wa.me/${WA_NUMBER}" target="_blank" style="color:var(--ok);font-weight:900">📱 WhatsApp ${WA_NUMBER.replace("213","0")}</a>`,
      thanks: () => `Avec plaisir ! ❤️ Je reste à votre disposition. Pour rappel : paiement à la livraison et livraison rapide dans toute l'Algérie.`,
      deliveryGeneral: () => `Nous livrons dans les 58 wilayas 🚚 à domicile ou en point relais (Stop Desk), généralement en 24-72h. Indiquez votre wilaya et je vous donne le tarif exact.`,
      deliveryWilaya: w => `Livraison vers <b>${w.name}</b> 🚚<br>🏠 À domicile : <b>${fmtFr(w.home)}</b><br>🏢 Point relais (Stop Desk) : <b>${fmtFr(w.stop)}</b><br>Délai généralement 24-72h, paiement à la livraison.`,
      priceGeneric: p => `Nous avons des offres permanentes 🎁 par exemple « ${p.title} » à ${fmtFr(p.price)}${p.old ? ` au lieu de ${fmtFr(p.old)}` : ""}, paiement à la livraison. Quel produit vous intéresse ?`,
      askOrder: () => `Je vous réserve une commande ? Cliquez sur « Commander maintenant », paiement à la livraison 😊`,
      bestSellersIntro: () => `Bonne question ! 🤔 Nos produits les plus demandés actuellement :`,
      askNeed: () => `Ou décrivez votre besoin (cheveux, peau, santé...) et je vous conseille le meilleur choix.`,
      wilayaNotFound: () => `Je n'ai pas bien identifié la wilaya 🤔 Écrivez son nom (ex : Blida, Sétif, Oran...) et je vous donne le tarif de livraison immédiatement.`,
      safety: () => `Nos produits sont 100% naturels et font confiance à des milliers de clients partout en Algérie ✅ La formule est composée d'ingrédients végétaux soigneusement sélectionnés. Votre essai est sans aucun risque : vous ne payez qu'à la réception, après avoir vu le produit 😊`,
      value: () => `Le prix reflète la qualité des ingrédients 100% naturels et les résultats appréciés par nos clients 🌿 Vous économisez davantage avec les offres multi-pièces (2 ou 3 pièces, parfois avec une pièce gratuite) — et vous ne payez qu'à la livraison, aucun risque à essayer.`,
    },
  };

  /* ── نيّات مشتركة عربي/فرنسي: كل عنصر يُطابق كلمات بأي من اللغتين ثم يُختار الرد بلغة رسالة الزبون ── */
  const INTENTS = [
    { re: /(سلام|مرحبا|صباح الخير|مساء الخير|اهلا|أهلا|bonjour|salut|bonsoir)/i, key: "salam" },
    { re: /(تساقط|شعر|صلع|chute.*cheveux|perte.*cheveux)/i, act: "anti-chute" },
    { re: /(حب الشباب|بثور|حبوب|acne|acné|boutons)/i, act: "anti-acne" },
    { re: /(اكزيما|صدفية|eczema|eczéma|psoriasis)/i, act: "eczema" },
    { re: /(تجاعيد|بقع الوجه|تصبغات|rides|taches)/i, act: "anti-rides-2" },
    { re: /(عسل السدر|sidr)/i, act: "miel-sidr" },
    { re: /(عسل جبلي|miel de montagne)/i, act: "miel-de-montagne" },
    { re: /(عسل البرتقال|miel.*orange)/i, act: "miel-oranger" },
    { re: /(عسل الجرجير|miel.*cresson)/i, act: "miel-de-cresson" },
    { re: /(ذاكرة|تركيز|نسيان|دراسة|طالب|concentration|mémoire|examen)/i, act: "memory-drops" },
    { re: /(مثانة|تبول|لاإرادي|لارادي|vessie|énurésie)/i, act: "uroflow" },
    { re: /(مفاصل|عضلات|ركبة|ألم|الام|articulations|douleur|muscle)/i, act: "flexi-relief" },
    { re: /(بواسير|شرج|hémorroïdes|hemorroides)/i, act: "hemorroides" },
    { re: /(كحل|اثمد|أثمد|khol|kohl)/i, act: "ithmed" },
    { re: /(رقية|مس|سحر|حسد|roqia)/i, act: "pack13" },
    { re: /(تين شوكي|برباري|figue de barbarie)/i, act: "barbarie" },
    { re: /(لحية|barbe)/i, act: "huile-a-barbe" },
    { re: /(رائحة الفم|breatyfresh|haleine)/i, act: "breatyfresh" },
    { re: /(قولون|colon)/i, act: "anti-colon" },
    { re: /(اثار جانبية|آثار جانبية|أضرار|ضرر|خطر|خطير|حساسية|effets secondaires|danger|dangereux|allergie|risque)/i, key: "safety" },
    { re: /(غالي|غالية|غاليه|مكلف|ثمن مرتفع|cher|chère|expensive)/i, key: "value" },
    { re: /(سعر|بكم|ثمن|بشحال|شحال|prix|combien|coûte|coute|tarif)/i, key: "price" },
    { re: /(مكونات|مكوناته|مكوناتها|تركيبة|فيم يتكون|composition|ingrédients?|ingredient)/i, key: "ingredients" },
    { re: /(توصيل|ليفريزون|ليفريسون|توصيلة|الولايات|livraison|delivery)/i, key: "delivery" },
    { re: /(دفع|الدفع|كاش|ثقة|نصب|احتيال|paiement|payer|confiance|arnaque)/i, key: "payment" },
    { re: /(ضمان|أصلي|طبيعي|كيماوي|فعالية|نتيجة|نتائج|garantie|original|naturel|efficace)/i, key: "guarantee" },
    { re: /(اطلب|شراء|كيف اطلب|طريقة الطلب|تشرت|commander|acheter|comment.*command)/i, key: "howOrder" },
    { re: /(واتساب|whatsapp|واتس)/i, key: "whatsapp" },
    { re: /(شكرا|شكراً|مشكور|merci)/i, key: "thanks" },
  ];

  function findProductByText(text) {
    const low = text.toLowerCase();
    return (window.PRODUCTS || []).find(p => low.includes(p.slug) || low.includes(p.title.toLowerCase()));
  }

  function botSay(html) {
    const d = document.createElement("div");
    d.className = "msg bot"; d.innerHTML = html;
    body().appendChild(d); body().scrollTop = body().scrollHeight;
  }
  function typing(cb, ms = 700) {
    const t = document.createElement("div");
    t.className = "msg bot typing"; t.innerHTML = "<i></i><i></i><i></i>";
    body().appendChild(t); body().scrollTop = body().scrollHeight;
    setTimeout(() => { t.remove(); cb(); }, ms);
  }

  function bestOfferLine(p, l) {
    const multi = (p.offers || []).find(o => o.qty > 1);
    if (!multi) return "";
    const unit = Math.round(multi.price / multi.qty);
    return l === "fr"
      ? `<br>🎁 Offre : ${multi.qty} pièces à ${fmtFr(multi.price)}${multi.free ? " (dont 1 gratuite)" : ""} — soit ${fmtFr(unit)}/pièce.`
      : `<br>🎁 عرض: ${multi.qty} قطع بـ ${fmt(multi.price)}${multi.free ? " (منها قطعة مجانية)" : ""} — أي ${fmt(unit)} للقطعة الواحدة.`;
  }

  function productCard(p, l) {
    const label = l === "fr" ? "Commander →" : "اطلبه الآن ←";
    return `<span class="mini">🌿 <b>${p.title}</b><br>${l === "fr" ? fmtFr(p.price) : fmt(p.price)}${p.old ? ` <s>${l === "fr" ? fmtFr(p.old) : fmt(p.old)}</s>` : ""} · <a href="${REL}p/${p.slug}/" style="color:var(--gold);font-weight:900">${label}</a></span>`;
  }

  /* وصف/تحفيز دقيق لمنتج معيّن: يستعمل بيانات المنتج الحقيقية (السعر، العروض، الوصف) وليس نصاً عاماً مختلقاً */
  function productPitch(p, l) {
    const hook = (KNOWLEDGE[p.slug] && KNOWLEDGE[p.slug][l]) || "";
    const desc = p.desc || "";
    const intro = hook || desc;
    return `${intro}${bestOfferLine(p, l)}${productCard(p, l)}<br>${T[l].askOrder()}`;
  }

  /* إجابة دقيقة عن المكوّنات: تُستخرج من الوصف الحقيقي المكتوب في صفحة المنتج نفسها (لا نص عام) */
  function ingredientsAnswer(p, l) {
    const desc = p.desc || "";
    if (l === "fr") {
      const note = desc ? `« ${desc} »` : "une sélection d'ingrédients naturels (voir la fiche produit pour le détail complet).";
      return `Voici la composition de « ${p.title} », telle que décrite sur sa page produit :<br>${note}<br>Une formule 100% naturelle, comme sur toute la gamme ALYSSUM.${bestOfferLine(p, l)}${productCard(p, l)}`;
    }
    const note = desc || "مكونات طبيعية مختارة بعناية (التفاصيل الكاملة في صفحة المنتج).";
    return `مكوّنات «${p.title}» كما هي موضّحة في صفحة المنتج:<br>${note}<br>تركيبة طبيعية 100% كعادة منتجات أليسوم.${bestOfferLine(p, l)}${productCard(p, l)}`;
  }

  async function reply(text) {
    const t = text.trim();
    if (!t) return;
    lang = detectLang(t) || lang;
    const u = document.createElement("div");
    u.className = "msg user"; u.textContent = t;
    body().appendChild(u); body().scrollTop = body().scrollHeight;

    // محاولة ربط نموذج لغوي خارجي أولاً (اختياري)
    if (window.CONFIG && CONFIG.AGENT_ENDPOINT) {
      typing(async () => {
        try {
          const r = await fetch(CONFIG.AGENT_ENDPOINT, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: t, lang, product: currentProduct(), products: (window.PRODUCTS || []).slice(0, 30) }),
          });
          const j = await r.json();
          botSay(j.reply || fallback(t));
        } catch (e) { botSay(fallback(t)); }
      }, 900);
    } else {
      typing(() => botSay(fallback(t)), 700);
    }
  }

  function fallback(t) {
    const l = lang;
    const tr = T[l];

    // سعر التوصيل لولاية محدَّدة: يُقرأ من بيانات الرسوم الحيّة، لا يُختلق أي رقم
    if (/(توصيل|شحن|ليفريزون|ليفريسون|livraison)/i.test(t)) {
      const w = findWilaya(t);
      if (w) return tr.deliveryWilaya(w);
    }
    const wOnly = findWilaya(t);
    if (wOnly && /(بكم|كم|ثمن|سعر|combien|prix|tarif)/i.test(t)) return tr.deliveryWilaya(wOnly);

    for (const it of INTENTS) {
      if (!it.re.test(t)) continue;
      if (it.key === "delivery") return tr.deliveryGeneral();
      if (it.key === "price") {
        const cur = currentProduct();
        if (cur) return productPitch(cur, l);
        const p = (window.PRODUCTS || []).find(p => p.old) || (window.PRODUCTS || [])[0];
        return p ? tr.priceGeneric(p) : tr.bestSellersIntro();
      }
      if (it.key === "ingredients") {
        const p = currentProduct() || findProductByText(t) || (window.PRODUCTS || [])[0];
        return p ? ingredientsAnswer(p, l) : tr.askNeed();
      }
      if (it.key === "whatsapp") return tr.whatsapp();
      if (it.key) return tr[it.key]();
      if (it.act) {
        const p = (window.PRODUCTS || []).find(p => p.slug === it.act);
        if (p) return productPitch(p, l);
      }
    }

    // ردّ الزبون باسم ولاية فقط (مثلاً كجواب على سؤال «أي ولاية؟») ولم يُطابق أي نية أخرى أعلاه
    // → نعتبرها متابعة لسؤال التوصيل ونعطيه السعر الدقيق مباشرة، بدل الرجوع لتعريف عام للمنتج
    const wFollowUp = findWilaya(t);
    if (wFollowUp) return tr.deliveryWilaya(wFollowUp);

    // على صفحة منتج ولم يتطابق شيء محدَّد → نتحدث عن هذا المنتج بالذات (دقّة حسب صفحة المنتج)
    const cur = currentProduct();
    const byName = findProductByText(t);
    if (byName) return productPitch(byName, l);
    if (cur) return productPitch(cur, l);

    const feat = (window.PRODUCTS || []).filter(p => p.old).slice(0, 2);
    if (!feat.length) return tr.askNeed();
    return `${tr.bestSellersIntro()}<br>` + feat.map(p => productCard(p, l)).join("<br>") + `<br>${tr.askNeed()}`;
  }

  function open() {
    panel().classList.add("open");
    document.getElementById("agent-fab").style.display = "none";
    if (!greeted) {
      greeted = true;
      typing(() => botSay(T[lang].greet(currentProduct())), 600);
    }
    setTimeout(()=>document.getElementById("agent-input")?.focus(), 300);
  }
  function close() {
    panel().classList.remove("open");
    document.getElementById("agent-fab").style.display = "grid";
  }

  function init() {
    const fab = document.createElement("button");
    fab.className = "agent-fab"; fab.id = "agent-fab";
    fab.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
    fab.onclick = open;
    document.body.appendChild(fab);

    const p = document.createElement("div");
    p.className = "agent-panel"; p.id = "agent-panel";
    p.innerHTML = `
      <div class="agent-head">
        <div class="av">🌿</div>
        <div><b>مساعد أليسوم الذكي</b><small>متصل الآن · يرد فوراً · AR / FR</small></div>
        <button class="x" id="agent-close">✕</button>
      </div>
      <div class="agent-body" id="agent-body"></div>
      <div class="agent-input">
        <input id="agent-input" placeholder="اكتب سؤالك… / Écrivez votre question">
        <button id="agent-send">➤</button>
      </div>`;
    document.body.appendChild(p);
    document.getElementById("agent-close").onclick = close;
    const send = () => { const i = document.getElementById("agent-input"); reply(i.value); i.value = ""; };
    document.getElementById("agent-send").onclick = send;
    document.getElementById("agent-input").addEventListener("keydown", e => { if (e.key === "Enter") send(); });

    // فتح تلقائي خفيف بعد 12 ثانية
    setTimeout(() => { if (!greeted && !panel().classList.contains("open")) open(); }, 12000);
  }

  document.addEventListener("DOMContentLoaded", init);
  return { reply, open };
})();
