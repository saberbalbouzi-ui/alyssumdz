/* تنبيهات التسليم: طرد وصل المكتب / زبون لم يردّ على الموزّع ← بطاقة وشارة وإجراءات (اتصال، واتساب برسالة جاهزة، معالجة، تأجيل)، ولا تنبيه لما سواهما. NODE_PATH=/opt/node-tools/node_modules node scripts/test-dlv-alerts.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1300, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 160)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.removeItem("alyssum_lang"); localStorage.removeItem("alyssum_priv_dlv_alerts"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const o = {}, W = ms => new Promise(r => setTimeout(r, ms)); document.getElementById("app").classList.remove("hidden"); const msgs = []; window.toast = m => msgs.push(String(m)); const A = Admin;
    // مرحلة التصنيف
    const S = AdminDlvAlerts.stageOf; o.stages = { desk1: S("En attente du client"), desk2: S("Arrivé au bureau"), desk3: S("ready_for_pickup"), noans1: S("Tentative échouée"), noans2: S("Client injoignable"), noans3: S("لم يرد على الاتصال"), none1: S("En livraison"), none2: S("Livré"), none3: S("Retour à retirer"), none4: S("Echec de livraison"), none5: S("Sorti en livraison"), none6: S("En préparation") };
    const mk = (id, st, name) => ({ id, date: new Date().toISOString(), name, phone: "0550123456", wilaya: "Alger", commune: "Bab Ezzouar", dtype: "desk", items: "عسل ×1 = 2000 DA", subtotal: 2000, fee: 0, total: 2000, status: st, note: "🚚yalidine:yal-" + id, extra: {} });
    A.orders = [mk("D1", "expediee", "كريم"), mk("N1", "expediee", "سمير"), mk("L1", "expediee", "ياسين"), mk("F1", "livree", "منى")];
    A.setShipRaw("D1", "En attente du client"); A.setShipRaw("N1", "Tentative échouée"); A.setShipRaw("L1", "En livraison"); A.setShipRaw("F1", "En attente du client");
    await AdminDlvAlerts.load(); await W(1500); AdminDlvAlerts.tick(); await W(300);
    o.active = AdminDlvAlerts.active().map(x => x.o.id).sort(); o.toast = msgs.some(m => /وصل إلى المكتب/.test(m) && /لم يجب/.test(m));
    A.tab("shipped"); await W(800); AdminDlvAlerts.tick(); await W(300);
    const box = document.getElementById("dlv-alerts"); o.box = !!box && !!box.querySelector(".dla-n") && box.querySelectorAll(".dla-row").length === 2; o.badge = (document.getElementById("nb-dlv") || {}).textContent;
    const row = id => box.querySelector('.dla-row[data-id="' + id + '"]'); const wa = row("D1").querySelector('a[data-dla="wa"]'); const href = decodeURIComponent(wa.getAttribute("href")); o.wa = /wa\.me\/213550123456/.test(href) && /كريم/.test(href) && /Bab Ezzouar/.test(href) && /yal-D1/.test(href); o.call = row("D1").querySelector('a[data-dla="call"]').getAttribute("href");
    row("D1").querySelector('[data-dla="done"]').click(); await W(300); o.afterDone = AdminDlvAlerts.active().map(x => x.o.id).sort();
    box.querySelector('.dla-row[data-id="N1"] [data-dla="snooze"]').click(); await W(300); o.afterSnooze = AdminDlvAlerts.active().length;
    // تغيّر المرحلة يعيد التنبيه بعد المعالجة
    A.setShipRaw("D1", "En livraison"); await W(900); A.setShipRaw("D1", "En attente du client"); await W(900); o.reraise = AdminDlvAlerts.active().map(x => x.o.id).includes("D1");
    // الإعدادات
    box.querySelector('[data-dla="toggle"]').click(); await W(200); const ta = box.querySelector('textarea[data-dlas="msgDesk"]'); ta.value = "مرحباً {name} طلبك في {company}"; ta.dispatchEvent(new Event("change", { bubbles: true })); await W(200);
    const d = AdminDlvAlerts.D.seen.D1; o.tpl = AdminDlvAlerts.fill(ta.value, A.orders[0], d, A.trackingOf(A.orders[0])); o.cfg = AdminDlvAlerts.D.cfg.msgDesk;
    box.querySelector('input[data-dlas="on"]').click(); await W(300); o.off = document.getElementById("nb-dlv").classList.contains("hidden");
    // الفرنسية: لا عربية في البطاقة
    await AdminI18n.set("fr"); AdminDlvAlerts.D.cfg.on = true; AdminDlvAlerts.D.done = {}; AdminDlvAlerts.D.snooze = {}; AdminDlvAlerts.D.seen = {}; AdminDlvAlerts.tick(); await W(600); AdminDlvAlerts.tick(); await W(800);
    const bx = document.getElementById("dlv-alerts"); bx.querySelector('[data-dla="toggle"]').click(); await W(600); o.fr = bx.innerText; o.frAr = (bx.innerText.match(/[\u0600-\u06ff]+/g) || []).slice(0, 8);
    return o; });
  t("تصنيف الحالات: يصل المكتب / لم يردّ ← تنبيه، وغيرها بلا تنبيه", R.stages.desk1 === "desk" && R.stages.desk2 === "desk" && R.stages.desk3 === "desk" && R.stages.noans1 === "noans" && R.stages.noans2 === "noans" && R.stages.noans3 === "noans" && !R.stages.none1 && !R.stages.none2 && !R.stages.none3 && !R.stages.none4 && !R.stages.none5 && !R.stages.none6, R.stages);
  t("التنبيهات للطرد في المكتب ولمن لم يردّ فقط (لا المسلَّم ولا الجاري توصيله ولا المنتهي)", JSON.stringify(R.active) === '["D1","N1"]', R.active);
  t("إشعار فوري عند ظهور تنبيه جديد", R.toast, R);
  t("بطاقة «تنبيهات التسليم» في الطلبات المسجلة بصفّين وشارة على القائمة", R.box && R.badge === "2", R);
  t("واتساب برسالة جاهزة فيها الاسم والبلدية والتتبع، واتصال tel:", R.wa && /^tel:\+213550123456$/.test(R.call), R);
  t("«تمّت المعالجة» تُخفي التنبيه و«لاحقاً» تؤجّله", JSON.stringify(R.afterDone) === '["N1"]' && R.afterSnooze === 0, R);
  t("تغيّر مرحلة الطرد ثم عودته إلى المكتب يعيد التنبيه بعد المعالجة", R.reraise, R);
  t("الإعدادات: قالب الرسالة يُحفظ ويُملأ بالمتغيّرات، وإيقاف التنبيهات يُخفي الشارة", /مرحباً كريم طلبك في /.test(R.tpl) && R.cfg === "مرحباً {name} طلبك في {company}" && R.off, R);
  t("الفرنسية: بطاقة التنبيهات بلا نص عربي", R.frAr.filter(x => !/^(سمير|كريم|ياسين)$/.test(x)).length === 0 && /Alertes de livraison/.test(R.fr) && /Arrivé au bureau/.test(R.fr), [R.frAr, R.fr.slice(0, 200)]);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
