-- مواعيد الرقية الشرعية (صفحة /ruqya-booking/): السبت فقط، فترتان 09:00–12:30 و13:30–17:00.
-- الأسعار تُحسب في الخادم دائماً. البحث لا يكشف بيانات: أسماء مقنَّعة وآخر أرقام الهاتف فقط.
-- idempotent: يمكن إعادة تشغيله.

create table if not exists public.ruqya_bookings (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  day date not null,
  slot text not null check (slot ~ '^[0-2][0-9]:[0-5][0-9]$'),
  slots int not null default 1 check (slots between 1 and 8),
  registered boolean not null default false,
  first_time boolean not null default true,
  name text not null check (char_length(name) between 2 and 120),
  phone text not null check (char_length(phone) between 9 and 10),
  commune text, wilaya text,
  kind text not null check (kind in ('single','couple','kids','family')),
  persons int not null check (persons between 1 and 30),
  sessions int not null check (sessions between 1 and 8),
  session_price int not null, pack_price int not null default 0, total int not null,
  terms boolean not null default false,
  status text not null default 'pending' check (status in ('pending','confirmed','done','cancelled')),
  note text
);
create index if not exists ruqya_day_idx on public.ruqya_bookings (day, slot);
create index if not exists ruqya_phone_idx on public.ruqya_bookings (phone);
alter table public.ruqya_bookings enable row level security;
revoke all on public.ruqya_bookings from anon, authenticated;
grant select, update, delete on public.ruqya_bookings to authenticated;
drop policy if exists "admin ruqya" on public.ruqya_bookings;
create policy "admin ruqya" on public.ruqya_bookings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public._ruqya_slots() returns text[] language sql immutable as $$
  select array['09:00','09:30','10:00','10:30','11:00','11:30','12:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30'];
$$;

-- الأماكن المحجوزة ليوم سبت: [{slot,n}] (عدّاد فقط)
create or replace function public.ruqya_taken(p_day date) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('slot', s, 'n', c, 'cap', greatest(coalesce((select (value ->> 'cap')::int from public.admin_kv where key = 'ruqya'), 1), 1))), '[]'::jsonb) from (
    select x.s, count(*) c from public.ruqya_bookings b
    cross join lateral unnest(public._ruqya_slots()) with ordinality as x(s, i)
    where b.day = p_day and b.status <> 'cancelled'
      and x.i >= array_position(public._ruqya_slots(), b.slot) and x.i < array_position(public._ruqya_slots(), b.slot) + b.slots
    group by x.s) t;
$$;
revoke all on function public.ruqya_taken(date) from public;
grant execute on function public.ruqya_taken(date) to anon, authenticated;

create or replace function public._ruqya_norm(t text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(coalesce(t,''), '[^0-9]', '', 'g'), '^(00)?213', '0');
$$;

-- بحث المسجَّلين (بالهاتف أو الاسم): لا أسماء للعامة: آخر 3 أرقام من الهاتف فقط، حدّ 5
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
revoke all on function public.ruqya_lookup(text) from public;
grant execute on function public.ruqya_lookup(text) to anon, authenticated;

-- الحجز: تحقق كامل + تسعير خادمي
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
revoke all on function public.ruqya_book(jsonb) from public;
grant execute on function public.ruqya_book(jsonb) to anon, authenticated;
