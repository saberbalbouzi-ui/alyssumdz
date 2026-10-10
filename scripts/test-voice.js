/* اختبار محرّك الأوامر الصوتية (parse/pickOption) بلا متصفح: node scripts/test-voice.js */
const fs = require("fs"), path = require("path");
const V = require("../assets/js/admin-voice.js");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const nav = [...html.matchAll(/<button class="nav-btn(?![^"]*nav-work)[^"]*"[^>]*onclick="(?:Admin\.tab|AdminNav\.app)\('([a-z]+)'[^"]*"[^>]*>.*?<b>(.*?)<\/b><small>(.*?)<\/small>/gs)].map(m => ({ id: m[1], label: m[2].replace(/<span.*?<\/span>/g, "").trim(), desc: m[3] }));
const kb = JSON.parse(fs.readFileSync(path.join(root, "assets/data/admin-help.json"), "utf8"));
const d0 = new Date(), iso = (n) => new Date(d0 - n * 86400000).toISOString();
const orders = [
  { id: "1", name: "أحمد بن علي", phone: "0550123456", wilaya: "الجزائر", total: 3000, status: "nouvelle", date: iso(0) },
  { id: "2", name: "سارة", phone: "0661000000", wilaya: "وهران", total: 4500, status: "livree", date: iso(0) },
  { id: "3", name: "كريم", phone: "0770000000", wilaya: "سطيف", total: 2000, status: "annulee", date: iso(0) },
  { id: "4", name: "ياسين", phone: "0555555555", wilaya: "البليدة", total: 6000, status: "confirmee", date: iso(3) },
  { id: "5", name: "نور", phone: "0550999999", wilaya: "عنابة", total: 1000, status: "nouvelle", date: iso(20) },
];
const products = [
  { slug: "prod-a", title: "حنة الشفاء", price: 1500, stock: 0 },
  { slug: "miel-sidr", title: "عسل السدر الطبيعي-250 غ", price: 4000, stock: 3 },
  { slug: "huile-barbe", title: "زيت اللحية أليسوم", price: 2500, stock: 40 },
  { slug: "anti-acne", title: "كريمة ضد حب الشباب", price: 3000 },
];
const lex = JSON.parse(fs.readFileSync(path.join(root, "assets/data/voice-lexicon.json"), "utf8"));
V.useLexicon(lex);
const data = { nav, kb, orders, products, lowAt: 5, ctx: { slug: "" } };
let fail = 0, n = 0;
const T = (text, exp, why) => {
  n++; const r = V.parse(text, data); let ok = true;
  for (const k of Object.keys(exp)) { const got = k === "tab" ? (r.act && r.act.tab) : k === "slug" ? (r.act && r.act.slug) : k === "status" ? (r.act && r.act.status) : k === "period" ? (r.act && r.act.period) : k === "mode" ? (r.act && r.act.mode) : k === "q" ? (r.act && r.act.q) : k === "opts" ? (r.options || []).map(o => o.label) : k === "say" ? r.say : r[k]; if (k === "say" ? !String(got || "").includes(exp[k]) : k === "opts" ? !exp[k].every(x => got.some(g => g.includes(x))) : got !== exp[k]) ok = false; }
  if (!ok) { fail++; console.log("✗", JSON.stringify(text), "→", JSON.stringify({ kind: r.kind, act: r.act, say: r.say, opts: (r.options || []).map(o => o.label) }), "متوقع", JSON.stringify(exp), why || ""); }
};
console.log("nav items:", nav.length, "kb:", kb.length);
// ── تنقّل: فصحى / دارجة / فرنسية
T("افتح الطلبات", { kind: "nav", tab: "orders" });
T("حل الطلبات", { kind: "nav", tab: "orders" });
T("وريني الكوموند", { kind: "nav", tab: "orders" });
T("ouvre les commandes", { kind: "nav", tab: "orders" });
T("افتح المخزون", { kind: "nav", tab: "inventory" });
T("حلّي ستوك", { kind: "nav", tab: "inventory" });
T("va au stock", { kind: "nav", tab: "inventory" });
T("افتح التقارير", { kind: "nav", tab: "reports" });
T("rapports", { kind: "nav", tab: "reports" });
T("وريني العملاء", { kind: "nav", tab: "customers" });
T("افتح الهيدر", { kind: "nav", tab: "chromeh" });
T("الفوتر", { kind: "nav", tab: "chromef" });
T("افتح أكواد الخصم", { kind: "nav", tab: "coupons" });
T("ouvre les coupons", { kind: "nav", tab: "coupons" });
T("افتح الطلبات المسجلة", { kind: "nav", tab: "shipped" });
T("افتح رسوم التوصيل", { kind: "nav", tab: "fees" });
T("افتح شركات التوصيل", { kind: "nav", tab: "delivery" });
T("افتح مطور الصفحات", { kind: "nav", tab: "builder" });
T("افتح إعدادات الموقع", { kind: "nav", tab: "store" });
T("افتح المنتجات", { kind: "nav", tab: "products" });
T("المرتجعات", { kind: "nav", tab: "returns" });
// ── طلبات بمرشّحات
T("الطلبات الجديدة", { kind: "orders", status: "nouvelle" });
T("وريني كوموند اليوم", { kind: "orders", period: "today" });
T("افتح الطلبات الملغاة", { kind: "orders", status: "annulee" });
T("commandes livrées", { kind: "orders", status: "livree" });
T("ابحث عن طلب أحمد", { kind: "orders", q: "احمد" });
T("دور على كوموند صفر خمسة خمسة صفر", { kind: "orders" });
T("cherche commande 0550123456", { kind: "orders", q: "0550123456" });
// ── أرقام
T("قداش من طلب اليوم", { kind: "answer", say: "3" });
T("كم طلب اليوم", { kind: "answer", say: "3" });
T("combien de commandes aujourd'hui", { kind: "answer", say: "3" });
T("شحال من كوموند جداد", { kind: "answer", say: "2" });
T("كم المبيعات اليوم", { kind: "answer", say: "7 500" });
T("شحال بعت هذا الأسبوع", { kind: "answer", say: "13 500" });
T("ventes du mois", { kind: "answer" });
T("شنو نفد من المنتجات", { kind: "answer", say: "حنة" });
T("quels produits en rupture", { kind: "answer", say: "حنة" });
T("المنتجات ذات المخزون المنخفض", { kind: "answer", say: "عسل" });
T("آخر طلب", { kind: "answer", say: "3 000" });
T("كم منتج عندي", { kind: "answer", say: "4" });
// ── منتجات
T("زيد منتج جديد", { kind: "newProduct" });
T("ضيف منتج", { kind: "newProduct" });
T("ajoute un produit", { kind: "newProduct" });
T("افتح منتج حنة", { kind: "editProduct", slug: "prod-a" });
T("عدّل منتج عسل السدر", { kind: "editProduct", slug: "miel-sidr" });
T("وريني حنة الشفاء", { kind: "editProduct", slug: "prod-a" });
T("modifier produit crème anti acné", { kind: "editProduct", slug: "anti-acne" });
// ── مظهر/تحديث
T("بدّل المظهر", { kind: "theme", mode: "toggle" });
T("غيّر الوضع الليلي", { kind: "theme", mode: "dark" });
T("المظهر الفاتح", { kind: "theme", mode: "white" });
T("mode sombre", { kind: "theme", mode: "dark" });
T("حدّث اللوحة", { kind: "update", confirm: true });
T("افتح الموقع", { kind: "site" });
// ── مساعدة وأسئلة
T("ماذا أقول", { kind: "help" });
T("كيفاش نزيد تصنيف", { kind: "ask" });
T("اسألني عن الكوبونات", { kind: "ask" });
T("comment ajouter un coupon", { kind: "ask" });
T("إلغاء", { kind: "stop" });
// ── كلمات مفتاحية وتوضيح
T("مطور", { kind: "choose", opts: ["مطوّر الصفحات", "المطوّر الذكي"] });
T("افتح مطور", { kind: "choose", opts: ["مطوّر الصفحات", "المطوّر الذكي"] });
T("الصور", { kind: "choose", opts: ["أدوات تعديل الصور", "مولّد الصور"] });
T("مظهر", { kind: "choose", opts: ["مظهر لوحة التحكم", "مظهر الموقع"] });
T("توصيل", { kind: "choose", opts: ["رسوم التوصيل", "شركات التوصيل"] });
T("الزبائن", { kind: "choose", opts: ["العملاء", "الزبائن الأوفياء"] });
T("المخزون", { kind: "nav", tab: "inventory" }, "اسم الأداة بالضبط");
T("مرتجع", { kind: "choose", opts: ["المرتجعات"] }, "جزء كلمة يخص أداة واحدة ← تقصد؟");
T("ياليدين", { kind: "nav", tab: "delivery" });
T("اسم غير موجود نهائيا", { kind: "unknown" });
// اختيار الخيار
const opts = V.parse("مطور", data).options;
const P = (s, exp) => { n++; const g = V.pickOption(opts, s); if (g !== exp) { fail++; console.log("✗ pick", s, "→", g, "متوقع", exp); } };
P("الأول", 0); P("الثاني", 1); P("2", 1); P("نعم", 0); P("مطور الصفحات", 0); P("المطور الذكي", 1); P("deuxième", 1); P("لا", -1); P("إلغاء", -1); P("blabla", null);
// عناصر اللوحة (فهرس تجريبي): اضغط/اكتب/وين
const mkUI = (label, tab, kind, risk) => ({ label, tab, kind, risk, el: {}, t: V.norm(label).split(" ") });
const uiItems = [mkUI("حفظ", "store", "button", "ok"), mkUI("حفظ", "seo", "button", "ok"), mkUI("حذف الطلبات المحددة", "orders", "button", "danger"), mkUI("نشر الصفحة", "builder", "button", "confirm"), mkUI("سعر البيع منتج تجريبي", "finance", "input", "ok"), mkUI("تصدير CSV", "orders", "button", "ok")];
const uiData = Object.assign({}, data, { ui: { find: (q, n) => { const AL = { export: "تصدير", save: "حفظ" }; const qs =  V.norm(q).split(" ").filter(w => w.length > 1 && !/^(زر|خانه|حقل|ال|bouton|le|la)$/.test(w)).map(w => AL[w] || w.replace(/^ال/, "")); return uiItems.filter(it => qs.every(w => it.t.some(x => x.replace(/^ال/, "").startsWith(w) || w.startsWith(x.replace(/^ال/, ""))))).slice(0, n || 5); } } });
const U = (text, fn, why) => { n++; const r = V.parse(text, uiData); if (!fn(r)) { fail++; console.log("✗ ui", JSON.stringify(text), "→", JSON.stringify({ kind: r.kind, act: r.act && { mode: r.act.mode, label: r.act.label, value: r.act.value }, say: r.say, opts: (r.options || []).map(o => o.label) }), why || ""); } };
U("اضغط تصدير", r => r.kind === "ui" && r.act.mode === "click" && r.act.label === "تصدير CSV");
U("اضغط على زر حذف الطلبات", r => r.kind === "ui" && r.act.mode === "point" && /لا أضغطه/.test(r.say), "الحذف يُشار إليه فقط");
U("اضغط نشر الصفحة", r => r.kind === "ui" && r.act.mode === "click" && r.confirm === true, "النشر يطلب تأكيداً");
U("اكتب 3000 في سعر البيع", r => r.kind === "ui" && r.act.mode === "type" && r.act.value === "3000");
U("وين زر تصدير", r => r.kind === "ui" && r.act.mode === "point");
U("اريني حفظ", r => r.kind === "ui" && r.act.mode === "point" && /وله نظير/.test(r.say), "«وين/أريني»: يشير لأفضل نتيجة ويذكر النظير");
U("اضغط حفظ", r => r.kind === "choose" && r.options.length === 2, "النقر على عنصرين متشابهين ← يسأل أيهما");
U("ou est le bouton export", r => r.kind === "ui" && r.act.mode === "point" && /CSV/.test(r.act.label), "فرنسي ← عنصر عربي عبر المرادفات");
U("اضغط عنصر غير موجود ابدا", r => r.kind !== "ui");
// أمثلة القاموس (expect: kind + حقول اختيارية)
lex.examples.forEach(ex => {
  n++; const r = V.parse(ex.u, data), e = ex.expect; let ok = r.kind === e.kind;
  if (ok && e.to != null) ok = r.act && r.act.to === e.to;
  if (ok && e.slug) ok = r.act && r.act.slug === e.slug;
  if (ok && e.tab) ok = r.act && r.act.tab === e.tab;
  if (ok && e.status) ok = r.act && r.act.status === e.status;
  if (!ok) { fail++; console.log("✗ مثال", JSON.stringify(ex.u), "→", JSON.stringify({ kind: r.kind, act: r.act, say: r.say }), "متوقع", JSON.stringify(e)); }
});
// أرقام منطوقة
const N = (s, v) => { n++; const g = (V.numberIn(V.norm(s)) || {}).value; if (g !== v) { fail++; console.log("✗ رقم", s, "→", g, "متوقع", v); } };
N("زيد 20", 20); N("ألفين وخمسمية", 2500); N("تلاتة آلاف", 3000); N("مية وخمسين", 150); N("خمسمية دينار", 500); N("ميتين", 200); N("2 500", 2500); N("mille cinq cents", 1500); N("quatre vingt dix", 90); N("deux cent cinquante", 250); N("ألف", 1000); N("ثلاثين", 30); N("عشرة", 10);
// إكمال معلومة ناقصة
const part = V.parse("زيد المخزون", data);
n++; if (part.kind !== "need" || part.slot !== "product") { fail++; console.log("✗ يجب أن يسأل عن المنتج", JSON.stringify(part)); }
else { const f = V.fillSlot(part, "حنة الشفاء", data); n++; if (f.kind !== "need" || f.slot !== "value") { fail++; console.log("✗ ثم يسأل عن الكمية", JSON.stringify(f)); } else { const g = V.fillSlot(f, "خمسة عشر", data); n++; if (g.kind !== "stockChange" || g.act.to !== 15) { fail++; console.log("✗ إكمال الكمية", JSON.stringify(g)); } } }
// «هذا» ← المنتج المفتوح
const dctx = Object.assign({}, data, { ctx: { slug: "miel-sidr" } });
const th = V.parse("نقص السعر ديال هذا المنتوج 200 دينار", dctx); n++; if (th.kind !== "priceChange" || th.act.to !== 3800) { fail++; console.log("✗ هذا", JSON.stringify(th)); }
const th2 = V.parse("زيد 10 حبات لهذا المنتوج", dctx); n++; if (th2.kind !== "stockChange" || th2.act.to !== 13) { fail++; console.log("✗ هذا مخزون", JSON.stringify(th2)); }
console.log(fail ? `✗ فشل ${fail} من ${n}` : `✓ نجح ${n} من ${n}`);
process.exit(fail ? 1 : 0);
