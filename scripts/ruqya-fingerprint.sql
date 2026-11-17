-- بصمة كتالوج كائنات الرقية (وظيفة موقع ALYSSUM) في قاعدة Supabase: جداولها (أعمدة/قيود/فهارس/سياسات/صلاحيات) ودوالها (التعريف الكامل والصلاحيات).
-- تُستعمل: (1) لإنشاء النسخة الاحتياطية وملف الاستعادة (2) لإثبات أن الاستعادة المحلية تعيد الكائنات نفسها حرفياً. صف واحد بعمود jsonb اسمه fp. قراءة فقط.
select jsonb_build_object(
 'tables', (select coalesce(jsonb_agg(jsonb_build_object(
    'name', c.relname, 'rls', c.relrowsecurity, 'rls_forced', c.relforcerowsecurity,
    'columns', (select jsonb_agg(jsonb_build_object('n', a.attname, 't', format_type(a.atttypid, a.atttypmod), 'nn', a.attnotnull, 'd', pg_get_expr(d.adbin, d.adrelid), 'id', a.attidentity::text) order by a.attnum)
                  from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped),
    'constraints', (select coalesce(jsonb_agg(jsonb_build_object('n', k.conname, 'type', k.contype::text, 'def', pg_get_constraintdef(k.oid)) order by k.conname), '[]'::jsonb) from pg_constraint k where k.conrelid = c.oid),
    'indexes', (select coalesce(jsonb_agg(jsonb_build_object('n', i.indexname, 'def', i.indexdef) order by i.indexname), '[]'::jsonb) from pg_indexes i where i.schemaname = 'public' and i.tablename = c.relname),
    'policies', (select coalesce(jsonb_agg(jsonb_build_object('n', p.policyname, 'cmd', p.cmd, 'perm', p.permissive, 'roles', p.roles::text, 'q', p.qual, 'wc', p.with_check) order by p.policyname), '[]'::jsonb) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname),
    'grants', (select coalesce(jsonb_agg(jsonb_build_object('g', g.grantee, 'p', g.privilege_type) order by g.grantee, g.privilege_type), '[]'::jsonb) from information_schema.role_table_grants g where g.table_schema = 'public' and g.table_name = c.relname and g.grantee in ('anon', 'authenticated', 'service_role'))
  ) order by c.relname), '[]'::jsonb)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname ilike '%ruqya%'),
 'functions', (select coalesce(jsonb_agg(jsonb_build_object(
    'sig', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', 'def', pg_get_functiondef(p.oid), 'secdef', p.prosecdef,
    'anon', has_function_privilege('anon', p.oid, 'execute'), 'auth', has_function_privilege('authenticated', p.oid, 'execute'), 'svc', has_function_privilege('service_role', p.oid, 'execute')
  ) order by p.proname, pg_get_function_identity_arguments(p.oid)), '[]'::jsonb)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname ilike '%ruqya%' or p.proname = '_rq_price'))
) as fp;
