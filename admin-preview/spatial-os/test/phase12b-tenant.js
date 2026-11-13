/* المرحلة 12B / WS3 — عزل المستأجرين بهجمات حقيقية على متجرَي PHP معزولين على نفس الخادم (نفس مسار الجلسات الافتراضي للنظام).
   متجر A ومتجر B تثبيتان مستقلان (قاعدة SQLite وملف إعداد وسرّ تثبيت لكل منهما). المهاجم مدير/موظف في A ويحاول الوصول إلى B بأي وسيلة.
   كل فحص يُجرى على HTTP حقيقي؛ لا محاكاة. بيانات اصطناعية فقط. التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/phase12b-tenant.js */
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process"); const { startStore } = require("./harness");
const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push({ n, pass: !!c, x }); console.log((c ? "PASS " : "FAIL ") + n + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 220) : "")); };
const XH = { "X-Requested-With": "XMLHttpRequest" };
const H = (c, extra) => Object.assign({ "Content-Type": "application/json" }, XH, c ? { Cookie: c } : {}, extra || {});
const api = async (st, r, o = {}) => { const x = await fetch(st.base + "/api/index.php?r=" + r, { method: o.method || "GET", headers: H(o.cookie, o.headers), body: o.body ? JSON.stringify(o.body) : undefined }); let j = null; try { j = await x.json(); } catch (_) { } return { s: x.status, j }; };
const page = async (st, p, cookie) => { const x = await fetch(st.base + p, { headers: cookie ? { Cookie: cookie } : {}, method: "GET" }); return { s: x.status, t: (await x.text()).slice(0, 400) }; };
const POST = async (st, p, body, cookie, extra) => { const x = await fetch(st.base + p, { method: "POST", headers: H(cookie, extra), body: JSON.stringify(body) }); let j = null; const t = await x.text(); try { j = JSON.parse(t); } catch (_) { } return { s: x.status, j, t: t.slice(0, 200) }; };
const login = async (st, body) => { const r = await fetch(st.base + "/api/index.php?r=login", { method: "POST", headers: H(), body: JSON.stringify(body) }); return { s: r.status, cookie: (r.headers.getSetCookie() || []).map(c => c.split(";")[0]).join("; ") }; };
const mkStaff = (st, user, perms) => api(st, "team", { method: "POST", cookie: st.cookie, body: { action: "create", user, name: user, role: "agent", perms, password: "StaffPass12345" } });
(async () => {
  let A = null, B = null; const t0 = Date.now();
  try {
    A = await startStore({ stock: true }); B = await startStore({ stock: true, orders: [] });
    const phpSess = execFileSync("php", ["-r", 'echo ini_get("session.save_path") ?: sys_get_temp_dir();'], { encoding: "utf8" });
    ok("الشرط التجريبي: المتجران على نفس خادم PHP ومسار الجلسات العام للنظام مشترك (" + phpSess + ")", A.dir !== B.dir && A.base !== B.base, { A: A.port, B: B.port });
    /* ملاحظة: لا ندّعي أن الإصلاح يحمي من مهاجم يملك ملفات الخادم؛ النطاق = مهاجم مدير/موظف في تثبيت ويستعمل HTTP */
    const own = await api(A, "orders", { cookie: A.cookie }); ok("الأساس: مدير A يصل لبيانات A (200 ومعه طلبات)", own.s === 200 && (own.j.orders || []).length > 0, { n: (own.j.orders || []).length });
    const staffMk = (await mkStaff(A, "shared_user", ["orders", "orders.write", "customers", "products"])).s; await mkStaff(B, "shared_user", ["orders"]);   // نفس اسم المستخدم في المتجرين
    const sA = await login(A, { user: "shared_user", password: "StaffPass12345" }), sB = await login(B, { user: "shared_user", password: "StaffPass12345" });
    ok("الأساس: موظف بنفس الاسم في المتجرين يدخل كلّاً منهما بكوكيه الخاص", staffMk === 200 && sA.s === 200 && sB.s === 200 && sA.cookie && sB.cookie, { a: sA.s, b: sB.s });
    /* 1) كوكي مدير A على كل مسارات B */
    const routes = ["orders", "orders_page", "orders_stats", "team", "kv&k=guard", "file&path=assets/js/data.js", "audit", "customers"];
    const cross = []; for (const r of routes) { const x = await api(B, r, { cookie: A.cookie }); cross.push([r, x.s]); }
    ok("مدير A: كل مسارات الإدارة في B ترفضه (401/403/404/405، لا 200)", cross.every(([, s]) => s !== 200), cross);
    const w = await POST(B, "/api/index.php?r=order_update", { id: (own.j.orders[0] || {}).id, status: "confirmee" }, A.cookie);
    ok("مدير A: لا يستطيع كتابة/تعديل طلب في B (order_update)", w.s === 401 || w.s === 403, { s: w.s });
    const mk = await POST(B, "/api/index.php?r=team", { action: "create", user: "evil", name: "evil", role: "admin", perms: ["*"], password: "StaffPass12345" }, A.cookie);
    ok("مدير A: لا يستطيع إنشاء موظف/مدير في B", mk.s === 401 || mk.s === 403, { s: mk.s });
    /* 2) كوكي موظف A (باسم مشترك) على B */
    const sx = []; for (const r of ["orders", "orders_page", "orders_stats"]) { const x = await api(B, r, { cookie: sA.cookie }); sx.push([r, x.s]); }
    ok("موظف A بنفس اسم موظف في B: كوكيه لا يُقبل في B", sx.every(([, s]) => s === 401), sx);
    const sxb = await api(A, "orders", { cookie: sB.cookie }); ok("وبالعكس: كوكي موظف B لا يُقبل في A", sxb.s === 401, { s: sxb.s });
    /* 3) update.php وllm.php بجلسة A على B */
    const up = await page(B, "/update.php", A.cookie), llm = await POST(B, "/admin-preview/spatial-os/server/llm.php", { action: "caps" }, A.cookie);
    ok("update.php في B يرفض جلسة مدير A (401)", up.s === 401, { s: up.s });
    ok("وسيط الذكاء في B يرفض جلسة مدير A (401)", llm.s === 401, { s: llm.s });
    const llmOwn = await POST(A, "/admin-preview/spatial-os/server/llm.php", { action: "caps" }, A.cookie); ok("الأساس: وسيط الذكاء في A يقبل جلسة A (ليس 401)", llmOwn.s !== 401, { s: llmOwn.s });
    /* 4) جلسة مزوَّرة في المسار العام القديم (قبل الإصلاح كان هذا هو المسار الفعلي للجلسات) */
    const forged = "f0rged" + require("crypto").randomBytes(10).toString("hex"); const legacyDir = phpSess.trim() || "/tmp"; let wrote = false;
    try { fs.writeFileSync(path.join(legacyDir, "sess_" + forged), 'admin|b:1;'); wrote = true; } catch (_) { }
    const fr = await api(B, "orders", { cookie: "store_admin=" + forged });
    ok("جلسة مدير مزوَّرة في مسار الجلسات العام القديم لا تمنح صلاحية في B" + (wrote ? "" : " (تعذّرت كتابة الملف: الفحص بلا ملف)"), fr.s === 401, { s: fr.s, wrote }); try { fs.unlinkSync(path.join(legacyDir, "sess_" + forged)); } catch (_) { }
    /* 5) جلسة في مسار B الخاص بلا ختم التثبيت (جلسة قديمة/منقولة) تُبطَل */
    const privDir = path.join(B.dir, "api", "_data", "sessions"), exists = fs.existsSync(privDir); const forged2 = "n0stamp" + require("crypto").randomBytes(10).toString("hex");
    if (exists) fs.writeFileSync(path.join(privDir, "sess_" + forged2), 'admin|b:1;'); const nr = await api(B, "orders", { cookie: "store_admin=" + forged2 });
    ok("جلسة بلا ختم تثبيت داخل مجلد B الخاص تُبطَل (لا صلاحية)", exists && nr.s === 401, { dir_exists: exists, s: nr.s });
    /* 6) ختم تثبيت آخر (جلسة منسوخة من تثبيت آخر) */
    const aSess = fs.readdirSync(path.join(A.dir, "api", "_data", "sessions")).filter(f => f.startsWith("sess_")); let cp = null;
    if (aSess.length) { const sid = aSess[0].replace("sess_", ""); fs.copyFileSync(path.join(A.dir, "api", "_data", "sessions", aSess[0]), path.join(privDir, "sess_" + sid)); cp = await api(B, "orders", { cookie: "store_admin=" + sid }); }
    ok("ملف جلسة مدير منسوخ حرفياً من A إلى مجلد جلسات B (ختم تثبيت A) لا يمنح صلاحية", cp && cp.s === 401, { s: cp && cp.s, files: aSess.length });
    /* 7) تدوير سرّ التثبيت يُبطل الجلسات */
    const bOwn1 = await api(B, "orders", { cookie: B.cookie }); fs.writeFileSync(path.join(B.dir, "api", "_data", "inst.key"), "rotated" + Math.random()); const bOwn2 = await api(B, "orders", { cookie: B.cookie });
    ok("تدوير سرّ التثبيت يُبطل جلسات المدير القائمة (إعادة دخول)", bOwn1.s === 200 && bOwn2.s === 401, { before: bOwn1.s, after: bOwn2.s });
    /* 8) أذونات المجلد الخاص */
    const mode = (fs.statSync(path.join(A.dir, "api", "_data", "sessions")).mode & 0o777).toString(8); ok("مجلد جلسات التثبيت بصلاحية 700 (لا قراءة/كتابة لغير المالك)", mode === "700", { mode });
    /* 9) معرّفات عبر المتاجر: طلب A في B */
    const aid = (own.j.orders[0] || {}).id; await login(B, { password: B.pw }); const bAdmin = (await login(B, { password: B.pw })).cookie, look = await api(B, "orders_page&id=" + encodeURIComponent(aid), { cookie: bAdmin }), upd = await POST(B, "/api/index.php?r=order_update", { id: aid, status: "annulee" }, bAdmin);
    ok("مدير B الشرعي لا يرى ولا يعدّل طلب A بمعرّفه (لا وجود له في B)", look.s === 200 && (look.j.orders || []).length === 0 && (upd.s === 404 || (upd.j && upd.j.ok !== true)), { page_n: (look.j.orders || []).length, upd: upd.s });
    const stillA = await api(A, "orders", { cookie: A.cookie }); ok("طلبات A لم تتغيّر بعد كل الهجمات (حالاتها كما كانت)", (stillA.j.orders || []).every((o, i) => o.status === own.j.orders[i].status), { n: stillA.j.orders.length });
    /* 10) رموز الزبائن */
    const reg = await POST(A, "/api/index.php?r=customer_register", { phone: "0550111222", name: "زبون A", password: "Pass12345" }); const tok = reg.j && reg.j.token;
    const meB = await POST(B, "/api/index.php?r=customer_me", { token: tok }), meA = await POST(A, "/api/index.php?r=customer_me", { token: tok });
    ok("رمز زبون A لا يُقبل في B (401)، ويُقبل في A", reg.s === 200 && meB.s === 401 && meA.s === 200, { b: meB.s, a: meA.s });
    /* 11) تسلسل الجلسة الثابتة (session fixation) */
    const fix = "fixedbyattacker1234567890abcdef12"; const f1 = await fetch(A.base + "/api/index.php?r=login", { method: "POST", headers: H("store_admin=" + fix), body: JSON.stringify({ password: A.pw }) }); const sc = (f1.headers.getSetCookie() || []).map(c => c.split(";")[0]).join("; ");
    ok("تثبيت الجلسة: معرّف جلسة يفرضه المهاجم لا يُعتمد بعد الدخول (strict mode يستبدله)", f1.status === 200 && !sc.includes(fix), { set_cookie_has_fixed: sc.includes(fix) });
  } catch (e) { fails++; console.log("HARNESS ERROR", String(e.stack || e).slice(0, 600)); }
  finally { if (A) A.stop(); if (B) B.stop(); }
  const out = { phase: "12B", workstream: "WS3-php", date: new Date().toISOString().slice(0, 10), isolation: "متجرا PHP محليان معزولان على نفس الخادم؛ بيانات اصطناعية", pass: R.filter(r => r.pass).length, fail: R.filter(r => !r.pass).length, duration_s: Math.round((Date.now() - t0) / 1000), results: R };
  fs.writeFileSync(path.join(__dirname, "phase12b-tenant-result.json"), JSON.stringify(out, null, 1)); console.log("\nPASS " + out.pass + " · FAIL " + out.fail); process.exit(fails ? 1 : 0);
})();
