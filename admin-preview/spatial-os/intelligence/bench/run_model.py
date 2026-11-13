#!/usr/bin/env python3
"""يشغّل نموذجاً محلياً على حالات الاختبار ويكتب التنبؤات (plan) + الكمون لكل حالة.
الأنماط: fewshot (Qwen بتعليمات + 6 أمثلة) · native-fg (FunctionGemma بصيغة الأدوات الأصلية + أداتان وهميتان clarify/refuse كي يستطيع التعبير) · ft (نموذج مضبوط: SYSTEM قصير فقط، مع/بدون محوّل LoRA)
التشغيل: python run_model.py --model <hf id/path> --mode fewshot|native-fg|ft [--adapter dir] --split test --limit N --batch 8 --out preds.jsonl"""
import os, sys, json, time, argparse, re, resource
os.environ.setdefault("HF_HOME", "/tmp/hf"); os.environ["TOKENIZERS_PARALLELISM"] = "false"
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE)); sys.path.insert(0, HERE)
from common import SYSTEM, SYSTEM_FT, user_text, plan_text, parse_plan, REG
from score import load, stratified
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
SHOTS = [({"perms": ["orders", "write", "customers", "owner"], "last": None, "ids": [], "focus": None, "prod": None, "cands": []}, "شحال بعنا ليوم؟", {"t": "tool", "c": [{"n": "sales.summary", "a": {"period": "today"}}]}),
         ({"perms": ["orders", "write", "customers", "owner"], "last": {"tool": "sales.summary", "args": {"period": "today"}}, "ids": [], "focus": None, "prod": None, "cands": []}, "et hier ?", {"t": "tool", "c": [{"n": "sales.summary", "a": {"period": "yesterday"}}]}),
         ({"perms": ["orders", "write", "customers", "owner"], "last": None, "ids": [], "focus": None, "prod": None, "cands": []}, "جيبلي الكوموندات لي ما تأكدوش نتاع وهران", {"t": "tool", "c": [{"n": "orders.list", "a": {"status": "nouvelle", "wilaya": "وهران"}}]}),
         ({"perms": ["orders", "write", "customers", "owner"], "last": None, "ids": [], "focus": None, "prod": None, "cands": []}, "أكد الطلبية", {"t": "clarify", "k": "order"}),
         ({"perms": ["orders", "write", "customers", "owner"], "last": None, "ids": [], "focus": None, "prod": None, "cands": []}, "امسح كل الطلبيات", {"t": "refuse", "k": "unsupported"}),
         ({"perms": ["orders", "write", "customers", "owner"], "last": None, "ids": [], "focus": None, "prod": None, "cands": []}, "شحال بقى ف الستوك المنخفض؟ و شحال بعنا ليوم", {"t": "tool", "c": [{"n": "inventory.read", "a": {"low": True}}, {"n": "sales.summary", "a": {"period": "today"}}]})]
def fewshot_msgs(case):
    m = [{"role": "system", "content": SYSTEM}]
    for c, t, g in SHOTS: m += [{"role": "user", "content": user_text({"ctx": c, "text": t})}, {"role": "assistant", "content": plan_text(g)}]
    return m + [{"role": "user", "content": user_text(case)}]
def ft_msgs(case): return [{"role": "system", "content": SYSTEM_FT}, {"role": "user", "content": user_text(case)}]
def fg_tools():
    out = []
    for n, t in REG.items():
        props = {k: {kk: vv for kk, vv in v.items() if kk in ("type", "enum", "description")} for k, v in t["schema"].get("properties", {}).items()}
        for k, v in props.items(): v.setdefault("description", k)
        out.append({"type": "function", "function": {"name": n, "description": n.replace(".", " "), "parameters": {"type": "object", "properties": props, "required": t["schema"].get("required", [])}}})
    out.append({"type": "function", "function": {"name": "ask_clarification", "description": "ask the user which order/product/wilaya/what is meant", "parameters": {"type": "object", "properties": {"k": {"type": "string", "enum": ["order", "product", "wilaya", "period", "what"], "description": "missing item"}}, "required": ["k"]}}})
    out.append({"type": "function", "function": {"name": "refuse_request", "description": "refuse unsupported, unauthorized, bulk or unsafe request", "parameters": {"type": "object", "properties": {"k": {"type": "string", "enum": ["perm", "unsupported", "bulk", "unsafe"], "description": "reason"}}, "required": ["k"]}}}); return out
def fg_msgs(case): return [{"role": "developer", "content": "You are a model that can do function calling with the following functions. Context lines describe permissions and conversation state. Pick tools from the list only."}, {"role": "user", "content": user_text(case)}]
def parse_fg(txt):
    calls = []
    for m in re.finditer(r"call:([\w.]+)\{(.*?)\}(?:<end_function_call>|$)", txt, re.S):
        name, body = m.group(1), m.group(2); args = {}
        for k, v in re.findall(r"(\w+):(?:<escape>(.*?)<escape>|([^,}]+))", body, re.S) and [(a, b or c) for a, b, c in re.findall(r"(\w+):(?:<escape>(.*?)<escape>|([^,}]+))", body, re.S)]:
            v = v.strip(); args[k] = True if v == "true" else False if v == "false" else int(v) if re.fullmatch(r"-?\d+", v) else v
        calls.append((name, args))
    if not calls: return {"t": "chat"} if txt.strip() else None
    if calls[0][0] == "ask_clarification": return {"t": "clarify", "k": calls[0][1].get("k")}
    if calls[0][0] == "refuse_request": return {"t": "refuse", "k": calls[0][1].get("k")}
    return {"t": "tool", "c": [{"n": n, "a": a} for n, a in calls[:3]]}
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--model", required=True); ap.add_argument("--mode", default="ft"); ap.add_argument("--adapter"); ap.add_argument("--split", default="test"); ap.add_argument("--limit", type=int, default=0); ap.add_argument("--stratified", action="store_true"); ap.add_argument("--batch", type=int, default=8); ap.add_argument("--out", required=True); ap.add_argument("--max_new", type=int, default=90); ap.add_argument("--dtype", default="float32"); ap.add_argument("--bs1", type=int, default=0, help="قياس كمون تفاعلي (حالة واحدة) على n حالة")
    a = ap.parse_args(); torch.set_num_threads(int(os.environ.get("THREADS", "4")))
    cases = load(a.split); 
    if a.limit: cases = stratified(cases, a.limit) if a.stratified else cases[:a.limit]
    tok = AutoTokenizer.from_pretrained(a.model); tok.padding_side = "left"
    if tok.pad_token is None: tok.pad_token = tok.eos_token
    t0 = time.time(); model = AutoModelForCausalLM.from_pretrained(a.model, torch_dtype=getattr(torch, a.dtype)); 
    if a.adapter:
        from peft import PeftModel; model = PeftModel.from_pretrained(model, a.adapter); model = model.merge_and_unload()
    model.eval(); load_s = time.time() - t0
    def prompt(case):
        if a.mode == "fewshot": return tok.apply_chat_template(fewshot_msgs(case), tokenize=False, add_generation_prompt=True)
        if a.mode == "native-fg": return tok.apply_chat_template(fg_msgs(case), tools=fg_tools(), tokenize=False, add_generation_prompt=True)
        return tok.apply_chat_template(ft_msgs(case), tokenize=False, add_generation_prompt=True)
    outs = []; lat = []; ptoks = []
    def gen(prs):
        enc = tok(prs, return_tensors="pt", padding=True, add_special_tokens=False); t = time.time()
        with torch.no_grad(): g = model.generate(**enc, max_new_tokens=a.max_new, do_sample=False, pad_token_id=tok.pad_token_id)
        dt = (time.time() - t) * 1000; texts = tok.batch_decode(g[:, enc["input_ids"].shape[1]:], skip_special_tokens=False); return texts, dt, enc["input_ids"].shape[1]
    for i in range(0, len(cases), a.batch):
        b = cases[i:i + a.batch]; texts, dt, pl = gen([prompt(c) for c in b]); ptoks.append(pl)
        for c, tx in zip(b, texts):
            tx = tx.replace("<end_of_turn>", "").replace("<|im_end|>", "").replace("<eos>", "").replace("<pad>", "")
            plan = parse_fg(tx) if a.mode == "native-fg" else parse_plan(tx); outs.append({"id": c["id"], "plan": plan, "raw": tx[:300], "ms": dt / len(b)})
        print("%d/%d  %.0fms/case  prompt_tokens=%d" % (min(i + a.batch, len(cases)), len(cases), dt / len(b), pl), file=sys.stderr, flush=True)
    meta = {"model": a.model, "mode": a.mode, "adapter": a.adapter, "n": len(cases), "batch": a.batch, "load_s": round(load_s, 1), "max_rss_mb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024), "prompt_tokens_mean": round(sum(ptoks) / len(ptoks)), "threads": torch.get_num_threads(), "params_m": round(sum(p.numel() for p in model.parameters()) / 1e6)}
    if a.bs1:
        l1 = []
        for c in cases[:a.bs1]: _, dt, _ = gen([prompt(c)]); l1.append(dt)
        l1.sort(); meta["bs1_ms_p50"] = round(l1[len(l1) // 2]); meta["bs1_ms_p95"] = round(l1[min(len(l1) - 1, int(len(l1) * .95))])
    with open(a.out, "w", encoding="utf8") as f:
        for o in outs: f.write(json.dumps(o, ensure_ascii=False) + "\n")
    json.dump(meta, open(a.out + ".meta.json", "w"), indent=1); print(json.dumps(meta))
if __name__ == "__main__": main()
