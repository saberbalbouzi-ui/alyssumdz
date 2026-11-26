/* تغيير رابط صفحة الهبوط ونسخها بنوافذ داخل التطبيق (لا prompt/confirm الأصلية) + رسائل واضحة بدل الصمت، وتفعيل «المسار» تلقائياً مع «الرسمية». NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  p.on("dialog", d => { errs.push("native dialog: " + d.type()); d.dismiss(); });
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  await p.evaluate(() => { document.getElementById("app").classList.remove("hidden"); window.__t = []; window.toast = m => window.__t.push(String(m)); window.__put = [];
    const pg = { v: 1, title: "صفحة", slug: "aa", ff: "Cairo", css: "", sections: [{ id: "s1", set: { kind: "canvas", mh: { d: 300 } }, free: [], cols: [{ id: "c", widgets: [] }] }] };
    GH.getFile = async path => { if (/index\.json$/.test(path)) return { sha: "s", content: btoa(unescape(encodeURIComponent(JSON.stringify(PBAdmin.list)))) }; throw new Error("404"); };
    GH.putFile = async (path, c, sha, msg) => { window.__put.push(path); return { content: { sha: "n" } }; };
    PBAdmin.load = async () => JSON.parse(JSON.stringify(pg)); PBAdmin.list = [{ slug: "aa", title: "صفحة", live: true }];
    if (!document.getElementById("pb-list")) { const d = document.createElement("div"); d.id = "pb-list"; document.body.appendChild(d); } });
  const T = () => p.evaluate(() => window.__t.slice());
  await p.evaluate(() => PBAdmin.rename("aa")); await p.waitForTimeout(300);
  t("نافذة إدخال داخل التطبيق (لا prompt أصلية)", await p.evaluate(() => !!document.getElementById("pbx-pr")));
  await p.mouse.click(6, 6); await p.waitForTimeout(150);
  t("النقر خارجها لا يغلقها", await p.evaluate(() => !!document.getElementById("pbx-pr")));
  await p.fill("#pbx-pr-in", "aa"); await p.click('#pbx-pr [data-k="ok"]'); await p.waitForTimeout(300);
  t("نفس الرابط: رسالة واضحة لا صمت", (await T()).some(x => /لم يتغيّر/.test(x)), await T());
  await p.evaluate(() => PBAdmin.rename("aa")); await p.waitForTimeout(200); await p.fill("#pbx-pr-in", "bb-new"); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
  t("بعد الإدخال يظهر تأكيد داخل التطبيق", await p.evaluate(() => !!document.getElementById("pbx-ask")));
  await p.click('#pbx-ask [data-k="ok"]'); await p.waitForTimeout(1500);
  const put = await p.evaluate(() => window.__put.slice());
  t("كُتبت صفحة الرابط الجديد والفهرس وتحويل القديم", put.includes("lp/bb-new/index.html") && put.includes("assets/pages/bb-new.json") && put.includes("assets/pages/index.json") && put.includes("lp/aa/index.html"), put);
  t("القائمة تعرض الرابط الجديد فوراً (بلا انتظار قراءة المستودع)", await p.evaluate(() => /bb-new/.test(document.getElementById("pb-list").innerHTML) && !/\/aa\/?"/.test(document.getElementById("pb-list").innerHTML)), (await T()).slice(-3));
  await p.evaluate(() => PBAdmin.rename("bb-new")); await p.waitForTimeout(200); await p.click('#pbx-pr [data-k="no"]'); await p.waitForTimeout(150);
  t("زر إلغاء يغلق النافذة", await p.evaluate(() => !document.getElementById("pbx-pr")));
  /* تعديل الرابط مباشرة في البطاقة بقلم؛ وحذف زرّي «اسم الرابط» و«تغيير الرابط» */
  await p.evaluate(async () => { window.__put = []; await PBAdmin.refresh(true); const l = document.getElementById("pb-list"); document.body.appendChild(l); l.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:50;background:#222;color:#fff;padding:20px"; });
  t("لا زرّ «اسم الرابط» في البطاقة ولا «تغيير الرابط» في التعديل السريع", await p.evaluate(() => !/اسم الرابط/.test(document.getElementById("pb-list").innerHTML)) && await p.evaluate(() => !/تغيير الرابط/.test(document.getElementById("pq-bg").innerHTML)));
  t("قلم تعديل بجانب الرابط", await p.evaluate(() => !!document.querySelector('#pb-list .pbx-url button[title="تعديل الرابط"]')));
  await p.click('#pb-list .pbx-url button[title="تعديل الرابط"]'); await p.waitForTimeout(200);
  t("الضغط على القلم يحوّل الرابط إلى حقل تعديل مباشر في مكانه", await p.evaluate(() => { const i = document.querySelector("#pb-list .pbx-slugin"); return !!i && i.value === "bb-new" && document.activeElement === i; }));
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  t("Esc يعيد الرابط كما كان", await p.evaluate(() => !document.querySelector("#pb-list .pbx-slugin") && /bb-new/.test(document.querySelector("#pb-list .pbx-url").innerHTML)));
  await p.click('#pb-list .pbx-url button[title="تعديل الرابط"]'); await p.fill("#pb-list .pbx-slugin", "cc-final"); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
  await p.click('#pbx-ask [data-k="ok"]'); await p.waitForTimeout(1500);
  const put2 = await p.evaluate(() => window.__put.slice());
  t("Enter ثم تأكيد يغيّر الرابط فعلاً ويظهر في البطاقة", put2.includes("lp/cc-final/index.html") && await p.evaluate(() => /cc-final/.test(document.getElementById("pb-list").innerHTML)), put2);
  /* رابط معروض هو رابط المنتج (مسار): الحقل يحمل رابط الصفحة الحقيقي مع تنبيه لا اسم المنتج */
  await p.evaluate(async () => { Admin.products = [{ slug: "prodx", title: "م", route: "cc-final" }]; await PBAdmin.refresh(true); });
  await p.click('#pb-list .pbx-url button[title="تعديل الرابط"]'); await p.waitForTimeout(200);
  t("الرابط المعروض رابط المنتج: الحقل برابط الصفحة الحقيقي مع تنبيه", await p.evaluate(() => { const b = document.querySelector("#pb-list .pbx-url"); return b.querySelector("input").value === "cc-final" && !/prodx\/$/.test(b.firstElementChild.firstElementChild.textContent) && /رابط المنتج/.test(b.textContent); }), await p.evaluate(() => document.querySelector("#pb-list .pbx-url").textContent));
  await p.keyboard.press("Escape");
  /* التعديل السريع: تفعيل «الرسمية» يفعّل «المسار» معها (قابل للإلغاء) */
  await p.evaluate(async () => { Admin.products = [{ slug: "prod", title: "منتج" }]; await PBAdmin.quick("bb-new"); await new Promise(r => setTimeout(r, 400)); document.getElementById("pq-prod").value = "prod"; });
  await p.click("#pq-off"); await p.waitForTimeout(150);
  t("تفعيل الصفحة الرسمية يفعّل المسار تلقائياً", await p.evaluate(() => document.getElementById("pq-route").checked));
  await p.click("#pq-route"); await p.waitForTimeout(100);
  t("ويمكن إلغاء المسار يدوياً", await p.evaluate(() => !document.getElementById("pq-route").checked));
  t("بلا نوافذ أصلية ولا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
