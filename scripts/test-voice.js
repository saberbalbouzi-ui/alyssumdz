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
// ═══ محادثات متعددة الأدوار: الضمائر الغائبة والمتابعات تُربط بالسؤال السابق ═══
const todayI = new Date().toISOString(), yestI = new Date(Date.now() - 86400000).toISOString();
const cOrders = [
  { id: "1", name: "أحمد", phone: "0550111111", wilaya: "الجزائر", total: 3000, status: "nouvelle", date: todayI, items: "حنة الشفاء ×2 = 3000 DA" },
  { id: "2", name: "سارة", phone: "0661222222", wilaya: "وهران", total: 4500, status: "livree", date: todayI, items: "عسل السدر الطبيعي-250 غ ×1 = 4500 DA" },
  { id: "3", name: "كريم", phone: "0770333333", wilaya: "الجزائر", total: 2000, status: "annulee", date: todayI, items: "زيت اللحية أليسوم ×1 = 2000 DA" },
  { id: "4", name: "ياسين", phone: "0555444444", wilaya: "الجزائر", total: 6000, status: "confirmee", date: yestI, items: "حنة الشفاء ×4 = 6000 DA" },
  { id: "5", name: "نور", phone: "0550555555", wilaya: "وهران", total: 1000, status: "confirmee", date: yestI, items: "حنة الشفاء ×1 = 1500 DA" },
];
function chat(turns, label) {
  let mem = {}; const base = Object.assign({}, data, { orders: cOrders, ctx: { slug: "" } });
  turns.forEach(([text, check], i) => {
    n++; const r = V.parse(text, Object.assign({}, base, { mem })); let ok = false, why = "";
    try { ok = !!check(r); } catch (e) { why = e.message; }
    if (!ok) { fail++; console.log("✗ محادثة", label, "#" + (i + 1), JSON.stringify(text), "→", JSON.stringify({ kind: r.kind, say: r.say, act: r.act && { type: r.act.type, slug: r.act.slug, to: r.act.to }, opts: (r.options || []).map(o => o.label) }), why); }
    mem = V.memUpdate(mem, r);
  });
}
chat([["كم عدد الطلبات اليوم", r => r.kind === "answer" && /: 3\./.test(r.say)], ["وأمس؟", r => r.kind === "answer" && /أمس: 2\./.test(r.say)], ["والمؤكدة؟", r => r.kind === "answer" && /المؤكَّدة.*: 2\./.test(r.say)], ["قارنها باليوم", r => r.kind === "answer" && /مقابل/.test(r.say)], ["ماهي", r => r.kind === "choose" && r.options.length >= 4]], "طلبات");
chat([["كم المبيعات اليوم", r => r.kind === "answer" && /7 500/.test(r.say)], ["وأمس", r => r.kind === "answer" && /أمس: 7 000/.test(r.say)], ["والمبيعات الشهر", r => r.kind === "answer" && /آخر 30/.test(r.say)]], "مبيعات");
chat([["كم سعر حنة", r => r.kind === "answer" && /1 500/.test(r.say) && r.mem.slug === "prod-a"], ["ومخزونها؟", r => r.kind === "answer" && /مخزون/.test(r.say)], ["نقص سعرها 10 بالمية", r => r.kind === "priceChange" && r.act.slug === "prod-a" && r.act.to === 1350], ["ثم أخفه", r => r.kind === "visibility" && r.act.slug === "prod-a" && r.act.on === false], ["وسعره الآن؟", r => r.kind === "answer" && /1 500/.test(r.say)]], "منتج");
chat([["آخر طلب", r => r.kind === "answer" && r.mem && r.mem.order && /أحمد/.test(r.say)], ["ما حالته؟", r => r.kind === "answer" && /في انتظار التأكيد/.test(r.say)], ["وهاتفه؟", r => r.kind === "answer" && /0550111111/.test(r.say)], ["وولايته", r => r.kind === "answer" && /الجزائر/.test(r.say)], ["ومبلغه؟", r => r.kind === "answer" && /3 000/.test(r.say)], ["ما هي منتجاته", r => r.kind === "answer" && /حنة/.test(r.say)], ["من هو زبونه", r => r.kind === "answer" && /أحمد/.test(r.say)]], "طلب");
chat([["شحال سعر عسل السدر", r => r.kind === "answer" && /4 000/.test(r.say)], ["شحال بقى منو", r => r.kind === "answer" && /مخزون/.test(r.say) && /3/.test(r.say)], ["السعر ديالو", r => r.kind === "answer" && /4 000/.test(r.say)]], "دارجة");
chat([["كم سعر حنة", r => r.kind === "answer"], ["son prix ?", r => r.kind === "answer" && /1 500|1500/.test(r.say)]], "فرنسي");
chat([["ما أكثر منتج مبيعاً", r => r.kind === "answer" && /حنة الشفاء \(7\)/.test(r.say)], ["ما أكثر ولاية طلباً", r => r.kind === "answer" && /الجزائر \(3\)/.test(r.say)], ["ما متوسط قيمة الطلب", r => r.kind === "answer" && /متوسط/.test(r.say)], ["كم عدد الزبائن", r => r.kind === "answer" && /5/.test(r.say)], ["ما نسبة الإلغاء", r => r.kind === "answer" && /%/.test(r.say)], ["عدد الطلبات", r => r.kind === "answer" && /5/.test(r.say)]], "تحليل");
chat([["ماهي المبيعات", r => r.kind === "answer"], ["وأمس", r => r.kind === "answer" && /أمس/.test(r.say)]], "مبيعات2");
// ═══ أوامر الطلبات (بحراسة الحالات) ═══
chat([["آخر طلب", r => r.kind === "answer" && r.mem.order.id === "1"], ["أكده", r => r.kind === "orderAction" && r.confirm && r.act.op === "confirm" && r.act.id === "1"]], "تأكيد بالضمير");
chat([["ألغ طلب سارة", r => r.kind === "answer" && /سُلِّم/.test(r.say)]], "إلغاء مسلَّم");
chat([["أكد طلب ياسين", r => r.kind === "answer" && /مؤكَّد أصلاً/.test(r.say)]], "مؤكَّد أصلاً");
chat([["ارسل طلب ياسين لشركة التوصيل", r => r.kind === "orderAction" && r.act.op === "send" && r.act.id === "4" && /طرداً حقيقياً/.test(r.say)]], "إرسال");
chat([["آخر طلب", r => r.kind === "answer"], ["أرسله لشركة التوصيل", r => r.kind === "answer" && /أكّده أولاً/.test(r.say)]], "إرسال قبل التأكيد");
chat([["ألغ الطلب", r => r.kind === "need" && r.slot === "order"]], "إلغاء بلا هدف");
{ n++; const nd = V.parse("ألغ الطلب", Object.assign({}, data, { orders: cOrders })); const f1 = V.fillSlot(nd, "كريم", Object.assign({}, data, { orders: cOrders })); const f2 = V.fillSlot(nd, "احمد", Object.assign({}, data, { orders: cOrders })); if (!(f1.kind === "answer" && /ملغى أصلاً/.test(f1.say) && f2.kind === "orderAction" && f2.act.op === "cancel" && f2.act.id === "1")) { fail++; console.log("✗ إكمال هدف الطلب", JSON.stringify([f1.kind, f1.say, f2.kind])); } }
chat([["اكد طلب ياسين", r => r.kind === "answer"], ["علمه مسلم", r => r.kind === "orderAction" && r.act.op === "status" && r.act.status === "livree" && r.act.id === "4"]], "حالة بالضمير");
chat([["annule la commande 0550111111", r => r.kind === "orderAction" && r.act.op === "cancel" && r.act.id === "1"]], "فرنسي بالهاتف");
chat([["بدل حالة طلب نور الى مسلم", r => r.kind === "orderAction" && r.act.op === "status" && r.act.status === "livree" && r.act.id === "5"]], "تغيير حالة باسم");
chat([["الغ الطلب الاخير", r => r.kind === "orderAction" && r.act.op === "cancel"]], "الأخير");
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
// ── مطوّر الصفحات (data.pb) ──
const WID = [["heading", "عنوان"], ["text", "نص"], ["image", "صورة"], ["button", "زر"], ["shape", "شكل / خط"], ["slider", "سلايدر"], ["gallery", "معرض صور"], ["video", "فيديو"], ["marquee", "شريط متحرّك"], ["accordion", "أسئلة شائعة"], ["divider", "فاصل"], ["table", "جدول"], ["map", "خريطة"], ["counter", "عدّاد"], ["contact", "نموذج اتصال"], ["sbar", "الشريط العلوي (إعلان)"], ["pcard", "بطاقة منتج"], ["products", "منتجات المتجر"], ["addcart", "زر اطلب الآن"], ["countdown", "عدّ تنازلي"], ["gallery2", "معرض المنتج 1+4"]].map(a => ({ type: a[0], label: a[1] }));
const pbd = (sel) => Object.assign({}, data, { pb: { open: true, widgets: WID, selKind: sel || "" } });
const PBT = (text, exp, d) => {
  n++; const r = V.parse(text, d || pbd()); let ok = r.kind === exp.kind;
  if (ok && exp.op) ok = r.act && r.act.op === exp.op;
  for (const k of ["dev", "widget", "tool", "q", "panel", "title", "n"]) if (ok && exp[k] != null) ok = r.act && r.act[k] === exp[k];
  if (ok && exp.confirm != null) ok = !!r.confirm === exp.confirm;
  if (!ok) { fail++; console.log("✗ مطوّر", JSON.stringify(text), "→", JSON.stringify({ kind: r.kind, act: r.act, say: r.say, opts: (r.options || []).map(o => o.label) }), "متوقع", JSON.stringify(exp)); }
};
PBT("تراجع", { kind: "builder", op: "undo" }); PBT("تراجع 3 خطوات", { kind: "builder", op: "undo", n: 3 }); PBT("ارجع خطوة", { kind: "builder", op: "undo" }); PBT("annule la dernière action", { kind: "builder", op: "undo" }); PBT("undo", { kind: "builder", op: "undo" });
PBT("اعد الخطوة", { kind: "builder", op: "redo" }); PBT("refais", { kind: "builder", op: "redo" }); PBT("تقدم خطوة", { kind: "builder", op: "redo" });
PBT("معاينة", { kind: "builder", op: "preview" }); PBT("عاين الصفحة", { kind: "builder", op: "preview" }); PBT("aperçu de la page", { kind: "builder", op: "preview" });
PBT("احفظ وانشر الصفحة", { kind: "builder", op: "publish", confirm: true }); PBT("publie la page", { kind: "builder", op: "publish", confirm: true }); PBT("احفظ", { kind: "builder", op: "publish", confirm: true });
PBT("اغلق المحرر", { kind: "builder", op: "close", confirm: true });
PBT("شوفها على الهاتف", { kind: "builder", op: "dev", dev: "m" }); PBT("وضع التابلت", { kind: "builder", op: "dev", dev: "t" }); PBT("عرض المكتب", { kind: "builder", op: "dev", dev: "d" }); PBT("vue mobile", { kind: "builder", op: "dev", dev: "m" }); PBT("نسخة الجوال", { kind: "builder", op: "dev", dev: "m" });
PBT("اضف قسم جديد", { kind: "builder", op: "addSection" }); PBT("ajoute une section", { kind: "builder", op: "addSection" });
PBT("اضف عنوان", { kind: "builder", op: "widget", widget: "heading" }); PBT("ضيف زر", { kind: "builder", op: "widget", widget: "button" }); PBT("حط صورة", { kind: "builder", op: "widget", widget: "image" }); PBT("ajoute un bouton", { kind: "builder", op: "widget", widget: "button" }); PBT("ajoute un texte", { kind: "builder", op: "widget", widget: "text" });
PBT("اضف ثلاثة ازرار", { kind: "builder", op: "widget", widget: "button", n: 3 }); PBT("اضف فيديو", { kind: "builder", op: "widget", widget: "video" }); PBT("اضف جدول", { kind: "builder", op: "widget", widget: "table" }); PBT("اضف سلايدر", { kind: "builder", op: "widget", widget: "slider" }); PBT("اضف شريط متحرك", { kind: "builder", op: "widget", widget: "marquee" });
PBT("اضف زر اطلب الان", { kind: "builder", op: "widget", widget: "addcart" }); PBT("اضف بطاقة منتج", { kind: "builder", op: "widget", widget: "pcard" }); PBT("اضف عد تنازلي", { kind: "builder", op: "widget", widget: "countdown" });
PBT("اضف معرض", { kind: "builder", op: "widget", widget: "gallery" }); PBT("اضف أسئلة شائعة", { kind: "builder", op: "widget", widget: "accordion" });
PBT("افتح الطبقات", { kind: "builder", op: "panel", panel: "lay" }); PBT("اخف الادوات", { kind: "builder", op: "panel", panel: "l" }); PBT("اظهر الاعدادات", { kind: "builder", op: "panel", panel: "r" }); PBT("اعدادات الصفحة", { kind: "builder", op: "panel", panel: "pg" }); PBT("افتح الاقسام الجاهزة", { kind: "builder", op: "panel", panel: "def" });
PBT("كرر القسم", { kind: "builder", op: "tool", tool: "dupsec" }); PBT("كرر العنصر", { kind: "builder", op: "tool", tool: "dupel" }); PBT("انسخ هذا", { kind: "builder", op: "tool", tool: "dupel" }, pbd("widget")); PBT("كرر", { kind: "builder", op: "tool", tool: "dupsec" }, pbd("section"));
PBT("اخف القسم", { kind: "builder", op: "tool", tool: "hidesec" }); PBT("اقفل القسم", { kind: "builder", op: "tool", tool: "locksec" }); PBT("اقفل العنصر", { kind: "builder", op: "tool", tool: "lockel" });
PBT("انقل القسم للاعلى", { kind: "builder", op: "tool", tool: "secup" }); PBT("نزل القسم للاسفل", { kind: "builder", op: "tool", tool: "secdown" }); PBT("ارفع القسم", { kind: "builder", op: "tool", tool: "secup" });
PBT("احذف القسم", { kind: "builder", op: "point", tool: "delsec" }); PBT("احذف العنصر", { kind: "builder", op: "point", tool: "delel" }); PBT("supprime cet élément", { kind: "builder", op: "point", tool: "delel" });
PBT("كبر الخط", { kind: "builder", op: "fmt", q: "fs+" }); PBT("كبر الخط ثلاث مرات", { kind: "builder", op: "fmt", q: "fs+", n: 3 }); PBT("صغر الخط", { kind: "builder", op: "fmt", q: "fs-" }); PBT("خليه عريض", { kind: "builder", op: "fmt", q: "bold" }); PBT("mets en italique", { kind: "builder", op: "fmt", q: "italic" }); PBT("اجعل النص مسطر", { kind: "builder", op: "fmt", q: "under" });
PBT("وسط العنصر", { kind: "builder", op: "fmt", q: "al-center" }); PBT("حاذي العنصر يمين", { kind: "builder", op: "fmt", q: "al-right" }); PBT("حاذي لليسار", { kind: "builder", op: "fmt", q: "al-left" });
PBT("انشئ صفحة جديدة باسم عروض الصيف", { kind: "builder", op: "newPage" });
PBT("اضف صفحة جديدة", { kind: "need" });
{ const pn = V.parse("اضف صفحة جديدة", data); n++; const f = pn.kind === "need" ? V.fillSlot(pn, "تخفيضات رمضان", data) : null; if (!f || f.kind !== "builder" || f.act.title !== "تخفيضات رمضان") { fail++; console.log("✗ اسم الصفحة", JSON.stringify(f)); } }
// خارج المحرّر لا تتأثر الأوامر العادية
PBT("كم طلب اليوم", { kind: "answer" }, data); PBT("اضف منتج جديد", { kind: "newProduct" }, data); PBT("اضف منتج جديد", { kind: "newProduct" }); PBT("مبيعات اليوم", { kind: "answer" });
PBT("توقف", { kind: "stop" }); PBT("احفظ المنتج", { kind: "unknown" }, data);
// ── نطق عربي أوضح ──
const TT = (name, got, exp) => { n++; if (got !== exp) { fail++; console.log("✗ نطق", name, JSON.stringify(got), "متوقع", JSON.stringify(exp)); } };
TT("2500", V.arNum(2500), "ألفان وخمسمئة"); TT("3000", V.arNum(3000), "ثلاثة آلاف"); TT("21", V.arNum(21), "واحد وعشرون"); TT("150", V.arNum(150), "مئة وخمسون"); TT("1e6", V.arNum(1000000), "مليون"); TT("11000", V.arNum(11000), "أحد عشر ألف"); TT("0", V.arNum(0), "صفر"); TT("1999", V.arNum(1999), "ألف وتسعمئة وتسعة وتسعون");
TT("سعر ودج", V.prepSpeech("السعر 2500 دج وخصم 10%"), "السعر ألفان وخمسمئة دينار وخصم عشرة بالمئة");
TT("مسافات الآلاف", V.prepSpeech("المبيعات 7 500 دج"), "المبيعات سبعة آلاف وخمسمئة دينار");
TT("هاتف", V.prepSpeech("اتصل بـ 0550123456"), "اتصل بـ صفر خمسة خمسة صفر واحد اثنان ثلاثة أربعة خمسة ستة");
TT("إيموجي وماركداون", V.prepSpeech("**تم** ✅ الحفظ 🎉"), "تم الحفظ");
TT("قاموس", V.prepSpeech("ALYSSUM جيد", { tts: { replace: { ALYSSUM: "أليسوم" } } }), "أليسوم جيد");
TT("لاتيني", JSON.stringify(V.splitScripts("مرحباً Mystore أنا أسمعك")), JSON.stringify([{ t: "مرحباً", lang: "ar" }, { t: "Mystore", lang: "lat" }, { t: "أنا أسمعك", lang: "ar" }]));
TT("تقطيع", V.chunkSpeech("جملة أولى. جملة ثانية؟ ثالثة").length, 3);
TT("ترتيب الأصوات", V.rankVoices([{ name: "eSpeak Arabic", lang: "ar" }, { name: "Microsoft Hamed Online (Natural)", lang: "ar-SA", localService: false }, { name: "Google العربية", lang: "ar-XA" }])[0].name, "Microsoft Hamed Online (Natural)");
TT("الصوت المحفوظ", V.rankVoices([{ name: "A", lang: "ar-SA" }, { name: "B", lang: "ar" }], "B")[0].name, "B");
// ── مسار صفحة الهبوط ──
const FT = (name, ok, extra) => { n++; if (!ok) { fail++; console.log("✗ مسار", name, extra === undefined ? "" : JSON.stringify(extra)); } };
{
  const r0 = V.parse("أنشئ صفحة هبوط للمنتج حنة الشفاء مع نموذج الطلب والعداد واجعلها المسار الرئيسي", data);
  FT("كل شيء في جملة واحدة ← ملخّص بتأكيد", r0.kind === "flow" && r0.confirm && r0.act.id === "landing" && r0.act.slots.product === "prod-a" && r0.act.slots.extras.length === 2 && r0.act.slots.route === true, r0);
  const a1 = V.parse("انشئ صفحة هبوط", data); FT("بلا منتج ← يسأل", a1.kind === "need" && a1.slot === "flow" && /لأي منتج/.test(a1.say) && a1.chips.length > 0, a1);
  const a2 = V.fillSlot(a1, "عسل السدر", data); FT("بعد المنتج ← يسأل عمّا يضاف", a2.kind === "need" && /ماذا أضيف/.test(a2.say), a2);
  const a3 = V.fillSlot(a2, "الاثنين", data); FT("الاثنان ← يسأل عن المسار", a3.kind === "need" && /المسار الرئيسي/.test(a3.say), a3);
  const a4 = V.fillSlot(a3, "نعم", data); FT("نعم ← ملخّص", a4.kind === "flow" && a4.confirm && a4.act.slots.route === true && a4.act.slots.product === "miel-sidr" && a4.act.slots.extras.join() === "orderform,countdown", a4);
  const b3 = V.fillSlot(a3, "لا", data); FT("لا ← المسار false ولا يُلغى", b3.kind === "flow" && b3.act.slots.route === false, b3);
  const c2 = V.fillSlot(a2, "عداد فقط", data); FT("عدّاد فقط", c2.kind === "need" && /المسار/.test(c2.say), c2);
  const d2 = V.fillSlot(a2, "لا شيء", data); FT("لا شيء ← تجاوز الإضافات", d2.kind === "need" && /المسار/.test(d2.say), d2);
  const x1 = V.fillSlot(a1, "الغ", data); FT("الإلغاء", x1.kind === "negated", x1);
  let q = a1; for (let i = 0; i < 3; i++) q = V.fillSlot(q, "بلابلا", data); FT("3 إخفاقات ← إلغاء", q.kind === "negated", q);
  const e1 = V.parse("create a landing page for miel sidr", data); FT("إنجليزي", e1.kind === "need" || e1.kind === "flow", e1);
  const f1 = V.parse("crée une page landing pour huile barbe avec formulaire de commande", data); FT("فرنسي", f1.kind === "need" || f1.kind === "flow", f1);
  FT("لا يعترض أمر صفحة جديدة عادي", V.parse("اضف صفحة جديدة باسم عروض", data).kind !== "flow");
}
console.log(fail ? `✗ فشل ${fail} من ${n}` : `✓ نجح ${n} من ${n}`);
process.exit(fail ? 1 : 0);
