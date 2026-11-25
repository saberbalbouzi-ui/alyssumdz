/* المظهر الهولوغرافي كمظهر ثانٍ للوحة: من إعدادات المظهر → البطاقة → الأسطوانة (ألواح اللوحة الحقيقية) → زر العودة، دون المساس بأي إعداد أو بيانات.
   وضعان: «php» (متجر حقيقي بنسخة PHP محلية، فيه الوكيل التنفيذي) و«static» (خادم ملفات بلا واجهة PHP: ألواح حقيقية بلا وكيل تنفيذي، وإشعار صادق بدل محاكاة).
   التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/holo-settings.js [php|static|all]   ·   SHOTS=dir لحفظ لقطات */
const PW = require("playwright"), chromium = PW.chromium, path = require("path"), { spawn } = require("child_process");
const { startStore } = require("./harness"); const only = process.argv[2] || "all"; const SHOTS = process.env.SHOTS || "";
const R = []; let fails = 0;
const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 200) : "")); };
const wait = ms => new Promise(r => setTimeout(r, ms));

async function ctx(b, vp, mobile) {
  const c = await b.newContext({ viewport: vp || { width: 1440, height: 900 }, ...(mobile ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) }), p = await c.newPage(), errs = [];
  p.setDefaultTimeout(15000); p.on("pageerror", e => errs.push(String(e.stack || e).split("\n").slice(0, 2).join(" <- ").slice(0, 220))); p.on("dialog", d => d.accept().catch(() => { }));
  return { c, p, errs };
}
const shot = async (p, n) => { if (SHOTS) await p.screenshot({ path: SHOTS + "/" + n + ".png" }); };

async function php(b) {
  const store = await startStore(); const { p, errs } = await ctx(b);
  try {
    await p.goto(store.base + "/admin.html"); await wait(800);
    await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
    /* لوحة main تستبدل العنوان بـ/admin (رابط نظيف تخدمه الاستضافة الحقيقية لا خادم الاختبار المحلي) فلا reload: نفتح admin.html صراحةً */
    await p.goto(store.base + "/admin.html"); await p.waitForFunction(() => { try { return typeof Admin !== "undefined" && !document.getElementById("app").classList.contains("hidden"); } catch (e) { return false; } }, null, { timeout: 30000 });
    const snap = async () => p.evaluate(async () => { const o = await (await fetch("api/index.php?r=orders", { credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest" } })).json(); return JSON.stringify((o.orders || []).map(x => [x.id, x.status, x.total]).sort()); });
    const before = await snap(), themeBefore = await p.evaluate(() => AdminTheme.mode());
    const stoBefore = await p.evaluate(() => JSON.stringify([localStorage.getItem("admin_theme"), localStorage.getItem("admin_theme_cfg")]));

    await p.evaluate(() => Admin.tab("admtheme")); await p.waitForSelector("#atm-holo-go:not([disabled])", { timeout: 15000 });
    const card = await p.evaluate(() => { const c = document.querySelector(".atm-holo"); return c ? { txt: c.innerText, vis: getComputedStyle(c).display !== "none" } : null; });
    ok("php: بطاقة المظهر الهولوغرافي ظاهرة في إعدادات المظهر وزرها مفعّل", !!card && card.vis && /Spatial Core/.test(card.txt) && /Beta/.test(card.txt));
    ok("php: نص البطاقة بلا مصطلحات تقنية/أسماء مزوّدين", !!card && !/GitHub|Supabase|PHP|Gemini|OpenAI|Claude|Anthropic|\.js|\.php/i.test(card.txt), card && card.txt.length);
    const bd = await p.evaluate(() => { const b = document.querySelector(".atm-holo .atm-beta"), on = document.querySelector(".atm-card.on:not(.atm-holo) .atm-badge"); if (!b) return null; const cs = getComputedStyle(b), co = on ? getComputedStyle(on) : null; return { txt: b.textContent.trim(), color: cs.color, onColor: co && co.color, size: parseFloat(cs.fontSize), onSize: co && parseFloat(co.fontSize), title: document.querySelector(".atm-holo .atm-h b").textContent.trim() }; });
    ok("php: العنوان Spatial Core وشارة Beta أصغر ولونها يختلف عن شارة «مفعّل»", !!bd && bd.title === "Spatial Core" && bd.txt === "Beta" && bd.color !== bd.onColor && bd.size < bd.onSize, bd);
    await shot(p, "01-settings-card");

    await p.click("#atm-holo-go"); await p.waitForURL(/admin-preview\/spatial-os\/index\.html\?real=1/);
    await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.real === true, null, { timeout: 20000 });
    ok("php: المظهر الهولوغرافي يفتح بوضع الألواح الحقيقية والوكيل التنفيذي متاح", await p.evaluate(() => SpatialOS.real === true && SpatialOS.apiReal === true && document.body.classList.contains("real")));
    ok("php: عبارة «بيانات تجريبية» مخفية في الوضع الحقيقي", await p.evaluate(() => getComputedStyle(document.querySelector(".note")).display === "none"));
    ok("php: عنوان الصفحة Spatial Core", /Spatial Core/.test(await p.title()));
    ok("php: النواة الثلاثية الأبعاد ومشهد الأسطوانة موجودان", await p.evaluate(() => !!document.getElementById("core") && !!document.getElementById("cyl") && !!document.querySelector("canvas.core3d, #core canvas, .core3d")));

    /* غلاف Spatial Core اللوني داخل لوحة التحكم الحقيقية: ألوان جديدة (سماوي/بنفسجي/زمردي) بدل الليموني، داكن دائماً، بلا أي كتابة في تخزين المستخدم */
    /* الوضع الحقيقي على المكتب: لا لوح يُفتح تلقائياً (العالم يظهر فوراً)؛ بطاقات الرئيسية والمداران موجودة؛ اللوح يُفتح بنقرة */
    ok("php: لا لوح يُفتح تلقائياً على المكتب (العالم فوري)", await p.evaluate(() => SpatialOS.panels.size === 0 && SpatialOS.two === true));
    await p.evaluate(() => SpatialOS.open("ord"));
    await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 60000 }); await wait(1500);
    const sk = await p.evaluate(() => { const q = SpatialOS.panels.get("ord"), d = q.fr.contentWindow.document, w = q.fr.contentWindow, h = d.documentElement, cs = w.getComputedStyle(h); const lime = /226,\s*254,\s*23\b/; const btns = [...d.querySelectorAll("#tab-orders .small:not(.gray):not(.warn):not(.danger):not(.red), #tab-orders .btn:not(.gray):not(.warn):not(.danger):not(.red)")].filter(b => b.offsetParent); const bi = btns.map(b => w.getComputedStyle(b).backgroundImage); return { glass: h.classList.contains("glass") && !h.classList.contains("white"), mint: cs.getPropertyValue("--g-mint").trim(), c: cs.getPropertyValue("--c").trim(), n: btns.length, cyan: bi.filter(v => /(59|70),\s*2(30|28),\s*255/.test(v)).length, limeBtns: bi.filter(v => lime.test(v)).length }; });
    ok("php: داخل لوح اللوحة الحقيقية: داكن وأساسي سماوي ومتغير التدرّج سماوي", sk.glass && sk.mint === "#3be6ff" && sk.c === "59,230,255", sk);
    ok("php: الأزرار الأساسية في اللوح زجاجية سماوية ولا زر ليموني", sk.n > 0 && sk.cyan === sk.n && sk.limeBtns === 0, sk);
    /* كل أقسام الأسطوانة (عدا المساعد) لوحات حقيقية بتبويب اللوحة الحقيقي */
    const secs = { dash: "home", store: "store", cus: "customers", look: "theme", ext: "appstore", set: "setup", ord: "orders", prod: "products", ana: "analytics", inv: "inventory" };
    await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 60000 });
    for (const [id, tab] of Object.entries(secs)) {
      if (id !== "ord") await p.evaluate(i => SpatialOS.open(i), id);
      try { await p.waitForFunction(i => { const q = SpatialOS.panels.get(i); return q && q.frDone; }, id, { timeout: 60000 }); } catch (e) { }
      /* الإطار يعيد فرض التبويب المطلوب 14ث الأولى بتصميم المرحلة 8 (اللوحة قد تعود إلى «الرئيسية» لحظة اكتمال تهيئتها): ننتظر ظهوره بدل القراءة اللحظية */
      await p.waitForFunction(([i, t]) => { const q = SpatialOS.panels.get(i); try { const e = q.fr.contentWindow.document.getElementById("tab-" + t); return !!e && !e.classList.contains("hidden"); } catch (x) { return false; } }, [id, tab], { timeout: 10000 }).catch(() => { });
      const st = await p.evaluate(([i, t]) => { const q = SpatialOS.panels.get(i); if (!q || !q.fr) return null; try { const d = q.fr.contentWindow.document, e = d.getElementById("tab-" + t); return { done: !!q.frDone, tabShown: !!e && !e.classList.contains("hidden"), nav: (() => { const top = d.querySelector("#app>.top"), sn = d.querySelector(".side-nav"); return !!top && getComputedStyle(top).display !== "none" && !!sn; })() }; } catch (x) { return { err: String(x) }; } }, [id, tab]);
      ok("php: لوح «" + id + "» حقيقي ويعرض تبويب " + tab, !!st && st.done && st.tabShown, st);
      if (["dash", "store", "set"].includes(id)) {
        const trad = await p.evaluate(i => { const d = SpatialOS.panels.get(i).fr.contentWindow.document, w = SpatialOS.panels.get(i).fr.contentWindow, sels = ["#upd-btn", "#au-btn", "#theme-sw", "#theme-btn", "#cr-top", ".cr-pill", "#ais-top", "button.logout", "#app>.top button[onclick*='SitePreview']", "#app>.top button[onclick*='Admin.logout']"]; return sels.filter(s => [...d.querySelectorAll(s)].some(e => w.getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0)); }, id);
        ok("php: لوح «" + id + "» بلا أزرار المنصة التقليدية (تحديث/زيارة الموقع/تبديل المظهر/خروج/رصيد)", trad.length === 0, trad);
      }
      if (["dash", "store", "set"].includes(id)) ok("php: لوح «" + id + "» يُبقي تنقّل اللوحة ظاهراً (كل الأقسام والإعدادات قابلة للوصول)", !!st && st.nav === true, st);
      else if (["ord", "prod", "ana", "inv"].includes(id)) ok("php: لوح «" + id + "» بلا تنقّل (كما اعتُمد في المرحلة 12)", !!st && st.nav === false, st);
      /* استعمال واقعي: لوح أو لوحان معاً لا أحد عشر؛ نغلق اللوح بعد فحصه (الضغط الكبير على معالج برمجي يؤخّر تثبيت التبويب) */
      if (id !== "ord") await p.evaluate(i => { try { SpatialOS.dismiss(i, "close"); } catch (e) { } }, id);
    }
    await p.evaluate(() => SpatialOS.open("ai")); await wait(1200);
    ok("php: لوح المساعد في الوضع الحقيقي بلا وسم «عرض تجريبي»", await p.evaluate(() => { const q = SpatialOS.panels.get("ai"); return !!q && q.el.dataset.real === "1" && !/عرض تجريبي/.test(getComputedStyle(q.el.querySelector(".pn-h h3"), "::after").content); }));
    ok("php: لا قسم باسم «التسويق» وحده (القديم) على الأسطوانة ولا في شريط الأقسام ولا لوح mkt (عنصرا «التسويق بالعمولة»/«خدمات التسويق» من قائمة اللوحة الحقيقية مسموحان في المدار الثاني)", await p.evaluate(() => ![...document.querySelectorAll(".node, #dock *")].some(e => e.textContent.trim() === "التسويق") && ![...SpatialOS.panels.keys()].includes("mkt")));
    /* سحب رأس اللوح الحقيقي بالفأرة */
    await p.evaluate(() => SpatialOS.open("ord")); await wait(600);
    const hp = await p.evaluate(() => { const q = SpatialOS.panels.get("ord"), r = q.el.querySelector(".pn-h").getBoundingClientRect(); return { hx: r.x + r.width * .45, hy: r.y + r.height / 2, x0: q.st.x, y0: q.st.y }; });
    await p.mouse.move(hp.hx, hp.hy); await p.mouse.down(); for (let i = 1; i <= 12; i++) { await p.mouse.move(hp.hx - 15 * i, hp.hy + 9 * i); await wait(25); } await p.mouse.up(); await wait(900);
    const mv = await p.evaluate(() => { const q = SpatialOS.panels.get("ord"); return { x: q.st.x, y: q.st.y }; });
    ok("php: سحب رأس اللوح الحقيقي بالفأرة يحرّكه", Math.abs(mv.x - hp.x0) > 60, { before: [hp.x0, hp.y0], after: [mv.x, mv.y] });
    ok("php: لا زر ◎ (إرجاع إلى المدار) في شريط عنوان اللوح (حُذف بطلب صاحب المتجر)", await p.evaluate(() => !document.querySelector(".pn-orb")));
    /* زر □ في شريط عنوان البطاقة يفتحها بحجم المكتب (يملأ الشاشة تحت الشريط العلوي) ويعيدها عند الضغط ثانية */
    await p.evaluate(() => SpatialOS.open("ord")); await wait(500);
    await p.click('.panel[aria-label="الطلبات"] .pn-max'); await wait(1500);
    const big = await p.evaluate(() => { const q = SpatialOS.panels.get("ord"), r = q.el.getBoundingClientRect(), f = q.fr.getBoundingClientRect(); return { big: q.big, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left), vw: innerWidth, vh: innerHeight, frameW: Math.round(f.width), frameInnerW: q.fr.contentWindow.innerWidth }; });
    ok("php: □ يفتح البطاقة بحجم المكتب (يملأ العرض والارتفاع تحت الشريط العلوي، وإطارها بعرض مكتب ≥ 1000)", big.big && big.w >= big.vw - 60 && big.h >= big.vh - 110 && big.top >= 56 && big.top <= 80 && big.frameInnerW >= 1000, big);
    /* المحتوى يكبر مع تكبير النافذة (zoom ∝ عرض النافذة) */
    const zm = await p.evaluate(() => { const q = SpatialOS.panels.get("ord"), d = q.fr.contentDocument, b = d.querySelector("#tab-orders .small"); return { zoom: parseFloat(d.documentElement.style.zoom || "1"), k: q.zoomK, btnH: b ? Math.round(b.getBoundingClientRect().height) : 0 }; });
    ok("php: عند تكبير النافذة يكبر المحتوى (zoom > 1.15) ويبقى تخطيط المكتب", zm.zoom > 1.15 && Math.abs(zm.k - zm.zoom) < .01 && zm.btnH > 0, zm);
    /* السحب بالفأرة من شريط عنوان النافذة الكبيرة يعمل ويُبقي العنوان ظاهراً */
    const bh = await p.evaluate(() => { const q = SpatialOS.panels.get("ord"), r = q.el.querySelector(".pn-h").getBoundingClientRect(); return { hx: r.x + r.width * .5, hy: r.y + r.height / 2, x0: q.st.x, y0: q.st.y }; });
    await p.mouse.move(bh.hx, bh.hy); await p.mouse.down(); for (let i = 1; i <= 12; i++) { await p.mouse.move(bh.hx + 11 * i, bh.hy + 7 * i); await wait(20); } await p.mouse.up(); await wait(700);
    const bm = await p.evaluate(() => { const q = SpatialOS.panels.get("ord"), r = q.el.querySelector(".pn-h").getBoundingClientRect(); return { big: q.big, x: q.st.x, y: q.st.y, hdrTop: Math.round(r.top), hdrLeft: Math.round(r.left), hdrRight: Math.round(r.right) }; });
    ok("php: النافذة الكبيرة تتحرك بالسحب من شريط عنوانها وتبقى كبيرة وعنوانها ظاهر", bm.big && Math.abs(bm.x - bh.x0) > 60 && Math.abs(bm.y - bh.y0) > 35 && bm.hdrTop >= 40 && bm.hdrRight > 200, { from: [bh.x0, bh.y0], to: [bm.x, bm.y], hdr: [bm.hdrLeft, bm.hdrTop, bm.hdrRight] });
    await wait(1500); await p.click('.panel[aria-label="الطلبات"] .pn-max'); await wait(1200);
    ok("php: □ ثانية تعيد البطاقة إلى حجمها", await p.evaluate(() => !SpatialOS.panels.get("ord").big));
    const rz = await p.evaluate(() => { const q = SpatialOS.panels.get("ord"), d = q.fr.contentDocument, z = parseFloat(d.documentElement.style.zoom || "1"), want = Math.max(.55, Math.min(1.6, q.st.w / 1100)); return { big: q.big, z, want, w: q.st.w, iw: q.fr.contentWindow.innerWidth }; });
    ok("php: بعد الاستعادة يعود المحتوى لحجم البطاقة الطبيعي: واجهة المكتب مصغّرة (zoom = العرض/1100 ≤ 1) لا مكبّرة", !rz.big && Math.abs(rz.z - rz.want) < .02 && rz.z <= 1, rz);
    /* عنوان اللوح لا يصعد فوق الشريط العلوي ولا يختفي تحته */
    const hh = await p.evaluate(() => { const r = SpatialOS.panels.get("ord").el.querySelector(".pn-h").getBoundingClientRect(); return { x: r.x + r.width * .45, y: r.y + r.height / 2 }; });
    await p.mouse.move(hh.x, hh.y); await p.mouse.down(); for (let i = 1; i <= 16; i++) { await p.mouse.move(hh.x, Math.max(2, hh.y - 60 * i)); await wait(20); } await p.mouse.up(); await wait(900);
    const topH = await p.evaluate(() => Math.round(SpatialOS.panels.get("ord").el.querySelector(".pn-h").getBoundingClientRect().top));
    ok("php: لا يصعد عنوان اللوح فوق الشاشة ولا يُدفن (يبقى شريطه ظاهراً وقابلاً للإمساك: top ≥ 58)", topH >= 58, { topH });
    ok("php: الوضع الحقيقي بلا بطاقات جدارية ولا لوحيّات أرضية تجريبية (لا أرقام مختلقة خلف الاسطوانة)، وبطاقات الرئيسية الظاهرة كاملة داخل الشاشة", await p.evaluate(() => document.querySelectorAll(".wcard").length === 0 && document.querySelectorAll("#room .tab").length === 0 && [...document.querySelectorAll(".hp")].filter(e => !e.closest("[hidden]") && e.offsetParent).every(e => { const q = e.getBoundingClientRect(); return q.x >= 4 && q.right <= innerWidth - 4 && q.y >= 56 && q.bottom <= innerHeight - 4; })));
    /* اللوح غير المُركَّز بكامل ألوانه: لا ستارة تعتّمه (كانت 22%) */
    await p.evaluate(() => SpatialOS.open("prod")); await p.waitForFunction(() => { const q = SpatialOS.panels.get("prod"); return q && q.frDone; }, null, { timeout: 60000 }).catch(() => { }); await wait(800);
    await p.evaluate(() => { const q = SpatialOS.panels.get("ord"); q.el.querySelector(".pn-h").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10, pointerId: 91 })); }).catch(() => { });
    const veil = await p.evaluate(() => { const q = SpatialOS.panels.get("prod"), sh = q.el.querySelector(".pn-shield"), cs = sh ? getComputedStyle(sh) : null; const m = cs && /rgba?\(([^)]*)\)/.exec(cs.backgroundColor); const parts = m ? m[1].split(",").map(Number) : []; return { focused: q.el.classList.contains("focus"), alpha: parts.length === 4 ? parts[3] : (parts.length === 3 ? 1 : 0), bg: cs && cs.backgroundColor }; });
    ok("php: ستارة حماية اللوح غير المُركَّز شفافة تماماً (لا تعتيم يُبهت الألوان)", veil.alpha === 0, veil);
    await p.evaluate(() => { try { SpatialOS.dismiss("prod", "close"); } catch (e) { } });
    /* «كيف أكلّم الكرة»: النقر عليها يفتح لوح المساعد وفيه زر الميكروفون وحقل الكتابة */
    await p.evaluate(() => document.getElementById("core").click()); await wait(1500);
    const mic = await p.evaluate(() => { const q = SpatialOS.panels.get("ai"); return q ? { mic: !!q.el.querySelector(".ag-mic"), input: !!q.el.querySelector("input,textarea"), framed: !!q.frame } : null; });
    ok("php: النقر على الكرة يفتح لوح المساعد التنفيذي بزر الميكروفون وحقل الكتابة", !!mic && mic.mic && mic.input && !mic.framed, mic);
    /* زر «زاوية 0»: يلغي ميلان الألواح بسلاسة ويعيده عند الإيقاف ويحفظ الاختيار */
    await p.evaluate(() => { SpatialOS.open("prod"); }); await p.waitForFunction(() => { const q = SpatialOS.panels.get("prod"); return q && q.frDone; }, null, { timeout: 60000 }).catch(() => { }); await wait(1200);
    const tilt = () => p.evaluate(() => { const out = {}; for (const id of ["ord", "prod"]) { const q = SpatialOS.panels.get(id); if (!q) continue; const m = getComputedStyle(q.el).transform.match(/matrix3d\((.+)\)/); if (!m) { out[id] = 0; continue; } /* بلا دوران يعيد المتصفح matrix ثنائية الأبعاد = لا ميلان */ const v = m[1].split(",").map(Number); out[id] = +Math.max(...[1, 2, 4, 6, 8, 9].map(k => Math.abs(v[k]))).toFixed(4); } return out; });
    const t0 = await tilt();
    ok("php: الألواح مائلة افتراضياً (قبل الزر)", Object.values(t0).some(v => v > 0.02), t0);
    ok("php: زر «زاوية 0» موجود في الشريط العلوي ويشير aria-pressed=false", await p.evaluate(() => { const b = document.getElementById("hud-flat"); return !!b && b.getAttribute("aria-pressed") === "false" && getComputedStyle(b).display !== "none"; }));
    await p.click("#hud-flat"); await wait(2200);
    const t1 = await tilt();
    ok("php: بعد «زاوية 0» كل الألواح بلا أي ميلان", Object.values(t1).length > 0 && Object.values(t1).every(v => v !== null && v < 0.004), t1);
    ok("php: الزر يعلن حالته (مفعّل) والاختيار محفوظ", await p.evaluate(() => { const b = document.getElementById("hud-flat"); return b.getAttribute("aria-pressed") === "true" && SpatialOS.flat === true && localStorage.getItem("sc_flat") === "1"; }));
    await p.keyboard.press("l"); await wait(2200);
    const t2 = await tilt();
    ok("php: مفتاح L يعيد الميلان الأصلي (تبديل)", Object.values(t2).some(v => v > 0.02) && (await p.evaluate(() => SpatialOS.flat === false)), t2);
    await p.click("#hud-flat"); await wait(1500);
    await p.reload(); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.real === true, null, { timeout: 30000 });
    ok("php: يبقى «زاوية 0» مفعّلاً بعد إعادة فتح الصفحة", await p.evaluate(() => SpatialOS.flat === true && document.getElementById("hud-flat").getAttribute("aria-pressed") === "true"));
    await p.click("#hud-flat"); await wait(800);
    await shot(p, "02-holo-real-panels");

    const ex = await p.evaluate(() => { const a = document.getElementById("hud-exit"); return a ? { href: a.getAttribute("href"), vis: getComputedStyle(a).display !== "none" } : null; });
    ok("php: زر «العودة للمظهر العادي» موجود ويشير إلى اللوحة", !!ex && ex.vis && /admin\.html$/.test(ex.href), ex);
    await p.click("#hud-exit"); await p.waitForURL(/\/admin(\.html)?$/); /* لوحة main تستبدل العنوان بـ/admin */ await p.waitForFunction(() => { try { return typeof Admin !== "undefined" && !document.getElementById("app").classList.contains("hidden"); } catch (e) { return false; } }, null, { timeout: 30000 });
    ok("php: العودة تفتح اللوحة العادية مسجَّلاً الدخول", true);
    ok("php: لم يتغيّر مظهر اللوحة المختار", (await p.evaluate(() => AdminTheme.mode())) === themeBefore);
    ok("php: لم يُكتب أي شيء في تخزين مظهر المستخدم (الوضع ولا الإعدادات)", (await p.evaluate(() => JSON.stringify([localStorage.getItem("admin_theme"), localStorage.getItem("admin_theme_cfg")]))) === stoBefore);
    ok("php: لا تغيير في الطلبات بعد الدخول إلى المظهر والخروج منه", (await snap()) === before);
    ok("php: لا أخطاء JS غير معالجة في الصفحات", errs.length === 0, errs);
  } finally { await store.stop(); }
}


async function phone(b) {
  const store = await startStore(); const { p, errs } = await ctx(b, { width: 390, height: 844 }, true);
  const appReady = () => p.waitForFunction(() => { try { return typeof Admin !== "undefined" && !document.getElementById("app").classList.contains("hidden"); } catch (e) { return false; } }, null, { timeout: 30000 });
  const noOverflow = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  try {
    await p.goto(store.base + "/admin.html"); await wait(800);
    await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
    await p.goto(store.base + "/admin.html"); await appReady(); await wait(3000);
    await p.evaluate(() => Admin.tab("admtheme"));
    await p.waitForFunction(() => { const b = document.getElementById("atm-holo-go"), t = document.getElementById("tab-admtheme"); return b && !b.disabled && t && !t.classList.contains("hidden") && b.getBoundingClientRect().width > 0; }, null, { timeout: 20000 });
    const cd = await p.evaluate(() => { const b = document.getElementById("atm-holo-go"), r = b.getBoundingClientRect(), c = b.closest(".atm-holo").getBoundingClientRect(); return { btnW: Math.round(r.width), cardInside: c.left >= -1 && c.right <= innerWidth + 1, vw: innerWidth }; });
    ok("phone: بطاقة Spatial Core ظاهرة داخل الشاشة وزرها قابل للنقر", cd.btnW > 100 && cd.cardInside, cd);
    ok("phone: لا فيض أفقي في صفحة الإعدادات", await noOverflow());
    await p.evaluate(() => document.querySelector(".atm-holo").scrollIntoView({ block: "center" })); await wait(400);
    await shot(p, "04-phone-card");
    await p.tap("#atm-holo-go"); await p.waitForURL(/admin-preview\/spatial-os\/index\.html\?real=1/);
    await p.waitForFunction(() => { const q = typeof SpatialOS !== "undefined" && SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 60000 }); await wait(2500);
    const L = await p.evaluate(() => { document.getElementById("ps-menu-btn").click(); /* V5: زر العودة داخل القائمة الهاتفية */ const ex = document.getElementById("ps-exit") || document.getElementById("hud-exit"), r = ex.getBoundingClientRect(), e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2), q = SpatialOS.panels.get("ord").el.getBoundingClientRect(); return { exitVis: r.width > 0 && getComputedStyle(ex).display !== "none", exitOnScreen: r.left >= 0 && r.right <= innerWidth && r.top >= 0, exitHit: !!e && (e === ex || ex.contains(e)), exitH: Math.round(r.height), panelFits: q.width <= innerWidth + 24, panelInView: q.right > 0 && q.left < innerWidth, real: SpatialOS.real, orbit: SpatialOS.orbit }; });
    ok("phone: زر «العودة للمظهر العادي» (في قائمة الواجهة الهاتفية V5) ظاهر داخل الشاشة وقابل للنقر بهدف ≥ 44px", L.exitVis && L.exitOnScreen && L.exitHit && L.exitH >= 44, L);
    await p.evaluate(() => SpatialPhone.closeMenu());
    ok("phone: لوح الطلبات الحقيقي يلائم عرض الهاتف وظاهر", L.panelFits && L.panelInView && L.real === true, L);
    ok("phone: لا فيض أفقي في المظهر الهولوغرافي", await noOverflow());
    for (const id of ["set", "dash"]) {
      await p.evaluate(i => SpatialOS.open(i), id);
      await p.waitForFunction(i => { const q = SpatialOS.panels.get(i); return q && q.frDone; }, id, { timeout: 60000 }).catch(() => { }); await wait(1500);
      const f = await p.evaluate(i => { const q = SpatialOS.panels.get(i), r = q.el.getBoundingClientRect(); return { done: !!q.frDone, fits: r.width <= innerWidth + 24, inView: r.right > 0 && r.left < innerWidth }; }, id);
      ok("phone: لوح «" + id + "» حقيقي ويلائم الشاشة", f.done && f.fits && f.inView, f);
      await p.evaluate(i => { try { SpatialOS.dismiss(i, "close"); } catch (e) { } }, id);
    }
    await shot(p, "05-phone-holo");
    await p.evaluate(() => SpatialPhone.openMenu()); await p.tap("#ps-exit"); await p.waitForURL(/\/admin(\.html)?$/); await appReady();
    ok("phone: العودة بلمسة تفتح اللوحة العادية مسجَّلاً الدخول", true);
    ok("phone: لا أخطاء JS غير معالجة", errs.length === 0, errs);
  } finally { await store.stop(); }
}

async function stat(b) {
  const port = 8771, root = path.join(__dirname, "..", "..", ".."), srv = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  try {
    await wait(1200); const { p, errs } = await ctx(b);
    await p.goto(`http://127.0.0.1:${port}/admin-preview/spatial-os/index.html?real=1&noshell=1`); await wait(2500);
    const st = await p.evaluate(() => ({ real: SpatialOS.real, api: SpatialOS.apiReal, note: getComputedStyle(document.querySelector(".note")).display }));
    ok("static: ألواح حقيقية بلا واجهة PHP (وضع المتجر الذي لا يحمل الوكيل التنفيذي)", st.real === true && st.api === false && st.note === "none", st);
    await p.evaluate(() => document.getElementById("core").click()); await wait(1500);
    const ai = await p.evaluate(() => ({ ai: SpatialOS.panels.has("ai"), help: SpatialOS.panels.has("help") }));
    ok("static: النقر على الكرة لا يفتح «اسألني» (الكرة هي LAURA فقط؛ تنبيه صادق أنها غير مفعّلة بعد)", !ai.ai && !ai.help, ai);
    await p.evaluate(() => SpatialOS.open("set")); await wait(2500);
    ok("static: لوح الإعدادات حقيقي (إطار يحمّل admin.html)", await p.evaluate(() => { const q = SpatialOS.panels.get("set"); return !!(q && q.fr && /admin\.html/.test(q.fr.src) && q.el.dataset.real === "1"); }));
    await shot(p, "03-static-real");
    ok("static: لا أخطاء JS غير معالجة", errs.length === 0, errs);
    /* الوضع التجريبي الصريح يبقى كما كان */
    await p.goto(`http://127.0.0.1:${port}/admin-preview/spatial-os/index.html?demo=1`); await wait(1500);
    ok("static: ?demo=1 يبقي العرض التجريبي ويُظهر عبارته", await p.evaluate(() => SpatialOS.real === false && getComputedStyle(document.querySelector(".note")).display !== "none"));
  } finally { srv.kill(); }
}

(async () => {
  const b = await chromium.launch(); try { if (only === "all" || only === "php") await php(b); if (only === "all" || only === "phone") await phone(b); if (only === "all" || only === "static") await stat(b); } catch (e) { fails++; R.push("FAIL [crash] " + String(e).split("\n").slice(0, 6).join(" | ").slice(0, 600)); } finally { await b.close(); }
  console.log(R.join("\n")); console.log("\n" + (fails ? "FAILED: " + fails : "ALL PASS") + "  (" + R.filter(x => x.startsWith("PASS")).length + " ناجح)"); process.exit(fails ? 1 : 0);
})();
