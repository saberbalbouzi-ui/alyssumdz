/* ربط دومينات الزبائن من لوحة المزوّد: يستدعي دالة الحافة `domains` بجلسة المدير، ويبني نص الردّ للزبون.
   لا أسرار هنا: رمز الربط يبقى في أسرار الدالة (saas/functions/domains). */
(function (root) {
  "use strict";
  const MAP = { not_configured: "الربط غير مُعدّ بعد (أسرار الدالة)", unauthorized: "ليست لديك صلاحية", bad_hostname: "صيغة الدومين غير صحيحة", already_linked: "الموقع مربوط بدومين مسبقاً", site_not_found: "الموقع غير موجود", not_linked: "لا دومين مربوطاً بهذا الموقع", no_fallback_origin: "عنوان التوجيه غير مضبوط", bad_action: "إجراء غير معروف" };

  async function call(sb, cfg, body, f) {
    f = f || root.fetch;
    const s = await sb.auth.getSession(), tok = s && s.data && s.data.session && s.data.session.access_token;
    if (!tok) return { ok: false, error: "unauthorized", msg: MAP.unauthorized };
    let r, j = {};
    try {
      r = await f(String(cfg.URL).replace(/\/+$/, "") + "/functions/v1/domains", { method: "POST", headers: { "Content-Type": "application/json", apikey: cfg.KEY, Authorization: "Bearer " + tok }, body: JSON.stringify(body) });
      try { j = await r.json(); } catch (e) { }
    } catch (e) { return { ok: false, error: "network", msg: "تعذّر الاتصال بالخدمة" }; }
    const ok = !!r.ok && j.ok !== false && !j.error;
    return Object.assign({}, j, { ok, msg: ok ? "" : (MAP[j.error] || (j.errors && j.errors[0] && j.errors[0].message) || "فشل الطلب (" + r.status + ")") });
  }

  /* نص الردّ للزبون بعد إنشاء الربط: السجلات المطلوبة في DNS لدى مزوّد دومينه */
  function addMessage(domain, j) {
    const L = ["لتفعيل دومينك " + domain + " أضف في إعدادات DNS لدى مزوّد الدومين:"];
    if (j.cname_target) L.push("• سجل CNAME للاسم " + domain + " يشير إلى: " + j.cname_target);
    const ov = j.ownership;
    if (ov && ov.name && ov.value) L.push("• سجل " + (ov.type || "TXT").toUpperCase() + " للتحقق من الملكية — الاسم: " + ov.name + " والقيمة: " + ov.value);
    L.push("إذا كان دومينك جذرياً (بلا www) فقد يطلب مزوّدك سجل ALIAS أو ANAME أو CNAME flattening؛ والأسهل توجيه www ثم تحويل الجذر إليه.");
    L.push("بعد حفظ السجلات أخبرنا هنا وسنفعّل شهادة الأمان؛ قد يستغرق الأمر من دقائق إلى ساعات بحسب مزوّد DNS.");
    return L.join("\n");
  }

  function activeMessage(domain) { return "تم تفعيل الدومين " + domain + " لموقعك وإصدار شهادة الأمان. يعمل موقعك الآن على هذا العنوان."; }

  /* ملخص حالة الربط للمزوّد */
  function statusLine(j) {
    const c = j.cf_status || "—", s = j.ssl_status || "—";
    if (j.active) return "الدومين نشط وشهادة الأمان فعّالة";
    const why = j.verification_errors && j.verification_errors.length ? " — " + j.verification_errors.join("، ") : "";
    return "حالة الدومين: " + c + " · الشهادة: " + s + why;
  }

  const api = { call, addMessage, activeMessage, statusLine, MAP };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SaasDomains = api;
})(typeof window !== "undefined" ? window : globalThis);
