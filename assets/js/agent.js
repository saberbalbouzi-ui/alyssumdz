/* أليسوم — المساعد الذكي للبيع
   وكيل مبيعات قاعدي بالعربية + قابل للربط بنموذج لغوي عبر CONFIG.AGENT_ENDPOINT */
const Agent = (() => {
  const panel = () => document.getElementById("agent-panel");
  const body = () => document.getElementById("agent-body");
  let greeted = false;

  /* ── قاعدة معرفة المنتجات للإقناع ── */
  const KNOWLEDGE = {
    "anti-chute": { need: "تساقط الشعر", pitch: "زيت أليسوم ضد التساقط غني بالأعشاب المرقية، النتائج تظهر عادة خلال 3-4 أسابيع مع الاستعمال المنتظم." },
    "anti-gris": { need: "الشيب المبكر", pitch: "زيتنا المضاد للشيب يغذي بصيلات الشعر بالأعشاب الطبيعية بدون صبغات كيميائية." },
    "anti-acne": { need: "حب الشباب", pitch: "كريمة أليسوم ضد حب الشباب طبيعية 100% ومناسبة للبشرة الحساسة، تهدئ الالتهاب وتزيل البقع." },
    "miel-sidr": { need: "عسل فاخر", pitch: "عسل السدر الطبيعي الأصلي من أجود المناحل، مفحص وضمان الجودة." },
    "memory-drops": { need: "التركيز والذاكرة", pitch: "قطرات التركيز خلاصة طبيعية تساعد الطلاب والموظفين على التركيز." },
    "uroflow": { need: "المثانة والتبول اللاإرادي", pitch: "يوروفلو منتجنا الأكثر مبيعاً لراحة المثانة، والدفع عند الاستلام." },
    "flexi-relief": { need: "آلام المفاصل", pitch: "مرهم أليسوم الحراري بالأعشاب الطبيعية، يخفف آلام المفاصل والعضلات." },
    "hemorroides": { need: "البواسير", pitch: "مرهم طبيعي خاص، نتائج موثوقة والتوصيل سريع ودفع عند الاستلام." },
    "ithmed": { need: "كحل أثمد", pitch: "كحل الأثمد الأصفهاني الأصلي، تراثي وطبيعي 100%." },
    "pack13": { need: "الرقية الشرعية", pitch: "الباقة الشاملة 13 منتجاً — العرض الأكمل لأهل الرقية، وتوفير كبير." },
    "barbarie": { need: "التين الشوكي", pitch: "زيت بذور التين الشوكي من أغلى الزيوت الطبيعية، ممتاز للبشرة والشعر." },
  };

  const DEFAULT_PITCH = "منتجاتنا طبيعية 100% أصلية، والدفع عند الاستلام بدون أي دفع مسبق — تجربة بلا مخاطرة.";

  const INTENTS = [
    { re: /(سلام|مرحبا|صباح|مساء|اهلا|أهلا)/, ans: () => `وعليكم السلام وأهلاً بك في ${SITE_NAME} 👋 أنا مساعدك الشخصي. هل تبحث عن منتج معين؟ أو أخبرني بما تشكو منه (تساقط الشعر، البشرة، آلام...) وأرشح لك الأنسب.` },
    { re: /(تساقط|شعر|صلع)/, act: "anti-chute" },
    { re: /(شيب|شيب مبكر|شيبب)/, act: "anti-gris" },
    { re: /(حب|بثور|بشرة|حبوب|اكزيما|صدفية)/, act: "anti-acne" },
    { re: /(تجاعيد|بقع|تصبغات)/, act: "anti-rides-2" },
    { re: /(عسل|سدر|برتقال|جبلي|جرجير)/, act: "miel-sidr" },
    { re: /(ذاكرة|تركيز|نسيان|دراسة|طالب)/, act: "memory-drops" },
    { re: /(مثانة|تبول|لاإرادي|لارادي)/, act: "uroflow" },
    { re: /(مفاصل|عضلات|ركبة|ألم|الام)/, act: "flexi-relief" },
    { re: /(بواسير|شرج)/, act: "hemorroides" },
    { re: /(كحل|اثمد|أثمد|عين)/, act: "ithmed" },
    { re: /(رقية|مس|سحر|حسد|عين)/, act: "pack13" },
    { re: /(تين شوكي|برباري)/, act: "barbarie" },
    { re: /(سعر|بكم|ثمن|بشحال|شحال)/, ans: () => {
        const p = PRODUCTS.find(p => p.old) || PRODUCTS[0];
        return `أسعارنا تشمل عروضاً دائمة 🎁 مثلاً «${p.title}» بسعر ${fmt(p.price)}${p.old ? ` بدل ${fmt(p.old)}` : ""}، والدفع عند الاستلام. أي منتج يهمك؟`;
      } },
    { re: /(توصيل|ليفريزون|ليفريسون|توصيلة|الولايات|وصول)/, ans: () => `نوصل لـ 58 ولاية 🚚 التوصيل للمنزل أو للمكتب (Stop Desk)، والمدة عادة 24-72 ساعة. اختر ولايتك في نموذج الطلب ليظهر لك السعر الدقيق.` },
    { re: /(دفع|الدفع|كاش|ثقة|نصب|احتيال)/, ans: () => `الدفع عند الاستلام 💵 تدفع فقط عندما يصلك المنتج وتتأكد منه. لا نطلب أي دفع مسبق أبداً — هذا ضمان ثقتك.` },
    { re: /(ضمان|أصلي|طبيعي|كيماوي|فعالية|نتيجة|نتائج)/, ans: () => `منتجاتنا طبيعية 100% وأصلية ✅ إذا لم تكن راضياً، تواصل معنا مباشرة وسنحل المشكلة. رضا زبائننا هو سر نجاحنا منذ سنوات.` },
    { re: /(اطلب|شراء|كيف اطلب|طريقة الطلب|تشرت)/, ans: () => `الطلب سهل جداً 👇\n1️⃣ اختر العرض (قطعة / قطعتين / 3 قطع)\n2️⃣ املأ الاسم والهاتف والولاية\n3️⃣ اضغط «تأكيد الطلب» وسنتواصل معك للتأكيد.\nالدفع عند الاستلام!` },
    { re: /(واتساب|whatsapp|واتس)/, act: "__wa__" },
    { re: /(شكرا|شكراً|مشكور)/, ans: () => `العفو! ❤️ أنا هنا إذا احتجت أي مساعدة. تذكر: الدفع عند الاستلام والتوصيل سريع لكل الولايات.` },
  ];

  function findProduct(text) {
    for (const [slug, k] of Object.entries(KNOWLEDGE)) {
      if (text.includes(k.need.split(" ")[0]) || text.includes(slug)) {
        return PRODUCTS.find(p => p.slug === slug);
      }
    }
    return null;
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

  function productCard(p) {
    return `<span class="mini">🌿 <b>${p.title}</b><br>${fmt(p.price)}${p.old ? ` <s>${fmt(p.old)}</s>` : ""} · <a href="${REL}p/${p.slug}/" style="color:var(--gold);font-weight:900">اطلبه الآن ←</a></span>`;
  }

  async function reply(text) {
    const t = text.trim();
    if (!t) return;
    const u = document.createElement("div");
    u.className = "msg user"; u.textContent = t;
    body().appendChild(u); body().scrollTop = body().scrollHeight;

    // محاولة ربط نموذج لغوي خارجي أولاً (اختياري)
    if (CONFIG.AGENT_ENDPOINT) {
      typing(async () => {
        try {
          const r = await fetch(CONFIG.AGENT_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: t, products: PRODUCTS.slice(0, 30) }) });
          const j = await r.json();
          botSay(j.reply || fallback(t));
        } catch (e) { botSay(fallback(t)); }
      }, 900);
    } else {
      typing(() => botSay(fallback(t)), 700);
    }
  }

  function fallback(t) {
    for (const it of INTENTS) {
      if (it.re.test(t)) {
        if (it.act === "__wa__") {
          return `بالتأكيد! تواصل معنا مباشرة على واتساب 👇<br><a href="https://wa.me/${WA_NUMBER}" target="_blank" style="color:var(--ok);font-weight:900">📱 واتساب ${WA_NUMBER.replace("213","0")}</a>`;
        }
        if (it.act) {
          const p = PRODUCTS.find(p => p.slug === it.act);
          if (p) {
            const k = KNOWLEDGE[it.act] || {};
            return `${k.pitch || DEFAULT_PITCH}${productCard(p)}<br>هل أحجز لك طلباً؟ اضغط «اطلبه الآن» والدفع عند الاستلام 😊`;
          }
        }
        if (it.ans) return it.ans();
      }
    }
    const p = findProduct(t);
    if (p) return `${KNOWLEDGE[p.slug]?.pitch || DEFAULT_PITCH}${productCard(p)}`;
    const feat = PRODUCTS.filter(p => p.old).slice(0, 2);
    return `سؤال جميل! 🤔 منتجاتنا الأكثر مبيعاً الآن:<br>` + feat.map(productCard).join("<br>") +
      `<br>أو صف لي ما تحتاجه (شعر، بشرة، صحة...) وأرشح لك الأفضل.`;
  }

  function open() {
    panel().classList.add("open");
    document.getElementById("agent-fab").style.display = "none";
    if (!greeted) {
      greeted = true;
      typing(() => botSay(`أهلاً وسهلاً بك في <b>${SITE_NAME}</b> 🌿<br>أنا مساعدك الشخصي قبل الطلب. اسألني عن أي منتج، الأسعار، التوصيل أو الدفع — أو أخبرني بما تبحث عنه وسأرشح لك الأنسب.`), 600);
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
        <div><b>مساعد أليسوم الذكي</b><small>متصل الآن · يرد فوراً</small></div>
        <button class="x" id="agent-close">✕</button>
      </div>
      <div class="agent-body" id="agent-body"></div>
      <div class="agent-input">
        <input id="agent-input" placeholder="اكتب سؤالك هنا...">
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
