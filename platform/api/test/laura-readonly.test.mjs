/* LAURA في وضع «قراءة وتحليل فقط» (الافتراضي في الإنتاج): LAURA_WRITES غير مضبوط ⇒ أدوات الكتابة لا تُعرض للنموذج ولا تُنفَّذ ولا يُعتمد معلَّق قديم؛ القراءة تعمل كاملة.
   المحاكاة: نموذج محلي بروتوكولي (_mock_llm.mjs) — ليس نموذجاً حقيقياً. التشغيل: node platform/api/test/laura-readonly.test.mjs */
import { makeEnv, Tally } from "./_harness.mjs";
import { payments } from "../src/modules/payments.js"; import { wallet } from "../src/modules/wallet.js"; import { ads } from "../src/modules/ads.js"; import { commerce } from "../src/modules/commerce.js"; import { carts } from "../src/modules/carts.js"; import { laura } from "../src/modules/laura.js";
import { signActor } from "../src/laura/actor.js"; import { createMock, KEY } from "./_mock_llm.mjs";
const { ok, done } = Tally(); const SECRET = "actor-secret-0123456789abcdef", mock = createMock();
const cfg = { LAURA_LLM_KEY: KEY, LAURA_ACTOR_SECRET: SECRET, LAURA_TIMEOUT_MS: "400" };   /* بلا LAURA_WRITES عمداً */
const E = makeEnv([commerce, carts, payments, wallet, ads, laura], { config: cfg }); E.fake.handler = mock.handler;
const { call, adm, tenant, sql, clock } = E; const A = await tenant("A"), nowS = () => Math.floor(clock.t / 1000);
const OWNER = async () => ({ "x-laura-actor": await signActor(SECRET, { sub: "u-owner", role: "owner", perms: ["*"], tid: A.id, iat: nowS() - 5, exp: nowS() + 300 }) });
const chat = async (msg, h) => { clock.t += 6000; return call("POST", "/v1/laura/chat", { message: msg }, A.key, {}, h); };
const confirm = (id, approve, h) => call("POST", "/v1/laura/confirm", { id, approve }, A.key, {}, h);
await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://shop.example"] } });
await call("PUT", "/v1/catalog/products", { products: [{ slug: "cream", title: "كريم", price: 1500, stock: 20, offers: [] }] }, A.key);
const [, pk] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["order:create"], mode: "pub" });
const mk = (ref) => ({ ref, customer: { name: "أمين", phone: "0551234567" }, wilaya: "Alger", commune: "Kouba", dtype: "home", items: [{ slug: "cream", qty: 1, price: 1500 }], subtotal: 1500, discount: 0, fee: 600, total: 2100 });
for (const r of ["W-1001", "W-1002", "W-1003"]) { const [s, bb] = await call("POST", "/v1/orders", mk(r), pk.key, {}, { origin: "https://shop.example" }); ok("طلب ساكن " + r, s === 201, bb); }
const OW = await OWNER(); let s, b;
[s, b] = await call("GET", "/v1/laura/health", null, A.key, {}, OW); ok("health: writes_enabled=false بلا LAURA_WRITES", s === 200 && b.writes_enabled === false, b);
[, b] = await call("GET", "/v1/laura/tools", null, A.key, {}, OW); ok("المالك يرى أدوات القراءة وحدها (لا أداة كتابة)", b.tools.length > 0 && b.tools.every((t) => t.tier === "read"), b.tools.map((t) => t.name + ":" + t.tier).filter((x) => !/:read$/.test(x)));
[s, b] = await chat('TEST_CALL:orders_list:{}', OW); ok("أداة قراءة تعمل (orders_list)", s === 200 && (b.tools ?? []).some((t) => t.name === "orders_list" && t.ok), b.tools);
[s, b] = await chat('TEST_CALL:order_confirm:{"ref":"W-1001"}', OW); ok("محاولة كتابة عبر النموذج: لا إجراء معلّق ولا تنفيذ (الأداة غير متاحة)", s === 200 && !(b.pending ?? []).length && b.state !== "awaiting_approval" && sql("SELECT status FROM cm_orders WHERE ref='W-1001'").status === "nouvelle" && sql("SELECT COUNT(*) n FROM lr_pending").n === 0, { state: b.state, tools: b.tools });
/* معلَّق أُنشئ حين كانت الكتابة مفتوحة ثم أُغلقت: لا يُعتمد */
cfg.LAURA_WRITES = "on"; [, b] = await chat("أكد الطلب W-1002", OW); const P = b.pending?.[0]; ok("(تجهيز) معلَّق أُنشئ والكتابة مفتوحة", !!P && P.tool === "order_confirm", b);
cfg.LAURA_WRITES = ""; [s, b] = await confirm(P.id, true, OW);
ok("اعتماد معلَّق بعد إغلاق الكتابة: 403 writes_disabled", s === 403 && b.error?.code === "writes_disabled", [s, b]);
ok("ولم يُنفَّذ شيء وصار المعلَّق مرفوضاً", sql("SELECT status FROM cm_orders WHERE ref='W-1002'").status === "nouvelle" && sql("SELECT state FROM lr_pending WHERE id=?", P.id).state === "rejected");
cfg.LAURA_WRITES = "on"; [, b] = await chat("أكد الطلب W-1003", OW); const P2 = b.pending?.[0]; cfg.LAURA_WRITES = ""; [s, b] = await confirm(P2.id, false, OW);
ok("الرفض الصريح لمعلَّق يبقى ممكناً حتى والكتابة مغلقة", s === 200 && b.state === "rejected", [s, b]);
/* صرامة القيمة: فقط on */
for (const v of ["yes", "true", "1", "off", "onn"]) { cfg.LAURA_WRITES = v; [, b] = await call("GET", "/v1/laura/health", null, A.key, {}, OW); ok(`LAURA_WRITES="${v}" لا يفتح الكتابة`, b.writes_enabled === false); }
cfg.LAURA_WRITES = " ON "; [, b] = await call("GET", "/v1/laura/health", null, A.key, {}, OW); ok('LAURA_WRITES=" ON " (حالة/مسافات) يفتحها', b.writes_enabled === true);
cfg.LAURA_WRITES = "on"; [, b] = await call("GET", "/v1/laura/tools", null, A.key, {}, OW); ok("مع on: أدوات الكتابة تظهر (27 أداة للمالك)", b.tools.length === 27 && b.tools.some((t) => t.tier === "write"), b.tools.length);
done();
