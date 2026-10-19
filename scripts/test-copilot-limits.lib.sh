# يُحمَّل من test-copilot-limits.sh: يعتمد المتغيرين $P و$D.
PASS=0; FAIL=0; chk() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "PASS $1"; else FAIL=$((FAIL+1)); echo "FAIL $1 (المتوقع $2 والفعلي $3)"; fi; }
T1=$(printf 'a%.0s' $(seq 1 40)); T2=$(printf 'b%.0s' $(seq 1 40)); T3=$(printf 'c%.0s' $(seq 1 40))
mk() { $P -c "insert into public.saas_sites (name, status, api_mode, api_token, ai_text_left, ai_image_left) values ('$1','active','shared','$2',$3,$4) returning id" | head -1; }
S1=$(mk s1 $T1 1000 1000); S2=$(mk s2 $T2 1000 1000); S3=$(mk s3 $T3 3 1000)
c2() { local K=null; [ -n "$5" ] && K="'$5'"; $P -c "select coalesce(public.saas_ai_charge2('$1','$2','$3','$4',$K)->>'reason','ok')"; }
# --- حدّ مكالمات النموذج في التشغيل: 20 طلباً متزامناً والحدّ 6
rm -f /tmp/cplim.a.*; for i in $(seq 1 20); do ( c2 $T1 text runLLM1 reqLLM$i > /tmp/cplim.a.$i ) & done; wait
OK=$(cat /tmp/cplim.a.* | grep -c '^ok$'); LIM=$(cat /tmp/cplim.a.* | grep -c '^run_llm_limit$')
chk "حدّ مكالمات النموذج: 6 ناجحة فقط من 20 متزامنة" 6 $OK; chk "الباقي 14 مرفوضة run_llm_limit" 14 $LIM
chk "عدّاد التشغيل = 6 بالضبط" 6 "$($P -c "select llm_calls from public.saas_ai_runs where site_id='$S1' and run_id='runLLM1'")"
chk "الرصيد خُصم 6 فقط (الرفض لا يخصم)" 994 "$($P -c "select ai_text_left from public.saas_sites where id='$S1'")"
# --- سقف الصور 8 في التشغيل
rm -f /tmp/cplim.b.*; for i in $(seq 1 15); do ( c2 $T1 image runIMG1 reqIMG$i k$i > /tmp/cplim.b.$i ) & done; wait
chk "سقف الصور: 8 ناجحة من 15 متزامنة" 8 "$(cat /tmp/cplim.b.* | grep -c '^ok$')"; chk "الباقي run_img_limit" 7 "$(cat /tmp/cplim.b.* | grep -c '^run_img_limit$')"
# --- نفس معرّف الطلب 12 مرة متزامنة ← خصم واحد
rm -f /tmp/cplim.c.*; for i in $(seq 1 12); do ( c2 $T1 text runDUP1 reqSAME01 > /tmp/cplim.c.$i ) & done; wait
chk "نفس req_id: خصم واحد فقط" 1 "$(cat /tmp/cplim.c.* | grep -c '^ok$')"; chk "الباقي duplicate_request" 11 "$(cat /tmp/cplim.c.* | grep -c '^duplicate_request$')"
# --- السقف اليومي: 60 طلباً نصياً متزامناً بتكلفة 1 والسقف 50 (موقع 2، كل طلب في تشغيل مختلف كي لا يصطدم بحدّ التشغيل)
$P -c "update public.saas_ai_policy set daily_cost_cap=50 where scope='default'" >/dev/null
rm -f /tmp/cplim.d.*; for i in $(seq 1 60); do ( c2 $T2 text runDAY$i reqDAY$i > /tmp/cplim.d.$i ) & done; wait
chk "السقف اليومي: 50 ناجحاً بالضبط من 60 متزامنة" 50 "$(cat /tmp/cplim.d.* | grep -c '^ok$')"; chk "10 مرفوضة daily_cap" 10 "$(cat /tmp/cplim.d.* | grep -c '^daily_cap$')"
chk "مجموع الدفتر = 50 (لا تجاوز)" 50 "$($P -c "select sum(cost)::int from public.saas_ai_ledger where site_id='$S2' and state='charged'")"
chk "الرصيد خُصم 50 فقط" 950 "$($P -c "select ai_text_left from public.saas_sites where id='$S2'")"
# --- الاسترداد: يعيد الرصيد والتكلفة اليومية مرة واحدة حتى لو تكرر النداء متزامناً
rm -f /tmp/cplim.e.*; for i in $(seq 1 8); do ( $P -c "select public.saas_ai_refund2('$T2','reqDAY1')->>'refunded'" > /tmp/cplim.e.$i ) & done; wait
chk "الاسترداد المتزامن 8 مرات = استرداد واحد" 1 "$(cat /tmp/cplim.e.* | grep -c true)"
chk "الرصيد استُرجع مرة واحدة (951)" 951 "$($P -c "select ai_text_left from public.saas_sites where id='$S2'")"
chk "بعد الاسترداد يتحرر مكان في السقف اليومي" ok "$(c2 $T2 text runDAYX reqDAYX)"
chk "ولا يتجاوز بعده" daily_cap "$(c2 $T2 text runDAYY reqDAYY)"
# --- إعادة المحاولة لا تتجاوز الحدّ: محاولتان لكل مفتاح صورة حتى مع الاسترداد
$P -c "update public.saas_ai_policy set daily_cost_cap=100000 where scope='default'" >/dev/null
chk "محاولة 1 لمفتاح صورة" ok "$(c2 $T1 image runTRY1 reqTRY1 asset1)"; $P -c "select public.saas_ai_refund2('$T1','reqTRY1')" >/dev/null
chk "محاولة 2 (بعد الاسترداد) مسموحة" ok "$(c2 $T1 image runTRY1 reqTRY2 asset1)"; $P -c "select public.saas_ai_refund2('$T1','reqTRY2')" >/dev/null
chk "محاولة 3 مرفوضة run_tries_limit رغم الاسترداد" run_tries_limit "$(c2 $T1 image runTRY1 reqTRY3 asset1)"
chk "إعادة نفس req_id بعد الاسترداد تُحسب محاولة (مرفوضة أيضاً)" run_tries_limit "$(c2 $T1 image runTRY1 reqTRY1 asset1)"
chk "مفتاح صورة آخر في نفس التشغيل لا يتأثر" ok "$(c2 $T1 image runTRY1 reqTRY4 asset2)"
# --- الرفض لا يغيّر شيئاً
B=$($P -c "select ai_image_left||'/'||(select count(*) from public.saas_ai_ledger where site_id='$S1')||'/'||(select images from public.saas_ai_runs where site_id='$S1' and run_id='runTRY1') from public.saas_sites where id='$S1'")
c2 $T1 image runTRY1 reqTRY9 asset1 >/dev/null; A=$($P -c "select ai_image_left||'/'||(select count(*) from public.saas_ai_ledger where site_id='$S1')||'/'||(select images from public.saas_ai_runs where site_id='$S1' and run_id='runTRY1') from public.saas_sites where id='$S1'")
chk "طلب مرفوض لا يغيّر الرصيد ولا الدفتر ولا العدّادات" "$B" "$A"
# --- رصيد الموقع الصغير (3) ينفد ثم يُرفض
for i in 1 2 3; do c2 $T3 text runCR1 reqCR$i >/dev/null; done; chk "نفاد رصيد الموقع no_credits" no_credits "$(c2 $T3 text runCR1 reqCR4)"
# --- تخصيص سياسة لموقع، توكن مجهول، معرّفات سيئة
$P -c "insert into public.saas_ai_policy (scope, run_llm_max) values ('$S3', 1) on conflict (scope) do update set run_llm_max=1" >/dev/null; $P -c "update public.saas_sites set ai_text_left=50 where id='$S3'" >/dev/null
chk "سياسة موقع مخصّصة (حدّ 1)" ok "$(c2 $T3 text runPOL1 reqPOL1)"; chk "والثاني مرفوض" run_llm_limit "$(c2 $T3 text runPOL1 reqPOL2)"
chk "توكن مجهول" unknown_token "$(c2 $(printf 'd%.0s' $(seq 1 40)) text runX0001 reqX0001)"
chk "معرّف تشغيل سيّئ" bad_request "$(c2 $T1 text 'bad run!' reqOK0001)"; chk "نوع سيّئ" bad_kind "$(c2 $T1 video runOK001 reqOK0002)"
# --- التوافق: الدالتان القديمتان ما زالتا تعملان
chk "saas_ai_charge القديمة تعمل" true "$($P -c "select (public.saas_ai_charge('$T1','text')->>'ok')")"
chk "لا وصول لـanon على الجداول/الدوال" 0 "$($P -c "select count(*) from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_name in ('saas_ai_ledger','saas_ai_runs','saas_ai_policy')")"
echo "حدود Copilot الدائمة SQL: $PASS ناجح، $FAIL فاشل"; [ "$FAIL" = "0" ]
