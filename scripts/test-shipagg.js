/* اختبار ShipAgg في وضع البوابة (gw) بلا متصفح: vm مع مقابض DOM وAPI وAdmin وهمية.   node scripts/test-shipagg.js */
const fs = require("fs"), vm = require("vm");
let total = 0, fails = 0; const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗ " + n + (x === undefined ? "" : " " + JSON.stringify(x))); } };
const src = fs.readFileSync(__dirname + "/../assets/js/admin-shipagg.js", "utf8");
const calls = [], tracked = [], updates = [], notices = [], slip = [];
let gwReply = (m, p, b, q) => ({ status: 200, data: {} });
const ctx = {
  console, setInterval: () => 0, clearInterval() {}, alert() {}, confirm: () => true, toast() {},
  document: { readyState: "complete", getElementById: () => null, addEventListener() {}, createElement: () => ({ style: {}, classList: { remove() {} } }), head: { appendChild() {} }, body: { appendChild() {} } },
  window: {}, PHPAPI: { on: () => false },
  API: { sb: { enabled: () => true, token: async () => "tok", url: (p) => "https://x.supabase.co" + p, headers: (t) => ({ Authorization: "Bearer " + t }) }, ordersBackend: () => "supabase", updateOrder: (...a) => updates.push(a) },
  WILAYAS: [{ id: 16, name: "Alger" }, { id: 3, name: "Laghouat" }, { id: 59, name: "Aflou" }],
  Admin: { key: "k", orders: [], STATUS_RANK: { nouvelle: 0, confirmee: 1, expediee: 2, livree: 3 },
    wCo: (n) => ({ desks: [{ id: 161, name: "Bab Ezzouar Desk" }] }), trackingOf(o) { const m = String(o.note || "").match(/🚚([a-z0-9_]+):([A-Za-z0-9._-]+)/); return m ? { company: m[1], tracking: m[2] } : null; },
    saveTracking(o, c, t) { tracked.push([o.id, c, t]); o.note = "🚚" + c + ":" + t; }, renderOrders() {}, renderStats() {}, renderShipped() {}, onStatusChange(i, m) { this.orders[i].status = m; }, syncShipping: async () => "orig", deliveryCfg: {}, unsendOrder: async () => "orig-unsend", openLabel: async () => "orig-label", setNoteTag(o, re, t) { o.note = String(o.note || "").replace(re, "") + t; }, showNotice(a, b) { notices.push([a, b]); }, printOrderSlip() { slip.push(1); } },
  fetch: async (url, init) => { const b = JSON.parse(init.body); calls.push(b); const r = gwReply(b.method, b.path, b.body, b.query); return { status: 200, ok: true, json: async () => ({ ok: true, ...r }) }; },
};
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src.replace(/^const ShipAgg =/m, "var ShipAgg ="), ctx);
const SA = ctx.ShipAgg; (async () => {
  ok("الوضع gw", SA.mode() === "gw");
  gwReply = (m, p) => p === "/v1/couriers" ? { status: 200, data: { couriers: [{ courier: "sandbox", label: "S" }, { courier: "yalidine", label: "Yalidine", maturity: "verified", credentials: [{ key: "apiId", label: "API ID", required: true }, { key: "apiToken", label: "Token", required: true }], needsBaseUrl: false }] } } : p === "/v1/connections" ? { status: 200, data: { connections: [{ carrier_code: "yalidine" }] } } : { status: 404, data: {} };
  ok("load يرسم الشركات بلا sandbox", await SA.load() && SA.S.cat.length === 1 && SA.S.cat[0].code === "yalidine" && SA.S.cat[0].fields[1].secret === true && SA.S.on[0].carrier_code === "yalidine", SA.S);
  const o = { id: "F5D05", name: "Amine Bouzid", phone: "0551234567", wilaya: "Alger", commune: "Bab Ezzouar", address: "حي 1", dtype: "home", total: 4900, fee: 400, items: "كريمة ×1 = 4500 DA\nعسل ×1 = 400 DA", status: "confirmee", note: "" };
  const p = SA.gwPayload(o, "yalidine");
  ok("الحمولة: مرجع ورمز ولاية وتوصيل", p.courier === "yalidine" && p.order.reference === "F5D05" && p.order.recipient.wilayaCode === 16 && p.order.codAmount === 4900 && p.order.shippingFee === 400 && p.order.deliveryType === "home" && !p.order.productList.includes("DA"), p);
  const ps = SA.gwPayload({ ...o, id: "a/b c", dtype: "stop", desk: "Bab Ezzouar Desk" }, "yalidine");
  ok("stopdesk: المكتب ومرجع منظَّف", ps.order.deliveryType === "stopdesk" && ps.order.stopDeskId === "161" && ps.order.reference === "a-b-c", ps);
  let err = ""; try { SA.gwPayload({ ...o, dtype: "stop", desk: "؟" }, "yalidine"); } catch (e) { err = e.message; } ok("مكتب مجهول يرمي", /غير معروف/.test(err));
  err = ""; try { SA.gwPayload({ ...o, wilaya: "Nowhere" }, "yalidine"); } catch (e) { err = e.message; } ok("ولاية مجهولة ترمي", /غير معروفة/.test(err));
  /* الإرسال */
  ctx.Admin.orders = [o]; calls.length = 0;
  gwReply = (m, path, b) => path === "/v1/orders" ? { status: 201, data: { reference: b.order.reference, trackingNumber: "yal-ABC", status: "pending" } } : { status: 200, data: {} };
  await SA.send("F5D05", "yalidine");
  ok("الإرسال يستدعي POST /v1/orders ويحفظ التتبع", calls.some((c) => c.method === "POST" && c.path === "/v1/orders") && tracked[0] && tracked[0][2] === "yal-ABC" && o.note === "🚚yalidine:yal-ABC", { calls, tracked });
  /* المزامنة */
  ctx.Admin.orders = [o]; updates.length = 0;
  gwReply = (m, path, b, q) => path === "/v1/orders" ? { status: 200, data: { orders: [{ reference: "F5D05", trackingNumber: "yal-ABC", status: "out_for_delivery" }], next: null } } : { status: 200, data: {} };
  ok("المزامنة: out_for_delivery ← expediee", (await SA.syncGw()) === 1 && o.status === "expediee" && updates[0][2] === "expediee");
  gwReply = (m, path) => path === "/v1/orders" ? { status: 200, data: { orders: [{ reference: "F5D05", trackingNumber: "yal-ABC", status: "pending" }], next: null } } : {};
  ok("المزامنة: لا رجوع للخلف", (await SA.syncGw()) === 0 && o.status === "expediee");
  gwReply = (m, path) => path === "/v1/orders" ? { status: 200, data: { orders: [{ reference: "F5D05", trackingNumber: "yal-ABC", status: "delivered" }], next: null } } : {};
  ok("المزامنة: delivered ← livree", (await SA.syncGw()) === 1 && o.status === "livree");
  ok("owns", SA.owns("yalidine") && !SA.owns("noest"));
  /* التراجع والبوليصة لطرود البوابة */
  { const o2 = { id: "Z1", status: "confirmee", note: "🚚yalidine:yal-ZZ" }; ctx.Admin.orders = [o2]; ctx.window.open = () => ({ location: {}, close() {} }); ctx.Admin.deliveryCfg = {};
    gwReply = (m, path) => path === "/v1/cancel" ? { status: 409, data: { error: { code: "cancel_refused", message: "رفضت" } } } : { status: 200, data: {} };
    await ctx.Admin.unsendOrder(0); ok("التراجع المرفوض يُبقي التتبع", o2.note.includes("🚚yalidine:yal-ZZ") && notices.length === 1, notices);
    gwReply = (m, path) => path === "/v1/cancel" ? { status: 200, data: { ok: true, status: "cancelled" } } : { status: 200, data: {} };
    await ctx.Admin.unsendOrder(0); ok("التراجع المقبول ينزع التتبع", !o2.note.includes("🚚"), o2.note);
    o2.note = "🚚noest:xx"; ok("طرد شركة غير مفعّلة في البوابة يمرّ للأصل", (await ctx.Admin.unsendOrder(0)) === "orig-unsend");
    o2.note = "🚚yalidine:yal-ZZ"; gwReply = (m, path) => path === "/v1/label" ? { status: 404, data: { error: { code: "label_unavailable", message: "x" } } } : { status: 200, data: {} };
    await ctx.Admin.openLabel(0); ok("بوليصة غير متاحة ← وصل الطلب", slip.length === 1); }
  /* دالة غير منشورة */
  ctx.fetch = async () => ({ status: 404, ok: false, json: async () => ({}) }); SA.S.noGw = false;
  ok("404 ← تُخفى البطاقة", (await SA.load()) === false && SA.S.noGw === true && SA.mode() === null);
  /* المعايرة عند أول ربط: حلقة المتابعة حتى done + تقرير بلا حقن HTML */
  {
    let step = 0; ctx.fetch = async (u, init) => { const b = JSON.parse(init.body); calls.push(b); const left = [30, 10, 0][Math.min(step++, 2)]; const sm = { done: left === 0, progress: { left, phase: left ? "geo" : "done" }, communes: { wilayas: 58, mapped: 12, unmatched: 2, undeliverable: 3, fuzzy: 1 }, unmatched_examples: ["<b>Zeralda</b>"], desks: 40, fees: 58, statuses: { seen: 5, unknown: 1 }, verify: { ok: 3, fail: 0 }, warnings: ["<i>تحذير</i>"], notes: [], ping: { ok: true } }; return { status: 200, ok: true, json: async () => ({ ok: true, status: 200, data: { calibration: sm } }) }; };
    SA.S.noGw = false; const box = { innerHTML: "" };
    const sm = await SA.calibrate("yalidine", box, null);
    ok("المعايرة: تتابع حتى done عبر /calibrate", sm && sm.done === true && calls.filter((c) => /\/calibrate$/.test(c.path)).length === 3, calls.slice(-3));
    const rep = SA.calReport(sm);
    ok("التقرير: أرقام البلديات والمكاتب والتعريفة والتتبع", /58/.test(rep) && /12/.test(rep) && /40/.test(rep) && /3<\/b> طرد/.test(rep), rep);
    ok("التقرير: هروب HTML في الأمثلة والتحذيرات", !/<b>Zeralda<\/b>/.test(rep) && /&lt;b&gt;Zeralda/.test(rep) && !/<i>تحذير<\/i>/.test(rep));
    ok("التقرير: بلا معايرة ← عبارة واضحة", /لم تُجرَ/.test(SA.calReport(null)));
  }
  /* بلاغات المعايرة للإدارة: صامتة، مرة واحدة، ولا تظهر عند الزبون */
  {
    const sent = []; const store = {};
    ctx.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
    ctx.location = { origin: "https://shop.example", hostname: "shop.example" };
    ctx.CONFIG = { SITE: { name: "Boutique X" } };
    ctx.SaasClient = { on: () => true, send: async (o) => { sent.push(o); return { ok: true, num: 1 }; } };
    const sm = { done: true, ping: { ok: true }, communes: { unmatched: 2 }, unmatched_examples: ["Zeralda"], statuses: { unknown: 1 }, verify: { ok: 2, fail: 0 }, warnings: ["تحذير"], webhook: { empty: 1 } };
    ok("calIssues: يجمع المشاكل", SA.calIssues(sm).length >= 4 && SA.calIssues({ done: true, ping: { ok: true }, communes: {}, statuses: {}, warnings: [] }).length === 0);
    await SA.reportIssues("yalidine", "Yalidine", sm);
    ok("البلاغ: يُرسل صامتاً إلى الإدارة بنوع تقني", sent.length === 1 && sent[0].silent === true && sent[0].payload.type === "carrier_calibration" && /Zeralda/.test(sent[0].body) && /Boutique X/.test(sent[0].subject), sent);
    await SA.reportIssues("yalidine", "Yalidine", sm); ok("البلاغ نفسه لا يتكرر", sent.length === 1);
    await SA.reportIssues("noest", "NOEST", { done: true, ping: { ok: true }, communes: {}, statuses: {}, warnings: [] }); ok("بلا مشاكل ← لا بلاغ", sent.length === 1);
    ctx.SaasClient = { on: () => true, send: async () => ({ ok: false, err: "net" }) }; await SA.reportIssues("maystro", "Maystro", sm);
    ok("فشل الإرسال ← يُحفظ في الصندوق للمحاولة لاحقاً", JSON.parse(store.alyssum_cal_outbox).length === 1);
  }
  /* قرارات الإدارة: تُجلب من المنصة وتُدمج في البوابة مرة واحدة لكل بصمة */
  {
    const seen = []; ctx.fetch = async (u, init) => { const b = JSON.parse(init.body); seen.push(b); return { status: 200, ok: true, json: async () => ({ ok: true, status: 200, data: { changed: 1, couriers: [], connections: [] } }) }; };
    ctx.SaasClient = { on: () => true, send: async () => ({ ok: true }), fixes: async () => [{ c: "yalidine", n: "x y", u: "returned" }, { c: "noest", n: "z", u: "delivered" }] };
    SA.S.on = [{ carrier_code: "yalidine" }]; delete ctx.localStorage.__h; ctx.localStorage.setItem("alyssum_fixes_h", "");
    await SA.syncFixes();
    const post = seen.find((b) => b.path === "/v1/connections/fixes");
    ok("syncFixes: يرسل قرارات شركاتي فقط", post && post.body.fixes.length === 1 && post.body.fixes[0].c === "yalidine", seen);
    seen.length = 0; await SA.syncFixes(); ok("syncFixes: لا تكرار لنفس البصمة", !seen.some((b) => b.path === "/v1/connections/fixes"));
  }
  /* لوحة المزوّد (saas/shipping.js) */
  {
    const src2 = fs.readFileSync(__dirname + "/../saas/shipping.js", "utf8"), sent = [];
    const root = { innerHTML: "", querySelector: () => null }, c2 = { console, alert() {}, prompt: () => null, confirm: () => true, setTimeout, document: { getElementById: () => null }, window: { SAAS_CFG: { URL: "https://x.supabase.co", KEY: "pk" } } };
    c2.window.window = c2.window; c2.fetch = async (u, init) => { const b = JSON.parse(init.body); sent.push(b); const d = b.path === "/admin/summary" ? { tenants: [{ id: 1, name: "<img src=x onerror=alert(1)>", email: "a@x.dz", site_ref: "alyssumdz", plan: "business", status: "active", orders_day: 10000, today: 9500, last30: 120, orders: 300, connections: 1, vault_max: 50, keys: 2 }] } : b.path === "/admin/plans" ? { plans: [{ id: "business", name: "أعمال", orders_hour: 1000, orders_day: 10000, track_min: 600, vault_max: 50, webhooks: 1, price_dzd: null }] } : { audit: [{ at: "2026-10-12", actor: "<b>x</b>", action: "tenant.create", target: "1", detail: "{}" }] }; return { ok: true, json: async () => ({ ok: true, status: 200, data: d }) }; };
    vm.createContext(c2); vm.runInContext(src2, c2); c2.window.SaasShipping.mount(root, async () => "tok"); await new Promise((r) => setTimeout(r, 30));
    ok("المزوّد: يطلب summary/plans/audit عبر ship-admin", ["/admin/summary", "/admin/plans", "/admin/audit"].every((p) => sent.some((b) => b.path === p)));
    ok("المزوّد: الجدول يعرض الاستهلاك", /9500 \/ 10000/.test(root.innerHTML) && /أعمال/.test(root.innerHTML));
    ok("المزوّد: هروب HTML في الاسم والفاعل", !/<img src=x/.test(root.innerHTML) && !/<b>x<\/b>/.test(root.innerHTML) && /&lt;img/.test(root.innerHTML));
    ok("المزوّد: شريط الاستهلاك أحمر عند ≥90%", /#f87171/.test(root.innerHTML));
  }
  /* تبويب «المعايرة» في لوحة المزوّد */
  {
    const src3 = fs.readFileSync(__dirname + "/../saas/calibration.js", "utf8"), rpcs = [];
    const root = { innerHTML: "", querySelector(sel) { return sel.includes("data-cb-sel") ? { value: "returned" } : null; } };
    const issues = [
      { id: "t1", num: 1, status: "new", at: "2026-10-13", site: "Shop A", origin: "https://a.dz", subject: "[معايرة] Yalidine", payload: { type: "carrier_calibration", carrier: "yalidine", issues: ["1 حالة طرد غير معروفة للنظام", "3 بلدية عندنا غير موجودة في قائمة الشركة (مثل: Zeralda)"], unknown: [{ carrier: "yalidine", raw: "Retour <b>en cours</b> (12)", n: 2 }] } },
      { id: "t2", num: 2, status: "new", at: "2026-10-13", site: "Shop B", origin: "https://b.dz", subject: "[معايرة] Yalidine", payload: { type: "carrier_calibration", carrier: "yalidine", issues: ["5 بلدية عندنا غير موجودة في قائمة الشركة (مثل: Zeralda)"], unknown: [{ carrier: "yalidine", raw: "Retour <b>en cours</b> (12)", n: 1 }] } }];
    const sb = { rpc: async (fn, a) => { rpcs.push([fn, a]); return fn === "saas_calib_issues" ? { data: issues } : fn === "saas_fixes_admin" ? { data: [] } : { data: null }; } };
    const c3 = { console, alert() {}, confirm: () => true, setTimeout, document: { getElementById: () => null } }; c3.window = c3; vm.createContext(c3); vm.runInContext(src3, c3);
    c3.window.SaasCalib.mount(root, sb); await new Promise((r) => setTimeout(r, 30));
    ok("المعايرة: تجمّع الحالة المجهولة من موقعين وتهرب HTML", /<b>yalidine<\/b>/.test(root.innerHTML) && !/<b>en cours<\/b>/.test(root.innerHTML) && /&lt;b&gt;en cours/.test(root.innerHTML) && /<td>2<\/td><td>3<\/td>/.test(root.innerHTML), root.innerHTML.slice(0, 900));
    ok("المعايرة: المشكلة الأخرى مجمّعة بعد توحيد الأرقام (موقعان)", /مثل: Zeralda/.test(root.innerHTML) && /<td>2<\/td><td>2<\/td>/.test(root.innerHTML));
    ok("المعايرة: اقتراح «retour» = مرتجع", c3.window.SaasCalib.suggest("Retour en cours") === "returned" && c3.window.SaasCalib.suggest("Tentative échouée") === "failed_attempt" && c3.window.SaasCalib.suggest("xyz") === "");
    { const { normText } = await import("../saas/gateway/src/status.js"); const samples = ["Retour <b>en cours</b> (12)", "Tentative échouée", "Pas encore expédié", "En préparation [2]", "Livré - paiement_ok", "  Œuvre  Ça  ", "وصل  للمركز", "Sortie_en-livraison (3)"];
      ok("تطبيع لوحة المزوّد = تطبيع البوابة/PHP حرفياً", samples.every((x) => c3.window.SaasCalib.norm(x) === normText(x)), samples.map((x) => [c3.window.SaasCalib.norm(x), normText(x)])); }
    await root.onclick({ target: { closest: () => ({ dataset: { cb: "fix", i: "0" } }) } });
    const fx = rpcs.find((r) => r[0] === "saas_fix_set");
    ok("المعايرة: الاعتماد يستدعي saas_fix_set بالتطبيع الصحيح ويغلق التذكرتين", fx && fx[1].p_carrier === "yalidine" && fx[1].p_norm === "retour <b>en cours</b>" && fx[1].p_unified === "returned" && rpcs.filter((r) => r[0] === "saas_reply").length === 2, rpcs);
  }
  console.log(fails ? `\n✗ ${fails} من ${total} فشل` : `✓ ${total} فحصاً ناجحاً`); process.exit(fails ? 1 : 0);
})();
