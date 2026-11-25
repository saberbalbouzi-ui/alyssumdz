-- الاستيراد المباشر لصندوق الرسائل الخاص (يُطبَّق بعد owner-inbox.sql) — للمالك فقط، ولا يدخل حزم العملاء.
-- يتيح لأداة خارجية (إجراء Custom GPT أو سكربت) إضافة رسائل مُعدّة مسبقاً إلى الصندوق دون نسخ ولصق، برمز استيراد يُنشئه المالك من اللوحة:
--   POST <المشروع>/rest/v1/rpc/owner_inbox_ingest   (ترويسات: apikey = المفتاح العام، x-ingest-token = رمز الاستيراد)
-- الرمز «للكتابة فقط»: يضيف رسائل جاهزة (ready) ولا يقرأ ولا يعدّل ولا يحذف ولا يرسل شيئاً؛ والإرسال يبقى يدوياً بيد المالك.
-- الرمز يُولَّد على الخادم ويُعرَض مرة واحدة، ويُخزَّن منه تجزئة SHA-256 فقط (لا يُحفظ نصه)، ويمكن إلغاؤه فوراً. سقف 5000 رسالة/24 ساعة لكل رمز.
-- idempotent. لا يُطبَّق على الإنتاج إلا بموافقة المالك. اختبار: scripts/test-owner-inbox-rls.sh

alter table public.owner_inbox add column if not exists source text not null default 'panel' check (char_length(source) <= 80);   -- panel | api:<اسم الرمز>

create table if not exists public.owner_inbox_tokens (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create unique index if not exists owner_inbox_tokens_label_u on public.owner_inbox_tokens (lower(label)) where revoked_at is null;
alter table public.owner_inbox_tokens enable row level security;
revoke all on public.owner_inbox_tokens from public, anon, authenticated;
grant select on public.owner_inbox_tokens to authenticated;          -- القائمة فقط؛ الإنشاء والإلغاء عبر دالتين تتحققان من المالك
drop policy if exists "owner inbox tokens read" on public.owner_inbox_tokens;
create policy "owner inbox tokens read" on public.owner_inbox_tokens for select to authenticated using (public.is_admin());

-- نواة الاستيراد (داخلية): نفس المنطق السابق مع تسجيل المصدر. لا تُستدعى مباشرة من أي دور API
create or replace function public._owner_inbox_import_core(p_batch text, p_rows jsonb, p_source text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record; v jsonb; ph text; lg text; kd text; bd text; co text; cn text; pr int; pa timestamptz; rf text; pf text;
  new_id uuid; total int := 0; ins int := 0; dup int := 0; bad int := 0; newc int := 0; oldc int := 0;
  errs jsonb := '[]'::jsonb; seen text[] := array[]::text[]; ids uuid[] := array[]::uuid[]; reason text;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'rows_must_be_array' using errcode = '22023'; end if;
  if jsonb_array_length(p_rows) > 500 then raise exception 'too_many_rows' using errcode = '22023'; end if;
  for r in select value as v, ordinality as i from jsonb_array_elements(p_rows) with ordinality loop
    total := total + 1; v := r.v; reason := null;
    begin
      if jsonb_typeof(v) <> 'object' then raise exception 'row_not_object'; end if;
      ph := regexp_replace(coalesce(v ->> 'phone', ''), '[^0-9]', '', 'g'); if left(ph, 2) = '00' then ph := substr(ph, 3); end if;
      lg := case lower(btrim(coalesce(v ->> 'language', v ->> 'lang', '')))
        when 'en' then 'en' when 'eng' then 'en' when 'english' then 'en'
        when 'fr' then 'fr' when 'fra' then 'fr' when 'french' then 'fr' when 'français' then 'fr' when 'francais' then 'fr'
        when 'ar' then 'ar' when 'ara' then 'ar' when 'arabic' then 'ar' when 'arabe' then 'ar' else null end;
      kd := case regexp_replace(lower(btrim(coalesce(v ->> 'kind', v ->> 'type', 'first_contact'))), '[\s_-]+', '_', 'g')
        when 'first_contact' then 'first_contact' when 'first' then 'first_contact' when '' then 'first_contact'
        when 'follow_up' then 'follow_up' when 'followup' then 'follow_up'
        when 'reply' then 'reply' when 'meeting' then 'meeting' when 'offer' then 'offer'
        when 'thank_you' then 'thank_you' when 'thanks' then 'thank_you' when 'closing' then 'closing' when 'other' then 'other' else 'other' end;
      bd := btrim(coalesce(v ->> 'body', v ->> 'message', ''));
      co := btrim(coalesce(v ->> 'company', '')); cn := btrim(coalesce(v ->> 'contact', v ->> 'contact_name', ''));
      rf := btrim(coalesce(v ->> 'ref', '')); pf := btrim(coalesce(v ->> 'parent_ref', v ->> 'parent', ''));
      pr := coalesce(nullif(btrim(coalesce(v ->> 'priority', '')), '')::int, 0);
      pa := coalesce(nullif(btrim(coalesce(v ->> 'prepared_at', '')), '')::timestamptz, now());
      if ph !~ '^[1-9][0-9]{7,14}$' then raise exception 'invalid_phone'; end if;
      if lg is null then raise exception 'invalid_language'; end if;
      if bd = '' then raise exception 'empty_body'; end if;
      if co = '' and cn = '' then raise exception 'company_or_contact_required'; end if;
      insert into public.owner_inbox (batch, campaign, ref, parent_ref, company, contact_name, phone, country, language, kind, subject, body, priority, prepared_at, notes, source)
      values (left(coalesce(nullif(btrim(p_batch), ''), btrim(coalesce(v ->> 'batch', ''))), 120), left(btrim(coalesce(v ->> 'campaign', '')), 120), rf, pf, co, cn, ph,
              left(btrim(coalesce(v ->> 'country', '')), 80), lg, kd, left(btrim(coalesce(v ->> 'subject', '')), 300), bd, pr, pa, left(btrim(coalesce(v ->> 'notes', '')), 2000), left(coalesce(p_source, 'panel'), 80))
      on conflict do nothing returning id into new_id;
      if new_id is null then
        dup := dup + 1;
      else
        ins := ins + 1; ids := ids || new_id;
        if not (ph = any (seen)) then
          seen := seen || ph;
          if exists (select 1 from public.owner_inbox where phone = ph and id <> new_id) then oldc := oldc + 1; else newc := newc + 1; end if;
        end if;
      end if;
    exception when others then
      bad := bad + 1; reason := sqlerrm;
      if jsonb_array_length(errs) < 50 then errs := errs || jsonb_build_array(jsonb_build_object('row', r.i, 'reason', left(reason, 120))); end if;
      new_id := null;
    end;
    new_id := null;
  end loop;
  update public.owner_inbox o set parent_id = p.id from public.owner_inbox p
    where o.id = any (ids) and o.parent_id is null and o.parent_ref <> '' and p.ref = o.parent_ref and p.id <> o.id;
  update public.owner_inbox o set parent_id = (select p.id from public.owner_inbox p where p.phone = o.phone and p.kind = 'first_contact' and p.id <> o.id and p.prepared_at <= o.prepared_at order by p.prepared_at desc limit 1)
    where o.id = any (ids) and o.parent_id is null and o.kind in ('follow_up', 'reply');
  return jsonb_build_object('total', total, 'inserted', ins, 'duplicates', dup, 'invalid', bad, 'new_contacts', newc, 'existing_contacts', oldc, 'errors', errs, 'batch', coalesce(nullif(btrim(p_batch), ''), ''));
end $$;
revoke all on function public._owner_inbox_import_core(text, jsonb, text) from public, anon, authenticated;

-- استيراد اللوحة (المالك بجلسته) = النواة + التحقق من المالك
create or replace function public.owner_inbox_import(p_batch text, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  return public._owner_inbox_import_core(p_batch, p_rows, 'panel');
end $$;
revoke all on function public.owner_inbox_import(text, jsonb) from public, anon;
grant execute on function public.owner_inbox_import(text, jsonb) to authenticated;

-- الاستيراد المباشر برمز: يُقرأ الرمز من ترويسة x-ingest-token، ويُقارَن بتجزئته؛ رسالة خطأ واحدة لأي رمز غير صالح (مفقود/خاطئ/ملغى)
create or replace function public.owner_inbox_ingest(p_batch text, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare tok text; t record; n int;
begin
  tok := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-ingest-token';
  if tok is null or char_length(tok) < 40 or char_length(tok) > 200 then raise exception 'invalid_token' using errcode = '28000'; end if;
  select id, label into t from public.owner_inbox_tokens where token_hash = encode(sha256(convert_to(tok, 'utf8')), 'hex') and revoked_at is null;
  if not found then raise exception 'invalid_token' using errcode = '28000'; end if;
  select count(*) into n from public.owner_inbox where source = 'api:' || t.label and created_at > now() - interval '24 hours';
  if n >= 5000 then raise exception 'daily_cap_reached' using errcode = '53400'; end if;
  update public.owner_inbox_tokens set last_used_at = now() where id = t.id;
  return public._owner_inbox_import_core(p_batch, p_rows, 'api:' || t.label);
end $$;
revoke all on function public.owner_inbox_ingest(text, jsonb) from public;
grant execute on function public.owner_inbox_ingest(text, jsonb) to anon, authenticated;

-- إنشاء رمز (المالك فقط): يُرجع الرمز مرة واحدة ولا يُحفظ نصه
create or replace function public.owner_inbox_token_create(p_label text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare tok text; tid uuid; lb text := btrim(coalesce(p_label, ''));
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  if char_length(lb) < 1 or char_length(lb) > 60 then raise exception 'invalid_label' using errcode = '22023'; end if;
  if (select count(*) from public.owner_inbox_tokens where revoked_at is null) >= 10 then raise exception 'too_many_tokens' using errcode = '53400'; end if;
  tok := 'oi_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.owner_inbox_tokens (label, token_hash) values (lb, encode(sha256(convert_to(tok, 'utf8')), 'hex')) returning id into tid;
  return jsonb_build_object('id', tid, 'label', lb, 'token', tok);
end $$;
revoke all on function public.owner_inbox_token_create(text) from public, anon;
grant execute on function public.owner_inbox_token_create(text) to authenticated;

create or replace function public.owner_inbox_token_revoke(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  update public.owner_inbox_tokens set revoked_at = now() where id = p_id and revoked_at is null;
  get diagnostics n = row_count; return n = 1;
end $$;
revoke all on function public.owner_inbox_token_revoke(uuid) from public, anon;
grant execute on function public.owner_inbox_token_revoke(uuid) to authenticated;
