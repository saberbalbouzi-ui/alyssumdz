#!/usr/bin/env python3
"""يختار من الاختبار الكامل حالات عرض «مستقلة السياق» (لا تعتمد على منتجات/معرّفات متجر بعينه): NLU الحالي يفشل فيها والمحرّك المحلي المضبوط ينجح (تطابق تام) — لتُستعمل في اختبار التكامل الحقيقي (phase11a.js)"""
import os, sys, json, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from score import load, score_case
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RES = os.path.join(HERE, "results")
test = {c["id"]: c for c in load("test")}
def preds(p): return {json.loads(l)["id"]: json.loads(l) for l in open(p, encoding="utf8")}
loc = preds(os.path.join(RES, sys.argv[1] if len(sys.argv) > 1 else "qwen05-lora-v1.jsonl")); nlu = preds(os.path.join(RES, "nlu-baseline.jsonl"))
SETUP = {"sales.summary": {"today": "شحال بعنا اليوم؟", "yesterday": "شحال بعنا البارح؟", "week": "شحال بعنا هاد الأسبوع؟", "month": "شحال بعنا هاد الشهر؟"}, "orders.list": {"nouvelle": "وريني الطلبات غير المؤكدة", "confirmee": "وريني الطلبات المؤكدة", "expediee": "وريني الطلبات المرسلة"}}
def setup_for(c):
    l = c["ctx"].get("last")
    if not l: return ""
    a = l["args"]
    if l["tool"] == "sales.summary" and set(a) == {"period"}: return SETUP["sales.summary"].get(a["period"], "")
    if l["tool"] == "orders.list" and set(a) == {"status"}: return SETUP["orders.list"].get(a["status"], "")
    return ""
R = random.Random(11); picks = {"single": [], "followup": [], "multistep": [], "refuse": [], "clarify": []}
ids = sorted(test)
R.shuffle(ids)
for i in ids:
    c = test[i]; g = c["gold"]; x = c["ctx"]; lr = score_case(c, loc[i]["plan"]) if i in loc else None; nr = score_case(c, nlu[i]["plan"]) if i in nlu else None
    if not lr or not lr["exact"] or (nr and nr["exact"]): continue
    nlu_unknown = nlu[i]["plan"].get("t") == "unknown"
    full = set(x["perms"]) == {"orders", "write", "customers", "owner"}
    if not full: continue
    bare = not x["ids"] and not x["cands"] and not x["focus"] and not x["prod"]
    rec = {"id": i, "text": c["text"], "lang": c["lang"], "category": c["category"], "gold": g, "ctx": x, "setup": setup_for(c), "local_conf": loc[i].get("conf")}
    if nlu_unknown and g["t"] == "tool" and c["category"] in ("sales", "orders", "inventory", "settings", "ui") and bare and not x["last"] and c["lang"] in ("dz", "ar", "mix") and len(picks["single"]) < 12: picks["single"].append(rec)
    elif nlu_unknown and g["t"] == "tool" and c["category"] == "followup" and bare and rec["setup"] and len(picks["followup"]) < 6: picks["followup"].append(rec)
    elif nlu_unknown and g["t"] == "tool" and c["category"] == "multistep" and bare and len(picks["multistep"]) < 4: picks["multistep"].append(rec)
    elif g["t"] == "refuse" and g["k"] in ("unsupported", "bulk", "unsafe") and len(picks["refuse"]) < 6: picks["refuse"].append(rec)
    elif g["t"] == "clarify" and g["k"] in ("order", "what", "wilaya") and bare and not x["last"] and len(picks["clarify"]) < 4: picks["clarify"].append(rec)
json.dump(picks, open(os.path.join(HERE, "bench", "demo_cases.json"), "w"), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in picks.items()})
for k, v in picks.items():
    for r in v[:3]: print(k, r["lang"], r["text"], "|", json.dumps(r["gold"], ensure_ascii=False)[:90], "| setup:", r["setup"])
