/* تنظيم عناوين لوحة التحكم في تبويبات كبيرة (المظهر / ecommerce / تطبيقات) تحتها إعداداتها.
   كل زر في القائمة الجانبية يحمل data-grp (look|shop|apps)؛ الضغط على تبويب كبير يُظهر مجموعته فقط ويفتح أول عنصر فيها،
   وأي انتقال برمجي إلى قسم (Admin.tab) يُبدّل المجموعة تلقائياً. التطبيقات: أدوات تُفتح من هنا (مطوّر الصفحات، المطوّر الذكي،
   أدوات تعديل الصور، الوكيل الذكي، الوكيل الناطق، اسألني، ناسخ القوالب). */
const AdminNav = (() => {
  const $ = id => document.getElementById(id), nav = () => document.querySelector(".side-nav");
  const toast = m => { try { if (typeof toast2 === "function") return toast2(m); window.toast && window.toast(m); } catch (e) { } };
  let cur = "shop";
  const btns = g => [...document.querySelectorAll(".side-nav .nav-btn")].filter(b => b.dataset.grp === g);
  function apply(g) { cur = g; const n = nav(); if (n) n.dataset.g = g; document.querySelectorAll("#nav-groups .ng").forEach(b => b.classList.toggle("on", b.dataset.g === g)); }
  function group(g) { apply(g); const on = document.querySelector(".side-nav .nav-btn.on"); if (!on || on.dataset.grp !== g || on.classList.contains("nav-work")) { const f = btns(g).find(x => !x.classList.contains("nav-work")); if (f) f.click(); } }
  /* الوكيل الذكي (التدريب) والوكيل الناطق (الأفاتار والصوت) يتشاركان قسم agent بعرضين */
  function agentView(v) { const t = $("tab-agent"); if (t) t.dataset.view = v; }
  /* ══ سجلّ التطبيقات: كل عنصر في تبويب «تطبيقات» يفتح إعدادات التطبيق (تعريف، كيف يعمل، النسخة، التحديث، تفعيل/تعطيل)، أما التطبيق نفسه فيبقى يعمل في مكانه ══ */
  const APPS = {
    builder: { n: "مطوّر الصفحات", d: "محرّر مرئي لتصميم صفحات الهبوط وتعديل الصفحة الرئيسية وصفحات المنتجات بالسحب والإفلات: أقسام وعناصر حرّة (نص، صورة، زر، سلايدر، منتجات…) مع معاينة للجوال والتابلت وحفظ ونشر بضغطة واحدة.", how: ["افتح مكان العمل: قائمة صفحاتك أو زر «تعديل الصفحة الرئيسية» أعلى اللوحة.", "اختر «صفحة جديدة» أو «تعديل» لصفحة موجودة؛ يُفتح المحرّر المرئي.", "أضف العناصر من لوحة «عناصر» وحدّد أي عنصر لتظهر إعداداته (محتوى/تنسيق/متقدم).", "«حفظ ونشر» ينشر الصفحة على موقعك؛ والتعديلات غير المنشورة تُحفظ كمسودة."], where: "تبويب الصفحات + زر «تعديل الصفحة الرئيسية» + أزرار تعديل المنتجات", work: "builder", off: "يُمنع فتح المحرّر المرئي من أي زر." },
    smart: { n: "المطوّر الذكي", d: "يولّد صفحة جديدة من صورة واحدة ثم تحرّرها بالأدوات الذكية (التقاط العناصر، نزع الخلفية…) وتحفظها.", how: ["افتح مكان العمل ثم ارفع صورة تصميم.", "يُحوَّل التصميم إلى صفحة قابلة للتعديل.", "حرّرها بالأدوات الذكية ثم احفظها."], where: "تبويب المطوّر الذكي (مولّد الصفحات)", work: "pbgen", off: "يُمنع فتح المولّد الذكي." },
    imgtools: { n: "أدوات تعديل الصور", d: "أدوات سريعة تعمل في متصفحك بلا مفتاح: نزع الخلفية بالذكاء المحلي وضغط الصور وتحويلها إلى WebP. والأدوات المتقدمة (التقاط العناصر، الماسك، البازل) داخل مطوّر الصفحات.", how: ["افتح مكان العمل واختر صورة من جهازك.", "اضغط «نزع الخلفية» أو «ضغط وتحويل WebP».", "نزّل النتيجة أو استعملها في صفحاتك."], where: "تبويب أدوات تعديل الصور", work: "imgtools", off: "يُمنع فتح صفحة أدوات الصور." },
    agent: { n: "الوكيل الذكي", d: "مساعد على موقعك يجيب الزبائن تلقائياً من أسئلة وأجوبة تدرّبه عليها، ويقترح المنتجات، ويسجّل الأسئلة التي لم يعرف جوابها لتجيب عنها.", how: ["افتح مكان العمل ودرّب الوكيل: أسئلة وأجوبة لكل صفحة.", "جرّبه ثم انشر التدريب.", "تابع الأسئلة الجديدة وأجب عنها ليتحسّن."], where: "نافذة المحادثة على موقعك + تبويب تدريب الوكيل", work: "agent", off: "يختفي الوكيل من موقعك كلياً (الزر والمحادثة)." },
    voice: { n: "الوكيل الناطق", d: "واجهة بديلة للوكيل: أفاتار ناطق يقرأ الصفحة ويقنع الزبون ويشير إلى «اطلب الآن»، بصوت ElevenLabs أو ملفات صوت جاهزة.", how: ["افتح مكان العمل واختر الواجهة (محادثة نصية أو أفاتار ناطق).", "أدخل مفتاح ElevenLabs (اختياري) ومعرّف الصوت.", "ولّد ملفات الصوت الجاهزة لكل صفحة ليسمعها الزبائن بلا مفتاح."], where: "الأفاتار على موقعك + قسم الوكيل الناطق", work: "voice", off: "يعود الموقع إلى المحادثة النصية دائماً." },
    ask: { n: "اسألني", d: "مساعد اللوحة: اكتب سؤالك عن أي أداة أو إعداد فيجيبك فوراً بلا إنترنت ولا مفتاح.", how: ["اضغط زر «اسألني» أعلى اللوحة.", "اكتب سؤالك أو اختر اقتراحاً.", "اضغط «اذهب إلى القسم» ليفتح لك المكان المقصود."], where: "زر «اسألني» أعلى اللوحة", work: "ask", off: "يختفي زر «اسألني» من اللوحة." },
    cloner: { n: "ناسخ القوالب", d: "ينسخ تصميم أي موقع (برابطه أو بلقطة شاشة) إلى عناصر قابلة للتعديل في مطوّر الصفحات: صور ونصوص وأزرار وسلايدرات وتأثيرات.", how: ["افتح مكان العمل واكتب رابط الموقع ثم «فتح».", "اسحب الحد السفلي لتحدّد ما يُنسخ.", "اضغط «انسخ» ويظهر الناتج في مطوّر الصفحات."], where: "زر «نسخ قالب» داخل مطوّر الصفحات", work: "cloner", off: "يختفي زر «نسخ قالب» ويُمنع فتح الناسخ." }
  };
  const OFF = new Set(); let appSha;
  const off = id => OFF.has(id);
  function applyOff() {
    const h = document.documentElement; Object.keys(APPS).forEach(k => h.classList.toggle("app-off-" + k, off(k)));
    document.querySelectorAll("[data-appst]").forEach(e => e.classList.toggle("hidden", !off(e.dataset.appst)));
  }
  async function loadOff() {
    try { JSON.parse(localStorage.getItem("admin_apps_off") || "[]").forEach(x => OFF.add(x)); } catch (e) { }
    try {
      const g = typeof GH !== "undefined" && GH.cfg && GH.cfg(); let j = null;
      if (g && g.token) { try { const f = await GH.getFile("assets/data/apps.json"); appSha = f.sha; j = JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); } catch (e) { appSha = undefined; } }
      else { const r = await fetch("assets/data/apps.json", { cache: "no-store" }); if (r.ok) j = await r.json(); }
      if (j && Array.isArray(j.off)) { OFF.clear(); j.off.forEach(x => OFF.add(x)); }
    } catch (e) { }
    applyOff();
  }
  async function saveOff() {
    try { localStorage.setItem("admin_apps_off", JSON.stringify([...OFF])); } catch (e) { }
    const g = typeof GH !== "undefined" && GH.cfg && GH.cfg(); if (!g || !g.token) return toast("حُفظ في هذا المتصفح (اربط GitHub لينعكس على موقعك)");
    try { const b64 = btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, off: [...OFF] }, null, 2)))), res = await GH.putFile("assets/data/apps.json", b64, appSha, "تفعيل/تعطيل التطبيقات من لوحة التحكم"); appSha = res && res.content ? res.content.sha : appSha; toast("تم الحفظ — ينعكس على الموقع خلال دقيقة تقريباً"); }
    catch (e) { toast("تعذّر حفظ إعداد التطبيقات: " + e.message); }
  }
  function toggle(id, on) { on ? OFF.delete(id) : OFF.add(id); applyOff(); saveOff(); renderApp(id); }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function renderApp(id) {
    const A = APPS[id], box = $("app-cfg-body"); if (!A || !box) return; box.dataset.app = id;
    const cur = (typeof AdminUpdate !== "undefined" && AdminUpdate.current) || "", lat = (typeof AdminUpdate !== "undefined" && AdminUpdate.latest) || "", newer = lat && cur && lat !== cur && lat.split(".").map(Number).join() > cur.split(".").map(Number).join();
    const o = off(id);
    box.innerHTML = `<div class="ap-h"><h3>${esc(A.n)}</h3><span class="ap-s ${o ? "off" : "on"}">${o ? "معطّل" : "مفعّل"}</span><label class="sw" title="${o ? "تفعيل" : "تعطيل"} التطبيق"><input type="checkbox" ${o ? "" : "checked"} onchange="AdminNav.toggle('${id}',this.checked)"><i></i></label></div>
<div class="ap-sec"><b>التعريف</b><div>${esc(A.d)}</div></div>
<div class="ap-sec"><b>كيف يعمل</b><ol>${A.how.map(x => "<li>" + esc(x) + "</li>").join("")}</ol></div>
<div class="ap-sec"><b>مكان عمل التطبيق</b><div>${esc(A.where)}</div><div class="action-bar" style="margin-top:.5rem"><button class="small" onclick="AdminNav.work('${id}')" ${o ? "disabled" : ""}>الانتقال إلى مكان العمل</button></div><div class="hint">التطبيق يبقى يعمل في مكانه المعتاد؛ هذه الصفحة للتعريف والإعداد فقط.</div></div>
<div class="ap-sec"><b>النسخة والتحديث</b><div class="ap-kv"><div><small>النسخة الحالية</small><b dir="ltr">${esc(cur || "—")}</b></div><div><small>أحدث نسخة منشورة</small><b dir="ltr">${esc(lat || cur || "—")}</b></div><div><small>الحالة</small><b>${newer ? "يتوفر تحديث" : "محدّث"}</b></div></div>
<div class="action-bar" style="margin-top:.5rem"><button class="small ${newer ? "gold" : ""}" onclick="AdminNav.update(${newer ? "true" : "false"},'${id}')">${newer ? "تحديث الآن" : "فحص التحديثات"}</button></div><div class="hint">التطبيقات تُحدَّث مع إصدار اللوحة نفسه؛ ورقم النسخة واحد لكلّها.</div></div>
<div class="ap-sec"><b>التفعيل والتعطيل</b><div class="hint" style="margin:0">عند التعطيل: ${esc(A.off)} ويمكنك إعادة التفعيل في أي وقت.</div></div>`;
  }
  function app(id, btn) { try { Admin.tab("appcfg", btn); } catch (e) { return; } renderApp(id); const t = $("app-cfg-body"); if (t) t.dataset.app = id; }
  async function update(isNew, id) { try { if (isNew) return AdminUpdate.apply(); await AdminUpdate.check(true); renderApp(id); } catch (e) { toast("تعذّر التحقق من التحديث"); } }
  function workBtn(w) { return [...document.querySelectorAll(".side-nav .nav-btn.nav-work")].find(b => b.dataset.work === w); }
  const WK = { builder: ["builder", "builder"], smart: ["smart", "pbgen"], imgtools: ["imgtools", "imgtools"], agent: ["agent", "agent"], voice: ["agent", "agent"] };
  function work(id) {
    if (!APPS[id]) return; if (off(id)) return toast("التطبيق معطّل — فعّله من إعداداته");
    if (id === "ask") return ask(); if (id === "cloner") return clone();
    const w = WK[id], b = w && workBtn(w[0]); if (!b) return;
    try { if (id === "voice") { VOICE = true; Admin.tab("agent", b); agentView("voice"); const c = $("av-card"); if (c) setTimeout(() => c.scrollIntoView({ behavior: "smooth", block: "start" }), 60); } else Admin.tab(w[1], b); } catch (e) { } VOICE = false;
    const mi = document.querySelector('.side-nav .nav-btn[data-app="' + id + '"]'); if (mi) { document.querySelectorAll(".nav-btn.on").forEach(x => x.classList.remove("on")); mi.classList.add("on"); }
  }
  let VOICE = false;
  function ask(go) { if (off("ask")) return toast("اسألني معطّل من إعدادات التطبيقات"); try { AdminHelp.show ? AdminHelp.show() : AdminHelp.toggle(); } catch (e) { toast("المساعد غير متاح"); } }
  function clone(go) { if (off("cloner")) return toast("ناسخ القوالب معطّل من إعدادات التطبيقات"); try { if (typeof PBClone === "undefined") throw 0; PBClone.open(); } catch (e) { toast("ناسخ القوالب غير متاح في هذه النسخة"); } }
  function openBuilder() { const b = workBtn("builder"); if (b) Admin.tab("builder", b); }
  /* ── أدوات تعديل الصور (مستقلة عن المطوّر): نزع الخلفية بالذكاء المحلي، ضغط وتحويل WebP ── */
  const IT = { cv: null, res: null, name: "image", busy: false };
  const msg = m => { const e = $("it-msg"); if (e) e.textContent = m || ""; };
  function paint(c, host) { const h = $(host); if (!h) return; h.innerHTML = ""; c.style.cssText = "max-width:100%;max-height:420px;display:block;margin:auto"; h.appendChild(c); }
  function imgLoad(inp) {
    const f = inp.files && inp.files[0]; if (!f) return; IT.name = f.name.replace(/\.[^.]+$/, ""); IT.res = null; const u = URL.createObjectURL(f), im = new Image();
    im.onload = () => { const k = Math.min(1, 1800 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); IT.cv = c; URL.revokeObjectURL(u); paint(c, "it-pv"); msg(c.width + "×" + c.height + " — اختر أداة"); ["it-cut", "it-webp"].forEach(i => { const b = $(i); if (b) b.disabled = false; }); const d = $("it-dl"); if (d) d.disabled = true; };
    im.onerror = () => msg("تعذّر قراءة الصورة"); im.src = u;
  }
  async function imgCut() {
    if (!IT.cv || IT.busy) return; if (typeof PBBgRemove === "undefined") return msg("أداة نزع الخلفية غير محمّلة"); IT.busy = true; msg("جارٍ نزع الخلفية…");
    try { const r = await PBBgRemove.autoCut(IT.cv, { onStep: s => msg(s) }); IT.res = r.canvas; IT.mode = "png"; paint(r.canvas, "it-pv"); const h = $("it-pv"); if (h) h.style.background = "repeating-conic-gradient(rgba(255,255,255,.12) 0 25%,transparent 0 50%) 50%/18px 18px"; msg("تم نزع الخلفية"); const d = $("it-dl"); if (d) d.disabled = false; }
    catch (e) { msg("⚠️ " + (e && e.message || e)); } IT.busy = false;
  }
  async function imgWebp() {
    if (!IT.cv) return; const q = Number(($("it-q") || {}).value || 82) / 100; IT.res = IT.cv; IT.mode = "webp"; IT.q = q;
    const b = await new Promise(r => IT.cv.toBlob(r, "image/webp", q)); msg("WebP بجودة " + Math.round(q * 100) + "% — الحجم " + Math.round(b.size / 1024) + " ك.ب"); const d = $("it-dl"); if (d) d.disabled = false;
  }
  async function imgDl() {
    if (!IT.res) return; const png = IT.mode === "png", b = await new Promise(r => IT.res.toBlob(r, png ? "image/png" : "image/webp", IT.q || .9)); if (!b) return;
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = IT.name + (png ? "-nobg.png" : ".webp"); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function init() {
    apply("shop");
    /* أي Admin.tab (من أزرار أو برمجياً) يُبدّل المجموعة ويضبط عرض الوكيل */
    if (typeof Admin !== "undefined" && !Admin.__navHook) {
      const orig = Admin.tab; Admin.__navHook = 1;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn); try { if (btn && btn.dataset && btn.dataset.grp && btn.dataset.grp !== cur) apply(btn.dataset.grp); if (t === "agent" && !VOICE) agentView("agent"); if (t === "appcfg" && btn && btn.dataset.app) renderApp(btn.dataset.app); } catch (e) { } return r; };
    }
    agentView("agent");
    loadOff();
    try { if (typeof PBApp !== "undefined" && !PBApp.__g) { const o = PBApp.open; PBApp.__g = 1; PBApp.open = function () { if (off("builder")) { toast("مطوّر الصفحات معطّل من تبويب تطبيقات"); return; } return o.apply(this, arguments); }; } } catch (e) { }
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
  return { group, app, work, toggle, update, ask, clone, openBuilder, imgLoad, imgCut, imgWebp, imgDl, apply, off };
})();
