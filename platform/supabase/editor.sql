-- ════════════════════════════════════════════════════════════════════
-- محرر التصميم /editor/ — المرحلة 2: مشاريع + إصدارات + أصول (Supabase)
-- • الوصول بمفتاح خاص بالمحرر (ليس حساب المدير): يُخزَّن هنا sha256 المفتاح فقط، ولا يوجد المفتاح في أي ملف.
-- • الجداول في مخطّط `editor` غير المكشوف للـAPI ومفعّل عليها RLS بلا سياسات: لا قراءة ولا كتابة مباشرة.
-- • كل شيء عبر دوال public.editor_* (security definer) تتحقق من المفتاح؛ محاولات خاطئة تُبطَّأ وتُحدّ.
-- • الصور في Storage (حاوية editor عامة القراءة بمسارات uuid غير قابلة للتخمين)، والرفع فقط إلى مسار «مأذون» مسبقاً بدالة تتحقق من المفتاح.
-- شغّله في SQL Editor (يمكن إعادة تشغيله). ثم عيّن مفتاحك مرة واحدة:   select editor.set_key('مفتاح-طويل-سري-من-16-حرفاً-فأكثر');
-- ════════════════════════════════════════════════════════════════════
create extension if not exists pgcrypto with schema extensions;
create schema if not exists editor;
revoke all on schema editor from public;

create table if not exists editor.keys (id int primary key default 1 check (id = 1), key_hash text not null, updated_at timestamptz not null default now());
create table if not exists editor.fails (at timestamptz not null default now());
create table if not exists editor.projects (id uuid primary key default gen_random_uuid(), name text not null, width int not null default 1080, height int not null default 3000, thumbnail text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists editor.designs (id uuid primary key default gen_random_uuid(), project_id uuid not null references editor.projects(id) on delete cascade, version int not null, canvas_json jsonb not null, thumbnail text, created_at timestamptz not null default now(), unique (project_id, version));
create table if not exists editor.assets (id uuid primary key default gen_random_uuid(), project_id uuid not null references editor.projects(id) on delete cascade, type text not null default 'image', file_path text not null unique, original_name text, width int, height int, created_at timestamptz not null default now());
create table if not exists editor.upload_grants (path text primary key, project_id uuid not null, expires_at timestamptz not null);
alter table editor.keys enable row level security;       alter table editor.fails enable row level security;
alter table editor.projects enable row level security;   alter table editor.designs enable row level security;
alter table editor.assets enable row level security;     alter table editor.upload_grants enable row level security;
create index if not exists editor_fails_at on editor.fails (at);
create index if not exists editor_designs_p on editor.designs (project_id, version desc);

-- تعيين/تغيير المفتاح (من SQL Editor فقط؛ المخطّط غير مكشوف للـAPI)
create or replace function editor.set_key(k text) returns void language plpgsql security definer set search_path = editor, public, extensions as $$
begin
  if k is null or length(k) < 16 then raise exception 'المفتاح قصير: 16 حرفاً على الأقل'; end if;
  insert into editor.keys (id, key_hash) values (1, encode(digest(k, 'sha256'), 'hex'))
  on conflict (id) do update set key_hash = excluded.key_hash, updated_at = now();
end $$;

-- التحقق من المفتاح: كل فشل يُبطَّأ (يتصاعد حتى 2ث مع كثرة الفشل الأخير)؛ المفتاح الصحيح لا يُحجب أبداً (لا قفل يمكن استغلاله لمنعك)
create or replace function editor._auth(k text) returns void language plpgsql security definer set search_path = editor, public, extensions as $$
declare h text; n int;
begin
  select key_hash into h from editor.keys where id = 1;
  if h is null or k is null or encode(digest(k, 'sha256'), 'hex') <> h then
    delete from editor.fails where at < now() - interval '1 day';
    select count(*) into n from editor.fails where at > now() - interval '10 minutes';
    insert into editor.fails default values; perform pg_sleep(least(0.3 + n * 0.05, 2)); raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create or replace function public.editor_ping(p jsonb) returns boolean language plpgsql security definer set search_path = editor, public, extensions as $$
begin perform editor._auth(p->>'key'); return true; end $$;

create or replace function public.editor_projects(p jsonb) returns jsonb language plpgsql security definer set search_path = editor, public, extensions as $$
begin
  perform editor._auth(p->>'key');
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'width', x.width, 'height', x.height, 'thumbnail', x.thumbnail, 'updated_at', x.updated_at,
           'versions', (select count(*) from editor.designs d where d.project_id = x.id)) order by x.updated_at desc) from editor.projects x), '[]'::jsonb);
end $$;

create or replace function public.editor_project_create(p jsonb) returns jsonb language plpgsql security definer set search_path = editor, public, extensions as $$
declare r editor.projects;
begin
  perform editor._auth(p->>'key');
  insert into editor.projects (name, width, height) values (left(coalesce(nullif(trim(p->>'name'), ''), 'مشروع بلا اسم'), 80), least(greatest(coalesce((p->>'width')::int, 1080), 100), 12000), least(greatest(coalesce((p->>'height')::int, 3000), 100), 24000)) returning * into r;
  return jsonb_build_object('id', r.id, 'name', r.name);
end $$;

create or replace function public.editor_project_rename(p jsonb) returns boolean language plpgsql security definer set search_path = editor, public, extensions as $$
begin perform editor._auth(p->>'key'); update editor.projects set name = left(coalesce(nullif(trim(p->>'name'), ''), name), 80), updated_at = now() where id = (p->>'id')::uuid; return found; end $$;

-- حذف مشروع بكل إصداراته وأصوله (ملفات Storage تبقى يتيمة: احذفها من لوحة Storage إن أردت)
create or replace function public.editor_project_delete(p jsonb) returns boolean language plpgsql security definer set search_path = editor, public, extensions as $$
begin perform editor._auth(p->>'key'); delete from editor.upload_grants where project_id = (p->>'id')::uuid; delete from editor.projects where id = (p->>'id')::uuid; return found; end $$;

-- حفظ إصدار جديد (يُبقي آخر 30)
create or replace function public.editor_design_save(p jsonb) returns jsonb language plpgsql security definer set search_path = editor, public, extensions as $$
declare pid uuid := (p->>'project')::uuid; v int; doc jsonb := p->'doc';
begin
  perform editor._auth(p->>'key');
  if doc is null or jsonb_typeof(doc) <> 'object' or coalesce(doc->>'format', '') <> 'alyssum-editor' then raise exception 'تصميم غير صالح'; end if;
  if pg_column_size(doc) > 6000000 then raise exception 'التصميم كبير جداً (يجب ألا تُضمَّن الصور داخله)'; end if;
  if not exists (select 1 from editor.projects where id = pid) then raise exception 'المشروع غير موجود'; end if;
  select coalesce(max(version), 0) + 1 into v from editor.designs where project_id = pid;
  insert into editor.designs (project_id, version, canvas_json, thumbnail) values (pid, v, doc, left(p->>'thumb', 120000));
  delete from editor.designs where project_id = pid and version <= v - 30;
  update editor.projects set updated_at = now(), width = coalesce((doc->>'width')::int, width), height = coalesce((doc->>'height')::int, height), thumbnail = coalesce(left(p->>'thumb', 120000), thumbnail) where id = pid;
  return jsonb_build_object('version', v);
end $$;

create or replace function public.editor_design_load(p jsonb) returns jsonb language plpgsql security definer set search_path = editor, public, extensions as $$
declare d editor.designs; pid uuid := (p->>'project')::uuid;
begin
  perform editor._auth(p->>'key');
  select * into d from editor.designs where project_id = pid and (p->>'version' is null or version = (p->>'version')::int) order by version desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object('version', d.version, 'created_at', d.created_at, 'doc', d.canvas_json);
end $$;

create or replace function public.editor_versions(p jsonb) returns jsonb language plpgsql security definer set search_path = editor, public, extensions as $$
begin
  perform editor._auth(p->>'key');
  return coalesce((select jsonb_agg(jsonb_build_object('version', version, 'created_at', created_at, 'thumbnail', thumbnail) order by version desc) from editor.designs where project_id = (p->>'project')::uuid), '[]'::jsonb);
end $$;

-- إذن رفع صورة: مسار عشوائي صالح 10 دقائق لا يكتب غيره في Storage
create or replace function public.editor_asset_grant(p jsonb) returns jsonb language plpgsql security definer set search_path = editor, public, extensions as $$
declare pid uuid := (p->>'project')::uuid; ext text := lower(coalesce(p->>'ext', '')); path text;
begin
  perform editor._auth(p->>'key');
  if ext not in ('webp', 'png', 'jpg', 'jpeg', 'gif') then raise exception 'نوع ملف غير مسموح'; end if;
  if not exists (select 1 from editor.projects where id = pid) then raise exception 'المشروع غير موجود'; end if;
  delete from editor.upload_grants where expires_at < now();
  path := 'projects/' || pid || '/' || gen_random_uuid() || '.' || ext;
  insert into editor.upload_grants (path, project_id, expires_at) values (path, pid, now() + interval '10 minutes');
  insert into editor.assets (project_id, file_path, original_name, width, height) values (pid, path, left(regexp_replace(coalesce(p->>'name', ''), '[^\w.\- ]', '_', 'g'), 80), (p->>'w')::int, (p->>'h')::int);
  return jsonb_build_object('path', path);
end $$;

-- سياسة Storage: الإدراج فقط في مسار مأذون
create or replace function editor.can_upload(n text) returns boolean language sql security definer stable set search_path = editor, public as $$
  select exists (select 1 from editor.upload_grants g where g.path = n and g.expires_at > now());
$$;

do $$ begin
  if to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('editor', 'editor', true, 12582912, array['image/webp', 'image/png', 'image/jpeg', 'image/gif'])
    on conflict (id) do update set public = true, file_size_limit = 12582912, allowed_mime_types = array['image/webp', 'image/png', 'image/jpeg', 'image/gif'];
    drop policy if exists editor_upload on storage.objects;
    create policy editor_upload on storage.objects for insert to anon, authenticated with check (bucket_id = 'editor' and editor.can_upload(name));
  end if;
end $$;

grant usage on schema editor to anon, authenticated;
revoke all on all functions in schema editor from public;
grant execute on function editor.can_upload(text) to anon, authenticated;
do $$ declare f text; begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'editor\_%' loop
    execute 'revoke all on function ' || f || ' from public'; execute 'grant execute on function ' || f || ' to anon, authenticated';
  end loop;
end $$;
