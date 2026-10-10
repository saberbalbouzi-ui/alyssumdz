-- ════════════════════════════════════════════════════════════════════
-- أليسوم — مخطط Supabase (المرحلة 1): الزيارات + المشاهدون الآن + أسئلة الوكيل بلا جواب
-- التشغيل: لوحة Supabase ← SQL Editor ← New query ← الصق هذا الملف كاملاً ← Run (آمن لإعادة التشغيل).
-- المبدأ: الزائر (anon) لا يقرأ شيئاً أبداً ولا يكتب مباشرة في الجداول؛ يستدعي فقط دوالّ (RPC) محدودة.
--         القراءة للمدير فقط (مستخدم Auth مسجَّل بريده في جدول admins).
-- ════════════════════════════════════════════════════════════════════

-- 1) المديرون
create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security;            -- بلا سياسات = مغلق على الجميع (يُدار من لوحة Supabase فقط)

-- أضف بريدك (بعد إنشاء مستخدم بنفس البريد في Authentication ← Users):
-- insert into public.admins (email) values ('بريدك@example.com') on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 2) الجداول
create table if not exists public.visits (
  id bigint generated always as identity primary key,
  page text not null check (char_length(page) between 1 and 60),
  vid text check (char_length(vid) <= 40),
  is_new boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists visits_page_created_idx on public.visits (page, created_at);
create index if not exists visits_created_idx on public.visits (created_at);

create table if not exists public.presence (
  vid text primary key check (char_length(vid) <= 40),
  page text not null check (char_length(page) between 1 and 60),
  seen_at timestamptz not null default now()
);

create table if not exists public.agent_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 3 and 300),
  norm text not null,
  count int not null default 1,
  pages text[] not null default '{}',
  lang text not null default 'ar',
  status text not null default 'new' check (status in ('new', 'done')),
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);
create unique index if not exists agent_questions_open_norm on public.agent_questions (norm) where status = 'new';

alter table public.visits enable row level security;
alter table public.presence enable row level security;
alter table public.agent_questions enable row level security;

-- صلاحيات صريحة على الجداول: anon بلا أي صلاحية، والمستخدم المسجَّل يقرأ فقط (والسياسات أدناه تقصرها على المدير)
revoke all on public.visits, public.presence, public.agent_questions, public.admins from anon, authenticated;
grant select on public.visits, public.presence to authenticated;
grant select, update on public.agent_questions to authenticated;

-- 3) سياسات القراءة/التعديل للمدير فقط (anon بلا أي سياسة = ممنوع)
drop policy if exists "admin read visits" on public.visits;
create policy "admin read visits" on public.visits for select to authenticated using (public.is_admin());
drop policy if exists "admin read presence" on public.presence;
create policy "admin read presence" on public.presence for select to authenticated using (public.is_admin());
drop policy if exists "admin read questions" on public.agent_questions;
create policy "admin read questions" on public.agent_questions for select to authenticated using (public.is_admin());
drop policy if exists "admin update questions" on public.agent_questions;
create policy "admin update questions" on public.agent_questions for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 4) دوالّ يستدعيها الزوار (security definer + تحقق من الأطوال)
create or replace function public.track_hit(p_page text, p_vid text, p_new boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_page is null or char_length(p_page) not between 1 and 60 then return; end if;
  insert into public.visits (page, vid, is_new) values (p_page, left(p_vid, 40), coalesce(p_new, false));
end $$;

create or replace function public.track_ping(p_page text, p_vid text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_page is null or p_vid is null or char_length(p_page) not between 1 and 60 then return; end if;
  insert into public.presence (vid, page, seen_at) values (left(p_vid, 40), p_page, now())
  on conflict (vid) do update set page = excluded.page, seen_at = now();
end $$;

create or replace function public.log_question(p_q text, p_page text, p_lang text default 'ar') returns void
language plpgsql security definer set search_path = public as $$
declare n text;
begin
  p_q := btrim(coalesce(p_q, ''));
  if char_length(p_q) not between 3 and 300 then return; end if;
  n := btrim(regexp_replace(lower(p_q), '[^a-z0-9\u0621-\u064A\u066E-\u06D3\u0660-\u0669]+', ' ', 'g'));
  if n = '' then return; end if;
  insert into public.agent_questions (question, norm, pages, lang)
  values (p_q, n, array[left(coalesce(p_page, 'home'), 60)], left(coalesce(p_lang, 'ar'), 5))
  on conflict (norm) where status = 'new' do update
    set count = public.agent_questions.count + 1,
        last_at = now(),
        pages = (select array(select distinct unnest(public.agent_questions.pages || excluded.pages)));
end $$;

revoke all on function public.track_hit(text, text, boolean) from public;
revoke all on function public.track_ping(text, text) from public;
revoke all on function public.log_question(text, text, text) from public;
grant execute on function public.track_hit(text, text, boolean) to anon, authenticated;
grant execute on function public.track_ping(text, text) to anon, authenticated;
grant execute on function public.log_question(text, text, text) to anon, authenticated;

-- 5) دوالّ للمدير فقط (تُرجع JSON جاهزاً للوحة)
create or replace function public.admin_presence() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  select jsonb_build_object(
    'now', coalesce(sum(c), 0),
    'byPage', coalesce(jsonb_object_agg(page, c), '{}'::jsonb)
  ) into r
  from (select page, count(*)::int as c from public.presence where seen_at > now() - interval '75 seconds' group by page) t;
  return r;
end $$;

create or replace function public.admin_analytics() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  select jsonb_build_object(
    'total', (select count(*) from public.visits),
    'unique', (select count(*) from public.visits where is_new),
    'today', (select count(*) from public.visits where created_at >= date_trunc('day', now())),
    'pages', coalesce((select jsonb_object_agg(page, c) from (select page, count(*)::int as c from public.visits group by page) a), '{}'::jsonb),
    'todayPages', coalesce((select jsonb_object_agg(page, c) from (select page, count(*)::int as c from public.visits where created_at >= date_trunc('day', now()) group by page) b), '{}'::jsonb),
    'days', coalesce((select jsonb_object_agg(d, c) from (select to_char(created_at, 'YYYY-MM-DD') as d, count(*)::int as c from public.visits where created_at > now() - interval '30 days' group by 1) e), '{}'::jsonb)
  ) into r;
  return r;
end $$;

revoke all on function public.admin_presence() from public, anon;
revoke all on function public.admin_analytics() from public, anon;
grant execute on function public.admin_presence() to authenticated;
grant execute on function public.admin_analytics() to authenticated;

-- 6) تنظيف اختياري (يلزم تفعيل pg_cron من Database ← Extensions): يحذف النبضات والزيارات القديمة
-- select cron.schedule('ay-cleanup', '0 3 * * *', $$ delete from public.presence where seen_at < now() - interval '1 day'; delete from public.visits where created_at < now() - interval '400 days'; $$);

-- ════════════════════════════════════════════════════════════════════
-- 7) المرحلة 2: الطلبات (تُفعَّل من config.js بـ ORDERS_BACKEND = "both" ثم "supabase")
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.orders (
  id text primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 120),
  phone text not null check (char_length(phone) between 6 and 20),
  wilaya text, commune text, dtype text, desk text,
  items jsonb not null default '[]'::jsonb,
  items_text text not null default '',
  subtotal numeric not null default 0, fee numeric not null default 0, total numeric not null default 0,
  coupon text, discount numeric not null default 0,
  extra jsonb not null default '{}'::jsonb,
  status text not null default 'nouvelle' check (status in ('nouvelle', 'confirmee', 'expediee', 'livree', 'annulee', 'echec')),
  note text not null default '',
  source text not null default 'site'
);
-- حالة «echec» (فشل التوصيل): تحديث القيد على جدول موجود مسبقاً (آمن إعادة التشغيل)
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('nouvelle', 'confirmee', 'expediee', 'livree', 'annulee', 'echec'));
alter table public.orders add column if not exists customer_id uuid;      -- ربط الطلب بحساب زبون (اختياري)
alter table public.orders add column if not exists ip_hash text;          -- بصمة مجزّأة لعنوان IP (لا يُخزَّن العنوان نفسه) لمنع التكرار والإغراق
create index if not exists orders_ip_idx on public.orders (ip_hash, created_at);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_phone_idx on public.orders (phone, created_at);
alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant select, insert on public.orders to authenticated;
grant update (status, note) on public.orders to authenticated;
grant delete on public.orders to authenticated;                      -- حذف الطلبات من لوحة المدير (v1.89.54)
drop policy if exists "admin delete orders" on public.orders;
create policy "admin delete orders" on public.orders for delete to authenticated using (public.is_admin());
drop policy if exists "admin read orders" on public.orders;
create policy "admin read orders" on public.orders for select to authenticated using (public.is_admin());
drop policy if exists "admin import orders" on public.orders;
create policy "admin import orders" on public.orders for insert to authenticated with check (public.is_admin());
drop policy if exists "admin update orders" on public.orders;
create policy "admin update orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- إرسال طلب من الموقع: تحقق + حدّ للتكرار (5 طلبات لنفس الهاتف خلال 10 دقائق) ثم يُرجع رقم الطلب
create or replace function public.submit_order(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_id text; v_phone text; v_name text; v_items jsonb; v_text text; v_cust uuid; v_promo text; v_extra jsonb; g jsonb; v_ip text; v_iph text; v_ts bigint; v_slugs text[];
begin
  v_name := btrim(coalesce(p ->> 'name', ''));
  v_phone := regexp_replace(coalesce(p ->> 'phone', ''), '[^0-9+]', '', 'g');
  v_items := coalesce(p -> 'items', '[]'::jsonb);
  if char_length(v_name) not between 2 and 120 then raise exception 'invalid_name'; end if;
  if char_length(v_phone) not between 6 and 20 then raise exception 'invalid_phone'; end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) not between 1 and 50 then raise exception 'invalid_items'; end if;
  if coalesce((p ->> 'total')::numeric, -1) not between 0 and 10000000 then raise exception 'invalid_total'; end if;
  if (select count(*) from public.orders where phone = v_phone and created_at > now() - interval '10 minutes') >= 5 then raise exception 'rate_limited'; end if;

  -- حماية الطلبات (تُفعَّل من لوحة الإدارة ← نموذج الطلب): ضدّ الروبوتات والتكرار، بإعدادات تُقرأ من admin_kv('guard')
  v_ip := public._client_ip(); v_iph := public._ip_hash(v_ip);
  select coalesce(value, '{}'::jsonb) into g from public.admin_kv where key = 'guard';
  g := coalesce(g, '{}'::jsonb);
  if coalesce((g ->> 'antibot')::boolean, false) then
    if btrim(coalesce(p ->> 'hp', '')) <> '' then raise exception 'bot'; end if;                         -- حقل مخفي يملؤه الروبوت فقط
    begin v_ts := split_part(coalesce(p ->> 'ftok', ''), '.', 1)::bigint; exception when others then v_ts := null; end;
    if v_ts is null or split_part(p ->> 'ftok', '.', 2) <> public._guard_sig(v_ts::text)
       or extract(epoch from clock_timestamp())::bigint - v_ts not between 3 and 7200 then raise exception 'bot'; end if;   -- رمز موقَّع من الخادم، عمره بين 3 ثوانٍ وساعتين
    if public._cust_phone(v_phone) !~ (case when coalesce((g ->> 'phoneDz')::boolean, true) then '^0[567][0-9]{8}$' else '^0[1-9][0-9]{7,8}$' end) or public._cust_phone(v_phone) ~ '^0?(.)\1{7,}$' or v_name !~ '[[:alpha:]]' then raise exception 'invalid_phone'; end if;
    if v_iph is not null and (select count(*) from public.orders where ip_hash = v_iph and created_at > now() - interval '1 hour') >= 8 then raise exception 'rate_limited'; end if;
  end if;
  if coalesce((g ->> 'dup')::boolean, false) and v_iph is not null then
    select array_agg(distinct i ->> 'slug') into v_slugs from jsonb_array_elements(v_items) i where coalesce(i ->> 'slug', '') <> '';
    if v_slugs is not null and exists (
      select 1 from public.orders o, jsonb_array_elements(o.items) it
       where o.ip_hash = v_iph and o.status <> 'annulee' and o.created_at > now() - make_interval(hours => greatest(1, coalesce((g ->> 'hours')::int, 24)))
         and (it ->> 'slug') = any (v_slugs)) then raise exception 'duplicate_order'; end if;
  end if;

  select string_agg((i ->> 'title') || ' ×' || coalesce(i ->> 'qty', '1') || ' = ' || round(coalesce((i ->> 'price')::numeric, 0) * coalesce((i ->> 'qty')::numeric, 1)) || ' DA', E'\n')
    into v_text from jsonb_array_elements(v_items) i;
  v_id := 'S' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 5));
  v_extra := coalesce(p -> 'extra', '{}'::jsonb);
  -- كود تخفيض شخصي: يُستهلك مرة واحدة فقط ولصاحب الهاتف نفسه؛ إن لم يصلح لا يُرفض الطلب بل يُعلَّم في extra ليراه المدير
  v_promo := upper(btrim(coalesce(p ->> 'promo', '')));
  if v_promo <> '' then
    update public.promo_codes set used_order = v_id, used_at = now()
     where code = v_promo and used_order is null and expires_at > now() and phone = public._cust_phone(v_phone);
    if not found then v_extra := v_extra || jsonb_build_object('promo_invalid', v_promo); end if;
  end if;
  v_cust := public._cust_from_token(p ->> 'ctoken');                      -- null إن لم يكن الزبون مسجّلاً
  insert into public.orders (id, name, phone, wilaya, commune, dtype, desk, items, items_text, subtotal, fee, total, coupon, discount, extra, customer_id, ip_hash)
  values (v_id, v_name, v_phone, left(p ->> 'wilaya', 80), left(p ->> 'commune', 120), left(p ->> 'dtype', 10), left(p ->> 'desk', 160),
          v_items, coalesce(v_text, ''), coalesce((p ->> 'subtotal')::numeric, 0), coalesce((p ->> 'fee')::numeric, 0), (p ->> 'total')::numeric,
          left(p ->> 'coupon', 40), coalesce((p ->> 'discount')::numeric, 0), v_extra, v_cust, v_iph);
  return v_id;
end $$;
revoke all on function public.submit_order(jsonb) from public;
grant execute on function public.submit_order(jsonb) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- حسابات الزبائن («حسابي»): تسجيل برقم الهاتف + كلمة سر. لا يصل الزوار إلى الجداول إطلاقاً، بل إلى الدوال أدناه فقط.
-- الطلبات المعروضة للزبون هي المربوطة بحسابه فقط (عند الطلب وهو مسجّل، أو بربط طلب سابق برقمه + رقم الطلب)،
-- فلا يستطيع أحد رؤية طلبات رقم هاتف ليس له بمجرد تسجيله به.
-- ════════════════════════════════════════════════════════════════════
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (char_length(phone) between 9 and 10),
  name text not null check (char_length(name) between 2 and 120),
  wilaya text, commune text,
  pass_hash text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.customer_sessions (
  token_hash text primary key,
  customer_id uuid not null references public.customers (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.customer_fails (phone text not null, at timestamptz not null default now());
create index if not exists customer_fails_idx on public.customer_fails (phone, at);
alter table public.customers enable row level security;
alter table public.customer_sessions enable row level security;
alter table public.customer_fails enable row level security;
revoke all on public.customers, public.customer_sessions, public.customer_fails from anon, authenticated;
grant select on public.customers to authenticated;
drop policy if exists "admin read customers" on public.customers;
create policy "admin read customers" on public.customers for select to authenticated using (public.is_admin());

-- رقم هاتف جزائري بصيغة موحّدة 0XXXXXXXXX (يقبل +213 / 00213 / 213)
create or replace function public._cust_phone(x text) returns text
language sql immutable as $$
  select case
    when d like '00213%' then '0' || substr(d, 6)
    when d like '213%' and char_length(d) >= 12 then '0' || substr(d, 4)
    when d ~ '^[567]' and char_length(d) = 9 then '0' || d
    else d end
  from (select regexp_replace(coalesce(x, ''), '[^0-9]', '', 'g') as d) t
$$;

create or replace function public._cust_from_token(t text) returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select s.customer_id from public.customer_sessions s
  where t is not null and char_length(t) = 48
    and s.token_hash = encode(extensions.digest(t, 'sha256'), 'hex')
    and s.created_at > now() - interval '180 days'
$$;

create or replace function public._cust_new_session(cid uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  insert into public.customer_sessions (token_hash, customer_id) values (encode(extensions.digest(t, 'sha256'), 'hex'), cid);
  delete from public.customer_sessions where customer_id = cid and created_at < now() - interval '180 days';
  return t;
end $$;

create or replace function public._cust_profile(cid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', name, 'phone', phone, 'wilaya', coalesce(wilaya, ''), 'commune', coalesce(commune, '')) from public.customers where id = cid
$$;

create or replace function public.customer_register(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_phone text := public._cust_phone(p ->> 'phone'); v_name text := btrim(coalesce(p ->> 'name', '')); v_pw text := coalesce(p ->> 'password', ''); cid uuid;
begin
  if char_length(v_name) not between 2 and 120 then raise exception 'invalid_name'; end if;
  if v_phone !~ '^0[567][0-9]{8}$' and v_phone !~ '^0[0-9]{8}$' then raise exception 'invalid_phone'; end if;
  if char_length(v_pw) not between 6 and 72 then raise exception 'invalid_password'; end if;
  if (select count(*) from public.customers where created_at > now() - interval '1 hour') >= 60 then raise exception 'rate_limited'; end if;
  if exists (select 1 from public.customers where phone = v_phone) then raise exception 'phone_taken'; end if;
  insert into public.customers (phone, name, wilaya, commune, pass_hash)
  values (v_phone, left(v_name, 120), left(p ->> 'wilaya', 80), left(p ->> 'commune', 120), extensions.crypt(v_pw, extensions.gen_salt('bf', 8)))
  returning id into cid;
  return jsonb_build_object('token', public._cust_new_session(cid), 'profile', public._cust_profile(cid));
end $$;

create or replace function public.customer_login(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_phone text := public._cust_phone(p ->> 'phone'); c public.customers;
begin
  delete from public.customer_fails where at < now() - interval '1 day';
  if (select count(*) from public.customer_fails where phone = v_phone and at > now() - interval '10 minutes') >= 5 then raise exception 'too_many_attempts'; end if;
  select * into c from public.customers where phone = v_phone;
  if c.id is null or c.pass_hash <> extensions.crypt(coalesce(p ->> 'password', ''), c.pass_hash) then
    insert into public.customer_fails (phone) values (v_phone);
    return jsonb_build_object('error', 'invalid_credentials');      -- تُرجَع قيمة لا استثناء حتى لا يُلغى تسجيل المحاولة الفاشلة
  end if;
  return jsonb_build_object('token', public._cust_new_session(c.id), 'profile', public._cust_profile(c.id));
end $$;

create or replace function public.customer_me(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := public._cust_from_token(p ->> 'token');
begin
  if cid is null then raise exception 'unauthorized'; end if;
  return jsonb_build_object('profile', public._cust_profile(cid), 'orders', coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'date', created_at, 'items', items_text, 'total', total, 'status', status,
             'tracking', coalesce(substring(note from '🚚[a-z0-9_]+:([A-Za-z0-9._-]+)'), '')) order by created_at desc)
    from (select * from public.orders where customer_id = cid order by created_at desc limit 50) o), '[]'::jsonb));
end $$;

create or replace function public.customer_update(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare cid uuid := public._cust_from_token(p ->> 'token'); v_name text := btrim(coalesce(p ->> 'name', ''));
begin
  if cid is null then raise exception 'unauthorized'; end if;
  if char_length(v_name) not between 2 and 120 then raise exception 'invalid_name'; end if;
  update public.customers set name = v_name, wilaya = left(p ->> 'wilaya', 80), commune = left(p ->> 'commune', 120) where id = cid;
  if coalesce(p ->> 'new_password', '') <> '' then
    if char_length(p ->> 'new_password') not between 6 and 72 then raise exception 'invalid_password'; end if;
    update public.customers set pass_hash = extensions.crypt(p ->> 'new_password', extensions.gen_salt('bf', 8)) where id = cid
      and pass_hash = extensions.crypt(coalesce(p ->> 'old_password', ''), pass_hash);
    if not found then raise exception 'invalid_credentials'; end if;
  end if;
  return public._cust_profile(cid);
end $$;

create or replace function public.customer_logout(p jsonb) returns void
language sql security definer set search_path = public, extensions as $$
  delete from public.customer_sessions where token_hash = encode(extensions.digest(coalesce(p ->> 'token', ''), 'sha256'), 'hex')
$$;

-- ربط طلب سابق (قبل التسجيل) بالحساب: رقم الطلب أو رقم التتبع + نفس رقم هاتف الحساب
create or replace function public.customer_link_order(p jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare cid uuid := public._cust_from_token(p ->> 'token'); ph text; k text := btrim(coalesce(p ->> 'order_id', ''));
begin
  if cid is null then raise exception 'unauthorized'; end if;
  select phone into ph from public.customers where id = cid;
  update public.orders set customer_id = cid
   where (id = upper(k) or substring(note from '🚚[a-z0-9_]+:([A-Za-z0-9._-]+)') = k)
     and (customer_id is null or customer_id = cid) and public._cust_phone(phone) = ph;
  return found;                                   -- true أيضاً إن كان مربوطاً بحسابه من قبل
end $$;

-- تتبّع عام برقم التتبع (بلا تسجيل): لا يُرجع إلا الحالة والولاية والبلدية، لا هاتف ولا عنوان ولا اسم
create table if not exists public.track_fails (at timestamptz not null default now());
alter table public.track_fails enable row level security;
revoke all on public.track_fails from anon, authenticated;
create or replace function public.track_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t text := btrim(coalesce(p ->> 'tracking', '')); o record;
begin
  if t !~ '^[A-Za-z0-9._-]{4,40}$' then return jsonb_build_object('found', false); end if;
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
revoke all on function public.track_order(jsonb) from public;
grant execute on function public.track_order(jsonb) to anon, authenticated;

revoke all on function public._cust_from_token(text), public._cust_new_session(uuid), public._cust_profile(uuid) from public, anon, authenticated;
revoke all on function public.customer_register(jsonb), public.customer_login(jsonb), public.customer_me(jsonb), public.customer_update(jsonb), public.customer_logout(jsonb), public.customer_link_order(jsonb) from public;
grant execute on function public.customer_register(jsonb), public.customer_login(jsonb), public.customer_me(jsonb), public.customer_update(jsonb), public.customer_logout(jsonb), public.customer_link_order(jsonb) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- تخزين خاص بالمدير (أسعار التكلفة، إعدادات الأرباح، سجل المخزون): للمدير فقط، لا يصل إليه الزوار إطلاقاً
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.admin_kv (key text primary key, value jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
alter table public.admin_kv enable row level security;
revoke all on public.admin_kv from anon, authenticated;
grant select, insert, update on public.admin_kv to authenticated;
drop policy if exists "admin kv" on public.admin_kv;
create policy "admin kv" on public.admin_kv for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ════════════════════════════════════════════════════════════════════
-- أكواد تخفيض شخصية (إعادة الشراء): كل كود لرقم هاتف واحد ويُستعمل مرة واحدة وله صلاحية. لا تُنشر في ملف عام.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.promo_codes (
  code text primary key,
  phone text not null,
  type text not null check (type in ('percent', 'fixed', 'freeship')),
  value numeric not null default 0,
  min_order numeric not null default 0,
  expires_at timestamptz not null,
  used_order text, used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists promo_codes_phone_idx on public.promo_codes (phone);
alter table public.promo_codes add column if not exists kind text;       -- reg | install: هدايا الترحيب (كود واحد لكل زبون ونوع)
alter table public.promo_codes add column if not exists product text;    -- منتج الهدية عندما يكون النوع gift
alter table public.promo_codes drop constraint if exists promo_codes_type_check;
alter table public.promo_codes add constraint promo_codes_type_check check (type in ('percent', 'fixed', 'freeship', 'gift'));
create unique index if not exists promo_codes_kind_uq on public.promo_codes (phone, kind) where kind is not null;
alter table public.promo_codes enable row level security;
revoke all on public.promo_codes from anon, authenticated;
grant select, insert, update, delete on public.promo_codes to authenticated;
drop policy if exists "admin promo" on public.promo_codes;
create policy "admin promo" on public.promo_codes for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.promo_fails (at timestamptz not null default now());
alter table public.promo_fails enable row level security;
revoke all on public.promo_fails from anon, authenticated;

-- فحص الكود قبل تطبيقه في الموقع: يُرجع نوع الخصم وقيمته فقط إن كان الكود لهذا الهاتف وغير مستعمل وصالحاً
create or replace function public.validate_promo(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.promo_codes; v_code text := upper(btrim(coalesce(p ->> 'code', ''))); v_phone text := public._cust_phone(p ->> 'phone');
begin
  delete from public.promo_fails where at < now() - interval '1 hour';
  if (select count(*) from public.promo_fails where at > now() - interval '10 minutes') >= 60 then raise exception 'rate_limited'; end if;
  select * into c from public.promo_codes where code = v_code and phone = v_phone;
  if c.code is null then insert into public.promo_fails default values; return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if c.used_order is not null then return jsonb_build_object('ok', false, 'error', 'used'); end if;
  if c.expires_at <= now() then return jsonb_build_object('ok', false, 'error', 'expired'); end if;
  return jsonb_build_object('ok', true, 'type', c.type, 'value', c.value, 'minOrder', c.min_order, 'expiresAt', c.expires_at, 'product', coalesce(c.product, ''));
end $$;
revoke all on function public.validate_promo(jsonb) from public;
grant execute on function public.validate_promo(jsonb) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- أدوات حماية الطلبات: سرّ داخلي، رمز نموذج موقَّع، وبصمة IP مجزّأة
-- ════════════════════════════════════════════════════════════════════
create or replace function public._guard_secret() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v text;
begin
  select value #>> '{}' into v from public.admin_kv where key = 'guard_secret';
  if v is null then
    v := encode(extensions.gen_random_bytes(24), 'hex');
    insert into public.admin_kv (key, value) values ('guard_secret', to_jsonb(v)) on conflict (key) do nothing;
    select value #>> '{}' into v from public.admin_kv where key = 'guard_secret';
  end if;
  return v;
end $$;
create or replace function public._guard_sig(t text) returns text
language sql security definer set search_path = public, extensions as $$ select encode(extensions.hmac(t, public._guard_secret(), 'sha256'), 'hex') $$;
create or replace function public._client_ip() returns text
language sql stable as $$
  select nullif(btrim(coalesce(current_setting('request.headers', true)::json ->> 'cf-connecting-ip', split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1), '')), '')
$$;
create or replace function public._ip_hash(ip text) returns text
language sql security definer set search_path = public, extensions as $$
  select case when ip is null then null else left(encode(extensions.hmac(ip, public._guard_secret(), 'sha256'), 'hex'), 24) end
$$;
-- رمز يطلبه الموقع عند فتح الصفحة؛ الطلب لا يُقبل إلا برمز موقَّع عمره بين 3 ثوانٍ وساعتين (لا يعمل مع سكربت يرسل مباشرة)
create or replace function public.form_token() returns text
language sql security definer set search_path = public as $$
  select t || '.' || public._guard_sig(t) from (select extract(epoch from clock_timestamp())::bigint::text as t) x
$$;
revoke all on function public._guard_secret(), public._guard_sig(text), public._ip_hash(text), public._client_ip() from public, anon, authenticated;
revoke all on function public.form_token() from public;
grant execute on function public.form_token() to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- هدايا الترحيب كأكواد شخصية: عند التسجيل (reg) أو أول فتح للتطبيق المثبّت (install)، لكل زبون كود واحد من كل نوع.
-- الإعدادات من admin_kv('welcome') (تحفظها لوحة الإدارة). الكود لهاتف صاحب الحساب فقط ويُستعمل مرة واحدة.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.customer_claim_gift(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare cid uuid := public._cust_from_token(p ->> 'token'); ph text; k text := coalesce(p ->> 'kind', ''); w jsonb; g jsonb; c public.promo_codes; v_code text;
begin
  if cid is null then raise exception 'unauthorized'; end if;
  if k not in ('reg', 'install') then raise exception 'invalid_kind'; end if;
  select phone into ph from public.customers where id = cid;
  select value into w from public.admin_kv where key = 'welcome';
  g := case k when 'reg' then w -> 'register' else w -> 'install' end;
  if w is null or coalesce((w ->> 'enabled')::boolean, true) = false or g is null or coalesce((g ->> 'enabled')::boolean, true) = false then return jsonb_build_object('ok', false, 'error', 'disabled'); end if;
  select * into c from public.promo_codes where phone = ph and kind = k;
  if c.code is null then
    v_code := case k when 'reg' then 'WEL-' else 'APP-' end || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 6));
    insert into public.promo_codes (code, phone, type, value, min_order, expires_at, kind, product)
    values (v_code, ph, coalesce(g ->> 'type', 'percent'), coalesce((g ->> 'value')::numeric, 0), coalesce((g ->> 'minOrder')::numeric, 0),
            now() + make_interval(days => greatest(1, coalesce((g ->> 'days')::int, 14))), k, nullif(g ->> 'product', ''))
    on conflict do nothing;
    select * into c from public.promo_codes where phone = ph and kind = k;
  end if;
  return jsonb_build_object('ok', true, 'code', c.code, 'type', c.type, 'value', c.value, 'minOrder', c.min_order, 'product', coalesce(c.product, ''), 'expiresAt', c.expires_at, 'used', c.used_order is not null);
end $$;

create or replace function public.customer_my_gifts(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := public._cust_from_token(p ->> 'token'); ph text;
begin
  if cid is null then raise exception 'unauthorized'; end if;
  select phone into ph from public.customers where id = cid;
  return coalesce((select jsonb_object_agg(kind, jsonb_build_object('code', code, 'type', type, 'value', value, 'minOrder', min_order, 'product', coalesce(product, ''), 'expiresAt', expires_at, 'used', used_order is not null))
                     from public.promo_codes where phone = ph and kind is not null), '{}'::jsonb);
end $$;
revoke all on function public.customer_claim_gift(jsonb), public.customer_my_gifts(jsonb) from public;
grant execute on function public.customer_claim_gift(jsonb), public.customer_my_gifts(jsonb) to anon, authenticated;
