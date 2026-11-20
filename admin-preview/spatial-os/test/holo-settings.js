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
    await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 60000 }); await wait(1500);
    const sk = await p.evaluate(() => { const q = SpatialOS.panels.get("ord"), d = q.fr.contentWindow.document, w = q.fr.contentWindow, h = d.documentElement, cs = w.getComputedStyle(h); const lime = /226,\s*254,\s*23\b/; const btns = [...d.querySelectorAll("#tab-orders .small:not(.gray):not(.warn):not(.danger):not(.red), #tab-orders .btn:not(.gray):not(.warn):not(.danger):not(.red)")].filter(b => b.offsetParent); const bi = btns.map(b => w.getComputedStyle(b).backgroundImage); return { glass: h.classList.contains("glass") && !h.classList.contains("white"), mint: cs.getPropertyValue("--g-mint").trim(), c: cs.getPropertyValue("--c").trim(), n: btns.length, cyan: bi.filter(v => /59,\s*230,\s*255/.test(v)).length, limeBtns: bi.filter(v => lime.test(v)).length }; });
    ok("php: داخل لوح اللوحة الحقيقية: داكن وأساسي سماوي ومتغير التدرّج سماوي", sk.glass && sk.mint === "#3be6ff" && sk.c === "59,230,255", sk);
    ok("php: الأزرار الأساسية في اللوح زجاجية سماوية ولا زر ليموني", sk.n > 0 && sk.cyan === sk.n && sk.limeBtns === 0, sk);
    /* كل أقسام الأسطوانة (عدا المساعد) لوحات حقيقية بتبويب اللوحة الحقيقي */
    const secs = { dash: "home", store: "store", cus: "customers", mkt: "coupons", look: "theme", ext: "appstore", set: "setup", ord: "orders", prod: "products", ana: "analytics", inv: "inventory" };
    await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 60000 });
    for (const [id, tab] of Object.entries(secs)) {
      if (id !== "ord") await p.evaluate(i => SpatialOS.open(i), id);
      try { await p.waitForFunction(i => { const q = SpatialOS.panels.get(i); return q && q.frDone; }, id, { timeout: 60000 }); } catch (e) { }
      /* الإطار يعيد فرض التبويب المطلوب 14ث الأولى بتصميم المرحلة 8 (اللوحة قد تعود إلى «الرئيسية» لحظة اكتمال تهيئتها): ننتظر ظهوره بدل القراءة اللحظية */
      await p.waitForFunction(([i, t]) => { const q = SpatialOS.panels.get(i); try { const e = q.fr.contentWindow.document.getElementById("tab-" + t); return !!e && !e.classList.contains("hidden"); } catch (x) { return false; } }, [id, tab], { timeout: 10000 }).catch(() => { });
      const st = await p.evaluate(([i, t]) => { const q = SpatialOS.panels.get(i); if (!q || !q.fr) return null; try { const d = q.fr.contentWindow.document, e = d.getElementById("tab-" + t); return { done: !!q.frDone, tabShown: !!e && !e.classList.contains("hidden"), nav: (() => { const top = d.querySelector("#app>.top"), sn = d.querySelector(".side-nav"); return !!top && getComputedStyle(top).display !== "none" && !!sn; })() }; } catch (x) { return { err: String(x) }; } }, [id, tab]);
      ok("php: لوح «" + id + "» حقيقي ويعرض تبويب " + tab, !!st && st.done && st.tabShown, st);
      if (["dash", "store", "set"].includes(id)) ok("php: لوح «" + id + "» يُبقي تنقّل اللوحة ظاهراً (كل الأقسام والإعدادات قابلة للوصول)", !!st && st.nav === true, st);
      else if (["ord", "prod", "ana", "inv"].includes(id)) ok("php: لوح «" + id + "» بلا تنقّل (كما اعتُمد في المرحلة 12)", !!st && st.nav === false, st);
      /* استعمال واقعي: لوح أو لوحان معاً لا أحد عشر؛ نغلق اللوح بعد فحصه (الضغط الكبير على معالج برمجي يؤخّر تثبيت التبويب) */
      if (id !== "ord") await p.evaluate(i => { try { SpatialOS.dismiss(i, "close"); } catch (e) { } }, id);
    }
    await p.evaluate(() => SpatialOS.open("ai")); await wait(1200);
    ok("php: لوح المساعد في الوضع الحقيقي بلا وسم «عرض تجريبي»", await p.evaluate(() => { const q = SpatialOS.panels.get("ai"); return !!q && q.el.dataset.real === "1" && !/عرض تجريبي/.test(getComputedStyle(q.el.querySelector(".pn-h h3"), "::after").content); }));
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
    const L = await p.evaluate(() => { const ex = document.getElementById("hud-exit"), r = ex.getBoundingClientRect(), e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2), q = SpatialOS.panels.get("ord").el.getBoundingClientRect(); return { exitVis: r.width > 0 && getComputedStyle(ex).display !== "none", exitOnScreen: r.left >= 0 && r.right <= innerWidth && r.top >= 0, exitHit: !!e && e.id === "hud-exit", exitH: Math.round(r.height), panelFits: q.width <= innerWidth + 24, panelInView: q.right > 0 && q.left < innerWidth, real: SpatialOS.real, orbit: SpatialOS.orbit }; });
    ok("phone: زر «العودة للمظهر العادي» ظاهر داخل الشاشة وقابل للنقر (لا يغطيه عنصر)", L.exitVis && L.exitOnScreen && L.exitHit && L.exitH >= 28, L);
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
    await p.tap("#hud-exit"); await p.waitForURL(/\/admin(\.html)?$/); await appReady();
    ok("phone: العودة بلمسة تفتح اللوحة العادية مسجَّلاً الدخول", true);
    ok("phone: لا أخطاء JS غير معالجة", errs.length === 0, errs);
  } finally { await store.stop(); }
}

async function stat(b) {
  const port = 8771, root = path.join(__dirname, "..", "..", ".."), srv = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  try {
    await wait(1200); const { p, errs } = await ctx(b);
    await p.goto(`http://127.0.0.1:${port}/admin-preview/spatial-os/index.html?real=1`); await wait(2500);
    const st = await p.evaluate(() => ({ real: SpatialOS.real, api: SpatialOS.apiReal, note: getComputedStyle(document.querySelector(".note")).display }));
    ok("static: ألواح حقيقية بلا واجهة PHP (وضع المتجر الذي لا يحمل الوكيل التنفيذي)", st.real === true && st.api === false && st.note === "none", st);
    await p.evaluate(() => SpatialOS.open("ai")); await wait(1200);
    const msg = await p.evaluate(() => { const q = SpatialOS.panels.get("ai"); return q ? q.el.innerText : ""; });
    ok("static: لوح المساعد يعرض إشعاراً صادقاً لا محاكاة", /غير متاح لهذا النوع من المتاجر/.test(msg) && !/مرحباً، أنا مساعد/.test(msg), msg.slice(0, 120));
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
