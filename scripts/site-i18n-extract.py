#!/usr/bin/env python3
"""يستخرج كل النصوص العربية في قوالب المكتبة (على مستوى العقدة النصية كما تُعرض) إلى scripts/site-i18n/ar-templates.json لترجمتها إلى الفرنسية.
python3 scripts/site-i18n-extract.py"""
import json, glob, re, os, collections
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); AR = re.compile(r"[؀-ۿ]")
S = collections.Counter()
def add(x):
    for piece in re.split(r"<[^>]+>", x):
        for line in piece.replace("&nbsp;", " ").replace("&amp;", "&").split("\n"):
            line = re.sub(r"\s+", " ", re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", line)).strip()
            if line and AR.search(line):
                S[line] += 1
                parts = [q.strip() for q in re.split(r"\s*[✦|]\s*|\s+·\s+|,", line)]      # سطر مركَّب من عدّة عناصر (قائمة خيارات/فواصل): كل جزء عبارة مستقلة
                if len(parts) > 1:
                    for q in parts:
                        if q and AR.search(q): S[q] += 1
def walk(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in ("tpl", "css", "fxs", "src", "img", "i", "link", "icon", "ic", "cat", "aid", "id", "type", "tag", "kind"): continue
            if k == "demo" and isinstance(v, list):
                for it in v:
                    for kk in ("t", "c"):
                        if isinstance(it.get(kk), str): add(it[kk])
                continue
            walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
    elif isinstance(o, str): add(o)
for f in sorted(glob.glob(R + "/assets/pages/templates/*.json")):
    t = os.path.basename(f)[:-5]
    if t == "index" or t.startswith("prod-") or t in ("s-alyssum", "p-focus-honey"): continue
    walk(json.load(open(f, encoding="utf-8")))
idx = json.load(open(R + "/assets/pages/templates/index.json", encoding="utf-8"))
for x in idx:
    if x.get("owner"): continue
    for k in ("n", "d"): 
        if isinstance(x.get(k), str): add(x[k])
out = sorted(S, key=lambda k: (-S[k], k)); json.dump(out, open(R + "/scripts/site-i18n/ar-templates.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(len(out), "عبارة،", sum(len(k) for k in out), "حرفاً")
