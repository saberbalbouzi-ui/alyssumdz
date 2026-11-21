/* لصق الهاتف في «التحقق من زبون» وحقول البحث/التصفية كحقل «إضافة طلب»: يستخرج الرقم من أي نص. NODE_PATH=/opt/node-tools/node_modules node scripts/test-phonefix.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const out = {}; document.getElementById("app").classList.remove("hidden"); window.toast = () => { };
    const paste = (el, text) => { const dt = new DataTransfer(); dt.setData("text", text); const ev = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }); el.dispatchEvent(ev); return ev.defaultPrevented; };
    AdminVerify.open(); const ph = document.getElementById("cv-phone");
    const cases = ["+213 550 11 22 33", "‪+213 550 11 22 33‬", "الاسم: كريم  الهاتف: ٠٥٥٠-١١-٢٢-٣٣", "0550.11.22.33", "00213550112233", "550112233"];
    out.strict = cases.map(c => { ph.value = ""; paste(ph, c); return ph.value; });
    ph.value = ""; ph.value = "٠٥٥٠١١"; ph.dispatchEvent(new Event("input", { bubbles: true })); out.arDigits = ph.value;
    const s = document.getElementById("order-search") || document.querySelector("#tab-orders .search-bar input"); out.hasSearch = !!s;
    if (s) { s.value = ""; out.smartPrevented = paste(s, "+213 550 11 22 33"); out.smart = s.value; s.value = "كريم"; out.namePrevented = paste(s, "كريم بن علي"); out.nameKept = s.value; s.value = ""; out.nonPhonePrevented = paste(s, "123456"); s.value = "٠٥٥"; s.dispatchEvent(new Event("input", { bubbles: true })); out.searchAr = s.value; }
    const mo = document.createElement("input"); mo.id = "mo-phone-x"; document.body.appendChild(mo); mo.value = ""; out.moSkipped = !paste(mo, "+213 550 11 22 33") && mo.value === "";
    const bl = document.getElementById("bl-phone"); bl.value = ""; paste(bl, "+213 661 23 45 67"); out.bl = bl.value;
    // نتيجة التحقق تعمل بالصق: طلب بهاتف محلي يُجد من لصق +213
    Admin.orders = [{ id: "O1", date: "2026-11-01T10:00:00Z", name: "ك", phone: "0550112233", wilaya: "Alger", commune: "x", items: "a ×1 = 1 DA", status: "livree", total: 1, note: "", extra: {} }];
    ph.value = ""; paste(ph, "الهاتف: +213 550 11 22 33"); document.querySelector('#cv-bg [data-cv="go"]').click(); await new Promise(r => setTimeout(r, 200)); out.found = document.querySelectorAll("#cv-bg tbody tr").length;
    ph.value = "٠٥٥٠١١٢٢٣٣"; document.querySelector('#cv-bg [data-cv="go"]').click(); await new Promise(r => setTimeout(r, 200)); out.foundAr = document.querySelectorAll("#cv-bg tbody tr").length;
    return out;
  });
  t("حقل هاتف «تحقق من زبون»: اللصق ينظّف ويستخرج الرقم من كل الصيغ", R.strict.every(v => v === "0550112233"), R.strict);
  t("الأرقام العربية المكتوبة تتحوّل إلى لاتينية في الحقل", R.arDigits === "055011", R.arDigits);
  t("حقل البحث/التصفية: لصق هاتف +213 يصير 0550112233 فقط", R.hasSearch && R.smartPrevented && R.smart === "0550112233", [R.hasSearch, R.smart]);
  t("حقل البحث: لصق اسم أو رقم غير هاتف يبقى لصقاً عادياً، والأرقام العربية تُحوَّل", R.namePrevented === false && R.nonPhonePrevented === false && R.searchAr === "055", R);
  t("حقول «إضافة طلب» (mo-*) لا يمسّها (لها معالجها)", R.moSkipped, R);
  t("حقل هاتف القائمة السوداء أيضاً", R.bl === "0661234567", R.bl);
  t("التحقق يجد الطلب من لصق «الهاتف: +213 …» ومن أرقام عربية", R.found === 1 && R.foundAr === 1, [R.found, R.foundAr]);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
