-- ═══════════════════════════════════════════════════════════════════════════
-- رصيد الذكاء الاصطناعي لمواقع الزبائن (SaaS) — يُشغَّل مرة واحدة في مشروع Supabase الخاص بك أنت (مزوّد الخدمة)،
-- لا في مشاريع الزبائن. مفتاح Gemini الخاص بك يبقى في الخادم (سر الدالة ai) ولا يصل إلى أي موقع.
-- الأرقام (رصيد كل خطة) تحدّدها أنت لاحقاً: null = بلا حدّ.
-- ═══════════════════════════════════════════════════════════════════════════

-- الخطط (قوالب جاهزة للنسخ عند إنشاء موقع): رصيد النص والصور بعدّادين منفصلين، وعدد أيام الصلاحية
create table if not exists public.ai_plans (
  plan text primary key,
  text_credits int,        -- طلبات الكتابة (null = بلا حدّ)
  image_credits int,       -- طلبات توليد الصور (null = بلا حدّ)
  days int,                -- مدة الصلاحية بالأيام (null = بلا انتهاء)
  note text
);

-- المواقع: لكل موقع توكن سرّي يوضع في إعداداته، ورصيد متبقٍ يُخصم منه عند كل طلب ناجح
create table if not exists public.ai_sites (
  site text primary key,                                                                    -- اسم/نطاق الموقع
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  plan text,
  text_left int,           -- null = بلا حدّ
  image_left int,          -- null = بلا حدّ
  expires_at timestamptz,  -- null = بلا انتهاء
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

-- سجلّ الاستهلاك (للمراجعة والفوترة)
create table if not exists public.ai_usage (
  id bigserial primary key,
  site text not null,
  kind text not null check (kind in ('text', 'image')),
  ok boolean not null default true,      -- false = أُعيد الرصيد لأن Google فشل
  at timestamptz not null default now()
);
create index if not exists ai_usage_site_at on public.ai_usage (site, at desc);

-- مغلقة على الجميع: لا يصلها إلا service_role (الدالة ai ولوحة Supabase الخاصة بك)
alter table public.ai_plans enable row level security;
alter table public.ai_sites enable row level security;
alter table public.ai_usage enable row level security;
revoke all on public.ai_plans, public.ai_sites, public.ai_usage from anon, authenticated;
revoke all on sequence public.ai_usage_id_seq from anon, authenticated;

-- خصم طلب واحد بشكل ذرّي (يقفل صفّ الموقع). النتيجة: {ok, left} أو {ok:false, reason}
create or replace function public.ai_charge(p_token text, p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.ai_sites; l int;
begin
  if p_kind not in ('text', 'image') then return jsonb_build_object('ok', false, 'reason', 'bad_kind'); end if;
  select * into s from public.ai_sites where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_token'); end if;
  if s.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'suspended'); end if;
  if s.expires_at is not null and s.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  l := case p_kind when 'text' then s.text_left else s.image_left end;
  if l is not null and l <= 0 then return jsonb_build_object('ok', false, 'reason', 'no_credits'); end if;
  if l is not null then
    if p_kind = 'text' then update public.ai_sites set text_left = text_left - 1 where site = s.site;
    else update public.ai_sites set image_left = image_left - 1 where site = s.site; end if;
  end if;
  insert into public.ai_usage (site, kind) values (s.site, p_kind);
  return jsonb_build_object('ok', true, 'left', case when l is null then null else l - 1 end, 'site', s.site);
end $$;

-- إعادة الرصيد إن فشل الطلب عند Google (لا يُحاسَب الموقع على طلب لم ينجح)
create or replace function public.ai_refund(p_token text, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare s public.ai_sites;
begin
  select * into s from public.ai_sites where token = p_token for update; if not found then return; end if;
  if p_kind = 'text' and s.text_left is not null then update public.ai_sites set text_left = text_left + 1 where site = s.site;
  elsif p_kind = 'image' and s.image_left is not null then update public.ai_sites set image_left = image_left + 1 where site = s.site; end if;
  insert into public.ai_usage (site, kind, ok) values (s.site, p_kind, false);
end $$;

-- إنشاء موقع من خطة (يعيد التوكن لوضعه في إعدادات الموقع): select public.ai_new_site('alyssumdz.com', 'free');
create or replace function public.ai_new_site(p_site text, p_plan text) returns text
language plpgsql security definer set search_path = public as $$
declare p public.ai_plans; t text;
begin
  select * into p from public.ai_plans where plan = p_plan; if not found then raise exception 'unknown plan %', p_plan; end if;
  insert into public.ai_sites (site, plan, text_left, image_left, expires_at)
  values (p_site, p.plan, p.text_credits, p.image_credits, case when p.days is null then null else now() + (p.days || ' days')::interval end)
  returning token into t;
  return t;
end $$;

-- شحن رصيد/تمديد: select public.ai_topup('alyssumdz.com', 100, 20, 30);  (نص، صور، أيام إضافية؛ null = لا تغيير)
create or replace function public.ai_topup(p_site text, p_text int, p_image int, p_days int default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.ai_sites set
    text_left = case when text_left is null or p_text is null then text_left else text_left + p_text end,
    image_left = case when image_left is null or p_image is null then image_left else image_left + p_image end,
    expires_at = case when p_days is null then expires_at else greatest(coalesce(expires_at, now()), now()) + (p_days || ' days')::interval end,
    status = 'active'
  where site = p_site;
end $$;

revoke all on function public.ai_charge(text, text), public.ai_refund(text, text), public.ai_new_site(text, text), public.ai_topup(text, int, int, int) from public, anon, authenticated;
grant execute on function public.ai_charge(text, text), public.ai_refund(text, text), public.ai_new_site(text, text), public.ai_topup(text, int, int, int) to service_role;

-- تعريف الخطط عندما تقرّر أرقامها (مثال، لا يُشغَّل الآن):
-- insert into public.ai_plans (plan, text_credits, image_credits, days, note) values
--   ('free', 30, 3, 30, 'مجاني مع الموقع'), ('pro', 500, 60, 30, 'مدفوع'), ('unlimited', null, null, null, 'بلا حدّ')
--   on conflict (plan) do update set text_credits = excluded.text_credits, image_credits = excluded.image_credits, days = excluded.days, note = excluded.note;
