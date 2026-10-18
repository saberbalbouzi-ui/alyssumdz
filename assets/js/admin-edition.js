/* نسخ لوحة الإدارة الأربع (تُختار من «إعدادات الموقع ← نسخة لوحة الإدارة» وتُحفظ في store.json: edition):
   • pro  — «إيكومرس برو»: اللوحة الحالية كاملة بكل أقسامها.
   • basic — «إيكومرس بازيك»: كل شيء ما عدا «ستوديو ديزاين» (ومولّد الصور الذي صار جزءاً منه).
   • design — «إنفوغراف ديزاين»: مطوّر الصفحات و«ستوديو ديزاين» فقط (يُخفى المتجر وكل إضافاته: الطلبات والمنتجات والشحن والمالية والعملاء… والإضافات الخاصة به)، مع بقاء ما يلزم لإدارة الحساب (إعدادات الموقع لتغيير النسخة، مظهر اللوحة، الفريق والأمان).
   • digital — «ديجيتال برودكتس»: للمنتجات الرقمية (مفاتيح/حسابات/اشتراكات/ملفات): كل الأقسام ما عدا التوصيل والشحن وتجهيز الطرود والمرتجعات والمخزون المادي، وتبدأ على «المنتجات الرقمية» مع الرئيسية الرقمية؛ ويبقى ستوديو ديزاين.
   الإخفاء بالأنماط على أزرار القائمة + حارس على Admin.tab فلا يُفتح قسم محجوب برمجياً أو بالبحث أو بالصوت. */
const AdminEdition = (() => {
  const $ = id => document.getElementById(id), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const EDS = [
    ["pro", "إيكومرس برو", "اللوحة الكاملة بكل الأقسام: المتجر والطلبات والشحن والمالية والتسويق والأدوات وستوديو ديزاين."],
    ["basic", "إيكومرس بازيك", "كل أقسام المتجر والأدوات ما عدا «ستوديو ديزاين» ومولّد الصور (جزء منه)."],
    ["digital", "ديجيتال برودكتس", "للمنتجات الرقمية (مفاتيح وحسابات واشتراكات وملفات): بلا توصيل ولا شحن ولا مخزون مادي، وتبدأ من الرئيسية الرقمية."],
    ["design", "إنفوغراف ديزاين", "مطوّر الصفحات و«ستوديو ديزاين» فقط للمصممين: بلا متجر ولا طلبات ولا شحن ولا إضافاته."]
  ];
  /* الأقسام المسموحة في نسخة المصمّم (Admin.tab) — الباقي محجوب. أقسام العمل الخفية لأدوات الصور تبقى لأن المطوّر يفتحها (دفعات/كتالوج) */
  const KEEP_DESIGN = ["builder", "studio", "store", "admtheme", "team", "imgtools", "imggen", "appcfg", "agent"];
  const BASIC_HIDE = ["studio", "imggen"];      // مولّد الصور جزء من «ستوديو ديزاين»
  /* أقسام التوصيل والمادي المحجوبة في نسخة الديجيتال (مطابقة لـAdminKind.PHYS) */
  const PHYS = ["shipped", "callcenter", "pack", "dispatch", "delivery", "fees", "returns", "inventory", "sources", "blacklist", "market"];
  const D = () => (typeof AdminStores !== "undefined" && AdminStores.data && AdminStores.data()) || {};
  const owner = () => { try { const m = AdminRoles.state && AdminRoles.state.me; return !m || m.owner !== false; } catch (e) { return true; } };
  const edition = () => { const e = D().edition; return EDS.some(x => x[0] === e) ? e : "pro"; };
  /* نقية: هل القسم مسموح في النسخة؟ */
  const allows = (ed, tab) => ed === "design" ? KEEP_DESIGN.includes(tab) : ed === "basic" ? !BASIC_HIDE.includes(tab) : ed === "digital" ? !PHYS.includes(tab) : true;
  /* نقية: هل زر القائمة (من نص onclick) يبقى ظاهراً؟ — design: أزرار Admin.tab المسموحة وإعدادات إضافة «مطوّر الصفحات» فقط */
  function keepBtn(ed, onclick) {
    const t = /Admin\.tab\('([a-z0-9]+)'/.exec(onclick || ""), a = /AdminNav\.app\('([a-z0-9]+)'/.exec(onclick || "");
    if (ed === "pro") return true;
    if (ed === "digital") return !(t && PHYS.includes(t[1]));
    if (ed === "basic") return !((t && BASIC_HIDE.includes(t[1])) || (a && BASIC_HIDE.includes(a[1])));
    if (t) return KEEP_DESIGN.includes(t[1]) && !["imgtools", "imggen", "appcfg", "agent"].includes(t[1]);
    if (a) return a[1] === "builder";
    return false;
  }
  function css() {
    if ($("ed-css")) return; const st = document.createElement("style"); st.id = "ed-css";
    st.textContent = 'html.ed-basic .pbx-tabs button[data-lt=img],html.ed-basic .pbx-tabs button[data-lt=stk],html.ed-basic .pbx-tabs button[data-lt=ast],html.ed-basic .pbx-tabs button[data-lt=pub],html.ed-basic [data-qb=edit],html.ed-basic #pbx-ep,html.ed-basic #pbx-epf,html.ed-basic #pbx-adsz,html.ed-basic #pbx-adx,html.ed-basic .card:has(>#pb-modes),html.ed-basic #pbnp [data-np=size]{display:none!important}html.ed-basic .nav-btn.ed-x{display:none!important}html.ed-design .nav-btn.ed-x,html.ed-digital .nav-btn.ed-x{display:none!important}html.ed-design #nav-groups{display:none!important}html.ed-design .side-nav[data-g] .nav-btn.ed-keep:not(.nav-work):not(.nav-hid){display:flex!important}' +
      '.ed-badge{display:inline-block;margin-inline-start:.4rem;padding:.1rem .55rem;border-radius:999px;font-size:.72rem;font-weight:800;background:rgba(var(--g-mint-rgb,198,254,23),.2);border:1px solid rgba(var(--g-mint-rgb,198,254,23),.45)}';
    document.head.appendChild(st);
  }
  function mark() {
    const ed = edition();
    document.querySelectorAll(".side-nav .nav-btn").forEach(b => { const keep = keepBtn(ed, b.getAttribute("onclick")); b.classList.toggle("ed-x", !keep); b.classList.toggle("ed-keep", keep); });
  }
  function apply() {
    css(); const ed = edition(), h = document.documentElement;
    h.classList.toggle("ed-basic", ed === "basic"); h.classList.toggle("ed-design", ed === "design"); h.classList.toggle("ed-digital", ed === "digital"); h.classList.toggle("kind-digital", ed === "digital" || D().kind === "digital"); mark();
    /* في نسخة المصمّم: إن كان القسم الحالي محجوباً ننتقل إلى مطوّر الصفحات */
    try { const on = document.querySelector(".nav-btn.on"), cur = on && (/Admin\.tab\('([a-z0-9]+)'/.exec(on.getAttribute("onclick") || "") || [])[1]; if (cur && !allows(ed, cur)) land(); } catch (e) { }
  }
  const landing = () => edition() === "design" ? "builder" : edition() === "digital" && owner() ? "digital" : "home";
  function land() { try { const t = landing(), b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("Admin.tab('" + t + "'")); if (b && typeof Admin !== "undefined") Admin.tab(t, b); } catch (e) { } }
  /* حارس الأقسام: يمنع فتح قسم محجوب بالبحث أو الصوت أو الرابط */
  function guard() {
    const a = typeof Admin !== "undefined" ? Admin : null; if (!a || a.__edWrapped || !a.tab) return; a.__edWrapped = true;
    const o = a.tab.bind(a);
    a.tab = function (t) { const ed = edition(); if (t && !allows(ed, t)) { try { toast("هذا القسم غير متاح في نسخة «" + (EDS.find(x => x[0] === ed) || [0, ""])[1] + "» — غيّر النسخة من إعدادات الموقع"); } catch (e) { } return ed === "design" ? o("builder") : ed === "digital" ? o("digital") : o("home"); } return o.apply(a, arguments); };
  }
  /* بطاقة الاختيار داخل «إعدادات الموقع» */
  function cardHtml(sel) {
    return '<div class="card"><h3>نسخة لوحة الإدارة</h3><div class="hint">اختر اللوحة المناسبة لنشاطك. يغيّر هذا ما يظهر في لوحة التحكم هذه فقط، ويمكنك الرجوع إلى «إيكومرس برو» في أي وقت من هنا.</div>' +
      '<div style="display:grid;gap:.5rem;margin-top:.5rem">' + EDS.map(e => '<label style="display:flex;gap:.6rem;align-items:flex-start;border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:.6rem .8rem;cursor:pointer"><input type="radio" name="stp-edition" onchange="AdminEdition.set(this.value)" value="' + e[0] + '"' + (sel === e[0] ? " checked" : "") + ' style="width:auto;margin-top:.3rem"><span><b>' + esc(e[1]) + '</b><br><small>' + esc(e[2]) + '</small></span></label>').join("") + '</div></div>';
  }
  /* اختيار فوري: يُحفظ في إعدادات الموقع ويسري على اللوحة حالاً */
  function set(v) {
    if (!EDS.some(x => x[0] === v)) return; const S = typeof AdminStores !== "undefined" ? AdminStores : null; if (!S || !S.patch) return;
    Promise.resolve(S.patch({ edition: v })).then(() => { apply(); try { if (document.getElementById("rl") && typeof AdminRoles !== "undefined") AdminRoles.render(); } catch (e) { } try { if (typeof AdminKind !== "undefined") AdminKind.apply(); } catch (e) { } try { toast("تم تفعيل نسخة «" + EDS.find(x => x[0] === v)[1] + "»"); } catch (e) { } if (v === "design" || v === "digital") land(); }).catch(() => { apply(); });
    apply();
  }
  const picked = () => { const r = document.querySelector('input[name="stp-edition"]:checked'); return r ? r.value : null; };
  function init() { guard(); apply(); const t = setInterval(() => { guard(); apply(); }, 1500); setTimeout(() => clearInterval(t), 12000); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0)); else setTimeout(init, 0);
  return { set, edition, allows, PHYS, keepBtn, apply, landing, land, cardHtml, picked, EDS, KEEP_DESIGN, mark, guard };
})();
