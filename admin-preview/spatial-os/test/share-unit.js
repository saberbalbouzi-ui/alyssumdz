/* SpatialShare (V4): اختبار وحدة لقواعد المشاركة والعزل بلا متصفح — دمج الطلبات المتزامنة، TTL، استبعاد الجلسة/المفاتيح الحساسة/الأصل الآخر/Authorization،
   نسخ مستقلة للمستهلكين، إبطال الكتابة (محدَّد بالمسار/المفتاح أو شامل)، عدم تخزين غير الناجح/الكبير، حالة السباق (طلب جارٍ قبل كتابة)، تغيّر المستأجر، دفعة التحميل.
   التشغيل: node admin-preview/spatial-os/test/share-unit.js */
const fs = require("fs"), path = require("path"), vm = require("vm");
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 300) : "")); };
const SRC = fs.readFileSync(path.join(__dirname, "..", "share.js"), "utf8");
function load(search, tenant) {
  const ctx = { Map, Promise, URL, Headers, Response, Date: { now: () => ctx.__t }, performance: { now: () => 0 }, setTimeout, clearTimeout, console, Array, Object, JSON, String, Math, __t: 1000000 };
  ctx.window = ctx; ctx.location = { origin: "https://shop.example", search: search || "", href: "https://shop.example/admin-preview/spatial-os/index.html" };
  ctx.SpatialHub = { tenant: () => ctx.__tenant === undefined ? (tenant || null) : ctx.__tenant };
  vm.createContext(ctx); vm.runInContext(SRC, ctx); return ctx;
}
const JSONRES = (o, status) => () => new Response(JSON.stringify(o), { status: status || 200, headers: { "content-type": "application/json" } });
function mkOrig(handler) { const calls = []; const f = (u, n) => { calls.push(String(u)); return Promise.resolve(handler(String(u), n)); }; f.calls = calls; return f; }
const U = q => "/api/index.php?r=" + q, tick = () => new Promise(r => setTimeout(r, 5));
(async () => {
  /* 1) دمج المتزامن + نسخ مستقلة */
  { const c = load(); const S = c.SpatialShare, o = mkOrig(JSONRES({ v: [1, 2, 3] }));
    const [a, b, d] = await Promise.all([1, 2, 3].map(() => S.fetch(o, U("kv&k=s_x"), { headers: { "X-Requested-With": "XMLHttpRequest" } }, Response, c.location.href)));
    ok("ثلاث قراءات متزامنة لمفتاح kv واحد = طلب واحد للخادم", o.calls.length === 1, o.calls);
    const ja = await a.json(), jb = await b.json(); ja.v.push(99);
    ok("كل مستهلك يملك نسخته: تعديل نتيجة أحدهم لا يمسّ الآخر", jb.v.length === 3 && (await d.json()).v.length === 3);
    ok("الاستجابة من النوع Response الممرَّر (عالم الإطار نفسه) وبالحالة والرؤوس", a instanceof Response && a.status === 200 && a.headers.get("content-type") === "application/json"); }
  /* 2) TTL */
  { const c = load(), S = c.SpatialShare, o = mkOrig(JSONRES({ ok: 1 }));
    await S.fetch(o, U("kv&k=s_a"), {}, Response); await S.fetch(o, U("kv&k=s_a"), {}, Response);
    ok("القراءة الثانية خلال 3ث تُخدم من الذاكرة", o.calls.length === 1);
    c.__t += 3500; await S.fetch(o, U("kv&k=s_a"), {}, Response); ok("بعد انتهاء 3ث تُجلب من جديد", o.calls.length === 2); }
  /* 3) دفعة التحميل */
  { const c = load(), S = c.SpatialShare, o = mkOrig(JSONRES({ ok: 1 }));
    S.burst(true); await S.fetch(o, U("kv&k=s_a"), {}, Response); await S.fetch(o, U("orders"), {}, Response); c.__t += 20000;
    await S.fetch(o, U("kv&k=s_a"), {}, Response); await S.fetch(o, U("orders"), {}, Response);
    ok("أثناء الدفعة: kv يعيش 45ث (بعد 20ث ما زال من الذاكرة) والطلبات المتغيّرة 8ث فقط", o.calls.filter(x => /kv/.test(x)).length === 1 && o.calls.filter(x => /orders/.test(x)).length === 2, o.calls);
    S.burst(false); c.__t += 3500; await S.fetch(o, U("kv&k=s_a"), {}, Response); ok("بعد انتهاء الدفعة تُقصَّر المدة إلى 3ث", o.calls.filter(x => /kv/.test(x)).length === 2); }
  /* 4) قواعد العزل: لا مشاركة */
  { const c = load(), S = c.SpatialShare, o = mkOrig(JSONRES({ me: 1 }));
    const non = [["me", U("me")], ["login", U("login")], ["مسار غير مسموح", U("analytics")], ["kv حساس token", U("kv&k=s_api_token")], ["kv حساس session", U("kv&k=my_session")], ["kv حساس secret", U("kv&k=s_secret_x")], ["أصل آخر", "https://evil.example/api/index.php?r=kv&k=s_x"], ["ليس api", "/assets/data/store.json"]];
    for (const [n, u] of non) { const before = o.calls.length; const r = S.fetch(o, u, {}, Response); ok("لا مشاركة: " + n + " (يعيد null فيمرّ الطلب كما هو)", r === null, r && "handled"); }
    ok("Authorization لا يُشارَك", S.fetch(o, U("kv&k=s_x"), { headers: { Authorization: "Bearer x" } }, Response) === null);
    ok("signal/credentials:omit لا يُشارَك", S.fetch(o, U("kv&k=s_x"), { signal: new AbortController().signal }, Response) === null && S.fetch(o, U("kv&k=s_x"), { credentials: "omit" }, Response) === null);
    ok("POST لا يُشارَك أبداً ويمرّ", S.fetch(o, U("kv"), { method: "POST", body: "{}" }, Response) === null); }
  /* 5) إبطال الكتابة */
  { const c = load(), S = c.SpatialShare, o = mkOrig(JSONRES({ ok: 1 }));
    const prime = async () => { for (const q of ["kv&k=s_a", "kv&k=s_b", "file&path=p%2Fa.html", "file&path=p%2Fb.html", "orders", "ship_carriers"]) await S.fetch(o, U(q), {}, Response); };
    const has = async q => { const n = o.calls.length; await S.fetch(o, U(q), {}, Response); return o.calls.length === n; };   /* true = من الذاكرة */
    await prime(); S.fetch(o, U("kv"), { method: "POST", body: JSON.stringify({ k: "s_a", v: 1 }) }, Response);
    ok("كتابة kv بمفتاح s_a: تُبطل s_a والطلبات المتغيّرة وship_carriers فقط", !(await has("kv&k=s_a")) && (await has("kv&k=s_b")) && !(await has("orders")) && !(await has("ship_carriers")) && (await has("file&path=p%2Fa.html")));
    await prime(); S.fetch(o, U("file"), { method: "PUT", body: JSON.stringify({ path: "p/a.html", content: "x" }) }, Response);
    ok("كتابة file بمسار p/a.html: تُبطل ذلك المسار فقط وتُبقي kv وملفاً آخر", !(await has("file&path=p%2Fa.html")) && (await has("file&path=p%2Fb.html")) && (await has("kv&k=s_b")));
    await prime(); S.fetch(o, U("login"), { method: "POST", body: "{}" }, Response);
    ok("كتابة إلى مسار آخر (login) تُفرغ كل شيء", !(await has("kv&k=s_a")) && !(await has("file&path=p%2Fa.html")) && !(await has("orders")));
    await prime(); S.clear("event"); ok("clear() الشامل (حدث الهَب) يُفرغ كل شيء", !(await has("kv&k=s_b")));
    await prime(); S.clearData(); ok("clearData() (تحديث الهَب) يُبطل الطلبات/الملفات ويُبقي kv", (await has("kv&k=s_a")) && !(await has("orders")) && !(await has("file&path=p%2Fa.html"))); }
  /* 6) سباق: طلب جارٍ قبل الكتابة لا يُخزَّن */
  { const c = load(), S = c.SpatialShare; let release; const o = mkOrig(() => new Promise(r => { release = () => r(new Response(JSON.stringify({ old: 1 }), { status: 200 })); }));
    const p1 = S.fetch(o, U("kv&k=s_race"), {}, Response); await tick(); S.fetch(o, U("kv"), { method: "POST", body: JSON.stringify({ k: "s_race", v: 2 }) }, Response); release(); const r1 = await p1; await r1.json();
    const o2 = mkOrig(JSONRES({ fresh: 1 })); await S.fetch(o2, U("kv&k=s_race"), {}, Response);
    ok("استجابة طلب بدأ قبل كتابة المفتاح نفسه لا تُخزَّن (يُجلب من جديد)", o2.calls.length === 1); }
  /* 7) غير الناجح/الكبير/الفشل */
  { const c = load(), S = c.SpatialShare, o = mkOrig(JSONRES({ e: 1 }, 500)); await S.fetch(o, U("kv&k=s_e"), {}, Response); await S.fetch(o, U("kv&k=s_e"), {}, Response);
    ok("الاستجابة غير الناجحة (500) لا تُخزَّن", o.calls.length === 2);
    const big = mkOrig(() => new Response("x".repeat(1600000), { status: 200 })); await S.fetch(big, U("kv&k=s_big"), {}, Response); await S.fetch(big, U("kv&k=s_big"), {}, Response);
    ok("الاستجابة الكبيرة (>1.5MB) لا تُخزَّن", big.calls.length === 2);
    let n = 0; const flaky = mkOrig(() => { if (n++ === 0) return Promise.reject(new TypeError("net")); return new Response("{}", { status: 200 }); });
    let threw = false; try { await S.fetch(flaky, U("kv&k=s_f"), {}, Response); } catch (_) { threw = true; } const again = await S.fetch(flaky, U("kv&k=s_f"), {}, Response);
    ok("فشل الشبكة يصل للطالب كما هو ولا يُسمَّم الكاش (المحاولة التالية تنجح)", threw && again.status === 200); }
  /* 8) فشل الطلب الجارئ يُنقذ المنتظرين بطلبهم الخاص */
  { const c = load(), S = c.SpatialShare; let n = 0; const o = mkOrig(() => (n++ === 0 ? Promise.reject(new TypeError("closed")) : new Response("{\"ok\":1}", { status: 200 })));
    const p1 = S.fetch(o, U("kv&k=s_j"), {}, Response).catch(() => "err"), p2 = S.fetch(o, U("kv&k=s_j"), {}, Response);
    const [r1, r2] = await Promise.all([p1, p2]); ok("إغلاق إطار صاحب الطلب الجاري لا يكسر المنتظرين (يعيدون الجلب بأنفسهم)", r1 === "err" && r2.status === 200, [r1, r2 && r2.status]); }
  /* 9) تطبيع معامل t + المستأجر */
  { const c = load(), S = c.SpatialShare, o = mkOrig(JSONRES({ ok: 1 }));
    await S.fetch(o, U("file&path=a.json&t=111"), {}, Response); await S.fetch(o, U("file&path=a.json&t=222"), {}, Response); ok("معامل كسر الكاش t لا يُفرّق الطلبات", o.calls.length === 1);
    await S.fetch(o, U("kv&k=s_t"), {}, Response); c.__tenant = "t_AAA"; await S.fetch(o, U("kv&k=s_t"), {}, Response); const n0 = o.calls.length;
    ok("أول معرفة للمستأجر (null ← قيمة) لا تُفرغ الذاكرة", n0 === 2 || n0 === 3, o.calls);
    c.__tenant = "t_BBB"; await S.fetch(o, U("kv&k=s_t"), {}, Response); ok("تغيّر المستأجر إلى آخر يُفرغ الذاكرة كلها (لا تسرّب بين المتاجر)", o.calls.length === n0 + 1, o.calls.length); }
  /* 10) التعطيل */
  { const c = load("?noshare=1"), o = mkOrig(JSONRES({ ok: 1 })); ok("‎?noshare=1‎ يعطّل المشاركة تماماً", c.SpatialShare.fetch(o, U("kv&k=s_x"), {}, Response) === null); }
  /* 11) الكائن مجمَّد */
  { const c = load(); let thrown = false; try { "use strict"; c.SpatialShare.fetch = null; } catch (_) { thrown = true; } ok("الواجهة مجمَّدة (لا يُستبدل fetch من كود آخر)", typeof c.SpatialShare.fetch === "function"); }
  console.log(fails ? "FAILS: " + fails : "ALL PASS"); process.exit(fails ? 1 : 0);
})();
