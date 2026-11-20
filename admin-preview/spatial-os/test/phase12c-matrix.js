/* 12C-D — مصفوفة التوافق: السيناريوهات المشتركة نفسها عبر مسار PHP ومسار Supabase في العميل (api.js الحقيقي داخل vm؛ المحاكى: fetch فقط).
   ⚠ لا يختبر خوادم حقيقية؛ يختبر أن العميل يميّز الحالات الست بالطريقة نفسها لكل خلفية، ويكتب الجدول في phase12c-matrix-result.json.
   Worker لا يُستعمل كسجلّ طلبات للمتجر: يُقارَن عقده في تقرير 12C (من اختبارات orders-idempotency.test.mjs المحلية). */
const vm = require("vm"), fs = require("fs"), path = require("path"), { webcrypto } = require("crypto");
const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "..", "assets", "js", "api.js"), "utf8"); let fails = 0, n = 0; const MAT = [];
function env(be, handler) { const store = new Map(), ss = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: i => [...store.keys()][i], get length() { return store.size; } }, calls = [];
  const sb = { CONFIG: be === "php" ? { BACKEND: "php", PHP_API: "/api/index.php" } : { BACKEND: "", ORDERS_BACKEND: "supabase" }, REL: "", sessionStorage: ss, localStorage: ss, crypto: webcrypto, console, TextEncoder, URL, AbortController, Promise, JSON, Math, Date, setTimeout: (f, ms) => setTimeout(f, Math.min(ms || 0, 5)), clearTimeout, document: { createElement: () => ({ style: {} }), head: { appendChild() { } } }, unescape, encodeURIComponent,
    fetch: async (url, o) => { const c = { url, body: o && o.body ? JSON.parse(o.body) : null }; calls.push(c); const r = await handler(c, calls.length); if (r === "net") throw new Error("net"); return { ok: r.status >= 200 && r.status < 300, status: r.status, url: r.url || url, redirected: !!r.redirected, text: async () => (typeof r.raw === "string" ? r.raw : (r.body === undefined ? "" : JSON.stringify(r.body))) }; } };
  sb.window = sb; sb.globalThis = sb; vm.createContext(sb); vm.runInContext(SRC + "\nthis.API = API;", sb); sb.API.post = () => { }; sb.API.orderTimeout = 60; sb.API.sb = { enabled: () => true, url: p => "https://x.supabase.co" + p, headers: () => ({}) }; return { API: sb.API, calls }; }
const ORDER = () => ({ name: "أحمد بن علي", phone: "0550123456", wilaya: "الجزائر", commune: "الحراش", dtype: "home", desk: "", items: [{ slug: "tarkiz", title: "قطرات التركيز", qty: 1, price: 1800 }], subtotal: 1800, fee: 600, discount: 0, total: 2400, coupon: "", extra: {} });
const ID = "S261113-3D323D5C", ID2 = "S261113-3D323D5D";
const ok200 = be => be === "php" ? { status: 200, body: { ok: true, id: ID } } : { status: 200, raw: JSON.stringify(ID) };
const dup200 = be => be === "php" ? { status: 200, body: { ok: true, id: ID, duplicate: true } } : { status: 200, raw: JSON.stringify(ID) };
const reuse = be => be === "php" ? { status: 409, body: { error: "idempotency_key_reuse" } } : { status: 400, body: { code: "P0001", message: "idempotency_key_reuse" } };
const SC = [
  ["نجاح مؤكَّد (معرّف خادم صالح)", be => () => ok200(be), { php: "CONFIRMED", supabase: "CONFIRMED" }],
  ["HTTP 200 + معرّف غير صالح", be => () => be === "php" ? { status: 200, body: { ok: true, id: "x" } } : { status: 200, raw: '"x"' }, { php: "INVALID_RESPONSE", supabase: "INVALID_RESPONSE" }],
  ["HTTP 200 بلا معرّف/بنية صحيحة", be => () => be === "php" ? { status: 200, body: { ok: true } } : { status: 200, body: { ok: true } }, { php: "INVALID_RESPONSE", supabase: "INVALID_RESPONSE" }],
  ["HTTP 200 + جسم فارغ", be => () => ({ status: 200, raw: "" }), { php: "INVALID_RESPONSE", supabase: "INVALID_RESPONSE" }],
  ["HTTP 200 + JSON تالف", be => () => ({ status: 200, raw: "{oops" }), { php: "INVALID_RESPONSE", supabase: "INVALID_RESPONSE" }],
  ["إعادة توجيه غير متوقعة", be => () => Object.assign(ok200(be), { redirected: true, url: "https://evil.example/x" }), { php: "INVALID_RESPONSE", supabase: "INVALID_RESPONSE" }],
  ["HTTP 422", be => () => ({ status: 422, body: be === "php" ? { error: "invalid_name" } : { message: "invalid_name" } }), { php: "REJECTED", supabase: "REJECTED" }],
  ["HTTP 500", be => () => ({ status: 500, body: { error: "server_error" } }), { php: "SERVER_ERROR", supabase: "SERVER_ERROR" }],
  ["انقطاع شبكة قبل الحفظ", be => () => "net", { php: "UNKNOWN", supabase: "UNKNOWN" }],
  ["نفس المفتاح بمحتوى مختلف", be => () => reuse(be), { php: "REJECTED", supabase: "REJECTED" }],
];
(async () => {
  for (const [name, mk, exp] of SC) for (const be of ["php", "supabase"]) { const e = env(be, mk(be)); const r = await e.API.submitOrderTruth(ORDER()); const pass = r.state === exp[be] && r.ok === (exp[be] === "CONFIRMED" || exp[be] === "DUPLICATE_CONFIRMED") && (r.ok || r.id === ""); n++; if (!pass) fails++; MAT.push({ scenario: name, backend: be, expected: exp[be], got: r.state, error: r.error || "", attempts: e.calls.length, pass }); console.log((pass ? "PASS " : "FAIL ") + "[" + be + "] " + name + " ← " + r.state + (pass ? "" : " (متوقع " + exp[be] + ")")); }
  /* ضياع الردّ بعد الحفظ ثم إعادة: خادم يحفظ ثم يقطع، ثم يُعيد الأصل */
  for (const be of ["php", "supabase"]) { const idem = new Map(); let cnt = 0; const h = c => { const k = be === "php" ? c.body.order.idem : c.body.p.idem; if (!idem.has(k)) { idem.set(k, ID); cnt++; return "net"; } return be === "php" ? { status: 200, body: { ok: true, id: ID, duplicate: true } } : { status: 200, raw: JSON.stringify(ID) }; };
    const e = env(be, h); const r1 = await e.API.submitOrderTruth(ORDER()); const r2 = be === "supabase" ? await e.API.submitOrderTruth(ORDER()) : r1; const expState = be === "php" ? "DUPLICATE_CONFIRMED" : "CONFIRMED";
    /* php: الإعادة التلقائية داخل المحاولة الأولى تعيد الأصل (DUPLICATE_CONFIRMED)؛ supabase: لا إعادة تلقائية افتراضياً ← UNKNOWN ثم إعادة يدوية بنفس المفتاح تعيد الأصل (CONFIRMED) */
    const first = be === "php" ? "DUPLICATE_CONFIRMED" : "UNKNOWN", pass = r1.state === first && (be === "php" ? true : r2.state === expState && r2.id === ID && r1.key === r2.key) && cnt === 1; n++; if (!pass) fails++;
    MAT.push({ scenario: "فقد الردّ بعد قبول الطلب ثم إعادة", backend: be, expected: first + (be === "supabase" ? " → " + expState : ""), got: r1.state + (be === "supabase" ? " → " + r2.state : ""), pass, serverOrders: cnt }); console.log((pass ? "PASS " : "FAIL ") + "[" + be + "] فقد الردّ بعد القبول ثم إعادة ← " + r1.state + (be === "supabase" ? " → " + r2.state : "") + " (طلبات في الخادم: " + cnt + ")"); }
  fs.writeFileSync(path.join(__dirname, "phase12c-matrix-result.json"), JSON.stringify({ phase: "12C-D", suite: "cross-backend client matrix (vm, fetch محاكى)", note: "Worker خارج المصفوفة العميلية (ليس سجلّ طلبات المتجر)", pass: MAT.filter(m => m.pass).length, fail: MAT.filter(m => !m.pass).length, matrix: MAT }, null, 1)); console.log(fails ? "FAILED " + fails + "/" + n : "ALL PASS " + n + "/" + n); process.exit(fails ? 1 : 0);
})();
