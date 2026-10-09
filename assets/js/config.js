/* ضع رابط Web App الخاص بك هنا (من Google Apps Script → Deploy → Web app → URL /exec) */
const CONFIG = {
  SELLER: true,   /* لوحة «النشر للعملاء» في الإدارة — خاصة بموقع البائع فقط، وتُحذف تلقائياً من حزم العملاء */
  /* هوية الموقع — الملف الوحيد الذي يُعدَّل عند نقل الموقع إلى مالك جديد (انظر HANDOVER.md) */
  SITE: {
    name: "أليسوم ALYSSUM",
    domain: "alyssumdz.com",
    waNumber: "213559237239",           // رقم واتساب بالصيغة الدولية بلا + (يمكن تغييره أيضاً من اللوحة ← الدفع)
    instagram: "alyssumdzofficiel",
    repoOwner: "saberbalbouzi-ui",      // حساب GitHub الذي يُنشر منه الموقع (تستعمله اللوحة)
    repoName: "alyssumdz",
  },
  API_URL: "https://script.google.com/macros/s/AKfycbx8hfWsiB4UCn9u0Z7ySDZYVwvNXTAZMqoc-6SXFDi38m7EFGHr-eGPficx10gepj2C/exec",
  /* ملاحظة أمنية: حُذف ADMIN_KEY من هذا الملف العلني (لم يكن مستعملاً في الكود). المفتاح الذي كان هنا يجب اعتباره مكشوفاً:
     غيّره في Code.gs (Apps Script) إلى قيمة جديدة، ثم أدخل القيمة الجديدة عند تسجيل الدخول إلى لوحة التحكم. */
  /* مصدر الطلبات: "sheets" (الحالي) ← "both" (يكتب في الاثنين للتجربة) ← "supabase" (Supabase فقط + دخول المدير بالبريد) */
  ORDERS_BACKEND: "supabase",
  /* Supabase (الزيارات + المشاهدون الآن + أسئلة الوكيل). الرابط والمفتاح العام (anon / publishable) آمنان للنشر العلني
     لأن الزوار لا يملكون إلا دوالّ محدودة (supabase/schema.sql). لا تضع هنا أبداً مفتاح service_role. */
  SUPABASE_URL: "https://qvdaiundlkfbmjlummni.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_1ZtNDbkZ0uLFEdJeGkX0mw_zwXVI59h",             // ← الصق هنا المفتاح العام من Project Settings ← API Keys (anon / publishable)
  /* استعمال التقنية الذكية عبر API (توليد الصفحة بالصور، الكتابة السحرية «حرر»): معطّل افتراضياً. اجعلها true لتفعيله على هذا الموقع (يحتاج مفتاح Alyssum API). القوالب الجاهزة والإجابات المحفوظة تعمل دائماً بلا API. */
  AI_API: false,
};
