-- صندوق الرسائل الخاص بالمالك (Owner Private Message Inbox) — لمتجر المالك فقط، ولا يدخل حزم العملاء.
-- يستقبل رسائل مُعدّة مسبقاً (دفعات CSV/JSON) ويحوّلها إلى رسائل جاهزة للإرسال اليدوي عبر WhatsApp (wa.me).
-- لا Meta API ولا إرسال آلي: فتح WhatsApp ≠ إرسال، وحالة «sent» لا تُسجَّل إلا بتأكيد المالك مع نسخة النص المُرسَل.
-- الأمان: RLS مُفعَّلة، والمالك وحده (public.is_admin(): جدول admins + شرط المصادقة الثنائية) يقرأ ويكتب ويحذف،
-- والاستيراد الجماعي دالة خادمية تتحقق من المالك ومن كل حقل. لا وصول لـanon ولا للموظفين ولا للعملاء.
-- idempotent: يمكن إعادة تشغيله. لا يُطبَّق على الإنتاج إلا بموافقة المالك. اختبار: scripts/test-owner-inbox-rls.sh

create table if not exists public.owner_inbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),              -- وقت دخول الرسالة إلى الصندوق
  prepared_at timestamptz not null default now(),             -- تاريخ إعداد الرسالة (من الدفعة)
  updated_at timestamptz not null default now(),
  batch text not null default '' check (char_length(batch) <= 120),
  campaign text not null default '' check (char_length(campaign) <= 120),
  ref text not null default '' check (char_length(ref) <= 120),              -- معرّف الرسالة من الدفعة (اختياري، فريد)
  parent_ref text not null default '' check (char_length(parent_ref) <= 120),-- معرّف الرسالة الأم (للمتابعات)
  parent_id uuid references public.owner_inbox (id) on delete set null,
  company text not null default '' check (char_length(company) <= 200),
  contact_name text not null default '' check (char_length(contact_name) <= 200),
  phone text not null check (phone ~ '^[1-9][0-9]{7,14}$'),                  -- دولي بأرقام فقط (بلا + ولا 00)
  country text not null default '' check (char_length(country) <= 80),
  language text not null check (language in ('en', 'fr', 'ar')),
  kind text not null default 'first_contact' check (kind in ('first_contact', 'follow_up', 'reply', 'meeting', 'offer', 'thank_you', 'closing', 'other')),
  subject text not null default '' check (char_length(subject) <= 300),
  body text not null check (char_length(btrim(body)) between 1 and 8000),     -- النص النهائي المخصَّص
  priority smallint not null default 0 check (priority between 0 and 9),     -- الأعلى أولاً
  status text not null default 'ready' check (status in ('ready', 'opened', 'sent', 'waiting', 'positive', 'negative', 'followup', 'cancelled')),
  opened_at timestamptz,
  sent_at timestamptz,
  sent_body text check (sent_body is null or char_length(btrim(sent_body)) between 1 and 8000),   -- نسخة النص الذي أُرسل فعلاً
  notes text not null default '' check (char_length(notes) <= 2000),
  body_hash text generated always as (md5(lower(regexp_replace(btrim(body), '\s+', ' ', 'g')))) stored,
  constraint owner_inbox_who check (company <> '' or contact_name <> '')
);
-- منع التكرار بالخطأ: نفس النص لنفس الرقم، ونفس المعرّف
create unique index if not exists owner_inbox_dedupe on public.owner_inbox (phone, body_hash);
create unique index if not exists owner_inbox_ref_u on public.owner_inbox (ref) where ref <> '';
create index if not exists owner_inbox_status_i on public.owner_inbox (status, priority desc, prepared_at);
create index if not exists owner_inbox_phone_i on public.owner_inbox (phone);
create index if not exists owner_inbox_company_i on public.owner_inbox (company);
create index if not exists owner_inbox_campaign_i on public.owner_inbox (campaign);

-- سجل تغيّر الحالات (يكتبه المُشغِّل فقط؛ للمالك قراءته وحذفه بالتتالي مع الرسالة)
create table if not exists public.owner_inbox_log (
  id bigint generated always as identity primary key,
  message_id uuid not null references public.owner_inbox (id) on delete cascade,
  at timestamptz not null default now(),
  from_status text,
  to_status text not null,
  note text not null default ''
);
create index if not exists owner_inbox_log_msg_i on public.owner_inbox_log (message_id, at);

-- قواعد الحالة على الخادم: الإدخال دائماً «ready»؛ «sent» لا تُسجَّل بلا نسخة النص المُرسَل؛ لا رجوع من «sent» إلى ready/opened؛
-- لا تعديل لنص رسالة بعد إرسالها (النسخة المُرسَلة محفوظة في sent_body)
create or replace function public._owner_inbox_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'ready'; new.opened_at := null; new.sent_at := null; new.sent_body := null; new.updated_at := now();
    return new;
  end if;
  new.updated_at := now();
  if new.phone <> old.phone then raise exception 'phone_immutable' using errcode = '23514'; end if;
  if new.status <> old.status then
    if new.status = 'sent' then
      if new.sent_body is null or char_length(btrim(new.sent_body)) = 0 then raise exception 'sent_requires_sent_body' using errcode = '23514'; end if;
      if old.status = 'cancelled' then raise exception 'cancelled_cannot_be_sent' using errcode = '23514'; end if;
      new.sent_at := coalesce(new.sent_at, now());
    elsif old.status = 'sent' and new.status in ('ready', 'opened') then
      raise exception 'sent_is_final' using errcode = '23514';
    elsif new.status = 'opened' then
      new.opened_at := coalesce(new.opened_at, now());
    end if;
  else
    -- بلا تغيير حالة: لا يجوز لمس نسخة المُرسَل ولا تاريخه
    new.sent_body := old.sent_body; new.sent_at := old.sent_at;
  end if;
  if old.status in ('sent', 'waiting', 'positive', 'negative', 'followup') and (new.body is distinct from old.body) then
    raise exception 'body_locked_after_send' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public._owner_inbox_guard() from public, anon, authenticated;
drop trigger if exists owner_inbox_guard on public.owner_inbox;
create trigger owner_inbox_guard before insert or update on public.owner_inbox for each row execute function public._owner_inbox_guard();

create or replace function public._owner_inbox_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.owner_inbox_log (message_id, from_status, to_status) values (new.id, null, new.status);
  elsif new.status <> old.status then
    insert into public.owner_inbox_log (message_id, from_status, to_status) values (new.id, old.status, new.status);
  end if;
  return null;
end $$;
revoke all on function public._owner_inbox_log() from public, anon, authenticated;
drop trigger if exists owner_inbox_log on public.owner_inbox;
create trigger owner_inbox_log after insert or update on public.owner_inbox for each row execute function public._owner_inbox_log();

-- RLS مفعَّلة على الجدولين (أدوار API anon/authenticated خاضعة لها دائماً)؛ المالك وحده. لا FORCE: تبقى المشغِّلات والحذف بالتتالي والصيانة بدور الخدمة سليمة
alter table public.owner_inbox enable row level security;
alter table public.owner_inbox_log enable row level security;
revoke all on public.owner_inbox, public.owner_inbox_log from public, anon, authenticated;
grant select, insert, update, delete on public.owner_inbox to authenticated;
grant select on public.owner_inbox_log to authenticated;
drop policy if exists "owner inbox all" on public.owner_inbox;
create policy "owner inbox all" on public.owner_inbox for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "owner inbox log read" on public.owner_inbox_log;
create policy "owner inbox log read" on public.owner_inbox_log for select to authenticated using (public.is_admin());

-- استيراد دفعة: p_rows مصفوفة JSON (حتى 500 صفّ). يتحقق من المالك ومن كل صفّ، ويتخطّى المكرَّر، ويربط المتابعات بأمّها، ويُرجع تقريراً.
-- حقول الصفّ: ref, parent_ref, company, contact (أو contact_name), phone (دولي), country, language (en|fr|ar), kind, subject, body (أو message),
--             priority (0-9), prepared_at (ISO)، campaign، notes
create or replace function public.owner_inbox_import(p_batch text, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record; v jsonb; ph text; lg text; kd text; bd text; co text; cn text; pr int; pa timestamptz; rf text; pf text;
  new_id uuid; total int := 0; ins int := 0; dup int := 0; bad int := 0; newc int := 0; oldc int := 0;
  errs jsonb := '[]'::jsonb; seen text[] := array[]::text[]; ids uuid[] := array[]::uuid[]; reason text;
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
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
      insert into public.owner_inbox (batch, campaign, ref, parent_ref, company, contact_name, phone, country, language, kind, subject, body, priority, prepared_at, notes)
      values (left(coalesce(nullif(btrim(p_batch), ''), btrim(coalesce(v ->> 'batch', ''))), 120), left(btrim(coalesce(v ->> 'campaign', '')), 120), rf, pf, co, cn, ph,
              left(btrim(coalesce(v ->> 'country', '')), 80), lg, kd, left(btrim(coalesce(v ->> 'subject', '')), 300), bd, pr, pa, left(btrim(coalesce(v ->> 'notes', '')), 2000))
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
  -- ربط المتابعات: بالمعرّف الأم إن وُجد، وإلا بآخر «أول تواصل» لنفس الرقم
  update public.owner_inbox o set parent_id = p.id from public.owner_inbox p
    where o.id = any (ids) and o.parent_id is null and o.parent_ref <> '' and p.ref = o.parent_ref and p.id <> o.id;
  update public.owner_inbox o set parent_id = (select p.id from public.owner_inbox p where p.phone = o.phone and p.kind = 'first_contact' and p.id <> o.id and p.prepared_at <= o.prepared_at order by p.prepared_at desc limit 1)
    where o.id = any (ids) and o.parent_id is null and o.kind in ('follow_up', 'reply');
  return jsonb_build_object('total', total, 'inserted', ins, 'duplicates', dup, 'invalid', bad, 'new_contacts', newc, 'existing_contacts', oldc, 'errors', errs, 'batch', coalesce(nullif(btrim(p_batch), ''), ''));
end $$;
revoke all on function public.owner_inbox_import(text, jsonb) from public, anon;
grant execute on function public.owner_inbox_import(text, jsonb) to authenticated;
