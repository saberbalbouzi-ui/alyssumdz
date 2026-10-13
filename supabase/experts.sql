-- شبكة الخبراء (Réseau d'Experts) — سوق B2B مصغّر يربط التجار بمستقلين: 5 فئات، ملفات شخصية بمعرض وتعرفة، وتقييم 5 نجوم.
-- يعمل فوق مخطط المنصة (`saas/schema.sql`: saas_sites, saas_admins, is_saas_admin, _saas_origin) — شغّل ذلك الملف أولاً. آمن لإعادة التشغيل.
-- النموذج: لا حسابات Supabase Auth للمستقلين (تأكيد البريد معطّل/محدود هنا) بل «مفتاح إدارة» سرّي يُعطى مرة واحدة عند التسجيل ويُحفظ مجزّأً (sha256)،
-- كرمز التذاكر في `saas_tickets`. الجداول مغلقة بـRLS؛ الزوار والتجار يمرّون بدوالّ محدودة، والمدير فقط (is_saas_admin) يقرأ/يعدّل مباشرة.
-- التاجر = موقع مسجَّل في المنصة (saas_sites.origin): رقم الواتساب لا يُعطى إلا لموقع مسجَّل ونشط، وبحدّ يومي، ويُسجَّل كل تواصل؛ التقييم لمن تواصل قبل ≥48 ساعة.

-- 1) الجداول -----------------------------------------------------------------------------------------------------------------------
create table if not exists public.expert_categories (
  id serial primary key,
  slug text not null unique check (slug ~ '^[a-z0-9_]{2,40}$'),
  name_ar text not null, name_fr text not null, name_en text not null default '',
  icon text not null default '', ord int not null default 0
);
insert into public.expert_categories (slug, name_ar, name_fr, name_en, icon, ord) values
  ('branding_packaging', 'هوية بصرية وتغليف', 'Branding / Packaging', 'Branding & Packaging', 'palette', 1),
  ('media_buyers', 'مشترو الإعلانات (Media Buyers)', 'Media Buyers', 'Media Buyers', 'chart', 2),
  ('confirmatrices', 'مؤكِّدات الطلبات', 'Confirmatrices', 'Order confirmation agents', 'phone', 3),
  ('livreurs', 'موزّعون ومندوبو توصيل', 'Livreurs', 'Delivery drivers', 'truck', 4),
  ('ugc_creators', 'صنّاع محتوى UGC', 'Créateurs UGC', 'UGC creators', 'video', 5)
on conflict (slug) do nothing;

create table if not exists public.experts_profiles (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null,                                        -- sha256 لمفتاح الإدارة (لا يُخزَّن المفتاح نفسه)
  display_name text not null check (char_length(display_name) between 2 and 80),
  headline text not null check (char_length(headline) between 4 and 120),
  bio text not null default '' check (char_length(bio) <= 1500),
  category_id int not null references public.expert_categories (id),
  wilaya int check (wilaya between 1 and 69), city text not null default '' check (char_length(city) <= 60),
  remote boolean not null default true,
  rate_type text not null default 'quote' check (rate_type in ('hourly', 'per_task', 'monthly', 'per_order', 'quote')),
  rate_from int check (rate_from >= 0), rate_to int check (rate_to >= 0),
  currency text not null default 'DZD' check (currency ~ '^[A-Z]{3}$'),
  whatsapp text not null check (whatsapp ~ '^[0-9]{8,15}$'),     -- أرقام فقط بمفتاح الدولة (لا يظهر للزوار)
  socials jsonb not null default '{}'::jsonb,                    -- {instagram,tiktok,facebook,youtube,behance,linkedin,telegram,website} روابط https
  portfolio jsonb not null default '[]'::jsonb,                  -- [{t:'img',d:dataURL,title}|{t:'link',u:https,title}] ≤ 8
  thumb text not null default '' check (char_length(thumb) <= 40000),
  languages text[] not null default array['ar'],
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended', 'paused')),
  consent_at timestamptz not null default now(),
  rating_avg numeric(3, 2) not null default 0, rating_count int not null default 0, contacts_count int not null default 0,
  admin_note text not null default '' check (char_length(admin_note) <= 600),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), approved_at timestamptz
);
alter table public.experts_profiles add column if not exists verified boolean not null default false;   -- «موثّق» بقرار المدير (هوية/أعمال تم التحقق منها)
create unique index if not exists experts_wa_uq on public.experts_profiles (whatsapp);
create index if not exists experts_list_idx on public.experts_profiles (status, category_id, rating_avg desc);

create table if not exists public.expert_reviews (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid not null references public.experts_profiles (id) on delete cascade,
  site_id uuid not null references public.saas_sites (id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 600),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (expert_id, site_id)                                    -- تقييم واحد لكل موقع لكل خبير (يُعدَّل ولا يتكرر)
);
create table if not exists public.expert_contacts (
  id bigserial primary key, expert_id uuid not null references public.experts_profiles (id) on delete cascade,
  site_id uuid not null references public.saas_sites (id) on delete cascade, at timestamptz not null default now()
);
create index if not exists expert_contacts_ix on public.expert_contacts (site_id, expert_id, at);
create table if not exists public.expert_reports (
  id bigserial primary key, expert_id uuid not null references public.experts_profiles (id) on delete cascade,
  site_id uuid references public.saas_sites (id) on delete set null, reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'closed')), at timestamptz not null default now()
);

alter table public.expert_categories enable row level security;
alter table public.experts_profiles enable row level security;
alter table public.expert_reviews enable row level security;
alter table public.expert_contacts enable row level security;
alter table public.expert_reports enable row level security;
revoke all on public.expert_categories, public.experts_profiles, public.expert_reviews, public.expert_contacts, public.expert_reports from anon, authenticated;
grant select, insert, update, delete on public.expert_categories, public.experts_profiles, public.expert_reviews, public.expert_contacts, public.expert_reports to authenticated;
grant usage, select on all sequences in schema public to authenticated;
do $$ declare t text; begin
  foreach t in array array['expert_categories', 'experts_profiles', 'expert_reviews', 'expert_contacts', 'expert_reports'] loop
    execute format('drop policy if exists "saas admin all" on public.%I', t);
    execute format('create policy "saas admin all" on public.%I for all to authenticated using (public.is_saas_admin()) with check (public.is_saas_admin())', t);
  end loop;
end $$;

-- 2) مساعدات داخلية -----------------------------------------------------------------------------------------------------------------
create or replace function public._ex_txt(x text, n int) returns text language sql immutable as $$ select left(btrim(translate(coalesce(x, ''), '<>', '')), n) $$;
create or replace function public._ex_hash(k text) returns text language sql immutable as $$ select encode(sha256(convert_to(coalesce(k, ''), 'utf8')), 'hex') $$;
-- رقم واتساب → أرقام فقط بمفتاح الدولة (الجزائر افتراضياً: 0555… → 213555…)
create or replace function public._ex_wa(x text) returns text language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(x, ''), '[^0-9]', '', 'g');
begin
  if d like '00%' then d := substr(d, 3); elsif d ~ '^0[0-9]{9}$' then d := '213' || substr(d, 2); end if;
  if d !~ '^[0-9]{8,15}$' then return null; end if; return d;
end $$;
create or replace function public._ex_socials(s jsonb) returns jsonb language plpgsql immutable as $$
declare k text; v text; o jsonb := '{}'::jsonb;
begin
  if s is null or jsonb_typeof(s) <> 'object' then return o; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(s) loop
    if k in ('instagram', 'tiktok', 'facebook', 'youtube', 'behance', 'linkedin', 'telegram', 'website') and v ~ '^https://[^\s<>"'']{3,250}$' then o := o || jsonb_build_object(k, v); end if;
  end loop;
  return o;
end $$;
-- المعرض: حتى 8 عناصر؛ صورة مضغوطة (data URL ≤ ~110KB) أو رابط https
create or replace function public._ex_portfolio(a jsonb) returns jsonb language plpgsql immutable as $$
declare e jsonb; o jsonb := '[]'::jsonb; n int := 0;
begin
  if a is null or jsonb_typeof(a) <> 'array' then return o; end if;
  for e in select value from jsonb_array_elements(a) loop
    exit when n >= 8;
    if jsonb_typeof(e) <> 'object' then continue; end if;
    if e ->> 't' = 'img' and (e ->> 'd') ~ '^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$' and char_length(e ->> 'd') <= 150000 then
      o := o || jsonb_build_array(jsonb_build_object('t', 'img', 'd', e ->> 'd', 'title', public._ex_txt(e ->> 'title', 80))); n := n + 1;
    elsif e ->> 't' = 'link' and (e ->> 'u') ~ '^https://[^\s<>"'']{3,250}$' then
      o := o || jsonb_build_array(jsonb_build_object('t', 'link', 'u', e ->> 'u', 'title', public._ex_txt(e ->> 'title', 80))); n := n + 1;
    end if;
  end loop;
  return o;
end $$;
create or replace function public._ex_site(o text) returns uuid language sql stable security definer set search_path = public as $$
  select id from public.saas_sites where origin = public._saas_origin(o) and status in ('active', 'provisioning', 'requested') limit 1
$$;
-- صف الملف العلني (بلا واتساب ولا مفتاح)
create or replace function public._ex_card(e public.experts_profiles, fl boolean) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', e.id, 'name', e.display_name, 'headline', e.headline, 'cat', c.slug, 'cat_ar', c.name_ar, 'cat_fr', c.name_fr, 'wilaya', e.wilaya, 'city', e.city,
    'remote', e.remote, 'rate_type', e.rate_type, 'rate_from', e.rate_from, 'rate_to', e.rate_to, 'cur', e.currency, 'rating', e.rating_avg, 'count', e.rating_count, 'thumb', e.thumb, 'langs', e.languages, 'verified', e.verified)
    || case when fl then jsonb_build_object('bio', e.bio, 'socials', e.socials, 'portfolio', e.portfolio, 'since', e.created_at) else '{}'::jsonb end
  from public.expert_categories c where c.id = e.category_id
$$;
create or replace function public._ex_recount(eid uuid) returns void language sql security definer set search_path = public as $$
  update public.experts_profiles set rating_avg = coalesce((select round(avg(stars)::numeric, 2) from public.expert_reviews where expert_id = eid and status = 'visible'), 0),
    rating_count = (select count(*) from public.expert_reviews where expert_id = eid and status = 'visible') where id = eid
$$;

-- 3) واجهة التاجر والزائر (anon) ----------------------------------------------------------------------------------------------------
create or replace function public.experts_categories() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'ar', name_ar, 'fr', name_fr, 'en', name_en, 'icon', icon,
    'n', (select count(*) from public.experts_profiles e where e.category_id = c.id and e.status = 'approved')) order by ord), '[]'::jsonb) from public.expert_categories c
$$;
-- بحث: p = {q, cat, wilaya, min_rating, max_rate, remote, sort: rating|new|price_asc|price_desc, page, per}
create or replace function public.experts_search(p jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q text := nullif(btrim(coalesce(p ->> 'q', '')), ''); cat text := nullif(p ->> 'cat', ''); wil int := nullif(p ->> 'wilaya', '')::int;
  mr numeric := coalesce(nullif(p ->> 'min_rating', '')::numeric, 0); mx int := nullif(p ->> 'max_rate', '')::int; rem boolean := case when p ->> 'remote' = 'true' then true else null end; ver boolean := case when p ->> 'verified' = 'true' then true else null end;
  srt text := coalesce(p ->> 'sort', 'rating'); per int := least(greatest(coalesce(nullif(p ->> 'per', '')::int, 12), 1), 24); pg int := greatest(coalesce(nullif(p ->> 'page', '')::int, 1), 1);
  pat text; tot int; items jsonb;
begin
  if q is not null then q := left(q, 60); pat := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  with f as (select e.* from public.experts_profiles e join public.expert_categories c on c.id = e.category_id
      where e.status = 'approved' and (cat is null or c.slug = cat) and (wil is null or e.wilaya = wil or e.remote) and e.rating_avg >= mr
        and (mx is null or e.rate_from is null or e.rate_from <= mx) and (rem is null or e.remote) and (ver is null or e.verified)
        and (pat is null or e.display_name ilike pat or e.headline ilike pat or e.bio ilike pat or e.city ilike pat)),
    pg_ as (select f.*, row_number() over (order by case when wil is not null and wilaya = wil then 0 else 1 end,
      case when srt = 'rating' then rating_avg end desc nulls last, case when srt = 'rating' then rating_count end desc,
      case when srt = 'new' then created_at end desc, case when srt = 'price_asc' then coalesce(rate_from, 2147483647) end asc,
      case when srt = 'price_desc' then coalesce(rate_from, 0) end desc, created_at desc) as rn from f)
  select (select count(*) from f), coalesce((select jsonb_agg(public._ex_card(ep, false) order by x.rn) from pg_ x join public.experts_profiles ep on ep.id = x.id where x.rn > (pg - 1) * per and x.rn <= pg * per), '[]'::jsonb) into tot, items;
  return jsonb_build_object('total', tot, 'page', pg, 'per', per, 'items', items);
end $$;
create or replace function public.expert_get(p jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.experts_profiles; rv jsonb;
begin
  select * into e from public.experts_profiles where id = nullif(p ->> 'id', '')::uuid and status = 'approved';
  if e.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('stars', r.stars, 'comment', r.comment, 'at', r.created_at, 'by', left(s.name, 40)) order by r.created_at desc), '[]'::jsonb) into rv
    from (select * from public.expert_reviews where expert_id = e.id and status = 'visible' order by created_at desc limit 30) r join public.saas_sites s on s.id = r.site_id;
  return public._ex_card(e, true) || jsonb_build_object('reviews', rv);
end $$;
-- زر واتساب المباشر: لموقع مسجَّل فقط، بحدّ 40 يومياً لكل موقع، ويُسجَّل (يفتح باب التقييم بعد 48 ساعة)
create or replace function public.expert_contact(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid := public._ex_site(p ->> 'origin'); e public.experts_profiles;
begin
  if sid is null then raise exception 'unknown_site' using errcode = '42501'; end if;
  select * into e from public.experts_profiles where id = nullif(p ->> 'id', '')::uuid and status = 'approved';
  if e.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if (select count(*) from public.expert_contacts where site_id = sid and at > now() - interval '1 day') >= 40 then raise exception 'rate_limited' using errcode = '53400'; end if;
  if not exists (select 1 from public.expert_contacts where site_id = sid and expert_id = e.id and at > now() - interval '1 hour') then
    insert into public.expert_contacts (expert_id, site_id) values (e.id, sid);
    update public.experts_profiles set contacts_count = contacts_count + 1 where id = e.id;
  end if;
  return jsonb_build_object('wa', e.whatsapp, 'name', e.display_name);
end $$;
-- تقييم 1..5 (تعديل لا تكرار): لموقع تواصل مع الخبير قبل ≥48 ساعة؛ المتوسط يُعاد حسابه في الحركة نفسها
create or replace function public.expert_review(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid := public._ex_site(p ->> 'origin'); eid uuid := nullif(p ->> 'id', '')::uuid; st int := nullif(p ->> 'stars', '')::int; r jsonb;
begin
  if sid is null then raise exception 'unknown_site' using errcode = '42501'; end if;
  if st is null or st not between 1 and 5 then raise exception 'bad_stars' using errcode = '22023'; end if;
  if not exists (select 1 from public.experts_profiles where id = eid and status = 'approved') then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.expert_contacts where site_id = sid and expert_id = eid) then raise exception 'not_contacted' using errcode = '42501'; end if;
  if not exists (select 1 from public.expert_contacts where site_id = sid and expert_id = eid and at <= now() - interval '48 hours') then raise exception 'too_early' using errcode = '42501'; end if;
  if (select count(*) from public.expert_reviews where site_id = sid and updated_at > now() - interval '1 day') >= 20 then raise exception 'rate_limited' using errcode = '53400'; end if;
  insert into public.expert_reviews (expert_id, site_id, stars, comment) values (eid, sid, st, public._ex_txt(p ->> 'comment', 600))
  on conflict (expert_id, site_id) do update set stars = excluded.stars, comment = excluded.comment, updated_at = now(), status = 'visible';
  perform public._ex_recount(eid);
  select jsonb_build_object('rating', rating_avg, 'count', rating_count) into r from public.experts_profiles where id = eid;
  return r;
end $$;
create or replace function public.expert_report(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid := public._ex_site(p ->> 'origin'); eid uuid := nullif(p ->> 'id', '')::uuid;
begin
  if sid is null then raise exception 'unknown_site' using errcode = '42501'; end if;
  if not exists (select 1 from public.experts_profiles where id = eid) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if (select count(*) from public.expert_reports where site_id = sid and at > now() - interval '1 day') >= 10 then raise exception 'rate_limited' using errcode = '53400'; end if;
  insert into public.expert_reports (expert_id, site_id, reason) values (eid, sid, public._ex_txt(p ->> 'reason', 500));
  return jsonb_build_object('ok', true);
end $$;

-- 4) مساحة المستقل (anon + مفتاح الإدارة) -------------------------------------------------------------------------------------------
create or replace function public._ex_fields(p jsonb, out cat int, out wa text, out soc jsonb, out port jsonb, out rt text, out rf int, out rto int) language plpgsql immutable as $$
begin
  cat := (select id from public.expert_categories where slug = p ->> 'cat');
  if cat is null then raise exception 'bad_category' using errcode = '22023'; end if;
  wa := public._ex_wa(p ->> 'whatsapp'); if wa is null then raise exception 'bad_whatsapp' using errcode = '22023'; end if;
  soc := public._ex_socials(p -> 'socials'); port := public._ex_portfolio(p -> 'portfolio');
  rt := coalesce(p ->> 'rate_type', 'quote'); if rt not in ('hourly', 'per_task', 'monthly', 'per_order', 'quote') then raise exception 'bad_rate' using errcode = '22023'; end if;
  rf := nullif(p ->> 'rate_from', '')::int; rto := nullif(p ->> 'rate_to', '')::int;
  if rf is not null and (rf < 0 or rf > 100000000) or rto is not null and (rto < 0 or rto > 100000000) or rf is not null and rto is not null and rto < rf then raise exception 'bad_rate' using errcode = '22023'; end if;
end $$;
create or replace function public._ex_langs(p jsonb) returns text[] language sql immutable as $$
  select coalesce(nullif(array(select distinct x from jsonb_array_elements_text(case when jsonb_typeof(p -> 'langs') = 'array' then p -> 'langs' else '[]'::jsonb end) x where x in ('ar', 'fr', 'en', 'kab') order by x), '{}'), array['ar'])
$$;
-- تسجيل مستقل جديد ← {id, key}: المفتاح يظهر مرة واحدة فقط. الملف «بانتظار الموافقة» ولا يظهر في البحث قبل اعتماد المدير
create or replace function public.expert_register(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare f record; k text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''); nid uuid;
begin
  if octet_length(p::text) > 1300000 then raise exception 'too_large' using errcode = '22023'; end if;
  if coalesce(p ->> 'consent', '') <> 'true' then raise exception 'consent_required' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p ->> 'name', ''))) < 2 then raise exception 'bad_name' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p ->> 'headline', ''))) < 4 then raise exception 'bad_headline' using errcode = '22023'; end if;
  if (select count(*) from public.experts_profiles where created_at > now() - interval '1 hour') >= 30 then raise exception 'rate_limited' using errcode = '53400'; end if;
  select * into f from public._ex_fields(p);
  if exists (select 1 from public.experts_profiles where whatsapp = f.wa) then raise exception 'already_registered' using errcode = '23505'; end if;
  insert into public.experts_profiles (key_hash, display_name, headline, bio, category_id, wilaya, city, remote, rate_type, rate_from, rate_to, currency, whatsapp, socials, portfolio, thumb, languages)
  values (public._ex_hash(k), public._ex_txt(p ->> 'name', 80), public._ex_txt(p ->> 'headline', 120), public._ex_txt(p ->> 'bio', 1500), f.cat, nullif(p ->> 'wilaya', '')::int, public._ex_txt(p ->> 'city', 60),
    coalesce(p ->> 'remote', 'true') <> 'false', f.rt, f.rf, f.rto, case when (p ->> 'cur') ~ '^[A-Z]{3}$' then p ->> 'cur' else 'DZD' end, f.wa, f.soc, f.port,
    case when (p ->> 'thumb') ~ '^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$' and char_length(p ->> 'thumb') <= 40000 then p ->> 'thumb' else '' end, public._ex_langs(p)) returning id into nid;
  return jsonb_build_object('id', nid, 'key', k, 'status', 'pending');
end $$;
create or replace function public._ex_auth(eid uuid, k text) returns public.experts_profiles language plpgsql security definer set search_path = public as $$
declare e public.experts_profiles;
begin
  select * into e from public.experts_profiles where id = eid and key_hash = public._ex_hash(k);
  if e.id is null then perform pg_sleep(0.4); raise exception 'bad_key' using errcode = '42501'; end if; return e;
end $$;
revoke all on function public._ex_auth(uuid, text) from public, anon, authenticated;
create or replace function public.expert_me(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.experts_profiles := public._ex_auth(nullif(p ->> 'id', '')::uuid, p ->> 'key');
begin
  return public._ex_card(e, true) || jsonb_build_object('whatsapp', e.whatsapp, 'status', e.status, 'note', e.admin_note, 'contacts', e.contacts_count, 'cat_id', e.category_id);
end $$;
-- تعديل الملف: تغيير الاسم/العنوان/النبذة/المعرض يعيد الملف المعتمد إلى «بانتظار الموافقة» (إشراف على المحتوى)
create or replace function public.expert_update(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.experts_profiles := public._ex_auth(nullif(p ->> 'id', '')::uuid, p ->> 'key'); f record; nm text; hl text; bi text; ns text; moderated boolean;
begin
  if octet_length(p::text) > 1300000 then raise exception 'too_large' using errcode = '22023'; end if;
  if e.status in ('suspended', 'rejected') then raise exception 'locked' using errcode = '42501'; end if;
  select * into f from public._ex_fields(p);
  nm := public._ex_txt(p ->> 'name', 80); hl := public._ex_txt(p ->> 'headline', 120); bi := public._ex_txt(p ->> 'bio', 1500);
  if char_length(nm) < 2 or char_length(hl) < 4 then raise exception 'bad_name' using errcode = '22023'; end if;
  if f.wa <> e.whatsapp and exists (select 1 from public.experts_profiles where whatsapp = f.wa) then raise exception 'already_registered' using errcode = '23505'; end if;
  moderated := nm <> e.display_name or hl <> e.headline or bi <> e.bio or f.port <> e.portfolio;
  ns := case when e.status = 'approved' and moderated then 'pending' else e.status end;
  update public.experts_profiles set display_name = nm, headline = hl, bio = bi, category_id = f.cat, wilaya = nullif(p ->> 'wilaya', '')::int, city = public._ex_txt(p ->> 'city', 60),
    remote = coalesce(p ->> 'remote', 'true') <> 'false', rate_type = f.rt, rate_from = f.rf, rate_to = f.rto, currency = case when (p ->> 'cur') ~ '^[A-Z]{3}$' then p ->> 'cur' else currency end,
    whatsapp = f.wa, socials = f.soc, portfolio = f.port, languages = public._ex_langs(p), status = ns, updated_at = now(),
    thumb = case when p ? 'thumb' then (case when (p ->> 'thumb') ~ '^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$' and char_length(p ->> 'thumb') <= 40000 then p ->> 'thumb' else '' end) else thumb end
    where id = e.id;
  return jsonb_build_object('status', ns, 'reviewed_again', ns <> e.status);
end $$;
-- إيقاف/استئناف ظهور الملف بيد صاحبه
create or replace function public.expert_pause(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.experts_profiles := public._ex_auth(nullif(p ->> 'id', '')::uuid, p ->> 'key'); ns text;
begin
  if e.status not in ('approved', 'paused') then raise exception 'locked' using errcode = '42501'; end if;
  ns := case when coalesce(p ->> 'paused', 'true') = 'true' then 'paused' else 'approved' end;
  update public.experts_profiles set status = ns, updated_at = now() where id = e.id; return jsonb_build_object('status', ns);
end $$;
-- حذف كامل (حق المحو): الملف والتقييمات وسجلّ التواصل
create or replace function public.expert_delete(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.experts_profiles := public._ex_auth(nullif(p ->> 'id', '')::uuid, p ->> 'key');
begin delete from public.experts_profiles where id = e.id; return jsonb_build_object('ok', true); end $$;

-- 5) إشراف المدير (authenticated + is_saas_admin) ------------------------------------------------------------------------------------
create or replace function public.experts_admin_status(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare ns text := p ->> 'status';
begin
  if not public.is_saas_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  if ns not in ('pending', 'approved', 'rejected', 'suspended') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.experts_profiles set status = ns, admin_note = public._ex_txt(p ->> 'note', 600), updated_at = now(), approved_at = case when ns = 'approved' then now() else approved_at end where id = nullif(p ->> 'id', '')::uuid;
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.experts_admin_reset_key(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare k text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not public.is_saas_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  update public.experts_profiles set key_hash = public._ex_hash(k), updated_at = now() where id = nullif(p ->> 'id', '')::uuid;
  return jsonb_build_object('key', k);
end $$;
create or replace function public.experts_admin_verify(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_saas_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  update public.experts_profiles set verified = coalesce(p ->> 'verified', 'true') = 'true', updated_at = now() where id = nullif(p ->> 'id', '')::uuid;
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.experts_admin_review(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  if not public.is_saas_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p ->> 'status' not in ('visible', 'hidden') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.expert_reviews set status = p ->> 'status' where id = nullif(p ->> 'id', '')::uuid returning expert_id into eid;
  if eid is not null then perform public._ex_recount(eid); end if; return jsonb_build_object('ok', true);
end $$;

-- 6) الصلاحيات -----------------------------------------------------------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['experts_categories(), experts_search(jsonb)', 'expert_get(jsonb)', 'expert_contact(jsonb)', 'expert_review(jsonb)', 'expert_report(jsonb)', 'expert_register(jsonb)', 'expert_me(jsonb)', 'expert_update(jsonb)', 'expert_pause(jsonb)', 'expert_delete(jsonb)'] loop
    execute 'revoke all on function public.' || f || ' from public'; execute 'grant execute on function public.' || f || ' to anon, authenticated';
  end loop;
  foreach f in array array['experts_admin_status(jsonb)', 'experts_admin_reset_key(jsonb)', 'experts_admin_review(jsonb)', 'experts_admin_verify(jsonb)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon'; execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
