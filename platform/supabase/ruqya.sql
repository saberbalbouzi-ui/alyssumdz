-- مواعيد الرقية الشرعية (صفحة /ruqya-booking/): السبت فقط، فترتان 09:00–12:30 و13:30–17:00، 5 جلسات كحد أقصى لكل فترة (pcap).
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
  note text,
  whatsapp text check (whatsapp is null or whatsapp ~ '^0[5-7][0-9]{8}$')      -- رقم الواتساب لتأكيد الموعد
);
create index if not exists ruqya_day_idx on public.ruqya_bookings (day, slot);
create index if not exists ruqya_phone_idx on public.ruqya_bookings (phone);
alter table public.ruqya_bookings enable row level security;
revoke all on public.ruqya_bookings from anon, authenticated;
grant select, insert, update, delete on public.ruqya_bookings to authenticated;      -- insert: استيراد العملاء من تقويم Google (المدير فقط عبر السياسة أدناه)
drop policy if exists "admin ruqya" on public.ruqya_bookings;
create policy "admin ruqya" on public.ruqya_bookings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public._ruqya_slots() returns text[] language sql immutable as $$
  select array['09:00','09:30','10:00','10:30','11:00','11:30','12:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30'];
$$;

-- سقف الجلسات في كل فترة (صباحاً / مساءً): افتراضياً 5 (admin_kv 'ruqya'.pcap)
create or replace function public._rq_pcap() returns int
language sql stable security definer set search_path = public as $$
  select greatest(coalesce((select (value ->> 'pcap')::int from public.admin_kv where key = 'ruqya'), 5), 1)
$$;

-- الأماكن المحجوزة ليوم سبت: [{slot,n}] (عدّاد فقط)
create or replace function public.ruqya_taken(p_day date) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('slot', s, 'n', c, 'cap', greatest(coalesce((select (value ->> 'cap')::int from public.admin_kv where key = 'ruqya'), 1), 1))), '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_object('slot', '_total', 'n', coalesce((select sum(sessions) from public.ruqya_bookings where day = p_day and status <> 'cancelled'), 0), 'cap', greatest(coalesce((select (value ->> 'maxday')::int from public.admin_kv where key = 'ruqya'), 15), 1)),
      jsonb_build_object('slot', '_am', 'n', coalesce((select sum(sessions) from public.ruqya_bookings where day = p_day and status <> 'cancelled' and slot < '13:00'), 0), 'cap', public._rq_pcap()),
      jsonb_build_object('slot', '_pm', 'n', coalesce((select sum(sessions) from public.ruqya_bookings where day = p_day and status <> 'cancelled' and slot >= '13:00'), 0), 'cap', public._rq_pcap())) from (
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
  v_all text[] := public._ruqya_slots(); v_sn text; v_sp text; v_k2 boolean; v_pack2 int := 0; v_items jsonb := '[]'::jsonb; v_it jsonb; v_pr jsonb; v_pt int := 0; v_q int; v_i int; v_k int; v_cap int := 1; v_ok boolean;
begin
  perform public._rl_hit('ruqya_book', 10, interval '1 hour');
  if not coalesce((p ->> 'terms')::boolean, false) then raise exception 'terms_required'; end if;
  if extract(dow from v_day) <> 6 then raise exception 'not_saturday'; end if;
  if v_day < (now() at time zone 'Africa/Algiers')::date then raise exception 'past_day'; end if;
  if v_day > (now() at time zone 'Africa/Algiers')::date + 120 then raise exception 'too_far'; end if;
  if coalesce((select (value ->> 'disabled')::boolean from public.admin_kv where key = 'ruqya'), false) then raise exception 'disabled'; end if;
  if exists (select 1 from public.admin_kv where key = 'ruqya' and value -> 'closed' ? (v_day::text)) then raise exception 'closed_day'; end if;
  if v_ph !~ '^0[1-9][0-9]{7,8}$' then raise exception 'invalid_phone'; end if;
  if (select count(*) from public.ruqya_warnings where phone = v_ph) >= 3 or exists (select 1 from public.ruqya_blocks where phone = v_ph) then raise exception 'banned'; end if;      -- 3 إنذارات غياب = حظر من الحجز
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
  -- سقف الجلسات في الفترة (5 صباحاً و5 مساءً افتراضياً)
  if coalesce((select sum(sessions) from public.ruqya_bookings where day = v_day and status <> 'cancelled' and (slot < '13:00') = (v_slot < '13:00')), 0) + v_s > public._rq_pcap() then raise exception 'period_full'; end if;
  -- السعر لكل جلسة
  -- سقف الجلسات في اليوم (افتراضياً 15)؛ بعده يتحول التسجيل إلى السبت المقبل
  if coalesce((select sum(sessions) from public.ruqya_bookings where day = v_day and status <> 'cancelled'), 0) + v_s > greatest(coalesce((select (value ->> 'maxday')::int from public.admin_kv where key = 'ruqya'), 15), 1) then raise exception 'day_full'; end if;
  if v_kind = 'single' then v_n := 1; v_price := public._rq_price('single', 1500);
  elsif v_kind = 'couple' then v_n := 2; v_price := public._rq_price('couple', 2000);
  elsif v_kind = 'kids' then if v_n < 1 or v_n > 10 then raise exception 'invalid_persons'; end if; v_price := public._rq_price('kid', 500) * v_n;
  elsif v_kind = 'family' then if v_n < 2 or v_n > 3 or v_s < 2 then raise exception 'invalid_persons'; end if; v_price := public._rq_price('family', 2000);
  else raise exception 'invalid_kind'; end if;
  -- مسجَّل؟ (له حجز سابق أو طلب أو حساب)
  select exists (select 1 from public.ruqya_bookings where public._ruqya_norm(phone) = v_ph and status <> 'cancelled')
      or exists (select 1 from public.orders where public._ruqya_norm(phone) = v_ph)
      or exists (select 1 from public.customers where public._ruqya_norm(phone) = v_ph) into v_known;
  if v_reg and not v_known then raise exception 'not_registered'; end if;
  v_pack := case when (not v_known and v_kind in ('single','couple')) or coalesce((p ->> 'pack')::boolean, false) then public._rq_price('pack', 3000) else 0 end;
  -- مرافق آخر لبعض الجلسات: يُسجَّل بياناته وتُضاف له الباقة العلاجية
  v_sn := nullif(btrim(left(coalesce(p ->> 'second_name', ''), 120)), '');
  if v_sn is not null then
    v_sp := public._ruqya_norm(p ->> 'second_phone');
    if v_s < 2 or v_kind not in ('single', 'couple') or v_sn !~ '[[:alpha:]]' or v_sp !~ '^0[5-7][0-9]{8}$' then raise exception 'invalid_second'; end if;
    if (select count(*) from public.ruqya_warnings where phone = v_sp) >= 3 or exists (select 1 from public.ruqya_blocks where phone = v_sp) then raise exception 'banned'; end if;
    select exists (select 1 from public.ruqya_bookings where public._ruqya_norm(phone) = v_sp and status <> 'cancelled')
        or exists (select 1 from public.orders where public._ruqya_norm(phone) = v_sp)
        or exists (select 1 from public.customers where public._ruqya_norm(phone) = v_sp) into v_k2;
    v_pack2 := case when not v_k2 or coalesce((p ->> 'pack2')::boolean, false) then public._rq_price('pack', 3000) else 0 end;
  end if;      -- الباقة العلاجية: تلقائية لأول تسجيل (فردية/زوجين) واختيارية لغيرها
  if (select count(*) from public.ruqya_bookings where phone = v_ph and created_at > now() - interval '1 hour') >= 3 then raise exception 'rate_limited'; end if;
  if jsonb_typeof(p -> 'items') = 'array' then      -- منتجات المركز: تُسعَّر من الإعدادات الخادمية لا من العميل
    if jsonb_array_length(p -> 'items') > 20 then raise exception 'invalid_product'; end if;
    for v_it in select * from jsonb_array_elements(p -> 'items') loop
      v_q := least(greatest(coalesce((v_it ->> 'qty')::int, 1), 1), 10);
      select x into v_pr from jsonb_array_elements(coalesce((select value -> 'products' from public.admin_kv where key = 'ruqya'), '[]'::jsonb)) x where x ->> 'slug' = v_it ->> 'slug' limit 1;
      if v_pr is null then raise exception 'invalid_product'; end if;
      v_items := v_items || jsonb_build_array(jsonb_build_object('slug', v_pr ->> 'slug', 'title', v_pr ->> 'title', 'qty', v_q, 'price', (v_pr ->> 'price')::int));
      v_pt := v_pt + v_q * (v_pr ->> 'price')::int;
    end loop;
  end if;
  if coalesce(p ->> 'whatsapp', '') <> '' and public._ruqya_norm(p ->> 'whatsapp') !~ '^0[5-7][0-9]{8}$' then raise exception 'invalid_whatsapp'; end if;
  insert into public.ruqya_bookings (day, slot, slots, registered, first_time, name, phone, whatsapp, commune, wilaya, kind, persons, sessions, session_price, pack_price, total, terms, second_name, second_phone, products, products_total)
  values (v_day, v_slot, v_s, v_known, not v_known, v_name, v_ph, (case when coalesce(p ->> 'whatsapp', '') = '' then (case when v_ph ~ '^0[5-7][0-9]{8}$' then v_ph else null end) else public._ruqya_norm(p ->> 'whatsapp') end), left(p ->> 'commune', 120), left(p ->> 'wilaya', 80), v_kind, v_n, v_s, v_price, v_pack + v_pack2, v_price * v_s + v_pack + v_pack2 + v_pt, true, v_sn, v_sp, v_items, v_pt)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'total', v_price * v_s + v_pack + v_pack2 + v_pt, 'session_price', v_price, 'pack_price', v_pack + v_pack2, 'products_total', v_pt, 'first_time', not v_known);
end $$;
revoke all on function public.ruqya_book(jsonb) from public;
grant execute on function public.ruqya_book(jsonb) to anon, authenticated;


-- ملف المريض: زيارات كل حجز مسجَّل (تاريخ، تطور الحالة، ملاحظات، متابعة) — للمدير فقط
create table if not exists public.ruqya_visits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  booking_id bigint not null references public.ruqya_bookings(id) on delete cascade,
  day date not null,
  slot text check (slot is null or slot ~ '^[0-2][0-9]:[0-5][0-9]$'),
  progress text not null default '' check (progress in ('','new','better','same','worse','done')),
  note text not null default '' check (char_length(note) <= 4000),
  followup text not null default '' check (char_length(followup) <= 2000)
);
create index if not exists ruqya_visits_booking_idx on public.ruqya_visits (booking_id, day desc);
alter table public.ruqya_visits enable row level security;
revoke all on public.ruqya_visits from anon, authenticated;
grant select, insert, update, delete on public.ruqya_visits to authenticated;
drop policy if exists "admin ruqya visits" on public.ruqya_visits;
create policy "admin ruqya visits" on public.ruqya_visits for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ═══ بوابة المريض: يطّلع المريض على ملفه وتطور حالته بعد تسجيل الدخول (Google/Apple/بريد) وربط حسابه برابط تأكيد يرسله المدير إلى هاتفه ═══
alter table public.ruqya_visits add column if not exists shared boolean not null default false;      -- true = تظهر للمريض (ما لم يُشارَك لا يراه إلا المدير)

create table if not exists public.ruqya_portal_links (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  booking_id bigint not null references public.ruqya_bookings(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz, used_by uuid
);
create table if not exists public.ruqya_portal_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  booking_id bigint not null references public.ruqya_bookings(id) on delete cascade,
  provider text, linked_at timestamptz not null default now()
);
create index if not exists ruqya_portal_acc_booking_idx on public.ruqya_portal_accounts (booking_id);
alter table public.ruqya_portal_links enable row level security;
alter table public.ruqya_portal_accounts enable row level security;
revoke all on public.ruqya_portal_links, public.ruqya_portal_accounts from anon, authenticated;
grant select on public.ruqya_portal_links, public.ruqya_portal_accounts to authenticated;
drop policy if exists "admin portal links" on public.ruqya_portal_links;
create policy "admin portal links" on public.ruqya_portal_links for select to authenticated using (public.is_admin());
drop policy if exists "admin portal accounts" on public.ruqya_portal_accounts;
create policy "admin portal accounts" on public.ruqya_portal_accounts for select to authenticated using (public.is_admin());

-- المدير: رابط تأكيد لمريض (صالح 14 يوماً، يُستعمل مرة واحدة؛ المخزَّن بصمته فقط)
create or replace function public.ruqya_portal_invite(p_booking_id bigint) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_tok text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.ruqya_bookings where id = p_booking_id) then raise exception 'not_found'; end if;
  insert into public.ruqya_portal_links (booking_id, token_hash, expires_at) values (p_booking_id, encode(digest(v_tok, 'sha256'), 'hex'), now() + interval '14 days');
  return v_tok;
end $$;
revoke all on function public.ruqya_portal_invite(bigint) from public, anon;
grant execute on function public.ruqya_portal_invite(bigint) to authenticated;

-- المدير: فصل كل حسابات المريض
create or replace function public.ruqya_portal_unlink(p_booking_id bigint) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.ruqya_portal_accounts where booking_id = p_booking_id; get diagnostics n = row_count;
  update public.ruqya_portal_links set expires_at = now() where booking_id = p_booking_id and used_at is null and expires_at > now();
  return n;
end $$;
revoke all on function public.ruqya_portal_unlink(bigint) from public, anon;
grant execute on function public.ruqya_portal_unlink(bigint) to authenticated;

-- المريض (مسجَّل الدخول): ربط حسابه بملفه عبر رابط التأكيد
create or replace function public.ruqya_portal_claim(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_l public.ruqya_portal_links; v_old bigint; v_prov text;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  perform public._rl_hit('ruqya_claim', 10, interval '10 minutes');
  select * into v_l from public.ruqya_portal_links where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if not found or v_l.used_at is not null or v_l.expires_at < now() then raise exception 'invalid_link'; end if;
  select booking_id into v_old from public.ruqya_portal_accounts where user_id = v_uid;
  if v_old is not null and v_old <> v_l.booking_id then raise exception 'account_already_linked'; end if;
  select coalesce(raw_app_meta_data ->> 'provider', '') into v_prov from auth.users where id = v_uid;
  insert into public.ruqya_portal_accounts (user_id, booking_id, provider) values (v_uid, v_l.booking_id, v_prov) on conflict (user_id) do nothing;
  update public.ruqya_portal_links set used_at = now(), used_by = v_uid where id = v_l.id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.ruqya_portal_claim(text) from public, anon;
grant execute on function public.ruqya_portal_claim(text) to authenticated;

-- المريض: ملفه فقط — الاسم والمنطقة والزيارات المشارَكة (تاريخ، تطور الحالة، ملاحظات، متابعة)
create or replace function public.ruqya_portal_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_b public.ruqya_bookings;
begin
  if v_uid is null then return jsonb_build_object('linked', false); end if;
  select b.* into v_b from public.ruqya_portal_accounts a join public.ruqya_bookings b on b.id = a.booking_id where a.user_id = v_uid;
  if not found then return jsonb_build_object('linked', false); end if;
  return jsonb_build_object('linked', true, 'name', v_b.name, 'region', coalesce(v_b.commune, ''),
    'visits', coalesce((select jsonb_agg(jsonb_build_object('day', v.day, 'slot', v.slot, 'progress', v.progress, 'note', v.note, 'followup', v.followup) order by v.day desc, v.slot desc nulls last)
                         from public.ruqya_visits v where v.shared and v.booking_id in (select id from public.ruqya_bookings where phone = v_b.phone)), '[]'::jsonb));      -- ملف واحد لكل مريض (بالهاتف)
end $$;
revoke all on function public.ruqya_portal_me() from public, anon;
grant execute on function public.ruqya_portal_me() to authenticated;

alter table public.ruqya_bookings add column if not exists whatsapp text check (whatsapp is null or whatsapp ~ '^0[5-7][0-9]{8}$');

-- ═══ الإنذارات: الغياب بلا إخطار (24 ساعة) = إنذار في الملف؛ 3 إنذارات = حظر من حجز المواعيد (بحسب الهاتف) ═══
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.ruqya_bookings'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%status%pending%' loop
    execute format('alter table public.ruqya_bookings drop constraint %I', c);
  end loop;
  alter table public.ruqya_bookings add constraint ruqya_bookings_status_check check (status in ('pending','confirmed','done','cancelled','noshow'));
end $$;

create table if not exists public.ruqya_warnings (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  phone text not null,
  booking_id bigint references public.ruqya_bookings(id) on delete set null,
  day date,
  note text not null default '' check (char_length(note) <= 500)
);
create index if not exists ruqya_warn_phone_idx on public.ruqya_warnings (phone);
alter table public.ruqya_warnings enable row level security;
revoke all on public.ruqya_warnings from anon, authenticated;
grant select, insert, update, delete on public.ruqya_warnings to authenticated;
drop policy if exists "admin ruqya warnings" on public.ruqya_warnings;
create policy "admin ruqya warnings" on public.ruqya_warnings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- المدير: تعليم حجز «غاب بلا إخطار» وتسجيل إنذار؛ يعيد عدد الإنذارات والحظر
create or replace function public.ruqya_mark_noshow(p_booking_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.ruqya_bookings; n int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into b from public.ruqya_bookings where id = p_booking_id;
  if not found then raise exception 'not_found'; end if;
  if b.status = 'noshow' then raise exception 'already_marked'; end if;
  update public.ruqya_bookings set status = 'noshow' where id = b.id;
  insert into public.ruqya_warnings (phone, booking_id, day, note) values (b.phone, b.id, b.day, 'غاب عن الموعد دون إخطار');
  select count(*) into n from public.ruqya_warnings where phone = b.phone;
  return jsonb_build_object('warnings', n, 'banned', n >= 3);
end $$;
revoke all on function public.ruqya_mark_noshow(bigint) from public, anon;
grant execute on function public.ruqya_mark_noshow(bigint) to authenticated;

alter table public.ruqya_bookings add column if not exists second_name text, add column if not exists second_phone text;      -- مرافق آخر لبعض الجلسات


-- ═══ إدارة المواعيد: أسعار وعطل وتعطيل ومنتجات المركز وحظر الأرقام (الإعدادات في admin_kv 'ruqya': prices/closed/disabled/msg/products/cap/maxday) ═══
create or replace function public._rq_price(k text, d int) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (value -> 'prices' ->> k)::int from public.admin_kv where key = 'ruqya'), d)
$$;
create table if not exists public.ruqya_blocks (phone text primary key, reason text not null default '', created_at timestamptz not null default now());
alter table public.ruqya_blocks enable row level security;
revoke all on public.ruqya_blocks from anon, authenticated;
grant select, insert, update, delete on public.ruqya_blocks to authenticated;
drop policy if exists "admin ruqya blocks" on public.ruqya_blocks;
create policy "admin ruqya blocks" on public.ruqya_blocks for all to authenticated using (public.is_admin()) with check (public.is_admin());
alter table public.ruqya_bookings add column if not exists products jsonb not null default '[]'::jsonb, add column if not exists products_total int not null default 0;
create or replace function public.ruqya_config() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb := coalesce((select value from public.admin_kv where key = 'ruqya'), '{}'::jsonb);
begin
  return jsonb_build_object(
    'prices', jsonb_build_object('single', public._rq_price('single', 1500), 'couple', public._rq_price('couple', 2000), 'kid', public._rq_price('kid', 500), 'family', public._rq_price('family', 2000), 'pack', public._rq_price('pack', 3000)),
    'maxday', greatest(coalesce((v ->> 'maxday')::int, 15), 1),
    'pcap', public._rq_pcap(),
    'closed', coalesce(v -> 'closed', '[]'::jsonb),
    'disabled', coalesce((v ->> 'disabled')::boolean, false),
    'msg', coalesce(v ->> 'msg', ''),
    'info', jsonb_build_object('address', left(coalesce(v ->> 'address', ''), 300), 'phones', left(coalesce(v ->> 'phones', ''), 200), 'map', left(coalesce(v ->> 'map', ''), 300)),
    'products', coalesce(v -> 'products', '[]'::jsonb));
end $$;
revoke all on function public.ruqya_config() from public;
grant execute on function public.ruqya_config() to anon, authenticated;


-- ═══ رابط التأكيد + رمز تحقق (v1.89.1081): الرابط وحده لا يكفي؛ يصل المريض رمز من 6 أرقام في رسالة منفصلة، و5 محاولات خاطئة تُبطل الرابط ═══
alter table public.ruqya_portal_links add column if not exists pin_hash text, add column if not exists attempts int not null default 0;
update public.ruqya_portal_links set expires_at = now() where used_at is null and pin_hash is null and expires_at > now();

create or replace function public.ruqya_portal_invite2(p_booking_id bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_tok text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''); v_pin text := lpad((floor(random() * 1000000))::int::text, 6, '0');
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.ruqya_bookings where id = p_booking_id) then raise exception 'not_found'; end if;
  insert into public.ruqya_portal_links (booking_id, token_hash, pin_hash, expires_at)
    values (p_booking_id, encode(digest(v_tok, 'sha256'), 'hex'), encode(digest(v_tok || ':' || v_pin, 'sha256'), 'hex'), now() + interval '14 days');
  return jsonb_build_object('token', v_tok, 'pin', v_pin);
end $$;
revoke all on function public.ruqya_portal_invite2(bigint) from public, anon;
grant execute on function public.ruqya_portal_invite2(bigint) to authenticated;

create or replace function public.ruqya_portal_claim2(p_token text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_l public.ruqya_portal_links; v_old bigint; v_prov text;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  perform public._rl_hit('ruqya_claim', 10, interval '10 minutes');
  select * into v_l from public.ruqya_portal_links where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if not found or v_l.used_at is not null or v_l.expires_at < now() or v_l.attempts >= 5 or v_l.pin_hash is null then raise exception 'invalid_link'; end if;
  if v_l.pin_hash is distinct from encode(digest(coalesce(p_token, '') || ':' || regexp_replace(coalesce(p_pin, ''), '[^0-9]', '', 'g'), 'sha256'), 'hex') then
    update public.ruqya_portal_links set attempts = attempts + 1, expires_at = case when attempts + 1 >= 5 then now() else expires_at end where id = v_l.id;
    return jsonb_build_object('ok', false, 'error', 'bad_pin', 'left', greatest(0, 5 - (v_l.attempts + 1)));
  end if;
  select booking_id into v_old from public.ruqya_portal_accounts where user_id = v_uid;
  if v_old is not null and v_old <> v_l.booking_id then raise exception 'account_already_linked'; end if;
  select coalesce(raw_app_meta_data ->> 'provider', '') into v_prov from auth.users where id = v_uid;
  insert into public.ruqya_portal_accounts (user_id, booking_id, provider) values (v_uid, v_l.booking_id, v_prov) on conflict (user_id) do nothing;
  update public.ruqya_portal_links set used_at = now(), used_by = v_uid where id = v_l.id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.ruqya_portal_claim2(text, text) from public, anon;
grant execute on function public.ruqya_portal_claim2(text, text) to authenticated;

-- الدالتان القديمتان (بلا رمز) معطَّلتان
create or replace function public.ruqya_portal_invite(p_booking_id bigint) returns text
language plpgsql security definer set search_path = public as $$ begin raise exception 'use_invite2'; end $$;
create or replace function public.ruqya_portal_claim(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$ begin raise exception 'pin_required'; end $$;


-- ═══ موعد سري (v1.89.1089): يحجز مكاناً في الفترة ويراه المدير وحده؛ لا يظهر في بحث الزوار ═══
alter table public.ruqya_bookings add column if not exists secret boolean not null default false;
-- ruqya_lookup يستثني الحجوزات السرية (not secret في src)
