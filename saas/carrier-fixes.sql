-- قرارات إدارة المنصة لحالات شركات التوصيل المجهولة + بلاغات المعايرة (v1.89.160). يُشغَّل مرة واحدة في SQL Editor؛ كله idempotent.
-- المدير فقط يكتب ويقرأ البلاغات؛ القرارات نفسها (بلا أسرار) تُقرأ عامةً كي تطبّقها لوحات الزبائن وبوابة الشحن تلقائياً.
create table if not exists public.saas_carrier_fixes (
  id bigint generated always as identity primary key,
  carrier text not null check (char_length(carrier) between 1 and 40),          -- رمز الشركة (yalidine…) أو * لكل الشركات
  raw text not null check (char_length(raw) between 1 and 200),                  -- النص الخام كما أرسلته الشركة
  norm text not null check (char_length(norm) between 1 and 200),                -- مطبَّعاً (StatusMapper::normalize)
  unified text not null check (unified in ('pending', 'shipped', 'out_for_delivery', 'delivered', 'failed_attempt', 'returned', 'cancelled')),
  note text,
  created_by text,
  created_at timestamptz not null default now(),
  unique (carrier, norm)
);
alter table public.saas_carrier_fixes enable row level security;
drop policy if exists "saas admin all" on public.saas_carrier_fixes;
create policy "saas admin all" on public.saas_carrier_fixes for all to authenticated using (public.is_saas_admin()) with check (public.is_saas_admin());

-- قراءة عامة لقرارات الإدارة (لا أسرار): تستعملها لوحة الزبون وتدمجها في ملف اتصال كل شركة
create or replace function public.saas_carrier_fixes() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('c', carrier, 'n', norm, 'u', unified)), '[]'::jsonb)
    from (select carrier, norm, unified from public.saas_carrier_fixes order by id limit 2000) f;
$$;
revoke all on function public.saas_carrier_fixes() from public;
grant execute on function public.saas_carrier_fixes() to anon, authenticated;

create or replace function public.saas_fix_set(p_carrier text, p_raw text, p_norm text, p_unified text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_saas_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  insert into public.saas_carrier_fixes (carrier, raw, norm, unified, note, created_by)
  values (left(btrim(p_carrier), 40), left(btrim(p_raw), 200), left(btrim(p_norm), 200), p_unified, left(p_note, 300), auth.jwt() ->> 'email')
  on conflict (carrier, norm) do update set unified = excluded.unified, raw = excluded.raw, note = excluded.note, created_by = excluded.created_by, created_at = now();
end $$;
revoke all on function public.saas_fix_set(text, text, text, text, text) from public, anon;
grant execute on function public.saas_fix_set(text, text, text, text, text) to authenticated;

create or replace function public.saas_fix_del(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_saas_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  delete from public.saas_carrier_fixes where id = p_id;
end $$;
revoke all on function public.saas_fix_del(bigint) from public, anon;
grant execute on function public.saas_fix_del(bigint) to authenticated;

create or replace function public.saas_fixes_admin() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_saas_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(f) order by f.id desc) from public.saas_carrier_fixes f), '[]'::jsonb);
end $$;
revoke all on function public.saas_fixes_admin() from public, anon;
grant execute on function public.saas_fixes_admin() to authenticated;

-- بلاغات المعايرة التي أرسلتها لوحات الزبائن صامتةً (payload.type = carrier_calibration)
create or replace function public.saas_calib_issues(p_days int default 60) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_saas_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x.at desc) from (
    select t.id, t.num, t.status, t.created_at as at, coalesce(s.name, t.origin, '') as site, t.origin, t.subject, t.payload
      from public.saas_tickets t left join public.saas_sites s on s.id = t.site_id
     where t.payload ->> 'type' = 'carrier_calibration' and t.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 60), 365)))
     order by t.created_at desc limit 500) x), '[]'::jsonb);
end $$;
revoke all on function public.saas_calib_issues(int) from public, anon;
grant execute on function public.saas_calib_issues(int) to authenticated;
