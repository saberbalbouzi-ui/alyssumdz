#!/usr/bin/env python3
"""يجمع results/*.jsonl في جدول مقارنة (markdown + json). مقارنة عادلة: كل المرشحين على نفس العيّنة الطبقية (240) + النموذج المضبوط والـNLU على الاختبار الكامل."""
import os, sys, json, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from score import load, stratified, score_case, aggregate
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RES = os.path.join(HERE, "results")
test = {c["id"]: c for c in load("test")}
def ev(path, restrict=None):
    rs = []; lat = []
    for l in open(path, encoding="utf8"):
        d = json.loads(l)
        if restrict and d["id"] not in restrict: continue
        rs.append(score_case(test[d["id"]], d.get("plan"))); lat.append(d.get("ms", 0))
    return aggregate(rs, lat), rs
out = {}; sub = {c["id"] for c in stratified(load("test"), 240)}
nlu_all = os.path.join(RES, "nlu-baseline.jsonl")
if os.path.exists(nlu_all):
    out["nlu-baseline (full test)"] = {"agg": ev(nlu_all)[0], "meta": {"kind": "deterministic rules", "params_m": 0}}
    out["nlu-baseline (240 subset)"] = {"agg": ev(nlu_all, sub)[0], "meta": {"kind": "deterministic rules", "params_m": 0}}
for p in sorted(glob.glob(os.path.join(RES, "*.jsonl"))):
    n = os.path.basename(p)[:-6]
    if n.startswith("nlu"): continue
    meta = json.load(open(p + ".meta.json")) if os.path.exists(p + ".meta.json") else {}
    out[n + " (n=%s)" % meta.get("n", "?")] = {"agg": ev(p)[0], "meta": meta}
json.dump(out, open(os.path.join(RES, "summary.json"), "w"), indent=1, ensure_ascii=False)
K = [("exact_plan_acc", "exact"), ("action_acc", "action"), ("tool_selection_acc", "tool"), ("args_correct_acc", "args"), ("schema_valid_calls_pct", "schema✓"), ("hallucinated_tool_pct", "halluc%"), ("unsafe_write_pct", "unsafe-write%"), ("dialect_exact_acc", "dialect"), ("msa_fr_exact_acc", "msa/fr"), ("followup_exact_acc", "follow-up"), ("clarify_recall", "clarify-R"), ("clarify_precision", "clarify-P"), ("refusal_recall", "refuse-R"), ("false_refusal_pct", "false-refuse%"), ("hand_gold_exact_acc", "hand-gold"), ("latency_ms_p50", "p50ms"), ("latency_ms_p95", "p95ms")]
L = ["| النموذج | " + " | ".join(k[1] for k in K) + " | RSS MB | bs1 p50/p95 ms | params M |", "|" + "---|" * (len(K) + 4)]
for n, v in out.items():
    a, m = v["agg"], v["meta"]; L.append("| %s | " % n + " | ".join(str(a.get(k[0], "—")) for k in K) + " | %s | %s | %s |" % (m.get("max_rss_mb", "—"), ("%s/%s" % (m.get("bs1_ms_p50"), m.get("bs1_ms_p95"))) if m.get("bs1_ms_p50") else "—", m.get("params_m", "—")))
open(os.path.join(RES, "summary.md"), "w", encoding="utf8").write("\n".join(L) + "\n"); print("\n".join(L))
