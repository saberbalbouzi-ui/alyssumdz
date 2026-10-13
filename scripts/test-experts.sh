#!/bin/bash
# يختبر supabase/experts.sql على Postgres محلي مؤقت (يحتاج حزم postgresql-16 وحساب النظام postgres). لا يمسّ أي مشروع حقيقي.
set -e; R="$(cd "$(dirname "$0")/.." && pwd)"; D=/var/tmp/pgx-exp; PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
rm -rf $D; mkdir -p $D; chown postgres $D
su postgres -c "$PGBIN/initdb -D $D/data -A trust >/dev/null && $PGBIN/pg_ctl -D $D/data -o '-p 5545 -k $D' -l $D/log start >/dev/null"
trap "su postgres -c \"$PGBIN/pg_ctl -D $D/data stop -m immediate >/dev/null\"; rm -rf $D" EXIT
sleep 2; P="psql -h $D -p 5545 -U postgres -q"
$P -c "create database t" ; P="$P -d t"
$P -c "create role anon nologin; create role authenticated nologin; create schema auth; create function auth.jwt() returns jsonb language sql stable as \$\$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb \$\$; grant usage on schema public, auth to anon, authenticated; grant execute on function auth.jwt() to anon, authenticated; create publication supabase_realtime;" 2>/dev/null
$P -f $R/saas/schema.sql >/dev/null 2>&1 || true
$P -f $R/supabase/experts.sql >/dev/null
$P -f $R/scripts/test-experts.sql | tee /tmp/experts-sql.out
F=$(grep -c "FAIL" /tmp/experts-sql.out || true); T=$(grep -cE "PASS|FAIL" /tmp/experts-sql.out)
echo "الخبراء SQL: $((T-F)) من $T"; [ "$F" = "0" ]
