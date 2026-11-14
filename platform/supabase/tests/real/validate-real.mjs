#!/usr/bin/env node
/* التحقق الحقيقي من Supabase (PostgREST + RPC submit_order + idempotency + RLS) — يُشغَّل يدوياً على **مشروع اختباري مخصّص فقط**.
   لم يُشغَّل على أي مشروع في المرحلة 12C (لا مشروع اختباري متاح) ← الحالة BLOCKED. لا يُرسل ولا يطبع أي مفتاح.
   المتغيّرات (من بيئة الصدفة فقط؛ لا تُكتب في ملفات):
     SB_TEST_URL=https://<ref>.supabase.co   SB_TEST_CONFIRM_REF=<ref> (يجب أن يطابق ref في الرابط)
     SB_TEST_ANON_KEY  SB_TEST_SERVICE_KEY (قراءة التحقق والتنظيف)  SB_TEST_ADMIN_JWT (جلسة مدير اختباري)  SB_TEST_USER_JWT (مستخدم عادي غير مدير)
   حراسة: يرفض التشغيل إن تطابق الـref مع مشروع الإنتاج المعروف أو مع SB_PROD_REFS، أو غاب التأكيد.   --selfcheck: يختبر الحراسة بلا شبكة.
   ⚠ يفترض أن schema.sql المحدَّث (order_idem + submit_order بالمفتاح) طُبِّق على المشروع الاختباري فقط بعد مراجعته. */
const DENY = new Set(["qvdaiundlkfbmjlummni", ...String(process.env.SB_PROD_REFS || "").split(",").map(s => s.trim()).filter(Boolean)]);
export function guard(env) {
  const url = String(env.SB_TEST_URL || ""), m = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(url);
  if (!m) return { ok: false, why: "SB_TEST_URL غير صالح (يلزم https://<ref>.supabase.co)" };
  if (DENY.has(m[1])) return { ok: false, why: "المشروع ضمن قائمة الإنتاج — مرفوض" };
  if (env.SB_TEST_CONFIRM_REF !== m[1]) return { ok: false, why: "SB_TEST_CONFIRM_REF لا يطابق ref الرابط (تأكيد صريح أن المشروع اختباري)" };
  for (const k of ["SB_TEST_ANON_KEY", "SB_TEST_SERVICE_KEY"]) if (!env[k]) return { ok: false, why: "ينقص " + k };
  return { ok: true, ref: m[1] };
}
if (process.argv.includes("--selfcheck")) {
  const T = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) process.exitCode = 1; };
  const ok = { SB_TEST_URL: "https://abcdefghijklmnopqrst.supabase.co", SB_TEST_CONFIRM_REF: "abcdefghijklmnopqrst", SB_TEST_ANON_KEY: "x", SB_TEST_SERVICE_KEY: "y" };
  T("يقبل مشروعاً اختبارياً مؤكَّداً", guard(ok).ok); T("يرفض مشروع الإنتاج المعروف", !guard({ ...ok, SB_TEST_URL: "https://qvdaiundlkfbmjlummni.supabase.co", SB_TEST_CONFIRM_REF: "qvdaiundlkfbmjlummni" }).ok);
  T("يرفض غياب التأكيد", !guard({ ...ok, SB_TEST_CONFIRM_REF: "" }).ok); T("يرفض ref غير مطابق", !guard({ ...ok, SB_TEST_CONFIRM_REF: "zzzzzzzzzzzzzzzzzzzz" }).ok); T("يرفض رابطاً غير supabase", !guard({ ...ok, SB_TEST_URL: "https://evil.example" }).ok); T("يرفض غياب المفاتيح", !guard({ ...ok, SB_TEST_SERVICE_KEY: "" }).ok);
  process.exit(process.exitCode || 0);
}
const G = guard(process.env); if (!G.ok) { console.error("REFUSED: " + G.why); process.exit(2); }
const U = process.env.SB_TEST_URL.replace(/\/$/, ""), ANON = process.env.SB_TEST_ANON_KEY, SVC = process.env.SB_TEST_SERVICE_KEY, ADM = process.env.SB_TEST_ADMIN_JWT, USR = process.env.SB_TEST_USER_JWT;
const H = (k, jwt) => ({ apikey: k, Authorization: "Bearer " + (jwt || k), "Content-Type": "application/json" });
const rpc = (name, body, k = ANON, jwt) => fetch(U + "/rest/v1/rpc/" + name, { method: "POST", headers: H(k, jwt), body: JSON.stringify(body) }).then(async r => ({ s: r.status, t: await r.text() }));
const sel = (q) => fetch(U + "/rest/v1/" + q, { headers: H(SVC) }).then(r => r.json());
const R = []; const T = (n, c, x) => { R.push({ n, pass: !!c }); console.log((c ? "PASS " : "FAIL ") + n + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 160) : "")); };
const TAG = "12c-" + Date.now(), O = (o = {}) => ({ name: "اختبار 12C", phone: "0550" + String(Math.floor(Math.random() * 1e6)).padStart(6, "0"), wilaya: "الجزائر", commune: "الحراش", dtype: "home", items: [{ slug: "t", title: "منتج اختبار", qty: 1, price: 1000 }], subtotal: 1000, fee: 0, total: 1000, discount: 0, extra: { __12c: TAG }, ...o });
const idOf = t => { try { const j = JSON.parse(t); return typeof j === "string" ? j : ""; } catch { return ""; } }, rx = /^[A-Za-z]{1,3}\d{6}-[A-Za-z0-9]{5,16}$/;
const key = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
(async () => {
  const k1 = key(), o1 = O(); let r = await rpc("submit_order", { p: { ...o1, idem: k1 } }); const id1 = idOf(r.t); T("A3 طلب صالح ← 200 ونص معرّف صالح", r.s === 200 && rx.test(id1), { s: r.s });
  let rows = await sel("orders?id=eq." + encodeURIComponent(id1) + "&select=id,name,phone,total"); T("A3 قراءة الصف من القاعدة تطابق المعرّف والمجموع", rows.length === 1 && rows[0].id === id1 && Number(rows[0].total) === 1000);
  r = await rpc("submit_order", { p: { ...O({ name: "x" }), idem: key() } }); T("A3 payload غير صالح ← 4xx صريح لا نجاح", r.s >= 400 && !rx.test(idOf(r.t)), { s: r.s, t: r.t.slice(0, 60) });
  r = await rpc("submit_order", { p: { ...o1, idem: k1 } }); T("A4 نفس المفتاح والمحتوى ← المعرّف الأصلي نفسه", r.s === 200 && idOf(r.t) === id1);
  rows = await sel("orders?phone=eq." + o1.phone + "&select=id"); T("A4 صف واحد فقط بعد الإعادة", rows.length === 1);
  r = await rpc("submit_order", { p: { ...o1, total: 2000, idem: k1 } }); T("A4 نفس المفتاح بمحتوى مختلف ← idempotency_key_reuse", r.s >= 400 && /idempotency_key_reuse/.test(r.t), { s: r.s });
  const k2 = key(), o2 = O(), rs = await Promise.all(Array.from({ length: 10 }, () => rpc("submit_order", { p: { ...o2, idem: k2 } }))); const ids = new Set(rs.filter(x => x.s === 200).map(x => idOf(x.t)));
  rows = await sel("orders?phone=eq." + o2.phone + "&select=id"); T("A4 10 طلبات متزامنة بالمفتاح نفسه ← معرّف واحد وصف واحد", ids.size === 1 && rows.length === 1, { ids: ids.size, rows: rows.length, st: [...new Set(rs.map(x => x.s))] });
  const many = await Promise.all(Array.from({ length: 100 }, () => rpc("submit_order", { p: { ...O(), idem: key() } }))); const good = many.filter(x => x.s === 200 && rx.test(idOf(x.t))), gids = good.map(x => idOf(x.t)); const found = gids.length ? await sel("orders?id=in.(" + gids.join(",") + ")&select=id") : [];
  T("A4 100 طلباً بمفاتيح مختلفة: كل نجاح له صف فعلي ومعرّفاته فريدة (الفشل صريح، مثل حدود المعدّل)", new Set(gids).size === gids.length && found.length === gids.length, { ok: good.length, other: many.length - good.length });
  /* RLS (مشروع واحد = متجر واحد في هذا المخطط؛ لا tenant_id داخل المشروع — العزل بين المتاجر = مشروع لكل متجر) */
  let q = await fetch(U + "/rest/v1/orders?select=id&limit=1", { headers: H(ANON) }); let j = await q.json().catch(() => null); T("A5 anon لا يقرأ orders", (q.status === 200 && Array.isArray(j) && j.length === 0) || q.status >= 400, { s: q.status });
  q = await fetch(U + "/rest/v1/orders?id=eq." + encodeURIComponent(id1), { method: "DELETE", headers: { ...H(ANON), Prefer: "return=representation" } }); j = await q.json().catch(() => null); T("A5 anon لا يحذف", (Array.isArray(j) && j.length === 0) || q.status >= 400);
  q = await fetch(U + "/rest/v1/orders?id=eq." + encodeURIComponent(id1), { method: "PATCH", headers: { ...H(ANON), Prefer: "return=representation" }, body: JSON.stringify({ status: "annulee" }) }); j = await q.json().catch(() => null); T("A5 anon لا يعدّل", (Array.isArray(j) && j.length === 0) || q.status >= 400);
  q = await fetch(U + "/rest/v1/order_idem?select=k&limit=1", { headers: H(ANON) }); j = await q.json().catch(() => null); T("A5 anon لا يصل إلى order_idem", q.status >= 400 || (Array.isArray(j) && j.length === 0), { s: q.status });
  if (USR) { q = await fetch(U + "/rest/v1/orders?select=id&limit=1", { headers: H(ANON, USR) }); j = await q.json().catch(() => null); T("A5 مستخدم عادي (غير مدير) لا يقرأ orders", Array.isArray(j) && j.length === 0, { s: q.status }); } else T("A5 مستخدم عادي — لم يُمرَّر SB_TEST_USER_JWT", false, "NOT TESTED");
  if (ADM) { q = await fetch(U + "/rest/v1/orders?select=id&limit=1", { headers: H(ANON, ADM) }); j = await q.json().catch(() => null); T("A5 المدير يقرأ orders", Array.isArray(j) && j.length >= 1); } else T("A5 مدير — لم يُمرَّر SB_TEST_ADMIN_JWT", false, "NOT TESTED");
  /* تنظيف: يحذف صفوف هذا التشغيل فقط (الوسم داخل extra) */
  await fetch(U + "/rest/v1/orders?extra->>__12c=eq." + TAG, { method: "DELETE", headers: H(SVC) });
  console.log(R.every(x => x.pass) ? "ALL PASS " + R.length : "FAILED " + R.filter(x => !x.pass).length + "/" + R.length); process.exit(R.every(x => x.pass) ? 0 : 1);
})();
