/* تحصين المنصة (تقارير التدقيق 2026-10-31): A-02 limiter ذري، A-03 هوية المنفّذ، A-04 SSRF، A-05 حجز ذرّي، E-01 فهرس المسارات، E-04 batch. */
import { makeEnv, Tally } from "./_harness.mjs";
import { commerce } from "../src/modules/commerce.js";
import { hooks } from "../src/modules/hooks.js";
import { DB } from "../src/core.js";
import { actorOf, isPrivateIp, resolvesPublic, safeHttpsUrl } from "../src/util.js";
const { ok, done } = Tally();
const E = makeEnv([commerce, hooks]); const { call, adm, tenant, app, sql, sqlAll, fake } = E;
const A = await tenant("A");

/* A-02: نافذة معدّل ذرّية تحت التزامن */
{ const res = await Promise.all(Array.from({ length: 40 }, () => app.ctx.window("race:k", 7, 60))); const pass = res.filter((x) => x === null).length;
  ok("A-02: 40 طلباً متزامناً بحدّ 7 ← يمرّ 7 بالضبط", pass === 7, pass);
  ok("A-02: المرفوض يحمل Retry-After موجباً", res.filter((x) => x !== null).every((x) => x >= 1 && x <= 60));
  E.clock.t += 61_000; ok("A-02: النافذة تنزلق فتُقبل الطلبات بعد انقضائها", (await app.ctx.window("race:k", 7, 60)) === null); }

/* A-03: هوية المنفّذ = بصمة الرمز الموثوقة + وسم غير موثوق لا يزوّر البادئة */
{ const post = (label) => call("POST", "/admin/cron", null, "adm-tok", {}, { "x-actor": label });
  await post("admin#deadbeef/boss"); await post("owner@x.dz"); await post("<script>x</script>");
  const rows = sqlAll("SELECT actor FROM pf_audit WHERE action='cron.manual' ORDER BY id");
  ok("A-03: المنفّذ دائماً يبدأ ببصمة الرمز الحقيقية", rows.length === 3 && rows.every((r) => /^admin#[0-9a-f]{8}(\/|$)/.test(r.actor)));
  const fp = rows[0].actor.slice(6, 14); ok("A-03: محاولة تزوير البصمة لا تغيّرها", rows.every((r) => r.actor.startsWith("admin#" + fp)) && !rows[0].actor.includes("deadbeef/") , rows[0]);
  ok("A-03: الوسم يُنظَّف من الرموز الخطرة", !rows[2].actor.includes("<") && !rows[2].actor.includes(">"), rows[2]);
  ok("A-03: لا ترويسة = بصمة فقط", /^admin#[0-9a-f]{8}$/.test(await actorOf("tok", undefined)));
  const [c] = await call("POST", "/admin/cron", null, "wrong", {}, { "x-actor": "owner" }); ok("A-03: رمز خاطئ 401", c === 401); }

/* A-04: SSRF */
{ const bad = ["http://x.dz/", "https://127.0.0.1/", "https://0x7f.0.0.1/", "https://2130706433/", "https://[::1]/", "https://localhost/", "https://a.internal/", "https://metadata.google.internal/", "https://127.0.0.1.nip.io/", "https://10.0.0.1.sslip.io/", "https://x.dz:8443/", "https://u:p@x.dz/", "https://intranet/", "https://printer.local/"];
  ok("A-04: روابط خطرة كلها مرفوضة", bad.every((u) => !safeHttpsUrl(u)), bad.filter(safeHttpsUrl));
  ok("A-04: رابط عادي مقبول (واختياري المنفذ 443)", safeHttpsUrl("https://hooks.shop.dz/a") && safeHttpsUrl("https://hooks.shop.dz:443/a"));
  const priv = ["127.0.0.1", "10.1.2.3", "172.16.0.9", "172.31.255.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "999.1.1.1"], pub = ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111"];
  ok("A-04: عناوين خاصة/محجوزة كلها تُكتشف", priv.every(isPrivateIp), priv.filter((x) => !isPrivateIp(x)));
  ok("A-04: عناوين عامة لا تُحجب", pub.every((x) => !isPrivateIp(x)), pub.filter(isPrivateIp));
  const dohFor = (map) => async (u) => { const h = new URL(u).searchParams.get("name"), t = new URL(u).searchParams.get("type"); return { status: 200, json: async () => ({ Answer: (map[h] ?? []).filter((a) => (t === "A") === !a.includes(":")).map((a) => ({ type: t === "A" ? 1 : 28, data: a })) }) }; };
  ok("A-04: اسم يحلّ إلى IP خاص (DNS rebinding) مرفوض", (await resolvesPublic("evil.dz", dohFor({ "evil.dz": ["10.0.0.5"] }))) === false);
  ok("A-04: اسم يحلّ إلى عام مقبول", (await resolvesPublic("good.dz", dohFor({ "good.dz": ["93.184.216.34"] }))) === true);
  ok("A-04: اسم يحلّ إلى عام وخاص معاً مرفوض", (await resolvesPublic("mix.dz", dohFor({ "mix.dz": ["93.184.216.34", "127.0.0.1"] }))) === false);
  ok("A-04: اسم بلا إجابة (لا يحلّ) مرفوض", (await resolvesPublic("none.dz", dohFor({}))) === false);
  ok("A-04: فشل خدمة DNS = رفض (يُعاد لاحقاً)", (await resolvesPublic("down.dz", async () => ({ status: 500 }))) === false);
  ok("A-04: بلا خدمة DNS الفحص معطّل (يعتمد فحص الصيغة)", (await resolvesPublic("any.dz", null)) === true);
  /* تسليم webhook فعلي عبر النواة: الوجهة الخاصة لا تُتصل أبداً */
  const E2 = makeEnv([hooks], { config: { dohFor: 0 } }); const T = await E2.tenant("W", ["*"]);
  E2.app.ctx.publicUrl = async (u) => resolvesPublic(new URL(u).hostname, dohFor({ "hooks.evil.dz": ["192.168.0.10"], "hooks.good.dz": ["93.184.216.34"] }), E2.clock.t);
  const mk = async (host) => (await E2.call("POST", "/v1/hooks/endpoints", { url: `https://${host}/h`, events: ["*"] }, T.key))[1];
  const ev = await mk("hooks.evil.dz"), gd = await mk("hooks.good.dz");
  await E2.call("POST", `/v1/hooks/endpoints/${ev.id}/test`, null, T.key); await E2.call("POST", `/v1/hooks/endpoints/${gd.id}/test`, null, T.key);
  E2.fake.calls.length = 0; E2.fake.handler = () => [200, "{}"]; await E2.app.cron();
  ok("A-04: التسليم لوجهة تحلّ إلى IP داخلي لا يُرسل أي طلب", !E2.fake.calls.some((c) => c.url.includes("hooks.evil.dz")) && E2.fake.calls.some((c) => c.url.includes("hooks.good.dz")), E2.fake.calls.map((c) => c.url));
  ok("A-04: سبب الإخفاق مسجّل private_destination", E2.sqlAll("SELECT last_error e FROM hk_deliveries WHERE endpoint_id=?", ev.id).some((r) => r.e === "private_destination")); }

/* A-05: حجز مخزون متعدد الأسطر ذرّي */
{ await call("PUT", "/v1/catalog/products", { products: [{ slug: "a", title: "أ", price: 1000, stock: 5, offers: [] }, { slug: "b", title: "ب", price: 500, stock: 1, offers: [] }, { slug: "c", title: "ج", price: 200, stock: null, offers: [] }] }, A.key);
  await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://shop.example"], order_mode: "enforce" } });
  const [, pk] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["order:create"], mode: "pub" });
  const send = (items, sub) => call("POST", "/v1/orders", { ref: "R-" + Math.random().toString(36).slice(2, 10), customer: { name: "أمين", phone: "0551234567" }, wilaya: "Alger", commune: "Kouba", dtype: "home", items, subtotal: sub, discount: 0, fee: 0, total: sub }, pk.key, {}, { origin: "https://shop.example" });
  const st = (s) => sql("SELECT stock s FROM cm_skus WHERE slug=? AND vkey=''", s).s;
  let [c, b] = await send([{ slug: "a", qty: 2, price: 1000 }, { slug: "b", qty: 2, price: 500 }], 3000);
  ok("A-05: السطر الثاني ناقص ← 409 ولا يتغيّر مخزون السطر الأول", c === 409 && b.error.code === "out_of_stock" && st("a") === 5 && st("b") === 1, { c, a: st("a"), b: st("b") });
  [c] = await send([{ slug: "a", qty: 2, price: 1000 }, { slug: "b", qty: 1, price: 500 }, { slug: "c", qty: 3, price: 200 }], 3100);
  ok("A-05: كل الأسطر كافية ← تُخصم كلها (وغير المتتبَّع لا يُخصم)", c === 201 && st("a") === 3 && st("b") === 0, { c, a: st("a"), b: st("b") });
  [c] = await send([{ slug: "a", qty: 2, price: 1000 }, { slug: "a", qty: 2, price: 1000 }], 4000);
  ok("A-05: سطران لنفس الصنف يُجمعان قبل الفحص (4 > 3 ← 409 بلا خصم)", c === 409 && st("a") === 3, { c, a: st("a") });
  const rs = await Promise.all(Array.from({ length: 6 }, () => send([{ slug: "a", qty: 1, price: 1000 }], 1000)));
  ok("A-05: 6 طلبات متزامنة على 3 قطع ← تُقبل 3 وتُرفض 3 والمخزون صفر لا سالب", rs.filter(([x]) => x === 201).length === 3 && rs.filter(([x]) => x === 409).length === 3 && st("a") === 0, rs.map(([x]) => x)); }

/* A-01: جدول رسوم الشحن الموثوق: الرسم يجب أن يطابق سعر الوجهة؛ الصفر مقبول بمبرّر خادمي فقط */
{ const E4 = makeEnv([commerce]); const T = await E4.tenant("S", ["*"]); await E4.adm("PATCH", `/admin/tenants/${T.id}`, { settings: { origins: ["https://shop.example"], order_mode: "enforce" } });
  const [, pk] = await E4.adm("POST", `/admin/tenants/${T.id}/keys`, { scopes: ["order:create"], mode: "pub" });
  await E4.call("PUT", "/v1/catalog/products", { products: [{ slug: "p", title: "م", price: 1000, stock: 50, offers: [] }, { slug: "fs", title: "ش", price: 800, stock: 50, offers: [], freeShip: true }] }, T.key);
  let [c, b] = await E4.call("PUT", "/v1/catalog/shipping", { rates: [{ wilaya: "Alger", home: 600, stop: 400 }, { wilaya: "Alger", commune: "Kouba", home: 650, stop: 400 }, { wilaya: "Adrar", home: 1200, stop: 900, free_over: 5000 }] }, T.key);
  ok("A-01: مزامنة جدول الرسوم", c === 200 && b.total === 3, b);
  [c, b] = await E4.call("PUT", "/v1/catalog/shipping", { rates: [{ wilaya: "x", home: -5, stop: 1 }] }, T.key); ok("A-01: سعر سالب 422", c === 422);
  const send = (o) => E4.call("POST", "/v1/orders", { ref: "S-" + Math.random().toString(36).slice(2, 10), customer: { name: "أمين", phone: "0551234567" }, wilaya: "Alger", commune: "Bab Ezzouar", dtype: "home", items: [{ slug: "p", qty: 1, price: 1000 }], subtotal: 1000, discount: 0, fee: 600, total: 1600, ...o }, pk.key, {}, { origin: "https://shop.example" });
  [c] = await send({}); ok("A-01: الرسم الصحيح لبلدية بلا سعر خاص (افتراضي الولاية 600) مقبول", c === 201);
  [c, b] = await send({ fee: 0, total: 1000 }); ok("A-01: رسم صفر بلا مبرّر مرفوض (enforce)", c === 422 && b.error.fields.flags.some((f) => f.startsWith("fee_mismatch")), b);
  [c, b] = await send({ fee: 100, total: 1100 }); ok("A-01: رسم أقل من السعر مرفوض", c === 422);
  [c] = await send({ fee: 5000, total: 6000 }); ok("A-01: رسم أعلى من السعر مرفوض", c === 422);
  [c] = await send({ commune: "Kouba", fee: 650, total: 1650 }); ok("A-01: سعر البلدية الخاص يُعتمد", c === 201);
  [c] = await send({ commune: "Kouba", fee: 600, total: 1600 }); ok("A-01: سعر الولاية على بلدية لها سعر خاص مرفوض", c === 422);
  [c] = await send({ dtype: "stop", fee: 400, total: 1400 }); ok("A-01: سعر المكتب مقبول", c === 201);
  [c] = await send({ dtype: "stop", fee: 600, total: 1600 }); ok("A-01: سعر المنزل على طلب مكتب مرفوض", c === 422);
  [c] = await send({ items: [{ slug: "fs", qty: 1, price: 800 }], subtotal: 800, fee: 0, total: 800 }); ok("A-01: صنف بشحن مجاني يقبل الصفر", c === 201);
  [c] = await send({ wilaya: "Adrar", commune: "", items: [{ slug: "p", qty: 5, price: 1000 }], subtotal: 5000, fee: 0, total: 5000 }); ok("A-01: حدّ الشحن المجاني يبرّر الصفر", c === 201);
  [c] = await send({ wilaya: "Adrar", commune: "", items: [{ slug: "p", qty: 2, price: 1000 }], subtotal: 2000, fee: 0, total: 2000 }); ok("A-01: تحت الحدّ الصفر مرفوض", c === 422);
  [c] = await send({ wilaya: "Oran", fee: 700, total: 1700 }); ok("A-01: ولاية بلا سعر موثوق: لا رفض (ضمن max_fee) لكن تُعلَّم لاحقاً", c === 201);
  await E4.adm("PATCH", `/admin/tenants/${T.id}`, { settings: { origins: ["https://shop.example"], order_mode: "observe" } });
  [c, b] = await send({ fee: 0, total: 1000 }); ok("A-01: وضع observe يقبل مع علامة fee_mismatch", c === 201 && b.verified === false); }

/* E-01: فهرس المسارات يحفظ أولوية التسجيل ويطابق الديناميكية */
{ const E3 = makeEnv([]); const T3 = await E3.tenant("R", ["*"]);
  const [c1] = await E3.call("GET", "/v1/modules", null, T3.key); const [c2] = await E3.call("GET", "/v1/nope/zzz", null, T3.key); const [c3] = await E3.call("DELETE", "/admin/keys/999", null, "adm-tok");
  ok("E-01: مسار قائم يُطابق، المجهول 404، والإداري يعمل", c1 === 200 && c2 === 404 && c3 === 200, [c1, c2, c3]); }

/* E-02/E-05: الطابور يتصرّف أكثر من 50 حدثاً، ومهمة وحدة معطوبة لا توقف غيرها، وتُقاس الدورة */
{ let seen = 0; const probe = { id: "probe", routes() { }, on: { "probe.evt": async () => { seen++; } }, async cron() { throw new Error("boom"); } }, good = { id: "good", routes() { }, async cron() { return { ran: true }; } };
  const E5 = makeEnv([probe, good]); const T = await E5.tenant("Q", ["*"]), T2 = await E5.tenant("Q2", ["*"]);
  for (let i = 0; i < 130; i++) await E5.app.ctx.emit(i % 2 ? T.id : T2.id, "probe.evt", { i }, `x:${i}`);
  const out = await E5.app.cron();
  ok("E-02: 130 حدثاً تُصرَّف في دورة واحدة (> دفعة 50)", seen === 130 && out.events === 130, { seen, events: out.events });
  ok("E-05: وحدة cron معطوبة لا توقف الوحدات التالية", out.probe?.error && out.good?.ran === true, out);
  ok("E-02: القياسات: backlog.pending=0 وزمن الدورة مسجَّل", out.backlog && out.backlog.pending === 0 && typeof out.ms === "number" && out.mods && "good" in out.mods, out); }

/* E-04: DB.batch ذري عند توفر D1 batch ويرفض الذرّي بدونه */
{ const db = new DB({ prepare: (s) => ({ bind: (...a) => ({ __sql: s, __a: a, run: async () => ({ meta: {} }) }) }) });
  let threw = false; try { await db.batch([["SELECT 1"]], { atomic: true }); } catch { threw = true; }
  ok("E-04: atomic بلا d1.batch يفشل صراحةً بدل الاستمرار تتابعياً", threw);
  E.db.exec("CREATE TABLE t_b (k TEXT PRIMARY KEY)");
  let err = false; try { await app.db.batch([["INSERT INTO t_b VALUES (?)", "x"], ["INSERT INTO t_b VALUES (?)", "y"], ["INSERT INTO t_b VALUES (?)", "x"]], { atomic: true }); } catch { err = true; }
  ok("E-04: فشل الأمر الثالث يتراجع عن الأولين (كل شيء أو لا شيء)", err && sql("SELECT COUNT(*) n FROM t_b").n === 0, sql("SELECT COUNT(*) n FROM t_b")); }
done();
