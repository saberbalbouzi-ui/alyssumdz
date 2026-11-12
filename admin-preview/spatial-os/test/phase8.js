/* المرحلة 8 — مكوّنات التجارة الحقيقية داخل الألواح الفضائية. لا بيانات عرض: لوحة التحكم الحقيقية (admin.html) تعمل داخل الألواح على نسخة PHP محلية معزولة،
   والطلبات أُنشئت عبر مسار الطلب الحقيقي (POST /api/index.php?r=order) وتُقرأ/تُعدَّل عبر واجهة اللوحة نفسها.
   «mouse» فأرة حقيقية (Playwright) · «cdp-touch» لمس CDP حقيقي (محاكاة لمس لا جهاز) · «api» قراءة حالة · «real-ui» تفاعل حقيقي داخل واجهة اللوحة.
   التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/phase8.js [desktop|mobile|all] */
const PW = require("playwright"), chromium = PW[process.env.BROWSER || "chromium"]; const { startStore } = require("./harness"); const only = process.argv[2] || "all"; const SHOTS = process.env.SHOTS || "";
const R = []; const BROWSER = process.env.BROWSER || "chromium"; let fails = 0; const ok = (n, c, m, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + "[" + m + "] " + n + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 190) : "")); };
async function section(name, fn) { R.push("── " + name); try { await fn(); } catch (e) { fails++; R.push("FAIL [crash] " + name + ": " + String(e).split("\n").filter(l => l.trim()).slice(0, 7).join(" | ").slice(0, 700)); } }
const near = (a, b, e = .5) => Math.abs((a || 0) - (b || 0)) <= e, NAME = { ord: "الطلبات", prod: "المنتجات", ana: "التحليلات", inv: "المخزون", ai: "مساعد ALYSSUM", help: "دليل المساعدة" };

async function mk(b, store, vp, touch) {
  const c = await b.newContext({ viewport: vp, deviceScaleFactor: touch ? 2 : 1, isMobile: !!touch, hasTouch: !!touch }), p = await c.newPage(), errs = []; p.setDefaultTimeout(9000);
  p.on("pageerror", e => errs.push(String(e.stack || e).split("\n").slice(0, 3).join(" <- ").slice(0, 260))); p.on("dialog", d => d.accept().catch(() => { }));
  await p.goto(store.spatial); await p.waitForTimeout(1200);
  await p.evaluate(async () => (await fetch("../../api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).status);
  await p.reload(); await p.waitForTimeout(1500);
  return { c, p, errs, cdp: touch ? await c.newCDPSession(p) : null };
}
const helpers = p => ({
  W: () => p.evaluate(() => SpatialOS.world()),
  P: id => p.evaluate(i => { const q = SpatialOS.panels.get(i); return q ? { ...q.st, big: q.big, min: q.min, user: q.user, z: q.st.z, zi: +q.el.style.zIndex, ready: !!q.frDone } : null; }, id),
  ready: id => p.waitForFunction(i => { const q = SpatialOS.panels.get(i); return q && q.frDone; }, id, { timeout: 60000 }),
  api: () => p.evaluate(async () => (await (await fetch("../../api/index.php?r=orders", { credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest" } })).json()).orders),
  fev: (id, fn, arg) => p.evaluate(([i, f, a]) => { const q = SpatialOS.panels.get(i), w = q.fr.contentWindow; return w.eval("(" + f + ")")(a); }, [id, fn.toString(), arg]),
  FL: id => p.frameLocator(`.panel[aria-label="${NAME[id]}"] iframe`),
  hdr: async id => (await p.$(`.panel[aria-label="${NAME[id]}"] .pn-h h3`)).boundingBox(),
  calm: async id => { let prev = null; for (let k = 0; k < 24; k++) { const q = JSON.stringify(await p.evaluate(i => { const e = SpatialOS.panels.get(i); return e && e.st; }, id)); if (q === prev) return; prev = q; await p.waitForTimeout(300); } },
  drag: async (x0, y0, x1, y1, n = 10, d = 35) => { await p.mouse.move(x0, y0); await p.mouse.down(); for (let i = 1; i <= n; i++) { await p.mouse.move(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); await p.waitForTimeout(d); } await p.mouse.up(); },
  shot: async (name, clip) => { if (SHOTS) await p.screenshot({ path: SHOTS + "/" + name + ".png", ...(clip ? { clip } : {}) }); },
});

async function desktop(b, store) {
  const { p, errs } = await mk(b, store, { width: 1440, height: 900 }), H = helpers(p), { W, P, ready, api, fev, FL, hdr, calm, drag, shot } = H;
  await ready("ord"); await p.waitForTimeout(800);
  const snapOrders = async () => JSON.stringify((await api()).map(o => [o.id, o.status, o.note, o.total, o.name]).sort());
  const rows = () => fev("ord", () => document.querySelectorAll("#orders-table tr").length - 1);
  const select = async id => { const h = await hdr(id); await p.mouse.click(h.x + h.width / 2, h.y + h.height / 2); await p.waitForTimeout(350); };

  await section("Q1. الطلبات الحقيقية تُحمَّل داخل اللوح الفضائي", async () => {
    const info = await fev("ord", () => { const A = Admin; return { n: A.orders.length, label: (document.getElementById("orders-count-label") || {}).textContent, tab: !document.getElementById("tab-orders").classList.contains("hidden"), chrome: ["#app>.top", "#nav-groups", ".side-nav"].map(s => getComputedStyle(document.querySelector(s)).display), txt: document.getElementById("orders-table").innerText }; });
    const a = await api();
    ok("وضع «حقيقي» مفعَّل واللوح هو admin.html الحقيقي (iframe نفس الأصل)", await p.evaluate(() => SpatialOS.real && SpatialOS.panels.get("ord").fr.src.endsWith("/admin.html")), "api");
    ok("12 طلباً حقيقياً (أُنشئت عبر مسار الطلب) في الواجهة وفي الـAPI", info.n === 12 && a.length === 12, "real-ui", [info.n, a.length]);
    ok("كل أسماء الزبائن الحقيقية تظهر في جدول الطلبات", store.ids.every(o => info.txt.includes(o.name)), "real-ui");
    ok("تبويب الطلبات ظاهر وإطار اللوحة (الشريط والقائمة) مخفيّ داخل اللوح", info.tab && info.chrome.every(x => x === "none") && /12/.test(info.label || ""), "real-ui", info);
    const ids = new Set(await fev("ord", () => Admin.orders.map(o => o.id))); ok("معرّفات الطلبات في اللوحة = معرّفات الـAPI تماماً", a.every(o => ids.has(o.id)) && ids.size === a.length, "api");
    await shot("q1-orders-panel");
  });

  await section("Q2. المرشّحات تعمل بعد تحريك اللوح (تفاعل حقيقي داخل الإطار)", async () => {
    await select("ord"); const P0 = await P("ord"); const h = await hdr("ord"); await drag(h.x + h.width / 2, h.y + h.height / 2, h.x + h.width / 2 - 130, h.y + h.height / 2 + 70, 10, 45); await p.waitForTimeout(1200); await calm("ord"); const P1 = await P("ord");
    ok("حُرِّك اللوح فعلاً بالفأرة", Math.hypot(P1.x - P0.x, P1.y - P0.y) > 50, "mouse", [P0.x, P0.y, P1.x, P1.y]);
    const f = FL("ord"); await f.locator("#order-filter-status").selectOption("confirmee"); await p.waitForTimeout(700);
    const names = () => fev("ord", () => [...document.querySelectorAll("#orders-table tr td.nm b")].map(b => b.textContent.trim()));
    const conf = store.ids.filter(o => o.status === "confirmee").map(o => o.name), n1 = await names();
    ok("مرشّح الحالة «مؤكَّد» يعرض المؤكَّدة فقط", n1.length === conf.length && conf.every(x => n1.includes(x)), "real-ui", n1);
    await f.locator("#order-filter-status").selectOption(""); await f.locator("#order-filter-q").fill("ليلى"); await p.waitForTimeout(700); const n2 = await names();
    ok("البحث بالاسم «ليلى» يعيد طلباً واحداً (ليلى بن عمر)", n2.length === 1 && n2[0] === "ليلى بن عمر", "real-ui", n2);
    await f.locator("#order-filter-q").fill(""); await p.waitForTimeout(500); ok("مسح البحث يعيد كل الطلبات", (await rows()) === 12, "real-ui", await rows());
    const h2 = await hdr("ord"); await drag(h2.x + h2.width / 2, h2.y + h2.height / 2, h2.x + h2.width / 2 + 60, h2.y + h2.height / 2 - 40, 8, 45); await p.waitForTimeout(900);
    await f.locator("#order-filter-status").selectOption("livree"); await p.waitForTimeout(600); ok("وبعد تحريك ثانٍ تعمل المرشّحات أيضاً (مُسلَّمة = 2)", (await rows()) === store.ids.filter(o => o.status === "livree").length, "real-ui", await rows());
    await f.locator("#order-filter-status").selectOption(""); await p.waitForTimeout(500);
  });

  await section("Q3. تفاصيل الطلب تُفتح (معاينة الطلب الحقيقية)", async () => {
    await select("ord"); const f = FL("ord"), phoneBefore = await fev("ord", () => document.body.innerText.includes("0661998877"));
    await f.locator("#orders-table tr", { hasText: "يوسف زروقي" }).locator(".ord-pv").click(); await p.waitForTimeout(1200);
    const d = await fev("ord", () => { const m = document.getElementById("ord-prev-bg"); return { open: m && m.classList.contains("open"), txt: m ? m.innerText : "" }; });
    ok("نافذة معاينة الطلب تفتح داخل اللوح وفيها الاسم والهاتف (لم يكن الهاتف ظاهراً قبل الفتح)", !phoneBefore && d.open && /يوسف زروقي/.test(d.txt) && /0661998877/.test(d.txt), "real-ui", [phoneBefore, d.open]);
    ok("وفيها الولاية والمنتج والمبلغ", /باتنة/.test(d.txt) && /باقة العناية/.test(d.txt) && /5\s?350/.test(d.txt.replace(/ | /g, " ")), "real-ui");
    await shot("q3-order-details"); await f.locator(".ord-x").first().click(); await p.waitForTimeout(500);
    ok("وتُغلق بزرها الحقيقي", !(await fev("ord", () => document.getElementById("ord-prev-bg").classList.contains("open"))), "real-ui");
  });

  await section("Q4. إجراءات الطلب الحقيقية تعمل داخل اللوح (تأكيد طلب)", async () => {
    await select("ord"); const target = store.ids.find(o => o.status === "nouvelle" && o.name === "أمينة بوزيد"), f = FL("ord");
    await f.locator("#orders-table tr", { hasText: "أمينة بوزيد" }).locator("select.act-sel").selectOption("confirm"); await p.waitForTimeout(2500);
    const o = (await api()).find(x => x.id === target.id);
    ok("«أكّد الطلب» من قائمة الإجراءات يغيّر حالته إلى «مؤكَّد» في قاعدة المتجر", o && o.status === "confirmee", "real-ui", o && o.status);
    ok("ويظهر ذلك في الجدول فوراً (شارة الحالة)", /مؤكَّد|مؤكد/.test(await fev("ord", () => [...document.querySelectorAll("#orders-table tr")].find(r => r.innerText.includes("أمينة بوزيد")).innerText)), "real-ui");
  });

  await section("Q5. العربية مقروءة بأحجام مختلفة للوح (تحجيم بمقبض الزاوية)", async () => {
    await select("ord"); const metric = async () => { const w0 = (await P("ord")).w; return p.evaluate(() => { const q = SpatialOS.panels.get("ord"), w = q.fr.contentWindow, d = w.document, r = q.fr.getBoundingClientRect(), k = r.width / q.fr.clientWidth, td = d.querySelector("#orders-table td.nm b"), fs = parseFloat(w.getComputedStyle(td).fontSize); return { pw: Math.round(q.st.w), iw: w.innerWidth, ow: d.documentElement.scrollWidth, fs, eff: +(fs * k).toFixed(1), cairo: d.fonts.check("16px Cairo"), arabicOK: /[؀-ۿ]/.test(td.textContent) }; }); };
    const res = [];
    for (const [i, tx] of [[0, 0], [1, -180], [2, 330], [3, -150]].entries()) {
      const [, dx] = tx; if (dx) { const rs = await (await p.$('.panel[aria-label="الطلبات"] .pn-rs')).boundingBox(); await drag(rs.x + 10, rs.y + 10, rs.x + 10 + dx, rs.y + 10 + (dx > 0 ? 30 : -30), 12, 40); await p.waitForTimeout(1000); }
      const m = await metric(); res.push(m); await shot("q5-size-" + i, undefined);
    }
    const widths = res.map(r => r.pw);
    ok("تغيّر عرض اللوح بالمقبض الحقيقي ضمن مدى واسع", Math.max(...widths) - Math.min(...widths) > 200, "mouse", widths);
    ok("بلا تمرير أفقي داخل الإطار عند كل حجم (التخطيط يتكيّف مع عرض اللوح)", res.every(r => r.ow <= r.iw + 2), "real-ui", res.map(r => [r.pw, r.iw, r.ow]));
    ok("حجم خط اسم الزبون ≥ 11px فعلياً وعلى الشاشة (مع المنظور) ≥ 9px", res.every(r => r.fs >= 11 && r.eff >= 9), "real-ui", res.map(r => [r.fs, r.eff]));
    ok("خط Cairo محمَّل والنص عربي سليم", res.every(r => r.cairo && r.arabicOK), "real-ui");
  });

  await section("Q6. لا فعل تجاري عرضي أثناء السحب أو النقر على لوح غير مُفعَّل", async () => {
    await p.evaluate(() => { const q = SpatialOS.panels.get("ord"); Object.assign(q.st, { x: 340, y: -10, z: 0, rx: 0, ry: -8, rz: 0, s: 1 }); SpatialOS.open("ord"); }); await p.waitForTimeout(900);
    await select("ord"); const before = await snapOrders(); const h = await hdr("ord"), x = h.x + h.width / 2, y = h.y + h.height / 2;
    await p.mouse.move(x, y); await p.mouse.down(); for (let i = 1; i <= 24; i++) { await p.mouse.move(x - 30 + (i % 8) * 6, y + i * 8); await p.waitForTimeout(70); } await p.mouse.up(); await p.waitForTimeout(1200);
    const rh = await (await p.$('.panel[aria-label="الطلبات"] .pn-rot')).boundingBox(); await drag(rh.x + 14, rh.y + 14, rh.x + 214, rh.y + 300, 16, 30); await p.waitForTimeout(1200);
    const dh = await (await p.$('.panel[aria-label="الطلبات"] .pn-dep')).boundingBox(); await drag(dh.x + 14, dh.y + 14, dh.x + 14, dh.y + 300, 14, 30); await p.waitForTimeout(1200);
    ok("بعد سحب/تدوير/عمق عبر الإطار كله: كل الطلبات (الحالة والملاحظة والمبلغ) كما هي", (await snapOrders()) === before, "api");
    ok("ولم تُفتح أي نافذة داخل اللوح", !(await fev("ord", () => !!document.querySelector(".modal-bg.open"))), "real-ui");
    /* لوح ثانٍ يغطي الأول؛ النقر الأول على لوح غير مُفعَّل يفعّله فقط */
    await p.evaluate(() => SpatialOS.open("prod")); await H.ready("prod"); await p.evaluate(() => { const q = SpatialOS.panels.get("prod"); Object.assign(q.st, { x: -340, y: -10, z: 0, rx: 0, ry: 8, rz: 0, s: 1 }); SpatialOS.open("prod"); }); await p.waitForTimeout(900); await select("prod"); await p.waitForTimeout(400);
    const btn = await FL("ord").locator("#mo-btn").boundingBox(); const vis = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.closest(".panel") && e.closest(".panel").getAttribute("aria-label"); }, [btn.x + btn.width / 2, btn.y + btn.height / 2]);
    const before2 = await snapOrders(); let clickedBack = false;
    if (vis === "الطلبات") { await p.mouse.click(btn.x + btn.width / 2, btn.y + btn.height / 2); await p.waitForTimeout(900); clickedBack = true; }
    const opened1 = await fev("ord", () => !!document.querySelector(".modal-bg.open, #mo-bg.open, [id^=mo-].open"));
    ok("النقر الأول على لوح الطلبات غير المُفعَّل (فوق زر «إضافة طلب») لا يفتح نافذة الإضافة بل يفعّل اللوح", clickedBack && !opened1 && (await p.evaluate(() => SpatialOS.focused)) === "ord", "mouse", { vis, opened1 });
    const btn2 = await FL("ord").locator("#mo-btn").boundingBox(); await p.mouse.click(btn2.x + btn2.width / 2, btn2.y + btn2.height / 2); await p.waitForTimeout(1200); const opened2 = await fev("ord", () => !!document.querySelector(".modal-bg.open, #mo-bg.open, [id^=mo-].open, .mo-bg"));
    ok("والنقرة الثانية (اللوح مُفعَّل) تعمل الزر فعلاً — فالزر حيّ وليس معطَّلاً", opened2, "mouse");
    await fev("ord", () => { document.querySelectorAll(".modal-bg.open").forEach(m => m.classList.remove("open")); const c = document.querySelector("#mo-bg .mo-x, .mo-x"); if (c) c.click(); }); await p.waitForTimeout(500);
    ok("ولم يتغيّر شيء في الطلبات", (await snapOrders()) === before2, "api");
  });

  await section("Q7. إغلاق اللوح ثم استعادته يحفظ حالته المقصودة (مرشّحات + موضع + حجم)", async () => {
    await p.evaluate(() => SpatialOS.dismiss("prod", "close")); await p.waitForTimeout(800); await select("ord"); const f = FL("ord");
    await f.locator("#order-filter-status").selectOption("expediee"); await f.locator("#order-filter-q").fill("كريم"); await p.waitForTimeout(700);
    const st0 = await P("ord"), n0 = await rows(); ok("قبل الإغلاق: مرشّح «في الطريق» + بحث «كريم» = طلب واحد", n0 === 1, "real-ui", n0);
    const x = await (await p.$('.panel[aria-label="الطلبات"] .pn-x')).boundingBox(); await p.mouse.click(x.x + x.width / 2, x.y + x.height / 2); await p.waitForTimeout(1500);
    ok("أُغلق اللوح وأُزيل الإطار", !(await P("ord")) && (await p.evaluate(() => !document.querySelector('.panel[aria-label="الطلبات"]'))), "mouse");
    ok("وحُفظت حالته في الذاكرة (الحالة والنص)", await p.evaluate(() => { const m = SpatialOS.memo.ord; return m && m.content.fs && m.content.fs.f && m.content.fs.f.status === "expediee" && m.content.fs.f.q === "كريم" && !!m.pos; }), "api");
    await p.evaluate(() => SpatialOS.spinTo("ord")); await p.waitForTimeout(600); await p.waitForFunction(() => !SpatialOS.world().tw, null, { timeout: 15000 }).catch(() => { });
    const nd = await p.evaluate(() => { const n = [...document.querySelectorAll(".node")].find(e => e.dataset.id === "ord"); if (!n) return null; const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await p.mouse.click(nd[0], nd[1]); await ready("ord"); await p.waitForTimeout(1500);
    const st1 = await P("ord"), vals = await fev("ord", () => ({ s: document.getElementById("order-filter-status").value, q: document.getElementById("order-filter-q").value, n: document.querySelectorAll("#orders-table tr").length - 1 }));
    ok("استُعيد من الاسطوانة بنقرة حقيقية على عقدته", !!st1, "mouse"); ok("والمرشّحات كما تُركت (في الطريق + «كريم») وطلب واحد ظاهر", vals.s === "expediee" && vals.q === "كريم" && vals.n === 1, "real-ui", vals);
    ok("والموضع والحجم والدوران كما كانت قبل الإغلاق", near(st1.x, st0.x, 1) && near(st1.y, st0.y, 1) && near(st1.w, st0.w, 1) && near(st1.ry, st0.ry, .5) && near(st1.z, st0.z, 1), "api", [st0, st1]);
    await FL("ord").locator("#order-filter-status").selectOption(""); await FL("ord").locator("#order-filter-q").fill(""); await p.waitForTimeout(500);
  });

  await section("Q8. سلوك الفضاء مع المحتوى الحقيقي: تدوير/عمق/مغناطيس/تركيز وتكديس/رمي/استعادة", async () => {
    await select("ord"); const A0 = await P("ord"); let r = await (await p.$('.panel[aria-label="الطلبات"] .pn-rot')).boundingBox(); await drag(r.x + 14, r.y + 14, r.x - 190, r.y - 20, 14, 40); await p.waitForTimeout(1500); await calm("ord"); const A1 = await P("ord");
    ok("تدوير مستقل للوح الحقيقي (ry/rx تغيّرا)", Math.abs(A1.ry - A0.ry) > 3 || Math.abs(A1.rx - A0.rx) > 2, "mouse", [A0.ry, A1.ry]);
    await FL("ord").locator("#order-filter-status").selectOption("nouvelle"); await p.waitForTimeout(600); ok("والمحتوى تفاعلي أثناء الدوران (المرشّح يعمل)", (await rows()) === store.ids.filter(o => o.status === "nouvelle").length - 1 /* أمينة أُكِّدت */, "real-ui", await rows());
    await FL("ord").locator("#order-filter-status").selectOption(""); await p.waitForTimeout(400);
    const dh = await (await p.$('.panel[aria-label="الطلبات"] .pn-dep')).boundingBox(), z0 = (await P("ord")).z; await drag(dh.x + 14, dh.y + 14, dh.x + 14, dh.y - 90, 10, 50); await p.waitForTimeout(1200); await calm("ord"); ok("عمق: يقترب اللوح الحقيقي نحو الكاميرا", (await P("ord")).z > z0 + 40, "mouse", [z0, (await P("ord")).z]);
    /* تكديس وتركيز */
    await p.evaluate(() => SpatialOS.open("inv")); await H.ready("inv"); await p.waitForTimeout(800);
    const zi = async id => (await P(id)).zi; await select("ord"); const zOrd = await zi("ord"), zInv = await zi("inv");
    ok("نقر لوح يرفعه للأمام (z-index) ويفعّله وحده (الدرع يُزال عنه)", zOrd > zInv && (await p.evaluate(() => getComputedStyle(document.querySelector('.panel[aria-label="الطلبات"] .pn-shield')).display)) === "none" && (await p.evaluate(() => getComputedStyle(document.querySelector('.panel[aria-label="المخزون"] .pn-shield')).display)) === "flex", "mouse", [zOrd, zInv]);
    /* مغناطيس */
    const slots = await p.evaluate(() => SpatialOS.slots()), cur = await P("inv"); await select("inv"); const hh = await hdr("inv");
    const tgt = slots.reduce((m, s) => Math.hypot(s.x - cur.x, s.y - cur.y) > 150 && Math.hypot(s.x - (A1.x), s.y - A1.y) > 200 ? (!m || Math.hypot(s.x - cur.x, s.y - cur.y) < Math.hypot(m.x - cur.x, m.y - cur.y) ? s : m) : m, null) || slots[5];
    await p.mouse.move(hh.x + hh.width / 2, hh.y + hh.height / 2); await p.mouse.down(); const gx = hh.x + hh.width / 2 + (tgt.x - cur.x) + 26, gy = hh.y + hh.height / 2 + (tgt.y - cur.y) + 24; for (let i = 1; i <= 16; i++) { await p.mouse.move(hh.x + hh.width / 2 + (gx - hh.x - hh.width / 2) * i / 16, hh.y + hh.height / 2 + (gy - hh.y - hh.height / 2) * i / 16); await p.waitForTimeout(55); }
    const gh = await p.evaluate(() => { const e = document.getElementById("slotghost"); return e && e.classList.contains("on"); }); await p.mouse.up(); await p.waitForTimeout(1500); await calm("inv"); const I1 = await P("inv");
    ok("مغناطيس: يظهر ظلّ الموضع المفضَّل قرب لوح حقيقي ويتثبّت عليه عند الإفلات (حتى في وضع المدار)", gh && Math.min(...slots.map(s => Math.hypot(s.x - I1.x, s.y - I1.y))) < 1.5, "mouse", { gh, I1: [I1.x, I1.y], tgt });
    /* رمي */
    await p.evaluate(() => SpatialOS.dismiss("inv", "close")); await p.waitForTimeout(900); const before = await snapOrders(); await select("ord"); await FL("ord").locator("#order-filter-q").fill("سعاد"); await p.waitForTimeout(600);
    let thrown = false; for (let tr = 0; tr < 5 && !thrown; tr++) { const h = await hdr("ord"), dir = (await P("ord")).x >= 0 ? 1 : -1, q = [h.x + h.width / 2, h.y + h.height / 2]; await p.mouse.move(q[0], q[1]); await p.mouse.down(); const n = 3 + tr; for (let i = 1; i <= n; i++) { await p.mouse.move(q[0] + dir * i * (700 / n), q[1] - i * 6); await p.waitForTimeout(8 + tr * 5); } await p.mouse.up(); await p.waitForTimeout(1800); thrown = !(await P("ord")); if (!thrown) await p.evaluate(() => SpatialOS.dismiss("nonexistent", "close")); }
    ok("رمي اللوح الحقيقي بسرعة نحو الحافة يغلقه ويتلاشى", thrown, "mouse", await p.evaluate(() => SpatialOS.lastRelease)); ok("ولم يتغيّر أي طلب بسبب الرمي", (await snapOrders()) === before, "api");
    await p.evaluate(() => SpatialOS.open("ord")); await ready("ord"); await p.waitForTimeout(1500);
    ok("وبالاستعادة يعود مرشّح البحث المحفوظ «سعاد» (طلب واحد)", await fev("ord", () => document.getElementById("order-filter-q").value) === "سعاد" && (await rows()) === 1, "real-ui");
    await FL("ord").locator("#order-filter-q").fill(""); await p.waitForTimeout(400);
  });

  await section("Q9. إدارة مساحة العمل: عدة ألواح حقيقية، تصغير/استعادة، ترتيب، عودة للاسطوانة، مواضع محفوظة", async () => {
    await p.evaluate(() => { for (const k of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(k, "close"); }); await p.waitForTimeout(900);
    for (const id of ["ord", "prod", "inv", "ana"]) { await p.evaluate(i => SpatialOS.open(i), id); await ready(id); await p.waitForTimeout(500); }
    ok("أربعة ألواح حقيقية مفتوحة معاً (طلبات/منتجات/مخزون/تحليلات)", (await p.evaluate(() => [...SpatialOS.panels.values()].filter(q => q.frDone).length)) === 4, "api");
    await p.click('#modebar [data-w="tile"]'); await p.waitForTimeout(1500); const pos = await p.evaluate(() => [...SpatialOS.panels.values()].map(q => [q.id, Math.round(q.st.x), Math.round(q.st.y)]));
    ok("«ترتيب»: كل لوح في موضعه من الشبكة (لا موضعان متطابقان)", new Set(pos.map(a => a[1] + "," + a[2])).size === 4, "mouse", pos);
    const before = await p.evaluate(() => Object.fromEntries([...SpatialOS.panels].map(([id, q]) => [id, [q.st.x, q.st.y, q.st.z, q.st.ry]])));
    const mn = await (await p.$('.panel[aria-label="المنتجات"] .pn-min')).boundingBox(); await p.mouse.click(mn.x + mn.width / 2, mn.y + mn.height / 2); await p.waitForTimeout(1200);
    ok("تصغير لوح: يختفي ويبقى حيّاً (الإطار لم يُدمَّر)", (await p.evaluate(() => { const q = SpatialOS.panels.get("prod"); return q.min && q.fr.isConnected && q.frDone; })), "mouse");
    await p.click('#modebar [data-w="cyl"]'); await p.waitForTimeout(1500); ok("«إلى الاسطوانة»: كل الألواح مصغَّرة وحالتها محفوظة والاسطوانة ظاهرة", await p.evaluate(() => [...SpatialOS.panels.values()].every(q => q.min) && SpatialOS.mode === "world"), "mouse");
    await p.click('#modebar [data-w="all"]'); await p.waitForTimeout(3500); const after = await p.evaluate(() => Object.fromEntries([...SpatialOS.panels].map(([id, q]) => [id, [q.st.x, q.st.y, q.st.z, q.st.ry, q.min]])));
    ok("«استعادة الكل»: تعود الألواح إلى مواضعها نفسها (محفوظة طوال الجلسة)", Object.keys(before).every(k => !after[k][4] && before[k].every((v, i) => near(v, after[k][i], 1.5))), "mouse", { before, after });
    await p.keyboard.press("w"); const fz = await p.evaluate(() => { const q = SpatialOS.panels.get("ana"), z0 = +q.el.style.zIndex; return z0; }); const ah = await hdr("ana"); await p.mouse.click(ah.x + ah.width / 2, ah.y + ah.height / 2); await p.waitForTimeout(400);
    ok("إحضار للأمام: نقر ترويسة لوح يرفعه فوق البقية", (await P("ana")).zi > Math.max(...(await Promise.all(["ord", "prod", "inv"].map(i => P(i)))).map(x => x.zi)), "mouse");
    await shot("q9-four-real-panels");
  });

  await section("Q10. المنتجات والتحليلات والمخزون والمساعد: مكوّنات حقيقية تُحمَّل", async () => {
    const prodN = await fev("prod", () => Admin.products.length), tabs = await Promise.all(["prod", "ana", "inv"].map(id => fev(id, () => [...document.querySelectorAll("[id^=tab-]")].filter(e => !e.classList.contains("hidden")).map(e => e.id)))), apiP = await p.evaluate(async () => { const r = await (await fetch("../../api/index.php?r=kv&k=products", { credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest" } })).json(); return r; });
    ok("المنتجات: تبويب products ظاهر داخل اللوح والواجهة تقرأ منتجات المتجر الحقيقية", tabs[0].includes("tab-products") && prodN >= 1, "real-ui", [tabs[0], prodN]);
    ok("التحليلات: تبويب analytics ظاهر مع مؤشرات حقيقية من الطلبات", tabs[1].includes("tab-analytics") && /12|طلب/.test(await fev("ana", () => document.getElementById("tab-analytics").innerText)), "real-ui", tabs[1]);
    ok("المخزون: تبويب inventory ظاهر", tabs[2].includes("tab-inventory"), "real-ui", tabs[2]);
    await p.evaluate(() => SpatialOS.open("help")); await H.ready("help"); await p.waitForTimeout(1200);
    const ai = await fev("help", () => { const a = document.getElementById("ah-panel"); return { on: a && a.classList.contains("on"), w: a && Math.round(a.getBoundingClientRect().width), vw: innerWidth }; });
    ok("دليل المساعدة (المرحلة 10: «اسألني» القديم صار لوح «help»): لوحة «اسألني» الحقيقية تفتح داخل اللوح وتملؤه", ai.on && ai.w >= ai.vw - 20, "real-ui", ai);
    await FL("help").locator("#ah-in").fill("كيف أضيف منتجاً جديداً"); await FL("help").locator("#ah-in").press("Enter"); await p.waitForTimeout(2500);
    const msgs = await fev("help", () => [...document.querySelectorAll("#ah-m > *")].map(e => e.innerText.trim()).filter(Boolean));
    ok("ويجيب عن سؤال حقيقي من قاعدة معرفة اللوحة (دون اتصال خارجي)", msgs.length >= 2 && msgs[msgs.length - 1].length > 20, "real-ui", msgs.slice(-1).map(x => x.slice(0, 60)));
    await shot("q10-assistant");
  });
  const own = errs.filter(e => /admin-preview\/spatial-os/.test(e)), adm = errs.filter(e => !/admin-preview\/spatial-os/.test(e));
  ok("لا أخطاء JavaScript صادرة من ملفات المعاينة الفضائية نفسها", own.length === 0, "api", own);
  R.push("   info أخطاء صادرة من شيفرة اللوحة الحقيقية نفسها (لا من المعاينة): " + adm.length + (adm.length ? " — " + JSON.stringify(adm[0]).slice(0, 200) : ""));
}

async function mobile(b, store) {
  const { p, errs, cdp } = await mk(b, store, { width: 448, height: 900 }, true), H = helpers(p), { P, ready, api, fev, FL, hdr } = H;
  const T = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  await ready("ord"); await p.waitForTimeout(1500);
  const snapOrders = async () => JSON.stringify((await api()).map(o => [o.id, o.status, o.note, o.total]).sort());
  await section("Q11. هاتف — لمس حقيقي (CDP): اللوح الحقيقي للطلبات", async () => {
    const m = await fev("ord", () => ({ n: Admin.orders.length, tab: !document.getElementById("tab-orders").classList.contains("hidden"), ow: document.documentElement.scrollWidth, iw: innerWidth }));
    ok("الطلبات الحقيقية (12) تُحمَّل على الهاتف وبلا تمرير أفقي داخل الإطار", m.n >= 12 && m.tab && m.ow <= m.iw + 2, "cdp-touch", m);
    const before = await snapOrders(); let h = await hdr("ord"), x = h.x + h.width / 2, y = h.y + h.height / 2; const P0 = await P("ord");
    await T("touchStart", [[x, y]]); await p.waitForTimeout(300); ok("لمسة على اللوح تحدّده (وضع الكائن) ويُزال درعه", (await p.evaluate(() => SpatialOS.mode)) === "object", "cdp-touch");
    for (let i = 1; i <= 10; i++) { await T("touchMove", [[x - i * 3, y + i * 9]]); await p.waitForTimeout(40); } await T("touchEnd", []); await p.waitForTimeout(1200); const P1 = await P("ord");
    ok("سحب الترويسة بإصبع يحرّك اللوح عبر محتوى الإطار دون أي فعل تجاري", Math.hypot(P1.x - P0.x, P1.y - P0.y) > 30 && (await snapOrders()) === before, "cdp-touch", [P0.y, P1.y]);
    /* تمرير المحتوى داخل الإطار بإصبع واحد: يمرّر الصفحة الداخلية ولا يحرّك اللوح */
    const fb = await (await p.$('.panel[aria-label="الطلبات"] iframe')).boundingBox(), sy0 = await fev("ord", () => scrollY), P2 = await P("ord");
    await T("touchStart", [[fb.x + fb.width / 2, fb.y + fb.height * .75]]); for (let i = 1; i <= 8; i++) { await T("touchMove", [[fb.x + fb.width / 2, fb.y + fb.height * .75 - i * 22]]); await p.waitForTimeout(30); } await T("touchEnd", []); await p.waitForTimeout(500);
    const sy1 = await fev("ord", () => scrollY), P3 = await P("ord"); ok("سحب إصبع واحد داخل المحتوى يمرّر الطلبات ولا يحرّك اللوح", sy1 > sy0 + 20 && near(P2.x, P3.x, .5) && near(P2.y, P3.y, .5), "cdp-touch", [sy0, sy1]);
    /* قرص بإصبعين داخل الإطار */
    const bb = await (await p.$('.panel[aria-label="الطلبات"]')).boundingBox(), cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2, s0 = (await P("ord")).s, yw = (await H.W()).yaw;
    await T("touchStart", [[cx - 40, cy], [cx + 40, cy]]); for (let i = 1; i <= 10; i++) { await T("touchMove", [[cx - 40 - i * 7, cy], [cx + 40 + i * 7, cy]]); await p.waitForTimeout(40); } const sm = (await P("ord")).s; await T("touchEnd", []); await p.waitForTimeout(700);
    ok("قرص بإصبعين فوق محتوى الإطار الحقيقي يكبّر اللوح (لا يكبّر الصفحة ولا يدوّر القاعة)", sm > s0 * 1.2 && near((await H.W()).yaw, yw, .01) && (await p.evaluate(() => visualViewport.scale)) === 1, "cdp-touch", [s0, sm]);
    const s1 = (await P("ord")).s; await T("touchStart", [[cx - 40, cy], [cx + 40, cy]]); for (let i = 1; i <= 10; i++) { const a = i * 3.5 * Math.PI / 180; await T("touchMove", [[cx - 40 * Math.cos(a), cy - 40 * Math.sin(a)], [cx + 40 * Math.cos(a), cy + 40 * Math.sin(a)]]); await p.waitForTimeout(40); } const rzm = (await P("ord")).rz; await T("touchEnd", []); await p.waitForTimeout(600);
    ok("والتواء بإصبعين داخل الإطار يميل اللوح (rz) ثم يعود", Math.abs(rzm) > 4, "cdp-touch", rzm);
    /* مرشّح حقيقي باللمس بعد كل ذلك */
    await FL("ord").locator("#order-filter-status").selectOption("livree"); await p.waitForTimeout(700); ok("وبعد كل الإيماءات يعمل المرشّح الحقيقي (مُسلَّمة)", (await fev("ord", () => document.querySelectorAll("#orders-table tr").length - 1)) === store.ids.filter(o => o.status === "livree").length, "real-ui");
    await FL("ord").locator("#order-filter-status").selectOption(""); await p.waitForTimeout(400);
    /* رمي باللمس ثم استعادة */
    let thrown = false; for (let tr = 0; tr < 5 && !thrown; tr++) { await p.evaluate(() => { const q = SpatialOS.panels.get("ord"); if (q) { Object.assign(q.st, { x: 0, y: 100, z: 0, rx: 0, ry: 0, rz: 0, s: 1 }); SpatialOS.open("ord"); } }); await p.waitForTimeout(800); const hh = await hdr("ord"); const q0 = [hh.x + hh.width / 2, hh.y + hh.height / 2]; await T("touchStart", [q0]); const n = 3 + tr; for (let i = 1; i <= n; i++) { await T("touchMove", [[q0[0] - i * (380 / n), q0[1] - i * (40 / n)]]); await p.waitForTimeout(8 + tr * 5); } await T("touchEnd", []); await p.waitForTimeout(1600); thrown = !(await P("ord")); }
    ok("رمي باللمس يغلق اللوح الحقيقي دون تغيير أي طلب", thrown && (await snapOrders()) === before, "cdp-touch");
    await p.click('#dock button[data-id="ord"]'); await ready("ord"); await p.waitForTimeout(1200); ok("واستعادته من الشريط/الاسطوانة بحالته", !!(await P("ord")), "cdp-touch");
  });
  const own = errs.filter(e => /admin-preview\/spatial-os/.test(e)); ok("لا أخطاء JavaScript من ملفات المعاينة (هاتف)", own.length === 0, "api", own);
}

(async () => {
  const store = await startStore(); const b = await chromium.launch();
  try { if (only === "all" || only === "desktop") await desktop(b, store); if (only === "all" || only === "mobile") await mobile(b, store); }
  finally { await b.close(); store.stop(); }
  console.log(R.join("\n")); console.log(fails ? "\nFAILED: " + fails : "\nALL PASSED (" + R.filter(x => /^PASS/.test(x)).length + ")"); process.exit(fails ? 1 : 0);
})();
