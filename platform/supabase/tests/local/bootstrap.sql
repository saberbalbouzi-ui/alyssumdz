-- هيكل Supabase أدنى محلي (ليس Supabase الحقيقي): أدوار + مخطط auth + extensions
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role authenticator noinherit login; grant anon, authenticated, service_role to authenticator;
create schema extensions; create extension pgcrypto with schema extensions; create extension if not exists "uuid-ossp" with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create schema auth; create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_app_meta_data jsonb default '{}'::jsonb);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(auth.jwt() ->> 'role', 'anon') $$;
create function auth.email() returns text language sql stable as $$ select auth.jwt() ->> 'email' $$;
grant usage on schema auth to anon, authenticated, service_role, public;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
