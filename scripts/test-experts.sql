-- اختبار شبكة الخبراء على Postgres حقيقي (أدوار anon/authenticated). التشغيل: bash scripts/test-experts.sh
\set ON_ERROR_STOP 1
create table public._t (n serial, name text, ok boolean, info text);
grant all on public._t to anon, authenticated; grant usage on all sequences in schema public to anon, authenticated;
create function public.chk(name text, cond boolean, info text default '') returns void language sql as $$ insert into public._t (name, ok, info) values (name, coalesce(cond, false), info) $$;
-- ينفّذ استعلاماً بصلاحية الدور الحالي ويتوقع خطأً يحوي النص
create function public.err(q text) returns text language plpgsql as $$ begin execute q; return ''; exception when others then return sqlerrm; end $$;
grant execute on function public.chk(text, boolean, text), public.err(text) to anon, authenticated;
create function public.jwt_as(e text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claims', json_build_object('email', e)::text, false); end $$;
grant execute on function public.jwt_as(text) to anon, authenticated;

insert into public.saas_admins (email, name) values ('boss@x.com', 'boss');
insert into public.saas_sites (name, origin, status) values ('Boutique A', 'https://shop-a.dz', 'active'), ('Boutique B', 'https://shop-b.dz', 'active'), ('Gone', 'https://gone.dz', 'deleted');

create temp table r1 (j jsonb); create temp table r2 (j jsonb); create temp table r3 (j jsonb); create temp table rk (k jsonb); grant all on r1, r2, r3, rk to public;
set role anon;
select public.chk('الفئات الخمس مبذورة', jsonb_array_length(public.experts_categories()) = 5 and (select count(*) from jsonb_array_elements(public.experts_categories()) c where c ->> 'slug' in ('branding_packaging','media_buyers','confirmatrices','livreurs','ugc_creators')) = 5);
select public.chk('الجداول مغلقة أمام anon', public.err('select * from public.experts_profiles') like '%permission denied%' and public.err('select * from public.expert_reviews') like '%permission denied%' and public.err('select * from public.expert_categories') like '%permission denied%');
select public.chk('دوال المدير مغلقة أمام anon', public.err($$select public.experts_admin_status('{"id":"00000000-0000-0000-0000-000000000000","status":"approved"}')$$) like '%permission denied%');

-- تسجيل
insert into r1 select public.expert_register(jsonb_build_object('name', 'Sara <b>Design</b>', 'headline', 'مصممة هوية وتغليف', 'bio', 'خبرة 5 سنوات', 'cat', 'branding_packaging', 'whatsapp', '0555 12 34 56', 'wilaya', 16, 'city', 'Alger', 'rate_type', 'per_task', 'rate_from', 8000, 'rate_to', 30000, 'langs', jsonb_build_array('ar', 'fr', 'xx'), 'consent', 'true',
  'socials', jsonb_build_object('instagram', 'https://instagram.com/sara', 'tiktok', 'javascript:alert(1)', 'evil', 'https://x.com', 'facebook', 'http://insecure.com'),
  'portfolio', jsonb_build_array(jsonb_build_object('t', 'img', 'd', 'data:image/webp;base64,AAAA', 'title', 'شعار'), jsonb_build_object('t', 'img', 'd', 'data:text/html;base64,AAAA'), jsonb_build_object('t', 'link', 'u', 'https://behance.net/sara', 'title', 'Behance'), jsonb_build_object('t', 'link', 'u', 'javascript:alert(1)'), jsonb_build_object('t', 'link', 'u', 'http://x.com')))) as j;
select public.chk('التسجيل يعيد id ومفتاحاً مرة واحدة وحالة pending', (select (j ->> 'status') = 'pending' and char_length(j ->> 'key') = 64 and (j ->> 'id') is not null from r1));
set role postgres;
select public.chk('واتساب يُوحَّد 213…، والاسم بلا وسوم، واللغات المسموحة فقط', (select whatsapp = '213555123456' and display_name = 'Sara bDesign/b' and languages = array['ar','fr'] from public.experts_profiles), (select display_name || '|' || whatsapp || '|' || languages::text from public.experts_profiles));
select public.chk('الشبكات https فقط والمفاتيح المسموحة فقط', (select socials = '{"instagram":"https://instagram.com/sara"}'::jsonb from public.experts_profiles));
select public.chk('المعرض: صورة صالحة ورابط https فقط', (select jsonb_array_length(portfolio) = 2 and portfolio -> 0 ->> 't' = 'img' and portfolio -> 1 ->> 't' = 'link' from public.experts_profiles));
select public.chk('المفتاح مجزّأ لا نصاً', (select key_hash = encode(sha256(convert_to((select j ->> 'key' from r1), 'utf8')), 'hex') and key_hash <> (select j ->> 'key' from r1) from public.experts_profiles));

set role anon;
select public.chk('بلا موافقة يُرفض', public.err($$select public.expert_register('{"name":"Ali","headline":"media buyer","cat":"media_buyers","whatsapp":"0661000000"}')$$) like '%consent_required%');
select public.chk('رقم واتساب مكرر يُرفض', public.err($$select public.expert_register('{"name":"Sara2","headline":"headline x","cat":"media_buyers","whatsapp":"+213555123456","consent":"true"}')$$) like '%already_registered%');
select public.chk('فئة خاطئة ورقم خاطئ يُرفضان', public.err($$select public.expert_register('{"name":"Ali","headline":"media buyer","cat":"zzz","whatsapp":"0661000000","consent":"true"}')$$) like '%bad_category%' and public.err($$select public.expert_register('{"name":"Ali","headline":"media buyer","cat":"media_buyers","whatsapp":"12","consent":"true"}')$$) like '%bad_whatsapp%');
select public.chk('تعرفة معكوسة تُرفض', public.err($$select public.expert_register('{"name":"Ali","headline":"media buyer","cat":"media_buyers","whatsapp":"0661000001","rate_from":500,"rate_to":100,"consent":"true"}')$$) like '%bad_rate%');
select public.chk('قبل الاعتماد: لا ظهور في البحث ولا في الملف', (public.experts_search('{}') ->> 'total')::int = 0 and public.err(format($$select public.expert_get('{"id":"%s"}')$$, (select j ->> 'id' from r1))) like '%not_found%');
select public.chk('المستقل يرى ملفه بمفتاحه وبرقمه', (select (public.expert_me(jsonb_build_object('id', j ->> 'id', 'key', j ->> 'key')) ->> 'whatsapp') = '213555123456' from r1));
select public.chk('مفتاح خاطئ يُرفض', public.err(format($$select public.expert_me('{"id":"%s","key":"bad"}')$$, (select j ->> 'id' from r1))) like '%bad_key%');

-- المدير يعتمد
set role authenticated; select public.jwt_as('other@x.com');
select public.chk('غير المدير لا يعتمد', public.err(format($$select public.experts_admin_status('{"id":"%s","status":"approved"}')$$, (select j ->> 'id' from r1))) like '%unauthorized%');
select public.jwt_as('boss@x.com');
select public.chk('المدير يعتمد', (public.experts_admin_status(jsonb_build_object('id', (select j ->> 'id' from r1), 'status', 'approved', 'note', 'ok')) ->> 'ok') = 'true');
-- مستقلان إضافيان
set role anon;
insert into r2 select public.expert_register('{"name":"Karim Ads","headline":"Media buyer Facebook/TikTok","bio":"campagnes COD","cat":"media_buyers","whatsapp":"0661000002","wilaya":31,"rate_type":"monthly","rate_from":50000,"consent":"true","remote":"false"}'::jsonb) as j;
insert into r3 select public.expert_register('{"name":"Lina UGC","headline":"Créatrice UGC","cat":"ugc_creators","whatsapp":"0770000003","rate_type":"per_task","rate_from":3000,"consent":"true"}'::jsonb) as j;
set role authenticated; select public.jwt_as('boss@x.com');
select public.experts_admin_status(jsonb_build_object('id', j ->> 'id', 'status', 'approved')) from r2;
select public.experts_admin_status(jsonb_build_object('id', j ->> 'id', 'status', 'approved')) from r3;

set role anon;
select public.chk('البحث يعيد المعتمدين الثلاثة', (public.experts_search('{}') ->> 'total')::int = 3);
select public.chk('تصفية بالفئة', (public.experts_search('{"cat":"media_buyers"}') ->> 'total')::int = 1 and public.experts_search('{"cat":"media_buyers"}') -> 'items' -> 0 ->> 'name' = 'Karim Ads');
select public.chk('بحث نصي (اسم/نبذة) يتجاهل حالة الأحرف', (public.experts_search('{"q":"cod"}') ->> 'total')::int = 1 and (public.experts_search('{"q":"SARA"}') ->> 'total')::int = 1);
select public.chk('رمزا % و _ لا يعملان كشرطين عامين', (public.experts_search('{"q":"%"}') ->> 'total')::int = 0 and (public.experts_search('{"q":"_"}') ->> 'total')::int = 0);
select public.chk('الولاية: من هو في ولايتي أو عن بُعد', (public.experts_search('{"wilaya":16}') ->> 'total')::int = 2 and (public.experts_search('{"wilaya":31}') ->> 'total')::int = 3);
select public.chk('الأقرب أولاً: عند اختيار ولاية يتقدّم أهلها على «عن بُعد»', public.experts_search('{"wilaya":31}') -> 'items' -> 0 ->> 'name' = 'Karim Ads' and public.experts_search('{"wilaya":16}') -> 'items' -> 0 ->> 'name' like 'Sara%');
select public.chk('سقف السعر (من)', (public.experts_search('{"max_rate":10000}') ->> 'total')::int = 2);
select public.chk('عن بُعد فقط', (public.experts_search('{"remote":true}') ->> 'total')::int = 2);
select public.chk('الترتيب بالسعر تصاعدياً', public.experts_search('{"sort":"price_asc"}') -> 'items' -> 0 ->> 'name' = 'Lina UGC' and public.experts_search('{"sort":"price_desc"}') -> 'items' -> 0 ->> 'name' = 'Karim Ads');
select public.chk('الترقيم', jsonb_array_length(public.experts_search('{"per":2}') -> 'items') = 2 and jsonb_array_length(public.experts_search('{"per":2,"page":2}') -> 'items') = 1);
select public.chk('لا واتساب ولا مفتاح في البحث ولا في الملف العلني', public.experts_search('{}')::text !~ '2135551|213661|key_hash|whatsapp' and public.expert_get(jsonb_build_object('id', (select j ->> 'id' from r1)))::text !~ '213555123456|key_hash|whatsapp');
select public.chk('الملف العلني فيه المعرض والشبكات', (public.expert_get(jsonb_build_object('id', (select j ->> 'id' from r1))) -> 'portfolio') is not null and (public.expert_get(jsonb_build_object('id', (select j ->> 'id' from r1))) -> 'socials' ->> 'instagram') = 'https://instagram.com/sara');

-- التواصل
select public.chk('التواصل من أصل مجهول أو محذوف يُرفض', public.err(format($$select public.expert_contact('{"id":"%s","origin":"https://unknown.dz"}')$$, (select j ->> 'id' from r1))) like '%unknown_site%' and public.err(format($$select public.expert_contact('{"id":"%s","origin":"https://gone.dz"}')$$, (select j ->> 'id' from r1))) like '%unknown_site%' and public.err(format($$select public.expert_contact('{"id":"%s"}')$$, (select j ->> 'id' from r1))) like '%unknown_site%');
select public.chk('التواصل من موقع مسجَّل يعطي واتساب', (select (public.expert_contact(jsonb_build_object('id', j ->> 'id', 'origin', 'https://shop-a.dz/admin')) ->> 'wa') = '213555123456' from r1));
select public.expert_contact(jsonb_build_object('id', j ->> 'id', 'origin', 'https://shop-a.dz')) from r1;
set role postgres;
select public.chk('النقرات المتقاربة تُحسب مرة (ساعة) والعدّاد 1', (select count(*) = 1 from public.expert_contacts) and (select contacts_count = 1 from public.experts_profiles where whatsapp = '213555123456'));
set role anon;

-- التقييم
select public.chk('تقييم قبل تواصل يُرفض', public.err(format($$select public.expert_review('{"id":"%s","origin":"https://shop-b.dz","stars":5}')$$, (select j ->> 'id' from r1))) like '%not_contacted%');
select public.chk('تقييم قبل 48 ساعة يُرفض', public.err(format($$select public.expert_review('{"id":"%s","origin":"https://shop-a.dz","stars":5}')$$, (select j ->> 'id' from r1))) like '%too_early%');
set role postgres; update public.expert_contacts set at = now() - interval '49 hours'; set role anon;
select public.chk('نجوم خارج 1..5 تُرفض', public.err(format($$select public.expert_review('{"id":"%s","origin":"https://shop-a.dz","stars":6}')$$, (select j ->> 'id' from r1))) like '%bad_stars%');
select public.chk('تقييم بعد 48 ساعة ينجح والمتوسط يُحسب', (select (public.expert_review(jsonb_build_object('id', j ->> 'id', 'origin', 'https://shop-a.dz', 'stars', 5, 'comment', 'ممتازة <script>')) ->> 'count')::int = 1 from r1));
select public.expert_review(jsonb_build_object('id', j ->> 'id', 'origin', 'https://shop-a.dz', 'stars', 3, 'comment', 'تعديل')) from r1;
set role postgres;
select public.chk('التقييم يُعدَّل ولا يتكرر', (select rating_count = 1 and rating_avg = 3 from public.experts_profiles e where e.whatsapp = '213555123456'));
set role anon;
-- موقع ثانٍ
select public.expert_contact(jsonb_build_object('id', j ->> 'id', 'origin', 'https://shop-b.dz')) from r1;
set role postgres; update public.expert_contacts set at = now() - interval '50 hours' where site_id = (select id from public.saas_sites where origin = 'https://shop-b.dz'); set role anon;
select public.expert_review(jsonb_build_object('id', j ->> 'id', 'origin', 'https://shop-b.dz', 'stars', 5)) from r1;
set role postgres;
select public.chk('المتوسط (3+5)/2=4 والعدد 2', (select rating_avg = 4 and rating_count = 2 from public.experts_profiles e where e.whatsapp = '213555123456'));
set role anon;
select public.chk('التقييم يظهر في الملف باسم الموقع بلا وسوم', (select (public.expert_get(jsonb_build_object('id', j ->> 'id')) -> 'reviews') ->> 0 like '%Boutique%' and (public.expert_get(jsonb_build_object('id', j ->> 'id'))::text !~ '<script') from r1));
select public.chk('ترتيب التقييم: الأعلى أولاً', public.experts_search('{"sort":"rating"}') -> 'items' -> 0 ->> 'name' like 'Sara%' and (public.experts_search('{"min_rating":4}') ->> 'total')::int = 1);
-- إبلاغ
select public.chk('الإبلاغ يُسجَّل', (select (public.expert_report(jsonb_build_object('id', j ->> 'id', 'origin', 'https://shop-a.dz', 'reason', 'محتوى مضلل')) ->> 'ok') = 'true' from r1));

-- المدير: إخفاء تقييم
set role authenticated; select public.jwt_as('boss@x.com');
select public.experts_admin_review(jsonb_build_object('id', (select id::text from public.expert_reviews where stars = 3 limit 1), 'status', 'hidden'));
select public.chk('إخفاء تقييم يعيد المتوسط (يبقى 5 × 1)', (select rating_avg = 5 and rating_count = 1 from public.experts_profiles where whatsapp = '213555123456'));
select public.chk('المدير يقرأ الجداول مباشرة', (select count(*) from public.experts_profiles) = 3 and (select count(*) from public.expert_reports) = 1);

-- تعديل المستقل
set role anon;
select public.chk('تعديل بمفتاح خاطئ يُرفض', public.err(format($$select public.expert_update('{"id":"%s","key":"x","name":"Sara","headline":"abcd","cat":"branding_packaging","whatsapp":"0555123456"}')$$, (select j ->> 'id' from r1))) like '%bad_key%');
select public.chk('تعديل تعرفة فقط لا يعيد المراجعة', (select (public.expert_update(jsonb_build_object('id', j ->> 'id', 'key', j ->> 'key', 'name', 'Sara <b>Design</b>', 'headline', 'مصممة هوية وتغليف', 'bio', 'خبرة 5 سنوات', 'cat', 'branding_packaging', 'whatsapp', '0555123456', 'rate_type', 'hourly', 'rate_from', 2000,
   'portfolio', (select portfolio from (select public.expert_me(jsonb_build_object('id', j ->> 'id', 'key', j ->> 'key')) -> 'portfolio' as portfolio) z), 'socials', jsonb_build_object('instagram', 'https://instagram.com/sara'), 'langs', jsonb_build_array('ar','fr'))) ->> 'status') = 'approved' from r1));
create temp table u1 (r jsonb); grant all on u1 to public;
insert into u1 select public.expert_update(jsonb_build_object('id', j ->> 'id', 'key', j ->> 'key', 'name', 'Sara Design', 'headline', 'مصممة هوية وتغليف', 'bio', 'نبذة جديدة', 'cat', 'branding_packaging', 'whatsapp', '0555123456')) from r1;
select public.chk('تغيير النبذة يعيد الملف إلى pending فيختفي من البحث', (select r ->> 'status' = 'pending' and (r ->> 'reviewed_again')::boolean from u1) and (public.experts_search('{"cat":"branding_packaging"}') ->> 'total')::int = 0);
select public.chk('رقم واتساب يخصّ آخر يُرفض عند التعديل', public.err(format($$select public.expert_update('{"id":"%s","key":"%s","name":"Sara Design","headline":"abcd","cat":"branding_packaging","whatsapp":"0661000002"}')$$, (select j ->> 'id' from r1), (select j ->> 'key' from r1))) like '%already_registered%');
select public.chk('إيقاف الملف لا يجوز وهو قيد المراجعة', public.err(format($$select public.expert_pause('{"id":"%s","key":"%s"}')$$, (select j ->> 'id' from r1), (select j ->> 'key' from r1))) like '%locked%');
-- إعادة المفتاح
set role authenticated; select public.jwt_as('boss@x.com');
insert into rk select public.experts_admin_reset_key(jsonb_build_object('id', j ->> 'id')) as k from r1;
select public.experts_admin_status(jsonb_build_object('id', j ->> 'id', 'status', 'approved')) from r1;
set role anon;
select public.chk('المفتاح الجديد يعمل والقديم لا يعمل', (select (public.expert_me(jsonb_build_object('id', r1.j ->> 'id', 'key', rk.k ->> 'key')) ->> 'status') = 'approved' from r1, rk) and public.err(format($$select public.expert_me('{"id":"%s","key":"%s"}')$$, (select j ->> 'id' from r1), (select j ->> 'key' from r1))) like '%bad_key%');
-- شارة «موثّق»
select public.chk('الافتراضي غير موثّق ولا مرشّح موثّقين بلا توثيق', (public.experts_search('{"verified":true}') ->> 'total')::int = 0 and (public.experts_search('{}') -> 'items' -> 0 ->> 'verified') = 'false');
select public.chk('المستقل لا يوثّق نفسه ولا anon', public.err($$select public.experts_admin_verify('{"id":"00000000-0000-0000-0000-000000000000"}')$$) like '%permission denied%');
set role authenticated; select public.jwt_as('other@x.com');
select public.chk('غير المدير لا يوثّق', public.err($$select public.experts_admin_verify('{"id":"00000000-0000-0000-0000-000000000000"}')$$) like '%unauthorized%');
select public.jwt_as('boss@x.com');
select public.experts_admin_verify(jsonb_build_object('id', j ->> 'id', 'verified', 'true')) from r1;
set role anon;
select public.chk('التوثيق يظهر في البحث ويصلح مرشّحاً', (public.experts_search('{"verified":true}') ->> 'total')::int = 1 and (public.experts_search('{"verified":true}') -> 'items' -> 0 ->> 'verified') = 'true');
create temp table u2 (a jsonb, b jsonb, n1 int); grant all on u2 to public;
insert into u2 (a) select public.expert_pause(jsonb_build_object('id', r1.j ->> 'id', 'key', rk.k ->> 'key', 'paused', 'true')) from r1, rk;
update u2 set n1 = (public.experts_search('{}') ->> 'total')::int;
update u2 set b = (select public.expert_pause(jsonb_build_object('id', r1.j ->> 'id', 'key', rk.k ->> 'key', 'paused', 'false')) from r1, rk);
select public.chk('إيقاف واستئناف بيد المستقل', (select a ->> 'status' = 'paused' and n1 = 2 and b ->> 'status' = 'approved' from u2));
-- حذف
select public.chk('المحو الكامل يحذف الملف والتقييمات والتواصل', (select (public.expert_delete(jsonb_build_object('id', r1.j ->> 'id', 'key', rk.k ->> 'key')) ->> 'ok') = 'true' from r1, rk));
set role postgres;
select public.chk('لا بقايا بعد الحذف', (select count(*) = 0 from public.expert_reviews) and (select count(*) = 0 from public.expert_contacts where expert_id = (select (j ->> 'id')::uuid from r1)) and (select count(*) = 0 from public.expert_reports));
select n, case when ok then 'PASS' else 'FAIL' end as r, name, info from public._t order by n;
