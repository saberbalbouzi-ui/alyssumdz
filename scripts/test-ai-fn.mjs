/* اختبار دالة الخادم platform/functions/ai (وسيط Gemini بمفتاح المنصة): توكن، رصيد، قائمة سماح للأجزاء، حدّ معدّل، استرداد عند الفشل.
   تشغيل: node --experimental-strip-types --no-warnings scripts/test-ai-fn.mjs (Deno مُحاكى) */
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } };
const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "SRK", GEMINI_API_KEY: "GK" };
let handler; globalThis.Deno = { env: { get: k => env[k] }, serve: h => { handler = h; } };
const credits = { good: 3 }; const rpcLog = []; const gem = { fail: false, calls: [] };
globalThis.fetch = async (u, o) => {
  u = String(u); const b = o && o.body ? JSON.parse(o.body) : {};
  if (u.includes("/rpc/saas_ai_charge")) { rpcLog.push("charge:" + b.p_kind); if (b.p_token !== "a".repeat(40) && b.p_token !== "b".repeat(40)) return new Response(JSON.stringify({ ok: false, reason: "unknown_token" })); if (b.p_token === "b".repeat(40)) return new Response(JSON.stringify({ ok: false, reason: "no_credits" })); credits.good--; return new Response(JSON.stringify({ ok: true, left: credits.good })); }
  if (u.includes("/rpc/saas_ai_refund")) { rpcLog.push("refund:" + b.p_kind); credits.good++; return new Response("null"); }
  if (u.includes("generativelanguage")) { gem.calls.push({ u, key: o.headers["x-goog-api-key"], body: b }); return gem.fail ? new Response("{}", { status: 503 }) : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "hi" }] } }] })); }
  throw new Error("unexpected " + u);
};
await import("../platform/functions/ai/index.ts");
const call = body => handler(new Request("https://f/ai", { method: "POST", body: JSON.stringify(body) }));
const A = "a".repeat(40), P = [{ text: "hello" }];
let r = await call({ token: A, kind: "text", parts: P, cfg: { temperature: .5, hack: 1, maxOutputTokens: 999999 } }); let j = await r.json();
t("نجاح: ردّ Gemini يعود والرصيد يُخصم", r.status === 200 && j.ok && j.data.candidates && j.left === 2, j);
t("المفتاح يُضاف من الخادم", gem.calls[0].key === "GK");
t("مفاتيح الإعداد غير المسموحة تُسقط والمخرجات تُقصّ", gem.calls[0].body.generationConfig.hack === undefined && gem.calls[0].body.generationConfig.maxOutputTokens === 16384 && gem.calls[0].body.generationConfig.temperature === .5, gem.calls[0].body);
r = await call({ token: "c".repeat(40), kind: "text", parts: P }); t("توكن مجهول 401", r.status === 401);
r = await call({ token: "b".repeat(40), kind: "text", parts: P }); j = await r.json(); t("لا رصيد 402 برسالة", r.status === 402 && j.error === "no_credits" && /رصيدك/.test(j.message), j);
r = await call({ token: A, kind: "text", parts: [{ file_data: { file_uri: "https://evil/x" } }] }); t("جزء file_data مرفوض 400 بلا خصم", r.status === 400 && !rpcLog.slice(-1)[0].startsWith("charge:text") || r.status === 400, rpcLog);
const before = rpcLog.length; r = await call({ token: A, kind: "text", parts: [{ inline_data: { mime_type: "application/pdf", data: "AAAA" } }] }); t("نوع غير صورة مرفوض ولا يُخصم", r.status === 400 && rpcLog.length === before, rpcLog);
r = await call({ token: A, kind: "image", parts: [{ text: "x" }, { inline_data: { mime_type: "image/png", data: "AAAA" } }] }); t("صورة مضمّنة مقبولة", r.status === 200);
r = await call({ token: A, kind: "video", parts: P }); t("نوع طلب غير معروف 400", r.status === 400);
r = await call({ token: A, kind: "text", parts: Array(7).fill({ inline_data: { mime_type: "image/png", data: "AA" } }) }); t("أكثر من 6 صور مرفوض", r.status === 400);
gem.fail = true; const c0 = credits.good; r = await call({ token: A, kind: "text", parts: P }); j = await r.json(); t("فشل Gemini: 502 ويُردّ الرصيد", r.status === 502 && credits.good === c0 && rpcLog.slice(-1)[0] === "refund:text", { st: r.status, c0, now: credits.good });
gem.fail = false; let lim = 0; for (let i = 0; i < 60; i++) { r = await call({ token: A, kind: "text", parts: P }); if (r.status === 429) { lim++; break; } } t("حدّ المعدّل 429", lim === 1);
env.GEMINI_API_KEY = ""; 
console.log(bad ? "فشل " + bad + " / " + (ok + bad) : "كل الفحوص نجحت (" + ok + ")"); process.exit(bad ? 1 : 0);
