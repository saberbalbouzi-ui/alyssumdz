/* قائمة ما قبل الإرسال: الطلبات المؤكَّدة غير المرسَلة مع الشركة والتحذيرات وإرسال المحدَّد ومفتاح الإرسال التلقائي: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-presend.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 1000 } }); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, out = {}; window.toast = () => { }; window.confirm = () => true; const wait = ms => new Promise(r => setTimeout(r, ms)); document.getElementById("app").classList.remove("hidden");
    A.enabledCompanyKeys = () => ["wecan", "yalidine"]; A.activeCompanyKey = () => "wecan"; A.priceCheck = o => o.id === "P3" ? { ok: false, msgs: ["السعر لا يطابق"] } : { ok: true, msgs: [] };
    A.products = [{ slug: "tarkiz", title: "عسل التركيز و تنشيط الذاكرة", bord: "التركيز و الذاكرة ألبسوم", bordNoQty: true, price: 1800 }];
    const mk = (id, o) => Object.assign({ id, date: new Date().toISOString(), name: "ز" + id, phone: "0550000000", wilaya: "Béjaïa", commune: "Béjaïa", dtype: "home", desk: "", items: "عسل التركيز و تنشيط الذاكرة ×3 = 3200 DA", subtotal: 3200, fee: 500, total: 3700, extra: {}, status: "confirmee", note: "" }, o || {});
    A.orders = [mk("P1"), mk("P2", { dtype: "stop", desk: "Hub Bejaia", extra: { "✍️ طلب يدوي": "نعم" } }), mk("P3"), mk("P4", { status: "nouvelle" }), mk("P5", { note: "🚚wecan:WS-X" }), mk("P6", { dtype: "stop", desk: "" })];
    A.orderCompanyKey = o => o.id === "P2" ? "yalidine" : "wecan"; A.trackingOf = o => { const m = /🚚(\w+):(\S+)/.exec(o.note || ""); return m ? { company: m[1], tracking: m[2] } : null; };
    out.pending = AdminPreSend.pending().map(o => o.id).join(",");
    out.btn = !!document.getElementById("presend-btn"); AdminHome.render(); out.homeBtn = !!document.querySelector('#ahome [data-go="presend"]');
    AdminPreSend.open(); await wait(100); const bg = document.getElementById("presend-bg"), txt = () => bg.innerText.replace(/\s+/g, " ");
    out.rows = bg.querySelectorAll("tbody tr").length; out.bord = /التركيز و الذاكرة ألبسوم/.test(txt()) && !/تنشيط الذاكرة/.test(txt()); out.other = /شركة غير الافتراضية/.test(txt()); out.price = /تدقيق السعر: السعر لا يطابق/.test(txt()); out.nodesk = /لا مكتب Stop Desk محدَّد/.test(txt()); out.count = /4 طلب مؤكَّد لم يُرسَل/.test(txt());
    out.sum = /WeCan|wecan/i.test(txt()) && /Yalidine|yalidine/i.test(txt());
    out.chips = [...bg.querySelectorAll("[data-src]")].map(x => x.textContent.replace(/\s+/g, " ").trim()).join("|"); out.badges = [...bg.querySelectorAll("tbody .o-src")].map(x => x.textContent).join(",");
    bg.querySelector('[data-src="man"]').click(); await wait(80); out.man = bg.querySelectorAll("tbody tr").length + ":" + /Hub Bejaia|Béjaïa/.test(bg.innerText);
    bg.querySelector('[data-src="web"]').click(); await wait(80); out.web = bg.querySelectorAll("tbody tr").length; bg.querySelector('[data-src=""]').click(); await wait(80);
    /* مفتاح الإرسال التلقائي */
    A.setAutoOpt = (k, on) => { localStorage.setItem("alyssum_auto_" + k, on ? "1" : "0"); }; localStorage.removeItem("alyssum_auto_send"); AdminPreSend.open(); await wait(80); const au = document.querySelector("#presend-bg #ps-auto"); out.autoDefault = au.checked; au.checked = false; au.dispatchEvent(new Event("change")); await wait(80); out.autoOff = localStorage.getItem("alyssum_auto_send") === "0" && /متوقف/.test(document.getElementById("presend-bg").innerText);
    /* إلغاء تحديد طلب ثم إرسال المحدَّد */
    const bg2 = document.getElementById("presend-bg"), sent = []; A.bulkSend = async list => { list.forEach(o => { sent.push(o.id); o.note = "🚚wecan:T" + o.id; }); return true; };
    bg2.querySelector('input[data-id="P3"]').click(); await wait(60); out.btnLabel = bg2.querySelector("#ps-send").innerText; bg2.querySelector("#ps-send").click(); await wait(150);
    out.sent = sent.join(","); out.after = document.getElementById("presend-bg").querySelectorAll("tbody tr").length;
    /* تبويب «أُرسلت آخر 7 أيام»: قراءة فقط، يضم المرسَل ويُخفي زر الإرسال والتحديد */
    const bg3 = document.getElementById("presend-bg"); bg3.querySelector('[data-scope="sent"]').click(); await wait(80);
    out.sentTab = { ids: [...bg3.querySelectorAll("tbody tr td:nth-child(1)")].map(x => x.innerText.trim()).join(","), cb: bg3.querySelectorAll("tbody input[type=checkbox]").length, btn: !!bg3.querySelector("#ps-send"), auto: !!bg3.querySelector("#ps-auto"), trk: /WS-X/.test(bg3.innerText), n: AdminPreSend.recentSent().length };
    bg3.querySelector('[data-scope=""]').click(); await wait(60); out.back = !!document.getElementById("presend-bg").querySelector("#ps-auto");
    return out; });
  ok("تبويب «أُرسلت»: يضم المرسَل مع رقم التتبع، بلا تحديد ولا زر إرسال، والعودة تُظهر المفتاح", R.sentTab.n >= 1 && R.sentTab.trk && R.sentTab.cb === 0 && !R.sentTab.btn && !R.sentTab.auto && R.back, R.sentTab);
  ok("القائمة: المؤكَّد غير المرسَل فقط (P1,P2,P3,P6)", R.pending === "P1,P2,P3,P6", R.pending);
  ok("الزران: في الطلبات وفي الرئيسية", R.btn && R.homeBtn, R);
  ok("النافذة: 4 صفوف، والاسم كما سيصل الشركة (اسم البوردرو)، وعدد الطلبات", R.rows === 4 && R.bord && R.count, R);
  ok("التحذيرات: شركة غير الافتراضية، تدقيق السعر، مكتب مفقود، وملخص الشركات", R.other && R.price && R.nodesk && R.sum, R);
  ok("مفتاح الإرسال التلقائي: مفعّل افتراضياً ويُوقف من النافذة ويُحفظ", R.autoDefault === true && R.autoOff, R);
  ok("إرسال المحدَّد: بعد إلغاء P3 يُرسَل P1 وP2 وP6 فقط، ويُحدَّث العدد والقائمة", R.sent === "P1,P2,P6" && /\(3\)/.test(R.btnLabel) && R.after === 1, [R.sent, R.btnLabel, R.after]);
  ok("المصدر: شارات «الموقع/يدوي» ومرشّحات بأعدادها، وتصفية «يدوياً» (1) و«الموقع» (3)", /الكل \(4\)\|دخلت من الموقع \(3\)\|أدخلتُها يدوياً \(1\)/.test(R.chips) && /يدوي/.test(R.badges) && R.man.startsWith("1:") && R.web === 3, [R.chips, R.badges, R.man, R.web]);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
