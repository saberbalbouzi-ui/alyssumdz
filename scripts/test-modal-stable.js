/* نوافذ اللوحة لا تتحرك عند تغيّر ارتفاع محتواها (ضغط زر يضيف/يحذف سطراً): الموضع العلوي ثابت، ولا ترتفع إلا إن لم تتسع. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1000, height: 760 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  await p.evaluate(() => { document.getElementById("app").classList.remove("hidden"); Admin.showNotice("نافذة تجريبية", "<div id='nb'>سطر <button class='small' id='addrow' type='button'>أضف</button></div>"); });
  await p.waitForTimeout(700);
  const top = () => p.evaluate(() => Math.round(document.querySelector("#notice-modal-bg .modal").getBoundingClientRect().top));
  const t0 = await top();
  await p.evaluate(() => { const nb = document.getElementById("nb"); for (let i = 0; i < 4; i++) nb.insertAdjacentHTML("beforeend", "<div style='height:40px'>صف " + i + "</div>"); });
  await p.waitForTimeout(500); const t1 = await top();
  await p.evaluate(() => { const nb = document.getElementById("nb"); [...nb.querySelectorAll("div")].slice(0, 3).forEach(d => d.remove()); });
  await p.waitForTimeout(500); const t2 = await top();
  const h0 = await p.evaluate(() => document.querySelector("#notice-modal-bg .modal").offsetHeight);
  t("موضعها الأول لم يتغيّر (متوسِّطة كما ظهرت)", Math.abs(t0 - Math.round((760 - h0) / 2)) <= 40, { t0, h0, centered: Math.round((760 - h0) / 2) });
  t("نافذة صغيرة: لا تتحرك عند نموّ المحتوى ولا عند انكماشه", t1 === t0 && t2 === t0 && t0 > 100, { t0, t1, t2 });
  await p.evaluate(() => { const nb = document.getElementById("nb"); for (let i = 0; i < 30; i++) nb.insertAdjacentHTML("beforeend", "<div style='height:40px'>طويل " + i + "</div>"); });
  await p.waitForTimeout(500); const r = await p.evaluate(() => { const m = document.querySelector("#notice-modal-bg .modal").getBoundingClientRect(); return { top: Math.round(m.top), bottom: Math.round(m.bottom) }; });
  t("محتوى أطول من الشاشة: تُرفع بالقدر اللازم فقط وتبقى داخل الشاشة", r.top >= 0 && r.bottom <= 760 + 2, r);
  await p.evaluate(() => document.getElementById("notice-modal-bg").classList.remove("open")); await p.waitForTimeout(600);
  const un = await p.evaluate(() => { const bg = document.getElementById("notice-modal-bg"); return { ai: bg.style.alignItems, mt: bg.querySelector(".modal").style.marginTop }; });
  t("عند الإغلاق تُرفع التثبيتات (تعود الإعدادات الأصلية)", un.ai === "" && un.mt === "", un);
  /* تبويب التجهيز: «جُهِّز ✓» يعيد رسم القائمة كلها ولا يجوز أن يقفز التمرير */
  const K = await p.evaluate(async () => {
    const host = document.createElement("div"); host.id = "keep-host"; host.style.cssText = "height:300px;overflow:auto"; document.body.appendChild(host);
    const render = () => { host.innerHTML = "<div class='w' style='height:200px;overflow:auto'>" + Array.from({ length: 60 }, (_, i) => "<div style='height:30px'>r" + i + "</div>").join("") + "</div><div style='height:900px'></div>"; };
    render(); document.documentElement.style.minHeight = "3000px"; host.scrollTop = 120; host.firstChild.scrollTop = 300; window.scrollTo(0, 400);
    AdminKeep.run(host, render); await new Promise(r => setTimeout(r, 120));
    return { win: Math.round(window.scrollY), box: Math.round(host.scrollTop), inner: Math.round(host.firstChild.scrollTop) }; });
  t("AdminKeep: إعادة الرسم تحفظ تمرير الصفحة وحاوية التمرير الداخلية", K.win === 400 && K.box === 120 && K.inner === 300, K);
  const PK = await p.evaluate(async () => {
    const tab = document.getElementById("tab-pack"); tab.classList.remove("hidden"); document.getElementById("app").classList.remove("hidden"); AdminPack._S.host = tab; tab._pk = 0;
    AdminPack._S.rows = Array.from({ length: 90 }, (_, i) => ({ id: "P" + i, name: "ز" + i, wilaya: "Alger", items: "منتج" + i + " ×1 = 2000 DA", tracking: "TT" + i, packed: false, status: "confirmee" })); AdminPack._S.f = "all"; AdminPack._S.busy = false;
    AdminPack.draw(); document.documentElement.style.minHeight = "6000px"; await new Promise(r => setTimeout(r, 200));
    const sc = tab.parentElement; sc.style.cssText += ";height:500px;overflow:auto"; const btn = [...tab.querySelectorAll('[data-pk="one"]')][40]; btn.scrollIntoView({ block: "center" }); const y0 = Math.round(sc.scrollTop);
    btn.click(); await new Promise(r => setTimeout(r, 900)); return { y0, y1: Math.round(sc.scrollTop), rows: tab.querySelectorAll("tr[data-id]").length }; });
  t("«جُهِّز ✓» في تبويب التجهيز: لا تقفز الشاشة بعد إعادة رسم القائمة", PK.y0 > 500 && Math.abs(PK.y1 - PK.y0) <= 3 && PK.rows > 40, PK);
  /* القائمة لا «تتحرك» تحت إصبعك: بعد «جُهِّز ✓» يختفي الصف وتنقص قائمة الجمع فوقه، والصف التالي يبقى في مكانه على الشاشة */
  const AN = await p.evaluate(async () => {
    const tab = document.getElementById("tab-pack"); AdminPack._S.f = "todo"; AdminPack._S.rows.forEach(r => { r.packed = false; }); AdminPack.draw(); await new Promise(r => setTimeout(r, 200));
    const rowTop = id => { const e = tab.querySelector('tr[data-id="' + id + '"]'); return e ? e.getBoundingClientRect().top : null; };
    const sc = tab.parentElement; const ids = [...tab.querySelectorAll("tr[data-id]")].map(e => e.dataset.id); const mid = ids[40]; tab.querySelector('tr[data-id="' + mid + '"]').scrollIntoView({ block: "center" }); await new Promise(r => setTimeout(r, 100));
    const nxt = ids[41], before = rowTop(mid); tab.querySelector('tr[data-id="' + mid + '"] button').dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); AdminPack._S.rows.find(r => r.id === mid).packed = true; AdminPack.draw(); await new Promise(r => setTimeout(r, 200));
    return { before: Math.round(before), after: Math.round(rowTop(nxt)), gone: !tab.querySelector('tr[data-id="' + mid + '"]') }; });
  t("بعد تجهيز صف: الصف التالي يحلّ مكان الصف المضغوط تماماً (لا تقفز القائمة)", AN.gone && Math.abs(AN.before - AN.after) <= 3, AN);
  /* ترتيب القائمة لا يتغيّر بتجهيز طلب (كان يُعاد ترتيب المجموعات حسب الأعداد فتقفز الصفوف) */
  const OR = await p.evaluate(() => {
    const mk = (id, it) => ({ id, name: "n" + id, wilaya: "Alger", items: it + " ×1 = 1 DA", tracking: "T" + id, packed: false });
    const rows = [mk("1", "ب"), mk("2", "أ"), mk("3", "أ"), mk("4", "أ"), mk("5", "ج"), mk("6", "ب"), mk("7", "ج"), mk("8", "ب")];
    const before = AdminPack.filter(rows, "todo", "").map(r => r.id).join(","); rows.find(r => r.id === "2").packed = true;
    const after = AdminPack.filter(rows, "todo", "").map(r => r.id).join(","); return { before, after }; });
  t("تجهيز طلب لا يعيد ترتيب بقية القائمة (فقط يختفي الصف)", OR.after === OR.before.split(",").filter(x => x !== "2").join(","), OR);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
