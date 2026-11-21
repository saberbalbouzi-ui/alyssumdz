/* صوت الكرة (ستيريو حقيقي) عبر Web Audio — بلا ملفات صوتية؛ كله مولَّد:
   • طقطقة كهربائية لكل عصب: تُوجَّه يميناً/يساراً بحسب اتجاه العصب (StereoPanner)؛
   • طنين خفيف بقناتين مختلفتين قليلاً (ضربات ستيريو) يتحرك مع مستوى الكلام؛
   • صوت الوكيل (TTS الخادم) يمرّ عبر موسِّع ستيريو (صدى مفكَّك الارتباط L/R) فيخرج من الكرة واسعاً لا أحادياً.
   التشغيل يبدأ بأول لمسة/نقرة (قيد المتصفح) ويُحفظ كتمه في sc_snd. الواجهة: SphereAudio.{on,toggle,crackle,level,voiceOut,probe,state} */
(function () {
  "use strict"; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { window.SphereAudio = { supported: false, on: false, toggle() { }, crackle() { }, level() { }, voiceOut: (c, n) => n.connect(c.destination), probe: () => null }; return; }
  let ctx = null, master = null, hum = null, humGain = null, anL = null, anR = null, bufL = null, bufR = null, noise = null, lvl = 0, last = 0, want = true, amb = true;
  try { want = localStorage.getItem("sc_snd") !== "0"; } catch (_) { }
  const SA = { supported: true, on: false, state: "idle", crackles: 0 };
  function buildNoise(c) { const n = c.sampleRate * .4, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
  function impulse(c, sec) { const n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.4); } return b; }
  function init() {
    if (ctx) return ctx; ctx = new AC(); master = ctx.createGain(); master.gain.value = .9; const split = ctx.createChannelSplitter(2); anL = ctx.createAnalyser(); anR = ctx.createAnalyser(); anL.fftSize = anR.fftSize = 512; bufL = new Float32Array(512); bufR = new Float32Array(512);
    master.connect(ctx.destination); master.connect(split); split.connect(anL, 0); split.connect(anR, 1); noise = buildNoise(ctx);
    /* طنين ستيريو: ترددان متقاربان على قناتين منفصلتين (يُسمع نبض ثلاثي الأبعاد حول الرأس) */
    humGain = ctx.createGain(); humGain.gain.value = 0; const m = ctx.createChannelMerger(2); [[0, 82], [1, 83.6]].forEach(([ch, f]) => { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f; const o2 = ctx.createOscillator(); o2.type = "triangle"; o2.frequency.value = f * 2.003; const g2 = ctx.createGain(); g2.gain.value = .35; o.connect(m, 0, ch); o2.connect(g2); g2.connect(m, 0, ch); o.start(); o2.start(); }); m.connect(humGain); humGain.connect(master); hum = humGain; return ctx;
  }
  SA.start = async function () { if (!want) return false; try { init(); if (ctx.state === "suspended") await ctx.resume(); SA.on = ctx.state === "running"; SA.state = ctx.state; if (SA.on && hum && amb) hum.gain.setTargetAtTime(.012 + lvl * .05, ctx.currentTime, .3); } catch (_) { SA.on = false; } sync(); return SA.on; };
  SA.toggle = function (v) { want = v === undefined ? !want : !!v; try { localStorage.setItem("sc_snd", want ? "1" : "0"); } catch (_) { } if (want) SA.start(); else { SA.on = false; if (hum && ctx) hum.gain.setTargetAtTime(0, ctx.currentTime, .1); } sync(); return want; };
  SA.wanted = () => want;
  SA.ambient = v => { amb = !!v; if (SA.on && hum && ctx) hum.gain.setTargetAtTime(amb ? .012 + lvl * .05 : 0, ctx.currentTime, .05); };
  /* طقطقة عصب: ang زاوية العصب على الشاشة (0 = يمين، π = يسار) → pan؛ power قوة 0..1 */
  SA.crackle = function (ang, power) {
    if (!SA.on || !ctx || document.hidden) return; const now = ctx.currentTime; if (now - last < .035) return; last = now; SA.crackles++;
    const p = Math.max(.15, Math.min(1, power || .5)), src = ctx.createBufferSource(); src.buffer = noise; src.playbackRate.value = .8 + Math.random() * .9;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800 + Math.random() * 3800; bp.Q.value = 1.4; const g = ctx.createGain(), dur = .04 + Math.random() * .09; g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(.075 * p, now + .004); g.gain.exponentialRampToValueAtTime(.0008, now + dur);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (pan) pan.pan.value = Math.max(-1, Math.min(1, Math.cos(ang || 0) * .95)); src.connect(bp); bp.connect(g); g.connect(pan || master); if (pan) pan.connect(master); src.start(now, Math.random() * .2, dur + .02);
  };
  /* مستوى الكلام: يرفع الطنين ويجعله يخفق */
  SA.level = function (l) { lvl = Math.max(0, Math.min(1, l || 0)); if (SA.on && hum && ctx && amb) hum.gain.setTargetAtTime(.012 + lvl * .06, ctx.currentTime, .06); };
  /* صوت الوكيل: موسِّع ستيريو — جاف مركزي + صدى قصير مفكَّك الارتباط بين القناتين */
  SA.voiceOut = function (c, node) {
    try { const dry = c.createGain(), wet = c.createGain(), conv = c.createConvolver(); dry.gain.value = .6; wet.gain.value = 1.5; conv.buffer = impulse(c, .38); const dl = c.createDelay(.05), dr = c.createDelay(.05); dl.delayTime.value = .009; dr.delayTime.value = .016; const merge = c.createChannelMerger(2), gl = c.createGain(), gr = c.createGain(); gl.gain.value = gr.gain.value = .3;
      node.connect(dry); dry.connect(c.destination); node.connect(conv); conv.connect(wet); wet.connect(c.destination); node.connect(dl); dl.connect(gl); gl.connect(merge, 0, 0); node.connect(dr); dr.connect(gr); gr.connect(merge, 0, 1); merge.connect(c.destination); SA.voiceWide = true; }
    catch (_) { node.connect(c.destination); SA.voiceWide = false; }
  };
  /* قياس حقيقي لكل قناة (للاختبار وللتحقق): RMS يسار/يمين */
  SA.probe = function () { if (!anL) return null; anL.getFloatTimeDomainData(bufL); anR.getFloatTimeDomainData(bufR); let a = 0, b = 0; for (let i = 0; i < bufL.length; i++) { a += bufL[i] * bufL[i]; b += bufR[i] * bufR[i]; } return { l: Math.sqrt(a / bufL.length), r: Math.sqrt(b / bufR.length) }; };
  function sync() { const b = document.getElementById("hud-snd"); if (b) { b.setAttribute("aria-pressed", String(want)); b.classList.toggle("on", want); b.textContent = want ? "صوت الكرة: يعمل" : "صوت الكرة: صامت"; } }
  ["pointerdown", "keydown", "touchend"].forEach(ev => addEventListener(ev, function f() { if (want && !SA.on) SA.start(); }, { capture: true, passive: true }));
  document.addEventListener("visibilitychange", () => { if (!ctx) return; if (document.hidden) ctx.suspend().catch(() => { }); else if (want) ctx.resume().catch(() => { }); });
  document.addEventListener("DOMContentLoaded", () => { sync(); const b = document.getElementById("hud-snd"); if (b) b.addEventListener("click", e => { e.stopPropagation(); SA.toggle(); }); }); if (document.readyState !== "loading") { sync(); const b = document.getElementById("hud-snd"); if (b && !b._sa) { b._sa = 1; b.addEventListener("click", e => { e.stopPropagation(); SA.toggle(); }); } }
  window.SphereAudio = SA;
})();
