#!/bin/bash
# اختبار idempotency/تصادم/تراجع/تزامن لدالة submit_order على PostgreSQL محلي معزول (ليس Supabase الحقيقي — الحالة القصوى PARTIAL).
# يبني عنقوداً مؤقتاً (مقبس محلي فقط)، يضيف هيكل auth/storage/extensions الأدنى، يطبّق ملفات المخطط، ثم يشغّل ملفات order-idem-*.sql. لا يمس أي مشروع Supabase.
set -e; HERE="$(cd "$(dirname "$0")" && pwd)"; PL="$HERE/../../.."; B=${PGBIN:-/usr/lib/postgresql/16/bin}; D=${PGTMP:-/tmp/pg13}; P=${PGPORT_LOCAL:-5498}
[ -x "$B/initdb" ] || { echo "BLOCKED: PostgreSQL غير متوفر ($B)"; exit 3; }
rm -rf $D; mkdir -p $D && chown postgres:postgres $D; su postgres -c "$B/initdb -D $D/data -A trust >/dev/null 2>&1"; su postgres -c "$B/pg_ctl -D $D/data -o '-p $P -k $D -c listen_addresses=' -l $D/pg.log start" >/dev/null; sleep 3
Q="psql -h $D -p $P -U postgres"; su postgres -c "createdb -h $D -p $P rls"
$Q -d rls -q -v ON_ERROR_STOP=1 -f $HERE/bootstrap.sql; $Q -d rls -q -f $HERE/bootstrap2.sql
for f in supabase/schema.sql sql/schema.sql supabase/roles.sql supabase/hub.sql supabase/hardening-v01.sql supabase/hardening-v01b.sql; do $Q -d rls -q -f $PL/$f 2>&1 | grep -i error || true; done 2>/dev/null
$Q -d rls -At -F ' | ' -f $HERE/order-idem-basic.sql 2>&1 | grep -v "^SET\|^CREATE"
$Q -d rls -At -F ' | ' -f $HERE/order-idem-collide.sql 2>&1 | grep -v "^SET\|^CREATE\|^DROP\|NOTICE\|^INSERT"
$Q -d rls -Atc "select count(*) from public.orders where phone='0550200004'" | sed 's/^/orders_after_retry=/'
for i in $(seq 1 12); do ( $Q -d rls -At -f $HERE/order-idem-concurrent-one.sql 2>&1 | grep -E "^S[0-9]|ERROR" | head -1 > $D/conc.$i ) & done; wait
echo "concurrent_distinct_ids=$(cat $D/conc.* | sort -u | wc -l) responses=$(cat $D/conc.* | wc -l)"; $Q -d rls -Atc "select count(*) from public.orders where phone='0550300001'" | sed 's/^/concurrent_orders=/'
su postgres -c "$B/pg_ctl -D $D/data stop" >/dev/null
