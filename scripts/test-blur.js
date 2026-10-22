/* اختبار أداة «تمويه»: تركيب الفرشاة/الصورة كاملة بالبكسل + الواجهة وحفظ النتيجة (خادم محلي 8765) */
const { chromium } = require("playwright"); const path = require("path");
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) { ok++; console.log("✓ " + n); } else { bad++; console.log("✗ " + n + (x ? " " + JSON.stringify(x) : "")); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  t("الأداة مسجّلة في PBSmart وفي ستوديو ديزاين", await p.evaluate(() => typeof PBSmart.blur === "function" && ToolWin.has("blur")));
  const r = await p.evaluate(async () => {
    window.confirm = () => true; window.alert = () => { };
    /* صورة مصدر: يسار أحمر، يمين أخضر بحدّ حاد في المنتصف */
    const c = document.createElement("canvas"); c.width = 400; c.height = 300; const g = c.getContext("2d"); g.fillStyle = "#e22"; g.fillRect(0, 0, 200, 300); g.fillStyle = "#2a2"; g.fillRect(200, 0, 200, 300);
    const url = c.toDataURL("image/png"); const up = []; PBApp.uploadBlob = async b => { up.push(b.size); return "assets/img/pages/x.png"; };
    const node = { id: "w1", type: "image", set: { src: url } }; let committed = 0;
    PBApp.find = () => ({ node }); PBApp.renderCanvas = () => { }; PBApp.commitAfter = () => { committed++; }; PBApp.E.sel = "";
    await PBSmart.blur({ node, set: node.set }); const ov = document.getElementById("pbs-bl"); const out = { open: !!ov };
    const px = (cv, x, y) => [...cv.getContext("2d").getImageData(x, y, 1, 1).data];
    const v = ov.querySelector("#bl-v"), o = ov.querySelector("#bl-o"), save = ov.querySelector("#bl-save"); out.saveOff = save.disabled;
    const W = v.width, H = v.height, mid = Math.round(W / 2), y = Math.round(H / 2);
    out.sharp0 = px(v, mid - 3, y).join();      // حدّ حاد قبل التمويه
    const rc = o.getBoundingClientRect(), ev = (type, x, yy) => o.dispatchEvent(new PointerEvent(type, { clientX: rc.left + x, clientY: rc.top + yy, pointerId: 1, bubbles: true }));
    ev("pointerdown", mid, y); for (let i = 0; i < 12; i++) ev("pointermove", mid + (i - 6) * 4, y); ev("pointerup", mid, y);
    const a = px(v, mid - 3, y), a2 = px(v, mid + 3, y); out.blurred = a[0] > 60 && a[1] > 60 && a2[0] > 40; out.saveOn = !save.disabled;       // الأحمر والأخضر امتزجا قرب الحدّ
    out.far = px(v, 5, 5).join();      // بعيد عن الفرشاة بلا تغيير
    /* فرشاة الحذف تُعيد الحدّ حاداً */
    ov.querySelector('[data-bl="t-del"]').click(); ev("pointerdown", mid, y); for (let i = 0; i < 12; i++) ev("pointermove", mid + (i - 6) * 4, y); ev("pointerup", mid, y);
    out.restored = px(v, mid - 3, y).join() === out.sharp0;
    /* الصورة كاملة */
    ov.querySelector('[data-bl="m-whole"]').click(); out.wholeAllBlur = px(v, mid - 2, y)[1] > 40;
    ov.querySelector("#bl-clear").click(); out.cleared = px(v, mid - 3, y).join() === out.sharp0 && save.disabled;
    ov.querySelector('[data-bl="m-whole"]').click(); save.click(); await new Promise(r => setTimeout(r, 900));
    out.saved = up.length === 1 && node.set.src === "assets/img/pages/x.png" && committed === 1 && !document.getElementById("pbs-bl"); return out;
  });
  t("الواجهة تُفتح والتطبيق معطّل قبل أي تمويه", r.open && r.saveOff, r);
  t("الفرشاة تموّه قرب الحدّ فقط وتفعّل التطبيق", r.blurred && r.saveOn && r.far === "238,34,34,255", r);
  t("فرشاة «حذف» تُعيد الحدّ الحاد", r.restored, r);
  t("«الصورة كاملة» تموّه كل شيء و«إزالة التمويه» تعيد الأصل", r.wholeAllBlur && r.cleared, r);
  t("التطبيق يرفع الصورة ويضعها مكان الأصل ويغلق", r.saved, r);
  t("لا أخطاء جافاسكربت", errs.length === 0, errs);
  await b.close(); console.log(bad ? `\n✗ ${bad} من ${ok + bad} فشل` : `\n✓ ${ok} فحصاً ناجحاً`); process.exit(bad ? 1 : 0);
})();
