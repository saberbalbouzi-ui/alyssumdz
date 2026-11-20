#!/usr/bin/env bash
# مجموعة اختبارات Spatial OS لـCI (ويُشغَّل محلياً بالنتيجة نفسها). التشغيل من أي مكان:  bash admin-preview/spatial-os/test/ci-run.sh
# ما يُشغَّل: فقط ما لا يعتمد على GPU حقيقي ولا ميكروفون/أجهزة صوت حقيقية ولا Safari/WebKit/Firefox ولا نموذج لغوي (محوّل LoRA) ولا خدمات خارجية.
#  • المتصفح = Chromium برمجي (SwiftShader) عبر Playwright؛ WebGL فيه محاكاة برمجية لا GPU حقيقي.
#  • phase11 يستعمل ميكروفوناً **وهمياً** (--use-fake-device-for-media-stream + ملفات wav) لا جهازاً حقيقياً.
#  • لا يُشغَّل هنا (يبقى NOT TESTED في CI): phase11a (يحتاج نموذج Qwen+LoRA وPyTorch ~5.6GB)، GPU حقيقي، ميكروفون/STT/TTS حقيقي، WebKit/Firefox، مزوّد LLM حقيقي، Supabase/D1/Chargily الحقيقية.
# كل خطوة تعمل حتى لو فشلت سابقتها؛ يخرج بـ1 إن فشلت أي خطوة. السجلات في $SPATIAL_LOGS (افتراضي spatial-logs) وجدول summary.tsv (الاسم، rc، ناجح، فاشل، ثوانٍ).
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"; cd "$ROOT"
LOGS="${SPATIAL_LOGS:-spatial-logs}"; rm -rf "$LOGS"; mkdir -p "$LOGS"; : > "$LOGS/summary.tsv"
export NODE_PATH="${NODE_PATH:-$PWD/node_modules}"
T=admin-preview/spatial-os/test
python3 -m http.server 8765 --bind 127.0.0.1 >"$LOGS/http-server.log" 2>&1 &
SRV=$!; trap 'kill "$SRV" 2>/dev/null' EXIT
ready=0; for _ in $(seq 1 40); do curl -sf -o /dev/null http://127.0.0.1:8765/admin-preview/spatial-os/index.html && { ready=1; break; }; sleep 0.5; done
[ "$ready" = 1 ] || { echo "::error::خادم الملفات الساكن (8765) لم يبدأ — إخفاق بيئة لا اختبار"; exit 2; }
fail=0
# run <اسم> <مهلة بالثواني> <أمر...>   — "FAIL [darija-latin]" في NLU خارج النطاق المعلن (معروض لا حاجب) فيُستثنى من العدّ
run() {
  local name="$1" to="$2"; shift 2; local t0 rc p f
  t0=$(date +%s); timeout "$to" "$@" >"$LOGS/$name.log" 2>&1; rc=$?
  p=$(grep -c '^PASS' "$LOGS/$name.log"); f=$(grep '^FAIL' "$LOGS/$name.log" | grep -vc '^FAIL \[darija-latin\]')
  printf '%s\t%s\t%s\t%s\t%s\n' "$name" "$rc" "$p" "$f" "$(( $(date +%s) - t0 ))" >> "$LOGS/summary.tsv"
  if [ "$rc" -ne 0 ]; then
    fail=1; echo "::error title=Spatial OS: $name::فشل (rc=$rc، ناجح=$p، فاشل=$f) — أول الإخفاقات:"
    grep -E '^(FAIL|FAILED|CRASH)|TimeoutError|Error:' "$LOGS/$name.log" | head -8 | cut -c1-300
  else echo "✓ $name  (ناجح=$p، فاشل=$f، $(( $(date +%s) - t0 ))ث)"; fi
}
ONLY="${SPATIAL_ONLY:-}"; want() { [ -z "$ONLY" ] || [[ ",$ONLY," == *",$1,"* ]]; }
want nlu-eval        && run nlu-eval        120 node "$T/nlu-eval.js"
want viewports       && run viewports       600 node "$T/spatial-viewports.js"
want run             && run run             900 node "$T/run.js" all
want phase9          && run phase9          900 node "$T/phase9.js" all
want phase10         && run phase10         900 node "$T/phase10.js" all
want phase11         && run phase11         900 node "$T/phase11.js"
want client-12b      && run client-12b      120 node "$T/phase12b-client.js"
want client-12b1     && run client-12b1     120 node "$T/phase12b1-client.js"
want client-12b1c    && run client-12b1c    120 node "$T/phase12b1c-client.js"
echo; echo "ملخص (اسم / rc / ناجح / فاشل / ثوانٍ):"; column -t -s $'\t' "$LOGS/summary.tsv" 2>/dev/null || cat "$LOGS/summary.tsv"
exit "$fail"
