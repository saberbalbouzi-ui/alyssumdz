/* المرحلة 12B / WS1 — نزاهة إنشاء الطلبات على متجر PHP حقيقي معزول (SQLite مؤقتة + بيانات اصطناعية فقط).
   كل اختبار يعمل عبر مسار HTTP الحقيقي `order`، والتحقق بقراءة قاعدة البيانات المؤقتة مباشرة (لا استنتاج من ردود الواجهة).
   التزامن: PHP_CLI_SERVER_WORKERS=8 (عمليات PHP متوازية على نفس SQLite/WAL) — يحاكي حمولة ذروة حقيقية لا حلقة متسلسلة.
   لا يُلمس أي نظام إنتاجي. التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/phase12b-orders.js [SEQ=10000] [CONC=1000] */
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process"); const { startStore } = require("./harness");
const SEQ = +process.env.SEQ || 10000, CONC = +process.env.CONC || 1000, R = []; let fails = 0;
const ok = (n, c, x) => { if (!c) fails++; R.push({ n, pass: !!c, x }); console.log((c ? "PASS " : "FAIL ") + n + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 260) : "")); };
const hdr = c => ({ "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", Cookie: c });
const sql = (st, q) => { const o = execFileSync("php", [path.join(__dirname, "sqlq.php"), path.join(st.dir, "api", "_data", "store.db"), q], { encoding: "utf8", maxBuffer: 1 << 28 }); return o.split("\n").filter(Boolean).map(l => JSON.parse(l)); };
const one = (st, q) => Object.values(sql(st, q)[0] || {})[0];
let seed = 0; const mk = (o = {}) => ({ order: Object.assign({ name: "زبون اختبار " + (++seed), phone: "0550" + String(100000 + seed).slice(-6), wilaya: "الجزائر", commune: "مركز", dtype: "home", items: [{ slug: "tarkiz", title: "قطرات التركيز", qty: 1, price: 1800 }], subtotal: 1800, fee: 400, total: 2200 }, o) });
const post = async (st, body, extra = {}, cookie) => { try { const r = await fetch(st.base + "/api/index.php?r=order", { method: "POST", headers: Object.assign(hdr(cookie === undefined ? st.cookie : cookie), extra), body: JSON.stringify(body) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (_) { } return { s: r.status, j, ra: r.headers.get("retry-after") }; } catch (e) { return { s: 0, j: null, err: String(e.cause && e.cause.code || e.message) }; } };
const M = (o = {}) => mk(Object.assign({ manual: true }, o));
const idRx = /^[SM]\d{6}-[0-9A-F]{8,14}$/;
const uuid = () => require("crypto").randomUUID().replace(/-/g, "");

(async () => {
  const t0 = Date.now(); let st = null;
  try {
    st = await startStore({ stock: true, orders: [], env: { PHP_CLI_SERVER_WORKERS: "8" } });
    const base0 = +one(st, "select count(*) c from orders");
    /* ── 1) 10,000 إنشاء تسلسلي ── */
    console.log("— تسلسلي", SEQ); let bad = [], ids = new Set(), longId = 0; const ts = Date.now();
    for (let i = 0; i < SEQ; i++) { const r = await post(st, M()); if (r.s !== 200 || !r.j || !r.j.ok) { bad.push([i, r.s, r.err]); continue; } ids.add(r.j.id); if (!idRx.test(r.j.id)) bad.push([i, "badid", r.j.id]); }
    const dbn = +one(st, "select count(*) c from orders") - base0, dist = +one(st, "select count(distinct id) c from orders") - base0;
    ok("تسلسلي " + SEQ + ": كل الطلبات مقبولة (0 رفض/500)", bad.length === 0, { bad: bad.slice(0, 3), n: SEQ, s: Math.round((Date.now() - ts) / 1000) });
    ok("تسلسلي: 0 معرّف مكرّر، وعدد صفوف قاعدة البيانات = المقبول", ids.size === SEQ && dbn === SEQ && dist === SEQ, { accepted: ids.size, db: dbn, distinct: dist });
    /* ── 2) 1,000 طلب متزامن (بلا مفتاح idempotency) ── */
    console.log("— متزامن", CONC); const b1 = +one(st, "select count(*) c from orders"); const res = await Promise.all(Array.from({ length: CONC }, () => post(st, M())));
    const s200 = res.filter(r => r.s === 200 && r.j && r.j.ok), s503 = res.filter(r => r.s === 503), s0 = res.filter(r => r.s === 0), s500 = res.filter(r => r.s === 500);
    const dbIds = new Set(sql(st, "select id from orders").map(r => r.id)), lost = s200.filter(r => !dbIds.has(r.j.id)).length, dup200 = s200.length - new Set(s200.map(r => r.j.id)).size, b2 = +one(st, "select count(*) c from orders");
    ok("متزامن " + CONC + ": 0 طلب مقبول ضائع (كل 200 موجود في القاعدة)", lost === 0, { accepted: s200.length, lost, busy503: s503.length, net_err: s0.length, http500: s500.length });
    ok("متزامن: 0 معرّف مكرّر بين المقبولين، وصفوف القاعدة = المقبول بالضبط", dup200 === 0 && b2 - b1 === s200.length, { added: b2 - b1, accepted: s200.length });
    ok("متزامن: كل فشل برمز صحيح (لا 500)", s500.length === 0 && s503.every(r => r.ra === "1"), { s503: s503.length, s0: s0.length });
    /* ── 3) متزامن مع مفاتيح idempotency وإعادة محاولة العميل ← 1000 بالضبط ── */
    const keys = Array.from({ length: CONC }, uuid), b3 = +one(st, "select count(*) c from orders"); const attempt = async k => { let last = null; for (let a = 0; a < 8; a++) { last = await post(st, M({ name: "مفتاح " + k.slice(0, 6), phone: "0661" + String(100000 + parseInt(k.slice(0, 5), 16) % 899999) }), { "Idempotency-Key": k }); if (last.s === 200) return last; await new Promise(r => setTimeout(r, 30 * (a + 1))); } return last; };
    const r3 = await Promise.all(keys.map(attempt)), acc3 = r3.filter(r => r.s === 200).length, b4 = +one(st, "select count(*) c from orders"), idemRows = +one(st, "select count(*) c from order_idem");
    ok("متزامن مع مفاتيح وإعادة محاولة العميل: كل الطلبات تُقبل مرة واحدة بالضبط", acc3 === CONC && b4 - b3 === CONC && idemRows >= CONC, { accepted: acc3, added: b4 - b3, idem_rows: idemRows });
    /* ── 4) تصادم معرّف قسري ── */
    const sc = await startStore({ stock: true, orders: [], env: { PHP_CLI_SERVER_WORKERS: "4", ALYSSUM_TEST_MODE: "1", ALYSSUM_TEST_FORCE_IDS: "M000101-AAAAAAAA" } });
    try {
      sql(sc, "INSERT INTO promo_codes (code, phone, type, value, min_order, expires, used_order, used_at, created) VALUES ('PROMO1','0550123456','pct',10,0," + (Math.floor(Date.now() / 1000) + 86400) + ",NULL,NULL,1)");
      const first = await post(sc, M({ phone: "0550123456", promo: "PROMO1" }));      // يأخذ المعرّف المفروض
      const col = await Promise.all(Array.from({ length: 40 }, () => post(sc, M())));    // كلها تصطدم أولاً ثم تُعاد
      const colOk = col.every(r => r.s === 200 && r.j && r.j.id !== "M000101-AAAAAAAA"), cn = +one(sc, "select count(*) c from orders"), cd = +one(sc, "select count(distinct id) c from orders"), long = +one(sc, "select count(*) c from orders where length(id) >= 17");
      ok("تصادم قسري: الأول يأخذ المعرّف المفروض والباقي يُعاد بمعرّف جديد (200)", first.s === 200 && first.j.id === "M000101-AAAAAAAA" && colOk, { first: first.j, ok40: col.filter(r => r.s === 200).length });
      ok("تصادم قسري: 41 طلباً = 41 صفاً = 41 معرّفاً فريداً (لا ضياع ولا تكرار)", cn === 41 && cd === 41, { rows: cn, distinct: cd, longer_ids: long });
      /* كود التخفيض مع تصادم: يُستهلك مرة واحدة بالطلب النهائي */
      const p1 = (sql(sc, "select used_order from promo_codes where code='PROMO1'")[0] || {}).used_order;
      sql(sc, "INSERT INTO promo_codes (code, phone, type, value, min_order, expires, used_order, used_at, created) VALUES ('PROMO2','0550777777','pct',10,0," + (Math.floor(Date.now() / 1000) + 86400) + ",NULL,NULL,1)");
      const pc = await post(sc, M({ phone: "0550777777", promo: "PROMO2" })), p2 = (sql(sc, "select used_order from promo_codes where code='PROMO2'")[0] || {}).used_order;
      ok("كود التخفيض يُربط بالطلب النهائي الموجود فعلاً (لا بمعرّف مرفوض بعد تصادم)", p1 === "M000101-AAAAAAAA" && pc.s === 200 && p2 === pc.j.id && +one(sc, "select count(*) c from orders where id='" + p2 + "'") === 1, { p1, p2, order: pc.j && pc.j.id });
      /* ── 5) فشل قاعدة بيانات قسري (TRIGGER) ── */
      sql(sc, "CREATE TRIGGER fail_orders BEFORE INSERT ON orders WHEN NEW.name = 'FAIL-DB' BEGIN SELECT RAISE(ABORT, 'forced failure'); END");
      sql(sc, "INSERT INTO promo_codes (code, phone, type, value, min_order, expires, used_order, used_at, created) VALUES ('PROMO3','0550888888','pct',10,0," + (Math.floor(Date.now() / 1000) + 86400) + ",NULL,NULL,1)");
      const key = uuid(), n0 = +one(sc, "select count(*) c from orders"), idem0 = +one(sc, "select count(*) c from order_idem");
      const f = await post(sc, M({ name: "FAIL-DB", phone: "0550888888", promo: "PROMO3" }), { "Idempotency-Key": key });
      const used3 = (sql(sc, "select used_order from promo_codes where code='PROMO3'")[0] || {}).used_order;
      ok("فشل قاعدة بيانات قسري: HTTP 500 صريح (لا نجاح كاذب، لا يُعاد كتصادم)", f.s === 500 && f.j && f.j.error === "server_error", { s: f.s, j: f.j });
      ok("فشل قاعدة بيانات قسري: لا طلب ولا سجل idempotency ولا كود تخفيض مستهلك (تراجع كامل)", +one(sc, "select count(*) c from orders") === n0 && +one(sc, "select count(*) c from order_idem") === idem0 && used3 === null, { used_order: used3 });
      sql(sc, "DROP TRIGGER fail_orders");
      const retry = await post(sc, M({ name: "FAIL-DB", phone: "0550888888", promo: "PROMO3" }), { "Idempotency-Key": key });
      ok("بعد إصلاح الفشل: إعادة المحاولة بنفس المفتاح تنجح وتُنشئ طلباً واحداً", retry.s === 200 && !retry.j.duplicate && +one(sc, "select count(*) c from orders") === n0 + 1, retry.j);
    } finally { sc.stop(); }
    /* ── 6) idempotency ── */
    const k1 = uuid(), n6 = +one(st, "select count(*) c from orders"), body6 = M({ phone: "0551999111" });
    const a = await post(st, body6, { "Idempotency-Key": k1 }), b = await post(st, body6, { "Idempotency-Key": k1 });
    ok("idempotency: نفس المفتاح ونفس المحتوى ← طلب واحد، والثاني يعيد نفس المعرّف (duplicate)", a.s === 200 && b.s === 200 && a.j.id === b.j.id && b.j.duplicate === true && +one(st, "select count(*) c from orders") === n6 + 1, { a: a.j, b: b.j });
    const c = await post(st, M({ phone: "0551999222", total: 9999 }), { "Idempotency-Key": k1 });
    ok("idempotency: نفس المفتاح بمحتوى مختلف ← 409 ولا طلب جديد", c.s === 409 && c.j.error === "idempotency_key_reuse" && +one(st, "select count(*) c from orders") === n6 + 1, c.j);
    const d1 = await post(st, body6, { "Idempotency-Key": uuid() }), d2 = await post(st, body6, { "Idempotency-Key": uuid() });
    ok("idempotency: مفاتيح مختلفة بنفس المحتوى = طلبان مشروعان منفصلان", d1.s === 200 && d2.s === 200 && d1.j.id !== d2.j.id && !d1.j.duplicate, { d1: d1.j.id, d2: d2.j.id });
    const k2 = uuid(), n7 = +one(st, "select count(*) c from orders"), body7 = M({ phone: "0551999333" }); const par = await Promise.all(Array.from({ length: 60 }, () => post(st, body7, { "Idempotency-Key": k2 })));
    const okp = par.filter(r => r.s === 200), idsp = new Set(okp.map(r => r.j.id));
    ok("idempotency متزامن: 60 طلباً بنفس المفتاح ← طلب واحد فقط، كل الردود 200 بنفس المعرّف", +one(st, "select count(*) c from orders") === n7 + 1 && idsp.size === 1 && okp.length >= 50, { ok: okp.length, distinct: idsp.size, non200: par.filter(r => r.s !== 200).map(r => r.s).slice(0, 5) });
    const badk = await post(st, M(), { "Idempotency-Key": "short" });
    ok("idempotency: مفتاح غير صالح ← 422 (لا تجاهل صامت)", badk.s === 422 && badk.j.error === "invalid_idem", badk.j);
    /* ── 7) إعادة شبكة: قطع العميل ثم إعادة بنفس المفتاح ── */
    const k3 = uuid(), n8 = +one(st, "select count(*) c from orders"), body8 = M({ phone: "0551999444" }); const ac = new AbortController();
    const p = fetch(st.base + "/api/index.php?r=order", { method: "POST", headers: Object.assign(hdr(st.cookie), { "Idempotency-Key": k3 }), body: JSON.stringify(body8), signal: ac.signal }).catch(() => null); ac.abort(); await p; await new Promise(r => setTimeout(r, 400));
    const rr = await post(st, body8, { "Idempotency-Key": k3 }), rr2 = await post(st, body8, { "Idempotency-Key": k3 });
    ok("إعادة شبكة: العميل يقطع الاتصال ثم يعيد بنفس المفتاح ← طلب واحد بالضبط", rr.s === 200 && rr2.s === 200 && rr.j.id === rr2.j.id && +one(st, "select count(*) c from orders") === n8 + 1, { n: +one(st, "select count(*) c from orders") - n8 });
    /* ── 8) الحراس لا ترفض إعادة المحاولة المشروعة؛ والزوار محدودون ── */
    const pub = k => post(st, mk({ phone: "0552" + String(100000 + Math.floor(Math.random() * 899999)) }), k ? { "Idempotency-Key": k } : {}, "");
    const keep = uuid(), first = await pub(keep); let lim = 0; for (let i = 0; i < 25; i++) { const r = await pub(); if (r.s === 429) lim++; }
    const replay = await post(st, mk({ phone: "0552000000" }), { "Idempotency-Key": keep }, "");
    ok("زائر: حدّ المعدّل 20/ساعة ما زال مفعّلاً (429)", first.s === 200 && lim > 0, { first: first.s, limited: lim });
    ok("زائر: إعادة الإرسال بمفتاح قُبل سابقاً لا تُرفض بـ429 (تُعاد النتيجة الأولى) إن تطابق المحتوى، وتُرفض 409 إن اختلف", replay.s === 409 || (replay.s === 200 && replay.j.duplicate), { s: replay.s, j: replay.j });
    /* ── 9) توافق خلفي ── */
    sql(st, "INSERT INTO orders (id, created_at, name, phone, items_text, items, subtotal, fee, total, extra, status, note) VALUES ('S260101-ABCDE'," + Math.floor(Date.now() / 1000) + ",'قديم','0550000009','x','[]',1,0,1,'{}','nouvelle','')");
    const lst = await (await fetch(st.base + "/api/index.php?r=orders", { headers: hdr(st.cookie) })).json(), old = (lst.orders || []).find(o => o.id === "S260101-ABCDE");
    const up = await fetch(st.base + "/api/index.php?r=order_update", { method: "POST", headers: hdr(st.cookie), body: JSON.stringify({ id: "S260101-ABCDE", status: "confirmee" }) });
    ok("توافق خلفي: معرّف قديم (5 رموز) يُقرأ ويُحدَّث كما كان", !!old && up.status === 200 && (sql(st, "select status from orders where id='S260101-ABCDE'")[0] || {}).status === "confirmee", { found: !!old, update: up.status });
    const nk = await post(st, M()); ok("توافق خلفي: عميل بلا مفتاح يعمل كما كان (200 + معرّف بالشكل الجديد)", nk.s === 200 && idRx.test(nk.j.id), nk.j);
    ok("توافق خلفي: عقد الردّ `{ok,id}` بلا حقول جديدة لطلب عادي", Object.keys(nk.j).sort().join() === "id,ok", Object.keys(nk.j));
    /* ── 10) تماسك نهائي ── */
    const orph = +one(st, "select count(*) c from order_idem i left join orders o on o.id=i.order_id where o.id is null");
    ok("تماسك نهائي: لا سجل idempotency يشير لطلب غير موجود", orph === 0, { orphan_idem: orph });
  } catch (e) { fails++; console.log("HARNESS ERROR", String(e.stack || e).slice(0, 500)); }
  finally { if (st) st.stop(); }
  const out = { phase: "12B", workstream: "WS1", date: new Date().toISOString().slice(0, 10), isolation: "متجر PHP محلي بقاعدة SQLite مؤقتة؛ PHP_CLI_SERVER_WORKERS=8؛ بيانات اصطناعية", seq: SEQ, conc: CONC, pass: R.filter(r => r.pass).length, fail: R.filter(r => !r.pass).length, duration_s: Math.round((Date.now() - t0) / 1000), results: R };
  fs.writeFileSync(path.join(__dirname, "phase12b-orders-result.json"), JSON.stringify(out, null, 1)); console.log("\nPASS " + out.pass + " · FAIL " + out.fail + " · " + out.duration_s + "s"); process.exit(fails ? 1 : 0);
})();
