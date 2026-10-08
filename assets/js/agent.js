/* أليسوم — المساعد الذكي للبيع (ثنائي اللغة: عربي / فرنسي)
   وكيل مبيعات قاعدي يعرف السياق (صفحة المنتج الحالية)، يقرأ الأسعار والعروض ورسوم التوصيل
   مباشرة من بيانات الموقع الحيّة (PRODUCTS / WILAYAS) فلا يخترع أرقاماً، ويكتشف لغة السائل تلقائياً.
   قابل للربط بنموذج لغوي خارجي عبر CONFIG.AGENT_ENDPOINT إن وُجد. */
const Agent = (() => {
  const _site = (typeof CONFIG !== "undefined" && CONFIG.SITE) || {};
  const SITE_DOMAIN = _site.domain || location.hostname;
  const SITE_IG = _site.instagram || "";
  const panel = () => document.getElementById("agent-panel");
  const body = () => document.getElementById("agent-body");
  let greeted = false;
  let lang = "ar"; // اللغة الحالية للمحادثة — تتحدّث تلقائياً حسب رسالة الزبون

  const fmtFr = n => Number(n).toLocaleString("fr-DZ") + " DA";
  const price = (n, l) => (l === "fr" ? fmtFr(n) : fmt(n));

  // اختيار عشوائي من مصفوفة (لتنويع صياغة معالجة الاعتراضات فلا يبدو الرد آلياً مكرراً)
  const randomPick = arr => arr[Math.floor(Math.random() * arr.length)];
  // السعر اليومي التقريبي (لتأطير اعتراض السعر): علبة تكفي شهراً تقريباً = سعر ÷ 30 — مبني على سعر المنتج الحقيقي دائماً
  const dailyPrice = price0 => Math.max(1, Math.round(price0 / 30));

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

  /* ── منتجات مكمّلة حقيقية (Cross-sell) — معرّفات (slugs) موجودة فعلاً في كتالوج المنتجات
     ومُختارة يدوياً بمنطق تكامل حقيقي (نفس الروتين أو نفس فئة الاستعمال)، وليس عشوائياً ── */
  const COMPLEMENTS = {
    "anti-acne": ["anti-rides-2", "creme-tachouih"],
    "anti-chute": ["huile-a-barbe", "henna"],
    "anti-colon": ["tarkiz", "breatyfresh"],
    "anti-rides": ["barbarie", "anti-rides-2"],
    "anti-rides-2": ["anti-rides", "barbarie"],
    "barbarie": ["anti-rides-2", "anti-rides"],
    "breatyfresh": ["anti-colon"],
    "creme-tachouih": ["tachouih-el-jamal", "tachouih-pack"],
    "eczema": ["anti-acne", "anti-rides-2"],
    "flexi-relief": ["hemorroides"],
    "hemorroides": ["flexi-relief"],
    "henna": ["anti-chute", "huile-a-barbe"],
    "huile-a-barbe": ["anti-chute", "henna"],
    "ithmed": ["misk-noir"],
    "massage-oil": ["pack4"],
    "memory-drops": ["tarkiz"],
    "miel-de-cresson": ["miel-oranger", "miel-de-montagne"],
    "miel-de-montagne": ["miel-sidr", "miel-oranger"],
    "miel-oranger": ["miel-de-cresson", "miel-sidr"],
    "miel-sidr": ["miel-de-montagne", "miel-oranger"],
    "misk-noir": ["ithmed"],
    "nocturna-honey": ["uroflow"],
    "pack-djin-el-achiq": ["pack13"],
    "pack4": ["pack13", "massage-oil"],
    "tachouih-el-jamal": ["creme-tachouih", "tachouih-pack"],
    "tachouih-pack": ["creme-tachouih", "tachouih-el-jamal"],
    "tarkiz": ["memory-drops"],
    "uroflow": ["nocturna-honey"],
  };

  /* سطر اقتراح منتج مكمّل — يُستعمل أحياناً فقط (وليس في كل رد) حتى لا يبدو مزعجاً،
     ويعرض دائماً منتجاً حقيقياً بسعره الحقيقي من window.PRODUCTS (لا بيانات مختلقة) */
  function crossSellLine(slug, l) {
    const options = COMPLEMENTS[slug];
    if (!options || !options.length) return "";
    const compSlug = randomPick(options);
    const cp = (window.PRODUCTS || []).find(p => p.slug === compSlug);
    if (!cp) return "";
    const priceStr = l === "fr" ? fmtFr(cp.price) : fmt(cp.price);
    return l === "fr"
      ? `<br><br>✨ <b>Idée</b> : plusieurs clients associent ce produit à <a href="${REL}${cp.route?"lp/"+cp.route:"p/"+cp.slug}/" style="color:var(--gold);font-weight:900">${cp.title}</a> (${priceStr}) pour de meilleurs résultats.`
      : `<br><br>✨ <b>فكرة</b>: كثير من زبائننا يجمعون بين هذا المنتج و<a href="${REL}${cp.route?"lp/"+cp.route:"p/"+cp.slug}/" style="color:var(--gold);font-weight:900">${cp.title}</a> (${priceStr}) للحصول على نتيجة أفضل.`;
  }

  const T = {
    ar: {
      greet: p => p
        ? `أهلاً وسهلاً بك في <b>${SITE_NAME}</b> 🌿<br>أنت الآن في صفحة «<b>${p.title}</b>» — اسألني عن أي تفصيل فيه (السعر، المكوّنات، التوصيل، الدفع...) وسأجيبك بدقة.`
        : `أهلاً وسهلاً بك في <b>${SITE_NAME}</b> 🌿<br>أنا مساعدك الشخصي قبل الطلب. اسألني عن أي منتج، الأسعار، التوصيل أو الدفع — أو أخبرني بما تبحث عنه وسأرشح لك الأنسب.`,
      salam: () => `وعليكم السلام وأهلاً بك في ${SITE_NAME} 👋 أنا مساعدك الشخصي. هل تبحث عن منتج معين؟ أو أخبرني بما تشكو منه (تساقط الشعر، البشرة، آلام...) وأرشح لك الأنسب.`,
      payment: () => `الدفع عند الاستلام 💵 تدفع فقط عندما يصلك المنتج وتتأكد منه. لا نطلب أي دفع مسبق أبداً. نقبل أيضاً الحوالة البريدية أو الدفع عبر بريدي موب، بعد التواصل معنا على واتساب لترتيب ذلك.`,
      returnPolicy: () => `نعم، نسترجع المنتج في حالة وجود خطأ فيه أو تلف عند الاستلام 🔄 إذا واجهت مشكلة من هذا النوع، تواصل معنا مباشرة على واتساب وسنتكفل بطلبك فوراً.`,
      tracking: () => `بعد تأكيد طلبك، نرسل لك رابط تتبّع مباشر عبر موقع شركة التوصيل 📦 لتتبع مسار طلبك لحظة بلحظة حتى استلامه.`,
      pregnancy: () => `منتجاتنا طبيعية 100% ويستخدمها الكثير من الزبائن بثقة 🌿 ولكن في حالة الحمل أو الرضاعة، ننصحك دوماً بمراجعة الطبيب أو الصيدلي أولاً للتأكد من ملاءمته لحالتك الخاصة، فصحتك وصحة طفلك أولويتنا.`,
      physicalStore: () => `نحن شركة إنتاج ونُسوّق منتجاتنا فقط عبر موقعنا الرسمي ${SITE_DOMAIN} 🌿 هذا يضمن لك أفضل سعر وأحدث إنتاج مباشرة دون وسطاء.`,
      yearsInBusiness: () => `نعمل منذ سنة 2017 📅 أي أكثر من ${new Date().getFullYear() - 2017} سنوات من الخبرة وثقة آلاف الزبائن في كل الجزائر.`,
      pharmacyAvailability: () => `بعض منتجاتنا متوفرة في الصيدليات حسب الطلب 💊 لكن الطلب المباشر عبر موقعنا يبقى أسهل وأسرع، مع الدفع عند الاستلام وتوصيل لجميع الولايات.`,
      regulatoryApproval: () => `نعم ✅ جميع منتجاتنا مراقبة ومصرح بها من طرف وزارة التجارة، فهي مضمونة الجودة والسلامة 100%.`,
      phoneContact: () => `للتواصل معنا، الطريقة الأسرع هي واتساب 📱 والرد يكون فورياً وتلقائياً على مدار اليوم.<br><a href="https://wa.me/${WA_NUMBER}" target="_blank" style="color:var(--ok);font-weight:900">📱 واتساب ${WA_NUMBER.replace("213","0")}</a>`,
      socialMedia: () => `تابعنا لمزيد من العروض والنصائح 🌿<br>📸 انستغرام: <a href="https://www.instagram.com/${SITE_IG}" target="_blank" style="color:var(--gold);font-weight:900">@${SITE_IG}</a><br>📘 فيسبوك: بنفس الاسم "${SITE_IG}"`,
      resultsTime: () => `مدة ظهور النتيجة تختلف حسب المنتج، وعادة تكون بين أسبوعين إلى 3 أسابيع من الاستعمال المنتظم ⏳ ونحن على ثقة أنك ستلاحظ الفرق!`,
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
      // معالجة اعتراض السعر — عدة صياغات (تُختار عشوائياً فتبدو أقل آلية)، إحداها تحسب السعر اليومي
      // من سعر المنتج الحقيقي (وليس رقماً مختلقاً)، وأخرى تُبرز عرض الكمية الفعلي إن وُجد
      value: p => randomPick([
        `السعر يعكس جودة المكوّنات الطبيعية 100% والنتائج التي يثق بها زبائننا 🌿 وتوفّر أكثر مع عروض الكمية (قطعتين أو 3 قطع، وأحياناً قطعة مجانية) — وتدفع فقط عند الاستلام، فلا مخاطرة في التجربة.`,
        p ? `فهمتك تماماً 🤝 خلّينا نحسبوها معاً: «${p.title}» بـ ${fmt(p.price)} يكفيك عادةً شهراً كاملاً — يعني أقل من ${fmt(dailyPrice(p.price))} دج في اليوم. وتدفع فقط عند الاستلام بعد ما تشوف المنتج.` : null,
        (p && p.offers || []).some(o => o.free)
          ? `صحيح، ما هوش الأرخص، بصح عندك عرض ${(p.offers.find(o => o.free)).qty} قطع بـ ${fmt(p.offers.find(o => o.free).price)} (منها قطعة مجاناً 🎁) — يوفر لك أكثر من الشراء بالقطعة الواحدة.`
          : null,
      ].filter(Boolean)),
      // اعتراض "نشري بعد / نفكر فيها" — تحفيز لطيف بدون ضغط كاذب، مبني على بيانات حقيقية (تخفيض إن وُجد)
      objectionDelay: p => randomPick([
        (p && p.old)
          ? `خذ وقتك 🙂 بس اعلم أن السعر الحالي (${fmt(p.price)} بدل ${fmt(p.old)}) هو تخفيض عن السعر الأصلي — ما نقدرش نضمنلك يبقى متاحاً للأبد. تحب نأكدلك الطلب الآن؟ الدفع يبقى عند الاستلام فقط.`
          : `ماشي مشكل خالص، خذ راحتك في القرار 🙂 وإذا حبيت، نقدر نأكدلك الطلب الآن بلا أي التزام — تدفع فقط لما يوصلك المنتج وتتأكد منه.`,
        `فهمتك، القرار ليك 👍 بس فكّر: كل يوم تأجيل يعني تأخير بسيط في رؤية النتيجة اللي تبحث عنها. حاب نبدأ بقطعة تجريبية وتقيّمها بنفسك؟`,
      ]),
      // اعتراض "نشك يخدم / ما نثقش" — الطمأنة عبر الدفع عند الاستلام (تجربة بلا مخاطرة)، بدون أرقام مختلقة
      doubtResults: () => randomPick([
        `تشكك طبيعي جداً، وما فيه مشكل 🤝 أفضل طريقة تتأكد هي تجرب بنفسك: تطلب الآن وتدفع فقط عند الاستلام بعد ما تشوف المنتج وتتأكد منه — ما فيه أي مخاطرة عليك.`,
        `فهمتك 🙏 منتجاتنا طبيعية 100% ويثق بها زبائننا في كل الولايات. وباش تطمئن أكثر: الدفع عند الاستلام فقط، يعني تجرب بلا أي التزام مسبق.`,
      ]),
    },
    fr: {
      greet: p => p
        ? `Bienvenue chez <b>ALYSSUM</b> 🌿<br>Vous êtes sur la page « <b>${p.title}</b> » — posez-moi vos questions (prix, composition, livraison, paiement...) et je vous répondrai précisément.`
        : `Bienvenue chez <b>ALYSSUM</b> 🌿<br>Je suis votre assistant avant commande. Demandez-moi un produit, les prix, la livraison ou le paiement — ou décrivez votre besoin et je vous conseille.`,
      salam: () => `Bonjour et bienvenue chez ALYSSUM 👋 Je suis votre assistant personnel. Vous cherchez un produit précis ? Ou décrivez votre besoin (chute de cheveux, peau, douleurs...) et je vous conseille le plus adapté.`,
      payment: () => `Paiement à la livraison 💵 Vous ne payez qu'à la réception du produit, une fois vérifié. Aucun paiement à l'avance n'est jamais demandé. Nous acceptons aussi le mandat postal ou Baridimob, à organiser en nous contactant sur WhatsApp.`,
      returnPolicy: () => `Oui, nous reprenons le produit en cas de défaut ou de dommage à la réception 🔄 Si cela vous arrive, contactez-nous directement sur WhatsApp, nous prendrons en charge votre commande immédiatement.`,
      tracking: () => `Après confirmation de votre commande, nous vous envoyons un lien de suivi direct sur le site du transporteur 📦 pour suivre votre colis étape par étape jusqu'à la livraison.`,
      pregnancy: () => `Nos produits sont 100% naturels et utilisés en toute confiance par de nombreux clients 🌿 Toutefois, en cas de grossesse ou d'allaitement, nous vous conseillons de consulter un médecin ou un pharmacien au préalable, pour vous assurer qu'il convient à votre situation — votre santé et celle de votre enfant sont notre priorité.`,
      physicalStore: () => `Nous sommes une entreprise de production et commercialisons nos produits uniquement via notre site officiel ${SITE_DOMAIN} 🌿 cela vous garantit le meilleur prix et une production fraîche, sans intermédiaire.`,
      yearsInBusiness: () => `Nous sommes actifs depuis 2017 📅 soit plus de ${new Date().getFullYear() - 2017} ans d'expérience et la confiance de milliers de clients partout en Algérie.`,
      pharmacyAvailability: () => `Certains de nos produits sont disponibles en pharmacie sur demande 💊 mais commander directement sur notre site reste plus simple et plus rapide, avec paiement à la livraison partout en Algérie.`,
      regulatoryApproval: () => `Oui ✅ tous nos produits sont contrôlés et autorisés par le Ministère du Commerce — qualité et sécurité garanties à 100%.`,
      phoneContact: () => `Le moyen le plus rapide de nous contacter est WhatsApp 📱 avec une réponse instantanée et automatique à toute heure.<br><a href="https://wa.me/${WA_NUMBER}" target="_blank" style="color:var(--ok);font-weight:900">📱 WhatsApp ${WA_NUMBER.replace("213","0")}</a>`,
      socialMedia: () => `Suivez-nous pour plus d'offres et de conseils 🌿<br>📸 Instagram : <a href="https://www.instagram.com/${SITE_IG}" target="_blank" style="color:var(--gold);font-weight:900">@${SITE_IG}</a><br>📘 Facebook : même nom "${SITE_IG}"`,
      resultsTime: () => `Le délai d'apparition des résultats varie selon le produit, généralement entre 2 et 3 semaines d'utilisation régulière ⏳ Nous sommes confiants que vous verrez la différence !`,
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
      value: p => randomPick([
        `Le prix reflète la qualité des ingrédients 100% naturels et les résultats appréciés par nos clients 🌿 Vous économisez davantage avec les offres multi-pièces (2 ou 3 pièces, parfois avec une pièce gratuite) — et vous ne payez qu'à la livraison, aucun risque à essayer.`,
        p ? `Je comprends 🤝 Faisons le calcul ensemble : « ${p.title} » à ${fmtFr(p.price)} dure généralement 1 mois complet — soit moins de ${fmtFr(dailyPrice(p.price))} par jour. Et vous ne payez qu'à la réception, après avoir vu le produit.` : null,
        (p && p.offers || []).some(o => o.free)
          ? `C'est vrai, ce n'est pas le moins cher, mais vous avez l'offre ${(p.offers.find(o => o.free)).qty} pièces à ${fmtFr(p.offers.find(o => o.free).price)} (dont 1 gratuite 🎁) — plus avantageuse que l'achat à l'unité.`
          : null,
      ].filter(Boolean)),
      objectionDelay: p => randomPick([
        (p && p.old)
          ? `Prenez votre temps 🙂 Sachez juste que le prix actuel (${fmtFr(p.price)} au lieu de ${fmtFr(p.old)}) est une réduction temporaire — je ne peux pas garantir qu'elle sera toujours disponible. Je confirme votre commande ? Paiement uniquement à la livraison.`
          : `Aucun souci, prenez le temps qu'il vous faut 🙂 Si vous le souhaitez, je peux réserver votre commande sans aucun engagement — vous ne payez qu'à la réception, une fois le produit vérifié.`,
        `Je comprends, c'est votre décision 👍 Mais réfléchissez : chaque jour d'attente retarde un peu les résultats que vous recherchez. On commence par une unité d'essai ?`,
      ]),
      doubtResults: () => randomPick([
        `Votre doute est tout à fait normal 🤝 La meilleure façon de vous en assurer est d'essayer vous-même : commandez maintenant et vous ne payez qu'à la réception, après avoir vérifié le produit — aucun risque.`,
        `Je comprends 🙏 Nos produits sont 100% naturels et font confiance à nos clients partout en Algérie. Et pour plus de tranquillité : paiement uniquement à la livraison, sans engagement préalable.`,
      ]),
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
    { re: /(نشري بعد|نفكر فيها|نخمم فيها|بعدين نشري|لاحقاً نطلب|لاحقا نطلب|غدوة نطلب|رح نرجع|plus tard|je réfléchis|je vais réfléchir|on verra)/i, key: "objectionDelay" },
    { re: /(نشك يخدم|ما نثقش|مانثقش|شاك في|مقتنعش|ماشي متأكد|est-ce que ça marche vraiment|ça marche vraiment|sceptique|pas convaincu|j'ai un doute)/i, key: "doubtResults" },
    { re: /(حامل|حمل|رضاعة|مرضعة|الحمل|enceinte|grossesse|allaitement)/i, key: "pregnancy" },
    { re: /(مدة ظهور النتيجة|متى تظهر النتيجة|متى تظهر نتيجة|كم تدوم النتيجة|كم تدوم|كم يستمر مفعول|combien de temps pour voir|délai.*résultat|delai.*résultat)/i, key: "resultsTime" },
    { re: /(استرجاع|ارجاع|إرجاع|ترجع|رجعت|رد المنتج|إعادة المنتج|retour produit|remboursement)/i, key: "returnPolicy" },
    { re: /(تتبع|تابع|اتابع|وين طلبي|فين طلبي|suivi|tracking)/i, key: "tracking" },
    { re: /(محل|متجر فعلي|عندكم محل|où êtes.vous|magasin physique)/i, key: "physicalStore" },
    { re: /(منذ متى|كم سنة|من متى تعملون|depuis quand|expérience)/i, key: "yearsInBusiness" },
    { re: /(صيدلية|صيدليات|pharmacie)/i, key: "pharmacyAvailability" },
    { re: /(مراقب|مصرح|مرخص|وزارة التجارة|agréé|autorisé|contrôlé)/i, key: "regulatoryApproval" },
    { re: /(اتصال|تلفون|رقم الهاتف|هاتف|appel|téléphone|numéro)/i, key: "phoneContact" },
    { re: /(انستغرام|انستقرام|فيسبوك|فايسبوك|فيس بوك|instagram|facebook)/i, key: "socialMedia" },
    { re: /(سعر|بكم|ثمن|بشحال|شحال|prix|combien|coûte|coute|tarif)/i, key: "price" },
    { re: /(مكونات|مكوناته|مكوناتها|تركيبة|فيم يتكون|composition|ingrédients?|ingredient)/i, key: "ingredients" },
    { re: /(توصيل|ليفريزون|ليفريسون|توصيلة|الولايات|livraison|delivery)/i, key: "delivery" },
    { re: /(دفع|الدفع|كاش|ثقة|نصب|احتيال|paiement|payer|confiance|arnaque)/i, key: "payment" },
    { re: /(ضمان|أصلي|طبيعي|كيماوي|فعالية|نتيجة|نتائج|garantie|original|naturel|efficace)/i, key: "guarantee" },
    { re: /(أكثر.*(طلب|مبيع)|الأكثر|افضل منتج|أفضل منتج|best.?seller|plus demand|populaires)/i, key: "bestsellers" },
    { re: /(اطلب|أطلب|إطلب|شراء|اشتري|أشتري|كيف اطلب|طريقة الطلب|طريقة الشراء|تشرت|commander|acheter|comment.*command)/i, key: "howOrder" },
    { re: /(واتساب|whatsapp|واتس)/i, key: "whatsapp" },
    { re: /(شكرا|شكراً|مشكور|merci)/i, key: "thanks" },
  ];

  /* ── أسئلة وأجوبة مخصّصة (تُدار من لوحة التحكم admin.html ⟵ الوكيل الذكي) ──
     تُقرأ مرة واحدة من assets/data/agent-faq.json، وتُفحص أولاً قبل الردود الجاهزة الافتراضية
     أدناه، فتُعطى الأولوية دائماً — هكذا يمكن تخصيص/تحسين رد المساعد بلا تعديل الكود. */
  let CUSTOM_QA = [];
  let __qaLoaded = false;
  async function ensureCustomQA() {
    if (__qaLoaded) return;
    __qaLoaded = true;
    try {
      const r = await fetch((typeof REL !== "undefined" ? REL : "") + "assets/data/agent-faq.json", { cache: "no-store" });
      CUSTOM_QA = r.ok ? await r.json() : [];
    } catch (e) { CUSTOM_QA = []; }
  }
  function matchCustomQA(t) {
    const low = t.toLowerCase();
    for (const qa of CUSTOM_QA) {
      if (!qa || qa.active === false) continue;
      const kws = (qa.keywords || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      if (kws.some(k => k && low.includes(k))) return qa;
    }
    return null;
  }

  /* ── تدريب الوكيل لكل صفحة (تُدار من لوحة التحكم ⟵ الوكيل الذكي ⟵ تدريب الوكيل) ──
     assets/data/agent-training.json: { scopes: { home: {...}, "<slug>": {...} } }
     الدماغ (AgentBrain) يُحمَّل عند الحاجة فقط ويبحث في: الأسئلة المدرَّبة + معلومات الصفحة + بيانات المنتج. */
  let TRAIN = null, BRAIN_CHUNKS = null, APPS_OFF = new Set();
  const scopeKey = () => currentSlug || "home";
  const scopeCfg = () => (TRAIN && TRAIN.scopes && TRAIN.scopes[scopeKey()]) || null;
  function loadScriptOnce(src) {
    return new Promise(res => {
      if (window.AgentBrain) return res();
      const s = document.createElement("script"); s.src = src; s.onload = () => res(); s.onerror = () => res();
      document.head.appendChild(s);
    });
  }
  let __trainP = null;
  function ensureTraining() {
    if (__trainP) return __trainP;
    __trainP = (async () => {
      const base = (typeof REL !== "undefined" ? REL : "");
      try {
        const r = await fetch(base + "assets/data/agent-training.json", { cache: "no-store" });
        TRAIN = r.ok ? await r.json() : null;
      } catch (e) { TRAIN = null; }
      try { const r = await fetch(base + "assets/data/apps.json", { cache: "no-store" }); const j = r.ok ? await r.json() : null; APPS_OFF = new Set((j && j.off) || []); } catch (e) { APPS_OFF = new Set(); }      // تعطيل التطبيقات من لوحة التحكم (agent/voice)
      const c = scopeCfg();
      await loadScriptOnce(base + "assets/js/agent-brain.js");            // يلزم أيضاً لبحث المنتجات بالكلمات المفتاحية
      if (c && c.enabled !== false) applyIdentity();
    })();
    return __trainP;
  }
  function applyIdentity() { // اسم الوكيل الخاص بهذه الصفحة
    const c = scopeCfg(); if (!c || !c.name) return;
    const b = document.querySelector("#agent-panel .agent-head b");
    if (b) b.textContent = c.name;
  }
  function trainedAnswer(t) {
    const c = scopeCfg();
    if (!c || c.enabled === false || !window.AgentBrain) return null;
    try {
      if (c.useContent && !BRAIN_CHUNKS) BRAIN_CHUNKS = AgentBrain.chunksFromDoc(document);
      const facts = c.useContent ? AgentBrain.factsFromProduct(currentProduct(), fmt) : [];
      const r = AgentBrain.answer(t, c, BRAIN_CHUNKS || [], facts, lang);
      return r ? r.text : null;
    } catch (e) { return null; }
  }

  /* ── بحث المنتجات بالكلمات المفتاحية: يقرأ عنوان المنتج وحقل «كلمات مفتاحية للوكيل» (لوحة الإدارة ← تعديل المنتج) ووصفه،
     ويقارن بعد تطبيع/تجذير عربي-فرنسي. لا يعتمد على قائمة ثابتة في الكود، فأي منتج جديد يُعرَف تلقائياً بكلماته. ── */
  const PSCORE_MIN = 3;
  let PIDX = null, PIDX_LEN = -1;
  function productIndex() {
    const list = (window.PRODUCTS || []).filter(p => p.active !== false && p.slug !== "test");
    if (PIDX && PIDX_LEN === list.length) return PIDX;
    const tk = s => new Set(AgentBrain.tokens(s || ""));
    PIDX = list.map(p => ({ p, kw: tk(String(p.keywords || "").replace(/[,،;]/g, " ")), title: tk(p.title), slug: tk(String(p.slug).replace(/-/g, " ")), desc: tk(p.desc),
      phrases: String(p.keywords || "").split(/[,،;\n]/).map(x => AgentBrain.norm(x)).filter(x => x.length > 3) }));
    PIDX_LEN = list.length; return PIDX;
  }
  function searchProducts(text) {
    if (!window.AgentBrain || !AgentBrain.tokens) return [];
    const q = AgentBrain.tokens(text), nq = AgentBrain.norm(text);
    if (!q.length) return [];
    const scored = productIndex().map(e => {
      let sc = 0, strong = 0;
      new Set(q).forEach(t => { if (e.kw.has(t) || e.title.has(t)) { sc += 3; strong++; } else if (e.slug.has(t)) { sc += 2; strong++; } else if (e.desc.has(t)) sc += 1; });
      e.phrases.forEach(ph => { if (nq.includes(ph)) sc += 4; });               // عبارة مفتاحية كاملة وردت في السؤال
      if (currentSlug && e.p.slug === currentSlug && sc > 0) sc += 1.5;        // الأفضلية للمنتج المعروض في الصفحة
      return { p: e.p, sc, strong };
    }).filter(x => x.sc >= PSCORE_MIN && x.strong > 0).sort((a, b) => b.sc - a.sc);
    return scored;
  }
  function productsReply(found, l) {
    const top = found[0], rest = found.slice(1).filter(x => x.sc >= Math.max(PSCORE_MIN, top.sc * 0.65)).slice(0, 2);
    if (!rest.length) return productPitch(top.p, l);
    const intro = l === "fr" ? "Voici les produits qui correspondent à votre besoin :" : "هذه المنتجات المناسبة لطلبك 👇";
    const more = l === "fr" ? "Dites-moi lequel vous intéresse et je vous explique tout 🌿" : "قل لي أيّها يهمّك وأشرح لك التفاصيل 🌿";
    return `${intro}<br>` + [top].concat(rest).map(x => productCard(x.p, l)).join("<br>") + `<br>${more}`;
  }

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
    return `<span class="mini">🌿 <b>${p.title}</b><br>${l === "fr" ? fmtFr(p.price) : fmt(p.price)}${p.old ? ` <s>${l === "fr" ? fmtFr(p.old) : fmt(p.old)}</s>` : ""} · <a href="${REL}${p.route?"lp/"+p.route:"p/"+p.slug}/" style="color:var(--gold);font-weight:900">${label}</a></span>`;
  }

  /* وصف/تحفيز دقيق لمنتج معيّن: يستعمل بيانات المنتج الحقيقية (السعر، العروض، الوصف) وليس نصاً عاماً مختلقاً
     — يضيف أحياناً (٣٥٪ من الوقت) اقتراح منتج مكمّل حقيقي (Cross-sell) عندما يوجد له مقابل منطقي */
  function productPitch(p, l) {
    const hook = (KNOWLEDGE[p.slug] && KNOWLEDGE[p.slug][l]) || "";
    const desc = p.desc || "";
    const intro = hook || desc;
    const cross = Math.random() < 0.35 ? crossSellLine(p.slug, l) : "";
    return `${intro}${bestOfferLine(p, l)}${productCard(p, l)}<br>${T[l].askOrder()}${cross}`;
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
    userTalked = true;
    const u = document.createElement("div");
    u.className = "msg user"; u.textContent = t;
    body().appendChild(u); body().scrollTop = body().scrollHeight;
    await ensureCustomQA();
    await ensureTraining();

    // محاولة ربط نموذج لغوي خارجي أولاً (اختياري)
    if (window.CONFIG && CONFIG.AGENT_ENDPOINT) {
      typing(async () => {
        try {
          const r = await fetch(CONFIG.AGENT_ENDPOINT, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: t, lang, product: currentProduct(), products: (window.PRODUCTS || []).slice(0, 30) }),
          });
          const j = await r.json();
          if (j.reply) { botSay(j.reply); addCta(); } else answerOrFallback(t);
        } catch (e) { answerOrFallback(t); }
      }, 900);
    } else {
      typing(() => answerOrFallback(t), 700);
    }
  }

  function fallback(t) {
    const l = lang;
    const tr = T[l];

    // تدريب الصفحة (أسئلة مدرَّبة + معلومات الصفحة) — الأولوية الأولى
    const trained = trainedAnswer(t);
    if (trained) return trained;

    // أسئلة/أجوبة مخصّصة من لوحة التحكم — لها الأولوية دائماً على الردود الجاهزة أدناه
    const customQA = matchCustomQA(t);
    if (customQA) {
      const ans = l === "fr" ? (customQA.answer_fr || customQA.answer_ar) : (customQA.answer_ar || customQA.answer_fr);
      if (ans) return ans;
    }

    // سعر التوصيل لولاية محدَّدة: يُقرأ من بيانات الرسوم الحيّة، لا يُختلق أي رقم
    if (/(توصيل|شحن|ليفريزون|ليفريسون|livraison)/i.test(t)) {
      const w = findWilaya(t);
      if (w) return tr.deliveryWilaya(w);
    }
    const wOnly = findWilaya(t);
    if (wOnly && /(بكم|كم|ثمن|سعر|combien|prix|tarif)/i.test(t)) return tr.deliveryWilaya(wOnly);

    for (const it of INTENTS) {
      if (!it.re.test(t)) continue;
      if (it.key === "bestsellers") {
        const feat = (window.PRODUCTS || []).filter(p => p.old).slice(0, 3);
        return feat.length ? `${tr.bestSellersIntro()}<br>` + feat.map(p => productCard(p, l)).join("<br>") + `<br>${tr.askNeed()}` : tr.askNeed();
      }
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
      // معالجة الاعتراضات (سعر / تأجيل) تحتاج المنتج الحالي لتبني حجة دقيقة (سعر يومي حقيقي، تخفيض حقيقي...)
      if (it.key === "value" || it.key === "objectionDelay") {
        const p = currentProduct() || findProductByText(t) || null;
        return tr[it.key](p);
      }
      if (it.key === "whatsapp") return tr.whatsapp();
      if (it.key) return tr[it.key]();
      if (it.act) {
        const found = searchProducts(t);                        // بحث بالكلمات المفتاحية أولاً، والنية الثابتة احتياط
        if (found.length) return productsReply(found, l);
        const p = (window.PRODUCTS || []).find(p => p.slug === it.act);
        if (p) return productPitch(p, l);
      }
    }

    // ردّ الزبون باسم ولاية فقط (مثلاً كجواب على سؤال «أي ولاية؟») ولم يُطابق أي نية أخرى أعلاه
    // → نعتبرها متابعة لسؤال التوصيل ونعطيه السعر الدقيق مباشرة، بدل الرجوع لتعريف عام للمنتج
    const wFollowUp = findWilaya(t);
    if (wFollowUp) return tr.deliveryWilaya(wFollowUp);

    // ذكر اسم منتج صراحةً → نعرّف به
    const byName = findProductByText(t);
    if (byName) return productPitch(byName, l);

    // لا نية مطابقة: ابحث في كلمات المنتجات المفتاحية (مثل «عسل للأطفال» أو «شيء للذاكرة»)
    const byKw = searchProducts(t);
    if (byKw.length) return productsReply(byKw, l);

    // لم نفهم السؤال: اعتذار + أسئلة افتراضية، ويُسجَّل السؤال لتجيب عليه لاحقاً من لوحة الإدارة
    return NOT_UNDERSTOOD;
  }

  const NOT_UNDERSTOOD = "__NOT_UNDERSTOOD__";
  const defaultQuestions = l => {
    const trained = ((scopeCfg() || {}).qa || []).filter(x => x && x.active !== false && x.q).slice(0, 3).map(x => x.q);
    const base = l === "fr"
      ? (currentSlug ? ["Quel est le prix ?", "Paiement à la livraison ?", "Quel délai de livraison ?", "Comment commander ?"] : ["Quels sont vos produits les plus demandés ?", "Quels sont les frais de livraison ?", "Paiement à la livraison ?", "Comment commander ?"])
      : (currentSlug ? ["ما هو سعر المنتج؟", "هل الدفع عند الاستلام؟", "كم مدة التوصيل؟", "هل المنتج أصلي وآمن؟", "كيف أطلب؟"] : ["ما هي أكثر المنتجات طلباً؟", "كم رسوم التوصيل؟", "هل الدفع عند الاستلام؟", "كيف أطلب؟"]);
    return trained.concat(base).slice(0, 6);
  };
  const loggedQ = new Set();
  function logUnanswered(t) {
    const q = t.trim(); if (q.length < 3 || q.length > 300 || loggedQ.has(q)) return;
    loggedQ.add(q);
    try { if (typeof API !== "undefined" && API.logQuestion) API.logQuestion(q, scopeKey(), lang); } catch (e) {}
  }
  function notUnderstoodHtml() {
    return (lang === "fr"
      ? "Je préfère ne pas vous donner une mauvaise réponse 🙏 Pourriez-vous reformuler votre question en précisant le nom du produit ou du sujet (prix, livraison, commande…) ? Ou choisissez l'une de ces questions :"
      : "أعد طرح السؤال رجاءً مع ذكر اسم المنتج أو الموضوع الذي تريده 🙏 (مثل: السعر، التوصيل، طريقة الطلب) — أفضّل ألا أجيبك بجواب خاطئ. أو اختر أحد هذه الأسئلة:") + chipsHtml(defaultQuestions(lang));
  }
  function answerOrFallback(t) {                      // يُستعمل في كل مسارات الرد
    const r = fallback(t);
    if (r === NOT_UNDERSTOOD) { logUnanswered(t); botSay(notUnderstoodHtml()); bindChips(body()); return; }
    botSay(r); addCta();
  }

  /* ── مبادرة الوكيل: لا يفتح اللوحة وحده (كان يغطي الصفحة)، لكن بعد مدة — إن لم يضغط الزبون على
     الطلب ولم يبدأ ملء النموذج — تظهر رسالة ترحيب صغيرة فوق الأيقونة؛ إن ضغط عليها يبدأ نقاش إقناع بالشراء ── */
  let engaged = false, followTimer = null, userTalked = false;
  const nudgeCfg = () => {
    const c = scopeCfg(), n = (c && c.nudge) || {};
    const on = n.enabled !== undefined ? !!n.enabled : !!currentSlug;      // افتراضياً: مفعّلة في صفحات المنتجات فقط
    return { on: on && !(c && c.enabled === false && n.enabled === undefined), delay: Math.max(5, Number(n.delaySec) || 25), message: (n.message || "").trim() };
  };
  const defaultNudgeText = p => {
    const multi = p && (p.offers || []).find(o => o.qty > 1);
    const offer = multi ? `<br>🎁 عرض خاص: ${multi.qty} قطع بـ <b>${fmt(multi.price)}</b>${multi.free ? " (منها قطعة مجانية)" : ""}.` : "";
    return p
      ? `👋 مرحباً بك! أنا مساعدك الشخصي. لاحظت اهتمامك بـ «<b>${p.title}</b>» — هل تود أن أجيبك عن أي سؤال قبل الطلب؟<br>💵 الدفع عند الاستلام · 🚚 توصيل لـ 58 ولاية${offer}`
      : `👋 مرحباً بك في <b>${SITE_NAME}</b>! هل أساعدك في اختيار المنتج المناسب؟`;
  };
  const chipsHtml = list => `<div class="agent-chips">${list.map(q => `<button type="button" class="chip" data-q="${q}">${q}</button>`).join("")}</div>`;
  function bindChips(root) {
    root.querySelectorAll(".chip[data-q]").forEach(b => b.onclick = () => { b.parentNode.remove(); reply(b.dataset.q); });
    root.querySelectorAll(".chip[data-order]").forEach(b => b.onclick = () => goOrder());
  }
  function goOrder() {
    close();
    const f = document.getElementById("order-form");
    if (f) { f.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => document.getElementById("name")?.focus({ preventScroll: true }), 600); }
  }
  function addCta() {                                 // زر «اطلب الآن» بعد الردود في صفحات المنتجات
    if (!currentSlug || !document.getElementById("order-form")) return;
    const d = document.createElement("div"); d.className = "msg bot cta";
    d.innerHTML = `<div class="agent-chips"><button type="button" class="chip gold" data-order="1">🛒 اطلب الآن — الدفع عند الاستلام</button></div>`;
    body().appendChild(d); bindChips(d); body().scrollTop = body().scrollHeight;
  }
  function hideTeaser() { const t = document.getElementById("agent-teaser"); if (t) t.remove(); }
  function showTeaser() {
    if (engaged || document.getElementById("agent-teaser") || panel().classList.contains("open")) return;
    try { if (sessionStorage.getItem("alyssum_nudged_" + scopeKey())) return; sessionStorage.setItem("alyssum_nudged_" + scopeKey(), "1"); } catch (e) {}
    const n = nudgeCfg();
    if (avatarOn) { Avatar.tease(n.message || defaultNudgeText(currentProduct())); return; }
    const t = document.createElement("div");
    t.className = "agent-teaser"; t.id = "agent-teaser";
    t.innerHTML = `<button type="button" class="tx" aria-label="إغلاق">✕</button><div class="tt">${n.message || defaultNudgeText(currentProduct())}</div>
      <div class="agent-chips"><button type="button" class="chip gold" id="agent-teaser-go">💬 نعم، لدي سؤال</button></div>`;
    document.body.appendChild(t);
    t.querySelector(".tx").onclick = hideTeaser;
    t.querySelector("#agent-teaser-go").onclick = () => { hideTeaser(); open({ persuade: true }); };
    t.querySelector(".tt").onclick = () => { hideTeaser(); open({ persuade: true }); };
  }
  async function startNudge() {
    await ensureTraining();
    const n = nudgeCfg();
    if (!n.on) return;
    const mark = () => { engaged = true; hideTeaser(); };
    document.addEventListener("click", e => { if (e.target.closest && e.target.closest(".btn-order, #add-cart, .btn-wa, a[href='#order-form'], .sticky-cta a, #order-form button")) mark(); }, true);
    document.addEventListener("focusin", e => { if (e.target.closest && e.target.closest("#order-form")) mark(); });
    document.addEventListener("submit", mark, true);
    setTimeout(showTeaser, n.delay * 1000);
  }

  function open(opts) {
    if (avatarOn) return Avatar.start();
    hideTeaser();
    panel().classList.add("open");
    document.getElementById("agent-fab").style.display = "none";
    if (!greeted) {
      greeted = true;
      ensureTraining().then(() => {
        const c = scopeCfg(), p = currentProduct();
        typing(() => botSay((c && c.enabled !== false && c.greeting) ? c.greeting : T[lang].greet(p)), 600);
        if (p && opts && opts.persuade) {            // نقاش الإقناع: عرض المنتج بسعره وعرضه + أسئلة سريعة تفتح الحوار
          setTimeout(() => typing(() => {
            botSay(productPitch(p, lang) + chipsHtml(["هل هو أصلي وآمن؟", "هل الدفع عند الاستلام؟", "كم مدة التوصيل؟", "السعر غالي قليلاً"]));
            bindChips(body());
          }, 900), 900);
          // متابعة واحدة إن سكت الزبون: دفعة لطيفة نحو الطلب
          followTimer = setTimeout(() => {
            if (userTalked || !panel().classList.contains("open")) return;
            botSay(`هل بقي لديك أي تردد؟ 🤝 أجيبك عنه بكل صراحة. وتذكّر أنك لا تدفع إلا عند استلام «${p.title}» والتأكد منه.`);
            addCta();
          }, 30000);
        }
      });
    }
    setTimeout(()=>document.getElementById("agent-input")?.focus(), 300);
  }
  function close() {
    panel().classList.remove("open");
    document.getElementById("agent-fab").style.display = "grid";
  }

  /* ══════════════ الأفاتار الناطق (واجهة بديلة للمحادثة النصية — يُعرض أحدهما فقط حسب الإعدادات) ══════════════
     نفس عقل الوكيل ونفس تدريبه: أسئلة الزبون تمرّ عبر reply() نفسها (agent-brain + التدريب) ثم تُنطَق ردودها.
     يقرأ أعلى الصفحة (AvatarScript) فيقنع بالشراء ويشير إلى «اطلب الآن». الصوت بالأولوية:
     ملفات جاهزة (assets/data/avatar-audio.json) ← ElevenLabs إن وُجد مفتاحه في هذا المتصفح ← Web Speech ← نص صامت.
     قاعدة العلامة: امرأة محجّبة بلباس محتشم دائماً. */
  let avatarOn = false;
  const Avatar = (() => {
    const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} return null; };
    const DEF_VOICE = "21m00Tcm4TlvDq8ikWAM";
    let noVoice = false, root, bubble, token = 0, speaking = false, muted = LS("alyssum_av_mute") === "1", ctx = null, analyser = null, buf = null, curAudio = null, pulse = 0, mouth = 0, manifest = null, lastChips = null;
    const clean = s => (window.AvatarScript ? AvatarScript.clean(s) : String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
    const css = `#agent-avatar{position:fixed;right:14px;bottom:92px;z-index:72;font-family:inherit;direction:rtl}
#agent-avatar .av-btn{width:78px;height:78px;border-radius:50%;border:2px solid var(--gold,#c8a24b);background:#f7f4ed;padding:0;cursor:pointer;box-shadow:0 10px 26px rgba(23,63,53,.35);overflow:hidden;display:block;position:relative}
#agent-avatar .av-btn svg{width:100%;height:100%;display:block}
#agent-avatar.idle .av-btn::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(200,162,75,.55);animation:avPulse 2.2s infinite}
#agent-avatar.talk .av-btn{box-shadow:0 0 0 4px rgba(47,107,87,.35),0 10px 26px rgba(23,63,53,.35)}
#agent-avatar .av-tag{position:absolute;right:50%;transform:translateX(50%);bottom:-8px;background:var(--green,#173f35);color:#fff;font-size:.68rem;font-weight:800;padding:.1rem .55rem;border-radius:999px;white-space:nowrap}
#agent-avatar .av-bub{position:absolute;right:0;bottom:94px;width:min(310px,calc(100vw - 28px));background:#fff;border:1px solid var(--gold-2,#d9c28a);border-radius:16px 16px 4px 16px;box-shadow:0 14px 34px rgba(23,63,53,.25);padding:.8rem .9rem;font-size:.92rem;line-height:1.7;display:none}
#agent-avatar.open .av-bub{display:block}
#agent-avatar .av-bub .av-x{position:absolute;top:2px;left:6px;background:none;border:0;font-size:1rem;cursor:pointer;color:#777}
#agent-avatar .av-txt{padding-top:.2rem;min-height:3.2em;max-height:34vh;overflow:auto}
#agent-avatar .av-tools,#agent-avatar .av-chips{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.55rem}
#agent-avatar .av-tools button,#agent-avatar .av-chips button{font-family:inherit;font-size:.8rem;font-weight:800;border-radius:999px;padding:.35rem .8rem;cursor:pointer;border:1px solid var(--gold-2,#d9c28a);background:#f4efe4;color:var(--green,#173f35)}
#agent-avatar .av-tools .gold{background:var(--gold,#c8a24b);color:#1d1d1d;border-color:var(--gold,#c8a24b)}
#agent-avatar.point .av-order{animation:avHl 1s infinite}
#agent-avatar .av-in{display:flex;gap:.4rem;margin-top:.55rem}
#agent-avatar .av-in input{flex:1;min-width:0;border:1.5px solid var(--line,#e5dfd0);border-radius:999px;padding:.4rem .8rem;font-family:inherit;font-size:.88rem}
#agent-avatar .av-in button{width:36px;height:36px;border-radius:50%;background:var(--green,#173f35);color:#fff;border:0;cursor:pointer}
#agent-avatar .av-hand{position:absolute;right:58px;bottom:62px;width:46px;height:64px;display:none;pointer-events:none;transform-origin:50% 100%}
#agent-avatar.point .av-hand{display:block;animation:avPoint .9s ease-in-out infinite}
#agent-avatar .av-eye{transform-box:fill-box;transform-origin:center;animation:avBlink 4.6s infinite}
#agent-avatar .av-eye.e2{animation-delay:.03s}
#agent-avatar .m1,#agent-avatar .m2{display:none}
#agent-avatar[data-m="0"] .m0,#agent-avatar[data-m="1"] .m1,#agent-avatar[data-m="2"] .m2{display:inline}
.av-hl{outline:3px solid #c8a24b!important;outline-offset:3px;animation:avHl 1s infinite}
@keyframes avBlink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
@keyframes avPulse{0%{transform:scale(1);opacity:.9}100%{transform:scale(1.25);opacity:0}}
@keyframes avPoint{0%,100%{transform:translateY(0) rotate(-14deg)}50%{transform:translateY(-9px) rotate(-14deg)}}
@keyframes avHl{0%,100%{box-shadow:0 0 0 0 rgba(200,162,75,.7)}50%{box-shadow:0 0 0 9px rgba(200,162,75,0)}}
@media (prefers-reduced-motion:reduce){#agent-avatar .av-eye,#agent-avatar.idle .av-btn::after,#agent-avatar.point .av-hand,.av-hl,#agent-avatar.point .av-order{animation:none}}
@media (max-width:640px){#agent-avatar{right:10px;bottom:84px}#agent-avatar .av-btn{width:64px;height:64px}#agent-avatar .av-bub{bottom:80px}#agent-avatar .av-hand{right:46px;bottom:50px}}`;
    const FACE = `<svg viewBox="0 0 120 140" aria-hidden="true">
<path d="M6 140Q8 106 60 102Q112 106 114 140Z" fill="#2c6552"/>
<path d="M14 124Q2 70 30 34Q60 4 90 34Q118 70 106 124Q60 138 14 124Z" fill="#3d8a6f"/>
<ellipse cx="60" cy="66" rx="27" ry="33" fill="#f2cfae"/>
<path d="M30 60Q32 28 60 26Q88 28 90 60Q84 40 60 38Q36 40 30 60Z" fill="#3d8a6f"/>
<path d="M27 92Q60 128 93 92L100 132Q60 144 20 132Z" fill="#33785f"/>
<path d="M40 52Q48 47 55 51M65 51Q72 47 80 52" stroke="#5b3a29" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<g class="av-eye"><ellipse cx="48" cy="63" rx="4.2" ry="5" fill="#2a1d16"/><circle cx="49.4" cy="61.2" r="1.3" fill="#fff"/></g>
<g class="av-eye e2"><ellipse cx="72" cy="63" rx="4.2" ry="5" fill="#2a1d16"/><circle cx="73.4" cy="61.2" r="1.3" fill="#fff"/></g>
<path d="M60 68Q57 76 61 77" stroke="#c99a78" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<circle cx="41" cy="77" r="5" fill="#f1a99b" opacity=".5"/><circle cx="79" cy="77" r="5" fill="#f1a99b" opacity=".5"/>
<g class="m0"><path d="M51 85Q60 91 69 85" stroke="#a63d3d" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>
<g class="m1"><path d="M52 84Q60 94 68 84Q60 87 52 84Z" fill="#8b2c2c"/></g>
<g class="m2"><ellipse cx="60" cy="87" rx="8" ry="7" fill="#8b2c2c"/><ellipse cx="60" cy="91" rx="4.5" ry="2.6" fill="#d9707a"/></g>
</svg>`;
    /* ذراع بكُمّ محتشم ويد تشير بالسبّابة إلى الأعلى (نحو زر «اطلب الآن» في الفقاعة) */
    const HAND = `<svg viewBox="0 0 46 64" aria-hidden="true"><path d="M12 64L14 34Q23 30 32 34L34 64Z" fill="#2c6552"/><path d="M13 36Q12 26 16 24L16 8Q16 3 20 3Q24 3 24 8L24 22Q27 20 29 22Q32 21 33 24Q36 24 36 28L35 38Q30 42 23 42Q16 42 13 36Z" fill="#f2cfae" stroke="#d9a982" stroke-width="1"/></svg>`;

    const pickVoice = l => { try { return (speechSynthesis.getVoices() || []).find(v => v.lang && v.lang.toLowerCase().startsWith(l)) || null; } catch (e) { return null; } };
    function ensureCtx() {
      if (ctx) return ctx;
      try { const AC = window.AudioContext || window.webkitAudioContext; ctx = new AC(); analyser = ctx.createAnalyser(); analyser.fftSize = 512; buf = new Uint8Array(analyser.fftSize); analyser.connect(ctx.destination); } catch (e) { ctx = null; }
      return ctx;
    }
    async function playUrl(url, tk) {                  // ملف صوتي (جاهز أو ناتج ElevenLabs) مع قياس الشدة للفم
      const a = new Audio(url); curAudio = a;
      if (ensureCtx()) { try { if (ctx.state === "suspended") await ctx.resume(); ctx.createMediaElementSource(a).connect(analyser); } catch (e) {} }
      await new Promise((res, rej) => { a.onended = res; a.onerror = () => rej(new Error("audio")); a.play().catch(rej); });
      curAudio = null; return true;
    }
    async function playEleven(text, key, tk) {
      const voice = LS("alyssum_el_voice") || DEF_VOICE;
      const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voice) + "?output_format=mp3_44100_128", { method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg" }, body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }) });
      if (!r.ok) throw new Error("eleven " + r.status);
      const url = URL.createObjectURL(await r.blob()); if (tk !== token) { URL.revokeObjectURL(url); return true; }
      try { return await playUrl(url, tk); } finally { URL.revokeObjectURL(url); }
    }
    function voicesReady() {                           // Chrome يحمّل الأصوات متأخراً: ننتظر حتى ثانية
      return new Promise(res => { try { if ((speechSynthesis.getVoices() || []).length) return res(); const t = setTimeout(res, 1000); speechSynthesis.addEventListener("voiceschanged", () => { clearTimeout(t); res(); }, { once: true }); } catch (e) { res(); } });
    }
    async function playSpeech(text, l) {                // يجرّب صوتاً عربياً، وإلا يترك المتصفح يختار صوت اللغة؛ يعيد false إن لم يُسمع شيء
      if (!("speechSynthesis" in window)) return false;
      await voicesReady();
      const v = pickVoice(l);
      return new Promise(res => {
        const u = new SpeechSynthesisUtterance(text); if (v) u.voice = v; u.lang = v ? v.lang : (l === "fr" ? "fr-FR" : "ar-SA"); u.rate = 0.95; u.pitch = 1.05;
        let started = false; const guard = setTimeout(() => { if (!started) { try { speechSynthesis.cancel(); } catch (e) {} res(false); } }, 2500);
        u.onstart = () => { started = true; clearTimeout(guard); };
        u.onboundary = () => { pulse = performance.now(); started = true; };
        u.onend = () => { clearTimeout(guard); res(started); }; u.onerror = () => { clearTimeout(guard); res(false); };
        try { speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { clearTimeout(guard); res(false); }
      });
    }
    const silent = text => new Promise(res => setTimeout(res, Math.min(9000, 1400 + text.length * 55)));
    function loop() {
      let lvl = 0;
      if (speaking) {
        if (curAudio && analyser && buf) { analyser.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; s += x * x; } const rms = Math.sqrt(s / buf.length); lvl = rms > 0.13 ? 2 : rms > 0.035 ? 1 : 0; }
        else if (!muted) { const t = performance.now(); lvl = (t - pulse < 140) ? (Math.floor(t / 70) % 2 ? 2 : 1) : (Math.floor(t / 110) % 3 === 0 ? 0 : 1 + (Math.floor(t / 90) % 2)); }
        else lvl = Math.floor(performance.now() / 160) % 3 === 0 ? 1 : 0;
      }
      if (lvl !== mouth) { mouth = lvl; root.dataset.m = String(lvl); }
      requestAnimationFrame(loop);
    }
    async function loadManifest() {
      if (manifest) return manifest;
      try { const r = await fetch((typeof REL !== "undefined" ? REL : "") + "assets/data/avatar-audio.json"); manifest = r.ok ? await r.json() : {}; } catch (e) { manifest = {}; }
      return manifest;
    }
    const show = t => { bubble.querySelector(".av-txt").textContent = t; };
    const setPoint = on => {
      root.classList.toggle("point", on);
      document.querySelectorAll(".btn-order, a[href='#order-form']").forEach(b => b.classList.toggle("av-hl", on));
      if (on) bubble.querySelector(".av-order").style.display = (currentSlug && document.getElementById("order-form")) ? "" : "none";
    };
    function chipsFrom(node) {                          // أزرار الاقتراحات في ردّ الوكيل تظهر في فقاعة الأفاتار
      const box = bubble.querySelector(".av-chips"); box.innerHTML = "";
      if (!node) return;
      node.querySelectorAll(".chip[data-q]").forEach(c => { const b = document.createElement("button"); b.type = "button"; b.textContent = c.textContent; b.onclick = () => ask(c.dataset.q); box.appendChild(b); });
    }
    async function say(text, tk, file) {                // ينطق جملة بأفضل مصدر متاح
      const l = lang === "fr" ? "fr" : "ar", key = (LS("alyssum_el_key") || "").trim();
      if (muted) return silent(text);
      let ok = false;
      if (file) { try { ok = await playUrl(file, tk); } catch (e) {} }
      if (!ok && key && tk === token) { try { ok = await playEleven(text, key, tk); } catch (e) {} }
      if (!ok && tk === token && !noVoice) { ok = await playSpeech(text, l); if (!ok) noVoice = true; }
      if (!ok && tk === token) await silent(text);
    }
    async function start() {
      try { hideTeaser(); } catch (e) {} stop(true); const tk = token; root.classList.add("open"); root.classList.remove("idle");
      bubble.querySelector(".av-chips").innerHTML = ""; setPoint(false);
      ensureCtx(); if (ctx && ctx.state === "suspended") try { ctx.resume(); } catch (e) {}
      await ensureTraining(); const mf = await loadManifest(); if (tk !== token) return;
      const l = lang === "fr" ? "fr" : "ar", sc = scopeCfg() || {};
      const rec = mf && mf.items && mf.items[scopeKey()], useRec = rec && rec.lang === l && rec.lines && rec.files && rec.lines.length === rec.files.length;
      const b = useRec ? { lines: rec.lines, cta: rec.lines.length - 1 } : AvatarScript.build({ product: currentProduct(), scope: sc, lang: l, siteName: SITE_NAME, h1: (document.querySelector("h1") || {}).textContent, products: window.PRODUCTS });
      let note = "";
      noVoice = false;
      speaking = true; root.classList.add("talk");
      for (let i = 0; i < b.lines.length; i++) {
        if (tk !== token) return; show(b.lines[i]);
        if (i === b.cta && currentSlug) setPoint(true);
        await say(b.lines[i], tk, useRec ? (typeof REL !== "undefined" ? REL : "") + rec.files[i] : null);
      }
      if (tk !== token) return;
      speaking = false; root.classList.remove("talk");
      if (noVoice && !muted) note = l === "fr" ? "(Aucune voix disponible dans ce navigateur — le texte est affiché.) " : "(متصفحك لا يملك صوتاً عربياً، فعُرض النص مكتوباً. جرّب متصفح Chrome على الجوال.) ";
      show(note + (l === "fr" ? "Une question ? Écrivez-la ci-dessous." : "هل لديك سؤال؟ اكتبه لي في الأسفل وسأجيبك."));
      const q = defaultQuestions(l).slice(0, 3); const box = bubble.querySelector(".av-chips");
      q.forEach(t => { const bt = document.createElement("button"); bt.type = "button"; bt.textContent = t; bt.onclick = () => ask(t); box.appendChild(bt); });
    }
    function stop(keepOpen) {
      token++; speaking = false; if (root) { root.classList.remove("talk"); root.dataset.m = "0"; } mouth = 0;
      try { speechSynthesis.cancel(); } catch (e) {}
      if (curAudio) { try { curAudio.pause(); } catch (e) {} curAudio = null; }
      if (!keepOpen && root) { root.classList.remove("open"); root.classList.add("idle"); setPoint(false); }
    }
    /* أسئلة الزبون: نفس reply() للوكيل (دماغ + تدريب)؛ نلتقط ردّ الوكيل ونعرضه وننطقه */
    let obs = null, waiting = 0;
    function watchBody() {
      if (obs) return;
      obs = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
        if (!waiting || !n.classList || !n.classList.contains("msg") || !n.classList.contains("bot") || n.classList.contains("typing")) return;
        if (n.classList.contains("cta")) { setPoint(true); return; }
        const text = clean(n.innerHTML.replace(/<br\s*\/?>/gi, ". ")); if (!text) return;
        waiting = 0; answer(text, n);
      })));
      obs.observe(body(), { childList: true });
    }
    async function answer(text, node) {
      stop(true); const tk = token; root.classList.add("open"); root.classList.remove("idle"); speaking = true; root.classList.add("talk");
      show(text); chipsFrom(node);
      const spoken = text.length > 420 ? text.slice(0, 420).replace(/\s\S*$/, "") : text;
      await say(spoken, tk, null); if (tk === token) { speaking = false; root.classList.remove("talk"); }
    }
    function ask(text) {
      text = String(text || "").trim(); if (!text) return;
      stop(true); root.classList.add("open"); root.classList.remove("idle"); show("…"); bubble.querySelector(".av-chips").innerHTML = ""; setPoint(false);
      waiting = 1; Promise.resolve(reply(text)).catch(() => { waiting = 0; });
    }
    function setMute(m) { muted = m; LS("alyssum_av_mute", m ? "1" : "0"); bubble.querySelector(".av-mute").textContent = m ? "🔇 صامت" : "🔊 الصوت"; if (m) { try { speechSynthesis.cancel(); } catch (e) {} if (curAudio) try { curAudio.pause(); } catch (e) {} } }
    function tease(msg) {
      if (!root || root.classList.contains("open")) return;
      root.classList.add("open"); show(msg); const a = bubble.querySelector(".av-again"); a.textContent = "▶ اسمع الشرح";
    }
    function init() {
      if (document.getElementById("agent-avatar")) return;
      const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
      root = document.createElement("div"); root.id = "agent-avatar"; root.className = "idle"; root.dataset.m = "0";
      root.innerHTML = `<div class="av-bub" role="dialog" aria-live="polite"><button type="button" class="av-x" aria-label="إغلاق">✕</button><div class="av-txt"></div><div class="av-chips"></div>
<div class="av-in"><input placeholder="اكتب سؤالك… / Votre question" aria-label="سؤالك"><button type="button" aria-label="إرسال">➤</button></div>
<div class="av-tools"><button type="button" class="gold av-order" style="display:none">🛒 اطلب الآن</button><button type="button" class="av-again">↻ أعد الشرح</button><button type="button" class="av-mute"></button></div></div>
<div class="av-hand">${HAND}</div>
<button type="button" class="av-btn" aria-label="اسمع شرح المنتج من المساعدة">${FACE}<span class="av-tag">🔊 اسمعيني</span></button>`;
      document.body.appendChild(root); bubble = root.querySelector(".av-bub");
      root.querySelector(".av-btn").onclick = () => { root.classList.contains("open") ? stop() : start(); };
      bubble.querySelector(".av-x").onclick = () => stop();
      bubble.querySelector(".av-order").onclick = () => { stop(); goOrder(); };
      bubble.querySelector(".av-again").onclick = () => { bubble.querySelector(".av-again").textContent = "↻ أعد الشرح"; start(); };
      bubble.querySelector(".av-mute").onclick = () => setMute(!muted);
      const inp = bubble.querySelector(".av-in input"), go = () => { const v = inp.value; inp.value = ""; ask(v); };
      bubble.querySelector(".av-in button").onclick = go; inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
      setMute(muted); watchBody(); loop();
      try { speechSynthesis.getVoices(); } catch (e) {}
    }
    return { init, start, stop, tease, ask, hide: () => { if (root) { stop(); root.style.display = "none"; } }, show: () => { if (root) root.style.display = ""; } };
  })();

  /* أي واجهة تظهر للزبون؟ الإعداد العام training.display.mode ('chat' | 'avatar') وقد تُلغيه الصفحة بـ scope.display؛
     وعلى الجوال تبقى المحادثة النصية إن فُعّل display.mobileChat. يظهر واحد منهما فقط. */
  function loadAvatarScript() {
    return new Promise(res => { if (window.AvatarScript) return res(); const e = document.createElement("script"); e.src = (typeof REL !== "undefined" ? REL : "") + "assets/js/avatar-script.js"; e.onload = () => res(); e.onerror = () => res(); document.head.appendChild(e); });
  }
  async function decideUi() {
    const g = (TRAIN && TRAIN.display) || {}, sc = scopeCfg() || {};
    if (APPS_OFF.has("agent")) { const f0 = document.getElementById("agent-fab"); if (f0) f0.style.display = "none"; return; }
    let mode = sc.display && sc.display !== "default" ? sc.display : (g.mode || "chat");
    if (mode === "avatar" && g.mobileChat && window.innerWidth <= 640) mode = "chat";
    if (APPS_OFF.has("voice")) mode = "chat";
    avatarOn = mode === "avatar";
    const fab = document.getElementById("agent-fab");
    if (avatarOn) { await loadAvatarScript(); if (!window.AvatarScript) { avatarOn = false; fab.style.display = "grid"; return; } fab.style.display = "none"; Avatar.init(); } else fab.style.display = "grid";
  }

  function init() {
    const fab = document.createElement("button");
    fab.className = "agent-fab"; fab.id = "agent-fab";
    fab.type = "button";
    fab.title = "المساعد الذكي"; // تلميح يظهر عند تمرير المؤشر فوق الأيقونة
    fab.setAttribute("aria-label", "المساعد الذكي");
    fab.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
    fab.onclick = open; fab.style.display = "none";           // يظهر بعد قراءة الإعداد (محادثة أم أفاتار)
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

    startNudge();
    ensureTraining().then(() => { try { decideUi().catch(e => { console.log("DUI", e.message); document.getElementById("agent-fab").style.display = "grid"; }); } catch (e) { document.getElementById("agent-fab").style.display = "grid"; } }, () => { document.getElementById("agent-fab").style.display = "grid"; });
    // لا فتح تلقائي للوحة: المساعد يبقى أيقونة صغيرة (مع تلميح "المساعد الذكي" عند المرور عليها)
    // ولا يُفتح إلا عند الضغط عليها من المستخدم — كان يفتح تلقائياً بعد 12 ثانية ويغطي الصفحة
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
  return { reply, open, avatar: Avatar };
})();
