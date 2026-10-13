-- ════════════════════════════════════════════════════════════════════
-- الأدوار (فريق العمل) + المصادقة الثنائية TOTP + سجلّ التدقيق — v1.89.155
-- التشغيل: SQL Editor ← الصق الملف كاملاً ← Run (آمن لإعادة التشغيل؛ لا يمسّ بيانات قائمة).
-- المبدأ: المالك = من في جدول admins (كما كان). الموظف = صف نشط في staff بصلاحيات نصية.
--         الفرض في الخادم: سياسات RLS + محفّز يحصر ما يعدّله الموظف + سجلّ لا يُكتب إلا من الخادم.
--         المصادقة الثنائية: متى سجّل حساب عاملاً TOTP (Supabase Auth MFA) لا يُقبل إلا بجلسة aal2.
-- ════════════════════════════════════════════════════════════════════

-- 1) المصادقة الثنائية: الجلسة مقبولة إن كانت aal2 أو إن لم يكن للحساب عامل TOTP مؤكَّد
create or replace function public._aal_ok() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke all on function public._aal_ok() from public;
grant execute on function public._aal_ok() to anon, authenticated;

-- المالك (جدول admins) + شرط المصادقة الثنائية
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))) and public._aal_ok();
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 2) الموظفون
create table if not exists public.staff (
  email text primary key,
  name text not null default '',
  role text not null default 'agent' check (role in ('manager', 'agent', 'support', 'accountant')),
  perms text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by text not null default ''
);
alter table public.staff enable row level security;               -- بلا سياسات: تُدار عبر دالة staff-admin (خادم) فقط

create or replace function public._staff_row() returns public.staff
language sql stable security definer set search_path = public as $$
  select s.* from public.staff s where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and s.active and public._aal_ok() limit 1;
$$;
revoke all on function public._staff_row() from public;
grant execute on function public._staff_row() to authenticated;

-- هل لصاحب الجلسة الصلاحية p؟ (المالك لديه كل شيء)
create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public._staff_row() r where p = any (r.perms));
$$;
revoke all on function public.has_perm(text) from public;
grant execute on function public.has_perm(text) to anon, authenticated;

-- هويتي: {owner, role, name, email, perms[], mfa, aal} — بلا دور = ليس لديه وصول
create or replace function public.staff_me() returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare r public.staff; o boolean; mfa boolean;
begin
  if auth.uid() is null then return jsonb_build_object('role', null); end if;
  select exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified') into mfa;
  o := public.is_admin();
  if o then return jsonb_build_object('role', 'owner', 'owner', true, 'email', auth.jwt() ->> 'email', 'name', '', 'perms', jsonb_build_array('*'), 'mfa', mfa, 'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')); end if;
  select * into r from public._staff_row();
  if r.email is null then return jsonb_build_object('role', null, 'mfa', mfa, 'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')); end if;
  return jsonb_build_object('role', r.role, 'owner', false, 'email', r.email, 'name', r.name, 'perms', to_jsonb(r.perms), 'mfa', mfa, 'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'));
end $$;
revoke all on function public.staff_me() from public;
grant execute on function public.staff_me() to authenticated;

-- 3) سجلّ التدقيق — لا كتابة مباشرة أبداً (محفّزات/دوال الخادم فقط)، والقراءة للمالك
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null default '',
  role text not null default '',
  action text not null,
  ref text not null default '',
  detail jsonb not null default '{}'
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor, at desc);
alter table public.audit_log enable row level security;
drop policy if exists "owner read audit" on public.audit_log;
create policy "owner read audit" on public.audit_log for select to authenticated using (public.is_admin());

create or replace function public._actor_role() returns text
language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public.admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))) then 'owner'
              else coalesce((select role from public.staff where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1), '') end;
$$;
revoke all on function public._actor_role() from public;

create or replace function public._audit(a text, r text, d jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public._actor_role() = '' then return; end if;      -- الزوار والزبائن المسجَّلون لا تُسجَّل أفعالهم هنا (المالك والموظفون فقط)
  insert into public.audit_log (actor, role, action, ref, detail) values (lower(coalesce(auth.jwt() ->> 'email', '')), public._actor_role(), a, coalesce(r, ''), coalesce(d, '{}'));
end $$;
revoke all on function public._audit(text, text, jsonb) from public;

-- أحداث تسجّلها اللوحة (دخول/خروج/تغيير الأمان) — قائمة بيضاء ومحدودة
create or replace function public.audit_event(p_action text, p_ref text default '', p_detail jsonb default '{}') returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_action not in ('login', 'logout', 'mfa.enroll', 'mfa.disable', 'mfa.verify_fail') then raise exception 'bad_action' using errcode = '22023'; end if;
  if not (public.is_admin() or exists (select 1 from public.staff where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and active)) then
    -- فشل المصادقة الثنائية يُسجَّل حتى قبل بلوغ aal2 لمن له حساب في admins أو staff
    if p_action <> 'mfa.verify_fail' or public._actor_role() = '' then raise exception 'unauthorized' using errcode = '42501'; end if;
  end if;
  perform public._audit(p_action, left(coalesce(p_ref, ''), 80), case when jsonb_typeof(p_detail) = 'object' then p_detail else '{}'::jsonb end);
end $$;
revoke all on function public.audit_event(text, text, jsonb) from public;
grant execute on function public.audit_event(text, text, jsonb) to authenticated;

-- 4) الطلبات: سياسات الموظفين + محفّز يحصر ما يعدّلونه + تدقيق
drop policy if exists "staff read orders" on public.orders;
create policy "staff read orders" on public.orders for select to authenticated using (public.has_perm('orders'));
drop policy if exists "staff update orders" on public.orders;
create policy "staff update orders" on public.orders for update to authenticated using (public.has_perm('orders.write')) with check (public.has_perm('orders.write'));
drop policy if exists "staff insert orders" on public.orders;
create policy "staff insert orders" on public.orders for insert to authenticated with check (public.has_perm('orders.create'));
drop policy if exists "staff delete orders" on public.orders;
create policy "staff delete orders" on public.orders for delete to authenticated using (public.has_perm('orders.delete'));

create or replace function public._call_marks(n text) returns text
language sql immutable as $$
  select coalesce(substring(n from '📞[0-9]+'), '') || case when position('⏰' in coalesce(n, '')) > 0 then '⏰' else '' end || case when position('📵' in coalesce(n, '')) > 0 then '📵' else '' end;
$$;

create or replace function public.orders_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare edited boolean;
begin
  if auth.uid() is null then return coalesce(new, old); end if;                   -- الخادم/الإدارة العليا
  if tg_op = 'UPDATE' then
    edited := (to_jsonb(new) - 'status' - 'note') is distinct from (to_jsonb(old) - 'status' - 'note');
    if edited and not public.is_admin() and not public.has_perm('orders.edit') then
      raise exception 'forbidden: orders.edit' using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      perform public._audit('order.status', new.id::text, jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    if public._call_marks(new.note) is distinct from public._call_marks(old.note) then
      perform public._audit('order.call', new.id::text, jsonb_build_object('from', public._call_marks(old.note), 'to', public._call_marks(new.note)));
    end if;
    if edited then perform public._audit('order.edit', new.id::text, '{}'); end if;
    return new;
  elsif tg_op = 'INSERT' then
    perform public._audit('order.create', new.id::text, jsonb_build_object('source', new.source));
    return new;
  else
    perform public._audit('order.delete', old.id::text, '{}');
    return old;
  end if;
end $$;
drop trigger if exists orders_guard on public.orders;
create trigger orders_guard before insert or update or delete on public.orders for each row execute function public.orders_guard();

-- 5) إحصاءات الفريق: المالك يرى الجميع، والموظف نفسه فقط
create or replace function public.audit_stats(p_days int default 7) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me text := lower(coalesce(auth.jwt() ->> 'email', '')); own boolean := public.is_admin();
begin
  if not own and not exists (select 1 from public.staff where lower(email) = me and active) then raise exception 'unauthorized' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x) from (
    select actor, role, action, coalesce(detail ->> 'to', '') as to_status, count(*)::int as n, max(at) as last_at
    from public.audit_log
    where at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)))
      and action in ('order.status', 'order.call', 'order.edit', 'order.create', 'order.delete', 'login')
      and (own or actor = me)
    group by actor, role, action, coalesce(detail ->> 'to', '')
    order by actor, action
  ) x), '[]'::jsonb);
end $$;
revoke all on function public.audit_stats(int) from public;
grant execute on function public.audit_stats(int) to authenticated;
