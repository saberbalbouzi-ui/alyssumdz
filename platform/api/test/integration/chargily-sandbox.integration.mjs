#!/usr/bin/env node
/* اختبار Chargily **Sandbox** لـBeta. الأوضاع:
     --stub   : تدريب محلي بلا شبكة. fetch محاكى (SIMULATED) يسجّل كل طلب صادر؛ يُثبت الحراسات (سياسة egress الحقيقية من envguard، رفض المفاتيح الحيّة، توقيع الـwebhook بدالة المنصة الفعلية) وأن أي مسار مالي حيّ لا يخرج. ليس تكاملاً حقيقياً.
     (افتراضي): الحقيقي — يتطلب BETA_CHARGILY_TEST_SECRET_KEY (test_… فقط). ناقص ← "RESULT: SKIPPED" (رمز 0؛ مع --require رمز 3). SKIPPED ≠ نجاح.
   في الوضع الحقيقي كل fetch يمرّ عبر guardFetch بسياسة Beta: لا يصل شيء إلى غير https://pay.chargily.net/test/api/v2/*. يُنشئ جلسة دفع اختبارية واحدة بمبلغ رمزي (لا أموال حقيقية في بيئة test) ثم يُنهي صلاحيتها؛ لا يدفعها ولا يُرسل webhook خارجياً.
   لا يطبع المفتاح. يرفض أي مفتاح لا يبدأ بـ test_ وأي قيمة تبدأ بـ live_ أو sk_live. */
import { pathToFileURL } from "node:url";
import path from "node:path";
const HERE = path.dirname(new URL(import.meta.url).pathname), SRC = path.resolve(HERE, "../../src");
const { default: R } = await import(pathToFileURL(path.join(SRC, "env-registry.js")).href);
const { egressPolicy, egressAllowed, guardFetch, EgressBlocked } = await import(pathToFileURL(path.join(SRC, "envguard.js")).href);
const { hmacHex, safeEq } = await import(pathToFileURL(path.join(SRC, "util.js")).href);
const { CHARGILY } = await import(pathToFileURL(path.join(SRC, "modules/payments.js")).href);
const TEST = "https://pay.chargily.net/test/api/v2", LIVE = "https://pay.chargily.net/api/v2";
let pass = 0, fail = 0; const ok = (m, c, x) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  " + String(JSON.stringify(x)).slice(0, 240))); };
const end = (r, code) => { console.log("RESULT: " + r); process.exit(code); };
export const keyProblem = (k) => { k = String(k ?? ""); if (!k) return "المفتاح مفقود"; if (/^(live_|sk_live)/i.test(k) || /live/i.test(k.slice(0, 12))) return "مفتاح حيّ — مرفوض"; if (!/^test_/i.test(k)) return "المفتاح لا يبدأ بـtest_ — مرفوض"; return null; };
const policy = egressPolicy(R, { ENVIRONMENT: "beta" });

async function common(fetchFn, key, mode) {
  /* G: حراسات المفتاح */
  ok("[G1] مفتاح test_ مقبول", keyProblem("test_sk_FAKE") === null);
  ok("[G2] مفتاح live_/sk_live_ مرفوض", !!keyProblem("live_sk_FAKE") && !!keyProblem("sk_live_FAKE"));
  ok("[G3] مفتاح بلا بادئة test_ مرفوض", !!keyProblem("abc123") && !!keyProblem(""));
  /* E: سياسة الخروج الحقيقية لـBeta */
  ok("[E1] قاعدة Chargily الاختبارية مسموحة", egressAllowed(policy, TEST + "/checkouts") && egressAllowed(policy, TEST + "/balance"));
  ok("[E2] قاعدة Chargily الحيّة محظورة (Beta)", !egressAllowed(policy, LIVE + "/checkouts") && !egressAllowed(policy, "https://pay.chargily.net/api/v2/balance"));
  ok("[E3] مضيفات أخرى محظورة (مزوّدو دفع/توصيل/إيميل/واتساب/Production)", ["https://api.yalidine.app/v1/parcels", "https://api.resend.com/emails", "https://graph.facebook.com/v19.0/x/messages", "https://qvdaiundlkfbmjlummni.supabase.co/rest/v1/orders", "https://alyssumdz.com/", "https://pay.chargily.dz/api"].every((u) => !egressAllowed(policy, u)));
  ok("[E4] ثابت CHARGILY.test في المنصة يطابق قاعدة الاختبار المسجَّلة", CHARGILY.test === TEST && CHARGILY.live === LIVE);
  /* W: توقيع webhook بدالة المنصة الفعلية */
  const raw = JSON.stringify({ id: "evt_beta_probe", type: "checkout.paid", data: { id: "chk_beta_probe", amount: 1000, currency: "dzd" } }), sig = await hmacHex(key, raw);
  ok("[W1] توقيع HMAC-SHA256 hex بالمفتاح نفسه يطابق ويُرفض أي مفتاح/جسم آخر", safeEq(sig, await hmacHex(key, raw)) && !safeEq(sig, await hmacHex(key + "x", raw)) && !safeEq(sig, await hmacHex(key, raw + " ")) && /^[0-9a-f]{64}$/.test(sig));
  /* B: كتل fetch المحمي */
  const g = guardFetch(fetchFn, policy); let blocked = null; try { await g(LIVE + "/checkouts", { method: "POST" }); } catch (e) { blocked = e; }
  ok("[B1] guardFetch يرمي EgressBlocked قبل خروج أي طلب إلى القاعدة الحيّة", blocked instanceof EgressBlocked, blocked?.message);
  return g;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--stub")) {
    const log = []; const stub = async (url, init = {}) => { log.push({ url: String(url), method: init.method || "GET" }); const u = String(url); if (u.endsWith("/checkouts") && init.method === "POST") return new Response(JSON.stringify({ id: "chk_stub", livemode: false, checkout_url: "https://pay.chargily.net/test/pay/chk_stub", status: "pending" }), { status: 201 }); return new Response("{}", { status: 200 }); };
    const g = await common(stub, "test_sk_STUB", "stub");
    await g(TEST + "/balance"); await g(TEST + "/checkouts", { method: "POST", body: "{}" });
    ok("[S1] الطلبات المحاكاة التي خرجت كلها إلى قاعدة الاختبار فقط (محاكاة SIMULATED)", log.length === 2 && log.every((l) => l.url.startsWith(TEST + "/")), log);
    ok("[S2] لا مسار مالي حيّ بين الطلبات الصادرة (لا /api/v2 بلا /test/)", !log.some((l) => /pay\.chargily\.net\/api\/v2/.test(l.url)));
    end(`${pass} pass / ${fail} fail (STUB — محاكاة محلية، ليس تكاملاً حقيقياً)`, fail ? 1 : 0);
  }
  const key = process.env.BETA_CHARGILY_TEST_SECRET_KEY;
  if (!key) end("SKIPPED (missing: BETA_CHARGILY_TEST_SECRET_KEY) — لم يُشغَّل؛ ليس نجاحاً", argv.includes("--require") ? 3 : 0);
  const kp = keyProblem(key); if (kp) end("FAIL: " + kp + " — رُفض قبل أي اتصال", 2);
  const calls = []; const wrapped = async (u, i) => { calls.push(String(u)); return fetch(u, i); }, g = await common(wrapped, key, "real"); calls.length = 0;
  const H = { Authorization: "Bearer " + key, "Content-Type": "application/json" }; let id = null;
  try {
    const bal = await g(TEST + "/balance", { headers: H }); ok("[R1] قراءة الرصيد التجريبي تنجح بالمفتاح (HTTP 200)", bal.status === 200, bal.status);
    const bj = await bal.json().catch(() => ({})); ok("[R2] الحساب في وضع الاختبار (livemode=false)", bj.livemode === false || bj.live_mode === false || bal.url?.includes("/test/"), Object.keys(bj));
    const co = await g(TEST + "/checkouts", { method: "POST", headers: H, body: JSON.stringify({ amount: 1000, currency: "dzd", payment_method: "edahabia", success_url: "https://alyssum-beta-web.contact-alyssumbio.workers.dev/ok", metadata: { order_id: "beta-probe", beta: true } }) });
    const cj = await co.json().catch(() => ({})); id = cj.id; ok("[R3] إنشاء جلسة دفع اختبارية يُرجع معرّفاً ورابطاً على pay.chargily.net", co.status >= 200 && co.status < 300 && !!id && /^https:\/\/pay\.chargily\.net\//.test(String(cj.checkout_url)), { status: co.status });
    ok("[R4] الجلسة اختبارية (livemode=false) وحالتها pending ولم تُدفع", cj.livemode === false && (cj.status === "pending" || !cj.status), { livemode: cj.livemode, status: cj.status });
    if (id) { const rd = await g(`${TEST}/checkouts/${id}`, { headers: H }); const rj = await rd.json().catch(() => ({})); ok("[R5] قراءة الجلسة تعيد المعرّف نفسه بحالة غير مدفوعة", rd.status === 200 && rj.id === id && rj.status !== "paid", { status: rd.status, st: rj.status }); }
  } catch (e) { ok("[X] استثناء: " + String(e.message).slice(0, 160), false); }
  finally { if (id) { try { await g(`${TEST}/checkouts/${id}/expire`, { method: "POST", headers: H }); console.log("تنظيف: طُلب إنهاء صلاحية جلسة الاختبار"); } catch { console.log("تنظيف: تعذّر إنهاء الجلسة (تنتهي تلقائياً)"); } } }
  ok("[R6] كل الطلبات الصادرة ذهبت إلى قاعدة الاختبار فقط", calls.length > 0 && calls.every((u) => u.startsWith(TEST + "/")), calls.map((u) => u.replace(/\/chk_[^/]+/, "/<id>")));
  end(`${pass} pass / ${fail} fail`, fail ? 1 : 0);
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
