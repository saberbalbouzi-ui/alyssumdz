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
    const lb = H.styleBible(H.cleanAnalysis({ label_colors: ["#1f4fa8", "#ffffff"], dominant_colors: ["#d98a14", "#1f4fa8"] }), null); o.labCname = lb.cname; o.labDeepHue = H.hex2hsl ? 0 : 0;
    const am = H.styleBible(H.cleanAnalysis({ dominant_colors: ["#d98a14", "#1f4fa8"] }), null); o.amCname = am.cname; o.isAm = [H.isAmber("#d98a14"), H.isAmber("#1f4fa8")];
    o.domAm = H.dominantColors(new Uint8ClampedArray([217, 138, 20, 255, 217, 138, 20, 255, 217, 138, 20, 255, 31, 79, 168, 255]), 2, true);
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
  t("لون الملصق (label_colors) يتقدّم على لون المحتوى العنبري", /blue/.test(pure.labCname), pure.labCname);
  t("بلا label_colors يُؤخَّر العنبر ويُختار الأزرق", /blue/.test(pure.amCname) && pure.isAm[0] === true && pure.isAm[1] === false, [pure.amCname, pure.isAm]);
  t("الاحتياط المحلي يؤخّر الأغلب عنبرياً", pure.domAm[0] === "#1f4fa8", pure.domAm);
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
    const out = await H.run({ info: { title: "عسل", desc: "جملة أولى طويلة بما يكفي. جملة ثانية طويلة بما يكفي." }, blob: refs[0], refs, theme: PagePilot.THEMES.green, lang: "ar", count: 6, gate: true, noFaces: true, backdrop: "scene" }, {}, {
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

  /* v1.89.414: لون/درجة اختيارية، خلفية موحّدة، كلمات مفتاحية ملوّنة، إعادة تلوين الصفحة */
  const cl = await p.evaluate(() => {
    const H = PagePilotHybrid, an = H.cleanAnalysis({ dominant_colors: ["#c8a24b"] }), o = {};
    const dk = H.styleBible(an, null, { color: "#1f4fa8", tone: "dark" }), lt = H.styleBible(an, null, { color: "#1f4fa8", tone: "light" }), nu = H.styleBible(an, null, { color: "#ffffff", tone: "dark" });
    o.dk = dk.palette.deep; o.lt = lt.palette.deep; o.ltHl = lt.palette.hl; o.ltLum = H.hexLum(lt.palette.deep); o.dkLum = H.hexLum(dk.palette.deep); o.nu = nu.palette.deep;
    o.hlContrast = H.contrast(H.hexLum(lt.palette.hl), H.hexLum(lt.palette.deep));
    o.solid = H.bgPrompt(dk, { type: "hero", scene: "kitchen with shelves" }, { withProduct: true }); o.scene = H.bgPrompt(dk, { type: "hero", scene: "kitchen with shelves" }, { withProduct: true, backdrop: "scene" });
    const plan = { sections: [{ id: "s1-hero", type: "hero", headline: "شعرك كيما تحبه في دارك", hl: "", sub: "جهاز واحد يجفف ويسرّح ويعطي لمعة", bullets: [], icons: [], cta: "اطلب" }, { id: "s2-benefits", type: "benefits", headline: "علاش تحتاجه", hl: "", sub: "", bullets: ["7 رؤوس [[متعددة]] للتصفيف", "محرك سريع يجفف شعرك"], icons: ["star", "zap"], cta: "" }] };
    const res = plan.sections.map((s, i) => ({ sec: s, bgSrc: "assets/x" + i + ".webp", lum: .1, prodAr: 1, flags: [] }));
    const spec = H.buildSpec(plan, res, { style: dk, strategy: "edit", title: "t", product: "", lang: "ar" });
    const txt = spec.sections.flatMap(S => S.layers).filter(l => l.type === "text" || l.type === "heading");
    o.kwTexts = txt.filter(l => /\[\[.+\]\]/.test(l.text)).length; o.hlHead = txt.filter(l => l.type === "heading").some(l => l.font.color === dk.palette.hl);
    const v = PBSpec.validate(spec); const pg = PBSpec.toPage(v, { merge: true }); pg.specMeta = { hybrid: { theme: dk, colors: [] } };
    const wset = JSON.stringify(pg.sections), hadDeep = wset.indexOf(dk.palette.deep) >= 0;
    const r = H.recolorPage(pg, { color: "#1f4fa8", tone: "light" }); const after = JSON.stringify(pg.sections);
    o.rc = { ok: r.ok, changed: r.changed, hadDeep, oldGone: after.indexOf(dk.palette.deep) < 0, newIn: after.indexOf(lt.palette.deep) >= 0, bg: pg.bg === lt.palette.deep, kwSpan: /<b style="color:/.test(after) };
    const L0 = spec.sections.flatMap(S => S.layers); o.fade = L0.filter(l => l.type === "image" && l.fade && l.fade.b > 0).length; o.glow = L0.filter(l => l.name === "إضاءة الخلفية" || l.name === "لون موحّد").length; o.vig = L0.filter(l => l.name === "تعتيم الأطراف").length; o.full = !!spec.page.full; { const c = document.createElement("canvas"); c.width = 200; c.height = 250; const x = c.getContext("2d"); x.fillStyle = "#c08040"; x.fillRect(0, 0, 200, 250); PagePilotHybrid.meltCanvas(c, "#102040"); const e = x.getImageData(0, 0, 1, 1).data, m = x.getImageData(100, 125, 1, 1).data; o.meltEdge = [e[0], e[1], e[2]].join(","); o.meltMid = [m[0], m[1], m[2]].join(","); }
    o.recBad = H.recolorPage({ sections: [] }, {}).ok;
    return o;
  });
  t("لون المستخدم ودرجته: داكن/فاتح من اللون نفسه", cl.dkLum < .06 && cl.ltLum > .6 && cl.hlContrast >= 4.5, cl);
  t("لون محايد (أبيض) ← خلفية داكنة محايدة لا ملوّنة", /^#[0-9a-f]{6}$/.test(cl.nu), cl.nu);
  t("خلفية موحّدة افتراضياً بلا غرف/أثاث، والمشهد اختياري", /uniform flat/.test(cl.solid) && !/kitchen/.test(cl.solid) && /kitchen/.test(cl.scene), cl);
  t("كلمات مفتاحية ملوّنة في النصوص + كلمة العنوان المميّزة", cl.kwTexts >= 2 && cl.hlHead, cl);
  t("الصور تذوب بالبكسل في لون الصفحة (الحواف = اللون العميق) + بلا غشاء ولا طبقة لون فوق الصورة + عرض كامل للصفحة بلا شريط", cl.meltEdge === "16,32,64" && cl.meltMid === "192,128,64" && cl.glow === 0 && cl.vig === 0 && cl.fade === 0 && cl.full, cl);
  t("إعادة تلوين الصفحة: يستبدل اللون القديم بالجديد ويقلب الدرجة", cl.rc.ok && cl.rc.changed > 5 && cl.rc.hadDeep && cl.rc.oldGone && cl.rc.newIn && cl.rc.bg, cl.rc);
  t("إعادة التلوين ترفض صفحة ليست من المنشئ", cl.recBad === false);
  t("بوابة الجودة تتحقق من تطابق المنتج وتعيد المحاولة عند عدم التطابق", ed.checks && ed.retried, ed);
  t("أقسام المشكلة/الأسئلة تُعاد توزيع منطقة نصها لتتسع للمنتج", ed.faqZone === "top" && ed.probZone === "top", ed);

  /* فشل صور الذكاء في وضع الدمج ← المنتج المقصوص يوضع فوق الخلفية المحلية + رسالة واضحة */
  const fbk = await p.evaluate(async () => {
    const H = PagePilotHybrid; const c0 = document.createElement("canvas"); c0.width = 120; c0.height = 150; const x = c0.getContext("2d"); x.fillStyle = "#c81e1e"; x.fillRect(0, 0, 120, 150);
    const ref = await new Promise(r => c0.toBlob(r, "image/png"));
    const out = await H.run({ info: { title: "عسل", desc: "جملة أولى طويلة بما يكفي. جملة ثانية طويلة بما يكفي." }, blob: ref, refs: [ref], theme: PagePilot.THEMES.green, lang: "ar", count: 8, gate: false }, {}, {
      real: true, llm: { json: async () => { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; } },
      remover: { cut: async b => b },
      image: { bg: async () => { throw new Error("x"); }, edit: async () => { throw new Error("quota exceeded"); } },
      vision: { check: async () => null }
    });
    const spec = H.buildSpec(out.plan, out.results.map((R, i) => Object.assign(R, { bgSrc: "assets/x" + i + ".webp", prodSrc: "assets/p.png" })), { style: out.style, strategy: out.strategy, title: "t", product: "" });
    const prodLayers = spec.sections.map(s => (s.layers || []).filter(l => l.type === "image" && /^asset:pr/.test(l.src)).length);
    return { allMock: out.results.every(r => r.mock), hasProd: !!out.prod, prodLayers, note: out.note.join(" | ") };
  });
  t("فشل صور الذكاء: المنتج المقصوص يُضاف لكل قسم احتياطي", fbk.allMock && fbk.hasProd && fbk.prodLayers[0] === 1 && fbk.prodLayers.filter(n => n === 1).length >= 5, fbk);
  t("فشل صور الذكاء: رسالة واضحة بالسبب", /تعذّر توليد صور الذكاء/.test(fbk.note) && /quota/.test(fbk.note), fbk);

  const cnts = await p.evaluate(() => [2,3,4,5,6,7,8].map(n => { const t = PagePilotHybrid.typesFor(n); return [n, t.length, t[0], t.includes("offer_price")]; }));
  t("عدد الأقسام 2–8: كل عدد يعطي الأقسام المطلوبة ويبدأ بالهيرو ويحوي العرض", cnts.every(c => c[0] === c[1] && c[2] === "hero" && c[3]), cnts);
  const opts = await p.evaluate(() => { PagePilot.open(); return Array.from(document.querySelectorAll("#pp-hn option")).map(o => o.value).join(","); });
  t("خيارات عدد الأقسام في الواجهة 2…8", opts === "2,3,4,5,6,7,8", opts);

  /* أسلوب المنافس: لون المنتج، كلمة مبرزة، صفوف أيقونات، زر في كل قسم، شريط علوي، أشخاص، صفحة متصلة */
  const cp = await p.evaluate(() => {
    const H = PagePilotHybrid, o = {}; const st = H.styleBible({ colors: ["#1b3a7a", "#e0a020"], mood: "energetic", category: "طارد البعوض" }, null);
    o.cname = st.cname; o.hl = st.palette.hl; o.deepDark = H.hexLum(st.palette.deep) < .12; o.hlContrast = H.contrast(H.hexLum(st.palette.hl), H.hexLum(st.palette.deep)) >= 4.5;
    const plan = H.cleanPlan({ sections: [{ type: "hero", headline: "اطرد البعوض نهائياً الليلة", hl: "نهائياً", sub: "وصف", cta: "اطلب" }, { type: "benefits", headline: "لماذا تحبه", bullets: ["توصيل سريع لكل الولايات", "طبيعي وآمن للعائلة", "سهل الاستعمال"], icons: ["truck", "bogus", "zap"] }, { type: "problem", headline: "تعبت من اللسع؟", sub: "x" }, { type: "faq", headline: "أسئلة", bullets: ["س: أ؟ ج: ب", "س: ج؟ ج: د"] }] }, { count: 10 }); const by = ty => plan.sections.findIndex(x => x.type === ty);
    o.hlKept = plan.sections[0].hl; o.icons = plan.sections[by("benefits")].icons.join(); o.faqIcons = plan.sections[by("faq")].icons.length;
    const res = plan.sections.map((sec, i) => ({ sec, bgSrc: "assets/b" + i + ".webp", lum: .8, prodAr: 0, prodSrc: "" }));
    const spec = H.buildSpec(plan, res, { style: st, strategy: "edit", title: "t", product: "", lang: "ar", wa: "213555000111" });
    const cnt = (sc, ty) => sc.layers.filter(l => l.type === ty).length;
    o.btnAll = spec.sections.every(sc => cnt(sc, "button") === 1); o.btnY = spec.sections[0].layers.find(l => l.type === "button").y;
    o.ticker = spec.sections[0].layers.filter(l => l.name && /شريط علوي/.test(l.name)).length; o.tickerOther = spec.sections.slice(1).some(sc => sc.layers.some(l => l.name && /شريط علوي/.test(l.name)));
    const hero = spec.sections[0]; const heads = hero.layers.filter(l => l.type === "heading"); o.heads = heads.length; o.hlColor = heads[1] && heads[1].font.color === st.palette.hl; o.headSize = heads[0].font.size;
    const ben = spec.sections[by("benefits")]; o.rowIcons = cnt(ben, "icon"); o.circles = ben.layers.filter(l => l.type === "shape" && l.shape === "ellipse").length; o.iconNames = ben.layers.filter(l => l.type === "icon").map(l => l.icon).join();
    o.faqPlain = cnt(spec.sections[by("faq")], "icon") === 0;
    o.grads = spec.sections.every(sc => sc.layers.some(l => l.type === "shape" && l.gradient && /rgba/.test(l.gradient.stops[0].c)));
    o.sameBg = new Set(spec.sections.map(sc => sc.bg)).size === 1 && spec.page.bg === spec.sections[0].bg;
    const v = PBSpec.validate(spec, {}); o.valid = v.ok; const pg = PBSpec.toPage(v, { title: "t", merge: true }); o.mergedSecs = pg.sections.length;
    const pe = H.bgPrompt(st, { type: "hero", scene: "x" }, { withProduct: true, people: true, noFaces: true, audience: "نساء" }), pp = H.bgPrompt(st, { type: "benefits", scene: "x" }, { withProduct: true, people: true, noFaces: true });
    o.pHero = /hijab/.test(pe) && /real adult person/.test(pe) && !/No human faces/.test(pe); o.pBen = /No human faces/.test(pp) && !/hijab/.test(pp); o.crisp = /sharp, photorealistic/.test(pe); o.tone = /navy blue/.test(pe) && /seamless/.test(pe);
    /* جولة الشكاوى: لون موحّد، أيقونات صالحة، لا تداخل، المنتج في الشريط السفلي */
    const sg = H.styleBible({ colors: ["#c9c9c9", "#b8b8b8"] }, null), hg = H.hex2hsl ? 0 : 0; o.greenDeep = sg.cname; 
    const names = new Set(Object.keys(PB.ICONS || {}).concat((PB.ICONS_LIST || []))); o.pbIconsType = Array.isArray(PB.ICONS) ? "arr" : typeof PB.ICONS;
    o.iconsValid = v.ok && PBSpec.ICONS.every(n => (typeof PB.iconHtml === "function" && /<svg/.test(String(PB.iconHtml("ic:" + n)))));
    o.tint = spec.sections.every(sc => !sc.layers.some(l => l.name === "لون موحّد"));
    const vv = PBSpec.validate(spec, {}); const sb = vv.sections[by("benefits")], ics = sb.layers.filter(l => l.type === "icon"), cs = sb.layers.filter(l => l.type === "shape" && l.shape === "ellipse");
    o.iconCentered = ics.length >= 2 && ics.every((ic, k) => Math.abs((ic.y + ic.h / 2) - (cs[k].y + cs[k].h / 2)) <= 2 && Math.abs((ic.x + ic.w / 2) - (cs[k].x + cs[k].w / 2)) <= 2);
    const tx = sb.layers.filter(l => l.type === "text" && l.z === 5); const lim = 90 + 530; o.rowsInZone = tx.every(l => l.y + 30 <= lim + 40);
    o.pBand = /52% and 86%/.test(pe) && /top 46%/.test(pe) && /must NOT enter/.test(pe); o.gLow = /product_low/.test(H.gatePrompt({ zone: "top", ref: true })) && /lowprod/.test(H.gateOk({ product_low: false }, true, true).why.join());
    o.gateP = /product_sharp/.test(H.gatePrompt({ zone: "top", ref: true })); o.gok = H.gateOk({ product_sharp: false, product_matches: true }, true, true).why.join();
    return o;
  });
  t("لون المنتج يحكم الأسلوب: اسم اللون وأبيض/أصفر مميّز بتباين كافٍ", /navy|blue/.test(cp.cname) && cp.deepDark && cp.hlContrast, cp);
  t("الخطة: كلمة مبرزة من العنوان وأيقونات صحيحة (الدخيل يُستبدل) وبلا أيقونات للأسئلة الشائعة", cp.hlKept === "نهائياً" && /^truck,/.test(cp.icons) && cp.icons.split(",")[1] !== "bogus" && cp.faqPlain, cp);
  t("زر طلب في كل قسم بأسفله، وشريط علوي في الأول فقط", cp.btnAll && cp.btnY === 1200 && cp.ticker === 2 && !cp.tickerOther, cp);
  t("عنوان كبير بسطرين: أبيض + كلمة مميّزة بلون التمييز", cp.heads === 2 && cp.hlColor && cp.headSize >= 56, cp);
  t("صفوف المزايا: دائرة + أيقونة + نص لكل نقطة", cp.rowIcons === 3 && cp.circles === 3 && /^truck,/.test(cp.iconNames), cp);
  t("الاستمرارية: تدرّج لوني بكل قسم، خلفية موحّدة، والأقسام تُدمج في قماش واحد", cp.grads && cp.sameBg && cp.valid && cp.mergedSecs === 1, cp);
  t("الأشخاص: هيرو بشخص (حجاب ولباس ساتر)، المزايا بلا وجوه، والمنتج حاد ولونه من المنتج", cp.pHero && cp.pBen && cp.crisp && cp.tone, cp);
  t("منتج بلا لون ملوّن (أسود/رمادي) ← خلفية رمادية فحمية لا أخضر، ولا طبقة لون موحّد فوق الصورة", /gr[ae]y|graphite|charcoal|black|dark|navy|slate/.test(cp.greenDeep) && !/green/.test(cp.greenDeep) && cp.tint, cp);
  t("الأيقونات: كل الأسماء صالحة (لا نص «ic:xxx») وتتمركز داخل دوائرها بلا انجراف", cp.iconsValid && cp.iconCentered, cp);
  t("النص داخل منطقته فوق المنتج، والمنتج في الشريط السفلي (برومبت وبوابة)", cp.rowsInZone && cp.pBand && cp.gLow, cp);
  t("بوابة الجودة تفحص حدّة المنتج وتعيد المحاولة", cp.gateP && /sharp/.test(cp.gok), cp);

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
    return { dflt, slug, secs: P.sections.length, canvas: secs.length, prodSecs: prodSecs.length, imgs: secs.reduce((n, s) => n + s.free.filter(w => w.type === "image").length, 0), btns: secs.reduce((n, s) => n + s.free.filter(w => w.type === "button").length, 0), hasOrder: P.sections.some(s => s.set.cid === "order"), headings: secs.every(s => s.free.some(w => w.type === "heading")), h1: P.sections[0].free.some(w => w.type === "heading" && w.set.tag === "h1"), hasMeta: !!(P.specMeta && P.specMeta.hybrid), product: P.product === slug, ups: ups.length };
  }, !!shotDir);
  t("الافتراضي = الوضع الهجين", ui.dflt === "hybrid", ui);
  t("صفحة واحدة متصلة (قماش واحد) + نموذج الطلب الحقيقي", ui.canvas === 1 && ui.secs === 2 && ui.hasOrder && ui.product, ui);
  t("العناوين نصوص حيّة وH1 واحد وعشر طبقات صور فأكثر (خلفيات + منتج)", ui.headings && ui.imgs >= 6 && ui.h1 && ui.btns >= 6, ui);
  t("بيانات التوليد محفوظة (البرومبتات/المحاولات/التباين)", ui.hasMeta);
  await p.waitForTimeout(1500);
  const sel = await p.evaluate(async () => { const E = PBApp.E, fd = document.getElementById("pbx-frame").contentDocument, ids = []; E.page.sections.forEach(s => (s.free || []).concat(...s.cols.map(c => c.widgets)).forEach(w => ids.push(w.id))); let okc = 0; for (const id of ids) { if (fd.querySelector('[data-pb="' + id + '"]')) okc++; } return { n: ids.length, ok: okc }; });
  t("كل طبقة تظهر في إطار المحرّر (قابلة للتحديد/التعديل)", sel.ok === sel.n && sel.n > 20, sel);
  /* زر «لون الصفحة» داخل المحرّر يغيّر ألوان الصفحة المولَّدة (قابل للتراجع) */
  await p.waitForFunction(() => document.getElementById("pp-rcb"), null, { timeout: 8000 }).catch(() => { });
  const rcu = await p.evaluate(async () => {
    const b = document.getElementById("pp-rcb"); if (!b) return { chip: false };
    const before = PBApp.E.page.bg; b.click(); const d = document.getElementById("pp-rc"); if (!d) return { chip: true, dlg: false };
    const sw = d.querySelector('[data-rc="c"]'); sw.click(); d.querySelector("#pp-rct").value = "light"; d.querySelector('[data-rc="go"]').click();
    await new Promise(r => setTimeout(r, 300)); const after = PBApp.E.page.bg, msg = d.querySelector("#pp-rcm").textContent, undo = PBApp.E.hist ? PBApp.E.hist.length : 0;
    return { chip: true, dlg: true, before, after, msg, changed: before !== after, lightBg: (() => { const h = after.replace("#", ""), r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), bl = parseInt(h.slice(4, 6), 16); return (r + g + bl) / 3 > 150; })() };
  });
  t("زر «لون الصفحة» في المحرّر يغيّر لون الصفحة إلى فاتح", rcu.chip && rcu.dlg && rcu.changed && rcu.lightBg && /تغيّر/.test(rcu.msg), rcu);
  /* دمج الموضوع فوق لون الصفحة: خلفية الصورة المتجانسة تُستبدل باللون العميق (ألوان الموضوع تبقى) */
  const fl = await p.evaluate(async () => {
    const H = PagePilotHybrid, w = 200, h = 250, c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = "#2c5a3a"; x.fillRect(0, 0, w, h); x.fillStyle = "#101010"; x.fillRect(60, 80, 80, 120);
    const cut = async cv => { const o = document.createElement("canvas"); o.width = w; o.height = h; const q = o.getContext("2d"); q.fillStyle = "#101010"; q.fillRect(60, 80, 80, 120); return o; };
    const ok = await H.flattenOnDeep(c, "#14181f", cut, false), px = (X, Y) => Array.from(x.getImageData(X, Y, 1, 1).data.slice(0, 3)).join(",");
    const bad = document.createElement("canvas"); bad.width = w; bad.height = h; const okBad = await H.flattenOnDeep(bad, "#14181f", async () => { const o = document.createElement("canvas"); o.width = w; o.height = h; return o; }, false);
    return { ok, corner: px(2, 2), edgeMid: px(0, 125), subject: px(100, 140), okBad };
  });
  t("flattenOnDeep: الزوايا = اللون العميق والموضوع بلونه الأصلي، وقصّ فارغ يُرفض", fl.ok && fl.corner === "20,24,31" && Math.abs(+fl.edgeMid.split(",")[0] - 20) < 25 && fl.subject === "16,16,16" && !fl.okBad, fl);
  /* وضع الدمج + خلفية موحّدة: القسم يُسطَّح على لون الصفحة فلا طبقات تلوين فوق الصورة */
  const fe = await p.evaluate(async () => {
    const H = PagePilotHybrid, blob = await (await fetch("assets/img/tpl/generic-honey.webp")).blob();
    const mkc = () => { const c = document.createElement("canvas"); c.width = 108; c.height = 135; const x = c.getContext("2d"); x.fillStyle = "#335577"; x.fillRect(0, 0, 108, 135); return c; };
    const out = await H.run({ info: { title: "مكواة", desc: "جملة أولى طويلة بما يكفي. جملة ثانية طويلة بما يكفي." }, blob, refs: [blob], theme: PagePilot.THEMES.green, lang: "ar", count: 2, gate: false, backdrop: "solid" }, {}, {
      real: true, llm: { json: async () => { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; } },
      remover: { cut: async () => null, cutBg: async () => { const o = document.createElement("canvas"); o.width = 108; o.height = 135; const q = o.getContext("2d"); q.fillStyle = "#222"; q.fillRect(30, 40, 50, 70); return o; } },
      image: { bg: async () => null, edit: async () => { const c = mkc(); return { canvas: c, blob: await new Promise(r => c.toBlob(r, "image/png")) }; } }
    });
    const spec = H.buildSpec(out.plan, out.results.map((R, i) => Object.assign(R, { bgSrc: "assets/x" + i + ".webp", prodSrc: "" })), { style: out.style, strategy: out.strategy, title: "t", product: "" });
    const L = spec.sections.flatMap(S => S.layers);
    return { flat: out.results.map(r => !!r.flat), veil: L.filter(l => /لون موحّد|إضاءة الخلفية|تدرّج اللون|وصل/.test(l.name || "")).length, cname: out.style.cname };
  });
  t("خلفية موحّدة: الأقسام تُسطَّح على لون الصفحة بلا غشاء فوق الصورة", fe.flat.every(Boolean) && fe.veil === 0, fe);
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
