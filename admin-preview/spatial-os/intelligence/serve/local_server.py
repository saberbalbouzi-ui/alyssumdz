#!/usr/bin/env python3
"""خادم الاستدلال المحلي التجريبي (ALYSSUM Intelligence Engine): يخدم نموذجاً صغيراً (قاعدة + محوّل LoRA مدموج) عبر HTTP على المضيف المحلي فقط.
لا مفاتيح، لا بيانات أعمال: يستقبل نص المستخدم وسياقاً مضغوطاً (صلاحيات/آخر أداة/معرّفات/مرشحو منتجات) ويعيد خطة JSON + ثقة.
المصادقة والحدود والمهلة تتم في وسيط الخادم (server/llm.php) — هذا الخادم لا يُعرَّض خارج الجهاز (127.0.0.1 افتراضياً).
python local_server.py --model Qwen/Qwen2.5-0.5B-Instruct --adapter adapters/qwen05-lora-v1 --port 8787 [--fault bad_json|slow|low_conf] (الأعطال للاختبار فقط)"""
import os, sys, json, time, argparse, threading, math
os.environ.setdefault("HF_HOME", "/tmp/hf"); os.environ["TOKENIZERS_PARALLELISM"] = "false"
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from common import SYSTEM_FT, user_text, parse_plan
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ap = argparse.ArgumentParser(); ap.add_argument("--model", required=True); ap.add_argument("--adapter"); ap.add_argument("--port", type=int, default=8787); ap.add_argument("--host", default="127.0.0.1"); ap.add_argument("--fault", default=""); ap.add_argument("--max_new", type=int, default=90); ap.add_argument("--threads", type=int, default=4)
A = ap.parse_args(); torch.set_num_threads(A.threads)
tok = AutoTokenizer.from_pretrained(A.model); tok.padding_side = "left"
if tok.pad_token is None: tok.pad_token = tok.eos_token
model = AutoModelForCausalLM.from_pretrained(A.model, dtype=torch.bfloat16)
if A.adapter:
    from peft import PeftModel; model = PeftModel.from_pretrained(model, A.adapter).merge_and_unload()
FAULT = {"v": A.fault}
model.eval(); LOCK = threading.Lock(); STATS = {"n": 0, "ms": []}
def plan(text, ctx):
    case = {"text": text, "ctx": ctx}; p = tok.apply_chat_template([{"role": "system", "content": SYSTEM_FT}, {"role": "user", "content": user_text(case)}], tokenize=False, add_generation_prompt=True)
    enc = tok(p, return_tensors="pt", add_special_tokens=False); t0 = time.time()
    with LOCK, torch.no_grad(): out = model.generate(**enc, max_new_tokens=A.max_new, do_sample=False, pad_token_id=tok.pad_token_id, output_scores=True, return_dict_in_generate=True)
    seq = out.sequences[0, enc["input_ids"].shape[1]:]; ts = model.compute_transition_scores(out.sequences, out.scores, normalize_logits=True)[0]
    probs = [math.exp(x) for x in ts.float().tolist()]; txt = tok.decode(seq, skip_special_tokens=True); ms = (time.time() - t0) * 1000
    n = max(1, len(probs)); conf = math.exp(sum(math.log(max(1e-9, x)) for x in probs) / n); minp = min(probs) if probs else 0.0
    f = FAULT["v"]
    if f == "bad_json": txt = txt[:-3]
    if f == "ghost_tool": txt = '{"c":[{"a":{"cmd":"ls"},"n":"system.exec"}],"t":"tool"}'; conf = 0.97; minp = 0.9
    if f == "ghost_id": txt = '{"c":[{"a":{"id":"S261299-ZZZZZ"},"n":"orders.confirm"}],"t":"tool"}'; conf = 0.97; minp = 0.9
    if f == "bad_args": txt = '{"c":[{"a":{"status":"nouvelle","hack":1},"n":"orders.list"}],"t":"tool"}'; conf = 0.97; minp = 0.9
    if f == "perm_claim": txt = '{"k":"perm","t":"refuse"}'; conf = 0.97; minp = 0.9
    if f == "low_conf": conf, minp = 0.2, 0.05
    if f == "slow": time.sleep(20)
    STATS["n"] += 1; STATS["ms"].append(ms); STATS["ms"] = STATS["ms"][-200:]
    return {"plan": parse_plan(txt) if f != "bad_json" else None, "raw": txt[:300], "conf": round(conf, 4), "minp": round(minp, 4), "ms": round(ms), "tokens": len(probs)}
class H(BaseHTTPRequestHandler):
    def _j(self, code, d): b = json.dumps(d, ensure_ascii=False).encode(); self.send_response(code); self.send_header("Content-Type", "application/json; charset=utf-8"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path == "/health": s = sorted(STATS["ms"]); return self._j(200, {"ok": True, "model": A.model, "adapter": bool(A.adapter), "served": STATS["n"], "p50": s[len(s) // 2] if s else None, "fault": FAULT["v"] or None})
        self._j(404, {"ok": False})
    def do_POST(self):
        if self.path == "/__fault" and self.client_address[0] == "127.0.0.1":    # للاختبار فقط (محلي)
            n = int(self.headers.get("Content-Length", "0")); FAULT["v"] = str(json.loads(self.rfile.read(n)).get("fault", "")); return self._j(200, {"ok": True, "fault": FAULT["v"]})
        if self.path != "/plan": return self._j(404, {"ok": False})
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n > 20000: return self._j(413, {"ok": False, "error": "too_large"})
            d = json.loads(self.rfile.read(n)); text = str(d.get("text", ""))[:400]; ctx = d.get("ctx") or {}
            r = plan(text, ctx); r["ok"] = True; self._j(200, r)
        except Exception as e: self._j(400, {"ok": False, "error": str(e)[:100]})
    def log_message(self, *a): pass
if __name__ == "__main__": print("serving", A.model, "adapter" if A.adapter else "base", "on", A.host, A.port, flush=True); ThreadingHTTPServer((A.host, A.port), H).serve_forever()
