/* اختبار الوضع الهجين لمنشئ الصفحات (PagePilotHybrid): دوال نقية + خط الأنابيب بمزوّدات MOCK + إعادة المحاولة/العلم + الواجهة + لقطة عرض.
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-pagepilot-hybrid.js [--shot مجلد] */
const { chromium } = require("playwright");
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); } };
const shotDir = (process.argv.indexOf("--shot") > 0 && process.argv[process.argv.indexOf("--shot") + 1]) || "";
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; await p.exposeFunction("saveDemo", (nm, b64) => { const fs = require("fs"); fs.mkdirSync("assets/img/_demo", { recursive: true }); fs.writeFileSync("assets/img/_demo/" + nm, Buffer.from(b64, "base64")); }); p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  t("الوحدة محمّلة", await p.evaluate(() => typeof PagePilotHybrid === "object" && typeof PagePilotHybrid.run === "function"));
  const pure = await p.evaluate(() => {
    const H = PagePilotHybrid, o = {};
    o.cWB = H.contrast(H.hexLum("#ffffff"), H.hexLum("#000000")); o.pkDark = H.pickText(0.05, ["#111111", "#ffffff"]); o.pkMid = H.pickText(0.30, ["#777777", "#888888"]); o.pkLight = H.pickText(0.9, ["#ffffff", "#111111"]);
    o.plan = H.cleanPlan({ sections: [{ type: "hero", headline: "عنوان", sub: "وصف", cta: "اطلب" }, { type: "benefits", headline: "فوائد", bullets: ["ميزة جيدة", "يشاهده 25 شخصاً الآن", "متبقي 3 قطع فقط", "ثالثة"] }, { type: "bogus", headline: "x" }] }, { count: 6 });
    o.types = o.plan.sections.map(s => s.type).join(); o.ben = o.plan.sections.find(s => s.type === "benefits").bullets; o.warn = o.plan.warn;
    const st = H.styleBible({ colors: ["#c68a1a", "#2a7f4f"], mood: "natural", category: "عسل" }, null); o.prefix = st.prefix; o.pal = st.palette;
    o.bg = H.bgPrompt(st, { type: "hero", scene: "a sunny meadow" }, {}); o.bgFaces = H.bgPrompt(st, { type: "hero", scene: "x" }, { noFaces: false });
    o.gate1 = H.gateOk({ has_text: true, has_face: false, zone_empty: true }, true); o.gate2 = H.gateOk({ has_text: false, has_face: true, zone_empty: true }, true); o.gate3 = H.gateOk({ has_text: false, has_face: true, zone_empty: true }, false);
    const gt = H.geometry("hero", 0.8), gb = H.geometry("how_to_use", 0.8), gf = H.geometry("faq", 1);
    o.geo = { top: gt.zone.y < gt.prod.y, bot: gb.zone.y > gb.prod.y, none: gf.prod === null, within: gt.prod.y + gt.prod.h <= H.H }; o.fb = H.fallbackPlan({ title: "منتج", desc: "جملة أولى طويلة بما يكفي. جملة ثانية طويلة بما يكفي." }, "ar", { count: 10 }).sections.length;
    o.dom = H.dominantColors(new Uint8ClampedArray([200, 30, 30, 255, 200, 30, 30, 255, 250, 250, 250, 255, 128, 128, 128, 255]), 2);
    return o;
  });
  t("WCAG: أسود/أبيض = 21", Math.abs(pure.cWB - 21) < .01, pure.cWB);
  t("خلفية داكنة ← نص فاتح بلا تعتيم", pure.pkDark.color === "#111111" ? false : pure.pkDark.ratio >= 4.5 && !pure.pkDark.scrim, pure.pkDark);
  t("خلفية متوسطة ونصوص ضعيفة ← تعتيم scrim ونسبة ≥4.5", pure.pkMid.scrim && pure.pkMid.ratio >= 4.5, pure.pkMid);
  t("خلفية فاتحة ← نص داكن مقبول", pure.pkLight.ratio >= 4.5 && !pure.pkLight.scrim, pure.pkLight);
  t("الخطة: أنواع بترتيب 6 أقسام وبلا نوع مجهول", pure.types === "hero,problem,benefits,offer_price,delivery_guarantee,final_cta", pure.types);
  t("حذف ادّعاءات اجتماعية مختلقة (مشاهدون/مخزون)", pure.ben.length === 2 && !pure.ben.some(x => /يشاهد|متبقي/.test(x)) && pure.warn.length >= 1, pure);
  t("دليل الأسلوب: بادئة موحّدة بالألوان والمزاج", /natural mood/.test(pure.prefix) && /#c68a1a/i.test(pure.prefix) || /natural mood/.test(pure.prefix), pure.prefix);
  t("برومبت الخلفية: بلا نصوص ويحجز منطقة العنوان ويمنع الوجوه", /No text, no letters/.test(pure.bg) && /top 40%/.test(pure.bg) && /human faces/.test(pure.bg) && /AVOID:/.test(pure.bg) && !/No human faces or people/.test(pure.bgFaces));
  t("بوابة الجودة: نص/وجه/منطقة", !pure.gate1.ok && pure.gate1.why[0] === "text" && !pure.gate2.ok && pure.gate3.ok);
  t("الهندسة: النص أعلى والمنتج أسفل وعكسه", pure.geo.top && pure.geo.bot && pure.geo.none && pure.geo.within, pure.geo);
  t("خطة احتياطية 10 أقسام", pure.fb === 10, pure.fb);
  t("ألوان سائدة تتجاهل الرمادي والأبيض", pure.dom.length === 1 && pure.dom[0] === "#c81e1e", pure.dom);

  /* خط الأنابيب بمزوّدات MOCK (بلا مفتاح) + صورة منتج حقيقية */
  const pipe = await p.evaluate(async () => {
    const H = PagePilotHybrid, blob = await (await fetch("assets/img/tpl/generic-honey.webp")).blob(); const steps = [], secs = [];
    const out = await H.run({ info: { title: "عسل السدر", desc: "عسل طبيعي خالص من جبال الأطلس. يدعم الطاقة اليومية. يُستعمل صباحاً." }, blob, theme: PagePilot.THEMES.green, lang: "ar", dialect: "dz", count: 8, strategy: "composite", gate: true, noFaces: true }, { step: (n, s) => steps.push(n + ":" + s), section: i => secs.push(i) }, { real: false, llm: { json: async () => { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; } } });
    return { n: out.results.length, secs: secs.length, mock: out.results.every(r => r.mock), real: out.real, hasProd: !!out.prod && out.prod.canvas.width > 10, ar: out.results[0].prodAr, lum: out.results.every(r => r.lum >= 0 && r.lum <= 1), notes: out.note.length, log: out.log.map(l => l.step + ":" + l.status).filter((v, i, a) => a.indexOf(v) === i), cut: out.prodOk };
  });
  t("الأنابيب MOCK: 8 أقسام بخلفيات محلية وسطوع محسوب", pipe.n === 8 && pipe.secs === 8 && pipe.mock && pipe.lum && !pipe.real, pipe);
  t("المنتج الحقيقي مقصوص ومعروف النسبة", pipe.hasProd && pipe.ar > 0.2, pipe);
  t("سجلّ الخطوات: تحليل/قصّ/أسلوب/خطة/خلفية", ["cutout:done", "plan:failed", "background:done"].every(x => pipe.log.includes(x)) || ["cutout:done", "background:done"].every(x => pipe.log.includes(x)), pipe.log);

  /* مسار إعادة المحاولة والعلم + الاسترداد: مزوّد صور "حقيقي" مُحاكى، بوابة جودة تفشل دائماً */
  const retry = await p.evaluate(async () => {
    const H = PagePilotHybrid; let calls = 0, checks = 0; const c = document.createElement("canvas"); c.width = 108; c.height = 135; c.getContext("2d").fillRect(0, 0, 108, 135);
    const blob = await (await fetch("assets/img/tpl/generic-honey.webp")).blob(); const prompts = [];
    const out = await H.run({ info: { title: "عسل", desc: "جملة أولى طويلة بما يكفي. جملة ثانية طويلة بما يكفي." }, blob, theme: PagePilot.THEMES.green, lang: "ar", count: 6, strategy: "composite", gate: true, noFaces: true }, {}, {
      real: true, llm: { json: async () => { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; } },
      image: { bg: async (pr) => { calls++; prompts.push(pr); const cb = await new Promise(r => c.toBlob(r, "image/png")); return { canvas: c, blob: cb }; }, edit: async () => null },
      vision: { check: async () => { checks++; return { has_text: true, has_face: false, zone_empty: true, artifacts: false }; } }
    });
    return { calls, checks, flags: out.results.map(r => r.flags.length), att: out.results.map(r => r.attempts), retryHint: prompts.some(x => /STRICTLY NO text/.test(x)) };
  });
  t("بوابة الجودة: ثلاث محاولات كحدّ أقصى لكل قسم ثم علم needs_review", retry.calls === 18 && retry.checks === 18 && retry.att.every(a => a === 3) && retry.flags.every(f => f === 1), retry);
  t("إعادة المحاولة تعدّل البرومبت (تشديد منع النص)", retry.retryHint);

  /* وضع الدمج: لا قصّ، مرجع مختلف لكل قسم، المنتج داخل المشهد، بوابة تطابق المنتج */
  const ed = await p.evaluate(async () => {
    const H = PagePilotHybrid; const mk = async col => { const c = document.createElement("canvas"); c.width = 120; c.height = 150; const x = c.getContext("2d"); x.fillStyle = col; x.fillRect(0, 0, 120, 150); return new Promise(r => c.toBlob(r, "image/png")); };
    const refs = [await mk("#c81e1e"), await mk("#1ec85a"), await mk("#1e5ac8")], got = [], prompts = [], checks = []; let cut = 0, n = 0;
    const out = await H.run({ info: { title: "عسل", desc: "جملة أولى طويلة بما يكفي. جملة ثانية طويلة بما يكفي." }, blob: refs[0], refs, theme: PagePilot.THEMES.green, lang: "ar", count: 6, gate: true, noFaces: true }, {}, {
      real: true, llm: { json: async () => { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; } },
      remover: { cut: async () => { cut++; return null; } },
      image: { bg: async () => { throw new Error("must not be used"); }, edit: async (b, pr, i) => { got.push(refs.indexOf(b)); prompts.push(pr); const c = document.createElement("canvas"); c.width = 108; c.height = 135; c.getContext("2d").fillRect(0, 0, 108, 135); return { canvas: c, blob: await new Promise(r => c.toBlob(r, "image/png")) }; } },
      vision: { check: async (b, pr, ref) => { checks.push({ ref: !!ref, p: /product_matches/.test(pr) }); n++; return { has_text: false, has_face: false, zone_empty: true, artifacts: false, product_matches: n !== 1 }; } }
    });
    const spec = H.buildSpec(out.plan, out.results.map((R, i) => Object.assign(R, { bgSrc: "assets/x" + i + ".webp", prodSrc: "assets/p.png" })), { style: out.style, strategy: out.strategy, title: "t", product: "" });
    return { strategy: out.strategy, cut, prod: !!out.prod, refsUsed: Array.from(new Set(got)).sort().join(","), calls: got.length, noProduct: prompts.every(p => /reference photo/.test(p) && /clearly different/.test(p) && !/do not draw any product/.test(p)), scenes: new Set(prompts.map(p => p.split(". ")[1])).size, checks: checks.every(c => c.ref && c.p), retried: out.results[0].attempts === 2, imgLayers: spec.sections.map(s => (s.layers || []).filter(l => l.type === "image").length).join(","), faqZone: H.zoneOf("faq", true), probZone: H.zoneOf("problem", true) };
  });
  t("وضع الدمج: لا قصّ للمنتج ولا طبقة منتج منفصلة", ed.strategy === "edit" && ed.cut === 0 && !ed.prod && /^1(,1)*$/.test(ed.imgLayers), ed);
  t("كل قسم يأخذ صورة مرجعية مختلفة من صور المنتج", ed.refsUsed === "0,1,2" && ed.calls >= 6, ed);
  t("برومبت الدمج: المنتج داخل المشهد ومختلف عن بقية الأقسام وبمشاهد متنوعة", ed.noProduct && ed.scenes >= 5, ed);
  t("بوابة الجودة تتحقق من تطابق المنتج وتعيد المحاولة عند عدم التطابق", ed.checks && ed.retried, ed);
  t("أقسام المشكلة/الأسئلة تُعاد توزيع منطقة نصها لتتسع للمنتج", ed.faqZone === "bottom" && ed.probZone === "top", ed);

  /* الواجهة الكاملة: منتج المتجر ← صفحة هجينة تُفتح في المطوّر */
  const ui = await p.evaluate(async shot => {
    window.confirm = () => true; ImgGen.text = async () => { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; }; ImgGen.ready = () => ({ ok: false });
    const ups = []; const old = PBApp.uploadBlob; PBApp.uploadBlob = async (b, n) => { const r = shot ? await new Promise(res => { const f = new FileReader(); f.onload = async () => { const nm = n + "-" + Math.random().toString(36).slice(2, 6) + (b.type === "image/png" ? ".png" : ".webp"); await window.saveDemo(nm, f.result.split(",")[1]); res("assets/img/_demo/" + nm); }; f.readAsDataURL(b); }) : await old.call(PBApp, b, n); ups.push(r); return r; };
    PagePilot.open(); const g = id => document.querySelector("#pp-bg #" + id);
    const slug = ((Admin.products && Admin.products.length ? Admin.products : PRODUCTS).find(x => x.cover) || {}).slug; g("pp-prod").value = slug; g("pp-prod").dispatchEvent(new Event("change"));
    const dflt = g("pp-mode").value; g("pp-hn").value = "6";
    document.querySelector('#pp-bg [data-pp="plain"]').click();
    for (let i = 0; i < 200 && document.getElementById("pp-bg"); i++) await new Promise(r => setTimeout(r, 100));
    for (let i = 0; i < 50 && !(PBApp.E && PBApp.E.page && PBApp.E.page.sections && PBApp.E.page.sections.length); i++) await new Promise(r => setTimeout(r, 100));
    const P = PBApp.E.page; const secs = P.sections.filter(s => s.free && s.free.length); const prodSecs = secs.filter(s => s.free.filter(w => w.type === "image").length === 2);
    return { dflt, slug, secs: P.sections.length, canvas: secs.length, prodSecs: prodSecs.length, hasOrder: P.sections.some(s => s.set.cid === "order"), headings: secs.every(s => s.free.some(w => w.type === "heading")), h1: P.sections[0].free.some(w => w.type === "heading" && w.set.tag === "h1"), hasMeta: !!(P.specMeta && P.specMeta.hybrid), product: P.product === slug, ups: ups.length };
  }, !!shotDir);
  t("الافتراضي = الوضع الهجين", ui.dflt === "hybrid", ui);
  t("صفحة بـ6 أقسام قماش + نموذج الطلب الحقيقي", ui.canvas === 6 && ui.hasOrder && ui.product, ui);
  t("كل قسم: عنوان نصي حيّ، وأقسام المنتج فيها طبقتا صورة (خلفية + منتج)", ui.headings && ui.prodSecs >= 4 && ui.h1, ui);
  t("بيانات التوليد محفوظة (البرومبتات/المحاولات/التباين)", ui.hasMeta);
  await p.waitForTimeout(1500);
  const sel = await p.evaluate(async () => { const E = PBApp.E, fd = document.getElementById("pbx-frame").contentDocument, ids = []; E.page.sections.forEach(s => (s.free || []).concat(...s.cols.map(c => c.widgets)).forEach(w => ids.push(w.id))); let okc = 0; for (const id of ids) { if (fd.querySelector('[data-pb="' + id + '"]')) okc++; } return { n: ids.length, ok: okc }; });
  t("كل طبقة تظهر في إطار المحرّر (قابلة للتحديد/التعديل)", sel.ok === sel.n && sel.n > 20, sel);
  /* تباين الصفحة المنشورة: لون كل نص بالنسبة للخلفية */
  const html = await p.evaluate(() => PB.fullHtml(JSON.parse(JSON.stringify(PBApp.E.page)), Object.assign({ base: "/" }, PBApp.siteCtx())));
  t("HTML منشور: نص عربي حقيقي RTL لا صورة", /dir="rtl"|dir=rtl/.test(html) || /lang="ar"/.test(html));
  if (shotDir) {
    const fs = require("fs"); fs.mkdirSync(shotDir, { recursive: true }); fs.writeFileSync(shotDir + "/demo.html", html.replace("<head>", '<head><base href="http://localhost:8765/">'));
    const m = await b.newPage({ viewport: { width: 420, height: 900 } }); await m.goto("file://" + shotDir + "/demo.html"); await m.waitForTimeout(1500);
    const hh = await m.evaluate(() => document.documentElement.scrollHeight); for (let y = 0; y < hh; y += 500) { await m.evaluate(v => window.scrollTo(0, v), y); await m.waitForTimeout(120); } await m.evaluate(() => window.scrollTo(0, 0)); await m.waitForTimeout(500);
    await m.screenshot({ path: shotDir + "/demo-full.png", fullPage: true }); console.log("لقطة:", shotDir + "/demo-full.png", "height", hh);
    await m.close();
  }
  t("بلا أخطاء صفحة", errs.length === 0, errs);
  console.log(ok + " ✓ / " + bad + " ✗"); await b.close(); process.exit(bad ? 1 : 0);
})();
