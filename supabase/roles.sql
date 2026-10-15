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
  role text not null default 'agent' check (role in ('manager', 'agent', 'support', 'accountant', 'warehouse')),
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
  select coalesce(substring(n from '📞[0-9]+'), '') || case when position('⏰' in coalesce(n, '')) > 0 then '⏰' else '' end || case when position('📵' in coalesce(n, '')) > 0 then '📵' else '' end || case when position('📅' in coalesce(n, '')) > 0 then '📅' else '' end || case when position('🏠' in coalesce(n, '')) > 0 then '🏠' else '' end;
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
      perform public._audit('order.status', new.id::text, jsonb_build_object('from', old.status, 'to', new.status) || case when new.status = 'annulee' and new.note ~ '❌سبب:' then jsonb_build_object('reason', substring(new.note from '❌سبب:([^ ]+)')) else '{}'::jsonb end);
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

-- 5b) أداء الاتصال (v1.89.167): زمن أول استجابة لكل طلب (أول نتيجة اتصال/حالة بعد وصوله ينسبها لصاحبها)، حصيلة اليوم، أسباب الإلغاء،
--     والهدف اليومي من admin_kv (مفتاح callgoal) — المالك يرى الجميع والموظف نفسه فقط
create or replace function public.audit_perf(p_days int default 7) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me text := lower(coalesce(auth.jwt() ->> 'email', '')); own boolean := public.is_admin();
        d int := greatest(1, least(coalesce(p_days, 7), 90)); t0 timestamptz := (date_trunc('day', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers');
begin
  if not own and not exists (select 1 from public.staff where lower(email) = me and active) then raise exception 'unauthorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'goal', coalesce((select value from public.admin_kv where key = 'callgoal'), '{}'::jsonb),
    'rows', coalesce((select jsonb_agg(x) from (
      select f.actor, count(*)::int as orders,
             round(avg(extract(epoch from (f.at - o.created_at)) / 60)::numeric, 1) as avg_min,
             round((percentile_cont(0.5) within group (order by extract(epoch from (f.at - o.created_at)) / 60))::numeric, 1) as med_min,
             round(100.0 * count(*) filter (where f.at - o.created_at <= interval '15 minutes') / count(*), 0)::int as fast_pct
      from (select distinct on (ref) ref, actor, at from public.audit_log
            where action in ('order.call', 'order.status') and at > now() - make_interval(days => d) and role <> '' order by ref, at) f
      join public.orders o on o.id = f.ref
      where f.at >= o.created_at and f.at - o.created_at < interval '7 days' and (own or f.actor = me)
      group by f.actor) x), '[]'::jsonb),
    'today', coalesce((select jsonb_agg(x) from (
      select actor, count(*) filter (where detail ->> 'to' = 'confirmee')::int as conf, count(*) filter (where detail ->> 'to' = 'annulee')::int as canc
      from public.audit_log where action = 'order.status' and at >= t0 and (own or actor = me) group by actor) x), '[]'::jsonb),
    'reasons', coalesce((select jsonb_agg(x) from (
      select actor, detail ->> 'reason' as reason, count(*)::int as n from public.audit_log
      where action = 'order.status' and detail ->> 'to' = 'annulee' and detail ? 'reason' and at > now() - make_interval(days => d) and (own or actor = me)
      group by actor, detail ->> 'reason') x), '[]'::jsonb));
end $$;
revoke all on function public.audit_perf(int) from public;
grant execute on function public.audit_perf(int) to authenticated;

-- 6) المالية للقراءة: الموظف بصلاحية finance يقرأ مفاتيح المالية فقط من التخزين الخاص (الكتابة للمالك وحده)
drop policy if exists "staff finance read kv" on public.admin_kv;
create policy "staff finance read kv" on public.admin_kv for select to authenticated
  using (key in ('costs', 'finset', 'stockcfg', 'stocklog', 'ydfees', 'ydactual', 'adcfg', 'costcalc', 'costmats', 'recipes') and public.has_perm('finance'));

-- 7) أمين المخزن (v1.89.239): صلاحية pack فقط — لا يقرأ جدول الطلبات (لا سياسة له) بل دالتين تُرجعان ما يلزم للتجهيز:
--    الطلبات المؤكَّدة/المرسَلة بلا هاتف ولا أسعار ولا مالية. علامة 🧰 في الملاحظة = «جُهِّز».
alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check check (role in ('manager', 'agent', 'support', 'accountant', 'warehouse'));

create or replace function public.pack_orders() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm('pack') then raise exception 'unauthorized' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'date', o.created_at, 'name', o.name, 'wilaya', o.wilaya, 'commune', o.commune, 'dtype', o.dtype, 'desk', o.desk,
      'items', o.items_text, 'status', o.status,
      'company', case when position(':' in o.sh) > 0 then split_part(o.sh, ':', 1) else '' end,
      'tracking', case when position(':' in o.sh) > 0 then substr(o.sh, position(':' in o.sh) + 1) else o.sh end,
      'packed', position('🧰' in o.note) > 0) order by o.created_at desc)
    from (select t.*, coalesce(substring(t.note from '🚚(\S+)'), '') as sh from public.orders t
          where t.status in ('confirmee', 'expediee') and position('🗑' in t.note) = 0 order by t.created_at desc limit 300) o), '[]'::jsonb);
end $$;
revoke all on function public.pack_orders() from public;
grant execute on function public.pack_orders() to authenticated;

create or replace function public.pack_mark(p_id text, p_undo boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur text; clean text; nw text;
begin
  if not public.has_perm('pack') then raise exception 'unauthorized' using errcode = '42501'; end if;
  select note into cur from public.orders where id = p_id and status in ('confirmee', 'expediee');
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  clean := btrim(regexp_replace(coalesce(cur, ''), '🧰\S*\s*', '', 'g'));
  nw := case when p_undo then clean else btrim(clean || ' 🧰@' || to_char(now() at time zone 'Africa/Algiers', 'YYYY-MM-DD')) end;
  if nw is distinct from cur then
    update public.orders set note = left(nw, 500) where id = p_id;
    if not p_undo then perform public._audit('order.packed', p_id, '{}'); end if;
  end if;
  return jsonb_build_object('ok', true, 'packed', not p_undo);
end $$;
revoke all on function public.pack_mark(text, boolean) from public;
grant execute on function public.pack_mark(text, boolean) to authenticated;
