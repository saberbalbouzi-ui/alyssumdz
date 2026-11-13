\set ON_ERROR_STOP off
set client_min_messages = warning;
create or replace function pg_temp.call(pl jsonb) returns text language plpgsql as $f$ begin set local role anon; perform set_config('request.jwt.claims','{"role":"anon"}',true); return (select public.submit_order(pl)); exception when others then return 'ERR:' || sqlerrm; end $f$;
create or replace function pg_temp.pl(nm text, ph text, k text, promo text default '') returns jsonb language sql as $f$ select jsonb_build_object('name', nm, 'phone', ph, 'wilaya', 'الجزائر', 'commune', 'مركز', 'dtype', 'home', 'items', jsonb_build_array(jsonb_build_object('slug','tarkiz','title','قطرات','qty',1,'price',1800)), 'subtotal', 1800, 'fee', 400, 'total', 2200, 'idem', k, 'promo', promo) $f$;
drop sequence if exists public.collide_seq; create sequence public.collide_seq;
create or replace function public.collide_trg() returns trigger language plpgsql as $f$ begin if new.name like 'COLLIDE%' and nextval('public.collide_seq') <= (case when new.name = 'COLLIDE3' then 3 else 99 end) then raise exception 'forced collision' using errcode = 'unique_violation', constraint = 'orders_pkey'; end if; if new.name = 'FAILDB' then raise exception 'forced db failure'; end if; return new; end $f$;
drop trigger if exists collide_t on public.orders; create trigger collide_t before insert on public.orders for each row execute function public.collide_trg();
insert into public.promo_codes (code, phone, type, value, min_order, expires_at) values ('PCOL3','0550200003','percent',10,0, now() + interval '1 day'), ('PCOL9','0550200009','percent',10,0, now() + interval '1 day'), ('PFAIL','0550200004','percent',10,0, now() + interval '1 day') on conflict do nothing;
select 'C3' c, pg_temp.call(pg_temp.pl('COLLIDE3','0550200003','kc3cccccccccccccccc','PCOL3')) r \gset
select length(:'r') as c3_id_len_after_3_collisions_expect_22, (select used_order from public.promo_codes where code='PCOL3') = :'r' as c3_promo_bound_to_final_id, (select count(*) from public.orders where phone='0550200003') as c3_orders;
select pg_temp.call(pg_temp.pl('COLLIDE9','0550200009','kc9cccccccccccccccc','PCOL9')) as c9_five_collisions_result;
select (select count(*) from public.orders where phone='0550200009') as c9_orders_expect_0, (select used_order from public.promo_codes where code='PCOL9') is null as c9_promo_unconsumed, (select count(*) from public.order_idem where k='kc9cccccccccccccccc') as c9_idem_rows_expect_0;
select pg_temp.call(pg_temp.pl('FAILDB','0550200004','kf4ffffffffffffffff','PFAIL')) as f_db_failure_result;
select (select count(*) from public.orders where phone='0550200004') as f_orders_expect_0, (select used_order from public.promo_codes where code='PFAIL') is null as f_promo_unconsumed, (select count(*) from public.order_idem where k='kf4ffffffffffffffff') as f_idem_rows_expect_0;
drop trigger collide_t on public.orders;
select pg_temp.call(pg_temp.pl('زبون إعادة','0550200004','kf4ffffffffffffffff','PFAIL')) ~ '^S' as f_retry_after_fix_succeeds, (select count(*) from public.orders where phone='0550200004') as f_orders_after_retry_expect_1;
