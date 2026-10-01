#!/usr/bin/env bash
# تجهيز حزمة زبون جديد (نسخة الاستضافة PHP) بأمر واحد:
#   ./scripts/new-client.sh <اسم-الزبون-بالإنجليزية> "اسم المتجر" 2135XXXXXXXX
# النتيجة: dist/clients/<الاسم>.zip جاهز للرفع + رمز التثبيت يُطبع مرة واحدة (سلّمه للزبون وحده).
set -euo pipefail
ID="${1:?اسم الزبون (أحرف إنجليزية وأرقام وشرطة)}"; NAME="${2:?اسم المتجر}"; WA="${3:?رقم واتساب دولي}"
[[ "$ID" =~ ^[a-z0-9-]+$ ]] || { echo "الاسم يجب أن يكون a-z و0-9 و- فقط" >&2; exit 1; }
cd "$(dirname "$0")/.."
OUT="dist/clients/$ID"
rm -rf "$OUT" "dist/clients/$ID.zip"
LOG="$(python3 scripts/make-template.py --target php --out "$OUT" --name "$NAME" --wa "$WA")"
echo "$LOG" | tail -n 1
CODE="$(echo "$LOG" | grep -o '[0-9A-F]\{4\}-[0-9A-F]\{4\}-[0-9A-F]\{4\}-[0-9A-F]\{4\}' | head -n 1)"
( cd "$OUT" && python3 -c "import shutil;shutil.make_archive('../$ID','zip','.')" )
rm -rf "$OUT"
echo
echo "✅ الحزمة: dist/clients/$ID.zip"
echo "🔑 رمز التثبيت: $CODE   (لا يُحفظ في أي ملف — دوّنه الآن وسلّمه للزبون وحده)"
cat <<'T'

خطوات التسليم:
 1) الزبون يسجّل نطاقه واستضافته باسمه (أو تسجّلهما له بحسابه).
 2) ارفع محتوى الـzip إلى public_html (إدارة الملفات ← رفع ← استخراج).
 3) افتح https://النطاق/install.php مع الزبون، وأدخل الرمز وكلمة مرور يختارها هو.
 4) جرّب طلباً من صفحة المنتج التجريبي وتأكد أنه يظهر في لوحة الإدارة، ثم احذف المنتج demo.
 5) افتح https://النطاق/api/_data/store.db وتأكد أن الرد 403 أو 404 (غير قابل للتحميل).
 6) سلّم الزبون النطاق والاستضافة وكلمة المرور، وأنهِ أي وصول لك. راجع sales/CHECKLIST.md.
T
