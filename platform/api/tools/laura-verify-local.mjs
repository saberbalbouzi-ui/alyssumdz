/* يجرّب سكربت القبول نفسه على المنصة المحلية (Worker حقيقي في workerd + نموذج محاكى + بيانات مُخلَّقة): لا Cloudflare ولا إنتاج.
   يثبت أن منطق الفحوص يلتقط النجاح والفشل (بما فيها تسرّب سر مزروع) قبل تسليمه لمسؤول الإنتاج. WRANGLER_BIN مطلوب. */
import { startStack, ASECRET } from "./laura-local-stack.mjs";
import { run } from "./laura-prod-verify.mjs";
let bad = 0; const expect = (n, c) => { if (!c) bad++; console.log((c ? "OK   " : "BAD  ") + n); };
const quiet = () => { };
for (const writes of [true, false]) {
  console.log(`\n===== مكدّس محلي: LAURA_WRITES=${writes ? "on" : "off"} =====`);
  const stack = await startStack({ vars: writes ? {} : { LAURA_WRITES: "off" } });
  try {
    const A = await stack.mkTenant("VERIFY-STORE-A-SECRETNAME", { orders: 3 }), B = await stack.mkTenant("VERIFY-STORE-B", { orders: 2 });
    const base = { api: stack.BASE, keyA: A.key, keyB: B.key, actorSecret: ASECRET, tidA: A.id, tidB: B.id, llm: "mock", gapMs: 300, expectWrites: writes ? "on" : "off", allowSkip: true };
    const r = await run(base, console.log);
    expect(`[${writes ? "on" : "off"}] لا فشل في التشغيل السليم`, !r.results.some((x) => x.state === "FAIL"));
    expect(`[${writes ? "on" : "off"}] فحوص الدخول الحقيقي متخطّاة صراحةً (لا تُحسب نجاحاً)`, r.results.some((x) => x.id === "B1p" && x.state === "SKIP"));
    expect(`[${writes ? "on" : "off"}] بلا allowSkip تكون النتيجة 3 (غير مُثبَت)`, (await run({ ...base, allowSkip: false }, quiet)).code === 3);
    expect(`[${writes ? "on" : "off"}] توقّع وضع كتابة خاطئ يُكتشف (FAIL)`, (await run({ ...base, expectWrites: writes ? "off" : "on" }, quiet)).results.some((x) => x.id === "A2" && x.state === "FAIL"));
    expect(`[${writes ? "on" : "off"}] سرّ مزروع (اسم المتجر) في ردّ ← G1 يفشل`, (await run({ ...base, extraSecrets: ["VERIFY-STORE-A-SECRETNAME"] }, quiet)).results.some((x) => x.id === "G1" && x.state === "FAIL"));
    expect(`[${writes ? "on" : "off"}] مفتاح B خاطئ ← عزل لا يُخدع (D1 يمرّ لأن الرفض حقيقي)`, r.results.filter((x) => /^D[12]$/.test(x.id)).every((x) => x.state === "PASS"));
    if (writes) { const r2 = await run({ ...base, writeRef: A.refs[0], allowApprove: true }, quiet); expect("[on] موافقة حقيقية على طلب اختبار: E3/E4 تنجحان", ["E3", "E4"].every((id) => r2.results.find((x) => x.id === id)?.state === "PASS")); if (!["E3", "E4"].every((id) => r2.results.find((x) => x.id === id)?.state === "PASS")) console.log(JSON.stringify(r2.results.filter((x) => /^E/.test(x.id)))); }
  } finally { stack.stop(); }
}
console.log(bad ? "FAILED " + bad : "ALL OK"); process.exit(bad ? 1 : 0);
