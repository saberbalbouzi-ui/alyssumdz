\set ON_ERROR_STOP off
set client_min_messages = warning;
create or replace function pg_temp.call(pl jsonb) returns text language plpgsql as $f$ begin set local role anon; perform set_config('request.jwt.claims','{"role":"anon"}',true); return (select public.submit_order(pl)); exception when others then return 'ERR:' || sqlerrm; end $f$;
-- payload صالح (هاتف جزائري 05xx)، المحتوى يتغيّر حسب المعطيات
create or replace function pg_temp.pl(nm text, ph text, tot numeric, k text, extra jsonb default '{}') returns jsonb language sql as $f$ select jsonb_build_object('name', nm, 'phone', ph, 'wilaya', 'الجزائر', 'commune', 'مركز', 'dtype', 'home', 'items', jsonb_build_array(jsonb_build_object('slug','tarkiz','title','قطرات التركيز','qty',1,'price',1800)), 'subtotal', 1800, 'fee', 400, 'total', tot, 'idem', k, 'extra', extra) $f$;
select 'T1 first' t, pg_temp.call(pg_temp.pl('زبون اختبار', '0550100001', 2200, 'k1aaaaaaaaaaaaaaaa')) r \gset
select :'r' ~ '^S[0-9]{6}-[0-9A-F]{8}$' as t1_new_id_format, :'r' as id1;
select pg_temp.call(pg_temp.pl('زبون اختبار', '0550100001', 2200, 'k1aaaaaaaaaaaaaaaa')) = :'r' as t2_same_key_same_payload_returns_original;
select pg_temp.call(pg_temp.pl('زبون اختبار', '0550100001', 2300, 'k1aaaaaaaaaaaaaaaa')) as t3_same_key_diff_total;
select pg_temp.call(pg_temp.pl('زبون اختبار', '0550100001', 2200, 'k1aaaaaaaaaaaaaaaa', '{"🧺 مجموعة":"G123","🔗 مرجع":"W1"}')) = :'r' as t4_volatile_extra_ignored_same_order;
select pg_temp.call(pg_temp.pl('زبون اختبار', '0550100001', 2200, 'short')) as t5_bad_key;
select (select count(*) from public.orders where phone='0550100001') as t6_orders_for_phone_after_3_calls, (select count(*) from public.order_idem where k='k1aaaaaaaaaaaaaaaa') as t6_idem_rows;
select pg_temp.call(pg_temp.pl('زبون آخر', '0550100002', 2200, 'k2bbbbbbbbbbbbbbbb')) <> :'r' as t7_different_key_new_order;
-- بدون مفتاح: السلوك القديم (طلب جديد في كل مرة)
select pg_temp.call(jsonb_build_object('name','زبون ثالث','phone','0550100003','wilaya','x','commune','y','dtype','home','items',jsonb_build_array(jsonb_build_object('slug','a','title','t','qty',1,'price',10)),'subtotal',10,'fee',0,'total',10)) ~ '^S' as t8_no_key_legacy_ok;
