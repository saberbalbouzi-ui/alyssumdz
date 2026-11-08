/* اختبار دالة ai-video (Veo بمفتاح الصور + رصيد الفيديو) بمحاكاة Deno وGemini وSupabase — بلا شبكة:
     NODE_PATH=/opt/node-tools/node_modules node scripts/test-ai-video.mjs */
import { createRequire } from "node:module"; import { readFileSync, writeFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path"; import { pathToFileURL, fileURLToPath } from "node:url";
const require = createRequire(import.meta.url); const ts = require("typescript");
let total = 0, fails = 0; const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } else console.log("✓", n); };
const src = readFileSync(new URL("../platform/supabase/functions/ai-video/index.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { target: "ES2022", module: "ESNext" } }).outputText;
const dir = mkdtempSync(join(tmpdir(), "aiv-")), file = join(dir, "f.mjs"); writeFileSync(file, js);
const ENV = { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE_KEY: "srk", GEMINI_API_KEY: "GK" }; let handler;
globalThis.Deno = { env: { get: k => ENV[k] }, serve: h => { handler = h; } };
const state = { calls: [], charge: { ok: true, left: 4 }, refunds: 0, veo: "ok", opDone: false, opFail: false };
globalThis.fetch = async (url, o = {}) => {
  const u = String(url); state.calls.push([u, o.method || "GET", o.body]);
  if (u.includes("/rpc/saas_ai_charge")) return new Response(JSON.stringify(state.charge), { status: 200 });
  if (u.includes("/rpc/saas_ai_refund")) { state.refunds++; return new Response("null", { status: 200 }); }
  if (/\/v1beta\/models\?/.test(u)) return new Response(JSON.stringify({ models: [{ name: "models/veo-2.0-generate-001", supportedGenerationMethods: ["generateContent"] }, { name: "models/veo-3.0-generate-001", supportedGenerationMethods: ["predictLongRunning"] }, { name: "models/veo-3.1-fast-generate-preview", supportedGenerationMethods: ["predictLongRunning"] }, { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }] }), { status: 200 });
  if (u.includes(":predictLongRunning")) return state.veo === "ok" ? new Response(JSON.stringify({ name: "models/veo-3.1-fast-generate-preview/operations/op1" }), { status: 200 }) : new Response(JSON.stringify({ error: { message: "bad image" } }), { status: 400 });
  if (u.includes("/operations/op1")) return new Response(JSON.stringify(state.opFail ? { done: true, response: { generateVideoResponse: { raiMediaFilteredReasons: ["blocked"] } } } : state.opDone ? { done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: "https://generativelanguage.googleapis.com/v1beta/files/abc:download?alt=media" } }] } } } : { done: false }), { status: 200 });
  if (u.includes("/files/abc:download")) return new Response(new Uint8Array(1024), { status: 200, headers: { "content-type": "video/mp4" } });
  return new Response("{}", { status: 404 });
};
await import(pathToFileURL(file).href);
const call = async (b) => { const r = await handler(new Request("https://x.test/", { method: "POST", body: JSON.stringify(b) })); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { } return { s: r.status, j, len: t.length, h: r.headers.get("content-type") }; };
const TOKEN = "b".repeat(40), IMG = "data:image/png;base64,iVBORw0KGgo=";
ok("بلا رمز ولا جلسة ← 400", (await call({ action: "submit" })).s === 400);
let r = await call({ token: TOKEN, action: "submit", model: "veo", body: { prompt: "p", image_url: IMG, aspect_ratio: "9:16", duration: "5" } });
ok("إرسال Veo ينجح ويعيد روابط veo-s/veo-r", r.s === 200 && r.j.status_url === "veo-s:models/veo-3.1-fast-generate-preview/operations/op1#5" && r.j.left === 4, r);
const pc = state.calls.find(c => c[0].includes(":predictLongRunning")), pb = JSON.parse(pc[2]);
const chg = state.calls.find(c => c[0].includes("/rpc/saas_ai_charge_n"));
ok("التسعير بالثواني: يُخصم n = مدة الفيديو (5 وحدات) عبر saas_ai_charge_n", chg && JSON.parse(chg[2]).p_n === 5 && JSON.parse(chg[2]).p_kind === "video", chg && chg[2]);
ok("الاكتشاف: يُجرَّب السريع الأحدث المدعوم فقط (لا veo-2 غير المدعوم)", pc[0].includes("veo-3.1-fast-generate-preview") && state.calls.some(c => /\/v1beta\/models\?/.test(c[0])), pc[0]);
ok("الجسم: صورة base64 ونسبة 9:16 ومدة من {4,6,8}", pb.instances[0].image.bytesBase64Encoded === "iVBORw0KGgo=" && pb.instances[0].image.mimeType === "image/png" && pb.parameters.aspectRatio === "9:16" && [4, 6, 8].includes(pb.parameters.durationSeconds), pb);
ok("المفتاح الخادمي في الترويسة لا في الرابط", pc[0].indexOf("GK") < 0);
r = await call({ token: TOKEN, action: "get", url: "veo-s:models/veo-3.1-fast-generate-preview/operations/op1" });
ok("الحالة: قيد التنفيذ", r.j.status === "IN_PROGRESS", r);
state.opDone = true; r = await call({ token: TOKEN, action: "get", url: "veo-s:models/veo-3.1-fast-generate-preview/operations/op1" });
ok("الحالة: مكتمل", r.j.status === "COMPLETED", r);
r = await call({ token: TOKEN, action: "get", url: "veo-r:models/veo-3.1-fast-generate-preview/operations/op1" });
ok("النتيجة: رابط plat: للتنزيل عبر الدالة", /^plat:https:\/\/generativelanguage\.googleapis\.com\/v1beta\/files\/abc:download/.test(r.j.video.url), r);
r = await call({ token: TOKEN, action: "dl", uri: "https://generativelanguage.googleapis.com/v1beta/files/abc:download?alt=media" });
ok("التنزيل يعيد ملف الفيديو", r.s === 200 && r.len === 1024 && r.h === "video/mp4", r);
ok("رابط تنزيل غريب مرفوض", (await call({ token: TOKEN, action: "dl", uri: "https://evil.test/x" })).s === 400);
ok("اسم عملية غريب مرفوض", (await call({ token: TOKEN, action: "get", url: "veo-s:../../secrets" })).s === 400);
ok("رابط طابور غريب مرفوض", [400, 503].includes((await call({ token: TOKEN, action: "get", url: "https://evil.test/x" })).s));
state.veo = "bad"; state.refunds = 0; r = await call({ token: TOKEN, action: "submit", model: "veo", body: { prompt: "p" } });
ok("فشل الإنشاء ← 502 ويُردّ الرصيد", r.s === 502 && state.refunds === 1 && /لم يُخصم/.test(r.j.message), [r, state.refunds]);
state.veo = "ok"; state.charge = { ok: false, reason: "no_credits" }; r = await call({ token: TOKEN, action: "submit", model: "veo", body: { prompt: "p" } });
ok("انتهاء الرصيد ← 402 برسالة شراء رصيد", r.s === 402 && /رصيد/.test(r.j.message), r);
state.charge = { ok: true, left: 1 }; state.opDone = true; state.opFail = true; state.refunds = 0;
r = await call({ token: TOKEN, action: "get", url: "veo-s:models/veo-3.1-fast-generate-preview/operations/op1" }); await call({ token: TOKEN, action: "get", url: "veo-s:models/veo-3.1-fast-generate-preview/operations/op1" });
ok("فشل المهمة (حجب) ← FAILED ويُردّ الرصيد مرة واحدة فقط", r.j.status === "FAILED" && state.refunds === 1, [r, state.refunds]);
r = await call({ token: TOKEN, action: "submit", model: "fal-ai/hunyuan3d", body: {} });
ok("نموذج 3D بلا FAL_KEY ← not_configured", r.s === 503 && r.j.error === "not_configured", r);
r = await call({ token: TOKEN, action: "submit", model: "evil/x", body: {} });
ok("نموذج غير مسموح مرفوض", r.s === 400, r);

/* بديل fal عند غياب Veo: نسخة ثانية من الوحدة بسرّ FAL_KEY مضبوط */
ENV.FAL_KEY = "fk"; state.veo = "bad"; state.charge = { ok: true, left: 3 };
const f0 = globalThis.fetch; globalThis.fetch = async (url, o = {}) => /queue\.fal\.run/.test(String(url)) ? new Response(JSON.stringify({ request_id: "q1", status_url: "https://queue.fal.run/fal-ai/kling-video/requests/q1/status", response_url: "https://queue.fal.run/fal-ai/kling-video/requests/q1" }), { status: 200 }) : f0(url, o);
await import(pathToFileURL(file).href + "?fal=1");
r = await call({ token: TOKEN, action: "submit", model: "veo", body: { prompt: "p" } });
ok("Veo غير متاح + FAL_KEY ← بديل fal ينجح بصيغة الطابور", r.s === 200 && r.j.request_id === "q1" && /kling/.test(r.j.model), r);

/* مفتاحان باسمين مختلفين: يُعتمد من يرى Veo منهما («Gemini API Key» هنا) ويُستعمل في الإرسال */
{ ENV.FAL_KEY = ""; ENV.GEMINI_API_KEY = "BADKEY1111"; ENV["Gemini API Key"] = "GOODKEY2222"; state.veo = "ok"; state.charge = { ok: true, left: 2 }; const seenKeys = [];
  const f1 = globalThis.fetch; globalThis.fetch = async (url, o = {}) => { const u = String(url), k = (o.headers || {})["x-goog-api-key"]; if (/\/v1beta\/models\?/.test(u)) { seenKeys.push(k); return k === "GOODKEY2222" ? f1(url, o) : new Response(JSON.stringify({ models: [{ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }] }), { status: 200 }); }
    if (u.includes(":predictLongRunning")) seenKeys.push("P:" + k); return f1(url, o); };
  await import(pathToFileURL(file).href + "?two=1");
  const r2 = await call({ token: TOKEN, action: "submit", model: "veo", body: { prompt: "p" } });
  ok("مفتاحان: يُختار من يرى Veo ويُرسل به", r2.s === 200 && seenKeys.includes("GOODKEY2222") && seenKeys.includes("P:GOODKEY2222") && !seenKeys.includes("P:BADKEY1111"), [r2.s, seenKeys]); }

/* Gemini Omni (بلا Veo): Interactions API متزامن بتسليم رابط ملف */
{ ENV.FAL_KEY = ""; ENV.GEMINI_API_KEY = "OMNIKEY3333"; delete ENV["Gemini API Key"]; state.charge = { ok: true, left: 5 }; const reqs = [];
  const f2 = globalThis.fetch; globalThis.fetch = async (url, o = {}) => { const u = String(url);
    if (/\/v1beta\/models\?/.test(u)) return new Response(JSON.stringify({ models: [{ name: "models/gemini-omni-flash-preview", supportedGenerationMethods: ["generateContent"] }, { name: "models/gemini-omni-1.2-flash", supportedGenerationMethods: ["generateContent"] }, { name: "models/gemini-omni-1.1-flash", supportedGenerationMethods: ["generateContent"] }, { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }] }), { status: 200 });
    if (/\/v1beta\/interactions$/.test(u)) { const b = JSON.parse(o.body); reqs.push(b); if (b.response_format && globalThis.__omni400) return new Response(JSON.stringify({ error: { message: "bad response_format" } }), { status: 400 });
      return new Response(JSON.stringify({ id: "v1_x", status: "completed", steps: [{ type: "user_input" }, { type: "model_output", content: [{ type: "video", mime_type: "video/mp4", uri: "https://generativelanguage.googleapis.com/v1beta/files/vid1:download?alt=media" }] }] }), { status: 200 }); }
    return f2(url, o); };
  await import(pathToFileURL(file).href + "?omni=1");
  let ro = await call({ token: TOKEN, action: "submit", model: "veo", body: { prompt: "p", image_url: IMG, aspect_ratio: "9:16", duration: "5" } });
  ok("Omni: يُستعمل بلا Veo ويعيد رابط plat: للتنزيل", ro.s === 200 && /^plat:https:\/\/generativelanguage\.googleapis\.com\/v1beta\/files\/vid1:download/.test(ro.j?.video?.url) && /omni-1\.2/.test(ro.j.model), ro);
  const b0 = reqs[0] || { input: [{}, {}], response_format: {} };
  ok("Omni: الجسم input صورة+نص وresponse_format فيديو 9:16 و5s وdelivery uri", b0.input[0].type === "image" && b0.input[0].mime_type === "image/png" && b0.input[1].type === "text" && b0.response_format.aspect_ratio === "9:16" && b0.response_format.duration === "5s" && b0.response_format.delivery === "uri", b0);
  globalThis.__omni400 = true; reqs.length = 0; ro = await call({ token: TOKEN, action: "submit", model: "veo", body: { prompt: "p", image_url: IMG } });
  ok("Omni: رفض 400 لـresponse_format ← إعادة بصيغة أبسط (generation_config)", ro.s === 200 && reqs.length === 2 && reqs[1].generation_config.video_config.task === "image_to_video", [ro.s, reqs.length]); }
console.log(fails ? `\n✗ فشل ${fails} من ${total}` : `\nنجح ${total} من ${total}`); process.exit(fails ? 1 : 0);
