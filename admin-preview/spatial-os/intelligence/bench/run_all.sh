#!/bin/bash
# تقييم متسلسل (لا تشغّله بالتوازي مع التدريب: يفسد قياسات الكمون). المخرجات: results/*.jsonl + *.meta.json
cd "$(dirname "$0")/.."; PY=${PY:-/tmp/mlenv/bin/python}; export THREADS=4 HF_HOME=/tmp/hf; N=${N:-240}
run() { name=$1; shift; echo "== $name $(date +%T)"; $PY bench/run_model.py "$@" --out results/$name.jsonl 2>&1 | grep -v -E "Warning|Loading weights|deprecated" | tail -2; }
run qwen05-fewshot   --model Qwen/Qwen2.5-0.5B-Instruct --mode fewshot --split test --stratified --limit $N --batch 8 --dtype bfloat16 --bs1 12
run qwen15-fewshot   --model Qwen/Qwen2.5-1.5B-Instruct --mode fewshot --split test --stratified --limit $N --batch 8 --dtype bfloat16 --bs1 8
run smollm2-fewshot  --model HuggingFaceTB/SmolLM2-360M-Instruct --mode fewshot --split test --stratified --limit $N --batch 8 --dtype bfloat16 --bs1 12
run functiongemma-native --model unsloth/functiongemma-270m-it --mode native-fg --split test --stratified --limit $N --batch 8 --dtype bfloat16 --bs1 8 --max_new 120
run aisa-ar-ft-native    --model AISA-Framework/AISA-AR-FunctionCall-FT --mode native-fg --split test --stratified --limit $N --batch 8 --dtype bfloat16 --bs1 8 --max_new 120
run qwen05-lora-v1   --model Qwen/Qwen2.5-0.5B-Instruct --mode ft --adapter adapters/qwen05-lora-v1 --split test --batch 8 --dtype bfloat16 --bs1 40
echo ALLDONE $(date +%T)
