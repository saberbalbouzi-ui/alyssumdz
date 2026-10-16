#!/usr/bin/env python3
"""يولّد README التكليف لـChatGPT (الصور والقالب) من platform/landing-kit/README.src.md
ويملأ {{TOOLS_TABLE}} من assets/data/tools-catalog.json.   الاستعمال: python3 platform/tools/build-landing-readme.py [--out README.md]"""
import json, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "README.md"
tools = json.load(open(os.path.join(ROOT, "assets", "data", "tools-catalog.json"), encoding="utf8"))["tools"]
rows = ["| الأداة | المجموعة | ما تفعله | النوع |", "|---|---|---|---|"]
for t in tools:
    rows.append("| **%s** | %s | %s | %s |" % (t["name"], t["g"], t["tag"], "مجانية (في المتصفح)" if t["needs"] == "free" else "بالذكاء (بتكلفة شفافة)"))
src = open(os.path.join(ROOT, "platform", "landing-kit", "README.src.md"), encoding="utf8").read()
open(out, "w", encoding="utf8").write(src.replace("{{TOOLS_TABLE}}", "\n".join(rows)))
print("OK", out, len(tools), "أداة")
