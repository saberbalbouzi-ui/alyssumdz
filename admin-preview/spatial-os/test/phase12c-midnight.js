/* 12C-E — إعادة المحاولة عبر منتصف الليل (api.js الحقيقي داخل vm؛ المحاكى: fetch + الساعة فقط).
   الهوية: معرّف طلب Supabase اليدوي يولّده العميل بصيغة M<yymmdd>-<10hex>؛ مفتاح idempotency هو مصدر الهوية، والتاريخ تنسيق فقط ويجب ألا يغيّر المعرّف عبر إعادة المحاولة.
   يُشغَّل بمناطق زمنية مختلفة بإعادة تشغيل نفسه بمتغير TZ. التشغيل: node admin-preview/spatial-os/test/phase12c-midnight.js */
const vm = require("vm"), fs = require("fs"), path = require("path"), { webcrypto } = require("crypto"), { spawnSync } = require("child_process");
const ZONES = ["UTC", "Africa/Algiers", "Pacific/Kiritimati", "Pacific/Pago_Pago"];
if (!process.env.__ZONE_CHILD) {
  let fails = 0, n = 0, all = [];
  for (const tz of ZONES) { const r = spawnSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { TZ: tz, __ZONE_CHILD: "1" }), encoding: "utf8" }); process.stdout.write(r.stdout); if (r.stderr) process.stderr.write(r.stderr); const m = /ALL PASS (\d+)\/(\d+)|FAILED (\d+)\/(\d+)/.exec(r.stdout || ""); if (!m) { fails++; n++; } else if (m[3]) { fails += +m[3]; n += +m[4]; } else n += +m[2]; if (r.status) all.push(tz); }
  fs.writeFileSync(path.join(__dirname, "phase12c-midnight-result.json"), JSON.stringify({ phase: "12C-E", suite: "midnight idempotency (vm)", zones: ZONES, total: n, failed: fails, failedZones: all }, null, 1));
  console.log(fails ? "FAILED " + fails + "/" + n + " (كل المناطق)" : "ALL PASS " + n + "/" + n + " (كل المناطق: " + ZONES.join(", ") + ")"); process.exit(fails ? 1 : 0);
}
const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "..", "assets", "js", "api.js"), "utf8"); const TZ = process.env.TZ; let fails = 0, n = 0;
const ok = (name, c, x) => { n++; if (!c) fails++; console.log((c ? "PASS " : "FAIL ") + "[" + TZ + "] " + name + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 200) : "")); };
function env(opts) {
  opts = opts || {}; const store = opts.store || new Map(), ss = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: i => [...store.keys()][i], get length() { return store.size; } }; const clock = opts.clock || { t: Date.UTC(2026, 10, 13, 22, 59, 50) }, calls = [];
  const FD = class extends Date { constructor(...a) { if (a.length === 0) super(clock.t); else super(...a); } static now() { return clock.t; } };
  const sb = { CONFIG: Object.assign({ BACKEND: "", ORDERS_BACKEND: "supabase" }, opts.CONFIG || {}), REL: "", sessionStorage: ss, localStorage: ss, crypto: webcrypto, console, TextEncoder, URL, AbortController, Promise, JSON, Math, Date: FD, setTimeout: (f, ms) => setTimeout(f, Math.min(ms || 0, 5)), clearTimeout, document: { createElement: () => ({ style: {} }), head: { appendChild() { } } }, unescape, encodeURIComponent,
    fetch: async (url, o) => { const call = { url, method: (o && o.method) || "GET", body: o && o.body ? JSON.parse(o.body) : null, headers: (o && o.headers) || {} }; calls.push(call); const r = await opts.fetch(call, calls.length); if (r === "net") throw new Error("net"); return { ok: r.status >= 200 && r.status < 300, status: r.status, url, redirected: false, text: async () => (typeof r.raw === "string" ? r.raw : (r.body === undefined ? "" : JSON.stringify(r.body))) }; } };
  sb.window = sb; sb.globalThis = sb; vm.createContext(sb); vm.runInContext(SRC + "\nthis.API = API; this.OrderTruth = OrderTruth;", sb); sb.API.post = () => { }; sb.API.orderTimeout = 60;
  sb.API.sb = { enabled: () => true, url: p => "https://x.supabase.co" + p, headers: t => Object.assign({ apikey: "k" }, t ? { Authorization: "Bearer " + t } : {}), token: async () => "jwt" }; if (opts.php) { sb.API.php = { on: () => true, url: p => "/api/index.php?r=" + p }; }
  return { API: sb.API, T: sb.OrderTruth, calls, store, clock };
}
const ORDER = () => ({ name: "كريم مرابط", phone: "0550123456", wilaya: "الجزائر", commune: "الحراش", dtype: "home", desk: "", items: [{ slug: "tarkiz", title: "قطرات التركيز", qty: 1, price: 1800 }], subtotal: 1800, fee: 600, discount: 0, total: 2400, coupon: "", extra: { "✍️ طلب يدوي": "نعم" } });
function fakeDb(drop) { const rows = new Map(); let ins = 0; return { rows, get ins() { return ins; }, h: (c) => { if (c.method === "POST") { ins++; const r = c.body; if (rows.has(r.id)) return { status: 409, body: { message: "duplicate key" } }; rows.set(r.id, r); if (drop && ins === 1) return "net"; return { status: 201, body: [r] }; }
  const id = decodeURIComponent((c.url.match(/id=eq\.([^&]+)/) || [])[1] || ""); return { status: 200, body: rows.has(id) ? [rows.get(id)] : [] }; } }; }
const localDate = t => { const d = new Date(t); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
/* نختار لحظة أولى تقع قبل منتصف الليل المحلي بـ10 ثوانٍ في هذه المنطقة بالذات، ثم نتقدّم 25 ثانية */
const base = new Date(Date.UTC(2026, 10, 13, 12, 0, 0)); let t0 = base.getTime(); { const d = new Date(t0); const nxt = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0).getTime(); t0 = nxt - 10000; }
(async () => {
  /* M1: Supabase يدوي — نفس المفتاح عبر منتصف الليل ← نفس المعرّف */
  { const db = fakeDb(true), clock = { t: t0 }, e = env({ fetch: db.h, clock }); const r1 = await e.API.addOrder(ORDER()); const d1 = localDate(clock.t); clock.t += 25000; const d2 = localDate(clock.t); const r2 = await e.API.addOrder(ORDER());
    ok("[M1] الاختبار فعلاً يعبر منتصف الليل المحلي (تاريخان مختلفان)", d1 !== d2, { d1, d2 });
    ok("[M1] أول محاولة ضاع ردّها ← UNKNOWN بلا معرّف مختلق", r1.state === "UNKNOWN" && r1.id === "");
    ok("[M1] الإعادة بعد منتصف الليل بالمفتاح نفسه ← المعرّف نفسه (DUPLICATE_CONFIRMED) وصف واحد فقط في القاعدة", r2.state === "DUPLICATE_CONFIRMED" && db.rows.size === 1 && db.ins === 2 && r2.key === r1.key, { rows: db.rows.size, ids: [...db.rows.keys()], state: r2.state }); }
  /* M2: التاريخ تنسيق لا هوية — المعرّف يحمل تاريخ إنشاء المفتاح، وتبقى صيغته صالحة */
  { const db = fakeDb(false), clock = { t: t0 }, e = env({ fetch: db.h, clock }); const r = await e.API.addOrder(ORDER()); const d = new Date(t0), yymmdd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    ok("[M2] المعرّف صالح الصيغة وبادئته تاريخ لحظة إنشاء المفتاح (وليس لحظة لاحقة)", r.ok && r.id.indexOf("M" + yymmdd + "-") === 0 && e.T.ID_RX.test(r.id), { id: r.id, yymmdd }); }
  /* M3: ساعة جهاز العميل منحرفة (±3 أيام) — لا تكسر الصيغة ولا تكرّر */
  for (const skew of [-3, 3]) { const db = fakeDb(true), clock = { t: t0 + skew * 86400000 }, e = env({ fetch: db.h, clock }); const r1 = await e.API.addOrder(ORDER()); clock.t += 25000; const r2 = await e.API.addOrder(ORDER());
    ok("[M3] ساعة العميل منحرفة " + skew + " أيام: صيغة صالحة وإعادة بلا تكرار", r2.ok && e.T.ID_RX.test(r2.id) && db.rows.size === 1 && r1.key === r2.key, { rows: db.rows.size }); }
  /* M4: إعادة تحميل الصفحة (تخزين الجلسة نفسه، نسخة JS جديدة) بعد منتصف الليل */
  { const db = fakeDb(true), clock = { t: t0 }, e1 = env({ fetch: db.h, clock }); await e1.API.addOrder(ORDER()); clock.t += 40000; const e2 = env({ fetch: db.h, clock, store: e1.store }); const r2 = await e2.API.addOrder(ORDER());
    ok("[M4] بعد «إعادة تحميل» (نفس sessionStorage) وعبور منتصف الليل: المفتاح نفسه والمعرّف نفسه وصف واحد", r2.state === "DUPLICATE_CONFIRMED" && db.rows.size === 1, { rows: db.rows.size, state: r2.state }); }
  /* M5: جلسة/تبويب جديد (تخزين جديد) ← مفتاح جديد؛ ضمان النظام لا يشمله (موثَّق) */
  { const db = fakeDb(true), clock = { t: t0 }, e1 = env({ fetch: db.h, clock }); const r1 = await e1.API.addOrder(ORDER()); clock.t += 25000; const e2 = env({ fetch: db.h, clock }); const r2 = await e2.API.addOrder(ORDER());
    ok("[M5] جلسة جديدة بلا تخزين: مفتاح جديد (لا ضمان تكرار عبر الجلسات) — السلوك الموثَّق", r1.key !== r2.key && db.rows.size === 2, { rows: db.rows.size }); }
  /* M6: انتهاء نافذة المفتاح (30 دقيقة) عبر منتصف الليل ← مفتاح جديد */
  { const db = fakeDb(true), clock = { t: t0 }, e = env({ fetch: db.h, clock }); const r1 = await e.API.addOrder(ORDER()); clock.t += 31 * 60000; const r2 = await e.API.addOrder(ORDER()); ok("[M6] بعد انتهاء النافذة (31 دقيقة) ← مفتاح جديد (لا يُعاد استعمال مفتاح منتهٍ)", r1.key !== r2.key); }
  /* M7: PHP — المعرّف يولّده الخادم ويعيده المخزَّن؛ مفتاح العميل لا يتأثر بمنتصف الليل. الخادم يحفظ ثم تضيع كل الردود في أول 3 محاولات (إعادة تلقائية)، ثم تُعاد بعد منتصف الليل */
  { const orders = new Map(); let seq = 0, nCalls = 0; const h = (c) => { nCalls++; const k = c.body.order.idem; let id = orders.get(k), dup = !!id; if (!id) { id = "M" + String(++seq).padStart(6, "0") + "-AAAAAAAA"; orders.set(k, id); } return nCalls <= 3 ? "net" : { status: 200, body: dup ? { ok: true, id, duplicate: true } : { ok: true, id } }; };
    const clock = { t: t0 }, e = env({ fetch: h, clock, php: true, CONFIG: { BACKEND: "php" } }); const r1 = await e.API.submitOrderTruth(ORDER()); clock.t += 25000; const r2 = await e.API.submitOrderTruth(ORDER());
    ok("[M7] PHP: الإرسال الأول ضاعت ردوده كلها ← UNKNOWN (3 محاولات بمفتاح واحد)", r1.state === "UNKNOWN" && orders.size === 1, { s1: r1.state, size: orders.size });
    ok("[M7] PHP: الإعادة بعد منتصف الليل بالمفتاح نفسه ← الطلب الأصلي بمعرّف الخادم المخزَّن (DUPLICATE_CONFIRMED) وبلا طلب ثانٍ", r2.state === "DUPLICATE_CONFIRMED" && orders.size === 1 && r2.key === r1.key && /^M000001-/.test(r2.id), { size: orders.size, s2: r2.state, id: r2.id }); }
  console.log(fails ? "FAILED " + fails + "/" + n : "ALL PASS " + n + "/" + n); process.exit(fails ? 1 : 0);
})();
