#!/bin/bash
# اختبار RLS على PostgreSQL محلي معزول (ليس Supabase الحقيقي): يبني عنقوداً مؤقتاً بمقبس محلي فقط، يضيف هيكل auth/storage/extensions الأدنى،
# يطبّق ملفات المخطط، يشغّل tests/v01-rls-test.sql وفحوص كتابة صحيحة (dml*.sql). لا شيء يمس مشروع Supabase الإنتاجي. يتطلب PostgreSQL 16 و root (يستعمل مستخدم postgres).
set -e; HERE="$(cd "$(dirname "$0")" && pwd)"; SUP="$HERE/../.."; PL="$SUP/.."; B=${PGBIN:-/usr/lib/postgresql/16/bin}; D=${PGTMP:-/tmp/pg12}; P=${PGPORT_LOCAL:-5499}
mkdir -p $D && chown postgres:postgres $D; su postgres -c "$B/initdb -D $D/data -A trust >/dev/null 2>&1"; su postgres -c "$B/pg_ctl -D $D/data -o '-p $P -k $D -c listen_addresses=' -l $D/pg.log start" >/dev/null; sleep 3
Q="psql -h $D -p $P -U postgres"; su postgres -c "createdb -h $D -p $P rls"
$Q -d rls -q -v ON_ERROR_STOP=1 -f $HERE/bootstrap.sql; $Q -d rls -q -f $HERE/bootstrap2.sql
for f in supabase/schema.sql sql/schema.sql supabase/roles.sql supabase/hub.sql supabase/editor.sql supabase/experts.sql supabase/ruqya.sql supabase/pixabay-cache.sql supabase/hardening-v01.sql supabase/hardening-v01b.sql; do $Q -d rls -q -f $PL/$f 2>&1 | grep -i error || true; done
$Q -d rls -q -c "insert into auth.users (email) values ('owner@example.test'); insert into public.admins (email) values ('owner@example.test') on conflict do nothing;"
$Q -d rls -q -f $SUP/tests/v01-rls-test.sql 2>&1 | grep -o "RES:.*" | head -1 > $D/res.txt; python3 $HERE/analyze.py $D/res.txt
$Q -d rls -At -F ' | ' -f $HERE/dml.sql; $Q -d rls -At -F ' | ' -f $HERE/dml2.sql
su postgres -c "$B/pg_ctl -D $D/data stop" >/dev/null
