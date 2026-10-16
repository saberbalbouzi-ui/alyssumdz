# بوابة الشحن كخدمة (Shipping Gateway)

واجهة REST واحدة لكل شركات التوصيل الجزائرية، تُباع كخدمة لعدة مستأجرين (كل عميل بمفتاحه وخطته وحدوده). مبنية فوق وحدة `../src` (محوّلات الشركات + الخزنة المشفّرة + قاموس الحالات). توثيق العميل في `docs.html` (تُخدَّم على `/`).

## ما الذي يميّزها
- **متوافقة مع صيغة dzship** (`courier` + `credentials` + `order.recipient…`) فيسهل انتقال عملائهم.
- **وضعان للمفاتيح:** inline (لا تُخزَّن) أو **خزنة مشفّرة** AES-256-GCM (يكفي مفتاح البوابة).
- **webhook صادر موقَّع** (HMAC + طابع زمني + إعادة محاولة) و**webhook وارد** من الشركات و**تزامن تلقائي** (`cron.php`) — dzship بلا push.
- **idempotency** بالمرجع (قيد فريد) + **تصحيح تهجئة البلدية** + `/v1/validate` تحقق جاف + 69 ولاية (`shipAs` للولايات الجديدة).
- مفاتيح `gk_test_` مع `sandbox` للتجربة، بصمة المفتاح (sha256) فقط محفوظة، وعزل كامل بين المستأجرين (`tenant_id` في كل استعلام).

## التشغيل
```bash
export APP_ENCRYPTION_KEY=$(php -r 'echo base64_encode(random_bytes(32));')   # احفظه في مكان آمن: ضياعه = ضياع مفاتيح الخزنة
export SHIPGW_PUBLIC_URL=https://api.example.dz
export SHIPGW_DATA_DIR=/var/lib/shipgw        # خارج الجذر العام (يُنشأ gateway.sqlite تلقائياً)
php admin.php tenant:create "اسم العميل" client@mail.dz pro
php admin.php key:create 1 live     # يُعرض المفتاح مرة واحدة
php admin.php key:create 1 test
# cron كل دقيقة:  * * * * * php /path/gateway/cron.php
```
خادم الويب: وجّه كل المسارات إلى `index.php` (Apache: `.htaccess` الموجود؛ Nginx: `try_files $uri /index.php;` مع **منع** `bootstrap|admin|cron.php` و`/data/`). للتجربة: `php -S 127.0.0.1:8792 -t . index.php`.
متغيرات اختيارية: `SHIPGW_DB_DSN` (المخطط الحالي SQLite؛ MySQL يحتاج تعديل `ON CONFLICT` في `Limiter::count` وأنواع الأعمدة)، `SHIPGW_ENV_FILE`.

## الأوامر (`php admin.php`)
`tenant:create` · `key:create|key:revoke` · `tenant:plan|tenant:suspend|tenant:activate` · `plan:price <خطة> <دج>` · `tenants` · `usage`.

## الاختبار
`php scripts/test-gateway.php` (76 فحصاً: مصادقة، idempotency، عزل المستأجرين، حدود الخطة، الخزنة، hooks الواردة والصادرة، cron).

## حدود صريحة
- لم تُجرَّب على حسابات شركات حقيقية (ياليدين الأوثق؛ البقية تجريبية). تنطبق عليها تحفظات الوحدة الأم.
- الأحداث الصادرة لطرود الخزنة فقط (المفاتيح غير المحفوظة لا يمكن الاستعلام بها).
- كتالوج البلديات/المكاتب ثابت (`data/geo.json` يُولَّد بـ`node scripts/gen-gateway-geo.js`)؛ بلا أسعار توصيل (`/v1/rates` لم يُبنَ).
- الإلغاء والبوليصة غير مكشوفين في REST بعد؛ الفوترة والدفع غير مبنيين (الأسعار فارغة في `gw_plans`).
- لا واجهة ويب لإدارة العملاء بعد (CLI فقط)؛ لا حدّ لكل هاتف زبون (مضاد إساءة).
