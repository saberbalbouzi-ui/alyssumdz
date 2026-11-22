/* السلسلة الكاملة للهوية: الوسيط platform-proxy الحقيقي (index.ts بعد تجريد الأنواع، مع Deno مُحاكى) ← Worker حقيقي (وحدات حقيقية + D1 محلية) ← نموذج محاكى.
   الجلسة: staff_me/is_admin مُحاكاة (Supabase غير متاح محلياً)؛ كل ما عداها (توقيع الهوية، بوابة المسارات، التحويل، فحص الـWorker) الشيفرة الفعلية. */
import { makeEnv, Tally } from "./_harness.mjs";
import { commerce } from "../src/modules/commerce.js"; import { carts } from "../src/modules/carts.js"; import { laura } from "../src/modules/laura.js";
import { verifyActor } from "../src/laura/actor.js"; import { createMock, KEY } from "./_mock_llm.mjs";
import { claimsFromStaffMe, signActor, isLauraPath } from "../../supabase/functions/platform-proxy/laura-actor.ts";
const { ok, done } = Tally(), SECRET = "proxy-actor-secret-0123456789abcd";
/* 1) وحدة الهوية (TS) ↔ المُتحقِّق (JS) */
const now = Math.floor(Date.now() / 1000);
const c1 = claimsFromStaffMe({ owner: true, email: "Owner@X.dz", name: "المالك" }, 7, now), c2 = claimsFromStaffMe({ owner: false, role: "agent", email: "a@x.dz", perms: ["orders", "orders.write", "BAD PERM", 5, "callcenter"] }, 7, now);
ok("المالك: perms=['*'] والبريد صغير الحروف", c1.role === "owner" && c1.perms.join() === "*" && c1.sub === "owner@x.dz" && c1.tid === 7);
ok("الموظف: perms مُنقّاة (أنماط غير صالحة تُسقَط)", c2.role === "agent" && c2.perms.join() === "orders,orders.write,callcenter", c2.perms);
ok("بلا دور/بلا بريد/مستأجر غير صالح: لا هوية", claimsFromStaffMe({ role: null, email: "x@x" }, 7, now) === null && claimsFromStaffMe({ owner: true }, 7, now) === null && claimsFromStaffMe({ owner: true, email: "o@x" }, 0, now) === null && claimsFromStaffMe(null, 7, now) === null);
const tok = await signActor(SECRET, c2), v = await verifyActor(SECRET, tok, { tenantId: 7, nowS: now });
ok("توقيع TS يُقبل في مُتحقِّق الـWorker (توافق الصيغة)", v.ok && v.claims.role === "agent" && v.claims.perms.join() === "orders,orders.write,callcenter", v);
ok("سرّ مختلف/تعديل الحمولة/مستأجر آخر ← مرفوض", !(await verifyActor("other-secret-0123456789abcdef", tok, { tenantId: 7, nowS: now })).ok && !(await verifyActor(SECRET, tok.replace(/\.[^.]+\./, "." + Buffer.from(JSON.stringify({ ...c1, v: 1 })).toString("base64url") + "."), { tenantId: 7, nowS: now })).ok && !(await verifyActor(SECRET, tok, { tenantId: 8, nowS: now })).ok);
const allowed = [["POST", "/v1/laura/chat"], ["POST", "/v1/laura/confirm"], ["GET", "/v1/laura/tools"], ["GET", "/v1/laura/health"], ["GET", "/v1/laura/history"], ["POST", "/v1/laura/reset"]], denied = [["POST", "/v1/laura/history"], ["GET", "/v1/laura/reset"], ["DELETE", "/v1/laura/history"], ["GET", "/v1/laura/chat"], ["POST", "/v1/laura/chat/x"], ["POST", "/v1/laura/../admin/tenants"], ["DELETE", "/v1/laura/chat"], ["POST", "/v1/laura/tools"], ["POST", "/admin/tenants"]];
ok("بوابة مسارات LAURA في الوسيط: المسموح فقط", allowed.every(([m, p]) => isLauraPath(m, p)) && denied.every(([m, p]) => !isLauraPath(m, p)));
/* 2) الوسيط الحقيقي (index.ts) ← Worker حقيقي */
const mock = createMock(), E = makeEnv([commerce, carts, laura], { config: { LAURA_LLM_KEY: KEY, LAURA_ACTOR_SECRET: SECRET } }); E.fake.handler = mock.handler;
E.clock.t = Date.now(); const T = await E.tenant("Site"), nowFix = () => Math.floor(E.clock.t / 1000);
await E.adm("PATCH", `/admin/tenants/${T.id}`, { settings: { origins: ["https://shop.example"] } });
await E.call("PUT", "/v1/catalog/products", { products: [{ slug: "cream", title: "كريم", price: 1500, stock: 20, offers: [] }] }, T.key);
const pk = (await E.adm("POST", `/admin/tenants/${T.id}/keys`, { scopes: ["order:create"], mode: "pub" }))[1].key;
await E.call("POST", "/v1/orders", { ref: "W-3001", customer: { name: "أمين بن علي", phone: "0551234567" }, wilaya: "Alger", commune: "x", dtype: "home", items: [{ slug: "cream", qty: 1, price: 1500 }], subtotal: 1500, discount: 0, fee: 600, total: 2100 }, pk, {}, { origin: "https://shop.example" });
const SESS = { "owner-jwt": { owner: true, email: "owner@x.dz", name: "المالك" }, "agent-jwt": { owner: false, role: "agent", email: "agent@x.dz", perms: ["orders", "orders.write", "callcenter"] }, "fired-jwt": { role: null }, "acct-jwt": { owner: false, role: "accountant", email: "acc@x.dz", perms: ["orders", "analytics", "finance", "customers"] } };
const upstream = []; globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: "https://sb.example", SUPABASE_ANON_KEY: "anon", PLATFORM_URL: "https://pf.example", PLATFORM_KEY: T.key, LAURA_ACTOR_SECRET: SECRET, PLATFORM_TENANT_ID: String(T.id) }[k]) }, serve: (h) => { globalThis.__proxy = h; } };
const realFetch = globalThis.fetch; globalThis.fetch = async (url, init = {}) => {
  url = String(url); const auth = (init.headers?.Authorization ?? "").replace("Bearer ", "");
  if (url === "https://sb.example/rest/v1/rpc/staff_me") { const me = SESS[auth]; return new Response(JSON.stringify(me ?? { role: null }), { status: me ? 200 : 401 }); }
  if (url === "https://sb.example/rest/v1/rpc/is_admin") return new Response(JSON.stringify(!!SESS[auth]?.owner), { status: 200 });
  if (url.startsWith("https://pf.example")) { const u = new URL(url), hd = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])); upstream.push({ path: u.pathname, hd }); const r = await E.app.handle(init.method ?? "GET", u.pathname, Object.fromEntries(u.searchParams), hd, init.body ?? "", "2.2.2.2"); return new Response(r.body, { status: r.status, headers: r.headers }); }
  return realFetch(url, init);
};
await import("../../supabase/functions/platform-proxy/index.ts?x=1");
const proxy = async (jwt, method, path, body, query) => { E.clock.t += 4000; const r = await globalThis.__proxy(new Request("https://fn.example/platform-proxy", { method: "POST", headers: { Authorization: "Bearer " + jwt, "Content-Type": "application/json" }, body: JSON.stringify({ method, path, body, query }) })); return [r.status, await r.json()]; };
let [s, b] = await proxy("owner-jwt", "POST", "/v1/laura/chat", { message: "كم طلب لدي؟" });
ok("مالك عبر الوسيط ← Worker: ردّ LAURA من بيانات حقيقية", s === 200 && b.ok && b.status === 200 && /لديك 1 طلباً/.test(b.data.reply) && b.data.actor.role === "owner" && b.data.actor.signed === true, b);
ok("الوسيط أرسل مفتاح الموقع + ترويسة الهوية الموقَّعة (لا شيء من المتصفح)", upstream.at(-1).hd.authorization === "Bearer " + T.key && /^v1\./.test(upstream.at(-1).hd["x-laura-actor"]));
[s, b] = await proxy("agent-jwt", "POST", "/v1/laura/chat", { message: 'TEST_CALL:products_list:{}' }); ok("موظف: صلاحياته الفعلية تُفرض (أداة المنتجات محجوبة)", b.data.tools[0].code === "forbidden" && b.data.actor.role === "agent", b.data);
[s, b] = await proxy("agent-jwt", "GET", "/v1/laura/tools"); ok("موظف: قائمة أدواته محصورة", b.data.tools.map((t) => t.name).sort().join() === "cart_set_status,carts_list,carts_summary,digital_orders,order_cancel,order_confirm,orders_list,orders_stats,sources_stats", b.data);
[s, b] = await proxy("fired-jwt", "POST", "/v1/laura/chat", { message: "كم طلب" }); ok("موظف بلا دور/معطَّل: 401 قبل الوصول للـWorker", s === 401 && upstream.at(-1).path !== "/v1/laura/chat" || s === 401, [s, b]);
const nUp = upstream.length; [s] = await proxy("nobody-jwt", "POST", "/v1/laura/chat", { message: "x" }); ok("جلسة مجهولة: 401 ولا طلب للـWorker", s === 401 && upstream.length === nUp);
/* الكتابة عبر السلسلة: موافقة صريحة بنفس هوية الجلسة */
[, b] = await proxy("owner-jwt", "POST", "/v1/laura/chat", { message: "أكد الطلب W-3001" }); const P = b.data.pending[0]; ok("طلب تأكيد عبر الوسيط: معلّق ولم يُنفَّذ", b.data.state === "awaiting_approval" && E.sql("SELECT status FROM cm_orders WHERE ref='W-3001'").status === "nouvelle", b.data);
[s, b] = await proxy("agent-jwt", "POST", "/v1/laura/confirm", { id: P.id, approve: true }); ok("موظف آخر لا يوافق على إجراء المالك (403)", b.status === 403 && E.sql("SELECT status FROM cm_orders WHERE ref='W-3001'").status === "nouvelle", b);
[s, b] = await proxy("owner-jwt", "POST", "/v1/laura/confirm", { id: P.id, approve: true }); ok("المالك يوافق: تنفيذ + تحقق", b.data.state === "done" && b.data.verified === true && E.sql("SELECT status FROM cm_orders WHERE ref='W-3001'").status === "confirmee", b.data);
/* مسارات أخرى: السلوك القديم محفوظ */
[s, b] = await proxy("agent-jwt", "GET", "/v1/orders"); ok("مسار غير LAURA: ما زال للمالك فقط (الموظف 401)", s === 401);
[s, b] = await proxy("owner-jwt", "GET", "/v1/orders"); ok("مسار غير LAURA للمالك: يعمل كما كان", s === 200 && b.status === 200 && b.data.orders.length === 1);
[s, b] = await proxy("owner-jwt", "POST", "/v1/laura/evil", {}); ok("مسار LAURA غير مسموح: path_not_allowed", s === 400 && b.error === "path_not_allowed", [s, b]);
globalThis.fetch = realFetch; done();
