/* «منشئ الصفحات بالذكاء» (PagePilot) — أداة مستقلة في ستوديو ديزاين.
   منتج المتجر/رابط/وصف + صورة ← الصفحة المصوّرة الهجينة (PagePilotHybrid: صور بالذكاء لكل قسم + نص حيّ + زر طلب ثابت) ← تُفتح في المطوّر للتعديل والنشر.
   تعمل بالذكاء فقط: بلا مفتاح/رصيد أو عند فشل أي خطوة ترفض بسبب واضح ولا تُنتج صفحة بديلة محلية. */
const PagePilot = (() => {
  const esc = t => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const THEMES = {
    green: { n: "أخضر وبرتقالي", main: "#187a3b", acc: "#f39a18", ink: "#16324c", mut: "#5c6b78", bg: "#fbfcf7", soft: "#e9f5e4" },
    navy: { n: "كحلي وذهبي", main: "#123e72", acc: "#e9a82b", ink: "#14263b", mut: "#5a6a7c", bg: "#f8fafc", soft: "#e3edf8" },
    teal: { n: "تركوازي ومرجاني", main: "#0d7a6f", acc: "#f2784b", ink: "#133a37", mut: "#587270", bg: "#f7fbfa", soft: "#dff3ef" },
    rose: { n: "وردي وذهبي", main: "#b83a6b", acc: "#e8a33a", ink: "#3a1d2b", mut: "#7a5d6b", bg: "#fff9fb", soft: "#fbe6ee" },
    dark: { n: "أسود وذهبي", main: "#1b1b1b", acc: "#c8a24b", ink: "#1f1f1f", mut: "#666", bg: "#faf8f3", soft: "#efe9da" }
  };
  const L10 = {
    ar: { benefits: "لماذا ستحبه", steps: "كيف تطلبه", faq: "أسئلة شائعة", offers: "العروض", order: "اطلب الآن", cod: "الدفع عند الاستلام", orderBtn: "اطلب الآن ←", note: "الصور توضيحية. راجع بيانات المنتج قبل الطلب.", wa: "اطلب عبر واتساب" },
    fr: { benefits: "Pourquoi l'adopter", steps: "Comment commander", faq: "Questions fréquentes", offers: "Offres", order: "Commander", cod: "Paiement à la livraison", orderBtn: "Commander →", note: "Images à titre indicatif.", wa: "Commander sur WhatsApp" },
    en: { benefits: "Why you'll love it", steps: "How to order", faq: "FAQ", offers: "Offers", order: "Order now", cod: "Cash on delivery", orderBtn: "Order now →", note: "Images are illustrative.", wa: "Order on WhatsApp" }
  };
  /* ───────────── الواجهة ───────────── */
  const S ={ resume: null, info: null, imgBlob: null, imgPath: "", imp: null };
  const BTN_CSS = "border:1px solid rgba(255,255,255,.28);color:#fff;border-radius:12px;padding:.6rem 1rem;font-weight:800;cursor:pointer;font-family:inherit;backdrop-filter:blur(8px);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -3px 6px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.25)";
  /* شحن الرصيد: 10 رصيد = 1$، صفحة كاملة 40 رصيداً (10 صور)، إعادة رسم صورة 2 رصيد */
  const CR = { min: 50, max: 2000, step: 50, def: 400, usd: 0.1, page: 50, ab: 100, redo: 2 };
  const FLD = "width:100%;padding:.5rem;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.2);font-family:inherit";
  const prods = () => { const a = typeof Admin !== "undefined" && Admin.products; return a && a.length ? a : (typeof PRODUCTS !== "undefined" && PRODUCTS) || []; };
  const race = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(Object.assign(new Error("انتهت مهلة الطلب"), { code: "TIMEOUT" })), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
  const urlBlob = async u => { const r = await fetch(/^(https?:|data:|blob:)/.test(u) ? u : String(u).replace(/^\/+/, ""), { cache: "force-cache" }); if (!r.ok) throw new Error("تعذّر تحميل الصورة"); return r.blob(); };
  async function toCanvas(blob) { const url = URL.createObjectURL(blob); try { const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("صورة غير صالحة")); i.src = url; }); const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); return c; } finally { URL.revokeObjectURL(url); } }
  const canvasBlob = (c, type, q) => new Promise(r => c.toBlob(r, type || "image/webp", q || .9));
  async function upload(blob, tag) { if (typeof PBApp === "undefined" || !PBApp.uploadBlob) throw new Error("المطوّر غير متاح"); return PBApp.uploadBlob(blob, "pp-" + tag + "-" + Date.now().toString(36)); }

  const bmHref = () => { try { return typeof PBSpec !== "undefined" && PBSpec.bookmarklet ? PBSpec.bookmarklet(location.origin + location.pathname) : "#"; } catch (_) { return "#"; } };
  function open() {
    const old = document.getElementById("pp-bg"); if (old) old.remove(); S.info = null; S.imgBlob = null; S.imgPath = ""; S.imp = null;
    const ps = prods(), bg = document.createElement("div"); bg.id = "pp-bg";
    bg.style.cssText = "position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:14px;backdrop-filter:blur(3px)";
    bg.innerHTML = `<div style="width:min(860px,100%);max-height:94vh;overflow:auto;background:rgba(9,24,18,.985);color:#fff;border:1px solid rgba(198,254,23,.3);border-radius:18px;padding:18px;direction:rtl;font-family:inherit">
<div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">🚀 منشئ الصفحات بالذكاء</h3><button data-pp="x" style="${BTN_CSS};background:rgba(255,255,255,.1)">✕</button></div>
<p style="margin:.3rem 0 .8rem;opacity:.85;line-height:1.8;font-size:.88rem">اختر منتجاً من متجرك أو الصق رابطه أو اكتب وصفه، فتبني الأداة صفحة هبوط جاهزة بأقسامها ونصوصها وصورها، وتُفتح في المطوّر لتعدّل عليها ما شئت.</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
<label style="font-size:.8rem;grid-column:1/-1">① منتج من متجرك (اختياري)<select id="pp-prod" style="${FLD}"><option value="">— بلا (رابط أو وصف يدوي) —</option>${ps.map(p => `<option value="${esc(p.slug)}">${esc(p.title)}</option>`).join("")}</select></label>
<label style="font-size:.8rem;grid-column:1/-1">أو رابط صفحة منتج<span style="display:flex;gap:6px"><input id="pp-url" dir="ltr" placeholder="https://… " style="${FLD};flex:1"><button data-pp="imp" style="${BTN_CSS};background:rgba(198,254,23,.22)">جلب</button></span></label>
<details id="pp-dt" style="grid-column:1/-1;font-size:.8rem"><summary style="cursor:pointer;opacity:.85">الموقع يحجب الجلب (AliExpress وأمثاله)؟ استورد المنتج من متصفحك بنقرة</summary>
<div style="margin-top:6px;line-height:1.9;opacity:.92"><b>الطريقة الأسهل (مرة واحدة):</b> اسحب هذا الزر إلى شريط المفضلة في متصفحك: <a id="pp-bm" draggable="true" href="${bmHref()}" style="${BTN_CSS};background:rgba(198,254,23,.25);text-decoration:none;display:inline-block;cursor:grab" title="اسحبني إلى شريط المفضلة">استيراد منتج</a><br>ثم افتح صفحة المنتج في موقعه واضغط المفضلة «استيراد منتج» — تنفتح هذه الأداة ومعها اسم المنتج وصوره جاهزة. (يعمل لأن الصفحة تُقرأ من متصفحك أنت لا من الخادم.)</div>
<div style="margin-top:6px;opacity:.8">أو الصق كود الصفحة بدلاً من الرابط:</div><textarea id="pp-html" dir="ltr" rows="3" placeholder="افتح صفحة المنتج ← Ctrl+U ← Ctrl+A ← Ctrl+C ← الصقه هنا ثم اضغط «جلب»" style="${FLD};width:100%;margin-top:6px"></textarea></details>
<div id="pp-impres" style="grid-column:1/-1;font-size:.82rem;line-height:1.7"></div>
<label style="font-size:.8rem">اسم المنتج<input id="pp-name" style="${FLD}"></label>
<label style="font-size:.8rem">صورة المنتج<input id="pp-file" type="file" accept="image/*" style="${FLD}"></label>
<label style="font-size:.8rem;grid-column:1/-1">وصف المنتج / ما يميّزه<textarea id="pp-desc" rows="3" style="${FLD}" placeholder="مكوّناته، فوائده، لمن؟…"></textarea></label>
<label style="font-size:.8rem">اللغة<select id="pp-lang" style="${FLD}"><option value="ar">العربية</option><option value="fr">الفرنسية</option><option value="en">الإنجليزية</option></select></label>
<label style="font-size:.8rem">الجمهور/النبرة (اختياري)<input id="pp-aud" style="${FLD}" placeholder="مثال: أمهات — نبرة دافئة"></label>
<div style="grid-column:1/-1"><div style="font-size:.8rem;margin-bottom:4px">② الألوان</div><div id="pp-themes" style="display:flex;gap:8px;flex-wrap:wrap">${Object.entries(THEMES).map(([k, t], i) => `<button data-pp="th" data-k="${k}" style="${BTN_CSS};background:linear-gradient(120deg,${t.main} 50%,${t.acc} 50%);${i ? "" : "outline:2px solid #c6fe17;"}min-width:120px">${t.n}</button>`).join("")}</div></div>
<div style="grid-column:1/-1"><div style="font-size:.8rem;margin-bottom:4px">🎨 لون خلفية الصفحة (الهجين) — لا يلزم أن يطابق لون المنتج؛ اختر لوناً منه أو قريباً أو فاتحاً</div>
<div id="pp-cols" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button data-pp="col" data-c="" style="${BTN_CSS};background:rgba(255,255,255,.12);outline:2px solid #c6fe17">تلقائي</button><span id="pp-sw" style="display:contents"></span><button data-pp="cols" style="${BTN_CSS};background:rgba(255,255,255,.12)" title="يستخرج ألوان صورة المنتج المختارة">استخرج ألوان المنتج</button><label style="font-size:.78rem;display:flex;gap:4px;align-items:center">لون حرّ <input id="pp-cc" type="color" value="#c8a24b" style="width:38px;height:30px;padding:0;border:0;background:none"></label>
<label style="font-size:.78rem">الدرجة <select id="pp-tone" style="${FLD};width:auto"><option value="dark">داكنة</option><option value="mid">متوسطة</option><option value="light">فاتحة</option></select></label>
</div></div>

<div style="font-size:.8rem;align-self:end;padding-bottom:.5rem">الأقسام: <b>10</b> (صورة لكل قسم)<input id="pp-hn" type="hidden" value="10"></div>
<label style="font-size:.8rem">اللهجة<select id="pp-dia" style="${FLD}"><option value="dz">دارجة جزائرية</option><option value="msa">فصحى مبسّطة</option></select></label>
<label style="font-size:.85rem"><input id="pp-people" type="checkbox" checked> صور أشخاص في المشاهد (هيرو، المشكلة، الاستعمال، الخاتمة — النساء بحجاب ولباس ساتر)</label>
<label style="font-size:.85rem"><input id="pp-ticker" type="checkbox" checked> شريط علوي (دفع عند الاستلام • توصيل • تأكيد بالهاتف)</label>
<label style="font-size:.85rem"><input id="pp-chain" type="checkbox" checked> استمرارية بصرية: كل صورة تُرسم بالاستناد إلى الصورة التي قبلها (نفس الخلفية والإضاءة فتبدو الصفحة مشهداً واحداً — أبطأ لأن الصور تُرسم بالتتابع)</label>
<label style="font-size:.85rem"><input id="pp-ab" type="checkbox"> 🧪 اختبار A/B: أنشئ أيضاً نسخة «ب» منافسة: صفحة كاملة بصورها وهويتها البصرية ونصوصها المختلفة (ضعف رصيد الصور) <span style="opacity:.75">· تذهب </span><input id="pp-abp" type="number" min="1" max="99" value="50" style="${FLD};width:64px;display:inline-block"> <span style="opacity:.75">% من الزوار إلى «ب»، وتُنشر مع الأصل عند «حفظ ونشر» (يلزم منتج من المتجر)</span></label>
<label style="font-size:.85rem"><input id="pp-gate" type="checkbox" checked> فحص جودة تلقائي للخلفيات (حتى محاولتين إضافيتين)</label>
</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin:.9rem 0"><button data-pp="go" style="${BTN_CSS};background:rgba(198,254,23,.28)">✨ أنشئ الصفحة بالذكاء</button></div>
<div id="pp-rep" style="font-size:.86rem;line-height:1.8"></div>
<div id="pp-cr" style="margin-top:1rem;padding:1rem;border-radius:16px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05)">
<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><b>شحن الرصيد</b><div style="font-size:.78rem;opacity:.8">حرّك الشريط لاختيار المبلغ — صفحة كاملة ${CR.page} رصيداً، واختبار A/B (زوج صفحات) ${CR.ab} رصيد، وإعادة رسم صورة واحدة ${CR.redo} رصيد.</div></div><div id="pp-cr-usd" style="font-size:2rem;font-weight:900;color:#c6fe17;direction:ltr"></div></div>
<input id="pp-cr-r" type="range" min="${CR.min}" max="${CR.max}" step="${CR.step}" value="${CR.def}" style="width:100%;margin:.8rem 0 .2rem;accent-color:#c6fe17;direction:ltr"><div style="display:flex;justify-content:space-between;font-size:.74rem;opacity:.7;direction:ltr"><span>${CR.min}</span><span id="pp-cr-n"></span><span>${CR.max}</span></div>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:.7rem 0"><div style="text-align:center;padding:.6rem;border-radius:12px;background:rgba(255,255,255,.07)"><div id="pp-cr-c" style="font-size:1.6rem;font-weight:900"></div><div style="font-size:.76rem;opacity:.8">رصيد</div></div><div style="text-align:center;padding:.6rem;border-radius:12px;background:rgba(255,255,255,.07)"><div id="pp-cr-p" style="font-size:1.6rem;font-weight:900"></div><div style="font-size:.76rem;opacity:.8">صفحة بصور المنتج</div></div><div style="text-align:center;padding:.6rem;border-radius:12px;background:rgba(255,255,255,.07)"><div id="pp-cr-a" style="font-size:1.6rem;font-weight:900"></div><div style="font-size:.76rem;opacity:.8">اختبار A/B (زوج صفحات)</div></div><div style="text-align:center;padding:.6rem;border-radius:12px;background:rgba(255,255,255,.07)"><div id="pp-cr-i" style="font-size:1.6rem;font-weight:900"></div><div style="font-size:.76rem;opacity:.8">إعادة رسم صورة</div></div></div>
<button data-pp="buy" id="pp-cr-b" style="${BTN_CSS};background:rgba(198,254,23,.28);width:100%"></button>
<div style="font-size:.74rem;opacity:.7;margin-top:.4rem">يصل طلب الشحن إلى فريق الدعم ويُضاف الرصيد بعد تأكيده.</div></div></div>`;
    document.body.appendChild(bg);
    const $ = id => bg.querySelector("#" + id), say = (h, bad) => { $("pp-rep").innerHTML = `<div style="padding:.6rem .8rem;border-radius:10px;border:1px solid ${bad ? "rgba(255,120,120,.5)" : "rgba(198,254,23,.35)"};background:${bad ? "rgba(255,80,80,.1)" : "rgba(198,254,23,.07)"}">${h}</div>`; };
    const crDraw = () => { const c = +$("pp-cr-r").value, d = c * CR.usd; $("pp-cr-usd").textContent = "$" + d.toFixed(2); $("pp-cr-n").textContent = c; $("pp-cr-c").textContent = c; $("pp-cr-p").textContent = Math.floor(c / CR.page); $("pp-cr-a").textContent = Math.floor(c / CR.ab); $("pp-cr-i").textContent = Math.floor(c / CR.redo); $("pp-cr-b").textContent = "اطلب شحن " + c + " رصيد — " + d.toFixed(2) + " $"; };
    $("pp-cr-r").addEventListener("input", crDraw); crDraw();
    let theme = "green", pageColor = "";
    const setColor = c => { pageColor = c || ""; try { delete $("pp-cc").dataset.on; } catch (_) { } bg.querySelectorAll('[data-pp="col"]').forEach(x => x.style.outline = (x.dataset.c || "") === pageColor ? "2px solid #c6fe17" : ""); };
    $("pp-cc").addEventListener("input", () => { setColor(""); $("pp-cc").dataset.on = "1"; bg.querySelectorAll('[data-pp="col"]').forEach(x => x.style.outline = ""); });
    $("pp-prod").addEventListener("change", () => { const p = ps.find(x => x.slug === $("pp-prod").value); if (!p) return; $("pp-name").value = p.title || ""; $("pp-desc").value = String(p.desc || p.description || "").slice(0, 900); });
    async function gather() {
      const p = ps.find(x => x.slug === $("pp-prod").value) || null, f = $("pp-file").files[0], imp = S.imp;
      const info = { title: $("pp-name").value.trim() || (p && p.title) || (imp && imp.title) || "", desc: $("pp-desc").value.trim() || (p && String(p.desc || p.description || "")) || (imp && imp.desc) || "", bullets: (imp && imp.bullets) || [], price: p ? String(p.price || "") : imp ? imp.price : "", product: p ? p.slug : "" };
      if (!info.title) throw new Error("اكتب اسم المنتج أو اختر منتجاً أو اجلب رابطاً");
      let blob = null, path = "";
      if (f) blob = f; else if (imp && imp.blob) blob = imp.blob; else if (p && (p.cover || (p.images || [])[0])) { path = p.cover || p.images[0]; }
      return { info, blob, path, p, imp };
    }
    async function run(resumeIt) {
      const g = await gather(), o = { lang: $("pp-lang").value, audience: $("pp-aud").value.trim() };
      if (typeof PagePilotHybrid === "undefined" || typeof PBSpec === "undefined") throw new Error("وحدة بناء الصفحات غير محمَّلة — أعد تحميل اللوحة بـ Ctrl+Shift+R");
      const real = (() => { try { return typeof ImgGen !== "undefined" && ImgGen.ready && ImgGen.ready().ok; } catch (_) { return false; } })();
      if (!real) throw new Error("الأداة تعمل بالذكاء فقط ولا تنتج صفحة بدونه: فعّل مفتاح Alyssum API (أو جدّد الرصيد) من إعدادات مولّد الصور ثم أعد المحاولة.");
      say("⏳ تجهيز صور المنتج…"); const ctx = { theme, lang: o.lang, title: g.info.title, product: g.info.product, wa: (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.waNumber) || "" };
      let heroBlob = g.blob;
      if (!heroBlob && g.path) { try { heroBlob = await urlBlob(g.path); } catch (_) { } }
      /* كل صور المنتج المتاحة (رابط المنتج + صور المتجر) مراجعَ لأقسام مختلفة */
      const refs = [], refNames = []; if (heroBlob) refs.push(heroBlob);
      {
        const want = 8;
        if (g.imp && g.imp.images && g.imp.images.length > 1 && typeof PBSpec !== "undefined" && PBSpec.pickImage) {
          say("⏳ تحميل صور المنتج من الرابط…");
          for (let k = 0; k < g.imp.images.length && refs.length < want; k++) { if (k === g.imp.pick) continue; const t = { images: g.imp.images }; try { await PBSpec.pickImage(t, k); if (t.blob) refs.push(t.blob); } catch (_) { } }
        }
        /* صور المتجر: الغلاف + الصور + صور التنويعات (لكل تنويع صورته واسمه) */
        if (g.p && refs.length < want) {
          const seen = new Set(g.path ? [g.path] : []), cand = [{ u: g.p.cover }].concat((g.p.images || []).map(u => ({ u })), (g.p.variations || []).filter(v => v && v.active !== false && v.image).map(v => ({ u: v.image, n: Object.values(v.attrs || {}).join(" / ") })));
          for (const c of cand) { if (!c.u || refs.length >= want || seen.has(c.u)) continue; seen.add(c.u); try { refs.push(await urlBlob(c.u)); refNames[refs.length - 1] = c.n || ""; } catch (_) { } }
        }
      }
      {
        const th0 = THEMES[theme] || THEMES.green, cnt = 10, sig = [g.info.title, cnt, o.lang, $("pp-dia").value].join("|"), RS = resumeIt && S.resume && S.resume.sig === sig ? S.resume.p : null;
        if (resumeIt && !RS) throw new Error("تغيّرت الإعدادات منذ المحاولة السابقة — اضغط «أنشئ الصفحة» لبدء إنشاء جديد");
        const nTodo = RS ? RS.plan.sections.filter((x, k) => !RS.results[k]).length : 10;
        const abOn = !!($("pp-ab") && $("pp-ab").checked), abPct = Math.min(99, Math.max(1, Math.round(+($("pp-abp") && $("pp-abp").value) || 50)));
        if (abOn && !g.info.product) throw new Error("اختبار A/B يحتاج منتجاً من المتجر (ليُوزَّع الزوار بين النسختين): اختر منتجاً أو ألغِ خيار A/B");
        if (!heroBlob) throw new Error("ارفع صورة المنتج أو اجلب رابطاً أو اختر منتجاً له غلاف — الصفحة المصوّرة تحتاج صورة المنتج الحقيقية");
        if (!confirm("سيرسم الذكاء " + (nTodo + (abOn ? 10 : 0)) + " صورة مربّعة" + (abOn ? " (10 للنسخة أ و10 لنسخة ب المنافسة بهوية بصرية مختلفة)" : " للصفحة (صورة لكل قسم، بلا نصوص)") + " ويستهلك من رصيد Alyssum API" + ($("pp-gate").checked ? " — وفحص الجودة قد يعيد رسم بعضها" : "") + ". المتابعة؟")) throw new Error("أُلغي التوليد");
        const thumbs = []; const prog = (i, R) => { thumbs.push(R.bgCanvas.toDataURL("image/jpeg", .5)); say("⏳ ظهر القسم " + (thumbs.length) + " من " + (RS ? RS.plan.sections.length : 10) + `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">${thumbs.map(u => `<img src="${u}" style="width:52px;height:52px;object-fit:cover;border-radius:6px">`).join("")}</div>`); };
        say("⏳ ١/٣ تحليل المنتج وتخطيط الأقسام…");
        let out; try { out = await PagePilotHybrid.run({ info: g.info, blob: heroBlob, refs, refNames, theme: th0, lang: o.lang, dialect: $("pp-dia").value, count: cnt, gate: $("pp-gate").checked, chain: !$("pp-chain") || $("pp-chain").checked, noFaces: true, people: $("pp-people").checked, audience: o.audience, color: $("pp-cc").dataset.on ? $("pp-cc").value : pageColor, tone: $("pp-tone").value, resume: RS }, { section: prog }); } catch (e) { S.resume = e && e.partial ? { sig, p: e.partial } : null; throw e; } S.resume = null;
        say("⏳ ٢/٣ رفع الصور وتجميع الصفحة…");
        const asm = await PagePilotHybrid.assemble(out, { title: g.info.title, product: g.info.product, lang: o.lang, wa: ctx.wa, productAlt: out.an.name || g.info.title, ticker: $("pp-ticker").checked }, upload);
        /* نسخة ب (A/B): صفحة منافسة كاملة بصورها الخاصة (هوية بصرية ومشاهد وزوايا ونصوص مختلفة) — تعيد استعمال تحليل المنتج فقط */
        let abPage = null, abNote = [];
        if (abOn) {
          try {
            say("⏳ ٣/٣ رسم نسخة ب المنافسة…");
            const thumbsB = []; const progB = (i, R) => { thumbsB.push(R.bgCanvas.toDataURL("image/jpeg", .5)); say("⏳ نسخة ب: ظهر القسم " + thumbsB.length + " من 10" + `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">${thumbsB.map(u => `<img src="${u}" style="width:52px;height:52px;object-fit:cover;border-radius:6px">`).join("")}</div>`); };
            const outB = await PagePilotHybrid.runB(out, { info: g.info, blob: heroBlob, refs, refNames, theme: th0, lang: o.lang, dialect: $("pp-dia").value, gate: $("pp-gate").checked, chain: !$("pp-chain") || $("pp-chain").checked, noFaces: true, people: $("pp-people").checked, audience: o.audience }, { section: progB });
            const asmB = await PagePilotHybrid.assemble(outB, { title: g.info.title, product: g.info.product, lang: o.lang, wa: ctx.wa, productAlt: outB.an.name || g.info.title, ticker: $("pp-ticker").checked }, (b, tag) => upload(b, "B" + tag));
            abPage = asmB.page; abNote = outB.note.slice(0, 2);
          } catch (er) { abNote = ["تعذّرت نسخة ب (" + String(er && er.message || er).slice(0, 140) + ") — الصفحة أ جاهزة، ويمكنك نشرها بدون A/B"]; }
        }
        bg.remove(); PBApp.open(asm.page, "", true); if (abPage && PBApp.setAbPage) PBApp.setAbPage(abPage, abPct);
        const wn = out.note.concat(abPage ? ["🧪 نسخة ب المنافسة جاهزة: ستُنشر مع الأصل عند «حفظ ونشر» (الإعدادات من «إعدادات الصفحة»)"] : [], abNote, asm.warn.slice(0, 3)); if (wn.length && PBApp.toast) setTimeout(() => PBApp.toast(wn.join(" — ")), 600);
      }
    }
    /* يملأ الحقول بمنتج مستورد (من الجلب أو من زر المفضلة) */
    async function applyImp(p) {
      S.imp = p; if (p.images.length && PBSpec.pickImage) { try { await PBSpec.pickImage(p, 0); } catch (_) { } }
      if (!$("pp-name").value.trim()) $("pp-name").value = p.title; if (!$("pp-desc").value.trim()) $("pp-desc").value = p.desc;
      $("pp-impres").innerHTML = p.images.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${p.images.map((u, i) => `<img data-ppi="${i}" src="${esc(u)}" referrerpolicy="no-referrer" style="width:60px;height:60px;object-fit:cover;border-radius:10px;cursor:pointer;border:2px solid ${i === p.pick ? "#c6fe17" : "rgba(255,255,255,.2)"}">`).join("")}</div><div style="opacity:.7;font-size:.75rem">اضغط صورة لاختيارها صورةً رئيسية.</div>` : "لم أجد صوراً — ارفع صورة بنفسك.";
      say("✅ جُلب: <b>" + esc(p.title || "بلا عنوان") + "</b>");
    }
    S.apply = applyImp;
    bg.addEventListener("click", e => { const l = e.target.closest("#pp-bm"); if (l) { e.preventDefault(); const m = $("pp-rep"); say("اسحب الزر إلى شريط المفضلة (لا تضغطه هنا) ثم افتح صفحة المنتج واضغطه هناك."); } });
    bg.addEventListener("click", async e => {
      const b = e.target.closest("[data-pp]"); if (!b) { if (e.target === bg) bg.remove(); return; } const a = b.dataset.pp;
      if (a === "x") bg.remove();
      else if (a === "col") setColor(b.dataset.c);
      else if (a === "cols") {
        b.disabled = true;
        try {
          const g = await gather(); let blob = g.blob; if (!blob && g.path) blob = await urlBlob(g.path); if (!blob) throw new Error("اختر صورة المنتج أولاً");
          const cs = PagePilotHybrid.productColors(await toCanvas(blob), 6); if (!cs.length) throw new Error("لم أجد ألواناً واضحة — اختر لوناً حرّاً");
          $("pp-sw").innerHTML = cs.map(c => `<button data-pp="col" data-c="${c}" title="${c}" style="width:38px;height:38px;border-radius:50%;border:2px solid rgba(255,255,255,.5);background:${c};cursor:pointer"></button>`).join(""); setColor(cs[0]);
        } catch (er) { say("❌ " + esc(er.message || er), true); }
        b.disabled = false;
      }
      else if (a === "buy") {
        const c = +$("pp-cr-r").value, d = (c * CR.usd).toFixed(2);
        if (!confirm("إرسال طلب شحن " + c + " رصيد (" + d + " $) إلى فريق الدعم؟")) return;
        b.disabled = true;
        try {
          const N = typeof AdminStores !== "undefined" && AdminStores.notify;
          if (!N) throw new Error("تعذّر الاتصال بالدعم — حاول لاحقاً");
          await AdminStores.notify("طلب شحن رصيد Alyssum API\nالرصيد: " + c + "\nالمبلغ: " + d + " $", "billing", { credits: c, usd: +d, pages: Math.floor(c / CR.page), ab: Math.floor(c / CR.ab) }, "طلب شحن رصيد: " + c);
          say("✅ أُرسل طلب شحن " + c + " رصيد إلى الدعم — يُضاف الرصيد بعد تأكيده.");
        } catch (er) { say("❌ " + esc(er.message || er), true); }
        b.disabled = false;
      }
      else if (a === "th") { theme = b.dataset.k; bg.querySelectorAll('[data-pp="th"]').forEach(x => x.style.outline = x === b ? "2px solid #c6fe17" : ""); }
      else if (a === "imp") {
        if (typeof PBSpec === "undefined" || !PBSpec.importProduct) { say("أداة الجلب غير متاحة.", true); return; } b.disabled = true;
        try {
          const p = await PBSpec.importProduct($("pp-url").value, m => say(m), $("pp-html") && $("pp-html").value); await applyImp(p);
        } catch (er) { S.imp = null; say("❌ " + esc(er.message) + (/كابتشا|الصق كود/.test(er.message) ? "" : " — الصق كود الصفحة في الخانة أدناه، أو اكتب الاسم والوصف وارفع الصورة يدوياً."), true); const dt = $("pp-dt"); if (dt) dt.open = true; } b.disabled = false;
      }
      else if (a === "go" || a === "resume") { b.disabled = true; if (a === "go") S.resume = null; try { await run(a === "resume"); } catch (er) { say("❌ " + esc(er.message) + (S.resume ? `<div style="margin-top:8px"><button data-pp="resume" style="${BTN_CSS};background:rgba(198,254,23,.28)">↻ أعد الأقسام الفاشلة فقط</button></div>` : ""), true); b.disabled = false; } }
    });
    bg.addEventListener("click", async e => { const im = e.target.closest("[data-ppi]"); if (!im || !S.imp || !PBSpec.pickImage) return; try { await PBSpec.pickImage(S.imp, +im.dataset.ppi); bg.querySelectorAll("[data-ppi]").forEach(x => x.style.borderColor = x === im ? "#c6fe17" : "rgba(255,255,255,.2)"); } catch (er) { say("❌ " + esc(er.message), true); } });
  }
  /* ───── تغيير لون الصفحة المولَّدة داخل المحرّر (زر #pbx-rcb في شريط المطوّر العلوي يظهر لصفحات «منشئ الصفحات بالذكاء» فقط) ───── */
  function recolorOpen() {
    if (typeof PBApp === "undefined" || !PBApp.pageJson || !PBApp.mutatePage) return; let meta = null; try { meta = (JSON.parse(PBApp.pageJson()).specMeta || {}).hybrid; } catch (_) { }
    if (!meta) return; const old = document.getElementById("pp-rc"); if (old) { old.remove(); return; }
    const cols = (meta.colors || []).concat(["#ffffff", "#f5ecd9", "#1d1d22", "#0f3d2e", "#123e72", "#7a1f2b"]).filter((c, i, a) => a.indexOf(c) === i), tone0 = (meta.recolor && meta.recolor.tone) || "dark";
    const d = document.createElement("div"); d.id = "pp-rc"; d.style.cssText = "position:fixed;left:16px;top:64px;z-index:100050;width:min(360px,92vw);padding:.9rem;border-radius:16px;background:rgba(9,24,18,.985);border:1px solid rgba(198,254,23,.4);box-shadow:0 14px 40px rgba(0,0,0,.5);color:#fff;font-family:inherit;direction:rtl";
    d.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem"><b>🎨 لون خلفية الصفحة</b><button data-rc="x" style="background:none;border:0;color:#fff;font-size:1.1rem;cursor:pointer">✕</button></div>
<div style="font-size:.78rem;opacity:.8;margin-bottom:.4rem">اختر لون المنتج أو لوناً قريباً أو فاتحاً — تتغير الألوان فوراً بلا إعادة توليد الصور (ويمكنك التراجع).</div>
<div id="pp-rcs" style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:.5rem">${cols.map(c => `<button data-rc="c" data-c="${c}" title="${c}" style="width:34px;height:34px;border-radius:50%;border:2px solid rgba(255,255,255,.5);background:${c};cursor:pointer"></button>`).join("")}<input id="pp-rcc" type="color" value="${cols[0] || "#c8a24b"}" style="width:38px;height:34px;padding:0;border:0;background:none"><button data-rc="pip" title="قطّارة: التقط أي لون من الشاشة" style="${BTN_CSS};background:rgba(255,255,255,.12)">💧 قطّارة</button></div>${meta.flat ? '<div style="font-size:.74rem;color:#ffc928;margin-bottom:.4rem">ملاحظة: الصور المدمجة تحمل لون الخلفية الأصلي؛ يتغير لون الصفحة والنصوص والأزرار هنا، ولتغيير لون الصور نفسها أعد التوليد باللون الجديد.</div>' : ""}
<label style="font-size:.8rem">الدرجة <select id="pp-rct" style="${FLD};width:auto"><option value="dark">داكنة</option><option value="mid">متوسطة</option><option value="light">فاتحة</option></select></label>
<div style="display:flex;gap:8px;margin-top:.6rem"><button data-rc="go" style="${BTN_CSS};background:rgba(198,254,23,.28);flex:1">تطبيق</button></div><div id="pp-rcm" style="font-size:.8rem;margin-top:.4rem"></div>`;
    document.body.appendChild(d); d.querySelector("#pp-rct").value = tone0; let pick = (meta.theme && meta.theme.palette && meta.theme.palette.primary) || cols[0] || "#c8a24b";
    d.querySelector("#pp-rcc").addEventListener("input", e => { pick = e.target.value; });
    d.addEventListener("click", e => {
      const b = e.target.closest("[data-rc]"); if (!b) return; const a = b.dataset.rc;
      if (a === "x") d.remove();
      else if (a === "c") { pick = b.dataset.c; d.querySelector("#pp-rcc").value = pick; d.querySelectorAll('[data-rc="c"]').forEach(x => x.style.outline = x === b ? "2px solid #c6fe17" : ""); }
      else if (a === "pip") {
        const m = d.querySelector("#pp-rcm");
        if (!window.EyeDropper) { m.textContent = "متصفحك لا يدعم القطّارة — استعمل منتقي اللون بجانبها."; return; }
        d.style.display = "none"; new EyeDropper().open().then(r => { pick = r.sRGBHex; d.querySelector("#pp-rcc").value = pick; const sw = document.createElement("button"); sw.dataset.rc = "c"; sw.dataset.c = pick; sw.title = pick; sw.style.cssText = "width:34px;height:34px;border-radius:50%;border:2px solid rgba(255,255,255,.5);background:" + pick + ";cursor:pointer;outline:2px solid #c6fe17"; d.querySelector("#pp-rcs").insertBefore(sw, d.querySelector("#pp-rcc")); }).catch(() => { }).finally(() => { d.style.display = ""; });
      }
      else if (a === "go") { const r = PBApp.mutatePage(pg => PagePilotHybrid.recolorPage(pg, { color: pick, tone: d.querySelector("#pp-rct").value }), "تغيير لون الصفحة"); d.querySelector("#pp-rcm").textContent = r && r.ok ? "✅ تغيّر لون الصفحة (" + r.changed + " عنصراً)" : "❌ " + ((r && r.error) || "تعذّر التغيير"); }
    });
  }
  /* استقبال منتج مُرسَل من زر المفضلة (#ppimp=…) */
  (function boot() {
    if (typeof window === "undefined" || window.__ppImpBoot) return; window.__ppImpBoot = 1;
    let raw = ""; const h = location.hash || "";
    if (h.indexOf("#ppimp=") === 0) { raw = h.slice(7); try { sessionStorage.setItem("pp_imp", raw); history.replaceState(null, "", location.pathname + location.search); } catch (_) { } }
    else { try { raw = sessionStorage.getItem("pp_imp") || ""; } catch (_) { } }
    if (!raw) return; let tries = 0;
    const t = setInterval(async () => {
      if (++tries > 240) { clearInterval(t); return; }
      const lb = document.getElementById("login-box"), ready = typeof Admin !== "undefined" && !document.documentElement.classList.contains("au-boot") && (!lb || lb.offsetParent === null) && Array.isArray(Admin.products);
      if (!ready) return; clearInterval(t);
      try { sessionStorage.removeItem("pp_imp"); } catch (_) { }
      try {
        const j = JSON.parse(decodeURIComponent(escape(atob(raw.replace(/-/g, "+").replace(/_/g, "/")))));
        const p = PBSpec.fromPayload(j); open(); if (S.apply) await S.apply(p);
        const u = document.getElementById("pp-url"); if (u && p.url) u.value = p.url;
      } catch (e) { try { alert("تعذّر قراءة المنتج المرسل من الزر: " + e.message); } catch (_) { } }
    }, 500);
  })();
  return { open, recolorOpen, THEMES };
})();
