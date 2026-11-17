# كائنات الرقية في قاعدة `alyssum-beta` — جرد وتبعيات وخطة تنظيف مقترحة

> **الحالة (2026-11-17): نُفِّذ التنظيف على `alyssum-beta` وحدها بموافقتك** — انظر §6 (سجل التنفيذ) و§7 (الاستعادة). الجرد في §2 يصف الحالة **قبل** التنظيف؛ الحالة الآن: 0 كائن رقية. لم يُلمس Production.
> **السياق المعماري:** الرقية الشرعية وحجز المواعيد وظيفة موقع ALYSSUM الشخصي فقط، لا جزء من منصة SaaS ولا من Core Intelligence. دخلت قاعدة Beta لأن حزمة SQL القديمة كانت تضم `ruqya.sql` وكتلة `RUQYA` من `hardening-v01b.sql`. الحزمة الجديدة (هذا الفرع) تستثنيهما، لكن القاعدة القائمة ما زالت تحمل ما طُبِّق سابقاً.

## 1) ما تغيّر في الحزمة (يخص أي قاعدة Beta جديدة)
- `platform/supabase/ruqya.sql` صار في `excluded` ضمن `platform/env/beta-resources.json`.
- `scripts/supabase-beta-apply.mjs` يجرّد كتلة `-- RUQYA:start … -- RUQYA:end` من `hardening-v01b.sql` (الآلية نفسها لحزمة العميل في `make-template.py`)، ويشترط وجود العلامتين مرة واحدة، ويرفض الحزمة إن بقي أي أثر لـruqya/رقية في أي ملف.
- يثبت ذلك `platform/supabase/tests/beta/beta-bundle.test.mjs` (19 فحصاً): الـSQL التنفيذي المتبقي من `hardening-v01b` يطابق الأصل منقوصاً الكتلة حرفياً، وحماية `rate_hits` و`_rl_hit` و`customer_register` و`track_order` باقية.
- **لم يُطبَّق شيء على `alyssum-beta`.**

## 2) جرد الكائنات الموجودة الآن في `alyssum-beta`
| النوع | العدد | التفاصيل |
|---|---|---|
| جداول | 6 | `ruqya_blocks` (3 أعمدة) · `ruqya_bookings` (25) · `ruqya_portal_accounts` · `ruqya_portal_links` · `ruqya_visits` · `ruqya_warnings` — **RLS مفعّل على الستة** |
| صفوف | **0** في كل جدول | `admin_kv` (مفتاح ruqya): 0 · `rate_hits` (kind ruqya*): 0 |
| فهارس | 12 | 6 للمفاتيح الأساسية + `ruqya_day_idx` · `ruqya_phone_idx` · `ruqya_portal_acc_booking_idx` · `ruqya_portal_links_token_hash_key` · `ruqya_visits_booking_idx` · `ruqya_warn_phone_idx` |
| سياسات RLS | 6 | واحدة لكل جدول، للمدير (`authenticated`) |
| دوال | 12 | `_ruqya_norm` · `_ruqya_slots` · `ruqya_book` · `ruqya_config` · `ruqya_lookup` · `ruqya_mark_noshow` · `ruqya_portal_claim` · `ruqya_portal_invite` · `ruqya_portal_me` · `ruqya_portal_unlink` · `ruqya_taken` + المساعدة `_rq_price(text,integer)` (اسمها لا يحوي ruqya) |
| تسلسلات (sequences) | 4 | `ruqya_bookings_id_seq` · `ruqya_visits_id_seq` · `ruqya_portal_links_id_seq` · `ruqya_warnings_id_seq` (تُحذف مع جداولها) |
| مشغّلات / views / أنواع | 0 / 0 / 0 | — |

**ما لم يُطبَّق:** نسخة `ruqya.sql` على `main` تعرّف 17 دالة؛ الموجود في القاعدة 12 فقط. غائبة: `_rq_live` · `_rq_pcap` · `ruqya_portal_claim2` · `ruqya_portal_invite2` · `ruqya_wa_verify` (إضافات أحدث، وهي من الأسباب التي تمنع إعادة التطبيق).

## 3) خريطة التبعيات
**أ) من الرقية إلى كائنات مشتركة (لا تُحذف مع الرقية):**
| كائن الرقية | يعتمد على | ملاحظة |
|---|---|---|
| `ruqya_book` و`ruqya_lookup` و`ruqya_portal_claim` | `public._rl_hit()` (محدِّد المعدّل من `hardening-v01b`) | **مشترك: يخدم `customer_register` و`track_order` أيضاً** |
| `ruqya_mark_noshow` و`ruqya_portal_invite` و`ruqya_portal_unlink` | `public.is_admin()` | مشترك |
| `ruqya_book` و`ruqya_lookup` | جدولا المتجر `orders` و`customers` | قراءة فقط |
| `ruqya_book` و`ruqya_config` و`ruqya_taken` | `admin_kv` | قراءة فقط (لا صفوف رقية) |
| `ruqya_portal_me` | `visits` | قراءة فقط |
| `ruqya_config` | `_rq_price()` | مساعدة للرقية فقط |
| `ruqya_portal_accounts.user_id` | **مفتاح أجنبي إلى `auth.users`** | حذف الجدول لا يمسّ المستخدمين |
| الجداول الأربعة الفرعية | مفاتيح أجنبية إلى `ruqya_bookings` | تُحذف قبلها |

**ب) من الكائنات المشتركة إلى الرقية: لا شيء.** لا مفاتيح أجنبية واردة من خارج الرقية، ولا سياسات أو مشغّلات أو views أو دوال أخرى تشير إليها (الدالة الوحيدة غير المسمّاة ruqya التي تذكرها هي `_rq_price`). لذا حذفها نظرياً **غير كاسر** لأي وظيفة منصة أو متجر في Beta.

**ج) تعرّض الزائر (anon):** 6 دوال قابلة للتنفيذ من `anon`: `ruqya_book` · `ruqya_config` · `ruqya_lookup` · `ruqya_taken` · `_ruqya_norm` · `_ruqya_slots` (محكومة بحدّ معدّل وSECURITY DEFINER حيث يلزم). وظيفة موقع ALYSSUM مكشوفة بذلك في قاعدة المنصة، وهو أحد مبررات التنظيف.

## 4) ما لا يجوز حذفه ضمن أي تنظيف
`public._rl_hit` · `public.rate_hits` · `public.is_admin` · `public._ip_hash` · `public._client_ip` · `public.admin_kv` · `public.orders` · `public.customers` · `public.visits` · `customer_register` · `track_order`.

## 5) خطة التنظيف (نُفِّذت كما هي — انظر §6)
**الشروط قبل التنفيذ:** (1) موافقة صريحة منك على `alyssum-beta` وحدها. (2) أن تكون الأعداد في §2 لم تتغير (فحص 5.1). (3) تشغيل الاختبار الحقيقي قبل وبعد.

**5.1 فحص مسبق (يجب أن يعيد كله 0):**
```sql
select (select count(*) from public.ruqya_blocks) + (select count(*) from public.ruqya_bookings)
     + (select count(*) from public.ruqya_portal_accounts) + (select count(*) from public.ruqya_portal_links)
     + (select count(*) from public.ruqya_visits) + (select count(*) from public.ruqya_warnings) as ruqya_rows,
       (select count(*) from public.admin_kv where key ilike '%ruqya%') as kv_rows,
       (select count(*) from public.rate_hits where kind ilike 'ruqya%') as rate_rows;
```

**5.2 التنفيذ في طلب واحد (معاملة ضمنية واحدة؛ أي خطأ يلغيها كلها، ودون CASCADE عمداً حتى يفشل الحذف عند أي تبعية غير متوقعة):**
```sql
drop function if exists public.ruqya_book(jsonb);
drop function if exists public.ruqya_config();
drop function if exists public.ruqya_lookup(text);
drop function if exists public.ruqya_mark_noshow(bigint);
drop function if exists public.ruqya_portal_claim(text);
drop function if exists public.ruqya_portal_invite(bigint);
drop function if exists public.ruqya_portal_me();
drop function if exists public.ruqya_portal_unlink(bigint);
drop function if exists public.ruqya_taken(date);
drop function if exists public._rq_price(text, integer);
drop function if exists public._ruqya_norm(text);
drop function if exists public._ruqya_slots();
drop table public.ruqya_portal_accounts, public.ruqya_portal_links, public.ruqya_visits, public.ruqya_warnings;
drop table public.ruqya_blocks;
drop table public.ruqya_bookings;
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname ilike '%ruqya%' or p.proname = '_rq_price'))
     or exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname ilike '%ruqya%')
  then raise exception 'ruqya_cleanup_incomplete'; end if;
end $$;
```
(ترتيب الحذف: الدوال أولاً لأنها لا تُتتبَّع كتبعيات للجداول، ثم الجداول الفرعية، ثم `ruqya_blocks`، ثم `ruqya_bookings` الذي تشير إليه المفاتيح الأجنبية.)

**التحقق من الخطة:** جُرِّبت 5.1 و5.2 على PostgreSQL 16 محلي معزول بنسخة **هيكلية** من الكائنات (الجداول والمفاتيح الأجنبية بما فيها `auth.users`، والدوال بتواقيعها، مع `_rl_hit` و`is_admin` و`rate_hits` و`admin_kv`): نجحت، وبقيت المشتركات، ولم يبق أي أثر للرقية. **لم تُجرَّب على `alyssum-beta`.** عند الاعتماد تُشغَّل أولاً داخل معاملة تنتهي بـ`rollback` للتأكد من خلوّها من أخطاء على القاعدة الفعلية.

**5.3 فحوص بعد التنفيذ:** (أ) إعادة جرد §2 ⇒ صفر كائنات. (ب) `beta-supabase.integration.mjs --require` على الأقل مجموعة Core. (ج) قياس `get_advisors`/RLS بأن كل جداول `public` ما زالت بـRLS مفعّل.

**5.4 التراجع:** لا بيانات تُفقد (0 صفوف). لإعادة الكائنات: تطبيق `platform/supabase/ruqya.sql` ثم كتلة `RUQYA` من `hardening-v01b.sql` من Git — غير مطلوب لـBeta المنصة.

**5.5 المخاطر:** منخفضة جداً. الأخطر هو حذف `_rl_hit` أو `is_admin` بالخطأ؛ وهما خارج القائمة صراحةً (§4).

## 6) سجل التنفيذ (2026-11-17، `alyssum-beta` وحدها)
الأداة: `scripts/supabase-beta-ruqya-cleanup.mjs` (حراسات: المرجع ≠ Production ويطابق المسجَّل و`--confirm-ref`، واسم المشروع = `alyssum-beta`؛ بلا CASCADE). المراحل:
1. **نسخة احتياطية** `/home/user/beta-backups/ruqya-20261117/` (`inventory.json` بصمة الكتالوج الكاملة · `restore.sql` · `data.json` · `snapshot-before.json` · `SHA256SUMS`). بصمة الحالة: `fb2953fed5ed3525…`.
2. **التحقق من الاستعادة:** طُبِّق `restore.sql` على PostgreSQL 16 محلي معزول بتبعيات هيكلية، وقورنت بصمة الكتالوج بالأصل: **0 فروق** (6 جداول، 12 دالة، كل الأعمدة والقيود والفهارس والسياسات والصلاحيات وتعريفات الدوال).
3. **الفحص المسبق (P1–P7) كله ناجح:** الجداول والدوال = القائمة الدقيقة · 0 صفوف · 0 صفوف رقية في `admin_kv`/`rate_hits` · **0 تبعيات خارجية في `pg_depend`** (بعد استثناء جداول TOAST الداخلية) · 0 مفاتيح أجنبية واردة/سياسات/مشغّلات/views/publications/دوال تشير إليها · الكائنات المشتركة موجودة.
4. **تجربة مُرجَعة** داخل معاملة تنتهي بخطأ مقصود: الخطة كاملة نجحت، وبصمة القاعدة بعدها = قبلها.
5. **التنفيذ** في طلب واحد (معاملة ضمنية): نجح؛ فحوص A1–A5: المحذوف = الجداول الستة والدوال الاثنتا عشرة والسياسات الست بالضبط، ولا شيء مضاف، وجداول `public` بلا RLS = 0.

**القائمة الدقيقة المحذوفة** — جداول (6): `ruqya_blocks` · `ruqya_bookings` · `ruqya_portal_accounts` · `ruqya_portal_links` · `ruqya_visits` · `ruqya_warnings`. دوال (12): `_rq_price(k text, d integer)` · `_ruqya_norm(t text)` · `_ruqya_slots()` · `ruqya_book(p jsonb)` · `ruqya_config()` · `ruqya_lookup(p_q text)` · `ruqya_mark_noshow(p_booking_id bigint)` · `ruqya_portal_claim(p_token text)` · `ruqya_portal_invite(p_booking_id bigint)` · `ruqya_portal_me()` · `ruqya_portal_unlink(p_booking_id bigint)` · `ruqya_taken(p_day date)`. (الفهارس الـ12 والتسلسلات الأربعة تُحذف مع جداولها.)

**قبل/بعد:** جداول `public` 41 ← 35 · دوال 121 ← 109 · سياسات 37 ← 31 · جداول بلا RLS 0 ← 0.
**المشترك باقٍ:** `_rl_hit` · `is_admin` · `_ip_hash` · `_client_ip` · `customer_register` · `track_order` · `submit_order` · `rate_hits` · `admin_kv` · `orders` · `customers` · `visits` · `admins` · `staff`.
**بعد التنفيذ (اختبار حقيقي من الفرع نفسه):** Core **31/31** · Store **14/14**؛ بقايا: طلبات 0، كائنات Storage 0، منح رفع 0.

## 7) الاستعادة (إن لزمت)
```bash
# على قاعدة Beta الخالية من الرقية (تتطلب auth.users وis_admin() والأدوار الثلاثة):
psql "$BETA_DB_URL" -v ON_ERROR_STOP=1 -f /home/user/beta-backups/ruqya-20261117/restore.sql
```
لا بيانات تُفقد (كل الجداول كانت بلا صفوف). الأداة نفسها: `--backup` ثم `--dry-run` ثم `--apply`، ويرفض `--apply` أي نسخة احتياطية لا تطابق بصمة الحالة الحالية.
