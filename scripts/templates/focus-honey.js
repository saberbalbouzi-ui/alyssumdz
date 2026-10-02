/* يبني صفحة هبوط «عسل التركيز» بعناصر المنشئ (نصوص قابلة للتعديل + صور المنتج الحقيقية) — يُشغَّل داخل admin.html:
   node scripts/templates/run-template.js  ← ينتج assets/pages/templates/focus-honey.json */
(function () {
  const W = PB.mkW, C = PB.mkC, S = PB.mkS, D = (d, m) => (m === undefined ? { d } : { d, m });
  const IMG = "assets/img/tarkiz/";
  const h = (text, set) => W("heading", Object.assign({ text, tag: "div", fs: D(36, 26), fw: "900", ta: D("start"), lh: D(1.35) }, set));
  const p = (html, set) => W("text", Object.assign({ html: "<p>" + html + "</p>", fs: D(19, 16), lh: D(1.9), fw: "600", ta: D("start") }, set));
  const im = (src, alt, set) => W("image", Object.assign({ src: IMG + src, alt, fit: "cover", rad: D(18) }, set));
  const col = (ws, w, set) => C(ws, Object.assign({ w: D(w), va: "center" }, set));
  const sec = (cols, set) => S(cols, Object.assign({ pad: D([46, 20, 46, 20], [30, 16, 30, 16]), va: D("center"), gap: D(28) }, set));
  const secs = [];

  /* 1) الواجهة */
  secs.push(sec([
    col([W("heading", { text: "جديد", tag: "div", fs: D(20), fw: "900", color: "#1a1a1a", bg: "#ffd23f", rad: D(10), pad: D([4, 16, 4, 16]), ta: D("start"), w: D(14, 30) }),
      h("عسل التركيز وتنشيط الذاكرة للأطفال", { tag: "h1", color: "#ffffff", fs: D(52, 34), ta: D("start") }),
      h("الحل السحري من الطبيعة!", { color: "#ffffff", fs: D(30, 24) }),
      p("استعد تركيز ابنك، وضاعف طاقته، وحسّن أداءه الذهني بشكل مدهش.", { color: "#ffffff", fs: D(21, 17) })], 55),
    col([im("presentation/03.webp", "عسل التركيز وتنشيط الذاكرة للأطفال", { fit: "contain", rad: D(24), shadow: "lg" })], 45)
  ], { grad1: "#0b7bd1", grad2: "#ff8a1f", gradAng: 150, pad: D([56, 20, 56, 20], [34, 16, 34, 16]) }));

  /* 2) المشكلة */
  secs.push(sec([
    col([h("مشكلة الحفظ", { color: "#c62828", fs: D(42, 30) }), h("والمذاكرة تؤرق عائلتك؟", { color: "#1a1a1a", fs: D(36, 26) }), p("يشعر الطفل بتشتّت الانتباه، وضعف التركيز، وصعوبة الاستيعاب في الدراسة.", { color: "#333333" })], 55),
    col([im("body/01.webp", "طفل متعب أثناء المذاكرة مع والدته")], 45)
  ], { bg: "#eceff3" }));

  /* 3) الحل */
  secs.push(sec([
    col([im("presentation/02.webp", "طفل سعيد يحمل عسل التركيز")], 42),
    col([h("الحل النهائي", { color: "#0b6fb8", fs: D(44, 32) }), h("والوحيد", { color: "#f08a00", fs: D(40, 30) }), h("لمستقبل مشرق لطفلك!", { color: "#1a1a1a", fs: D(36, 26) }), p("استعد تركيز ابنك وثقته بنفسه مع منتج طبيعي 100%.", { color: "#333333", fw: "800" })], 58)
  ], { grad1: "#dff0ff", grad2: "#ffffff", gradAng: 180 }));

  /* 4) قبل / بعد */
  secs.push(sec([
    col([h("ماذا سيحدث لطفلك؟ الفرق قبل وبعد!", { ta: D("center"), fs: D(38, 26), color: "#1a1a1a" })], 100)
  ], { pad: D([40, 20, 6, 20], [26, 16, 4, 16]) }));
  secs.push(sec([
    col([im("body/02.webp", "بعد: طفل سعيد ومتفوق"), p("✅ ذاكرة قوية، تركيز مضاعف، وأداء دراسي ممتاز.", { color: "#15803d", fw: "800", ta: D("start") })], 50),
    col([im("body/01.webp", "قبل: طفل متعب ومشتّت"), p("❌ صعوبة الحفظ، تشتت الانتباه، وتراجع دراسي.", { color: "#b91c1c", fw: "800", ta: D("start") })], 50)
  ], { pad: D([10, 20, 46, 20], [6, 16, 30, 16]) }));

  /* 5) المزيج */
  secs.push(sec([
    col([im("presentation/04.webp", "مكوّنات عسل التركيز الطبيعية")], 50),
    col([h("مزيج أليسوم", { color: "#ffb347", fs: D(44, 32) }), h("الطبيعي والآمن تماماً", { color: "#ffffff", fs: D(36, 26) }), p("عسل حر ممتاز مع خلاصات أعشاب مختارة بعناية لنتائج ملموسة.", { color: "#f3e7d3" })], 50)
  ], { grad1: "#2a1707", grad2: "#7a4a12", gradAng: 120 }));

  /* 6) المقارنة */
  secs.push(sec([col([h("لماذا عسل أليسوم هو الخيار الأفضل؟", { ta: D("center"), fs: D(38, 26), color: "#1a1a1a" })], 100)], { pad: D([40, 20, 6, 20], [26, 16, 4, 16]) }));
  secs.push(sec([
    col([h("✔ عسل أليسوم", { color: "#15803d", fs: D(26, 22), ta: D("center") }), W("iconlist", { items: "طبيعي 100%\nلذيذ\nآمن تماماً\nنتائج مثبتة", icon: "✔", ic_c: "#16a34a", fs: D(23, 19), fw: "800" })], 50, { bg: "#f0fbf3", bw: 2, bs: "solid", bc: "#86efac", rad: D(18), pad: D([22, 22, 22, 22]) }),
    col([h("✖ المنتجات الأخرى", { color: "#b91c1c", fs: D(26, 22), ta: D("center") }), W("iconlist", { items: "صناعي\nطعم سيء\nغير آمن\nنتائج بطيئة", icon: "✖", ic_c: "#dc2626", fs: D(23, 19), fw: "800" })], 50, { bg: "#fff4f4", bw: 2, bs: "solid", bc: "#fecaca", rad: D(18), pad: D([22, 22, 22, 22]) })
  ], { pad: D([10, 20, 46, 20], [6, 16, 30, 16]) }));

  /* 7) في المدرسة */
  secs.push(sec([
    col([h("دع ابنك", { color: "#1a1a1a", fs: D(38, 28) }), h("يلمع في المدرسة اليومية.", { color: "#e8780a", fs: D(40, 28) }), p("عسل التركيز يدعم ابنك في المدرسة ويساعده على النطق بثقة وتجاوز مشاكله الدراسية.", { color: "#333333" })], 55),
    col([im("presentation/01.webp", "طفلة تدرس بتركيز")], 45)
  ], { grad1: "#fff7e6", grad2: "#ffffff", gradAng: 180 }));

  /* 8) ثقة العملاء (لقطات حقيقية من الزبائن) */
  secs.push(sec([col([
    W("heading", { text: "★★★★★", tag: "div", color: "#f5b301", fs: D(40, 32), ta: D("center") }),
    h("ثقة عملائنا", { ta: D("center"), fs: D(40, 30), color: "#1a1a1a" }),
    W("gallery", { imgs: IMG + "avis/avis02.webp\n" + IMG + "avis/avis03.webp\n" + IMG + "avis/SmartSelect_20250225_231134_Messenger.webp", cols: D(3, 2), gap: D(14), rad: D(14) })
  ], 100)], { bg: "#ffffff" }));

  /* 9) الطلب */
  secs.push(sec([col([
    W("heading", { text: "2100 دج", tag: "div", color: "#ffd23f", fs: D(54, 40), fw: "900", ta: D("center") }),
    p("بدلاً من 3100 دج — الدفع عند الاستلام", { color: "#ffffff", ta: D("center"), fw: "700" }),
    p("⚠️ الكمية المتاحة محدودة جداً، اطلب الآن!", { color: "#ffffff", ta: D("center"), fs: D(22, 18), fw: "900" }),
    W("button", { text: "اطلب الآن — الدفع عند الاستلام", link: "#order", bgc: "#ffd23f", color: "#111111", hbg: "#ffc400", fs: D(24, 19), al: D("center") })
  ], 100)], { bg: "#0d0d0d" }));
  const order = sec([col([W("orderorig", { prod: "tarkiz", auto: true })], 100)], { bg: "#0d0d0d", cid: "order", pad: D([6, 20, 56, 20], [4, 16, 36, 16]) });
  secs.push(order);

  const page = PB.newPage("عسل التركيز وتنشيط الذاكرة للأطفال", "tarkiz-landing");
  page.sections = secs; page.header = false; page.footer = true; page.bg = "#ffffff";
  return page;
})()
