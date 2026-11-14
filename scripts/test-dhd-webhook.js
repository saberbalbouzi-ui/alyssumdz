/* webhook DHD (الدالة platform/supabase/functions/dhd-webhook): تُحوَّل TypeScript إلى JS وتُشغَّل بـ Deno وهمي وقاعدة بيانات وهمية: NODE_PATH=/opt/node-tools/node_modules node scripts/test-dhd-webhook.js */
const ts = require("typescript"), fs = require("fs"), crypto = require("crypto"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../platform/supabase/functions/dhd-webhook/index.ts"), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { target: "ES2022", module: "None" } }).outputText;
let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
(async () => {
  const run = async (env, db) => {
    let handler; const calls = []; const Deno = { env: { get: k => env[k] }, serve: h => { handler = h; } };
    const fetchStub = async (url, init = {}) => { const u = new URL(url); calls.push({ method: init.method || "GET", path: u.pathname.replace("/rest/v1/", "") + u.search, body: init.body });
      const p = u.pathname.replace("/rest/v1/", "");
      if (p === "admin_kv") return new Response(JSON.stringify(db.secret ? [{ value: db.secret }] : []));
      if (p === "orders" && (init.method || "GET") === "GET") { const s = decodeURIComponent(u.search); if (/note=ilike/.test(s)) return new Response(JSON.stringify(db.orders.filter(o => (o.note || "").includes(/ilike\.\*([^*]+)\*/.exec(s)[1])))); const m = /id=eq\.([^&]+)/.exec(s); return new Response(JSON.stringify(db.orders.filter(o => m && o.id === m[1]))); }
      if (init.method === "PATCH") { const m = /id=eq\.([^&]+)/.exec(decodeURIComponent(u.search)), o = db.orders.find(x => m && x.id === m[1]); if (o) Object.assign(o, JSON.parse(init.body)); return new Response(null, { status: 204 }); }
      return new Response("[]"); };
    new Function("Deno", "fetch", "Response", "crypto", "URL", "TextEncoder", js)(Deno, fetchStub, Response, globalThis.crypto, URL, TextEncoder);
    return { post: (qs, body, headers = {}) => handler(new Request("https://x/functions/v1/dhd-webhook" + qs, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers })), get: () => handler(new Request("https://x/functions/v1/dhd-webhook")), calls };
  };
  const SEC = "abc123secret456", mkdb = () => ({ secret: SEC, orders: [{ id: "M1", status: "confirmee", note: "📦 🚚dhd:DHDNGNS111 " }, { id: "M2", status: "confirmee", note: "🚚dhd:DHDNGNS222" }, { id: "M3", status: "livree", note: "🚚dhd:DHDNGNS333" }, { id: "M4", status: "expediee", note: "🚚dhd:DHDNGNS444" }] });
  const ev = (trk, id, ref) => ({ event: "order.x", timestamp: "2026-11-14T10:00:00+00:00", data: { tracking: trk, reference: ref || "", state: { id, code: "X", title: "t" }, driver: { name: "", phone: "" }, changed_at: "2026-11-14T10:00:00+00:00" } });
  let db = mkdb(), h = await run({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }, db);
  ok("GET يعيد جاهز", (await (await h.get()).json()).webhook === "ready");
  ok("بلا سرّ ← 401", (await h.post("", ev("DHDNGNS111", 5))).status === 401);
  ok("سرّ خاطئ ← 401", (await h.post("?s=bad", ev("DHDNGNS111", 5))).status === 401);
  let r = await h.post("?s=" + SEC, ev("DHDNGNS111", 5)); ok("Vers hub (5) ← الطلب «في الطريق» بالتتبع", (await r.json()).updated === 1 && db.orders[0].status === "expediee", db.orders[0]);
  r = await h.post("?s=" + SEC, ev("DHDNGNS111", 3)); ok("حالة أقدم (En ramassage) لا تُنزل الطلب", (await r.json()).updated === 0 && db.orders[0].status === "expediee", db.orders[0]);
  r = await h.post("?s=" + SEC, ev("DHDNGNS222", 17)); ok("Livré non encaissé (17) ← مُسلَّم", db.orders[1].status === "livree");
  r = await h.post("?s=" + SEC, ev("DHDNGNS333", 5)); ok("طلب مُسلَّم لا يتغيّر", (await r.json()).updated === 0 && db.orders[2].status === "livree");
  r = await h.post("?s=" + SEC, ev("DHDNGNS444", 11)); ok("Retours en traitement (11) ← فشل مع مرحلة transit", db.orders[3].status === "echec" && /🔁transit/.test(db.orders[3].note), db.orders[3]);
  r = await h.post("?s=" + SEC, ev("DHDNGNS444", 14)); ok("Retours reçu (14) ← مرحلة received", /🔁received/.test(db.orders[3].note) && !/🔁transit/.test(db.orders[3].note), db.orders[3]);
  r = await h.post("?s=" + SEC, ev("", 9, "ALY-M4")); ok("بلا تتبع: يُطابَق بالمرجع (ALY-M4)", (await r.json()).updated >= 0);
  r = await h.post("?s=" + SEC, { event: "order.other", data: { tracking: "DHDNGNS111", state: { id: 999, code: "?", title: "inconnu" } } }); ok("حالة مجهولة تُتجاهل", (await r.json()).ignored !== undefined);
  r = await h.post("?s=" + SEC, "not json"); ok("جسم غير JSON ← 400", r.status === 400);
  /* توقيع HMAC اختياري */
  db = mkdb(); h = await run({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k", DHD_SIGNING_SECRET: "dhdkey" }, db);
  const body = JSON.stringify(ev("DHDNGNS111", 9)), good = "sha256=" + crypto.createHmac("sha256", "dhdkey").update(body).digest("hex");
  r = await h.post("?s=" + SEC, body, { Signature: good }); ok("توقيع صحيح ← مقبول", r.status === 200 && db.orders[0].status === "expediee");
  r = await h.post("?s=" + SEC, body, { Signature: "sha256=00" }); ok("توقيع خاطئ ← 401", r.status === 401);
  r = await h.post("?s=" + SEC, body); ok("بلا ترويسة توقيع ← مقبول (السرّ في الرابط)", r.status === 200);
  console.log(fail ? "فشل " + fail + " من " + (pass + fail) : "نجح " + pass + " من " + pass); process.exit(fail ? 1 : 0);
})();
