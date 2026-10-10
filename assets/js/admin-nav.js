/* تنظيم عناوين لوحة التحكم في تبويبات كبيرة (المظهر / ecommerce / تطبيقات) تحتها إعداداتها.
   كل زر في القائمة الجانبية يحمل data-grp (look|shop|apps)؛ الضغط على تبويب كبير يُظهر مجموعته فقط ويفتح أول عنصر فيها،
   وأي انتقال برمجي إلى قسم (Admin.tab) يُبدّل المجموعة تلقائياً. التطبيقات: أدوات تُفتح من هنا (مطوّر الصفحات، المطوّر الذكي،
   أدوات تعديل الصور، الوكيل الذكي، الوكيل الناطق، اسألني، ناسخ القوالب). */
/* إعدادات أدوات الصور والقوالب (لكل متصفح): ImgCfg.get(أداة، مفتاح، افتراضي) — تقرؤها الأدوات عند التشغيل */
window.ImgCfg = (() => { const K = "pbx_imgcfg"; let C = {}; try { C = JSON.parse(localStorage.getItem(K) || "{}") || {}; } catch (e) { } const save = () => { try { localStorage.setItem(K, JSON.stringify(C)); } catch (e) { } };
  return { get: (t, k, d) => { const v = C[t] && C[t][k]; return v === undefined ? d : v; }, set: (t, k, v) => { (C[t] = C[t] || {})[k] = v; save(); }, reset: t => { delete C[t]; save(); } }; })();
const AdminNav = (() => {
  const $ = id => document.getElementById(id), nav = () => document.querySelector(".side-nav");
  const toast = m => { try { if (typeof toast2 === "function") return toast2(m); window.toast && window.toast(m); } catch (e) { } };
  let cur = "shop";
  const btns = g => [...document.querySelectorAll(".side-nav .nav-btn")].filter(b => b.dataset.grp === g);
  function apply(g) { cur = g; const n = nav(); if (n) n.dataset.g = g; document.querySelectorAll("#nav-groups .ng").forEach(b => b.classList.toggle("on", b.dataset.g === g)); }
  /* «مظهر الموقع» ← سهم يفتح/يطوي الهيدر والفوتر والقوالب تحته (يُحفظ في المتصفح، ويُفتح تلقائياً عند الانتقال لأحدها) */
  function subs(open) {
    const nav = document.querySelector(".side-nav"); if (!nav) return;
    const on = typeof open === "boolean" ? open : !nav.classList.contains("subs-look");
    nav.classList.toggle("subs-look", on); try { localStorage.setItem("admin_nav_subs", on ? "1" : "0"); } catch (e) { }
  }
  try { if (localStorage.getItem("admin_nav_subs") === "1") setTimeout(() => subs(true), 0); } catch (e) { }
  document.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".nav-btn"); if (b && (b.classList.contains("nav-sub") || b.querySelector(".nav-car"))) { const nav = document.querySelector(".side-nav"); if (nav && !nav.classList.contains("subs-look") && b.classList.contains("nav-sub")) subs(true); } }, true);
  function group(g) { apply(g); const on = document.querySelector(".side-nav .nav-btn.on"); if (!on || on.dataset.grp !== g || on.classList.contains("nav-work")) { const f = btns(g).find(x => !x.classList.contains("nav-work")); if (f) f.click(); } }
  /* الوكيل الذكي (التدريب) والوكيل الناطق (الأفاتار والصوت) يتشاركان قسم agent بعرضين */
  function agentView(v) { const t = $("tab-agent"); if (t) t.dataset.view = v; }
  /* ══ سجلّ التطبيقات: كل عنصر في تبويب «تطبيقات» يفتح إعدادات التطبيق (تعريف، كيف يعمل، النسخة، التحديث، تفعيل/تعطيل)، أما التطبيق نفسه فيبقى يعمل في مكانه ══ */
  const APPS = {
    builder: { n: "مطوّر الصفحات", d: "محرّر مرئي لتصميم صفحات الهبوط وتعديل الصفحة الرئيسية وصفحات المنتجات بالسحب والإفلات: أقسام وعناصر حرّة (نص، صورة، زر، سلايدر، منتجات…) مع معاينة للجوال والتابلت وحفظ ونشر بضغطة واحدة.", how: ["افتح مكان العمل: قائمة صفحاتك أو زر «تعديل الصفحة الرئيسية» أعلى اللوحة.", "اختر «صفحة جديدة» أو «تعديل» لصفحة موجودة؛ يُفتح المحرّر المرئي.", "أضف العناصر من لوحة «عناصر» وحدّد أي عنصر لتظهر إعداداته (محتوى/تنسيق/متقدم).", "«حفظ ونشر» ينشر الصفحة على موقعك؛ والتعديلات غير المنشورة تُحفظ كمسودة."], where: "تبويب الصفحات + زر «تعديل الصفحة الرئيسية» + أزرار تعديل المنتجات", work: "builder", off: "يُمنع فتح المحرّر المرئي من أي زر." },
    smart: { n: "المطوّر الذكي", d: "يولّد صفحة جديدة من صورة واحدة ثم تحرّرها بالأدوات الذكية (التقاط العناصر، نزع الخلفية…) وتحفظها.", how: ["افتح مكان العمل ثم ارفع صورة تصميم.", "يُحوَّل التصميم إلى صفحة قابلة للتعديل.", "حرّرها بالأدوات الذكية ثم احفظها."], where: "تبويب المطوّر الذكي (مولّد الصفحات)", work: "pbgen", off: "يُمنع فتح المولّد الذكي." },
    imgtools: { tools: true, n: "أدوات تعديل الصور", d: "أدوات سريعة تعمل في متصفحك بلا مفتاح: نزع الخلفية بالذكاء المحلي وضغط الصور وتحويلها إلى WebP. والأدوات المتقدمة (التقاط العناصر، الماسك، البازل) داخل مطوّر الصفحات.", how: ["افتح مكان العمل واختر صورة من جهازك.", "اضغط «نزع الخلفية» أو «ضغط وتحويل WebP».", "نزّل النتيجة أو استعملها في صفحاتك."], where: "تبويب أدوات تعديل الصور", work: "imgtools", off: "يُمنع فتح صفحة أدوات الصور." },
    imggen: { n: "مولّد الصور", d: "ينشئ بـAlyssum API صور منتجات وصوراً إشهارية بمقاسات المنصات (النص اختياري: بلا نص أو نص قابل للتعديل في المطوّر أو نص بـAlyssum API)، ويفتح لوحة بالمقاس في وضع «صور إشهارية» بمطوّر الصفحات للتعديل والتصدير. مفتاحك يبقى في متصفحك، وبحدّ إنفاق تضبطه.", how: ["افتح مكان العمل وأدخل مفتاح Alyssum API (الإعدادات) واضبط حدّ الإنفاق.", "اختر صورة المنتج (PNG بخلفية بيضاء أو من منتجاتك) والمقاس والاسم والوصف.", "اختر «بنص» أو «بلا نص» ثم «توليد الصورة».", "افتحها في المطوّر أو احفظها في المكتبة أو نزّلها."], where: "تبويب مولّد الصور", work: "imggen", off: "يُمنع فتح مولّد الصور." },
    agent: { n: "الوكيل الذكي", d: "مساعد على موقعك يجيب الزبائن تلقائياً من أسئلة وأجوبة تدرّبه عليها، ويقترح المنتجات، ويسجّل الأسئلة التي لم يعرف جوابها لتجيب عنها.", how: ["افتح مكان العمل ودرّب الوكيل: أسئلة وأجوبة لكل صفحة.", "جرّبه ثم انشر التدريب.", "تابع الأسئلة الجديدة وأجب عنها ليتحسّن."], where: "نافذة المحادثة على موقعك + تبويب تدريب الوكيل", work: "agent", off: "يختفي الوكيل من موقعك كلياً (الزر والمحادثة)." },
    voice: { n: "الوكيل الناطق", d: "واجهة بديلة للوكيل: أفاتار ناطق يقرأ الصفحة ويقنع الزبون ويشير إلى «اطلب الآن»، بصوت احترافي أو ملفات صوت جاهزة.", how: ["افتح مكان العمل واختر الواجهة (محادثة نصية أو أفاتار ناطق).", "أدخل مفتاح الصوت (اختياري) ومعرّف الصوت.", "ولّد ملفات الصوت الجاهزة لكل صفحة ليسمعها الزبائن بلا مفتاح."], where: "الأفاتار على موقعك + قسم الوكيل الناطق", work: "voice", off: "يعود الموقع إلى المحادثة النصية دائماً." },
    ask: { n: "اسألني", d: "مساعد اللوحة: اكتب سؤالك عن أي أداة أو إعداد فيجيبك فوراً بلا إنترنت ولا مفتاح.", how: ["اضغط زر «اسألني» أعلى اللوحة.", "اكتب سؤالك أو اختر اقتراحاً.", "اضغط «اذهب إلى القسم» ليفتح لك المكان المقصود."], where: "زر «اسألني» أعلى اللوحة", work: "ask", off: "يختفي زر «اسألني» من اللوحة." },
    floaters: { custom: true, n: "الأيقونات العائمة", d: "أزرار تواصل تطفو فوق صفحات موقعك: واتساب، واتصال هاتفي، وماسنجر. لكل أداة إعداداتها: تفعيلها أو تعطيلها، مكانها على الشاشة، شكلها ولونها، وطريقة ظهورها (حركة، تأخير، بعد تمرير، حسب الجهاز والصفحة).", how: ["فعّل الأداة التي تريدها من مفتاحها.", "اضبط الرقم (أو صفحة فيسبوك) ومكان الأيقونة وشكلها وطريقة ظهورها.", "اضغط «حفظ الأيقونات العائمة» فتظهر على موقعك خلال دقيقة."], where: "إعدادات الأيقونات في هذه الصفحة نفسها (أعلاها)", work: "floaters", off: "تختفي كل الأيقونات العائمة من موقعك." },
    cloner: { n: "ناسخ القوالب", d: "ينسخ تصميم أي موقع (برابطه أو بلقطة شاشة) إلى عناصر قابلة للتعديل في مطوّر الصفحات: صور ونصوص وأزرار وسلايدرات وتأثيرات.", how: ["افتح مكان العمل واكتب رابط الموقع ثم «فتح».", "اسحب الحد السفلي لتحدّد ما يُنسخ.", "اضغط «انسخ» ويظهر الناتج في مطوّر الصفحات."], where: "زر «نسخ قالب» داخل مطوّر الصفحات", work: "cloner", off: "يختفي زر «نسخ قالب» ويُمنع فتح الناسخ." }
  };
  /* قائمة أدوات الصور: كل أداة باسمها وإعداداتها (تُحفظ في هذا المتصفح وتقرؤها الأدوات عند التشغيل) */
  const TOOLS = [
    { id: "capture", n: "الالتقاط السحري", d: "يكتشف العناصر في الصورة (أشخاص ومنتجات) ويقصّها كاملة بدقة الشعر والحواف، بنماذج محلية بلا مفتاح.", where: "مطوّر الصفحات ← حدّد صورة ← تعديل ← التقاط العناصر", set: [{ k: "warm", l: "التحضير المسبق في الخلفية بعد تحديد الصورة (أسرع لكنه يستهلك ذاكرة)", t: "bool", d: true }, { k: "matte", l: "دقة الحواف العالية (شعر وتفاصيل دقيقة)", t: "bool", d: true }, { k: "lite", l: "الوضع الخفيف دائماً — أسرع وأقل دقة (يشمل نزع الخلفية)", t: "bool", d: false }] },
    { id: "bg", n: "نزع الخلفية", d: "يزيل خلفية الصورة بضغطة واحدة بالذكاء المحلي (أشخاص، منتجات، خلفيات استوديو).", where: "مطوّر الصفحات ← حدّد صورة ← تعديل ← نزع الخلفية، وهذه الصفحة (أدوات الصور)", set: [{ k: "method", l: "الطريقة", t: "select", o: [["auto", "تلقائي: ذكاء ثم كلاسيكي"], ["classic", "كلاسيكي فقط (خلفيات متجانسة، الأسرع)"]], d: "auto" }, { k: "depth", l: "استعمال العمق لفصل ما وراء الشخص", t: "bool", d: true }] },
    { id: "eraser", n: "الممحاة السحرية", d: "تمسح عنصراً غير مرغوب فيه وتعيد بناء ما خلفه. قيد التطوير وسنطوّرها لاحقاً، وهي معطّلة حالياً.", where: "ستظهر في شريط الصورة بعد تطويرها", dev: true, set: [] },
    { id: "puzzle", n: "البازل", d: "يقسّم الصورة إلى قطع بازل متفرقة بشكل قابل للتحكم.", where: "مطوّر الصفحات ← حدّد صورة ← تعديل ← بازل", set: [{ k: "cols", l: "عدد الأعمدة الافتراضي", t: "num", min: 1, max: 12, d: 4 }, { k: "rows", l: "عدد الصفوف الافتراضي", t: "num", min: 1, max: 12, d: 3 }, { k: "knob", l: "حجم نتوء القطعة %", t: "num", min: 50, max: 160, d: 100 }] },
    { id: "mask", n: "الماسك", d: "يقصّ الصورة بشكل (دائرة، نجمة، قلب…) مع معاينة حيّة ومعالم تجاذب وتدوير.", where: "مطوّر الصفحات ← حدّد صورة ← تعديل ← ماسك", set: [{ k: "invert", l: "الافتراضي: أبقِ الشكل وأخفِ بقية الصورة (بدل حذف الشكل)", t: "bool", d: false }, { k: "snap", l: "التجاذب مع مركز الصورة وحوافها (Alt يعطّله مؤقتاً)", t: "bool", d: true }] }
  ];
  const AT = { tab: "info" };
  function setAppTab(t, id) { AT.tab = t; renderApp(id); }
  function cfgSet(tool, key, v, id) { ImgCfg.set(tool, key, v); }
  function cfgReset(tool, id) { ImgCfg.reset(tool); renderApp(id || "imgtools"); }
  function ctl(tool, f) {
    const v = ImgCfg.get(tool, f.k, f.d), on = `AdminNav.cfg('${tool}','${f.k}',`;
    if (f.t === "bool") return `<label class="tl-r"><span>${esc(f.l)}</span><span class="sw"><input type="checkbox" ${v ? "checked" : ""} onchange="${on}this.checked)"><i></i></span></label>`;
    if (f.t === "num") return `<label class="tl-r"><span>${esc(f.l)}</span><input type="number" min="${f.min}" max="${f.max}" value="${v}" style="width:90px" onchange="${on}Math.max(${f.min},Math.min(${f.max},Number(this.value)||${f.d})))"></label>`;
    return `<label class="tl-r"><span>${esc(f.l)}</span><select onchange="${on}this.value)">${f.o.map(o => `<option value="${o[0]}" ${String(o[0]) === String(v) ? "selected" : ""}>${esc(o[1])}</option>`).join("")}</select></label>`;
  }
  function toolsHtml() {
    return TOOLS.map(T => `<div class="tl-c${T.dev ? " dev" : ""}"><div class="ap-h"><h3 style="font-size:1.05rem">${esc(T.n)}</h3><span class="ap-s ${T.dev ? "off" : "on"}">${T.dev ? "قيد التطوير" : "متاحة"}</span></div><div>${esc(T.d)}</div><div class="hint" style="margin:.3rem 0 0">مكان العمل: ${esc(T.where)}</div>${T.set.length ? `<div class="tl-s">${T.set.map(f => ctl(T.id, f)).join("")}<div class="action-bar"><button class="small gray" onclick="AdminNav.cfgReset('${T.id}')">استعادة الافتراضي</button></div></div>` : `<div class="hint">لا إعدادات حالياً.</div>`}</div>`).join("");
  }
  /* ══ صفحة «قوالب» في تبويب المظهر: تحميل قالب / ناسخ القوالب / إعدادات ══ */
  const TPL = [{ id: "focus-honey", n: "هبوط: عسل التركيز", d: "صفحة هبوط كاملة مبنية بعناصر المطوّر على نمط التصميم المرجعي." }];
  /* ══ مكتبة القوالب (نافذة): نماذج اتصال / نماذج الطلبات / صفحات كاملة، مع تصفية حسب الميدان ══ */
  const LCATS = [["all", "الكل"], ["store", "قوالب كاملة (متجر)"], ["page", "صفحات كاملة"], ["contact", "نماذج اتصال"], ["order", "نماذج الطلبات"]];
  /* نوع القالب: كامل = هوية متجر كاملة (رئيسية + فئات + منتج + هيدر/فوتر) كقوالب OceanWP؛ صفحات = قالب لصفحة أو نموذج فقط */
  const LTYPES = [["all", "الكل"], ["full", "موقع كامل"], ["pages", "صفحات"], ["order", "نموذج طلب"], ["contact", "نموذج إرسال"]];
  const TYPE_CAT = { full: "store", pages: "page", order: "order", contact: "contact" };
  const isFull = x => x.cat === "store";
  const cf = (set, title, desc) => () => { const m = PB.mkW; return PB.mkS([PB.mkC([m("contact", Object.assign({ title, desc }, set))])], { pad: { d: [40, 20, 40, 20], m: [28, 16, 28, 16] } }); };
  const dflt = ks => () => { const L = ks.map(k => PB.DFLT.find(x => x.k === k).f()); return L; };
  const LIB = [
    { id: "c-wa", cat: "contact", fld: "عام", n: "نموذج اتصال بسيط (واتساب)", d: "الاسم والهاتف والبريد والرسالة، تصل جاهزة على واتساب المتجر.", b: cf({}, "تواصل معنا", "اترك رسالتك وسنردّ عليك في أقرب وقت.") },
    { id: "c-dark", cat: "contact", fld: "عام", n: "نموذج اتصال داكن أنيق", d: "خلفية خضراء داكنة وحقول زجاجية وزر ذهبي.", b: cf({ fbg: "#173f35", fbc: "#2b5b4e", tcol: "#ffffff", lcol: "#e6dfcf", ibg: "#ffffff1a", ibc: "#ffffff40", bbg: "#c8a24b", bcol: "#173f35" }, "راسلنا الآن", "فريقنا جاهز للرد على استفساراتك.") },
    { id: "c-quote", cat: "contact", fld: "خدمات", n: "طلب عرض سعر", d: "الاسم والهاتف والولاية ونوع الخدمة وتفاصيل الطلب.", b: cf({ fields: [{ label: "الاسم الكامل", type: "text", ph: "اكتب اسمك", req: true, w: "half" }, { label: "رقم الهاتف", type: "tel", ph: "05XXXXXXXX", req: true, w: "half" }, { label: "الولاية", type: "text", ph: "مثال: الجزائر", req: false, w: "half" }, { label: "نوع الخدمة", type: "select", ph: "اختر الخدمة", opts: "خدمة أولى، خدمة ثانية، أخرى", req: true, w: "half" }, { label: "تفاصيل الطلب", type: "textarea", ph: "صف طلبك بإيجاز", req: true, w: "full" }], btn: "اطلب عرض السعر", subject: "طلب عرض سعر" }, "اطلب عرض سعر", "أخبرنا بما تحتاجه ونعود إليك بعرض مناسب.") },
    { id: "c-health", cat: "contact", fld: "صحة وعسل", n: "استشارة صحية / تغذية", d: "نموذج مخصص للاستشارة حول المنتج المناسب للحالة.", b: cf({ fields: [{ label: "الاسم", type: "text", ph: "اسمك", req: true, w: "half" }, { label: "رقم الهاتف", type: "tel", ph: "05XXXXXXXX", req: true, w: "half" }, { label: "العمر", type: "number", ph: "العمر", req: false, w: "half" }, { label: "الحاجة", type: "select", ph: "اختر", opts: "تقوية الذاكرة، المناعة، الطاقة، أخرى", req: true, w: "half" }, { label: "ملاحظات", type: "textarea", ph: "أي تفاصيل تفيدنا", req: false, w: "full" }], btn: "أرسل استشارتي", subject: "طلب استشارة" }, "استشارة مجانية", "اكتب حالتك وسنقترح عليك المنتج الأنسب.") },
    { id: "o-orig", cat: "order", fld: "متجر", n: "نموذج طلب أليسوم", d: "نموذج الطلب الحقيقي كاملاً بكل عروضه وكميّاته ورسوم التوصيل وزر واتساب.", b: dflt(["order"]) },
    { id: "p-focus-honey", cat: "page", fld: "صحة وعسل", n: "هبوط: عسل التركيز", d: "صفحة هبوط كاملة مبنية بعناصر المطوّر على نمط التصميم المرجعي.", file: "focus-honey" }
  ];
  /* ══ قوالبي: القوالب المحمَّلة (استيراد JSON) أو المنشأة (صفحة محفوظة كقالب) — assets/data/mytpl.json (GitHub/PHP) أو localStorage ══ */
  const MY = { items: null, sha: undefined }, MYF = "assets/data/mytpl.json", MYLS = "alyssum_mytpl";
  const myOn = () => { try { return (typeof PHPAPI !== "undefined" && PHPAPI.on()) || (typeof GH !== "undefined" && GH.cfg && GH.cfg() && GH.cfg().token); } catch (e) { return false; } };
  async function myLoad(force) {
    if (MY.items && !force) return; MY.items = [];
    try { const l = JSON.parse(localStorage.getItem(MYLS) || "null"); if (l && Array.isArray(l.items)) MY.items = l.items; } catch (e) { }
    if (myOn()) { try { const f = await GH.getFile(MYF); MY.sha = f.sha; const j = JSON.parse(decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))))); if (j && Array.isArray(j.items)) MY.items = j.items; } catch (e) { MY.sha = undefined; } }
  }
  async function myPersist() {
    const json = JSON.stringify({ items: MY.items });
    try { localStorage.setItem(MYLS, json); } catch (e) { }
    if (myOn()) { const r = await GH.putFile(MYF, btoa(unescape(encodeURIComponent(json))), MY.sha, "حفظ قوالبي"); MY.sha = r && r.content ? r.content.sha : MY.sha; }
  }
  async function mySave(name, page, src) {
    await myLoad(); const it = { id: "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), n: String(name || "قالب بلا اسم").slice(0, 80), src, date: new Date().toISOString().slice(0, 10), page };
    MY.items.unshift(it);
    try { await myPersist(); } catch (e) { MY.items.shift(); throw e; }
    return it;
  }
  const myAsLib = it => ({ id: "my:" + it.id, my: true, cat: "page", fld: "قوالبي", n: it.n, d: (it.src === "import" ? "محمَّل من ملف" : "منشأ من صفحة") + " · " + (it.date || "") + " · " + (((it.page && it.page.sections) || []).length) + " قسم", file: null, page: it.page });
  function tplFind(id) { if (String(id).startsWith("my:")) { const it = (MY.items || []).find(q => "my:" + q.id === id); return it ? myAsLib(it) : null; } return libAll().find(q => q.id === id); }
  const LS = { type: "all", cat: "all", fld: "all", q: "", v: "lib" }; let LIBX = null; const V = "1.89.45";
  async function libLoad() { if (LIBX) return; LIBX = []; try { const r = await fetch("assets/pages/templates/index.json?v=" + Date.now(), { cache: "no-store" }); if (r.ok) LIBX = (await r.json()).map(x => Object.assign({ file: x.id, adv: true }, x)); } catch (e) { } }
  function libAll() { return LIB.concat(LIBX || []); }
  async function libOpen(view) { await libLoad(); await myLoad(); LS.type = "all"; LS.cat = "all"; LS.fld = "all"; LS.q = ""; LS.v = view === "mine" || view === "load" ? view : "lib"; let m = $("tl-lib"); if (!m) { m = document.createElement("div"); m.id = "tl-lib"; m.onclick = e => { if (e.target === m) libClose(); }; document.body.appendChild(m); } m.style.display = "flex"; libDraw(); }
  function libClose() { const m = $("tl-lib"); if (m) m.style.display = "none"; }
  function libSet(k, v) { LS[k] = v; if (k === "q") { libDraw(true); return; } libDraw(); }
  const TACT = id => `<button type="button" class="small pri" onclick="AdminNav.tplPreview('${id}')">👁 معاينة حقيقية</button><button type="button" class="small" onclick="AdminNav.tplEdit('${id}')">✏️ تعديل القالب</button><button type="button" class="small gold" onclick="AdminNav.tplInstall('${id}')">📌 تثبيت القالب</button>`;
  function libCards(L, mine) {
    return L.length ? `<div class="tl-g">${L.map(x => `<div class="tl-c">${mine ? `<div class="tl-th none-th">🗂</div>` : `<div class="tl-th" onclick="AdminNav.libView('${x.id}')" title="معاينة كبيرة"><img loading="lazy" alt="" src="assets/pages/templates/thumbs/${esc(x.id)}.jpg?v=${V}" onerror="this.parentNode.classList.add('none')"><span>معاينة كبيرة</span></div>`}<div class="ap-h"><b>${esc(x.n)}</b><span class="ap-s on">${esc(x.fld)}</span></div>${!mine && isFull(x) ? '<div class="tl-adv">قالب كامل · رئيسية + فئات + منتج</div>' : ""}${x.adv ? '<div class="tl-adv">متطوّر · تأثيرات قابلة للتعديل</div>' : ""}<div class="hint" style="margin:.3rem 0 .6rem">${esc(x.d)}</div>${mine ? "" : `<div class="hint" style="margin:0 0 .5rem">${esc((LCATS.find(c => c[0] === x.cat) || [])[1] || "")}</div>`}<div class="tl-actions">${TACT(x.id)}</div>${!mine && isFull(x) && x.file ? `<div class="tl-act" style="margin-top:.4rem"><button type="button" class="small gray" onclick="AdminNav.tplPreview('${x.id}')">🏠 الرئيسية</button><button type="button" class="small gray" onclick="AdminNav.tplCatPreview('${x.id}')">🗂 صفحة فئة</button><button type="button" class="small gray" onclick="AdminNav.tplProductPreview('${x.file}')">🛍 صفحة منتج</button></div>` : ""}${mine ? `<div class="tl-act" style="margin-top:.4rem"><button type="button" class="small gray" onclick="AdminNav.myDl('${x.id.slice(3)}')">⬇ تنزيل القالب</button><button type="button" class="small red" onclick="AdminNav.myDel('${x.id.slice(3)}')">🗑 حذف</button></div>` : ""}</div>`).join("")}</div>` : "";
  }
  function libDraw(keepFocus) {
    const m = $("tl-lib"); if (!m) return; const v = LS.v, MYL = (MY.items || []).map(myAsLib);
    const tab = (k, l) => `<button type="button" class="${v === k ? "on" : ""}" onclick="AdminNav.libSet('v','${k}')">${l}</button>`;
    let body = "";
    if (v === "lib") {
      const ALL = libAll(), flds = [...new Set(ALL.map(x => x.fld))], q = LS.q.trim().toLowerCase();
      const L = ALL.filter(x => (LS.type === "all" || x.cat === TYPE_CAT[LS.type]) && (LS.fld === "all" || x.fld === LS.fld) && (!q || (x.n + " " + x.d + " " + x.fld).toLowerCase().includes(q)));
      const sel = (k, opts) => `<select onchange="AdminNav.libSet('${k}',this.value)">${opts.map(o => `<option value="${esc(o[0])}"${LS[k] === o[0] ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`;
      body = `<div class="tl-fb"><label>الميدان ${sel("fld", [["all", "عرض الكل"]].concat(flds.map(f => [f, f])))}</label><label>القالب ${sel("type", LTYPES)}</label><input id="tl-q" type="search" placeholder="🔍 بحث في القوالب" value="${esc(LS.q)}" oninput="AdminNav.libSet('q',this.value)"><span class="hint" style="margin:0">${L.length} قالب</span></div><div class="tl-body">${L.length ? libCards(L, false) : `<div class="hint">لا قوالب مطابقة.</div>`}</div>`;
    } else if (v === "mine") {
      body = `<div class="tl-body">${MYL.length ? libCards(MYL, true) : `<div class="ap-sec"><b>لا قوالب بعد</b><div class="hint">قوالبك المحمَّلة من ملف أو المنشأة من صفحاتك تظهر هنا. ابدأ من «تحميل قالب».</div><button class="small gold" onclick="AdminNav.libSet('v','load')">+ تحميل قالب</button></div>`}</div>`;
    } else {
      body = `<div class="tl-body"><div class="ap-sec"><b>استيراد قالب من ملف</b><div class="hint" style="margin:0 0 .4rem">ملف قالب صدّرته من متجر آخر أو من هنا — يُحفظ في «قوالبي».</div><button class="small gold" onclick="AdminNav.myImport()">⬆ استيراد قالب (ملف)</button></div>
<div class="ap-sec"><b>إنشاء قالب من صفحة</b><div class="hint" style="margin:0 0 .4rem">احفظ تصميم صفحة كقالب في «قوالبي» لتعيد استعماله.</div><div class="action-bar" id="tl-pgs"><button class="small" onclick="AdminNav.mySavePage()">💾 حفظ الصفحة المفتوحة في المطوّر</button></div><div id="tl-pglist" class="hint">⏳ جارِ تحميل صفحاتك المنشورة…</div></div></div>`;
      setTimeout(loadPgList, 0);
    }
    m.innerHTML = `<div class="tl-box"><div class="tl-top"><h3>مكتبة القوالب</h3><button type="button" class="small gray" onclick="AdminNav.libClose()">إغلاق</button></div><div class="ap-tabs">${tab("lib", "المكتبة")}${tab("mine", "⭐ قوالبي (" + MYL.length + ")")}${tab("load", "⬆ تحميل قالب")}</div>${body}</div>`;
    if (keepFocus) { const i = $("tl-q"); if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (e) { } } }
  }
  async function loadPgList() {
    let pages = []; try { const r = await fetch("assets/pages/index.json?t=" + Date.now(), { cache: "no-store" }); pages = r.ok ? await r.json() : []; } catch (e) { }
    const el = $("tl-pglist"); if (!el) return;
    el.innerHTML = pages.length ? `<div class="tl-g">${pages.map(p => `<div class="tl-c"><b>${esc(p.title || p.slug)}</b><div class="hint" dir="ltr" style="margin:.1rem 0 .5rem">/lp/${esc(p.slug)}/</div><div class="tl-act"><button class="small" onclick="AdminNav.mySavePage('${esc(p.slug)}')">💾 حفظ كقالب</button><button class="small gray" onclick="PBAdmin.exportPage('${esc(p.slug)}')">⬇ JSON</button></div></div>`).join("")}</div>` : "لا توجد صفحات منشورة بعد.";
  }
  function myImport() {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = async () => { try { const f = inp.files[0], p = JSON.parse(await f.text()); if (!p || !Array.isArray(p.sections)) throw new Error("ملف قالب غير صالح (لا أقسام)"); await mySave(p.title || f.name.replace(/\.json$/i, ""), p, "import"); toast("✅ حُفظ في «قوالبي»"); LS.v = "mine"; libDraw(); } catch (e) { toast("❌ " + e.message); } };
    inp.click();
  }
  const builderOpen = () => !!(typeof PBApp !== "undefined" && PBApp.E && PBApp.E.page && $("pb-app") && $("pb-app").classList.contains("on"));
  async function mySavePage(slug) {
    try {
      let page, name;
      if (slug) { page = await PBAdmin.load(slug); name = page.title || slug; }
      else { if (!builderOpen()) { toast("افتح صفحة في المطوّر أولاً، أو اختر إحدى صفحاتك المنشورة"); return; } page = JSON.parse(PBApp.pageJson()); name = page.title || "صفحة"; }
      const nm = prompt("اسم القالب:", name); if (!nm) return;
      page = JSON.parse(JSON.stringify(page)); delete page.slug; await mySave(nm, page, "page"); toast("✅ حُفظ «" + nm + "» في «قوالبي»"); LS.v = "mine"; libDraw();
    } catch (e) { toast("❌ " + e.message); }
  }
  async function myDel(id) { const it = (MY.items || []).find(q => q.id === id); if (!it || !confirm("حذف قالب «" + it.n + "» من «قوالبي»؟")) return; const old = MY.items; MY.items = old.filter(q => q.id !== id); try { await myPersist(); libDraw(); } catch (e) { MY.items = old; toast("❌ " + e.message); } }
  function myDl(id) { const it = (MY.items || []).find(q => q.id === id); if (!it) return; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(it.page, null, 1)], { type: "application/json" })); a.download = "template-" + it.n.replace(/[^\w؀-ۿ-]+/g, "-") + ".json"; a.click(); }
  /* الصفحة الكاملة للقالب (جاهزة للمعاينة/التعديل) من ملفه أو بنائه أو «قوالبي» */
  async function tplPageOf(x) {
    if (x.my) return PBAdmin.fresh(Object.assign(PB.newPage(x.n, ""), JSON.parse(JSON.stringify(x.page))));
    if (x.alyssum) return await alyLoad();
    let page;
    if (x.file) { const r = await fetch("assets/pages/templates/" + x.file + ".json?t=" + Date.now()); if (!r.ok) throw new Error("القالب غير موجود"); page = PBAdmin.fresh(await r.json()); }
    else { let secs = x.b(); if (!Array.isArray(secs)) secs = [secs]; page = PB.newPage(x.n, ""); page.sections = secs; }
    const slug = (builderOpen() && PBApp.E.page.product) || ((typeof Admin !== "undefined" && Admin.products && Admin.products[0]) || {}).slug || ((typeof PRODUCTS !== "undefined" && PRODUCTS[0]) || {}).slug || "";
    const fill = n => { (n.cols || []).forEach(fill); (n.widgets || []).forEach(w => { if (w.type === "orderorig" && w.set && !w.set.prod && slug) w.set.prod = slug; fill(w); }); (n.free || []).forEach(fill); };
    (page.sections || []).forEach(fill); return page;
  }
  const hideView = () => { try { $("tl-view").style.display = "none"; } catch (_) { } };
  /* معاينة حقيقية: الصفحة كما تظهر للزبون (ببيانات المتجر أو تجريبية للقوالب) في نافذة بأجهزتها وأزرار تعديل/تثبيت */
  async function tplPreview(id) {
    const x = tplFind(id); if (!x) return;
    try {
      hideView(); libClose(); toast("⏳ جارِ تحضير المعاينة…");
      if (x.cat === "store" && x.file && !x.alyssum && !x.my && window.TplSite) { try { await TplSite.open(id); return; } catch (e) { console.warn("TplSite", e); } }
      const page = await tplPageOf(x), dir = location.href.replace(/[^/]*$/, "");
      const html = PB.fullHtml(PB.migrate(page), Object.assign({ base: "", baseHref: dir, demo: true }, PBApp.siteCtx()));
      SitePreview.openHtml(window.TplSite ? TplSite.plain(html) : html, { title: "معاينة: " + x.n, edit: () => tplEdit(id), editLabel: "✏️ تعديل القالب", install: () => tplInstall(id), installLabel: "📌 تثبيت القالب" });
    } catch (e) { toast("تعذّرت المعاينة: " + e.message); }
  }
  async function tplEdit(id) {
    const x = tplFind(id); if (!x) return;
    try { try { SitePreview.close(); } catch (_) { } hideView(); libClose(); const page = await tplPageOf(x); page.title = x.n; PBApp.open(page, "", true); toast("✅ فُتح القالب في المطوّر — عدّل ثم «حفظ ونشر» (ولا يُنشر شيء قبل ذلك)"); }
    catch (e) { toast("تعذّر الفتح: " + e.message); }
  }
  /* تثبيت القالب: نافذة خيارات بحسب النوع (متجر ← الرئيسية/صفحات المنتجات، وغيره ← إضافة لصفحة مفتوحة/صفحة جديدة) */
  function tplInstall(id) {
    const x = tplFind(id); if (!x) return; try { SitePreview.close(); } catch (_) { } hideView(); libClose();
    let d = $("tl-inst"); if (!d) { d = document.createElement("div"); d.id = "tl-inst"; d.onclick = e => { if (e.target === d) d.style.display = "none"; }; document.body.appendChild(d); }
    const open = builderOpen(), qa = JSON.stringify(id).replace(/"/g, "&quot;");
    const b = (l, h, t) => `<button type="button" class="small ${t || ""}" onclick="document.getElementById('tl-inst').style.display='none';${h}">${l}</button>`;
    d.innerHTML = `<div class="ti-box"><h3>تثبيت «${esc(x.n)}»</h3><div class="hint">اختر أين يُثبَّت. لا يُنشر شيء إلا بعد «حفظ ونشر» في المطوّر، أما صفحات المنتجات فتُنشر مباشرة بعد تأكيد منك.</div><div class="ti-act">${x.cat === "store" && !x.my ? b("🏠 على الصفحة الرئيسية", `AdminNav.tplInstallHome(${qa})`, "gold") + b("🛍 على صفحات المنتجات", x.alyssum ? "AdminNav.alyInstallProductsUi()" : `AdminNav.tplInstallProductsUi(${JSON.stringify(x.file).replace(/"/g, "&quot;")})`, "gold") : b(open ? "➕ إضافة إلى الصفحة المفتوحة" : "📄 فتح كصفحة جديدة", `AdminNav.tplAdd(${qa})`, "gold") + (open ? b("📄 كصفحة جديدة", `AdminNav.tplEdit(${qa})`) : "")}${b("إلغاء", "", "gray")}</div></div>`;
    d.style.display = "flex";
  }
  async function tplAdd(id) {
    const x = tplFind(id); if (!x) return;
    try { const page = await tplPageOf(x); if (builderOpen()) PBApp.insertSections(page.sections, "قالب: " + x.n); else { page.title = x.n; PBApp.open(page, "", true); } }
    catch (e) { toast("تعذّر التثبيت: " + e.message); }
  }
  /* تثبيت قالب متجر على الرئيسية: أقسامه وCSS الخاص به تحل محل الرئيسية في المطوّر (غير منشور حتى «حفظ ونشر»؛ وتبقى نسخة الاسترجاع) */
  async function tplInstallHome(id) {
    const x = tplFind(id); if (!x) return;
    if (!confirm("تثبيت قالب «" + x.n + "» على الصفحة الرئيسية:\n\n• تُستبدل أقسام الرئيسية بأقسام القالب (هيدر/محتوى/فوتر) ويُربط بمنتجاتك وفئاتك\n• يُفتح في المطوّر؛ لا يُنشر شيء إلا بعد «حفظ ونشر» (وتُحفظ نسخة من الرئيسية الحالية للاسترجاع)\n\nمتابعة؟")) return;
    try {
      libClose(); toast("⏳ جارِ تثبيت القالب…"); if (x.alyssum) { try { ALYD = await alyDeal(); } catch (_) { ALYD = null; } }
      let TP = null; if (!x.alyssum && !x.my && x.file) { try { TP = await tplProdLoad(x.file); } catch (_) { } }
      const page = alyLocalize(await tplPageOf(x), { id: x.alyssum ? "alyssum" : (x.file || "tpl"), txt: TP && TP.txt });
      await PBConvert.edit("home"); const P = PBApp.E && PBApp.E.page; if (!P) throw new Error("تعذّر فتح الرئيسية في المطوّر");
      let shopCss = ""; if (!x.alyssum && !x.my) { try { shopCss = (await tplProdLoad(x.file)).shop || ""; } catch (_) { } }
      P.sections = page.sections; P.tplCss = (page.css || "") + (shopCss ? "\n/* صفحة المتجر والفئات وحسابي لهذا القالب */\n" + shopCss : ""); P.tplSkin = x.alyssum ? "alyssum" : (x.file || ""); P.demo = !!page.demo; P.title = "الصفحة الرئيسية";
      PBApp.E.nextLabel = "تثبيت قالب " + x.n; PBApp.E.dirty = true; PBApp.commitAfter(P.sections[0].id);
      toast("✅ ثُبّت القالب — راجعه ثم «حفظ ونشر»");
    } catch (e) { toast("تعذّر التثبيت: " + e.message); }
  }
  /* معاينة صفحة فئة/متجر بهوية القالب نفسه (هيدر وفوتر القالب + شرائح فئاته التجريبية + منتجاته التجريبية) — بلا أي ارتباط بأليسوم أو بمنتجات متجرك */
  async function tplCatPreview(id) {
    const x = tplFind(id); if (!x || !x.file) return;
    try {
      hideView(); libClose(); toast("⏳ جارِ تحضير صفحة الفئة…");
      const T = await tplProdLoad(x.file), home = await tplPageOf(x), cats = [], prods = []; let pw = null;
      alyWalk({ cols: [], widgets: [], free: [], sections: home.sections }, () => { }); home.sections.forEach(sc => alyWalk(sc, n => { if (n.type === "shopcats" && n.set && Array.isArray(n.set.items)) n.set.items.forEach(i => { if (i.dl) cats.push(i.dl); }); if (n.type === "products" && !pw) pw = n; }));
      const clone = o => JSON.parse(JSON.stringify(o)), pg = PB.newPage(x.n + " — صفحة فئة", "");
      const top = clone(T.top), foot = clone(T.foot); top.forEach(sc => { sc.grp = "top"; }); foot.grp = "bot";
      const chips = '<div class="shop-page"><div class="sec-title"><span class="kicker">تسوّق بسهولة</span><h1>' + esc(cats[0] || "المتجر") + '</h1><p>كل منتجات هذا التصنيف</p></div><div id="shop-chips"><a class="chip active">الكل</a>' + cats.map((c, i) => '<a class="chip' + (i === 0 ? "" : "") + '">' + esc(c) + '</a>').join("") + '</div></div>';
      const secs = [PB.mkS([PB.mkC([PB.mkW("html", { code: chips })])], { cw: { d: 1180 }, pad: { d: [24, 20, 4, 20], m: [16, 14, 4, 14] } })];
      if (pw) { const w = clone(pw); w.set.slider = false; w.set.limit = "12"; secs.push(PB.mkS([PB.mkC([w])], { cw: { d: 1240 }, pad: { d: [8, 20, 40, 20], m: [8, 14, 30, 14] } })); }
      pg.sections = top.concat(secs, [foot]); pg.bg = home.bg || pg.bg; if (home.ff) pg.ff = home.ff; pg.css = (home.css || "") + "\n" + (T.shop || ""); pg.demo = true; pg.header = false; pg.footer = false;
      const dir = location.href.replace(/[^/]*$/, ""), html = PB.fullHtml(PB.migrate(pg), Object.assign({ base: "", baseHref: dir, demo: true }, PBApp.siteCtx()));
      SitePreview.openHtml(window.TplSite ? TplSite.plain(html) : html, { title: "صفحة فئة — " + x.n, edit: () => tplEdit(id), editLabel: "✏️ تعديل القالب", install: () => tplInstall(id), installLabel: "📌 تثبيت القالب" });
    } catch (e) { toast("تعذّرت معاينة الفئة: " + e.message); }
  }
  function libView(id) {
    const x = tplFind(id); if (!x) return; let v = $("tl-view");
    if (!v) { v = document.createElement("div"); v.id = "tl-view"; v.onclick = e => { if (e.target === v) v.style.display = "none"; }; document.body.appendChild(v); }
    v.innerHTML = `<div class="tv-box"><div class="tv-top"><b>${esc(x.n)}</b><span>${TACT(x.id)} <button type="button" class="small gray" onclick="document.getElementById('tl-view').style.display='none'">إغلاق</button></span></div><div class="tv-body"><img alt="" src="assets/pages/templates/thumbs/${esc(x.id)}-full.jpg?v=${V}" onerror="this.onerror=null;this.src='assets/pages/templates/thumbs/${esc(x.id)}.jpg?v=${V}'"></div></div>`;
    v.style.display = "flex";
  }
  /* ══ قالب «أليسوم»: معاينة (نافذة بأجهزتها) / تعديل (في المطوّر) / تثبيت (بصور المتجر وروابطه) ══ */
  let ALYP = null;
  async function alyLoad() { if (!ALYP) { const r = await fetch("assets/pages/templates/s-alyssum.json?t=" + Date.now()); if (!r.ok) throw new Error("ملف القالب غير موجود"); ALYP = await r.json(); } return PBAdmin.fresh(JSON.parse(JSON.stringify(ALYP))); }
  const coverOf = p => (p && (p.cover || (p.images && p.images[0]))) || "";
  const aProds = () => ((typeof PBBind !== "undefined" && PBBind.list) ? PBBind.list() : ((typeof Admin !== "undefined" && Admin.products) || [])).filter(p => p && p.active !== false);
  function alyWalk(n, f) { f(n); (n.cols || []).forEach(c => alyWalk(c, f)); (n.widgets || []).forEach(w => alyWalk(w, f)); (n.free || []).forEach(w => alyWalk(w, f)); }
  /* التثبيت: صور القالب ← صور منتجات المتجر وفئاته، اسم المتجر، والأقسام تُوسَم لتحلّ محل هيدر/محتوى/فوتر الرئيسية */
  const ALY_CAT = Object.fromEntries(["skin", "hair", "honey", "health", "roqia", "supplements"].map(k => [k, "assets/img/tpl/alyssum-cat-" + k + ".webp"]));      // صور بطاقات الفئات الجاهزة للفئات المعروفة؛ غيرها يأخذ صورة منتجه
  /* منتج البانر «حسب العروض»: أعلى خصم بين المنتجات وله صورة شفافة الخلفية (تقف على المنصة) */
  let ALYD = null;
  const aImgOk = src => new Promise(res => { const im = new Image(); im.onload = () => { try { const N = 48, c = document.createElement("canvas"); c.width = c.height = N; const x = c.getContext("2d"); x.drawImage(im, 0, 0, N, N); const d = x.getImageData(0, 0, N, N).data, al = (i, j) => d[(j * N + i) * 4 + 3]; let op = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) op++; res([[0, 0], [N - 1, 0], [0, N - 1], [N - 1, N - 1], [N >> 1, 0], [N >> 1, N - 1]].every(q => al(q[0], q[1]) < 20) && op / (N * N) < .8); } catch (e) { res(false); } }; im.onerror = () => res(false); im.src = (typeof REL !== "undefined" ? REL : "") + src; });
  async function alyDeal() {
    const disc = p => { const o = Number(p.old) || 0, n = Number(p.price) || 0; return o > n && n > 0 ? Math.round((o - n) / o * 100) : 0; };
    const L = aProds().filter(p => disc(p) > 0).sort((a, b) => disc(b) - disc(a));
    for (const p of L.slice(0, 12)) for (const im of [p.cover].concat(p.images || []).filter(Boolean).slice(0, 4)) if (await aImgOk(im)) return { p, img: im, d: disc(p) };
    return null;
  }
  function alyLocalize(page, opt) {
    opt = opt || {}; const isAly = !opt.id || opt.id === "alyssum";
    const P = aProds(), best = P.find(p => (p.tags || []).includes("best") && coverOf(p)) || P.find(p => coverOf(p)), other = P.find(p => p !== best && (p.tags || []).includes("new") && coverOf(p)) || P.find(p => p !== best && coverOf(p)) || best;
    const CT = (typeof Admin !== "undefined" && Admin.categories && Object.keys(Admin.categories).length) ? Admin.categories : (typeof CATEGORIES !== "undefined" ? CATEGORIES : {});
    const nm = (typeof SITE_CFG !== "undefined" && SITE_CFG.name) || "", latin = /^[A-Za-z0-9 _.-]+$/.test(nm);
    const rep = o => { if (typeof o === "string") return latin ? o.replace(/ALYSSUM/g, nm.toUpperCase()) : o; if (Array.isArray(o)) return o.map(rep); if (o && typeof o === "object") { Object.keys(o).forEach(k => { o[k] = rep(o[k]); }); } return o; };
    page.sections.forEach((sec, i) => {
      let foot = false; alyWalk(sec, n => { if (n.type === "sfoot") foot = true; });
      sec.grp = i === 0 ? "top" : (foot ? "bot" : "main");
      alyWalk(sec, n => {
        const s = n.set || {};
        if (n.type === "image" && s.slot === "hero" && best) { s.src = coverOf(best); s.alt = best.title; }
        if (n.type === "image" && s.slot === "banner") { if (ALYD) { s.src = ALYD.img; s.alt = ALYD.p.title; } else if (other) { s.src = coverOf(other); s.alt = other.title; } }
        if (ALYD && s.slot === "bannerT") s.text = ALYD.p.title;
        if (ALYD && s.slot === "bannerD") s.html = "<p>خصم " + ALYD.d + "% — " + ALYD.p.price + " دج بدل " + ALYD.p.old + " دج. اطلبه الآن والدفع عند الاستلام.</p>";
        if (ALYD && s.slot === "bannerB") s.html = "<p>عرض خاص · -" + ALYD.d + "%</p>";
        if (ALYD && s.slot === "bannerL") s.link = "/p/" + ALYD.p.slug + "/";
        if (n.type === "shopcats" && s.slotCats) {
          const keys = Object.keys(CT).slice(0, 6);
          if (keys.length) s.items = keys.map(k => ({ cat: k, label: "", img: ALY_CAT[k] || coverOf(P.find(p => p.cat === k && coverOf(p))) || coverOf(best) }));
        }
        if (n.type === "sfoot" && nm) { s.copy = "© " + new Date().getFullYear() + " " + nm + " — جميع الحقوق محفوظة"; }
      });
    });
    if (nm) page.sections.forEach(sec => alyWalk(sec, n => { if (n.set) n.set = rep(n.set); }));
    /* كل المنتجات مع شرائح الفئات: يلزمها #chips و#grid ليعمل سكربت الرئيسية وبطاقات «تسوّق حسب الفئة» (goToCategory) */
    const bi = page.sections.findIndex(sec => sec.cols && sec.cols.some(c => c.widgets.some(w => w.type === "products")));
    const cat = PB.mkS([PB.mkC([PB.mkW("heading", { text: isAly ? "كل منتجاتنا الطبيعية" : "كل منتجاتنا", tag: "h2", fs: { d: 30, m: 24 }, fw: "900", ta: { d: "start" }, color: isAly ? "#ffffff" : (opt.txt || "#111111") }), PB.mkW("html", { code: '<div class="chips" id="chips"></div><div class="grid' + (isAly ? " aly-grid" : "") + '" id="grid"></div>' })])], { cw: { d: 1240 }, cid: "products", pad: { d: [10, 20, 30, 20], m: [6, 16, 20, 16] } });
    cat.grp = "main"; page.sections.splice(bi >= 0 ? bi + 1 : page.sections.length - 1, 0, cat);
    return page;
  }
  /* ───── صفحات المنتجات بأسلوب أليسوم: يُستبدل هيدر/شريط/فوتر الصفحة بنظيرها في القالب، ويُضاف CSS القالب + CSS صفحة المنتج (alyssum-product.css)
     فتبقى بيانات المنتج وقسم الطلب ومحتواه الخاص كما هي، لكن بالخلفية والزجاج الأخضر والأزرار نفسها ───── */
  let ALYPC = null;
  /* شريط الشراء الثابت (جوال فقط): السعر الحالي + زر «اطلب الآن» يمرّر إلى نموذج الطلب، ويختفي حين يكون النموذج ظاهراً */
  const ALY_BUYBAR = '<div class="aly-buybar" dir="rtl"><div class="bb-p"><small>السعر</small><b id="bb-price"></b></div><a class="bb-btn" href="#order-form">اطلب الآن</a></div><script>(function(){var bar=document.querySelector(".aly-buybar");if(!bar)return;var pe=function(){return document.querySelector(".price-now,#pprice")},o=document.getElementById("order-form");function sync(){var e=pe(),b=document.getElementById("bb-price");if(e&&b)b.textContent=e.textContent.trim()}sync();setInterval(sync,1500);if(o&&"IntersectionObserver"in window){new IntersectionObserver(function(es){es.forEach(function(x){bar.classList.toggle("off",x.isIntersecting)})},{threshold:.15}).observe(o)}var a=bar.querySelector(".bb-btn");a.addEventListener("click",function(ev){if(o){ev.preventDefault();o.scrollIntoView({behavior:"smooth",block:"start"})}})})()</script>';
  const alyHas = (n, t) => { let f = false; alyWalk(n, x => { if (x.type === t) f = true; }); return f; };
  async function alySkinProduct(P) {
    if (ALYPC === null) { try { const r = await fetch("assets/pages/templates/alyssum-product.css?t=" + Date.now()); ALYPC = r.ok ? await r.text() : ""; } catch (_) { ALYPC = ""; } }
    const tpl = alyLocalize(await alyLoad()), top = tpl.sections.find(sc => alyHas(sc, "shdr")), foot = tpl.sections.find(sc => alyHas(sc, "sfoot"));
    if (!top || !foot) throw new Error("قالب أليسوم ناقص");
    const isTop = sc => alyHas(sc, "sbar") || alyHas(sc, "shdr"), isFoot = sc => alyHas(sc, "sfoot");
    top.grp = "top"; foot.grp = "bot";
    P.sections = [top].concat((P.sections || []).filter(sc => !isTop(sc) && !isFoot(sc)).map(sc => { if (sc.grp === "top" || sc.grp === "bot") sc.grp = "main"; return sc; }), [foot]);
    alyDarken(P.sections);
    /* إضافات صفحة المنتج: شريط الثقة (من القالب) بعد قسم المعرض/المعلومات، وشريط شراء ثابت للجوال قبل الفوتر؛ يُزالان أولاً كي لا يتكرران عند إعادة التطبيق */
    P.sections = P.sections.filter(sc => !sc.aly);
    let trust = ""; tpl.sections.forEach(sc => alyWalk(sc, n => { if (!trust && n.type === "html" && n.set && /aly-trust/.test(n.set.code || "")) trust = n.set.code; }));
    const ti = P.sections.findIndex(sc => alyHas(sc, "pprice") || alyHas(sc, "poffers") || (JSON.stringify(sc.cols || []).indexOf("gmain") >= 0));
    if (trust) { const ts = PB.mkS([PB.mkC([PB.mkW("html", { code: trust })])], { cw: { d: 1140 }, pad: { d: [6, 20, 18, 20], m: [4, 14, 14, 14] } }); ts.aly = "trust"; P.sections.splice(ti >= 0 ? ti + 1 : 1, 0, ts); }
    const bb = PB.mkS([PB.mkC([PB.mkW("html", { code: ALY_BUYBAR })])], { cw: { d: 1140 } }); bb.aly = "buybar"; bb.grp = "bot"; P.sections.splice(P.sections.length - 1, 0, bb);
    P.tplCss = (tpl.css || "") + "\n" + (ALYPC || ""); P.tplSkin = "alyssum";
    return P;
  }
  /* تحويل ألوان عناصر الصفحة الفاتحة إلى زجاج أخضر داكن: الخلفيات الفاتحة ← زجاج شفاف بحدّ أخضر، والنصوص الداكنة ← فاتحة، وتدرّجات الأقسام الفاتحة تُحذف */
  const aRGB = c => { c = String(c || "").trim(); let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c); if (m) { let h = m[1]; if (h.length === 3) h = h.replace(/./g, "$&$&"); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4), 16), 1]; } m = /^rgba?\(([^)]+)\)$/i.exec(c); if (m) { const a = m[1].split(",").map(x => parseFloat(x)); return [a[0], a[1], a[2], a[3] == null ? 1 : a[3]]; } return null; };
  const aLum = r => (.299 * r[0] + .587 * r[1] + .114 * r[2]) / 255, aLight = c => { const r = aRGB(c); return !!r && r[3] > .5 && aLum(r) > .7; }, aDark = c => { const r = aRGB(c); return !!r && r[3] > .3 && aLum(r) < .5; };
  const A_GLASS0 = "rgba(12,54,29,.82)", A_LINE0 = "rgba(134,239,172,.3)", A_TXT0 = "#ecfdf5";
  function alyDarken(sections, o) {
    o = o || {}; const A_GLASS = o.glass || A_GLASS0, A_LINE = o.line || A_LINE0, A_TXT = o.txt || A_TXT0, TB = o.tbg || "rgba(21,128,61,.2)", TC = o.tcc || "#d9f99d";
    (sections || []).forEach(sec => alyWalk(sec, n => {
      const s = n.set; if (!s) return; const isBox = !n.type || n.type === "col", t = n.type || "", keep = /^(shdr|sbar|sfoot|button|image|orderorig|html|products|pgal|pcard|shopcats|herow|video|marquee|map|contact|poffers|tbadges|pprice)$/.test(t);
      if (aLight(s.bg)) { if (isBox) { s.bg = ""; } else if (!keep || t === "tbadges") { s.bg = A_GLASS; s.bc = A_LINE; s.bw = 1; if (s.shadow && s.shadow !== "none") s.shadow = "md"; } }
      if (aLight(s.bc)) s.bc = A_LINE;
      ["grad1", "grad2"].forEach(k => { if (aLight(s[k])) s[k] = ""; });
      if (!keep && aDark(s.color)) s.color = A_TXT;
      if (t === "tbadges") { ["cbg"].forEach(k => { if (aLight(s[k])) s[k] = TB; }); if (aDark(s.cc)) s.cc = TC; if (aLight(s.cbc)) s.cbc = A_LINE; }
    }));
  }
  /* ───── صفحات المنتجات لبقية القوالب: prod-<id>.json (يولّده gen-template-products.py) فيه شريط/هيدر/فوتر القالب نفسه + CSS بألوانه + شريط ثقة وشريط شراء؛
     وهيكل يختلف من قالب لآخر (layout: classic|mirror|wide|stack) ← لا يتكرر الشكل نفسه ───── */
  const TPC = {};
  async function tplProdLoad(id) {
    if (!TPC[id]) { const r = await fetch("assets/pages/templates/prod-" + id + ".json?v=" + V); if (!r.ok) throw new Error("لا يوجد تصميم صفحة منتج لهذا القالب"); TPC[id] = await r.json(); }
    return JSON.parse(JSON.stringify(TPC[id]));
  }
  function tplLayout(P, lay) {
    const i = P.sections.findIndex(sc => (sc.cols || []).length === 2 && JSON.stringify(sc.cols).indexOf("gmain") >= 0); if (i < 0) return;
    const sc = P.sections[i], g = sc.cols.findIndex(c => JSON.stringify(c).indexOf("gmain") >= 0), gc = sc.cols[g], ic = sc.cols[1 - g];
    [gc, ic].forEach(c => { c.set = c.set || {}; delete c.set.w; });
    sc.set = sc.set || {};
    if (lay === "mirror") sc.cols = [ic, gc]; else sc.cols = [gc, ic];
    if (lay === "wide") { gc.set.w = 58; ic.set.w = 42; sc.set.cw = { d: 1240 }; }
    if (lay === "stack") { gc.set.w = 100; ic.set.w = 100; sc.set.cw = { d: 900 }; }
  }
  async function tplSkinProduct(P, id) {
    const T = await tplProdLoad(id), nm = (typeof SITE_CFG !== "undefined" && SITE_CFG.name) || "", ctxs = (typeof PBApp !== "undefined" && PBApp.siteCtx) ? PBApp.siteCtx() : {}, wa = String(ctxs.wa || "").replace(/\D/g, "");
    const isTop = sc => alyHas(sc, "sbar") || alyHas(sc, "shdr"), isFoot = sc => alyHas(sc, "sfoot");
    [].concat(T.top, [T.foot]).forEach(sec => alyWalk(sec, n => {
      const s = n.set; if (!s) return;
      if (n.type === "shdr" && nm) s.la = nm;
      if (n.type === "sfoot") {
        if (nm) { s.copy = "© " + new Date().getFullYear() + " " + nm + " — جميع الحقوق محفوظة"; if (s.cols && s.cols[0]) s.cols[0].h = nm; }
        if (s.cols && s.cols[2]) s.cols[2].b = String(s.cols[2].b || "").split("\n").filter(l => !/^📱/.test(l) || wa).map(l => /^📱/.test(l) ? "📱 واتساب: [" + wa.replace(/^213/, "0") + "](https://wa.me/" + wa + ")" : l).join("\n");
      }
      if (nm && T.brand && s.cols) s.cols.forEach(c => { if (c && typeof c.b === "string") c.b = c.b.split(T.brand).join(nm); });
    }));
    const top = T.top; top.forEach(sc => { sc.grp = "top"; }); T.foot.grp = "bot";
    P.sections = top.concat((P.sections || []).filter(sc => !isTop(sc) && !isFoot(sc) && !sc.aly).map(sc => { if (sc.grp === "top" || sc.grp === "bot") sc.grp = "main"; return sc; }), [T.foot]);
    if (T.dark) alyDarken(P.sections, { glass: T.glass || "rgba(255,255,255,.07)", line: T.line, txt: T.txt, tbg: T.acc + "33", tcc: T.txt });
    tplLayout(P, T.layout);
    const ti = P.sections.findIndex(sc => alyHas(sc, "pprice") || alyHas(sc, "poffers") || (JSON.stringify(sc.cols || []).indexOf("gmain") >= 0));
    const ts = PB.mkS([PB.mkC([PB.mkW("html", { code: T.trust })])], { cw: { d: 1140 }, pad: { d: [6, 20, 18, 20], m: [4, 14, 14, 14] } }); ts.aly = "trust"; P.sections.splice(ti >= 0 ? ti + 1 : top.length, 0, ts);
    const bb = PB.mkS([PB.mkC([PB.mkW("html", { code: T.buybar })])], { cw: { d: 1140 } }); bb.aly = "buybar"; bb.grp = "bot"; P.sections.splice(P.sections.length - 1, 0, bb);
    P.tplCss = T.css; P.tplSkin = id; if (T.ff) P.ff = T.ff;
    return P;
  }
  /* معاينة قالب على منتج حقيقي: يفتح صفحة المنتج في المطوّر بتصميم القالب دون حفظ */
  async function tplProductPreview(id, slug) {
    try {
      libClose(); try { SitePreview.close(); } catch (_) { }
      const pr = (slug && aProds().find(p => p.slug === slug)) || aProds().find(p => coverOf(p)) || aProds()[0]; if (!pr) { toast("لا توجد منتجات"); return; }
      await PBConvert.edit("product", pr.slug, { fresh: true }); const P = PBApp.E && PBApp.E.page; if (!P) throw new Error("لم تُفتح");
      await tplSkinProduct(P, id); PBApp.E.nextLabel = "تصميم صفحة منتج: " + id; PBApp.E.dirty = true; PBApp.renderCanvas();
      toast("✅ معاينة قالب «" + id + "» على منتج «" + pr.title + "» — لا يُنشر شيء إلا بـ«حفظ ونشر»");
    } catch (e) { toast("تعذّرت المعاينة: " + e.message); }
  }
  async function tplInstallProducts(id, slugs, opt) {
    const list = (slugs && slugs.length ? slugs : aProds().map(p => p.slug)), done = [], fail = [];
    for (const slug of list) {
      try {
        await PBConvert.edit("product", slug, { fresh: true }); const P = PBApp.E && PBApp.E.page; if (!P) throw new Error("لم تُفتح");
        await tplSkinProduct(P, id); PBApp.E.nextLabel = "تصميم صفحة منتج: " + id; PBApp.E.dirty = true;
        await PBConvert.saveDirect(P, PBApp.siteCtx()); await PBBind.commit(); PBApp.E.dirty = false; done.push(slug);
        if (opt && opt.progress) opt.progress(done.length, list.length, slug);
      } catch (e) { console.warn("tplInstallProducts", slug, e); fail.push(slug + ": " + e.message); }
    }
    return { done, fail };
  }
  async function tplInstallProductsUi(id) {
    const L = aProds(); if (!L.length) { toast("لا توجد منتجات"); return; }
    if (!confirm("تطبيق تصميم صفحة المنتج لقالب «" + id + "» على " + L.length + " صفحة منتج:\n\n• هيدر وفوتر وألوان وبطاقات هذا القالب بدل التصميم الحالي (بهيكل خاص به)\n• بيانات المنتج والسعر والعروض ونموذج الطلب كما هي\n• يُحفظ الأصل ويمكن استرجاعه\n• يُنشر مباشرة على الموقع\n\nمتابعة؟")) return;
    libClose(); toast("⏳ جارِ تحويل صفحات المنتجات…");
    const r = await tplInstallProducts(id, L.map(p => p.slug), { progress: (n, t, sl) => toast("⏳ " + n + "/" + t + " — " + sl) });
    try { PBApp.close && PBApp.close(); } catch (_) { }
    toast(r.fail.length ? "⚠ تم " + r.done.length + " وفشل " + r.fail.length + ": " + r.fail[0] : "✅ حُوّلت " + r.done.length + " صفحة منتج (تظهر على الموقع خلال دقيقة)");
  }
  /* تثبيت أسلوب أليسوم على صفحات المنتجات (الكل أو المختارة) ثم حفظها مباشرة؛ الأصل يُحفظ للاسترجاع */
  async function alyInstallProducts(slugs, opt) {
    const list = (slugs && slugs.length ? slugs : aProds().map(p => p.slug)), done = [], fail = [];
    for (const slug of list) {
      try {
        await PBConvert.edit("product", slug); const P = PBApp.E && PBApp.E.page; if (!P) throw new Error("لم تُفتح");
        await alySkinProduct(P); PBApp.E.nextLabel = "أسلوب أليسوم لصفحة المنتج"; PBApp.E.dirty = true;
        await PBConvert.saveDirect(P, PBApp.siteCtx()); await PBBind.commit(); PBApp.E.dirty = false; done.push(slug);
        if (opt && opt.progress) opt.progress(done.length, list.length, slug);
      } catch (e) { console.warn("alyInstallProducts", slug, e); fail.push(slug + ": " + e.message); }
    }
    return { done, fail };
  }
  async function alyInstallProductsUi() {
    const L = aProds(); if (!L.length) { toast("لا توجد منتجات"); return; }
    if (!confirm("تطبيق أسلوب «أليسوم» على " + L.length + " صفحة منتج:\n\n• هيدر وفوتر وخلفية وبطاقات القالب بدل التصميم الحالي\n• بيانات المنتج والسعر والعروض ونموذج الطلب كما هي\n• يُحفظ الأصل ويمكن استرجاعه من «تعديل» الصفحة\n• يُنشر مباشرة على الموقع\n\nمتابعة؟")) return;
    toast("⏳ جارِ تحويل صفحات المنتجات…");
    const r = await alyInstallProducts(L.map(p => p.slug), { progress: (n, t, sl) => toast("⏳ " + n + "/" + t + " — " + sl) });
    try { PBApp.close && PBApp.close(); } catch (_) { }
    toast(r.fail.length ? "⚠ تم " + r.done.length + " وفشل " + r.fail.length + ": " + r.fail[0] : "✅ حُوّلت " + r.done.length + " صفحة منتج بأسلوب أليسوم (تظهر على الموقع خلال دقيقة)");
  }
  async function alyPreview() {
    try {
      libClose(); toast("⏳ جارِ تحضير المعاينة…");
      const page = await alyLoad(), dir = location.href.replace(/[^/]*$/, "");
      const html = PB.fullHtml(PB.migrate(page), Object.assign({ base: "", baseHref: dir }, PBApp.siteCtx()));
      SitePreview.openHtml(window.TplSite ? TplSite.plain(html) : html, { title: "معاينة قالب أليسوم", edit: alyEdit, editLabel: "تعديل في المطوّر", install: alyInstall, installLabel: "تثبيت على متجري" });
    } catch (e) { toast("تعذّرت المعاينة: " + e.message); }
  }
  async function alyEdit() {
    try {
      try { SitePreview.close(); } catch (_) { } libClose();
      const page = await alyLoad(); page.title = "أليسوم";
      PBApp.open(page, "", true); toast("✅ فُتح قالب أليسوم في المطوّر بتأثيراته وخلفياته — عدّل ثم «حفظ ونشر»");
    } catch (e) { toast("تعذّر الفتح: " + e.message); }
  }
  async function alyInstall() {
    if (!confirm("تثبيت قالب «أليسوم» على متجرك:\n\n• تُستبدل صور القالب بصور منتجاتك وفئاتك\n• تُربط الروابط والأزرار والهيدر والفوتر بمتجرك\n• يُفتح في المطوّر كصفحة رئيسية جاهزة؛ لا يُنشر شيء إلا بعد «حفظ ونشر» (وتُحفظ نسخة من الرئيسية الحالية للاسترجاع)\n\nمتابعة؟")) return;
    try {
      try { SitePreview.close(); } catch (_) { } libClose(); toast("⏳ جارِ تثبيت القالب بصور متجرك…");
      try { ALYD = await alyDeal(); } catch (_) { ALYD = null; }
      const page = alyLocalize(await alyLoad());
      await PBConvert.edit("home");
      const P = PBApp.E && PBApp.E.page; if (!P) throw new Error("تعذّر فتح الرئيسية في المطوّر");
      P.sections = page.sections; P.tplCss = page.css; P.title = "الصفحة الرئيسية";
      PBApp.E.nextLabel = "تثبيت قالب أليسوم"; PBApp.E.dirty = true; PBApp.commitAfter(P.sections[0].id);
      toast("✅ ثُبّت القالب بصور وروابط متجرك — راجعه ثم «حفظ ونشر»");
    } catch (e) { toast("تعذّر التثبيت: " + e.message); }
  }
  async function libPreview(id) {
    const x = libAll().find(q => q.id === id); if (!x) return;
    try {
      libClose();
      if (x.file && x.cat === "store") {
        await PBAdmin.openTemplate(x.file);
        try { toast("تم فتح القالب في منشئ الصفحات للمعاينة الحقيقية — لا تحفظ التغييرات إذا كنت لا تريد اعتمادها."); } catch (_) { }
        return;
      }
      if (x.file) {
        const r = await fetch("assets/pages/templates/" + x.file + ".json?t=" + Date.now());
        if (!r.ok) throw new Error("القالب غير موجود");
        const pg = PB.newPage(x.n, "");
        pg.sections = PBAdmin.fresh(await r.json()).sections || [];
        PBApp.open(pg, "", true);
      }
    } catch (e) { try { toast("تعذّرت المعاينة الحقيقية: " + e.message); } catch (_) { } }
  }
  async function libUse(id) {
    const x = libAll().find(q => q.id === id); if (!x) return;
    try {
      libClose();
      if (x.file && x.cat === "store") { await PBAdmin.openTemplate(x.file); return; }
      const open = !!(typeof PBApp !== "undefined" && PBApp.E && PBApp.E.page && $("pb-app") && $("pb-app").classList.contains("on"));
      let secs;
      if (x.file) {
        const r = await fetch("assets/pages/templates/" + x.file + ".json?t=" + Date.now()); if (!r.ok) throw new Error("القالب غير موجود");
        secs = PBAdmin.fresh(await r.json()).sections;
        const slug = (open && PBApp.E.page.product) || ((typeof Admin !== "undefined" && Admin.products && Admin.products[0]) || {}).slug || "";
        const fill = n => { (n.cols || []).forEach(fill); (n.widgets || []).forEach(w => { if (w.type === "orderorig" && !w.set.prod && slug) w.set.prod = slug; fill(w); }); (n.free || []).forEach(fill); };
        secs.forEach(fill);
      } else { secs = x.b(); if (!Array.isArray(secs)) secs = [secs]; }
      if (open) { PBApp.insertSections(secs, "قالب: " + x.n); }
      else { const pg = PB.newPage(x.n, ""); pg.sections = secs; PBApp.open(pg, "", true); }
    } catch (e) { try { toast("تعذّر تحميل القالب: " + e.message); } catch (_) { } }
  }
  const TT = { tab: "load" };
  function tplTab(t) { TT.tab = t; renderTpl(); }
  async function renderTpl() {
    const box = $("tpl-body"); if (!box) return; const t = TT.tab, tabs = [["load", "تحميل قالب"], ["clone", "ناسخ القوالب"], ["set", "إعدادات"]];
    const hd = `<div class="ap-h"><h3>القوالب</h3></div><div class="ap-tabs">${tabs.map(x => `<button type="button" class="${x[0] === t ? "on" : ""}" onclick="AdminNav.tplTab('${x[0]}')">${x[1]}</button>`).join("")}</div>`;
    let body = "";
    if (t === "load") {
      await myLoad();
      body = `<div class="ap-sec"><b>مكتبة القوالب</b><div class="hint" style="margin:0 0 .5rem">كل شيء في نافذة واحدة: تصفّح القوالب بقوائم الفلترة، <b>قوالبي</b> (المحمَّلة والمنشأة)، و<b>تحميل قالب</b> (استيراد ملف أو حفظ صفحة كقالب). وفي معاينة كل قالب: معاينة حقيقية / تعديل القالب / تثبيت القالب.</div><div class="action-bar"><button class="small" onclick="AdminNav.libOpen()">مكتبة القوالب</button><button class="small gold" onclick="AdminNav.libOpen('mine')">⭐ قوالبي (${(MY.items || []).length})</button><button class="small" onclick="AdminNav.libOpen('load')">⬆ تحميل قالب</button></div></div>`;
    } else if (t === "clone") {
      const o = off("cloner");
      body = `<div class="ap-sec"><b>ناسخ القوالب</b><div>${esc(APPS.cloner.d)}</div><ol>${APPS.cloner.how.map(x => "<li>" + esc(x) + "</li>").join("")}</ol><div class="action-bar" style="margin-top:.5rem"><button class="small" onclick="AdminNav.clone()" ${o ? "disabled" : ""}>فتح ناسخ القوالب</button><button class="small gray" onclick="AdminNav.group('apps');AdminNav.app('cloner',document.querySelector('.nav-btn[data-app=cloner]'))">إعدادات التطبيق</button></div>${o ? '<div class="hint">الناسخ معطّل من إعدادات التطبيقات.</div>' : ""}</div>`;
    } else {
      body = `<div class="ap-sec"><b>إعدادات القوالب</b><div class="tl-s">${ctl("tpl", { k: "dest", l: "وجهة النسخ الافتراضية عند وجود صفحة مفتوحة في المطوّر", t: "select", o: [["sec", "قسم داخل الصفحة الحالية"], ["new", "صفحة جديدة"]], d: "sec" })}${ctl("tpl", { k: "imgmax", l: "أقصى عرض للصور المحفوظة من القالب المنسوخ (px)", t: "select", o: [["1280", "1280"], ["1920", "1920"], ["2560", "2560"]], d: 1920 }).replace("this.value)", "Number(this.value))")}${ctl("tpl", { k: "imgcount", l: "أقصى عدد صور فريدة تُحفظ من القالب", t: "num", min: 10, max: 200, d: 80 })}<div class="action-bar"><button class="small gray" onclick="ImgCfg.reset('tpl');AdminNav.tplTab('set')">استعادة الافتراضي</button></div></div><div class="hint">تُحفظ هذه الإعدادات في هذا المتصفح وتُطبَّق عند فتح ناسخ القوالب.</div></div>`;
    }
    box.innerHTML = hd + body;
  }
  function tpl(btn) { try { Admin.tab("tpl", btn); } catch (e) { } renderTpl(); }
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
    const g = typeof GH !== "undefined" && GH.cfg && GH.cfg(); if (!g || !g.token) return toast("حُفظ في هذا المتصفح (اربط النشر لينعكس على موقعك)");
    try { const b64 = btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, off: [...OFF] }, null, 2)))), res = await GH.putFile("assets/data/apps.json", b64, appSha, "تفعيل/تعطيل التطبيقات من لوحة التحكم"); appSha = res && res.content ? res.content.sha : appSha; toast("تم الحفظ — ينعكس على الموقع خلال دقيقة تقريباً"); }
    catch (e) { toast("تعذّر حفظ إعداد التطبيقات: " + e.message); }
  }
  function toggle(id, on) { on ? OFF.delete(id) : OFF.add(id); applyOff(); saveOff(); renderApp(id); }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function renderApp(id) { renderApp0(id); const A = APPS[id], box = $("app-cfg-body"); if (A && A.custom && box && typeof AdminFloat !== "undefined") { const h = document.createElement("div"); h.className = "ap-sec"; h.style.cssText = "padding:0;border:0;background:none"; const hd = box.querySelector(".ap-h"); if (hd) hd.after(h); else box.prepend(h); AdminFloat.mount(h); } }
  function renderApp0(id) {
    const A = APPS[id], box = $("app-cfg-body"); if (!A || !box) return; box.dataset.app = id;
    const cur = (typeof AdminUpdate !== "undefined" && AdminUpdate.current) || "", lat = (typeof AdminUpdate !== "undefined" && AdminUpdate.latest) || "", newer = lat && cur && lat !== cur && lat.split(".").map(Number).join() > cur.split(".").map(Number).join();
    const o = off(id);
    const tabsH = A.tools ? `<div class="ap-tabs"><button type="button" class="${AT.tab === "info" ? "on" : ""}" onclick="AdminNav.setAppTab('info','${id}')">التعريف والتفعيل</button><button type="button" class="${AT.tab === "tools" ? "on" : ""}" onclick="AdminNav.setAppTab('tools','${id}')">قائمة الأدوات</button></div>` : "";
    box.innerHTML = `<div class="ap-h"><h3>${esc(A.n)}</h3><span class="ap-s ${o ? "off" : "on"}">${o ? "معطّل" : "مفعّل"}</span><label class="sw" title="${o ? "تفعيل" : "تعطيل"} التطبيق"><input type="checkbox" ${o ? "" : "checked"} onchange="AdminNav.toggle('${id}',this.checked)"><i></i></label></div>${tabsH}${A.tools && AT.tab === "tools" ? `<div class="ap-sec">${toolsHtml()}</div>` : `
<div class="ap-sec"><b>التعريف</b><div>${esc(A.d)}</div></div>
<div class="ap-sec"><b>كيف يعمل</b><ol>${A.how.map(x => "<li>" + esc(x) + "</li>").join("")}</ol></div>
<div class="ap-sec"><b>مكان عمل التطبيق</b><div>${esc(A.where)}</div><div class="action-bar" style="margin-top:.5rem"><button class="small" onclick="AdminNav.work('${id}')" ${o ? "disabled" : ""}>الانتقال إلى مكان العمل</button></div><div class="hint">التطبيق يبقى يعمل في مكانه المعتاد؛ هذه الصفحة للتعريف والإعداد فقط.</div></div>
<div class="ap-sec"><b>النسخة والتحديث</b><div class="ap-kv"><div><small>النسخة الحالية</small><b dir="ltr">${esc(cur || "—")}</b></div><div><small>أحدث نسخة منشورة</small><b dir="ltr">${esc(lat || cur || "—")}</b></div><div><small>الحالة</small><b>${newer ? "يتوفر تحديث" : "محدّث"}</b></div></div>
<div class="action-bar" style="margin-top:.5rem"><button class="small ${newer ? "gold" : ""}" onclick="AdminNav.update(${newer ? "true" : "false"},'${id}')">${newer ? "تحديث الآن" : "فحص التحديثات"}</button></div><div class="hint">التطبيقات تُحدَّث مع إصدار اللوحة نفسه؛ ورقم النسخة واحد لكلّها.</div></div>
<div class="ap-sec"><b>التفعيل والتعطيل</b><div class="hint" style="margin:0">عند التعطيل: ${esc(A.off)} ويمكنك إعادة التفعيل في أي وقت.</div></div>`}`;
  }
  function app(id, btn) { AT.tab = "info"; try { Admin.tab("appcfg", btn); } catch (e) { return; } renderApp(id); const t = $("app-cfg-body"); if (t) t.dataset.app = id; }
  async function update(isNew, id) { try { if (isNew) return AdminUpdate.apply(); await AdminUpdate.check(true); renderApp(id); } catch (e) { toast("تعذّر التحقق من التحديث"); } }
  function workBtn(w) { return [...document.querySelectorAll(".side-nav .nav-btn.nav-work")].find(b => b.dataset.work === w); }
  const WK = { builder: ["builder", "builder"], smart: ["smart", "pbgen"], imgtools: ["imgtools", "imgtools"], imggen: ["imggen", "imggen"], agent: ["agent", "agent"], voice: ["agent", "agent"] };
  function work(id) {
    if (!APPS[id]) return; if (off(id)) return toast("التطبيق معطّل — فعّله من إعداداته");
    if (id === "ask") return ask(); if (id === "cloner") return clone();
    if (id === "floaters") { AT.tab = "info"; renderApp(id); const h = $("fl-host"); if (h) setTimeout(() => h.scrollIntoView({ behavior: "smooth", block: "start" }), 80); return; }
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
    function secTitle() { const el = document.getElementById("sec-title"); if (!el) return; const b = document.querySelector(".nav-btn.on .nav-txt b"); if (!b) return; const c = b.cloneNode(true); c.querySelectorAll(".nb").forEach(x => x.remove()); const t = (c.textContent || "").trim(); if (t) el.textContent = t; }
    setTimeout(secTitle, 400); setTimeout(secTitle, 1500);
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn); try { secTitle(); if (btn && btn.dataset && btn.dataset.grp && btn.dataset.grp !== cur) apply(btn.dataset.grp); if (t === "agent" && !VOICE) agentView("agent"); if (t === "appcfg" && btn && btn.dataset.app) renderApp(btn.dataset.app); if (t === "tpl") renderTpl(); if (t === "imggen") { const bb = workBtn("builder"); if (bb) { Admin.tab("builder", bb); if (typeof PBAdmin !== "undefined") PBAdmin.mode("ad"); } } } catch (e) { } return r; };
    }
    agentView("agent");
    loadOff();
    try { if (typeof PBApp !== "undefined" && !PBApp.__g) { const o = PBApp.open; PBApp.__g = 1; PBApp.open = function () { if (off("builder")) { toast("مطوّر الصفحات معطّل من تبويب تطبيقات"); return; } return o.apply(this, arguments); }; } } catch (e) { }
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
  return { subs, tplFind, tplProdLoad, tplPageOf, tplSkinProduct, tplProductPreview, tplInstallProducts, tplInstallProductsUi, alyDeal, alyPreview, alyEdit, alyInstall, alySkinProduct, alyInstallProducts, alyInstallProductsUi, alyLocalize, alyLoad, libOpen, libClose, libSet, libUse, libView, libPreview, tplPreview, tplCatPreview, tplEdit, tplInstall, tplInstallHome, tplAdd, myImport, mySavePage, myDel, myDl, libItems: () => LIB, group, app, work, toggle, update, setAppTab, cfg: cfgSet, cfgReset, tpl, tplTab, ask, clone, openBuilder, imgLoad, imgCut, imgWebp, imgDl, apply, off };
})();
