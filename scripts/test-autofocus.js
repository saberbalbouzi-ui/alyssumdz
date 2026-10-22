/* اختبار «تركيز تلقائي»: خريطة عمق مُحاكاة (يسار قريب، يمين بعيد) ← حدّة عند موضع التركيز وتمويه بعيداً عنه، وفرع Alyssum API، والتطبيق (خادم محلي 8765) */
const { chromium } = require("playwright");
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) { ok++; console.log("✓ " + n); } else { bad++; console.log("✗ " + n + (x ? " " + JSON.stringify(x) : "")); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  t("الأداة مسجّلة", await p.evaluate(() => typeof PBSmart.autoFocus === "function" && ToolWin.has("af")));
  const r = await p.evaluate(async () => {
    window.confirm = () => true; window.alert = () => { };
    /* صورة بخطوط عمودية حادة (تُظهر التمويه) */
    const c = document.createElement("canvas"); c.width = 400; c.height = 300; const g = c.getContext("2d"); for (let x = 0; x < 400; x += 10) { g.fillStyle = (x / 10) % 2 ? "#fff" : "#000"; g.fillRect(x, 0, 10, 300); }
    const url = c.toDataURL("image/png"), up = []; PBApp.uploadBlob = async b => { up.push(b.size); return "assets/img/pages/af.png"; };
    const node = { id: "w1", type: "image", set: { src: url } }; let committed = 0; PBApp.find = () => ({ node }); PBApp.renderCanvas = () => { }; PBApp.commitAfter = () => { committed++; };
    /* عمق: 1 على اليسار (قريب) ينخفض إلى 0 على اليمين */
    let calls = 0; window.AIVision = { depth: async () => { calls++; const w = 64, h = 48, a = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = 1 - x / (w - 1); return { data: a, w, h }; } };
    await PBSmart.autoFocus({ node, set: node.set }); await new Promise(r => setTimeout(r, 400)); const ov = document.getElementById("pbs-af"), out = { open: !!ov, calls };
    const v = ov.querySelector("#af-v"), pos = ov.querySelector("#af-pos"), inn = ov.querySelector("#af-in"), save = ov.querySelector("#af-save");
    const row = (x, n) => { const d = v.getContext("2d").getImageData(x, Math.round(v.height / 2), n, 1).data; let mn = 255, mx = 0; for (let i = 0; i < n; i++) { mn = Math.min(mn, d[i * 4]); mx = Math.max(mx, d[i * 4]); } return mx - mn; };
    out.enabled = !pos.disabled && !save.disabled; const W = v.width;
    const set = (el, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); };
    set(inn, 100); set(pos, 100);      // التركيز على القريب (اليسار)
    out.nearSharp = row(4, 20) > 200; out.farBlur = row(W - 30, 20) < 120;
    set(pos, 0); out.nearBlur = row(4, 20) < 120; out.farSharp = row(W - 30, 20) > 200;
    set(inn, 0); out.noBlur = row(4, 20) > 200 && row(W - 30, 20) > 200;
    out.overlay = document.getElementById("pbs-af").querySelector("#af-o").style.opacity;
    set(inn, 70); set(pos, 100); save.click(); await new Promise(r => setTimeout(r, 1500));
    out.saved = up.length === 1 && node.set.src === "assets/img/pages/af.png" && committed === 1 && !document.getElementById("pbs-af"); return out;
  });
  t("تُحلَّل خريطة العمق وتُفعَّل المنزلقات", r.open && r.calls === 1 && r.enabled, r);
  t("التركيز على القريب: اليسار حاد واليمين مموّه", r.nearSharp && r.farBlur, r);
  t("التركيز على البعيد يعكس النتيجة", r.nearBlur && r.farSharp, r);
  t("شدّة صفر: لا تمويه، والمنطقة الحادة تُظلَّل بالبنفسجي أثناء السحب", r.noBlur && Number(r.overlay) > 0, r);
  t("التطبيق يرفع الصورة ويضعها مكان الأصل ويغلق", r.saved, r);
  /* بلا نموذج محلي: خريطة عمق من الخدمة */
  const r2 = await p.evaluate(async () => {
    window.confirm = () => true; window.alert = () => { }; delete window.AIVision; document.getElementById("pbs-af") && document.getElementById("pbs-af").remove();
    const c = document.createElement("canvas"); c.width = 200; c.height = 100; const node = { id: "w2", type: "image", set: { src: c.toDataURL("image/png") } }; let prompt = "";
    ImgGen.ready = () => ({ ok: true }); ImgGen.edit = async o => { prompt = o.prompt; const d = document.createElement("canvas"); d.width = 100; d.height = 50; const g = d.getContext("2d"); const gr = g.createLinearGradient(0, 0, 100, 0); gr.addColorStop(0, "#fff"); gr.addColorStop(1, "#000"); g.fillStyle = gr; g.fillRect(0, 0, 100, 50); return { canvas: d }; };
    PBApp.find = () => ({ node }); await PBSmart.autoFocus({ node, set: node.set }); await new Promise(r => setTimeout(r, 400)); const ov = document.getElementById("pbs-af"); const out = { prompt: /DEPTH MAP/.test(prompt), on: ov && !ov.querySelector("#af-pos").disabled };
    ov && ov.remove();
    ImgGen.ready = () => ({ ok: false }); await PBSmart.autoFocus({ node, set: node.set }); await new Promise(r => setTimeout(r, 300)); const o2 = document.getElementById("pbs-af"); out.err = o2 ? o2.querySelector("#af-msg").textContent : ""; o2 && o2.remove(); return out;
  });
  t("بلا نموذج محلي: خريطة عمق من الخدمة وتُفعَّل المنزلقات", r2.prompt && r2.on, r2);
  t("بلا نموذج ولا مفتاح: رسالة واضحة", /تعذّر تقدير العمق/.test(r2.err), r2);
  t("لا أخطاء جافاسكربت", errs.length === 0, errs);
  await b.close(); console.log(bad ? `\n✗ ${bad} من ${ok + bad} فشل` : `\n✓ ${ok} فحصاً ناجحاً`); process.exit(bad ? 1 : 0);
})();
