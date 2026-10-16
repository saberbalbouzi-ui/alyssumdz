/* السلال المتروكة: التقاط بموافقة، استرداد تلقائي، محو، احتفاظ 30 يوماً. */
import { makeEnv, Tally } from "./_harness.mjs";
import { carts } from "../src/modules/carts.js";
const { ok, done } = Tally();
const E = makeEnv([carts]); const { call, adm, tenant, clock, sql, app } = E;
const A = await tenant("A"), B = await tenant("B");
const body = { phone: "0551234567", name: "Amine", consent: true, total: 3000, wilaya: "16", page: "/p/honey/", items: [{ id: "honey", title: "عسل <b>سدر</b>", qty: 2, price: 1500 }] };
let [c, b] = await call("POST", "/v1/carts/capture", { ...body, consent: false }, A.key); ok("بلا موافقة 400", c === 400 && b.error.code === "consent_required");
[c] = await call("POST", "/v1/carts/capture", { ...body, phone: "123" }, A.key); ok("رقم خاطئ 422", c === 422);
[c] = await call("POST", "/v1/carts/capture", { ...body, items: [] }, A.key); ok("بلا عناصر 400", c === 400);
[c] = await call("POST", "/v1/carts/capture", body, A.key); ok("التقاط 201", c === 201);
ok("الهاتف مشفّر لا نصاً", !JSON.stringify(sql("SELECT * FROM cr_carts")).includes("0551234567") && !JSON.stringify(sql("SELECT * FROM cr_carts")).includes("551234567"));
ok("HTML يُنزع من العنوان", JSON.parse(sql("SELECT items FROM cr_carts").items)[0].title === "عسل سدر");
[c] = await call("POST", "/v1/carts/capture", { ...body, total: 4500, items: [{ id: "honey", title: "عسل", qty: 3, price: 1500 }] }, A.key); ok("الإعادة تحدّث نفس الصف", sql("SELECT COUNT(*) n FROM cr_carts").n === 1 && sql("SELECT total FROM cr_carts").total === 4500);
[c, b] = await call("GET", "/v1/carts", null, A.key); ok("حديثة: لا تظهر قبل 15 دقيقة", c === 200 && b.carts.length === 0);
[c, b] = await call("GET", "/v1/carts", null, A.key, { minAge: "0" }); ok("minAge=0 تظهر مع الهاتف مفكوكاً", b.carts.length === 1 && b.carts[0].phone === "0551234567" && b.carts[0].total === 4500, b);
clock.t += 20 * 60_000; [, b] = await call("GET", "/v1/carts", null, A.key); ok("بعد 20 دقيقة تظهر (age_min)", b.carts.length === 1 && b.carts[0].age_min >= 20);
[, b] = await call("GET", "/v1/carts", null, B.key, { minAge: "0" }); ok("عزل المستأجرين", b.carts.length === 0);
const id = (await call("GET", "/v1/carts", null, A.key))[1].carts[0].id;
[c] = await call("PATCH", `/v1/carts/${id}`, { status: "bad" }, A.key); ok("حالة خاطئة 400", c === 400);
[c] = await call("PATCH", `/v1/carts/${id}`, { status: "contacted" }, B.key); ok("مستأجر آخر 404", c === 404);
[c] = await call("PATCH", `/v1/carts/${id}`, { status: "contacted" }, A.key); ok("تعليم contacted", c === 200);
[, b] = await call("GET", "/v1/carts", null, A.key); ok("المفتوحة لا تشمل contacted", b.carts.length === 0);
/* الاسترداد التلقائي عند إنشاء الطلب */
await call("POST", "/v1/events", { type: "order.created", id: "O1", data: { order_id: "O1", total: 4500, customer: { phone: "+213551234567" } } }, A.key); await app.cron();
ok("الطلب يجعل السلة recovered", sql("SELECT status FROM cr_carts").status === "recovered");
[c, b] = await call("POST", "/v1/carts/capture", body, A.key); ok("بعد الاسترداد لا إعادة فتح", b.skipped === "recovered" && sql("SELECT status FROM cr_carts").status === "recovered");
[, b] = await call("GET", "/v1/carts/stats", null, A.key); ok("الإحصاء: نسبة الاسترداد 1", b.recovery_rate === 1 && b.by.recovered.n === 1, b);
/* مفتاح عام + أصل */
const [, pk] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["cart:capture"], mode: "pub" }); await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://shop.example"] } });
[c] = await call("POST", "/v1/carts/capture", { ...body, phone: "0661112233" }, pk.key, {}, { origin: "https://shop.example" }); ok("المتصفح: التقاط بمفتاح عام", c === 201);
[c] = await call("POST", "/v1/carts/capture", { ...body, phone: "0661112244" }, pk.key, {}, { origin: "https://evil.example" }); ok("أصل غريب 403", c === 403);
[c] = await call("GET", "/v1/carts", null, pk.key, {}, { origin: "https://shop.example" }); ok("المفتاح العام لا يقرأ السلال 403", c === 403);
/* اختبار sandbox */
const [, tk] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["*"], mode: "test" }); const before = sql("SELECT COUNT(*) n FROM cr_carts").n;
[c, b] = await call("POST", "/v1/carts/capture", { ...body, phone: "0771234567" }, tk.key); ok("وضع الاختبار لا يكتب", b.sandbox === true && sql("SELECT COUNT(*) n FROM cr_carts").n === before);
/* المحو والاحتفاظ */
[c, b] = await call("DELETE", "/v1/carts/phone/0661112233", null, A.key); ok("محو برقم الزبون", c === 200 && b.removed === 1);
[c] = await call("DELETE", "/v1/carts/phone/abc", null, A.key); ok("رقم خاطئ في المحو 422", c === 422);
clock.t += 31 * 86400_000; await app.cron(); ok("احتفاظ 30 يوماً: التنظيف", sql("SELECT COUNT(*) n FROM cr_carts").n === 0);
done();
