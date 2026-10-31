-- V01-06 (v1.89.689): حدّ معدّل لكل IP للدوال العامة + تضييق ruqya_lookup. idempotent.
-- التطبيق: SQL Editor أو Management API. لا يغيّر صلاحيات الدوال القائمة (create or replace يحفظها).
-- التراجع: أعد تعريف الدوال الأربع من الإصدار السابق (git) ؛ الجدول rate_hits والدالة _rl_hit لا يضرّان.

-- حدّ معدّل لكل عنوان IP (V01-06): يسجّل الضربة ثم يرفض عند التجاوز؛ بلا ترويسة IP لا يُطبَّق (يبقى الحدّ العام)
create table if not exists public.rate_hits (kind text not null, ip_h text not null, at timestamptz not null default now());
create index if not exists rate_hits_idx on public.rate_hits (kind, ip_h, at);
alter table public.rate_hits enable row level security;
revoke all on public.rate_hits from anon, authenticated;
create or replace function public._rl_hit(p_kind text, p_max int, p_win interval) returns void
language plpgsql security definer set search_path = public as $$
declare v_h text := public._ip_hash(public._client_ip());
begin
  if v_h is null then return; end if;
  if random() < 0.02 then delete from public.rate_hits where at < now() - interval '1 day'; end if;
  insert into public.rate_hits (kind, ip_h) values (p_kind, v_h);
  if (select count(*) from public.rate_hits where kind = p_kind and ip_h = v_h and at > now() - p_win) > p_max then raise exception 'rate_limited'; end if;
end $$;
revoke all on function public._rl_hit(text, int, interval) from public, anon, authenticated;

create or replace function public.customer_register(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_phone text := public._cust_phone(p ->> 'phone'); v_name text := btrim(coalesce(p ->> 'name', '')); v_pw text := coalesce(p ->> 'password', ''); cid uuid;
begin
  if char_length(v_name) not between 2 and 120 then raise exception 'invalid_name'; end if;
  if v_phone !~ '^0[567][0-9]{8}$' and v_phone !~ '^0[0-9]{8}$' then raise exception 'invalid_phone'; end if;
  if char_length(v_pw) not between 6 and 72 then raise exception 'invalid_password'; end if;
  if (select count(*) from public.customers where created_at > now() - interval '1 hour') >= 60 then raise exception 'rate_limited'; end if;
  perform public._rl_hit('cust_reg', 8, interval '1 hour');
  if exists (select 1 from public.customers where phone = v_phone) then raise exception 'phone_taken'; end if;
  insert into public.customers (phone, name, wilaya, commune, pass_hash)
  values (v_phone, left(v_name, 120), left(p ->> 'wilaya', 80), left(p ->> 'commune', 120), extensions.crypt(v_pw, extensions.gen_salt('bf', 8)))
  returning id into cid;
  return jsonb_build_object('token', public._cust_new_session(cid), 'profile', public._cust_profile(cid));
end $$;

create or replace function public.track_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t text := btrim(coalesce(p ->> 'tracking', '')); o record;
begin
  if t !~ '^[A-Za-z0-9._-]{4,40}$' then return jsonb_build_object('found', false); end if;
  perform public._rl_hit('track', 30, interval '1 minute');
  delete from public.track_fails where at < now() - interval '1 hour';
  if (select count(*) from public.track_fails where at > now() - interval '1 minute') >= 40 then raise exception 'rate_limited'; end if;
  select status, created_at, wilaya, commune, dtype into o from public.orders
   where substring(note from '🚚[a-z0-9_]+:([A-Za-z0-9._-]+)') = t limit 1;
  if not found then
    insert into public.track_fails default values;       -- محاولة فاشلة تُحتسب (تُرجَع قيمة لا استثناء حتى لا تُلغى)
    return jsonb_build_object('found', false);
  end if;
  return jsonb_build_object('found', true, 'status', o.status, 'date', o.created_at, 'wilaya', coalesce(o.wilaya, ''), 'commune', coalesce(o.commune, ''), 'dtype', coalesce(o.dtype, ''));
end $$;

create or replace function public.ruqya_lookup(p_q text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q text := btrim(coalesce(p_q,'')); d text := public._ruqya_norm(p_q); r jsonb;
begin
  if char_length(q) < 3 then return '{"found":false,"matches":[]}'::jsonb; end if;
  -- V01-06: حدّ لكل IP، والبحث بالرقم يشترط 8 أرقام فأكثر (يمنع تعداد الأرقام بأجزاء قصيرة)
  perform public._rl_hit('ruqya_lookup', 15, interval '10 minutes');
  if q !~ '[^0-9+ ]' and char_length(d) < 8 then return '{"found":false,"matches":[]}'::jsonb; end if;
  with src as (
    select name, public._ruqya_norm(phone) ph from public.ruqya_bookings where status <> 'cancelled'
    union select name, public._ruqya_norm(phone) from public.orders
    union select name, public._ruqya_norm(phone) from public.customers
  ), m as (
    select distinct on (ph) ph from src
    where (char_length(d) >= 6 and ph like '%' || d || '%') or (q ~ '[^0-9+ ]' and lower(name) like '%' || lower(q) || '%')
    limit 5)
  select coalesce(jsonb_agg(jsonb_build_object('tail', right(ph,3))), '[]'::jsonb) into r from m;
  return jsonb_build_object('found', jsonb_array_length(r) > 0, 'matches', r);
end $$;

create or replace function public.ruqya_book(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_day date := (p ->> 'day')::date; v_slot text := p ->> 'slot'; v_kind text := p ->> 'kind';
  v_n int := coalesce((p ->> 'persons')::int, 0); v_s int := coalesce((p ->> 'sessions')::int, 0);
  v_ph text := public._ruqya_norm(p ->> 'phone'); v_name text := btrim(left(coalesce(p ->> 'name',''), 120));
  v_reg boolean := coalesce((p ->> 'registered')::boolean, false); v_known boolean; v_price int; v_pack int; v_id bigint;
  v_all text[] := public._ruqya_slots(); v_i int; v_k int; v_cap int := 1; v_ok boolean;
begin
  perform public._rl_hit('ruqya_book', 10, interval '1 hour');
  if not coalesce((p ->> 'terms')::boolean, false) then raise exception 'terms_required'; end if;
  if extract(dow from v_day) <> 6 then raise exception 'not_saturday'; end if;
  if v_day < (now() at time zone 'Africa/Algiers')::date then raise exception 'past_day'; end if;
  if v_day > (now() at time zone 'Africa/Algiers')::date + 120 then raise exception 'too_far'; end if;
  if v_ph !~ '^0[1-9][0-9]{7,8}$' then raise exception 'invalid_phone'; end if;
  if v_name !~ '[[:alpha:]]' or char_length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if v_s < 1 or v_s > 8 then raise exception 'invalid_sessions'; end if;
  v_i := array_position(v_all, v_slot);
  if v_i is null then raise exception 'invalid_slot'; end if;
  if v_i + v_s - 1 > array_length(v_all, 1) then raise exception 'slot_overflow'; end if;
  -- يجب أن تبقى الجلسات في الفترة نفسها (صباحاً أو مساءً)
  if (v_slot < '13:00') <> (v_all[v_i + v_s - 1] < '13:00') then raise exception 'slot_overflow'; end if;
  select (value ->> 'cap')::int into v_cap from public.admin_kv where key = 'ruqya';
  v_cap := greatest(coalesce(v_cap, 1), 1);
  for v_k in 0 .. v_s - 1 loop
    select count(*) < v_cap into v_ok from public.ruqya_bookings b
      where b.day = v_day and b.status <> 'cancelled'
        and array_position(v_all, v_all[v_i + v_k]) >= array_position(v_all, b.slot) and array_position(v_all, v_all[v_i + v_k]) < array_position(v_all, b.slot) + b.slots;
    if not v_ok then raise exception 'slot_taken'; end if;
  end loop;
  -- السعر لكل جلسة
  if v_kind = 'single' then v_n := 1; v_price := 1500;
  elsif v_kind = 'couple' then v_n := 2; v_price := 2000;
  elsif v_kind = 'kids' then if v_n < 1 or v_n > 10 then raise exception 'invalid_persons'; end if; v_price := 500 * v_n;
  elsif v_kind = 'family' then if v_n < 3 or v_n > 15 then raise exception 'invalid_persons'; end if; v_price := 2000;
  else raise exception 'invalid_kind'; end if;
  -- مسجَّل؟ (له حجز سابق أو طلب أو حساب)
  select exists (select 1 from public.ruqya_bookings where public._ruqya_norm(phone) = v_ph and status <> 'cancelled')
      or exists (select 1 from public.orders where public._ruqya_norm(phone) = v_ph)
      or exists (select 1 from public.customers where public._ruqya_norm(phone) = v_ph) into v_known;
  if v_reg and not v_known then raise exception 'not_registered'; end if;
  v_pack := case when v_known then 0 else 3000 end;
  if (select count(*) from public.ruqya_bookings where phone = v_ph and created_at > now() - interval '1 hour') >= 3 then raise exception 'rate_limited'; end if;
  insert into public.ruqya_bookings (day, slot, slots, registered, first_time, name, phone, commune, wilaya, kind, persons, sessions, session_price, pack_price, total, terms)
  values (v_day, v_slot, v_s, v_known, not v_known, v_name, v_ph, left(p ->> 'commune', 120), left(p ->> 'wilaya', 80), v_kind, v_n, v_s, v_price, v_pack, v_price * v_s + v_pack, true)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'total', v_price * v_s + v_pack, 'session_price', v_price, 'pack_price', v_pack, 'first_time', not v_known);
end $$;
