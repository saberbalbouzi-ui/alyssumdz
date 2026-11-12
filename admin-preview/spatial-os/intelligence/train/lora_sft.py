#!/usr/bin/env python3
"""ضبط دقيق خاضع للإشراف (SFT) بـLoRA لنموذج صغير ليُخرج خطة أدوات متوافقة مع سجل ALYSSUM.
لا بيانات أعمال في الأوزان: التدريب على مجموعة اصطناعية فقط (dataset/alyssum-intel-v0.1/train.jsonl)؛ الأسعار/المنتجات/الزبائن تأتي في السياق وقت التشغيل.
الخسارة على رموز المساعد فقط. حلقة تدريب بسيطة (CPU)، حفظ دوري لإمكان الاستئناف.
python lora_sft.py --model Qwen/Qwen2.5-0.5B-Instruct --out adapters/qwen05-v1 --epochs 1 --max_examples 2000"""
import os, sys, json, time, random, argparse, math
os.environ.setdefault("HF_HOME", "/tmp/hf"); os.environ["TOKENIZERS_PARALLELISM"] = "false"
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE)); sys.path.insert(0, os.path.join(os.path.dirname(HERE), "bench"))
from common import SYSTEM, user_text, plan_text
from score import load
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import LoraConfig, get_peft_model
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--model", required=True); ap.add_argument("--out", required=True); ap.add_argument("--epochs", type=float, default=1); ap.add_argument("--bs", type=int, default=8); ap.add_argument("--lr", type=float, default=2e-4); ap.add_argument("--r", type=int, default=16); ap.add_argument("--max_examples", type=int, default=0); ap.add_argument("--max_len", type=int, default=224); ap.add_argument("--seed", type=int, default=3); ap.add_argument("--save_every", type=int, default=50); ap.add_argument("--max_minutes", type=float, default=0)
    a = ap.parse_args(); torch.set_num_threads(int(os.environ.get("THREADS", "4"))); torch.manual_seed(a.seed); R = random.Random(a.seed)
    tok = AutoTokenizer.from_pretrained(a.model); tok.padding_side = "right"
    if tok.pad_token is None: tok.pad_token = tok.eos_token
    rows = load("train"); R.shuffle(rows)
    if a.max_examples: rows = rows[:a.max_examples]
    def enc(r):
        msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user_text(r)}]
        p = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True); full = p + plan_text(r["gold"]) + tok.eos_token if "qwen" not in a.model.lower() else p + plan_text(r["gold"]) + "<|im_end|>"
        pi = tok(p, add_special_tokens=False)["input_ids"]; fi = tok(full, add_special_tokens=False)["input_ids"][:a.max_len]; lab = [-100] * len(pi) + fi[len(pi):]; return fi, lab[:len(fi)]
    data = [enc(r) for r in rows]; lens = [len(d[0]) for d in data]
    print("examples", len(data), "tokens mean/max", sum(lens) // len(lens), max(lens), flush=True)
    model = AutoModelForCausalLM.from_pretrained(a.model, torch_dtype=torch.float32)
    cfg = LoraConfig(r=a.r, lora_alpha=2 * a.r, lora_dropout=0.05, target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"], task_type="CAUSAL_LM"); model = get_peft_model(model, cfg); model.print_trainable_parameters()
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=a.lr, weight_decay=0.0)
    steps = int(math.ceil(len(data) * a.epochs / a.bs)); sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1, (s + 1) / 10) * max(.05, 1 - s / max(1, steps))); model.train(); t0 = time.time(); order = []
    while len(order) < steps * a.bs: o = list(range(len(data))); R.shuffle(o); order += o
    log = []
    for s in range(steps):
        b = [data[i] for i in order[s * a.bs:(s + 1) * a.bs]]; ml = max(len(x[0]) for x in b)
        ids = torch.tensor([x[0] + [tok.pad_token_id] * (ml - len(x[0])) for x in b]); lab = torch.tensor([x[1] + [-100] * (ml - len(x[1])) for x in b]); att = torch.tensor([[1] * len(x[0]) + [0] * (ml - len(x[0])) for x in b])
        with torch.autocast("cpu", dtype=torch.bfloat16, enabled=os.environ.get("BF16", "1") == "1"): loss = model(input_ids=ids, attention_mask=att, labels=lab).loss
        loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step(); sched.step(); opt.zero_grad(set_to_none=True)
        el = time.time() - t0; log.append(loss.item())
        if s % 5 == 0 or s == steps - 1: print("step %d/%d loss %.4f  %.1fs/step  elapsed %.0fs eta %.0fs" % (s + 1, steps, sum(log[-5:]) / len(log[-5:]), el / (s + 1), el, el / (s + 1) * (steps - s - 1)), flush=True)
        if (s + 1) % a.save_every == 0: model.save_pretrained(a.out)
        if a.max_minutes and el > a.max_minutes * 60: print("time budget reached; stopping at step", s + 1, flush=True); break
    model.save_pretrained(a.out); json.dump({"model": a.model, "examples": len(data), "steps_done": s + 1, "steps_planned": steps, "bs": a.bs, "lr": a.lr, "r": a.r, "train_seconds": round(time.time() - t0), "final_loss_avg10": round(sum(log[-10:]) / len(log[-10:]), 4), "tokens_mean": sum(lens) // len(lens)}, open(os.path.join(a.out, "train_meta.json"), "w"), indent=1); print("saved", a.out)
if __name__ == "__main__": main()
