/* اختبار عقد دالة الخادم platform/functions/ai في وضع Copilot (Deno مُحاكى): خصم واحد، استرداد مرة واحدة عند كل فشل (upstream/مهلة/إلغاء/مخرجات غير صالحة)،
   رفض الحدود بلا استدعاء Gemini ولا استرداد، تحقق خادمي من المخرجات، وعدم تسرّب المفتاح. منطق الحدود نفسه (التزامن/السقف اليومي) يُختبر على Postgres في test-copilot-limits.sh.
   تشغيل: node --experimental-strip-types --no-warnings scripts/test-copilot-fn.mjs */
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path"; import { fileURLToPath } from "node:url";
const __keep = setInterval(() => {}, 1000);
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "SRK", GEMINI_API_KEY: "GK-SECRET-123" };
let handler; globalThis.Deno = { env: { get: k => env[k] }, serve: h => { handler = h; } };
const S = { rpc: [], gem: 0, gemMode: "ok", gemBody: null, chargeReply: { ok: true, left: 5, spent: 3, cap: 200 }, rpcDown: false, refundFails: 0, onGem: null };
const gemOut = (txt) => ({ candidates: [{ content: { parts: [{ text: txt }] } }] });
globalThis.fetch = async (u, o) => {
  u = String(u); const b = o && o.body ? JSON.parse(o.body) : {};
  if (u.includes("/rpc/")) { const fn = u.split("/rpc/")[1]; S.rpc.push({ fn, b });
    if (S.rpcDown) return new Response("err", { status: 500 });
    if (fn === "saas_ai_charge2") return new Response(JSON.stringify(S.chargeReply));
    if (fn === "saas_ai_refund2") { if (S.refundFails > 0) { S.refundFails--; return new Response("err", { status: 500 }); } return new Response(JSON.stringify({ ok: true, refunded: true })); }
    return new Response(JSON.stringify({ ok: true, left: 9 })); }
  if (u.includes("generativelanguage")) { S.gem++; S.gemBody = b; if (S.onGem) S.onGem(); const m = S.gemMode;
    if (m === "ok") return new Response(JSON.stringify(gemOut(S.text)));
    if (m === "fail") return new Response("{}", { status: 503 });
    if (m === "hang") return await new Promise((res, rej) => { const sg = o.signal; if (sg.aborted) rej(new DOMException("aborted", "AbortError")); sg.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))); }); }
  throw new Error("unexpected " + u);
};
await import("../platform/functions/ai/index.ts");
const TK = "a".repeat(40), P = [{ text: "hello" }]; let n = 0;
const call = (body, ctl) => handler(new Request("https://f/ai", { method: "POST", body: JSON.stringify(Object.assign({ token: TK, kind: "text", parts: P, run: "run0001x", req: "req" + (++n) + "xxxx", validate: "copilot_envelope" }, body)), signal: ctl && ctl.signal }));
const reset = () => { S.rpc = []; S.gem = 0; S.gemMode = "ok"; S.chargeReply = { ok: true, left: 5, spent: 3, cap: 200 }; S.rpcDown = false; S.refundFails = 0; S.onGem = null; };
const cnt = fn => S.rpc.filter(x => x.fn === fn).length;
const ENV = { v: 1, ops: [{ id: "o1", op: "section.add", args: { name: "x" } }, { id: "o2", op: "layer.add", args: { section: "$x", layer: { type: "text", text: "{{price}}" } } }] };
let r, j;

reset(); S.text = JSON.stringify(ENV); r = await call({ key: "k1" }); j = await r.json();
t("نجاح: 200 ومخرجات مُحلَّلة ومُتحقَّق منها", r.status === 200 && j.ok && j.parsed && j.parsed.ops.length === 2, j);
t("خصم واحد بمعرّفات التشغيل/الطلب/المفتاح ولا استرداد", cnt("saas_ai_charge2") === 1 && cnt("saas_ai_refund2") === 0 && S.rpc[0].b.p_run === "run0001x" && S.rpc[0].b.p_key === "k1" && /^req/.test(S.rpc[0].b.p_req), S.rpc);
t("مفتاح Gemini يُضاف في الخادم فقط ولا يظهر في الردّ", !JSON.stringify(j).includes("GK-SECRET") && S.gem === 1);
t("مفاتيح الإعداد غير المسموحة تُسقط", (await (async () => { reset(); S.text = JSON.stringify(ENV); await call({ cfg: { temperature: .2, tools: [1], systemInstruction: "x" } }); return S.gemBody.generationConfig; })()).tools === undefined);

/* رفض الحدود: بلا استدعاء Gemini ولا استرداد (لأن شيئاً لم يُخصم) */
for (const [reason, st] of [["run_llm_limit", 429], ["run_img_limit", 429], ["run_tries_limit", 429], ["daily_cap", 429], ["duplicate_request", 409], ["no_credits", 402], ["unknown_token", 401], ["suspended", 402], ["expired", 402], ["bad_request", 400]]) {
  reset(); S.chargeReply = { ok: false, reason }; r = await call({}); j = await r.json();
  t("رفض " + reason + " ← " + st + " بلا Gemini ولا استرداد", r.status === st && j.error === reason && S.gem === 0 && cnt("saas_ai_refund2") === 0 && !!j.message, { st: r.status, j });
}
reset(); S.rpcDown = true; r = await call({}); t("تعطّل الفوترة 502 بلا استدعاء Gemini", r.status === 502 && S.gem === 0);

/* فشل upstream/مهلة/إلغاء ← استرداد واحد */
reset(); S.gemMode = "fail"; r = await call({}); j = await r.json(); t("فشل Gemini: 502 واسترداد واحد", r.status === 502 && cnt("saas_ai_refund2") === 1 && cnt("saas_ai_charge2") === 1 && /لم يُخصم/.test(j.message), { st: r.status, rpc: S.rpc.map(x => x.fn) });
reset(); S.gemMode = "hang"; let t0 = Date.now(); r = await call({ timeout_s: 1 }); j = await r.json(); t("المهلة: 504 واسترداد واحد خلال ~1ث", r.status === 504 && j.error === "timeout" && cnt("saas_ai_refund2") === 1 && Date.now() - t0 < 4000, { st: r.status, ms: Date.now() - t0 });
reset(); S.gemMode = "hang"; { const ctl = new AbortController(); S.onGem = () => setTimeout(() => ctl.abort(), 50); r = await call({ timeout_s: 30 }, ctl); j = await r.json(); }
t("الإلغاء من العميل: 499 واسترداد واحد", r.status === 499 && j.error === "cancelled" && cnt("saas_ai_refund2") === 1 && cnt("saas_ai_charge2") === 1, { st: r.status, rpc: S.rpc.map(x => x.fn) });
reset(); S.gemMode = "fail"; S.refundFails = 1; r = await call({}); t("فشل نداء الاسترداد الأول يُعاد مرة واحدة", r.status === 502 && cnt("saas_ai_refund2") === 2);

/* مخرجات غير صالحة ← 422 واسترداد، ولا مخرجات تُسلَّم */
const BADS = { "ليس JSON": "hello world", "غلاف فارغ": JSON.stringify({ v: 1, ops: [] }), "أمر ممنوع publish": JSON.stringify({ v: 1, ops: [{ op: "page.publish" }] }), "أمر product.update": JSON.stringify({ v: 1, ops: [{ op: "product.update", args: {} }] }), "أمر مجهول": JSON.stringify({ v: 1, ops: [{ op: "foo.bar" }] }),
  "سكربت داخل نص": JSON.stringify({ v: 1, ops: [{ op: "layer.add", args: { layer: { text: "<script>alert(1)</script>" } } }] }), "javascript:": JSON.stringify({ v: 1, ops: [{ op: "layer.add", args: { layer: { link: "javascript:alert(1)" } } }] }),
  "مفتاح __proto__": '{"v":1,"ops":[{"op":"layer.add","args":{"__proto__":{"x":1}}}]}', "args مصفوفة": JSON.stringify({ v: 1, ops: [{ op: "layer.add", args: [1] }] }), "أكثر من 120 أمراً": JSON.stringify({ v: 1, ops: Array.from({ length: 121 }, () => ({ op: "layer.delete", args: {} })) }), "جذر مصفوفة": "[1,2]" };
for (const [name, txt] of Object.entries(BADS)) { reset(); S.text = txt; r = await call({}); j = await r.json(); t("مخرجات غير صالحة (" + name + "): 422 واسترداد ولا بيانات", r.status === 422 && j.error === "invalid_output" && cnt("saas_ai_refund2") === 1 && !j.data && !j.parsed, { st: r.status, j }); }
reset(); S.text = "```json\n" + JSON.stringify(ENV) + "\n```"; r = await call({}); j = await r.json(); t("سياج ```json يُزال ويُقبل الغلاف الصالح", r.status === 200 && j.parsed.ops.length === 2);
reset(); S.text = JSON.stringify({ sections: ["a"] }); r = await call({ validate: "copilot_plan" }); t("خطة copilot_plan صالحة", r.status === 200);

/* الصور */
reset(); S.text = ""; r = await call({ kind: "image", validate: undefined, key: "asset1", parts: P }); j = await r.json(); t("صورة بلا inlineData: 422 واسترداد", r.status === 422 && j.why === "no_image" && cnt("saas_ai_refund2") === 1, j);
reset(); S.gemMode = "ok"; { const png = "A".repeat(400); S.text = null; const orig = globalThis.fetch; globalThis.fetch = async (u, o) => (String(u).includes("generativelanguage") ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: png } }] } }] })) : orig(u, o)); r = await call({ kind: "image", validate: undefined, key: "asset1" }); j = await r.json(); globalThis.fetch = orig; }
t("صورة صالحة: 200 وخصم واحد بلا استرداد", r.status === 200 && j.ok && cnt("saas_ai_charge2") === 1 && cnt("saas_ai_refund2") === 0 && S.rpc[0].b.p_kind === "image", { st: r.status });
reset(); { const orig = globalThis.fetch; globalThis.fetch = async (u, o) => (String(u).includes("generativelanguage") ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/svg+xml", data: "A".repeat(400) } }] } }] })) : orig(u, o)); r = await call({ kind: "image", validate: undefined, key: "asset1" }); globalThis.fetch = orig; }
t("صورة بنوع غير مسموح (svg) مرفوضة ومستردّة", r.status === 422 && cnt("saas_ai_refund2") === 1);

/* طلبات سيئة لا تُخصم أبداً */
for (const [name, body] of [["run قصير", { run: "x" }], ["req سيّئ", { req: "bad id!" }], ["key سيّئ", { key: "a b" }], ["نص بلا validate", { validate: undefined }], ["validate مجهول", { validate: "image" }]]) { reset(); S.text = JSON.stringify(ENV); r = await call(body); t("طلب سيّئ (" + name + ") 400 بلا خصم ولا Gemini", r.status === 400 && cnt("saas_ai_charge2") === 0 && S.gem === 0, { st: r.status }); }

/* التوافق: الوضع القديم بلا run لا يتغير */
reset(); S.text = "hi"; r = await handler(new Request("https://f/ai", { method: "POST", body: JSON.stringify({ token: TK, kind: "text", parts: P }) })); t("الوضع القديم (بلا run) يستعمل saas_ai_charge", r.status === 200 && cnt("saas_ai_charge") === 1 && cnt("saas_ai_charge2") === 0, S.rpc.map(x => x.fn));

/* تطابق قائمة الأوامر المسموحة بين الخادم والعميل */
{ const __d = path.dirname(fileURLToPath(import.meta.url)); const client = vm.runInNewContext(fs.readFileSync(path.join(__d, "pagebuilder-copilot.js"), "utf8") + ";PBCopilot.OPS", {}); const srv = /const COPILOT_OPS = \[([^\]]+)\]/.exec(fs.readFileSync(path.join(__d, "../platform/functions/ai/index.ts"), "utf8"))[1].match(/"[^"]+"/g).map(x => x.slice(1, -1));
  t("قائمة الأوامر في الخادم = قائمة العميل تماماً", JSON.stringify(client.filter(o => o !== "image.generate" || true).sort()) === JSON.stringify(srv.slice().sort()), { client, srv }); }
console.log(bad ? "فشل " + bad + " / " + (ok + bad) : "كل الفحوص نجحت (" + ok + ")"); clearInterval(__keep); process.exit(bad ? 1 : 0);
