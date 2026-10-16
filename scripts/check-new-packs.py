#!/usr/bin/env python3
"""يكشف حزم صور/قوالب الأدوات الجديدة في assets/ (مجلدات alyssum_*_webp أو أي مجلد فيه README_AR.txt وtemplate_*.webp) التي لا صفحة تعريف لها بعد في PACKS داخل gen-landing.py.
الاستعمال: python3 scripts/check-new-packs.py   (يطبع الحزم الجديدة وعدد صورها وتعليمات README؛ رمز الخروج 0 دائماً، والطباعة فارغة = لا جديد)."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "scripts" / "gen-landing.py").read_text(encoding="utf-8")
known = set(re.findall(r'"([a-z_]+_webp)"', src))
new = []
for d in sorted((root / "assets").iterdir()):
    if not d.is_dir() or d.name in known: continue
    if (d / "README_AR.txt").exists() or any(f.name.startswith("template_") for f in d.glob("*.webp")):
        imgs = d / "images" if (d / "images").is_dir() else d
        n = len([f for f in imgs.glob("*.webp") if not f.name.startswith("template")])
        if n: new.append((d.name, n))
for name, n in new:
    print(f"NEW_PACK {name} images={n}")
    r = root / "assets" / name / "README_AR.txt"
    if r.exists(): print("  README:", r.read_text(encoding="utf-8").strip().splitlines()[0])
