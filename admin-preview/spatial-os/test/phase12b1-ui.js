/* المرحلة 12B.1 — اختبار المتصفح الحقيقي لصدق الإرسال: متجر PHP حقيقي معزول (harness) + شيفرة المتجر الحقيقية (app.js/api.js)،
   والمحاكى فقط: الأعطال المحقونة عبر page.route على مسار الطلب (500/ردّ ناقص/ok:false/انقطاع/«حُفظ ثم ضاع الردّ») و window.open (لالتقاط واتساب).
   يتحقق من قاعدة البيانات الحقيقية بعد كل سيناريو (عدد الطلبات والمعرّف). بيانات تركيبية فقط.
   التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/phase12b1-ui.js */
const fs = require("fs"), path = require("path"); const { chromium } = require("playwright"); const { startStore } = require("./harness");
let fails = 0, n = 0; const R = []; const ok = (name, c, x) => { n++; if (!c) fails++; R.push({ n: name, pass: !!c, x }); console.log((c ? "PASS " : "FAIL ") + name + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 220) : "")); };
const ORD = /[?&]r=order(&|$)/;
(async () => {
  const st = await startStore({ stock: true, orders: [], env: { PHP_CLI_SERVER_WORKERS: "4" } }); const br = await chromium.launch({ args: ["--no-sandbox"] });
  const dbOrders = async () => (await (await fetch(st.base + "/api/index.php?r=orders", { headers: { Cookie: st.cookie, "X-Requested-With": "XMLHttpRequest" } })).json()).orders || [];
  async function mk(surface) {
    const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }), p = await ctx.newPage(), errs = [], opens = [], posts = [];
    p.on("pageerror", e => errs.push(String(e).slice(0, 160))); p.on("request", r => { if (ORD.test(r.url()) && r.method() === "POST") { try { posts.push(JSON.parse(r.postData() || "{}")); } catch (e) { posts.push({}); } } });
    await p.addInitScript(() => { window.__opens = []; window.open = function (u) { window.__opens.push(String(u || "")); const loc = {}; Object.defineProperty(loc, "href", { set(v) { window.__opens.push(String(v)); }, get() { return ""; } }); return { close() { }, closed: false, location: loc }; }; });
    await p.goto(st.base + surface); await p.waitForTimeout(800); return { ctx, p, errs, opens, posts };
  }
  const fillCart = async (p, phone) => { await p.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) { } }); await p.evaluate(() => { Cart.add("tarkiz", 1, 1800); }); await p.evaluate(ph => { document.getElementById("cname").value = "ليلى بن عمر"; document.getElementById("cphone").value = ph; const w = document.getElementById("cwilaya"); w.selectedIndex = 16; w.dispatchEvent(new Event("change", { bubbles: true })); const c = document.getElementById("ccommune"); if (c.tagName === "SELECT") { c.selectedIndex = Math.min(2, c.options.length - 1); c.dispatchEvent(new Event("change", { bubbles: true })); } else c.value = "الحراش"; window.__c = c.value; }, phone); await p.waitForTimeout(100); };
  const click = p => p.evaluate(() => { const b = document.querySelector(".btn-order"); b.click(); });
  const state = p => p.evaluate(() => { const t = document.getElementById("thx"); return { has: !!t, st: t && t.dataset.state || "", text: t ? t.innerText : "", oid: t && t.querySelector("[data-oid]") ? t.querySelector("[data-oid]").textContent : "", waLinks: t ? [...t.querySelectorAll("a[href*='wa.me']")].map(a => ({ h: a.href, t: a.innerText })) : [], role: t && t.getAttribute("role") }; });
  const wa = p => p.evaluate(() => window.__opens.filter(u => /wa\.me/.test(u)));
  const form = p => p.evaluate(() => ({ n: document.getElementById("cname").value, ph: document.getElementById("cphone").value, w: document.getElementById("cwilaya").value, c: document.getElementById("ccommune").value, c0: window.__c, cart: Cart.all().length }));
  const settle = async (p, ms) => { await p.waitForFunction(() => document.getElementById("thx") || document.querySelector("#toast.show,.toast.show"), null, { timeout: ms || 20000 }).catch(() => { }); await p.waitForTimeout(300); };
  const marker = p => p.evaluate(() => { try { return localStorage.getItem("alyssum_recent_orders"); } catch (e) { return "?"; } });
  let base0 = (await dbOrders()).length;

  /* ── U1: نجاح حقيقي ── */
  { const { ctx, p, errs, posts } = await mk("/index.html"); await fillCart(p, "0550000101"); await click(p); await settle(p); const s = await state(p), db = await dbOrders(), mine = db.filter(o => o.phone === "0550000101");
    ok("[U1] نجاح حقيقي: نافذة الشكر تعرض معرّف الخادم الحقيقي نفسه الموجود في القاعدة", s.has && s.st !== "UNKNOWN" && mine.length === 1 && s.oid === mine[0].id && /تم تسجيل طلبك/.test(s.text), { oid: s.oid, db: mine.map(o => o.id) });
    ok("[U1] واتساب يُفتح بعد التأكيد ويحوي رقم الطلب الحقيقي", (await wa(p)).some(u => decodeURIComponent(u).indexOf(mine[0].id) > -1), await wa(p));
    ok("[U1] المفتاح أُرسل في الحمولة وبصيغة آمنة (32 hex) ولا PII فيه", posts.length >= 1 && /^[0-9a-f]{32}$/.test(posts[0].order.idem || ""), { k: posts[0] && posts[0].order.idem });
    ok("[U1] لا أخطاء JS", errs.length === 0, errs); await ctx.close(); base0 = db.length; }

  /* ── سيناريوهات الفشل ── */
  const fail = async (label, phone, handler, expect) => { const { ctx, p, errs, posts } = await mk("/index.html"); await p.route(ORD, handler); await fillCart(p, phone); const before = (await dbOrders()).length; await click(p); await settle(p, 30000); const s = await state(p), f = await form(p), after = await dbOrders(), toast = await p.evaluate(() => (document.querySelector("#toast")||{}).innerText || "");
    const noSucc = !/تم تسجيل طلبك|شكراً لك|رقم طلبك:/.test(s.text + "") && !(s.has && s.st === "");
    ok("[" + label + "] لا رسالة نجاح كاذبة", noSucc, { st: s.st, text: s.text.slice(0, 80), toast: toast.slice(0, 80) });
    ok("[" + label + "] الحالة المعروضة = " + expect, expect === "REJECTED" ? (!s.has && /./.test(toast)) : (s.has && s.st === expect && s.role === "alertdialog"), { st: s.st, has: s.has });
    ok("[" + label + "] بيانات النموذج والسلة محفوظة كما هي", f.n === "ليلى بن عمر" && f.ph === phone && f.c === f.c0 && f.c !== "" && f.w !== "" && f.cart === 1, f);
    ok("[" + label + "] لا واتساب تلقائي بعنوان نجاح (لا wa.me عند الفشل)", (await wa(p)).length === 0, await wa(p));
    ok("[" + label + "] لا علامة طلب محلي ولا طلب جديد في القاعدة", (await marker(p)) === null && after.length === before, { marker: await marker(p), delta: after.length - before });
    ok("[" + label + "] لا أخطاء JS", errs.length === 0, errs); return { ctx, p, s, posts, errs }; };
  { const r = await fail("U2 HTTP 500", "0550000102", rt => rt.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "server_error" }) }), "SERVER_ERROR");
    const w = r.s.waLinks[0]; ok("[U2] زر واتساب في نافذة الفشل موسوم «رسالة فقط» ولا يزعم الحفظ", !!w && /رسالة فقط/.test(r.s.text) && !/تم تسجيل/.test(w.t) && /wa\.me/.test(w.h), w);
    ok("[U2] نص النافذة يقول «لم يُؤكَّد» ويطمئن بالنموذج ولا يطلب طلباً جديداً", /لم يُؤكَّد/.test(r.s.text) && /محفوظة/.test(r.s.text), r.s.text.slice(0, 160)); ok("[U2] 3 محاولات تلقائية بمفتاح واحد", r.posts.length === 3 && new Set(r.posts.map(x => x.order.idem)).size === 1, r.posts.length); await r.ctx.close(); }
  { const r = await fail("U3 200 بلا معرّف", "0550000103", rt => rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }), "INVALID_RESPONSE"); await r.ctx.close(); }
  { const r = await fail("U4 200 جسم فارغ", "0550000104", rt => rt.fulfill({ status: 200, body: "" }), "INVALID_RESPONSE"); await r.ctx.close(); }
  { const r = await fail("U5 200 JSON تالف", "0550000105", rt => rt.fulfill({ status: 200, contentType: "application/json", body: "{oops" }), "INVALID_RESPONSE"); await r.ctx.close(); }
  { const r = await fail("U6 200 ok:false", "0550000106", rt => rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, error: "invalid_phone" }) }), "REJECTED"); await r.ctx.close(); }
  { const r = await fail("U7 HTTP 422", "0550000107", rt => rt.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: "invalid_name" }) }), "REJECTED"); await r.ctx.close(); }
  { const r = await fail("U8 HTTP 429", "0550000108", rt => rt.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "rate_limited" }) }), "REJECTED"); await r.ctx.close(); }
  { const r = await fail("U9 انقطاع الشبكة", "0550000109", rt => rt.abort("failed"), "UNKNOWN"); ok("[U9] رسالة UNKNOWN تقول إن التأكيد تعذّر وتنهى عن إرسال طلب جديد", /لا ترسل طلباً جديداً/.test(r.s.text), r.s.text.slice(0, 200)); await r.ctx.close(); }

  /* ── U10: UNKNOWN ثم إعادة المحاولة بنفس المفتاح ← نجاح واحد فقط ── */
  { const { ctx, p, posts, errs } = await mk("/index.html"); let down = true; await p.route(ORD, rt => down ? rt.abort("failed") : rt.continue()); await fillCart(p, "0550000110"); await click(p); await settle(p, 30000); const s1 = await state(p); const k1 = new Set(posts.map(x => x.order.idem));
    down = false; await p.evaluate(() => document.getElementById("thx-retry").click()); await settle(p, 20000); await p.waitForFunction(() => { const t = document.getElementById("thx"); return t && !t.dataset.state; }, null, { timeout: 15000 }).catch(() => { }); const s2 = await state(p), mine = (await dbOrders()).filter(o => o.phone === "0550000110"), allK = new Set(posts.map(x => x.order.idem));
    ok("[U10] بعد UNKNOWN: إعادة المحاولة اليدوية بنفس المفتاح تنجح بطلب واحد فقط في القاعدة", s1.st === "UNKNOWN" && k1.size === 1 && allK.size === 1 && mine.length === 1 && s2.oid === mine[0].id, { k: allK.size, db: mine.length, oid: s2.oid });
    ok("[U10] لا واتساب بعنوان نجاح قبل التأكيد؛ يُفتح بعده فقط", (await wa(p)).length === 1, await wa(p)); ok("[U10] لا أخطاء JS", errs.length === 0, errs); await ctx.close(); }

  /* ── U11: «حُفظ ثم ضاع الردّ»: الخادم الحقيقي يحفظ ثم نقطع الاستجابة ── */
  { const { ctx, p, posts, errs } = await mk("/index.html"); let drop = true; await p.route(ORD, async rt => { if (!drop) return rt.continue(); try { await rt.fetch(); } catch (e) { } await rt.abort("failed"); }); await fillCart(p, "0550000111"); await click(p); await settle(p, 30000); const s1 = await state(p), mid = (await dbOrders()).filter(o => o.phone === "0550000111");
    ok("[U11] حُفظ على الخادم لكن الردّ ضاع ← الواجهة UNKNOWN (لا نجاح كاذب) والخادم أنشأ طلباً واحداً بعد 3 محاولات بنفس المفتاح", s1.st === "UNKNOWN" && mid.length === 1 && posts.length === 3 && new Set(posts.map(x => x.order.idem)).size === 1, { posts: posts.length, db: mid.length });
    drop = false; await p.evaluate(() => document.getElementById("thx-retry").click()); await p.waitForFunction(() => { const t = document.getElementById("thx"); return t && !t.dataset.state; }, null, { timeout: 15000 }).catch(() => { }); const s2 = await state(p), fin = (await dbOrders()).filter(o => o.phone === "0550000111");
    ok("[U11] إعادة المحاولة بعد ضياع الردّ ← «سبق تسجيله» بمعرّف الطلب الأصلي نفسه وبلا طلب مكرَّر", fin.length === 1 && s2.oid === mid[0].id && /سبق تسجيله/.test(s2.text), { oid: s2.oid, orig: mid[0].id, db: fin.length, text: s2.text.slice(0, 120) });
    ok("[U11] لا أخطاء JS", errs.length === 0, errs); await ctx.close(); }

  /* ── U12: تغيّر المحتوى بعد UNKNOWN ← مفتاح جديد (لا يُعاد استعمال مفتاح طلب مختلف) ── */
  { const { ctx, p, posts } = await mk("/index.html"); let down = true; await p.route(ORD, rt => down ? rt.abort("failed") : rt.continue()); await fillCart(p, "0550000112"); await click(p); await settle(p, 30000); const k1 = posts[0].order.idem; await p.evaluate(() => document.getElementById("thx-x").click());
    await p.evaluate(() => { Cart.add("tarkiz", 1, 1800); }); down = false; const before = posts.length; await click(p); await p.waitForFunction(() => { const t = document.getElementById("thx"); return t && !t.dataset.state; }, null, { timeout: 15000 }).catch(() => { }); const k2 = posts[before].order.idem; const mine = (await dbOrders()).filter(o => o.phone === "0550000112");
    ok("[U12] تغيير الكمية بعد UNKNOWN ← مفتاح جديد وطلب جديد (الأول لم يُحفظ)", k1 !== k2 && mine.length === 1 && mine[0].total > 0, { same: k1 === k2, db: mine.length }); await ctx.close(); }

  /* ── U13: صفحة المنتج (مسار مستقل) ── */
  { const { ctx, p, errs, posts } = await mk("/p/demo/"); const has = await p.evaluate(() => !!document.getElementById("order-form"));
    if (!has) ok("[U13] صفحة المنتج: النموذج غير موجود في حزمة الاختبار", false, "NOT TESTED");
    else { await p.route(ORD, rt => rt.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "busy" }) }));
      const sel = await p.evaluate(() => { const f = document.getElementById("order-form"); return { w: [...f.querySelectorAll("select")].map(s => s.id || s.name), i: [...f.querySelectorAll("input")].map(s => s.id || s.name) }; });
      await p.evaluate(() => { const f = document.getElementById("order-form"); const set = (sel, v) => { const e = f.querySelector(sel); if (e) { e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); } }; set("#name", "ليلى بن عمر"); set("#phone", "0550000113"); const w = f.querySelector("#wilaya"); if (w) { w.selectedIndex = 16; w.dispatchEvent(new Event("change", { bubbles: true })); } const c = f.querySelector("#commune"); if (c && c.tagName === "SELECT") { c.selectedIndex = Math.min(2, c.options.length - 1); c.dispatchEvent(new Event("change", { bubbles: true })); } else if (c) c.value = "الحراش"; });
      const before = (await dbOrders()).length; await p.evaluate(() => document.getElementById("order-form").requestSubmit()); await settle(p, 30000); const s = await state(p);
      ok("[U13] صفحة المنتج: 503 ← نافذة SERVER_ERROR بلا نجاح كاذب، ولا طلب في القاعدة", s.has && s.st === "SERVER_ERROR" && !/تم تسجيل طلبك/.test(s.text) && (await dbOrders()).length === before && (await wa(p)).length === 0, { st: s.st, fields: sel });
      ok("[U13] بيانات نموذج الصفحة باقية", await p.evaluate(() => document.querySelector("#order-form #name").value === "ليلى بن عمر" && document.querySelector("#order-form #phone").value === "0550000113"));
      await p.unroute(ORD); await p.evaluate(() => document.getElementById("thx-retry").click()); await p.waitForFunction(() => { const t = document.getElementById("thx"); return t && !t.dataset.state; }, null, { timeout: 20000 }).catch(() => { }); const s2 = await state(p), mine = (await dbOrders()).filter(o => o.phone === "0550000113");
      ok("[U13] صفحة المنتج: إعادة المحاولة ← نجاح بمعرّف الخادم وبطلب واحد", mine.length === 1 && s2.oid === mine[0].id, { oid: s2.oid, db: mine.length }); ok("[U13] لا أخطاء JS", errs.length === 0, errs); }
    await ctx.close(); }

  const out = { phase: "12B.1", suite: "ui-real-browser", date: new Date().toISOString().slice(0, 10), store: "PHP حقيقي معزول (harness)", mocked: "الأعطال المحقونة بـ page.route + window.open فقط", pass: R.filter(r => r.pass).length, fail: R.filter(r => !r.pass).length, results: R };
  fs.writeFileSync(path.join(__dirname, "phase12b1-ui-result.json"), JSON.stringify(out, null, 1)); await br.close(); st.stop(); console.log(fails ? "FAILED " + fails + "/" + n : "ALL PASS " + n + "/" + n); process.exit(fails ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(2); });
