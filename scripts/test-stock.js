/* اختبار ربط المخزون بالطلبات (assets/js/admin-stockcheck.js): توزيع بالأقدمية، علبتان/ثلاث، تنويعات، فحص مباشر، ملخص.
     node scripts/test-stock.js */
const fs = require("fs"), path = require("path"), vm = require("vm");
let fails = 0, total = 0; const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } else console.log("✓", n); };
const win = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../assets/js/admin-stockcheck.js"), "utf8"), { window: win, document: { addEventListener() { } }, console });
const SC = win.StockCheck;
const honey = { slug: "honey", title: "عسل", stock: 5 }, cream = { slug: "cream", title: "كريمة", stock: null };
const varP = { slug: "tee", title: "قميص", type: "variable", stock: null, variations: [{ id: "s", attrs: { m: "S" }, stock: 2 }, { id: "l", attrs: { m: "L" }, stock: 10 }] };
const lines = { A: [{ p: honey, v: null, qty: 3 }], B: [{ p: honey, v: null, qty: 2 }], C: [{ p: honey, v: null, qty: 2 }], D: [{ p: cream, v: null, qty: 50 }], E: [{ p: varP, v: varP.variations[0], qty: 3 }], F: [{ p: honey, v: null, qty: 1 }, { p: honey, v: null, qty: 2 }] };
const mk = (id, day, st, note) => ({ id, date: "2026-10-0" + day + "T10:00:00Z", status: st || "nouvelle", note: note || "" });
const L = o => lines[o.id] || [];
let r = SC.plan([mk("A", 1), mk("B", 2), mk("C", 3)], L);
ok("الأقدم أولاً: A(3) وB(2) يدخلان المخزون (5) وC(2) خارجه", !r.byOrder.A && !r.byOrder.B && r.byOrder.C && r.byOrder.C.short[0].need === 2 && r.byOrder.C.short[0].have === 0, r.byOrder);
ok("الملخص: طلب واحد يفوق المخزون ومجموع الطلب 7 على مخزون 5", SC.summary(r).orders === 1 && SC.summary(r).products[0].demand === 7 && SC.summary(r).products[0].stock === 5, SC.summary(r));
r = SC.plan([mk("A", 1), mk("C", 3), mk("B", 2)], L); ok("الترتيب بالتاريخ لا بترتيب المصفوفة", !r.byOrder.A && !r.byOrder.B && r.byOrder.C);
r = SC.plan([mk("F", 1)], L); ok("سطرا المنتج نفسه في طلب واحد يُجمعان (1+2=3 علب ≤ 5)", !r.byOrder.F, r.byOrder);
r = SC.plan([mk("A", 1), mk("F", 2)], L); ok("طلب بثلاث علب بعد طلب بثلاث: لا يكفي (3+3>5)", r.byOrder.F && r.byOrder.F.short[0].need === 3 && r.byOrder.F.short[0].have === 2 && r.byOrder.F.short[0].stock === 5, r.byOrder);
r = SC.plan([mk("D", 1)], L); ok("منتج غير متتبَّع (مخزون غير محدود) لا يُعدّ خارج المخزون", !r.byOrder.D && Object.keys(r.byKey).length === 0);
r = SC.plan([mk("E", 1)], L); ok("مخزون التنويع هو المعتمد (3 > 2 للمقاس S)", r.byOrder.E && /S/.test(r.byOrder.E.short[0].title) && r.byOrder.E.short[0].have === 2, r.byOrder);
r = SC.plan([mk("A", 1, "confirmee"), mk("B", 2, "annulee"), mk("C", 3, "nouvelle", "📦")], L); ok("المؤكَّد والملغى والمخصوم مسبقاً (📦) لا يُحتسب كطلب معلّق", r.pending === 0);
r = SC.plan([mk("A", 1), mk("C", 3)], L, "2026-10-02T00:00:00Z"); ok("طلبات أقدم من تاريخ بدء تتبّع المخزون تُتجاهل", r.pending === 1 && !r.byOrder.C);
ok("الفحص المباشر عند التأكيد: 3 علب ومخزون 5 = يكفي", SC.direct(mk("A", 1), L) === null);
honey.stock = 2; ok("الفحص المباشر: 3 علب ومخزون 2 = لا يكفي (المطلوب 3 والمتاح 2)", (() => { const d = SC.direct(mk("A", 1), L); return d && d[0].need === 3 && d[0].have === 2; })()); honey.stock = 5;
ok("الشارة تظهر للطلب الخارج عن المخزون فقط", SC.badge(mk("C", 3), SC.plan([mk("A", 1), mk("B", 2), mk("C", 3)], L)).includes("خارج المخزون") && SC.badge(mk("A", 1), SC.plan([mk("A", 1), mk("B", 2), mk("C", 3)], L)) === "");
console.log(fails ? `✗ فشل ${fails} من ${total}` : `✓ نجح ${total} من ${total}`); process.exit(fails ? 1 : 0);
