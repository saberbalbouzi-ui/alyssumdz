-- Hub (v1.89.77): حسابات المتاجر والنشر التلقائي. شغّله مرة في SQL Editor (آمن لإعادة التشغيل).
-- المتجر ← أعضاء (بريد مسجَّل في Auth) ← دالة `hub` (Edge Function) تنشر نيابةً عنهم بلا أن يرى العميل أي مفتاح.
create table if not exists public.hub_sites (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  name text not null default '',
  backend text not null default 'github' check (backend in ('github','storage')),
  gh_owner text, gh_repo text, gh_branch text default 'main',
  created_at timestamptz not null default now()
);
create table if not exists public.hub_members (
  site_id text not null references public.hub_sites(id) on delete cascade,
  email text not null,
  role text not null default 'owner' check (role in ('owner','editor')),
  primary key (site_id, email)
);
-- أسرار النشر (رمز GitHub مشفَّر AES-GCM بمفتاح HUB_KEY في أسرار الدالة): لا يقرؤها أحد إلا service_role
create table if not exists public.hub_secrets (
  site_id text primary key references public.hub_sites(id) on delete cascade,
  gh_token_enc text,
  updated_at timestamptz not null default now()
);
alter table public.hub_sites enable row level security;
alter table public.hub_members enable row level security;
alter table public.hub_secrets enable row level security;
revoke all on public.hub_sites, public.hub_members, public.hub_secrets from anon, authenticated;

-- متاجري: يعيد متاجر صاحب الجلسة فقط (بلا أي سرّ)
create or replace function public.hub_my_sites()
returns table(id text, name text, backend text, gh_owner text, gh_repo text, gh_branch text, role text, linked boolean)
language sql security definer set search_path = public stable as $$
  select s.id, s.name, s.backend, s.gh_owner, s.gh_repo, s.gh_branch, m.role, (sec.gh_token_enc is not null)
  from public.hub_sites s join public.hub_members m on m.site_id = s.id
  left join public.hub_secrets sec on sec.site_id = s.id
  where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;
revoke all on function public.hub_my_sites() from public;
grant execute on function public.hub_my_sites() to authenticated;

-- أليسوم = أول متجر: مديرو الجدول القديم admins يصيرون مالكين
insert into public.hub_sites (id, name, backend, gh_owner, gh_repo, gh_branch)
values ('alyssum', 'Alyssum', 'github', 'saberbalbouzi-ui', 'alyssumdz', 'main') on conflict (id) do nothing;
insert into public.hub_members (site_id, email, role)
select 'alyssum', lower(email), 'owner' from public.admins on conflict do nothing;
