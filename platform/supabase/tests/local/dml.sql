\set ON_ERROR_STOP off
-- 1) جداول public بلا RLS ولأحد الدورين صلاحية عليها
select 'NO_RLS_WITH_PRIV' k, c.relname, array_remove(array[case when has_table_privilege('anon', c.oid, 'select,insert,update,delete') then 'anon' end, case when has_table_privilege('authenticated', c.oid, 'select,insert,update,delete') then 'authenticated' end], null) roles
from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and not c.relrowsecurity order by 2;
-- 2) سياسات مفتوحة (using true) للزائر/المسجّل على غير SELECT
select 'OPEN_POLICY' k, tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname='public' and (coalesce(qual,'true') in ('true','(true)')) and cmd <> 'SELECT' order by 2;
select 'OPEN_SELECT_POLICY' k, tablename, policyname, roles from pg_policies where schemaname='public' and cmd in ('SELECT','ALL') and coalesce(qual,'true') in ('true','(true)') order by 2;
-- 3) فحوص كتابة حقيقية على جداول فيها صفوف (تراجع كامل)
begin;
insert into public.customers (phone,name,pass_hash) values ('0559990001','DML-A','x');
insert into public.orders (id,name,phone) values ('DML-ISO-1','DML','0559990001');
create or replace function pg_temp.dml(rl text, claims text, stmt text) returns text language plpgsql as $f$ declare n int; begin execute 'set local role ' || rl; perform set_config('request.jwt.claims', claims, true); execute stmt; get diagnostics n = row_count; reset role; return 'rows=' || n; exception when others then reset role; return 'ERR:' || left(sqlerrm, 50); end $f$;
select r.role, s.stmt, pg_temp.dml(r.role, r.claims, s.stmt) result from (values ('anon', '{"role":"anon"}'), ('authenticated', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000aa","email":"attacker@example.test","aal":"aal1"}')) r(role, claims),
 (values ('delete from public.orders'), ('update public.orders set name=''HACK'''), ('insert into public.orders (id,name,phone) values (''DML-X'',''x'',''0'')'), ('delete from public.customers'), ('update public.customers set name=''HACK'''), ('insert into public.admins (email) values (''attacker@example.test'')'), ('delete from public.admins'), ('update public.admin_kv set v=''x'''), ('insert into public.admin_kv (k,v) values (''evil'',''x'')'), ('delete from public.saas_sites'), ('update public.saas_sites set host=''hack'''), ('insert into public.staff (email,role) values (''a@b.c'',''owner'')'), ('truncate public.orders')) s(stmt);
rollback;
