/* أرشيف الطلبات المرسَلة: زر «المرسَلة اليوم» في الطلبات المسجلة وفي الرئيسية، ونافذة اليوم والتنقل بين الأيام والتصدير: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-sent-archive.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1100, height: 1000 } }); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, out = {}; window.toast = () => { }; const wait = ms => new Promise(r => setTimeout(r, ms)); document.getElementById("app").classList.remove("hidden");
    A.enabledCompanyKeys = () => ["wecan", "yalidine"]; A.activeCompanyKey = () => "wecan";
    const mk = (id, wil, st) => ({ id, date: new Date().toISOString(), name: "زبون " + id.slice(-2), phone: "0550000000", wilaya: wil, commune: "c", dtype: "home", items: "منتج ×1 = 1000 DA", subtotal: 1000, fee: 0, total: 3700, extra: {}, status: st || "confirmee", note: "" });
    A.orders = [mk("S1", "Béjaïa"), Object.assign(mk("S2", "Touggourt"), { extra: { "✍️ طلب يدوي": "نعم" } }), mk("S3", "Oran", "expediee"), mk("S4", "Alger")]; A.shipRaw = { S1: { raw: "En préparation" }, S2: { raw: "تم الإرسال للشركة" }, S3: { raw: "Expédié" } };
    const now = Date.now(), reg = AdminYd.sentLog(); Object.keys(reg).forEach(k => delete reg[k]);
    reg["WS-ALY-aaa"] = { id: "S1", name: "x", phone: "0", co: "wecan", at: now - 3600e3 };
    reg["yal-XV60FX"] = { id: "S2", name: "x", phone: "0", co: "yalidine", at: now - 600e3 };
    reg["WS-ALY-ccc"] = { id: "S3", name: "x", phone: "0", co: "wecan", at: now - 86400e3 - 3600e3 };
    reg["WS-ALY-old"] = { id: "S4", name: "x", phone: "0", co: "wecan", at: now - 3 * 86400e3 };
    /* إدخال من الخادم بعد تحميل الملف (يُكتب في localStorage مباشرة كما تفعل مزامنة الإعدادات) ثم قراءته */
    const rawLS = JSON.parse(localStorage.getItem("alyssum_yd_sent") || "{}"); rawLS["WS-ALY-fromserver"] = { id: "S2", name: "x", phone: "0", co: "wecan", at: now - 120e3 }; localStorage.setItem("alyssum_yd_sent", JSON.stringify(rawLS)); out.fromServer = AdminSent.rows(new Date().toISOString().slice(0, 10)).some(r => r.tr === "WS-ALY-fromserver"); delete rawLS["WS-ALY-fromserver"]; localStorage.setItem("alyssum_yd_sent", JSON.stringify(rawLS)); delete AdminYd.sentLog()["WS-ALY-fromserver"];
    /* الأزرار */
    out.btnShip = !!document.getElementById("ship-sent-btn"); AdminHome.render(); out.btnHome = !!document.querySelector('#ahome [data-go="sent"]');
    /* نافذة اليوم */
    AdminSent.open(); await wait(150); const bg = document.getElementById("sent-bg"), txt = () => bg.innerText;
    out.today = { rows: bg.querySelectorAll("tbody tr").length, hasS1: /Béjaïa/.test(txt()), hasS2: /Touggourt/.test(txt()), noS3: !/Oran/.test(txt()), other: /غير الافتراضية/.test(txt()), sum: /Yalidine|ياليدين/i.test(txt()), trk: /yal-XV60FX/.test(txt()), count: /2\s*طلب أُرسل اليوم/.test(txt().replace(/\s+/g, " ")) };
    /* المصدر: موقع/يدوي */
    out.src = { badges: [...bg.querySelectorAll("tbody .o-src")].map(x => x.textContent).join(","), chips: [...bg.querySelectorAll("[data-src]")].map(x => x.textContent.replace(/\s+/g, " ").trim()).join("|") };
    bg.querySelector('[data-src="man"]').click(); await wait(80); out.manOnly = { rows: bg.querySelectorAll("tbody tr").length, t: /Touggourt/.test(bg.innerText) && !/Béjaïa/.test(bg.innerText) };
    bg.querySelector('[data-src="web"]').click(); await wait(80); out.webOnly = { rows: bg.querySelectorAll("tbody tr").length, t: /Béjaïa/.test(bg.innerText) && !/Touggourt/.test(bg.innerText) };
    bg.querySelector('[data-src=""]').click(); await wait(80);
    /* الأمس */
    bg.querySelector('[data-sd="-1"]').click(); await wait(100); out.yday = { rows: bg.querySelectorAll("tbody tr").length, oran: /Oran/.test(bg.innerText), status: /Expédié/.test(bg.innerText), todayBtn: !!bg.querySelector('[data-sd="today"]') };
    bg.querySelector('[data-sd="today"]').click(); await wait(100); out.back = bg.querySelectorAll("tbody tr").length;
    /* يوم بلا إرسال */
    const di = bg.querySelector("#sent-day"); const d = new Date(Date.now() - 10 * 86400e3), v = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); di.value = v; di.dispatchEvent(new Event("change")); await wait(100); out.empty = /لا طلبات أُرسلت/.test(bg.innerText) && bg.querySelector("#sent-csv").disabled;
    /* CSV */
    const L = AdminSent.rows(new Date().toISOString().slice(0, 10)); out.csv = AdminSent.csv("x", L).split("\r\n").length === 3 && /WS-ALY-aaa/.test(AdminSent.csv("x", L)) && AdminSent.csv("x", L).charCodeAt(0) === 0xfeff;
    return out; });
  ok("الزر في «الطلبات المسجلة» وفي الرئيسية", R.btnShip && R.btnHome, R);
  ok("إرسال سُجّل في localStorage بعد تحميل الملف (مزامنة الخادم عند فتح اللوحة) يظهر فوراً دون إعادة تحميل", R.fromServer, R.fromServer);
  ok("نافذة اليوم: طلبان فقط (Béjaïa وTouggourt)، وطلب الأمس غير ظاهر، رقم تتبع ياليدين، العدد", R.today.rows === 2 && R.today.hasS1 && R.today.hasS2 && R.today.noS3 && R.today.trk && R.today.count, R.today);
  ok("تنبيه «غير الافتراضية» لما أُرسل إلى ياليدين مع ملخص الشركات", R.today.other && R.today.sum, R.today);
  ok("الأمس: طلب Oran بحالته Expédié، ويظهر زر «اليوم»، والرجوع لليوم يعيد الطلبين", R.yday.rows === 1 && R.yday.oran && R.yday.status && R.yday.todayBtn && R.back === 2, [R.yday, R.back]);
  ok("يوم بلا إرسال: رسالة فارغة وزر CSV معطَّل", R.empty, R.empty);
  ok("CSV: ترميز UTF-8 مع BOM وسطر لكل طلب وأرقام التتبع", R.csv, R.csv);
  ok("المصدر: شارة «الموقع/يدوي» لكل صف ومرشّحات بأعدادها (الكل 2 · من الموقع 1 · يدوياً 1)", /يدوي/.test(R.src.badges) && /الموقع/.test(R.src.badges) && /الكل \(2\)\|من الموقع \(1\)\|أدخلتُها يدوياً \(1\)/.test(R.src.chips), R.src);
  ok("مرشّح «يدوياً» يُبقي طلب توقرت فقط، و«من الموقع» يُبقي Béjaïa فقط", R.manOnly.rows === 1 && R.manOnly.t && R.webOnly.rows === 1 && R.webOnly.t, [R.manOnly, R.webOnly]);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
