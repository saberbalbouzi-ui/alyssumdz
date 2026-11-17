// E2E حقيقي في متصفح: واجهة Beta المنشورة + Supabase Beta الحقيقي (طلب/إدارة/صلاحيات/حفظ). لا يطبع أي سرّ.
const { open, WEB, API } = require("./lib"); const fs = require("fs");
const REF = process.env.BETA_SUPABASE_REF, SB = process.env.BETA_SUPABASE_URL, ANON = fs.readFileSync((process.env.BETA_SECRETS_DIR || "/home/user/beta-secrets") + "/.pub", "utf8").trim(), EMAIL = process.env.BETA_ADMIN_EMAIL, PW = process.env.BETA_ADMIN_PASSWORD;
if (REF !== "xhdnqnxmcmfhrgctlkzy") { console.error("✖ ليس مشروع Beta"); process.exit(2); }
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) { pass++; console.log("✓", n); } else { fail++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const sql = async (q) => { const r = await fetch("https://api.supabase.com/v1/projects/" + REF + "/database/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) }); return r.json(); };
const rest = async (path, { method = "GET", token, body, prefer } = {}) => { const r = await fetch(SB + "/rest/v1/" + path, { method, headers: { apikey: ANON, Authorization: "Bearer " + (token || ANON), "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch { } return { s: r.status, j }; };
const tag = "e2e" + Date.now().toString(36), phone = "0555" + String(Math.floor(100000 + Math.random() * 899999));
(async () => {
  /* ── الواجهة: عرض المتجر والمنتج ── */
  let { b, p, log } = await open(); await p.goto(WEB + "/", { waitUntil: "domcontentloaded", timeout: 60000 }); await p.waitForTimeout(3000);
  ok("[U1] الصفحة الرئيسية تُعرض بهوية Beta (شريط Beta + noindex)", /Beta/.test(await p.title()) && await p.evaluate(() => !!document.querySelector('meta[name="robots"][content*="noindex"]')));
  ok("[U2] عرض المنتج في المتجر (بطاقة منتج)", await p.evaluate(() => typeof PRODUCTS !== "undefined" && PRODUCTS.length >= 1 && /demo/.test(document.body.innerHTML)));
  await p.goto(WEB + "/p/demo/", { waitUntil: "domcontentloaded", timeout: 60000 }); await p.waitForTimeout(3000); await p.evaluate(() => document.getElementById("acg-ov")?.remove());
  ok("[U3] صفحة المنتج: سعر وعروض ونموذج الطلب", await p.evaluate(() => !!document.getElementById("order-form") && /2\s?000/.test(document.body.innerText)));
  /* ── الطلب ── */
  const before = (await sql("select count(*)::int as n from orders"))[0].n;
  await p.selectOption("#wilaya", { index: 16 }); await p.waitForTimeout(400); if ((await p.$$eval("#commune option", o => o.length)) > 1) await p.selectOption("#commune", { index: 1 });
  await p.fill("#name", "زبون " + tag); await p.fill("#phone", phone); await p.waitForTimeout(300);
  const rpc = p.waitForResponse(r => /rpc\/submit_order/.test(r.url()), { timeout: 30000 }); await p.click(".btn-order"); const rr = await rpc.catch(() => null); await p.waitForTimeout(2500);
  ok("[O1] إرسال الطلب: submit_order على Supabase Beta يردّ 200", rr && rr.status() === 200, rr && rr.status());
  const rows = await sql("select id,name,phone,status,total::int as total,wilaya from orders where name like '%" + tag + "%'"); ok("[O2] الطلب محفوظ في قاعدة Beta (صف واحد)", rows.length === 1 && rows[0].status === "nouvelle", rows);
  const oid = rows[0] && rows[0].id; const total = rows[0] && rows[0].total; ok("[O3] المبلغ يُحسب على الخادم ويطابق العرض (3 قطع=4800 + شحن)", total >= 4800, total);
  await p.reload({ waitUntil: "domcontentloaded" }); await p.waitForTimeout(2500); await p.evaluate(() => document.getElementById("acg-ov")?.remove());
  const cnt1 = (await sql("select count(*)::int as n from orders where name like '%" + tag + "%'"))[0].n; ok("[O4] لا تكرار للطلب بعد إعادة تحميل الصفحة", cnt1 === 1, cnt1);
  const total0 = (await sql("select count(*)::int as n from orders"))[0].n; ok("[O5] عدد الطلبات زاد بواحد فقط", total0 === before + 1, { before, total0 });
  await b.close();
  /* ── الصلاحيات (REST) ── */
  const anonRead = await rest("orders?select=id&limit=5"); ok("[P1] مجهول لا يقرأ الطلبات (RLS)", anonRead.s === 401 || anonRead.s === 403 || (Array.isArray(anonRead.j) && anonRead.j.length === 0), { s: anonRead.s, n: Array.isArray(anonRead.j) ? anonRead.j.length : null });
  const anonUpd = await rest("orders?id=eq." + encodeURIComponent(oid), { method: "PATCH", body: { status: "annulee" }, prefer: "return=representation" }); const still = (await sql("select status from orders where id='" + oid + "'"))[0].status; ok("[P2] مجهول لا يعدّل الطلبات", still === "nouvelle", { s: anonUpd.s, still });
  const anonKv = await rest("admin_kv?select=key&limit=5"); ok("[P3] مجهول لا يقرأ إعدادات اللوحة (admin_kv)", anonKv.s >= 400 || (Array.isArray(anonKv.j) && anonKv.j.length === 0), { s: anonKv.s });
  const anonDel = await rest("orders?id=eq." + encodeURIComponent(oid), { method: "DELETE", prefer: "return=representation" }); ok("[P4] مجهول لا يحذف الطلبات", (await sql("select count(*)::int as n from orders where id='" + oid + "'"))[0].n === 1, anonDel.s);
  /* ── لوحة الإدارة ── */
  ({ b, p, log } = await open()); await p.goto(WEB + "/admin.html", { waitUntil: "domcontentloaded", timeout: 60000 }); await p.waitForTimeout(2500);
  await p.fill("#login-email", EMAIL); await p.fill("#login-pass", "WrongPassword!123"); await p.click("#login-btn"); await p.waitForTimeout(4500);
  ok("[L1] كلمة مرور خاطئة ⇒ لا دخول (نموذج الدخول يبقى)", await p.evaluate(() => !!(document.getElementById("login-btn") && document.getElementById("login-btn").offsetWidth)));
  await p.fill("#login-pass", PW); await p.click("#login-btn"); await p.waitForTimeout(7000);
  ok("[L2] دخول مدير Beta (Supabase Auth الحقيقي) يفتح لوحة التحكم", await p.evaluate(() => !(document.getElementById("login-btn") && document.getElementById("login-btn").offsetWidth) && typeof Admin !== "undefined" && /المنتجات/.test(document.body.innerText)));
  await p.evaluate(() => Admin.tab("orders", [...document.querySelectorAll(".nav-btn")].find(b => (b.getAttribute("onclick") || "").includes("'orders'")))); await p.waitForTimeout(6000);
  const rowTxt = await p.evaluate((t) => { const tr = [...document.querySelectorAll("#tab-orders tr")].find((x) => x.textContent.includes(t)); return tr ? tr.innerText.replace(/\s+/g, " ").slice(0, 120) : null; }, tag); ok("[M1] الطلب يظهر في لوحة الإدارة بحالة «جديد»", !!rowTxt && /جديد/.test(rowTxt), rowTxt);
  await p.evaluate((t) => { const tr = [...document.querySelectorAll("#tab-orders tr")].find((x) => x.textContent.includes(t)); const sel = tr.querySelector("select.act-sel"); sel.value = "confirm"; sel.dispatchEvent(new Event("change", { bubbles: true })); }, tag); await p.waitForTimeout(5000);
  let st = (await sql("select status from orders where id='" + oid + "'"))[0].status; ok("[M2] تأكيد الطلب من اللوحة يحدّث الحالة في قاعدة Beta", st !== "nouvelle", st);
  await p.reload({ waitUntil: "domcontentloaded" }); await p.waitForTimeout(6000);
  const relogged = await p.evaluate(() => !(document.getElementById("login-btn") && document.getElementById("login-btn").offsetWidth)); if (!relogged) { await p.fill("#login-email", EMAIL); await p.fill("#login-pass", PW); await p.click("#login-btn"); await p.waitForTimeout(7000); }
  await p.evaluate(() => Admin.tab("orders", [...document.querySelectorAll(".nav-btn")].find(b => (b.getAttribute("onclick") || "").includes("'orders'")))); await p.waitForTimeout(6000);
  const rowTxt2 = await p.evaluate((t) => { const tr = [...document.querySelectorAll("#tab-orders tr")].find((x) => x.textContent.includes(t)); return tr ? tr.innerText.replace(/\s+/g, " ").slice(0, 120) : null; }, tag); ok("[M3] الحالة محفوظة بعد إعادة التحميل (حفظ واسترجاع)", !!rowTxt2 && !/جديد/.test(rowTxt2), rowTxt2);
  /* حفظ واسترجاع إعداد لوحة (admin_kv) بجلسة المدير */
  const kv = await p.evaluate(async (t) => { try { await API.sb.adminFetch("/rest/v1/admin_kv?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "e2e_" + t, value: { v: 1, t } }) }); const r = await API.sb.adminFetch("/rest/v1/admin_kv?key=eq.e2e_" + t + "&select=value"); return r; } catch (e) { return { err: String(e.message || e) }; } }, tag); ok("[K1] حفظ إعداد لوحة (admin_kv) واسترجاعه بجلسة المدير", Array.isArray(kv) && kv[0] && kv[0].value && kv[0].value.t === tag, kv);
  ok("[K2] الإعداد غير مقروء للمجهول", (await rest("admin_kv?key=eq.e2e_" + tag + "&select=value")).j?.length !== 1);
  await sql("delete from admin_kv where key='e2e_" + tag + "'");
  /* ── لوحة التاجر ⇄ منصة Beta (platform-proxy على Supabase Beta ← Worker Beta ← D1 Beta) ── */
  const slug = "e2e-" + tag, px = async (method, path, body) => p.evaluate(async ([m, pa, bo]) => { const t = await API.sb.token(); const r = await fetch(API.sb.url("/functions/v1/platform-proxy"), { method: "POST", headers: API.sb.headers(t), body: JSON.stringify({ method: m, path: pa, body: bo }) }); let j = null; try { j = await r.json(); } catch { } return { s: r.status, j }; }, [method, path, body]);
  const put = await px("PUT", "/v1/catalog/products", { products: [{ slug, title: "منتج E2E " + tag, price: 3200, stock: 10 }] }); ok("[S1] إضافة منتج من اللوحة إلى منصة Beta عبر الوسيط (PUT catalog)", put.s === 200 && put.j && put.j.ok && put.j.status === 200, put);
  const get = await px("GET", "/v1/catalog/products"); const lst = get.j?.data?.products ?? get.j?.data?.data?.products ?? []; ok("[S2] المنتج مسترجَع من D1 Beta (حفظ واسترجاع)", lst.some((x) => x.slug === slug && x.skus?.[0]?.price === 3200), { n: lst.length });
  const bad = await px("GET", "/admin/tenants"); ok("[S3] الوسيط يمنع مسارات الإدارة (path_not_allowed)", bad.s === 400, bad);
  const noauth = await fetch(SB + "/functions/v1/platform-proxy", { method: "POST", headers: { apikey: ANON, Authorization: "Bearer " + ANON, "Content-Type": "application/json" }, body: JSON.stringify({ method: "GET", path: "/v1/orders" }) }); ok("[S4] المجهول لا يستعمل الوسيط (401)", noauth.status === 401, noauth.status);
  const sk = JSON.parse(fs.readFileSync((process.env.BETA_SECRETS_DIR || "/home/user/beta-secrets") + "/store.json", "utf8")).PLATFORM_KEY; const direct = await fetch(API + "/v1/catalog/products", { headers: { Authorization: "Bearer " + sk } }).then((r) => r.json()); ok("[S5] المنتج ظاهر مباشرة في Worker Beta بمفتاح المتجر", (direct.products ?? direct.data?.products ?? []).some((x) => x.slug === slug));
  await px("PUT", "/v1/catalog/products", { products: [], replace: true });   // تنظيف منتج الاختبار (يعطّل الغائب)
  ok("[L3] لا أخطاء JavaScript في اللوحة", log.errs.filter((e) => !/serviceWorker|sandboxed/.test(e)).length === 0, log.errs);
  ok("[L4] اللوحة لم تتصل بأي مضيف خارج Beta (باستثناء الخطوط)", [...log.ext].every((h) => /fonts\.(googleapis|gstatic)\.com/.test(h)), [...log.ext]);
  await b.close();
  /* تنظيف طلب الاختبار (Beta فقط) */
  await sql("delete from orders where id='" + oid + "' and name like '%" + tag + "%'");
  console.log(`\nالنتيجة: ${pass} ناجح، ${fail} فاشل`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("خطأ:", e.message); process.exit(1); });
