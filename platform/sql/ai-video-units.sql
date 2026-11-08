-- تسعير الفيديو بالثواني (v1.89.914): وحدة رصيد الفيديو = ثانية واحدة. الخصم/الاسترداد بعدد وحدات (n) بدل وحدة لكل طلب.
-- ai_video_left يُشحَن الآن بالثواني. آمن للتكرار.
alter table public.saas_ai_usage add column if not exists units int not null default 1;

create or replace function public.saas_ai_charge_n(p_token text, p_kind text, p_n int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.saas_sites; l int; n int := greatest(1, least(coalesce(p_n, 1), 120));
begin
  if p_kind not in ('text', 'image', 'video') then return jsonb_build_object('ok', false, 'reason', 'bad_kind'); end if;
  select * into s from public.saas_sites where api_token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_token'); end if;
  if s.status <> 'active' or s.api_mode <> 'shared' then return jsonb_build_object('ok', false, 'reason', 'suspended'); end if;
  if s.sub_ends_at is not null and s.sub_ends_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  l := case p_kind when 'text' then s.ai_text_left when 'image' then s.ai_image_left else s.ai_video_left end;
  if l is not null and l < n then return jsonb_build_object('ok', false, 'reason', 'no_credits', 'left', l, 'need', n); end if;
  if l is not null then
    if p_kind = 'text' then update public.saas_sites set ai_text_left = ai_text_left - n where id = s.id;
    elsif p_kind = 'image' then update public.saas_sites set ai_image_left = ai_image_left - n where id = s.id;
    else update public.saas_sites set ai_video_left = ai_video_left - n where id = s.id; end if;
  end if;
  insert into public.saas_ai_usage (site_id, kind, units) values (s.id, p_kind, n);
  return jsonb_build_object('ok', true, 'left', case when l is null then null else l - n end, 'units', n);
end $$;

create or replace function public.saas_ai_refund_n(p_token text, p_kind text, p_n int) returns void
language plpgsql security definer set search_path = public as $$
declare s public.saas_sites; n int := greatest(1, least(coalesce(p_n, 1), 120));
begin
  select * into s from public.saas_sites where api_token = p_token for update; if not found then return; end if;
  if p_kind = 'text' and s.ai_text_left is not null then update public.saas_sites set ai_text_left = ai_text_left + n where id = s.id;
  elsif p_kind = 'image' and s.ai_image_left is not null then update public.saas_sites set ai_image_left = ai_image_left + n where id = s.id;
  elsif p_kind = 'video' and s.ai_video_left is not null then update public.saas_sites set ai_video_left = ai_video_left + n where id = s.id; end if;
  insert into public.saas_ai_usage (site_id, kind, ok, units) values (s.id, p_kind, false, n);
end $$;
revoke all on function public.saas_ai_charge_n(text, text, int), public.saas_ai_refund_n(text, text, int) from public, anon, authenticated;
grant execute on function public.saas_ai_charge_n(text, text, int), public.saas_ai_refund_n(text, text, int) to service_role;
