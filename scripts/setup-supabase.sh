#!/usr/bin/env bash
# تهيئة مشروع Supabase جديد (للمشتري). يحتاج: curl و python3 و Personal Access Token مؤقتاً.
#   SUPABASE_PAT=sbp_... ./scripts/setup-supabase.sh <project_ref> <admin_email>
# بعده: أنشئ المستخدم في Authentication ← Users (Auto Confirm)، ثم احذف التوكن. لا يطبع أي سر.
set -euo pipefail
REF="${1:?project_ref}"; EMAIL="${2:?admin_email}"; : "${SUPABASE_PAT:?ضع SUPABASE_PAT في البيئة}"
API="https://api.supabase.com/v1/projects/$REF"
q() { python3 -c 'import json,sys;print(json.dumps({"query":sys.stdin.read()}))' | curl -fsS -X POST "$API/database/query" -H "Authorization: Bearer $SUPABASE_PAT" -H 'Content-Type: application/json' --data @-; echo; }
cd "$(dirname "$0")/.."
echo "1) تشغيل schema.sql"; q < supabase/schema.sql
echo "2) إضافة المدير"; printf "insert into public.admins (email) values (%s) on conflict do nothing" "$(python3 -c 'import sys;print("\x27"+sys.argv[1].replace("\x27","\x27\x27")+"\x27")' "$EMAIL")" | q
echo "3) المفتاح العام (publishable) — ضعه في SUPABASE_ANON_KEY:"
curl -fsS "$API/api-keys" -H "Authorization: Bearer $SUPABASE_PAT" | python3 -c 'import sys,json;print([k["api_key"] for k in json.load(sys.stdin) if k.get("type")=="publishable"][0])'
echo "SUPABASE_URL: https://$REF.supabase.co"
