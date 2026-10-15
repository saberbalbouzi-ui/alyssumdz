/* بوابة المورّد الخارجي: طلب انضمام عام ← مراجعة يدوية ← حساب بمفتاح محدود النطاق؛ نوع البائع (جملة/تجزئة) والفلتر؛ صور المنتج؛ إحصاءات المبيعات؛ الإيقاف. */
import { makeEnv, Tally } from "./_harness.mjs";
import { marketplace } from "../src/modules/marketplace.js";
import { commerce } from "../src/modules/commerce.js";
import { wallet } from "../src/modules/wallet.js";
const { ok, done } = Tally();
const E = makeEnv([marketplace, commerce, wallet]); const { call, adm, tenant, app, sql, sqlAll } = E;
const A = await tenant("Affiliate", ["*"], "live", "aff-site");
const APPLY = { kind: "wholesale", name: "مخازن الأمل للجملة", contact: "كريم", phone: "0661234567", wilaya: "الجزائر", reg_no: "16/00-1234567B20", about: "عسل وزيوت <b>بالجملة</b>" };
const pubApply = (b) => call("POST", "/v1/marketplace/apply", b, null);

/* ───── طلب الانضمام (عام) ───── */
let [c, b] = await pubApply({ ...APPLY, kind: "x" }); ok("نوع غير معروف مرفوض", c === 400);
[c] = await pubApply({ ...APPLY, phone: "123" }); ok("هاتف غير جزائري مرفوض", c === 400);
[c] = await pubApply({ ...APPLY, reg_no: "" }); ok("الجملة تتطلب سجلاً تجارياً", c === 400);
const RET = { ...APPLY, kind: "retail", reg_no: "", phone: "0662222222", name: "متجر التجزئة" };
[c] = await pubApply(RET); ok("التجزئة لا تتطلب سجلاً", c === 201);
[c, b] = await pubApply({ ...APPLY, website: "http://spam" }); ok("حقل الفخ يُبتلع بصمت", c === 201 && b.id === 0 && sqlAll("SELECT id FROM mk_sellers").length === 1);
[c, b] = await pubApply(APPLY); ok("طلب جملة صحيح ← pending", c === 201 && b.status === "pending", b); const wid = b.id;
[c] = await pubApply(APPLY); ok("نفس الرقم لا يكرّر الطلب", c === 409);
ok("الهاتف مشفّر لا نصّ صريح، والوسوم منزوعة", !JSON.stringify(sqlAll("SELECT * FROM mk_sellers")).includes("0661234567") && !sql("SELECT about a FROM mk_sellers WHERE id=?", wid).a.includes("<"));
[c] = await call("POST", "/admin/marketplace/sellers/1/approve", {}, "bad"); ok("الاعتماد للمزوّد فقط", c === 401);

/* ───── المراجعة ───── */
[, b] = await adm("GET", "/admin/marketplace/sellers"); ok("المزوّد يرى المعلّقين بهواتفهم", b.sellers.length === 2 && b.sellers.some((s) => s.id === wid && s.phone === "0661234567" && s.kind === "wholesale"), b);
[c] = await adm("POST", `/admin/marketplace/sellers/${wid + 1}/reject`, {}); ok("رفض غير موجود 404", c === 404);
const rj = b.sellers.find((s) => s.kind === "retail").id; [c] = await adm("POST", `/admin/marketplace/sellers/${rj}/reject`, { note: "بيانات ناقصة" }); ok("رفض بسبب", c === 200 && sql("SELECT status s FROM mk_sellers WHERE id=?", rj).s === "rejected");
[c] = await pubApply({ ...RET, name: "متجر ثانٍ" }); ok("بعد الرفض يمكنه التقدّم من جديد", c === 201);
[c, b] = await adm("POST", `/admin/marketplace/sellers/${wid}/approve`, { origin: "https://alyssumdz.com/saas/x?y" }); ok("اعتماد ← مستأجر ومفتاح مرة واحدة", c === 200 && /^pk_live_[0-9a-f]{40}$/.test(b.key) && b.tenant_id > 0, b);
const SK = b.key, ST = b.tenant_id;
ok("المستأجر نشط وأصل البوابة مضبوط", sql("SELECT status s, settings st FROM pf_tenants WHERE id=?", ST).s === "active" && JSON.parse(sql("SELECT settings s FROM pf_tenants WHERE id=?", ST).s).origins[0] === "https://alyssumdz.com");
[c] = await adm("POST", `/admin/marketplace/sellers/${wid}/approve`, {}); ok("لا اعتماد مرتين", c === 409);

/* ───── المفتاح محدود النطاق ───── */
[c] = await call("GET", "/v1/marketplace/profile", null, SK); ok("يقرأ ملفه", c === 200);
[c] = await call("GET", "/v1/wallet", null, SK); ok("يقرأ محفظته", c === 200);
[c] = await call("POST", "/v1/events", { type: "order.created", data: {} }, SK); ok("لا يملك إدخال أحداث", c === 403);
[c] = await call("PUT", "/v1/catalog/products", { products: [] }, SK); ok("لا يملك كتالوج المتجر", c === 403);
[, b] = await call("GET", "/v1/marketplace/profile", null, SK); ok("ملفه جملة معتمد", b.kind === "wholesale" && b.status === "approved" && b.source === "portal", b);

/* ───── الصور ───── */
const JPG = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(60).fill(7)]).toString("base64");
[c] = await call("POST", "/v1/marketplace/images", { image: "data:image/svg+xml;base64,PHN2Zz4=" }, SK); ok("SVG مرفوض", c === 400);
[c, b] = await call("POST", "/v1/marketplace/images", { image: JPG }, SK); ok("رفع صورة ← رابط https عام", c === 201 && /^https:\/\/.+\/v1\/marketplace\/img\/\d+$/.test(b.url), b);
const url = b.url; const imgPath = new URL(url).pathname;
let r = await app.handle("GET", imgPath, {}, {}, "", "9.9.9.9"); ok("الصورة تُخدم بنوعها وبلا مصادقة ومخزَّنة مؤقتاً", r.status === 200 && r.headers["Content-Type"] === "image/jpeg" && r.body.length > 60 && /max-age/.test(r.headers["Cache-Control"]) && r.headers["X-Content-Type-Options"] === "nosniff");
r = await app.handle("GET", "/v1/marketplace/img/9999", {}, {}, "", "9.9.9.9"); ok("صورة غير موجودة 404", r.status === 404);

/* ───── منتجات المورّد (جملة) والكتالوج ───── */
const P = { slug: "honey-1kg", title: "عسل سدر 1كغ", descr: "وصف", image: url, category: "عسل", supplier_price: 1800, commission: 300, rrp: 2600, stock: 20 };
[c, b] = await call("POST", "/v1/marketplace/products", P, SK); ok("يدرج منتجاً بصورة من رفعه", c === 201 && b.status === "pending", b); const mp1 = b.id;
// مورّد داخلي (تجزئة بلا ملف)
const S2 = await tenant("Shop", ["*"], "live", "shop2"); [, b] = await call("POST", "/v1/marketplace/products", { ...P, slug: "oil", title: "زيت الأرغان", image: "https://cdn.example/o.jpg" }, S2.key); const mp2 = b.id;
await adm("POST", `/admin/marketplace/products/${mp1}/approve`, {}); await adm("POST", `/admin/marketplace/products/${mp2}/approve`, {});
[, b] = await call("GET", "/v1/marketplace/catalog", null, A.key); ok("الكتالوج يعرض النوعين: الداخلي بلا ملف = تجزئة", b.products.length === 2 && b.products.find((p) => p.id === mp1).seller.kind === "wholesale" && b.products.find((p) => p.id === mp2).seller.kind === "retail", b.products.map((p) => p.seller));
ok("اسم المورّد المعروض هو اسم النشاط", b.products.find((p) => p.id === mp1).supplier === "مخازن الأمل للجملة");
[, b] = await call("GET", "/v1/marketplace/catalog", null, A.key, { seller: "wholesale" }); ok("فلتر الجملة", b.products.length === 1 && b.products[0].id === mp1);
[c, b] = await call("GET", "/v1/marketplace/catalog", null, A.key, { seller: "retail" }); ok("فلتر التجزئة", b.products.length === 1 && b.products[0].id === mp2);
[c] = await adm("PUT", `/admin/marketplace/tenants/${S2.id}/kind`, { kind: "wholesale" }); [, b] = await call("GET", "/v1/marketplace/catalog", null, A.key, { seller: "wholesale" }); ok("المزوّد يحوّل مورّداً داخلياً إلى جملة", c === 200 && b.products.length === 2);
[c] = await adm("PUT", `/admin/marketplace/tenants/${S2.id}/kind`, { kind: "x" }); ok("نوع غير صالح مرفوض", c === 400);

/* ───── ملف البائع للداخلي ───── */
[c] = await call("PUT", "/v1/marketplace/profile", { name: "ab" }, S2.key); ok("اسم قصير مرفوض", c === 400);
[c] = await call("PUT", "/v1/marketplace/profile", { name: "متجر الأرغان", about: "x", wilaya: "وهران" }, S2.key); [, b] = await call("GET", "/v1/marketplace/profile", null, S2.key); ok("تعديل الاسم لا يغيّر النوع الذي حدّده المزوّد", c === 200 && b.name === "متجر الأرغان" && b.kind === "wholesale", b);

/* ───── مبيعات + إحصاءات ───── */
await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://aff.example"] } });
const [, pkr] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["order:create"], mode: "pub" }), PK = pkr.key;
await call("PUT", "/v1/catalog/products", { products: [] }, A.key);
await adm("POST", "/admin/wallet/" + ST + "/deposit", { amount: 10000, ref: "dep-sup-1" });
[, b] = await call("POST", "/v1/marketplace/imports", { mp_id: mp1, price: 2600 }, A.key); const slug = b.slug;
const mk = async () => call("POST", "/v1/orders", { ref: "AFF-" + Math.random().toString(36).slice(2, 9), customer: { name: "أمين", phone: "0551234567" }, wilaya: "Alger", commune: "Kouba", dtype: "home", items: [{ slug, qty: 1, price: 2600 }], subtotal: 2600, fee: 400, total: 3000 }, PK, {}, { origin: "https://aff.example" });
for (let i = 0; i < 3; i++) { [c] = await mk(); ok("طلب " + (i + 1) + " على منتج المورّد الخارجي", c === 201 || c === 200, c); }
[, b] = await call("GET", "/v1/marketplace/orders", null,  SK, { role: "supplier" }); ok("يرى طلباته بيانات الزبون", b.orders.length === 3 && b.orders[0].customer.phone === "0551234567");
const ids = b.orders.map((o) => o.id);
await call("POST", `/v1/marketplace/orders/${ids[0]}/status`, { status: "delivered" }, SK); await call("POST", `/v1/marketplace/orders/${ids[1]}/status`, { status: "delivered" }, SK);
await call("POST", `/v1/marketplace/orders/${ids[2]}/status`, { status: "cancelled" }, SK);
[, b] = await call("GET", "/v1/marketplace/stats", null,  SK, { days: "30" });
ok("إحصاءات: 3 طلبات، 2 مسلَّمة، مبيعات 5200، عمولات 600", b.orders === 3 && b.delivered === 2 && b.returned === 1 && b.sales === 5200 && b.commissions_paid === 600 && b.delivery_rate === 67 && b.top[0].delivered === 2, b);
[, b] = await call("GET", "/v1/marketplace/catalog", null, S2.key); const row = b.products.find((p) => p.id === mp1);
ok("تقييم المورّد في الكتالوج (نسبة التسليم)", row.seller.delivered === 2 && row.seller.returned === 1 && row.seller.rate === 67, row.seller);
[c] = await call("GET", "/v1/marketplace/stats", null, A.key); ok("الإحصاءات تخص صاحبها", c === 200);

/* ───── إعادة المفتاح والإيقاف ───── */
[c, b] = await adm("POST", `/admin/marketplace/sellers/${wid}/rekey`, {}); const SK2 = b.key; [c] = await call("GET", "/v1/marketplace/profile", null, SK); ok("إعادة الإصدار تُبطل القديم", c === 401);
[c] = await call("GET", "/v1/marketplace/profile", null, SK2); ok("والجديد يعمل", c === 200);
[c, b] = await adm("POST", `/admin/marketplace/sellers/${wid}/suspend`, { note: "شكاوى" }); ok("إيقاف المورّد ← منتجاته موقوفة", c === 200 && b.products === 1 && sql("SELECT status s FROM mk_products WHERE id=?", mp1).s === "suspended");
[c] = await call("GET", "/v1/marketplace/profile", null, SK2); ok("مفتاحه لا يعمل بعد الإيقاف", c === 401);
[c] = await mk(); ok("الأفلييت لا يستطيع البيع منه بعد الإيقاف", c === 409, c);
[, b] = await call("GET", "/v1/marketplace/catalog", null, A.key); ok("منتجه يختفي من الكتالوج", !b.products.some((p) => p.id === mp1));
[c, b] = await adm("POST", `/admin/marketplace/sellers/${wid}/approve`, {}); ok("إعادة التفعيل تستعيد الحساب والمنتج «موقوفاً منه» ليستأنفه", c === 200 && sql("SELECT status s FROM mk_products WHERE id=?", mp1).s === "paused" && sql("SELECT status s FROM pf_tenants WHERE id=?", ST).s === "active");
ok("الدفتر متوازن", (await adm("GET", "/admin/wallet/summary"))[1].balanced === true);
done();
