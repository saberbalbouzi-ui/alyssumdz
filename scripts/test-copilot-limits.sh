#!/bin/bash
# يختبر platform/sql/copilot-ai-limits.sql على Postgres محلي مؤقت بطلبات متزامنة حقيقية (جلسات psql متوازية). لا يمسّ أي مشروع حقيقي.
set -e; R="$(cd "$(dirname "$0")/.." && pwd)"; D=/var/tmp/pgx-cplim; PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
rm -rf $D; mkdir -p $D; chown postgres $D
su postgres -c "$PGBIN/initdb -D $D/data -A trust >/dev/null && $PGBIN/pg_ctl -D $D/data -o '-p 5546 -k $D -c max_connections=300' -l $D/log start >/dev/null"
trap "su postgres -c \"$PGBIN/pg_ctl -D $D/data stop -m immediate >/dev/null\"; rm -rf $D /tmp/cplim.*" EXIT
sleep 2; P="psql -h $D -p 5546 -U postgres -q -t -A"
$P -c "create database t" ; P="$P -d t"
$P -c "create role anon nologin; create role authenticated nologin; create role service_role nologin; create schema auth; create function auth.jwt() returns jsonb language sql stable as \$\$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb \$\$; grant usage on schema public, auth to anon, authenticated, service_role; grant execute on function auth.jwt() to anon, authenticated; create publication supabase_realtime;" 2>/dev/null
$P -f $R/platform/sql/schema.sql >/dev/null 2>&1 || true
$P -c "select 1 from public.saas_sites limit 0" >/dev/null || { echo "schema.sql لم يُطبَّق"; exit 2; }
$P -f $R/platform/sql/copilot-ai-limits.sql >/dev/null
$P -f $R/platform/sql/copilot-ai-limits.sql >/dev/null && echo "idempotent: OK"
export -f 2>/dev/null || true
. $R/scripts/test-copilot-limits.lib.sh
