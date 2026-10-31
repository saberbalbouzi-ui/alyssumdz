-- V-01: اختبار RLS/الصلاحيات على قاعدة حيّة أو مماثلة للإنتاج. يطبّق التضييق (اختيارياً) ويجرّب الأدوار الثلاثة ثم يتراجع عن كل شيء بالاستثناء النهائي.
-- التشغيل: غيّر harden إلى false لقياس الحالة الأساسية. النتيجة تظهر في رسالة الخطأ RES:{...} (التراجع مقصود، لا يُحفظ شيء).
do $T$
declare harden boolean := true; res jsonb := '{}'::jsonb; em text; uid uuid; ca uuid; cb uuid;
  tok_a text := repeat('a',48); tok_b text := repeat('b',48);
  anon_claims text := '{"role":"anon"}';
  atk text := json_build_object('sub', gen_random_uuid(), 'email', 'attacker@example.test', 'role', 'authenticated', 'aal', 'aal1')::text;
  own text; q text; k text; r text;
  tabs text[] := array['orders','admin_kv','customers','saas_tickets','saas_sites','saas_customers','saas_messages','saas_outbox','saas_plans','saas_settings','experts_profiles','expert_contacts','expert_reports','expert_reviews','ruqya_bookings','staff','saas_admins','admins','audit_log','hub_sites','hub_secrets','hub_members','promo_codes','presence','visits','agent_questions','customer_sessions','customer_fails'];
begin
  select lower(email) into em from public.admins limit 1; select id into uid from auth.users where lower(email)=em;
  own := json_build_object('sub', uid, 'email', em, 'role', 'authenticated', 'aal', 'aal2')::text;
  if harden then
    execute $H$revoke all on table public.audit_log, public.pixabay_cache, public.saas_admins, public.saas_carrier_fixes, public.staff from anon$H$;
    execute $H$revoke all on table public.saas_admins, public.staff, public.pixabay_cache from authenticated$H$;
    execute $H$revoke insert, update, delete, truncate, references, trigger on table public.audit_log from authenticated$H$;
    execute $H$revoke execute on function public._audit(text, text, jsonb), public._ex_card(public.experts_profiles, boolean), public._ex_recount(uuid), public._ex_site(text),
  public._saas_site_notify(), public._saas_ticket_au(), public.orders_guard(), public._aal_ok(), public._actor_role(), public._staff_row() from public, anon, authenticated$H$;
    execute $H$revoke execute on function public.staff_me(), public.hub_my_sites(), public.audit_event(text, text, jsonb), public.audit_perf(integer), public.audit_stats(integer),
  public.pack_orders(), public.pack_mark(text, boolean), public.has_perm(text), public.is_admin(), public.is_saas_admin() from public, anon$H$;
  end if;
  -- بيانات اختبار لعميلين A/B (تُمسح بالتراجع)
  insert into public.customers (phone,name,pass_hash) values ('0551110001','V01-A','x') returning id into ca;
  insert into public.customers (phone,name,pass_hash) values ('0551110002','V01-B','x') returning id into cb;
  insert into public.customer_sessions (token_hash,customer_id) values (encode(extensions.digest(tok_a,'sha256'),'hex'),ca),(encode(extensions.digest(tok_b,'sha256'),'hex'),cb);
  insert into public.orders (id,name,phone,customer_id) values ('V01-ISO-A','V01-A','0551110001',ca),('V01-ISO-B','V01-B','0551110002',cb);
  create or replace function pg_temp.try(rl text, claims text, expr text) returns text language plpgsql as $f$
  declare o text; begin
    execute 'set local role ' || rl; perform set_config('request.jwt.claims', claims, true);
    execute 'select (' || expr || ')::text' into o; reset role; return coalesce(o,'null');
  exception when others then reset role; return 'ERR:' || left(sqlerrm, 60); end $f$;
  -- 1) الزائر (anon): كل الجداول محجوبة
  foreach k in array tabs loop res := res || jsonb_build_object('anon.sel.'||k, pg_temp.try('anon', anon_claims, '(select count(*) from public.'||k||')')); end loop;
  res := res || jsonb_build_object('anon.ins.orders', pg_temp.try('anon', anon_claims, $e$(with i as (insert into public.orders (id,name,phone) values ('V01-X','x','0') returning 1) select count(*) from i)$e$));
  foreach k in array array['public.is_admin()','public.is_saas_admin()','public.has_perm(''orders'')','public.staff_me()','public.pack_orders()','public.audit_stats(7)','public.audit_perf(7)','public.hub_my_sites()','public._ex_recount(gen_random_uuid())','public._audit(''x'',''y'',''{}''::jsonb)','public._ex_site(''https://a.b'')'] loop
    res := res || jsonb_build_object('anon.fn.'||k, pg_temp.try('anon', anon_claims, k)); end loop;
  foreach k in array array['public.experts_categories()','public.saas_carrier_fixes()','public.ruqya_taken(''2026-11-07'')','public.public_viewers(''x'')','public.form_token()','public.validate_promo(''{"code":"ZZZ"}''::jsonb)','public.track_order(''{"tracking":"NOPE12345"}''::jsonb)','public.saas_site_status(''{"origin":"https://nope.example"}''::jsonb)'] loop
    res := res || jsonb_build_object('anon.public.'||k, left(pg_temp.try('anon', anon_claims, k), 50)); end loop;
  -- 2) مسجَّل بلا صلاحية (مهاجم): صفر صفوف أو رفض، وكل دوال المالك/الفريق ترفض
  foreach k in array tabs loop res := res || jsonb_build_object('atk.sel.'||k, pg_temp.try('authenticated', atk, '(select count(*) from public.'||k||')')); end loop;
  res := res || jsonb_build_object('atk.ins.orders', pg_temp.try('authenticated', atk, $e$(with i as (insert into public.orders (id,name,phone) values ('V01-Y','x','0') returning 1) select count(*) from i)$e$));
  res := res || jsonb_build_object('atk.upd.orders', pg_temp.try('authenticated', atk, $e$(with u as (update public.orders set name='HACK' where id='V01-ISO-A' returning 1) select count(*) from u)$e$));
  res := res || jsonb_build_object('atk.del.orders', pg_temp.try('authenticated', atk, $e$(with d as (delete from public.orders where id='V01-ISO-A' returning 1) select count(*) from d)$e$));
  foreach k in array array['public.is_admin()','public.is_saas_admin()','public.has_perm(''orders'')','public.staff_me()','public.pack_orders()','public.audit_stats(7)','public.audit_perf(7)','public.audit_event(''login'','''',''{}''::jsonb)','public.hub_my_sites()'] loop
    res := res || jsonb_build_object('atk.fn.'||k, pg_temp.try('authenticated', atk, k)); end loop;
  -- 3) المالك (aal2): يعمل كل شيء
  foreach k in array array['public.is_admin()','public.is_saas_admin()','(select count(*) >= 0 from public.orders)','(select count(*) >= 0 from public.admin_kv)','(select count(*) >= 0 from public.saas_tickets)','public.staff_me()','public.audit_stats(7)','public.audit_perf(7)','public.hub_my_sites()','public.pack_orders()'] loop
    res := res || jsonb_build_object('own.'||k, left(pg_temp.try('authenticated', own, k), 60)); end loop;
  -- 4) عزل العملاء A/B بالرمز (بدور anon كما في المتجر)
  res := res || jsonb_build_object('cust.A.sees_A', pg_temp.try('anon', anon_claims, format($e$(public.customer_me(%L::jsonb)::text like '%%V01-ISO-A%%')$e$, json_build_object('token',tok_a))));
  res := res || jsonb_build_object('cust.A.sees_B', pg_temp.try('anon', anon_claims, format($e$(public.customer_me(%L::jsonb)::text like '%%V01-ISO-B%%')$e$, json_build_object('token',tok_a))));
  res := res || jsonb_build_object('cust.B.sees_A', pg_temp.try('anon', anon_claims, format($e$(public.customer_me(%L::jsonb)::text like '%%V01-ISO-A%%')$e$, json_build_object('token',tok_b))));
  res := res || jsonb_build_object('cust.badtoken', pg_temp.try('anon', anon_claims, format($e$public.customer_me(%L::jsonb)$e$, json_build_object('token',repeat('z',48)))));
  res := res || jsonb_build_object('cust.B.link_A_order', pg_temp.try('anon', anon_claims, format($e$public.customer_link_order(%L::jsonb)$e$, json_build_object('token',tok_b,'order_id','V01-ISO-A'))));
  res := res || jsonb_build_object('cust.B.update_self', left(pg_temp.try('anon', anon_claims, format($e$public.customer_update(%L::jsonb)::text$e$, json_build_object('token',tok_b,'name','V01-B2'))),40));
  res := res || jsonb_build_object('cust.A_name_after_B_update', (select name from public.customers where id=ca), 'cust.A_order_owner', (select customer_id=ca from public.orders where id='V01-ISO-A'));
  raise exception 'RES:%', res::text;
end $T$;
