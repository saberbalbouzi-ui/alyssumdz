# Pagebuilder Copilot — المرحلة 2: ربط النموذج الحقيقي عبر AiProxy (بيئة التطوير فقط)

**الحالة:** مكتوب ومختبر بمحاكيات؛ **لا نشر ولا تطبيق SQL على أي مشروع ولا دمج في main.** لم يُجرَّب مع Gemini الحقيقي (لا مفتاح).

## المكوّنات
| الملف | الدور |
|---|---|
| `platform/sql/copilot-ai-limits.sql` | جداول `saas_ai_policy/runs/ledger` + `saas_ai_charge2` / `saas_ai_refund2`. الحدود دائمة داخل قاعدة البيانات بقفل صف الموقع (`for update`): مكالمات النموذج/الصور/المحاولات لكل تشغيل + سقف يومي (بتوقيت الجزائر) + `req_id` لا يُخصم مرتين + استرداد مرة واحدة + عدّادات المحاولات لا تنقص عند الاسترداد. الرفض لا يغيّر شيئاً |
| `platform/functions/ai/index.ts` | وضع جديد يُفعَّل بوجود `run`+`req`؛ الوضع القديم بلا تغيير. يلغي الطلب لدى Google عند إلغاء العميل/المهلة ويستردّ، ويتحقق من المخرجات خادمياً (`copilot_plan` / `copilot_envelope` / صورة) بدل افتراض `responseSchema` |
| `assets/js/ai-proxy.js` | إضافة `AiProxy.call()` (مهلة، إلغاء `AbortSignal`، ترجمة الأخطاء `AiError`) دون تغيير سلوك التحويل القديم |
| `scripts/pagebuilder-copilot-real.js` | `PBCopilotReal.create()` يبني محوّلات `llm/img/removeBg/guard` الحقيقية؛ المحاكيات تبقى للاختبارات |
| `scripts/pagebuilder-copilot.js` | `hooks.afterOp`، `e.limit` لا يُعاد، إلغاء المستخدم (`cancelled`) كانقطاع قابل للاستئناف، المساس بعنصر محمي يُسقط التشغيل كله، `page.background` + `continuity_break` |

## ما يلزم منك قبل أي تجربة حقيقية (لم أفعل أياً منه)
1. تطبيق `platform/sql/copilot-ai-limits.sql` على مشروع **التطوير** (بعد `schema.sql`).
2. نشر الدالة `ai` على التطوير (Verify JWT مطفأ) ووضع السر `GEMINI_API_KEY` في **أسرار بيئة التطوير** — لم أفحص هل هو مضبوط، ولم أضع أي مفتاح في المستودع أو الواجهة.
3. وضع رمز موقع تجريبي (`AiProxy.set(token)`) ورصيد نص/صور له في `saas_sites`.
4. معايرة `saas_ai_policy` (وحدات `cost_text/cost_image/daily_cost_cap` نسبية لا دولارات).

## الاختبارات
`node --experimental-strip-types --no-warnings scripts/test-copilot-fn.mjs` (42) · `bash scripts/test-copilot-limits.sh` (30، Postgres محلي مؤقت بطلبات متزامنة) · `NODE_PATH=/opt/node-tools/node_modules node scripts/test-copilot.js` (76) · `… scripts/test-copilot-real.js` (56) · الموجودة: `test-ai-fn.mjs` (12) و`test-ai-proxy.js` (15).

## حدود معروفة
- `responseSchema` غير مدعوم في الوسيط (`CFG_KEYS`)؛ لم يُضف لأن سلوكه لدى Google غير مُتحقَّق: يعتمد التحقق الخادمي + التحقق الكامل في العميل.
- رمز الموقع في `localStorage` (تصميم AiProxy القائم) وهو ليس مفتاح Gemini؛ الحماية الفعلية رصيد/حدود الخادم.
- `guard` في العميل علامة فقط؛ كل التحقق والخصم داخل نداء الخادم.
- جودة البرومبت وتماسك التصميم مع نموذج حقيقي غير مُجرَّبين؛ الاستمرارية تُفحص بفرق ألوان حواف الأقسام لا بالعين. المراجعة البصرية (المرحلة 5) غير منفَّذة.
