-- اختبار RLS وقواعد صندوق الرسائل الخاص (owner-inbox.sql) على قاعدة Postgres محلية معزولة (لا الإنتاج).
-- يُشغَّله scripts/test-owner-inbox-rls.sh بعد تجهيز بيئة Supabase الشبيهة (مخطط auth وأدوار anon/authenticated وجدول admins ودوال is_admin الحقيقية من roles.sql).
-- كل سطر نتيجة: PASS|FAIL <وصف>
create schema t;
create table t.res (n serial, ok boolean, name text, got text);
-- ينفّذ استعلاماً بدور وادّعاءات JWT محدّدة ويُرجع نتيجته نصاً أو ERR:<الخطأ>
create function t.q(p_role text, p_claims text, p_sql text) returns text language plpgsql as $$
declare res text;
begin
  perform set_config('request.jwt.claims', p_claims, true);
  execute 'set local role ' || quote_ident(p_role);
  begin execute p_sql into res; exception when others then res := 'ERR:' || sqlerrm; end;
  execute 'reset role';
  return res;
end $$;
create function t.ok(p_name text, p_cond boolean, p_got text default null) returns void language sql as $$ insert into t.res (ok, name, got) values (coalesce(p_cond, false), p_name, p_got) $$;

do $T$
declare
  owner_c text := json_build_object('sub', gen_random_uuid(), 'email', 'owner@test.local', 'role', 'authenticated', 'aal', 'aal2')::text;
  owner1 text := json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'email', 'owner@test.local', 'role', 'authenticated', 'aal', 'aal1')::text;
  staff_c text := json_build_object('sub', gen_random_uuid(), 'email', 'staff@test.local', 'role', 'authenticated', 'aal', 'aal2')::text;
  cust_c  text := json_build_object('sub', gen_random_uuid(), 'email', 'merchant@test.local', 'role', 'authenticated', 'aal', 'aal1')::text;
  anon_c  text := '{"role":"anon"}';
  rows jsonb; rep jsonb; x text; id1 text; id2 text; id3 text;
begin
  insert into public.admins (email) values ('owner@test.local');
  insert into auth.mfa_factors (user_id, status) values ('11111111-1111-1111-1111-111111111111', 'verified');

  rows := '[
    {"ref":"d1","company":"Delta Corp","contact":"Sam Rivers","phone":"+213 550 123 456","country":"Algeria","language":"English","kind":"First Contact","subject":"Intro","body":"Hello Sam, first message.","priority":3,"prepared_at":"2026-11-25T09:00:00Z","campaign":"Spring EU"},
    {"ref":"d2","parent_ref":"d1","company":"Delta Corp","contact":"Sam Rivers","phone":"00213550123456","language":"en","kind":"follow-up","body":"Hello Sam, follow-up.","campaign":"Spring EU"},
    {"ref":"g1","company":"Gamma SARL","contact":"Léa Martin","phone":"+33612345678","country":"France","language":"fr","kind":"first_contact","body":"Bonjour Léa, premier message."},
    {"ref":"g2","company":"Gamma SARL","contact":"Léa Martin","phone":"+33612345678","language":"fr","kind":"follow_up","body":"Bonjour Léa, relance."},
    {"ref":"g1b","company":"Gamma SARL","phone":"+33612345678","language":"fr","kind":"first_contact","body":"  Bonjour   Léa,  premier message. "},
    {"company":"Bad","phone":"12345","language":"en","body":"no valid phone"},
    {"company":"Bad2","phone":"+213550999999","language":"de","body":"bad lang"},
    {"company":"","contact":"","phone":"+213550888888","language":"en","body":"no one"},
    {"company":"Empty","phone":"+213550777777","language":"en","body":"   "},
    {"company":"BadDate","phone":"+213550666666","language":"en","body":"x","prepared_at":"not-a-date"}
  ]'::jsonb;

  -- 1) anon: لا قراءة ولا كتابة ولا استيراد
  perform t.ok('anon لا يقرأ الجدول', t.q('anon', anon_c, 'select count(*)::text from public.owner_inbox') like 'ERR:%permission denied%', t.q('anon', anon_c, 'select count(*)::text from public.owner_inbox'));
  perform t.ok('anon لا يستورد', t.q('anon', anon_c, format('select public.owner_inbox_import(%L, %L)::text', 'x', rows::text)) like 'ERR:%permission denied%');
  perform t.ok('anon لا يقرأ السجل', t.q('anon', anon_c, 'select count(*)::text from public.owner_inbox_log') like 'ERR:%permission denied%');

  -- 2) غير المالك (موظف/تاجر/عميل مسجَّل): الاستيراد مرفوض خادمياً
  perform t.ok('موظف مسجَّل لا يستورد (unauthorized)', t.q('authenticated', staff_c, format('select public.owner_inbox_import(%L, %L)::text', 'x', rows::text)) like 'ERR:unauthorized%', t.q('authenticated', staff_c, format('select public.owner_inbox_import(%L, %L)::text', 'x', rows::text)));
  perform t.ok('تاجر/عميل مسجَّل لا يستورد', t.q('authenticated', cust_c, format('select public.owner_inbox_import(%L, %L)::text', 'x', rows::text)) like 'ERR:unauthorized%');
  perform t.ok('مالك بلا مصادقة ثنائية (aal1 مع عامل موثَّق) لا يستورد', t.q('authenticated', owner1, format('select public.owner_inbox_import(%L, %L)::text', 'x', rows::text)) like 'ERR:unauthorized%');
  perform t.ok('الجدول فارغ بعد المحاولات المرفوضة', (select count(*) from public.owner_inbox) = 0);

  -- 3) المالك: استيراد دفعة وتقريرها
  rep := t.q('authenticated', owner_c, format('select public.owner_inbox_import(%L, %L)::text', 'batch-1', rows::text))::jsonb;
  perform t.ok('تقرير الاستيراد: 10 صفوف، 4 جديدة، مكرَّر 1، غير صالحة 5', (rep ->> 'total') = '10' and (rep ->> 'inserted') = '4' and (rep ->> 'duplicates') = '1' and (rep ->> 'invalid') = '5', rep::text);
  perform t.ok('جهتان جديدتان وبلا جهات موجودة', (rep ->> 'new_contacts') = '2' and (rep ->> 'existing_contacts') = '0', rep::text);
  perform t.ok('أسباب الرفض تُذكر لكل صف غير صالح', jsonb_array_length(rep -> 'errors') = 5 and rep::text like '%invalid_phone%' and rep::text like '%invalid_language%' and rep::text like '%company_or_contact_required%' and rep::text like '%empty_body%', rep::text);
  perform t.ok('الهاتف يُطبَّع إلى أرقام دولية فقط (00213… و+213 …)', (select count(*) from public.owner_inbox where phone = '213550123456') = 2 and (select bool_and(phone ~ '^[1-9][0-9]{7,14}$') from public.owner_inbox));
  perform t.ok('كل الرسائل تدخل بحالة ready مع تاريخ الإعداد من الدفعة', (select bool_and(status = 'ready') from public.owner_inbox) and (select prepared_at from public.owner_inbox where ref = 'd1') = '2026-11-25T09:00:00Z'::timestamptz);
  perform t.ok('المتابعة d2 مربوطة بأمّها d1 عبر parent_ref، وg2 بآخر أول تواصل للرقم نفسه', (select p.ref from public.owner_inbox o join public.owner_inbox p on p.id = o.parent_id where o.ref = 'd2') = 'd1' and (select p.ref from public.owner_inbox o join public.owner_inbox p on p.id = o.parent_id where o.ref = 'g2') = 'g1');
  -- إعادة الاستيراد نفسه: كله مكرَّر
  rep := t.q('authenticated', owner_c, format('select public.owner_inbox_import(%L, %L)::text', 'batch-1', rows::text))::jsonb;
  perform t.ok('إعادة استيراد الدفعة: لا إدخال جديد (كلها مكرَّرة أو غير صالحة)', (rep ->> 'inserted') = '0' and (rep ->> 'duplicates') = '5' and (rep ->> 'invalid') = '5', rep::text);
  perform t.ok('جهة موجودة مسبقاً تُحسب existing لا new', ((t.q('authenticated', owner_c, format('select public.owner_inbox_import(%L, %L)::text', 'b2', '[{"company":"Delta Corp","phone":"+213550123456","language":"en","body":"A brand new message"}]'))::jsonb) ->> 'existing_contacts') = '1');
  perform t.ok('أكثر من 500 صف مرفوض', t.q('authenticated', owner_c, format('select public.owner_inbox_import(%L, (select jsonb_agg(''{}''::jsonb) from generate_series(1,501)))::text', 'x')) like 'ERR:too_many_rows%');
  perform t.ok('صفوف ليست مصفوفة مرفوضة', t.q('authenticated', owner_c, $q$select public.owner_inbox_import('x', '{"a":1}'::jsonb)::text$q$) like 'ERR:rows_must_be_array%');

  -- 4) RLS على الجدول والسجل
  perform t.ok('المالك يقرأ الرسائل', t.q('authenticated', owner_c, 'select count(*)::text from public.owner_inbox')::int = 5, t.q('authenticated', owner_c, 'select count(*)::text from public.owner_inbox'));
  perform t.ok('الموظف يرى 0 رسالة (RLS)', t.q('authenticated', staff_c, 'select count(*)::text from public.owner_inbox') = '0');
  perform t.ok('التاجر/العميل يرى 0 رسالة', t.q('authenticated', cust_c, 'select count(*)::text from public.owner_inbox') = '0');
  perform t.ok('المالك بلا مصادقة ثنائية يرى 0 رسالة', t.q('authenticated', owner1, 'select count(*)::text from public.owner_inbox') = '0');
  perform t.ok('الموظف لا يقرأ سجل الحالات', t.q('authenticated', staff_c, 'select count(*)::text from public.owner_inbox_log') = '0');
  perform t.ok('الموظف لا يُدرج رسالة مباشرة (RLS)', t.q('authenticated', staff_c, $q$insert into public.owner_inbox (company, phone, language, body) values ('X','213550000001','en','hi') returning id::text$q$) like 'ERR:%row-level security%');
  perform t.ok('الموظف لا يعدّل (0 صفوف)', t.q('authenticated', staff_c, $q$with u as (update public.owner_inbox set notes = 'hack' returning 1) select count(*)::text from u$q$) = '0');
  perform t.ok('الموظف لا يحذف (0 صفوف)', t.q('authenticated', staff_c, $q$with d as (delete from public.owner_inbox returning 1) select count(*)::text from d$q$) = '0');
  perform t.ok('الموظف لا يستدعي مشغِّل الحالة مباشرة', t.q('authenticated', staff_c, 'select public._owner_inbox_guard()::text') like 'ERR:%permission denied%');
  perform t.ok('الجدولان RLS مفعَّلة', (select bool_and(relrowsecurity) from pg_class where relname in ('owner_inbox', 'owner_inbox_log') and relnamespace = 'public'::regnamespace));
  perform t.ok('لا صلاحيات لـanon على الجدولين', not exists (select 1 from information_schema.role_table_grants where grantee = 'anon' and table_name in ('owner_inbox', 'owner_inbox_log')));

  -- 5) قواعد الحالة (يتحقق منها الخادم، لا الواجهة فقط)
  id1 := (select id::text from public.owner_inbox where ref = 'd1'); id2 := (select id::text from public.owner_inbox where ref = 'g1');
  perform t.ok('الإدراج المباشر بحالة sent يُحوَّل إلى ready', t.q('authenticated', owner_c, $q$insert into public.owner_inbox (company, phone, language, body, status, sent_body) values ('Z','213550000002','en','direct','sent','x') returning status$q$) = 'ready');
  perform t.ok('ready → opened يضع opened_at ولا يسجّل إرسالاً', t.q('authenticated', owner_c, format($q$with u as (update public.owner_inbox set status = 'opened' where id = %L returning opened_at, sent_at) select (opened_at is not null and sent_at is null)::text from u$q$, id1)) = 'true');
  perform t.ok('opened → sent بلا نسخة النص المُرسَل مرفوض', t.q('authenticated', owner_c, format($q$update public.owner_inbox set status = 'sent' where id = %L$q$, id1)) like 'ERR:sent_requires_sent_body%');
  perform t.ok('opened → sent مع نسخة المُرسَل مقبول ويضع sent_at', t.q('authenticated', owner_c, format($q$with u as (update public.owner_inbox set status = 'sent', sent_body = 'Hello Sam, first message (edited).' where id = %L returning sent_at, sent_body) select (sent_at is not null and sent_body like '%%edited%%')::text from u$q$, id1)) = 'true');
  perform t.ok('sent لا يعود إلى ready ولا opened', t.q('authenticated', owner_c, format($q$update public.owner_inbox set status = 'ready' where id = %L$q$, id1)) like 'ERR:sent_is_final%' and t.q('authenticated', owner_c, format($q$update public.owner_inbox set status = 'opened' where id = %L$q$, id1)) like 'ERR:sent_is_final%');
  perform t.ok('نص الرسالة لا يُعدَّل بعد الإرسال', t.q('authenticated', owner_c, format($q$update public.owner_inbox set body = 'changed' where id = %L$q$, id1)) like 'ERR:body_locked_after_send%');
  perform t.ok('نسخة المُرسَل وتاريخه لا يُلمسان بلا تغيير حالة', t.q('authenticated', owner_c, format($q$with u as (update public.owner_inbox set sent_body = 'tamper', sent_at = now() - interval '9 days', notes = 'n' where id = %L returning sent_body) select sent_body from u$q$, id1)) = 'Hello Sam, first message (edited).');
  perform t.ok('sent → waiting مسموح', t.q('authenticated', owner_c, format($q$with u as (update public.owner_inbox set status = 'waiting' where id = %L returning 1) select count(*)::text from u$q$, id1)) = '1', t.q('authenticated', owner_c, format($q$select status from public.owner_inbox where id = %L$q$, id1)));
  perform t.ok('waiting → positive مسموح', t.q('authenticated', owner_c, format($q$with u as (update public.owner_inbox set status = 'positive' where id = %L returning 1) select count(*)::text from u$q$, id1)) = '1', t.q('authenticated', owner_c, format($q$select status from public.owner_inbox where id = %L$q$, id1)));
  perform t.ok('رقم الهاتف لا يُعدَّل بعد الإدخال', t.q('authenticated', owner_c, format($q$update public.owner_inbox set phone = '213550000009' where id = %L$q$, id2)) like 'ERR:phone_immutable%');
  perform t.ok('ملغاة لا تُرسَل', t.q('authenticated', owner_c, format($q$with u as (update public.owner_inbox set status = 'cancelled' where id = %L returning 1) select count(*)::text from u$q$, id2)) = '1' and t.q('authenticated', owner_c, format($q$update public.owner_inbox set status = 'sent', sent_body = 'x' where id = %L$q$, id2)) like 'ERR:cancelled_cannot_be_sent%');
  perform t.ok('تعديل نص رسالة جاهزة مسموح', t.q('authenticated', owner_c, format($q$with u as (update public.owner_inbox set body = 'Bonjour (modifié)' where ref = 'g2' returning 1) select count(*)::text from u$q$)) = '1');
  perform t.ok('سجل الحالات يحفظ الانتقالات للمالك فقط', (select count(*) from public.owner_inbox_log where message_id = id1::uuid) = 5 and t.q('authenticated', owner_c, format($q$select count(*)::text from public.owner_inbox_log where message_id = %L$q$, id1)) = '5' and t.q('authenticated', staff_c, 'select count(*)::text from public.owner_inbox_log') = '0', (select string_agg(coalesce(from_status, '-') || '>' || to_status, ',' order by id) from public.owner_inbox_log where message_id = id1::uuid));
  perform t.ok('المالك لا يكتب في سجل الحالات مباشرة', t.q('authenticated', owner_c, format($q$insert into public.owner_inbox_log (message_id, to_status) values (%L, 'sent')$q$, id1)) like 'ERR:%permission denied%');
  x := t.q('authenticated', owner_c, format($q$with d as (delete from public.owner_inbox where id = %L returning 1) select count(*)::text from d$q$, id2));
  perform t.ok('حذف رسالة يحذف سجلها بالتتالي ويفكّ ارتباط متابعتها', x = '1' and (select count(*) from public.owner_inbox_log where message_id = id2::uuid) = 0 and (select parent_id is null from public.owner_inbox where ref = 'g2'), x);
  perform t.ok('إعادة تطبيق الهجرة (idempotent) لا تغيّر الصلاحيات', true);
end $T$;

select case when ok then 'PASS' else 'FAIL' end || ' ' || name || coalesce('   -> ' || left(got, 300), '') from t.res order by n;
select 'SUMMARY ' || count(*) filter (where ok) || '/' || count(*) from t.res;
