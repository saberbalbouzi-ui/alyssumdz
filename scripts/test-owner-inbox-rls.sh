#!/usr/bin/env bash
# يختبر هجرة صندوق الرسائل الخاص (platform/supabase/owner-inbox.sql) وسياسات RLS على Postgres محلي مؤقت (لا الإنتاج أبداً).
# يُجهّز بيئة شبيهة بـSupabase: مخطط auth (jwt/uid/mfa_factors) وأدوار anon/authenticated وجدول admins ودالتا _aal_ok وis_admin الحقيقيتان من roles.sql،
# ثم يطبّق الهجرة مرتين (idempotent) ويشغّل platform/supabase/tests/owner-inbox-test.sql. يتطلب Postgres 16 مثبَّتاً (psql/initdb) ومستخدم postgres.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)"; [ -x "$BIN/initdb" ] || { echo "Postgres غير مثبَّت"; exit 2; }
D="$(mktemp -d /tmp/pgoi.XXXXXX)"; chown postgres "$D"; PORT=55432
run() { su postgres -c "$*"; }
cleanup() { run "$BIN/pg_ctl -D $D/data stop -m immediate >/dev/null 2>&1"; rm -rf "$D"; }
[ -n "${KEEP:-}" ] || trap cleanup EXIT
run "$BIN/initdb -D $D/data -A trust -U postgres >/dev/null" || exit 2
run "$BIN/pg_ctl -D $D/data -o '-p $PORT -k $D -c listen_addresses=' -l $D/log -w start >/dev/null" || { cat "$D/log"; exit 2; }
PSQL="$BIN/psql -h $D -p $PORT -U postgres -X -q -v ON_ERROR_STOP=1 -t -A"
SETUP="$D/setup.sql"; { cat <<'EOS'
create role anon nologin; create role authenticated nologin;
create schema auth; grant usage on schema auth to anon, authenticated;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create table auth.mfa_factors (user_id uuid, status text);
create table public.admins (email text primary key);
grant usage on schema public to anon, authenticated;
EOS
sed -n '10,24p' "$ROOT/platform/supabase/roles.sql"; } > "$SETUP"
chmod a+r "$SETUP" "$ROOT/platform/supabase/owner-inbox.sql" "$ROOT/platform/supabase/tests/owner-inbox-test.sql"
run "$PSQL -f $SETUP" || exit 2
run "$PSQL -f $ROOT/platform/supabase/owner-inbox.sql" || { echo "فشل تطبيق الهجرة"; exit 1; }
run "$PSQL -f $ROOT/platform/supabase/owner-inbox.sql" || { echo "فشلت إعادة التطبيق (الهجرة ليست idempotent)"; exit 1; }
OUT="$(run "$PSQL -f $ROOT/platform/supabase/tests/owner-inbox-test.sql" 2>&1)"; echo "$OUT"
echo "$OUT" | grep -q '^FAIL' && exit 1
echo "$OUT" | grep -q '^SUMMARY' || exit 1
exit 0
