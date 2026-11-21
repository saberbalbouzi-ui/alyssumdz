/* صوت الكرة ستيريو: طقطقة موجَّهة يميناً/يساراً (قياس RMS لكل قناة)، موسِّع ستيريو لصوت الوكيل (ارتباط L/R < 0.9 عبر OfflineAudioContext)، الكتم، وتزامن الأعصاب مع الصوت.
   متصفح Chromium بلا سياسة منع التشغيل التلقائي؛ لا جهاز صوت حقيقي (القياس على الرسم البياني الصوتي نفسه). التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/sphere-audio.js */
const PW = require("playwright"); const URL = process.env.URL || "http://127.0.0.1:8765/admin-preview/spatial-os/index.html?q=3";
const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 240) : "")); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await PW.chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(), errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 160)));
    await p.goto(URL); await wait(2500); await p.mouse.click(300, 300); await wait(800);
    ok("صوت الكرة صامت افتراضياً (لا طقطقة ولا طنين قبل التفعيل)", await p.evaluate(() => SphereAudio.supported && !SphereAudio.on && SphereAudio.crackles === 0 && /صامت/.test(document.getElementById("hud-snd").textContent)));
    await p.evaluate(() => SphereAudio.toggle(true)); await wait(800);
    ok("التفعيل من الزر يشغّل المحرك", await p.evaluate(() => SphereAudio.on), await p.evaluate(() => SphereAudio.state));
    await p.evaluate(() => { SphereAudio._c = SphereAudio.crackle; SphereAudio.crackle = () => { }; });
    const burst = async ang => p.evaluate(async a => { let l = 0, r = 0; for (let i = 0; i < 14; i++) { SphereAudio._c(a, 1); await new Promise(x => setTimeout(x, 40)); const q = SphereAudio.probe(); l = Math.max(l, q.l); r = Math.max(r, q.r); } return { l: +l.toFixed(4), r: +r.toFixed(4) }; }, ang);
    await p.evaluate(() => SphereAudio.toggle(true)); await p.evaluate(() => { SphereAudio.level(0); SphereAudio.ambient(false); }); await wait(700);
    const left = await burst(Math.PI), right = await burst(0);
    ok("عصب يسار الكرة يُسمع في القناة اليسرى أعلى بوضوح", left.l > left.r * 2.5 && left.l > .002, left);
    ok("عصب يمين الكرة يُسمع في القناة اليمنى أعلى بوضوح", right.r > right.l * 2.5 && right.r > .002, right);
    await p.evaluate(() => { SphereAudio.crackle = SphereAudio._c; }); const c0 = await p.evaluate(() => SphereAudio.crackles); await wait(5000); const c1 = await p.evaluate(() => SphereAudio.crackles);
    ok("أعصاب الكرة الفعلية (سكون) تُصدر طقطقات صوتية", c1 > c0, { c0, c1 }); await p.evaluate(() => SphereAudio.ambient(true));
    const wide = await p.evaluate(async () => { const sr = 24000, oc = new OfflineAudioContext(2, sr, sr), buf = oc.createBuffer(1, sr, sr), d = buf.getChannelData(0); for (let i = 0; i < sr; i++) d[i] = (Math.sin(i / 9) * .3 + Math.sin(i / 23) * .2 + (Math.random() - .5) * .25) * Math.abs(Math.sin(i / 3000)); const s = oc.createBufferSource(); s.buffer = buf; const an = oc.createAnalyser(); s.connect(an); SphereAudio.voiceOut(oc, an); s.start(); const out = await oc.startRendering(), L = out.getChannelData(0), Rr = out.getChannelData(1); let sl = 0, sr2 = 0, sx = 0; for (let i = 0; i < L.length; i++) { sl += L[i] * L[i]; sr2 += Rr[i] * Rr[i]; sx += L[i] * Rr[i]; } return { rmsL: +Math.sqrt(sl / L.length).toFixed(4), rmsR: +Math.sqrt(sr2 / L.length).toFixed(4), corr: +(sx / Math.sqrt(sl * sr2)).toFixed(3), wide: SphereAudio.voiceWide }; });
    ok("صوت الوكيل يخرج ستيريو واسعاً (القناتان حيّتان ومفكَّكتا الارتباط جزئياً)", wide.wide && wide.rmsL > .01 && wide.rmsR > .01 && wide.corr < .9, wide);
    const gr = await p.evaluate(async () => { const w = document.querySelector(".core3d"), sz = () => w.getBoundingClientRect().width, a = sz(); Core3D.setVoice("speaking"); for (let i = 0; i < 24; i++) { Core3D.setAudio(.9); await new Promise(r => setTimeout(r, 90)); } const b = sz(); Core3D.setVoice("none"); Core3D.setAudio(0); await new Promise(r => setTimeout(r, 2200)); return { rest: Math.round(a), speaking: Math.round(b), after: Math.round(sz()) }; });
    ok("حجم الكرة يزيد بالكلام (≥ 40%) ويعود بعده", gr.speaking > gr.rest * 1.4 && Math.abs(gr.after - gr.rest) < 6, gr);
    await p.evaluate(() => SphereAudio.toggle(false)); const cm = await p.evaluate(() => SphereAudio.crackles); await p.evaluate(() => SphereAudio.crackle(0, 1)); await wait(1500);
    ok("الكتم يوقف الصوت ويُحفظ", await p.evaluate((c) => !SphereAudio.on && SphereAudio.crackles === c && localStorage.getItem("sc_snd") === "0", cm));
    ok("زر «صوت الكرة» ظاهر ويعكس الحالة", await p.evaluate(() => { const bt = document.getElementById("hud-snd"); return !!bt && /صامت/.test(bt.textContent) && bt.getBoundingClientRect().width > 0; }));
    await p.evaluate(() => document.getElementById("hud-snd").click()); await wait(800);
    ok("الضغط على الزر يشغّل الصوت", await p.evaluate(() => SphereAudio.on && /يعمل/.test(document.getElementById("hud-snd").textContent)));
    ok("لا أخطاء صفحة", errs.length === 0, errs);
  } catch (e) { fails++; R.push("FAIL [crash] " + String(e).slice(0, 400)); }
  await b.close(); console.log(R.join("\n")); console.log(fails ? "\nFAILED: " + fails : "\nALL PASS"); process.exit(fails ? 1 : 0);
})();
