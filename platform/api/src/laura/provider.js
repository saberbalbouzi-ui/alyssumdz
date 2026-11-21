/* محوّل مزوّد النموذج (بروتوكول generateContent مع استدعاء الدوال). المفتاح من أسرار الـWorker فقط (LAURA_LLM_KEY) ولا يخرج منه أبداً — لا في ردّ ولا خطأ ولا سجلّ.
   الاتصال عبر ctx.fetchFn (فيخضع لحارس الخروج في البيئات غير الإنتاجية). أخطاء مصنَّفة بلا نصّ المزوّد الخام (قد يحوي أجزاء من الطلب). */
export class LlmError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
export const DEFAULT_ENDPOINT = "https://generativelanguage.googleapis.com", DEFAULT_MODEL = "gemini-2.0-flash";
export function llmConfig(config) { const c = config ?? {}; return { key: String(c.LAURA_LLM_KEY ?? ""), endpoint: String(c.LAURA_LLM_ENDPOINT || DEFAULT_ENDPOINT).replace(/\/+$/, ""), model: String(c.LAURA_MODEL || DEFAULT_MODEL).replace(/[^A-Za-z0-9._-]/g, ""), timeoutMs: Math.min(60000, Math.max(200, +c.LAURA_TIMEOUT_MS || 20000)) }; }
export const llmConfigured = (config) => !!llmConfig(config).key;
/** contents: [{role:"user"|"model", parts:[{text}|{functionCall}|{functionResponse}]}] ؛ tools: [{name,description,parameters}] — يُرجع { text, calls:[{name,args}], raw_parts } */
export async function generate(config, fetchFn, { system, contents, tools, maxTokens = 700 }) {
  const c = llmConfig(config); if (!c.key) throw new LlmError(503, "llm_unconfigured", "نموذج LAURA غير مُهيّأ على الخادم");
  const body = { systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens }, ...(tools?.length ? { tools: [{ functionDeclarations: tools }], toolConfig: { functionCallingConfig: { mode: "AUTO" } } } : {}) };
  let last = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ac = new AbortController(), timer = setTimeout(() => ac.abort(), c.timeoutMs); let res;
    try { res = await fetchFn(`${c.endpoint}/v1beta/models/${c.model}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": c.key }, body: JSON.stringify(body), signal: ac.signal }); }
    catch (e) { last = ac.signal.aborted ? new LlmError(504, "llm_timeout", "انتهت مهلة النموذج") : new LlmError(502, "llm_unavailable", "تعذّر الاتصال بالنموذج"); clearTimeout(timer); if (attempt === 0 && !ac.signal.aborted) { await new Promise((r) => setTimeout(r, 250)); continue; } throw last; }
    clearTimeout(timer);
    if (res.status === 429) throw new LlmError(429, "llm_rate_limited", "النموذج مشغول مؤقتاً");
    if (res.status === 401 || res.status === 403) throw new LlmError(502, "llm_auth", "رفض مزوّد النموذج الاعتماد (راجع إعداد الخادم)");
    if (res.status >= 500) { last = new LlmError(502, "llm_unavailable", "خطأ في مزوّد النموذج"); if (attempt === 0) { await new Promise((r) => setTimeout(r, 250)); continue; } throw last; }
    if (res.status < 200 || res.status >= 300) throw new LlmError(502, "llm_bad_request", "طلب النموذج مرفوض");
    let j; try { j = JSON.parse(await res.text()); } catch { throw new LlmError(502, "llm_bad_response", "ردّ النموذج غير صالح"); }
    const cand = j?.candidates?.[0]; const parts = Array.isArray(cand?.content?.parts) ? cand.content.parts : [];
    if (!cand || (!parts.length && cand.finishReason && cand.finishReason !== "STOP")) throw new LlmError(502, "llm_blocked", "لم يُنتج النموذج ردّاً");
    const text = parts.filter((p) => typeof p.text === "string").map((p) => p.text).join("").trim(), calls = parts.filter((p) => p.functionCall && typeof p.functionCall.name === "string").map((p) => ({ name: p.functionCall.name, args: p.functionCall.args && typeof p.functionCall.args === "object" ? p.functionCall.args : {} }));
    return { text, calls, parts, usage: j.usageMetadata ? { in: j.usageMetadata.promptTokenCount ?? 0, out: j.usageMetadata.candidatesTokenCount ?? 0 } : null };
  }
  throw last ?? new LlmError(502, "llm_unavailable", "تعذّر الاتصال بالنموذج");
}
