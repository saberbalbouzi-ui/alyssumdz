/* صوت وكيل أليسوم (المرحلة 11): ميكروفون حقيقي (getUserMedia + AudioContext) ومقياس مستوى/موجة حقيقية، تحويل كلام→نص، نص→كلام، مقاطعة.
   اختيار التقنية يعتمد على ما يتوفر فعلاً (caps()) لا على الافتراض:
     STT : وسيط الخادم (يُرسل WAV 16kHz مُشفَّراً في المتصفح ← يعمل في كل المتصفحات) إن كان مُهيّأً، وإلا Web Speech API (Chrome/Edge/Safari) إن وُجد، وإلا لا STT (رسالة واضحة + الكتابة).
     TTS : وسيط الخادم (PCM 24kHz يُشغَّل عبر AudioContext + AnalyserNode فيتزامن الرسم مع الصوت الحقيقي) وإلا speechSynthesis (مستوى تقريبي من أحداث الكلمات فقط) وإلا نص فقط.
   لا «كلمة تنبيه» (wake word): غير مدعومة ولا تُحاكى؛ البدائل: نقرة الميكروفون (يتوقف تلقائياً بكشف الصمت) أو الضغط المستمر (PTT) على الزر أو مفتاح Space خارج حقول الإدخال.
   لا يُرسل شيء للخادم إلا بعد تسجيل كلام فعلي (RMS فوق عتبة)؛ لا تخزين للصوت. الموافقة على كتابة لا تُقبل بالصوت (انظر core.js). */
(() => {
  "use strict";
  if (window.AgentVoice) return;
  const SRV = "server/llm.php", XH = { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" };
  const AC = window.AudioContext || window.webkitAudioContext, SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const listeners = new Set(), emit = e => listeners.forEach(f => { try { f(e); } catch (_) { } });
  const S = { mode: "idle", engine: null, lang: "ar-DZ", server: { configured: false, probed: false }, perm: "unknown", bargeIn: true, lastError: null, level: 0, speakKind: null, rec: null };
  const MSG = { denied: "رُفض إذن الميكروفون — اسمح به من إعدادات الموقع في المتصفح ثم أعد المحاولة (يمكنك الكتابة بدلاً من ذلك)", "no-device": "لم أجد ميكروفوناً متصلاً بهذا الجهاز", busy: "الميكروفون مستعمل من تطبيق آخر أو غير متاح الآن", insecure: "الميكروفون يتطلب اتصالاً آمناً (HTTPS أو localhost)", unsupported: "هذا المتصفح لا يدعم تسجيل الصوت", "no-stt": "تحويل الصوت إلى نص غير متاح (لا خدمة خادم ولا دعم في المتصفح) — اكتب طلبك", "no-speech": "لم أسمع كلاماً واضحاً — حاول مجدداً", "stt-failed": "تعذّر تحويل الصوت إلى نص — أعد المحاولة أو اكتب طلبك", network: "تعذّر الاتصال بخدمة الصوت", aborted: "أُلغي التسجيل" };
  const err = (code, extra) => { const e = Object.assign(new Error(MSG[code] || code), { code }); if (extra) e.extra = extra; return e; };
  const setMode = (m, x) => { if (S.mode === m) return; S.mode = m; if (window.Core3D) Core3D.setVoice(m === "listening" || m === "speaking" ? m : "none"); emit(Object.assign({ type: "state", mode: m }, x || {})); };

  let ac = null, stream = null, src = null, an = null, proc = null, mute = null, chunks = [], recording = false, loop = 0, vad = { floor: .004, speechAt: 0, lastSpeech: 0, start: 0, peak: 0 }, task = null, outAn = null, cur = null, waveBuf = new Float32Array(64), tdBuf = null;
  const getAC = async () => { if (!ac) { ac = new AC(); } if (ac.state === "suspended") { try { await ac.resume(); } catch (_) { } } return ac; };

  function caps() {
    const voices = window.speechSynthesis ? (speechSynthesis.getVoices() || []) : [], has = p => voices.some(v => (v.lang || "").toLowerCase().startsWith(p));
    return { secure: !!window.isSecureContext, getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), audioContext: !!AC, webSpeechRecognition: !!SR, speechSynthesis: !!window.speechSynthesis, voices: { total: voices.length, ar: has("ar"), fr: has("fr"), en: has("en") }, serverConfigured: S.server.configured, serverProbed: S.server.probed, perm: S.perm, engine: pickEngine(), tts: pickTts(), wakeWord: false, mode: S.mode };
  }
  const pickEngine = () => (S.server.configured ? "server" : SR ? "webspeech" : null), pickTts = () => (S.server.configured && AC ? "server" : window.speechSynthesis ? "browser" : null);
  async function probe() {
    try { if (navigator.permissions && navigator.permissions.query) { const p = await navigator.permissions.query({ name: "microphone" }); S.perm = p.state; p.onchange = () => { S.perm = p.state; emit({ type: "perm", perm: S.perm }); }; } } catch (_) { }
    try { const r = await fetch(SRV, { method: "POST", credentials: "same-origin", headers: XH, body: JSON.stringify({ action: "caps" }) }); const j = await r.json().catch(() => null); S.server = { configured: !!(j && j.ok && j.configured && j.stt), probed: true, status: r.status }; } catch (_) { S.server = { configured: false, probed: true, status: 0 }; }
    emit({ type: "caps", caps: caps() }); return caps();
  }

  /* ───── الميكروفون ───── */
  async function openMic() {
    if (stream && stream.active) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !AC) throw err("unsupported");
    if (!window.isSecureContext) throw err("insecure");
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }); }
    catch (e) { const n = e && e.name; throw err(n === "NotAllowedError" || n === "PermissionDeniedError" ? "denied" : n === "NotFoundError" || n === "OverconstrainedError" ? "no-device" : n === "NotReadableError" || n === "AbortError" ? "busy" : n === "SecurityError" ? "insecure" : "unsupported"); }
    S.perm = "granted"; const c = await getAC(); src = c.createMediaStreamSource(stream); an = c.createAnalyser(); an.fftSize = 1024; tdBuf = new Float32Array(an.fftSize); src.connect(an);
    proc = c.createScriptProcessor(4096, 1, 1); mute = c.createGain(); mute.gain.value = 0; src.connect(proc); proc.connect(mute); mute.connect(c.destination);
    proc.onaudioprocess = e => { if (recording) chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
    stream.getAudioTracks().forEach(t => t.addEventListener("ended", () => { emit({ type: "error", code: "busy", message: MSG.busy }); closeMic(); if (S.mode === "listening") { setMode("idle"); } }));
    startLoop();
  }
  function closeMic() { stopLoop(); try { proc && (proc.onaudioprocess = null); proc && proc.disconnect(); src && src.disconnect(); } catch (_) { } try { stream && stream.getTracks().forEach(t => t.stop()); } catch (_) { } stream = src = an = proc = mute = null; recording = false; chunks = []; }
  const rmsOf = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); };
  function startLoop() { stopLoop(); loop = setInterval(tick, 45); }
  function stopLoop() { clearInterval(loop); loop = 0; }
  function tick() {
    const now = performance.now(); let a = null, level = 0;
    if (S.mode === "speaking" && outAn) { const b = new Float32Array(outAn.fftSize); outAn.getFloatTimeDomainData(b); a = b; level = Math.min(1, rmsOf(b) * 5.5); }
    else if (S.mode === "speaking" && S.speakKind === "browser") { level = Math.max(0, S.level * .88); S.level = level; }
    if (an && S.mode !== "speaking") { an.getFloatTimeDomainData(tdBuf); a = tdBuf; const r = rmsOf(tdBuf); level = Math.min(1, r * 7); vad.peak = Math.max(vad.peak, r); if (!vad.speechAt) vad.floor = vad.floor * .96 + r * .04; const th = Math.max(.016, vad.floor * 3.2); if (r > th) { vad.lastSpeech = now; if (!vad.speechAt) vad.speechAt = now; } }
    /* مقاطعة بالصوت أثناء كلام الوكيل: يتطلب ميكروفوناً مفتوحاً بإذن مسبق وعتبة أعلى (صدى) */
    if (S.mode === "speaking" && an && S.bargeIn) { an.getFloatTimeDomainData(tdBuf); const r = rmsOf(tdBuf); if (r > Math.max(.05, vad.floor * 6)) { vad.bargeN = (vad.bargeN || 0) + 1; if (vad.bargeN >= 6) { vad.bargeN = 0; interrupt("voice"); } } else vad.bargeN = 0; }
    if (a) { for (let i = 0; i < 64; i++) waveBuf[i] = a[Math.floor(i / 64 * (a.length - 1))] * 3.2; }
    S.level = S.speakKind === "browser" ? S.level : level; if (window.Core3D) Core3D.setAudio(S.mode === "idle" ? 0 : (S.speakKind === "browser" && S.mode === "speaking" ? S.level : level), a ? waveBuf : null);
    emit({ type: "level", level: +level.toFixed(3) });
    if (S.mode === "listening" && task) {
      if (task.auto) { if (vad.speechAt && now - vad.lastSpeech > 1100 && now - vad.speechAt > 350) finishListening("silence"); else if (!vad.speechAt && now - vad.start > 8000) finishListening("no-speech-timeout"); }
      if (now - vad.start > 20000) finishListening("max");
    }
  }

  /* ───── الاستماع والتحويل إلى نص ───── */
  async function startListening(o) {
    o = o || {}; if (task) return task.promise; if (S.mode === "speaking") interrupt("user");
    const engine = pickEngine(); S.engine = engine; let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; });
    task = { auto: !o.ptt, ptt: !!o.ptt, lang: o.lang || S.lang, resolve, reject, promise, webspeech: null, final: "" }; promise.catch(() => { }); vad = { floor: .004, speechAt: 0, lastSpeech: 0, start: performance.now(), peak: 0, bargeN: 0 };
    try { await openMic(); } catch (e) { const t = task; task = null; S.lastError = e.code; emit({ type: "error", code: e.code, message: e.message }); setMode("idle"); t.reject(e); return promise; }
    chunks = []; recording = true; setMode("listening", { engine, ptt: !!o.ptt });
    if (engine === "webspeech") { try { const r = new SR(); r.lang = task.lang; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false; r.onresult = ev => { let f = "", i = ""; for (const x of ev.results) (x.isFinal ? (f += x[0].transcript) : (i += x[0].transcript)); if (f) task.final = f; emit({ type: "interim", text: (f || i).trim() }); }; r.onerror = ev => { if (task) { task.wsError = ev.error; } }; r.onend = () => { if (task && task.webspeech) { task.wsEnded = true; if (S.mode === "listening") finishListening("ws-end"); } }; task.webspeech = r; r.start(); } catch (_) { task.webspeech = null; } }
    return promise;
  }
  function stopListening(commit) { if (!task) return; if (commit === false) { cancelListening("aborted"); return; } finishListening(task.ptt ? "ptt-release" : "manual"); }
  function cancelListening(code) { const t = task; if (!t) return; task = null; recording = false; chunks = []; try { t.webspeech && t.webspeech.abort(); } catch (_) { } setMode("idle"); if (!cur) closeMic(); t.reject(err(code || "aborted")); }
  async function finishListening(why) {
    const t = task; if (!t || t.finishing) return; t.finishing = true; recording = false; const buf = chunks; chunks = []; const peak = vad.peak, spoke = !!vad.speechAt; setMode("processing", { why });
    try { t.webspeech && t.webspeech.stop(); } catch (_) { }
    try {
      if (!spoke && peak < .012) throw err("no-speech");
      let text = "";
      if (S.engine === "server") { const wav = toWav(buf, ac.sampleRate); const r = await fetch(SRV, { method: "POST", credentials: "same-origin", headers: XH, body: JSON.stringify({ action: "stt", audio: wav, lang: t.lang === "ar-DZ" ? "auto" : t.lang }) }); const j = await r.json().catch(() => null); if (!r.ok || !j || !j.ok) throw err(r.status === 0 ? "network" : "stt-failed", { status: r.status, error: j && j.error }); text = (j.text || "").trim(); }
      else if (S.engine === "webspeech") { await new Promise(res => { const t0 = performance.now(); const w = () => { if (t.final || t.wsEnded || t.wsError || performance.now() - t0 > 2500) res(); else setTimeout(w, 80); }; w(); }); if (!t.final && t.wsError && t.wsError !== "no-speech") throw err(t.wsError === "not-allowed" ? "denied" : t.wsError === "network" ? "network" : "stt-failed", { ws: t.wsError }); text = (t.final || "").trim(); }
      else throw err("no-stt");
      if (!text) throw err("no-speech");
      task = null; setMode("idle"); emit({ type: "transcript", text, engine: S.engine, ms: Math.round(performance.now() - vad.start) }); t.resolve({ ok: true, text, engine: S.engine });
    } catch (e) { task = null; S.lastError = e.code || "stt-failed"; emit({ type: "error", code: e.code || "stt-failed", message: e.message }); setMode("idle"); t.reject(e); }
    finally { if (!(S.bargeIn && S.mode === "speaking")) { /* الميكروفون يُغلق بعد كل تسجيل إلا أثناء كلام الوكيل (للمقاطعة) */ } if (S.mode !== "speaking") closeMic(); }
  }
  function toWav(chunksArr, srate) {
    let n = 0; chunksArr.forEach(c => n += c.length); const all = new Float32Array(n); let o = 0; chunksArr.forEach(c => { all.set(c, o); o += c.length; });
    const ratio = srate / 16000, m = Math.floor(n / ratio), pcm = new Int16Array(m); for (let i = 0; i < m; i++) { const a = Math.floor(i * ratio), b = Math.min(n, Math.floor((i + 1) * ratio)); let s = 0; for (let k = a; k < b; k++) s += all[k]; const v = Math.max(-1, Math.min(1, s / Math.max(1, b - a))); pcm[i] = v < 0 ? v * 32768 : v * 32767; }
    const buf = new ArrayBuffer(44 + m * 2), dv = new DataView(buf), w = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
    w(0, "RIFF"); dv.setUint32(4, 36 + m * 2, true); w(8, "WAVE"); w(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, "data"); dv.setUint32(40, m * 2, true); new Int16Array(buf, 44).set(pcm);
    let bin = ""; const u8 = new Uint8Array(buf); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(bin);
  }

  /* ───── الكلام (TTS) ───── */
  const spoken = t => String(t || "").replace(/\s+/g, " ").replace(/[«»"*_#`]/g, "").trim().slice(0, 480);
  async function speak(text, lang) {
    text = spoken(text); if (!text) return { ok: false, reason: "empty" }; interrupt("new", true); const kind = pickTts(); if (!kind) { emit({ type: "tts-unavailable" }); return { ok: false, reason: "no-tts" }; }
    S.speakKind = kind; let resolve; const done = new Promise(r => { resolve = r; }); cur = { kind, resolve, stop: null, text };
    if (kind === "server") {
      try {
        const c = await getAC(); const r = await fetch(SRV, { method: "POST", credentials: "same-origin", headers: XH, body: JSON.stringify({ action: "tts", text }) }); const j = await r.json().catch(() => null);
        if (!cur || cur.text !== text) return { ok: false, reason: "interrupted" };
        if (!r.ok || !j || !j.ok) throw new Error("tts-" + (j && j.error || r.status));
        const bin = atob(j.pcm), n = bin.length >> 1, ab = c.createBuffer(1, n, j.rate || 24000), ch = ab.getChannelData(0); for (let i = 0; i < n; i++) { let v = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8); if (v > 32767) v -= 65536; ch[i] = v / 32768; }
        const s = c.createBufferSource(); s.buffer = ab; outAn = c.createAnalyser(); outAn.fftSize = 1024; s.connect(outAn); outAn.connect(c.destination); const me = cur; me.stop = () => { try { s.onended = null; s.stop(); } catch (_) { } }; s.onended = () => { if (cur === me) endSpeak("ended"); };
        if (S.bargeIn && S.perm === "granted" && !stream) { try { await openMic(); } catch (_) { } }
        setMode("speaking", { tts: "server" }); startLoop(); s.start(); emit({ type: "tts-start", kind, sec: +(ab.duration).toFixed(2) });
      } catch (e) { const me = cur; cur = null; S.speakKind = null; outAn = null; emit({ type: "error", code: "tts-failed", message: "تعذّر تشغيل الصوت: " + String(e.message || e) }); if (window.speechSynthesis && !(e.message || "").startsWith("tts-aborted")) { cur = me; return speakBrowser(text, lang, me, resolve, done); } resolve({ ok: false, reason: "tts-failed" }); return done; }
      return done;
    }
    return speakBrowser(text, lang, cur, resolve, done);
  }
  function speakBrowser(text, lang, me, resolve, done) {
    S.speakKind = "browser"; me.kind = "browser"; const u = new SpeechSynthesisUtterance(text), want = (lang === "fr" ? "fr" : lang === "en" ? "en" : "ar"); u.lang = want === "fr" ? "fr-FR" : want === "en" ? "en-US" : "ar"; const vs = speechSynthesis.getVoices() || [], v = vs.find(x => (x.lang || "").toLowerCase().startsWith(want)); if (v) { u.voice = v; u.lang = v.lang; } u.rate = 1; me.stop = () => { try { speechSynthesis.cancel(); } catch (_) { } };
    u.onstart = () => { setMode("speaking", { tts: "browser" }); startLoop(); emit({ type: "tts-start", kind: "browser", voice: v ? v.name : null }); };
    u.onboundary = () => { S.level = Math.min(1, S.level + .35); }; u.onend = () => { if (cur === me) endSpeak("ended"); }; u.onerror = ev => { if (cur === me) endSpeak(ev.error === "interrupted" || ev.error === "canceled" ? "interrupted" : "error"); };
    try { speechSynthesis.cancel(); speechSynthesis.speak(u); me.watch = setTimeout(() => { if (cur === me && S.mode !== "speaking") { emit({ type: "error", code: "tts-silent", message: "لم يبدأ نطق المتصفح (لا صوت عربي/لا إذن)" }); endSpeak("silent"); } }, 2500); } catch (e) { endSpeak("error"); }
    return done;
  }
  function endSpeak(why) { const me = cur; if (!me) return; cur = null; clearTimeout(me.watch); S.speakKind = null; outAn = null; S.level = 0; if (S.mode === "speaking") setMode("idle", { why }); if (!task && !stream) stopLoop(); if (!task) closeMicIfIdle(); emit({ type: "tts-end", why }); me.resolve({ ok: why === "ended", reason: why }); }
  const closeMicIfIdle = () => { if (stream && S.mode !== "listening") closeMic(); };
  function interrupt(by, silent) { const me = cur; if (!me) return false; try { me.stop && me.stop(); } catch (_) { } emit({ type: "interrupt", by }); endSpeak("interrupted"); if (!silent && by === "voice") { startListening({ ptt: false }).catch(() => { }); } return true; }

  window.AgentVoice = Object.freeze({
    version: 1, caps, probe, on: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    startListening, stopListening, cancelListening, speak, interrupt, stopSpeaking: () => interrupt("user"),
    state: () => ({ mode: S.mode, engine: S.engine, lang: S.lang, perm: S.perm, server: S.server, lastError: S.lastError, speakKind: S.speakKind, level: S.level, bargeIn: S.bargeIn, micOpen: !!(stream && stream.active) }),
    setLang: l => { if (["ar-DZ", "fr-FR", "en-US"].includes(l)) S.lang = l; }, setBargeIn: b => { S.bargeIn = !!b; }, messages: MSG,
  });
  probe();
})();
