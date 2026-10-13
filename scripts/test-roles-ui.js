/* اختبار واجهة الأدوار والمصادقة الثنائية على لوحة حقيقية (نسخة PHP محلية): المالك يضيف موظفاً، الموظف يرى أقساماً محدودة
   ويؤكد طلباً، ثم يفعّل المصادقة الثنائية ويدخل بالرمز. يبني حزمة نظيفة (~دقيقة).
     NODE_PATH=/opt/node-tools/node_modules node scripts/test-roles-ui.js */
const { spawn, spawnSync } = require("child_process"), fs = require("fs"), path = require("path"), os = require("os"), crypto = require("crypto");
const { chromium } = require("playwright");
const root = path.join(__dirname, ".."), PORT = 8600 + Math.floor(Math.random() * 300), PW = "TestPass12345";
let fails = 0, total = 0;
const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } else console.log("✓", n); };
const b32dec = s => { const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const c of s.replace(/[^A-Z2-7]/gi, "").toUpperCase()) bits += a.indexOf(c).toString(2).padStart(5, "0"); const o = []; for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(o); };
const totp = (sec, step) => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(step)); const h = crypto.createHmac("sha1", b32dec(sec)).update(c).digest(); const o = h[19] & 15; return String(((h[o] & 0x7f) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1e6).padStart(6, "0"); };

(async () => {
  const out = path.join(root, "dist", "roles-test"), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "roles-"));
  fs.rmSync(out, { recursive: true, force: true });
  const b = spawnSync("python3", ["scripts/make-template.py", "--target", "php", "--out", "dist/roles-test", "--name", "Mystore", "--wa", "213000000000"], { cwd: root, encoding: "utf8" });
  const code = (/([0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4})/.exec(b.stdout) || [])[1];
  if (!code) { console.log("تعذّر بناء الحزمة", b.stdout.slice(-300), b.stderr.slice(-300)); process.exit(2); }
  fs.cpSync(out, tmp, { recursive: true });
  const php = spawn("php", ["-S", "127.0.0.1:" + PORT, "-t", tmp], { stdio: "ignore" });
  const kill = () => { try { php.kill(); } catch (e) { } fs.rmSync(out, { recursive: true, force: true }); fs.rmSync(tmp, { recursive: true, force: true }); };
  process.on("exit", kill);
  await new Promise(r => setTimeout(r, 1500));
  const base = "http://127.0.0.1:" + PORT;
  const inst = await (await fetch(base + "/install.php", { method: "POST", body: new URLSearchParams({ code, pw: PW, pw2: PW, name: "Mystore", wa: "213000000000" }) })).text();
  if (!/تم التثبيت/.test(inst)) { console.log("فشل التثبيت"); process.exit(2); }
  ok("الملف مضمَّن في حزمة العميل", fs.existsSync(path.join(tmp, "assets/js/admin-roles.js")));
  const browser = await chromium.launch();
  async function ctx() { const c = await browser.newContext({ viewport: { width: 1280, height: 800 } }), p = await c.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message)); return { c, p, errs }; }
  async function login(p, user, pw, otp) {
    await p.goto(base + "/admin.html"); await p.waitForTimeout(1200);
    await p.evaluate(([u, pw, o]) => { document.getElementById("login-email").value = u; document.getElementById("login-pass").value = pw; if (o) document.getElementById("login-otp").value = o; Admin.login(); }, [user, pw, otp || ""]);
  }
  const ready = p => p.waitForFunction(() => typeof Admin !== "undefined" && Admin.products && document.querySelector("#app .top") && window.AdminRoles && AdminRoles.state.me, null, { timeout: 25000 });

  // طلب زائر ليُدار
  const ordRes = await (await fetch(base + "/api/index.php?r=order", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ order: { name: "Zayd Test", phone: "0550123456", items: [{ title: "x", qty: 1, price: 1000 }], total: 1000, subtotal: 1000, items_text: "x ×1 = 1000 DA" } }) })).json();
  ok("طلب زائر أُنشئ", !!ordRes.id || !!ordRes.ok, ordRes);

  // ═══ المالك ═══
  const O = await ctx(); await login(O.p, "", PW); await ready(O.p); await O.p.waitForTimeout(1200);
  ok("المالك: كل الأقسام ظاهرة", await O.p.evaluate(() => !document.documentElement.classList.contains("rl-staff") && !document.querySelector(".nav-btn[onclick*=\"'finance'\"]").classList.contains("rl-hid")));
  ok("المالك: زر «الفريق والأمان» موجود", await O.p.evaluate(() => !!document.querySelector(".nav-btn[onclick*=\"'team'\"]")));
  await O.p.evaluate(() => Admin.tab("team")); await O.p.waitForSelector("#rl .rl-perms", { timeout: 8000 });
  ok("المالك: شاشة الفريق تعرض الأمان والإضافة", await O.p.evaluate(() => /حسابي وأمانه/.test(document.getElementById("rl").textContent) && /إضافة موظف/.test(document.getElementById("rl").textContent)));
  console.log("   dbg:", JSON.stringify(await O.p.evaluate(() => { const e = document.getElementById("rl-email"), t = document.getElementById("tab-team"); const r = e && e.getBoundingClientRect(); return { tabHidden: t.className, rect: r && [r.x, r.y, r.width, r.height], disp: e && getComputedStyle(e).display, vis: e && getComputedStyle(e).visibility, parent: e && e.parentElement.className, cnt: document.querySelectorAll("#rl-email").length, rlTxt: document.getElementById("rl").textContent.length }; })));
  await O.p.fill("#rl-email", "amel"); await O.p.fill("#rl-name", "Amel"); await O.p.selectOption("#rl-role", "agent");
  const tmpPw = await O.p.inputValue("#rl-pw");
  ok("كلمة مرور مؤقتة مولَّدة قوية", tmpPw.length >= 14, tmpPw.length);
  ok("اختيار الدور يضبط الصلاحيات", await O.p.evaluate(() => { const on = [...document.querySelectorAll("#rl [data-perm]:checked")].map(x => x.dataset.perm).sort().join(","); return on === "callcenter,orders,orders.write"; }));
  await O.p.click('#rl [data-rl="add"]'); await O.p.waitForFunction(() => /amel/.test(document.getElementById("rl").textContent) && document.querySelector('#rl tr[data-em="amel"]'), null, { timeout: 8000 });
  ok("الموظف ظهر في الجدول", await O.p.evaluate(() => !!document.querySelector('#rl tr[data-em="amel"]')));

  // ═══ الموظف ═══
  const S = await ctx(); await login(S.p, "amel", tmpPw); await ready(S.p); await S.p.waitForTimeout(1800);
  const vis = await S.p.evaluate(() => [...document.querySelectorAll(".nav-btn:not(.rl-hid):not(.nav-hid):not(.nav-work)")].filter(b => b.offsetParent !== null || true).map(b => (b.querySelector(".nav-txt b") || b).textContent.trim().replace(/\s+/g, " ")));
  console.log("   الأقسام الظاهرة للموظف:", vis.join(" | "));
  ok("الموظف: الأقسام المسموحة ظاهرة", ["الطلبات", "مركز الاتصال", "الفريق والأمان"].every(t => vis.some(v => v.startsWith(t))), vis);
  ok("الموظف: المالية/الشحن/الإعدادات/الصفحات مخفية", !vis.some(v => /المخزون والأرباح|المدفوعات|شركات التوصيل|رسوم التوصيل|إعدادات الموقع|الصفحات|تكلفة|البكسلات/.test(v)), vis);
  ok("الموظف: الصنف rl-staff مفعّل والصفحة الأولى مركز الاتصال", await S.p.evaluate(() => document.documentElement.classList.contains("rl-staff") && !document.getElementById("tab-callcenter").classList.contains("hidden")));
  await S.p.evaluate(() => Admin.tab("finance")); await S.p.waitForTimeout(400);
  ok("الموظف: فتح المالية برمجياً مرفوض", await S.p.evaluate(() => document.getElementById("tab-finance").classList.contains("hidden") && /ليست لديك صلاحية/.test(document.getElementById("toast2").textContent)));
  ok("الموظف: الأتمتة (إرسال تلقائي للشركة) معطّلة", await S.p.evaluate(() => Admin.autoOpt("send") === false));
  console.log("   debug orders:", JSON.stringify(await S.p.evaluate(async () => ({ n: Admin.orders.length, st: Admin.orders.map(o => o.status + "/" + (o.note || "")), raw: (await PHPAPI.call("orders", { method: "GET" })).j.orders?.length, q: CallCenter.queue().length }))), JSON.stringify(ordRes).slice(0, 120));
  ok("الموظف: الطلب الجديد يظهر في مركز الاتصال", await S.p.evaluate(() => /Zayd Test/.test(document.getElementById("callcenter-content").textContent)), await S.p.evaluate(() => document.getElementById("callcenter-content").textContent.slice(0, 200)));
  await S.p.evaluate(() => document.querySelector('#ccm [data-d="confirm"]').click()); await S.p.waitForTimeout(2500);
  const st = await S.p.evaluate(async () => { const r = await PHPAPI.call("orders", { method: "GET" }); return (r.j.orders || []).map(o => o.status); });
  ok("الموظف: أكّد الطلب فعلاً في الخادم", st[0] === "confirmee", st);
  // لا يستطيع قراءة إعدادات المالك مباشرة
  const direct = await S.p.evaluate(async () => (await PHPAPI.call("kv&k=costs", { method: "GET" })).status);
  ok("الموظف: تخزين المالك مرفوض من الخادم", direct === 401 || direct === 403, direct);

  // 2FA للموظف
  await S.p.evaluate(() => Admin.tab("team")); await S.p.waitForSelector('#rl [data-rl="mfa-begin"]', { timeout: 8000 });
  ok("الموظف: لا يرى إدارة الفريق ولا السجلّ الكامل", await S.p.evaluate(() => !/إضافة موظف/.test(document.getElementById("rl").textContent) && !/سجلّ النشاط/.test(document.getElementById("rl").textContent) && /حصيلتي/.test(document.getElementById("rl").textContent)));
  await S.p.click('#rl [data-rl="mfa-begin"]'); await S.p.waitForSelector("#rl #rl-code", { timeout: 8000 });
  const secret = await S.p.evaluate(() => document.querySelector("#rl code").textContent.trim());
  ok("المفتاح السري ظاهر (32 حرفاً)", /^[A-Z2-7]{32}$/.test(secret), secret);
  await S.p.fill("#rl-code", "000000"); await S.p.click('#rl [data-rl="mfa-confirm"]'); await S.p.waitForTimeout(700);
  ok("رمز خاطئ لا يفعّل", await S.p.evaluate(() => !!document.querySelector("#rl-code")));
  await S.p.fill("#rl-code", totp(secret, Math.floor(Date.now() / 30000))); await S.p.click('#rl [data-rl="mfa-confirm"]'); await S.p.waitForSelector("#rl .rl-warn", { timeout: 8000 });
  const recov = await S.p.evaluate(() => [...document.querySelectorAll("#rl .rl-warn code")].map(x => x.textContent));
  ok("رموز الطوارئ تظهر مرة واحدة (8)", recov.length === 8, recov);
  await S.p.click('#rl [data-rl="rec-done"]'); await S.p.waitForTimeout(500);
  ok("الحالة: المصادقة الثنائية مفعّلة", await S.p.evaluate(() => /المصادقة الثنائية مفعّلة/.test(document.getElementById("rl").textContent)));

  // دخول جديد: يطلب الرمز
  const S2 = await ctx(); await login(S2.p, "amel", tmpPw); await S2.p.waitForTimeout(1500);
  ok("الدخول: حقل الرمز يظهر ولا تُفتح اللوحة", await S2.p.evaluate(() => !document.getElementById("login-otp").classList.contains("hidden") && !document.getElementById("login-box").classList.contains("hidden") && document.getElementById("app").classList.contains("hidden")));
  await S2.p.evaluate(() => { document.getElementById("login-otp").value = "123456"; Admin.login(); }); await S2.p.waitForTimeout(1200);
  ok("رمز خاطئ: يبقى في شاشة الدخول", await S2.p.evaluate(() => document.getElementById("app").classList.contains("hidden")));
  const nx = totp(secret, Math.floor(Date.now() / 30000) + 1);
  await S2.p.evaluate(c => { document.getElementById("login-otp").value = c; Admin.login(); }, nx); await ready(S2.p);
  ok("رمز صحيح: تُفتح اللوحة بدور الموظف", await S2.p.evaluate(() => AdminRoles.state.me.role === "agent"));

  // المالك يرى الحصيلة والسجلّ ثم يعيد ضبط 2FA
  await O.p.evaluate(() => Admin.tab("team")); await O.p.waitForTimeout(1500);
  const txt = await O.p.evaluate(() => document.getElementById("rl").textContent);
  ok("المالك: نشاط الموظف في الإحصاء والسجلّ", /amel/.test(txt) && /تغيير حالة طلب → مؤكد/.test(txt) && /تفعيل المصادقة الثنائية/.test(txt), txt.slice(-500));
  ok("المالك: 2FA الموظف ✅ وزر إعادة الضبط", await O.p.evaluate(() => !!document.querySelector('#rl tr[data-em="amel"] [data-rl="resetmfa"]')));

  // ═══ المحاسب: المالية قراءةً فقط ═══
  await O.p.evaluate(async () => { await Priv.set("costs", { "demo-slug": 640 }); await PHPAPI.call("team", { method: "POST", body: JSON.stringify({ action: "create", email: "acct", name: "Acc", role: "accountant", password: "acctpass-12345" }) }); });
  const A = await ctx(); await login(A.p, "acct", "acctpass-12345"); await ready(A.p); await A.p.waitForTimeout(1800);
  const visA = await A.p.evaluate(() => [...document.querySelectorAll(".nav-btn:not(.rl-hid):not(.nav-hid):not(.nav-work)")].map(b => (b.querySelector(".nav-txt b") || b).textContent.trim().replace(/\s+/g, " ")));
  console.log("   أقسام المحاسب:", visA.join(" | "));
  ok("المحاسب: المالية والمدفوعات والتكلفة والعملاء والتقارير ظاهرة", ["المخزون والأرباح", "المدفوعات", "تكلفة المنتجات", "العملاء", "التقارير", "لوحة التحكم"].every(t => visA.some(v => v.startsWith(t))), visA);
  ok("المحاسب: الاتصال والشحن والإعدادات مخفية", !visA.some(v => /مركز الاتصال|شركات التوصيل|رسوم التوصيل|إعدادات الموقع|الصفحات|البكسلات/.test(v)), visA);
  ok("المحاسب: يقرأ أسعار الشراء التي حفظها المالك", await A.p.evaluate(() => Admin.fin && Admin.fin.costs && Admin.fin.costs["demo-slug"] === 640), await A.p.evaluate(() => Admin.fin && Admin.fin.costs));
  await A.p.evaluate(() => Admin.tab("finance")); await A.p.waitForTimeout(600);
  ok("المحاسب: شريط «عرض فقط» في المالية", await A.p.evaluate(() => !!document.querySelector("#tab-finance > .rl-robar")));
  await A.p.evaluate(() => Priv.set("costs", { "demo-slug": 1 })); await A.p.waitForTimeout(400);
  ok("المحاسب: الكتابة في التخزين الخاص مرفوضة", await A.p.evaluate(() => /عرض فقط/.test(document.getElementById("toast2").textContent)));
  const stillCost = await O.p.evaluate(async () => (await Priv.remote("costs"))["demo-slug"]);
  ok("قيمة المالك لم تتغيّر", stillCost === 640, stillCost);
  await A.p.evaluate(() => Admin.tab("payments")); await A.p.waitForTimeout(1200);
  ok("المحاسب: تبويب المدفوعات يعمل", await A.p.evaluate(() => !document.getElementById("tab-payments").classList.contains("hidden") && !!document.querySelector("#tab-payments > .rl-robar")));
  await A.p.evaluate(() => Admin.tab("customers")); await A.p.waitForTimeout(1200);
  ok("المحاسب: تبويب العملاء يعمل (عرض فقط)", await A.p.evaluate(() => !document.getElementById("tab-customers").classList.contains("hidden") && !!document.querySelector("#tab-customers > .rl-robar")));
  await A.p.evaluate(() => Admin.tab("callcenter")); await A.p.waitForTimeout(300);
  ok("المحاسب: مركز الاتصال مرفوض", await A.p.evaluate(() => document.getElementById("tab-callcenter").classList.contains("hidden")));
  const errsAll = [...O.errs, ...S.errs, ...S2.errs, ...A.errs];
  ok("لا أخطاء جافاسكربت في أي جلسة", errsAll.length === 0, errsAll.slice(0, 5));
  await browser.close(); kill();
  console.log(fails ? `\n✗ ${fails} من ${total} فشل` : `\n✓ ${total} فحصاً ناجحاً`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
