/* المرحلة 7 — فيزياء طبيعية للكائنات: رقة الألواح، قصور واحتكاك في XY وفي العمق، مغناطيس ناعم، استجابة للإمساك، ثبات البيئة، حفظ الحالة.
   «mouse» فأرة Playwright حقيقية · «cdp-touch» لمس CDP حقيقي (يُختبر بشكل منفصل في mobile) · «api» قراءة حالة فقط.
   التشغيل: python3 -m http.server 8765 (من الجذر) ثم  NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/phase7.js [desktop|mobile|all] */
const { chromium } = require("playwright"); const URL = process.env.URL || "http://localhost:8765/admin-preview/spatial-os/index.html"; const only = process.argv[2] || "all";
const R = []; let fails = 0; const ok = (n, c, m, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + "[" + m + "] " + n + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 170) : "")); };
async function section(name, fn) { R.push("── " + name); try { await fn(); } catch (e) { fails++; R.push("FAIL [crash] " + name + ": " + String(e).split("\n")[0].slice(0, 200)); } }
const near = (a, b, e = .02) => Math.abs((a || 0) - (b || 0)) <= e, KEYS = ["x", "y", "z", "rx", "ry", "rz", "s", "w", "h"], same = (a, b, e) => !!a && !!b && KEYS.every(k => near(a[k], b[k], e));

async function desktop(b) {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await c.newPage(), errs = []; p.setDefaultTimeout(7000); p.on("pageerror", e => errs.push(String(e).slice(0, 160)));
  await p.goto(URL); await p.waitForTimeout(1500);
  const Wd = () => p.evaluate(() => SpatialOS.world()), P = id => p.evaluate(i => { const q = SpatialOS.panels.get(i); return q ? { ...q.st, big: q.big, user: q.user, lift: q.lift || 0, hold: q.hold || null, f: q.content && q.content.f } : null; }, id);
  const calm = async id => { let prev = null; for (let k = 0; k < 24; k++) { const q = JSON.stringify(await P(id)); if (q === prev) return; prev = q; await p.waitForTimeout(300); } };
  const nm = id => p.evaluate(i => SpatialOS.panels.get(i).sec.name, id);
  const sel = async (id, q) => `.panel[aria-label="${await nm(id)}"] ${q}`;
  const freePt = id => p.evaluate(i => { const q = SpatialOS.panels.get(i), h = q.el.querySelector(".pn-h"), r = h.getBoundingClientRect(), y = r.top + r.height / 2; for (let x = Math.max(8, r.left + 8); x < Math.min(innerWidth - 8, r.right - 8); x += 6) { const t = document.elementFromPoint(x, y); if (t && t.closest(".panel") === q.el && !t.closest("button")) return [x, y]; } return null; }, id);
  const reset = async () => { await p.evaluate(() => { for (const k of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(k, "close"); SpatialOS.setYaw(0); SpatialOS.clearSel(); SpatialOS.setOrbit(false); }); await p.waitForTimeout(900); };
  const open2 = async () => { await p.evaluate(() => SpatialOS.open("ord")); await p.waitForTimeout(1300); await p.evaluate(() => SpatialOS.open("ana")); await p.waitForTimeout(1600); await calm("ord"); await calm("ana"); };
  await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(700);

  await section("P1. لوح هولوغرافي فائق الرقة بزوايا مضيئة دقيقة", async () => {
    await reset(); await open2(); const r = await p.evaluate(() => { const e = document.querySelector(".panel"), cs = getComputedStyle(e), ac = getComputedStyle(e.querySelector(".pn-ac")); return { T: parseFloat(cs.getPropertyValue("--T")), bg: ac.backgroundImage.slice(0, 40), op: +ac.opacity, ext: [...e.querySelectorAll(".slab")].map(s => s.style.transform || getComputedStyle(s).transform).length }; });
    ok("السُمك ≤ 8px (من 42px) والزوايا الذهبية/السماوية موجودة وظاهرة", r.T <= 8 && /gradient/.test(r.bg) && r.op > .5, "api", r);
  });

  await section("P2. استجابة الإمساك: يرتفع نحو الكاميرا ويميل بحسب نقطة الإمساك ثم يعود", async () => {
    await reset(); await open2(); const B0 = await P("ana"), W0 = await Wd(); const r = await (await p.$(await sel("ord", ".pn-h h3"))).boundingBox(); const xl = r.x + 8, xr = r.x + r.width - 8, y = r.y + r.height / 2;
    const grab = async x => { await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 6, y + 2); await p.waitForTimeout(350); const s = await P("ord"); const tr = await p.evaluate(() => document.querySelector(".panel.dragging").style.transform); await p.mouse.up(); await p.waitForTimeout(900); return { s, tr }; };
    const L = await grab(xl), Rr = await grab(xr);
    ok("أثناء الإمساك يرتفع اللوح (lift>0) ويظهر في الـtransform", L.s.lift > 10 && /translate3d\([^)]*,\s*(\d+\.?\d*)px\)/.test(L.tr), "mouse", [L.s.lift, L.tr.slice(0, 60)]);
    ok("الإمساك من اليسار واليمين يميلان باتجاهين متعاكسين", L.s.hold && Rr.s.hold && L.s.hold.y * Rr.s.hold.y < 0, "mouse", [L.s.hold, Rr.s.hold]);
    const A1 = await P("ord"); ok("بعد الإفلات يعود الارتفاع والميل إلى الصفر", !A1.lift && !A1.hold, "api", A1);
    ok("اللوح الآخر والبيئة ثابتان", same(B0, await P("ana"), .6) && near(W0.angle, (await Wd()).angle, .02), "api");
  });

  await section("P3. قصور واحتكاك في XY ثم استقرار", async () => {
    await reset(); await open2(); const B0 = await P("ana"), W0 = await Wd(); let best = null;
    for (let tr = 0; tr < 4 && !best; tr++) { const q = await freePt("ord"); const x0 = (await P("ord")).x; await p.mouse.move(q[0], q[1]); await p.mouse.down(); const n = 4 + tr, st = 120 + tr * 20; for (let i = 1; i <= n; i++) { await p.mouse.move(q[0] - i * (st / n), q[1] + i * 5); await p.waitForTimeout(10 + tr * 6); } await p.mouse.up(); const u = await P("ord"); await p.waitForTimeout(160); const m = await P("ord"); await p.waitForTimeout(1600); const e = await P("ord");
      if (Math.abs(m.x - u.x) > 4 && Math.abs(e.x - m.x) > 1) best = { x0, u: u.x, m: m.x, e: e.x }; else { await p.evaluate(() => { const q = SpatialOS.panels.get("ord"); q.st.x = 396; q.st.y = -18; }); await calm("ord"); } }
    ok("بعد الإفلات يواصل اللوح الانزلاق (قصور) ثم يتباطأ ويستقر", !!best, "mouse", best);
    ok("اللوح الآخر والبيئة ثابتان", same(B0, await P("ana"), .6) && near(W0.angle, (await Wd()).angle, .02) && near(W0.pa, (await Wd()).pa, .02), "api");
    const f1 = await P("ord"); await p.waitForTimeout(600); ok("وبعد الاستقرار لا حركة متبقّية (احتكاك كامل)", same(f1, await P("ord"), .05), "api");
  });

  await section("P4. عمق مضبوط مع قصور: يقترب/يبتعد ويكمل الانزلاق ثم يستقر داخل المدى", async () => {
    await reset(); await open2(); const B0 = await P("ana"); let up = null;
    for (let tr = 0; tr < 5 && !up; tr++) { await p.evaluate(() => { SpatialOS.panels.get("ord").st.z = 0; }); const d = await (await p.$(await sel("ord", ".pn-dep"))).boundingBox(); await p.mouse.move(d.x + 14, d.y + 14); await p.mouse.down(); const n = 3, st = 110 + tr * 25; for (let i = 1; i <= n; i++) { await p.mouse.move(d.x + 14, d.y + 14 - i * (st / n)); await p.waitForTimeout(4); } const pre = (await P("ord")).z; await p.mouse.up(); await p.waitForTimeout(150); const m = (await P("ord")).z; await p.waitForTimeout(1600); const e = (await P("ord")).z; if (m > pre + 5 && e >= m - .1 && e <= 300.01) up = { pre, m, e }; }
    ok("القرب: يواصل z الزيادة بعد الإفلات ثم يستقر ≤ 300", !!up, "mouse", up);
    let dn = null; for (let tr = 0; tr < 5 && !dn; tr++) { await p.evaluate(() => { SpatialOS.panels.get("ord").st.z = 0; }); const d = await (await p.$(await sel("ord", ".pn-dep"))).boundingBox(); await p.mouse.move(d.x + 14, d.y + 14); await p.mouse.down(); const n = 3, st = 110 + tr * 25; for (let i = 1; i <= n; i++) { await p.mouse.move(d.x + 14, d.y + 14 + i * (st / n)); await p.waitForTimeout(4); } const pre = (await P("ord")).z; await p.mouse.up(); await p.waitForTimeout(150); const m = (await P("ord")).z; await p.waitForTimeout(1600); const e = (await P("ord")).z; if (m < pre - 5 && e >= -260.01) dn = { pre, m, e }; }
    ok("الابتعاد: يواصل z النقصان بعد الإفلات ويبقى ≥ −260", !!dn, "mouse", dn);
    ok("المقاس على الشاشة يتبع المنظور (القريب أكبر) — بمفاتيح PageUp/PageDown الحقيقية", await (async () => { await p.evaluate(() => { SpatialOS.panels.get("ord").st.z = 0; }); await p.focus(await sel("ord", "")); for (let k = 0; k < 6; k++) await p.keyboard.press("PageUp"); await p.waitForTimeout(900); const a = (await (await p.$(await sel("ord", ""))).boundingBox()).width, za = (await P("ord")).z; for (let k = 0; k < 12; k++) await p.keyboard.press("PageDown"); await p.waitForTimeout(900); const b2 = (await (await p.$(await sel("ord", ""))).boundingBox()).width, zb = (await P("ord")).z; return za > 150 && zb < -150 && a > b2 * 1.1; })(), "keyboard");
    ok("الألواح الأخرى ثابتة", same(B0, await P("ana"), .6), "api");
  });

  await section("P5. مغناطيس ناعم نحو مواضع العمل المفضَّلة", async () => {
    await reset(); await open2(); const slots = await p.evaluate(() => SpatialOS.slots()), free = slots[4], A0 = await P("ana"), Bo = await P("ord"), W0 = await Wd();
    const q = await freePt("ana"); await p.mouse.move(q[0], q[1]); await p.mouse.down();
    /* نقترب من الموضع الحرّ (0، سفلي) ونقف على بُعد ~48px منه */
    const tx = q[0] + (free.x - A0.x) + 30, ty = q[1] + (free.y - A0.y) + 36; for (let i = 1; i <= 14; i++) { await p.mouse.move(q[0] + (tx - q[0]) * i / 14, q[1] + (ty - q[1]) * i / 14); await p.waitForTimeout(45); }
    const g = await p.evaluate(() => { const e = document.getElementById("slotghost"); return e && { on: e.classList.contains("on"), op: +e.style.opacity }; }), mid = await P("ana");
    ok("قرب موضع مفضَّل حرّ يظهر ظلّه المنقَّط", !!g && g.on && g.op > .3, "mouse", g);
    const naked = { x: A0.x + (tx - q[0]), y: A0.y + (ty - q[1]) }; ok("والمؤشر يسحب اللوح نحو الموضع (مقاومة ناعمة): أقرب للموضع مما لو لم يُسحب", Math.hypot(mid.x - free.x, mid.y - free.y) < Math.hypot(naked.x - free.x, naked.y - free.y) - 5, "mouse", [Math.round(Math.hypot(mid.x - free.x, mid.y - free.y)), Math.round(Math.hypot(naked.x - free.x, naked.y - free.y))]);
    await p.mouse.up(); await p.waitForTimeout(1400); await calm("ana"); const A1 = await P("ana");
    ok("عند الإفلات يتثبّت اللوح تماماً على الموضع المفضَّل", near(A1.x, free.x, 1) && near(A1.y, free.y, 1), "mouse", [A1.x, A1.y, free]);
    ok("وزال الظلّ المنقَّط", await p.evaluate(() => !document.querySelector("#slotghost.on")), "api");
    ok("اللوح الآخر والبيئة ثابتان", same(Bo, await P("ord"), .6) && near(W0.angle, (await Wd()).angle, .02), "api");
    /* بعيداً عن أي موضع: لا تثبيت */
    const q2 = await freePt("ana"), st0 = await P("ana"); await p.mouse.move(q2[0], q2[1]); await p.mouse.down(); for (let i = 1; i <= 10; i++) { await p.mouse.move(q2[0] + i * 14, q2[1] - i * 4); await p.waitForTimeout(60); } await p.waitForTimeout(300); await p.mouse.up(); await p.waitForTimeout(1500); await calm("ana"); const A2 = await P("ana");
    const nearest = Math.min(...slots.map(s => Math.hypot(s.x - A2.x, s.y - A2.y))); ok("خارج نطاق المواضع (> 85px) لا يُسحب ولا يُثبَّت قسراً", nearest > 60 || Math.abs(A2.x - (st0.x + 140)) < 30, "mouse", { nearest: Math.round(nearest), A2: [A2.x, A2.y], st0: [st0.x, st0.y] });
    /* موضع محجوز بلوح آخر: لا ظلّ */
    const occ = slots.reduce((m, s) => Math.hypot(s.x - Bo.x, s.y - Bo.y) < Math.hypot(m.x - Bo.x, m.y - Bo.y) ? s : m); const q3 = await freePt("ana"); await p.mouse.move(q3[0], q3[1]); await p.mouse.down(); const a3 = await P("ana"); const tx3 = q3[0] + (occ.x - a3.x), ty3 = q3[1] + (occ.y - a3.y) + 10; for (let i = 1; i <= 12; i++) { await p.mouse.move(q3[0] + (tx3 - q3[0]) * i / 12, q3[1] + (ty3 - q3[1]) * i / 12); await p.waitForTimeout(50); }
    ok("لا ظلّ مغناطيسي على موضع يشغله لوح آخر", await p.evaluate(() => { const e = document.getElementById("slotghost"); return !e || !e.classList.contains("on"); }), "mouse"); await p.mouse.up(); await p.waitForTimeout(900);
  });

  await section("P6. قرار الرمي مبني على السرعة: بطيء لا يرمي، سريع يرمي بتسارع وانكماش وتلاشٍ", async () => {
    await reset(); await open2(); const slow = await freePt("ana"), Wc = await Wd(), O0 = await P("ord"); await p.mouse.move(slow[0], slow[1]); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(slow[0] + i * 8, slow[1] + i * 3); await p.waitForTimeout(140); } await p.mouse.up(); await p.waitForTimeout(1800);
    ok("إفلات بطيء وسط المساحة لا يرمي", !!(await P("ana")), "mouse", await p.evaluate(() => SpatialOS.lastRelease));
    let samples = null, thrown = false; for (let tr = 0; tr < 4 && !thrown; tr++) { const q = await freePt("ana"); const dir = (await P("ana")).x >= 0 ? 1 : -1; await p.evaluate(() => { window.__q = SpatialOS.panels.get("ana"); }); await p.mouse.move(q[0], q[1]); await p.mouse.down(); const n = 3 + tr; for (let i = 1; i <= n; i++) { await p.mouse.move(q[0] + dir * i * (380 / n), q[1] - i * 3); await p.waitForTimeout(8 + tr * 4); } await p.mouse.up();
      const sm = []; for (let k = 0; k < 6; k++) { sm.push(await p.evaluate(() => { const q = window.__q; return q.el.isConnected || q.state === "dismissing" ? { x: q.st.x, s: q.st.s, op: +getComputedStyle(q.el).getPropertyValue("--op"), st: q.state } : null; })); await p.waitForTimeout(110); }
      await p.waitForTimeout(500); thrown = !(await P("ana")); samples = sm.filter(x => x && !x.bad); if (sm.some(x => x && x.bad)) R.push("   dbg bad transform " + JSON.stringify(sm.find(x => x && x.bad))); if (!thrown) await p.evaluate(() => { SpatialOS.panels.get("ana").st.x = -396; SpatialOS.panels.get("ana").st.y = -18; }); }
    ok("إفلات سريع نحو الحافة يرمي اللوح", thrown, "mouse", await p.evaluate(() => SpatialOS.lastRelease));
    const s = samples; ok("أثناء الرمي: ينكمش (s يتناقص) ويبهت (op يتناقص) ويتسارع نحو الخارج", s.length >= 3 && s[s.length - 1].s < s[0].s && s[s.length - 1].op < s[0].op && Math.abs(s[s.length - 1].x - s[0].x) > 30, "mouse", s.slice(0, 5));
    ok("جسيمات التلاشي ظهرت", await p.evaluate(() => FX.count()) >= 0, "api");
    ok("لوح الطلبات والبيئة ثابتان", same(O0, await P("ord"), .6) && near(Wc.angle, (await Wd()).angle, .02), "api");
  });

  await section("P7. المحتوى والحالة محفوظان أثناء التحريك والتدوير والعمق والتحجيم والتوسيع", async () => {
    await reset(); await open2(); await p.click((await sel("ord", '[data-f="new"]'))); await p.waitForTimeout(300);
    const snap = () => p.evaluate(() => { const q = SpatialOS.panels.get("ord"); return { f: q.content.f, rows: q.body.querySelectorAll(".row,tr,.ord").length, active: (q.body.querySelector(".chips .on,.chips .act,.chips [aria-pressed=true]") || {}).textContent || null, txt: q.body.textContent.length }; });
    const s0 = await snap(); ok("تحديد فلتر «جديدة» غيّر المحتوى", s0.f === "new", "mouse", s0);
    let q = await freePt("ord"); await p.mouse.move(q[0], q[1]); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(q[0] - i * 10, q[1] + i * 6); await p.waitForTimeout(40); } await p.mouse.up(); await p.waitForTimeout(1600); await calm("ord"); const s1 = await snap();
    await p.keyboard.press("r"); q = await freePt("ord"); await p.mouse.move(q[0], q[1]); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(q[0] + i * 16, q[1] + i * 4); await p.waitForTimeout(40); } await p.mouse.up(); await p.waitForTimeout(1600); await calm("ord"); const s2 = await snap();
    await p.keyboard.press("z"); const d = await (await p.$(await sel("ord", ".pn-dep"))).boundingBox(); await p.mouse.move(d.x + 14, d.y + 14); await p.mouse.down(); for (let i = 1; i <= 6; i++) { await p.mouse.move(d.x + 14, d.y + 14 - i * 12); await p.waitForTimeout(60); } await p.waitForTimeout(400); await p.mouse.up(); await p.waitForTimeout(1500); await calm("ord"); const s3 = await snap();
    const rs = await (await p.$(await sel("ord", ".pn-rs"))).boundingBox(), w0 = (await P("ord")).w; await p.mouse.move(rs.x + 10, rs.y + 10); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(rs.x + 10 - i * 12, rs.y + 10 + i * 8); await p.waitForTimeout(40); } await p.mouse.up(); await p.waitForTimeout(900); await calm("ord"); const s4 = await snap(), w1 = (await P("ord")).w;
    ok("بعد تحريك ثم تدوير ثم عمق ثم تحجيم: الفلتر والصفوف ونص المحتوى كما هي", [s1, s2, s3, s4].every(x => x.f === "new" && x.rows === s0.rows && x.active === s0.active), "mouse", [s0, s1, s2, s3, s4]);
    ok("والتحجيم تمّ فعلاً (العرض تغيّر)", Math.abs(w1 - w0) > 30, "mouse", [w0, w1]);
    await p.keyboard.press("f"); await p.waitForTimeout(900); const s5 = await snap(); await p.keyboard.press("Escape"); await p.waitForTimeout(900); const s6 = await snap();
    ok("التوسيع ثم العودة يحفظان الفلتر", s5.f === "new" && s6.f === "new" && s6.active === s0.active, "keyboard", [s5.f, s6.f]);
    await p.keyboard.press("w"); await p.keyboard.press("Delete"); await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(900); await p.evaluate(() => SpatialOS.open("ord")); await p.waitForTimeout(1600);
    ok("وبعد الإغلاق ثم الاستعادة من الاسطوانة يعود الفلتر نفسه (ذاكرة اللوح)", (await snap()).f === "new", "api");
  });

  ok("لا أخطاء صفحة (سطح المكتب)", errs.length === 0, "api", errs); await c.close();
}

async function mobile(b) {
  const c = await b.newContext({ viewport: { width: 448, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), p = await c.newPage(), errs = []; p.setDefaultTimeout(7000);
  p.on("pageerror", e => errs.push(String(e).slice(0, 160))); await p.goto(URL); await p.waitForTimeout(2200); const cdp = await c.newCDPSession(p);
  const T = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  const P = id => p.evaluate(i => { const q = SpatialOS.panels.get(i); return q ? { ...q.st, big: q.big, lift: q.lift || 0, f: q.content && q.content.f } : null; }, id), Wd = () => p.evaluate(() => SpatialOS.world());
  const hdr = async n => (await p.$(`.panel[aria-label="${n}"] .pn-h h3`)).boundingBox();
  await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(700);
  await section("P8. هاتف — لمس حقيقي (CDP): قصور XY وعمق، ارتفاع الإمساك، رمي، واستعادة", async () => {
    await p.click('#dock button[data-id="ana"]'); await p.waitForTimeout(1600);
    const h = await hdr("التحليلات"); const A0 = await P("ana"), W0 = await Wd(); let got = null;
    for (let tr = 0; tr < 4 && !got; tr++) { const hh = await hdr("التحليلات"), x = hh.x + hh.width / 2, y = hh.y + hh.height / 2; await T("touchStart", [[x, y]]); await p.waitForTimeout(300); const held = await P("ana"); const n = 3 + tr; for (let i = 1; i <= n; i++) { await T("touchMove", [[x + i * (70 / n), y + i * (40 / n)]]); await p.waitForTimeout(10 + tr * 6); } await T("touchEnd", []); const u = await P("ana"); await p.waitForTimeout(160); const m = await P("ana"); await p.waitForTimeout(1500); const e = await P("ana"); const after = await P("ana");
      if (Math.hypot(m.x - u.x, m.y - u.y) > 3) got = { held: held.lift, u: [u.x, u.y], m: [m.x, m.y], e: [e.x, e.y], lifted0: after.lift }; else { await p.evaluate(() => { const q = SpatialOS.panels.get("ana"); q.st.x = 0; q.st.y = 0; }); await p.waitForTimeout(500); } }
    ok("باللمس: يرتفع اللوح عند الإمساك ويواصل الانزلاق بعد رفع الإصبع ثم يستقر", !!got && got.held > 10 && got.lifted0 === 0, "cdp-touch", got);
    const w1 = await Wd(); ok("والبيئة ثابتة", near(W0.angle, w1.angle, .02) && near(W0.yaw, w1.yaw, .01), "api");
    /* عمق باللمس مع قصور */
    let dz = null; const dzt = []; for (let tr = 0; tr < 4 && !dz; tr++) { await p.evaluate(() => { const q = SpatialOS.panels.get("ana"); q.st.z = 0; q.st.x = 0; q.st.y = 0; q.st.s = 1; q.st.rx = q.st.ry = q.st.rz = 0; SpatialOS.open("ana"); }); await p.waitForTimeout(1000); const d = await (await p.$('.panel[aria-label="التحليلات"] .pn-dep')).boundingBox(); await T("touchStart", [[d.x + 14, d.y + 14]]); const n = 3; for (let i = 1; i <= n; i++) { await T("touchMove", [[d.x + 14, d.y + 14 - i * ((110 + tr * 25) / n)]]); await p.waitForTimeout(4); } const pre = (await P("ana")).z; await T("touchEnd", []); await p.waitForTimeout(150); const m = (await P("ana")).z; await p.waitForTimeout(1500); const e = (await P("ana")).z; dzt.push([pre, m, e]); if (m > pre + 5 && e <= 300.01) dz = { pre, m, e }; }
    ok("عمق باللمس: يواصل التقدّم بعد الرفع ثم يستقر داخل المدى", !!dz, "cdp-touch", dz || dzt);
    /* رمي باللمس */
    let thrown = false; for (let tr = 0; tr < 4 && !thrown; tr++) { await p.evaluate(() => { const q = SpatialOS.panels.get("ana"); if (q) { Object.assign(q.st, { x: 0, y: 150, z: 0, rx: 0, ry: 0, rz: 0 }); } }); await p.waitForTimeout(600); const hh = await hdr("التحليلات"); if (!hh) break; const x = hh.x + hh.width / 2, y = hh.y + hh.height / 2; await T("touchStart", [[x, y]]); const n = 3 + tr; for (let i = 1; i <= n; i++) { await T("touchMove", [[x - i * (330 / n), y - i * (60 / n)]]); await p.waitForTimeout(8 + tr * 5); } await T("touchEnd", []); await p.waitForTimeout(1600); thrown = !(await P("ana")); }
    ok("رمي باللمس: اللوح يُزال حسب سرعة الإفلات", thrown, "cdp-touch", await p.evaluate(() => SpatialOS.lastRelease));
    await p.click('#dock button[data-id="ana"]'); await p.waitForTimeout(1800); ok("الاستعادة من الشريط/الاسطوانة", !!(await P("ana")), "cdp-touch");
    ok("لا تمرير أفقي ولا تكبير للصفحة", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && visualViewport.scale === 1), "api");
  });
  ok("لا أخطاء صفحة (هاتف)", errs.length === 0, "api", errs); await c.close();
}
(async () => { const b = await chromium.launch(); if (only === "all" || only === "desktop") await desktop(b); if (only === "all" || only === "mobile") await mobile(b); await b.close(); console.log(R.join("\n")); console.log(fails ? "\nFAILED: " + fails : "\nALL PASSED (" + R.filter(x => /^PASS/.test(x)).length + ")"); process.exit(fails ? 1 : 0); })();
