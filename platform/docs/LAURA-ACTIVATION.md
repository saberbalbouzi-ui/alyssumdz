# تفعيل LAURA على الإنتاج — الخطة المعتمدة (الخيار A، 2026-11-27)

**لم يُنشَر شيء على الإنتاج من جهتي.** كل ما يلي يُنفَّذ بيد مسؤول حساب Cloudflare/Supabase الإنتاجي بأسراره هو؛ لا تُرسَل أي مفاتيح أو رموز في المحادثة.

## الحالة المقاسة
- `https://api.alyssumhub.fyi/health`: وحدات المنصة **بلا `laura`**؛ والدالة المنشورة `platform-proxy` هي النسخة 23 بلا مسارات LAURA.
- دالتا Supabase `staff_me` و`is_admin` موجودتان (SECURITY DEFINER، لـ`authenticated` فقط) — تحقق قراءة فقط.
- زر LAURA يفتح «اسألني» مع إشعار «غير مفعَّلة» إلى أن تكتمل الخطوات (هذا السلوك سليم).

## الخطوات (بالترتيب)
1. **نسخة احتياطية أولاً:** `wrangler d1 export alyssum-platform-api --remote --output backup-$(date +%F).sql` (أو Time Travel: `wrangler d1 time-travel info`)؛ وسجّل رقم نسخة الـWorker الحالية (`node platform/api/tools/deploy.mjs --env production --production status`).
2. **تجهيز السرَّين** على جهازك: `LAURA_ACTOR_SECRET` (≥32 حرفاً عشوائياً، `openssl rand -hex 32`) و`LAURA_LLM_KEY` (مفتاح مزوّد النموذج). لا تُكتب في أي ملف في المستودع.
3. **هجرة D1** (إضافية `IF NOT EXISTS`): `platform/api/migrations/0002_laura.sql` ثم تحقق من وجود `lr_pending` و`lr_conv`.
4. **أسرار Worker:** `wrangler secret put LAURA_ACTOR_SECRET` و`LAURA_LLM_KEY` (اختياري `LAURA_MODEL`). **لا تضبط `LAURA_WRITES`** — غيابه = وضع «قراءة وتحليل» (أدوات الكتابة لا تُعرض للنموذج ولا تُنفَّذ، وأي معلَّق قديم يُرفض `writes_disabled`).
5. **dry-run + مقارنة (النشر يشمل الـWorker كاملاً لا LAURA وحدها):**
   ```bash
   ALLOW_PRODUCTION_DEPLOY=yes CF_API_TOKEN=… node platform/api/tools/deploy.mjs --env production --production diff
   ALLOW_PRODUCTION_DEPLOY=yes node platform/api/tools/deploy.mjs --env production --production --dry-run --keep-existing worker
   ```
   `diff` (قراءة فقط) يعرض: ربطاً سيُحذف/يتغيّر، تاريخ التوافق، الجدولة (cron)، وفروق كل ملف كود مع تحذير لأي فرق خارج LAURA (يحجب تغييرات جانبية غير مقصودة: كود Beta/المحفظة/السوق…). لا تتابع إلا بعد مراجعة كل سطر «مخاطر».
6. **نشر الـWorker:** `… deploy.mjs --env production --production --keep-existing worker` (في الإنتاج بلا `--keep-existing`/`--replace-bindings` يرفض النشر). `--keep-existing` يُبقي الربط والتوافق والجدولة المنشورة ويضبط ما نملكه فقط. ثم `status` وتحقق أن `/health` يُظهر `laura`.
7. **مفتاح الموقع (مخصّص، لا تعديل للمفاتيح الحالية):** لا تعدّل `pk_live_*` ولا `pk_test_*` (نطاقهما `*`). أصدر مفتاحاً **جديداً للقراءة فقط** بالنطاقات الأربعة عشر (`laura:chat` + 13 نطاق `:read`؛ بلا `*` وبلا أي `:write`): `node platform/api/tools/laura-issue-key.mjs --tenant <رقم مستأجرك>` (dry-run) ثم بعد المراجعة `ADMIN_TOKEN=… node platform/api/tools/laura-issue-key.mjs --tenant <رقم> --execute --out <ملف>` (يكتب المفتاح في ملف 0600 ولا يطبعه؛ يرفض أي نطاق خارج القائمة). ضعه في سرّ الوسيط بنفسك. تأكد أنه مربوط بمستأجر متجرك. **الكتابة لاحقاً:** نطاقات `:write` المفصّلة في `laura.md` (قسم «نطاقات الكتابة»)، مع `LAURA_WRITES=on` كشرط مستقل.
8. **`platform-proxy` — لا تستبدل عشوائياً:** النسخة المنشورة (v23) محفوظة هنا `platform/docs/laura-only/platform-proxy.v23.deployed.ts`. الكود الحالي في المستودع يضيف إلى LAURA مساراتٍ لا علاقة لها (شحن المحفظة `wallet/deposits`، السوق `marketplace`، `digital/wa`). لذلك جُهّزت نسخة **«LAURA فقط»**: `platform/docs/laura-only/platform-proxy/{index.ts,laura-actor.ts}`؛ فرقها عن v23 هو LAURA وحدها (استيراد، `ASECRET/TID`، فرع `isLauraPath` + ترويسة `X-Laura-Actor`؛ وفحص `is_admin` للمسارات الأخرى كما كان، لكن بعد قراءة جسم JSON). راجع الفرق بنفسك: `diff platform/docs/laura-only/platform-proxy.v23.deployed.ts platform/docs/laura-only/platform-proxy/index.ts`. تُختبر بالاختبارات نفسها: `PROXY_DIR=$PWD/platform/docs/laura-only/platform-proxy node platform/api/test/laura-proxy.test.mjs`.
9. **أسرار Supabase للدالة:** `LAURA_ACTOR_SECRET` (**القيمة نفسها** في الخطوة 4) و`PLATFORM_TENANT_ID` (رقم مستأجر متجرك في المنصة). تُدخَل في لوحة Supabase وليس في المحادثة.
10. **وصول بيانات المتجر إلى مصدر LAURA:** LAURA تقرأ من D1 المنصة عبر مفتاح الموقع. تأكد أن طلبات ومنتجات ومبيعات متجرك الفعلي موجودة هناك (عدّها في D1 `SELECT COUNT(*) FROM cm_orders WHERE tenant_id=?` ومن مصدر آخر: لوحتك). إن كانت صفرية فستجيب LAURA بصحة لكن عن «لا بيانات» — لا تُعلن قبل حلّ ذلك.

## شروط القبول قبل أي إعلان (سكربت واحد)
`/health` سليم لا يكفي. شغّل على جهازك بأسرارك أنت (لا يطبع سراً):
```bash
VERIFY_PROXY_URL=https://<مشروع>.supabase.co/functions/v1/platform-proxy VERIFY_JWT_OWNER=<جلسة المالك الحقيقية> \
VERIFY_API=https://api.alyssumhub.fyi VERIFY_KEY_A=<مفتاح متجرك> VERIFY_KEY_B=<مفتاح متجر آخر> \
VERIFY_ACTOR_SECRET=<نفس LAURA_ACTOR_SECRET> VERIFY_TID_A=<رقم مستأجرك> VERIFY_TID_B=<رقم المتجر الآخر> \
VERIFY_JWT_STAFF=<جلسة موظف محدود> VERIFY_EXPECT_WRITES=off node platform/api/tools/laura-prod-verify.mjs
```
يثبت: دخول المالك الحقيقي عبر الوسيط (B1)، مطابقة ردّ LAURA لمصدر REST مستقل (C2)، رفض هوية/مفتاح متجر آخر وعدم تسرّب مراجع/هواتف (D1–D4)، محادثة بنموذج حقيقي وأداة قراءة تنجح (C1)، حجب بيانات الزبائن عن موظف محدود (F)، عدم ظهور أسرار/رموز في أي ردّ (G1)، ووضع الكتابة كما هو متوقع (A2/B2/E1). أي فحص يُتخطّى = `NOT PROVEN` (الخروج 3). **لا تُعلن قبل `ACCEPTANCE: PROVEN` دون تخطٍّ.**

## فتح الكتابة (بعد نجاح مرحلة القراءة فقط)
1. أضف نطاقات الكتابة اللازمة لمفتاح الموقع، واضبط `LAURA_WRITES=on` (متغيّر عادي، بلا إعادة نشر كود).
2. أنشئ **طلب اختبار مخصّصاً** (وليس طلب زبون حقيقي) ثم شغّل السكربت بـ`VERIFY_EXPECT_WRITES=on VERIFY_WRITE_REF=<مرجعه> VERIFY_ALLOW_APPROVE=yes`: يثبت أن الكتابة تنتهي بإجراء معلّق لا ينفَّذ قبل الموافقة، وأن الموافقة تنفّذ وتتحقق (E3/E4) من مصدر مستقل.
3. للتراجع الفوري: احذف `LAURA_WRITES` ← كل أدوات الكتابة تتعطّل فوراً.

## ما اختُبر وما لم يُختبر
- **اختُبر محلياً:** وحدة LAURA (274 فحصاً) ووضع القراءة (18) وسلسلة الوسيط↔Worker بنسختيه (18) ومنطق diff/الدمج (17) وسكربت القبول نفسه على Worker حقيقي في workerd بنموذج محاكى، ويلتقط الفشل (وضع كتابة خاطئ، سرّ مزروع، عزل). كشف هذا التشغيل خللاً حقيقياً: Worker لا يمرّر `LAURA_WRITES` من `env` (أُصلح، ويحرسه `test/config-passthrough.test.mjs`).
- **لم يُجرَّب:** أي شيء على Cloudflare/Supabase الإنتاجيين؛ قراءة `diff` من واجهة Cloudflare الحقيقية (شكل الردود من التوثيق — شغّله أولاً وتحقق من قراءته للإعدادات)؛ `--keep-existing` على نشر حقيقي؛ نموذج لغوي حقيقي؛ دخول Supabase حقيقي؛ وصول بيانات المتجر الفعلية إلى D1.
