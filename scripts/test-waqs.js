/* WhatsApp Quick Sender (للمالك فقط): تطبيع الهاتف الدولي، بناء رابط wa.me وترميز عربي/إنجليزي، المتغيرات، CSV، حارس التكرار، تسجيل الحالة يدوياً فقط (فتح الرابط لا يغيّر الحالة)، الفرنسية، وغياب القسم عند غير المالك. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = [];
  async function page(seller) {
    const p = await b.newPage({ viewport: { width: 420, height: 900 } }); p.on("pageerror", e => errs.push(String(e).slice(0, 160)));
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
    await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.route(/wa\.me/, r => r.abort());
    await p.addInitScript(s => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.removeItem("alyssum_waqs"); } catch (e) { } window.__S = s; }, seller);
    if (!seller) await p.route(/\/admin\.html(\?.*)?$/, async r => { const res = await r.fetch(); let body = await res.text(); const cfg = require("fs").readFileSync("assets/js/config.js", "utf8").replace(/SELLER:\s*true/, "SELLER: false"); body = body.replace('<script src="assets/js/config.js"></script>', () => "<script>" + cfg + "</script>"); r.fulfill({ response: res, body }); });
    await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500); return p;
  }
  const p = await page(true);
  const U = await p.evaluate(() => {
    const W = AdminWaqs, o = {}; o.off = !!W.off;
    o.p1 = W.normPhone("+213 550-12-34-56").num; o.p2 = W.normPhone("0550123456", "الجزائر").num; o.p3 = W.normPhone("00213550123456").num; o.p4 = W.normPhone("٠٥٥٠١٢٣٤٥٦", "dz").num; o.p5 = W.normPhone("0550123456").ok; o.p6 = W.normPhone("abc").ok; o.p7 = W.normPhone("+33 6 12 34 56 78").num; o.p8 = W.normPhone("12345").ok;
    const c = { name: "سمير بن علي", company: "Delta Corp", phone: "+213550123456", country: "الجزائر" };
    o.r = W.render("مرحباً {name} ({first}) من {{company}} {phone} {country} {x}", c);
    const msg = "مرحبا سمير 👋\nHello & welcome? 100% #1 +ok = «test»‏";
    const u = W.waUrl("213550123456", msg); o.u = u; o.rt = decodeURIComponent(u.split("?text=")[1]) === msg; o.noRaw = !/[ \n#]/.test(u);
    o.csv = W.mapRows(W.parseCsv("﻿الاسم;الشركة;الهاتف;الدولة;ملاحظات\n\"علي; محمد\";شركة أ;0551112233;الجزائر;\"ملاحظة\nسطرين\"\nJohn;;+33612345678;France;\n")); return o; });
  t("الوحدة تعمل للمالك", U.off === false, U);
  t("تطبيع الهاتف: دولي، محلي+دولة، 00، أرقام عربية، رفض غير الصالح", U.p1 === "213550123456" && U.p2 === "213550123456" && U.p3 === "213550123456" && U.p4 === "213550123456" && U.p5 === false && U.p6 === false && U.p7 === "33612345678" && U.p8 === false, U);
  t("المتغيرات تُستبدل (وغير المعروف يبقى)", U.r === "مرحباً سمير بن علي (سمير) من Delta Corp +213550123456 الجزائر {x}", U.r);
  t("رابط wa.me: ترميز عربي/إنجليزي/إيموجي/أسطر/رموز خاصة ويرجع للنص نفسه", /^https:\/\/wa\.me\/213550123456\?text=/.test(U.u) && U.rt && U.noRaw, U);
  t("CSV: فاصلة منقوطة وحقول بين علامات اقتباس وعناوين عربية وإنجليزية", U.csv.length === 2 && U.csv[0].name === "علي; محمد" && U.csv[0].company === "شركة أ" && /سطرين/.test(U.csv[0].notes) && U.csv[1].name === "John" && U.csv[1].phone === "+33612345678", U.csv);

  /* الواجهة */
  await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; window.__conf = []; window.confirm = m => { window.__conf.push(m); return window.__ans !== false; }; Admin.tab("waqs", document.querySelector("[onclick*=\"'waqs'\"]")); await new Promise(r => setTimeout(r, 500)); });
  await p.waitForTimeout(1500); await p.evaluate(async () => { for (let i = 0; i < 3 && document.getElementById("tab-waqs").classList.contains("hidden"); i++) { Admin.tab("waqs", document.querySelector("[onclick*=\"'waqs'\"]")); await new Promise(r => setTimeout(r, 500)); } });
  const nav = await p.evaluate(() => ({ cls: document.getElementById("tab-waqs").className, cur: [...document.querySelectorAll(".admin-extra-tab:not(.hidden)")].map(x => x.id).join(), btn: !!document.querySelector("[onclick*=\"'waqs'\"]"), pane: !document.getElementById("tab-waqs").classList.contains("hidden"), icon: !!document.querySelector("[onclick*=\"'waqs'\"] .nav-ic") }));
  t("زر القسم ولوحته ظاهران للمالك", nav.btn && nav.pane, nav);
  /* إضافة جهة عبر النافذة */
  await p.click("[data-wq=add]"); await p.fill("#wf-n", "سمير بن علي"); await p.fill("#wf-c", "Delta Corp"); await p.fill("#wf-p", "0550123456"); await p.fill("#wf-k", "الجزائر"); await p.fill("#wf-t", "عميل محتمل");
  await p.click("#wf-ok"); await p.waitForTimeout(400);
  const d1 = await p.evaluate(() => ({ n: AdminWaqs.S.doc.contacts.length, sel: !!AdminWaqs.S.sel, go: document.getElementById("wq-go").getAttribute("href"), txt: document.getElementById("wq-go").textContent.trim(), tgt: document.getElementById("wq-go").target, rel: document.getElementById("wq-go").rel }));
  t("إضافة جهة: تُحفظ وتفتح صفحتها وزر «فتح WhatsApp» يستهدف تبويباً جديداً بـnoopener", d1.n === 1 && d1.sel && d1.txt === "فتح WhatsApp" && d1.tgt === "_blank" && /noopener/.test(d1.rel), d1);
  /* رقم مكرَّر ورقم غير صالح */
  await p.click("[data-wq=back]"); await p.click("[data-wq=add]"); await p.fill("#wf-n", "آخر"); await p.fill("#wf-p", "+213 550 12 34 56"); await p.click("#wf-ok");
  const e1 = await p.evaluate(() => document.getElementById("wf-e").textContent); await p.fill("#wf-p", "12"); await p.click("#wf-ok"); const e2 = await p.evaluate(() => document.getElementById("wf-e").textContent); await p.click("#wf-no");
  t("رفض الرقم المكرَّر والرقم غير الصالح", /مسجَّل لـ/.test(e1) && /غير صالح/.test(e2), { e1, e2 });
  /* كتابة الرسالة ← الرابط يتبعها */
  await p.click("[data-id]"); await p.waitForTimeout(200);
  await p.fill("#wq-msg", "السلام عليكم {first}، عن {company} & الأسعار؟"); await p.waitForTimeout(200);
  const h = await p.evaluate(() => ({ href: document.getElementById("wq-go").getAttribute("href"), prev: document.getElementById("wq-prev").textContent }));
  t("المعاينة والرابط يتبعان نص الرسالة بالمتغيرات", h.prev === "السلام عليكم سمير، عن Delta Corp & الأسعار؟" && decodeURIComponent(h.href.split("?text=")[1]) === h.prev && h.href.startsWith("https://wa.me/213550123456?text="), h);
  /* الضغط على الزر: يُعلَّم «فُتحت» ولا يُسجَّل إرسال ولا تتغير الحالة */
  await p.evaluate(() => { document.getElementById("wq-go").addEventListener("click", e => e.preventDefault(), true); }); await p.click("#wq-go"); await p.waitForTimeout(700);
  const o1 = await p.evaluate(() => { const c = AdminWaqs.S.doc.contacts[0]; return { opened: !!c.opened, log: (c.log || []).length, pill: document.querySelector("#waqs .wq-pill").textContent.trim(), warn: /لم تُسجَّل نتيجتها/.test(document.getElementById("waqs").innerText) }; });
  t("فتح WhatsApp لا يسجّل «تم الإرسال» ولا يغيّر الحالة (يظهر تنبيه «لم تُسجَّل نتيجتها»)", o1.opened && o1.log === 0 && o1.pill === "بلا تواصل" && o1.warn, o1);
  /* تسجيل الحالة يدوياً */
  await p.click("[data-wq=log]", { force: true }).catch(() => { }); const dis = await p.evaluate(() => document.querySelector("[data-wq=log]").disabled);
  await p.click("[data-k=sent]"); await p.fill("#wq-note", "أُرسلت عبر Business"); await p.click("[data-wq=log]"); await p.waitForTimeout(400);
  const s1 = await p.evaluate(() => { const c = AdminWaqs.S.doc.contacts[0], l = c.log[0]; return { n: c.log.length, st: l.st, note: l.note, msg: l.msg, pill: document.querySelector("#waqs .wq-pill").textContent.trim() }; });
  t("التسجيل اليدوي: الزر معطَّل قبل اختيار حالة، ثم يُحفظ بالحالة والملاحظة ونص الرسالة المفتوحة", dis === true && s1.n === 1 && s1.st === "sent" && s1.note === "أُرسلت عبر Business" && /السلام عليكم سمير/.test(s1.msg) && s1.pill === "تم الإرسال", { dis, s1 });
  /* حارس التكرار: confirm عند فتح جهة تواصلنا معها حديثاً */
  await p.evaluate(() => { window.__conf = []; window.__ans = false; });
  const href0 = await p.evaluate(() => document.getElementById("wq-go").getAttribute("href"));
  await p.evaluate(() => { document.getElementById("wq-go").click(); }); await p.waitForTimeout(300);
  const g1 = await p.evaluate(() => ({ conf: window.__conf.slice(), opened: AdminWaqs.S.doc.contacts[0].opened })); const before = g1.opened && g1.opened.at;
  t("حارس التكرار: يعرض آخر رسالة وحالتها السابقة ويطلب التأكيد، والرفض لا يُحدّث «فُتحت»", g1.conf.length === 1 && /تم الإرسال/.test(g1.conf[0]) && /آخر رسالة/.test(g1.conf[0]) && /السلام عليكم/.test(g1.conf[0]), g1);
  /* إلغاء التواصل يحجب الزر */
  await p.click("[data-k=out]"); await p.click("[data-wq=log]"); await p.waitForTimeout(300);
  const out = await p.evaluate(() => { const a = document.getElementById("wq-go"); return { off: a.classList.contains("off"), href: a.getAttribute("href"), reopen: !!document.querySelector("[data-wq=reopen]") }; });
  t("«إلغاء التواصل» يعطّل زر فتح WhatsApp ويعرض رفع الإلغاء", out.off && out.href === "#" && out.reopen, out);
  await p.click("[data-wq=reopen]"); await p.waitForTimeout(300);
  const ro = await p.evaluate(() => { const a = document.getElementById("wq-go"); return { off: a.classList.contains("off"), href: a.getAttribute("href").slice(0, 30), n: AdminWaqs.S.doc.contacts[0].log.length }; });
  t("رفع الإلغاء يعيد التفعيل ويُسجَّل في التاريخ", !ro.off && /wa\.me/.test(ro.href) && ro.n === 3, ro);
  /* حذف سجلّ واحد ثم الاستيراد والبحث والتصفية */
  await p.evaluate(() => { window.__ans = true; });
  await p.click("[data-wq=back]"); await p.click("[data-wq=imp]");
  await p.setInputFiles("#wi-f", { name: "c.csv", mimeType: "text/csv", buffer: Buffer.from("name,company,phone,country,notes\nAli,Beta,0661000001,الجزائر,\nSara,Gamma,+33612345678,France,\nBad,X,12,,\nDup,Y,+213550123456,,\n", "utf8") }); await p.waitForTimeout(400);
  const im = await p.evaluate(() => document.getElementById("wi-r").textContent); await p.click("#wi-ok"); await p.waitForTimeout(400);
  const n2 = await p.evaluate(() => AdminWaqs.S.doc.contacts.map(c => c.name + ":" + c.phone).join("|"));
  t("استيراد CSV: يقبل الصالح الجديد فقط ويتجاوز المكرَّر وغير الصالح ويعرض الملخص", /جديدة صالحة: 2/.test(im) && /مكرَّرة \(موجودة\): 1/.test(im) && /غير صالح: 1/.test(im) && /Ali:0661000001/.test(n2) && /Sara:\+33612345678/.test(n2) && !/Bad|Dup/.test(n2), { im, n2 });
  await p.fill("#wq-q", "gamma"); await p.waitForTimeout(200); const f1 = await p.evaluate(() => document.querySelectorAll("#waqs .wq-row").length);
  await p.fill("#wq-q", "0661"); await p.waitForTimeout(200); const f2 = await p.evaluate(() => document.querySelectorAll("#waqs .wq-row").length);
  await p.fill("#wq-q", ""); await p.selectOption("#wq-f", "none"); await p.waitForTimeout(200); const f3 = await p.evaluate(() => document.querySelectorAll("#waqs .wq-row").length);
  await p.selectOption("#wq-f", "sent"); await p.waitForTimeout(200); const f4 = await p.evaluate(() => document.querySelectorAll("#waqs .wq-row").length);
  t("البحث (اسم/شركة/رقم) وتصفية الحالة: بلا تواصل بعد وتم الإرسال", f1 === 1 && f2 === 1 && f3 === 2 && f4 === 0, { f1, f2, f3, f4 });
  /* الاستمرارية: الحفظ في Priv وإعادة التحميل */
  const pr = await p.evaluate(async () => { await new Promise(r => setTimeout(r, 900)); const d = await Priv.get("waqs", null); return d && d.contacts && d.contacts.length; });
  t("البيانات تُحفظ في الإعدادات الخاصة (Priv) لا في صفحة عامة", pr === 3, pr);
  /* الفرنسية */
  await p.evaluate(async () => { AdminWaqs.S.f = ""; AdminWaqs.S.sel = null; await AdminI18n.set("fr"); }); await p.waitForTimeout(1500);
  const fr = await p.evaluate(() => { document.querySelector("#waqs .wq-row").click(); return new Promise(r => setTimeout(() => r(document.getElementById("waqs").innerText), 400)); });
  t("الواجهة بالفرنسية بلا بقايا عربية في النصوص الثابتة", /Ouvrir WhatsApp/.test(fr) && /Historique des contacts/.test(fr) && !/[؀-ۿ]/.test(fr.replace(/Delta Corp|الجزائر|[؀-ۿ]+(?=[^\n]*$)/g, "").split("\n").filter(l => !/(Ali|Sara|Beta|Gamma|سمير|Delta)/.test(l)).join("\n")), fr.slice(0, 700));
  await p.evaluate(() => AdminI18n.set("ar")); await p.waitForTimeout(800);

  /* غير المالك: لا وحدة ولا زر ولا لوحة وبيانات غير مقروءة */
  const q = await page(false);
  const G = await q.evaluate(() => ({ off: typeof AdminWaqs === "undefined" || !!AdminWaqs.off, loaded: !![...document.scripts].some(s => /admin-waqs/.test(s.src)), tabs: (typeof TAB_PERM !== "undefined") }));
  t("غير المالك (SELLER=false): لا يُحمَّل ملف الوحدة ولا تعمل", G.off && !G.loaded, G);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
