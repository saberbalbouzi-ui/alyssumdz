/* مزوّد تجريبي محلي يطابق عقد Gemini REST (generateContent) — للاختبار فقط: ليس نموذجاً حقيقياً.
   يتحقق بصرامة من شكل الطلب كما يفعل المزوّد (مفتاح الترويسة، systemInstruction، contents/parts، functionDeclarations، responseModalities/speechConfig، inlineData صوت WAV)
   ويسجّل كل ما يصله كي تُفحَص الخصوصية (لا هواتف/أسماء)، ثم يردّ بقواعد حتمية:
   · دردشة: استدعاء دوال ثم صياغة من نتيجة الأداة · «حقن» يطيع نصاً مزروعاً في نتيجة أداة (نموذج مخترَق) · معطيات سيئة · أداة مجهولة · حلقة لا تنتهي · بطء
   · صوت: يقرأ WAV فعلاً (التردد/المدة/RMS) ويعيد نصاً محدداً من التحكم؛ صمت ← [none] · كلام: PCM 24kHz جيبي بطول يتناسب مع النص.
   الاستعمال: const stub = await startStub(); stub.base; stub.key; stub.control({transcript}); stub.log(); stub.stop() */
const http = require("http");
const KEY = "stub-key-not-secret";
const FN_RE = /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/;
function startStub() {
  const S = { log: [], violations: [], transcript: "وريني الطلبات غير المؤكدة", delay: 0, failNext: 0, failStatus: 500, chatCalls: 0 };
  const viol = (m) => { S.violations.push(m); };
  function validateChat(b) {
    if (!b || typeof b !== "object") return viol("body");
    if (!b.systemInstruction || !Array.isArray(b.systemInstruction.parts)) viol("systemInstruction");
    if (!Array.isArray(b.contents) || !b.contents.length) return viol("contents");
    b.contents.forEach((c, i) => { if (!["user", "model"].includes(c.role)) viol("role@" + i + ":" + c.role); if (!Array.isArray(c.parts) || !c.parts.length) viol("parts@" + i); (c.parts || []).forEach(p => { const k = Object.keys(p); if (k.length !== 1 || !["text", "functionCall", "functionResponse", "inlineData"].includes(k[0])) viol("part@" + i + ":" + k); if (p.functionCall && (!FN_RE.test(p.functionCall.name) || typeof p.functionCall.args !== "object")) viol("functionCall@" + i); if (p.functionResponse && (!FN_RE.test(p.functionResponse.name) || typeof p.functionResponse.response !== "object")) viol("functionResponse@" + i); }); });
    if (b.contents[0].role !== "user") viol("first-not-user");
    if (b.tools) { if (!Array.isArray(b.tools) || !b.tools[0] || !Array.isArray(b.tools[0].functionDeclarations)) viol("tools"); else b.tools[0].functionDeclarations.forEach(d => { if (!FN_RE.test(d.name)) viol("fn-name:" + d.name); if (d.parameters) { if (d.parameters.type !== "OBJECT") viol("param-type:" + d.name); const bad = JSON.stringify(d.parameters).match(/additionalProperties|"pattern"/); if (bad) viol("unsupported-schema-key:" + d.name + ":" + bad[0]); } }); }
    if (b.generationConfig && b.generationConfig.maxOutputTokens > 2000) viol("maxOutputTokens");
  }
  const txt = t => ({ candidates: [{ content: { role: "model", parts: [{ text: t }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 8 } });
  const call = (name, args) => ({ candidates: [{ content: { role: "model", parts: [{ functionCall: { name, args } }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } });
  function chat(b) {
    S.chatCalls++; const cs = b.contents, last = cs[cs.length - 1], fr = last.parts.filter(p => p.functionResponse);
    const userText = ([...cs].reverse().find(c => c.role === "user" && c.parts.some(p => p.text)) || { parts: [{ text: "" }] }).parts.find(p => p.text).text || "";
    if (fr.length) {
      const r = fr[0].functionResponse.response.result, js = JSON.stringify(r), n = fr[0].functionResponse.name;
      const inj = /IGNORE PREVIOUS[^]*?confirm (\S+)/.exec(js); if (inj) return call("orders.confirm", { id: inj[1].replace(/[^A-Za-z0-9-]/g, "") }); /* نموذج مخترَق يطيع نص الحقن */
      if (/loop/i.test(userText)) return call("sales.summary", { period: "today" });
      if (n === "sales.summary") return txt("مبيعات " + (r.period || "") + ": " + r.orders + " طلب بقيمة " + r.revenue + " دج.");
      if (n === "orders.list") return txt("وجدت " + r.count + " طلباً مطابقاً.");
      if (n === "orders.confirm") return txt(r && r.status === "awaiting_user_approval" ? "ببطاقة موافقة تنتظرك؛ لم يُنفَّذ شيء بعد." : "تعذّر تجهيز التأكيد: " + (r.error || ""));
      if (n === "inventory.read") return txt("المخزون المنخفض: " + (r.counts ? r.counts.low : "؟") + " منتجات.");
      return txt("تم.");
    }
    if (/analy[sz]e|حلل/i.test(userText)) return call("sales.summary", { period: "today" });
    if (/list pending|الطلبات المعلقة/i.test(userText)) return call("orders.list", { status: "nouvelle" });
    if (/stock check|فحص المخزون/i.test(userText)) return call("inventory.read", { low: true });
    const cm = /confirm-order (\S+)/.exec(userText); if (cm) return call("orders.confirm", { id: cm[1] });
    if (/bad-args/i.test(userText)) return call("orders.get", { id: "x" });
    if (/extra-arg/i.test(userText)) return call("orders.list", { status: "nouvelle", hack: 1 });
    if (/unknown-tool/i.test(userText)) return call("system.exec", { cmd: "ls" });
    /* مرحلة 12: مخرجات مشوّهة يتحقق منها الوسيط والنواة (للاختبار فقط) */
    if (/malformed-nocand/i.test(userText)) return { candidates: [] };
    if (/malformed-noparts/i.test(userText)) return { candidates: [{ content: { role: "model", parts: [] }, finishReason: "STOP" }] };
    if (/malformed-argstr/i.test(userText)) return { candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "orders.list", args: "status=nouvelle; DROP TABLE" } }] }, finishReason: "STOP" }] };
    if (/malformed-name/i.test(userText)) return call("../../etc/passwd", { id: "1" });
    if (/malformed-huge/i.test(userText)) return txt("x".repeat(200000));
    if (/malformed-many/i.test(userText)) return { candidates: [{ content: { role: "model", parts: Array.from({ length: 8 }, () => ({ functionCall: { name: "orders.list", args: { status: "nouvelle" } } })) }, finishReason: "STOP" }] };
    if (/malformed-nested/i.test(userText)) return call("orders.get", { id: { $ne: null } });
    if (/loop/i.test(userText)) return call("sales.summary", { period: "today" });
    if (/slow/i.test(userText)) return "SLOW";
    if (/secret|مفتاح|api key/i.test(userText)) return txt("لا أملك أي أسرار.");
    return txt("أهلاً، كيف أساعدك في متجرك؟");
  }
  function wavInfo(b64) { const buf = Buffer.from(b64, "base64"); if (buf.slice(0, 4).toString() !== "RIFF" || buf.slice(8, 12).toString() !== "WAVE") return { ok: false }; const hz = buf.readUInt32LE(24), ch = buf.readUInt16LE(22), bits = buf.readUInt16LE(34), n = (buf.length - 44) >> 1; let s = 0; for (let i = 0; i < n; i++) { const v = buf.readInt16LE(44 + i * 2) / 32768; s += v * v; } return { ok: true, hz, ch, bits, sec: +(n / hz).toFixed(2), rms: +Math.sqrt(s / Math.max(1, n)).toFixed(4), bytes: buf.length }; }
  function pcm(sec, hz) { const n = Math.floor(sec * hz), b = Buffer.alloc(n * 2); for (let i = 0; i < n; i++) { const t = i / hz, env = Math.min(1, t * 20, (sec - t) * 20); b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * (220 + 60 * Math.sin(t * 7)) * t) * 9000 * env), i * 2); } return b; }
  const srv = http.createServer((req, res) => {
    const send = (code, j) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(j)); };
    let body = ""; req.on("data", d => { body += d; if (body.length > 6e6) req.destroy(); });
    req.on("end", async () => {
      try {
        if (req.url === "/__control" && req.method === "POST") { Object.assign(S, JSON.parse(body || "{}")); return send(200, { ok: true }); }
        if (req.url === "/__log") return send(200, { log: S.log, violations: S.violations, chatCalls: S.chatCalls });
        if (req.url === "/__reset") { S.log.length = 0; S.violations.length = 0; S.chatCalls = 0; return send(200, { ok: true }); }
        const m = /^\/v1beta\/models\/([^:\/]+):generateContent$/.exec(req.url || ""); if (!m || req.method !== "POST") return send(404, { error: { code: 404, message: "not found" } });
        if (req.headers["x-goog-api-key"] !== KEY) return send(403, { error: { code: 403, status: "PERMISSION_DENIED", message: "bad key" } });
        const b = JSON.parse(body), model = m[1], rec = { model, t: Date.now(), kind: "chat" }; S.log.push(rec); rec.raw = body;
        if (S.failNext > 0) { S.failNext--; rec.kind = "failed"; return send(S.failStatus, { error: { code: S.failStatus, message: "injected failure" } }); }
        if (S.delay) await new Promise(r => setTimeout(r, S.delay));
        if (/tts/.test(model)) { rec.kind = "tts"; const gc = b.generationConfig || {}; if (!gc.responseModalities || gc.responseModalities[0] !== "AUDIO") viol("tts-modalities"); if (!(gc.speechConfig && gc.speechConfig.voiceConfig && gc.speechConfig.voiceConfig.prebuiltVoiceConfig)) viol("tts-voice"); const text = ((b.contents[0].parts[0] || {}).text) || ""; rec.chars = text.length; const data = pcm(Math.min(4, .5 + text.length / 22), 24000).toString("base64"); return send(200, { candidates: [{ content: { role: "model", parts: [{ inlineData: { mimeType: "audio/L16;codec=pcm;rate=24000", data } }] } }] }); }
        const au = (b.contents || []).flatMap(c => c.parts || []).find(p => p.inlineData);
        if (au) { rec.kind = "stt"; if (!/^audio\/wav$/.test(au.inlineData.mimeType)) viol("stt-mime"); const w = wavInfo(au.inlineData.data); rec.wav = w; if (!w.ok) return send(400, { error: { code: 400, message: "bad audio" } }); if (w.rms < .004) return send(200, txt("[none]")); return send(200, txt(S.transcript)); }
        validateChat(b); const r = chat(b); if (r === "SLOW") { await new Promise(r2 => setTimeout(r2, 36000)); return send(200, txt("متأخر")); }
        return send(200, r);
      } catch (e) { viol("exception:" + e.message); send(400, { error: { code: 400, message: String(e.message) } }); }
    });
  });
  return new Promise(res => srv.listen(0, "127.0.0.1", () => { const port = srv.address().port; res({ base: "http://127.0.0.1:" + port, key: KEY, port, state: S, control: o => Object.assign(S, o), log: () => S.log.slice(), violations: () => S.violations.slice(), stop: () => srv.close() }); }));
}
module.exports = { startStub, KEY };
