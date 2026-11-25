/* واجهة الهاتف V5 (390×844 بلمس): صينية النوافذ المفتوحة (عدّاد/تبديل/إغلاق)، القائمة (Escape)، لوحة المفاتيح (محاكاة منطقية)، LAURA ورقة معتمة فوق الشريط السفلي بحقل إدخال ظاهر،
   مساعد ALYSSUM الاحتياطي ورقة كاملة بين الشريطين، وفقاعة الإشعار مستطيل مدوَّر بعرض معقول. لا يثبت: لوحة مفاتيح افتراضية حقيقية ولا جهازاً حقيقياً ولا تجربة إيماءات حقيقية.
   التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/phone-nav.js */
const PW = require("playwright"), { startStore } = require("./harness");
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 340) : "")); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await PW.chromium.launch(), store = await startStore({ stock: true });
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }), p = await ctx.newPage(), errs = []; p.setDefaultTimeout(40000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await p.goto(store.base + "/admin.html"); await wait(500); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
    await p.goto(store.base + "/admin-preview/spatial-os/index.html?real=1&nozoom=1&norestore=1&nospare=1&noextra=1"); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && document.body.classList.contains("ps"), null, { timeout: 90000 }); await wait(2000);
    const rects = () => p.evaluate(() => { const r = e => { const q = e.getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map(Math.round); }; return { top: r(document.getElementById("ps-top")), bot: r(document.getElementById("ps-bot")), vw: innerWidth, vh: innerHeight }; });
    /* فتح نافذتين: الطلبات (بالقائمة) ثم المخزون */
    await p.evaluate(() => document.getElementById("ps-menu-btn").click()); await p.evaluate(() => document.querySelector('.ps-groups .ps-chip[data-g="store"]').click());
    await p.evaluate(() => document.querySelector('#ps-menu .ps-tile[data-id="ord"]').click()); await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 90000 });
    await p.evaluate(() => SpatialOS.open("inv")); await p.waitForFunction(() => { const q = SpatialOS.panels.get("inv"); return q && q.frDone; }, null, { timeout: 90000 }); await wait(1200);
    ok("عدّاد النوافذ المفتوحة على زر الصينية = 2 (ظاهر)", await p.evaluate(() => { const b = document.querySelector("#ps-wins .ps-badge"); return !!b && !b.hidden && b.textContent === "2"; }));
    await p.evaluate(() => document.getElementById("ps-wins").click()); await wait(300);
    const tr = await p.evaluate(() => ({ rows: [...document.querySelectorAll("#ps-tray .ps-trow")].map(r => r.dataset.id), on: (document.querySelector("#ps-tray .ps-trow.on") || {}).dataset && document.querySelector("#ps-tray .ps-trow.on").dataset.id, hid: document.getElementById("ps-tray").hidden }));
    ok("الصينية تعرض النافذتين والنشطة منهما مظلَّلة (inv)", !tr.hid && tr.rows.length === 2 && tr.rows.indexOf("ord") >= 0 && tr.rows.indexOf("inv") >= 0 && tr.on === "inv", tr);
    const tt = await p.evaluate(() => { const bad = []; document.querySelectorAll("#ps-tray .ps-tcard,#ps-tray .ps-tx,#ps-tray .ps-ib").forEach(e => { const q = e.getBoundingClientRect(); if (q.height < 43.5 || q.width < 40) bad.push([e.textContent.trim().slice(0, 10), Math.round(q.width), Math.round(q.height)]); }); return bad; });
    ok("أهداف لمس الصينية ≥ 44px", tt.length === 0, tt);
    await p.evaluate(() => document.querySelector('#ps-tray .ps-trow[data-id="ord"] .ps-tcard').click()); await wait(700);
    ok("النقر على بطاقة نافذة يبدّل إليها فوراً ويغلق الصينية", await p.evaluate(() => SpatialOS.activeId() === "ord" && document.getElementById("ps-tray").hidden === true));
    await p.evaluate(() => document.getElementById("ps-wins").click()); await wait(300); await p.evaluate(() => document.querySelector('#ps-tray .ps-trow[data-id="inv"] .ps-tx').click()); await wait(900);
    ok("× في الصينية يغلق النافذة (تبقى واحدة) ويُحدَّث العدّاد", await p.evaluate(() => SpatialOS.panels.size === 1 && !SpatialOS.panels.has("inv") && document.querySelector("#ps-wins .ps-badge").textContent === "1"), await p.evaluate(() => [SpatialOS.panels.size, document.querySelector("#ps-wins .ps-badge").textContent]));
    await p.keyboard.press("Escape"); await wait(200);
    ok("Escape يغلق الصينية", await p.evaluate(() => document.getElementById("ps-tray").hidden === true));
    await p.evaluate(() => document.getElementById("ps-menu-btn").click()); await wait(200); await p.keyboard.press("Escape"); await wait(200);
    ok("Escape يغلق القائمة", await p.evaluate(() => document.getElementById("ps-menu").hidden === true));
    /* لوحة المفاتيح (محاكاة منطقية) */
    const r0 = await rects(); await p.evaluate(() => SpatialPhone._kb(320)); await wait(500);
    const kbS = await p.evaluate(() => ({ botShown: getComputedStyle(document.getElementById("ps-bot")).display !== "none", cls: document.body.classList.contains("ps-kb"), kb: SpatialPhone.kb, rect: SpatialPhone.rect() }));
    ok("لوحة المفاتيح: يختفي الشريط السفلي وتُعلَّم الصفحة ps-kb", !kbS.botShown && kbS.cls && kbS.kb === 320, kbS);
    await p.evaluate(() => SpatialPhone._kb(0)); await wait(500);
    ok("زوال لوحة المفاتيح يُعيد الشريط السفلي", await p.evaluate(() => getComputedStyle(document.getElementById("ps-bot")).display !== "none" && !document.body.classList.contains("ps-kb")));
    /* LAURA: ورقة معتمة داخل الشاشة فوق الشريط السفلي بحقل إدخال ظاهر */
    const R = await rects(); await p.evaluate(() => { if (window.Laura) Laura.show(); }); await wait(900);
    const L = await p.evaluate(() => { const e = document.getElementById("laura"); if (!e || e.hidden) return null; const q = e.getBoundingClientRect(), cs = getComputedStyle(e), inp = e.querySelector("input,textarea"), iq = inp && inp.getBoundingClientRect(), bot = document.getElementById("ps-bot").getBoundingClientRect(); const m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor), a = m ? (m[1].split(",")[3] === undefined ? 1 : +m[1].split(",")[3]) : 0; return { left: Math.round(q.left), right: Math.round(q.right), bottom: Math.round(q.bottom), botTop: Math.round(bot.top), alpha: a, inpTop: iq ? Math.round(iq.top) : null, inpBottom: iq ? Math.round(iq.bottom) : null, fs: inp ? parseFloat(getComputedStyle(inp).fontSize) : 0 }; });
    ok("LAURA تظهر ورقة سفلية داخل عرض الشاشة وفوق الشريط السفلي", !!L && L.left >= 0 && L.right <= R.vw + 1 && L.bottom <= L.botTop + 2, L);
    ok("خلفية LAURA معتمة (لا يظهر ما خلفها)", !!L && L.alpha >= 0.95, L);
    ok("حقل إدخال LAURA ظاهر فوق الشريط السفلي بخط ≥ 16px (يمنع تكبير iOS)", !!L && L.inpBottom <= L.botTop && L.inpTop > 0 && L.fs >= 16, L);
    await p.evaluate(() => { if (window.Laura) Laura.close(); });
    /* مساعد ALYSSUM الاحتياطي: ورقة كاملة بين الشريطين */
    await p.evaluate(() => SpatialOS.open("ai")); await wait(1200);
    const A = await p.evaluate(() => { const q = [...document.querySelectorAll("#panels .panel")].find(x => x.getAttribute("aria-label") === "مساعد ALYSSUM"); if (!q) return null; const r = q.getBoundingClientRect(), t = document.getElementById("ps-top").getBoundingClientRect(), b = document.getElementById("ps-bot").getBoundingClientRect(); return { l: Math.round(r.left), w: Math.round(r.width), t: Math.round(r.top), bt: Math.round(r.bottom), topBar: Math.round(t.bottom), botBar: Math.round(b.top) }; });
    ok("مساعد ALYSSUM الاحتياطي: ورقة كاملة العرض بين الشريطين بلا خروج", !!A && A.l >= -1 && A.w >= R.vw - 3 && A.t >= A.topBar - 3 && A.bt <= A.botBar + 3, A);
    await p.evaluate(() => SpatialOS.dismiss("ai", "close")); await wait(500);
    /* فقاعة الإشعار */
    await p.evaluate(() => SpatialOS.open("ord")); await wait(800);
    await p.evaluate(() => { const w = SpatialOS.panels.get("ord").fr.contentWindow; w.eval("toast('✅ أُنشئت صفحة المنتج: miel-sidr، tarkiz، huile-a-barbe (تظهر خلال دقيقة)')"); return true; });
    await wait(700);   /* #toast2 فيه transition:.3s */
    const T = await p.evaluate(() => { const w = SpatialOS.panels.get("ord").fr.contentWindow; const e = w.document.getElementById("toast2"), q = e.getBoundingClientRect(), cs = w.getComputedStyle(e); return { radius: parseFloat(cs.borderTopLeftRadius), w: Math.round(q.width), h: Math.round(q.height), vw: w.innerWidth }; });
    ok("فقاعة الإشعار مستطيل مدوَّر (لا إهليلج) وبعرض معقول داخل الشاشة", T.radius <= 20 && T.w > 150 && T.w <= T.vw - 20 && T.h < 120, T);
    ok("لا أخطاء صفحة", errs.length === 0, errs);
  } catch (e) { fails++; console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 700)); }
  finally { try { await b.close(); } catch { } try { store.stop(); } catch { } }
  console.log(fails ? "FAILS: " + fails : "ALL PASS"); process.exit(fails ? 1 : 0);
})();
