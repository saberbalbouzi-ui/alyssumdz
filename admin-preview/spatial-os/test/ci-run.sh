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
want holo-settings  && run holo-settings  900 node "$T/holo-settings.js" all   # المظهر الهولوغرافي: من الإعدادات إلى الألواح الحقيقية والعودة (مكتب + هاتف باللمس + ثابت)
want world-fast    && run world-fast    600 node "$T/world-fast.js"   # العالم الحقيقي: سرعة الفتح، المداران، بطاقات الرئيسية، اللوح الاحتياطي، جسر صوت الكرة
want laura-ui     && { if [ -n "${WRANGLER_BIN:-}" ] || command -v wrangler >/dev/null 2>&1; then run laura-ui 600 node "$T/laura-ui.js"; else skip laura-ui "يحتاج wrangler (workerd) محلياً: WRANGLER_BIN"; fi; }   # LAURA من المتصفح عبر الوسيط إلى Worker حقيقي في workerd
want laura-stats-ui && { if [ -n "${WRANGLER_BIN:-}" ] || command -v wrangler >/dev/null 2>&1; then run laura-stats-ui 600 node "$T/laura-stats-ui.js"; else skip laura-stats-ui "يحتاج wrangler (workerd) محلياً: WRANGLER_BIN"; fi; }   # LAURA تقرأ إحصائيات الرئيسية الحقيقية
want laura-admin-ui && { if [ -n "${WRANGLER_BIN:-}" ] || command -v wrangler >/dev/null 2>&1; then run laura-admin-ui 600 node "$T/laura-admin-ui.js"; else skip laura-admin-ui "يحتاج wrangler (workerd) محلياً: WRANGLER_BIN"; fi; }   # LAURA تقرأ إحصائيات الرئيسية الحقيقية
want laura-lang-ui && { if [ -n "${WRANGLER_BIN:-}" ] || command -v wrangler >/dev/null 2>&1; then run laura-lang-ui 600 node "$T/laura-lang-ui.js"; else skip laura-lang-ui "يحتاج wrangler (workerd) محلياً: WRANGLER_BIN"; fi; }   # LAURA تقرأ إحصائيات الرئيسية الحقيقية
want laura-exec-ui && { if [ -n "${WRANGLER_BIN:-}" ] || command -v wrangler >/dev/null 2>&1; then run laura-exec-ui 600 node "$T/laura-exec-ui.js"; else skip laura-exec-ui "يحتاج wrangler (workerd) محلياً: WRANGLER_BIN"; fi; }   # LAURA تقرأ إحصائيات الرئيسية الحقيقية
want laura-settings-ui && { if [ -n "${WRANGLER_BIN:-}" ] || command -v wrangler >/dev/null 2>&1; then run laura-settings-ui 600 node "$T/laura-settings-ui.js"; else skip laura-settings-ui "يحتاج wrangler (workerd) محلياً: WRANGLER_BIN"; fi; }   # LAURA تقرأ إحصائيات الرئيسية الحقيقية
want laura-shipping-ui && { if [ -n "${WRANGLER_BIN:-}" ] || command -v wrangler >/dev/null 2>&1; then run laura-shipping-ui 600 node "$T/laura-shipping-ui.js"; else skip laura-shipping-ui "يحتاج wrangler (workerd) محلياً: WRANGLER_BIN"; fi; }   # LAURA تقرأ إحصائيات الرئيسية الحقيقية
want lang-fr       && run lang-fr       600 node "$T/lang-fr.js"      # الفرنسية: زر FR/ع في Spatial + تزامن كل الألواح واللوحة + بطاقات الرئيسية + الاستمرار (متجر PHP محلي حقيقي)
want phone-scroll  && run phone-scroll  300 node "$T/phone-scroll.js"   # الهاتف: القاعدة ظاهرة، لوح 2D (عادي ومكبَّر)، سحب الإصبع يمرّر المحتوى
want touch-drag    && run touch-drag    600 node "$T/touch-drag.js"     # سحب النوافذ باللمس (أندرويد/آيفون/لوحي): الرأس والمكبَّر والغلاف وpointercancel والعبور فوق الإطار
want nav-instant   && run nav-instant   600 node "$T/nav-instant.js"    # فتح آني: النقر في المدار الثاني ينقل اللوح المفتوح إلى التبويب بلا تحميل (سطح مكتب + هاتف)
want orbits3      && run orbits3      600 node "$T/orbits3.js"       # ثلاثة مدارات (تبويبات ← إعدادات أولى ← إعدادات ثالثة) + فتح آني بألواح مسخَّنة مسبقاً
want drag-inside && run drag-inside  300 node "$T/drag-inside.js"   # السحب داخل البطاقات
want sphere-audio&& run sphere-audio 300 node "$T/sphere-audio.js"   # صوت الكرة ستيريو
want viewports       && run viewports       600 node "$T/spatial-viewports.js"
want run             && run run             900 node "$T/run.js" all
want phase9          && run phase9          900 node "$T/phase9.js" all
want phase10         && run phase10         900 node "$T/phase10.js" all
skip() { echo "⏭ $1  — NOT TESTED: $2"; printf '%s\tskip\t0\t0\t0\n' "$1" >> "$LOGS/summary.tsv"; }
# phase11 يحتاج وسيط الخادم server/llm.php (غير مضمَّن في main عمداً) وإلا يفشل بـ404 لا بخلل في الكود؛ وفي بيئة برمجية (بلا PHP/GPU/ميكروفون) يفشل بالمجموعة نفسها حتى على الكود المعتمد الأصلي
want phase11 && { [ -f "$T/../server/llm.php" ] && run phase11         900 node "$T/phase11.js" || skip phase11 "يحتاج server/llm.php (غير موجود في هذا الفرع)"; }
want client-12b && { grep -rqs "OrderTruth" assets/js && run client-12b      120 node "$T/phase12b-client.js" || skip client-12b "تختبر إصلاحات الطلبات 12B (OrderTruth) وهي غير موجودة في هذا الفرع"; }
want client-12b1 && { grep -rqs "OrderTruth" assets/js && run client-12b1     120 node "$T/phase12b1-client.js" || skip client-12b1 "تختبر إصلاحات الطلبات 12B (OrderTruth) وهي غير موجودة في هذا الفرع"; }
want client-12b1c && { grep -rqs "OrderTruth" assets/js && run client-12b1c    120 node "$T/phase12b1c-client.js" || skip client-12b1c "تختبر إصلاحات الطلبات 12B (OrderTruth) وهي غير موجودة في هذا الفرع"; }
echo; echo "ملخص (اسم / rc / ناجح / فاشل / ثوانٍ):"; column -t -s $'\t' "$LOGS/summary.tsv" 2>/dev/null || cat "$LOGS/summary.tsv"
exit "$fail"
