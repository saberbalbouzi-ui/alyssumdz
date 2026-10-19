-- حدود Pagebuilder Copilot الدائمة على الخادم (بيئة التطوير فقط — لم تُطبَّق على أي مشروع).
-- تُشغَّل بعد platform/sql/schema.sql (تعتمد على saas_sites وsaas_ai_usage). idempotent.
-- المبدأ: كل خصم وكل حدّ يُحسب داخل قاعدة البيانات في معاملة واحدة بعد قفل صف الموقع (for update)،
-- فلا تتجاوز الطلبات المتزامنة الحدود، ولا يعتمد شيء على localStorage أو عدّاد المتصفح أو ذاكرة نسخة الدالة.

create table if not exists public.saas_ai_policy (
  scope text primary key,                                -- 'default' أو معرّف الموقع (uuid كنص) لتخصيص موقع
  run_llm_max int not null default 6 check (run_llm_max between 0 and 100),
  run_img_max int not null default 8 check (run_img_max between 0 and 100),
  run_tries_max int not null default 2 check (run_tries_max between 1 and 10),     -- أقصى محاولات لكل أصل صورة داخل التشغيل
  cost_text numeric not null default 1 check (cost_text >= 0),                     -- وحدات تكلفة نسبية (تُعايَر لاحقاً بالدولار)
  cost_image numeric not null default 8 check (cost_image >= 0),
  daily_cost_cap numeric not null default 200 check (daily_cost_cap >= 0)         -- سقف يومي بتوقيت الجزائر
);
insert into public.saas_ai_policy (scope) values ('default') on conflict do nothing;

create table if not exists public.saas_ai_runs (
  site_id uuid not null references public.saas_sites (id) on delete cascade,
  run_id text not null,
  llm_calls int not null default 0,                      -- عدّادات المحاولات لا تنقص عند الاسترداد (إعادة المحاولة لا تتجاوز الحدّ)
  images int not null default 0,
  tries jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (site_id, run_id)
);
create table if not exists public.saas_ai_ledger (
  site_id uuid not null references public.saas_sites (id) on delete cascade,
  req_id text not null,
  run_id text not null,
  kind text not null check (kind in ('text', 'image')),
  cost numeric not null,
  state text not null check (state in ('charged', 'refunded')),
  at timestamptz not null default now(),
  primary key (site_id, req_id)
);
create index if not exists saas_ai_ledger_day_idx on public.saas_ai_ledger (site_id, at);
alter table public.saas_ai_policy enable row level security; alter table public.saas_ai_runs enable row level security; alter table public.saas_ai_ledger enable row level security;
revoke all on public.saas_ai_policy, public.saas_ai_runs, public.saas_ai_ledger from anon, authenticated;

-- خصم بحدود دائمة. الرفض لا يغيّر أي شيء (لا خصم ولا عدّاد). p_req معرّف فريد لكل طلب: نفس المعرّف لا يُخصم مرتين.
create or replace function public.saas_ai_charge2(p_token text, p_kind text, p_run text, p_req text, p_key text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.saas_sites; pol public.saas_ai_policy; r public.saas_ai_runs; led public.saas_ai_ledger; l int; c numeric; spent numeric; tn int;
begin
  if p_kind not in ('text', 'image') then return jsonb_build_object('ok', false, 'reason', 'bad_kind'); end if;
  if p_run is null or p_run !~ '^[A-Za-z0-9_.-]{6,64}$' or p_req is null or p_req !~ '^[A-Za-z0-9_.-]{6,80}$' or (p_key is not null and p_key !~ '^[A-Za-z0-9_.:-]{1,80}$') then
    return jsonb_build_object('ok', false, 'reason', 'bad_request'); end if;
  select * into s from public.saas_sites where api_token = p_token for update;       -- يسلسل كل طلبات الموقع الواحد
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_token'); end if;
  if s.status <> 'active' or s.api_mode <> 'shared' then return jsonb_build_object('ok', false, 'reason', 'suspended'); end if;
  if s.sub_ends_at is not null and s.sub_ends_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  select * into pol from public.saas_ai_policy where scope = s.id::text; if not found then select * into pol from public.saas_ai_policy where scope = 'default'; end if;
  select * into led from public.saas_ai_ledger where site_id = s.id and req_id = p_req;
  if found and led.state = 'charged' then return jsonb_build_object('ok', false, 'reason', 'duplicate_request'); end if;
  if found and led.run_id <> p_run then return jsonb_build_object('ok', false, 'reason', 'bad_request'); end if;
  select * into r from public.saas_ai_runs where site_id = s.id and run_id = p_run;
  if not found then r.llm_calls := 0; r.images := 0; r.tries := '{}'::jsonb; end if;
  if p_kind = 'text' and r.llm_calls >= pol.run_llm_max then return jsonb_build_object('ok', false, 'reason', 'run_llm_limit'); end if;
  if p_kind = 'image' then
    if r.images >= pol.run_img_max then return jsonb_build_object('ok', false, 'reason', 'run_img_limit'); end if;
    tn := coalesce((r.tries ->> coalesce(p_key, '_'))::int, 0);
    if tn >= pol.run_tries_max then return jsonb_build_object('ok', false, 'reason', 'run_tries_limit'); end if;
  end if;
  c := case p_kind when 'text' then pol.cost_text else pol.cost_image end;
  select coalesce(sum(cost), 0) into spent from public.saas_ai_ledger
    where site_id = s.id and state = 'charged' and (at at time zone 'Africa/Algiers')::date = (now() at time zone 'Africa/Algiers')::date;
  if spent + c > pol.daily_cost_cap then return jsonb_build_object('ok', false, 'reason', 'daily_cap'); end if;
  l := case p_kind when 'text' then s.ai_text_left else s.ai_image_left end;
  if l is not null and l <= 0 then return jsonb_build_object('ok', false, 'reason', 'no_credits'); end if;
  -- كل الفحوص اجتازت: نطبّق
  if l is not null then
    if p_kind = 'text' then update public.saas_sites set ai_text_left = ai_text_left - 1 where id = s.id; else update public.saas_sites set ai_image_left = ai_image_left - 1 where id = s.id; end if;
  end if;
  insert into public.saas_ai_runs (site_id, run_id, llm_calls, images, tries) values (s.id, p_run, case when p_kind = 'text' then 1 else 0 end, case when p_kind = 'image' then 1 else 0 end,
      case when p_kind = 'image' then jsonb_build_object(coalesce(p_key, '_'), 1) else '{}'::jsonb end)
    on conflict (site_id, run_id) do update set llm_calls = public.saas_ai_runs.llm_calls + (case when p_kind = 'text' then 1 else 0 end), images = public.saas_ai_runs.images + (case when p_kind = 'image' then 1 else 0 end),
      tries = case when p_kind = 'image' then public.saas_ai_runs.tries || jsonb_build_object(coalesce(p_key, '_'), tn + 1) else public.saas_ai_runs.tries end;
  insert into public.saas_ai_ledger (site_id, req_id, run_id, kind, cost, state) values (s.id, p_req, p_run, p_kind, c, 'charged')
    on conflict (site_id, req_id) do update set state = 'charged', cost = excluded.cost, at = now();
  insert into public.saas_ai_usage (site_id, kind) values (s.id, p_kind);
  return jsonb_build_object('ok', true, 'left', case when l is null then null else l - 1 end, 'spent', spent + c, 'cap', pol.daily_cost_cap);
end $$;

-- استرداد مرة واحدة فقط لكل طلب (نداء ثانٍ لا يفعل شيئاً). عدّادات التشغيل لا تنقص.
create or replace function public.saas_ai_refund2(p_token text, p_req text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.saas_sites; led public.saas_ai_ledger;
begin
  select * into s from public.saas_sites where api_token = p_token for update; if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_token'); end if;
  select * into led from public.saas_ai_ledger where site_id = s.id and req_id = p_req for update;
  if not found or led.state <> 'charged' then return jsonb_build_object('ok', true, 'noop', true); end if;
  update public.saas_ai_ledger set state = 'refunded' where site_id = s.id and req_id = p_req;
  if led.kind = 'text' and s.ai_text_left is not null then update public.saas_sites set ai_text_left = ai_text_left + 1 where id = s.id;
  elsif led.kind = 'image' and s.ai_image_left is not null then update public.saas_sites set ai_image_left = ai_image_left + 1 where id = s.id; end if;
  insert into public.saas_ai_usage (site_id, kind, ok) values (s.id, led.kind, false);
  return jsonb_build_object('ok', true, 'refunded', true);
end $$;
revoke all on function public.saas_ai_charge2(text, text, text, text, text), public.saas_ai_refund2(text, text) from public, anon, authenticated;
grant execute on function public.saas_ai_charge2(text, text, text, text, text), public.saas_ai_refund2(text, text) to service_role;
