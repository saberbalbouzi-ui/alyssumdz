/* اختبار «منشئ الصفحات بالذكاء» (PagePilot): الأداة بالذكاء فقط — الواجهة بلا إعدادات داخلية ولا إنتاج محلي، وبلا مفتاح لا تُفتح صفحة.
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-pagepilot.js */
const { chromium } = require("playwright");
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  t("الوحدة محمّلة", await p.evaluate(() => typeof PagePilot === "object" && typeof PagePilot.open === "function" && typeof PagePilot.THEMES === "object"));
  t("الدوال المحلية القديمة محذوفة نهائياً", await p.evaluate(() => ["buildPage", "buildPosterPage", "fallbackCopy", "cleanCopy", "copyPrompt"].every(k => PagePilot[k] === undefined) && typeof PagePilotHybrid.fallbackPlan === "undefined" && typeof PagePilotHybrid.mockBg === "undefined"));
  const ui = await p.evaluate(() => {
    PagePilot.open(); const q = id => document.querySelector("#pp-bg #" + id), bg = document.getElementById("pp-bg"), txt = bg.innerText;
    return { removed: ["pp-mode", "pp-strat", "pp-n", "pp-cut", "pp-scene"].every(id => !q(id)), plain: !!bg.querySelector('[data-pp="plain"]'), go: !!bg.querySelector('[data-pp="go"]'), hn: !!q("pp-hn") && q("pp-hn").value === "10" && !!q("pp-ab"),
      noText: !/تُصنع الصور من صورة المنتج|عزل المنتج عن خلفية|مشهد توليدي|AIDA|بدون ذكاء|بوستر|أقسام نصية قابلة/.test(txt), pip: !!bg.querySelector('[data-pp="pip"]'), themes: bg.querySelectorAll('#pp-themes [data-pp="th"]').length };
  });
  t("الإعدادات الداخلية محذوفة من الواجهة", ui.removed, ui);
  t("لا زر «نسخة بدون ذكاء» ولا نصوص تقنية", !ui.plain && ui.noText && ui.go && ui.hn, ui);
  t("لا قطّارة قبل الإنشاء", !ui.pip, ui);
  t("قوالب الألوان موجودة", ui.themes >= 3, ui);
  /* بلا مفتاح: خطأ واضح ولا تُفتح صفحة */
  const nokey = await p.evaluate(async () => {
    window.confirm = () => true; ImgGen.ready = () => ({ ok: false }); let opened = 0; const o = PBApp.open; PBApp.open = function () { opened++; return o.apply(this, arguments); };
    const q = id => document.querySelector("#pp-bg #" + id); q("pp-name").value = "عسل السدر"; q("pp-desc").value = "عسل طبيعي خالص من جبال الأطلس.";
    document.querySelector('#pp-bg [data-pp="go"]').click(); await new Promise(r => setTimeout(r, 800));
    const rep = (document.getElementById("pp-rep") || {}).innerText || ""; PBApp.open = o; return { opened, rep };
  });
  t("بلا مفتاح الأداة ترفض وتشرح السبب ولا تفتح صفحة", nokey.opened === 0 && /الخدمة غير مفعّلة/.test(nokey.rep), nokey);
  t("لا أخطاء صفحة", errs.length === 0, errs.slice(0, 2));
  console.log(ok + " ✓ / " + bad + " ✗"); await b.close(); process.exit(bad ? 1 : 0);
})();
