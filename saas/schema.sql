-- ════════════════════════════════════════════════════════════════════
-- منصة أليسوم SaaS — لوحة المزوّد: الزبائن + المواقع + طلبات الدعم/الإنشاء + التحليلات
-- التشغيل: Supabase ← SQL Editor ← New query ← الصق الملف كاملاً ← Run (آمن لإعادة التشغيل).
-- المبدأ: لوحات الزبائن (anon) تستدعي دوالّ محدودة فقط (إرسال طلب، متابعة طلبها برمزه السرّي، نبضة موقع)؛
--         ولا تقرأ أي جدول. القراءة والكتابة الكاملة لمدير المنصة فقط (بريده في saas_admins).
-- ════════════════════════════════════════════════════════════════════

-- 1) مدراء المنصة
create table if not exists public.saas_admins (
  email text primary key,
  name text,
  role text not null default 'owner'
);
alter table public.saas_admins enable row level security;     -- بلا سياسات = مغلق (يُدار من SQL Editor فقط)

create or replace function public.is_saas_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.saas_admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function public.is_saas_admin() from public;
grant execute on function public.is_saas_admin() to anon, authenticated;

-- 2) الجداول
create table if not exists public.saas_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text check (char_length(email) <= 160),
  phone text check (char_length(phone) <= 40),
  plan text not null default 'free' check (char_length(plan) <= 30),
  status text not null default 'active' check (status in ('lead', 'active', 'suspended', 'churned')),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saas_sites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.saas_customers (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  sub text check (char_length(sub) <= 40),                     -- الاسم على دومين المنصة
  origin text unique check (char_length(origin) <= 200),       -- أصل لوحة الموقع (https://host)
  domain_mode text not null default 'platform' check (domain_mode in ('platform', 'own', 'request')),
  domain text check (char_length(domain) <= 120),
  domain_status text not null default 'none' check (domain_status in ('none', 'requested', 'dns_ready', 'connected', 'rejected')),
  dns jsonb not null default '{}'::jsonb,
  status text not null default 'requested' check (status in ('requested', 'provisioning', 'active', 'suspended', 'deleting', 'deleted')),
  plan text check (char_length(plan) <= 30),
  deletion_at timestamptz,
  version text check (char_length(version) <= 20),
  last_seen timestamptz,
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz
);
create unique index if not exists saas_sites_sub_uq on public.saas_sites (sub) where sub is not null and status <> 'deleted';
create index if not exists saas_sites_customer_idx on public.saas_sites (customer_id);
create index if not exists saas_sites_status_idx on public.saas_sites (status);

create table if not exists public.saas_tickets (
  id uuid primary key default gen_random_uuid(),               -- هو أيضاً الرمز السرّي الذي يتابع به الزبون طلبه
  num bigint generated always as identity,
  kind text not null check (kind in ('site_create', 'site_delete', 'site_delete_cancel', 'domain_request', 'domain_link', 'domain_dns', 'support', 'billing', 'other')),
  status text not null default 'new' check (status in ('new', 'open', 'waiting', 'resolved', 'rejected')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null default '' check (char_length(body) <= 6000),
  payload jsonb not null default '{}'::jsonb,
  site_id uuid references public.saas_sites (id) on delete set null,
  customer_id uuid references public.saas_customers (id) on delete set null,
  origin text,
  contact jsonb not null default '{}'::jsonb,
  assignee text,
  admin_read boolean not null default false,
  first_response_at timestamptz,
  resolved_at timestamptz,
  last_customer_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saas_tickets_status_idx on public.saas_tickets (status, created_at desc);
create index if not exists saas_tickets_site_idx on public.saas_tickets (site_id);
create index if not exists saas_tickets_customer_idx on public.saas_tickets (customer_id);
create index if not exists saas_tickets_created_idx on public.saas_tickets (created_at);

create table if not exists public.saas_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.saas_tickets (id) on delete cascade,
  author text not null check (author in ('customer', 'admin', 'system')),
  body text not null check (char_length(body) between 1 and 6000),
  internal boolean not null default false,                     -- ملاحظة داخلية لا يراها الزبون
  created_at timestamptz not null default now()
);
create index if not exists saas_messages_ticket_idx on public.saas_messages (ticket_id, created_at);

-- 3) الأمان: الزبائن (anon) بلا أي صلاحية على الجداول؛ المدير فقط بسياسات RLS
alter table public.saas_customers enable row level security;
alter table public.saas_sites enable row level security;
alter table public.saas_tickets enable row level security;
alter table public.saas_messages enable row level security;
revoke all on public.saas_customers, public.saas_sites, public.saas_tickets, public.saas_messages from anon, authenticated;
grant select, insert, update, delete on public.saas_customers, public.saas_sites, public.saas_tickets, public.saas_messages to authenticated;

do $$ declare t text; begin
  foreach t in array array['saas_customers', 'saas_sites', 'saas_tickets', 'saas_messages'] loop
    execute format('drop policy if exists "saas admin all" on public.%I', t);
    execute format('create policy "saas admin all" on public.%I for all to authenticated using (public.is_saas_admin()) with check (public.is_saas_admin())', t);
  end loop;
end $$;

-- 4) محفزات: تحديث التواريخ + سجلّ تغيّر الحالة داخل الطلب
create or replace function public._saas_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists saas_customers_touch on public.saas_customers;
create trigger saas_customers_touch before update on public.saas_customers for each row execute function public._saas_touch();

create or replace function public._saas_site_bu() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'active' and new.activated_at is null then new.activated_at := now(); end if;
  if new.status = 'deleting' and new.deletion_at is null then new.deletion_at := now() + interval '14 days'; end if;
  if new.status <> 'deleting' and old.status = 'deleting' and new.status <> 'deleted' then new.deletion_at := null; end if;
  return new;
end $$;
drop trigger if exists saas_sites_bu on public.saas_sites;
create trigger saas_sites_bu before update on public.saas_sites for each row execute function public._saas_site_bu();

create or replace function public._saas_ticket_bu() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.status in ('resolved', 'rejected') and old.status not in ('resolved', 'rejected') then new.resolved_at := now(); end if;
  if new.status not in ('resolved', 'rejected') and old.status in ('resolved', 'rejected') then new.resolved_at := null; end if;
  return new;
end $$;
drop trigger if exists saas_tickets_bu on public.saas_tickets;
create trigger saas_tickets_bu before update on public.saas_tickets for each row execute function public._saas_ticket_bu();

create or replace function public._saas_ticket_au() returns trigger
language plpgsql security definer set search_path = public as $$
declare lbl jsonb := '{"new":"جديد","open":"قيد المعالجة","waiting":"بانتظار الزبون","resolved":"تم الحل","rejected":"مرفوض","low":"منخفضة","normal":"عادية","high":"عالية","urgent":"عاجلة"}'::jsonb;
begin
  if new.status is distinct from old.status then
    insert into public.saas_messages (ticket_id, author, body, internal) values (new.id, 'system', 'الحالة: ' || coalesce(lbl ->> old.status, old.status) || ' ← ' || coalesce(lbl ->> new.status, new.status), false);
  end if;
  if new.priority is distinct from old.priority then
    insert into public.saas_messages (ticket_id, author, body, internal) values (new.id, 'system', 'الأولوية: ' || coalesce(lbl ->> old.priority, old.priority) || ' ← ' || coalesce(lbl ->> new.priority, new.priority), true);
  end if;
  if new.assignee is distinct from old.assignee then
    insert into public.saas_messages (ticket_id, author, body, internal) values (new.id, 'system', 'المسؤول: ' || coalesce(new.assignee, 'بلا'), true);
  end if;
  return new;
end $$;
drop trigger if exists saas_tickets_au on public.saas_tickets;
create trigger saas_tickets_au after update on public.saas_tickets for each row execute function public._saas_ticket_au();

-- 5) دوالّ لوحات الزبائن (anon) — محدودة ومتحقَّق من مدخلاتها
create or replace function public._saas_origin(o text) returns text
language sql immutable as $$
  select case when o ~* '^https?://[a-z0-9.-]+(:[0-9]+)?(/.*)?$' then lower(regexp_replace(o, '^(https?://[^/]+).*$', '\1')) else null end;
$$;

create or replace function public.saas_submit(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k text := coalesce(p ->> 'kind', 'support');
  subj text := btrim(coalesce(p ->> 'subject', ''));
  bdy text := btrim(coalesce(p ->> 'body', ''));
  org text := public._saas_origin(p ->> 'origin');
  ct jsonb := case when jsonb_typeof(p -> 'contact') = 'object' then p -> 'contact' else '{}'::jsonb end;
  st jsonb := case when jsonb_typeof(p -> 'site') = 'object' then p -> 'site' else '{}'::jsonb end;
  pl jsonb := case when jsonb_typeof(p -> 'payload') = 'object' then p -> 'payload' else '{}'::jsonb end;
  nw jsonb := case when jsonb_typeof(pl -> 'new') = 'object' then pl -> 'new' else null end;
  sid uuid; cid uuid; tid uuid; tnum bigint; pr text := 'normal'; nsub text; norg text;
begin
  if octet_length(p::text) > 12000 then raise exception 'too_large' using errcode = '22023'; end if;
  if k not in ('site_create', 'site_delete', 'site_delete_cancel', 'domain_request', 'domain_link', 'domain_dns', 'support', 'billing', 'other') then raise exception 'bad_kind' using errcode = '22023'; end if;
  if char_length(subj) not between 1 and 200 then raise exception 'bad_subject' using errcode = '22023'; end if;
  if char_length(bdy) > 6000 then bdy := left(bdy, 6000); end if;
  if org is null then raise exception 'bad_origin' using errcode = '22023'; end if;
  -- حدّ المعدّل: لكل موقع وعالمياً
  if (select count(*) from public.saas_tickets where origin = org and created_at > now() - interval '1 hour') >= 12 then raise exception 'rate_limited' using errcode = '53400'; end if;
  if (select count(*) from public.saas_tickets where created_at > now() - interval '1 hour') >= 120 then raise exception 'rate_limited' using errcode = '53400'; end if;

  select id, customer_id into sid, cid from public.saas_sites where origin = org;
  if sid is null then
    insert into public.saas_customers (name, email, phone, status)
    values (left(coalesce(nullif(btrim(ct ->> 'name'), ''), nullif(btrim(st ->> 'name'), ''), org), 120), left(ct ->> 'email', 160), left(coalesce(ct ->> 'phone', ct ->> 'wa'), 40), 'active')
    returning id into cid;
    insert into public.saas_sites (customer_id, name, origin, domain, domain_mode, status)
    values (cid, left(coalesce(nullif(btrim(st ->> 'name'), ''), org), 120), org, left(regexp_replace(org, '^https?://', ''), 120), 'own', 'active')
    returning id into sid;
  else
    update public.saas_sites set last_seen = now() where id = sid;
    if cid is not null then
      update public.saas_customers set email = coalesce(nullif(left(ct ->> 'email', 160), ''), email), phone = coalesce(nullif(left(coalesce(ct ->> 'phone', ct ->> 'wa'), 40), ''), phone) where id = cid;
    end if;
  end if;

  -- طلب موقع جديد: يُنشأ سجلّه فوراً بحالة «مطلوب» ليظهر في خط سير المواقع
  if k = 'site_create' and nw is not null then
    nsub := lower(left(coalesce(nw ->> 'sub', ''), 40)); if nsub = '' then nsub := null; end if;
    norg := public._saas_origin(nw ->> 'url');
    begin
      insert into public.saas_sites (customer_id, name, sub, origin, domain_mode, domain, domain_status, status)
      values (cid, left(coalesce(nullif(btrim(nw ->> 'name'), ''), nsub, 'موقع جديد'), 120), nsub, norg,
              case when nw ->> 'mode' in ('platform', 'own', 'request') then nw ->> 'mode' else 'platform' end,
              left(nw ->> 'domain', 120), case when nw ->> 'mode' in ('own', 'request') then 'requested' else 'none' end, 'requested')
      returning id into sid;
    exception when unique_violation then
      select id into sid from public.saas_sites where (sub = nsub or origin = norg) and status <> 'deleted' limit 1;
    end;
  elsif nullif(pl ->> 'target_origin', '') is not null and public._saas_origin(pl ->> 'target_origin') is not null then
    select id into sid from public.saas_sites where origin = public._saas_origin(pl ->> 'target_origin');
    if sid is null then sid := (select id from public.saas_sites where origin = org); end if;
  end if;

  if k in ('site_delete') then pr := 'high'; elsif k = 'billing' then pr := 'high'; end if;
  insert into public.saas_tickets (kind, subject, body, payload, site_id, customer_id, origin, contact, priority)
  values (k, left(subj, 200), bdy, pl, sid, cid, org, ct, pr)
  returning id, num into tid, tnum;
  insert into public.saas_messages (ticket_id, author, body) values (tid, 'customer', case when bdy = '' then subj else bdy end);
  return jsonb_build_object('id', tid, 'num', tnum, 'status', 'new');
end $$;

create or replace function public.saas_ticket_view(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ids uuid[]; r jsonb;
begin
  if jsonb_typeof(p -> 'ids') <> 'array' then return '[]'::jsonb; end if;
  select array(select x::uuid from jsonb_array_elements_text(p -> 'ids') x where x ~* '^[0-9a-f-]{36}$' limit 20) into ids;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'num', t.num, 'kind', t.kind, 'subject', t.subject, 'status', t.status, 'created_at', t.created_at, 'updated_at', t.updated_at,
      'messages', coalesce((select jsonb_agg(jsonb_build_object('author', m.author, 'body', m.body, 'at', m.created_at) order by m.created_at, m.id)
                            from public.saas_messages m where m.ticket_id = t.id and not m.internal), '[]'::jsonb))
    order by t.created_at desc), '[]'::jsonb)
  into r from public.saas_tickets t where t.id = any (ids);
  return r;
end $$;

create or replace function public.saas_ticket_reply(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare tid uuid; b text := btrim(coalesce(p ->> 'body', ''));
begin
  if coalesce(p ->> 'id', '') !~* '^[0-9a-f-]{36}$' then raise exception 'bad_id' using errcode = '22023'; end if;
  tid := (p ->> 'id')::uuid;
  if char_length(b) not between 1 and 4000 then raise exception 'bad_body' using errcode = '22023'; end if;
  if not exists (select 1 from public.saas_tickets where id = tid) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if (select count(*) from public.saas_messages where ticket_id = tid and author = 'customer' and created_at > now() - interval '1 hour') >= 20 then raise exception 'rate_limited' using errcode = '53400'; end if;
  insert into public.saas_messages (ticket_id, author, body) values (tid, 'customer', b);
  update public.saas_tickets set last_customer_at = now(), admin_read = false,
         status = case when status in ('waiting', 'resolved') then 'open' else status end where id = tid;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.saas_site_status(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o text := public._saas_origin(p ->> 'origin'); s public.saas_sites;
begin
  if o is null then return jsonb_build_object('known', false); end if;
  select * into s from public.saas_sites where origin = o;
  if s.id is null then return jsonb_build_object('known', false); end if;
  return jsonb_build_object('known', true, 'status', s.status, 'deletion_at', s.deletion_at, 'domain_status', s.domain_status);
end $$;

create or replace function public.saas_site_ping(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare o text := public._saas_origin(p ->> 'origin');
begin
  if o is null then return; end if;
  update public.saas_sites set last_seen = now(), version = coalesce(left(p ->> 'version', 20), version) where origin = o;
end $$;

revoke all on function public.saas_submit(jsonb), public.saas_ticket_view(jsonb), public.saas_ticket_reply(jsonb), public.saas_site_status(jsonb), public.saas_site_ping(jsonb) from public;
grant execute on function public.saas_submit(jsonb), public.saas_ticket_view(jsonb), public.saas_ticket_reply(jsonb), public.saas_site_status(jsonb), public.saas_site_ping(jsonb) to anon, authenticated;

-- 6) دوالّ المدير
create or replace function public.saas_reply(p_ticket uuid, p_body text, p_internal boolean default false, p_status text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_saas_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 6000 then raise exception 'bad_body' using errcode = '22023'; end if;
  insert into public.saas_messages (ticket_id, author, body, internal) values (p_ticket, 'admin', btrim(p_body), coalesce(p_internal, false));
  update public.saas_tickets set admin_read = true,
         first_response_at = case when coalesce(p_internal, false) then first_response_at else coalesce(first_response_at, now()) end,
         status = coalesce(nullif(p_status, ''), case when not coalesce(p_internal, false) and status = 'new' then 'open' else status end)
   where id = p_ticket;
end $$;
revoke all on function public.saas_reply(uuid, text, boolean, text) from public, anon;
grant execute on function public.saas_reply(uuid, text, boolean, text) to authenticated;

create or replace function public.saas_stats(p_days int default 30) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d int := greatest(1, least(coalesce(p_days, 30), 365)); since timestamptz; r jsonb;
begin
  if not public.is_saas_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  since := date_trunc('day', now()) - ((d - 1) || ' days')::interval;
  select jsonb_build_object(
    'days', d,
    'tickets', jsonb_build_object(
      'total', (select count(*) from public.saas_tickets),
      'new', (select count(*) from public.saas_tickets where status = 'new'),
      'open', (select count(*) from public.saas_tickets where status = 'open'),
      'waiting', (select count(*) from public.saas_tickets where status = 'waiting'),
      'resolved', (select count(*) from public.saas_tickets where status = 'resolved'),
      'rejected', (select count(*) from public.saas_tickets where status = 'rejected'),
      'unread', (select count(*) from public.saas_tickets where not admin_read and status not in ('resolved', 'rejected')),
      'today', (select count(*) from public.saas_tickets where created_at >= date_trunc('day', now())),
      'window', (select count(*) from public.saas_tickets where created_at >= since),
      'urgent', (select count(*) from public.saas_tickets where priority in ('high', 'urgent') and status not in ('resolved', 'rejected'))
    ),
    'by_kind', coalesce((select jsonb_object_agg(kind, c) from (select kind, count(*)::int c from public.saas_tickets where created_at >= since group by kind) a), '{}'::jsonb),
    'per_day', coalesce((select jsonb_agg(jsonb_build_object('d', to_char(g, 'YYYY-MM-DD'),
                'created', (select count(*) from public.saas_tickets t where t.created_at >= g and t.created_at < g + interval '1 day'),
                'resolved', (select count(*) from public.saas_tickets t where t.resolved_at >= g and t.resolved_at < g + interval '1 day')) order by g)
               from generate_series(date_trunc('day', now()) - ((d - 1) || ' days')::interval, date_trunc('day', now()), interval '1 day') g), '[]'::jsonb),
    'response', jsonb_build_object(
      'avg_first_min', (select round(avg(extract(epoch from (first_response_at - created_at)) / 60)::numeric, 1) from public.saas_tickets where first_response_at is not null and created_at >= since),
      'avg_resolve_hours', (select round(avg(extract(epoch from (resolved_at - created_at)) / 3600)::numeric, 1) from public.saas_tickets where resolved_at is not null and created_at >= since),
      'sla_breached', (select count(*) from public.saas_tickets where first_response_at is null and status in ('new', 'open') and created_at < now() - interval '24 hours'),
      'resolved_rate', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where status in ('resolved', 'rejected')) / count(*), 1) end from public.saas_tickets where created_at >= since)
    ),
    'sites', jsonb_build_object(
      'total', (select count(*) from public.saas_sites where status <> 'deleted'),
      'by_status', coalesce((select jsonb_object_agg(status, c) from (select status, count(*)::int c from public.saas_sites group by status) a), '{}'::jsonb),
      'new_window', (select count(*) from public.saas_sites where created_at >= since),
      'seen_7d', (select count(*) from public.saas_sites where last_seen > now() - interval '7 days'),
      'avg_activation_hours', (select round(avg(extract(epoch from (activated_at - created_at)) / 3600)::numeric, 1) from public.saas_sites where activated_at is not null and created_at >= since),
      'own_domains', (select count(*) from public.saas_sites where domain_mode = 'own' and status <> 'deleted'),
      'per_week', coalesce((select jsonb_agg(jsonb_build_object('w', to_char(w, 'YYYY-MM-DD'), 'n', (select count(*) from public.saas_sites s where s.created_at >= w and s.created_at < w + interval '7 days')) order by w)
                 from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') w), '[]'::jsonb),
      'deletions_due', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'at', deletion_at) order by deletion_at) from public.saas_sites where status = 'deleting' and deletion_at <= now() + interval '3 days'), '[]'::jsonb)
    ),
    'customers', jsonb_build_object(
      'total', (select count(*) from public.saas_customers),
      'new_window', (select count(*) from public.saas_customers where created_at >= since),
      'by_plan', coalesce((select jsonb_object_agg(plan, c) from (select plan, count(*)::int c from public.saas_customers group by plan) a), '{}'::jsonb),
      'by_status', coalesce((select jsonb_object_agg(status, c) from (select status, count(*)::int c from public.saas_customers group by status) a), '{}'::jsonb)
    ),
    'top_customers', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'n', n)) from (
        select c.id, c.name, count(t.id)::int n from public.saas_customers c join public.saas_tickets t on t.customer_id = c.id where t.created_at >= since group by c.id, c.name order by n desc limit 5) x), '[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke all on function public.saas_stats(int) from public, anon;
grant execute on function public.saas_stats(int) to authenticated;

-- 7) البث المباشر (إشعارات لحظية للمدير عبر Realtime؛ تحترم RLS فلا يصل إلا للمدير)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.saas_tickets; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.saas_messages; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.saas_sites; exception when duplicate_object then null; end;
  end if;
end $$;

-- 8) بيانات أولية: مدير المنصة، وموقع أليسوم كأول زبون
insert into public.saas_admins (email, name, role) values ('saber.balbouzi@gmail.com', 'صابر', 'owner') on conflict (email) do nothing;

do $$ declare cid uuid; begin
  if not exists (select 1 from public.saas_sites where origin = 'https://alyssumdz.com') then
    insert into public.saas_customers (name, email, plan, status, notes) values ('أليسوم ALYSSUM', 'saber.balbouzi@gmail.com', 'owner', 'active', 'المتجر الأول على المنصة.') returning id into cid;
    insert into public.saas_sites (customer_id, name, origin, domain, domain_mode, domain_status, status, plan) values (cid, 'أليسوم ALYSSUM', 'https://alyssumdz.com', 'alyssumdz.com', 'own', 'connected', 'active', 'owner');
  end if;
end $$;
