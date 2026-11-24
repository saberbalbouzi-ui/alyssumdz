/* WhatsApp Quick Sender (للمالك فقط): قائمة رسائل جاهزة تُستورد (JSON/CSV) أو تُضاف يدوياً وتُربط بالجهة والحملة والرسالة الأم، رابط wa.me بالنص النهائي وترميزه، فتح الرابط لا يسجّل إرسالاً، التسجيل اليدوي يحفظ نسخة المُرسَل، حارس التكرار، القوالب المساعدة الاختيارية، الفرنسية، وغياب القسم عند غير المالك. NODE_PATH=/opt/node-tools/node_modules */
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
  const SHOW = async () => { await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; for (let i = 0; i < 3 && document.getElementById("tab-waqs").classList.contains("hidden"); i++) { Admin.tab("waqs", document.querySelector("[onclick*=\"'waqs'\"]")); await new Promise(r => setTimeout(r, 500)); } }); };
  const U = await p.evaluate(() => {
    const W = AdminWaqs, o = {}; o.off = !!W.off;
    o.p1 = W.normPhone("+213 550-12-34-56").num; o.p2 = W.normPhone("0550123456", "الجزائر").num; o.p3 = W.normPhone("00213550123456").num; o.p4 = W.normPhone("٠٥٥٠١٢٣٤٥٦", "dz").num; o.p5 = W.normPhone("0550123456").ok; o.p6 = W.normPhone("abc").ok; o.p7 = W.normPhone("+33 6 12 34 56 78").num; o.p8 = W.normPhone("12345").ok;
    const msg = "مرحبا سمير 👋\nHello & welcome? 100% #1 +ok = «test»‏"; const u = W.waUrl("213550123456", msg); o.u = u; o.rt = decodeURIComponent(u.split("?text=")[1]) === msg; o.noRaw = !/[ \n#]/.test(u);
    const c = { name: "Karim Benali", company: "Atlas Trading", phone: "+213550123456", country: "الجزائر" };
    o.r1 = W.render("Hello {first},\n{company} {in_country}", c, "en"); o.r2 = W.render("Bonjour {first}, {company} {in_country}", { name: "", company: "", country: "" }, "fr"); o.r3 = W.render("مرحباً {first}، {in_country}", c, "ar"); o.r4 = W.render("{sender} {my_company} {offer}", c, "en", { name: "", company: "", offer: {} }); o.r5 = W.render("{sender}/{offer}", c, "fr", { name: "Sam", company: "X", offer: { fr: "miel" } }); o.r6 = W.render("Bonjour {first}, {in_country}", { name: "Lea", country: "France" }, "fr");
    o.csv = W.mapRows(W.parseCsv("﻿الاسم;الشركة;الهاتف;الدولة;ملاحظات\n\"علي; محمد\";شركة أ;0551112233;الجزائر;\"ملاحظة\nسطرين\"\nJohn;;+33612345678;France;\n"));
    /* رسائل جاهزة: JSON وCSV بنص متعدد الأسطر وفواصل داخل الاقتباس */
    const j = W.rowsFromText(JSON.stringify([{ company: "Delta", contact: "Sam", phone: "+213550000001", language: "English", type: "First Contact", campaign: "C1", message: "Hello Sam,\nOne, two." }])); o.j = j.rows[0];
    const cs = W.rowsFromText('company,contact,phone,language,message_type,campaign,message\nGamma,Lea,+33612345678,Français,Relance,C2,"Bonjour Lea,\nsuite à mon message."\n'); o.cs = cs.rows[0]; o.badJson = W.rowsFromText("[{bad").err !== "";
    return o; });
  t("الوحدة تعمل للمالك", U.off === false, U);
  t("تطبيع الهاتف: دولي، محلي+دولة، 00، أرقام عربية، رفض غير الصالح", U.p1 === "213550123456" && U.p2 === "213550123456" && U.p3 === "213550123456" && U.p4 === "213550123456" && U.p5 === false && U.p6 === false && U.p7 === "33612345678" && U.p8 === false, U);
  t("رابط wa.me: ترميز عربي/إنجليزي/إيموجي/أسطر/رموز خاصة ويرجع للنص نفسه", /^https:\/\/wa\.me\/213550123456\?text=/.test(U.u) && U.rt && U.noRaw, U);
  t("القوالب المساعدة: الدولة باللغة المناسبة وصياغة محايدة عند الغياب وتنظيف الفاصلة", U.r1 === "Hello Karim,\nAtlas Trading in Algeria" && U.r2 === "Bonjour, votre société dans votre région" && U.r3 === "مرحباً Karim، في الجزائر" && U.r6 === "Bonjour Lea, en France", U);
  t("هوية المرسل الناقصة تبقى متغيراً ظاهراً (لا تُملأ بفراغ)، والمكتملة تُستبدل بلغتها", U.r4 === "{sender} {my_company} {offer}" && U.r5 === "Sam/miel", U);
  t("CSV جهات: فاصلة منقوطة وحقول بين علامات اقتباس وعناوين عربية", U.csv.length === 2 && U.csv[0].name === "علي; محمد" && /سطرين/.test(U.csv[0].notes) && U.csv[1].name === "John", U.csv);
  t("استيراد الرسائل: JSON وCSV (عناوين مرنة، نص متعدد الأسطر وفاصلة داخل الاقتباس) وJSON تالف يُرفض", U.j.company === "Delta" && U.j.message === "Hello Sam,\nOne, two." && U.j.lang === "English" && U.cs.type === "Relance" && U.cs.message === "Bonjour Lea,\nsuite à mon message." && U.badJson, U);

  /* الواجهة: لا بيانات وهمية */
  await p.waitForTimeout(4000); await SHOW();
  const E = await p.evaluate(() => ({ c: AdminWaqs.S.doc.contacts.length, m: AdminWaqs.S.doc.msgs.length, txt: document.getElementById("waqs").innerText, pane: !document.getElementById("tab-waqs").classList.contains("hidden") }));
  t("زر القسم ظاهر للمالك، والقائمة فارغة بلا جهات أو رسائل وهمية", E.pane && E.c === 0 && E.m === 0 && /لا رسائل جاهزة للإرسال/.test(E.txt), E);
  /* استيراد رسائل جاهزة (من ChatGPT) عبر النافذة */
  const rows = [
    { company: "Delta Corp", contact: "Sam Rivers", phone: "+213550123456", language: "EN", type: "First Contact", campaign: "Spring EU", ref: "d1", message: "Hello Sam,\n\nThis is a prepared first message for Delta Corp & partners? 100% #1." },
    { company: "Delta Corp", contact: "Sam Rivers", phone: "+213550123456", language: "EN", type: "Follow-up", campaign: "Spring EU", ref: "d2", parent: "d1", message: "Hello Sam, a short follow-up on my previous message." },
    { company: "Gamma SARL", contact: "Léa Martin", phone: "+33612345678", language: "FR", type: "First Contact", campaign: "Spring EU", ref: "g1", message: "Bonjour Léa,\n\nMessage préparé pour Gamma." },
    { company: "Gamma SARL", contact: "Léa Martin", phone: "+33612345678", language: "FR", type: "First Contact", campaign: "Spring EU", message: "Bonjour   Léa,\n\nMessage préparé pour Gamma." },
    { company: "Bad", contact: "X", phone: "12", language: "EN", type: "First Contact", message: "no phone" }
  ];
  await p.click("[data-wq=impm]"); await p.fill("#wm-t", JSON.stringify(rows)); await p.waitForTimeout(300);
  const im = await p.evaluate(() => document.getElementById("wm-r").textContent); await p.click("#wm-ok"); await p.waitForTimeout(500);
  const Q = await p.evaluate(() => ({ m: AdminWaqs.S.doc.msgs.length, c: AdminWaqs.S.doc.contacts.length, fu: AdminWaqs.S.doc.msgs.find(x => x.type === "followup"), first: AdminWaqs.S.doc.msgs.find(x => x.ref === "d1"), rows: [...document.querySelectorAll("#waqs .wq-q:not(.wq-qh)")].map(r => r.innerText.replace(/\s+/g, " ").trim()), head: (document.querySelector("#waqs .wq-qh") || {}).innerText }));
  t("استيراد الرسائل: ملخص صحيح (3 جديدة، جهتان، مكرَّر واحد، غير صالح واحد)", /رسائل جديدة: 3/.test(im) && /جهات جديدة: 2/.test(im) && /مكرَّرة \(متخطّاة\): 1/.test(im) && /غير صالحة[^\n]*: 1/.test(im), im);
  t("الرسائل مربوطة بجهاتها وحملتها، والمتابعة مربوطة بالرسالة الأولى عبر ref", Q.m === 3 && Q.c === 2 && Q.fu.parent === Q.first.id && Q.first.campaign === "Spring EU" && Q.first.lang === "EN", Q);
  t("قائمة الإرسال: شركة | جهة اتصال | لغة | نوع الرسالة | الحالة (Ready to Send)", Q.rows.length === 3 && /Delta Corp Sam Rivers EN First Contact/.test(Q.rows.join("|")) && /Gamma SARL Léa Martin FR First Contact/.test(Q.rows.join("|")) && Q.rows.every(r => /Ready to Send/.test(r)) && /الشركة/.test(Q.head), Q);
  /* فتح جهة: النص النهائي والرابط */
  await p.click("[data-wq=open][data-mid]:has-text('Delta Corp') >> nth=0"); await p.waitForTimeout(300);
  const D = await p.evaluate(() => ({ head: document.querySelector("#waqs h2").textContent, prev: document.getElementById("wq-prev").textContent, href: document.getElementById("wq-go").getAttribute("href"), phone: document.getElementById("waqs").innerText.includes("+213550123456"), tgt: document.getElementById("wq-go").target, rel: document.getElementById("wq-go").rel, first: AdminWaqs.S.doc.msgs.find(x => x.ref === "d1").text }));
  t("فتح الجهة: الاسم والشركة والهاتف والنص النهائي كما أُعدّ، والرابط يحمله مشفَّراً (_blank/noopener)", /Sam Rivers/.test(D.head) && /Delta Corp/.test(D.head) && D.phone && D.prev === D.first && D.href.startsWith("https://wa.me/213550123456?text=") && decodeURIComponent(D.href.split("?text=")[1]) === D.first && D.tgt === "_blank" && /noopener/.test(D.rel), D);
  /* الضغط على الزر: لا إرسال مسجَّل ولا تغيّر حالة الرسالة */
  await p.evaluate(() => { window.__conf = []; window.__ans = true; window.confirm = m => { window.__conf.push(m); return window.__ans !== false; }; document.getElementById("wq-go").addEventListener("click", e => e.preventDefault(), true); });
  await p.click("#wq-go"); await p.waitForTimeout(700);
  const O = await p.evaluate(() => { const c = AdminWaqs.S.doc.contacts[0], m = AdminWaqs.S.doc.msgs.find(x => x.ref === "d1"); return { opened: !!c.opened, log: (c.log || []).length, status: m.status, sentText: m.sentText || "", warn: /لم تُسجَّل نتيجتها/.test(document.getElementById("waqs").innerText), conf: window.__conf.length }; });
  t("فتح WhatsApp لا يسجّل إرسالاً ولا يغيّر حالة الرسالة (تبقى Ready) ويظهر تنبيه «لم تُسجَّل نتيجتها»", O.opened && O.log === 0 && O.status === "ready" && !O.sentText && O.warn && O.conf === 0, O);
  /* تخصيص اختياري قبل الفتح ثم تسجيل «تم الإرسال»: تُحفظ نسخة النص المُرسَل فعلاً */
  await p.click("[data-wq=custom]"); await p.fill("#wq-msg", "Hello Sam, edited just before sending."); await p.waitForTimeout(200);
  const cu = await p.evaluate(() => ({ prev: document.getElementById("wq-prev").textContent, href: decodeURIComponent(document.getElementById("wq-go").getAttribute("href").split("?text=")[1]) }));
  await p.evaluate(() => { document.getElementById("wq-go").addEventListener("click", e => e.preventDefault(), true); }); await p.click("#wq-go"); await p.waitForTimeout(500);
  await p.click("[data-k=sent]"); await p.fill("#wq-note", "sent from Business"); await p.click("[data-wq=log]"); await p.waitForTimeout(400);
  const SN = await p.evaluate(() => { const c = AdminWaqs.S.doc.contacts[0], m = AdminWaqs.S.doc.msgs.find(x => x.ref === "d1"), l = c.log[0]; return { status: m.status, sentText: m.sentText, sentAt: !!m.sentAt, st: l.st, msg: l.msg, type: l.type, lang: l.lang, camp: l.campaign, custom: l.custom, note: l.note, orig: m.text, txt: document.getElementById("waqs").innerText }; });
  t("التخصيص الاختياري يغيّر المعاينة والرابط، وتسجيل «تم الإرسال» يدوياً يحفظ نسخة المُرسَل فعلاً ويُحوّل الرسالة إلى Sent بلا مسّ بنصها الأصلي", cu.prev === "Hello Sam, edited just before sending." && cu.href === cu.prev && SN.status === "sent" && SN.sentText === "Hello Sam, edited just before sending." && SN.msg === SN.sentText && SN.type === "first" && SN.lang === "EN" && SN.camp === "Spring EU" && SN.custom === true && /^This is|Hello Sam,\n\nThis is/.test(SN.orig) && /Copie|نسخة الرسالة المُرسَلة/.test(SN.txt), { cu, SN });
  /* بانتظار المتابعة + المتابعة مرتبطة بالأولى */
  await p.click("[data-wq=back]"); await p.click("[data-wq=tab][data-k=wait]"); await p.waitForTimeout(200);
  const Wt = await p.evaluate(() => ({ rows: [...document.querySelectorAll("#waqs .wq-row")].map(r => r.innerText.replace(/\s+/g, " ")), cnt: [...document.querySelectorAll("#waqs [data-wq=tab] b")].map(x => x.textContent).join(",") }));
  t("تبويب «بانتظار المتابعة» يعرض الجهة المُرسَل لها مع «متابعة جاهزة»، والعدّادات صحيحة (جاهزة 2)", Wt.rows.length === 1 && /Delta Corp/.test(Wt.rows[0]) && /متابعة جاهزة/.test(Wt.rows[0]) && Wt.cnt === "2,1,2", Wt);
  await p.click("[data-wq=open]"); await p.waitForTimeout(300);
  const F = await p.evaluate(() => ({ sel: document.querySelector("#waqs .wq-row.sel").innerText.replace(/\s+/g, " "), prev: document.getElementById("wq-prev").textContent, conf: window.__conf.length }));
  t("فتح الجهة يحدّد تلقائياً رسالة المتابعة الجاهزة ويُظهر ارتباطها بالرسالة الأولى", /Follow-up/.test(F.sel) && /Relance|متابعة للرسالة/.test(F.sel) && /Follow-up|follow-up/.test(F.prev), F);
  /* حارس التكرار: تواصل حديث ← تأكيد؛ الرفض لا يحدّث «فُتحت»؛ وأول تواصل أُرسل سابقاً */
  await p.evaluate(() => { window.__conf = []; window.__ans = false; });
  await p.evaluate(() => { document.getElementById("wq-go").click(); }); await p.waitForTimeout(300);
  const G1 = await p.evaluate(() => ({ conf: window.__conf.slice(), op: AdminWaqs.S.doc.contacts[0].opened })); 
  t("حارس التكرار: آخر رسالة وحالتها السابقة تُعرضان ويُطلب التأكيد، والرفض لا يفتح", G1.conf.length === 1 && /تم الإرسال/.test(G1.conf[0]) && /edited just before sending/.test(G1.conf[0]), G1);
  await p.evaluate(() => { const c = AdminWaqs.S.doc.contacts[0], m = AdminWaqs.S.doc.msgs.find(x => x.ref === "d1"); AdminWaqs.S.mid = m.id; return AdminWaqs.msgGuard(c, m); }).then(w => t("حارس الرسالة: الرسالة المُرسَلة سابقاً تُنبَّه عند إعادة فتحها", w.length === 1 && /مُرسَلة بتاريخ/.test(w[0]), w));
  /* إلغاء التواصل يحجب الزر */
  await p.evaluate(() => { window.__ans = true; }); await p.click("[data-k=out]"); await p.click("[data-wq=log]"); await p.waitForTimeout(300);
  const out = await p.evaluate(() => { const a = document.getElementById("wq-go"); return { off: a.classList.contains("off"), href: a.getAttribute("href"), reopen: !!document.querySelector("[data-wq=reopen]") }; });
  t("«إلغاء التواصل» يعطّل زر فتح WhatsApp ويعرض رفع الإلغاء", out.off && out.href === "#" && out.reopen, out);
  await p.click("[data-wq=reopen]"); await p.waitForTimeout(300);
  /* إضافة رسالة يدوياً + قالب مساعد اختياري + منع التكرار */
  await p.click("[data-wq=addm]"); await p.waitForTimeout(300);
  await p.selectOption("#mf-tp", "first"); await p.selectOption("#mf-l", "EN"); await p.click("#mf-fill"); await p.waitForTimeout(200);
  const T1 = await p.evaluate(() => ({ txt: document.getElementById("mf-x").value, err: document.getElementById("mf-e").textContent }));
  await p.evaluate(() => { AdminWaqs.S.doc.me = { name: "Saber", company: "ACME Co", offer: { en: "natural products", fr: "", ar: "" } }; });
  await p.click("#mf-fill"); await p.waitForTimeout(200);
  const T2 = await p.evaluate(() => ({ txt: document.getElementById("mf-x").value, err: document.getElementById("mf-e").textContent }));
  await p.selectOption("#mf-t", "other"); await p.fill("#mf-cp", "Autumn"); await p.click("#mf-ok"); await p.waitForTimeout(400);
  const NM = await p.evaluate(() => { const m = AdminWaqs.S.doc.msgs.slice(-1)[0]; return { n: AdminWaqs.S.doc.msgs.length, camp: m.campaign, type: m.type, lang: m.lang, st: m.status, hasVar: /\{/.test(m.text), first: /Hello Sam/.test(m.text) }; });
  t("القالب المساعد اختياري: بلا هوية يُنبَّه ولا يُحفظ بمتغيرات ناقصة، وبعدها يُملأ بالجهة والهوية ويُحفظ رسالة Ready عادية", /\{sender\}/.test(T1.txt) && T1.err.length > 0 && !/\{/.test(T2.txt) && /Hello Sam/.test(T2.txt) && /ACME Co/.test(T2.txt) && NM.n === 4 && NM.camp === "Autumn" && NM.lang === "EN" && NM.st === "ready" && !NM.hasVar, { T1, T2, NM });
  await p.click("[data-wq=addm]"); await p.fill("#mf-x", "Hello Sam, edited just before sending."); await p.click("#mf-ok"); await p.waitForTimeout(200);
  const dupE = await p.evaluate(() => { const e = document.getElementById("mf-e").textContent; document.querySelector("#mf-no").click(); return e; });
  t("منع رسالة مكرَّرة لنفس الجهة عند الإضافة اليدوية", /موجودة مسبقاً/.test(dupE), dupE);
  /* تخطّي وحذف رسالة */
  const SK = await p.evaluate(async () => { const S = AdminWaqs.S, m = S.doc.msgs.slice(-1)[0]; S.mid = m.id; document.querySelector("[data-wq=mskip]").click(); await new Promise(r => setTimeout(r, 300)); return { st: m.status, q: S.doc.msgs.filter(x => x.status === "ready").length }; });
  t("تخطّي رسالة يخرجها من قائمة الإرسال", SK.st === "skipped" && SK.q === 2, SK);
  /* الاستمرارية */
  const pr = await p.evaluate(async () => { await new Promise(r => setTimeout(r, 900)); const d = await Priv.get("waqs", null); return d && { c: d.contacts.length, m: d.msgs.length, sent: d.msgs.filter(x => x.status === "sent").length }; });
  t("البيانات تُحفظ في الإعدادات الخاصة (Priv) لا في صفحة عامة", pr && pr.c === 2 && pr.m === 4 && pr.sent === 1, pr);
  /* الفرنسية */
  await p.evaluate(async () => { AdminWaqs.S.sel = null; AdminWaqs.S.selFor = null; AdminWaqs.S.tab = "queue"; await AdminI18n.set("fr"); }); await p.waitForTimeout(1500);
  const fq = await p.evaluate(() => document.getElementById("waqs").innerText + "\n" + document.querySelector("#waqs .wq-qh").textContent);
  await p.evaluate(() => { document.querySelector("#waqs [data-wq=open]").click(); }); await p.waitForTimeout(400);
  const fd = await p.evaluate(() => document.getElementById("waqs").innerText);
  const arLeft = x => x.split("\n").filter(l => /[؀-ۿ]/.test(l) && !/(Delta|Gamma|Sam|Léa|Spring|Autumn|الجزائر)/.test(l)).join("|");
  t("الواجهة بالفرنسية (القائمة وصفحة الجهة) بلا بقايا عربية في النصوص الثابتة", /Prêts à envoyer/.test(fq) && /Prêt à envoyer/.test(fq) && /Société/.test(fq) && /Type de message/.test(fq) && /Ouvrir WhatsApp/.test(fd) && /Historique des contacts/.test(fd) && arLeft(fq) === "" && arLeft(fd) === "", { q: arLeft(fq), d: arLeft(fd) });
  await p.evaluate(() => AdminI18n.set("ar")); await p.waitForTimeout(800);

  /* غير المالك: لا وحدة ولا زر ولا لوحة */
  const q = await page(false);
  const G = await q.evaluate(() => ({ off: typeof AdminWaqs === "undefined" || !!AdminWaqs.off, loaded: !![...document.scripts].some(s => /admin-waqs/.test(s.src)) }));
  t("غير المالك (SELLER=false): لا يُحمَّل ملفا الوحدة ولا تعمل", G.off && !G.loaded, G);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
