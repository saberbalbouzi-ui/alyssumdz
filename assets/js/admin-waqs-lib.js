/* مكتبة رسائل WhatsApp Quick Sender الجاهزة — خاصة بمالك المنصة فقط (owner_only في shared-files.json، لا تدخل حزم العملاء).
   كل نوع تواصل له صياغة مستقلة بالإنجليزية والفرنسية والعربية (مكتوبة أصلاً بكل لغة لا مترجمة حرفياً)، قصيرة وبنبرة شخصية لا إعلانية، وفيها دائماً مخرج مهذّب.
   المتغيرات: {name} {first} {company} {phone} {country} {in_country} (دولة الجهة بالتعبير المناسب لكل لغة: in Algeria / en Algérie / في الجزائر)
   وهوية المرسل من إعدادات «هويتي»: {sender} {my_company} {offer}. إن غاب الاسم أو الشركة تُستعمل صياغة محايدة (your company / votre société / شركتكم). */
const AdminWaqsLib = (() => {
  const types = [
    ["first", "First Business Contact", "Premier contact professionnel", "أول تواصل تجاري"],
    ["intro", "Company Introduction", "Présentation de l'entreprise", "تعريف بالشركة"],
    ["partnership", "Business Partnership Proposal", "Proposition de partenariat", "اقتراح شراكة تجارية"],
    ["product", "Product / Service Introduction", "Présentation produit / service", "تقديم منتج أو خدمة"],
    ["offer", "Commercial Offer", "Offre commerciale", "عرض تجاري"],
    ["followup", "Follow-up After First Contact", "Relance après le premier contact", "متابعة بعد أول تواصل"],
    ["noresp", "Follow-up After No Response", "Relance sans réponse", "متابعة عند عدم الرد"],
    ["meeting", "Meeting Request", "Demande de rendez-vous", "طلب موعد أو اجتماع"],
    ["interested", "Reply to Interested Contact", "Réponse à un contact intéressé", "الرد على جهة مهتمة"],
    ["thanks", "Thank You", "Remerciements", "شكر"],
    ["closing", "Professional Closing", "Clôture professionnelle", "إنهاء مهني للمراسلة"]
  ].map(t => ({ k: t[0], en: t[1], fr: t[2], ar: t[3] }));
  const langs = [{ k: "en", label: "English", short: "EN" }, { k: "fr", label: "Français", short: "FR" }, { k: "ar", label: "العربية", short: "AR" }];
  const T = (id, type, lang, name, text) => ({ id, type, lang, name, text, built: true });
  const tpls = [
    /* ───── First Business Contact ───── */
    T("first-en-1", "first", "en", "Direct", "Hello {first},\n\nThis is {sender} from {my_company}. I'm reaching out personally because {company} seems like a good fit for what we do: {offer}.\n\nWould it be okay if I shared a few details here? If now isn't a good time, just let me know.\n\nKind regards,\n{sender}"),
    T("first-en-2", "first", "en", "Warm", "Hello {first},\n\nI hope you're doing well. I'm {sender} from {my_company}. I'd enjoy hearing more about what {company} is working on {in_country}, and how our work in {offer} might support it.\n\nWould you have a few minutes to chat here?\n\nThank you,\n{sender}"),
    T("first-fr-1", "first", "fr", "Direct", "Bonjour {first},\n\nJe suis {sender} de {my_company}. Je me permets de vous contacter directement car {company} pourrait être un bon interlocuteur pour ce que nous faisons : {offer}.\n\nSeriez-vous d'accord pour que je vous présente brièvement notre activité ici ? Si ce n'est pas le bon moment, dites-le-moi simplement.\n\nCordialement,\n{sender}"),
    T("first-fr-2", "first", "fr", "Chaleureux", "Bonjour {first},\n\nJ'espère que vous allez bien. Je suis {sender} de {my_company}. Ce serait un plaisir d'échanger avec vous sur ce que fait {company} {in_country} et sur la façon dont notre activité ({offer}) pourrait y contribuer.\n\nAuriez-vous quelques minutes pour en discuter ici ?\n\nMerci,\n{sender}"),
    T("first-ar-1", "first", "ar", "مباشر", "السلام عليكم {first}،\n\nأنا {sender} من {my_company}. أتواصل معكم مباشرة لأن {company} قد تكون جهة مناسبة لما نعمل عليه: {offer}.\n\nهل يناسبكم أن أعرّفكم بنشاطنا باختصار هنا؟ وإن لم يكن الوقت مناسباً فيكفي أن تخبروني.\n\nمع خالص التقدير،\n{sender}"),
    T("first-ar-2", "first", "ar", "ودّي", "السلام عليكم {first}،\n\nأتمنى أن تكونوا بخير. أنا {sender} من {my_company}. يسعدني أن أتعرّف أكثر على نشاط {company} {in_country}، وكيف يمكن أن يخدمه عملنا في {offer}.\n\nهل يتسع وقتكم لحديث قصير هنا؟\n\nشكراً لكم،\n{sender}"),
    /* ───── Company Introduction ───── */
    T("intro-en-1", "intro", "en", "Standard", "Hello {first},\n\nHere is a short introduction to {my_company}. We specialize in {offer}, with an emphasis on consistent quality and clear, reliable communication.\n\nI'd be glad to share a fuller presentation or answer any questions about how this might fit with {company}.\n\nBest regards,\n{sender}"),
    T("intro-fr-1", "intro", "fr", "Standard", "Bonjour {first},\n\nVoici une brève présentation de {my_company}. Nous sommes spécialisés dans {offer}, avec une priorité : une qualité constante et une communication claire et fiable.\n\nJe peux vous envoyer une présentation plus détaillée ou répondre à vos questions pour voir ce que cela pourrait apporter à {company}.\n\nCordialement,\n{sender}"),
    T("intro-ar-1", "intro", "ar", "قياسي", "السلام عليكم {first}،\n\nأُقدّم لكم نبذة مختصرة عن {my_company}: نحن متخصصون في {offer}، ونحرص على جودة ثابتة وتواصل واضح ومنتظم مع شركائنا.\n\nيسعدني أن أرسل عرضاً أكثر تفصيلاً أو أجيب عن أي سؤال حول ما يمكن أن نقدّمه إلى {company}.\n\nمع التحية،\n{sender}"),
    /* ───── Business Partnership Proposal ───── */
    T("partnership-en-1", "partnership", "en", "Standard", "Hello {first},\n\nI'd like to propose a simple partnership between {my_company} and {company}. We work in {offer}, and I believe there may be a good basis for working together {in_country} — for example through distribution, resale or a joint project.\n\nIf you're open to it, we could start with a short call or an exchange here to see whether it makes sense for both sides.\n\nBest regards,\n{sender}"),
    T("partnership-fr-1", "partnership", "fr", "Standard", "Bonjour {first},\n\nJe souhaiterais vous proposer un partenariat simple entre {my_company} et {company}. Nous travaillons dans le domaine suivant : {offer}, et je pense qu'une collaboration pourrait avoir du sens {in_country} — par exemple en distribution, en revente ou sur un projet commun.\n\nSi cela vous intéresse, nous pourrions commencer par un court appel ou un échange ici pour voir si c'est pertinent pour les deux parties.\n\nCordialement,\n{sender}"),
    T("partnership-ar-1", "partnership", "ar", "قياسي", "السلام عليكم {first}،\n\nأودّ أن أقترح شراكة بسيطة بين {my_company} و{company}. نعمل في {offer}، وأرى أن هناك أرضية جيدة للتعاون {in_country}، مثل التوزيع أو إعادة البيع أو مشروع مشترك.\n\nإن كان الأمر يهمّكم فيمكننا البدء بمكالمة قصيرة أو حديث هنا لنرى إن كان مناسباً للطرفين.\n\nمع خالص التقدير،\n{sender}"),
    /* ───── Product / Service Introduction ───── */
    T("product-en-1", "product", "en", "Standard", "Hello {first},\n\nI wanted to share what we offer at {my_company}: {offer}.\n\nOur focus is quality, clear specifications and dependable delivery. If any of this is relevant to {company}, I can send details or a catalogue — whichever is most useful.\n\nBest regards,\n{sender}"),
    T("product-fr-1", "product", "fr", "Standard", "Bonjour {first},\n\nJe voulais vous présenter ce que propose {my_company} : {offer}.\n\nNous mettons l'accent sur la qualité, des informations produit claires et des livraisons fiables. Si cela peut intéresser {company}, je vous envoie volontiers des détails ou un catalogue.\n\nCordialement,\n{sender}"),
    T("product-ar-1", "product", "ar", "قياسي", "السلام عليكم {first}،\n\nأودّ أن أعرّفكم بما تقدّمه {my_company}: {offer}.\n\nنركّز على الجودة ووضوح المواصفات والالتزام بالتسليم. وإن كان ذلك يهمّ {company} فيسعدني إرسال التفاصيل أو الكتالوج.\n\nمع التحية،\n{sender}"),
    /* ───── Commercial Offer ───── */
    T("offer-en-1", "offer", "en", "Standard", "Hello {first},\n\nFollowing our discussion, I'm pleased to send you our commercial offer for {company}. The detailed terms (products, quantities, prices and delivery conditions) are in the document that follows this message.\n\nPlease tell me if you'd like anything adjusted to fit your needs — I'm happy to find an arrangement that works for you.\n\nBest regards,\n{sender}"),
    T("offer-fr-1", "offer", "fr", "Standard", "Bonjour {first},\n\nSuite à notre échange, je vous adresse notre offre commerciale pour {company}. Les conditions détaillées (produits, quantités, prix et modalités de livraison) figurent dans le document qui suit ce message.\n\nDites-moi si vous souhaitez ajuster certains points : je reste à votre écoute pour trouver une formule qui vous convienne.\n\nCordialement,\n{sender}"),
    T("offer-ar-1", "offer", "ar", "قياسي", "السلام عليكم {first}،\n\nبعد حديثنا، يسعدني أن أرسل لكم عرضنا التجاري المقدَّم إلى {company}. تجدون الشروط التفصيلية (المنتجات والكميات والأسعار وشروط التسليم) في المستند الذي يلي هذه الرسالة.\n\nوإن رغبتم في تعديل أي نقطة لتناسب احتياجكم فأنا على استعداد للتفاهم على صيغة مناسبة.\n\nمع خالص التقدير،\n{sender}"),
    /* ───── Follow-up After First Contact ───── */
    T("followup-en-1", "followup", "en", "Standard", "Hello {first},\n\nI'm following up on my earlier message about {my_company} and {company}. I wanted to check whether you had a chance to look at it, and whether there's anything I can clarify.\n\nHappy to continue here or by phone, whichever suits you.\n\nBest regards,\n{sender}"),
    T("followup-fr-1", "followup", "fr", "Standard", "Bonjour {first},\n\nJe reviens vers vous suite à mon précédent message concernant {my_company} et {company}. Avez-vous pu y jeter un œil, et y a-t-il un point que je peux préciser ?\n\nNous pouvons poursuivre ici ou par téléphone, comme vous préférez.\n\nCordialement,\n{sender}"),
    T("followup-ar-1", "followup", "ar", "قياسي", "السلام عليكم {first}،\n\nأتابع معكم بخصوص رسالتي السابقة حول {my_company} و{company}. هل أتيحت لكم فرصة الاطلاع عليها، وهل من نقطة يمكنني توضيحها؟\n\nيسعدني المتابعة هنا أو عبر مكالمة، حسبما يناسبكم.\n\nمع التحية،\n{sender}"),
    /* ───── Follow-up After No Response ───── */
    T("noresp-en-1", "noresp", "en", "Gentle reminder", "Hello {first},\n\nA gentle follow-up in case my previous messages got buried. If this is relevant for {company}, I'd be glad to share more; if not, no problem at all — just tell me and I won't write again.\n\nThank you,\n{sender}"),
    T("noresp-en-2", "noresp", "en", "Final note", "Hello {first},\n\nI haven't heard back, so I'll assume the timing isn't right. I'll leave my details here in case things change: {my_company} — {offer}.\n\nWishing you and {company} continued success.\n\nBest regards,\n{sender}"),
    T("noresp-fr-1", "noresp", "fr", "Petit rappel", "Bonjour {first},\n\nUn petit rappel au cas où mes précédents messages seraient passés inaperçus. Si le sujet peut concerner {company}, je vous en dirai volontiers plus ; sinon, aucun souci, dites-le-moi simplement et je ne vous écrirai plus à ce sujet.\n\nMerci,\n{sender}"),
    T("noresp-fr-2", "noresp", "fr", "Dernier message", "Bonjour {first},\n\nSans retour de votre part, je suppose que le moment n'est pas idéal. Je laisse mes coordonnées ici au cas où les choses changeraient : {my_company} — {offer}.\n\nJe vous souhaite, à vous et à {company}, une belle continuation.\n\nCordialement,\n{sender}"),
    T("noresp-ar-1", "noresp", "ar", "تذكير لطيف", "السلام عليكم {first}،\n\nمجرد تذكير لطيف في حال ضاعت رسائلي السابقة وسط الزحام. إن كان الأمر يهمّ {company} فيسعدني التوسّع فيه، وإن لم يكن كذلك فلا بأس إطلاقاً — يكفي أن تخبروني ولن أزعجكم مجدداً.\n\nشكراً لكم،\n{sender}"),
    T("noresp-ar-2", "noresp", "ar", "رسالة أخيرة", "السلام عليكم {first}،\n\nلم يصلني ردّ، فأفترض أن التوقيت غير مناسب الآن. أترك رسالتي هنا إن تغيّرت الظروف: {my_company} — {offer}.\n\nأتمنى لكم دوام التوفيق.\n\nمع التحية،\n{sender}"),
    /* ───── Meeting Request ───── */
    T("meeting-en-1", "meeting", "en", "Standard", "Hello {first},\n\nWould you be available for a short call or video meeting (about 15–20 minutes) in the coming days to discuss how {my_company} and {company} could work together?\n\nPlease suggest a day and time that suit you, and I'll adapt to your schedule.\n\nBest regards,\n{sender}"),
    T("meeting-fr-1", "meeting", "fr", "Standard", "Bonjour {first},\n\nSeriez-vous disponible pour un court appel ou une visioconférence (15 à 20 minutes environ) dans les prochains jours afin d'échanger sur une collaboration entre {my_company} et {company} ?\n\nIndiquez-moi le jour et l'heure qui vous conviennent, je m'adapterai à votre emploi du temps.\n\nCordialement,\n{sender}"),
    T("meeting-ar-1", "meeting", "ar", "قياسي", "السلام عليكم {first}،\n\nهل يتسنّى لكم لقاء قصير عبر مكالمة أو اجتماع مرئي (نحو 15 إلى 20 دقيقة) خلال الأيام القادمة لمناقشة إمكانية التعاون بين {my_company} و{company}؟\n\nاقترحوا اليوم والوقت المناسبين لكم وسأتكيّف مع جدولكم.\n\nمع خالص التقدير،\n{sender}"),
    /* ───── Reply to Interested Contact ───── */
    T("interested-en-1", "interested", "en", "Standard", "Hello {first},\n\nThank you for your interest — I appreciate it. To make the next step easy, could you tell me a little about what {company} is looking for (products, volumes, timing)? With that I can send you a precise proposal.\n\nIf you prefer, we can also arrange a quick call.\n\nBest regards,\n{sender}"),
    T("interested-fr-1", "interested", "fr", "Standard", "Bonjour {first},\n\nMerci pour votre intérêt, cela me fait plaisir. Pour avancer simplement, pourriez-vous m'indiquer ce que recherche {company} (produits, volumes, délais) ? Je pourrai alors vous envoyer une proposition précise.\n\nSi vous préférez, nous pouvons aussi fixer un court appel.\n\nCordialement,\n{sender}"),
    T("interested-ar-1", "interested", "ar", "قياسي", "السلام عليكم {first}،\n\nشكراً لاهتمامكم، وأقدّر ذلك. لتسهيل الخطوة التالية، هل يمكنكم إخباري بما تبحث عنه {company} (المنتجات والكميات والمواعيد)؟ بذلك أستطيع إرسال عرض دقيق.\n\nوإن فضّلتم يمكننا ترتيب مكالمة قصيرة.\n\nمع التحية،\n{sender}"),
    /* ───── Thank You ───── */
    T("thanks-en-1", "thanks", "en", "Standard", "Hello {first},\n\nThank you for your time and for the conversation — it was a pleasure. I appreciate your openness, and I'll follow up on what we discussed.\n\nPlease don't hesitate to reach out if you need anything in the meantime.\n\nBest regards,\n{sender}"),
    T("thanks-fr-1", "thanks", "fr", "Standard", "Bonjour {first},\n\nMerci pour le temps que vous m'avez accordé et pour notre échange, ce fut un plaisir. J'apprécie votre ouverture et je reviens vers vous au sujet de ce dont nous avons parlé.\n\nN'hésitez pas à me contacter si vous avez besoin de quoi que ce soit d'ici là.\n\nCordialement,\n{sender}"),
    T("thanks-ar-1", "thanks", "ar", "قياسي", "السلام عليكم {first}،\n\nأشكركم على وقتكم وعلى هذا الحديث الطيّب، وقد سعدت به كثيراً. أقدّر انفتاحكم، وسأتابع معكم ما اتفقنا عليه.\n\nولا تترددوا في مراسلتي إن احتجتم أي شيء في الأثناء.\n\nمع خالص التقدير،\n{sender}"),
    /* ───── Professional Closing ───── */
    T("closing-en-1", "closing", "en", "Standard", "Hello {first},\n\nThank you for the exchange so far. I understand this isn't the right fit for {company} at the moment, so I'll close the topic on my side. If anything changes, you're always welcome to get in touch.\n\nI wish you every success.\n\nBest regards,\n{sender}"),
    T("closing-fr-1", "closing", "fr", "Standard", "Bonjour {first},\n\nMerci pour nos échanges jusqu'ici. Je comprends que ce n'est pas le bon moment pour {company} ; je clos donc le sujet de mon côté. Si les choses évoluent, vous pouvez me contacter quand vous le souhaitez.\n\nJe vous souhaite plein de succès.\n\nCordialement,\n{sender}"),
    T("closing-ar-1", "closing", "ar", "قياسي", "السلام عليكم {first}،\n\nأشكركم على تواصلكم حتى الآن. أتفهّم أن الأمر غير مناسب في الوقت الحالي، لذا سأُغلق الموضوع من جهتي. وإن تغيّرت الظروف فباب التواصل مفتوح دائماً.\n\nأتمنى لكم كل التوفيق.\n\nمع خالص التقدير،\n{sender}")
  ];
  /* الدول: الاسم بكل لغة + «في/بـ» المناسبة لكل لغة + لغة المراسلة المقترحة + مرادفات الإدخال */
  const C = (ar, fr, en, inFr, inEn, lang, alias) => ({ ar, fr, en, inFr, inEn, inAr: "في " + ar, lang, alias });
  const countries = [
    C("الجزائر", "Algérie", "Algeria", "en Algérie", "in Algeria", "fr", ["dz", "algeria", "algerie", "algérie"]),
    C("المغرب", "Maroc", "Morocco", "au Maroc", "in Morocco", "fr", ["ma", "morocco", "maroc"]),
    C("تونس", "Tunisie", "Tunisia", "en Tunisie", "in Tunisia", "fr", ["tn", "tunisia", "tunisie"]),
    C("ليبيا", "Libye", "Libya", "en Libye", "in Libya", "ar", ["ly", "libya", "libye"]),
    C("مصر", "Égypte", "Egypt", "en Égypte", "in Egypt", "ar", ["eg", "egypt", "egypte", "égypte"]),
    C("السعودية", "Arabie saoudite", "Saudi Arabia", "en Arabie saoudite", "in Saudi Arabia", "ar", ["sa", "saudi arabia", "ksa"]),
    C("الإمارات", "Émirats arabes unis", "United Arab Emirates", "aux Émirats arabes unis", "in the UAE", "ar", ["ae", "uae"]),
    C("قطر", "Qatar", "Qatar", "au Qatar", "in Qatar", "ar", ["qa", "qatar"]),
    C("الكويت", "Koweït", "Kuwait", "au Koweït", "in Kuwait", "ar", ["kw", "kuwait", "koweit", "koweït"]),
    C("فرنسا", "France", "France", "en France", "in France", "fr", ["fr", "france"]),
    C("بلجيكا", "Belgique", "Belgium", "en Belgique", "in Belgium", "fr", ["be", "belgium", "belgique"]),
    C("إسبانيا", "Espagne", "Spain", "en Espagne", "in Spain", "en", ["es", "spain", "espagne"]),
    C("إيطاليا", "Italie", "Italy", "en Italie", "in Italy", "en", ["it", "italy", "italie"]),
    C("ألمانيا", "Allemagne", "Germany", "en Allemagne", "in Germany", "en", ["de", "germany", "allemagne"]),
    C("بريطانيا", "Royaume-Uni", "United Kingdom", "au Royaume-Uni", "in the United Kingdom", "en", ["uk", "gb", "united kingdom", "royaume-uni"]),
    C("كندا", "Canada", "Canada", "au Canada", "in Canada", "en", ["ca", "canada"]),
    C("أمريكا", "États-Unis", "United States", "aux États-Unis", "in the United States", "en", ["us", "usa", "united states", "etats-unis", "états-unis"]),
    C("تركيا", "Turquie", "Turkey", "en Turquie", "in Turkey", "en", ["tr", "turkey", "turquie"])
  ];
  const norm = s => String(s == null ? "" : s).trim().toLowerCase();
  const country = name => { const k = norm(name); if (!k) return null; return countries.find(c => norm(c.ar) === k || norm(c.fr) === k || norm(c.en) === k || c.alias.includes(k)) || null; };
  /* التعبير الاحتياطي عند غياب الاسم/الشركة/الدولة: صياغة محايدة تقرأ طبيعياً في الجملة */
  const fallback = { en: { company: "your company", in_country: "in your region", country: "your region" }, fr: { company: "votre société", in_country: "dans votre région", country: "votre région" }, ar: { company: "شركتكم", in_country: "في منطقتكم", country: "منطقتكم" } };
  return { types, langs, tpls, countries, country, fallback };
})();
