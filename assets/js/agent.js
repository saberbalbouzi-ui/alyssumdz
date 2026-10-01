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
      ? `<br><br>✨ <b>Idée</b> : plusieurs clients associent ce produit à <a href="${REL}p/${cp.slug}/" style="color:var(--gold);font-weight:900">${cp.title}</a> (${priceStr}) pour de meilleurs résultats.`
      : `<br><br>✨ <b>فكرة</b>: كثير من زبائننا يجمعون بين هذا المنتج و<a href="${REL}p/${cp.slug}/" style="color:var(--gold);font-weight:900">${cp.title}</a> (${priceStr}) للحصول على نتيجة أفضل.`;
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
      physicalStore: () => `نحن شركة إنتاج ونُسوّق منتجاتنا فقط عبر موقعنا الرسمي alyssumdz.com 🌿 هذا يضمن لك أفضل سعر وأحدث إنتاج مباشرة دون وسطاء.`,
      yearsInBusiness: () => `نعمل منذ سنة 2017 📅 أي أكثر من ${new Date().getFullYear() - 2017} سنوات من الخبرة وثقة آلاف الزبائن في كل الجزائر.`,
      pharmacyAvailability: () => `بعض منتجاتنا متوفرة في الصيدليات حسب الطلب 💊 لكن الطلب المباشر عبر موقعنا يبقى أسهل وأسرع، مع الدفع عند الاستلام وتوصيل لجميع الولايات.`,
      regulatoryApproval: () => `نعم ✅ جميع منتجاتنا مراقبة ومصرح بها من طرف وزارة التجارة، فهي مضمونة الجودة والسلامة 100%.`,
      phoneContact: () => `للتواصل معنا، الطريقة الأسرع هي واتساب 📱 والرد يكون فورياً وتلقائياً على مدار اليوم.<br><a href="https://wa.me/${WA_NUMBER}" target="_blank" style="color:var(--ok);font-weight:900">📱 واتساب ${WA_NUMBER.replace("213","0")}</a>`,
      socialMedia: () => `تابعنا لمزيد من العروض والنصائح 🌿<br>📸 انستغرام: <a href="https://www.instagram.com/alyssumdzofficiel" target="_blank" style="color:var(--gold);font-weight:900">@alyssumdzofficiel</a><br>📘 فيسبوك: بنفس الاسم "alyssumdzofficiel"`,
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
      physicalStore: () => `Nous sommes une entreprise de production et commercialisons nos produits uniquement via notre site officiel alyssumdz.com 🌿 cela vous garantit le meilleur prix et une production fraîche, sans intermédiaire.`,
      yearsInBusiness: () => `Nous sommes actifs depuis 2017 📅 soit plus de ${new Date().getFullYear() - 2017} ans d'expérience et la confiance de milliers de clients partout en Algérie.`,
      pharmacyAvailability: () => `Certains de nos produits sont disponibles en pharmacie sur demande 💊 mais commander directement sur notre site reste plus simple et plus rapide, avec paiement à la livraison partout en Algérie.`,
      regulatoryApproval: () => `Oui ✅ tous nos produits sont contrôlés et autorisés par le Ministère du Commerce — qualité et sécurité garanties à 100%.`,
      phoneContact: () => `Le moyen le plus rapide de nous contacter est WhatsApp 📱 avec une réponse instantanée et automatique à toute heure.<br><a href="https://wa.me/${WA_NUMBER}" target="_blank" style="color:var(--ok);font-weight:900">📱 WhatsApp ${WA_NUMBER.replace("213","0")}</a>`,
      socialMedia: () => `Suivez-nous pour plus d'offres et de conseils 🌿<br>📸 Instagram : <a href="https://www.instagram.com/alyssumdzofficiel" target="_blank" style="color:var(--gold);font-weight:900">@alyssumdzofficiel</a><br>📘 Facebook : même nom "alyssumdzofficiel"`,
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
  let TRAIN = null, BRAIN_CHUNKS = null;
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
      const c = scopeCfg();
      if (c && c.enabled !== false) await loadScriptOnce(base + "assets/js/agent-brain.js");
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
      ? "Désolé, je n'ai pas compris votre question 🙏 Veuillez la reformuler, ou choisissez l'une de ces questions :"
      : "من فضلك أعد صياغة السؤال 🙏 — اعتذر، لم أفهم سؤالك. غيّر السؤال أو استعمل أحد هذه الأسئلة:") + chipsHtml(defaultQuestions(lang));
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

  function init() {
    const fab = document.createElement("button");
    fab.className = "agent-fab"; fab.id = "agent-fab";
    fab.type = "button";
    fab.title = "المساعد الذكي"; // تلميح يظهر عند تمرير المؤشر فوق الأيقونة
    fab.setAttribute("aria-label", "المساعد الذكي");
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

    startNudge();
    // لا فتح تلقائي للوحة: المساعد يبقى أيقونة صغيرة (مع تلميح "المساعد الذكي" عند المرور عليها)
    // ولا يُفتح إلا عند الضغط عليها من المستخدم — كان يفتح تلقائياً بعد 12 ثانية ويغطي الصفحة
  }

  document.addEventListener("DOMContentLoaded", init);
  return { reply, open };
})();
