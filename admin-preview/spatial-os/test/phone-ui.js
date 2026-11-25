/* واجهة الهاتف المخصصة (phone.js): شاشات 360/390/412 + لوحي عمودي 768؛ لمس حقيقي (CDP).
   يثبت: الشريطان العلوي/السفلي والمجموعات الست وأزرار التنقل الخمسة؛ أهداف اللمس ≥ 40–44px والخطوط ≥ 12px؛ لا تمرير أفقي للصفحة؛ الورقة تملأ المساحة بين الشريطين بلا تداخل؛ ورقة واحدة (إطار واحد)؛
   التنقل بين العناصر آني داخل الورقة نفسها؛ تمرير الورقة بالإصبع؛ LAURA تفتح فوق الشريط السفلي؛ «العالم» يُظهر الاسطوانة والقاعدة ثم «الرئيسية» تعيد الورقة؛ استعادة الترتيب بعد إعادة التحميل؛ الفرنسية بلا بقايا عربية؛ بلا أخطاء.
   لا يثبت: جهازاً حقيقياً (iOS/أندرويد)؛ لوحة المفاتيح الافتراضية؛ إيماءات النظام. التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/phone-ui.js */
const PW = require("playwright"), { startStore } = require("./harness");
const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 380) : "")); console.log(R[R.length - 1]); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await PW.chromium.launch(), store = await startStore({ stock: true });
  try {
    for (const [name, vp] of [["360×740", { width: 360, height: 740 }], ["390×844", { width: 390, height: 844 }], ["412×915", { width: 412, height: 915 }], ["لوحي 768×1024", { width: 768, height: 1024 }]]) {
      const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true }), p = await ctx.newPage(), errs = []; p.setDefaultTimeout(40000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
      await p.goto(store.base + "/admin.html"); await wait(500); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
      const URLS = store.base + "/admin-preview/spatial-os/index.html?real=1&nozoom=1"; await p.goto(URLS + "&norestore=1"); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && document.body.classList.contains("ps"), null, { timeout: 90000 }); await wait(2000);
      const info = () => p.evaluate(() => { const r = e => { const q = e.getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map(Math.round); }, top = document.getElementById("ps-top"), bot = document.getElementById("ps-bot"), pn = [...document.querySelectorAll(".panel")].find(x => !x.classList.contains("min") && getComputedStyle(x).display !== "none"), fl = document.getElementById("floorcv"); return { top: r(top), bot: r(bot), panel: pn ? r(pn) : null, groups: document.querySelectorAll(".ps-groups .ps-chip").length, subs: document.querySelectorAll(".ps-subs .ps-chip").length, nav: document.querySelectorAll("#ps-bot .ps-nb").length, frames: document.querySelectorAll(".panel iframe.pn-frame").length, floor: !!fl && getComputedStyle(fl).display !== "none", scrollW: document.documentElement.scrollWidth, vw: innerWidth, hero: document.body.classList.contains("ps-hero") }; });
      let s = await info();
      ok(name + ": شريط علوي بصف واحد (≈56px، V5) وشريط سفلي والمجموعات الست في القائمة وأزرار التنقل الخمسة", s.groups === 6 && s.nav === 5 && s.top[3] >= 50 && s.top[3] <= 72 && s.bot[3] >= 60 && s.subs >= 1 && !!(await p.$("#ps-menu-btn")) && !!(await p.$("#ps-wins")), s);
      ok(name + ": لا تمرير أفقي للصفحة والقاعدة ظاهرة في العالم", s.scrollW <= s.vw + 1 && s.floor, s);
      const tt = await p.evaluate(() => { const bad = []; document.querySelectorAll(".ps-chip,.ps-nb,.ps-ib,.ps-tile,.ps-tcard,.ps-tx").forEach(e => { const q = e.getBoundingClientRect(); if (!q.width || !q.height) return; /* المخفي (القائمة/الصينية المغلقتان) يُفحص أدناه عند فتحهما */ const fs = parseFloat(getComputedStyle(e).fontSize), min = e.closest(".ps-subs") ? 40 : 44; if (q.height < min - .5 || q.width < 40 || fs < 12) bad.push([e.textContent.trim().slice(0, 12), Math.round(q.width), Math.round(q.height), fs]); }); return bad; });
      ok(name + ": أهداف اللمس ≥ 40/44px والخطوط ≥ 12px في كل الأزرار", tt.length === 0, tt);
      /* فتح الورقة بمجموعة المتجر */
      /* القائمة: أهداف لمس ≥ 44px وخطوط ≥ 12px داخلها، ثم المجموعة تُظهر عناصرها والبطاقة تفتح الورقة */
      await p.evaluate(() => document.getElementById("ps-menu-btn").click()); await wait(400);
      const mt = await p.evaluate(() => { const bad = []; document.querySelectorAll("#ps-menu .ps-chip,#ps-menu .ps-tile,#ps-menu .ps-ib").forEach(e => { const q = e.getBoundingClientRect(), fs = parseFloat(getComputedStyle(e).fontSize); if (q.width && (q.height < 43.5 || q.width < 40 || fs < 12)) bad.push([e.textContent.trim().slice(0, 12), Math.round(q.width), Math.round(q.height), fs]); }); return bad; });
      ok(name + ": القائمة: أهداف اللمس ≥ 44px والخطوط ≥ 12px", mt.length === 0, mt);
      await p.evaluate(() => document.querySelector('.ps-groups .ps-chip[data-g="store"]').click()); await wait(300);
      const tl = await p.evaluate(() => [...document.querySelectorAll("#ps-menu .ps-tile")].map(b => b.dataset.id));
      ok(name + ": اختيار مجموعة يعرض عناصرها كبطاقات (المتجر فيها الطلبات والتوصيل)", tl.indexOf("ord") >= 0 && tl.indexOf("delivery") >= 0, tl);
      await p.evaluate(() => document.querySelector('#ps-menu .ps-tile[data-id="ord"]').click()); await p.waitForFunction(() => { const q = [...SpatialOS.panels.values()][0]; return q && q.frDone; }, null, { timeout: 90000 }); await wait(1500); s = await info();
      ok(name + ": البطاقة تفتح الورقة وتغلق القائمة", await p.evaluate(() => document.getElementById("ps-menu").hidden === true && !document.body.classList.contains("ps-menu-on")));
      const tb = s.top[1] + s.top[3], bt = s.bot[1];
      ok(name + ": الورقة تملأ المساحة بين الشريطين كاملة العرض بلا تداخل ولا خروج", !!s.panel && s.panel[0] >= -1 && s.panel[2] >= s.vw - 2 && s.panel[1] >= tb - 2 && s.panel[1] + s.panel[3] <= bt + 2 && s.panel[3] >= (bt - tb) - 6, { s, tb, bt });
      ok(name + ": ورقة واحدة (إطار واحد) وعناصر المتجر ظاهرة كشرائح", s.frames === 1 && s.subs >= 20, s);
      /* التنقل بين العناصر */
      const t = await p.evaluate(async () => { const o = []; for (const id of ["delivery", "ord", "returns", "ord"]) { const b = document.querySelector('.ps-subs .ps-chip[data-id="' + id + '"]'); if (!b) { o.push(-1); continue; } const t0 = performance.now(); b.click(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); o.push(Math.round(performance.now() - t0)); await new Promise(r => setTimeout(r, 400)); } return o; });
      const act = await p.evaluate(() => ({ on: (document.querySelector(".ps-subs .ps-chip.on") || {}).dataset && document.querySelector(".ps-subs .ps-chip.on").dataset.id, frames: document.querySelectorAll(".panel iframe.pn-frame").length, panels: SpatialOS.panels.size, title: document.querySelector(".ps-title").textContent }));
      ok(name + ": التنقل بين العناصر بالنقر آني (كلها ≤ 250ms) داخل الورقة نفسها وتبقى الشريحة النشطة", t.every(x => x >= 0 && x <= 250) && act.on === "ord" && act.frames === 1 && act.panels === 1, { t, act });
      /* تمرير الورقة بالإصبع */
      const cdp = await ctx.newCDPSession(p), T = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], k) => ({ x, y, id: k })) });
      const sc0 = await p.evaluate(() => [...SpatialOS.panels.values()][0].fr.contentDocument.scrollingElement.scrollTop); const cy = (tb + bt) / 2; await T("touchStart", [[vp.width / 2, cy + 120]]); for (let k = 1; k <= 10; k++) { await T("touchMove", [[vp.width / 2, cy + 120 - k * 24]]); await wait(16); } await T("touchEnd", []); await wait(500);
      const sc1 = await p.evaluate(() => [...SpatialOS.panels.values()][0].fr.contentDocument.scrollingElement.scrollTop); const mx = await p.evaluate(() => { const e = [...SpatialOS.panels.values()][0].fr.contentDocument.scrollingElement; return e.scrollHeight - e.clientHeight; }); ok(name + ": تمرير الورقة بالإصبع يعمل (أو المحتوى يتسع بلا تمرير)", mx < 60 || sc1 > sc0 + 40, [sc0, sc1, mx]);
      /* زر LAURA موجود ويعمل (التفاصيل الكاملة مع خادم LAURA في laura-phone-ui.js) */
      const lb = await p.evaluate(() => { const b = document.querySelector("#ps-bot .ps-laura"), q = b.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), inBar: q.bottom <= innerHeight && q.left >= 0 && q.right <= innerWidth }; });
      ok(name + ": زر LAURA ظاهر داخل الشاشة بهدف لمس كبير", lb.inBar && lb.h >= 44 && lb.w >= 44, lb);
      /* العالم ثم الرئيسية */
      await p.evaluate(() => document.querySelector("#ps-bot .ps-nb:last-child").click()); await wait(1200); s = await info();
      ok(name + ": زر «العالم» يُصغّر الورقة ويُظهر الاسطوانة والقاعدة (وضع hero)", s.hero && s.floor && s.groups === 6, s);
      await p.evaluate(() => document.querySelector('#ps-bot .ps-nb[data-nav="dash"], #ps-bot .ps-nb:first-child').click()); await p.waitForFunction(() => document.querySelectorAll(".panel").length >= 1 && !document.body.classList.contains("ps-hero"), null, { timeout: 60000 }); s = await info();
      ok(name + ": «الرئيسية» تعيد الورقة", !s.hero && !!s.panel, s);
      /* استعادة بعد إعادة التحميل */
      await wait(2500); await p.goto(URLS); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && document.body.classList.contains("ps") && SpatialOS.panels.size >= 1, null, { timeout: 90000 }); await wait(2500); s = await info();
      ok(name + ": بعد إعادة التحميل تعود الورقة داخل الإطار المحدد والقاعدة موجودة", !!s.panel && s.panel[2] >= s.vw - 2 && s.floor, s);
      /* الفرنسية */
      await p.evaluate(() => document.getElementById("ps-lang").click()); await p.waitForFunction(() => document.documentElement.lang === "fr", null, { timeout: 20000 }); await wait(1500);
      const fr = await p.evaluate(() => [...document.querySelectorAll("#ps-top .ps-chip,#ps-bot .ps-nb span,#ps-top .ps-title")].map(e => e.textContent.trim()).filter(t => /[؀-ۿ]/.test(t)));
      ok(name + ": بالفرنسية لا بقايا عربية في الشرائط (مجموعات/عناصر/تنقل سفلي)", fr.length === 0, fr);
      ok(name + ": لا أخطاء صفحة", errs.length === 0, errs); await ctx.close();
    }
  } catch (e) { fails++; console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 900)); }
  finally { try { await b.close(); } catch { } try { store.stop(); } catch { } }
  console.log(fails ? "\nFAILED: " + fails : "\nALL PASS (" + R.filter(x => x.startsWith("PASS")).length + ")"); process.exit(fails ? 1 : 0);
})();
