#!/usr/bin/env python3
"""نموذج كلفة ALYSSUM Intelligence Engine: ثلاثة أنماط نشر × سيناريوهات استعمال، **كلها بافتراضات صريحة قابلة للتبديل** (لا أسعار مزوّدين محفوظة هنا كحقائق).
المدخلات المقيسة (من benchmark هذا المستودع): معدل تغطية NLU، معدل التصعيد، رموز الموجّه/المخرج، كمون وإنتاجية المحرّك المحلي على CPU.
المدخلات المفترضة (مُعلَّمة ASSUMPTION): أسعار الاستضافة/التراخيص/الرموز، عامل تسريع GPU، ذروة التزامن، ساعات الصيانة.
python cost_model.py measured.json > cost_tables.md   (measured.json يُولَّد من نتائج التقييم)"""
import json, sys, math
M = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else {}
# ───── مقيسة (افتراضات احتياطية إن غابت) ─────
unk = M.get("nlu_unknown_share", .30)           # حصة الطلبات التي يعجز عنها NLU (تحتاج نموذجاً)
esc = M.get("hybrid_escalation_share", .08)     # حصة ما يصعَّد للخارجي من طلبات النموذج المحلي
cpu_ms = M.get("local_cpu_ms_per_request_bs1", 700)   # كمون طلب واحد على CPU 4 أنوية (مقيس)
cpu_rps_batch = M.get("local_cpu_req_per_s_batched", 1.6)
p_tok_ft, o_tok_ft = M.get("ft_prompt_tokens", 170), M.get("ft_out_tokens", 45)
# ───── مفترضة (ASSUMPTION) ─────
A = {
 "ext_prompt_tokens": 1300, "ext_out_tokens": 140,    # موجّه خارجي: تصريحات أدوات + سياق + محادثة
 "ext_price_per_M": {"low (flash-lite class)": (0.10, 0.40), "mid (flash class)": (0.30, 2.50), "high (frontier class)": (3.0, 15.0)},   # دولار لكل مليون رمز (دخل/خرج) — ASSUMPTION
 "cpu_vm_month": 90.0,        # آلة 4–8 vCPU (ASSUMPTION، فئة VPS)
 "gpu_month": 450.0,          # GPU متوسط مستأجر شهرياً (ASSUMPTION؛ 0 = لا شيء قابل للتفاوض)
 "gpu_speedup_vs_cpu": 8.0,   # عامل تسريع لنموذج 0.5B مدمج bf16 مقابل 4 أنوية (ASSUMPTION غير مقيس هنا)
 "peak_factor": 6.0,          # نسبة ذروة الطلب إلى المتوسط (ASSUMPTION)
 "target_util": 0.55,         # استعمال مستهدف عند الذروة
 "monitoring_month": 40.0,    # مراقبة/تسجيل/تنبيه
 "maintenance_hours": 10, "eng_rate_hour": 40.0,   # صيانة النماذج شهرياً (ASSUMPTION)
 "retrain_per_quarter": 150.0,  # إعادة ضبط/تقييم كل ربع (حوسبة + وقت) — ASSUMPTION
 "min_instances": 2,          # نسختان لتوافرية مقبولة (يشمل الخمول)
}
SC = {"light": 300, "medium": 1500, "heavy": 6000}       # تفاعلات الوكيل/تاجر/شهر
FLEET = [50, 500, 5000]
def ext_cost_per_1k(price, tokens_share=1.0):
    pin, pout = price; return 1000 * tokens_share * (A["ext_prompt_tokens"] * pin + A["ext_out_tokens"] * pout) / 1e6
def local_instance_capacity(kind):
    rps = cpu_rps_batch * (A["gpu_speedup_vs_cpu"] if kind == "gpu" else 1.0)
    return rps * 3600 * 24 * 30 * A["target_util"] / A["peak_factor"]       # طلبات/شهر/نسخة مع حساب الذروة
def instances(total_req, kind): return max(A["min_instances"], math.ceil(total_req / local_instance_capacity(kind)))
def fixed(): return A["monitoring_month"] + A["maintenance_hours"] * A["eng_rate_hour"] + A["retrain_per_quarter"] / 3
rows = []
for fleet in FLEET:
    for sname, per in SC.items():
        total = fleet * per; need_model = total * unk
        r = {"merchants": fleet, "usage": sname, "interactions_per_merchant_month": per, "total_interactions": total, "needs_model": int(need_model)}
        # B: خارجي انتقائي فقط (NLU للباقي)
        for lab, price in A["ext_price_per_M"].items(): r["B_" + lab.split()[0]] = round(need_model * ext_cost_per_1k(price) / 1000, 2)
        # A: محلي (GPU مشترك) + تصعيد
        for kind in ("cpu", "gpu"):
            n = instances(need_model, kind); host = n * (A["cpu_vm_month"] if kind == "cpu" else A["gpu_month"]); esc_cost = need_model * esc * ext_cost_per_1k(A["ext_price_per_M"]["mid (flash class)"]) / 1000
            r["A_%s_instances" % kind] = n; r["A_%s_month_total" % kind] = round(host + fixed() + esc_cost, 2); r["A_%s_per_1k_interactions" % kind] = round((host + fixed() + esc_cost) / total * 1000, 3); r["A_%s_per_merchant" % kind] = round((host + fixed() + esc_cost) / fleet, 3)
        for lab in ("low", "mid", "high"): r["B_%s_per_1k" % lab] = round(r["B_" + lab] / total * 1000, 3); r["B_%s_per_merchant" % lab] = round(r["B_" + lab] / fleet, 3)
        rows.append(r)
out = {"assumptions": A, "measured": {"nlu_unknown_share": unk, "hybrid_escalation_share": esc, "cpu_ms_bs1": cpu_ms, "cpu_req_per_s_batched": cpu_rps_batch, "ft_prompt_tokens": p_tok_ft, "ft_out_tokens": o_tok_ft}, "fixed_monthly": round(fixed(), 2), "capacity_req_per_month": {"cpu": int(local_instance_capacity("cpu")), "gpu": int(local_instance_capacity("gpu"))}, "rows": rows}
json.dump(out, open(sys.argv[2] if len(sys.argv) > 2 else "cost_result.json", "w"), indent=1)
def md():
    L = ["| تجار | استعمال | طلبات تحتاج نموذجاً/شهر | A: CPU نسخ | A: CPU $/شهر | A: CPU $/1000 | A: GPU نسخ | A: GPU $/شهر | A: GPU $/1000 | B: خارجي low $/1000 | B mid | B high |", "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows: L.append("| %d | %s (%d) | %d | %d | %.0f | %.3f | %d | %.0f | %.3f | %.3f | %.3f | %.3f |" % (r["merchants"], r["usage"], r["interactions_per_merchant_month"], r["needs_model"], r["A_cpu_instances"], r["A_cpu_month_total"], r["A_cpu_per_1k_interactions"], r["A_gpu_instances"], r["A_gpu_month_total"], r["A_gpu_per_1k_interactions"], r["B_low_per_1k"], r["B_mid_per_1k"], r["B_high_per_1k"]))
    return "\n".join(L)
print(md())
