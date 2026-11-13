/* نقل نموذج اللغة (المرحلة 11) — المتصفح لا يحمل أي مفتاح: كل شيء عبر وسيط الخادم server/llm.php الذي يتحقق من جلسة اللوحة.
   هذه الوحدة نقل فقط: لا تنفّذ أدوات ولا تقرّر شيئاً؛ نواة الوكيل (core.js) هي التي تتحقق من كل استدعاء يقترحه النموذج وتنفّذه عبر سجل الأدوات. */
(() => {
  "use strict";
  if (window.AgentLLM) return;
  const SRV = "server/llm.php", XH = { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" };
  const S = { local: false, configured: false, probed: false, status: null, calls: 0, lastError: null, lastMs: 0, limits: { messages: 24, tools: 16, rounds: 4 } };
  async function post(body, ms) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms || 36000); let r;
    try { r = await fetch(SRV, { method: "POST", credentials: "same-origin", headers: XH, body: JSON.stringify(body), signal: ac.signal }); }
    catch (e) { const code = ac.signal.aborted ? "timeout" : "network"; S.lastError = code; return { ok: false, error: code }; } finally { clearTimeout(t); }
    const j = await r.json().catch(() => null); if (!j || typeof j !== "object") { S.lastError = "bad_response"; return { ok: false, error: "bad_response", status: r.status }; }
    if (!r.ok || !j.ok) { S.lastError = j.error || "http_" + r.status; return Object.assign({ ok: false, status: r.status }, j); } return j;
  }
  async function probe() { const j = await post({ action: "caps" }, 8000); S.probed = true; S.status = j.status || 200; S.configured = !!(j.ok && j.configured && j.chat); S.local = !!(j.ok && j.local); if (j.limits) S.limits = j.limits; return S.configured; }
  /* messages: [{role:user|model,text} | {role:model,calls:[{name,args}]} | {role:tool,results:[{name,response}]}] ؛ tools: [{name,description,parameters}] */
  async function chat(messages, tools) { const t0 = performance.now(); S.calls++; const j = await post({ action: "chat", messages, tools }, 36000); S.lastMs = Math.round(performance.now() - t0); if (j.ok) S.lastError = null; return j; }
  /* المحرّك المحلي (تجريبي): خطة أدوات مُنمَّطة من نموذج مفتوح الأوزان عبر الوسيط؛ لا يُنفَّذ شيء هنا */
  async function plan(text, ctx) { const t0 = performance.now(), j = await post({ action: "plan", text, ctx }, 14000); S.lastPlanMs = Math.round(performance.now() - t0); return j; }
  window.AgentLLM = Object.freeze({ version: 2, probe, chat, plan, available: () => S.configured, localAvailable: () => S.local, state: () => Object.assign({}, S) });
  probe();
})();
