/* متجر التطبيقات: OAuth 2.0 بنطاقات دقيقة، المراجعة، التثبيت والفوترة (80/20 عبر المحفظة)، حماية بيانات الزبائن، webhooks موقَّعة، وإبطال فوري. */
import { makeEnv, Tally } from "./_harness.mjs";
import { wallet } from "../src/modules/wallet.js";
import { commerce } from "../src/modules/commerce.js";
import { carts } from "../src/modules/carts.js";
import { appstore, validateApp, redact, eventScope, APP_SCOPES } from "../src/modules/appstore.js";
import { createHmac } from "node:crypto";
const { ok, done } = Tally();
const E = makeEnv([wallet, commerce, carts, appstore]); const { call, adm, tenant, app, sql, sqlAll, fake, clock } = E;
const D = await tenant("Dev"), A = await tenant("Shop A", ["*"], "live", "shop-a"), B = await tenant("Shop B");
const invariant = () => sqlAll("SELECT currency, SUM(balance) s FROM wl_accounts GROUP BY currency").every((x) => x.s === 0);
const bal = async (k) => (await call("GET", "/v1/wallet", null, k))[1].balances;
const basic = (id, sec) => ({ authorization: "Basic " + btoa(`${id}:${sec}`) });
const form = (o) => new URLSearchParams(o).toString();
const tokenCall = (o, h = {}) => call("POST", "/oauth/token", form(o), null, {}, { "content-type": "application/x-www-form-urlencoded", ...h });

/* ── نقي ── */
ok("كتالوج النطاقات مغلق: لا محفظة ولا مفاتيح", Object.keys(APP_SCOPES).sort().join() === "read_carts,read_customers,read_orders,read_products,write_products" && Object.values(APP_SCOPES).every((s) => s.internal.every((x) => !/wallet|keys|integrations|events:write/.test(x))));
ok("نطاق الحدث: order/payment فقط", eventScope("order.created") === "read_orders" && eventScope("payment.confirmed") === "read_orders" && eventScope("wallet.deposit") === null && eventScope("ads.token_expired") === null && eventScope("order.x/../y") === null);
ok("redact يحذف حقول الزبون بعمق", JSON.stringify(redact({ order_id: "1", customer: { name: "x", phone: "1" }, items: [{ id: "a", name: "n", qty: 1 }], total: 5 }, ["read_orders"])) === '{"order_id":"1","items":[{"id":"a","qty":1}],"total":5}');
ok("redact يحتفظ بالكل مع read_customers", redact({ customer: { name: "x" } }, ["read_customers"]).customer.name === "x");
const okApp = { slug: "sms-tools", name: "أدوات SMS", price: 2000, scopes: ["read_orders"], redirect_uris: ["https://app.example/cb"], webhook_url: "https://app.example/hook", events: ["order.created"] };
ok("تحقق: تطبيق سليم", !Object.keys(validateApp(okApp).errors).length);
ok("تحقق: نطاق مجهول/سعر/رابط http/حدث غريب", (() => { const e = validateApp({ ...okApp, scopes: ["read_wallet"], price: -1, redirect_uris: ["http://a.b/c"], events: ["wallet.deposit"] }).errors; return e.scopes && e.price && e.redirect_uris && e.events; })());
ok("تحقق: أحداث الطلبات تتطلب read_orders وwebhook", validateApp({ ...okApp, scopes: ["read_products"] }).errors.events && validateApp({ ...okApp, webhook_url: "" }).errors.webhook_url);
ok("تحقق: redirect بـ# مرفوض", !!validateApp({ ...okApp, redirect_uris: ["https://a.b/c#x"] }).errors.redirect_uris);

/* ── المطوّر ── */
let [c, b] = await call("POST", "/v1/appstore/dev/apps", okApp, D.key); ok("غير مفعّل كمطوّر 403", c === 403 && b.error.code === "not_a_developer", b);
[c] = await adm("POST", "/admin/appstore/developers", { tenant_id: 9999 }); ok("مطوّر مجهول 404", c === 404);
[c] = await adm("POST", "/admin/appstore/developers", { tenant_id: D.id }); ok("تفعيل المطوّر", c === 200);
[c, b] = await call("POST", "/v1/appstore/dev/apps", { ...okApp, scopes: ["nope"] }, D.key); ok("تطبيق غير صالح 400 مع الحقول", c === 400 && b.error.fields.scopes);
[c, b] = await call("POST", "/v1/appstore/dev/apps", okApp, D.key); ok("إنشاء تطبيق مسودة", c === 201 && b.status === "draft" && /^ci_/.test(b.client_id) && /^cs_/.test(b.client_secret) && /^whsec_app_/.test(b.webhook_secret), b);
const APP = { id: b.id, cid: b.client_id, sec: b.client_secret, whsec: b.webhook_secret };
ok("الأسرار لا تُخزَّن نصاً", !JSON.stringify(sqlAll("SELECT * FROM oauth_clients")).includes(APP.sec) && !JSON.stringify(sqlAll("SELECT * FROM apps")).includes(APP.whsec));
[c] = await call("POST", "/v1/appstore/dev/apps", okApp, D.key); ok("slug مكرر 409", c === 409);
[, b] = await call("GET", "/v1/appstore/dev/apps", null, D.key); ok("قائمتي تعرض المسودة ولا تعرض الأسرار", b.apps.length === 1 && b.apps[0].status === "draft" && !JSON.stringify(b).includes(APP.sec));
[c] = await call("POST", "/v1/appstore/dev/apps", okApp, A.key); ok("تاجر عادي لا ينشئ تطبيقات 403", c === 403);

/* ── السوق: المسودة غير ظاهرة، الإرسال والمراجعة ── */
[, b] = await call("GET", "/v1/appstore/apps", null, A.key); ok("السوق لا يعرض المسودة", b.apps.length === 0 && b.commission_pct === 20);
[c] = await call("POST", `/v1/appstore/apps/${APP.id}/install`, { scopes: ["read_orders"] }, A.key); ok("تثبيت مسودة 404", c === 404);
[c] = await call("POST", `/v1/appstore/dev/apps/${APP.id}/submit`, {}, D.key); ok("إرسال للمراجعة", c === 200);
[c] = await call("POST", `/v1/appstore/dev/apps/${APP.id}/submit`, {}, D.key); ok("إرسال ثانٍ 409", c === 409);
[c] = await call("POST", `/admin/appstore/apps/${APP.id}/review`, { status: "approved" }); ok("المراجعة تتطلب رمز الإدارة", c === 401);
[c] = await adm("POST", `/admin/appstore/apps/${APP.id}/review`, { status: "approved", note: "ممتاز" }); ok("اعتماد", c === 200);
[c] = await adm("POST", `/admin/appstore/apps/${APP.id}/review`, { status: "rejected" }); ok("رفض المعتمد 409", c === 409);
[, b] = await call("GET", "/v1/appstore/apps", null, A.key); ok("السوق يعرض المعتمد بنطاقاته المقروءة", b.apps.length === 1 && b.apps[0].scopes[0].label.length > 5 && b.apps[0].developer === "Dev" && !("webhook_url" in b.apps[0]) && !JSON.stringify(b).includes("secret"), b);
const sensA = Object.keys(APP_SCOPES).filter((s) => APP_SCOPES[s].sensitive); ok("read_customers حسّاس", sensA.join() === "read_customers");

/* ── التثبيت ── */
[c, b] = await call("POST", `/v1/appstore/apps/${APP.id}/install`, { scopes: ["read_orders", "read_customers"] }, A.key); ok("موافقة لا تطابق المطلوب 409", c === 409 && b.error.code === "consent_mismatch");
[c, b] = await call("POST", `/v1/appstore/apps/${APP.id}/install`, { scopes: [] }, A.key); ok("بلا موافقة 409", c === 409);
[c, b] = await call("POST", `/v1/appstore/apps/${APP.id}/install`, { scopes: ["read_orders"] }, A.key); ok("الرصيد غير كافٍ 409", c === 409 && b.error.code === "insufficient_funds", b);
ok("لا أثر بعد فشل الشراء", sql("SELECT COUNT(*) n FROM app_installations").n === 0 && sql("SELECT COUNT(*) n FROM platform_revenues").n === 0 && sql("SELECT COUNT(*) n FROM wl_tx WHERE kind='app_purchase'").n === 0);
await adm("POST", `/admin/wallet/${A.id}/deposit`, { amount: 5000, ref: "BANK-A" });
const T = await tenant("T", ["*"], "test"); [c, b] = await call("POST", `/v1/appstore/apps/${APP.id}/install`, { scopes: ["read_orders"] }, T.key); ok("مفتاح الاختبار لا يثبّت ولا يخصم", c === 201 && b.sandbox === true && sql("SELECT COUNT(*) n FROM app_installations").n === 0);
[c, b] = await call("POST", `/v1/appstore/apps/${APP.id}/install`, { scopes: ["read_orders"] }, A.key, {}, { "idempotency-key": "inst-1" }); ok("تثبيت مدفوع", c === 201 && b.installation.status === "active" && b.installation.price === 2000 && /^https:\/\/app\.example\/cb\?/.test(b.redirect_to), b);
const IID = b.installation.id, ru = new URL(b.redirect_to), CODE1 = ru.searchParams.get("code");
ok("redirect: code وinstallation وshop وtimestamp وتوقيع", /^ac_/.test(CODE1) && ru.searchParams.get("installation") === String(IID) && ru.searchParams.get("shop") === "shop-a" && ru.searchParams.get("timestamp"));
const sigQ = ["code", "installation", "shop", "timestamp"].map((k) => `${k}=${ru.searchParams.get(k)}`).sort().join("&");
ok("توقيع redirect = HMAC بسرّ webhook التطبيق", ru.searchParams.get("signature") === createHmac("sha256", APP.whsec).update(sigQ).digest("hex"));
ok("الرمز مخزَّن مجزَّأً", !JSON.stringify(sqlAll("SELECT * FROM oauth_codes")).includes(CODE1));
let Ba = await bal(A.key), Bd = await bal(D.key);
ok("تقاسم الإيراد: التاجر −2000، المطوّر +1600", Ba.available.DZD === 3000 && Bd.available.DZD === 1600, [Ba, Bd]);
ok("عمولة المنصة 400 وحساب الوسيط صفر", sql("SELECT balance b FROM wl_accounts WHERE tenant_id=0 AND code='platform_fees'").b === 400 && sql("SELECT balance b FROM wl_accounts WHERE tenant_id=0 AND code='app_clearing'").b === 0);
const rv = sql("SELECT * FROM platform_revenues"); ok("platform_revenues: 2000 = 400 + 1600 مسوّاة", rv.gross === 2000 && rv.fee === 400 && rv.net === 1600 && rv.state === "settled" && rv.developer_id === D.id, rv);
ok("الدفتر متوازن", invariant());
[c] = await call("POST", `/v1/appstore/apps/${APP.id}/install`, { scopes: ["read_orders"] }, A.key); ok("تثبيت مكرر 409", c === 409);
ok("حدث appstore.installed", sql("SELECT COUNT(*) n FROM pf_events WHERE type='appstore.installed'").n === 1);
[, b] = await call("GET", "/v1/appstore/installations", null, A.key); ok("تطبيقاتي المثبّتة", b.installations.length === 1 && b.installations[0].name === "أدوات SMS");
[, b] = await call("GET", "/v1/appstore/installations", null, B.key); ok("عزل المستأجرين", b.installations.length === 0);
[, b] = await call("GET", "/v1/appstore/dev/earnings", null, D.key); ok("إيرادات المطوّر", b.totals.gross === 2000 && b.totals.net === 1600 && b.totals.fee === 400 && b.revenues[0].state === "settled");
[, b] = await adm("GET", "/admin/appstore/revenues"); ok("ملخص الإدارة", b.totals.fee === 400 && b.totals.unsettled === 0);

/* ── OAuth: تبادل الرمز ── */
[c, b] = await tokenCall({ grant_type: "authorization_code", client_id: APP.cid, client_secret: "cs_wrong", code: CODE1, redirect_uri: "https://app.example/cb" }); ok("سرّ خاطئ 401 invalid_client", c === 401 && b.error === "invalid_client");
[c, b] = await tokenCall({ grant_type: "password", client_id: APP.cid, client_secret: APP.sec }); ok("نوع منح غير مدعوم", c === 400 && b.error === "unsupported_grant_type");
[c, b] = await tokenCall({ grant_type: "authorization_code", code: "ac_zzz", redirect_uri: "https://app.example/cb" }, basic(APP.cid, APP.sec)); ok("رمز مجهول invalid_grant", c === 400 && b.error === "invalid_grant");
[c, b] = await tokenCall({ grant_type: "authorization_code", code: CODE1, redirect_uri: "https://evil.example/cb" }, basic(APP.cid, APP.sec)); ok("redirect_uri مختلف يُرفض", c === 400 && b.error === "invalid_grant");
[c] = await tokenCall({ grant_type: "authorization_code", code: CODE1, redirect_uri: "https://app.example/cb" }, basic(APP.cid, APP.sec)); ok("الرمز يُحرق بعد محاولة خاطئة", c === 400);
[c, b] = await call("POST", `/v1/appstore/installations/${IID}/authorize`, {}, A.key); ok("رمز تفويض جديد", c === 200 && /code=ac_/.test(b.redirect_to));
let CODE2 = new URL(b.redirect_to).searchParams.get("code");
[c, b] = await tokenCall({ grant_type: "authorization_code", code: CODE2, redirect_uri: "https://app.example/cb" }, basic(APP.cid, APP.sec));
ok("تبادل ناجح (Basic)", c === 200 && b.token_type === "Bearer" && /^at_/.test(b.access_token) && /^rt_/.test(b.refresh_token) && b.expires_in === 3600 && b.scope === "read_orders", b);
const TK = b; ok("الرمزان مجزَّآن في القاعدة", !JSON.stringify(sqlAll("SELECT * FROM oauth_access_tokens")).includes(TK.access_token.slice(3)) && !JSON.stringify(sqlAll("SELECT * FROM oauth_access_tokens")).includes(TK.refresh_token.slice(3)));
const rawResp = await call("POST", "/oauth/token", form({ grant_type: "authorization_code", code: "ac_x" }), null, {}, { ...basic(APP.cid, APP.sec), "content-type": "application/x-www-form-urlencoded" }); ok("ترويسات no-store", /no-store/.test(rawResp[2]["Cache-Control"] ?? rawResp[3].headers?.["Cache-Control"] ?? ""));
/* إعادة استعمال الرمز = تسريب ⇒ إبطال ما صدر منه */
[c] = await tokenCall({ grant_type: "authorization_code", code: CODE2, redirect_uri: "https://app.example/cb" }, basic(APP.cid, APP.sec)); ok("إعادة استعمال الرمز مرفوضة", c === 400);
[c] = await call("GET", "/v1/appstore/me", null, TK.access_token); ok("…وتُبطل الرموز التي صدرت منه", c === 401);

/* رمز جديد للاختبارات اللاحقة */
const fresh = async () => { const [, a] = await call("POST", `/v1/appstore/installations/${IID}/authorize`, {}, A.key), code = new URL(a.redirect_to).searchParams.get("code"); const [, t] = await tokenCall({ grant_type: "authorization_code", code, redirect_uri: "https://app.example/cb", client_id: APP.cid, client_secret: APP.sec }); return t; };
let T1 = await fresh();
[c, b] = await call("GET", "/v1/appstore/me", null, T1.access_token); ok("/me بهوية المتجر والنطاقات", c === 200 && b.shop.domain === "shop-a" && b.installation.scopes[0] === "read_orders", b);

/* ── نطاقات الرمز ── */
await call("PUT", "/v1/catalog/products", { products: [{ slug: "honey", title: "عسل", price: 2400, stock: 5, offers: [] }] }, A.key);
await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://shop.example"] } });
const [, pk] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["order:create"], mode: "pub" });
const ordRef = "W-ABC12345"; [c] = await call("POST", "/v1/orders", { ref: ordRef, customer: { name: "أمين بلقاسم", phone: "0551234567" }, wilaya: "Alger", commune: "Kouba", dtype: "home", items: [{ slug: "honey", qty: 1, price: 2400 }], subtotal: 2400, discount: 0, fee: 600, total: 3000 }, pk.key, {}, { origin: "https://shop.example" }); ok("طلب تجريبي", c === 201);
[c, b] = await call("GET", "/v1/orders", null, T1.access_token); ok("read_orders: يقرأ الطلبات", c === 200 && b.orders.length === 1 && b.orders[0].ref === ordRef, b);
ok("PII مخفية بلا read_customers", b.orders[0].phone !== "0551234567" && /•/.test(b.orders[0].phone) && !b.orders[0].name.includes("بلقاسم"), b.orders[0]);
[, b] = await call("GET", "/v1/orders", null, A.key); ok("مفتاح التاجر يرى الاسم والهاتف كاملين", b.orders[0].phone === "0551234567" && b.orders[0].name === "أمين بلقاسم");
for (const [m, p, body] of [["GET", "/v1/wallet"], ["GET", "/v1/wallet/ledger"], ["POST", "/v1/wallet/withdrawals", { amount: 1000 }], ["GET", "/v1/catalog/products"], ["PUT", "/v1/catalog/products", { products: [] }], ["GET", "/v1/carts"], ["POST", "/v1/events", { type: "order.cancelled", data: { order_id: "x" } }], ["GET", "/v1/integrations"], ["GET", "/v1/appstore/installations"], ["POST", `/v1/appstore/apps/${APP.id}/install`, { scopes: ["read_orders"] }], ["DELETE", `/v1/appstore/installations/${IID}`], ["POST", `/v1/appstore/installations/${IID}/authorize`, {}], ["GET", "/v1/appstore/dev/apps"]]) {
  const r = await call(m, p, body ?? null, T1.access_token); ok(`رمز التطبيق مرفوض: ${m} ${p}`, r[0] === 403 || r[0] === 404, [r[0], r[1]?.error]);
}
const mt = await call("GET", "/v1/wallet", null, T1.access_token); ok("رفض المحفظة برمز النطاق الناقص insufficient_scope", mt[0] === 403 && mt[1].error.code === "insufficient_scope", mt[1]);
ok("مسار بلا نطاق مصرّح لا يفتحه رمز تطبيق", (await call("GET", "/admin/appstore/apps", null, T1.access_token))[0] === 401);

/* ── حد معدّل لكل تثبيت ── */
{ let last = 0, n = 0; for (; n < 320; n++) { last = (await call("GET", "/v1/appstore/me", null, T1.access_token))[0]; if (last === 429) break; }
  ok("تجاوز 300 طلب/دقيقة لتثبيت واحد ← 429", last === 429 && n >= 295 && n <= 305, n);
  const [c2] = await call("GET", "/v1/appstore/me", null, A.key); ok("الحدّ خاص بالتثبيت لا بالمتجر", c2 === 404);
  clock.t += 61e3; ok("يعود بعد انتهاء النافذة", (await call("GET", "/v1/appstore/me", null, T1.access_token))[0] === 200);
  const bad = "at_" + "0".repeat(48); let l2 = 0; for (let i = 0; i < 35; i++) l2 = (await call("GET", "/v1/orders", null, bad, {}, {}, "7.7.7.7"))[0]; ok("تخمين الرموز يُحدّ بعدد المحاولات الفاشلة للـIP (429)", l2 === 429, l2); }

/* ── تجديد الرمز ── */
{
  [c, b] = await tokenCall({ grant_type: "refresh_token", refresh_token: T1.refresh_token, client_id: APP.cid, client_secret: "cs_bad" }); ok("تجديد بسرّ خاطئ 401", c === 401);
  const oldAccess = T1.access_token, oldRefresh = T1.refresh_token;
  [c, b] = await tokenCall({ grant_type: "refresh_token", refresh_token: oldRefresh, client_id: APP.cid, client_secret: APP.sec }); ok("تجديد ناجح برمز جديد", c === 200 && b.access_token !== oldAccess && b.refresh_token !== oldRefresh, b);
  const T2 = b; [c] = await call("GET", "/v1/appstore/me", null, oldAccess); ok("الرمز القديم يبطل عند الدوران", c === 401);
  [c] = await call("GET", "/v1/appstore/me", null, T2.access_token); ok("الجديد يعمل", c === 200);
  [c, b] = await tokenCall({ grant_type: "refresh_token", refresh_token: oldRefresh, client_id: APP.cid, client_secret: APP.sec }); ok("إعادة استعمال رمز تجديد مرفوضة", c === 400 && b.error === "invalid_grant");
  [c] = await call("GET", "/v1/appstore/me", null, T2.access_token); ok("…وتُبطل السلسلة كلها (كشف السرقة)", c === 401);
  T1 = await fresh();
  clock.t += 3601e3; [c] = await call("GET", "/v1/appstore/me", null, T1.access_token); ok("انتهاء صلاحية الرمز بعد ساعة", c === 401);
  [c, b] = await tokenCall({ grant_type: "refresh_token", refresh_token: T1.refresh_token, client_id: APP.cid, client_secret: APP.sec }); ok("التجديد بعد انتهاء الوصول يعمل", c === 200); T1 = b;
  clock.t += 31 * 86400e3; [c] = await tokenCall({ grant_type: "refresh_token", refresh_token: T1.refresh_token, client_id: APP.cid, client_secret: APP.sec }); ok("رمز تجديد منتهٍ (30 يوماً) مرفوض", c === 400);
  T1 = await fresh();
}
/* ── إبطال رمز بطلب العميل ── */
{
  const [c1] = await call("POST", "/oauth/revoke", form({ token: T1.access_token }), null, {}, { ...basic(APP.cid, "cs_bad"), "content-type": "application/x-www-form-urlencoded" }); ok("revoke بسرّ خاطئ 401", c1 === 401);
  const [c2] = await call("POST", "/oauth/revoke", form({ token: T1.refresh_token }), null, {}, { ...basic(APP.cid, APP.sec), "content-type": "application/x-www-form-urlencoded" }); ok("revoke ناجح", c2 === 200);
  [c] = await call("GET", "/v1/appstore/me", null, T1.access_token); ok("…وسلسلة الرمز كلها تبطل", c === 401);
  T1 = await fresh();
}

/* ── تعديل حسّاس على تطبيق معتمد يعيده للمراجعة ── */
[c, b] = await call("PUT", `/v1/appstore/dev/apps/${APP.id}`, { description: "وصف أجدد" }, D.key); ok("تعديل غير حسّاس لا يعيد المراجعة", c === 200 && b.status === "approved" && b.resubmitted === false, b);
[c, b] = await call("PUT", `/v1/appstore/dev/apps/${APP.id}`, { scopes: ["read_orders", "read_customers"] }, D.key); ok("توسيع النطاقات يعيد للمراجعة", c === 200 && b.status === "pending" && b.resubmitted === true, b);
[c] = await call("GET", "/v1/appstore/me", null, T1.access_token); ok("تطبيق معلّق بعد اعتماد سابق: الرموز القائمة تعمل بنطاق التثبيت القديم", c === 200);
[c, b] = await call("GET", "/v1/orders", null, T1.access_token); ok("…والنطاق الحسّاس لم يُمنح تلقائياً (PII ما زالت مخفية)", c === 200 && /•/.test(b.orders[0].phone));
[c] = await call("POST", `/v1/appstore/apps/${APP.id}/install`, { scopes: ["read_orders", "read_customers"] }, B.key); ok("المعلّق لا يُثبَّت لغيره 404", c === 404);
await adm("POST", `/admin/appstore/apps/${APP.id}/review`, { status: "approved" });
await call("PUT", `/v1/appstore/dev/apps/${APP.id}`, { scopes: ["read_orders"] }, D.key); await adm("POST", `/admin/appstore/apps/${APP.id}/review`, { status: "approved" });
[c] = await call("PUT", `/v1/appstore/dev/apps/${APP.id}`, { price: -5 }, D.key); ok("تعديل غير صالح 400", c === 400);
[c] = await call("PUT", `/v1/appstore/dev/apps/${APP.id}`, { name: "x" }, B.key); ok("تطبيق مطوّر آخر 403/404", c === 403 || c === 404);

/* ── webhooks الصادرة ── */
await call("POST", "/v1/events", { type: "order.created", id: "ev-1", data: { order_id: "W-1", total: 3000, customer: { name: "سر", phone: "0770000000" }, items: [{ id: "honey", qty: 1, name: "عسل" }] } }, A.key);
await call("POST", "/v1/events", { type: "order.delivered", id: "ev-2", data: { order_id: "W-1" } }, A.key);
await call("POST", "/v1/events", { type: "wallet.deposit", id: "ev-3", data: { amount: 5, order_id: "x" } }, A.key);
await call("POST", "/v1/events", { type: "order.created", id: "ev-4", data: { order_id: "W-2" } }, B.key);
fake.calls.length = 0; fake.handler = () => [200, "ok"]; await app.cron();
const hooks = fake.calls.filter((x) => x.url === "https://app.example/hook" && /W-1/.test(x.init.body) || x.url === "https://app.example/hook" && /appstore\.installed/.test(x.init.body)), types = hooks.map((h) => JSON.parse(h.init.body).type).sort();
ok("يُسلَّم order.created المشترك به وإشعار التثبيت فقط (لا order.delivered)", types.join() === "appstore.installed,order.created" && !fake.calls.some((x) => /order\.delivered/.test(x.init.body)), types);
hooks.splice(0, hooks.length, ...hooks.filter((h) => JSON.parse(h.init.body).type === "order.created"));
ok("لا أحداث متاجر أخرى ولا أحداث المحفظة", !hooks.some((h) => /wallet|W-2/.test(h.init.body)));
{ const h = hooks[0], body = JSON.parse(h.init.body), m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(h.init.headers["X-App-Signature"]);
  ok("توقيع X-App-Signature صحيح بسرّ التطبيق", m && m[2] === createHmac("sha256", APP.whsec).update(m[1] + "." + h.init.body).digest("hex"));
  ok("الحمولة: بيانات الزبون محذوفة بلا read_customers", body.data.order_id === "W-1" && !("customer" in body.data) && !JSON.stringify(body).includes("0770000000") && body.data.items[0].qty === 1 && !("name" in body.data.items[0]), body);
  ok("shop وevent ورأس التسليم", body.shop.domain === "shop-a" && h.init.headers["X-App-Event"] === "order.created" && !!h.init.headers["X-App-Delivery"] && h.init.redirect === "manual"); }
/* فشل ← إعادة بتباعد */
await call("POST", "/v1/events", { type: "order.created", id: "ev-5", data: { order_id: "W-5" } }, A.key); fake.handler = () => [503, "down"]; fake.calls.length = 0; await app.cron();
ok("فشل التسليم يُجدول إعادة", sql("SELECT attempts a, state s, last_error e FROM app_deliveries WHERE payload LIKE '%W-5%'").a === 1 && /HTTP 503/.test(sql("SELECT last_error e FROM app_deliveries WHERE payload LIKE '%W-5%'").e));
fake.calls.length = 0; await app.cron(); ok("لا إعادة قبل التباعد", fake.calls.length === 0);
clock.t += 90e3; fake.handler = () => [200, "ok"]; await app.cron(); ok("إعادة ناجحة بعد التباعد", sql("SELECT state s FROM app_deliveries WHERE payload LIKE '%W-5%'").s === "sent");
/* webhook المطوّر لا يتبع التحويلات ولا يُرسل لعنوان http */
{ const bad = sqlAll("SELECT * FROM app_deliveries WHERE state='failed'"); ok("لا تسليمات فاشلة نهائياً", bad.length === 0); }
/* قراءة موسَّعة: مع read_customers تصل البيانات كاملة */
{ const [, a2] = await call("POST", "/v1/appstore/dev/apps", { ...okApp, slug: "crm-pro", name: "CRM احترافي", scopes: ["read_orders", "read_customers"], price: 0, webhook_url: "https://crm.example/hook", redirect_uris: ["https://crm.example/cb"] }, D.key);
  await call("POST", `/v1/appstore/dev/apps/${a2.id}/submit`, {}, D.key); await adm("POST", `/admin/appstore/apps/${a2.id}/review`, { status: "approved" });
  [c, b] = await call("POST", `/v1/appstore/apps/${a2.id}/install`, { scopes: ["read_orders", "read_customers"] }, A.key); ok("تثبيت مجاني بنطاق حسّاس", c === 201 && b.installation.price === 0, b);
  ok("المجاني بلا قيد مالي", sql("SELECT COUNT(*) n FROM platform_revenues").n === 1);
  await call("POST", "/v1/events", { type: "order.created", id: "ev-6", data: { order_id: "W-6", customer: { name: "علي", phone: "0661111111" } } }, A.key); fake.calls.length = 0; fake.handler = () => [200, "ok"]; await app.cron();
  const crm = fake.calls.find((x) => x.url === "https://crm.example/hook" && /W-6/.test(x.init.body)); ok("مع read_customers تصل بيانات الزبون", crm && JSON.parse(crm.init.body).data.customer.phone === "0661111111");
  ok("التطبيق الأول (بلا النطاق) لا يستلمها", !fake.calls.some((x) => x.url === "https://app.example/hook" && /0661111111/.test(x.init.body)));
  const t2 = await tokenCall({ grant_type: "authorization_code", code: new URL(b.redirect_to).searchParams.get("code"), redirect_uri: "https://crm.example/cb" }, basic(sql("SELECT client_id c FROM oauth_clients WHERE app_id=?", a2.id).c, a2.client_secret));
  [c, b] = await call("GET", "/v1/orders", null, t2[1].access_token); ok("رمز read_customers يرى الهاتف الكامل", c === 200 && b.orders.some((o) => o.phone === "0551234567"), b.orders?.map((o) => o.phone));
  ok("رمز تطبيق لا يصلح لتطبيق آخر (client_id مختلف)", (await tokenCall({ grant_type: "refresh_token", refresh_token: T1.refresh_token }, basic(sql("SELECT client_id c FROM oauth_clients WHERE app_id=?", a2.id).c, a2.client_secret)))[0] === 400);
}

/* ── تقليص أذونات التثبيت يسري فوراً ── */
{ sql("SELECT 1"); E.db.prepare("UPDATE app_installations SET scopes='[]' WHERE id=?").run(IID); const [c1, b1] = await call("GET", "/v1/orders", null, T1.access_token); ok("تقليص أذونات التثبيت يسحب الصلاحية فوراً", c1 === 403, [c1, b1?.error]); E.db.prepare("UPDATE app_installations SET scopes='[\"read_orders\"]' WHERE id=?").run(IID); }

/* ── تدوير الأسرار ── */
{ const oldSec = APP.sec; [c, b] = await call("POST", `/v1/appstore/dev/apps/${APP.id}/rotate-secrets`, {}, D.key); ok("تدوير الأسرار", c === 200 && b.client_secret !== oldSec && /^whsec_app_/.test(b.webhook_secret)); APP.sec = b.client_secret; APP.whsec = b.webhook_secret;
  [c] = await tokenCall({ grant_type: "refresh_token", refresh_token: T1.refresh_token }, basic(APP.cid, oldSec)); ok("السرّ القديم يبطل فوراً", c === 401);
  [c] = await tokenCall({ grant_type: "refresh_token", refresh_token: T1.refresh_token }, basic(APP.cid, APP.sec)); ok("السرّ الجديد يعمل", c === 200); }

/* ── إلغاء التثبيت وتعليق التطبيق: إبطال لحظي ── */
T1 = await fresh(); [c] = await call("GET", "/v1/appstore/me", null, T1.access_token); ok("قبل الإلغاء يعمل", c === 200);
[c] = await call("DELETE", `/v1/appstore/installations/${IID}`, null, B.key); ok("تاجر آخر لا يلغي 404", c === 404);
[c] = await call("DELETE", `/v1/appstore/installations/${IID}`, null, A.key); ok("إلغاء التثبيت", c === 200);
[c] = await call("GET", "/v1/appstore/me", null, T1.access_token); ok("إبطال الرموز لحظياً", c === 401);
ok("حدث appstore.uninstalled", sql("SELECT COUNT(*) n FROM pf_events WHERE type='appstore.uninstalled'").n === 1);
[c] = await tokenCall({ grant_type: "refresh_token", refresh_token: T1.refresh_token, client_id: APP.cid, client_secret: APP.sec }); ok("لا تجديد بعد الإلغاء", c === 400);
await call("POST", "/v1/events", { type: "order.created", id: "ev-7", data: { order_id: "W-7" } }, A.key); fake.calls.length = 0; await app.cron(); ok("لا webhooks لتثبيت ملغى (عدا إشعار الإلغاء)", !fake.calls.some((x) => x.url === "https://app.example/hook" && /W-7/.test(x.init.body)));
ok("إشعار الإلغاء وصل للتطبيق", fake.calls.some((x) => x.url === "https://app.example/hook" && /appstore\.uninstalled/.test(x.init.body)) || sql("SELECT COUNT(*) n FROM app_deliveries WHERE type='appstore.uninstalled'").n === 1);
/* إعادة التثبيت: المدفوع مرة واحدة لا يُخصم ثانية */
Ba = await bal(A.key); [c, b] = await call("POST", `/v1/appstore/apps/${APP.id}/install`, { scopes: ["read_orders"] }, A.key); ok("إعادة تثبيت تطبيق دُفع ثمنه (once) بلا خصم جديد", c === 201 && (await bal(A.key)).available.DZD === Ba.available.DZD && sql("SELECT COUNT(*) n FROM platform_revenues").n === 1, b);

/* ── تعليق التطبيق من الإدارة ── */
const T3 = await fresh(); [c] = await call("GET", "/v1/appstore/me", null, T3.access_token); ok("قبل التعليق يعمل", c === 200);
[c] = await adm("POST", `/admin/appstore/apps/${APP.id}/review`, { status: "suspended", note: "سلوك مريب" }); ok("تعليق التطبيق", c === 200);
[c] = await call("GET", "/v1/appstore/me", null, T3.access_token); ok("التعليق يبطل رموز كل المتاجر لحظياً", c === 401);
[c] = await tokenCall({ grant_type: "refresh_token", refresh_token: T3.refresh_token, client_id: APP.cid, client_secret: APP.sec }); ok("لا تجديد لتطبيق معلّق", c === 400);
[, b] = await call("GET", "/v1/appstore/apps", null, A.key); ok("المعلّق يختفي من السوق", !b.apps.some((x) => x.id === APP.id));
await adm("POST", `/admin/appstore/apps/${APP.id}/review`, { status: "approved" });

/* ── العمولة قابلة للضبط ── */
[c] = await adm("PUT", "/admin/appstore/settings", { commission_pct: 80 }); ok("عمولة >50 مرفوضة", c === 400);
[c] = await adm("PUT", "/admin/appstore/settings", { commission_pct: 30 }); ok("ضبط العمولة 30%", c === 200);

/* ── اشتراك شهري: خصم، مهلة سماح، تعليق ── */
{ const [, m] = await call("POST", "/v1/appstore/dev/apps", { ...okApp, slug: "monthly-app", name: "تطبيق شهري", price: 1000, billing: "monthly", events: [], webhook_url: "", redirect_uris: ["https://m.example/cb"] }, D.key);
  await call("POST", `/v1/appstore/dev/apps/${m.id}/submit`, {}, D.key); await adm("POST", `/admin/appstore/apps/${m.id}/review`, { status: "approved" });
  const before = (await bal(A.key)).available.DZD;
  [c, b] = await call("POST", `/v1/appstore/apps/${m.id}/install`, { scopes: ["read_orders"] }, A.key); ok("تثبيت اشتراك شهري يخصم الشهر الأول", c === 201 && (await bal(A.key)).available.DZD === before - 1000, b);
  const rev = sqlAll("SELECT * FROM platform_revenues WHERE app_id=?", m.id)[0]; ok("عمولة 30% على الاشتراك الجديد: 300/700", rev.fee === 300 && rev.net === 700 && rev.state === "settled", rev);
  const MI = b.installation.id; ok("موعد الخصم القادم محدد", sql("SELECT next_charge_at n FROM app_installations WHERE id=?", MI).n > 0);
  await app.cron(); ok("لا خصم قبل الموعد", sqlAll("SELECT * FROM platform_revenues WHERE app_id=?", m.id).length === 1);
  clock.t += 31 * 86400e3; const bal2 = (await bal(A.key)).available.DZD; await app.cron();
  ok("بعد شهر: خصم ثانٍ", sqlAll("SELECT * FROM platform_revenues WHERE app_id=?", m.id).length === 2 && (await bal(A.key)).available.DZD === bal2 - 1000);
  /* إفراغ الرصيد ثم موعد جديد */
  const have = (await bal(A.key)).available.DZD; await call("POST", "/v1/wallet/withdrawals", { amount: have, method: "ccp", destination: "0012345678" }, A.key);
  clock.t += 31 * 86400e3; await app.cron(); ok("الرصيد غير كافٍ: past_due وليس تعليقاً فورياً", sql("SELECT status s FROM app_installations WHERE id=?", MI).s === "past_due");
  const tk = await (async () => { const [, a] = await call("POST", `/v1/appstore/installations/${MI}/authorize`, {}, A.key); const mcid = sql("SELECT client_id c FROM oauth_clients WHERE app_id=?", m.id).c; return { a, mcid }; })(); ok("past_due ما زال يعمل خلال المهلة", tk.a !== undefined);
  clock.t += 4 * 86400e3; await app.cron(); ok("بعد 3 أيام سماح: تعليق التثبيت", sql("SELECT status s FROM app_installations WHERE id=?", MI).s === "suspended");
  ok("حدث appstore.suspended", sql("SELECT COUNT(*) n FROM pf_events WHERE type='appstore.suspended'").n === 1);
  ok("لا سحب بالسالب ولا دفتر مكسور", invariant() && sqlAll("SELECT balance FROM wl_accounts WHERE tenant_id>0").every((x) => x.balance >= 0));
}

/* ── وحدة معطّلة ── */
await adm("PUT", `/admin/tenants/${B.id}/modules`, { off: ["appstore"] }); [c, b] = await call("GET", "/v1/appstore/apps", null, B.key); ok("وحدة معطّلة 403", c === 403 && b.error.code === "module_disabled");
ok("الدفتر متوازن في النهاية", invariant());
done();
