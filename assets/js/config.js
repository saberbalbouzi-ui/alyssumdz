/* ضع رابط Web App الخاص بك هنا (من Google Apps Script → Deploy → Web app → URL /exec) */
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbx8hfWsiB4UCn9u0Z7ySDZYVwvNXTAZMqoc-6SXFDi38m7EFGHr-eGPficx10gepj2C/exec",
  /* ملاحظة أمنية: حُذف ADMIN_KEY من هذا الملف العلني (لم يكن مستعملاً في الكود). المفتاح الذي كان هنا يجب اعتباره مكشوفاً:
     غيّره في Code.gs (Apps Script) إلى قيمة جديدة، ثم أدخل القيمة الجديدة عند تسجيل الدخول إلى لوحة التحكم. */
  /* مصدر الطلبات: "sheets" (الحالي) ← "both" (يكتب في الاثنين للتجربة) ← "supabase" (Supabase فقط + دخول المدير بالبريد) */
  ORDERS_BACKEND: "sheets",
  /* Supabase (الزيارات + المشاهدون الآن + أسئلة الوكيل). الرابط والمفتاح العام (anon / publishable) آمنان للنشر العلني
     لأن الزوار لا يملكون إلا دوالّ محدودة (supabase/schema.sql). لا تضع هنا أبداً مفتاح service_role. */
  SUPABASE_URL: "https://qvdaiundlkfbmjlummni.supabase.co",
  SUPABASE_ANON_KEY: "",             // ← الصق هنا المفتاح العام من Project Settings ← API Keys (anon / publishable)
};
