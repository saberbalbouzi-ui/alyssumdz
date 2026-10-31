/* V-01 — عزل المستأجرين (A/B): اختبارات موجّهة. الفاحص العام (كل مسار × معرّفات A بمفتاح B + مقارنة قاعدة البيانات) في isolation-fuzz.test.mjs.
   يغطي: النطاقات والمفاتيح العامة والأصل، الموقوف/الملغى، Idempotency، عدم خلط الأحداث والمعالجات، التزوير بالأحداث (إلغاء/تسليم/دفع لطلب مستأجر آخر)،
   التشفير المرتبط بالمستأجر (aad)، بلاغات الاحتيال المجمّعة، الكتالوجات المشتركة. */
import { makeEnv, Tally } from "./_harness.mjs";
import { ALL } from "./_all.mjs";
const { ok, done } = Tally();
const E = makeEnv(ALL); const { call, adm, tenant, app, sql, sqlAll, fake, clock, vault, db } = E;
const A = await tenant("A"), B = await tenant("B");
const ORIGIN_A = "https://a.shop.dz", ORIGIN_B = "https://b.shop.dz";
await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: [ORIGIN_A], order_mode: "enforce" } });
await adm("PATCH", `/admin/tenants/${B.id}`, { settings: { origins: [ORIGIN_B], order_mode: "enforce" } });
const pub = async (T, scopes) => (await adm("POST", `/admin/tenants/${T.id}/keys`, { scopes, mode: "pub" }))[1].key;
const pubA = await pub(A, ["order:create", "fraud:check", "cart:capture"]), pubB = await pub(B, ["order:create", "fraud:check", "cart:capture"]);
const tick = () => { clock.t += 1000; db.exec("DELETE FROM pf_rl"); };
const [, spec] = await call("GET", "/openapi.json");
const routes = []; for (const [p, ms] of Object.entries(spec.paths)) for (const [m, d] of Object.entries(ms)) if (d.security) routes.push({ m: m.toUpperCase(), p, scope: d["x-scope"] });
const fill = (p) => p.replace(/\{[a-z]+\}/g, "1");

/* 1) مصادقة: بلا مفتاح/مفتاح مزوَّر ← 401 على كل المسارات المحمية، ولا يتسرب شيء */
{ let bad = [];
  for (const r of routes) { tick(); const [s0] = await call(r.m, fill(r.p), r.m === "GET" ? null : {}, null); tick(); const [s1] = await call(r.m, fill(r.p), r.m === "GET" ? null : {}, "pk_live_" + "0".repeat(40)); if (s0 !== 401 || s1 !== 401) bad.push(`${r.m} ${r.p} ${s0}/${s1}`); }
  ok(`بلا مفتاح أو بمفتاح مزوَّر ← 401 على ${routes.length} مساراً محمياً`, bad.length === 0, bad.slice(0, 5)); }

/* 2) النطاقات: مفتاح بنطاق واحد غير ذي صلة ← 403 على كل مسار يتطلب نطاقاً آخر */
{ const [, k] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["modules:read"] }); let bad = [];
  for (const r of routes) { if (!r.scope || r.scope === "modules:read") continue; tick(); const [s] = await call(r.m, fill(r.p), r.m === "GET" ? null : {}, k.key); if (s !== 403) bad.push(`${r.m} ${r.p} ${s}`); }
  ok("مفتاح نطاقه modules:read فقط ← 403 على كل مسار بنطاق آخر", bad.length === 0, bad.slice(0, 5)); }

/* 3) المفتاح العام pk_pub_: لا يعمل إلا لنطاقات عامة، وبأصل مسجَّل للمستأجر نفسه */
{ let bad = [], n = 0;
  const [, kp] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["*"], mode: "pub" }).then(([s, b]) => [s, b]);
  ok("المفتاح العام لا يُصدَر بنطاقات غير عامة (*)", (await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["*"], mode: "pub" }))[0] === 400);
  for (const r of routes) { if (!r.scope || ["order:create", "fraud:check", "cart:capture"].includes(r.scope)) continue; n++; tick(); const [s] = await call(r.m, fill(r.p), r.m === "GET" ? null : {}, pubA, {}, { origin: ORIGIN_A }); if (s !== 403) bad.push(`${r.m} ${r.p} ${s}`); }
  ok(`مفتاح عام صالح وأصل صحيح ← 403 على ${n} مساراً بنطاق غير عام`, bad.length === 0, bad.slice(0, 5));
  tick(); const body = { phone: "0551234567", total: 1000 };
  ok("مفتاح A العام بأصل B ← 403 origin_not_allowed", (await call("POST", "/v1/fraud/check", body, pubA, {}, { origin: ORIGIN_B }))[0] === 403);
  tick(); ok("مفتاح B العام بأصل A ← 403", (await call("POST", "/v1/fraud/check", body, pubB, {}, { origin: ORIGIN_A }))[0] === 403);
  tick(); ok("مفتاح عام بلا Origin ← 403", (await call("POST", "/v1/fraud/check", body, pubA))[0] === 403);
  tick(); ok("مفتاح عام بأصل صحيح ← 200", (await call("POST", "/v1/fraud/check", body, pubA, {}, { origin: ORIGIN_A }))[0] === 200);
  tick(); ok("أصل مشابه بنطاق فرعي أو بروتوكول مختلف ← 403", (await call("POST", "/v1/fraud/check", body, pubA, {}, { origin: "https://evil.a.shop.dz" }))[0] === 403 && (await call("POST", "/v1/fraud/check", body, pubA, {}, { origin: "http://a.shop.dz" }))[0] === 403); }

/* 4) المفتاح الملغى والمستأجر الموقوف */
{ const T = await tenant("C"); tick(); ok("مفتاح C يعمل", (await call("GET", "/v1/modules", null, T.key))[0] === 200);
  const [, ks] = await adm("POST", `/admin/tenants/${T.id}/keys`, { scopes: ["*"] }); const id = sql("SELECT id FROM pf_keys WHERE tenant_id=? ORDER BY id DESC", T.id).id;
  await adm("DELETE", `/admin/keys/${id}`); tick(); ok("مفتاح ملغى ← 401", (await call("GET", "/v1/modules", null, ks.key))[0] === 401);
  await adm("PATCH", `/admin/tenants/${T.id}`, { status: "suspended" }); tick(); ok("مستأجر موقوف ← 401 لكل مفاتيحه", (await call("GET", "/v1/modules", null, T.key))[0] === 401);
  await adm("PATCH", `/admin/tenants/${T.id}`, { status: "active" }); tick(); ok("إعادة التفعيل تعيد العمل", (await call("GET", "/v1/modules", null, T.key))[0] === 200);
  tick(); ok("إيقاف C لا يمسّ A", (await call("GET", "/v1/modules", null, A.key))[0] === 200); }

/* 5) Idempotency-Key: نفس المفتاح من مستأجرين مختلفين لا يعيد ردّ الآخر */
{ const k = "same-key-123", ev = (T, id) => call("POST", "/v1/events", { type: "order.created", id, data: { order_id: id, total: 100 } }, T.key, {}, { "idempotency-key": k });
  tick(); const [sa, ba] = await ev(A, "IDEM-A"); tick(); const [sb, bb, hb] = await ev(B, "IDEM-B");
  ok("نفس Idempotency-Key لدى B ينفَّذ فعلاً (لا replay من A)", sa === 202 && sb === 202 && !hb["Idempotent-Replayed"], [sa, sb, hb]);
  ok("الحدثان في صندوق كل مستأجر على حدة", sql("SELECT COUNT(*) n FROM pf_events WHERE tenant_id=? AND ext_id LIKE 'order.created:IDEM-A'", A.id).n === 1 && sql("SELECT COUNT(*) n FROM pf_events WHERE tenant_id=? AND payload LIKE '%IDEM-A%'", B.id).n === 0); }

/* 6) التشفير مرتبط بالمستأجر: نسخ نص مشفَّر من A إلى B لا يُفكّ */
{ tick(); await call("PUT", "/v1/integrations/llm", { config: {}, secrets: { api_key: "A-SECRET-KEY" } }, A.key); await call("PUT", "/v1/integrations/llm", { config: {}, secrets: { api_key: "B-SECRET-KEY" } }, B.key);
  ok("A يقرأ سرّه", (await app.ctx.integration(A.id, "llm")).secrets.api_key === "A-SECRET-KEY");
  const encA = sql("SELECT secret_enc e FROM pf_integrations WHERE tenant_id=? AND provider='llm'", A.id).e;
  db.prepare("UPDATE pf_integrations SET secret_enc=? WHERE tenant_id=? AND provider='llm'").run(encA, B.id);
  let leaked = null; try { leaked = (await app.ctx.integration(B.id, "llm")).secrets.api_key; } catch { /* المتوقع: فشل فك التشفير */ }
  ok("سرّ A منسوخاً إلى صف B لا يُفكّ (aad مربوط بالمستأجر)", leaked === null, leaked);
  tick(); const [, l] = await call("GET", "/v1/integrations", null, B.key); ok("GET /v1/integrations لا يكشف أسراراً", !JSON.stringify(l).includes("SECRET")); }

/* 7) PII الطلبات: الهاتف المشفَّر لا يُفكّ في سياق مستأجر آخر */
{ for (const [T, pk, o] of [[A, pubA, ORIGIN_A], [B, pubB, ORIGIN_B]]) { tick(); await call("PUT", "/v1/catalog/products", { products: [{ slug: "x", title: "X", price: 1000, stock: 10, offers: [] }] }, T.key); }
  tick(); const mk = (pk, o, ref, phone) => call("POST", "/v1/orders", { ref, customer: { name: "زبون", phone }, wilaya: "Alger", commune: "Kouba", dtype: "home", items: [{ slug: "x", qty: 1, price: 1000 }], subtotal: 1000, discount: 0, fee: 0, total: 1000 }, pk, {}, { origin: o });
  const [sa] = await mk(pubA, ORIGIN_A, "ISO-A1", "0551111111"); tick(); const [sb] = await mk(pubB, ORIGIN_B, "ISO-B1", "0662222222");
  ok("طلبان بمرجعين في مستأجرين", sa === 201 && sb === 201, [sa, sb]);
  tick(); const [, la] = await call("GET", "/v1/orders", null, A.key); tick(); const [, lb] = await call("GET", "/v1/orders", null, B.key);
  const refs = (j) => (j.orders ?? j.items ?? []).map((o) => o.ref);
  ok("كل مستأجر يرى طلبه فقط", refs(la).join() === "ISO-A1" && refs(lb).join() === "ISO-B1", [refs(la), refs(lb)]);
  const encA = sql("SELECT phone_enc e FROM cm_orders WHERE ref='ISO-A1'").e; db.prepare("UPDATE cm_orders SET phone_enc=? WHERE ref='ISO-B1'").run(encA);
  tick(); const [, lb2] = await call("GET", "/v1/orders", null, B.key);
  ok("هاتف A منسوخاً إلى طلب B لا يظهر", !JSON.stringify(lb2).includes("0551111111") && !JSON.stringify(lb2).includes("551111111"), JSON.stringify(lb2).slice(0, 200));
  /* نفس المرجع في مستأجرين لا يتصادم */
  tick(); const [s1] = await mk(pubA, ORIGIN_A, "SAME-REF", "0551234567"); tick(); const [s2] = await mk(pubB, ORIGIN_B, "SAME-REF", "0551234567");
  ok("نفس المرجع لدى مستأجرين مختلفين مقبول لكليهما", s1 === 201 && s2 === 201, [s1, s2]); }

/* 8) تزوير بالأحداث: B يصدر إلغاء/تسليم/دفعاً لمرجع طلب A — لا أثر على A */
{ const stockA = () => sql("SELECT stock s FROM cm_skus WHERE tenant_id=? AND slug='x'", A.id).s, ordA = () => sql("SELECT status s, reserved r FROM cm_orders WHERE tenant_id=? AND ref='SAME-REF'", A.id);
  const s0 = stockA(), o0 = ordA(), wl0 = JSON.stringify(sqlAll("SELECT * FROM wl_escrow WHERE tenant_id=?", A.id)), rs0 = JSON.stringify(sqlAll("SELECT * FROM cm_resv WHERE tenant_id=?", A.id));
  for (const type of ["order.cancelled", "order.failed", "order.confirmed", "order.delivered", "order.returned", "payment.confirmed", "order.shipped"]) { tick(); await call("POST", "/v1/events", { type, id: "FORGE-" + type, data: { order_id: "SAME-REF", total: 1000, amount: 1000 } }, B.key); }
  await app.cron();
  ok("مخزون A لا يتغيّر بأحداث B", stockA() === s0, [s0, stockA()]);
  ok("حالة طلب A وحجزه لا يتغيّران", JSON.stringify(ordA()) === JSON.stringify(o0), [o0, ordA()]);
  ok("ضمان/حجوزات A لا تتغيّر", JSON.stringify(sqlAll("SELECT * FROM wl_escrow WHERE tenant_id=?", A.id)) === wl0 && JSON.stringify(sqlAll("SELECT * FROM cm_resv WHERE tenant_id=?", A.id)) === rs0);
  ok("لا قيد محفظة لـA بفعل B", sql("SELECT COUNT(*) n FROM wl_tx WHERE tenant_id=?", A.id).n === 0);
  tick(); await call("POST", "/v1/events", { type: "order.cancelled", id: "OWN-CANCEL", data: { order_id: "SAME-REF" } }, A.key); await app.cron();
  ok("الضبط: إلغاء A لطلبه يُرجع مخزونه (الاختبار يستطيع كشف الأثر)", stockA() === s0 + 1 || ordA().s !== o0.s, [s0, stockA(), ordA()]); }

/* 9) عدم خلط المعالجات: حدث A لا يُرسَل إلى webhook أو SMS أو CAPI أو مخزن B */
{ const T1 = await tenant("H1"), T2 = await tenant("H2");
  for (const [T, u] of [[T1, "https://hook1.shop.dz/in"], [T2, "https://hook2.shop.dz/in"]]) { tick(); const [s] = await call("POST", "/v1/hooks/endpoints", { url: u, events: ["order.*"] }, T.key); if (s !== 201) console.log("hook reg", s); }
  const snapB = () => JSON.stringify({ d: sqlAll("SELECT id,endpoint_id,event_id FROM hk_deliveries WHERE tenant_id=?", T2.id), sms: sqlAll("SELECT * FROM sms_log WHERE tenant_id=?", T2.id), cl: sqlAll("SELECT * FROM cp_log WHERE tenant_id=?", T2.id), w: sqlAll("SELECT * FROM wl_tx WHERE tenant_id=?", T2.id), dg: sqlAll("SELECT * FROM dg_orders WHERE tenant_id=?", T2.id), pe: sqlAll("SELECT * FROM pay_expect WHERE tenant_id=?", T2.id) });
  const b0 = snapB(); fake.calls.length = 0; fake.handler = () => [200, "{}"];
  tick(); await call("POST", "/v1/events", { type: "order.created", id: "H-1", data: { order_id: "H-1", total: 2500, pay: "baridimob", customer: { phone: "0551234567", name: "ز", email: "z@x.dz" }, items: [{ slug: "k", qty: 1, price: 2500 }] } }, T1.key);
  await app.cron(); await app.cron();
  const urls = fake.calls.map((c) => c.url);
  ok("تسليم webhook إلى رابط T1 فقط", urls.some((u) => u.includes("hook1.shop.dz")) && !urls.some((u) => u.includes("hook2.shop.dz")), urls);
  ok("لا أثر في جداول T2 (webhook/SMS/CAPI/محفظة/رقمي/دفع)", snapB() === b0, [b0, snapB()]);
  ok("pay_expect سُجّل لـT1 فقط", sql("SELECT COUNT(*) n FROM pay_expect WHERE tenant_id=? AND order_id='H-1'", T1.id).n === 1 && sql("SELECT COUNT(*) n FROM pay_expect WHERE tenant_id=? AND order_id='H-1'", T2.id).n === 0);
  tick(); const [, ev2] = await call("GET", "/v1/events", null, T2.key); ok("GET /v1/events لـT2 لا يعرض أحداث T1", !JSON.stringify(ev2).includes("H-1"), JSON.stringify(ev2).slice(0, 160)); fake.handler = null; }

/* 10) الاحتيال: البلاغات مجمّعة (عدد مستأجرين فقط) ولا هوية؛ المحو والاستعلام لا يتجاوزان مستأجرهما */
{ const F1 = await tenant("F1"), F2 = await tenant("F2"), P = "0770123456";
  tick(); await call("POST", "/v1/fraud/report", { phone: P, reason: "refused" }, F1.key);
  tick(); const [, q2] = await call("GET", `/v1/fraud/phone/${P}`, null, F2.key);
  ok("F2 يرى عدد المبلِّغين الآخرين فقط (1) وبلا تفاصيل", q2.otherTenants === 1 && Array.isArray(q2.own) && q2.own.length === 0 && !JSON.stringify(q2).includes("refused") && !/tenant|F1/.test(JSON.stringify(q2)), q2);
  tick(); const [, d2] = await call("DELETE", `/v1/fraud/report/${P}`, null, F2.key); ok("F2 لا يستطيع حذف بلاغ F1", d2.removed === 0 && sql("SELECT COUNT(*) n FROM fr_reports WHERE tenant_id=?", F1.id).n === 1, d2);
  tick(); const [, d1] = await call("DELETE", `/v1/fraud/report/${P}`, null, F1.key); ok("F1 يحذف بلاغه", d1.removed === 1); }

/* 11) السلال المتروكة: لا قراءة ولا مسح عبر المستأجرين */
{ tick(); const c = (pk, o) => call("POST", "/v1/carts/capture", { phone: "0550001111", consent: true, items: [{ title: "x", qty: 1 }], total: 1000 }, pk, {}, { origin: o });
  await c(pubA, ORIGIN_A); tick(); await c(pubB, ORIGIN_B); tick(); await call("DELETE", "/v1/carts/phone/0550001111", null, B.key);
  ok("مسح B لرقمه لا يمسّ سلة A بالرقم نفسه", sql("SELECT COUNT(*) n FROM cr_carts WHERE tenant_id=?", A.id).n === 1 && sql("SELECT COUNT(*) n FROM cr_carts WHERE tenant_id=?", B.id).n === 0);
  clock.t += 20 * 60_000; tick(); const [, la] = await call("GET", "/v1/carts", null, A.key); tick(); const [, lb] = await call("GET", "/v1/carts", null, B.key);
  ok("كل مستأجر يرى سلّته فقط", (la.carts ?? []).length === 1 && (lb.carts ?? []).length === 0, [la, lb]); }

/* 12) كتالوجات مشتركة بالتصميم: لا حقول هوية/أسرار في الاستجابة */
{ const S = await tenant("SUP", ["*"]), AF = await tenant("AFF", ["*"]);
  tick(); await call("PUT", "/v1/marketplace/profile", { name: "SUPPLIER-NAME", about: "x", wilaya: "Alger" }, S.key).catch(() => {});
  tick(); const [sp, pr] = await call("POST", "/v1/marketplace/products", { title: "منتج", price: 2000, commission: 300, stock: 5, category: "عام", descr: "وصف" }, S.key);
  await adm("PUT", `/admin/marketplace/tenants/${S.id}/kind`, { kind: "retail" }).catch(() => {});
  tick(); const [, cat] = await call("GET", "/v1/marketplace/catalog", null, AF.key); const body = JSON.stringify(cat);
  ok("كتالوج السوق لا يكشف أسراراً/هواتف/مفاتيح", !/secret|phone|token|api_key|password|enc"/i.test(body) && sp < 500, [sp, body.slice(0, 200)]);
  tick(); const [, apps] = await call("GET", "/v1/appstore/apps", null, AF.key); ok("كتالوج التطبيقات لا يكشف أسرار webhook/عميل OAuth", !/secret|enc"|client_secret|webhook_secret/i.test(JSON.stringify(apps)), JSON.stringify(apps).slice(0, 200)); }

done();
