/* اختبار «مولّد الخلفية»: 4 طلبات بتنويع، المنتج الأصلي يُلصق فوق كل ناتج بلا تغيير، شبكة الاختيار والتطبيق (خادم محلي 8765) */
const { chromium } = require("playwright");
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) { ok++; console.log("✓ " + n); } else { bad++; console.log("✗ " + n + (x ? " " + JSON.stringify(x) : "")); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => {
    window.confirm = () => true; window.alert = () => { };
    /* منتج شفاف الخلفية: مستطيل أحمر وسط لوحة 200×200 */
    const c = document.createElement("canvas"); c.width = 200; c.height = 200; const g = c.getContext("2d"); g.fillStyle = "#d22"; g.fillRect(70, 60, 60, 100);
    const blob = await new Promise(r => c.toBlob(r, "image/png")); const calls = []; const up = [];
    ImgGen.ready = () => ({ ok: true }); ImgGen.estimate = () => ({ can: n => true });
    /* الخدمة تعيد خلفية زرقاء وتحرّك «المنتج» (تتجاهل القاعدة): اللصق الأصلي يصلح ذلك */
    ImgGen.edit = async o => { calls.push({ prompt: o.prompt, W: o.W, H: o.H }); const d = document.createElement("canvas"); d.width = o.W; d.height = o.H; const q = d.getContext("2d"); q.fillStyle = "#2255cc"; q.fillRect(0, 0, o.W, o.H); q.fillStyle = "#e9c"; q.fillRect(10, 10, 30, 30); return { canvas: d }; };
    PBApp.uploadBlob = async b => { up.push(b.size); return "assets/img/pages/bgen.png"; };
    await PBApp.toolSession([blob], "st", "t"); await new Promise(r => setTimeout(r, 800));
    const out = { ept: PBApp.E.ept, panel: !!document.getElementById("pbai-bgp") }; document.getElementById("pbai-bgp").value = "فوق طاولة خشبية"; const sc = document.getElementById("pbai-bgc"); out.cnt = !!sc; out.def0 = sc.value; sc.value = "4"; sc.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector('#pbai [data-ai="bgen"]').click(); await new Promise(r => setTimeout(r, 2500));
    out.calls = calls.length; out.prompt = calls[0] && /GENERATE A BACKGROUND SCENE ONLY/.test(calls[0].prompt) && /فوق طاولة خشبية/.test(calls[0].prompt); out.var = new Set(calls.map(c => (c.prompt.match(/VARIATION ([A-D])/) || [])[1])).size >= 3;
    const cards = document.querySelectorAll("#pbai-res [data-vc]"); out.cards = cards.length; out.regen = !!document.querySelector('#pbai-res [data-ai="bgen"]');
    const im = cards[0] && cards[0].querySelector("img"); out.img = !!im;
    if (im) { await new Promise(r => { if (im.complete) r(); else im.onload = r; }); const t = document.createElement("canvas"); t.width = im.naturalWidth; t.height = im.naturalHeight; const tg = t.getContext("2d"); tg.drawImage(im, 0, 0); const px = (x, y) => [...tg.getImageData(x, y, 1, 1).data]; const prod = px(100, 110), bg = px(150, 30); out.prod = prod; out.bg = bg; out.productKept = prod[0] > 180 && prod[1] < 90; out.bgBlue = bg[2] > 150 && bg[0] < 90; }
    out.msg = (document.getElementById("pbai-msg") || {}).textContent; const rd = document.querySelectorAll("#pbai-res input[name=pbai-v]"); if (!rd[1]) return out; rd[1].click(); document.querySelector('#pbai-res [data-ai="apply"]').click(); await new Promise(r => setTimeout(r, 1500)); out.applied = up.length >= 1; return out;
  });
  t("اللوحة تُفتح على «استوديو المنتج ‹ مشهد وخلفية» وفيها خانة الوصف", r.ept === "st" && r.panel, r);
  t("4 طلبات بوصفك وبتنويع بين الخيارات", r.calls === 4 && r.prompt && r.var, r);
  t("4 خيارات في الشبكة وزر «توليد من جديد»", r.cards === 4 && r.regen, r);
  t("المنتج الأصلي محفوظ فوق الخلفية الجديدة بلونه", r.productKept && r.bgBlue, r);
  t("تطبيق الخيار المحدّد يرفع الصورة", r.applied, r);
  /* عدد الخيارات قبل التوليد + تحريك المنتج وتكبيره يدوياً بعد التوليد */
  const r2 = await p.evaluate(async () => {
    const calls = []; const c = document.createElement("canvas"); c.width = 200; c.height = 200; const g = c.getContext("2d"); g.fillStyle = "#d22"; g.fillRect(70, 60, 60, 100);
    const blob = await new Promise(r => c.toBlob(r, "image/png"));
    ImgGen.edit = async o => { calls.push(1); const d = document.createElement("canvas"); d.width = o.W; d.height = o.H; const q = d.getContext("2d"); q.fillStyle = "#2255cc"; q.fillRect(0, 0, o.W, o.H); return { canvas: d }; };
    await PBApp.toolSession([blob], "st", "t"); await new Promise(r => setTimeout(r, 800));
    const sc = document.getElementById("pbai-bgc"), out = { def: sc && sc.value }; sc.value = "1"; sc.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector('#pbai [data-ai="bgen"]').click(); await new Promise(r => setTimeout(r, 2000)); out.calls = calls.length; out.cards = document.querySelectorAll("#pbai-res [data-vc]").length;
    const pix = (im) => new Promise(r => { const f = () => { const t = document.createElement("canvas"); t.width = im.naturalWidth; t.height = im.naturalHeight; const tg = t.getContext("2d"); tg.drawImage(im, 0, 0); r(tg); }; if (im.complete) f(); else im.onload = f; });
    const im = document.querySelector("#pbai-res [data-vc] img"); let tg = await pix(im); const red = (x, y) => { const d = tg.getImageData(x, y, 1, 1).data; return d[0] > 150 && d[1] < 90 && d[2] < 90; };
    out.before = red(100, 100) && !red(40, 100); out.ctl = !!document.querySelector("#pbai-bgnctl");
    const sx = document.querySelector('[data-bgn="x"]'); sx.value = "30"; sx.dispatchEvent(new Event("input", { bubbles: true })); await new Promise(r => setTimeout(r, 500));
    const im2 = document.querySelector("#pbai-res [data-vc] img"); tg = await pix(im2); out.moved = red(160, 100) && !red(100, 100);
    const ss = document.querySelector('[data-bgn="s"]'); ss.value = "140"; ss.dispatchEvent(new Event("input", { bubbles: true })); await new Promise(r => setTimeout(r, 500));
    tg = await pix(document.querySelector("#pbai-res [data-vc] img")); out.bigger = red(160, 40);
    document.querySelector('[data-bgnrs="x"]').click(); document.querySelector('[data-bgnrs="s"]').click(); await new Promise(r => setTimeout(r, 500)); tg = await pix(document.querySelector("#pbai-res [data-vc] img")); out.reset = red(100, 100) && !red(160, 100);
    return out;
  });
  t("قائمة عدد الخيارات قبل التوليد (الافتراضي 2) وتُنفَّذ طلبات بعددها", r.def0 === "2" && r2.calls === 1 && r2.cards === 1, r2);
  t("حركة المنتج الأفقية يدوياً بعد التوليد", r2.ctl && r2.before && r2.moved, r2);
  t("تكبير المنتج يدوياً وإعادة للافتراضي", r2.bigger && r2.reset, r2);
  t("لا أخطاء جافاسكربت", errs.length === 0, errs);
  await b.close(); console.log(bad ? `\n✗ ${bad} من ${ok + bad} فشل` : `\n✓ ${ok} فحصاً ناجحاً`); process.exit(bad ? 1 : 0);
})();
