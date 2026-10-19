/* اختبار النموذج الأولي PBCopilot (scripts/pagebuilder-copilot.js) على صفحة memory-focus داخل المطوّر الحقيقي.
   بلا مفتاح API ولا نشر ولا شبكة خارجية: كل المحوّلات وهمية (mock:true). لا يعدّل ملفات المستودع.
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-copilot.js
   ما لا يغطيه هذا الاختبار (موثَّق في نهاية الملف وفي التقرير): نزع خلفية حقيقي PBBgRemove، نموذج لغة وصور حقيقيان، المراجعة البصرية، scope_violation المباشر. */
const fs = require("fs"), path = require("path"); const { chromium } = require("playwright");
const ROOT = path.join(__dirname, ".."), PAGE = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/pages/memory-focus.json"), "utf8"));
let n = 0; const fails = []; const ok = (c, m, x) => { if (!c) { console.log("✗ " + m + (x !== undefined ? " " + JSON.stringify(x).slice(0, 400) : "")); fails.push(m); } else { n++; console.log("✓ " + m); } };

/* ───── ما يُحقن داخل الصفحة: محوّلات وهمية + أدوات مساعدة ───── */
const HELPERS = require("./lib/copilot-test-helpers.js");

(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1500, height: 950 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  await p.addScriptTag({ path: path.join(ROOT, "scripts/pagebuilder-copilot.js") });
  await p.evaluate(pg => { window.__PAGE = pg; }, PAGE); await p.evaluate(HELPERS);
  const ev = (fn, arg) => p.evaluate(fn, arg);

  /* ── 0) تحميل الوحدة ── */
  const info = await ev(() => ({ ok: typeof PBCopilot === "object", ops: PBCopilot.OPS, prot: PBCopilot.PROTECTED }));
  ok(info.ok && info.ops.length >= 10, "الوحدة تُحمَّل وتعرض أوامرها: " + (info.ops || []).join(","));
  ok(!info.ops.some(o => /publish|price|product|html|script|save/i.test(o)), "لا أمر نشر/سعر/منتج/HTML/سكربت في قائمة الأوامر");

  /* ── 1) رفض الأغلفة العدائية والممنوعة (تحقق نقي، كل غلاف يُرفض كاملاً) ── */
  const rej = await ev(() => {
    const F = PBCopilot.normFacts(__T.FACTS), v = (ops, o) => PBCopilot.validateEnvelope({ v: 1, ops }, F, o), L = (layer) => ({ op: "layer.add", args: { section: "@first", layer } });
    const codes = r => r.errors.map(e => e.code);
    const R = {};
    R.html = codes(v([L({ type: "text", text: "<img src=x onerror=alert(1)>", x: 0, y: 0, w: 100, h: 50 })]));
    R.js = codes(v([L({ type: "button", text: "x", link: "javascript:alert(1)", x: 0, y: 0, w: 100, h: 50 })]));
    R.pub = codes(v([{ op: "page.publish", args: {} }])); R.prod = codes(v([{ op: "product.update", args: { slug: "tarkiz", price: 1 } }])); R.price = codes(v([{ op: "price.set", args: { v: 1 } }]));
    R.save = codes(v([{ op: "page.save", args: {} }])); R.ev = codes(v([{ op: "eval", args: { code: "1" } }])); R.unk = codes(v([{ op: "foo.bar", args: {} }]));
    R.html2 = codes(v([L({ type: "html", html: "<b>x</b>", x: 0, y: 0, w: 10, h: 10 })])); R.pprice = codes(v([L({ type: "price", x: 0, y: 0, w: 10, h: 10 })])); R.ifr = codes(v([L({ type: "iframe", x: 0, y: 0, w: 10, h: 10 })]));
    R.proto = codes(PBCopilot.validateEnvelope(JSON.parse('{"v":1,"ops":[{"op":"layer.add","args":{"__proto__":{"x":1},"section":"@first","layer":{"type":"shape"}}}]}'), F, {}));
    R.inv1 = codes(v([L({ type: "text", text: "السعر 999 دج فقط", x: 0, y: 0, w: 100, h: 50 })])); R.inv2 = codes(v([L({ type: "text", text: "خصم 50% اليوم", x: 0, y: 0, w: 100, h: 50 })]));
    R.inv3 = codes(v([L({ type: "text", text: "{{offer9.price}}", x: 0, y: 0, w: 100, h: 50 })])); R.inv4 = codes(v([L({ type: "heading", text: "وفّر 700 دج الآن", x: 0, y: 0, w: 100, h: 50 })]));
    R.inv5 = codes(v([L({ type: "text", text: "تخفيض -75%", x: 0, y: 0, w: 100, h: 50 })]));
    R.okp = codes(v([L({ type: "text", text: "السعر 1800 دج بدل 3100 دج وفّر 1300 دج (-42%)", x: 0, y: 0, w: 100, h: 50 })]));
    R.color = codes(v([L({ type: "shape", fill: "red;background:url(javascript:1)", x: 0, y: 0, w: 10, h: 10 })])); R.src = codes(v([L({ type: "image", src: "http://evil.com/a.png", x: 0, y: 0, w: 10, h: 10 })])); R.src2 = codes(v([L({ type: "image", src: "javascript:alert(1)", x: 0, y: 0, w: 10, h: 10 })]));
    R.noops = codes(PBCopilot.validateEnvelope({ v: 1, ops: [] }, F, {})); R.notobj = codes(PBCopilot.validateEnvelope("x", F, {}));
    R.many = codes(PBCopilot.validateEnvelope({ v: 1, ops: Array.from({ length: 200 }, (_, i) => ({ id: "a" + i, op: "layer.reorder", args: { ref: "abc123", how: "up" } })) }, F, {}));
    R.dupid = codes(v([{ id: "x", op: "layer.reorder", args: { ref: "abc123", how: "up" } }, { id: "x", op: "layer.reorder", args: { ref: "abc123", how: "up" } }]));
    R.editStruct = codes(v([{ op: "section.add", args: {} }], { kind: "edit" })); R.badpatch = codes(v([{ op: "layer.update", args: { ref: "abc123", patch: { onclick: "x" } } }])); R.badeff = codes(v([{ op: "effect.set", args: { ref: "abc123", entrance: "evilAnim" } }]));
    R.manyDel = codes(v(Array.from({ length: 5 }, (_, i) => ({ id: "d" + i, op: "layer.delete", args: { ref: "abc12" + i } })), { kind: "edit" }));
    R.valid = v(JSON.parse(JSON.stringify(__T.designOps().ops)), { kind: "design" }).ok;
    R.mixed = (() => { const ops = __T.designOps().ops.slice(); ops.push({ id: "bad", op: "page.publish", args: {} }); const r = v(ops, {}); return { ok: r.ok, n: r.ops.length, codes: codes(r) }; })();
    return R;
  });
  const has = (a, c) => (a || []).includes(c);
  ok(has(rej.html, "html_forbidden"), "HTML داخل نص النموذج مرفوض"); ok(has(rej.js, "bad_link"), "رابط javascript: مرفوض");
  ok(["pub", "prod", "price", "save", "ev"].every(k => has(rej[k], "forbidden_op")), "أوامر النشر/المنتج/السعر/الحفظ/eval ممنوعة صراحةً");
  ok(has(rej.unk, "unknown_op"), "أمر مجهول مرفوض");
  ok([rej.html2, rej.pprice, rej.ifr].every(a => has(a, "type_not_allowed")), "أنواع html/price/iframe غير مسموحة للنموذج");
  ok(has(rej.proto, "forbidden_key"), "مفتاح __proto__ مرفوض");
  ok(["inv1", "inv2", "inv4", "inv5"].every(k => has(rej[k], "price_unapproved")), "سعر/خصم/نسبة غير مقدَّمة من المستخدم مرفوضة (999 دج، 50%، 700 دج، -75%)");
  ok(has(rej.inv3, "fact_missing"), "رمز {{offer9.price}} لمعلومة لم يقدّمها المستخدم ← fact_missing (لا اختراع)");
  ok(rej.okp.length === 0, "أرقام المستخدم الحرفية (1800 دج، 3100 دج، 1300 دج، -42%) مقبولة", rej.okp);
  ok(has(rej.color, "bad_color") && has(rej.src, "bad_src") && has(rej.src2, "bad_src"), "لون ضار ومصدر صورة http/javascript مرفوضان");
  ok(has(rej.noops, "bad_envelope") && has(rej.notobj, "bad_envelope"), "غلاف فارغ أو غير كائن مرفوض"); ok(has(rej.many, "too_many_ops"), "تجاوز سقف عدد الأوامر مرفوض");
  ok(has(rej.dupid, "bad_op_id"), "معرّف أمر مكرر مرفوض"); ok(has(rej.editStruct, "structural_in_edit"), "التعديل التدريجي لا يقبل أوامر بنيوية");
  ok(has(rej.badpatch, "bad_patch_key"), "حقل غير مسموح في layer.update مرفوض"); ok(has(rej.badeff, "bad_effect"), "حركة غير معرّفة مرفوضة"); ok(has(rej.manyDel, "too_many_deletes"), "حذف جماعي في تعديل تدريجي مرفوض");
  ok(rej.valid === true, "غلاف التصميم الشرعي (14 أمراً) يجتاز التحقق"); ok(rej.mixed.ok === false && rej.mixed.codes.includes("forbidden_op"), "أمر ممنوع واحد يُسقط الغلاف كله", rej.mixed);

  /* ── 2) شروط ما قبل التشغيل ── */
  const pre = await ev(async () => {
    await __T.open(); const R = {}; const A = __T.mkAdapters(); const t = async f => { try { await f(); return "no_throw"; } catch (e) { return e.code || String(e); } };
    R.nofacts = await t(() => PBCopilot.run({ goal: "x", adapters: A })); R.noprice = await t(() => PBCopilot.run({ goal: "x", facts: { product: "p" }, adapters: A }));
    R.noguard = await t(() => PBCopilot.run({ goal: "x", facts: __T.FACTS, adapters: { llm: A.llm, img: A.img, store: A.store } }));
    R.calls = A.calls.plan + A.calls.ops + A.calls.img; return R;
  });
  ok(pre.nofacts === "facts_required" && pre.noprice === "facts_required", "بلا بيانات تجارية من المستخدم لا يبدأ التشغيل (facts_required)", pre);
  ok(pre.noguard === "guard_required", "المحوّل غير الوهمي بلا guard خادمي مرفوض (guard_required)"); ok(pre.calls === 0, "لا استدعاء نموذج/صورة قبل اجتياز الشروط");

  /* ── 3) تشغيل تصميم كامل: تراجع ذري واحد + بيانات + استقلال العناصر ── */
  const D = await ev(async () => {
    const E = await __T.open(), A = __T.mkAdapters(), before = PBApp.pageJson(), h0 = E.hist.length, w0 = __T.widgets(E.page).length, s0 = E.page.sections.length;
    const res = await PBCopilot.run({ goal: "قسم عرض لعسل التركيز", facts: __T.FACTS, adapters: A });
    const after = PBApp.pageJson(), h1 = E.hist.length, secs = E.page.sections, off = secs[1], w1 = __T.widgets(E.page).length;
    const out = { res, h0, h1, s0, s1: secs.length, w0, w1, calls: A.calls, uploads: A.uploads.slice(), types: (off.free || []).map(w => w.type), texts: (off.free || []).map(w => __T.textOf(w)).filter(Boolean), keys: (off.free || []).map(w => w.set.aiKey).filter(Boolean), logLast: (E.log[E.log.length - 1] || {}).label };
    out.imgs = (off.free || []).filter(w => w.type === "image").map(w => ({ src: w.set.src, prompt: w.set.aiPrompt }));
    out.forbidden = widgets_has(E.page);
    function widgets_has(pg) { return __T.widgets(pg).filter(w => /^(pprice|poffers|code|iframe)$/.test(w.type) && w.set.aiKey).length; }
    /* كل عنصر جديد مرسوم ويُحدَّد منفرداً ويفتح إعداداته */
    const fd = document.getElementById("pbx-frame").contentDocument, sel = { ok: 0, bad: [] };
    for (const w of off.free) { E.sel = w.id; PBApp.renderInspectorNow(); await new Promise(r => setTimeout(r, 15)); const el = fd.querySelector('[data-pb="' + w.id + '"]'), insp = document.getElementById("pbx-insp"); if (el && insp && insp.querySelectorAll("input,textarea,select,button").length > 3) sel.ok++; else sel.bad.push(w.type); }
    out.sel = sel; out.nFree = off.free.length;
    /* الأقسام الأخرى لم تتغير */
    const orig = JSON.parse(before); out.othersSame = JSON.stringify(orig.sections[0]) === JSON.stringify(E.page.sections[0]) && JSON.stringify(orig.sections[1]) === JSON.stringify(E.page.sections[2]);
    /* تراجع ذري واحد */
    E.sel = null; PBApp.undo(); await new Promise(r => setTimeout(r, 200)); out.undoSame = PBApp.pageJson() === before; out.hAfterUndo = E.hist.length; out.hiAfterUndo = E.hi;
    return out;
  });
  ok(D.res.ok && D.res.status === "done", "التشغيل ينجح بلا أخطاء", D.res);
  ok(D.s1 === D.s0 + 1 && D.nFree === 8, "قسم واحد متماسك (عدد الأقسام +1) و8 طبقات حرة", { s0: D.s0, s1: D.s1, nFree: D.nFree });
  ok(D.h1 === D.h0 + 1, "كل التشغيل = مدخل واحد في تاريخ المحرر (" + D.h0 + "→" + D.h1 + ")");
  ok(D.undoSame, "تراجع واحد يعيد الصفحة JSON مطابقاً بايتاً ببايت (بما فيها الصور والطبقات)"); ok(D.hiAfterUndo === D.h0 - 1, "مؤشر التاريخ رجع خطوة واحدة فقط", { hi: D.hiAfterUndo, h0: D.h0 });
  ok(D.othersSame, "الأقسام الأصلية (الملصق وقسم الطلب) لم تتغير");
  ok(D.sel.ok === D.nFree && !D.sel.bad.length, "كل عنصر مولَّد يُرسم ويُحدَّد منفرداً ويفتح إعداداته (" + D.sel.ok + "/" + D.nFree + ")", D.sel.bad);
  ok(D.texts.some(t => /^السعر: 1800 دج$/.test(t)), "نص السعر = رقم المستخدم 1800 دج (نص عادي)", D.texts);
  ok(D.texts.some(t => /3100 دج/.test(t) && /1300 دج/.test(t) && /42%/.test(t)), "السعر القديم والوفر والنسبة محسوبة من بيانات المستخدم فقط", D.texts);
  ok(D.texts.some(t => /قارورتان \+ قارورة هدية: 3200 دج/.test(t)), "نص العرض الثاني من بيانات المستخدم", D.texts);
  ok(D.forbidden === 0 && !D.types.some(t => /pprice|poffers|html|code/.test(t)), "لا عناصر pprice/poffers/html مُنشأة؛ كلها عناصر عادية", D.types);
  ok(D.calls.img === 2 && D.calls.upload === 2 && D.calls.removeBg === 2 && new Set(D.uploads).size === 2, "صورتان فقط: توليد ورفع ونزع خلفية لكل منهما (بلا تكرار)", D.calls);
  ok(D.imgs.every(i => /^assets\/img\/pages\/copilot-/.test(i.src || "")), "مسارات الصور المرفوعة موضوعة في العناصر", D.imgs);
  ok(D.calls.plan === 1 && D.calls.ops === 1 && D.calls.charge === 2 + 2, "مكالمتا نموذج فقط (خطة + أوامر) وتُحتسبان عبر guard الخادمي مع الصور", D.calls);

  /* ── 4) قبول المستخدم: تحديد نص السعر ← تعديل يدوي ← حفظ ← إعادة فتح ← يبقى النص المعدَّل ── */
  const Q = await ev(async () => {
    const E = await __T.open(), A = __T.mkAdapters(); const res = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: A });
    const price = __T.widgets(E.page).find(w => w.set.aiKey === "price"); if (!price) return { err: "no price widget", res };
    E.sel = price.id; PBApp.renderInspectorNow(); await new Promise(r => setTimeout(r, 50));
    /* التعديل اليدوي كما يفعله المحرر: تغيير html العنصر ثم commit */
    const NEW = "السعر الجديد: 1500 دج";
    price.set.html = "<p>" + NEW + "</p>"; price.set.color = "#b71c1c"; price.set.fs = Object.assign({}, price.set.fs, { d: 60 }); PBApp.commitAfter(price.id);
    await new Promise(r => setTimeout(r, 300)); PBApp.saveDraftNow && PBApp.saveDraftNow();
    const saved = PBApp.pageJson(), draftKey = Object.keys(localStorage).find(k => /^pb_draft_/.test(k)), draft = draftKey ? localStorage.getItem(draftKey) : "";
    /* إعادة فتح من المحفوظ */
    PBApp.open(JSON.parse(saved)); await new Promise(r => setTimeout(r, 2200));
    const E2 = PBApp.E, p2 = __T.widgets(E2.page).find(w => w.id === price.id), fd = document.getElementById("pbx-frame").contentDocument, el = fd.querySelector('[data-pb="' + price.id + '"]');
    return { res: res.status, NEW, txt: p2 && __T.textOf(p2), color: p2 && p2.set.color, fs: p2 && p2.set.fs && p2.set.fs.d, inDraft: draft.includes("1500"), rendered: el && el.textContent.includes("1500"), stillEditable: !!p2 && !p2.set.locked, anyPriceBinding: __T.widgets(E2.page).filter(w => /pprice|poffers/.test(w.type) && w.set.aiKey).length };
  });
  ok(!Q.err && Q.res === "done", "تشغيل التصميم قبل اختبار القبول ينجح", Q);
  ok(Q.txt === Q.NEW && Q.color === "#b71c1c" && Q.fs === 60, "بعد الحفظ وإعادة الفتح يبقى نص السعر المعدَّل يدوياً كما هو (نص ولون وحجم)", Q);
  ok(Q.inDraft && Q.rendered, "النص المعدَّل في المسودة المحفوظة ومرسوم في المحرر", { inDraft: Q.inDraft, rendered: Q.rendered });
  ok(Q.anyPriceBinding === 0, "لا ربط ديناميكياً بـpprice/poffers يمنع التعديل اليدوي");

  /* ── 5) الاستئناف الآمن: انقطاع عند كل أمر ثم resume ← نفس النتيجة بلا تكرار عناصر/صور ── */
  const Rz = await ev(async () => {
    const E = await __T.open(); const baseline = (async () => { const A = __T.mkAdapters(); const r = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: A }); return { sig: __T.sig(E.page), A, r }; });
    const ref = await baseline(); /* مرجع بلا انقطاع */
    const results = []; let maxK = 40;
    for (let k = 1; k <= maxK; k++) {
      await __T.open(); const before = PBApp.pageJson(); let cnt = 0, thrown = false;
      const A = __T.mkAdapters({ hooks: { beforeOp: async () => { if (++cnt === k) { thrown = true; throw new PBCopilot.Interrupt("cut"); } } } });
      let first, err; try { first = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: A }); } catch (e) { err = e; }
      if (!thrown) { results.push({ k, finished: true }); break; }
      const idle = PBApp.pageJson() === before, h = PBApp.E.hist.length, id = A.store.list()[0];
      const A2 = Object.assign({}, A, { hooks: {} });
      const r2 = await PBCopilot.resume(id, { adapters: A2 });
      const sig = __T.sig(PBApp.E.page), widgets = __T.widgets(PBApp.E.page), keyed = widgets.filter(w => w.set.aiKey).map(w => w.set.aiKey), dupKeys = keyed.length - new Set(keyed).size;
      results.push({ k, interrupted: !!(err && err.interrupt), idle, status: r2.status, same: sig === ref.sig, dupKeys, img: A.calls.img, up: A.calls.upload, rb: A.calls.removeBg, uploadsUniq: new Set(A.uploads).size, hist: PBApp.E.hist.length - h, again: (await PBCopilot.resume(id, { adapters: A2 })).already === true });
    }
    return { refImg: ref.A.calls.img, results };
  });
  const rs = Rz.results.filter(r => !r.finished);
  ok(rs.length >= 14, "جُرّب الانقطاع عند " + rs.length + " نقطة (كل أمر في التشغيل)");
  ok(rs.every(r => r.interrupted && r.idle), "الانقطاع لا يغيّر الصفحة المفتوحة (الاعتماد فقط عند النجاح)", rs.filter(r => !(r.interrupted && r.idle)).slice(0, 3));
  ok(rs.every(r => r.status === "done" && r.same), "الاستئناف بعد كل نقطة انقطاع ينتهي بنتيجة مطابقة لتشغيل بلا انقطاع", rs.filter(r => !(r.status === "done" && r.same)).slice(0, 3));
  ok(rs.every(r => r.dupKeys === 0), "لا عناصر مكررة بعد الاستئناف");
  ok(rs.every(r => r.img === Rz.refImg && r.up === Rz.refImg && r.uploadsUniq === Rz.refImg && r.rb === Rz.refImg), "لا توليد ولا رفع ولا نزع خلفية مكرر (" + Rz.refImg + " فقط) مهما كان موضع الانقطاع", rs.filter(r => !(r.img === Rz.refImg && r.up === Rz.refImg)).slice(0, 3));
  ok(rs.every(r => r.hist === 1), "الاستئناف يضيف مدخل تاريخ واحداً فقط"); ok(rs.every(r => r.again), "إعادة resume لتشغيل منتهٍ لا تفعل شيئاً (already)");

  /* ── 6) سقوف الصور وإعادة المحاولة وguard ── */
  const Cp = await ev(async () => {
    const R = {}; const run = (ex, o) => PBCopilot.run(Object.assign({ goal: "g", facts: __T.FACTS }, o || {}, { adapters: __T.mkAdapters(ex) }));
    /* فشل دائم: محاولتان لكل صورة (1 + retries) ثم image_failed، والصفحة تُعتمد مع تسجيل الخطأ */
    await __T.open(); let fail = 0; const A1 = __T.mkAdapters({ img: { generate: async () => { fail++; throw new Error("boom"); } } }); const r1 = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: A1 });
    R.fail = { status: r1.status, calls: fail, codes: r1.errors.map(e => e.code), imgCount: r1.counts.img };
    /* صارم: أول خطأ يوقف ويتراجع بلا أي تغيير */
    const E = await __T.open(), before = PBApp.pageJson(), h = E.hist.length; fail = 0; const r2 = await PBCopilot.run({ goal: "g", facts: __T.FACTS, strict: true, adapters: __T.mkAdapters({ img: { generate: async () => { fail++; throw new Error("boom"); } } }) });
    R.strict = { ok: r2.ok, status: r2.status, same: PBApp.pageJson() === before, h: E.hist.length - h, err: r2.error && r2.error.code };
    /* سقف الصور = 1 */
    await __T.open(); const A3 = __T.mkAdapters({ limits: { img: 1 } }); const r3 = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: A3 }); R.cap = { calls: A3.calls.img, codes: r3.errors.map(e => e.code) };
    /* guard يرفض الصور */
    await __T.open(); const A4 = __T.mkAdapters({ guard: { charge: async k => (k === "image" ? { ok: false, reason: "quota" } : { ok: true }) } }); const r4 = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: A4 }); R.guard = { calls: A4.calls.img, codes: r4.errors.map(e => e.code) };
    /* guard يرفض النموذج: لا شيء يحدث */
    const E5 = await __T.open(), b5 = PBApp.pageJson(); const A5 = __T.mkAdapters({ guard: { charge: async () => ({ ok: false, reason: "budget" }) } }); const r5 = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: A5 }); R.guardLlm = { ok: r5.ok, status: r5.status, same: PBApp.pageJson() === b5, ops: A5.calls.ops, code: r5.error && r5.error.code };
    /* سقف مكالمات النموذج */
    await __T.open(); const r6 = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: __T.mkAdapters({ limits: { llm: 1 } }) }); R.llm = { ok: r6.ok, code: r6.error && r6.error.code };
    /* نموذج يخترع سعراً: يُرفض الغلاف كله ولا يُرفع شيء */
    const E7 = await __T.open(), b7 = PBApp.pageJson(); const bad = __T.designOps(); bad.ops[3].args.layer.text = "السعر: 999 دج"; const A7 = __T.mkAdapters({ llm: { plan: async () => ({}), ops: async () => bad } }); const r7 = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: A7 });
    R.invent = { ok: r7.ok, status: r7.status, codes: r7.errors.map(e => e.code), same: PBApp.pageJson() === b7, img: A7.calls.img, up: A7.calls.upload, h: E7.hist.length };
    return R;
  });
  ok(Cp.fail.status === "done_with_errors" && Cp.fail.calls === 4 && Cp.fail.codes.every(c => c === "image_failed"), "فشل التوليد الدائم: محاولتان لكل صورة بالضبط (4 استدعاءات لصورتين) ثم image_failed", Cp.fail);
  ok(Cp.strict.ok === false && Cp.strict.same && Cp.strict.h === 0 && Cp.strict.err === "run_aborted", "الوضع الصارم: أول خطأ يوقف ويترك الصفحة كما هي بلا مدخل تاريخ", Cp.strict);
  ok(Cp.cap.calls === 1 && Cp.cap.codes.includes("limit_images"), "سقف الصور في التشغيل يُطبَّق (محاولة واحدة ثم limit_images)", Cp.cap);
  ok(Cp.guard.calls === 0 && Cp.guard.codes.every(c => c === "guard_denied") && Cp.guard.codes.length >= 2, "رفض guard الخادمي يمنع التوليد قبل الاستدعاء", Cp.guard);
  ok(!Cp.guardLlm.ok && Cp.guardLlm.same && Cp.guardLlm.ops === 0, "رفض guard لمكالمة النموذج يوقف كل شيء بلا أثر", Cp.guardLlm);
  ok(!Cp.llm.ok, "سقف مكالمات النموذج يُطبَّق", Cp.llm);
  ok(Cp.invent.status === "rejected" && Cp.invent.codes.includes("price_unapproved") && Cp.invent.same && Cp.invent.img === 0 && Cp.invent.up === 0, "نموذج يخترع سعراً: يُرفض الغلاف كله بلا أي تغيير ولا توليد صور", Cp.invent);

  /* ── 7) التعديل التدريجي ── */
  const Ed = await ev(async () => {
    const E = await __T.open(); const A0 = __T.mkAdapters(); await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: A0 });
    const ws = __T.widgets(E.page), byKey = k => ws.find(w => w.set.aiKey === k), title = byKey("title"), jar = byKey("jar"), cta = byKey("cta");
    const snapAll = () => Object.fromEntries(__T.widgets(E.page).map(w => [w.id, JSON.stringify(w)])), secMeta = () => JSON.stringify(E.page.sections.map(s => ({ id: s.id, set: s.set })));
    const before = snapAll(), sm0 = secMeta(), pj = PBApp.pageJson(), h0 = E.hist.length, R = {};
    const editWith = (ops, extra) => PBCopilot.edit(Object.assign({ instruction: "عدّل", facts: __T.FACTS, adapters: __T.mkAdapters({ llm: { edit: async () => ({ v: 1, ops }) } }) }, extra || {}));
    const r = await editWith([{ id: "e1", op: "layer.update", args: { ref: title.id, patch: { text: "عسل التركيز — عرض خاص", color: "#8a1c1c" } } }, { id: "e2", op: "effect.set", args: { ref: jar.id, entrance: "fadeIn", continuous: ["glow"] } }]);
    const after = snapAll(); const changed = Object.keys(after).filter(id => after[id] !== before[id]);
    R.edit = { ok: r.ok, status: r.status, changed: changed.length, onlyTouched: changed.every(id => [title.id, jar.id].includes(id)) && changed.includes(title.id) && changed.includes(jar.id), hist: E.hist.length - h0, secSame: secMeta() === sm0, titleTxt: __T.textOf(__T.widgets(E.page).find(w => w.id === title.id)), jarFx: !!(__T.widgets(E.page).find(w => w.id === jar.id).set.anim || (__T.widgets(E.page).find(w => w.id === jar.id).set.fxs || []).length) };
    PBApp.undo(); await new Promise(r => setTimeout(r, 150)); R.undo = PBApp.pageJson() === pj;
    /* تعديل السعر بتوكن من بيانات المستخدم ثم تعديل يدوي لاحق مسموح */
    const r2 = await editWith([{ id: "p1", op: "layer.update", args: { ref: byKey("price").id, patch: { text: "الآن فقط {{offer2.price}}" } } }]);
    R.token = { ok: r2.ok, txt: __T.textOf(__T.widgets(E.page).find(w => w.id === byKey("price").id)) };
    /* ممنوع: تعديل عنصر محمي (نموذج الطلب) أو رقم غير مقدَّم أو عنصر غير موجود */
    const ord = __T.widgets(E.page).find(w => w.type === "orderorig"), html = __T.widgets(E.page).find(w => w.type === "html"), pj2 = PBApp.pageJson(), h2 = E.hist.length;
    const r3 = await editWith([{ id: "x1", op: "layer.delete", args: { ref: ord.id } }, { id: "x2", op: "layer.update", args: { ref: html.id, patch: { text: "x" } } }]);
    const r3b = await editWith([{ id: "x3", op: "layer.update", args: { ref: "zzzzzz", patch: { text: "x" } } }]);
    /* مساس بعنصر محمي وسط أوامر سليمة يُسقط التشغيل كله (لا اعتماد جزئي) */
    const r3c = await editWith([{ id: "x4", op: "layer.update", args: { ref: title.id, patch: { text: "عنوان آخر" } } }, { id: "x5", op: "layer.delete", args: { ref: ord.id } }]);
    R.prot = { status: r3.status, codes: r3.errors.map(e => e.code).concat(r3b.errors.map(e => e.code)), same: PBApp.pageJson() === pj2, h: E.hist.length - h2, mixed: { st: r3c.status, same: PBApp.pageJson() === pj2 } };
    const r4 = await editWith([{ id: "y1", op: "layer.update", args: { ref: cta.id, patch: { text: "اشترِ بـ 500 دج فقط" } } }]); R.inv = { status: r4.status, codes: r4.errors.map(e => e.code), same: PBApp.pageJson() === pj2 };
    const r5 = await editWith([{ id: "z1", op: "section.add", args: {} }]); R.struct = { status: r5.status, codes: r5.errors.map(e => e.code), same: PBApp.pageJson() === pj2 };
    /* تغيّر الصفحة أثناء التشغيل ← تراجع كامل (base_changed) */
    const r6 = await PBCopilot.edit({ instruction: "x", facts: __T.FACTS, adapters: __T.mkAdapters({ llm: { edit: async () => ({ v: 1, ops: [{ id: "k1", op: "layer.update", args: { ref: title.id, patch: { text: "جديد" } } }] }) }, hooks: { beforeOp: async () => { E.page.title = "تغيّر أثناء التشغيل"; } } }) });
    R.base = { status: r6.status, code: r6.error && r6.error.code, titleKept: E.page.title === "تغيّر أثناء التشغيل", textUntouched: __T.textOf(__T.widgets(E.page).find(w => w.id === title.id)) !== "جديد" };
    return R;
  });
  ok(Ed.edit.ok && Ed.edit.onlyTouched && Ed.edit.changed === 2, "التعديل يغيّر عنصرين فقط (العنوان والصورة) وكل بقية العناصر مطابقة تماماً", Ed.edit);
  ok(Ed.edit.secSame && Ed.edit.hist === 1 && Ed.edit.titleTxt === "عسل التركيز — عرض خاص" && Ed.edit.jarFx, "إعدادات الأقسام لم تتغير، مدخل تاريخ واحد، النص الجديد مطبَّق وتأثير الصورة موجود");
  ok(Ed.undo, "تراجع واحد يعيد الصفحة كما كانت قبل التعديل");
  ok(Ed.token.ok && Ed.token.txt === "الآن فقط 3200 دج", "نص جديد من توكن بيانات المستخدم ينجح", Ed.token);
  ok(Ed.prot.same && Ed.prot.h === 0 && Ed.prot.codes.includes("protected_layer") && Ed.prot.codes.includes("ref_not_found") && Ed.prot.mixed.st === "failed" && Ed.prot.mixed.same, "حذف/تعديل عنصر محمي (نموذج الطلب، html) أو غير موجود يُسجَّل خطأ ولا يغيّر الصفحة، وإن جاء وسط أوامر سليمة سقط التشغيل كله", Ed.prot);
  ok(Ed.inv.status === "rejected" && Ed.inv.codes.includes("price_unapproved") && Ed.inv.same, "تعديل بسعر غير مقدَّم (500 دج) مرفوض بلا أثر", Ed.inv);
  ok(Ed.struct.status === "rejected" && Ed.struct.same, "أمر بنيوي في تعديل تدريجي مرفوض بلا أثر", Ed.struct);
  ok(Ed.base.status === "rolled_back" && Ed.base.code === "base_changed" && Ed.base.titleKept && Ed.base.textUntouched, "تغيّر الصفحة أثناء تشغيل الذكاء الاصطناعي ← لا يُعتمد شيء (base_changed)", Ed.base);

  /* ── 7ب) الاستمرارية البصرية: لون واحد/تدرّج متصل بين الأقسام بلا حدود ظاهرة ── */
  const Ct = await ev(async () => {
    const R = {}; const F = PBCopilot.normFacts(__T.FACTS);
    R.rgba = PBCopilot.validateEnvelope({ v: 1, ops: [{ op: "page.background", args: { stops: [{ c: "rgba(0,0,0,.5)", p: 0 }, { c: "#fff", p: 100 }] } }] }, F, {}).errors.map(e => e.code);
    R.one = PBCopilot.validateEnvelope({ v: 1, ops: [{ op: "page.background", args: { stops: [{ c: "#fff", p: 0 }] } }] }, F, {}).errors.map(e => e.code);
    /* نجاح: حواف متصلة */
    const E = await __T.open(); const A = __T.mkAdapters(); const ok1 = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: A });
    const S = PBCopilot._t, pg = E.page, e0 = S.edgeOf(pg.sections[0], pg), e1 = S.edgeOf(pg.sections[1], pg), e2 = S.edgeOf(pg.sections[2], pg), d = (a, b) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3;
    R.ok = { status: ok1.status, warnings: ok1.warnings, top: d(e0.bottom, e1.top), bot: d(e1.bottom, e2.top), gr: pg.sections[1].set.gr, breaks: S.contBreaks(pg, [pg.sections[1].id]).length };
    R.outlineEdge = PBCopilot.outline(pg).sections[1].edge;
    /* لون قسم مختلف بلا تدرّج ← حدّ ظاهر ← يُرفض الاعتماد كله */
    const mkBad = fn => { const o = __T.designOps(); fn(o.ops); return o; };
    const tryRun = async (env, extra) => { const E2 = await __T.open(), b = PBApp.pageJson(), h = E2.hist.length; const r = await PBCopilot.run(Object.assign({ goal: "g", facts: __T.FACTS, adapters: __T.mkAdapters({ llm: { plan: async () => ({}), ops: async () => env } }) }, extra || {})); return { status: r.status, code: r.error && r.error.code, breaks: r.error && r.error.breaks, same: PBApp.pageJson() === b, h: E2.hist.length - h, n: __T.widgets(E2.page).length }; };
    R.badBg = await tryRun(mkBad(o => { o.splice(1, 1); o[0].args.bg = "#fff8e6"; }));
    R.noBg = await tryRun(mkBad(o => { o.splice(1, 1); }));
    R.allow = await tryRun(mkBad(o => { o.splice(1, 1); o[0].args.bg = "#fff8e6"; }), { allowBreaks: true });
    /* تدرّج لا يبدأ من لون جاره ← حدّ ظاهر */
    R.offStart = await tryRun(mkBad(o => { o[1].args.stops = [{ c: "#2e7d32", p: 0 }, { c: "#102B4C", p: 100 }]; }));
    /* قسم الطلب (عنصر محمي) لا تُعدَّل خلفيته */
    const E3 = await __T.open(); const ordId = E3.page.sections[1].id; const r3 = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: __T.mkAdapters({ llm: { plan: async () => ({}), ops: async () => ({ v: 1, ops: [{ id: "b1", op: "page.background", args: { sections: [ordId], stops: [{ c: "#ffffff", p: 0 }, { c: "#000000", p: 100 }] } }] }) } }) });
    R.prot = { codes: r3.errors.map(e => e.code), status: r3.status };
    /* لوحة صندوقية معتمة ← تحذير */
    const o4 = __T.designOps(); o4.ops[2].args.layer = { type: "shape", shape: "rect", x: 40, y: 40, w: 848, h: 680, fill: "#f5e3b0", radius: 40, z: 1 };
    await __T.open(); const r4 = await PBCopilot.run({ goal: "g", facts: __T.FACTS, adapters: __T.mkAdapters({ llm: { plan: async () => ({}), ops: async () => o4 } }) }); R.panel = { status: r4.status, w: r4.warnings };
    return R;
  });
  ok(Ct.rgba.includes("bad_color") && Ct.one.includes("bad_args"), "page.background يرفض ألواناً غير سداسية وتدرّجاً بلون واحد");
  ok(Ct.ok.status === "done" && Ct.ok.breaks === 0 && Ct.ok.top <= 16 && Ct.ok.bot <= 16, "القسم الجديد يتصل لونياً بجاره الأعلى والأسفل بلا حدّ ظاهر (فرق " + Ct.ok.top.toFixed(1) + " و" + Ct.ok.bot.toFixed(1) + " من 255)", Ct.ok);
  ok(Ct.ok.gr && Ct.ok.gr.t === "linear" && Ct.ok.gr.a === 180 && Ct.ok.gr.s.length >= 3, "الخلفية تدرّج خطي متصل (شريحة من تدرّج الصفحة الموحّد)", Ct.ok.gr);
  ok(Ct.outlineEdge && /^#f8f4e9$/i.test(Ct.outlineEdge.top) && /^#102b4c$/i.test(Ct.outlineEdge.bottom), "ملخّص الصفحة للنموذج يعرض لون حافتي كل قسم ليبني تدرّجه منهما", Ct.outlineEdge);
  ok(Ct.badBg.status === "rolled_back" && Ct.badBg.code === "continuity_break" && Ct.badBg.same && Ct.badBg.h === 0, "قسم بلون مختلف عن جيرانه يُرفض اعتماده كله (continuity_break) والصفحة كما هي", Ct.badBg);
  ok(Ct.noBg.code === "continuity_break" && Ct.noBg.same, "قسم بلا خلفية فوق حدّ لوني موجود (أبيض/أزرق داكن) يُرفض أيضاً", Ct.noBg);
  ok(Ct.offStart.code === "continuity_break" && Ct.offStart.same, "تدرّج لا يبدأ من لون جاره يُرفض", Ct.offStart);
  ok(Ct.allow.status === "done" && Ct.allow.h === 1, "الخيار الصريح allowBreaks يسمح بالحدّ عند الحاجة", Ct.allow);
  ok(Ct.prot.codes.includes("protected_layer"), "لا تُعدَّل خلفية قسم فيه عنصر محمي (نموذج الطلب)", Ct.prot);
  ok(Ct.panel.w.some(m => /لوحة صندوقية/.test(m)), "مستطيل معتم كبير بزوايا يُنبَّه إليه كلوحة صندوقية", Ct.panel);

  /* ── 8) المحرر الحالي لم يُمسّ ── */
  const cp = require("child_process"), git = cp.execSync("git status --short", { cwd: ROOT }).toString();
  const touched = git.split("\n").map(l => l.slice(3).trim()).filter(Boolean), guarded = touched.filter(f => (/^scripts\/pagebuilder[\w-]*\.js$/.test(f) && !/pagebuilder-copilot(-real|-ui)?\.js$/.test(f)) || f === "scripts/build-admin-pb.py" || /^assets\/pages\//.test(f));
  ok(guarded.length === 0, "المحرر وPBSpec وصفحات assets/pages لم تُمسّ (pagebuilder.js/pagebuilder-editor.js/… كما هي)", guarded);
  /* admin.html: مسموح فقط بسطر المُحمِّل الاختياري الوحيد (لا يعمل إلا مع ?copilot=1) */
  const dh = cp.execSync("git diff HEAD -U0 -- admin.html", { cwd: ROOT }).toString().split("\n").filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
  const base = cp.execSync("git diff 5c95854 HEAD --stat -- admin.html", { cwd: ROOT }).toString();
  ok(dh.every(l => /^\+/.test(l) && /alyssum_copilot/.test(l)) , "تغيير admin.html (إن وُجد) = سطر المُحمِّل الاختياري فقط بلا حذف أي سطر", dh.slice(0, 3));
  ok(!errs.length, "لا أخطاء JavaScript في الصفحة", errs.slice(0, 3));

  await b.close();
  console.log("\n" + n + " ✓" + (fails.length ? "  —  " + fails.length + " ✗: " + fails.join(" | ") : "")); process.exit(fails.length ? 1 : 0);
})();
