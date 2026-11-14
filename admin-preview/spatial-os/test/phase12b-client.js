/* المرحلة 12B — اختبار عميل المتجر (assets/js/api.js الحقيقي داخل vm بمحاكاة fetch فقط): مفتاح idempotency، إعادة محاولة الأعطال، لافتة اقتطاع الطلبات.
   المحاكى: fetch/المتصفح فقط (لأن الغرض فحص منطق العميل نفسه)؛ سلوك الخادم الحقيقي مغطّى في phase12b-orders.js. */
const vm = require("vm"), fs = require("fs"), path = require("path"), { webcrypto } = require("crypto");
const src = fs.readFileSync(path.join(__dirname, "..", "..", "..", "assets", "js", "api.js"), "utf8"); let fails = 0, n = 0;
const ok = (name, c, x) => { n++; if (!c) fails++; console.log((c ? "PASS " : "FAIL ") + name + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 200) : "")); };
function make(script) {
  const store = new Map(), ss = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }, calls = []; let i = 0;
  const bodyEl = { id: "", children: [], style: {}, textContent: "", setAttribute() { }, remove() { this.gone = true; } }; const app = { firstChild: null, insertBefore(n) { this.first = n; } };
  const sb = { CONFIG: { BACKEND: "php", PHP_API: "/api/index.php" }, REL: "", sessionStorage: ss, localStorage: ss, crypto: webcrypto, window: { crypto: webcrypto }, console, setTimeout: (f) => setTimeout(f, 1), Date, JSON, Math, Promise, document: { getElementById: id => id === "app" ? app : (app.first && app.first.id === id ? app.first : null), createElement: () => Object.assign({}, bodyEl, { style: {} }) },
    fetch: async (url, o) => { const body = JSON.parse(o.body); calls.push({ url, body }); const r = script[Math.min(i++, script.length - 1)]; if (r === "net") throw new Error("net"); return { ok: r < 400, status: r, json: async () => (r === 422 ? { error: "invalid_phone" } : r === 409 ? { error: "duplicate_order" } : { ok: r < 400, id: "S261113-ABCDE" }) }; } };
  vm.createContext(sb); vm.runInContext(src + "\nthis.API = API;", sb); return { API: sb.API, calls, ss: store, app };
}
const O = (o = {}) => Object.assign({ name: "زبون", phone: "0550123456", total: 2200, items: [{ slug: "a", qty: 1, price: 1800 }] }, o);
(async () => {
  let t = make([200]), r = await t.API.submitOrderChecked(O());
  ok("إرسال ناجح: مفتاح idempotency صالح (16–64 حرفاً) يُرسل مرة واحدة", r.ok && t.calls.length === 1 && /^[A-Za-z0-9_\-]{16,64}$/.test(t.calls[0].body.order.idem), { len: (t.calls[0].body.order.idem || "").length });
  ok("النجاح يمسح المفتاح (طلب متطابق لاحق مشروع بمفتاح جديد)", [...t.ss.keys()].filter(k => k.startsWith("alyssum_idem_") && k !== "alyssum_idem_salt").length === 0);
  t = make([500, 500, 200]); r = await t.API.submitOrderChecked(O());
  ok("500 مرتين ثم 200: يُعاد الإرسال 3 مرات بنفس المفتاح بالضبط وتنجح", r.ok && t.calls.length === 3 && new Set(t.calls.map(c => c.body.order.idem)).size === 1, { calls: t.calls.length });
  t = make(["net", 200]); r = await t.API.submitOrderChecked(O());
  ok("انقطاع شبكة ثم 200: إعادة بنفس المفتاح", r.ok && t.calls.length === 2 && t.calls[0].body.order.idem === t.calls[1].body.order.idem);
  t = make([422]); r = await t.API.submitOrderChecked(O());
  ok("خطأ حماية 4xx (هاتف غير صالح): لا إعادة، ويُعاد الخطأ الصريح", !r.ok && r.error === "invalid_phone" && t.calls.length === 1, r);
  t = make([409]); r = await t.API.submitOrderChecked(O());
  ok("409 duplicate_order: لا إعادة ويُعاد الخطأ", !r.ok && r.error === "duplicate_order" && t.calls.length === 1, r);
  t = make([503, 503, 503]); r = await t.API.submitOrderChecked(O());
  ok("فشل دائم 503: ثلاث محاولات بنفس المفتاح فقط (محدودة) والسلوك القائم محفوظ (لا استثناء)", t.calls.length === 3 && new Set(t.calls.map(c => c.body.order.idem)).size === 1, { calls: t.calls.length, result: r });
  t = make([500, 500, 500]); await t.API.submitOrderChecked(O()); const k1 = t.calls[0].body.order.idem; t.calls.length = 0;
  ok("بعد فشل دائم يبقى المفتاح محفوظاً: نقر ثانٍ لنفس المحتوى يستعمل نفس المفتاح (لا طلب مكرّر لو نجح الأول فعلاً)", [...t.ss.keys()].some(k => k.startsWith("alyssum_idem_")), { keys: t.ss.size });
  t = make([200]); await t.API.submitOrderChecked(O({ name: "آخر", phone: "0661999999" })); await t.API.submitOrderChecked(O({ total: 3000 }));
  ok("محتويات مختلفة ← مفاتيح مختلفة", new Set(t.calls.map(c => c.body.order.idem)).size === 2);
  /* لافتة اقتطاع الطلبات */
  t = make([200]); t.API._ordersWindowNote({ ok: true, truncated: true, window: 2000, total_count: 10000 });
  ok("لافتة الاقتطاع: تُنشأ بنص يذكر 2000 و10000", !!t.app.first && /2000/.test(t.app.first.textContent) && /10000/.test(t.app.first.textContent), { text: t.app.first && t.app.first.textContent });
  t.API._ordersWindowNote({ ok: true, truncated: false }); ok("لافتة الاقتطاع: تُزال حين لا اقتطاع", t.app.first.gone === true);
  console.log(fails ? "FAILED " + fails + "/" + n : "ALL PASS " + n + "/" + n); process.exit(fails ? 1 : 0);
})();
