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
    const out = { ept: PBApp.E.ept, panel: !!document.getElementById("pbai-bgp") }; document.getElementById("pbai-bgp").value = "فوق طاولة خشبية";
    document.querySelector('#pbai [data-ai="bgen"]').click(); await new Promise(r => setTimeout(r, 2500));
    out.calls = calls.length; out.prompt = calls[0] && /GENERATE A NEW BACKGROUND/.test(calls[0].prompt) && /فوق طاولة خشبية/.test(calls[0].prompt); out.var = new Set(calls.map(c => (c.prompt.match(/VARIATION ([A-D])/) || [])[1])).size >= 3;
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
  t("لا أخطاء جافاسكربت", errs.length === 0, errs);
  await b.close(); console.log(bad ? `\n✗ ${bad} من ${ok + bad} فشل` : `\n✓ ${ok} فحصاً ناجحاً`); process.exit(bad ? 1 : 0);
})();
