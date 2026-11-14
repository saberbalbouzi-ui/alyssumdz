/* المرحلة 12C (رقعة المراجعة) — سباق حجز Idempotency-Key في Worker. ⚠ LOCAL ONLY: D1 محاكاة بـnode:sqlite؛ لا Worker ولا D1 حقيقيين (BLOCKED).
   الجذر: كان core.js ينفّذ SELECT المفتاح ← تنفيذ المعالج ← INSERT OR IGNORE الردّ (check-then-act): كل الطلبات المتزامنة ترى «لا مفتاح» وتنفّذ المعالج.
   حماية ref داخل المعالج كانت تُخفي السباق فقط حين تتطابق المراجع؛ بمراجع/حمولات مختلفة ينشأ أكثر من طلب.
   المطلوب: ادّعاء ذرّي (INSERT OR IGNORE لسطر مطالبة status=0 أولاً، ثم نجاح changes=1 فقط ينفّذ المعالج)، يكفي PRIMARY KEY (tenant_id,k) على D1 بلا ترحيل.
   مصفوفة النتائج الموثَّقة لطلبات متزامنة بنفس المفتاح: المالك 201؛ محتوى مختلف ← 409 idempotency_conflict؛ نفس المحتوى أثناء التنفيذ ← 409 idempotency_in_progress (+Retry-After)؛ بعد الإنجاز ← إعادة الردّ نفسه (Idempotent-Replayed). */
import { makeEnv, Tally } from "./_harness.mjs";
import { commerce } from "../src/modules/commerce.js";
const { ok, done } = Tally(); const E = makeEnv([commerce]); const { call, adm, tenant, sql, db, clock } = E; const A = await tenant("A"), B = await tenant("B");
const prod = { slug: "honey", title: "عسل", price: 2400, stock: 1000, offers: [{ qty: 1, price: 2400, free: 0 }] };
for (const T of [A, B]) { await call("PUT", "/v1/catalog/products", { products: [prod] }, T.key); await adm("PATCH", `/admin/tenants/${T.id}`, { settings: { origins: ["https://shop.example"], order_mode: "enforce" } }); }
const pk = async T => (await adm("POST", `/admin/tenants/${T.id}/keys`, { scopes: ["order:create"], mode: "pub" }))[1].key; const PKA = await pk(A), PKB = await pk(B), O = { origin: "https://shop.example" };
const mk = (ref, qty = 2, name = "أمين") => ({ ref, customer: { name, phone: "0551234567" }, wilaya: "Alger", commune: "Kouba", dtype: "home", items: [{ slug: "honey", qty, price: 2400 }], subtotal: 2400 * qty, discount: 0, fee: 0, total: 2400 * qty });
const stock = tid => sql("SELECT stock s FROM cm_skus WHERE tenant_id=? AND slug='honey' AND vkey=''", tid).s, cnt = tid => sql("SELECT COUNT(*) n FROM cm_orders WHERE tenant_id=?", tid).n, H = k => ({ ...O, "idempotency-key": k }), rid = () => "R" + Math.random().toString(36).slice(2, 10).toUpperCase();
const lim = Array.from({ length: 1 }); // الحدّ 30/دقيقة لكل مستأجر: نُجري تجارب متتالية مع تقدّم الساعة
const tick = () => { clock.t += 120000; };
/* T1: 10 متزامنة بنفس المفتاح، مراجع مختلفة وحمولات مختلفة (كميات 1..10) */
{ const K = "idem-race-0001-" + Date.now(), before = [cnt(A.id), stock(A.id)]; const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => call("POST", "/v1/orders", mk("RACE-DIFF-" + i + "-" + rid(), i + 1), PKA, {}, H(K))));
  const made = cnt(A.id) - before[0], won = rs.filter(r => r[0] === 201), codes = rs.map(r => r[0] + ":" + (r[1].error?.code || "ok"));
  ok("[T1] 10 متزامنة بنفس المفتاح بمراجع/حمولات مختلفة ← طلب واحد فقط في القاعدة", made === 1, { made, codes });
  const winnerQty = sql("SELECT items i FROM cm_orders WHERE tenant_id=? ORDER BY id DESC LIMIT 1", A.id); const qty = JSON.parse(winnerQty.i)[0].qty;
  ok("[T1] خصم المخزون مرة واحدة بكمية الفائز فقط", before[1] - stock(A.id) === qty, { deducted: before[1] - stock(A.id), qty });
  ok("[T1] نتيجة حتمية موثَّقة: فائز واحد 201، والبقية 409 idempotency_conflict (محتوى مختلف) — لا 5xx ولا نجاح ثانٍ", won.length === 1 && rs.filter(r => r[0] === 409 && r[1].error?.code === "idempotency_conflict").length === 9, codes);
  const [c2, b2] = await call("POST", "/v1/orders", mk("RACE-DIFF-OTHER-" + rid(), 3), PKA, {}, H(K)); ok("[T1] بعد الانتهاء: محتوى متعارض بنفس المفتاح لا يُنشئ ثانياً (409)", c2 === 409 && cnt(A.id) - before[0] === 1, { c2 }); }
tick();
/* T2: 10 متزامنة بنفس المفتاح والمحتوى نفسه */
{ const K = "idem-race-0002-" + Date.now(), REF = "RACE-SAME-" + rid(), before = [cnt(A.id), stock(A.id)]; const rs = await Promise.all(Array.from({ length: 10 }, () => call("POST", "/v1/orders", mk(REF, 4), PKA, {}, H(K))));
  ok("[T2] 10 متزامنة بنفس المفتاح والمحتوى ← طلب واحد وخصم واحد (4)", cnt(A.id) - before[0] === 1 && before[1] - stock(A.id) === 4, { made: cnt(A.id) - before[0], dec: before[1] - stock(A.id) });
  const allowed = rs.every(r => (r[0] === 201 && r[1].ref === REF) || (r[0] === 409 && r[1].error?.code === "idempotency_in_progress")); ok("[T2] كل الردود ضمن المصفوفة الموثَّقة: 201 (مالك/إعادة) أو 409 idempotency_in_progress فقط", allowed && rs.filter(r => r[0] === 201 && !r[2]["Idempotent-Replayed"]).length === 1, rs.map(r => r[0] + ":" + (r[1].error?.code || "ok")));
  const again = await Promise.all(Array.from({ length: 10 }, () => call("POST", "/v1/orders", mk(REF, 4), PKA, {}, H(K)))); ok("[T2] إعادة 10 متزامنة بعد الانتهاء ← كلها 201 بنفس المرجع مع Idempotent-Replayed وبلا طلب جديد", again.every(r => r[0] === 201 && r[1].ref === REF && r[2]["Idempotent-Replayed"] === "true") && cnt(A.id) - before[0] === 1, again.map(r => r[0])); }
tick();
/* T3: ضياع الردّ الأول ثم 10 إعادات متزامنة */
{ const K = "idem-race-0003-" + Date.now(), REF = "RACE-LOST-" + rid(), before = [cnt(A.id), stock(A.id)]; await call("POST", "/v1/orders", mk(REF, 2), PKA, {}, H(K)); /* الردّ يُهمَل = ضاع */
  const rs = await Promise.all(Array.from({ length: 10 }, () => call("POST", "/v1/orders", mk(REF, 2), PKA, {}, H(K))));
  ok("[T3] بعد ضياع الردّ الأول: 10 إعادات متزامنة ← كلها إعادة الردّ الأصلي (201 Idempotent-Replayed) بلا طلب ثانٍ ولا خصم ثانٍ", rs.every(r => r[0] === 201 && r[1].ref === REF && r[2]["Idempotent-Replayed"] === "true") && cnt(A.id) - before[0] === 1 && before[1] - stock(A.id) === 2, rs.map(r => r[0])); }
tick();
/* T4: مالك انهار (سطر مطالبة قديم بلا ردّ) — الاستيلاء ذرّي: واحد فقط ينفّذ؛ ومطالبة حديثة ← in_progress */
{ const K = "idem-race-0004-" + Date.now(), REF = "RACE-CRASH-" + rid(), body = mk(REF, 3), raw = JSON.stringify(body); const { createHash } = await import("node:crypto");
  const h = createHash("sha256").update("POST" + "/v1/orders" + raw).digest("hex"), now = Math.floor(clock.t / 1000);
  db.prepare("INSERT INTO pf_idem (tenant_id,k,hash,status,body,at) VALUES (?,?,?,0,'',?)").run(A.id, K, h, now);
  const before = [cnt(A.id), stock(A.id)]; const fresh = await call("POST", "/v1/orders", raw, PKA, {}, H(K)); ok("[T4] مطالبة حديثة (مالك ما زال يعمل) ← 409 idempotency_in_progress مع Retry-After ولا تنفيذ", fresh[0] === 409 && fresh[1].error?.code === "idempotency_in_progress" && !!fresh[2]["Retry-After"] && cnt(A.id) === before[0], { c: fresh[0] });
  clock.t += 61000; const rs = await Promise.all(Array.from({ length: 10 }, () => call("POST", "/v1/orders", raw, PKA, {}, H(K))));
  ok("[T4] مالك انهار (مطالبة أقدم من 60ث): 10 متزامنة ← استيلاء واحد، طلب واحد وخصم واحد", cnt(A.id) - before[0] === 1 && before[1] - stock(A.id) === 3, { made: cnt(A.id) - before[0], codes: rs.map(r => r[0] + ":" + (r[1].error?.code || "ok")) });
  ok("[T4] نتائج حتمية: 201 (مالك/إعادة) أو 409 in_progress فقط", rs.every(r => r[0] === 201 || (r[0] === 409 && r[1].error?.code === "idempotency_in_progress"))); }
tick();
/* T5: عزل المستأجرين: نفس المفتاح متزامناً عند A وB */
{ const K = "idem-race-0005-" + Date.now(), bA = [cnt(A.id), stock(A.id)], bB = [cnt(B.id), stock(B.id)]; const rs = await Promise.all([...Array.from({ length: 5 }, (_, i) => call("POST", "/v1/orders", mk("T5-A-" + i + rid(), 2 + i), PKA, {}, H(K))), ...Array.from({ length: 5 }, (_, i) => call("POST", "/v1/orders", mk("T5-B-" + i + rid(), 2 + i), PKB, {}, H(K)))]);
  ok("[T5] نفس المفتاح متزامناً عند مستأجرين: كلٌّ ينشئ طلباً واحداً بالضبط، ولا تسرّب (A:1، B:1)", cnt(A.id) - bA[0] === 1 && cnt(B.id) - bB[0] === 1, { A: cnt(A.id) - bA[0], B: cnt(B.id) - bB[0] });
  ok("[T5] مخزون كل مستأجر يُخصم مرة واحدة من مخزونه", bA[1] - stock(A.id) >= 2 && bB[1] - stock(B.id) >= 2 && sql("SELECT COUNT(*) n FROM pf_idem WHERE k=?", K).n === 2, { A: bA[1] - stock(A.id), B: bB[1] - stock(B.id) });
  ok("[T5] نجاح واحد لكل مستأجر (201) والبقية 409 conflict داخل المستأجر نفسه", rs.slice(0, 5).filter(r => r[0] === 201).length === 1 && rs.slice(5).filter(r => r[0] === 201).length === 1); }
tick();
/* T6: فشل المالك (422) يُحرِّر المطالبة؛ 10 متزامنة غير صالحة ثم تصحيح بالمفتاح نفسه ينجح */
{ const K = "idem-race-0006-" + Date.now(), bad = { ...mk("T6-BAD-" + rid(), 2), customer: { name: "x", phone: "123" } }, before = cnt(A.id); const rs = await Promise.all(Array.from({ length: 10 }, () => call("POST", "/v1/orders", bad, PKA, {}, H(K))));
  ok("[T6] 10 متزامنة غير صالحة بنفس المفتاح: كلها 422 أو 409 in_progress (لا نجاح ولا 5xx) وبلا طلب", rs.every(r => r[0] === 422 || (r[0] === 409 && r[1].error?.code === "idempotency_in_progress")) && cnt(A.id) === before, rs.map(r => r[0]));
  ok("[T6] لا مطالبة عالقة بعد الفشل (سطر المفتاح محذوف)", sql("SELECT COUNT(*) n FROM pf_idem WHERE tenant_id=? AND k=?", A.id, K).n === 0);
  const [c] = await call("POST", "/v1/orders", mk("T6-GOOD-" + rid(), 2), PKA, {}, H(K)); ok("[T6] تصحيح المحتوى بالمفتاح نفسه ← 201", c === 201 && cnt(A.id) === before + 1, { c }); }
tick();
/* T7: مفاتيح مختلفة متزامنة لا تتعطل (لا قفل شامل) */
{ const before = cnt(A.id); const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => call("POST", "/v1/orders", mk("T7-" + i + rid(), 1), PKA, {}, H("idem-race-0007-" + i + "-" + Date.now())))); ok("[T7] 10 مفاتيح مختلفة متزامنة ← 10 طلبات (لا حجب بين المفاتيح)", rs.every(r => r[0] === 201) && cnt(A.id) === before + 10, rs.map(r => r[0])); }
tick();
/* T8: بلا مفتاح (توافق رجعي): نفس ref متزامناً ← طلب واحد بحماية ref */
{ const REF = "T8-NOKEY-" + rid(), before = cnt(A.id); const rs = await Promise.all(Array.from({ length: 10 }, () => call("POST", "/v1/orders", mk(REF, 2), PKA, {}, O))); ok("[T8] بلا مفتاح: السلوك القديم محفوظ (ref فريد) — طلب واحد", cnt(A.id) === before + 1 && rs.every(r => r[0] === 201 || (r[0] === 200 && r[1].duplicate === true)), rs.map(r => r[0])); }
done();
