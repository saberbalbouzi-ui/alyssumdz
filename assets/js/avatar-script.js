/* نص الأفاتار الناطق — دالة نقية مشتركة بين الموقع (agent.js) ولوحة التحكم (توليد الملفات الصوتية).
   تستعمل نفس معلومات الوكيل: بيانات المنتج + تدريب الصفحة (رسالة الترحيب، «نص الأفاتار» إن كُتب).
   لا تخترع أي ادعاء: كل جملة مأخوذة من بيانات حقيقية. */
window.AvatarScript = (function () {
  const clean = s => String(s || "").replace(/<[^>]*>/g, " ").replace(/[\u{1F000}-\u{1FFFF}☀-➿⬀-⯿✔✅❌⚠★•]/gu, " ").replace(/\s+/g, " ").trim();
  const trimEnd = s => s.replace(/[.،\s]+$/, "");
  const cut = (s, n) => { s = clean(s); if (s.length <= n) return s; const k = s.slice(0, n), i = Math.max(k.lastIndexOf("."), k.lastIndexOf("،"), k.lastIndexOf(" ")); return k.slice(0, i > 40 ? i : n).trim(); };
  /* o: { product, scope, lang, siteName, h1, products } → { lines:[], cta:index } */
  function build(o) {
    const l = o.lang === "fr" ? "fr" : "ar", p = o.product || null, sc = o.scope || {}, site = String(o.siteName || "").split(" ")[0];
    const custom = clean(sc.avatarScript || "");
    if (custom) {                                       // نص مكتوب يدوياً في تدريب الصفحة
      const lines = custom.split(/(?<=[.!؟?])\s+/).map(x => x.trim()).filter(Boolean);
      return { lines, cta: lines.length - 1 };
    }
    const S = [];
    if (l === "fr") {
      S.push(`Bonjour et bienvenue chez ${site}.`);
      if (p) {
        S.push(`Vous êtes sur la page ${p.title}.`);
        if (p.desc) S.push(trimEnd(cut(p.desc, 200)) + ".");
        S.push(`Son prix est de ${p.price} dinars seulement.`);
        const m = (p.offers || []).find(x => x.qty > 1);
        if (m) S.push(`Avec l'offre de ${m.qty} pièces, vous payez ${m.price} dinars${m.free ? ", dont une pièce gratuite" : ""}.`);
        S.push("Vous payez à la livraison, seulement après avoir reçu et vérifié le produit.");
        S.push("Cliquez sur commander maintenant et remplissez le formulaire.");
      } else {
        if (o.h1) S.push(trimEnd(cut(o.h1, 120)) + ".");
        S.push("Choisissez le produit qui vous convient, ou posez-moi votre question.");
      }
      return { lines: S, cta: S.length - 1 };
    }
    const g = clean(sc.greeting || "");
    S.push(g ? trimEnd(cut(g, 160)) + "." : `مرحباً بك في ${site}.`);
    if (p) {
      if (!g) S.push(`أنت الآن في صفحة ${p.title}.`);
      if (p.desc) S.push(trimEnd(cut(p.desc, 220)) + ".");
      S.push(`سعره ${p.price} دينار جزائري فقط${p.old && p.old > p.price ? `، بدل ${p.old}` : ""}.`);
      const m = (p.offers || []).find(x => x.qty > 1);
      if (m) S.push(`وإن اخترت عرض ${m.qty === 2 ? "قطعتين" : m.qty + " قطع"} تدفع ${m.price} دينار${m.free ? "، ومنها قطعة مجانية" : ""}، فيصبح سعر القطعة أقل.`);
      S.push("والدفع عند الاستلام: لا تدفع شيئاً إلا بعد أن يصلك المنتج وتتأكد منه.");
      S.push("اضغط على اطلب الآن، واملأ الاستمارة، وسنتصل بك لتأكيد طلبك.");
    } else {
      if (o.h1 && !g) S.push(trimEnd(cut(o.h1, 140)) + ".");
      const top = (o.products || []).filter(x => x && x.title && x.price).slice(0, 3);
      if (top.length) S.push("من منتجاتنا: " + top.map(x => `${x.title} بسعر ${x.price} دينار`).join("، ") + ".");
      S.push("كل منتجاتنا بالدفع عند الاستلام. اختر ما يناسبك، أو اسألني عن أي تفصيل.");
    }
    return { lines: S, cta: S.length - 1 };
  }
  return { build, clean };
})();
