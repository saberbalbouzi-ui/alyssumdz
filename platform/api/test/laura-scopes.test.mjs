/* نطاقات أدوات الكتابة في LAURA: لكل كتابة نطاق :write خاص بها؛ مفتاح قراءة/محادثة لا يجتاز بوابة النطاق إلى كتابة؛ LAURA_WRITES وموافقة المستخدم شرطان مستقلان.
   النموذج: محاكاة بروتوكولية محلية (ليست نموذجاً حقيقياً). التشغيل: node platform/api/test/laura-scopes.test.mjs */
import { makeEnv, Tally } from "./_harness.mjs";
import { payments } from "../src/modules/payments.js"; import { wallet } from "../src/modules/wallet.js"; import { ads } from "../src/modules/ads.js"; import { commerce } from "../src/modules/commerce.js"; import { carts } from "../src/modules/carts.js"; import { laura } from "../src/modules/laura.js";
import { signActor } from "../src/laura/actor.js"; import { createMock, KEY } from "./_mock_llm.mjs"; import { TOOLS } from "../src/laura/tools.js";
const { ok, done } = Tally(); const SECRET = "actor-secret-0123456789abcdef";
/* 0) ثابت ثابت: كل أداة كتابة بنطاق :write، ولا نطاق قراءة ولا laura:chat */
const W = TOOLS.filter((t) => t.tier === "write");
ok("كل أدوات الكتابة بنطاق :write", W.length > 0 && W.every((t) => /^[a-z]+:write$/.test(t.scope)), W.filter((t) => !/:write$/.test(t.scope)).map((t) => t.name));
ok("لا أداة كتابة بنطاق :read ولا laura:chat", !W.some((t) => /:read$|^laura:chat$/.test(t.scope)));
ok("أدوات المنتجات الثلاث ← catalog:write", ["product_set_stock", "product_set_price", "product_set_free_shipping"].every((n) => TOOLS.find((t) => t.name === n).scope === "catalog:write"));
ok("أدوات الإعدادات الخمس ← laura:write", ["maintenance_set", "announcement_set", "shipping_fee_set", "shipping_zone_set", "payment_method_set"].every((n) => TOOLS.find((t) => t.name === n).scope === "laura:write"));
ok("أدوات القراءة لا تحمل نطاق :write", TOOLS.filter((t) => t.tier === "read").every((t) => !/:write$/.test(t.scope)));

const mk = async (writes) => {
  const mock = createMock(), cfg = { LAURA_LLM_KEY: KEY, LAURA_ACTOR_SECRET: SECRET, LAURA_TIMEOUT_MS: "400", ...(writes ? { LAURA_WRITES: "on" } : {}) };
  const E = makeEnv([commerce, carts, payments, wallet, ads, laura], { config: cfg }); E.fake.handler = mock.handler;
  const { call, adm, tenant, clock, sql } = E, A = await tenant("A"), nowS = () => Math.floor(clock.t / 1000);
  await call("PUT", "/v1/catalog/products", { products: [{ slug: "honey", title: "عسل", price: 2400, stock: 3, offers: [] }] }, A.key);
  const key = async (scopes) => (await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes }))[1].key;
  const OW = async () => ({ "x-laura-actor": await signActor(SECRET, { sub: "u-owner", role: "owner", perms: ["*"], tid: A.id, iat: nowS() - 5, exp: nowS() + 300 }) });
  const chat = async (msg, k, o = {}, h) => { clock.t += 6000; return call("POST", "/v1/laura/chat", { message: msg, caps: ["client_exec"], lang: "ar", ...o }, k, {}, h ?? (await OW())); };
  const confirm = async (id, approve, k) => call("POST", "/v1/laura/confirm", { id, approve }, k, {}, await OW());
  const names = (b) => (b.tools ?? []).map((s) => s.name + (s.ok ? "" : "!" + s.code)).join();
  const price = async () => sql("SELECT price FROM cm_skus WHERE tenant_id=? AND slug='honey' AND vkey=''", A.id)?.price;
  return { call, A, key, OW, chat, confirm, names, price, sql };
};
const SN = { maintenance: { on: false, msg: "" }, announcement: { show: true, text: "", bg: "", color: "" } };

/* 1) مفتاح catalog:read (+laura:chat) مع LAURA_WRITES=on */
{ const T = await mk(true), rk = await T.key(["laura:chat", "catalog:read"]), wk = await T.key(["laura:chat", "catalog:read", "catalog:write"]);
  let [, b] = await T.call("GET", "/v1/laura/tools", null, rk, { caps: "client_exec" }, await T.OW());
  ok("catalog:read: يرى products_list فقط ولا يرى أي أداة كتابة", b.tools.some((t) => t.name === "products_list") && !b.tools.some((t) => t.tier === "write"), b.tools?.map((t) => t.name));
  [, b] = await T.chat('TEST_CALL:products_list:{}', rk); ok("catalog:read: قراءة المنتجات تعمل", T.names(b) === "products_list", b);
  for (const [n, a] of [["product_set_price", '{"slug":"honey","price":1}'], ["product_set_stock", '{"slug":"honey","stock":9}'], ["product_set_free_shipping", '{"slug":"honey","free":true}']]) {
    [, b] = await T.chat(`TEST_CALL:${n}:${a}`, rk, { settings: SN }); ok(`catalog:read: ${n} مرفوضة بلا إجراء معلّق`, /!(forbidden|unknown_tool)/.test(T.names(b)) && b.pending.length === 0, b);
  }
  ok("السعر لم يتغيّر", (await T.price()) === 2400);
  /* مفتاح catalog:write: يظهر الإجراء معلّقاً فقط — لا تنفيذ قبل الموافقة */
  [, b] = await T.chat('TEST_CALL:product_set_price:{"slug":"honey","price":2600}', wk); const P = b.pending?.[0]; ok("catalog:write: إجراء معلّق وليس منفَّذاً", !!P && P.tool === "product_set_price" && (await T.price()) === 2400, b);
  const rows = await T.sql("SELECT state FROM lr_pending WHERE id=?", P.id); ok("حالة المعلّق pending قبل الموافقة", rows?.state === "pending" || rows?.[0]?.state === "pending", rows);
  /* الموافقة بمفتاح قراءة (نطاق سُحب) تُرفض عند التأكيد حتى لو أُنشئ المعلّق بمفتاح الكتابة */
  let [s, d] = await T.confirm(P.id, true, rk); ok("تأكيد معلّق بمفتاح catalog:read: 403 forbidden", s === 403 && d.error?.code === "forbidden", d);
  [s, d] = await T.confirm(P.id, true, wk); ok("تأكيد بمفتاح catalog:write: أمر موقَّع للّوحة (لا تنفيذ على الخادم)", s === 200 && d.state === "client_exec", d);
  ok("الخادم لم يغيّر السعر بنفسه", (await T.price()) === 2400);
  /* محاولات تجاوز: نطاقات/هوية يرسلها العميل في الجسم أو الترويسة لا تُغيّر شيئاً */
  [, b] = await T.chat('TEST_CALL:product_set_price:{"slug":"honey","price":5}', rk, { scopes: ["*"], scope: "catalog:write", tier: "read", exec: "server" }, { ...(await T.OW()), "x-scopes": "*", "x-laura-scope": "catalog:write" });
  ok("نطاقات في الجسم/الترويسة لا تُرفع الصلاحية", /!(forbidden|unknown_tool)/.test(T.names(b)) && b.pending.length === 0, b);
  [, b] = await T.chat('TEST_CALL:maintenance_set:{"on":true}', rk, { settings: SN }); ok("laura:chat + catalog:read: maintenance_set مرفوضة", /!(forbidden|unknown_tool)/.test(T.names(b)) && b.pending.length === 0, b);
  const lw = await T.key(["laura:chat", "laura:write"]); [, b] = await T.chat('TEST_CALL:maintenance_set:{"on":true}', lw, { settings: SN }); ok("laura:write: maintenance_set معلّقة (لا تنفيذ)", b.pending?.[0]?.tool === "maintenance_set", b);
  [, b] = await T.chat('TEST_CALL:product_set_price:{"slug":"honey","price":3}', lw); ok("laura:write لا يمنح كتابة الكتالوج", /!(forbidden|unknown_tool)/.test(T.names(b)) && b.pending.length === 0, b);
  [, b] = await T.chat('TEST_CALL:order_confirm:{"ref":"X"}', wk); ok("catalog:write لا يمنح أدوات الطلبات", /!(forbidden|unknown_tool)/.test(T.names(b)), b); }

/* 2) LAURA_WRITES غير مضبوط: حتى مفتاح catalog:write لا يرى ولا ينفّذ كتابة */
{ const T = await mk(false), wk = await T.key(["laura:chat", "catalog:read", "catalog:write", "laura:write", "events:write"]);
  let [, b] = await T.call("GET", "/v1/laura/tools", null, wk, { caps: "client_exec" }, await T.OW()); ok("بلا LAURA_WRITES: لا أدوات كتابة تُعرض حتى بمفتاح كتابة", !b.tools.some((t) => t.tier === "write") && b.tools.some((t) => t.name === "products_list"), b.tools?.map((t) => t.name));
  [, b] = await T.chat('TEST_CALL:product_set_price:{"slug":"honey","price":9}', wk); ok("بلا LAURA_WRITES: استدعاء مباشر مرفوض بلا معلّق", /!(forbidden|unknown_tool)/.test(T.names(b)) && b.pending.length === 0 && (await T.price()) === 2400, b); }
done();
