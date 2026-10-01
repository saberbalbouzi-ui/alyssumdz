/* أليسوم — دماغ الوكيل الذكي (مشترك بين الموقع ولوحة التحكم)
   يبحث في «قاعدة معرفة» الصفحة: الأسئلة/الأجوبة المدرَّبة + معلومات الصفحة نفسها + بيانات المنتج.
   خوارزمية الاستنتاج (بدون أي خدمة خارجية):
   1) تطبيع عربي/فرنسي (حذف التشكيل، توحيد الألف والياء والتاء المربوطة، حذف الأل التعريف والتصريفات الخفيفة)
   2) تقطيع إلى كلمات مفتاحية وحذف كلمات الوصل
   3) ترتيب BM25 مع أوزان للحقول (الكلمات المفتاحية ×4، السؤال ×3، العنوان ×2، النص ×1) ومطابقة تقريبية للأخطاء الإملائية
   4) إذا كان الجواب فقرة من الصفحة: يُستخرج من الفقرة أقرب جملة/جملتان للسؤال (استنتاج لا نسخ كامل)
   5) عتبة ثقة: تحت العتبة لا يجيب الدماغ ويترك الوكيل لردوده الافتراضية */
const AgentBrain = (() => {
  const STOP = new Set(("في من على الى عن هل ما ماذا كيف هو هي هذا هذه ذلك تلك ان انا انت لا نعم مع او و ثم قد كل لي لك لنا له لها بعد قبل عند اذا كان يكون كانت اريد اريدان ممكن لو يا " +
    "le la les de du des un une et ou est que qui quoi quel quelle quels comment pour avec sur dans ce cet cette ces je tu il elle nous vous ils au aux en y a ai as est sont etre avoir mon ma mes ton ta tes son sa ses est-ce").split(/\s+/));

  function norm(s) {
    return String(s == null ? "" : s).toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")      // تشكيل/لكنات لاتينية
      .replace(/[ً-ٰٟـ]/g, "")                       // تشكيل عربي + تطويل
      .replace(/[إأآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
      .replace(/[^a-z0-9\u0621-\u064A\u066E-\u06D3\u0660-\u0669]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function stem(w) {
    if (/^[a-z0-9]+$/.test(w)) {                                   // فرنسي: حذف جمع/مؤنث بسيط
      if (w.length > 4) w = w.replace(/(s|x|e|es)$/, "");
      return w;
    }
    w = w.replace(/^(وال|بال|كال|فال|لل|ال)/, "");
    if (w.length > 4) w = w.replace(/^(و|ب|ل|ف)(?=.{3,})/, "");
    if (w.length > 4) w = w.replace(/(ات|ون|ين|ان|ها|هم|هن|نا|كم|ه|ي|ك)$/, "");
    return w;
  }
  /* مرادفات شائعة (بعد التطبيع والتجذير) → كلمة موحّدة، فيطابق «استخدم» عنوان «طريقة الاستعمال» */
  const SYN_GROUPS = [
    ["استعمال", "استعمل", "استخدم", "استخدام", "طريقه", "اطبق", "اضع", "تطبيق", "utilis", "utilisation", "appliqu", "mode", "emploi"],
    ["مكون", "تركيب", "محتو", "يحتو", "composition", "ingredient", "composant", "contient"],
    ["سعر", "ثمن", "تكلف", "تكلفه", "بكم", "prix", "tarif", "combien", "cout"],
    ["نتيج", "نتايج", "فعال", "فاعل", "فايد", "فواید", "فائد", "فوائد", "resultat", "efficace", "benefice"],
    ["توصيل", "شحن", "ليفريزون", "livraison", "expedition"],
    ["ضرر", "اضرار", "جانبي", "خطر", "danger", "effet", "secondaire"],
    ["حامل", "حمل", "رضاع", "enceinte", "grossesse", "allait"],
    ["اطفال", "طفل", "صغار", "enfant", "bebe"],
    ["مده", "مدد", "وقت", "متي", "duree", "delai", "quand"],
    ["اصلي", "original", "اصل", "authentique", "garanti", "ضمان"],
  ];
  const SYN = new Map();
  SYN_GROUPS.forEach(g => { const k = g[0]; g.forEach(w => SYN.set(w, k)); });
  function tokens(s) {
    return norm(s).split(" ").filter(w => w && !STOP.has(w) && (w.length > 1 || /\d/.test(w))).map(w => { const st = stem(w); return SYN.get(st) || SYN.get(w) || st; }).filter(w => w.length > 0);
  }
  function tri(w) { const a = "  " + w + " "; const r = new Set(); for (let i = 0; i < a.length - 2; i++) r.add(a.substr(i, 3)); return r; }
  function sim(a, b) {                                              // تشابه تقريبي للأخطاء الإملائية
    if (a === b) return 1;
    if (a.length < 4 || b.length < 4) return 0;
    if (a.startsWith(b) || b.startsWith(a)) return 0.8;
    const A = tri(a), B = tri(b); let c = 0; A.forEach(x => { if (B.has(x)) c++; });
    const j = c / (A.size + B.size - c);
    return j >= 0.6 ? j : 0;
  }

  /* ── بناء قاعدة المعرفة لنطاق (scope) ──
     scope = { qa:[{id,q,a_ar,a_fr,keywords,active}], useContent, keywords }
     chunks = مقاطع من صفحة الموقع [{h, t}] (عنوان + نص) ، facts = حقائق المنتج [{h,t}] */
  function buildDocs(scope, chunks, facts) {
    const docs = [];
    ((scope && scope.qa) || []).forEach(x => {
      if (!x || x.active === false) return;
      const ans = x.a_ar || x.answer_ar || x.a_fr || x.answer_fr || "";
      if (!ans) return;
      docs.push({ kind: "qa", id: x.id, answer: ans, answer_fr: x.a_fr || x.answer_fr || "",
        phrases: String(x.keywords || "").split(/[,،]/).map(norm).filter(Boolean),
        fields: [[tokens(x.keywords || ""), 4], [tokens(x.q || x.question || ""), 3], [tokens(ans), 1]],
        q: x.q || x.question || "" });
    });
    if (scope && scope.useContent) {
      (chunks || []).concat(facts || []).forEach((c, i) => {
        if (!c || !c.t) return;
        docs.push({ kind: "page", id: "c" + i, answer: c.t, phrases: [], heading: c.h || "",
          fields: [[tokens(c.h || ""), 2], [tokens(c.t), 1]] });
      });
    }
    return docs;
  }

  function rank(query, docs) {
    const qt = tokens(query);
    if (!qt.length || !docs.length) return { qt, ranked: [] };
    // IDF على مستوى كل المستندات
    const df = new Map();
    docs.forEach(d => { const seen = new Set(); d.fields.forEach(([ts]) => ts.forEach(t => seen.add(t))); seen.forEach(t => df.set(t, (df.get(t) || 0) + 1)); });
    const N = docs.length, idf = t => Math.log(1 + (N - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));
    const nq = norm(query);
    const corpus = new Set(); df.forEach((_, k) => corpus.add(k));
    const isKnown = t => corpus.has(t) || Array.from(corpus).some(k => sim(t, k));
    const known = qt.filter(isKnown);
    if (!known.length) return { qt, ranked: [] };
    const coverage = known.length / qt.length;
    const maxPossible = known.reduce((s, t) => s + idf(t) * 1.6, 0) || 1;
    const ranked = docs.map(d => {
      let score = 0;
      const tf = new Map();
      d.fields.forEach(([ts, w]) => ts.forEach(t => tf.set(t, (tf.get(t) || 0) + w)));
      const len = Array.from(tf.values()).reduce((a, b) => a + b, 0) || 1, avg = 40;
      qt.forEach(t => {
        let best = tf.get(t) || 0, factor = 1;
        if (!best) { tf.forEach((v, k) => { const s = sim(t, k); if (s && v * s > best) { best = v * s; factor = 1; } }); }
        if (best) score += idf(t) * ((best * 2.2) / (best + 1.2 * (0.25 + 0.75 * len / avg))) * factor;
      });
      let hit = d.phrases.some(p => p && nq.includes(p));             // كلمة/عبارة مفتاحية مطابقة حرفياً
      if (hit) score += maxPossible;                                  // دفعة قوية
      if (d.kind === "qa") score *= 1.15;                              // الأسئلة المدرَّبة بيدك أولى من نصوص الصفحة
      return { d, score, hit, coverage, conf: Math.min(1, (score / maxPossible) * (0.6 + 0.4 * coverage)) };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
    return { qt, ranked };
  }

  // أقرب جملة/جملتين للسؤال داخل فقرة طويلة
  function bestSentences(query, text, n) {
    const qt = new Set(tokens(query));
    const sents = String(text).split(/(?<=[.!؟?۔\n])\s+/).map(s => s.trim()).filter(s => s.length > 2);
    if (sents.length <= 2) return String(text).trim();
    const sc = sents.map((s, i) => { let c = 0; tokens(s).forEach(t => { if (qt.has(t)) c++; }); return { s, i, c }; });
    const top = sc.filter(x => x.c > 0).sort((a, b) => b.c - a.c || a.i - b.i).slice(0, n || 2).sort((a, b) => a.i - b.i);
    return (top.length ? top.map(x => x.s) : sents.slice(0, 2)).join(" ");
  }

  const THRESHOLD = 0.42;
  function answer(query, scope, chunks, facts, lang) {
    const docs = buildDocs(scope, chunks, facts);
    const { ranked } = rank(query, docs);
    if (!ranked.length) return null;
    const top = ranked[0];
    if (top.conf < THRESHOLD && !top.hit) return null;
    if (top.d.kind === "page" && top.coverage < 0.5 && !top.hit) return null;   // نصف السؤال غريب عن الصفحة (مثل اسم ولاية) → دع الردود الافتراضية تجيب
    let text;
    if (top.d.kind === "qa") text = (lang === "fr" && top.d.answer_fr) ? top.d.answer_fr : top.d.answer;
    else {
      const qset = new Set(tokens(query)), hh = tokens(top.d.heading || "");
      const headingHit = hh.some(t => qset.has(t));               // السؤال يطابق عنوان القسم → نعرض بداية القسم (خطوات/قائمة) لا جملة واحدة
      text = headingHit ? String(top.d.answer).split(/(?<=[.!؟?۔])\s+/).slice(0, 4).join(" ") : bestSentences(query, top.d.answer, 2);
    }
    return { text, conf: top.conf, kind: top.d.kind, source: top.d.kind === "qa" ? top.d.q : (top.d.heading || "معلومات الصفحة"),
      alternatives: ranked.slice(1, 3).map(r => ({ conf: r.conf, source: r.d.q || r.d.heading })) };
  }

  /* ── مقاطع معلومات الصفحة من DOM: عناوين + فقرات المحتوى فقط (بدون النموذج/الهيدر/الفوتر/الوكيل) ── */
  function chunksFromDoc(doc) {
    const out = [];
    const skip = "header,footer,form,nav,script,style,noscript,#agent-panel,#agent-fab,.drawer,.topbar,.cart-btn,.sticky-buy,.deal-bar,.trust-strip";
    const root = doc.body || doc;
    const clone = root.cloneNode(true);
    clone.querySelectorAll(skip).forEach(n => n.remove());
    const pick = clone.querySelectorAll("section"); // أقسام المحتوى فقط — الهيرو (السعر/الوصف) يغطيه factsFromProduct
    const clean = s => String(s || "").replace(/\s+/g, " ").trim();
    pick.forEach(sec => {
      const h = clean((sec.querySelector("h1,h2") || {}).textContent);
      const parts = [];
      sec.querySelectorAll(".lp-stepnum, .ic, .lp-head p").forEach(n => n.remove());   // أرقام الخطوات/الأيقونات/العناوين الفرعية الجاهزة لا تفيد الزبون
      sec.querySelectorAll("p, li, .lp-bullets div, .lp-card, .mini-points div").forEach(el => {
        let t;
        if (el.classList && el.classList.contains("lp-card")) {           // بطاقة: «العنوان: النص»
          const ch = clean((el.querySelector("h3") || {}).textContent), cp = clean((el.querySelector("p") || {}).textContent);
          t = ch && cp ? ch + ": " + cp : clean(el.textContent);
        } else t = clean(el.textContent);
        if (el.closest && el.tagName !== "ARTICLE" && !(el.classList && el.classList.contains("lp-card")) && el.closest(".lp-card")) return;
        if (t && t.length > 8 && !parts.includes(t)) parts.push(t);
      });
      if (!parts.length) return;
      out.push({ h, t: parts.map(x => x.replace(/[.۔]+$/, "")).join(". ").slice(0, 1800) + "." });
    });
    return out;
  }

  /* ── حقائق المنتج (سعر/عروض/وصف) كمقاطع معرفة ── */
  function factsFromProduct(p, fmt) {
    if (!p) return [];
    const f = fmt || (n => n + " دج");
    const out = [];
    if (p.desc) out.push({ h: "وصف " + p.title, t: p.desc });
    out.push({ h: "سعر ثمن " + p.title, t: "سعر «" + p.title + "» " + f(p.price) + (p.old ? " بدل " + f(p.old) : "") + "." });
    const multi = (p.offers || []).filter(o => o.qty > 1);
    if (multi.length) out.push({ h: "عروض تخفيض", t: multi.map(o => o.qty + " قطع بـ " + f(o.price) + (o.free ? " (منها قطعة مجانية)" : "")).join("، ") + "." });
    return out;
  }

  /* ── اقتراح أسئلة/أجوبة من محتوى الصفحة (يتعلّم الوكيل منها بعد موافقتك) ── */
  function suggestFromChunks(chunks, title) {
    const q = h => {
      const n = norm(h);
      if (/مكون|تركيب|composition|ingredient/.test(n)) return "ما هي مكونات " + (title || "المنتج") + "؟";
      if (/استعمال|استخدام|utilisation|usage/.test(n)) return "كيف أستعمل " + (title || "المنتج") + "؟";
      if (/نتيجه|نتايج|فايده|فوايد|فوائد|benefice|resultat/.test(n)) return "ما فوائد " + (title || "المنتج") + "؟";
      if (/ارا|راي|زبون|avis/.test(n)) return "ماذا يقول الزبائن عن " + (title || "المنتج") + "؟";
      return h ? h.replace(/[؟?]+$/, "") + "؟" : "";
    };
    return chunks.filter(c => c.h && c.t && c.t.length > 25).slice(0, 12).map(c => {
      const kw = Array.from(new Set(tokens(c.h))).slice(0, 4).join("، ");
      return { q: q(c.h), a_ar: c.t.slice(0, 500), keywords: kw };
    });
  }

  return { norm, tokens, answer, rank, buildDocs, chunksFromDoc, factsFromProduct, suggestFromChunks, THRESHOLD };
})();
if (typeof window !== "undefined") window.AgentBrain = AgentBrain;
