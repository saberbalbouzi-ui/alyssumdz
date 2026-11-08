-- رصيد الفيديو/المجسّمات (v1.89.900): المزوّد يوفّر المفتاح (سرّ FAL_KEY في Supabase) والزبون يشتري الرصيد.
-- ⚠️ لم يُطبَّق بعد: يُنفَّذ بموافقة المالك (SQL Editor أو apply_migration). آمن للتكرار.
-- ai_video_left: NULL = غير محدود (كالنص/الصور)؛ الافتراضي 0 كي لا يحصل أي موقع على فيديو مجاناً قبل شراء رصيد. المدير (جلسة) لا يُخصم منه.
alter table public.saas_sites add column if not exists ai_video_left int default 0;
alter table public.saas_ai_usage drop constraint if exists saas_ai_usage_kind_check;
alter table public.saas_ai_usage add constraint saas_ai_usage_kind_check check (kind in ('text', 'image', 'video'));

create or replace function public.saas_ai_charge(p_token text, p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.saas_sites; l int;
begin
  if p_kind not in ('text', 'image', 'video') then return jsonb_build_object('ok', false, 'reason', 'bad_kind'); end if;
  select * into s from public.saas_sites where api_token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_token'); end if;
  if s.status <> 'active' or s.api_mode <> 'shared' then return jsonb_build_object('ok', false, 'reason', 'suspended'); end if;
  if s.sub_ends_at is not null and s.sub_ends_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  l := case p_kind when 'text' then s.ai_text_left when 'image' then s.ai_image_left else s.ai_video_left end;
  if l is not null and l <= 0 then return jsonb_build_object('ok', false, 'reason', 'no_credits'); end if;
  if l is not null then
    if p_kind = 'text' then update public.saas_sites set ai_text_left = ai_text_left - 1 where id = s.id;
    elsif p_kind = 'image' then update public.saas_sites set ai_image_left = ai_image_left - 1 where id = s.id;
    else update public.saas_sites set ai_video_left = ai_video_left - 1 where id = s.id; end if;
  end if;
  insert into public.saas_ai_usage (site_id, kind) values (s.id, p_kind);
  return jsonb_build_object('ok', true, 'left', case when l is null then null else l - 1 end);
end $$;

create or replace function public.saas_ai_refund(p_token text, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare s public.saas_sites;
begin
  select * into s from public.saas_sites where api_token = p_token for update; if not found then return; end if;
  if p_kind = 'text' and s.ai_text_left is not null then update public.saas_sites set ai_text_left = ai_text_left + 1 where id = s.id;
  elsif p_kind = 'image' and s.ai_image_left is not null then update public.saas_sites set ai_image_left = ai_image_left + 1 where id = s.id;
  elsif p_kind = 'video' and s.ai_video_left is not null then update public.saas_sites set ai_video_left = ai_video_left + 1 where id = s.id; end if;
  insert into public.saas_ai_usage (site_id, kind, ok) values (s.id, p_kind, false);
end $$;
revoke all on function public.saas_ai_charge(text, text), public.saas_ai_refund(text, text) from public, anon, authenticated;
grant execute on function public.saas_ai_charge(text, text), public.saas_ai_refund(text, text) to service_role;

-- شحن رصيد الفيديو (للمدير)
create or replace function public.saas_ai_topup_video(p_site uuid, p_video int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_saas_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  update public.saas_sites set ai_video_left = case when ai_video_left is null or p_video is null then ai_video_left else greatest(0, ai_video_left + p_video) end where id = p_site;
end $$;
revoke all on function public.saas_ai_topup_video(uuid, int) from public, anon;
grant execute on function public.saas_ai_topup_video(uuid, int) to authenticated;
