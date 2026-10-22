#!/usr/bin/env python3
"""يولّد كتالوج الأدوات للوحة (assets/data/tools-catalog.json) من saas/guide/tools.json (مصدر بيانات الأدوات: الاسم، الخطوات، النصائح، المتطلب).
لا صفحات دليل منفصلة: صفحة كل أداة هي صفحة التعريف saas/landing/<slug>/ (scripts/gen-landing.py) ويعرضها «ستوديو ديزاين» مباشرة.
أداة جديدة = أضفها إلى tools.json ثم شغّل هذا السكربت وأضف معالجها في AdminNav.deepTool إن لزم."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
d = root / "saas" / "guide"
data = json.loads((d / "tools.json").read_text(encoding="utf-8"))["tools"]
# فهرس الأدوات للوحة (إعدادات ← التطبيقات ← كل الأدوات): معرّف، مجموعة، اسم، سطر تعريف، متطلب، أيقونة، صفحة الدليل وصفحة التعريف
ti = json.loads((root / "assets" / "data" / "tool-titles.json").read_text(encoding="utf-8"))["tools"]
cat = [{"id": t["id"], "g": t["g"], "name": t["name"], "tag": t["tag"], "needs": t["needs"], "ic": (ti.get(t["id"]) or ti.get("xp" if t["id"] == "resize" else "", {})).get("icon", ""), "landing": t.get("landing", ""), "what": t.get("what", ""), "steps": t.get("steps", []), "tips": t.get("tips", []), "nt": t.get("needsText", ""), "rel": t.get("rel", []), "pd": bool(t.get("pd"))} for t in data]
(root / "assets" / "data" / "tools-catalog.json").write_text(json.dumps({"base": "https://alyssumdz.com/saas/", "tools": cat}, ensure_ascii=False, indent=1), encoding="utf-8")
print("tools:", len(data))
