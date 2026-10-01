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
