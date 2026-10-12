---
name: alyssum-testing
description: كيفية اختبار لوحة أليسوم والمطوّر (Playwright، test-hand، test-voice، اختبارات المجال) وفخاخ الاختبار المعروفة. استعمله قبل دمج أي تعديل على اللوحة أو المطوّر أو الطلبات.
---
# الاختبار

- **اللوحة والمطوّر:** `NODE_PATH=/opt/node-tools/node_modules node scripts/test-hand.js` — يبني حزمة نظيفة (`make-template.py --target php`) ويشغّل PHP محلياً ويجرّب اللوحة على الحاسوب والجوال (مفاتيح localStorage تُبدَّل `alyssum_`→`store_`). يستغرق ~2 دقيقة؛ إن لم يطبع شيئاً بعد `grep -v ✓` فهو نجح (اقرأ آخر سطر «نجح N من N»).
- **الصوت:** `node scripts/test-voice.js` (290+ حالة).
- **مجال:** `test-stock.js` (المخزون)، `test-payments.js` (تسوية ياليدين)، `test-shipsup.js` (إضافة البلدية)، `test-hub.js`.
- ملف جديد في `assets/img/...` أو `assets/js` يجب أن يدخل حزمة `make-template.py` (قائمة السطر الأساسي) و`shared-files.json` وإلا لن يظهر في الاختبار.

## فخاخ
- اختبار يغيّر دوال `Admin` (courierFetch، renderOrders…) يجب أن **يستعيدها** في النهاية وإلا فسدت الاختبارات التالية.
- نماذج الذكاء (AIVision) محجوبة في البيئة: عطّلها `AIVision.supported=()=>false` ليعمل نزع الخلفية الكلاسيكي.
- صور المعاينة الكسولة: `loading=lazy` داخل إطار غير ظاهر لا تُحمَّل.
- ألوان `color-mix` تُقرأ كـ`color(srgb …)` في computed style.
- لقطات الشاشة: غيّر viewport أولاً؛ المطوّر قد يكون مغلقاً وقت اللقطة.
- أي زر/سطر تعتمد عليه «اليد الصوتية» غيّره في `HAND_CHECKS` و`execVia` (admin-voice.js).
- لا شبكة خارجية في بيئة Claude (Google/Gemini/نماذج HF محجوبة).
