#!/usr/bin/env python3
"""يولّد README التكليف لـChatGPT (الصور والقالب) من platform/landing-kit/README.src.md
ويملأ {{EXTRA_TOOLS}} (الأدوات المساندة) من assets/data/tools-catalog.json.
الأدوات الرئيسية الـ15 مكتوبة يدوياً في 5.8 وفق platform/docs/tools-spec-15.md.
الاستعمال: python3 platform/tools/build-landing-readme.py [--out README.md]"""
import json, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "README.md"
MAIN = {"bg", "gen", "pshoot", "fashion", "tryon", "scene", "vd", "resize", "xp", "up", "erase", "recolor", "brand", "logo", "batch", "catalog", "cap"}
tools = json.load(open(os.path.join(ROOT, "assets", "data", "tools-catalog.json"), encoding="utf8"))["tools"]
extra = "، ".join(t["name"] for t in tools if t["id"] not in MAIN)
src = open(os.path.join(ROOT, "platform", "landing-kit", "README.src.md"), encoding="utf8").read()
open(out, "w", encoding="utf8").write(src.replace("{{EXTRA_TOOLS}}", extra))
print("OK", out)
